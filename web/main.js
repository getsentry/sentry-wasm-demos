import { formatHarnessBanner, getHarnessConfig } from './harness/config.js';
import { showHarnessError } from './harness/error-ui.js';
import { getCreateModule, loadGlueScript } from './harness/loaders.js';
import { wireHarnessPresets } from './harness/presets.js';
import { applyHarnessContext } from './harness/sentry-context.js';
import { setBackendBadge } from './harness/sentry-tests.js';
import { wireWasmWorkerCrashTest } from './harness/worker-crash.js';

wireHarnessPresets();

async function main() {
  const config = getHarnessConfig();
  applyHarnessContext(config);
  setBackendBadge(formatHarnessBanner(config));

  if (config.loader !== 'unity') {
    wireWasmWorkerCrashTest(config);
  }

  const runnerModule = await config.startRunner();
  if (typeof runnerModule.start !== 'function') {
    throw new Error(`Backend ${config.backendId} missing start()`);
  }

  // Unity loads its own loader.js inside the runner (glueGlobal is null, same as rust).
  if (config.loader !== 'unity' && config.glueGlobal) {
    await loadGlueScript(config.glueScript);
    if (!getCreateModule(config.glueGlobal)) {
      throw new Error(`${config.glueGlobal} missing after loading ${config.glueScript}`);
    }
  }

  await runnerModule.start(config);
}

main().catch(err => {
  console.error(err);
  showHarnessError(err);
});
