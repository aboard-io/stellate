// planet.js — DETERMINISTIC PROCEDURAL PLANET for the 🛸 star-cruise 3D mode.
//
// THE STRUCTURAL FIX (see docs/STARCRUISE-LIBS.md): the galaxy star-field and the
// landing surface used to be SEPARATE coordinate regions, so touching down swapped
// scenes = a hard CUT. This module builds ONE real planet body whose ground height
// is analytically CPU-samplable, so the surface/band + alien feet can sit EXACTLY on
// the terrain and the camera can descend onto it continuously (one Object3D scene,
// no swap). The galaxy planet you fly toward and the ground you land on are the
// SAME geometry at two zoom levels.
//
// HOW: an IcosahedronGeometry is displaced along its (radial) vertex normals by
// domain-warped fBm sampled from vendored simplex-noise, normals are recomputed,
// height-band vertex colours are baked in, and a small fresnel atmosphere shell is
// added as a child. The identical fBm field is exposed on the CPU as
// heightAtDir(nx,ny,nz) (surface radius in a direction — matches the mesh vertex
// exactly) and heightAt(x,z) (ground elevation over a local landing patch) so
// feet/floor/camera can plant on the ground without touching the mesh.
//
// TWO NEW CAPABILITIES (this revision):
//   • THE LITTLE-PRINCE SMALL WORLD — opts.smallWorld picks a SMALL radius (relative
//     to the ~10-unit band) so the horizon visibly bends away at band scale: you
//     stand on a little round asteroid, not a big sphere faking a flat floor. Clean
//     surface-placement helpers surfacePoint(dir)/upAt(dir) (+ heightAt) let the
//     integration foot-plant the band + cities ON the curved sphere. These accept a
//     Vector3 | [x,y,z] | {x,y,z} | (nx,ny,nz) and return plain arrays (THREE-free).
//   • A TERRAIN-TYPE SYSTEM — nine distinct world archetypes (mountains, seas,
//     desert, craters, canyons, ice, hills, archipelago, volcanic) chosen per genre
//     from the seed (or forced via opts.terrainType). Each pins its own fBm knobs +
//     shaping transform + colour ramp + atmosphere, so two genres produce OBVIOUSLY
//     different worlds (type + palette + relief). All shaping flows through
//     elevation01, so the baked mesh and the CPU height field stay pixel-consistent.
//
// LAWS honoured here:
//   • DETERMINISTIC — every draw flows through mulberry32(seed); NO Date.now /
//     Math.random. Two builds of one seed are byte-identical; different seeds differ.
//     v4 simplex-noise deliberately dropped its built-in PRNG so
//     createNoise3D(mulberry32(seed)) is byte-stable against OUR seed.
//   • MOBILE-LIGHT — icosphere subdivision is capped at 5 and octaves at 6; the
//     geometry is BAKED ONCE at call time to a static BufferGeometry (never per
//     frame). Call makePlanet at load, reuse the mesh.
//   • OFFLINE / CSP — imports simplex-noise from vendor/ (NO CDN), and is itself
//     only reachable behind the star-cruise mode's lazy import().
//   • Genre-tinted — the terrain type + freq/octaves/gain/lacunarity/warp/seaLevel
//     are seeded per planet (overridable via opts); vertex colours derive from the
//     type ramp tinted by the genre palette {skin,cloth,accent}.

import { createNoise3D } from "../../vendor/simplex-noise/simplex-noise.js";

// mulberry32 — tiny seeded PRNG. Same seed -> same stream. (Kept LOCAL so this
// module carries no static dep on traits.js; identical implementation.)
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

// ---- THE LITTLE-PRINCE SMALL WORLD -------------------------------------------
// A ~10-unit band should read as standing on a LITTLE round planet: the curvature
// must be visible across the band. For a planet radius R and a band half-span S,
// the horizon "drop" over that half-span is R - sqrt(R² - S²). radiusFactor 1.8
// (R = 18 for a 10-unit band) drops ~0.7 units over 5 units — an obvious bend —
// while still reading as a coherent globe (not a marble you fall off).
export const SMALL_WORLD = { bandSpan: 10, radiusFactor: 1.8 };
export function smallWorldRadius(bandSpan, factor) {
  bandSpan = bandSpan != null ? bandSpan : SMALL_WORLD.bandSpan;
  factor = factor != null ? factor : SMALL_WORLD.radiusFactor;
  return bandSpan * factor;
}
// how far the surface falls away across a half-span (curvature legibility metric).
export function curvatureDrop(radius, halfSpan) {
  const inside = radius * radius - halfSpan * halfSpan;
  return radius - (inside > 0 ? Math.sqrt(inside) : 0);
}

// ---- THE TERRAIN-TYPE SYSTEM -------------------------------------------------
// Nine archetypes. Each entry pins:
//   knobs(r)      -> partial fBm knob overrides (r = seeded PRNG for per-planet variety)
//   shape(e,...)  -> transform raw 0..1 fBm elevation into the type's relief signature
//   colorStops(c) -> elevation->colour control points (tinted by the genre palette)
//   atmo          -> atmosphere shell {h,s,l,intensity,scale}
// shape() runs INSIDE elevation01 so the baked mesh + CPU field stay identical.
const TERRAIN_TYPES = {
  // ROLLING HILLS — gentle greens, a little water, low relief.
  hills: {
    knobs: (r) => ({ freq: 1.0 + r() * 0.6, octaves: 4, gain: 0.5, lacunarity: 2.0,
      warp: 0.15 + r() * 0.15, seaLevel: 0.40 + r() * 0.06, reliefFrac: 0.08, ridge: 0 }),
    shape: (e) => 0.5 + (e - 0.5) * 0.55,
    atmo: { h: 205, s: 0.5, l: 0.6, intensity: 0.8, scale: 1.06 },
    colorStops: (c) => [
      { e: 0.00, h: 210, s: 0.55, l: 0.20 },
      { e: 0.30, h: 205, s: 0.50, l: 0.34 },
      { e: 0.40, h: 55, s: 0.40, l: 0.60 },
      { e: 0.45, h: 110 + c.hs, s: 0.50, l: 0.42 },
      { e: 0.65, h: 100 + c.hs, s: 0.45, l: 0.34 },
      { e: 0.85, h: 90 + c.hs, s: 0.35, l: 0.30 },
      { e: 1.00, h: 80, s: 0.10, l: 0.82 },
    ],
  },
  // MOUNTAINS — ridged, high relief, bare rock climbing to snow.
  mountains: {
    knobs: (r) => ({ freq: 1.6 + r() * 0.8, octaves: 6, gain: 0.55, lacunarity: 2.1,
      warp: 0.20 + r() * 0.20, seaLevel: 0.44 + r() * 0.06, reliefFrac: 0.26, ridge: 0.7 }),
    shape: (e) => clamp(0.5 + (e - 0.5) * 1.25, 0, 1),
    atmo: { h: 210, s: 0.4, l: 0.7, intensity: 0.7, scale: 1.05 },
    colorStops: (c) => [
      { e: 0.00, h: 210, s: 0.50, l: 0.18 },
      { e: 0.40, h: 200, s: 0.45, l: 0.30 },
      { e: 0.46, h: 40 + c.hs, s: 0.35, l: 0.42 },
      { e: 0.62, h: 30 + c.hs, s: 0.25, l: 0.36 },
      { e: 0.78, h: 25, s: 0.15, l: 0.45 },
      { e: 0.90, h: 0, s: 0.00, l: 0.92 },
      { e: 1.00, h: 0, s: 0.00, l: 1.00 },
    ],
  },
  // SEAS / OCEAN WORLD — mostly water, a few landmasses.
  seas: {
    knobs: (r) => ({ freq: 1.3 + r() * 0.6, octaves: 5, gain: 0.5, lacunarity: 2.0,
      warp: 0.25, seaLevel: 0.60 + r() * 0.06, reliefFrac: 0.12, ridge: 0 }),
    shape: (e) => e,
    atmo: { h: 210, s: 0.6, l: 0.6, intensity: 1.0, scale: 1.08 },
    colorStops: (c) => [
      { e: 0.00, h: 220, s: 0.60, l: 0.14 },
      { e: 0.35, h: 210, s: 0.60, l: 0.24 },
      { e: 0.55, h: 200, s: 0.55, l: 0.40 },
      { e: 0.60, h: 190, s: 0.40, l: 0.55 },
      { e: 0.64, h: 50, s: 0.40, l: 0.62 },
      { e: 0.75, h: 120 + c.hs, s: 0.40, l: 0.40 },
      { e: 1.00, h: 110, s: 0.30, l: 0.55 },
    ],
  },
  // ARCHIPELAGO — high-frequency scatter of small tropical islands + turquoise shoals.
  archipelago: {
    knobs: (r) => ({ freq: 2.4 + r() * 1.0, octaves: 5, gain: 0.5, lacunarity: 2.2,
      warp: 0.30, seaLevel: 0.58 + r() * 0.05, reliefFrac: 0.10, ridge: 0 }),
    shape: (e) => e,
    atmo: { h: 190, s: 0.6, l: 0.6, intensity: 1.0, scale: 1.08 },
    colorStops: (c) => [
      { e: 0.00, h: 200, s: 0.70, l: 0.20 },
      { e: 0.45, h: 185, s: 0.60, l: 0.42 },
      { e: 0.56, h: 175, s: 0.50, l: 0.58 },
      { e: 0.60, h: 48, s: 0.50, l: 0.66 },
      { e: 0.66, h: 130 + c.hs, s: 0.55, l: 0.42 },
      { e: 0.85, h: 120 + c.hs, s: 0.50, l: 0.34 },
      { e: 1.00, h: 110, s: 0.35, l: 0.50 },
    ],
  },
  // DESERT / DUNES — dry, warm, rippled; no water. Wind-ridged dune crests.
  desert: {
    knobs: (r) => ({ freq: 1.2 + r() * 0.6, octaves: 4, gain: 0.5, lacunarity: 2.0,
      warp: 0.20, seaLevel: 0.12, reliefFrac: 0.09, ridge: 0 }),
    shape: (e, nx, ny, nz, noise) => {
      const base = 0.45 + (e - 0.5) * 0.5;
      const ang = noise(nx * 2.0, ny * 2.0, nz * 2.0);      // slow dune-field direction
      const dune = 0.035 * Math.sin((nx + nz) * 22 + ang * 3.0);
      return clamp(base + dune, 0, 1);
    },
    atmo: { h: 35, s: 0.5, l: 0.6, intensity: 0.5, scale: 1.04 },
    colorStops: (c) => [
      { e: 0.00, h: 20, s: 0.50, l: 0.22 },
      { e: 0.30, h: 28 + c.hs * 0.3, s: 0.55, l: 0.40 },
      { e: 0.50, h: 34 + c.hs * 0.3, s: 0.60, l: 0.55 },
      { e: 0.70, h: 38, s: 0.55, l: 0.66 },
      { e: 0.85, h: 42, s: 0.45, l: 0.75 },
      { e: 1.00, h: 45, s: 0.30, l: 0.85 },
    ],
  },
  // CANYONS / MESAS — terraced plateaus banded in red strata, carved by channels.
  canyons: {
    knobs: (r) => ({ freq: 1.5 + r() * 0.5, octaves: 5, gain: 0.5, lacunarity: 2.0,
      warp: 0.15, seaLevel: 0.15, reliefFrac: 0.18, ridge: 0 }),
    shape: (e, nx, ny, nz, noise) => {
      const steps = 6, t = e * steps, f = Math.floor(t), fr = t - f;
      const terr = (f + smooth((fr - 0.35) / 0.30)) / steps;  // smooth plateau edges
      let out = lerp(e, terr, 0.75);
      const cn = noise(nx * 3.0 + 9.1, ny * 3.0 - 2.2, nz * 3.0 + 5.5);
      const a = Math.abs(cn);
      if (a < 0.10) out -= 0.28 * smooth(1 - a / 0.10);       // winding channel
      return clamp(out, 0, 1);
    },
    atmo: { h: 24, s: 0.5, l: 0.55, intensity: 0.55, scale: 1.05 },
    colorStops: (c) => [
      { e: 0.00, h: 12, s: 0.55, l: 0.20 },
      { e: 0.25, h: 16, s: 0.60, l: 0.34 },
      { e: 0.40, h: 22, s: 0.60, l: 0.44 },
      { e: 0.55, h: 14, s: 0.55, l: 0.38 },
      { e: 0.70, h: 26, s: 0.55, l: 0.52 },
      { e: 0.85, h: 32, s: 0.40, l: 0.66 },
      { e: 1.00, h: 36, s: 0.30, l: 0.78 },
    ],
  },
  // CRATERS — pocked grey regolith, bowls with raised rims. Airless.
  craters: {
    knobs: (r) => ({ freq: 1.0 + r() * 0.4, octaves: 3, gain: 0.5, lacunarity: 2.0,
      warp: 0.05, seaLevel: 0.10, reliefFrac: 0.11, ridge: 0 }),
    shape: (e, nx, ny, nz, noise) => {
      let out = 0.42 + (e - 0.5) * 0.22;
      const fs = [[6.0, 0.0], [9.0, 3.3]];
      for (let i = 0; i < fs.length; i++) {
        const f = fs[i][0], off = fs[i][1];
        const cn = noise(nx * f + off, ny * f - off, nz * f + off * 0.5);
        const a = Math.abs(cn);
        if (a < 0.14) out -= 0.16 * smooth(1 - a / 0.14);            // bowl
        else if (a < 0.20) out += 0.06 * smooth(1 - (a - 0.14) / 0.06); // rim
      }
      return clamp(out, 0, 1);
    },
    atmo: { h: 220, s: 0.1, l: 0.5, intensity: 0.22, scale: 1.03 },
    colorStops: (c) => [
      { e: 0.00, h: 230, s: 0.08, l: 0.16 },
      { e: 0.35, h: 40, s: 0.05, l: 0.30 },
      { e: 0.50, h: 40, s: 0.04, l: 0.44 },
      { e: 0.65, h: 40, s: 0.03, l: 0.55 },
      { e: 0.85, h: 40, s: 0.02, l: 0.66 },
      { e: 1.00, h: 40, s: 0.02, l: 0.75 },
    ],
  },
  // ICE — white/pale-blue shelves, crevasse-cracked, low relief, cold haze.
  ice: {
    knobs: (r) => ({ freq: 1.2 + r() * 0.5, octaves: 5, gain: 0.5, lacunarity: 2.0,
      warp: 0.20, seaLevel: 0.30 + r() * 0.08, reliefFrac: 0.10, ridge: 0 }),
    shape: (e, nx, ny, nz, noise) => {
      let out = 0.5 + (e - 0.5) * 0.6;
      const cr = 1 - Math.abs(noise(nx * 8 + 1.2, ny * 8 + 4.5, nz * 8 - 3.1));
      out -= 0.05 * smooth((cr - 0.85) / 0.15);              // thin crevasse cracks
      return clamp(out, 0, 1);
    },
    atmo: { h: 195, s: 0.4, l: 0.75, intensity: 0.7, scale: 1.06 },
    colorStops: (c) => [
      { e: 0.00, h: 210, s: 0.50, l: 0.30 },
      { e: 0.35, h: 200, s: 0.40, l: 0.55 },
      { e: 0.50, h: 195, s: 0.25, l: 0.75 },
      { e: 0.70, h: 190, s: 0.15, l: 0.86 },
      { e: 0.90, h: 0, s: 0.00, l: 0.96 },
      { e: 1.00, h: 0, s: 0.00, l: 1.00 },
    ],
  },
  // VOLCANIC — a ridged cone with a summit CALDERA at the landing pole; black basalt
  // and lava glow. Uses the +Y (landing 'up') pole for the volcano so you land near it.
  volcanic: {
    knobs: (r) => ({ freq: 1.6 + r() * 0.6, octaves: 6, gain: 0.55, lacunarity: 2.1,
      warp: 0.15, seaLevel: 0.35, reliefFrac: 0.22, ridge: 0.6 }),
    shape: (e, nx, ny, nz) => {
      const len = Math.hypot(nx, ny, nz) || 1, uy = ny / len;
      let out = 0.4 + (e - 0.5) * 0.7;
      out += 0.28 * smooth((uy - 0.15) / 0.70);              // cone toward +Y
      if (uy > 0.72) out -= 0.5 * smooth((uy - 0.72) / 0.28); // summit caldera pit
      return clamp(out, 0, 1);
    },
    atmo: { h: 14, s: 0.8, l: 0.5, intensity: 0.9, scale: 1.06 },
    colorStops: (c) => [
      { e: 0.00, h: 12, s: 0.90, l: 0.42 },
      { e: 0.20, h: 16, s: 0.85, l: 0.34 },
      { e: 0.35, h: 20, s: 0.60, l: 0.20 },
      { e: 0.50, h: 0, s: 0.00, l: 0.10 },
      { e: 0.72, h: 0, s: 0.00, l: 0.16 },
      { e: 0.88, h: 0, s: 0.02, l: 0.28 },
      { e: 1.00, h: 30, s: 0.10, l: 0.40 },
    ],
  },
};

// ordered name list (stable) — the selection index + the public catalogue.
export const TERRAIN_TYPE_NAMES = Object.keys(TERRAIN_TYPES);
export { TERRAIN_TYPES };

// chooseTerrainType(seed) — deterministic per-genre pick from a DEDICATED PRNG
// stream (so it doesn't perturb the shape-knob stream). opts.terrainType overrides.
export function chooseTerrainType(seed) {
  const r = mulberry32(((seed | 0) ^ 0x9e3779b9) >>> 0);
  return TERRAIN_TYPE_NAMES[Math.floor(r() * TERRAIN_TYPE_NAMES.length) % TERRAIN_TYPE_NAMES.length];
}

// ---- per-genre KNOBS from the seed -------------------------------------------
// Resolve the fBm shape knobs for a planet. Every field is seeded (deterministic)
// but any may be overridden via opts. octaves capped at 6, detail at 5 (mobile).
function resolveKnobs(seed, opts) {
  opts = opts || {};
  const typeName = (opts.terrainType && TERRAIN_TYPES[opts.terrainType])
    ? opts.terrainType : chooseTerrainType(seed);
  const def = TERRAIN_TYPES[typeName];
  const r = mulberry32(((seed | 0) ^ 0x1b873593) >>> 0);

  // generic seeded base (used where the type pins nothing)
  const k = {
    freq: 1.4 + r() * 1.8,          // 1.4 .. 3.2
    octaves: 4 + Math.floor(r() * 3), // 4 .. 6
    gain: 0.46 + r() * 0.14,        // 0.46 .. 0.60
    lacunarity: 1.9 + r() * 0.5,    // 1.9 .. 2.4
    warp: r() * 0.5,                // 0 .. 0.5
    seaLevel: 0.36 + r() * 0.24,    // 0.36 .. 0.60
    ridge: 0,                       // ridged-fBm blend (mountains/volcanic)
    radius: 1,                      // LOCAL base radius (caller may scale/position)
    reliefFrac: 0.16,               // mountain height as a fraction of radius
  };
  // apply the terrain-type overrides (seeded for per-planet variety WITHIN a type)
  const typed = def.knobs(mulberry32(((seed | 0) ^ 0x85ebca6b) >>> 0));
  Object.assign(k, typed);

  // explicit opts win over everything (backward-compatible knob overrides)
  for (const key of ["freq", "octaves", "gain", "lacunarity", "warp",
    "seaLevel", "ridge", "radius", "reliefFrac"]) {
    if (opts[key] != null) k[key] = opts[key];
  }

  // LITTLE-PRINCE small world: if no explicit radius, pick a small curvature-legible
  // one so a ~bandSpan band reads as standing on a little round planet.
  if (opts.radius == null && opts.smallWorld) {
    k.radius = smallWorldRadius(opts.bandSpan, opts.curveFactor);
  }

  k.octaves = clamp(Math.round(k.octaves), 1, 6) | 0;         // mobile cap
  k.relief = k.radius * k.reliefFrac;
  k.type = typeName;
  k.shape = def.shape;
  k.atmo = def.atmo;
  k.colorStops = def.colorStops;
  return k;
}

// ---- the height FIELD (CPU-samplable, no THREE) -------------------------------
// makeHeightField(seed, opts) -> { heightAt, heightAtDir, elevation01, surfacePoint,
//   upAt, normalAt, knobs, radius, seaLevel, type, up, tangentX, tangentZ }.
// This is the SINGLE source of ground truth: makePlanet displaces its vertices with
// exactly these functions, so anything sampled here lands precisely on the baked
// mesh. Usable WITHOUT THREE (feet/floor/camera/city placement).
export function makeHeightField(seed, opts) {
  const k = resolveKnobs(seed, opts);
  const noise3 = createNoise3D(mulberry32((seed | 0) >>> 0));
  const wf = k.freq * 0.5;                          // warp field frequency

  // domain warp: nudge the sample point by a low-freq noise vector so continents
  // curl instead of running on a grid. Deterministic (same noise instance).
  function warpPoint(nx, ny, nz, out) {
    if (k.warp <= 0) { out[0] = nx; out[1] = ny; out[2] = nz; return out; }
    const wx = noise3(nx * wf + 11.3, ny * wf + 7.1, nz * wf + 3.7);
    const wy = noise3(nx * wf - 5.2, ny * wf + 2.9, nz * wf - 8.4);
    const wz = noise3(nx * wf + 1.7, ny * wf - 6.6, nz * wf + 4.2);
    out[0] = nx + k.warp * wx; out[1] = ny + k.warp * wy; out[2] = nz + k.warp * wz;
    return out;
  }

  const _w = [0, 0, 0];
  // elevation01(dir) -> 0..1 terrain height for a UNIT direction. Raw domain-warped
  // fBm (optionally RIDGED) then run through the terrain type's shaping transform so
  // mountains/craters/canyons/volcanoes get their distinct relief signature.
  function elevation01(nx, ny, nz) {
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    warpPoint(nx, ny, nz, _w);
    let amp = 1, f = k.freq, sum = 0, norm = 0;
    for (let o = 0; o < k.octaves; o++) {
      let nv = noise3(_w[0] * f, _w[1] * f, _w[2] * f);
      if (k.ridge > 0) {                             // ridged-fBm blend, keeps -1..1
        const rg = (1 - Math.abs(nv)) * 2 - 1;
        nv = nv + (rg - nv) * k.ridge;
      }
      sum += amp * nv; norm += amp; amp *= k.gain; f *= k.lacunarity;
    }
    let e = (sum / norm) * 0.5 + 0.5;                // -1..1 -> 0..1
    e = k.shape(e, nx, ny, nz, noise3);              // terrain-type shaping
    return clamp(e, 0, 1);
  }

  // heightAtDir(nx,ny,nz) -> SURFACE RADIUS (distance planet-centre -> terrain) in
  // that direction. Ocean (elev < seaLevel) flattens to the base radius; land rises.
  // This is EXACTLY the radius makePlanet gives the vertex pointing that way.
  function heightAtDir(nx, ny, nz) {
    const e = elevation01(nx, ny, nz);
    const land = e > k.seaLevel ? (e - k.seaLevel) : 0;
    return k.radius + land * k.relief;
  }

  // coerce a direction argument to [x,y,z]: accepts (nx,ny,nz) OR a single
  // Vector3 | [x,y,z] | {x,y,z} (matches the backdrop's surface contract).
  function coerceDir(a, b, c) {
    if (a != null && typeof a === "object") {
      if (a.isVector3) return [a.x, a.y, a.z];
      if (Array.isArray(a)) return [a[0], a[1], a[2]];
      return [a.x || 0, a.y || 0, a.z || 0];
    }
    return [a, b, c];
  }

  // surfacePoint(dir) -> world/local point ON the terrain surface for a direction.
  // = normalize(dir) * heightAtDir(dir) — EXACTLY the baked mesh vertex in that dir.
  function surfacePoint(a, b, c, out) {
    const d = coerceDir(a, b, c);
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    const ux = d[0] / len, uy = d[1] / len, uz = d[2] / len;
    const r = heightAtDir(ux, uy, uz);
    // out is the 4th positional arg only in the (nx,ny,nz,out) form; in the
    // single-vector form there is no out slot, so allocate fresh.
    if (typeof a === "object") out = [0, 0, 0]; else out = out || [0, 0, 0];
    out[0] = ux * r; out[1] = uy * r; out[2] = uz * r;
    return out;
  }

  // upAt(dir) -> OUTWARD unit normal (radial gravity-up) for standing/orienting.
  function upAt(a, b, c, out) {
    const d = coerceDir(a, b, c);
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    out = out || [0, 0, 0];
    out[0] = d[0] / len; out[1] = d[1] / len; out[2] = d[2] / len;
    return out;
  }

  // normalAt(dir) -> GEOMETRIC surface normal (radial tilted by local terrain slope),
  // via finite differences of heightAtDir. For shading/tilt; upAt is the gravity up.
  function normalAt(a, b, c, out) {
    const d = coerceDir(a, b, c);
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    const u = [d[0] / len, d[1] / len, d[2] / len];
    const ref = Math.abs(u[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    const t1 = normalize3(cross3(ref, u));
    const t2 = cross3(u, t1);
    const eps = 0.01;
    const sample = (t, s) => heightAtDir(u[0] + t[0] * s, u[1] + t[1] * s, u[2] + t[2] * s);
    const dh1 = (sample(t1, eps) - sample(t1, -eps)) / (2 * eps);
    const dh2 = (sample(t2, eps) - sample(t2, -eps)) / (2 * eps);
    const r0 = heightAtDir(u[0], u[1], u[2]) || 1;
    // surface = u * r(u); its normal ≈ r*u - (dr along tangents) projected out
    let nx = u[0] * r0 - t1[0] * dh1 - t2[0] * dh2;
    let ny = u[1] * r0 - t1[1] * dh1 - t2[1] * dh2;
    let nz = u[2] * r0 - t1[2] * dh1 - t2[2] * dh2;
    const nl = Math.hypot(nx, ny, nz) || 1;
    out = out || [0, 0, 0];
    out[0] = nx / nl; out[1] = ny / nl; out[2] = nz / nl;
    return out;
  }

  // LOCAL landing frame: (x,z) are horizontal offsets on the tangent plane at the
  // landing 'up' direction (default +Y). heightAt maps them onto the sphere and
  // returns the ground ELEVATION along up (world Y when up=+Y) — so a band member
  // at (x,z) sets foot.y = heightAt(x,z) and stands exactly on the baked terrain.
  const up = normalize3(opts && opts.up ? opts.up : [0, 1, 0]);
  const ref = Math.abs(up[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  const tX = normalize3(cross3(ref, up));
  const tZ = cross3(up, tX);                          // right-handed tangent basis
  function heightAt(x, z) {
    // point on the tangent plane at radius R, projected back onto the sphere
    const px = up[0] * k.radius + tX[0] * x + tZ[0] * z;
    const py = up[1] * k.radius + tX[1] * x + tZ[1] * z;
    const pz = up[2] * k.radius + tX[2] * x + tZ[2] * z;
    const r = heightAtDir(px, py, pz);
    const len = Math.hypot(px, py, pz) || 1;
    // surface point = dir * r; elevation along up = dot(surface, up)
    return (px / len) * r * up[0] + (py / len) * r * up[1] + (pz / len) * r * up[2];
  }

  // dirForGround(x,z) -> the UNIT direction a landing-frame ground point maps to
  // (handy for the integration to feed surfacePoint/upAt from flat coords).
  function dirForGround(x, z, out) {
    const px = up[0] * k.radius + tX[0] * x + tZ[0] * z;
    const py = up[1] * k.radius + tX[1] * x + tZ[1] * z;
    const pz = up[2] * k.radius + tX[2] * x + tZ[2] * z;
    const len = Math.hypot(px, py, pz) || 1;
    out = out || [0, 0, 0];
    out[0] = px / len; out[1] = py / len; out[2] = pz / len;
    return out;
  }

  return {
    heightAt, heightAtDir, elevation01,
    surfacePoint, upAt, normalAt, dirForGround,
    knobs: k, radius: k.radius, seaLevel: k.seaLevel, type: k.type,
    up, tangentX: tX, tangentZ: tZ,
  };
}

// ---- palette -> terrain colour ramp ------------------------------------------
// Build a deterministic elevation->RGB ramp from the terrain type's colour stops,
// hue-shifted by the genre palette {skin,cloth,accent} so type dominates the
// character while genre still tints it. Seeded micro-jitter keeps the bands lively
// without breaking determinism. colorForElev(e, out) blends across the stops.
function makeColorRamp(THREE, seed, palette, k) {
  const pal = palette || {};
  const skin = pal.skin || { h: 130, s: 0.5, l: 0.45 };
  const accent = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const r = mulberry32(((seed | 0) ^ 0x27d4eb2f) >>> 0);
  const j = (amt) => (r() - 0.5) * amt;               // seeded jitter
  // genre hue tint applied to the type's land hues (kept modest so type reads).
  const ctx = { hs: (skin.h - 120) * 0.3, skin, accent, j };

  const spec = (k.colorStops || TERRAIN_TYPES.hills.colorStops)(ctx);
  const stops = spec
    .map((s) => ({
      e: s.e,
      col: new THREE.Color().setHSL(
        (((((s.h + j(4)) % 360) + 360) % 360) / 360),
        clamp(s.s, 0, 1), clamp(s.l + j(0.03), 0, 1)),
    }))
    .sort((a, b) => a.e - b.e);

  // return a colour for a raw 0..1 elevation, smoothly blended across the stops.
  return function colorForElev(e, out) {
    let col;
    if (e <= stops[0].e) col = stops[0].col;
    else if (e >= stops[stops.length - 1].e) col = stops[stops.length - 1].col;
    else {
      let i = 0;
      while (i < stops.length - 1 && e > stops[i + 1].e) i++;
      const a = stops[i], b = stops[i + 1];
      const t = smooth((e - a.e) / ((b.e - a.e) || 1));
      col = a.col.clone().lerp(b.col, t);
    }
    if (out) { out.copy(col); return out; }
    return col.isColor ? col.clone() : col;
  };
}

// ---- fresnel atmosphere shell ------------------------------------------------
// A slightly larger back-side sphere with an additive fresnel glow — reads as a
// thin atmosphere rim, coloured + sized per terrain type (thick blue for oceans,
// near-vacuum grey for craters, red for volcanic...). No textures, one small
// ShaderMaterial. cameraPosition is a three built-in uniform for ShaderMaterial.
function makeAtmosphere(THREE, maxRadius, atmo, seed) {
  atmo = atmo || { h: 200, s: 0.7, l: 0.6, intensity: 0.9, scale: 1.06 };
  const r = mulberry32(((seed | 0) ^ 0x165667b1) >>> 0);
  const col = new THREE.Color().setHSL(
    ((((atmo.h % 360) + 360) % 360) / 360),
    clamp(atmo.s, 0, 1), clamp(atmo.l + (r() - 0.5) * 0.08, 0, 1));
  const geo = new THREE.SphereGeometry(maxRadius * (atmo.scale || 1.06), 32, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: col },
      uPower: { value: 3.0 },
      uIntensity: { value: atmo.intensity != null ? atmo.intensity : 0.9 },
    },
    vertexShader: [
      "varying vec3 vN;",
      "varying vec3 vView;",
      "void main() {",
      "  vec4 wp = modelMatrix * vec4(position, 1.0);",
      "  vN = normalize(mat3(modelMatrix) * normal);",
      "  vView = normalize(cameraPosition - wp.xyz);",
      "  gl_Position = projectionMatrix * viewMatrix * wp;",
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uColor;",
      "uniform float uPower;",
      "uniform float uIntensity;",
      "varying vec3 vN;",
      "varying vec3 vView;",
      "void main() {",
      "  float f = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), uPower);",
      "  gl_FragColor = vec4(uColor, f * uIntensity);",
      "}",
    ].join("\n"),
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(geo, mat);
  shell.name = "atmosphere";
  return shell;
}

// small vec3 helpers (no THREE dependency — used by the CPU height field)
function normalize3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// ---- THE PLANET --------------------------------------------------------------
// makePlanet(THREE, seed, palette, opts) -> THREE.Mesh
//   • IcosahedronGeometry(radius, detail<=5) displaced along radial normals by the
//     makeHeightField fBm; normals recomputed; height-band vertex colours baked.
//   • a fresnel atmosphere shell (per terrain type) added as a child.
//   • the mesh carries .heightAt / .heightAtDir / .surfacePoint / .upAt / .field /
//     .userData so the surface agent can plant the band/floor/feet on the ground.
// opts (all optional): detail, radius, reliefFrac, freq, octaves, gain, lacunarity,
//   warp, ridge, seaLevel, up, terrainType, smallWorld, bandSpan, curveFactor,
//   palette (overrides the palette arg), atmosphere:false.
// Call ONCE at load — the geometry is static and baked here.
export function makePlanet(THREE, seed, palette, opts) {
  opts = opts || {};
  if (opts.palette) palette = opts.palette;
  const field = makeHeightField(seed, opts);
  const k = field.knobs;
  const detail = clamp(opts.detail != null ? Math.round(opts.detail) : 4, 0, 5) | 0;

  // base icosphere at unit radius; we set the true radius via displacement so the
  // per-vertex direction (= normalized position) is a clean unit normal to sample.
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const ramp = makeColorRamp(THREE, seed, palette, k);
  const tmp = new THREE.Color();
  let maxR = k.radius;

  for (let i = 0; i < n; i++) {
    const dx = pos.getX(i), dy = pos.getY(i), dz = pos.getZ(i);   // unit direction
    const e = field.elevation01(dx, dy, dz);
    const land = e > k.seaLevel ? (e - k.seaLevel) : 0;
    const r = k.radius + land * k.relief;                        // == heightAtDir(dir)
    pos.setXYZ(i, dx * r, dy * r, dz * r);
    if (r > maxR) maxR = r;
    ramp(e, tmp);
    const b = i * 3; colors[b] = tmp.r; colors[b + 1] = tmp.g; colors[b + 2] = tmp.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();                                    // re-derive after displacement
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "planet";

  if (opts.atmosphere !== false) {
    mesh.add(makeAtmosphere(THREE, maxR, k.atmo, seed));
  }

  // expose the CPU height field on the mesh so the surface/band/camera can plant on
  // the ground WITHOUT re-deriving anything. LOCAL space (mesh's own radius R).
  mesh.heightAt = field.heightAt;
  mesh.heightAtDir = field.heightAtDir;
  mesh.surfacePoint = field.surfacePoint;
  mesh.upAt = field.upAt;
  mesh.field = field;
  mesh.userData = Object.assign(mesh.userData || {}, {
    starcruisePlanet: true,
    seed: seed | 0,
    terrainType: k.type,
    radius: k.radius,
    maxRadius: maxR,
    seaLevel: k.seaLevel,
    smallWorld: !!opts.smallWorld,
    knobs: k,
  });
  return mesh;
}

export default {
  makePlanet, makeHeightField, mulberry32,
  chooseTerrainType, smallWorldRadius, curvatureDrop,
  SMALL_WORLD, TERRAIN_TYPES, TERRAIN_TYPE_NAMES,
};
