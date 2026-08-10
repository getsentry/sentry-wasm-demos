const createMazeModule = globalThis.createMazeModule;

const canvas = document.getElementById('screen');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');

let module = null;
let imageData = null;
let running = false;

function drawFrame() {
  if (!module) {
    return;
  }

  module._step_game();

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
}

function loop() {
  if (!running) {
    return;
  }
  drawFrame();
  requestAnimationFrame(loop);
}

async function start() {
  try {
    if (typeof createMazeModule !== 'function') {
      throw new Error('maze.js did not load — run make and hard-refresh');
    }

    module = await createMazeModule();
    module._init_game();

    const width = module._get_width();
    const height = module._get_height();
    canvas.width = width;
    canvas.height = height;

    status.textContent = `Running ${width}×${height} — stub renderer active`;
    running = true;
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    status.textContent = `Failed to load WASM: ${err.message}`;
  }
}

start();
