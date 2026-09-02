import { registerWebWorkerWasm } from '@sentry/wasm';
import { loadEmscriptenModule, loadWasmBindgenModule } from '../harness/loaders.js';

// Main-thread wasmIntegration never patches this isolate — hook WebAssembly here
// and post debug images to the page before any .wasm is instantiated.
registerWebWorkerWasm({ self });

/** @type {Record<string, () => void> | null} */
let wasmExports = null;

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
 * @param {object} data
 */
async function initFromMessage(data) {
  const glueUrl = /** @type {string} */ (data.glueUrl);
  const wasmUrl = /** @type {string} */ (data.wasmUrl);
  const wasmLoad = /** @type {'streaming' | 'non-streaming' | 'default'} */ (data.wasmLoad ?? 'streaming');
  const loader = /** @type {'emscripten' | 'wasm-bindgen'} */ (data.loader);

  if (loader === 'emscripten') {
    const glueGlobal = /** @type {string} */ (data.glueGlobal);
    const createModule = await loadEmscriptenCreateModule(glueUrl, glueGlobal);
    const mod = await loadEmscriptenModule({
      createModule,
      wasmUrl,
      load: wasmLoad,
      moduleConfig: emscriptenModuleConfig(wasmUrl),
    });
    const divzero = mod._trigger_crash_divzero;
    const deep = mod._trigger_crash_deep;
    if (typeof divzero !== 'function' || typeof deep !== 'function') {
      throw new Error('Worker: Emscripten crash exports missing');
    }
    wasmExports = {
      trigger_crash_divzero: divzero,
      trigger_crash_deep: deep,
    };
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
  wasmExports = {
    trigger_crash_divzero: glue.trigger_crash_divzero,
    trigger_crash_deep: glue.trigger_crash_deep,
  };
  return wasmLoad;
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

  if (data.type === 'crash') {
    const exportName = /** @type {'trigger_crash_divzero' | 'trigger_crash_deep'} */ (data.exportName);
    const fn = wasmExports?.[exportName];
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
};
