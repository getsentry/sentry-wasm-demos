.PHONY: all no-symbols symbols clean emscripten-raycast emscripten-opengl rust rust-release-debug rust-symbols \
	rust-release-debug-symbols rust-no-symbols js-sourcemaps full split sourcemap symtab unity unity-one

all emscripten-raycast:
	$(MAKE) -C backends/emscripten-raycast all

full:
	$(MAKE) -C backends/emscripten-raycast full

split:
	$(MAKE) -C backends/emscripten-raycast split

sourcemap:
	$(MAKE) -C backends/emscripten-raycast sourcemap

symtab:
	$(MAKE) -C backends/emscripten-raycast symtab

emscripten-opengl:
	$(MAKE) -C backends/emscripten-opengl all

rust:
	$(MAKE) -C backends/rust all

rust-release-debug:
	$(MAKE) -C backends/rust release-debug

rust-symbols:
	$(MAKE) -C backends/rust symbols

rust-release-debug-symbols:
	$(MAKE) -C backends/rust release-debug-symbols

no-symbols:
	$(MAKE) -C backends/emscripten-raycast no-symbols
	$(MAKE) -C backends/emscripten-opengl no-symbols

rust-no-symbols:
	$(MAKE) -C backends/rust no-symbols

unity:
	$(MAKE) -C backends/unity

unity-one:
	$(MAKE) -C backends/unity unity-one MODE=$(or $(MODE),full-stack)

js-sourcemaps:
	cd web && npm run build:js && npm run upload:sourcemaps

symbols:
	$(MAKE) -C backends/emscripten-raycast symbols
	$(MAKE) -C backends/emscripten-opengl symbols

clean:
	$(MAKE) -C backends/emscripten-raycast clean
	$(MAKE) -C backends/emscripten-opengl clean
	$(MAKE) -C backends/rust clean
	$(MAKE) -C backends/unity clean
