// camera.js — WHERE THE CAMERA IS, and who is driving it.
//
// The cruise has THREE camera regimes and this module owns all three plus every
// input that touches them:
//
//   TRANSIT   the auto-flight owns the path; applyTransitCamera() is a damped
//             follow of the flight pose, plus a persistent FREE-LOOK offset so the
//             pilot can turn their head without fighting the path.
//   LANDED    a hand-rolled ORBIT rig (no vendored Three addon) that the MUSIC-VIDEO
//             auto-camera drives — cutting between band closeups and wides on the
//             beat, always cutting to the drummer on a fill — until the user drags,
//             pinches or WASDs, which suspends it for AUTO_IDLE seconds.
//   ARRIVAL   the ease between them: touchdown seeds the orbit from the LIVE descent
//             pose and critically-eases into the establishing wide, so the landing
//             reads as one continuous move rather than a cut.
//
// It owns no scene objects and never touches the renderer; it frames the band by
// reading ./scene.js's live roster + centroid, and takes the camera itself, the
// flight state and stop() as injected handles (initCamera) so there is no import
// cycle back to the controller. All motion comes from dt (deterministic).
//
// CONTRACT
//   initCamera({ THREE, getCamera, getState, stop })  once per start()
//   bindInput(canvas) / unbindInput()
//   tick(dt) -> vclock      advance the deterministic auto-cam timebase
//   landedFrame(dt, st, fresh)     the whole parked-camera frame
//   applyTransitCamera(dt, pose) / seedOrbitFromPose(pose) / applyOrbitToCamera()
//   resetCamera()           stop(): drop the shots + timebase
//   orbit / autoCam / transitLook / autoShots() / FLOOR_Y / LANDED_PHASES (probes)

import { getBand, bandCentroid } from "./scene.js";
import { getBeat, currentFill } from "./bridge.js";

// ---- injected handles -----------------------------------------------------------
let THREE = null;
let getCamera = () => null;     // the live THREE.PerspectiveCamera (rebuilt each start())
let getState = () => null;      // the last flight state (phase / cameraPose / …)
let onEscape = () => {};        // Escape leaves the view (the controller's stop())
export function initCamera(deps) {
  THREE = deps.THREE;
  getCamera = deps.getCamera; getState = deps.getState; onEscape = deps.stop;
  // orbit target = the band's centre; seeded FRONT-ON the moment we land.
  orbit.target = new THREE.Vector3(bandCentroid.x, bandCentroid.y, bandCentroid.z);
  // reusable scratch vectors for the transit free-look (avoid per-frame allocation).
  _tv3.a = new THREE.Vector3(); _tv3.b = new THREE.Vector3();
  _tv3.up = new THREE.Vector3(0, 1, 0); _tv3.right = new THREE.Vector3();
  transitLook.yaw = 0; transitLook.pitch = 0;
}

export const LANDED_PHASES = { LAND: 1, OPEN: 1, GREET: 1, DANCE: 1 };
export const FLOOR_Y = 0.35;      // camera FLOOR CLAMP — never dips below the ground plane at the surface
const isLanded = () => !!LANDED_PHASES[(getState() || {}).phase];

// ---- interactive camera (orbit + dolly + pan) -----------------------------------
// A hand-rolled orbit controller (NO vendored Three addon — the core module only).
// It orbits `target`, dollies via `dist`, and pans `target` with WASD/arrows. It is
// SEEDED from the flight machine's front-on landed pose (seedOrbitFromPose) and only
// DRIVES the camera while we're parked (landed); auto-flight owns the camera in
// transit. Input handlers below mutate this object.
export const orbit = {
  target: null,                   // THREE.Vector3, set on start()
  dist: 10, minDist: 5.0, maxDist: 60,   // minDist raised (was 2.2/3.6) so nothing zooms in past a whole-body view
  yaw: 0, pitch: 0.18, fov: 58,
  minPitch: -1.35, maxPitch: 1.45,
};

// ---- TRANSIT FREE-LOOK ----------------------------------------------------------
// In transit the auto-flight owns WHERE the camera flies (the continuous star-map
// descent), but the user must still be able to LOOK AROUND — turn their head to see
// space + the planets they pass, never a locked-forward camera. A drag adds a yaw/
// pitch LOOK OFFSET that rotates the view direction about the flying eye WITHOUT
// fighting the path; it eases gently back to the flight's framing when released (a
// right-stick feel), and is zeroed on land/depart so the landed framing is clean.
export const transitLook = { yaw: 0, pitch: 0 };   // PERSISTS while flying (no auto-recenter); reset on land/depart
const _tv3 = { a: null, b: null, up: null, right: null };   // reused THREE.Vector3 scratch (set on start)
export function resetTransitLook() { transitLook.yaw = 0; transitLook.pitch = 0; }

// SMOOTH transit camera: a damped follow of the flight pose (kills per-frame jitter and
// makes lift-off / descent an eased glide rather than a snap). Landed uses orbit directly.
const camFollow = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, fov: 60, init: false };
let _wasTransit = false;     // edge-detect entering transit (seed the follow from the live camera)
// markFollowStale() — parked: the orbit/auto-cam owns the camera, so the NEXT lift-off
// must re-seed its glide from wherever the landed camera ended up.
export function markFollowStale() { camFollow.init = false; }

// ---- MUSIC-VIDEO auto-camera (landed) -------------------------------------------
// Once landed, an automatic cinematic camera slowly orbits/dollies and CUTS between
// band aliens + wide city shots, on the beat — a little music video of the song.
// Manual drag/pinch/WASD OVERRIDES it (noteInput() stamps _lastInputT) and the auto
// camera RESUMES after AUTO_IDLE seconds of no input. It drives the SAME orbit object
// so applyOrbitToCamera renders it; a CUT snaps orbit to a new shot, and between cuts
// it drifts (slow orbit) + bobs on the beat. All time comes from dt (deterministic).
export const autoCam = { active: false, shot: 0, shotT: 0, cuts: 0, forceCut: true, onDrummer: false, drummerShot: -1 };
// ESTABLISH EASE — on touchdown the landed camera used to SNAP to the front establishing
// wide shot (a hard cut from the descent pose = the "lurch/cut" at landing). Instead we
// SEED the orbit from the live descent pose (continuous — the camera stays exactly where
// the flight left it) and critically-EASE it into that establishing shot over ESTAB_DUR
// seconds; runAutoCam (roam + beat cuts) takes over once the ease completes. Deterministic.
const establish = { active: false, t: 0 };
const ESTAB_DUR = 0.75;
let autoShotList = [];            // per-land cinematic shot list (band closeups + wides)
let _vclock = 0;                  // virtual clock (accumulated dt) — the auto-cam timebase
let _lastInputT = -1e9;           // last user-input virtual time (manual override window)
const AUTO_IDLE = 4.5;            // seconds of no input before the music-video auto-camera resumes
                                 // (raised from 2.5 so a manual look-around HOLDS — the user
                                 // should never feel the camera yanked back mid-look)
const CUT_BEATS = 8;              // cut roughly every 2 bars (musical, beat-synced)
export function noteInput() { _lastInputT = _vclock; }   // called by every manual nav handler
// tick(dt) — advance the deterministic auto-cam timebase and hand it back (the sun
// shader + the sweeping stage spots share this one clock).
export function tick(dt) { _vclock += (dt > 0 ? dt : 0); return _vclock; }
export function vclock() { return _vclock; }
export function userActive() { return (_vclock - _lastInputT) < AUTO_IDLE; }
export function autoShots() { return autoShotList; }

const keysDown = Object.create(null);   // pressed movement keys
// pointer/touch drag bookkeeping.
let dragging = false, lastPX = 0, lastPY = 0;
let pinchDist = 0;                // last two-finger distance (touch dolly)
let boundCanvas = null;           // the display canvas the pointer handlers are on

// ---- input wiring (mouse + touch + keys) ----------------------------------------
// Attached to the display canvas so nav works without breaking the app's global
// iOS multi-touch preventDefault (that guard only fires for touches.length>1; here
// we preventDefault our OWN single-touch drag + wheel dolly on the overlay). Escape
// + movement keys are on window (removed on stop).
export function bindInput(canvas) {
  const c = boundCanvas = canvas;
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
export function unbindInput() {
  const c = boundCanvas;
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
  boundCanvas = null;
}

// -- orbit math -------------------------------------------------------------------
const ORBIT_SPEED = 0.0055;       // radians per pixel dragged
function orbitBy(dx, dy) {
  // TRANSIT: a drag turns the head (look-offset) instead of orbiting the band — the
  // auto-flight still flies the path, but the user can look around space freely.
  if (!isLanded()) {
    transitLook.yaw = Math.max(-2.4, Math.min(2.4, transitLook.yaw - dx * ORBIT_SPEED));
    transitLook.pitch = Math.max(-1.15, Math.min(1.15, transitLook.pitch - dy * ORBIT_SPEED));
    noteInput();
    return;
  }
  orbit.yaw -= dx * ORBIT_SPEED;
  orbit.pitch = Math.max(orbit.minPitch, Math.min(orbit.maxPitch, orbit.pitch - dy * ORBIT_SPEED));
  noteInput();                         // manual override suspends the music-video auto-cam
}
function dollyBy(factor) {
  orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist * factor));
  noteInput();
}
// drag(dx,dy) — the headless nav proof: dispatch a synthetic drag (and, when parked,
// apply it to the camera immediately so the probe can read the moved view).
export function drag(dx, dy) {
  orbitBy(dx || 0, dy || 0);
  if (isLanded()) applyOrbitToCamera();
  return { yaw: orbit.yaw, pitch: orbit.pitch };
}
// seed the orbit FRONT-CENTRED on the band the moment we land: target = the band
// centroid, camera placed in FRONT of the players (who face +Z / the camera) at a
// sensible distance framed to the crowd width, looking slightly down. This is the
// FIX for the user's "side profile / off to the left / zoomed out" landed view — the
// framing no longer leaks the drifted flight pose; it derives straight from the band.
function seedOrbitFrontOn() {
  if (!orbit.target) return;
  orbit.target.set(bandCentroid.x, bandCentroid.y, bandCentroid.z);
  const width = 1.5 * Math.max(1, getBand().length);  // arc spread ~ crowd size
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
  const camera = getCamera();
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
// establishing wide shot (autoShotList[0]), then hand off to the roaming auto-cam. One smooth
// pull-back reveal instead of a hard cut — the touchdown reads as an arrival, not a jump.
function runEstablish(dt) {
  const sh = autoShotList[0];
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
export function seedOrbitFromPose(p) {
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
export function applyOrbitToCamera() {
  const camera = getCamera();
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
export function applyTransitCamera(dt, p) {
  const camera = getCamera();
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
  const eyeY = Math.max(FLOOR_Y, camFollow.y);
  camera.position.set(camFollow.x, eyeY, camFollow.z);
  // FREE-LOOK: rotate the flight's look direction about the eye by the user's yaw/pitch
  // offset so they can turn their head in space. The offset PERSISTS where you leave it
  // (no auto-recenter — the old 3.5s snap-back read as "can't change my view"); it only
  // resets on depart/land so the next leg/landing starts clean. When the offset is ~0 this
  // is exactly the old lookAt.
  if (_tv3.a && (Math.abs(transitLook.yaw) > 1e-4 || Math.abs(transitLook.pitch) > 1e-4)) {
    const dir = _tv3.a.set(camFollow.lx - camFollow.x, camFollow.ly - eyeY, camFollow.lz - camFollow.z);
    dir.applyAxisAngle(_tv3.up.set(0, 1, 0), transitLook.yaw);
    const right = _tv3.right.crossVectors(dir, _tv3.up).normalize();
    if (right.lengthSq() > 1e-6) dir.applyAxisAngle(right, transitLook.pitch);
    const tgt = _tv3.b.set(camFollow.x + dir.x, eyeY + dir.y, camFollow.z + dir.z);
    camera.lookAt(tgt.x, tgt.y, tgt.z);
  } else {
    camera.lookAt(camFollow.lx, camFollow.ly, camFollow.lz);
  }
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
export function buildAutoShots() {
  const band = getBand();
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
  // a GENTLE front push (was a hard dolly that craters right up onto the band). Starts well
  // back and eases in only a little, so it never zooms past a whole-body framing.
  const through = { target: { x: bandCentroid.x, y: cy + 0.1, z: bandCentroid.z }, yaw: 0.0, pitch: 0.08, dist: Math.max(orbit.minDist + 5, 12.0), fov: 58, yawRate: 0.0, dolly: -0.25, kind: "through" };
  // FULL-FIGURE FRONT medium on each player — the camera used to zoom in tight on the
  // torso/face and CROP the (now bigger, horned/winged/tailed) creatures. It now sits far
  // enough back to hold the WHOLE alien in frame (feet -> horns/crest), from a near-front
  // angle (small yaw) so you read the body, not a limb close-up. Target = the body's
  // vertical centre; a gentle downward tilt keeps it looking at the alien, not the floor.
  const closeups = band.map((a, i) => {
    const bp = (a.stage || a.group).position;
    return { target: { x: bp.x, y: 1.2, z: bp.z }, yaw: (i % 2 ? 0.14 : -0.14), pitch: 0.11, dist: 11.0, fov: 46, yawRate: (i % 2 ? 1 : -1) * 0.04, kind: "closeup" };
  });
  // the DRUMMER shot — a dedicated medium of the drums player (the auto-cam ALWAYS cuts
  // here on a fill). Framed on the kit/torso from slightly ABOVE, never a floor-up angle.
  const drummer = band.find((a) => a._voice === "drums") || band.find((a) => a._role === "drum");
  autoCam.drummerShot = -1;
  // interleave: front-wide, closeup, side-wide, flyover, closeup, through, ...
  autoShotList = [wides[0]];
  let wi = 1, ci = 0;
  const extras = [flyover, through];
  let ei = 0;
  while (ci < closeups.length || wi < wides.length || ei < extras.length) {
    if (ci < closeups.length) autoShotList.push(closeups[ci++]);
    if (wi < wides.length) autoShotList.push(wides[wi++]);
    if (ei < extras.length && (ci & 1)) autoShotList.push(extras[ei++]);
  }
  while (ei < extras.length) autoShotList.push(extras[ei++]);
  if (drummer) {
    const bp = (drummer.stage || drummer.group).position;
    autoCam.drummerShot = autoShotList.length;
    autoShotList.push({ target: { x: bp.x, y: 1.2, z: bp.z }, yaw: 0.14, pitch: 0.11, dist: 10.5, fov: 46, yawRate: -0.03, kind: "drummer" });
  }
  // FROM-BELOW GUARD (Fix 3): keep every shot's camera AT or ABOVE the band's eye level so
  // no shot ever looks UP from the floor (which framed mostly ground). For each shot the
  // resolved eye height is target.y + dist*sin(pitch); if that would sit below the band eye
  // level we RAISE the pitch to the minimum that lands it exactly at eye level. Deterministic;
  // preserves the flyover (high) + through-city (eye-level push) characters, only lifting the
  // up-from-the-floor angles. Mirrors applyOrbitToCamera's dist clamp so the check is exact.
  const eyeY = bandCentroid.y;
  for (const sh of autoShotList) {
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
  if (!autoShotList.length) buildAutoShots();
  if (!autoShotList.length) return;
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
      applyShot(autoShotList[autoCam.shot]);
    }
    autoCam.onDrummer = true;
    autoCam.forceCut = false;
  } else if (autoCam.forceCut || autoCam.shotT >= shotDur) {
    if (!autoCam.forceCut) {
      // advance to the next shot, but SKIP the dedicated drummer shot in the normal
      // rotation (it is reserved for fills) so the drummer read stays meaningful.
      do { autoCam.shot = (autoCam.shot + 1) % autoShotList.length; }
      while (autoShotList.length > 1 && autoCam.shot === autoCam.drummerShot);
      autoCam.cuts++;
    }
    autoCam.forceCut = false; autoCam.shotT = 0;
    autoCam.onDrummer = false;
    applyShot(autoShotList[autoCam.shot]);
  } else {
    autoCam.onDrummer = (autoCam.shot === autoCam.drummerShot);
    // SMOOTH eased motion between cuts — a slow orbit drift + an optional dolly for the
    // through-the-city shot. NO beat bob (that was the jitter the brief called out).
    orbit.yaw += (autoCam._yawRate || 0) * dt;
    if (autoCam._dolly) orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist + autoCam._dolly * dt));
  }
}
// landedFrame(dt, st, fresh) — the whole PARKED camera frame. `fresh` is the touchdown
// edge: (re)build the cinematic shot list, SEED the orbit from the LIVE descent pose
// (continuous — no snap) and EASE into the establishing wide instead of hard-cutting to
// it (the fix for the touchdown lurch: galaxy->surface descent flows straight into the
// landed framing as one continuous move). Then: manual input overrides everything, else
// the arrival ease runs to completion, else the music-video auto-camera drives.
export function landedFrame(dt, st, fresh) {
  if (fresh) {
    buildAutoShots();
    seedOrbitFromLiveCamera();
    transitLook.yaw = 0; transitLook.pitch = 0;   // clear any in-flight look so the landed framing is clean
    establish.active = true; establish.t = 0;
    autoCam.shot = 0; autoCam.shotT = 0; autoCam.cuts = 0; autoCam.forceCut = false; autoCam.active = false;
    _lastInputT = -1e9;                 // a fresh land starts in auto-camera (no stale input)
  }
  if (userActive()) {
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
  if (e.key === "Escape") { e.preventDefault(); onEscape(); return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (NAV_KEYS[k]) { keysDown[k] = true; e.preventDefault(); }
}
function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (NAV_KEYS[k]) { keysDown[k] = false; e.preventDefault(); }
}

// resetCamera() — stop(): drop the shot list, the auto-cam/establish state, the transit
// follow and the virtual clock so the next start() begins from a clean rig.
export function resetCamera() {
  autoShotList = []; autoCam.active = false; autoCam.shot = 0; autoCam.shotT = 0; autoCam.cuts = 0; autoCam.forceCut = true;
  autoCam.onDrummer = false; autoCam.drummerShot = -1;
  establish.active = false; establish.t = 0;
  camFollow.init = false; _wasTransit = false;
  _vclock = 0; _lastInputT = -1e9;
}
