# stellate

**A generative music instrument you play by moving through a map of genres.**

Every genre is a point in one deterministic vector space. Drag the star chart,
draw a path, or drift, and the music continuously morphs through whatever the
traveler crosses — tempo, harmony, groove, instrumentation, and effects all
blending between neighbours. ~110 genres, from `techno` and `citypop` to
`singeli`, `budstep`, and `fugue`, all generated live in the browser.

**Play it:** https://aboardresearch.com/projects/stellate/

## How it works

One idea, one pipeline:

1. **`genre-kernel.js` — the space.** Each genre is a vector (bpm, swing,
   harmony, kit, instrument/effect pools, …). Blends, tracks, playlists, and
   journeys are all just points and paths through it. Proximity means
   similarity; the layout on the star map is computed from that.
2. **`csd-engine.js buildEvents(state)` — the score brain.** A resolved point
   becomes a deterministic list of note / drum / found-sound / fx events. Same
   state + seed → the same score, always. Every backend derives from this.
3. **`engine/faust/state-engine.js` — voices & effects.** Events map to voice units
   with a per-voice channel strip and a two-effect chain (filter, EQ,
   compression, saturation, plus chorus / Leslie / flanger / delay / granular /
   reverb from the Faust module fleet).
4. **`engine/faust/` — the engine.** One Faust WASM AudioWorklet per synthesis model,
   played **live** in the browser and **offline** ("press") in Node from the
   identical code — so what you hear is what renders.

**Sampled by default.** The full General MIDI set is extracted from a
FluidR3-class SoundFont (`engine/faust/extract-gm.js`) and is the default sound; most
pitched voices are real sampled instruments through Faust effect chains. Synths
remain for the genres whose synthesis *is* the identity — the acid `tb303`, the
Reese/wobble basses, the vocoder — which stay synth on purpose.

**Verified, not vibed.** Machines check structure — a genre-confusion matrix
that must stay diagonal-dominant (`node engine/genre-verifier.js matrix`), determinism,
vocabulary, per-voice expected-vs-actual audio truth — so a change can't
silently break a genre. Human ears check taste, in the live app. This is a
worked example of the generator → verifier → feedback-loop thesis from the
`verifier-catalog` submodule it was extracted from.

**Pocket-proof mobile.** On phones the audible path is a real media element fed
a continuously-rendered, encoded stream (the WAV-FIRST pipeline), so playback
survives screen-lock and backgrounding where a live WebAudio graph would be
frozen. See `docs/history/WAV-FIRST.md`.

## The explorer (CONSTELLATE, `index.html`)

The whole UI is the star map. Drag it, mouse-wheel to zoom, double-tap to drop
path waypoints and travel the loop. Chips: ▶ live, ⓘ **inside the sound** (a live
per-voice timeline showing each instrument's rhythm and its effect chain), a
background toggle (off → laserdisc video → MicroW8 demoscene, which alternate
every few bars), and ⚙ controls.

## The genesis parable (why the source is the artifact)

We once rendered ten vaporwave tracks at 4am into a home directory that wasn't
under version control. The renders survived; the `.csd` that made them did not —
we kept the **artifact** and lost the **generator**. This repo is the fix, and
the rule that falls out of it:

- **Source is committed; audio is derived and gitignored.** `royal-road.csd`,
  `engine/csd-engine.js`, `engine/faust/dsp/` are the capability. Every `.wav`/`.mp3`/`.mp4`
  is regenerable and never committed. (The project was named "Royal Road
  vaporwave" through 2026-07; it is a worked genre now, not the whole show.)

## Run

The tree is organized `app/` · `engine/` (core + `engine/faust/` WASM engine) ·
`tools/` (Node CLIs) · `test/` (gates) · `docs/`; `index.html` at root is the app.

```bash
git submodule update --init            # verifier-catalog (reference data + MCP)
(cd engine/faust && npm ci)             # the WASM engine's deps
tools/fetch-found-samples.sh           # one-time: SoundFont/GM + breaks + speech
tools/fetch-found-sound.sh; tools/fetch-found-video.sh   # one-time: found audio/video layers
./serve.sh                             # http://localhost:8777/  (needs http, not file://)
```

Verify / render:

```bash
node test/engine.test.js               # offline-render smoke, gated on non-silence
node engine/genre-verifier.js matrix   # genre confusion matrix — must stay diagonal
node engine/validate-genres.js --quick # determinism / vocabulary / coverage gates
node engine/genre-kernel.js track budstep --seed 7 --render   # one track -> mp3
```

Needs `node`, `ffmpeg`, `curl`. Only `tools/render.sh` (the founding
`royal-road.csd`) still needs a `csound` binary. Headless browser gates live in
`test/*-test*.js` (need the pinned playwright).

## More

- **`CLAUDE.md`** — the full layout and working notes.
- **`docs/GENRE-SPACE.md`** — how the vector space and journeys are designed.
- **`engine/faust/VOICES.md`** — the synthesis/effect voice library.
- **`SOURCES.md`** — every found-sound, sample, video, and vendored-code credit.
- **`docs/history/`** — the design/planning trail (WAV-FIRST, kernel, etc.).
- The pre-Faust csound era (the `builder.html` song builder, `play.html` player)
  lives fully working on branch **`legacy-csound`**.
