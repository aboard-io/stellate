#!/usr/bin/env node
// invariants.test.js — gates for the FORMAL VERIFICATION suite
// (engine/invariants.js; the epistemic ladder is docs/INVARIANTS.md).
//   node test/invariants.test.js
//
// Gates, in order:
//   1  proof_closes         proveBlendBounds: every interval row CLOSED,
//                           CLAMPED (cited consumer clamp) or OPEN
//                           (documented) — zero VIOLATED; row count sane
//   2  proof_is_convex      the convexity lemma witnessed beyond pairs:
//                           seeded N-way weight vectors (3-6 anchors) resolve
//                           every scalar INSIDE the proven hulls
//   3  pools_enumerated     every pool row CLOSED or DEAD (dead declarations
//                           are documented findings) — zero VIOLATED
//   4  constrain_battery    the LIVE extracted constrain holds every clamp
//                           on boundary inputs
//   5  constrain_idempotent constrain∘constrain = constrain over seeded
//                           multi-way resolutions (the fixed-point law)
//   6  checkers_falsifiable each sweep checker FIRES on a synthetic
//                           violation (a checker that cannot fail proves
//                           nothing)
//   7  quick_sweep_green    the full quick-mode sweep: totality, snare-law,
//                           harmonize clash-freedom, duration contract,
//                           meter tiling — zero hard failures
//   8  continuity           seeded blend paths: scalars move by bounded
//                           deltas between adjacent t-steps except at
//                           declared enum/gate flips
//   9  suite_deterministic  the suite's own outputs are byte-identical
//                           across runs (no Math.random anywhere)
"use strict";
const E = require("../engine/csd-engine.js");
const K = require("../engine/genre-kernel.js");
const I = require("../engine/invariants.js");

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};
const J = JSON.stringify;
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// ---- 1: the interval proof closes ----
const proof = I.proveBlendBounds();
{
  const violated = proof.rows.filter(r => r.status === "VIOLATED");
  gate("proof_closes", violated.length === 0 && proof.rows.length >= 80,
    `${proof.rows.length} dimensions: ${proof.rows.filter(r=>r.status==="CLOSED").length} CLOSED, ` +
    `${proof.rows.filter(r=>r.status==="CLAMPED").length} CLAMPED, ${proof.rows.filter(r=>r.status==="OPEN").length} OPEN, ${violated.length} VIOLATED` +
    (violated.length ? " → " + violated.map(r=>r.dim).join(",") : ""));
  // every row cites a source — a bound without a source is a fudge
  gate("proof_sources_cited", proof.rows.every(r => r.src && r.src.length > 10), "every SAFE bound names its consumer");
}

// ---- 2: convexity witnessed beyond pairs (N-way weight vectors) ----
{
  const names = Object.keys(K.GENRES);
  const membership = I._checks.mkMembership(proof);
  const rng = mulberry32(424242);
  const out = [];
  for (let k = 0; k < 120; k++) {
    const n = 3 + Math.floor(rng() * 4);   // 3..6-way blends
    const ws = [];
    for (let i = 0; i < n; i++) ws.push({ g: names[Math.floor(rng() * names.length)], w: 0.05 + rng() });
    const c = K.resolveMulti(ws, 1 + k);
    membership(c, "nway#" + k, out);
  }
  gate("proof_is_convex", out.length === 0, out.length ? out.slice(0, 3).join("; ") : "120 seeded 3-6-way blends: every scalar inside the proven hull");
}

// ---- 3: pools enumerate ----
{
  const pools = I.provePools();
  const violated = pools.rows.filter(r => r.status === "VIOLATED");
  const dead = pools.rows.filter(r => r.status === "DEAD");
  gate("pools_enumerated", violated.length === 0,
    `${pools.rows.length} pools: ${pools.rows.length - violated.length - dead.length} CLOSED, ${dead.length} DEAD (documented findings)` +
    (violated.length ? " → VIOLATED: " + violated.map(r=>r.pool).join(",") : ""));
}

// ---- 4: the live constrain battery ----
{
  const b = I.proveConstrain();
  gate("constrain_battery", b.ok && b.results.length >= 12,
    `${b.results.filter(r=>r.ok).length}/${b.results.length} boundary clamps hold on the EXTRACTED live constrain`);
}

// ---- 5: constrain idempotence (the fixed-point law) ----
{
  const names = Object.keys(K.GENRES);
  const rng = mulberry32(777);
  const out = [];
  for (let k = 0; k < 200; k++) {
    const a = names[Math.floor(rng() * names.length)], b = names[Math.floor(rng() * names.length)];
    const c = K.resolveMulti([{ g: a, w: 0.5 + rng() * 0.5 }, { g: b, w: 0.5 + rng() * 0.5 }], k + 1);
    I._checks.checkIdempotent(c, a + "×" + b + "/s" + (k + 1), out);
  }
  gate("constrain_idempotent", out.length === 0, out.length ? out[0] : "constrain(constrain(x)) === constrain(x) over 200 seeded resolutions");
}

// ---- 6: the checkers themselves are falsifiable ----
{
  const C = I._checks;
  const st = K.track("techno", { seed: 1 });
  const ev = E.buildEvents(st);
  // 6a: checkEvents fires on a poisoned amp
  let out = [];
  const evBad = { ...ev, drums: [...ev.drums.slice(1), { ...ev.drums[0], amp: 1.7 }] };
  C.checkEvents(st, evBad, "synthetic", out);
  const a = out.length > 0;
  // 6b: snare-law checker fires on a hand-built three-peat
  out = [];
  const cyc = E.getProgression(st.progression).chords.length * Math.max(2, Math.round(st.chordEvery || 8));
  const stSyn = { ...st, sections: [{ cycles: Math.ceil(32 / cyc) || 1 }] };
  const drums3 = [];
  for (let bar = 0; bar < 4; bar++) for (const o of [2, 6]) drums3.push({ drum: "snare", beat: bar * 8 + o, dur: 0.3, amp: 0.5 });
  C.checkSnareLaw(stSyn, { drums: drums3 }, "synthetic", out);
  const b = out.length > 0;
  // 6c: harmonize checker fires on a fabricated clash (harm pc outside the sounding set)
  out = [];
  const stH = { ...st, pipes: [{ id: "harmonize", prob: 0.5 }] };
  const evH = { pitched: [
    { voice: "pad", beat: 0, dur: 8, pch: "8.00", amp: 0.5 },                 // sounding pc 0
    { voice: "melody", beat: 1, dur: 1, pch: "9.01", amp: 0.4, harm: 1 },     // harm pc 1 — a clash
  ] };
  C.checkHarmonize(stH, evH, "synthetic", out, { harmChecked: 0, harmSkipped: 0 });
  const c = out.length > 0;
  // 6d: duration checker fires on an absurd length
  out = [];
  const stD = JSON.parse(J(st));
  stD.sections = [{ cycles: 100 }];
  C.checkDuration(stD, "synthetic", out, { durInBand: 0, durFloored: 0, durExempt: 0, durIdentity: 0, durFlooredList: [] });
  const d = out.length > 0;
  gate("checkers_falsifiable", a && b && c && d,
    `events:${a ? "fires" : "BLIND"} snare-law:${b ? "fires" : "BLIND"} harmonize:${c ? "fires" : "BLIND"} duration:${d ? "fires" : "BLIND"}`);
}

// ---- 7: the quick sweep (totality + laws over the real catalog) ----
{
  const sw = I.sweep({ proof });
  gate("quick_sweep_green", sw.failures.length === 0,
    `${sw.stats.anchorsBuilt} anchor builds + ${sw.stats.resolutions} pair resolutions + ${sw.stats.pairBuilds} pair builds in ${(sw.stats.ms/1000).toFixed(1)}s; ` +
    `${sw.stats.harmChecked} harm notes clash-free; snare-law clean` +
    (sw.failures.length ? " → " + sw.failures.slice(0, 3).join("; ") : ""));
  gate("duration_contract", sw.stats.durInBand > 0 && sw.stats.durInBand + sw.stats.durFloored + sw.stats.durIdentity + sw.stats.durExempt >= sw.stats.anchorsBuilt,
    `${sw.stats.durInBand} in ±10% band, ${sw.stats.durFloored} cycle-coarse floored, ${sw.stats.durIdentity} identity-exempt, ${sw.stats.durExempt} video-locked`);
}

// ---- 8: blend continuity ----
{
  const cont = I.checkContinuity(3, 2026);
  gate("continuity", cont.ok && cont.comparisons > 500,
    `${cont.paths.join(" ")} — ${cont.comparisons} comparisons, ${cont.flips} declared flips, ${cont.failures.length} jumps` +
    (cont.failures.length ? " → " + cont.failures[0] : ""));
}

// ---- 9: the suite is deterministic ----
{
  const r1 = I.checkContinuity(2, 99), r2 = I.checkContinuity(2, 99);
  const c1 = K.resolveMulti([{ g: "jungle", w: 0.6 }, { g: "vaporwave", w: 0.4 }], 5);
  const c2 = K.resolveMulti([{ g: "jungle", w: 0.6 }, { g: "vaporwave", w: 0.4 }], 5);
  gate("suite_deterministic", J(r1) === J(r2) && J(c1) === J(c2), "continuity runs + resolutions byte-identical (zero Math.random)");
}

console.log(fails ? `FAIL: ${fails} invariants gate(s) failed` : "PASS: all invariants gates green");
process.exit(fails ? 1 : 0);
