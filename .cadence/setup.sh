#!/bin/bash
set -e

# STELLATE runs with no bundler and no runtime backend: index.html at the repo
# root loads plain classic scripts + ES modules directly, and the Faust WASM
# engine is committed under engine/faust/dist/. Node 22 is pre-baked on the
# runner, so the only setup is the two optional dev-tooling dep sets.

# Root devDependency: playwright, used only by the headless browser test gates.
if [ -f package.json ]; then
  npm install
fi

# The Faust WASM engine's own deps (@grame/faustwasm) — needed for offline
# renders / rebuilding modules, not for serving the app shell.
if [ -f engine/faust/package.json ]; then
  (cd engine/faust && npm ci)
fi
