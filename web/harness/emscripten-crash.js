import { captureHarnessException } from './sentry-context.js';
import { sentryDsnSet } from '../sentry-init.js';
import { wireHarnessPresets } from './presets.js';

/** @type {import('./sentry-context.js').HarnessCrashType | null} */
let pendingCrashType = null;

/**
 * @param {import('./sentry-context.js').HarnessCrashType} crashType
 */
export function armPendingCrashType(crashType) {
  pendingCrashType = crashType;
}

export function takePendingCrashType() {
  const value = pendingCrashType;
  pendingCrashType = null;
  return value;
}

export function peekPendingCrashType() {
  return pendingCrashType;
}

/**
 * Put crash= in the URL without reloading so the mode is shareable.
 * @param {'caught' | 'uncaught'} crashMode
 */
export function syncCrashQueryInUrl(crashMode) {
  const url = new URL(window.location.href);
  url.searchParams.set('crash', crashMode);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    history.replaceState(null, '', next);
  }
  wireHarnessPresets();
}

/**
 * Run `_step_game` either inside try/catch (caught) or let the trap escape (uncaught).
 * Caught errors do not reach window.onerror, so GlobalHandlers should not double-capture.
 * The game loop is not stopped after a trap — one-shot pending flags clear in C++ and play continues.
 *
 * @param {object} options
 * @param {() => object} options.getMod
 * @param {'caught' | 'uncaught'} options.crashMode
 */
export function createStepGameController({ getMod, crashMode }) {
  /**
   * @param {number} dt
   */
  function stepGame(dt) {
    const mod = getMod();
    if (crashMode === 'uncaught') {
      mod._step_game(dt);
      return;
    }

    try {
      mod._step_game(dt);
    } catch (err) {
      const crashType = takePendingCrashType() ?? 'divzero';
      console.error('[wasm crash]', err instanceof Error ? err.message : String(err));
      captureHarnessException(err, crashType);
      const feedback = document.getElementById('sentry-feedback');
      const message = sentryDsnSet
        ? `${crashType} in step_game — sent to Sentry (capture=caught). Game loop continues.`
        : `${crashType} in step_game — no DSN in build. Game loop continues.`;
      if (feedback) {
        feedback.textContent = message;
      }
      console.log('[sentry test]', message);
    }
  }

  return { stepGame };
}
