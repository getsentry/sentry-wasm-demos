import { wireHarnessPresets } from './presets.js';

/**
 * Full-page harness error — same shell as the game, maze “dead end” overlay.
 * @param {unknown} err
 */
export function showHarnessError(err) {
  const message = err instanceof Error ? err.message : String(err);
  const main = document.querySelector('main');
  const overlay = document.getElementById('error-overlay');
  const messageEl = document.getElementById('error-message');
  const badge = document.getElementById('backend-badge');
  const hud = document.getElementById('hud');
  const status = document.getElementById('status');

  if (badge) {
    badge.textContent = 'harness · invalid URL';
  }
  if (hud) {
    hud.textContent = 'Harness URL needs a fix — see the panel below';
  }
  if (messageEl) {
    messageEl.textContent = message;
  }
  if (status) {
    status.textContent = '';
    status.classList.remove('status-error');
  }
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }
  if (main) {
    main.classList.add('main--error');
  }

  document.getElementById('win-overlay')?.classList.add('hidden');
  wireHarnessPresets();
}
