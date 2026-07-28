// test/unit/traits.test.js — pure-node proof for app/starcruise/traits.js.
// Asserts the REAL-BAND contract: (1) traits.body is a NON-HUMAN body plan
// (plan/symmetry/arms/legs/tentacles/face) that VARIES by genre so genres read as
// different SPECIES; (2) traits.band has ONE member per ACTIVE VOICE of the track,
// each tagged with its engine voice id + an INVENTED alien-morphology instrument;
// (3) DETERMINISM (same genre+seed -> identical) + DIVERSITY (genres differ);
// (4) renderStyle stays a full, varied, deterministic per-genre visual language.
// Run: node test/unit/traits.test.js   (from /home/ford/stellate)

const path = require("path");
const K = require(path.join(__dirname, "..", "..", "engine", "genre-kernel.js"));
const V = require(path.join(__dirname, "..", "..", "engine", "genre-verifier.js"));

// the engine voice ids a band member may be in charge of.
const VOICE_IDS = ["drums", "perc", "bass", "melody", "pad", "found"];
const BODY_PLANS = ["floating-gas", "radial", "crystalline", "insectoid", "cephalopod", "amorphous", "stalk"];
// a band member's instrument family must be an INVENTED ALIEN form (never a realistic
// drum/guitar) — this is the vocabulary traits.js emits.
const ALIEN_FAMILIES = new Set([
  "hide-sac", "membrane-sac", "glitch-pod", "pulse-bladder", "seed-rattle", "chime-cluster",
  "coiled-gut", "sub-bladder", "drone-coil", "bladder-horn", "tendril-harp", "shimmer-frond",
  "bloop-anemone", "neon-stinger", "reed-lung", "gas-veil", "voice-polyp", "echo-conch",
]);

function bandSig(t) {
  return t.band.map((m) => `${m.voice}:${m.instrument.family}/${m.instrument.playStyle}`).join(" | ");
}
function bodySig(t) {
  const b = t.body;
  return `plan=${b.plan} sym=${b.symmetry} a/l/t=${b.arms}/${b.legs}/${b.tentacles} eyes=${b.eyes} face=${b.face.family}`;
}

(async () => {
  const { traitsFromGenre } = await import(
    "file://" + path.join(__dirname, "..", "..", "app", "starcruise", "traits.js")
  );

  const GENRES = ["techno", "ambient", "jazz", "heavymetal", "bluegrass", "gabber", "dub", "bebop"];
  const SEED = 7;
  let fail = 0;
  const chk = (label, ok) => { if (!ok) fail++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`); return ok; };

  const T = {};
  console.log("=== TRAITS per genre (seed " + SEED + ") ===\n");
  for (const g of GENRES) {
    const t = traitsFromGenre(K, V, g, SEED);
    T[g] = t;
    console.log("### " + g);
    console.log("  BODY: " + bodySig(t));
    console.log("  BAND (" + t.crowd + "): " + bandSig(t));
    console.log("");
  }

  // ---- BODY PLAN: non-human + valid + varied --------------------------
  console.log("=== BODY PLAN (non-human species) ===");
  for (const g of GENRES) {
    const b = T[g].body;
    const shapeOk = BODY_PLANS.indexOf(b.plan) >= 0 && b.symmetry >= 1 && b.symmetry <= 8 &&
      b.arms >= 0 && b.legs >= 0 && b.tentacles >= 0 && (b.arms + b.tentacles) >= 1 &&
      b.face && typeof b.face.family === "string" &&
      // the ORIGINAL body fields are kept intact (legacy rig reads them).
      typeof b.massH === "number" && typeof b.height === "number" && typeof b.limbs === "number" &&
      typeof b.bodyShape === "string";
    chk(`${g.padEnd(11)} body plan well-formed (${bodySig(T[g])})`, shapeOk);
  }
  const uniqPlans = new Set(GENRES.map((g) => T[g].body.plan));
  chk(`body plan VARIES across genres (${uniqPlans.size} distinct: ${[...uniqPlans].join(", ")})`, uniqPlans.size >= 3);
  // non-human: at least one genre is NOT a plain bipedal stance (tentacles or radial arms).
  chk("some species are non-bipedal (tentacled / radial-armed)", GENRES.some((g) => T[g].body.tentacles > 0 || T[g].body.arms > 2));

  // ---- BAND: one member per ACTIVE VOICE, alien instruments -----------
  console.log("\n=== BAND: one alien per voice ===");
  for (const g of GENRES) {
    const b = T[g].band;
    const voices = b.map((m) => m.voice);
    const uniqueVoices = new Set(voices).size === voices.length;         // NO voice appears twice
    const validVoices = voices.every((v) => VOICE_IDS.indexOf(v) >= 0);  // all known engine voices
    const alienInst = b.every((m) => m.instrument && ALIEN_FAMILIES.has(m.instrument.family) &&
      ["strike", "drum", "pluck", "bow", "blow"].indexOf(m.instrument.playStyle) >= 0 &&
      typeof m.instrument.appendage === "number");
    const crowdOk = T[g].crowd === b.length && b.length >= 1 && b.length <= 8;
    chk(`${g.padEnd(11)} one alien per voice [${voices.join(",")}]`, uniqueVoices && validVoices && alienInst && crowdOk);
  }

  // ---- DETERMINISM ----------------------------------------------------
  console.log("\n=== DETERMINISM ===");
  for (const g of GENRES) {
    const a = JSON.stringify(traitsFromGenre(K, V, g, SEED));
    const b = JSON.stringify(traitsFromGenre(K, V, g, SEED));
    chk(`${g.padEnd(11)} identical on re-derivation`, a === b);
  }
  chk("techno seed1 vs seed2 DIFFER (seed threads through)",
    JSON.stringify(traitsFromGenre(K, V, "techno", 1)) !== JSON.stringify(traitsFromGenre(K, V, "techno", 2)));

  // ---- DIVERSITY ------------------------------------------------------
  // Band INSTRUMENTATION legitimately repeats across sibling genres (jazz & bebop
  // share the same acoustic ensemble), so the "different species" claim is tested on
  // the whole SPECIES signature: body plan + face + palette + render material + band.
  console.log("\n=== DIVERSITY (species) ===");
  const speciesSig = (g) => {
    const t = T[g];
    return `${bodySig(t)} | skinH${Math.round(t.palette.skin.h)} | ${t.renderStyle.material} | ${bandSig(t)}`;
  };
  const sigs = GENRES.map(speciesSig);
  chk(`${GENRES.length} genres -> ${new Set(sigs).size} distinct SPECIES`, new Set(sigs).size === GENRES.length);
  // instrumentation alone is coarser (one per voice) — still a healthy spread.
  const bandSigs = GENRES.map((g) => bandSig(T[g]));
  console.log(`  (band instrumentation: ${new Set(bandSigs).size} distinct ensembles)`);

  // spot-checks — the band mirrors the genre's real parts + character.
  console.log("\n=== CHARACTER spot-checks ===");
  const has = (g, voice, fam) => T[g].band.some((m) => m.voice === voice && (!fam || m.instrument.family === fam));
  chk("ambient has NO drummer (no kit)", !has("ambient", "drums"));
  chk("ambient has a pad/drone player", has("ambient", "pad"));
  chk("jazz has a drummer", has("jazz", "drums"));
  chk("jazz lead is an organic wind/string (bladder-horn/tendril-harp)",
    T.jazz.band.some((m) => m.voice === "melody" && (m.instrument.family === "bladder-horn" || m.instrument.family === "tendril-harp")));
  chk("techno bass is electronic (drone-coil/sub-bladder)",
    T.techno.band.some((m) => m.voice === "bass" && (m.instrument.family === "drone-coil" || m.instrument.family === "sub-bladder")));
  chk("jazz/dub have a perc lane player", has("jazz", "perc") || has("dub", "perc"));
  chk("heavymetal is a city, not farm", T.heavymetal.backdrop === "city");
  chk("bluegrass is organic-skinned", T.bluegrass.skin === "organic");

  // ---- RENDERSTYLE: per-genre visual language, varied + deterministic --
  console.log("\n=== RENDERSTYLE ===");
  const POST_KEYS = ["dither", "scanlines", "aberration", "halftone", "bloom", "posterize", "grade", "vignette", "curvature"];
  const rsPost = {}, rsMat = {};
  for (const g of GENRES) {
    const rs = T[g].renderStyle;
    const shapeOk = rs && rs.post && typeof rs.material === "string" &&
      POST_KEYS.every((k) => rs.post[k] != null) && Array.isArray(rs.post.grade) && rs.post.grade.length === 3 &&
      ["none", "ordered"].indexOf(rs.post.dither) >= 0 &&
      rs.post.posterize >= 6 && rs.post.posterize <= 16 &&
      ["flat", "cel", "iridescent", "matte", "pbr"].indexOf(rs.material) >= 0;
    chk(`${g.padEnd(11)} renderStyle well-formed (mat=${rs && rs.material})`, shapeOk);
    rsPost[g] = JSON.stringify(rs && rs.post); rsMat[g] = rs && rs.material;
  }
  chk(`${GENRES.length} genres -> ${new Set(Object.values(rsPost)).size} distinct post bags`, new Set(Object.values(rsPost)).size >= GENRES.length - 1);
  chk(`materials varied (${new Set(Object.values(rsMat)).size} distinct)`, new Set(Object.values(rsMat)).size >= 3);
  chk("techno dithers ORDERED (gentle grit, not a 1-bit crunch)", T.techno.renderStyle.post.dither === "ordered");
  chk("ambient uses NO dither (clean wash)", T.ambient.renderStyle.post.dither === "none");
  chk("ambient blooms (>0.4, but capped <=0.5)", T.ambient.renderStyle.post.bloom > 0.4 && T.ambient.renderStyle.post.bloom <= 0.5);
  chk("renderStyle determinism holds", GENRES.every((g) => JSON.stringify(traitsFromGenre(K, V, g, SEED).renderStyle.post) === rsPost[g]));

  // ---- CAP LAW: READABLE materials + GENTLE post-fx (SHADERS legibility) ----------
  // The whole catalog (all 250 genres, not just the 8) must stay legible: the material
  // vocabulary is the readable set ONLY (NO wireframe / pure-mesh / harsh glitch), no
  // genre uses the hard 1-bit crunch, and every post-fx param sits within its gentle cap.
  console.log("\n=== CAP LAW (readable materials + gentle post-fx) ===");
  const READABLE = new Set(["flat", "cel", "matte", "pbr", "iridescent"]);
  const BANNED_MAT = new Set(["wireframe", "mesh", "glitch"]);
  const ALLG = Object.keys(K.GENRES || {});
  let vocabBad = 0, onebitBad = 0, capBad = 0;
  const matSeen = new Set();
  for (const g of ALLG) {
    const t = traitsFromGenre(K, V, g, SEED);
    const p = t.renderStyle.post, m = t.renderStyle.material;
    matSeen.add(m);
    if (!READABLE.has(m) || BANNED_MAT.has(m)) { vocabBad++; if (vocabBad <= 5) console.log("   !! non-readable material:", g, m); }
    if (p.dither === "onebit") onebitBad++;
    const okCaps = p.posterize >= 6 && p.posterize <= 16 && p.scanlines <= 0.25 && p.aberration <= 0.22 &&
      p.halftone <= 0.28 && p.bloom <= 0.5 && p.vignette <= 0.35 && p.curvature <= 0.15;
    if (!okCaps) { capBad++; if (capBad <= 5) console.log("   !! over-cap post:", g, JSON.stringify(p)); }
  }
  chk(`material vocab is the READABLE set only — NO wireframe/pure-mesh/glitch across ${ALLG.length} genres (seen: ${[...matSeen].sort().join(", ")})`, vocabBad === 0);
  chk(`NO genre uses the hard 1-bit crunch (onebit dropped) across ${ALLG.length} genres`, onebitBad === 0);
  chk(`post-fx within GENTLE caps (posterize>=6, scan<=.25, aberr<=.22, halftone<=.28, bloom<=.5, vignette<=.35, curve<=.15) for ALL ${ALLG.length} genres`, capBad === 0);

  // ---- DANCERS: OPTIONAL / GATED — 0 for some genres, >0 for others ---------------
  console.log("\n=== DANCERS (optional, energy/kit-gated) ===");
  let dZero = 0, dSome = 0;
  for (const g of ALLG) { const d = traitsFromGenre(K, V, g, SEED).dancers; if (d === 0) dZero++; else if (d > 0) dSome++; }
  chk(`dancers OPTIONAL — 0 for some genres (${dZero}) AND >0 for others (${dSome})`, dZero > 0 && dSome > 0);
  chk("ambient (hushed, no kit) -> 0 dancers (band-only planet)", T.ambient.dancers === 0);
  chk("gabber (driving) -> a dancing crowd (>0)", T.gabber.dancers > 0);

  // ---- PBR renderStyle: a VECTOR-SELECTED 'pbr' (real chrome/glass) material --------
  // Some clean chrome / glass electronic genres now select the 'pbr' style (a genuine
  // MeshStandardMaterial in alien.js). It is opt-in per genre — never global — and
  // acoustic genres never select it.
  console.log("\n=== PBR MATERIAL (vector-selected) ===");
  const pbrGenres = GENRES.filter((g) => T[g].renderStyle.material === "pbr");
  chk(`some chrome/glass genre selects 'pbr' (${pbrGenres.join(", ") || "none"})`, pbrGenres.length >= 1);
  chk("techno (clean chrome, driving) renders as pbr metal", T.techno.renderStyle.material === "pbr");
  chk("pbr is NOT global — acoustic genres never pbr", !["jazz", "bluegrass", "bebop", "heavymetal"].some((g) => T[g].renderStyle.material === "pbr"));

  // ---- SUPERQUADRIC exponents + curve-tube params (vector-driven geometry) ----------
  console.log("\n=== GEOMETRY PARAMS (superquadric + tube) ===");
  for (const g of GENRES) {
    const b = T[g].body;
    const ok = typeof b.sqEx === "number" && b.sqEx >= 0.16 && b.sqEx <= 1.5 &&
      typeof b.sqEy === "number" && b.sqEy >= 0.16 && b.sqEy <= 2.0 &&
      typeof b.tentTaper === "number" && b.tentTaper >= 0.08 && b.tentTaper <= 0.5 &&
      typeof b.tentCurl === "number" && b.tentCurl >= 0.05 && b.tentCurl <= 1.2;
    chk(`${g.padEnd(11)} superquadric/tube params well-formed (ex=${b.sqEx} ey=${b.sqEy} taper=${b.tentTaper} curl=${b.tentCurl})`, ok);
  }
  const uniqEx = new Set(GENRES.map((g) => T[g].body.sqEx));
  chk(`superquadric exponents VARY across genres (${uniqEx.size} distinct)`, uniqEx.size >= 4);
  chk("boxy genres (choppy techno/gabber) have LOW exponent (<0.6); round (jazz/ambient) HIGH (>0.9)",
    T.techno.body.sqEx < 0.6 && T.gabber.body.sqEx < 0.6 && T.jazz.body.sqEx > 0.9 && T.ambient.body.sqEx > 0.9);

  console.log("\n" + (fail === 0 ? "ALL CHECKS PASSED" : `!!! ${fail} FAILURE(S)`));
  process.exit(fail === 0 ? 0 : 1);
})();
