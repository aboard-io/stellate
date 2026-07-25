#!/usr/bin/env node
// test/crossfade-seam-run.js — THE CROSSFADE SEAM GATE.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/crossfade-seam-run.js
//
// The gate hole that let docs/TIMING-AUDIT-2026-07 finding 2 live for months:
// test/live-test-run.js does ONE swap and asserts RMS non-zero + loadRatio >= 0.97.
// Both of those pass straight through a total dropout — the runway is HEALTHY while
// the ring is dry (measured: 3.4–27 s of runway, loadRatio 1.00, through 3437
// underrun quanta), and 300 ms of digital silence does not move a 500 ms-poll RMS
// average. Nothing anywhere watched the seam itself. So this gate steers REPEATEDLY
// and watches the join, on three independent instruments:
//
//   (1) C_UNDER_CNT — the ring reader's own count of quanta that ran dry. Every
//       steer used to spend one full 400 ms ramp with the OUTGOING ring dry
//       (16 of 19 swaps landed on exactly 138 quanta), because the fade anchors on
//       a bar boundary and, with the play queue empty, that boundary IS the end of
//       the last fed bar. Contract: a crossfade window costs ~no underruns.
//   (2) an AudioWorklet on handle.analyser that sees EVERY sample of the master —
//       runs of exact zeros while the program is loud, and the near-full-scale
//       sample-to-sample jumps at their edges. Contract: none, ever.
//   (3) the native lane's scheduling anchor. `commitFade` used to publish the
//       incoming stream's bar 0 onto an anchor that the whole ramp had already
//       run past, so its first ~450 ms of drums were handed to
//       AudioBufferSourceNode.start() with `when` in the PAST and clumped at `now`
//       — 19 bars over 300 ms late across 19 swaps, one per steer. Contract: a
//       bar's native notes are never anchored behind their instant.
//
// Runs against test/live-test.html on the desktop ring path (?wavOut=0).
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.join(__dirname, "..");
const PORT = 8947;
const GENRES = ["jungle", "house", "dub", "ambient", "jazz", "vaporwave", "techno", "bossanova", "citypop"];
const HOLD_SEC = 14;          // ride each genre this long (>= one bridge + a couple of bars)
const SWAPS = 8;              // steers per run

// ── contracts ──────────────────────────────────────────────────────────────
// Underrun quanta allowed per crossfade. One quantum is 2.9 ms and a fully dry
// 400 ms ramp is 138, so this says: at least three quarters of every ramp is
// carried by real outgoing audio. HEAD spends the WHOLE ramp dry on every steer
// (measured 135–165 quanta each, plus multi-second dry stretches when the bridge
// primes slowly), so it fails this by 4× on every crossfade. The residual this
// budget covers is the tail-cap floor under CPU oversubscription: the outgoing
// stream has by then decayed to silence, so those quanta are counted, not heard —
// and the output tap below is the check that they were not.
const FADE_UNDER_BUDGET = 34;
                              // THIS is the contract this gate exists for. Ring
                              // starvation in STEADY state is a different failure —
                              // the producer falling behind a reader that ran ahead,
                              // which a loaded box does to HEAD and to this build
                              // alike — so the ride total is REPORTED, not asserted.
const LATE_P90_MS = 20;       // the body of the anchor distribution is never late
const LATE_MAX_MS = 350;      // and no bar carries the old ~450ms per-steer overdue
const LATE_OVER_100_MAX = 1;  // …with at most one jank outlier over 100ms
const RMS_FLOOR = 0.005;

// the tap: one worklet, every sample of the post-mastering master.
const TAP_SRC = `
class SeamTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frames = 0; this.zr = 0; this.prev = 0; this.env = 0;
    this.gaps = []; this.maxJump = 0; this.jumps = 0;
    this.win = 0; this.winSum = 0; this.quiet = 0; this.windows = 0;
    this.port.onmessage = () => this.port.postMessage({ frames: this.frames, gaps: this.gaps,
      maxJump: this.maxJump, jumps: this.jumps, quiet: this.quiet, windows: this.windows });
  }
  process(inputs) {
    const inp = inputs[0]; const ch = inp && inp.length ? inp[0] : null;
    if (!ch) return true;
    const n = ch.length;
    for (let i = 0; i < n; i++) {
      const x = ch[i];
      const d = Math.abs(x - this.prev); this.prev = x;
      if (d > this.maxJump) this.maxJump = d;
      if (d > 0.5) this.jumps++;
      this.env = 0.9995 * this.env + 0.0005 * x * x;
      if (Math.abs(x) < 1e-7) this.zr++;
      else {
        // a run of >=64 exact zeros while the program was LOUD is a dropout, not a rest
        if (this.zr >= 64 && this.env > 1e-4 && this.gaps.length < 64)
          this.gaps.push({ at: +((this.frames + i - this.zr) / sampleRate).toFixed(3), len: this.zr, edge: +d.toFixed(3), rms: +Math.sqrt(this.env).toFixed(4) });
        this.zr = 0;
      }
      this.winSum += x * x; this.win++;
      if (this.win >= 4410) { this.windows++; if (Math.sqrt(this.winSum / this.win) < 0.01) this.quiet++; this.win = 0; this.winSum = 0; }
    }
    this.frames += n;
    return true;
  }
}
registerProcessor("seam-tap", SeamTap);
`;

const q = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const pageErrors = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/test/live-test.html?wavOut=0`);

  // FALLBACK INSTRUMENT: on a build without handle.__barAnchors() the bar's native
  // notes are scheduled at the same instant onBar fires, so `ctx.currentTime - when`
  // read here IS the native anchor lateness. (With the lookahead, onBar and the
  // native arming are decoupled and __barAnchors is the truth; this keeps the gate
  // able to judge an older engine on the same terms.)
  await page.evaluate(() => {
    window.__SEAM = { bars: [], swaps: [], under: [] };
    const orig = FaustLive.exploreLive;
    FaustLive.exploreLive = function (gs, os, opts) {
      const ob = opts && opts.onBar;
      opts.onBar = (b) => {
        const c = window.handle && window.handle.ctx;
        if (c) window.__SEAM.bars.push({ serial: b.serial, lateMs: (c.currentTime - b.when) * 1000 });
        if (ob) ob(b);
      };
      return orig.apply(this, arguments);
    };
  });

  await page.evaluate((g) => window.goLive(g, 3), GENRES[0]);
  await page.waitForFunction(() => window.handle && window.handle.ctx, { timeout: 60000 });
  await page.evaluate(async (src) => {
    const h = window.handle, ctx = h.ctx;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    await ctx.audioWorklet.addModule(url);
    const tap = new AudioWorkletNode(ctx, "seam-tap", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const sink = ctx.createGain(); sink.gain.value = 0;
    h.analyser.connect(tap); tap.connect(sink); sink.connect(ctx.destination);
    window.__TAP = tap;
    tap.port.onmessage = (e) => { window.__SEAM.tap = e.data; };
    window.__T0 = performance.now() / 1000;
    window.__pollT = setInterval(() => {
      window.__SEAM.under.push({ t: performance.now() / 1000 - window.__T0, u: h.underruns(),
        rw: +h.runwaySec().toFixed(2), lr: +h.loadRatio().toFixed(3), rms: +h.rms().toFixed(4) });
    }, 100);
  }, TAP_SRC);

  for (let i = 0; i < SWAPS; i++) {
    await page.waitForTimeout(HOLD_SEC * 1000);
    const g = GENRES[(i + 1) % GENRES.length];
    await page.evaluate((gg) => {
      window.__SEAM.swaps.push({ t: performance.now() / 1000 - window.__T0, genre: gg,
        bars: window.__SEAM.bars.length, u: window.handle.underruns() });
      window.swapTo(gg, 3);
    }, g);
    process.stdout.write(`  steer ${i + 1}/${SWAPS} -> ${g}\n`);
  }
  await page.waitForTimeout(HOLD_SEC * 1000);

  await page.evaluate(() => window.__TAP.port.postMessage("report"));
  await page.waitForTimeout(500);
  const R = await page.evaluate(() => {
    clearInterval(window.__pollT);
    const h = window.handle;
    return { ...window.__SEAM,
      fades: h.__fades ? h.__fades() : null,
      anchors: h.__barAnchors ? h.__barAnchors() : null,
      clickMon: h.clickMon ? h.clickMon() : null,
      finalUnder: h.underruns(), errors: h.errors.slice() };
  });
  await page.evaluate(() => { try { window.stopLive(); } catch (e) {} });
  await page.waitForTimeout(300);
  await browser.close(); srv.close();

  // ───────────────────────────────────────────────────────────── judgement
  const fails = [];
  const U = R.under;
  const totalUnder = U.length ? U[U.length - 1].u - U[0].u : 0;

  // (1) underruns attributable to a crossfade — the window from the steer that
  // opens the bridge until well past the ramp it eventually runs.
  const WIN = 12;
  const perSwap = R.swaps.map((s) => {
    const a = U.filter((x) => x.t >= s.t && x.t <= s.t + WIN);
    return { genre: s.genre, at: +s.t.toFixed(1),
      d: a.length >= 2 ? a[a.length - 1].u - a[0].u : 0,
      rwMin: a.length ? Math.min(...a.map((x) => x.rw)) : null,
      lrMin: a.length ? Math.min(...a.map((x) => x.lr)) : null };
  });
  console.log("\nunderruns per steer window (quanta; one full dry 400ms ramp = 138):");
  for (const p of perSwap) console.log(`   ${String(p.at).padStart(6)}s -> ${p.genre.padEnd(10)} +${String(p.d).padStart(4)}   runway>=${p.rwMin}s load>=${p.lrMin}`);
  console.log(`total underrun quanta over the ride: ${totalUnder}`);
  // ATTRIBUTION. With the engine's own fade telemetry the seam is bounded exactly:
  // from the bridge opening to the commit. Without it (an older engine) fall back to
  // a wall-clock window after the steer, which necessarily also catches steady-state
  // producer starvation — acceptable there, because on that engine EVERY steer costs
  // a full dry ramp and the fallback is not what decides the verdict.
  if (!R.fades)
    for (const p of perSwap) if (p.d > FADE_UNDER_BUDGET) fails.push(`crossfade -> ${p.genre} @${p.at}s cost ${p.d} underrun quanta (budget ${FADE_UNDER_BUDGET})`);

  // (2) the output itself
  const T = R.tap || { gaps: [], frames: 0, maxJump: 0, jumps: 0, quiet: 0, windows: 0 };
  console.log(`\noutput tap: ${(T.frames / 44100).toFixed(1)}s seen | zero-runs>=64 while loud: ${T.gaps.length}` +
    ` | max sample jump ${(+T.maxJump).toFixed(3)} | near-silent 100ms windows ${T.quiet}/${T.windows}`);
  // the tap's clock and the steer log's clock both start at the tap install
  const nearSteer = (t) => R.swaps.some((s) => t >= s.t - 1 && t <= s.t + WIN);
  const seamGaps = T.gaps.filter((g) => nearSteer(g.at));
  for (const g of T.gaps.slice(0, 8)) console.log(`   DROPOUT at ${g.at}s${nearSteer(g.at) ? " [AT A STEER]" : " [steady state — producer starvation, not the seam]"}: ${g.len} zero samples (${(g.len / 44.1).toFixed(1)}ms), edge ${g.edge}, program rms ${g.rms}`);
  if (R.clickMon) console.log(`   clickMon: gaps ${R.clickMon.gaps}, clicks ${R.clickMon.clicks}, peakjump ${(+R.clickMon.peakjump).toFixed(3)} (tapped at the limiter output = the listener's signal)`);
  if (seamGaps.length) fails.push(`${seamGaps.length} dropout(s) AT A CROSSFADE: a run of >=64 exact zeros while the program was loud`);

  // (3) the native lane's anchor: never behind its instant
  const anchors = R.anchors && R.anchors.length ? R.anchors.map((a) => a.lateMs) : R.bars.map((b) => b.lateMs);
  const src = R.anchors && R.anchors.length ? "handle.__barAnchors()" : "onBar (fallback: same instant on an engine without a native lookahead)";
  const p50 = q(anchors, 0.5), p90 = q(anchors, 0.9), mx = Math.max(...anchors);
  console.log(`\nnative-lane anchor lateness via ${src}: n=${anchors.length} p50 ${p50.toFixed(1)}ms p90 ${p90.toFixed(1)}ms max ${mx.toFixed(1)}ms` +
    ` | >100ms: ${anchors.filter((v) => v > 100).length}`);
  const over100 = anchors.filter((v) => v > 100).length;
  if (!(anchors.length >= SWAPS)) fails.push(`only ${anchors.length} bars measured`);
  if (mx > LATE_MAX_MS) fails.push(`a bar's native lane was anchored ${mx.toFixed(0)}ms in the PAST (max ${LATE_MAX_MS}ms) — its notes clump at 'now' instead of landing on the grid`);
  if (over100 > LATE_OVER_100_MAX) fails.push(`${over100} bars anchored >100ms in the past (max ${LATE_OVER_100_MAX}) — the per-steer overdue bar is back`);
  if (p90 > LATE_P90_MS) fails.push(`native anchor p90 ${p90.toFixed(1)}ms late (max ${LATE_P90_MS}ms)`);

  // (4) the mechanism, when the engine reports it: the OUTGOING ring must hold
  // audio across the whole ramp, and the ramp itself must cost no underruns.
  if (R.fades) {
    console.log(`\ncrossfades: ${R.fades.length}`);
    for (const f of R.fades) console.log(`   anchor in ${f.waitSec}s | outgoing audio past the anchor ${f.wetSec}s (tail ${f.tailSec}s)` +
      ` | underruns: bridge+ramp ${f.under1 == null ? "?" : f.under1 - f.underOpen}, ramp ${f.under1 == null ? "?" : f.under1 - f.under0}`);
    if (R.fades.length < Math.floor(SWAPS / 2)) fails.push(`only ${R.fades.length} crossfades for ${SWAPS} steers — the ride never exercised the seam`);
    const RAMP = 0.4, RAMP_COVER = 0.75;   // …of the ramp must be carried by real outgoing audio
    for (const f of R.fades) {
      if (f.wetSec < RAMP * RAMP_COVER) fails.push(`a crossfade anchored with only ${f.wetSec}s of outgoing audio left — the ring is dry for ${(RAMP - f.wetSec).toFixed(2)}s of the ${RAMP}s ramp`);
      if (f.under1 == null) continue;
      if (f.under1 - f.under0 > FADE_UNDER_BUDGET) fails.push(`a ramp itself cost ${f.under1 - f.under0} underrun quanta`);
      if (f.under1 - f.underOpen > FADE_UNDER_BUDGET) fails.push(`a crossfade (bridge open -> commit) cost ${f.under1 - f.underOpen} underrun quanta (budget ${FADE_UNDER_BUDGET})`);
    }
  } else console.log("\ncrossfades: (engine exposes no __fades telemetry)");

  // (5) it has to have been playing
  const rms = U.map((x) => x.rms).filter((v) => v > 0);
  const loud = rms.filter((v) => v > RMS_FLOOR).length;
  console.log(`\nRMS: ${loud}/${U.length} polls above ${RMS_FLOOR}`);
  if (loud < U.length * 0.7) fails.push(`only ${loud}/${U.length} RMS polls were above the floor — the ride was not really playing`);
  const errs = [...R.errors, ...pageErrors];
  if (errs.length) fails.push(`${errs.length} engine/page errors: ${errs.slice(0, 4).join(" | ")}`);

  console.log("");
  if (fails.length) { for (const f of fails) console.log("  FAIL: " + f); console.log("CROSSFADE SEAM GATE: FAIL"); process.exit(1); }
  console.log("CROSSFADE SEAM GATE: PASS");
}
main().catch((e) => { console.error(e); process.exit(1); });
