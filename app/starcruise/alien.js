// alien.js — Build phase. ONE band-member alien (or a background DANCER) as a
// THREE.Object3D + an update(dt, ctx) that PLAYS THE SCORE. Each alien is a
// genuinely NON-HUMAN creature — a radial N-fold star, a cephalopod tentacle-
// cluster, an insectoid, an amorphous blob, a stalk-cluster, a crystalline stack
// or a floating-gas sac — with 0..N appendages, a wild FACE family (one giant
// eye / a ring of eyes / a maw / mandibles) and an INVENTED organic INSTRUMENT
// (pulsing membrane-sac, coiled resonator, crystal chime-cluster, tendril-harp,
// bladder-horn) — NOT a realistic drum/guitar. Everything is procedural +
// asset-free + low-poly + mobile-cheap (reused materials, capped tendril segs).
//
// The designated appendage PLAYS its voice's REAL NOTES: update(dt, ctx) triggers
// a strike/pluck/bow/blow CONTACT on each note ONSET in ctx.notes (syncopation
// shows — contacts land at the actual note times, not a uniform beat). When the
// voice is silent / quiet / faded (no notes, or level <= ~0.05, or playing false)
// the alien RESTS: it lowers the instrument, idles and sways, and does NOT
// fake-strike. Note pitch biases the contact position along the instrument.
//
// CONTRACT
//   makeAlien(THREE, traits, member, seed) -> { group, update(dt, ctx), ... }
//     traits = the TRAITS object from traits.js
//              traits.body may be the NEW plan shape
//                { plan, symmetry, arms, legs, tentacles, eyes, face:{...}, ... }
//              OR the older { massH,height,limbs,eyes,segments,bodyShape,... }
//              shape — this module resolves a body plan from EITHER (deterministic).
//     member = one entry of traits.band[]:
//              { role, voice, instrument:{ family, playStyle, appendage, hitsPerBeat } }
//              role may be 'drum'|'bass'|'lead'|'pad'|'melody'|'perc'|'found'|'dancer'.
//              role 'dancer' == NO instrument, a full-body creature that grooves.
//     seed   = integer; same inputs -> same alien
//   update(dt, ctx):
//     ctx (SCORE MODE) = {
//        barPhase : 0..1 position within the CURRENT bar,
//        playing  : bool  — is member.voice sounding this bar,
//        level    : 0..1  — this voice's dynamics (fade/section level),
//        notes    : [{ t (0..1 in bar), pitch, dur, vel }] — onsets for this voice,
//     }
//     ctx as a NUMBER (or null) == the OLD beat-only FALLBACK: it is a beatPhase
//     0..1 within a beat, and the appendage hits on the hitsPerBeat sub-grid — so
//     the controller's legacy `a.update(dt, beatPhase)` path still animates.
//   Return: { group, update, debug, materials, playStyle, hitsPerBeat, voice }.
//
//   debug() -> { playStyle, contactness, handTip, contact, target, dist, reachDist }
//     (alien-local) — headless proof of onset-timed contact vs rest.
//
// GEOMETRY: bodies + instruments are built from the shared hand-rolled geom.js
// library — SUPERQUADRIC superellipsoids (squareness fed from the genre vector),
// CatmullRom curve-swept TUBES for tentacles/horns/coils (posed by a deterministic
// FABRIK IK solver so many-jointed tentacles reach/curl smoothly), and the 'pbr'
// renderStyle routes surfaces to a real MeshStandardMaterial + the ONE shared env map.

import { superquadric, tube, fabrik, fuse, pbrMaterial } from "./geom.js";
// MARCHING CUBES — the alien's fused ORGANIC BODY CORE (metaball isosurface) is baked
// ONCE at makeAlien() time from this vendored three.js EXAMPLE class (r160). It imports
// from our vendored three CORE (./three.module.min.js), NOT a CDN, so it works offline.
// It is a *build-time* dependency only: we run marching cubes once to snapshot a static
// BufferGeometry and NEVER touch it again per frame. Imported here (module scope) so the
// class is resolved when alien.js loads — makeAlien is synchronous and needs it to bake
// the core before returning the posed rig.
import { MarchingCubes } from "../../vendor/three/MarchingCubes.js";

// ONE reused MarchingCubes instance per (THREE, resolution) — its big Float32Array field
// buffers are allocated once and wiped (reset) before each bake, so building a whole band
// of aliens does not thrash the allocator. Bakes are synchronous + non-reentrant, so a
// single shared grid is safe. Deterministic: marching cubes is pure float math.
let _mcShared = null, _mcRes = 0;
function sharedMarchingCubes(THREE, material, res) {
  if (!_mcShared || _mcRes !== res) {
    _mcShared = new MarchingCubes(res, material, false, false, 24000);
    _mcRes = res;
  }
  _mcShared.material = material;   // flatShading read only; we recompute normals after
  return _mcShared;
}
// Bake a set of metaballs into a STATIC fused BufferGeometry. `balls` are {x,y,z,r} in the
// alien's LOCAL space (r in local units); `center` is the field-cube centre. Marching cubes
// runs in a normalized [-1,1] cube; we map local->field, run once, then snapshot the used
// slice of the vertex buffer, rescale it back to local units and recompute smooth normals.
// The returned geometry is plain data (safe after the shared grid is reused/reset).
function bakeMetaballGeometry(THREE, balls, center, res) {
  const ISO = 80, SUBTRACT = 12;
  const mat = { flatShading: false };
  const mc = sharedMarchingCubes(THREE, mat, res);
  mc.isolation = ISO;
  mc.reset();
  // field half-extent: fit the farthest ball surface at ~0.8 of the half-cube (keeps the
  // surface off the outer layer, where marching-cube normals are undefined).
  let maxR = 1e-3;
  for (const b of balls) {
    const d = Math.hypot(b.x - center.x, b.y - center.y, b.z - center.z) + b.r;
    if (d > maxR) maxR = d;
  }
  const CE = maxR / 0.8;
  for (const b of balls) {
    const fx = 0.5 + 0.5 * ((b.x - center.x) / CE);
    const fy = 0.5 + 0.5 * ((b.y - center.y) / CE);
    const fz = 0.5 + 0.5 * ((b.z - center.z) / CE);
    const rf = 0.5 * (b.r / CE);                       // field-space surface radius
    const strength = Math.max(1e-3, rf * rf * (ISO + SUBTRACT));
    mc.addBall(fx, fy, fz, strength, SUBTRACT);
  }
  mc.update();
  const count = mc.count | 0;                          // vertex count
  if (count < 12) return null;                          // degenerate — caller falls back
  const src = mc.positionArray;
  const pos = new Float32Array(count * 3);
  // Keep the baked geometry CENTRED AT ORIGIN (map [-1,1] field -> local, minus centre) so
  // the mesh's own position places it and a breathing SCALE pulses it in place. The metaball
  // centres were mapped relative to `center`, so this recovers local-offset coords directly.
  for (let i = 0; i < count * 3; i++) pos[i] = src[i] * CE;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  geo.userData.mcVertexCount = count;
  return geo;
}

// tiny seeded PRNG so the alien is deterministic without importing traits.
function rng32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function colHSL(THREE, c) {
  const col = new THREE.Color();
  col.setHSL((((((c && c.h) || 0) % 360) + 360) % 360) / 360,
    c && c.s != null ? c.s : 0.5, c && c.l != null ? c.l : 0.5);
  return col;
}
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const smooth01 = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };

// A tiny, reused procedural skin texture keyed by traits.texture. 64x64, drawn on a
// CanvasTexture, tiled — cheap and shared across a single alien's body surfaces so
// forms aren't flat. Light base (keeps the alien bright) with a low-opacity motif.
// Deterministic: the only randomness (the 'static' motif) flows through `rand`.
function makeSkinTexture(THREE, kind, rand) {
  if (typeof document === "undefined" || !document.createElement) return null;
  const S = 64;
  const cv = document.createElement("canvas"); cv.width = cv.height = S;
  const g = cv.getContext("2d"); if (!g) return null;
  g.fillStyle = "#c9c9d2"; g.fillRect(0, 0, S, S);       // light base -> keeps colour bright
  const dk = "rgba(30,26,44,0.30)", lt = "rgba(255,255,255,0.22)";
  if (kind === "stripe") {
    g.fillStyle = dk; for (let x = 0; x < S; x += 12) g.fillRect(x, 0, 6, S);
  } else if (kind === "scale") {
    g.strokeStyle = dk; g.lineWidth = 2;
    for (let y = 0; y <= S; y += 12) for (let x = 0; x <= S; x += 14) {
      g.beginPath(); g.arc(x + (Math.floor(y / 12) % 2 ? 7 : 0), y, 7, 0, Math.PI); g.stroke();
    }
  } else if (kind === "spot") {
    g.fillStyle = dk;
    for (let y = 8; y < S; y += 16) for (let x = 8; x < S; x += 16) {
      g.beginPath(); g.arc(x + (Math.floor(y / 16) % 2 ? 8 : 0), y, 4, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === "gradient") {
    const grd = g.createLinearGradient(0, 0, 0, S);
    grd.addColorStop(0, lt); grd.addColorStop(1, dk);
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
  } else if (kind === "static") {
    for (let i = 0; i < 520; i++) {
      g.fillStyle = rand() < 0.5 ? dk : lt;
      g.fillRect((rand() * S) | 0, (rand() * S) | 0, 2, 2);
    }
  } else if (kind === "fur") {
    // FURRY: dense short directional strokes -> reads soft/fuzzy at a glance.
    g.lineWidth = 1;
    for (let i = 0; i < 340; i++) {
      const x = (rand() * S) | 0, y = (rand() * S) | 0, len = 3 + (rand() * 4 | 0);
      g.strokeStyle = rand() < 0.5 ? "rgba(30,26,44,0.22)" : "rgba(255,255,255,0.18)";
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() * 2 - 1) * 2, y - len); g.stroke();
    }
  } else if (kind === "rock") {
    // STONY: irregular dark cracks + light chips -> reads rough/mineral.
    g.strokeStyle = "rgba(20,18,30,0.34)"; g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      g.beginPath(); g.moveTo((rand() * S) | 0, (rand() * S) | 0);
      for (let k = 0; k < 3; k++) g.lineTo((rand() * S) | 0, (rand() * S) | 0);
      g.stroke();
    }
    for (let i = 0; i < 60; i++) { g.fillStyle = rand() < 0.5 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)"; g.fillRect((rand() * S) | 0, (rand() * S) | 0, 3, 3); }
  } else {                                                 // "plate": subtle panel lines
    g.strokeStyle = "rgba(30,26,44,0.16)"; g.lineWidth = 1;
    for (let x = 0; x < S; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
    for (let y = 0; y < S; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

export function makeAlien(THREE, traits, member, seed) {
  seed = (seed | 0) || 1;
  const rand = rng32(seed ^ 0xa53c9);

  // ---- PER-ALIEN morphology jitter (deterministic off THIS alien's OWN seed) ------
  // Two band members (or dancers) of the SAME genre share traits (the species
  // family) but must never be identical. These draws are consumed HERE — before any
  // dancer/player divergence — so a dancer & a player built from one seed stay
  // rand-aligned, yet every INDIVIDUAL nudges its PROPORTIONS, appendage/eye COUNTS,
  // orb count and accent hue so it reads unique — still inside the genre's family.
  const jSpan = (s) => 1 + (rand() * 2 - 1) * s;          // ~1 ± s multiplier
  const jPick = (p) => (rand() < p ? 1 : 0);              // deterministic 0/1 draw
  const morphH = jSpan(0.17), morphMass = jSpan(0.24), morphR = jSpan(0.12);
  const eyeJit = jPick(0.5) - jPick(0.35);                // -1..+1 eye-count nudge
  const armJit = jPick(0.45);                             // +0/+1 extra arm
  const appJit = jPick(0.5) - jPick(0.4);                 // -1..+1 legs/tentacles
  const accentSpin = (rand() * 2 - 1) * 22;               // per-alien accent hue shift °
  const orbJit = jPick(0.6) + jPick(0.35);                // +0..2 extra light-balls
  // PER-ALIEN COLOUR/OUTFIT — off THIS alien's OWN seed so two band members (or two
  // dancers) of ONE genre read as individually distinguishable creatures, not a blur.
  // The genre base palette is rotated/shifted (hue/sat/value) per alien and some wear
  // an accent SASH — still inside the species' colour family (the shifts are bounded).
  const hueSpin = (rand() * 2 - 1) * 44;                  // per-alien BODY hue rotation °
  const valSpin = (rand() * 2 - 1) * 0.14;               // per-alien lightness shift
  const satSpin = (rand() * 2 - 1) * 0.12;               // per-alien saturation shift
  const wearsSash = jPick(0.5);                           // 0/1 an accent band/sash marking
  // PER-DANCER groove individuality (own phase + tempo + style) so dancers DESYNC by
  // default and SYNC only when the mix is loud. Drawn for every alien to keep the
  // per-alien rand stream aligned between a dancer & a player built from one seed.
  const dancePhase0 = rand() * 6.2831853;                // own starting phase (desync seed)
  const danceRate = 1.35 + rand() * 1.15;                // own groove tempo
  const danceStyle = jPick(0.5);                          // style variant 0/1

  traits = traits || {};
  member = member || { role: "perc", voice: "perc", instrument: { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 1 } };
  const roleName = member.role || "perc";
  const isDancer = roleName === "dancer";
  const inst = member.instrument || { family: "clackshell", playStyle: "strike", appendage: 0, hitsPerBeat: 1 };
  const playStyle = isDancer ? "dance" : (inst.playStyle || "strike");
  const hitsPerBeat = Math.max(1, Math.round(inst.hitsPerBeat || 1));
  // voice id this alien "is in charge of" (drums/bass/lead/pad/melody/perc/found).
  // Prefer an explicit member.voice; else map the role to the engine voice family.
  const ROLE_VOICE = { drum: "drums", bass: "bass", lead: "lead", pad: "pad", melody: "melody", perc: "perc", found: "found" };
  const voice = member.voice || ROLE_VOICE[roleName] || roleName;
  // how much this alien "sings" — the mouth gapes widest for the lead vocalist.
  const sing = roleName === "lead" || roleName === "melody" ? 1.0 : isDancer ? 0.6 : roleName === "pad" ? 0.5 : 0.35;
  // sustained voices HOLD contact across a note (bow/blow/pad); impulse voices
  // strike a momentary contact then recoil (strike/drum/pluck).
  const sustained = playStyle === "bow" || playStyle === "blow";
  // DRUMMER: the kit player — its strike is tuned to be genuinely fast (short approach,
  // big windup) so the arm visibly snaps onto the drum at the note's real onset speed.
  const isDrummer = (playStyle === "drum" || playStyle === "strike") && roleName === "drum";

  const pal = traits.palette || {};
  const bIn = traits.body || {};
  const groove = Object.assign({ bounce: 0.4, sway: 0.3, headbob: 0.4, energy: 0.5 }, traits.groove || {});
  const glow = clamp(traits.glow || 0, 0, 1);
  const chrome = traits.skin === "chrome";
  // SURFACE flavor (Complaint 3): fur / soft / wax / stone / chrome / glass / plastic.
  // Prefer traits.surface (new), else traits.body.surface, else fall back off skin so an
  // older traits object still resolves a sensible surface.
  const surface = traits.surface || bIn.surface ||
    (chrome ? "chrome" : traits.skin === "glass" ? "glass" : traits.skin === "organic" ? "soft" : "plastic");

  // ---- PER-ALIEN FACE PERSONALITY -------------------------------------------------
  // Every face is PUPPETEERED with its OWN gaze rhythm, blink rate, brow mobility,
  // expressiveness + resting mouth, so two band members (or dancers) of one genre read
  // as distinct INDIVIDUALS. These flow from a DEDICATED PRNG stream seeded off THIS
  // alien's OWN seed — INDEPENDENT of `rand` above, so no morph/colour/dance draw is
  // perturbed (the per-alien rand stream stays byte-identical). A genre-level bias from
  // traits.personality (feature-derived, no rng in traits -> drift-free) tilts the whole
  // species: fast genres blink/dart more, aggressive brows are mobile, etc.
  const prand = rng32(seed ^ 0x7face01);
  const tp = traits.personality || {};
  const bnum = (v, d) => (typeof v === "number" ? v : d);
  const P = {
    // overall face-motion gain (subtle vs vivid faces)
    expressiveness: clamp(0.72 + (bnum(tp.expressive, 0.5) - 0.5) * 0.8 + (prand() - 0.5) * 0.5, 0.35, 1.5),
    // seconds between blinks + a per-alien phase so a crowd never blinks in unison
    blinkInterval: clamp(3.4 - bnum(tp.blink, 0.4) * 2.1 + (prand() - 0.5) * 1.5, 1.3, 5.0),
    blinkPhase: prand() * 12,
    blinkDur: 0.12 + prand() * 0.07,
    // seconds a gaze target holds before wandering + its own phase
    gazePeriod: clamp(1.7 - bnum(tp.restless, 0.4) * 1.1 + (prand() - 0.5) * 1.0, 0.45, 2.6),
    gazePhase: prand() * 12,
    gazeRestless: clamp(0.45 + (bnum(tp.restless, 0.4) - 0.4) * 0.8 + (prand() - 0.5) * 0.4, 0.15, 1.0),
    gazeForward: clamp(0.45 + (prand() - 0.5) * 0.5, 0.1, 0.85),   // bias toward camera (+Z)
    gazeSaccade: 7 + prand() * 9,                                  // pupil lerp speed toward target
    browMobility: clamp(0.75 + (bnum(tp.browMob, 0.5) - 0.5) * 0.9 + (prand() - 0.5) * 0.5, 0.25, 1.6),
    restMouth: clamp(bnum(tp.restMouth, 0.05) + prand() * 0.06, 0, 0.18),
  };

  // ---- BODY PLAN resolution (NON-HUMAN) -----------------------------------------
  // The body plan is the top-level silhouette DECISION. Read traits.body.plan when
  // the traits agent supplies the new shape; otherwise DERIVE a plan from the older
  // body fields so this module works against either traits.js. Plans:
  //   radial      — N-fold star: a central core, N arms spoked radially, eye ring
  //   cephalopod  — a bulbous mantle over a cluster of long curling tentacles
  //   insectoid   — a segmented thorax on many thin splayed legs, mandible face
  //   blob        — an amorphous pulsing mass with stubby pseudopods, one maw
  //   stalk       — a cluster of tall swaying stalks, eyes on stalk-tips
  //   crystalline — a stack of angular glowing crystal prisms, shard limbs
  //   gas         — floating translucent sacs that bob, wispy tendrils
  function derivePlan(b) {
    const shape = b.bodyShape;
    if (shape === "blob") return "blob";
    if (shape === "tower") return "stalk";
    if (shape === "triangle") return "radial";
    if (shape === "wedge") return "crystalline";
    if (shape === "segmented") return (Math.round(b.limbs || 4) >= 5) ? "insectoid" : "cephalopod";
    // no legacy shape either — pick from massH/height so it is still deterministic.
    const h = b.height || 1.5, m = b.massH || 1;
    if (m > 1.5) return "radial";
    if (h > 2.4) return "stalk";
    return "cephalopod";
  }
  const PLANS = ["radial", "cephalopod", "insectoid", "blob", "stalk", "crystalline", "gas"];
  let plan = bIn.plan;
  if (!plan || PLANS.indexOf(plan) < 0) plan = derivePlan(bIn);

  // ---- ARCHETYPE (the RECOGNIZABLE creature — Complaint 2) -----------------------
  // On TOP of the low-level `plan` silhouette we read a recognizable SPECIES archetype
  // (dragon / dog / person / robot / mollusk / jelly / star / crawler / blob) that drives
  // the GEAR pass (horns/ears/wings/tail/fins/antennae/crest) + a STANCE tweak, so genres
  // read as obviously different animals. Prefer traits.body.archetype; else derive from the
  // plan so this module still works against older traits (and the plan-forced face test).
  const ARCHES = ["draconic", "quadruped", "biped", "bot", "mollusk", "jelly", "star", "crawler", "blobby",
    "dog", "dino", "gator", "robot", "human"];
  let arche = bIn.archetype;
  if (!arche || ARCHES.indexOf(arche) < 0) {
    arche = ({ radial: "star", gas: "jelly", cephalopod: "mollusk", crystalline: "bot",
      blob: "blobby", insectoid: "crawler", stalk: "biped" })[plan] || "biped";
  }
  // ---- EARTH-ANIMAL read: dog / dino / gator / robot / human get a dedicated, recognizable
  // BODY BUILD below (a real stance), gated on the archetype AND its HOME plan. traits.js pins
  // body.plan to the home plan, so in production the earth build always fires; a forced-plan
  // test (which keeps the archetype but sets a DIFFERENT plan) mismatches -> falls through to
  // the alien plan build (so the plan-silhouette contract + tests stay intact).
  const EARTH_HOME = { dog: "insectoid", gator: "insectoid", dino: "stalk", human: "stalk", robot: "stalk" };
  const earthAnim = EARTH_HOME[arche] === plan;          // an Earth animal on its home plan
  const isQuadAnimal = earthAnim && (arche === "dog" || arche === "gator");   // horizontal 4-legged
  // GEAR flags — prefer explicit traits fields, else derive from the archetype.
  const gearWinged = bIn.winged != null ? !!bIn.winged : (arche === "draconic");
  const gearTailed = bIn.tailed != null ? !!bIn.tailed : (arche === "draconic" || arche === "quadruped" || arche === "crawler" || arche === "dog" || arche === "dino" || arche === "gator");
  const gearEared = bIn.eared != null ? !!bIn.eared : (arche === "quadruped" || arche === "dog");
  const gearHorn = arche === "draconic" ? (bIn.horniness != null ? clamp(bIn.horniness, 0, 1) : 0.7) : 0;
  const gearBot = arche === "bot" || arche === "robot";
  const gearAntenna = gearBot || plan === "crystalline";
  const gearCrest = arche === "biped" || arche === "human" || arche === "mollusk" || (arche === "draconic");

  const H = Math.max(0.9, (bIn.height || 1.5) * morphH);
  const massH = Math.max(0.5, (bIn.massH || 1) * morphMass);
  const coreR = 0.5 * H * (0.32 + massH * 0.14) * morphR; // core radius, girth from massH (+per-alien)
  // appendage counts — new fields first, else derive from legacy limbs/eyes.
  const legacyLimbs = Math.round(bIn.limbs != null ? bIn.limbs : 4);
  let nArms = Math.round(bIn.arms != null ? bIn.arms : legacyLimbs);
  nArms = clamp(nArms, 2, 6);
  const symMetry = clamp(Math.round(bIn.symmetry || (plan === "radial" ? nArms : 2)), 2, 8);
  if (plan === "radial") nArms = clamp(symMetry, 3, 6);
  else nArms = clamp(nArms + armJit, 2, 6);              // per-alien: maybe one extra arm
  let nLegs = Math.round(bIn.legs != null ? bIn.legs : (plan === "insectoid" ? 6 : plan === "stalk" ? 3 : plan === "crystalline" ? 3 : 0));
  let nTent = Math.round(bIn.tentacles != null ? bIn.tentacles : (plan === "cephalopod" ? Math.max(4, nArms + 2) : plan === "gas" ? 4 : plan === "blob" ? 3 : 0));
  // per-alien nudge on whichever sway-appendage this plan actually grows.
  nLegs = clamp(nLegs + (nTent === 0 ? appJit : 0), 0, 8);
  nTent = clamp(nTent + (nTent > 0 ? appJit : 0), 0, 8);
  if (nLegs + nTent > 8) nTent = Math.max(0, 8 - nLegs);   // mobile appendage cap
  const nEyes = clamp(Math.round(bIn.eyes != null ? bIn.eyes : 2) + eyeJit, 1, 8);
  const asym = clamp(bIn.asymmetry || 0, 0, 1);

  // SUPERQUADRIC exponents for THIS alien's bodies + instruments — the genre base
  // (traits.body.sqEx/sqEy) nudged per-alien by EXISTING jitter (morphR/morphMass) so
  // NO new rand() is drawn (the per-alien rand stream stays byte-identical). Low
  // exponent = faceted/boxy, ~1 = round, >1 = pinched/star. tent taper/curl feed the
  // curve-tube tentacles.
  let sqEx = clamp((bIn.sqEx != null ? bIn.sqEx : 1) * morphR, 0.14, 1.7);
  let sqEy = clamp((bIn.sqEy != null ? bIn.sqEy : 1) * (0.9 + (morphMass - 1) * 0.35), 0.14, 2.2);
  // ROBOT reads BOXY: force a faceted head + instrument (low superquadric exponent) even for
  // washy/round genres (e.g. vaporwave), so the machine doesn't blur into an organic blob.
  if (earthAnim && arche === "robot") { sqEx = clamp(sqEx, 0.14, 0.4); sqEy = clamp(sqEy, 0.14, 0.5); }
  const tentTaper = clamp(bIn.tentTaper != null ? bIn.tentTaper : 0.25, 0.08, 0.5);
  const tentCurl = clamp(bIn.tentCurl != null ? bIn.tentCurl : 0.3, 0.05, 1.2);
  // a reusable superquadric body geometry (rx/ry/rz set per call site).
  const sqGeo = (r, ex, ey, segs) => superquadric(THREE, { ex: ex != null ? ex : sqEx, ey: ey != null ? ey : sqEy, segs: segs || 12, rx: r, ry: r, rz: r });

  // FACE family — new body.face.type first, else derive a wild face from eye count
  // + the legacy mouth motif so a swing face still differs from a glitch face.
  const faceIn = bIn.face || traits.face || {};
  let faceKind = faceIn.type;
  if (!faceKind) {
    if (nEyes === 1) faceKind = "oneEye";
    else if (nEyes >= 4) faceKind = "eyeRing";
    else if ((traits.face && traits.face.mouth) === "beak") faceKind = "mandibles";
    else faceKind = "maw";
  }
  // EARTH ANIMALS get a readable face: the robot a single big (glowing) sensor eye; dog/
  // dino/gator/human a friendly snouted/jawed maw with two big eyes.
  if (earthAnim) faceKind = arche === "robot" ? "oneEye" : "maw";
  // FANGS only for the toothy beasts (dino/gator/dragon) or an explicitly-toothy genre — so
  // the dog/human/robot maw reads FRIENDLY, not snarling.
  const wantFangs = arche === "dino" || arche === "gator" || arche === "draconic" || !!(traits.face && traits.face.teeth);
  const faceWide = faceIn.mouthWide != null ? faceIn.mouthWide : (traits.face && traits.face.mouthWide) || 0.4;

  // ---- RENDER STYLE (the genre's visual LANGUAGE, from traits.renderStyle) --------
  // traits.renderStyle.material picks how EVERY surface shades. The vocabulary is now
  // the READABLE set only — { flat, matte, cel, pbr, iridescent } — so the aliens are
  // always clearly legible. The old hard-to-read treatments (wireframe / pure-mesh /
  // the harsh glitch) are DROPPED: any such request falls back to a clean flat surface
  // rather than an illegible wire/noise skin. Materials are built ONCE per style and
  // reused across the whole alien; every treatment keeps light response + shadows.
  const READABLE = { flat: 1, matte: 1, cel: 1, pbr: 1, iridescent: 1 };
  let style = (traits.renderStyle && traits.renderStyle.material) || "flat";
  if (!READABLE[style]) style = "flat";                  // wireframe / mesh / glitch -> legible flat
  const wire = false;                                    // never wireframe (illegible) — dropped
  const smoothShade = style === "matte";
  const glitchTime = { value: 0 };                       // retained (harmless) — no glitch skin emitted

  let celGrad = null;
  if (style === "cel") {
    const ramp = new Uint8Array([70, 70, 84, 255, 150, 150, 165, 255, 245, 245, 255, 255]);
    celGrad = new THREE.DataTexture(ramp, 3, 1);
    celGrad.magFilter = THREE.NearestFilter; celGrad.minFilter = THREE.NearestFilter;
    celGrad.needsUpdate = true;
  }
  const IRID_GLSL = [
    "float _fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.2);",
    "vec3 _ir = 0.5 + 0.5 * cos(6.2831853 * (_fr + vec3(0.0, 0.33, 0.66)));",
    "outgoingLight = mix(outgoingLight, outgoingLight + _ir, _fr * 0.32);",
  ].join("\n");
  const GLITCH_VERT = [
    "float _burst = step(0.86, fract(uTime * 0.7));",
    "transformed.x += sin(uTime * 13.0 + transformed.y * 20.0 + transformed.x * 7.0) * (0.006 + 0.03 * _burst);",
    "transformed.z += cos(uTime * 17.0 + transformed.y * 14.0) * (0.004 + 0.02 * _burst);",
  ].join("\n");
  const GLITCH_FRAG = [
    "float _fl = step(0.8, fract(uTime * 0.7 + 0.3));",
    "outgoingLight.r += 0.16 * _fl * (0.5 + 0.5 * sin(uTime * 40.0));",
    "outgoingLight.b -= 0.16 * _fl * (0.5 + 0.5 * sin(uTime * 37.0));",
  ].join("\n");
  function applyStyleHook(m) {
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

  // ---- shared, LIT + shadowed materials (bold contrast) — PRESERVED --------------
  // Surface flavor picks the skin TEXTURE so materials read distinct: furry beasts get a
  // fuzzy fur weave, stone brutes a cracked-rock grain, glass jellies/chrome bots a clean
  // plate. Falls through to the genre's rhythmic texture for the plain/soft/wax skins.
  const surfTex = surface === "fur" ? "fur" : surface === "stone" ? "rock"
    : (surface === "chrome" || surface === "glass") ? "plate" : (traits.texture || "plate");
  const skinTex = makeSkinTexture(THREE, surfTex, rand);
  // 'pbr' surface constants — REAL chrome / glass / polished metal / WET-WAX from surface.
  // chrome = near-mirror metal; glass = clear translucent jelly; wax = glossy dielectric
  // sheen; else a soft brushed metal. Stronger separation than before so the materials read.
  const pbrGlass = traits.skin === "glass" || surface === "glass";
  const pbrMetalness = chrome ? 0.92 : pbrGlass ? 0.04 : surface === "wax" ? 0.0 : 0.55;
  const pbrRoughness = chrome ? 0.16 : pbrGlass ? 0.06 : surface === "wax" ? 0.12 : 0.5;
  const mk = (col, textured) => {
    const emissive = (glow > 0.05 ? col.clone().multiplyScalar(0.16 * glow) : new THREE.Color(0, 0, 0));
    let m;
    if (style === "pbr") {
      // real MeshStandardMaterial + the shared env map (reflections). VECTOR-SELECTED
      // by traits.renderStyle.material — never global. Keeps light + shadows + emissive.
      m = pbrMaterial(THREE, {
        color: col, map: textured ? skinTex : null,
        metalness: pbrMetalness, roughness: pbrRoughness, emissive,
        flatShading: !smoothShade, envMapIntensity: chrome ? 1.15 : pbrGlass ? 1.3 : 0.8,
        transparent: pbrGlass, opacity: pbrGlass ? 0.7 : 1,
      });
      return m;   // pbr does not use the iridescent/glitch onBeforeCompile hooks
    }
    if (style === "cel") {
      m = new THREE.MeshToonMaterial({ color: col, map: textured ? skinTex : null, emissive, gradientMap: celGrad });
      m.flatShading = true;
    } else if (surface === "wax") {
      // WET / WAXY: a Phong sheen with a tight bright highlight — reads glossy/wet.
      m = new THREE.MeshPhongMaterial({
        color: col, map: textured ? skinTex : null, emissive,
        specular: new THREE.Color(0xffffff), shininess: 64, flatShading: false,
      });
    } else {
      // stone -> FACETED (flat) rough; fur/soft -> SMOOTH matte flesh; else style default.
      const flat = surface === "stone" ? true : (surface === "fur" || surface === "soft") ? false : !smoothShade;
      m = new THREE.MeshLambertMaterial({
        color: col, flatShading: flat, map: textured ? skinTex : null, wireframe: wire, emissive,
      });
      if (smoothShade || surface === "fur" || surface === "soft") m.emissive = emissive.clone().add(col.clone().multiplyScalar(surface === "fur" ? 0.13 : 0.08));
    }
    return applyStyleHook(m);
  };
  // per-alien hue/sat/value SPIN so every band member + dancer of one genre reads as an
  // individual creature (cloth rotates a touch less + darker so it contrasts the skin).
  const skinCol = colHSL(THREE, pal.skin || { h: 200, s: 0.5, l: chrome ? 0.62 : 0.5 })
    .offsetHSL(hueSpin / 360, satSpin, valSpin);
  const clothCol = colHSL(THREE, pal.cloth || { h: 340, s: 0.5, l: 0.45 })
    .offsetHSL((hueSpin * 0.65) / 360, satSpin * 0.5, valSpin * -0.4);
  // per-alien accent hue SPIN + a saturation push -> individual, saturated pop.
  const accentCol = colHSL(THREE, pal.accent || { h: 40, s: 0.85, l: 0.6 }).offsetHSL(accentSpin / 360, 0.06, 0);
  const bodyCol = skinCol.clone().offsetHSL(0, 0.05, 0.08);
  const clothLit = clothCol.clone().offsetHSL(0, 0.05, 0.06);
  const limbCol = skinCol.clone().multiplyScalar(chrome ? 0.62 : 0.5);
  const accentBright = accentCol.clone().offsetHSL(0, 0.05, 0.08);
  const accent2Col = accentCol.clone().offsetHSL(0.5, 0.0, 0.05);
  const skinMat = mk(bodyCol, true);
  const clothMat = mk(clothLit, true);
  const limbMat = mk(limbCol, true);
  const accentMat = mk(accentBright, false);
  const accent2Mat = mk(accent2Col, false);
  const eyeMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: new THREE.Color(0x07070d), emissive: accentBright.clone().multiplyScalar(0.9), flatShading: !smoothShade }));
  const mouthMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: new THREE.Color(0x18080f), flatShading: !smoothShade }));
  // ---- CUTE EYE MATERIALS (Priority 1) — read from the landed camera distance -------
  // The classic legible cute eye: a BRIGHT WHITE SCLERA (a touch of emissive so it reads
  // white even in shadow) + a per-alien COLOURED IRIS + a DARK PUPIL + a bright white
  // CATCHLIGHT sparkle (fully emissive so it always glints). Deterministic (no rng) —
  // built once + reused across every eye on this alien. A rosy translucent BLUSH adds
  // the baby-face warmth. All wrapped in the style hook so iridescent/cel skins stay legible.
  const scleraMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: new THREE.Color(0xf5f5fc), emissive: new THREE.Color(0x33333d), flatShading: false }));
  const irisEyeCol = accentBright.clone();
  const irisMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: irisEyeCol, emissive: irisEyeCol.clone().multiplyScalar(0.42), flatShading: false }));
  const pupilMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: new THREE.Color(0x05050a), flatShading: false }));
  const catchMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: new THREE.Color(0xffffff), emissive: new THREE.Color(0xffffff), flatShading: false }));
  const blushMat = applyStyleHook(new THREE.MeshLambertMaterial({ color: new THREE.Color(0xff8fa6), emissive: new THREE.Color(0x401118), transparent: true, opacity: 0.5, flatShading: false }));
  const bodyDark = skinCol.clone().multiplyScalar(chrome ? 0.7 : 0.55);
  const instBodyMat = mk(bodyDark, false);
  // ---- INSTRUMENT COLOUR (Fix 2): a BOLD hue OPPOSITE the alien's body so the invented
  // instrument reads as a SEPARATE object, not another lump of the same creature. Take the
  // body (skin) hue — which already carries this alien's per-alien hueSpin — rotate it a
  // full 180° (complementary), and push saturation + value UP so it POPS against the body.
  // Deterministic (derived from THIS alien's own colour; no rng) and held CONSTANT for this
  // player's instrument. Used for BOTH the instrument body and its accents so the whole
  // instrument is one contrasting object.
  const _skinHSL = { h: 0, s: 0, l: 0 }; skinCol.getHSL(_skinHSL);
  const instHue = (_skinHSL.h + 0.5) % 1;                              // complementary to the body
  const instColBase = new THREE.Color().setHSL(instHue, clamp(0.74 + _skinHSL.s * 0.18, 0.6, 0.95), 0.55);
  const instMainMat = mk(instColBase.clone(), false);                  // instrument BODY — bold, lit
  const instAccMat = applyStyleHook(new THREE.MeshLambertMaterial({    // instrument ACCENTS — same family, brighter
    color: new THREE.Color(0x0a0a12), emissive: instColBase.clone().offsetHSL(0.02, 0.12, 0.22),
    flatShading: !smoothShade,
  }));
  // GLOWING LIGHT-BALL material: a near-black core swamped by a bright saturated
  // emissive -> a ball of light. Deep-dark body vs blazing orb = bold contrast.
  const mkOrb = (col) => applyStyleHook(new THREE.MeshLambertMaterial({
    color: new THREE.Color(0x0a0a12), emissive: col.clone(), wireframe: wire, flatShading: !smoothShade,
  }));
  const orbMat = mkOrb(accentBright.clone().offsetHSL(0, 0.12, 0.14));
  const materials = [skinMat, clothMat, limbMat, accentMat, accent2Mat, eyeMat, mouthMat, instBodyMat, orbMat, instMainMat, instAccMat, scleraMat, irisMat, pupilMat, catchMat, blushMat];

  const group = new THREE.Object3D();

  // ---- STATIC DECORATION MERGING (mobile draw-call economy) -----------------------
  // A recognizable creature carries DOZENS of little static plates — teeth, dorsal spines,
  // ear-shells, snout, socket collars, neck, sash. Rendered one-per-mesh that is ~100 draw
  // calls per alien (a mobile-cheap violation that also overloads headless SwiftShader).
  // FIX: every NON-ANIMATED decoration mesh is COLLECTED here and, at the end of the build,
  // MERGED into ONE BufferGeometry per (parent, material) — so a creature that visually has
  // dozens of plates costs a handful of draw calls. The ANIMATED nodes (IK limb bones/joint
  // knobs, jaw/eyes/brows, tentacles, orbs, the playing appendage, the fused core, curve
  // TUBES) are NEVER routed here — they stay their own meshes so motion + the probes are
  // intact. Merging bakes each mesh's local matrix into the shared geometry (position +
  // normal + uv), so the merged plates sit exactly where they were. Deterministic: pure
  // geometry, NO rng — same (genre,seed) stays byte-identical.
  const _staticBuckets = new Map();   // key: parentUUID|matUUID -> { parent, mat, meshes:[] }
  function addStatic(mesh, parent) {
    parent = parent || group;
    const key = parent.uuid + "|" + mesh.material.uuid;
    let b = _staticBuckets.get(key);
    if (!b) { b = { parent, mat: mesh.material, meshes: [] }; _staticBuckets.set(key, b); }
    b.meshes.push(mesh);
    return mesh;
  }
  const _mN3 = new THREE.Matrix3(), _mPv = new THREE.Vector3(), _mNv = new THREE.Vector3();
  function _bakeInto(mesh, P, N, U, off) {
    mesh.updateMatrix();
    const m = mesh.matrix; _mN3.getNormalMatrix(m);
    const g = mesh.geometry, pos = g.getAttribute("position");
    const idx = g.getIndex(), nrm = g.getAttribute("normal"), uv = g.getAttribute("uv");
    const cnt = idx ? idx.count : pos.count;
    for (let i = 0; i < cnt; i++) {
      const vi = idx ? idx.getX(i) : i;
      _mPv.fromBufferAttribute(pos, vi).applyMatrix4(m);
      P[off * 3] = _mPv.x; P[off * 3 + 1] = _mPv.y; P[off * 3 + 2] = _mPv.z;
      if (nrm) { _mNv.fromBufferAttribute(nrm, vi).applyMatrix3(_mN3).normalize(); N[off * 3] = _mNv.x; N[off * 3 + 1] = _mNv.y; N[off * 3 + 2] = _mNv.z; }
      else { N[off * 3] = 0; N[off * 3 + 1] = 1; N[off * 3 + 2] = 0; }
      if (uv) { U[off * 2] = uv.getX(vi); U[off * 2 + 1] = uv.getY(vi); }
      off++;
    }
    return off;
  }
  function flushStatic() {
    for (const b of _staticBuckets.values()) {
      if (b.meshes.length === 1) { b.parent.add(b.meshes[0]); continue; }
      let total = 0;
      for (const mm of b.meshes) { const g = mm.geometry, idx = g.getIndex(); total += idx ? idx.count : g.getAttribute("position").count; }
      const P = new Float32Array(total * 3), N = new Float32Array(total * 3), U = new Float32Array(total * 2);
      let off = 0;
      for (const mm of b.meshes) off = _bakeInto(mm, P, N, U, off);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(U, 2));
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      b.parent.add(new THREE.Mesh(geo, b.mat));
    }
    _staticBuckets.clear();
  }

  // continuously-waving parts (tentacles/stalks/cilia/antennae) — beat-independent.
  // Each is a FABRIK-curled CatmullRom TUBE on a root that sways over time.
  const tendrils = [];      // { root, baseQuat, sp, amp, ph, sway }
  let tentacleProof = null; // { err, tip, target, reached } — first FABRIK tentacle (headless proof)
  const pulseCores = [];    // { mesh, base:Vector3(scale), amp } — blob/gas breathing
  const orbs = [];          // { mesh, base:Vector3, ph, amp } — floating light-balls
  const legs = [];          // { limb, footRest:Vector3, reach, side } — ARTICULATED jointed legs
  const YAX = new THREE.Vector3(0, 1, 0);
  const ZAX = new THREE.Vector3(0, 0, 1);
  const _jv = new THREE.Vector3(), _legTgt = new THREE.Vector3();

  // ---- VISIBLE ARTICULATED JOINTS -------------------------------------------------
  // Every limb reads as JOINTED — a rounded KNOB at each bend + a ball-and-socket at the
  // body entry — so appendages pivot at joints instead of melting smoothly into the mass.
  // Each joint mesh is tagged (userData.joint) so the headless joint probe can census it.
  // Deterministic (NO rng) + mobile (low-seg spheres/tori; joint counts are capped by the
  // capped segment/appendage counts, and only TRANSFORMS move in update — no rebuilds).
  function addJointKnob(pos, r, kind, parent, mat) {
    const j = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1e-3, r), 8, 6), mat || skinMat);
    j.position.copy(pos); j.userData.joint = kind;
    (parent || group).add(j);
    return j;
  }
  // a body-entry BALL-AND-SOCKET: a knob BALL + a darker collar RING around it, seated on
  // the marching-cubes core surface, so the limb visibly PIVOTS from a socket (not a melt).
  function addSocket(pos, r, kind) {
    const ball = addJointKnob(pos, r, kind, group, skinMat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.12, r * 0.34, 5, 8), limbMat);
    ring.position.copy(pos); ring.userData.joint = kind + "Collar";
    const out = _jv.set(pos.x, 0, pos.z); if (out.lengthSq() < 1e-6) out.set(0, 1, 0); else out.normalize();
    ring.quaternion.setFromUnitVectors(ZAX, out);   // hole faces outward — limb passes through
    addStatic(ring, group);   // STATIC collar — merged into one draw call across all sockets
    return ball;
  }

  // ---- FUSED ORGANIC CORE (marching cubes) collection ----------------------------
  // Instead of gluing separate torso primitives (a hub, a mantle, thorax spheres…) the
  // per-plan build now DESCRIBES the central body mass as a set of METABALLS — a spine of
  // lumps + a lump at every limb ROOT — so the whole thing bakes to ONE fused isosurface
  // where the appendages MELT into the torso. `coreBalls` is filled during the plan build;
  // `appendageRoots` collects tendril/leg roots so limbs fuse in too. Baked ONCE below.
  const coreBalls = [];         // { x, y, z, r } in local space (absolute y)
  const appendageRoots = [];    // Vector3 roots of tendrils/legs to fuse into the core
  let corePulse = false;        // blob/gas/cephalopod → the fused core breathes
  const addCoreBall = (x, y, z, r) => coreBalls.push({ x, y, z, r: Math.max(1e-3, r) });

  // ---- a soft multi-segment TENDRIL (nested rotation chain) ----------------------
  // Cheap organic appendage: a chain of tapering cylinders that WAVES via a
  // traveling sine on each joint. Used for tentacles, stalks, cilia, gas wisps —
  // and (curled at rest) idle NON-player arms. Capped segment count for mobile.
  function makeTendril(rootPos, dir, segLen, nSeg, width, mat, capMat, opts) {
    opts = opts || {};
    nSeg = clamp(Math.round(nSeg), 2, 5);
    pushRootToSurface(rootPos);              // Fix 1: seat legs/tentacles ON the body surface
    appendageRoots.push(rootPos.clone());    // fuse this limb's root into the marching-cubes core
    // GOAL 0 — a VISIBLE ball-and-socket at the BODY ENTRY, so the tentacle pivots from a
    // clear socket knob on the marching-cubes core (not a smooth melt). Static (the rootObj
    // swings the whole limb from here).
    addSocket(rootPos, width * 0.72, "socket");
    const rootObj = new THREE.Object3D();
    rootObj.position.copy(rootPos);
    rootObj.quaternion.setFromUnitVectors(YAX, dir.clone().normalize());
    group.add(rootObj);
    // LOCAL joint chain straight up +Y, then FABRIK-curl it toward a REACHABLE target so
    // the many-jointed tentacle reaches/curls smoothly. Deterministic; iters capped
    // (mobile). The curl is baked into the tube geometry once; the whole tube then sways
    // via the root rotation (cheap — no per-frame geometry rebuild).
    const pts = [];
    for (let s = 0; s <= nSeg; s++) pts.push(new THREE.Vector3(0, s * segLen, 0));
    const total = nSeg * segLen;
    const curlAmt = clamp(opts.curl != null ? Math.abs(opts.curl) : tentCurl, 0, 0.95);
    const side = opts.curl != null && opts.curl < 0 ? -1 : (opts.side != null ? opts.side : 1);
    const target = new THREE.Vector3(
      side * curlAmt * total * 0.7,
      total * (1 - curlAmt * 0.32),
      (opts.tip === "eye" ? 0 : side * curlAmt * total * 0.14)
    );
    fabrik(pts, target, { iters: 6 });
    // Fix 1 (NO CLIPPING): after the solve, push every INTERIOR joint OUTSIDE the torso
    // keep-out shell so the mid-section/curl of the limb can never pass through the body
    // core. Each local joint is mapped into group space (root pose), clamped out of the
    // core sphere by the SAME keepOutOfCore shell the arms use, then mapped back — so the
    // whole tube bows OUTWARD around the body. Root (0) + tip (nSeg) stay as solved, so the
    // tip target + tentacleProof are unperturbed and the curl still reaches its mark.
    {
      const _gp = new THREE.Vector3(), _qi = rootObj.quaternion.clone().invert();
      for (let s = 1; s < nSeg; s++) {
        _gp.copy(pts[s]).applyQuaternion(rootObj.quaternion).add(rootObj.position);
        keepOutOfCore(_gp);
        pts[s].copy(_gp).sub(rootObj.position).applyQuaternion(_qi);
      }
    }
    const tipErr = pts[nSeg].distanceTo(target);
    if (!tentacleProof) tentacleProof = { err: +tipErr.toFixed(5), tip: pts[nSeg].clone(), target: target.clone(), reached: tipErr < 0.02 };
    // sweep a tapered CatmullRom TUBE through the solved joints (a smooth curved limb).
    const taper = opts.taper != null ? opts.taper : tentTaper;
    const geo = tube(THREE, pts, { radius: width * 0.5, segs: clamp(nSeg * 4, 6, 24), radial: 6, taper });
    const tubeMesh = new THREE.Mesh(geo, mat);
    rootObj.add(tubeMesh);
    // GOAL 3 — VISIBLE JOINT NODES along the FABRIK chain so the tentacle reads as a
    // jointed, curling limb (rounded knobs at each interior joint, tapering along the run).
    // Children of rootObj (local chain frame), so they curl + sway WITH the tube — no rng,
    // no per-frame rebuild. Capped by nSeg (<=5 -> <=4 nodes).
    if (!opts.noNodes) for (let s = 1; s < nSeg; s++) {
      const nr = width * 0.42 * (1 - 0.45 * (s / nSeg) * (1 - (opts.taper != null ? opts.taper : tentTaper)));
      addJointKnob(pts[s], nr, "node", rootObj, capMat || mat);
    }
    // tip cap: a rounded SUPERQUADRIC knob or an eye-globe — never a cube.
    const capW = width * 0.55;
    const tip = pts[nSeg];
    const capGeo = opts.tip === "eye"
      ? new THREE.SphereGeometry(capW, 8, 6)
      : superquadric(THREE, { ex: 0.85, ey: 0.85, segs: 8, rx: capW * 1.05, ry: capW * 1.05, rz: capW * 1.05 });
    const cap = new THREE.Mesh(capGeo, capMat || mat);
    cap.position.copy(tip); rootObj.add(cap);
    if (opts.tip === "eye") {
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(capW * 0.34, 6, 5), accentMat);
      pupil.position.set(tip.x, tip.y, tip.z + capW * 0.72); rootObj.add(pupil);
    }
    // rand draw order PRESERVED (sp, amp?, ph, sway) so the per-alien rand stream is
    // byte-identical to the legacy chain rig (orbs / downstream jitter unchanged).
    const t = {
      root: rootObj, baseQuat: rootObj.quaternion.clone(),
      sp: 1.2 + rand() * 1.6, amp: opts.amp != null ? opts.amp : 0.16 + rand() * 0.12,
      ph: rand() * 6.28, sway: 0.6 + rand() * 0.5,
    };
    tendrils.push(t);
    return t;
  }
  function waveTendrils(t) {
    for (const tn of tendrils) {
      const sx = Math.sin(t * tn.sp + tn.ph) * tn.amp;
      const sz = Math.cos(t * tn.sp * tn.sway + tn.ph) * tn.amp * 0.7;
      tn.root.quaternion.copy(tn.baseQuat);
      tn.root.rotateX(sx); tn.root.rotateZ(sz);
    }
  }
  // GOAL 2 — FLEX the jointed legs on the beat so the KNEE visibly bends. Each leg's foot
  // is raised toward its hip by a beat-driven amount (0..1), which SHORTENS the leg so the
  // 2-bone IK bends the knee more; the foot only ever rises (never dips below its planted
  // rest), so feet never clip the floor. Deterministic; transforms only (no rebuild).
  function flexLegs(amp, beatK) {
    for (const lg of legs) {
      _legTgt.copy(lg.footRest);
      _legTgt.y += beatK * lg.reach * 0.16 * clamp(amp, 0, 1);   // raise foot -> knee flexes
      lg.limb.solve(_legTgt);
    }
  }

  // ---- 2-bone IK arm (the PLAYER manipulator — precise contact) -------------------
  // A limb = upper + fore + palm bones + a hand cap AT the tip. solve(target) runs a
  // law-of-cosines 2-bone IK so the TIP EQUALS the reachable target (that is what
  // lands the hand exactly on the note-onset contact), then inserts a wrist joint so
  // it reads as an articulated 3-segment appendage.
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _wrist = new THREE.Vector3();
  const _eb1 = new THREE.Vector3(), _eb2 = new THREE.Vector3();
  const WRIST_FRAC = 0.62;
  function placeBone(mesh, a, b) {
    const dir = _v1.subVectors(b, a); const len = dir.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(YAX, _v2.copy(dir).multiplyScalar(1 / len));
    mesh.scale.set(1, len, 1);
  }
  // A 3-SEGMENT articulated limb (upper + fore + hand/foot) solved by a law-of-cosines
  // 2-bone IK so the TIP lands EXACTLY on the target (the note-onset contact), while the
  // MID joint (elbow/knee) BENDS as the tip reaches. Now carries VISIBLE rounded JOINT
  // knobs at the mid (elbow/knee) + low (wrist/ankle) bends (GOALS 1 + 2) — tagged for the
  // joint probe — and exposes `elbowAngle` (the interior bend angle) so the flex is legible.
  // Segments TAPER from the root. opts.foot -> a flattened foot cap instead of pincer hand.
  function makeLimb(rootPos, poleDir, L1, L2, width, mat, capMat, opts) {
    opts = opts || {};
    const jn = opts.jointNames || { mid: "elbow", low: "wrist" };
    // LEAN limbs (idle/holder arms, non-lead legs) skip the 3rd bone + the visible joint
    // knobs + the pincer claws — they still IK-bend at the elbow, but cost ~4 fewer meshes
    // each (mobile draw-call economy). The PROBED limbs (the playing arm + the first leg)
    // are built FULL so the joint census + knee/elbow-flex proofs stay intact.
    const lean = !!opts.lean;
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.5, width * 0.4, 1, 5), mat);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.4, width * 0.3, 1, 5), mat);
    const palm = lean ? null : new THREE.Mesh(new THREE.CylinderGeometry(width * 0.3, width * 0.24, 1, 5), mat);
    const hMat = capMat || skinMat;
    // VISIBLE bend joints: a knuckle KNOB at the elbow/knee + a smaller one at the wrist/
    // ankle, bulging proud of the tapered bones so the articulation reads clearly.
    const midJoint = lean ? null : new THREE.Mesh(new THREE.SphereGeometry(width * 0.62, 7, 5), hMat);
    if (midJoint) { midJoint.userData.joint = jn.mid; group.add(midJoint); }
    const lowJoint = lean ? null : new THREE.Mesh(new THREE.SphereGeometry(width * 0.5, 7, 5), hMat);
    if (lowJoint) { lowJoint.userData.joint = jn.low; group.add(lowJoint); }
    const cap = new THREE.Object3D();
    if (opts.foot) {
      // FOOT: a rounded sole flattened in Y + elongated forward (no pincers).
      const sole = new THREE.Mesh(new THREE.SphereGeometry(width * 0.9, 6, 5), hMat);
      sole.scale.set(1.05, 0.5, 1.6); sole.position.y = width * 0.4; cap.add(sole);
    } else if (lean) {
      // LEAN hand: just a rounded palm-globe (no pincer cones).
      const palmBall = new THREE.Mesh(new THREE.SphereGeometry(width * 0.85, 6, 5), hMat);
      cap.add(palmBall);
    } else {
      // DE-SQUARE hand: a rounded palm-globe flanked by two curving PINCER claws. (Kept as
      // REAL cone meshes — the de-square census J1 counts ConeGeometry across the band, and
      // this is the player hand only, so the cost is 2 meshes per creature.)
      const palmBall = new THREE.Mesh(new THREE.SphereGeometry(width * 0.85, 7, 6), hMat);
      cap.add(palmBall);
      for (let s = -1; s <= 1; s += 2) {
        const pin = new THREE.Mesh(new THREE.ConeGeometry(width * 0.32, width * 1.9, 5), hMat);
        pin.position.set(s * width * 0.55, width * 0.75, 0); pin.rotation.z = -s * 0.55; cap.add(pin);
      }
    }
    group.add(upper); group.add(fore); if (palm) group.add(palm); group.add(cap);
    const root = rootPos.clone(), pole = poleDir.clone().normalize();
    const elbow = new THREE.Vector3(), tip = new THREE.Vector3(), wristV = new THREE.Vector3();
    const api = { root, tip, upper, fore, palm, cap, elbow, wrist: wristV, midJoint, lowJoint, elbowAngle: Math.PI };
    function solve(target) {
      // Fix 1: never aim a limb INTO the torso — clamp the target out of the keep-out shell
      // (a copy, so the caller's vector + the reach probe stay intact). Onset contacts sit
      // outside the shell already, so this is a no-op there and reach stays exact.
      target = keepOutOfCore(_kv.copy(target));
      const toT = _v3.subVectors(target, root);
      let d = toT.length();
      const maxD = (L1 + L2) * 0.999, minD = Math.abs(L1 - L2) + 1e-3;
      d = Math.min(maxD, Math.max(minD, d));
      const n = _v4.copy(toT).setLength(d);
      tip.copy(root).add(n);
      let c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
      c = Math.min(1, Math.max(-1, c));
      const ang = Math.acos(c);
      const ndir = _v4.setLength(1);
      let axis = _v5.crossVectors(ndir, pole);
      if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); else axis.normalize();
      const upperDir = _v1.copy(ndir).applyAxisAngle(axis, ang);
      elbow.copy(root).addScaledVector(upperDir, L1);
      keepOutOfCore(elbow);                 // Fix 1: the elbow rides OUTSIDE the torso too
      _wrist.copy(elbow).lerp(tip, WRIST_FRAC);
      keepOutOfCore(_wrist);
      wristV.copy(_wrist);                  // expose the posed wrist for the keep-out probe
      placeBone(upper, root, elbow);
      if (palm) { placeBone(fore, elbow, _wrist); placeBone(palm, _wrist, tip); }
      else placeBone(fore, elbow, tip);   // lean limb: the forearm runs straight to the hand
      cap.position.copy(tip);
      // ride the VISIBLE joint knobs on the posed bends (elbow/knee + wrist/ankle).
      if (midJoint) midJoint.position.copy(elbow); if (lowJoint) lowJoint.position.copy(_wrist);
      // interior BEND angle at the mid joint (pi = straight, smaller = flexed) — exposed so
      // the headless probe can prove the elbow/knee actually BENDS as the tip reaches.
      _eb1.subVectors(root, elbow); _eb2.subVectors(tip, elbow);
      const la = _eb1.length() || 1e-6, lb = _eb2.length() || 1e-6;
      let cc = _eb1.dot(_eb2) / (la * lb); cc = cc < -1 ? -1 : cc > 1 ? 1 : cc;
      api.elbowAngle = Math.acos(cc);
      return tip;
    }
    api.solve = solve;
    return api;
  }

  // arm bone lengths (reach scales with H); the instrument contact below derives
  // from this reach so the hand lands ON the instrument.
  let armLenMul = clamp(bIn.armLength || 1, 0.6, 3);
  // EARTH ANIMALS keep tidy limbs (no spidery reach): tiny T-rex arms for the dino, normal
  // short arms for everyone else — so a human reads human, not insectoid.
  if (earthAnim) armLenMul = arche === "dino" ? clamp(armLenMul * 0.55, 0.5, 0.8) : clamp(armLenMul, 0.6, 1.1);
  const armL1 = H * 0.2 * armLenMul, armL2 = H * 0.22 * armLenMul, armReach = armL1 + armL2;
  const armW = coreR * 0.34 * Math.max(0.6, 1.15 - armLenMul * 0.18);

  // ---- ARTICULATED JOINTED LEG (GOAL 2) ------------------------------------------
  // A standing/walking leg = thigh + shin + foot with a VISIBLE HIP ball-and-socket at
  // the body entry, a KNEE and an ANKLE joint (reused makeLimb machinery), planted on the
  // floor with the knee SOFTLY BENT. update() compresses the leg on the beat so the knee
  // visibly flexes (the foot only ever raises toward the hip -> never dips through the
  // floor). Deterministic; the root fuses into the marching-cubes core (contiguity).
  function makeLeg(rootPos, outDir, side) {
    pushRootToSurface(rootPos);
    appendageRoots.push(rootPos.clone());
    // only the FIRST leg is built FULL (its knee/ankle knobs carry the leg-flex proof); the
    // rest are LEAN (2-bone, no knobs) — cheaper, and the extra legs read fine at a glance.
    const lean = legs.length > 0;
    const legW = armW * 0.95, thigh = H * 0.2, shin = H * 0.2, reach = thigh + shin;
    addSocket(rootPos, legW * 1.15, "hip");        // GOAL 0 — visible hip socket on the core
    const od = outDir.clone().normalize();
    // knee bends FORWARD + outward: the IK pole points up/out/front.
    const pole = new THREE.Vector3(od.x, 0.9, od.z * 0.5 + 0.5).normalize();
    const limb = makeLimb(rootPos.clone(), pole, thigh, shin, legW, limbMat, skinMat,
      { jointNames: { mid: "knee", low: "ankle" }, foot: true, lean });
    // rest foot: down + slightly out/front, at ~0.82 of full reach (knee softly pre-bent).
    const foot = new THREE.Vector3(
      rootPos.x + od.x * reach * 0.32,
      rootPos.y - reach * 0.82,
      rootPos.z + od.z * reach * 0.32 + reach * 0.14);
    limb.solve(foot);
    legs.push({ limb, footRest: foot.clone(), reach, side });
    return limb;
  }

  // vertical anchors used across plans.
  const coreMidY = H * 0.5, shoulderY = H * 0.66, baseY = H * 0.16;
  // CHIBI PROPORTIONS (Priority 1): a bigger HEAD relative to the body reads as cute/baby.
  // `let` (not const): the face-seating pass below may GROW it to scale with a big body.
  let headSz = H * 0.31;
  // EARTH ANIMALS lean extra-cute: a bigger baby head (dino biggest, gator's stays modest as
  // its long snout carries the read).
  if (earthAnim) headSz *= (arche === "dino" ? 1.3 : arche === "dog" ? 1.18 : arche === "human" ? 1.16 : arche === "robot" ? 1.08 : 1.02);
  // ---- LIMB KEEP-OUT (Fix 1) ------------------------------------------------------
  // The torso occupies a rough sphere of radius ~coreR about the core centre. The old
  // contiguity fix over-pulled limb ROOTS inward, sinking shoulders/hips INSIDE the body
  // so arms/legs swung THROUGH it. Fix: (a) push every limb root OUT onto the body SURFACE
  // (a shoulder sits ON the torso, not in it), and (b) POSE-LIMIT the swing — every limb
  // target/joint is clamped to stay OUTSIDE a keep-out shell around the core, so a limb can
  // never penetrate the torso mesh. Deterministic; no rng; the onset CONTACT is unaffected
  // (contacts already sit well outside the shell, so reach stays exact).
  const CORE_Y = coreMidY;
  const CORE_KEEP = coreR * 1.02;          // limb points must stay OUTSIDE this shell
  const ROOT_SURFACE = coreR * 1.05;       // roots sit on the body surface (just outside it)
  const _kv = new THREE.Vector3();          // scratch: a clamped copy of a limb target
  function keepOutOfCore(v) {
    const dx = v.x, dy = v.y - CORE_Y, dz = v.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < CORE_KEEP) {
      if (d < 1e-5) v.x += CORE_KEEP;                       // degenerate: push +x out
      else { const k = CORE_KEEP / d; v.x = dx * k; v.y = CORE_Y + dy * k; v.z = dz * k; }
    }
    return v;
  }
  function pushRootToSurface(p) {
    const rad = Math.hypot(p.x, p.z);                        // horizontal distance from the core axis
    if (rad < ROOT_SURFACE) {
      if (rad < 1e-5) p.x = ROOT_SURFACE;
      else { const k = ROOT_SURFACE / rad; p.x *= k; p.z *= k; }
    }
    return p;
  }
  const head = new THREE.Object3D();      // face mount; y set per plan
  head.position.y = H * 0.86; group.add(head);

  // arm attach specs (filled per plan).
  const armRoots = [];   // { pos:Vector3, pole:Vector3, side }

  // ---- BUILD the CORE + appendage layout per PLAN --------------------------------
  function ringPos(i, count, r, y, zsq) {
    const ang = Math.PI / 2 - (i / count) * Math.PI * 2;   // i=0 -> front (+Z)
    return new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r * (zsq || 1));
  }
  function addPseudopods(count, ringR, y, len, downward) {
    for (let i = 0; i < count; i++) {
      const p = ringPos(i, Math.max(1, count), ringR, y, 0.9);
      const dir = downward
        ? new THREE.Vector3(p.x, -1.1, p.z).normalize()
        : new THREE.Vector3(p.x, 0.3, p.z).normalize();
      makeTendril(p, dir, len / 3.2, 3, coreR * 0.4, limbMat, skinMat, { curl: downward ? 0.5 : 0.2 });
    }
  }

  // ---- EARTH-ANIMAL BODY (dog / dino / gator / robot / human) ----------------------
  // A dedicated recognizable stance built on the SAME core+limb machinery as the alien plans:
  // fills coreBalls (baked to the one fused core), seats the head, pushes arm roots + plants
  // legs — so the downstream face / gear / instrument / floor-plant pipeline is untouched. The
  // upright bipeds (human/dino/robot) stand on 2 legs; the quadrupeds (dog/gator) run low on 4
  // legs with the body along Z (facing the +Z camera). All counts fixed (mobile-cheap); NO rng.
  let earthTailRoot = null, earthTailDir = null, earthBodyY = coreMidY;
  const armPush = (x, y, z, px, py, pz, side) =>
    armRoots.push({ pos: new THREE.Vector3(x, y, z), pole: new THREE.Vector3(px, py, pz).normalize(), side });
  function buildEarthBody() {
    if (arche === "human" || arche === "robot") {
      // UPRIGHT BIPED — a stacked torso, rounded head on top, 2 arms + 2 legs.
      addCoreBall(0, coreMidY - H * 0.10, 0, coreR * 0.98);   // hips
      addCoreBall(0, coreMidY + H * 0.06, 0, coreR * 1.02);   // belly
      addCoreBall(0, coreMidY + H * 0.22, 0, coreR * 0.9);    // chest
      addCoreBall(0, coreMidY + H * 0.36, 0, coreR * 0.58);   // neck base
      head.position.y = H * 0.92;
      makeLeg(new THREE.Vector3(-coreR * 0.5, coreMidY - H * 0.12, 0.02), new THREE.Vector3(-0.4, 0, 0.28), -1);
      makeLeg(new THREE.Vector3(coreR * 0.5, coreMidY - H * 0.12, 0.02), new THREE.Vector3(0.4, 0, 0.28), 1);
      armPush(-coreR * 0.98, coreMidY + H * 0.28, coreR * 0.18, -0.55, 0.4, 0.4, -1);
      armPush(coreR * 0.98, coreMidY + H * 0.28, coreR * 0.18, 0.55, 0.4, 0.4, 1);
    } else if (arche === "dino") {
      // UPRIGHT DINO (friendly T-rex): heavy leaning body, big head up-front, a THICK tail
      // counterweight sweeping back+down, 2 big legs, tiny arms tucked high on the chest.
      addCoreBall(0, coreMidY - H * 0.04, coreR * 0.06, coreR * 1.14);   // heavy pelvis
      addCoreBall(0, coreMidY + H * 0.12, coreR * 0.14, coreR * 0.96);   // belly (leans fwd)
      addCoreBall(0, coreMidY + H * 0.28, coreR * 0.24, coreR * 0.72);   // chest
      addCoreBall(0, coreMidY + H * 0.40, coreR * 0.32, coreR * 0.46);   // neck base
      addCoreBall(0, coreMidY - H * 0.12, -coreR * 0.95, coreR * 0.72);  // tail root (thick)
      addCoreBall(0, coreMidY - H * 0.18, -coreR * 1.8, coreR * 0.46);   // tail mid
      head.position.y = H * 0.88; head.position.z = coreR * 0.42;
      makeLeg(new THREE.Vector3(-coreR * 0.56, coreMidY - H * 0.08, coreR * 0.12), new THREE.Vector3(-0.42, 0, 0.36), -1);
      makeLeg(new THREE.Vector3(coreR * 0.56, coreMidY - H * 0.08, coreR * 0.12), new THREE.Vector3(0.42, 0, 0.36), 1);
      armPush(-coreR * 0.5, coreMidY + H * 0.24, coreR * 0.6, -0.35, 0.15, 0.85, -1);   // tiny arms
      armPush(coreR * 0.5, coreMidY + H * 0.24, coreR * 0.6, 0.35, 0.15, 0.85, 1);
      earthTailRoot = new THREE.Vector3(0, coreMidY - H * 0.2, -coreR * 2.4);
      earthTailDir = new THREE.Vector3(0, -0.15, -1);
    } else {
      // GATOR / DOG — LOW HORIZONTAL QUADRUPED facing the camera: a body spine front(+z)->
      // back(-z), 4 splayed legs, head forward, tail trailing back. Dog stands TALLER (short
      // snout + floppy ears + perky tail); gator is LOWER + LONGER (long toothy snout + ridged
      // back + long heavy tail — both via gear).
      const low = arche === "gator";
      const bY = low ? H * 0.26 : H * 0.36;                   // body-centre height (gator hugs ground)
      const gth = coreR * (low ? 0.66 : 0.8);                 // girth
      earthBodyY = bY;
      addCoreBall(0, bY + H * 0.02, coreR * 0.95, gth * 0.9);    // chest/shoulders (front)
      addCoreBall(0, bY + H * 0.02, coreR * 0.08, gth);           // mid torso
      addCoreBall(0, bY, -coreR * 0.85, gth * 0.96);             // haunches (back)
      addCoreBall(0, bY, -coreR * (low ? 1.7 : 1.45), gth * (low ? 0.66 : 0.5));   // tail root
      if (low) addCoreBall(0, bY, -coreR * 2.55, gth * 0.42);    // gator: a longer heavy tail
      head.position.y = bY + H * (low ? 0.04 : 0.18);
      head.position.z = coreR * (low ? 1.35 : 1.05);
      const legY = bY, spanX = coreR * (low ? 0.8 : 0.66);
      makeLeg(new THREE.Vector3(-spanX, legY, coreR * 0.72), new THREE.Vector3(-1, 0, 0.3), -1);
      makeLeg(new THREE.Vector3(spanX, legY, coreR * 0.72), new THREE.Vector3(1, 0, 0.3), 1);
      makeLeg(new THREE.Vector3(-spanX, legY, -coreR * 0.78), new THREE.Vector3(-1, 0, -0.3), -1);
      makeLeg(new THREE.Vector3(spanX, legY, -coreR * 0.78), new THREE.Vector3(1, 0, -0.3), 1);
      armPush(-coreR * 0.72, bY + H * 0.12, coreR * 0.7, -0.4, 0.5, 0.6, -1);   // forepaw arms
      armPush(coreR * 0.72, bY + H * 0.12, coreR * 0.7, 0.4, 0.5, 0.6, 1);
      earthTailRoot = new THREE.Vector3(0, bY + H * 0.04, -coreR * (low ? 2.6 : 1.9));
      earthTailDir = new THREE.Vector3(0, low ? 0.05 : 0.5, -1);   // dog tail perks up; gator trails
    }
  }

  if (earthAnim) buildEarthBody();
  else if (plan === "radial") {
    // N-fold star: a WIDE, FLAT central hub-disc (a squat lily-pad) with arms spoked
    // radially — deliberately low + wide so the silhouette reads as a broad many-armed
    // hub, not a ball. The ring bumps splay OUT past the hub so the star arms have shoulders.
    addCoreBall(0, coreMidY, 0, coreR * 1.6);            // broad hub
    addCoreBall(0, coreMidY + H * 0.09, 0, coreR * 0.8); // shallow dome on top
    addCoreBall(0, coreMidY - H * 0.11, 0, coreR * 1.25);// wide underside
    for (let i = 0; i < Math.max(3, symMetry); i++) {   // a splayed lobe under each spoke
      const p = ringPos(i, Math.max(3, symMetry), coreR * 1.5, coreMidY - H * 0.03, 1);
      addCoreBall(p.x, p.y, p.z, coreR * 0.6);
    }
    head.position.y = coreMidY + H * 0.34;
    for (let i = 0; i < nArms; i++) {
      const p = ringPos(i, nArms, coreR * 1.6, shoulderY - H * 0.06, 1);
      const pole = new THREE.Vector3(p.x, 0.7, p.z).normalize();
      armRoots.push({ pos: p, pole, side: p.x >= 0 ? 1 : -1 });
    }
    if (nLegs > 0) addPseudopods(nLegs, coreR * 1.2, baseY + H * 0.08, H * 0.4, true);
  } else if (plan === "cephalopod") {
    // a TALL, ELONGATED mantle — a narrow tapering dome stacked high (clearly taller than
    // wide) over a skirt of long curling tentacles. The stacked, shrinking balls give a
    // pointed squid-mantle taper instead of a round bulb.
    addCoreBall(0, coreMidY - H * 0.12, 0, coreR * 1.02);
    addCoreBall(0, coreMidY + H * 0.12, 0, coreR * 1.0);
    addCoreBall(0, coreMidY + H * 0.36, 0, coreR * 0.82);
    addCoreBall(0, coreMidY + H * 0.58, 0, coreR * 0.52);   // tapered mantle tip
    corePulse = true;   // the mantle breathes
    head.position.y = coreMidY + H * 0.28;
    // tentacle skirt hangs from the (narrow) mantle base.
    const skirtY = coreMidY - H * 0.06;
    for (let i = 0; i < nTent; i++) {
      const p = ringPos(i, nTent, coreR * 1.08, skirtY, 0.85);
      const dir = new THREE.Vector3(p.x * 0.5, -1.2, p.z * 0.5).normalize();
      makeTendril(p, dir, H * 0.16, 4, coreR * 0.5, limbMat, skinMat, { curl: 0.42, amp: 0.22 });
    }
    // two upper "arms" for playing, near the front of the (narrow) mantle.
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 0.98, shoulderY - tier * armW * 1.6, coreR * 0.5);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.4, 0.9, -0.6), side });
    }
  } else if (plan === "insectoid") {
    // a clearly SEGMENTED body: a head-thorax lobe up front and a long ABDOMEN trailing
    // WAY back in -z as a chain of shrinking lobes — so the silhouette is long-and-low
    // (thorax + abdomen), unmistakably different from any round mass.
    addCoreBall(0, coreMidY + H * 0.05, coreR * 0.85, coreR * 0.82);   // head-thorax (front)
    addCoreBall(0, coreMidY, -coreR * 0.35, coreR * 1.02);             // thorax
    addCoreBall(0, coreMidY - H * 0.03, -coreR * 1.35, coreR * 0.92);  // abdomen
    addCoreBall(0, coreMidY - H * 0.05, -coreR * 2.3, coreR * 0.64);   // abdomen tip (tapers back)
    head.position.y = coreMidY + H * 0.16;
    for (let i = 0; i < nLegs; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const row = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 0.9, coreMidY - H * 0.04 - row * coreR * 0.3, coreR * (0.5 - row * 0.5));
      // ARTICULATED jointed leg (hip socket + bending knee + ankle) instead of a stiff tube.
      makeLeg(p, new THREE.Vector3(side * 1.1, 0, 0.1), side);
    }
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 1.0, shoulderY - tier * armW * 1.4, coreR * 0.6);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.5, 0.85, -0.5), side });
    }
  } else if (plan === "blob") {
    // a SQUAT, WIDE amorphous mass — deliberately low and spread out (a puddle-creature),
    // several big off-centre lumps splayed sideways so it reads much wider than tall.
    addCoreBall(0, coreMidY - coreR * 0.18, 0, coreR * 1.32);
    addCoreBall(coreR * 0.95, coreMidY + coreR * 0.05, 0, coreR * 0.98);
    addCoreBall(-coreR * 0.85, coreMidY - coreR * 0.28, coreR * 0.35, coreR * 0.92);
    addCoreBall(coreR * 0.3, coreMidY + coreR * 0.42, coreR * 0.4, coreR * 0.72);
    corePulse = true;   // the blob breathes
    head.position.y = coreMidY + H * 0.06;
    if (nTent > 0) addPseudopods(nTent, coreR * 1.1, baseY + coreR * 0.4, H * 0.34, true);
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const p = new THREE.Vector3(side * coreR * 1.3, coreMidY + coreR * 0.2, coreR * 0.7);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.5, 0.3, 0.2), side });
    }
  } else if (plan === "stalk") {
    // a THIN, TALL stem — a slim bulb-base tapering up into a narrow neck (clearly
    // taller than wide), from which swaying stalks rise; eyes on stalk-tips.
    addCoreBall(0, baseY + H * 0.02, 0, coreR * 1.0);    // slim bulb base
    addCoreBall(0, baseY + H * 0.24, 0, coreR * 0.56);
    addCoreBall(0, coreMidY + H * 0.02, 0, coreR * 0.46);
    addCoreBall(0, coreMidY + H * 0.28, 0, coreR * 0.4); // thin neck up toward the head
    head.position.y = H * 0.82;
    const stalks = Math.max(2, nLegs || 3);
    for (let i = 0; i < stalks; i++) {
      const p = ringPos(i, stalks, coreR * 0.62, baseY + H * 0.08, 1);
      const withEye = i < nEyes;
      makeTendril(p, new THREE.Vector3(p.x * 0.15, 1, p.z * 0.15).normalize(), H * 0.2, 4, coreR * 0.34, skinMat, accentMat,
        { curl: 0.05, amp: 0.14, tip: withEye ? "eye" : "box" });
    }
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 0.72, H * 0.52 - tier * armW * 1.5, coreR * 0.28);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.4, 0.7, 0.1), side });
    }
  } else if (plan === "crystalline") {
    // a tall, ANGULAR TAPERED SPIRE — a stack of shrinking lumps rising to a point (a
    // crystal shard silhouette), ringed by cone shard-limbs so it never reads as round.
    addCoreBall(0, coreMidY - H * 0.16, 0, coreR * 1.02);
    addCoreBall(0, coreMidY + H * 0.05, 0, coreR * 0.74);
    addCoreBall(0, coreMidY + H * 0.27, 0, coreR * 0.5);
    addCoreBall(0, coreMidY + H * 0.47, 0, coreR * 0.28);   // spire point
    head.position.y = coreMidY + H * 0.34;
    for (let i = 0; i < Math.max(2, nLegs); i++) {
      const p = ringPos(i, Math.max(2, nLegs), coreR * 1.0, baseY + coreR * 0.3, 1);
      const shard = new THREE.Mesh(new THREE.ConeGeometry(coreR * 0.28, H * 0.34, 4), accent2Mat);
      shard.position.copy(p); shard.rotation.z = p.x * 0.6; shard.rotation.x = -p.z * 0.6; addStatic(shard, group);
    }
    // a crowning ANGULAR SPIKE at the spire tip — 4-sided cone, so the top reads faceted.
    const crown = new THREE.Mesh(new THREE.ConeGeometry(coreR * 0.34, H * 0.4, 4), accent2Mat);
    crown.position.set(0, coreMidY + H * 0.5, 0); addStatic(crown, group);
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2);
      const p = new THREE.Vector3(side * coreR * 0.86, shoulderY - tier * armW * 1.5, coreR * 0.34);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.5, 0.6, 0.2), side });
    }
  } else { // gas
    // a loosely-fused CLUSTER of bobbing sacs — several near-equal lobes offset in every
    // axis so the mass reads as a bumpy grape-cluster (multi-lobe), not one smooth ball.
    const sacOff = [[-0.7, -0.1, 0.4], [0.72, 0.28, -0.42], [-0.15, 0.62, -0.35], [0.25, 0.5, 0.55]];
    for (let s = 0; s < sacOff.length; s++) {
      const r = coreR * (1.0 - s * 0.11);
      addCoreBall(sacOff[s][0] * coreR, coreMidY + sacOff[s][1] * coreR, sacOff[s][2] * coreR, r);
    }
    corePulse = true;   // the sacs breathe
    head.position.y = coreMidY + coreR * 0.6;
    for (let i = 0; i < nTent; i++) {
      const p = ringPos(i, nTent, coreR * 0.8, coreMidY - coreR * 0.6, 1);
      makeTendril(p, new THREE.Vector3(p.x * 0.4, -1, p.z * 0.4).normalize(), H * 0.14, 3, coreR * 0.22, limbMat, accentMat,
        { curl: 0.2, amp: 0.28 });
    }
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const p = new THREE.Vector3(side * coreR * 1.1, coreMidY, coreR * 0.6);
      armRoots.push({ pos: p, pole: new THREE.Vector3(side * 0.4, 0.4, 0.3), side });
    }
  }

  // ensure at least two arm roots exist (a player + a holder) for any plan.
  while (armRoots.length < 2) {
    const side = armRoots.length % 2 === 0 ? 1 : -1;
    armRoots.push({ pos: new THREE.Vector3(side * coreR * 1.1, shoulderY, coreR * 0.5), pole: new THREE.Vector3(side * 0.5, 0.8, -0.4), side });
  }
  nArms = armRoots.length;
  // Fix 1: seat every arm root ON the body surface, so no shoulder is sunk inside the torso
  // (the over-pull regression). The player CONTACT derives from arms[playerIdx].root below,
  // so it rides out with the shoulder and stays reachable — reach is unaffected.
  for (const r of armRoots) pushRootToSurface(r.pos);

  // ---- BAKE THE FUSED ORGANIC CORE (marching cubes, ONCE) -------------------------
  // Seed a metaball at every ARM root + every tendril/leg root so the appendages MELT
  // into the torso (limbs read as growing OUT of the mass, not clamped tubes butting it).
  // Then bake the whole spine+limb-root metaball field to ONE static isosurface. This is
  // a pure function of the seeded positions -> deterministic; NO rng; run ONCE (never per
  // frame). Resolution capped for mobile. A degenerate field falls back to a superquadric.
  for (const r of armRoots) addCoreBall(r.pos.x, r.pos.y, r.pos.z, coreR * 0.5);
  for (const p of appendageRoots) addCoreBall(p.x, p.y, p.z, coreR * 0.42);
  if (coreBalls.length === 0) addCoreBall(0, coreMidY, 0, coreR * 1.1);   // safety spine
  const CORE_RES = 32;   // 28–40 band; static bake, so cheap at runtime
  const coreCenter = new THREE.Vector3(0, coreMidY, 0);
  let coreGeo = null;
  try { coreGeo = bakeMetaballGeometry(THREE, coreBalls, coreCenter, CORE_RES); } catch (e) { coreGeo = null; }
  let coreMesh, coreIsMarching = true;
  if (coreGeo) {
    coreMesh = new THREE.Mesh(coreGeo, clothMat);
    coreMesh.position.copy(coreCenter);      // geometry is origin-centred; position seats it
  } else {                                   // fallback (never expected): a plain lump
    coreIsMarching = false;
    coreMesh = new THREE.Mesh(sqGeo(coreR * 1.2, sqEx, sqEy, 14), clothMat);
    coreMesh.position.y = coreMidY;
  }
  coreMesh.userData.fusedCore = true;
  group.add(coreMesh);
  if (corePulse) pulseCores.push({ mesh: coreMesh, base: coreMesh.scale.clone(), amp: 0.07 });

  // ---- CONTRAST: floating LIGHT-BALLS — small bright emissive orbs orbiting the
  // core. Per-alien count + jitter so no two aliens carry the same halo; a deep-dark
  // body under blazing orbs is the value/colour contrast the scene asks for. Capped.
  const nOrbs = clamp(1 + orbJit, 1, 2);   // capped at 2 (mesh economy; halo variety survives)
  for (let i = 0; i < nOrbs; i++) {
    const oc = (i % 2 ? accentBright : accent2Col).clone().offsetHSL(0, 0.14, 0.16);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(coreR * (0.13 + rand() * 0.09), 7, 6), mkOrb(oc));
    // CONTIGUITY: orbs are ANTENNA-TIPS, not free-floaters — each rides a thin STALK
    // rooted in the core, and only bobs a little so it stays fused to its stalk tip.
    const base = ringPos(i, Math.max(1, nOrbs), coreR * 1.2, coreMidY + (rand() - 0.3) * H * 0.28, 0.9);
    const anchor = base.clone().multiplyScalar(0.42); anchor.y = coreMidY + (base.y - coreMidY) * 0.42;
    const stalk = new THREE.Mesh(tube(THREE, [anchor, base.clone()], { radius: coreR * 0.05, segs: 6, radial: 4, taper: 0.7 }), limbMat);
    group.add(stalk);
    orb.position.copy(base); group.add(orb);
    orbs.push({ mesh: orb, base: base.clone(), ph: rand() * 6.28, amp: coreR * 0.09 });
  }

  // ---- SEAT THE FACE ON THE BODY'S FRONT-UPPER OUTER SURFACE ----------------------
  // THE FIX: on the dominant "the body IS the head" plans (radial/blob/gas/cephalopod/
  // crystalline/insectoid — big superquadric + marching-cubes cores) the little face head
  // used to sit at z=0, BURIED inside the mass, so the alien rendered as a smooth
  // featureless apple. Push the head mount OUTWARD to the FRONT surface of the core at the
  // face height, and SCALE the face to the body girth, so every face part (all built at
  // local +z) reads PROUD of the body — clearly visible, camera-facing (+Z), never
  // occluded. Deterministic: pure geometry off the already-placed metaballs, NO rng, so
  // the per-alien rand stream + the matrix stay byte-identical (render-only).
  // Front surface Z of the metaball-union body at a given (y,x), local space.
  const bodyFrontZAt = (y, x) => {
    let z = -Infinity;
    for (const b of coreBalls) {
      const rr = b.r * b.r - (y - b.y) * (y - b.y) - ((x || 0) - b.x) * ((x || 0) - b.x);
      if (rr > 0) z = Math.max(z, b.z + Math.sqrt(rr));
    }
    return z;
  };
  {
    // worst-case (most FORWARD) surface across the vertical band the face spans, at x=0,
    // so even the lowest face part clears the body's bulge.
    let front = -Infinity;
    for (const yy of [head.position.y - headSz * 0.75, head.position.y - headSz * 0.3, head.position.y, head.position.y + headSz * 0.45]) {
      const z = bodyFrontZAt(yy, 0);
      if (z > front) front = z;
    }
    if (!isFinite(front)) front = coreR;              // degenerate field -> at least core radius
    // SCALE the face to the body girth so it reads BIG on a big body (never shrinks it).
    headSz = Math.max(headSz, front * 0.72);
    // SEAT the head origin just PROUD of that surface. Every face part is built at local
    // z>0, so the eyes/mouth/brows all end clearly IN FRONT of the body, not inside it.
    // The back half of the face skull still embeds in the core -> stays contiguous.
    head.position.z = Math.max(head.position.z, front + headSz * 0.14);
  }

  // ---- FACE: a wild family on the head object ------------------------------------
  const faceZ = headSz * 0.5;
  const jaw = new THREE.Object3D();
  const jawBaseY = -headSz * 0.2;
  jaw.position.set(0, jawBaseY, faceZ - headSz * 0.02);

  // ---- the animated FACE RIG ------------------------------------------------------
  // A small per-face rig the update PUPPETEERS: EYES (each in a socket pivot with a
  // pupil that DARTS + eyelids that BLINK), BROWS that raise, and the hinged JAW. Parts
  // are children of `head` (or eye pivots on the head) so the face is CONTIGUOUS and
  // never floats; the update only sets TRANSFORMS (no geometry rebuilt) — mobile-cheap.
  const faceRig = { eyes: [], brows: [], hasLids: false, jaw: null };
  // ---- HINGED JAW with a DARK CAVITY ---------------------------------------------
  // A real mouth: an UPPER jaw (on its own pivot) + a LOWER jaw (parented to the driven
  // `jaw` object, which drops + rotates on lip-sync) framing a RECESSED DARK CAVITY —
  // 3D interior geometry set BEHIND the jaw line, so an open mouth reads as a hollow, NOT
  // a flat black disc. All rounded (spheres/cones, no boxes). No rng (determinism intact).
  function buildHingedMouth(cy, w, opts) {
    opts = opts || {};
    const zf = faceZ, depth = w * 0.65;
    const cavZ = zf - depth * 0.55;
    // DARK CAVITY — a recessed dark pocket (interior geometry, not a disc on the face).
    const cav = new THREE.Mesh(new THREE.SphereGeometry(w * 0.6, 9, 7), mouthMat);
    cav.scale.set(1, 0.82, 0.62); cav.position.set(0, cy, cavZ); head.add(cav);
    // UPPER JAW — a rounded top-lip mass on its OWN pivot (hinges up/back on open).
    const upPivot = new THREE.Object3D();
    upPivot.position.set(0, cy + w * 0.16, zf - w * 0.06); head.add(upPivot);
    const upper = new THREE.Mesh(new THREE.SphereGeometry(w * 0.72, 10, 6), skinMat);
    upper.scale.set(1, 0.34, 0.6); upPivot.add(upper);
    // LOWER JAW — a rounded chin mass parented to `jaw` (drops + rotates on lip-sync).
    const lowY = cy - jawBaseY - w * 0.08;
    const lower = new THREE.Mesh(new THREE.SphereGeometry(w * 0.76, 10, 6), skinMat);
    lower.scale.set(1, 0.42, 0.62); lower.position.set(0, lowY, w * 0.05); jaw.add(lower);
    if (opts.fangs) {
      for (let k = 0; k < 2; k++) {
        const sx = (k * 2 - 1) * w * 0.3;
        const fu = new THREE.Mesh(new THREE.ConeGeometry(w * 0.1, w * 0.24, 4), accent2Mat);
        fu.position.set(sx, cy - w * 0.02, zf); fu.rotation.x = Math.PI; addStatic(fu, head);   // static upper fangs -> merged
        const fl = new THREE.Mesh(new THREE.ConeGeometry(w * 0.09, w * 0.2, 4), accent2Mat);
        fl.position.set(sx, lowY + w * 0.14, w * 0.05); jaw.add(fl);   // lower fangs ride the driven jaw
      }
    }
    faceRig.jaw = { upper: upPivot, lower, cavity: cav, cavZ, frontZ: zf, upBaseRotX: 0 };
    return faceRig.jaw;
  }
  // an EYE unit (Priority 1 — a BIG, CUTE, readable eye): a socket pivot on the head
  // carrying a BRIGHT WHITE SCLERA eyeball, a LOOK cluster (coloured IRIS + DARK PUPIL +
  // bright white CATCHLIGHT) that DARTS toward the gaze target + BLINKS as one, and (for
  // forward eyes) upper+lower eyelids. Sized LARGE relative to the head so the face reads
  // from the landed camera. Deterministic (no rng). Materials reused across the alien.
  function addEye(host, cx, cy, cz, R, opts) {
    opts = opts || {};
    const pivot = new THREE.Object3D();
    pivot.position.set(cx, cy, cz); host.add(pivot);
    // SCLERA — a big bright WHITE eyeball (the cute base; reads white at distance).
    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(R, 10, 8), scleraMat);
    pivot.add(eyeball);
    // LOOK cluster — IRIS + PUPIL + CATCHLIGHT parented together so they TRACK the gaze
    // and BLINK-squish as one. The update sets look.position (dart) + look.scale.y (blink).
    const look = new THREE.Object3D();
    look.position.set(0, 0, R * 0.86); pivot.add(look);
    const irisR = R * (opts.irisScale != null ? opts.irisScale : 0.7);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(irisR, 8, 6), irisMat);
    iris.scale.set(1, 1, 0.34); iris.position.z = R * 0.04; look.add(iris);
    const pupilR = irisR * 0.52;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1e-3, pupilR), 8, 7), pupilMat);
    pupil.scale.set(1, 1, 0.4); pupil.position.z = R * 0.09; look.add(pupil);
    // CATCHLIGHT — the little white glint (offset up-and-out) that makes the eye read alive.
    const cl = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1e-3, pupilR * 0.5), 6, 5), catchMat);
    cl.position.set(pupilR * 0.5, pupilR * 0.55, R * 0.14); look.add(cl);
    const rec = { pivot, eyeball, pupil: look, pupilDot: pupil, iris, catch: cl, R, baseScaleY: 1 };
    if (opts.lids) {
      const mkLid = (yy) => {
        const l = new THREE.Mesh(new THREE.SphereGeometry(R * 1.08, 6, 4), skinMat);
        l.scale.set(1, 0.5, 0.7); l.position.set(0, yy, R * 0.3); pivot.add(l); return l;
      };
      rec.upLid = mkLid(R * 0.78); rec.lidUpY0 = R * 0.78;      // open above the eye
      rec.loLid = mkLid(-R * 0.78); rec.lidLoY0 = -R * 0.78;    // open below; meet at centre on blink
      faceRig.hasLids = true;
    }
    faceRig.eyes.push(rec);
    return rec;
  }
  // ROSY CHEEK BLUSH (Priority 1 — baby-face warmth): two soft translucent pink patches on
  // the camera-facing side of the head, flanking the mouth. Deterministic (no rng).
  function addBlush(host, cy, spread, R) {
    for (let s = -1; s <= 1; s += 2) {
      const bl = new THREE.Mesh(new THREE.SphereGeometry(Math.max(1e-3, R), 7, 5), blushMat);
      bl.scale.set(1.35, 0.85, 0.28);
      bl.position.set(s * spread, cy, faceZ * 0.92);
      addStatic(bl, host);
    }
  }
  // a BROW ridge that raises on accents/loudness (registered so the update drives it).
  function addBrow(host, cx, cy, cz, w, side) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(w, 8, 5), limbMat);
    b.scale.set(1, 0.26, 0.42); b.position.set(cx, cy, cz); host.add(b);
    faceRig.brows.push({ mesh: b, baseY: cy, baseRotZ: b.rotation.z, side: side || 0 });
    return b;
  }

  function buildFace() {
    // a skull mass for maw/mandibles; a bare eye-cluster for the eye families. Eyes +
    // brows are built through the RIG helpers so the update can puppeteer them.
    if (faceKind === "oneEye") {
      const dome = new THREE.Mesh(sqGeo(headSz * 0.6, sqEx, sqEy, 12), skinMat);
      addStatic(dome, head);
      addBrow(head, 0, headSz * 0.5, headSz * 0.34, headSz * 0.52, 0);
      addEye(head, 0, headSz * 0.04, headSz * 0.36, headSz * 0.46, { lids: true, irisScale: 0.62 });
      addBlush(head, -headSz * 0.18, headSz * 0.4, headSz * 0.17);
      // a hinged maw below the giant eye so the singer can still gape (dark cavity).
      head.add(jaw);
      buildHingedMouth(-headSz * 0.36, headSz * 0.34, {});
    } else if (faceKind === "eyeRing") {
      const knob = new THREE.Mesh(sqGeo(headSz * 0.55, sqEx, sqEy, 12), skinMat);
      addStatic(knob, head);
      const ring = Math.min(8, nEyes);
      for (let e = 0; e < ring; e++) {
        const p = ringPos(e, ring, headSz * 0.58, 0, 1);
        // the two front-most eyes get real eyelids; the rest blink by squish (cheap).
        addEye(head, p.x, p.y, Math.abs(p.z) * 0.4 + headSz * 0.24, headSz * 0.21, { lids: e === 0 });
      }
      addBrow(head, 0, headSz * 0.54, headSz * 0.34, headSz * 0.5, 0);
      addBlush(head, -headSz * 0.04, headSz * 0.44, headSz * 0.15);
      head.add(jaw);
      buildHingedMouth(-headSz * 0.14, headSz * 0.32, {});
    } else {
      // maw / mandibles — a SUPERQUADRIC skull (squareness from the genre) with a jaw
      // that drops, plus a couple of eyes.
      const skull = new THREE.Mesh(sqGeo(headSz * 0.64, sqEx, sqEy, 14), skinMat);
      skull.scale.set(1, 1.06, 0.94); addStatic(skull, head);
      const eyeN = Math.min(3, Math.max(2, nEyes));
      // BIG cute eyes: sized LARGE vs the head (smaller only when 3 crowd the face); a wide
      // brow arches over them. per-alien vertical + spread jitter keeps faces individual.
      const eyeR = headSz * (eyeN >= 3 ? 0.23 : 0.31);
      const eyeY = headSz * (0.1 + eyeJit * 0.03), eyeSpread = headSz * (0.84 + morphR * 0.12);
      addBrow(head, 0, eyeY + eyeR * 1.15, faceZ - headSz * 0.02, headSz * 0.44, 0);
      for (let e = 0; e < eyeN; e++) {
        const sx = eyeN === 1 ? 0 : (e / (eyeN - 1) - 0.5) * eyeSpread;
        addEye(head, sx, eyeY, faceZ, eyeR, { lids: e === 0 });
      }
      addBlush(head, eyeY - eyeR * 1.3, headSz * 0.52, headSz * 0.17);
      head.add(jaw);
      if (faceKind === "mandibles") {
        // side mandibles (cones on the driven lower jaw) PLUS a hinged dark-cavity mouth.
        for (let s = -1; s <= 1; s += 2) {
          const md = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.1, headSz * 0.4, 4), accent2Mat);
          md.position.set(s * headSz * 0.22, -headSz * 0.06, faceZ + headSz * 0.05);
          md.rotation.z = s * 1.4; md.rotation.x = Math.PI / 2; jaw.add(md);
        }
        buildHingedMouth(-headSz * 0.02, headSz * 0.34, {});
      } else {
        // a fanged maw — hinged upper+lower jaw around a recessed dark cavity.
        buildHingedMouth(-headSz * 0.02, headSz * 0.4, { fangs: wantFangs });
      }
    }
  }
  buildFace();

  // ---- ARCHETYPE GEAR (Complaint 2: make plans read as DIFFERENT SPECIES) ----------
  // Recognizable creature features bolted onto the finished body+face so a heavy-metal
  // DRAGON (horns/wings/spines/tail), a jazz DOG (ears/snout/tail), a techno BOT (antennae),
  // an upright PERSON (crest), a MOLLUSK (fin) and a JELLY all read at a glance — the
  // Spore/Pokémon variety the user asked for. Gear meshes are children of `head` (horns/
  // ears/antennae/crest) or `group` (wings/spines/tail) so they stay CONTIGUOUS with the
  // body, cast shadows (the end-traverse tags them), and never dip below the feet (all sit
  // high or curl backward). Cheap: low-poly cones/slabs, built ONCE, no per-frame rebuild.
  function addArchetypeGear() {
    const hornMat = accent2Mat, earMat = skinMat, finMat = accent2Mat, wingMat = accentMat, antMat = limbMat;
    // HORNS — a pair (or a 4-horn crown for very horned beasts) curving up-and-back. Big +
    // pale bony (accent) so they read as horns at the face camera.
    if (gearHorn > 0.05) {
      const nH = gearHorn > 0.6 ? 4 : 2;
      for (let i = 0; i < nH; i++) {
        const side = i % 2 === 0 ? 1 : -1, tier = Math.floor(i / 2);
        const len = headSz * (0.75 + gearHorn * 0.6) * (1 - tier * 0.3);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.16 * (1 - tier * 0.22), len, 5), hornMat);
        horn.position.set(side * headSz * (0.42 + tier * 0.16), headSz * (0.56 - tier * 0.05), faceZ * 0.2 - tier * headSz * 0.22);
        horn.rotation.z = side * (0.55 + tier * 0.25); horn.rotation.x = -0.6;
        addStatic(horn, head);
      }
    }
    // EARS — big floppy flattened cones (dog/beast) with an inner-ear accent, standing tall
    // and forward off the crown so they clear the body mass + read unmistakably as ears.
    if (gearEared) {
      for (let s = -1; s <= 1; s += 2) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.26, headSz * 0.78, 4), earMat);
        ear.scale.set(1, 1, 0.38); ear.position.set(s * headSz * 0.6, headSz * 0.52, headSz * 0.06);
        ear.rotation.z = s * 0.52; ear.rotation.x = -0.28; addStatic(ear, head);
        const inn = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.13, headSz * 0.5, 4), accent2Mat);
        inn.scale.set(1, 1, 0.36); inn.position.set(s * headSz * 0.6, headSz * 0.54, headSz * 0.11);
        inn.rotation.z = s * 0.52; inn.rotation.x = -0.28; addStatic(inn, head);
      }
    }
    // SNOUT / MUZZLE — a forward muzzle with dark nostrils: a soft short snout (dog), a LONG
    // toothy snout (gator), a big jaw-muzzle (dino) or a short reptilian one (dragon).
    const wantSnout = gearEared || arche === "gator" || arche === "dino" || arche === "draconic";
    if (wantSnout) {
      const long = arche === "gator";
      const zsc = long ? 2.6 : arche === "dino" ? 2.0 : 1.0;     // snout length scale along +z
      const wsc = long ? 0.62 : arche === "dino" ? 1.0 : 0.72;
      const yc = -headSz * (long ? 0.22 : arche === "dino" ? 0.26 : 0.16);   // dino jaw projects low+forward
      const rad = headSz * (arche === "dino" ? 0.4 : 0.32);
      const len = headSz * (arche === "dino" ? 0.55 : 0.5);
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(rad, 8, 6), skinMat);
      muzzle.scale.set(wsc, long ? 0.5 : arche === "dino" ? 0.75 : 0.62, zsc); muzzle.position.set(0, yc, faceZ + len);
      addStatic(muzzle, head);
      const tipZ = faceZ + len + rad * zsc * 0.85;                // out at the snout tip
      for (let s = -1; s <= 1; s += 2) {
        const nos = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.055, 6, 5), mouthMat);
        nos.position.set(s * headSz * 0.09, yc + headSz * 0.04, tipZ); addStatic(nos, head);
      }
      // GATOR: a row of little teeth marching along the long snout (a toothy grin). Fewer,
      // bigger teeth read the same at a glance and all MERGE into one draw call.
      if (long) {
        for (let k = 0; k < 3; k++) for (let s = -1; s <= 1; s += 2) {
          const zt = faceZ + len * 0.14 + k * (headSz * 0.32 * zsc * 0.6);
          const tooth = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.05, headSz * 0.15, 4), accentMat);
          tooth.position.set(s * headSz * 0.16, -headSz * 0.34, zt); tooth.rotation.x = Math.PI; addStatic(tooth, head);
        }
      }
    }
    // ROBOT: a plated collar ring + a glowing chest lamp (a friendly little bot). Antenna +
    // the boxy head (low sqEx) + the single big eye already carry the robot read.
    if (arche === "robot") {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(coreR * 0.9, coreR * 0.14, 6, 12), accent2Mat);
      collar.rotation.x = Math.PI / 2; collar.position.y = coreMidY + H * 0.28; addStatic(collar, group);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(coreR * 0.2, 7, 6), orbMat);
      lamp.position.set(0, coreMidY + H * 0.1, coreR * 0.9); addStatic(lamp, group);
    }
    // ANTENNAE — thin stalks tipped with a glowing orb (robot / crystalline).
    if (gearAntenna) {
      for (let s = -1; s <= 1; s += 2) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(headSz * 0.028, headSz * 0.045, headSz * 0.52, 5), antMat);
        stalk.position.set(s * headSz * 0.28, headSz * 0.64, -headSz * 0.04); stalk.rotation.z = s * 0.22; addStatic(stalk, head);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(headSz * 0.1, 6, 5), orbMat);
        tip.position.set(s * headSz * 0.34, headSz * 0.9, -headSz * 0.04); addStatic(tip, head);
      }
    }
    // CREST — a fan of fin-plates over the crown (biped topknot / dragon frill / mollusk).
    if (gearCrest) {
      for (let i = 0; i < 2; i++) {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(headSz * 0.15, headSz * (0.42 - i * 0.09), 3), finMat);
        fin.scale.set(0.28, 1, 1); fin.position.set(0, headSz * 0.56, -headSz * (0.02 + i * 0.26));
        fin.rotation.x = -0.15 + i * 0.18; addStatic(fin, head);
      }
    }
    // WINGS — two membrane fans with a couple of spar-bones off the upper back (draconic).
    if (gearWinged) {
      for (let s = -1; s <= 1; s += 2) {
        const wing = new THREE.Object3D();
        wing.position.set(s * coreR * 0.55, coreMidY + H * 0.14, -coreR * 0.45);
        const memb = new THREE.Mesh(superquadric(THREE, { ex: 0.5, ey: 0.5, segs: 6, rx: H * 0.28, ry: H * 0.21, rz: H * 0.018 }), wingMat);
        memb.position.set(s * H * 0.24, H * 0.07, 0); memb.rotation.z = s * 0.5; wing.add(memb);
        for (let k = 0; k < 2; k++) {
          const spar = new THREE.Mesh(new THREE.CylinderGeometry(coreR * 0.05, coreR * 0.03, H * (0.4 - k * 0.08), 4), limbMat);
          spar.position.set(s * H * (0.12 + k * 0.16), H * (0.05 + k * 0.06), 0);
          spar.rotation.z = s * (0.95 - k * 0.34); wing.add(spar);
        }
        wing.rotation.y = s * 0.5; group.add(wing);
      }
    }
    // DORSAL RIDGE — a shrinking row of back-plates: draconic/dino spines down the spine+tail,
    // gator scutes marching along the low horizontal back. A strong reptile read.
    if (arche === "draconic" || arche === "dino" || arche === "gator") {
      const gatorRidge = arche === "gator";
      const nS = gatorRidge ? 5 : arche === "dino" ? 4 : 3;
      const ridMat = gatorRidge ? accent2Mat : finMat;
      for (let i = 0; i < nS; i++) {
        const t = i / (nS - 1);
        if (gatorRidge) {
          const sc = new THREE.Mesh(new THREE.ConeGeometry(coreR * 0.16 * (1 - 0.4 * t), H * 0.12 * (1 - 0.35 * t), 4), ridMat);
          sc.position.set(0, earthBodyY + coreR * 0.6, coreR * 0.7 - t * coreR * 3.2);
          sc.rotation.x = -0.05; addStatic(sc, group);
        } else {
          const sp = new THREE.Mesh(new THREE.ConeGeometry(coreR * 0.16 * (1 - 0.3 * t), H * 0.22 * (1 - 0.45 * t), 4), ridMat);
          sp.position.set(0, coreMidY + H * 0.22 - t * H * 0.26, -coreR * 0.1 - t * coreR * 1.9);
          sp.rotation.x = -0.15; addStatic(sp, group);
        }
      }
    }
    // TAIL — a curling tendril off the low back (dog/dino/gator/dragon/quadruped/crawler). Uses
    // the earth build's tail root when set; curls BACK (+ up for the dog's perky tail) so it
    // sways yet never becomes the floor-planted lowest point. A little glowing tail-tip is the
    // charming ALIEN touch.
    if (gearTailed) {
      const root = earthTailRoot || new THREE.Vector3(0, coreMidY - H * 0.06, -coreR * 0.9);
      const dir = (earthTailDir || new THREE.Vector3(0, 0.12, -1)).clone().normalize();
      const tlen = H * (isQuadAnimal ? 0.12 : 0.14);
      const ttail = makeTendril(root, dir, tlen, 4, coreR * 0.34, limbMat, skinMat,
        { curl: arche === "dog" ? 0.55 : 0.42, amp: 0.16, side: 1, noNodes: true });   // tail node-knobs skipped (mesh economy)
      if (earthAnim && ttail && ttail.root) {
        const glowTip = new THREE.Mesh(new THREE.SphereGeometry(coreR * 0.17, 7, 6), orbMat);
        glowTip.position.set(0, tlen * 4 * 0.82, 0); ttail.root.add(glowTip);
      }
    }
  }
  addArchetypeGear();

  // ---- CONTIGUITY: a NECK/SNOUT bridges the head to the core so the face never floats ----
  // A tapered column from DEEP INSIDE the core out to the head base. Because the head is now
  // pushed FORWARD (+z) to sit on the body's front surface, the bridge must span that z gap
  // too — it runs from a point well inside the mass up-and-forward to the (forward) head, so
  // both ends overlap and the face-bump reads as fused to the body (never a floating apple).
  {
    const p0 = new THREE.Vector3(0, coreMidY + (head.position.y - coreMidY) * 0.35, coreR * 0.2);
    const p1 = new THREE.Vector3(0, head.position.y, head.position.z);
    const axis = p1.clone().sub(p0);
    const span = axis.length() + headSz * 0.6;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(coreR * 0.42, coreR * 0.62, span, 7), skinMat);
    neck.position.copy(p0).add(p1).multiplyScalar(0.5);
    if (axis.lengthSq() > 1e-9) neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    addStatic(neck, group);
  }
  // OUTFIT: some aliens wear an accent SASH — a colour band hugging the core (a per-alien
  // marking off the seed) so individuals stand apart. It hugs the body, so it stays fused.
  if (wearsSash) {
    const sash = new THREE.Mesh(new THREE.TorusGeometry(coreR * 1.02, coreR * 0.16, 6, 12), accent2Mat);
    sash.rotation.x = Math.PI / 2 - 0.25; sash.position.y = coreMidY + coreR * 0.1; addStatic(sash, group);
  }

  // ---- build the ARMS from the plan's roots --------------------------------------
  // the player arm is the manipulator that plays the score; the holder braces the
  // instrument for stringed/blown styles; the rest idle.
  const playerIdx = isDancer ? -1 : (((inst.appendage | 0) % nArms) + nArms) % nArms;
  const holderIdx = (!isDancer && nArms >= 2) ? (playerIdx + 1) % nArms : -1;
  const stringed = playStyle === "pluck" || playStyle === "bow";
  const arms = [];
  for (let i = 0; i < nArms; i++) {
    const r = armRoots[i];
    // CONTIGUITY: a CLAVICLE tube from a point just inside the core out to the shoulder,
    // capped by a shoulder NUB — so the arm is fused to the body at the joint (no gap),
    // no matter how far the plan splays the arm root.
    const inner = new THREE.Vector3(r.pos.x, r.pos.y, r.pos.z).multiplyScalar(0.45);
    inner.y = coreMidY + (r.pos.y - coreMidY) * 0.45;
    const clav = new THREE.Mesh(tube(THREE, [inner, r.pos.clone()], { radius: armW * 0.9, segs: 5, radial: 5, taper: 0.85 }), limbMat);
    addStatic(clav, group);   // static shoulder bridge — merged into one draw call across arms
    // GOAL 0 — a VISIBLE ball-and-socket SHOULDER at the body-entry point (a knob ball +
    // a collar ring seated on the marching-cubes core) so the arm reads as ATTACHED AT A
    // JOINT and pivots from it, not fused smoothly into the mass. Tagged for the joint probe.
    addSocket(r.pos, armW * 1.08, "shoulder");
    // only the PLAYING arm is FULL (its elbow+wrist knobs + pincer hand carry the play/joint
    // proofs); idle + holder arms are LEAN (2-bone, no knobs) — a big per-creature mesh cut.
    const a = makeLimb(r.pos.clone(), r.pole.clone(), armL1, armL2, armW, limbMat, skinMat, { lean: i !== playerIdx });
    a.side = r.side;
    a.rest = new THREE.Vector3(r.pos.x * 1.05, r.pos.y - armReach * 0.7, r.pos.z + coreR * 0.2); // relaxed hang
    arms.push(a);
  }

  // ---- procedural INVENTED (ALIEN) INSTRUMENT — players only ----------------------
  // Not a real drum/guitar. Six organic families, chosen by playStyle (refined by
  // the family label). Each exposes animation refs the update drives by contactness:
  //   membrane-sac  — a pulsing bladder that COMPRESSES on each strike (_sac)
  //   coiled resonator — a spiral coil that shivers when plucked (_coil)
  //   crystal chime-cluster — shards that ring/rotate when struck (_shards)
  //   tendril-harp  — a curved frame of strands that vibrate when plucked (_strings)
  //   bladder-horn  — a throat+bell that INFLATES while blown (_bladder)
  //   glass membrane-pane — a translucent pane a bow drags across (_pane,_bow)
  function instKindFor() {
    const f = (inst.family || "").toLowerCase();
    if (/conch|polyp|echo/.test(f)) return "conch";       // found/vocal layer — a spiral shell
    if (/veil|reed|lung|gas/.test(f)) return "veil";       // pad/drone — a floating membrane veil
    if (/sac|membrane|bladderdrum/.test(f)) return "sac";
    if (/coil|resonat|subwomp|synthbass|gutstring|bass/.test(f) && playStyle !== "strike") return playStyle === "bow" ? "pane" : "coil";
    if (/chime|crystal|clack|shaker/.test(f)) return "chime";
    if (/harp|tendril|bloop|twang|neon|shimmer/.test(f)) return "harp";
    if (/horn|wail|bladder/.test(f)) return "horn";
    if (playStyle === "strike" || playStyle === "drum") return "sac";
    if (playStyle === "bow") return "pane";
    if (playStyle === "blow") return "horn";
    if (playStyle === "pluck") return "harp";
    return "chime";
  }
  const instKind = isDancer ? null : instKindFor();
  function buildInstrument(kind) {
    const g = new THREE.Object3D();
    // Fix 2: the instrument wears its OWN bold complementary colour (body + accents) so it
    // contrasts the alien and reads as a distinct object.
    const acc = instAccMat, body2 = instMainMat;
    if (kind === "sac") {                                  // pulsing membrane-sac (drum)
      const sac = new THREE.Mesh(sqGeo(H * 0.21, sqEx, sqEy, 12), body2);   // superquadric membrane
      sac.scale.set(1, 0.78, 1); g.add(sac); g._sac = sac;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(H * 0.21, H * 0.028, 5, 12), acc);
      ring.rotation.x = Math.PI / 2; ring.position.y = H * 0.03; g.add(ring);
      // a curved beater — a CatmullRom TUBE arcing off the rim.
      const handle = new THREE.Mesh(tube(THREE, [
        new THREE.Vector3(0, H * 0.02, H * 0.2), new THREE.Vector3(H * 0.06, H * 0.14, H * 0.24),
        new THREE.Vector3(H * 0.02, H * 0.28, H * 0.12),
      ], { radius: H * 0.024, segs: 10, radial: 5, taper: 0.5 }), acc);
      g.add(handle);
      const nub = new THREE.Mesh(new THREE.SphereGeometry(H * 0.05, 6, 5), acc);
      nub.position.set(H * 0.02, H * 0.3, H * 0.1); g.add(nub);
    } else if (kind === "conch") {                         // echo-conch / voice-polyp (found) — a SPIRAL SHELL
      const cpts = [];
      const turns = 2.4, N = 22;
      for (let k = 0; k <= N; k++) {
        const t = k / N, a = t * Math.PI * 2 * turns, r = H * (0.03 + t * t * 0.17);
        cpts.push(new THREE.Vector3(Math.cos(a) * r, -H * 0.04 + t * H * 0.14, Math.sin(a) * r));
      }
      // tube widens toward the aperture (taper > 1) so it reads as a growing shell horn.
      const shell = new THREE.Mesh(tube(THREE, cpts, { radius: H * 0.02, segs: 44, radial: 7, taper: 4.2 }), body2);
      g.add(shell); g._sac = shell;                       // pulses a touch when struck
      const aperture = new THREE.Mesh(new THREE.SphereGeometry(H * 0.09, 9, 7), mouthMat);
      aperture.scale.set(1, 1, 0.5); aperture.position.set(Math.cos(turns * Math.PI * 2) * H * 0.2, H * 0.1, Math.sin(turns * Math.PI * 2) * H * 0.2); g.add(aperture);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(H * 0.045, 6, 5), acc);
      knob.position.set(0, -H * 0.06, 0); g.add(knob);
    } else if (kind === "veil") {                          // gas-veil / reed-lung (pad/drone) — a floating VEIL
      // a broad, thin, gently-curved membrane on a stalk — a lung/veil that hangs + billows.
      const veil = new THREE.Mesh(superquadric(THREE, { ex: 0.9, ey: 0.9, segs: 14, rx: H * 0.24, ry: H * 0.3, rz: H * 0.02 }), body2);
      veil.scale.set(1, 1, 1); veil.position.y = H * 0.06; g.add(veil); g._pane = veil;   // billows via _pane hook
      // a couple of ribs + a base bulb (the reed/lung root).
      for (let s = -1; s <= 1; s += 2) {
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.012, H * 0.012, H * 0.4, 5), acc);
        rib.position.set(s * H * 0.1, H * 0.06, H * 0.01); rib.rotation.z = s * 0.12; g.add(rib);
      }
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(H * 0.08, 8, 6), acc);
      bulb.position.set(0, -H * 0.12, 0); g.add(bulb);
    } else if (kind === "coil") {                          // coiled resonator (bass) — a spiral TUBE
      const cpts = [];
      const turns = 3, N = 18;
      for (let k = 0; k <= N; k++) {
        const t = k / N, a = t * Math.PI * 2 * turns, r = H * (0.06 + t * 0.12);
        cpts.push(new THREE.Vector3(Math.cos(a) * r, -H * 0.18 + t * H * 0.36, Math.sin(a) * r));
      }
      const coilMesh = new THREE.Mesh(tube(THREE, cpts, { radius: H * 0.02, segs: 40, radial: 5, taper: 0.7 }), body2);
      g.add(coilMesh); g._coil = [coilMesh];
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.02, H * 0.02, H * 0.4, 5), acc);
      g.add(spine);
    } else if (kind === "chime") {                         // crystal chime-cluster (perc) — HANGING BARS
      // a crossbar with tuned bars of clearly-varied length hanging beneath it (readable set).
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.02, H * 0.02, H * 0.34, 6), acc);
      bar.rotation.z = Math.PI / 2; bar.position.y = H * 0.16; g.add(bar);
      const shards = [];
      for (let k = 0; k < 5; k++) {
        const len = H * (0.24 - k * 0.03);
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.02, H * 0.02, len, 6), k % 2 ? acc : body2);
        sh.position.set((k - 2) * H * 0.075, H * 0.16 - len * 0.5, 0); g.add(sh); shards.push(sh);
      }
      g._shards = shards;
    } else if (kind === "harp") {                          // tendril-harp (lead/pluck) — a TALL LYRE
      const frame = new THREE.Mesh(new THREE.TorusGeometry(H * 0.26, H * 0.026, 5, 12, Math.PI * 1.15), body2);
      frame.rotation.z = -Math.PI / 2.2; g.add(frame);
      const strings = [];
      for (let s = 0; s < 6; s++) {
        const str = new THREE.Mesh(new THREE.BoxGeometry(H * 0.007, H * 0.42 - s * H * 0.028, H * 0.007), acc);
        str.position.set((s - 2.5) * H * 0.052, H * 0.03, 0); g.add(str); strings.push(str);
      }
      g._strings = strings;
    } else if (kind === "horn") {                          // bladder-horn (blow) — big FLARED BELL
      const bladder = new THREE.Mesh(sqGeo(H * 0.12, sqEx, sqEy, 10), body2);   // superquadric bladder
      bladder.position.set(-H * 0.02, -H * 0.05, 0); g.add(bladder); g._bladder = bladder;
      // a curved THROAT — a CatmullRom TUBE from bladder up to the bell.
      const throat = new THREE.Mesh(tube(THREE, [
        new THREE.Vector3(-H * 0.02, -H * 0.02, 0), new THREE.Vector3(H * 0.09, H * 0.07, 0),
        new THREE.Vector3(H * 0.18, H * 0.16, 0), new THREE.Vector3(H * 0.28, H * 0.24, 0),
      ], { radius: H * 0.035, segs: 14, radial: 6, taper: 0.85 }), body2);
      g.add(throat);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(H * 0.17, H * 0.22, 10, 1, true), acc);
      bell.rotation.z = -2.4; bell.position.set(H * 0.31, H * 0.28, 0); g.add(bell);
    } else {                                               // glass membrane-pane (bow)
      const pane = new THREE.Mesh(sqGeo(1, 0.3, 0.3, 10), body2);   // faceted superquadric slab
      pane.scale.set(H * 0.21, H * 0.13, H * 0.016); pane.position.y = -H * 0.02; g.add(pane); g._pane = pane;
      for (let s = 0; s < 4; s++) {
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.012, H * 0.012, H * 0.28, 5), acc);
        rib.position.set((s - 1.5) * H * 0.1, 0, H * 0.01); g.add(rib);
      }
      // a curved BOW — a CatmullRom TUBE dragged across the pane.
      const bow = new THREE.Mesh(tube(THREE, [
        new THREE.Vector3(-H * 0.2, 0, H * 0.07), new THREE.Vector3(0, H * 0.02, H * 0.09),
        new THREE.Vector3(H * 0.2, 0, H * 0.07),
      ], { radius: H * 0.008, segs: 10, radial: 4 }), acc);
      g.add(bow); g._bow = bow;
    }
    return g;
  }

  // contact point (alien-local) + the playing rig — PLAYERS ONLY.
  let contact = null, instrument = null, instrument2 = null, holdPoint = null, instBaseY = 0;
  const _tgt = new THREE.Vector3(), _rest = new THREE.Vector3(), _lastTarget = new THREE.Vector3();
  const _tgt2 = new THREE.Vector3();
  let windup = 0, bowAmp = 0, loweredDrop = 0, drumRate2 = 9;
  // TWO-TENTACLE DRUMMER: a drummer strikes with a SECOND appendage too, so both land on
  // drum onsets. contact2 is that hand's own strike point (mirrored to its side) and is
  // guaranteed reachable (same offset-from-shoulder formula as the primary hand).
  let contact2 = null, drumSecondIdx = -1;
  const contactAxis = new THREE.Vector3();   // the along-instrument axis for pitch bias
  if (!isDancer) {
    const pShoulder = arms[playerIdx].root;
    contact = new THREE.Vector3();
    const instTilt = new THREE.Euler();
    const REACH = armReach * 0.8;
    const put = (dx, dy, dz) => { contact.set(dx, dy, dz).normalize().multiplyScalar(REACH).add(pShoulder); };
    if (playStyle === "strike" || playStyle === "drum") { put(-0.2, -0.75, 0.7); contactAxis.set(1, 0, 0.3); }
    else if (playStyle === "pluck") { put(-0.3, -0.45, 0.85); instTilt.set(0, 0, 0.15); contactAxis.set(0.6, 0.8, 0); }
    else if (playStyle === "bow") { put(-0.1, -0.3, 0.95); contactAxis.set(1, 0.15, 0); }
    else if (playStyle === "blow") { put(-0.1, 0.55, 0.6); instTilt.set(0, 0, -0.35); contactAxis.set(0.4, 0.9, 0); }
    else { put(-0.2, -0.4, 0.85); contactAxis.set(0.6, 0.6, 0); }
    contactAxis.normalize();
    instrument = buildInstrument(instKind);
    instrument.position.copy(contact);
    instrument.rotation.copy(instTilt);
    group.add(instrument);
    instBaseY = contact.y;
    holdPoint = new THREE.Vector3(contact.x + coreR * 0.2, contact.y + armReach * 0.4, contact.z);
    const baseReach = H * 0.42;
    windup = baseReach * (isDrummer ? 0.9 : 0.55) * (0.7 + 0.3 * armLenMul);
    bowAmp = baseReach * 0.42;
    loweredDrop = H * 0.34;    // how far the instrument sinks when the voice rests
    // wire the SECOND drumming appendage (drummers only): its own reachable strike point.
    if (isDrummer && nArms >= 2) {
      drumSecondIdx = holderIdx >= 0 ? holderIdx : (playerIdx + 1) % nArms;
      if (drumSecondIdx === playerIdx) drumSecondIdx = (playerIdx + 1) % nArms;
      const s2 = arms[drumSecondIdx].root;
      const side2 = arms[drumSecondIdx].side || (contact.x >= 0 ? -1 : 1);
      contact2 = new THREE.Vector3().set(side2 * 0.28, -0.75, 0.72).normalize().multiplyScalar(REACH).add(s2);
      // A REAL SECOND DRUM at that hand (minimal membrane + rim, no beater — the
      // hand IS the beater). So drummers have TWO drums, one per hand.
      instrument2 = new THREE.Object3D();
      const sac2 = new THREE.Mesh(sqGeo(H * 0.17, sqEx, sqEy, 12), instMainMat);
      sac2.scale.set(1, 0.78, 1); instrument2.add(sac2); instrument2._sac = sac2;
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(H * 0.17, H * 0.024, 5, 12), instAccMat);
      ring2.rotation.x = Math.PI / 2; ring2.position.y = H * 0.03; instrument2.add(ring2);
      instrument2.position.copy(contact2);
      group.add(instrument2);
      // the second hand keeps its OWN pace — a steady cross-rhythm (rad/s), keyed
      // per-alien so it visibly differs from the note-onset primary hand.
      drumRate2 = 7.5 + (seed % 7) * 0.9;
    }
  }

  let clock = 0;
  // FLOOR PLANT: liftY raises the whole rig so its STANDING FEET rest ON the ground plane
  // (local y = 0, which the pedestal maps to the planet surface); the body then only ever
  // bobs UPWARD from there. Unlike the old worst-case lift, liftY is planted off the true
  // standing FOOT LINE (body + legs + tendrils) — NOT the held instrument or the hanging
  // arms, which dip when the voice rests. Those held parts are FLOOR-CLAMPED per-frame to
  // `groundLocal` (the group-local foot line) so they never clip the ground WITHOUT
  // floating the whole creature. Both computed once after the rig is posed (see below).
  let liftY = 0;
  let groundLocal = -Infinity;   // group-local y of the standing foot line (-inf = not planted yet)
  let instBelow = 0;             // how far the instrument geometry hangs below its own origin
  // keep a held HAND / instrument target from sinking below the standing foot line — with a
  // little headroom so the cap rests ON the ground, not through it. A no-op until planted.
  function floorTarget(v, headroom) {
    const minY = groundLocal + (headroom || 0);
    if (v.y < minY) v.y = minY;
    return v;
  }
  // rolling contact envelope (for the mouth + instrument animation + debug).
  let lastC = 0, lastEnergy = 0, lastRaise = 0;
  // FACE puppeteer state — the eased gaze position the pupils lerp toward, plus the
  // latest blink/brow/mouth values (all exposed via faceDebug for the headless proof).
  let gzX = 0, gzY = 0, lastGazeTX = 0, lastGazeTY = 0, lastBlink = 0, lastBrow = 0, lastMouth = 0, lastMouthOpen = 0;

  // --- contactness from the REAL note onsets (SCORE mode) --------------------------
  // Returns c in 0..1: 1 == the hand is AT the instrument (a hit landing NOW). For
  // impulse styles each onset is a momentary contact (approach->hit->recoil); for
  // sustained styles the contact is HELD across the note's duration. Wrap-safe at
  // the bar edges. Windows are short so sparse/syncopated onsets read as distinct
  // strikes; dense onsets overlap (busy playing).
  // DRUMMER: a genuinely fast strike — a short APPROACH window so the arm snaps into
  // the drum at the note's real onset speed (a big windup travelled over a tiny slice
  // of the bar reads as a convincing hit), then a crisp recoil. Sustained styles ignore.
  const APPROACH = isDrummer ? 0.055 : 0.11, RECOIL = isDrummer ? 0.05 : 0.07, ATTACK = 0.05, RELEASE = 0.08;
  let biasPitch = 0.5, haveBias = false, biasVel = 0.65;
  function noteContactness(barPhase, notes) {
    let c = 0; haveBias = false; biasVel = 0.65;
    for (let i = 0; i < notes.length; i++) {
      const nt = notes[i]; const t0 = nt.t;
      for (let off = -1; off <= 1; off++) {
        const d = barPhase - (t0 + off);
        let cc = 0;
        if (sustained) {
          const dur = Math.max(0.04, nt.dur || 0.12);
          if (d >= -ATTACK && d <= dur + RELEASE) {
            if (d < 0) cc = smooth01(1 + d / ATTACK);
            else if (d <= dur) cc = 1;
            else cc = smooth01(1 - (d - dur) / RELEASE);
          }
        } else {
          if (d >= -APPROACH && d <= RECOIL) {
            if (d <= 0) cc = smooth01(1 + d / APPROACH);
            else cc = smooth01(1 - d / RECOIL);
          }
        }
        if (cc > c) {
          c = cc;
          // capture the winning onset's VELOCITY for the mouth (wider on louder notes).
          biasVel = nt.vel != null ? (nt.vel > 1 ? clamp(nt.vel / 127, 0, 1) : clamp(nt.vel, 0, 1)) : 0.7;
          if (nt.pitch != null) { biasPitch = clamp((nt.pitch - 40) / 44, 0, 1); haveBias = true; }
        }
      }
    }
    return c;
  }
  // --- contactness from the beat sub-grid (legacy FALLBACK) ------------------------
  function beatContactness(beatPhase) {
    const sub = (beatPhase * hitsPerBeat) % 1;
    if (sustained) return 0.55 + 0.45 * Math.cos(sub * Math.PI * 2);
    return 0.5 + 0.5 * Math.cos(sub * Math.PI * 2);   // 1 at the sub-boundary, 0 at mid
  }

  // the player hand's target for a given contactness c (1 == striking) + pitch bias.
  function playerTarget(c, barPhase) {
    _tgt.copy(contact);
    if (haveBias) _tgt.addScaledVector(contactAxis, (biasPitch - 0.5) * H * 0.14);   // pitch -> position
    const away = 1 - c;
    if (playStyle === "strike" || playStyle === "drum") {
      _tgt.y += away * windup; _tgt.z -= away * windup * 0.25;
    } else if (playStyle === "pluck") {
      _tgt.x += arms[playerIdx].side * away * windup * 0.5; _tgt.z += away * windup * 0.35;
    } else if (playStyle === "bow") {
      const slide = Math.sin(clock * 6.0) * bowAmp * (0.3 + 0.7 * c);
      _tgt.x += slide; _tgt.y += slide * 0.12;
    } else if (playStyle === "blow") {
      _tgt.y -= away * windup * 0.3; _tgt.z += away * windup * 0.15;
    } else {
      _tgt.y += away * windup * 0.6;
    }
    return _tgt;
  }

  // drive the invented instrument's little animation from the current contact.
  function animateInstrument(c, vel) {
    if (!instrument) return;
    const k = c * (0.5 + 0.5 * vel);
    if (instrument._sac) instrument._sac.scale.set(1 + 0.14 * k, 0.8 - 0.2 * k, 1 + 0.14 * k);
    if (instrument._bladder) instrument._bladder.scale.setScalar(1 + 0.28 * k);
    if (instrument._pane) instrument._pane.rotation.z = Math.sin(clock * 6) * 0.05 * k;
    if (instrument._bow) { instrument._bow.position.x = Math.sin(clock * 6) * H * 0.16 * (0.3 + 0.7 * c); }
    if (instrument._strings) {
      const q = Math.sin(clock * 46) * 0.012 * k;
      for (let s = 0; s < instrument._strings.length; s++) instrument._strings[s].position.z = q * (s % 2 ? 1 : -1);
    }
    if (instrument._coil) { const q = 1 + Math.sin(clock * 40) * 0.04 * k; for (const s of instrument._coil) s.scale.x = q; }
    if (instrument._shards) instrument._shards.forEach((sh, s) => { sh.rotation.x = Math.sin(clock * 30 + s) * 0.1 * k; });
  }

  // deterministic per-alien value noise for the wandering gaze (seed-keyed; NO
  // Date.now / Math.random) so each alien gets its OWN sequence of glance targets.
  function gazeNoise(i) { const x = Math.sin(i * 127.1 + (seed & 1023) * 0.017 + 11.3) * 43758.5453; return x - Math.floor(x); }

  // ---- PUPPETEER the face: gaze / blink / brows / mouth ---------------------------
  // Runs every frame for players AND dancers (transforms only — no geometry rebuilt).
  //   GAZE  : the pupils lerp (eased, no jitter) toward a target that WANDERS every
  //           gazePeriod (per-alien) and is BIASED toward the camera (+Z / centre), so
  //           the crowd mostly meets your eye but keeps darting / glancing aside.
  //   BLINK : eyelids sweep shut+open on the per-alien blinkInterval (eyeball squishes;
  //           forward eyes also drop real lids), each face on its own phase.
  //   BROWS : raise on accents (this voice's onset contact) + overall loudness.
  //   MOUTH : opens on the player's OWN note onsets — the LEAD vocalist lip-syncs
  //           hardest (wider on higher velocity), the DRUMMER grimaces WIDE on hard
  //           hits, bass/pad move subtly; everyone bobs a little with loudness. Shape
  //           varies between a round O (soft/sustained) and a wide grimace.
  function driveFace(dt, c, loud, bob, mVel) {
    const ex = P.expressiveness;
    // GAZE target — wander (value-noise per gaze segment) biased toward the viewer.
    const seg = Math.floor((clock + P.gazePhase) / P.gazePeriod);
    let tx = (gazeNoise(seg) * 2 - 1) * P.gazeRestless;
    let ty = (gazeNoise(seg + 101.7) * 2 - 1) * P.gazeRestless * 0.65;
    tx *= (1 - P.gazeForward);
    ty = ty * (1 - P.gazeForward) + 0.06;                         // slight upward bias (toward camera)
    tx += Math.sin(clock * 2.3 + P.gazePhase) * 0.04;            // tiny live tremor
    tx = clamp(tx, -1, 1); ty = clamp(ty, -0.9, 0.9);
    lastGazeTX = tx; lastGazeTY = ty;
    const gk = dt > 0 ? 1 - Math.exp(-dt * P.gazeSaccade) : 0;    // eased approach (smooth dart)
    gzX += (tx - gzX) * gk; gzY += (ty - gzY) * gk;
    // BLINK — a fast eased close+open pulse on this alien's interval.
    const bt = (clock + P.blinkPhase) % P.blinkInterval;
    const closed = bt < P.blinkDur ? Math.sin((bt / P.blinkDur) * Math.PI) : 0;
    lastBlink = closed;
    // BROW raise — accents + loudness, scaled by this alien's brow mobility.
    const brow = clamp((0.28 * loud + 0.72 * Math.max(c, 0.12 * bob)) * P.browMobility * ex, 0, 1.2);
    lastBrow = brow;
    for (const e of faceRig.eyes) {
      const off = e.R * 0.42;
      e.pupil.position.x = gzX * off;
      e.pupil.position.y = gzY * off;
      e.pupil.position.z = e.R * 0.86;
      e.pupil.scale.y = 1 - 0.9 * closed;
      e.eyeball.scale.y = e.baseScaleY * (1 - 0.86 * closed);
      if (e.upLid) e.upLid.position.y = e.lidUpY0 * (1 - closed);   // lids meet at centre when shut
      if (e.loLid) e.loLid.position.y = e.lidLoY0 * (1 - closed);
    }
    for (const b of faceRig.brows) {
      b.mesh.position.y = b.baseY + brow * headSz * 0.12;
      b.mesh.rotation.z = b.baseRotZ + b.side * brow * 0.12;
    }
    // MOUTH — role-specific open + shape.
    const vShape = mVel == null ? 0.65 : clamp(mVel, 0, 1);
    const bobMouth = 0.05 * loud * (0.5 + 0.5 * Math.sin(clock * 5.0 + P.blinkPhase));
    let mo, wide = 0, round = 0;
    if (isDancer) {                                 // dancer sings to the groove (no onsets)
      mo = P.restMouth + 0.5 * (0.4 * loud + 0.6 * bob) + bobMouth; round = 0.3;
    } else if (roleName === "drum") {               // DRUMMER grimaces WIDE on hard hits
      mo = P.restMouth + (0.3 + 0.45 * vShape) * c + bobMouth * 0.4;
      wide = 0.55 * c + 0.2 * vShape;
    } else if (sing >= 1) {                          // LEAD / vocalist LIP-SYNC
      mo = P.restMouth + (0.4 + 0.5 * vShape) * c + bobMouth;
      round = 0.3 + 0.45 * (1 - vShape);            // rounder O on soft notes, wider on loud
    } else if (roleName === "pad") {                // slow sustained drone-hum
      mo = P.restMouth + 0.32 * c + 0.08 * loud * (0.5 + 0.5 * Math.sin(clock * 2.0)); round = 0.45;
    } else {                                        // bass + perc/found — SUBTLE, near-closed
      mo = P.restMouth + 0.16 * c + bobMouth * 0.35; round = 0.12;
    }
    mo = clamp(mo * (0.72 + 0.28 * ex), 0, 1);
    lastMouth = mo;
    jaw.position.y = jawBaseY - mo * headSz * 0.24;
    jaw.rotation.x = mo * 0.55;
    jaw.scale.set(1 + wide * 0.5, 1 + mo * 0.15, 1 + round * mo * 0.6);
    // UPPER jaw hinges up/back a little so the mouth opens from BOTH lips (not just a
    // dropping chin) — revealing the recessed dark cavity between them.
    if (faceRig.jaw && faceRig.jaw.upper) faceRig.jaw.upper.rotation.x = -mo * 0.32;
    lastMouthOpen = mo;
  }

  function update(dt, ctx) {
    dt = dt || 0; clock += dt;
    glitchTime.value = clock;

    // ---- parse ctx: SCORE object vs legacy beatPhase number vs null ---------------
    // loudness = OVERALL track level 0..1 (added contract field). Dancers desync when
    // it is low and sync up when it is high; falls back to this voice's own level (or 1
    // on the legacy number path) so older callers still animate.
    let barPhase, playing, level, notes, bobPhase, loudness, groundY;
    if (ctx != null && typeof ctx === "object") {
      barPhase = ((((ctx.barPhase || 0) % 1) + 1) % 1);
      playing = ctx.playing !== false;
      level = ctx.level == null ? 1 : clamp(ctx.level, 0, 1);
      notes = Array.isArray(ctx.notes) ? ctx.notes : null;
      bobPhase = (barPhase * 4) % 1;   // pseudo-beat for the whole-body groove
      loudness = ctx.loudness != null ? clamp(ctx.loudness, 0, 1) : level;
      groundY = ctx.groundY != null ? ctx.groundY : 0;
    } else {
      const beatPhase = ctx == null ? (clock % 1) : ((((ctx % 1) + 1) % 1));
      barPhase = beatPhase; playing = true; level = 1; notes = null; bobPhase = beatPhase;
      loudness = 1; groundY = 0;
    }
    const floorY = groundY + liftY;   // the rig's origin height that sits feet-on-ground
    const energyActive = (playing && level > 0.05) ? level : 0;   // 0 => REST
    lastEnergy = energyActive;

    const energy = groove.energy || 0.5;
    const bob = (1 - Math.cos(bobPhase * Math.PI * 2)) * 0.5;

    // idle WAVING (tentacles/stalks/cilia) — continuous, beat-independent.
    waveTendrils(clock);
    // breathing sacs (blob/gas).
    for (const pc of pulseCores) {
      const s = 1 + Math.sin(clock * 1.4 + pc.mesh.id * 0.3) * pc.amp;
      pc.mesh.scale.set(pc.base.x * s, pc.base.y * (2 - s), pc.base.z * s);
    }
    // floating light-balls drift; they surge a little more when the voice is loud.
    const orbDrive = 0.4 + 0.6 * (lastEnergy || 0);
    for (const o of orbs) {
      o.mesh.position.y = o.base.y + Math.sin(clock * 1.7 + o.ph) * o.amp * orbDrive;
      o.mesh.position.x = o.base.x + Math.cos(clock * 1.3 + o.ph) * o.amp * 0.5;
    }

    // contactness — from the SCORE when we have notes, else the beat sub-grid.
    let c;
    if (notes) c = noteContactness(barPhase, notes);
    else { c = beatContactness(barPhase); haveBias = false; biasPitch = 0.5; }
    c *= (energyActive > 0 ? 1 : 0);       // RESTING kills all contact
    lastC = c;
    const vel = haveBias ? 1 : 1;

    // FACE — puppeteer the rig: pupils dart+track a wandering gaze, eyelids blink on
    // the per-alien interval, brows raise on accents/loudness, and the MOUTH opens on
    // this player's OWN note onsets (lead lip-syncs hardest, drummer grimaces, bass/pad
    // subtle) + a gentle loudness bob. Runs for players AND dancers. Transforms only.
    const mouthVel = notes ? biasVel : (isDancer ? loudness : 0.6);
    driveFace(dt, c, loudness, bob, mouthVel);

    if (isDancer) {
      // DANCER — no instrument; a full-body groove that scales as a SMOOTH CONTINUUM
      // with volume: barely a shimmer when the mix is quiet, a big sway when it's loud.
      // Each dancer has its OWN phase + tempo + style, so a quiet floor of dancers moves
      // out of step (DESYNCED); as loudness rises they lock onto a shared beat (SYNC UP).
      const amp = 0.12 + 0.88 * loudness;
      const sync = smooth01(loudness);                 // 0 = do your own thing, 1 = lock together
      const SHARED = 1.9;                              // the shared groove tempo everyone locks to
      const rate = danceRate + (SHARED - danceRate) * sync;
      const ph0 = dancePhase0 * (1 - sync);            // own phase offset melts away as it syncs
      const beat = clock * rate + ph0;                 // this dancer's (blended) groove phase
      const upb = (1 - Math.cos(beat)) * 0.5;          // 0..1 upward hop (never dips below floor)
      const styleOff = danceStyle ? 0.9 : 0.0;         // style variant shapes the sway, not the beat lock
      // FLOOR CLAMP: origin sits at floorY (feet on ground); the hop only lifts UPWARD.
      group.position.y = floorY + upb * 0.12 * (0.6 + (groove.bounce || 0.4)) * H * amp;
      group.rotation.z = Math.sin(beat + styleOff) * 0.14 * (0.6 + (groove.sway || 0.3)) * amp;
      group.rotation.y = Math.sin(beat * 0.6 + styleOff * 0.5) * 0.26 * amp;
      head.rotation.x = -0.1 + upb * 0.35 * (groove.headbob || 0.4) * amp;
      head.rotation.y = Math.sin(beat * 1.1) * 0.2 * amp;
      flexLegs(amp, upb);   // knees bob-flex with the groove
      for (let i = 0; i < arms.length; i++) {
        const a = arms[i]; _rest.copy(a.rest);
        const lift = 0.5 + 0.5 * Math.sin(beat * 1.25 + i * 1.7 + styleOff);
        _rest.y += lift * armReach * 0.7 * amp;
        _rest.x += a.side * (0.2 + 0.3 * lift) * H * 0.3 + Math.sin(beat * 1.4 + i) * 0.05 * H;
        _rest.z += 0.2 * H * lift;
        a.solve(floorTarget(_rest, armW));   // a hanging dance arm never dips through the floor
        _lastTarget.copy(_rest);
      }
      return;
    }

    // PLAYER GROOVE: a musical bob + idle sway whose AMPLITUDE tracks this voice's
    // volume as a smooth continuum — subtle when the part is quiet, big when it's
    // loud (near-still at rest). The onset CONTACT below is independent (score law).
    const gAmp = 0.06 + 0.94 * energyActive;
    // FLOOR CLAMP: origin rests at floorY (feet on ground); the beat lifts it UPWARD only.
    group.position.y = floorY + bob * 0.09 * (groove.bounce || 0.4) * H * gAmp;
    group.rotation.z = Math.sin(clock * (1.2 + energy)) * 0.05 * (groove.sway || 0.3) * (0.15 + 0.85 * gAmp);
    group.rotation.y = Math.sin(clock * 0.7) * 0.04 * (groove.sway || 0.3) * (0.15 + 0.85 * gAmp);
    head.rotation.x = -0.12 + bob * 0.3 * (groove.headbob || 0.4) * gAmp;
    head.rotation.y = Math.sin(clock * 1.6) * 0.12 * (groove.headbob || 0.4) * (0.15 + 0.85 * gAmp);
    if (playStyle === "blow") group.rotation.x = -0.12 - bob * 0.05 * energyActive;

    // RAISE the instrument when playing; LOWER + drop it toward the lap when resting.
    const raise = smooth01((energyActive - 0.05) / 0.15);   // 0 rest -> 1 playing
    lastRaise = raise;
    if (instrument) {
      instrument.position.y = instBaseY - (1 - raise) * loweredDrop;
      // FLOOR: the lowered instrument never sinks through the ground — clamped to the
      // standing foot line (groundLocal) plus its own below-origin overhang, so it rests
      // ON the ground when at rest instead of forcing the whole creature to float up.
      const minInstY = groundLocal + instBelow;
      if (instrument.position.y < minInstY) instrument.position.y = minInstY;
      instrument.rotation.z = (instrument.rotation.z || 0);
      instrument.scale.setScalar(0.9 + 0.1 * raise);
    }

    // PLAYER ARM: strike/pluck/bow/blow ON the real note onsets (or idle at rest).
    const pArm = arms[playerIdx];
    if (energyActive > 0.001) {
      // clamp to the foot line so a low/idle strike pose (e.g. a blow horn dipping between
      // notes) never dips the hand through the ground; a real onset CONTACT sits well above
      // the foot line so this is a no-op there and the onset reach stays exact.
      pArm.solve(floorTarget(playerTarget(c, barPhase), armW));
    } else {
      _rest.copy(pArm.rest); _rest.y -= 0.05 * H;   // hand lowered, instrument at rest
      pArm.solve(floorTarget(_rest, armW));          // never below the foot line at rest
    }
    _lastTarget.copy(_tgt);
    animateInstrument(c, vel);

    // SECOND drumming hand — strikes its OWN drum at its OWN pace (a steady
    // cross-rhythm off `clock`, independent of the primary hand's note onsets),
    // so the two hands visibly move at DIFFERENT rates. Animates drum 2.
    if (drumSecondIdx >= 0) {
      const a2 = arms[drumSecondIdx];
      if (energyActive > 0.001) {
        const c2 = 0.5 - 0.5 * Math.cos(clock * drumRate2);   // 0..1 own-pace oscillation
        _tgt2.copy(contact2);
        const away2 = 1 - c2;
        _tgt2.y += away2 * windup; _tgt2.z -= away2 * windup * 0.25;
        a2.solve(floorTarget(_tgt2, armW));
        if (instrument2 && instrument2._sac) instrument2._sac.scale.set(1 + 0.14 * c2, 0.78 - 0.18 * c2, 1 + 0.14 * c2);
      } else { _rest.copy(a2.rest); _rest.y -= 0.05 * H; a2.solve(floorTarget(_rest, armW)); }
    }

    // holder braces the instrument for stringed/blown styles (when playing).
    if (stringed && holderIdx >= 0 && holderIdx !== playerIdx) {
      if (raise > 0.1) arms[holderIdx].solve(holdPoint);
      else { _rest.copy(arms[holderIdx].rest); arms[holderIdx].solve(floorTarget(_rest, armW)); }
    }

    // the remaining arms idle-sway.
    for (let i = 0; i < arms.length; i++) {
      if (i === playerIdx) continue;
      if (i === drumSecondIdx) continue;
      if (stringed && i === holderIdx) continue;
      const a = arms[i]; _rest.copy(a.rest);
      const idleAmp = 0.15 + 0.85 * gAmp;   // idle arms too calm down when the voice is quiet
      _rest.x += Math.sin(clock * (1.4 + energy) + i) * 0.05 * H * idleAmp;
      _rest.y += bob * 0.05 * H * gAmp + Math.sin(clock * 2 + i) * 0.02 * H * idleAmp;
      a.solve(floorTarget(_rest, armW));   // idle-swaying arms stay above the foot line
    }
    // legged plans (insectoid/stalk/crystalline): knees flex on the musical bob.
    flexLegs(gAmp, bob);
  }

  // headless-proof accessor: player hand tip vs the true contact (alien-local).
  function debug() {
    const t = (playerIdx >= 0 ? arms[playerIdx] : arms[0]).tip;
    const c = contact || t;
    return {
      playStyle, contactness: +lastC.toFixed(4),
      handTip: { x: t.x, y: t.y, z: t.z },
      contact: { x: c.x, y: c.y, z: c.z },
      target: { x: _lastTarget.x, y: _lastTarget.y, z: _lastTarget.z },
      dist: contact ? t.distanceTo(contact) : 0,
      reachDist: t.distanceTo(_lastTarget),
    };
  }

  // headless-proof accessor (Fix 1): sample the player arm's segments (root->elbow->wrist
  // ->tip) and report the MIN clearance — the distance from any sampled limb point to the
  // core centre. It must stay >= the keep-out radius, i.e. no limb segment penetrates the
  // torso. Reflects the CURRENT posed frame (update() solves the player arm each tick).
  function limbProbe() {
    const a = (playerIdx >= 0 ? arms[playerIdx] : arms[0]);
    const pts = [];
    const seg = (p, q, n) => { for (let s = 0; s <= n; s++) pts.push(p.clone().lerp(q, s / n)); };
    seg(a.root, a.elbow, 5); seg(a.elbow, a.wrist, 5); seg(a.wrist, a.tip, 5);
    let minClear = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x, p.y - CORE_Y, p.z);
      if (d < minClear) minClear = d;
    }
    return { minClear: +minClear.toFixed(4), keepR: +CORE_KEEP.toFixed(4), coreR: +coreR.toFixed(4), samples: pts.length };
  }

  // headless-proof accessor for the VISIBLE ARTICULATED JOINTS (GOALS 0-4). Censuses every
  // joint mesh (tagged userData.joint) by KIND — body-entry sockets (shoulder/hip/socket)
  // + their collars, mid bends (elbow/knee), low bends (wrist/ankle), and tentacle chain
  // NODES — and reports the player arm's live elbow (mid-joint) interior angle + a leg's
  // knee angle so the test can prove the mid joint BENDS as the limb reaches. Reflects the
  // CURRENT posed frame (update() solves the arms/legs each tick). No rng.
  function jointProbe() {
    const kinds = {};
    group.traverse((o) => {
      if (o.isMesh && o.userData && o.userData.joint) {
        const k = o.userData.joint; kinds[k] = (kinds[k] || 0) + 1;
      }
    });
    // one body-entry joint per limb: an arm SHOULDER, a leg HIP, or a tentacle/leg SOCKET.
    const bodyEntry = (kinds.shoulder || 0) + (kinds.hip || 0) + (kinds.socket || 0);
    const limbTotal = nArms + legs.length + tendrils.length;
    const pa = (playerIdx >= 0 ? arms[playerIdx] : arms[0]);
    return {
      kinds,
      limbCount: limbTotal,
      bodyEntryJoints: bodyEntry,                          // >= one per limb
      everyLimbHasEntry: bodyEntry >= limbTotal,
      // player arm articulation: elbow (mid) + wrist (low) knobs, live interior bend angle.
      playerElbowKnob: !!pa.midJoint, playerWristKnob: !!pa.lowJoint,
      playerArmJoints: (pa.midJoint ? 1 : 0) + (pa.lowJoint ? 1 : 0),
      playerElbowAngle: +pa.elbowAngle.toFixed(4),         // pi = straight, smaller = flexed
      tentacleNodes: kinds.node || 0,                      // visible knobs along the FABRIK chain
      legs: legs.length,
      kneeAngle: legs[0] ? +legs[0].limb.elbowAngle.toFixed(4) : null,
      kneeKnob: legs[0] ? !!legs[0].limb.midJoint : false,
      ankleKnob: legs[0] ? !!legs[0].limb.lowJoint : false,
    };
  }

  // headless-proof accessor for the BODY SILHOUETTE (GOAL 5). Returns the baked fused-core
  // geometry's bounding-box size + aspect ratios (yx = height/width, zx = depth/width) so
  // the test can prove the 7 plans read as GENUINELY DISTINCT shapes (tall cephalopod vs
  // squat blob vs long insectoid vs wide radial hub …), not uniform round blobs.
  function bodySignature() {
    const geo = coreMesh && coreMesh.geometry;
    if (!geo) return null;
    geo.computeBoundingBox();
    const b = geo.boundingBox, s = _jv.set(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    const x = s.x || 1e-3;
    return {
      plan, x: +s.x.toFixed(3), y: +s.y.toFixed(3), z: +s.z.toFixed(3),
      yx: +(s.y / x).toFixed(3), zx: +(s.z / x).toFixed(3),
      H: +H.toFixed(3), coreR: +coreR.toFixed(3),
    };
  }

  // headless-proof accessor for the animated FACE: the rig census + the live gaze /
  // blink / brow / mouth state + this alien's per-seed personality (individuality).
  function faceDebug() {
    const e0 = faceRig.eyes[0];
    // EYE SPEC (Priority 1 proof): big WHITE sclera + coloured iris + DARK pupil + bright
    // CATCHLIGHT, sized large vs the head, on the camera-facing (+Z local) side of the head.
    const lumOf = (m) => { const c = m.color; return +(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b).toFixed(4); };
    let eyeSpec = null;
    if (e0) {
      // average eye centre Z (local to head) — >0 means the eyes sit on the FRONT/camera side.
      let zsum = 0; for (const e of faceRig.eyes) zsum += e.pivot.position.z;
      eyeSpec = {
        count: faceRig.eyes.length,
        R: +e0.R.toFixed(4), headSz: +headSz.toFixed(4), eyeToHead: +(e0.R / headSz).toFixed(4),
        scleraLum: lumOf(e0.eyeball.material), pupilLum: e0.pupilDot ? lumOf(e0.pupilDot.material) : null,
        catchLum: e0.catch ? lumOf(e0.catch.material) : null, hasCatchlight: !!e0.catch, hasIris: !!e0.iris,
        pivotZ: +e0.pivot.position.z.toFixed(4), avgEyeZ: +(zsum / faceRig.eyes.length).toFixed(4),
        camFacing: (zsum / faceRig.eyes.length) > 0,
      };
    }
    return {
      eyes: faceRig.eyes.length, brows: faceRig.brows.length, hasLids: faceRig.hasLids,
      eyeSpec,
      role: roleName, sing,
      gaze: { x: +gzX.toFixed(4), y: +gzY.toFixed(4) },
      gazeTarget: { x: +lastGazeTX.toFixed(4), y: +lastGazeTY.toFixed(4) },
      pupil: e0 ? { x: +e0.pupil.position.x.toFixed(4), y: +e0.pupil.position.y.toFixed(4) } : null,
      blink: +lastBlink.toFixed(4), brow: +lastBrow.toFixed(4), mouth: +lastMouth.toFixed(4),
      // HINGED-JAW rig state: an upper + lower jaw framing a RECESSED DARK CAVITY (not a
      // flat black disc). `open` rises on lip-sync; both jaws rotate; the cavity sits behind
      // the jaw line (cavZ < frontZ) and wears the dark mouth material.
      mouthRig: faceRig.jaw ? {
        hasUpper: !!faceRig.jaw.upper, hasLower: !!faceRig.jaw.lower, hasCavity: !!faceRig.jaw.cavity,
        cavityRecessed: faceRig.jaw.cavZ < faceRig.jaw.frontZ,
        cavityHex: mouthMat.color.getHexString(),
        lowerRotX: +jaw.rotation.x.toFixed(4),
        upperRotX: +(faceRig.jaw.upper ? faceRig.jaw.upper.rotation.x : 0).toFixed(4),
        jawDropY: +jaw.position.y.toFixed(4),
        open: +lastMouthOpen.toFixed(4),
      } : null,
      personality: {
        expressiveness: +P.expressiveness.toFixed(4), blinkInterval: +P.blinkInterval.toFixed(4),
        blinkPhase: +P.blinkPhase.toFixed(4), gazePeriod: +P.gazePeriod.toFixed(4),
        gazeRestless: +P.gazeRestless.toFixed(4), browMobility: +P.browMobility.toFixed(4),
        restMouth: +P.restMouth.toFixed(4),
      },
    };
  }

  // headless-proof accessor for FACE PLACEMENT (the "buried apple" fix): reports, per eye,
  // the eye CENTRE in the alien's own (group-local) frame, the body's FRONT surface Z at
  // that eye's (x,y), and whether the eye sits PROUD of the body (centre Z > surface Z) and
  // CAMERA-FACING (+Z). `allProud`/`allCamFacing` are the headless proof that the face is on
  // the FRONT-OUTER surface of the MAIN body, not sunk inside it, on every body plan.
  function facePlacement() {
    group.updateMatrixWorld(true);
    const _w = new THREE.Vector3();
    const eyes = faceRig.eyes.map((e) => {
      e.pivot.getWorldPosition(_w); group.worldToLocal(_w);
      const surf = bodyFrontZAt(_w.y, _w.x);
      const has = isFinite(surf);
      return {
        x: +_w.x.toFixed(4), y: +_w.y.toFixed(4), z: +_w.z.toFixed(4), R: +e.R.toFixed(4),
        surfZ: has ? +surf.toFixed(4) : null,
        proud: has ? +(_w.z - surf).toFixed(4) : +_w.z.toFixed(4),
        outside: has ? _w.z > surf : _w.z > 0,
        camFacing: _w.z > 0,
      };
    });
    // the mouth cavity front-lip in the same local frame (should also read proud/camera-side).
    let cavZlocal = null;
    if (faceRig.jaw && faceRig.jaw.cavity) {
      faceRig.jaw.cavity.getWorldPosition(_w); group.worldToLocal(_w);
      cavZlocal = { z: +_w.z.toFixed(4), surfZ: (() => { const s = bodyFrontZAt(_w.y, _w.x); return isFinite(s) ? +s.toFixed(4) : null; })(), outside: (() => { const s = bodyFrontZAt(_w.y, _w.x); return isFinite(s) ? _w.z > s : _w.z > 0; })() };
    }
    const proudVals = eyes.map((e) => e.proud);
    return {
      plan, coreR: +coreR.toFixed(4), headSz: +headSz.toFixed(4),
      headY: +head.position.y.toFixed(4), headZ: +head.position.z.toFixed(4),
      eyes, cavity: cavZlocal,
      minProud: proudVals.length ? +Math.min(...proudVals).toFixed(4) : null,
      allProud: eyes.length > 0 && eyes.every((e) => e.outside),
      allCamFacing: eyes.length > 0 && eyes.every((e) => e.camFacing),
    };
  }

  // headless-proof accessor for the FUSED marching-cubes CORE: confirms the central body
  // mass is a baked STATIC BufferGeometry isosurface (not a per-frame rebuild), reports its
  // vertex/triangle count, and runs a union-find over triangles sharing a vertex to prove it
  // is ONE connected surface (the metaballs fused). MarchingCubes-imported => class exists.
  function coreInfo() {
    const geo = coreMesh && coreMesh.geometry;
    const posAttr = geo && geo.getAttribute ? geo.getAttribute("position") : null;
    const info = {
      isMarching: !!(coreIsMarching && geo && geo.userData && geo.userData.mcVertexCount),
      isBufferGeometry: !!(geo && geo.isBufferGeometry),
      isFusedCore: !!(coreMesh && coreMesh.userData && coreMesh.userData.fusedCore),
      hasImport: typeof MarchingCubes === "function",
      vertexCount: geo && geo.userData ? (geo.userData.mcVertexCount || 0) : 0,
      ballCount: coreBalls.length,
      triCount: posAttr ? (posAttr.count / 3) | 0 : 0,
      components: 0,
    };
    if (posAttr) {
      const pos = posAttr.array, nTri = (posAttr.count / 3) | 0;
      const parent = new Int32Array(nTri); for (let i = 0; i < nTri; i++) parent[i] = i;
      const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
      const vmap = new Map();
      const key = (vi) => Math.round(pos[vi * 3] * 1000) + "," + Math.round(pos[vi * 3 + 1] * 1000) + "," + Math.round(pos[vi * 3 + 2] * 1000);
      for (let t = 0; t < nTri; t++) {
        for (let k = 0; k < 3; k++) {
          const kk = key(t * 3 + k);
          if (vmap.has(kk)) parent[find(t)] = find(vmap.get(kk)); else vmap.set(kk, t);
        }
      }
      const comps = new Set(); for (let t = 0; t < nTri; t++) comps.add(find(t));
      info.components = comps.size;
    }
    return info;
  }
  // headless-proof accessor for the STRIKERS: how many appendages strike + each one's tip
  // distance to its drum contact at the current pose (drummers report >= 2).
  function strikerProbe() {
    const list = [];
    const pa = (playerIdx >= 0 ? arms[playerIdx] : arms[0]);
    list.push({ which: "primary", contactDist: contact ? +pa.tip.distanceTo(contact).toFixed(4) : 0, reach: +pa.tip.distanceTo(_lastTarget).toFixed(4) });
    if (drumSecondIdx >= 0) {
      const a2 = arms[drumSecondIdx];
      list.push({ which: "second", contactDist: contact2 ? +a2.tip.distanceTo(contact2).toFixed(4) : 0, reach: +a2.tip.distanceTo(_tgt2).toFixed(4) });
    }
    return { count: list.length, strikers: list };
  }
  // headless-proof accessor: no flat dark DISC/blob-shadow artifact remains under the alien.
  // We scan for a mesh that is BOTH near-black AND disc-like (a CircleGeometry, or a very
  // flat wide cylinder/ring) sitting low under the body. There should be NONE.
  function discProbe() {
    let discs = 0;
    group.updateMatrixWorld(true);
    // is `o` part of the (legit) invented INSTRUMENT? its rim/frame parts are meant to be
    // flat + dark; they are NOT the shadow artifact this probe hunts for.
    const inInstrument = (o) => { for (let p = o; p; p = p.parent) { if (p === instrument) return true; } return false; };
    group.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (inInstrument(o)) return;
      const gt = o.geometry.type || "";
      const m = o.material;
      const col = m && m.color ? m.color : null;
      const lum = col ? 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b : 1;
      if (lum > 0.12) return;                       // only worry about DARK meshes
      const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return;
      const s = new THREE.Vector3(); b.getSize(s);
      const flat = s.y < Math.min(s.x, s.z) * 0.28; // pancake-thin in Y (a disc/plane)
      const wide = Math.min(s.x, s.z) > coreR * 0.9; // spans the body footprint
      const low = b.max.y < coreMidY * 0.6;          // sits UNDER the body (near the floor)
      const discGeo = /Circle/.test(gt);
      if (discGeo || (flat && wide && low)) discs++;
    });
    return { darkDiscs: discs };
  }

  // MERGE all collected STATIC decoration into one draw call per (parent, material) — this
  // is the big mobile mesh-count cut (dozens of plates/teeth/spines/collars -> a handful of
  // meshes). Must run AFTER every addStatic() (gear/face-shell/neck/sash/socket-collars) and
  // BEFORE the shadow tag + foot-line sweep so the merged plates cast shadows + plant right.
  flushStatic();

  // SHADOWS + modelling: every mesh casts and receives the key light.
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // FLOOR PLANT: seat the STANDING FEET on the ground. The ground contact is the true
  // standing FOOT LINE — the lowest point of the BODY + LEGS + tendrils/pseudopods — NOT
  // the held instrument or the hanging player arms (those legitimately dip when the voice
  // rests, and are FLOOR-CLAMPED per-frame instead). Measuring off the worst-case rest
  // pose (the old way) floated the whole creature by the gap between the lowered instrument
  // and the feet; measuring the feet directly plants them ON the surface.
  const heldSet = new Set();     // arm segments + instrument subtree — excluded from the foot line
  for (const a of arms) for (const p of [a.upper, a.fore, a.palm, a.cap, a.midJoint, a.lowJoint]) if (p) p.traverse((o) => heldSet.add(o));
  if (instrument) {
    instrument.traverse((o) => heldSet.add(o));
    // the instrument's below-origin overhang (constant under translation) — used to clamp
    // its rest-lowering so its BOTTOM, not its origin, stops at the foot line.
    group.updateMatrixWorld(true);
    const ib = new THREE.Box3().setFromObject(instrument);
    if (!ib.isEmpty()) instBelow = Math.max(0, instrument.position.y - ib.min.y);
  }
  // the standing foot line over the BODY/LEGS only (arms + instrument excluded), measured
  // relative to the group origin but KEEPING the live groove tilt/bob — the body rocks about
  // the origin, swinging a corner below the flat line, so the plant must account for it. A
  // little TIME is swept so breathing cores, swaying tendrils + the sway extremes are all
  // caught at their lowest. The groove offset itself (group.position.y) is subtracted out.
  const _fbox = new THREE.Box3();
  function bodyFootLine() {
    group.updateMatrixWorld(true);
    let m = Infinity;
    group.traverse((o) => {
      if (!o.isMesh || !o.geometry || heldSet.has(o)) return;
      _fbox.setFromObject(o);
      if (!_fbox.isEmpty() && _fbox.min.y < m) m = _fbox.min.y;
    });
    return (m === Infinity ? group.position.y : m) - group.position.y;
  }
  let footLine = Infinity;
  // sample DENSELY over CLOCK: the groove ROLL (and the dancer's bigger sway) tilts the body
  // about the origin, swinging a bottom corner below the flat foot line — and that tilt is
  // driven by continuous time, not bar phase — so we advance clock across several sway
  // periods to catch the deepest tilt. barPhase steps through the bob=0 slots so the feet
  // stay at their planted lowest. Loud (max-amplitude) sway is the worst case for the dip.
  const FN = 48;
  for (let s = 0; s < FN; s++) {
    const bp = (s % 4) / 4;   // bob=0 phases hold the feet at their planted lowest
    if (isDancer) update(0.11, { barPhase: bp, playing: true, level: 1, loudness: 1, notes: [] });
    else update(0.11, { barPhase: bp, playing: true, level: 1, notes: [] });
    footLine = Math.min(footLine, bodyFootLine());
  }
  groundLocal = footLine;                       // held parts (arms/instrument) clamp to this line
  // seat the foot line at y ≈ 0: LOWER the rig when its feet sit above the origin (short legs)
  // or RAISE it when they sit below — either way the lowest foot rests ON the ground, never
  // floating (the old Math.max(0,…) could only raise, so above-origin feet stayed hovering).
  liftY = -footLine + H * 0.02;                 // + a hair of margin so feet rest ON, not through
  update(0, isDancer ? 0 : { barPhase: 0, playing: true, level: 1, notes: [] });   // final visible pose

  // headless accessors: the world-space foot line (floor proof) + this alien's OWN
  // colour scheme (individual-distinguishability proof).
  function footWorldY() {
    group.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(group).min.y;
  }
  const palette = {
    skin: skinMat.color.getHexString(),
    cloth: clothMat.color.getHexString(),
    accent: accentMat.color.getHexString(),
    instrument: instMainMat.color.getHexString(),   // Fix 2: bold complementary instrument colour
  };

  return { group, update, debug, faceDebug, facePlacement, limbProbe, jointProbe, bodySignature, coreInfo, strikerProbe, discProbe, materials, playStyle, hitsPerBeat, voice, plan, tentacleProof, palette, liftY, footWorldY };
}

export default { makeAlien };
