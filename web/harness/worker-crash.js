import { captureHarnessException } from './sentry-context.js';
import { trimRustPanicMessage } from './rust-panic.js';
import { Sentry, sentryDsnSet } from '../sentry-init.js';
import { syncCrashQueryInUrl } from './emscripten-crash.js';

/** @type {Worker | null} */
let worker = null;
/** @type {Promise<Worker> | null} */
let workerReady = null;

/**
 * Rebuild the worker Error so Sentry still sees wasm frames in `stack`.
 * @param {{ name: string, message: string, stack?: string }} payload
 */
function errorFromPayload(payload) {
  const err = new Error(payload.message);
  err.name = payload.name;
  if (payload.stack) {
    err.stack = payload.stack;
  }
  return err;
}

/**
 * @param {import('./config.js').getHarnessConfig extends () => infer R ? R : never} config
 * @returns {Promise<Worker>}
 */
function ensureWorker(config) {
  if (workerReady) {
    return workerReady;
  }

  workerReady = new Promise((resolve, reject) => {
    const next = new Worker(new URL('wasm-worker.js', window.location.href), { type: 'module' });

    if (sentryDsnSet) {
      Sentry.addIntegration(Sentry.webWorkerIntegration({ worker: next }));
    }

    const onMessage = event => {
      const data = event.data;
      if (!data || typeof data !== 'object' || !('type' in data)) {
        return;
      }
      if (data.type === 'ready') {
        next.removeEventListener('message', onMessage);
        next.removeEventListener('error', onError);
        resolve(next);
        return;
      }
      if (data.type === 'init-error') {
        next.removeEventListener('message', onMessage);
        next.removeEventListener('error', onError);
        next.terminate();
        worker = null;
        workerReady = null;
        reject(errorFromPayload(data.error));
      }
    };

    const onError = event => {
      next.removeEventListener('message', onMessage);
      next.removeEventListener('error', onError);
      next.terminate();
      worker = null;
      workerReady = null;
      reject(new Error(event.message || 'Failed to load wasm-worker.js — run npm run build:js'));
    };

    next.addEventListener('message', onMessage);
    next.addEventListener('error', onError);

    next.postMessage({
      type: 'init',
      loader: config.loader,
      glueGlobal: config.glueGlobal,
      glueUrl: new URL(config.glueScript, window.location.href).href,
      wasmUrl: config.wasmUrl,
      wasmLoad: config.load,
      crashMode: config.crashMode,
    });

    worker = next;
  });

  return workerReady;
}

/**
 * Rust worker: immediate trigger_crash_* (no game loop).
 * @param {Worker} target
 * @param {'trigger_crash_divzero' | 'trigger_crash_deep'} exportName
 * @returns {Promise<{ error: { name: string, message: string, stack?: string } | null, panicLine: string | null }>}
 */
function requestRustCrash(target, exportName) {
  return new Promise((resolve, reject) => {
    const onMessage = event => {
      const data = event.data;
      if (!data || typeof data !== 'object' || data.type !== 'crash-result') {
        return;
      }
      target.removeEventListener('message', onMessage);
      resolve({ error: data.error, panicLine: data.panicLine ?? null });
    };
    target.addEventListener('message', onMessage);
    try {
      target.postMessage({ type: 'crash', exportName });
    } catch (err) {
      target.removeEventListener('message', onMessage);
      reject(err);
    }
  });
}

/**
 * Emscripten worker: arm only; trap runs on the next worker `step_game`.
 * @param {Worker} target
 * @param {'divzero' | 'deep_stack'} crash
 * @param {'caught' | 'uncaught'} crashMode
 * @returns {Promise<{ error: { name: string, message: string, stack?: string } | null, crashType?: string }>}
 */
function requestArm(target, crash, crashMode) {
  return new Promise((resolve, reject) => {
    const wanted = crashMode === 'uncaught' ? 'crash-escaped' : 'crash-result';

    const onMessage = event => {
      const data = event.data;
      if (!data || typeof data !== 'object' || data.type !== wanted) {
        return;
      }
      cleanup();
      resolve({ error: data.error, crashType: data.crashType });
    };

    const onError = () => {
      if (crashMode !== 'uncaught') {
        return;
      }
      cleanup();
      resolve({
        error: { name: 'Error', message: 'worker uncaught trap' },
        crashType: crash,
      });
    };

    function cleanup() {
      target.removeEventListener('message', onMessage);
      target.removeEventListener('error', onError);
    }

    target.addEventListener('message', onMessage);
    if (crashMode === 'uncaught') {
      target.addEventListener('error', onError);
    }

    try {
      target.postMessage({ type: 'arm', crash, crashMode });
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

/**
 * Load this harness backend's wasm in a dedicated worker and capture the crash on the page.
 * @param {import('./config.js').getHarnessConfig extends () => infer R ? R : never} config
 */
export function wireWasmWorkerCrashTest(config) {
  const button = document.getElementById('trigger-wasm-worker');
  const feedback = document.getElementById('sentry-feedback');

  if (!button) {
    return;
  }

  function showFeedback(message) {
    if (feedback) {
      feedback.textContent = message;
    }
    console.log('[sentry test]', message);
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    const isEmscripten = config.loader === 'emscripten';

    try {
      const target = await ensureWorker(config);

      if (!isEmscripten) {
        showFeedback('Calling WASM worker crash…');
        const { error, panicLine } = await requestRustCrash(target, 'trigger_crash_divzero');
        if (!error) {
          showFeedback('Worker crash returned (unexpected)');
          return;
        }

        const err = errorFromPayload(error);
        console.error('[wasm crash]', err.message);
        captureHarnessException(err, 'worker', { panicMessage: trimRustPanicMessage(panicLine) });
        showFeedback(
          sentryDsnSet
            ? `WASM worker: ${err.message} — sent to Sentry.`
            : `WASM worker: ${err.message} — no DSN in build.`,
        );
        return;
      }

      const crashMode = config.crashMode;
      syncCrashQueryInUrl(crashMode);
      showFeedback(`Armed divzero in worker — next step_game (capture=${crashMode})`);

      const { error } = await requestArm(target, 'divzero', crashMode);
      if (!error) {
        showFeedback('Worker crash returned (unexpected)');
        return;
      }

      const err = errorFromPayload(error);
      console.error('[wasm crash]', err.message);

      if (crashMode === 'uncaught') {
        showFeedback(
          sentryDsnSet
            ? `WASM worker trap escaped (capture=uncaught) — webWorkerIntegration / GlobalHandlers should report it.`
            : `WASM worker trap escaped (capture=uncaught) — no DSN in build.`,
        );
        return;
      }

      captureHarnessException(err, 'worker');
      showFeedback(
        sentryDsnSet
          ? `WASM worker: ${err.message} — sent to Sentry (capture=caught).`
          : `WASM worker: ${err.message} — no DSN in build.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showFeedback(`WASM worker failed: ${message}`);
    } finally {
      button.disabled = false;
    }
  });
}
