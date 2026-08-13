# Raycaster Maze (Emscripten)

C++17 raycaster → WebAssembly. JavaScript draws the pixel buffer on a `<canvas>`. Integrated with `@sentry/browser` + `@sentry/wasm`.

## Build & run

```bash
source /path/to/emsdk/emsdk_env.sh
make
cd web && npm install && npm run build:js && cd ..
python3 -m http.server 8080
```

Open [http://localhost:8080/web/](http://localhost:8080/web/). Hard-refresh after rebuilds.

### Sentry config (not in HTML)

```bash
cd web
cp .env.example .env   # SENTRY_DSN + sentry-cli vars
npm run build:js
```

`web/.env`, `web/app.js`, Emscripten outputs (`web/maze.js`, `web/maze.wasm`, `web/maze.nosym.*`), and `web/maze.debug.wasm` are gitignored.

C++ build uses `-g`, `-O2`, `-Wl,--build-id`, and `-fno-optimize-sibling-calls` (keeps the deep crash stack from collapsing at `-O2`).

## Build variants

Two Emscripten outputs for comparing Sentry symbolication:

| Target | Output | `-g` | Sentry stacks |
| --- | --- | --- | --- |
| `make` (default) | `web/maze.js` + `web/maze.wasm` | yes | `chaos_deep*.cpp` after `make symbols` + upload |
| `make no-symbols` | `web/maze.nosym.js` + `web/maze.nosym.wasm` | no | wasm offsets / function names only |

**Symbolicated (default):** `make && make symbols`, upload `maze.debug.wasm`, keep `maze.js` in `index.html` and `maze.wasm` as `WASM_URL` in `main.js`.

**Unsymbolicated test:** `make no-symbols`, point web at `maze.nosym.js` + `maze.nosym.wasm`. Hard-refresh, trigger **WASM divzero** or **WASM deep crash**. No `make symbols` or `sentry-cli upload` for this path — without `-g` there is no DWARF in the WASM, so `wasm-split` has nothing to extract and Sentry has no C++ line info to resolve even if you upload.

Switch back to the default paths when done testing.

## Debug symbols (`make symbols`)

Applies to the default `make` build only (`-g` embeds DWARF). The `make no-symbols` output has no debug info to split.

Requires [wasm-split](https://github.com/getsentry/symbolicator/tree/master/crates/wasm-split) from Symbolicator:

```bash
cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split
```

Then:

```bash
make symbols
```

(`make symbols` rebuilds `maze.wasm` with `-g` and `-Wl,--build-id`, then splits debug info.)

This runs `wasm-split web/maze.wasm -d web/maze.debug.wasm --strip` and prints the `sentry-cli` upload command.

Upload (set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in `web/.env`):

```bash
sentry-cli debug-files upload -t wasm web/maze.debug.wasm
```

## Verify symbolication

1. Set `SENTRY_DSN` in `web/.env`, run `npm run build:js`
2. Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in `web/.env`
3. `make && make symbols` — upload `web/maze.debug.wasm` with sentry-cli
4. Serve: `python3 -m http.server 8080` → open `/web/`
5. Click **WASM divzero** or **WASM deep crash**

In the Sentry issue, expect:

- `debug_meta.images[0].type === 'wasm'`
- `code_file` matches `http://localhost:8080/web/maze.wasm` (your serve URL)
- `code_id` / `debug_id` present (from `--build-id`)
- WASM frame with `addr_mode: "rel:0"`, `platform: "native"`
- After processing: symbolicated to `cpp/chaos/chaos_deep1.cpp`, etc.

**Test buttons:**

| Button | Action |
| --- | --- |
| Report test error | JS `captureException` — pipeline sanity check |
| WASM divzero | `trigger_crash_divzero()` — integer divide by zero |
| WASM deep crash | `deep5→…→deep1` then divide by zero — stack depth test |

## Files

| File | Role |
| --- | --- |
| `cpp/chaos/` | Intentional wasm crashes for Sentry testing |
| `web/sentry-init.js` | `Sentry.init` + `wasmIntegration()` |
| `web/build-js.mjs` | Bundles JS; injects `SENTRY_DSN` from `.env` |
| `web/maze.debug.wasm` | Debug split module for symbol upload (`make symbols`) |

## Controls

WASD or arrows. Collect all keys, exit bottom-right.
