// starcruise.js — THE CONTROLLER for the 🛸 STAR-CRUISE 3D video mode.
//
// A PS1-era-lofi 3D flythrough of the genre star map: the playhead is the pilot's
// cockpit view; you fly genre->genre, LAND on planets, and 1..N aliens form a BAND
// that plays invented procedural instruments IN TIME with the music. Everything is
// procedural (no external art) and derived from each genre's 23-float feature
// vector.
//
// LOAD LAW: Three.js is NOT in index.html's initial load. This controller
// dynamic-`import()`s vendor/three/three.module.min.js ONLY on the first start(),
// so the zero-dependency initial page weight + mobile bundle are untouched until
// the 🛸 chip is tapped. The mode is OPT-IN / OFF by default; when off the app
// behaves exactly as before.
//
// This file is loaded as a side-effecting ES module (see index.html) that INJECTS
// its own chip into #chips and wires start()/stop(). It owns the renderer, the
// low-res render target, the cockpit camera, the scene, and the RAF loop; it wires
// flight + traits + alien + backdrop + postfx (currently STUBS — the Build phase
// replaces them behind these same contracts). It reads the app's REAL travel +
// beat via documented hooks (getTravel / getBeat) and must NOT fork the travel
// logic or touch any render-path/engine file.

import { S } from "./state.js";
import { pointOnPath } from "./share.js";   // measure->world position along the drawn path

// engine globals live on window (loaded before app/main.js): K = GenreKernel,
// V = GenreVerifier. Read them lazily at trait time so this module loads even if
// they arrive a tick late.
const K = () => window.GenreKernel;
const V = () => window.GenreVerifier;

// ---- TEST INJECTION (production-null) -------------------------------------------
// The headless probe scripts a deterministic travel/beat stream to force a clean
// FLY->APPROACH->LAND->DANCE cycle (and to place the beatPhase exactly ON a hit).
// When both overrides are null — i.e. always, in production — getTravel/getBeat
// read the REAL app store below and behave exactly as before. Set via
// window.__STARCRUISE.__injectTravel / __injectBeat.
let _tvInject = null;   // a plain { weights, dominant, position, live, seed } or null
let _btInject = null;   // a plain { bpm, spb, cbeats, serial, beatPhase, playing } or null

// ---- THE REAL HOOKS (documented in docs/STARCRUISE.md) --------------------------
// getTravel(): the explorer's CURRENT travel state — the same weights/dominant the
// star map + live audio already use. S.weights is the live blend [{g,w}]; S.travel
// is {seg,t}; pointOnPath(S.travel) is the world position along the DRAWN path.
// This does NOT fork the travel logic — it only READS the store the app maintains.
function getTravel() {
  if (_tvInject) return _tvInject;
  const ws = (S.weights || []).filter((w) => w && w.w > 0).slice().sort((a, b) => b.w - a.w);
  const dominant = ws.length ? ws[0].g : null;
  let position = null;
  try { position = S.waypoints && S.waypoints.length >= 2 ? pointOnPath(S.travel) : null; } catch (e) {}
  return { weights: ws, dominant, position, live: !!S.live, seed: S.seed };
}

// getBeat(): the REAL audio beat. onBar (app/live.js) writes S.barInfo every bar
// with { serial, spb (sec/beat), cbeats, when, ... }; S.playing.bpm is the tempo.
// We derive a smooth beatPhase (0..1 within a beat) from a local clock that RESETS
// on each new bar serial — so dance hits stay locked to the bar grid without
// touching the engine. SHIM NOTE: the Integrate phase can make this sample-accurate
// by reading the AudioContext clock + info.when off faustHandle; the bar-synced
// local clock here is intentionally dependency-free for the scaffold.
const _beat = { serial: -1, t0: 0 };
function getBeat() {
  if (_btInject) return _btInject;
  const info = S.barInfo;
  const bpm = (S.playing && S.playing.bpm) || 120;
  const spb = info && info.spb ? info.spb : 60 / bpm;
  const cbeats = info && info.cbeats ? info.cbeats : 8;
  const serial = info ? info.serial : -1;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (serial !== _beat.serial) { _beat.serial = serial; _beat.t0 = now; }
  const beatsIn = S.live && spb > 0 ? ((now - _beat.t0) / 1000) / spb : (now / 1000) / spb;
  const beatPhase = beatsIn - Math.floor(beatsIn);
  return { bpm, spb, cbeats, serial, beat: Math.floor(beatsIn), beatPhase, playing: !!S.live };
}

// ---- module handles (lazy) ------------------------------------------------------
let THREE = null;            // the vendored namespace, loaded on first start()
let mods = null;             // { traitsFromGenre, makeAlien, makeBackdrop, makePS1, makeFlight }
let running = false, loaded = false;
let renderer, scene, camera, lowResTarget, ps1, flight, clock;
let displayCanvas = null;
let raf = 0, lastT = 0;
let band = [];               // [{group, update}]
let dancers = [];            // [{group, update}] — extra background dancer-aliens (no instrument)
let stage = null;            // shadow-RECEIVING stage disc under the band
let backdrop = null;         // {group, update}
let ship = null;             // { group, update(dt, phase, landProgress) } — the greet-craft saucer
let cockpit = null;          // { group, update, setGenres } — the transit COCKPIT interior
let planet = null;           // { group, update, setPalette } — the planet you leave/approach
let sun = null;              // the shadow-casting KEY light (module-scoped for the frustum + probes)
let starfield = null;        // persistent THREE.Points deep-space (whole-session)
let curTraits = null;        // TRAITS of the currently-spawned band (headless-probe visibility)
let curDominant = null;
let lastState = null;        // last flight state (headless-probe visibility)
const bandCentroid = { x: 0, y: 1.2, z: 0.6 };   // centre of the spawned players (orbit target)
// the SPACE ANCHOR — a fixed spot high above the band scene where the cockpit set +
// planet live during transit, so they never overlap the (despawned) surface scene.
const SPACE_ANCHOR = { x: 0, y: 40, z: 0 };
const SKY_COLOR = 0x1a0b2e;    // dusk-purple sky at the surface (fades to space on liftoff)
const SPACE_COLOR = 0x02010a;  // near-black deep space

// internal framebuffer — the render resolution. RAISED A LOT from the old 320x240
// potato: now NEAR-NATIVE, DPR-aware, with the long edge capped (~1600 desktop /
// ~1080 coarse-pointer mobile) so it's crisp on desktop + high on modern phones
// while staying cheap (resolution is fill-rate; the geometry stays low-poly). The
// canvas backing store is driven to this same size so the final blit is ~1:1.
let lowW = 1280, lowH = 720;       // actual values recomputed in computeLowRes()
function isCoarse() { try { return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (e) { return false; } }
function computeLowRes() {
  const w = window.innerWidth || 640, h = window.innerHeight || 480;
  const aspect = w > 0 && h > 0 ? w / h : 4 / 3;
  const coarse = isCoarse();
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const cap = coarse ? 1080 : 1600;                 // hard cap on the long edge
  const cssLong = Math.max(w, h);
  const renderLong = Math.min(cssLong * dpr, cap);  // near-native, capped
  const scale = cssLong > 0 ? renderLong / cssLong : 1;
  let tw, th;
  if (aspect >= 1) { tw = Math.round(w * scale); th = Math.round(tw / aspect); }
  else { th = Math.round(h * scale); tw = Math.round(th * aspect); }
  // clamp to sane bounds + keep even.
  lowW = Math.max(320, Math.min(1600, tw)) & ~1;
  lowH = Math.max(240, Math.min(1600, th)) & ~1;
  return { lowW, lowH };
}
// (re)build the render target + PS1 pass at the current resolution and drive the
// canvas backing store to the same size (blit ~1:1). Called on start() and on resize
// / DPR change; disposes the previous target + pass so nothing leaks.
function buildRenderTarget() {
  computeLowRes();
  if (ps1 && ps1.dispose) { try { ps1.dispose(); } catch (e) {} }
  if (lowResTarget) { try { lowResTarget.dispose(); } catch (e) {} }
  lowResTarget = new THREE.WebGLRenderTarget(lowW, lowH, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true,
  });
  ps1 = mods.makePS1(THREE, renderer, lowResTarget);
  ps1.setSize(lowW, lowH);                 // canvas backing store == target size (crisp, near-native)
  if (camera) { camera.aspect = lowW / lowH; camera.updateProjectionMatrix(); }
}
const BAND_CAP = 8;               // HARD mobile cap on simultaneous aliens (traits caps at 6)

// ---- interactive camera (orbit + dolly + pan) -----------------------------------
// A hand-rolled orbit controller (NO vendored Three addon — the core module only).
// It orbits `target`, dollies via `dist`, and pans `target` with WASD/arrows. It is
// SEEDED from the flight machine's front-on landed pose (seedOrbitFromPose) and only
// DRIVES the camera while we're parked (landed); auto-flight owns the camera in
// transit. Input handlers below mutate this object.
const orbit = {
  target: null,                   // THREE.Vector3, set on start()
  dist: 8, minDist: 2.2, maxDist: 60,
  yaw: 0, pitch: 0.18, fov: 58,
  minPitch: -1.35, maxPitch: 1.45,
};
let wasLanded = false;            // edge-detect entering a landed phase (seed once)
const keysDown = Object.create(null);   // pressed movement keys
let exitBtn = null;               // the always-visible ✕ EXIT affordance
// pointer/touch drag bookkeeping.
let dragging = false, lastPX = 0, lastPY = 0;
let pinchDist = 0;                // last two-finger distance (touch dolly)
const LANDED_PHASES = { LAND: 1, OPEN: 1, GREET: 1, DANCE: 1 };

// lazy-load Three + the sub-modules exactly once.
async function ensureLoaded() {
  if (loaded) return;
  THREE = await import("../vendor/three/three.module.min.js");
  // some bundlers namespace the default; the ESM build exports named symbols.
  if (THREE.default && !THREE.WebGLRenderer) THREE = THREE.default;
  const [traits, alien, backdropMod, postfx, flightMod, shipMod] = await Promise.all([
    import("./starcruise/traits.js"),
    import("./starcruise/alien.js"),
    import("./starcruise/backdrop.js"),
    import("./starcruise/postfx.js"),
    import("./starcruise/flight.js"),
    import("./starcruise/ship.js"),
  ]);
  mods = {
    traitsFromGenre: traits.traitsFromGenre,
    makeAlien: alien.makeAlien,
    makeBackdrop: backdropMod.makeBackdrop,
    makePS1: postfx.makePS1,
    makeFlight: flightMod.makeFlight,
    makeCockpit: shipMod.makeCockpit,
    makePlanet: shipMod.makePlanet,
  };
  loaded = true;
}

// build the band + backdrop + ship for a genre (called on land / dominant change).
// Everything spawned here is torn down together in despawnBand().
function spawnFor(genreOrWeights, seed) {
  despawnBand();
  const useSeed = seed || S.seed || 1;
  const traits = mods.traitsFromGenre(K(), V(), genreOrWeights, useSeed);
  curTraits = traits;
  // backdrop (procedural city/farm behind the band).
  backdrop = mods.makeBackdrop(THREE, traits, useSeed);
  scene.add(backdrop.group);
  // ship: the pilot's craft the band greets you in front of; its ramp opens on land.
  ship = makeShip(traits, useSeed);
  scene.add(ship.group);
  // STAGE: a shadow-RECEIVING disc under the band so the key light's cast shadows
  // land on a clean plinth (sits just above the backdrop ground to avoid z-fight).
  {
    const smat = new THREE.MeshLambertMaterial({ color: 0x1b1526, flatShading: true });
    smat.polygonOffset = true; smat.polygonOffsetFactor = 1; smat.polygonOffsetUnits = 1;
    stage = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), smat);
    stage.rotation.x = -Math.PI / 2; stage.position.y = 0.02;
    stage.receiveShadow = true; stage.name = "stage";
    scene.add(stage);
  }
  // band: one alien per member (mobile-capped), arranged in a shallow arc that faces
  // the cockpit (+Z). Outer members sit slightly back and yaw inward so it reads as a
  // stage arc, not a firing line. They stand on the ground (y=0), in front of the ship.
  const members = traits.band.slice(0, BAND_CAP);
  const n = members.length;
  let cx = 0, cz = 0;
  band = members.map((member, i) => {
    const a = mods.makeAlien(THREE, traits, member, useSeed + i * 101);
    const spread = 1.5;
    const off = (i - (n - 1) / 2);           // centered index, e.g. -1,0,1
    a.group.position.x = off * spread;
    a.group.position.z = 1.5 - Math.abs(off) * 0.35;   // shallow arc: center forward
    a.group.position.y = 0;
    a.group.rotation.y = -off * 0.10;        // yaw toward the pilot at the arc center
    enableShadows(a.group);                  // the players CAST shadows onto the stage
    scene.add(a.group);
    cx += a.group.position.x; cz += a.group.position.z;
    return a;
  });
  // orbit target = the CENTRE of the players (front-centred landed framing). y is an
  // eye-height above the stage so the camera looks AT the band, not their feet.
  bandCentroid.x = n ? cx / n : 0;
  bandCentroid.z = n ? cz / n : 0.6;
  bandCentroid.y = 1.2;

  // DANCERS: traits.dancers extra dancer-aliens (role='dancer', NO instrument) in a
  // ring/crowd AROUND + BEHIND the band, grooving to the same beat. Mobile-capped so
  // the crowd draw-calls stay bounded (they share the low-poly alien rig geometry).
  const wantD = Math.max(0, Math.round(traits.dancers || 0));
  const dCap = isCoarse() ? 5 : 8;
  const nd = Math.min(dCap, wantD);
  dancers = [];
  for (let i = 0; i < nd; i++) {
    const d = mods.makeAlien(THREE, traits, { role: "dancer" }, useSeed + 4200 + i * 37);
    // ring behind + beside the band: bias angles to the back hemisphere so the front
    // (camera) view of the players stays open. Radius grows with the crowd size.
    const seedR = mulberry(useSeed * 131 + i * 977);
    const ang = Math.PI * (0.55 + 1.9 * (i + 0.5) / nd) + (seedR() - 0.5) * 0.4;  // ~back arc
    const rad = 3.6 + (i % 2) * 1.1 + seedR() * 0.8;
    const px = bandCentroid.x + Math.cos(ang) * rad;
    const pz = bandCentroid.z + Math.sin(ang) * rad - 0.6;   // pushed back (-z)
    d.group.position.set(px, 0, pz);
    d.group.rotation.y = Math.atan2(bandCentroid.x - px, bandCentroid.z - pz);  // face the band
    const sc = 0.85 + seedR() * 0.25;
    d.group.scale.setScalar(sc);
    enableShadows(d.group);
    scene.add(d.group);
    dancers.push(d);
  }
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
// mark every mesh in a spawned group as a shadow caster + receiver so the key light
// MODELS the forms — done here (on our spawns) so shadows are guaranteed even before
// the alien/city agents wire castShadow into their own meshes.
function enableShadows(root) {
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}
// count shadow-casting meshes across the spawned band + dancers (shadow proof).
function countCasters() {
  let n = 0;
  const scan = (g) => g && g.group && g.group.traverse((o) => { if (o.isMesh && o.castShadow) n++; });
  band.forEach(scan); dancers.forEach(scan);
  return n;
}
function despawnBand() {
  for (const a of band) { scene.remove(a.group); disposeObj(a.group); }
  band = [];
  for (const d of dancers) { scene.remove(d.group); disposeObj(d.group); }
  dancers = [];
  if (stage) { scene.remove(stage); disposeObj(stage); stage = null; }
  if (backdrop) { scene.remove(backdrop.group); disposeObj(backdrop.group); backdrop = null; }
  if (ship) { scene.remove(ship.group); disposeObj(ship.group); ship = null; }
  curTraits = null;
}

// ---- SPACE / COCKPIT set (transit) ----------------------------------------------
// Spawned on DEPART, torn down on the next LAND. The cockpit interior frames the
// pilot; the planet recedes below through the viewport; the console screen shows the
// GENRE MAP. Positioned at SPACE_ANCHOR, high above the (despawned) surface scene.
function spawnSpaceRig(activeGenre) {
  despawnSpaceRig();
  cockpit = mods.makeCockpit(THREE, { genres: genreLabels(), active: genreLabelOf(activeGenre) });
  cockpit.group.position.set(SPACE_ANCHOR.x, SPACE_ANCHOR.y, SPACE_ANCHOR.z);
  scene.add(cockpit.group);
  planet = mods.makePlanet(THREE, curTraits, (S.seed | 0) || 1);
  scene.add(planet.group);
  spaceActiveGenre = activeGenre || null;
}
function despawnSpaceRig() {
  if (cockpit) { scene.remove(cockpit.group); disposeObj(cockpit.group); cockpit = null; }
  if (planet) { scene.remove(planet.group); disposeObj(planet.group); planet = null; }
  spaceActiveGenre = null;
}
let spaceActiveGenre = null;
// the genre list for the console display: prefer the kernel's genre labels.
function genreLabels() {
  try {
    const G = window.GenreKernel && window.GenreKernel.GENRES;
    if (G) return Object.keys(G).map((g) => (G[g] && G[g].label) || g);
  } catch (e) {}
  return ["vaporwave", "ambient", "techno"];
}
function genreLabelOf(g) {
  if (!g) return null;
  try { const G = window.GenreKernel && window.GenreKernel.GENRES; return (G && G[g] && G[g].label) || g; } catch (e) { return g; }
}

// makeShip(traits) — a tiny low-poly saucer the band greets you beside; its boarding
// ramp lowers as we touch down (landProgress) and it sits BEHIND the band toward the
// camera so the pilot's craft frames the scene. Cheap: a handful of flat-shaded
// prisms. Kept in the controller (procedural, asset-free, PS1 flat look).
function makeShip(traits, seed) {
  const g = new THREE.Object3D();
  const pal = (traits && traits.palette) || {};
  const acc = pal.accent || { h: 40, s: 0.85, l: 0.6 };
  const hullCol = new THREE.Color().setHSL((((acc.h + 200) % 360) / 360), 0.25, 0.30);
  const accCol = new THREE.Color().setHSL(((acc.h % 360) / 360), acc.s != null ? acc.s : 0.85, acc.l != null ? acc.l : 0.6);
  const hullMat = new THREE.MeshLambertMaterial({ color: hullCol, flatShading: true });
  const glowMat = new THREE.MeshLambertMaterial({ color: accCol, flatShading: true, emissive: accCol.clone().multiplyScalar(0.4 + 0.4 * (traits && traits.glow || 0)) });
  // saucer hull: two stacked octagonal frusta (a classic flying-disc silhouette).
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 1.0, 8), hullMat);
  lower.position.y = 1.0; g.add(lower);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 1.0, 8), hullMat);
  upper.position.y = 1.9; g.add(upper);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 0.7, 8), glowMat);
  dome.position.y = 2.6; g.add(dome);
  // running lights around the rim.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), glowMat);
    dot.position.set(Math.cos(a) * 3.0, 1.0, Math.sin(a) * 3.0); g.add(dot);
  }
  // boarding ramp (hinged at the hull front, lowers toward the band on the +Z side).
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 2.2), hullMat);
  const rampPivot = new THREE.Object3D(); rampPivot.position.set(0, 0.6, 2.8); g.add(rampPivot);
  ramp.position.set(0, 0, 1.1); rampPivot.add(ramp);
  // the ship sits BEHIND the band (further from the +Z camera) so it backs the stage.
  g.position.set(0, 0, -3.4);
  let clock = 0, rampAng = -Math.PI / 2;   // start closed (ramp up against the hull)
  function update(dt, phase, landProgress) {
    clock += dt || 0;
    g.rotation.y = Math.sin(clock * 0.2) * 0.03;              // idle drift
    dome.material.emissiveIntensity = 0.7 + Math.sin(clock * 3) * 0.2;
    // OPEN/GREET/DANCE (or high landProgress) -> ramp down to the ground.
    const open = (phase === "OPEN" || phase === "GREET" || phase === "DANCE") ? 1 : Math.max(0, (landProgress || 0) - 0.7) / 0.3;
    const target = -Math.PI / 2 + open * (Math.PI / 2);      // -90deg closed -> 0deg down
    rampAng += (target - rampAng) * Math.min(1, (dt || 0) * 4);
    rampPivot.rotation.x = rampAng;
  }
  return { group: g, update };
}
function disposeObj(obj) {
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

// ---- lifecycle ------------------------------------------------------------------
export async function start() {
  if (running) return;
  await ensureLoaded();
  running = true;

  displayCanvas = document.createElement("canvas");
  displayCanvas.id = "starcruise-canvas";
  displayCanvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:40;image-rendering:pixelated;background:#0a0410";
  document.body.appendChild(displayCanvas);
  document.body.classList.add("view-starcruise");

  renderer = new THREE.WebGLRenderer({ canvas: displayCanvas, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  // SHADOWS ON: one PCF-soft shadow map, MODELS the forms (light-to-dark falloff +
  // cast shadows) so the aliens/city read 3D instead of flat. Only the key light
  // casts; the map is modest (smaller on mobile) with a tight frustum around the band.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  _spaceCol = new THREE.Color(SPACE_COLOR);   // reused for the sky->space fade in transit
  _lastActive = null;
  // BRIGHT-BUT-MODELLED lofi lighting. The scene was deliberately brightened from
  // too-dark; we keep it bright but pull the flat FILL DOWN (ambient + hemisphere)
  // and let a strong KEY directional light MODEL the forms with a clear light-to-dark
  // falloff + cast shadows. A soft back/rim fill keeps the shadow side reading colour
  // so it's not murky. (linear->sRGB output fix lives in postfx.js.)
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));                 // was 1.15 (flat floor down)
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x6a4a76, 0.55));    // was 1.2 (cyan sky / magenta ground)
  sun = new THREE.DirectionalLight(0xfff2e0, 1.75);                  // the KEY that models the forms
  sun.position.set(6, 11, 7);
  sun.castShadow = true;
  const shMap = isCoarse() ? 512 : 1024;                            // modest; smaller on mobile
  sun.shadow.mapSize.set(shMap, shMap);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 44;
  const F = 11;                                                     // TIGHT ortho frustum around the band
  sun.shadow.camera.left = -F; sun.shadow.camera.right = F;
  sun.shadow.camera.top = F; sun.shadow.camera.bottom = -F;
  sun.shadow.bias = -0.0012;
  scene.add(sun);
  scene.add(sun.target);                                            // aim the shadow frustum at the band
  const backFill = new THREE.DirectionalLight(0xffd0f2, 0.5); backFill.position.set(-5, 3, -6); scene.add(backFill);

  // build the near-native render target + PS1 pass + size the canvas (near 1:1 blit).
  buildRenderTarget();

  // persistent STARFIELD — the deep-space you fly through between planets. It lives
  // for the whole session (NOT despawned on depart) so frames are never blank in
  // transit; a single THREE.Points draw call, disposed in stop().
  {
    const N = 500, pos = new Float32Array(N * 3);
    let s = 0x51ce77 >>> 0;                                  // seeded scatter (deterministic)
    const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < N; i++) {
      const r = 60 + rnd() * 80, th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = 10 + Math.abs(r * Math.cos(ph)) * 0.6;   // bias above the horizon
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starfield = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.6, sizeAttenuation: true }));
    starfield.frustumCulled = false;
    scene.add(starfield);
  }

  camera = new THREE.PerspectiveCamera(60, lowW / lowH, 0.1, 300);
  camera.position.set(0, 3, 8);
  camera.lookAt(0, 1, 0);

  // orbit target = the band's centre; seeded FRONT-ON the moment we land.
  orbit.target = new THREE.Vector3(bandCentroid.x, bandCentroid.y, bandCentroid.z);
  wasLanded = false;

  clock = { now: (typeof performance !== "undefined" ? performance.now() : Date.now()) };

  // flight state machine driven by the REAL travel + beat hooks.
  flight = mods.makeFlight({ getTravel, getBeat });
  flight.events.on("land", () => {
    despawnSpaceRig();                       // leaving transit — drop the cockpit set
    const tv = getTravel();
    spawnFor(tv.weights && tv.weights.length ? tv.weights : (tv.dominant || firstGenre()), S.seed);
    curDominant = tv.dominant;
    wasLanded = false;                        // force a fresh FRONT-ON seed next frame
  });
  // DEPART: lift off. Drop the surface ensemble and raise the COCKPIT set so you fly
  // away through space with the planet receding below + the genre display lit.
  flight.events.on("depart", (e) => {
    despawnBand();
    spawnSpaceRig((e && e.to) || curDominant || (getTravel().dominant));
  });

  // spawn an initial band immediately so the very first frame is non-blank even
  // before the flight machine reaches LAND (and for headless proof).
  const tv0 = getTravel();
  spawnFor(tv0.weights && tv0.weights.length ? tv0.weights : firstGenre(), S.seed);
  curDominant = tv0.dominant;

  mountExit();
  bindInput();
  window.addEventListener("resize", onResize);
  lastT = clock.now;
  loop();
  window.__STARCRUISE && (window.__STARCRUISE.running = true);
}

// ---- ALWAYS-VISIBLE EXIT affordance ---------------------------------------------
// The full-screen overlay canvas covers the chip row, so the mode MUST carry its own
// escape hatch. This ✕ EXIT button sits ABOVE the canvas (z-index 60 > canvas 40),
// keeps pointer-events even though the canvas eats drags, and is a fat thumb target
// on mobile. Tapping it (or Escape) stops the mode and restores the app. The user
// must NEVER be trapped.
function mountExit() {
  if (exitBtn) return;
  exitBtn = document.createElement("button");
  exitBtn.id = "starcruise-exit";
  exitBtn.type = "button";
  exitBtn.setAttribute("aria-label", "Exit star-cruise");
  exitBtn.textContent = "✕ EXIT";
  exitBtn.style.cssText = [
    "position:fixed", "top:max(12px,env(safe-area-inset-top))",
    "right:max(12px,env(safe-area-inset-right))", "z-index:60",
    "min-width:76px", "min-height:48px", "padding:10px 16px",
    "font:600 15px/1 system-ui,sans-serif", "letter-spacing:.06em",
    "color:#fff", "background:rgba(20,6,30,.72)",
    "border:2px solid rgba(255,255,255,.85)", "border-radius:24px",
    "box-shadow:0 2px 10px rgba(0,0,0,.5)", "cursor:pointer",
    "-webkit-tap-highlight-color:transparent", "touch-action:manipulation",
    "user-select:none", "pointer-events:auto",
  ].join(";");
  // pointerup/click both stop — pointerup wins on touch even if a synthetic click is
  // suppressed by the canvas's drag handling.
  const doExit = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } stop(); };
  exitBtn.addEventListener("click", doExit);
  exitBtn.addEventListener("pointerup", doExit);
  document.body.appendChild(exitBtn);
}
function unmountExit() {
  if (exitBtn && exitBtn.parentNode) exitBtn.parentNode.removeChild(exitBtn);
  exitBtn = null;
}

// ---- input wiring (mouse + touch + keys) ----------------------------------------
// Attached to the display canvas so nav works without breaking the app's global
// iOS multi-touch preventDefault (that guard only fires for touches.length>1; here
// we preventDefault our OWN single-touch drag + wheel dolly on the overlay). Escape
// + movement keys are on window (removed on stop).
function bindInput() {
  const c = displayCanvas;
  c.style.touchAction = "none";                    // we own all gestures on the overlay
  c.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  c.addEventListener("wheel", onWheel, { passive: false });
  c.addEventListener("touchstart", onTouchStart, { passive: false });
  c.addEventListener("touchmove", onTouchMove, { passive: false });
  c.addEventListener("touchend", onTouchEnd, { passive: false });
  c.addEventListener("touchcancel", onTouchEnd, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}
function unbindInput() {
  const c = displayCanvas;
  if (c) {
    c.removeEventListener("mousedown", onMouseDown);
    c.removeEventListener("wheel", onWheel);
    c.removeEventListener("touchstart", onTouchStart);
    c.removeEventListener("touchmove", onTouchMove);
    c.removeEventListener("touchend", onTouchEnd);
    c.removeEventListener("touchcancel", onTouchEnd);
  }
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  dragging = false; pinchDist = 0;
  for (const k in keysDown) delete keysDown[k];
}

// -- orbit math -------------------------------------------------------------------
const ORBIT_SPEED = 0.0055;       // radians per pixel dragged
function orbitBy(dx, dy) {
  orbit.yaw -= dx * ORBIT_SPEED;
  orbit.pitch = Math.max(orbit.minPitch, Math.min(orbit.maxPitch, orbit.pitch - dy * ORBIT_SPEED));
}
function dollyBy(factor) {
  orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist * factor));
}
// seed the orbit FRONT-CENTRED on the band the moment we land: target = the band
// centroid, camera placed in FRONT of the players (who face +Z / the camera) at a
// sensible distance framed to the crowd width, looking slightly down. This is the
// FIX for the user's "side profile / off to the left / zoomed out" landed view — the
// framing no longer leaks the drifted flight pose; it derives straight from the band.
function seedOrbitFrontOn() {
  if (!orbit.target) return;
  orbit.target.set(bandCentroid.x, bandCentroid.y, bandCentroid.z);
  const width = 1.5 * Math.max(1, band.length);       // arc spread ~ crowd size
  orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, 5.5 + width * 0.55));
  orbit.yaw = 0;                                       // 0 = looking from +Z straight at the front
  orbit.pitch = 0.16;                                  // a gentle downward tilt (eye level-ish)
  orbit.fov = 56;
}
// seed the orbit from a flight cameraPose so takeover is jump-free & front-on.
function seedOrbitFromPose(p) {
  if (!p || !orbit.target) return;
  orbit.target.set(p.lookAt.x, p.lookAt.y, p.lookAt.z);
  const dx = p.position.x - p.lookAt.x, dy = p.position.y - p.lookAt.y, dz = p.position.z - p.lookAt.z;
  const d = Math.hypot(dx, dy, dz) || orbit.dist;
  orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, d));
  orbit.yaw = Math.atan2(dx, dz);
  orbit.pitch = Math.max(orbit.minPitch, Math.min(orbit.maxPitch, Math.asin(Math.max(-0.999, Math.min(0.999, dy / d)))));
  orbit.fov = p.fov || orbit.fov;
}
// drive the real camera from the orbit state.
function applyOrbitToCamera() {
  const cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
  const sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw);
  const t = orbit.target;
  camera.position.set(t.x + orbit.dist * cp * sy, t.y + orbit.dist * sp, t.z + orbit.dist * cp * cy);
  camera.lookAt(t.x, t.y, t.z);
  if (camera.fov !== orbit.fov) { camera.fov = orbit.fov; camera.updateProjectionMatrix(); }
}
// WASD / arrows = fly: pan the orbit target in the camera's ground frame (+ up/down).
function applyKeyPan(dt) {
  const fwd = (keysDown["w"] || keysDown["arrowup"] ? 1 : 0) - (keysDown["s"] || keysDown["arrowdown"] ? 1 : 0);
  const str = (keysDown["d"] || keysDown["arrowright"] ? 1 : 0) - (keysDown["a"] || keysDown["arrowleft"] ? 1 : 0);
  const up = (keysDown["e"] || keysDown[" "] ? 1 : 0) - (keysDown["q"] ? 1 : 0);
  if (!fwd && !str && !up) return;
  const speed = (2.0 + orbit.dist * 0.5) * dt;   // scales with zoom-out
  const sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw);
  // horizontal forward (camera -> target) and right vectors from yaw.
  const fx = -sy, fz = -cy, rx = cy, rz = -sy;
  const t = orbit.target;
  t.x += (fx * fwd + rx * str) * speed;
  t.z += (fz * fwd + rz * str) * speed;
  t.y = Math.max(0, t.y + up * speed);
}

// -- pointer handlers -------------------------------------------------------------
function onMouseDown(e) { dragging = true; lastPX = e.clientX; lastPY = e.clientY; }
function onMouseMove(e) {
  if (!dragging) return;
  orbitBy(e.clientX - lastPX, e.clientY - lastPY);
  lastPX = e.clientX; lastPY = e.clientY;
}
function onMouseUp() { dragging = false; }
function onWheel(e) {
  e.preventDefault();
  dollyBy(Math.exp((e.deltaY || 0) * 0.0012));
}
function onTouchStart(e) {
  if (e.touches.length === 1) {
    dragging = true; lastPX = e.touches[0].clientX; lastPY = e.touches[0].clientY;
  } else if (e.touches.length >= 2) {
    dragging = false;
    pinchDist = touchSpread(e);
  }
  e.preventDefault();
}
function onTouchMove(e) {
  if (e.touches.length >= 2) {
    // two-finger PINCH = dolly.
    const d = touchSpread(e);
    if (pinchDist > 0 && d > 0) dollyBy(pinchDist / d);
    pinchDist = d;
  } else if (e.touches.length === 1 && dragging) {
    // single-finger drag = orbit / look.
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    orbitBy(x - lastPX, y - lastPY);
    lastPX = x; lastPY = y;
  }
  e.preventDefault();
}
function onTouchEnd(e) {
  if (!e.touches || e.touches.length === 0) { dragging = false; pinchDist = 0; }
  else if (e.touches.length === 1) { dragging = true; lastPX = e.touches[0].clientX; lastPY = e.touches[0].clientY; pinchDist = 0; }
}
function touchSpread(e) {
  const a = e.touches[0], b = e.touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
// -- keys -------------------------------------------------------------------------
const NAV_KEYS = { w: 1, a: 1, s: 1, d: 1, q: 1, e: 1, " ": 1, arrowup: 1, arrowdown: 1, arrowleft: 1, arrowright: 1 };
function onKeyDown(e) {
  if (e.key === "Escape") { e.preventDefault(); stop(); return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (NAV_KEYS[k]) { keysDown[k] = true; e.preventDefault(); }
}
function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (NAV_KEYS[k]) { keysDown[k] = false; e.preventDefault(); }
}

function firstGenre() { try { return (window.GenreKernel && GenreKernel.GENRES) ? Object.keys(GenreKernel.GENRES)[0] : "vaporwave"; } catch (e) { return "vaporwave"; } }

function onResize() {
  if (!running) return;
  // rebuild the render target at the new size / aspect (near-native, DPR-aware).
  buildRenderTarget();
}

export function update(dt) {
  if (!running) return;
  const st = flight.update(dt);
  lastState = st;
  const p = st.cameraPose;
  // CAMERA ROUTING: auto-flight owns the camera IN TRANSIT (FLY/APPROACH/DEPART);
  // once we're PARKED (LAND/OPEN/GREET/DANCE) the USER takes over via the orbit
  // controller — drag to look, wheel/pinch to zoom, WASD/arrows to fly. On the frame
  // we first land, seed the orbit from the flight's front-on pose so the handover is
  // jump-free and framed FROM THE FRONT, then leave the user in control.
  const landed = !!LANDED_PHASES[st.phase];
  if (landed) {
    // seed FRONT-CENTRED on the band once on touchdown, then hand off to the user's
    // orbit (drag = look, wheel/pinch = zoom, WASD/arrows = fly). Restore the surface
    // sky (transit fades the background toward space).
    if (!wasLanded) { seedOrbitFrontOn(); if (scene.background && scene.background.isColor) scene.background.setHex(SKY_COLOR); }
    applyKeyPan(dt);
    applyOrbitToCamera();
  } else if (cockpit) {
    // IN TRANSIT WITH THE COCKPIT SET: the pilot sits at the console looking OUT the
    // viewport at the planet receding below + the stars, the genre display lit. The
    // camera is fixed to the cockpit interior; spaceProgress drives the planet + fade.
    updateSpaceRig(dt, st);
  } else {
    // bootstrap transit (before the first depart): follow the cinematic flight pose,
    // and keep the orbit shadowing it so the moment we land handover starts from here.
    camera.position.set(p.position.x, p.position.y, p.position.z);
    camera.lookAt(p.lookAt.x, p.lookAt.y, p.lookAt.z);
    if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
    seedOrbitFromPose(p);
  }
  wasLanded = landed;
  // keep the shadow frustum + key aimed at wherever we are (band when landed, cockpit
  // in transit) so cast shadows always land under the subject.
  if (sun) {
    const tx = (landed || !cockpit) ? bandCentroid.x : SPACE_ANCHOR.x;
    const ty = (landed || !cockpit) ? 0 : SPACE_ANCHOR.y;
    const tz = (landed || !cockpit) ? bandCentroid.z : SPACE_ANCHOR.z;
    sun.target.position.set(tx, ty, tz);
    sun.position.set(tx + 6, ty + 11, tz + 7);
    sun.target.updateMatrixWorld();
  }
  // aliens groove + hit on the beat — ALL driven by the SAME st.beatPhase so the
  // whole band locks together to the shared audio beat. Dancers groove to the SAME
  // phase so the crowd moves with the players.
  for (const a of band) a.update(dt, st.beatPhase);
  for (const d of dancers) d.update(dt, st.beatPhase);
  if (backdrop) backdrop.update(dt);
  if (ship) ship.update(dt, st.phase, st.landProgress);
  ps1.render(scene, camera);
}

// updateSpaceRig(dt, st) — drive the COCKPIT transit: fade the sky to space, place
// the camera inside the cockpit looking out, recede/approach the planet below by
// spaceProgress, keep the genre display's active target current, and spin the planet.
function updateSpaceRig(dt, st) {
  const s = Math.max(0, Math.min(1, st.spaceProgress != null ? st.spaceProgress : 1));
  // sky -> space fade (bright dusk sky at the surface, near-black in deep space).
  if (scene.background && scene.background.isColor) {
    scene.background.setHex(SKY_COLOR).lerp(_spaceCol, s);
  }
  // camera INSIDE the cockpit, looking out the viewport (-Z) slightly down at the planet.
  camera.position.set(SPACE_ANCHOR.x, SPACE_ANCHOR.y + 0.1, SPACE_ANCHOR.z + 0.15);
  camera.lookAt(SPACE_ANCHOR.x, SPACE_ANCHOR.y - 0.25, SPACE_ANCHOR.z - 4);
  if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
  cockpit.update(dt);
  // keep the display's highlighted target current as the blend resolves the next genre.
  const active = genreLabelOf(st.dominant || spaceActiveGenre);
  if (active && active !== _lastActive) { cockpit.setGenres(genreLabels(), active); _lastActive = active; }
  // planet BELOW + through the viewport: near/large when close to a surface (s~0),
  // far/small out in deep space (s~1) — so it RECEDES below on liftoff + GROWS on approach.
  if (planet) {
    if (curTraits && planet.setPalette) planet.setPalette(curTraits);
    const py = SPACE_ANCHOR.y + (-2 + (-18) * s);     // drops away below as we climb
    const pz = SPACE_ANCHOR.z - 9;
    const sc = 2.6 + (0.4 - 2.6) * s;                 // 2.6 near-surface -> 0.4 deep space
    planet.group.position.set(SPACE_ANCHOR.x, py, pz);
    planet.group.scale.setScalar(Math.max(0.4, sc));
    planet.update(dt);
  }
}
let _lastActive = null;
let _spaceCol = null;   // reusable THREE.Color for the sky->space lerp (set on start)

function loop() {
  if (!running) return;
  raf = requestAnimationFrame(loop);
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  const dt = Math.min(0.05, (now - lastT) / 1000);   // clamp to avoid huge steps on tab return
  lastT = now;
  try { update(dt); } catch (e) { /* keep the loop alive; report once */ if (!loop._warned) { console.warn("[starcruise] update error", e); loop._warned = true; } }
}

export function stop() {
  if (!running) return;
  running = false;
  if (raf) cancelAnimationFrame(raf), raf = 0;
  unbindInput();
  unmountExit();
  window.removeEventListener("resize", onResize);
  despawnBand();                                   // disposes band + dancers + stage + backdrop + ship
  despawnSpaceRig();                               // disposes cockpit + planet (if in transit)
  if (starfield) { scene.remove(starfield); disposeObj(starfield); starfield = null; }
  // dispose remaining GL resources (lights carry none; belt-and-braces geometry sweep).
  try { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } catch (e) {}
  try { ps1 && ps1.dispose && ps1.dispose(); } catch (e) {}
  try { lowResTarget && lowResTarget.dispose(); } catch (e) {}
  try { renderer && renderer.dispose(); } catch (e) {}
  if (displayCanvas && displayCanvas.parentNode) displayCanvas.parentNode.removeChild(displayCanvas);
  displayCanvas = null; renderer = null; scene = null; camera = null; lowResTarget = null; ps1 = null; flight = null;
  sun = null; _spaceCol = null; _lastActive = null;
  curTraits = null; curDominant = null;
  document.body.classList.remove("view-starcruise");
  const chip = document.getElementById("cruiseChip"); if (chip) chip.classList.remove("on");
  window.__STARCRUISE && (window.__STARCRUISE.running = false);
}

export function toggle() { return running ? (stop(), false) : (start(), true); }
export function isRunning() { return running; }

// ---- the 🛸 chip: injected into #chips (mirrors the ✦/⚙ chip pattern) -----------
function injectChip() {
  if (document.getElementById("cruiseChip")) return;
  const chips = document.getElementById("chips");
  if (!chips) return;
  const btn = document.createElement("button");
  btn.className = "chip"; btn.id = "cruiseChip";
  btn.title = "star-cruise: fly the genre map in 3D (loads a 3D engine on first tap)";
  btn.textContent = "🛸";
  btn.onclick = () => {
    const on = toggle();
    btn.classList.toggle("on", on === true);
    // toggle() may return a promise-less truthy for start(); reconcile after a tick.
    setTimeout(() => btn.classList.toggle("on", isRunning()), 0);
  };
  chips.appendChild(btn);
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectChip, { once: true });
  else injectChip();
}

// sampleLowRes() — read back the low-res target's pixels (works under headless
// WebGL regardless of preserveDrawingBuffer, unlike canvas.toDataURL). Returns a
// flat RGBA Uint8Array + a quick "is it non-blank / not all one colour" summary.
// Headless-proof hook; harmless in production (only called by the test).
function sampleLowRes() {
  if (!running || !renderer || !lowResTarget) return null;
  update(0);   // ensure a fresh render into the target
  const w = lowW, h = lowH, buf = new Uint8Array(w * h * 4);
  try { renderer.readRenderTargetPixels(lowResTarget, 0, 0, w, h, buf); } catch (e) { return { error: String(e) }; }
  // summarize: count distinct-ish colours + max channel spread.
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0, nonBg = 0;
  for (let i = 0; i < buf.length; i += 4) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (g < minG) minG = g; if (g > maxG) maxG = g;
    if (b < minB) minB = b; if (b > maxB) maxB = b;
    if (r > 20 || g > 20 || b > 30) nonBg++;   // brighter than the ~#0a0410 clear
  }
  const spread = Math.max(maxR - minR, maxG - minG, maxB - minB);
  return { w, h, pixels: buf.length / 4, spread, nonBg, blank: spread < 8, allOneColor: spread === 0 };
}

// debug / headless-probe hook (mirrors window.__X / window.__VIDEO).
window.__STARCRUISE = { start, stop, toggle, update, isRunning, getTravel, getBeat, running: false,
  canvas: () => displayCanvas, band: () => band, loaded: () => loaded, sampleLowRes,
  hasThree: () => !!(THREE && THREE.WebGLRenderer),
  // exit affordance + resolution probes (headless-proof; harmless in production).
  hasExit: () => !!(exitBtn && exitBtn.parentNode),
  clickExit: () => { if (exitBtn) exitBtn.click(); return !running; },
  lowRes: () => ({ w: lowW, h: lowH }),
  orbit: () => ({ yaw: orbit.yaw, pitch: orbit.pitch, dist: orbit.dist, fov: orbit.fov,
    target: orbit.target ? { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z } : null }),
  // camera pose probe — proves drag actually MOVES the view + the landed framing.
  cam: () => (camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov,
    tx: bandCentroid.x, ty: bandCentroid.y, tz: bandCentroid.z } : null),
  centroid: () => ({ x: bandCentroid.x, y: bandCentroid.y, z: bandCentroid.z }),
  // dispatch a synthetic drag on the canvas (headless nav proof).
  __drag: (dx, dy) => { orbitBy(dx || 0, dy || 0); if (LANDED_PHASES[(lastState || {}).phase]) applyOrbitToCamera(); return { yaw: orbit.yaw, pitch: orbit.pitch }; },
  // dancers + cockpit/space + shadow probes (headless-proof; harmless in production).
  dancers: () => dancers.length,
  space: () => ({ hasCockpit: !!cockpit, hasPlanet: !!planet,
    spaceProgress: lastState ? lastState.spaceProgress : null,
    genres: genreLabels().slice(0, 6), planetY: planet ? planet.group.position.y : null }),
  shadows: () => ({ enabled: !!(renderer && renderer.shadowMap && renderer.shadowMap.enabled),
    type: renderer && renderer.shadowMap ? renderer.shadowMap.type : null,
    sunCast: !!(sun && sun.castShadow), mapSize: sun ? sun.shadow.mapSize.x : null,
    bandCasters: countCasters() }),
  // __step(dt): advance one frame and return the flight state (phase probe).
  __step: (dt) => { update(dt || 0); return lastState; },
  state: () => lastState,
  // ---- headless-probe: scene inspection + deterministic travel/beat injection ----
  hasBackdrop: () => !!backdrop,
  hasShip: () => !!ship,
  hasCockpit: () => !!cockpit,
  hasPlanet: () => !!planet,
  sceneChildren: () => (scene ? scene.children.length : 0),
  traits: () => curTraits,
  // __injectTravel/__injectBeat(obj|null): OVERRIDE the real hooks with a scripted
  // stream so the probe can force a clean FLY->APPROACH->LAND cycle and park the
  // beatPhase exactly on a hit. Pass null to restore the real app hooks. Null in
  // production — this only fires when the probe sets it.
  __injectTravel: (o) => { _tvInject = o || null; },
  __injectBeat: (o) => { _btInject = o || null; },
  // __beatProbe(beatPhase): drive EVERY alien to a given beatPhase (0..1) and read
  // back each playing hand's distance to its instrument contact. dist~0 == the hand
  // is ON the contact (a hit). Used to prove hits land ON the beat and the whole
  // band shares one phase.
  __beatProbe: (beatPhase) => band.map((a) => {
    if (a.update) a.update(0, beatPhase);
    const d = a.debug ? a.debug() : null;
    return d ? { role: (d && d.playStyle) || "?", playStyle: d.playStyle, hitsPerBeat: d.hitsPerBeat, dist: d.dist } : null;
  }) };

export default { start, stop, toggle, update, isRunning };
