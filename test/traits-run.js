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

  console.log("\n" + (fail === 0 ? "ALL CHECKS PASSED" : `!!! ${fail} FAILURE(S)`));
  process.exit(fail === 0 ? 0 : 1);
})();
