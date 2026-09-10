import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runSentry } from './cli.mjs';
import { env } from './env.mjs';
import { webRoot } from './paths.mjs';

/** Backend shorthand (`rust`) → `web/assets/rust`; pass-through if path already exists. */
function resolveTarget(target) {
  const direct = join(webRoot, target);
  if (existsSync(direct)) {
    return direct;
  }
  const underAssets = join(webRoot, 'assets', target);
  if (existsSync(underAssets)) {
    return underAssets;
  }
  console.error(`[prepare] Path not found: ${direct} (also tried ${underAssets})`);
  process.exit(1);
}

for (const key of ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']) {
  if (!env(key)) {
    console.error(`[prepare] Missing ${key} in web/.env`);
    process.exit(1);
  }
}

const argv = process.argv.slice(2);
const defaultTarget = 'assets/emscripten-raycast';
const target =
  argv[0] && !argv[0].startsWith('-') ? argv.shift() : defaultTarget;
const flags =
  argv.length > 0 ? argv.join(' ') : '--include-sources --wait';
const path = resolveTarget(target);

console.log(`[prepare] sentry debug-files prepare ${flags} ${path}`);
runSentry(`debug-files prepare ${flags} "${path}"`);
