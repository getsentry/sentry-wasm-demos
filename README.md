# Raycaster Maze (Emscripten)

Browser raycaster maze written in C++17 and compiled to WebAssembly with Emscripten. Version 1 uses no external C++ libraries — rendering goes through a shared RGBA pixel buffer that JavaScript draws to a `<canvas>`.

## Prerequisites

- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) (`emcc` on your `PATH`)
- Python 3 (for a local static file server)

Activate emsdk before building:

```bash
source /path/to/emsdk/emsdk_env.sh
```

## Project layout

```
cpp/maze.{h,cpp}       — 16×16 grid + maze generation (stub)
cpp/raycast.{h,cpp}    — raycasting (stub)
cpp/game.{h,cpp}       — player state + game loop (stub)
cpp/main.cpp           — Emscripten exports
web/index.html         — page shell
web/main.js            — loads WASM, runs loop, blits to canvas
web/style.css
web/maze.js            — generated Emscripten glue (after build)
web/maze.wasm          — generated module (after build)
Makefile
```

Canvas size: **640×480**. Maze grid: **16×16** cells.

## Build

```bash
make
```

This produces `web/maze.js` and `web/maze.wasm`.

Other targets:

```bash
make clean   # remove build artifacts
```

Build flags include `-g`, `-O2`, and `-Wl,--build-id` so debug symbols and a build ID are available for later Sentry symbolication.

## Run

From the project root:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/web/](http://localhost:8080/web/).

You should see a gradient framebuffer with a pulsing top bar — stub rendering only until raycasting is implemented.

## Exported WASM API

| Function | Purpose |
| --- | --- |
| `init_game()` | Allocate framebuffer and run first frame |
| `step_game()` | Advance one frame |
| `get_width()` | Canvas width (640) |
| `get_height()` | Canvas height (480) |
| `get_pixel_buffer_ptr()` | Pointer into RGBA buffer in WASM memory |

JavaScript reads pixels via `module.HEAPU8` and `putImageData`.

## Next steps

- Implement proper maze generation (e.g. recursive backtracker)
- DDA raycasting against the grid in `raycast.cpp`
- Player movement and input from JS
- Sentry WASM integration for crash reporting and symbolication
