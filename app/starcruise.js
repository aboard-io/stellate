// starcruise.js — THE CONTROLLER for the 🛸 STAR-CRUISE 3D video mode.
//
// A PS1-era-lofi 3D flythrough of the genre star map: the playhead is the pilot's
// cockpit view; you fly genre->genre, LAND on planets, and 1..N aliens form a BAND
// that plays invented procedural instruments IN TIME with the music. Everything is
// procedural (no external art) and derived from each genre's 23-float feature
// vector.
//
// LOAD LAW, TWO LAYERS. (1) THIS FILE is not on the boot path either: index.html
// does not load it, and app/panels/panels.js dynamic-imports it through
// app/starcruise-load.js the first time the ✦ cycle reaches the aliens view —
// so a session that never opens the view pays none of its ~48 KB gzipped (nor
// the ~9 KB of genre-clusters data its scene module static-imports). (2) Three.js
// is one step further out still: this controller dynamic-`import()`s
// vendor/three/three.module.min.js ONLY on the first start(). The mode is
// OPT-IN / OFF by default; when off the app behaves exactly as before.
//
// It is a side-effecting module — evaluating it publishes window.__STARCRUISE,
// which is how app/panels/background.js and the gates find it (the gates arm the import
// with window.__ensureStarcruise(), never by racing a click). It reads the app's REAL
// travel + beat via documented hooks (getTravel / getBeat) and must NOT fork the travel
// logic or touch any render-path/engine file.
//
// WHAT LIVES WHERE. The controller owns the RENDERER, the low-res render target, the
// cockpit CAMERA object, the flight machine and the RAF loop — the lifecycle and the
// per-frame ORDER OF OPERATIONS, and nothing else. The four pieces it orchestrates:
//
//   ./starcruise/bridge.js   the app/engine boundary: window.__S, the kernel/engine
//                            globals, getTravel/getBeat, and THE SCORE BRIDGE (the
//                            cached per-bar note plan every alien plays from)
//   ./starcruise/scene.js    the THREE.Scene graph: the light rig, the whole-session
//                            galaxy (starfield / glyphs / planet + sun fields), the
//                            per-landing surface (ground planet, band, dancers, sky
//                            dome) and the transit space rig
//   ./starcruise/camera.js   where the camera IS: the orbit rig, the music-video
//                            auto-camera, the damped transit follow + free-look, and
//                            every pointer/touch/key input that drives them
//   ./starcruise/probes.js   the window.__STARCRUISE debug surface the gates read
//
// plus the pre-existing rigs it loads lazily (traits / alien / backdrop / postfx /
// flight / ship / planet). The DOM overlays (VHS + HUD) are view furniture and stay
// here with the rest of the view lifecycle.

import * as Bridge from "./starcruise/bridge.js";
import * as Scene from "./starcruise/scene.js";
import * as Cam from "./starcruise/camera.js";
import { makeProbes } from "./starcruise/probes.js";
import { alienize } from "./map/glyphs.js";   // alien alphabet for the HUD's cluster label

// ---- module handles (lazy) ------------------------------------------------------
let THREE = null;            // the vendored namespace, loaded on first start()
let mods = null;             // { traitsFromGenre, makeAlien, makeBackdrop, makePS1, makeFlight }
let running = false, loaded = false;
let renderer, scene, camera, lowResTarget, ps1, flight, clock;
let displayCanvas = null;
let raf = 0, lastT = 0;
let hudEl = null;            // the 2D cockpit HUD (DOM overlay) — shows the current cluster label
let _hudLabel = null;        // last label pushed to the HUD (avoid needless DOM writes)
let vhsEl = null;            // the VHS scanline overlay div (in front of the 3D view)
let curDominant = null;
let lastState = null;        // last flight state (headless-probe visibility)
let wasLanded = false;       // edge-detect entering a landed phase (seed once)
let _skipRender = false;     // when true, update() advances all logic but skips the GL render
let _lastActive = null;      // last genre label pushed into the cockpit display
let _spaceCol = null;        // reusable THREE.Color for the sky->space lerp (set on start)

// SPACE IS TRUE BLACK — the LITTLE-PRINCE landing sits on a tiny world in real black
// space, and the galaxy's stars + glowing planets read best on 0x000000 (was dark purple).
// Both the surface sky and deep space are black; the sky<->space fade is black->black.
const SKY_COLOR = 0x000000;    // black space behind the little world at the surface
const SPACE_COLOR = 0x000000;  // black deep space

// internal framebuffer — the render resolution. RAISED A LOT from the old 320x240
// potato: now NEAR-NATIVE, DPR-aware, with the long edge capped (~1600 desktop /
// ~1080 coarse-pointer mobile) so it's crisp on desktop + high on modern phones
// while staying cheap (resolution is fill-rate; the geometry stays low-poly). The
// canvas backing store is driven to this same size so the final blit is ~1:1.
let lowW = 1280, lowH = 720;       // actual values recomputed in computeLowRes()
function computeLowRes() {
  const w = window.innerWidth || 640, h = window.innerHeight || 480;
  const aspect = w > 0 && h > 0 ? w / h : 4 / 3;
  const coarse = Scene.isCoarse();
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
  // the pass is freshly built here (start / resize / DPR change) — re-apply the
  // active genre's renderStyle so the by-genre look survives a rebuild.
  const rs = Scene.getCurRenderStyle();
  if (ps1.setStyle && rs) ps1.setStyle(rs.post);
  if (camera) { camera.aspect = lowW / lowH; camera.updateProjectionMatrix(); }
}

// ---- AUDIO RUNWAY GUARD -----------------------------------------------------------
// The cruise is the app's one heavy-GL surface: three.js import + first-render shader
// compile at entry, per-landing surface builds (planet bake + band spawn + cart swap),
// and the dispose+GC storm at exit. Any of those can stall the main thread — which is
// ALSO the live engine's feed path (its pump, worker messages, and bar scheduler all
// run on the page's event loop) — or starve the render worker of CPU, past the live
// engine's short (~3s) feed runway. The ring then underruns: audible static/dropouts
// "after visiting the 3d planet" (measured: C_UNDER_CNT bursts exactly across cruise
// enter/exit, zero in a no-cruise control). While the cruise is up we set
// FaustLive.deepRunway so the engine keeps its deep hidden-tab runway (survival over
// steering latency, same trade as a backgrounded tab); cleared a grace period after
// stop() so the teardown GC is still covered. Benign if no engine is live.
function setDeepRunway(on) {
  try { if (window.FaustLive) window.FaustLive.deepRunway = !!on; } catch (e) {}
}
let _runwayClearT = 0;
const RUNWAY_CLEAR_MS = 20000;   // post-exit grace: teardown disposal + GC settle window
                                 // (measured: a multi-second GC stall can land ~10s after
                                 // stop(); the deep runway also drains over ~5s after the
                                 // clear, so 20s covers ~25s of post-exit turbulence)

// lazy-load Three + the sub-modules exactly once.
async function ensureLoaded() {
  if (loaded) return;
  THREE = await import("../vendor/three/three.module.min.js");
  // some bundlers namespace the default; the ESM build exports named symbols.
  if (THREE.default && !THREE.WebGLRenderer) THREE = THREE.default;
  const [traits, alien, backdropMod, postfx, flightMod, shipMod, planetMod] = await Promise.all([
    import("./starcruise/traits.js"),
    import("./starcruise/alien.js"),
    import("./starcruise/backdrop.js"),
    import("./starcruise/postfx.js"),
    import("./starcruise/flight.js"),
    import("./starcruise/ship.js"),
    import("./starcruise/planet.js"),
  ]);
  mods = {
    traitsFromGenre: traits.traitsFromGenre,
    makeAlien: alien.makeAlien,
    makeBackdrop: backdropMod.makeBackdrop,
    makePS1: postfx.makePS1,
    makeFlight: flightMod.makeFlight,
    makeCockpit: shipMod.makeCockpit,
    makePlanet: shipMod.makePlanet,
    // the DETERMINISTIC PROCEDURAL PLANET (vendored simplex-noise) — the real GROUND the
    // band lands on. makeGroundPlanet(THREE, seed, palette, opts) -> mesh with .heightAt so
    // the stage/feet plant on the terrain and the descent lands onto a real world, not a
    // flat stage that pops in (the galaxy marker + the ground are the SAME genre's planet).
    makeGroundPlanet: planetMod.makePlanet,
    // the GENRE STAR-MAP frame + projection (single source of truth shared with the
    // flight camera) so the planet markers sit at the SAME coords the camera flies to.
    FIELD: flightMod.FIELD,
    worldOfCoord: flightMod.worldOfCoord,
    planetWorlds: flightMod.planetWorlds,
    clusterWorlds: flightMod.clusterWorlds,
  };
  loaded = true;
}

// ---- lifecycle ------------------------------------------------------------------
export async function start() {
  if (running) return;
  // deepen the live-audio runway BEFORE the heavy loads begin (the await below yields,
  // so the engine's pump gets a tick to top up ahead of the three.js import/compile).
  if (_runwayClearT) { clearTimeout(_runwayClearT); _runwayClearT = 0; }
  setDeepRunway(true);
  await ensureLoaded();
  running = true;

  displayCanvas = document.createElement("canvas");
  displayCanvas.id = "starcruise-canvas";
  displayCanvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:40;image-rendering:pixelated;background:#000000";
  document.body.appendChild(displayCanvas);
  document.body.classList.add("view-starcruise");

  renderer = new THREE.WebGLRenderer({ canvas: displayCanvas, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);          // SPACE IS TRUE BLACK (was dark purple)
  // SHADOWS ON: one PCF-soft shadow map, MODELS the forms (light-to-dark falloff +
  // cast shadows) so the aliens/city read 3D instead of flat. Only the key light
  // casts; the map is modest (smaller on mobile) with a tight frustum around the band.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  _spaceCol = new THREE.Color(SPACE_COLOR);   // reused for the sky->space fade in transit
  _lastActive = null;
  // hand the scene graph its handles for this run, then raise the stage light rig.
  Scene.initScene({ THREE, mods, scene, getPS1: () => ps1 });
  Scene.buildLights();

  // build the near-native render target + PS1 pass + size the canvas (near 1:1 blit).
  buildRenderTarget();

  // the whole-session deep space: starfield + floating glyphs + ONE glowing planet per
  // genre AT its GENRE_COORDS + one colored SUN per cluster. Persistent (never despawned
  // mid-flight) so a transit frame is never blank; disposed in stop().
  Scene.buildGalaxy();

  // FAR PLANE opened up for the SPREAD-OUT galaxy: the map now floats at y~380 and spans
  // ~+/-350 in x/z, and the transit vantage climbs to ~y760, so the whole scene must stay
  // inside the frustum from every pose along the descent.
  camera = new THREE.PerspectiveCamera(60, lowW / lowH, 0.1, 2600);
  camera.position.set(0, 3, 8);
  camera.lookAt(0, 1, 0);

  // the camera rig: orbit target = the band's centre, scratch vectors, free-look cleared.
  Cam.initCamera({ THREE, getCamera: () => camera, getState: () => lastState, stop });
  wasLanded = false;

  clock = { now: (typeof performance !== "undefined" ? performance.now() : Date.now()) };

  // flight state machine driven by the REAL travel + beat hooks.
  flight = mods.makeFlight({ getTravel: Bridge.getTravel, getBeat: Bridge.getBeat });
  // APPROACH: commit to descending toward a genre -> BUILD THE SURFACE NOW so it GROWS IN
  // during the descent instead of popping in at touchdown (the unified-scene fix). Keyed by
  // dominant genre (one build per planet); ensureSurface uses the live WEIGHTS so the band
  // still matches the mixed audio. It persists through LAND (no rebuild -> no content pop/cut).
  flight.events.on("phase", (ph) => {
    if (ph !== "APPROACH") return;
    const tv = Bridge.getTravel();
    if (tv.dominant) Scene.ensureSurface(tv.weights && tv.weights.length ? tv.weights : tv.dominant, tv.dominant, Bridge.getS().seed);
  });
  flight.events.on("land", () => {
    Scene.despawnSpaceRig();                 // leaving transit — drop the cockpit set
    const tv = Bridge.getTravel();
    // usually already built at APPROACH (ensureSurface is a no-op then); this covers a
    // DIRECT land (dominance already high, no APPROACH pass) so we never land empty.
    Scene.ensureSurface(tv.weights && tv.weights.length ? tv.weights : (tv.dominant || Bridge.firstGenre()),
      tv.dominant || Bridge.firstGenre(), Bridge.getS().seed);
    curDominant = tv.dominant;
    wasLanded = false;                        // force a fresh seamless seed next frame
  });
  // DEPART: lift off. Drop the surface ensemble and raise the COCKPIT set so you fly
  // away through space with the planet receding below + the genre display lit.
  flight.events.on("depart", (e) => {
    Scene.despawnBand();
    Cam.resetTransitLook();                        // start the fly-away looking forward
    Scene.spawnSpaceRig((e && e.to) || curDominant || (Bridge.getTravel().dominant));
  });

  // spawn an initial band immediately so the very first frame is non-blank even
  // before the flight machine reaches LAND (and for headless proof).
  const tv0 = Bridge.getTravel();
  Scene.ensureSurface(tv0.weights && tv0.weights.length ? tv0.weights : Bridge.firstGenre(), tv0.dominant || Bridge.firstGenre(), Bridge.getS().seed);
  curDominant = tv0.dominant;

  mountVHS();
  mountHUD();
  Cam.bindInput(displayCanvas);
  window.addEventListener("resize", onResize);
  lastT = clock.now;
  loop();
  window.__STARCRUISE && (window.__STARCRUISE.running = true);
}

export function update(dt) {
  if (!running) return;
  Cam.tick(dt);                         // the deterministic auto-cam timebase
  const st = flight.update(dt);
  lastState = st;
  const p = st.cameraPose;
  // CAMERA ROUTING (FIDELITY-DRIVEN ZOOM):
  //   TRANSIT (FLY/APPROACH/DEPART): the camera is the flight's continuous zoom through
  //     the genre star-map — high & far when dominance is low (viewport visible, planets
  //     seen from afar at their coords), descending toward the dominant planet as its
  //     weight climbs. The cockpit rides the camera and FADES by viewportFade.
  //   PARKED (LAND/OPEN/GREET/DANCE): the MUSIC-VIDEO auto-camera slowly orbits/dollies
  //     and CUTS between band aliens + wide shots on the beat; manual drag/pinch/WASD
  //     OVERRIDES it and it resumes after idle.
  const landed = !!Cam.LANDED_PHASES[st.phase];
  if (landed) {
    // parked: the orbit/auto-cam owns the camera — mark the transit follow stale so the
    // NEXT lift-off re-seeds its glide from wherever the landed camera ended up.
    Cam.markFollowStale();
    // on touchdown: restore the surface sky; the camera rig (re)builds the cinematic shot
    // list and eases from the live descent pose into the establishing wide.
    if (!wasLanded) {
      if (scene.background && scene.background.isColor) scene.background.setHex(SKY_COLOR);
    }
    Cam.landedFrame(dt, st, !wasLanded);
  } else if (Scene.getCockpit()) {
    // IN TRANSIT WITH THE COCKPIT SET: the long zoom through the star-map, cockpit
    // framing the view and fading as we descend; the leaving planet recedes below.
    updateSpaceRig(dt, st);
  } else {
    // bootstrap transit (before the first depart): SMOOTHLY follow the star-map zoom
    // pose, keep the orbit shadowing it, and highlight the resolving planet in the field.
    Cam.applyTransitCamera(dt, p);
    Scene.highlightPlanet(st.dominant || curDominant || null);
    Cam.seedOrbitFromPose(p);
  }
  wasLanded = landed;
  // FLAMING SUNS: advance the star-surface plasma churn off the deterministic clock
  // (the virtual clock accumulates dt; a headless snapshot at dt=0 stays byte-stable).
  Scene.setSunTime(Cam.vclock());
  // 2D COCKPIT HUD: reflect the current dominant genre's star system (cluster label +
  // color). In deep space (no dominant) it reads "DEEP SPACE".
  updateHUD(st.dominant || curDominant || null);
  // keep the shadow frustum + key aimed at the band, and sweep the concert spotlights.
  Scene.updateLights(Cam.vclock());
  // SCORE BRIDGE (per frame — NO rebuild): read the audio beat, resolve the CURRENT
  // bar + bar-local phase, and hand every band member its voice's real note onsets
  // for this bar as ctx {barPhase, playing, level, notes}. The alien triggers its
  // playing appendage on those onsets when playing && level>~0.05, and RESTS (idles/
  // sways, instrument lowered) otherwise. Dancers have no part -> the beat-only groove.
  const bt = Bridge.getBeat();
  const hasPlan = Bridge.hasPlan();
  const barPhase = hasPlan ? Bridge.barPhaseOf(bt) : (st.beatPhase || 0);
  // advance the LOCAL bar counter on a barPhase wrap when there is no audio serial.
  Bridge.advanceLocalBar(bt, barPhase);
  const barIdx = Bridge.currentBar(bt);
  Bridge.setCurBar(barIdx);
  const loud = hasPlan ? Bridge.loudnessAt(barIdx) : Bridge.clamp01n(st.beatPhase != null ? 0.5 : 0);
  for (const a of Scene.getBand()) {
    if (hasPlan && a._voice) a.update(dt, Bridge.ctxForVoice(a._voice, barIdx, barPhase));
    else a.update(dt, st.beatPhase);   // fallback: beat-only path (no plan yet)
  }
  // DANCERS get the overall track LOUDNESS in ctx (CONTRACT): each dancer keeps its own
  // phase/style and DESYNCS when quiet, SYNCING UP when the room is loud. valueOf keeps
  // the legacy numeric-phase path working if the alien rig hasn't been upgraded yet.
  for (const d of Scene.getDancers()) {
    d.update(dt, { barPhase, loudness: loud, playing: true, level: 1, valueOf() { return barPhase; } });
  }
  const backdrop = Scene.getBackdrop();
  if (backdrop) backdrop.update(dt);
  const skyDome = Scene.getSkyDome();
  if (skyDome) skyDome.update(dt);
  Scene.updateGlyphSky(dt, camera);   // atmosphere glyphs follow the camera + breathe

  const ship = Scene.getShip();
  if (ship) ship.update(dt, st.phase, st.landProgress);
  if (!_skipRender) ps1.render(scene, camera);   // _skipRender: headless state-only stepping
}

// updateSpaceRig(dt, st) — drive the STAR-MAP transit: the camera is the flight's
// continuous zoom through the planet field; the cockpit rides the camera and FADES by
// viewportFade (visible high in space, gone as we descend); the LEAVING planet recedes
// below; the genre display tracks the resolving dominant; the dominant planet in the
// field is scaled up as the target.
function updateSpaceRig(dt, st) {
  const cockpit = Scene.getCockpit(), planet = Scene.getPlanet();
  const s = Math.max(0, Math.min(1, st.spaceProgress != null ? st.spaceProgress : 1));
  const fade = Math.max(0, Math.min(1, st.viewportFade != null ? st.viewportFade : s));
  const p = st.cameraPose;
  // sky -> space fade (bright dusk sky at the surface, near-black in deep space).
  if (scene.background && scene.background.isColor) {
    scene.background.setHex(SKY_COLOR).lerp(_spaceCol, s);
  }
  // camera = the star-map zoom pose (long descent toward the resolving planet), driven
  // as a SMOOTH damped follow so the lift-off + cruise glide instead of snapping.
  Cam.applyTransitCamera(dt, p);
  // scale up the resolving planet in the star-map so the target reads.
  Scene.highlightPlanet(st.dominant || Scene.getSpaceActiveGenre() || null);
  // cockpit RIDES the camera (its viewport frames the view) and FADES as we descend.
  cockpit.update(dt);
  cockpit.group.position.copy(camera.position);
  cockpit.group.quaternion.copy(camera.quaternion);
  cockpit.group.visible = fade > 0.06;
  fadeGroup(cockpit.group, 0.15 + 0.85 * fade);
  // keep the display's highlighted target current as the blend resolves the next genre.
  const active = Bridge.genreLabelOf(st.dominant || Scene.getSpaceActiveGenre());
  if (active && active !== _lastActive) { cockpit.setGenres(Bridge.genreLabels(), active); _lastActive = active; }
  // the LEAVING planet (the detailed foreground world) recedes BELOW as we climb: near
  // & large just after liftoff (s~0), dropping away + shrinking out in deep space (s~1).
  if (planet) {
    const curTraits = Scene.getCurTraits();
    if (curTraits && planet.setPalette) planet.setPalette(curTraits);
    // the world we're LEAVING sits near the surface (origin) and RECEDES below as we climb.
    // Its fall is anchored to the surface (a straight drop with spaceProgress) — NOT to the
    // camera, which now CLIMBS out to the galaxy on the continuous descent, so "below" is
    // measured against the ground we left, not the rising eye. Kept near the origin x/z so
    // it stays under us as we lift off.
    const fwdX = p.lookAt.x - p.position.x, fwdZ = p.lookAt.z - p.position.z;
    const fl = Math.hypot(fwdX, fwdZ) || 1;
    const ahead = 10;
    const px = (fwdX / fl) * ahead;
    const pz = (fwdZ / fl) * ahead;
    const py = 4 - 44 * s;                             // near the surface (s~0) -> dropped below (s~1)
    const sc = 4.2 + (0.6 - 4.2) * s;                 // large near-surface -> small deep space
    planet.group.position.set(px, py, pz);
    planet.group.scale.setScalar(Math.max(0.6, sc));
    planet.update(dt);
  }
}
// fade a group's meshes to `opacity` (transit-only, a handful of meshes) so the cockpit
// dissolves as the viewport fades. Sets transparent + opacity on each material.
function fadeGroup(group, opacity) {
  const o = Math.max(0, Math.min(1, opacity));
  group.traverse((n) => {
    if (!n.isMesh || !n.material) return;
    const ms = Array.isArray(n.material) ? n.material : [n.material];
    for (const m of ms) { m.transparent = true; m.opacity = o; }
  });
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
  Cam.unbindInput();
  unmountVHS();
  unmountHUD();
  window.removeEventListener("resize", onResize);
  Scene.despawnBand();                             // disposes band + dancers + stage + backdrop + ship
  Scene.despawnSpaceRig();                         // disposes cockpit + planet (if in transit)
  Scene.disposeGalaxy();                           // starfield + glyphs + planet/sun fields
  Cam.resetCamera();                               // shots + auto-cam + follow + virtual clock
  Bridge.injectFill(null);
  // dispose remaining GL resources (lights carry none; belt-and-braces geometry sweep).
  try { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } catch (e) {}
  try { ps1 && ps1.dispose && ps1.dispose(); } catch (e) {}
  try { lowResTarget && lowResTarget.dispose(); } catch (e) {}
  try { renderer && renderer.dispose(); } catch (e) {}
  if (displayCanvas && displayCanvas.parentNode) displayCanvas.parentNode.removeChild(displayCanvas);
  displayCanvas = null; renderer = null; scene = null; camera = null; lowResTarget = null; ps1 = null; flight = null;
  Scene.resetScene();                              // light rig + the per-genre look + the scene handle
  _spaceCol = null; _lastActive = null;
  curDominant = null;
  Bridge.resetPlan();
  document.body.classList.remove("view-starcruise");
  // keep the deep audio runway through the teardown GC window, then restore the
  // responsive default (unless the cruise restarted in the meantime).
  if (_runwayClearT) clearTimeout(_runwayClearT);
  _runwayClearT = setTimeout(() => { _runwayClearT = 0; if (!running) setDeepRunway(false); }, RUNWAY_CLEAR_MS);
  window.__STARCRUISE && (window.__STARCRUISE.running = false);
}

export function toggle() { return running ? (stop(), false) : (start(), true); }
export function isRunning() { return running; }

function onResize() {
  if (!running) return;
  // rebuild the render target at the new size / aspect (near-native, DPR-aware).
  buildRenderTarget();
}

// The star-cruise is ONE of the app's VIEWS — the aliens are just one more view
// alongside the star map and the viz — cycled by the ✦ view chip in app/panels/panels.js via
// window.__STARCRUISE.start()/stop()/isRunning(). It no longer injects its own 🛸 chip and
// has no ✕ EXIT button — you switch away with the view chip like any other view.

// ---- VHS SCANLINE OVERLAY (in front of the 3D view) -----------------------------
// The same glitchy VHS scanline filters sit in front of the 3D views. A DOM
// overlay above the canvas (z 44, below the raised chips at 50) — pure CSS, pointer-
// events:none so it never eats taps: fine horizontal scanlines, a slow VHS tracking
// ROLL bar drifting down the screen, and a soft vignette. On top of the PS1 post pass
// already baked into the render, it pushes the whole view into worn-tape territory.
// There is no ✕ EXIT button any more — the star-cruise is a VIEW, left via the ✦ chip.
function mountVHS() {
  if (vhsEl) return;
  if (!document.getElementById("starcruise-vhs-kf")) {
    const st = document.createElement("style");
    st.id = "starcruise-vhs-kf";
    st.textContent =
      "@keyframes scVhsRoll{0%{transform:translateY(-20vh)}100%{transform:translateY(120vh)}}" +
      "@keyframes scVhsJit{0%,97%,100%{opacity:.5}98%{opacity:.9}99%{opacity:.35}}";
    document.head.appendChild(st);
  }
  vhsEl = document.createElement("div");
  vhsEl.id = "starcruise-vhs";
  vhsEl.style.cssText = [
    "position:fixed", "inset:0", "z-index:44", "pointer-events:none", "overflow:hidden",
    // fine scanlines + a soft edge vignette
    "background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0,rgba(0,0,0,0) 2px,rgba(0,0,0,.16) 3px,rgba(0,0,0,.16) 3.5px)",
    "box-shadow:inset 0 0 180px 40px rgba(0,0,0,.55)",
    "animation:scVhsJit 5s steps(1) infinite",
  ].join(";");
  const roll = document.createElement("div");
  roll.style.cssText = [
    "position:absolute", "left:0", "right:0", "height:16vh",
    "background:linear-gradient(to bottom,rgba(255,255,255,0) 0,rgba(255,255,255,.06) 45%,rgba(255,255,255,.10) 50%,rgba(255,255,255,.06) 55%,rgba(255,255,255,0) 100%)",
    "animation:scVhsRoll 7s linear infinite", "will-change:transform",
  ].join(";");
  vhsEl.appendChild(roll);
  document.body.appendChild(vhsEl);
}
function unmountVHS() {
  if (vhsEl && vhsEl.parentNode) vhsEl.parentNode.removeChild(vhsEl);
  vhsEl = null;
}

// ---- 2D COCKPIT HUD (replaces the 3D cockpit) -----------------------------------
// A lightweight DOM overlay showing the current STAR / cluster LABEL (color-coded to
// the cluster's own sun color). This is the "cockpit HUD" — no obstructing 3D shell.
// It sits above the canvas (z-index 55, below the ✕ EXIT at 60) and updates each frame.
function mountHUD() {
  if (hudEl) return;
  hudEl = document.createElement("div");
  hudEl.id = "starcruise-hud";
  hudEl.style.cssText = [
    "position:fixed", "top:max(14px,env(safe-area-inset-top))",
    "right:max(14px,env(safe-area-inset-right))", "z-index:55",   // top-RIGHT
    "text-align:right",
    "pointer-events:none", "user-select:none",
    "font:600 13px/1.3 system-ui,sans-serif", "letter-spacing:.08em",
    "color:#eef", "text-shadow:0 1px 6px rgba(0,0,0,.8)",
    "padding:8px 12px", "border-radius:12px",
    "background:rgba(12,6,24,.42)", "border:1px solid rgba(255,255,255,.16)",
    "max-width:60vw",
  ].join(";");
  hudEl.innerHTML = '<div id="sc-hud-sys" style="opacity:.7;font-size:10px;letter-spacing:.14em">◈ STAR SYSTEM</div>'
    + '<div id="sc-hud-label" style="font-size:16px;letter-spacing:.06em;margin-top:2px">—</div>'
    + '<div id="sc-hud-genre" style="opacity:.72;font-size:11px;margin-top:2px">—</div>';
  document.body.appendChild(hudEl);
  _hudLabel = null;
}
function unmountHUD() {
  if (hudEl && hudEl.parentNode) hudEl.parentNode.removeChild(hudEl);
  hudEl = null; _hudLabel = null;
}
// updateHUD(genre) — reflect the current dominant genre's CLUSTER (its labeled sun) in
// the HUD, tinted the cluster color. Cheap: only rewrites the DOM when the label changes.
function updateHUD(genre) {
  if (!hudEl) return;
  const cl = Scene.clusterOfGenre(genre);
  const label = cl ? alienize(String(cl.label)).toUpperCase() : "DEEP SPACE";
  const glabel = genre ? Bridge.genreLabelOf(genre) : "cruising";
  if (label === _hudLabel && hudEl._g === glabel) return;
  _hudLabel = label; hudEl._g = glabel;
  const lab = hudEl.querySelector("#sc-hud-label");
  const gen = hudEl.querySelector("#sc-hud-genre");
  if (lab) {
    lab.textContent = label;
    const c = cl && cl.color ? cl.color : [0.8, 0.85, 1];
    lab.style.color = `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  }
  if (gen) gen.textContent = glabel ? ("→ " + glabel) : "";
}

// debug / headless-probe hook (mirrors window.__X) — the whole surface lives in
// ./starcruise/probes.js; these are the controller-owned handles it formats.
window.__STARCRUISE = makeProbes({
  start, stop, toggle, update, isRunning,
  three: () => THREE,
  renderer: () => renderer,
  scene: () => scene,
  camera: () => camera,
  ps1: () => ps1,
  lowResTarget: () => lowResTarget,
  lowRes: () => ({ w: lowW, h: lowH }),
  canvas: () => displayCanvas,
  loaded: () => loaded,
  state: () => lastState,
  vhsEl: () => vhsEl,
  hudEl: () => hudEl,
  // __step(dt): advance one frame and return the flight state (phase probe).
  step: (dt) => { update(dt || 0); return lastState; },
  // __stepNoRender(dt): advance ALL logic but SKIP the GL render.
  stepNoRender: (dt) => { _skipRender = true; try { update(dt || 0); } finally { _skipRender = false; } return lastState; },
  // headless-only: stop / restart the RAF render loop so scripted steps are the sole renderer.
  pauseLoop: () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } return true; },
  resumeLoop: () => { if (running && !raf) { lastT = (typeof performance !== "undefined" ? performance.now() : Date.now()); loop(); } return true; },
});

export default { start, stop, toggle, update, isRunning };
