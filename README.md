# WASM demos · Sentry

Multi-backend harness for testing `@sentry/browser` + `@sentry/wasm` across toolchains.

**Live today:** Emscripten CPU raycast maze  
**Planned:** Emscripten WebGL, Rust (wasm-bindgen)

Same web page, same Sentry test buttons — swap WASM backend via URL.

## Repo layout

```text
backends/
  emscripten-raycast/   C++ CPU raycast → web/assets/emscripten-raycast/
  emscripten-opengl/    WebGL stub (README only)
  rust/                 wasm-bindgen stub (README only)
web/
  harness/              config, loaders, sentry test helpers
  backends/             per-backend JS runners
  assets/               built .js / .wasm per backend
  index.html            shared shell + Sentry panel
```

## Build & run

For **all harness URL paths** (`?symbols=0`, `?load=…`, default), build **both** variants:

```bash
source /path/to/emsdk/emsdk_env.sh
make clean && make && make symbols && make no-symbols
cd web && npm install && npm run build:js && cd ..
python3 -m http.server 8080
```

| Build target | Artifacts | Used when |
| --- | --- | --- |
| `make` + `make symbols` | `maze.js`, `maze.wasm`, `maze.debug.wasm` | Default `/web/`, `?symbols=1`, Sentry upload |
| `make no-symbols` | `maze.nosym.js`, `maze.nosym.wasm` | `?symbols=0` only |

Without `make no-symbols`, `?symbols=0` 404s on `maze.nosym.js`. Without `make symbols`, default path runs but Sentry has no debug file to upload.

Open [http://localhost:8080/web/](http://localhost:8080/web/). Hard-refresh after rebuilds.

### Sentry config

```bash
cd web
cp .env.example .env   # SENTRY_DSN + sentry-cli vars
npm run build:js
```

Gitignored: `web/.env`, `web/app.js`, `web/assets/*/*` build artifacts (`.gitkeep` tracked), legacy `web/maze.*`.

## End-to-end workflow (copy-paste)

One session from zero to a Sentry test crash. Run each step in order (see [Quick reference](#quick-reference) for shortcuts).

**Step 1.** Emscripten + repo root

```bash
source ~/dev/emsdk/emsdk_env.sh
cd /path/to/sentry-wasm-emscripten
```

**Step 2.** Build wasm (both variants — default URL and `?symbols=0`)

```bash
make clean && make && make symbols && make no-symbols
```

`make symbols` runs `wasm-split --strip`, which moves DWARF from `maze.wasm` into `maze.debug.wasm`. Re-running split on an already-stripped wasm produces a useless debug file — `make clean` forces a fresh `-g` build first. Healthy sizes: `maze.wasm` ~26 KB, `maze.debug.wasm` ~184 KB.

`make no-symbols` is a **separate** build (no `-g`) for `?symbols=0`. `make clean` deletes both `maze.*` and `maze.nosym.*` — always re-run **both** targets after clean.

**Step 3.** Upload debug wasm to Sentry (skip for local-only play)

```bash
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm web/assets/emscripten-raycast/maze.debug.wasm
```

For **source code snippets** in the Sentry UI (not just file:line in the stack), add `--include-sources` — paths must match the DWARF paths on disk (build and upload on the same machine):

```bash
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm --include-sources web/assets/emscripten-raycast/maze.debug.wasm
```

Optional: `--wait` blocks until Sentry finishes processing (slower, but surfaces upload errors immediately).

Requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in `web/.env` (see `.env.example`).  
`sentry-cli` does not read `.env` automatically — `source` exports the vars for that shell.

**Step 4.** Bundle JS (`SENTRY_DSN` from `web/.env` is baked in at build time)

```bash
cd web
npm install
npm run build:js
cd ..
```

**Step 5.** Serve static files

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/web/](http://localhost:8080/web/) (no query params). Hard-refresh after rebuilds. Click **WASM deep crash**.

Re-run step **2** and step **3** after any C++ change (`debug_id` changes per build).

## Harness URL params

Requires **`make symbols`** for default / `?symbols=1`, and **`make no-symbols`** for `?symbols=0`. See [Build & run](#build--run).

| Param | Values | Default | Needs |
| --- | --- | --- | --- |
| `backend` | `emscripten-raycast`, `emscripten-opengl`, `rust` | `emscripten-raycast` | backend build (raycast only today) |
| `load` | `streaming`, `instantiate`, `default` | `streaming` | `maze.*` or `maze.nosym.*` per `symbols` |
| `symbols` | `1` / `0` | `1` | `make symbols` / `make no-symbols` |

Examples (use **`&`** between params, one value each — not `|`):

- [http://localhost:8080/web/?load=instantiate](http://localhost:8080/web/?load=instantiate)
- [http://localhost:8080/web/?symbols=0](http://localhost:8080/web/?symbols=0)
- [http://localhost:8080/web/?backend=rust](http://localhost:8080/web/?backend=rust) (stub)

Invalid values (e.g. `?load=streaming|instantiate|default`) fail fast with a red error under the canvas instead of loading silently.

## Build variants (emscripten-raycast)

Run **both** after `make clean` so every harness URL works:

```bash
make clean && make && make symbols && make no-symbols
```

| Target | Output | `-g` | Harness / Sentry |
| --- | --- | --- | --- |
| `make` + `make symbols` | `maze.js`, `maze.wasm`, `maze.debug.wasm` | yes | Default `/web/`, all `?load=` modes with `symbols=1`; upload debug wasm for Sentry file:line |
| `make no-symbols` | `maze.nosym.js`, `maze.nosym.wasm` | no | `?symbols=0` only — wasm offsets in console and Sentry |

C++ flags: `-g`, `-O2`, `-Wl,--build-id`, `-fno-optimize-sibling-calls`.

## Debug symbols

Always build from a clean fat wasm before splitting:

```bash
make clean && make && make symbols && make no-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm web/assets/emscripten-raycast/maze.debug.wasm
```

With source bundles (Sentry UI code snippet panel — reads `.cpp` paths from debug info on your filesystem):

```bash
make clean && make && make symbols && make no-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm --include-sources web/assets/emscripten-raycast/maze.debug.wasm
```

Requires [wasm-split](https://github.com/getsentry/symbolicator/tree/master/crates/wasm-split).

Upload success looks like: `UPLOADED ... (maze.debug.wasm; wasm32 library)`.

## Verify symbolication

1. `SENTRY_DSN` in `web/.env`, `npm run build:js`
2. `make clean && make && make symbols && make no-symbols`, upload debug wasm (with `source web/.env` — see above)
3. Open `/web/` (not `?symbols=0`, not `?load=instantiate`), click **WASM deep crash**

In the Sentry issue, check:

- `debug_meta.images[0].debug_status` → `found`
- WASM frames with `addr_mode`, function names like `chaos_deep1`

**What to expect today:** upload + SDK usually give **function names** (`chaos_deep1`, `trigger_crash_deep`) at `maze.wasm`. **C++ file:line** (`chaos_deep1.cpp:42`) may not appear — the split debug file often has symbols but not line-level DWARF (`has_debug_info: false` in issue JSON). That is a build/debug-artifact limitation, not a failed upload.

Use default URL `/web/` with badge `symbols=on` · `load=streaming` for symbolication checks.

## Adding a backend

1. Implement under `backends/<name>/`, output to `web/assets/<name>/`
2. Add runner in `web/backends/<name>.js` exporting `start(config)`
3. Register in `web/harness/config.js`
4. Reuse `web/harness/sentry-tests.js` for crash buttons

## Controls

WASD or arrows. Collect all keys, exit bottom-right.

## Quick reference

**Fresh local run** — play the game in the browser; crashes stay local (Sentry may get events if `SENTRY_DSN` is set, but stacks won’t show C++ file:line without upload)

```bash
make clean && make && make symbols && make no-symbols
cd web && npm run build:js && cd ..
python3 -m http.server 8080
```

→ http://localhost:8080/web/ · hard-refresh after rebuilds

**Test Sentry stacks** — full local run **and** send the debug map to Sentry so issues show symbolicated wasm frames (`chaos_deep1`, etc.)

```bash
make clean && make && make symbols && make no-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm web/assets/emscripten-raycast/maze.debug.wasm
cd web && npm run build:js && cd ..
python3 -m http.server 8080
```

→ open `/web/` · click **WASM deep crash** · check Sentry Issues

**Only changed JS / harness / HTML / CSS**

```bash
cd web && npm run build:js && cd ..
```

→ hard-refresh · no `make`, no upload

**Changed C++**

```bash
make clean && make && make symbols && make no-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm web/assets/emscripten-raycast/maze.debug.wasm
cd web && npm run build:js && cd ..
```

→ re-upload required (`debug_id` changes every wasm build)

**README only** — nothing to rebuild
