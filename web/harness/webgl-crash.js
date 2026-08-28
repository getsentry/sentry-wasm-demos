/**
 * Resolve the WebGL context Emscripten actually draws with.
 * canvas.getContext('webgl2') alone often is not the same handle.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object | null | undefined} mod Emscripten Module instance
 * @returns {WebGL2RenderingContext | WebGLRenderingContext | null}
 */
function resolveEmscriptenGlContext(canvas, mod) {
  const fromCanvasObject = canvas.GLctxObject?.GLctx;
  if (fromCanvasObject) {
    return fromCanvasObject;
  }

  if (mod?.ctx) {
    return mod.ctx;
  }

  // Older / alternate Emscripten builds
  if (mod?.GLctx) {
    return mod.GLctx;
  }

  return canvas.getContext('webgl2') || canvas.getContext('webgl');
}

/**
 * Simulate GPU/WebGL failure via WEBGL_lose_context.
 * No Sentry.captureException — observe default SDK / browser behavior only.
 *
 * @param {HTMLCanvasElement} canvas Emscripten WebGL canvas
 * @param {() => object | null} getModule
 */
export function wireWebGlContextLossTest(canvas, getModule) {
  const button = document.getElementById('trigger-webgl-context-lost');
  const feedback = document.getElementById('sentry-feedback');

  if (!button || !canvas) {
    return;
  }

  button.hidden = false;

  canvas.addEventListener(
    'webglcontextlost',
    event => {
      console.warn('[webgl] webglcontextlost (no manual Sentry capture)', event);
      if (feedback) {
        feedback.textContent =
          'WebGL context lost — watch console and Sentry Issues for automatic events only.';
      }
    },
    false,
  );

  canvas.addEventListener('webglcontextrestored', () => {
    console.log('[webgl] webglcontextrestored');
  });

  button.addEventListener('click', () => {
    const mod = getModule();
    const gl = resolveEmscriptenGlContext(canvas, mod);
    if (!gl) {
      const message = 'No WebGL context — open ?backend=emscripten-opengl and wait for the maze';
      console.error('[webgl]', message);
      if (feedback) {
        feedback.textContent = message;
      }
      return;
    }

    const ext = gl.getExtension('WEBGL_lose_context');
    if (!ext) {
      const supported = gl.getSupportedExtensions()?.join(', ') ?? '(none)';
      const message =
        'WEBGL_lose_context unavailable on Emscripten GL context — see console for supported extensions';
      console.error('[webgl]', message, { supported, gl });
      if (feedback) {
        feedback.textContent = message;
      }
      return;
    }

    console.log('[webgl] loseContext() on Emscripten ctx — no captureException; rAF keeps calling _render_frame');
    if (feedback) {
      feedback.textContent = 'Calling WEBGL_lose_context…';
    }
    ext.loseContext();
  });
}
