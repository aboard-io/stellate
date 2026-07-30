#!/usr/bin/env node
// test/starcruise/alien.test.js — headless proof for app/starcruise/alien.js (the NON-HUMAN band
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
//   node test/starcruise/alien.test.js
"use strict";
const path = require("path");
const { serve, installOfflineRoute } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", "..");
let PORT = 8814;

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
  // READABLE vocabulary only — flat/cel/iridescent/pbr/matte.
  for (const s of ["flat", "cel", "iridescent", "pbr", "matte"]) out.styles[s] = sig(makeAlien(THREE, withStyle(s), drumM, 9));
  // DROPPED illegible treatments must FALL BACK to a clean flat surface (never wire/glitch).
  for (const s of ["wireframe", "glitch", "mesh", "pure-mesh"]) out.styles[s] = sig(makeAlien(THREE, withStyle(s), drumM, 9));
  const J = (o) => JSON.stringify(o);
  out.styleDistinct = J(out.styles.cel) !== J(out.styles.iridescent)
    && J(out.styles.flat) !== J(out.styles.cel) && J(out.styles.flat) !== J(out.styles.matte)
    && J(out.styles.flat) !== J(out.styles.iridescent) && J(out.styles.flat) !== J(out.styles.pbr);
  out.styleTreated = out.styles.cel.toon && out.styles.iridescent.shader === "sc_irid"
    && out.styles.matte.smooth && out.styles.pbr.type === "MeshStandardMaterial"
    && out.styles.flat.type === "MeshLambertMaterial" && !out.styles.flat.shader && !out.styles.flat.toon && !out.styles.flat.wire;
  // READABLE law: every dropped style reads as legible flat (no wireframe, no glitch skin).
  out.readableSet = ["wireframe", "glitch", "mesh", "pure-mesh"].every((s) =>
    out.styles[s].wire === false && out.styles[s].shader !== "sc_glitch"
    && J(out.styles[s]) === J(out.styles.flat));

  out.styleRender = {};
  for (const s of ["flat", "cel", "iridescent", "pbr", "matte"]) {
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
  // merged/superquadric BufferGeometry are curved masses too — count them as round (the
  // mesh-count reduction pass merges static cone/plate decoration INTO BufferGeometry, so a
  // literal ConeGeometry count is no longer meaningful; what matters is boxes vs curves).
  out.roundMeshes = (census.SphereGeometry || 0) + (census.ConeGeometry || 0) +
    (census.CylinderGeometry || 0) + (census.TorusGeometry || 0) + (census.IcosahedronGeometry || 0) +
    (census.BufferGeometry || 0);
  out.mostlyRound = out.roundMeshes > out.boxMeshes * 2 && (census.SphereGeometry || 0) >= 4;

  // ---- K: SUPERQUADRIC + curve-TUBE census (richer procedural geometry) -----------
  out.superquadricMeshes = census.BufferGeometry || 0;   // hand-rolled superellipsoids
  out.tubeMeshes = census.TubeGeometry || 0;             // CatmullRom curve-swept tubes
  out.hasSuperquadric = out.superquadricMeshes >= 4;
  out.hasTube = out.tubeMeshes >= 3;
  out.fewerBoxes = (census.BoxGeometry || 0) <= 4;

  // ---- L: PBR renderStyle uses a REAL MeshStandardMaterial + the shared env map ----
  const pbrAlien = makeAlien(THREE, withStyle("pbr"), drumM, 9);
  const pbrMat = pbrAlien.materials[0];
  out.pbr = {
    type: pbrMat.type, isStandard: !!pbrMat.isMeshStandardMaterial,
    hasEnvMap: !!pbrMat.envMap, metalness: pbrMat.metalness, roughness: pbrMat.roughness,
  };
  {
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0a0410);
    sc.add(new THREE.AmbientLight(0x8899aa, 0.7));
    const dl = new THREE.DirectionalLight(0xffeedd, 0.9); dl.position.set(3, 6, 4); sc.add(dl);
    pbrAlien.update(0.05, { barPhase: 0.5, playing: true, level: 1, notes: [{ t: 0.5 }] });
    sc.add(pbrAlien.group);
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(sc, camera);
    const b = new Uint8Array(LOW_W * LOW_H * 4);
    renderer.readRenderTargetPixels(target, 0, 0, LOW_W, LOW_H, b);
    let mn = 255, mx = 0, nb = 0;
    for (let k = 0; k < b.length; k += 4) { const r = b[k], g = b[k + 1], bl = b[k + 2]; mn = Math.min(mn, r, g, bl); mx = Math.max(mx, r, g, bl); if (r > 20 || g > 20 || bl > 30) nb++; }
    out.pbr.spread = mx - mn; out.pbr.nonBg = nb;
  }

  // ---- M: FABRIK IK — the geom solver reaches its target (bones + base preserved),
  // and a body plan WITH tentacles poses at least one tentacle to reach its curl target.
  const GEOM = await import("/app/starcruise/geom.js");
  const chain = []; for (let i = 0; i < 7; i++) chain.push(new THREE.Vector3(0, i * 0.25, 0));   // reach 1.5
  const fTarget = new THREE.Vector3(0.6, 0.8, 0.35);
  GEOM.fabrik(chain, fTarget, { iters: 10 });
  let boneErr = 0; for (let i = 0; i < 6; i++) boneErr = Math.max(boneErr, Math.abs(chain[i + 1].distanceTo(chain[i]) - 0.25));
  out.fabrik = {
    err: +chain[6].distanceTo(fTarget).toFixed(4), boneErr: +boneErr.toFixed(4), baseFixed: +chain[0].length().toFixed(4),
  };
  const tentTraits = Object.assign({}, traits, { body: Object.assign({}, traits.body, { plan: "cephalopod", tentacles: 5, arms: 2 }) });
  out.tentacleProof = makeAlien(THREE, tentTraits, members[0], 55).tentacleProof;

  // ---- N: CONTIGUOUS — every rig is ONE connected mesh cluster (no floating parts).
  // Inflate each mesh's world AABB by a small fraction of the rig size; parts whose
  // inflated boxes touch are joined (union-find). A contiguous creature => 1 component.
  function contiguity(al, inflFrac) {
    al.group.updateMatrixWorld(true);
    const boxes = []; let maxDim = 0;
    al.group.traverse((o) => {
      if (o.isMesh && o.geometry) {
        const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return;
        const s = new THREE.Vector3(); b.getSize(s); maxDim = Math.max(maxDim, s.x, s.y, s.z); boxes.push(b);
      }
    });
    const infl = maxDim * inflFrac;
    const bb = boxes.map((b) => b.clone().expandByScalar(infl));
    const n = bb.length, parent = Array.from({ length: n }, (_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (bb[i].intersectsBox(bb[j])) parent[find(i)] = find(j);
    const roots = new Set(); for (let i = 0; i < n; i++) roots.add(find(i));
    return { meshes: n, components: roots.size };
  }
  out.contiguity = [];
  for (let i = 0; i < aliens.length; i++) {
    // pose the player AT an onset so its hand is ON the instrument (a natural play pose).
    aliens[i].update(0.016, { barPhase: 0.0, playing: true, level: 1, notes: [{ t: 0.0 }] });
    out.contiguity.push(Object.assign({ role: members[i].role }, contiguity(aliens[i], 0.05)));
  }
  const dContig = makeAlien(THREE, traits, { role: "dancer" }, 909);
  dContig.update(0.016, { barPhase: 0.3, playing: true, level: 1, notes: [] });
  out.contiguity.push(Object.assign({ role: "dancer" }, contiguity(dContig, 0.05)));
  out.allContiguous = out.contiguity.every((c) => c.components === 1);

  // ---- O: FLOOR — feet/body never dip below the ground plane across a motion sweep
  // (playing AND resting for players; loud AND quiet for the dancer). footWorldY() is
  // the world-space lowest point; groundY defaults to 0, so it must stay >= ~0.
  function minFoot(al, ctxs) { let m = 1e9; for (const c of ctxs) { al.update(0.016, c); m = Math.min(m, al.footWorldY()); } return +m.toFixed(4); }
  out.floor = [];
  for (let i = 0; i < aliens.length; i++) {
    const ctxs = [];
    for (let s = 0; s < 24; s++) ctxs.push({ barPhase: s / 24, playing: true, level: 1, notes: asNotes(onsetSets[members[i].role]) });
    for (let s = 0; s < 8; s++) ctxs.push({ barPhase: s / 8, playing: false, level: 0, notes: [] });   // resting: instrument lowers
    out.floor.push({ role: members[i].role, minFootY: minFoot(aliens[i], ctxs) });
  }
  {
    const dFloor = makeAlien(THREE, traits, { role: "dancer" }, 55), ctxs = [];
    for (let s = 0; s < 24; s++) ctxs.push({ barPhase: s / 24, playing: true, level: 1, loudness: 1, notes: [] });
    for (let s = 0; s < 8; s++) ctxs.push({ barPhase: s / 8, playing: true, level: 0.1, loudness: 0.05, notes: [] });
    out.floor.push({ role: "dancer", minFootY: minFoot(dFloor, ctxs) });
  }
  out.floorOK = out.floor.every((f) => f.minFootY >= -0.02);
  // FEET TOUCH THE GROUND (not floating): the LOWEST foot point across the motion sweep must
  // rest at/just above the local ground (y ≈ 0), never hovering. Players stand near-still so
  // they plant tight; dancers bounce/sway so their lowest still reaches near the floor.
  out.floorTouch = out.floor.every((f) => f.minFootY <= (f.role === "dancer" ? 0.16 : 0.11));

  // ---- P: PER-ALIEN COLOUR — two aliens of the SAME genre+member but DIFFERENT seeds
  // wear DIFFERENT palettes (individually distinguishable); same seed => same palette.
  const cA = makeAlien(THREE, traits, members[0], 1234);
  const cB = makeAlien(THREE, traits, members[0], 5678);
  const cC = makeAlien(THREE, traits, members[0], 1234);
  out.palA = cA.palette; out.palB = cB.palette; out.palC = cC.palette;
  out.colorsDistinct = cA.palette.skin !== cB.palette.skin && cA.palette.cloth !== cB.palette.cloth;
  out.colorDeterministic = cA.palette.skin === cC.palette.skin && cA.palette.cloth === cC.palette.cloth && cA.palette.accent === cC.palette.accent;

  // ---- Q: DRUMMER — the arm SNAPS a big arc onto the drum AT the onset (fast, real
  // onset speed): full at the onset (contact), lifted just an approach-window before.
  {
    const dr = aliens[0], dn = asNotes(onsetSets.drum);
    dr.update(0.0, { barPhase: 0.375 - 0.05, playing: true, level: 1, notes: dn }); const pre = dr.debug();
    dr.update(0.0, { barPhase: 0.375, playing: true, level: 1, notes: dn }); const on = dr.debug();
    out.drum = {
      contactAtOnset: +on.contactness.toFixed(3), reachAtOnset: +on.reachDist.toFixed(4),
      windupTravel: +Math.hypot(on.handTip.x - pre.handTip.x, on.handTip.y - pre.handTip.y, on.handTip.z - pre.handTip.z).toFixed(4),
    };
    out.drummerStrikes = out.drum.contactAtOnset > 0.82 && out.drum.reachAtOnset < 0.03 && out.drum.windupTravel > 0.12;
  }

  // ---- R: LIMB KEEP-OUT — no player-limb SEGMENT penetrates the torso core, while the
  // onset arm-CONTACT still reaches. Sweep the bar; each frame sample the player arm's
  // segments (root->elbow->wrist->tip) vs the core keep-out shell (limbProbe) and take the
  // WORST clearance; also confirm the onset reach stays tight (< 0.05) with the clamp active.
  out.keepout = [];
  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i], notes = asNotes(onsetSets[members[i].role]);
    let minRatio = 1e9;
    for (let s = 0; s < 240; s++) {
      a.update(0.016, { barPhase: s / 240, playing: true, level: 1, notes });
      const lp = a.limbProbe();
      minRatio = Math.min(minRatio, lp.minClear / lp.keepR);
    }
    // onset reach still lands ON the instrument (play-the-score law preserved).
    const rows = sweep(a, notes, true, 400);
    const onReach = Math.max(...notes.map((n) => minReachWin(rows, n.t, 0.02)));
    out.keepout.push({ role: members[i].role, minRatio: +minRatio.toFixed(3), onReach: +onReach.toFixed(4) });
  }
  out.limbsClearCore = out.keepout.every((k) => k.minRatio >= 0.98);   // no segment inside the shell (tiny tol)
  out.contactStillReaches = out.keepout.every((k) => k.onReach < 0.05);

  // ---- S: INSTRUMENT COLOUR — each instrument wears a BOLD colour that CONTRASTS its
  // alien (complementary hue -> large hue distance), saturated + light enough to pop, held
  // per player. Deterministic (from the alien's own colour). Compare instrument vs body hue.
  function hslOf(hex) { const c = new THREE.Color("#" + hex); const o = { h: 0, s: 0, l: 0 }; c.getHSL(o); return o; }
  const hueDist = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
  out.instColour = aliens.map((al, i) => {
    const body = hslOf(al.palette.skin), inst = hslOf(al.palette.instrument);
    return { role: members[i].role, bodyHue: +body.h.toFixed(3), instHue: +inst.h.toFixed(3),
      hueDist: +hueDist(body.h, inst.h).toFixed(3), instSat: +inst.s.toFixed(3), instL: +inst.l.toFixed(3) };
  });
  out.instContrastsBody = out.instColour.every((c) => c.hueDist > 0.35 && c.instSat > 0.4 && c.instL > 0.3);
  // determinism: same seed -> same instrument colour.
  out.instColourDeterministic = makeAlien(THREE, traits, members[0], 4242).palette.instrument
    === makeAlien(THREE, traits, members[0], 4242).palette.instrument;

  // ---- T: FUSED MARCHING-CUBES BODY CORE — the central body mass is a baked STATIC
  // isosurface (single connected surface, a BufferGeometry, NOT rebuilt per frame), and
  // MarchingCubes is imported from our VENDOR, never a CDN.
  out.core = aliens.map((al, i) => Object.assign({ role: members[i].role }, al.coreInfo()));
  out.coreIsMarchingFused = out.core.every((c) =>
    c.isMarching && c.isBufferGeometry && c.isFusedCore && c.hasImport && c.vertexCount > 0 && c.components === 1);
  // it is BAKED ONCE: the geometry vertex count does not change as we animate frames.
  {
    const before = aliens[0].coreInfo().vertexCount;
    for (let s = 0; s < 20; s++) aliens[0].update(0.016, { barPhase: s / 20, playing: true, level: 1, notes: asNotes(onsetSets.drum) });
    out.coreStaticAcrossFrames = aliens[0].coreInfo().vertexCount === before && before > 0;
  }
  // import-source proof: the vendored MarchingCubes imports the vendored THREE core, no CDN.
  {
    const src = await (await fetch("/vendor/three/MarchingCubes.js")).text();
    out.mcImportsVendor = /from\s*['"]\.\/three\.module\.min\.js['"]/.test(src);
    out.mcNoCdn = !/https?:\/\//.test(src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""));
  }

  // ---- U: TWO-TENTACLE DRUMMER — the drummer strikes with >= 2 appendages, both landing
  // on the drum contact at a drum onset.
  {
    const dr = aliens[0], dn = asNotes(onsetSets.drum);
    dr.update(0.0, { barPhase: 0.375, playing: true, level: 1, notes: dn });
    out.drumStrikers = dr.strikerProbe();
  }
  out.drummerTwoTentacles = out.drumStrikers.count >= 2 && out.drumStrikers.strikers.every((s) => s.contactDist < 0.05);

  // ---- V: NO black-circle blob-shadow DISC remains under any alien.
  out.discs = aliens.map((al, i) => Object.assign({ role: members[i].role }, al.discProbe()));
  {
    const dsc = makeAlien(THREE, traits, { role: "dancer" }, 71);
    dsc.update(0.016, { barPhase: 0.2, playing: true, level: 1, notes: [] });
    out.discs.push(Object.assign({ role: "dancer" }, dsc.discProbe()));
  }
  out.noDarkDiscs = out.discs.every((d) => d.darkDiscs === 0);

  // ---- W: VISIBLE ARTICULATED JOINTS (goals 0-4) --------------------------------
  // (SH) EVERY limb carries a body-entry JOINT (a shoulder/hip/socket knob seated on the
  //      marching-cubes core) so it reads as attached-at-a-joint, not fused smoothly in;
  // (A)  the PLAYING arm has >= 2 joints (a visible ELBOW + WRIST knob) and the mid joint
  //      (elbow) actually BENDS as the hand reaches — its interior angle CHANGES between an
  //      onset pose (hand at the instrument) and a between-onset windup pose — while the
  //      onset contact still reaches (reach < 0.05).
  out.joints = [];
  const impulseRole = { drum: 1, bass: 1 };   // strike/pluck — the elbow visibly windups→strikes
  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i], role = members[i].role, notes = asNotes(onsetSets[role]);
    // onset arm-reach (min over a tiny window) — the play-the-score contact law, joints on.
    const rows = sweep(a, notes, true, 400);
    const onsetReach = Math.max(...notes.map((n) => minReachWin(rows, n.t, 0.02)));
    // elbow interior angle at the ONSET contact (arm FLEXED to place the hand ON the
    // instrument via the 2-bone IK — a bent elbow, not a rigid straight stick).
    const onT = notes[0].t;
    a.update(0.0, { barPhase: onT, playing: true, level: 1, notes });
    const jOn = a.jointProbe();
    const elbowOnset = jOn.playerElbowAngle;
    // sweep the PLAYING bar and take the elbow-angle RANGE — the mid joint ARTICULATES as
    // the hand travels (windup -> strike). Impulse styles (strike/pluck) flex a big arc;
    // sustained styles (bow/blow) hold a flexed contact (small range) — both are jointed.
    let elo = 9, ehi = -9;
    for (let s = 0; s < 120; s++) {
      a.update(0.016, { barPhase: s / 120, playing: true, level: 1, notes });
      const e = a.jointProbe().playerElbowAngle; elo = Math.min(elo, e); ehi = Math.max(ehi, e);
    }
    out.joints.push({
      role, kinds: jOn.kinds, impulse: !!impulseRole[role],
      limbCount: jOn.limbCount, bodyEntryJoints: jOn.bodyEntryJoints, everyLimbHasEntry: jOn.everyLimbHasEntry,
      playerArmJoints: jOn.playerArmJoints, elbowKnob: jOn.playerElbowKnob, wristKnob: jOn.playerWristKnob,
      elbowOnset: +elbowOnset.toFixed(4),
      elbowFlexed: elbowOnset < 2.85,                       // clearly bent at the contact, not straight (pi)
      elbowRange: +(ehi - elo).toFixed(4),                  // how much the mid joint articulates over the bar
      elbowArticulates: (ehi - elo) > (impulseRole[role] ? 0.3 : 0.05),
      onsetReach: +onsetReach.toFixed(4),
    });
  }
  out.everyLimbJointed = out.joints.every((j) => j.everyLimbHasEntry && j.bodyEntryJoints >= j.limbCount);
  // every player arm: 2 visible joints (elbow+wrist), a clearly FLEXED elbow at the contact,
  // and the mid joint ARTICULATES (big flex for impulse strikers; a jointed hold for sustained).
  out.armsFlex = out.joints.every((j) => j.playerArmJoints >= 2 && j.elbowKnob && j.wristKnob && j.elbowFlexed && j.elbowArticulates);
  out.impulseElbowFlexes = out.joints.filter((j) => j.impulse).every((j) => j.elbowRange > 0.3);
  out.armContactWithJoints = out.joints.every((j) => j.onsetReach < 0.05);

  // (B) LEGS on a legged plan (insectoid) bend at a visible KNEE + ANKLE — sweep the bar
  //     and confirm the knee interior angle FLEXES (its range spans) and reads clearly bent.
  {
    const legTr = Object.assign({}, traits, { body: Object.assign({}, traits.body, { plan: "insectoid", legs: 6 }) });
    const legAlien = makeAlien(THREE, legTr, members[0], 77);
    let kneeLo = 9, kneeHi = -9;
    for (let s = 0; s < 48; s++) {
      legAlien.update(0.016, { barPhase: s / 48, playing: true, level: 1, notes: [] });
      const k = legAlien.jointProbe().kneeAngle; if (k != null) { kneeLo = Math.min(kneeLo, k); kneeHi = Math.max(kneeHi, k); }
    }
    const lj = legAlien.jointProbe();
    out.legJoints = { legs: lj.legs, kneeKnob: lj.kneeKnob, ankleKnob: lj.ankleKnob, kneeMin: +kneeLo.toFixed(4), kneeMax: +kneeHi.toFixed(4), flexRange: +(kneeHi - kneeLo).toFixed(4) };
    out.legsBendKnee = lj.legs > 0 && lj.kneeKnob && lj.ankleKnob && out.legJoints.flexRange > 0.05 && kneeLo < 2.85;
  }

  // (C) TENTACLES carry visible JOINT NODES along the FABRIK chain (a tentacled plan).
  {
    const tentTr = Object.assign({}, traits, { body: Object.assign({}, traits.body, { plan: "cephalopod", tentacles: 5, arms: 2 }) });
    const tentA = makeAlien(THREE, tentTr, members[0], 55);
    tentA.update(0.016, { barPhase: 0.2, playing: true, level: 1, notes: [] });
    out.tentacleNodes = tentA.jointProbe().tentacleNodes;
    out.tentaclesJointed = out.tentacleNodes >= 3;
  }

  // ---- BV: BODY SILHOUETTES clearly DIFFER across the 7 plans (goal 5) — the fused-core
  // bounding-box aspect ratios read as distinct creature shapes (tall cephalopod, squat
  // wide blob, long segmented insectoid, wide radial hub, tall thin stalk, tall angular
  // crystalline, lumpy gas cluster), AND two seeds of one plan read as different builds.
  out.silhouettes = {};
  for (const plan of PLANS) {
    const tr = Object.assign({}, traits, { body: Object.assign({}, traits.body, { plan }) });
    out.silhouettes[plan] = makeAlien(THREE, tr, members[0], 55).bodySignature();
  }
  const SIL = out.silhouettes;
  out.silTall = SIL.cephalopod.yx > 1.1 && SIL.stalk.yx > 1.0 && SIL.crystalline.yx > 1.0;
  out.silSquat = SIL.radial.yx < 0.95 && SIL.blob.yx < 0.9 && SIL.gas.yx < 0.95;
  out.silInsectLong = SIL.insectoid.zx > 1.15;                 // segmented body trails back in z
  out.silRadialHub = Math.abs(SIL.radial.zx - 1) < 0.15;      // radially symmetric wide hub
  out.silBlobWide = SIL.blob.yx < 0.88;                        // squat + wide
  out.silAllDistinct = new Set(PLANS.map((p) => JSON.stringify([SIL[p].x, SIL[p].y, SIL[p].z]))).size === PLANS.length;
  {
    const s1 = makeAlien(THREE, Object.assign({}, traits, { body: Object.assign({}, traits.body, { plan: "cephalopod" }) }), members[0], 111).bodySignature();
    const s2 = makeAlien(THREE, Object.assign({}, traits, { body: Object.assign({}, traits.body, { plan: "cephalopod" }) }), members[0], 222).bodySignature();
    out.silPerAlien = [s1, s2];
    out.silPerAlienDiffer = JSON.stringify([s1.x, s1.y, s1.z]) !== JSON.stringify([s2.x, s2.y, s2.z]);
  }
  out.silhouettesDiffer = out.silTall && out.silSquat && out.silInsectLong && out.silRadialHub
    && out.silBlobWide && out.silAllDistinct && out.silPerAlienDiffer;

  renderer.setRenderTarget(null);
  target.dispose(); renderer.dispose();
  return out;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
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

  ok(R.styleDistinct, "F1. material DIFFERS by renderStyle.material (readable set flat/cel/iridescent/pbr/matte distinct)");
  ok(R.styleTreated, "F2. each readable style applies its treatment (cel=toon, iridescent=subtle shader, matte=smooth, pbr=standard, flat=plain Lambert)");
  ok(R.readableSet, "F2b. DROPPED illegible styles (wireframe/glitch/mesh/pure-mesh) fall back to legible flat — no wire, no glitch skin");
  ok(R.allStylesRender, "F3. every readable style COMPILES + renders non-blank on GL");

  ok(R.randomDistinct, `H1. PER-ALIEN randomization: 5 seeds of one genre+member -> 5 DISTINCT rigs (bbox/mesh sigs ${JSON.stringify(R.randomSigs)})`);
  ok(R.motionScalesWithLevel, `I1. MOTION amplitude scales with VOLUME: loud groove=${R.motionLoud} > quiet groove=${R.motionQuiet} (smooth continuum)`);
  ok(R.mostlyRound, `J1. DE-SQUARE: the band is CURVES not cubes (round=${R.roundMeshes} >> box=${R.boxMeshes}; census ${JSON.stringify(R.shapeCensus)})`);

  // K — richer procedural geometry: superquadrics + curve-tubes present, fewer boxes.
  ok(R.hasSuperquadric, `K1. SUPERQUADRIC geometry present (${R.superquadricMeshes} superellipsoid meshes across the band)`);
  ok(R.hasTube, `K2. curve-swept TUBE geometry present (${R.tubeMeshes} CatmullRom tube meshes)`);
  ok(R.fewerBoxes, `K3. FEWER box prims (box=${R.boxMeshes} <= 4, down from the all-cube rig)`);

  // L — 'pbr' renderStyle is a REAL MeshStandardMaterial + the shared reflection env map.
  ok(R.pbr.isStandard && R.pbr.type === "MeshStandardMaterial", `L1. 'pbr' renderStyle uses a REAL MeshStandardMaterial (type=${R.pbr.type})`);
  ok(R.pbr.hasEnvMap && R.pbr.metalness > 0.5, `L2. pbr carries the shared ENV MAP + metalness (env=${R.pbr.hasEnvMap} metalness=${R.pbr.metalness} roughness=${R.pbr.roughness})`);
  ok(R.pbr.spread > 8 && R.pbr.nonBg > 120, `L3. a pbr (chrome/glass) alien renders non-blank (spread=${R.pbr.spread} nonBg=${R.pbr.nonBg})`);

  // M — FABRIK IK reaches its target; a tentacle is fabrik-posed to its curl target.
  ok(R.fabrik.err < 0.01 && R.fabrik.boneErr < 1e-3 && R.fabrik.baseFixed < 1e-4,
    `M1. FABRIK solver REACHES target (err=${R.fabrik.err}) preserving bone lengths (maxBoneErr=${R.fabrik.boneErr}) + fixed base (${R.fabrik.baseFixed})`);
  ok(R.tentacleProof && R.tentacleProof.reached && R.tentacleProof.err < 0.02,
    `M2. a FABRIK-posed TENTACLE reaches its curl target (err=${R.tentacleProof && R.tentacleProof.err}, reached=${R.tentacleProof && R.tentacleProof.reached})`);

  // N/O/P/Q — the SMOOTH+LEGIBLE contract additions.
  ok(R.allContiguous, `N1. CONTIGUOUS: every rig is ONE connected cluster, no floating parts (${JSON.stringify(R.contiguity)})`);
  ok(R.floorOK, `O1. FLOOR: feet/body never clip below the ground across playing+resting sweeps (${JSON.stringify(R.floor)})`);
  ok(R.floorTouch, `O2. FEET TOUCH: the lowest foot rests ON the ground (y≈0), NOT floating, across the sweep (${JSON.stringify(R.floor)})`);
  ok(R.colorsDistinct, `P1. PER-ALIEN COLOUR: two same-genre members (seeds 1234 vs 5678) wear DIFFERENT palettes (A=${JSON.stringify(R.palA)} B=${JSON.stringify(R.palB)})`);
  ok(R.colorDeterministic, "P2. palette is DETERMINISTIC (same seed -> same colours)");
  ok(R.drummerStrikes, `Q1. DRUMMER strikes fast: hand snaps a big arc (${R.drum.windupTravel}) onto the drum AT the onset (contact=${R.drum.contactAtOnset}, reach=${R.drum.reachAtOnset})`);

  // R — LIMB KEEP-OUT: limbs sit ON/OUTSIDE the body, never THROUGH it; onset contact intact.
  for (const k of R.keepout) {
    ok(k.minRatio >= 0.98, `R[${k.role}]. NO player-limb segment penetrates the torso core (worst clearance ${k.minRatio}x the keep-out radius, >= 0.98)`);
  }
  ok(R.limbsClearCore, `R1. every player limb stays OUTSIDE the torso keep-out shell across the whole bar (${JSON.stringify(R.keepout.map((k) => k.minRatio))})`);
  ok(R.contactStillReaches, `R2. PRESERVED — the onset arm-CONTACT still REACHES the instrument with the keep-out active (onset reach ${JSON.stringify(R.keepout.map((k) => k.onReach))} all < 0.05)`);

  // S — INSTRUMENT COLOUR contrasts the body (complementary hue, bold + saturated).
  for (const c of R.instColour) {
    ok(c.hueDist > 0.35, `S[${c.role}]. instrument colour CONTRASTS the body (hue distance ${c.hueDist} > 0.35; bodyHue=${c.bodyHue} instHue=${c.instHue})`);
  }
  ok(R.instContrastsBody, `S1. every instrument is BOLD + saturated + light enough to pop (${JSON.stringify(R.instColour.map((c) => ({ h: c.hueDist, s: c.instSat, l: c.instL })))})`);
  ok(R.instColourDeterministic, "S2. instrument colour is DETERMINISTIC (same seed -> same colour)");

  // T — FUSED marching-cubes core.
  ok(R.coreIsMarchingFused, `T1. BODY CORE is a MARCHING-CUBES fused mesh: single connected BufferGeometry isosurface, baked (${JSON.stringify(R.core)})`);
  ok(R.coreStaticAcrossFrames, "T2. the fused core is BAKED ONCE — static geometry, NOT re-marched per frame (vertex count constant across a bar)");
  ok(R.mcImportsVendor, "T3. vendored MarchingCubes imports the VENDORED three core (./three.module.min.js)");
  ok(R.mcNoCdn, "T4. vendored MarchingCubes has NO CDN/http import at runtime");

  // U — two-tentacle drummer.
  ok(R.drummerTwoTentacles, `U1. DRUMMER strikes with >= 2 appendages, both contacting the drum on onset (${JSON.stringify(R.drumStrikers)})`);

  // V — no black-circle disc.
  ok(R.noDarkDiscs, `V1. NO shaky black-circle blob-shadow DISC remains under any alien (${JSON.stringify(R.discs)})`);

  // W — VISIBLE ARTICULATED JOINTS (goals 0-4).
  for (const j of R.joints) {
    ok(j.everyLimbHasEntry && j.bodyEntryJoints >= j.limbCount,
      `SH[${j.role}]. EVERY limb has a body-entry JOINT on the core (${j.bodyEntryJoints} entry knobs >= ${j.limbCount} limbs; kinds ${JSON.stringify(j.kinds)})`);
  }
  ok(R.everyLimbJointed, "SH1. every limb on every player is ATTACHED AT A VISIBLE JOINT (shoulder/hip/socket knob at the body entry)");
  for (const j of R.joints) {
    ok(j.playerArmJoints >= 2 && j.elbowKnob && j.wristKnob,
      `A[${j.role}]. playing arm has >= 2 visible joints — a knob at the ELBOW + WRIST (joints=${j.playerArmJoints})`);
    ok(j.elbowFlexed && j.elbowArticulates,
      `A-flex[${j.role}]. the ELBOW is FLEXED at the contact (angle=${j.elbowOnset} < 2.85, not a straight stick) and the mid joint ARTICULATES over the bar (range=${j.elbowRange})`);
  }
  ok(R.armsFlex, "A1. every playing arm is a 3-segment JOINTED limb with a bent, articulating elbow (not a rigid pivot)");
  ok(R.impulseElbowFlexes, `A1b. IMPULSE strikers (strike/pluck) visibly FLEX the elbow through windup->strike (${JSON.stringify(R.joints.filter((j) => j.impulse).map((j) => ({ role: j.role, range: j.elbowRange })))})`);
  ok(R.armContactWithJoints, `A2. PRESERVED — the onset arm-CONTACT still reaches (reach ${JSON.stringify(R.joints.map((j) => j.onsetReach))} all < 0.05) with the jointed motion`);

  // B — legs bend at a visible knee (legged plan).
  ok(R.legsBendKnee, `B1. LEGS bend at a visible KNEE + ANKLE on a legged plan (insectoid): knee flexes ${JSON.stringify(R.legJoints)}`);

  // C — tentacles have visible joint nodes.
  ok(R.tentaclesJointed, `C1. TENTACLES carry visible JOINT NODES along the FABRIK chain (${R.tentacleNodes} chain-node knobs)`);

  // BV — body silhouettes clearly differ across the 7 plans + per-alien build.
  ok(R.silTall, `BV1. TALL plans read tall: cephalopod/stalk/crystalline yx>1 (${JSON.stringify({ ceph: R.silhouettes.cephalopod.yx, stalk: R.silhouettes.stalk.yx, cryst: R.silhouettes.crystalline.yx })})`);
  ok(R.silSquat, `BV2. SQUAT/wide plans read wide: radial/blob/gas yx<1 (${JSON.stringify({ radial: R.silhouettes.radial.yx, blob: R.silhouettes.blob.yx, gas: R.silhouettes.gas.yx })})`);
  ok(R.silInsectLong, `BV3. INSECTOID is a long segmented body (depth/width zx=${R.silhouettes.insectoid.zx} > 1.15)`);
  ok(R.silRadialHub, `BV4. RADIAL is a radially-symmetric wide HUB (zx≈1: ${R.silhouettes.radial.zx})`);
  ok(R.silAllDistinct, `BV5. all 7 plan silhouettes are DISTINCT bounding-box signatures (${JSON.stringify(Object.fromEntries(Object.entries(R.silhouettes).map(([k, v]) => [k, [v.x, v.y, v.z]])))})`);
  ok(R.silPerAlienDiffer, `BV6. two seeds of ONE plan read as DIFFERENT builds (cephalopod ${JSON.stringify(R.silPerAlien.map((s) => [s.x, s.y, s.z]))})`);
  ok(R.silhouettesDiffer, "BV7. BODY SILHOUETTES are genuinely distinct per plan + per alien — no uniform round blobs");

  ok(perr.length === 0, "G1. no console/page errors" + (perr.length ? " :: " + perr.join(" | ") : ""));

  await browser.close(); srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
