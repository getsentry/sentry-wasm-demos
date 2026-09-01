/** @typedef {'emscripten-raycast' | 'emscripten-opengl' | 'rust'} BackendId */
/** @typedef {'streaming' | 'instantiate' | 'default'} LoadMode */
/** @typedef {'full' | 'split' | 'sourcemap'} BuildVariant */
/** @typedef {'emscripten' | 'wasm-bindgen'} BackendLoader */
/** @typedef {'cpp' | 'rust'} BackendLanguage */

/**
 * @typedef {object} BackendConfig
 * @property {BackendId} id
 * @property {string} label
 * @property {BackendLanguage} language
 * @property {string} assetDir
 * @property {string | null} glueGlobal
 * @property {BackendLoader} loader
 * @property {(symbols: boolean, build: BuildVariant) => { glueScript: string, wasmRel: string, debugUploadRel: string | null }} resolveAssets
 * @property {() => Promise<{ start: Function }>} runner
 */

/** @type {Record<BackendId, BackendConfig>} */
const BACKENDS = {
  'emscripten-raycast': {
    id: 'emscripten-raycast',
    label: 'Emscripten · CPU raycast',
    language: 'cpp',
    assetDir: 'assets/emscripten-raycast',
    glueGlobal: 'createMazeModule',
    loader: 'emscripten',
    resolveAssets(symbols, build) {
      if (!symbols) {
        return {
          glueScript: `${this.assetDir}/maze.nosym.js`,
          wasmRel: `${this.assetDir}/maze.nosym.wasm`,
          debugUploadRel: null,
        };
      }

      const variant =
        build === 'full' ? 'maze.full' : build === 'sourcemap' ? 'maze.sourcemap' : 'maze.split';
      const debugUploadRel =
        build === 'full'
          ? `${this.assetDir}/maze.full.wasm`
          : build === 'sourcemap'
            ? `${this.assetDir}/maze.sourcemap.wasm`
            : `${this.assetDir}/maze.split.debug.wasm`;

      return {
        glueScript: `${this.assetDir}/${variant}.js`,
        wasmRel: `${this.assetDir}/${variant}.wasm`,
        debugUploadRel,
      };
    },
    runner: () => import('../backends/emscripten-raycast.js'),
  },
  'emscripten-opengl': {
    id: 'emscripten-opengl',
    label: 'Emscripten · WebGL',
    language: 'cpp',
    assetDir: 'assets/emscripten-opengl',
    glueGlobal: 'createMazeModule',
    loader: 'emscripten',
    resolveAssets(symbols) {
      const base = symbols ? 'maze' : 'maze.nosym';
      return {
        glueScript: `${this.assetDir}/${base}.js`,
        wasmRel: `${this.assetDir}/${base}.wasm`,
        debugUploadRel: symbols ? `${this.assetDir}/maze.debug.wasm` : null,
      };
    },
    runner: () => import('../backends/emscripten-opengl.js'),
  },
  rust: {
    id: 'rust',
    label: 'Rust · wasm-bindgen',
    language: 'rust',
    assetDir: 'assets/rust',
    glueGlobal: null,
    loader: 'wasm-bindgen',
    resolveAssets(symbols) {
      const base = symbols ? 'demo' : 'demo_nosym';
      return {
        glueScript: `${this.assetDir}/${base}.js`,
        wasmRel: `${this.assetDir}/${base}_bg.wasm`,
        debugUploadRel: symbols ? `${this.assetDir}/demo.debug.wasm` : null,
      };
    },
    runner: () => import('../backends/rust.js'),
  },
};

const LOAD_MODES = /** @type {const} */ (['streaming', 'instantiate', 'default']);
const BUILD_VARIANTS = /** @type {const} */ (['full', 'split', 'sourcemap']);
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

  /** @type {BuildVariant} */
  const build =
    backendId === 'emscripten-raycast'
      ? parseEnumParam(params.get('build'), BUILD_VARIANTS, 'build', value => {
          if (value.includes('|') || value.includes(',')) {
            return `Invalid ?build=${JSON.stringify(value)} — pick one: full, split, or sourcemap.`;
          }
          return `Unknown build variant ${JSON.stringify(value)}.\nTry ?build=full, ?build=split, or ?build=sourcemap.`;
        }) || 'split'
      : 'split';

  /** @type {LoadMode} */
  const load =
    parseEnumParam(params.get('load'), LOAD_MODES, 'load', value => {
      if (value.includes('|') || value.includes(',')) {
        return `Invalid ?load=${JSON.stringify(value)} — pick one mode: streaming, instantiate, or default.`;
      }
      return `Unknown load mode ${JSON.stringify(value)}.\nTry ?load=streaming, ?load=instantiate, or ?load=default.`;
    }) || 'streaming';

  const assets = backend.resolveAssets(symbols, build);

  return {
    backendId: backend.id,
    backendLabel: backend.label,
    language: backend.language,
    loader: backend.loader,
    load,
    symbols,
    build,
    glueGlobal: backend.glueGlobal,
    glueScript: assets.glueScript,
    wasmUrl: new URL(assets.wasmRel, window.location.href).href,
    debugUploadRel: assets.debugUploadRel,
    startRunner: backend.runner,
  };
}

export function formatHarnessBanner(config) {
  const buildPart =
    config.backendId === 'emscripten-raycast' && config.symbols ? ` · build=${config.build}` : '';
  return `${config.backendLabel} · ${config.language} · load=${config.load} · symbols=${config.symbols ? 'on' : 'off'}${buildPart}`;
}
