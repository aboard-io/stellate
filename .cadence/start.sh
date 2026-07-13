#!/bin/bash
set -e

# STELLATE is a fully static browser app: no datastore, no migrations, no seed.
# The runtime found-sound/video media is gitignored and normally fetched via
# tools/fetch-found-*.sh (large downloads, external hosts) — the app shell boots
# and runs fine without it, so we do not fetch it here. Nothing to bring up;
# the platform serves the static tree (serve.sh sends the same COOP/COEP headers
# locally) after this script.
true
