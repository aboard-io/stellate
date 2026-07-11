# stellate

**A generative music instrument you play by moving through a map of genres.**

Every genre is a point in one deterministic vector space. Drag the star chart,
draw a path, or drift, and the music continuously morphs through whatever the
traveler crosses — tempo, harmony, groove, instrumentation, and effects all
blending between neighbours. 249 genres, all generated live in the browser.
The catalog is a work of mathematical fiction: every genre wears an invented
display name — the anchor id `techno` appears on the map as "Concrete
Metronome", `jazz` as "Smoke Arithmetic", `fugue` as "The Patient Chase", and
`salondawdle` (a brushed 3/4 salon waltz — the space carries real odd meters)
was born fictional — while the ids underneath stay stable and load-bearing
for paths, presets, and the verifier matrix.

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

**Music-minded.** Harmony is generated, not looked up: `engine/theory.js` walks
functional harmony with a per-genre *adventure* knob (diatonic → modal
interchange → secondary dominants → chromatic mediants, cadences always
anchored) and voice-leads the pads with minimal motion; `engine/pipes.js`
treats the scheduler as pipes — composable, seeded event transforms
(harmonize, echo-canon, ghost notes, call-and-response, density arcs, per-note
filter/vibrato gestures) applied at the one choke point so live, offline, and
MIDI all hear the same music. Every genre carries its own settings for these
as axes in the space; blends interpolate them. See `docs/MUSIC-MIND.md`.

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
frozen. See `docs/history/WAV-FIRST.md`. On desktop, a hidden tab just keeps
playing — the live ring rides through tab switches (the bg-survival gate's
contract).

## The explorer (STELLATE, `index.html`)

The whole UI is the star map. Drag it, mouse-wheel to zoom, double-tap to drop
path waypoints and travel the loop — and travel *arrives*: parked on a new
genre, its drums are playing within 3 bars and its kit/lead identity within 7
(a committed gate, `test/blend-arrival-run.js`). Chips: ▶ live, ⓘ **inside the
sound** (a live per-voice timeline — always 8 cells, folded for long bars —
with plain-language character descriptions, sustained bed ribbons, and the
MUSIC-MIND meters), a background toggle (off → laserdisc video → MicroW8
demoscene, which strictly alternate every eight bars, cutting on the beat),
and ⚙ controls. The ⚙ panel also **downloads the current song** — ⤓ midi /
⤓ wav / ⤓ mp3, a true offline press run in your browser (`docs/EXPORT.md`).

## The genesis parable (why the source is the artifact)

We once rendered ten vaporwave tracks at 4am into a home directory that wasn't
under version control. The renders survived; the `.csd` that made them did not —
we kept the **artifact** and lost the **generator**. This repo is the fix, and
the rule that falls out of it:

- **Source is committed; audio is derived and gitignored.** `engine/csd-engine.js`
  (the score brain) and `engine/faust/dsp/` (the synthesis) are the capability.
  Every `.wav`/`.mp3`/`.mp4` is regenerable and never committed. (The founding
  `royal-road.csd` that first proved the idea now rests on the `legacy-csound`
  branch — the origin lost-and-refound, kept safe. The project was named "Royal
  Road vaporwave" through 2026-07; it is a worked genre now, not the whole show.)

## Open source

MIT — see `LICENSE` (© 2026 Paul Ford), with third-party carve-outs and
credits in `NOTICE` (MicroW8, lamejs, faustwasm, eSpeak NG). One exception
with reach: the vendored eSpeak NG WASM speech module is GPL-3.0, so the app
*as served* is a GPL-3.0 combined work — details in `NOTICE`. The repo lives at
https://github.com/ftrain/stellate; made by
[Aboard](https://aboardresearch.com). Contributions welcome:
`CONTRIBUTING.md` is the social contract — the gates a PR must keep green
(the 249/249 matrix, determinism, non-silence) and what's left for ears.
No audio, video, SoundFont, or model binary is ever committed; the media
policy and the full attribution ledger live in `SOURCES.md`.

## Run

The tree is organized `app/` · `engine/` (core + `engine/faust/` WASM engine) ·
`tools/` (Node CLIs) · `test/` (gates) · `docs/`; `index.html` at root is the app.

```bash
(cd engine/faust && npm ci)            # the WASM engine's deps
tools/fetch-found-samples.sh           # one-time: SoundFont/GM + breaks + speech
tools/fetch-found-sound.sh; tools/fetch-found-video.sh   # one-time: found audio/video layers
./serve.sh                             # http://localhost:8777/  (needs http, not file://)
git submodule update --init            # optional: verifier-catalog reference data + MCP tool (skip freely)
```

Verify / render:

```bash
node test/engine.test.js               # offline-render smoke, gated on non-silence
node engine/genre-verifier.js matrix   # genre confusion matrix — must stay diagonal
node engine/validate-genres.js --quick # determinism / vocabulary / coverage gates
node engine/genre-kernel.js track budstep --seed 7 --render   # one track -> mp3
```

Needs `node`, `ffmpeg`, `curl` — no `csound` (the founding `royal-road.csd` and
its renderer live on the `legacy-csound` branch). Headless browser gates live in
`test/*-test*.js` (need the pinned playwright).

## More

- **`how.html`** — the visual explainer of how a song is made.
- **`CLAUDE.md`** — the full layout and working notes.
- **`docs/GENRE-SPACE.md`** — how the vector space and journeys are designed.
- **`docs/MUSIC-MIND.md`** — the music-intelligence program (theory, pipes, axes).
- **`docs/EXPORT.md`** — downloads: the shipped in-browser ⤓ midi/wav/mp3 press
  and the hour-scale render-service design.
- **`engine/faust/VOICES.md`** — the synthesis/effect voice library.
- **`SOURCES.md`** — every found-sound, sample, video, and vendored-code credit.
- **`docs/HOSTING.md`** — the stellate.app hosting plan (droplet + nginx,
  same-origin media, COOP/COEP for the SAB ring engine).
- **`docs/history/`** — the design/planning trail (WAV-FIRST, kernel, etc.).
- The pre-Faust csound era (the `builder.html` song builder, `play.html` player)
  lives fully working on branch **`legacy-csound`**.
