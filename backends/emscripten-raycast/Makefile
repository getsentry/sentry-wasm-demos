EMCC ?= emcc
WASM_SPLIT ?= $(shell \
	if command -v wasm-split >/dev/null 2>&1; then command -v wasm-split; \
	elif test -x "$(HOME)/.cargo/bin/wasm-split"; then echo "$(HOME)/.cargo/bin/wasm-split"; \
	elif test -x ../../../bin/wasm-split; then echo ../../../bin/wasm-split; \
	else echo wasm-split; fi)

SRC_DIR = src
OBJ_DIR = obj
OUT_DIR = ../../web/assets/emscripten-raycast

SRC = $(SRC_DIR)/main.cpp $(SRC_DIR)/maze.cpp $(SRC_DIR)/raycast.cpp $(SRC_DIR)/game.cpp $(SRC_DIR)/minimap.cpp \
	$(SRC_DIR)/chaos/chaos.cpp $(SRC_DIR)/chaos/chaos_divzero.cpp \
	$(SRC_DIR)/chaos/chaos_deep1.cpp $(SRC_DIR)/chaos/chaos_deep2.cpp \
	$(SRC_DIR)/chaos/chaos_deep3.cpp $(SRC_DIR)/chaos/chaos_deep4.cpp \
	$(SRC_DIR)/chaos/chaos_deep5.cpp

OBJS = $(addprefix $(OBJ_DIR)/,$(notdir $(SRC:.cpp=.o)))

# Coverage-matrix variants (?build=full|split|sourcemap|symtab on emscripten-raycast)
OUT_FULL_JS = $(OUT_DIR)/maze.full.js
OUT_FULL_WASM = $(OUT_DIR)/maze.full.wasm
OUT_SPLIT_JS = $(OUT_DIR)/maze.split.js
OUT_SPLIT_WASM = $(OUT_DIR)/maze.split.wasm
OUT_SPLIT_DEBUG_WASM = $(OUT_DIR)/maze.split.debug.wasm
OUT_SOURCEMAP_JS = $(OUT_DIR)/maze.sourcemap.js
OUT_SOURCEMAP_WASM = $(OUT_DIR)/maze.sourcemap.wasm
OUT_SYMTAB_JS = $(OUT_DIR)/maze.symtab.js
OUT_SYMTAB_WASM = $(OUT_DIR)/maze.symtab.wasm

# Legacy wasm-split path (optional comparison — not used by default harness)
OUT_JS = $(OUT_DIR)/maze.js
OUT_WASM = $(OUT_DIR)/maze.wasm
DEBUG_WASM = $(OUT_DIR)/maze.debug.wasm
OUT_JS_NO_SYMBOLS = $(OUT_DIR)/maze.nosym.js
OUT_WASM_NO_SYMBOLS = $(OUT_DIR)/maze.nosym.wasm

EXPORTED_FUNCTIONS = \
	["_malloc","_free","_init_game","_handle_key","_step_game","_player_key_count",\
	"_keys_required","_game_won","_get_level","_render_frame","_get_width","_get_height",\
	"_get_pixel_buffer_ptr","_arm_crash_divzero","_arm_crash_deep"]

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

EMCC_FLAGS_DWARF = -g $(EMCC_FLAGS_COMMON)
EMCC_FLAGS_SOURCEMAP = -gsource-map $(EMCC_FLAGS_COMMON)
# Name section only (function names, no DWARF) — for prepare symtab / CLI warning tests.
EMCC_FLAGS_SYMTAB = --profiling-funcs $(EMCC_FLAGS_COMMON)
EMCC_FLAGS_NO_SYMBOLS = $(EMCC_FLAGS_COMMON)
EMCC_COMPILE_FLAGS = \
	-O2 \
	-fno-optimize-sibling-calls \
	-std=c++17

.PHONY: all full split sourcemap symtab no-symbols symbols clean legacy

all: full split sourcemap no-symbols legacy

$(OUT_DIR):
	mkdir -p $(OUT_DIR)

$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)

# ?build=full — DWARF stays in the browser wasm (upload the same .wasm file)
full: $(OUT_FULL_JS)

$(OUT_FULL_JS): $(SRC) | $(OUT_DIR)
	$(EMCC) $(EMCC_FLAGS_DWARF) $(SRC) -o $(OUT_FULL_JS)
	@echo ""
	@echo "Full DWARF: $(OUT_FULL_JS) + $(OUT_FULL_WASM)"
	@echo "Harness: ?backend=emscripten-raycast&build=full"
	@echo "Upload:  sentry-cli debug-files upload -t wasm --include-sources $(OUT_FULL_WASM)"
	@echo ""

# ?build=split — linker emits stripped wasm + separate debug wasm (-gseparate-dwarf)
split: $(OUT_SPLIT_JS)

$(OUT_SPLIT_JS): $(SRC) | $(OUT_DIR)
	$(EMCC) $(EMCC_FLAGS_DWARF) -gseparate-dwarf=$(OUT_SPLIT_DEBUG_WASM) $(SRC) -o $(OUT_SPLIT_JS)
	@echo ""
	@echo "Split (link): $(OUT_SPLIT_JS) + $(OUT_SPLIT_WASM)"
	@echo "Debug file:   $(OUT_SPLIT_DEBUG_WASM)"
	@echo "Harness: ?backend=emscripten-raycast&build=split  (default)"
	@echo "Upload:  sentry-cli debug-files upload -t wasm --include-sources $(OUT_SPLIT_DEBUG_WASM)"
	@echo ""

# ?build=sourcemap — optimized wasm + .wasm.map (Sentry may still need DWARF upload — matrix row)
sourcemap: $(OUT_SOURCEMAP_JS)

$(OUT_SOURCEMAP_JS): $(SRC) | $(OUT_DIR)
	$(EMCC) $(EMCC_FLAGS_SOURCEMAP) $(SRC) -o $(OUT_SOURCEMAP_JS)
	@echo ""
	@echo "Source map: $(OUT_SOURCEMAP_JS) + $(OUT_SOURCEMAP_WASM) (+ .wasm.map)"
	@echo "Harness: ?backend=emscripten-raycast&build=sourcemap"
	@echo "Upload:  try sentry-cli debug-files upload -t wasm $(OUT_SOURCEMAP_WASM) (map may not symbolicate in Sentry)"
	@echo ""

# ?build=symtab — wasm name section only (no DWARF); prepare skips with symtab warning
symtab: $(OUT_SYMTAB_JS)

$(OUT_SYMTAB_JS): $(SRC) | $(OUT_DIR)
	$(EMCC) $(EMCC_FLAGS_SYMTAB) $(SRC) -o $(OUT_SYMTAB_JS)
	@echo ""
	@echo "Symtab only: $(OUT_SYMTAB_JS) + $(OUT_SYMTAB_WASM)"
	@echo "Harness: ?backend=emscripten-raycast&build=symtab"
	@echo "Upload:  (symtab only — no DWARF debug file)"
	@echo ""

# Symlink legacy names to split build for older docs/scripts
legacy: split
	cp $(OUT_SPLIT_JS) $(OUT_JS)
	cp $(OUT_SPLIT_WASM) $(OUT_WASM)
	cp $(OUT_SPLIT_DEBUG_WASM) $(DEBUG_WASM)

$(OBJ_DIR)/%.o: $(SRC_DIR)/%.cpp | $(OBJ_DIR)
	$(EMCC) -c -g $(EMCC_COMPILE_FLAGS) $< -o $@

$(OBJ_DIR)/%.o: $(SRC_DIR)/chaos/%.cpp | $(OBJ_DIR)
	$(EMCC) -c -g $(EMCC_COMPILE_FLAGS) $< -o $@

$(OUT_JS_NO_SYMBOLS): $(OBJS) | $(OUT_DIR)
	$(EMCC) $(EMCC_FLAGS_NO_SYMBOLS) $(OBJS) -o $(OUT_JS_NO_SYMBOLS)

no-symbols: $(OUT_JS_NO_SYMBOLS)
	@echo ""
	@echo "Compiled -g, linked without -g: $(OUT_JS_NO_SYMBOLS) + $(OUT_WASM_NO_SYMBOLS)"
	@echo "Open with ?symbols=0."
	@echo ""

# Optional: post-link wasm-split on full DWARF (comparison vs -gseparate-dwarf)
symbols: full
	@test -x "$(WASM_SPLIT)" || ( \
		echo "wasm-split not found at '$(WASM_SPLIT)'."; \
		echo "Install: cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split"; \
		exit 1)
	$(WASM_SPLIT) $(OUT_FULL_WASM) -d $(DEBUG_WASM) --strip
	cp $(OUT_FULL_JS) $(OUT_JS)
	cp $(OUT_FULL_WASM) $(OUT_WASM)
	@echo ""
	@echo "wasm-split debug module: $(DEBUG_WASM) (from maze.full.wasm)"
	@echo "Upload: sentry-cli debug-files upload -t wasm $(DEBUG_WASM)"
	@echo ""

clean:
	rm -rf $(OBJ_DIR)
	rm -f $(OUT_DIR)/maze.full.js $(OUT_DIR)/maze.full.wasm \
		$(OUT_DIR)/maze.split.js $(OUT_DIR)/maze.split.wasm $(OUT_DIR)/maze.split.debug.wasm \
		$(OUT_DIR)/maze.sourcemap.js $(OUT_DIR)/maze.sourcemap.wasm $(OUT_DIR)/maze.sourcemap.wasm.map \
		$(OUT_DIR)/maze.symtab.js $(OUT_DIR)/maze.symtab.wasm \
		$(OUT_DIR)/maze.js $(OUT_DIR)/maze.wasm $(OUT_DIR)/maze.debug.wasm \
		$(OUT_DIR)/maze.nosym.js $(OUT_DIR)/maze.nosym.wasm
