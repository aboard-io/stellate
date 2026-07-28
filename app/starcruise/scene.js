// scene.js — THE SCENE GRAPH of the star-cruise: everything that is added to and
// removed from the THREE.Scene, in the two lifetimes it has.
//
//   PART 1 — THE LIGHT RIG        built on start(), torn down on stop()
//   PART 2 — THE PERSISTENT GALAXY  starfield + floating glyphs + one planet per
//            genre at its GENRE_COORDS + one colored sun per cluster. Whole-session:
//            built on start(), disposed on stop(), never despawned mid-flight so a
//            transit frame is never blank.
//   PART 3 — THE SURFACE          the per-landing world: the little curved ground
//            planet, the band + dancers planted on it, the sky-dome atmosphere, the
//            (empty) backdrop + ship. Rebuilt once per DOMINANT GENRE (on APPROACH,
//            so it grows in during the descent), dropped on DEPART.
//   PART 4 — THE SPACE RIG        cockpit + receding planet, up between DEPART and LAND.
//
// The controller (app/starcruise.js) owns the renderer, the camera and the RAF loop
// and calls in here; this module owns no clock and no camera. Everything is
// deterministic (seeded PRNGs only, never Math.random) and mobile-capped.
//
// CONTRACT
//   initScene({ THREE, mods, scene, getPS1 })   bind the handles (once per start())
//   buildLights() / updateLights(vclock)        the stage light rig
//   buildGalaxy() / disposeGalaxy()             the whole-session deep space
//   highlightPlanet(g) / setSunTime(t) / updateGlyphSky(dt, camera)
//   ensureSurface(genreOrWeights, dominant, seed) / despawnBand()
//   spawnSpaceRig(activeGenre) / despawnSpaceRig()
//   resetScene()                                drop the handles on stop()
//   + read-only getters (band/dancers/ground/…) for the controller and ./probes.js

// GALAXY DATA — pure static data modules (no Three, no esm.sh): the cluster->sun map
// (labels + colors + star coords) and the genre->cluster index. Safe to static-import;
// this does NOT couple the lazy Three load (those stay behind the dynamic import()).
import { CLUSTER_OF, GENRE_CLUSTERS } from "./genre-clusters.js";
// FLOATING GLYPHS — the same faint alien idents that backfloat on the 2D star map,
// as camera-facing sprites drifting in the cruise atmosphere (pure THREE, no engine
// coupling; textures baked once — no per-frame upload, per the post-planet static fix).
import { makeGlyphAtmosphere } from "../map/glyphs.js";
import { getS, K, V, buildEventPlan, rosterFor, genreLabels, genreLabelOf } from "./bridge.js";

// ---- bound handles --------------------------------------------------------------
let THREE = null;     // the vendored namespace (the controller loads it on first start())
let mods = null;      // { traitsFromGenre, makeAlien, makePS1, makeFlight, makeCockpit, … }
let scene = null;     // THE THREE.Scene (nulled in resetScene so a stopped cruise holds nothing)
let getPS1 = () => null;   // the live PS1 post pass (spawnFor pushes the genre renderStyle into it)
export function initScene(deps) {
  THREE = deps.THREE; mods = deps.mods; scene = deps.scene;
  getPS1 = deps.getPS1 || (() => null);
}

// ---- shared helpers -------------------------------------------------------------
// isCoarse(): the ONE mobile/touch query — every LOD decision in the cruise (render
// resolution, shadow-map size, terrain subdivision, dancer cap, glyph count) keys off it.
export function isCoarse() { try { return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (e) { return false; } }
// dispose every geometry/material (and their maps) under a subtree before dropping it.
export function disposeObj(obj) {
  obj.traverse((o) => {
    if (o.geometry) try { o.geometry.dispose(); } catch (e) {}
    if (o.material) {
      const m = Array.isArray(o.material) ? o.material : [o.material];
      m.forEach((x) => {
        try { if (x.map && x.map.dispose) x.map.dispose(); } catch (e) {}   // e.g. the cockpit CanvasTexture
        try { x.dispose(); } catch (e) {}
      });
    }
  });
}
// mark every mesh in a spawned group as a shadow caster + receiver so the key light
// MODELS the forms — done here (on our spawns) so shadows are guaranteed even before
// the alien/city agents wire castShadow into their own meshes.
function enableShadows(root) {
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}
// tiny local seeded rng (deterministic dancer scatter; NOT Math.random).
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- PART 1: THE LIGHT RIG ------------------------------------------------------
let sun = null;              // the shadow-casting KEY light (module-scoped for the frustum + probes)
let stageSpots = [];         // sweeping colored concert SPOTLIGHTS over the stage (animated)
// BRIGHT-BUT-MODELLED lofi lighting. The scene was deliberately brightened from
// too-dark; we keep it bright but pull the flat FILL DOWN (ambient + hemisphere)
// and let a strong KEY directional light MODEL the forms with a clear light-to-dark
// falloff + cast shadows. A soft back/rim fill keeps the shadow side reading colour
// so it's not murky. (linear->sRGB output fix lives in postfx.js.)
// DRAMATIC STAGE LIGHTING — spotlights sweeping over the stage, not everything lit
// like high noon. A DARK ambient/hemisphere base so the little world sits in near-night, a
// low warm KEY that still models the forms + casts the grounding shadows, and THREE saturated
// SPOTLIGHTS that SWEEP across the band on slow offset cycles (animated in updateLights) — moving
// pools of magenta / cyan / amber, like a little concert on the planet.
export function buildLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));                 // dark base (was 0.55 — the "high noon" floor)
  scene.add(new THREE.HemisphereLight(0x38507a, 0x241826, 0.22));   // dim cool sky / dark ground
  sun = new THREE.DirectionalLight(0xfff2e0, 0.65);                 // LOW key — models forms + casts the shadow
  sun.position.set(6, 16, 7);
  sun.castShadow = true;
  const shMap = isCoarse() ? 512 : 1024;                            // modest; smaller on mobile
  sun.shadow.mapSize.set(shMap, shMap);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
  const F = 26;                                                     // WIDE ortho frustum — the band is spread far now
  sun.shadow.camera.left = -F; sun.shadow.camera.right = F;
  sun.shadow.camera.top = F; sun.shadow.camera.bottom = -F;
  sun.shadow.bias = -0.0012;
  scene.add(sun);
  scene.add(sun.target);                                            // aim the shadow frustum at the band
  // sweeping concert SPOTLIGHTS — saturated cones from high above, targets drifting over the
  // stage (updated each frame in updateLights()). decay 0 / distance 0 = constant (matches the
  // legacy-intensity light rig); non-shadow-casting so they stay cheap on mobile.
  stageSpots = [];
  const spotCols = [0xff2f86, 0x33e2ff];   // magenta + cyan sweeping beams (2 keeps SwiftShader/mobile light)
  for (let i = 0; i < spotCols.length; i++) {
    const sp = new THREE.SpotLight(spotCols[i], 3.8, 0, 0.55, 0.7, 0);
    sp.position.set((i === 0 ? -9 : 9), 24, 7);
    sp.target.position.set(0, 0.6, 0);
    scene.add(sp); scene.add(sp.target);
    stageSpots.push({ light: sp, ph: i * 2.1 });
  }
}
// updateLights(t) — keep the shadow frustum + key aimed at the band when landed (transit
// forms are the MeshBasic star-map + cockpit, which don't need cast shadows), and SWEEP the
// concert spotlights across the stage: each target drifts on an offset Lissajous over the
// (now wide) band, so the pools of coloured light glide over the players. Cheap; deterministic
// (driven by the controller's virtual clock). Widened to cover the spread-out band.
export function updateLights(t) {
  if (sun) {
    sun.target.position.set(bandCentroid.x, 0, bandCentroid.z);
    sun.position.set(bandCentroid.x + 6, 16, bandCentroid.z + 7);
    sun.target.updateMatrixWorld();
  }
  if (stageSpots.length) {
    const cx = bandCentroid.x, cz = bandCentroid.z;
    const reach = 13;
    for (const s of stageSpots) {
      const L = s.light;
      L.position.set(cx + Math.sin(t * 0.18 + s.ph) * 6, 24, cz + 7 + Math.cos(t * 0.13 + s.ph) * 3);
      L.target.position.set(cx + Math.sin(t * 0.52 + s.ph) * reach, 0.5, cz + Math.cos(t * 0.41 + s.ph * 1.7) * reach * 0.7);
      L.target.updateMatrixWorld();
    }
  }
}

// ---- PART 2: THE PERSISTENT GALAXY ----------------------------------------------
let starfield = null;        // persistent THREE.Points deep-space (whole-session)
let glyphSky = null;         // persistent floating-glyph atmosphere (sprites follow the camera)
let planetField = null;      // persistent InstancedMesh: ONE planet per genre AT its GENRE_COORDS
let sunField = null;         // persistent InstancedMesh: ONE colored SUN per CLUSTER at its star coord
let sunGlowField = null;     // persistent InstancedMesh: an ADDITIVE corona/halo shell per sun (the glow)
const planetIndex = Object.create(null);   // genre -> instance index (dominant highlight)
let planetBaseR = null;      // per-instance base radius (to restore the dominant highlight)
let _hiIdx = -1;             // currently-highlighted (dominant) instance index
let sunIndex = null;         // [{id,label,color,x,y,z}] parallel to instance indices
let sunBaseR = null;         // per-sun core radius (for the glow-shell scale + probes)
let _sunShader = null;       // captured onBeforeCompile so setSunTime() can advance uTime

function hueOf(name) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return (h % 360) / 360; }
// PLANET-MARKER SHADER — the genre planets used to be flat MeshBasic "colored blobs"
// (the user's complaint). Now each instanced marker is a LIT little WORLD: real
// light/dark day-night shading, procedural continents/oceans over its per-genre hue,
// polar ice caps, fine mottling, and a soft fresnel ATMOSPHERE rim — all in ONE
// instanced draw call (mobile-cheap; the surface is a cheap 3-octave value-fbm, no
// texture). A per-instance seed (aSeed) makes every planet's continents unique. The
// injection targets only stable r160 shader chunks (<begin_vertex>, <color_fragment>,
// <emissivemap_fragment>) so it survives the vendored three build.
const PLANET_NOISE_GLSL = [
  "float scHash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }",
  "float scVN(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);",
  "  return mix(mix(mix(scHash(i+vec3(0,0,0)),scHash(i+vec3(1,0,0)),f.x), mix(scHash(i+vec3(0,1,0)),scHash(i+vec3(1,1,0)),f.x),f.y),",
  "             mix(mix(scHash(i+vec3(0,0,1)),scHash(i+vec3(1,0,1)),f.x), mix(scHash(i+vec3(0,1,1)),scHash(i+vec3(1,1,1)),f.x),f.y), f.z); }",
  "float scFBM(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<3;i++){ s+=a*scVN(p); p*=2.03; a*=0.5; } return s; }",
].join("\n");
function makePlanetMarkerMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSeed;\nvarying vec3 vObjP;\nvarying float vSeed;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n vObjP = normalize(position);\n vSeed = aSeed;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjP;\nvarying float vSeed;\n" + PLANET_NOISE_GLSL)
      .replace("#include <color_fragment>", [
        "#include <color_fragment>",
        "vec3 sp = vObjP*2.1 + vec3(vSeed*53.0);",
        "float land = scFBM(sp*1.7);",
        "float terr = smoothstep(0.44, 0.60, land);",             // ocean -> continents
        "vec3 base = diffuseColor.rgb;",
        "vec3 ocean = base*0.42;",
        "vec3 landc = clamp(base*1.2 + 0.04, 0.0, 1.0);",
        "diffuseColor.rgb = mix(ocean, landc, terr);",
        "diffuseColor.rgb *= 0.88 + 0.18*scFBM(sp*5.3);",          // fine mottling
        "float lat = abs(vObjP.y);",
        "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94,0.96,1.0), smoothstep(0.80,0.96,lat)*0.7);", // polar caps
      ].join("\n"))
      .replace("#include <emissivemap_fragment>", [
        "#include <emissivemap_fragment>",
        // soft base glow so the marker still reads against black, + a fresnel ATMOSPHERE rim.
        "float scRim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);",
        "totalEmissiveRadiance += diffuseColor.rgb*0.22 + (diffuseColor.rgb*0.5 + 0.5)*scRim*0.85;",
      ].join("\n"));
  };
  return mat;
}
// SUN (STAR) SHADER — the cluster suns used to be flat MeshBasic "balls of light".
// Now each is a FLAMING STAR: a DARK ember base overlaid with bright turbulent plasma
// (domain-warped fbm granulation + flares), dark SUNSPOTS, and LIMB DARKENING at the
// edge — slowly churning off a deterministic dt clock (uTime = the controller's virtual
// clock, so headless snapshots at dt=0 stay stable). Purely EMISSIVE (a star is self-lit;
// it ignores the scene lights). Per-instance aSeed makes every star's surface unique. One
// instanced draw call. The additive corona shell (built separately) still bleeds light into space.
function makeSunMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1.0, metalness: 0.0 });   // color white -> instanceColor tints
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    _sunShader = shader;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSeed;\nvarying vec3 vObjP;\nvarying float vSeed;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n vObjP = normalize(position);\n vSeed = aSeed;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vObjP;\nvarying float vSeed;\n" + PLANET_NOISE_GLSL)
      .replace("#include <emissivemap_fragment>", [
        "#include <emissivemap_fragment>",
        "vec3 sp = vObjP*3.0 + vec3(vSeed*41.0);",
        "float t = uTime*0.12;",
        // domain-warped turbulence -> churning plasma; fine granulation on top.
        "float warp = scFBM(sp*1.6 + vec3(t*0.5, -t*0.4, t*0.6));",
        "float gran = scFBM(sp*5.5 + warp*1.6 + vec3(t));",
        "float heat = clamp(warp*0.8 + gran*0.6, 0.0, 1.0);",
        "vec3 tint = diffuseColor.rgb;",                                    // the cluster color (keeps star hue)
        "vec3 emberDark = tint*0.05;",                                     // near-BLACK valleys (user: 'darker')
        // FIERY flare — a fire ramp (deep-red -> orange -> yellow-white) blended with the
        // cluster tint, so even a cool-hued star reads as burning plasma, not a pastel ball.
        "vec3 flameMid = mix(tint, vec3(0.95, 0.35, 0.05), 0.55);",        // orange body
        "vec3 flameHot = clamp(mix(tint, vec3(1.5, 1.15, 0.55), 0.7), 0.0, 1.6);", // yellow-white peaks
        "vec3 flame = mix(emberDark, flameMid, smoothstep(0.30, 0.62, heat));",
        "flame = mix(flame, flameHot, smoothstep(0.66, 0.92, heat));",     // hot filaments punch through
        // SUNSPOTS — dark cells where a slow second field dips near its mid value.
        "float spot = 1.0 - smoothstep(0.0, 0.10, abs(scFBM(sp*2.4 + 13.0) - 0.5));",
        "flame *= mix(1.0, 0.15, spot*0.8);",
        // LIMB DARKENING — dimmer toward the grazing edge (a real solar disc).
        "float limb = abs(dot(normalize(vViewPosition), normal));",
        "flame *= 0.5 + 0.6*limb;",
        "totalEmissiveRadiance += flame;",
        "diffuseColor.rgb = vec3(0.0);",                                   // purely emissive — a star ignores scene light
      ].join("\n"));
  };
  return mat;
}
// buildStarfield() — the deep-space you fly through between planets. It lives for the
// whole session (NOT despawned on depart) so frames are never blank in transit; a single
// THREE.Points draw call, disposed in disposeGalaxy().
function buildStarfield() {
  // SCALED UP to wrap the spread-out galaxy (now ~+/-350 wide, floating at y~380) and
  // the full descent volume, so deep space reads as a real starry surround from every
  // pose. A single cheap THREE.Points draw call; centered on the map's mid-height.
  const N = 800, pos = new Float32Array(N * 3);
  let s = 0x51ce77 >>> 0;                                  // seeded scatter (deterministic)
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < N; i++) {
    const r = 700 + rnd() * 900, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = 320 + r * Math.cos(ph);                  // centered on the map's height
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  starfield = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2.4, sizeAttenuation: true }));
  starfield.frustumCulled = false;
  scene.add(starfield);
}
function buildPlanetField() {
  const worlds = (mods.planetWorlds && mods.planetWorlds()) || [];
  if (!worlds.length || !scene) return;
  const geo = new THREE.IcosahedronGeometry(1, 2);   // rounder little worlds (was detail 0 flat balls)
  const seeds = new Float32Array(worlds.length);
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));   // per-planet terrain seed
  const mat = makePlanetMarkerMaterial();
  planetField = new THREE.InstancedMesh(geo, mat, worlds.length);
  planetField.frustumCulled = false;
  planetField.name = "planetField";
  planetBaseR = new Float32Array(worlds.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < worlds.length; i++) {
    const w = worlds[i];
    let hh = 0; for (let k = 0; k < w.g.length; k++) hh = (hh * 131 + w.g.charCodeAt(k)) >>> 0;
    const r = 1.4 + (hh % 100) / 100 * 1.9;   // per-genre radius 1.4..3.3
    planetBaseR[i] = r;
    seeds[i] = (hh % 997) / 997 * 1.0;        // deterministic per-genre terrain seed
    p.set(w.x, w.y, w.z); s.set(r, r, r);
    m4.compose(p, q, s); planetField.setMatrixAt(i, m4);
    col.setHSL(hueOf(w.g), 0.66, 0.55); planetField.setColorAt(i, col);
    planetIndex[w.g] = i;
  }
  planetField.instanceMatrix.needsUpdate = true;
  if (planetField.instanceColor) planetField.instanceColor.needsUpdate = true;
  scene.add(planetField);
}
// buildSunField() — the STARS of the two-level galaxy: ONE glowing colored SUN per
// CLUSTER at its star coord (worldOfCoord of cluster.star), tinted the cluster's own
// color, scaled up so suns read as the big landmarks you cruise PAST while the genre
// PLANETS orbit near them. A single InstancedMesh (31 low-poly balls, one draw call) —
// mobile-cheap. The per-cluster LABEL is shown in the 2D HUD, not floated in 3D.
function buildSunField() {
  const suns = (mods.clusterWorlds && mods.clusterWorlds()) || [];
  if (!suns.length || !scene) return;
  sunIndex = suns;
  sunBaseR = new Float32Array(suns.length);
  // CORE — the STAR itself: a bright, fully self-lit (toneMapped:false, unlit-at-full-
  // brightness) sphere tinted the cluster color. Radius scales with membership but is kept
  // well under the ~19-unit min sun-sun spacing so systems never touch (real empty space).
  const geo = new THREE.IcosahedronGeometry(1, 3);   // rounder star discs (flaming surface reads better)
  const sunSeeds = new Float32Array(suns.length);
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(sunSeeds, 1));   // per-star surface seed
  const mat = makeSunMaterial();
  sunField = new THREE.InstancedMesh(geo, mat, suns.length);
  sunField.frustumCulled = false;
  sunField.name = "sunField";
  // NO HALO on the stars. There is no additive corona/glow shell —
  // each star is JUST its flaming plasma core, no bloom bubble around it. sunGlowField stays
  // null (dispose + probes already guard for null).
  sunGlowField = null;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < suns.length; i++) {
    const w = suns[i];
    const r = 4 + Math.min(8, w.members) * 0.5;    // 4..8 world units — landmark stars, well separated
    sunBaseR[i] = r;
    sunSeeds[i] = ((i * 2654435761) >>> 0) % 1000 / 1000;   // deterministic per-star surface seed
    p.set(w.x, w.y, w.z);
    s.set(r, r, r); m4.compose(p, q, s); sunField.setMatrixAt(i, m4);
    const c = w.color || [1, 1, 1];
    col.setRGB(c[0], c[1], c[2]); sunField.setColorAt(i, col);
  }
  sunField.instanceMatrix.needsUpdate = true;
  if (sunField.instanceColor) sunField.instanceColor.needsUpdate = true;
  scene.add(sunField);
}
// buildGalaxy() — the whole-session deep space, in ONE call and in the order the
// materials must be created in: starfield, floating glyphs, the per-genre PLANET field
// (at the same GENRE_COORDS projection the flight camera flies through, so flying ==
// traversing the genre space), then the per-cluster SUN field.
export function buildGalaxy() {
  buildStarfield();
  // persistent FLOATING GLYPHS — the alien idents drift through the atmosphere for the
  // whole session (a shell that follows the camera each frame; see glyphs.js). Cheap:
  // ~8-12 additive sprites, textures baked once. Guarded so a hiccup never kills start.
  try {
    glyphSky = makeGlyphAtmosphere(THREE, { coarse: isCoarse() });
    scene.add(glyphSky.group);
  } catch (e) { glyphSky = null; }
  buildPlanetField();
  buildSunField();
}
export function disposeGalaxy() {
  if (starfield) { scene.remove(starfield); disposeObj(starfield); starfield = null; }
  if (glyphSky) { try { glyphSky.dispose(); } catch (e) {} glyphSky = null; }
  if (planetField) { scene.remove(planetField); disposeObj(planetField); planetField = null; }
  if (sunGlowField) { scene.remove(sunGlowField); disposeObj(sunGlowField); sunGlowField = null; }
  if (sunField) { scene.remove(sunField); disposeObj(sunField); sunField = null; sunIndex = null; sunBaseR = null; }
  _sunShader = null;   // shader is captured on compile; a fresh start rebuilds it
  for (const g in planetIndex) delete planetIndex[g];
  planetBaseR = null; _hiIdx = -1;
}
// FLAMING SUNS: advance the star-surface plasma churn off the deterministic clock
// (a headless snapshot at dt=0 stays byte-stable).
export function setSunTime(t) { if (_sunShader) _sunShader.uniforms.uTime.value = t; }
// atmosphere glyphs follow the camera + breathe.
export function updateGlyphSky(dt, camera) { if (glyphSky) glyphSky.update(dt, camera); }
// the CLUSTER the current dominant genre belongs to (label + color) — drives the HUD.
export function clusterOfGenre(genre) {
  if (!genre) return null;
  const id = CLUSTER_OF[genre];
  if (id == null) return null;
  const c = (GENRE_CLUSTERS || []).find((x) => x.id === id);
  return c || null;
}
// world position of a genre's planet marker (the exact GENRE_COORDS projection).
export function planetWorldOf(genre) {
  if (!genre || !mods.worldOfCoord) return null;
  const idx = planetIndex[genre];
  if (idx == null || !planetField) return null;
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  planetField.getMatrixAt(idx, m4); m4.decompose(p, q, s);
  return { x: p.x, y: p.y, z: p.z, idx };
}
// scale up the dominant planet (restore the previous) — only when the dominant changes.
export function highlightPlanet(genre) {
  if (!planetField || !planetBaseR) return;
  const idx = genre != null ? planetIndex[genre] : null;
  if ((idx == null ? -1 : idx) === _hiIdx) return;
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  if (_hiIdx >= 0) { planetField.getMatrixAt(_hiIdx, m4); m4.decompose(p, q, s); const r = planetBaseR[_hiIdx]; s.set(r, r, r); m4.compose(p, q, s); planetField.setMatrixAt(_hiIdx, m4); }
  if (idx != null) { planetField.getMatrixAt(idx, m4); m4.decompose(p, q, s); const r = planetBaseR[idx] * 2.0; s.set(r, r, r); m4.compose(p, q, s); planetField.setMatrixAt(idx, m4); }
  _hiIdx = idx == null ? -1 : idx;
  planetField.instanceMatrix.needsUpdate = true;
}

// ---- PART 3: THE SURFACE (per landing) ------------------------------------------
let band = [];               // [{group, update}]
let dancers = [];            // [{group, update}] — extra background dancer-aliens (no instrument)
let stage = null;            // shadow-RECEIVING stage disc under the band
let groundPlanet = null;     // the PROCEDURAL PLANET the band stands on (planet.js; heightAt foot-plant)
let groundH0 = 0;            // heightAt(0,0) of the ground planet (so its pole sits at y=0)
let groundRadius = 0;        // the ACTUAL base radius of the current ground planet (small-world)
let smallWorldGround = false;// true when the ground is the LITTLE-PRINCE small curved world
const GROUND_R = 110;        // legacy flat-fallback ground-planet radius (only if the small build fails)
let backdrop = null;         // {group, update}
let skyDome = null;          // {mesh, update, dispose} — footage wrapped around the planet as a glowing atmosphere
let ship = null;             // { group, update(dt, phase, landProgress) } — the greet-craft saucer
let curTraits = null;        // TRAITS of the currently-spawned band (headless-probe visibility)
let curRenderStyle = null;   // renderStyle of the ACTIVE genre (pushed into the PS1 post pass)
// the centre of the spawned players (orbit target). A STABLE object — camera.js frames
// the band off it every frame, so it is mutated in place, never reassigned.
export const bandCentroid = { x: 0, y: 1.2, z: 0.6 };

// curSpawnDom — the DOMINANT genre the current surface (band+ground+backdrop) was built
// for. The surface is keyed by planet identity so it is built ONCE per genre (on APPROACH),
// PERSISTS through the descent + touchdown (no rebuild -> no pop), and is rebuilt only when
// the dominant moves to a DIFFERENT genre. Cleared in despawnBand (depart / teardown).
let curSpawnDom = null;
// ensureSurface — (re)build the surface only if it is not already up for this dominant
// genre. Called on APPROACH (grow in during the descent) and on LAND (covers a direct land).
export function ensureSurface(genreOrWeights, dominant, seed) {
  if (dominant && dominant === curSpawnDom && band.length) return;   // already up for this planet
  spawnFor(genreOrWeights, seed);
  curSpawnDom = dominant || null;
  // SKY CART IS PLANET-KEYED. Otherwise the wasm background sticks — the same
  // cart on every planet: the cruise forces the demo layer
  // up via bgWant() but the background alternator only rotates carts in bgMode
  // 1, so the same cart wrapped every planet forever. Each dominant genre now
  // OWNS a cart, picked deterministically (FNV-1a of the name) at the
  // once-per-planet surface build — travel shifts the atmosphere, revisits
  // look like themselves. Guarded: a missing demo layer never hurts the land.
  try {
    const D = window.DemoLayer;
    if (D && D.setCart && D.carts) {
      let h = 2166136261 >>> 0; const s = String(dominant || "space");
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      D.setCart((h >>> 0) % Math.max(1, D.carts().length));
    }
  } catch (e) {}
}

// build the band + backdrop + ship for a genre (called on land / dominant change).
// Everything spawned here is torn down together in despawnBand().
function spawnFor(genreOrWeights, seed) {
  despawnBand();
  const useSeed = seed || getS().seed || 1;
  const traits = mods.traitsFromGenre(K(), V(), genreOrWeights, useSeed);
  curTraits = traits;
  // SCORE BRIDGE: build (once, cached) the per-bar note plan for THIS genre so each
  // band member can play its voice's real onsets. Never rebuilt per frame.
  buildEventPlan(genreOrWeights, useSeed);
  // RENDERSTYLE: this genre's visual language. Push its post-fx bag into the PS1 pass
  // so the ACTIVE planet's whole-screen render (dither/scanlines/aberration/bloom/
  // posterize/grade/vignette/curvature) changes by genre. Stored so a render-target
  // rebuild (resize / DPR change) re-applies it to the freshly-built pass.
  curRenderStyle = traits.renderStyle || null;
  const ps1 = getPS1();
  if (ps1 && ps1.setStyle && curRenderStyle) ps1.setStyle(curRenderStyle.post);
  // ---- ROSTER + STAGE GEOMETRY (resolved BEFORE the world so the world is sized to it) --
  // ONE alien per SOUNDING voice (deterministic coverage), mobile-capped, laid out in a WIDE
  // arc. We compute the arc + the (energy-gated) dancer crowd size UP FRONT so the little
  // world's radius can be sized to hold the whole ensemble around the landing pole.
  const members = rosterFor(traits.band);
  const n = members.length;
  const spread = n > 1 ? Math.max(5.0, Math.min(7.0, 4.2 + 8 / n)) : 0;   // WIDE arc — the band is spaced well apart
  const bandHalfW = n > 1 ? ((n - 1) / 2) * spread : 2;
  const energy = (traits.groove && traits.groove.energy) || 0;
  const DANCER_ENERGY_GATE = 0.34;         // below this the planet is band-only
  const wantD = energy >= DANCER_ENERGY_GATE ? Math.max(0, Math.round(traits.dancers || 0)) : 0;
  const dCap = isCoarse() ? 5 : 8;
  const nd = Math.min(dCap, wantD);
  const dancerReach = nd > 0 ? 7 : 0;      // outer radius of the dancer ring (matches below)

  // LITTLE-PRINCE small world: a SMALL curved planet sized to the ensemble so the band reads
  // as standing on a little round world with a clearly BENDING horizon. radius ≈ 1.8*bandSpan
  // (≈ 2.7*halfExtent); halfExtent is clamped so tiny/huge bands still get a legible curve.
  const halfExtent = Math.max(6, Math.min(15, Math.max(bandHalfW, dancerReach)));   // grow the world to hold the WIDER band (capped so it stays a little planet)
  const bandSpan = 1.5 * halfExtent;

  // GROUND PLANET — the SMALL curved world the band stands ON (little-prince landing). Built
  // per-genre from the SAME palette + seed via makePlanet({smallWorld}), which auto-selects
  // one of 9 terrain types + its palette/atmosphere. Placed so its landing POLE surface sits
  // at world y≈0 (planet centre at y=-groundH0) — the existing camera framing (looks at y~1.2)
  // is preserved while the world curves away underfoot. The band/dancers/backdrop are wrapped
  // ONTO this curved surface (surfacePoint/upAt) below. Baked ONCE, mobile-capped subdivision.
  // Guarded: on any failure we fall back to the old flat frame (groundPlanet null / not small).
  groundPlanet = null; groundH0 = 0; groundRadius = 0; smallWorldGround = false;
  // Terrain TYPE + relief keyed to the GENRE (not just the session seed) so each planet's
  // LANDSCAPE shape differs per genre — not only its palette. Deterministic per (seed, genre):
  // mix a hash of the genre/blend key into the ground-planet seed. Palette stays genre-derived
  // (traits.palette). Without this, every genre in one session shares the same terrain archetype.
  const gKey = typeof genreOrWeights === "string" ? genreOrWeights : JSON.stringify(genreOrWeights || "");
  let terrSeed = (useSeed >>> 0) || 1;
  for (let i = 0; i < gKey.length; i++) terrSeed = Math.imul(terrSeed ^ gKey.charCodeAt(i), 2654435761) >>> 0;
  try {
    if (mods.makeGroundPlanet) {
      groundPlanet = mods.makeGroundPlanet(THREE, terrSeed, traits.palette, {
        smallWorld: true, bandSpan, curveFactor: 1.8,
        detail: isCoarse() ? 3 : 4, reliefFrac: 0.05, atmosphere: false,
      });
      groundRadius = (groundPlanet.field && groundPlanet.field.radius) || GROUND_R;
      groundH0 = (groundPlanet.heightAt && groundPlanet.heightAt(0, 0)) || groundRadius;
      groundPlanet.position.set(0, -groundH0, 0);           // landing pole -> world y = 0
      groundPlanet.name = "groundPlanet";
      smallWorldGround = !!(groundPlanet.userData && groundPlanet.userData.smallWorld);
      groundPlanet.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      scene.add(groundPlanet);
    }
  } catch (e) { groundPlanet = null; groundH0 = 0; groundRadius = 0; smallWorldGround = false; }

  // BACKDROP — deliberately empty: no trees, no background objects. The
  // planet's bare terrain is the whole stage; no procedural city/farm/foliage. We keep an
  // EMPTY backdrop object so the spawn/despawn + update lifecycle (and hasBackdrop) are
  // unchanged — nothing is drawn, nothing clutters the little world.
  backdrop = { group: new THREE.Object3D(), update() {} };
  backdrop.group.name = "backdrop-empty";
  scene.add(backdrop.group);
  skyDome = makeSkyDome();       // wrap the demoscene canvas around the planet as its atmosphere
  scene.add(skyDome.mesh);
  // ship: empty group (kept only for the surface-scene lifecycle parity).
  ship = makeShip(traits, useSeed);
  scene.add(ship.group);
  // STAGE plinth: ONLY in the flat fallback (a flat disc can't sit on a curved world — the
  // small planet's terrain receives the cast shadows directly).
  stage = null;
  if (!smallWorldGround) {
    const smat = new THREE.MeshLambertMaterial({ color: 0x1b1526, flatShading: true });
    smat.polygonOffset = true; smat.polygonOffsetFactor = 1; smat.polygonOffsetUnits = 1;
    stage = new THREE.Mesh(new THREE.CircleGeometry(8.4, 44), smat);
    stage.rotation.x = -Math.PI / 2; stage.position.y = groundYAt(0, 0) + 0.02;   // sit on the terrain
    stage.receiveShadow = true; stage.name = "stage";
    scene.add(stage);
  }
  // BAND — each alien PLANTED ON the curved surface: its flat arc (x,z) maps to a surface
  // direction; a PEDESTAL sits at surfacePoint(dir) and orients local +Y to upAt(dir) so the
  // alien stands UPRIGHT on the little world (leaning outward on the wings — the little-prince
  // pose). The alien reparents UNDER the pedestal and animates (bob/sway) in the pedestal's
  // local frame, so its own +Y is the surface normal (its per-frame group.position.y /
  // group.rotation writes ride the tangent frame instead of fighting it).
  let cx = 0, cz = 0;
  band = members.map((member, i) => {
    const a = mods.makeAlien(THREE, traits, member, useSeed + i * 101);
    a._voice = member.voice || member.role;   // the engine voice this alien plays (score-bridge lookup)
    a._role = member.role;
    const off = (i - (n - 1) / 2);             // centered index, e.g. -2,-1,0,1,2
    const fx = off * spread;
    const fz = 2.0 - Math.abs(off) * 0.85;     // deeper arc: center forward, wings back
    const ped = new THREE.Object3D();
    ped.name = "band-pedestal";
    ped.add(a.group);
    plantOnSurface(ped, fx, fz, -off * 0.13);  // yaw toward the pilot at the arc center
    a.stage = ped;                             // the WORLD-staging node (probes/framing read this)
    enableShadows(ped);                        // the players CAST shadows onto the terrain
    scene.add(ped);
    cx += ped.position.x; cz += ped.position.z;
    return a;
  });
  // orbit target = the CENTRE of the players (front-centred landed framing). y is an
  // eye-height above the pole so the camera looks AT the band, not their feet.
  bandCentroid.x = n ? cx / n : 0;
  bandCentroid.z = n ? cz / n : 0.6;
  bandCentroid.y = 1.2;

  // DANCERS — OPTIONAL, gated by ENERGY (resolved above): a low-energy planet is JUST THE
  // BAND. Louder genres get a crowd ringed AROUND/BEHIND the band, each also PLANTED ON the
  // curved surface facing the band. Mobile-capped so the draw-calls stay bounded.
  dancers = [];
  for (let i = 0; i < nd; i++) {
    const d = mods.makeAlien(THREE, traits, { role: "dancer" }, useSeed + 4200 + i * 37);
    const seedR = mulberry(useSeed * 131 + i * 977);
    const ang = Math.PI * (0.55 + 1.9 * (i + 0.5) / nd) + (seedR() - 0.5) * 0.4;  // ~back arc
    const rad = 5.0 + (i % 2) * 1.4 + seedR() * 1.0;   // wider ring (band is spread further)
    const px = bandCentroid.x + Math.cos(ang) * rad;
    const pz = bandCentroid.z + Math.sin(ang) * rad - 0.6;   // pushed back (-z)
    const faceYaw = Math.atan2(bandCentroid.x - px, bandCentroid.z - pz);   // face the band
    const ped = new THREE.Object3D();
    ped.name = "dancer-pedestal";
    ped.add(d.group);
    plantOnSurface(ped, px, pz, faceYaw);
    // scale the PEDESTAL (about the surface-contact point), not the alien inside it — scaling
    // the inner group shrank each dancer about its own centre and lifted its FEET off the
    // ground — otherwise the dancers float. Scaling the planted pedestal keeps
    // the feet on the surface while still giving the crowd size variety.
    ped.scale.setScalar(0.85 + seedR() * 0.25);
    d.stage = ped;
    // dancers RECEIVE but do NOT CAST shadows — halves the shadow-map pass (the band still
    // casts), which keeps the render cheap now that the crowd + creatures are richer.
    ped.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    scene.add(ped);
    dancers.push(d);
  }
}
// surfaceQuat(nm, yaw) — a quaternion that rotates local +Y onto the outward surface normal
// `nm` and then spins `yaw` about that normal. The little-prince upright-on-a-sphere pose.
function surfaceQuat(nm, yaw) {
  const N = new THREE.Vector3(nm[0] || 0, nm[1] || 0, nm[2] || 0);
  if (N.lengthSq() < 1e-9) N.set(0, 1, 0); else N.normalize();
  const qA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), N);
  return new THREE.Quaternion().setFromAxisAngle(N, yaw || 0).multiply(qA);
}
// plantOnSurface(ped, x, z, yaw) — position + orient a pedestal (holding an alien) ON the
// current ground planet's curved surface for a flat landing-patch offset (x,z): map (x,z) to
// a surface direction near the pole, sit at surfacePoint(dir) (in the planet's WORLD frame),
// and orient local +Y to upAt(dir) with a yaw spin. Falls back to the FLAT (x, groundYAt, z)
// frame when there is no small-world ground (the flat-stage fallback). Returns ped.position.
function plantOnSurface(ped, x, z, yaw) {
  if (groundPlanet && groundPlanet.field && smallWorldGround) {
    const f = groundPlanet.field;
    // NB: the field's landing tangent basis is tX=+Z, tZ=+X (cross-product handedness), so
    // dirForGround(a,b) puts `a`->world-Z and `b`->world-X. We feed (z,x) so the ensemble's
    // flat X-spread lands on WORLD X (across the camera's view) and its Z-arc on world Z —
    // the band reads as a wide stage arc FACING the pilot (+Z), not a line receding from it.
    const dir = f.dirForGround(z, x);
    const sp = f.surfacePoint(dir);
    const nm = f.upAt(dir);
    const o = groundPlanet.position;
    ped.position.set(sp[0] + o.x, sp[1] + o.y, sp[2] + o.z);
    ped.quaternion.copy(surfaceQuat(nm, yaw));
  } else {
    ped.position.set(x, groundYAt(x, z), z);
    ped.rotation.y = yaw || 0;
  }
  return ped.position;
}
// groundYAt(x,z) — the WORLD y of the ground-planet terrain under a landing-patch offset
// (x,z). The planet is placed so its north pole (heightAt(0,0)) sits at y=0, so this is
// heightAt(x,z) - heightAt(0,0): 0 at the stage centre, dipping gently with curvature /
// terrain toward the edges. 0 when there is no ground planet (flat-stage fallback).
export function groundYAt(x, z) {
  if (!groundPlanet || !groundPlanet.heightAt) return 0;
  return groundPlanet.heightAt(x, z) - groundH0;
}
// count shadow-casting meshes across the spawned band + dancers (shadow proof).
export function countCasters() {
  let n = 0;
  const scan = (a) => { const g = a && (a.stage || a.group); if (g) g.traverse((o) => { if (o.isMesh && o.castShadow) n++; }); };
  band.forEach(scan); dancers.forEach(scan);
  return n;
}
// SKY DOME — wrap the visuals AROUND THE PLANET like a glowing atmosphere,
// mapped on as if it were the planet's own air. A big BackSide sphere
// concentric with the ground planet. It projects the WASM DEMOSCENE canvas
// (DemoLayer, same-origin, generative — the only source there is; no demo
// running = no dome).
// ADDITIVE + depth-tested so it reads as luminous atmosphere in the OPEN SKY only
// — the depth test keeps it off the near band/planet (those are closer, so the
// dome fails depth there) while it glows over the far stars. background.js's
// bgWant() keeps the demo layer running while the cruise runs (its 2D canvas
// hides under the 3D view). All guarded — a hiccup never kills the render.
function makeSkyDome() {
  const R = (smallWorldGround ? groundRadius : 0) + 60;   // enclose the landed camera orbit
  const cy = smallWorldGround ? -groundH0 : 0;            // concentric with the planet core
  const geo = new THREE.SphereGeometry(R, 48, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0.72,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, cy, 0);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;                    // after opaque: additive glow only in open-sky pixels
  mesh.visible = false;
  mesh.name = "sky-atmosphere";
  let tex = null, texSrc = null, texAcc = 1;   // >= interval so the first bound frame uploads
  const TEX_HZ = 12;                           // sky upload throttle (see below)
  return {
    mesh,
    update(dt) {
      try {
        // the demoscene canvas (generative, same-origin, always safe).
        const D = window.DemoLayer;
        const demoCv = D && D.enabled && D.enabled() && D._canvas && D._canvas();
        const demoOk = !!(demoCv && demoCv.width > 0 && D._running && D._running());
        const src = demoOk ? demoCv : null;
        if (src) {
          if (src !== texSrc) {                 // (re)bind when the source changes
            if (tex) tex.dispose();
            tex = new THREE.CanvasTexture(src);
            if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.RepeatWrapping;   // wrap the visuals around the dome
            mat.map = tex; mat.color.setHex(0xffffff); mat.needsUpdate = true;
            texSrc = src;
          }
          // THROTTLED canvas refresh (~12Hz, was every frame): the dome texture is the
          // cruise's only recurring full-frame GPU upload (near-native RGBA every RAF),
          // a steady main-thread + GPU tax that eats into the live engine's feed
          // runway (the static mechanism). The demo cart drifts slowly under the
          // additive atmosphere — 12Hz is visually indistinguishable there.
          texAcc += (dt || 0);
          if (tex && texAcc >= 1 / TEX_HZ) { tex.needsUpdate = true; texAcc = 0; }
          mesh.visible = true;
        } else {
          mesh.visible = false;
        }
        mesh.rotation.y += (dt || 0) * 0.012;   // slow atmospheric drift
      } catch (e) { mesh.visible = false; }
    },
    dispose() { try { if (tex) tex.dispose(); geo.dispose(); mat.dispose(); if (mesh.parent) mesh.parent.remove(mesh); } catch (e) {} },
  };
}
// makeShip() — deliberately draws NOTHING. A low-poly saucer sits in front of or
// behind the band and obstructs the view, so there is no 3D ship: this returns an
// EMPTY group + a no-op update, keeping the surface-scene lifecycle
// (spawn/despawn, hasShip) intact while nothing is drawn and nothing blocks.
function makeShip(traits, seed) {
  const g = new THREE.Object3D();
  g.name = "ship-empty";   // no children — the 3D ship shell is gone (HUD-only cockpit)
  return { group: g, update() {} };
}
export function despawnBand() {
  for (const a of band) { const g = a.stage || a.group; scene.remove(g); disposeObj(g); }
  band = [];
  for (const d of dancers) { const g = d.stage || d.group; scene.remove(g); disposeObj(g); }
  dancers = [];
  if (stage) { scene.remove(stage); disposeObj(stage); stage = null; }
  if (groundPlanet) { scene.remove(groundPlanet); disposeObj(groundPlanet); groundPlanet = null; groundH0 = 0; groundRadius = 0; smallWorldGround = false; }
  if (backdrop) { scene.remove(backdrop.group); disposeObj(backdrop.group); backdrop = null; }
  if (skyDome) { skyDome.dispose(); skyDome = null; }
  if (ship) { scene.remove(ship.group); disposeObj(ship.group); ship = null; }
  curTraits = null;
  curSpawnDom = null;                              // surface is down — next genre must rebuild
}

// ---- PART 4: SPACE / COCKPIT set (transit) --------------------------------------
// Spawned on DEPART, torn down on the next LAND. The cockpit interior frames the
// pilot; the planet recedes below through the viewport; the console screen shows the
// GENRE MAP. Positioned at SPACE_ANCHOR, high above the (despawned) surface scene.
let cockpit = null;          // { group, update, setGenres } — the transit COCKPIT interior
let planet = null;           // { group, update, setPalette } — the planet you leave/approach
let spaceActiveGenre = null;
// the SPACE ANCHOR — a fixed spot high above the band scene where the cockpit set +
// planet live during transit, so they never overlap the (despawned) surface scene.
const SPACE_ANCHOR = { x: 0, y: 40, z: 0 };
export function spawnSpaceRig(activeGenre) {
  despawnSpaceRig();
  cockpit = mods.makeCockpit(THREE, { genres: genreLabels(), active: genreLabelOf(activeGenre) });
  cockpit.group.position.set(SPACE_ANCHOR.x, SPACE_ANCHOR.y, SPACE_ANCHOR.z);
  scene.add(cockpit.group);
  planet = mods.makePlanet(THREE, curTraits, (getS().seed | 0) || 1);
  scene.add(planet.group);
  spaceActiveGenre = activeGenre || null;
}
export function despawnSpaceRig() {
  if (cockpit) { scene.remove(cockpit.group); disposeObj(cockpit.group); cockpit = null; }
  if (planet) { scene.remove(planet.group); disposeObj(planet.group); planet = null; }
  spaceActiveGenre = null;
}

// resetScene() — stop(): drop the light rig + the per-genre look, and release the
// THREE.Scene handle so a stopped cruise holds no GL objects alive.
export function resetScene() {
  sun = null; stageSpots = [];
  curTraits = null; curRenderStyle = null;
  scene = null;
}

// ---- read-only getters (the controller's frame loop + ./probes.js) --------------
export function getBand() { return band; }
export function getDancers() { return dancers; }
export function getStage() { return stage; }
export function getBackdrop() { return backdrop; }
export function getSkyDome() { return skyDome; }
export function getShip() { return ship; }
export function getCockpit() { return cockpit; }
export function getPlanet() { return planet; }
export function getSpaceActiveGenre() { return spaceActiveGenre; }
export function getCurTraits() { return curTraits; }
export function getCurRenderStyle() { return curRenderStyle; }
export function getGroundPlanet() { return groundPlanet; }
export function getGroundRadius() { return groundRadius; }
export function getGroundH0() { return groundH0; }
export function getSmallWorldGround() { return smallWorldGround; }
export function getSun() { return sun; }
export function getPlanetField() { return planetField; }
export function getPlanetIndex() { return planetIndex; }
export function getSunField() { return sunField; }
export function getSunGlowField() { return sunGlowField; }
export function getSunIndex() { return sunIndex; }
export function getSunBaseR() { return sunBaseR; }
export function getFIELD() { return mods && mods.FIELD; }
