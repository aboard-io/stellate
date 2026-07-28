# ARCHITECTURE — the render pipeline, end to end

One pass through the system: how a genre (a *point in space*) becomes sound, and
which laws keep every backend hearing the same music. Read `docs/GENRE-SPACE.md`
for the conceptual model and the kernel source itself for its internal
layout; this doc is the wiring diagram between files.

## The pipeline

```
  genre name / weights / drawn path
            │
            ▼
  engine/genre-kernel.js          "the space"  — the algebra
    resolveMulti / blend / mix  → a resolved STATE object (toState)
            │   (seeded, convex lerp of scalars + pool draws; deriveMind axes)
            │   the DATA it merges at load: engine/genres-data.js (GENRES)
            │                             + engine/registry-data.js (registries)
            ▼
  engine/csd-engine.js            "the score brain"
    buildEvents(state) → { pitched, drums, found, sfx, bpm, totalBeats }
            │   pure + deterministic: same state → byte-identical events
            │   consumes engine/theory.js + engine/pipes.js when present
            ▼
  engine/faust/voices/state-engine.js    "voices + fx"
    mapEvents / buildSchedule → Faust voice plan + per-note param sets
            │   (dist/ WASM voice modules; register-fold; recipe→param map)
            ▼
  ┌──────────────────┬───────────────────┬──────────────────────┐
  │  LIVE            │  PRESS (offline)  │  WAV-FIRST (mobile)  │
  │ faust/live/      │ faust/press/      │ rolling WAV segments │
  │   live.js        │   press.js (node) │ on a real <audio> el │
  │                  │ faust/live/       │                      │
  │                  │  stream-worker.js │                      │
  │                  │  (browser)        │                      │
  └──────────────────┴───────────────────┴──────────────────────┘
            │
            ▼
   audio out
```

## The stages

### 1. `engine/genre-kernel.js` — the space
A genre is a bundle of ~25 typed dimensions (scalar ranges, enum pools, recipe
bundles) stored as an object literal in `GENRES` (274 anchors). `resolveMulti`
takes a weight vector over existing anchor names, filters to `GENRES[g] && w>0`,
renormalizes, and produces ONE resolved state: scalars are convex combinations
(`Σ wᵢ·loᵢ … Σ wᵢ·hiᵢ`, then one seeded sample inside); pools DRAW members with
the seeded rng. `deriveMind` attaches the three MUSIC-MIND axes (theory, pipes,
rhythm) to every anchor at load. `blend(a,b,t)` and `mix(weights)` are thin
wrappers; `journey()` walks a drawn path. Output: a plain `state` object
(`toState`). **No neural embedding, no genre-to-genre distance metric** — the
"space" is combinatorial typed mixing. (The verifier's 23-feature vector, below,
is the one measured coordinate system.)

The kernel file is the ALGEBRA only. The anchors themselves live in
`engine/genres-data.js`, and the found-sound / sample / instrument / percussion
registries in `engine/registry-data.js` — both classic scripts publishing
`window.__GENRES` / `window.__REGISTRY`, loaded immediately before the kernel,
which merges them at load (under Node it `require`s them instead). They are
hand-edited source of truth, not build output; the `kernel-data-identity` gate
holds them byte-for-byte against HEAD, because key order and float printing are
what every seeded render and the whole matrix are downstream of. The one
generated field in `genres-data.js` is each anchor's `info` blurb, derived from
the anchor by `tools/genre/gen-genre-info.js` — never hand-written.

### 2. `engine/csd-engine.js` — the score brain
`buildEvents(state)` is the pure, deterministic event generator:
`{ pitched, drums, found, sfx, bpm, totalBeats }`. Every backend derives from
it, so they never drift. It consumes `engine/theory.js` (`CsdTheory` — the
harmony brain: key/scale, voice-leading, functional-harmony progression walks)
and `engine/pipes.js` (`CsdPipes` — the event stream as pluggable transforms:
harmonize, echoCanon, densityArc, …) when `state.theory` / `state.pipes` are
present. The snare-law pass runs dead last on the final timeline. Absent knobs →
byte-identical to the pre-organ output.

### 3. `engine/faust/voices/state-engine.js` — voices + fx
Pure mapping, no audio. `CsdEngine.buildEvents(state)` gives the events; this
maps each onto a `dist/` Faust voice module + per-note param sets, using the
recipe→param mappings in `engine/faust/VOICES.md`. It also enforces the
register-fold (`mapEvents` octave-folds any pitched sampler note outside its
natural zone window) and pins `state.regHome`. Consumed identically by press and
live so the mix is the same.

### 4. The three playback paths
- **LIVE** (`engine/faust/live/live.js`) — the browser AudioWorklet engine. Two
  `engine/faust/live/stream-worker.js` producers ping-pong on ring buffers (click-free by
  construction); `exploreLive` is the facade the explorer drives. Live-only
  taste (master bus, `userGain`, the Vapor EQ) rides the main-thread graph
  *after* `masterGain`, so it never touches the baked mix.
- **PRESS** (`engine/faust/press/press.js`, node) — full-length offline "pressing" of
  a state: the same `dist/` modules via faustwasm OFFLINE processors, plus the
  native found-sound layer mixed as PCM in JS (`found-player.js mixPCM`). The
  browser reuses the same core via `engine/faust/live/stream-worker.js` (`renderWav`,
  the background-WAV survival producer).
- **WAV-FIRST** (mobile) — pocket-proof iOS/mobile audio: rolling WAV segments
  played through a real `<audio>` element (no live graph). See
  `docs/WAV-FIRST.md`.

### The verifier (a parallel, offline coordinate system)
`engine/genre-verifier.js` extracts a **23-symbolic-feature** vector from
`buildEvents` output and scores any state against per-genre `TARGETS` boxes.
`matrix` builds the 274×274 confusion matrix; the kernel is tuned until every
genre scores highest as itself (**274/274 diagonal-dominant**). This is the
falsifiable "does this actually sound like jungle?" gate — and the one genuine
measured embedding in the system (`docs/GENRE-SPACE.md`). The 23 features are
enumerated by `validate-genres.js`'s dead-axis check, which fails on any axis
that stops varying. The genre-intelligence tools built on top of the embedding
live in `tools/genre/`; read `tools/genre/README.md` first — most of them have no
caller and no gate watching them.

## The laws that hold it together

1. **Byte-identical renders.** Same `state` → byte-identical `buildEvents`.
   Gated by `test/lib/fixtures.js` + `test/unit/segment-parity.test.js`. Every new optional
   dimension is **drawn LAST in `resolveMulti` and consumes ZERO rng when
   absent** — that is how the space grows without regressing fixtures.
2. **The matrix stays diagonal-dominant.** Every genre/kernel change re-runs
   `node engine/genre-verifier.js matrix --no-cache` → must stay 274/274.
3. **Plain-script load model.** `index.html` loads the whole of `engine/` as
   ordered plain `<script>` tags (see the load order below); `engine/` stays
   classic globals (no ES modules, no bundler). `app/` *is* ES modules, entered
   through the single `<script type="module" src="app/main.js">` at the end —
   the one exception being `app/entries/analytics.js`, a classic script that has
   to publish `window.goatcounter` before the vendored counter runs.
4. **Live-only audio / opt-in DSP** ride the graph after the baked mix, so
   they're byte-identical when absent.
5. **Machines verify structure; Paul's ears verify taste.**

## Engine load order (`index.html`, plain ordered `<script>`)

Sixteen classic scripts, in this order, each publishing the global named beside
it:

```
 1  engine/theory.js                     CsdTheory
 2  engine/pipes.js                      CsdPipes
 3  engine/csd-engine.js                 CsdEngine
 4  engine/genres-data.js                __GENRES
 5  engine/registry-data.js              __REGISTRY
 6  engine/genre-kernel.js               GenreKernel
 7  engine/genre-verifier.js             GenreVerifier
 8  engine/namebank.js                   NameBank
 9  engine/midi-export.js                MidiExport
10  engine/speech.js                     CsdSpeech
11  engine/demo-layer.js                 DemoLayer
12  engine/faust/voices/state-engine.js  FaustStateEngine
13  engine/faust/voices/found-player.js  FoundPlayer
14  engine/faust/voices/sampler.js       FaustSampler
15  engine/faust/live/live.js            FaustLive
16  app/entries/analytics.js             goatcounter

then:  vendor/goatcounter/count.js   (async — no load-order contract)
       app/main.js                   (type=module — the app/ tree's entry)
```

Three of the orderings are load-bearing and asserted by name: theory + pipes
before csd-engine, csd-engine before midi-export (the SMF writer reads
`window.CsdEngine` at load), and the two data files before genre-kernel (it
merges `__GENRES` + `__REGISTRY` at load, so an order slip is a blank app rather
than a warning). All sixteen must publish before `app/main.js`.

`test/gates/boot-smoke.test.js` is the gate — `verify.sh` row `bootsmoke`. It
parses the classic `<script src>` list out of `index.html` (skipping `module` and
`async` tags), replays it in a `vm` sandbox, and fails if a script moves,
disappears, throws, stops publishing its global, or appears without being
declared in its `EXPECTED` registry. `access.html` and `embed.html` hand-maintain
their own shorter lists — both drop midi-export and demo-layer; embed keeps
`app/main.js` and adds `app/entries/embed.js`, while access swaps the module
entry for `app/entries/access.js` entirely. `test/browser/live-test.html` carries
a fourth, relative-path list.

Each publishes via a UMD wrapper — `module.exports` under Node, `window.<Global>`
in the browser — so the same files run under `require` for the CLI and the gates.

## Where to go next
- `docs/ADDING-A-GENRE.md` — add an anchor without breaking the laws.
- `docs/INVARIANTS.md` — what is *proven* about the blend algebra.
- `engine/faust/VOICES.md` — the recipe→param voice mappings (stage 3 detail).
