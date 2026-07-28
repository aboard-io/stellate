#!/usr/bin/env node
// test/starcruise/alien-dancer.test.js — headless proof for the DANCER contract in
// app/starcruise/alien.js: makeAlien(THREE, traits, {role:'dancer'}, seed) returns
// an INSTRUMENT-LESS full-body NON-HUMAN creature that grooves. Asserts:
//
//   A. a dancer builds a real rig (>8 child meshes) and has NO instrument object
//      (a player of the same genre DOES gain one — the dancer has fewer children);
//   B. the dancer MOVES over time (body + limbs travel as the phase sweeps), and
//      grooves HARDER when the level is high than when it is quiet;
//   C. it renders NON-BLANK; D. determinism (same seed -> identical motion trace);
//   E. it accepts BOTH the legacy beatPhase-number call AND the ctx-object call.
//
//   node test/starcruise/alien-dancer.test.js
"use strict";
const path = require("path");
const { serve, installOfflineRoute } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", ".."), PORT = 8815;

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

  const dancer = makeAlien(THREE, traits, { role: "dancer" }, 314);
  const player = makeAlien(THREE, traits, { role: "lead", voice: "lead", instrument: { family: "bladder-horn", playStyle: "blow", appendage: 2, hitsPerBeat: 1 } }, 314);

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
  dancer.group.position.x = -1.0; scene.add(dancer.group);
  camera.position.set(0, 1.2, 5.0); camera.lookAt(0, 0.9, 0);

  const out = { errors: [] };

  // A. structure — dancer builds a body but NO instrument (fewer children).
  out.dancerChildren = dancer.group.children.length;
  out.playerChildren = player.group.children.length;
  out.dancerPlayStyle = dancer.playStyle;
  out.dancerPlan = dancer.plan;
  out.dancerHasNoInstrument = out.playerChildren > out.dancerChildren;

  // helper: sweep a phase, measure how far a sampled world vertex travels.
  function travel(al, drive, steps) {
    const probe = al.group.children.find((c) => c.isMesh) || al.group.children[0];
    const lo = { x: 1e9, y: 1e9, z: 1e9 }, hi = { x: -1e9, y: -1e9, z: -1e9 };
    const v = new THREE.Vector3();
    for (let s = 0; s < steps; s++) {
      al.update(0.016, drive(s / steps));
      al.group.updateMatrixWorld(true);
      probe.getWorldPosition(v);
      lo.x = Math.min(lo.x, v.x); hi.x = Math.max(hi.x, v.x);
      lo.y = Math.min(lo.y, v.y); hi.y = Math.max(hi.y, v.y);
      lo.z = Math.min(lo.z, v.z); hi.z = Math.max(hi.z, v.z);
    }
    return +Math.hypot(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z).toFixed(4);
  }

  // B. motion — ctx-object drive, loud vs quiet.
  out.movedLoud = travel(dancer, (p) => ({ barPhase: p, playing: true, level: 1.0, notes: [] }), 120);
  out.movedQuiet = travel(makeAlien(THREE, traits, { role: "dancer" }, 314), (p) => ({ barPhase: p, playing: true, level: 0.15, notes: [] }), 120);
  out.grooveScalesWithLevel = out.movedLoud > out.movedQuiet + 0.005;

  // E. legacy beatPhase-NUMBER call still animates.
  out.movedLegacy = travel(makeAlien(THREE, traits, { role: "dancer" }, 314), (p) => p, 120);

  // C. render NON-BLANK.
  dancer.update(0.016, { barPhase: 0.25, playing: true, level: 1, notes: [] });
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

  // G. PER-ALIEN randomization — two dancers of the SAME genre but DIFFERENT seeds
  // are visibly different creatures (proportions/appendage/orb jitter off own seed).
  function dsig(al) {
    al.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(al.group);
    const s = new THREE.Vector3(); box.getSize(s);
    let meshes = 0; al.group.traverse((o) => { if (o.isMesh) meshes++; });
    return `${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)},${meshes}`;
  }
  out.dancerSigs = [11, 202, 3003, 40004].map((sd) => dsig(makeAlien(THREE, traits, { role: "dancer" }, sd)));
  out.dancersDiffer = new Set(out.dancerSigs).size === out.dancerSigs.length;

  // D. determinism — same seed -> identical motion trace.
  const d1 = makeAlien(THREE, traits, { role: "dancer" }, 77);
  const d2 = makeAlien(THREE, traits, { role: "dancer" }, 77);
  const t1 = [], t2 = [];
  for (let s = 0; s < 48; s++) { d1.update(0.016, { barPhase: s / 48, playing: true, level: 1, notes: [] }); t1.push(d1.debug().handTip.y); }
  for (let s = 0; s < 48; s++) { d2.update(0.016, { barPhase: s / 48, playing: true, level: 1, notes: [] }); t2.push(d2.debug().handTip.y); }
  out.deterministic = t1.every((val, k) => Math.abs(val - t2[k]) < 1e-9);

  // H. DESYNC/SYNC by LOUDNESS — a floor of dancers (different seeds) dance OUT OF STEP
  // when the mix is quiet and LOCK together when it is loud. Step them in lockstep and
  // measure the cross-dancer spread of the (per-dancer STANDARDISED) vertical groove:
  // that removes each dancer's own lift/size, leaving pure PHASE. Quiet => big spread
  // (each its own phase/tempo); loud => ~0 spread (converged onto a shared beat).
  function syncSpread(loud) {
    const seeds = [11, 202, 3003, 40004, 555];
    const crew = seeds.map((s) => makeAlien(THREE, traits, { role: "dancer" }, s));
    const T = 120, series = crew.map(() => []);
    for (let s = 0; s < T; s++) {
      const bp = (s % 30) / 30;
      crew.forEach((d, k) => { d.update(0.016, { barPhase: bp, playing: true, level: loud, loudness: loud, notes: [] }); series[k].push(d.group.position.y); });
    }
    const Z = series.map((arr) => {
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      const sd = Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length) || 1e-9;
      return arr.map((v) => (v - m) / sd);
    });
    let acc = 0, cnt = 0;
    for (let t = 20; t < T; t++) {
      const col = Z.map((z) => z[t]);
      const m = col.reduce((a, b) => a + b, 0) / col.length;
      acc += Math.sqrt(col.reduce((a, b) => a + (b - m) * (b - m), 0) / col.length); cnt++;
    }
    return +(acc / cnt).toFixed(4);
  }
  out.spreadQuiet = syncSpread(0.05);
  out.spreadLoud = syncSpread(0.98);
  out.dancersDesyncQuiet_syncLoud = out.spreadQuiet > out.spreadLoud + 0.15 && out.spreadLoud < 0.3;

  renderer.setRenderTarget(null); target.dispose(); renderer.dispose();
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

  ok(R.dancerChildren > 8, `A1. dancer built a real NON-HUMAN body (${R.dancerChildren} child meshes, plan=${R.dancerPlan})`);
  ok(R.dancerPlayStyle === "dance", `A2. dancer playStyle == 'dance' (${R.dancerPlayStyle})`);
  ok(R.dancerHasNoInstrument, `A3. dancer has NO instrument (dancer ${R.dancerChildren} < player ${R.playerChildren} children)`);
  ok(R.movedLoud > 0.02, `B1. dancer MOVES to the beat (world travel=${R.movedLoud})`);
  ok(R.grooveScalesWithLevel, `B2. dancer grooves HARDER when loud (loud=${R.movedLoud} > quiet=${R.movedQuiet})`);
  ok(R.movedLegacy > 0.02, `E1. legacy beatPhase-number call still animates (travel=${R.movedLegacy})`);
  ok(R.render.spread > 8, `C1. NON-BLANK render (colour spread=${R.render.spread})`);
  ok(R.render.nonBg > 200, `C2. real geometry drawn (${R.render.nonBg} non-bg px)`);
  ok(R.dancersDiffer, `G1. PER-ALIEN randomization: 4 dancer seeds -> 4 DISTINCT bodies (${JSON.stringify(R.dancerSigs)})`);
  ok(R.deterministic, "D1. deterministic: same seed -> identical dancer motion");
  ok(R.dancersDesyncQuiet_syncLoud, `H1. dancers DESYNC when quiet + SYNC when loud (standardised phase spread: quiet=${R.spreadQuiet} >> loud=${R.spreadLoud})`);
  ok(perr.length === 0, "F1. no console/page errors" + (perr.length ? " :: " + perr.join(" | ") : ""));

  await browser.close(); srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
