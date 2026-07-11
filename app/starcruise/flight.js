// flight.js — the STAR-CRUISE flight state machine.
//
// Follows the app's REAL travel path (getTravel -> weights/dominant/position) and
// the REAL audio beat (getBeat -> bpm/beatPhase), and drives the cockpit camera +
// phase cycle. It emits the land/open/greet/depart transitions the controller uses
// to spawn/despawn the band + backdrop.
//
// CONTRACT
//   makeFlight({ getTravel, getBeat }) -> { update(dt) -> STATE, events }
//     getTravel() -> { weights:[{g,w}], dominant, position:{x,y}|null, live }
//     getBeat()   -> { bpm, spb, cbeats, serial, beatPhase (0..1), playing }
//     update(dt)  -> { phase, dominant, weights, cameraPose, landProgress, beatPhase }
//       phase: 'FLY'|'APPROACH'|'LAND'|'OPEN'|'GREET'|'DANCE'|'DEPART'
//     events.on('land'|'open'|'greet'|'depart'|'phase', cb)
//
// HOW IT FOLLOWS THE REAL PATH (not a timer):
//   The blend weights ARE the position along the path. In transit between two
//   planets the top weight is ~0.5 (a 50/50 blend); parked ON a planet the top
//   weight is ~1.0. So NEARNESS = topWeight/sum is a genuine "how close to the node
//   am I" signal straight from the app's live blend — no fork of the travel logic.
//     FLY      : nearness low  (cruising between planets)
//     APPROACH : nearness crosses APPROACH_T (a planet is resolving out of the blend)
//     LAND     : nearness >= LAND_T with a stable dominant -> we've arrived (emit land)
//   The post-landing beats (OPEN the ship, GREET, then DANCE) are NOT in the travel
//   signal, so they run as short timed choreography once landed. DEPART fires when a
//   NEW dominant genre resolves (or the blend pulls us back off the node) while
//   we're parked -> the controller despawns and we FLY to the next planet.
//
// DETERMINISM: all time comes from the dt argument and the beatPhase input; there
// is NO performance.now()/Date.now()/Math.random inside. Same (dt, travel, beat)
// stream in -> same STATE stream out.

function makeEvents() {
  const map = {};
  return {
    on(name, cb) { (map[name] || (map[name] = [])).push(cb); },
    emit(name, data) { (map[name] || []).forEach((cb) => { try { cb(data); } catch (e) {} }); },
  };
}

// nearness (0..1): how strongly ONE genre owns the current blend. ~1 => parked on a
// planet; ~0.5 => a 50/50 crossfade in transit. Pure function of the live weights.
function nearnessOf(weights, dominant) {
  if (!weights || !weights.length) return dominant ? 1 : 0;
  let sum = 0, top = 0;
  for (const w of weights) { const v = (w && w.w) || 0; if (v > 0) { sum += v; if (v > top) top = v; } }
  return sum > 0 ? top / sum : (dominant ? 1 : 0);
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function lerp(a, b, t) { return a + (b - a) * t; }

export function makeFlight({ getTravel, getBeat } = {}) {
  const events = makeEvents();

  // The landing choreography that ISN'T in the travel signal, in seconds.
  const DUR = { LAND: 0.8, OPEN: 1.0, GREET: 1.2, DEPART: 1.0 };
  // Nearness thresholds along the blend that gate FLY->APPROACH->LAND.
  const APPROACH_T = 0.60;   // a planet is resolving out of the crossfade
  const LAND_T = 0.88;       // one genre owns the blend -> touch down
  const DEPART_T = 0.55;     // blend pulled back off the node while parked -> leave

  const LANDED = { LAND: 1, OPEN: 1, GREET: 1, DANCE: 1 };  // "parked" phases

  let phase = "FLY";
  let phaseT = 0;
  let landProgress = 0;
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
    const nearness = nearnessOf(weights, dominant);
    beatPhase = bt.beatPhase || 0;

    phaseT += dt;

    // ---- transitions -------------------------------------------------------
    if (LANDED[phase]) {
      // Parked on a planet. Leave when a DIFFERENT dominant resolves, or the blend
      // pulls us back off the node (the user scrubbed / travel moved on).
      const movedOn = dominant && landedGenre && dominant !== landedGenre;
      const slippedOff = nearness < DEPART_T;
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
      if (nearness >= APPROACH_T && dominant) setPhase("APPROACH");
    } else if (phase === "APPROACH") {
      if (nearness >= LAND_T && dominant) {
        landedGenre = dominant;           // land is ALWAYS at a real dominant genre
        setPhase("LAND");
      } else if (nearness < APPROACH_T) {
        setPhase("FLY");                  // blend reversed before we arrived
      }
    }

    // ---- landProgress: 0 cruising .. 1 touched down ------------------------
    let target;
    if (LANDED[phase]) target = 1;
    else if (phase === "DEPART") target = 0;
    else if (phase === "APPROACH") target = 0.30 + 0.65 * clamp01((nearness - APPROACH_T) / (LAND_T - APPROACH_T));
    else target = 0.30 * clamp01(nearness / APPROACH_T);   // FLY
    landProgress += (target - landProgress) * Math.min(1, dt * 3);

    // ---- cockpit camera pose ----------------------------------------------
    // High and far while cruising; descends and eases toward the band as we land.
    // A tiny beat-synced bob (deterministic from beatPhase) once we're grooving.
    const lp = landProgress;
    const camY = lerp(6.0, 2.2, lp);
    const camZ = lerp(14.0, 6.5, lp);
    const bobAmp = phase === "DANCE" ? 0.06 : LANDED[phase] ? 0.03 : 0.0;
    const bob = Math.sin(beatPhase * Math.PI * 2) * bobAmp;
    const drift = tv.position ? (tv.position.x || 0) * 0.02 : 0;
    const cameraPose = {
      position: { x: drift, y: camY + bob, z: camZ },
      lookAt: { x: drift * 0.5, y: lerp(2.4, 1.0, lp), z: 0 },
      fov: lerp(66, 58, lp),
    };

    return { phase, dominant, weights, cameraPose, landProgress, beatPhase };
  }

  return { update, events };
}

export default { makeFlight };
