# MUSICALITY — proving genres good, not just distinct

*2026-07-10. Paul: "You've got it with the diagonal. Look at the class of
issues we're facing and make it possible to improve and balance genres for
true musicality."*

The confusion matrix answers one question perfectly: **does this genre sound
like itself and nothing else?** It cannot answer the question a listener
actually asks: **is this good?** Today's session produced, by accident, the
spec for that second verifier — every taste complaint was an *instance of a
checkable law*:

| Paul said | The law it implies |
|---|---|
| "the steel guitar is unhearable" | **Audibility** — every resolved part must contribute audible energy |
| "instruments an octave or two high lose all their characteristics" | **Register integrity** — notes live inside the instrument's natural range |
| "I don't hear ensemble or phaser on the organ; it's reedy and distant" | **Character delivery** — the timbre a genre declares must reach the ear |
| "one-drop reggae: kick on beat three — NONE of that is happening" | **Promise-keeping** — the genre card is a falsifiable contract |
| "prelude takes so long to get going; some parts never show up" | **Bloom** — every part arrives within a listener's patience |
| "things shriek a little" | **Spectral taste** — a ceiling on harshness, a floor on mud |
| "it changes way too fast / never changes" | **Motion** — transitions land (blend-arrival gate) at a musical pace |

The pattern: the matrix verifies the *score*; musicality verifies the
*performance*. Both are machines-verify-structure — ears still own taste —
but this moves the boundary: what today needs Paul's ear should tomorrow
need it only once, when the law is written.

## The laws (v1)

Each law produces a per-genre score in [0,1] with a named failure list.
Symbolic laws read `buildEvents`; acoustic laws read cheap stem renders
(the press already isolates voices — the steel-guitar diagnosis pattern).

1. **AUDIBLE** *(acoustic)* — for each resolved voice with events: its solo
   stem RMS over its active sections ≥ a role floor, AND its level in the
   full mix is not masked to nothing (mix-minus-stem delta ≥ threshold).
   Catches: buried steel guitar, distant organ, vol-0 wiring mistakes.
2. **REGISTER** *(symbolic — the mapping layer now enforces the fold; this
   verifies it)* — % of sampled-voice notes played within natural zone range
   ≥ 0.95; rate-stretch beyond ceiling = named violation.
3. **BLOOM** *(symbolic)* — time-to-first-onset per core part (drums, bass,
   lead/melody, pads, found) ≤ genre-appropriate bounds; time-to-full-ensemble
   ≤ bound; a declared part that NEVER sounds in a standard track = hard fail.
   Bounds live per-form (a dj plateau blooms slower than pop — bounds are a
   form table, not one number). Prelude is the founding case study.
4. **PROMISES** *(symbolic)* — anchors grow an optional structured
   `promises:` field, machine-checkable claims mirroring the info card:
   `{kickOn:[3], skankOffbeat:"pad", bassStyle:"melodic", drumless:true, …}`.
   The card stops being marketing: "kick on beat three" is asserted against
   drum events. Vocabulary grows as cards make new kinds of claims; a card
   claim with no checkable promise is a WARN (write the promise or soften
   the card).
5. **SPECTRUM** *(acoustic)* — high-band (>10k) energy share ≤ ceiling
   (shriek), sub-band sanity per genre class, crest-factor floor (a wall of
   flat compression is a taste bug outside the crush family — exempt list).
6. **BALANCE** *(acoustic)* — role-relative stem levels inside windows
   (bass under lead by X..Y dB, hats under snare, pads under everything);
   windows per genre-family, measured from the genres Paul has blessed by
   ear, not invented.
7. **MOTION** *(symbolic, already partly gated)* — blend-arrival stays the
   law for transitions; within a track, the variation/interlock features
   already exist — musicality adds a boredom check (identical consecutive
   sections beyond the snare-law's reach = WARN).

## The machinery

- `engine/musicality.js` — the law library + `audit(state|genre, opts)`;
  UMD like every engine file; acoustic laws render via the press harness
  with per-voice solo/mute state surgery (the pattern the steel-guitar fix
  proved). Deterministic: same seed, same scorecard.
- `node engine/musicality.js audit <genre|all> [--seeds N] [--acoustic]` —
  scorecards: per-law scores, named failures, and a one-line verdict.
  `--rank` prints the catalog worst-first: the balance loop's worklist.
- **Gate posture: soft first.** validate-genres grows gate 8 (musicality,
  WARN-level) so the score exists in every verify run without blocking
  anything until the laws are tuned against ears. The graduation rule: a law
  goes HARD when its top-10 offender list and Paul's ear agree twice.
- **The balance loop** mirrors the matrix loop: audit → rank → fix worst
  anchors at the anchor (levels, registers, sends, bloom via form/sections)
  → re-audit → matrix must stay N/N (musicality fixes must never undo
  distinctness — the two verifiers hold each other).

## What this is not

- Not a beauty oracle. The laws encode *defect classes*, not preferences —
  "the steel guitar is audible" is falsifiable; "the steel guitar is
  moving" is Paul's.
- Not a second matrix fight. Musicality scores never feed the confusion
  matrix; TARGETS stay the distinctness referee.
- Not spectral A/B theater (verification-philosophy law): acoustic checks
  are coarse, named, and threshold-based — RMS floors and band shares, not
  perceptual models pretending to be ears.

## Rollout

1. Design (this doc) — the law taxonomy from the 2026-07-10 session.
2. Build `musicality.js` symbolic laws (BLOOM, REGISTER, PROMISES, MOTION)
   + CLI + gate 8 WARN. **DONE 2026-07-10** — status notes below.
3. Acoustic laws (AUDIBLE, SPECTRUM, BALANCE) on the stem-press harness.
4. Baseline audit over all 228 × 3 seeds; publish the ranked scorecard.
5. First balance loop: fix the worst ten (prelude's bloom first); re-audit;
   matrix held.
6. Promises vocabulary: seed ~20 flagship anchors (reggae's kick-on-three
   is promise #1), then grow with every card complaint.

## Status — phase 2 shipped (2026-07-10)

`engine/musicality.js` (symbolic laws + CLI) + `test/musicality.test.js`
(15 gates, green) + validate-genres **gate 8** (WARN-only, prints the 5
worst scorecards every verify run). `./verify.sh` green; matrix untouched.

- **Baseline** (228 × seeds 1-3, ~9s): 19 OK / 209 WARN / 0 FAIL. No
  never-sounds anywhere; all three seed promises hold; MOTION fires nowhere
  (the humanity jitters mean no two sections are byte-identical — it will
  only catch true verbatim-loop bugs, e.g. cached stems).
- **The worst-10 is systemic, not individual**: it is a wall of "drums
  first sounds at beat 62-64 (bound 32, form pop)" — the pop/drop FORM
  graphs themselves hold the kit out for ~2 sections on many draws
  (capesnap, velvetconveyor, ceilingfanchop, dialupgabber, industrialmetal,
  laundrycore, miamibass, runeromp, urchinmatinee, oakdublilt). First
  balance-loop question is therefore about the FORM intro chains (or the
  pop bound), not ten separate anchors. Prelude ranks 157/228 — its bloom
  finding is real (bass arrives at beat 128/256 on seeds 2/3, wave bound
  80) but milder than the founding complaint suggested, because its
  drumless-by-design parts are exempt by construction.
- **Reggae promise finding** (rollout §6, measured pre-write): kick-on-3
  does NOT deliver — 2-5% of kitted measures on seeds 1/3 (the "kick"/
  "halftime" kits put the kick on 1); only seed 2's four-on-floor covers
  beat 3, which isn't one-drop either. And the skank is NOT the pad (pads
  are downbeat chord sustains): it lives in the STAB layer, 100% on the
  off-eighths, all seeds. So the seed promises are reggae
  `{skankOffbeat:"stab"}` (verified), salondawdle `{meter:"3/4"}`,
  chalkvespers `{drumless:true}` — kickOn:[3] is a worklist item for the
  reggae anchor, not a promise to fail on.
- **Register catches the real defect class**: e.g. chalkvespers asks its
  ahh_choir for midi up to 107 against a natural ceiling of 87 (63% of
  lead notes out-of-window on seed 1) — the mapping layer's fold saves the
  ear but bends the contour; fix belongs at the anchor.
- Promises live in the `PROMISES` table inside musicality.js until the
  kernel anchors grow the `promises:` field (the kernel was another
  agent's file during this phase); `state.promises` overrides the table
  when it exists.
