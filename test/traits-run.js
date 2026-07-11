// test/traits-run.js — pure-node proof for app/starcruise/traits.js.
// Prints traits + band for contrasting genres, asserts DETERMINISM (same
// genre+seed -> identical) and DIVERSITY (different genres -> different bands).
// Run: node test/traits-run.js   (from /home/ford/stellate)

const path = require("path");
const K = require(path.join(__dirname, "..", "engine", "genre-kernel.js"));
const V = require(path.join(__dirname, "..", "engine", "genre-verifier.js"));

function bandSig(t) {
  return t.band.map((m) => `${m.role}:${m.instrument.family}/${m.instrument.playStyle}x${m.instrument.hitsPerBeat}`).join(" | ");
}
function short(t) {
  const p = (c) => `h${Math.round(c.h)} s${c.s.toFixed(2)} l${c.l.toFixed(2)}`;
  return {
    crowd: t.crowd, backdrop: t.backdrop, skin: t.skin,
    glow: +t.glow.toFixed(2),
    body: { massH: +t.body.massH.toFixed(2), height: +t.body.height.toFixed(2), limbs: t.body.limbs, eyes: t.body.eyes, segments: t.body.segments },
    cloth: t.cloth,
    groove: { bpm: t.groove.tempoBpm, bounce: +t.groove.bounce.toFixed(2), sway: +t.groove.sway.toFixed(2), headbob: +t.groove.headbob.toFixed(2), energy: +t.groove.energy.toFixed(2) },
    skinColor: p(t.palette.skin),
  };
}

(async () => {
  const { traitsFromGenre } = await import(
    "file://" + path.join(__dirname, "..", "app", "starcruise", "traits.js")
  );

  const GENRES = ["techno", "ambient", "jazz", "heavymetal", "bluegrass", "gabber"];
  const SEED = 7;
  let fail = 0;

  console.log("=== TRAITS per genre (seed " + SEED + ") ===\n");
  const bands = {};
  for (const g of GENRES) {
    const t = traitsFromGenre(K, V, g, SEED);
    bands[g] = bandSig(t);
    console.log("### " + g);
    console.log("  BAND (" + t.crowd + "): " + bands[g]);
    console.log("  " + JSON.stringify(short(t)));
    console.log("");
  }

  // ---- DETERMINISM: same genre+seed twice -> byte-identical -----------
  console.log("=== DETERMINISM ===");
  for (const g of GENRES) {
    const a = JSON.stringify(traitsFromGenre(K, V, g, SEED));
    const b = JSON.stringify(traitsFromGenre(K, V, g, SEED));
    const ok = a === b;
    if (!ok) fail++;
    console.log(`  ${g.padEnd(12)} ${ok ? "IDENTICAL" : "!!! DIVERGED"}`);
  }
  // different seed -> should differ (proves seed actually threads through)
  const s1 = JSON.stringify(traitsFromGenre(K, V, "techno", 1));
  const s2 = JSON.stringify(traitsFromGenre(K, V, "techno", 2));
  console.log(`  techno seed1 vs seed2: ${s1 !== s2 ? "DIFFER (good)" : "!!! SAME"}`);
  if (s1 === s2) fail++;

  // ---- DIVERSITY: distinct genres -> distinct band signatures ---------
  console.log("\n=== DIVERSITY ===");
  const uniq = new Set(Object.values(bands));
  console.log(`  ${GENRES.length} genres -> ${uniq.size} distinct band signatures`);
  if (uniq.size < GENRES.length) { console.log("  !!! some bands collided"); fail++; }

  // spot-check the expected character of contrasting genres
  const checks = [];
  const T = {}; for (const g of GENRES) T[g] = traitsFromGenre(K, V, g, SEED);
  const has = (g, role, fam) => T[g].band.some((m) => m.role === role && (!fam || m.instrument.family === fam));
  checks.push(["ambient has NO drummer", !has("ambient", "drum")]);
  checks.push(["ambient has pad/drone players", has("ambient", "pad")]);
  checks.push(["jazz has a drummer", has("jazz", "drum")]);
  checks.push(["jazz lead is an organic horn/string", T.jazz.band.some((m) => m.role === "lead" && (m.instrument.family === "wailhorn" || m.instrument.family === "twangstring"))]);
  checks.push(["techno bassist is electronic (synth/sub)", T.techno.band.some((m) => m.role === "bass" && (m.instrument.family === "synthbass" || m.instrument.family === "subwomp"))]);
  checks.push(["heavymetal is a city, not farm", T.heavymetal.backdrop === "city"]);
  checks.push(["bluegrass is organic-skinned", T.bluegrass.skin === "organic"]);
  checks.push(["gabber has a lead section (>1 lead)", T.gabber.band.filter((m) => m.role === "lead").length >= 2]);
  for (const [label, ok] of checks) {
    if (!ok) fail++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  }

  // ---- RENDERSTYLE: each genre renders in its own visual language --------
  console.log("\n=== RENDERSTYLE per genre ===");
  const POST_KEYS = ["dither", "scanlines", "aberration", "halftone", "bloom", "posterize", "grade", "vignette", "curvature"];
  const rsPost = {}, rsMat = {};
  for (const g of GENRES) {
    const rs = T[g].renderStyle;
    // shape check: renderStyle present + full contract shape.
    const shapeOk = rs && rs.post && typeof rs.material === "string" &&
      POST_KEYS.every((k) => rs.post[k] != null) && Array.isArray(rs.post.grade) && rs.post.grade.length === 3 &&
      ["none", "ordered", "onebit"].indexOf(rs.post.dither) >= 0 &&
      rs.post.posterize >= 2 && rs.post.posterize <= 16 &&
      ["flat", "cel", "iridescent", "wireframe", "glitch", "matte"].indexOf(rs.material) >= 0;
    if (!shapeOk) fail++;
    rsPost[g] = JSON.stringify(rs && rs.post);
    rsMat[g] = rs && rs.material;
    console.log(`  ${g.padEnd(11)} ${shapeOk ? "OK  " : "BAD "} mat=${(rsMat[g] || "?").padEnd(11)} ${rsPost[g]}`);
  }
  // VARIES: distinct genres -> distinct post bags + a spread of materials.
  const uniqPost = new Set(Object.values(rsPost));
  const uniqMat = new Set(Object.values(rsMat));
  console.log(`  ${GENRES.length} genres -> ${uniqPost.size} distinct post bags, ${uniqMat.size} distinct materials`);
  if (uniqPost.size < GENRES.length) { console.log("  !!! some post bags collided"); fail++; }
  if (uniqMat.size < 3) { console.log("  !!! materials not varied enough"); fail++; }
  // intent spot-checks: the derivation matches the genre archetype.
  const rchecks = [
    ["techno dithers ONEBIT (hard electronica)", T.techno.renderStyle.post.dither === "onebit"],
    ["techno crushes the palette (posterize <= 5)", T.techno.renderStyle.post.posterize <= 5],
    ["ambient uses NO dither (clean wash)", T.ambient.renderStyle.post.dither === "none"],
    ["ambient blooms strongly (>0.4)", T.ambient.renderStyle.post.bloom > 0.4],
    ["ambient keeps a smooth ramp (posterize >= 10)", T.ambient.renderStyle.post.posterize >= 10],
    ["jazz gets a halftone screen (>0.3)", T.jazz.renderStyle.post.halftone > 0.3],
    ["jazz grade is WARM (r > b)", T.jazz.renderStyle.post.grade[0] > T.jazz.renderStyle.post.grade[2]],
    ["heavymetal is wireframe/glitch (aggressive surface)", ["wireframe", "glitch"].indexOf(T.heavymetal.renderStyle.material) >= 0],
    ["gabber dithers ONEBIT + hard posterize", T.gabber.renderStyle.post.dither === "onebit" && T.gabber.renderStyle.post.posterize <= 5],
  ];
  for (const [label, ok] of rchecks) {
    if (!ok) fail++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  }
  // DETERMINISM already covered by the whole-object stringify above (renderStyle is
  // part of the returned traits), but assert it explicitly for the post bag too.
  const detOk = GENRES.every((g) => JSON.stringify(traitsFromGenre(K, V, g, SEED).renderStyle) === JSON.stringify(T[g].renderStyle));
  if (!detOk) fail++;
  console.log(`  renderStyle determinism: ${detOk ? "IDENTICAL across re-derivation" : "!!! DIVERGED"}`);

  console.log("\n" + (fail === 0 ? "ALL CHECKS PASSED" : `!!! ${fail} FAILURE(S)`));
  process.exit(fail === 0 ? 0 : 1);
})();
