# NEXT — work queue (updated 2026-07-04, post synth-fleet integration)

Gate law unchanged: `./verify.sh` must pass (matrix 63/63 diagonal-dominant,
validate, engine press-smoke), plus a live headless smoke for anything
touching `explorer.html`/`faust/live.js`.

## Landed 2026-07-04 (commits 5f8c11e + 5b26293, verified)
- **Synth fleet** — nine classic-synth voices, each compiled + probe-verified
  (identity behaviors measured): juno60, tb303 (true accent/slide), solina,
  hammond (9-drawbar morph vector + Leslie), synclead, casiocz, oberheim,
  ppg (wavetable scan), vp330. Wired across ~18 anchors; recipes carry
  per-genre signature params (see faust/VOICES.md).
- **genre-tool.js** — `create <spec.json>` (schema derived from kernel source,
  vocab-validated, verifier targets MEASURED from seed renders, idempotent
  marked insertion, gate run) + `check <name>`. Specs in `genre-specs/`.
- **hogcore + prelude** commissions, both self-score 100, matrix 63/63.
- **Stereo voice path** — first 2-out voices (juno60/hammond/vp330) carry
  real width through press + live; mono voices unchanged (centered).
- **Live mono-legato** — the probe-confirmed modeld FAIL is fixed: pool 1,
  held gate across legato groups, press parity (probe: nodes 3→1,
  re-attacks →1). tb303 slide + synclead use the same path.
- **DX7 morph** — verified monotone into the live worklet; timbreId no
  longer keys on dx7.name (killed the redundant ~22% single-bar flip snap).
- Regression probes committed: `faust/probe-modeld.js`,
  `faust/probe-dx7morph.js`, `faust/probe-dx7-kernel.js` (NODE_PATH
  playwright borrow, like live-test-run.js).

## NOT pushed
Both commits are local-only — pushing main needs Paul's go (deploy branch;
the working tree is already the live web root either way).

## Queue
1. **Faust wings** (approved; memory: synth-fleet-and-genre-tool):
   - **[LANDED, unverified-by-Paul] Reverb COLOR** as a genre dimension —
     4 modules (`dsp/reverb_{dattorro,greyhole,fdn,spring}.dsp`), one external
     reverb node selected per genre via `state.reverbColor` (dattorro→citypop+
     house, greyhole→witchhouse+dinosynth, fdn→tango+blues+prelude, spring→
     surfrock). See faust/VOICES.md "Reverb COLOR family". Gated: probe-reverb.js
     + verify 63/63 + live smoke, 39 untouched states byte-identical, dist
     reverted to committed bytes (only the 4 new modules added).
   - **[NOT STARTED] an.pitchTracker AUTO-TUNE** of found vocals to song key.
     ARCHITECTURE NOTE for whoever picks this up: the found layer is NATIVE
     (found-player.js: AudioBufferSourceNodes live, pure-JS mixPCM in press) —
     it does NOT run through Faust, so `an.pitchTracker`/`ef.transpose` don't
     drop in directly. Two options: (a) route the voice-crate found chops through
     a Faust autotune node in LIVE + a JS pitch-shifter in press (two codepaths,
     press determinism to prove); or (b) a UNIFIED deterministic clip-snap —
     detect each voice clip's median pitch offline (autocorrelation on the
     decoded buffer), snap toward the nearest scale tone of state's key, apply as
     a `pitch` (playbackRate) multiplier scaled by `state.autoTune` 0..1. (b) is
     simpler + deterministic in both engines. Anchors to wire: hogcore ~0.7,
     vaporwave ~0.25; OFF by default; spokenword 0.
   - **[NOT STARTED]** wah on funk/disco bass; qu.lib scale-snap for bends;
     multiband master comp.
2. **Mellotron sampler-mode** (wow/flutter/8s cap on sampler.js) →
   dinosynth/witchhouse/neoclassical. Deferred from the fleet round
   (shared-file work, not a new dsp).
3. **Teach genre-verifier the new organs**: its `acoustic` model-list only
   knows organ/piano/sampler/dx7-organ, which blocked hammond/solina from
   disco's pad (documented inline at the disco anchor). Extending the list
   re-opens that wiring — re-run the dominance gates.
4. **v4 Phases 2–6** (KERNEL-V4.md): transform algebra as a blendable
   dimension (IDM), unified timeFeel, generalized sample-event roles, form
   grammar + 3-min solver (partly shipped), instrument source-class axis +
   deletion list.
5. **Deep passes for the audit's worst 10** (darksynth scores 100 AS
   dubstep; mallsoft; the wash cluster — validate still carries the
   pre-existing wash-cluster gate-3 margin WARN).
6. **crate-dig orphans**: ~525 MB in `found/video/lib/`, still no
   `segments.json` cue manifest — write it (ffmpeg scene-detect →
   {in,out} windows) or delete.

Do NOT re-press the grand tour (`journey/` stays the July-3 csound artifact).
