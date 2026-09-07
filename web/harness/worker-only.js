/**
 * Worker-only harness: wasm loads in the dedicated worker, never on the main page.
 * Use this to test registerWebWorkerWasm without main-thread wasmIntegration masking gaps.
 */

/**
 * Default harness loads wasm on the main thread first — a worker button there only
 * exercised debug images already registered by wasmIntegration, not worker isolation.
 */
export function applyMainThreadHarnessUi() {
  const worker = document.getElementById('trigger-wasm-worker');
  if (worker) {
    worker.hidden = true;
    worker.disabled = true;
    worker.title = 'Use ?worker_only=1 — main-thread wasm already registers debug images';
  }
}

/**
 * @param {import('./config.js').getHarnessConfig extends () => infer R ? R : never} config
 */
export function assertWorkerOnlySupported(config) {
  if (config.loader === 'unity') {
    throw new Error('?worker_only=1 is not supported for Unity — use emscripten-raycast, emscripten-opengl, or rust.');
  }
}

/**
 * @param {import('./config.js').getHarnessConfig extends () => infer R ? R : never} config
 */
export function applyWorkerOnlyUi(config) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent =
      'Worker-only harness — main thread does not load wasm. Click worker to init the isolate and arm a crash.';
  }

  const hud = document.getElementById('hud');
  if (hud) {
    hud.textContent = `Worker-only · ${config.backendLabel} · load=${config.load} · capture=${config.crashMode}`;
  }

  const canvas = document.getElementById('screen');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Worker-only — wasm loads in wasm-worker.js', canvas.width / 2, canvas.height / 2 - 8);
      ctx.fillText('(main thread has no maze module)', canvas.width / 2, canvas.height / 2 + 16);
    }
  }

  const help = document.querySelector('.sentry-help');
  if (help) {
    help.textContent =
      'worker_only: main thread skips wasm. worker arms step_game (Emscripten) or direct trigger (Rust). Toggle registerWebWorkerWasm in workers/wasm-worker.js to compare symbolication.';
  }

  for (const id of ['regenerate', 'trigger-wasm-divzero', 'trigger-wasm-deep']) {
    const el = document.getElementById(id);
    if (el) {
      el.hidden = true;
      el.disabled = true;
      el.title = 'N/A in worker-only mode (no main-thread wasm)';
    }
  }

  const worker = document.getElementById('trigger-wasm-worker');
  if (worker) {
    worker.hidden = false;
    worker.disabled = false;
    worker.title = 'Load wasm in the worker isolate, then arm a crash';
  }
}
