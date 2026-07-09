# Contributing to stellate

Thanks for wanting to add to the genre space. This file is the social
contract: what the machines will hold you to, and what's left for ears.

## The one rule

**Source is committed; audio is derived and gitignored.** The score brain
(`engine/csd-engine.js`), the kernel (`engine/genre-kernel.js`), the DSP
sources (`engine/faust/dsp/`) are the capability; every `.wav`/`.mp3`/`.mp4`
is regenerable and must never be committed. The project exists because we once
kept the renders and lost the generator (see the README genesis parable).
Everything below is a corollary.

## Running the app and the gates

```bash
git clone <this repo> && cd stellate
cd engine/faust && npm ci && cd ../..   # the one dependency install (faustwasm)
node tools/ci-standin-media.js          # synthesize stand-in media (no network, ~1s)
./verify.sh                             # matrix + validate + engine smoke, concurrent
node test/theory.test.js && node test/pipes.test.js
./serve.sh                              # the app at http://localhost:8777/
```

Requires `node` (20+) and `ffmpeg`. The stand-in step exists because a fresh
clone has recipes but no media — it writes a second of quiet noise at every
path the gates check, and never overwrites a real file. If you want the real
found-sound/sample layers (you do, for listening): `tools/fetch-found-sound.sh`
and `tools/fetch-found-samples.sh` fetch them from the Internet Archive into
the gitignored `found/` tree.

The `verifier-catalog/` git submodule is **optional** — reference data and an
MCP tool, nothing in the app or the gates imports it. A plain clone without
`--recurse-submodules` runs everything above.

## The gate philosophy

**Machines verify structure; human ears verify taste.** A PR must keep
`./verify.sh` green:

- **matrix** — the symbolic confusion matrix must stay
  **diagonal-dominant: 178/178**. Every genre must still sound most like
  itself, symbolically. This is the big one: it's what makes 178 genres a
  space instead of a soup.
- **validate** — the kernel gate suite: **determinism** (same state, same
  seed → byte-identical events), **vocabulary** (genres draw from the
  engine's actual progressions/kits/patterns), coverage, differentiation.
- **engine** — real Faust presses of three very different states, gated on
  non-silence. Structure, not beauty.

Plus `node test/theory.test.js` and `node test/pipes.test.js` (pure node,
sub-second). If your change touches the app UI, run the headless browser gates
listed in CLAUDE.md too.

What the gates don't check — whether it sounds *good* — is checked by playing
it. Say in the PR what you listened to. No gate will ever be added for taste,
and no PR will be merged on green checks alone if it sounds worse.

## What a good PR looks like

**A new genre / genre anchor.** Genres are points in the kernel's vector
space, built from the engine's existing vocabulary. Wire found material
MATRIX-SAFE ONLY (the full rules are in CLAUDE.md, "Incorporating a sample
CD"): add sample ids to a genre's **existing** `found.sources` pool with the
same role, or to `hits.sources` (always safe). NEVER add a `found:{role:…}`
block to a genre that lacks one, change a role, or touch bpm/scored fields —
that shifts the confusion matrix for everyone. After every batch:
`node engine/genre-verifier.js matrix --no-cache` must still print
`diagonal dominant: 178/178`.

**A new pipe** (event transform). Register it in `CsdPipes.REGISTRY`
(`engine/pipes.js`) with its **own seeded rng stream** — never share or reuse
another pipe's stream, and never touch events when your knob is absent. Add
cases to `test/pipes.test.js`.

**New theory** (modes, progressions, voice-leading). `engine/theory.js`, with
cases in `test/theory.test.js`. Theory feeds buildEvents through
`state.theory.reharm`, so the determinism law below applies in full.

**A new synth voice.** A Faust source in `engine/faust/dsp/`, compiled with
`node engine/faust/build.js` (the wasm in `engine/faust/dist/` IS committed —
the one blessed binary class), documented in `engine/faust/VOICES.md`, and
wired through `state-engine.js`. Beware the Faust voice-library traps noted in
VOICES.md before reaching for a stock library effect.

**Any change to `buildEvents`** falls under the **determinism law**: every
stochastic choice draws from an isolated `mulberry32` stream (seeded from
`state.seed` plus a distinct constant — see the existing streams), so that a
state WITHOUT your new knob renders **byte-identical** audio before and after
your change. Absent knob = untouched stream layout. The validate gate checks
determinism; byte-identity of old states is the part you must verify yourself
(render a state on main and on your branch; compare).

## The media policy (the part that keeps this repo publishable)

- **NEVER commit audio, video, SoundFonts, or model binaries.** CI and
  `verify.sh` fail on any tracked `wav/mp3/mp4/ogg/sf2/pb/syx/…`. The committed
  deliverable for new material is the **recipe + manifest + registry entries**
  (fetch script lines, `manifest.json`, `SAMPLES`/`SOURCES` snippets) — see
  SOURCES.md "The media policy" for the three license tiers.
- New fetched material needs a ledger entry in SOURCES.md: item, license, and
  a flag if it's attribution/SA/NC/ND. Unlicensed commercial material is
  fetch-for-personal-use only and never touches a distributed render.
- Wire new material into genres matrix-safe (above).
- **The speech-synthesis path is GPL.** `vendor/espeak-ng/` vendors eSpeak NG
  compiled to WebAssembly, GPL-3.0-or-later (see NOTICE). Contributions to
  the wire-in (`engine/speech.js`) are MIT like the rest of the repo, but
  anyone redistributing the bundled app WITH that module conveys a GPL-3.0
  combined work on that path. Removing `vendor/espeak-ng/` removes the
  obligation — the app degrades to the canned speech recipes.

## Housekeeping

- No frameworks, no bundlers, no build step for the app; `engine/` stays
  classic-global scripts, `app/` stays native ES modules.
- Keep PRs one subject. Fill in the PR template — including which gates you
  ran and what you listened to.
