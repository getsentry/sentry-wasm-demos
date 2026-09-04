import { loadEmscriptenModule } from '../harness/loaders.js';
import { wireSentryTestButtons } from '../harness/sentry-tests.js';
import { createStepGameController, peekPendingCrashType } from '../harness/emscripten-crash.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const hud = document.getElementById('hud');
const winOverlay = document.getElementById('win-overlay');

const KEYS = new Set([87, 65, 83, 68, 37, 38, 39, 40]);

let mod = null;
let imageData = null;
let lastTime = 0;
let level = 1;
/** @type {ReturnType<typeof createStepGameController> | null} */
let stepCtrl = null;

function initGame(seed, nextLevel = level) {
  for (const code of KEYS) {
    mod._handle_key(code, 0);
  }
  level = nextLevel;
  mod._init_game(seed, level);
  winOverlay.classList.add('hidden');
  lastTime = 0;
  updateHud();
}

function updateHud() {
  if (mod._game_won()) {
    winOverlay.classList.remove('hidden');
    hud.textContent = `Level ${mod._get_level()} cleared`;
    status.textContent = 'Next level or regenerate';
    return;
  }
  hud.textContent =
    `Level ${mod._get_level()} · WASD / arrows · Keys ${mod._player_key_count()}/${mod._keys_required()} · exit bottom-right`;
}

function drawFrame() {
  mod._render_frame();
  const w = mod._get_width();
  const h = mod._get_height();
  const ptr = mod._get_pixel_buffer_ptr();
  const bytes = w * h * 4;
  const pixels = mod.HEAPU8.subarray(ptr, ptr + bytes);

  if (!imageData || imageData.width !== w) {
    imageData = ctx.createImageData(w, h);
  }
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  updateHud();
}

function loop(now) {
  const dt = lastTime ? now - lastTime : 0;
  lastTime = now;
  if (!mod._game_won() || peekPendingCrashType()) {
    stepCtrl?.stepGame(dt);
  }
  drawFrame();
  requestAnimationFrame(loop);
}

function onKey(event, down) {
  if (!KEYS.has(event.keyCode)) {
    return;
  }
  event.preventDefault();
  mod._handle_key(event.keyCode, down ? 1 : 0);
}

/**
 * @param {import('../harness/config.js').getHarnessConfig extends () => infer R ? R : never} config
 */
export async function start(config) {
  const createModule = globalThis[config.glueGlobal];
  if (typeof createModule !== 'function') {
    throw new Error(`${config.glueGlobal} missing — run \`make\`, then hard-refresh`);
  }

  mod = await loadEmscriptenModule({
    createModule,
    wasmUrl: config.wasmUrl,
    load: config.load,
  });

  initGame((Math.random() * 0x7fffffff) | 0, 1);
  canvas.width = mod._get_width();
  canvas.height = mod._get_height();
  status.textContent = `Running ${canvas.width}×${canvas.height}`;

  window.addEventListener('keydown', e => onKey(e, true));
  window.addEventListener('keyup', e => onKey(e, false));
  document.getElementById('regenerate')?.addEventListener('click', () =>
    initGame((Math.random() * 0x7fffffff) | 0, level),
  );
  document.getElementById('next-level')?.addEventListener('click', () =>
    initGame((Math.random() * 0x7fffffff) | 0, level + 1),
  );

  wireSentryTestButtons(() => mod, { crashMode: config.crashMode });
  stepCtrl = createStepGameController({ getMod: () => mod, crashMode: config.crashMode });
  requestAnimationFrame(loop);
}
