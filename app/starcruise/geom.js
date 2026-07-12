// geom.js — SHARED, hand-rolled procedural-geometry + material library for the
// star-cruise band (app/starcruise/*). Three.js r160 CORE ONLY: no examples/addons.
// Everything here is deterministic (never Date.now / Math.random — any randomness
// must be a seeded PRNG passed IN) and MOBILE-LIGHT (segments / iterations capped,
// ONE shared env map, geometry reused). It hands the alien/backdrop rigs richer
// primitives than raw boxes so bodies, instruments and cities read as organic:
//
//   superquadric(THREE,{ex,ey,segs})           — a superellipsoid BufferGeometry that
//                                                 morphs box<->sphere<->octahedron<->
//                                                 cylinder<->pinched-star by 2 exponents
//   tube(THREE,points,{radius,segs,taper,...})  — a CatmullRom-swept TubeGeometry (with
//                                                 optional linear taper) for tentacles,
//                                                 pincers, spires, curved profiles
//   lathe(THREE,profile,{segs})                 — a surface of revolution (LatheGeometry)
//   fuse(THREE,blobs,{detail,scale})            — a cheap metaball-ish fused blob
//   fabrik(points,target,{iters,tol})           — a tiny deterministic FABRIK IK solver
//                                                 (many-jointed reach/curl; caps iters)
//   pbrMaterial(THREE,{...})                    — MeshStandardMaterial (metalness/roughness)
//                                                 + the ONE shared procedural env map,
//                                                 for the 'pbr' renderStyle (real chrome/
//                                                 glass) — reused, never global
//   sharedEnvMap(THREE) / buildPMREMEnv(...)    — the ONE lazily-built reflection env
//   normalTexture / roughnessTexture(THREE,...) — small procedural PBR CanvasTextures
//
// All exponents / radii / taper values are meant to be FED FROM THE GENRE VECTOR (see
// traits.js) so forms vary organically per genre + per alien seed.

// ---- small signed-power helpers for the superquadric ---------------------------
function spow(v, p) { const s = v < 0 ? -1 : 1; return s * Math.pow(Math.abs(v), p); }
const _clampSeg = (n, lo, hi) => { n = Math.round(n || 0); return n < lo ? lo : n > hi ? hi : n; };
const _clampNum = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// SUPERQUADRIC (superellipsoid). ex = east-west squareness, ey = north-south
// squareness. e≈0.15 -> box, e≈1 -> sphere, e≈2 -> octahedron / pinched star,
// (ex small, ey≈1) -> cylinder-ish. Returns a UV-mapped BufferGeometry with
// vertex normals. segs is capped for mobile (default 16, max 32).
export function superquadric(THREE, opts) {
  opts = opts || {};
  const ex = _clampNum(opts.ex != null ? opts.ex : 1, 0.1, 3);   // longitude exponent
  const ey = _clampNum(opts.ey != null ? opts.ey : 1, 0.1, 3);   // latitude exponent
  const segs = _clampSeg(opts.segs != null ? opts.segs : 16, 4, 32);
  const rx = opts.rx != null ? opts.rx : 1, ry = opts.ry != null ? opts.ry : 1, rz = opts.rz != null ? opts.rz : 1;
  const uSteps = segs, vSteps = segs;   // v = latitude (-pi/2..pi/2), u = longitude (-pi..pi)
  const pos = [], uv = [], idx = [];
  for (let iv = 0; iv <= vSteps; iv++) {
    const v = -Math.PI / 2 + (iv / vSteps) * Math.PI;
    const cv = spow(Math.cos(v), ey), sv = spow(Math.sin(v), ey);
    for (let iu = 0; iu <= uSteps; iu++) {
      const u = -Math.PI + (iu / uSteps) * Math.PI * 2;
      const cu = spow(Math.cos(u), ex), su = spow(Math.sin(u), ex);
      pos.push(rx * cv * cu, ry * sv, rz * cv * su);
      uv.push(iu / uSteps, iv / vSteps);
    }
  }
  const row = uSteps + 1;
  for (let iv = 0; iv < vSteps; iv++) {
    for (let iu = 0; iu < uSteps; iu++) {
      const a = iv * row + iu, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// CURVE-SWEPT TUBE. points = array of THREE.Vector3 (or {x,y,z}); swept along a
// CatmullRom spline. Optional LINEAR taper (final radius = radius*taper) applied by
// scaling each ring's radial offset. Segments capped for mobile. Returns TubeGeometry.
export function tube(THREE, points, opts) {
  opts = opts || {};
  const pts = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0)));
  const closed = !!opts.closed;
  const curve = new THREE.CatmullRomCurve3(pts, closed, opts.curveType || "catmullrom", opts.tension != null ? opts.tension : 0.5);
  const tubSegs = _clampSeg(opts.segs != null ? opts.segs : 16, 3, 64);
  const radialSegs = _clampSeg(opts.radial != null ? opts.radial : 6, 3, 16);
  const radius = opts.radius != null ? opts.radius : 0.1;
  const geo = new THREE.TubeGeometry(curve, tubSegs, radius, radialSegs, closed);
  const taper = opts.taper;
  if (taper != null && Math.abs(taper - 1) > 1e-4 && !closed) {
    // scale each ring (index iv along the tube) about its centreline point so the
    // constant-radius tube tapers from 1x at the root to `taper`x at the tip.
    const p = geo.attributes.position;
    const c = new THREE.Vector3();
    for (let iv = 0; iv <= tubSegs; iv++) {
      curve.getPointAt(iv / tubSegs, c);
      const f = 1 + (taper - 1) * (iv / tubSegs);
      for (let iu = 0; iu <= radialSegs; iu++) {
        const k = iv * (radialSegs + 1) + iu;
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        p.setXYZ(k, c.x + (x - c.x) * f, c.y + (y - c.y) * f, c.z + (z - c.z) * f);
      }
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

// LATHE — a surface of revolution from a 2D half-profile (array of THREE.Vector2 or
// {x,y}); x is the radius from the axis, y is height. Segments capped for mobile.
export function lathe(THREE, profile, opts) {
  opts = opts || {};
  const pts = profile.map((p) => (p.isVector2 ? p : new THREE.Vector2(p.x || 0, p.y || 0)));
  const segs = _clampSeg(opts.segs != null ? opts.segs : 12, 3, 32);
  return new THREE.LatheGeometry(pts, segs, opts.phiStart || 0, opts.phiLength != null ? opts.phiLength : Math.PI * 2);
}

// FUSE — a cheap metaball-ish blob. Starts from a low-poly icosphere and pushes each
// vertex OUTWARD by a smooth field summed from `blobs` (each {c:Vector3-ish, r}) so
// several lumps read as one fused organic mass. Deterministic. detail capped (mobile).
export function fuse(THREE, blobs, opts) {
  opts = opts || {};
  const detail = _clampSeg(opts.detail != null ? opts.detail : 2, 0, 3);
  const scale = opts.scale != null ? opts.scale : 1;
  const g = new THREE.IcosahedronGeometry(scale, detail);
  const p = g.attributes.position;
  const n = new THREE.Vector3(), acc = new THREE.Vector3();
  const bs = (blobs || []).map((b) => ({
    c: b.c && b.c.isVector3 ? b.c : new THREE.Vector3((b.c && b.c.x) || 0, (b.c && b.c.y) || 0, (b.c && b.c.z) || 0),
    r: b.r != null ? b.r : 0.4,
  }));
  for (let i = 0; i < p.count; i++) {
    n.set(p.getX(i), p.getY(i), p.getZ(i));
    let bump = 0;
    for (const b of bs) {
      acc.copy(n).sub(b.c);
      const d2 = acc.lengthSq();
      bump += (b.r * b.r) / (d2 + b.r * b.r);   // smooth 0..1 falloff toward each centre
    }
    const f = 1 + _clampNum(bump, 0, 2) * (opts.amp != null ? opts.amp : 0.6);
    p.setXYZ(i, n.x * f, n.y * f, n.z * f);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// FABRIK — Forward-And-Backward-Reaching Inverse Kinematics. Solves the joint chain
// `points` (array of THREE.Vector3, points[0] is the fixed BASE) so the LAST joint
// reaches `target` while every bone keeps its original length. Deterministic, in-place;
// iterations capped for mobile. Also accepts `poleTarget` (a soft bend hint). Returns
// the points array. Used to curl/reach many-jointed tentacles smoothly.
export function fabrik(points, target, opts) {
  opts = opts || {};
  const n = points.length;
  if (n < 2) return points;
  const iters = _clampSeg(opts.iters != null ? opts.iters : 8, 1, 16);
  const tol = opts.tol != null ? opts.tol : 1e-3;
  const V = points[0].constructor;   // THREE.Vector3
  const base = new V().copy(points[0]);
  const tgt = target.isVector3 ? target : new V().set(target.x || 0, target.y || 0, target.z || 0);
  // bone lengths + total reach.
  const len = new Array(n - 1);
  let total = 0;
  const tmp = new V();
  for (let i = 0; i < n - 1; i++) { len[i] = tmp.copy(points[i + 1]).sub(points[i]).length() || 1e-4; total += len[i]; }
  // target unreachable -> stretch straight toward it (still deterministic).
  const distBaseTarget = tmp.copy(tgt).sub(base).length();
  if (distBaseTarget > total) {
    const dir = tmp.copy(tgt).sub(base).multiplyScalar(1 / (distBaseTarget || 1e-4));
    for (let i = 1; i < n; i++) points[i].copy(points[i - 1]).addScaledVector(dir, len[i - 1]);
    return points;
  }
  const dir = new V();
  for (let it = 0; it < iters; it++) {
    // BACKWARD: end -> target, walk to base.
    points[n - 1].copy(tgt);
    for (let i = n - 2; i >= 0; i--) {
      dir.copy(points[i]).sub(points[i + 1]); const d = dir.length() || 1e-4;
      points[i].copy(points[i + 1]).addScaledVector(dir, len[i] / d);
    }
    // FORWARD: base -> fixed, walk to end.
    points[0].copy(base);
    for (let i = 1; i < n; i++) {
      dir.copy(points[i]).sub(points[i - 1]); const d = dir.length() || 1e-4;
      points[i].copy(points[i - 1]).addScaledVector(dir, len[i - 1] / d);
    }
    if (tmp.copy(points[n - 1]).sub(tgt).length() < tol) break;
  }
  return points;
}

// ================================================================================
// PBR MATERIAL + the ONE shared procedural environment map
// ================================================================================

let _envMap = null;         // the shared reflection env (equirect CanvasTexture or PMREM)
let _envIsPMREM = false;

// A small procedurally-drawn equirectangular sky: a warm-top / cool-horizon /
// dark-ground gradient with a couple of soft "light" blobs so chrome has highlights
// to catch. Renderer-AGNOSTIC (it is CPU image data, so ANY renderer can upload it —
// unlike a PMREM render-target, which is bound to the renderer that baked it). ~128px.
function makeEnvCanvasTexture(THREE) {
  if (typeof document === "undefined" || !document.createElement) return null;
  const W = 128, H = 64;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"); if (!g) return null;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0.0, "#dfe8ff");   // sky zenith (cool white)
  grd.addColorStop(0.42, "#8f9fd6");  // upper sky
  grd.addColorStop(0.5, "#c9b9d8");   // horizon glow
  grd.addColorStop(0.62, "#3a3450");  // ground near
  grd.addColorStop(1.0, "#0d0a18");   // ground far (dark)
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // two soft key-lights for specular highlights.
  const blob = (cx, cy, r, col) => {
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  };
  blob(W * 0.28, H * 0.3, H * 0.42, "rgba(255,246,224,0.9)");   // warm sun
  blob(W * 0.72, H * 0.34, H * 0.34, "rgba(180,220,255,0.7)");  // cool fill
  const t = new THREE.CanvasTexture(cv);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace || t.colorSpace;
  t.needsUpdate = true;
  return t;
}

// The ONE shared env map, lazily built + cached. Reused by every pbr material.
export function sharedEnvMap(THREE) {
  if (_envMap) return _envMap;
  _envMap = makeEnvCanvasTexture(THREE);
  return _envMap;
}

// OPTIONAL upgrade: bake a PMREM (roughness-prefiltered) env with the LIVE renderer
// that will draw the scene (a PMREM render-target is bound to its baking renderer, so
// this MUST use the same renderer that renders the aliens). The controller may call it
// once after it has a renderer; pbr materials built afterward pick up the sharper env.
// Falls back silently to the equirect env on any failure. Returns the env texture.
export function buildPMREMEnv(THREE, renderer) {
  try {
    if (!renderer || typeof THREE.PMREMGenerator !== "function") return sharedEnvMap(THREE);
    const src = makeEnvCanvasTexture(THREE);
    if (!src) return sharedEnvMap(THREE);
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromEquirectangular(src);
    src.dispose(); pmrem.dispose();
    if (_envMap && _envIsPMREM && _envMap.dispose) _envMap.dispose();
    _envMap = rt.texture; _envIsPMREM = true;
    return _envMap;
  } catch (e) {
    return sharedEnvMap(THREE);
  }
}

// PBR MATERIAL — MeshStandardMaterial (real metalness/roughness shading) wired to the
// ONE shared env map for reflections. This is the 'pbr' renderStyle: chrome / glass /
// polished metal, VECTOR-SELECTED per genre (never forced global). Optional procedural
// normal / roughness maps add micro-surface. Emissive keeps a little self-glow.
export function pbrMaterial(THREE, opts) {
  opts = opts || {};
  const env = sharedEnvMap(THREE);
  const m = new THREE.MeshStandardMaterial({
    color: opts.color != null ? opts.color : 0x9aa4c8,
    metalness: opts.metalness != null ? _clampNum(opts.metalness, 0, 1) : 0.85,
    roughness: opts.roughness != null ? _clampNum(opts.roughness, 0.02, 1) : 0.25,
    emissive: opts.emissive != null ? opts.emissive : 0x000000,
    envMap: env || null,
    envMapIntensity: opts.envMapIntensity != null ? opts.envMapIntensity : 1.0,
    flatShading: !!opts.flatShading,
    wireframe: !!opts.wireframe,
    transparent: !!opts.transparent,
    opacity: opts.opacity != null ? opts.opacity : 1,
    map: opts.map || null,
    normalMap: opts.normalMap || null,
    roughnessMap: opts.roughnessMap || null,
  });
  if (opts.normalMap && opts.normalScale != null) m.normalScale = new THREE.Vector2(opts.normalScale, opts.normalScale);
  return m;
}

// small procedural NORMAL map (tangent-space, packed in RGB). kind: 'bumps'|'brushed'|
// 'facet'. 64px, tiled, reused. Deterministic — any noise flows through `rand`.
export function normalTexture(THREE, kind, rand) {
  if (typeof document === "undefined" || !document.createElement) return null;
  rand = rand || (() => 0.5);
  const S = 64, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d"); if (!g) return null;
  g.fillStyle = "#8080ff"; g.fillRect(0, 0, S, S);   // flat normal (0,0,1)
  if (kind === "brushed") {
    for (let y = 0; y < S; y += 1) {
      const s = 128 + ((rand() * 2 - 1) * 40) | 0;
      g.fillStyle = `rgb(${s},128,255)`; g.fillRect(0, y, S, 1);
    }
  } else if (kind === "facet") {
    for (let i = 0; i < 40; i++) {
      const x = (rand() * S) | 0, y = (rand() * S) | 0, r = 4 + (rand() * 10) | 0;
      const nx = 128 + ((rand() * 2 - 1) * 60) | 0, ny = 128 + ((rand() * 2 - 1) * 60) | 0;
      g.fillStyle = `rgb(${nx},${ny},235)`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  } else {   // bumps
    for (let i = 0; i < 90; i++) {
      const x = (rand() * S) | 0, y = (rand() * S) | 0, r = 2 + (rand() * 5) | 0;
      const nx = 128 + ((rand() * 2 - 1) * 70) | 0, ny = 128 + ((rand() * 2 - 1) * 70) | 0;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgb(${nx},${ny},235)`); rg.addColorStop(1, "rgba(128,128,255,0)");
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
}

// small procedural ROUGHNESS map (grayscale). kind: 'mottle'|'brushed'. 64px, tiled.
export function roughnessTexture(THREE, kind, rand) {
  if (typeof document === "undefined" || !document.createElement) return null;
  rand = rand || (() => 0.5);
  const S = 64, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d"); if (!g) return null;
  g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, S, S);
  if (kind === "brushed") {
    for (let y = 0; y < S; y++) { const v = (110 + rand() * 90) | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, S, 1); }
  } else {
    for (let i = 0; i < 140; i++) {
      const x = (rand() * S) | 0, y = (rand() * S) | 0, v = (70 + rand() * 150) | 0;
      g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(x, y, 2 + (rand() * 3) | 0, 2 + (rand() * 3) | 0);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
}

// test/util: dispose the shared env (so a fresh page/test can rebuild deterministically).
export function _resetEnv() { if (_envMap && _envMap.dispose) _envMap.dispose(); _envMap = null; _envIsPMREM = false; }

export default {
  superquadric, tube, lathe, fuse, fabrik,
  pbrMaterial, sharedEnvMap, buildPMREMEnv, normalTexture, roughnessTexture, _resetEnv,
};
