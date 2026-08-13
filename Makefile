EMCC ?= emcc
# emsdk_env.sh resets PATH and drops ~/.cargo/bin — resolve wasm-split explicitly.
WASM_SPLIT ?= $(shell \
	if command -v wasm-split >/dev/null 2>&1; then command -v wasm-split; \
	elif test -x "$(HOME)/.cargo/bin/wasm-split"; then echo "$(HOME)/.cargo/bin/wasm-split"; \
	elif test -x bin/wasm-split; then echo bin/wasm-split; \
	else echo wasm-split; fi)

SRC = cpp/main.cpp cpp/maze.cpp cpp/raycast.cpp cpp/game.cpp cpp/minimap.cpp \
	cpp/chaos/chaos.cpp cpp/chaos/chaos_divzero.cpp \
	cpp/chaos/chaos_deep1.cpp cpp/chaos/chaos_deep2.cpp cpp/chaos/chaos_deep3.cpp \
	cpp/chaos/chaos_deep4.cpp cpp/chaos/chaos_deep5.cpp
OUT_JS = web/maze.js
OUT_WASM = web/maze.wasm
DEBUG_WASM = web/maze.debug.wasm
OUT_JS_NO_SYMBOLS = web/maze.nosym.js
OUT_WASM_NO_SYMBOLS = web/maze.nosym.wasm

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

# Default build: -g embeds DWARF for symbolication (make symbols + sentry-cli upload).
EMCC_FLAGS = -g $(EMCC_FLAGS_COMMON)

# No -g: no DWARF to split or upload — compare unsymbolicated Sentry stacks.
EMCC_FLAGS_NO_SYMBOLS = $(EMCC_FLAGS_COMMON)

.PHONY: all no-symbols symbols clean

all: $(OUT_JS)

$(OUT_JS): $(SRC)
	$(EMCC) $(EMCC_FLAGS) $(SRC) -o $(OUT_JS)

$(OUT_JS_NO_SYMBOLS): $(SRC)
	$(EMCC) $(EMCC_FLAGS_NO_SYMBOLS) $(SRC) -o $(OUT_JS_NO_SYMBOLS)

no-symbols: $(OUT_JS_NO_SYMBOLS)
	@echo ""
	@echo "Built without -g: $(OUT_JS_NO_SYMBOLS) + $(OUT_WASM_NO_SYMBOLS)"
	@echo "Switch index.html to maze.nosym.js and main.js WASM_URL to maze.nosym.wasm"
	@echo "Do not run make symbols — no DWARF to upload. Expect wasm offsets in Sentry."
	@echo ""

symbols: all
	@test -x "$(WASM_SPLIT)" || ( \
		echo "wasm-split not found at '$(WASM_SPLIT)'."; \
		echo "Install: cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split"; \
		echo "Or download: https://github.com/getsentry/symbolicator/releases (wasm-split-Darwin-universal) → bin/wasm-split"; \
		exit 1)
	$(WASM_SPLIT) $(OUT_WASM) -d $(DEBUG_WASM) --strip
	@echo ""
	@echo "Debug module: $(DEBUG_WASM)"
	@echo "Upload to Sentry:"
	@echo "  sentry-cli debug-files upload -t wasm $(DEBUG_WASM)"
	@echo ""
	@echo "Set SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in web/.env (see web/.env.example)."

clean:
	rm -f $(OUT_JS) $(OUT_WASM) $(DEBUG_WASM) $(OUT_JS_NO_SYMBOLS) $(OUT_WASM_NO_SYMBOLS)
