# Rust backend (wasm-bindgen)

Crash-only demo: `trigger_crash_divzero`, `trigger_crash_deep`, `ping`.

No game loop (`step_game`). Main-thread and **worker** buttons call `trigger_crash_*` immediately — unlike Emscripten, which arms a flag and traps on the next `step_game`.

`console_error_panic_hook` ([crates.io](https://crates.io/crates/console_error_panic_hook), wasm-bindgen ecosystem — not a Sentry crate) is installed on the first divzero or deep-stack call only (`ensure_panic_hook`). Without it, a Rust panic becomes a bare wasm trap (`RuntimeError: unreachable`) with no human-readable panic text on the JS side. The hook logs `panicked at '…', src/lib.rs:…` to `console.error`; the harness stores that in `wasm_crash.panic_message`. Stack file:line still comes from debug-file upload + symbolication, not from the hook.

## Build variants

| Harness URL | Make targets | Browser wasm | Upload to Sentry |
| ----------- | ------------ | ------------ | ---------------- |
| `?backend=rust` (default) | `make rust && make rust-symbols` | `demo_bg.wasm` | `demo.debug.wasm` |
| `?backend=rust&build=release-debug` | `make rust-release-debug && make rust-release-debug-symbols` | `demo_release_bg.wasm` | `demo_release.debug.wasm` |
| `?backend=rust&build=release-stripped` | `make rust-no-symbols` | `demo_nosym_bg.wasm` | none |

**Dev** — `[profile.dev]` with `debug = 2`, no optimization.

**Release-debug** — `[profile.release]` with `opt-level = "s"`, `lto = true`, and **`debug = true`**. `wasm-split --strip` moves DWARF into `demo_release.debug.wasm` for upload.

**Release-stripped** — same release profile but `RUSTFLAGS=-C debuginfo=0` only (no `strip=symbols`); tests rustc emitting no DWARF.

## Symbolication

```bash
make -C backends/rust clean && make rust && make rust-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm --include-sources web/assets/rust/demo.debug.wasm
```

For release-debug:

```bash
make -C backends/rust clean && make rust-release-debug && make rust-release-debug-symbols
sentry-cli debug-files upload -t wasm --include-sources web/assets/rust/demo_release.debug.wasm
```

Re-upload after every build (`debug_id` changes). Hard-refresh the browser before triggering a new crash.
