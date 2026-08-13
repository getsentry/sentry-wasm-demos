const status = document.getElementById('status');

/**
 * @param {import('../harness/config.js').getHarnessConfig extends () => infer R ? R : never} config
 */
export async function start(_config) {
  status.textContent = 'Rust backend not implemented yet — add crate under backends/rust/';
  throw new Error('backend rust is not implemented');
}
