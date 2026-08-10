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

### Sentry DSN (not in HTML)

DSN is **not** in `index.html`. Configure locally, then rebuild JS:

```bash
cd web
cp .env.example .env   # add your DSN
npm run build:js
```

`web/.env` and `web/app.js` are gitignored. Rebuild after changing the DSN.

Note: browser SDKs must embed the DSN in the bundle at build time — it is not a secret key, but this keeps it out of the repo and the page source.

C++ build uses `-g`, `-O2`, `-Wl,--build-id`. See [docs/sentry-wasm-prep.md](docs/sentry-wasm-prep.md) for non-obvious wasm requirements.

## Files

| File | Role |
| --- | --- |
| `cpp/*.cpp` | Game in C++ |
| `cpp/main.cpp` | Exported functions incl. `trigger_test_crash()` |
| `web/maze.wasm` | Compiled game |
| `web/maze.js` | Emscripten glue (generated — don't edit) |
| `web/sentry-init.js` | `Sentry.init` + `wasmIntegration()` |
| `web/bootstrap.js` | Imports sentry-init **then** main (init order) |
| `web/main.js` | Wasm load + game loop + test buttons |
| `web/build-js.mjs` | Bundles JS; reads `SENTRY_DSN` from `web/.env` |
| `web/app.js` | Bundled output (`npm run build:js`, gitignored) — served by browser |

## Load order

```
index.html
  maze.js
  app.js  (bundle)
    bootstrap.js
      sentry-init.js   ← patches instantiateStreaming, Sentry.init
      main.js          ← loadWasm() → game
```

## Sentry / wasmIntegration

**What `wasmIntegration()` does:**

1. **`patchWebAssembly()`** — wraps `WebAssembly.instantiateStreaming`. When `maze.wasm` loads, calls `registerModule(module, response.url)`.
2. **`registerModule()`** (`@sentry/wasm` `registry.ts`) — reads `build_id` from wasm (Makefile `-Wl,--build-id`). Stores debug image with `code_file` = wasm URL. **Returns `null` if no `build_id`** — no registration, no symbolication.
3. **`processEvent()` / `patchFrames()`** — on errors, attaches `debug_meta.images` and wasm frame metadata for server-side symbolication.

**Test buttons:**

| Button | Action |
| --- | --- |
| Report test error | `Sentry.captureException(new Error('js test'))` |
| Trigger WASM crash | C++ `trigger_test_crash()` → `abort()` |

Symbol upload to Sentry is still required for readable wasm stacks — see [docs/sentry-wasm-prep.md](docs/sentry-wasm-prep.md).

## Controls

WASD or arrows. Collect all keys, exit bottom-right. Regenerate / Next level after win.
