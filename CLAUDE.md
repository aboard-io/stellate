# CLAUDE.md — stellate

A self-contained generative genre-space instrument: a **274-genre**
deterministic vector space (`genre-kernel.js`, incl. real 3/4 odd-meter
anchors — `state.meter`) over one score brain
(`engine/csd-engine.js buildEvents`) with a generative harmony/pipes layer
(`engine/theory.js` + `engine/pipes.js` — docs/MUSIC-MIND.md), **sampled by
default** (full General MIDI via `engine/faust/extract-gm.js`, with per-voice
Faust effect chains) and played by a single **Faust WASM engine** (`engine/faust/` — live in the browser and
offline "press" in node), verified symbolically and empirically. It is a worked
example of a generator → verifier → feedback loop: the thing that makes the
music and the thing that checks it live side by side and argue. (Named "Royal
Road vaporwave" through 2026-07; renamed **stellate** at export.)

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

## Run / test

Paths reflect the 2026-07 folder reorg: browser entry `index.html` at root;
deterministic core + WASM engine in `engine/` (incl. `engine/faust/`); Node CLIs
in `tools/`; gates/harnesses in `test/`; docs in `docs/`.

```bash
tools/fetch-found-sound.sh     # one-time: Internet Archive field recordings -> found/
tools/fetch-found-samples.sh   # one-time: SoundFont GM + breaks/one-shots/vox -> found/samples/
node tools/transcode-samples.js  # REQUIRED after a zone fetch: wav -> mp3 + re-bake SAMPLERS
./serve.sh                     # http://localhost:8777/  (serves index.html; needs http, not file://)
./verify.sh                    # orchestrator: matrix + validate + engine smoke
node test/engine.test.js       # faust-press smoke: states render, gated on non-silence
node test/theory.test.js && node test/pipes.test.js   # MUSIC-MIND organs (pure node)
node test/meter.test.js        # ODD-METER gates: 3/4 + 6/8 grids, meter-safety stress, non-silent press (pure node)
node engine/validate-genres.js --quick   # symbolic gates (all genres); --audio adds Discogs-EffNet
node engine/genre-verifier.js matrix      # genre confusion matrix — must stay diagonal-dominant
node engine/genre-kernel.js track jungle --seed 7 --render   # one track -> mp3 via engine/faust/press.js
node engine/genre-kernel.js journey path.json --hours 4 --out journey/ --render
                               # explorer path -> mp3s + gapless journey mix (GENRE-SPACE.md)
# headless browser gates (need `npm install && npm run setup:browser` at the repo root, once):
node test/explorer-ui-test.js   # (+ genre-viz / demo-layer / live-test-run / wavout-test-run / live-resilience / bg-survival)
node test/blend-arrival-run.js  # live-blend ARRIVAL contract: drums ≤3 bars, kit/lead identity ≤7
node test/speech-live-run.js    # speech organ live: espeak WASM synthesizes + feeds the found pipeline
node test/mp3-bed-decode-run.js # HOSTING §3 diet: MP3 beds fetch 200 + decodeAudioData in a real browser
node test/midi-export-run.js    # ⤓ midi: clicks the button, parses the downloaded SMF, matches it to buildEvents
```

Ship: `tools/ship.sh` = gates → `git push` → deploy to stellate.app (refuses a
dirty tree — the deploy rsyncs the working tree, so deployed must mean
committed; docs/HOSTING.md). aboardresearch.com is this tree served directly.

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
   --no-cache` MUST still print `diagonal dominant: 274/274`.

The audio lands gitignored under `found/`; the recipe + registry/genre edits are
the committed deliverable (the one rule). Credit the CD in SOURCES.md.

## Mining the MIDI trove

`tools/fetch-midi-trove.sh` pulls genre-labeled MIDI rips (MIDIMAN Melody Kit,
archive.org) onto the EXTERNAL drive (/mnt/sources/relocated/stellate-midi-corpus/rips — NEVER under found/, which ship.sh rsyncs to the droplet: the MIDI must not deploy); `tools/mine-midi.js` (zero deps —
SMF parser, verifier-formula features, KK key detection, per-bar chord
estimation) measures them:

```bash
tools/fetch-midi-trove.sh                                 # one-time: ~34MB, 5 rips
node test/midi-mine.test.js                               # parser gates (round-trip vs midi-export, keycheck)
node tools/mine-midi.js calibrate jazz /mnt/sources/relocated/stellate-midi-corpus/rips/jazz    # corpus vs anchor renders vs TARGETS row
node tools/mine-midi.js scan /mnt/sources/relocated/stellate-midi-corpus/rips/ragtime           # corpus feature distributions
```

Parsed ONCE into a derived SQLite corpus on the external drive
(`tools/corpus-db.js` — needs `npm install` in `tools/`; note blobs + extracted
melody lines + 26-dim feature vectors; DB at
`/mnt/sources/relocated/stellate-midi-corpus/corpus.db`, OFF-repo because
ship.sh rsyncs `found/`): after the one-time build every corpus question is
milliseconds (`stats` / `keycheck` / `melody --rip x` / `near <id|path>` /
`bench`; gates in `test/corpus-db.test.js`, CI-skips without node_modules).
Melody lines carry a `mel_conf` — statistics only trust `>=0.55`; polyphonic
skylines are flagged, never averaged in as lines.

`tools/fetch-midi-bulk.sh` pulls the ~104k-file unlabeled bulk straight to the
external drive; `tools/mine-theory.js` fits FUNC_NEXT/POOL harmony tables from
the DB (dedup first, diatonic bigrams, train/test split) and `--splice`
regenerates the MINED block in `engine/theory.js` ONLY when the mined tables
beat the hand tables on held-out log-likelihood in both modes. The tables are
opt-in per state (`state.theory.tables:"corpus"`) — absent, theory output is
byte-identical (gates: `node test/theory-tables.test.js`). Since 2026-07-15
the TABLES LAW in `deriveMind` wires every reharm genre (201/274) to the
corpus tables; an anchor opts out with `tables:"hand"`. NOTE the verifier is
blind to the reharm walk (motion/seventh read the SKELETON progression), so
the matrix can't gate table changes — the gates that matter are the held-out
likelihood (mine-theory refuses a losing splice), the theory invariants, and
ears. `test/meter.test.js` head_byte_identity trips on any uncommitted
tables-law change (intended drift: `state.theory.tables` + reharmed pitched
events; drums byte-identical) and self-heals on commit.

`tools/mine-melody.js <rip>` mines melody phrase cells (modal 8-beat rhythm +
MEDOID real-phrase contour — never per-slot averages, the median of a thousand
melodies is a monotone) in MEL_PHRASES format; mined cells folkline/jazzline/
ragline/dubline (+"2" twins, generic per-chord alternation) are wired into
folk/jazz/ragtime/dub lead pools and fingerprint-gated by
`node test/melody-cells.test.js`. `tools/mine-groove.js <rip>` mines per-16th
velocity-accent profiles for the pipes `accentProfile` expression (only dub
carried real signal — jazz/folk velocities are flat, negative result noted in
pipes.js). `tools/mine-weave.js <rip[:alias]>… --splice` fits the mined melody
ORGAN (MINED_WEAVE in csd-engine — Markov pitch walk over the voicing ladder +
IOI rhythm chain; patterns `<alias>weave`); the splice refuses any family that
loses to the wander baseline on held-out lines (wander itself measures worse
than uniform). Gates: `node test/melody-weave.test.js`.

`calibrate` is the EXTERNAL check on a verifier row (everything else measures
the engine against its own renders). Provenance rules live in SOURCES.md: MIDI
never committed, statistics always committable, verbatim vocabulary only from
PD-composition rips. Known instrument caveats (velocity-as-amp, swing
estimator counts 16th syncopation, chord estimation not ground truth) are
documented at the top of `mine-midi.js` — read them before trusting a
divergence. First fruits (2026-07-14): the jazz hatDensity fence recalibration,
the mined `dub_vamp`/`rag_cycle` progressions, and the `ragtime` anchor — the
first anchor authored from a measured corpus (`genre-specs/ragtime.json`).

## Layout

Three tiers: the lean browser **entry** (`index.html`), the **app** UI as native
ES modules (`app/`), and the deterministic **engine** as classic-global scripts
(`engine/`, incl. `engine/faust/`). Node CLIs live in `tools/`, gates in `test/`,
docs in `docs/`.

- `index.html` — the lean entry (STELLATE). `<head>` links `app/app.css`;
  `<body>` holds the DOM skeleton, the `engine/…` classic `<script src>` tags
  (order matters — they define `window.CsdEngine`/`GenreKernel`/`FaustStateEngine`/
  `FaustLive`/`DemoLayer`/`NameBank` before the app runs), then the
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
    timeline — always 8 cells, chordEvery-16/32 genres fold into stacked rows;
    role/character descriptions that never name a source; beds render as
    sustained ribbons; a compact "mind" section shows the MUSIC-MIND meters +
    active pipes; `vizData`/`renderInside`) + the DemoLayer note feed
  - `background.js` — the MicroW8 demoscene background program + the ▢→▦ chip
    that toggles off → demoscene; cart rotates every 8 bars on the musical
    clock with a wall-clock backstop (the laserdisc video layer + the ⤓
    download/export cluster were removed 2026-07-25 — branch legacy-download-video;
    ⤓ midi came back 2026-07-26, see `export.js`)
  - `live.js` — the live engine: owns `faustHandle` + `goLive`/`stopLive`, the
    honest boot-progress hairline, `?wavDebug` overlay, `?clicktest` bed, Media Session
  - `panels.js` — the ⚙ controls (preact-rendered) + chip↔modal plumbing incl.
    the ⧉ embed snippet and the ⤓ midi button; registers the store render subs
  - `export.js` — ⤓ midi ONLY (restored 2026-07-26): `engine/midi-export.js`
    fed `S.playing` — the same state/seed/path position the ↗ share URL names,
    so the file is the music on screen — named `stellate-<genre>-seed<n>-m<bar>.mid`
    (ASCII). The wav/mp3 offline press and the whole-path journey walk stay
    excised (branch `legacy-download-video`). Gate: `test/midi-export-run.js`
  - `readouts.js` — the playhead/chyron lower-third (self-ticking; the ⚡ CPU
    meter box was removed 2026-07-09 — load/eco still reads out in the chyron
    tech line)
- `engine/` — the deterministic core + WASM engine (classic global scripts; NOT
  modules — the app reads them off `window`):
  - `csd-engine.js` — the score brain: `buildEvents(state)` → pitched/drums/found/
    sfx events + PROGRESSIONS/kits/patterns vocabulary, incl. ODD METERS —
    `state.meter {beats,unit}` (absent = 4/4, byte-identical), kits
    waltz/waltzswing/sixeight, bass oompahpah/waltzroot/siciliana, melody
    waltz/lilt6, chordEvery defaulting to 6 under meter (`test/meter.test.js`).
    (csound codegen: `legacy-csound`.)
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
  - `demo-layer.js` — MicroW8 demoscene background carts (off until toggled)
  - `song-verifier.js` — `analyzeSong`/`improveSong`: the verifier half of the loop
  - `midi-export.js` — Standard MIDI File from the same buildEvents walk; TWO
    callers: the browser's ⤓ midi download (`app/export.js`; loads AFTER
    csd-engine, boot-smoke enforces it) and the MIDI-corpus gates' reference
    SMF writer (`test/midi-mine.test.js`, `test/corpus-db.test.js`)
  - `faust/` — THE engine (see docs `history/FAUST-PORT.md`, `engine/faust/VOICES.md`):
    - `dsp/` + `dist/` — one precompiled WASM AudioWorklet per synthesis model
      (`node engine/faust/build.js` rebuilds); DX7 family decodes real cartridge banks
    - `state-engine.js` — state → voice units + param/event mapping (shared by live + press)
    - `sampler.js` + `sf2.js` + `extract-gm.js` — the sampled layer (default):
      full General MIDI extracted from a FluidR3-class SoundFont, played back
      through per-voice Faust effect chains; synths are the fallback/color.
      Zones ship as **mono 22.05 kHz 48 kbps MP3** (`tools/transcode-samples.js`,
      ~14× smaller than the extracted wav at a higher measured SNR — instrument
      zones hold 0.254% of their energy above 11 kHz). The zone metadata in
      `K.SAMPLERS` rides with the format: `ls`/`le` are absolute sample indices
      at `sr`, and `len` is the expected decoded length — WebKit prepends a
      constant 1105-sample MP3 lead-in that the player detects by comparing the
      decoded length to `len × (ctxRate / sr)`; Chromium and Firefox decode
      sample-exact. `zones.json` is extractor output only; the browser reads
      `K.SAMPLERS`
    - `live.js` — `FaustLive.exploreLive`: chord-bar JIT scheduler on the WebAudio
      clock, voice pools, eco-mode load shedding. Desktop rides a SharedArrayBuffer
      ring (`ring-player.js`, `stream-worker.js`, `stream-renderer.js`) and a
      hidden desktop tab KEEPS PLAYING (bg-survival-run's contract); mobile
      takes the **WAV-FIRST** path — a real `<audio>` element fed rendered media
      segments so audio survives pocket/lock (`docs/WAV-FIRST.md`)
    - `found-player.js` — native found sound: granular bed + slice chopper on
      `AudioBufferSourceNode`s; `decodeUrlToBuffer` skips recording lead-in and
      boost-normalizes quiet speech (the spokenword fix)
    - `press.js` — offline render (faustwasm offline processors + PCM found mix)
- `tools/` — Node CLIs + shell recipes: `fetch-found-*.sh`,
  `transcode-samples.js` (the instrument-zone MP3 diet: converts in place and
  re-bakes the `SAMPLERS` block — `--dry` measures without writing, a sampler
  with any failed zone rolls back whole so one instrument is never half-rate),
  `make-mix-page.js` (mix/index.html + mix.m3u from a
  rendered playlist dir), etc. (All rendering is Faust-press now; the csound
  `render.sh` is on `legacy-csound`.)
  - `genre-tool.js` — author a genre anchor from a `genre-specs/*.json` spec:
    validates against the live engine vocabulary, MEASURES verifier targets
    from real renders (auto-tightened so no existing diagonal falls), splices
    kernel + verifier in house style, runs the gates. Notes: `spec.pos` is
    OPTIONAL (omit it and boot derives a star near the genre's musical family
    — re-bake `app/world.js` POS after the batch); the tool applies
    `K.deriveMind` to the injected anchor so create-time measurement matches
    load; and `MIND_OVERRIDES` is applied INSIDE `deriveMind` (since
    2026-07-10), so overrides beat derivation identically at measurement,
    serialization, and load.
- `test/` — gates + headless probes: `engine.test.js` (faust-press smoke),
  `meter.test.js` (odd-meter grids, pure node), `explorer-ui-test.js`/
  `genre-viz-test.js`/`demo-layer-test.js` and the live/wavout/resilience/
  bg-survival runs plus `blend-arrival-run.js` (the live-blend arrival
  contract), `speech-live-run.js` (espeak WASM live), `mp3-bed-decode-run.js`
  (the MP3 diet decode proof), `midi-export-run.js` (the ⤓ midi download:
  captures the real file, parses the SMF from the spec, matches every note-on
  to `buildEvents`) — they `goto /index.html` and read the
  `window.__` debug hooks; `probe-harness.js` (shared static server + chromium)
- `tools/audio-verifier.py` — EMPIRICAL gate: Essentia Discogs-EffNet genre model on
  rendered audio. Setup: `python3 -m venv .venv-verify && .venv-verify/bin/pip
  install essentia-tensorflow`, then download to `models/`:
  `discogs-effnet-bs64-1.pb` (essentia.upf.edu/models/feature-extractors/discogs-effnet/)
  and `genre_discogs400-discogs-effnet-1.{pb,json}` (…/classification-heads/genre_discogs400/).
  Use via `node engine/genre-kernel.js track jungle --render --audio-verify`.
- `docs/WAV-FIRST.md` — the mobile-audio design. Promoted out of `history/`
  because it describes shipped behaviour and four live docs cite it.
- `docs/history/` — planning records that live CODE still points at, so they
  are references rather than archaeology: `NEXT.md` (§5b columnar events,
  §5d mastering, §5f break pools — cited from `engine/columns.js`,
  `csd-engine.js`, `live.js`, `state-engine.js` and three tests),
  `ab-report.md` (the csound A/B `state-engine.js` was tuned against),
  `VALIDATION.md` (the gate policy `validate-genres.js` implements),
  `KERNEL-V4.md` (cited by `test/fixtures.js` and `tools/genre-tool.js`),
  `MATERIALS.md` (the commission brief SOURCES.md and two fetch scripts cite)
  and `ZERO-STATIC.md` (the ring/zombie-worklet law). The old csound-WASM pages
  (`builder.html` song builder, `play.html` player) live fully working on
  branch `legacy-csound`.
- `found/` — the fetched found-sound layer (gitignored except `.gitignore`;
  recipes: `fetch-found-sound.sh` and friends, credits in SOURCES.md)
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
(`found/`, `faust/node_modules`) are required for the live
site; `faust/dist` is committed.
