import { Sentry, sentryDsnSet } from '../sentry-init.js';

/**
 * @typedef {object} HarnessSentryConfig
 * @property {string} backendId
 * @property {string} backendLabel
 * @property {'cpp' | 'rust'} language
 * @property {string} loader
 * @property {'streaming' | 'instantiate' | 'default'} load
 * @property {boolean} symbols
 * @property {string} wasmUrl
 * @property {string} glueScript
 */

/** @type {HarnessSentryConfig | null} */
let harnessConfig = null;

/**
 * Apply harness URL options as Sentry tags + context for every event this session.
 * @param {HarnessSentryConfig} config
 */
export function applyHarnessContext(config) {
  harnessConfig = config;

  if (!sentryDsnSet) {
    return;
  }

  Sentry.setTags({
    'wasm.backend': config.backendId,
    'wasm.language': config.language,
    'wasm.loader': config.loader,
    'wasm.load': config.load,
    'wasm.symbols': config.symbols ? 'on' : 'off',
  });

  Sentry.setContext('wasm_harness', {
    backend_id: config.backendId,
    backend_label: config.backendLabel,
    language: config.language,
    loader: config.loader,
    load_mode: config.load,
    symbols: config.symbols,
    wasm_url: config.wasmUrl,
    glue_script: config.glueScript,
  });
}

/**
 * @typedef {'divzero' | 'deep_stack' | 'js_test'} HarnessCrashType
 */

/**
 * Send the original error so wasm symbolication runs on the main stack.
 * Issue title backend:err is applied in sentry-init beforeSend (no wrapper/cause).
 * @param {unknown} err
 * @param {HarnessCrashType} crashType
 */
export function captureHarnessException(err, crashType) {
  const language = harnessConfig?.language ?? 'unknown';

  Sentry.withScope(scope => {
    scope.setTag('wasm.crash_type', crashType);
    scope.setFingerprint(['wasm-demo', crashType, language]);
    scope.setContext('wasm_crash', {
      crash_type: crashType,
      language,
      issue_title: `${language}:${crashType}`,
      backend_id: harnessConfig?.backendId ?? null,
      load_mode: harnessConfig?.load ?? null,
      symbols: harnessConfig?.symbols ?? null,
      original_message: err instanceof Error ? err.message : String(err),
      original_type: err instanceof Error ? err.name : typeof err,
    });
    Sentry.captureException(err);
  });
}
