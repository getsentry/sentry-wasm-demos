// Order matters: Sentry must patch instantiateStreaming before loadWasm() runs.
import './sentry-init.js';
import './main.js';
