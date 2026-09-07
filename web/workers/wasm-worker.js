import { registerWebWorker } from '@sentry/browser';
import { registerWebWorkerWasm } from '@sentry/wasm';
import { loadEmscriptenModule, loadWasmBindgenModule } from '../harness/loaders.js';
import { runStepGame } from '../harness/step-game.js';

// Main-thread wasmIntegration never patches this isolate — hook WebAssembly here
// and post debug images to the page before any .wasm is instantiated.
registerWebWorkerWasm({ self });
// registerWebWorker({ self }); 

/** @type {Record<string, () => void> | null} */
let rustExports = null;

/** @type {object | null} */
let emscriptenMod = null;

/** @type {'caught' | 'uncaught'} */
let crashMode = 'caught';

/** @type {'divzero' | 'deep_stack' | null} */
let pendingCrashType = null;

let loopStarted = false;
let lastTick = 0;

/**
 * ENVIRONMENT=web Emscripten glue expects window/document. Dedicated workers only have self.
 */
function shimBrowserGlobals() {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
  }
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      currentScript: null,
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  }
}

/**
 * @param {unknown} err
 * @returns {{ name: string, message: string, stack?: string }}
 */
function serializeError(err) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return { name: 'Error', message: String(/** @type {{ message: unknown }} */ (err).message) };
  }
  return { name: 'Error', message: String(err) };
}

/**
 * Emscripten glue is a classic script (`var createMazeModule`), not an ES module.
 * Indirect eval runs it on the worker global.
 * @param {string} glueUrl
 * @param {string} glueGlobal
 */
async function loadEmscriptenCreateModule(glueUrl, glueGlobal) {
  shimBrowserGlobals();
  const source = await fetch(glueUrl).then(response => {
    if (!response.ok) {
      throw new Error(`Worker: failed to load glue ${glueUrl} (${response.status})`);
    }
    return response.text();
  });
  (0, eval)(source);
  const createModule = globalThis[glueGlobal];
  if (typeof createModule !== 'function') {
    throw new Error(`Worker: ${glueGlobal} missing after glue eval`);
  }
  return createModule;
}

/**
 * @param {string} wasmUrl
 */
function emscriptenModuleConfig(wasmUrl) {
  /** @type {Record<string, unknown>} */
  const moduleConfig = {
    locateFile: path => (typeof path === 'string' && path.endsWith('.wasm') ? wasmUrl : new URL(String(path), wasmUrl).href),
  };
  if (typeof OffscreenCanvas === 'function') {
    moduleConfig.canvas = new OffscreenCanvas(640, 480);
  }
  return moduleConfig;
}

/**
 * Minimal game loop so worker traps run in `_step_game` like the main thread.
 * setInterval keeps ticking after a one-shot trap (C++ pending flag clears).
 * @param {object} mod
 */
function startEmscriptenLoop(mod) {
  if (loopStarted) {
    return;
  }
  loopStarted = true;
  lastTick = 0;

  self.setInterval(() => {
    const now = performance.now();
    const dt = lastTick ? now - lastTick : 0;
    lastTick = now;
    runStepGame({
      mod,
      dt,
      crashMode,
      onCaught(err) {
        const crashType = pendingCrashType;
        if (!crashType) {
          return;
        }
        pendingCrashType = null;
        self.postMessage({
          type: 'crash-result',
          crashType,
          error: serializeError(err),
          panicLine: null,
        });
      },
    });
  }, 16);
}

self.addEventListener('error', event => {
  if (crashMode !== 'uncaught' || !emscriptenMod) {
    return;
  }
  const crashType = pendingCrashType;
  if (!crashType) {
    return;
  }
  pendingCrashType = null;
  self.postMessage({
    type: 'crash-escaped',
    crashType,
    error: serializeError(event.error ?? event.message),
  });
});

/**
 * @param {object} data
 */
async function initFromMessage(data) {
  const glueUrl = /** @type {string} */ (data.glueUrl);
  const wasmUrl = /** @type {string} */ (data.wasmUrl);
  const wasmLoad = /** @type {'streaming' | 'non-streaming' | 'default'} */ (data.wasmLoad ?? 'streaming');
  const loader = /** @type {'emscripten' | 'wasm-bindgen'} */ (data.loader);
  crashMode = data.crashMode === 'uncaught' ? 'uncaught' : 'caught';

  if (loader === 'emscripten') {
    const glueGlobal = /** @type {string} */ (data.glueGlobal);
    const createModule = await loadEmscriptenCreateModule(glueUrl, glueGlobal);
    const mod = await loadEmscriptenModule({
      createModule,
      wasmUrl,
      load: wasmLoad,
      moduleConfig: emscriptenModuleConfig(wasmUrl),
    });
    if (
      typeof mod._arm_crash_divzero !== 'function' ||
      typeof mod._arm_crash_deep !== 'function' ||
      typeof mod._step_game !== 'function' ||
      typeof mod._init_game !== 'function'
    ) {
      throw new Error('Worker: Emscripten arm/step_game exports missing — run make and rebuild JS');
    }
    mod._init_game((Math.random() * 0x7fffffff) | 0, 1);
    emscriptenMod = mod;
    startEmscriptenLoop(mod);
    return wasmLoad;
  }

  const glue = await import(/* webpackIgnore: true */ glueUrl);
  if (typeof glue.default !== 'function') {
    throw new Error('Worker: glue missing default export');
  }
  await loadWasmBindgenModule({
    init: glue.default,
    wasmUrl,
    load: wasmLoad,
  });
  if (typeof glue.ping !== 'function' || glue.ping() !== 1) {
    throw new Error('Worker: ping failed');
  }
  rustExports = {
    trigger_crash_divzero: glue.trigger_crash_divzero,
    trigger_crash_deep: glue.trigger_crash_deep,
  };
  return wasmLoad;
}

/**
 * Rust has no game loop — still call trigger_crash_* immediately.
 * @param {'trigger_crash_divzero' | 'trigger_crash_deep'} exportName
 */
function runRustCrash(exportName) {
  const fn = rustExports?.[exportName];
  if (typeof fn !== 'function') {
    self.postMessage({
      type: 'crash-result',
      exportName,
      error: { name: 'Error', message: `${exportName} not loaded in worker` },
      panicLine: null,
    });
    return;
  }

  let panicLine = null;
  const original = console.error;
  console.error = (...args) => {
    for (const arg of args) {
      if (typeof arg === 'string' && arg.includes('panicked at') && panicLine === null) {
        panicLine = arg.split(/\n\nStack:/)[0]?.trim() ?? arg;
        original.apply(console, [panicLine]);
        return;
      }
    }
    original.apply(console, args);
  };

  try {
    fn();
    self.postMessage({ type: 'crash-result', exportName, error: null, panicLine });
  } catch (err) {
    self.postMessage({
      type: 'crash-result',
      exportName,
      error: serializeError(err),
      panicLine,
    });
  } finally {
    console.error = original;
  }
}

self.onmessage = async event => {
  const data = event.data;
  if (!data || typeof data !== 'object' || !('type' in data)) {
    return;
  }

  if (data.type === 'init') {
    try {
      const wasmLoad = await initFromMessage(data);
      self.postMessage({ type: 'ready', wasmLoad });
    } catch (err) {
      self.postMessage({ type: 'init-error', error: serializeError(err) });
    }
    return;
  }

  if (data.type === 'arm') {
    const mod = emscriptenMod;
    if (!mod) {
      self.postMessage({
        type: 'crash-result',
        crashType: 'divzero',
        error: { name: 'Error', message: 'Emscripten module not loaded in worker' },
        panicLine: null,
      });
      return;
    }

    crashMode = data.crashMode === 'uncaught' ? 'uncaught' : 'caught';
    const crash = data.crash === 'deep_stack' ? 'deep_stack' : 'divzero';
    pendingCrashType = crash;
    const fn = crash === 'deep_stack' ? mod._arm_crash_deep : mod._arm_crash_divzero;
    fn();
    return;
  }

  if (data.type === 'crash') {
    const exportName = /** @type {'trigger_crash_divzero' | 'trigger_crash_deep'} */ (data.exportName);
    runRustCrash(exportName);
  }
};
