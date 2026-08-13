/** @typedef {'emscripten-raycast' | 'emscripten-opengl' | 'rust'} BackendId */
/** @typedef {'streaming' | 'instantiate' | 'default'} LoadMode */

const BACKENDS = {
  'emscripten-raycast': {
    id: 'emscripten-raycast',
    label: 'Emscripten · CPU raycast',
    assetDir: 'assets/emscripten-raycast',
    glueGlobal: 'createMazeModule',
    runner: () => import('../backends/emscripten-raycast.js'),
  },
  'emscripten-opengl': {
    id: 'emscripten-opengl',
    label: 'Emscripten · WebGL (planned)',
    assetDir: 'assets/emscripten-opengl',
    glueGlobal: 'createMazeModule',
    runner: () => import('../backends/emscripten-opengl.js'),
  },
  rust: {
    id: 'rust',
    label: 'Rust · wasm-bindgen (planned)',
    assetDir: 'assets/rust',
    glueGlobal: null,
    runner: () => import('../backends/rust.js'),
  },
};

/**
 * Harness options from URL query (?backend=&load=&symbols=).
 * Same page shell for every WASM backend.
 */
export function getHarnessConfig() {
  const params = new URLSearchParams(window.location.search);
  const backendId = params.get('backend') || 'emscripten-raycast';
  const backend = BACKENDS[backendId];

  if (!backend) {
    throw new Error(`Unknown backend "${backendId}". Try ?backend=emscripten-raycast`);
  }

  const symbols = params.get('symbols') !== '0';
  const baseName = symbols ? 'maze' : 'maze.nosym';

  /** @type {LoadMode} */
  const load = params.get('load') || 'streaming';

  const wasmRel = `${backend.assetDir}/${baseName}.wasm`;

  return {
    backendId: backend.id,
    backendLabel: backend.label,
    load,
    symbols,
    glueGlobal: backend.glueGlobal,
    glueScript: `${backend.assetDir}/${baseName}.js`,
    wasmUrl: new URL(wasmRel, window.location.href).href,
    startRunner: backend.runner,
  };
}

export function formatHarnessBanner(config) {
  return `${config.backendLabel} · load=${config.load} · symbols=${config.symbols ? 'on' : 'off'}`;
}
