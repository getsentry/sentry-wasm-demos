const createMazeModule = globalThis.createMazeModule;

const canvas = document.getElementById('screen');
const status = document.getElementById('status');
const hud = document.getElementById('hud');
const winOverlay = document.getElementById('win-overlay');
const regenerateButton = document.getElementById('regenerate');
const nextLevelButton = document.getElementById('next-level');
const ctx = canvas.getContext('2d');

const Key = {
  W: 87,
  A: 65,
  S: 83,
  D: 68,
  Left: 37,
  Up: 38,
  Right: 39,
  Down: 40,
};

const TRACKED_KEYS = new Set([
  Key.W,
  Key.A,
  Key.S,
  Key.D,
  Key.Left,
  Key.Up,
  Key.Right,
  Key.Down,
]);

let module = null;
let imageData = null;
let running = false;
let lastTime = 0;
let level = 1;

function randomSeed() {
  return (Math.random() * 0x7fffffff) | 0;
}

function clearKeyState() {
  for (const keyCode of TRACKED_KEYS) {
    module._handle_key(keyCode, 0);
  }
}

function initGame(seed, nextLevel = level) {
  clearKeyState();
  level = nextLevel;
  module._init_game(seed, level);
  winOverlay.classList.add('hidden');
  winOverlay.setAttribute('aria-hidden', 'true');
  lastTime = 0;
  updateHud();
}

function updateHud() {
  if (!module) {
    return;
  }

  const currentLevel = module._get_level();

  if (module._game_won()) {
    winOverlay.classList.remove('hidden');
    winOverlay.setAttribute('aria-hidden', 'false');
    hud.textContent = `Level ${currentLevel} cleared`;
    status.textContent = 'Next level or regenerate for a new layout';
    return;
  }

  const keys = module._player_key_count();
  const needed = module._keys_required();
  const keyLine = `Keys: ${keys}/${needed}`;
  hud.textContent = `Level ${currentLevel} · WASD move, arrows turn · ${keyLine} · exit at bottom-right`;
}

function drawFrame() {
  if (!module) {
    return;
  }

  module._render_frame();

  const width = module._get_width();
  const height = module._get_height();
  const ptr = module._get_pixel_buffer_ptr();

  if (!ptr || width <= 0 || height <= 0) {
    return;
  }

  const bytes = width * height * 4;
  const heap = module.HEAPU8.subarray(ptr, ptr + bytes);

  if (!imageData || imageData.width !== width || imageData.height !== height) {
    imageData = ctx.createImageData(width, height);
  }

  imageData.data.set(heap);
  ctx.putImageData(imageData, 0, 0);
  updateHud();
}

function loop(now) {
  if (!running) {
    return;
  }

  if (lastTime === 0) {
    lastTime = now;
  }

  const dtMs = now - lastTime;
  lastTime = now;

  if (!module._game_won()) {
    module._step_game(dtMs);
  }

  drawFrame();
  requestAnimationFrame(loop);
}

function onKeyChange(event, down) {
  if (!module || !TRACKED_KEYS.has(event.keyCode)) {
    return;
  }

  event.preventDefault();
  module._handle_key(event.keyCode, down ? 1 : 0);
}

async function start() {
  try {
    if (typeof createMazeModule !== 'function') {
      throw new Error('maze.js did not load — run make and hard-refresh');
    }

    module = await createMazeModule();
    initGame(randomSeed(), 1);

    const width = module._get_width();
    const height = module._get_height();
    canvas.width = width;
    canvas.height = height;

    status.textContent = `Running ${width}×${height}`;
    running = true;

    window.addEventListener('keydown', (event) => onKeyChange(event, true));
    window.addEventListener('keyup', (event) => onKeyChange(event, false));
    regenerateButton.addEventListener('click', () => initGame(randomSeed(), level));
    nextLevelButton.addEventListener('click', () => initGame(randomSeed(), level + 1));

    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    status.textContent = `Failed to load WASM: ${err.message}`;
  }
}

start();
