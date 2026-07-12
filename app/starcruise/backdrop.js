// backdrop.js — Build phase. The procedural, seeded, low-poly world BEHIND the
// alien band: a CITY skyline or a FARM, chosen by traits.backdrop. Everything is
// asset-free and cheap — a handful of InstancedMeshes (few draw calls), flat /
// vertex-lit for the PS1 look; postfx adds the dither/warp.
//
// The CITY is a DE-SQUARED skyline grown by a recursive SHAPE GRAMMAR (see
// buildCity): each lot sprouts a trunk of setback SUPERQUADRIC masses (exponents fed
// from the genre/species vector), then BRANCHES into child towers or FINISHES with a
// CURVE-SWEPT TUBE spire or a LATHE cupola, with greebled superquadric bumps on the
// facades — all via app/starcruise/geom.js. Every module family batches into one
// InstancedMesh so the silhouette is wildly varied + curvy while draw calls stay low.
// A minority of baked-window box towers keep the readable-windows read. On top sits a
// crowd of BLINKING beacon/window lights (a single instanced-color mesh whose
// per-light brightness is driven by seeded phases/periods in update(dt)), and low-poly
// FOLIAGE (trunks + canopies) is scattered through the scene. The FARM is the calm
// variant: varied crops (stalks, bushes, corn), silos with conical roofs, foliage
// tree-lines and a few blinking fireflies. When the genre's renderStyle.material is
// 'pbr', the whole city + planet render as real chrome/glass (MeshStandardMaterial +
// ONE shared procedural env map) alongside the existing flat/cel/wire/glitch styles.
//
// CONTRACT
//   makeBackdrop(THREE, traits, seed) -> { group, update(dt) }
//     traits.backdrop = 'city' | 'farm' | ...   traits.palette/glow tint it.
//     seed = integer; same traits+seed -> identical layout (determinism law).

// mulberry32 — tiny seeded PRNG (same stream from the same seed).
function rng32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// integer hash for the per-cell window pattern (deterministic, no rng draw).
function ihash(x) {
  x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) | 0; x ^= x >>> 4;
  x = Math.imul(x, 0x27d4eb2d); x ^= x >>> 15; return x >>> 0;
}
function colHSL(THREE, h, s, l) {
  return new THREE.Color().setHSL(((((h % 360) + 360) % 360) / 360), s < 0 ? 0 : s > 1 ? 1 : s, l < 0 ? 0 : l > 1 ? 1 : l);
}
const TAU = Math.PI * 2;

// ---- GEOM LIB (de-squaring primitives) -----------------------------------------
// The sibling app/starcruise/geom.js supplies the vector-driven procedural
// primitives that replace box monotony: SUPERQUADRICS (one exponent-morphing family
// box<->sphere<->octahedron<->cylinder<->pinched-star), CURVE-SWEPT TUBES along
// Catmull-Rom splines, LATHE profiles, and a 'pbr' MeshStandardMaterial with ONE
// shared procedural env map. We import it LAZILY (top-level await) so a missing/late
// geom.js can never crash the module: every call in makeGeomKit is guarded and falls
// back to a hand-rolled CORE-Three implementation (superquadric math / TubeGeometry
// along a CatmullRomCurve3 / LatheGeometry / MeshStandardMaterial), so the world is
// always curvy + de-squared whether or not geom.js is present.
//
// geom.js API consumed here (reconciled to the sibling lib's real signatures):
//   superquadric(THREE, { ex, ey, segs }) -> BufferGeometry (radius ~1; ex=EW, ey=NS)
//   tube(THREE, points({x,y,z})[], { radius, radial, segs, closed, taper }) -> BufferGeometry
//   lathe(THREE, profile({x,y})[], { segs }) -> BufferGeometry
//   pbrMaterial(THREE, { color, emissive, metalness, roughness, flatShading, ... })
//       -> MeshStandardMaterial wired to geom's ONE shared env map
//   sharedEnvMap(THREE) -> Texture
// Our kit takes convenient (e1=NS,e2=EW / [x,y,z] / [x,y]) inputs and translates; a
// missing/mismatched geom.js falls back to the hand-rolled core-Three primitive.
let GEOM = null;
try { GEOM = await import("./geom.js"); } catch (_e) { GEOM = null; }

// signed power (superellipsoid needs sign-preserving |v|^p).
function _spow(v, p) { const s = v < 0 ? -1 : 1; return s * Math.pow(Math.abs(v), p); }
// hand-rolled superellipsoid: a unit (radius ~0.5) superquadric whose two exponents
// morph box(≈0.1)<->sphere(1)<->octahedron(2)<->cylinder<->pinched-star(>2).
function sqFallback(THREE, e1, e2, seg) {
  const rows = Math.max(6, seg | 0), cols = Math.max(6, ((seg * 1.3) | 0));
  const grid = [];
  for (let i = 0; i <= rows; i++) {
    const eta = -Math.PI / 2 + (i / rows) * Math.PI;
    const ce = Math.cos(eta), se = Math.sin(eta), line = [];
    for (let j = 0; j <= cols; j++) {
      const om = -Math.PI + (j / cols) * TAU, co = Math.cos(om), so = Math.sin(om);
      line.push([_spow(ce, e1) * _spow(co, e2) * 0.5, _spow(se, e1) * 0.5, _spow(ce, e1) * _spow(so, e2) * 0.5]);
    }
    grid.push(line);
  }
  const v = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j + 1], d = grid[i + 1][j];
    v.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  return g;
}
function tubeFallback(THREE, pts, o) {
  o = o || {};
  const vecs = pts.map((p) => (p && p.isVector3) ? p : new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(vecs);
  return new THREE.TubeGeometry(curve, o.tubularSegments || 14, o.radius == null ? 0.1 : o.radius, o.radialSegments || 6, !!o.closed);
}
function latheFallback(THREE, profile, seg) {
  const v2 = profile.map((p) => (p && p.isVector2) ? p : new THREE.Vector2(p[0], p[1]));
  return new THREE.LatheGeometry(v2, Math.max(3, seg | 0));
}
// ONE shared procedural equirectangular env map (chrome/glass reflections). Cheap
// canvas gradient sky + a bright sun blob; deterministic, asset-free, mobile-light.
function buildEnvMap(THREE) {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 64;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "#20263a"); g.addColorStop(0.44, "#5a708f"); g.addColorStop(0.5, "#e3ecff");
  g.addColorStop(0.56, "#39485c"); g.addColorStop(1, "#080a12");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = "rgba(255,248,228,0.95)"; ctx.beginPath(); ctx.arc(42, 21, 6.5, 0, TAU); ctx.fill();
  ctx.fillStyle = "rgba(120,200,255,0.5)"; ctx.beginPath(); ctx.arc(96, 30, 9, 0, TAU); ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.needsUpdate = true;
  return tex;
}
// makeGeomKit — the guarded facade over geom.js: prefer the sibling lib, fall back
// to the hand-rolled core-Three primitive on any absence/mismatch/throw. envMap is
// created ONCE, lazily, and shared across every pbr material (mobile budget).
export function makeGeomKit(THREE) {
  const has = (n) => GEOM && typeof GEOM[n] === "function";
  let envMap;
  const ensureEnv = () => {
    if (envMap !== undefined) return envMap;
    envMap = null;
    if (has("sharedEnvMap")) { try { const e = GEOM.sharedEnvMap(THREE); if (e) envMap = e; } catch (_e) { /* fall through */ } }
    if (!envMap) envMap = buildEnvMap(THREE);
    return envMap;
  };
  const okGeo = (g) => g && g.isBufferGeometry && g.attributes && g.attributes.position && g.attributes.position.count > 0;
  return {
    // e1 = north-south exponent, e2 = east-west exponent (mapped to geom ey/ex).
    sq(e1, e2, seg) {
      if (has("superquadric")) { try { const g = GEOM.superquadric(THREE, { ex: e2, ey: e1, segs: seg }); if (okGeo(g)) return g; } catch (_e) { /* fall */ } }
      return sqFallback(THREE, e1, e2, seg);
    },
    // pts as [x,y,z] arrays; opts.radius / radialSegments / tubularSegments / closed / taper.
    tube(pts, o) {
      o = o || {};
      if (has("tube")) {
        try {
          const g = GEOM.tube(THREE, pts.map((p) => (p.isVector3 ? p : { x: p[0], y: p[1], z: p[2] })),
            { radius: o.radius, radial: o.radialSegments, segs: o.tubularSegments, closed: !!o.closed, taper: o.taper });
          if (okGeo(g)) return g;
        } catch (_e) { /* fall */ }
      }
      return tubeFallback(THREE, pts, o);
    },
    // profile as [x,y] arrays (x = radius, y = height).
    lathe(profile, seg) {
      if (has("lathe")) { try { const g = GEOM.lathe(THREE, profile.map((p) => (p.isVector2 ? p : { x: p[0], y: p[1] })), { segs: seg }); if (okGeo(g)) return g; } catch (_e) { /* fall */ } }
      return latheFallback(THREE, profile, seg);
    },
    pbr(o) {
      const env = ensureEnv();
      if (has("pbrMaterial")) {
        try {
          const m = GEOM.pbrMaterial(THREE, {
            color: o.color, emissive: o.emissive, metalness: o.metalness, roughness: o.roughness,
            flatShading: !!o.flatShading, vertexColors: !!o.vertexColors, envMap: env,
          });
          if (m && m.isMaterial) {
            if (o.vertexColors) m.vertexColors = true;   // baked windows still ride through
            if (o.emissiveIntensity != null) m.emissiveIntensity = o.emissiveIntensity;
            return m;
          }
        } catch (_e) { /* fall */ }
      }
      const m = new THREE.MeshStandardMaterial({
        color: o.color, emissive: o.emissive || new THREE.Color(0, 0, 0),
        metalness: o.metalness == null ? 0.85 : o.metalness, roughness: o.roughness == null ? 0.3 : o.roughness,
        vertexColors: !!o.vertexColors, flatShading: !!o.flatShading, envMap: env,
      });
      m.envMapIntensity = o.envMapIntensity == null ? 1.0 : o.envMapIntensity;
      if (o.emissiveIntensity != null) m.emissiveIntensity = o.emissiveIntensity;
      return m;
    },
    ensureEnv,
  };
}

// ---- ABSTRACT WORLD selection --------------------------------------------------
// #4 DISTINCT ABSTRACT PLANETS: each genre greets you on its OWN abstract world —
// not the same city-on-a-ground-plane. The world archetype is read off the alien
// SPECIES body-plan (the same 23-vector-derived plan the band shares), falling back
// to skin / backdrop when the richer traits aren't present (headless minimal-traits
// scaffold). The world is a PERIPHERAL environment wrapped around a recognizable
// little city/band STAGE — a molten void, a crystal field, a ring world, a liquid
// sea, a tendril forest, a cloud sea, a spire garden, or a geometric void.
//
// IMPORTANT (determinism/render-only law): the world is chosen from body.plan /
// skin / backdrop ONLY — never from renderStyle.material — so re-skinning a genre
// (flat->wireframe->glitch...) leaves the seeded LAYOUT byte-identical.
function pickWorld(traits, kind) {
  const plan = traits && traits.body && traits.body.plan;
  const skin = traits && traits.skin;
  const byPlan = {
    "floating-gas": "cloudsea",
    radial: "ringworld",
    crystalline: "crystalfield",
    insectoid: "tendrilforest",
    cephalopod: "liquidsea",
    amorphous: "moltenvoid",
    stalk: "spiregarden",
  };
  if (plan && byPlan[plan]) return byPlan[plan];
  if (skin === "glass") return "cloudsea";
  if (skin === "matte") return "moltenvoid";
  if (kind === "farm") return "tendrilforest";
  return "geomvoid";
}
// ---- #3 PER-GENRE CITY GRAMMAR + LANDSCAPE ARCHETYPES --------------------------
// Goal 3: push per-genre variety HARD. The city is grown by a recursive shape grammar
// (buildCity); which ARCHETYPE it grows in — the whole silhouette family — is chosen
// here from the genre signal (body.plan first, then skin, then a seed fallback), NEVER
// from renderStyle (re-skinning must not move geometry). Each archetype reshapes the
// grammar knobs (roundness/verticality/branch), the finisher weights (spire vs cupola
// vs a signature module), the baked-window box-tower share, AND emits a distinct
// SIGNATURE module family (dome / ziggurat / blob-pod / sky-bridge) so two genres'
// building family-sets + silhouettes are OBVIOUSLY different.
//   towers   — vertical setback masses + baked-window boxes (the classic skyline).
//   spires   — needle forest: tall thin tube spires dominate, almost no boxes.
//   domes    — low rounded rotundas: lathe cupolas + hemisphere domes dominate.
//   organic  — blobby pod-clusters: very-round superquadrics, branchy, no boxes.
//   ziggurat — stepped stone terraces: merged-slab ziggurats as the signature mass.
//   arcology — dense branching megastructure + sky-bridges between towers.
const CITY_GRAMMAR_BY_PLAN = {
  "floating-gas": "domes",
  radial: "arcology",
  crystalline: "ziggurat",
  insectoid: "organic",
  cephalopod: "domes",
  amorphous: "organic",
  stalk: "spires",
};
// per-archetype grammar shaping. null knobs keep the seed/species-derived defaults
// (the classic 'towers' path stays byte-for-byte the v15 skyline). w = finisher
// weights (spire / cupola / signature), boxPct = baked-window box-tower share, sig =
// the signature module geometry kind emitted as this archetype's tell.
const CITY_GRAMMAR = {
  towers: { round: null, vert: null, branch: null, boxPct: 0.16, wSpire: 0.42, wCupola: 0.20, wSig: 0.0, sig: null },
  spires: { round: 0.20, vert: 0.95, branch: 0.05, boxPct: 0.03, wSpire: 0.86, wCupola: 0.05, wSig: 0.0, sig: null },
  domes: { round: 0.88, vert: 0.22, branch: 0.08, boxPct: 0.02, wSpire: 0.05, wCupola: 0.55, wSig: 0.30, sig: "dome" },
  organic: { round: 0.96, vert: 0.35, branch: 0.30, boxPct: 0.00, wSpire: 0.10, wCupola: 0.22, wSig: 0.40, sig: "blob" },
  ziggurat: { round: 0.24, vert: 0.52, branch: 0.10, boxPct: 0.00, wSpire: 0.05, wCupola: 0.10, wSig: 0.55, sig: "zig" },
  arcology: { round: 0.55, vert: 0.72, branch: 0.85, boxPct: 0.05, wSpire: 0.30, wCupola: 0.16, wSig: 0.24, sig: "bridge" },
};
function pickCityGrammar(traits, seed) {
  const plan = traits && traits.body && traits.body.plan;
  if (plan && CITY_GRAMMAR_BY_PLAN[plan]) return CITY_GRAMMAR_BY_PLAN[plan];
  const skin = traits && traits.skin;
  if (skin === "glass") return "domes";
  if (skin === "organic") return "organic";
  if (skin === "matte") return "ziggurat";
  if (skin === "chrome") return "towers";
  // no genre signal at all -> the well-tested classic skyline (deterministic default).
  return "towers";
}
// LANDSCAPE archetype: the near-ground natural features scattered over the world
// (rocks / crystals / dunes / foliage clumps / arches / water). Chosen from the same
// genre signal so each planet's ground reads distinct; independent of renderStyle.
const LANDSCAPE_BY_PLAN = {
  "floating-gas": "mist",
  radial: "arches",
  crystalline: "crystal",
  insectoid: "fungal",
  cephalopod: "water",
  amorphous: "volcanic",
  stalk: "desert",
};
function pickLandscape(traits, seed, kind) {
  const plan = traits && traits.body && traits.body.plan;
  if (plan && LANDSCAPE_BY_PLAN[plan]) return LANDSCAPE_BY_PLAN[plan];
  if (kind === "farm") return "fungal";
  const skin = traits && traits.skin;
  if (skin === "glass") return "mist";
  if (skin === "matte") return "volcanic";
  const r = ihash((seed ^ 0x2c1b3a7d) >>> 0) / 4294967296;
  return ["rocky", "crystal", "desert", "arches"][Math.floor(r * 4)];
}

// small deterministic ground-colour offsets (h,s,l) that push the floor into each
// world's key — applied via Color.offsetHSL, so NO extra rng draw is consumed.
const WORLD_GROUND = {
  ringworld: [0.0, 0.05, -0.02],
  crystalfield: [0.33, 0.1, -0.02],
  tendrilforest: [0.0, 0.05, 0.0],
  liquidsea: [0.5, 0.15, -0.03],
  cloudsea: [0.0, 0.0, 0.05],
  moltenvoid: [-0.62, 0.18, -0.02],
  spiregarden: [0.5, 0.05, 0.0],
  geomvoid: [0.0, 0.0, 0.0],
};

// ---- RENDER-STYLE GLSL (the shared visual LANGUAGE, same vocab as the aliens) ----
// IRIDESCENT: view-angle fresnel rim whose HUE cycles with the angle (glossy oil).
const IRID_GLSL = [
  "float _fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);",
  "vec3 _ir = 0.5 + 0.5 * cos(6.2831853 * (_fr + vec3(0.0, 0.33, 0.66)));",
  "outgoingLight = mix(outgoingLight, outgoingLight + _ir, _fr * 0.85);",
].join("\n");
// GLITCH: seeded vertex jitter (position+time, occasional bursts) + rgb-split flicker.
const GLITCH_VERT = [
  "float _burst = step(0.86, fract(uTime * 0.7));",
  "transformed.x += sin(uTime * 13.0 + transformed.y * 20.0 + transformed.x * 7.0) * (0.01 + 0.05 * _burst);",
  "transformed.z += cos(uTime * 17.0 + transformed.y * 14.0) * (0.008 + 0.03 * _burst);",
].join("\n");
const GLITCH_FRAG = [
  "float _fl = step(0.8, fract(uTime * 0.7 + 0.3));",
  "outgoingLight.r += 0.16 * _fl * (0.5 + 0.5 * sin(uTime * 40.0));",
  "outgoingLight.b -= 0.16 * _fl * (0.5 + 0.5 * sin(uTime * 37.0));",
].join("\n");

export function makeBackdrop(THREE, traits, seed, opts) {
  seed = (seed | 0) || 1;
  traits = traits || {};
  opts = opts || {};
  const rand = rng32((seed ^ 0x1b8734) >>> 0);
  const kind = traits.backdrop === "farm" ? "farm" : "city";
  const glow = Math.max(0, Math.min(1, traits.glow || 0.3));
  const leafy = kind === "farm" || traits.skin === "organic";
  const acc = traits.palette && traits.palette.accent
    ? { h: traits.palette.accent.h || 40, s: traits.palette.accent.s != null ? traits.palette.accent.s : 0.85, l: traits.palette.accent.l != null ? traits.palette.accent.l : 0.6 }
    : { h: 40, s: 0.85, l: 0.6 };
  // the abstract WORLD wrapped around the little city/band stage (see pickWorld).
  const world = pickWorld(traits, kind);
  // the near-ground LANDSCAPE features (rocks/crystals/dunes/arches/water/...) — a
  // separate per-genre variety layer over the world (see pickLandscape/buildLandscape).
  const landscape = pickLandscape(traits, seed, kind);

  // ---- RENDER STYLE ---- the genre's surface LANGUAGE (traits.renderStyle.material).
  // The whole world — buildings, foliage, crops, silos — shades in ONE vocabulary so
  // a techno city reads glitched/wire while an ambient one reads cel/iridescent. Built
  // ONCE per style and reused across every InstancedMesh (mobile-cheap, no recompiles).
  // Defaults to 'flat' (the original flat-lit Lambert) so the world is never blank.
  const style = (traits.renderStyle && traits.renderStyle.material) || "flat";
  const wire = style === "wireframe";     // lit wire silhouette (buildings read as edges)
  const smooth = style === "matte";       // matte = soft SMOOTH shading (no low-poly facets)
  const pbr = style === "pbr";            // PBR = real chrome/glass (MeshStandardMaterial + env map)
  // the de-squaring primitive kit (superquadric / tube / lathe / pbr) — one per world.
  const gk = makeGeomKit(THREE);
  // glass genres read as clearer, less metallic PBR; chrome/default read as bright metal.
  const pbrMetal = traits.skin === "glass" ? 0.2 : 0.9;
  const pbrRough = traits.skin === "glass" ? 0.08 : 0.25;
  const glitchTime = { value: 0 };        // shared uniform, driven by update()'s clock
  let celGrad = null;                     // CEL: 3-band hard toon ramp (dark/mid/lit)
  if (style === "cel") {
    const ramp = new Uint8Array([70, 70, 84, 255, 150, 150, 165, 255, 245, 245, 255, 255]);
    celGrad = new THREE.DataTexture(ramp, 3, 1);
    celGrad.magFilter = THREE.NearestFilter; celGrad.minFilter = THREE.NearestFilter;
    celGrad.needsUpdate = true;
  }
  function applyStyleHook(m) {
    if (style === "iridescent") {
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>", IRID_GLSL + "\n#include <opaque_fragment>");
      };
      m.customProgramCacheKey = () => "sc_irid";
    } else if (style === "glitch") {
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = glitchTime;
        shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader.replace(
          "#include <begin_vertex>", "#include <begin_vertex>\n" + GLITCH_VERT);
        shader.fragmentShader = "uniform float uTime;\n" + shader.fragmentShader.replace(
          "#include <opaque_fragment>", GLITCH_FRAG + "\n#include <opaque_fragment>");
      };
      m.customProgramCacheKey = () => "sc_glitch";
    }
    return m;
  }
  // styleMat — one lit + shadowed surface in the active style. cel -> banded MeshToon;
  // everything else -> Lambert (flat / matte-smooth / wireframe) + the fresnel/glitch
  // hook. Keeps emissive glow, vertex colours (baked windows), and light response.
  function styleMat(o) {
    const flat = o.flatShading !== false && !smooth;
    const emissive = o.emissive || new THREE.Color(0, 0, 0);
    let m;
    if (pbr) {
      // real material: chrome/glass reflecting the ONE shared env map. Keeps the
      // genre-tint as base colour + emissive breath; vertex colours (baked windows)
      // still ride through. Not global — only when the genre selects 'pbr'.
      return gk.pbr({
        color: o.color, emissive, emissiveIntensity: o.emissiveIntensity,
        metalness: pbrMetal, roughness: pbrRough,
        vertexColors: !!o.vertexColors, flatShading: flat,
      });
    }
    if (style === "cel") {
      m = new THREE.MeshToonMaterial({ color: o.color, emissive, gradientMap: celGrad, vertexColors: !!o.vertexColors });
      m.flatShading = true;
    } else {
      m = new THREE.MeshLambertMaterial({ color: o.color, emissive, vertexColors: !!o.vertexColors, flatShading: flat, wireframe: wire });
      if (smooth && o.color) m.emissive = emissive.clone().add(o.color.clone().multiplyScalar(0.08)); // soft ambient lift
    }
    if (o.emissiveIntensity != null) m.emissiveIntensity = o.emissiveIntensity;
    return applyStyleHook(m);
  }

  const group = new THREE.Object3D();
  // SHADOW law: the controller enables renderer.shadowMap + ONE key directional
  // light with a tight frustum; our job is to flag which meshes throw and catch
  // shadows so the skyline reads MODELLED, not flat. Solid forms cast; the ground
  // catches; tall buildings also catch (neighbour + self shadows add real depth).
  // Glowing light octahedra never cast (they'd punch black holes in the glow).
  function shadow(mesh, cast, receive) { mesh.castShadow = !!cast; mesh.receiveShadow = !!receive; return mesh; }
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const YAX = new THREE.Vector3(0, 1, 0);
  const _c = new THREE.Color();

  // ---- CURVED-SURFACE PLACEMENT (small-world integration) --------------------
  // Goal 3c: when the coming small-world integration hands us the planet's surface
  // helpers, EVERY instance places ON the curved sphere oriented to the surface
  // normal instead of on a flat ground plane — WITHOUT changing any per-genre layout
  // logic. The whole builder keeps thinking in flat (x,z) ground coords + a y lift;
  // composeAt() is the ONE seam that maps that ground frame onto the sphere.
  //
  // opts.surface CONTRACT (consumed here; supplied by the planet module / mock):
  //   surfacePoint(dirVec3) -> world point ON the terrain surface for a UNIT dir
  //     (Vector3 | [x,y,z] | {x,y,z} all accepted). This is planet.field's own
  //     surface point, so buildings foot-plant exactly on the baked mesh.
  //   upAt(dirVec3)         -> OUTWARD unit normal at that dir (same accepted forms).
  //   up, tangentX, tangentZ (unit vecs) + radius : the landing tangent FRAME used to
  //     map flat ground (x,z) onto a direction near the landing pole. planet.field
  //     already exposes {up, tangentX, tangentZ, radius}; defaults fill any gaps.
  // Absent opts.surface -> the classic FLAT path (v15 callers) runs byte-for-byte as
  // before: composeAt degenerates to compose(position, yaw+tilt euler, scale).
  const surface = (opts.surface && typeof opts.surface.surfacePoint === "function"
    && typeof opts.surface.upAt === "function") ? opts.surface : null;
  const _asV = (v) => (v == null ? [0, 0, 0]
    : (v.isVector3 ? [v.x, v.y, v.z] : Array.isArray(v) ? v : [v.x || 0, v.y || 0, v.z || 0]));
  let SF = null;
  if (surface) {
    const up = _asV(surface.up); if (!(up[0] || up[1] || up[2])) { up[1] = 1; }
    let tX = _asV(surface.tangentX), tZ = _asV(surface.tangentZ);
    if (!(tX[0] || tX[1] || tX[2])) tX = [1, 0, 0];
    if (!(tZ[0] || tZ[1] || tZ[2])) tZ = [0, 0, 1];
    const R = surface.radius > 0 ? surface.radius : 20;
    SF = { up, tX, tZ, R };
  }
  const _dir = new THREE.Vector3(), _sp = new THREE.Vector3(), _nm = new THREE.Vector3();
  const _qA = new THREE.Quaternion(), _qS = new THREE.Quaternion(), _qT = new THREE.Quaternion();
  const _e2 = new THREE.Euler();
  // compose ONE placement transform into `out` (a Matrix4). FLAT: pos (x,y,z), yaw
  // about +Y plus optional (rx,rz) tilt, scale (sx,sy,sz). CURVED: map ground (x,z)
  // -> a direction on the sphere, foot-plant at surfacePoint(dir), lift y along the
  // outward normal, orient local +Y to that normal, and spin yaw about it (+ tilt).
  function composeAt(out, x, y, z, yaw, sx, sy, sz, rx, rz) {
    if (!SF) {
      _e2.set(rx || 0, yaw || 0, rz || 0);
      _q.setFromEuler(_e2);
      _p.set(x, y, z); _s.set(sx, sy, sz);
      out.compose(_p, _q, _s);
      return out;
    }
    // ground (x,z) on the tangent plane -> unit direction near the landing pole.
    _dir.set(SF.up[0] * SF.R + SF.tX[0] * x + SF.tZ[0] * z,
      SF.up[1] * SF.R + SF.tX[1] * x + SF.tZ[1] * z,
      SF.up[2] * SF.R + SF.tX[2] * x + SF.tZ[2] * z).normalize();
    const sp = _asV(surface.surfacePoint(_dir));
    _nm.fromArray(_asV(surface.upAt(_dir)));
    if (_nm.lengthSq() < 1e-9) _nm.copy(_dir);
    _nm.normalize();
    // lift by y along the outward normal (y = height above the local ground).
    _p.set(sp[0] + _nm.x * y, sp[1] + _nm.y * y, sp[2] + _nm.z * y);
    _qA.setFromUnitVectors(YAX, _nm);                 // local +Y -> surface normal
    _qS.setFromAxisAngle(_nm, yaw || 0);              // spin about the normal
    _q.copy(_qS).multiply(_qA);
    if (rx || rz) { _e2.set(rx || 0, 0, rz || 0); _qT.setFromEuler(_e2); _q.multiply(_qT); }
    _s.set(sx, sy, sz);
    out.compose(_p, _q, _s);
    return out;
  }
  // place instance i of `mesh` via composeAt (curved-aware). The ONE emit seam.
  function emit(mesh, i, x, y, z, sx, sy, sz, yaw, rx, rz) {
    composeAt(_m, x, y, z, yaw, sx, sy, sz, rx, rz);
    mesh.setMatrixAt(i, _m);
  }
  const flicker = [];   // building materials the skyline breathes on update()
  const swayers = [];   // { mesh, sx, sz, px } gentle wind swayers (foliage/crops)
  const orbList = [];   // signature glowing balls-of-light gathered from the world
  let beacons = null;   // { mesh, meta[] } the blinking-light field
  let orbs = null;      // { mesh, meta[] } the pulsing balls-of-light field
  let clock = 0;

  // reusable throwaway geometry -> unit-height, base at y=0 (see normGeo).
  function normGeo(geo) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox, h = bb.max.y - bb.min.y || 1;
    geo.translate(0, -bb.min.y, 0);
    geo.scale(1, 1 / h, 1);
    return geo;
  }
  // like normGeo but ALSO normalizes the footprint to a unit cube (x,z in [-0.5,0.5],
  // y in [0,1]) so a superquadric (geom radius ~1) or a fallback (radius ~0.5) both
  // scale by the same instance w/d as the old boxes did — geometry-source-agnostic.
  function boxNorm(geo) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const hx = (bb.max.x - bb.min.x) || 1, hy = (bb.max.y - bb.min.y) || 1, hz = (bb.max.z - bb.min.z) || 1;
    geo.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2);
    geo.scale(1 / hx, 1 / hy, 1 / hz);
    return geo;
  }
  // merge a list of (indexed or not) geometries' position+normal into one — a
  // hand-rolled replacement for BufferGeometryUtils (addons are off-limits).
  function mergeGeos(geos) {
    const ng = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    let total = 0;
    for (const g of ng) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
    let o = 0;
    for (const g of ng) {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    return geo;
  }

  // ---- GROUND ----------------------------------------------------------
  const groundCol = kind === "farm"
    ? colHSL(THREE, 90 + rand() * 30, 0.4, 0.20)      // tilled green-brown soil
    : colHSL(THREE, 220 + rand() * 30, 0.15, 0.11);   // dark wet asphalt
  // push the floor into the active world's key (deterministic; no extra rng draw).
  const wg = WORLD_GROUND[world] || WORLD_GROUND.geomvoid;
  groundCol.offsetHSL(wg[0], wg[1], wg[2]);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshLambertMaterial({ color: groundCol, flatShading: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.name = "ground";
  ground.receiveShadow = true;   // the skyline throws real shadows across the floor
  group.add(ground);

  if (kind === "city") buildCity(); else buildFarm();
  // wrap the stage in the genre's abstract WORLD (peripheral structures + orbs),
  // then bake the gathered balls-of-light into one instanced field.
  buildWorld(world);
  buildLandscape(landscape);
  if (orbList.length) buildOrbs(orbList);

  // ============================ CITY ====================================
  // A WILD skyline: buildings drawn from a whole family of polyhedra, one
  // InstancedMesh per shape family (few draw calls), genre-tinted, plus a crowd
  // of blinking beacon/window lights and scattered foliage.
  // ---- #5 L-SYSTEM / SPLIT-GRAMMAR CITY --------------------------------------
  // The skyline is no longer a bag of stock polyhedra. Each building lot is grown by
  // a small RECURSIVE SHAPE GRAMMAR: a vertical trunk of setback SUPERQUADRIC masses
  // (box<->sphere<->octahedron<->pinched-star, exponents fed from the genre/species
  // vector), which — by a seeded rule — either BRANCHES into smaller offset child
  // towers (a Y-branching arcology) or FINISHES with a CURVE-SWEPT TUBE spire or a
  // LATHE cupola, plus greebled superquadric bumps hugging the base facade. The
  // result is a recognizable city STAGE, far more varied + curvy + de-squared, at a
  // handful of draw calls (every module batches into one InstancedMesh per family).
  // Mobile budget: grammar depth capped, module counts bounded, geometries shared.
  function buildCity() {
    const clampS = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const bodyT = traits.body || {};
    // a deterministic per-seed shaping scalar so even minimal traits vary organically.
    const shapeSeed = ihash((seed ^ 0x9e3779b1) >>> 0) / 4294967296;
    // #3 per-genre GRAMMAR ARCHETYPE (towers/spires/domes/organic/ziggurat/arcology):
    // reshapes the whole silhouette family + finisher mix + signature module. The
    // classic 'towers' archetype leaves the knobs null -> the v15 skyline byte-for-byte.
    const archetype = pickCityGrammar(traits, seed);
    const G = CITY_GRAMMAR[archetype] || CITY_GRAMMAR.towers;
    group.userData.cityGrammar = archetype;
    // ROUNDNESS (box<->blob), VERTICALITY (stack height), GREEBLE, BRANCH probability
    // — archetype override first, else the species body-plan / skin, else the seed scalar.
    const roundness = G.round != null ? G.round
      : bodyT.bodyShape === "blob" ? 0.85
      : bodyT.bodyShape === "wedge" ? 0.14 : bodyT.bodyShape === "triangle" ? 0.28
      : traits.skin === "glass" ? 0.7 : traits.skin === "chrome" ? 0.55
      : traits.skin === "matte" ? 0.32 : 0.3 + shapeSeed * 0.45;
    const verticality = clampS(G.vert != null ? G.vert
      : (bodyT.height != null ? (bodyT.height - 1) / 2.8 : 0.5) * 0.7 + shapeSeed * 0.3);
    const greebleAmt = clampS(bodyT.asymmetry != null ? bodyT.asymmetry : 0.35 + shapeSeed * 0.5);
    const branchP = clampS(G.branch != null ? G.branch
      : 0.16 + (bodyT.segments != null ? (bodyT.segments - 1) / 3 : 0.35) * 0.4 + roundness * 0.12);

    // ---- SUPERQUADRIC mass palette (exponents pulled toward the genre roundness) --
    const NV = 6, massVariants = [];
    for (let v = 0; v < NV; v++) {
      const base = 0.12 + roundness * 0.9;                 // 0.12 (box) .. ~1.0 (round)
      let e1 = base * (0.6 + (v / NV) * 1.1), e2 = base * (0.6 + ((NV - 1 - v) / NV) * 1.1);
      if (v === NV - 1) { e1 = 1.7 + roundness * 0.8; e2 = 0.5; }   // pinched-star accent
      else if (v === NV - 2) { e1 = 1.55; e2 = 1.55; }             // octahedron-ish accent
      e1 = Math.max(0.1, Math.min(3, e1)); e2 = Math.max(0.1, Math.min(3, e2));
      massVariants.push({ geo: boxNorm(gk.sq(e1, e2, 12)), e1, e2 });
    }
    // ---- CURVE-SWEPT tube spire palette (near-straight / S-curve / leaning) -------
    const spireCurve = (k) => k === 0
      ? [[0, 0, 0], [0.02, 0.35, 0.0], [-0.03, 0.7, 0.02], [0, 1.05, 0]]
      : k === 1
        ? [[0, 0, 0], [0.12, 0.3, 0.05], [-0.12, 0.62, -0.04], [0.05, 1.0, 0.02]]
        : [[0, 0, 0], [0.08, 0.28, 0.0], [0.18, 0.6, 0.05], [0.28, 0.95, 0.08]];
    const spireVariants = [];
    for (let v = 0; v < 3; v++) {
      spireVariants.push(normGeo(gk.tube(spireCurve(v), { radius: 0.06, radialSegments: 6, tubularSegments: 14 })));
    }
    // ---- LATHE cupola (a rounded rotunda topper) + greeble superquadric bump ------
    const cupolaGeo = boxNorm(gk.lathe([[0, 0], [0.35, 0.02], [0.5, 0.2], [0.42, 0.42], [0.22, 0.64], [0.08, 0.82], [0, 0.88]], 10));
    const greebleGeo = boxNorm(gk.sq(0.3, 0.3, 8));

    // ---- ARCHETYPE SIGNATURE module — the per-genre tell (one extra family) --------
    // domes: a low hemisphere rotunda. ziggurat: merged stepped terraces. organic: a
    // very-round blob pod. arcology: a tube strut/buttress. Only built when selected.
    let sigGeo = null, sigPrim = "sq", sigHigh = 0.8;
    if (G.sig === "dome") { sigGeo = boxNorm(gk.lathe([[0, 0], [0.5, 0.0], [0.5, 0.06], [0.44, 0.3], [0.28, 0.52], [0.0, 0.6]], 12)); sigPrim = "lathe"; sigHigh = 0.7; }
    else if (G.sig === "zig") { sigGeo = zigguratGeo(); sigPrim = "box"; sigHigh = 1.4; }
    else if (G.sig === "blob") { sigGeo = boxNorm(gk.sq(1.55, 1.55, 12)); sigPrim = "sq"; sigHigh = 1.1; }
    else if (G.sig === "bridge") { sigGeo = normGeo(gk.tube([[0, 0, 0], [0.05, 0.5, 0.02], [0.0, 1.0, 0.0]], { radius: 0.1, radialSegments: 6, tubularSegments: 8 })); sigPrim = "tube"; sigHigh = 0.9; }

    // ---- module slots (batched into one InstancedMesh per family, few draws) ------
    const massSlots = massVariants.map(() => []);
    const spireSlots = spireVariants.map(() => []);
    const greebleSlots = [], cupolaSlots = [], sigSlots = [], towerSlots = [], bldgTops = [];
    const pickMass = () => (rand() < roundness ? Math.floor(rand() * Math.ceil(NV / 2)) : Math.floor(rand() * NV));
    const MAXD = 2;   // grammar recursion cap (mobile budget)

    // the recursive production: a trunk of setback superquadric masses, then a seeded
    // BRANCH (child towers) OR FINISH (spire / cupola), plus base greebles at depth 0.
    function grow(x, z, w, d, baseY, h, rot, depth) {
      let y = baseY, cw = w, cd = d;
      const nStack = 1 + Math.floor(rand() * (1.4 + verticality * 2.4 + roundness * 0.6));   // 1..~4
      for (let s = 0; s < nStack; s++) {
        const mv = pickMass();
        const segh = (h / nStack) * (0.75 + rand() * 0.6);
        massSlots[mv].push({ x, y, z, w: cw, h: segh, d: cd, r: rot + (rand() - 0.5) * 0.25 });
        y += segh * (0.8 + rand() * 0.14);                 // slight overlap so masses fuse
        cw *= 0.68 + rand() * 0.2; cd *= 0.68 + rand() * 0.2;   // setback
      }
      if (depth < MAXD && rand() < branchP && h > 5) {
        const nb = 1 + (rand() < 0.45 ? 1 : 0);
        for (let b = 0; b < nb; b++) {
          const ang = rand() * TAU, off = (cw + cd) * 0.35;
          grow(x + Math.cos(ang) * off, z + Math.sin(ang) * off, cw * 0.7, cd * 0.7, y * 0.96, h * 0.5, rot + (rand() - 0.5) * 0.6, depth + 1);
        }
      } else {
        // FINISH: spire / cupola / archetype-signature, weighted per archetype.
        const tr = rand();
        if (tr < G.wSpire) {
          const sv = Math.floor(rand() * spireVariants.length);
          spireSlots[sv].push({ x, y, z, w: Math.max(0.4, cw * 0.6), h: 1.6 + rand() * 4.5 + verticality * 3, d: Math.max(0.4, cd * 0.6), r: rot, rx: (rand() - 0.5) * 0.15, rz: (rand() - 0.5) * 0.15 });
        } else if (tr < G.wSpire + G.wCupola) {
          cupolaSlots.push({ x, y, z, w: cw * 1.15, h: Math.max(0.6, cw * 0.9), d: cd * 1.15, r: rot });
        } else if (sigGeo && tr < G.wSpire + G.wCupola + G.wSig) {
          sigSlots.push({ x, y, z, w: cw * 1.1, h: Math.max(0.6, cw * sigHigh), d: cd * 1.1, r: rot });
        }
      }
      if (depth === 0) {
        const ng = Math.floor(rand() * (1 + greebleAmt * 5));
        for (let k = 0; k < ng; k++) {
          const ga = rand() * TAU, grad = Math.max(w, d) * 0.5;
          greebleSlots.push({ x: x + Math.cos(ga) * grad * 0.92, y: 0.5 + rand() * Math.max(0.6, h * 0.55), z: z + Math.sin(ga) * grad * 0.92, w: 0.25 + rand() * 0.5, h: 0.25 + rand() * 0.55, d: 0.25 + rand() * 0.5, r: ga });
        }
      }
    }

    // ---- the lots: ~16% keep the BAKED-WINDOW box tower (readable windows), the
    // rest are GROWN by the grammar. All heights feed the beacon/window light field.
    const TOTAL = 44;
    for (let i = 0; i < TOTAL; i++) {
      const lot = { x: -34 + rand() * 68, z: -6 - rand() * 40, w: 1.4 + rand() * 2.4, h: 3 + rand() * 15, r: rand() * TAU };
      lot.d = lot.w * (0.7 + rand() * 0.6);
      bldgTops.push({ x: lot.x, z: lot.z, h: lot.h });
      if (rand() < G.boxPct) towerSlots.push(lot);
      else grow(lot.x, lot.z, lot.w, lot.d, 0, lot.h, lot.r, 0);
    }

    // ---- realize the module slots into InstancedMeshes (one draw per family) ------
    // per-family hue offset so the masses glow slightly different tints from accent.
    const hueOff = (salt) => salt * 41 + (rand() - 0.5) * 22;
    const addMesh = (family, prim, geo, list, receive) => {
      if (!list.length) return;
      const mat = buildingMat(acc.h + hueOff(prim === "sq" ? 1 : prim === "tube" ? 5 : prim === "lathe" ? 8 : 2));
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      // family name carries the archetype prefix so two genres' building family-SETS
      // are obviously disjoint (per-genre variety is legible to the integration + tests).
      mesh.name = "buildings"; mesh.userData.family = archetype + ":" + family; mesh.userData.prim = prim;
      shadow(mesh, true, receive !== false);
      for (let i = 0; i < list.length; i++) placeMod(mesh, i, list[i]);
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh); flicker.push(mat);
    };
    // baked-window box towers (kept as a minority — the readable-windows silhouette).
    const boxVariants = Math.min(3, Math.max(1, towerSlots.length)), boxPer = Math.ceil(towerSlots.length / boxVariants);
    for (let v = 0; v < boxVariants; v++) {
      const list = towerSlots.slice(v * boxPer, (v + 1) * boxPer);
      if (!list.length) continue;
      const mat = buildingMat();
      const mesh = new THREE.InstancedMesh(towerGeo(v), mat, list.length);
      mesh.name = "buildings"; mesh.userData.family = archetype + ":tower"; mesh.userData.prim = "box";
      shadow(mesh, true, true);
      for (let i = 0; i < list.length; i++) placeBuilding(mesh, i, list[i]);
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh); flicker.push(mat);
    }
    massVariants.forEach((mv, v) => addMesh("mass" + v, "sq", mv.geo, massSlots[v], true));
    spireVariants.forEach((geo, v) => addMesh("spire" + v, "tube", geo, spireSlots[v], false));
    addMesh("cupola", "lathe", cupolaGeo, cupolaSlots, false);
    addMesh("greeble", "sq", greebleGeo, greebleSlots, false);
    if (sigGeo) addMesh("sig-" + G.sig, sigPrim, sigGeo, sigSlots, sigPrim !== "tube");

    // ---- blinking beacon / window lights -------------------------------
    // A light field: roof beacons + facade "windows" climbing many buildings, plus a
    // low scatter of street lights. Each light gets a seeded blink profile.
    const lights = [];
    for (const b of bldgTops) {
      const top = b.h;
      if (b.h > 4 && rand() < 0.85 && lights.length < 240) {
        lights.push(makeLight(b.x, top + 0.15 + rand() * 0.4, b.z, 0.18 + rand() * 0.12, "beacon"));
      }
      const nWin = Math.min(4, Math.floor(rand() * 5));
      for (let k = 0; k < nWin && lights.length < 240; k++) {
        const fy = 1 + rand() * (top - 1.2);
        lights.push(makeLight(b.x + (rand() - 0.5) * 2.4, fy, b.z + 1.4, 0.1 + rand() * 0.08, "window"));
      }
    }
    for (let i = 0; i < 26 && lights.length < 240; i++) {
      lights.push(makeLight(-32 + rand() * 64, 0.4 + rand() * 0.6, -4 - rand() * 40, 0.12 + rand() * 0.08, "beacon"));
    }
    buildLights(lights);

    // ---- foliage (street trees / alien fronds) -------------------------
    buildFoliage(34, () => ({
      x: -40 + rand() * 80,
      z: (rand() < 0.5 ? -2 - rand() * 6 : -8 - rand() * 34),   // some near-front on the flanks
      s: 0.7 + rand() * 1.3,
    }));
  }
  // place a grammar MODULE (base at y=0 geometry) at its world y with y-rot + tilt.
  // Curved-aware: on the sphere the module foot-plants on terrain and rises along the
  // local outward normal (a tower climbs local-up), oriented to the surface.
  function placeMod(mesh, i, m) {
    emit(mesh, i, m.x, m.y || 0, m.z, m.w, m.h, m.d == null ? m.w : m.d, m.r || 0, m.rx || 0, m.rz || 0);
  }
  // a building material: dark genre-tinted wall with a faint emissive breath.
  function buildingMat(hue) {
    const h = hue == null ? acc.h : hue;
    return styleMat({
      vertexColors: true, flatShading: true,
      color: colHSL(THREE, h, 0.22, 0.30),
      emissive: colHSL(THREE, h, 0.55, 0.35),
      emissiveIntensity: 0.12 + glow * 0.22,
    });
    // (vertexColors on a geometry without a color attr just falls back to color.)
  }
  function placeBuilding(mesh, i, b) {
    emit(mesh, i, b.x, 0, b.z, b.w, b.h, b.d || b.w, b.r);   // base plants on ground/terrain
  }
  // stepped ziggurat: four shrinking stacked slabs merged into one geometry.
  function zigguratGeo() {
    const steps = 4, geos = [];
    for (let i = 0; i < steps; i++) {
      const w = 1 - i * 0.2;
      const g = new THREE.BoxGeometry(w, 1 / steps, w);
      g.translate(0, (i + 0.5) / steps, 0);
      geos.push(g);
    }
    return normGeo(mergeGeos(geos));
  }

  // a unit tower box (base at y=0) with a window grid baked into vertex colors.
  function towerGeo(salt) {
    const cols = 3, rows = 8;
    const geo = new THREE.BoxGeometry(1, 1, 1, cols, rows, cols).toNonIndexed();
    const pos = geo.attributes.position;
    const nTri = pos.count / 3;
    const colors = new Float32Array(pos.count * 3);
    const wallHue = 215 + salt * 25 + rand() * 20;
    const wall = colHSL(THREE, wallHue, 0.22, 0.16 + rand() * 0.05);
    const litPct = 42 + Math.floor(rand() * 22);
    const winWarm = glow < 0.5;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const N = new THREE.Vector3(), AB = new THREE.Vector3(), AC = new THREE.Vector3();
    for (let t = 0; t < nTri; t++) {
      const i0 = t * 3;
      A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i0 + 1); C.fromBufferAttribute(pos, i0 + 2);
      const cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3;
      AB.subVectors(B, A); AC.subVectors(C, A); N.crossVectors(AB, AC).normalize();
      let col;
      if (Math.abs(N.y) > 0.5) {
        col = cy > 0 ? colHSL(THREE, acc.h, acc.s * 0.5, 0.22) : wall.clone().multiplyScalar(0.5);
      } else {
        const horiz = Math.abs(N.x) > Math.abs(N.z) ? cz : cx;
        const cCol = Math.min(cols - 1, Math.max(0, Math.floor((horiz + 0.5) * cols)));
        const cRow = Math.min(rows - 1, Math.max(0, Math.floor((cy + 0.5) * rows)));
        const sideId = N.x > 0 ? 0 : N.x < 0 ? 1 : N.z > 0 ? 2 : 3;
        const cell = ihash(((cRow * 73856093) ^ (cCol * 19349663) ^ (sideId * 83492791) ^ (salt * 2654435761)) | 0);
        if (cell % 100 < litPct) {
          const wl = 0.5 + ((cell >>> 8) % 40) / 100;
          col = winWarm ? colHSL(THREE, 44, 0.85, wl) : colHSL(THREE, (acc.h + 180) % 360, 0.8, wl * 0.85);
        } else {
          col = wall;
        }
      }
      for (let k = 0; k < 3; k++) { const b = (i0 + k) * 3; colors[b] = col.r; colors[b + 1] = col.g; colors[b + 2] = col.b; }
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return normGeo(geo);
  }

  // ============================ FARM ====================================
  function buildFarm() {
    // ---- varied crops: three families over the tilled rows ------------
    const NX = 18, NZ = 7, rowGap = 2.6, colGap = 1.7;
    const cropCount = NX * NZ;
    const stalkGeo = normGeo(new THREE.ConeGeometry(0.34, 1, 5));     // bushy stalk
    const bushGeo = normGeo(new THREE.IcosahedronGeometry(0.5, 0));    // round bush
    const cornGeo = normGeo(new THREE.CylinderGeometry(0.12, 0.16, 1, 5)); // tall corn
    const mkCropMat = (h, s, l) => styleMat({
      color: colHSL(THREE, h, s, l),
      emissive: colHSL(THREE, h, 0.4, 0.12), emissiveIntensity: 0.2 + glow * 0.2,
    });
    const stalkMat = mkCropMat(95 + rand() * 25, 0.55, 0.34);
    const bushMat = mkCropMat(120 + rand() * 30, 0.5, 0.30);
    const cornMat = mkCropMat(70 + rand() * 20, 0.6, 0.38);
    const stalk = new THREE.InstancedMesh(stalkGeo, stalkMat, cropCount);
    const bush = new THREE.InstancedMesh(bushGeo, bushMat, cropCount);
    const corn = new THREE.InstancedMesh(cornGeo, cornMat, cropCount);
    stalk.name = "crops"; stalk.userData.family = "stalk";
    bush.name = "crops"; bush.userData.family = "bush";
    corn.name = "crops"; corn.userData.family = "corn";
    shadow(stalk, true, false); shadow(bush, true, true); shadow(corn, true, false);
    let si = 0, bi = 0, ni = 0;
    for (let r = 0; r < NZ; r++) {
      for (let c = 0; c < NX; c++) {
        const jx = (rand() - 0.5) * 0.4, jz = (rand() - 0.5) * 0.4;
        const x = (c - (NX - 1) / 2) * colGap + jx;
        const z = -5 - r * rowGap + jz;
        const pick = rand();
        const yaw = rand() * Math.PI;
        if (pick < 0.5) {
          const h = 0.7 + rand() * 0.9;
          emit(stalk, si++, x, 0, z, 0.7 + rand() * 0.5, h, 0.7 + rand() * 0.5, yaw);
        } else if (pick < 0.8) {
          const h = 0.6 + rand() * 0.6;
          emit(bush, bi++, x, 0, z, 0.8 + rand() * 0.5, h, 0.8 + rand() * 0.5, yaw);
        } else {
          const h = 1.4 + rand() * 1.1;
          emit(corn, ni++, x, 0, z, 0.8 + rand() * 0.4, h, 0.8 + rand() * 0.4, yaw);
        }
      }
    }
    stalk.count = si; bush.count = bi; corn.count = ni;
    for (const cm of [stalk, bush, corn]) {
      cm.instanceMatrix.needsUpdate = true;
      if (cm.count > 0) { group.add(cm); swayers.push({ mesh: cm, sx: 0.05, sz: 0.05, px: rand() * TAU }); }
    }

    // ---- silos with conical roofs -------------------------------------
    const NSILO = 5;
    const siloGeo = normGeo(new THREE.CylinderGeometry(0.9, 0.9, 1, 8));
    const roofGeo = normGeo(new THREE.ConeGeometry(1.05, 0.5, 8));
    const siloMat = styleMat({ color: colHSL(THREE, 30, 0.15, 0.55) });
    const roofMat = styleMat({ color: colHSL(THREE, acc.h, 0.5, 0.4) });
    const silos = new THREE.InstancedMesh(siloGeo, siloMat, NSILO);
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, NSILO);
    silos.name = "silos"; roofs.name = "silo-roofs"; roofs.userData.family = "silo-roof";
    shadow(silos, true, true); shadow(roofs, true, false);
    for (let i = 0; i < NSILO; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 3 + rand() * 2.5, w = 1 + rand() * 0.4;
      const x = side * (12 + rand() * 8), z = -8 - rand() * 18;
      emit(silos, i, x, 0, z, w, h, w, 0);
      emit(roofs, i, x, h, z, w, 1, w, 0);
    }
    silos.instanceMatrix.needsUpdate = true; roofs.instanceMatrix.needsUpdate = true;
    group.add(silos); group.add(roofs);

    // ---- tree-lines along the field edges -----------------------------
    buildFoliage(26, () => {
      const side = rand() < 0.5 ? -1 : 1;
      return { x: side * (16 + rand() * 22), z: -2 - rand() * 40, s: 1.0 + rand() * 1.6 };
    });

    // ---- a few blinking fireflies / barn lights -----------------------
    const fireflies = [];
    for (let i = 0; i < 22; i++) {
      fireflies.push(makeLight(-30 + rand() * 60, 0.6 + rand() * 2.4, -4 - rand() * 34, 0.09 + rand() * 0.06, "firefly"));
    }
    buildLights(fireflies);
  }

  // ============================ FOLIAGE =================================
  // Low-poly plants: brown trunk cylinders + tinted canopy cones (leafy scenes)
  // or spiky alien fronds (electronic scenes). Two InstancedMeshes -> 2 draws.
  function buildFoliage(count, placer) {
    const trunkGeo = normGeo(new THREE.CylinderGeometry(0.08, 0.13, 1, 5));
    const canopyGeo = leafy
      ? normGeo(new THREE.ConeGeometry(0.5, 1, 6))            // rounded-ish leaf cone
      : normGeo(new THREE.ConeGeometry(0.4, 1, 4));           // sharp alien frond
    const trunkMat = styleMat({ color: colHSL(THREE, 28, 0.45, 0.22) });
    const canHue = leafy ? 110 + rand() * 30 : acc.h + 30;
    const canopyMat = styleMat({
      color: colHSL(THREE, canHue, leafy ? 0.55 : 0.6, leafy ? 0.32 : 0.42),
      emissive: colHSL(THREE, canHue, 0.5, leafy ? 0.08 : 0.2), emissiveIntensity: leafy ? 0.12 : 0.2 + glow * 0.2,
    });
    const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    trunk.name = "foliage-trunk"; trunk.userData.family = "foliage";
    canopy.name = "foliage-canopy"; canopy.userData.family = "foliage";
    shadow(trunk, true, false); shadow(canopy, true, true);   // canopies catch trunk/neighbour shade
    for (let i = 0; i < count; i++) {
      const P = placer();
      const th = (0.5 + rand() * 0.7) * P.s;               // trunk height
      const ch = (1.0 + rand() * 1.4) * P.s;               // canopy height
      const cw = (0.7 + rand() * 0.8) * P.s;               // canopy width
      const yaw = rand() * TAU;
      emit(trunk, i, P.x, 0, P.z, 0.7 * P.s, th, 0.7 * P.s, yaw);
      emit(canopy, i, P.x, th, P.z, cw, ch, cw, yaw);
    }
    trunk.instanceMatrix.needsUpdate = true; canopy.instanceMatrix.needsUpdate = true;
    group.add(trunk); group.add(canopy);
    swayers.push({ mesh: canopy, sx: 0.04, sz: 0.06, px: rand() * TAU });
  }

  // ============================ LIGHTS ==================================
  // A single instanced-color mesh of small glowing octahedra. Each light carries
  // a seeded blink profile; update(dt) rewrites per-instance colors so the
  // skyline BLINKS (real animated emissive values, not a whole-material breath).
  function makeLight(x, y, z, scale, kind2) {
    // choose a neon-ish base colour.
    const roll = rand();
    let h;
    if (kind2 === "firefly") h = 70 + rand() * 30;                       // warm yellow-green
    else if (roll < 0.34) h = 44 + rand() * 10;                          // warm window amber
    else if (roll < 0.67) h = acc.h + (rand() - 0.5) * 20;               // accent neon
    else h = (acc.h + 180) % 360 + (rand() - 0.5) * 30;                  // complementary neon
    const base = colHSL(THREE, h, 0.9, 0.6);
    // blink profile: 0 steady, 1 hard blink (square), 2 soft pulse (sine).
    const tRoll = rand();
    const type = kind2 === "window" ? (tRoll < 0.55 ? 0 : tRoll < 0.85 ? 2 : 1)
      : kind2 === "firefly" ? 2
      : (tRoll < 0.4 ? 0 : tRoll < 0.75 ? 1 : 2);
    return {
      x, y, z, scale,
      r: base.r, g: base.g, b: base.b,
      type,
      phase: rand(),                       // 0..1 offset
      period: 0.4 + rand() * 2.2,          // seconds per blink cycle
      lo: 0.12 + rand() * 0.1,             // dim floor
      hi: 0.75 + rand() * 0.25,            // bright ceiling
    };
  }
  function buildLights(list) {
    if (!list.length) return;
    const geo = new THREE.OctahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.name = "beacons"; mesh.userData.family = "lights";
    for (let i = 0; i < list.length; i++) {
      const L = list[i];
      emit(mesh, i, L.x, L.y, L.z, L.scale, L.scale, L.scale, 0);
      _c.setRGB(L.r * L.hi, L.g * L.hi, L.b * L.hi);
      mesh.setColorAt(i, _c);                 // seed instanceColor so it exists pre-update
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    beacons = { mesh, meta: list };
  }

  // ============================ ABSTRACT WORLD ==========================
  // #4/#5/#6: the peripheral environment that turns the shared stage into a
  // genre-specific abstract PLANET. Every world is a handful of InstancedMeshes
  // of NON-BOX forms — spheres, torus rings, curved tendril arcs, faceted shards,
  // domes, arches, tapered spires — placed in a wide ring AROUND the band so the
  // little city reads as a settlement inside a wild alien world. Balls of light
  // (orbs) are the signature scattered through every world for deep contrast.

  // scatter — one InstancedMesh of a shape family; placer(i) -> a transform.
  // Euler rotation (rx,ry,rz) so rings/tendrils can tilt; cheap, few draw calls.
  function scatter(name, family, geo, mat, count, placer, cast, receive) {
    if (count <= 0 || !geo) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.name = name; mesh.userData.family = family;
    shadow(mesh, cast !== false, !!receive);
    for (let i = 0; i < count; i++) {
      const P = placer(i) || {};
      const w = P.w == null ? 1 : P.w;
      emit(mesh, i, P.x || 0, P.y || 0, P.z || 0, w, P.h == null ? w : P.h, P.d == null ? w : P.d, P.ry || 0, P.rx || 0, P.rz || 0);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  }
  // a lit + shadowed world surface in the active render-style, genre-tinted with a
  // real emissive breath (contrast law): deep body colour, bright emissive rim.
  function structMat(hue, sat, light, emiSat, emiLight, emiInt) {
    return styleMat({
      flatShading: true,
      color: colHSL(THREE, hue, sat, light),
      emissive: colHSL(THREE, hue, emiSat == null ? 0.7 : emiSat, emiLight == null ? 0.4 : emiLight),
      emissiveIntensity: emiInt == null ? 0.18 + glow * 0.32 : emiInt,
    });
  }
  // a peripheral position in a wide arc BEHIND/AROUND the stage, dodging the
  // central band pocket so the little city stays legible in front.
  function farPlace() {
    let x = 0, z = -20;
    for (let k = 0; k < 4; k++) {
      x = -56 + rand() * 112;
      z = -10 - rand() * 66;
      if (!(Math.abs(x) < 10 && z > -16)) break;
    }
    return { x, z };
  }
  // stage a glowing ball of light for the shared orb field (unlit, bright, pulsing).
  function pushOrb(x, y, z, scale, hue, sat, light) {
    const c = colHSL(THREE, hue, sat == null ? 0.9 : sat, light == null ? 0.62 : light);
    orbList.push({
      x, y, z, scale, r: c.r, g: c.g, b: c.b,
      phase: rand(), period: 1.0 + rand() * 3.0,
      lo: 0.45 + rand() * 0.2, hi: 0.9 + rand() * 0.3,
    });
  }

  function buildWorld(w) {
    switch (w) {
      case "ringworld": return buildRingworld();
      case "crystalfield": return buildCrystalfield();
      case "tendrilforest": return buildTendrilforest();
      case "liquidsea": return buildLiquidsea();
      case "cloudsea": return buildCloudsea();
      case "moltenvoid": return buildMoltenvoid();
      case "spiregarden": return buildSpiregarden();
      default: return buildGeomvoid();
    }
  }

  // RADIAL genres — floating tilted RINGS + tall pylons + hub orbs.
  function buildRingworld() {
    const ringGeo = new THREE.TorusGeometry(0.5, 0.08, 6, 20);
    scatter("world-ring", "ring", ringGeo,
      structMat(acc.h, 0.5, 0.34, 0.7, 0.42, 0.28 + glow * 0.4), 16, () => {
        const P = farPlace(), w = 3 + rand() * 7;
        return { x: P.x, y: 4 + rand() * 16, z: P.z, w, h: w, d: w, rx: (rand() - 0.5) * 0.9, ry: rand() * TAU, rz: (rand() - 0.5) * 0.9 };
      }, true, false);
    const pyGeo = normGeo(new THREE.CylinderGeometry(0.16, 0.32, 1, 6));
    scatter("world-pylon", "pylon", pyGeo,
      structMat(acc.h + 40, 0.4, 0.3, 0.6, 0.36), 14, () => {
        const P = farPlace();
        return { x: P.x, y: 0, z: P.z, w: 0.8 + rand() * 1.2, h: 6 + rand() * 14, d: 0.8 + rand() * 1.2, ry: rand() * TAU };
      }, true, true);
    for (let i = 0; i < 12; i++) { const P = farPlace(); pushOrb(P.x, 4 + rand() * 16, P.z, 0.5 + rand() * 0.7, (acc.h + 180) % 360, 0.9, 0.62); }
  }

  // CRYSTALLINE genres — tall faceted SHARDS + spikes + gem orbs.
  function buildCrystalfield() {
    const shardGeo = normGeo(new THREE.OctahedronGeometry(0.6, 0));
    scatter("world-shard", "shard", shardGeo,
      structMat(acc.h + 120, 0.55, 0.32, 0.85, 0.46, 0.3 + glow * 0.4), 20, () => {
        const P = farPlace();
        return { x: P.x, y: 0, z: P.z, w: 1 + rand() * 2.5, h: 6 + rand() * 18, d: 1 + rand() * 2.5, ry: rand() * TAU, rz: (rand() - 0.5) * 0.3 };
      }, true, true);
    const spikeGeo = normGeo(new THREE.ConeGeometry(0.4, 1, 5));
    scatter("world-spike", "spike", spikeGeo,
      structMat(acc.h + 160, 0.6, 0.4, 0.9, 0.5), 16, () => {
        const P = farPlace();
        return { x: P.x, y: 0, z: P.z, w: 0.6 + rand() * 1.4, h: 4 + rand() * 12, d: 0.6 + rand() * 1.4 };
      }, true, false);
    for (let i = 0; i < 14; i++) { const P = farPlace(); pushOrb(P.x, 1 + rand() * 10, P.z, 0.35 + rand() * 0.5, (acc.h + 150) % 360, 0.95, 0.6); }
  }

  // INSECTOID / ORGANIC / FARM — curved TENDRIL arcs + soft mounds + warm orbs.
  function buildTendrilforest() {
    const tendGeo = new THREE.TorusGeometry(0.5, 0.09, 6, 16, Math.PI * 1.2);
    scatter("world-tendril", "tendril", tendGeo,
      structMat(acc.h + 30, 0.5, 0.3, 0.6, 0.36, 0.2 + glow * 0.3), 18, () => {
        const P = farPlace(), h = 4 + rand() * 12;
        return { x: P.x, y: h * 0.5, z: P.z, w: 1.2 + rand() * 1.8, h, d: 1.2 + rand() * 1.8, rx: Math.PI * 0.5, ry: rand() * TAU, rz: (rand() - 0.5) * 0.6 };
      }, true, false);
    const domeGeo = normGeo(new THREE.SphereGeometry(0.5, 10, 6, 0, TAU, 0, Math.PI / 2));
    scatter("world-mound", "mound", domeGeo,
      structMat(acc.h + 80, 0.45, 0.28, 0.4, 0.22), 12, () => {
        const P = farPlace();
        return { x: P.x, y: 0, z: P.z, w: 4 + rand() * 8, h: 1.5 + rand() * 3, d: 4 + rand() * 8 };
      }, true, true);
    for (let i = 0; i < 12; i++) { const P = farPlace(); pushOrb(P.x, 3 + rand() * 10, P.z, 0.3 + rand() * 0.4, 80 + rand() * 40, 0.85, 0.62); }
  }

  // CEPHALOPOD — a reflective SEA sheet + floating bubbles + big orbs.
  function buildLiquidsea() {
    const seaMat = new THREE.MeshLambertMaterial({
      color: colHSL(THREE, acc.h + 180, 0.5, 0.12), transparent: true, opacity: 0.55, flatShading: true,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), seaMat);
    sea.rotation.x = -Math.PI / 2; sea.position.y = 0.06; sea.name = "world-sea"; sea.receiveShadow = true;
    group.add(sea);
    const bubGeo = new THREE.SphereGeometry(0.5, 12, 8);
    scatter("world-bubble", "bubble", bubGeo,
      structMat(acc.h + 180, 0.4, 0.4, 0.6, 0.42, 0.2 + glow * 0.4), 22, () => {
        const P = farPlace();
        return { x: P.x, y: 1 + rand() * 14, z: P.z, w: 0.8 + rand() * 3 };
      }, false, false);
    for (let i = 0; i < 16; i++) { const P = farPlace(); pushOrb(P.x, 1 + rand() * 12, P.z, 0.4 + rand() * 0.8, (acc.h + 180) % 360, 0.9, 0.66); }
  }

  // FLOATING-GAS / GLASS — high floating gas SPHERES + faint rings + sky orbs.
  function buildCloudsea() {
    const cloudGeo = new THREE.IcosahedronGeometry(0.6, 1);
    scatter("world-cloud", "cloud", cloudGeo,
      structMat(acc.h, 0.35, 0.5, 0.5, 0.46, 0.25 + glow * 0.5), 20, () => {
        const P = farPlace();
        return { x: P.x, y: 6 + rand() * 20, z: P.z, w: 2 + rand() * 6, h: 1.5 + rand() * 4, d: 2 + rand() * 6 };
      }, false, false);
    const ringGeo = new THREE.TorusGeometry(0.5, 0.06, 6, 18);
    scatter("world-ring", "ring", ringGeo,
      structMat((acc.h + 60) % 360, 0.5, 0.5, 0.7, 0.5), 10, () => {
        const P = farPlace(), w = 4 + rand() * 6;
        return { x: P.x, y: 8 + rand() * 16, z: P.z, w, h: w, d: w, rx: rand() * TAU, ry: rand() * TAU };
      }, false, false);
    for (let i = 0; i < 18; i++) { const P = farPlace(); pushOrb(P.x, 5 + rand() * 18, P.z, 0.4 + rand() * 0.7, acc.h, 0.8, 0.7); }
  }

  // AMORPHOUS / MATTE — lumpy BLOB mounds + jagged spurs + half-buried lava orbs.
  function buildMoltenvoid() {
    const blobGeo = normGeo(new THREE.IcosahedronGeometry(0.7, 0));
    scatter("world-blob", "blob", blobGeo,
      structMat(acc.h, 0.4, 0.22, 0.9, 0.36, 0.2 + glow * 0.3), 16, () => {
        const P = farPlace();
        return { x: P.x, y: 0, z: P.z, w: 3 + rand() * 7, h: 2 + rand() * 6, d: 3 + rand() * 7, ry: rand() * TAU };
      }, true, true);
    const spurGeo = normGeo(new THREE.ConeGeometry(0.5, 1, 3));
    scatter("world-spur", "spur", spurGeo,
      structMat((acc.h + 20) % 360, 0.5, 0.28, 0.85, 0.42), 12, () => {
        const P = farPlace();
        return { x: P.x, y: 0, z: P.z, w: 1.5 + rand() * 3, h: 3 + rand() * 8, d: 1.5 + rand() * 3, ry: rand() * TAU, rz: (rand() - 0.5) * 0.4 };
      }, true, false);
    for (let i = 0; i < 18; i++) { const P = farPlace(); pushOrb(P.x, 0.3 + rand() * 3, P.z, 0.4 + rand() * 0.9, 12 + rand() * 30, 1.0, 0.55); }
  }

  // STALK — spindly tall SPIRES + floating bulbs + arches + high orbs.
  function buildSpiregarden() {
    const spireGeo = normGeo(new THREE.CylinderGeometry(0.06, 0.16, 1, 6));
    scatter("world-stalk", "stalk", spireGeo,
      structMat(acc.h, 0.4, 0.34, 0.6, 0.4, 0.2 + glow * 0.3), 20, () => {
        const P = farPlace();
        return { x: P.x, y: 0, z: P.z, w: 0.5 + rand() * 1, h: 8 + rand() * 18, d: 0.5 + rand() * 1 };
      }, true, false);
    const bulbGeo = new THREE.SphereGeometry(0.5, 10, 7);
    scatter("world-bulb", "bulb", bulbGeo,
      structMat((acc.h + 180) % 360, 0.6, 0.5, 0.85, 0.55, 0.35 + glow * 0.4), 16, () => {
        const P = farPlace();
        return { x: P.x, y: 8 + rand() * 16, z: P.z, w: 0.8 + rand() * 1.6 };
      }, false, false);
    const archGeo = new THREE.TorusGeometry(0.5, 0.08, 6, 16, Math.PI);
    scatter("world-arch", "arch", archGeo,
      structMat((acc.h + 40) % 360, 0.45, 0.3, 0.6, 0.36), 10, () => {
        const P = farPlace(), w = 4 + rand() * 8;
        return { x: P.x, y: 0, z: P.z, w, h: w, d: w, ry: rand() * TAU };
      }, true, false);
    for (let i = 0; i < 14; i++) { const P = farPlace(); pushOrb(P.x, 6 + rand() * 14, P.z, 0.35 + rand() * 0.5, (acc.h + 180) % 360, 0.85, 0.65); }
  }

  // DEFAULT (city) — a GEOMETRIC VOID: floating disc platforms + arches + orb grid.
  function buildGeomvoid() {
    const discGeo = normGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 12));
    scatter("world-platform", "platform", discGeo,
      structMat(acc.h, 0.4, 0.3, 0.6, 0.36, 0.2 + glow * 0.35), 14, () => {
        const P = farPlace();
        return { x: P.x, y: 3 + rand() * 16, z: P.z, w: 3 + rand() * 6, h: 0.4 + rand() * 0.8, d: 3 + rand() * 6 };
      }, true, false);
    const archGeo = new THREE.TorusGeometry(0.5, 0.07, 6, 18, Math.PI);
    scatter("world-arch", "arch", archGeo,
      structMat((acc.h + 180) % 360, 0.5, 0.4, 0.7, 0.5), 12, () => {
        const P = farPlace(), w = 4 + rand() * 10;
        return { x: P.x, y: 0, z: P.z, w, h: w * 0.8, d: w, ry: (rand() - 0.5) * 0.6 };
      }, true, false);
    for (let i = 0; i < 20; i++) { const P = farPlace(); pushOrb(P.x, 2 + rand() * 16, P.z, 0.35 + rand() * 0.6, (acc.h + (rand() < 0.5 ? 0 : 180)) % 360, 0.9, 0.65); }
  }

  // ---- #3 LANDSCAPE FEATURES: the near-ground per-genre natural layer ----------
  // A distinct family of scattered GROUND features per planet — rocks / crystals /
  // dunes / arches / water / fungi / mist-pads / lava-spurs — so two genres' worlds
  // read obviously different at the surface (not just the peripheral megastructures).
  // Each type emits 2+ distinct instanced families (prefixed "land:") + a little glow,
  // all curved-surface-aware (routes through scatter -> composeAt). Counts capped.
  function landPlace() {
    let x = 0, z = -14;
    for (let k = 0; k < 4; k++) {
      x = -42 + rand() * 84; z = -3 - rand() * 46;
      if (!(Math.abs(x) < 8 && z > -14)) break;    // dodge the central band pocket
    }
    return { x, z };
  }
  function buildLandscape(kind2) {
    group.userData.landscape = kind2;
    const feat = (name, geo, mat, count, placer, cast, receive) =>
      scatter("land-" + name, "land:" + name, geo, mat, count, placer, cast !== false, !!receive);
    const glowOrbs = (n, y0, y1, sc, hue, sat, lig) => { for (let i = 0; i < n; i++) { const P = landPlace(); pushOrb(P.x, y0 + rand() * (y1 - y0), P.z, sc + rand() * sc, hue, sat, lig); } };
    switch (kind2) {
      case "crystal": {
        feat("crystal", normGeo(new THREE.OctahedronGeometry(0.5, 0)), structMat(acc.h + 130, 0.6, 0.4, 0.9, 0.5, 0.3 + glow * 0.4), 16,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 0.5 + rand() * 1.4, h: 1.5 + rand() * 4.5, d: 0.5 + rand() * 1.4, ry: rand() * TAU, rz: (rand() - 0.5) * 0.4 }; }, true, false);
        feat("geode", normGeo(new THREE.IcosahedronGeometry(0.5, 0)), structMat(acc.h + 90, 0.4, 0.28, 0.8, 0.42), 10,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 1 + rand() * 2, h: 0.6 + rand() * 1.4, d: 1 + rand() * 2, ry: rand() * TAU }; }, true, true);
        glowOrbs(8, 0.5, 2.5, 0.3, (acc.h + 150) % 360, 0.95, 0.6); break;
      }
      case "desert": {
        feat("dune", normGeo(new THREE.SphereGeometry(0.5, 10, 6, 0, TAU, 0, Math.PI / 2)), structMat(38, 0.45, 0.4, 0.3, 0.3, 0.12 + glow * 0.15), 14,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 5 + rand() * 10, h: 1 + rand() * 2.4, d: 4 + rand() * 8, ry: rand() * TAU }; }, true, true);
        feat("mesa", normGeo(new THREE.CylinderGeometry(0.5, 0.6, 1, 6)), structMat(24, 0.5, 0.34, 0.4, 0.3), 8,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 2 + rand() * 4, h: 2 + rand() * 5, d: 2 + rand() * 4, ry: rand() * TAU }; }, true, true);
        glowOrbs(6, 0.6, 2, 0.28, 34, 0.7, 0.6); break;
      }
      case "arches": {
        feat("arch", new THREE.TorusGeometry(0.5, 0.09, 6, 16, Math.PI), structMat(acc.h, 0.45, 0.34, 0.7, 0.42, 0.2 + glow * 0.3), 12,
          () => { const P = landPlace(), w = 4 + rand() * 8; return { x: P.x, y: 0, z: P.z, w, h: w * 0.85, d: w, ry: rand() * TAU }; }, true, false);
        feat("standstone", normGeo(new THREE.BoxGeometry(1, 1, 1)), structMat(acc.h + 20, 0.3, 0.28, 0.4, 0.26), 10,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 0.8 + rand() * 1.6, h: 3 + rand() * 6, d: 0.8 + rand() * 1.6, ry: rand() * TAU, rz: (rand() - 0.5) * 0.2 }; }, true, true);
        glowOrbs(8, 1, 8, 0.3, (acc.h + 180) % 360, 0.85, 0.62); break;
      }
      case "water": {
        const poolMat = new THREE.MeshLambertMaterial({ color: colHSL(THREE, acc.h + 180, 0.5, 0.16), transparent: true, opacity: 0.5, flatShading: true });
        feat("lily", new THREE.CylinderGeometry(0.5, 0.5, 0.08, 10), poolMat, 12,
          () => { const P = landPlace(); return { x: P.x, y: 0.05, z: P.z, w: 2 + rand() * 5, h: 1, d: 2 + rand() * 5 }; }, false, false);
        feat("reed", normGeo(new THREE.ConeGeometry(0.12, 1, 4)), structMat(acc.h + 120, 0.5, 0.34, 0.5, 0.34), 16,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 0.4 + rand() * 0.6, h: 1.5 + rand() * 3, d: 0.4 + rand() * 0.6, ry: rand() * TAU }; }, true, false);
        glowOrbs(10, 0.4, 3, 0.3, (acc.h + 180) % 360, 0.9, 0.66); break;
      }
      case "fungal": {
        feat("cap", boxNorm(gk.lathe([[0, 0], [0.5, 0.0], [0.48, 0.16], [0.3, 0.36], [0.0, 0.42]], 10)), structMat(acc.h + 40, 0.55, 0.36, 0.7, 0.42, 0.22 + glow * 0.3), 14,
          () => { const P = landPlace(); return { x: P.x, y: 1 + rand() * 2.5, z: P.z, w: 1.5 + rand() * 3, h: 1 + rand() * 2, d: 1.5 + rand() * 3, ry: rand() * TAU }; }, true, false);
        feat("stipe", normGeo(new THREE.CylinderGeometry(0.16, 0.22, 1, 6)), structMat(acc.h + 60, 0.3, 0.4, 0.4, 0.3), 14,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 0.5 + rand() * 0.8, h: 1 + rand() * 2.5, d: 0.5 + rand() * 0.8 }; }, true, true);
        glowOrbs(8, 0.5, 3, 0.28, 90 + rand() * 40, 0.8, 0.62); break;
      }
      case "mist": {
        feat("pad", normGeo(new THREE.IcosahedronGeometry(0.6, 1)), structMat(acc.h, 0.3, 0.55, 0.5, 0.5, 0.25 + glow * 0.4), 16,
          () => { const P = landPlace(); return { x: P.x, y: 3 + rand() * 12, z: P.z, w: 3 + rand() * 7, h: 0.8 + rand() * 2, d: 3 + rand() * 7 }; }, false, false);
        feat("wisp", new THREE.TorusGeometry(0.5, 0.05, 6, 16), structMat((acc.h + 40) % 360, 0.4, 0.55, 0.6, 0.5), 10,
          () => { const P = landPlace(), w = 2 + rand() * 4; return { x: P.x, y: 4 + rand() * 12, z: P.z, w, h: w, d: w, rx: rand() * TAU, ry: rand() * TAU }; }, false, false);
        glowOrbs(10, 4, 16, 0.32, acc.h, 0.75, 0.7); break;
      }
      case "volcanic": {
        feat("spur", normGeo(new THREE.ConeGeometry(0.5, 1, 3)), structMat((acc.h + 15) % 360, 0.5, 0.24, 0.9, 0.4, 0.2 + glow * 0.3), 14,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 1.5 + rand() * 3, h: 2.5 + rand() * 6, d: 1.5 + rand() * 3, ry: rand() * TAU, rz: (rand() - 0.5) * 0.4 }; }, true, false);
        feat("magma", normGeo(new THREE.IcosahedronGeometry(0.7, 0)), structMat(12, 0.6, 0.24, 1.0, 0.4), 10,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 2 + rand() * 5, h: 1 + rand() * 2.5, d: 2 + rand() * 5, ry: rand() * TAU }; }, true, true);
        glowOrbs(10, 0.3, 3, 0.34, 14 + rand() * 26, 1.0, 0.55); break;
      }
      default: {   // "rocky" — the default stony ground
        feat("rock", normGeo(new THREE.IcosahedronGeometry(0.6, 0)), structMat(acc.h, 0.25, 0.3, 0.4, 0.3, 0.15 + glow * 0.2), 16,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 1 + rand() * 3, h: 0.8 + rand() * 2.4, d: 1 + rand() * 3, ry: rand() * TAU, rz: (rand() - 0.5) * 0.3 }; }, true, true);
        feat("boulder", normGeo(new THREE.DodecahedronGeometry(0.6, 0)), structMat(acc.h + 20, 0.2, 0.26, 0.35, 0.26), 10,
          () => { const P = landPlace(); return { x: P.x, y: 0, z: P.z, w: 2 + rand() * 4, h: 1.5 + rand() * 3, d: 2 + rand() * 4, ry: rand() * TAU }; }, true, true);
        glowOrbs(8, 0.4, 3, 0.28, acc.h, 0.7, 0.6); break;
      }
    }
  }

  // ---- ORBS: the signature balls-of-light field (one instanced mesh) ----
  // Unlit, tone-mapping-off, per-instance colour so they read as pure light against
  // the deep-shadowed world; update() pulses each from its seeded phase/period.
  function buildOrbs(list) {
    if (!list.length) return;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    mesh.name = "orbs"; mesh.userData.family = "lightball";
    mesh.castShadow = false; mesh.receiveShadow = false;
    for (let i = 0; i < list.length; i++) {
      const L = list[i];
      emit(mesh, i, L.x, L.y, L.z, L.scale, L.scale, L.scale, 0);
      _c.setRGB(L.r * L.hi, L.g * L.hi, L.b * L.hi);
      mesh.setColorAt(i, _c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    orbs = { mesh, meta: list };
  }

  // ---- ANIMATION -------------------------------------------------------
  function update(dt) {
    clock += dt || 0;
    glitchTime.value = clock;   // drives the 'glitch' style's jitter+flicker (uniform only)
    // building skyline slow neon breath.
    if (flicker.length) {
      const f = 0.12 + glow * 0.22 + Math.sin(clock * 2.1) * 0.05;
      for (const m of flicker) m.emissiveIntensity = f;
    }
    // BLINK: rewrite each light's per-instance colour from its seeded profile.
    if (beacons) {
      const { mesh, meta } = beacons;
      for (let i = 0; i < meta.length; i++) {
        const L = meta[i];
        let b;
        if (L.type === 0) {
          b = L.hi;                                                    // steady
        } else if (L.type === 1) {
          const ph = (clock / L.period + L.phase) % 1;                 // hard blink
          b = ph < 0.5 ? L.hi : L.lo;
        } else {
          b = L.lo + (L.hi - L.lo) * (0.5 + 0.5 * Math.sin(clock * TAU / L.period + L.phase * TAU)); // soft pulse
        }
        _c.setRGB(L.r * b, L.g * b, L.b * b);
        mesh.setColorAt(i, _c);
      }
      mesh.instanceColor.needsUpdate = true;
    }
    // PULSE the balls of light (signature glow breathing, deep-contrast accent).
    if (orbs) {
      const { mesh, meta } = orbs;
      for (let i = 0; i < meta.length; i++) {
        const L = meta[i];
        const b = L.lo + (L.hi - L.lo) * (0.5 + 0.5 * Math.sin(clock * TAU / L.period + L.phase * TAU));
        _c.setRGB(L.r * b, L.g * b, L.b * b);
        mesh.setColorAt(i, _c);
      }
      mesh.instanceColor.needsUpdate = true;
    }
    // gentle wind sway across foliage / crops.
    for (const sw of swayers) {
      sw.mesh.rotation.z = Math.sin(clock * 1.3 + sw.px) * sw.sz;
      sw.mesh.rotation.x = Math.sin(clock * 0.9 + sw.px + 1) * sw.sx;
    }
  }

  return { group, update };
}

export default { makeBackdrop };
