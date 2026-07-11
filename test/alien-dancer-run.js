#!/usr/bin/env node
// alien-dancer-run.js — headless proof for the DANCER contract in
// app/starcruise/alien.js: makeAlien(THREE, traits, {role:'dancer'}, seed) returns
// an INSTRUMENT-LESS full-body dancer that grooves to the beat. Asserts:
//
//   A. a dancer builds a real rig (>8 child meshes) and has NO instrument object
//      (a player of the same genre DOES gain one — the dancer has fewer children);
//   B. the dancer MOVES over time (body + limbs travel as beatPhase sweeps);
//   C. it renders NON-BLANK; D. determinism (same seed -> identical motion trace).
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/alien-dancer-run.js
"use strict";
const path = require("path");
const { serve } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8815;

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
  const player = makeAlien(THREE, traits, { role: "lead", instrument: { family: "wailhorn", playStyle: "blow", appendage: 2, hitsPerBeat: 1 } }, 314);

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

  // A. structure — dancer builds a body but NO instrument (fewer children than a player).
  out.dancerChildren = dancer.group.children.length;
  out.playerChildren = player.group.children.length;
  out.dancerPlayStyle = dancer.playStyle;
  out.dancerHasNoInstrument = out.playerChildren > out.dancerChildren; // player adds the instrument object

  // B. motion — sweep beatPhase, measure how far a sampled world vertex travels.
  const probe = dancer.group.children.find((c) => c.isMesh) || dancer.group.children[0];
  const lo = { x: 1e9, y: 1e9, z: 1e9 }, hi = { x: -1e9, y: -1e9, z: -1e9 };
  const trace = [];
  const v = new THREE.Vector3();
  for (let s = 0; s < 120; s++) {
    const phase = s / 120;
    dancer.update(0.016, phase);
    dancer.group.updateMatrixWorld(true);
    probe.getWorldPosition(v);
    trace.push(+v.y.toFixed(6));
    lo.x = Math.min(lo.x, v.x); hi.x = Math.max(hi.x, v.x);
    lo.y = Math.min(lo.y, v.y); hi.y = Math.max(hi.y, v.y);
    lo.z = Math.min(lo.z, v.z); hi.z = Math.max(hi.z, v.z);
  }
  out.moved = +Math.hypot(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z).toFixed(4);

  // C. render NON-BLANK.
  dancer.update(0.016, 0.25);
  renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
  const buf = new Uint8Array(LOW_W * LOW_H * 4);
  renderer.readRenderTargetPixels(target, 0, 0, LOW_W, LOW_H, buf);
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0, nonBg = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (g < minG) minG = g; if (g > maxG) maxG = g;
    if (b < minB) minB = b; if (b > maxB) maxB = b;
    if (r > 20 || g > 20 || b > 30) nonBg++;
  }
  out.render = { spread: Math.max(maxR - minR, maxG - minG, maxB - minB), nonBg };

  // D. determinism — same seed -> identical motion trace.
  const d1 = makeAlien(THREE, traits, { role: "dancer" }, 77);
  const d2 = makeAlien(THREE, traits, { role: "dancer" }, 77);
  const t1 = [], t2 = [];
  for (let s = 0; s < 48; s++) { d1.update(0.016, s / 48); t1.push(d1.debug().handTip.y); }
  for (let s = 0; s < 48; s++) { d2.update(0.016, s / 48); t2.push(d2.debug().handTip.y); }
  out.deterministic = t1.every((val, k) => Math.abs(val - t2[k]) < 1e-9);

  renderer.setRenderTarget(null); target.dispose(); renderer.dispose();
  return out;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchGL();
  const page = await browser.newPage();
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

  ok(R.dancerChildren > 8, `A1. dancer built a real body (${R.dancerChildren} child meshes)`);
  ok(R.dancerPlayStyle === "dance", `A2. dancer playStyle == 'dance' (${R.dancerPlayStyle})`);
  ok(R.dancerHasNoInstrument, `A3. dancer has NO instrument (dancer ${R.dancerChildren} < player ${R.playerChildren} children)`);
  ok(R.moved > 0.02, `B1. dancer MOVES to the beat (world travel=${R.moved})`);
  ok(R.render.spread > 8, `C1. NON-BLANK render (colour spread=${R.render.spread})`);
  ok(R.render.nonBg > 200, `C2. real geometry drawn (${R.render.nonBg} non-bg px)`);
  ok(R.deterministic, "D1. deterministic: same seed -> identical dancer motion");
  ok(perr.length === 0, "E1. no console/page errors" + (perr.length ? " :: " + perr.join(" | ") : ""));

  await browser.close(); srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
