#!/usr/bin/env node
// test/starcruise/starcruise-barcadence.test.js — the REAL-CADENCE continuity proof for the SCENE-agent
// rewrite (unified world + continuous camera). The old probes flipped the blend ONCE;
// the actual "lurch every ~8 measures" bug is that the app updates S.weights/travel in
// DISCRETE STEPS at BAR BOUNDARIES (app/audio/live.js onBar), and a first-order camera follow
// front-loads each step into a per-frame velocity SPIKE on the boundary frame.
//
// This drives the mode exactly like the live app — weights HELD constant within a bar,
// STEPPED at each bar boundary — over a full cruise -> descend -> land, and asserts:
//
//   1. NO CAMERA LURCH at any bar boundary — the camera move on a boundary frame is
//      <= the local median move (a critically-damped spring carries continuous velocity
//      across the step; a first-order follow would SPIKE to ~63% of the step on frame 0).
//   2. CONTINUOUS DESCENT — the camera->target distance decreases smoothly from a galaxy
//      value to a surface value with NO single-frame teleport (bounded max drop).
//   3. NO SCENE JUMP — the rendered frame changes CONTINUOUSLY: the per-frame frame-
//      signature (coarse luminance grid) delta stays bounded, so there is no whole-scene
//      swap/cut between the galaxy region and the surface region as we land.
//   4. LANDS ON A REAL PLANET — the unified scene puts a procedural planet ground under
//      the band (heightAt foot-plant), present through the descent (no pop-in).
//
//   node test/starcruise/starcruise-barcadence.test.js
"use strict";
const path = require("path");
const { serve, capturePageErrors, installOfflineRoute, ensureStarcruise } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", ".."), PORT = process.env.SC_PORT ? +process.env.SC_PORT : 8815;

async function launchGL() {
  const fs = require("fs");
  const { chromium } = require("playwright");
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  const args = ["--no-sandbox", "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist", "--enable-webgl"];
  const opts = { headless: true, args };
  if (fs.existsSync(exe)) opts.executablePath = exe;
  return chromium.launch(opts);
}

// median of an array (returns 0 for empty)
function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchGL();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });
  await installOfflineRoute(page, PORT, { neutralizeMain: true });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "commit" });
  await page.waitForFunction(() => !!document.getElementById("chips"), null, { timeout: 120000 });
  // the aliens controller is a DEFERRED import (index.html no longer loads it) —
  // arm it through the loader hook rather than polling for the global.
  await ensureStarcruise(page);
  await page.waitForTimeout(300);

  const GEN = await page.evaluate(() => {
    const gs = Object.keys((window.GenreKernel && window.GenreKernel.GENRES) || {});
    const G = gs[7] || gs[0] || "vaporwave";
    window.__S = { weights: [{ g: G, w: 1 }], waypoints: [{ x: 0, y: 0 }, { x: 120, y: 90 }],
      travel: { seg: 0, t: 0.5 }, seed: 1, live: true, playing: { bpm: 120 }, barInfo: null };
    return G;
  });
  await page.evaluate(() => window.__STARCRUISE.start());
  await page.waitForFunction(() => window.__STARCRUISE.isRunning() && window.__STARCRUISE.hasThree(), { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__STARCRUISE.__pauseLoop());

  // ==== 1. BAR-CADENCE camera continuity — no spike at ANY bar boundary ============
  // Drive a full cruise->descend->land as onBar does: pick a per-bar weights blend and
  // HOLD it for FRAMES_PER_BAR frames, then STEP to the next bar's blend. The dominant
  // FLIPS between bars AND the dominant weight RAMPS up (so we both pan across the map
  // and descend). We record the per-frame camera move and tag the boundary frames.
  const cad = await page.evaluate((GEN) => {
    const SC = window.__STARCRUISE;
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 1, beatPhase: 0, playing: true });
    // A realistic BAR SEQUENCE (like the live blend crossfading + settling on a genre):
    // deep-space multi-genre blends whose DOMINANT flips bar-to-bar, then dominance ramps
    // up on GEN so we descend and land. Each entry is one bar's S.weights.
    const bars = [
      { weights: [{ g: "ambient", w: 0.4 }, { g: "techno", w: 0.35 }, { g: "jazz", w: 0.25 }], dominant: "ambient" },
      { weights: [{ g: "techno", w: 0.42 }, { g: "gabber", w: 0.33 }, { g: "jazz", w: 0.25 }], dominant: "techno" },
      { weights: [{ g: "gabber", w: 0.45 }, { g: GEN, w: 0.3 }, { g: "jazz", w: 0.25 }], dominant: "gabber" },
      { weights: [{ g: GEN, w: 0.5 }, { g: "techno", w: 0.3 }, { g: "jazz", w: 0.2 }], dominant: GEN },
      { weights: [{ g: GEN, w: 0.62 }, { g: "techno", w: 0.38 }], dominant: GEN },
      { weights: [{ g: GEN, w: 0.78 }, { g: "techno", w: 0.22 }], dominant: GEN },
      { weights: [{ g: GEN, w: 0.9 }, { g: "techno", w: 0.1 }], dominant: GEN },
      { weights: [{ g: GEN, w: 1 }], dominant: GEN },
      { weights: [{ g: GEN, w: 1 }], dominant: GEN },
    ];
    const FRAMES_PER_BAR = 16, DT = 0.1;
    // settle on bar 0 first so we start converged (no startup transient in the trace).
    SC.__injectTravel({ weights: bars[0].weights, dominant: bars[0].dominant, position: null, live: true, seed: 1 });
    for (let i = 0; i < 40; i++) SC.__stepNoRender(DT);

    const deltas = [];        // per-frame camera move
    const boundary = [];      // frame indices that are the FIRST frame of a new bar
    const camDist = [];       // pose zoom distance (galaxy->surface)
    const landedAt = [];
    let prev = SC.cam();
    let frame = 0;
    for (let b = 1; b < bars.length; b++) {
      // BAR BOUNDARY: step S.weights/travel (a discrete jump), exactly like onBar.
      SC.__injectTravel({ weights: bars[b].weights, dominant: bars[b].dominant,
        position: bars[b].dominant === GEN ? { x: 0, y: 0 } : null, live: true, seed: 1 });
      for (let f = 0; f < FRAMES_PER_BAR; f++) {
        SC.__stepNoRender(DT);
        const c = SC.cam();
        deltas.push(+Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z).toFixed(4));
        if (f === 0) boundary.push(frame);   // the boundary frame is the first of the bar
        const fd = SC.fidelity();
        camDist.push(fd && fd.camDist != null ? +fd.camDist.toFixed(2) : null);
        landedAt.push(!!(SC.state() && SC.state().landed));
        prev = c; frame++;
      }
    }
    return { deltas, boundary, camDist, landedAt };
  }, GEN);

  // For every bar boundary, compare the boundary-frame move to the LOCAL median of the
  // surrounding window (excluding the boundary frame itself). A spring keeps velocity
  // continuous => boundary move ~ its neighbours; a first-order follow => a big spike.
  const D = cad.deltas;
  const ratios = [];
  for (const b of cad.boundary) {
    const lo = Math.max(0, b - 4), hi = Math.min(D.length - 1, b + 4);
    const win = [];
    for (let i = lo; i <= hi; i++) if (i !== b) win.push(D[i]);
    const med = median(win);
    if (med > 1e-4) ratios.push({ b, move: D[b], med: +med.toFixed(4), ratio: +(D[b] / med).toFixed(2) });
  }
  const worst = ratios.reduce((m, r) => (r.ratio > m.ratio ? r : m), { ratio: 0 });
  console.log("       boundary ratios:", JSON.stringify(ratios));
  console.log("       deltas:", JSON.stringify(D));
  // A first-order follow front-loads ~50-100% of a step onto frame 0, i.e. ratio >> 2.
  // A critically-damped spring carries velocity across the step: boundary move stays near
  // the local median (ratio ~ 1, allow generous 2.0 for the ramp-in of a fresh glide).
  ok(ratios.length >= 4 && worst.ratio <= 2.0,
    `1. NO LURCH at any BAR BOUNDARY — worst boundary camera move is ${worst.ratio}x the local median (frame ${worst.b}, move ${worst.move} vs median ${worst.med}); <= 2.0 means a spring glides across each step, not a first-order spike`);

  // ==== 1b. CONTINUOUS CRUISE — the FOLLOWED TARGET advances EVERY FRAME =============
  // THE ACTUAL BUG ("waits eight bars then moves all at once") is NOT a boundary SPIKE — it is
  // the OPPOSITE: the camera FOLLOWS the weighted-centroid target, which the app updates only
  // in DISCRETE per-bar STEPS. A spring eased toward that STATIC between-update target CONVERGES
  // and then SITS STILL until the next step, then bursts — a wait-then-move whose boundary frame
  // is LOW (so section 1's "no spike" test passes right through) yet the camera visibly waits.
  //
  // The FIX makes the FOLLOWED target dead-reckon: it ramps LINEARLY from where it is to the new
  // value across the update interval, advancing every frame. We measure that followed target
  // directly (state.hereSmoothed — the centroid the pose is built from, BEFORE the transit
  // camera's aiming geometry, which has its own unrelated nonlinearities). We drive a MULTI-BAR
  // CRUISE between WELL-SEPARATED genres exactly like the live app — weights HELD constant within
  // a bar, STEPPED at each bar boundary, beatPhase advancing 0..1, dominance LOW so we stay in
  // transit — and assert the target's per-frame motion is roughly FLAT/uniform: every cruise bar
  // keeps moving (min per-frame move is a real fraction of that bar's mean), no near-zero stall.
  const cruise = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    // WELL-SEPARATED systems — the dominant hops between distant genres each bar so the centroid
    // pans a long way across the map (the worst case for a wait-then-jump).
    const hops = ["ambient", "gabber", "jazz", "techno", "bossanova", "ambient", "gabber"];
    const FPB = 24, DT = 0.1, SPB = (DT * FPB) / 8;   // 8 beats/bar => bar duration == FPB*DT (2.4s)
    const blendFor = (g, o) => [{ g, w: 0.45 }, { g: o, w: 0.3 }, { g: "chiptune", w: 0.25 }];  // dominance 0.45 => transit
    const setBeat = (serial, f) => SC.__injectBeat({ bpm: 120, spb: SPB, cbeats: 8, serial,
      beat: Math.floor((f * 8) / FPB), beatPhase: ((f * 8) / FPB) % 1, playing: true });
    const here = () => { const s = SC.state(); return (s && s.hereSmoothed) || { x: 0, y: 0, z: 0 }; };
    // settle on the first hop so we START converged (no startup transient in the trace).
    setBeat(0, 0);
    SC.__injectTravel({ weights: blendFor("ambient", "techno"), dominant: "ambient", position: null, live: true, seed: 1 });
    for (let i = 0; i < 60; i++) SC.__stepNoRender(DT);
    const tgt = [], cam = [], boundary = [], landedAt = [];
    let pt = here(), pc = SC.cam(), frame = 0;
    for (let b = 1; b < hops.length; b++) {
      // BAR BOUNDARY: step S.weights/travel (discrete) + advance the bar serial, like onBar.
      SC.__injectTravel({ weights: blendFor(hops[b], hops[b - 1]), dominant: hops[b], position: null, live: true, seed: 1 });
      for (let f = 0; f < FPB; f++) {
        setBeat(b, f);                       // beatPhase advances 0..1 across the bar
        SC.__stepNoRender(DT);
        const h = here(), c = SC.cam();
        tgt.push(+Math.hypot(h.x - pt.x, h.y - pt.y, h.z - pt.z).toFixed(4));   // followed-TARGET move
        cam.push(+Math.hypot(c.x - pc.x, c.y - pc.y, c.z - pc.z).toFixed(4));   // world-camera move (for the eye)
        if (f === 0) boundary.push(frame);
        landedAt.push(!!(SC.state() && SC.state().landed));
        pt = h; pc = c; frame++;
      }
    }
    return { tgt, cam, boundary, landedAt, fpb: FPB };
  });
  const CD = cruise.tgt, FPB = cruise.fpb;
  const meanC = CD.reduce((a, b) => a + b, 0) / Math.max(1, CD.length);
  const nzT = 0.2 * meanC;                    // "not really moving" threshold (20% of the mean move)
  let longestStill = 0, run = 0, stillFrames = 0;
  for (const d of CD) { if (d < nzT) { run++; stillFrames++; if (run > longestStill) longestStill = run; } else run = 0; }
  const movingFrac = 1 - stillFrames / Math.max(1, CD.length);
  // per-bar min/mean — a human reads this to confirm every cruise bar KEEPS MOVING (the min
  // per bar is a real fraction of that bar's mean, not ~0 for a stretch = the old sit-still).
  const perBar = [];
  for (let s = 0; s + FPB <= CD.length; s += FPB) {
    const seg = CD.slice(s, s + FPB);
    const mn = Math.min.apply(null, seg), mean = seg.reduce((a, b) => a + b, 0) / seg.length;
    perBar.push({ bar: s / FPB + 1, min: +mn.toFixed(2), mean: +mean.toFixed(2), ratio: +(mn / (mean || 1)).toFixed(2) });
  }
  const worstBarRatio = perBar.reduce((m, r) => Math.min(m, r.ratio), 1);
  console.log("       CRUISE followed-target per-frame motion (one number per frame, ~6 bars):");
  console.log("       " + JSON.stringify(CD));
  console.log("       CRUISE world-camera per-frame motion (for the eye):");
  console.log("       " + JSON.stringify(cruise.cam));
  console.log("       CRUISE per-bar target min/mean:", JSON.stringify(perBar));
  console.log("       meanMove=" + meanC.toFixed(2) + " nearZeroThresh=" + nzT.toFixed(2) +
    " longestStillRun=" + longestStill + " movingFrac=" + movingFrac.toFixed(3) + " worstBarMinOverMean=" + worstBarRatio.toFixed(2));
  ok(!cruise.landedAt.some((v) => v),
    "1bA. the cruise stays IN TRANSIT (low dominance) so we measure the PAN between systems, not a landing");
  ok(longestStill <= 2,
    `1bB. NO WAIT-THEN-JUMP — the followed target never SITS STILL for a stretch during the cruise (longest run of near-zero-move frames ${longestStill} <= 2; the OLD spring-to-a-static-target parks for each bar's tail then bursts, giving a long still run)`);
  ok(movingFrac >= 0.9,
    `1bC. the target MOVES CONTINUOUSLY across the bars — ${(movingFrac * 100).toFixed(0)}% of cruise frames carry real motion (>= 90%: roughly uniform travel, not near-zero-then-spike)`);
  ok(worstBarRatio >= 0.3,
    `1bD. every cruise bar KEEPS MOVING at a roughly CONSTANT pace — worst bar's MIN move is ${worstBarRatio.toFixed(2)}x its MEAN (>= 0.3: a flat ramp, not a bar that goes near-dead then lurches, which would be ~0)`);

  // ==== 2. CONTINUOUS DESCENT — distance falls smoothly, no teleport ==============
  const cds = cad.camDist.filter((v) => v != null);
  const firstDist = cds[0], lastDist = cds[cds.length - 1];
  let maxDrop = 0;
  for (let i = 1; i < cds.length; i++) { const dd = cds[i - 1] - cds[i]; if (dd > maxDrop) maxDrop = dd; }
  const landedEver = cad.landedAt.some((v) => v);
  console.log("       descent: camDist " + firstDist + " -> " + lastDist + " maxDrop/frame=" + maxDrop.toFixed(2) + " landedEver=" + landedEver);
  ok(firstDist > 80 && lastDist < 12,
    `2A. ONE continuous zoom galaxy->surface across the bar sequence (camDist ${firstDist} -> ${lastDist})`);
  ok(maxDrop < 40,
    `2B. the descent is CONTINUOUS — no single-frame teleport (largest per-frame distance drop ${maxDrop.toFixed(2)} < 40)`);
  ok(landedEver,
    `2C. the rising per-bar dominant weight carried the camera to a LANDING`);

  // ==== 3. NO SCENE JUMP — rendered frame changes continuously (pixel delta bounded)
  // Re-run a compressed cruise->land WITH RENDERING, sampling a coarse frame signature
  // each frame. The per-frame signature delta (L1 over the luminance grid) must stay
  // bounded: a scene SWAP/teleport (whole-frame content change) would spike it far above
  // the median frame-to-frame change.
  const pix = await page.evaluate((GEN) => {
    const SC = window.__STARCRUISE;
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0, playing: true });
    // depart to a clean flying baseline, then a rising-dominance bar sequence toward GEN
    // (fewer bars, WITH render each frame — SwiftShader-friendly length).
    SC.__injectTravel({ weights: [{ g: "ambient", w: 0.4 }, { g: "techno", w: 0.35 }, { g: "jazz", w: 0.25 }], dominant: "ambient", position: null, live: true, seed: 1 });
    for (let i = 0; i < 40; i++) SC.__stepNoRender(0.1);
    const bars = [
      { weights: [{ g: GEN, w: 0.5 }, { g: "techno", w: 0.3 }, { g: "jazz", w: 0.2 }], dominant: GEN },
      { weights: [{ g: GEN, w: 0.7 }, { g: "techno", w: 0.3 }], dominant: GEN },
      { weights: [{ g: GEN, w: 0.85 }, { g: "techno", w: 0.15 }], dominant: GEN },
      { weights: [{ g: GEN, w: 1 }], dominant: GEN },
      { weights: [{ g: GEN, w: 1 }], dominant: GEN },
    ];
    const sigs = [];
    const grab = () => { const s = SC.frameSignature(24, 18); return s && s.sig ? s.sig : null; };
    const FPB = 8, DT = 0.12;
    for (let b = 0; b < bars.length; b++) {
      SC.__injectTravel({ weights: bars[b].weights, dominant: bars[b].dominant, position: { x: 0, y: 0 }, live: true, seed: 1 });
      for (let f = 0; f < FPB; f++) { SC.__step(DT); const g = grab(); if (g) sigs.push(g); }
    }
    // per-frame signature L1 distance
    const dsig = [];
    for (let i = 1; i < sigs.length; i++) {
      let s = 0; const a = sigs[i], p = sigs[i - 1];
      for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - p[k]);
      dsig.push(+(s / a.length).toFixed(5));
    }
    // did a real planet ground land under the band?
    const hasGround = SC.hasGround ? SC.hasGround() : null;
    return { dsig, hasGround, landed: SC.state().landed };
  }, GEN);
  const dsig = pix.dsig;
  const maxSig = Math.max.apply(null, dsig);
  // A SCENE JUMP/CUT is a single frame whose picture change spikes FAR above its immediate
  // neighbours (a whole-frame content swap between two otherwise-similar frames — the old
  // region-swap showed ~0.12 next to ~0.002 = a ~50x LOCAL jump). A continuous zoom, however
  // fast, changes at a rate comparable to the frames around it (local jump ~1-2x). So the
  // discriminating metric is the LOCAL jump: dsig[i] vs max(neighbours), not the raw value
  // (which just reflects descent SPEED). We also keep a loose absolute guard against a
  // catastrophic full-scene replacement.
  let maxJump = 0, jumpAt = -1;
  for (let i = 1; i < dsig.length - 1; i++) {
    const nb = Math.max(dsig[i - 1], dsig[i + 1], 0.004);   // eps floor: ignore noise on near-static frames
    const j = dsig[i] / nb;
    if (j > maxJump) { maxJump = j; jumpAt = i; }
  }
  console.log("       frame-sig deltas:", JSON.stringify(dsig));
  console.log("       frame-sig: maxDelta=" + maxSig.toFixed(5) + " maxLocalJump=" + maxJump.toFixed(2) + "@" + jumpAt + " hasGround=" + pix.hasGround);
  ok(dsig.length >= 8 && maxJump < 4.0,
    `3A. NO SCENE JUMP — no single frame's picture change spikes above its neighbours (max LOCAL jump ${maxJump.toFixed(2)}x < 4.0: a continuous zoom/descent, not a whole-scene region swap which would spike ~20x+)`);
  ok(maxSig < 0.30,
    `3B. NO CATASTROPHIC SWAP — even the fastest descent frame changes only part of the picture (max frame-signature delta ${maxSig.toFixed(4)} < 0.30; a full-scene replacement would be ~0.5+)`);

  // ==== 4. UNIFIED SCENE — a real procedural planet ground under the band =========
  ok(pix.hasGround === true,
    `4. LANDS ON A REAL PLANET — a procedural planet ground is present under the band on touchdown (heightAt foot-plant, unified scene)`);

  // ==== errors + teardown =========================================================
  ok(errs.length === 0, "E1. no console/page errors across the bar-cadence probe" + (errs.length ? " :: " + errs.join(" | ") : ""));
  await page.evaluate(() => { window.__STARCRUISE.__injectTravel(null); window.__STARCRUISE.__injectBeat(null); window.__STARCRUISE.stop(); });

  await browser.close();
  srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
