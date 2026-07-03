# vendored: @strudel/repl 1.3.0 (unmodified build)

Strudel — https://strudel.cc · source: https://codeberg.org/uzu/strudel
License: AGPL-3.0-or-later (see LICENSE-AGPL). We ship the unmodified npm
build of `@strudel/repl@1.3.0` (`dist/index.js` + `dist/assets/`); compliance
here = this attribution + the license file + the footer credit on remix.html.

Files:
- index.js                      — the REPL web component, IIFE bundle (defines <strudel-editor>)
- assets/clockworker-ZDiUtESR.js — its clock worker (loaded relative to index.js)

To upgrade: `npm pack @strudel/repl@<ver>` and copy dist/index.js + dist/assets/.
Note: default sample banks (drum machines, Dirt-Samples, gm_* soundfonts) are
fetched at runtime from raw.githubusercontent.com (CORS-enabled); our own
material is same-origin via ../strudel-samples.json.
