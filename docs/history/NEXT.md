# NEXT — state after the 2026-07-04 marathon (sessions 1+2, all work complete)

Gate law: `./verify.sh` must pass (matrix 63/63 diagonal-dominant, validate,
engine press-smoke) plus a live headless smoke (incl. the L/R balance
assertion) for anything touching `explorer.html`/`faust/live.js`. Fixture
guard: `fixtures.js` (1047 hashes) — regenerate only justified drift, listed
per commit. Verification philosophy (settled with Paul late in the day):
machines verify structure — identity/margins, determinism, load, firing
rates, clipping; HUMAN EARS verify taste, via the live app. No spectral
A/B theater for matrix-invisible taste changes.

## Landed 2026-07-04 (everything pushed through 2700043)
- **Synth fleet** (9 voices) + integration: stereo voice path, live
  mono-legato, tb303 accent/slide. faust/VOICES.md has voices + traps.
- **genre-tool.js** + hogcore/prelude; genre-tool later learned the star
  chart (spec.pos required, spliced into explorer's positions block).
- **Faust wings**: reverbColor, found-vocal autoTune, insert_wah, master_mb
  multiband — all zero-rng dimensions with regression probes.
- **Mellotron sampler-mode**; hammond joined the verifier acoustic list.
- **KERNEL-V4 complete** (six phases) + **form grammar** (seven forms as
  data, optional introMode, section-drop lever) + **kit-as-data** (euclid
  lanes). rng map: groove +777, thunk +8181, acid +3030, transforms +31337,
  sampleEvents +9091.
- **Worst-10 deep passes + margin round**: every audit genre >= +5; the
  interlock feature (afrobeat .39 vs four-on-floor ~0); jazz/blues twins
  fenced; NO_AUTO_GENRE exemptions EMPTY; no negative matrix columns.
- **Found-handler retirement**: stations/horn/ding -> sampleEvents
  (vocabulary: every/maxDur/vol/glitchBursts); vox + vocal kept with
  documented reasons.
- **hogcore**: the 24-voice cast declares "<name> is trans" — full phrases,
  one per two bars (every:2, maxDur:8), chops + drop stabs.
- **Explorer**: continuous blend weights (no snap discontinuity), zoomed
  pan reaches everywhere (PAN_PAD .55), boot progress bar on real events,
  big breathing traveler that never blocks waypoint drags, double-tap
  deletes waypoints, labels white 10s, path points 2x, single-finger pan
  when zoomed, hogcore/prelude stars placed.
- **Live video variety**: shuffled no-repeat bags per play session; random
  start offsets; rendered video path stays seeded.
- **Audio**: hard-left dry-bus panning fixed (+ standing L/R gate);
  crackle/scheduler reports diagnosed to the genre-entry module hitch —
  two-tier prewarm (main-thread wasm prefetch for 15 heavy modules,
  full-node for the 6 small inserts).
- **DJ-mix seams**: journeys/playlists render one continuous set —
  equal-power downbeat-locked crossfades, varispeed beatmatch <= 8bpm,
  hard cut into cold-open genres or gaps > 40bpm; md5-deterministic.
- **Ear notes**: liberal snare ping-pong (lofi .78/triphop .72/downtempo
  .66; snarePP >= .65 = 2-beat/.82 smear, below = legacy throw); bass
  warmth (tape distort on the dusty genres, DI chorus on citypop's saw).
- **Effects audit INSTALLED** (24 items / 27 genres, all tiers): reverb
  colors (disco/spacelounge/jazz/shibuyakei dattorro, dub spring),
  phasers (dub skank, psytrance lead, afrobeat organ, gabber hoover),
  snare throws (jungle/dubstep/phonk .5), house masterComp .3, blues/
  bossanova pushPull, breakcore transforms, wintersynth/doomdrone
  mellotron, trance chorus, desertblues assouf chorus, dub/psytrance jux,
  insert_tremolo built+wired (surfrock Farfisa pad 7/16 — the lead is
  sampler-skipped — + exotica vibe fan), and the soft-top cluster's
  historical muffle (VHS/storefront/wire-recorder/shortwave bands) with
  all four margins held exactly, zero TARGETS edits.
- **Cleanup**: grand tour (840MB) + mix/ demo set + umiwashi reel deleted;
  ~340MB derived audio swept; crate-dig recipe committed.

## Parked (small, non-blocking)
1. **transitwave +0 column margin** — the last knife-edge tie (pre-dates
   everything); wants a micro-pass someday.
2. **krautrock mellotron** — declined by the apply crew: its pad pool is
   organ-dominant, nothing for the flag to bite; needs a pool change first.
3. **Sample video's vaporwave preset** rides the old defaultState literal
   (migrating changes the committed showcase — deliberate).
4. **mix-page header** shows tracklist-sum duration, not the DJ-mixed
   length (cosmetic).
5. **Floored-by-identity seeds** (blues all, chinawave s5, newage s1,
   prelude s2/s3, witchhouse s2/s5 NO_SECTION_DROP) — documented
   intentional; canon IS long.
