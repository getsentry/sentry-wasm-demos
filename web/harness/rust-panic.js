/**
 * console_error_panic_hook logs "panicked at …" then "\n\nStack:" + a JS stack trace.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function trimRustPanicMessage(raw) {
  if (!raw) {
    return null;
  }
  return raw.split(/\n\nStack:/)[0]?.trim() || null;
}
