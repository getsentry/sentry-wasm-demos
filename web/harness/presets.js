/** Params merged into the current URL when clicking a preset (keeps backend/build). */
const MERGE_PRESET_KEYS = new Set(['load', 'symbols', 'crash']);

/**
 * @param {string} preset
 * @returns {string}
 */
function presetHref(preset) {
  if (preset === '') {
    return './';
  }

  const presetParams = new URLSearchParams(preset);
  const shouldMerge = [...presetParams.keys()].every(key => MERGE_PRESET_KEYS.has(key));
  const hrefParams = shouldMerge
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();

  for (const [key, value] of presetParams) {
    hrefParams.set(key, value);
  }

  const qs = hrefParams.toString();
  return qs ? `?${qs}` : './';
}

/**
 * Highlight the harness preset link that matches the current URL.
 */
export function wireHarnessPresets() {
  const current = new URLSearchParams(window.location.search);

  for (const link of document.querySelectorAll('[data-harness-preset]')) {
    const preset = link.getAttribute('data-harness-preset') ?? '';
    link.setAttribute('href', presetHref(preset));

    const presetParams = new URLSearchParams(preset);
    const active =
      preset === ''
        ? current.toString() === ''
        : [...presetParams.entries()].every(([key, value]) => current.get(key) === value);

    link.classList.toggle('is-active', active);
  }
}
