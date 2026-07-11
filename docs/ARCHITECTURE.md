# ARCHITECTURE — the render pipeline, end to end

One pass through the system: how a genre (a *point in space*) becomes sound, and
which laws keep every backend hearing the same music. Read `docs/GENRE-SPACE.md`
for the conceptual model and `docs/KERNEL-MAP.md` for the kernel's internal
layout; this doc is the wiring diagram between files.

## The pipeline

```
  genre name / weights / drawn path
            │
            ▼
  engine/genre-kernel.js          "the space"
    resolveMulti / blend / mix  → a resolved STATE object (toState)
            │   (seeded, convex lerp of scalars + pool draws; deriveMind axes)
            ▼
  engine/csd-engine.js            "the score brain"
    buildEvents(state) → { pitched, drums, found, sfx, bpm, totalBeats }
            │   pure + deterministic: same state → byte-identical events
            │   consumes engine/theory.js + engine/pipes.js when present
            ▼
  engine/faust/state-engine.js    "voices + fx"
    mapEvents / buildSchedule → Faust voice plan + per-note param sets
            │   (dist/ WASM voice modules; register-fold; recipe→param map)
            ▼
  ┌─────────────┬──────────────────┬───────────────────────┐
  │  LIVE       │  PRESS (offline) │  WAV-FIRST (mobile)    │
  │ faust/live  │ faust/press.js   │ rolling WAV segments   │
  │  .js        │  (node) / stream │  on a real <audio> el  │
  │             │  -worker (browser)│                       │
  └─────────────┴──────────────────┴───────────────────────┘
            │
            ▼        (also: engine/midi-export.js → Standard MIDI File,
   audio out          straight off the same buildEvents walk)
```

## The stages

### 1. `engine/genre-kernel.js` — the space
A genre is a bundle of ~25 typed dimensions (scalar ranges, enum pools, recipe
bundles) stored as an object literal in `GENRES` (249 anchors). `resolveMulti`
takes a weight vector over existing anchor names, filters to `GENRES[g] && w>0`,
renormalizes, and produces ONE resolved state: scalars are convex combinations
(`Σ wᵢ·loᵢ … Σ wᵢ·hiᵢ`, then one seeded sample inside); pools DRAW members with
the seeded rng. `deriveMind` attaches the three MUSIC-MIND axes (theory, pipes,
rhythm) to every anchor at load. `blend(a,b,t)` and `mix(weights)` are thin
wrappers; `journey()` walks a drawn path. Output: a plain `state` object
(`toState`). **No neural embedding, no genre-to-genre distance metric** — the
"space" is combinatorial typed mixing. (The verifier's 23-feature vector, below,
is the one measured coordinate system.)

### 2. `engine/csd-engine.js` — the score brain
`buildEvents(state)` is the pure, deterministic event generator:
`{ pitched, drums, found, sfx, bpm, totalBeats }`. Every backend derives from
it, so they never drift. It consumes `engine/theory.js` (`CsdTheory` — the
harmony brain: key/scale, voice-leading, functional-harmony progression walks)
and `engine/pipes.js` (`CsdPipes` — the event stream as pluggable transforms:
harmonize, echoCanon, densityArc, …) when `state.theory` / `state.pipes` are
present. The snare-law pass runs dead last on the final timeline. Absent knobs →
byte-identical to the pre-organ output.

### 3. `engine/faust/state-engine.js` — voices + fx
Pure mapping, no audio. `CsdEngine.buildEvents(state)` gives the events; this
maps each onto a `dist/` Faust voice module + per-note param sets, using the
recipe→param mappings in `engine/faust/VOICES.md`. It also enforces the
register-fold (`mapEvents` octave-folds any pitched sampler note outside its
natural zone window) and pins `state.regHome`. Consumed identically by press and
live so the mix is the same.

### 4. The three playback paths
- **LIVE** (`engine/faust/live.js`) — the browser AudioWorklet engine. Two
  `stream-worker.js` producers ping-pong on ring buffers (click-free by
  construction); `exploreLive` is the facade the explorer drives. Live-only
  taste (master bus, `userGain`, the Vapor EQ) rides the main-thread graph
  *after* `masterGain`, so it never touches the baked mix.
- **PRESS** (`engine/faust/press.js`, node) — full-length offline "pressing" of
  a state: the same `dist/` modules via faustwasm OFFLINE processors, plus the
  native found-sound layer mixed as PCM in JS (`found-player.js mixPCM`). The
  in-browser press reuses the same core via `engine/faust/stream-worker.js`
  (`renderWav` / `renderLoop`) for ⤓ wav/mp3 (see `docs/EXPORT.md`).
- **WAV-FIRST** (mobile) — pocket-proof iOS/mobile audio: rolling WAV segments
  played through a real `<audio>` element (no live graph). See
  `docs/history/WAV-FIRST.md`.
- **MIDI** (`engine/midi-export.js`) — `buildMidi(state)` emits a type-1 SMF
  from the same `buildEvents` walk (⤓ midi).

### The verifier (a parallel, offline coordinate system)
`engine/genre-verifier.js` extracts a **23-symbolic-feature** vector from
`buildEvents` output and scores any state against per-genre `TARGETS` boxes.
`matrix` builds the 249×249 confusion matrix; the kernel is tuned until every
genre scores highest as itself (**249/249 diagonal-dominant**). This is the
falsifiable "does this actually sound like jungle?" gate — and the one genuine
measured embedding in the system (`docs/GENRE-SPACE.md`, and the Workstream-1
genre-intelligence tooling built on top of it).

## The laws that hold it together

1. **Byte-identical renders.** Same `state` → byte-identical `buildEvents`.
   Gated by `test/fixtures.js` + the `segment-parity` gate. Every new optional
   dimension is **drawn LAST in `resolveMulti` and consumes ZERO rng when
   absent** — that is how the space grows without regressing fixtures.
2. **The matrix stays diagonal-dominant.** Every genre/kernel change re-runs
   `node engine/genre-verifier.js matrix --no-cache` → must stay 249/249.
3. **Plain-script load model.** `index.html` loads `engine/*.js` + `app/*.js` as
   ordered plain `<script>` tags (see the load order below); `engine/` stays
   classic globals (no ES modules, no bundler). `app/` *is* ES modules.
4. **Live-only audio / opt-in DSP** ride the graph after the baked mix, so
   they're byte-identical when absent.
5. **Machines verify structure; Paul's ears verify taste.**

## Engine load order (`index.html`, plain ordered `<script>`)

```
engine/theory.js → engine/pipes.js → engine/csd-engine.js →
engine/genre-kernel.js → engine/genre-verifier.js → engine/namebank.js →
engine/midi-export.js → engine/speech.js → engine/video-layer.js →
engine/demo-layer.js → engine/faust/state-engine.js →
engine/faust/found-player.js → engine/faust/sampler.js →
engine/faust/live.js → app/main.js  (ES-module entry for the app/ tree)
```

Each `engine/*.js` publishes one global (`CsdTheory`, `CsdPipes`, `CsdEngine`,
`GenreKernel`, `GenreVerifier`, `FaustStateEngine`, `FaustLive`, …) via a UMD
wrapper, so the same files run under Node (`require`) for the CLI and gates.

## Where to go next
- `docs/KERNEL-MAP.md` — inside the kernel.
- `docs/ADDING-A-GENRE.md` — add an anchor without breaking the laws.
- `docs/INVARIANTS.md` — what is *proven* about the blend algebra.
- `docs/EXPORT.md` / `docs/VIDEO-EXPORT.md` — the download/capture paths.
- `engine/faust/VOICES.md` — the recipe→param voice mappings (stage 3 detail).
