#!/usr/bin/env node
// starcruise-run.js — headless proof for the 🛸 STAR-CRUISE 3D video mode
// (app/starcruise.js + app/starcruise/*, vendored Three.js). Drives index.html in
// headless chromium (WebGL via SwiftShader) and asserts the scaffold's contract:
//
//   A. the mode is OFF by default — the 🛸 chip exists but Three is NOT loaded and
//      no starcruise canvas is in the DOM (zero-cost until tapped);
//   B. start() lazy-loads Three (window.__STARCRUISE.hasThree() true) and a
//      #starcruise-canvas is mounted;
//   C. a NON-BLANK frame renders — the low-res target has real colour spread and a
//      body of non-background pixels (not all one colour), sampled via
//      renderer.readRenderTargetPixels (robust under headless WebGL);
//   D. the flight state machine ADVANCES through phases over a couple seconds;
//   E. NO console/page errors across activate -> run -> stop;
//   F. stop() tears down cleanly — canvas removed, isRunning() false.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/starcruise-run.js
"use strict";
const path = require("path");
const { serve, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8811;

// launch chromium with WebGL forced on for headless (SwiftShader/ANGLE) — the
// probe-harness launcher omits these, and the star-cruise mode needs a real GL
// context, so we launch directly here.
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
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__STARCRUISE && document.getElementById("cruiseChip"), { timeout: 20000 });
  await page.waitForTimeout(300);

  // ---- A: OFF by default ----
  const before = await page.evaluate(() => ({
    chip: !!document.getElementById("cruiseChip"),
    hasThree: window.__STARCRUISE.hasThree(),
    canvas: !!document.getElementById("starcruise-canvas"),
    running: window.__STARCRUISE.isRunning(),
  }));
  ok(before.chip, "A1. 🛸 chip injected into #chips");
  ok(!before.hasThree, "A2. Three NOT loaded before activation (lazy)");
  ok(!before.canvas && !before.running, "A3. no starcruise canvas / not running when off");

  // ---- B: activate ----
  await page.evaluate(() => window.__STARCRUISE.start());
  await page.waitForFunction(() => window.__STARCRUISE.isRunning() && window.__STARCRUISE.hasThree(), { timeout: 20000 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    hasThree: window.__STARCRUISE.hasThree(),
    canvas: !!document.getElementById("starcruise-canvas"),
    running: window.__STARCRUISE.isRunning(),
    bandCount: window.__STARCRUISE.band().length,
  }));
  ok(after.hasThree, "B1. Three lazy-loaded on start()");
  ok(after.canvas, "B2. #starcruise-canvas mounted");
  ok(after.running && after.bandCount >= 1, `B3. running with a band (${after.bandCount} aliens)`);

  // ---- B4/B5: always-visible EXIT affordance + bumped internal resolution ----
  const rig = await page.evaluate(() => ({
    res: window.__STARCRUISE.lowRes(),
    exit: window.__STARCRUISE.hasExit(),
    exitDom: !!document.getElementById("starcruise-exit"),
  }));
  console.log("       lowRes:", JSON.stringify(rig.res), " exit:", rig.exit);
  ok(rig.exit && rig.exitDom, "B4. always-visible ✕ EXIT button mounted above the canvas");
  // NEAR-NATIVE render target now (DPR-aware, long edge capped ~1600 desktop / ~1080
  // mobile). At the 800x600 test viewport (dpr 1) that resolves to ~800x600.
  ok(rig.res.w >= 760 && rig.res.h >= 560,
    `B5. internal resolution RAISED to near-native (${rig.res.w}x${rig.res.h}, was 320x240 potato)`);

  // ---- C: non-blank frame ----
  const sample = await page.evaluate(() => window.__STARCRUISE.sampleLowRes());
  console.log("       sample:", JSON.stringify(sample));
  ok(sample && !sample.error, "C1. low-res target readback succeeded");
  ok(sample && !sample.blank && !sample.allOneColor, `C2. NON-BLANK frame (spread=${sample && sample.spread})`);
  ok(sample && sample.nonBg > 50, `C3. real geometry drawn (${sample && sample.nonBg} non-bg px)`);

  // ---- D: flight state machine advances through phases ----
  // step update(dt) ~6s of virtual time and collect the distinct phases the flight
  // machine reports (each step returns the phase via flight.update inside update()).
  // We tap flight directly through a fresh update to read st.phase.
  const phases = await page.evaluate(async () => {
    const seen = [];
    for (let i = 0; i < 60; i++) {
      const st = window.__STARCRUISE.__step ? window.__STARCRUISE.__step(0.15) : null;
      if (st && seen[seen.length - 1] !== st.phase) seen.push(st.phase);
      await new Promise((r) => setTimeout(r, 8));
    }
    return seen;
  });
  console.log("       phases seen:", JSON.stringify(phases));
  ok(phases.length >= 2, `D1. flight machine advanced through phases (${phases.join("->")})`);
  const sample2 = await page.evaluate(() => window.__STARCRUISE.sampleLowRes());
  ok(sample2 && !sample2.blank, "D2. still rendering after stepping the state machine ~6s");

  // ---- G: INJECTED FLY->LAND cycle — the BAND spawns ON land ----
  // Script a deterministic travel/beat stream (production hooks are untouched — this
  // override is null in the live app). First DEPART to a clean "flying" baseline
  // (band + backdrop + ship disposed, only lights + starfield remain), then inject a
  // strong single-genre dominant so the flight machine flies FLY->APPROACH->LAND and
  // ASSEMBLES the band for that genre. The scene child count must RISE on landing.
  const GEN = await page.evaluate(() => {
    const gs = Object.keys(window.GenreKernel.GENRES || {});
    return gs[7] || gs[0] || "vaporwave";
  });
  const flying = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 1, beatPhase: 0, playing: true });
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__step(0.2);        // ride DEPART -> FLY, band torn down
    return { phase: SC.state().phase, children: SC.sceneChildren(), band: SC.band().length,
      backdrop: SC.hasBackdrop(), ship: SC.hasShip() };
  });
  ok(flying.band === 0 && !flying.backdrop && !flying.ship,
    `G1. departed to a clean flying baseline (band=${flying.band}, backdrop=${flying.backdrop}, ship=${flying.ship}, ${flying.children} scene children)`);

  const landed = await page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    const phases = [];
    for (let i = 0; i < 60; i++) {
      const st = SC.__step(0.1);
      if (phases[phases.length - 1] !== st.phase) phases.push(st.phase);
      if (st.phase === "DANCE") break;
    }
    const tr = SC.traits();
    return { phases, phase: SC.state().phase, children: SC.sceneChildren(),
      band: SC.band().length, crowd: tr && tr.crowd, genre: tr && tr._genre,
      roles: SC.band().map((a) => a.playStyle), styles: (tr && tr.band || []).map((m) => m.instrument.family),
      backdrop: SC.hasBackdrop(), ship: SC.hasShip() };
  }, GEN);
  console.log("       landed:", JSON.stringify(landed));
  ok(landed.phases.indexOf("LAND") >= 0, `G2. flight flew to a landing (${landed.phases.join("->")})`);
  ok(landed.band >= 1 && landed.band === landed.crowd && landed.band <= 8,
    `G3. BAND assembled on land — one alien per part (${landed.band} aliens == crowd ${landed.crowd}, cap 8; instruments ${JSON.stringify(landed.styles)})`);
  ok(landed.children > flying.children,
    `G4. scene child count ROSE on landing (${flying.children} flying -> ${landed.children} landed)`);
  ok(landed.backdrop && landed.ship, `G5. backdrop + ship present after landing`);

  // ---- RS: RENDERSTYLE — the active planet's whole-screen render CHANGES by genre ----
  // Landing a genre pushes traits.renderStyle.post into the PS1 post pass. Land two
  // genres and assert (1) the ACTIVE post-fx uniforms match the landed genre's derived
  // style, (2) they DIFFER between two distinct genres, and (3) the frame stays
  // non-blank under each style. Scans candidate genres so it always finds a contrast.
  const rs = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    const gs = Object.keys(window.GenreKernel.GENRES || {});
    function land(g) {
      SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
      for (let i = 0; i < 12; i++) SC.__step(0.2);           // depart -> clean flying baseline
      SC.__injectTravel({ weights: [{ g, w: 1 }], dominant: g, position: { x: 0, y: 0 }, live: true, seed: 1 });
      for (let i = 0; i < 60; i++) { const st = SC.__step(0.1); if (st.phase === "DANCE") break; }
      const smp = SC.sampleLowRes();
      return { g, post: SC.postStyle(), rs: SC.renderStyle(),
        nonBlank: !!(smp && !smp.blank && smp.nonBg > 50), nonBg: smp && smp.nonBg };
    }
    const a = land(gs[7] || gs[0]);
    // find a genre whose landed post bag differs from A's (distinct visual language).
    let b = null;
    for (let i = 0; i < gs.length && !b; i++) {
      const cand = land(gs[i]);
      if (JSON.stringify(cand.post) !== JSON.stringify(a.post)) b = cand;
    }
    // does the LIVE pass match the genre's DERIVED style? (proves the push landed)
    const matchA = a.rs && a.post && a.rs.post.dither &&
      ({ none: 0, ordered: 1, onebit: 2 }[a.rs.post.dither] === a.post.dither) &&
      Math.abs(a.rs.post.bloom - a.post.bloom) < 1e-3 &&
      Math.abs(a.rs.post.posterize - a.post.posterize) < 1e-3;
    return { a, b, matchA };
  });
  console.log("       rs.A:", rs.a && rs.a.g, JSON.stringify(rs.a && rs.a.post));
  console.log("       rs.B:", rs.b && rs.b.g, JSON.stringify(rs.b && rs.b.post));
  ok(rs.a && rs.a.post && rs.matchA, `RS1. landing pushes the genre's renderStyle into the PS1 pass (live uniforms match ${rs.a && rs.a.g})`);
  ok(!!(rs.b && rs.b.g), `RS2. two genres render in DISTINCT visual languages (${rs.a && rs.a.g} vs ${rs.b && rs.b.g}: post bags differ)`);
  ok(!!(rs.a && rs.a.nonBlank) && !!(rs.b && rs.b.nonBlank), `RS3. frame stays NON-BLANK under each genre's style (A nonBg=${rs.a && rs.a.nonBg}, B nonBg=${rs.b && rs.b.nonBg})`);

  // re-land the primary GEN so the following blocks see the same landed genre as G.
  await page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__step(0.2);
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    for (let i = 0; i < 60; i++) { const st = SC.__step(0.1); if (st.phase === "DANCE") break; }
  }, GEN);

  // ---- N: NAVIGATION — default framing is FRONT-CENTRED, and a DRAG moves the view ----
  // (1) the landed view must be centred on the band (target ~ centroid, yaw ~ 0 = front,
  // camera IN FRONT on +Z) — the fix for "side profile / off to the left / zoomed out".
  // (2) dispatching a real pointer drag on the canvas must CHANGE the orbit + camera.
  const nav = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    const canvas = document.getElementById("starcruise-canvas");
    SC.__step(0.016);                       // settle the landed (front-on) camera
    const orbit0 = SC.orbit(), cam0 = SC.cam(), centroid = SC.centroid();
    // dispatch a genuine mouse drag: mousedown on the canvas, move + up on window.
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: 400, clientY: 300, bubbles: true }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 540, clientY: 350, bubbles: true }));
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 540, clientY: 350, bubbles: true }));
    SC.__step(0.016);                       // apply the new orbit to the camera
    const orbit1 = SC.orbit(), cam1 = SC.cam();
    // also exercise the touch path (single-finger drag). TouchEvent may not be
    // constructable in headless; fall back to the __drag hook so N3 still proves tilt.
    let touchOk = false;
    try {
      canvas.dispatchEvent(new TouchEvent("touchstart", { touches: [{ clientX: 300, clientY: 300 }], bubbles: true, cancelable: true }));
      canvas.dispatchEvent(new TouchEvent("touchmove", { touches: [{ clientX: 300, clientY: 380 }], bubbles: true, cancelable: true }));
      canvas.dispatchEvent(new TouchEvent("touchend", { touches: [], bubbles: true, cancelable: true }));
      touchOk = true;
    } catch (e) { SC.__drag(0, 80); }        // fallback: drive a downward drag directly
    SC.__step(0.016);
    const orbit2 = SC.orbit();
    return { orbit0, orbit1, orbit2, cam0, cam1, centroid, touchOk };
  }).catch((e) => ({ err: String(e) }));
  if (nav.err) { ok(false, "N. nav probe threw :: " + nav.err); }
  else {
    console.log("       nav.orbit0:", JSON.stringify(nav.orbit0), " cam0:", JSON.stringify(nav.cam0));
    const centred = Math.abs(nav.orbit0.target.x - nav.centroid.x) < 0.6 && Math.abs(nav.orbit0.yaw) < 0.4
      && nav.cam0.z > nav.centroid.z;      // camera sits IN FRONT (+Z) of the band centre
    ok(centred, `N1. default landed view is FRONT-CENTRED on the band (yaw=${nav.orbit0.yaw.toFixed(2)}, targetX=${nav.orbit0.target.x.toFixed(2)} ~ centroidX=${nav.centroid.x.toFixed(2)}, camZ=${nav.cam0.z.toFixed(1)} > centroidZ=${nav.centroid.z.toFixed(1)})`);
    const yawMoved = Math.abs(nav.orbit1.yaw - nav.orbit0.yaw) > 0.05;
    const camMoved = Math.hypot(nav.cam1.x - nav.cam0.x, nav.cam1.y - nav.cam0.y, nav.cam1.z - nav.cam0.z) > 0.05;
    ok(yawMoved && camMoved, `N2. a MOUSE drag orbits the view (yaw ${nav.orbit0.yaw.toFixed(3)}->${nav.orbit1.yaw.toFixed(3)}, camera moved ${Math.hypot(nav.cam1.x - nav.cam0.x, nav.cam1.y - nav.cam0.y, nav.cam1.z - nav.cam0.z).toFixed(2)})`);
    ok(Math.abs(nav.orbit2.pitch - nav.orbit1.pitch) > 0.02, `N3. a TOUCH drag tilts the view (pitch ${nav.orbit1.pitch.toFixed(3)}->${nav.orbit2.pitch.toFixed(3)})`);
  }

  // ---- Dn: DANCERS spawn around the band, grooving to the same beat ----
  const dnc = await page.evaluate(() => ({ dancers: window.__STARCRUISE.dancers(), traitsD: (window.__STARCRUISE.traits() || {}).dancers }));
  console.log("       dancers:", JSON.stringify(dnc));
  ok(dnc.dancers >= 3 && dnc.dancers <= 8, `Dn1. dancers spawned around the band (${dnc.dancers}, traits asked ${dnc.traitsD}, cap 8)`);

  // ---- Sh: LIGHTING & SHADOW — shadowMap on, key light casts, band casts shadows ----
  const sh = await page.evaluate(() => window.__STARCRUISE.shadows());
  console.log("       shadows:", JSON.stringify(sh));
  ok(sh.enabled && sh.sunCast, `Sh1. shadows ENABLED + key light casts (enabled=${sh.enabled}, sunCast=${sh.sunCast}, map=${sh.mapSize})`);
  ok(sh.bandCasters > 0, `Sh2. the band/dancers CAST shadows so forms read modelled (${sh.bandCasters} caster meshes)`);

  // ---- H: the band PLAYS ON the beat and LOCKS to the shared phase ----
  // At beatPhase 0 (a hit boundary) EVERY playing hand sits ON its instrument's
  // contact point (dist ~ 0) — simultaneously, which is the whole band locking to
  // one shared beat. Sweeping the beat, each hand must travel meaningfully away
  // between hits (it really strikes/plucks/bows/blows, not frozen on the contact).
  const HIT_EPS = 0.03;
  const beat = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    // the pipeline must deliver the injected beatPhase all the way to the band.
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0, playing: true });
    SC.__step(0.016);
    const pipePhase = SC.state().beatPhase;
    const onHit = SC.__beatProbe(0);                    // all hands at the hit
    const per = onHit.map(() => ({ min: Infinity, max: 0 }));
    for (let k = 0; k <= 40; k++) {
      const p = SC.__beatProbe(k / 40);
      p.forEach((e, i) => { if (e) { if (e.dist < per[i].min) per[i].min = e.dist; if (e.dist > per[i].max) per[i].max = e.dist; } });
    }
    return { pipePhase, onHit, per, n: onHit.length };
  });
  console.log("       beat.onHit:", JSON.stringify(beat.onHit));
  console.log("       beat.per:", JSON.stringify(beat.per));
  ok(Math.abs(beat.pipePhase) < 1e-6, `H1. injected beatPhase reaches the band through flight (pipe=${beat.pipePhase})`);
  ok(beat.n >= 1 && beat.onHit.every((e) => e && e.dist < HIT_EPS),
    `H2. ALL ${beat.n} hands land ON the contact at beatPhase 0 — band locked to one shared beat (max dist ${Math.max(...beat.onHit.map((e) => e ? e.dist : 9)).toFixed(3)})`);
  ok(beat.per.every((p) => p.max > HIT_EPS * 4 && p.min < HIT_EPS),
    `H3. every hand actually STRIKES — swings away between hits then returns to contact`);

  const sample3 = await page.evaluate(() => window.__STARCRUISE.sampleLowRes());
  ok(sample3 && !sample3.blank && sample3.nonBg > 50, `H4. NON-BLANK while the band plays (nonBg=${sample3 && sample3.nonBg})`);

  // ---- J: FLY-AWAY — DEPART lifts off into a SPACE/COCKPIT state showing the planet ----
  // A fresh DEPART must dispose the surface ensemble AND raise the cockpit set: the
  // pilot flies away through space (spaceProgress rises), the planet recedes BELOW,
  // and the console shows the GENRE display. The frame must stay NON-BLANK throughout.
  const away = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    let planetYearly = null;
    const prog = [];
    for (let i = 0; i < 14; i++) {
      SC.__step(0.2);
      const sp = SC.space();
      prog.push(sp.spaceProgress);
      if (i === 2) planetYearly = sp.planetY;   // planet position early in the climb
    }
    const sp = SC.space();
    const smp = SC.sampleLowRes();
    return { cockpit: sp.hasCockpit, planet: sp.hasPlanet, genres: sp.genres,
      spaceProgress: sp.spaceProgress, planetY0: planetYearly, planetY1: sp.planetY,
      nonBlank: smp && !smp.blank && smp.nonBg > 50, nonBg: smp && smp.nonBg,
      band: SC.band().length, backdrop: SC.hasBackdrop(), ship: SC.hasShip(), children: SC.sceneChildren() };
  });
  console.log("       flyaway:", JSON.stringify(away));
  ok(away.cockpit && away.planet, `J1. DEPART lifts into a COCKPIT/SPACE state (cockpit=${away.cockpit}, planet=${away.planet})`);
  ok(away.genres && away.genres.length >= 1, `J2. cockpit console shows a GENRE display (${JSON.stringify(away.genres)})`);
  ok(away.spaceProgress > 0.5, `J3. we LEFT THE ATMOSPHERE — spaceProgress rose to ${Number(away.spaceProgress).toFixed(2)}`);
  ok(away.planetY1 < away.planetY0, `J4. the planet RECEDES below as we climb (y ${Number(away.planetY0).toFixed(1)} -> ${Number(away.planetY1).toFixed(1)})`);
  ok(away.nonBlank, `J5. the fly-away/cockpit frame is NON-BLANK (nonBg=${away.nonBg})`);

  // ---- K: the surface ensemble is gone; the scene matches the flying baseline ----
  const back = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    const r = { children: SC.sceneChildren(), band: SC.band().length, backdrop: SC.hasBackdrop(), ship: SC.hasShip() };
    SC.__injectTravel(null); SC.__injectBeat(null);     // restore REAL hooks before teardown
    return r;
  });
  ok(back.band === 0 && !back.backdrop && !back.ship && back.children === flying.children,
    `K1. depart disposed the surface ensemble — scene matches the flying baseline (${back.children} children == ${flying.children}, band=${back.band})`);

  // ---- E: no errors ----
  ok(errs.length === 0, "E1. no console/page errors across activate->run" + (errs.length ? " :: " + errs.join(" | ") : ""));

  // ---- F: clean teardown VIA THE EXIT BUTTON (the user's escape hatch) ----
  // Programmatically click the always-visible ✕ EXIT button and confirm it stops the
  // mode and removes the overlay — the user must NEVER be trapped.
  const exited = await page.evaluate(() => {
    const before = window.__STARCRUISE.hasExit();
    window.__STARCRUISE.clickExit();     // dispatch a real click on the ✕ EXIT button
    return { before };
  });
  await page.waitForTimeout(200);
  const stopped = await page.evaluate(() => ({
    running: window.__STARCRUISE.isRunning(),
    canvas: !!document.getElementById("starcruise-canvas"),
    exit: !!document.getElementById("starcruise-exit"),
  }));
  ok(exited.before, "F0. ✕ EXIT button present while running");
  ok(!stopped.running, "F1. EXIT-button click stops the mode (isRunning() false)");
  ok(!stopped.canvas, "F2. canvas removed from DOM after EXIT");
  ok(!stopped.exit, "F2b. ✕ EXIT button removed from DOM after exit");
  ok(errs.length === 0, "F3. no errors after teardown" + (errs.length ? " :: " + errs.join(" | ") : ""));

  // ---- L: the app is UNAFFECTED when the mode is off ----
  // After a full on->off cycle the host app is intact: the 🛸 chip is still in #chips
  // (just un-lit), no starcruise DOM/canvas leaks, the app's own controls remain, and
  // a second start()/stop() round-trips cleanly (no leaked GL context / listeners).
  const host = await page.evaluate(() => ({
    chips: !!document.getElementById("chips"),
    chip: !!document.getElementById("cruiseChip"),
    chipOff: (document.getElementById("cruiseChip") || {}).classList ? !document.getElementById("cruiseChip").classList.contains("on") : false,
    strayCanvas: document.querySelectorAll("#starcruise-canvas").length,
    viewClass: document.body.classList.contains("view-starcruise"),
    liveBtn: !!document.getElementById("live") || !!document.querySelector("#chips"),
  }));
  ok(host.chips && host.chip && host.chipOff, "L1. 🛸 chip persists in #chips, un-lit, after stop()");
  ok(host.strayCanvas === 0 && !host.viewClass, "L2. no starcruise canvas / view-class leaked into the host app");
  const roundtrip = await page.evaluate(async () => {
    const SC = window.__STARCRUISE;
    await SC.start(); const on = SC.isRunning() && !!document.getElementById("starcruise-canvas");
    SC.stop(); const off = !SC.isRunning() && !document.getElementById("starcruise-canvas");
    return { on, off };
  });
  ok(roundtrip.on && roundtrip.off, "L3. start()/stop() round-trips cleanly a second time (no leak)");
  ok(errs.length === 0, "L4. still no errors after the off-state checks" + (errs.length ? " :: " + errs.join(" | ") : ""));

  await browser.close();
  srv.close();

  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
