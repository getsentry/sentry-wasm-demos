import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './env.mjs';
import { defaultCliRoot } from './paths.mjs';

/** Root of the getsentry/cli repo (pnpm workspace). */
export const sentryCliRoot = env('SENTRY_CLI_ROOT', defaultCliRoot);

export function assertSentryCliRoot() {
  const pkg = join(sentryCliRoot, 'packages/cli/package.json');
  if (!existsSync(pkg)) {
    console.error(
      `[cli] SENTRY_CLI_ROOT does not look like the Sentry CLI repo: ${sentryCliRoot}`,
    );
    console.error('[cli] Set SENTRY_CLI_ROOT in web/.env or clone getsentry/cli.');
    process.exit(1);
  }
}

/** Env vars for Sentry API commands (debug-files, sourcemap upload, …). */
export function sentryCliEnv(extra = {}) {
  return {
    ...process.env,
    SENTRY_AUTH_TOKEN: env('SENTRY_AUTH_TOKEN'),
    SENTRY_ORG: env('SENTRY_ORG'),
    SENTRY_PROJECT: env('SENTRY_PROJECT'),
    ...extra,
  };
}

const cliPkg = () => join(sentryCliRoot, 'packages/cli');

/**
 * Run the local `sentry` CLI from SENTRY_CLI_ROOT (tsx src — includes uncommitted changes).
 * @param {string} args everything after `sentry` on the command line
 */
export function runSentry(args, options = {}) {
  assertSentryCliRoot();
  const pkg = cliPkg();
  const tsx = join(pkg, 'node_modules/.bin/tsx');
  const shim = join(pkg, 'script/require-shim.mjs');
  const bin = join(pkg, 'src/bin.ts');
  const cmd = `"${tsx}" --import "${shim}" "${bin}" ${args}`;
  execSync(cmd, {
    stdio: 'inherit',
    cwd: pkg,
    env: sentryCliEnv(options.env),
    ...options,
  });
}
