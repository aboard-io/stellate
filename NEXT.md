# NEXT — work queue after the 2026-07-04 credit-exhaustion cutoff

Four crews were running when Fable-5 credits ran out; all died mid-task.
This file is the honest state + the queue. Gate law unchanged: `./verify.sh`
must pass (matrix 61/61, validate, engine press-smoke), plus a live headless
smoke for anything touching `explorer.html`/`faust/live.js`.

## Landed this session (committed, verified)
- **v4 Phase 1** — pulse-set rhythm lanes, `chordEvery` dimension, buildEvents
  ~30% faster, 1017/1017 fixture hashes byte-stable.
- **Audio laws** — crackle −6 dB at the one realization point; noise sweeps
  −9 dB + deep resonant cut (riser 150–2200 Hz res .72).
- **Zoom laws** — pinch scales type (`k^0.85`), white-on-interact, chrome
  pixel-locked.
- **Model D voice** (`faust/dsp/modeld.dsp`) — 3-osc + ladder + filter-env +
  drive + glide/portamento, mono-legato pool. Wired to synthwave/darksynth/
  edm/krautrock/italo/disco/spacelounge. Presses clean. (Live mono-legato:
  verify it actually slews between legato notes in the browser — the press
  path is proven, the live pool behavior is the risk.)
- **Live DX7 patch morphing** (`explorer.html`, `faust/live.js`) — the answer
  to "does the DX7 transformation actually happen": discrete voice-flips now
  deep-copy the dx7 (and sampler) object; same-algorithm blends lerp the
  144-dim param vector live at the 0.13 glide ease. Live smoke clean.
  TODO: confirm with a slow-drag headless probe that applied params MOVE
  (the crew died before reporting its numbers).

## Prepped but NOT wired (material on disk, no code)
- **hogcore material**: 24 Harry Potter character-name wavs at
  `found/samples/speech/hp_*.wav` (espeak, varied voices = a cast) + recipe
  section in `fetch-found-samples.sh`. NO `genre-tool.js`, NO spec, NO anchor
  yet — the genre-tool crew died blocked waiting on kernel files.
- **crate-dig orphans**: ~525 MB in `found/video/lib/` (3D-graphics reels,
  Momotaro PD anime, etc.), gitignored. NO `segments.json` manifest — the
  manifest agent died. Unusable until cued. Either write the cue manifest
  (ffmpeg scene-detect → {in,out} windows per source, see the workflow script
  at `.claude/.../workflows/scripts/crate-dig-av-library-*.js`) or delete.

## Queue (approved by Paul; see memory: synth-fleet-and-genre-tool, kernel-v4-program)
1. **genre-tool.js** — `create <spec.json>` → validated anchor + measured
   verifier targets + insertion + gate run. Then apply the two commissions:
   - **hogcore**: HP names over very simple hyperpop, 150–170 bpm, the hp_*
     voices ARE the hook (material already on disk).
   - **prelude**: Bach-prelude broken-chord 16ths, `chordEvery:16` (Phase 1's
     first real user), felt piano / bright grand, kit off, light rubato.
2. **Synth fleet** (Workflow: parallel per-synth dsp builders → integrator →
   gates): Juno-60, true TB-303 (diodeLadder + accent/slide), Solina, Hammond
   B3+Leslie (drawbars = blendable vector), hard-sync lead, Casio CZ (os.CZ),
   Mellotron sampler-mode, Prophet/OB-SEM pads (ve.oberheim), PPG wavetable,
   VP-330. Map each to genres.
3. **Faust wings**: reverb COLOR as a genre dimension (spring→surfrock,
   greyhole→witchhouse, dattorro→citypop, dry FDN→tango); `an.pitchTracker`
   auto-tune of found vocals to song key (transforms the voice crates); wah
   on funk/disco bass; qu.lib scale-snap for bends; multiband master.
4. **v4 Phases 2–6**: transform algebra as a blendable dimension (IDM), unified
   timeFeel, generalized sample-event roles, form grammar + 3-min solver
   (already partly shipped), instrument source-class axis + deletion list.
5. **Deep passes for the audit's worst 10** (KERNEL-V4.md): darksynth (scores
   100 AS dubstep), mallsoft, the wash cluster.

Do NOT re-press the grand tour (`journey/` stays the July-3 csound artifact).
