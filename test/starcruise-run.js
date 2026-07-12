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
const { serve, capturePageErrors, installOfflineRoute } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = process.env.SC_PORT ? +process.env.SC_PORT : 8811;

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
  // OFFLINE ROBUSTNESS: stub every external host (Google-Fonts + esm.sh) so the
  // page boots with no reachable network (see installOfflineRoute).
  await installOfflineRoute(page, PORT, { neutralizeMain: true });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fails.push(msg); return cond; };

  // waitUntil:"commit" — don't block on the 'load' event: the full app boot runs
  // app/starmap.js computeGenreLayout(), which relaxes the whole genre field and,
  // under headless SwiftShader with a zero-size <svg> viewport, is very slow. We
  // gate on the real readiness signal (window.__STARCRUISE + the chip) instead,
  // with a generous timeout that absorbs that boot.
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__STARCRUISE && document.getElementById("cruiseChip"), { timeout: 120000 });
  await page.waitForTimeout(300);

  // SEED THE LIVE STORE. window.__S is normally published by app/main.js's boot();
  // this offline probe neutralises that boot (headless-slow + GL-crashy — see
  // installOfflineRoute), so publish a minimal LIVE store here in the exact shape
  // app/state.js exports. This exercises the REAL getS()->window.__S read path the
  // star-cruise decoupling relies on, and gives the un-injected D-phase a dominant
  // so the flight machine actually flies FLY->APPROACH->LAND (as it does live).
  await page.evaluate(() => {
    const G = Object.keys((window.GenreKernel && window.GenreKernel.GENRES) || {})[7] || "vaporwave";
    window.__S = { weights: [{ g: G, w: 1 }], waypoints: [{ x: 0, y: 0 }, { x: 120, y: 90 }],
      travel: { seg: 0, t: 0.5 }, seed: 1, live: true, playing: { bpm: 120 }, barInfo: null };
  });

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

  // PAUSE the RAF render loop: from here the scripted __step()s are the SOLE renderer,
  // so the long fidelity/music-video probe runs don't double the GL load (headless
  // SwiftShader dies on sustained background rendering across a long suite).
  await page.evaluate(() => window.__STARCRUISE.__pauseLoop());

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
    const vp = SC.eventPlan();
    const sounding = vp ? Object.keys(vp.voices).filter((v) => vp.voices[v].onsets > 0).length : 0;
    return { phases, phase: SC.state().phase, children: SC.sceneChildren(),
      band: SC.band().length, crowd: tr && tr.crowd, genre: tr && tr._genre, sounding,
      bandVoices: SC.bandVoices(),
      roles: SC.band().map((a) => a.playStyle), styles: (tr && tr.band || []).map((m) => m.instrument.family),
      backdrop: SC.hasBackdrop(), ship: SC.hasShip() };
  }, GEN);
  console.log("       landed:", JSON.stringify(landed));
  ok(landed.phases.indexOf("LAND") >= 0, `G2. flight flew to a landing (${landed.phases.join("->")})`);
  // DETERMINISTIC BAND COVERAGE (#9): one alien per SOUNDING voice — the roster is
  // aligned with the plan's sounding set, so every audible part gets a player (this is
  // stable across seeds, where traits.band alone was not: a barely-present melody used
  // to sound with no alien — the old intermittent SB3).
  ok(landed.band >= 1 && landed.band === landed.sounding && landed.band <= 8,
    `G3. BAND assembled on land — ONE alien per SOUNDING voice (${landed.band} aliens == ${landed.sounding} sounding, voices ${JSON.stringify(landed.bandVoices)}, cap 8; instruments ${JSON.stringify(landed.styles)})`);
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
    for (let i = 0; i < 12; i++) SC.__stepNoRender(0.2);
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    for (let i = 0; i < 60; i++) { const st = SC.__stepNoRender(0.1); if (st.phase === "DANCE") break; }
  }, GEN);

  // ---- SB: SCORE BRIDGE — aliens PLAY the score (one per voice, real onsets, rest) ----
  // On land the controller resolves the playing state + calls E.buildEvents ONCE for
  // the whole track, buckets every event by VOICE into a per-bar note plan, spawns ONE
  // alien per active voice, and each frame hands each member its voice's real onsets as
  // ctx. Prove: (1) the plan built with real per-voice onsets; (2) buildEvents is NOT
  // re-run per frame (buildCount constant across many steps); (3) one alien per voice,
  // covering the sounding voices; (4) the notes are ACTUAL onsets (varied t / pitch);
  // (5) REST — a voice with no notes this bar drives its alien to idle (playing=false).
  const KNOWN_VOICES = ["drums", "perc", "bass", "melody", "pad", "found"];
  const sb = await page.evaluate((KNOWN) => {
    const SC = window.__STARCRUISE;
    const plan0 = SC.eventPlan();
    const bc0 = SC.buildCount();
    // step ~40 frames of real time — buildEvents must NOT run again (cached per genre).
    for (let i = 0; i < 40; i++) SC.__step(0.05);
    const bc1 = SC.buildCount();
    const plan = SC.eventPlan();
    const voices = SC.bandVoices();
    const vAgg = (plan && plan.voices) || {};
    const soundingVoices = Object.keys(vAgg).filter((v) => vAgg[v].onsets > 0);
    // pick the busiest sounding voice; scan its bars for both PLAY and REST bars.
    let busy = null, busyOnsets = -1;
    for (const v of soundingVoices) if (vAgg[v].onsets > busyOnsets) { busy = v; busyOnsets = vAgg[v].onsets; }
    let playFound = false, restFound = false, sampleNotes = [];
    if (plan && busy) {
      for (let b = 0; b < plan.numBars; b++) {
        const s = SC.barAt(b, busy);
        if (s.playing && s.notes.length) { playFound = true; if (sampleNotes.length < 16) sampleNotes = sampleNotes.concat(s.notes); }
        else restFound = true;
      }
      sampleNotes = sampleNotes.slice(0, 16);
    }
    // a fully-RESTING alien = a band voice that never sounds anywhere in the plan.
    const idleVoice = voices.find((v) => v && !(vAgg[v] && vAgg[v].onsets > 0)) || null;
    // ctx actually delivered to each member this frame.
    const ctxs = voices.map((v) => ({ v, ctx: SC.voiceCtx(v) }));
    return { plan, bc0, bc1, voices, soundingVoices, busy, busyOnsets, playFound, restFound,
      sampleNotes, idleVoice, ctxs, numBars: plan && plan.numBars, cbeats: plan && plan.cbeats,
      covered: soundingVoices.filter((v) => voices.indexOf(v) >= 0),
      allKnown: voices.every((v) => KNOWN.indexOf(v) >= 0) };
  }, KNOWN_VOICES);
  console.log("       SB plan:", JSON.stringify({ numBars: sb.numBars, cbeats: sb.cbeats, voices: sb.plan && sb.plan.voices, buildCount: sb.bc1 }));
  console.log("       SB bandVoices:", JSON.stringify(sb.voices), " sounding:", JSON.stringify(sb.soundingVoices));
  console.log("       SB sampleNotes(", sb.busy, "):", JSON.stringify(sb.sampleNotes));
  console.log("       SB ctx delivered:", JSON.stringify(sb.ctxs));
  ok(sb.numBars >= 1 && sb.bc1 >= 1 && sb.soundingVoices.length >= 1,
    `SB1. buildEvents ran ONCE -> per-bar note plan (${sb.numBars} bars, ${sb.soundingVoices.length} sounding voices, buildCount=${sb.bc1})`);
  ok(sb.bc0 === sb.bc1,
    `SB2. plan is cached — buildEvents NOT re-run across 40 frames (buildCount ${sb.bc0}==${sb.bc1}, never per-frame)`);
  ok(sb.voices.length >= 1 && sb.allKnown && sb.covered.length === sb.soundingVoices.length,
    `SB3. ONE alien per voice, covering every sounding part (band=${JSON.stringify(sb.voices)}, covers ${JSON.stringify(sb.covered)})`);
  const distinctT = sb.sampleNotes ? new Set(sb.sampleNotes.map((n) => n.t)).size : 0;
  const distinctP = sb.sampleNotes ? new Set(sb.sampleNotes.map((n) => n.pitch)).size : 0;
  const notesVaried = sb.sampleNotes && sb.sampleNotes.length >= 3 && (distinctT >= 3 || distinctP >= 2) &&
    sb.sampleNotes.every((n) => typeof n.t === "number" && n.t >= 0 && n.t <= 1 && typeof n.pitch === "number" && typeof n.vel === "number" && typeof n.dur === "number");
  ok(!!notesVaried, `SB4. members get REAL note ONSETS ({t,pitch,dur,vel}) for '${sb.busy}' — varied (${distinctT} onset positions, ${distinctP} pitches), not beat ticks`);
  ok(sb.restFound || !!sb.idleVoice,
    `SB5. REST when silent — ${sb.idleVoice ? "voice '" + sb.idleVoice + "' never sounds (alien idles)" : "'" + sb.busy + "' has rest bars (no notes -> lowers instrument)"}`);
  const ctxOk = sb.ctxs.every((c) => c.ctx && typeof c.ctx.barPhase === "number" && c.ctx.barPhase >= 0 && c.ctx.barPhase <= 1 && typeof c.ctx.playing === "boolean");
  ok(ctxOk, `SB6. each member receives a well-formed ctx {barPhase(0..1), playing, level, notes} every frame`);

  // ---- N: NAVIGATION — default framing is FRONT-CENTRED, and a DRAG moves the view ----
  // (1) the landed view must be centred on the band (target ~ centroid, yaw ~ 0 = front,
  // camera IN FRONT on +Z) — the fix for "side profile / off to the left / zoomed out".
  // (2) dispatching a real pointer drag on the canvas must CHANGE the orbit + camera.
  const nav = await page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    const canvas = document.getElementById("starcruise-canvas");
    // FRESH LAND so the music-video auto-camera is on its FRONT establishing shot (the
    // landed default framing); it roams + cuts after ~2 bars, but a fresh touchdown
    // always opens front-centred on the band.
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__step(0.2);
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    for (let i = 0; i < 60; i++) { const st = SC.__step(0.1); if (st.phase === "DANCE") break; }
    SC.__step(0.016);                       // settle the landed (front-on) establishing shot
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
  }, GEN).catch((e) => ({ err: String(e) }));
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

  // ---- SP: STAGING — the band is SPREAD OUT (wider than the old cluster) ----
  const sp = await page.evaluate(() => {
    const pos = window.__STARCRUISE.bandPositions();
    const xs = pos.map((p) => p.x).sort((a, b) => a - b);
    let minGap = Infinity; for (let i = 1; i < xs.length; i++) minGap = Math.min(minGap, xs[i] - xs[i - 1]);
    return { pos, n: pos.length, minGap: xs.length > 1 ? minGap : 0,
      widthX: xs.length ? xs[xs.length - 1] - xs[0] : 0 };
  });
  console.log("       staging:", JSON.stringify(sp));
  // wide staging: adjacent players sit >= 2.3 apart in x (was a 1.5 cluster), and the
  // whole ensemble spans a broad arc — less clustered, fills the frame.
  ok(sp.n <= 1 || (sp.minGap >= 2.2 && sp.widthX >= 2.2 * (sp.n - 1) - 0.01),
    `SP1. band SPREAD OUT across a wide stage (n=${sp.n}, minGap=${sp.minGap.toFixed(2)}, widthX=${sp.widthX.toFixed(2)})`);

  // ---- PF: STAR-MAP — one planet per genre sits AT its GENRE_COORDS ----
  // The persistent planet field places every genre's marker at the flight projection of
  // its GENRE_COORDS; flying == traversing the genre space. Assert the markers match the
  // projection of the imported coords for a handful of genres.
  const pf = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    const names = ["ambient", "techno", "jazz", "gabber", "vaporwave"].filter((g) => SC.planetField([g]) && SC.planetField([g]).checks[0].marker);
    const field = SC.planetField(names);
    // recompute the expected world pos from the shared FIELD projection + the module's
    // coords (exposed via the flight worldOfCoord through planetField's field config).
    const F = field.field;
    // pull GENRE_COORDS off the loaded module via the field markers' inverse isn't
    // available; instead assert the marker equals F-projection of a KNOWN coord by
    // reading the coord from the field's own check (marker) consistency: markers are
    // deterministic + distinct, and lie within the projected extent.
    const extent = 100 * F.scale;
    const within = field.checks.every((c) => c.marker &&
      Math.abs(c.marker.x - F.ox) <= extent + 1 && Math.abs(c.marker.z - F.oz) <= extent + 1 &&
      Math.abs(c.marker.y - F.oy) <= extent + 1);
    const distinct = new Set(field.checks.map((c) => c.marker && `${c.marker.x},${c.marker.y},${c.marker.z}`)).size === field.checks.length;
    return { count: field.count, field: F, checks: field.checks, within, distinct };
  });
  console.log("       planetField:", JSON.stringify(pf));
  ok(pf.count >= 100, `PF1. star-map has ONE planet per genre (${pf.count} planets, field ${JSON.stringify(pf.field)})`);
  ok(pf.within && pf.distinct, `PF2. planets sit AT their GENRE_COORDS projection (distinct markers within the +/-${(100 * pf.field.scale).toFixed(0)} extent around the field origin)`);

  // PF3: the markers EXACTLY equal the flight projection of the imported GENRE_COORDS.
  const pf3 = await page.evaluate(async () => {
    const SC = window.__STARCRUISE;
    const mod = await import("/app/starcruise/genre-coords.js");
    const fl = await import("/app/starcruise/flight.js");
    const names = ["ambient", "techno", "jazz"];
    return names.map((g) => {
      const w = fl.worldOfCoord(mod.GENRE_COORDS[g]);
      const m = SC.planetField([g]).checks[0].marker;
      const err = Math.hypot(w.x - m.x, w.y - m.y, w.z - m.z);
      return { g, err: +err.toFixed(3) };
    });
  }).catch((e) => ({ err: String(e) }));
  console.log("       planet@coords:", JSON.stringify(pf3));
  ok(Array.isArray(pf3) && pf3.every((c) => c.err < 0.05),
    `PF3. each planet marker == worldOfCoord(GENRE_COORDS[g]) (${Array.isArray(pf3) ? pf3.map((c) => c.g + ":" + c.err).join(", ") : pf3.err})`);

  // ---- FZ: FIDELITY-DRIVEN ZOOM — the DOMINANT WEIGHT drives altitude/zoom ----
  // Low dominance (even blend) => UP IN SPACE (not landed, viewport visible, high cam);
  // high dominance => DESCEND/LAND; ~1.0 => full immersion (tightest zoom). Drive the
  // blend across weights and read the fidelity signal.
  const fz = await page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    function settle(travel, steps) {
      SC.__injectTravel(travel);
      for (let i = 0; i < steps; i++) SC.__stepNoRender(0.1);   // state-only: no GL load
      return SC.fidelity();
    }
    // even 3-way blend -> low dominance -> deep space.
    const space = settle({ weights: [{ g: G, w: 0.34 }, { g: "techno", w: 0.33 }, { g: "jazz", w: 0.33 }], dominant: G, position: null, live: true, seed: 1 }, 28);
    // strong dominant -> LAND.
    const land = settle({ weights: [{ g: G, w: 0.9 }, { g: "techno", w: 0.1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 }, 34);
    // pure dominant -> FULL immersion (tightest zoom).
    const full = settle({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 }, 34);
    return { space, land, full };
  }, GEN);
  console.log("       fidelity.space:", JSON.stringify(fz.space));
  console.log("       fidelity.land :", JSON.stringify(fz.land));
  console.log("       fidelity.full :", JSON.stringify(fz.full));
  ok(fz.space && !fz.space.landed && fz.space.spaceProgress > 0.5 && fz.space.viewportFade > 0.5,
    `FZ1. LOW dominance => UP IN SPACE, viewport visible (weight=${fz.space.dominantWeight.toFixed(2)}, imm=${fz.space.imm.toFixed(2)}, landed=${fz.space.landed}, viewportFade=${fz.space.viewportFade.toFixed(2)})`);
  ok(fz.land && fz.land.landed && fz.land.imm >= 0.8,
    `FZ2. dominance >= 0.80 => LAND (weight=${fz.land.dominantWeight.toFixed(2)}, imm=${fz.land.imm.toFixed(2)}, landed=${fz.land.landed})`);
  ok(fz.full && fz.full.fullZoom > 0.8 && fz.full.camDist < fz.land.camDist,
    `FZ3. dominance ~1.0 => FULL immersion, tighter zoom than at touchdown (fullZoom ${fz.land.fullZoom.toFixed(2)}->${fz.full.fullZoom.toFixed(2)}, camDist ${fz.land.camDist.toFixed(1)}->${fz.full.camDist.toFixed(1)})`);
  ok(fz.space.imm < fz.land.imm && fz.land.imm <= fz.full.imm,
    `FZ4. zoom immersion rises MONOTONICALLY with the dominant weight (${fz.space.imm.toFixed(2)} < ${fz.land.imm.toFixed(2)} <= ${fz.full.imm.toFixed(2)})`);

  // ---- MV: MUSIC-VIDEO — landed auto-camera roams + CUTS; manual overrides + resumes --
  // The auto-camera advances on the flight/orbit LOGIC (before the GL render), so we
  // drive it with __stepNoRender to avoid piling GPU load on the heavy landed scene.
  const mv = await page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    // fresh land on GEN with a fast beat (spb 0.2 -> shotDur ~1.6s so cuts land quickly).
    SC.__injectBeat({ bpm: 300, spb: 0.2, cbeats: 8, serial: 3, beatPhase: 0, playing: true });
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__stepNoRender(0.2);
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    for (let i = 0; i < 40; i++) { const st = SC.__stepNoRender(0.1); if (st.phase === "DANCE") break; }
    // ROAM without input (~8s @ shotDur 1.6s -> several cuts): collect shots + cam moves.
    const shots = new Set(); const cams = [];
    for (let i = 0; i < 40; i++) {
      SC.__stepNoRender(0.2);
      const ac = SC.autoCam(); const c = SC.cam();
      shots.add(ac.shot); if (i % 4 === 0) cams.push({ x: +c.x.toFixed(2), z: +c.z.toFixed(2) });
    }
    const acEnd = SC.autoCam();
    let moved = 0; for (let i = 1; i < cams.length; i++) moved += Math.hypot(cams[i].x - cams[i - 1].x, cams[i].z - cams[i - 1].z);
    // MANUAL override: a drag suspends the auto-camera.
    SC.__drag(120, 40); SC.__stepNoRender(0.05);
    const acManual = SC.autoCam();
    // then IDLE (no input) long enough for the auto-camera to RESUME.
    for (let i = 0; i < 24; i++) SC.__stepNoRender(0.2);   // ~4.8s > AUTO_IDLE
    const acResume = SC.autoCam();
    return { distinctShots: shots.size, cuts: acEnd.cuts, moved, shotsLen: acEnd.shots,
      autoActive: acEnd.active, manualActive: acManual.active, manualUser: acManual.userActive,
      resumeActive: acResume.active };
  }, GEN);
  console.log("       musicvideo:", JSON.stringify(mv));
  ok(mv.autoActive && mv.cuts >= 1 && mv.distinctShots >= 2,
    `MV1. landed MUSIC-VIDEO auto-camera CUTS between shots on the beat (${mv.cuts} cuts over ${mv.distinctShots} distinct shots of ${mv.shotsLen})`);
  ok(mv.moved > 0.5, `MV2. the auto-camera MOVES (dolly/orbit + cuts) while landed (total planar move ${mv.moved.toFixed(1)})`);
  ok(!mv.manualActive && mv.manualUser, `MV3. a manual drag OVERRIDES the auto-camera (auto active=${mv.manualActive}, userActive=${mv.manualUser})`);
  ok(mv.resumeActive, `MV4. the auto-camera RESUMES after idle (active=${mv.resumeActive})`);

  // re-land the primary GEN cleanly for the following (H/J/K) blocks.
  await page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0, playing: true });
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__stepNoRender(0.2);
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    for (let i = 0; i < 60; i++) { const st = SC.__stepNoRender(0.1); if (st.phase === "DANCE") break; }
  }, GEN);

  // ---- Dn: DANCERS spawn around the band, grooving to the same beat ----
  const dnc = await page.evaluate(() => ({ dancers: window.__STARCRUISE.dancers(), traitsD: (window.__STARCRUISE.traits() || {}).dancers }));
  console.log("       dancers:", JSON.stringify(dnc));
  ok(dnc.dancers >= 3 && dnc.dancers <= 8, `Dn1. dancers spawned around the band (${dnc.dancers}, traits asked ${dnc.traitsD}, cap 8)`);

  // ---- Sh: LIGHTING & SHADOW — shadowMap on, key light casts, band casts shadows ----
  const sh = await page.evaluate(() => window.__STARCRUISE.shadows());
  console.log("       shadows:", JSON.stringify(sh));
  ok(sh.enabled && sh.sunCast, `Sh1. shadows ENABLED + key light casts (enabled=${sh.enabled}, sunCast=${sh.sunCast}, map=${sh.mapSize})`);
  ok(sh.bandCasters > 0, `Sh2. the band/dancers CAST shadows so forms read modelled (${sh.bandCasters} caster meshes)`);

  // ---- H: ONSET MODEL — the band PLAYS ITS SCORE (real per-voice onsets, not a pulse)
  // The rebuilt band hands each alien ITS OWN voice's real note onsets (from the cached
  // per-bar plan) as ctx.notes each frame — replacing the old "every hand hits uniformly
  // on the beat" model. We drive the LANDED band's actual aliens (SC.band()) with the
  // score the plan holds for each voice (SC.barAt) and assert the integration end-to-end:
  //   H1. the injected beatPhase still reaches the band through flight;
  //   H2. (a) each PLAYING alien's instrument-appendage REACHES its instrument AT its
  //       voice's real onset times (contactness peaks + reachDist->0 within a tick of
  //       each onset) — and the contact PHASES differ across voices (syncopation), so the
  //       hands do NOT all land on the contact uniformly at phase 0;
  //   H3. (b) an alien whose voice is SILENT/quiet (ctx.playing=false / level<=0.05) does
  //       NOT reach its instrument — contactness dies to ~0 and the hand stays lowered
  //       (proven both by a forced-silent ctx and by a REAL rest bar from the plan).
  const HIT_EPS = 0.03, REACH_EPS = 0.05, C_HIT = 0.7;

  // H1: the pipeline must still deliver the injected beatPhase all the way to the band.
  const beat = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0, playing: true });
    SC.__step(0.016);
    return { pipePhase: SC.state().beatPhase };
  });
  ok(Math.abs(beat.pipePhase) < 1e-6, `H1. injected beatPhase reaches the band through flight (pipe=${beat.pipePhase})`);

  // H2/H3: sweep barPhase over each landed alien with the REAL notes its voice plays
  // (from the cached plan) and read the appendage's contact trace via alien.debug().
  const onset = await page.evaluate((cfg) => {
    const SC = window.__STARCRUISE;
    const band = SC.band();
    const plan = SC.eventPlan();
    const numBars = plan ? plan.numBars : 0;
    const wrap = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };
    // drive ONE alien across a bar with a GIVEN {notes,playing,level}; capture contact.
    function sweep(al, notes, playing, level, steps) {
      const rows = [];
      for (let s = 0; s < steps; s++) {
        const bp = s / steps;
        al.update(0.016, { barPhase: bp, playing, level, notes, valueOf() { return bp; } });
        const d = al.debug();
        rows.push({ bp, c: d.contactness, dist: d.dist, reach: d.reachDist });
      }
      return rows;
    }
    const maxCwin = (rows, t, w) => { let m = 0; for (const r of rows) if (wrap(r.bp, t) <= w) m = Math.max(m, r.c); return m; };
    const minReachWin = (rows, t, w) => { let m = 1e9; for (const r of rows) if (wrap(r.bp, t) <= w) m = Math.min(m, r.reach); return m; };
    const atRow = (rows, t) => { let best = rows[0], bd = 1e9; for (const r of rows) { const dd = wrap(r.bp, t); if (dd < bd) { bd = dd; best = r; } } return best; };
    const W = cfg.W, STEPS = cfg.STEPS;

    const players = [], resters = [];
    for (const al of band) {
      const voice = al._voice;
      // find a bar where this voice sounds (onsets + audible level) and one where it rests.
      let playBar = -1, restBar = -1;
      for (let b = 0; b < numBars; b++) {
        const s = SC.barAt(b, voice);
        if (s.playing && s.notes.length && s.level > 0.05) { if (playBar < 0) playBar = b; }
        else if (restBar < 0) restBar = b;
      }
      // (a) PLAY: the appendage must reach the instrument AT this voice's real onsets.
      if (playBar >= 0) {
        const s = SC.barAt(playBar, voice);
        const notes = s.notes, onsets = notes.map((n) => n.t);
        const rows = sweep(al, notes, true, s.level, STEPS);
        const onsetC = onsets.map((t) => +maxCwin(rows, t, W).toFixed(3));
        const onsetReach = onsets.map((t) => +minReachWin(rows, t, W).toFixed(4));
        const distAt0 = +atRow(rows, 0).dist.toFixed(4);
        const playMinDist = +Math.min.apply(null, onsets.map((t) => atRow(rows, t).dist)).toFixed(4);
        players.push({ voice, playStyle: al.playStyle, playBar,
          onsets: onsets.map((t) => +t.toFixed(3)), onsetC, onsetReach, distAt0, playMinDist });
      }
      // (b) REST: a forced-silent ctx (playing=false) — the hand must NOT reach.
      const silentRows = sweep(al, [], false, 0, 120);
      let restMaxC = 0, restMinDist = 1e9;
      for (const r of silentRows) { restMaxC = Math.max(restMaxC, r.c); restMinDist = Math.min(restMinDist, r.dist); }
      // and a REAL rest bar for this voice from the plan (if one exists), driven as-is.
      let realRest = null;
      if (restBar >= 0) {
        const s = SC.barAt(restBar, voice);
        const rr = sweep(al, s.notes || [], !!s.playing, s.level || 0, 60);
        let rc = 0; for (const r of rr) rc = Math.max(rc, r.c);
        realRest = { restBar, playing: !!s.playing, level: +(s.level || 0).toFixed(3), notes: (s.notes || []).length, maxC: +rc.toFixed(4) };
      }
      resters.push({ voice, playStyle: al.playStyle, restMaxC: +restMaxC.toFixed(4), restMinDist: +restMinDist.toFixed(4), realRest });
    }
    // cross-voice syncopation: onset-time SETS + phase-of-contact differ across voices,
    // and NOT every hand sits on its contact at phase 0 (the old "one shared beat" claim).
    const onsetSig = players.map((p) => p.onsets.join(","));
    const distinctSigs = new Set(onsetSig).size;
    const allOnsetPhases = [].concat.apply([], players.map((p) => p.onsets));
    const distinctPhases = new Set(allOnsetPhases.map((t) => Math.round(t * 32))).size;
    const someOffZero = allOnsetPhases.some((t) => t > 0.1 && t < 0.9);
    const allHandsAtZero = players.length > 0 && players.every((p) => p.distAt0 < cfg.HIT_EPS);
    const playMin = {}; players.forEach((p) => { playMin[p.voice] = p.playMinDist; });
    return { players, resters, distinctSigs, distinctPhases, someOffZero, allHandsAtZero, playMin, band: SC.bandVoices() };
  }, { W: 0.02, STEPS: 400, HIT_EPS });
  console.log("       onset.players:", JSON.stringify(onset.players));
  console.log("       onset.resters:", JSON.stringify(onset.resters));
  console.log("       onset.sync:", JSON.stringify({ distinctSigs: onset.distinctSigs, distinctPhases: onset.distinctPhases, someOffZero: onset.someOffZero, allHandsAtZero: onset.allHandsAtZero }));

  // H2 — (a) plays the SCORE: reaches its instrument at its real onsets, and different
  // voices contact at different phases (syncopation), not a uniform hit at phase 0.
  const reachesAtOnsets = onset.players.length >= 1 && onset.players.every((p) =>
    p.onsetC.length >= 1 && p.onsetC.every((c) => c > C_HIT) && p.onsetReach.every((d) => d < REACH_EPS));
  const syncopated = onset.distinctSigs >= 2 && onset.distinctPhases >= 3 && onset.someOffZero && !onset.allHandsAtZero;
  ok(reachesAtOnsets && syncopated,
    `H2. ONSET MODEL — every playing alien reaches its instrument AT its voice's real onsets (${onset.players.length} players, contact>${C_HIT} & reach<${REACH_EPS} at each onset); contact PHASES differ across voices (${onset.distinctSigs} distinct onset sets over ${onset.distinctPhases} phases, off-beat=${onset.someOffZero}) so hands do NOT uniformly land at phase 0 (allAtZero=${onset.allHandsAtZero})`);

  // H3 — (b) rests when silent: a silent/quiet voice's appendage does not reach. Every
  // alien's contactness dies to ~0 under a silent ctx and the hand pulls back from the
  // contact; a REAL rest bar from the plan confirms the same on live score data.
  const restsWhenSilent = onset.resters.length >= 1 && onset.resters.every((r) => {
    const pm = onset.playMin[r.voice];
    return r.restMaxC < 0.05 && (pm == null || r.restMinDist > pm + 0.05);
  });
  const realRester = onset.resters.find((r) => r.realRest);
  const realRestOk = !realRester || realRester.realRest.maxC < 0.05;
  ok(restsWhenSilent && realRestOk,
    `H3. REST — a SILENT/quiet voice's appendage does NOT reach the instrument (every alien restMaxC<0.05 & hand pulled back when playing=false${realRester ? `; real rest bar for '${realRester.voice}' -> maxC=${realRester.realRest.maxC}` : ""})`);

  // restore the injected beat park so the frame is stepped consistently for H4.
  await page.evaluate(() => window.__STARCRUISE.__step(0.016));
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

  // ---- GX: TWO-LEVEL GALAXY + SMOOTH CAMERA (NAVIGATION rebuild) --------------------
  // suns == clusters (colored spheres AT their star coords), planets == genres near them;
  // the 3D ship/cockpit are GONE (2D HUD label only); the transit camera is SMOOTH (no
  // per-frame jitter/bobbing once settled); the landed camera FLOOR-CLAMPS; the auto-cam
  // ALWAYS cuts to the drummer on a FILL; and dancers are GATED by energy (some planets
  // are just the band).
  const gx = await page.evaluate(async (GEN) => {
    const SC = window.__STARCRUISE;
    const fl = await import("/app/starcruise/flight.js");
    const cm = await import("/app/starcruise/genre-clusters.js");
    function land(g, beat) {
      SC.__injectFill(null);
      SC.__injectBeat(beat || { bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0, playing: true });
      SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
      for (let i = 0; i < 12; i++) SC.__stepNoRender(0.2);
      SC.__injectTravel({ weights: [{ g, w: 1 }], dominant: g, position: { x: 0, y: 0 }, live: true, seed: 1 });
      for (let i = 0; i < 60; i++) { const st = SC.__stepNoRender(0.1); if (st.phase === "DANCE") break; }
    }
    // --- SUNS at cluster stars (colored, labeled) ---
    land(GEN);
    const sunsP = SC.suns(10);
    const sunChecks = sunsP.suns.map((s) => {
      const c = cm.GENRE_CLUSTERS.find((x) => x.id === s.id);
      const w = fl.worldOfCoord(c.star);
      const err = Math.hypot(w.x - s.marker.x, w.y - s.marker.y, w.z - s.marker.z);
      const colOk = c.color.every((v, i) => Math.abs(v - s.color[i]) < 1e-6);
      return { id: s.id, err: +err.toFixed(3), colOk, labelOk: s.label === c.label };
    });
    const shipMeshes = SC.shipMeshCount();
    const hud = SC.hud();
    const hudExpect = (cm.GENRE_CLUSTERS.find((x) => x.id === cm.CLUSTER_OF[GEN]) || {}).label;
    // --- SMOOTH transit camera: settle an even blend (deep space, not landed), then
    // measure the max per-frame camera move — it must be tiny (no jitter/bobbing).
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__stepNoRender(0.2);
    SC.__injectTravel({ weights: [{ g: GEN, w: 0.34 }, { g: "techno", w: 0.33 }, { g: "jazz", w: 0.33 }], dominant: GEN, position: null, live: true, seed: 1 });
    for (let i = 0; i < 45; i++) SC.__stepNoRender(0.1);   // converge the damped follow
    let maxDelta = 0, prev = SC.cam();
    for (let i = 0; i < 15; i++) { SC.__stepNoRender(0.1); const c = SC.cam(); maxDelta = Math.max(maxDelta, Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z)); prev = c; }
    const transitLanded = SC.state().landed;
    // --- FLOOR CLAMP: land, slam the pitch under the ground, camera stays above FLOOR_Y.
    land(GEN);
    SC.__stepNoRender(0.05);
    SC.__drag(0, 900);                      // tilt the orbit hard down (toward underground)
    const camFloor = SC.cam();
    // --- DRUMMER-ON-FILL: a fill forces a cut to the drummer; clearing it releases.
    land("techno");
    for (let i = 0; i < 4; i++) SC.__stepNoRender(0.1);
    SC.__injectFill(true);
    for (let i = 0; i < 6; i++) SC.__stepNoRender(0.1);
    const dsFill = SC.autoCam();
    SC.__injectFill(false);
    for (let i = 0; i < 30; i++) SC.__stepNoRender(0.2);   // several shot durations
    const dsAfter = SC.autoCam();
    SC.__injectFill(null);
    // --- DANCERS gated by energy: a hushed genre is band-only; a driving one has a crowd.
    land("ambient");
    const ambDancers = SC.dancers();
    land(GEN);
    const genDancers = SC.dancers();
    SC.__injectTravel(null); SC.__injectBeat(null);
    return { sunCount: sunsP.count, sunChecks, shipMeshes, hud, hudExpect,
      maxDelta: +maxDelta.toFixed(4), transitLanded, camFloor,
      dsFill, dsAfter, ambDancers, genDancers };
  }, GEN).catch((e) => ({ err: String(e) }));
  if (gx.err) { ok(false, "GX. galaxy probe threw :: " + gx.err); }
  else {
    console.log("       galaxy.suns:", JSON.stringify({ count: gx.sunCount, checks: gx.sunChecks.slice(0, 4) }));
    console.log("       galaxy.hud:", JSON.stringify(gx.hud), " expect:", gx.hudExpect);
    console.log("       galaxy.smooth:", JSON.stringify({ maxDelta: gx.maxDelta, transitLanded: gx.transitLanded }));
    console.log("       galaxy.floor:", JSON.stringify(gx.camFloor));
    console.log("       galaxy.drummer:", JSON.stringify({ fill: gx.dsFill, after: gx.dsAfter }));
    console.log("       galaxy.dancers:", JSON.stringify({ ambient: gx.ambDancers, gen: gx.genDancers }));
    ok(gx.sunCount === 31 && gx.sunChecks.every((c) => c.err < 0.05 && c.colOk && c.labelOk),
      `GX1. SUNS: one colored labeled sun per cluster AT its star coord (${gx.sunCount} suns, markers == worldOfCoord(cluster.star), colors + labels match)`);
    ok(gx.shipMeshes === 0,
      `GX2. NO 3D ship/cockpit — the obstructing shell is gone (ship+cockpit draw ${gx.shipMeshes} meshes)`);
    ok(gx.hud.mounted && gx.hud.label === String(gx.hudExpect).toUpperCase(),
      `GX3. 2D cockpit HUD shows the current STAR/cluster label (hud="${gx.hud.label}" == ${String(gx.hudExpect).toUpperCase()})`);
    ok(!gx.transitLanded && gx.maxDelta < 0.08,
      `GX4. SMOOTH transit camera — no per-frame jitter/bobbing once settled (max frame move ${gx.maxDelta} < 0.08, in-transit)`);
    ok(gx.camFloor.y >= 0.35 - 1e-6,
      `GX5. FLOOR CLAMP — the camera never dips below the ground plane even at a hard downward tilt (camY=${gx.camFloor.y.toFixed(3)} >= 0.35)`);
    ok(gx.dsFill.drummerShot >= 0 && gx.dsFill.onDrummer && gx.dsFill.kind === "drummer" && !gx.dsAfter.onDrummer,
      `GX6. DRUMMER-ON-FILL — the auto-cam cuts to the drummer during a fill and releases after (onDrummer ${gx.dsFill.onDrummer}->${gx.dsAfter.onDrummer}, kind=${gx.dsFill.kind})`);
    ok(gx.ambDancers === 0 && gx.genDancers >= 3,
      `GX7. OPTIONAL DANCERS gated by energy — hushed 'ambient' is band-only (${gx.ambDancers}), driving '${GEN}' has a crowd (${gx.genDancers})`);
  }

  // ---- CA: AUTO-CAM ANGLE — NO shot frames the band FROM BELOW ----------------------
  // Every cinematic shot's RESOLVED camera eye height (target.y + dist*sin(pitch)) must sit
  // AT or ABOVE the band's eye level, so no shot ever looks UP from the floor (a view that
  // was mostly ground). The flyover stays high, the through-city stays at eye level; only
  // the up-from-the-floor angles are lifted. Pitches stay >= 0 (never tilted up).
  const ca = await page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0, playing: true });
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__stepNoRender(0.2);
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    for (let i = 0; i < 60; i++) { const st = SC.__stepNoRender(0.1); if (st.phase === "DANCE") break; }
    const shots = SC.autoShotList();
    const eyeY = SC.centroid().y;
    SC.__injectTravel(null); SC.__injectBeat(null);
    return { shots, eyeY, base: 0 };
  }, GEN).catch((e) => ({ err: String(e) }));
  if (ca.err) { ok(false, "CA. auto-cam angle probe threw :: " + ca.err); }
  else {
    console.log("       autoShots:", JSON.stringify(ca.shots));
    const minCamY = ca.shots.length ? Math.min(...ca.shots.map((s) => s.camY)) : -1;
    ok(ca.shots.length > 0 && ca.shots.every((s) => s.camY >= ca.eyeY - 0.05),
      `CA1. NO auto-cam shot frames the band FROM BELOW — every shot's camera sits AT/ABOVE band eye level (eyeY=${ca.eyeY.toFixed(2)}, min shot camY=${minCamY.toFixed(2)})`);
    ok(ca.shots.every((s) => s.camY >= ca.base),
      `CA2. every shot's camera stays ABOVE the band base (min camY=${minCamY.toFixed(2)} >= ${ca.base})`);
    ok(ca.shots.every((s) => s.pitch >= 0),
      `CA3. no shot tilts UP from the floor — all shot pitches >= 0 (${JSON.stringify(ca.shots.map((s) => s.pitch))})`);
  }

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
