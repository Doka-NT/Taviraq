.DEFAULT_GOAL := build

NODE_MODULES_STAMP := node_modules/.package-lock.json
APP_NAME := Taviraq
APP_BUNDLE := dist/mac-arm64/$(APP_NAME).app
INSTALL_DIR ?= /Applications
INSTALL_BUNDLE := $(INSTALL_DIR)/$(APP_NAME).app

export COPYFILE_DISABLE := 1

.PHONY: app build clean install

$(NODE_MODULES_STAMP): package-lock.json
	npm ci

app: $(NODE_MODULES_STAMP)
	rm -rf dist/mac-arm64
	npm run package:mac:dir

build: $(NODE_MODULES_STAMP)
	rm -rf dist/mac-arm64 dist/*.zip dist/*.pkg
	npm run package:mac

install: app
	test -d "$(APP_BUNDLE)"
	rm -rf "$(INSTALL_BUNDLE)"
	ditto "$(APP_BUNDLE)" "$(INSTALL_BUNDLE)"
	@echo "Installed $(APP_NAME) to $(INSTALL_BUNDLE)"

clean:
	rm -rf out dist
