# Model evaluation — 2026-06-11

**Purpose now clear:** gradually-morphing genre mixes WITH song structure,
played live by the explorer. Evaluated against that.

## What works
- The kernel's combinatorial blend + glide gives real gradual morphing
  (verified: 15/15 confusion matrix; Discogs-EffNet ranks jungle #1).
- The journey mechanics (tempo ≤3bpm/bar, one discrete flip per 2 bars) are
  the right musical contract.
- Sample layer (breaks/hits/vox/speech/78s) gives genres material identity
  synthesis can't.

## Weaknesses found (and what this round did about them)
1. **Live mode had no song structure** — it looped one groove. → exploreLive
   now walks the form's actual sections (cycles, fills on final cycle, sweeps
   on entry/exit). Structure + journey coexist.
2. **Glitches while dragging** — instruments recompiled EVERY bar because
   glided numerics changed the signature. → recompile only on model changes
   (or 8-bar numeric refresh); lookahead 2.2s→4.5s.
3. **Synthwave gravity** — too many anchors resolved to saw-stack leads over
   moogladder pads. → brass + strings models; choir/piano/wobble spread wider;
   per-genre grit (master drive); melodic generative bass; cut + hat-rush
   fills; per-cycle drum evolution (later cycles densify). Anchors re-pinned.
4. **Repetition** — 1-bar sameness in basslines/drums. → "melodic" bass is
   generative per chord; bass gets push/rest/octave variation; drums already
   mutate per chord + cycle evolution. Still the weakest area — see roadmap.

## Roadmap (honest, in value order)
- **Scale-aware melody engine**: phrases as scale degrees (mode dimension
  reaches melody, blues licks bend), motif development across sections
  (AABA, call-response), not per-chord templates.
- **Percussion lanes**: 2nd/3rd perc voice (techno needs layered machines).
- **Fill intelligence**: fills that quote the section's own pattern.
- **Arrangement memory in live mode**: journeys that land a new genre at a
  section boundary (quantize discrete flips to form, not bars).
- **Audio-verifier in the loop**: render 10s probes during generation, gate
  on Discogs-EffNet (currently post-hoc only).
- **Sample auto-curation**: classify the Dangerous CD one-shots (centroid/
  duration) instead of hand-listing; mine more 78s (georgeblood is huge).
