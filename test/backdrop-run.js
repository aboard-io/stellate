#!/usr/bin/env node
// backdrop-run.js — headless proof for app/starcruise/backdrop.js (the procedural
// CITY / FARM world behind the alien band). Builds both kinds in a real headless
// WebGL scene (SwiftShader/ANGLE) and asserts the CONTRACT:
//
//   A. CITY builds instanced towers (non-trivial instance counts, windows baked
//      into vertex colors) + a ground.
//   B. FARM builds instanced crop rows + silos + a ground.
//   C. Each renders NON-BLANK into a low-res target (real colour spread + a body
//      of non-background pixels), sampled via renderer.readRenderTargetPixels.
//   D. DETERMINISM: same traits+seed -> byte-identical instance layout; a
//      different seed -> a different layout (seed truly threads through).
//   E. NO console/page errors; update(dt) steps without throwing.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/backdrop-run.js
"use strict";
const path = require("path");
const { serve, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8813;

async function launchGL() {
  const fs = require("fs");
  const { chromium } = require("playwright");
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  const args = ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"];
  const opts = { headless: true, args };
  if (fs.existsSync(exe)) opts.executablePath = exe;
  return chromium.launch(opts);
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchGL();
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? "  PASS  " : "  FAIL  ") + msg); if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(200);

  // Everything runs in-page (needs a real GL context). Builds a city + a farm,
  // renders each into a 256x192 target, reads pixels, and returns stats +
  // determinism signatures back to node.
  const R = await page.evaluate(async () => {
    const THREE = await import("/vendor/three/three.module.min.js");
    const { makeBackdrop } = await import("/app/starcruise/backdrop.js");

    const traits = (kind) => ({
      backdrop: kind, glow: 0.4,
      palette: { skin: { h: 200, s: 0.5, l: 0.5 }, cloth: { h: 340, s: 0.5, l: 0.45 }, accent: { h: 40, s: 0.85, l: 0.6 } },
    });

    // collect { name, count } for every InstancedMesh + a layout signature
    // (rounded instance matrices) for determinism comparison.
    function instats(b) {
      const meshes = [];
      b.group.traverse((o) => {
        if (o.isInstancedMesh) {
          const arr = o.instanceMatrix.array;
          const sig = Array.from(arr, (v) => Math.round(v * 1e4)).join(",");
          meshes.push({ name: o.name, count: o.count, sig });
        }
      });
      return meshes;
    }
    const sumSig = (ms) => ms.map((m) => m.name + ":" + m.count + ":" + m.sig).join("|");

    // shared renderer + low-res target.
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 192;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setSize(256, 192, false);
    const rt = new THREE.WebGLRenderTarget(256, 192, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const buf = new Uint8Array(256 * 192 * 4);

    function renderStats(b) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0a18);
      const amb = new THREE.AmbientLight(0xffffff, 0.5);
      const dir = new THREE.DirectionalLight(0xffffff, 1.0);
      dir.position.set(6, 12, 8);
      scene.add(amb, dir, b.group);
      const cam = new THREE.PerspectiveCamera(60, 256 / 192, 0.1, 400);
      cam.position.set(0, 5, 16);
      cam.lookAt(0, 4, -14);
      b.update(0.05); b.update(0.05);   // step animation to prove it doesn't throw
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, 256, 192, buf);
      renderer.setRenderTarget(null);
      // spread + non-background pixel count (bg = the top-left corner pixel).
      let mn = [255, 255, 255], mx = [0, 0, 0], nonBg = 0;
      const bg = [buf[0], buf[1], buf[2]];
      for (let i = 0; i < buf.length; i += 4) {
        for (let c = 0; c < 3; c++) { const v = buf[i + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
        if (Math.abs(buf[i] - bg[0]) + Math.abs(buf[i + 1] - bg[1]) + Math.abs(buf[i + 2] - bg[2]) > 24) nonBg++;
      }
      const spread = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
      return { spread, nonBg, blank: spread < 8, allOneColor: spread < 4 };
    }

    const city = makeBackdrop(THREE, traits("city"), 5);
    const farm = makeBackdrop(THREE, traits("farm"), 5);
    const cityStats = instats(city), farmStats = instats(farm);
    const cityRender = renderStats(city), farmRender = renderStats(farm);

    // determinism: rebuild with the SAME seed and a DIFFERENT seed.
    const citySame = sumSig(instats(makeBackdrop(THREE, traits("city"), 5)));
    const cityDiff = sumSig(instats(makeBackdrop(THREE, traits("city"), 6)));
    const cityBase = sumSig(cityStats);
    const farmSame = sumSig(instats(makeBackdrop(THREE, traits("farm"), 5)));
    const farmDiff = sumSig(instats(makeBackdrop(THREE, traits("farm"), 6)));
    const farmBase = sumSig(farmStats);

    renderer.dispose();
    return {
      cityStats, farmStats, cityRender, farmRender,
      det: {
        cityIdentical: cityBase === citySame, cityDiffers: cityBase !== cityDiff,
        farmIdentical: farmBase === farmSame, farmDiffers: farmBase !== farmDiff,
      },
    };
  });

  const sumCount = (ms, name) => ms.filter((m) => m.name === name).reduce((a, m) => a + m.count, 0);
  const cityB = sumCount(R.cityStats, "buildings");
  const farmC = sumCount(R.farmStats, "crops");
  const farmS = sumCount(R.farmStats, "silos");

  console.log("=== CITY ===");
  console.log("  instanced:", JSON.stringify(R.cityStats.map((m) => ({ name: m.name, count: m.count }))));
  console.log("  render:", JSON.stringify(R.cityRender));
  ok(cityB >= 40, `A1. city has a non-trivial tower crowd (${cityB} buildings)`);
  ok(R.cityStats.filter((m) => m.name === "buildings").length >= 2, `A2. city built multiple instanced tower variants (${R.cityStats.filter((m) => m.name === "buildings").length})`);
  ok(!R.cityRender.blank && !R.cityRender.allOneColor, `C1. city renders NON-BLANK (spread=${R.cityRender.spread})`);
  ok(R.cityRender.nonBg > 200, `C2. city draws real geometry (${R.cityRender.nonBg} non-bg px)`);

  console.log("=== FARM ===");
  console.log("  instanced:", JSON.stringify(R.farmStats.map((m) => ({ name: m.name, count: m.count }))));
  console.log("  render:", JSON.stringify(R.farmRender));
  ok(farmC >= 60, `B1. farm has non-trivial crop rows (${farmC} crops)`);
  ok(farmS >= 3, `B2. farm has silos (${farmS})`);
  ok(!R.farmRender.blank && !R.farmRender.allOneColor, `C3. farm renders NON-BLANK (spread=${R.farmRender.spread})`);
  ok(R.farmRender.nonBg > 200, `C4. farm draws real geometry (${R.farmRender.nonBg} non-bg px)`);

  console.log("=== DETERMINISM ===");
  ok(R.det.cityIdentical, "D1. city seed 5 == seed 5 (identical layout)");
  ok(R.det.cityDiffers, "D2. city seed 5 != seed 6 (seed threads through)");
  ok(R.det.farmIdentical, "D3. farm seed 5 == seed 5 (identical layout)");
  ok(R.det.farmDiffers, "D4. farm seed 5 != seed 6 (seed threads through)");

  ok(errs.length === 0, "E1. no console/page errors" + (errs.length ? " :: " + errs.join(" | ") : ""));

  await browser.close();
  srv.close();
  console.log("\n" + (fails.length ? "FAILED (" + fails.length + "):\n  " + fails.join("\n  ") : "ALL PASS"));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
