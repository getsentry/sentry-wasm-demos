EMCC ?= emcc
WASM_SPLIT ?= $(shell \
	if command -v wasm-split >/dev/null 2>&1; then command -v wasm-split; \
	elif test -x "$(HOME)/.cargo/bin/wasm-split"; then echo "$(HOME)/.cargo/bin/wasm-split"; \
	elif test -x ../../../bin/wasm-split; then echo ../../../bin/wasm-split; \
	else echo wasm-split; fi)

SRC_DIR = src
OUT_DIR = ../../web/assets/emscripten-raycast

SRC = $(SRC_DIR)/main.cpp $(SRC_DIR)/maze.cpp $(SRC_DIR)/raycast.cpp $(SRC_DIR)/game.cpp $(SRC_DIR)/minimap.cpp \
	$(SRC_DIR)/chaos/chaos.cpp $(SRC_DIR)/chaos/chaos_divzero.cpp \
	$(SRC_DIR)/chaos/chaos_deep1.cpp $(SRC_DIR)/chaos/chaos_deep2.cpp $(SRC_DIR)/chaos/chaos_deep3.cpp \
	$(SRC_DIR)/chaos/chaos_deep4.cpp $(SRC_DIR)/chaos/chaos_deep5.cpp

OUT_JS = $(OUT_DIR)/maze.js
OUT_WASM = $(OUT_DIR)/maze.wasm
DEBUG_WASM = $(OUT_DIR)/maze.debug.wasm
OUT_JS_NO_SYMBOLS = $(OUT_DIR)/maze.nosym.js
OUT_WASM_NO_SYMBOLS = $(OUT_DIR)/maze.nosym.wasm

EXPORTED_FUNCTIONS = \
	["_malloc","_free","_init_game","_handle_key","_step_game","_player_key_count",\
	"_keys_required","_game_won","_get_level","_render_frame","_get_width","_get_height",\
	"_get_pixel_buffer_ptr","_trigger_crash_divzero","_trigger_crash_deep"]

EMCC_FLAGS_COMMON = \
	-O2 \
	-fno-optimize-sibling-calls \
	-Wl,--build-id \
	-std=c++17 \
	-s MODULARIZE=1 \
	-s EXPORT_NAME=createMazeModule \
	-s EXPORTED_FUNCTIONS='$(EXPORTED_FUNCTIONS)' \
	-s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","HEAPU8"]' \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s ENVIRONMENT=web

EMCC_FLAGS = -g $(EMCC_FLAGS_COMMON)
EMCC_FLAGS_NO_SYMBOLS = $(EMCC_FLAGS_COMMON)

.PHONY: all no-symbols symbols clean

all: $(OUT_JS)

$(OUT_DIR):
	mkdir -p $(OUT_DIR)

$(OUT_JS): $(SRC) | $(OUT_DIR)
	$(EMCC) $(EMCC_FLAGS) $(SRC) -o $(OUT_JS)

$(OUT_JS_NO_SYMBOLS): $(SRC) | $(OUT_DIR)
	$(EMCC) $(EMCC_FLAGS_NO_SYMBOLS) $(SRC) -o $(OUT_JS_NO_SYMBOLS)

no-symbols: $(OUT_JS_NO_SYMBOLS)
	@echo ""
	@echo "Built without -g: $(OUT_JS_NO_SYMBOLS) + $(OUT_WASM_NO_SYMBOLS)"
	@echo "Open with ?symbols=0 (default harness uses symbolicated build)."
	@echo ""

symbols: all
	@test -x "$(WASM_SPLIT)" || ( \
		echo "wasm-split not found at '$(WASM_SPLIT)'."; \
		echo "Install: cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split"; \
		exit 1)
	$(WASM_SPLIT) $(OUT_WASM) -d $(DEBUG_WASM) --strip
	@echo ""
	@echo "Debug module: $(DEBUG_WASM)"
	@echo "Upload: sentry-cli debug-files upload -t wasm $(DEBUG_WASM)"
	@echo ""

clean:
	rm -f $(OUT_DIR)/maze.js $(OUT_DIR)/maze.wasm $(OUT_DIR)/maze.debug.wasm \
		$(OUT_DIR)/maze.nosym.js $(OUT_DIR)/maze.nosym.wasm
