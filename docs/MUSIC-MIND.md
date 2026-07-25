# MUSIC-MIND — the music-intelligence program

*2026-07-09. The question: what would make richer, more interesting, more
complex music across all 178 genres (the space's size when this was written;
249 as of 2026-07-11, and the laws below hold at 249) — applying music theory
automatically, exploring rhythmic and chromatic ideas, more polyphony where it
earns its place — while keeping the listener locked in?*

The answer is three new organs and a set of new genre-space axes, all behind
the two standing laws: **determinism** (same seed → byte-identical events;
absent knob → byte-identical output) and the **matrix** (every genre
diagonal-dominant after every change — 249/249 today).

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
shift features; genres opt in and the matrix is retuned to stay
diagonal-dominant (249/249 today).

Live caveat: live builds one chord-bar per call; pipes therefore never emit
outside the build's own `[0, totalBeats)` window (echo/canon delays cap at
the chord bar).

#### Chord grouping: `strum` fires on a TOLERANCE window, not an exact onset

The pipe chain runs at the choke point *after* `applyGroove` (whose humanize
pass nudges every event by its own ±`ht`·0.04-beat draw) and *after* the
rubato beat-warp. From the 2026-07 engine audit: `strum` used to collect
chord-mates by an exact `beat.toFixed(6)` key, so with any `humanize > 0`
— i.e. in every catalog state that pools it — no two pad notes shared a key,
every group had one member, and the roll never fired anywhere. **Dead
vocabulary, fixed 2026-07-25.**

The law now: pads are sorted by (beat, pitch) and clustered with a
**tolerance window** `tol` (default 0.1 beat) measured from each cluster's
first onset — above the ±0.08 worst-case humanize spread between mates, far
below the closest distinct pad onset the score can emit (a half beat). Each
cluster of ≥2 rolls from its own earliest (already humanized) onset, so the
chord keeps its human placement while the rake reads cleanly, and every
voice's release edge stays where it was. Still drawless, therefore still
deterministic and seeded. One deliberate abstention: when the SCORE already
rakes the pads (`state.strum`, the rhythm-guitar `STRUM_PATTERNS` comp), the
pipe stands down rather than fight the stroke direction — the roll is
present either way. Byte drift is confined to states that actually pool
`strum` and have pads; that drift *is* the fix.

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
  matrix by design. The perc pass tiles the 8-unit cell at
  `min(chordEvery, 8)` and clips emission to the cell **and** the section
  span (2026-07-25): under a 6-beat waltz bar or a 4-beat half-bar the cell
  truncates like a kit cell, and no perc hit ever spills past a section end
  into a kit-`"off"` or cut/dropout span the way `round(beats/8)` tiling
  used to.

```js
state.rhythm = { complexity: 0..1 }   // absent = byte-identical
```

### 4. Micro-timing: `timeFeel.pushPullMs` (2026-07-25)

`docs/TIMING-AUDIT-2026-07.md §Groove` measured the space and found every genre
sitting on essentially one rhythmic feel, tempo aside: **247 of 274 had no
per-lane push/pull at all** — bass on the kick to within 0.31 ms — and the 26
that did declared it in **beats**, which is tempo-*relative*. The same `0.015`
is 4.3 ms at 209 bpm and 18.8 ms at 48 bpm, so one number could not mean one
feel across a 48–209 bpm catalogue.

Human micro-timing is a **millisecond** quantity: a laid-back snare is ~15 ms
late whether the tune is a ballad or a burner. So anchors may now declare

```js
timeFeel: { pushPullMs: { bass: 13, snare: 7, hat: -4 } }   // + = behind, - = ahead
```

folded to beats against the state's own `bpm` at one choke point
(`csd-engine resolvePushPull`, shared by press and the live walk). Lanes are the
event's `voice || drum`: `bass` `melody` `pad` / `kick` `snare` `hat` `ride`
`rim` `clap` `perc` `tom`.

- **Both units may coexist**: they are the same physical quantity, so they are
  **summed per lane** after the ms side converts. `jazz` uses this — the walking
  upright keeps its original beat-declared drag, the ride and snare are
  tempo-honest.
- **Absent ⇒ byte-identical** (verified: 274 genres × 2 seeds, zero drift).
- Blends union-and-lerp the two maps independently and the engine sums them at
  the blend's own bpm — which is the whole point of the unit.
- **Budget**: the audit measured the confusion matrix blind to per-lane offsets
  up to **0.02 beat** (Δ self-score 0 across 18 probed genres; the verifier reads
  `timeFeel` nowhere and derives only `ev.drums`). Every declaration stays inside
  0.02 beat *at its genre's fastest bpm* — the catalogue max is **0.0178** (dub).

**The families**, all grounded in named performance practice. Machine-tight
families get **nothing**: techno, gabber, hardstyle, trance, edm, psytrance,
industrial, minimal, chiptune, synthwave, vaporwave — flat grid is their
identity and vaporwave's verifier row explicitly fences on machine time. The
classical, ambient and drone wings get nothing for the same reason; `rubato` is
already their expressive organ.

| family | genres | feel |
|---|---|---|
| one-drop | reggae, dub | bass +13, skank/rim/snare +7…+8 — the whole band in the basement |
| swing | jazz, bebop, bigband, whalejazz | ride −4…−6 **on top of** a snare and walking bass at +3…+11 |
| funk / soul | funk, newjack, rnb, gospel, lowglide | bass −4…−5 **ahead**, backbeat +5…+10 behind it |
| breaks | jungle, dnb, footwork | bass −5, placed early so it *pulls* the break |
| 808 | trap, phonk, witchhouse | long-attack sub +6…+12 behind, hat rolls −3 on top |
| latin / african | salsa, samba, afrobeat | anticipated tumbao −5; caixa −5; the Tony Allen snare +7 under hats −4 |
| country | bluegrass, honkytonk, altcountry, desertblues | bluegrass *drives* (−4…−5); the barroom *leans back* (+6…+7) |
| house / garage | house, deephouse, garage, amapiano, disco | hats −3…−4 on top; the dub/log-drum bass +5…+6 behind |
| boom-bap | boombap, spokenword, crateflip | the Dilla drag — bass +8…+9, hats −4 |
| skank-forward | ska | pad −5, bass −4 — the *same* offbeat chop as reggae, opposite sign |
| pit band | urchinmatinee, klezmer | the shuffle leans back; the wedding band accelerates |

Realised displacement was measured **in rendered audio** by
difference-of-differences (press the same state at lane offsets 0, d, 2d; the
unmoved voices cancel exactly, so the two difference signals are one waveform
shifted by d). 14 lane measurements across 11 genres, 72–175 bpm: every one
landed on its declaration to ±0.01 ms, correlation 1.00.

**Swing was deliberately left alone.** The obvious move — raise `state.swing`
for the genres that really swing — measures as wrong. In every jazz genre the
**`ride` lane plays only on the beat** (jazz 276 events, all at f=0; bebop 416;
blues 384), so the knob cannot touch the one instrument whose swing *defines*
the music; meanwhile it *would* swing 41–68 % of the walking bass, which is
where swing does not belong, and `swing` is read raw by `genre-verifier.js`
(unlike `pushPull`), with several genre rows explicitly fenced on swing bands.
Wrong lanes, missed lane, matrix risk. The real fix is a ride pattern with a
swung skip — the `shuffle` kit already places one at `beat + 2/3` scaled by
`state.swing` — applied to the `ride` lane. That is a KITS change, matrix-visible
through `variation`/`hatDensity`, and is the recommended next step.

### 5. The voice repeat governor (2026-07-25)

> "No vocal or textural sample should repeat more than five times in 64 bars. We
> end up with speech synthesized phrases looping ad nauseum. Space them." — Paul

A voice sample is an **utterance**, not a groove element. No single scheduler can
see this: each section role, the hits layer and every `sampleEvents` spec places
its own shots from its own rng, and several can land on one id — measured, 140 of
822 genre×seed rows had a voice id firing over the cap, worst **31×** in 64 bars
(`sp_pressure`), with min gaps under one bar. So the rule is enforced at the one
place that sees the whole found stream: `governVoiceRepeats`, called in
`buildEvents` after every found push and before the rubato warp.

- **Scope** — the voice classes only: `vb_*` voxbank, `sp_*`/`hp_*`/`wd_*` speech,
  `vox_*`, and the `vx_*` voice shelf. **Not** breaks or chops (a break repeating
  *is* the genre), **not** sustained beds, and **not** `kind:"hit"` — the rave
  hoover, the bigbeat stab and the horn section are musical hits whose repetition
  is the idiom, the same argument that exempts breaks. Within the voice classes
  only a **head-of-clip** one-shot counts: a granular chop at offset .42 is a
  different piece of the clip, and a glitch retrigger belongs to the utterance it
  decorates (it follows its parent's fate, so no orphan stutter tails).
- **Space, don't just cap.** At the limit the governor first **rotates** to a
  sibling in the same curated family (`vb_junglist_03` → `vb_junglist`,
  `sp_st_akiba` → `sp_st`); only an exhausted family drops the event. A min gap
  of 6.4 bars keeps five uses spread instead of clumped into eight.
- Rotation is restricted to **homogeneous** families (three-token pool ids, plus
  the `hp_`/`wd_` single-topic casts). The flat two-token shelves are not
  substitutable — `sp_` holds mall announcements next to rave MC shouts, `vx_`
  holds Blake next to the telephone time lady — so those are capped and spaced
  but never swapped. Audited: 396 substitutions, every one inside its family.
- Deterministic (one dedicated stream, seed+31337) and matrix-invisible by
  construction — `genre-verifier.js` derives features from `ev.drums` and reads
  `breakUse`/`chopUse`/`bedUse` off `state.sections`, never off found events.

Result across 274 genres × 3 seeds: rows over cap **140 → 0**, catalogue worst
**31× → 5×**. Total found/sfx stream **−2.8 %** (the voice-utterance layer −38 %,
concentrated exactly where it was looping). Where a pool exists rotation absorbs
the excess with no loss at all (`budstep` 83 → 83 utterances over 16 ids); where
a genre resolved a **single** voice id — 451 of 592 resolved families — there is
nowhere to rotate and thinning is the arithmetic meaning of capping a 31× loop.
Widening those genres' `hits.sources` voice pools (documented matrix-safe in
CLAUDE.md) is the follow-up that turns the remaining thinning into spreading.

**Live caveat**: `faust/live.js` regenerates a collapsed section each chord bar,
so `buildEvents` sees 16–72 beats at a time (measured: mallsoft 72, transitwave
40, auctioncore 16, dmvstep 40). The cap binds *within* each generation — where
the worst clumping lives — but the 64-bar accounting cannot span generations.
Press/export get the full guarantee.

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

## The dead knob: `jux` (per-event pan is scored but not rendered)

Honest status as of the 2026-07 engine audit, recorded here so nobody tunes
against it again: **no backend consumes `event.pan`.**

- `buildEvents` stamps `pan ∈ [-1,1]` (signed, 0 = centre) on hats, toms,
  melody and pads from `state.jux`, and `callResponse` mirrors it.
- The Faust engine never reads that field. `state-engine.mapEvents`
  translates only `cutoffMul` / `vib` / `pw`; every per-note pan in press,
  the stream renderer, the live ring and the sampler comes from
  `SE.notePan(unit, freq)` — i.e. the **unit** pan (`MASTER_PAN`, pad
  `panSpread`). MIDI export ignores pan too.

So the ~28 anchors whose `fx.jux` ranges promise audible width ("the stereo
field disagrees with itself") currently render with zero per-event stereo
divergence. The score-side half is kept — it is correct, cheap and
byte-identical — and the missing half is a `mapEvents → note.pan` wiring
inside `engine/faust/` (state-engine + the press/stream note paths; the
mono live ring stays mono by design). Until that lands, treat `jux` as a
**score annotation, not a mix control**: the honest way to widen a genre is
unit pan.

Convention (fixed 2026-07-25): pan is **signed**, so a mirror is `-pan`.
`callResponse` used to mirror with `1 - pan`, a 0..1-convention leftover
that would have slammed every response note hard right the moment a jux
state stamped a negative pan; it now mirrors correctly, which is why the one
catalog state carrying both `callResponse` and `jux > 0` drifts on the
`pan` field (inaudibly — nothing reads it yet).

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
4. **Gate + tune**: `./verify.sh --full`, matrix back to fully
   diagonal-dominant (178/178 then; 249/249 now), fixture refresh, docs.

## Verification

`node test/theory.test.js` · `node test/pipes.test.js` · gate 1 determinism
(absent knobs byte-identical **and** present knobs seed-stable) ·
`node engine/genre-verifier.js matrix --no-cache` → 249/249 ·
`node test/engine.test.js --quick` non-silent presses · ears via the live app.
