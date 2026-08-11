EMCC ?= emcc
WASM_SPLIT ?= wasm-split

SRC = cpp/main.cpp cpp/maze.cpp cpp/raycast.cpp cpp/game.cpp cpp/minimap.cpp \
	cpp/chaos/chaos.cpp cpp/chaos/chaos_divzero.cpp \
	cpp/chaos/chaos_deep1.cpp cpp/chaos/chaos_deep2.cpp cpp/chaos/chaos_deep3.cpp \
	cpp/chaos/chaos_deep4.cpp cpp/chaos/chaos_deep5.cpp
OUT_JS = web/maze.js
OUT_WASM = web/maze.wasm
DEBUG_WASM = web/maze.debug.wasm

EXPORTED_FUNCTIONS = \
	["_malloc","_free","_init_game","_handle_key","_step_game","_player_key_count",\
	"_keys_required","_game_won","_get_level","_render_frame","_get_width","_get_height",\
	"_get_pixel_buffer_ptr","_trigger_crash_divzero","_trigger_crash_deep"]

EMCC_FLAGS = \
	-g \
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

.PHONY: all symbols clean

all: $(OUT_JS)

$(OUT_JS): $(SRC)
	$(EMCC) $(EMCC_FLAGS) $(SRC) -o $(OUT_JS)

symbols: $(OUT_WASM)
	@test -f "$(OUT_WASM)" || (echo "Run 'make' first." && exit 1)
	@command -v $(WASM_SPLIT) >/dev/null 2>&1 || ( \
		echo "wasm-split not found. Install from https://github.com/getsentry/symbolicator/tree/master/crates/wasm-split"; \
		echo "  cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split"; \
		exit 1)
	$(WASM_SPLIT) $(OUT_WASM) -d $(DEBUG_WASM) --strip
	@echo ""
	@echo "Debug module: $(DEBUG_WASM)"
	@echo "Upload to Sentry:"
	@echo "  sentry-cli debug-files upload -t wasm $(DEBUG_WASM)"
	@echo ""
	@echo "Set SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in web/.env (see web/.env.example)."

clean:
	rm -f $(OUT_JS) $(OUT_WASM) $(DEBUG_WASM)
