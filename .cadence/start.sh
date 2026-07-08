#!/bin/bash
set -e

# No datastore and no migrations: stellate is a static site with optional Node
# render/verify tooling. Nothing to bring up at session boot; the platform starts
# the dev server (a static HTTP server, see serve.sh) after this script runs.

# One-time found-sound/video assets are large external fetches (archive.org) that
# the core synth engine does not require to run, so they are left to the operator
# via the fetch-found-*.sh recipes rather than pulled on every session boot.
echo "stellate: static site, no datastore to start"
