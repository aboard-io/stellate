#!/usr/bin/env node
// postfx-run.js — headless proof for app/starcruise/postfx.js (the PS1 look).
// Drives index.html in headless chromium (WebGL via SwiftShader), imports THREE +
// makePS1 in-page, renders a simple lit scene through the low-res -> nearest-upscale
// pipeline, and asserts:
//
//   A. makePS1 returns { render, setSize, vertexSnapMaterial } and a vertex-snapped
//      material compiles + renders WITHOUT shader/console errors;
//   B. NON-BLANK: the display canvas has real colour spread (not one flat colour);
//   C. LOW-RES UPSCALE: internal target (128x96) is far smaller than the display
//      (512x384) AND the on-screen pixels are BLOCKY — adjacent horizontal pixels
//      are exact-equal far more often than a smooth render would be (nearest 4x);
//   D. DITHER present: the quantised frame still shows >1 exact colour (not a
//      single posterised block), i.e. the pass ran and produced varied output.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/postfx-run.js
"use strict";
const path = require("path");
const { serve } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8817;

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
  const { makePS1 } = await import("/app/starcruise/postfx.js");

  const DISP_W = 512, DISP_H = 384;
  const LOW_W = 128, LOW_H = 96;

  const canvas = document.createElement("canvas");
  // preserveDrawingBuffer so we can readPixels the default framebuffer after render.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.autoClear = false;

  const target = new THREE.WebGLRenderTarget(LOW_W, LOW_H,
    { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });

  const ps1 = makePS1(THREE, renderer, target);
  const api = { hasRender: typeof ps1.render === "function",
    hasSetSize: typeof ps1.setSize === "function",
    hasSnap: typeof ps1.vertexSnapMaterial === "function" };

  ps1.setSize(DISP_W, DISP_H);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0410);
  scene.add(new THREE.AmbientLight(0x8899aa, 0.7));
  const sun = new THREE.DirectionalLight(0xffeedd, 1.0); sun.position.set(3, 6, 4); scene.add(sun);

  // a few bright cubes, one using a vertex-SNAPPED material (proves it compiles).
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const snapMat = ps1.vertexSnapMaterial(new THREE.MeshLambertMaterial({ color: 0xff3366, flatShading: true }));
  const plainMat = new THREE.MeshLambertMaterial({ color: 0x33ccff, flatShading: true });
  const c1 = new THREE.Mesh(geo, snapMat); c1.position.set(-1.1, 0, 0); scene.add(c1);
  const c2 = new THREE.Mesh(geo, plainMat); c2.position.set(1.1, 0.3, -0.5); scene.add(c2);
  const c3 = new THREE.Mesh(geo, ps1.vertexSnapMaterial(new THREE.MeshLambertMaterial({ color: 0x66ff88, flatShading: true })));
  c3.position.set(0, -0.6, 0.6); scene.add(c3);

  const camera = new THREE.PerspectiveCamera(60, LOW_W / LOW_H, 0.1, 200);
  camera.position.set(0.6, 1.0, 4.2);
  camera.lookAt(0, 0, 0);

  // render through the PS1 pipeline to the DISPLAY canvas.
  ps1.render(scene, camera);

  // read the display framebuffer.
  const gl = renderer.getContext();
  const dbuf = new Uint8Array(DISP_W * DISP_H * 4);
  gl.readPixels(0, 0, DISP_W, DISP_H, gl.RGBA, gl.UNSIGNED_BYTE, dbuf);

  // colour spread + unique colours (non-blank + dither/quantise ran).
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0, nonBg = 0;
  const seen = new Set();
  for (let i = 0; i < dbuf.length; i += 4) {
    const r = dbuf[i], g = dbuf[i + 1], b = dbuf[i + 2];
    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (g < minG) minG = g; if (g > maxG) maxG = g;
    if (b < minB) minB = b; if (b > maxB) maxB = b;
    if (r > 20 || g > 20 || b > 30) nonBg++;
    if (seen.size < 5000) seen.add((r << 16) | (g << 8) | b);
  }
  const spread = Math.max(maxR - minR, maxG - minG, maxB - minB);

  // BLOCKINESS: nearest upscale of 128->512 is a 4x horizontal block; adjacent
  // pixels within a block are EXACT-equal. Count exact-equal adjacent horizontal
  // pairs over the whole frame. A smooth/perspective render lands far lower.
  function rowEqualFrac() {
    let equal = 0, total = 0;
    for (let y = 0; y < DISP_H; y += 3) {
      for (let x = 1; x < DISP_W; x++) {
        const a = (y * DISP_W + x) * 4, b = (y * DISP_W + x - 1) * 4;
        total++;
        if (dbuf[a] === dbuf[b] && dbuf[a + 1] === dbuf[b + 1] && dbuf[a + 2] === dbuf[b + 2]) equal++;
      }
    }
    return equal / total;
  }
  const eqFrac = rowEqualFrac();

  renderer.setRenderTarget(null);
  target.dispose(); renderer.dispose();
  return {
    api,
    dispW: DISP_W, dispH: DISP_H, lowW: LOW_W, lowH: LOW_H,
    internalSmaller: (LOW_W * LOW_H) < (DISP_W * DISP_H),
    spread, nonBg, uniqueColors: seen.size, eqFrac: +eqFrac.toFixed(4),
  };
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

  console.log("\n  RESULT:", JSON.stringify(R, null, 2), "\n");

  ok(R.api.hasRender && R.api.hasSetSize && R.api.hasSnap, "A1. makePS1 -> { render, setSize, vertexSnapMaterial }");
  ok(R.internalSmaller, `C1. internal target ${R.lowW}x${R.lowH} < display ${R.dispW}x${R.dispH}`);
  ok(R.spread > 20, `B1. NON-BLANK display (colour spread=${R.spread})`);
  ok(R.nonBg > 500, `B2. real geometry drawn (${R.nonBg} non-bg px)`);
  ok(R.uniqueColors > 3, `D1. dither/quantise produced varied output (${R.uniqueColors} unique colours)`);
  ok(R.eqFrac > 0.5, `C2. BLOCKY nearest upscale (adjacent-equal horiz frac=${R.eqFrac} > 0.5)`);
  ok(perr.length === 0, "E1. no console/page/shader errors" + (perr.length ? " :: " + perr.join(" | ") : ""));

  await browser.close();
  srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
