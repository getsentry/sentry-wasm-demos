const createMazeModule = globalThis.createMazeModule;

const canvas = document.getElementById('screen');
const status = document.getElementById('status');
const hud = document.getElementById('hud');
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

function updateHud() {
  if (!module) {
    return;
  }

  if (module._game_won()) {
    hud.textContent = 'You found the exit!';
    status.textContent = 'Victory — refresh to play again';
    return;
  }

  const keyLine = module._player_has_key() ? 'Key: yes' : 'Key: no';
  hud.textContent = `WASD move, arrows turn — find exit · ${keyLine}`;
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
    module._init_game(Date.now() | 0);

    const width = module._get_width();
    const height = module._get_height();
    canvas.width = width;
    canvas.height = height;

    status.textContent = `Running ${width}×${height}`;
    running = true;

    window.addEventListener('keydown', (event) => onKeyChange(event, true));
    window.addEventListener('keyup', (event) => onKeyChange(event, false));

    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    status.textContent = `Failed to load WASM: ${err.message}`;
  }
}

start();
