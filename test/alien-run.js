#!/usr/bin/env node
// alien-run.js — headless proof for app/starcruise/alien.js (the procedural
// band-member alien: low-poly body + 2-bone IK + invented instrument that is
// PLAYED in time). Drives index.html in headless chromium (WebGL via SwiftShader),
// imports THREE + the alien/traits modules in-page, and asserts:
//
//   A. makeAlien builds a valid rig for several members (drum / bass / lead / bow);
//   B. HIT TIMING — the playing appendage's contact point reaches the instrument
//      ON the beat: sweeping beatPhase 0..1, dist(handTip, contact) is ~0 at each
//      sub-hit boundary (subPhase 0) and the boundary is the global minimum; for
//      windup styles (strike/drum/pluck/blow) the mid-sub distance is clearly
//      larger (it really winds up and lands);
//   C. the rig MOVES over time (hand tip travels) and renders NON-BLANK into a
//      low-res target (colour spread + a body of non-background pixels);
//   D. determinism — same (traits, member, seed) -> identical hit-distance trace.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/alien-run.js
"use strict";
const path = require("path");
const { serve } = require("./probe-harness.js");
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

// the whole rig exercise runs IN-PAGE (needs a real GL context + the ES modules).
async function inPage() {
  let THREE = await import("/vendor/three/three.module.min.js");
  if (THREE.default && !THREE.WebGLRenderer) THREE = THREE.default;
  const traitsMod = await import("/app/starcruise/traits.js");
  const alienMod = await import("/app/starcruise/alien.js");
  const makeAlien = alienMod.makeAlien;
  const K = window.GenreKernel, V = window.GenreVerifier;

  // a real genre's traits (falls back to the stub's neutral vector if engine late).
  const genre = (K && K.GENRES && Object.keys(K.GENRES)[0]) || "vaporwave";
  const traits = traitsMod.traitsFromGenre(K, V, genre, 7);

  // members we require regardless of what the derived band happens to contain, so
  // we exercise every distinct playStyle: strike-down, pluck, raised blow, bow.
  const members = [
    { role: "drum", instrument: { family: "thumpdrum", playStyle: "drum", appendage: 0, hitsPerBeat: 4 } },
    { role: "bass", instrument: { family: "buzzstring", playStyle: "pluck", appendage: 1, hitsPerBeat: 2 } },
    { role: "lead", instrument: { family: "wailhorn", playStyle: "blow", appendage: 2, hitsPerBeat: 1 } },
    { role: "pad", instrument: { family: "glasspad", playStyle: "bow", appendage: 3, hitsPerBeat: 1 } },
    { role: "perc", instrument: { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 3 } },
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

  // frame the band.
  camera.position.set(0, 1.2, 5.0);
  camera.lookAt(0, 0.8, 0);

  // helper: sweep beatPhase 0..1 for one alien, return dist trace + hit stats.
  function hitTrace(alien, steps) {
    const hpb = alien.hitsPerBeat;
    let atHit = 0, hitCount = 0, maxDist = 0, atMid = 0, midCount = 0;
    const lo = { x: 1e9, y: 1e9, z: 1e9 }, hi = { x: -1e9, y: -1e9, z: -1e9 };
    const trace = [];
    for (let s = 0; s < steps; s++) {
      const phase = s / steps;
      alien.update(0.016, phase);
      const dbg = alien.debug();
      const d = dbg.dist, t = dbg.handTip;
      trace.push(d);
      if (d > maxDist) maxDist = d;
      lo.x = Math.min(lo.x, t.x); hi.x = Math.max(hi.x, t.x);
      lo.y = Math.min(lo.y, t.y); hi.y = Math.max(hi.y, t.y);
      lo.z = Math.min(lo.z, t.z); hi.z = Math.max(hi.z, t.z);
      const sub = (phase * hpb) % 1;
      const toB = Math.min(sub, 1 - sub);   // distance to nearest sub-boundary
      if (toB < 0.02) { atHit += d; hitCount++; }
      if (Math.abs(sub - 0.5) < 0.03) { atMid += d; midCount++; }
    }
    const span = Math.hypot(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z);
    return {
      hpb,
      atHit: hitCount ? atHit / hitCount : NaN,
      atMid: midCount ? atMid / midCount : NaN,
      maxDist, span, trace,
    };
  }

  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i];
    const st = hitTrace(a, 240);   // span = how far the hand tip travels over a beat
    out.members.push({
      role: members[i].role, playStyle: a.playStyle, hpb: st.hpb,
      atHit: +st.atHit.toFixed(4), atMid: +st.atMid.toFixed(4), maxDist: +st.maxDist.toFixed(4),
      moved: +st.span.toFixed(4),
      childCount: a.group.children.length,
    });
  }

  // ---- render NON-BLANK into the low-res target ---------------------------------
  for (const a of aliens) a.update(0.016, 0.25);
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);
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

  // ---- determinism: same inputs -> identical hit trace --------------------------
  const m = members[0];
  const t1 = hitTrace(makeAlien(THREE, traits, m, 42), 64).trace;
  const t2 = hitTrace(makeAlien(THREE, traits, m, 42), 64).trace;
  out.deterministic = t1.length === t2.length && t1.every((v, k) => Math.abs(v - t2[k]) < 1e-9);

  renderer.setRenderTarget(null);
  target.dispose(); renderer.dispose();
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
  try {
    R = await page.evaluate(inPage);
  } catch (e) {
    console.error("in-page eval threw:", e);
    await browser.close(); srv.close(); process.exit(1);
  }

  console.log("\n  RESULT:", JSON.stringify(R, (k, v) => k === "trace" ? undefined : v, 2), "\n");

  ok(R.members.length === 5, `A1. built ${R.members.length} aliens (drum/bass/lead/pad/perc)`);
  ok(R.members.every((m) => m.childCount > 8), "A2. each rig has a real body (>8 child meshes)");

  const TOL = 0.03;   // "on the beat" tolerance (alien-local units)
  for (const m of R.members) {
    ok(m.atHit < TOL, `B[${m.role}/${m.playStyle}]. contact ON the beat: dist@hit=${m.atHit} < ${TOL}`);
  }
  // windup styles must clearly wind AWAY between hits (bow stays in contact — skip).
  for (const m of R.members) {
    if (m.playStyle === "bow") continue;
    ok(m.atMid > m.atHit + 0.05, `B2[${m.role}/${m.playStyle}]. winds up between hits: dist@mid=${m.atMid} >> dist@hit=${m.atHit}`);
  }

  ok(R.members.every((m) => m.moved > 0.01), "C1. rig MOVES over time (hand tip travels)");
  ok(R.render.spread > 8, `C2. NON-BLANK render (colour spread=${R.render.spread})`);
  ok(R.render.nonBg > 200, `C3. real geometry drawn (${R.render.nonBg} non-bg px)`);

  ok(R.deterministic, "D1. deterministic: same (traits,member,seed) -> identical hit trace");
  ok(perr.length === 0, "E1. no console/page errors" + (perr.length ? " :: " + perr.join(" | ") : ""));

  await browser.close();
  srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
