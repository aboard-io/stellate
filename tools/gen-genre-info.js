#!/usr/bin/env node
// gen-genre-info.js — write every genre's `info` blurb FROM ITS ANCHOR.
//
//   node tools/gen-genre-info.js [--write] [--only techno,jungle]
//
// The prose used to be hand-written, and it drifted the way hand-written prose
// beside live data always drifts: 227 blurbs opened with the same colon
// fragment, 234 closed with an em-dash punchline, three incompatible voices
// coexisted, and — worse than any tic — a card could promise an instrument the
// recipe could not play. musicality's checkCardClaims exists solely because
// that kept happening.
//
// So the blurb is DERIVED now. Every number and every instrument here is read
// off the anchor that ships, which makes the description true by construction:
// it cannot over-promise, because it only says what the recipe can draw. Change
// the anchor and re-run; the prose follows. Deterministic — same anchor in,
// same sentence out, no rng anywhere.
//
// THE SHAPE, which is E4's house style: tempo and kit first, then what plays,
// then how it moves. Plain declarative sentences. No punchline.
//
//   Four-on-the-floor at 124-140. Acid bass under saw pads with a pluck lead.
//   Two-chord minor drone, straight time.
//
// THE VOCABULARY LAW. Everything the reader sees is a TABLE keyed on an engine
// value — kit id, synthesis model, sampler id, bass pattern — never a per-genre
// string. Each table entry says what the thing SOUNDS like, not what it is
// called in the source: the `breaks` kit is "a broken beat", the `pulse` kit is
// "a driving four", `acoustic_bass` is an upright. A per-genre override would
// be the first crack back toward hand-written prose (which rotted once already),
// so there are none: if a genre reads wrong, the table entry is wrong for every
// genre that shares that value, and fixing it there fixes all of them.
//
// The names are ROLE-SHAPED, because one model is three different sounds
// depending on where it sits: `saw` is a saw bass, saw pads, or a saw lead, and
// the first draft's "an FM lead pad" and "Minimoog lead bass" came from having
// only one name per model.
//
// CARD-TRUTH CONSTRAINT. checkCardClaims scans this prose for instrument nouns
// and fails the genre if the recipe cannot realize one. So a table entry may
// only rename WITHIN the family the source already is: `ahh_choir` may become
// "wordless choir" (still a choir the sampler holds), but `tremolo` may not
// become "tremolo strings" in a genre whose pools hold no string sampler.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));

const WRITE = process.argv.includes("--write");
const onlyIx = process.argv.indexOf("--only");
const ONLY = onlyIx >= 0 ? new Set(process.argv[onlyIx + 1].split(",")) : null;

// ---- vocabulary: the engine's names, said in English ------------------------
// Kits by what the pattern DOES (engine/csd-engine.js KITS), not by its id:
// `full` is a straight backbeat, `open` adds open hats and rim answers, `pulse`
// is a four with ghost snares, `breaks` displaces the kicks and drags the snare.
const KIT = {
  four: "a four-on-the-floor", house: "a four-on-the-floor with claps",
  techno: "a machine four", pulse: "a driving four",
  kick: "a bare kick", full: "a straight backbeat", open: "an open backbeat",
  boombap: "a boom-bap beat", breaks: "a broken beat", jungle: "a chopped jungle kit",
  halftime: "a half-time beat", trap: "trap kicks and rolling hats",
  electro: "an 808 electro beat", tribal: "hand drums and toms",
  bossa: "a soft bossa clave", shuffle: "a shuffle", newjack: "a swingbeat",
  onedrop: "a one-drop", waltz: "a boom-chick-chick waltz",
  waltzswing: "a swung waltz ride", sixeight: "a 6/8 lilt",
};
const PROG = {
  drone_min: "a two-chord minor drone", deep_two: "a two-chord vamp",
  doo_wop: "doo-wop changes", four_chords: "four-chord changes",
  royal_road: "royal-road changes", sad_pop: "a minor pop cycle",
  ii_v_i: "ii-V-I", canon: "a canon", rag_cycle: "the rag cycle",
  minor_run: "a descending minor run", epic_min: "epic minor changes",
  epic_maj: "epic major changes", uplift: "an uplifting cadence",
  pop_1625: "a I-vi-ii-V turn", dream: "dream changes", lofi: "lo-fi changes",
  blues_12: "a twelve-bar blues", blues_16: "a sixteen-bar blues",
  andalusian: "an andalusian cadence", hijaz: "a hijaz maqam",
  neosoul: "neo-soul changes", quartal: "quartal harmony",
  whole_tone: "whole-tone planing", mediant: "mediant shifts",
  frost: "bare triads", primeval: "primeval fifths", interchange: "modal interchange",
  dub_vamp: "a dub vamp", funk_vamp: "a funk vamp", house_min: "a minor house vamp",
  house_min7: "a min7 house vamp", synthwave: "synthwave changes",
  mode_dorian: "dorian", mode_lydian: "lydian", mode_mixo: "mixolydian", mode_phrygian: "phrygian",
};
// ARTICLE-FREE noun phrases, PER ROLE. One synthesis model is three different
// sounds depending on where it sits, and a single name for all three produced
// "an FM lead pad", "Minimoog lead bass" and "a stacked saws lead". A string
// entry means the model sounds the same in every role (it is an instrument, not
// a timbre); an object names each role it can take.
const MODEL = {
  acid: { bass: "acid bass", lead: "acid line", pads: "acid saws" },
  sub: { bass: "sub bass", lead: "sub tone", pads: "sub tones" },
  reese: { bass: "reese bass", lead: "reese lead", pads: "reese drone" },
  wobble: { bass: "wobble bass", lead: "wobble lead", pads: "wobble drone" },
  saw: { bass: "saw bass", lead: "saw lead", pads: "saw pads" },
  stack: { bass: "stacked-saw bass", lead: "stacked-saw lead", pads: "stacked saws" },
  pluck: { bass: "plucked bass", lead: "pluck lead", pads: "plucked pads" },
  kpluck: { bass: "plucked bass", lead: "plucked string", pads: "plucked pads" },
  fm: { bass: "FM bass", lead: "FM lead", pads: "FM pad" },
  dx7: { bass: "FM bass", lead: "FM lead", pads: "FM pad" },
  bell: { bass: "bell bass", lead: "bells", pads: "bell tones" },
  organ: "organ", hammond: "Hammond", piano: "piano", rhodes: "Rhodes",
  choir: "choir", strings: "strings", brass: "brass",
  guitar: { bass: "electric bass", lead: "electric lead", pads: "electric chords" },
  fuzz: { bass: "fuzz bass", lead: "fuzz lead", pads: "fuzz drone" },
  metal: { bass: "distorted bass", lead: "distorted lead", pads: "distorted chords" },
  solina: "string machine",
  juno60: { bass: "Juno bass", lead: "Juno lead", pads: "Juno pads" },
  oberheim: { bass: "Oberheim bass", lead: "Oberheim lead", pads: "Oberheim pads" },
  ppg: { bass: "PPG bass", lead: "PPG lead", pads: "PPG pads" },
  vp330: "vocoder choir",
  casiocz: { bass: "phase-distortion bass", lead: "phase-distortion lead", pads: "phase-distortion pads" },
  modeld: { bass: "Minimoog bass", lead: "Minimoog lead", pads: "Minimoog pads" },
  synclead: { bass: "hard-sync bass", lead: "hard-sync lead", pads: "hard-sync pads" },
  tb303: { bass: "303 bass", lead: "303 line", pads: "303 drone" },
  hoover: "hoover stabs", vocoder: "vocoder", ringmod: "ring mod",
  sine: { bass: "sine bass", lead: "sine lead", pads: "sine tones" },
  sampler: null,   // sampled voices name themselves via samplerPool
};
// Sampler ids are FILENAMES: underscored, GM-catalog spelling, trailing bank
// numbers. Say them the way a player says them. Renames stay inside the
// instrument family the sampler actually is — the card-truth constraint above.
const SAMPLER = {
  acoustic_bass: "upright bass", contrabass: "double bass", synth_bass_1: "synth bass",
  bright_yamaha_grand: "bright grand piano", yamaha_grand_piano: "grand piano",
  honky_tonk: "honky-tonk piano", rhodes_ep: "Rhodes",
  ahh_choir: "wordless choir", ohh_voices: "wordless voices", solo_vox: "solo voice",
  french_horns: "French horns",   // a sampler id is lower-case; the instrument is not
  steel_string_guitar: "steel-string guitar", nylon_string_guitar: "nylon-string guitar",
  palm_muted_guitar: "palm-muted guitar", distortion_guitar: "distorted guitar",
  overdrive_guitar: "overdriven guitar", crunch_guitar: "crunchy guitar",
  guitar_harmonics: "guitar harmonics",
  orchestra_hit: "orchestra hits", atmosphere: "atmosphere pad",
  tremolo: "tremolo pad",   // NOT "tremolo strings": see the card-truth constraint
  fx_soundtrack: "soundtrack pad", fx_atmosphere: "atmosphere pad",
};
// "a" vs "an" by SOUND, not spelling: FM and Oberheim take "an", Juno takes "a".
const AN = /^(?:[aeiou]|FM\b|8|11|18|f\b|h\b|l\b|m\b|n\b|r\b|s\b|x\b)/i;
// PLURALS AND MASS NOUNS take no article: "strings", "bells", "saw pads",
// "brass". A DOUBLE s is not a plural — "bass" is the word this whole table
// exists for, and "Sub bass under…" was the bug that proved it. "choir" keeps
// its article too: "a wordless choir", "a vocoder choir".
const PLURAL = /([^s]s|brass|glass)$/i;
const art = (s) => PLURAL.test(s) ? s : (AN.test(s) ? "an " : "a ") + s;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const say = (id) => SAMPLER[id] || String(id).replace(/_\d+$/, "").replace(/_/g, " ");

// A bass PATTERN is character the card can spend for free: the same upright is
// a different instrument walking than it is holding a pedal. Only the patterns
// with a plain-English name are spent; root/simple/sub/pedal add nothing.
const BASS_MOVE = {
  walking: "walking", rolling: "rolling", drive: "driving", syncopated: "syncopated",
  habanera: "habanera", oompahpah: "oom-pah", sludge: "sludgy", sixteenths: "sixteenth-note",
};

const rng = (r) => Array.isArray(r) ? r : [r, r];
const mid = (r) => { const [a, b] = rng(r); return (a + b) / 2; };
const NUM = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven",
  8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve", 16: "sixteen", 32: "thirty-two" };
const num = (n) => NUM[n] || String(n);
// "a, b and c" — a comma list ending in "and" reads as written prose; a bare
// comma list reads as a spec sheet, which is what the first generation did.
const list = (a) => a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

// what a voice actually plays: prefer the SAMPLED instrument (it is the default
// sound and it names itself), else the synthesis model in its ROLE.
function voiceOf(a, r) {
  const v = a[r]; if (!v) return null;
  const pool = v.samplerPool || (v.recipe && v.recipe.samplerPool);
  // A REAL INSTRUMENT NAMES ITSELF. "cello" must not become "a cello bass" and
  // "piano" must not become "a piano bass" — the role word only disambiguates
  // synth models, which are otherwise just timbres, and it is already baked
  // into their per-role names.
  if (pool && pool.length) return { n: say(pool[0]), sampled: true };
  const models = (v.recipe && v.recipe.model) || [];
  for (const m of models) {
    const e = MODEL[m]; if (!e) continue;
    const n = typeof e === "string" ? e : e[r === "pads" ? "pads" : r];
    if (n) return { n, sampled: false };
  }
  return null;
}

function infoFor(g) {
  const a = K.GENRES[g];
  const [lo, hi] = rng(a.bpm || [100, 120]);
  const kits = (a.kits || []).filter((k) => k !== "off");
  const beatless = !kits.length;
  const meter = a.meter ? `${a.meter.beats}/${a.meter.unit}` : null;
  const beatsPerBar = (a.meter && a.meter.beats) || 4;

  // 1) TEMPO AND KIT
  const tempo = Math.round(lo) === Math.round(hi) ? `${Math.round(lo)}` : `${Math.round(lo)}-${Math.round(hi)}`;
  // A beatless genre is not an absence, it is a tempo nothing is hitting. Lead
  // with the speed — "Beatless at 58-72" opened 24 cards with a negation, and a
  // reader met the missing thing before the music.
  const m = mid(a.bpm || 100);
  const pace = m < 70 ? "a slow" : m < 95 ? "an easy" : m < 125 ? "a steady" : "a brisk";
  const s1 = cap(beatless
    ? `${pace} ${tempo}${meter ? ` in ${meter}` : ""} with no kit under it.`
    : `${KIT[kits[0]] || "a kit"} at ${tempo}${meter ? ` in ${meter}` : ""}.`);

  // 2) WHAT PLAYS — bass, pads, lead, in the order you hear them stack up
  const lead = voiceOf(a, "lead"), pads = voiceOf(a, "pads"), bass = voiceOf(a, "bass");
  const move = bass && BASS_MOVE[((a.bass && a.bass.patterns) || [])[0]];
  if (move && !new RegExp("\\b" + move + "\\b", "i").test(bass.n)) bass.n = move + " " + bass.n;
  let s2 = "";
  const B = bass && art(bass.n), P = pads && art(pads.n), L = lead && art(lead.n);
  const same = (x, y) => x && y && x.n === y.n;
  // One instrument covering two roles reads as a stutter ("a honky-tonk pad,
  // with a honky-tonk lead") — say it once, as the pair it is.
  if (same(bass, pads) && same(pads, lead)) s2 = `${cap(B)} and nothing else.`;
  else if (same(pads, lead)) s2 = [B, `${art(pads.n)} on both pad and lead`].filter(Boolean).join(" under ") + ".";
  else if (same(bass, lead)) s2 = `${cap(art(bass.n))} on bass and lead${P ? `, under ${P}` : ""}.`;
  else if (same(bass, pads)) s2 = `${cap(art(bass.n))} on bass and pad${L ? `, with ${L}` : ""}.`;
  else {
    const parts = [B, P, L].filter(Boolean);
    // An acoustic front line is named the way a listener meets it: the horn or
    // the guitar first, the section behind it. Synth genres stack bottom-up,
    // because that is the order they arrive in.
    const acoustic = lead && lead.sampled && bass && bass.sampled;
    if (parts.length === 3) s2 = acoustic ? `${L} over ${P} and ${B}.` : `${B} under ${P}, with ${L}.`;
    else if (parts.length === 2) s2 = `${parts[0]} with ${parts[1]}.`;
    else if (parts.length === 1) s2 = `${parts[0]}.`;
  }
  s2 = cap(s2);

  // 3) HOW IT MOVES — harmony, then the rhythmic character that is actually set
  const prog = (a.progressions || []).map((p) => PROG[p]).filter(Boolean)[0];
  const feel = [];
  const sw = mid(a.swing || 0), hu = mid(a.humanize || 0);
  // Euclidean lanes are a COUNT, and the count is the sound: E(5,16) is five
  // kicks spaced across the bar. "euclidean hats" named the algorithm instead.
  // Stated FIRST so its own "and" (two lanes) never collides with the "and"
  // that closes the sentence's list.
  if (a.euclid) {
    const LANE = { kick: "kicks", hat: "hats", snare: "snare hits" };
    const lanes = Object.keys(a.euclid).map((d) => `${num(a.euclid[d][0])} ${LANE[d] || d}`);
    if (lanes.length) feel.push(`${list(lanes)} spread across the bar`);
  }
  if (sw >= 0.18) feel.push("swung hard");
  else if (sw >= 0.08) feel.push("swung");
  else if (sw >= 0.045) feel.push("a light shuffle");
  else if (sw > 0.02) feel.push("a touch of swing");
  else if (!beatless) feel.push("straight time");
  if (hu >= 0.28) feel.push("loose timing");
  else if (hu <= 0.06 && !beatless) feel.push("tight to the grid");
  if (a.rubato) feel.push("rubato");
  // Chord spans are heard in BARS. "one chord every 32 beats" is a number off a
  // field; "a chord change every eight bars" is what the ear counts.
  if (a.chordEvery && a.chordEvery >= 16)
    feel.push(`a chord change every ${num(Math.round(a.chordEvery / beatsPerBar))} bars`);
  // The harmony is the subject and the feel qualifies it, so the progression
  // takes a comma and only the FEELS take the "and" — "a min7 house vamp and
  // swung" read as two things of the same kind, which they are not.
  const j = prog ? (feel.length ? `${prog}, ${list(feel)}` : prog) : list(feel);
  // Do NOT capitalise a chord symbol: "ii-V-I" is not a sentence opener that
  // wants a shift, and "Ii-V-I" is simply wrong notation.
  const s3 = j ? (/^(?:i+v?|v i*)[-–]/i.test(j) ? j : cap(j)) + "." : "";

  return [s1, s2, s3].filter(Boolean).join(" ");
}

const names = Object.keys(K.GENRES).filter((g) => !ONLY || ONLY.has(g));
const out = {};
for (const g of names) out[g] = infoFor(g);

if (!WRITE) {
  for (const g of names.slice(0, ONLY ? names.length : 14)) {
    console.log(`\n── ${g}  (${K.GENRES[g].label})`);
    console.log("   was: " + (K.GENRES[g].info || "").slice(0, 110));
    console.log("   now: " + out[g]);
  }
  const lens = names.map((g) => out[g].length).sort((a, b) => a - b);
  console.log(`\n${names.length} generated | length min ${lens[0]} median ${lens[lens.length >> 1]} max ${lens[lens.length - 1]}`);
  console.log("(dry run — pass --write)");
  process.exit(0);
}

const F = path.join(ROOT, "engine", "genres-data.js");
let src = fs.readFileSync(F, "utf8");
let n = 0, missing = [];
for (const g of names) {
  const from = JSON.stringify(K.GENRES[g].info || "");
  const i = src.indexOf(from);
  if (i < 0) { missing.push(g); continue; }
  src = src.slice(0, i) + JSON.stringify(out[g]) + src.slice(i + from.length);
  n++;
}
fs.writeFileSync(F, src);
console.log(`rewrote ${n} info blurbs${missing.length ? `, ${missing.length} not located: ${missing.slice(0, 5).join(",")}` : ""}`);
