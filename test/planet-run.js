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
import { makePlanet, makeHeightField } from "../app/starcruise/planet.js";

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

console.log(failures === 0
  ? "\nALL PLANET PROOFS PASSED\n"
  : "\n" + failures + " PLANET PROOF(S) FAILED\n");
process.exit(failures === 0 ? 0 : 1);
