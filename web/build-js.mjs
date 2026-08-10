import { build } from 'esbuild';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));

function loadDsn() {
  if (process.env.SENTRY_DSN) {
    return process.env.SENTRY_DSN.trim();
  }

  const envPath = join(root, '.env');
  if (!existsSync(envPath)) {
    return '';
  }

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^SENTRY_DSN=(.*)$/);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  return '';
}

const dsn = loadDsn();
const shared = {
  entryPoints: [join(root, 'bootstrap.js')],
  bundle: true,
  format: 'esm',
  outfile: join(root, 'app.js'),
  sourcemap: true,
  define: {
    __SENTRY_DSN__: JSON.stringify(dsn),
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
