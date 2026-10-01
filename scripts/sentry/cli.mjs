import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './env.mjs';
import { repoRoot } from './paths.mjs';

/** Released `@sentry/cli` installed by `npm install` in the repo root. */
const localBin = join(repoRoot, 'node_modules/.bin/sentry-cli');

function sentryCliBin() {
  if (existsSync(localBin)) {
    return localBin;
  }
  console.error('[cli] sentry-cli not found — run `npm install` in the repo root.');
  process.exit(1);
}

/** Env vars for Sentry API commands (debug-files, sourcemaps upload, …). */
export function sentryCliEnv(extra = {}) {
  return {
    ...process.env,
    SENTRY_AUTH_TOKEN: env('SENTRY_AUTH_TOKEN'),
    SENTRY_ORG: env('SENTRY_ORG'),
    SENTRY_PROJECT: env('SENTRY_PROJECT'),
    ...extra,
  };
}

/**
 * Run `sentry-cli`.
 * @param {string} args everything after `sentry-cli` on the command line
 */
export function runSentry(args, options = {}) {
  try {
    execSync(`"${sentryCliBin()}" ${args}`, {
      stdio: 'inherit',
      cwd: repoRoot,
      env: sentryCliEnv(options.env),
      ...options,
    });
  } catch (error) {
    // sentry-cli already printed the reason — don't bury it under a node stack.
    process.exit(error.status ?? 1);
  }
}
