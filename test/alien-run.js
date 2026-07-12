#!/usr/bin/env node
// alien-run.js — headless proof for app/starcruise/alien.js (the NON-HUMAN band
// creature that PLAYS THE SCORE). Drives index.html in headless chromium (WebGL via
// SwiftShader), imports THREE + the alien/traits modules in-page, and asserts:
//
//   A. makeAlien builds a valid rig for several members (drum / bass / lead / pad),
//      and each is a NON-HUMAN body (>8 child meshes, tentacle/radial/etc. plans);
//   B. SCORE TIMING — the playing appendage contacts the instrument at the ACTUAL
//      note ONSET times in ctx.notes (syncopation shows): sweeping barPhase over a
//      bar with a SCRIPTED syncopated onset list, contactness peaks (and reachDist
//      -> 0) AT each onset and is low BETWEEN onsets — and is LOW on a straight beat
//      slot that carries no onset (it plays the score, not a uniform pulse);
//   C. REST — with playing=false / level~0 the appendage does NOT reach the
//      instrument (contactness ~0 across the whole bar; the hand stays lowered);
//   C2. every body PLAN renders NON-BLANK on the real GL context;
//   D. PITCH biases the contact position (a low vs a high note land in different spots);
//   E. determinism — same (traits, member, seed) -> identical contact trace;
//   F. render-style shading (material treatments) + shadows are INTACT.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/alien-run.js
"use strict";
const path = require("path");
const { serve, installOfflineRoute } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8814;

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

async function inPage() {
  let THREE = await import("/vendor/three/three.module.min.js");
  if (THREE.default && !THREE.WebGLRenderer) THREE = THREE.default;
  const traitsMod = await import("/app/starcruise/traits.js");
  const alienMod = await import("/app/starcruise/alien.js");
  const makeAlien = alienMod.makeAlien;
  const K = window.GenreKernel, V = window.GenreVerifier;

  const genre = (K && K.GENRES && Object.keys(K.GENRES)[0]) || "vaporwave";
  const traits = traitsMod.traitsFromGenre(K, V, genre, 7);

  // players exercising every distinct playStyle: strike-down, pluck, bow, blow.
  const members = [
    { role: "drum", voice: "drums", instrument: { family: "membrane-sac", playStyle: "drum", appendage: 0, hitsPerBeat: 4 } },
    { role: "bass", voice: "bass", instrument: { family: "coil-resonator", playStyle: "pluck", appendage: 1, hitsPerBeat: 2 } },
    { role: "lead", voice: "lead", instrument: { family: "bladder-horn", playStyle: "blow", appendage: 2, hitsPerBeat: 1 } },
    { role: "pad", voice: "pad", instrument: { family: "glass-pane", playStyle: "bow", appendage: 3, hitsPerBeat: 1 } },
  ];

  // ---- scene + low-res target ---------------------------------------------------
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const LOW_W = 256, LOW_H = 192;
  const target = new THREE.WebGLRenderTarget(LOW_W, LOW_H,
    { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0410);
  scene.add(new THREE.AmbientLight(0x8899aa, 0.7));
  const sun = new THREE.DirectionalLight(0xffeedd, 0.9); sun.position.set(3, 6, 4); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(60, LOW_W / LOW_H, 0.1, 200);

  const out = { members: [], errors: [] };

  const aliens = members.map((m, i) => {
    const a = makeAlien(THREE, traits, m, 100 + i * 101);
    const n = members.length;
    a.group.position.x = (i - (n - 1) / 2) * 1.6;
    scene.add(a.group);
    return a;
  });
  camera.position.set(0, 1.2, 5.0);
  camera.lookAt(0, 0.8, 0);

  // count shadow-casting meshes across a rig (shadow intact proof).
  function shadowMeshes(a) { let n = 0; a.group.traverse((o) => { if (o.isMesh && o.castShadow) n++; }); return n; }

  // ---- sweep barPhase with a SCRIPTED onset list, capture contact trace ----------
  function sweep(al, notes, playing, steps) {
    const rows = [];
    for (let s = 0; s < steps; s++) {
      const bp = s / steps;
      al.update(0.016, { barPhase: bp, playing, level: playing ? 1 : 0, notes });
      const d = al.debug();
      rows.push({ bp, c: d.contactness, dist: d.dist, reach: d.reachDist, tip: d.handTip });
    }
    return rows;
  }
  const wrapDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };
  function at(rows, t) { let best = rows[0], bd = 1e9; for (const r of rows) { const dd = wrapDist(r.bp, t); if (dd < bd) { bd = dd; best = r; } } return best; }
  function maxCwin(rows, t, w) { let m = 0; for (const r of rows) if (wrapDist(r.bp, t) <= w) m = Math.max(m, r.c); return m; }
  function minReachWin(rows, t, w) { let m = 1e9; for (const r of rows) if (wrapDist(r.bp, t) <= w) m = Math.min(m, r.reach); return m; }
  function minDistWin(rows, t, w) { let m = 1e9; for (const r of rows) if (wrapDist(r.bp, t) <= w) m = Math.min(m, r.dist); return m; }

  const STEPS = 400, W = 0.02;
  // SYNCOPATED onsets — deliberately OFF the straight 1/4 grid (0.25/0.5/0.75) so a
  // uniform-beat animation would MISS them. 0.375 and 0.6875 are the syncopations.
  const onsetSets = {
    drum: [0.0, 0.375, 0.6875],
    bass: [0.0, 0.5, 0.8125],
    lead: [{ t: 0.0, dur: 0.25 }, { t: 0.5, dur: 0.2 }],     // sustained (held) notes
    pad: [{ t: 0.0, dur: 0.4 }, { t: 0.55, dur: 0.35 }],
  };
  const asNotes = (arr) => arr.map((x) => (typeof x === "number" ? { t: x } : x));

  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i], role = members[i].role;
    const raw = onsetSets[role];
    const notes = asNotes(raw);
    const rows = sweep(a, notes, true, STEPS);
    const onsets = notes.map((n) => n.t);
    // at each onset: contact lands (contactness high, appendage reaches its target).
    const onsetC = onsets.map((t) => +maxCwin(rows, t, W).toFixed(3));
    const onsetReach = onsets.map((t) => +minReachWin(rows, t, W).toFixed(4));
    const onsetDist = onsets.map((t) => +minDistWin(rows, t, W).toFixed(4));
    // BETWEEN onsets: sample TRUE silent gaps (phases maximally far from any onset /
    // outside any held-note span) — the appendage should be idle there. (Sustained
    // pad plays long notes covering most of the bar, so it has only one real gap.)
    const gapMap = { drum: [0.1875, 0.53, 0.85], bass: [0.25, 0.655], lead: [0.35, 0.85], pad: [0.49] };
    const gapPts = gapMap[role];
    const gapC = gapPts.map((t) => +at(rows, t).c.toFixed(3));
    // a STRAIGHT-beat slot that carries NO onset — proves it plays the score, not a
    // uniform pulse. 0.25 is a straight quarter but not in any onset set above.
    const straightBeatC = +at(rows, 0.25).c.toFixed(3);

    // REST: playing=false — the appendage must NOT reach the instrument.
    const restRows = sweep(a, notes, false, 120);
    let restMaxC = 0, restMinDist = 1e9;
    for (const r of restRows) { restMaxC = Math.max(restMaxC, r.c); restMinDist = Math.min(restMinDist, r.dist); }

    out.members.push({
      role, voice: a.voice, playStyle: a.playStyle, plan: a.plan,
      childCount: a.group.children.length, shadowMeshes: shadowMeshes(a),
      sustained: role === "lead" || role === "pad",
      onsets, onsetC, onsetReach, onsetDist, gapC, straightBeatC,
      restMaxC: +restMaxC.toFixed(4), restMinDist: +restMinDist.toFixed(4),
      playingMinDist: +Math.min(...onsetDist).toFixed(4),
    });
  }

  // ---- C2: every BODY PLAN builds + renders NON-BLANK ---------------------------
  const PLANS = ["radial", "cephalopod", "insectoid", "blob", "stalk", "crystalline", "gas"];
  out.plans = {};
  for (const plan of PLANS) {
    const tr = Object.assign({}, traits, { body: Object.assign({}, traits.body, { plan }) });
    const al = makeAlien(THREE, tr, members[0], 55);
    al.update(0.05, { barPhase: 0.2, playing: true, level: 1, notes: [{ t: 0.2 }] });
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x0a0410);
    sc.add(new THREE.AmbientLight(0x8899aa, 0.7));
    const dl = new THREE.DirectionalLight(0xffeedd, 0.9); dl.position.set(3, 6, 4); sc.add(dl);
    sc.add(al.group);
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(sc, camera);
    const b = new Uint8Array(LOW_W * LOW_H * 4);
    renderer.readRenderTargetPixels(target, 0, 0, LOW_W, LOW_H, b);
    let mn = 255, mx = 0, nb = 0;
    for (let k = 0; k < b.length; k += 4) {
      const r = b[k], g = b[k + 1], bl = b[k + 2];
      mn = Math.min(mn, r, g, bl); mx = Math.max(mx, r, g, bl);
      if (r > 20 || g > 20 || bl > 30) nb++;
    }
    out.plans[plan] = { childCount: al.group.children.length, spread: mx - mn, nonBg: nb };
  }
  out.allPlansNonBlank = Object.values(out.plans).every((p) => p.childCount > 8 && p.spread > 8 && p.nonBg > 120);

  // ---- D: PITCH biases the contact position -------------------------------------
  const drumM = members[0];
  const aLow = makeAlien(THREE, traits, drumM, 7);
  const aHigh = makeAlien(THREE, traits, drumM, 7);
  aLow.update(0.016, { barPhase: 0.0, playing: true, level: 1, notes: [{ t: 0.0, pitch: 38 }] });
  aHigh.update(0.016, { barPhase: 0.0, playing: true, level: 1, notes: [{ t: 0.0, pitch: 82 }] });
  const tl = aLow.debug().handTip, th = aHigh.debug().handTip;
  out.pitchShift = +Math.hypot(tl.x - th.x, tl.y - th.y, tl.z - th.z).toFixed(4);

  // ---- render the whole band NON-BLANK ------------------------------------------
  for (let i = 0; i < aliens.length; i++) aliens[i].update(0.016, { barPhase: 0.25, playing: true, level: 1, notes: asNotes(onsetSets[members[i].role]) });
  renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
  const buf = new Uint8Array(LOW_W * LOW_H * 4);
  renderer.readRenderTargetPixels(target, 0, 0, LOW_W, LOW_H, buf);
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0, nonBg = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    minG = Math.min(minG, g); maxG = Math.max(maxG, g);
    minB = Math.min(minB, b); maxB = Math.max(maxB, b);
    if (r > 20 || g > 20 || b > 30) nonBg++;
  }
  out.render = { spread: Math.max(maxR - minR, maxG - minG, maxB - minB), nonBg };

  // ---- E: determinism — same inputs -> identical contact trace -------------------
  const traceOf = (al) => sweep(al, asNotes(onsetSets.drum), true, 64).map((r) => r.c);
  const t1 = traceOf(makeAlien(THREE, traits, drumM, 42));
  const t2 = traceOf(makeAlien(THREE, traits, drumM, 42));
  out.deterministic = t1.length === t2.length && t1.every((v, k) => Math.abs(v - t2[k]) < 1e-9);

  // ---- F: RENDER STYLE — surfaces SHADE differently (material treatments) --------
  function sig(a) {
    const m = a.materials[0];
    const key = m.customProgramCacheKey ? m.customProgramCacheKey() : "";
    return {
      type: m.type, toon: !!m.isMeshToonMaterial, wire: !!m.wireframe,
      smooth: m.flatShading === false, shader: /^sc_/.test(key) ? key : null,
    };
  }
  const withStyle = (mat) => Object.assign({}, traits, { renderStyle: { material: mat } });
  out.styles = {};
  for (const s of ["flat", "cel", "iridescent", "wireframe", "glitch", "matte"]) out.styles[s] = sig(makeAlien(THREE, withStyle(s), drumM, 9));
  const J = (o) => JSON.stringify(o);
  out.styleDistinct = J(out.styles.cel) !== J(out.styles.iridescent)
    && J(out.styles.flat) !== J(out.styles.glitch) && J(out.styles.flat) !== J(out.styles.wireframe)
    && J(out.styles.flat) !== J(out.styles.cel) && J(out.styles.flat) !== J(out.styles.matte);
  out.styleTreated = out.styles.cel.toon && out.styles.iridescent.shader === "sc_irid"
    && out.styles.glitch.shader === "sc_glitch" && out.styles.wireframe.wire && out.styles.matte.smooth
    && out.styles.flat.type === "MeshLambertMaterial" && !out.styles.flat.shader && !out.styles.flat.toon;

  out.styleRender = {};
  for (const s of ["flat", "cel", "iridescent", "wireframe", "glitch", "matte"]) {
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x0a0410);
    sc.add(new THREE.AmbientLight(0x8899aa, 0.7));
    const dl = new THREE.DirectionalLight(0xffeedd, 0.9); dl.position.set(3, 6, 4); sc.add(dl);
    const al = makeAlien(THREE, withStyle(s), drumM, 9);
    al.update(0.05, { barPhase: 0.5, playing: true, level: 1, notes: [{ t: 0.5 }] });
    sc.add(al.group);
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(sc, camera);
    const b = new Uint8Array(LOW_W * LOW_H * 4);
    renderer.readRenderTargetPixels(target, 0, 0, LOW_W, LOW_H, b);
    let mn = 255, mx = 0, nb = 0;
    for (let i = 0; i < b.length; i += 4) {
      const r = b[i], g = b[i + 1], bl = b[i + 2];
      mn = Math.min(mn, r, g, bl); mx = Math.max(mx, r, g, bl);
      if (r > 20 || g > 20 || bl > 30) nb++;
    }
    out.styleRender[s] = { spread: mx - mn, nonBg: nb };
  }
  out.allStylesRender = Object.values(out.styleRender).every((v) => v.spread > 8 && v.nonBg > 120);

  // ---- H: PER-ALIEN RANDOMIZATION — same genre + same member, DIFFERENT seeds ->
  // visibly different rigs (proportions/appendage-count/orb jitter off the OWN seed).
  function rigSig(al) {
    al.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(al.group);
    const sz = new THREE.Vector3(); box.getSize(sz);
    let meshes = 0; al.group.traverse((o) => { if (o.isMesh) meshes++; });
    return { sx: +sz.x.toFixed(3), sy: +sz.y.toFixed(3), sz: +sz.z.toFixed(3), meshes };
  }
  const randSeeds = [11, 202, 3003, 40004, 555];
  out.randomSigs = randSeeds.map((s) => {
    const a = makeAlien(THREE, traits, members[0], s);
    a.update(0.016, { barPhase: 0.0, playing: true, level: 1, notes: [{ t: 0.0 }] });
    return rigSig(a);
  });
  out.randomDistinct = new Set(out.randomSigs.map((s) => JSON.stringify(s))).size === out.randomSigs.length;

  // ---- I: MOTION scales with VOLUME — a player's body groove travels MORE when its
  // voice is loud than when quiet (smooth continuum). notes:[] isolates the GROOVE
  // (no onset contact), so this measures the volume-driven body amplitude only.
  function bodyTravel(al, lvl, steps) {
    let loY = 1e9, hiY = -1e9, loZ = 1e9, hiZ = -1e9;
    for (let s = 0; s < steps; s++) {
      al.update(0.016, { barPhase: s / steps, playing: true, level: lvl, notes: [] });
      loY = Math.min(loY, al.group.position.y); hiY = Math.max(hiY, al.group.position.y);
      loZ = Math.min(loZ, al.group.rotation.z); hiZ = Math.max(hiZ, al.group.rotation.z);
    }
    return +((hiY - loY) + Math.abs(hiZ - loZ)).toFixed(5);
  }
  out.motionLoud = bodyTravel(makeAlien(THREE, traits, members[0], 7), 1.0, 120);
  out.motionQuiet = bodyTravel(makeAlien(THREE, traits, members[0], 7), 0.15, 120);
  out.motionScalesWithLevel = out.motionLoud > out.motionQuiet + 0.002;

  // ---- J: DE-SQUARE — the rig is built from CURVES, not cubes. Census geometry
  // families across the whole band: spheres/cones/tori/cylinders dominate; the few
  // remaining boxes (thin panes/lips/slits) are a small minority.
  const census = {};
  for (const a of aliens) {
    a.group.traverse((o) => { if (o.isMesh && o.geometry) { const t = o.geometry.type; census[t] = (census[t] || 0) + 1; } });
  }
  out.shapeCensus = census;
  out.boxMeshes = census.BoxGeometry || 0;
  out.roundMeshes = (census.SphereGeometry || 0) + (census.ConeGeometry || 0) +
    (census.CylinderGeometry || 0) + (census.TorusGeometry || 0) + (census.IcosahedronGeometry || 0);
  out.mostlyRound = out.roundMeshes > out.boxMeshes * 2 &&
    (census.SphereGeometry || 0) >= 4 && (census.ConeGeometry || 0) >= 2;

  renderer.setRenderTarget(null);
  target.dispose(); renderer.dispose();
  return out;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchGL();
  const page = await browser.newPage();
  // OFFLINE: stub Google-Fonts + esm.sh and neutralise the full-app boot (this
  // probe imports the star-cruise submodules directly and never needs the app
  // store) so the page loads with no network and no slow/crashy boot.
  await installOfflineRoute(page, PORT, { neutralizeMain: true });
  const perr = [];
  page.on("pageerror", (e) => perr.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") perr.push("console:" + m.text()); });
  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => document.readyState === "complete", { timeout: 20000 });
  await page.waitForTimeout(300);

  let R;
  try { R = await page.evaluate(inPage); }
  catch (e) { console.error("in-page eval threw:", e); await browser.close(); srv.close(); process.exit(1); }

  console.log("\n  RESULT:", JSON.stringify(R, null, 2), "\n");

  ok(R.members.length === 4, `A1. built ${R.members.length} player aliens (drum/bass/lead/pad)`);
  ok(R.members.every((m) => m.childCount > 8), "A2. each rig has a real NON-HUMAN body (>8 child meshes)");
  ok(R.members.every((m) => m.shadowMeshes > 8), "A3. shadows intact (castShadow meshes on every rig)");

  // B — contact lands at the ACTUAL onsets (syncopation), rests between + off-beat.
  for (const m of R.members) {
    ok(m.onsetC.every((c) => c > 0.82), `B[${m.role}/${m.playStyle}]. contact at EVERY real onset ${JSON.stringify(m.onsets)} (contactness ${JSON.stringify(m.onsetC)} all > 0.82)`);
    ok(m.onsetReach.every((d) => d < 0.03), `B2[${m.role}]. appendage REACHES the instrument at onsets (reachDist ${JSON.stringify(m.onsetReach)} all < 0.03)`);
    ok(m.gapC.every((c) => c < 0.35), `B3[${m.role}]. rests BETWEEN notes (gap contactness ${JSON.stringify(m.gapC)} all < 0.35)`);
  }
  // the crisp "plays the score, not a uniform beat" proof: the syncopated drummer
  // is engaged at 0.375 (an off-grid onset) but idle at 0.25 (a straight beat slot).
  const drum = R.members.find((m) => m.role === "drum");
  ok(drum.straightBeatC < 0.35, `B4. drummer IDLE on the empty straight-beat slot (t=0.25 contactness=${drum.straightBeatC} < 0.35) — it follows the score, not the pulse`);

  // C — rest when the voice is silent/quiet.
  for (const m of R.members) {
    ok(m.restMaxC < 0.05, `C[${m.role}]. RESTS when playing=false (max contactness=${m.restMaxC} < 0.05)`);
    ok(m.restMinDist > m.playingMinDist + 0.08, `C2[${m.role}]. appendage does NOT reach the instrument at rest (restMinDist=${m.restMinDist} >> playing ${m.playingMinDist})`);
  }

  ok(R.allPlansNonBlank, "C3. every BODY PLAN (radial/cephalopod/insectoid/blob/stalk/crystalline/gas) renders non-blank");
  ok(R.pitchShift > 0.05, `D1. note PITCH biases contact position (low vs high note tip delta=${R.pitchShift} > 0.05)`);

  ok(R.render.spread > 8, `E1. NON-BLANK band render (colour spread=${R.render.spread})`);
  ok(R.render.nonBg > 200, `E2. real geometry drawn (${R.render.nonBg} non-bg px)`);
  ok(R.deterministic, "E3. deterministic: same (traits,member,seed) -> identical contact trace");

  ok(R.styleDistinct, "F1. material DIFFERS by renderStyle.material (flat/cel/iridescent/wireframe/glitch/matte distinct)");
  ok(R.styleTreated, "F2. each style applies its treatment (cel=toon, iridescent/glitch=shader, wireframe=wire, matte=smooth, flat=plain Lambert)");
  ok(R.allStylesRender, "F3. every style COMPILES + renders non-blank on GL");

  ok(R.randomDistinct, `H1. PER-ALIEN randomization: 5 seeds of one genre+member -> 5 DISTINCT rigs (bbox/mesh sigs ${JSON.stringify(R.randomSigs)})`);
  ok(R.motionScalesWithLevel, `I1. MOTION amplitude scales with VOLUME: loud groove=${R.motionLoud} > quiet groove=${R.motionQuiet} (smooth continuum)`);
  ok(R.mostlyRound, `J1. DE-SQUARE: the band is CURVES not cubes (round=${R.roundMeshes} >> box=${R.boxMeshes}; census ${JSON.stringify(R.shapeCensus)})`);

  ok(perr.length === 0, "G1. no console/page errors" + (perr.length ? " :: " + perr.join(" | ") : ""));

  await browser.close(); srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
