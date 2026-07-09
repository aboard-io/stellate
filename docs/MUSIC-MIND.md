# MUSIC-MIND — the music-intelligence program

*2026-07-09. The question: what would make richer, more interesting, more
complex music across all 178 genres — applying music theory automatically,
exploring rhythmic and chromatic ideas, more polyphony where it earns its
place — while keeping the listener locked in?*

The answer is three new organs and a set of new genre-space axes, all behind
the two standing laws: **determinism** (same seed → byte-identical events;
absent knob → byte-identical output) and the **matrix** (178/178
diagonal-dominant after every change).

## The diagnosis

`buildEvents` is one brain with three limitations found by reading it whole:

1. **Harmony is table-lookup.** `PROGRESSIONS` are 28 hand-voiced static
   tables. No Key/Scale abstraction, no voice-leading engine, no runtime
   borrowed chords or secondary dominants — chromatic color is frozen per
   progression name. Every jazz track walks the same ii-V-I voicings forever.
2. **Events flow one way.** Generation stages are hard-wired; there is no
   seam to transform the event stream (echo, harmonize, thin, swell) without
   editing the stage itself. The scheduler is a machine, not a set of pipes.
3. **The Faust surface is mostly frozen.** Voices expose cutoff, vibrato,
   PWM, sends… per-note; the score brain sets them once per voice. Only
   `freq/gain/decay` (+ tb303 accent/slide) vary note-to-note.

## The three organs

### 1. `engine/theory.js` — `CsdTheory` (the harmony brain)

Pure, seeded, no dependencies. UMD like every engine file.

- **Key/Scale**: modes (ionian…locrian, harmonic/melodic minor, hijaz,
  pentatonics), scale-degree math, chord-from-degree with qualities
  (triad, 7th, 9th, 11th, 13th, sus, quartal).
- **Voice-leading**: `lead(prevVoicing, chord, style)` — minimal-motion
  4–6 voice voicings; styles `close|open|drop2|quartal|cluster`.
- **Progression generator**: `progress({mode, adventure, bars, seed})` — a
  functional-harmony walk (T→S→D→T graph) whose `adventure ∈ [0,1]` gates,
  in order: diatonic 7ths → modal interchange (borrowed iv, ♭VI, ♭VII) →
  secondary dominants (V/x at cadences) → chromatic mediants & tritone subs.
- **Output contract**: chords in the exact `PROGRESSIONS` shape
  (`{name, pads[4..6], bass{r5,r6,f6}, lead[4]}`, pch strings via the same
  oct.pc convention) so `buildEvents` consumes them unchanged.

Consumed by `buildEvents` when `state.theory` is present:

```js
state.theory = { adventure: 0..1,   // harmonic risk appetite
                 voicing: "close"|"open"|"drop2"|"quartal"|"cluster",
                 color: 0..1,       // extension richness (triads → 13ths)
                 reharm: true }     // regenerate the progression per song
```

When `reharm`, the named `state.progression` supplies mode + length as the
skeleton and CsdTheory regenerates/re-voices per song on its own rng stream
(`seed+40961`). When absent: byte-identical to today.

### 2. `engine/pipes.js` — `CsdPipes` (the scheduler as pipes)

The event stream becomes plumbing: `state.pipes = [{id, ...params}]`, applied
inside `buildEvents` **just before the snare-law pass** (so the law still
runs dead last on the final timeline). Each pipe is a pure seeded transform
`(events, state, rng, params) → events` on the whole
`{pitched, drums, found, sfx}` bundle; pipe *i* draws from
`mulberry32(seed + 71000 + i*97)`. Every consumer — press, live, MIDI
export, the verifier — hears the same music, because the pipes run at the
one true choke point.

Launch library (each ~20–40 lines, registry-extensible):

| pipe | what it does | listener effect |
|---|---|---|
| `harmonize` | adds scale-locked parallel 3rds/6ths to melody (prob per note) | instant polyphony that can't clash |
| `echoCanon` | delayed, transposed, quieter copy of melody phrases (within the chord bar) | imitation, depth |
| `strum` | rolls pad chords by a few ms per voice, direction alternates | humanity on pads |
| `ghost` | injects quiet approach/ghost notes before bass hits | groove pocket |
| `callResponse` | alternate melody phrases get register/pan/level flips | conversation |
| `densityArc` | thins/thickens events over each section (intro sparse → peak dense) | long-range shape |
| `sweepArc` | writes per-note `cutoffMul` following a phrase-length arc | filter as gesture |
| `vibratoSwell` | long notes get `vib` depth ramping in | singing sustains |
| `throwFx` | last note of a phrase gets a `rsendMul`/`dsendMul` throw | dub punctuation |
| `octavePump` | duplicates bass notes an octave up on weak beats (prob) | drive without new notes |

Expression pipes write **annotation fields** on pitched events
(`cutoffMul, vib:{depth,rate}, rsendMul, dsendMul, pw`) which
`state-engine.mapEvents` translates to per-note `sets` **only when the
voice's model exposes the param** (per-model whitelist; silently dropped
otherwise). The verifier reads none of these fields — expression is
matrix-neutral by construction. Musical pipes (harmonize, echoCanon…) do
shift features; genres opt in and the matrix is retuned to stay 178/178.

Live caveat: live builds one chord-bar per call; pipes therefore never emit
outside the build's own `[0, totalBeats)` window (echo/canon delays cap at
the chord bar).

### 3. Rhythmic + chromatic exploration in `csd-engine.js`

- **Clave/cell bass**: new `BASS_PATTERNS` cells — `tresillo` (3-3-2),
  `son` (clave-locked), `hemiola` (3-against-4), `charleston` — plus a
  seeded per-cycle **cell mutation** (existing humanize stream style) so
  bass lines breathe across cycles instead of looping.
- **Melody rhythm cells**: generative styles gain a rhythm-cell layer
  (dotted pairs, tresillo, 3-3-2-3-3-2 over two bars) selected per phrase on
  the melody stream, gated by `state.rhythm.complexity`.
- **Polymeter perc**: `perc.lanes` learn non-4 cycle lengths (3- and 5-beat
  cells tiling over the bar) — decorative lanes only, invisible to the
  matrix by design.

```js
state.rhythm = { complexity: 0..1 }   // absent = byte-identical
```

## The vector space grows new axes

Anchors gain (all optional; blending via the existing `wRange`/pool rules):

| axis | anchor field | state field | drives |
|---|---|---|---|
| harmonic adventure | `theory:{adventure:[lo,hi], voicing, color}` | `state.theory` | CsdTheory reharm/voicings |
| pipes | `pipes:[{id,prob,...}]` | `state.pipes` | CsdPipes chain |
| rhythmic complexity | `rhythm:[lo,hi]` | `state.rhythm` | bass cells, melody cells |

Anchor values are **derived heuristically** from what each anchor already
declares (progressions pool → adventure/color; kit/euclid → complexity;
lead/counter → harmonize/echo pipes) then spot-curated — jazz/neosoul/fusion
adventurous, techno/minimal near zero (restraint is an identity too). A
genre's intelligence lives *in the space*: blends inherit and interpolate it.

## What "locked in" means (the taste constraints)

- Adventure raises *cadence-point* color first — tonic and dominant anchors
  stay; the ear keeps its handrail.
- Harmonize/echo never exceed one added voice per melody note; density arcs
  never mute the kick lane.
- Everything new defaults off per-state; genre anchors opt in at curated
  levels; the matrix gate proves each genre still reads as itself.

## Phases

1. **Organs** (parallel, new files): `theory.js` + `test/theory.test.js`;
   `pipes.js` + `test/pipes.test.js`. Pure-node tests.
2. **Wiring** (one agent on shared files): csd-engine consumes
   `state.theory`/`state.pipes`/`state.rhythm` (+ bass/melody cells);
   state-engine maps annotation fields; index.html loads the organs before
   csd-engine.
3. **Space**: genre-kernel resolves + emits the new axes; anchor derivation
   + curation.
4. **Gate + tune**: `./verify.sh --full`, matrix back to 178/178, fixture
   refresh, docs.

## Verification

`node test/theory.test.js` · `node test/pipes.test.js` · gate 1 determinism
(absent knobs byte-identical **and** present knobs seed-stable) ·
`node engine/genre-verifier.js matrix --no-cache` → 178/178 ·
`node test/engine.test.js --quick` non-silent presses · ears via the live app.
