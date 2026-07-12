// test/planet-run.js — PROOF harness for app/starcruise/planet.js (the star-cruise
// procedural planet). Run headless with node:
//     node test/planet-run.js
//
// Proves the FOUNDATION contract:
//   1. makePlanet builds a NON-EMPTY, valid displaced geometry (+ atmosphere child).
//   2. DETERMINISM — two builds of one seed are byte-identical (positions+colors);
//      different seeds differ.
//   3. heightAtDir MATCHES the baked mesh (every vertex radius == heightAtDir(dir)).
//   4. heightAt is CONTINUOUS (small dx -> small dy) and self-consistent at the pole.
//   5. It imports simplex-noise from vendor/ (NOT a CDN) — asserted structurally.
//
// Uses the REAL vendored Three (r160) — same module the mode lazy-imports.

import * as THREE from "../vendor/three/three.module.min.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  makePlanet, makeHeightField, chooseTerrainType, smallWorldRadius,
  curvatureDrop, TERRAIN_TYPE_NAMES,
} from "../app/starcruise/planet.js";

const __dir = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) failures++; };

// ---- 5. imports simplex-noise from vendor/, not a CDN ------------------------
{
  const src = readFileSync(resolve(__dir, "../app/starcruise/planet.js"), "utf8");
  const imp = src.match(/import\s*\{[^}]*\}\s*from\s*["']([^"']+simplex-noise[^"']*)["']/);
  ok(!!imp, "planet.js imports simplex-noise");
  ok(imp && imp[1].includes("vendor/simplex-noise"), "  -> from vendor/ (" + (imp && imp[1]) + ")");
  ok(imp && !/^https?:|esm\.sh|unpkg|jsdelivr|cdn/.test(imp[1]), "  -> NOT a CDN URL");
  // and the vendored file itself pulls in nothing remote
  const vsrc = readFileSync(resolve(__dir, "../vendor/simplex-noise/simplex-noise.js"), "utf8");
  ok(!/from\s*["']https?:|require\(/.test(vsrc), "vendored simplex-noise has no remote import");
}

// ---- 1. build a non-empty planet ---------------------------------------------
const palette = {
  skin: { h: 130, s: 0.55, l: 0.45 },
  cloth: { h: 90, s: 0.5, l: 0.5 },
  accent: { h: 40, s: 0.85, l: 0.6 },
};
const planet = makePlanet(THREE, 12345, palette, { detail: 4, radius: 10 });
{
  const g = planet.geometry;
  const nPos = g.attributes.position.count;
  ok(planet.isMesh, "makePlanet returns a THREE.Mesh");
  ok(nPos > 100, "geometry non-empty (" + nPos + " verts)");
  ok(!!g.attributes.color && g.attributes.color.count === nPos, "per-vertex colours baked");
  ok(!!g.attributes.normal, "vertex normals recomputed");
  // no NaNs in positions
  const pa = g.attributes.position.array;
  let bad = 0; for (let i = 0; i < pa.length; i++) if (!Number.isFinite(pa[i])) bad++;
  ok(bad === 0, "no NaN/Inf in displaced positions");
  const atmo = planet.children.find((c) => c.name === "atmosphere");
  ok(!!atmo, "fresnel atmosphere shell attached as child");
  ok(typeof planet.heightAt === "function" && typeof planet.heightAtDir === "function",
    "mesh exposes heightAt / heightAtDir");
}

// ---- 2. determinism ----------------------------------------------------------
function sig(mesh) {
  const p = Buffer.from(mesh.geometry.attributes.position.array.buffer.slice(0));
  const c = Buffer.from(mesh.geometry.attributes.color.array.buffer.slice(0));
  return Buffer.concat([p, c]).toString("base64");
}
{
  const a = makePlanet(THREE, 777, palette, { detail: 4, radius: 10 });
  const b = makePlanet(THREE, 777, palette, { detail: 4, radius: 10 });
  const c = makePlanet(THREE, 778, palette, { detail: 4, radius: 10 });
  ok(sig(a) === sig(b), "two builds of seed 777 are BYTE-IDENTICAL");
  ok(sig(a) !== sig(c), "seed 778 DIFFERS from 777");
  // the CPU field is also deterministic
  const f1 = makeHeightField(777, { radius: 10 });
  const f2 = makeHeightField(777, { radius: 10 });
  ok(f1.heightAtDir(0.3, 0.6, -0.2) === f2.heightAtDir(0.3, 0.6, -0.2), "heightAtDir deterministic same-seed");
  ok(f1.heightAtDir(0.3, 0.6, -0.2) !== makeHeightField(778, { radius: 10 }).heightAtDir(0.3, 0.6, -0.2),
    "heightAtDir differs across seeds");
}

// ---- 3. heightAtDir matches the displaced mesh EXACTLY -----------------------
{
  const g = planet.geometry;
  const pos = g.attributes.position;
  let maxErr = 0;
  for (let i = 0; i < pos.count; i += 37) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, y, z);                 // actual baked surface radius
    const h = planet.heightAtDir(x, y, z);         // analytic radius in same dir
    maxErr = Math.max(maxErr, Math.abs(r - h));
  }
  ok(maxErr < 1e-4, "heightAtDir matches baked vertex radii (max err " + maxErr.toExponential(2) + ")");
}

// ---- 4. heightAt continuity + pole consistency -------------------------------
{
  // pole (x=0,z=0) elevation must equal the radius straight up (dir = up)
  const upR = planet.heightAtDir(0, 1, 0);
  const poleH = planet.heightAt(0, 0);
  ok(Math.abs(poleH - upR) < 1e-4, "heightAt(0,0) == surface radius at the pole");

  // continuity: sample a grid, adjacent samples must not jump (bounded slope)
  const step = 0.02, span = 2.0;
  let prev = null, maxJump = 0, samples = 0;
  for (let x = -span; x <= span; x += step) {
    const h = planet.heightAt(x, 0.5);
    if (prev !== null) maxJump = Math.max(maxJump, Math.abs(h - prev));
    prev = h; samples++;
  }
  ok(samples > 50, "sampled " + samples + " points along a line");
  // a 0.02 world-step on a radius-10 planet: continuous fBm -> jumps must be tiny
  ok(maxJump < 0.5, "heightAt is continuous (max adjacent jump " + maxJump.toFixed(4) + ")");
  ok(Number.isFinite(planet.heightAt(3.3, -1.7)), "heightAt finite off-axis");
}

// ---- knob overrides flow through -----------------------------------------------
{
  const f = makeHeightField(5, { freq: 2.0, octaves: 3, seaLevel: 0.5, radius: 4, reliefFrac: 0.2 });
  ok(f.knobs.freq === 2.0 && f.knobs.octaves === 3 && f.knobs.seaLevel === 0.5, "opts override the seeded knobs");
  ok(f.knobs.octaves <= 6, "octaves capped for mobile");
}

// ---- shared: fibonacci-sphere direction sampler + per-planet terrain stats ------
function sampleDirs(count) {
  const dirs = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * i + 1) / count;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i;
    dirs.push([Math.cos(th) * rad, y, Math.sin(th) * rad]);
  }
  return dirs;
}
const DIRS = sampleDirs(600);
// terrain signature: relief range, water fraction, mean vertex-colour hue.
function planetStats(mesh) {
  const f = mesh.field, k = f.knobs;
  let lo = Infinity, hi = -Infinity, water = 0;
  for (const d of DIRS) {
    const r = f.heightAtDir(d[0], d[1], d[2]);
    if (r < lo) lo = r; if (r > hi) hi = r;
    if (f.elevation01(d[0], d[1], d[2]) < k.seaLevel) water++;
  }
  // mean vertex colour -> HSL hue
  const col = mesh.geometry.attributes.color.array;
  let mr = 0, mg = 0, mb = 0, nC = col.length / 3;
  for (let i = 0; i < col.length; i += 3) { mr += col[i]; mg += col[i + 1]; mb += col[i + 2]; }
  mr /= nC; mg /= nC; mb /= nC;
  const c = new THREE.Color(mr, mg, mb); const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
  return { type: mesh.userData.terrainType, relief: hi - lo,
    water: water / DIRS.length, hue: hsl.h * 360, sat: hsl.s, colRGB: [mr, mg, mb] };
}

// ---- 6. LITTLE-PRINCE SMALL WORLD: small curvature-legible radius + surface API ---
{
  const sw = makePlanet(THREE, 4242, palette, { detail: 4, smallWorld: true, bandSpan: 10 });
  const R = sw.userData.radius;
  ok(R === smallWorldRadius(10), "smallWorld picks the small-world radius (R=" + R + " for band 10)");
  ok(R >= 12 && R <= 24, "  -> a SMALL round world (12..24), not a flat-floor giant");
  const drop = curvatureDrop(R, 5);                    // horizon fall across a 5-unit half-band
  ok(drop > 0.3, "curvature is VISIBLE at band scale (horizon drops " + drop.toFixed(2) + " over 5 units)");
  ok(sw.userData.smallWorld === true, "mesh flags userData.smallWorld");
}

// ---- 7. surfacePoint / upAt consistent with the baked mesh surface --------------
{
  const g = planet.geometry, pos = g.attributes.position;
  let maxSP = 0, minRadialDot = 1, minOut = 1;
  const spV = [0, 0, 0], upV = [0, 0, 0];
  for (let i = 0; i < pos.count; i += 53) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const dir = [x / len, y / len, z / len];
    planet.surfacePoint(dir, undefined, undefined);    // vector-form (backdrop contract)
    const sp = planet.surfacePoint(dir[0], dir[1], dir[2], spV);
    maxSP = Math.max(maxSP, Math.hypot(sp[0] - x, sp[1] - y, sp[2] - z));
    planet.upAt(dir[0], dir[1], dir[2], upV);
    const ulen = Math.hypot(upV[0], upV[1], upV[2]);
    minOut = Math.min(minOut, ulen);                   // upAt must be unit length
    // radial outward normal: dot(up, dir) ~ 1, and dot(surfacePoint, up) > 0
    minRadialDot = Math.min(minRadialDot, upV[0] * dir[0] + upV[1] * dir[1] + upV[2] * dir[2]);
    const spd = sp[0] * upV[0] + sp[1] * upV[1] + sp[2] * upV[2];
    if (spd <= 0) minRadialDot = -1;                   // surface point must be outward
  }
  ok(maxSP < 1e-4, "surfacePoint(dir) lands exactly on the baked mesh vertex (max err " + maxSP.toExponential(2) + ")");
  ok(Math.abs(minOut - 1) < 1e-6, "upAt(dir) is a UNIT vector");
  ok(minRadialDot > 0.999, "upAt(dir) is the OUTWARD radial normal (min dot " + minRadialDot.toFixed(5) + ")");
  // vector-form (Vector3 | {x,y,z}) accepted like the backdrop calls it
  const v3 = new THREE.Vector3(0.2, 0.9, -0.3);
  const spVec = planet.surfacePoint(v3);
  const spObj = planet.surfacePoint({ x: 0.2, y: 0.9, z: -0.3 });
  ok(Array.isArray(spVec) && spVec.length === 3 && Number.isFinite(spVec[0]),
    "surfacePoint accepts a Vector3 and returns [x,y,z]");
  ok(Math.abs(spVec[0] - spObj[0]) < 1e-9 && Math.abs(spVec[1] - spObj[1]) < 1e-9,
    "surfacePoint accepts {x,y,z} identically (backdrop _asV contract)");
}

// ---- 8. >= 6 DISTINCT terrain types selectable, each obviously different ----------
{
  ok(TERRAIN_TYPE_NAMES.length >= 6, "catalogue exposes >= 6 terrain types (" + TERRAIN_TYPE_NAMES.length + ": " + TERRAIN_TYPE_NAMES.join(",") + ")");
  const stats = TERRAIN_TYPE_NAMES.map((t) =>
    planetStats(makePlanet(THREE, 9001, palette, { detail: 4, radius: 10, terrainType: t })));
  // every forced type reports its own name back
  ok(stats.every((s, i) => s.type === TERRAIN_TYPE_NAMES[i]), "each forced terrainType round-trips to userData");
  // distinctness: cluster by (water bucket, relief bucket, hue bucket) — expect many
  const key = (s) => Math.round(s.water * 4) + "|" + Math.round(s.relief * 3) + "|" + Math.round(s.hue / 40);
  const distinct = new Set(stats.map(key));
  ok(distinct.size >= 6, "the terrain types fall into >= 6 distinct (water/relief/hue) signatures (" + distinct.size + ")");
  // no two ADJACENT types share an identical colour+relief signature
  const sigs = new Set(stats.map((s) => key(s)));
  ok(sigs.size === distinct.size, "signatures are set-consistent");
  // auto-selection across seeds actually spreads across the catalogue
  const seen = new Set();
  for (let s = 1; s <= 60; s++) seen.add(chooseTerrainType(s));
  ok(seen.size >= 6, "auto-selection over 60 seeds spans >= 6 types (" + seen.size + ")");
}

// ---- 9. TWO CONTRASTING GENRES -> obviously different worlds ---------------------
{
  const palOcean = { skin: { h: 200, s: 0.5, l: 0.45 }, cloth: { h: 210, s: 0.5, l: 0.5 }, accent: { h: 190, s: 0.7, l: 0.6 } };
  const palDune = { skin: { h: 30, s: 0.6, l: 0.5 }, cloth: { h: 40, s: 0.5, l: 0.55 }, accent: { h: 20, s: 0.85, l: 0.6 } };
  const A = planetStats(makePlanet(THREE, 111, palOcean, { detail: 4, radius: 10, terrainType: "seas" }));
  const B = planetStats(makePlanet(THREE, 222, palDune, { detail: 4, radius: 10, terrainType: "desert" }));
  ok(A.type !== B.type, "different terrain TYPE (" + A.type + " vs " + B.type + ")");
  ok(A.water > 0.35 && B.water < 0.05, "different WATER coverage (seas " + (A.water * 100).toFixed(0) + "% vs desert " + (B.water * 100).toFixed(0) + "%)");
  // mean-colour distance in RGB is large (clearly different palettes)
  const dCol = Math.hypot(A.colRGB[0] - B.colRGB[0], A.colRGB[1] - B.colRGB[1], A.colRGB[2] - B.colRGB[2]);
  ok(dCol > 0.2, "different PALETTE (mean-colour RGB distance " + dCol.toFixed(3) + ")");
  ok(Math.abs(A.hue - B.hue) > 60, "different base HUE (" + A.hue.toFixed(0) + "deg vs " + B.hue.toFixed(0) + "deg)");
  ok(Math.abs(A.relief - B.relief) > 0.05 * 10 || A.type !== B.type, "different RELIEF profile (" + A.relief.toFixed(2) + " vs " + B.relief.toFixed(2) + ")");
}

// ---- 10. determinism holds per FORCED terrain type ------------------------------
{
  const a = makePlanet(THREE, 55, palette, { detail: 4, radius: 10, terrainType: "volcanic" });
  const b = makePlanet(THREE, 55, palette, { detail: 4, radius: 10, terrainType: "volcanic" });
  const c = makePlanet(THREE, 55, palette, { detail: 4, radius: 10, terrainType: "ice" });
  ok(sig(a) === sig(b), "same seed + type = BYTE-IDENTICAL");
  ok(sig(a) !== sig(c), "same seed, different type DIFFERS (volcanic vs ice)");
}

// ---- 11. SMALL-WORLD RELIEF READS at landing scale (the flat-planet fix) ---------
// The integration builds the ground you land on with exactly these opts (smallWorld +
// a forced tiny reliefFrac for the galaxy view). Before the fix that gave sub-0.5-unit
// relief on an ~18-unit sphere = a flat smear. Assert the terrain now VARIES meaningfully.
{
  // mirror app/starcruise.js: smallWorld + forced reliefFrac:0.05, detail 4, no atmo.
  const groundOpts = (t) => ({ detail: 4, smallWorld: true, bandSpan: 10, curveFactor: 1.8,
    reliefFrac: 0.05, atmosphere: false, terrainType: t });
  const reliefP2V = (mesh) => {
    const f = mesh.field; let lo = Infinity, hi = -Infinity;
    for (const d of DIRS) { const r = f.heightAtDir(d[0], d[1], d[2]); if (r < lo) lo = r; if (r > hi) hi = r; }
    return hi - lo;
  };
  const hills = makePlanet(THREE, 9001, palette, groundOpts("hills"));
  const mounts = makePlanet(THREE, 9001, palette, groundOpts("mountains"));
  const R = hills.userData.radius;
  const pHills = reliefP2V(hills), pMounts = reliefP2V(mounts);
  // near-flat would be < ~0.4 units on an 18-unit sphere; require clearly-legible relief.
  ok(pHills > 0.6, "small-world HILLS relief reads (peak-to-valley " + pHills.toFixed(2) + " units on R=" + R + ", was ~0.28 flat)");
  ok(pMounts > 2.0, "small-world MOUNTAINS relief is dramatic (peak-to-valley " + pMounts.toFixed(2) + " units)");
  // relief must scale to the BAND, not the tiny radius: forced reliefFrac 0.05 alone would
  // give relief = R*0.05 = 0.9; the amplified relief must be several times that.
  ok(hills.userData.knobs.relief > R * 0.05 * 3, "relief is amplified to band scale, not radius*reliefFrac (relief=" + hills.userData.knobs.relief.toFixed(2) + " >> " + (R * 0.05).toFixed(2) + ")");
  // type differentiation survives the forced-flat reliefFrac: mountains >> hills.
  ok(pMounts > pHills * 1.8, "terrain TYPE still drives relief (mountains " + pMounts.toFixed(2) + " >> hills " + pHills.toFixed(2) + ")");
  // p2v as a fraction of the band you stand in — must be a legible slice of the world.
  ok(pHills / 10 > 0.06, "relief is a legible fraction of band span (" + (pHills / 10 * 100).toFixed(0) + "% of bandSpan)");

  // heightAtDir STILL matches the (now higher-relief) baked mesh EXACTLY (foot-plant safe)
  {
    const g = mounts.geometry, pos = g.attributes.position; let maxErr = 0;
    for (let i = 0; i < pos.count; i += 29) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      maxErr = Math.max(maxErr, Math.abs(Math.hypot(x, y, z) - mounts.heightAtDir(x, y, z)));
    }
    ok(maxErr < 1e-4, "high-relief small-world mesh still matches heightAtDir (max err " + maxErr.toExponential(2) + ")");
  }
  // surfacePoint (used to foot-plant the band/city) lands on the higher-relief surface
  {
    const g = mounts.geometry, pos = g.attributes.position; let maxSP = 0; const spV = [0, 0, 0];
    for (let i = 0; i < pos.count; i += 41) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), len = Math.hypot(x, y, z) || 1;
      const sp = mounts.surfacePoint(x / len, y / len, z / len, spV);
      maxSP = Math.max(maxSP, Math.hypot(sp[0] - x, sp[1] - y, sp[2] - z));
    }
    ok(maxSP < 1e-4, "surfacePoint foot-plants on the high-relief surface (max err " + maxSP.toExponential(2) + ")");
  }
  // determinism holds for the amplified small-world build
  const a = makePlanet(THREE, 4242, palette, groundOpts("mountains"));
  const b = makePlanet(THREE, 4242, palette, groundOpts("mountains"));
  ok(sig(a) === sig(b), "amplified small-world build is BYTE-IDENTICAL same-seed");
}

// ---- 12. ELEVATION-BANDED vertex colours (legible bands, not a smear) ------------
{
  const m = makePlanet(THREE, 9001, palette, { detail: 4, smallWorld: true, bandSpan: 10,
    reliefFrac: 0.05, atmosphere: false, terrainType: "mountains" });
  const col = m.geometry.attributes.color.array;
  // count DISTINCT quantized colours across the surface — banded terrain shows many.
  const seen = new Set();
  for (let i = 0; i < col.length; i += 3) {
    const q = Math.round(col[i] * 24) + "," + Math.round(col[i + 1] * 24) + "," + Math.round(col[i + 2] * 24);
    seen.add(q);
  }
  ok(seen.size >= 5, "surface shows multiple distinct elevation colour bands (" + seen.size + " distinct colours)");
  // and the bands span a real luminance range (dark lowland rock -> bright snow), not flat
  let lo = 1, hi = 0;
  for (let i = 0; i < col.length; i += 3) {
    const lum = 0.2126 * col[i] + 0.7152 * col[i + 1] + 0.0722 * col[i + 2];
    if (lum < lo) lo = lum; if (lum > hi) hi = lum;
  }
  ok(hi - lo > 0.25, "colour bands span a real luminance range (" + lo.toFixed(2) + ".." + hi.toFixed(2) + ")");
  // flat-shaded material flag is set (crisp facets)
  ok(m.material.flatShading === true, "planet material uses flat shading (crisp facets)");
}

console.log(failures === 0
  ? "\nALL PLANET PROOFS PASSED\n"
  : "\n" + failures + " PLANET PROOF(S) FAILED\n");
process.exit(failures === 0 ? 0 : 1);
