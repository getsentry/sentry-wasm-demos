import * as Sentry from '@sentry/browser';
import { wasmIntegration } from '@sentry/wasm';

// Injected at build time from web/.env via build-js.mjs — not stored in HTML.
const dsn = __SENTRY_DSN__;
const sentryDsnSet = dsn.length > 0;

if (!sentryDsnSet) {
  console.warn('[sentry] No DSN in this build — events will not be sent');
} else {
  Sentry.init({
    dsn,
    integrations: [wasmIntegration()],
    tracesSampleRate: 0,
    environment: 'demo',
    release: 'wasm-maze-demo@dev',
  });
  console.log('[sentry] initialized');
}

window.addEventListener('error', (event) => {
  console.error('[uncaught]', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled rejection]', event.reason);
});

export { Sentry, sentryDsnSet };
