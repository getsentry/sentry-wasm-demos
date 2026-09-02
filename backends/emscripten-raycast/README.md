# Emscripten · CPU raycast (default)

C++17 wolfenstein-style raycaster. Renders to a CPU pixel buffer; the shared web harness draws it with `canvas.putImageData()`.

## Build

From repo root (with `emsdk` activated):

```bash
make
# or: make -C backends/emscripten-raycast all
```

Outputs land in `web/assets/emscripten-raycast/`:

- `maze.js` + `maze.wasm` — symbolicated (`-g`)
- `maze.nosym.js` + `maze.nosym.wasm` — `make no-symbols` (compile `-g`, link without)

## Source layout

```text
src/
  main.cpp      exports + game loop hooks
  raycast.cpp   CPU raycasting
  maze.cpp      maze generation
  game.cpp      player / keys / win
  minimap.cpp
  chaos/        Sentry crash scenarios (divzero, deep stack)
```

## Harness

Open `/web/` (default backend). URL overrides:

- `?symbols=0` — nosym build (`make no-symbols`)
- `?load=streaming` (default) · `?load=non-streaming` · `?load=default` — one value only; invalid params show an error on the page
