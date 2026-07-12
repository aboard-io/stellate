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
//   • Genre-tinted — freq/octaves/gain/lacunarity/warp/seaLevel are seeded per
//     planet (overridable via opts); vertex colours are derived from the genre
//     palette {skin,cloth,accent}.

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
const smooth = (t) => t * t * (3 - 2 * t);

// ---- per-genre KNOBS from the seed -------------------------------------------
// Resolve the fBm shape knobs for a planet. Every field is seeded (deterministic)
// but any may be overridden via opts. octaves capped at 6, detail at 5 (mobile).
function resolveKnobs(seed, opts) {
  opts = opts || {};
  const r = mulberry32(((seed | 0) ^ 0x1b873593) >>> 0);
  const k = {
    // spatial base frequency of the continents
    freq: opts.freq != null ? opts.freq : 1.4 + r() * 1.8,          // 1.4 .. 3.2
    // fBm octaves — more = craggier. Capped for mobile.
    octaves: opts.octaves != null ? Math.round(opts.octaves) : 4 + Math.floor(r() * 3), // 4..6
    // per-octave amplitude falloff
    gain: opts.gain != null ? opts.gain : 0.46 + r() * 0.14,        // 0.46 .. 0.60
    // per-octave frequency growth
    lacunarity: opts.lacunarity != null ? opts.lacunarity : 1.9 + r() * 0.5, // 1.9 .. 2.4
    // domain-warp strength (0 = none) — gives twisty, non-grid coastlines
    warp: opts.warp != null ? opts.warp : r() * 0.5,                // 0 .. 0.5
    // normalized sea level in 0..1 elevation; below it the terrain flattens to ocean
    seaLevel: opts.seaLevel != null ? opts.seaLevel : 0.36 + r() * 0.24, // 0.36 .. 0.60
    // base sphere radius (LOCAL space; the caller may scale/position the mesh)
    radius: opts.radius != null ? opts.radius : 1,
    // relief as a fraction of radius — how tall mountains rise above sea
    reliefFrac: opts.reliefFrac != null ? opts.reliefFrac : 0.16,
  };
  k.octaves = clamp(k.octaves, 1, 6) | 0;                           // mobile cap
  k.relief = k.radius * k.reliefFrac;
  return k;
}

// ---- the height FIELD (CPU-samplable, no THREE) -------------------------------
// makeHeightField(seed, opts) -> { heightAt, heightAtDir, elevation01, knobs,
//   radius, seaLevel }. This is the SINGLE source of ground truth: makePlanet
// displaces its vertices with exactly these functions, so anything sampled here
// lands precisely on the baked mesh. Usable WITHOUT THREE (feet/floor/camera).
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
  // elevation01(dir) -> 0..1 raw terrain height for a UNIT direction (fBm ridged-free).
  function elevation01(nx, ny, nz) {
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    warpPoint(nx, ny, nz, _w);
    let amp = 1, f = k.freq, sum = 0, norm = 0;
    for (let o = 0; o < k.octaves; o++) {
      sum += amp * noise3(_w[0] * f, _w[1] * f, _w[2] * f);
      norm += amp; amp *= k.gain; f *= k.lacunarity;
    }
    return (sum / norm) * 0.5 + 0.5;                 // -1..1 -> 0..1
  }

  // heightAtDir(nx,ny,nz) -> SURFACE RADIUS (distance planet-centre -> terrain) in
  // that direction. Ocean (elev < seaLevel) flattens to the base radius; land rises.
  // This is EXACTLY the radius makePlanet gives the vertex pointing that way.
  function heightAtDir(nx, ny, nz) {
    const e = elevation01(nx, ny, nz);
    const land = e > k.seaLevel ? (e - k.seaLevel) : 0;
    return k.radius + land * k.relief;
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

  return {
    heightAt, heightAtDir, elevation01,
    knobs: k, radius: k.radius, seaLevel: k.seaLevel,
    up, tangentX: tX, tangentZ: tZ,
  };
}

// ---- palette -> terrain colour bands -----------------------------------------
// Build a deterministic elevation->RGB ramp from the genre palette {skin,cloth,
// accent} (each {h,s,l}). Sea shades derive from a cool shift; land climbs
// beach -> lowland -> highland -> mountain -> snowy peak. Seeded micro-jitter keeps
// the bands from looking flat without breaking determinism.
function makeColorRamp(THREE, seed, palette, seaLevel) {
  const pal = palette || {};
  const skin = pal.skin || { h: 130, s: 0.5, l: 0.45 };
  const cloth = pal.cloth || { h: 90, s: 0.45, l: 0.5 };
  const accent = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const r = mulberry32(((seed | 0) ^ 0x27d4eb2f) >>> 0);
  const j = (amt) => (r() - 0.5) * amt;               // seeded jitter
  const C = (h, s, l) => new THREE.Color().setHSL(
    ((((h % 360) + 360) % 360) / 360), clamp(s, 0, 1), clamp(l, 0, 1));

  // cool water hue near skin, pulled toward blue-green
  const seaH = lerp(skin.h, 210, 0.7) + j(20);
  const deep = C(seaH, 0.55, 0.20 + j(0.04));
  const shallow = C(seaH + 8, 0.5, 0.36 + j(0.05));
  const beach = C(cloth.h + j(14), 0.4, 0.62 + j(0.05));
  const lowland = C(skin.h + j(16), skin.s * 0.9, clamp(skin.l - 0.06, 0.2, 0.6) + j(0.04));
  const highland = C(cloth.h + j(16), cloth.s * 0.85, clamp(cloth.l - 0.02, 0.2, 0.6) + j(0.04));
  const mountain = C(accent.h + j(18), accent.s * 0.7, clamp(accent.l - 0.08, 0.25, 0.6) + j(0.04));
  const peak = C(accent.h + j(30), 0.18, 0.86 + j(0.05));

  // return a colour for a raw 0..1 elevation, blended within a band for smoothness
  return function colorForElev(e, out) {
    let col;
    if (e < seaLevel * 0.55) col = deep;
    else if (e < seaLevel) col = deep.clone().lerp(shallow, smooth((e - seaLevel * 0.55) / (seaLevel * 0.45 || 1)));
    else {
      const land = (e - seaLevel) / (1 - seaLevel || 1);   // 0..1 above sea
      if (land < 0.06) col = beach.clone().lerp(lowland, smooth(land / 0.06));
      else if (land < 0.4) col = lowland.clone().lerp(highland, smooth((land - 0.06) / 0.34));
      else if (land < 0.72) col = highland.clone().lerp(mountain, smooth((land - 0.4) / 0.32));
      else col = mountain.clone().lerp(peak, smooth((land - 0.72) / 0.28));
    }
    if (out) { out.copy(col); return out; }
    return col;
  };
}

// ---- fresnel atmosphere shell ------------------------------------------------
// A slightly larger back-side sphere with an additive fresnel glow — reads as a
// thin atmosphere rim. No textures, one small ShaderMaterial. cameraPosition is a
// three built-in uniform for ShaderMaterial, so no per-frame uniform update needed.
function makeAtmosphere(THREE, maxRadius, palette, seed) {
  const pal = palette || {};
  const accent = pal.accent || { h: 200, s: 0.7, l: 0.6 };
  const r = mulberry32(((seed | 0) ^ 0x165667b1) >>> 0);
  const col = new THREE.Color().setHSL(
    ((((accent.h % 360) + 360) % 360) / 360), clamp(accent.s * 0.7, 0, 1), clamp(0.55 + (r() - 0.5) * 0.1, 0, 1));
  const geo = new THREE.SphereGeometry(maxRadius * 1.06, 32, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: col },
      uPower: { value: 3.0 },
      uIntensity: { value: 0.9 },
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
//   • a fresnel atmosphere shell added as a child.
//   • the mesh carries .heightAt / .heightAtDir / .field / .userData so the surface
//     agent can plant the band/floor/feet on the ground and the camera can descend.
// opts (all optional): detail, radius, reliefFrac, freq, octaves, gain, lacunarity,
//   warp, seaLevel, up, palette (overrides the palette arg), atmosphere:false.
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
  const ramp = makeColorRamp(THREE, seed, palette, k.seaLevel);
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
    mesh.add(makeAtmosphere(THREE, maxR, palette, seed));
  }

  // expose the CPU height field on the mesh so the surface/band/camera can plant on
  // the ground WITHOUT re-deriving anything. LOCAL space (mesh's own radius R).
  mesh.heightAt = field.heightAt;
  mesh.heightAtDir = field.heightAtDir;
  mesh.field = field;
  mesh.userData = Object.assign(mesh.userData || {}, {
    starcruisePlanet: true,
    seed: seed | 0,
    radius: k.radius,
    maxRadius: maxR,
    seaLevel: k.seaLevel,
    knobs: k,
  });
  return mesh;
}

export default { makePlanet, makeHeightField, mulberry32 };
