import { Sentry, sentryDsnSet } from './sentry-init.js';

// =============================================================================
// PART A — LOAD WASM  (@sentry/wasm hooks instantiateStreaming in sentry-init.js)
// =============================================================================

const createMazeModule = globalThis.createMazeModule;
const WASM_URL = new URL('maze.wasm', import.meta.url).href;

async function loadWasm() {
  if (typeof createMazeModule !== 'function') {
    throw new Error('maze.js missing — run `make`, then hard-refresh');
  }

  const mod = await new Promise((resolve, reject) => {
    createMazeModule({
      instantiateWasm(imports, emscriptenReady) {
        WebAssembly.instantiateStreaming(fetch(WASM_URL), imports)
          .then(({ instance }) => {
            console.log('wasm loaded', { url: WASM_URL, instance });
            emscriptenReady(instance);
          })
          .catch(reject);
      },
    })
      .then(resolve)
      .catch(reject);
  });

  return mod;
}

// =============================================================================
// PART B — RUN GAME
// =============================================================================

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
  if (!mod._game_won()) {
    mod._step_game(dt);
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

function callWasmCrash(exportName, label) {
  const feedback = document.getElementById('sentry-feedback');

  function showFeedback(message) {
    if (feedback) {
      feedback.textContent = message;
    }
    console.log('[sentry test]', message);
  }

  const fn = mod[`_${exportName}`];
  if (typeof fn !== 'function') {
    showFeedback(`${exportName} missing — run make and hard-refresh`);
    return;
  }

  showFeedback(`Calling ${label}…`);
  try {
    fn();
    showFeedback(`${label} returned (unexpected)`);
  } catch (err) {
    console.error('[wasm crash]', err);
    console.error('[wasm crash stack]\n', err.stack);
    Sentry.captureException(err);
    showFeedback(
      sentryDsnSet
        ? `${label}: ${err.message} — sent to Sentry.`
        : `${label}: ${err.message} — no DSN in build.`,
    );
  }
}

function wireTestButtons() {
  document.getElementById('report-js-error')?.addEventListener('click', () => {
    const feedback = document.getElementById('sentry-feedback');
    const err = new Error('js test');
    Sentry.captureException(err);
    const message = sentryDsnSet
      ? 'Sent JS test error to Sentry — check Issues.'
      : 'captureException called — no DSN in build.';
    if (feedback) {
      feedback.textContent = message;
    }
    console.log('[sentry test]', message);
  });

  document.getElementById('trigger-wasm-divzero')?.addEventListener('click', () => {
    callWasmCrash('trigger_crash_divzero', 'WASM divzero');
  });

  document.getElementById('trigger-wasm-deep')?.addEventListener('click', () => {
    callWasmCrash('trigger_crash_deep', 'WASM deep stack');
  });
}

async function start() {
  try {
    mod = await loadWasm();
    initGame((Math.random() * 0x7fffffff) | 0, 1);
    canvas.width = mod._get_width();
    canvas.height = mod._get_height();
    status.textContent = `Running ${canvas.width}×${canvas.height}`;

    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
    document.getElementById('regenerate').addEventListener('click', () =>
      initGame((Math.random() * 0x7fffffff) | 0, level),
    );
    document.getElementById('next-level').addEventListener('click', () =>
      initGame((Math.random() * 0x7fffffff) | 0, level + 1),
    );
    wireTestButtons();
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    status.textContent = `WASM load failed: ${err.message}`;
  }
}

start();
