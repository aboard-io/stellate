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
//   node test/backdrop-run.js
"use strict";
const path = require("path");
const { serve, capturePageErrors, installOfflineRoute } = require("./probe-harness.js");
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
  // OFFLINE: stub Google-Fonts + esm.sh and neutralise the full-app boot (this
  // probe imports the star-cruise submodules directly and never needs the app
  // store) so the page loads with no network and no slow/crashy boot.
  await installOfflineRoute(page, PORT, { neutralizeMain: true });
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

    // ---- FOLIAGE / LANDSCAPE SCALE (the skyscraper-spike bug) ------------------
    // In the FLAT (no-surface) frame, +Y is up, so an instance's world height reads
    // straight off its matrix: TOP = translation.y + scale.y (a ground-planted plant's
    // trunk-base + canopy stacks), and vertical EXTENT = scale.y (how tall the form is,
    // ignoring float altitude — the right measure for "towering spike"). Prove foliage
    // is SMALL (well under band scale + a small fraction of the tallest building), the
    // near-ground landscape layer doesn't spike, and the scatter is sparse not a forest.
    const _M = new THREE.Matrix4(), _tp = new THREE.Vector3(), _tq = new THREE.Quaternion(), _ts = new THREE.Vector3();
    function heightStats(b, pred) {
      let maxTop = 0, maxExtent = 0, n = 0;
      b.group.traverse((o) => {
        if (!o.isInstancedMesh || !pred(o)) return;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, _M); _M.decompose(_tp, _tq, _ts);
          const top = _tp.y + _ts.y;
          if (top > maxTop) maxTop = top;
          if (_ts.y > maxExtent) maxExtent = _ts.y;
          n++;
        }
      });
      return { maxTop: +maxTop.toFixed(2), maxExtent: +maxExtent.toFixed(2), n };
    }
    const instCount = (b, name) => { let c = 0; b.group.traverse((o) => { if (o.isInstancedMesh && o.name === name) c = o.count; }); return c; };
    const isFoliage = (o) => o.name === "foliage-trunk" || o.name === "foliage-canopy";
    const isLand = (o) => /^land-/.test(o.name);
    const isBuilding = (o) => o.name === "buildings";
    // measure landscape scale across a few genres (each picks a different landscape kind).
    const landGenre = (plan) => makeBackdrop(THREE, Object.assign(traits("city"), { body: { plan }, renderStyle: { material: "flat" } }), 5);
    const landPlans = ["crystalline", "stalk", "amorphous", "cephalopod", "insectoid", "radial"];
    let landMaxExtent = 0, landMaxTop = 0;
    for (const p of landPlans) {
      const hs = heightStats(landGenre(p), isLand);
      if (hs.maxExtent > landMaxExtent) landMaxExtent = hs.maxExtent;
      if (hs.maxTop > landMaxTop) landMaxTop = hs.maxTop;
    }
    const scale = {
      cityFoliage: heightStats(city, isFoliage),
      farmFoliage: heightStats(farm, isFoliage),
      cityCrops: heightStats(farm, (o) => o.name === "crops"),
      cityBuild: heightStats(city, isBuilding),
      cityTrees: instCount(city, "foliage-canopy"),
      farmTrees: instCount(farm, "foliage-canopy"),
      landMaxExtent: +landMaxExtent.toFixed(2),
      landMaxTop: +landMaxTop.toFixed(2),
    };

    // determinism: rebuild with the SAME seed and a DIFFERENT seed.
    const citySame = sumSig(instats(makeBackdrop(THREE, traits("city"), 5)));
    const cityDiff = sumSig(instats(makeBackdrop(THREE, traits("city"), 6)));
    const cityBase = sumSig(cityStats);
    const farmSame = sumSig(instats(makeBackdrop(THREE, traits("farm"), 5)));
    const farmDiff = sumSig(instats(makeBackdrop(THREE, traits("farm"), 6)));
    const farmBase = sumSig(farmStats);

    // ---- ABSTRACT WORLDS / DE-SQUARE / CONTRAST -------------------------------
    // The set of instanced shape FAMILIES present, the balls-of-light count, and the
    // brightest emissive material — used to prove non-box variety, per-genre distinct
    // environments, and value/colour contrast.
    const familySet = (b) => {
      const s = new Set();
      b.group.traverse((o) => { if (o.isInstancedMesh) s.add(o.name + "/" + ((o.userData && o.userData.family) || "")); });
      return Array.from(s).sort();
    };
    const orbCount = (b) => { let n = 0; b.group.traverse((o) => { if (o.isInstancedMesh && o.name === "orbs") n = o.count; }); return n; };
    const emissiveMax = (b) => {
      let e = 0;
      b.group.traverse((o) => {
        if ((o.isMesh || o.isInstancedMesh) && o.material && o.material.emissive) {
          const c = o.material.emissive, ei = o.material.emissiveIntensity == null ? 1 : o.material.emissiveIntensity;
          const l = Math.max(c.r, c.g, c.b) * ei; if (l > e) e = l;
        }
      });
      return e;
    };
    // build the world for a few distinct species body-plans (world keys off body.plan).
    const worldTraits = (plan) => Object.assign(traits("city"), { skin: "chrome", body: { plan }, renderStyle: { material: "flat" } });
    const wCrystal = makeBackdrop(THREE, worldTraits("crystalline"), 5);
    const wGas = makeBackdrop(THREE, worldTraits("floating-gas"), 5);
    const wAmorph = makeBackdrop(THREE, worldTraits("amorphous"), 5);
    const fCrystal = familySet(wCrystal), fGas = familySet(wGas), fAmorph = familySet(wAmorph);
    // NON-BOX round/curved families anywhere in the environment.
    const roundRe = /ring|orb|lightball|arch|dome|bubble|cloud|tendril|blob|bulb|platform|mound/;
    const worlds = {
      cityOrbs: orbCount(city), farmOrbs: orbCount(farm),
      cityHasRound: familySet(city).some((f) => roundRe.test(f)),
      cityEmissive: emissiveMax(city),
      crystalFams: fCrystal, gasFams: fGas, amorphFams: fAmorph,
      distinct: JSON.stringify(fCrystal) !== JSON.stringify(fGas) && JSON.stringify(fGas) !== JSON.stringify(fAmorph) && JSON.stringify(fCrystal) !== JSON.stringify(fAmorph),
      // determinism of the world: same plan+seed -> identical family+layout signature.
      worldDet: sumSig(instats(wCrystal)) === sumSig(instats(makeBackdrop(THREE, worldTraits("crystalline"), 5))),
    };

    // ---- DISTINCT ABSTRACT PLANET per genre -----------------------------------
    const planetKids = (p) => {
      const names = [];
      p.group.traverse((o) => { if (o !== p.group && (o.isMesh || o.isInstancedMesh)) names.push(o.name); });
      return names.sort();
    };
    const pCrystal = makePlanet(THREE, worldTraits("crystalline"), 4);
    const pGas = makePlanet(THREE, worldTraits("floating-gas"), 4);
    const pMolten = makePlanet(THREE, worldTraits("amorphous"), 4);
    pCrystal.update(0.1); pGas.update(0.1); pMolten.update(0.1);
    const planetWorld = {
      crystal: planetKids(pCrystal), gas: planetKids(pGas), molten: planetKids(pMolten),
      crystalHasSpikes: planetKids(pCrystal).includes("planet-spikes"),
      moltenHasGlow: planetKids(pMolten).includes("planet-glow"),
      distinct: JSON.stringify(planetKids(pCrystal)) !== JSON.stringify(planetKids(pGas)),
    };

    // ---- #5 L-SYSTEM / SHAPE-GRAMMAR + #4 PBR --------------------------------
    // The city is grown by a recursive split-grammar into MODULES: superquadric
    // masses ('sq'), curve-swept tube spires ('tube'), lathe cupolas ('lathe') +
    // greebles, plus a minority of baked-window box towers ('box'). Prove the
    // buildings are de-squared (curve/superquadric prims present, not just boxes),
    // span many module families, and that the 'pbr' renderStyle swaps in a real
    // MeshStandardMaterial (env-mapped) for city + planet — render-only + non-blank.
    function buildingPrims(b) { const s = new Set(); b.group.traverse((o) => { if (o.isInstancedMesh && o.name === "buildings") s.add((o.userData && o.userData.prim) || "?"); }); return Array.from(s).sort(); }
    function buildingFamilyCount(b) { let n = 0; b.group.traverse((o) => { if (o.isInstancedMesh && o.name === "buildings") n++; }); return n; }
    function pbrBuildMat(b) {
      let out = null;
      b.group.traverse((o) => {
        if (out) return;
        if (o.isInstancedMesh && o.name === "buildings" && o.material) {
          const m = o.material; out = { type: m.type, standard: !!m.isMeshStandardMaterial, env: !!m.envMap, metal: m.metalness };
        }
      });
      return out;
    }
    const grammar = { cityPrims: buildingPrims(city), cityBFams: buildingFamilyCount(city) };
    const pbrCity = makeBackdrop(THREE, styleTraits("city", "pbr"), 5);
    const pbrPlanet = makePlanet(THREE, styleTraits("city", "pbr"), 5);
    pbrPlanet.update(0.1);
    const pbrProbe = {
      build: pbrBuildMat(pbrCity),
      layoutEq: sumSig(instats(pbrCity)) === baseLayout,
      spread: renderStats(pbrCity).spread,
      planet: matSig(pbrPlanet.group, "planet-body"),
    };

    // ---- #3 PER-GENRE GRAMMAR + LANDSCAPE VARIETY -----------------------------
    // Two contrasting genres must grow OBVIOUSLY different cities: a different grammar
    // ARCHETYPE (silhouette family), disjoint building instance-family SETS, and a
    // different LANDSCAPE feature family set. Driven by body.plan, render-only-safe.
    const genreTraits = (plan) => Object.assign(traits("city"), { body: { plan }, renderStyle: { material: "flat" } });
    const bFamSet = (b) => { const s = new Set(); b.group.traverse((o) => { if (o.isInstancedMesh && o.name === "buildings") s.add((o.userData && o.userData.family) || ""); }); return Array.from(s).sort(); };
    const lFamSet = (b) => { const s = new Set(); b.group.traverse((o) => { if (o.isInstancedMesh && /^land-/.test(o.name)) s.add((o.userData && o.userData.family) || ""); }); return Array.from(s).sort(); };
    const gTag = (b) => (b.group.userData && b.group.userData.cityGrammar) || "";
    const lTag = (b) => (b.group.userData && b.group.userData.landscape) || "";
    const gA = makeBackdrop(THREE, genreTraits("crystalline"), 7);   // -> ziggurat + crystal
    const gB = makeBackdrop(THREE, genreTraits("stalk"), 7);         // -> spires   + desert
    const aB = bFamSet(gA), bB = bFamSet(gB), aL = lFamSet(gA), bL = lFamSet(gB);
    const variety = {
      aGrammar: gTag(gA), bGrammar: gTag(gB),
      aLand: lTag(gA), bLand: lTag(gB),
      aBuild: aB, bBuild: bB, aLandFams: aL, bLandFams: bL,
      grammarsDiffer: gTag(gA) !== gTag(gB),
      buildDisjoint: aB.length > 0 && bB.length > 0 && aB.every((f) => !bB.includes(f)),
      landDiffer: JSON.stringify(aL) !== JSON.stringify(bL) && aL.length > 0 && bL.length > 0,
      archetypes: ["crystalline", "stalk", "floating-gas", "insectoid", "radial", "amorphous"].map((p) => gTag(makeBackdrop(THREE, genreTraits(p), 7))),
      landscapes: ["crystalline", "stalk", "floating-gas", "cephalopod", "amorphous"].map((p) => lTag(makeBackdrop(THREE, genreTraits(p), 7))),
    };

    // ---- CURVED-SURFACE PLACEMENT (small-world integration seam) ----------------
    // A MOCK planet surface: a sphere of radius R with flat terrain. surfacePoint(dir)
    // = dir*R, upAt(dir) = dir (outward normal), frame = the standard landing pole.
    // Proves every instance foot-plants ON the sphere oriented to the surface normal.
    const SR = 24;
    const mockSurface = {
      radius: SR, up: [0, 1, 0], tangentX: [1, 0, 0], tangentZ: [0, 0, 1],
      surfacePoint: (d) => new THREE.Vector3(d.x * SR, d.y * SR, d.z * SR),
      upAt: (d) => new THREE.Vector3(d.x, d.y, d.z),
    };
    const curved = makeBackdrop(THREE, traits("city"), 5, { surface: mockSurface });
    function curvedSampleStats(b, onlyBuildings) {
      const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
      const M = new THREE.Matrix4(), up = new THREE.Vector3(), nrm = new THREE.Vector3();
      let n = 0, onSphere = 0, oriented = 0, minR = 1e9, maxR = 0;
      b.group.traverse((o) => {
        if (!o.isInstancedMesh) return;
        if (onlyBuildings && o.name !== "buildings") return;
        if (o.name === "orbs" || o.name === "beacons") return;   // point lights, tilt irrelevant
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, M); M.decompose(P, Q, S);
          const r = P.length();
          up.set(0, 1, 0).applyQuaternion(Q);
          nrm.copy(P).normalize();
          n++; if (r < minR) minR = r; if (r > maxR) maxR = r;
          if (r > SR - 3 && r < SR + 80) onSphere++;      // planted on / lifted above the sphere
          if (up.dot(nrm) > 0.9) oriented++;              // local +Y ~ surface normal
        }
      });
      return { n, onSphere, oriented, minR: +minR.toFixed(2), maxR: +maxR.toFixed(2) };
    }
    const curvedBuildings = curvedSampleStats(curved, true);
    const curvedAll = curvedSampleStats(curved, false);
    const curvedDet = sumSig(instats(curved)) === sumSig(instats(makeBackdrop(THREE, traits("city"), 5, { surface: mockSurface })));
    const curvedVsFlat = sumSig(instats(curved)) !== baseLayout;   // placement genuinely mapped onto the sphere
    const flatStillWorks = sumSig(instats(makeBackdrop(THREE, traits("city"), 5))) === baseLayout;   // no-surface path unchanged

    renderer.dispose();
    return {
      scale,
      variety, curved: { buildings: curvedBuildings, all: curvedAll, det: curvedDet, vsFlat: curvedVsFlat, flatStillWorks },
      cityStats, farmStats, cityRender, farmRender, cityBlink, farmBlink, worlds, planetWorld, grammar, pbr: pbrProbe,
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

  console.log("=== ABSTRACT WORLDS / SHAPES / CONTRAST ===");
  const W = R.worlds;
  console.log("  city orbs:", W.cityOrbs, " city emissiveMax:", W.cityEmissive.toFixed(2));
  console.log("  crystalline world families:", W.crystalFams.filter((f) => f.indexOf("world") === 0 || f.indexOf("orbs") === 0).join(", "));
  console.log("  floating-gas world families:", W.gasFams.filter((f) => f.indexOf("world") === 0 || f.indexOf("orbs") === 0).join(", "));
  console.log("  amorphous  world families:", W.amorphFams.filter((f) => f.indexOf("world") === 0 || f.indexOf("orbs") === 0).join(", "));
  ok(W.cityOrbs > 0 && W.farmOrbs > 0, `W1. worlds scatter a signature field of glowing BALLS OF LIGHT (city=${W.cityOrbs}, farm=${W.farmOrbs} orbs)`);
  ok(W.cityHasRound, "W2. environment includes NON-BOX round/curved families (spheres/rings/arches/tendrils/domes)");
  ok(W.distinct, "W3. distinct genre body-plans yield DISTINCT abstract worlds (family sets differ)");
  ok(W.cityEmissive > 0, `W4. environment has emissive CONTRAST (bright emissive present, max=${W.cityEmissive.toFixed(2)})`);
  ok(W.worldDet, "W5. abstract world is deterministic (same plan+seed -> identical layout)");
  const P = R.planetWorld;
  console.log("  planet(crystalline) kids:", P.crystal.join(", "));
  console.log("  planet(floating-gas) kids:", P.gas.join(", "));
  console.log("  planet(amorphous)   kids:", P.molten.join(", "));
  ok(P.distinct, "W6. fly-away PLANET renders a distinct abstract world per genre");
  ok(P.crystalHasSpikes, "W7. crystalline planet grows surface shards (planet-spikes)");
  ok(P.moltenHasGlow, "W8. molten planet reads hot (planet-glow shell)");

  console.log("=== L-SYSTEM / SHAPE-GRAMMAR + PBR ===");
  const GR = R.grammar, PB = R.pbr;
  console.log("  building module prims:", GR.cityPrims.join(", "), " | building family meshes:", GR.cityBFams);
  console.log("  pbr city building material:", JSON.stringify(PB.build), " layout-eq:", PB.layoutEq, " spread:", PB.spread);
  console.log("  pbr planet-body material:", JSON.stringify(PB.planet));
  ok(GR.cityPrims.indexOf("sq") >= 0 && GR.cityPrims.indexOf("tube") >= 0, `G1. city grown from SUPERQUADRIC masses + CURVE-SWEPT tube spires (prims: ${GR.cityPrims.join("/")})`);
  ok(GR.cityPrims.indexOf("lathe") >= 0, `G2. grammar uses LATHE profiles (cupola toppers) too (prims: ${GR.cityPrims.join("/")})`);
  ok(!(GR.cityPrims.length === 1 && GR.cityPrims[0] === "box"), "G3. buildings are DE-SQUARED (curved/superquadric geometry, not just boxes)");
  ok(GR.cityBFams >= 8, `G4. grammar yields MANY varied module families (${GR.cityBFams} building meshes)`);
  ok(PB.build && PB.build.standard && PB.build.type === "MeshStandardMaterial", `P1. 'pbr' renderStyle uses a real MeshStandardMaterial for buildings (${JSON.stringify(PB.build)})`);
  ok(PB.build && PB.build.env, "P2. pbr buildings reflect the ONE shared procedural env map (envMap present)");
  ok(PB.layoutEq, "P3. pbr city layout byte-identical to base (render-only, seed untouched)");
  ok(PB.spread >= 8, `P4. pbr city renders NON-BLANK (spread=${PB.spread})`);
  ok(PB.planet && PB.planet.type === "MeshStandardMaterial", `P5. 'pbr' PLANET body is a MeshStandardMaterial (${JSON.stringify(PB.planet)})`);

  console.log("=== #3 PER-GENRE GRAMMAR + LANDSCAPE VARIETY ===");
  const V = R.variety;
  console.log("  genre A (crystalline): grammar=" + V.aGrammar + " land=" + V.aLand);
  console.log("    building families:", V.aBuild.join(", "));
  console.log("    landscape families:", V.aLandFams.join(", "));
  console.log("  genre B (stalk):       grammar=" + V.bGrammar + " land=" + V.bLand);
  console.log("    building families:", V.bBuild.join(", "));
  console.log("    landscape families:", V.bLandFams.join(", "));
  console.log("  archetypes across 6 plans:", V.archetypes.join(", "));
  console.log("  landscapes across 5 plans:", V.landscapes.join(", "));
  ok(V.grammarsDiffer, `V1. two genres grow DIFFERENT city grammar archetypes (${V.aGrammar} vs ${V.bGrammar})`);
  ok(V.buildDisjoint, "V2. their building instance-family SETS are disjoint (obviously different silhouettes)");
  ok(V.landDiffer, `V3. their LANDSCAPE feature families differ (${V.aLandFams.join("/")} vs ${V.bLandFams.join("/")})`);
  ok(new Set(V.archetypes).size >= 4, `V4. the genre->grammar map spans MANY archetypes (${new Set(V.archetypes).size} distinct: ${Array.from(new Set(V.archetypes)).join("/")})`);
  ok(new Set(V.landscapes).size >= 4, `V5. the genre->landscape map spans MANY types (${new Set(V.landscapes).size} distinct: ${Array.from(new Set(V.landscapes)).join("/")})`);

  console.log("=== CURVED-SURFACE PLACEMENT (small-world integration) ===");
  const CV = R.curved;
  console.log("  building instances:", JSON.stringify(CV.buildings));
  console.log("  all features:", JSON.stringify(CV.all));
  ok(CV.buildings.n >= 20, `X1. curved mode placed a real building crowd (${CV.buildings.n} instances)`);
  ok(CV.buildings.onSphere === CV.buildings.n && CV.buildings.minR > 21, `X2. every building foot-plants ON the mock sphere (r in [${CV.buildings.minR}, ${CV.buildings.maxR}], radius 24)`);
  ok(CV.buildings.oriented >= CV.buildings.n * 0.85, `X3. buildings ORIENT to the surface normal (${CV.buildings.oriented}/${CV.buildings.n} local-up ~ normal)`);
  ok(CV.all.onSphere === CV.all.n, `X4. all curved features (landscape/foliage/world) sit on the sphere (${CV.all.onSphere}/${CV.all.n})`);
  ok(CV.vsFlat, "X5. curved layout genuinely differs from the flat layout (placement mapped onto the sphere)");
  ok(CV.det, "X6. curved build is deterministic (same traits+seed+surface -> identical layout)");
  ok(CV.flatStillWorks, "X7. the FLAT (no-surface) path is unchanged — v15 callers still work");

  console.log("=== FOLIAGE / LANDSCAPE SCALE (no skyscraper spikes) ===");
  const SC = R.scale;
  console.log("  city foliage:", JSON.stringify(SC.cityFoliage), " trees:", SC.cityTrees);
  console.log("  farm foliage:", JSON.stringify(SC.farmFoliage), " trees:", SC.farmTrees);
  console.log("  farm crops:  ", JSON.stringify(SC.cityCrops));
  console.log("  tallest building top:", SC.cityBuild.maxTop, " (extent", SC.cityBuild.maxExtent + ")");
  console.log("  near-ground landscape: maxExtent", SC.landMaxExtent, " maxTop", SC.landMaxTop);
  const BAND = 2.5;   // band-scale ceiling: nothing near the band may top this
  const LAND_CEIL = 3.6;   // near-ground landscape ceiling (matches backdrop LAND_MAX_H + fp slack)
  ok(SC.cityFoliage.maxTop < BAND && SC.farmFoliage.maxTop < BAND,
    `F1. FOLIAGE is small — no plant tops band scale (city=${SC.cityFoliage.maxTop}, farm=${SC.farmFoliage.maxTop} < ${BAND})`);
  ok(SC.cityFoliage.maxTop * 3 < SC.cityBuild.maxTop,
    `F2. foliage is a small FRACTION of a building's height (foliage ${SC.cityFoliage.maxTop} vs tallest building ${SC.cityBuild.maxTop})`);
  ok(SC.landMaxExtent < LAND_CEIL && SC.landMaxExtent < SC.cityBuild.maxTop,
    `F3. near-ground LANDSCAPE features don't spike (max extent ${SC.landMaxExtent} < ${LAND_CEIL} and < building ${SC.cityBuild.maxTop})`);
  ok(SC.cityTrees > 0 && SC.cityTrees <= 18 && SC.farmTrees > 0 && SC.farmTrees <= 18,
    `F4. foliage is a LIGHT scatter, not a forest (city=${SC.cityTrees}, farm=${SC.farmTrees} trees, each in [1,18])`);
  ok(SC.cityCrops.maxTop < 3.2, `F5. farm crops stay near ground (max top ${SC.cityCrops.maxTop} < 3.2)`);

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
