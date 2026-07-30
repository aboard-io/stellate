# CLAUDE.md — stellate

A self-contained generative genre-space instrument: a **274-genre**
deterministic vector space (`engine/genre-kernel.js` is the algebra; the anchors
themselves live beside it in `engine/genres-data.js`, incl. real 3/4 odd-meter
anchors — `state.meter`) over one score brain
(`engine/csd-engine.js buildEvents`) with a generative harmony/pipes layer
(`engine/theory.js` + `engine/pipes.js` — docs/MUSIC-MIND.md), **sampled by
default** (full General MIDI via `engine/faust/build/extract-gm.js`, with per-voice
Faust effect chains) and played by a single **Faust WASM engine** (`engine/faust/` — live in the browser and
offline "press" in node), verified symbolically and empirically. It is a worked
example of a generator → verifier → feedback loop: the thing that makes the
music and the thing that checks it live side by side and argue. (Older
references call it "Royal Road vaporwave"; it was renamed **stellate** at
export.)

Faust is the **only** backend on main, which is **csound-free**: no `.csd`, no
`csound` binary anywhere in the toolchain. The entire csound era — `buildCsd`
codegen, `wasm-audio.js`, the `builder.html` song builder, `play.html` player,
the founding `royal-road.csd`, its `render.sh`, the engine A/B tools — is
preserved fully working one `git switch legacy-csound` away
(docs/history/FAUST-PORT.md).

## The one rule

**Source is committed; audio is derived and gitignored.** `engine/csd-engine.js`
(the score brain) / `engine/faust/dsp` (the synthesis) are the capability; every
`.wav`/`.mp3` is regenerable and must never be committed. (The project exists
because we once kept the renders and lost the generator — the founding
`royal-road.csd` — see the README genesis parable. That `.csd` now lives safe on
`legacy-csound`.)

## Where the genre data lives

`engine/genre-kernel.js` is the ALGEBRA — `resolveMulti`/`blend`/`mix`/`track`/
`journey`/`deriveMind`, ~2,700 lines and ~190 KB, all of it code. The inert
literals it used to carry sit in two sibling files, lifted out by a one-time
migration (`tools/build/split-kernel-data.js`, kept as the record of how, not as
something to re-run):

- `engine/genres-data.js` (~5,300 lines, ~645 KB) — `GENRES`, the 274 anchors.
  `Object.keys` order is load-bearing: it drives the confusion-matrix row order
  and the star layout. Append, never reorder.
- `engine/registry-data.js` (~950 lines, ~155 KB) — `SOURCES` / `SOURCE_POOLS` /
  `VOICE_FAMILIES` / `SAMPLES` / `VOXBANK` / `SAMPLERS` / `PERCBANK`: the ids the
  fetch recipes write and the engine resolves.

They are **the source of truth**, not build output. `genres-data.js` is written
both by hand and by the pipeline tools — `genre-tool.js` / `invent-genres.js` /
`rm-genre.js` splice it (and `genre-verifier.js`) through
`/* genre-tool:<name>:genres */` and `:clips` markers.
`registry-data.js` has no automated writer at all: it is edited by hand, by the
sample-CD and found-sound recipes. Both are **classic scripts on purpose, not
JSON-over-fetch**: `engine/genre-kernel.js` merges `window.__GENRES` +
`window.__REGISTRY` at load, and `app/core/state.js` re-exports the kernel as `K`
at module top level, which `app/entries/access.js` (`Object.keys(K.GENRES)`) and
`app/map/layout.js` read synchronously while their modules evaluate. A fetch
would not have resolved yet. So both files load immediately BEFORE
`genre-kernel.js` in `index.html` / `embed.html` / `access.html`, and
`test/gates/boot-smoke.test.js` enforces that order.

`test/gates/kernel-data-identity.test.js` (`verify.sh` row `kerneldata`) holds
them byte-for-byte against HEAD — including key order and float printing, since
every seeded render and the whole matrix are downstream of those exact bytes. It
self-heals on commit, so it flags unintended drift rather than forbidding edits.

**One thing in there is generated and must not be hand-edited: the `info`
blurbs.** `tools/genre/gen-genre-info.js --write` derives all 274 descriptions
from the anchors that ship, so a card cannot promise an instrument the recipe
cannot play (`musicality.checkCardClaims` fails the genre if it does). Every word
comes from a TABLE keyed on an engine value — kit id, synthesis model, sampler
id, bass pattern — never a per-genre string, and there are deliberately no
per-genre overrides. Change the anchor and re-run; the prose follows. Hand-written
blurbs beside live data are what rotted the descriptions the first time.

## Run / test

Browser entry `index.html` at the root; deterministic core + WASM engine in
`engine/` (incl. `engine/faust/`); Node CLIs in `tools/`; gates and harnesses in
`test/`; docs in `docs/`. Every command below runs verbatim from the repo root.

```bash
tools/fetch/fetch-found-sound.sh     # one-time: Internet Archive field recordings -> found/
tools/fetch/fetch-found-samples.sh   # one-time: SoundFont GM + breaks/one-shots/vox -> found/samples/
node tools/build/transcode-samples.js  # REQUIRED after a zone fetch: wav -> mp3 + re-bake SAMPLERS
./serve.sh                     # http://localhost:8777/  (serves index.html; needs http, not file://)
./verify.sh                    # orchestrator: forks 13 gate rows concurrently (list below)
node test/gates/engine.test.js       # faust-press smoke: states render, gated on non-silence
node test/gates/theory.test.js && node test/gates/pipes.test.js   # MUSIC-MIND organs (pure node)
node test/unit/meter.test.js        # ODD-METER gates: 3/4 + 6/8 grids, meter-safety stress, non-silent press (pure node)
node engine/validate-genres.js --quick   # symbolic gates (all genres); --audio adds Discogs-EffNet
node engine/genre-verifier.js matrix      # genre confusion matrix — must stay diagonal-dominant
node tools/kernel-cli.js track jungle --seed 7 --render   # one track -> mp3 via engine/faust/press/press.js
node tools/kernel-cli.js journey path.json --hours 4 --out journey/ --render
                               # explorer path -> mp3s + gapless journey mix (GENRE-SPACE.md)
# headless browser gates (need `npm install && npm run setup:browser` at the repo root, once):
npm run test:browser                     # every browser gate, CONCURRENTLY (test/run.js)
npm run test:unit                        # the 33 pure-node gates in test/unit — nothing else runs them
npm run test:all                         # unit + browser
node test/browser/explorer-ui.test.js   # (+ genre-viz / demo-layer / live / wavout / live-resilience / bg-survival)
node test/browser/blend-arrival.test.js  # live-blend ARRIVAL contract: drums ≤3 bars, kit/lead identity ≤7
node test/browser/speech-live.test.js    # speech organ live: espeak WASM synthesizes + feeds the found pipeline
node test/browser/mp3-bed-decode.test.js # HOSTING §3 diet: MP3 beds fetch 200 + decodeAudioData in a real browser
node test/browser/midi-export.test.js    # ⤓ midi: clicks the button, parses the downloaded SMF, matches it to buildEvents
```

`./verify.sh` forks **13** rows concurrently and prints one PASS/FAIL line each.
Three come out of `engine/` — `matrix` (`genre-verifier.js matrix`), `validate`
(`validate-genres.js --quick`), `prove` (`invariants.js prove`). Ten are gates
under `test/gates/` — `engine` `social` `matproof` `kerneldata` `specs`
`poscover` `coordscover` `seamwalk` `bootsmoke` `doccounts`. The row list is not
hardcoded anywhere: adding a `run` line to `verify.sh` adds a row, and the wait
loop counts launched jobs rather than a tally.

**THE SUITES RUN CONCURRENTLY, and that is the whole performance story.** `verify.sh`
forks its 13 rows and finishes in ~40 s. The browser suite used to be a serial
for-loop over 34 gates whose slow members cost 130–240 s each — the better part of an
hour for one pass, which in practice means it is not run and regressions are found by
deploying. `test/run.js` runs them with a CPU-derived cap instead. What made that safe
is `probe-harness serve()`: a gate's port is now a PREFERENCE, walked past if busy and
reported back as `srv.port`, which every gate reads. That was needed anyway — `./serve.sh`
sits on 8791 all day and used to kill `live.test.js` with EADDRINUSE. Gates that assert
WALL-CLOCK throughput (`wavout`, `wavout-seam`, `stem-parity`) are held back and run
alone at the end, because concurrency is precisely what breaks a realtime budget:
measured, wavout-seam reports 57.3% against a 33% budget with two neighbours and passes
comfortably by itself. **No layer was removed** — the four are genuinely different
questions (symbolic/matrix, pure node, real browser, WebGL), and none of them was
redundant. They were just queued.

Ship: `tools/deploy/ship.sh` = gates → `git push` → deploy to **test.stellate.app**
(refuses a dirty tree — the deploy rsyncs the working tree, so deployed must mean
committed; docs/HOSTING.md). `ship.sh --prod` is the only thing that moves the
public stellate.app. Staging is the same droplet — a second nginx vhost over
`/srv/stellate-test`, noindexed, with `/found/` aliased at prod's media so the
~900 MB layer is never duplicated. aboardresearch.com is this tree served directly.

CI: `.github/workflows/verify.yml` runs the media guard + the full `./verify.sh`
suite on every PR/push in a clean clone with ZERO fetched media —
`node tools/build/ci-standin-media.js` synthesizes quiet-noise stand-ins at every
path the gates check (~1s, no network, never overwrites a real file).

Requires `ffmpeg`, `curl`, `node` (with `engine/faust/node_modules` — `npm ci` in
`engine/faust/`). No `csound` — main's toolchain is csound-free; the founding
`royal-road.csd` and its `render.sh` live on `legacy-csound`.

## Incorporating a sample CD

A repeatable pipeline for folding any archive.org **sample CD** (a zip of WAVs)
into the sample layer — `tools/fetch/fetch-sample-cd.sh` + `tools/fetch/classify-sample-cd.py`:

```bash
tools/fetch/fetch-sample-cd.sh <archive-item> <zip-filename> <prefix> [dest]
# e.g. Fatboy Slim's "Skip to My Loops" (79 generically-named WAVs, no metadata):
tools/fetch/fetch-sample-cd.sh fatboy-slim-skip-to-my-loops \
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
4. **register**: paste the curated snippet into `engine/registry-data.js`
   `SAMPLES` (grouped under a `// --- <CD name> ---` comment); append the crate
   entries to `found/samples/manifest.json`.
5. **wire into genres** (`engine/genres-data.js`) — MATRIX-SAFE ONLY: add ids to
   a genre's **existing**
   `found.sources` pool (same role: loops→`role:"break"` genres, chops→`role:"chops"`
   genres) or to `hits.sources` (always safe). NEVER add a `found:{role:…}` block to
   a genre lacking one, change a role, or touch bpm/scored fields — that shifts the
   confusion matrix. After every batch, `node engine/genre-verifier.js matrix
   --no-cache` MUST still print `diagonal dominant: 274/274`.

The audio lands gitignored under `found/`; the recipe + registry/genre edits are
the committed deliverable (the one rule). Credit the CD in SOURCES.md.

## Mining the MIDI trove

`tools/fetch/fetch-midi-trove.sh` pulls genre-labeled MIDI rips (MIDIMAN Melody Kit,
archive.org) onto the EXTERNAL drive (/mnt/sources/relocated/stellate-midi-corpus/rips — NEVER under found/, which ship.sh rsyncs to the droplet: the MIDI must not deploy); `tools/mine/mine-midi.js` (zero deps —
SMF parser, verifier-formula features, KK key detection, per-bar chord
estimation) measures them:

```bash
tools/fetch/fetch-midi-trove.sh                                 # one-time: ~34MB, 5 rips
node test/unit/midi-mine.test.js                               # parser gates (round-trip vs midi-export, keycheck)
node tools/mine/mine-midi.js calibrate jazz /mnt/sources/relocated/stellate-midi-corpus/rips/jazz    # corpus vs anchor renders vs TARGETS row
node tools/mine/mine-midi.js scan /mnt/sources/relocated/stellate-midi-corpus/rips/ragtime           # corpus feature distributions
```

Parsed ONCE into a derived SQLite corpus on the external drive
(`tools/mine/corpus-db.js` — needs `npm install` in `tools/`; note blobs + extracted
melody lines + 26-dim feature vectors; DB at
`/mnt/sources/relocated/stellate-midi-corpus/corpus.db`, OFF-repo because
ship.sh rsyncs `found/`): after the one-time build every corpus question is
milliseconds (`stats` / `keycheck` / `melody --rip x` / `near <id|path>` /
`bench`; gates in `test/unit/corpus-db.test.js`, CI-skips without node_modules).
Melody lines carry a `mel_conf` — statistics only trust `>=0.55`; polyphonic
skylines are flagged, never averaged in as lines.

`tools/fetch/fetch-midi-bulk.sh` pulls the ~104k-file unlabeled bulk straight to the
external drive; `tools/mine/mine-theory.js` fits FUNC_NEXT/POOL harmony tables from
the DB (dedup first, diatonic bigrams, train/test split) and `--splice`
regenerates the MINED block in `engine/theory.js` ONLY when the mined tables
beat the hand tables on held-out log-likelihood in both modes. The tables are
opt-in per state (`state.theory.tables:"corpus"`) — absent, theory output is
byte-identical (gates: `node test/unit/theory-tables.test.js`). The TABLES LAW in
`deriveMind` wires every reharm genre to the corpus tables — 201 of 274 anchors
reharm across seeds, and all 201 draw `tables:"corpus"`; an anchor opts out with
`tables:"hand"`. NOTE the verifier is
blind to the reharm walk (motion/seventh read the SKELETON progression), so
the matrix can't gate table changes — the gates that matter are the held-out
likelihood (mine-theory refuses a losing splice), the theory invariants, and
ears. `test/unit/meter.test.js` head_byte_identity trips on any uncommitted
tables-law change (intended drift: `state.theory.tables` + reharmed pitched
events; drums byte-identical) and self-heals on commit.

`tools/mine/mine-melody.js <rip>` mines melody phrase cells (modal 8-beat rhythm +
MEDOID real-phrase contour — never per-slot averages, the median of a thousand
melodies is a monotone) in MEL_PHRASES format; mined cells folkline/jazzline/
ragline/dubline (+"2" twins, generic per-chord alternation) are wired into
folk/jazz/ragtime/dub lead pools and fingerprint-gated by
`node test/unit/melody-cells.test.js`. `tools/mine/mine-groove.js <rip>` mines per-16th
velocity-accent profiles for the pipes `accentProfile` expression (only dub
carried real signal — jazz/folk velocities are flat, negative result noted in
pipes.js). `tools/mine/mine-weave.js <rip[:alias]>… --splice` fits the mined melody
ORGAN (MINED_WEAVE in csd-engine — Markov pitch walk over the voicing ladder +
IOI rhythm chain; patterns `<alias>weave`); the splice refuses any family that
loses to the wander baseline on held-out lines (wander itself measures worse
than uniform). Gates: `node test/unit/melody-weave.test.js`.

`calibrate` is the EXTERNAL check on a verifier row (everything else measures
the engine against its own renders). Provenance rules live in SOURCES.md: MIDI
never committed, statistics always committable, verbatim vocabulary only from
PD-composition rips. Known instrument caveats (velocity-as-amp, swing
estimator counts 16th syncopation, chord estimation not ground truth) are
documented at the top of `mine-midi.js` — read them before trusting a
divergence. What the corpus has actually changed in the shipping kernel: the
jazz hatDensity fence, the mined `dub_vamp`/`rag_cycle` progressions, and the
`ragtime` anchor — the first anchor authored from a measured corpus
(`genre-specs/ragtime.json`).

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
- `how.html` — the visual explainer of the pipeline. Its stage narrative +
  numbers must track csd-engine/genre-kernel reality. Since Stage D it links
  `app/pages.css` + `app/how.css` and `app/entries/how.js` rather than carrying
  them inline — that script move is what let the CSP drop `script-src
  'unsafe-inline'` (docs/HOSTING.md §4).
- `access.html` / `colophon.html` / `embed.html` / `404.html` — the other
  top-level pages. **Their URLs are load-bearing and do not move into a folder**
  (docs/TODO.md: oembed.json, security.txt, the PWA manifest and the published
  feed archive all hardcode them). `404.html` is the one page that still carries
  inline `<style>`, on purpose: nginx renders it from an *internal* `error_page`
  redirect, so the address bar keeps the URL that missed and a relative
  stylesheet href would resolve against the wrong directory.
- **NO INLINE `<script>` IN ANY COMMITTED PAGE.** The production CSP has no
  `script-src 'unsafe-inline'`; a `<script>` without `src`, an `onclick=`
  attribute or a `javascript:` URL breaks the page in production and nowhere
  else. `test/gates/social-meta.test.js` gates it. (JSON-LD is data, and is the
  one exemption.)
- `app/` — THE app (no framework, no bundler; native `<script type=module>` +
  one stylesheet). Shared state threaded via imports, NOT accidental globals.
  `app/package.json` is NOT a package — it is a four-line `"type": "module"`
  MARKER, so node (which resolves module type from the nearest `package.json`,
  and would otherwise hit the root's `"type": "commonjs"`) can load these files
  for the pure-node probes. `vendor/espeak-ng/`, `vendor/simplex-noise/` and
  `vendor/three/` carry the same marker for the same reason. Never add
  dependencies to them; the browser never reads them.
  Foldered by job — `core/` (state/world/share), `audio/` (live/targeting/fonts/
  precache/export/notefeed), `map/` (starmap + its five pieces + glyphs),
  `panels/` (panels/inside/readouts/background, plus `inside/`'s five surfaces),
  `entries/` (`access.js` `embed.js` `how.js` for those three pages, and
  `analytics.js`, the goatcounter shim `index.html` loads as a classic script —
  `index.html`'s own entry is `main.js`), `starcruise/` (the 3D view's own
  modules) — with `main.js`, the aliens controller `starcruise.js` and its
  `starcruise-load.js` at the top:
  - `app/app.css` — all of the former inline `<style>` (the whole UI stylesheet);
    `index.html` and `embed.html` link it. The static pages have their own:
    `app/pages.css` (chrome shared by how + colophon) + `app/how.css` /
    `app/colophon.css`, and `app/access.css` standing alone (a different design
    system — system-ui faces, a role-named accessibility palette). Link
    `pages.css` FIRST; the page files finish declarations it leaves open.
  - `main.js` — entry: imports the feature modules (wiring their listeners/subs/
    `window.__` hooks), assembles `window.__X`, then runs the one-shot boot
    sequence (layout → default loop → centre → score → tickers). Gates boot on
    the stylesheet applying so `#map` is viewport-sized before the layout runs.
  - `core/state.js` — the store hub: `S`/`set`/`subs`, the preact/htm `html`/`render`
    helpers, the `K`/`V`/`E` engine aliases, `esc`/`deep`, and `QSFLAGS`
  - `core/world.js` — the star map's logical space: the `POS` seed, computed world
    bounds (`WORLD_W/H`/`MAP_CENTER`/`recomputeWorld`), blend/space constants
  - `audio/targeting.js` — `weightsAt`/`retarget` (point → genre blend → engine state)
    + the glide engine (`glideStep`/`rebuildQueue`) + path `travelStep`
  - `map/starmap.js` — the map's PUBLIC API and nothing else: 23 lines of
    re-exports over five modules beside it, so `main.js` / `panels/panels.js` /
    `entries/embed.js` import this and never reach below it. `viewport.js` (the
    `#map` svg handle + the zoom transform) ← `layout.js` (ENERGY, REGIONS,
    `computeGenreLayout`, `autoPath`, `seedDefaultLoop` — geometry, no input, no
    drawing) ← `draw.js` (`drawMap`, the imperative SVG rebuild + the traveler
    pulse rAF) ← `gestures.js` (drag/pan/pinch/scrub + waypoint editing), plus
    `viz-zoom.js` (the ⓘ panel's own transform). The graph is acyclic and
    one-way, which fixes evaluation order. `map/glyphs.js` is separate.
    `layout.js` measures **monospace** for the relaxation so it's byte-identical
    every load (the visible labels use the VT323 webfont; the layout must not
    race it — and the split's extra module fetches made that race winnable, so
    the font is pinned there explicitly)
  - `panels/inside.js` — the ⓘ "inside the sound" readout: the PANEL SHELL that
    assembles the data (`vizData`) and the page (`renderInside`) and owns the
    audit-truth read. Each surface it draws is its own module in `panels/inside/`
    — `describe.js` (the NAMING layer: every word the panel may say about a
    sound, the provenance law that never names a source, the genre hue),
    `feel.js` (the feel radar), `timeline.js` (voice lanes, piano roll, pages,
    playhead — always 8 cells, chordEvery-16/32 genres fold into stacked rows),
    `graph.js` (per-voice/master fx as a node graph, not captions),
    `captions.js` (the word lines: harmony/form chips, the mind's moves, the
    micro-timing). The per-bar event reconstruction and the DemoLayer note feed
    live in `audio/notefeed.js` — see below — so `audio/` never imports the panel
  - `panels/background.js` — the MicroW8 demoscene background program + the ▢→▦ chip
    that toggles off → demoscene; cart rotates every 8 bars on the musical
    clock with a wall-clock backstop. There is no laserdisc video layer and no
    wav/mp3 download cluster here; both live on branch `legacy-download-video`.
    The one export that survives is ⤓ midi — see `audio/export.js`
  - `audio/live.js` — the live engine: owns `faustHandle` + `goLive`/`stopLive`, the
    honest boot-progress hairline, `?wavDebug` overlay, `?clicktest` bed, Media Session
  - `audio/notefeed.js` — `barVoiceEvents` (one chord-bar of engine events,
    re-simulated exactly as faust/live.js walks them) + `scheduleBarNotes`, the
    DemoLayer note feed. Read by BOTH `audio/live.js` (per bar, handed the engine
    clock) and `panels/inside.js` (the ⓘ timeline) — which is why it sits here and
    not in the panel: the playing path must not depend on a readout panel
  - `panels/panels.js` — the ⚙ controls (preact-rendered) + chip↔modal plumbing incl.
    the ⧉ embed snippet and the ⤓ midi button; registers the store render subs
  - `audio/export.js` — ⤓ midi ONLY: `engine/midi-export.js`
    fed `S.playing` — the same state/seed/path position the ↗ share URL names,
    so the file is the music on screen — named `stellate-<genre>-seed<n>-m<bar>.mid`
    (ASCII). The wav/mp3 offline press and the whole-path journey walk stay
    excised (branch `legacy-download-video`). Gate: `test/browser/midi-export.test.js`
  - `panels/readouts.js` — the playhead/chyron lower-third (self-ticking; there is
    no separate ⚡ CPU meter box — load/eco reads out in the chyron tech line)
  - `starcruise.js` + `starcruise-load.js` + `starcruise/` (15 modules:
    scene/camera/flight/ship/planet/alien/backdrop/props/postfx/geom/traits/bridge/probes
    + the generated `genre-coords.js` / `genre-clusters.js`) — the 🛸 star-cruise
    3D flythrough (docs/STARCRUISE.md). NOT on the boot path: `index.html` never
    loads it; `panels/panels.js` dynamic-imports it through `starcruise-load.js`
    the first time the ✦ cycle reaches the aliens view, and the controller
    dynamic-imports three.js only on the first `start()`. Evaluating it publishes
    `window.__STARCRUISE`, which is how `panels/background.js` and the gates find
    it — the gates arm it with `window.__ensureStarcruise()`, never by racing a
    click
- `engine/` — the deterministic core + WASM engine (classic global scripts; NOT
  modules — the app reads them off `window`):
  - `csd-engine.js` — the score brain: `buildEvents(state)` → pitched/drums/found/
    sfx events + PROGRESSIONS/kits/patterns vocabulary, incl. ODD METERS —
    `state.meter {beats,unit}` (absent = 4/4, byte-identical), kits
    waltz/waltzswing/sixeight, bass oompahpah/waltzroot/siciliana, melody
    waltz/lilt6, chordEvery defaulting to 6 under meter (`test/unit/meter.test.js`).
    (csound codegen: `legacy-csound`.)
  - `theory.js` — `CsdTheory`, the harmony brain (MUSIC-MIND organ #1): modes,
    voice-leading, and a functional-harmony progression generator with an
    `adventure` knob; consumed by buildEvents via `state.theory.reharm`
    (docs/MUSIC-MIND.md; `node test/gates/theory.test.js`)
  - `pipes.js` — `CsdPipes`, the scheduler as pipes (MUSIC-MIND organ #2): seeded
    event transforms (harmonize/echoCanon/strum/ghost/callResponse/densityArc +
    per-note expression annotations) run on `state.pipes` at the buildEvents
    choke point, before the snare-law (`node test/gates/pipes.test.js`)
  - `genre-kernel.js` — genre as a point in multidimensional space; blend/track/
    playlist/journey generators emitting engine states (design: docs GENRE-SPACE.md).
    The ALGEBRA only — see "Where the genre data lives" above
  - `genres-data.js` + `registry-data.js` — the anchors and the registries, as
    classic scripts publishing `window.__GENRES` / `window.__REGISTRY`. They load
    BEFORE `genre-kernel.js`, which merges them at load
  - `speech.js` — `CsdSpeech`, the SPEECH organ: deterministic espeak-ng WASM
    text-to-speech (`vendor/espeak-ng/`, loaded lazily by dynamic `import()`, so
    the ~1.7 MB costs nothing until a `synthText` source arms). Every spoken line
    is **synthesized, never fetched** — 230 `SAMPLES` entries declare `synthText`
    and the kernel carries the field onto any state that draws one, and on top of
    that the namebank IDENT organ speaks a station ident for every anchor whose
    `form` is dj/drop/vamp (65 of 274) plus the bespoke `SPEAKERS` genres
    (transitwave's PA, airtrafficdrone's ATC…). Between the two, 166 of 274
    genres say something at seeds 1/5/7. A fresh wasm instance per utterance is
    the LAW of the artifact, not an optimization: espeak's wavegen consumes
    libc `rand()`, so only a fresh instance replaying the same call sequence is
    byte-identical — which is why node press and the browser hear the same take
  - `genre-verifier.js` — symbolic genre-conformance scoring + confusion matrix
    (`node engine/genre-verifier.js matrix` must stay diagonal-dominant); the
    23 features are listed by `validate-genres.js`'s dead-axis gate
  - `validate-genres.js` — the gate suite (determinism, vocabulary, coverage…;
    `--audio` renders probes via faust press for the classifier), with the
    individual checks factored into `engine/checks/` (`blend-monotonicity`
    `dead-axis` `determinism-fuzz` `margin-sentinel` `near-duplicate`)
  - `invariants.js` (`verify.sh` row `prove`) + `prove-matrix.js` — the formal
    half: interval proofs / property sweeps (docs/INVARIANTS.md) and the offline
    matrix prover, differentially cross-checked against each other
  - `verify-lib.js` — the shared caching + fork-sharding plumbing behind matrix /
    validate / verify.sh (cache under `engine/scratch/.verify-cache/`)
  - `columns.js` (columnar events), `musicality.js` (docs/MUSICALITY.md — proving
    genres GOOD, not just distinct), `genre-geometry.js` + `genre-sim.js` (the
    shared feature-space geometry and the node-safe star-map similarity)
  - `namebank.js` — invents band/album/roster identities for the chyron
  - `demo-layer.js` — MicroW8 demoscene background carts (off until toggled)
  - `song-verifier.js` — `analyzeSong`/`improveSong`: the verifier half of the loop
  - `midi-export.js` — Standard MIDI File from the same buildEvents walk; TWO
    callers: the browser's ⤓ midi download (`app/audio/export.js`; loads AFTER
    csd-engine, boot-smoke enforces it) and the MIDI-corpus gates' reference
    SMF writer (`test/unit/midi-mine.test.js`, `test/unit/corpus-db.test.js`)
  - `faust/` — THE engine (see docs `history/FAUST-PORT.md`, `engine/faust/VOICES.md`).
    Split by JOB — `live/` (the realtime runtime: `live.js`
    `ring-player.js` `sentinel-processor.js` `stream-worker.js` `stream-renderer.js`
    `stem-worker.js` `engine.js`) · `press/` (offline: `press.js` `render-core.js`
    `offline-render.js`) · `voices/` (`state-engine.js` `sampler.js` `found-player.js`) ·
    `codec/` (`fmp4.js` `mp3-stream.js` `mp3-worker.js` `wav.js`) · `build/` (one-shots:
    `build.js` `make-fixture.js` `extract-gm.js` `sf2.js` `sysex2params.js`) · `data/`
    (~1.3 MB of JSON: `dx7-presets.json` `fonts.json` `font-*.json` `fixture.json`) ·
    `dsp/` `dist/` `vendor/` `patches/` `node_modules/` sit unfoldered beside them.
    The three-deep
    paths are LOAD-BEARING: `<script src>` in index/embed/access/test-live-test,
    `new Worker()`/`addModule()` URL strings, the nginx `location =` block for
    `data/dx7-presets.json` (HOSTING.md §5) and `test/gates/boot-smoke.test.js`'s registry:
    - `dsp/` + `dist/` — one precompiled WASM AudioWorklet per synthesis model
      (`node engine/faust/build/build.js` rebuilds); DX7 family decodes real cartridge banks
    - `voices/state-engine.js` — state → voice units + param/event mapping (shared by live + press)
    - `voices/sampler.js` + `build/sf2.js` + `build/extract-gm.js` — the sampled layer (default):
      full General MIDI extracted from a FluidR3-class SoundFont, played back
      through per-voice Faust effect chains; synths are the fallback/color.
      **Zones are WAV at 44.1 kHz and the MP3 diet has NOT been applied to them** —
      measured on the committed registry: 629 of 629 zones `.wav`, every sampler
      `sr: 44100`, zero carrying `len`. Beds and speech DID get the diet (244 mp3s
      under `found/samples/`, gated by `test/browser/mp3-bed-decode.test.js`, whose
      own header states the split: "beds + speech ship as MP3; zones/breaks stay
      WAV"). Zones are the hard case because they LOOP: `ls`/`le` are absolute
      sample indices at `sr`, and WebKit hands back a constant 1105-sample MP3
      lead-in as audio, which lands every baked index 25 ms early — an audible click
      at every loop wrap on the 552 of 614 zones that loop. Both halves of the fix
      are WRITTEN — `tools/build/transcode-samples.js` bakes `len`, and
      `sampler.js zoneLeadIn()` detects the pad by comparing decoded length to
      `len × (ctxRate / sr)` rather than sniffing the UA — and **neither has ever
      run against a real mp3 zone**, because none exist. Treat the zone diet as an
      untested path, not a shipped one: prove the loop-wrap alignment on a handful
      of zones across all three decoders before converting 1372 files.
      `zones.json` is extractor output only; the browser reads `K.SAMPLERS`
    - `live/live.js` — `FaustLive.exploreLive`: chord-bar JIT scheduler on the WebAudio
      clock, voice pools, eco-mode load shedding. Desktop rides a SharedArrayBuffer
      ring (`ring-player.js`, `stream-worker.js`, `stream-renderer.js`) and a
      hidden desktop tab KEEPS PLAYING (`test/browser/bg-survival.test.js`'s
      contract); mobile
      takes the **WAV-FIRST** path — a real `<audio>` element fed rendered media
      segments so audio survives pocket/lock (`docs/WAV-FIRST.md`)
    - `voices/found-player.js` — native found sound: granular bed + slice chopper on
      `AudioBufferSourceNode`s; `decodeUrlToBuffer` skips recording lead-in and
      boost-normalizes quiet speech (the spokenword fix)
    - `press/press.js` — offline render (faustwasm offline processors + PCM found mix)
- `tools/` — Node CLIs + shell recipes, split by JOB (one flat folder had grown
  to 63 files). `tools/kernel-cli.js` stays at the top
  level — it is the project's front-door command — and everything else lives in
  one of six folders:
  - `tools/fetch/` (12) — the media recipes: `fetch-found-*.sh`,
    `fetch-guitar-samples.sh`, `fetch-bed-expansion.sh`,
    `fetch-hits-expansion.sh`, `fetch-midi-{trove,bulk}.sh`,
    `fetch-sample-cd.sh` + its analyzer `classify-sample-cd.py`. Each one
    `cd`s to the repo root first; the audio lands gitignored under `found/`.
  - `tools/mine/` (6) — the MIDI corpus: `corpus-db.js` and
    `mine-{midi,theory,melody,groove,weave}.js`.
  - `tools/genre/` (21 + `README.md`) — everything that authors, edits or
    interrogates a genre. Five are pipeline (`genre-tool.js` `invent-genres.js`
    `lerp-genre.js` `rm-genre.js` `gen-genre-info.js`) — they write the committed
    kernel or are invoked by a gate. Sixteen are hand-run analysis with NO
    caller: nothing in the app, the engine, `verify.sh` or the deploy path runs
    them, and their headers cite section numbers in a `docs/ROADMAP.md` that no
    longer exists. **`tools/genre/README.md` says which is which** — read it
    before assuming a tool there is wired into anything.
  - `tools/build/` (14 + `voxbank-phrases.json`) — the generators of committed
    or derived artifacts: `gen-{feed,font,og-card,voice-bank}.js`,
    `cluster-genres.js` + `feature-layout3d.js` (they emit
    `app/starcruise/genre-{clusters,coords}.js`), `relayout-map.js` (re-bakes
    `app/core/world.js` POS), `split-kernel-data.js`, `speech-to-live.js`,
    `ci-standin-media.js`, `make-mix-page.js` (mix/index.html + mix.m3u from a
    rendered playlist dir), `sing.py`, and the media diets
    `transcode-samples.js` (the instrument-zone MP3 diet: converts in place and
    re-bakes the `SAMPLERS` block — `--dry` measures without writing, a sampler
    with any failed zone rolls back whole so one instrument is never half-rate)
    + `transcode-beds.js`.
  - `tools/deploy/` (3) — `ship.sh`, `deploy-staging.sh` and `deploy-stellate.sh`.
    **STAGING IS THE DEFAULT TARGET**: bare `ship.sh` deploys to
    test.stellate.app; the public site moves only on `ship.sh --prod`.
  - `tools/audit/` (4) — read-only measurement: `audio-verifier.py`,
    `font-coverage.js`, `measure-loop-cap.js`, `simulate-path.js`.

  (All rendering is Faust-press now; the csound `render.sh` is on
  `legacy-csound`.)
  - `tools/genre/genre-tool.js` — author a genre anchor from a `genre-specs/*.json` spec:
    validates against the live engine vocabulary, MEASURES verifier targets
    from real renders (auto-tightened so no existing diagonal falls), splices
    `genres-data.js` + `genre-verifier.js` in house style, runs the gates.
    `genre-specs/` is BIDIRECTIONAL and complete — 274 specs for 274 anchors, one
    each — because `genre-tool.js export --all` writes the specs back out from
    the live kernel. `test/gates/genre-specs.test.js` (`verify.sh` row `specs`)
    runs `export --all --dry-run` and fails, naming the genre, on any anchor
    edited without a re-export. It went one-directional once and rotted to 135
    stale files; the round-trip gate is what stops that recurring. Notes: `spec.pos` is
    OPTIONAL (omit it and boot derives a star near the genre's musical family
    — re-bake `app/core/world.js` POS after the batch); the tool applies
    `K.deriveMind` to the injected anchor so create-time measurement matches
    load; and `MIND_OVERRIDES` is applied INSIDE `deriveMind`, so overrides beat
    derivation identically at measurement, serialization, and load.
- `test/` — every gate is `<name>.test.js` and **the folder says what it needs**.
  One naming convention, six folders; a filename suffix never encodes the
  runtime, because the last scheme that tried it left a third of the browser
  glob pointing at pure-node files:
  - `test/gates/` (13) — the release suite: the 10 jobs `verify.sh` runs out of
    `test/` (`engine` `social-meta` `prove-matrix` `kernel-data-identity`
    `genre-specs` `pos-coverage` `coords-coverage` `live-walk-parity`
    `boot-smoke` `doc-counts`) plus the MUSIC-MIND/speech organ gates
    `theory`/`pipes`/`speech`. Pure node, CI-safe.
  - `test/unit/` (36) — pure-node gates outside the release suite
    (`meter` `invariants` `musicality` `melody-cells` `melody-weave`
    `theory-tables` `midi-mine` `corpus-db` `snare-law` `strip-fuzz` …).
    `npm run test:unit` runs them (concurrently, via `test/run.js`); before that
    runner existed nothing globbed them at all and 33 gates only ever ran if
    somebody named the file.
  - `test/browser/` (25) + `test/starcruise/` (8) — the gates that launch real
    chromium via `test/lib/probe-harness.js`. `npm run test:browser` globs
    exactly these two folders and nothing else. They `goto /index.html` (or
    `test/browser/live-test.html`, the FaustLive harness page) and read the
    `window.__` debug hooks. `starcruise/` is the WebGL 3D-flight cohort;
    its three PURE proofs live in `unit/` (`flight`/`planet`/`traits`), which is
    what keeps the browser glob true.
  - `test/probes/` (7) — `<name>.probe.js`, hand-run instruments, not gates and
    in no npm script (`reverb` `wah` `mbcomp` `autotune` are offline faust;
    `modeld` `synthfont` `vapor` drive chromium).
  - `test/lib/` — shared, never executed as a gate: `probe-harness.js` (static
    server + chromium + `ensureStarcruise`), `fixtures.js` (the KERNEL-V4
    byte-stability harness), `comment-only.js`, `margin-baseline.json`.
- `tools/audit/audio-verifier.py` — EMPIRICAL gate: Essentia Discogs-EffNet genre model on
  rendered audio. Setup: `python3 -m venv .venv-verify && .venv-verify/bin/pip
  install essentia-tensorflow`, then download to `models/`:
  `discogs-effnet-bs64-1.pb` (essentia.upf.edu/models/feature-extractors/discogs-effnet/)
  and `genre_discogs400-discogs-effnet-1.{pb,json}` (…/classification-heads/genre_discogs400/).
  Use via `node tools/kernel-cli.js track jungle --render --audio-verify`.
- `docs/WAV-FIRST.md` — the mobile-audio design. Promoted out of `history/`
  because it describes shipped behaviour and four live docs cite it.
- `docs/history/` — planning records that live CODE still points at, so they
  are references rather than archaeology: `NEXT.md` (§5b columnar events,
  §5d mastering, §5f break pools — cited from `engine/columns.js`,
  `csd-engine.js`, `live.js`, `state-engine.js` and three tests),
  `ab-report.md` (the csound A/B `state-engine.js` was tuned against),
  `VALIDATION.md` (the gate policy `validate-genres.js` implements),
  `KERNEL-V4.md` (cited by `test/lib/fixtures.js` and `tools/genre/genre-tool.js`),
  `MATERIALS.md` (the commission brief SOURCES.md and two fetch scripts cite)
  and `ZERO-STATIC.md` (the ring/zombie-worklet law). The old csound-WASM pages
  (`builder.html` song builder, `play.html` player) live fully working on
  branch `legacy-csound`.
- `found/` — the fetched found-sound layer (gitignored except `.gitignore`;
  recipes: `tools/fetch/fetch-found-sound.sh` and friends, credits in SOURCES.md)
- `LICENSE` (MIT, © 2026 Paul Ford) + `NOTICE` (third-party carve-outs:
  MicroW8/lamejs/faustwasm) + `CONTRIBUTING.md` (the PR contract) +
  `SOURCES.md` (media policy + attribution ledger) + `.github/`
  (`workflows/verify.yml` CI gate, PR template)
- `docs/HOSTING.md` — the stellate.app hosting plan (droplet + nginx,
  same-origin media, COOP/COEP, R2 growth path)

## Deployment

The working tree **is** the web root: nginx serves it at
`https://aboardresearch.com/projects/stellate/` (the older
`/projects/vaporwave/` 301-redirects here — alias block in
`/etc/nginx/sites-enabled/aboardresearch`, `Cache-Control: no-cache`). File
moves/renames here are production changes; gitignored-but-present files
(`found/`, `engine/faust/node_modules`) are required for the live
site; `engine/faust/dist` is committed.
