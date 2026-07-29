#!/usr/bin/env node
// test/unit/flight.test.js — pure-node proof for app/starcruise/flight.js.
//
// Drives makeFlight({getTravel,getBeat}) with a SCRIPTED fake travel + beat over
// simulated time and asserts the CONTRACT:
//   A. phases occur in order FLY->APPROACH->LAND->OPEN->GREET->DANCE for a landing;
//   B. LAND happens AT a real dominant genre (event + state carry that genre);
//   C. changing the dominant genre while parked fires DEPART, then a fresh
//      FLY->...->LAND cycle lands at the NEW genre;
//   D. beatPhase in the STATE tracks the beat the fake feeds in;
//   E. events (phase/land/open/greet/depart) fire;
//   F. DETERMINISM — replaying the identical (dt,travel,beat) script yields an
//      identical STATE stream.
//
//   node test/unit/flight.test.js        (from /home/ford/stellate — no WebGL needed)

// ESM (it dynamic-imports the app's ES modules) under a commonjs package, so the
// CJS builtins have to be recreated rather than assumed.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const path = require("path");

// ---- scripted fake world -------------------------------------------------------
// A mutable blend we steer by hand. nearness is what the flight machine reads out
// of the weights: a lone genre at w=1 => nearness 1 (parked); a 50/50 blend => 0.5.
function makeWorld() {
  const w = { dominant: null, nearness: 0, position: { x: 0, y: 0 } };
  return {
    w,
    // point the blend at ONE genre with a given nearness (top weight); the rest of
    // the mass is spread onto filler genres so sum-normalisation is realistic.
    aim(genre, nearness) { w.dominant = genre; w.nearness = nearness; },
    getTravel() {
      if (!w.dominant) return { weights: [], dominant: null, position: w.position, live: true };
      const top = w.nearness;
      const rest = Math.max(0, 1 - top);
      const weights = [{ g: w.dominant, w: top }];
      // ENOUGH FILLERS THAT THE AIMED GENRE IS ACTUALLY THE TOP WEIGHT. flight.js
      // reads nearness as nearnessOf() = max(w)/sum(w), so a single filler holding
      // the remainder BECOMES the top weight for any aim below 0.5 — aiming at 0.25
      // fed the machine 0.75 and the descent ran BACKWARDS as the script "approached"
      // (landProgress 0.686 falling to 0.518 while nearness rose 0.25 -> 0.60). That
      // is the fake world contradicting itself, not a flight bug. Splitting the
      // remainder across ceil(rest/top) fillers keeps every other weight strictly
      // under the aim, so nearnessOf returns the number this helper promises.
      if (rest > 1e-6) {
        const k = Math.max(1, Math.ceil(rest / Math.max(top, 1e-6)));
        for (let i = 0; i < k; i++) weights.push({ g: "__transit" + i + "__", w: rest / k });
      }
      return { weights, dominant: top >= 0.5 ? w.dominant : null, position: w.position, live: true };
    },
  };
}

// A steady beat clock advanced by the sim: beatPhase ramps 0..1 per beat.
function makeBeatClock(bpm) {
  const spb = 60 / bpm;
  let t = 0;
  return {
    advance(dt) { t += dt; },
    getBeat() {
      const beats = t / spb;
      return { bpm, spb, cbeats: 8, serial: Math.floor(beats / 8), beat: Math.floor(beats), beatPhase: beats - Math.floor(beats), playing: true };
    },
  };
}

// ---- run one scripted scenario, recording everything ---------------------------
async function runScenario(makeFlight) {
  const world = makeWorld();
  const beat = makeBeatClock(120);
  const fired = [];
  // wrap getBeat so we record the EXACT beatPhase handed to the flight each tick;
  // state.beatPhase must equal it (proves it tracks the same beat, no drift).
  const fedBeat = [];
  const getBeat = () => { const b = beat.getBeat(); fedBeat.push(b.beatPhase); return b; };
  const flight = makeFlight({ getTravel: world.getTravel, getBeat });
  for (const ev of ["phase", "land", "open", "greet", "depart"]) {
    flight.events.on(ev, (d) => fired.push({ ev, d }));
  }

  const DT = 0.1;
  const states = [];
  const step = () => {
    beat.advance(DT);
    const st = flight.update(DT);
    states.push(st);
    return st;
  };

  // SCRIPT (each tick = 0.1s):
  //  seconds  0 ..  2  cruise toward "techno" (nearness climbing 0 -> ~0.55): FLY
  //  seconds  2 ..  4  resolve techno out of the blend (0.6 -> 1.0): APPROACH->LAND
  //  seconds  4 .. 14  hold ON techno (nearness 1): LAND->OPEN->GREET->DANCE
  //  second  14        blend jumps toward "ambient": DEPART
  //  seconds 14 .. 30  cruise + resolve ambient: FLY->APPROACH->LAND->...->DANCE
  //
  // THE PARKED HOLD MUST OUTLAST THE CHOREOGRAPHY. flight.js walks the parked
  // phases on a clock — DUR.LAND 0.8 + DUR.OPEN 1.0 + DUR.GREET 1.2 = 3.0s of
  // dwell before DANCE — and LAND itself only fires once the SMOOTHED descent
  // (landProgress, a 0.38s spring) crosses LAND_ZOOM, which is a second or so
  // after the raw weight resolves. The original script parked for 4.0s, which
  // left under a second of margin and in practice departed during OPEN: the
  // proof failed on its own stopwatch, not on the phase machine. A real listener
  // parks on a genre for minutes, so the hold is 10s here — the contract under
  // test is the ORDER of the phases, and the script should not be the thing that
  // decides whether the last two are reached.
  for (let i = 0; i < 300; i++) {
    const sec = i * DT;
    if (sec < 2.0) world.aim("techno", 0.25 + (sec / 2.0) * 0.30);      // 0.25 -> 0.55
    else if (sec < 4.0) world.aim("techno", 0.60 + ((sec - 2.0) / 2.0) * 0.40); // 0.60 -> 1.0
    else if (sec < 14.0) world.aim("techno", 1.0);
    else if (sec < 16.0) world.aim("ambient", 0.60 + ((sec - 14.0) / 2.0) * 0.40); // resolve ambient
    else world.aim("ambient", 1.0);
    step();
  }
  return { states, fired, fedBeat };
}

(async () => {
  const { makeFlight } = await import(
    "file://" + path.join(__dirname, "..", "..", "app", "starcruise", "flight.js")
  );

  let fail = 0;
  const A = await runScenario(makeFlight);

  // ---- phase timeline ---------------------------------------------------------
  const phaseSeq = [];
  for (const st of A.states) if (phaseSeq[phaseSeq.length - 1] !== st.phase) phaseSeq.push(st.phase);
  console.log("=== PHASE TIMELINE ===");
  console.log("  " + phaseSeq.join(" -> "));

  // A. first landing cycle in order
  const wantFirst = ["FLY", "APPROACH", "LAND", "OPEN", "GREET", "DANCE"];
  const firstSix = phaseSeq.slice(0, 6);
  const orderOK = wantFirst.every((p, i) => firstSix[i] === p);
  console.log(`\n  ${orderOK ? "PASS" : "FAIL"}  first cycle is ${wantFirst.join("->")}`);
  if (!orderOK) fail++;

  // C. DEPART then a SECOND full landing cycle
  const departIdx = phaseSeq.indexOf("DEPART");
  const hasDepart = departIdx > 0;
  const tail = phaseSeq.slice(departIdx);
  const secondCycleOK = hasDepart &&
    ["DEPART", "FLY", "APPROACH", "LAND", "OPEN", "GREET", "DANCE"].every((p, i) => tail[i] === p);
  console.log(`  ${secondCycleOK ? "PASS" : "FAIL"}  DEPART then a full second cycle: ${tail.join("->")}`);
  if (!secondCycleOK) fail++;

  // ---- events -----------------------------------------------------------------
  const landEvents = A.fired.filter((f) => f.ev === "land");
  const departEvents = A.fired.filter((f) => f.ev === "depart");
  const openEvents = A.fired.filter((f) => f.ev === "open");
  const greetEvents = A.fired.filter((f) => f.ev === "greet");
  console.log("\n=== EVENTS ===");
  console.log(`  land x${landEvents.length}  open x${openEvents.length}  greet x${greetEvents.length}  depart x${departEvents.length}`);

  // B. land events carry a real dominant genre, in the right order
  const landGenres = landEvents.map((f) => f.d && f.d.genre);
  console.log("  land genres: " + JSON.stringify(landGenres));
  const landAtTechnoThenAmbient = landGenres[0] === "techno" && landGenres[1] === "ambient";
  console.log(`  ${landAtTechnoThenAmbient ? "PASS" : "FAIL"}  landed at techno, then at ambient`);
  if (!landAtTechnoThenAmbient) fail++;

  const departFromTechnoToAmbient = departEvents.length >= 1 &&
    departEvents[0].d && departEvents[0].d.from === "techno" && departEvents[0].d.to === "ambient";
  console.log(`  ${departFromTechnoToAmbient ? "PASS" : "FAIL"}  depart carried from:techno -> to:ambient`);
  if (!departFromTechnoToAmbient) fail++;

  // every LAND state carries a non-null dominant (land is AT a genre)
  const landStatesHaveDominant = A.states
    .filter((s) => s.phase === "LAND")
    .every((s) => !!s.dominant);
  console.log(`  ${landStatesHaveDominant ? "PASS" : "FAIL"}  every LAND state has a dominant genre`);
  if (!landStatesHaveDominant) fail++;

  const eventsFired = landEvents.length >= 2 && departEvents.length >= 1 && openEvents.length >= 2 && greetEvents.length >= 2;
  console.log(`  ${eventsFired ? "PASS" : "FAIL"}  land/open/greet/depart all fired (>=2 cycles)`);
  if (!eventsFired) fail++;

  // ---- D. beatPhase tracks the beat -------------------------------------------
  // state.beatPhase must equal the EXACT beatPhase the fake beat fed that tick.
  let terr = 0;
  for (let i = 0; i < A.states.length; i++) {
    terr = Math.max(terr, Math.abs(A.states[i].beatPhase - A.fedBeat[i]));
  }
  console.log("\n=== BEAT ===");
  const beatOK = terr < 1e-9;
  console.log(`  ${beatOK ? "PASS" : "FAIL"}  state.beatPhase matches the fed beat (max err ${terr.toExponential(2)})`);
  if (!beatOK) fail++;
  // beatPhase actually sweeps its full range (not stuck)
  const bpVals = A.states.map((s) => s.beatPhase);
  const bpSpan = Math.max(...bpVals) - Math.min(...bpVals);
  console.log(`  ${bpSpan > 0.9 ? "PASS" : "FAIL"}  beatPhase sweeps the full 0..1 (span ${bpSpan.toFixed(3)})`);
  if (bpSpan <= 0.9) fail++;

  // ---- landProgress + camera sanity -------------------------------------------
  const flyLP = A.states.find((s) => s.phase === "FLY").landProgress;
  const danceStates = A.states.filter((s) => s.phase === "DANCE");
  const danceLP = danceStates[danceStates.length - 1].landProgress;
  console.log("\n=== CAMERA / LAND PROGRESS ===");
  const lpOK = flyLP < 0.4 && danceLP > 0.9;
  console.log(`  ${lpOK ? "PASS" : "FAIL"}  landProgress low in FLY (${flyLP.toFixed(2)}) -> ~1 in DANCE (${danceLP.toFixed(2)})`);
  if (!lpOK) fail++;
  // CAMERA DESCENT — current model: there is NO 3D ship/cockpit; the CAMERA itself flies
  // one CONTINUOUS descent from the star-map down onto the band. So over a landing cycle the
  // flight pose must (1) end up much NEARER the band than it started (FLY z far -> DANCE z
  // near), (2) move CONTINUOUSLY — no per-tick jump/teleport/cut between regions — and (3)
  // carry a valid pose every tick.
  // Camera DISTANCE to the band (~origin) must shrink continuously. Raw z is no longer a
  // valid proxy: the landed music-video pose sits in FRONT of the band (+z) while the galaxy
  // vantage is nearer z=0, so z INVERTS — the real invariant is "gets much nearer, no teleport".
  const dist = (p) => Math.hypot(p.x, p.y, p.z);
  const flyCamD = dist(A.states.find((s) => s.phase === "FLY").cameraPose.position);
  const danceCamD = dist(danceStates[danceStates.length - 1].cameraPose.position);
  const firstDanceIdx = A.states.findIndex((s) => s.phase === "DANCE");
  let maxStep = 0;
  for (let i = 1; i <= firstDanceIdx; i++) {
    const a = A.states[i].cameraPose.position, b = A.states[i - 1].cameraPose.position;
    maxStep = Math.max(maxStep, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
  }
  const continuous = maxStep < 0.6 * flyCamD;   // no teleport/cut — one continuous descent
  const camOK = flyCamD > danceCamD + 2 && continuous &&
    A.states.every((s) => s.cameraPose && s.cameraPose.position && s.cameraPose.lookAt);
  console.log(`  ${camOK ? "PASS" : "FAIL"}  camera descends CONTINUOUSLY toward the band (dist ${flyCamD.toFixed(1)} -> ${danceCamD.toFixed(1)}, max step ${maxStep.toFixed(2)} < ${(0.6 * flyCamD).toFixed(0)})`);
  if (!camOK) fail++;

  // ---- F. DETERMINISM ---------------------------------------------------------
  const B = await runScenario(makeFlight);
  const sigA = JSON.stringify(A.states);
  const sigB = JSON.stringify(B.states);
  const evA = JSON.stringify(A.fired);
  const evB = JSON.stringify(B.fired);
  console.log("\n=== DETERMINISM ===");
  const detOK = sigA === sigB && evA === evB;
  console.log(`  ${detOK ? "PASS" : "FAIL"}  identical script -> identical state + event stream`);
  if (!detOK) fail++;

  console.log("\n" + (fail === 0 ? "ALL CHECKS PASSED" : `!!! ${fail} FAILURE(S)`));
  process.exit(fail === 0 ? 0 : 1);
})();
