# CLAUDE.md — stellate

A self-contained generative genre-space instrument: a **~110-genre**
deterministic vector space (`genre-kernel.js`) over one score brain
(`csd-engine.js buildEvents`), **sampled by default** (full General MIDI via
`faust/extract-gm.js`, with per-voice Faust effect chains) and played by a
single **Faust WASM engine** (`faust/` — live in the browser and offline
"press" in node), verified symbolically and empirically. Extracted from the
verifier-catalog repo in 2026-06 with full history; it is a worked example of
that catalog's generator → verifier → feedback-loop thesis. (Named "Royal Road
vaporwave" through 2026-07; renamed **stellate** at export.)

Since 2026-07 (FAUST-PORT phase 3) Faust is the **only** backend on main; the
entire csound era — `buildCsd` codegen, `wasm-audio.js`, the `builder.html`
song builder, `play.html` player, engine A/B tools — is preserved fully
working on branch **`legacy-csound`**. `royal-road.csd` stays on main as the
founding document (it renders via `./render.sh`, the one tool here that still
wants a `csound` binary — or on `legacy-csound`).

## The one rule

**Source is committed; audio is derived and gitignored.** `royal-road.csd` /
`csd-engine.js` / `faust/dsp` are the capability; every `.wav`/`.mp3` is
regenerable and must never be committed. (The project exists because we once
kept the renders and lost the `.csd` — see README "What happened".)

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
node engine/validate-genres.js --quick   # symbolic gates (all genres); --audio adds Discogs-EffNet
node engine/genre-verifier.js matrix      # genre confusion matrix — must stay diagonal-dominant
node engine/genre-kernel.js track jungle --seed 7 --render   # one track -> mp3 via engine/faust/press.js
node tools/render-sample-video.js         # sample.mp4: song + video layer, cuts on section downbeats
node engine/genre-kernel.js journey path.json --hours 4 --out journey/ --render --video
                               # explorer path -> mp3s + genre-affine videos + gapless journey (GENRE-SPACE.md)
# headless browser gates (need the pinned playwright):
NODE_PATH=/home/ford/ftrain-2025/node_modules node test/explorer-ui-test.js   # (+ genre-viz / demo-layer / live-test-run / wavout-test-run / live-resilience / bg-survival)
```

Requires `ffmpeg`, `curl`, `node` (with `engine/faust/node_modules` — `npm ci` in
`engine/faust/`). Only `tools/render.sh` (the founding `royal-road.csd`) still
needs `csound` (tested 6.18).

## Layout

- `royal-road.csd` — the founding committed Csound source (renders via
  `./render.sh` with csound installed, or on branch `legacy-csound`)
- `csd-engine.js` — the score brain: `buildEvents(state)` → pitched/drums/
  found/sfx events + PROGRESSIONS/kits/patterns vocabulary. Every backend
  derives from it. (Its csound codegen lives on `legacy-csound`.)
- `faust/` — THE engine (see `FAUST-PORT.md`, `faust/VOICES.md`):
  - `dsp/` + `dist/` — one precompiled WASM AudioWorklet per synthesis model
    (`node build.js` rebuilds); DX7 family decodes real cartridge banks
  - `state-engine.js` — state → voice units + param/event mapping (shared by
    live + press)
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
  - `legacy-tools/` — csound A/B harness (needs branch `legacy-csound`)
- `explorer.html` — CONSTELLATE: the live UI; drag the star chart, draw paths,
  journey glide, genre-affine video layer
- `genre-kernel.js` — genre as a point in multidimensional space; blend/track/
  playlist/journey generators emitting engine states (design: GENRE-SPACE.md)
- `genre-verifier.js` — symbolic genre-conformance scoring + confusion matrix
  (`node genre-verifier.js matrix` must stay diagonal-dominant)
- `validate-genres.js` — the gate suite (determinism, vocabulary, coverage…;
  `--audio` renders probes via faust press for the classifier)
- `audio-verifier.py` — EMPIRICAL gate: Essentia Discogs-EffNet genre model on
  rendered audio. Setup: `python3 -m venv .venv-verify && .venv-verify/bin/pip
  install essentia-tensorflow`, then download to `models/`:
  `discogs-effnet-bs64-1.pb` (essentia.upf.edu/models/feature-extractors/discogs-effnet/)
  and `genre_discogs400-discogs-effnet-1.{pb,json}` (…/classification-heads/genre_discogs400/).
  Use via `node genre-kernel.js track jungle --render --audio-verify`.
- `fetch-found-samples.sh` — breaks/one-shots/vox from archive.org + espeak-ng
  speech synthesis as an instrument; manifest in found/samples/
- `make-mix-page.js` — mix/index.html + mix.m3u from a rendered playlist dir
- `song-verifier.js` — `analyzeSong`/`improveSong`: the verifier half of the loop
- `midi-export.js` — Standard MIDI File from the same buildEvents walk
- `engine.test.js` — faust-press render smoke test (real offline audio)
- `video-layer.js` — laserdisc background video: dual-<video> crossfade, switches
  on section changes during playback, ambient cycling when idle
- `docs/history/` — retired planning/verification records kept for the
  architecture trail (esp. `WAV-FIRST.md` — the mobile-audio design; also
  `KERNEL-V4.md`, `ZERO-STATIC.md`, `ab-report.md`, `EVALUATION.md`,
  `VALIDATION.md`, `NEXT.md`). The old csound-WASM pages (`builder.html` song
  builder, `play.html` player) live fully working on branch `legacy-csound`.
- `found/` — fetched found-sound + found-video layers (gitignored except `.gitignore`;
  recipes: `fetch-found-sound.sh`, `fetch-found-video.sh`, credits in SOURCES.md)

## Deployment

The working tree **is** the web root: nginx serves it at
`https://aboardresearch.com/projects/stellate/` (renamed from "vaporwave"
2026-07-09; `/projects/vaporwave/` 301-redirects here — alias block in
`/etc/nginx/sites-enabled/aboardresearch`, `Cache-Control: no-cache`). File
moves/renames here are production changes; gitignored-but-present files
(`found/`, `found/video/`, `faust/node_modules`) are required for the live
site; `faust/dist` is committed.
