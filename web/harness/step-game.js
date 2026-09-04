/**
 * Run `_step_game` with the same caught/uncaught rules on the main thread and in the worker.
 *
 * **Caught** — try/catch around the wasm call; `onCaught` runs. The error does not reach
 * `window.onerror` / the worker `error` event, so GlobalHandlers should not double-capture.
 * **Uncaught** — no try/catch; the trap escapes for `@sentry/browser` GlobalHandlers
 * (main) or `webWorkerIntegration` (worker).
 *
 * @param {object} options
 * @param {object} options.mod Emscripten Module
 * @param {number} options.dt
 * @param {'caught' | 'uncaught'} options.crashMode
 * @param {(err: unknown) => void} [options.onCaught]
 */
export function runStepGame({ mod, dt, crashMode, onCaught }) {
  if (crashMode === 'uncaught') {
    mod._step_game(dt);
    return;
  }

  try {
    mod._step_game(dt);
  } catch (err) {
    onCaught?.(err);
  }
}
