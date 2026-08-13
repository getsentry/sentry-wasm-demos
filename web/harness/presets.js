/**
 * Highlight the harness preset link that matches the current URL.
 */
export function wireHarnessPresets() {
  const current = new URLSearchParams(window.location.search);

  for (const link of document.querySelectorAll('[data-harness-preset]')) {
    const preset = link.getAttribute('data-harness-preset') ?? '';
    const presetParams = new URLSearchParams(preset);
    const active =
      presetParams.toString() === current.toString() ||
      (preset === '' && current.toString() === '');

    link.classList.toggle('is-active', active);
  }
}
