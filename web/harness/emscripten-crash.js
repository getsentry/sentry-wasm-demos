import { captureHarnessException } from './sentry-context.js';
import { sentryDsnSet } from '../sentry-init.js';
import { wireHarnessPresets } from './presets.js';
import { runStepGame } from './step-game.js';

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
 * Game-loop wrapper around {@link runStepGame}. The rAF loop is not stopped after a trap —
 * the C++ pending flag is one-shot and play continues.
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
    runStepGame({
      mod: getMod(),
      dt,
      crashMode,
      onCaught(err) {
        const crashType = takePendingCrashType();
        if (!crashType) {
          return;
        }
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
      },
    });
  }

  return { stepGame };
}
