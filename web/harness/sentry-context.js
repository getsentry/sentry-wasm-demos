import { Sentry, sentryDsnSet } from '../sentry-init.js';

/**
 * @typedef {object} HarnessSentryConfig
 * @property {string} backendId
 * @property {string} backendLabel
 * @property {'cpp' | 'rust' | 'csharp'} language
 * @property {string} loader
 * @property {'streaming' | 'non-streaming' | 'default'} load
 * @property {'caught' | 'uncaught'} crashMode
 * @property {'full' | 'split' | 'sourcemap' | 'dev' | 'release-debug' | 'release-stripped' | 'full-stack' | 'full-no-stack' | 'explicit' | 'none' | null} build
 * @property {boolean} symbols
 * @property {boolean} workerOnly
 * @property {string} wasmUrl
 * @property {string} glueScript
 * @property {string | null} debugUploadRel
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
    'wasm.capture_mode': config.crashMode,
    'wasm.symbols': config.symbols ? 'on' : 'off',
    'wasm.worker_only': config.workerOnly ? 'yes' : 'no',
    ...(config.build ? { 'wasm.build': config.build } : {}),
  });

  Sentry.setContext('wasm_harness', {
    backend_id: config.backendId,
    backend_label: config.backendLabel,
    language: config.language,
    loader: config.loader,
    load_mode: config.load,
    capture_mode: config.crashMode,
    build_variant: config.build,
    symbols: config.symbols,
    worker_only: config.workerOnly,
    wasm_url: config.wasmUrl,
    glue_script: config.glueScript,
    debug_upload_rel: config.debugUploadRel,
  });
}

/**
 * @typedef {'divzero' | 'deep_stack' | 'js_test' | 'worker'} HarnessCrashType
 */

/**
 * @typedef {object} CaptureHarnessExceptionOptions
 * @property {string | null} [panicMessage] Rust console_error_panic_hook line, if captured
 */

/**
 * Send the original error so wasm symbolication runs on the main stack.
 * Issue title backend:err is applied in sentry-init beforeSend (no wrapper/cause).
 * @param {unknown} err
 * @param {HarnessCrashType} crashType
 * @param {CaptureHarnessExceptionOptions} [options]
 */
export function captureHarnessException(err, crashType, options = {}) {
  const language = harnessConfig?.language ?? 'unknown';

  Sentry.withScope(scope => {
    scope.setTag('wasm.crash_type', crashType);
    if (harnessConfig?.crashMode) {
      scope.setTag('wasm.capture_mode', harnessConfig.crashMode);
    }
    if (harnessConfig?.build) {
      scope.setTag('wasm.build', harnessConfig.build);
    }
    scope.setFingerprint(['wasm-demo', crashType, language]);
    scope.setContext('wasm_crash', {
      crash_type: crashType,
      language,
      issue_title: `${language}:${crashType}`,
      backend_id: harnessConfig?.backendId ?? null,
      build_variant: harnessConfig?.build ?? null,
      load_mode: harnessConfig?.load ?? null,
      capture_mode: harnessConfig?.crashMode ?? null,
      symbols: harnessConfig?.symbols ?? null,
      worker_only: harnessConfig?.workerOnly ?? null,
      debug_upload_rel: harnessConfig?.debugUploadRel ?? null,
      original_message: err instanceof Error ? err.message : String(err),
      original_type: err instanceof Error ? err.name : typeof err,
      panic_message: options.panicMessage ?? null,
    });
    Sentry.captureException(err);
  });
}
