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
    const { makePlanet } = await import("/app/starcruise/ship.js");

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
          meshes.push({ name: o.name, count: o.count, sig, family: (o.userData && o.userData.family) || "", cast: !!o.castShadow, receive: !!o.receiveShadow });
        }
      });
      return meshes;
    }
    // ground (a plain Mesh) shadow-receive flag.
    function groundReceives(b) {
      let r = false;
      b.group.traverse((o) => { if (o.name === "ground") r = !!o.receiveShadow; });
      return r;
    }
    const sumSig = (ms) => ms.map((m) => m.name + ":" + m.count + ":" + m.sig).join("|");

    // capture a beacon mesh's per-instance colour array (for blink detection).
    function beaconColors(b) {
      let out = null;
      b.group.traverse((o) => {
        if (o.isInstancedMesh && o.name === "beacons" && o.instanceColor) out = Array.from(o.instanceColor.array);
      });
      return out;
    }
    // step update() a few times, return how many colour channels changed.
    function blinkDelta(b) {
      const before = beaconColors(b);
      if (!before) return { has: false, changed: 0, total: 0 };
      for (let k = 0; k < 6; k++) b.update(0.13);
      const after = beaconColors(b);
      let changed = 0;
      for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 1e-4) changed++;
      return { has: true, changed, total: before.length };
    }

    // shared renderer + low-res target.
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 192;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setSize(256, 192, false);
    renderer.shadowMap.enabled = true;   // exercise the mesh castShadow/receiveShadow flags
    const rt = new THREE.WebGLRenderTarget(256, 192, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const buf = new Uint8Array(256 * 192 * 4);

    function renderStats(b) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0a18);
      const amb = new THREE.AmbientLight(0xffffff, 0.5);
      const dir = new THREE.DirectionalLight(0xffffff, 1.0);
      dir.position.set(6, 12, 8);
      dir.castShadow = true;              // one key shadow-caster, tight frustum around the band
      dir.shadow.mapSize.set(1024, 1024);
      const sc = dir.shadow.camera;
      sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 0.5; sc.far = 80;
      scene.add(amb, dir, dir.target, b.group);
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

    // ---- RENDER STYLE: the city + planet SHADE in the genre's material language ----
    // Inject each renderStyle.material and confirm the building/planet material's
    // signature genuinely differs (a new shader/type, not just a recolour), that each
    // style COMPILES + renders non-blank, and that layout stays byte-identical (the
    // style is render-only — it must not perturb the seeded geometry placement).
    const styleTraits = (kind, mat) => Object.assign(traits(kind), { renderStyle: { material: mat } });
    function matSig(root, name) {
      let out = null;
      root.traverse((o) => {
        if (out) return;
        if ((o.isInstancedMesh || o.isMesh) && (name ? o.name === name : true) && o.material && o.material.isMaterial) {
          const m = o.material;
          const key = m.customProgramCacheKey ? m.customProgramCacheKey() : "";
          out = { type: m.type, toon: !!m.isMeshToonMaterial, wire: !!m.wireframe, smooth: m.flatShading === false, shader: /^sc_/.test(key) ? key : "" };
        }
      });
      return out;
    }
    const STYLES = ["flat", "cel", "iridescent", "wireframe", "glitch", "matte"];
    const buildStyle = {}, planetStyle = {}, styleLayout = {}, styleRenderSpread = {};
    const baseLayout = sumSig(instats(makeBackdrop(THREE, traits("city"), 5)));
    for (const s of STYLES) {
      const bd = makeBackdrop(THREE, styleTraits("city", s), 5);
      buildStyle[s] = matSig(bd.group, "buildings");
      styleLayout[s] = sumSig(instats(bd)) === baseLayout;   // geometry layout unchanged
      styleRenderSpread[s] = renderStats(bd).spread;         // compiles + renders
      const pl = makePlanet(THREE, styleTraits("city", s), 5);
      planetStyle[s] = matSig(pl.group, "planet-body");
      pl.update(0.1); pl.update(0.1);                        // step (glitch clock) — no throw
    }

    const city = makeBackdrop(THREE, traits("city"), 5);
    const farm = makeBackdrop(THREE, traits("farm"), 5);
    const cityStats = instats(city), farmStats = instats(farm);
    const cityRender = renderStats(city), farmRender = renderStats(farm);

    // blink proof on FRESH instances (renderStats already stepped the clock).
    const cityBlink = blinkDelta(makeBackdrop(THREE, traits("city"), 5));
    const farmBlink = blinkDelta(makeBackdrop(THREE, traits("farm"), 5));

    // determinism: rebuild with the SAME seed and a DIFFERENT seed.
    const citySame = sumSig(instats(makeBackdrop(THREE, traits("city"), 5)));
    const cityDiff = sumSig(instats(makeBackdrop(THREE, traits("city"), 6)));
    const cityBase = sumSig(cityStats);
    const farmSame = sumSig(instats(makeBackdrop(THREE, traits("farm"), 5)));
    const farmDiff = sumSig(instats(makeBackdrop(THREE, traits("farm"), 6)));
    const farmBase = sumSig(farmStats);

    renderer.dispose();
    return {
      cityStats, farmStats, cityRender, farmRender, cityBlink, farmBlink,
      style: { build: buildStyle, planet: planetStyle, layout: styleLayout, spread: styleRenderSpread },
      shadow: {
        cityGround: groundReceives(city), farmGround: groundReceives(farm),
        cityCasters: cityStats.filter((m) => m.name === "buildings" && m.cast).length,
        cityBuildingReceives: cityStats.some((m) => m.name === "buildings" && m.receive),
        cityFoliageCasts: cityStats.some((m) => m.name.indexOf("foliage") === 0 && m.cast),
        farmCropCasts: farmStats.some((m) => m.name === "crops" && m.cast),
        farmSiloCasts: farmStats.some((m) => m.name === "silos" && m.cast),
        beaconNeverCasts: cityStats.concat(farmStats).every((m) => m.name !== "beacons" || !m.cast),
      },
      det: {
        cityIdentical: cityBase === citySame, cityDiffers: cityBase !== cityDiff,
        farmIdentical: farmBase === farmSame, farmDiffers: farmBase !== farmDiff,
      },
    };
  });

  const sumCount = (ms, name) => ms.filter((m) => m.name === name).reduce((a, m) => a + m.count, 0);
  const families = (ms, name) => Array.from(new Set(ms.filter((m) => m.name === name).map((m) => m.family)));
  const hasMesh = (ms, name) => ms.some((m) => m.name === name && m.count > 0);
  const cityB = sumCount(R.cityStats, "buildings");
  const cityFams = families(R.cityStats, "buildings");
  const farmC = sumCount(R.farmStats, "crops");
  const farmFams = families(R.farmStats, "crops");
  const farmS = sumCount(R.farmStats, "silos");

  console.log("=== CITY ===");
  console.log("  instanced:", JSON.stringify(R.cityStats.map((m) => ({ name: m.name, family: m.family, count: m.count }))));
  console.log("  shape families:", cityFams.join(", "));
  console.log("  render:", JSON.stringify(R.cityRender));
  console.log("  blink:", JSON.stringify(R.cityBlink));
  ok(cityB >= 40, `A1. city has a non-trivial building crowd (${cityB} buildings)`);
  ok(cityFams.length >= 5, `A2. city spans MANY shape families (${cityFams.length}: ${cityFams.join("/")})`);
  ok(hasMesh(R.cityStats, "beacons"), `A3. city has a blinking light field (${sumCount(R.cityStats, "beacons")} lights)`);
  ok(R.cityBlink.has && R.cityBlink.changed > 20, `A4. city lights BLINK (${R.cityBlink.changed}/${R.cityBlink.total} colour channels change across update calls)`);
  ok(hasMesh(R.cityStats, "foliage-trunk") && hasMesh(R.cityStats, "foliage-canopy"), `A5. city has foliage (trunks+canopies)`);
  ok(!R.cityRender.blank && !R.cityRender.allOneColor, `C1. city renders NON-BLANK (spread=${R.cityRender.spread})`);
  ok(R.cityRender.nonBg > 200, `C2. city draws real geometry (${R.cityRender.nonBg} non-bg px)`);

  console.log("=== FARM ===");
  console.log("  instanced:", JSON.stringify(R.farmStats.map((m) => ({ name: m.name, family: m.family, count: m.count }))));
  console.log("  crop families:", farmFams.join(", "));
  console.log("  render:", JSON.stringify(R.farmRender));
  console.log("  blink:", JSON.stringify(R.farmBlink));
  ok(farmC >= 60, `B1. farm has non-trivial crop rows (${farmC} crops)`);
  ok(farmFams.length >= 3, `B2. farm crops span multiple families (${farmFams.length}: ${farmFams.join("/")})`);
  ok(farmS >= 3, `B3. farm has silos (${farmS})`);
  ok(hasMesh(R.farmStats, "silo-roofs"), `B4. farm silos have roofs (${sumCount(R.farmStats, "silo-roofs")})`);
  ok(hasMesh(R.farmStats, "foliage-trunk") && hasMesh(R.farmStats, "foliage-canopy"), `B5. farm has foliage tree-lines`);
  ok(R.farmBlink.has && R.farmBlink.changed > 5, `B6. farm fireflies BLINK (${R.farmBlink.changed}/${R.farmBlink.total} channels change)`);
  ok(!R.farmRender.blank && !R.farmRender.allOneColor, `C3. farm renders NON-BLANK (spread=${R.farmRender.spread})`);
  ok(R.farmRender.nonBg > 200, `C4. farm draws real geometry (${R.farmRender.nonBg} non-bg px)`);

  console.log("=== SHADOWS ===");
  console.log("  shadow flags:", JSON.stringify(R.shadow));
  ok(R.shadow.cityGround && R.shadow.farmGround, "S1. ground receives shadows (city+farm)");
  ok(R.shadow.cityCasters >= 5, `S2. city building families cast shadows (${R.shadow.cityCasters} caster meshes)`);
  ok(R.shadow.cityBuildingReceives, "S3. city buildings also receive (self/neighbour depth)");
  ok(R.shadow.cityFoliageCasts, "S4. city foliage casts shadows");
  ok(R.shadow.farmCropCasts && R.shadow.farmSiloCasts, "S5. farm crops + silos cast shadows");
  ok(R.shadow.beaconNeverCasts, "S6. glowing light octahedra never cast (no black holes in the glow)");

  console.log("=== RENDER STYLE (material language) ===");
  const J = (o) => JSON.stringify(o);
  const st = R.style;
  console.log("  building material by style:");
  for (const s of ["flat", "cel", "iridescent", "wireframe", "glitch", "matte"]) {
    console.log(`    ${s.padEnd(11)} build=${J(st.build[s])} planet=${J(st.planet[s])} layout-eq=${st.layout[s]} spread=${st.spread[s]}`);
  }
  // buildings: contrasting genres render in genuinely different material languages.
  ok(J(st.build.flat) !== J(st.build.wireframe), `M1. CITY buildings differ flat vs wireframe (${J(st.build.flat)} vs ${J(st.build.wireframe)})`);
  ok(J(st.build.cel) !== J(st.build.glitch) && J(st.build.cel) !== J(st.build.iridescent), "M2. CITY buildings differ cel vs glitch vs iridescent");
  ok(st.build.cel.toon && st.build.iridescent.shader === "sc_irid" && st.build.glitch.shader === "sc_glitch" && st.build.wireframe.wire && st.build.matte.smooth,
    "M3. CITY building treatments applied (cel=toon, irid/glitch shaders, wire, matte-smooth)");
  // planet: the highlight — clearly distinct surface per genre.
  ok(J(st.planet.flat) !== J(st.planet.wireframe) && J(st.planet.cel) !== J(st.planet.iridescent), `M4. PLANET surface differs by genre (flat=${J(st.planet.flat)} wire=${J(st.planet.wireframe)})`);
  ok(st.planet.cel.toon && st.planet.iridescent.shader === "sc_irid" && st.planet.glitch.shader === "sc_glitch" && st.planet.wireframe.wire,
    "M5. PLANET treatments applied (cel=toon, irid/glitch shaders, wireframe)");
  // render-only: the style must not perturb the seeded geometry layout.
  ok(["flat", "cel", "iridescent", "wireframe", "glitch", "matte"].every((s) => st.layout[s]), "M6. styled city layout byte-identical to base (render-only, seed untouched)");
  // every style compiles + renders non-blank (injected shaders survive compilation).
  ok(["flat", "cel", "iridescent", "wireframe", "glitch", "matte"].every((s) => st.spread[s] >= 8), `M7. every style renders NON-BLANK (spreads: ${["flat", "cel", "iridescent", "wireframe", "glitch", "matte"].map((s) => st.spread[s]).join("/")})`);

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
