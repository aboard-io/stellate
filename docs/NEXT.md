# NEXT — the handoff note (2026-07-10, end of the two-day batch)

*For the next session. Paul: "Leave a note for opus to finish it all." Read
this whole file, then CLAUDE.md, then docs/MUSICALITY.md and
docs/INVARIANTS.md. The memory system carries the same queue with session
color; this is the committed source of truth.*

## Where the world stands

Deployed and verified live at stellate.app (commit `91c3b74`): **228 genres,
228/228 diagonal-dominant AND 228/228 musicality-OK.** Travel works at both
scales (parked arrival ≤3 bars drums / ≤7 identity — `test/blend-arrival-run.js`;
transit arrival on dominance — `test/transit-arrival-run.js`; whole journeys —
`tools/simulate-path.js` + its gate). Instruments sit in their natural
registers (the fold + the regHome pins), carry their declared insert character
on every path, and the synthesis fleet has hi-gain staging, filter envelopes,
and tempo-synced LFOs waiting for anchors to claim them. `./verify.sh` runs
FOUR concurrent referees (matrix, validate, engine presses, `prove` — the
convexity proofs + property sweeps). `tools/ship.sh` = gates → push → deploy;
deployed always means committed and green.

## The working method (this is how the batch was built — keep it)

1. **Specific is general** (Paul's standing rule, in memory too): one
   genre-complaint = one sample of a class. Diagnose the instance, SCAN the
   catalog for the class, fix at the mechanism when broad / the anchor when
   narrow, encode the law so it can't recur. Never close a task with only the
   named genre fixed.
2. **Mechanism before anchors.** Balance loop 2 cleared 59 genres editing
   ZERO anchors. The duration solver's tie-break was one line; the register
   class was one homing function.
3. **The referees hold each other.** Matrix 228/228 `--no-cache` after every
   kernel change; musicality never feeds TARGETS; determinism/absent-law
   byte-proofs for untouched states; fixtures re-captured with drift
   CLASSIFIED (name the genres, name the cause — unexplained drift is a bug).
4. **Delegate heavily, commit centrally.** One agent per file territory,
   read the recent commit messages first, "done-and-green beats
   everything-at-once" escape clauses, reports with numbers not vibes.
5. **validate's "loses to X" names the RUNNER-UP, not the argmax** — score
   the new row directly before blaming the named genre (paid for itself
   four times).

## THE QUEUE, in order

### 1. Card-truth fix wave (task #21 — the agent died before its kernel pass)
**STARTED 2026-07-10 (accessible-version branch):** the sweep was re-run
(scratchpad/card-truth-sweep.js → 33 liars, 7 identity-lies, 99 orphan samples;
dominant class = orphaned speech). The LIVE cadence amplifier is FIXED and the two
NAMED orphans are WIRED (see below). Remaining: the rest of the speech cast + the
synthesized-source class (new finding, below) + the promises gate.

- **DONE — the LIVE cadence amplifier**: faust/live.js stepWalk now threads real
  section-boundary flags (`one._liveEdge={start,end}`) and csd-engine.js gates
  opener/oneShot/cadence on them. Proven: press byte-identical (git-stash diff over
  12 sampleEvents genres), live fires once-per-section (microwave 6 dings/24 bars
  vs 24/24 before). Press has no `_liveEdge` → unchanged by construction.
- **DONE — sp_auction_1/2/3 → auctioncore**: the auctioneer chant now rides as a
  buried vox layer (hogcore idiom: every:2, maxDur:9) + a number-stab in hits; the
  tw_ding gavel stays as the section cadence (now once/section). Matrix 228/228
  --no-cache, live-renders clean.
- **DONE — modem_handshake → dialupgabber**: root cause was `url:""` — the file
  (found/modem_handshake.mp3) was on disk but unfetchable, so it never played. URL
  restored; handshake wired as a section opener. Matrix 228/228 --no-cache.
- **DONE — the full 20-genre speech cast**: every remaining orphaned commission
  voice wired into its namesake genre (buried vox for running voices, cadence for
  the "end" one-shots dw_done/fax_nocarrier/floppy_save). Ambiguous three resolved
  by card: cereal→cerealwave, eula→termswave, grace→microwave. Matrix 228/228
  --no-cache; each genre resolves + emits speech events; live-renders clean.
  TASTE PENDING: vols set 0.36-0.46 by the wiring agent — Paul's ear on prominence.
- **DONE — the SILENT SYNTHESIZED-SOURCE CLASS** (specific is general): modem was
  one of TWELVE SOURCES with `url:""` but a real found/<id>.mp3 on disk, so the
  found-player fetched "" → silence. ~51 genre-source references across the catalog
  were mute (hvac_hum 20 refs, hydrophone 10, whale_song/crickets 4 — the
  pitched-down wind/water/whale/cricket beds the cards + code comments describe as
  if they sound). ALL 12 urls restored (crt_whine, floppy_seek, hvac_hum, fax_tone,
  dryer_spin, chickadee, pigeon_coo, dw_cycle, ferment_bubble, crickets, hydrophone,
  whale_song); all decode to real audio. The two that were also UNWIRED got proper
  layers (not the bpm-matched `break` role, which silently drops texture clips):
  floppy_seek → floppycore `slice` (the seek-clatter chopped into the IDM shuffle,
  231 events), dryer_spin → laundrycore `bed` (the wash). Matrix 228/228 --no-cache,
  verify.sh green, affected genres live-render clean. **TASTE PENDING (Paul's ear):
  ~15 genres just gained their intended ambient beds — confirm none are too loud.**
  **PRIMING NOTE: fixing hydrophone did NOT revive atlantidrone — it still hangs at
  "priming…" (rms 0). So the priming hang (§5) is NOT the url:"" bug; it's a
  separate stall (likely the sampler-zone decode flood). Hypothesis disproven.**
Full findings: the card-truth sweep report (2026-07-10 session) +
`/tmp/.../scratchpad/card-truth.json` may be gone — RE-RUN the sweep extractor
if needed (its design: parse info cards into claims, classify
KEPT/STATE-MISSING/SILENT/UNDISCLOSED; only 13/140 carded genres fully
delivered). The wave, in value order:
- **Wire the orphans** (matrix-safe slots): `sp_auction_1/2/3` →
  auctioncore (hits.sources + a hogcore-style sampleEvents vox layer — the
  auctioneer chant IS the genre; the files exist in
  `found/samples/speech/`, registered in SAMPLES, referenced by NOTHING).
  `modem_handshake` → dialupgabber (registered with comment "the drop",
  used by nothing). Census SAMPLES/SOURCES for other unreferenced ids.
- **The LIVE cadence amplifier** (systemic): `live.js stepWalk` builds each
  chord-bar as a ONE-SECTION song, so section-scoped sampleEvents
  (cadence = section END, opener = START — csd-engine ~:1598-1710) fire at
  EVERY window edge: auctioncore's ding played 34/34 bars live vs 7/song
  press. Fix: thread real section-boundary flags from the walk into the
  per-bar `one` state (lastCyc precedent), gate those placements. Press
  path must stay byte-identical; prove with a live headless ding-count.
- **auctioncore's break + card**: found.vol/cutoff to the ragga calibration
  (vol .3-.45, cutoff 6-9k — currently reads as hat chatter under the 808);
  rewrite the card to the truth. Retune ITS row only if needed.
- **crimsoncourt's ringmod lead** (invariants finding): `isModel` rejects
  ringmod — 16/60 seeds draw a silent fallback. The spec author almost
  certainly meant a ringmod INSERT on the lead.
- **Top-liar triage** (~12 by sweep weighting): dnb ("the amen polished
  into a groove" — NO break source at all), happyhardcore (no breaks, no
  piano), submarinelullaby, umpirehouse (orphaned umpire vocal, the
  auctioncore class). Where the element honestly shouldn't exist, soften
  the CARD — cards must not lie in either direction.
- **DONE — the promises gate**: card-parse mode ported into engine/musicality.js
  (checkCardClaims), capability read from the MIXED STATES (not spec pools, so
  reggae's organ isn't false-flagged), wired once-per-genre into audit() as
  WARN-level (graduation rule); shows in validate gate 8 (197 ok / 31 warn).
  test/musicality.test.js pins it (catches gabber's hoover, ceiling <=45 as the
  regression tripwire). REMAINING (taste/ear): the 38 flagged card-lies are the
  honest worklist — either give the genre its element or soften the card. Notable
  real ones the gate now names: gabber hoover (§5 signature-model candidate), dnb
  amen (no break source), whalejazz sax (empty pool), happyhardcore. STILL OPEN:
  the 7 identity-lies + softening cards that over-promise (don't mass-rewrite).

### 2. Balance loop 3 — anchor wiring for the new synthesis surface
The synthesis-depth program shipped the machinery (commit `b328159`); no
anchor claims it yet. Asks accumulated from agent reports:
- **higain** for the metal wing: longshipwhip, bogironwallow, barrowwake,
  ravensquall, valkyrieswoop, heavymetal, sludgemetal, industrialmetal
  (+gabber/breakcore judgment call) — stage/tone per archetype (thrash
  tight-gated, doom saturated-loose, funeral organ-dread through it).
- **fenv claims**: acid/electro/funk families (squelch), synthwave
  (brass swells) — survey which genres' identity wants within-note motion.
- **LFO wiring**: dubstep/wobble cutoff at 1/8 tempo-sync (THE genre
  feature), italo pwm, trance gated-amp 1/16.
- **wah mix ask**: insert_wah at .85 trims sampled funk bass ~3.9dB
  (disco/newjack/picnicswing/chromeufo) — consider .6-.7 if AUDIBLE flags.
- lofi + footwork buried-lead template: Paul's call, still open.
Referees as always; expect fixture drift exactly = the claiming anchors.

### 3. MUSICALITY phase 3 — the acoustic laws (task #17's last piece)
AUDIBLE / SPECTRUM / BALANCE on the stem-press harness (docs/MUSICALITY.md
§laws 1,5,6). Design notes earned by ear: AUDIBLE must be **density-aware**
(the oboe trio: audible in chalkvespers' empty chant, masked in gabber's
wall — masking ≠ under-level; gabber's verdict is on record: accept the
buried color or re-instrument). The stem-surgery pattern is proven
(the steel-guitar diagnosis). Graduation rule stands: a law goes HARD when
its top-10 and Paul's ear agree twice.

### 4. Solos (task #23) — DONE 2026-07-10
Shipped: a CsdTheory-driven improviser (csd-engine melodyEvents "solo" — chord
tones + chromatic approaches + contour + call-response, per-bar dedicated rng)
and a solo section injected into bebop/jazz/blues/funk/bluegrass (buildSections,
before the solver, drop-pass exempt), comp ducked (soloDuck). Matrix 228/228,
determinism-gated. OPEN: prog's odd-meter solo (no prog genre wired yet — add
one to SOLO_IDIOM), blues's evolution can shed its solo (floored edge), and
richer idioms (outside/altered scales) are a future pass.

### 4b. Card-lie worklist (from the promises gate, 2026-07-10)
The gate names 3 GENUINE remaining lies: **gabber + happyhardcore's hoover**
(never sounds in sampled mode — §5 signature-synth candidate; add "hoover" to
whatever list keeps tb303/hammond synth), **happyhardcore's absent piano +
breakbeat rolls** (an identity lie — pools are saw/reese/stack/juno60), **ska's
guitar skank** (pools are brass/organ, no guitar/kpluck). Each: give the element
or soften the card. Dynamics floors + speech-cast vols were kept as tuned (Paul
blessed dynamics; speech vols 0.36-0.46 matrix-safe).

### 5. Smaller filed items
- **PRIMING HANG — a genre that never plays** (2026-07-10, found building the
  accessible page; reproduces on BOTH index.html and access.html): a small class
  of genres never fills the engine runway — status stalls at "priming…",
  `rms()` stays 0.00000 (no audio at all, not merely quiet), no page errors. A
  representative 22-genre scan hit `ambient`, `atlantidrone`, `chalkvespers`
  (3/22); adjacent drone/ambient genres — newage, doomdrone, spacelounge,
  submarinelullaby, permafrostveil — all prime fine, so it is NOT "quiet = hangs."
  Exact-zero RMS points at a true pump stall on some state field these three
  share, not slow attack. NEXT: run the full 228 scan
  (`scratchpad/prime-scan.js` pattern: goLive per genre, poll rms, 9s budget) to
  get the whole class, then diff the hanging states against a priming neighbour
  (doomdrone vs atlantidrone) to find the choking field in faust/live.js's pump
  (`status("priming…")` → RUN-on-primed, ~live.js:1077). This is high-value:
  a never-priming genre is dead air, and the matrix/musicality referees are
  symbolic — they never caught it because they don't render THAT path to audio.
- **bpm SAFE bound** (invariants OPEN finding): nothing clamps tempo
  anywhere; decide the consumer bound and close the hull.
- **gabber's hoover** never sounds in sampled mode (wind fallback) —
  signature-model candidate (the tb303/hammond law).
- **stem-parity-test re-pin**: its citypop_s7 pinned state went sampler
  when sampled-by-default landed (pre-existing red, proven on HEAD).
- **browser/node rng divergence**: same seed resolves different insert
  params per environment (suspect NameBank consumption order) — a kernel
  determinism nuance; diagnose, decide if it matters.
- **Dead-range asks** (invariants): edm asks 8 voices renders 7; six
  anchors ask pad release past the 3s cap — honest-up the anchors or lift
  the caps deliberately.
- **VOICES.md**: the synthesis-depth agent died at its documentation step —
  verify VOICES.md fully covers higain/fenv/LFO params (it was mid-write;
  the tree diff landed, check completeness).
- **Identity churn residue**: K.mix re-picks discrete dims as weights
  sharpen (root cause is kernel-side discrete re-draws along the approach);
  the tier-1 re-queue fix landed, but the deeper fix (quantize weights for
  discrete draws so the target stops re-rolling) is unexplored.

### 5b. THE VECTOR-KERNEL PROGRAM (Paul 2026-07-10: "the kernel can be
simplified and rebuilt in terms of lists of vectors run through streaming
transformations ala APL… increase the verifiability and expressiveness")
Step 0 SHIPPED: **engine/prove-matrix.js**, the offline matrix prover — the
anchor catalog as LO/HI Float64Array vectors, the blend hull as one reduction
per dim, DIFFERENTIALLY cross-checked vs invariants.js (37/38 EQUAL, fx.jux
TIGHTER-by-design, 0 WIDER) + a 300-blend seeded witness through real K.mix;
verify.sh's fifth referee ("matproof"). The staged path (each step
fixture-gated, the FORMS-refactor method):
  1. COLUMNAR EVENTS: buildEvents emits {beat[],pitch[],amp[],dur[],voice[]}
     struct-of-arrays behind the current API; passes (swing/humanize/dynamics/
     snare-law/transforms/solo) become elementwise array ops.
  2. THE RANDOMNESS TAPE: pre-draw rng into a vector consumed positionally;
     every pass becomes pure (state, tape) -> events; draw-order byte-identity
     becomes true BY CONSTRUCTION (the amp0/snare-law collision class dies).
  3. Combinator DSL over the columns (the transform pool generalized).
  4. Blend/verify as first-class matrix ops; BLAS/GSL-WASM at the
     matrix()/hull() seam when feature-space scale demands it.

### 5c. The bookmarkable mix (Paul 2026-07-10) — SHIPPED
app/share.js: seed + waypoints + pace + mode + the CURRENT MEASURE ride the
query string (?seed&path&pace&m), replaceState per bar; loading such a URL
restores the loop and DROPS IN at that measure (S.startBar -> exploreLive
opts.startBar -> makeWalk fast-forward: measure N is byte-identical to having
played N bars). The traveler is a DRAGGABLE PLAYHEAD (starmap hitTraveler/
projectOnPath — a glide live, a place stopped; stopped drags set the resume
measure). stopLive records the measure so ▶ resumes. Path edits clear startBar
(the old measure no longer maps). ⚙ panel: ⧉ share copies the link. The ⓘ viz
playhead lights the ACTIVE MEASURE (4-beat block, steps not sweeps). MACROS
REMOVED SITEWIDE (Paul: "get rid of all macros") — UI/exports/tests gone,
kernel applyMacros machinery intentionally kept (absent = byte-identical);
test/macro-live-run.js retired. Gate: test/share-url-run.js (11 checks).
access.html: seed/genre/blend in ITS query string too.

### 6. The standing horizon (Paul-stated goals not yet scheduled)
- The hour-render service (docs/EXPORT.md sketch: tools/render-server.js
  on the droplet, queue + credits.txt with tier-3 stripped).
- Repo public flip: `gh repo edit ftrain/stellate --visibility public` is
  PAUL'S step; the site's GitHub links 404 until then.
- Odd-meter wishlist round 2: prog's true 7/8 (sliderule), 5/4
  (hexagonstampede), 9/8 (meadowmellotron); the authors' vocabulary
  wishlists (whole_tone progression, alberti bass, mellotron voice, cs80,
  epic_maj, arctic-wind beds, war-drum hits).

## Gates to run before ANY ship
`tools/ship.sh` does it, but know what it means: verify.sh (matrix 228/228 +
validate + engine + prove), theory/pipes/speech/meter/musicality/invariants
suites, and for engine/app changes the browser battery
(explorer-ui, access-ui, blend-arrival, transit-arrival, simulate-path-run,
genre-viz, sampler-inserts-live, bg-survival, live-test, wavout — NODE_PATH=
/home/ford/ftrain-2025/node_modules, pinned chromium-1217).
`test/access-ui-run.js` (added 2026-07-10) is the accessible-page gate: it drives
access.html headless and asserts the text/keyboard UI is the SAME deterministic
instrument (all 228 genres, hold + A/B blend + journey with real audio, page mix
byte-equal to a direct kernel mix, zero errors). Run it after any targeting.js /
live.js / state.js change — it exercises the shared glide engine from the second
entry point. The deploy
invariant will catch you honestly if you misclass a mutable file — it's
been right three times.

Machines verify structure. Ears verify taste. The ears are Paul's;
everything else is yours to finish.
