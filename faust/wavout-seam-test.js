#!/usr/bin/env node
// faust/wavout-seam-test.js — the WAV-FIRST producer gates 1/2/4 (WAV-FIRST.md), in
// node against the SAME makeStreamEngine the openLiveSegs worker runs, driven by the
// SAME per-bar live walk the conductor feeds. No browser: this checks the RENDERED
// segment bytes, not playback.
//
//   node faust/wavout-seam-test.js
//
//   Gate 1 (seam continuity, v2 overlap): across >=3 segment joins of a STABLE state,
//     the ALIGNED OVERLAP of adjacent segments — segment k's baked fade-OUT tail plus
//     segment k+1's baked fade-IN head, which carry IDENTICAL stream content — sums to
//     the continuous stream within epsilon (constant-gain unity), AND each head/tail
//     equals raw*fade within epsilon (the baked fades are present). Seam continuity is
//     measured on the RECONSTRUCTED overlap-add, not the raw butt join.
//   Gate 2 (full-mix presence): a found+sampler-heavy state (spokenword) rendered WITH
//     buffers differs from and carries more energy than the synth-only render.
//   Gate 4 (render keeps up): wall time to render a segment < 1/3 of its audio duration.
"use strict";
const path = require("path");
const GK = require(path.join(__dirname, "..", "genre-kernel.js"));
const E = require(path.join(__dirname, "..", "csd-engine.js"));
const SE = require(path.join(__dirname, "state-engine.js"));
const FP = require(path.join(__dirname, "found-player.js"));
const SP = require(path.join(__dirname, "sampler.js"));
const RCORE = require(path.join(__dirname, "render-core.js"));
const press = require(path.join(__dirname, "press.js"));
const { makeStreamEngine } = require(path.join(__dirname, "stream-renderer.js"));
const lamejs = require(path.join(__dirname, "vendor", "lamejs.min.js"));
const { makeMp3Stream } = require(path.join(__dirname, "mp3-stream.js"));

const SR = 44100, BS = 64;
const SEG_SEC = 6, FIRST_SEG_SEC = 4;   // shorter than prod so the test renders quickly
const OV = Math.round(0.120 * SR), ME = Math.round(0.005 * SR);   // baked overlap + micro-edge (match stream-worker.js)
const fadeIn = (L, R, n) => { for (let i = 0; i < n; i++) { const g = (i + 0.5) / n; L[i] *= g; R[i] *= g; } };
const fadeOut = (L, R, start, n) => { for (let j = 0; j < n; j++) { const g = (n - 0.5 - j) / n; L[start + j] *= g; R[start + j] *= g; } };

// ── the live walk (lifted from live.js exploreLiveWav.stepWalk) ──
function makeWalk(getState) {
  let ci = 0, serial = 0, secIdx = 0, cycIdx = 0, absBeat = 0;
  const grooveSec = (st) => {
    const score = (s) => (s.pads ? 1 : 0) + (s.bass && s.bass !== "off" ? 1 : 0) +
      (s.drums && s.drums !== "off" ? 2 : 0) + (s.melody && s.melody !== "off" ? 1 : 0);
    let best = st.sections[0];
    for (const s of st.sections) if (score(s) > score(best) || (/peak|chorus|drop|lift|swell/.test(s.name) && score(s) >= score(best))) best = s;
    return best;
  };
  return function stepWalk() {
    const st = getState();
    const prg = (E.PROGRESSIONS[st.progression] || E.PROGRESSIONS.royal_road);
    const nch = prg.chords.length;
    ci = ci % nch;
    const secs = st.sections && st.sections.length ? st.sections : [grooveSec(st)];
    secIdx = secIdx % secs.length;
    const cur0 = secs[secIdx], lastCyc = cycIdx >= (cur0.cycles || 1) - 1;
    const sec = Object.assign({}, cur0, { cycles: 1,
      fill: lastCyc ? (cur0.fill || "off") : "off",
      sweep: (cycIdx === 0 && cur0.sweep === "open") || (lastCyc && cur0.sweep === "close") ? cur0.sweep : "off" });
    const one = Object.assign({}, st, { sections: [sec], seed: ((st.seed || 1) + serial * 7919) >>> 0 });
    const spb = 60 / st.bpm;
    const CBEATS = Math.max(2, Math.round(st.chordEvery || 8));
    const lo = ci * CBEATS, hi = lo + CBEATS;
    const ev = E.buildEvents(one);
    const units = SE.voiceUnits(E, one);
    const m = SE.mapEvents(E, one, ev, { lo, hi, units });
    const fxParams = SE.fxParams(one);
    const meta = { serial, ci, nch, spb, cbeats: CBEATS, chord: (prg.chords[ci] || {}).name || "",
      section: sec.name, absBeatLo: absBeat, lo };
    absBeat += CBEATS; ci++; serial++;
    if (ci >= nch) { ci = 0; cycIdx++; if (cycIdx >= (secs[secIdx].cycles || 1)) { cycIdx = 0; secIdx = (secIdx + 1) % secs.length; } }
    return { one, units, spb, lo, hi, events: m.events, fxParams, sweepsRaw: m.sweeps,
      found: m.found, meta, musicalSec: (hi - lo) * spb };
  };
}

// render `nSegs` consecutive WAV segments of a stable state through the segs engine.
async function renderSegs(state, buffers, speech, nSegs) {
  const env = { E, SE, FP, SP, mergeIvals: RCORE.mergeIvals, mkProc: press.mkProc, rootOf: press.rootOf,
    SR, BS, dx7Presets: press.loadDx7Presets() };
  const eng = makeStreamEngine(env);
  await eng.open(state, { buffers: {}, opts: { dur: 0.0001 } });   // warm mkProc cache (cheap); discarded
  eng.close();
  await eng.openLive(state, { buffers: buffers || {}, speech: speech || null, bakeNative: true });
  const walk = makeWalk(() => state);
  const segs = [];            // baked overlapped+faded segments (what the worker posts)
  const rawL = [], rawR = []; // the clean continuous body stream (ground truth), by cut
  const cuts = [0];           // downbeat cut sample positions in the raw stream
  let cursor = 0, acc = [], accFrames = 0, segIdx = 0, tRender = 0;
  let prevTailL = null, prevTailR = null;
  const emit = () => {
    const bodyN = accFrames;
    const bodyL = new Float32Array(bodyN), bodyR = new Float32Array(bodyN);
    let o = 0; for (const c of acc) { bodyL.set(c.L.subarray(0, c.length), o); bodyR.set(c.R.subarray(0, c.length), o); o += c.length; }
    // ground truth: append the CLEAN body to the raw stream
    rawL.push(bodyL); rawR.push(bodyR); cuts.push(cuts[cuts.length - 1] + bodyN);
    // clean tail (last OV) -> next head
    const tailN = Math.min(OV, bodyN);
    const nextTailL = bodyL.slice(bodyN - tailN), nextTailR = bodyR.slice(bodyN - tailN);
    // assemble [head?] ++ body, bake fades (mirrors stream-worker.js runLiveSegsPump.emit)
    const headN = prevTailL ? prevTailL.length : 0;
    const segLen = headN + bodyN;
    const L = new Float32Array(segLen), R = new Float32Array(segLen);
    if (headN) { L.set(prevTailL, 0); R.set(prevTailR, 0); }
    L.set(bodyL, headN); R.set(bodyR, headN);
    if (headN) fadeIn(L, R, Math.min(OV, segLen));
    else fadeIn(L, R, Math.min(ME, segLen));   // boot seg0 (bridgeIn=false in a stable-state test)
    fadeOut(L, R, segLen - Math.min(OV, segLen), Math.min(OV, segLen));
    segs.push({ L, R, frames: segLen, headN, bodyN });
    prevTailL = nextTailL; prevTailR = nextTailR;
    acc = []; accFrames = 0; segIdx++;
  };
  while (segs.length < nSegs) {
    const r = walk();
    await eng.feedBar({ units: r.units, events: r.events, fxParams: r.fxParams, spb: r.spb, lo: r.lo, hi: r.hi,
      sweeps: r.sweepsRaw, found: r.found, foundCi: r.meta.ci, meta: r.meta });
    const t0 = Date.now();
    const c = eng.renderChunk(cursor);
    tRender += Date.now() - t0;
    acc.push({ L: c.L, R: c.R, length: c.length }); accFrames += c.length; cursor++;
    if (accFrames >= (segIdx === 0 ? FIRST_SEG_SEC : SEG_SEC) * SR) emit();
  }
  eng.close();
  // stitch the raw ground-truth stream
  const total = cuts[cuts.length - 1];
  const RL = new Float32Array(total), RR = new Float32Array(total);
  { let o = 0; for (let i = 0; i < rawL.length; i++) { RL.set(rawL[i], o); RR.set(rawR[i], o); o += rawL[i].length; } }
  return { segs, raw: { L: RL, R: RR }, cuts, tRenderMs: tRender };
}

function rmsOf(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length)); }

// render `nFlushes` CLEAN PCM flushes (no fades) of a state — the v3 producer output.
async function renderRawFlushes(state, buffers, speech, nFlushes, flushSec) {
  const env = { E, SE, FP, SP, mergeIvals: RCORE.mergeIvals, mkProc: press.mkProc, rootOf: press.rootOf,
    SR, BS, dx7Presets: press.loadDx7Presets() };
  const eng = makeStreamEngine(env);
  await eng.open(state, { buffers: {}, opts: { dur: 0.0001 } }); eng.close();   // warm mkProc cache
  await eng.openLive(state, { buffers: buffers || {}, speech: speech || null, bakeNative: true });
  const walk = makeWalk(() => state);
  const flushes = []; let cursor = 0, acc = [], accFrames = 0, tRender = 0;
  const emit = () => { const n = accFrames, L = new Float32Array(n), R = new Float32Array(n); let o = 0;
    for (const c of acc) { L.set(c.L.subarray(0, c.length), o); R.set(c.R.subarray(0, c.length), o); o += c.length; }
    flushes.push({ L, R, n }); acc = []; accFrames = 0; };
  while (flushes.length < nFlushes) {
    const r = walk();
    await eng.feedBar({ units: r.units, events: r.events, fxParams: r.fxParams, spb: r.spb, lo: r.lo, hi: r.hi,
      sweeps: r.sweepsRaw, found: r.found, foundCi: r.meta.ci, meta: r.meta });
    const t0 = Date.now(); const c = eng.renderChunk(cursor); tRender += Date.now() - t0;
    acc.push({ L: c.L, R: c.R, length: c.length }); accFrames += c.length; cursor++;
    if (accFrames >= flushSec * SR) emit();
  }
  eng.close();
  return { flushes, tRenderMs: tRender };
}

// walk a raw MP3 byte stream frame-by-frame (MPEG1 Layer III). Returns {frames, ok, bytesCovered,
// srIdxSet}. A continuous single-encoder stream is fully covered by consecutive valid frames whose
// sample-rate index never changes; an encoder reset would break sync or change the header mid-stream.
function walkMp3(buf) {
  const BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];   // MPEG1 L3 kbps
  const SRS = [44100, 48000, 32000, 0];
  let o = 0, frames = 0; const srIdxSet = new Set(); let ok = true;
  while (o + 4 <= buf.length) {
    if (buf[o] !== 0xFF || (buf[o + 1] & 0xE0) !== 0xE0) { ok = false; break; }   // frame sync
    const brIdx = (buf[o + 2] >> 4) & 0x0F, srIdx = (buf[o + 2] >> 2) & 0x03, pad = (buf[o + 2] >> 1) & 0x01;
    const brate = BR[brIdx], srate = SRS[srIdx];
    if (!brate || !srate) { ok = false; break; }
    srIdxSet.add(srIdx);
    const len = ((144 * brate * 1000 / srate) | 0) + pad;
    if (len <= 0) { ok = false; break; }
    o += len; frames++;
  }
  return { frames, ok, bytesCovered: o, total: buf.length, srIdxSet: [...srIdxSet] };
}

async function main() {
  const state = GK.track("spokenword", { seed: 7 });
  const sched = SE.buildSchedule(E, state);
  const totalSec = sched.totalBeats * (60 / state.bpm);
  const { buffers, speech } = await press.decodeInputs(state, sched, { TOTAL: Math.ceil(totalSec * SR) });
  console.log(`decoded ${Object.keys(buffers).length} buffers, speech ${speech ? speech.length : 0}; found evts ${sched.found.length}`);

  // ── full mix (found + sampler + synth) ──
  const t0 = Date.now();
  const full = await renderSegs(state, buffers, speech, 4);
  const fullWall = Date.now() - t0;
  // ── synth-only (no buffers) ──
  const bare = await renderSegs(state, {}, null, 4);

  // Gate 1 (v2): the ALIGNED OVERLAP of each interior seam reconstructs the continuous
  // stream (constant-gain unity), and each head/tail equals raw*fade (baked fades present).
  // Interior seams: k>=0 paired with k+1 whose head is the OV duplicate (headN==OV).
  const raw = full.raw, cuts = full.cuts;
  let reconMax = 0, fadeMax = 0, unityMax = 0, seams = 0;
  for (let k = 0; k < full.segs.length - 1; k++) {
    const a = full.segs[k], b = full.segs[k + 1];
    if (b.headN !== OV) continue;              // only OV-overlap seams (skip boot->seg1 if micro)
    seams++;
    const cut = cuts[k + 1];                   // downbeat: overlap window is [cut-OV, cut)
    for (let j = 0; j < OV; j++) {
      const rj = raw.L[cut - OV + j];
      const gin = (j + 0.5) / OV, gout = (OV - 0.5 - j) / OV;
      const tail = a.L[a.frames - OV + j];     // segment k tail (fade-out)
      const head = b.L[j];                     // segment k+1 head (fade-in), identical content
      reconMax = Math.max(reconMax, Math.abs(tail + head - rj));          // overlap-add == raw
      fadeMax = Math.max(fadeMax, Math.abs(head - rj * gin), Math.abs(tail - rj * gout));  // baked fades
      unityMax = Math.max(unityMax, Math.abs(gin + gout - 1));            // gains sum to unity
    }
  }
  const EPS = 2e-4;
  const seamOk = seams >= 3 && reconMax < EPS && fadeMax < EPS && unityMax < 1e-9;
  console.log(`overlap: ${seams} OV-seams, recon |Δ| ${reconMax.toExponential(2)}, fade |Δ| ${fadeMax.toExponential(2)}, gain-unity |Δ| ${unityMax.toExponential(2)} (eps ${EPS})`);

  // Gate 2: full-mix presence — full render differs from + carries more energy than bare.
  const fullRms = full.segs.map((s) => rmsOf(s.L));
  const bareRms = bare.segs.map((s) => rmsOf(s.L));
  const fullMean = fullRms.reduce((a, b) => a + b, 0) / fullRms.length;
  const bareMean = bareRms.reduce((a, b) => a + b, 0) / bareRms.length;
  // energy difference between the two renders' first segment (they must not be identical)
  let diff = 0; { const a = full.segs[0].L, b = bare.segs[0].L, n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) diff += Math.abs(a[i] - b[i]); diff /= n; }
  const presenceOk = fullMean > bareMean * 1.05 && diff > 1e-4;
  console.log(`full RMS mean ${fullMean.toFixed(4)}, synth-only RMS mean ${bareMean.toFixed(4)}, per-sample |Δ| ${diff.toExponential(2)}`);

  // Gate 4: render rate — wall ms per segment vs. audio seconds per segment.
  const audioSec = full.segs.reduce((a, s) => a + s.frames, 0) / SR;
  const rate = (full.tRenderMs / 1000) / audioSec;   // <1/3 required
  console.log(`render: ${full.tRenderMs} ms for ${audioSec.toFixed(1)}s audio (${full.segs.length} segs) -> ${(rate * 100).toFixed(1)}% of realtime (budget 33%); wall incl. decode ${fullWall} ms`);
  const rateOk = rate < 1 / 3;

  // ── Gate 5 (v3): the SINGLE MP3 encoder keeps up AND emits a CONTINUOUS stream
  // across a gen bridge blend. Render two gens' clean PCM (jungle -> house), push them
  // through ONE makeMp3Stream (gen A boot+normal, then gen B seg0 as a bridge crossfade
  // against A's held tail, then B normal), measure render+encode wall time, and byte-walk
  // the concatenated MP3 to prove one unbroken frame stream (no encoder reset mid-way).
  const FLUSH_SEC = 2;
  const stJ = GK.track("jungle", { seed: 3 });
  const stH = GK.track("house", { seed: 3 });
  const decJ = await (async () => { const s = SE.buildSchedule(E, stJ); const sec = s.totalBeats * (60 / stJ.bpm); return press.decodeInputs(stJ, s, { TOTAL: Math.ceil(sec * SR) }); })();
  const decH = await (async () => { const s = SE.buildSchedule(E, stH); const sec = s.totalBeats * (60 / stH.bpm); return press.decodeInputs(stH, s, { TOTAL: Math.ceil(sec * SR) }); })();
  const genA = await renderRawFlushes(stJ, decJ.buffers, decJ.speech, 4, FLUSH_SEC);
  const genB = await renderRawFlushes(stH, decH.buffers, decH.speech, 4, FLUSH_SEC);
  const mp3 = makeMp3Stream({ lamejs, SR, kbps: 192, overlapSamples: OV });
  const chunks = []; let encFramesTotal = 0, allNonzero = true, tEnc = 0, encPushes = 0;
  const pushOne = (fl, flags) => { const t0 = Date.now(); const r = mp3.push(fl.L, fl.R, flags); tEnc += Date.now() - t0;
    encPushes++; if (r.encFrames > 0 && r.bytes.length === 0) allNonzero = false; encFramesTotal += r.encFrames; if (r.bytes.length) chunks.push(Buffer.from(r.bytes)); };
  genA.flushes.forEach((fl, i) => pushOne(fl, { boot: i === 0 }));
  genB.flushes.forEach((fl, i) => pushOne(fl, i === 0 ? { bridge: true } : {}));
  { const t = mp3.tail(); if (t.length) chunks.push(Buffer.from(t)); }
  const mp3buf = Buffer.concat(chunks);
  const walk = walkMp3(mp3buf);
  const audioSecMp3 = encFramesTotal / SR;
  const renderMs = genA.tRenderMs + genB.tRenderMs;
  const combinedRate = ((renderMs + tEnc) / 1000) / audioSecMp3;   // render + encode, < 1/3 required
  const encRate = (tEnc / 1000) / audioSecMp3;
  const coverFrac = walk.bytesCovered / walk.total;
  console.log(`mp3: ${encPushes} pushes (incl. 1 gen bridge), ${mp3buf.length} bytes, ${walk.frames} frames, sr-idx ${JSON.stringify(walk.srIdxSet)}, covered ${(coverFrac * 100).toFixed(2)}% (sync ${walk.ok})`);
  console.log(`mp3 encode: ${tEnc} ms for ${audioSecMp3.toFixed(1)}s -> ${(encRate * 100).toFixed(1)}% realtime; render+encode ${(combinedRate * 100).toFixed(1)}% (budget 33%)`);
  const streamContinuous = walk.ok && walk.frames > 0 && allNonzero && walk.srIdxSet.length === 1 && coverFrac > 0.999;
  const mp3RateOk = combinedRate < 1 / 3;
  const gate5Ok = streamContinuous && mp3RateOk;

  console.log(`GATE 1 seam-continuity: ${seamOk ? "PASS" : "FAIL"}`);
  console.log(`GATE 2 full-mix-presence: ${presenceOk ? "PASS" : "FAIL"}`);
  console.log(`GATE 4 render-keeps-up: ${rateOk ? "PASS" : "FAIL"}`);
  console.log(`GATE 5 mp3-encode+bridge-continuity: ${gate5Ok ? "PASS" : "FAIL"} (continuous ${streamContinuous}, rate ${mp3RateOk})`);
  const pass = seamOk && presenceOk && rateOk && gate5Ok;
  console.log(pass ? "WAVOUT SEAM/MIX/RATE: PASS" : "WAVOUT SEAM/MIX/RATE: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
