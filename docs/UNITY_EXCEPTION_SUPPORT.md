# Unity WebGL · `@sentry/wasm` · exceptionSupport coverage

Measured with the minimal project in `backends/unity/` **without** the Sentry Unity
SDK. The player only throws; the harness page captures via `@sentry/browser` +
`@sentry/wasm` (same path as Emscripten/Rust).

Crash surface: `WasmCrashHarness` throws `InvalidOperationException` from `Deep3()`
after `Deep1 → Deep2`. IL2CPP turns that into a wasm/JS abort. There are **no
managed C# events**.

Filter Sentry issues: `wasm.backend:unity`, `wasm.build=full-stack` (slug, not
`exception-*`), `wasm.crash_type:deep_stack`.

## Coverage table

Legend: ✅ yes · ⚠️ partial · ❌ no · ⬜ not measured yet · — not applicable

| `exceptionSupport` | Build slug | Event in Sentry | C# method names | Wasm/IL2CPP frames | debug_id / symbolicated |
| ------------------ | ---------- | --------------- | --------------- | ------------------ | ----------------------- |
| `None` | `none` | ⬜ throw may not surface as JS | ❌ | ⬜ | ❌ no upload |
| `ExplicitlyThrownExceptionsOnly` | `explicit` | ⬜ | ❌ | ⬜ | ❌ |
| `FullWithoutStacktrace` | `full-no-stack` | ⬜ | ❌ | ⬜ | ❌ |
| `FullWithStacktrace` | `full-stack` | ⬜ expected JS/wasm abort | ❌ not a C# SDK event | ⬜ `*.wasm:wasm-function[N]:0x…` or `wasm://` | ❌ no `sentry-cli` upload |

`exceptionSupport` still matters: it controls whether a C# throw becomes a
**browser-visible** abort at all. It does **not** produce C# stack frames in this
setup — only whatever wasm stack the browser puts on the Error.

### Column definitions

- **Event in Sentry** — `@sentry/browser` received an exception (click handler
  `captureException` or GlobalHandlers on `window.error`).
- **C# method names** — `WasmCrashHarness.Deep3` etc. Expect **absent**: there is
  no `io.sentry.unity` to emit `platform: csharp` frames.
- **Wasm/IL2CPP frames** — `exception.stacktrace.frames` with `*.wasm:wasm-function`
  or `wasm://wasm/…` filenames (raw offsets).
- **debug_id / symbolicated** — `debug_meta.images[].debug_id` + Symbolicator
  `found`. Unity IL2CPP wasm is **not** uploaded here; even a present `debug_id`
  will not resolve C++/C# file:line.

## Does `@sentry/wasm` see Unity's instantiate?

**Yes, the patch runs first.** `web/bootstrap.js` imports `sentry-init.js` before
`main.js`. `wasmIntegration().setupOnce()` patches `WebAssembly.instantiateStreaming`,
`compileStreaming`, `instantiate`, and `compile`.

Unity **does not bypass** those globals. `Build/<slug>.framework.js` (Emscripten
shell Unity ships) prefers:

```text
fetch(codeUrl) → WebAssembly.instantiateStreaming(response, imports)
```

and falls back to `WebAssembly.instantiate(arrayBuffer)`. Both are patched.

`?load=` on the harness:

| `?load=` | What happens |
| -------- | ------------ |
| `streaming` (default) | Harness sets `Module.instantiateWasm` → `instantiateStreaming(fetch(codeUrl))` |
| `non-streaming` | Same hook → `arrayBuffer` + `WebAssembly.instantiate` (URL often missing on the buffer — registration gap, same as Emscripten) |
| `default` | No `instantiateWasm` override — Unity's own `instantiateStreaming` path (still patched) |

**Registration caveat:** `@sentry/wasm` `registerModule` **requires a `build_id`
custom section**. Measured `full-stack.wasm` (2022.3.50f1, no Unity SDK): custom
section `name` only (~4.5 MB), **no `build_id`**, no DWARF. So `debug_meta.images`
stays empty even though instantiate was patched. Frames can still appear with
wasm filenames/offsets; `addr_mode` / Symbolicator match need a registered image.

No explicit `registerModule` call after `createUnityInstance` — the public
`@sentry/wasm` API does not export one; the WebAssembly patch is the only hook.

## How to verify locally

```bash
export UNITY="/Applications/Unity/Hub/Editor/2022.3.50f1/Unity.app/Contents/MacOS/Unity"
set -a && source web/.env && set +a
make unity-one MODE=full-stack
cd web && npm run build:js && cd ..
python3 -m http.server 8080
```

1. Open `http://localhost:8080/web/?backend=unity&build=full-stack`
2. Click **C# deep crash**
3. In the Sentry issue JSON, compare to emscripten-raycast **WASM deep crash**:
   - `exception.stacktrace.frames` — wasm vs empty vs leftover JS?
   - `debug_meta.images` — present? `debug_id`?
   - tags `wasm.backend=unity`, `wasm.load`, `wasm.build=full-stack`

No `sentry-cli debug-files upload` for Unity wasm (IL2CPP DWARF is a follow-up).

## Part 2 matrix row (summary)

| Backend | Build | Load | Crash | Func | Line | Source | debug_id sent | Sym found | in images |
| ------- | ----- | ---- | ----- | ---- | ---- | ------ | ------------- | --------- | --------- |
| unity | full-stack | streaming | deep_stack (C# throw) | ⬜ wasm names/offsets | ❌ | ❌ | ⬜ | ❌ no upload | ⬜ |
