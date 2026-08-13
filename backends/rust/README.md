# Rust · wasm-bindgen (planned)

Minimal Rust WASM backend to test `@sentry/wasm` outside Emscripten (different glue, load paths, stack formatting).

## Goal

- Export the same crash contract: `trigger_crash_divzero`, `trigger_crash_deep`
- Embed `build_id` for Sentry `debug_id`
- Output to `web/assets/rust/` (`tiny.js` + `tiny.wasm` or wasm-bindgen names)
- Select with `?backend=rust`

## Stub status

Implement `web/backends/rust.js` runner + this crate; harness already routes by `?backend=rust`.

## Suggested first steps

1. `cargo init --lib` in this directory
2. `wasm-bindgen` exports + `wasm-pack build --target web`
3. Copy chaos pattern from `../emscripten-raycast/src/chaos/`
