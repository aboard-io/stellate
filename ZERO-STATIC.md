# ZERO-STATIC — the staged path to a glitch-free live engine

2026-07-06. Paul: "there are still glitches at times that are clearly just
rendering problems… I'm ready to compromise here, but we can't have static."
This plan came out of a 12-agent ultracode round (5 readers → 3 competing
designs → 3-judge adversarial panel → synthesis). Winner: staged hybrid —
fix confirmed bugs first, instrument everything, and hold the 16-bar cache
in reserve as a gated structural stage rather than building the tape
machine before attribution.

## Direct answers to the prompting questions

- **"Too many effects?" No.** There is exactly ONE fx worklet (`fx_bus`)
  carrying rev/del/pp/master color, at most one external reverb-color node,
  opt-in multiband. Effects are not the cost.
- **"Couple master buses in a single chain?" Already true.** voices → send
  gains → layer collectors → 4 buses → 6-ch merger → fx_bus → master. The
  fan-in is native GainNodes (~free). Bus consolidation buys nothing.
- **"Cache 16 bars?" Yes — as a rolling per-bar STEM pipeline (Stage 3),**
  where 16 bars is pipeline depth, not a monolithic chunk — and only if
  Stages 0–2 don't already reach zero.

## Diagnosis — ranked glitch causes

- **R1 (CONFIRMED, fixed in Stage 0.A):** zombie worklets. `retire()` and
  the insert type-change teardown disconnected retired reverb-color /
  master_mb / insert-chain worklets **without `destroy()`** — by the
  physics this repo itself documented (live.js retirePool comment, commit
  8b8cb00), a disconnected Faust worklet computes every block forever,
  invisible to `countWorklets()`. Every color swap during travel leaked
  ~2–2.5 cost units; every insert swap ~1.5. Best single explanation for
  "glitches that build with travel."
- **R2:** worklet instantiation inside the render window (genre entry
  bursts 3–6 mkNodes; measured load blips in-repo).
- **R3:** unbounded `setTargetAtTime` curves on Faust a-rate params
  (retune/applyFx/setInsertParams/bleed) — the dx7 incident class: a curve
  that never formally ends keeps the param-automation path hot forever.
- **R4:** eco storm — a level change retunes the whole fleet at once,
  exactly when the thread is already underwater; plus eco's ~2s hysteresis
  leaves sub-2s spikes unanswered.
- **R5:** discrete transition clicks (module-change retire cuts a ringing
  pool via gate, not an amplitude fade).
- **R6:** granular-bed node churn (~28 src+gain pairs/sec/bed +
  setValueCurveAtTime each — found-player.js).
- **R7:** irreducible steady-state compute on heavy genres (dx7 ≈ 6.4 cost
  units vs ~1 for organ; cap-8 counts nodes, not cost). If R1–R6 don't
  reach zero, this is the residue — and what Stage 3 removes structurally.
- **R8 (mobile only):** mediaEl resample drift on the msDest path.

## Stages and gates

Gates are enforced in `faust/soak-travel-run.js` (nonzero exit), not by
intention. Symbolic suites (`engine.test.js`, `validate-genres.js --quick`,
genre-verifier matrix) run at every stage; Stages 0–2 never touch
state-engine/kernel/press, so they pass by construction — run them anyway.

- **Stage 0 — instruments + confirmed-bug fixes.**
  0.A the two destroy fixes (retire() + insert type-change). 0.B permanent
  output-truth sensors behind `opts.debugSentinel`: click-sentinel worklet
  (clicks / dropout-gaps / peak per second, tapped off master),
  AudioRenderCapacity underruns, always-on zombie registry
  (`workletTruth()`: alive must equal counted), event journal ring buffer,
  `outputRoute` telemetry in the ⬡ tooltip. 0.C soak harness: sentinel +
  renderCapacity capture, journal dump, ±2.5s click→mechanism attribution
  histogram, CPU-throttle flag, `--gate`.
  **GATE 0:** attribution histogram from a 4h travel soak (±×4 throttle),
  before/after 0.A. Prediction: pre-fix `alive − counted` grows by 1 per
  color swap; post-fix identical always.
- **Stage 1 — render-window hygiene.** 1.1 declick module-change retire
  (native-gain raised-cosine 30ms, then gate, keep deferred destroy);
  1.2 `glide()` terminator — every `setTargetAtTime` on a Faust worklet
  param gets a `setValueAtTime(v, t+10τ)` chaser so the curve formally ends
  (native GainNode params exempt — cheap, not the hazard); 1.3 de-storm eco
  (retune ≤2 pools/bar round-robin); 1.4 sub-2s spike guard (single bad
  250ms sample → pause instantiation queue + crackle 0); 1.5 instantiation
  airlock (mkNode promise-queue: 1 concurrent, ≥150ms spacing, 250ms under
  load); 1.6 `handle.prepare(state)` wired to explorer retarget — pools
  exist 1–2 bars before the glide delivers the state (improves feel);
  1.7 mobile-only gapless media-element recycle.
  **GATE 1:** 4h soak + 29-station tour, unthrottled AND ×4: sentinel 0,
  underruns 0, alive === counted throughout. **Pass → STOP.**
- **Stage 2 — steady-state cost reclamation.** Slow tier-2 prewarm; insert
  chains sleep with their pools; cost-weighted awake ceiling (`awakeCost()`
  from a measured 92-genre table — prefer declicked voice-steal over waking
  another heavy voice); granular bed consolidated to ONE looping
  AudioBuffer synthesized off-thread via the mixPCM twin (keyed +
  crossfaded on state change, old scheduler kept behind a flag).
  **GATE 2:** tour on ×4: zero clicks in transition windows, worst-genre
  load min ≥ 0.97. **Pass → STOP.**
- **Stage 3 — rolling stem pre-render (the 16-bar cache, partial form).**
  Only if Gate 2 fails; entry-gated on a ~150-line worker-throughput
  prototype (≥2× realtime dev, ≥1.3× under ×4 throttle, <400MB). CACHED =
  units with module COST ≥ 2.0 + their insert chains, rendered in a module
  Worker (faustwasm offline processors — pure compute, no AudioContext) as
  per-layer × per-bus sparse stems, scheduled as AudioBufferSourceNodes
  into the existing layer collector gains; bass/drums/stabs/sfx/found stay
  live; fx_bus/applyFx/sidechain/mixer/onBar cadence untouched. One state
  snapshot per bar feeds both classes (chord-bar windowing via
  `state.chordEvery`, fixing the ×8 hardcodes). Deadline-miss ladder:
  VAMP previous bar (repetition, never noise) → asleep skeleton-pool
  worklet fallback → worker fast-forward with skip-and-reset at a section
  boundary so one miss never cascades. Prerequisite PR: extract press.js's
  render loop into `faust/render-core.js` with a HARD byte-parity gate
  (old vs new press WAVs identical for 3 states). `?stems=0` is total
  rollback. LOOKAHEAD 6s → ~10s (the approved responsiveness compromise).
  **GATE 3:** 8h journey soak ×4: zero clicks/underruns, fallback <0.1%
  and every fallback clean; then a week of Paul listening before
  default-on.
- **Stage 4 — full chunk renderer.** Insurance; designed only if Gate 3
  shows fx_bus itself glitching. Expected never to ship.

## Status

- [x] Stage 0.A — destroy fixes landed (retire() 700ms + destroy; insert
      type-change teardown destroys the outgoing chain)
- [x] Stage 0.B/0.C — instruments + attribution harness landed. Notes from
      the smoke soak (2min tour): Chrome 147 has no `renderCapacity` —
      underruns come from the `ctx.playbackStats` fallback (gate is
      API-agnostic). The gate's zombie condition is 2-consecutive-10s-sample
      mismatch (single-sample skew is legitimate deferred-destroy churn;
      final truth converged created 40 / destroyed 30 / alive 10 ===
      counted 10). The naive click threshold (Δ>0.5) false-positives on
      square program (~1400 "clicks"/2min on 303/break stations) →
      adaptive threshold ships with Stage 1.
- [ ] Stage 1 — hygiene items 1.1–1.7
- [ ] GATE 0/1 soak readouts
- [ ] Stage 2 (only if Gate 1 fails at steady state)
- [ ] Stage 3 stem cache (only if Gate 2 fails; prototype-gated)
