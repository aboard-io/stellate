#!/usr/bin/env node
// mine-midi.js — SMF parser + verifier-comparable feature extraction for the
// MIDI trove (found/midi/, fetched by tools/fetch/fetch-midi-trove.sh). Zero deps.
//
//   node tools/mine/mine-midi.js file <song.mid>            parse one file, dump features
//   node tools/mine/mine-midi.js scan <dir> [--json out]    corpus feature distributions
//   node tools/mine/mine-midi.js keycheck <dir>             key detector vs embedded key sigs
//   node tools/mine/mine-midi.js calibrate <genre> <dir>    corpus vs anchor renders vs TARGETS
//
// The point: genre-verifier.js has only ever measured the engine against its
// own renders. This tool measures REAL genre-labeled MIDI with the same
// formulas (offgrid / variation / interlock copied verbatim; drum lanes mapped
// from GM percussion), so `calibrate` is an external check on an anchor row.
//
// Honesty caveats, stated once here:
//   - amp: the verifier weighs engine amp × kit level; MIDI gives velocity.
//     We use vel/127 as the amp proxy — snareBalance is a VELOCITY balance.
//   - swing: the engine's state.swing displaces off-beat 8ths by swing×0.16
//     beats (SWING_GRIDS "8th"). We measure the median off-beat displacement
//     and divide by 0.16 — a state.swing EQUIVALENT (triplet feel ≈ 1.04).
//   - motion/seventh: the verifier reads the authored progression; here chords
//     are ESTIMATED per bar (template match, bass-weighted), motion over
//     8-bar windows (loop-scale root variety). Estimates, not ground truth.
//   - wash/crackle/pump/acoustic/sub etc. are production state — MIDI is
//     silent about them; calibrate only compares the measurable subset.
//   - NOTATION TEMPO is a convention, not a truth: dub/reggae MIDI is written
//     double-time (corpus 134 = anchor 67), and 2/4-notated corpora (ragtime,
//     marches) read HALF as fast as they feel — the stride pulse doubles the
//     quarter. Check the metric level before trusting a bpm divergence either
//     way (the ragtime anchor's first press was slow for exactly this reason).
"use strict";
const fs = require("fs");
const path = require("path");

// ---------------- SMF parser ----------------
// parseSmf(Uint8Array|Buffer) -> { format, ppq, ntrk, tempoMap:[{tick,us}],
//   timeSigs:[{tick,nn,den}], keySigs:[{tick,sf,mi}], trackNames:[...],
//   notes:[{tick,beat,ch,pitch,vel,dur}], totalBeats }
function parseSmf(buf) {
  let p = 0;
  const u32 = () => ((buf[p++] << 24) | (buf[p++] << 16) | (buf[p++] << 8) | buf[p++]) >>> 0;
  const u16 = () => (buf[p++] << 8) | buf[p++];
  const tag = () => String.fromCharCode(buf[p++], buf[p++], buf[p++], buf[p++]);
  const vlq = () => { let v = 0, b; do { b = buf[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
  if (tag() !== "MThd") throw new Error("not an SMF (no MThd)");
  const hlen = u32(), format = u16(), ntrk = u16(), div = u16();
  if (div & 0x8000) throw new Error("SMPTE timing unsupported");
  const ppq = div || 480;
  p += hlen - 6;
  const tempoMap = [], timeSigs = [], keySigs = [], trackNames = [], notes = [];
  // PROGRAM CHANGES, added 2026-09-06 for tools/remix.js. The 0xc0 branch below
  // already had to read the byte to advance the cursor; this keeps it instead of
  // throwing it away. Nothing that existed before reads `programs`, so every
  // caller of parseSmf sees the object it always saw — and the caveat that
  // belongs beside it is that a GM program number is the TRANSCRIBER's choice of
  // patch, not a fact about the record (this trove is largely piano
  // transcriptions), which is why remix.js reads only the 16 GM FAMILIES off it
  // and says so in the row it writes.
  const programs = [];
  for (let t = 0; t < ntrk && p < buf.length; t++) {
    while (p + 8 <= buf.length && String.fromCharCode(buf[p], buf[p + 1], buf[p + 2], buf[p + 3]) !== "MTrk") p++;
    if (p + 8 > buf.length) break;
    p += 4;
    const len = u32(), end = p + len;
    let tick = 0, running = null;
    const open = {};   // ch*128+pitch -> [{tick, vel}] FIFO
    while (p < end) {
      tick += vlq();
      let st = buf[p];
      if (st & 0x80) { p++; if (st < 0xf0) running = st; } else st = running;
      if (st === 0xff) {                                    // meta
        const type = buf[p++], mlen = vlq(), d = p; p += mlen;
        if (type === 0x51 && mlen === 3) tempoMap.push({ tick, us: (buf[d] << 16) | (buf[d + 1] << 8) | buf[d + 2] });
        else if (type === 0x58 && mlen >= 2) timeSigs.push({ tick, nn: buf[d], den: 1 << buf[d + 1] });
        else if (type === 0x59 && mlen >= 2) keySigs.push({ tick, sf: buf[d] > 127 ? buf[d] - 256 : buf[d], mi: buf[d + 1] });
        else if (type === 0x03) trackNames.push(String.fromCharCode(...buf.slice(d, d + mlen)));
      } else if (st === 0xf0 || st === 0xf7) { p += vlq(); }  // sysex
      else {
        const hi = st & 0xf0, ch = st & 0x0f;
        if (hi === 0xc0 || hi === 0xd0) { if (hi === 0xc0) programs.push({ tick, ch, pgm: buf[p] }); p += 1; continue; }
        const a = buf[p++], b = buf[p++];
        if (hi === 0x90 && b > 0) (open[ch * 128 + a] = open[ch * 128 + a] || []).push({ tick, vel: b });
        else if (hi === 0x80 || (hi === 0x90 && b === 0)) {
          const q = open[ch * 128 + a];
          if (q && q.length) { const on = q.shift(); notes.push({ tick: on.tick, ch, pitch: a, vel: on.vel, offTick: tick }); }
        }
      }
    }
    for (const k in open) for (const on of open[k])         // close hanging notes at track end
      notes.push({ tick: on.tick, ch: (k / 128) | 0, pitch: k % 128, vel: on.vel, offTick: tick });
    p = end;
  }
  notes.sort((a, b) => a.tick - b.tick || a.ch - b.ch || a.pitch - b.pitch);
  for (const n of notes) { n.beat = n.tick / ppq; n.dur = Math.max(1, n.offTick - n.tick) / ppq; delete n.offTick; }
  tempoMap.sort((a, b) => a.tick - b.tick); timeSigs.sort((a, b) => a.tick - b.tick);
  const totalBeats = notes.length ? Math.max(1, Math.max(...notes.map(n => n.beat + n.dur)) - Math.min(...notes.map(n => n.beat))) : 1;
  programs.sort((a, b) => a.tick - b.tick);
  return { format, ppq, ntrk, tempoMap, timeSigs, keySigs, trackNames, programs, notes, totalBeats };
}

// GM percussion (ch 10) -> the engine's drum lane names. CORE (kick/snare/hat/
// tom) is what the verifier's rhythm features score; the rest is the
// decorative lane it deliberately ignores.
function laneFor(pitch) {
  if (pitch === 35 || pitch === 36) return "kick";
  if (pitch === 38 || pitch === 40) return "snare";
  if (pitch === 37) return "rim";
  if (pitch === 42 || pitch === 44) return "hat";
  if (pitch === 46) return "hat";                    // open — lane hat, like the engine's open flag
  if ([41, 43, 45, 47, 48, 50].includes(pitch)) return "tom";
  if ([49, 52, 55, 57].includes(pitch)) return "crash";
  if ([51, 53, 59].includes(pitch)) return "ride";
  if (pitch === 39) return "clap";
  return "perc";
}
const CORE = { kick: 1, snare: 1, hat: 1, tom: 1 };

// ---------------- features (genre-verifier formulas, MIDI-side) ----------------
const INTERLOCK_Q = new Set([0, 4, 8, 12]);
function interlock(drums) {                                 // verbatim from genre-verifier.js
  const wins = {};
  drums.forEach(d => { const w = Math.floor(d.beat / 8); const slot = ((Math.round(d.beat * 2) % 16) + 16) % 16;
    (wins[w] = wins[w] || {}); (wins[w][d.drum] = wins[w][d.drum] || new Set()).add(slot); });
  const per = [];
  for (const w of Object.values(wins)) {
    const lanes = Object.entries(w).filter(([l, s]) => s.size >= 2);
    const kick = w.kick;
    if (lanes.length < 2 || !kick || kick.size < 2) { per.push(0); continue; }
    const cover = {}; for (const [l, s] of lanes) for (const slot of s) cover[slot] = (cover[slot] || 0) + 1;
    const single = Object.values(cover).filter(c => c === 1).length / 16;
    const kOff = [...kick].filter(s => !INTERLOCK_Q.has(s)).length / kick.size;
    per.push(kOff * single);
  }
  return per.length ? per.reduce((a, b) => a + b, 0) / per.length : 0;
}

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pctl = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

function bpmOf(parsed) {                                    // beat-span-weighted median tempo
  const tm = parsed.tempoMap;
  if (!tm.length) return 120;
  const endTick = parsed.totalBeats * parsed.ppq;
  const spans = [];
  for (let i = 0; i < tm.length; i++) {
    const next = i + 1 < tm.length ? tm[i + 1].tick : Math.max(endTick, tm[i].tick + 1);
    spans.push({ bpm: 60000000 / tm[i].us, w: Math.max(0, next - tm[i].tick) });
  }
  spans.sort((a, b) => a.bpm - b.bpm);
  const total = spans.reduce((s, x) => s + x.w, 0); let acc = 0;
  for (const s of spans) { acc += s.w; if (acc >= total / 2) return +s.bpm.toFixed(1); }
  return +spans[spans.length - 1].bpm.toFixed(1);
}

// chord estimate per bar: duration×velocity pitch-class weights, root by
// triad template (bass-boosted); returns [{bar, root, seventh}]
function chordsOf(parsed) {
  const ts = parsed.timeSigs[0];
  const barLen = ts ? ts.nn * (4 / ts.den) : 4;
  const pitched = parsed.notes.filter(n => n.ch !== 9);
  if (!pitched.length) return { bars: [], barLen };
  const nBars = Math.ceil(parsed.totalBeats / barLen);
  const bars = [];
  for (let b = 0; b < nBars; b++) {
    const s = b * barLen, e = s + barLen;
    const w = new Float64Array(12); let bassPitch = 128, tot = 0;
    for (const n of pitched) {
      const ov = Math.min(e, n.beat + n.dur) - Math.max(s, n.beat);
      if (ov <= 0) continue;
      w[n.pitch % 12] += ov * (n.vel / 127); tot += ov * (n.vel / 127);
      if (n.pitch < bassPitch) bassPitch = n.pitch;
    }
    if (tot < 0.1) continue;
    let best = -1, bestScore = -1;
    for (let r = 0; r < 12; r++) {
      const score = w[r] + 0.75 * Math.max(w[(r + 3) % 12], w[(r + 4) % 12]) + 0.5 * w[(r + 7) % 12]
                  + 0.4 * Math.max(w[(r + 10) % 12], w[(r + 11) % 12]) + (bassPitch < 128 && bassPitch % 12 === r ? 0.8 : 0);
      if (score > bestScore) { bestScore = score; best = r; }
    }
    const seventh = Math.max(w[(best + 10) % 12], w[(best + 11) % 12]) >= 0.3 * (w[best] + 1e-9) && w[best] > 0;
    bars.push({ bar: b, root: best, seventh });
  }
  return { bars, barLen };
}

// Krumhansl-Kessler key detection; confidence = correlation margin over runner-up
const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function pearson(a, b) {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
function detectKey(parsed) {
  const w = new Float64Array(12);
  for (const n of parsed.notes) if (n.ch !== 9) w[n.pitch % 12] += n.dur * (n.vel / 127);
  const cands = [];
  for (let t = 0; t < 12; t++) {
    const rot = (prof) => prof.map((_, i) => w[(t + i) % 12]);
    cands.push({ tonic: t, mode: "major", r: pearson(rot(KK_MAJ), KK_MAJ) });
    cands.push({ tonic: t, mode: "minor", r: pearson(rot(KK_MIN), KK_MIN) });
  }
  cands.sort((a, b) => b.r - a.r);
  return { tonic: cands[0].tonic, mode: cands[0].mode, r: +cands[0].r.toFixed(3), margin: +(cands[0].r - cands[1].r).toFixed(3) };
}
// key signature meta -> tonic pitch class (circle of fifths from C / A minor)
const keySigTonic = (sf, mi) => mi ? ((7 * sf + 9) % 12 + 12) % 12 : ((7 * sf) % 12 + 12) % 12;
const PCN = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

// the verifier-comparable subset, from one parsed file
function featuresOf(parsed) {
  const beats = parsed.totalBeats;
  const allDrums = parsed.notes.filter(n => n.ch === 9)
    .map(n => ({ beat: n.beat, drum: laneFor(n.pitch), amp: n.vel / 127 }));
  const drums = allDrums.filter(d => CORE[d.drum]);
  const kicks = drums.filter(d => d.drum === "kick"), snares = drums.filter(d => d.drum === "snare"), hats = drums.filter(d => d.drum === "hat");
  const sum = (a) => a.reduce((s, e) => s + e.amp, 0);
  const offgrid = drums.length ? drums.filter(d => { const f = d.beat * 2 - Math.round(d.beat * 2); return Math.abs(f) > 0.08; }).length / drums.length : 0;
  const wins = {};
  drums.forEach(d => { const w = Math.floor(d.beat / 8); (wins[w] = wins[w] || []).push((Math.round((d.beat % 8) * 4) / 4) + d.drum[0] + Math.round(d.amp * 10)); });
  const sigs = Object.values(wins).map(w => w.sort().join(","));
  const variation = sigs.length ? new Set(sigs).size / sigs.length : 0;
  // swing: median displacement of events sitting around the off-beat 8th,
  // measured over EVERYTHING (the engine swings both lanes), in state.swing units
  const disp = [];
  for (const n of parsed.notes) { const f = n.beat - Math.floor(n.beat); if (f >= 0.36 && f <= 0.75) disp.push(f - 0.5); }
  const swing = disp.length >= 8 ? +Math.max(0, median(disp) / 0.16).toFixed(3) : 0;
  const { bars } = chordsOf(parsed);
  let motion = 0;
  if (bars.length >= 4) {
    const per = [];
    for (let s = 0; s + 4 <= bars.length; s += 8) {
      const roots = new Set(bars.slice(s, s + 8).map(b => b.root));
      per.push(Math.min(1, (roots.size - 1) / 3));
    }
    motion = per.length ? per.reduce((a, b) => a + b, 0) / per.length : 0;
  }
  const seventh = bars.length ? bars.filter(b => b.seventh).length / bars.length : 0;
  return {
    bpm: bpmOf(parsed),
    offgrid: +offgrid.toFixed(3),
    snareBalance: +(sum(snares) / (sum(kicks) + 0.001)).toFixed(2),
    hatDensity: +(hats.length / beats).toFixed(2),
    drumDensity: +(drums.length / beats).toFixed(2),
    variation: +variation.toFixed(2),
    swing,
    motion: +motion.toFixed(2),
    seventh: +seventh.toFixed(2),
    interlock: +interlock(drums).toFixed(3),
    // extras (not verifier features; corpus intel for vocabulary mining)
    _noteDensity: +(parsed.notes.filter(n => n.ch !== 9).length / beats).toFixed(2),
    _hasDrums: drums.length > 0 ? 1 : 0,
    _beats: Math.round(beats),
  };
}

// features the calibrate table compares (measurable from MIDI, scored by TARGETS)
const MEASURABLE = ["bpm", "drumDensity", "hatDensity", "snareBalance", "variation", "offgrid", "swing", "motion", "seventh", "interlock"];

// ---------------- corpus scan ----------------
function* midiFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) yield* midiFiles(f);
    else if (/\.midi?$/i.test(e.name)) yield f;
  }
}
function scanDir(dir, opts) {
  opts = opts || {};
  const rows = [], failures = [];
  let n = 0;
  for (const f of midiFiles(dir)) {
    if (opts.limit && n >= opts.limit) break;
    try {
      const parsed = parseSmf(fs.readFileSync(f));
      if (!parsed.notes.length) throw new Error("no notes");
      const feat = featuresOf(parsed);
      feat._file = path.relative(dir, f);
      feat._key = detectKey(parsed);
      feat._keySig = parsed.keySigs.length ? parsed.keySigs[0] : null;
      feat._timeSig = parsed.timeSigs.length ? `${parsed.timeSigs[0].nn}/${parsed.timeSigs[0].den}` : "4/4";
      rows.push(feat); n++;
    } catch (e) { failures.push({ file: path.relative(dir, f), err: e.message }); }
  }
  return { rows, failures };
}
function distTable(rows, keys) {
  const out = {};
  for (const k of keys) {
    const vals = rows.map(r => r[k]).filter(v => typeof v === "number" && isFinite(v));
    out[k] = { p10: +pctl(vals, 0.1).toFixed(3), p50: +pctl(vals, 0.5).toFixed(3), p90: +pctl(vals, 0.9).toFixed(3), n: vals.length };
  }
  return out;
}

// ---------------- CLI ----------------
function cliScan(dir, argv) {
  const limit = argv.includes("--limit") ? +argv[argv.indexOf("--limit") + 1] : 0;
  const { rows, failures } = scanDir(dir, { limit });
  const withDrums = rows.filter(r => r._hasDrums);
  console.log(`${dir}: ${rows.length} parsed, ${failures.length} failed, ${withDrums.length} with drums`);
  const dist = distTable(rows, MEASURABLE.concat(["_noteDensity", "_beats"]));
  const distD = distTable(withDrums, ["drumDensity", "hatDensity", "snareBalance", "variation", "offgrid", "interlock"]);
  console.log("feature            p10     p50     p90   (drum feats over drum-bearing files)");
  for (const k of MEASURABLE.concat(["_noteDensity", "_beats"])) {
    const d = distD[k] || dist[k];
    console.log(`${k.padEnd(15)} ${String(d.p10).padStart(7)} ${String(d.p50).padStart(7)} ${String(d.p90).padStart(7)}   n=${d.n}`);
  }
  const meters = {}; rows.forEach(r => meters[r._timeSig] = (meters[r._timeSig] || 0) + 1);
  console.log("meters:", Object.entries(meters).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([m, c]) => `${m}×${c}`).join(" "));
  const minor = rows.filter(r => r._key.mode === "minor").length;
  console.log(`keys: ${Math.round(100 * minor / Math.max(1, rows.length))}% minor (KK-detected)`);
  if (failures.length) console.log("first failures:", failures.slice(0, 3).map(f => `${f.file}: ${f.err}`).join(" | "));
  const ji = argv.indexOf("--json");
  if (ji >= 0) { fs.writeFileSync(argv[ji + 1], JSON.stringify({ dir, dist, distDrums: distD, rows, failures }, null, 1)); console.log("wrote", argv[ji + 1]); }
}

function cliKeycheck(dir, argv) {
  const { rows } = scanDir(dir, {});
  const withSig = rows.filter(r => r._keySig);
  let exact = 0, relative = 0, fifth = 0;
  for (const r of withSig) {
    const expT = keySigTonic(r._keySig.sf, r._keySig.mi), expM = r._keySig.mi ? "minor" : "major";
    const gotT = r._key.tonic, gotM = r._key.mode;
    if (gotT === expT && gotM === expM) exact++;
    else if (gotM !== expM && gotT === (expM === "major" ? (expT + 9) % 12 : (expT + 3) % 12)) relative++;
    else if (gotM === expM && (gotT === (expT + 7) % 12 || gotT === (expT + 5) % 12)) fifth++;
  }
  const n = withSig.length;
  console.log(`${dir}: ${n}/${rows.length} files carry a key signature`);
  if (!n) return { n: 0 };
  const pc = (x) => Math.round(100 * x / n);
  console.log(`key detector vs embedded sig: exact ${pc(exact)}%  relative ${pc(relative)}%  fifth-off ${pc(fifth)}%  other ${pc(n - exact - relative - fifth)}%`);
  return { n, exact: exact / n, exactOrRelative: (exact + relative) / n };
}

function cliCalibrate(genre, dir, argv) {
  const K = require("../../engine/genre-kernel.js");
  const V = require("../../engine/genre-verifier.js");
  if (!K.GENRES[genre]) { console.error(`no such genre anchor: ${genre}`); process.exit(2); }
  const seeds = argv.includes("--seeds") ? +argv[argv.indexOf("--seeds") + 1] : 8;
  const anchor = [];
  for (let s = 1; s <= seeds; s++) anchor.push(V.features(K.track(genre, { seed: s })));
  const { rows } = scanDir(dir, {});
  const drumFeats = { drumDensity: 1, hatDensity: 1, snareBalance: 1, variation: 1, offgrid: 1, interlock: 1 };
  const targets = V.TARGETS[genre] || {};
  console.log(`calibrate ${genre}: corpus ${dir} (${rows.length} files) vs anchor renders (${seeds} seeds) vs TARGETS row`);
  console.log("feature          corpus p10/p50/p90        anchor min..max     target [lo,hi]   verdict");
  const verdicts = {};
  for (const k of MEASURABLE) {
    const pool = drumFeats[k] ? rows.filter(r => r._hasDrums) : rows;
    const vals = pool.map(r => r[k]).filter(v => typeof v === "number" && isFinite(v));
    if (!vals.length) continue;
    const p10 = pctl(vals, 0.1), p50 = pctl(vals, 0.5), p90 = pctl(vals, 0.9);
    const av = anchor.map(a => a[k]).filter(v => typeof v === "number" && isFinite(v));
    const aMin = Math.min(...av), aMax = Math.max(...av);
    const t = targets[k];
    let verdict;
    if (p50 >= aMin && p50 <= aMax) verdict = "match";
    else if (p90 >= aMin && p10 <= aMax) verdict = "close";
    else verdict = p50 > aMax ? "DIVERGES(corpus higher)" : "DIVERGES(corpus lower)";
    if (t && (p50 < t[0] || p50 > t[1])) verdict += " +corpus-outside-TARGET";
    verdicts[k] = verdict;
    const fmt = (x) => (Math.round(x * 1000) / 1000).toString();
    console.log(`${k.padEnd(14)} ${`${fmt(p10)}/${fmt(p50)}/${fmt(p90)}`.padStart(24)} ${`${fmt(aMin)}..${fmt(aMax)}`.padStart(19)} ${(t ? `[${t[0]},${t[1]}]` : "-").padStart(16)}   ${verdict}`);
  }
  const ji = argv.indexOf("--json");
  if (ji >= 0) { fs.writeFileSync(argv[ji + 1], JSON.stringify({ genre, dir, verdicts, anchor, corpus: distTable(rows, MEASURABLE) }, null, 1)); console.log("wrote", argv[ji + 1]); }
  return verdicts;
}

// `bpmOf`, `median` and `CORE` leave the module 2026-09-06 for tools/remix.js:
// the remix pipeline asks the SAME beat-span-weighted median this file asks,
// and a second copy of that arithmetic is the drift this repo legislates
// against. Nothing about the existing exports moved.
const api = { parseSmf, laneFor, featuresOf, detectKey, chordsOf, scanDir, distTable, keySigTonic,
              bpmOf, median, pctl, interlock, CORE, MEASURABLE, PCN };
if (typeof module !== "undefined" && module.exports) module.exports = api;

if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === "file" && argv[1]) {
    const parsed = parseSmf(fs.readFileSync(argv[1]));
    const k = detectKey(parsed);
    console.log(JSON.stringify({ ppq: parsed.ppq, tracks: parsed.ntrk, notes: parsed.notes.length,
      timeSig: parsed.timeSigs[0] || null, keySig: parsed.keySigs[0] || null,
      key: `${PCN[k.tonic]} ${k.mode} (r=${k.r}, margin=${k.margin})`, features: featuresOf(parsed) }, null, 1));
  }
  else if (cmd === "scan" && argv[1]) cliScan(argv[1], argv);
  else if (cmd === "keycheck" && argv[1]) cliKeycheck(argv[1], argv);
  else if (cmd === "calibrate" && argv[1] && argv[2]) cliCalibrate(argv[1], argv[2], argv);
  else { console.log("usage: mine-midi.js file <f.mid> | scan <dir> [--json out] [--limit N] | keycheck <dir> | calibrate <genre> <dir> [--seeds N] [--json out]"); process.exit(1); }
}
