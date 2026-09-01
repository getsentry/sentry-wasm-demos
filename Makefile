.PHONY: all no-symbols symbols clean emscripten-raycast emscripten-opengl rust rust-symbols rust-no-symbols full split sourcemap

all emscripten-raycast:
	$(MAKE) -C backends/emscripten-raycast all

full:
	$(MAKE) -C backends/emscripten-raycast full

split:
	$(MAKE) -C backends/emscripten-raycast split

sourcemap:
	$(MAKE) -C backends/emscripten-raycast sourcemap

emscripten-opengl:
	$(MAKE) -C backends/emscripten-opengl all

rust:
	$(MAKE) -C backends/rust all

rust-symbols:
	$(MAKE) -C backends/rust symbols

no-symbols:
	$(MAKE) -C backends/emscripten-raycast no-symbols
	$(MAKE) -C backends/emscripten-opengl no-symbols

rust-no-symbols:
	$(MAKE) -C backends/rust no-symbols

symbols:
	$(MAKE) -C backends/emscripten-raycast symbols
	$(MAKE) -C backends/emscripten-opengl symbols

clean:
	$(MAKE) -C backends/emscripten-raycast clean
	$(MAKE) -C backends/emscripten-opengl clean
	$(MAKE) -C backends/rust clean
