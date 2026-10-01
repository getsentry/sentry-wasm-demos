import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/** Repo root (`sentry-wasm-emscripten/`). */
export const repoRoot = join(scriptDir, '../..');

/** Web harness root (`web/`). */
export const webRoot = join(repoRoot, 'web');
