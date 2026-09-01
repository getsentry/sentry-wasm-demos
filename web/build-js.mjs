import { build } from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { env, sentryRelease } from './env.mjs';

const root = dirname(fileURLToPath(import.meta.url));

const dsn = env('SENTRY_DSN');
const shared = {
  entryPoints: [join(root, 'bootstrap.js')],
  bundle: true,
  format: 'esm',
  outfile: join(root, 'app.js'),
  sourcemap: true,
  define: {
    __SENTRY_DSN__: JSON.stringify(dsn),
    __SENTRY_RELEASE__: JSON.stringify(sentryRelease),
  },
};

const watch = process.argv.includes('--watch');

if (watch) {
  const ctx = await build({ ...shared, watch: true });
  await ctx.watch();
  console.log('[build] watching…');
} else {
  await build(shared);
}

if (dsn) {
  console.log('[build] SENTRY_DSN injected into app.js');
} else {
  console.log('[build] No SENTRY_DSN — Sentry disabled in this build');
}
