.PHONY: all no-symbols symbols clean emscripten-raycast rust rust-symbols rust-no-symbols

all emscripten-raycast:
	$(MAKE) -C backends/emscripten-raycast all

rust:
	$(MAKE) -C backends/rust all

rust-symbols:
	$(MAKE) -C backends/rust symbols

no-symbols:
	$(MAKE) -C backends/emscripten-raycast no-symbols

rust-no-symbols:
	$(MAKE) -C backends/rust no-symbols

symbols:
	$(MAKE) -C backends/emscripten-raycast symbols

clean:
	$(MAKE) -C backends/emscripten-raycast clean
	$(MAKE) -C backends/rust clean
