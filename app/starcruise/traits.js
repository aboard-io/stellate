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
  const palette = {
    skin: hsl(hue, 0.35 + nMotion * 0.4, organic ? 0.5 - nSub * 0.12 : 0.55 - nSub * 0.1),
    cloth: hsl((hue + 150 + rng() * 40) % 360, 0.45 + nVar * 0.3, 0.42 + nSoft * 0.15),
    accent: hsl((hue + 45) % 360, 0.85, 0.6 + nPump * 0.15),
  };

  // ---- SKIN MATERIAL ---------------------------------------------------
  // organic (living) vs chrome (robotic) vs glass (washy/ambient) vs matte
  // (dusty/crackly lofi). Drives shading + iridescence in alien.js.
  let skin;
  if (organic) skin = "organic";
  else if (nWash > 0.6) skin = "glass";
  else if (nCrackle > 0.45) skin = "matte";
  else skin = "chrome";

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
  const body = {
    massH,
    height,
    limbs: 2 + Math.round(nHat * 2 + nIl * 2),             // 2..6
    eyes: 1 + Math.round(nVar * 2 + nSeventh * 1),         // 1..4
    segments: 1 + Math.round(nDrum * 3),                   // 1..4
    bodyShape,
    armLength: +armLength.toFixed(4),
    eyeStalk: +clamp01(nMotion * 0.5 + nVar * 0.35 + (organic ? 0.05 : 0.25) + rng() * 0.15).toFixed(4),
    neck: +clamp01(0.08 + (1 - nBpm) * 0.5 + nWash * 0.35 + (bodyShape === "tower" ? 0.3 : 0)).toFixed(4),
    antennae: Math.max(0, Math.min(3, Math.round(nHat * 1.5 + nSeventh * 1.0 + (organic ? 0 : 0.5)))),
    crestType: nChop > 0.4 ? "spikes" : nWash > 0.45 ? "frill" : (nBpm > 0.6 || nDrum > 0.6) ? "fin" : "none",
    asymmetry: +clamp01(nVar * 0.5 + nChop * 0.4 + rng() * 0.2).toFixed(4),
  };

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

  // ---- BAND ------------------------------------------------------------
  // Mirror the genre's ACTUAL parts. Each member is one alien; hitsPerBeat is how
  // many contacts land per beat (drums busy, pads sustained). appendage picks the
  // limb that strikes/plucks/bows/blows the invented instrument. Members are
  // pushed in importance order, then trimmed to a mobile crowd cap.
  const band = [];
  const CAP = 6;                                   // mobile draw-call ceiling

  // DRUMMER — only if the genre actually has a kit (drumDensity above the floor).
  if (f.drumDensity > 0.15) {
    let family, playStyle;
    if (organic && nSwing > 0.35) { family = "brushpan"; playStyle = "strike"; }   // brushed jazz kit
    else if (organic) { family = "skindrum"; playStyle = "drum"; }                 // acoustic kit
    else if (nCrackle > 0.35 || nChop > 0.35) { family = "glitchpad"; playStyle = "strike"; } // sampled/glitch
    else { family = "thumpdrum"; playStyle = "drum"; }                             // electronic kit
    band.push({ role: "drum", instrument: {
      family, playStyle, appendage: 0,
      hitsPerBeat: Math.max(1, Math.min(6, Math.round(1.5 + nDrum * 3.5))),
    } });
  }

  // BASSIST — the low end. Gut-string upright (bowed when jazzy) for acoustic;
  // fat synth/sub for electronic. Walks (2/beat) when interlock is high.
  {
    let family, playStyle;
    if (organic) { family = "gutstring"; playStyle = nSwing > 0.4 || n("rubato") > 0.5 ? "bow" : "pluck"; }
    else if (nSub > 0.7) { family = "subwomp"; playStyle = "pluck"; }
    else { family = "synthbass"; playStyle = "pluck"; }
    band.push({ role: "bass", instrument: {
      family, playStyle, appendage: 1,
      hitsPerBeat: nIl > 0.5 ? 2 : 1,
    } });
  }

  // LEAD — the melodic voice(s). Horns (blow) for swinging acoustic, twang-strings
  // (pluck) for folky acoustic, glassy/neon synths for electronic. A big leadVoices
  // count spawns a small SECTION (extra lead members) up to the cap.
  {
    let family, playStyle;
    if (organic) {
      if (nSwing > 0.12) { family = "wailhorn"; playStyle = "blow"; }
      else { family = "twangstring"; playStyle = "pluck"; }
    } else if (nWash > 0.4) { family = "shimmerlead"; playStyle = "bow"; }
    else if (nMotion > 0.5) { family = "bloopharp"; playStyle = "pluck"; }
    else { family = "neonsquare"; playStyle = "strike"; }
    const leadHits = Math.max(1, Math.min(3, Math.round(1 + nMotion * 2)));
    const section = Math.max(1, Math.min(3, leadVoices - 1));   // leadVoices 1->1, 4->3
    for (let i = 0; i < section; i++) {
      band.push({ role: "lead", instrument: {
        family, playStyle, appendage: 2, hitsPerBeat: leadHits,
      } });
    }
  }

  // PAD / DRONE — sustained wash. When wash dominates and there is little/no kit
  // (ambient, drone), the pad becomes a small CHOIR of droners; the reed-harmonium
  // is the organic variant, the glasspad the electronic one.
  if (f.wash > 0.28) {
    const family = organic ? "reedharmonium" : "glasspad";
    const playStyle = organic ? "blow" : "bow";
    const droneChoir = f.drumDensity < 0.3 ? Math.max(1, Math.min(3, 1 + Math.round(nWash * 2))) : 1;
    for (let i = 0; i < droneChoir; i++) {
      band.push({ role: "pad", instrument: { family, playStyle, appendage: 3, hitsPerBeat: 1 } });
    }
  }

  // PERC — an extra percussionist when the rhythm is busy or tightly interlocked.
  // Shakers/woodblocks that strike fast; hitsPerBeat tracks hatDensity.
  if (nIl > 0.4 || nHat > 0.6 || nDrum > 0.85) {
    const family = organic ? "shakerpod" : "clackshell";
    band.push({ role: "perc", instrument: {
      family, playStyle: "strike", appendage: 0,
      hitsPerBeat: Math.max(2, Math.min(4, Math.round(1 + nHat * 3))),
    } });
  }

  // Guarantee at least one player, then trim to the mobile crowd cap. Trimming
  // drops the least-essential trailing members (perc/extra leads) first.
  if (band.length === 0) {
    band.push({ role: "lead", instrument: { family: "bloopharp", playStyle: "pluck", appendage: 2, hitsPerBeat: 1 } });
  }
  if (band.length > CAP) band.length = CAP;

  // Clamp each appendage into the actual limb count so alien.js never indexes a
  // missing limb.
  for (const m of band) m.instrument.appendage = m.instrument.appendage % Math.max(1, body.limbs);

  // ---- BACKDROP / GLOW -------------------------------------------------
  // Calm, acoustic genres greet you on FARMS (crop rows, silos); aggressive,
  // percussive, or electronic genres on CITY skylines. Farms require a living
  // band AND genuinely low overall energy (folk ballads, sparse country), so
  // metal, bebop and other high-energy acoustic genres stay in the city. Glow
  // tracks wash + crackle neon.
  const backdrop = organic && groove.energy < 0.45 ? "farm" : "city";
  const glow = clamp01(nWash * 0.7 + nCrackle * 0.3 + (organic ? 0 : 0.15));

  // ---- DANCERS ---------------------------------------------------------
  // Extra background dancers (no instrument) the CONTROLLER arranges around/behind
  // the band. Count scales with the party energy — dense, driving, high-tempo
  // genres pack the floor; sparse ambient keeps a lonely few. Mobile-capped 4..8
  // so crowd draw-calls stay bounded (dancers share the low-poly rig geometry).
  const dancers = Math.max(4, Math.min(8, Math.round(4 + groove.energy * 3 + nDrum * 1.5 + nHat * 1.0 - 1)));

  return {
    palette, body, skin, cloth, groove, face, texture, band,
    dancers,
    crowd: band.length,
    backdrop, glow,
    // echo the raw vector + name for downstream tuning / docs verification.
    _features: f, _genre: name,
  };
}

export default { traitsFromGenre, mulberry32 };
