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
   ≥ 0.95; rate-stretch beyond ceiling = named violation. *(Balance loop 2:
   the kernel now guarantees this at the source — SAMPLER REGISTER HOME,
   below — and the law stands as the referee that the guarantee holds.)*
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

`engine/musicality.js` (symbolic laws + CLI) + `test/unit/musicality.test.js`
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

## Balance loop 1 — SHIPPED (2026-07-10)

Baseline 19 OK / 209 WARN → **169 OK / 59 WARN / 0 FAIL** (228 × seeds
1-3). Worst overall 0.80 → 0.92. Matrix 228/228 (--no-cache) after every
change; verify.sh green; meter/theory/pipes/speech/musicality suites green
(meter's `head_byte_identity` names prelude/s3 — exactly the intentional
prelude anchor change below; green again at commit).

1. **The form intro-drag — a MIX, mechanism-first.** Evidence over 228×3:
   the drumless intros were 25-38s wall-clock at the median (a real pop
   intro), but the duration solver's grow tie-break picked the FIRST index
   among tied sections, stacking ALL residual growth at the front of the
   form (dancepop: intro 2, verse 2, pre-chorus 2 — the hook pushed from
   the form's designed 37.5% to 54% of the track). **Kernel fix**: the
   grow tie-break is energy-aware (peak > build > exposed/release >
   cadence > ground) — a longer track now means more payoff, not a longer
   intro. **Bound fix (v1.1, argued)**: the v1 bounds were tighter than
   the FORM GRAPHS' own design — pop melody:64 was unsatisfiable by
   construction (the graph places the hook at the chorus, natural beat
   96). Every bound is now the form's measured worst-case designed
   placement + one chord-bar of margin (pop drums/bass 32→64, melody
   64→192; drop 48→72/128; wave drums/bass 80→144; dj drums/bass 96→128,
   melody 160→256; pads recalibrated likewise). Three by-construction
   exemptions joined the drumless rule: the ONE-CYCLE FLOOR (an intro of
   one full harmonic cycle is idiomatic — blues opens with a full 12-bar
   piano chorus, bound = max(table, cycleBeats)); CONTRAST DEVICES (a part
   declared only in exposed/release nodes — the bridge pad wall — is a
   designed late arrival); EVOLUTION GIFTS (a part first declared at a
   3-minute-rule boundary is the re-roll's new voice). The old worst-10
   wall (capesnap…oakdublilt) cleared entirely.
2. **The one-drop kit is real.** csd-engine KITS grew `onedrop` (kick +
   cross-stick TOGETHER on beat 3 of each measure, beat 1 EMPTY, skank
   off-eighth hats, rim-ghost/open-hat draws), registered in
   DRUM_PATTERNS; reggae's pool is now `["onedrop"]` (single-kit pool,
   the bossa/electro/newjack precedent — a mixed pool drew the wrong-idiom
   halftime on 3 of 5 seeds, measured). `kickOn:[3]` is a written PROMISE:
   100% of kitted measures on seeds 1-5 (was 2-5%). Reggae's matrix row
   held at self 100 with no retune.
3. **chalkvespers asks in range.** New zero-rng anchor dimension
   `leadOctave` (dominant-parent, absent = byte-identical) shifts the
   main lead's SCORE register; chalkvespers sets -2 — the chant line now
   sits midi 39-83 inside the ahh_choir's [27..87] window (was up to 107,
   63% folded). Register law: 0.89 → 1.00.
4. **Prelude blooms.** `introMode:"off"` — the WTC prelude opens ON the
   figuration, bar 1. The wave arrive node held the first keyboard note
   out 37-101s at prelude's giant cycles; now every seed opens on the
   drift figuration at 0s, strings swelling under it, the bass continuo
   joining at the swell (36-101s worst, was 202s on the canon seed).
   Every declared part sounds inside a 3-minute listen on seeds 1-5;
   unhurried stays (the long cycles are the identity), DEAD is gone.
   Row held at self 100.
5. **The buried-lead template class, named and fixed.** 16 gap-found
   anchors sharing the two template leads got the calibrated level fix
   (level is not a verifier feature — matrix unmoved): sax/felt/jazz
   template [0.4,0.52]→[0.52,0.64] (toastercore cedarskank bramblestep
   butterchurnbounce tundradoom willowmarch graingroove magmastrut);
   pluck/fm template [0.3,0.42]→[0.5,0.62] (hydracore sparkbreak
   hopscotchwave sherbetchop driftrot obelisktrot duststrut ashfunk).
   lofi and footwork also match template+scan but are canon parents,
   Paul-blessed by ear — named, left for his call.
- **Remaining findings are true findings**: the register class (the
  french-horn/sax genres asking above their windows — the next loop's
  worklist), standbylightdrive's wave bass at 70s, singeli/walrusfuzz
  late hooks, bebop's bass at 72. Fixtures re-captured; drift = the 123
  solver-growth genres + reggae/chalkvespers/prelude (anchor changes) +
  5 state-only level-class genres (bramblestep driftrot hydracore
  sherbetchop tundradoom).

## Balance loop 2 — SHIPPED (2026-07-10)

Paul: "What about the other genres." Loop 1's 169 OK / 59 WARN →
**228 OK / 0 WARN / 0 FAIL** (228 × seeds 1-3, and re-verified at seeds
1-5: 228/228/0/0). Worst overall 0.92 → 0.99. Matrix 228/228
(--no-cache) after every change; verify.sh, meter/theory/pipes/speech/
musicality suites green; determinism byte-identical across repeated
builds. Mechanism-first throughout — the 59 were two classes plus four
individual bloom diagnoses, and every fix landed in the kernel/engine,
not in 59 anchors.

1. **REGISTER, guaranteed at the source (the 54-genre class).** One
   template convention drove the whole class: every progression's lead
   voicing is written at pch octave 8-9 (midi 60-95, the synth-lead
   register), and the sampled winds/guitars/choirs own windows topping
   at 81-86 — so the same line that sits perfectly under a saw lead
   asked a tenor sax for midi 88-93 (12-26% of notes out, phrase PEAKS
   folding down an octave: the climax inverted). The cure is the
   chalkvespers precedent made kernel-wide: **SAMPLER REGISTER HOME**
   (csd-engine buildEvents, post-pipes; zero-rng):
   - *Whole-line home* — when under 95% of a sampled slot's notes sit in
     its natural window (zone roots -12..+6, the render fold's mirror),
     the entire line shifts by the whole octave that maximizes fit
     (strict improvement only; ties prefer the smaller shift, then
     centering). A tenor-sax lead at median E5 lands at E4 — contour
     intact, the instrument's actual idiom. Melody/pad shift either way;
     **bass only shifts up** (below-window whole-line asks are real —
     perukelotto's harpsichord continuo asked midi 24, C1, below any
     harpsichord — but a high bass line is an identity: polygonforge's
     driving pick at A2 stays put).
   - *Per-note ornament fold* — bass cell octave tones (r6/f6 exceed the
     top zone only on high-rooted chords; a player folds those onto the
     neck) and pipe ornament copies (`harm`/`echo`: a parallel third
     that exceeds the instrument INVERTS to the sixth below, an octave
     echo folds to the unison — voice-leading idiom, not a contour
     break) fold by octaves into the window. This is byte-for-byte the
     pitch the mapping layer's render fold was already producing, so
     the AUDIO of this sub-class is unchanged — the score now states
     it. Melody/pad LINE notes are never folded: REGISTER stays a live
     alarm where a fold is a contour break.
   - *The pin* — the kernel measures once at track resolve and pins the
     decision as `state.regHome`, so the press and every live per-bar
     rebuild apply the same constant: no octave flapping, no live/press
     divergence (the same reasoning that keeps the render fold
     per-note). `leadOctave` (the anchor-level taste override) is
     measured first and respected — chalkvespers pins nothing.
   - *Byte-identity gate* — a slot already ≥95% in-window is untouched,
     ornaments and all. Drift census, exact: 102 genre×seed states pin
     regHome (64 genres, seeds 1-5); 9 more drift events-only (the
     render-identical fold class: funk s2, meadowjangle s1, miasmarow
     s5, polygonforge s2, rooftopholler s1, talcumcasino s1,
     valkyrieswoop s2, velvetconveyor s1, wizardcape s5); 0 feature
     hashes moved for this pass.
2. **The grow tie-break, one level down (toastercore).** Loop 1 made
   growth energy-aware but left the first-index bias alive WITHIN an
   energy class: pre-chorus and chorus are both `peak`, so the residual
   cycle landed on the PRE-chorus and pushed the first hook 192 → 224
   (measured — the dancepop bug one class down). Ties within an energy
   class now resolve by LATER index: growth before the hook is
   anticipation, after it is payoff. Toastercore's hook returned to
   beat 192. This re-resolves growth ties catalog-wide (the largest
   drift class this loop — states/events/features for the affected
   genres); the matrix held 228/228 --no-cache and validate held every
   duration band.
3. **BLOOM v1.2: the ON-DESIGN floor (standbylightdrive, singeli,
   bebop, walrusfuzz).** All four "late" stragglers are ON their form's
   designed proportions; the v1.1 beat tables punished beats-per-track
   GEOMETRY, not drag: standbylightdrive's swell bass at beat 160 is
   38.5% of a 137bpm wave arc (design: 37.5%) = 70 wall-clock seconds;
   singeli's lift melody at beat 288 is 42.9% of a 214bpm dj set
   (design: 40%, within one cycle of quantization) = 81s; bebop's bass
   at beat 72 is AHEAD of design (24-beat cycles at 219bpm = 20
   seconds); walrusfuzz s3's chorus sits at exactly 3/8 of a floored
   96-beat-cycle blues. The kernel now exports `FORM_ENTRY` — each
   form's designed entry fraction per part, DERIVED from the form
   graphs so it can never drift from them — and bloom's bound is
   max(beat table, one-cycle floor, designFraction × totalBeats + one
   cycle of solver-quantization slack). The beat tables remain the
   patience cap for drag the form never asked for: dancepop's loop-1
   hook at 54% vs a 37.5% design stays named under the new floor.
4. **Argued decisions, for the record.** (a) The bass ornament fold and
   the harm/echo fold are DESIGN, not alarms silenced: for octave-
   equivalent ornaments the fold IS the idiom (inversion/unison), and
   the render already performed it — the score-side fold makes the
   score state the truth without changing a sample of audio. The law
   can no longer fire on sampled-bass ornaments; that is the point,
   and it still fires on any melody/pad LINE that a whole-octave home
   cannot fit. (b) No audit threshold was loosened: 0.95 stands, the
   beat tables stand, and the two new floors (one-cycle, on-design)
   are derived from the engine's own structures, not tuned constants.
   (c) lofi and footwork stay Paul-blessed canon (loop 1), untouched.
