import { importBindgenGlue, loadWasmBindgenModule } from '../harness/loaders.js';
import { wireSentryTestButtons } from '../harness/sentry-tests.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const hud = document.getElementById('hud');

/** @type {Record<string, () => void> | null} */
let exports = null;

function drawPlaceholder() {
  if (!canvas || !ctx) {
    return;
  }
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3edcff';
  ctx.font = '16px ui-monospace, monospace';
  ctx.fillText('Rust · wasm-bindgen', 24, 40);
  ctx.fillStyle = '#888';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('No maze here — use Sentry test buttons below.', 24, 68);
}

/**
 * @param {import('../harness/config.js').getHarnessConfig extends () => infer R ? R : never} config
 */
export async function start(config) {
  const glue = await importBindgenGlue(config.glueScript);
  if (typeof glue.default !== 'function') {
    const buildHint =
      config.build === 'release-stripped'
        ? 'make rust-no-symbols'
        : config.build === 'release-debug'
          ? 'make rust-release-debug && make rust-release-debug-symbols'
          : 'make rust && make rust-symbols';
    throw new Error(`Rust glue missing default init — run \`${buildHint}\`, then hard-refresh`);
  }

  await loadWasmBindgenModule({
    init: glue.default,
    wasmUrl: config.wasmUrl,
    load: config.load,
  });

  if (typeof glue.ping !== 'function') {
    throw new Error('Rust wasm missing ping export');
  }
  if (glue.ping() !== 1) {
    throw new Error('Rust wasm ping failed');
  }

  exports = {
    _trigger_crash_divzero: glue.trigger_crash_divzero,
    _trigger_crash_deep: glue.trigger_crash_deep,
  };

  document.querySelector('.controls')?.classList.add('hidden');
  if (hud) {
    hud.textContent = 'Rust wasm loaded — divzero / deep stack via Sentry panel';
  }
  if (status) {
    status.textContent = `Loaded ${config.wasmUrl.split('/').pop()} · ${config.load} · ${config.build ?? 'default'}`;
  }

  drawPlaceholder();
  wireSentryTestButtons(() => exports);
}
