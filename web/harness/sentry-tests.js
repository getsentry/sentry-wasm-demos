import { captureHarnessException } from './sentry-context.js';
import { trimRustPanicMessage } from './rust-panic.js';
import { sentryDsnSet } from '../sentry-init.js';

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

export function wireSentryTestButtons(getModule) {
  document.getElementById('report-js-error')?.addEventListener('click', () => {
    const feedback = document.getElementById('sentry-feedback');
    const err = new Error('js test');
    captureHarnessException(err, 'js_test');
    const message = sentryDsnSet
      ? 'Sent JS test error to Sentry — check Issues.'
      : 'captureException called — no DSN in build.';
    if (feedback) {
      feedback.textContent = message;
    }
    console.log('[sentry test]', message);
  });

  document.getElementById('trigger-wasm-divzero')?.addEventListener('click', () => {
    callWasmCrash(getModule(), 'trigger_crash_divzero', 'WASM divzero', 'divzero');
  });

  document.getElementById('trigger-wasm-deep')?.addEventListener('click', () => {
    callWasmCrash(getModule(), 'trigger_crash_deep', 'WASM deep stack', 'deep_stack');
  });
}

export function setBackendBadge(text) {
  const el = document.getElementById('backend-badge');
  if (el) {
    el.textContent = text;
  }
}
