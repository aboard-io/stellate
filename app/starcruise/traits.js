// traits.js — the CREATIVE HEART of star-cruise. Derives a full, deterministic
// alien-band TRAITS object from a genre's 23-float feature vector.
//
// CONTRACT
//   traitsFromGenre(K, V, genreOrWeights, seed) -> TRAITS
//     K  = window.GenreKernel   (K.track(name,{seed}) -> state; K.mix(weights,{seed}))
//     V  = window.GenreVerifier (V.features(state) -> the 23-float vector)
//     genreOrWeights = a genre NAME (string) OR a weights array [{g,w},...]
//     seed = integer; same genre+seed -> identical TRAITS (determinism law)
//
//   TRAITS = { palette:{skin,cloth,accent},
//              body:{massH,height,limbs,eyes,segments,               // (original 5)
//                    bodyShape, armLength, eyeStalk, neck, antennae,  // (new morphology)
//                    crestType, asymmetry},
//              skin, cloth:{motif,coverage}, groove:{name,tempoBpm,bounce,sway,headbob,energy},
//              face:{mouth,brow,snout,teeth,mouthWide},              // (facial character)
//              texture,                                              // (procedural skin motif)
//              band:[ {role, instrument:{family,playStyle,appendage,hitsPerBeat}} ],
//              dancers, crowd, backdrop, glow }
//
// DETERMINISM: all randomness flows through a mulberry32 PRNG keyed by
// (genre-name-hash + seed). NO Math.random in trait logic — ever.
//
// MAPPING PHILOSOPHY (23 features -> a visibly distinct band):
//   The raw vector is NOT normalized 0..1 (bpm 48..219, drumDensity 0..3.06,
//   leadVoices 1..8, swing 0..0.34, ...). We normalize each feature into 0..1
//   through the observed catalog range table NR, then read the band + body +
//   groove off those normals. Every band member mirrors a REAL part of the
//   genre: a DRUMMER only if the genre actually has drums, PAD/drone players
//   when wash is high, extra LEADs when leadVoices is a section, extra PERC
//   when the kit is dense/interlocked. Instrument family + playStyle switch on
//   acoustic (organic horns/gut-strings vs chrome synths), so techno, jazz,
//   metal, ambient and bluegrass produce genuinely different ensembles.

// mulberry32 — tiny seeded PRNG. Same seed -> same stream.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// stable string hash for keying the PRNG off the genre name.
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// OBSERVED catalog ranges (min,max) for each of the 23 features, measured across
// all 249 genres at seed 1. Used to normalize the raw vector into 0..1 so the
// mapping below can reason in a single scale. (A feature at its catalog min
// reads as 0; at its max reads as 1.)
const NR = {
  bpm: [48, 219], offgrid: [0, 0.66], snareBalance: [0, 2.82], hatDensity: [0, 2.21],
  drumDensity: [0, 3.06], variation: [0, 1], wash: [0.01, 0.651], sub: [0.2, 1],
  motion: [0, 1], seventh: [0, 1], breakUse: [0, 0.63], chopUse: [0, 0.71],
  bedUse: [0.13, 1], crackle: [0, 0.677], pump: [0, 0.807], comp: [0, 0.817],
  swing: [0, 0.342], humanize: [0.012, 0.503], acoustic: [0, 1], rubato: [0, 0.047],
  leadVoices: [1, 8], softTop: [0, 1], interlock: [0, 0.477],
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
// clamp to an arbitrary [lo,hi] (used for the widened, non-0..1 morphology fields).
const clamp01Big = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
// gentle upper cap for post-fx params (also floors at 0): never let an effect become
// visual noise. traits emits post values ALREADY within these caps and postfx.js
// clamps to the SAME caps, so the live uniforms equal what we emit here.
const capTo = (x, hi) => (x < 0 ? 0 : x > hi ? hi : x);

// FEATURES: resolve the 23-float vector for a genre name OR a weights blend.
// Falls back to a neutral vector if the engine globals aren't ready (headless
// early-frame safety) so the scaffold never throws.
function featuresFor(K, V, genreOrWeights, seed) {
  const NEUTRAL = { bpm: 120, offgrid: 0.2, snareBalance: 0.5, hatDensity: 0.4, drumDensity: 0.5,
    variation: 0.4, wash: 0.3, sub: 0.4, motion: 0.4, seventh: 0.3, breakUse: 0.1, chopUse: 0.1,
    bedUse: 0.2, crackle: 0.2, pump: 0.3, comp: 0.4, swing: 0.2, humanize: 0.3, acoustic: 0.4,
    rubato: 0.2, leadVoices: 2, softTop: 0.4, interlock: 0.4 };
  try {
    if (!K || !V) return NEUTRAL;
    let state;
    if (typeof genreOrWeights === "string") state = K.track(genreOrWeights, { seed });
    else if (Array.isArray(genreOrWeights)) state = K.mix(genreOrWeights, { seed });
    if (!state) return NEUTRAL;
    return Object.assign({}, NEUTRAL, V.features(state));
  } catch (e) { return NEUTRAL; }
}

// STATE: resolve the FULL engine state (sections + voices) for a genre name OR a
// weights blend — the same state the audio engine renders. Used to read which
// musical VOICES are actually present so the band gets ONE alien per real part.
// Returns null on any failure (headless early-frame safety); presentVoices then
// falls back to a basic trio so the scaffold never throws.
function stateFor(K, genreOrWeights, seed) {
  try {
    if (!K) return null;
    if (typeof genreOrWeights === "string") return K.track(genreOrWeights, { seed });
    if (Array.isArray(genreOrWeights) && genreOrWeights.length) return K.mix(genreOrWeights, { seed });
  } catch (e) {}
  return null;
}

// presentVoices(state): which engine VOICES sound anywhere in the track. Read
// STRUCTURALLY off the sections (each turns voices on/off) so it matches what
// buildEvents will actually emit — the band mirrors the real parts. `perc` is the
// decorative percussion LANE (state.perc.lanes) which the engine only lays over
// sections that HAVE a kit, so it needs `drums` too. `found` is the sampled/vocal
// layer (a section's found/hits sourceId). Absent state -> a safe drums/bass/lead trio.
function presentVoices(state) {
  const V = { drums: false, perc: false, bass: false, melody: false, pad: false, found: false };
  if (!state || !Array.isArray(state.sections) || !state.sections.length)
    return { drums: true, perc: false, bass: true, melody: true, pad: true, found: false };
  for (const s of state.sections) {
    if (s.drums && s.drums !== "off") V.drums = true;
    if (s.bass && s.bass !== "off") V.bass = true;
    if ((s.melody && s.melody !== "off") || s.solo || s.counter) V.melody = true;
    if (s.pads) V.pad = true;
    if ((s.found && s.found.sourceId) || (s.hits && s.hits.sourceId)) V.found = true;
  }
  if (state.perc && Array.isArray(state.perc.lanes) && state.perc.lanes.length && V.drums) V.perc = true;
  return V;
}

// dominant genre name from a name or a weights array (for PRNG keying + label).
function dominantName(genreOrWeights) {
  if (typeof genreOrWeights === "string") return genreOrWeights;
  if (Array.isArray(genreOrWeights) && genreOrWeights.length) {
    let best = genreOrWeights[0];
    for (const w of genreOrWeights) if ((w.w || 0) > (best.w || 0)) best = w;
    return (best && best.g) || "genre";
  }
  return "genre";
}

// HSL helper -> {h,s,l}; the alien module reads these directly.
const hsl = (h, s, l) => ({ h: ((h % 360) + 360) % 360, s: clamp01(s), l: clamp01(l) });

export function traitsFromGenre(K, V, genreOrWeights, seed) {
  seed = (seed | 0) || 1;
  const name = dominantName(genreOrWeights);
  const f = featuresFor(K, V, genreOrWeights, seed);
  const st = stateFor(K, genreOrWeights, seed);   // the real engine state (voice presence)
  const rng = mulberry32((hashStr(name) ^ (seed * 0x9e3779b1)) >>> 0);

  // n(key) -> the feature normalized into 0..1 by its catalog range.
  const n = (k) => {
    const r = NR[k]; const v = f[k];
    if (r == null || typeof v !== "number") return 0.5;
    if (r[1] === r[0]) return 0.5;
    return clamp01((v - r[0]) / (r[1] - r[0]));
  };
  const bpm = f.bpm || 120;
  const acoustic = typeof f.acoustic === "number" ? f.acoustic : 0.5;
  // organic (living, acoustic-instrument aliens) vs electronic (chrome/synth).
  // The catalog's `acoustic` axis parks fully-electronic genres near 0 and
  // real-instrument genres near 0.8+; techno/house etc. sit mid (~0.6) yet read
  // electronic, so the split lives at 0.65 to keep synth genres on the chrome side.
  const organic = acoustic > 0.65;
  const nDrum = n("drumDensity"), nHat = n("hatDensity"), nSub = n("sub"),
        nWash = n("wash"), nMotion = n("motion"), nIl = n("interlock"),
        nSwing = n("swing"), nSeventh = n("seventh"), nVar = n("variation"),
        nPump = n("pump"), nCrackle = n("crackle"), nChop = n("chopUse"),
        nSoft = n("softTop"), nHum = n("humanize"), nBpm = n("bpm");
  const leadVoices = Math.max(1, Math.round(f.leadVoices || 1));

  // ---- PALETTE ---------------------------------------------------------
  // Acoustic genres warm (reds/ambers/greens ~20..150); electronic genres go
  // neon-cool (cyan/magenta/violet ~180..320). seventh adds harmonic tint,
  // motion adds iridescent drift, plus a little seeded jitter for individuality.
  const hueBase = organic ? 20 + nSeventh * 120 : 190 + nSeventh * 130;
  const hue = (hueBase + nMotion * 40 + rng() * 30) % 360;
  // Saturations run VIVID (skin .52..85, cloth .55..85, accent .9) on purpose: the
  // aliens agent shifts each band member's hue/shade off its own seed, and a washed-
  // out base would blur those offsets together. A saturated base keeps every member
  // (and every dancer) individually distinguishable while still reading as the genre.
  const palette = {
    skin: hsl(hue, 0.52 + nMotion * 0.33, organic ? 0.5 - nSub * 0.1 : 0.55 - nSub * 0.08),
    cloth: hsl((hue + 150 + rng() * 40) % 360, 0.55 + nVar * 0.3, 0.44 + nSoft * 0.14),
    accent: hsl((hue + 45) % 360, 0.9, 0.6 + nPump * 0.15),
  };

  // ---- SKIN MATERIAL ---------------------------------------------------
  // organic (living) vs chrome (robotic) vs glass (washy/ambient) vs matte
  // (dusty/crackly lofi). Drives shading + iridescence in alien.js.
  let skin;
  if (organic) skin = "organic";
  else if (nWash > 0.6) skin = "glass";
  else if (nCrackle > 0.45) skin = "matte";
  else skin = "chrome";

  // ---- SURFACE FLAVOR (Complaint 3: genuinely DIFFERENT materials) ------
  // A finer, ADDITIVE surface class alien.js reads to give aliens genuinely
  // different-feeling skins WITHOUT changing the tested `skin` enum. Organic
  // creatures split into FURRY (soft/swing), WAXY/wet (lush harmonic), STONY
  // (heavy/rough hide) or plain SOFT; electronic ones into CHROME (mirror),
  // GLASS (translucent jelly) or MATTE-plastic. Drives roughness/emissive +
  // the skin texture in alien.js so a furry folk beast, a chrome techno bot, a
  // glass ambient jelly and a stone doom-brute all clearly read as different
  // MATERIALS. Feature-derived (no rng draw) so it perturbs no earlier stream.
  let surface;
  if (organic) {
    if (nSub > 0.58 && nDrum > 0.5) surface = "stone";     // heavy acoustic -> rough hide/stone
    else if (nSeventh > 0.52 && nSoft > 0.45) surface = "wax"; // lush harmonic -> waxy/wet sheen
    else if (nSwing > 0.28 || nSoft > 0.55 || nHum > 0.5) surface = "fur"; // soft/swing -> furry
    else surface = "soft";                                 // plain matte flesh
  } else if (skin === "glass") surface = "glass";          // translucent jelly
  else if (skin === "chrome") surface = "chrome";          // polished mirror metal
  else surface = "plastic";                                // matte plastic shell

  // ---- BODY ------------------------------------------------------------
  // A genuinely-alien, feature-driven morphology. The five original fields are
  // kept (downstream + tests read them); seven MORPHOLOGY fields are added so the
  // silhouette varies wildly by genre. Every value flows from the normalized
  // feature vector (+ a little seeded jitter) so it is deterministic AND distinct.
  //
  //   massH     sub+drums  -> girth (heavy genres = big-bodied)          ~0.7..1.9
  //   height    slow/soft/low-sub -> TALL spindly, fast/heavy -> squat   ~1.0..3.7
  //   limbs     hats+interlock -> extra arms (busy players grow limbs)   2..6
  //   eyes      variation+seventh -> more eyes                           1..4
  //   segments  drumDensity -> torso segment count (segmented shape)     1..4
  //   bodyShape which TORSO primitive — heavy=triangle(wide-shoulder cone),
  //             glitchy=wedge(angular 3-side prism), tall+light=tower(spindly),
  //             washy/harmonic=blob(low-poly round), else segmented(box stack)
  //   armLength arm-bone length MULTIPLIER — motion/interlock/swing grow LONG
  //             arms; the IK contact scales with it so the beat-hit still lands  1.0..2.6
  //   eyeStalk  0..1 "stalkiness" — motion/variation push eyes onto eyestalks;
  //             electronic aliens get stalkier (< ~0.15 reads as flush eyes)
  //   neck      0..1 neck length — slow/washy/tower aliens crane tall necks
  //   antennae  head antennae count from hat density + seventh              0..3
  //   crestType head ridge — chop=spikes, washy=frill, driving=fin, else none
  //   asymmetry 0..1 limb lopsidedness (variation/chop) — offsets arm tiers/len
  const massH = 0.7 + nSub * 0.8 + nDrum * 0.4;            // ~0.7..1.9
  const height = clamp01Big(1.3 + (1 - nBpm) * 1.5 + nSoft * 0.5 - nSub * 0.35 + rng() * 0.4, 0.95, 3.8);
  const armLength = 1.0 + nMotion * 0.9 + nIl * 0.6 + nSwing * 0.3 + rng() * 0.25;   // ~1.0..2.6
  const tall = height > 2.4, light = massH < 1.1;
  let bodyShape;
  if (nWash > 0.5 && organic) bodyShape = "blob";
  else if (nChop > 0.38 || nCrackle > 0.45) bodyShape = "wedge";
  else if (tall && light) bodyShape = "tower";
  else if (nSub > 0.6 || nDrum > 0.7) bodyShape = "triangle";
  else if (nSeventh > 0.5) bodyShape = "blob";
  else bodyShape = "segmented";
  // SUPERQUADRIC exponents — the superellipsoid "squareness" of bodies + instruments,
  // fed to geom.superquadric() in alien.js so silhouettes morph box<->sphere<->pinched
  // organically by genre. Choppy/crackly/wedge genres go BOXY (low exponent, faceted);
  // washy/harmonic/organic genres go ROUND (~1); sub-heavy genres PINCH the profile
  // (>1, star/teardrop). Derived from feature NORMALS ONLY (no rng draw) so the trait
  // stream is unperturbed; alien.js jitters these per-alien off its OWN seed.
  const boxy = clamp01(nChop * 0.6 + nCrackle * 0.5 + (bodyShape === "wedge" ? 0.3 : 0));
  const roundNess = clamp01(0.5 + nWash * 0.4 + nSeventh * 0.3 + (organic ? 0.15 : 0) - boxy);
  const sqEx = +clamp01Big(0.28 + roundNess * 1.0 - boxy * 0.12, 0.16, 1.5).toFixed(3);
  const sqEy = +clamp01Big(0.3 + roundNess * 0.85 + nSub * 0.5, 0.16, 2.0).toFixed(3);
  // TENTACLE / curve-tube params — tip thinness (taper = tip/root radius) grows with
  // motion (whippy fast tentacles); curl grows with swing + wash (loose, curling limbs).
  const tentTaper = +clamp01Big(0.14 + nMotion * 0.26, 0.08, 0.5).toFixed(3);
  const tentCurl = +clamp01Big(0.15 + nSwing * 0.6 + nWash * 0.4, 0.05, 1.2).toFixed(3);
  const body = {
    massH,
    height,
    limbs: 2 + Math.round(nHat * 2 + nIl * 2),             // 2..6
    eyes: 1 + Math.round(nVar * 2 + nSeventh * 1),         // 1..4
    segments: 1 + Math.round(nDrum * 3),                   // 1..4
    bodyShape,
    sqEx, sqEy, tentTaper, tentCurl,                       // superquadric + curve-tube params
    armLength: +armLength.toFixed(4),
    eyeStalk: +clamp01(nMotion * 0.5 + nVar * 0.35 + (organic ? 0.05 : 0.25) + rng() * 0.15).toFixed(4),
    neck: +clamp01(0.08 + (1 - nBpm) * 0.5 + nWash * 0.35 + (bodyShape === "tower" ? 0.3 : 0)).toFixed(4),
    antennae: Math.max(0, Math.min(3, Math.round(nHat * 1.5 + nSeventh * 1.0 + (organic ? 0 : 0.5)))),
    crestType: nChop > 0.4 ? "spikes" : nWash > 0.45 ? "frill" : (nBpm > 0.6 || nDrum > 0.6) ? "fin" : "none",
    asymmetry: +clamp01(nVar * 0.5 + nChop * 0.4 + rng() * 0.2).toFixed(4),
  };

  // ---- BODY PLAN (the SPECIES) -----------------------------------------
  // The 23-vector decides the whole BODY PLAN so genres read as different
  // SPECIES, not a biped-with-extras. Seven plans compete on feature-affinity
  // scores; the argmax (with a tiny seeded tiebreak) wins, then symmetry + the
  // appendage budget (arms / legs / tentacles / cilia) follow from the plan +
  // features. Every original body field above stays intact + same-shaped (the
  // legacy rig reads them); the new rig reads plan/symmetry/arms/legs/tentacles/
  // face. Deterministic — the only randomness is the seeded tiebreak draw.
  //   floating-gas  washy + soft + no kit (ambient/drone) — a jelly of cilia
  //   radial        interlocked + hats + pump (techno/idm) — N-fold spokes
  //   crystalline   choppy + crackly electronic (glitch) — faceted shards
  //   insectoid     swinging acoustic (jazz/folk) — segmented, many legs, mandibles
  //   cephalopod    high-motion washy — a tentacled floating head
  //   amorphous     sub-heavy dense kit (metal/dub) — a pseudopod blob
  //   stalk         slow / tall / light — a spindly single-stalk cluster
  const planScores = {
    "floating-gas": nWash * 1.25 + nSoft * 0.5 + (1 - nDrum) * 0.6 + (organic ? 0 : 0.18),
    radial: nIl * 1.15 + nHat * 0.6 + nPump * 0.4 + (organic ? 0 : 0.3),
    crystalline: nChop * 1.2 + nCrackle * 0.85 + (organic ? 0 : 0.25),
    insectoid: nSwing * 1.0 + (organic ? 0.6 : 0) + nSeventh * 0.4 + nHat * 0.3,
    cephalopod: nMotion * 0.95 + nWash * 0.45 + nSwing * 0.3,
    amorphous: nSub * 1.0 + nDrum * 0.6 + (1 - nVar) * 0.3,
    stalk: (1 - nBpm) * 0.85 + nSoft * 0.6 + (massH < 1.1 ? 0.4 : 0) + (height > 2.4 ? 0.3 : 0),
  };
  let plan = "amorphous", planBest = -Infinity;
  for (const p of Object.keys(planScores)) {
    const sc = planScores[p] + rng() * 0.14;   // seeded tiebreak keeps genres spread across plans
    if (sc > planBest) { planBest = sc; plan = p; }
  }
  // SYMMETRY — radial/crystalline/gas fan out N-fold; everything else bilateral/blobby.
  let symmetry;
  if (plan === "radial") symmetry = 3 + Math.round(nIl * 3 + nHat * 2);
  else if (plan === "crystalline") symmetry = 4 + Math.round(nChop * 3);
  else if (plan === "floating-gas") symmetry = 3 + Math.round(nWash * 4);
  else if (plan === "cephalopod" || plan === "amorphous") symmetry = 1;
  else symmetry = 2;
  symmetry = Math.max(1, Math.min(8, symmetry));
  // APPENDAGE BUDGET — arms (play + hold), legs (stance), tentacles/cilia (sway).
  let arms = 0, legs = 0, tentacles = 0;
  if (plan === "radial") { arms = symmetry; legs = nSub > 0.5 ? symmetry : 0; }
  else if (plan === "crystalline") { arms = symmetry; legs = 0; }
  else if (plan === "floating-gas") { tentacles = 3 + Math.round(nWash * 3); arms = 0; }
  else if (plan === "cephalopod") { tentacles = 4 + Math.round(nMotion * 4); arms = 0; }
  else if (plan === "insectoid") { legs = nDrum > 0.6 ? 6 : 4; arms = 2; }
  else if (plan === "amorphous") { tentacles = 2 + Math.round(nDrum * 2); arms = Math.round(nMotion); }
  else { arms = 2; legs = 1; }   // stalk
  arms = Math.max(0, Math.min(8, arms));
  legs = Math.max(0, Math.min(8, legs));
  tentacles = Math.max(0, Math.min(8, tentacles));
  if (arms + tentacles === 0) arms = 2;   // guarantee at least one PLAYING appendage
  // FACE FAMILY — ridiculous to menacing: one giant eye, a ring of eyes, a no-face
  // maw, or insect mandibles. Reads the eye count + plan + character.
  let faceFamily;
  if (body.eyes >= 4) faceFamily = "eye-ring";
  else if (plan === "insectoid") faceFamily = "mandibles";
  else if (body.eyes === 1) faceFamily = (nSub > 0.55 || nDrum > 0.7) ? "cyclops-maw" : "cyclops";
  else if (organic && nSwing > 0.3) faceFamily = "beak-cluster";
  else if (!organic && (nChop > 0.35 || nCrackle > 0.4)) faceFamily = "sensor-array";
  else faceFamily = "maw";
  body.plan = plan;
  body.symmetry = symmetry;
  body.arms = arms;
  body.legs = legs;
  body.tentacles = tentacles;
  // the new rig reads body.face for the FACE family; traits.face (below) keeps its
  // full existing shape (+ the same family echoed) so the legacy rig is untouched.
  body.face = { family: faceFamily, eyes: body.eyes };

  // ---- ARCHETYPE (Complaint 2: DOGS / DRAGONS / PEOPLE / ROBOTS) --------
  // The 7 `plan` values above stay the LOW-LEVEL silhouette contract (tests +
  // the face-seating rig read them). ON TOP we derive a RECOGNIZABLE creature
  // ARCHETYPE — the Spore/Pokémon read — that alien.js uses to attach species
  // GEAR (horns, ears, wings, tail, dorsal fins, antennae) + choose a STANCE
  // (upright biped / horizontal quadruped / floating jelly / boxy bot / radial
  // star / tentacled mollusk). Nine archetypes compete on feature affinity; the
  // argmax wins (NO rng draw — pure feature normals, so it is deterministic and
  // perturbs no earlier trait stream). This is what makes heavy-metal read as a
  // horned DRAGON, jazz as a four-legged BEAST, techno as a chrome BOT, ambient
  // as a floating JELLY, vaporwave as a drifting MOLLUSK — obviously different
  // SPECIES at a glance, not one biped-with-extras on every planet.
  //   draconic   heavy + harmonic + fast          — winged, horned, spiny, tailed
  //   quadruped  swinging organic mid-groove       — four legs, ears, snout, tail
  //   biped      melodic / vocal / tall            — upright, two legs, head on top
  //   bot        electronic + choppy/glitchy       — boxy, antennae, stiff, sensor
  //   mollusk    high-motion washy                 — tall mantle + curling tentacles
  //   jelly      washy soft no-kit                 — floating translucent bell + cilia
  //   star       interlocked radial                — N-fold spoked star
  //   crawler    swing acoustic dense kit          — long low body, many legs
  //   blobby     sub-heavy dense low-variation     — squat amorphous pseudopod mass
  const archScores = {
    draconic: nSub * 0.85 + nDrum * 0.5 + nBpm * 0.55 + nSeventh * 0.45 + (organic ? 0.12 : 0) - nSwing * 0.55 - nWash * 0.45,
    quadruped: nSwing * 0.85 + (organic ? 0.72 : 0) + nHum * 0.3 + 0.32 - nWash * 0.5 - nSub * 0.25 - (height > 2.6 ? 0.4 : 0),
    biped: (height > 2.4 ? 0.7 : 0) + nSoft * 0.55 + (leadVoices >= 3 ? 0.5 : 0) + nSeventh * 0.28 + (organic ? 0.18 : 0.08) - nDrum * 0.3 - nSub * 0.2,
    bot: (organic ? 0 : 0.68) + nChop * 0.7 + nCrackle * 0.5 + nIl * 0.42 - nWash * 0.45,
    mollusk: nMotion * 0.9 + nWash * 0.45 + (organic ? 0 : 0.12) + nSwing * 0.2 - nDrum * 0.25 - (nWash > 0.55 && nDrum < 0.4 ? 0 : 0.15),
    jelly: nWash * 1.05 + nSoft * 0.5 + (1 - nDrum) * 0.7 + (nDrum < 0.2 ? 0.6 : 0) + (organic ? 0.1 : 0.2),
    star: nIl * 1.0 + nHat * 0.5 + nPump * 0.4 + (organic ? 0 : 0.28),
    crawler: nSwing * 0.55 + (organic ? 0.48 : 0) + nHat * 0.4 + nDrum * 0.45,
    blobby: nSub * 0.85 + nDrum * 0.45 + (1 - nVar) * 0.32 + (1 - nBpm) * 0.35,
  };
  // ---- EARTH-ANIMAL ARCHETYPE (make the aliens read as CUTE, RECOGNIZABLE EARTH ANIMALS) --
  // On TOP of the alien `plan` + gear we resolve the creature to a recognizable EARTH ANIMAL
  // — dog / dino / gator / robot / human — so different genres show OBVIOUSLY different animals
  // (kept charming + a little alien: extra eyes, antennae, odd palettes, a glowing tail-tip).
  // Five earth archetypes compete on feature affinity; the argmax wins (NO rng draw — pure
  // feature normals, deterministic, perturbs no earlier trait stream). The nine older alien
  // archetypes stay as FALLBACKS: they win only in the extreme corners the five don't cover
  // (a pure ambient drone still reads as a floating JELLY) — held at a DISCOUNT below.
  //   dog    swinging organic mid-groove, plain harmony  — 4 legs, floppy ears, snout, waggy tail
  //   dino   heavy + fast + hard kit                     — upright, big jaws, heavy tail, tiny arms
  //   gator  sub-heavy + SLOW + dense low (dub/swamp)     — low long body, long toothy snout, ridged back
  //   robot  electronic + choppy / interlocked           — boxy, antenna, plated, one glowing eye
  //   human  melodic / vocal / harmonic / soft / tall    — upright, rounded head, friendly face
  // alien.js keys a dedicated EARTH-BODY build off the archetype; to keep the low-level `plan`
  // silhouette CONTRACT intact (tests force + read `plan`), each earth archetype PINS body.plan
  // to a canonical home plan — a tall STALK for the upright bipeds, a long low INSECTOID for the
  // horizontal quadrupeds — so the stance reads right AND forced-plan tests (which set a
  // DIFFERENT plan) still fall through to the alien plan build.
  const earthScores = {
    dog:   (organic ? 0.5 : 0.1) + nHum * 0.6 + nSwing * 0.4 + 0.3 - nDrum * 0.35 - nSub * 0.3 - nChop * 0.4 - (nBpm > 0.75 ? 0.3 : 0),
    dino:  0.1 + nDrum * 0.5 + nBpm * 0.45 + (1 - nSwing) * 0.35 + (1 - nSoft) * 0.3 - nWash * 0.3 - nSub * 0.2 - nHum * 0.35,
    gator: 0.1 + nSub * 0.7 + (1 - nBpm) * 0.5 - nSwing * 0.2 - nDrum * 0.1,
    robot: (organic ? 0 : 0.5) + nChop * 0.6 + nPump * 0.45 + nIl * 0.4 + nCrackle * 0.35 + nWash * 0.3 - nSwing * 0.2,
    human: nSoft * 0.6 + nSwing * 0.45 + (leadVoices >= 2 ? 0.35 : 0) + nHum * 0.3 + (organic ? 0.15 : 0.08) - nSub * 0.3 - nDrum * 0.2 - nChop * 0.3,
  };
  let archetype = "human", archBest = -Infinity;
  for (const a of Object.keys(earthScores)) if (earthScores[a] > archBest) { archBest = earthScores[a]; archetype = a; }
  // legacy alien archetypes only win when they clearly BEAT the best earth animal (fallback).
  for (const a of Object.keys(archScores)) if (archScores[a] - 0.85 > archBest) { archBest = archScores[a] - 0.85; archetype = a; }
  const EARTH_HOME = { dog: "insectoid", gator: "insectoid", dino: "stalk", human: "stalk", robot: "stalk" };
  body.archetype = archetype;
  if (EARTH_HOME[archetype]) body.plan = EARTH_HOME[archetype];   // pin the home plan (stance reads right; plan stays canonical)
  // a small feature-derived GEAR budget the rig reads (0..1 knobs; no rng draw):
  body.horniness = +clamp01(nSub * 0.5 + nSeventh * 0.4 + (archetype === "draconic" ? 0.4 : 0)).toFixed(3);
  body.winged = archetype === "draconic" || (archetype === "mollusk" && nMotion > 0.6);
  body.tailed = archetype === "draconic" || archetype === "quadruped" || archetype === "crawler" ||
    archetype === "dog" || archetype === "dino" || archetype === "gator";
  body.eared = archetype === "quadruped" || archetype === "dog";
  body.surface = surface;

  // ---- CLOTH -----------------------------------------------------------
  // motif reads the rhythmic character; coverage from softTop/wash (soft, washy
  // genres wear more flowing cloth; hard percussive genres go bare/armored).
  const motif = nChop > 0.35 ? "glitch" : nSwing > 0.4 ? "stripe" : nIl > 0.5 ? "grid"
    : nSeventh > 0.6 ? "dot" : "solid";
  const cloth = { motif, coverage: clamp01(0.25 + nSoft * 0.5 + nWash * 0.3) };

  // ---- FACE ------------------------------------------------------------
  // Genre-driven facial character. The head gains a real face in alien.js — a
  // mouth that opens on the beat (lead/vocalist widest), a brow ridge, and a
  // snout/nostrils/vents — all keyed off the rhythmic + harmonic character so a
  // swing-jazz face (beak, soft brow) differs from a glitch-techno face (grille,
  // angular brow, vents). Every field is a small enum -> a cheap primitive.
  //   mouth  swing->beak, organic->maw (fleshy jaw), electronic->grille (bars)
  //   brow   chop/glitch->angular (V), washy->soft, else ridge
  //   snout  heavy organic->snout, other organic->nostrils, electronic->vents
  //   teeth  aggressive/dense genres bare fangs
  //   mouthWide resting gape scale, grows with energy (louder = bigger maw)
  const face = {
    family: faceFamily,   // the SPECIES face family (echoed from body.face for the new rig)
    mouth: nSwing > 0.3 ? "beak" : organic ? "maw" : "grille",
    brow: (nChop > 0.35 || nCrackle > 0.45) ? "angular" : nWash > 0.45 ? "soft" : "ridge",
    snout: organic ? (nSub > 0.55 ? "snout" : "nostrils") : "vents",
    teeth: (nChop > 0.4 || nDrum > 0.7 || (nBpm > 0.7 && !organic)),
    mouthWide: +clamp01(0.3 + nBpm * 0.35 + nDrum * 0.2 + rng() * 0.1).toFixed(4),
  };

  // ---- TEXTURE ---------------------------------------------------------
  // The procedural skin motif alien.js bakes into a tiny CanvasTexture (small +
  // reused across the alien's surfaces). Reads the rhythmic character so surfaces
  // aren't flat: static/glitch noise for choppy sampled genres, stripes for swing,
  // scales for interlocked grooves, spots for harmonic genres, a value gradient for
  // washy pads, else a subtle plate.
  const texture = nChop > 0.35 ? "static" : nSwing > 0.4 ? "stripe" : nIl > 0.5 ? "scale"
    : nSeventh > 0.5 ? "spot" : nWash > 0.5 ? "gradient" : "plate";

  // ---- GROOVE ----------------------------------------------------------
  // tempo drives limb speed; pump+sub -> vertical bounce; swing+humanize+rubato
  // -> loose lateral sway; motion+drums -> headbob; overall energy from tempo,
  // density and variation. These feed the whole-body groove in alien.js.
  const groove = {
    name: name + "-groove",
    tempoBpm: bpm,
    bounce: clamp01(nPump * 0.6 + nSub * 0.4 + nDrum * 0.2),
    sway: clamp01(nSwing * 0.7 + nHum * 0.4 + n("rubato") * 0.3),
    headbob: clamp01(0.2 + nMotion * 0.5 + nDrum * 0.3),
    energy: clamp01(0.2 + nBpm * 0.4 + nDrum * 0.3 + nVar * 0.2),
  };

  // ---- BAND: ONE ALIEN PER ACTIVE VOICE --------------------------------
  // The band mirrors the track's ACTUAL parts — one alien "in charge" of EACH
  // musical VOICE present in the resolved state (drums, perc, bass, lead/melody,
  // pad, found). Presence is read structurally from the sections (presentVoices)
  // so it matches what the engine renders; the controller then feeds each member
  // its voice's real per-bar note ONSETS (ctx.notes) and it plays THOSE — resting
  // when the voice is silent/quiet. Each member keeps the legacy {role, instrument
  // {family, playStyle, appendage, hitsPerBeat}} shape (downstream + the fallback
  // beat-path read it) AND carries `voice` = the engine voice id the score-bridge
  // buckets events by. Instrument FAMILIES are INVENTED alien forms (membrane-sacs,
  // coiled resonators, crystal chime-clusters, tendril-harps, bladder-horns) — never
  // realistic drums/guitars; playStyle stays in the known set (strike/drum/pluck/
  // bow/blow) so the playing appendage still lands on the instrument. Capped 8 (mobile).
  const present = presentVoices(st);
  const band = [];
  const CAP = 8;                                   // mobile draw-call ceiling
  const appAll = Math.max(1, arms + tentacles);    // playing-appendage budget

  // DRUMS — a pulsing membrane-sac (acoustic) or a glitch-pod / pulse-bladder (electronic).
  if (present.drums) {
    let family, playStyle;
    if (organic && nSwing > 0.35) { family = "hide-sac"; playStyle = "strike"; }
    else if (organic) { family = "membrane-sac"; playStyle = "drum"; }
    else if (nCrackle > 0.35 || nChop > 0.35) { family = "glitch-pod"; playStyle = "strike"; }
    else { family = "pulse-bladder"; playStyle = "drum"; }
    band.push({ role: "drum", voice: "drums", instrument: {
      family, playStyle, appendage: 0,
      hitsPerBeat: Math.max(1, Math.min(6, Math.round(1.5 + nDrum * 3.5))),
    } });
  }

  // PERC — the decorative percussion lane: seed-rattle (organic) / crystal chime-cluster.
  if (present.perc) {
    band.push({ role: "perc", voice: "perc", instrument: {
      family: organic ? "seed-rattle" : "chime-cluster", playStyle: "strike", appendage: 0,
      hitsPerBeat: Math.max(2, Math.min(4, Math.round(1 + nHat * 3))),
    } });
  }

  // BASS — a coiled-gut resonator (bowed when jazzy) or a fat sub/drone bladder-coil.
  if (present.bass) {
    let family, playStyle;
    if (organic) { family = "coiled-gut"; playStyle = nSwing > 0.4 || n("rubato") > 0.5 ? "bow" : "pluck"; }
    else if (nSub > 0.7) { family = "sub-bladder"; playStyle = "pluck"; }
    else { family = "drone-coil"; playStyle = "pluck"; }
    band.push({ role: "bass", voice: "bass", instrument: {
      family, playStyle, appendage: 1, hitsPerBeat: nIl > 0.5 ? 2 : 1,
    } });
  }

  // LEAD (engine voice `melody`) — bladder-horn (blown), tendril-harp (plucked),
  // shimmer-frond (bowed wash), bloop-anemone (plucked motion) or neon-stinger.
  if (present.melody) {
    let family, playStyle;
    if (organic) {
      if (nSwing > 0.12) { family = "bladder-horn"; playStyle = "blow"; }
      else { family = "tendril-harp"; playStyle = "pluck"; }
    } else if (nWash > 0.4) { family = "shimmer-frond"; playStyle = "bow"; }
    else if (nMotion > 0.5) { family = "bloop-anemone"; playStyle = "pluck"; }
    else { family = "neon-stinger"; playStyle = "strike"; }
    band.push({ role: "lead", voice: "melody", instrument: {
      family, playStyle, appendage: 2,
      hitsPerBeat: Math.max(1, Math.min(3, Math.round(1 + nMotion * 2))),
    } });
  }

  // PAD / DRONE — a sustained reed-lung (organic) or a bowed gas-veil (electronic).
  if (present.pad) {
    band.push({ role: "pad", voice: "pad", instrument: {
      family: organic ? "reed-lung" : "gas-veil", playStyle: organic ? "blow" : "bow",
      appendage: 3, hitsPerBeat: 1,
    } });
  }

  // FOUND — the sampled/vocal layer: a struck voice-polyp (organic) / echo-conch.
  if (present.found) {
    band.push({ role: "found", voice: "found", instrument: {
      family: organic ? "voice-polyp" : "echo-conch", playStyle: "strike", appendage: 1, hitsPerBeat: 1,
    } });
  }

  // Guarantee at least one player, then trim to the mobile crowd cap.
  if (band.length === 0) {
    band.push({ role: "lead", voice: "melody", instrument: { family: "tendril-harp", playStyle: "pluck", appendage: 2, hitsPerBeat: 1 } });
  }
  if (band.length > CAP) band.length = CAP;

  // Clamp each appendage into the actual playing-appendage budget so the rig never
  // indexes a missing limb.
  for (const m of band) m.instrument.appendage = ((m.instrument.appendage % appAll) + appAll) % appAll;

  // ---- BACKDROP / GLOW -------------------------------------------------
  // Calm, acoustic genres greet you on FARMS (crop rows, silos); aggressive,
  // percussive, or electronic genres on CITY skylines. Farms require a living
  // band AND genuinely low overall energy (folk ballads, sparse country), so
  // metal, bebop and other high-energy acoustic genres stay in the city. Glow
  // tracks wash + crackle neon.
  const backdrop = organic && groove.energy < 0.45 ? "farm" : "city";
  const glow = clamp01(nWash * 0.7 + nCrackle * 0.3 + (organic ? 0 : 0.15));

  // ---- DANCERS (OPTIONAL, energy/kit-GATED) ----------------------------
  // Extra background dancers (no instrument) the CONTROLLER arranges around/behind
  // the band. A dance floor forms ONLY when there is genuine party energy AND a kit
  // driving it: hushed, sparse, or drumless genres (ambient/drone, quiet folk) are
  // JUST THE BAND — zero dancers, and the controller skips spawning a crowd. Louder
  // driving genres scale up a floor. Mobile-capped 8; deterministic (feature-derived,
  // no rng draw) so the same genre always decides the same way.
  let dancers;
  if (!present.drums || groove.energy < 0.45) dancers = 0;
  else dancers = Math.max(2, Math.min(8, Math.round(groove.energy * 5.5 + nHat * 1.5)));

  // ---- RENDERSTYLE -----------------------------------------------------
  // Give each genre its own VISUAL LANGUAGE: the whole screen renders differently.
  // A small set of feature "archetype" scalars is read off the SAME normalized
  // vector, then the fixed-shape renderStyle contract (post-fx bag + surface
  // material) is derived from them. Deterministic (only the seeded rng jitter);
  // computed LAST so it never perturbs any earlier trait's rng draws.
  //
  //   lofi     crackle/vinyl grit          -> heavy dither + scanlines + curve
  //   driving  dense, fast, pumped kit      -> onebit + low posterize + hard grade
  //   washy    sustained pad wash           -> bloom + soft posterize + no dither
  //   harmonic seventh-rich colour          -> aberration + iridescence (with wash)
  //   vapor    electronic + washy + harmonic-> magenta/cyan grade + bloom + aberration
  //   metal    acoustic + hard + fast kit   -> grain vignette + wireframe/glitch
  //   warm     organic (acoustic) surfaces  -> amber grade + halftone (with swing)
  const lofi = nCrackle;
  const driving = clamp01(nDrum * 0.5 + nBpm * 0.4 + nPump * 0.3);
  const washy = nWash;
  const harmonic = nSeventh;
  const vapor = organic ? 0 : clamp01(nWash * nSeventh * 2.4);
  const metal = organic ? clamp01(nDrum * 0.55 + nBpm * 0.45 - nSwing * 0.7) : 0;
  const j = (a) => (rng() - 0.5) * a;   // small deterministic jitter

  // dither: gentle ORDERED grit as the default; clean washy pads get NONE. The old
  // hard 1-bit ('onebit') crunch is DROPPED — it destroyed legibility (cap law: max
  // crunch is out). Genres still differ through the continuous post fields below.
  const dither = (washy > 0.5 && nDrum < 0.45) ? "none" : "ordered";

  // posterize: driving/lofi crush the palette (low step count = harsh); washy/soft
  // genres keep a smooth ramp (high step count). Contract range 2..16.
  const smooth = clamp01(0.42 + washy * 0.55 + nSoft * 0.35 - driving * 0.55 - lofi * 0.35);
  // FLOORED at 6 steps — a gentle band, never a crushed <6-step palette (cap law).
  const posterize = Math.max(6, Math.min(16, Math.round(2 + smooth * 14)));

  // per-channel colour grade: organic = warm amber (r up, b down); vaporwave =
  // magenta/cyan (r+b up, g down); hard electronica = cool high-contrast.
  const grade = [
    +(1 + (organic ? 0.14 + nSwing * 0.09 : -0.03) + vapor * 0.18).toFixed(3),
    +(1 + (organic ? 0.02 : -0.02) - vapor * 0.12 - lofi * 0.05).toFixed(3),
    +(1 - (organic ? 0.12 + nCrackle * 0.07 : -0.10) + vapor * 0.16).toFixed(3),
  ];

  // Every effect is held to a GENTLE cap (capTo) so no genre is ever over-processed
  // into noise — a light grade + soft treatment only. postfx.js clamps to the SAME
  // caps, so the live uniforms equal these emitted values (RS integration stays exact).
  const post = {
    dither,
    scanlines: +capTo(lofi * 0.85 + (!organic && driving > 0.6 ? 0.18 : 0) + j(0.05), 0.25).toFixed(3),
    aberration: +capTo(vapor * 0.7 + harmonic * 0.15 * (organic ? 0 : 1) + nMotion * 0.12 * (organic ? 0 : 1) + j(0.04), 0.22).toFixed(3),
    halftone: +capTo(nSwing * 0.8 * (organic ? 1 : 0.35) + (organic ? harmonic * 0.2 : 0), 0.28).toFixed(3),
    bloom: +capTo(washy * 0.7 + nSoft * 0.3 + vapor * 0.3 + glow * 0.2 + j(0.05), 0.5).toFixed(3),
    posterize,
    grade,
    vignette: +capTo(metal * 0.6 + lofi * 0.3 + driving * 0.12 + j(0.04), 0.35).toFixed(3),
    curvature: +capTo(lofi * 0.6, 0.15).toFixed(3),
  };

  // material (surface treatment) — the READABLE VOCAB ONLY: flat / matte / cel /
  // SUBTLE pbr / SUBTLE iridescent. wireframe, pure-mesh and the harsh glitch shader
  // are DROPPED (they were illegible); the genres that used to get them fall through
  // to the nearest readable surface — hard acoustic (metal) -> matte, choppy driving
  // electronica -> flat. Genres still differ, you can just always clearly SEE them.
  //   pbr = a genuine MeshStandardMaterial (metalness/roughness + the shared env map) so
  //   SOME genres render as real polished metal / glass — VECTOR-SELECTED, never global.
  //   Chrome + driving but NOT vapor/lofi -> polished chrome; glassy + washy but NOT
  //   harmonic-iridescent -> real glass. vapor -> iridescent (kept subtle in alien.js).
  const chromeLean = skin === "chrome" && !organic && driving > 0.4 && vapor < 0.35 && lofi < 0.4;
  const glassLean = skin === "glass" && !organic && washy > 0.55 && harmonic < 0.35 && vapor < 0.35;
  let material;
  if (chromeLean || glassLean) material = "pbr";                        // subtle real chrome/glass
  else if (metal > 0.42) material = "matte";                           // was wireframe/glitch
  else if (!organic && driving > 0.5 && washy < 0.5) material = "flat"; // was glitch/flat
  else if (vapor > 0.4) material = "iridescent";                       // subtle iridescent
  else if (washy > 0.5 && nDrum < 0.45) material = harmonic > 0.4 ? "iridescent" : "cel";
  else if (organic && nSwing > 0.3) material = "matte";
  else if (lofi > 0.45) material = "matte";
  else material = "cel";

  const renderStyle = { post, material };

  // ---- FACE PERSONALITY (genre-level bias for the animated face rig) ----------------
  // A small, drift-free bias the alien face rig reads to tilt a whole SPECIES' face
  // behaviour (alien.js then adds per-INDIVIDUAL variation off each alien's own seed):
  //   expressive  motion/variation -> livelier faces (bigger gaze/brow/mouth swings)
  //   blink       tempo -> faster genres blink more often
  //   restless    motion/hats -> more darting, shorter-held gaze
  //   browMob     angular brows + a driving kit -> mobile, emotive brows
  //   restMouth   swing -> a slightly open resting mouth (a crooning idle)
  // Computed from feature NORMALS ONLY (NO rng draw) so it perturbs no earlier trait
  // stream and stays byte-identical on re-derivation — additive to the traits object.
  const personality = {
    expressive: +clamp01(0.4 + nMotion * 0.4 + nVar * 0.3).toFixed(3),
    blink: +clamp01(0.3 + nBpm * 0.5).toFixed(3),
    restless: +clamp01(0.3 + nMotion * 0.5 + nHat * 0.3).toFixed(3),
    browMob: +clamp01(0.3 + (face.brow === "angular" ? 0.5 : face.brow === "soft" ? 0.1 : 0.3) + nDrum * 0.3).toFixed(3),
    restMouth: +clamp01(0.02 + nSwing * 0.2).toFixed(3),
  };

  return {
    palette, body, skin, surface, cloth, groove, face, texture, band,
    dancers,
    crowd: band.length,
    backdrop, glow, renderStyle, personality,
    // echo the raw vector + name for downstream tuning / docs verification.
    _features: f, _genre: name,
  };
}

export default { traitsFromGenre, mulberry32 };
