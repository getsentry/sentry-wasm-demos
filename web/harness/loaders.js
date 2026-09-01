/**
 * Load a wasm-bindgen ES module glue file.
 * @param {string} glueScript pathname relative to /web/
 */
export async function importBindgenGlue(glueScript) {
  const url = new URL(glueScript, window.location.href).href;
  return import(/* webpackIgnore: true */ url);
}

/**
 * @param {object} options
 * @param {(module_or_path?: unknown) => Promise<unknown>} options.init wasm-bindgen default export
 * @param {string} options.wasmUrl
 * @param {'streaming' | 'instantiate' | 'default'} options.load
 */
export async function loadWasmBindgenModule({ init, wasmUrl, load }) {
  if (load === 'default') {
    return init(wasmUrl);
  }

  if (load === 'instantiate') {
    const bytes = await fetch(wasmUrl).then(response => response.arrayBuffer());
    return init(bytes);
  }

  return init(fetch(wasmUrl));
}

/**
 * WASM load paths for Emscripten backends.
 * @sentry/wasm hooks *Streaming; other modes are for SDK gap testing.
 */

/**
 * @param {object} options
 * @param {(...args: unknown[]) => Promise<unknown>} options.createModule
 * @param {string} options.wasmUrl
 * @param {'streaming' | 'instantiate' | 'default'} options.load
 * @param {Record<string, unknown>} [options.moduleConfig]
 */
export async function loadEmscriptenModule({ createModule, wasmUrl, load, moduleConfig = {} }) {
  if (load !== 'default' && load !== 'instantiate' && load !== 'streaming') {
    throw new Error(`Invalid load mode ${JSON.stringify(load)}`);
  }

  if (load === 'default') {
    return createModule(moduleConfig);
  }

  if (load === 'instantiate') {
    return new Promise((resolve, reject) => {
      createModule({
        ...moduleConfig,
        instantiateWasm(imports, emscriptenReady) {
          fetch(wasmUrl)
            .then(response => response.arrayBuffer())
            .then(bytes => WebAssembly.instantiate(bytes, imports))
            .then(({ instance }) => {
              console.log('[wasm] loaded via instantiate(bytes)', { url: wasmUrl, instance });
              emscriptenReady(instance);
            })
            .catch(reject);
        },
      })
        .then(resolve)
        .catch(reject);
    });
  }

  return new Promise((resolve, reject) => {
    createModule({
      ...moduleConfig,
      instantiateWasm(imports, emscriptenReady) {
        WebAssembly.instantiateStreaming(fetch(wasmUrl), imports)
          .then(({ instance }) => {
            console.log('[wasm] loaded via instantiateStreaming', { url: wasmUrl, instance });
            emscriptenReady(instance);
          })
          .catch(reject);
      },
    })
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Load Emscripten glue (non-module script) before the app starts.
 * @param {string} src pathname relative to /web/ (e.g. assets/emscripten-raycast/maze.js)
 */
export function loadGlueScript(src) {
  const url = new URL(src, window.location.href).href;
  const existing = document.querySelector(`script[data-wasm-glue="${url}"]`);
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.dataset.wasmGlue = url;
    script.onload = () => resolve(undefined);
    script.onerror = () => {
      const nosymHint = src.includes('_nosym') || src.includes('.nosym.')
        ? ' Run `make no-symbols` (Emscripten) or `make rust-no-symbols` (Rust), or use ?build=dev.'
        : '';
      reject(new Error(`Failed to load WASM glue: ${url}.${nosymHint}`));
    };
    document.head.appendChild(script);
  });
}

/**
 * @param {string | null} globalName
 */
export function getCreateModule(globalName) {
  if (!globalName) {
    return null;
  }
  const factory = globalThis[globalName];
  return typeof factory === 'function' ? factory : null;
}
