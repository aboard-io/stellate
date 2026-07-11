// test/traits-run.js — pure-node proof for app/starcruise/traits.js.
// Asserts the REAL-BAND contract: (1) traits.body is a NON-HUMAN body plan
// (plan/symmetry/arms/legs/tentacles/face) that VARIES by genre so genres read as
// different SPECIES; (2) traits.band has ONE member per ACTIVE VOICE of the track,
// each tagged with its engine voice id + an INVENTED alien-morphology instrument;
// (3) DETERMINISM (same genre+seed -> identical) + DIVERSITY (genres differ);
// (4) renderStyle stays a full, varied, deterministic per-genre visual language.
// Run: node test/traits-run.js   (from /home/ford/stellate)

const path = require("path");
const K = require(path.join(__dirname, "..", "engine", "genre-kernel.js"));
const V = require(path.join(__dirname, "..", "engine", "genre-verifier.js"));

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
    "file://" + path.join(__dirname, "..", "app", "starcruise", "traits.js")
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
      ["none", "ordered", "onebit"].indexOf(rs.post.dither) >= 0 &&
      rs.post.posterize >= 2 && rs.post.posterize <= 16 &&
      ["flat", "cel", "iridescent", "wireframe", "glitch", "matte"].indexOf(rs.material) >= 0;
    chk(`${g.padEnd(11)} renderStyle well-formed (mat=${rs && rs.material})`, shapeOk);
    rsPost[g] = JSON.stringify(rs && rs.post); rsMat[g] = rs && rs.material;
  }
  chk(`${GENRES.length} genres -> ${new Set(Object.values(rsPost)).size} distinct post bags`, new Set(Object.values(rsPost)).size >= GENRES.length - 1);
  chk(`materials varied (${new Set(Object.values(rsMat)).size} distinct)`, new Set(Object.values(rsMat)).size >= 3);
  chk("techno dithers ONEBIT", T.techno.renderStyle.post.dither === "onebit");
  chk("ambient uses NO dither (clean wash)", T.ambient.renderStyle.post.dither === "none");
  chk("ambient blooms strongly (>0.4)", T.ambient.renderStyle.post.bloom > 0.4);
  chk("renderStyle determinism holds", GENRES.every((g) => JSON.stringify(traitsFromGenre(K, V, g, SEED).renderStyle.post) === rsPost[g]));

  console.log("\n" + (fail === 0 ? "ALL CHECKS PASSED" : `!!! ${fail} FAILURE(S)`));
  process.exit(fail === 0 ? 0 : 1);
})();
