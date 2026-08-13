WASM_PACK ?= wasm-pack
WASM_SPLIT ?= $(shell \
	if command -v wasm-split >/dev/null 2>&1; then command -v wasm-split; \
	elif test -x "$(HOME)/.cargo/bin/wasm-split"; then echo "$(HOME)/.cargo/bin/wasm-split"; \
	elif test -x ../../../bin/wasm-split; then echo ../../../bin/wasm-split; \
	else echo wasm-split; fi)

OUT_DIR = ../../web/assets/rust
PKG_DIR = $(OUT_DIR)/pkg
DEBUG_WASM = $(OUT_DIR)/demo.debug.wasm

.PHONY: all no-symbols symbols clean

all: $(OUT_DIR)/demo.js

$(OUT_DIR):
	mkdir -p $(OUT_DIR)

$(OUT_DIR)/demo.js: src/lib.rs Cargo.toml | $(OUT_DIR)
	@command -v $(WASM_PACK) >/dev/null 2>&1 || ( \
		echo "wasm-pack not found. Install: cargo install wasm-pack"; \
		exit 1; \
	)
	$(WASM_PACK) build --target web --dev --out-name demo --out-dir $(PKG_DIR)
	cp $(PKG_DIR)/demo.js $(OUT_DIR)/demo.js
	cp $(PKG_DIR)/demo_bg.wasm $(OUT_DIR)/demo_bg.wasm
	@rm -rf $(PKG_DIR)
	@echo ""
	@echo "Built: $(OUT_DIR)/demo.js + demo_bg.wasm (run 'make symbols' to split DWARF for Sentry)"

no-symbols: $(OUT_DIR)/demo_nosym.js

$(OUT_DIR)/demo_nosym.js: src/lib.rs Cargo.toml | $(OUT_DIR)
	@command -v $(WASM_PACK) >/dev/null 2>&1 || ( \
		echo "wasm-pack not found. Install: cargo install wasm-pack"; \
		exit 1; \
	)
	$(WASM_PACK) build --target web --release --out-name demo_nosym --out-dir $(PKG_DIR)
	cp $(PKG_DIR)/demo_nosym.js $(OUT_DIR)/demo_nosym.js
	cp $(PKG_DIR)/demo_nosym_bg.wasm $(OUT_DIR)/demo_nosym_bg.wasm
	@rm -rf $(PKG_DIR)
	@echo ""
	@echo "Built: $(OUT_DIR)/demo_nosym.js + demo_nosym_bg.wasm"

symbols: all
	@test -x "$(WASM_SPLIT)" || ( \
		echo "wasm-split not found at '$(WASM_SPLIT)'."; \
		echo "Install: cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split"; \
		exit 1)
	$(WASM_SPLIT) $(OUT_DIR)/demo_bg.wasm -d $(DEBUG_WASM) --strip
	@echo ""
	@echo "Debug module: $(DEBUG_WASM)"
	@echo "Upload: sentry-cli debug-files upload -t wasm --include-sources $(DEBUG_WASM)"
	@echo ""

clean:
	rm -rf $(OUT_DIR)/demo.js $(OUT_DIR)/demo_bg.wasm $(OUT_DIR)/demo.debug.wasm \
		$(OUT_DIR)/demo_nosym.js $(OUT_DIR)/demo_nosym_bg.wasm $(PKG_DIR) target
