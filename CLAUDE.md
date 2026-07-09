# CLAUDE.md — stellate

A self-contained generative genre-space instrument: a **178-genre**
deterministic vector space (`genre-kernel.js`) over one score brain
(`engine/csd-engine.js buildEvents`) with a generative harmony/pipes layer
(`engine/theory.js` + `engine/pipes.js` — docs/MUSIC-MIND.md), **sampled by
default** (full General MIDI via `engine/faust/extract-gm.js`, with per-voice
Faust effect chains) and played by a single **Faust WASM engine** (`engine/faust/` — live in the browser and
offline "press" in node), verified symbolically and empirically. Extracted from the
verifier-catalog repo in 2026-06 with full history; it is a worked example of
that catalog's generator → verifier → feedback-loop thesis. (Named "Royal Road
vaporwave" through 2026-07; renamed **stellate** at export.)

Since 2026-07 (FAUST-PORT phase 3) Faust is the **only** backend on main; the
entire csound era — `buildCsd` codegen, `wasm-audio.js`, the `builder.html`
song builder, `play.html` player, the founding `royal-road.csd`, its
`render.sh`, engine A/B tools — is preserved fully working on branch
**`legacy-csound`**. Main is **csound-free**: no `.csd`, no `csound` binary
anywhere in the toolchain (removed 2026-07-09; the archive is one `git switch
legacy-csound` away).

## The one rule

**Source is committed; audio is derived and gitignored.** `engine/csd-engine.js`
(the score brain) / `engine/faust/dsp` (the synthesis) are the capability; every
`.wav`/`.mp3` is regenerable and must never be committed. (The project exists
because we once kept the renders and lost the generator — the founding
`royal-road.csd` — see the README genesis parable. That `.csd` now lives safe on
`legacy-csound`.)

## The catalog submodule

`verifier-catalog/` is a git submodule (`git submodule update --init` after
clone). Two roles:

- **Reference data**: `verifier-catalog/gen_data/k_music.py` holds the
  `generate_symbolic_music` generator whose vaporwave/city-pop `domain_notes`
  this project implements. `song-verifier.js` cites catalog verifiers 12.33
  (genre-conformance) and 17.43 (no-formal-verifier).
- **MCP reference tool**: `.mcp.json` launches the catalog's stdio MCP server
  from the submodule (`search_methods`, `get_method`, `neighbors`,
  `plan_architecture`). Needs `uv` on PATH; self-provisions on first use.

Don't edit anything inside `verifier-catalog/` from this repo — make catalog
changes in the catalog's own checkout and bump the submodule pointer.

## Run / test

Paths reflect the 2026-07 folder reorg: browser entry `index.html` at root;
deterministic core + WASM engine in `engine/` (incl. `engine/faust/`); Node CLIs
in `tools/`; gates/harnesses in `test/`; docs in `docs/`.

```bash
tools/fetch-found-sound.sh     # one-time: Internet Archive field recordings -> found/
tools/fetch-found-samples.sh   # one-time: SoundFont GM + breaks/one-shots/vox -> found/samples/
tools/fetch-found-video.sh     # one-time: Internet Archive laserdisc clips -> found/video/
./serve.sh                     # http://localhost:8777/  (serves index.html; needs http, not file://)
./verify.sh                    # orchestrator: matrix + validate + engine smoke
node test/engine.test.js       # faust-press smoke: states render, gated on non-silence
node test/theory.test.js && node test/pipes.test.js   # MUSIC-MIND organs (pure node)
node engine/validate-genres.js --quick   # symbolic gates (all genres); --audio adds Discogs-EffNet
node engine/genre-verifier.js matrix      # genre confusion matrix — must stay diagonal-dominant
node engine/genre-kernel.js track jungle --seed 7 --render   # one track -> mp3 via engine/faust/press.js
node tools/render-sample-video.js         # sample.mp4: song + video layer, cuts on section downbeats
node engine/genre-kernel.js journey path.json --hours 4 --out journey/ --render --video
                               # explorer path -> mp3s + genre-affine videos + gapless journey (GENRE-SPACE.md)
# headless browser gates (need the pinned playwright):
NODE_PATH=/home/ford/ftrain-2025/node_modules node test/explorer-ui-test.js   # (+ genre-viz / demo-layer / live-test-run / wavout-test-run / live-resilience / bg-survival)
```

CI: `.github/workflows/verify.yml` runs the media guard + the full `./verify.sh`
suite on every PR/push in a clean clone with ZERO fetched media —
`node tools/ci-standin-media.js` synthesizes quiet-noise stand-ins at every
path the gates check (~1s, no network, never overwrites a real file).

Requires `ffmpeg`, `curl`, `node` (with `engine/faust/node_modules` — `npm ci` in
`engine/faust/`). No `csound` — main's toolchain is csound-free; the founding
`royal-road.csd` and its `render.sh` live on `legacy-csound`.

## Incorporating a sample CD

A repeatable pipeline for folding any archive.org **sample CD** (a zip of WAVs)
into the sample layer — `tools/fetch-sample-cd.sh` + `tools/classify-sample-cd.py`:

```bash
tools/fetch-sample-cd.sh <archive-item> <zip-filename> <prefix> [dest]
# e.g. Fatboy Slim's "Skip to My Loops" (79 generically-named WAVs, no metadata):
tools/fetch-sample-cd.sh fatboy-slim-skip-to-my-loops \
  "Fatboy Slim - Skip to my loops.zip" stml
```

1. **download → extract → mono 44.1k → trim** (ffmpeg `silenceremove` both ends,
   `loudnorm=I=-18:TP=-1`), **dropping** near-empty results (<0.12s).
2. **classify** each sample (`classify-sample-cd.py`, numpy+scipy only — librosa/
   aubio are NOT installed): duration, RMS, spectral centroid, YIN pitch+clarity,
   onset-autocorrelation BPM → `loop` / `tonal` / `oneshot` / `chop`. This is how
   pitch/bpm/class are **recovered** from generically-named CD samples.
3. **rename** by detected metadata (`stml/loop_133_01.wav`, `stml/chop_g3_04.wav`,
   `stml/hit_07.wav`) → `found/samples/<prefix>/manifest.json` + a **ready-to-paste
   `SAMPLES` snippet** (loop→`kind:"break"`+bpm, tonal→`kind:"hit"`+note, oneshot→
   `kind:"hit"`, chop→`kind:"chop"`).
4. **register**: paste the curated snippet into `engine/genre-kernel.js` `SAMPLES`
   (grouped under a `// --- <CD name> ---` comment); append the crate entries to
   `found/samples/manifest.json`.
5. **wire into genres** — MATRIX-SAFE ONLY: add ids to a genre's **existing**
   `found.sources` pool (same role: loops→`role:"break"` genres, chops→`role:"chops"`
   genres) or to `hits.sources` (always safe). NEVER add a `found:{role:…}` block to
   a genre lacking one, change a role, or touch bpm/scored fields — that shifts the
   confusion matrix. After every batch, `node engine/genre-verifier.js matrix
   --no-cache` MUST still print `diagonal dominant: 178/178`.

The audio lands gitignored under `found/`; the recipe + registry/genre edits are
the committed deliverable (the one rule). Credit the CD in SOURCES.md.

## Layout

Three tiers: the lean browser **entry** (`index.html`), the **app** UI as native
ES modules (`app/`), and the deterministic **engine** as classic-global scripts
(`engine/`, incl. `engine/faust/`). Node CLIs live in `tools/`, gates in `test/`,
docs in `docs/`.

- `index.html` — the lean entry (STELLATE). `<head>` links `app/app.css`;
  `<body>` holds the DOM skeleton, the `engine/…` classic `<script src>` tags
  (order matters — they define `window.CsdEngine`/`GenreKernel`/`FaustStateEngine`/
  `FaustLive`/`VideoLayer`/`DemoLayer`/`NameBank` before the app runs), then the
  module entry `<script type="module" src="app/main.js">`. No inline style/JS.
- `how.html` — the standalone visual explainer of the pipeline (self-contained;
  its stage narrative + numbers must track csd-engine/genre-kernel reality).
- `app/` — THE app (no framework, no bundler; native `<script type=module>` +
  one stylesheet). Shared state threaded via imports, NOT accidental globals:
  - `app/app.css` — all of the former inline `<style>` (the whole UI stylesheet)
  - `main.js` — entry: imports the feature modules (wiring their listeners/subs/
    `window.__` hooks), assembles `window.__X`, then runs the one-shot boot
    sequence (layout → default loop → centre → score → tickers). Gates boot on
    the stylesheet applying so `#map` is viewport-sized before the layout runs.
  - `state.js` — the store hub: `S`/`set`/`subs`, the preact/htm `html`/`render`
    helpers, the `K`/`V`/`E` engine aliases, `esc`/`deep`, and `QSFLAGS`
  - `world.js` — the star map's logical space: the `POS` seed, computed world
    bounds (`WORLD_W/H`/`MAP_CENTER`/`recomputeWorld`), blend/space constants
  - `targeting.js` — `weightsAt`/`retarget` (point → genre blend → engine state)
    + the glide engine (`glideStep`/`rebuildQueue`) + path `travelStep`
  - `starmap.js` — imperative SVG map (`drawMap`), traveler pulse, zoom/pan +
    pointer gestures, waypoint editing, deterministic `computeGenreLayout`/
    `seedDefaultLoop`. Measures **monospace** for the layout so it's byte-identical
    every load (the visible labels use the VT323 webfont; the layout must not race it)
  - `inside.js` — the ⓘ "inside the sound" readout (blend/feel radar/voice
    timeline, `vizData`/`renderInside`) + the DemoLayer note feed
  - `background.js` — genre-affine laserdisc video + the ▢→▣→▦ chip that cycles
    off → video+demos → demoscene (8-bar video↔demo alternation + wall-clock backstop)
  - `live.js` — the live engine: owns `faustHandle` + `goLive`/`stopLive`, the
    honest boot-progress hairline, `?wavDebug` overlay, `?clicktest` bed, Media Session
  - `panels.js` — the ⚙ controls (preact-rendered) + chip↔modal plumbing; registers
    the store render subs
  - `readouts.js` — the CPU meter + the playhead/chyron lower-third (self-ticking)
- `engine/` — the deterministic core + WASM engine (classic global scripts; NOT
  modules — the app reads them off `window`):
  - `csd-engine.js` — the score brain: `buildEvents(state)` → pitched/drums/found/
    sfx events + PROGRESSIONS/kits/patterns vocabulary. (csound codegen: `legacy-csound`.)
  - `theory.js` — `CsdTheory`, the harmony brain (MUSIC-MIND organ #1): modes,
    voice-leading, and a functional-harmony progression generator with an
    `adventure` knob; consumed by buildEvents via `state.theory.reharm`
    (docs/MUSIC-MIND.md; `node test/theory.test.js`)
  - `pipes.js` — `CsdPipes`, the scheduler as pipes (MUSIC-MIND organ #2): seeded
    event transforms (harmonize/echoCanon/strum/ghost/callResponse/densityArc +
    per-note expression annotations) run on `state.pipes` at the buildEvents
    choke point, before the snare-law (`node test/pipes.test.js`)
  - `genre-kernel.js` — genre as a point in multidimensional space; blend/track/
    playlist/journey generators emitting engine states (design: docs GENRE-SPACE.md)
  - `genre-verifier.js` — symbolic genre-conformance scoring + confusion matrix
    (`node engine/genre-verifier.js matrix` must stay diagonal-dominant)
  - `validate-genres.js` — the gate suite (determinism, vocabulary, coverage…;
    `--audio` renders probes via faust press for the classifier)
  - `namebank.js` — invents band/album/roster identities for the chyron
  - `video-layer.js` — laserdisc background video: dual-`<video>` crossfade, switches
    on section changes during playback, ambient cycling when idle
  - `demo-layer.js` — MicroW8 demoscene background carts (off until toggled)
  - `song-verifier.js` — `analyzeSong`/`improveSong`: the verifier half of the loop
  - `midi-export.js` — Standard MIDI File from the same buildEvents walk
  - `faust/` — THE engine (see docs `FAUST-PORT.md`, `engine/faust/VOICES.md`):
    - `dsp/` + `dist/` — one precompiled WASM AudioWorklet per synthesis model
      (`node engine/faust/build.js` rebuilds); DX7 family decodes real cartridge banks
    - `state-engine.js` — state → voice units + param/event mapping (shared by live + press)
    - `sampler.js` + `sf2.js` + `extract-gm.js` — the sampled layer (default):
      full General MIDI extracted from a FluidR3-class SoundFont, played back
      through per-voice Faust effect chains; synths are the fallback/color
    - `live.js` — `FaustLive.exploreLive`: chord-bar JIT scheduler on the WebAudio
      clock, voice pools, eco-mode load shedding. Desktop rides a SharedArrayBuffer
      ring (`ring-player.js`, `stream-worker.js`, `stream-renderer.js`); mobile
      takes the **WAV-FIRST** path — a real `<audio>` element fed rendered media
      segments so audio survives pocket/lock (`docs/history/WAV-FIRST.md`)
    - `found-player.js` — native found sound: granular bed + slice chopper on
      `AudioBufferSourceNode`s; `decodeUrlToBuffer` skips recording lead-in and
      boost-normalizes quiet speech (the spokenword fix)
    - `press.js` — offline render (faustwasm offline processors + PCM found mix)
- `tools/` — Node CLIs + shell recipes: `fetch-found-*.sh`,
  `render-sample-video.js`, `make-mix-page.js` (mix/index.html + mix.m3u from a
  rendered playlist dir), etc. (All rendering is Faust-press now; the csound
  `render.sh` is on `legacy-csound`.)
- `test/` — gates + headless probes: `engine.test.js` (faust-press smoke),
  `explorer-ui-test.js`/`genre-viz-test.js`/`demo-layer-test.js` and the live/
  wavout/resilience/bg-survival runs (they `goto /index.html` and read the
  `window.__` debug hooks), `probe-harness.js` (shared static server + chromium)
- `audio-verifier.py` — EMPIRICAL gate: Essentia Discogs-EffNet genre model on
  rendered audio. Setup: `python3 -m venv .venv-verify && .venv-verify/bin/pip
  install essentia-tensorflow`, then download to `models/`:
  `discogs-effnet-bs64-1.pb` (essentia.upf.edu/models/feature-extractors/discogs-effnet/)
  and `genre_discogs400-discogs-effnet-1.{pb,json}` (…/classification-heads/genre_discogs400/).
  Use via `node engine/genre-kernel.js track jungle --render --audio-verify`.
- `docs/history/` — retired planning/verification records kept for the
  architecture trail (esp. `WAV-FIRST.md` — the mobile-audio design; also
  `KERNEL-V4.md`, `ZERO-STATIC.md`, `ab-report.md`, `EVALUATION.md`,
  `VALIDATION.md`, `NEXT.md`). The old csound-WASM pages (`builder.html` song
  builder, `play.html` player) live fully working on branch `legacy-csound`.
- `found/` — fetched found-sound + found-video layers (gitignored except `.gitignore`;
  recipes: `fetch-found-sound.sh`, `fetch-found-video.sh`, credits in SOURCES.md)
- `LICENSE` (MIT, © 2026 Paul Ford) + `NOTICE` (third-party carve-outs:
  MicroW8/lamejs/faustwasm) + `CONTRIBUTING.md` (the PR contract) +
  `SOURCES.md` (media policy + attribution ledger) + `.github/`
  (`workflows/verify.yml` CI gate, PR template)
- `docs/HOSTING.md` — the stellate.app hosting plan (droplet + nginx,
  same-origin media, COOP/COEP, R2 growth path)

## Deployment

The working tree **is** the web root: nginx serves it at
`https://aboardresearch.com/projects/stellate/` (renamed from "vaporwave"
2026-07-09; `/projects/vaporwave/` 301-redirects here — alias block in
`/etc/nginx/sites-enabled/aboardresearch`, `Cache-Control: no-cache`). File
moves/renames here are production changes; gitignored-but-present files
(`found/`, `found/video/`, `faust/node_modules`) are required for the live
site; `faust/dist` is committed.
