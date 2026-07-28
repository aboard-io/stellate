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
cd engine/faust && npm ci && cd ../..   # Faust's build dep (faustwasm)
node tools/build/ci-standin-media.js     # synthesize stand-in media (no network, ~12s)
./verify.sh                             # the 13 gate suites, concurrent (~2.5 min from cold)
npm run test:pure                       # theory + pipes + boot-smoke (pure node, sub-second)
./serve.sh                              # the app at http://localhost:8777/

# OPTIONAL — the headless BROWSER gates (real WebGL/WebAudio via Playwright):
npm install                             # the one browser-test dep (playwright)
npm run setup:browser                   # download the Chromium build (playwright install chromium)
npm run test:browser                    # test/browser/*.test.js + test/starcruise/*.test.js (33 gates)
node test/starcruise/starcruise.test.js  # ...or any one of them, plain, with NO NODE_PATH
```

Requires `node` (20+) and `ffmpeg`. The stand-in step exists because a fresh
clone has recipes but no media — it writes a second of quiet noise at every
path the gates check (1,716 files, ~145 MB, enumerated from the kernel's own
registries) and never overwrites a real file, so re-running it on a populated
tree is a no-op. If you want the real found-sound/sample layers (you do, for
listening): `tools/fetch/fetch-found-sound.sh` and
`tools/fetch/fetch-found-samples.sh` fetch them from the Internet Archive into
the gitignored `found/` tree.

## The gate philosophy

**Machines verify structure; human ears verify taste.** A PR must keep
`./verify.sh` green:

- **matrix** — the symbolic confusion matrix must stay diagonal-dominant.
  `node engine/genre-verifier.js matrix` prints **`diagonal dominant: 274/274`**
  and every genre must still sound most like itself, symbolically. This is the
  big one: it's what makes 274 genres a space instead of a soup.
- **validate** — the kernel gate suite: **determinism** (same state, same
  seed → byte-identical events), **vocabulary** (genres draw from the
  engine's actual progressions/kits/patterns), coverage, differentiation.
- **engine** — real Faust presses of three very different states, gated on
  non-silence. Structure, not beauty.

Those three are the headline; `./verify.sh` runs ten more alongside them, each
one line in the script and each named in its header comment — interval proofs
(`prove`), an independent offline matrix prover (`matproof`), the social/meta
contract, star-map POS and 3D-coord coverage, genre-spec round-trips, the
genre-data byte-identity check, the chord-bar seam walk, the script-order
boot smoke, and `doccounts`, which reads the anchor count out of the kernel
and fails any tracked markdown — this file included — that states a stale one.

Plus `npm run test:pure` (`test/gates/theory.test.js`, `pipes.test.js`,
`boot-smoke.test.js` — pure node, sub-second, no dependencies). If your change
touches the app UI or the 3D star-cruise, run the headless browser gates (`npm run test:browser` — the glob is exactly
`test/browser/*.test.js` + `test/starcruise/*.test.js`) after the one-time
`npm install` + `npm run setup:browser` above — they need no `NODE_PATH`.

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
`diagonal dominant: 274/274`.

**A new pipe** (event transform). Register it in `CsdPipes.REGISTRY`
(`engine/pipes.js`) with its **own seeded rng stream** — never share or reuse
another pipe's stream, and never touch events when your knob is absent. Add
cases to `test/gates/pipes.test.js`.

**New theory** (modes, progressions, voice-leading). `engine/theory.js`, with
cases in `test/gates/theory.test.js`. Theory feeds buildEvents through
`state.theory.reharm`, so the determinism law below applies in full.

**A new synth voice.** A Faust source in `engine/faust/dsp/`, compiled with
`node engine/faust/build/build.js` (the wasm in `engine/faust/dist/` IS committed —
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

## Engine load order & the global namespace

The app has **no bundler**. `index.html` loads the engine as an ordered list of
classic `<script>` tags — the block under the `<!-- ENGINE: classic global
scripts -->` comment, `index.html:130-158` — and the browser executes them
top-to-bottom before the app runs. That order is a contract, not decoration.
The rules:

- **`engine/` is classic-global / UMD; `app/` is native ES modules.** Every
  engine file wraps itself in a UMD shim that publishes exactly one `window`
  global (its node branch does `module.exports`, its browser branch does
  `root.<Name> = …`). **Do not convert an engine file to an ES module** and do
  not add a second global from one file. The public symbols, in load order —
  the same sixteen the boot-smoke gate holds you to:

  | script | global |
  | --- | --- |
  | `engine/theory.js` | `CsdTheory` |
  | `engine/pipes.js` | `CsdPipes` |
  | `engine/csd-engine.js` | `CsdEngine` |
  | `engine/genres-data.js` | `__GENRES` |
  | `engine/registry-data.js` | `__REGISTRY` |
  | `engine/genre-kernel.js` | `GenreKernel` |
  | `engine/genre-verifier.js` | `GenreVerifier` |
  | `engine/namebank.js` | `NameBank` |
  | `engine/midi-export.js` | `MidiExport` |
  | `engine/speech.js` | `CsdSpeech` |
  | `engine/demo-layer.js` | `DemoLayer` |
  | `engine/faust/voices/state-engine.js` | `FaustStateEngine` |
  | `engine/faust/voices/found-player.js` | `FoundPlayer` |
  | `engine/faust/voices/sampler.js` | `FaustSampler` |
  | `engine/faust/live/live.js` | `FaustLive` |
  | `app/entries/analytics.js` | `goatcounter` |

  (The last row is the app's one classic script — the cookie-free GoatCounter
  settings shim, which must publish before the vendored counter runs.)

- **`theory.js` and `pipes.js` MUST load before `csd-engine.js`.** csd-engine
  reads `window.CsdTheory` / `window.CsdPipes` **at load time** (the MUSIC-MIND
  organs); load it first and its theory/pipes references are dead. The same
  law binds two more pairs: the generated data scripts (`genres-data.js`,
  `registry-data.js`) before `genre-kernel.js`, which reads `window.__GENRES`
  / `window.__REGISTRY` synchronously at load, and `csd-engine.js` before
  `midi-export.js`, which captures `CsdEngine` at load.

- **Every engine global MUST be published before `app/main.js`.** `app/main.js`
  is the `type="module"` entry point; it reads the engine off `window` as
  globals. Module scripts defer, so it already runs after the classic block —
  keep it last and keep it a module.

- **Adding a new engine script?** Insert its `<script>` in the right place in
  `index.html`, give it a single UMD global, and register that global in the
  boot-smoke gate (below). The DOM layers (`demo-layer`,
  `live.js`) are browser-only — they close over `window` directly and cannot
  `require()` in node; that's fine, the gate loads them in a sandbox.

The gate: **`node test/gates/boot-smoke.test.js`**. It parses `index.html` for the ordered
classic script list, runs each script in load order inside one browser-like
sandbox (exercising the UMD *browser* branch, exactly as the page does), and
asserts (a) each script publishes its expected global, (b) theory/pipes precede
csd-engine and csd-engine precedes midi-export, and (c) all engine globals
precede `app/main.js`. It prints `boot-smoke: PASS — 16/16 engine scripts
loaded in order and published their window global`. A new classic
engine script that index.html loads but the gate doesn't know about **fails**
the gate — so you can't add a global without declaring it. Sub-second, pure
node; it is the third gate in `npm run test:pure`, and `./verify.sh` runs it
too.

## Housekeeping

- No frameworks, no bundlers, no build step for the app; `engine/` stays
  classic-global scripts, `app/` stays native ES modules.
- Keep PRs one subject. Fill in the PR template — including which gates you
  ran and what you listened to.
