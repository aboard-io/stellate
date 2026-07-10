# NEXT — the handoff (2026-07-10, end of the marathon session)

*Read this whole file, then CLAUDE.md. The memory system carries the same
queue with more color (start at wave2-program + musical-dynamics +
vector-kernel-program); THIS file is the committed source of truth. 44
commits shipped today; everything below either finishes that work or is
Paul-stated and unstarted.*

## Where the world stands

Live at stellate.app: **240 genres** (twelve new spaces born fictional), every
real-world genre wearing an invented name (ids stable — techno's LABEL is
"Concrete Metronome"; the id `techno` is load-bearing, never rename ids), THE
MASTERING STAGE (pan + same-timbre carve + density-aware reverb budget + press
makeup), improvised SOLOS (ear-blessed), musical DYNAMICS (voices + per-drum
swells), the hoover signature synth, real instruments (looped tenor sax,
crunch/DI guitars, upright piano), the priming fix (chordEvery-32 bars split
into sub-windows — the 4 dead drone genres play), bookmarkable URLs with
measure drop-in (`?seed&path&pace&m` → makeWalk startBar), a draggable
playhead, stop-resumes/stop-twice-rewinds, THREE exclusive 100% views on ONE
view chip (✦ map → ⓘ viz → ▣ video, spinner while warming), a four-row ⚙
panel (seed+share · inverted pace · ±bpm delta · in-browser downloads), the
11-axis vector rose (no numbers), per-cell viz playhead, offline
(stale-while-revalidate SW + route precache that waits for the music), the
accessible version (trued up), THE POOL LAW (`pool:<class>*N` tokens in
sources lists, per-(seed,class) dedicated stream, byte-clean when unused), and
the offline matrix prover as verify.sh's fifth referee.

## THE QUEUE, in order

### 1. INTEGRATE WAVE 3 (the repertoire program — agents may already be done)
Four worktree branches under `git branch --list "worktree-wf_72496dd1*"`:
beds (79 new CC beds + SOURCE_POOLS fill + the anchor sweep to pool tokens),
hits/breaks (new one-shots/breaks + vocal_stab/chime/rave_stab pools + sweep),
forms (4-6 new arcs + 40-70 genres off `pop` + new progressions), clips
(30-50 PD clips + GENRE_CLIPS spread). THE PROCEDURE (used successfully for
waves 1-2 — follow it exactly):
1. Read each branch's commit message FULLY (they report numbers + skips).
2. `git merge --no-ff <branch>` one at a time; resolve conflicts by keeping
   BOTH sides' intent (they edit different fields of the same anchors).
3. MEDIA LAW: worktrees don't share untracked media. After merging a branch
   with a fetch script, RERUN the script on main (`tools/fetch-bed-expansion.sh`
   etc.); if a tool is missing (7z for FSBS!), copy from the worktree dir
   `.claude/worktrees/wf_72496dd1-2c3-N/found/...` — the script stays the
   reproducible artifact. NEVER let a fetch overwrite an existing deployed
   file (the immutability law below).
4. After each merge: `NODE_PATH=/home/ford/ftrain-2025/node_modules ./verify.sh --no-cache`.
5. After all four: fixtures re-capture (`node test/fixtures.js capture`) with
   drift NAMED in the commit; the full browser battery (see Gates); a
   press-spot of 3 swept genres proving bed/hit rotation across seeds while
   pinned identity beds hold; tools/ship.sh.
6. world.js PROG_MODE needs rows for any new progressions the forms agent
   added (it flagged this — app territory, theirs was kernel-only).

### 2. Paul's remaining ear/verdict items
- The fugue mastering A/B went to Paul — his verdict steers whether the
  mastering constants (reverb budget cap/floor, makeup target) get retuned.
- Speech-cast vols (0.36-0.46) + the dynamics floors are shipped defaults
  awaiting complaint, not re-tuning.
- `S.best` (the "verifier hears" readout in access.html nowSnapshot) still
  prints a raw genre ID — label it (small: K.GENRES[best].label).
- Sweep for any remaining real-genre-name leaks Paul spots (the map, chyron,
  lock screen, cards, how.html, README are done; access menus use labels).

### 3. The standing engineering queue (small, filed, real)
- **WAV-FIRST mobile split residual**: the priming fix split oversized bars on
  the ring path; `runBarAccumPump` (mobile WAV path) still renders a 30-38s
  first segment for the drone genres — slow start, not a hang. Splitting there
  interacts with bakeNative bed windowing. Awaits Paul's device test anyway.
- **stem-parity-test re-pin**: citypop_s7's pinned state went sampler when
  sampled-by-default landed (pre-existing red, proven on HEAD).
- **browser/node rng divergence**: same seed, different insert params per
  environment (suspect NameBank consumption order) — kernel determinism
  nuance; diagnose, decide if it matters.
- **Dead-range asks**: edm asks 8 voices renders 7; six anchors ask pad
  release past the 3s cap — honest-up the anchors or lift the caps.
- **VOICES.md completeness**: verify it fully covers higain/fenv/LFO params
  (the synthesis-depth agent died mid-write; balance3 then landed claims).
- **Identity churn deeper fix**: quantize weights for discrete draws so the
  target stops re-rolling along an approach (tier-1 re-queue fix landed).
- **--full validate 5-seed dominance**: 7 genres win 60% (canawave, phonk,
  surfrock, afrobeat, sludgemetal, industrialmetal, eurodance) — pre-existing,
  NOT a ship gate; a deliberate fence-tuning pass someday.
- **Bird-flagged beds**: berlin_dawn_fox/kruger_dawn/mull_night registered but
  unpooled (bird-rarity law) — canawave-adjacent dawn pools only, if ever.
- **Demoscene surface**: mode 2 (demos-only) left the view cycle; demos still
  alternate inside the video program. Decide if a dedicated surface returns.

### 4. THE VECTOR-KERNEL PROGRAM (Paul's architecture directive, staged)
Step 0 (matrix prover) + step 1 (columnar events, engine/columns.js) SHIPPED.
- **Step 2 — THE RANDOMNESS TAPE** (the big one): pre-draw rng into a vector
  consumed positionally; every pass becomes pure (state, tape) → events;
  draw-order byte-identity becomes true BY CONSTRUCTION. The amp0/snare-law
  collision and every "pass order shifts the rng" landmine is the motivating
  bug class. Method: fixture-gated, the FORMS-refactor precedent (byte-
  identical, zero drift).
- Step 3 — combinator DSL over the columns (generalize the transforms pool).
- Step 4 — blend/verify as first-class matrix ops; BLAS/GSL-WASM at the
  matrix()/hull() seam when feature-space scale demands.

### 5. The standing horizon (Paul-stated, unscheduled)
- The hour-render service (docs/EXPORT.md sketch: tools/render-server.js on
  the droplet, queue + credits).
- Repo public flip: `gh repo edit ftrain/stellate --visibility public` is
  PAUL'S step; the site's GitHub links 404 until then.
- Odd-meter wishlist round 2 (sliderule 7/8 true, hexagonstampede 5/4,
  meadowmellotron 9/8) + author vocabulary wishlists (partially landed via
  the forms agent's new progressions — check its report).
- More instrument upgrades from scratch/guitar-research/REPORT.md roadmap
  items 6-8 (VSCO2 strings 618MB CC0, Iowa alto sax, Karoryfer jangle).

## THE LAWS LEARNED TODAY (violate these and the gates will catch you — slowly)
- **Media immutability**: a deployed found/ file NEVER changes content under
  its name (clients + the SW cache it forever). Replacements get a NEW
  dir/name; the id can stay and point at the new dir (the tenor_sax_fp
  precedent). tools/ship.sh enforces it — it has been right four times.
- **POS placement**: screen anisotropy at the 1200x850 reference is ~2
  x-units/px vs ~30 y-units/px. Place new stars by the explorer gate's own
  metric (spiral search; the "screen-safe homes" commit has the script).
  NEVER full-rebake — the relaxation rescales the space, decalibrating
  SNAP/CUTOFF and moving fugue off its D2e spot.
- **The pool law**: pool tokens draw on a DEDICATED per-(seed,class) stream —
  never the shared rng (one extra shared draw = catalog-wide byte drift).
- **The snare-law/dynamics order**: dynamics runs DEAD LAST and stashes amp0;
  invariants re-checks bucket on amp0 (composed accent), not faded loudness.
- **sampleEvents point-placements** (opener/oneShot/cadence) are gated by
  stepWalk's `_liveEdge` on the live path; press never carries it.
- **Solo sections** are drop-pass-exempt and injected BEFORE the duration
  solver; blues can legally shed its solo (floored genre).
- **SW deploy semantics**: app code is stale-while-revalidate — a deploy
  lands ONE reload later. Hard-reload busts. Never make found/ network-first.
- **Fiction naming**: ids are code, labels are fiction. New genres are BORN
  fictional. No band names in cards; the promises gate parses cards for
  instrument nouns — keep claims truthful or the card-lie tripwire (pinned
  at 0!) fires.

## Gates to run before ANY ship
`tools/ship.sh` = verify.sh (matrix N/N --no-cache when the kernel moved +
validate + engine + prove + matproof) → push → deploy. For app/engine
changes also run the browser battery: explorer-ui, access-ui, share-url,
genre-viz, blend-arrival, transit-arrival, simulate-path-run,
sampler-inserts-live, bg-survival, live-test, wavout
(NODE_PATH=/home/ford/ftrain-2025/node_modules, pinned chromium-1217; the
fixed ports mean NEVER run the battery concurrently with itself). fixtures.js
capture after intentional drift, with the causes NAMED. segment-parity must
stay BYTE-EQUAL. musicality must stay all green with card-lies = 0.

Machines verify structure. Ears verify taste. The ears are Paul's;
everything else is yours to finish.
