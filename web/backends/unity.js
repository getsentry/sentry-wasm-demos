import { loadGlueScript } from '../harness/loaders.js';
import { wireUnitySentryButtons } from '../harness/sentry-tests.js';

/** @type {{ SendMessage: (objectName: string, methodName: string, value?: string) => void } | null} */
let unityInstance = null;

function hideMazeUi() {
  const hud = document.getElementById('hud');
  const screen = document.getElementById('screen');
  const winOverlay = document.getElementById('win-overlay');
  const regenerate = document.getElementById('regenerate');
  const h1 = document.querySelector('h1');

  if (hud) {
    hud.hidden = true;
  }
  if (screen) {
    screen.hidden = true;
  }
  if (winOverlay) {
    winOverlay.hidden = true;
    winOverlay.classList.add('hidden');
  }
  if (regenerate) {
    regenerate.hidden = true;
  }
  document.querySelector('.controls')?.classList.add('hidden');
  if (h1) {
    h1.textContent = 'Unity WebGL';
  }
}

/**
 * Unity's framework.js honors Module.instantiateWasm (same hook as Emscripten).
 * `default` leaves Unity's own instantiateStreaming path so we can see if @sentry/wasm's
 * WebAssembly patch (installed in sentry-init via bootstrap.js) sees the IL2CPP module.
 *
 * @param {string} wasmUrl
 * @param {'streaming' | 'non-streaming' | 'default'} load
 * @returns {((imports: WebAssembly.Imports, ready: (instance: WebAssembly.Instance) => void) => object) | undefined}
 */
function instantiateWasmForLoad(wasmUrl, load) {
  if (load === 'default') {
    return undefined;
  }

  if (load === 'non-streaming') {
    return (imports, ready) => {
      fetch(wasmUrl)
        .then(response => response.arrayBuffer())
        .then(bytes => WebAssembly.instantiate(bytes, imports))
        .then(({ instance }) => {
          console.log('[wasm] Unity loaded via non-streaming (arrayBuffer)', { url: wasmUrl });
          ready(instance);
        });
      return {};
    };
  }

  return (imports, ready) => {
    WebAssembly.instantiateStreaming(fetch(wasmUrl), imports).then(({ instance }) => {
      console.log('[wasm] Unity loaded via instantiateStreaming', { url: wasmUrl });
      ready(instance);
    });
    return {};
  };
}

/**
 * Embed Unity's createUnityInstance in the harness canvas slot (not a full-page iframe).
 * @param {import('../harness/config.js').getHarnessConfig extends () => infer R ? R : never} config
 */
export async function start(config) {
  hideMazeUi();

  const wrap = document.querySelector('.canvas-wrap');
  const status = document.getElementById('status');
  const assets = config.unityAssets;

  if (!wrap || !assets) {
    throw new Error('Unity harness shell missing — expected .canvas-wrap and unityAssets');
  }

  wrap.classList.add('canvas-wrap--unity');

  let container = document.getElementById('unity-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'unity-container';
    const canvas = document.createElement('canvas');
    canvas.id = 'unity-canvas';
    canvas.width = 960;
    canvas.height = 600;
    canvas.tabIndex = -1;
    container.appendChild(canvas);
    wrap.insertBefore(container, wrap.firstChild);
  }

  const canvas = document.getElementById('unity-canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('#unity-canvas missing after inject');
  }

  if (status) {
    status.textContent = `Loading Unity WebGL (${config.build}, ${config.load})…`;
  }

  wireUnitySentryButtons(() => unityInstance);

  await loadGlueScript(assets.loaderUrl);
  const createUnityInstance = globalThis.createUnityInstance;
  if (typeof createUnityInstance !== 'function') {
    throw new Error(
      'createUnityInstance missing after Unity loader — run `make unity`, then hard-refresh',
    );
  }

  const instantiateWasm = instantiateWasmForLoad(assets.codeUrl, config.load);
  unityInstance = await createUnityInstance(
    canvas,
    {
      dataUrl: assets.dataUrl,
      frameworkUrl: assets.frameworkUrl,
      codeUrl: assets.codeUrl,
      streamingAssetsUrl: assets.streamingAssetsUrl,
      companyName: 'Sentry',
      productName: 'WasmUnityCoverage',
      productVersion: `wasm-coverage-${config.build}`,
      ...(instantiateWasm ? { instantiateWasm } : {}),
    },
    progress => {
      if (status) {
        status.textContent = `Loading Unity WebGL (${config.build})… ${Math.round(progress * 100)}%`;
      }
    },
  );

  if (status) {
    status.textContent = `Unity WebGL ready · exceptionSupport=${config.build} · load=${config.load}`;
  }
}
