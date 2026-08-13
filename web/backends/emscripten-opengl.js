const status = document.getElementById('status');

/**
 * @param {import('../harness/config.js').getHarnessConfig extends () => infer R ? R : never} config
 */
export async function start(_config) {
  status.textContent =
    'Emscripten WebGL backend not implemented yet — add C++ under backends/emscripten-opengl/';
  throw new Error('backend emscripten-opengl is not implemented');
}
