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

// GALAXY DATA — pure static data modules (no Three, no esm.sh): the cluster->sun map
// (labels + colors + star coords) and the genre->cluster index. Safe to static-import;
// this does NOT couple the lazy Three load (those stay behind the dynamic import()).
import { CLUSTER_OF, GENRE_CLUSTERS } from "./starcruise/genre-clusters.js";

// LIVE STORE ACCESS — read the app's store LAZILY off the window global that
// app/state.js publishes (window.__S). We deliberately do NOT static-import
// state.js (nor share.js, which itself imports state.js): state.js eval-time
// imports preact+htm from esm.sh, so importing it would couple this
// self-contained, lazily-loaded star-cruise module to the esm.sh module graph and
// break offline/headless boot. window.__S may not exist yet at module-eval (or in
// a bare headless harness), so getS() falls back to a benign empty store that
// preserves the previous "no live weights" behavior.
const _emptyStore = { weights: [], waypoints: [], travel: { seg: 0, t: 0 } };
const getS = () => (typeof window !== "undefined" && window.__S) || _emptyStore;

// pointOnPath: world position along the DRAWN travel path for a {seg,t} travel
// state. Inlined here (was imported from share.js) so star-cruise carries NO
// static dependency on share.js/state.js/esm.sh. Reads the live waypoints off the
// store lazily; matches share.js's implementation exactly.
function pointOnPath(travel) {
  const wp = getS().waypoints || [];
  const n = wp.length; if (n < 2) return null;
  const a = wp[travel.seg % n], b = wp[(travel.seg + 1) % n];
  return { x: a.x + (b.x - a.x) * travel.t, y: a.y + (b.y - a.y) * travel.t };
}

// engine globals live on window (loaded before app/main.js): K = GenreKernel,
// V = GenreVerifier. Read them lazily at trait time so this module loads even if
// they arrive a tick late.
const K = () => window.GenreKernel;
const V = () => window.GenreVerifier;
// E = window.CsdEngine — the SCORE BRAIN. E.buildEvents(state) returns the exact
// per-voice note/drum EVENT list the audio engine renders. The score-bridge below
// calls it ONCE per genre (on land) to build a cached per-bar note plan, then each
// frame hands every band member the real onsets of ITS voice for the current bar —
// so the aliens PLAY the score instead of just moving on the beat. READ-ONLY.
const E = () => window.CsdEngine;

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
  const st = getS();
  const ws = (st.weights || []).filter((w) => w && w.w > 0).slice().sort((a, b) => b.w - a.w);
  const dominant = ws.length ? ws[0].g : null;
  let position = null;
  try { position = st.waypoints && st.waypoints.length >= 2 ? pointOnPath(st.travel) : null; } catch (e) {}
  return { weights: ws, dominant, position, live: !!st.live, seed: st.seed };
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
  const st = getS();
  const info = st.barInfo;
  const bpm = (st.playing && st.playing.bpm) || 120;
  const spb = info && info.spb ? info.spb : 60 / bpm;
  const cbeats = info && info.cbeats ? info.cbeats : 8;
  const serial = info ? info.serial : -1;
  const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
  if (serial !== _beat.serial) { _beat.serial = serial; _beat.t0 = now; }
  const beatsIn = st.live && spb > 0 ? ((now - _beat.t0) / 1000) / spb : (now / 1000) / spb;
  const beatPhase = beatsIn - Math.floor(beatsIn);
  return { bpm, spb, cbeats, serial, beat: Math.floor(beatsIn), beatPhase, playing: !!st.live };
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
let groundPlanet = null;     // the PROCEDURAL PLANET the band stands on (planet.js; heightAt foot-plant)
let groundH0 = 0;            // heightAt(0,0) of the ground planet (so its pole sits at y=0)
let groundRadius = 0;        // the ACTUAL base radius of the current ground planet (small-world)
let smallWorldGround = false;// true when the ground is the LITTLE-PRINCE small curved world
const GROUND_R = 110;        // legacy flat-fallback ground-planet radius (only if the small build fails)
let backdrop = null;         // {group, update}
let ship = null;             // { group, update(dt, phase, landProgress) } — the greet-craft saucer
let cockpit = null;          // { group, update, setGenres } — the transit COCKPIT interior
let planet = null;           // { group, update, setPalette } — the planet you leave/approach
let sun = null;              // the shadow-casting KEY light (module-scoped for the frustum + probes)
let starfield = null;        // persistent THREE.Points deep-space (whole-session)
let planetField = null;      // persistent InstancedMesh: ONE planet per genre AT its GENRE_COORDS
let sunField = null;         // persistent InstancedMesh: ONE colored SUN per CLUSTER at its star coord
let sunGlowField = null;     // persistent InstancedMesh: an ADDITIVE corona/halo shell per sun (the glow)
const planetIndex = Object.create(null);   // genre -> instance index (dominant highlight)
let hudEl = null;            // the 2D cockpit HUD (DOM overlay) — shows the current cluster label
let _hudLabel = null;        // last label pushed to the HUD (avoid needless DOM writes)
// SMOOTH transit camera: a damped follow of the flight pose (kills per-frame jitter and
// makes lift-off / descent an eased glide rather than a snap). Landed uses orbit directly.
const camFollow = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, fov: 60, init: false };
let _wasTransit = false;     // edge-detect entering transit (seed the follow from the live camera)
const FLOOR_Y = 0.35;        // camera FLOOR CLAMP — never dips below the ground plane at the surface
let _fillInject = null;      // TEST override for the per-bar fill flag (null in production)
let curTraits = null;        // TRAITS of the currently-spawned band (headless-probe visibility)
let curDominant = null;
let curRenderStyle = null;   // renderStyle of the ACTIVE genre (pushed into the PS1 post pass)
let lastState = null;        // last flight state (headless-probe visibility)
const bandCentroid = { x: 0, y: 1.2, z: 0.6 };   // centre of the spawned players (orbit target)
// the SPACE ANCHOR — a fixed spot high above the band scene where the cockpit set +
// planet live during transit, so they never overlap the (despawned) surface scene.
const SPACE_ANCHOR = { x: 0, y: 40, z: 0 };
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
  // the pass is freshly built here (start / resize / DPR change) — re-apply the
  // active genre's renderStyle so the by-genre look survives a rebuild.
  if (ps1.setStyle && curRenderStyle) ps1.setStyle(curRenderStyle.post);
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

// ---- MUSIC-VIDEO auto-camera (landed) -------------------------------------------
// Once landed, an automatic cinematic camera slowly orbits/dollies and CUTS between
// band aliens + wide city shots, on the beat — a little music video of the song.
// Manual drag/pinch/WASD OVERRIDES it (noteInput() stamps _lastInputT) and the auto
// camera RESUMES after AUTO_IDLE seconds of no input. It drives the SAME orbit object
// so applyOrbitToCamera renders it; a CUT snaps orbit to a new shot, and between cuts
// it drifts (slow orbit) + bobs on the beat. All time comes from dt (deterministic).
const autoCam = { active: false, shot: 0, shotT: 0, cuts: 0, forceCut: true, onDrummer: false, drummerShot: -1 };
// ESTABLISH EASE — on touchdown the landed camera used to SNAP to the front establishing
// wide shot (a hard cut from the descent pose = the "lurch/cut" at landing). Instead we
// SEED the orbit from the live descent pose (continuous — the camera stays exactly where
// the flight left it) and critically-EASE it into that establishing shot over ESTAB_DUR
// seconds; runAutoCam (roam + beat cuts) takes over once the ease completes. Deterministic.
const establish = { active: false, t: 0 };
const ESTAB_DUR = 0.75;
let autoShots = [];               // per-land cinematic shot list (band closeups + wides)
let _vclock = 0;                  // virtual clock (accumulated dt) — the auto-cam timebase
let _lastInputT = -1e9;           // last user-input virtual time (manual override window)
const AUTO_IDLE = 2.5;            // seconds of no input before the auto camera resumes
const CUT_BEATS = 8;              // cut roughly every 2 bars (musical, beat-synced)
function noteInput() { _lastInputT = _vclock; }   // called by every manual nav handler

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

// ---- THE SCORE BRIDGE -----------------------------------------------------------
// The bridge that turns each alien from a beat-keeper into a PLAYER of its part.
// On land / genre change it resolves the current playing STATE and calls
// E.buildEvents ONCE for the whole track (cheaper than the contract's once-per-bar:
// one call yields every bar), then buckets every event by VOICE into a per-bar note
// plan { bars:[ { voice:{ notes:[{t,pitch,dur,vel}], level, playing } } ] }. Each
// frame the controller picks the CURRENT bar (from the audio beat's serial) and the
// bar-local phase, and passes each band member its voice's notes/level/playing as
// ctx — NEVER rebuilding per frame. Rebuilt only when the genre (plan key) changes.
let eventPlan = null;        // { bars, numBars, cbeats, bpm } — the cached per-bar note plan
let eventPlanKey = null;     // genre+seed signature; a change triggers a rebuild
let planBuildCount = 0;      // how many times buildEvents ran (headless proof it is NOT per-frame)
let _localBar = 0;           // bar counter used when no real audio serial is available
let _lastBarPhase = 0;       // for local bar advancement (wrap detection)
let _curBarIdx = 0;          // the bar the band is currently playing (headless-probe visibility)
const _lastCtx = Object.create(null);   // last ctx passed per voice (headless-probe visibility)

// engine voice ids the CORE kit vs the decorative PERC lane split into.
const PERC_DRUMS = { rim: 1, ride: 1, ride8: 1, crash: 1, crashDown: 1, perc: 1, conga: 1,
  shaker: 1, cowbell: 1, tamb: 1, tambourine: 1, clave: 1, click: 1, cabasa: 1, guiro: 1,
  woodblock: 1, triangle: 1, bongo: 1, timbale: 1, agogo: 1 };
// per-voice reference loudness (event amps differ by lane) so `level` reads 0..1
// meaningfully — a faded/quiet bar drops below the rest threshold and the alien idles.
const VOICE_REF = { drums: 0.5, perc: 0.32, bass: 0.24, melody: 0.2, pad: 0.2, found: 0.4 };
const clamp01n = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// resolve the FULL engine state (sections + voices) the audio renders for a genre
// name or a weights blend — the same resolution traits.js uses.
function resolveState(genreOrWeights, seed) {
  const k = K(); if (!k) return null;
  try {
    if (typeof genreOrWeights === "string") return k.track(genreOrWeights, { seed });
    if (Array.isArray(genreOrWeights) && genreOrWeights.length) return k.mix(genreOrWeights, { seed });
  } catch (e) {
    // a bad blend — fall back to the dominant single genre.
    try { const d = firstGenre(); return k.track(typeof genreOrWeights === "string" ? genreOrWeights : d, { seed }); } catch (e2) {}
  }
  return null;
}

// buildEventPlan(genreOrWeights, seed) — resolve state, run buildEvents ONCE, and
// bucket every event by voice into per-bar note lists. Cached on eventPlan; rebuilt
// only when the (genre+seed) key changes. Safe/no-throw: leaves eventPlan null on
// any failure so the controller falls back to the beat-only path.
function buildEventPlan(genreOrWeights, seed) {
  const key = (typeof genreOrWeights === "string" ? genreOrWeights
    : (Array.isArray(genreOrWeights) ? genreOrWeights.map((w) => w.g + ":" + (w.w || 0).toFixed(3)).join(",") : "?")) + "@" + seed;
  if (eventPlan && eventPlanKey === key) return eventPlan;   // already cached this genre
  eventPlanKey = key; eventPlan = null; _localBar = 0; _lastBarPhase = 0;
  const eng = E(); const st = resolveState(genreOrWeights, seed);
  if (!eng || !eng.buildEvents || !st) return null;
  let ev;
  try { ev = eng.buildEvents(st); } catch (e) { return null; }
  planBuildCount++;
  const CBEATS = Math.max(2, Math.round(st.chordEvery || (st.meter ? 6 : 8)));
  const total = ev.totalBeats || 0;
  // events only live in [0, total-8) (the +8 is a silent tail); bar count = that span.
  const numBars = Math.max(1, Math.round(Math.max(CBEATS, total - 8) / CBEATS));
  const bars = new Array(numBars);
  for (let i = 0; i < numBars; i++) bars[i] = Object.create(null);
  const pchToMidi = eng.pchToMidi || ((s) => { const p = String(s).split("."); return (parseInt(p[0], 10) - 3) * 12 + parseInt(p[1], 10); });
  // push one note into its bar bucket for a voice. t = position 0..1 within the bar,
  // dur = fraction of a bar, vel = event amp (post-dynamics — quiet bars read quiet).
  const put = (voice, beat, pitch, durBeats, amp) => {
    if (!(beat >= 0)) beat = 0;
    let bi = Math.floor(beat / CBEATS);
    if (bi >= numBars) bi = ((bi % numBars) + numBars) % numBars;
    const t = clamp01n((beat - bi * CBEATS) / CBEATS);
    const bar = bars[bi];
    let slot = bar[voice]; if (!slot) slot = bar[voice] = { notes: [], maxAmp: 0 };
    slot.notes.push({ t, pitch: pitch | 0, dur: Math.max(0, (durBeats || 0) / CBEATS), vel: +(+amp || 0).toFixed(4) });
    if (amp > slot.maxAmp) slot.maxAmp = amp;
  };
  // PITCHED — bass / pad / melody(lead) carry their own voice id + pch (octave.step).
  for (const e of (ev.pitched || [])) {
    const v = e.voice; if (v !== "bass" && v !== "pad" && v !== "melody") continue;
    put(v, e.beat, pchToMidi(e.pch) + 60, e.dur, e.amp != null ? e.amp : (e.amp0 || 0.15));
  }
  // DRUMS — the core kit is one 'drums' voice; the decorative perc lane a 'perc' voice.
  const DRUM_MIDI = { kick: 36, kick2: 36, snare: 38, clap: 39, hat: 42, hat2: 44, tom: 45,
    ride: 51, rim: 37, crash: 49, crashDown: 49, perc: 60, conga: 47, shaker: 70, cowbell: 56 };
  for (const e of (ev.drums || [])) {
    const voice = PERC_DRUMS[e.drum] ? "perc" : "drums";
    put(voice, e.beat, DRUM_MIDI[e.drum] || 50, e.dur, e.amp != null ? e.amp : (e.amp0 || 0.3));
  }
  // FOUND — the sampled/vocal layer; pitch field is a playback RATE -> a nominal midi.
  for (const e of (ev.found || [])) {
    const rate = e.pitch != null ? e.pitch : 1;
    const midi = 60 + Math.round(12 * Math.log2(rate > 0 ? rate : 1));
    put("found", e.beat, midi, e.dur, e.amp != null ? e.amp : 0.3);
  }
  // finalize each bar/voice: representative level + playing flag + time-sorted notes.
  for (const bar of bars) {
    for (const voice in bar) {
      const slot = bar[voice];
      slot.notes.sort((a, b) => a.t - b.t);
      slot.level = clamp01n(slot.maxAmp / (VOICE_REF[voice] || 0.3));
      slot.playing = slot.notes.length > 0 && slot.level > 0.05;
    }
  }
  // PER-BAR OVERALL LOUDNESS (0..1) — the "how loud is the whole track right now" signal
  // the controller hands every alien as ctx.loudness (dancers DESYNC when quiet, SYNC when
  // loud). Deterministic: derived from the cached plan, no clock. Weighted toward the
  // rhythm section (drums/perc) since that's what drives the room.
  const loudness = new Array(numBars);
  const drumsPerBar = new Array(numBars);
  for (let i = 0; i < numBars; i++) {
    const bar = bars[i];
    let sum = 0, cnt = 0, drumL = 0;
    for (const v in bar) {
      const lv = bar[v].level || 0;
      const w = (v === "drums" || v === "perc") ? 1.4 : (v === "bass" ? 1.0 : 0.8);
      sum += lv * w; cnt += w;
      if (v === "drums") drumL = Math.max(drumL, bar[v].notes.length);
    }
    loudness[i] = cnt > 0 ? clamp01n(sum / cnt) : 0;
    drumsPerBar[i] = drumL;
  }
  // PER-BAR FILL flag — a drum FILL / transition (the camera ALWAYS cuts to the drummer
  // on a fill). Deterministic heuristic: a bar whose kit is markedly BUSIER than the
  // track's typical bar (>= 1.5x the mean drum onsets AND above a small floor). No fills
  // in a track with no kit variation -> the flag simply never fires.
  let meanDrums = 0; for (let i = 0; i < numBars; i++) meanDrums += drumsPerBar[i];
  meanDrums = numBars > 0 ? meanDrums / numBars : 0;
  const fillBars = [];
  const fill = new Array(numBars);
  for (let i = 0; i < numBars; i++) {
    fill[i] = meanDrums > 0 && drumsPerBar[i] >= Math.max(meanDrums * 1.5, meanDrums + 2);
    if (fill[i]) fillBars.push(i);
  }
  eventPlan = { bars, numBars, cbeats: CBEATS, bpm: ev.bpm || st.bpm || 120, loudness, fill, fillBars };
  return eventPlan;
}

// currentBar(bt) — which cached bar the audio is on right now, from the beat's bar
// SERIAL (S.barInfo increments it per chord-bar; loops the song). No serial (early
// frame / headless without a driven serial) -> a locally advanced counter.
function currentBar(bt) {
  if (!eventPlan) return 0;
  const nb = eventPlan.numBars;
  const serial = bt && bt.serial;
  if (typeof serial === "number" && serial >= 0) return ((serial % nb) + nb) % nb;
  return ((_localBar % nb) + nb) % nb;
}
// barPhaseOf(bt) — 0..1 across the CURRENT bar. Real getBeat gives beat (integer
// beats-into-bar) + beatPhase; injected beats give only beatPhase (treated per-bar).
function barPhaseOf(bt) {
  const cb = (bt && bt.cbeats) || (eventPlan && eventPlan.cbeats) || 8;
  const beatIdx = (bt && typeof bt.beat === "number") ? bt.beat : 0;
  let ph = (beatIdx + ((bt && bt.beatPhase) || 0)) / cb;
  ph = ph - Math.floor(ph);
  return ph < 0 ? 0 : ph > 1 ? 1 : ph;
}
// ctxForVoice(voice, barIdx, barPhase) — the per-frame ctx a band member receives.
// Carries barPhase (0..1 over the bar), whether the voice is PLAYING this bar, its
// dynamics level, and the bar's note onsets. valueOf() returns barPhase so the OLD
// beat-only alien path (which reads a numeric phase) still animates if it hasn't
// been upgraded — the new path reads .notes/.level/.playing/.barPhase.
function ctxForVoice(voice, barIdx, barPhase) {
  let slot = null;
  if (eventPlan && eventPlan.bars[barIdx]) slot = eventPlan.bars[barIdx][voice] || null;
  const loud = loudnessAt(barIdx);
  const ctx = {
    barPhase,
    playing: !!(slot && slot.playing),
    level: slot ? slot.level : 0,
    notes: slot ? slot.notes : [],
    loudness: loud,                 // CONTRACT: overall track level 0..1 (dancers sync when loud)
    valueOf() { return barPhase; },
  };
  _lastCtx[voice] = { barPhase: +barPhase.toFixed(4), playing: ctx.playing, level: +ctx.level.toFixed(3), notes: ctx.notes.length, loudness: +loud.toFixed(3) };
  return ctx;
}
// overall track loudness (0..1) for a bar — the per-alien ctx.loudness signal.
function loudnessAt(barIdx) {
  if (!eventPlan || !eventPlan.loudness) return 0;
  const nb = eventPlan.numBars;
  const bi = ((barIdx % nb) + nb) % nb;
  return eventPlan.loudness[bi] || 0;
}
// currentFill() — is a drum FILL firing on the current bar? TEST override wins; else the
// plan's per-bar fill flag. The auto-camera ALWAYS cuts to the drummer while this is true.
function currentFill() {
  if (_fillInject != null) return !!_fillInject;
  if (!eventPlan || !eventPlan.fill) return false;
  return !!eventPlan.fill[_curBarIdx];
}

// ---- DETERMINISTIC BAND COVERAGE ------------------------------------------------
// The canonical engine-voice order + a synthesized band-member for any SOUNDING voice
// that traits.band didn't include. The band must have ONE alien for EVERY voice that
// actually sounds in the cached note plan (fixes the intermittent case where a voice
// the plan emits — e.g. a barely-present melody — has no alien): we align the "sounding"
// test with band spawning by driving the roster off eventPlan, not off traits.band alone.
const VOICE_ORDER = ["drums", "perc", "bass", "melody", "pad", "found"];
const SYNTH_MEMBER = {
  drums: { role: "drum", family: "pulse-bladder", playStyle: "drum", hitsPerBeat: 2 },
  perc: { role: "perc", family: "chime-cluster", playStyle: "strike", hitsPerBeat: 3 },
  bass: { role: "bass", family: "drone-coil", playStyle: "pluck", hitsPerBeat: 1 },
  melody: { role: "lead", family: "tendril-harp", playStyle: "pluck", hitsPerBeat: 2 },
  pad: { role: "pad", family: "gas-veil", playStyle: "bow", hitsPerBeat: 1 },
  found: { role: "found", family: "echo-conch", playStyle: "strike", hitsPerBeat: 1 },
};
function synthMember(voice) {
  const f = SYNTH_MEMBER[voice] || SYNTH_MEMBER.perc;
  return { role: f.role, voice, instrument: { family: f.family, playStyle: f.playStyle, appendage: 0, hitsPerBeat: f.hitsPerBeat } };
}
// the voices that actually SOUND (any onset anywhere) in the current cached plan —
// the exact same signal the score-bridge probe calls "sounding", so band == sounding.
function soundingVoices() {
  const set = Object.create(null);
  if (eventPlan && eventPlan.bars) {
    for (const bar of eventPlan.bars) for (const v in bar) { if (bar[v].notes && bar[v].notes.length) set[v] = 1; }
  }
  return set;
}
// resolve the final roster: one member per SOUNDING voice (reusing traits.band's
// genre-tuned member where it exists, else a synthesized one), in canonical order.
// Falls back to traits.band when there's no plan (early frame) so we never spawn empty.
function rosterFor(traitsBand) {
  const sounds = soundingVoices();
  const byVoice = Object.create(null);
  for (const m of (traitsBand || [])) if (m && m.voice && !byVoice[m.voice]) byVoice[m.voice] = m;
  const voices = VOICE_ORDER.filter((v) => sounds[v]);
  if (!voices.length) {
    const fb = (traitsBand || []).slice(0, BAND_CAP);
    return fb.length ? fb : [synthMember("melody")];
  }
  return voices.map((v) => byVoice[v] || synthMember(v)).slice(0, BAND_CAP);
}

// curSpawnDom — the DOMINANT genre the current surface (band+ground+backdrop) was built
// for. The surface is keyed by planet identity so it is built ONCE per genre (on APPROACH),
// PERSISTS through the descent + touchdown (no rebuild -> no pop), and is rebuilt only when
// the dominant moves to a DIFFERENT genre. Cleared in despawnBand (depart / teardown).
let curSpawnDom = null;
// ensureSurface — (re)build the surface only if it is not already up for this dominant
// genre. Called on APPROACH (grow in during the descent) and on LAND (covers a direct land).
function ensureSurface(genreOrWeights, dominant, seed) {
  if (dominant && dominant === curSpawnDom && band.length) return;   // already up for this planet
  spawnFor(genreOrWeights, seed);
  curSpawnDom = dominant || null;
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
  if (ps1 && ps1.setStyle && curRenderStyle) ps1.setStyle(curRenderStyle.post);
  // ---- ROSTER + STAGE GEOMETRY (resolved BEFORE the world so the world is sized to it) --
  // ONE alien per SOUNDING voice (deterministic coverage), mobile-capped, laid out in a WIDE
  // arc. We compute the arc + the (energy-gated) dancer crowd size UP FRONT so the little
  // world's radius can be sized to hold the whole ensemble around the landing pole.
  const members = rosterFor(traits.band);
  const n = members.length;
  const spread = n > 1 ? Math.max(3.2, Math.min(4.2, 2.6 + 5.2 / n)) : 0;   // wide arc; ~3.2+ per gap
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
  const halfExtent = Math.max(5, Math.min(12, Math.max(bandHalfW, dancerReach)));
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

  // BACKDROP (procedural city + landscape) WRAPPED on the curved surface: pass the planet's
  // surface API so every building/feature foot-plants ON the sphere oriented to the normal,
  // wrapping the city down to the little world's HORIZON behind/around the band (distinct per
  // genre). surfacePoint is planet-LOCAL, so we offset the group to the planet's world frame
  // (aligning it with the ground mesh) and HIDE the backdrop's own FLAT ground/sea planes —
  // the curved planet mesh is the ground now, and a flat plane can't wrap a sphere.
  const bkOpts = (groundPlanet && groundPlanet.field && smallWorldGround)
    ? { surface: groundPlanet.field } : {};
  backdrop = mods.makeBackdrop(THREE, traits, useSeed, bkOpts);
  if (bkOpts.surface) {
    backdrop.group.position.copy(groundPlanet.position);
    backdrop.group.userData.scOnSurface = true;
    backdrop.group.traverse((o) => {
      if (o.isMesh && (o.name === "ground" || o.name === "world-sea")) o.visible = false;
    });
  }
  scene.add(backdrop.group);
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
    d.group.scale.setScalar(0.85 + seedR() * 0.25);
    d.stage = ped;
    enableShadows(ped);
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
// tiny local seeded rng (deterministic dancer scatter; NOT Math.random).
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// groundYAt(x,z) — the WORLD y of the ground-planet terrain under a landing-patch offset
// (x,z). The planet is placed so its north pole (heightAt(0,0)) sits at y=0, so this is
// heightAt(x,z) - heightAt(0,0): 0 at the stage centre, dipping gently with curvature /
// terrain toward the edges. 0 when there is no ground planet (flat-stage fallback).
function groundYAt(x, z) {
  if (!groundPlanet || !groundPlanet.heightAt) return 0;
  return groundPlanet.heightAt(x, z) - groundH0;
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
  const scan = (a) => { const g = a && (a.stage || a.group); if (g) g.traverse((o) => { if (o.isMesh && o.castShadow) n++; }); };
  band.forEach(scan); dancers.forEach(scan);
  return n;
}
function despawnBand() {
  for (const a of band) { const g = a.stage || a.group; scene.remove(g); disposeObj(g); }
  band = [];
  for (const d of dancers) { const g = d.stage || d.group; scene.remove(g); disposeObj(g); }
  dancers = [];
  if (stage) { scene.remove(stage); disposeObj(stage); stage = null; }
  if (groundPlanet) { scene.remove(groundPlanet); disposeObj(groundPlanet); groundPlanet = null; groundH0 = 0; groundRadius = 0; smallWorldGround = false; }
  if (backdrop) { scene.remove(backdrop.group); disposeObj(backdrop.group); backdrop = null; }
  if (ship) { scene.remove(ship.group); disposeObj(ship.group); ship = null; }
  curTraits = null;
  curSpawnDom = null;                              // surface is down — next genre must rebuild
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
  planet = mods.makePlanet(THREE, curTraits, (getS().seed | 0) || 1);
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

// ---- GENRE STAR-MAP FIELD -------------------------------------------------------
// One glowing planet per genre AT its GENRE_COORDS (shared projection with the flight
// camera). Deterministic per-genre hue + radius; a single InstancedMesh (one draw
// call). Persistent for the whole session (like the starfield). The dominant planet
// is scaled up while we fly toward it so the target reads.
let planetBaseR = null;     // per-instance base radius (to restore the dominant highlight)
let _hiIdx = -1;            // currently-highlighted (dominant) instance index
function hueOf(name) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return (h % 360) / 360; }
function buildPlanetField() {
  const worlds = (mods.planetWorlds && mods.planetWorlds()) || [];
  if (!worlds.length || !scene) return;
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false });   // bright balls of light
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
    p.set(w.x, w.y, w.z); s.set(r, r, r);
    m4.compose(p, q, s); planetField.setMatrixAt(i, m4);
    col.setHSL(hueOf(w.g), 0.72, 0.58); planetField.setColorAt(i, col);
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
let sunIndex = null;         // [{id,label,color,x,y,z}] parallel to instance indices
let sunBaseR = null;         // per-sun core radius (for the glow-shell scale + probes)
function buildSunField() {
  const suns = (mods.clusterWorlds && mods.clusterWorlds()) || [];
  if (!suns.length || !scene) return;
  sunIndex = suns;
  sunBaseR = new Float32Array(suns.length);
  // CORE — the STAR itself: a bright, fully self-lit (toneMapped:false, unlit-at-full-
  // brightness) sphere tinted the cluster color. Radius scales with membership but is kept
  // well under the ~19-unit min sun-sun spacing so systems never touch (real empty space).
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
  sunField = new THREE.InstancedMesh(geo, mat, suns.length);
  sunField.frustumCulled = false;
  sunField.name = "sunField";
  // GLOW — an additive CORONA/HALO shell around each star (radius ~2.6x the core), blended
  // ADDITIVELY so it reads as light bleeding into space, not a solid ball. One extra
  // InstancedMesh (one draw call) — mobile-cheap; caps the glow cost at a single pass.
  const glowGeo = new THREE.IcosahedronGeometry(1, 1);
  const glowMat = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true,
    opacity: 0.5, depthWrite: false, toneMapped: false });
  sunGlowField = new THREE.InstancedMesh(glowGeo, glowMat, suns.length);
  sunGlowField.frustumCulled = false;
  sunGlowField.name = "sunGlowField";
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), gcol = new THREE.Color();
  for (let i = 0; i < suns.length; i++) {
    const w = suns[i];
    const r = 4 + Math.min(8, w.members) * 0.5;    // 4..8 world units — landmark stars, well separated
    sunBaseR[i] = r;
    p.set(w.x, w.y, w.z);
    s.set(r, r, r); m4.compose(p, q, s); sunField.setMatrixAt(i, m4);
    const c = w.color || [1, 1, 1];
    col.setRGB(c[0], c[1], c[2]); sunField.setColorAt(i, col);
    // the halo is the same hue but pushed brighter, at ~2.6x radius (soft additive corona).
    const gr = r * 2.6; s.set(gr, gr, gr); m4.compose(p, q, s); sunGlowField.setMatrixAt(i, m4);
    gcol.setRGB(0.5 + c[0] * 0.5, 0.5 + c[1] * 0.5, 0.5 + c[2] * 0.5); sunGlowField.setColorAt(i, gcol);
  }
  sunField.instanceMatrix.needsUpdate = true;
  if (sunField.instanceColor) sunField.instanceColor.needsUpdate = true;
  sunGlowField.instanceMatrix.needsUpdate = true;
  if (sunGlowField.instanceColor) sunGlowField.instanceColor.needsUpdate = true;
  scene.add(sunGlowField);   // add glow first so the bright core draws over it
  scene.add(sunField);
}
// the CLUSTER the current dominant genre belongs to (label + color) — drives the HUD.
function clusterOfGenre(genre) {
  if (!genre) return null;
  const id = CLUSTER_OF[genre];
  if (id == null) return null;
  const c = (GENRE_CLUSTERS || []).find((x) => x.id === id);
  return c || null;
}

// world position of a genre's planet marker (the exact GENRE_COORDS projection).
function planetWorldOf(genre) {
  if (!genre || !mods.worldOfCoord) return null;
  const idx = planetIndex[genre];
  if (idx == null || !planetField) return null;
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  planetField.getMatrixAt(idx, m4); m4.decompose(p, q, s);
  return { x: p.x, y: p.y, z: p.z, idx };
}
// scale up the dominant planet (restore the previous) — only when the dominant changes.
function highlightPlanet(genre) {
  if (!planetField || !planetBaseR) return;
  const idx = genre != null ? planetIndex[genre] : null;
  if ((idx == null ? -1 : idx) === _hiIdx) return;
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  if (_hiIdx >= 0) { planetField.getMatrixAt(_hiIdx, m4); m4.decompose(p, q, s); const r = planetBaseR[_hiIdx]; s.set(r, r, r); m4.compose(p, q, s); planetField.setMatrixAt(_hiIdx, m4); }
  if (idx != null) { planetField.getMatrixAt(idx, m4); m4.decompose(p, q, s); const r = planetBaseR[idx] * 2.0; s.set(r, r, r); m4.compose(p, q, s); planetField.setMatrixAt(idx, m4); }
  _hiIdx = idx == null ? -1 : idx;
  planetField.instanceMatrix.needsUpdate = true;
}

// makeShip() — REMOVED per the SMOOTH+LEGIBLE brief. The old low-poly saucer sat in
// front of / behind the band and OBSTRUCTED the view. There is no 3D ship anymore.
// This returns an EMPTY group + a no-op update so the surface-scene lifecycle
// (spawn/despawn, hasShip) is unchanged — nothing is drawn, nothing blocks the band.
function makeShip(traits, seed) {
  const g = new THREE.Object3D();
  g.name = "ship-empty";   // no children — the 3D ship shell is gone (HUD-only cockpit)
  return { group: g, update() {} };
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

  // persistent GENRE STAR-MAP — ONE glowing planet per genre AT its GENRE_COORDS
  // (the same projection the flight camera flies through), so flying == traversing the
  // genre space and NEARBY planets == similar-sounding genres. A single InstancedMesh
  // (one draw call, ~249 low-poly balls of light) — mobile-cheap. Saturated per-genre
  // hues for contrast; the dominant planet is scaled up each frame during transit.
  buildPlanetField();
  // the STARS: one colored SUN per cluster at its star coord (the two-level galaxy —
  // you fly PAST labeled colored suns toward the dominant genre's planet).
  buildSunField();

  // FAR PLANE opened up for the SPREAD-OUT galaxy: the map now floats at y~380 and spans
  // ~+/-350 in x/z, and the transit vantage climbs to ~y760, so the whole scene must stay
  // inside the frustum from every pose along the descent.
  camera = new THREE.PerspectiveCamera(60, lowW / lowH, 0.1, 2600);
  camera.position.set(0, 3, 8);
  camera.lookAt(0, 1, 0);

  // orbit target = the band's centre; seeded FRONT-ON the moment we land.
  orbit.target = new THREE.Vector3(bandCentroid.x, bandCentroid.y, bandCentroid.z);
  wasLanded = false;

  clock = { now: (typeof performance !== "undefined" ? performance.now() : Date.now()) };

  // flight state machine driven by the REAL travel + beat hooks.
  flight = mods.makeFlight({ getTravel, getBeat });
  // APPROACH: commit to descending toward a genre -> BUILD THE SURFACE NOW so it GROWS IN
  // during the descent instead of popping in at touchdown (the unified-scene fix). Keyed by
  // dominant genre (one build per planet); spawnFor uses the live WEIGHTS so the band still
  // matches the mixed audio. It persists through LAND (no rebuild -> no content pop/cut).
  flight.events.on("phase", (ph) => {
    if (ph !== "APPROACH") return;
    const tv = getTravel();
    if (tv.dominant) ensureSurface(tv.weights && tv.weights.length ? tv.weights : tv.dominant, tv.dominant, getS().seed);
  });
  flight.events.on("land", () => {
    despawnSpaceRig();                       // leaving transit — drop the cockpit set
    const tv = getTravel();
    // usually already built at APPROACH (ensureSurface is a no-op then); this covers a
    // DIRECT land (dominance already high, no APPROACH pass) so we never land empty.
    ensureSurface(tv.weights && tv.weights.length ? tv.weights : (tv.dominant || firstGenre()),
      tv.dominant || firstGenre(), getS().seed);
    curDominant = tv.dominant;
    wasLanded = false;                        // force a fresh seamless seed next frame
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
  ensureSurface(tv0.weights && tv0.weights.length ? tv0.weights : firstGenre(), tv0.dominant || firstGenre(), getS().seed);
  curDominant = tv0.dominant;

  mountExit();
  mountHUD();
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
    "left:max(14px,env(safe-area-inset-left))", "z-index:55",
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
  const cl = clusterOfGenre(genre);
  const label = cl ? String(cl.label).toUpperCase() : "DEEP SPACE";
  const glabel = genre ? genreLabelOf(genre) : "cruising";
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
  noteInput();                         // manual override suspends the music-video auto-cam
}
function dollyBy(factor) {
  orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist * factor));
  noteInput();
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
// seedOrbitFromLiveCamera() — seed the orbit so applyOrbitToCamera reproduces the CURRENT
// camera exactly (target = the band, dist/yaw/pitch derived from where the camera is). This
// is the SEAMLESS-ARRIVAL seed: the descent leaves the camera somewhere near the surface and
// the orbit picks up from that precise pose (no snap), then eases into the establishing shot.
function seedOrbitFromLiveCamera() {
  if (!orbit.target || !camera) return;
  orbit.target.set(bandCentroid.x, bandCentroid.y, bandCentroid.z);
  const dx = camera.position.x - bandCentroid.x, dy = camera.position.y - bandCentroid.y, dz = camera.position.z - bandCentroid.z;
  const d = Math.hypot(dx, dy, dz) || orbit.dist;
  orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, d));
  orbit.yaw = Math.atan2(dx, dz);
  orbit.pitch = Math.max(orbit.minPitch, Math.min(orbit.maxPitch, Math.asin(Math.max(-0.999, Math.min(0.999, dy / d)))));
  orbit.fov = camera.fov || orbit.fov;
}
// runEstablish(dt) — critically-ease the orbit from the seeded arrival pose into the front
// establishing wide shot (autoShots[0]), then hand off to the roaming auto-cam. One smooth
// pull-back reveal instead of a hard cut — the touchdown reads as an arrival, not a jump.
function runEstablish(dt) {
  const sh = autoShots[0];
  if (!sh || !orbit.target) { establish.active = false; return; }
  const k = 1 - Math.exp(-(dt > 0 ? dt : 0) / 0.32);
  const shDist = Math.max(orbit.minDist, Math.min(orbit.maxDist, sh.dist));
  orbit.target.x += (sh.target.x - orbit.target.x) * k;
  orbit.target.y += (sh.target.y - orbit.target.y) * k;
  orbit.target.z += (sh.target.z - orbit.target.z) * k;
  orbit.dist += (shDist - orbit.dist) * k;
  orbit.yaw += (sh.yaw - orbit.yaw) * k;
  orbit.pitch += (sh.pitch - orbit.pitch) * k;
  orbit.fov += (sh.fov - orbit.fov) * k;
  establish.t += (dt > 0 ? dt : 0);
  if (establish.t >= ESTAB_DUR) {
    // done — resume the music-video roam on shot 0 (drift, no re-snap).
    establish.active = false;
    autoCam.shot = 0; autoCam.shotT = 0; autoCam.forceCut = false; autoCam.active = true;
    autoCam._yawRate = sh.yawRate; autoCam._dolly = sh.dolly || 0;
  }
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
  // FLOOR CLAMP: the camera never dips below the ground plane at the surface — a shot
  // that would put the eye underground is lifted back to FLOOR_Y (keeps the band framed
  // from above the stage instead of clipping through it).
  const camY = Math.max(FLOOR_Y, t.y + orbit.dist * sp);
  camera.position.set(t.x + orbit.dist * cp * sy, camY, t.z + orbit.dist * cp * cy);
  camera.lookAt(t.x, t.y, t.z);
  if (camera.fov !== orbit.fov) { camera.fov = orbit.fov; camera.updateProjectionMatrix(); }
}
// applyTransitCamera(dt, p) — drive the camera in TRANSIT as a DAMPED follow of the
// flight pose. Seeded from the LIVE camera the first transit frame (so lift-off glides up
// from the surface), then TIGHTLY follows the flight pose. The pose is ALREADY a smooth,
// dead-reckoned glide (flight.js ramps the followed centroid every frame), so this follow
// no longer needs to smooth a stepping pose — a LOOSE follow here just added its own LAG on
// top, which lagged the aiming-amplified transit swing and left the camera drifting for ~a
// second after the pose had settled (the "still moving after the blend stopped" bug). A
// tight follow keeps the seed-glide on lift-off yet converges promptly. Floor-clamped;
// deterministic (only dt).
function applyTransitCamera(dt, p) {
  if (!camFollow.init) {
    camFollow.x = camera.position.x; camFollow.y = camera.position.y; camFollow.z = camera.position.z;
    camFollow.lx = p.lookAt.x; camFollow.ly = p.lookAt.y; camFollow.lz = p.lookAt.z;
    camFollow.fov = camera.fov; camFollow.init = true;
  }
  const k = 1 - Math.exp(-(dt > 0 ? dt : 0) * 6.0);   // eased (frame-rate independent) follow — tight (pose is pre-smoothed)
  camFollow.x += (p.position.x - camFollow.x) * k;
  camFollow.y += (p.position.y - camFollow.y) * k;
  camFollow.z += (p.position.z - camFollow.z) * k;
  camFollow.lx += (p.lookAt.x - camFollow.lx) * k;
  camFollow.ly += (p.lookAt.y - camFollow.ly) * k;
  camFollow.lz += (p.lookAt.z - camFollow.lz) * k;
  camFollow.fov += (p.fov - camFollow.fov) * k;
  camera.position.set(camFollow.x, Math.max(FLOOR_Y, camFollow.y), camFollow.z);
  camera.lookAt(camFollow.lx, camFollow.ly, camFollow.lz);
  if (Math.abs(camera.fov - camFollow.fov) > 1e-3) { camera.fov = camFollow.fov; camera.updateProjectionMatrix(); }
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
  noteInput();
}

// -- MUSIC-VIDEO auto-camera ------------------------------------------------------
// buildAutoShots(): a per-land cinematic shot list — a FRONT establishing WIDE (shot
// 0, = the landed default framing), a CLOSEUP of each band alien, and a couple of WIDE
// side/high city shots — interleaved wide/closeup so cuts alternate between players and
// the whole stage. Deterministic (derived from the spawned band positions).
function buildAutoShots() {
  const cy = bandCentroid.y;
  // frame to the ACTUAL band width (aliens are spread wide now) so wides never crop.
  let halfW = 1.5;
  for (const a of band) halfW = Math.max(halfW, Math.abs((a.stage || a.group).position.x - bandCentroid.x));
  const wide = Math.max(orbit.minDist + 2, 6.5 + 1.3 * halfW + 0.6 * Math.max(1, band.length));
  const wides = [
    // 0: FRONT establishing wide (the landed default framing). Tilted a touch DOWN for the
    // little-prince scale so the small world's curved horizon + wrapped city read on landing.
    { target: { x: bandCentroid.x, y: cy, z: bandCentroid.z }, yaw: 0, pitch: 0.24, dist: wide, fov: 56, yawRate: 0.04, kind: "wide" },
    // side 3/4 wide.
    { target: { x: bandCentroid.x, y: cy + 0.4, z: bandCentroid.z }, yaw: 0.95, pitch: 0.30, dist: wide + 2.5, fov: 60, yawRate: -0.05, kind: "wide" },
    { target: { x: bandCentroid.x, y: cy, z: bandCentroid.z }, yaw: -0.95, pitch: 0.12, dist: wide + 1.5, fov: 58, yawRate: 0.05, kind: "wide" },
  ];
  // VARIETY: a high FLYOVER (up + over, looking down) and a push THROUGH the city. Both
  // stay AT/ABOVE the band — the flyover from high above, the through-shot at eye level
  // looking slightly DOWN as it pushes in (Fix 3: never up from the floor).
  const flyover = { target: { x: bandCentroid.x, y: cy + 0.6, z: bandCentroid.z }, yaw: 0.2, pitch: 0.85, dist: wide + 4, fov: 62, yawRate: 0.07, kind: "flyover" };
  const through = { target: { x: bandCentroid.x, y: cy + 0.15, z: bandCentroid.z }, yaw: 0.0, pitch: 0.06, dist: Math.max(orbit.minDist + 1, 4.5), fov: 66, yawRate: 0.0, dolly: -1.4, kind: "through" };
  // MEDIUM closeups on each player — framed on the TORSO/face at a distance that keeps the
  // whole figure in view (never a limb-only extreme zoom: dist floored ~3.4). Fix 3: a
  // clear downward tilt so the camera looks DOWN AT the alien, not up from the floor.
  const closeups = band.map((a, i) => {
    const bp = (a.stage || a.group).position;
    return { target: { x: bp.x, y: 1.3, z: bp.z }, yaw: (i % 2 ? 0.30 : -0.30), pitch: 0.16, dist: 3.6, fov: 50, yawRate: (i % 2 ? 1 : -1) * 0.07, kind: "closeup" };
  });
  // the DRUMMER shot — a dedicated medium of the drums player (the auto-cam ALWAYS cuts
  // here on a fill). Framed on the kit/torso from slightly ABOVE, never a floor-up angle.
  const drummer = band.find((a) => a._voice === "drums") || band.find((a) => a._role === "drum");
  autoCam.drummerShot = -1;
  // interleave: front-wide, closeup, side-wide, flyover, closeup, through, ...
  autoShots = [wides[0]];
  let wi = 1, ci = 0;
  const extras = [flyover, through];
  let ei = 0;
  while (ci < closeups.length || wi < wides.length || ei < extras.length) {
    if (ci < closeups.length) autoShots.push(closeups[ci++]);
    if (wi < wides.length) autoShots.push(wides[wi++]);
    if (ei < extras.length && (ci & 1)) autoShots.push(extras[ei++]);
  }
  while (ei < extras.length) autoShots.push(extras[ei++]);
  if (drummer) {
    const bp = (drummer.stage || drummer.group).position;
    autoCam.drummerShot = autoShots.length;
    autoShots.push({ target: { x: bp.x, y: 1.25, z: bp.z }, yaw: 0.18, pitch: 0.14, dist: 3.9, fov: 50, yawRate: -0.05, kind: "drummer" });
  }
  // FROM-BELOW GUARD (Fix 3): keep every shot's camera AT or ABOVE the band's eye level so
  // no shot ever looks UP from the floor (which framed mostly ground). For each shot the
  // resolved eye height is target.y + dist*sin(pitch); if that would sit below the band eye
  // level we RAISE the pitch to the minimum that lands it exactly at eye level. Deterministic;
  // preserves the flyover (high) + through-city (eye-level push) characters, only lifting the
  // up-from-the-floor angles. Mirrors applyOrbitToCamera's dist clamp so the check is exact.
  const eyeY = bandCentroid.y;
  for (const sh of autoShots) {
    const d = Math.max(orbit.minDist, Math.min(orbit.maxDist, sh.dist));
    if (sh.target.y + d * Math.sin(sh.pitch) < eyeY) {
      sh.pitch = Math.asin(Math.max(-1, Math.min(1, (eyeY - sh.target.y) / d)));
    }
  }
}
// snap the orbit onto a shot (a hard CUT). Shared by cuts + the drummer-on-fill cut.
function applyShot(sh) {
  if (!sh) return;
  orbit.target.set(sh.target.x, sh.target.y, sh.target.z);
  orbit.yaw = sh.yaw; orbit.pitch = sh.pitch;
  orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, sh.dist));
  orbit.fov = sh.fov; autoCam._yawRate = sh.yawRate; autoCam._dolly = sh.dolly || 0;
}
// runAutoCam(dt, st): drive the orbit as a music video — CUT to a new shot on the beat
// (every CUT_BEATS), and between cuts slowly drift the yaw + bob the framing on the
// beat. A cut SNAPS the orbit to the shot (hard cut); the drift is a slow dolly/orbit.
function runAutoCam(dt, st) {
  if (!autoShots.length) buildAutoShots();
  if (!autoShots.length) return;
  const bt = getBeat();
  const spb = (bt && bt.spb) > 0 ? bt.spb : 0.5;
  const shotDur = CUT_BEATS * spb;
  autoCam.shotT += dt;

  // DRUMMER-ON-FILL: while a fill is firing, ALWAYS be on the drummer. Cut there once
  // (on the fill's rising edge) and hold until the fill ends — then resume normal cuts.
  const fill = currentFill();
  if (fill && autoCam.drummerShot >= 0) {
    if (autoCam.shot !== autoCam.drummerShot) {
      autoCam.shot = autoCam.drummerShot; autoCam.cuts++; autoCam.shotT = 0;
      applyShot(autoShots[autoCam.shot]);
    }
    autoCam.onDrummer = true;
    autoCam.forceCut = false;
  } else if (autoCam.forceCut || autoCam.shotT >= shotDur) {
    if (!autoCam.forceCut) {
      // advance to the next shot, but SKIP the dedicated drummer shot in the normal
      // rotation (it is reserved for fills) so the drummer read stays meaningful.
      do { autoCam.shot = (autoCam.shot + 1) % autoShots.length; }
      while (autoShots.length > 1 && autoCam.shot === autoCam.drummerShot);
      autoCam.cuts++;
    }
    autoCam.forceCut = false; autoCam.shotT = 0;
    autoCam.onDrummer = false;
    applyShot(autoShots[autoCam.shot]);
  } else {
    autoCam.onDrummer = (autoCam.shot === autoCam.drummerShot);
    // SMOOTH eased motion between cuts — a slow orbit drift + an optional dolly for the
    // through-the-city shot. NO beat bob (that was the jitter the brief called out).
    orbit.yaw += (autoCam._yawRate || 0) * dt;
    if (autoCam._dolly) orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist + autoCam._dolly * dt));
  }
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
  _vclock += (dt > 0 ? dt : 0);         // the deterministic auto-cam timebase
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
  const landed = !!LANDED_PHASES[st.phase];
  if (landed) {
    // parked: the orbit/auto-cam owns the camera — mark the transit follow stale so the
    // NEXT lift-off re-seeds its glide from wherever the landed camera ended up.
    camFollow.init = false;
    // on touchdown: restore the surface sky + (re)build the cinematic shot list and
    // reset the auto-camera to its FRONT establishing wide shot.
    if (!wasLanded) {
      if (scene.background && scene.background.isColor) scene.background.setHex(SKY_COLOR);
      buildAutoShots();
      // SEAMLESS ARRIVAL: seed the orbit from the LIVE descent pose (continuous — no snap),
      // then EASE into the establishing wide shot, instead of hard-cutting to it. This is the
      // fix for the touchdown lurch/cut: the galaxy->surface descent flows straight into the
      // landed framing as one continuous move.
      seedOrbitFromLiveCamera();
      establish.active = true; establish.t = 0;
      autoCam.shot = 0; autoCam.shotT = 0; autoCam.cuts = 0; autoCam.forceCut = false; autoCam.active = false;
      _lastInputT = -1e9;                 // a fresh land starts in auto-camera (no stale input)
    }
    const userActive = (_vclock - _lastInputT) < AUTO_IDLE;
    if (userActive) {
      // MANUAL override: the user drives the orbit directly.
      autoCam.active = false; autoCam.forceCut = true; establish.active = false;   // cancel the ease
      applyKeyPan(dt);
    } else if (establish.active) {
      // ARRIVAL EASE: glide from the descent pose into the establishing shot (no hard cut).
      runEstablish(dt);
    } else {
      // MUSIC-VIDEO: the auto-camera drives the orbit (slow moves + beat-synced cuts).
      autoCam.active = true;
      runAutoCam(dt, st);
    }
    applyOrbitToCamera();
  } else if (cockpit) {
    // IN TRANSIT WITH THE COCKPIT SET: the long zoom through the star-map, cockpit
    // framing the view and fading as we descend; the leaving planet recedes below.
    updateSpaceRig(dt, st);
  } else {
    // bootstrap transit (before the first depart): SMOOTHLY follow the star-map zoom
    // pose, keep the orbit shadowing it, and highlight the resolving planet in the field.
    applyTransitCamera(dt, p);
    highlightPlanet(st.dominant || curDominant || null);
    seedOrbitFromPose(p);
  }
  wasLanded = landed;
  // 2D COCKPIT HUD: reflect the current dominant genre's star system (cluster label +
  // color). In deep space (no dominant) it reads "DEEP SPACE".
  updateHUD(st.dominant || curDominant || null);
  // keep the shadow frustum + key aimed at the band when landed (transit forms are the
  // MeshBasic star-map + cockpit, which don't need cast shadows).
  if (sun) {
    sun.target.position.set(bandCentroid.x, 0, bandCentroid.z);
    sun.position.set(bandCentroid.x + 6, 11, bandCentroid.z + 7);
    sun.target.updateMatrixWorld();
  }
  // SCORE BRIDGE (per frame — NO rebuild): read the audio beat, resolve the CURRENT
  // bar + bar-local phase, and hand every band member its voice's real note onsets
  // for this bar as ctx {barPhase, playing, level, notes}. The alien triggers its
  // playing appendage on those onsets when playing && level>~0.05, and RESTS (idles/
  // sways, instrument lowered) otherwise. Dancers have no part -> the beat-only groove.
  const bt = getBeat();
  const barPhase = eventPlan ? barPhaseOf(bt) : (st.beatPhase || 0);
  // advance the LOCAL bar counter on a barPhase wrap when there is no audio serial.
  if (eventPlan && !(bt && typeof bt.serial === "number" && bt.serial >= 0)) {
    if (barPhase < _lastBarPhase - 0.3) _localBar++;
    _lastBarPhase = barPhase;
  }
  const barIdx = currentBar(bt);
  _curBarIdx = barIdx;
  const loud = eventPlan ? loudnessAt(barIdx) : clamp01n(st.beatPhase != null ? 0.5 : 0);
  for (const a of band) {
    if (eventPlan && a._voice) a.update(dt, ctxForVoice(a._voice, barIdx, barPhase));
    else a.update(dt, st.beatPhase);   // fallback: beat-only path (no plan yet)
  }
  // DANCERS get the overall track LOUDNESS in ctx (CONTRACT): each dancer keeps its own
  // phase/style and DESYNCS when quiet, SYNCING UP when the room is loud. valueOf keeps
  // the legacy numeric-phase path working if the alien rig hasn't been upgraded yet.
  for (const d of dancers) {
    d.update(dt, { barPhase, loudness: loud, playing: true, level: 1, valueOf() { return barPhase; } });
  }
  if (backdrop) backdrop.update(dt);
  if (ship) ship.update(dt, st.phase, st.landProgress);
  if (!_skipRender) ps1.render(scene, camera);   // _skipRender: headless state-only stepping
}
let _skipRender = false;   // when true, update() advances all logic but skips the GL render

// updateSpaceRig(dt, st) — drive the STAR-MAP transit: the camera is the flight's
// continuous zoom through the planet field; the cockpit rides the camera and FADES by
// viewportFade (visible high in space, gone as we descend); the LEAVING planet recedes
// below; the genre display tracks the resolving dominant; the dominant planet in the
// field is scaled up as the target.
function updateSpaceRig(dt, st) {
  const s = Math.max(0, Math.min(1, st.spaceProgress != null ? st.spaceProgress : 1));
  const fade = Math.max(0, Math.min(1, st.viewportFade != null ? st.viewportFade : s));
  const p = st.cameraPose;
  // sky -> space fade (bright dusk sky at the surface, near-black in deep space).
  if (scene.background && scene.background.isColor) {
    scene.background.setHex(SKY_COLOR).lerp(_spaceCol, s);
  }
  // camera = the star-map zoom pose (long descent toward the resolving planet), driven
  // as a SMOOTH damped follow so the lift-off + cruise glide instead of snapping.
  applyTransitCamera(dt, p);
  // scale up the resolving planet in the star-map so the target reads.
  highlightPlanet(st.dominant || spaceActiveGenre || null);
  // cockpit RIDES the camera (its viewport frames the view) and FADES as we descend.
  cockpit.update(dt);
  cockpit.group.position.copy(camera.position);
  cockpit.group.quaternion.copy(camera.quaternion);
  cockpit.group.visible = fade > 0.06;
  fadeGroup(cockpit.group, 0.15 + 0.85 * fade);
  // keep the display's highlighted target current as the blend resolves the next genre.
  const active = genreLabelOf(st.dominant || spaceActiveGenre);
  if (active && active !== _lastActive) { cockpit.setGenres(genreLabels(), active); _lastActive = active; }
  // the LEAVING planet (the detailed foreground world) recedes BELOW as we climb: near
  // & large just after liftoff (s~0), dropping away + shrinking out in deep space (s~1).
  if (planet) {
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
  unmountHUD();
  window.removeEventListener("resize", onResize);
  despawnBand();                                   // disposes band + dancers + stage + backdrop + ship
  despawnSpaceRig();                               // disposes cockpit + planet (if in transit)
  if (starfield) { scene.remove(starfield); disposeObj(starfield); starfield = null; }
  if (planetField) { scene.remove(planetField); disposeObj(planetField); planetField = null; }
  if (sunGlowField) { scene.remove(sunGlowField); disposeObj(sunGlowField); sunGlowField = null; }
  if (sunField) { scene.remove(sunField); disposeObj(sunField); sunField = null; sunIndex = null; sunBaseR = null; }
  for (const g in planetIndex) delete planetIndex[g];
  planetBaseR = null; _hiIdx = -1;
  autoShots = []; autoCam.active = false; autoCam.shot = 0; autoCam.shotT = 0; autoCam.cuts = 0; autoCam.forceCut = true;
  autoCam.onDrummer = false; autoCam.drummerShot = -1;
  establish.active = false; establish.t = 0;
  camFollow.init = false; _wasTransit = false; _fillInject = null;
  _vclock = 0; _lastInputT = -1e9;
  // dispose remaining GL resources (lights carry none; belt-and-braces geometry sweep).
  try { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } catch (e) {}
  try { ps1 && ps1.dispose && ps1.dispose(); } catch (e) {}
  try { lowResTarget && lowResTarget.dispose(); } catch (e) {}
  try { renderer && renderer.dispose(); } catch (e) {}
  if (displayCanvas && displayCanvas.parentNode) displayCanvas.parentNode.removeChild(displayCanvas);
  displayCanvas = null; renderer = null; scene = null; camera = null; lowResTarget = null; ps1 = null; flight = null;
  sun = null; _spaceCol = null; _lastActive = null;
  curTraits = null; curDominant = null; curRenderStyle = null;
  eventPlan = null; eventPlanKey = null; _localBar = 0; _lastBarPhase = 0; _curBarIdx = 0;
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

// frameSignature(gx,gy) — render the current frame and reduce it to a coarse gx*gy
// grid of average luminance (0..1). A CONTINUITY probe: the L1 distance between two
// consecutive frame signatures is a cheap "how much did the picture change" scalar,
// so a SCENE SWAP / teleport (a whole-frame content jump) shows a large signature
// delta while a smooth cruise/descent stays bounded. Headless-proof; only the test
// calls it (it forces a render), harmless + unused in production.
function frameSignature(gx, gy) {
  if (!running || !renderer || !lowResTarget) return null;
  gx = gx || 24; gy = gy || 18;
  update(0);   // ensure a fresh render into the low-res target
  const w = lowW, h = lowH, buf = new Uint8Array(w * h * 4);
  try { renderer.readRenderTargetPixels(lowResTarget, 0, 0, w, h, buf); } catch (e) { return { error: String(e) }; }
  const sig = new Float32Array(gx * gy);
  const cnt = new Uint32Array(gx * gy);
  for (let y = 0; y < h; y++) {
    const cy = Math.min(gy - 1, (y * gy / h) | 0);
    for (let x = 0; x < w; x++) {
      const cx = Math.min(gx - 1, (x * gx / w) | 0);
      const i = (y * w + x) * 4;
      // Rec.601 luma, normalized 0..1
      const lum = (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) / 255;
      const ci = cy * gx + cx; sig[ci] += lum; cnt[ci]++;
    }
  }
  for (let i = 0; i < sig.length; i++) if (cnt[i]) sig[i] /= cnt[i];
  return { gx, gy, sig: Array.from(sig, (v) => +v.toFixed(4)) };
}

// debug / headless-probe hook (mirrors window.__X / window.__VIDEO).
window.__STARCRUISE = { start, stop, toggle, update, isRunning, getTravel, getBeat, running: false,
  canvas: () => displayCanvas, band: () => band, loaded: () => loaded, sampleLowRes, frameSignature,
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
  // ---- FIDELITY-CAMERA + STAR-MAP + MUSIC-VIDEO probes (headless-proof) -------------
  // fidelity(): the dominant-weight -> zoom signal driving the camera (higher weight ->
  // closer/landed; low -> up in space with the viewport visible).
  fidelity: () => {
    if (!lastState) return null;
    const cp = lastState.cameraPose;
    // the flight's INTENDED zoom (pose position -> look target) — monotonic with the
    // dominant weight, independent of the auto-cam's roaming shots.
    const poseDist = cp ? Math.hypot(cp.position.x - cp.lookAt.x, cp.position.y - cp.lookAt.y, cp.position.z - cp.lookAt.z) : null;
    return {
      dominantWeight: lastState.dominantWeight, imm: lastState.imm, landed: lastState.landed,
      landProgress: lastState.landProgress, spaceProgress: lastState.spaceProgress,
      viewportFade: lastState.viewportFade, fullZoom: lastState.fullZoom, phase: lastState.phase,
      camDist: poseDist, camY: camera ? camera.position.y : null,
    };
  },
  // planetField(): proof the star-map planets sit AT their GENRE_COORDS. Returns the
  // count + a few genres' marker world-positions vs the flight projection of their coord.
  planetField: (genres) => {
    if (!planetField) return null;
    const list = (genres && genres.length ? genres : Object.keys(planetIndex).slice(0, 4));
    const checks = list.map((g) => {
      const w = planetWorldOf(g);
      const proj = (mods.worldOfCoord && window.GenreKernel) ? null : null;   // proj computed in test via GENRE_COORDS
      return { g, marker: w ? { x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2) } : null };
    });
    return { count: planetField.count, field: mods.FIELD, checks };
  },
  // autoCam(): the music-video camera state (active when landed + no recent input;
  // shot index advances on beat cuts; userActive = manual override in effect).
  autoCam: () => ({ active: autoCam.active, shot: autoCam.shot, shots: autoShots.length,
    cuts: autoCam.cuts, userActive: (_vclock - _lastInputT) < AUTO_IDLE,
    onDrummer: !!autoCam.onDrummer, drummerShot: autoCam.drummerShot,
    kind: autoShots[autoCam.shot] ? autoShots[autoCam.shot].kind : null }),
  // autoShotList(): the built cinematic shots with each shot's RESOLVED camera eye height
  // (target.y + clamped-dist*sin(pitch)) — proves NO shot frames the band from below the
  // eye level (Fix 3). camY is the raw eye height; clampedY applies the ground floor clamp.
  autoShotList: () => autoShots.map((s) => {
    const d = Math.max(orbit.minDist, Math.min(orbit.maxDist, s.dist));
    const camY = s.target.y + d * Math.sin(s.pitch);
    return { kind: s.kind, pitch: +s.pitch.toFixed(3), dist: +d.toFixed(2),
      targetY: +s.target.y.toFixed(2), camY: +camY.toFixed(3),
      clampedY: +Math.max(FLOOR_Y, camY).toFixed(3) };
  }),
  // bandPositions(): each spawned alien's staging position (proves the SPREAD).
  bandPositions: () => band.map((a) => { const g = a.stage || a.group;
    return { voice: a._voice, x: +g.position.x.toFixed(2), y: +g.position.y.toFixed(2), z: +g.position.z.toFixed(2) }; }),
  // ---- GALAXY (SUNS) + HUD + FILL probes (headless-proof; harmless in production) ----
  // suns(): the colored cluster SUNS — count + each sun's marker world-pos/color/label,
  // to prove they sit AT their cluster.star projection with the cluster's color.
  suns: (n) => {
    if (!sunField || !sunIndex) return null;
    const list = sunIndex.slice(0, n || 6).map((w, i) => ({
      id: w.id, label: w.label, color: w.color,
      marker: { x: +w.x.toFixed(2), y: +w.y.toFixed(2), z: +w.z.toFixed(2) } }));
    return { count: sunField.count, field: mods.FIELD, suns: list };
  },
  // sunGlow(): proves the suns render as EMISSIVE glowing STARS — a self-lit core
  // (toneMapped:false == drawn at full brightness, not shaded down) PLUS an additive
  // corona/halo shell. Used by the galaxy-spread probe to assert "suns are emissive".
  sunGlow: () => {
    if (!sunField) return null;
    const cm = sunField.material, gm = sunGlowField && sunGlowField.material;
    return {
      cores: sunField.count,
      coreToneMapped: !!cm.toneMapped,        // false => self-lit at full brightness (glowing star)
      glowMesh: !!sunGlowField,
      glows: sunGlowField ? sunGlowField.count : 0,
      glowAdditive: !!(gm && gm.blending === THREE.AdditiveBlending),
      glowTransparent: !!(gm && gm.transparent),
      coreR: sunBaseR ? Array.from(sunBaseR).slice(0, 6).map((r) => +r.toFixed(2)) : null,
    };
  },
  // hud(): the 2D cockpit HUD — mounted? + its current label/genre text (proves the
  // 3D cockpit was replaced by a DOM label overlay).
  hud: () => (hudEl ? { mounted: true,
    sys: (hudEl.querySelector("#sc-hud-sys") || {}).textContent,
    label: (hudEl.querySelector("#sc-hud-label") || {}).textContent,
    genre: (hudEl.querySelector("#sc-hud-genre") || {}).textContent } : { mounted: false }),
  // shipMeshCount(): how many DRAWN meshes the (now-empty) ship + cockpit groups hold —
  // proves the obstructing 3D ship/cockpit shell is GONE (should be 0).
  shipMeshCount: () => {
    let n = 0;
    const scan = (g) => g && g.group && g.group.traverse((o) => { if (o.isMesh) n++; });
    scan(ship); scan(cockpit);
    return n;
  },
  // fill()/__injectFill(): the per-bar drum-FILL flag the auto-camera cuts to the drummer
  // on. __injectFill(bool|null) forces it for the headless drummer-cam proof (null=real).
  fill: () => ({ now: currentFill(), fillBars: eventPlan ? eventPlan.fillBars : null, curBar: _curBarIdx }),
  __injectFill: (b) => { _fillInject = (b == null ? null : !!b); },
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
  // __stepNoRender(dt): advance ALL logic (flight, auto-cam, band, spawn/despawn) but
  // SKIP the GL render — for long headless probe runs that only read state/camera/orbit
  // (fidelity, music-video, re-lands), so they don't accumulate SwiftShader GPU load.
  __stepNoRender: (dt) => { _skipRender = true; try { update(dt || 0); } finally { _skipRender = false; } return lastState; },
  // __pauseLoop/__resumeLoop: headless-only — stop the RAF render loop so scripted
  // __step()s are the SOLE renderer (halves GL load + makes long probe runs deterministic
  // under headless SwiftShader). Harmless in production; only the test calls it.
  __pauseLoop: () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } return true; },
  __resumeLoop: () => { if (running && !raf) { lastT = (typeof performance !== "undefined" ? performance.now() : Date.now()); loop(); } return true; },
  state: () => lastState,
  // ---- SCORE-BRIDGE probes (headless-proof; harmless in production) ----------------
  // eventPlan(): a summary of the cached per-bar note plan + how many times
  // buildEvents ran (proves it is built PER GENRE, never per frame).
  eventPlan: () => (eventPlan ? {
    numBars: eventPlan.numBars, cbeats: eventPlan.cbeats, bpm: eventPlan.bpm,
    buildCount: planBuildCount, curBar: _curBarIdx,
    // per-voice: total onsets across the whole plan + how many bars each voice sounds in.
    voices: (() => {
      const agg = {};
      eventPlan.bars.forEach((bar) => { for (const v in bar) {
        agg[v] = agg[v] || { onsets: 0, barsPlaying: 0 };
        agg[v].onsets += bar[v].notes.length; if (bar[v].playing) agg[v].barsPlaying++;
      } });
      return agg;
    })(),
  } : null),
  buildCount: () => planBuildCount,
  // bandVoices(): the engine voice id each spawned alien is in charge of.
  bandVoices: () => band.map((a) => a._voice || null),
  // voiceCtx(voice): the LAST ctx the bridge passed that voice this frame
  // ({barPhase, playing, level, notes:count}) — proves real per-voice notes flow.
  voiceCtx: (v) => _lastCtx[v] || null,
  // barAt(barIdx, voice): the raw note list a voice plays in a given bar (onset t,
  // pitch, dur, vel) — proves the bucketing produced ACTUAL onsets, not beat ticks.
  barAt: (barIdx, voice) => {
    if (!eventPlan) return null;
    const bi = ((barIdx | 0) % eventPlan.numBars + eventPlan.numBars) % eventPlan.numBars;
    const slot = eventPlan.bars[bi] && eventPlan.bars[bi][voice];
    return slot ? { playing: slot.playing, level: +slot.level.toFixed(3), notes: slot.notes.slice(0, 12) } : { playing: false, level: 0, notes: [] };
  },
  // ---- headless-probe: scene inspection + deterministic travel/beat injection ----
  hasBackdrop: () => !!backdrop,
  // hasGround(): is the procedural PLANET ground present under the band? + a couple of
  // planted heights (proves the band sits ON real terrain, not a flat stage that popped in).
  hasGround: () => !!groundPlanet,
  ground: () => (groundPlanet ? { radius: +groundRadius.toFixed(2), h0: +groundH0.toFixed(3),
    y00: +groundYAt(0, 0).toFixed(3), yEdge: +groundYAt(9, 0).toFixed(3),
    smallWorld: smallWorldGround, terrain: groundPlanet.userData && groundPlanet.userData.terrainType,
    posY: +groundPlanet.position.y.toFixed(2) } : null),
  // ---- LITTLE-PRINCE (small-world landing) probes (headless-proof; harmless in production) ----
  // smallWorld(): is the landed ground a SMALL curved world? + its radius/terrain/offset. The
  // curvatureDrop across a band half-span proves the horizon visibly bends away.
  smallWorld: () => {
    if (!groundPlanet) return null;
    let drop = 0;
    try { drop = groundYAt(0, 0) - groundYAt(Math.min(groundRadius * 0.4, 9), 0); } catch (e) {}
    return { small: smallWorldGround, radius: +groundRadius.toFixed(2),
      terrain: groundPlanet.userData && groundPlanet.userData.terrainType,
      offsetY: +groundPlanet.position.y.toFixed(2), curveDrop: +drop.toFixed(3) };
  },
  // bandOnSurface(): each band member's distance from the planet CENTRE (≈ the surface radius,
  // proving they sit ON the curved terrain) and how closely its local +Y aligns to the outward
  // surface normal (≈ 1 => standing UPRIGHT on the little world, oriented to the normal).
  bandOnSurface: () => {
    if (!groundPlanet || !band.length) return null;
    const c = new THREE.Vector3(0, groundPlanet.position.y, 0);   // planet centre in world space
    const YA = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(), P = new THREE.Vector3();
    return band.map((a) => {
      const g = a.stage || a.group;
      P.copy(g.position);
      up.copy(YA).applyQuaternion(g.quaternion);
      const nrm = P.clone().sub(c); const r = nrm.length(); nrm.normalize();
      return { voice: a._voice, r: +r.toFixed(2), upDotN: +up.dot(nrm).toFixed(3),
        y: +P.y.toFixed(2) };
    });
  },
  // backdropOnSurface(): sample the city/landscape INSTANCES' world positions and report how
  // many sit ON the planet's sphere (distance-from-centre ≈ the surface radius) — proves the
  // city WRAPPED the curved surface rather than composing flat.
  backdropOnSurface: () => {
    if (!groundPlanet || !backdrop || !backdrop.group) return null;
    const c = new THREE.Vector3(0, groundPlanet.position.y, 0);
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    backdrop.group.updateMatrixWorld(true);
    let cnt = 0, onSphere = 0, minR = 1e9, maxR = 0;
    backdrop.group.traverse((o) => {
      if (!o.isInstancedMesh) return;
      if (o.name === "orbs" || o.name === "beacons") return;   // point-lights; radius irrelevant
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M); M.premultiply(o.matrixWorld); M.decompose(P, Q, S);
        const r = P.distanceTo(c);
        cnt++; if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (r > groundRadius - 5) onSphere++;
      }
    });
    return { curved: !!(backdrop.group.userData && backdrop.group.userData.scOnSurface),
      count: cnt, onSphere, minR: +minR.toFixed(2), maxR: +maxR.toFixed(2), radius: +groundRadius.toFixed(2) };
  },
  // bg(): the scene background + renderer clear colour hex — proves SPACE IS TRUE BLACK.
  bg: () => ({
    scene: scene && scene.background && scene.background.isColor ? scene.background.getHex() : null,
    clear: renderer ? renderer.getClearColor(new THREE.Color()).getHex() : null,
  }),
  hasShip: () => !!ship,
  hasCockpit: () => !!cockpit,
  hasPlanet: () => !!planet,
  sceneChildren: () => (scene ? scene.children.length : 0),
  traits: () => curTraits,
  // renderStyle probes: the active genre's derived style + the LIVE post-fx uniforms
  // it pushed into the PS1 pass (proves the pass changes by genre + updates on land).
  renderStyle: () => curRenderStyle,
  postStyle: () => (ps1 && ps1.getStyle ? ps1.getStyle() : null),
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
