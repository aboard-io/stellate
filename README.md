# stellate

**A generative music instrument you play by moving through a map of genres.**

Every genre is a point in one deterministic vector space. Drag the star chart,
draw a path, or drift, and the music continuously morphs through whatever the
traveler crosses — tempo, harmony, groove, instrumentation and effects all
blending between neighbours. 274 genres, all generated live in the browser,
none of them recordings.

**Play it: https://stellate.app/** — press ▶ and drag. Nothing to install.

The catalog is a work of mathematical fiction. Every genre wears an invented
display name: the anchor id `techno` appears on the map as "Unblinking
Interval", `jazz` as "Smoke Arithmetic", `fugue` as "The Patient Chase", and
`salondawdle` — "Ottoman Heat Death", a brushed 3/4 salon waltz — was born
fictional, the space carrying real odd meters to hold it. The ids underneath
stay stable and load-bearing: they are what paths, presets and the verifier
matrix read.

## Hearing it: the explorer

The whole UI is the star map. Drag it, scroll or pinch to zoom, double-tap to
drop path waypoints and travel the loop — and travel *arrives*: parked on a new
genre, its drums are playing within 3 bars and its kit and lead identity within
7. That is a committed gate, not a hope (`test/browser/blend-arrival.test.js`).

Three chips sit in the corner. **▶** goes live. **✦** cycles the three views —
star map, ⓘ *inside the sound*, and the 👾 star-cruise flythrough. **⚙** opens
the controls: volume, vapor, soundfont, seed, speed, ±bpm, an `<iframe>` embed
snippet for the mix you are hearing, and **⤓ midi** — a Standard MIDI File of
the song playing right now, built by `engine/midi-export.js` from the same
`buildEvents()` walk the audio uses, from the same state, seed and point on the
path the share link hands out (`test/browser/midi-export.test.js` holds it to
that).

The ⓘ view is worth a minute: a live per-voice timeline, always 8 cells and
folded for long bars, with plain-language descriptions of what each voice is
doing, sustained ribbons for the found-sound beds, and the music-mind meters.

Audio downloads are not offered. The music is regenerable from its URL, which
is the whole point — the address bar carries seed, path and measure, so a
bookmark reopens exactly this music.

There is a second front door: `access.html` is screen-reader- and
keyboard-first, needs no visuals at all, and plays music byte-identical to what
the map would play for the same seed and blend.

## How it works

One idea, one pipeline:

1. **The space** — `engine/genre-kernel.js` is the algebra (blend, resolve,
   track, journey); the 274 anchors themselves live beside it in
   `engine/genres-data.js`, and the sample/source registries in
   `engine/registry-data.js`. Each genre is a vector: bpm, swing, harmony, kit,
   instrument and effect pools, and the music-mind axes. Blends, tracks,
   playlists and hours-long journeys are all just points and paths through it.
   Proximity means similarity; the star-map layout is computed from that.
2. **The score brain** — `engine/csd-engine.js buildEvents(state)`. A resolved
   point becomes a deterministic list of note / drum / found-sound / fx events.
   Same state + seed → the same score, always. Everything downstream derives
   from this one function.
3. **Voices and effects** — `engine/faust/voices/state-engine.js` maps events to
   voice units with a per-voice channel strip and an insert chain (filter, EQ,
   compression, saturation, plus chorus / Leslie / flanger / delay / granular /
   reverb from the Faust module fleet).
4. **The engine** — `engine/faust/`, one Faust WASM AudioWorklet per synthesis
   model, played **live** in the browser and **offline** ("press") in Node from
   the identical code. What you hear is what renders.

**Music-minded.** Harmony is generated, not looked up: `engine/theory.js` walks
functional harmony with a per-genre *adventure* knob (diatonic → modal
interchange → secondary dominants → chromatic mediants, cadences always
anchored) and voice-leads the pads with minimal motion. `engine/pipes.js` treats
the scheduler as pipes — composable, seeded event transforms (harmonize, echo
canon, ghost notes, call-and-response, density arcs, per-note filter and vibrato
gestures) applied at the one choke point, so live, offline and MIDI all hear the
same music. Every genre carries its own settings for these as axes in the space;
blends interpolate them. See `docs/MUSIC-MIND.md`.

**Sampled by default.** The full General MIDI set is extracted from a
FluidR3-class SoundFont (`engine/faust/build/extract-gm.js`) and is the default
sound — 108 sampled instruments, most pitched voices real samples through Faust
effect chains. Nine models stay pure synth because their synthesis *is* the
identity: the acid `tb303`, `acid`, `reese`, `wobble`, `synclead`, `modeld`, the
`vocoder`, the `hammond` with its spinning Leslie, and the `hoover` rave stab.
No static multisample holds a moving filter or a detune beat.

**Verified, not vibed.** Machines check structure — a genre-confusion matrix
that must stay diagonal-dominant at 274/274 (`node engine/genre-verifier.js
matrix`), determinism, vocabulary, per-voice expected-vs-actual audio truth — so
a change cannot silently break a genre. Human ears check taste, in the live app.
This is a worked example of a generator → verifier → feedback loop: the
generator and the thing that checks it live in the same repo and argue with each
other.

**Pocket-proof mobile.** On phones the audible path is a real media element fed
a continuously-rendered, encoded stream (the WAV-FIRST pipeline), so playback
survives screen-lock and backgrounding where a live WebAudio graph would be
frozen (`docs/WAV-FIRST.md`). On desktop a hidden tab just keeps playing — the
live ring rides through tab switches, which is the bg-survival gate's contract.

## The genesis parable (why the source is the artifact)

We once rendered ten vaporwave tracks at 4am into a home directory that wasn't
under version control. The renders survived; the `.csd` that made them did not —
we kept the **artifact** and lost the **generator**. This repo is the fix, and
the rule that falls out of it:

- **Source is committed; audio is derived and gitignored.** `engine/csd-engine.js`
  (the score brain) and `engine/faust/dsp/` (the synthesis) are the capability.
  Every `.wav`/`.mp3`/`.mp4` is regenerable and never committed. (The founding
  `royal-road.csd` that first proved the idea now rests on the `legacy-csound`
  branch — the origin lost and refound, kept safe. Older references call this
  project "Royal Road vaporwave"; the royal road is a worked genre here now, not
  the whole show.)

## Run it

The tree is `app/` (the UI, ES modules, foldered by job: `core/` `audio/` `map/`
`panels/` `entries/` `starcruise/`) · `engine/` (the deterministic core, classic
global scripts, plus the `engine/faust/` WASM engine split into `live/` `press/`
`voices/` `codec/` `build/` `data/`) · `tools/` (Node CLIs and shell recipes:
`fetch/` `mine/` `genre/` `build/` `deploy/` `audit/`) · `test/` (gates) ·
`docs/` · `vendor/` (third-party, all served locally, nothing fetched from
anyone else's server) · `genre-specs/` (one authoring spec per anchor, 274 of
them, round-tripped by a gate) · `found/` (fetched audio, gitignored).
`index.html` at the root is the app.

```bash
(cd engine/faust && npm ci)             # the WASM engine's deps
tools/fetch/fetch-found-samples.sh      # one-time: SoundFont GM + breaks + speech
tools/fetch/fetch-found-sound.sh        # one-time: field-recording beds
tools/fetch/fetch-found-bbc.sh          # one-time: BBC SFX (RemArc licence — read SOURCES.md first)
./serve.sh                              # http://localhost:8777/  (needs http, not file://)
```

No media fetched yet, or none wanted? `node tools/build/ci-standin-media.js`
synthesizes quiet stand-ins at every path the gates check (about a second, no
network). It is how CI runs the full suite on a bare clone, and it never
overwrites a real file.

Verify and render:

```bash
./verify.sh                             # the release suite: 13 gate rows, forked concurrently
node engine/genre-verifier.js matrix    # the confusion matrix — must stay diagonal-dominant
node engine/validate-genres.js --quick  # determinism / vocabulary / coverage gates
node test/gates/engine.test.js          # offline-render smoke, gated on non-silence
node tools/kernel-cli.js track budstep --seed 7 --render   # one track -> mp3
```

**Every gate is named `<name>.test.js`, and the folder says what it needs** — a
filename suffix never encodes the runtime. `test/gates/` holds the release
gates — ten of the thirteen are rows in `verify.sh`, the rest run by hand;
`test/unit/` is pure Node; `test/browser/` and
`test/starcruise/` are the 33 headless-chromium gates, exactly what `npm run
test:browser` globs; `test/probes/` holds hand-run instruments (`*.probe.js`,
not gates); `test/lib/` holds the shared harnesses. For the browser gates,
install the pinned Playwright once with `npm install && npm run setup:browser`,
then run any of them plain: `node test/browser/explorer-ui.test.js`.

Needs `node`, `ffmpeg`, `curl` and `python3` (the dev server and the sample
classifier). No `csound` — the founding `royal-road.csd` and its renderer live
on the `legacy-csound` branch. Cold-start walkthrough, production headers and
how to add your own audio: `docs/SETUP.md`.

## Open source

MIT — see `LICENSE` (© 2026 Paul Ford), with third-party carve-outs and credits
in `NOTICE` (MicroW8, lamejs, faustwasm, eSpeak NG). One exception with reach:
the vendored eSpeak NG WASM speech module is GPL-3.0, so the app *as served* is
a GPL-3.0 combined work — details in `NOTICE`. The repo lives at
https://github.com/aboard-io/stellate; made by
[Aboard](https://aboardresearch.com). Contributions welcome: `CONTRIBUTING.md`
is the social contract — the gates a PR must keep green (the 274/274 matrix,
determinism, non-silence) and what is left for ears.

No audio, video, SoundFont or model binary is ever committed. The fetched media
is another matter and the honest version is in `SOURCES.md`: the deploy serves
`found/` from the public web, the per-item licences still bind, and the tier-3
rows are the ones to look at first if you fork this and deploy it yourself.

## More

- **`how.html`** — the visual explainer: how a song is made, stage by stage.
- **`colophon.html`** — what it is made of and whose work is in it: the
  found-sound ledger by licence tier, the vendored carve-outs, the standing laws.
- **The release feed** — [`feed.xml`](https://stellate.app/feed.xml) (RSS, latest
  50) · [`feed.json`](https://stellate.app/feed.json) (JSON Feed) ·
  [`feed-archive.xml`](https://stellate.app/feed-archive.xml) (the complete
  history). Generated from this git log by `tools/build/gen-feed.js` at deploy
  time, and **every entry links to a mix that plays what changed** — found-sound
  work links a bed-heavy genre, harmony work links the jazziest one. Derived, so
  it is gitignored: `node tools/build/gen-feed.js --historic` writes all four,
  `--show 10` prints them as text.
- **`CLAUDE.md`** — the full layout and working notes.
- **`docs/GENRE-SPACE.md`** — how the vector space and journeys are designed.
- **`docs/ADDING-A-GENRE.md`** — authoring a new anchor from a spec.
- **`docs/MUSIC-MIND.md`** — the music-intelligence program (theory, pipes, axes).
- **`docs/ARCHITECTURE.md`** — the module graph and what may import what.
- **`engine/faust/VOICES.md`** — the synthesis and effect voice library.
- **`docs/EMBED.md`** — putting STELLATE in someone else's page: the `<iframe>`
  snippet (⚙ → embed copies one for the mix you are hearing), `embed.html`'s
  `?genre=`/`?seed=`/`?path=` entry points, oEmbed, and why an embed still makes
  sound with no `SharedArrayBuffer`.
- **`SOURCES.md`** — every found-sound, sample and vendored-code credit, and the
  media policy in full.
- **`docs/HOSTING.md`** — the stellate.app hosting plan (droplet + nginx,
  same-origin media, COOP/COEP for the SAB ring engine).
- **`docs/history/`** — planning records that live code still cites by section.
- The pre-Faust csound era (the `builder.html` song builder, `play.html` player)
  lives fully working on branch **`legacy-csound`**.
