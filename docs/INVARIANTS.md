# INVARIANTS — what the machine can PROVE about the kernel

*2026-07-10. Paul: "What can you do with the kernel using formal or
verifiable methods?" Answer: more than gates. The kernel's blend algebra has
a mathematical shape — convexity — and where a system has a shape, you can
prove things about ALL of its outputs, not just the ones you sampled.*

`engine/invariants.js` is the formal wing of the verification house. It sits
beside the confusion matrix (distinctness), the musicality laws (goodness),
and the determinism/meter/pipe gates (mechanics) — and does the one thing
none of them do: makes claims quantified over the **uncountable** space of
blend positions, weight vectors, and macro settings, with the quantifier
discharged by algebra instead of enumeration.

```bash
node engine/invariants.js prove            # quick: proof + reduced sweep (~30s)
node engine/invariants.js prove --full     # exhaustive state-level lattice (~2.5 min)
node test/invariants.test.js               # the gates (incl. falsifiability of the checkers)
```

## The theorem that makes it possible

Every scalar dimension a blend can emit is a **convex combination** of
anchor values. `resolveMulti` computes ranges three ways, and all three are
weighted means with Σw = 1:

- `wRange` (bpm, swing, humanize, adventure, color, complexity):
  `lo = Σ wᵢ·loᵢ, hi = Σ wᵢ·hiᵢ` — then ONE sample inside `[lo, hi]`.
- `blendRecipe` (every recipe scalar): the same weighted mean, renormalized
  over the parents that declare the key; a key NO parent declares falls to
  the engine default (`E.defaultInstruments()`), which the proof folds into
  the hull.
- `specRange` / `pushPull` / `transforms.rate`: same shape.

A convex combination of values from `[minᵢ loᵢ, maxᵢ hiᵢ]` cannot leave that
interval. So **min/max over the 274 anchors bounds every possible blend** —
at every point of the weight simplex, for every seed, for every path the
explorer can draw. That is a proof over the uncountable space; no sweep
could ever say it.

Pools don't lerp — they draw **members** (kits, progressions, patterns,
models, sources, patches, pipes). So pool dimensions are proven the other
honest way: **enumeration**. The union of all anchors' pools (plus every
substitution `constrain` can make — the jungle-snap, the arpup fallback, the
amen_170 break rescue, the auto-fill vocabulary) is checked member-by-member
against the engine's actual tables (`E.KITS`, `E.PROGRESSIONS`,
`E.BASS_PATTERNS`, `CsdPipes.REGISTRY`, `SAMPLERS`, `DX7_PATCHES`, …).

## Post-lerp transforms, accounted honestly

Three things happen to a value after the convex lerp. Each is folded in,
none is waved away:

1. **`constrain()` clamps and substitutes** — it can only STRENGTHEN a bound
   (adventure ≤ .75, complexity ≤ .4 above 165 bpm, kit snaps into an
   enumerated fast set…). The suite does not trust the source comment: it
   **extracts the live `constrain` from the kernel source text** (bracket
   matching, instantiated with its real free variables) and executes it on
   boundary inputs — 14 clamp facts proven on the actual function, plus
   idempotence (`constrain∘constrain = constrain`) over every sweep
   resolution. If the kernel edits constrain, the battery re-proves against
   the new one automatically.
2. **`applyMacros()` is the one path OUT of the hull** — a post-resolution
   slider transform. Every macro formula's declared range/clamp at the ±1
   extremes is transcribed into a second, macro-extended interval per
   dimension (the `macro` column). Where the macro's own clamp closes the
   bound, the row is CLOSED; where it pushes past SAFE but a **realization
   clamp** in `faust/state-engine.js` catches it, the row is CLAMPED with
   the clamp cited; where nothing closes it, the row is OPEN — a finding.
3. **Pool draws** are member sets — enumeration, above.

## The SAFE table

Every bound names its consumer — a SAFE bound without a source is a fudge.
Representative rows (the full ~105-row table prints from the CLI):

| dimension | proven hull (all blends) | macro-extended | SAFE | source of the bound | status |
|---|---|---|---|---|---|
| bpm | [40, 220] | [36, 238] | [40, 225] | **no hard consumer clamp exists** — spb=60/bpm only needs > 0; applyMacros energy scales ±8% UNCLAMPED | **OPEN** (finding) |
| swing | [0, .5] | [0, .6] | [0, .6] | applyMacros feel clamp(0,.6); drumEvents skip saturates at sw/.3 | CLOSED |
| fx.reverb | [.11, 1] | [.044, .99] | [0, 1] | state-engine rgain = clamp(rv×3.2, 0, 3.5) — 1.0 is legal full wash | CLOSED |
| fx.delayFb | [.08, .7] | [.052, .85] | [0, .85] | applyMacros space clamp; feedback < 1 = stability | CLOSED |
| fx.lowcut | [0, 220] | — | [0, 400] | state-engine tone lowcut = clamp(·, 10, 400) | CLOSED |
| bass.cutoff | [160, 1600] | [80, 3200] | [60, 6000] | NOTE_PARAMS bass_* DSP slider [60, 6000] | CLOSED |
| lead.cutoff | [1200, 5000] | [600, 10000] | [60, 18000] | NOTE_PARAMS lead union [60(modeld), 18000(supersaw)] | CLOSED |
| \*.level | ≤ 1.6 | — | (0, 2] | state-engine lvl=clamp(L,.001,1), gmul=max(1,L), gain=clamp(amp×gmul,0,2) — with sweep-proven amp ≤ 1 | CLOSED |
| \*.send | ≤ .92 | ≤ 1 | [0, 1] | applyMacros space clamp; realization clamp(send/lvl, 0, 6) | CLOSED |
| lead.voices | [1, 8] | [1, 7] | [1, 7] | state-engine clamp(voices,1,7) | **CLAMPED** (edm asks 8, renders 7) |
| pad.release | [.08, 4] | — | [.01, 3] | state-engine rel=clamp(·,.01,3) | **CLAMPED** (6 anchors ask 3.5–4) |
| theory.adventure | [0, .75] | — | [0, .75] | constrain min(.75,·) — proven on the live constrain | CLOSED |
| rhythm.complexity | [0, .8] | — | [0, 1] | buildEvents rcx clamp; constrain ≤ .4 above 165 bpm | CLOSED |
| found.stretch | [.35, 1.05] | — | [0, 2] | found-player syncgrain scan RATE (>1 legal — not a 0..1 blend) | CLOSED |
| rubato.depth | [.006, .06] | [0, .108] | [0, .2] | buildEvents min(.2,·) + applyMacros feel clamp | CLOSED |

Statuses mean exactly what they say:

- **CLOSED** — the macro-extended hull sits inside SAFE. Proven for all
  blends, all macros, all seeds.
- **CLAMPED** — an anchor (or macro) asks past SAFE; the cited realization
  clamp trims it. Safe, but the excess is a silently-dead ask — reported
  every run as a documented finding.
- **OPEN** — no hard bound closes the dimension. Exactly one exists (bpm),
  and it is a finding, not a fudge: the closure is the anchor table itself
  plus the unclamped ±8% energy macro.

## The catalog — seeded exhaustive sweeps

The proofs bound; the sweeps witness that the bounded machine also KEEPS its
behavioral promises. All seeded, zero `Math.random`, deterministic
byte-for-byte (gate 9 of the test).

1. **Totality** — `buildEvents` never throws and every event is well-formed
   (beats finite ≥ 0 and ≤ totalBeats+tail, durs > 0, pitched/drum amps
   ∈ (0, 1], found amps ≤ the PROVEN found-vol hull × 2.1 — the break-chop
   boost is a designed >1 excursion, see findings — pch parses and maps to
   finite midi, totalBeats === Σ cycles×cycleBeats + 8).
2. **Constrain idempotence** — `constrain(constrain(x)) === constrain(x)` on
   every resolution the sweep touches (the extracted live function).
3. **Duration solver** — total duration within ±10% of the 180s default
   target, with the solver's own documented outs verified structurally:
   cycle-coarse floored tracks (one harmonic cycle wider than the whole
   ±10% band — blues, prelude, mallsoft, the drone wing), NO_SECTION_DROP
   identity exemptions (witchhouse), video-locked forms (never targeted).
4. **Snare-law** — the no-three-peat promise re-verified from OUTSIDE: the
   law's own 1/16-quantized, accent-bucketed bar signature is recomputed
   over the final timeline and no snare/hat signature repeats 3× in a row.
5. **Pipes clash-freedom** — every `harmonize`-added note's pitch-class is
   in the sounding pad/bass pc-set at its beat (±0.12 beat strum slack), on
   real genre states; states where densityArc runs after harmonize are
   skipped and counted (the drop can orphan a justification post-hoc).
6. **Blend continuity** — along seeded anchor-pair paths, adjacent t-steps
   move every scalar by a bounded delta EXCEPT at declared flips: enum
   switches (kit/progression/model/meter/pipes — the audible events
   GENRE-SPACE promises), parent-pick structural dimensions (chordEvery
   8→16 at a crossover — harmonic rhythm never lerps, by design), and
   toState's gating thresholds (pump/crackle/comp/grit/jux < .05 → 0;
   highcut ≤ 1000 → 0), which are measured, real, designed discontinuities.
7. **Meter safety** — meter anchors tile: chordEvery ≡ 0 (mod 6), every
   pooled kit's cell divides the bar, and no orphan kick/snare/hat lands
   outside a kitted span (fill zones and thunk toms accounted — each
   allowance cites the engine behavior that earns it).

**Scale, honestly.** A build (state → events) costs ~12–17 ms, so building
all 249×248/2 pairs × 3 t-values × 2 seeds (~185k) would take ~42 minutes.
The full mode therefore runs the **entire 185k lattice at the state level**
— where the convexity proof lives, and where idempotence + hull membership
are checked on every single resolution (~0.5 ms each) — and samples the
event level: all 274 anchors × seeds 1–5 built in full, plus a seeded
4,000-combination pair-build subsample for the behavioral laws. Quick mode
shrinks both (274×2 anchors, 3,000 resolutions, 300 pair builds) to stay
under a minute. The split is printed in every run's report; it is a design
decision, not a hidden shortcut.

First full run (2026-07-10, 153s): 105 interval dimensions — 100 CLOSED,
4 CLAMPED, 1 OPEN, 0 violated; 23 pools — 21 CLOSED, 2 DEAD; all 155,268
lattice resolutions idempotent and inside the proven hulls; 1,140 anchor
builds + 4,000 pair builds total — snare-law clean, 49,048 harmonize notes
clash-free (17 densityArc-ordered states skipped and counted), durations
4,624 in-band / 183 cycle-coarse floored / 5 identity-exempt / 334
video-locked; 20 continuity paths, 14,277 comparisons, 214 declared flips,
zero hidden jumps.

## The epistemic ladder

Honesty about what each rung actually establishes:

1. **PROVEN — for all blends, all weights, all seeds, all macro settings.**
   The interval bounds (convexity + interval arithmetic over the anchor
   hulls, constrain clamps executed on the live function, macro ranges
   folded in) and the pool memberships (enumeration of every drawable
   member against the engine vocabulary). No sample can add anything here;
   no blend can escape.
2. **SWEPT — for every tested point, deterministically reproducible.**
   Totality, idempotence, the duration contract, the snare-law promise,
   harmonize clash-freedom, continuity, meter tiling. Exhaustive over all
   anchors × seeds and the full state-level pair lattice (--full); seeded
   samples at the event level. A sweep is evidence, not a proof — the gap
   between rungs 1 and 2 is exactly the gap between algebra and testing,
   and this file never blurs it.
3. **GATED ELSEWHERE — different machines own different laws.** The
   confusion matrix (genre-verifier: 274/274 diagonal dominance), the
   musicality laws (musicality.js: bloom/register/promises/motion), byte
   determinism + vocabulary + coverage (validate-genres), meter grids
   (meter.test), organ contracts (theory/pipes tests), and everything
   acoustic (the press gates, the headless-browser RMS probes). The
   invariants suite cites them rather than duplicating them.
4. **EARS — taste stays human.** Machines verify structure; Paul verifies
   whether it moves (the standing verification-philosophy law). Nothing on
   this ladder claims otherwise.

## Findings (the product)

What the proofs surfaced on first assembly — real, verified, reported by
every run:

- **bpm is consumer-unbounded (OPEN).** Nothing downstream clamps tempo;
  spb=60/bpm accepts anything positive, and the energy macro scales ±8%
  with no clamp. The actual closure is the anchor envelope [40, 220] —
  fine today, but a future anchor at bpm 300 would sail through every
  layer. If a hard rail is ever wanted, it belongs in constrain.
- **dubstep's granular stutter cloud can never fire.** The anchor declares
  `["granular", {...}]` in its lead insert pool; `resolveMulti.insertsFor`
  guards on `INSERT_DEFAULTS[t]` and silently drops unknown types — and
  INSERT_DEFAULTS has no granular entry, even though state-engine ships a
  working `insert_granular` module. Verified: 0 of 60 seeds ever resolve
  it. One INSERT_DEFAULTS entry away from real.
- **crimsoncourt's `ringmod` lead model is a silent fallback.** 16 of 60
  seeds draw it; `isModel` rejects it, so the synth path renders the
  default timbre instead of ring-mod clangor (state-engine knows ringmod
  only as an insert effect, not a pitched voice).
- **Clamped asks** (safe but dead range, trimmed at realization): edm asks
  8 lead voices, renders 7; six anchors (moonlagoon, chalkvespers,
  salondawdle, candlegauze, cloisterloom, miasmarow) ask pad release
  3.5–4s against the 3s cap; a few anchors declare attack 0.002–0.003
  under the 0.005 floor.
- **The continuity discontinuities are real and designed**: toState's
  gating thresholds (highcut ≤ 1000 → 0 etc.) make a blend crossing the
  gate jump — measured (cairntrot→butterchurnbounce at t=.35 jumps
  highcut 0→1007) — and chordEvery flips whole (reedrush→thermostatwave
  jumps 8→16 mid-path: harmonic rhythm is parent-picked, never lerped).
  Both classified as declared flips, documented here.
- **Found amps legally exceed 1.** The full 155k-lattice sweep caught
  glosspump×trenchsway@.5/s2 emitting a break chop at amp 1.022: buildEvents
  scales break-chop amps ×2.1 over the resolved found vol, so the honest
  ceiling is the PROVEN vol hull (≤ .6) × 2.1 = 1.26 — derived from the
  interval proof, not assumed. Pitched (max .24 measured) and drums (max
  .95 — the snare-law's own accent cap) keep the strict (0, 1] contract.

## What this is not

- Not a re-run of the matrix or musicality — those machines own their laws;
  this one cites them (rung 3).
- Not spectral A/B theater — nothing here renders audio or pretends to be
  an ear. Structure only.
- Not a mirror of the kernel — `constrain`, INSERT_DEFAULTS, STAB/HIT/
  TRANSFORM/SWING tables and the solver constants are extracted from the
  LIVE source at run time, so a kernel edit re-proves against the new code
  or surfaces as an explicit extraction finding. A mirror would drift
  silently; this cannot.
- Not wired into verify.sh — placement is Paul's call. The quick mode is
  sized for it (< 60s) if wanted.
