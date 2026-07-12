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

// ---- the GENRE STAR-MAP frame ---------------------------------------------------
// worldOfCoord projects a genre's 3D feature coord (extent +/-100) into world space:
// the map floats high ABOVE the surface scene (which lives at the origin) so "up in
// space" among the planets never collides with the landed close-up. The controller
// imports the SAME projection to place the planet markers, so camera + planets agree.
export const FIELD = { scale: 0.55, ox: 0, oy: 150, oz: 0 };
export function worldOfCoord(c) {
  return { x: (c[0] || 0) * FIELD.scale + FIELD.ox,
    y: (c[1] || 0) * FIELD.scale + FIELD.oy,
    z: (c[2] || 0) * FIELD.scale + FIELD.oz };
}
// planetWorlds(): every genre's planet world-position (the controller builds the
// instanced star-map field from this — one planet per genre AT its GENRE_COORDS).
export function planetWorlds() {
  return Object.keys(GENRE_COORDS).map((g) => {
    const w = worldOfCoord(GENRE_COORDS[g]);
    return { g, x: w.x, y: w.y, z: w.z };
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
      if (nearness >= LAND_W && dominant) {
        landedGenre = dominant;           // land is ALWAYS at a real dominant genre
        setPhase("LAND");
      } else if (nearness < APPROACH_W) {
        setPhase("FLY");                  // blend reversed before we arrived
      }
    }

    // ---- landProgress: 0 cruising .. 0.8 touchdown .. 1 full immersion ------
    let target;
    if (LANDED[phase]) target = Math.max(0.8, imm);
    else if (phase === "DEPART") target = 0;
    else target = Math.min(0.8, imm);      // FLY/APPROACH ride the dominant weight
    landProgress += (target - landProgress) * Math.min(1, dt * 3);
    const t = clamp01(landProgress / 0.8);     // 0 deep space .. 1 at touchdown
    const fullZoom = clamp01((landProgress - 0.8) / 0.2);   // 0 just-landed .. 1 full

    // ---- spaceProgress: 0 on the surface .. 1 in deep space ----------------
    let sTarget;
    if (LANDED[phase]) sTarget = 0;
    else if (phase === "DEPART") sTarget = clamp01(phaseT / Math.max(0.001, DUR.DEPART));
    else sTarget = clamp01(1 - imm / 0.8);   // FLY/APPROACH: deep -> surface as we zoom
    spaceProgress += (sTarget - spaceProgress) * Math.min(1, dt * 2.2);

    // ---- WHERE WE ARE in the genre map + the resolving planet --------------
    const centroidCoord = centroidCoordOf(weights, dominant);
    const planetGenre = dominant || landedGenre || seenDominant || FALLBACK_GENRE;
    const planetCoord = (GENRE_COORDS[planetGenre] || centroidCoord).slice
      ? (GENRE_COORDS[planetGenre] || centroidCoord)
      : centroidCoord;
    const hereWorld = worldOfCoord(centroidCoord);
    const planetWorld = worldOfCoord(planetCoord);

    // ---- cameraPose --------------------------------------------------------
    // TRANSIT (not landed): the long zoom through the star map. We sit BEHIND the
    // resolving planet along the here->planet line and dolly IN as the dominant
    // weight climbs; the look target eases from the field centroid onto the planet.
    // As the blend PANS, here/planet move and the camera pans across the map.
    // LANDED: the origin-frame surface pose (also the SEED the controller's orbit /
    // music-video camera takes over from).
    let cameraPose;
    if (!LANDED[phase]) {
      let dx = planetWorld.x - hereWorld.x, dy = planetWorld.y - hereWorld.y, dz = planetWorld.z - hereWorld.z;
      let L = Math.hypot(dx, dy, dz);
      if (L < 1e-3) { dx = 0; dy = 0; dz = 1; L = 1; }
      dx /= L; dy /= L; dz /= L;
      const back = lerp(78, 16, t);          // far (whole field) -> close (planet fills)
      const rise = lerp(26, 4, t);           // extra altitude in deep space
      const drift = Math.sin(beatPhase * Math.PI * 2) * 0.15;   // gentle life
      cameraPose = {
        position: { x: planetWorld.x - dx * back, y: planetWorld.y - dy * back + rise + drift, z: planetWorld.z - dz * back },
        lookAt: { x: lerp(hereWorld.x, planetWorld.x, t), y: lerp(hereWorld.y, planetWorld.y, t), z: lerp(hereWorld.z, planetWorld.z, t) },
        fov: lerp(70, 54, t),
      };
    } else {
      const camY = lerp(3.2, 1.5, fullZoom);
      const camZ = lerp(9.0, 4.4, fullZoom);
      const bobAmp = phase === "DANCE" ? 0.06 : 0.03;
      const bob = Math.sin(beatPhase * Math.PI * 2) * bobAmp;
      cameraPose = {
        position: { x: 0, y: camY + bob, z: camZ },
        lookAt: { x: 0, y: lerp(1.7, 1.1, fullZoom), z: 0 },
        fov: lerp(60, 50, fullZoom),
      };
    }

    return {
      phase, dominant, weights, cameraPose, landProgress, spaceProgress, beatPhase,
      imm, dominantWeight: nearness, viewportFade: spaceProgress, fullZoom,
      landed: !!LANDED[phase], planetCoord, centroidCoord, planetWorld, hereWorld,
    };
  }

  return { update, events };
}

export default { makeFlight, FIELD, worldOfCoord, planetWorlds };
