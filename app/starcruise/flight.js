// flight.js — the STAR-CRUISE flight state machine (FIDELITY-DRIVEN camera).
//
// Follows the app's REAL travel path (getTravel -> weights/dominant) and the REAL
// audio beat (getBeat -> beatPhase), and drives the camera as ONE CONTINUOUS ZOOM
// through the GENRE STAR MAP: each genre owns a planet at its GENRE_COORDS (a 3D
// projection of the feature space — nearby == similar-sounding), and the camera's
// altitude / zoom is a smooth function of the DOMINANT genre's live blend WEIGHT.
//
//   mixed / low dominance  -> UP IN SPACE (viewport visible, planets seen from afar
//                             at their coords);
//   dominance rises        -> DESCEND / ZOOM toward that genre's planet, viewport
//                             FADES; LAND at weight >= 0.80; FULL immersion at ~1.0;
//   dominance drops        -> LIFT OFF, pull back to space heading toward the next
//                             planet (whose coord the blend is resolving toward).
//
// So flying == traversing the genre space: our position in the map is the WEIGHTED
// CENTROID of the blend's genre coords; the camera looks toward the dominant planet
// and dollies in as its weight climbs. This is a LONG zoom in/out + pan, not free
// flight and not a discrete phase timeline — though we keep phase LABELS (LAND/OPEN/
// GREET/DANCE/DEPART) so the cockpit fly-away choreography + ship ramp still fire.
//
// CONTRACT
//   makeFlight({ getTravel, getBeat }) -> { update(dt) -> STATE, events }
//     getTravel() -> { weights:[{g,w}], dominant, position:{x,y}|null, live }
//     getBeat()   -> { bpm, spb, cbeats, serial, beatPhase (0..1), playing }
//     update(dt)  -> { phase, dominant, weights, cameraPose, landProgress,
//                      spaceProgress, beatPhase, imm, dominantWeight, viewportFade,
//                      fullZoom, landed, planetCoord, centroidCoord,
//                      planetWorld, hereWorld }
//       phase: 'FLY'|'APPROACH'|'LAND'|'OPEN'|'GREET'|'DANCE'|'DEPART'
//     events.on('land'|'open'|'greet'|'depart'|'phase', cb)
//   Exports: makeFlight, FIELD, worldOfCoord(coord), planetWorlds()
//
// DETERMINISM: all time comes from the dt argument + the beatPhase input; there is
// NO performance.now()/Date.now()/Math.random inside. GENRE_COORDS is static data.
// Same (dt, travel, beat) stream in -> same STATE stream out.

import { GENRE_COORDS } from "./genre-coords.js";
import { GENRE_CLUSTERS } from "./genre-clusters.js";

// ---- the GENRE STAR-MAP frame ---------------------------------------------------
// worldOfCoord projects a genre's 3D feature coord (extent +/-100) into world space.
// SPREAD WAY OUT: the old scale (0.55) packed 250 planets + 31 suns into a +/-55 blob
// where suns (radius 4.5..11) OVERLAPPED — a pile of shapes, not a galaxy. We now blow
// the layout up ~6x (scale 3.5) so the closest two suns sit ~19 world units apart (well
// clear of their ~8-unit radii) with real EMPTY SPACE between systems. The whole map
// FLOATS high above the origin (oy 380) so its lowest planet (y~58) still clears the
// surface scene at the origin — the camera then flies one CONTINUOUS descent from the
// galaxy down to the ground (see the transit pose below). The controller imports the
// SAME projection to place the markers, so camera + planets + suns always agree.
export const FIELD = { scale: 3.5, ox: 0, oy: 380, oz: 0 };
const COORD_EXTENT = 100;                          // GENRE_COORDS half-extent (per header)
function fieldExtent() { return COORD_EXTENT * FIELD.scale; }   // world half-extent of the map
export function worldOfCoord(c) {
  return { x: (c[0] || 0) * FIELD.scale + FIELD.ox,
    y: (c[1] || 0) * FIELD.scale + FIELD.oy,
    z: (c[2] || 0) * FIELD.scale + FIELD.oz };
}
// SURFACE_POSE — the origin-frame establishing pose the transit descent RESOLVES TO at
// full touchdown (t=1). It is byte-identical to the LANDED pose at fullZoom=0 below, so
// the star-map->surface handoff is C0-continuous: no cut, no teleport between regions.
const SURFACE_POSE = { position: { x: 0, y: 3.2, z: 9.0 }, lookAt: { x: 0, y: 1.7, z: 0 }, fov: 60 };
// planetWorlds(): every genre's planet world-position (the controller builds the
// instanced star-map field from this — one planet per genre AT its GENRE_COORDS).
export function planetWorlds() {
  return Object.keys(GENRE_COORDS).map((g) => {
    const w = worldOfCoord(GENRE_COORDS[g]);
    return { g, x: w.x, y: w.y, z: w.z };
  });
}
// clusterWorlds(): every cluster's SUN world-position + colour + label (the controller
// builds the instanced SUN field from this — one glowing colored star per cluster AT
// its star coord). The two-level galaxy: suns == clusters, planets == genres near them.
export function clusterWorlds() {
  return (GENRE_CLUSTERS || []).map((c) => {
    const w = worldOfCoord(c.star || [0, 0, 0]);
    return { id: c.id, label: c.label, color: c.color || [1, 1, 1],
      x: w.x, y: w.y, z: w.z, members: (c.members || []).length };
  });
}
const FALLBACK_GENRE = Object.keys(GENRE_COORDS)[0] || "vaporwave";

function makeEvents() {
  const map = {};
  return {
    on(name, cb) { (map[name] || (map[name] = [])).push(cb); },
    emit(name, data) { (map[name] || []).forEach((cb) => { try { cb(data); } catch (e) {} }); },
  };
}

// nearness (0..1): how strongly ONE genre owns the current blend — the DOMINANT
// WEIGHT. ~1 => parked on a planet; ~0.5 => a 50/50 crossfade in transit. Pure
// function of the live weights (== S.weights, normalized so 3+ genre blends read low).
function nearnessOf(weights, dominant) {
  if (!weights || !weights.length) return dominant ? 1 : 0;
  let sum = 0, top = 0;
  for (const w of weights) { const v = (w && w.w) || 0; if (v > 0) { sum += v; if (v > top) top = v; } }
  return sum > 0 ? top / sum : (dominant ? 1 : 0);
}

// weighted centroid of the blend in COORD space — WHERE WE ARE in the genre map.
// Empty/absent blend -> the (fallback) dominant planet's coord.
function centroidCoordOf(weights, dominant) {
  let cx = 0, cy = 0, cz = 0, sw = 0;
  for (const w of (weights || [])) {
    const c = GENRE_COORDS[w && w.g]; const wt = (w && w.w) || 0;
    if (c && wt > 0) { cx += c[0] * wt; cy += c[1] * wt; cz += c[2] * wt; sw += wt; }
  }
  if (sw > 0) return [cx / sw, cy / sw, cz / sw];
  const c = GENRE_COORDS[dominant] || GENRE_COORDS[FALLBACK_GENRE];
  return c ? [c[0], c[1], c[2]] : [0, 0, 0];
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerp3(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) }; }
// rampAt — the linear DEAD-RECKONING sample: where along the from->to segment we are at
// elapsed `t` of an estimated `dur`. Clamped so it holds at `to` once the interval passes.
function rampAt(a, b, t, dur) { return lerp3(a, b, dur > 1e-4 ? clamp01(t / dur) : 1); }

// smoothDampS — a CRITICALLY-DAMPED scalar smoother (the classic Game-Programming-Gems
// SmoothDamp). It eases `cur` toward `target` carrying a velocity term, so a STEP in the
// target (which is exactly what the discrete ~8-bar blend clock delivers) produces a
// smooth S-curve whose velocity STARTS AT ZERO and ramps — NO instantaneous jump. This
// is the cure for the "lurch every 8 measures": a first-order lerp moves fastest the
// frame right after the step (the spike); this second-order spring never does. Frame-rate
// independent + deterministic (only dt). Returns [newValue, newVelocity].
function smoothDampS(cur, target, vel, smoothTime, dt) {
  if (smoothTime < 1e-4) smoothTime = 1e-4;
  dt = dt > 0 ? dt : 0;
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel + omega * change) * dt;
  const newVel = (vel - omega * temp) * exp;
  const out = target + (change + temp) * exp;
  return [out, newVel];
}
// smoothVec — smoothDampS applied per-axis to a {x,y,z,vx,vy,vz} spring state.
function smoothVec(s, target, smoothTime, dt) {
  let r;
  r = smoothDampS(s.x, target.x, s.vx, smoothTime, dt); s.x = r[0]; s.vx = r[1];
  r = smoothDampS(s.y, target.y, s.vy, smoothTime, dt); s.y = r[0]; s.vy = r[1];
  r = smoothDampS(s.z, target.z, s.vz, smoothTime, dt); s.z = r[0]; s.vz = r[1];
}

export function makeFlight({ getTravel, getBeat } = {}) {
  const events = makeEvents();

  // The landing choreography that ISN'T in the travel signal, in seconds (the ship
  // ramp + cockpit fly-away read these phase labels; the CAMERA is continuous).
  const DUR = { LAND: 0.8, OPEN: 1.0, GREET: 1.2, DEPART: 1.0 };
  // DOMINANT-WEIGHT thresholds along the blend that gate the zoom + land/depart.
  const SPACE_W = 0.45;      // at/below this dominance we're fully out in deep space
  const APPROACH_W = 0.58;   // a planet is resolving out of the crossfade -> descend
  const LAND_W = 0.80;       // one genre owns the blend -> TOUCH DOWN (land)
  const DEPART_W = 0.72;     // blend pulled back off the node while parked -> lift off
  const FULL_W = 1.0;        // full immersion (fully zoomed on the city + band)

  const LANDED = { LAND: 1, OPEN: 1, GREET: 1, DANCE: 1 };  // "parked" phases

  // immersion 0..1 from the dominant weight: 0 = deep space, 0.8 = touchdown, 1.0 =
  // fully immersed. A single continuous ramp (space -> approach -> land -> full).
  function immFromWeight(w) {
    if (w <= SPACE_W) return 0;
    if (w >= LAND_W) return 0.8 + 0.2 * clamp01((w - LAND_W) / (FULL_W - LAND_W));
    return 0.8 * ((w - SPACE_W) / (LAND_W - SPACE_W));
  }

  let phase = "FLY";
  let phaseT = 0;
  let landProgress = 0;
  let spaceProgress = 1;     // 0 on the ground .. 1 out in deep space
  let landedGenre = null;    // the dominant we committed to when we last touched down
  let seenDominant = null;   // last non-null dominant we've observed
  let beatPhase = 0;
  // CRITICALLY-DAMPED descent scalars. landProgress/spaceProgress used to be first-order
  // lerps (`+= (target-cur)*k`), which front-load a STEP in the target — exactly what the
  // ~8-bar blend clock delivers — into a per-frame velocity SPIKE on the boundary frame
  // (the lurch). Driving them through smoothDampS carries velocity across each step: a
  // weight jump nudges the goal and the descent GLIDES, ramping from the current velocity,
  // never jumping. Deterministic (only dt); no overshoot for a monotone target.
  let landVel = 0, spaceVel = 0;
  const LAND_SMOOTH = 0.38, SPACE_SMOOTH = 0.5;   // spring time-constants (s) — legacy, kept for state parity
  // DEAD-RECKONED ZOOM (the fix for the per-bar DESCENT lurch). smoothDampS on landProgress/
  // spaceProgress still front-loaded each per-bar STEP of the target into an early-frame
  // velocity SPIKE (measured ~6x the mean, ~0.35s into every bar) — and since the zoom drives
  // the camera across the WHOLE galaxy->surface distance, that spike WAS the lurch. Instead we
  // dead-reckon the zoom exactly like the lateral pan: on each per-bar step of the target we
  // latch a LINEAR ramp from the value we're displaying now to the new target, spanning the
  // observed bar interval, so the zoom advances at ~constant velocity every frame and arrives
  // as the next update lands — a continuous descent, no spike. A held target completes the ramp
  // and comes to rest. Deterministic (only dt). scalarRamp() carries {from,to,t,dur,last}.
  const landRamp = { from: 0, to: 0, t: 0, dur: 1, last: 0, seeded: false };
  const spaceRamp = { from: 1, to: 1, t: 0, dur: 1, last: 1, seeded: false };
  function scalarRampValue(rs) { return rs.dur > 1e-4 ? rs.from + (rs.to - rs.from) * clamp01(rs.t / rs.dur) : rs.to; }
  function scalarRamp(rs, target, barDur, dt) {
    if (!rs.seeded) { rs.from = rs.to = rs.last = target; rs.t = 0; rs.dur = barDur; rs.seeded = true; }
    else if (Math.abs(target - rs.last) > 1e-4) {          // a discrete per-bar step landed
      rs.from = scalarRampValue(rs);                        // re-latch FROM where we ARE (carry motion)
      rs.to = target; rs.dur = barDur; rs.t = 0; rs.last = target;
    }
    rs.t += dt;
    return scalarRampValue(rs);
  }
  // LAND when the SMOOTHED descent (landProgress) has actually reached the surface — NOT
  // the instant the raw weight crosses LAND_W. This decouples the phase flip from the raw
  // blend clock: at the flip the camera's descent `t` is already ~1 (== SURFACE_POSE), so
  // the transit->landed handoff is continuous (no snap from a still-descending pose).
  const LAND_ZOOM = 0.795;
  const FLOOR = 0.35;        // camera floor clamp — the eye never dips below the ground

  // WHERE WE ARE (blend centroid) + the RESOLVING planet. The blend/centroid updates in
  // DISCRETE per-bar STEPS (app onBar), and a spring eased toward that STATIC between-bar
  // target CONVERGES then SITS STILL until the next step — so the camera waits ~a bar and
  // then lurches all at once (the reported "waits eight bars then moves all at once"). The
  // cure is DEAD RECKONING: on each discrete update we start a LINEAR RAMP from the value
  // we're currently displaying to the new target, spanning the OBSERVED update interval, so
  // the followed goal advances EVERY FRAME at ~constant velocity and arrives about when the
  // NEXT update lands — a continuous glide between systems, no wait-then-jump. When updates
  // STOP (a held/static blend) the ramp completes and the camera correctly comes to rest.
  // A LIGHT spring on top only rounds the ramp's corners at bar boundaries.
  let smHere = null, smPlanet = null;
  let rampFrom = null, rampTo = null, rampT = 0, rampDur = 0, lastHereKey = null;
  const CAM_SMOOTH = 0.14;   // LIGHT corner-smoothing spring (s) — rounds the ramp, doesn't drive it

  function setPhase(next) {
    if (next === phase) return;
    phase = next;
    phaseT = 0;
    events.emit("phase", next);
    if (next === "LAND") events.emit("land", { genre: landedGenre });
    else if (next === "OPEN") events.emit("open", { genre: landedGenre });
    else if (next === "GREET") events.emit("greet", { genre: landedGenre });
  }

  function beginDepart(to) {
    events.emit("depart", { from: landedGenre, to: to || null });
    landedGenre = null;
    setPhase("DEPART");
  }

  function update(dt) {
    dt = dt > 0 ? dt : 0;
    const tv = (getTravel && getTravel()) || { weights: [], dominant: null, position: null, live: false };
    const bt = (getBeat && getBeat()) || { bpm: 120, beatPhase: 0, playing: false };
    const weights = tv.weights || [];
    const dominant = tv.dominant || null;
    if (dominant) seenDominant = dominant;
    const nearness = nearnessOf(weights, dominant);   // the DOMINANT WEIGHT (0..1)
    const imm = immFromWeight(nearness);              // continuous zoom target
    beatPhase = bt.beatPhase || 0;

    phaseT += dt;

    // ---- transitions (land/depart events + phase LABELS) -------------------
    if (LANDED[phase]) {
      // Parked. Leave when a DIFFERENT dominant resolves, or dominance slips below
      // DEPART_W (the user scrubbed / the blend moved on) -> LIFT OFF.
      const movedOn = dominant && landedGenre && dominant !== landedGenre;
      const slippedOff = nearness < DEPART_W;
      if (movedOn || slippedOff) {
        beginDepart(dominant && dominant !== landedGenre ? dominant : null);
      } else if (phase === "LAND" && phaseT >= DUR.LAND) {
        setPhase("OPEN");
      } else if (phase === "OPEN" && phaseT >= DUR.OPEN) {
        setPhase("GREET");
      } else if (phase === "GREET" && phaseT >= DUR.GREET) {
        setPhase("DANCE");
      }
      // DANCE holds until a depart trigger above.
    } else if (phase === "DEPART") {
      if (phaseT >= DUR.DEPART) setPhase("FLY");
    } else if (phase === "FLY") {
      if (nearness >= APPROACH_W && dominant) setPhase("APPROACH");
    } else if (phase === "APPROACH") {
      // TOUCH DOWN only once the SMOOTHED descent has arrived at the surface (landProgress
      // ~ 0.8 == transit `t` ~ 1 == SURFACE_POSE). The raw weight is already >= LAND_W by
      // then (landProgress can only reach 0.8 when imm reaches 0.8, i.e. nearness >= LAND_W);
      // waiting for the smoothed scalar guarantees the camera is AT the surface at the flip,
      // so the controller's landed camera picks up exactly where the descent left off.
      if (landProgress >= LAND_ZOOM && nearness >= LAND_W && dominant) {
        landedGenre = dominant;           // land is ALWAYS at a real dominant genre
        setPhase("LAND");
      } else if (nearness < APPROACH_W) {
        setPhase("FLY");                  // blend reversed before we arrived
      }
    }

    // BAR INTERVAL (the app steps travel + S.weights ONCE PER BAR): dead-reckon every
    // per-bar-stepping signal over exactly this span so each arrives as the next update
    // lands — constant velocity, no boundary spike. Clamped so a degenerate beat can't
    // wedge a ramp permanently on/off. Computed here (before the zoom) since the zoom ramps
    // read it too; the lateral-pan ramp below reuses the same value.
    const spb = bt.spb || (bt.bpm ? 60 / bt.bpm : 0.5);
    const cbeats = bt.cbeats || 8;
    let barDur = spb > 0 && cbeats > 0 ? spb * cbeats : 2;
    if (barDur < 0.4) barDur = 0.4; else if (barDur > 3.2) barDur = 3.2;

    // ---- landProgress: 0 cruising .. 0.8 touchdown .. 1 full immersion ------
    let target;
    if (LANDED[phase]) target = Math.max(0.8, imm);
    else if (phase === "DEPART") target = 0;
    else target = Math.min(0.8, imm);      // FLY/APPROACH ride the dominant weight
    // DEAD-RECKONED (was smoothDampS, which spiked): the descent glides at constant velocity
    // between per-bar steps, so the galaxy->surface zoom no longer lurches once a bar.
    landProgress = clamp01(scalarRamp(landRamp, target, barDur, dt));
    const t = clamp01(landProgress / 0.8);     // 0 deep space .. 1 at touchdown
    const fullZoom = clamp01((landProgress - 0.8) / 0.2);   // 0 just-landed .. 1 full

    // ---- spaceProgress: 0 on the surface .. 1 in deep space ----------------
    let sTarget;
    if (LANDED[phase]) sTarget = 0;
    else if (phase === "DEPART") sTarget = clamp01(phaseT / Math.max(0.001, DUR.DEPART));
    else sTarget = clamp01(1 - imm / 0.8);   // FLY/APPROACH: deep -> surface as we zoom
    // DEPART sweeps sTarget CONTINUOUSLY off phaseT already, so ramp it fast there (a short
    // dur tracks the phase clock); otherwise dead-reckon over the bar like the descent.
    spaceProgress = clamp01(scalarRamp(spaceRamp, sTarget, phase === "DEPART" ? 0.12 : barDur, dt));

    // ---- WHERE WE ARE in the genre map + the resolving planet --------------
    const centroidCoord = centroidCoordOf(weights, dominant);
    const planetGenre = dominant || landedGenre || seenDominant || FALLBACK_GENRE;
    const planetCoord = (GENRE_COORDS[planetGenre] || centroidCoord).slice
      ? (GENRE_COORDS[planetGenre] || centroidCoord)
      : centroidCoord;
    const hereWorld = worldOfCoord(centroidCoord);
    const planetWorld = worldOfCoord(planetCoord);
    // DEAD-RECKON "where we are" so the followed target advances EVERY FRAME (not just when
    // the discrete blend steps). The app advances travel + re-targets S.weights ONCE PER BAR
    // (app/live.js onBar -> travelStep), so the update interval IS one bar: barDur = sec/beat
    // * beats. On each discrete centroid change we latch a fresh LINEAR ramp from the value
    // we're displaying NOW to the new target, spanning barDur, so the goal glides at ~constant
    // velocity and reaches the new centroid just as the NEXT per-bar update lands — a seamless
    // cruise, no wait-then-jump. A HELD blend gets no new latch, so the ramp completes within
    // barDur and the camera correctly COMES TO REST (a parked, unchanging blend is still). We
    // clamp barDur so a missing/degenerate beat can't wedge the ramp permanently on or off.
    // (barDur is computed once, above, before the zoom ramps — reused here for the pan.)
    const hereKey = hereWorld.x + "," + hereWorld.y + "," + hereWorld.z;
    if (rampTo === null) {                     // first frame — seed at the live value (no pop)
      rampFrom = { x: hereWorld.x, y: hereWorld.y, z: hereWorld.z };
      rampTo = { x: hereWorld.x, y: hereWorld.y, z: hereWorld.z };
      rampDur = barDur; lastHereKey = hereKey; rampT = 0;
    } else if (hereKey !== lastHereKey) {       // a discrete update landed — re-latch the ramp
      rampFrom = rampAt(rampFrom, rampTo, rampT, rampDur);   // ramp FROM where we ARE (carry motion)
      rampTo = { x: hereWorld.x, y: hereWorld.y, z: hereWorld.z };
      rampDur = barDur; lastHereKey = hereKey; rampT = 0;
    }
    rampT += dt;
    const rampedHere = rampAt(rampFrom, rampTo, rampT, rampDur);
    // LIGHT spring on top of the ramp — rounds the piecewise-linear corner at each bar edge
    // (and gives the classic soft-start when a single isolated update follows a long rest),
    // but the RAMP (not a spring-to-a-static-target) is what carries the motion between bars.
    if (!smHere) smHere = { x: rampedHere.x, y: rampedHere.y, z: rampedHere.z, vx: 0, vy: 0, vz: 0 };
    else smoothVec(smHere, rampedHere, CAM_SMOOTH, dt);
    if (!smPlanet) smPlanet = { x: planetWorld.x, y: planetWorld.y, z: planetWorld.z, vx: 0, vy: 0, vz: 0 };
    else smoothVec(smPlanet, planetWorld, CAM_SMOOTH, dt);

    // ---- cameraPose --------------------------------------------------------
    // TRANSIT (not landed): the long zoom through the star map. We sit BEHIND the
    // resolving planet along the here->planet line and dolly IN as the dominant
    // weight climbs; the look target eases from the field centroid onto the planet.
    // As the blend PANS, here/planet move and the camera pans across the map.
    // LANDED: the origin-frame surface pose (also the SEED the controller's orbit /
    // music-video camera takes over from).
    let cameraPose;
    if (!LANDED[phase]) {
      // ONE CONTINUOUS DESCENT (the fix for the "landing is a teleport" break). The camera
      // is a single lerp in `t` (0 deep-space .. 1 touchdown) from a GALAXY VANTAGE — out
      // among the suns, high, looking at the resolving planet — DOWN to the ORIGIN SURFACE
      // pose. At t=1 it equals SURFACE_POSE == the landed pose at fullZoom 0, so the
      // star-map region and the surface region are ONE uninterrupted zoom: as the dominant
      // weight climbs the camera flies to the planet and descends (Google-Maps style) to
      // the band; as it falls, `t` drops and the camera LIFTS back out to the galaxy. No
      // cut, no region jump. Built from the SMOOTHED planet target so it never lurches.
      // AIM AT THE CONTINUOUS BLEND, not the discrete dominant. The vantage + look anchor
      // is the weight-weighted centroid of ALL active genres' planet positions (smHere),
      // spring-smoothed — so as the blend PANS across the map the camera glides with it and
      // NEVER lurches to a new far planet when the discrete `dominant` flips at a bar edge.
      // (Using the dominant planet, smPlanet, made every dominant flip a re-aim.) As one
      // genre wins, the centroid converges onto its planet, so the descent still lands there.
      const pw = smHere;
      let hx = FIELD.ox - pw.x, hz = FIELD.oz - pw.z;    // aim the descent toward the origin
      let hl = Math.hypot(hx, hz); if (hl < 1e-3) { hx = 0; hz = 1; hl = 1; }
      hx /= hl; hz /= hl;
      const ext = fieldExtent();
      const gpos = { x: pw.x + hx * ext * 0.38, y: pw.y + ext * 0.18, z: pw.z + hz * ext * 0.38 };
      const glook = { x: pw.x, y: pw.y, z: pw.z };
      const _pos = lerp3(gpos, SURFACE_POSE.position, t);
      if (_pos.y < FLOOR) _pos.y = FLOOR;                // floor clamp — never below ground
      cameraPose = {
        position: _pos,
        lookAt: lerp3(glook, SURFACE_POSE.lookAt, t),
        fov: lerp(64, SURFACE_POSE.fov, t),
      };
    } else {
      const camY = lerp(3.2, 1.5, fullZoom);
      const camZ = lerp(9.0, 4.4, fullZoom);
      // SMOOTH: no beat bob on the landed establishing pose either (the music-video
      // auto-cam owns the landed camera and now moves on eased drifts, not beat bobs).
      cameraPose = {
        position: { x: 0, y: camY, z: camZ },
        lookAt: { x: 0, y: lerp(1.7, 1.1, fullZoom), z: 0 },
        fov: lerp(60, 50, fullZoom),
      };
    }

    return {
      phase, dominant, weights, cameraPose, landProgress, spaceProgress, beatPhase,
      imm, dominantWeight: nearness, viewportFade: spaceProgress, fullZoom,
      landed: !!LANDED[phase], planetCoord, centroidCoord, planetWorld, hereWorld,
      // hereSmoothed: the FOLLOWED "where we are" target the pose is built from — the
      // dead-reckoned + lightly-sprung centroid. This is what the fix makes advance EVERY
      // FRAME: its per-frame motion is a near-constant ramp during a cruise (no wait-then-
      // jump), whereas the old spring-to-a-static-target sat still for each bar's tail.
      hereSmoothed: smHere ? { x: smHere.x, y: smHere.y, z: smHere.z } : { x: hereWorld.x, y: hereWorld.y, z: hereWorld.z },
    };
  }

  return { update, events };
}

export default { makeFlight, FIELD, worldOfCoord, planetWorlds, clusterWorlds };
