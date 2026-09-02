import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, sentryRelease, sentryUrlPrefix } from './env.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const artifacts = [
  [join(root, 'app.js'), join(root, 'app.js.map')],
  [join(root, 'wasm-worker.js'), join(root, 'wasm-worker.js.map')],
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

const cliEnv = {
  ...process.env,
  SENTRY_AUTH_TOKEN: env('SENTRY_AUTH_TOKEN'),
  SENTRY_ORG: env('SENTRY_ORG'),
  SENTRY_PROJECT: env('SENTRY_PROJECT'),
};

console.log(`[upload] release=${sentryRelease} url-prefix=${sentryUrlPrefix}`);

for (const [js, map] of artifacts) {
  execSync(`sentry-cli sourcemaps inject "${js}" "${map}"`, {
    stdio: 'inherit',
    env: cliEnv,
  });
  execSync(
    `sentry-cli sourcemaps upload "${js}" "${map}" --release "${sentryRelease}" --url-prefix "${sentryUrlPrefix}"`,
    { stdio: 'inherit', env: cliEnv },
  );
}

console.log('[upload] JS source maps uploaded — hard-refresh, then trigger a new crash');
