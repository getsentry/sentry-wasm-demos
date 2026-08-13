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

const LOAD_MODES = /** @type {const} */ (['streaming', 'instantiate', 'default']);
const SYMBOLS_VALUES = /** @type {const} */ (['0', '1']);

function assertQuerySeparators(search) {
  const qCount = (search.match(/\?/g) || []).length;
  if (qCount > 1) {
    throw new Error(
      'Multiple ? in the query string — use & between params.\nExample: /web/?load=streaming&symbols=0',
    );
  }
}

/**
 * @param {string | null} raw
 * @param {readonly string[]} allowed
 * @param {string} param
 * @param {(value: string) => string} formatInvalid
 */
function parseEnumParam(raw, allowed, param, formatInvalid) {
  if (raw === null) {
    return null;
  }

  if (raw.includes('?')) {
    throw new Error(
      `?${param} looks like it swallowed the next param — use & between flags.\nExample: /web/?load=streaming&symbols=0`,
    );
  }

  if (!allowed.includes(raw)) {
    throw new Error(formatInvalid(raw));
  }
  return raw;
}

/**
 * Harness options from URL query (?backend=&load=&symbols=).
 * Same page shell for every WASM backend.
 */
export function getHarnessConfig() {
  assertQuerySeparators(window.location.search);

  const params = new URLSearchParams(window.location.search);

  const backendRaw = params.get('backend');
  const backendId = backendRaw || 'emscripten-raycast';
  const backend = BACKENDS[backendId];

  if (!backend) {
    throw new Error(
      `Unknown backend ${JSON.stringify(backendId)}.\nTry ?backend=emscripten-raycast (or emscripten-opengl, rust).`,
    );
  }

  const symbolsRaw = parseEnumParam(params.get('symbols'), SYMBOLS_VALUES, 'symbols', value => {
    if (value.includes('|') || value.includes(',')) {
      return `Invalid ?symbols=${JSON.stringify(value)} — use 0 (nosym build) or 1, not a list.`;
    }
    return `Invalid ?symbols=${JSON.stringify(value)} — use 0 or 1, or omit for default (symbols on).`;
  });
  const symbols = symbolsRaw !== '0';

  /** @type {LoadMode} */
  const load =
    parseEnumParam(params.get('load'), LOAD_MODES, 'load', value => {
      if (value.includes('|') || value.includes(',')) {
        return `Invalid ?load=${JSON.stringify(value)} — pick one mode: streaming, instantiate, or default.`;
      }
      return `Unknown load mode ${JSON.stringify(value)}.\nTry ?load=streaming, ?load=instantiate, or ?load=default.`;
    }) || 'streaming';

  const baseName = symbols ? 'maze' : 'maze.nosym';
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
