# Emscripten · WebGL (planned)

Same maze game logic as `emscripten-raycast`, but rendering goes through **WebGL** instead of a CPU pixel buffer.

## Goal

- Reuse `src/chaos/` crash exports and Sentry test contract
- Swap `raycast.cpp` CPU buffer path for WebGL draw calls
- Output to `web/assets/emscripten-opengl/`
- Select with `?backend=emscripten-opengl`

## Stub status

Harness loads this backend id but shows “not implemented” until a Makefile and `web/backends/emscripten-opengl.js` runner exist.

## Suggested Emscripten flags (when implementing)

- `-s USE_WEBGL2=1` or `-s FULL_ES3=1` depending on target
- Same `-Wl,--build-id` and chaos exports as raycast backend
