# NEXT — state after the 2026-07-04 marathon (all queued programs complete)

Gate law unchanged: `./verify.sh` must pass (matrix 63/63 diagonal-dominant,
validate, engine press-smoke), plus a live headless smoke for anything
touching `explorer.html`/`faust/live.js`. Fixture guard: `fixtures.js`
(1047 hashes) — regenerate only justified drift, listed per commit.

## Landed 2026-07-04 (all pushed through d4a8210)
- **Synth fleet**: 9 classic-synth voices built, probe-verified, integrated
  (stereo voice path, live mono-legato fix, tb303 accent/slide per-note
  contract). faust/VOICES.md documents all voices + traps.
- **genre-tool.js** + commissions: hogcore + prelude (matrix 63/63).
- **Crate-dig library** cued (cut-lib-clips.sh) + 16 clips pooled across
  24 genres. One flag AWAITING PAUL: found/video/lib/anime_momotaro_umiwashi
  .mp4 is WWII propaganda w/ racial caricature, un-cued — delete or keep?
- **Faust wings complete**: reverbColor (4 modules), found-vocal autoTune,
  insert_wah, master_mb multiband glue — all zero-rng dimensions with
  regression probes (probe-reverb/-autotune/-wah/-mbcomp); scale-snap
  skipped with reason (bends already land on target).
- **Mellotron sampler-mode** (wow/flutter/8s tape cap) on neoclassical/
  dinosynth/witchhouse; hammond joined the verifier acoustic list; disco
  got its B-3 stab (solina measured and deliberately kept synth).
- **KERNEL-V4 COMPLETE** (six phases): pulse-set lanes, transform algebra,
  unified timeFeel, sampleEvents roles, 3-min duration solver + section
  tags, source-class axis + deletion close-out. rng map: groove +777,
  thunk +8181, acid +3030, transforms +31337, sampleEvents +9091.
- **Worst-10 deep passes COMPLETE**: every audit genre now margin >= +5
  (darksynth 0->+6, mallsoft 0->+8, witchhouse +1->+7, wash trio +5/+6,
  exotica/spacelounge/arabpop +5/+6, coldwave 0->+6, triphop +1->+6,
  idm +1->+8, sludgemetal deepened). Latent _gid order-dependence bug
  found and fixed in the darksynth pass.

## Known remaining (future rounds, none queued)
1. **jazz -1 column margin** — blues scores 100 as jazz (the acoustic-twin
   pair, predates the worst-10 program). Needs its own paired pass.
2. **Bespoke found-handler retirement** — horn/ding/stations/vocal ->
   sampleEvents port (target tag:ground/tag:cadence), genre-by-genre with
   A/B render gates; then delete the toState specials + engine handlers.
3. **Form-grammar interpreter** — retire the seven-form else-if chain +
   generateSong (render-sample-video/defaultState depend on it today).
4. **Full kit-as-data** — euclidBeats is still a function overlay.
5. **Margin retuning leftovers** — afrobeat still MARGIN_FRAGILE (solver
   exemption); floored genres (blues, prelude, newage, chinawave,
   sludgemetal on some seeds) want node-repetition/section-drop paired
   with margin checks; verifier lacks an interlock feature (afrobeat's
   point).
6. **Reverb-color tap-out** — delay/pp bleed still only feeds the internal
   zita, not the external color nodes.
7. **Live mono is per-unit** — modeld/tb303/synclead each get one fixed
   node; fine today, revisit if a genre wants two simultaneous mono leads.

The July-3 grand tour (`journey/`, 840 MB incl. its mix page) was DELETED
2026-07-04 at Paul's direction — the csound-era artifact is gone from the
live site; the journey generator itself is unchanged and can press new ones.
