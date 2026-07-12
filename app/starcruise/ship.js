// ship.js — the STAR-CRUISE transit set: the PILOT'S COCKPIT interior + the
// PLANET you're leaving/approaching + the genre DISPLAY on the console screen.
//
// When you DEPART a planet the controller lifts you off, fades the sky to space,
// and cuts to this cockpit: you sit at the console looking OUT the viewport at the
// planet receding below and the stars, with a big lit screen showing the GENRE MAP
// (names pulled from window.GenreKernel.GENRES / the travel weights, the target
// genre highlighted). On approach the next planet grows below and we descend.
//
// CONTRACT (both builders are asset-free, procedural, low-poly, PS1-flat):
//   makeCockpit(THREE, opts) -> { group, update(dt), setGenres(names, active) , screen }
//     The group is placed by the controller at the SPACE ANCHOR; the camera sits at
//     the group origin looking out -Z (three's forward) through the viewport, so the
//     frame + console read as the interior around the pilot. opts = { genres, active }.
//   makePlanet(THREE, traits, seed) -> { group, update(dt), setPalette(traits), body }
//     A unit-radius sphere (scaled/positioned by the controller from spaceProgress)
//     coloured from the genre palette; a thin ring on some seeds. Slowly spins.
//
// DETERMINISM: no Math.random — ring presence keys off the seed. The screen redraw
// is a pure function of (names, active).
//
// RENDER STYLE: the PLANET and the cockpit shell shade in the genre's visual
// LANGUAGE (traits.renderStyle.material — the same 'flat'|'cel'|'iridescent'|
// 'wireframe'|'glitch'|'matte' vocab the aliens + city use), so the whole world of a
// genre renders alike. The planet is the highlight: a banded gas-giant whose surface
// then renders cel-shaded / oil-iridescent / wire / glitched per genre. The screen +
// indicator dots stay UNLIT (always readable). Defaults to 'flat' when unsupplied.

// The de-squaring geom kit (superquadric / tube / lathe / pbr) is shared with the
// backdrop — one guarded facade over geom.js, hand-rolled core-Three fallbacks so a
// missing/late geom.js never breaks the planet or cockpit.
import { makeGeomKit } from "./backdrop.js";

// mulberry32 — tiny seeded PRNG (deterministic band layout; no Math.random).
function rng32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TAU = Math.PI * 2;
const IRID_GLSL = [
  "float _fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);",
  "vec3 _ir = 0.5 + 0.5 * cos(6.2831853 * (_fr + vec3(0.0, 0.33, 0.66)));",
  "outgoingLight = mix(outgoingLight, outgoingLight + _ir, _fr * 0.85);",
].join("\n");
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

// makeStyleKit — the shared surface factory. surface(o) builds ONE lit material in
// the active style (cel -> banded MeshToon; else Lambert + fresnel/glitch hook);
// tick(clock) drives the glitch uniform. Reused across the planet + cockpit shell.
function makeStyleKit(THREE, style, gk) {
  const wire = style === "wireframe";
  const smooth = style === "matte";
  const pbr = style === "pbr";
  const glitchTime = { value: 0 };
  let celGrad = null;
  if (style === "cel") {
    const ramp = new Uint8Array([70, 70, 84, 255, 150, 150, 165, 255, 245, 245, 255, 255]);
    celGrad = new THREE.DataTexture(ramp, 3, 1);
    celGrad.magFilter = THREE.NearestFilter; celGrad.minFilter = THREE.NearestFilter;
    celGrad.needsUpdate = true;
  }
  function apply(m) {
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
  function surface(o) {
    const flat = o.flatShading !== false && !smooth;
    const emissive = o.emissive || new THREE.Color(0, 0, 0);
    let m;
    if (pbr && gk) {
      // real chrome/glass planet + shell (MeshStandardMaterial + shared env map).
      return gk.pbr({ color: o.color, emissive, emissiveIntensity: o.emissiveIntensity, metalness: 0.85, roughness: 0.28, vertexColors: !!o.vertexColors, flatShading: flat });
    }
    if (style === "cel") {
      m = new THREE.MeshToonMaterial({ color: o.color, emissive, gradientMap: celGrad, vertexColors: !!o.vertexColors });
      m.flatShading = true;
    } else {
      m = new THREE.MeshLambertMaterial({ color: o.color, emissive, vertexColors: !!o.vertexColors, flatShading: flat, wireframe: wire });
      if (smooth && o.color && o.color.clone) m.emissive = emissive.clone().add(o.color.clone().multiplyScalar(0.08));
    }
    if (o.emissiveIntensity != null) m.emissiveIntensity = o.emissiveIntensity;
    return apply(m);
  }
  return { surface, apply, tick: (c) => { glitchTime.value = c; }, wire, smooth };
}

// ---- COCKPIT (HUD-ONLY) ---------------------------------------------------------
// The obstructing 3D cockpit interior (viewport frame, console housing, side panels,
// the tilted genre-map screen) has been REMOVED per the SMOOTH+LEGIBLE brief: it sat
// between the pilot and the world and blocked the view. The current star/cluster LABEL
// now lives in a 2D DOM cockpit HUD the controller mounts over the canvas.
//
// This builder is kept as a tiny lifecycle HANDLE so the transit state machine
// (spawnSpaceRig / despawnSpaceRig / hasCockpit) is unchanged: it returns an EMPTY
// group (nothing to draw, nothing to obstruct), a no-op update, and a no-op setGenres
// (the HUD is driven by the controller, not a 3D screen). No meshes, no textures.
export function makeCockpit(THREE, opts = {}) {
  const group = new THREE.Object3D();
  group.name = "cockpit";
  // intentionally NO child meshes — HUD-only. The group rides the camera in transit
  // but renders nothing, so the fly-away view is a clean, unobstructed star field.
  return {
    group,
    update() {},
    screen: null,
    setGenres() {},
  };
}

// ---- PLANET (unit sphere; controller scales + positions it from spaceProgress) --
// The planet is the render-style HIGHLIGHT: a banded gas-giant (latitude bands baked
// into vertex colours, deterministic off the seed) whose SURFACE then renders in the
// genre's material language — cel-banded, oil-iridescent, wireframe, glitched, matte
// or flat. setPalette re-tints the base colour; the bands (vertex colours) persist.
// the abstract WORLD archetype for the fly-away planet — same species-body-plan map
// the backdrop uses, so the planet you leave IS the world you were just on.
function pickPlanetWorld(traits) {
  const plan = traits && traits.body && traits.body.plan;
  const skin = traits && traits.skin;
  const byPlan = {
    "floating-gas": "cloudsea", radial: "ringworld", crystalline: "crystalfield",
    insectoid: "tendrilforest", cephalopod: "liquidsea", amorphous: "moltenvoid", stalk: "spiregarden",
  };
  if (plan && byPlan[plan]) return byPlan[plan];
  if (skin === "glass") return "cloudsea";
  if (skin === "matte") return "moltenvoid";
  return "geomvoid";
}

export function makePlanet(THREE, traits, seed) {
  const group = new THREE.Object3D();
  group.name = "planet";
  const style = (traits && traits.renderStyle && traits.renderStyle.material) || "flat";
  const gk = makeGeomKit(THREE);
  const kit = makeStyleKit(THREE, style, gk);
  const world = pickPlanetWorld(traits);
  const molten = world === "moltenvoid";
  const liquid = world === "liquidsea";
  // #1 the body is now a SUPERQUADRIC whose exponents key off the species body-plan,
  // so each genre's fly-away planet has a distinct (de-squared) silhouette — rounder,
  // pinched, or octahedral — while keeping its baked latitude bands + render style.
  const geo = bandedBody(THREE, traits, seed, gk);
  const col = planetColor(THREE, traits);
  const acc = (traits && traits.palette && traits.palette.accent) || { h: 200, s: 0.85, l: 0.6 };
  const accHex = (dh, s, l) => new THREE.Color().setHSL(((((acc.h + (dh || 0)) % 360) + 360) % 360) / 360, s == null ? 0.9 : s, l == null ? 0.6 : l);
  // moltenvoid glows hot; liquidsea is a smooth (non-faceted) ocean; else the flat
  // low-poly gas-giant. The body keeps its styled + banded surface (the render-style
  // highlight) — worlds ADD orbiting/surface features around it.
  const body = new THREE.Mesh(geo, kit.surface({
    color: col, emissive: col.clone().multiplyScalar(molten ? 0.55 : 0.18),
    vertexColors: true, flatShading: !liquid,
  }));
  body.name = "planet-body";
  body.castShadow = false; body.receiveShadow = false;
  group.add(body);

  const rnd = rng32((((seed | 0) || 1) ^ 0x51ced ^ 0x9e37) >>> 0);
  const spinners = [];   // { obj, rate } children the update() orbits/spins

  // RINGS — prominent on ring/cloud worlds, a lone thin ring on ~half other seeds.
  const nRing = world === "ringworld" ? 2 : world === "cloudsea" ? 1 : (((seed | 0) & 1) === 0 ? 1 : 0);
  for (let i = 0; i < nRing; i++) {
    // #2 a CURVE-SWEPT TUBE ring (a closed spline circle) instead of a flat disc —
    // a real solid band that catches the light around the planet.
    const rr = 1.5 + i * 0.55;
    const pts = [];
    for (let a = 0; a < 28; a++) { const t = (a / 28) * TAU; pts.push([Math.cos(t) * rr, 0, Math.sin(t) * rr]); }
    const rmat = new THREE.MeshBasicMaterial({ color: accHex(i * 40, 0.7, 0.7), transparent: true, opacity: 0.5, side: THREE.DoubleSide, toneMapped: false });
    const ring = new THREE.Mesh(gk.tube(pts, { radius: 0.06 + rnd() * 0.05, radialSegments: 6, tubularSegments: 56, closed: true }), rmat);
    ring.name = "planet-ring";
    ring.rotation.x = Math.PI / 2 - 0.4 + (rnd() - 0.5) * 0.5;
    ring.rotation.y = (rnd() - 0.5) * 0.4;
    group.add(ring);
  }

  // MOONS / SKY ORBS — little glowing bodies orbiting on a pivot (cloud/spire/tendril
  // worlds get more company; every world gets at least a companion or two).
  const nMoon = world === "cloudsea" || world === "spiregarden" ? 3 : world === "tendrilforest" || world === "liquidsea" ? 2 : 1;
  for (let i = 0; i < nMoon; i++) {
    const pivot = new THREE.Object3D();
    pivot.rotation.set((rnd() - 0.5) * 1.2, rnd() * TAU, (rnd() - 0.5) * 1.2);
    const moon = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12 + rnd() * 0.14, 1),
      new THREE.MeshBasicMaterial({ color: accHex(180 + i * 30, 0.85, 0.66), toneMapped: false })
    );
    moon.position.set(1.9 + rnd() * 1.0, 0, 0);
    moon.name = "planet-moon";
    pivot.add(moon); group.add(pivot);
    spinners.push({ obj: pivot, rate: 0.25 + rnd() * 0.4 });
  }

  // CRYSTALFIELD — faceted shards jutting from the surface (one instanced mesh).
  if (world === "crystalfield") {
    const n = 24;
    const spikeMat = kit.surface({ color: accHex(140, 0.6, 0.4), emissive: accHex(160, 0.85, 0.4), emissiveIntensity: 0.4, flatShading: true });
    const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.5, 4), spikeMat, n);
    spikes.name = "planet-spikes";
    const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const u = rnd(), v = rnd(), th = Math.acos(2 * u - 1), ph = v * TAU;
      _d.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      _p.copy(_d).multiplyScalar(0.98);
      _q.setFromUnitVectors(_up, _d);
      const h = 0.5 + rnd() * 0.9;
      _s.set(1, h, 1);
      _m.compose(_p, _q, _s); spikes.setMatrixAt(i, _m);
    }
    spikes.instanceMatrix.needsUpdate = true;
    body.add(spikes);   // ride the body's spin
  }

  // MOLTENVOID — a bright inner glow shell so the world reads as lava-hot.
  if (molten) {
    const glow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.03, 2),
      new THREE.MeshBasicMaterial({ color: accHex(-180, 1.0, 0.5), transparent: true, opacity: 0.28, toneMapped: false })
    );
    glow.name = "planet-glow"; body.add(glow);
  }

  let t = 0;
  function update(dt) {
    t += dt || 0;
    body.rotation.y += (dt || 0) * 0.12;
    for (const sp of spinners) sp.obj.rotation.y += (dt || 0) * sp.rate;
    kit.tick(t);
  }
  function setPalette(tr) { body.material.color.copy(planetColor(THREE, tr)); }
  return { group, update, body, setPalette };
}

// a unit SUPERQUADRIC body (radius ~1) whose exponents key off the species body-plan
// — so the planet silhouette is distinct + de-squared per genre — with the same 4..7
// latitude bands baked into vertex colours. Deterministic (exponents + bands both key
// off the seed via mulberry32; no Math.random). Falls back to a plain banded sphere in
// look when exponents are ~1.
function bandedBody(THREE, traits, seed, gk) {
  const plan = traits && traits.body && traits.body.plan;
  const skin = traits && traits.skin;
  let e1 = 1, e2 = 1;                              // sphere default
  if (plan === "crystalline") { e1 = 1.6; e2 = 0.72; }
  else if (plan === "amorphous") { e1 = 1.35; e2 = 1.35; }
  else if (plan === "radial") { e1 = 0.72; e2 = 0.72; }
  else if (plan === "floating-gas") { e1 = 1.12; e2 = 1.12; }
  else if (plan === "insectoid") { e1 = 0.6; e2 = 1.2; }
  else if (skin === "chrome") { e1 = 0.82; e2 = 0.82; }
  const rnd0 = rng32((((seed | 0) || 1) ^ 0x2ab37) >>> 0);
  e1 *= 0.85 + rnd0() * 0.3; e2 *= 0.85 + rnd0() * 0.3;
  const geo = gk.sq(Math.max(0.4, Math.min(2.2, e1)), Math.max(0.4, Math.min(2.2, e2)), 16);
  // normalize to max half-extent ~1 (geom sq is radius ~1, a fallback is ~0.5) so the
  // rings/spikes/glow (which assume a unit body) sit correctly regardless of source.
  geo.computeBoundingBox();
  const _bb = geo.boundingBox;
  const _r = Math.max(_bb.max.x, _bb.max.y, _bb.max.z, -_bb.min.x, -_bb.min.y, -_bb.min.z) || 1;
  geo.scale(1 / _r, 1 / _r, 1 / _r);
  const pos = geo.attributes.position, n = pos.count;
  const colors = new Float32Array(n * 3);
  const pal = (traits && traits.palette) || {};
  const sk = pal.skin || { h: 280, s: 0.5, l: 0.5 };
  const ac = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const rnd = rng32((((seed | 0) || 1) ^ 0x51ced) >>> 0);
  const nBands = 4 + Math.floor(rnd() * 4);       // 4..7 bands
  const bands = [];
  for (let i = 0; i < nBands; i++) {
    const h = (rnd() < 0.5 ? sk.h : ac.h) + (rnd() - 0.5) * 44;
    const s = 0.35 + rnd() * 0.4, l = 0.32 + rnd() * 0.32;
    bands.push(new THREE.Color().setHSL(((((h % 360) + 360) % 360) / 360), Math.min(1, s), Math.min(0.75, l)));
  }
  for (let i = 0; i < n; i++) {
    const lat = pos.getY(i) * 0.5 + 0.5;           // 0..1 pole to pole (radius ~1)
    const c = bands[Math.min(nBands - 1, Math.max(0, Math.floor(lat * nBands)))];
    const b = i * 3; colors[b] = c.r; colors[b + 1] = c.g; colors[b + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

// a unit sphere with 4..7 latitude bands baked into vertex colours (gas-giant look).
// Deterministic: band count + hues key off (seed, palette) via mulberry32, no random.
function bandedSphere(THREE, traits, seed) {
  const geo = new THREE.SphereGeometry(1, 20, 14).toNonIndexed();
  const pos = geo.attributes.position, n = pos.count;
  const colors = new Float32Array(n * 3);
  const pal = (traits && traits.palette) || {};
  const sk = pal.skin || { h: 280, s: 0.5, l: 0.5 };
  const ac = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const rnd = rng32((((seed | 0) || 1) ^ 0x51ced) >>> 0);
  const nBands = 4 + Math.floor(rnd() * 4);   // 4..7 bands
  const bands = [];
  for (let i = 0; i < nBands; i++) {
    const h = (rnd() < 0.5 ? sk.h : ac.h) + (rnd() - 0.5) * 44;
    const s = 0.35 + rnd() * 0.4, l = 0.32 + rnd() * 0.32;
    bands.push(new THREE.Color().setHSL(((((h % 360) + 360) % 360) / 360), Math.min(1, s), Math.min(0.75, l)));
  }
  for (let i = 0; i < n; i++) {
    const lat = pos.getY(i) * 0.5 + 0.5;                          // 0..1 pole to pole
    const c = bands[Math.min(nBands - 1, Math.floor(lat * nBands))];
    const b = i * 3; colors[b] = c.r; colors[b + 1] = c.g; colors[b + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function planetColor(THREE, traits) {
  const pal = (traits && traits.palette) || {};
  const s = pal.skin || { h: 280, s: 0.5, l: 0.5 };
  return new THREE.Color().setHSL(((s.h % 360) / 360), Math.min(1, (s.s || 0.5) + 0.15), Math.min(0.62, (s.l || 0.5) + 0.05));
}

export default { makeCockpit, makePlanet };
