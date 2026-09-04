import { captureHarnessException } from './sentry-context.js';
import { trimRustPanicMessage } from './rust-panic.js';
import { sentryDsnSet } from '../sentry-init.js';
import { armPendingCrashType, syncCrashQueryInUrl } from './emscripten-crash.js';

/**
 * @param {() => void} fn
 * @returns {{ panicLine: string | null, err: unknown | null }}
 */
function withRustPanicCapture(fn) {
  let panicLine = null;
  const original = console.error;

  console.error = (...args) => {
    for (const arg of args) {
      if (typeof arg === 'string' && arg.includes('panicked at')) {
        if (panicLine === null) {
          panicLine = arg;
        }
        const short = trimRustPanicMessage(arg);
        if (short) {
          original.apply(console, [short]);
        }
        return;
      }
    }
    original.apply(console, args);
  };

  try {
    fn();
    return { panicLine, err: null };
  } catch (err) {
    return { panicLine, err };
  } finally {
    console.error = original;
  }
}

/**
 * @param {object} mod wasm module instance (Emscripten Module object)
 * @param {string} exportName C export without leading underscore
 * @param {string} label UI label
 * @param {import('./sentry-context.js').HarnessCrashType} crashType
 */
export function callWasmCrash(mod, exportName, label, crashType) {
  const feedback = document.getElementById('sentry-feedback');

  function showFeedback(message) {
    if (feedback) {
      feedback.textContent = message;
    }
    console.log('[sentry test]', message);
  }

  const fn = mod[`_${exportName}`];
  if (typeof fn !== 'function') {
    showFeedback(`${exportName} missing — run make and hard-refresh`);
    return;
  }

  showFeedback(`Calling ${label}…`);
  const { panicLine, err } = withRustPanicCapture(() => {
    fn();
  });

  if (err === null) {
    showFeedback(`${label} returned (unexpected)`);
    return;
  }

  console.error('[wasm crash]', err instanceof Error ? err.message : String(err));
  captureHarnessException(err, crashType, { panicMessage: trimRustPanicMessage(panicLine) });
  showFeedback(
    sentryDsnSet
      ? `${label}: ${err instanceof Error ? err.message : String(err)} — sent to Sentry.`
      : `${label}: ${err instanceof Error ? err.message : String(err)} — no DSN in build.`,
  );
}

function showSentryFeedback(message) {
  const feedback = document.getElementById('sentry-feedback');
  if (feedback) {
    feedback.textContent = message;
  }
  console.log('[sentry test]', message);
}

function wireJsTestErrorButton() {
  document.getElementById('report-js-error')?.addEventListener('click', () => {
    const err = new Error('js test');
    captureHarnessException(err, 'js_test');
    const message = sentryDsnSet
      ? 'Sent JS test error to Sentry — check Issues.'
      : 'captureException called — no DSN in build.';
    showSentryFeedback(message);
  });
}

/**
 * @param {() => object} getModule
 * @param {{ crashMode?: 'caught' | 'uncaught' }} [options] `crashMode` arms C++ pending crash (Emscripten). Omit for Rust (direct `trigger_crash_*`).
 */
export function wireSentryTestButtons(getModule, options = {}) {
  wireJsTestErrorButton();

  const crashMode = options.crashMode;
  const help = document.querySelector('.sentry-help');

  if (crashMode === 'caught' || crashMode === 'uncaught') {
    if (help) {
      help.textContent = `WASM divzero/deep/worker arm a flag; trap runs in step_game (capture=${crashMode}).`;
    }

    document.getElementById('trigger-wasm-divzero')?.addEventListener('click', () => {
      armLoopCrash(getModule(), 'arm_crash_divzero', 'divzero', 'divzero', crashMode);
    });
    document.getElementById('trigger-wasm-deep')?.addEventListener('click', () => {
      armLoopCrash(getModule(), 'arm_crash_deep', 'deep stack', 'deep_stack', crashMode);
    });
    return;
  }

  if (help) {
    help.textContent =
      'WASM divzero/deep call trigger_crash_* immediately. Worker is also direct-trigger (Rust has no game loop).';
  }

  document.getElementById('trigger-wasm-divzero')?.addEventListener('click', () => {
    callWasmCrash(getModule(), 'trigger_crash_divzero', 'WASM divzero', 'divzero');
  });
  document.getElementById('trigger-wasm-deep')?.addEventListener('click', () => {
    callWasmCrash(getModule(), 'trigger_crash_deep', 'WASM deep stack', 'deep_stack');
  });
}

/**
 * @param {object} mod
 * @param {string} exportName
 * @param {string} label
 * @param {import('./sentry-context.js').HarnessCrashType} crashType
 * @param {'caught' | 'uncaught'} crashMode
 */
function armLoopCrash(mod, exportName, label, crashType, crashMode) {
  const fn = mod[`_${exportName}`];
  if (typeof fn !== 'function') {
    showSentryFeedback(`${exportName} missing — run make and hard-refresh`);
    return;
  }

  syncCrashQueryInUrl(crashMode);
  armPendingCrashType(crashType);
  fn();
  showSentryFeedback(`Armed ${label} — fires next step_game (capture=${crashMode})`);
}

/**
 * Unity has no C wasm exports. JS test + C# throw (IL2CPP abort) go through @sentry/wasm.
 * @param {() => { SendMessage: (objectName: string, methodName: string, value?: string) => void } | null} getUnityInstance
 */
export function wireUnitySentryButtons(getUnityInstance) {
  const help = document.querySelector('.sentry-help');
  if (help) {
    help.textContent =
      'C# deep crash is an IL2CPP abort — captured by @sentry/browser + @sentry/wasm (no Sentry Unity SDK).';
  }

  wireJsTestErrorButton();

  const divzero = document.getElementById('trigger-wasm-divzero');
  if (divzero) {
    divzero.hidden = true;
    divzero.disabled = true;
    divzero.title = 'N/A (Unity — no C export)';
  }

  const worker = document.getElementById('trigger-wasm-worker');
  if (worker) {
    worker.hidden = true;
    worker.disabled = true;
    worker.title = 'N/A (Unity)';
  }

  const deep = document.getElementById('trigger-wasm-deep');
  if (!deep) {
    return;
  }

  deep.textContent = 'C# deep crash';
  deep.addEventListener('click', () => {
    const instance = getUnityInstance();
    if (!instance || typeof instance.SendMessage !== 'function') {
      showSentryFeedback('Unity player not ready — wait for load');
      return;
    }

    showSentryFeedback('Calling C# deep crash…');
    try {
      instance.SendMessage('WasmCrashHarness', 'TriggerDeepCrash');
      showSentryFeedback(
        sentryDsnSet
          ? 'C# throw returned (check Sentry if GlobalHandlers caught an abort).'
          : 'C# throw returned — no DSN in build.',
      );
    } catch (err) {
      console.error('[wasm crash]', err instanceof Error ? err.message : String(err));
      captureHarnessException(err, 'deep_stack');
      showSentryFeedback(
        sentryDsnSet
          ? `${err instanceof Error ? err.message : String(err)} — sent to Sentry (wasm.backend:unity).`
          : `${err instanceof Error ? err.message : String(err)} — no DSN in build.`,
      );
    }
  });
}

export function setBackendBadge(text) {
  const el = document.getElementById('backend-badge');
  if (el) {
    el.textContent = text;
  }
}
