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
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));

const WRITE = process.argv.includes("--write");
const onlyIx = process.argv.indexOf("--only");
const ONLY = onlyIx >= 0 ? new Set(process.argv[onlyIx + 1].split(",")) : null;

// ---- vocabulary: the engine's names, said in English ------------------------
const KIT = {
  techno: "a machine four", house: "a four-on-the-floor", four: "a four-on-the-floor",
  pulse: "a pulse kit", jungle: "a jungle kit", breaks: "a breaks kit",
  boombap: "a boom-bap kit", bossa: "a bossa kit", electro: "an electro kit",
  full: "a full kit", open: "an open kit", halftime: "a half-time kit",
  kick: "a bare kick", newjack: "a swingbeat kit", onedrop: "a one-drop",
  shuffle: "a shuffle", trap: "a trap kit", tribal: "a tribal kit",
  waltz: "a waltz kit", waltzswing: "a swung waltz", sixeight: "a 6/8 kit",
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
// ARTICLE-FREE noun phrases. Some already carry their role ("acid bass"), and
// the sentence builder must not then append it again — "an FM lead lead" was
// the first draft's output.
const MODEL = {
  acid: "acid bass", sub: "sub bass", reese: "reese bass", wobble: "wobble bass",
  saw: "saw synth", stack: "stacked saws", pluck: "pluck lead", kpluck: "plucked string",
  fm: "FM lead", dx7: "FM lead", bell: "bells", organ: "organ", hammond: "Hammond",
  piano: "piano", rhodes: "Rhodes", choir: "choir", strings: "strings", brass: "brass",
  guitar: "electric lead", fuzz: "fuzz lead", metal: "distorted lead", solina: "string machine",
  juno60: "Juno pad", oberheim: "Oberheim pad", ppg: "PPG pad", vp330: "vocoder choir",
  casiocz: "phase-distortion lead", modeld: "Minimoog lead", synclead: "hard-sync lead",
  tb303: "303 line", hoover: "hoover stabs", vocoder: "vocoder", ringmod: "ring mod",
  sine: "sine tones", sampler: null,   // sampled voices name themselves via samplerPool
};
// "a" vs "an" by SOUND, not spelling: FM and Oberheim take "an", Juno takes "a".
const AN = /^(?:[aeiou]|FM\b|8|11|18|f\b|h\b|l\b|m\b|n\b|r\b|s\b|x\b)/i;
// PLURALS AND MASS NOUNS take no article: "strings", "bells", "brass".
const PLURAL = /(s|brass|choir)$/i;
const art = (s) => PLURAL.test(s) ? s : (AN.test(s) ? "an " : "a ") + s;
// Acoustic MODEL names are instruments, not timbres, so they name themselves
// exactly like a sampled voice — "piano", never "a piano bass".
const SELF_NAMING = new Set(["piano", "organ", "choir", "strings", "brass",
  "Hammond", "Rhodes", "bells", "vocoder"]);
// append the role only when the name does not already say it
const role = (s, r) => new RegExp(r + "$", "i").test(s) ? s : s + " " + r;
const say = (id) => String(id).replace(/_/g, " ");

const rng = (r) => Array.isArray(r) ? r : [r, r];
const mid = (r) => { const [a, b] = rng(r); return (a + b) / 2; };

// what a voice actually plays: prefer the SAMPLED instrument (it is the default
// sound and it names itself), else the synthesis model.
function voiceOf(a, r) {
  const v = a[r]; if (!v) return null;
  const pool = v.samplerPool || (v.recipe && v.recipe.samplerPool);
  // A REAL INSTRUMENT NAMES ITSELF. "cello" must not become "a cello bass" and
  // "piano" must not become "a piano bass" — the role suffix only disambiguates
  // synth models, which are otherwise just timbres.
  if (pool && pool.length) return { n: say(pool[0]), sampled: true };
  const models = (v.recipe && v.recipe.model) || [];
  for (const m of models) { const n = MODEL[m]; if (n) return { n, sampled: false }; }
  return null;
}

function infoFor(g) {
  const a = K.GENRES[g];
  const [lo, hi] = rng(a.bpm || [100, 120]);
  const kits = (a.kits || []).filter((k) => k !== "off");
  const beatless = !kits.length;
  const meter = a.meter ? `${a.meter.beats}/${a.meter.unit}` : null;

  // 1) TEMPO AND KIT
  const tempo = Math.round(lo) === Math.round(hi) ? `${Math.round(lo)}` : `${Math.round(lo)}-${Math.round(hi)}`;
  let s1 = beatless
    ? `Beatless at ${tempo}.`
    : `${(KIT[kits[0]] || "a kit").replace(/^a(n?) /, (m) => m.toUpperCase())} at ${tempo}${meter ? ` in ${meter}` : ""}.`;
  s1 = s1.charAt(0).toUpperCase() + s1.slice(1);

  // 2) WHAT PLAYS — bass, pads, lead, in the order you hear them stack up
  const lead = voiceOf(a, "lead"), pads = voiceOf(a, "pads"), bass = voiceOf(a, "bass");
  const selfNames = (v) => v.sampled || SELF_NAMING.has(v.n);
  const nm = (v, r) => v && art(selfNames(v) ? v.n : role(v.n, r));
  let B = nm(bass, "bass"), P = nm(pads, "pad"), L = nm(lead, "lead");
  // one instrument covering two roles reads as a stutter ("a honky tonk pad,
  // with a honky tonk lead") — say it once, as the pair it is.
  if (pads && lead && pads.n === lead.n) { P = null; L = art(lead.n) + " on both pad and lead"; }
  const parts = [B, P, L].filter(Boolean);
  let s2 = "";
  if (parts.length === 3) s2 = `${B} under ${P}, with ${L}.`;
  else if (parts.length === 2) s2 = `${parts[0]} with ${parts[1]}.`;
  else if (parts.length === 1) s2 = `${parts[0]}.`;
  s2 = s2.charAt(0).toUpperCase() + s2.slice(1);

  // 3) HOW IT MOVES — harmony, then the rhythmic character that is actually set
  const prog = (a.progressions || []).map((p) => PROG[p]).filter(Boolean)[0];
  const feel = [];
  const sw = mid(a.swing || 0), hu = mid(a.humanize || 0);
  if (sw >= 0.18) feel.push("hard swing");
  else if (sw >= 0.08) feel.push("swung");
  else if (sw > 0.02) feel.push("a light shuffle");
  else if (!beatless) feel.push("straight time");
  if (hu >= 0.28) feel.push("loose timing");
  else if (hu <= 0.06 && !beatless) feel.push("quantized tight");
  if (a.euclid) feel.push("euclidean hats");
  if (a.rubato) feel.push("rubato");
  if (a.chordEvery && a.chordEvery >= 16) feel.push(`one chord every ${a.chordEvery} beats`);
  const bits = [prog, ...feel].filter(Boolean);
  // Do NOT capitalise a chord symbol: "ii-V-I" is not a sentence opener that
  // wants a shift, and "Ii-V-I" is simply wrong notation.
  const j = bits.join(", ");
  const s3 = bits.length ? (/^(?:i+v?|v i*)[-–]/i.test(j) ? j : j.replace(/^./, (c) => c.toUpperCase())) + "." : "";

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
