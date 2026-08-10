# Raycaster Maze (Emscripten)

C++17 raycaster → WebAssembly. JavaScript draws the pixel buffer on a `<canvas>`.

## Build & run

```bash
source /path/to/emsdk/emsdk_env.sh
make
python3 -m http.server 8080
```

Open [http://localhost:8080/web/](http://localhost:8080/web/). Hard-refresh after rebuilds.

Build uses `-g`, `-O2`, `-Wl,--build-id` (needed for Sentry symbolication).

## Files (what each one is)

| File | Role |
| --- | --- |
| `cpp/*.cpp` | Game in C++ |
| `cpp/main.cpp` | Functions exported to JS (`init_game`, `step_game`, …) |
| `web/maze.wasm` | Compiled game (binary) |
| `web/maze.js` | Emscripten glue (generated — don't edit) |
| `web/main.js` | Loads wasm + runs the game loop |

## How the page loads (simple)

```
index.html
  ├── maze.js          adds createMazeModule() to the page
  └── main.js
        ├── loadWasm()           fetch maze.wasm → instantiateStreaming
        └── game loop            mod._step_game / _render_frame → canvas
```

## WASM + Sentry — what works / what doesn't

**Goal:** when wasm crashes, Sentry shows a readable stack trace (function names, not just `0x1234`).

| | |
| --- | --- |
| **Works ✅** | `WebAssembly.instantiateStreaming(fetch(url), …)` — browser keeps `url` |
| **Works ✅** | Serve `maze.wasm` as `Content-Type: application/wasm` |
| **Works ✅** | Build with `-Wl,--build-id` (already in Makefile) |
| **Works ✅** | Stable URL: `http://localhost:8080/web/maze.wasm` (= Sentry `code_file`) |
| **Works ✅** | Init `@sentry/wasm` **before** wasm loads (patches `instantiateStreaming`) |
| **Fails ❌** | `fetch` → `arrayBuffer` → `WebAssembly.instantiate` (no URL for Sentry) |
| **Fails ❌** | Wrong MIME type → streaming fails |
| **Fails ❌** | No debug symbols uploaded to Sentry for that wasm URL + build id |

**Where in code:** `web/main.js` → `loadWasm()` → `WASM_URL` + `instantiateStreaming`.

Console should show: `wasm loaded { url: "…/web/maze.wasm", instance: … }`.

## C++ → JS API

Called as `mod._function_name()` from JavaScript:

| C export | Does |
| --- | --- |
| `init_game(seed, level)` | New maze |
| `handle_key(code, down)` | Keyboard |
| `step_game(dt_ms)` | Movement |
| `render_frame()` | Draw frame into wasm memory |
| `get_pixel_buffer_ptr()` | Where pixels live (`mod.HEAPU8`) |
| `player_key_count()` / `keys_required()` | Key progress |
| `game_won()` | Win flag |

## Controls

WASD or arrows to move/turn. Collect all keys, then reach the exit (bottom-right). **Regenerate** = new maze, same level. **Next level** after win.

## Next step

Add `@sentry/browser` + `@sentry/wasm`, call `Sentry.init({ integrations: [wasmIntegration()] })` in `main.js` **before** `loadWasm()`.
