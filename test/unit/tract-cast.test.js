#!/usr/bin/env node
// test/unit/tract-cast.test.js — the tube has a part to play, and this proves it.
//
//   node test/unit/tract-cast.test.js
//
// engine/faust/dsp/tract_voice.dsp is a Kelly-Lochbaum vocal tract — twenty-one
// sections, a three-port velum, a Rosenberg glottis and a seeded babble driver —
// and it MEASURES as a real tube (engine/faust/build/measure-tract.js, 23/23).
// None of that is what this file is about. This file is about whether anything
// ever ASKS FOR IT.
//
// WHY THAT IS THE QUESTION. engine/speech.js was built whole, plumbed correctly
// and armed by nothing, and Paul never heard a note of it; the two formant
// singers then shipped wired-but-uncast for the same reason. In both cases every
// gate in the tree was green, because every gate asked "does the organ work"
// rather than "does a record reach it". So the claims below are all reachability
// claims, read off the SCORE — the recipe a genre actually resolves to and the
// unit the engine actually builds from it — and the roster is written out by
// hand so that un-casting a genre is a failing test rather than a silence.
//
// The other half is the COST, which for this model is the design. Measured at
// 48 kHz: tract_voice renders 0.353x realtime against voice_lead's 0.089x and
// stk_piano's 0.035x — about two simultaneous voices. So it is a SOLOIST, and
// "soloist" has to be a property of the code rather than of everyone's memory:
// §3 walks every genre in the catalogue and fails if any of them seats more
// throat than it can afford.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "../..");

let fails = 0, checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; console.error("FAIL: " + msg); }
};

const SE = require(path.join(ROOT, "engine/faust/voices/state-engine.js"));
const { GENRES } = require(path.join(ROOT, "nukernel/genres.js"));
const GK = Object.keys(GENRES);
const seSrc = fs.readFileSync(path.join(ROOT, "engine/faust/voices/state-engine.js"), "utf8");
const teSrc = fs.readFileSync(path.join(ROOT, "nukernel/audio/to-engine.js"), "utf8");
const dspSrc = fs.readFileSync(path.join(ROOT, "engine/faust/dsp/tract_voice.dsp"), "utf8");

// WHO TALKS, AND ON WHICH CHAIR. Written out rather than derived, for §77's
// reason in the nukernel gate: a roster derived from the table it is checking
// cannot notice the table losing a row, which is exactly how an organ goes quiet
// without failing.
//
// Three records, and the argument for each is the same shape — the genre had
// already cast a machine VOICE (GM 54) on a LINE chair, and what it was getting
// was not one. Electro got the VP-330, a Roland string ensemble holding one
// vowel, because that is all the tree could play; robotic pop and EBM did not
// even get that, because both declare a signature Model D without `lineOnly` and
// the synth took every chair, so their "voice" was a second copy of the sequence
// beside it:
//
//   electro      "the vocoder hook: eight steps of the phrase, every other note
//                gone" — Planet Rock's robot on top of the 808. A hook made of
//                eight steps with every other one missing is a mouth starting
//                and stopping, which is the one thing a formant bank cannot do.
//   roboticpop   Dusseldorf 1978. The deadpan machine delivery on those records
//                is a FORMANT SPEECH SYNTHESISER — a Votrax, a Speak & Spell —
//                which is this model's direct ancestor and not a metaphor for it.
//   ebm          "the vocal chant" — shouted, close, consonant-heavy, and the
//                plainest miscast in the roster: a barked chant was being played
//                by a string machine. Its `word` operator is `breath`, an AND
//                against the phrase's own gate, which is the file's own note for
//                "a chant that answers what it is given" — a mouth that shuts.
//
// AND THE TWO THAT WERE REFUSED, held here so the refusal is deliberate too:
// kraftwerk's vocoder chorale and dance post-punk's held sequence are both cast
// on the same GM id, and both are PADS. A pad is a held chord and a tract is one
// throat; they keep the string machine, which is four times cheaper and is what
// a held chord wanted anyway.
const CAST = { electro: 1, roboticpop: 0, ebm: 1 };
const REFUSED = { kraftwerk: 2, dancepostpunk: 0 };

const instrAt = (g, v) => (Array.isArray(g.instr)
  ? g.instr[Math.min(v, g.instr.length - 1)] : g.instr);
const chairAt = (g, v) => (g.realize ? g.realize(v) : "line");

(async () => {

const TE = await import(path.join(ROOT, "nukernel/audio/to-engine.js"));

/* ------------------------------------------------------------ 1. IT IS THERE
   A cast that resolves to a module nobody compiled is a silence wearing a name,
   and it is a 404 at the worklet rather than an error anyone sees. */
console.log("the module, both halves");
{
  ok(fs.existsSync(path.join(ROOT, "engine/faust/dsp/tract_voice.dsp")),
     "engine/faust/dsp/tract_voice.dsp is missing");
  ok(fs.existsSync(path.join(ROOT, "engine/faust/dist/tract_voice-module.wasm")),
     "tract_voice is not compiled into engine/faust/dist — the whole cast is silent");
  ok(fs.existsSync(path.join(ROOT, "engine/faust/dist/tract_voice-meta.json")),
     "tract_voice-meta.json is missing — the loader reads the param list out of it");
}

/* ------------------------------------------------------- 2. EVERY KNOB IS REAL
   THE FAILURE THIS CATCHES is the quietest one in the tree: a param written onto
   a worklet that has no such param is not an error anywhere — it is dropped, and
   the recipe's careful number simply never happens. So every key the engine
   writes for a mouth is checked against the DSP's OWN declared controls, read out
   of the .dsp source rather than out of a list somebody keeps beside it. */
console.log("every knob the recipe writes is a knob the tube has");
const DSP_PARAMS = new Set(
  [...dspSrc.matchAll(/\b(?:hslider|nentry|button|checkbox)\s*\(\s*"([^"]+)"/g)].map(m => m[1]));
{
  ok(DSP_PARAMS.size > 20, "only " + DSP_PARAMS.size + " params parsed out of tract_voice.dsp — " +
     "the parse is broken and this section is proving nothing");
  const u = SE.pitchedUnit("melody",
    { model: "mouth", vowels: "aeo", babble: 0.8, nasal: 0.2, fric: 0.3, artic: 0.4 },
    { bpm: 128, seed: 3 });
  ok(u.module === "tract_voice", "a melody recipe asking for model \"mouth\" built " +
     u.module + " — the routing is not there");
  for (const k of Object.keys(u.params))
    ok(DSP_PARAMS.has(k), "the mouth writes \"" + k + "\", which tract_voice.dsp does not declare — " +
       "a param the module has never heard of is dropped in silence");
  // the two the SCHEDULER writes rather than the recipe: velocity's physical
  // control and the portamento. Same failure mode, different writer.
  for (const k of Object.keys(u.dyn || {}))
    ok(DSP_PARAMS.has(k), "velocity moves \"" + k + "\" and tract_voice.dsp has no such param");
  ok(DSP_PARAMS.has(u.slideParam), "a slide writes \"" + u.slideParam + "\" and the tube has no such param");
}

/* ---------------------------------------------------------- 3. IT IS A SOLOIST
   The cost ceiling, stated three ways in the code and checked all three ways
   here, because "do not cast this on a pad" is a sentence and not a mechanism. */
console.log("one tube, one note — the ceiling is structural");
{
  const st = { bpm: 120, seed: 1 };
  const line = SE.pitchedUnit("melody", { model: "mouth" }, st);
  ok(line.mono === true && line.pool === 1,
     "the mouth unit arrives mono=" + line.mono + " pool=" + line.pool);
  ok(SE.effectivePool(line) === 1,
     "effectivePool gives a mouth " + SE.effectivePool(line) + " voices");
  // ...and again with the mono flag knocked off, which is the belt-and-braces
  // line in effectivePool: a later hand building this unit another way still
  // cannot get two.
  ok(SE.effectivePool({ ...line, mono: false, pool: 6 }) === 1,
     "a tract_voice unit built without `mono` seats " +
     SE.effectivePool({ ...line, mono: false, pool: 6 }) + " voices");
  // A PAD CANNOT REACH IT AT ALL — the parent's own switch
  const pad = SE.pitchedUnit("pad", { model: "mouth", vowels: "ou" }, st);
  ok(pad.module !== "tract_voice",
     "a PAD chair asking for a mouth built " + pad.module + " — a held chord " +
     "cannot be sung by one throat, and three of these is most of a phone");
  ok(pad.module === "voice_choir",
     "a pad asking for a mouth fell through to " + pad.module + " rather than the choir");
  // ...and the bridge's own refusal, one layer earlier
  ok(TE.mouthForInstr("synth_voice", GENRES.ebm.tone, true) === null,
     "to-engine hands a pad chair a tract");
  ok(TE.mouthForInstr("synth_voice", GENRES.ebm.tone, false) !== null,
     "to-engine refuses a LINE chair a tract — the cast is unreachable");
  // a genre may opt out and keep the string machine
  ok(TE.mouthForInstr("synth_voice", { mouth: { talk: 0 } }, false) === null,
     "a genre writing `talk: 0` still gets a tract — there is no way back to the VP-330");
  // the price is honest: heavier than the DX7, which is what 0.353x realtime means
  ok(SE.COST.tract_voice > SE.COST.voice_lead * 3.5,
     "tract_voice is priced at " + SE.COST.tract_voice + " against voice_lead's " +
     SE.COST.voice_lead + " — the budget, the eco shed and the stem split all read " +
     "this number, and a soloist that is really four singers wide must look like it");
}

/* -------------------------------------------------------------- 4. THE ROSTER
   Which records talk, by name, walked through the SHIPPED chain — recipeFor, the
   same function the tape and the cast both call — rather than through a shorter
   private rule. */
console.log("the roster — the records that have a mouth get one");
{
  const talking = [];
  const rows = [];
  for (const gk of GK) {
    const g = GENRES[gk];
    for (let v = 0; v < (g.voices || 1); v++) {
      const chair = chairAt(g, v);
      const un = [];
      const r = TE.recipeFor(chair, { chair, instr: instrAt(g, v), synth: g.synth, tone: g.tone }, {}, un);
      if (r && r.m && r.m.model === "mouth") { rows.push([gk, v, chair]); if (!talking.includes(gk)) talking.push(gk); }
    }
  }
  const want = Object.keys(CAST).sort();
  ok(JSON.stringify(talking.slice().sort()) === JSON.stringify(want),
     "the talking roster is [" + talking.sort().join(" ") + "] and the cast says [" +
     want.join(" ") + "] — a record either gained a mouth nobody argued for or lost " +
     "one silently, which is the espeak shape exactly");
  // ONE MOUTH PER RECORD. Not a style note: two tracts in one song is 0.7x
  // realtime before anything else plays.
  for (const gk of talking) {
    const n = rows.filter(r => r[0] === gk).length;
    ok(n === 1, gk + " seats " + n + " tracts — a second tube is most of what a " +
       "phone has left, and two of them is not a richer sound, it is the same mouth twice");
  }
  // the chair is the one intended, per row
  for (const [gk, v, chair] of rows) {
    ok(CAST[gk] === v, gk + " talks on voice " + v + " and the cast says " + CAST[gk]);
    ok(chair === "line", gk + " voice " + v + " talks off a \"" + chair + "\" chair");
  }
  // AND THE REFUSALS, held so they stay refusals: same GM id, pad chair, string
  // machine — the reading of "synth voice" that did not move
  for (const [gk, v] of Object.entries(REFUSED)) {
    const g = GENRES[gk];
    const chair = chairAt(g, v);
    const un = [];
    const r = TE.recipeFor(chair, { chair, instr: instrAt(g, v), synth: g.synth, tone: g.tone }, {}, un);
    ok(instrAt(g, v) === "synth_voice", gk + " voice " + v + " no longer casts synth_voice — " +
       "this refusal is testing nothing");
    ok(chair === "pad", gk + " voice " + v + " is no longer a pad chair — the refusal it " +
       "was standing for has moved");
    ok(r && r.m && r.m.model === "vp330", gk + " voice " + v + " now plays " +
       (r && r.m && r.m.model) + " where it played the VP-330 — a held chord lost its " +
       "string machine to a soloist");
  }
  console.log("  " + talking.length + " of " + GK.length + " genres talk; " +
              Object.keys(REFUSED).length + " keep the string machine");
}

/* ------------------------------------------------- 5. WHAT REACHES THE ENGINE
   The recipe is only half of it: the unit built FROM the recipe is what the
   worklet gets. Every cast row is resolved all the way to a unit, and the unit is
   asked the questions a silence would answer wrong. */
console.log("the unit each cast builds, all the way through");
const sentences = {};
for (const [gk, v] of Object.entries(CAST)) {
  const g = GENRES[gk];
  const chair = chairAt(g, v);
  const un = [];
  const r = TE.recipeFor(chair, { chair, instr: instrAt(g, v), synth: g.synth, tone: g.tone }, {}, un);
  sentences[gk] = SE.pitchedUnit(r.role, r.m, { bpm: 120, seed: 1 }).params.seed;
  for (const seed of [1, 3, 7]) {
    const u = SE.pitchedUnit(r.role, r.m, { bpm: 120, seed });
    ok(u.module === "tract_voice", gk + " builds " + u.module + " at seed " + seed);
    ok(SE.effectivePool(u) === 1, gk + " seats " + SE.effectivePool(u) + " tubes");
    // THE DRIVER IS ACTUALLY DRIVING. babble is the whole reason this model is
    // here — at 0 the tube holds a vowel and is an expensive voice_lead.
    ok(u.params.babble > 0.3, gk + " reaches the tube with babble " + u.params.babble +
       " — a tract that is not articulating is a formant bank that costs four times as much");
    // THE SENTENCE IS STABLE. Whatever supplies it, the one thing it may never do
    // is wander: the module's determinism doctrine is that the same seed replays
    // the same take, in the browser and in the offline press, because the driver
    // is a hash of a syllable counter and nothing else.
    ok(u.params.seed === sentences[gk],
       gk + " speaks sentence " + u.params.seed + " at song seed " + seed +
       " and " + sentences[gk] + " at another — a babble that wanders is not a take");
    // a register to speak in, and one wide enough that the fold is not rewriting
    // the part note by note
    ok(u.freqMin > 0 && u.freqMax > u.freqMin, gk + " reaches the engine with no compass");
    const st = 12 * Math.log2(u.freqMax / u.freqMin);
    ok(st >= 12, gk + "'s mouth has " + st.toFixed(1) + " semitones of range — narrower " +
       "than an octave and the fold starts refusing notes in key");
    // AND IT FITS. `unitCost` is the parent's own price — pool x module x the
    // insert chain — and BUDGET is the mobile ceiling every state is trimmed to.
    // The whole record has to fit under it, not just the mouth, so the claim is
    // the mouth plus the always-on master bus with room to spare for the band it
    // is standing in front of. (Measured through the shipped compile rather than
    // this arithmetic, the three land at 14.3, 16.4 and 17.8 against a 40 ceiling.)
    ok(SE.unitCost(u) + SE.COST.fx_bus < SE.BUDGET * 0.55,
       gk + "'s mouth alone costs " + SE.unitCost(u).toFixed(1) + " against a budget " +
       "of " + SE.BUDGET + " — there is no room left for the record around it");
  }
}
{
  // THREE RECORDS, THREE SENTENCES. Not decoration: the driver is seeded, so
  // three mouths on one seed would be one performance played three times, which
  // is the same complaint ("two identical copies is still one voice") that the
  // vocal round started from.
  const said = Object.values(sentences);
  ok(new Set(said).size === said.length,
     "the talking records say " + JSON.stringify(sentences) + " — two of them are " +
     "reciting the identical babble, which is one mouth wearing two names");
  console.log("  sentences: " + JSON.stringify(sentences));
}

/* ---------------------------------------------------------------- 6. THE MIRROR
   nukernel's page cannot load state-engine (the press walk runs in a worker), so
   to-engine.js keeps its own copy of the numbers — which is the arrangement §75
   of the nukernel gate already holds for MODEL_DYN and VOICE_TYPE. A copy drifts
   silently, so both of the tract's copies are held against the parent's own
   source text: the artifact, not the intent. */
console.log("the mirror — the page and the tape speak with one mouth");
{
  const litOf = (src, re) => { const m = src.match(re); return m ? new Function("return " + m[1])() : null; };
  const seDyn = litOf(seSrc, /const TRACT_DYN = (\{[^}]*\});/);
  const teDyn = litOf(teSrc, /const TRACT_DYN = (\{[^}]*\});/);
  ok(seDyn && teDyn, "cannot read TRACT_DYN out of both files — the mirror is unheld");
  ok(JSON.stringify(seDyn) === JSON.stringify(teDyn),
     "the page moves " + JSON.stringify(teDyn) + " where the tape moves " +
     JSON.stringify(seDyn) + " — one note, two instruments");
  const seRow = litOf(seSrc, /const TRACT_ROW = (\[[^\]]*\]);/);
  const teRow = litOf(teSrc, /const TRACT_ROW = (\[[^\]]*\]);/);
  ok(seRow && teRow && JSON.stringify(seRow) === JSON.stringify(teRow),
     "the two copies of the tube's vowel order disagree: " + JSON.stringify(teRow) +
     " against " + JSON.stringify(seRow));
  const comp = litOf(seSrc, /const TRACT_COMPASS = (\{[^}]*\});/);
  ok(!!comp, "cannot read TRACT_COMPASS out of state-engine.js");
  const sp = TE.mouthForInstr("synth_voice", GENRES.ebm.tone, false);
  ok(sp && sp.live && sp.live.lo === comp.lo && sp.live.hi === comp.hi,
     "the page folds a mouth into " + (sp && sp.live && sp.live.lo) + "-" +
     (sp && sp.live && sp.live.hi) + " Hz and the tape into " + comp.lo + "-" + comp.hi +
     " — the same line lands an octave apart");
  ok(sp && sp.dsp === "tract_voice" && /tract_voice:\s*\{\s*model:\s*"mouth",\s*role:\s*"melody"\s*\}/.test(teSrc),
     "to-engine no longer seats tract_voice on the melody strip");
}

/* -------------------------------------------------------- 7. THE VOWEL-ROW TRAP
   THE BUG THIS EXISTS TO CATCH WOULD NEVER HAVE FAILED ANYTHING. tract.lib's
   fitted table is indexed i-e-a-o-u (the vowel triangle, so a continuous glide is
   a walk a real mouth could make); the CSOUND formant tables the two SINGERS read
   are a-e-i-o-u. Same five letters, two rows swapped. A genre asking its tract for
   an open "a" would simply have said "i" for the whole record, at full volume,
   forever, with every gate green. */
console.log("the tube's own vowel order, which is not the singers'");
{
  const st = { bpm: 120, seed: 1 };
  const mouth = SE.pitchedUnit("melody", { model: "mouth", vowels: "aeiou" }, st);
  ok(JSON.stringify(mouth.vowels) === JSON.stringify([2, 1, 0, 3, 4]),
     "\"aeiou\" reaches the tube as " + JSON.stringify(mouth.vowels) +
     " — the tract is saying different vowels than the recipe wrote");
  ok(mouth.params.vowel === 2, "a mouth's first vowel is row " + mouth.params.vowel +
     " where an open /a/ is row 2 of the tube's table");
  // and the SINGER is untouched — it still reads the formant tables in their own
  // order, which is the whole reason the two arrays have to be different
  const singer = SE.pitchedUnit("melody", { model: "singer", vowels: "aeiou" }, st);
  ok(JSON.stringify(singer.vowels) === JSON.stringify([0, 1, 2, 3, 4]),
     "the formant singer's vowel walk moved to " + JSON.stringify(singer.vowels));
  // through the bridge, end to end, on the row a genre actually gets
  const sp = TE.mouthForInstr("synth_voice", { mouth: { vowels: "aeiou" } }, false);
  ok(JSON.stringify(sp.live.vowels) === JSON.stringify([2, 1, 0, 3, 4]),
     "the page spells the tube's vowels " + JSON.stringify(sp.live.vowels));
}

/* ---------------------------------------------------- 8. NOBODY ELSE MOVED
   Adding a row to the front of patchForInstr's chain is a change to every chair
   in the catalogue, whether or not it was meant to be. It answers null for a pad,
   for any id that is not GM 54 and for a genre that opted out — so every other
   seat in the roster must resolve exactly where it did, and the cheap way to say
   that is: no other id in the table reaches a tube. */
console.log("the rest of the catalogue is where it was");
{
  const ids = new Set();
  for (const gk of GK) {
    const g = GENRES[gk];
    for (let v = 0; v < (g.voices || 1); v++) ids.add(instrAt(g, v));
  }
  for (const id of ids) {
    const hit = TE.mouthForInstr(id, {}, false);
    ok(!hit || id === "synth_voice",
       "\"" + id + "\" reaches a tract — there is meant to be exactly one door to " +
       "the most expensive voice in the fleet");
  }
  // and the parent's other seatings of a throat are untouched
  const st = { bpm: 120, seed: 1 };
  ok(SE.pitchedUnit("melody", { model: "singer" }, st).module === "voice_lead",
     "the formant soloist no longer builds voice_lead");
  ok(SE.pitchedUnit("pad", { model: "chorale" }, st).module === "voice_choir",
     "the section no longer builds voice_choir");
}

console.log((fails ? "FAILED " : "ok — ") + checks + " checks, " + fails + " failure(s)");
process.exit(fails ? 1 : 0);
})();
