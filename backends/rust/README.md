# Rust backend (wasm-bindgen)

Crash-only demo: `trigger_crash_divzero`, `trigger_crash_deep`, `ping`.

## Build

```bash
make -C backends/rust clean && make -C backends/rust all && make -C backends/rust symbols
```

Or from repo root: `make rust && make rust-symbols`.

- **`demo.js` + `demo_bg.wasm`** — browser bundle (stripped after `symbols`)
- **`demo.debug.wasm`** — upload to Sentry (DWARF + line tables)

`wasm-pack` output must be used for the browser (wasm-bindgen import layout). Enable `dwarf-debug-info = true` in `Cargo.toml` so DWARF survives bindgen, then `wasm-split` extracts it into `demo.debug.wasm`.

## Symbolication

Dev build embeds full debug info (`debug = 2`, `-C debuginfo=2`).

After any Rust or debug-flag change:

```bash
make -C backends/rust clean && make rust && make rust-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm --include-sources web/assets/rust/demo.debug.wasm
```

Re-upload after every build (`debug_id` changes). Trigger a **new** issue after upload.

Check issue JSON: `has_debug_info: true` and/or `has_sources: true` when line info and source panel work.

## No-symbols variant

```bash
make -C backends/rust no-symbols
```

Open with `?backend=rust&symbols=0`.
