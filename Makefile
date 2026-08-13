.PHONY: all no-symbols symbols clean emscripten-raycast

all emscripten-raycast:
	$(MAKE) -C backends/emscripten-raycast all

no-symbols:
	$(MAKE) -C backends/emscripten-raycast no-symbols

symbols:
	$(MAKE) -C backends/emscripten-raycast symbols

clean:
	$(MAKE) -C backends/emscripten-raycast clean
