#!/usr/bin/env node
// faust/probe-autotune.js — fx wings STAGE 2 gate: AUTO-TUNE of found vocals.
//
// Verifies the unified deterministic clip-snap (found-player.js): a found voice
// clip's median pitch is detected offline (autocorrelation) and the playbackRate
// is bent so the heard median lands on the nearest scale tone, scaled by
// state.autoTune. Same math in press (mixPCM) and live (FoundLive).
//
//   Part A (synthetic): a clean off-scale sine, rendered as a chop through mixPCM
//     at strength 0 vs 1 — the RENDERED pitch histogram snaps toward a scale tone
//     at 1 and is unchanged at 0. Also: determinism + the strength-0 bit-identity.
//   Part B (real hogcore): decode the actual Harry-Potter name clips, render the
//     real found chops at strength 0 vs the wired 0.7, and report the cents-to-
//     nearest-scale-tone distribution BEFORE/AFTER — the hyperpop coherence.
//
//   node faust/probe-autotune.js
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const E = require(path.join(ROOT, "engine", "csd-engine.js"));
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));
const SE = require(path.join(__dirname, "..", "engine", "faust", "state-engine.js"));
const FP = require(path.join(__dirname, "..", "engine", "faust", "found-player.js"));

const SR = 44100;
let fail = 0;
const ok = (c, msg) => { console.log((c ? "  ok  " : "  FAIL") + " " + msg); if (!c) fail++; };

// signed cents from hz to the nearest scale pitch-class (any octave), −600..+600
function centsToScale(hz, pcs) {
  if (!(hz > 0)) return null;
  const midi = 69 + 12 * Math.log2(hz / 440), pc = ((midi % 12) + 12) % 12;
  let bestD = 12;
  for (const t of pcs) { let d = (((t - pc) % 12) + 12) % 12; if (d > 6) d -= 12; if (Math.abs(d) < Math.abs(bestD)) bestD = d; }
  return bestD * 100;
}
// render one found CHOP event through mixPCM into a fresh mono buffer
function renderChop(src, pitch, durSec, autoTune) {
  const n = Math.floor(durSec * SR);
  const into = { dry: new Float32Array(n), rev: new Float32Array(n), del: new Float32Array(n), pp: new Float32Array(n) };
  const ev = { type: "chop", srcId: "s", tSec: 0, durSec, amp: 0.8, pitch, offset: 0, cutoff: 12000,
    rsend: 0, dsend: 0, ppsend: 0, fade: 0, sqRate: 0, sqDepth: 0, ...(autoTune ? { autoTune } : {}) };
  FP.mixPCM([ev], { s: src }, SR, into);
  return into.dry;
}
const stats = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.reduce((p, c) => p + c, 0) / s.length; return { mean: m, median: s[s.length >> 1], max: s[s.length - 1] }; };

// ===================================================================== Part A
console.log("Part A — synthetic mechanism (rendered pitch histogram):");
// C-major scale pitch classes; a clean sine deliberately OFF a scale tone.
const PCS = [0, 2, 4, 5, 7, 9, 11];
const FSRC = 233.08 * Math.pow(2, 38 / 1200);   // Bb3-ish, +38 cents: lands between scale tones
const SLEN = SR * 3, src = new Float32Array(SLEN);
for (let i = 0; i < SLEN; i++) src[i] = 0.7 * Math.sin(2 * Math.PI * FSRC * i / SR);
const detected = FP.detectMedianHz(src, SR);
console.log(`  source F0 = ${FSRC.toFixed(2)} Hz; detected median = ${detected.toFixed(2)} Hz (err ${(1200 * Math.log2(detected / FSRC)).toFixed(1)}¢)`);
ok(Math.abs(1200 * Math.log2(detected / FSRC)) < 15, "autocorrelation recovers the source F0 within 15¢");

const at0 = { strength: 0, pcs: PCS }, at1 = { strength: 1, pcs: PCS };
const out0 = renderChop(src, 1.0, 1.6, at0), out1 = renderChop(src, 1.0, 1.6, at1);
const p0 = FP.detectMedianHz(out0, SR), p1 = FP.detectMedianHz(out1, SR);
const c0 = centsToScale(p0, PCS), c1 = centsToScale(p1, PCS);
console.log(`  rendered pitch:  strength0 = ${p0.toFixed(2)} Hz (${c0.toFixed(1)}¢ to scale)   strength1 = ${p1.toFixed(2)} Hz (${c1.toFixed(1)}¢ to scale)`);
ok(Math.abs(c0) > 25, "strength 0 leaves the clip off-scale (unchanged)");
ok(Math.abs(c1) < 8, "strength 1 snaps the rendered clip onto a scale tone (<8¢)");
ok(Math.abs(c1) < Math.abs(c0) * 0.4, "strength 1 is far closer to scale than strength 0");

// strength-0 bit identity vs a no-autoTune render (the untouched-genre guarantee)
const outNone = renderChop(src, 1.0, 1.6, null);
let same = out0.length === outNone.length; for (let i = 0; same && i < out0.length; i++) if (out0[i] !== outNone[i]) same = false;
ok(same, "strength 0 render is BIT-IDENTICAL to a no-autoTune render (2^0 = 1)");
// determinism
const d1 = renderChop(src, 1.0, 1.6, at1), d2 = renderChop(src, 1.0, 1.6, at1);
let det = true; for (let i = 0; i < d1.length; i++) if (d1[i] !== d2[i]) { det = false; break; }
ok(det, "two strength-1 renders are byte-identical (deterministic)");

// ===================================================================== Part B
console.log("\nPart B — real hogcore coherence (the wired 0.7 vs 0):");
function ffdecode(file) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-t", "8", "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  const x = new Float32Array(raw.length >> 2); x.set(new Float32Array(raw.buffer, raw.byteOffset, x.length)); return x;
}
const st = K.track("hogcore", { seed: 3 });
const at = SE.autoTune(E, st);
console.log(`  hogcore key pcs = [${at.pcs.slice().sort((a, b) => a - b)}], strength = ${at.strength}`);
const ev = E.buildEvents(st);
const pathOf = {}; for (const s of st.foundSources) pathOf[s.id] = s.samplePath ? path.join(ROOT, s.samplePath) : (s.fsPath ? path.join(ROOT, s.fsPath) : path.join(ROOT, "found", s.id + ".mp3"));
const srcOf = {}; for (const s of Object.values(ev.srcById)) srcOf[s.tableNum] = s;
const buffers = {};
const chops = ev.found.filter(f => f.chop).map(f => ({ src: srcOf[f.tableNum], pitch: f.pitch, dur: Math.max(0.4, Math.min(1.6, f.dur * 60 / st.bpm)) })).filter(f => f.src);
// unique (source,pitch) samples, capped for speed
const seen = new Set(), sample = [];
for (const c of chops) { const k = c.src.id + ":" + c.pitch.toFixed(3); if (seen.has(k)) continue; seen.add(k); sample.push(c); if (sample.length >= 40) break; }
// The rendered clip is the raw buffer resampled at the (auto-tuned) rate, so its
// MEDIAN pitch is exactly rawMedian·rate — measure the heard median the engine
// actually controls (deterministic; no re-detection noise). A re-detected spot
// check on one clip confirms the rendered audio agrees.
const before = [], after = [];
for (const c of sample) {
  const p = pathOf[c.src.id]; if (!p || !fs.existsSync(p)) continue;
  if (!buffers[c.src.id]) { try { buffers[c.src.id] = ffdecode(p); } catch (e) { continue; } }
  const raw = buffers[c.src.id];
  const rawMed = FP.detectMedianHz(raw, SR);
  if (!(rawMed > 0)) continue;
  const rate1 = FP.autoTuneRate(c.pitch, rawMed, at.pcs, at.strength);
  const cc0 = centsToScale(rawMed * c.pitch, at.pcs);       // before: raw played at the event rate
  const cc1 = centsToScale(rawMed * rate1, at.pcs);         // after:  auto-tuned rate
  if (cc0 == null || cc1 == null) continue;
  before.push(Math.abs(cc0)); after.push(Math.abs(cc1));
}
const sb = stats(before), sa = stats(after);
console.log(`  n=${before.length} voice clips (heard-median cents-to-nearest-scale-tone)`);
console.log(`  |cents to scale| BEFORE (0):    mean ${sb.mean.toFixed(1)}  median ${sb.median.toFixed(1)}  max ${sb.max.toFixed(1)}`);
console.log(`  |cents to scale| AFTER  (0.7):  mean ${sa.mean.toFixed(1)}  median ${sa.median.toFixed(1)}  max ${sa.max.toFixed(1)}`);
// rendered-audio spot check on the worst-before clip: re-detect the actual output
let worst = null, worstC = -1;
for (const c of sample) { const raw = buffers[c.src.id]; if (!raw) continue; const rm = FP.detectMedianHz(raw, SR); const cc = Math.abs(centsToScale(rm * c.pitch, at.pcs) || 0); if (cc > worstC) { worstC = cc; worst = c; } }
if (worst) {
  const b1 = renderChop(buffers[worst.src.id], worst.pitch, Math.max(1.0, worst.dur), { strength: at.strength, pcs: at.pcs });
  const q1 = FP.detectMedianHz(b1, SR), rc = Math.abs(centsToScale(q1, at.pcs) || 0);
  console.log(`  rendered spot-check (${worst.src.id}): before ${worstC.toFixed(1)}¢ -> rendered+re-detected ${rc.toFixed(1)}¢`);
}
ok(before.length >= 4, "decoded and measured a set of real hogcore voice clips");
ok(sa.mean < sb.mean, "auto-tune reduces mean cents-to-scale (the clips cohere toward the key)");
ok(sa.mean < sb.mean * 0.45, "the reduction is substantial (~0.3x at strength 0.7)");

console.log(fail ? `\nPROBE FAIL (${fail})` : "\nPROBE PASS");
process.exit(fail ? 1 : 0);
