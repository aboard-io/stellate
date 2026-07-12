#!/usr/bin/env node
// starcruise-nav-run.js — headless proof for the NAV rebuild (the three real-user fixes
// the old 'settled-smoothness' probes MISSED):
//
//   1. SPREAD + LOOK — the galaxy is blown WAY OUT (min sun-sun distance large, not a
//      pile) and the suns render as EMISSIVE glowing STARS (self-lit core + additive
//      corona halo), distinct from the smaller genre planets.
//   2. CONTINUOUS CAMERA (no 8-measure lurch) — across an injected blend/DOMINANT change
//      the per-frame camera move NEVER spikes at the update: it starts ~0 (a spring, not
//      a step) and ramps, so the cruise glides.
//   3. CONTINUOUS ZOOM-LAND — as the dominant weight rises the camera DESCENDS
//      continuously from the galaxy down to the surface: distance-to-target decreases
//      smoothly with NO teleport step between the star-map region and the surface region.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/starcruise-nav-run.js
"use strict";
const path = require("path");
const { serve, capturePageErrors, installOfflineRoute } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = process.env.SC_PORT ? +process.env.SC_PORT : 8813;

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
  await page.waitForFunction(() => window.__STARCRUISE && document.getElementById("cruiseChip"), { timeout: 120000 });
  await page.waitForTimeout(300);

  // seed a live store + start the mode, then pause the RAF loop so scripted __steps are
  // the sole driver (deterministic under headless SwiftShader).
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

  // ==== 1. GALAXY SPREAD + EMISSIVE SUNS ==========================================
  const spread = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    const suns = SC.suns(64).suns;                         // ALL 31 sun markers
    let min = Infinity, minPair = null;
    for (let i = 0; i < suns.length; i++) for (let j = i + 1; j < suns.length; j++) {
      const a = suns[i].marker, b = suns[j].marker;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d < min) { min = d; minPair = [suns[i].id, suns[j].id]; }
    }
    // planet spread too — the whole field extent.
    const pf = SC.planetField(["ambient", "gabber"]);
    return { count: suns.length, minSunDist: +min.toFixed(2), minPair,
      fieldScale: pf.field.scale, glow: SC.sunGlow() };
  });
  console.log("       spread:", JSON.stringify(spread));
  const maxCoreR = spread.glow.coreR ? Math.max.apply(null, spread.glow.coreR) : 8;
  ok(spread.count === 31 && spread.minSunDist > 15 && spread.minSunDist > 2 * maxCoreR,
    `1A. galaxy SPREAD WAY OUT — closest two suns ${spread.minSunDist} apart (>15 and > 2x the ${maxCoreR} core radius: real empty space, NOT piled)`);
  ok(spread.fieldScale >= 2.5,
    `1B. the layout is blown up (FIELD.scale=${spread.fieldScale}, was 0.55 — ~${(spread.fieldScale / 0.55).toFixed(1)}x larger)`);
  ok(spread.glow && spread.glow.coreToneMapped === false && spread.glow.cores === 31,
    `1C. suns are EMISSIVE — self-lit cores drawn at full brightness (toneMapped=${spread.glow.coreToneMapped}, ${spread.glow.cores} stars)`);
  ok(spread.glow && spread.glow.glowMesh && spread.glow.glowAdditive && spread.glow.glowTransparent && spread.glow.glows === 31,
    `1D. each sun has an ADDITIVE corona/HALO glow shell (glowMesh=${spread.glow.glowMesh}, additive=${spread.glow.glowAdditive}, ${spread.glow.glows} halos)`);

  // ==== 2. CONTINUOUS CAMERA — no spike at a blend/dominant update =================
  // Settle an even (deep-space) blend dominated by GEN, then SWITCH the dominant to a FAR
  // genre while keeping the blend even (so we stay in transit throughout). The camera goal
  // moves to the far planet; a spring-eased camera must GLIDE — the first frames after the
  // switch move ~0 (no jump), the motion ramps, and the peak is NOT at the update frame.
  const cont = await page.evaluate((GEN) => {
    const SC = window.__STARCRUISE;
    // pick a genre whose planet is FAR from GEN's, to make any step-jump obvious.
    // ambient/gabber/jazz sit at opposite ends of the map.
    const FAR = "gabber";
    function stepN(n, dt) { for (let i = 0; i < n; i++) SC.__stepNoRender(dt); }
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 1, beatPhase: 0, playing: true });
    // even blend dominated by GEN — low dominance => transit (deep space), converge it.
    SC.__injectTravel({ weights: [{ g: GEN, w: 0.4 }, { g: "techno", w: 0.3 }, { g: "jazz", w: 0.3 }], dominant: GEN, position: null, live: true, seed: 1 });
    stepN(60, 0.1);                                        // fully converge the springs
    const before = SC.cam();
    // THE UPDATE: flip the dominant to a far planet (still an even blend => still transit).
    SC.__injectTravel({ weights: [{ g: FAR, w: 0.4 }, { g: "techno", w: 0.3 }, { g: "jazz", w: 0.3 }], dominant: FAR, position: null, live: true, seed: 1 });
    const deltas = []; let prev = SC.cam();
    for (let i = 0; i < 40; i++) {
      SC.__stepNoRender(0.1);
      const c = SC.cam();
      deltas.push(+Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z).toFixed(4));
      prev = c;
    }
    const landedNow = SC.state().landed;
    return { before, deltas, landedNow };
  }, GEN);
  const d = cont.deltas;
  const maxD = Math.max.apply(null, d);
  const maxIdx = d.indexOf(maxD);
  const firstD = d[0];
  // largest single-frame JUMP in the delta itself (the "jerk") — a step input would show a
  // huge jerk at frame 0; a spring shows a gentle rise.
  let maxJerk = 0; for (let i = 1; i < d.length; i++) maxJerk = Math.max(maxJerk, Math.abs(d[i] - d[i - 1]));
  console.log("       continuity: first=" + firstD + " max=" + maxD.toFixed(3) + "@" + maxIdx + " jerk=" + maxJerk.toFixed(3) + " landed=" + cont.landedNow);
  console.log("       deltas[0..12]:", JSON.stringify(d.slice(0, 13)));
  ok(!cont.landedNow, "2A. the probe stays IN TRANSIT across the dominant switch (so we measure the cruise camera)");
  // NO SPIKE AT THE UPDATE: the frame right after the dominant flips moves FAR less than the
  // mid-glide peak (a spring easing from rest). A first-order step-follow would instead move
  // MOST on that very first frame — the old lurch. We assert the update frame is a small
  // fraction of the peak (soft start), for a FAR cross-map jump (worst case).
  ok(firstD < 0.35 * maxD,
    `2B. NO LURCH at the update — the frame after the dominant change moves only ${firstD.toFixed(2)} vs the ${maxD.toFixed(1)} glide peak (${(100 * firstD / maxD).toFixed(0)}% << a step-follow would be ~100% here): a spring soft-start, not a jump`);
  ok(maxIdx >= 2,
    `2C. the camera GLIDES — motion ramps IN after the update (peak move at frame ${maxIdx}, not frame 0)`);
  ok(maxJerk < maxD,
    `2D. the per-frame move changes SMOOTHLY (max jerk ${maxJerk.toFixed(2)} < peak move ${maxD.toFixed(2)}: no discontinuity/spike)`);

  // ==== 3. CONTINUOUS ZOOM-LAND — a real descent, no teleport =====================
  // Ramp the dominant weight 0.4 -> 1.0 in stages, driving imm from deep-space to full
  // immersion. Sample the flight's intended zoom distance (camDist = pose position->look)
  // AND the real camera height every frame. It must fall from a large galaxy value to a
  // small surface value CONTINUOUSLY — no single-frame teleport, and it never lands as a
  // discontinuous cut from the star-map region to the surface region.
  const descent = await page.evaluate((GEN) => {
    const SC = window.__STARCRUISE;
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0, playing: true });
    // start high in space (even blend), converge.
    SC.__injectTravel({ weights: [{ g: GEN, w: 0.4 }, { g: "techno", w: 0.3 }, { g: "jazz", w: 0.3 }], dominant: GEN, position: null, live: true, seed: 1 });
    for (let i = 0; i < 50; i++) SC.__stepNoRender(0.1);
    const trace = [];
    const record = () => { const f = SC.fidelity(); const c = SC.cam();
      trace.push({ imm: +f.imm.toFixed(3), camDist: +f.camDist.toFixed(2), camY: +f.camY.toFixed(2),
        landed: f.landed, phase: f.phase, dist2band: +Math.hypot(c.x, c.y - 1.2, c.z).toFixed(2) }); };
    record();
    // stages of RISING dominance -> one continuous descent to the ground.
    const stages = [
      [{ g: GEN, w: 0.6 }, { g: "techno", w: 0.4 }],
      [{ g: GEN, w: 0.75 }, { g: "techno", w: 0.25 }],
      [{ g: GEN, w: 0.9 }, { g: "techno", w: 0.1 }],
      [{ g: GEN, w: 1 }],
    ];
    for (const w of stages) {
      SC.__injectTravel({ weights: w, dominant: GEN, position: { x: 0, y: 0 }, live: true, seed: 1 });
      for (let i = 0; i < 30; i++) { SC.__stepNoRender(0.1); record(); }
    }
    return { trace };
  }, GEN);
  const tr = descent.trace;
  const camDists = tr.map((r) => r.camDist);
  const first = camDists[0], last = camDists[camDists.length - 1];
  // biggest single-frame DROP in the pose zoom distance — a teleport would show one huge
  // step; a real descent stays bounded frame to frame.
  let maxDrop = 0, maxRise = 0;
  for (let i = 1; i < camDists.length; i++) {
    const dd = camDists[i - 1] - camDists[i];
    if (dd > maxDrop) maxDrop = dd;
    if (-dd > maxRise) maxRise = -dd;
  }
  // camera HEIGHT also falls from the galaxy down to the surface.
  const camYs = tr.map((r) => r.camY);
  const firstY = camYs[0], lastY = camYs[camYs.length - 1];
  const landedEver = tr.some((r) => r.landed);
  const wentSpace = first > 100;
  console.log("       descent: camDist " + first + " -> " + last + " (maxDrop/frame=" + maxDrop.toFixed(2) + ", maxRise=" + maxRise.toFixed(2) + "), camY " + firstY + " -> " + lastY + ", landedEver=" + landedEver);
  console.log("       descent trace (every 8th):", JSON.stringify(tr.filter((_, i) => i % 8 === 0)));
  ok(wentSpace && last < 12,
    `3A. ONE continuous zoom from GALAXY to SURFACE — pose distance falls ${first} -> ${last} (deep space >100 down to on-the-ground <12)`);
  ok(firstY > 100 && lastY < 12,
    `3B. the camera DESCENDS — height drops from the galaxy (${firstY}) to the surface (${lastY})`);
  ok(maxDrop < 40,
    `3C. the descent is CONTINUOUS — no teleport step (largest single-frame distance drop ${maxDrop.toFixed(2)} < 40: a smooth glide, not a cut between regions)`);
  ok(landedEver,
    `3D. the rising dominant weight carries the camera all the way to a LANDING (touchdown reached, immersion drove the zoom)`);

  // ==== errors + teardown =========================================================
  ok(errs.length === 0, "E1. no console/page errors across the nav probe" + (errs.length ? " :: " + errs.join(" | ") : ""));
  await page.evaluate(() => { window.__STARCRUISE.__injectTravel(null); window.__STARCRUISE.__injectBeat(null); window.__STARCRUISE.stop(); });

  await browser.close();
  srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
