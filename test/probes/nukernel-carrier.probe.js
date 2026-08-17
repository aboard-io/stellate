#!/usr/bin/env node
// test/probes/nukernel-carrier.probe.js — WHAT COMES OUT OF THE ELEMENT, in
// milliseconds and in samples.
//
//   node test/probes/nukernel-carrier.probe.js
//
// nukernel/audio/stream-carrier.js takes rendered segments and appends them to
// ONE <audio> element as fMP4 fragments. Reading that code proves nothing: the
// three defects this design exists to prevent are all invisible in a diff and
// all obvious in the decoded output — a gap at a join, a click at a join, and a
// timestamp drift that only shows up after half a minute (the device report
// that started it: "the snare and the lead and bass go out of whack over time").
//
// So this instrument DECODES WHAT THE ELEMENT ACTUALLY PLAYS. A
// MediaElementSource + a ScriptProcessor tap captures the element's own output
// — past the muxer, past the demuxer, past the decoder — and the numbers below
// are measured on those samples. It is the rig test/probes/nukernel-return.probe.js
// established (serve + chromium + an init-script tap + an analysis that reports
// ms AND samples), pointed at the seam instead of at the handback.
//
// THE SIGNAL IS THE MEASUREMENT. The synthetic producer emits one continuous
// 480 Hz sine — exactly 100 samples per cycle at 48 kHz — cut into overlapping
// segments with the crossfade baked in, EXACTLY as the contract says a real
// renderer does. It stays phase-continuous across the generation change on
// purpose: a real producer's new generation is different music, but this one's
// job is to make any defect the CARRIER adds stand out against a signal that
// has none. Three things are then readable without aligning anything:
//
//   PHASE SLIP  — a dropped or inserted sample shifts the sine's phase by
//                 exactly that many samples. Measured at the start and at the
//                 end of a 30 s+ run, it is the total drift, in samples.
//   SAMPLE STEP — the largest |x[i+1]-x[i]| anywhere, against the sine's own
//                 analytic maximum. A butt-splice or a decoder flush is a step
//                 the signal cannot make.
//   SILENT RUN  — a gap is samples of nothing. Reported in ms and samples.
//
// and, with the carrier's own ledger, the step AT each join against the step
// distribution WITHIN segments — the comparison that says whether a join is
// distinguishable from ordinary audio at all.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const RUN_MS = +(process.env.RUN_MS || 36000);

// the harness page. Fulfilled by page.route so nothing is committed to the web
// root for it; the ORIGIN is still the harness server, which is what lets the
// page import /nukernel/audio/stream-carrier.js as a module.
const PAGE = `<!doctype html><meta charset=utf-8><title>carrier probe</title>
<body><button id=go>go</button><script type=module>
import { makeStreamCarrier } from "/nukernel/audio/stream-carrier.js";

const SR = 48000, F = 480;              // 100 samples per cycle, exactly
const BAR = SR / 2;                     // 120 bpm, 4/4 -> half a second a bar
const OV = Math.round(SR * 0.12);       // 120 ms of baked overlap, WAV-FIRST v2
const SONG_BARS = 64;

// the producer: one continuous sine, cut into overlapping segments with linear
// fades baked in at both ends. Within a generation the two overlapping windows
// are the SAME audio, and a linear pair is what sums to unity there — the
// carrier adds whatever it is handed and holds no opinion about the shape.
function renderSegment({ fromBar, bars, gen }) {
  const n = bars * BAR + OV;            // a segment covers bars*BAR of ground
  const from = fromBar * BAR - (fromBar > 0 ? OV : 0);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let g = 1;
    // the pair sums to one at the same relative index — head i/OV against the
    // tail's 1 - i/OV. Anything else leaves a 1/OV notch at every join, which
    // would be the probe measuring its own arithmetic instead of the carrier's.
    if (fromBar > 0 && i < OV) g = i / OV;
    if (i >= n - OV) g = 1 - (i - (n - OV)) / OV;
    const v = Math.sin(2 * Math.PI * F * (from + i) / SR) * 0.7 * g;
    L[i] = v; R[i] = v;
  }
  const endsSong = fromBar + bars >= SONG_BARS;
  return Promise.resolve({ pcm: [L, R], sampleRate: SR, fromBar, bars, gen,
                           overlap: OV, endsSong });
}

const el = new Audio();
el.autoplay = false; el.preload = "auto"; el.playsInline = true;
try { el.disableRemotePlayback = true; } catch (e) {}
document.body.appendChild(el);
// a REBUFFER is not a seam, and telling them apart is the difference between a
// boot problem and the drift this whole design is written against
const ev = { waiting: 0, stalled: 0 };
for (const k of ["waiting", "stalled"]) el.addEventListener(k, () => ev[k]++);

const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
const blocks = [];
let capturing = false, capT0 = null;
const src = ctx.createMediaElementSource(el);
const sp = ctx.createScriptProcessor(16384, 2, 2);
sp.onaudioprocess = e => {
  const d = e.inputBuffer.getChannelData(0);
  if (!capturing) return;
  if (capT0 === null) capT0 = el.currentTime;      // stream time at the first block
  blocks.push(new Float32Array(d));
};
src.connect(sp); sp.connect(ctx.destination); src.connect(ctx.destination);

const carrier = makeStreamCarrier({ el, renderSegment, bars: 4, firstBars: 1,
                                    ahead: 2, sampleRate: SR,
                                    session: { title: "carrier probe", artist: "stellate nukernel" } });
window.__probe = {
  SR, F, OV, BAR,
  async start() {
    await ctx.resume();
    const route = await carrier.start({ gen: 0, fromBar: 0, sampleRate: SR });
    return route;
  },
  capture(on) { capturing = on; if (on) { blocks.length = 0; capT0 = null; } },
  // THE CLOCK IS READ BESIDE THE PLAYHEAD, in the same statement, in the page.
  // Timing el.currentTime against a wall clock in node measures the evaluate
  // round-trip as well as the stream, and the round-trip is not steady while the
  // main thread is building a segment — it reported a 393 ms deficit against a
  // stream whose phase had not slipped by one sample, which is a contradiction
  // and was the instrument's, not the carrier's.
  stats: () => ({ ...carrier.stats(), ...ev, readyState: el.readyState,
                  pageMs: performance.now() }),
  joins: () => carrier.joins(),
  capStart: () => capT0,
  retarget: g => carrier.retarget(g, 0),
  session: () => (navigator.mediaSession ? {
    state: navigator.mediaSession.playbackState,
    title: navigator.mediaSession.metadata ? navigator.mediaSession.metadata.title : null } : null),

  // the analysis, done in the page so 1.7M samples never cross the wire
  analyse(joinTimes) {
    let n = 0; for (const b of blocks) n += b.length;
    const x = new Float32Array(n);
    { let o = 0; for (const b of blocks) { x.set(b, o); o += b.length; } }

    // 1. PHASE SLIP. Quadrature-demodulate one 0.25 s window near each end and
    // unwrap the phase difference against the number of cycles between them; the
    // residue IS the slip, in samples.
    const W = SR / 4;
    const phaseAt = k => {
      let re = 0, im = 0;
      for (let i = 0; i < W; i++) {
        const t = 2 * Math.PI * F * (k + i) / SR;
        re += x[k + i] * Math.cos(t); im += x[k + i] * Math.sin(t);
      }
      return Math.atan2(im, re);
    };
    const kA = Math.round(SR * 1.5), kB = n - W - Math.round(SR * 0.5);
    const spanSec = (kB - kA) / SR;
    let dphi = phaseAt(kB) - phaseAt(kA);
    while (dphi > Math.PI) dphi -= 2 * Math.PI;
    while (dphi < -Math.PI) dphi += 2 * Math.PI;
    const slipSamples = -dphi / (2 * Math.PI) * (SR / F);

    // 2. STEPS. The whole distribution, then the joins specifically.
    const analytic = 0.7 * 2 * Math.sin(Math.PI * F / SR);
    const steps = new Float32Array(n - 1);
    let worst = 0, worstAt = 0;
    for (let i = 1; i < n; i++) {
      const s = Math.abs(x[i] - x[i - 1]);
      steps[i - 1] = s;
      if (s > worst) { worst = s; worstAt = i; }
    }
    const sorted = Float32Array.from(steps).sort();
    const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

    // 3. SILENT RUNS — the gap, if there is one.
    let run = 0, longest = 0, longestAt = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(x[i]) < 1e-4) { run++; if (run > longest) { longest = run; longestAt = i - run; } }
      else run = 0;
    }

    // 4. THE JOINS, located by the stream time the carrier's ledger recorded.
    // capT0 is the element's currentTime at the first captured block, so
    // capture index = (joinTime - capT0) * SR. A few ms of block latency is
    // inside the +/-6 ms window searched.
    const at = [];
    for (const t of joinTimes) {
      const k = Math.round((t - capT0) * SR);
      if (k < SR * 0.2 || k > n - SR * 0.2) continue;
      let m = 0, mi = 0;
      for (let i = k - Math.round(SR * 0.006); i < k + Math.round(SR * 0.006); i++)
        if (steps[i] > m) { m = steps[i]; mi = i; }
      at.push({ t: +t.toFixed(3), step: +m.toFixed(6), off: mi - k });
    }
    // 5. WHERE the slip went, if it went anywhere: the phase measured once a
    // second and unwrapped. A drift shows as a ramp (fact 1 coming back); a
    // decoder hiccup shows as one step in one second and flat either side. The
    // two are different bugs and the shape is the only thing that separates them.
    const prof = [];
    for (let k = Math.round(SR * 0.6); k + W < n; k += SR) {
      let ph = phaseAt(k) - 2 * Math.PI * F * k / SR;
      prof.push(ph);
    }
    let acc = 0; const slipProf = [0];
    for (let i = 1; i < prof.length; i++) {
      let d = prof[i] - prof[i - 1];
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      acc += -d / (2 * Math.PI) * (SR / F);
      slipProf.push(+acc.toFixed(2));
    }
    // the biggest steps anywhere, with their positions, so a one-off is namable
    const marks2 = [];
    for (let i = 1; i < n; i++) if (steps[i - 1] > analytic * 1.5) marks2.push({ i, s: +steps[i - 1].toFixed(4) });
    marks2.sort((p, q2) => q2.s - p.s);

    return { n, capT0, analytic: +analytic.toFixed(6), slipProf, big: marks2.slice(0, 8),
             slipSamples: +slipSamples.toFixed(3), slipMs: +(slipSamples / SR * 1000).toFixed(4),
             spanSec: +spanSec.toFixed(2),
             worst: +worst.toFixed(6), worstAt,
             p50: +q(0.5).toFixed(6), p99: +q(0.99).toFixed(6), p999: +q(0.999).toFixed(6),
             silentSamples: longest, silentMs: +(longest / SR * 1000).toFixed(2), silentAt: longestAt,
             joins: at };
  },
};
document.getElementById("go").onclick = () => window.__probe.start();
</script>`;

(async () => {
  const srv = await serve(ROOT, 8985);
  const PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage();
  const errors = capturePageErrors(page);
  await page.route("**/__carrier-probe.html", r =>
    r.fulfill({ status: 200, contentType: "text/html", body: PAGE }));
  await page.goto(`http://localhost:${PORT}/__carrier-probe.html`, { waitUntil: "load" });

  const route = await page.evaluate(() => window.__probe.start());
  console.log("route:", route);

  // let the stream settle (first append, first sound), THEN capture — the
  // measurement is about steady state, and the boot has its own numbers
  await page.waitForFunction(() => window.__probe.stats().elTime > 0.4, null, { timeout: 20000 });
  const boot = await page.evaluate(() => window.__probe.stats());
  console.log(`boot: first append ${boot.firstAppendMs} ms, first sound ${boot.firstSoundMs} ms`);
  await page.evaluate(() => window.__probe.capture(true));

  const t0 = Date.now();
  const marks = [];
  let retargeted = false;
  while (Date.now() - t0 < RUN_MS) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => window.__probe.stats());
    marks.push({ wall: (Date.now() - t0) / 1000, ...s });
    if (!retargeted && Date.now() - t0 > RUN_MS * 0.45) {
      retargeted = true;
      await page.evaluate(() => window.__probe.retarget(1));
      console.log("retarget: generation 1 requested at " +
                  ((Date.now() - t0) / 1000).toFixed(1) + " s");
    }
  }
  await page.evaluate(() => window.__probe.capture(false));

  const joins = await page.evaluate(() => window.__probe.joins());
  const a = await page.evaluate(j => window.__probe.analyse(j),
                                joins.map(j => j.t));
  const end = await page.evaluate(() => window.__probe.stats());
  const sess = await page.evaluate(() => window.__probe.session());

  const SR = 48000;
  console.log("");
  console.log("=== what the element played ===");
  console.log(`captured ${a.n} samples (${(a.n / SR).toFixed(2)} s) off the element`);
  console.log(`largest silent run   ${a.silentMs} ms / ${a.silentSamples} samples` +
              (a.silentSamples ? ` at sample ${a.silentAt}` : ""));
  console.log(`phase slip over ${a.spanSec} s   ${a.slipSamples} samples / ${a.slipMs} ms`);
  console.log(`largest sample step  ${a.worst} at ${a.worstAt}  (the sine's own max is ${a.analytic})`);
  console.log(`within-segment steps p50 ${a.p50}  p99 ${a.p99}  p99.9 ${a.p999}`);
  console.log(`capture began at stream t=${(a.capT0 || 0).toFixed(3)} s`);
  console.log(`steps over 1.5x the signal's max: ${a.big.length}` +
              (a.big.length ? "  " + a.big.map(b => `${(b.i / SR + (a.capT0 || 0)).toFixed(3)}s:${b.s}`).join(" ") : ""));
  console.log(`cumulative slip, one reading a second: ${a.slipProf.join(" ")}`);
  console.log("");
  console.log(`joins measured: ${a.joins.length} of ${joins.length} in the capture window`);
  for (const j of a.joins.slice(0, 12))
    console.log(`  join @ ${j.t}s   max step ${j.step}` +
                `   ${(j.step / a.p999).toFixed(2)}x the within-segment p99.9`);
  const jmax = a.joins.reduce((m, j) => Math.max(m, j.step), 0);
  console.log(`worst join step ${jmax.toFixed(6)} vs p99.9 ${a.p999} ` +
              `(${(jmax / a.p999).toFixed(2)}x) and the analytic max ${a.analytic}`);
  console.log("");
  console.log("=== timestamp drift ===");
  const first = marks[0], last = marks[marks.length - 1];
  const wall = (last.pageMs - first.pageMs) / 1000, played = last.elTime - first.elTime;
  console.log(`element currentTime advanced ${played.toFixed(3)} s over ${wall.toFixed(3)} s of ` +
              `page clock — ${((played - wall) * 1000).toFixed(1)} ms apart`);
  console.log(`element rebuffers: ${last.waiting} waiting, ${last.stalled} stalled`);
  let worstStitch = 0;
  for (const m of marks) worstStitch = Math.max(worstStitch, Math.abs(m.stitchDriftSec || 0));
  console.log(`stitchDrift (muxed samples - demuxer's buffered end): worst ` +
              `${worstStitch.toFixed(6)} s over ${marks.length} readings`);
  console.log(`muxed ${end.muxedSec} s vs fed ${end.fedSec} s vs buffered end ${end.bufferedEnd} s`);
  console.log(`segments ${end.segments}  fragments ${end.pushes}  appends ${end.appends}  ` +
              `loops ${end.loops}  unplayed ${end.unplayed}  gen playing ${end.playingGen}`);
  console.log(`mediaSession: ${JSON.stringify(sess)}`);
  if (end.errors.length) console.log("errors:", end.errors);
  if (errors.length) console.log("page errors:", errors.slice(0, 6));

  await browser.close();
  srv.close();
})().catch(e => { console.error("FAIL:", (e && e.stack) || e); process.exit(1); });
