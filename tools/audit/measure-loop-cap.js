#!/usr/bin/env node
// measure-loop-cap.js — the evidence behind NOT capping sampler loop regions.
//
// A sustain loop is the tail of a zone file: the media has to carry samples all
// the way to `le`, so shortening the LOOPED REGION shortens the file. Capping
// every loop at 1.0 s therefore looks like a free byte cut. It is not, and this
// tool is the measurement that says so — re-run it before anyone re-proposes it.
//
// WHAT IT MEASURES
//   1. bytes  — what a cap at various lengths would actually save, per zone,
//      per sampler and library-wide. The cut is (file length - (ls + cap)),
//      never (le - ls - cap): post-loop tail is already trimmed at extraction,
//      so the saving comes entirely out of the loop itself.
//   2. seam   — the discontinuity a listener hears at every loop wrap, as the
//      mean absolute step across a 32-sample window entering the loop end vs
//      the same window at the loop start, normalised by the loop's own RMS.
//      A well-chosen SF2 loop point is period-aligned and scores near zero; an
//      arbitrary cut lands at a random phase and scores near 1, i.e. a step the
//      size of the signal, once per second, forever.
//   3. the free subset — zones where a period-aligned end search inside the cap
//      window finds a seam no worse than the loop's own AND the capped window is
//      the same material as the full loop (RMS and high/low band ratio within
//      10%). Only a stationary drone qualifies; an ensemble whose beating has a
//      multi-second period does not, which is exactly what the long loops are.
//
// It also flags a data fault the byte pass turns up for free: zones whose `le`
// runs PAST the end of the shipped media. Playback clamps (sampler.js loopEnd,
// live.js src.loopEnd), so the audio is unaffected — but the metadata is lying
// about where the loop ends, and the clamp lands the wrap at an arbitrary phase.
//
//   node tools/audit/measure-loop-cap.js [--cap 1.0] [--list N]
"use strict";
const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const BASE = path.join(ROOT, "found", "samples", "instruments");
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i < 0 ? d : argv[i + 1]; };
const CAP = +val("--cap", 1.0);
const LIST = +val("--list", 12);
const CAPS = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0];

// 16-bit PCM only — the instrument crate is uniform, and a surprise format is a
// louder failure than a silent skip.
function readWav(p) {
  const b = fs.readFileSync(p);
  let off = 12, dataOff = -1, dataLen = 0, bits = 0, ch = 1;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4), sz = b.readUInt32LE(off + 4);
    if (id === "fmt ") { ch = b.readUInt16LE(off + 10); bits = b.readUInt16LE(off + 22); }
    if (id === "data") { dataOff = off + 8; dataLen = sz; break; }
    off += 8 + sz + (sz & 1);
  }
  if (dataOff < 0 || bits !== 16) return null;
  const n = Math.floor(dataLen / 2 / ch), a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = b.readInt16LE(dataOff + i * 2 * ch) / 32768;
  return a;
}

const SEAM_W = 32;
function seam(x, ls, le) {
  let d = 0;
  for (let i = 0; i < SEAM_W; i++) d += Math.abs((x[le - SEAM_W + i] || 0) - (x[ls - SEAM_W + i] || 0));
  let s = 0, c = 0;
  for (let i = ls; i < le; i += 7) { s += x[i] * x[i]; c++; }
  const rms = Math.sqrt(s / Math.max(1, c));
  return rms > 0 ? (d / SEAM_W) / rms : Infinity;
}

// RMS and a cheap high/low band ratio (first-difference energy over sum energy)
// in 100 ms frames — enough to tell a steady drone from an evolving ensemble
// without pulling an FFT in.
function material(x, a, b, sr) {
  const F = Math.round(0.1 * sr), rms = [], band = [];
  for (let i = a; i + F <= b; i += F) {
    let s = 0, hi = 0, lo = 0, prev = x[i];
    for (let j = i; j < i + F; j++) {
      const v = x[j]; s += v * v;
      const d = v - prev; hi += d * d; lo += (v + prev) * (v + prev); prev = v;
    }
    rms.push(Math.sqrt(s / F)); band.push(hi / (lo + 1e-12));
  }
  const m = v => v.reduce((p, q) => p + q, 0) / Math.max(1, v.length);
  return { rms: m(rms), band: m(band) };
}

// best period-aligned end inside [0.6*cap, cap] — an honest cap would use this,
// not a blind cut, so the free-subset test has to use it too.
function alignedEnd(x, ls, le, capS) {
  const lo = Math.max(ls + Math.round(capS * 0.6), ls + SEAM_W * 2), hi = Math.min(ls + capS, le);
  let best = null;
  for (let e = lo; e <= hi; e++) { const v = seam(x, ls, e); if (!best || v < best.v) best = { v, e }; }
  return best;
}

const mb = n => (n * 2 / 1048576).toFixed(2) + " MB";
const pct = (n, d) => (100 * n / (d || 1)).toFixed(2) + "%";

function main() {
  const S = K.SAMPLERS;
  const zones = [];
  let libSamples = 0, missing = 0;

  for (const id of Object.keys(S)) {
    const s = S[id];
    for (const z of s.zones) {
      const p = path.join(BASE, s.dir, z.file);
      let x = null;
      try { x = readWav(p); } catch { missing++; continue; }
      if (!x) { missing++; continue; }
      libSamples += x.length;
      zones.push({ id, sr: s.sr, z, x, n: x.length });
    }
  }
  if (!zones.length) { console.log("no zone media on disk — nothing to measure"); return; }

  console.log(`library: ${zones.length} zones present, ${mb(libSamples)} (${missing} absent)`);

  // ---- 1. bytes ----
  for (const cap of CAPS) {
    let saved = 0, touched = 0;
    for (const r of zones) {
      if (!r.z.loop) continue;
      const capS = Math.round(cap * r.sr);
      if (r.z.le - r.z.ls <= capS) continue;
      saved += Math.max(0, r.n - (r.z.ls + capS)); touched++;
    }
    console.log(`  cap ${cap.toFixed(2)}s -> ${pct(saved, libSamples)} (${mb(saved)}) across ${touched} zones`);
  }

  // ---- 2 + 3. seam and the free subset, at the requested cap ----
  const free = [], harmed = [];
  let saveAll = 0, saveFree = 0;
  const origSeams = [], naiveSeams = [], alignedSeams = [];
  const overrun = [];

  for (const r of zones) {
    if (!r.z.loop) continue;
    if (r.z.le > r.n) overrun.push({ id: r.id, file: r.z.file, le: r.z.le, len: r.n, over: r.z.le - r.n });
    const capS = Math.round(CAP * r.sr);
    const le = Math.min(r.z.le, r.n);
    if (le - r.z.ls <= capS) continue;

    const orig = seam(r.x, r.z.ls, le);
    const naive = seam(r.x, r.z.ls, r.z.ls + capS);
    const best = alignedEnd(r.x, r.z.ls, le, capS);
    if (!best) continue;
    origSeams.push(orig); naiveSeams.push(naive); alignedSeams.push(best.v);

    const cut = Math.max(0, r.n - best.e);
    saveAll += cut;
    const A = material(r.x, r.z.ls, best.e, r.sr), B = material(r.x, r.z.ls, le, r.sr);
    const rmsDrift = Math.abs(A.rms - B.rms) / (B.rms + 1e-12);
    const bandDrift = Math.abs(A.band - B.band) / (B.band + 1e-12);
    const row = { id: r.id, file: r.z.file, region: +((le - r.z.ls) / r.sr).toFixed(2),
      seamNow: +orig.toFixed(3), seamCapped: +best.v.toFixed(3),
      rmsDrift: +rmsDrift.toFixed(3), bandDrift: +bandDrift.toFixed(3), cutKB: Math.round(cut * 2 / 1024) };
    if (best.v <= orig + 1e-9 && rmsDrift < 0.10 && bandDrift < 0.10) { free.push(row); saveFree += cut; }
    else harmed.push(row);
  }

  const med = v => { const s = v.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  console.log(`\nseam at cap ${CAP}s, ${origSeams.length} long-loop zones (step / loop RMS, lower is quieter):`);
  console.log(`  as shipped ${med(origSeams).toFixed(3)}   blind cut ${med(naiveSeams).toFixed(3)}` +
    `   period-aligned cut ${med(alignedSeams).toFixed(3)}   (medians)`);
  console.log(`\ncap at ${CAP}s, period-aligned: ${pct(saveAll, libSamples)} (${mb(saveAll)}) available`);
  console.log(`  FREE  (seam no worse, material within 10%): ${free.length} zones, ${pct(saveFree, libSamples)} (${mb(saveFree)})`);
  console.log(`  COSTS fidelity: ${harmed.length} zones, ${pct(saveAll - saveFree, libSamples)} (${mb(saveAll - saveFree)})`);

  if (LIST > 0 && harmed.length) {
    console.log(`\nworst fidelity cost (top ${LIST} by seam):`);
    console.table(harmed.sort((a, b) => b.seamCapped - a.seamCapped).slice(0, LIST));
  }
  if (LIST > 0 && free.length) {
    console.log(`\nfree subset (top ${LIST} by bytes):`);
    console.table(free.sort((a, b) => b.cutKB - a.cutKB).slice(0, LIST));
  }
  if (overrun.length) {
    console.log(`\nLOOP END PAST EOF (${overrun.length}) — playback clamps, metadata lies:`);
    console.table(overrun);
  }
}

main();
