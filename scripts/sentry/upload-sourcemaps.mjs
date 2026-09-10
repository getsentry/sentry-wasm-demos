import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runSentry } from './cli.mjs';
import { env, sentryRelease, sentryUrlPrefix } from './env.mjs';
import { webRoot } from './paths.mjs';

const artifacts = [
  [join(webRoot, 'app.js'), join(webRoot, 'app.js.map')],
  [join(webRoot, 'wasm-worker.js'), join(webRoot, 'wasm-worker.js.map')],
];

for (const [js, map] of artifacts) {
  if (!existsSync(js) || !existsSync(map)) {
    console.error(`[upload] Missing ${js} or ${map} — run \`npm run build:js\` first`);
    process.exit(1);
  }
}

for (const key of ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']) {
  if (!env(key)) {
    console.error(`[upload] Missing ${key} in web/.env`);
    process.exit(1);
  }
}

// Absolute path — runSentry cwd is packages/cli, so "." would scan the wrong tree.
console.log(`[upload] dir=${webRoot} release=${sentryRelease} url-prefix=${sentryUrlPrefix}`);

runSentry(
  `sourcemap upload "${webRoot}" --release "${sentryRelease}" --url-prefix "${sentryUrlPrefix}" ` +
    `--ignore "assets/**,harness/**,backends/**,workers/**"`,
);

console.log('[upload] JS source maps uploaded — hard-refresh, then trigger a new crash');
