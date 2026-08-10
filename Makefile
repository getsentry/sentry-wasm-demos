EMCC ?= emcc

SRC = cpp/main.cpp cpp/maze.cpp cpp/raycast.cpp cpp/game.cpp
OUT_JS = web/maze.js
OUT_WASM = web/maze.wasm

EMCC_FLAGS = \
	-g \
	-O2 \
	-Wl,--build-id \
	-std=c++17 \
	-s MODULARIZE=1 \
	-s EXPORT_NAME=createMazeModule \
	-s EXPORTED_FUNCTIONS='["_malloc","_free","_init_game","_step_game","_get_width","_get_height","_get_pixel_buffer_ptr"]' \
	-s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","HEAPU8"]' \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s ENVIRONMENT=web

.PHONY: all clean

all: $(OUT_JS)

$(OUT_JS): $(SRC)
	$(EMCC) $(EMCC_FLAGS) $(SRC) -o $(OUT_JS)

clean:
	rm -f $(OUT_JS) $(OUT_WASM)
