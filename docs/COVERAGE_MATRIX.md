# WASM symbolication coverage matrix

Legend: ✅ works · ⚠️ partial · ❌ fails · ⬜ not measured yet · — not applicable

Rows are one harness run each: backend + build + load + upload. Columns are what
Sentry shows. Filter issues by tag `wasm.build`, `wasm.backend`, `wasm.crash_type`,
`wasm.capture_mode` (`caught` = `captureHarnessException` in the game loop;
`uncaught` = `@sentry/browser` GlobalHandlers only).

C++ divzero / deep / **worker** traps always run at the start of `step_game` (after
the button **arms** a pending flag). Compare `?crash=caught` vs `?crash=uncaught`.
Worker events keep tag `wasm.crash_type:worker` on the caught path. Rust worker
still calls `trigger_crash_*` immediately (no `step_game`).

## Part 1 — build artifacts (measured locally, no Sentry needed)

Checked by reading wasm custom sections. This part answers "did the build produce
what Sentry needs", before any upload is involved.

| Artifact | `build_id` | DWARF | `.debug_line` |
| -------- | ---------- | ----- | ------------- |
| emscripten `maze.full.wasm` | ⬜ | ⬜ | ⬜ |
| emscripten `maze.split.wasm` (browser) | ⬜ | ⬜ | ⬜ |
| emscripten `maze.split.debug.wasm` (upload) | ⬜ | ⬜ | ⬜ |
| emscripten `maze.sourcemap.wasm` | ⬜ | ❌ (source map instead) | ❌ |
| rust `demo_bg.wasm` (browser, after split) | ✅ | ❌ stripped | ❌ |
| rust `demo.debug.wasm` (upload) | ✅ | ✅ 6 sections | ✅ |
| rust `demo_release_bg.wasm` (browser, after split) | ✅ | ❌ stripped | ❌ |
| rust `demo_release.debug.wasm` (upload) | ✅ | ✅ 6 sections | ✅ |
| rust `demo_nosym_bg.wasm` | ❌ | ❌ | ❌ |
| unity WebGL `Build/*.wasm` | ❌ no `build_id` (measured `full-stack`) | ❌ | ❌ |

Unity WebGL is IL2CPP-in-the-browser. Measured `full-stack.wasm`: custom section
`name` only (~4.5 MB), **no** `build_id` / DWARF. `@sentry/wasm` still patches
instantiate; `registerModule` skips modules without `build_id`, so
`debug_meta.images` may be empty. No Unity wasm upload. See
[UNITY_EXCEPTION_SUPPORT.md](./UNITY_EXCEPTION_SUPPORT.md).

## Part 2 — Sentry outcome

Fill after uploading the matching debug file and triggering a fresh event.

| Backend | Build | Load | Crash | Func | Line | Source | debug_id sent | Sym found | in images |
| ------- | ----- | ---- | ----- | ---- | ---- | ------ | ------------- | --------- | --------- |
| emscripten-raycast | split | streaming | divzero `caught` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| emscripten-raycast | split | streaming | divzero `uncaught` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| emscripten-raycast | split | instantiate | divzero | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| emscripten-raycast | full | streaming | divzero | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| emscripten-raycast | sourcemap | streaming | divzero | ❌ | ❌ | ❌ | ✅ | ❌ notfound | ✅ |
| emscripten-raycast | — | streaming | `?symbols=0` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| rust | dev | streaming | panic | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| rust | dev | streaming | panic_unwrap | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| rust | dev | streaming | divzero | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| rust | release | streaming | panic | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| rust | release | instantiate | panic | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| rust | — | streaming | `?symbols=0` panic | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| unity | full-stack | streaming | deep_stack (C# throw) | ⬜ wasm offsets | ❌ | ❌ | ⬜ | ❌ no upload | ⬜ |

Unity uses **`@sentry/browser` + `@sentry/wasm`** on the harness page (no
`io.sentry.unity` in the player). Expect IL2CPP/wasm frames, **not** C# method
names. `exceptionSupport` modes (whether a throw becomes a browser abort) are
in Part 3. No Unity debug-file upload — **Sym found** stays ❌.

Column meanings:

- **Func / Line / Source** — what the wasm frame shows in the issue stack trace
- **debug_id sent** — event has `debug_meta.images[].debug_id` (SDK side)
- **Sym found** — `debug_status: found`, i.e. Symbolicator matched an upload
- **in images** — `debug_meta.images` present and frames carry `addr_mode`

C++ **caught** events get `wasm.crash_type`, fingerprint, and `wasm_crash` context
(issue title rewritten in `beforeSend`). Worker **caught** events use the same
helpers with `wasm.crash_type:worker`. **Uncaught** events have session tags
(`wasm.capture_mode=uncaught`, `wasm.backend`, …) but typically **no**
`wasm.crash_type` / custom fingerprint — worker uncaught is
`webWorkerIntegration` only (no `captureHarnessException`). Fill that comparison
after a run.

## Part 3 — Unity WebGL `exceptionSupport`

Player output: `web/assets/unity/<slug>/` (`make unity`). Crash button: **C# deep crash** on `/web/?backend=unity`. Capture is **`@sentry/wasm`**, not the Sentry Unity SDK. `Deep1 → Deep2 → Deep3` C# throw → IL2CPP abort.

| exceptionSupport | Event captured | C# method names | Wasm/IL2CPP frames | debug_id / sym |
| ---------------- | -------------- | --------------- | ------------------ | -------------- |
| None | ⬜ throw may not reach JS | ❌ | ⬜ | ❌ no upload |
| ExplicitlyThrownExceptionsOnly | ⬜ | ❌ | ⬜ | ❌ |
| FullWithoutStacktrace | ⬜ | ❌ | ⬜ | ❌ |
| FullWithStacktrace | ⬜ expected JS/wasm abort | ❌ | ⬜ raw `wasm-function` / `wasm://` | ❌ |

Expected confirmation:

- **No C# stack** (`WasmCrashHarness.Deep3`) — that required `io.sentry.unity`, which this backend no longer ships
- Wasm frames **may** appear (browser stack + `@sentry/wasm` patch). Fill Func / debug_id after a run
- **Not symbolicated** — no `sentry-cli debug-files upload` for Unity here
- `exceptionSupport` only changes whether the throw becomes a **browser-visible** error

`None` still builds (no Unity SDK to abort the player). Throwing may kill the tab without a Sentry event.

Details: [UNITY_EXCEPTION_SUPPORT.md](./UNITY_EXCEPTION_SUPPORT.md) (includes instantiate-patch ordering).
