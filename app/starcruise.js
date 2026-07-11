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
let backdrop = null;         // {group, update}
let ship = null;             // { group, update(dt, phase, landProgress) } — the pilot's craft
let starfield = null;        // persistent THREE.Points deep-space (whole-session)
let curTraits = null;        // TRAITS of the currently-spawned band (headless-probe visibility)
let curDominant = null;
let lastState = null;        // last flight state (headless-probe visibility)

const LOW_W = 320, LOW_H = 240;   // internal framebuffer (mobile-first crunch)
const BAND_CAP = 8;               // HARD mobile cap on simultaneous aliens (traits caps at 6)

// lazy-load Three + the sub-modules exactly once.
async function ensureLoaded() {
  if (loaded) return;
  THREE = await import("../vendor/three/three.module.min.js");
  // some bundlers namespace the default; the ESM build exports named symbols.
  if (THREE.default && !THREE.WebGLRenderer) THREE = THREE.default;
  const [traits, alien, backdropMod, postfx, flightMod] = await Promise.all([
    import("./starcruise/traits.js"),
    import("./starcruise/alien.js"),
    import("./starcruise/backdrop.js"),
    import("./starcruise/postfx.js"),
    import("./starcruise/flight.js"),
  ]);
  mods = {
    traitsFromGenre: traits.traitsFromGenre,
    makeAlien: alien.makeAlien,
    makeBackdrop: backdropMod.makeBackdrop,
    makePS1: postfx.makePS1,
    makeFlight: flightMod.makeFlight,
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
  // band: one alien per member (mobile-capped), arranged in a shallow arc that faces
  // the cockpit (+Z). Outer members sit slightly back and yaw inward so it reads as a
  // stage arc, not a firing line. They stand on the ground (y=0), in front of the ship.
  const members = traits.band.slice(0, BAND_CAP);
  const n = members.length;
  band = members.map((member, i) => {
    const a = mods.makeAlien(THREE, traits, member, useSeed + i * 101);
    const spread = 1.5;
    const off = (i - (n - 1) / 2);           // centered index, e.g. -1,0,1
    a.group.position.x = off * spread;
    a.group.position.z = 1.5 - Math.abs(off) * 0.35;   // shallow arc: center forward
    a.group.position.y = 0;
    a.group.rotation.y = -off * 0.10;        // yaw toward the pilot at the arc center
    scene.add(a.group);
    return a;
  });
}
function despawnBand() {
  for (const a of band) { scene.remove(a.group); disposeObj(a.group); }
  band = [];
  if (backdrop) { scene.remove(backdrop.group); disposeObj(backdrop.group); backdrop = null; }
  if (ship) { scene.remove(ship.group); disposeObj(ship.group); ship = null; }
  curTraits = null;
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
    if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => { try { x.dispose(); } catch (e) {} }); }
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
  const w = window.innerWidth || 640, h = window.innerHeight || 480;

  // LOW-RES render target, NEAREST filtered = the crunchy PS1 framebuffer.
  lowResTarget = new THREE.WebGLRenderTarget(LOW_W, LOW_H, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
  });
  ps1 = mods.makePS1(THREE, renderer, lowResTarget);
  ps1.setSize(w, h);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0410);
  // BRIGHT, flat, vivid PS1-lofi lighting: a strong ambient floor + a bright
  // sky/ground hemisphere fill so NOTHING falls to shadow-black, plus a punchy key
  // and a back fill so the sides facing away from the sun still read colour. The
  // renderer keeps NoToneMapping (default) so colours stay flat/vertex-lit, not
  // filmic. (The linear->sRGB fix lives in postfx.js.)
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x7a5a86, 1.2)); // cyan sky / magenta ground
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.35); sun.position.set(3, 6, 4); scene.add(sun);
  const backFill = new THREE.DirectionalLight(0xffd0f2, 0.55); backFill.position.set(-4, 2, -5); scene.add(backFill);

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

  camera = new THREE.PerspectiveCamera(60, LOW_W / LOW_H, 0.1, 200);
  camera.position.set(0, 3, 8);
  camera.lookAt(0, 1, 0);

  clock = { now: (typeof performance !== "undefined" ? performance.now() : Date.now()) };

  // flight state machine driven by the REAL travel + beat hooks.
  flight = mods.makeFlight({ getTravel, getBeat });
  flight.events.on("land", () => {
    const tv = getTravel();
    spawnFor(tv.weights && tv.weights.length ? tv.weights : (tv.dominant || firstGenre()), S.seed);
    curDominant = tv.dominant;
  });
  flight.events.on("depart", () => { despawnBand(); });

  // spawn an initial band immediately so the very first frame is non-blank even
  // before the flight machine reaches LAND (and for headless proof).
  const tv0 = getTravel();
  spawnFor(tv0.weights && tv0.weights.length ? tv0.weights : firstGenre(), S.seed);
  curDominant = tv0.dominant;

  window.addEventListener("resize", onResize);
  lastT = clock.now;
  loop();
  window.__STARCRUISE && (window.__STARCRUISE.running = true);
}

function firstGenre() { try { return (window.GenreKernel && GenreKernel.GENRES) ? Object.keys(GenreKernel.GENRES)[0] : "vaporwave"; } catch (e) { return "vaporwave"; } }

function onResize() {
  if (!running) return;
  const w = window.innerWidth || 640, h = window.innerHeight || 480;
  ps1.setSize(w, h);
}

export function update(dt) {
  if (!running) return;
  const st = flight.update(dt);
  lastState = st;
  // camera follows the flight's cockpit pose.
  const p = st.cameraPose;
  camera.position.set(p.position.x, p.position.y, p.position.z);
  camera.lookAt(p.lookAt.x, p.lookAt.y, p.lookAt.z);
  // aliens groove + hit on the beat — ALL driven by the SAME st.beatPhase so the
  // whole band locks together to the shared audio beat.
  for (const a of band) a.update(dt, st.beatPhase);
  if (backdrop) backdrop.update(dt);
  if (ship) ship.update(dt, st.phase, st.landProgress);
  ps1.render(scene, camera);
}

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
  window.removeEventListener("resize", onResize);
  despawnBand();                                   // disposes band + backdrop + ship
  if (starfield) { scene.remove(starfield); disposeObj(starfield); starfield = null; }
  // dispose remaining GL resources (lights carry none; belt-and-braces geometry sweep).
  try { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } catch (e) {}
  try { lowResTarget && lowResTarget.dispose(); } catch (e) {}
  try { renderer && renderer.dispose(); } catch (e) {}
  if (displayCanvas && displayCanvas.parentNode) displayCanvas.parentNode.removeChild(displayCanvas);
  displayCanvas = null; renderer = null; scene = null; camera = null; lowResTarget = null; ps1 = null; flight = null;
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
  const w = LOW_W, h = LOW_H, buf = new Uint8Array(w * h * 4);
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
  // __step(dt): advance one frame and return the flight state (phase probe).
  __step: (dt) => { update(dt || 0); return lastState; },
  state: () => lastState,
  // ---- headless-probe: scene inspection + deterministic travel/beat injection ----
  hasBackdrop: () => !!backdrop,
  hasShip: () => !!ship,
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
