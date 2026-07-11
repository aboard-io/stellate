# NEXT — the backlog (post-marathon reset, 2026-07-11)

*Read this, then CLAUDE.md. Everything in "SHIPPED" is live on stellate.app.
Everything in "THE QUEUE" is agreed work not yet done — pick top-down, each is a
real build. Ship law at the bottom.*

## SHIPPED THIS SESSION (all live on stellate.app + aboardresearch)
Turtle-Beach/Montego **loop-end clamp** (sampler.js: `loopEnd = min(z.loopEnd,
src.length-1)`; importers clamp too). **fenv on samples** (recipe `fenv` → an
insert_fenv on the native sampler lane). **Drum balance** (`DRUM_BAL` kit-level
pull in state-engine mastering) + **disco −25%** + **reedrush lead-forward/kick-−15%**.
**Ring-out + delay** on the dreamy guitar genres (+ registered the dead `delay`
INSERT_DEFAULT). **longshipwhip → death metal** (gate eased, long release, big
reverb, padDouble). **Whole-loop AUDIO export** (journey.buildLoopPlan → topology
runs → stream-worker.renderLoop bakes+crossfades → WAV/MP3; ⤓ buttons route via
panels.exportAudioSmart). **Constant-pace travel** (share.js PACE_REF/paceSpeed/
loopBars + distance-based travelForBar/travelStep; playhead scrub uses the same
distance math; loopBars capped 2048). **Mixing-graph viz** under the piano rolls
(inside.graphData/graphSVG: full per-voice chains as CONNECTED directed chip-nodes,
delay→reverb→master, translucent, portrait/mobile, bigger). **Independent viz zoom**
(starmap VIZ={k,ox,oy}, separate from map ZOOM) + **iOS pinch containment**
(global multi-touch touchmove preventDefault). **MIDI crash fix** (buildLoopMidi
ASYNC+chunked, midiOnly light walk — no page freeze).

Two DSP CAPABILITIES landed but OPT-IN (silent until wired):
`sampler.js n.granular` (granular repitch) · `found-player.js f.scratch` (chop scratch).

## THE QUEUE (agreed, not done — pick top-down)

### A. Wire the two DSP capabilities so they PLAY (Paul: "from time to time")
1. **Scratch** — set `f.scratch` on chop events *occasionally* + deterministically
   (seeded), biased to chop/turntablist genres (boombap/jungle/crateflip/hiphop).
   Plumb the flag from csd-engine sampleEvents (or the found spec) → the chop `f`.
   Byte-safe: absent = identical; wire behind a genre opt-in so only opted genres
   drift (recapture fixtures; segment-parity stays equal — mixPCM both sides).
2. **Granular repitch** — fire `n.granular` when a sampled note is pushed far from
   its zone root (the register law in state-engine mapEvents octave-folds today;
   let far notes granular-repitch instead so they keep formants). Opt-in/threshold.
3. **Granular program passes 2–3** — revive the granular INSERT (audible on the
   live ring path, not dry — sampler.js:722 passes it dry; wire to vaporwave/
   plunderphonic); then the broad Faust-fun sweep (more synth-fleet voices + effect
   inserts as color where pure sampling lost character).

### B. Synth fonts (the big Faust-fun feature)
Two NON-sample fonts in the ⚙ soundfont switcher: **DX7** — every GM program is a
Faust DX7 (FM) patch; **MiniMoog** — every GM program is an analog-oscillator voice
(Wendy Carlos / Switched-On-Bach). Font switcher currently maps a font to sampled
zones (fonts.json + font-*.json); add a "synth font" kind that routes the sampler
lane to a Faust synth voice per GM program instead of samples. Signature synths
(tb303 etc.) can stay. See soundfont-switcher memory + engine/faust/state-engine
samplerUnit / the synth fleet.

### C. Settings pass (IN PROGRESS — paused at the reset)
1. **Global VAPOR slider** (NEXT.md's long-standing item 4): live-only master EQ in
   exploreLive's graph (engine/faust/live.js, near userGain/masterGain, after the
   limiter) — a lowpass/high-shelf cutting HIGHS + a global reverb increase, both
   scaled by vapor 0..1 ("walking through a mall"). Persist like masterVol
   (state.js `_vapor`, live.js `setVapor`, panels.js slider, handle.setVapor).
   LIVE-ONLY → no byte-identity impact. I'd read live.js:368-412 (the output graph:
   masterGain→busComp→makeup→limiter→analyser→userGain→dest; found submix has a
   native reverb fvDelay/fvLp/fvFb at 405-411 to scale).
2. **Settings cleanup** — visual-consistency/elegance pass on the ⚙ panel
   (panels.js + app.css `.row`/sliders/labels).

### D. Musicality (NEW — Paul cares about this deeply)
1. **Register-aware voicing** — give each instrument a defined octave range (a few
   octaves; piano/synth wide), and rewrite notes on the fly (inversions / octave
   drops) to STAY IN RANGE — flute must not shriek into the top. Today mapEvents
   octave-folds sampled notes into the zone window; extend the CONCEPT to all voices
   in csd-engine buildEvents (per-instrument range + fold), not just samplers.
2. **Harmonic richness / accidentals** — the notation shows NO accidentals: the
   music is all-diatonic. Paul wants richness+complexity (secondary dominants,
   borrowed/chromatic-mediant chords, chromatic voice-leading, richer 9/11/13
   extensions) — NOT dissonance. Work in engine/theory.js (the harmony organ,
   `adventure`/`color` knobs) + pipes.js; factor chromaticism into the voice-leading
   so real accidentals appear.

### E. Video (largest build)
Offline whole-loop VIDEO, local clips only (archive.org footage is CORS-tainted).
Frame-step the demoscene (DemoLayer.renderFrame(dt) IS steppable off the clock —
de-risked) + seek local found/video clips deterministically + composite per frame
→ faster-than-realtime capture → **ffmpeg.wasm** (not vendored, ~30MB) mux with the
whole-loop WAV. Multi-session.

### F. Follow-ups / verify
- **iOS pinch** — implemented (multi-touch preventDefault + touch-action + viewport);
  NEEDS a real-device confirm (headless can't fire Safari gesture events).
- **reedrush kick-click** — best-guess fix (kick −15%); confirm by ear it's gone,
  else dig into the acoustic-kit kick sample / the master limiter transient.
- **Whole-path AUDIO export** — buildLoopPlan's walk is still SYNCHRONOUS main-thread
  (same shape as the MIDI crash); make it async/chunked (or worker) before a big
  loop hangs it. And loopBars caps at 2048 (huge paths truncate) — a worker export
  could be faster + un-truncated.

## GATES / SHIP LAW
`tools/ship.sh` = verify.sh (matrix/validate/engine/prove/matproof) + theory/pipes/
speech → git push → deploy-stellate.sh (rsync to droplet). Refuses a dirty tree.
For app/engine changes ALSO the browser battery (explorer-ui, genre-viz,
share-url, simulate-path, blend-arrival, sampler-inserts-live, wavout, segment-parity;
NODE_PATH=/home/ford/ftrain-2025/node_modules). Recapture `node test/fixtures.js
capture` after intentional recipe drift (name the cause). segment-parity BYTE-EQUAL.
matrix diagonal-dominant (240/240). Machines verify structure; **Paul's ears verify
taste** — every genre/mix change is a best-guess pending his ear.

## LAWS (still true)
- LIVE-ONLY audio (master bus, userGain vol, the coming Vapor EQ) rides the main-
  thread graph AFTER masterGain → never touches the worker-baked press mix → segment-
  parity/fixtures stay byte-identical. THE pattern for live-audio taste changes.
- Opt-in DSP flags (n.granular, f.scratch, recipe fenv) are byte-identical when
  absent — the safe way to add sampler/found DSP.
- Whole-path exports MATERIALIZE bars → cap + async-yield or they OOM/freeze the page.
- Constant pace: the LIVE playhead never materializes the loop (steps one bar, wraps
  at the perimeter); only the EXPORT walks it, so caps/async live in the export path.
