#!/bin/bash
set -e

# stellate is a static browser instrument (see CLAUDE.md): the working tree is
# the web root, served over HTTP with the cross-origin-isolation headers. The
# browser live path loads faust/dist (committed WASM) + esm.sh at runtime, so no
# bundling is needed. The only npm dependency here is @grame/faustwasm, used by
# the Node offline-render/verify tooling (faust/press.js, engine.test.js). bun
# and node 22 are pre-baked on the runner.

# Pull the verifier-catalog submodule (reference data + MCP) if present.
git submodule update --init 2>/dev/null || true

# Install the faust tooling deps (offline-render / tests). Non-fatal so a static
# session still comes up if the registry hiccups.
if [ -f faust/package.json ]; then
  ( cd faust && (npm ci || npm install) ) || echo "faust deps install skipped"
fi
