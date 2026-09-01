import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));

/** @param {string} key */
function readEnvFile(key) {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) {
    return '';
  }

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(new RegExp(`^${key}=(.*)$`));
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  return '';
}

/** @param {string} key @param {string} fallback */
export function env(key, fallback = '') {
  return process.env[key]?.trim() || readEnvFile(key) || fallback;
}

export const sentryRelease = env('SENTRY_RELEASE', 'wasm-maze-demo@dev');
export const sentryUrlPrefix = env('SENTRY_URL_PREFIX', 'http://localhost:8080/web/');
