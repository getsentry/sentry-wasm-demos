/** @typedef {'emscripten-raycast' | 'emscripten-opengl' | 'rust' | 'unity'} BackendId */
/** @typedef {'streaming' | 'non-streaming' | 'default'} LoadMode */
/** @typedef {'caught' | 'uncaught'} CrashMode */
/** @typedef {'full' | 'split' | 'sourcemap' | 'dev' | 'release-debug' | 'release-stripped' | 'full-stack' | 'full-no-stack' | 'explicit' | 'none'} BuildVariant */
/** @typedef {'emscripten' | 'wasm-bindgen' | 'unity'} BackendLoader */
/** @typedef {'cpp' | 'rust' | 'csharp'} BackendLanguage */

/**
 * @typedef {object} ResolvedAssets
 * @property {string} glueScript
 * @property {string} wasmRel
 * @property {string | null} debugUploadRel
 * @property {string} [dataRel]
 * @property {string} [frameworkRel]
 * @property {string} [streamingAssetsRel]
 */

/**
 * @typedef {object} BackendConfig
 * @property {BackendId} id
 * @property {string} label
 * @property {BackendLanguage} language
 * @property {string} assetDir
 * @property {string | null} glueGlobal
 * @property {BackendLoader} loader
 * @property {readonly BuildVariant[] | null} buildVariants first entry is the default
 * @property {(symbols: boolean, build: BuildVariant | null) => ResolvedAssets} resolveAssets
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
    buildVariants: ['split', 'full', 'sourcemap'],
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
    buildVariants: null,
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
    buildVariants: ['dev', 'release-debug', 'release-stripped'],
    resolveAssets(_symbols, build) {
      if (build === 'release-stripped') {
        return {
          glueScript: `${this.assetDir}/demo_nosym.js`,
          wasmRel: `${this.assetDir}/demo_nosym_bg.wasm`,
          debugUploadRel: null,
        };
      }

      if (build === 'release-debug') {
        return {
          glueScript: `${this.assetDir}/demo_release.js`,
          wasmRel: `${this.assetDir}/demo_release_bg.wasm`,
          debugUploadRel: `${this.assetDir}/demo_release.debug.wasm`,
        };
      }

      return {
        glueScript: `${this.assetDir}/demo.js`,
        wasmRel: `${this.assetDir}/demo_bg.wasm`,
        debugUploadRel: `${this.assetDir}/demo.debug.wasm`,
      };
    },
    runner: () => import('../backends/rust.js'),
  },
  unity: {
    id: 'unity',
    label: 'Unity · WebGL',
    language: 'csharp',
    assetDir: 'assets/unity',
    glueGlobal: null,
    loader: 'unity',
    buildVariants: ['none', 'full-stack', 'full-no-stack', 'explicit'],
    resolveAssets(_symbols, build) {
      const slug = build || 'none';
      const dir = `${this.assetDir}/${slug}`;
      const base = `${dir}/Build/${slug}`;
      return {
        glueScript: `${base}.loader.js`,
        wasmRel: `${base}.wasm`,
        debugUploadRel: null,
        dataRel: `${base}.data`,
        frameworkRel: `${base}.framework.js`,
        streamingAssetsRel: `${dir}/StreamingAssets`,
      };
    },
    runner: () => import('../backends/unity.js'),
  },
};

const LOAD_MODES = /** @type {const} */ (['streaming', 'non-streaming', 'default']);
const CRASH_MODES = /** @type {const} */ (['caught', 'uncaught']);
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
 * @param {BackendConfig} backend
 * @param {string | null} raw
 * @returns {BuildVariant | null}
 */
function resolveBuildVariant(backend, raw) {
  const variants = backend.buildVariants;

  if (!variants) {
    if (raw !== null) {
      throw new Error(`?build= is not supported by backend ${JSON.stringify(backend.id)}.`);
    }
    return null;
  }

  return (
    parseEnumParam(raw, variants, 'build', value => {
      return `Unknown build variant ${JSON.stringify(value)} for ${backend.id}.\nTry ${variants
        .map(variant => `?build=${variant}`)
        .join(', ')}.`;
    }) || variants[0]
  );
}

/**
 * Harness options from URL query (?backend=&build=&load=&symbols=&capture_mode=).
 */
export function getHarnessConfig() {
  assertQuerySeparators(window.location.search);

  const params = new URLSearchParams(window.location.search);

  const backendRaw = params.get('backend');
  const backendId = backendRaw || 'emscripten-raycast';
  const backend = BACKENDS[backendId];

  if (!backend) {
    throw new Error(
      `Unknown backend ${JSON.stringify(backendId)}.\nTry ?backend=emscripten-raycast (or emscripten-opengl, rust, unity).`,
    );
  }

  const symbolsRaw = parseEnumParam(params.get('symbols'), SYMBOLS_VALUES, 'symbols', value => {
    if (value.includes('|') || value.includes(',')) {
      return `Invalid ?symbols=${JSON.stringify(value)} — use 0 (nosym build) or 1, not a list.`;
    }
    return `Invalid ?symbols=${JSON.stringify(value)} — use 0 or 1, or omit for default (symbols on).`;
  });
  const symbols = symbolsRaw !== '0';

  /** @type {BuildVariant | null} */
  const build = resolveBuildVariant(backend, params.get('build'));

  /** @type {LoadMode} */
  const load =
    parseEnumParam(params.get('load'), LOAD_MODES, 'load', value => {
      if (value.includes('|') || value.includes(',')) {
        return `Invalid ?load=${JSON.stringify(value)} — pick one mode: streaming, non-streaming, or default.`;
      }
      return `Unknown load mode ${JSON.stringify(value)}.\nTry ?load=streaming, ?load=non-streaming, or ?load=default.`;
    }) || 'streaming';

  /** @type {CrashMode} */
  const crashMode =
    parseEnumParam(params.get('capture_mode'), CRASH_MODES, 'capture_mode', value => {
      if (value.includes('|') || value.includes(',')) {
        return `Invalid ?capture_mode=${JSON.stringify(value)} — pick one: caught or uncaught.`;
      }
      return `Unknown capture mode ${JSON.stringify(value)}.\nTry ?capture_mode=caught or ?capture_mode=uncaught.`;
    }) || 'caught';

  const isUnity = backend.id === 'unity';

  const assets = backend.resolveAssets(symbols, build);
  const effectiveSymbols = backend.id === 'rust' ? build !== 'release-stripped' : symbols;

  return {
    backendId: backend.id,
    backendLabel: backend.label,
    language: backend.language,
    loader: backend.loader,
    load,
    crashMode,
    symbols: effectiveSymbols,
    build,
    glueGlobal: backend.glueGlobal,
    glueScript: assets.glueScript,
    wasmUrl: new URL(assets.wasmRel, window.location.href).href,
    debugUploadRel: assets.debugUploadRel,
    unityAssets: isUnity
      ? {
          loaderUrl: new URL(assets.glueScript, window.location.href).href,
          dataUrl: new URL(/** @type {string} */ (assets.dataRel), window.location.href).href,
          frameworkUrl: new URL(/** @type {string} */ (assets.frameworkRel), window.location.href)
            .href,
          codeUrl: new URL(assets.wasmRel, window.location.href).href,
          streamingAssetsUrl: new URL(
            /** @type {string} */ (assets.streamingAssetsRel),
            window.location.href,
          ).href,
        }
      : null,
    startRunner: backend.runner,
  };
}

export function formatHarnessBanner(config) {
  if (config.backendId === 'unity') {
    return `${config.backendLabel} · ${config.language} · load=${config.load} · exceptionSupport=${config.build}`;
  }
  const buildPart = config.build ? ` · build=${config.build}` : '';
  const symbolsPart =
    config.backendId === 'rust' ? '' : ` · symbols=${config.symbols ? 'on' : 'off'}`;
  const capturePart = config.loader === 'emscripten' ? ` · capture_mode=${config.crashMode}` : '';
  return `${config.backendLabel} · ${config.language} · load=${config.load}${symbolsPart}${buildPart}${capturePart}`;
}

