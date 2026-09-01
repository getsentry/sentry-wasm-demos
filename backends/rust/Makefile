WASM_PACK ?= wasm-pack
WASM_SPLIT ?= $(shell \
	if command -v wasm-split >/dev/null 2>&1; then command -v wasm-split; \
	elif test -x "$(HOME)/.cargo/bin/wasm-split"; then echo "$(HOME)/.cargo/bin/wasm-split"; \
	elif test -x ../../../bin/wasm-split; then echo ../../../bin/wasm-split; \
	else echo wasm-split; fi)

OUT_DIR = ../../web/assets/rust
PKG_DIR = $(OUT_DIR)/pkg
DEBUG_WASM = $(OUT_DIR)/demo.debug.wasm
RELEASE_DEBUG_WASM = $(OUT_DIR)/demo_release.debug.wasm

# wasm-ld embeds the build_id custom section @sentry/wasm reads as debug_id.
BUILD_ID_FLAGS = -C link-arg=--build-id
# release-stripped: isolate debuginfo=0 (no strip — wasm-split DWARF removal is separate)
NO_DEBUGINFO_FLAGS = -C debuginfo=0

.PHONY: all dev release-debug no-symbols symbols release-debug-symbols clean check-wasm-pack

all: dev

check-wasm-pack:
	@command -v $(WASM_PACK) >/dev/null 2>&1 || ( \
		echo "wasm-pack not found. Install: cargo install wasm-pack"; \
		exit 1; \
	)

$(OUT_DIR):
	mkdir -p $(OUT_DIR)

# ?backend=rust&build=dev (default) — [profile.dev] debug = 2
dev: $(OUT_DIR)/demo.js

$(OUT_DIR)/demo.js: src/lib.rs Cargo.toml | $(OUT_DIR)
	$(MAKE) check-wasm-pack
	RUSTFLAGS="$(BUILD_ID_FLAGS)" \
		$(WASM_PACK) build --target web --dev --out-name demo --out-dir $(PKG_DIR)
	cp $(PKG_DIR)/demo.js $(OUT_DIR)/demo.js
	cp $(PKG_DIR)/demo_bg.wasm $(OUT_DIR)/demo_bg.wasm
	@rm -rf $(PKG_DIR)
	@echo ""
	@echo "Dev build: $(OUT_DIR)/demo.js + demo_bg.wasm"
	@echo "Harness: ?backend=rust  (default)"
	@echo "Next:    make symbols"
	@echo ""

# ?backend=rust&build=release-debug — [profile.release] debug = true, wasm-split upload
release-debug: $(OUT_DIR)/demo_release.js

$(OUT_DIR)/demo_release.js: src/lib.rs Cargo.toml | $(OUT_DIR)
	$(MAKE) check-wasm-pack
	RUSTFLAGS="$(BUILD_ID_FLAGS)" \
		$(WASM_PACK) build --target web --release --out-name demo_release --out-dir $(PKG_DIR)
	cp $(PKG_DIR)/demo_release.js $(OUT_DIR)/demo_release.js
	cp $(PKG_DIR)/demo_release_bg.wasm $(OUT_DIR)/demo_release_bg.wasm
	@rm -rf $(PKG_DIR)
	@echo ""
	@echo "Release-debug build: $(OUT_DIR)/demo_release.js + demo_release_bg.wasm"
	@echo "Harness: ?backend=rust&build=release-debug"
	@echo "Next:    make release-debug-symbols"
	@echo ""

# ?backend=rust&build=release-stripped — release profile, rustc emits no DWARF (debuginfo=0)
no-symbols: $(OUT_DIR)/demo_nosym.js

$(OUT_DIR)/demo_nosym.js: src/lib.rs Cargo.toml | $(OUT_DIR)
	$(MAKE) check-wasm-pack
	RUSTFLAGS="$(BUILD_ID_FLAGS) $(NO_DEBUGINFO_FLAGS)" \
		$(WASM_PACK) build --target web --release --out-name demo_nosym --out-dir $(PKG_DIR)
	cp $(PKG_DIR)/demo_nosym.js $(OUT_DIR)/demo_nosym.js
	cp $(PKG_DIR)/demo_nosym_bg.wasm $(OUT_DIR)/demo_nosym_bg.wasm
	@rm -rf $(PKG_DIR)
	@echo ""
	@echo "Release-stripped build (debuginfo=0): $(OUT_DIR)/demo_nosym.js + demo_nosym_bg.wasm"
	@echo "Harness: ?backend=rust&build=release-stripped"
	@echo ""

symbols: dev
	@test -x "$(WASM_SPLIT)" || ( \
		echo "wasm-split not found at '$(WASM_SPLIT)'."; \
		echo "Install: cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split"; \
		exit 1)
	$(WASM_SPLIT) $(OUT_DIR)/demo_bg.wasm -d $(DEBUG_WASM) --strip
	@echo ""
	@echo "Debug module: $(DEBUG_WASM)"
	@echo "Upload: sentry-cli debug-files upload -t wasm --include-sources $(DEBUG_WASM)"
	@echo ""

release-debug-symbols: release-debug
	@test -x "$(WASM_SPLIT)" || ( \
		echo "wasm-split not found at '$(WASM_SPLIT)'."; \
		echo "Install: cargo install wasm-split --git https://github.com/getsentry/symbolicator.git wasm-split"; \
		exit 1)
	$(WASM_SPLIT) $(OUT_DIR)/demo_release_bg.wasm -d $(RELEASE_DEBUG_WASM) --strip
	@echo ""
	@echo "Debug module: $(RELEASE_DEBUG_WASM)"
	@echo "Upload: sentry-cli debug-files upload -t wasm --include-sources $(RELEASE_DEBUG_WASM)"
	@echo ""

clean:
	rm -rf $(OUT_DIR)/demo.js $(OUT_DIR)/demo_bg.wasm $(DEBUG_WASM) \
		$(OUT_DIR)/demo_release.js $(OUT_DIR)/demo_release_bg.wasm $(RELEASE_DEBUG_WASM) \
		$(OUT_DIR)/demo_nosym.js $(OUT_DIR)/demo_nosym_bg.wasm \
		$(OUT_DIR)/demo_release_stripped.js $(OUT_DIR)/demo_release_stripped_bg.wasm $(PKG_DIR) target
