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
cpp/maze.{h,cpp}       — seeded recursive-backtracker maze + key/door/exit
cpp/raycast.{h,cpp}    — DDA raycasting + distance fog
cpp/minimap.{h,cpp}    — 128×128 HUD minimap overlay
cpp/game.{h,cpp}       — player, input, collision, game loop
cpp/main.cpp           — Emscripten exports
web/index.html         — page shell, win overlay, regenerate button
web/main.js            — WASM load, input, rAF loop, level progression
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

```bash
make clean   # remove build artifacts
```

Build flags include `-g`, `-O2`, and `-Wl,--build-id` for later Sentry symbolication.

## Run

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
| **Regenerate maze** | Same level, new random seed |
| **Next level** (after win) | Harder maze: more walls, shorter fog |

Pick up the **key** (cyan), pass the **door** (magenta), reach the **exit gap** on the **east outer wall** (yellow on minimap).

Entrance and exit appear as **holes in the border wall** in the 3D view (rays pass through — you see darkness beyond).

## Procedural generation

Each `init_game(seed, level)` call:

1. Carves a maze with **recursive backtracker** (seeded LCG shuffle)
2. Punches a **west entrance** and **east exit** gap in the outer wall
3. Places **key** and **door** along the route by BFS distance
4. Adds extra walls for higher **levels** (keeps spawn→exit reachable)

Same seed + level → same layout. Regenerate picks a new seed.

## Difficulty by level

| Level | Changes |
| --- | --- |
| 1 | Base carved maze |
| 2+ | +4 random wall attempts per level (connectivity checked) |
| 2+ | Fog visibility tightens (~0.55 cells less per level) |

## Minimap (top-right)

| Color | Meaning |
| --- | --- |
| Grey | Wall |
| Dark | Walkable floor |
| Light green | Entrance gap (west) |
| Green dot | Player (tip = facing) |
| Cyan | Key |
| Magenta | Door |
| Yellow | Exit gap (east) |

## Screenshot

<!-- Add docs/screenshot.png after capturing gameplay -->

_Screenshot placeholder: capture a first-person frame showing the east exit gap and minimap, save as `docs/screenshot.png`._

## Exported WASM API

| Function | Purpose |
| --- | --- |
| `init_game(seed, level)` | Procedural maze + reset player |
| `get_level()` | Current level |
| `handle_key(code, down)` | Track WASD / arrow keys |
| `step_game(dt_ms)` | Move player with wall collision |
| `render_frame()` | Raycast + minimap into RGBA buffer |
| `player_has_key()` | `1` if key collected |
| `game_won()` | `1` if player reached exit |
| `get_width()` / `get_height()` | 640 / 480 |
| `get_pixel_buffer_ptr()` | Pointer into `HEAPU8` |

## Next steps

- Sentry WASM integration for crash reporting and symbolication
