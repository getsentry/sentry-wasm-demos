# Emscripten · WebGL 3D maze

Same maze game logic as `emscripten-raycast`, but rendering uses **WebGL 2** (GLES3) wall quads instead of a CPU pixel buffer.

## Build

From repo root (with `emsdk` activated):

```bash
make emscripten-opengl
make -C backends/emscripten-opengl symbols
make -C backends/emscripten-opengl no-symbols
```

Outputs land in `web/assets/emscripten-opengl/`:

- `maze.js` + `maze.wasm` — symbolicated (`-g`)
- `maze.nosym.js` + `maze.nosym.wasm` — `make no-symbols` (compile `-g`, link without)

## Source layout

```text
src/
  main.cpp        exports + GL init
  game.cpp        player / keys / win (shared logic with raycast)
  maze.cpp        maze generation
  gl_render.cpp   3D world (walls, floor, ceiling, key markers)
  gl_minimap.cpp  2D overlay minimap
  chaos/          Sentry crash scenarios (divzero, deep stack)
```

## Harness

Open `/web/?backend=emscripten-opengl`. Same URL params as raycast:

- `?symbols=0` — nosym build
- `?load=streaming` (default) · `?load=instantiate` · `?load=default`

The JS runner passes the shared `#screen` canvas to Emscripten so GL draws directly — no `putImageData`.

## Emscripten flags

- `-s USE_WEBGL2=1` · `-s FULL_ES3=1` · `-s MIN_WEBGL_VERSION=2`
- Same `-Wl,--build-id` and chaos exports as raycast backend
