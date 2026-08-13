/**
 * WASM load paths for Emscripten backends.
 * @sentry/wasm hooks *Streaming; other modes are for SDK gap testing.
 */

/**
 * @param {object} options
 * @param {(...args: unknown[]) => Promise<unknown>} options.createModule
 * @param {string} options.wasmUrl
 * @param {'streaming' | 'instantiate' | 'default'} options.load
 */
export async function loadEmscriptenModule({ createModule, wasmUrl, load }) {
  if (load === 'default') {
    return createModule();
  }

  if (load === 'instantiate') {
    return new Promise((resolve, reject) => {
      createModule({
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
      const nosymHint = src.includes('.nosym.')
        ? ' Build with `make no-symbols`, or open /web/ without ?symbols=0.'
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
