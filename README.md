# WASM demos · Sentry

Multi-backend harness for testing `@sentry/browser` + `@sentry/wasm` across toolchains.

**Live today:** Emscripten CPU raycast maze · Emscripten WebGL 3D maze · Rust wasm-bindgen crashes

Same web page, same Sentry test buttons — swap WASM backend via URL.

## Repo layout

```text
backends/
  emscripten-raycast/   C++ CPU raycast → web/assets/emscripten-raycast/
  emscripten-opengl/    WebGL 3D maze → web/assets/emscripten-opengl/
  rust/                 wasm-bindgen crash demo → web/assets/rust/
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
make clean && make && cd web && npm install && npm run build:js && cd ..
python3 -m http.server 8080
```

`make` builds three coverage-matrix variants for **emscripten-raycast** (same C++ crash buttons):

| `?build=` | Makefile target | Browser wasm | Upload to Sentry |
|-----------|-----------------|--------------|------------------|
| `full` | `make full` | `maze.full.wasm` (DWARF inside) | same file |
| `split` (default) | `make split` | `maze.split.wasm` (stripped) | `maze.split.debug.wasm` (`-gseparate-dwarf` at link) |
| `sourcemap` | `make sourcemap` | `maze.sourcemap.wasm` | TBD — `-O2 -gsource-map` |

Events are tagged `wasm.build=full|split|sourcemap` for matrix filtering.


| Build target            | Artifacts                                 | Used when                                    |
| ----------------------- | ----------------------------------------- | -------------------------------------------- |
| `make` + `make symbols` | `maze.js`, `maze.wasm`, `maze.debug.wasm` | Default `/web/`, `?symbols=1`, Sentry upload |
| `make no-symbols`       | `maze.nosym.js`, `maze.nosym.wasm`        | `?symbols=0` only                            |


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

`make no-symbols` compiles with `-g` then **links without** `-g`, so emcc strips DWARF from `maze.nosym.wasm` (`?symbols=0`). `make clean` deletes both `maze.`* and `maze.nosym.*` — always re-run **both** targets after clean.

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

Requires `make symbols` for default / `?symbols=1`, and `make no-symbols` for `?symbols=0`. See [Build & run](#build--run).


| Param     | Values                                            | Default              | Needs                                    |
| --------- | ------------------------------------------------- | -------------------- | ---------------------------------------- |
| `backend` | `emscripten-raycast`, `emscripten-opengl`, `rust` | `emscripten-raycast` | backend build |
| `build`   | `full`, `split`, `sourcemap`                      | `split`              | emscripten-raycast only (`make` targets) |
| `load`    | `streaming`, `non-streaming`, `default` (all backends) | `streaming`          | per `build` / `symbols`                  |
| `symbols` | `1` / `0`                                         | `1`                  | `make no-symbols` for `?symbols=0`       |


Examples (use `&` between params, one value each — not `|`):

- [http://localhost:8080/web/?load=non-streaming](http://localhost:8080/web/?load=non-streaming)
- [http://localhost:8080/web/?symbols=0](http://localhost:8080/web/?symbols=0)
- [http://localhost:8080/web/?backend=emscripten-opengl](http://localhost:8080/web/?backend=emscripten-opengl)
- [http://localhost:8080/web/?backend=rust](http://localhost:8080/web/?backend=rust)

Invalid values (e.g. `?load=streaming|non-streaming|default`) fail fast with a red error under the canvas instead of loading silently.

## Build variants (emscripten-raycast)

Run **both** after `make clean` so every harness URL works:

```bash
make clean && make && make symbols && make no-symbols
```


| Target                  | Output                                    | `-g` | Harness / Sentry                                                                             |
| ----------------------- | ----------------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| `make` + `make symbols` | `maze.js`, `maze.wasm`, `maze.debug.wasm` | yes  | Default `/web/`, all `?load=` modes with `symbols=1`; upload debug wasm for Sentry file:line |
| `make no-symbols`       | `maze.nosym.js`, `maze.nosym.wasm`        | compile only | `?symbols=0` — objects have DWARF, link strips it; wasm offsets in console and Sentry |


C++ flags: `-g`, `-O2`, `-Wl,--build-id`, `-fno-optimize-sibling-calls`. `no-symbols` uses `-g` only at compile (`-c`), not at link.

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
3. Open `/web/` (not `?symbols=0`, not `?load=non-streaming`), click **WASM deep crash**

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
cd web && npm run build:js && npm run upload:sourcemaps && cd ..
python3 -m http.server 8080
```

→ [http://localhost:8080/web/](http://localhost:8080/web/) · hard-refresh after rebuilds

**Test Sentry stacks** — full local run **and** send the debug map to Sentry so issues show symbolicated wasm frames (`chaos_deep1`, etc.)

```bash
make clean && make && make symbols && make no-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm web/assets/emscripten-raycast/maze.debug.wasm
cd web && npm run build:js && npm run upload:sourcemaps && cd ..
python3 -m http.server 8080
```

→ open `/web/` · click **WASM deep crash** · check Sentry Issues

**Only changed JS / harness / HTML / CSS**

```bash
cd web && npm run build:js && npm run upload:sourcemaps && cd ..
```

→ hard-refresh · no `make`, no upload

**Changed C++**

```bash
make clean && make && make symbols && make no-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm web/assets/emscripten-raycast/maze.debug.wasm
cd web && npm run build:js && npm run upload:sourcemaps && cd ..
```

→ re-upload required (`debug_id` changes every wasm build)

**Changed Rust**

```bash
make -C backends/rust clean && make rust && make rust-symbols && make rust-no-symbols
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm --include-sources web/assets/rust/demo.debug.wasm
cd web && npm run build:js && npm run upload:sourcemaps && cd ..
```

→ open `?backend=rust` · re-upload required (`debug_id` changes every wasm build)

**README only** — nothing to rebuild

## End-to-end workflow · Rust (copy-paste)

Same steps as [Emscripten workflow](#end-to-end-workflow-copy-paste) — different toolchain, build, upload, and URL.

**One-time setup**

```bash
# Install Rust if needed: https://rustup.rs
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
# Same as Emscripten — splits DWARF for Sentry upload
cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split
```

**Step 1.** Repo root

```bash
cd /path/to/sentry-wasm-emscripten
```

**Step 2.** Build wasm

```bash
make -C backends/rust clean && make rust && make rust-symbols && make rust-no-symbols
```

`make rust-symbols` runs `wasm-split --strip` (same as Emscripten): DWARF moves into `demo.debug.wasm`, browser loads stripped `demo_bg.wasm`. Requires `dwarf-debug-info = true` in `Cargo.toml` so bindgen keeps DWARF. Upload `demo.debug.wasm`, not `demo_bg.wasm`.

**Step 3.** Upload debug wasm + sources (skip for local-only)

```bash
set -a && source web/.env && set +a
sentry-cli debug-files upload -t wasm --include-sources web/assets/rust/demo.debug.wasm
```

**Step 4.** Bundle JS and upload source maps (for harness frames in `sentry-tests.js`, etc.)

```bash
cd web
npm install
npm run build:js
npm run upload:sourcemaps
cd ..
```

JS stacks use `SENTRY_RELEASE` + `SENTRY_URL_PREFIX` from `web/.env` (default `http://localhost:8080/web/`). Re-run after every `build:js`. Wasm frames still need step 3.
```

**Step 5.** Serve

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/web/?backend=rust](http://localhost:8080/web/?backend=rust). Hard-refresh. Click **WASM deep crash**.

Re-run step **2** and step **3** after any Rust change.

Release-debug with symbolication: `?backend=rust&build=release-debug` (`make rust-release-debug && make rust-release-debug-symbols`, upload `demo_release.debug.wasm`).

Release-stripped negative control (`debuginfo=0` only): `?backend=rust&build=release-stripped` (`make rust-no-symbols`, no upload).