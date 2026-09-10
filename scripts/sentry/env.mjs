import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { webRoot } from './paths.mjs';

const envPath = join(webRoot, '.env');

/** @param {string} key */
function readEnvFile(key) {
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

/** @param {string} key @param {string} [fallback] */
export function env(key, fallback = '') {
  return process.env[key]?.trim() || readEnvFile(key) || fallback;
}

export const sentryRelease = env('SENTRY_RELEASE', 'wasm-maze-demo@dev');
export const sentryUrlPrefix = env('SENTRY_URL_PREFIX', 'http://localhost:8080/web/');
