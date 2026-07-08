# FAUST-PORT — the sole-backend migration

Decision (2026-07-03): Faust becomes the only backend engine. The csound era
is preserved complete on branch `legacy-csound`. The kernel — the 32-genre
deterministic vector space, `buildEvents`, the validators — is UNCHANGED; only
the sound layer moves.

## Architecture

- **Voices**: one precompiled WASM AudioWorkletProcessor per synthesis model
  (faust/build.js pipeline). Timbre changes are `setParamValue` — never a
  recompile. DX7 family: per-algorithm modules + `sysex2params.js` decoding
  real cartridge banks (learnfm corpus compatible); a patch is a 144-dim
  vector — blendable like genres (future: patch-space paths).
- **Found sound goes native**: beds/chops/breaks/hits/vox play through
  `AudioBufferSourceNode`s driven by a JS grain/slice scheduler — the right
  tool, and it removes the largest engine load. No Faust granulator needed.
- **Vocoder**: `ve.vocoder` channel vocoder (speech as an audio input) —
  period-authentic robot choir, replaces pvsvoc.
- **Scheduler**: buildEvents → lookahead param/gate schedule on the WebAudio
  clock (prototyped in faust/engine.js). Voice pools + round-robin allocation.
- **Press**: faustwasm offline node rendering (proven 3x realtime) + ffmpeg.

## Strudel borrowings (into buildEvents, engine-agnostic)

- Euclidean rhythm as a kit dimension (`bd(3,16)`-style pulse placement)
- Per-cycle seeded transform pool (rev / ply / degrade analogues per chord-bar)
- jux-style stereo divergence (L/R pattern variants) as a production dimension

## Phases & gates

1. **Voice library parity** — every model in the kernel's vocabulary as .dsp
   (+ DX7 presets adopted where they beat the port: EPs, bells, brass, basses).
   Gate: offline A/B render per model vs legacy-csound, RMS + spectral sanity.
2. **Engine glue** — scheduler/allocator/fx-bus parity; explorer + press paths.
   Gate: `validate-genres.js` all green (symbolic gates are engine-agnostic);
   Discogs-EffNet A/B on 6 genres vs legacy renders — Faust must match or beat.
3. **Switchover** — CONSTELLATE + journey CLI on Faust; csound paths removed
   from main (they live on `legacy-csound`).

Prototype evidence + csound→Faust port map: see the faust/ directory and the
2026-07-03 session; benchmarks: 144-param live patch swap 0.43ms, clean at 8x
CPU throttle, offline render 3x realtime.
