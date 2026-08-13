import { Sentry, sentryDsnSet } from '../sentry-init.js';

/**
 * @param {object} mod wasm module instance (Emscripten Module object)
 * @param {string} exportName C export without leading underscore
 * @param {string} label UI label
 */
export function callWasmCrash(mod, exportName, label) {
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
  try {
    fn();
    showFeedback(`${label} returned (unexpected)`);
  } catch (err) {
    console.error('[wasm crash]', err);
    console.error('[wasm crash stack]\n', err.stack);
    Sentry.captureException(err);
    showFeedback(
      sentryDsnSet
        ? `${label}: ${err.message} — sent to Sentry.`
        : `${label}: ${err.message} — no DSN in build.`,
    );
  }
}

export function wireSentryTestButtons(getModule) {
  document.getElementById('report-js-error')?.addEventListener('click', () => {
    const feedback = document.getElementById('sentry-feedback');
    const err = new Error('js test');
    Sentry.captureException(err);
    const message = sentryDsnSet
      ? 'Sent JS test error to Sentry — check Issues.'
      : 'captureException called — no DSN in build.';
    if (feedback) {
      feedback.textContent = message;
    }
    console.log('[sentry test]', message);
  });

  document.getElementById('trigger-wasm-divzero')?.addEventListener('click', () => {
    callWasmCrash(getModule(), 'trigger_crash_divzero', 'WASM divzero');
  });

  document.getElementById('trigger-wasm-deep')?.addEventListener('click', () => {
    callWasmCrash(getModule(), 'trigger_crash_deep', 'WASM deep stack');
  });
}

export function setBackendBadge(text) {
  const el = document.getElementById('backend-badge');
  if (el) {
    el.textContent = text;
  }
}
