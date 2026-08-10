# Raycaster Maze (Emscripten)

Browser raycaster maze written in C++17 and compiled to WebAssembly with Emscripten. No external C++ libraries or image assets — rendering uses a shared RGBA pixel buffer that JavaScript blits to a `<canvas>`.

## Prerequisites

- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) (`emcc` on your `PATH`)
- Python 3 (for a local static file server)

Activate emsdk before building:

```bash
source /path/to/emsdk/emsdk_env.sh
```

## Project layout

```
cpp/maze.{h,cpp}       — 16×16 grid, key/door/exit cells
cpp/raycast.{h,cpp}    — DDA raycasting + distance fog
cpp/minimap.{h,cpp}    — 128×128 HUD minimap overlay
cpp/game.{h,cpp}       — player, input, collision, game loop
cpp/main.cpp           — Emscripten exports
web/index.html         — page shell, win overlay, regenerate button
web/main.js            — WASM load, input, rAF loop
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

```bash
make clean   # remove build artifacts
```

Build flags include `-g`, `-O2`, and `-Wl,--build-id` for later Sentry symbolication.

## Run

From the project root:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/web/](http://localhost:8080/web/).

## Controls

| Input | Action |
| --- | --- |
| **W / S** | Move forward / backward |
| **A / D** | Strafe left / right |
| **← / →** | Turn left / right |
| **↑ / ↓** | Move forward / backward |
| **Regenerate maze** | New random seed, restart |

Pick up the **key** (cyan on minimap), pass through the **door** (magenta), reach the **exit** (yellow tile in the southeast corner, against the outer wall) to trigger **Escaped!**

## Minimap (top-right)

| Color | Meaning |
| --- | --- |
| Grey | Wall |
| Dark | Walkable floor |
| Green dot | Player (tip = facing) |
| Cyan | Key |
| Magenta | Door |
| Yellow | Exit |

## Screenshot

<!-- Add docs/screenshot.png after capturing gameplay -->

_Screenshot placeholder: capture a first-person frame with the minimap visible and add it as `docs/screenshot.png`._

## Exported WASM API

| Function | Purpose |
| --- | --- |
| `init_game(seed)` | Reset maze, player, and framebuffer |
| `handle_key(code, down)` | Track WASD / arrow keys |
| `step_game(dt_ms)` | Move player with wall collision |
| `render_frame()` | Raycast + minimap into RGBA buffer |
| `player_has_key()` | `1` if key collected |
| `game_won()` | `1` if player reached exit |
| `get_width()` / `get_height()` | 640 / 480 |
| `get_pixel_buffer_ptr()` | Pointer into `HEAPU8` |

## Next steps

- Seeded procedural maze generation (recursive backtracker)
- Sentry WASM integration for crash reporting and symbolication
