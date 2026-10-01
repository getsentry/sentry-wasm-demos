import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runSentry } from './cli.mjs';
import { env } from './env.mjs';
import { webRoot } from './paths.mjs';

const DEBUG_FILES = [
  'assets/emscripten-raycast/maze.split.debug.wasm',
  'assets/emscripten-raycast/maze.full.wasm',
  'assets/emscripten-opengl/maze.debug.wasm',
  'assets/rust/demo.debug.wasm',
  'assets/rust/demo_release.debug.wasm',
];

for (const key of ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']) {
  if (!env(key)) {
    console.error(`[upload-debug-wasm] Missing ${key} in web/.env`);
    process.exit(1);
  }
}

const flags = '-t wasm --include-sources --wait';
const paths = [];

for (const rel of DEBUG_FILES) {
  const abs = join(webRoot, rel);
  if (existsSync(abs)) {
    paths.push(`"${abs}"`);
  } else {
    console.warn(`[upload-debug-wasm] skip missing ${rel}`);
  }
}

if (paths.length === 0) {
  console.error('[upload-debug-wasm] No debug files found. Run `make harness` first.');
  process.exit(1);
}

console.log(`[upload-debug-wasm] sentry debug-files upload ${flags} ${paths.join(' ')}`);
runSentry(`debug-files upload ${flags} ${paths.join(' ')}`);
