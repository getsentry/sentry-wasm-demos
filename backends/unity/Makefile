.PHONY: all clean unity unity-one

UNITY_DEFAULT := /Applications/Unity/Hub/Editor/2022.3.50f1/Unity.app/Contents/MacOS/Unity
UNITY ?= $(UNITY_DEFAULT)

# Ignore a stale UNITY=/opt/homebrew/... from unity-cli if the binary is not there.
ifeq ($(wildcard $(UNITY)),)
  ifneq ($(wildcard $(UNITY_DEFAULT)),)
    override UNITY := $(UNITY_DEFAULT)
  else
    override UNITY := $(shell ls /Applications/Unity/Hub/Editor/*/Unity.app/Contents/MacOS/Unity 2>/dev/null | tail -1)
  endif
endif

ifeq ($(wildcard $(UNITY)),)
  $(error Unity Editor not found. Install 2022.3 LTS + WebGL, or: export UNITY="/Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity")
endif

PROJECT := $(CURDIR)
LOG_DIR := $(PROJECT)/Logs
MODE ?= full-stack

all unity:
	@mkdir -p "$(LOG_DIR)"
	@echo "Using UNITY=$(UNITY)"
	@echo "Building all WebGL exceptionSupport variants…"
	"$(UNITY)" -batchmode -nographics -quit \
		-projectPath "$(PROJECT)" \
		-logFile "$(LOG_DIR)/unity-build-all.log" \
		-executeMethod WebGlCoverageBuild.BuildAll
	@echo "Done — see web/assets/unity/*/index.html"

unity-one:
	@mkdir -p "$(LOG_DIR)"
	@echo "Building WebGL exceptionSupport=$(MODE)…"
	"$(UNITY)" -batchmode -nographics -quit \
		-projectPath "$(PROJECT)" \
		-logFile "$(LOG_DIR)/unity-build-$(MODE).log" \
		-executeMethod WebGlCoverageBuild.BuildOne \
		-exceptionSupport "$(MODE)"
	@echo "Done — see web/assets/unity/$(MODE)/index.html"

clean:
	rm -rf Build WebGL "$(LOG_DIR)"
