// test/precompose.test.js — 130 anchors × seeds {1,2,3} = 390 whole records.
//
// PROGRAM.md §5: "no throw · shape against every vocabulary table · the cell
// invariant · non-silence PER SECTION · ≥3 distinct cells per record · punk ≠
// bossa ≠ chant, named · determinism · the frozen-fixture no-op."
//
// PURE NODE. No DOM, no audio, no browser — the data tier stands on `require`
// alone, the way main:test/unit/nukernel.test.js:2688 already proved works.
//
// TEST THE ARTIFACT. Steps 4 and 6 do not read the document, they read the
// EVENTS the kernel emits from it — because three features have shipped broken
// in this repo while every structural check passed, and a record that type-
// checks and makes no sound is exactly that failure again. The render below
// reproduces ui/derive.js:395-440's own arithmetic (the bar measured off the
// GENRE, never off the phrase; the window that crops a long cell; drums and
// bass following the FIRST phrase) rather than calling document.js `scoreOf`,
// because scoreOf reads `sections[].bars` as musical bars and PROGRAM.md §2.1
// fixes it as CELL bars — see the RECIPE this slice shipped alongside.
"use strict";
const assert = require("assert");
const path = require("path");
const R = (p) => require(path.join(__dirname, "..", "nukernel", p));

const NG = R("genres.js"), NF = R("fields.js"), K = R("kernel.js");
const NI = R("instruments.js"), NuSongs = R("songs.js");
const Doc = R("document.js"), P = R("precompose.js"), NC = R("compose.js");
const { GENRES, MODES, SCALES } = NG;
const { WORDS, TERMS } = NuSongs;

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
};
const J = (x) => JSON.parse(JSON.stringify(x));

const KEYS = Object.keys(Object.assign({}, NF.KEYS));
const QUAL = new Set([...Object.keys(K.QSTEPS), ...Object.keys(K.QFIX)]);
// NOT Object.keys(GENRES): at runtime the page registers `lab.eight.N` rows
// into the same table (precompose.js `anchors` says why, and it was found in a
// browser). One owner for "what can be precomposed".
const ANCHORS = P.anchors();
const SEEDS = [1, 2, 3];

/* ---------- the score, exactly the way ui/derive.js builds one ---------- */
// `sec.bars` counts CELL bars (PROGRAM.md §2.1), so the MUSICAL length of a
// section is `bars × the cell's own bar count`, and that is the number both
// the render length and the window are measured in.
function sectionEvents(doc, i) {
  const g = Doc.toGenre(doc, i, GENRES);
  const sec = doc.form.sections[i];
  const lines = doc.voices.filter((v) => v.kind === "line");
  const phrases = lines.map((c) => Doc.toPhrase(doc, Doc.materialAt(c, sec.id)));
  const cb = Doc.barsOf(doc);
  const musical = Math.max(1, sec.bars * cb);
  const barSteps = K.stepsIn(g) / g.rate;
  const total = Math.ceil(musical / g.bars) * g.bars;
  const to = musical * barSteps;
  const out = [];
  const nP = phrases.length;
  phrases.forEach((ph, pi) => {
    const evs = K.render(ph, g, total);
    for (let v = pi; v < g.voices; v += nP)
      for (const e of evs) if (e.v === v) out.push({ ...e, kind: "line" });
  });
  const lead = phrases[0];
  if (lead) {
    const dr = K.drums(lead, g, g.bars), loopSteps = g.bars * barSteps;
    for (let r = 0; r < Math.ceil(total / g.bars); r++)
      for (const e of dr) out.push({ ...e, kind: "hit", t: e.t + r * loopSteps });
    for (const e of K.bass(lead, g, total)) out.push({ ...e, kind: "bass" });
  }
  return out.filter((e) => e.t >= 0 && e.t < to && (e.vel == null || e.vel > 0));
}

(async function main() {
  console.log("precompose — " + ANCHORS.length + " anchors × " +
              SEEDS.length + " seeds = " + ANCHORS.length * SEEDS.length + " records\n");

  /* THE ENGINE'S OWN ANSWERS, loaded once. `audio/to-engine.js` is an ES
     module and the only place that knows which names are modelled Faust voices
     (`SYNTH_NAMES`) and which recipe a chair actually resolves to
     (`recipeFor`). G1 needs the first (the document may now spell a chair
     "synth") and G12 needs the second, and both must be the ENGINE's answer
     rather than a second opinion about it — a census that resolved chairs by
     its own shorter rule would be measuring a different band than the one that
     plays. */
  const TE = await import(path.join(__dirname, "..",
    "nukernel", "audio", "to-engine.js"));
  const { SYNTH_NAMES } = TE;
  const FLEET = SYNTH_NAMES();
  // THE RECORD'S SIGNATURE, asked exactly the way `document.js synthOf` asks it
  // (its own line 51), because "may this chair say 'synth'" and "is there a
  // synth for it to mean" have to be the same question.
  const SIG = (doc) => (doc.sound && doc.sound.synth) ||
    (GENRES[doc.basis] || {}).synth || null;

  /* ================================================================== G0-G5
     One walk over every record. Each assertion is counted once for the whole
     sweep so a table error names the anchor rather than printing 366 lines. */
  const docs = new Map();
  const bad = { throw: [], shape: [], cell: [], silent: [], same: [], sound: [] };
  let nRecords = 0, nSections = 0, nEvents = 0, nCells = 0;
  const cbHist = {};
  // THE SOUND AXIS, COUNTED (STATE.md items 17 and 18). Every one of these was
  // 0 or 1 before this round: 0 records with a `sound.buses`, 0 with a
  // `voice.desk`, and one groove word on 97 anchors. A count that comes out
  // uniform is the same bug in a new spelling, so G9d measures the SPREAD and
  // not merely the presence.
  const hist = (h, k) => { h[k == null ? "(none)" : k] = (h[k == null ? "(none)" : k] || 0) + 1; };
  const hGroove = {}, hRet = {}, hColor = {}, hName = {};
  const hEchoTime = {}, hEchoFb = {}, hEchoTone = {}, hBoxFx = {}, hDeskKey = {};
  let nDeskVoices = 0, nVoices = 0, nBuses = 0, nEchoBus = 0;
  const noDesk = [];

  for (const gk of ANCHORS) for (const seed of SEEDS) {
    let doc;
    try { doc = P.genreToDocument(gk, seed); }
    catch (e) { bad.throw.push(gk + "/" + seed + ": " + e.message); continue; }
    docs.set(gk + "/" + seed, doc);
    nRecords++;
    const where = gk + "/" + seed;
    const say = (m) => bad.shape.push(where + ": " + m);
    /* THE BLANK STATE IS EXEMPT, BY THE FIELD AND NOT BY THE KEY (2026-09-01).
       Paul: "Add a 'silence' genre at the top of the genre list. This is a
       blank state." Four of the claims below are claims that a record MAKES
       SOUND, and they are right for every record — a record that type-checks
       and is silent is exactly the failure this file exists to catch. A blank
       state is the one row where silence is the answer rather than the bug, so
       it is named here ONCE, off `genres.js`'s own `silent: true`, and each
       exemption is written beside the claim it lifts. A second blank state
       tomorrow needs no new list, and any OTHER row that went quiet still
       fails every one of them. */
    const SILENT = !!GENRES[gk].silent;

    /* --- G1 SHAPE, against every vocabulary table --------------------- */
    for (const k of ["basis", "time", "alphabet", "material", "form",
                     "voices", "sound", "performance"])
      if (doc[k] == null) say("no " + k);
    if (doc.basis !== gk) say("basis is " + doc.basis);

    const T = doc.time;
    /* THE FENCE IS THE CODE'S, NOT A NUMBER TYPED HERE (rewritten 2026-09-02).
       This read `60 .. 200`, which was a THIRD fence: compose.js threw outside
       70..160, song.js's save door dropped anything outside 70..160, and this
       gate allowed a band neither of them did — so a widening or a narrowing
       could land without one of the three noticing. `fields.js BPM_LO/BPM_HI`
       is the one owner now (40..220 since the walls-down round of 2026-09-02,
       which let `poppunk` take the 167 its own corpus note had measured and
       could not spend), and the gate reads it, so the day the fence moves this
       line moves with it and the day the three disagree this goes red. */
    if (!Number.isFinite(T.bpm) || T.bpm < NF.BPM_LO || T.bpm > NF.BPM_HI)
      say("bpm " + T.bpm + " (fence " + NF.BPM_LO + ".." + NF.BPM_HI + ")");
    if (!Number.isFinite(T.rate) || T.rate <= 0) say("rate " + T.rate);
    /* THE METER VOCABULARY IS NOT A LABEL MAP ANY MORE (2026-09-07). This
       asked `NF.METERLABEL`, which names TWO WORDS — "three" and "six" — and
       fields.js's own comment beside it says exactly what that costs: "kernel.js
       `meterRow` counts ANY n/d, so the vocabulary is no longer a closed set
       and there is nothing left to enumerate… A signature labels itself." The
       same stale reader put `test/rules.test.js` R2 red on sixteen offers with
       no owner in the any-meter round of 2026-09-05; this is the third copy of
       it, found the first day a ROW wrote a fraction (`studioprog` "7/4",
       `progmetal` "7/8"). The one owner is kernel.js: a word METERS holds, or
       a signature `okMeter` accepts, and nothing else. */
    if (T.meter != null && !NF.METERLABEL[T.meter] && !K.okMeter(T.meter))
      say("meter " + T.meter);
    if (T.swing != null && !NF.SWINGS[T.swing]) say("swing " + T.swing);
    if (T.groove != null && !NF.GROOVELABEL[T.groove]) say("groove " + T.groove);

    const A = doc.alphabet;
    if (!KEYS.includes(String(A.key))) say("key " + A.key);
    if (!MODES[A.mode]) say("mode " + A.mode);
    if (A.scale != null && !SCALES[A.scale] && !MODES[A.scale]) say("scale " + A.scale);
    if (typeof A.diatonic !== "boolean") say("diatonic " + A.diatonic);
    if (!["modal", "cycle", "emergent"].includes(A.harmony)) say("harmony " + A.harmony);
    if (!Array.isArray(A.prog) || !A.prog.length) say("no prog");
    /* A PROG ENTRY IS A BAR, AND A BAR MAY HOLD MORE THAN ONE CHORD
       (rewritten 2026-09-05). This read `for (const c of A.prog)` and treated
       every entry as a chord, which was true of every record written before
       v277 (ee8366d, the composer's asks) answered *"Don't we need the chord
       editor to handle duration of chords? It must."* A bar is now either one
       chord object or a LIST of them sharing the bar by `beats` — kernel.js
       chordsOf:1041 is the owner of that reading (`const slot = at(g.prog,
       bar), list = Array.isArray(slot) ? slot : [slot]`), document.js:1730
       validates a save against exactly that shape, and precompose.js progOf
       carries it into the record. The gate was the only reader left on the
       old shape, so it asked an ARRAY for its `.d` and got `undefined` back:
       36 problems, and measured they were exactly the six half-bar changes
       this catalogue states — bossa 4, doowop 1, gospel 1 (the plagal amen,
       IV-I inside the last bar) — times two questions times three seeds.
       Nothing about the data is wrong; a turnaround inside one bar is the
       feature. So the bar is flattened here and every chord in it is asked
       the same two questions it always was, plus the one the new shape adds:
       a `beats` split is a whole number of steps, and it may only appear
       INSIDE a list, because a lone chord's window is the whole bar by
       construction and a `beats` on one would reach nothing. */
    for (const slot of A.prog || []) {
      const bar = Array.isArray(slot) ? slot : [slot];
      if (Array.isArray(slot) && !bar.length) say("prog bar with no chords");
      for (const c of bar) {
        if (!c || typeof c !== "object" || Array.isArray(c)) {
          say("prog chord " + JSON.stringify(c)); continue;
        }
        if (!Number.isInteger(c.d)) say("prog degree " + c.d);
        if (!QUAL.has(c.q)) say("prog quality " + c.q);
        if (c.beats != null && (!Number.isInteger(c.beats) || c.beats < 1))
          say("prog beats " + c.beats);
        if (c.beats != null && !Array.isArray(slot))
          say("prog beats on a lone chord");
      }
    }

    const names = Object.keys(doc.material.cells);
    if (!names.length) say("no cells");
    for (const n of names) {
      const c = doc.material.cells[n];
      if (c.kind === "drum") {
        if (!Object.keys(c.lanes || {}).length) say("empty kit cell " + n);
        continue;
      }
      nCells++;
      if (!Array.isArray(c.deg) || !c.deg.length) say("cell " + n + " has no deg");
      for (const f of ["play", "vel", "acc"])
        if (!Array.isArray(c[f]) || c[f].length !== c.deg.length)
          say("cell " + n + "." + f + " is not " + c.deg.length + " long");
      for (const p of c.play) if (!["n", "h", "r"].includes(p)) say("play word " + p);
      // EXEMPT ON A SILENT ROW: the blank state's one cell is sixteen rests,
      // which is the empty staff a hand writes onto — the only legally silent
      // cell in the catalogue, and it is silent BY DECLARATION.
      if (!SILENT && !c.play.includes("n")) say("cell " + n + " has no onset");
    }

    const secIds = doc.form.sections.map((x) => x.id);
    if (new Set(secIds).size !== secIds.length) say("duplicate section ids");
    for (const s of doc.form.sections) {
      if (!NF.ROLES[s.role]) say("role " + s.role);
      if (!Number.isInteger(s.bars) || s.bars < 1) say("bars " + s.bars);
      if (s.period != null && !NF.PERIODS[s.period]) say("period " + s.period);
      nSections++;
    }

    const vnames = doc.voices.map((v) => v.name);
    if (new Set(vnames).size !== vnames.length) say("duplicate voice names");
    let lines = 0, bassv = 0, drumv = 0;
    for (const v of doc.voices) {
      for (const id of secIds)
        if (v.development[id] == null) say(v.name + " has no word for " + id);
      if (v.kind === "line") {
        lines++;
        if (!K.PARTS[v.cast.part]) say(v.name + " part " + v.cast.part);
        if (!Number.isInteger(v.cast.reg) || v.cast.reg < -4 || v.cast.reg > 3)
          say(v.name + " reg " + v.cast.reg);
        if (!Number.isInteger(v.cast.entry) || v.cast.entry < 0)
          say(v.name + " entry " + v.cast.entry);
        // THE MENU IS THE VOCABULARY, and it is wider than INSTRCHOICES.
        // `avail.js instrOptions` offers a line chair three kinds of answer: a
        // sampled id (INSTRCHOICES), a Faust model BY NAME (the fleet), and —
        // when the record has a signature — the literal string "synth", which
        // `document.js:184,205` reads as "name nothing, the record's own keeps
        // the part". This check knew only the first, which is why it passed for
        // as long as precompose named a sample on every chair and failed the
        // moment one said "the record's own". Held against the page's own menu
        // so the two cannot drift.
        if (!NF.INSTRCHOICES[v.instrument] && !FLEET.includes(v.instrument) &&
            !(v.instrument === "synth" && SIG(doc)))
          say(v.name + " instrument " + v.instrument);
        for (const id of secIds)
          if (!WORDS[v.development[id]]) say(v.name + "/" + id + " word " +
            JSON.stringify(v.development[id]));
        const m = v.material;
        const cellsRead = typeof m === "string" ? [m] : Object.values(m);
        for (const c of cellsRead)
          if (!doc.material.cells[c] || doc.material.cells[c].kind === "drum")
            say(v.name + " reads no such line cell " + c);
      } else if (v.kind === "bass") {
        bassv++;
        if (v.cast.style && !NF.BASSOPS[v.cast.style]) say("bass style " + v.cast.style);
        for (const id of secIds) {
          const w = v.development[id];
          if (w !== "" && !NF.BASSOPS[w]) say("bass word " + JSON.stringify(w));
        }
      } else if (v.kind === "drums") {
        drumv++;
        if (!NF.DRUMKITS[v.instrument]) say("drumkit " + v.instrument);
        if (!doc.material.cells[v.material] ||
            doc.material.cells[v.material].kind !== "drum") say("drums read no grid");
        for (const id of secIds) {
          const w = v.development[id];
          if (w !== "" && !NF.KITLABEL[w]) say("kit word " + JSON.stringify(w));
        }
      } else say("voice kind " + v.kind);
    }
    // EXEMPT ON A SILENT ROW: `voices: 0` is the declaration, and the whole
    // point of the blank state is that the band is built INTO it.
    if (!lines && !SILENT) say("no line voices");
    if (bassv > 1 || drumv > 1) say("more than one rhythm-section voice");
    if (!GENRES[gk].nobass && !bassv) say("anchor has a bass and the record has none");

    if (doc.sound.level !== 1) say("sound.level " + doc.sound.level);
    if (doc.sound.master) {
      const known = new Set(NF.MASTER.map((f) => f.key));
      for (const [k, v] of Object.entries(doc.sound.master)) {
        if (!known.has(k)) { say("master." + k + " is not a MASTER key"); continue; }
        const f = NF.MASTER.find((x) => x.key === k);
        if (!(v in f.table)) say("master." + k + " = " + v + " is not one of its words");
      }
    }

    /* --- THE SOUND AXIS, WALKED OFF THE REGISTRY ITSELF -----------------
       Not against a list written here: against `NF.BUSES` and `NF.PARTMIX`,
       which are the same rows song.js validates a SAVE against. A hand-copied
       list of legal words is a list that goes stale, and a precomposer that
       invents a spelling would then round-trip through the loader as an
       unknown key and be dropped silently on the way in — which is exactly the
       failure this walk exists to catch. */
    const sound = (m) => bad.sound.push(where + ": " + m);
    const B = doc.sound.buses;
    if (B == null) sound("no sound.buses");
    else {
      nBuses++;
      for (const [bus, row] of Object.entries(B)) {
        const reg = NF.BUSBY[bus];
        if (!reg) { sound("bus " + bus + " is not a fields.js bus"); continue; }
        if (bus === "echo") nEchoBus++;
        for (const [k, v] of Object.entries(row)) {
          if (k === "eq") continue;                    // its own shape, and unwritten here
          const knob = reg.knobs.find((x) => x.key === k);
          if (!knob) { sound(bus + "." + k + " is not a knob of that bus"); continue; }
          if (!Object.prototype.hasOwnProperty.call(knob.table, String(v)))
            sound(bus + "." + k + " = " + JSON.stringify(v) + " is not one of its words");
        }
      }
      if (!B.rev || B.rev.ret == null) sound("no rev.ret — the return is still shut");
      else {
        hist(hRet, B.rev.ret); hist(hColor, B.rev.color); hist(hName, B.rev.name);
        // THE FINDING FIELDS.JS:466 NAMES, ASSERTED: "78% wet and bone dry, for
        // as long as this page has existed." A `ret` that resolves to 0 is that
        // bug written down in a document instead of left out of one.
        if (!(NF.RETURNS[B.rev.ret] > 0))
          sound("rev.ret " + B.rev.ret + " resolves to " + NF.RETURNS[B.rev.ret]);
      }
      if (B.echo) { hist(hEchoTime, B.echo.time); hist(hEchoFb, B.echo.fb);
                    hist(hEchoTone, B.echo.tone); }
    }
    // THE CHARACTER CHIP MOVED OFF THE RECORD AND ONTO THE CHAIRS, 2026-08-27
    // (Paul: "We can get rid of Character right?"). This counted
    // `doc.sound.fx` and checked its keys; the record-wide field is retired,
    // so the same census is taken where the chip lives now — the FIRST voice's
    // `desk.fx`, because precompose deals one chain to the whole cast and
    // counting it once per record is what the histogram means.
    if (doc.sound.fx) sound("sound.fx is retired and this record still carries one");
    hist(hBoxFx, ((doc.voices[0] && doc.voices[0].desk &&
                   doc.voices[0].desk.fx) || []).join("+") || null);

    let deskHere = 0;
    for (const v of doc.voices) {
      nVoices++;
      if (!v.desk) continue;
      deskHere++; nDeskVoices++;
      for (const [k, val] of Object.entries(v.desk)) {
        hist(hDeskKey, k);
        const f = NF.PARTMIXBY[k];
        if (!f) { sound(v.name + ".desk." + k + " is not a PARTMIX key"); continue; }
        // A `list` FIELD IS CHECKED MEMBER BY MEMBER (2026-08-27). `fx` is the
        // one PARTMIX row whose value is an array (fields.js: `{key:"fx",
        // type:"list", table:FX, max:MAX_FX}`), and until the character chips
        // were dealt to the chairs no precomposed record wrote one — so this
        // walk stringified the whole array and asked the FX table for it,
        // which every chain would have failed. Same question, per member,
        // plus the row's own cap.
        if (f.type === "list") {
          if (!Array.isArray(val)) { sound(v.name + ".desk." + k + " is not a list"); continue; }
          for (const one of val)
            if (!Object.prototype.hasOwnProperty.call(f.table, String(one)))
              sound(v.name + ".desk." + k + " member " + JSON.stringify(one) +
                    " is not one of its words");
          if (f.max != null && val.length > f.max)
            sound(v.name + ".desk." + k + " is longer than the row's max");
          continue;
        }
        if (f.table && !Object.prototype.hasOwnProperty.call(f.table, String(val)))
          sound(v.name + ".desk." + k + " = " + JSON.stringify(val) + " is not one of its words");
      }
      // AND IT MUST SURVIVE THE REGISTRY'S OWN CLEANER. desk-doc.js cleanEntry
      // drops every dead spelling of a default before the entry reaches a box,
      // so an entry that cleans away to nothing is an entry that draws on the
      // board and reaches no sound.
      if (JSON.stringify(NF.resolvePartMix(v.desk)) ===
          JSON.stringify(NF.resolvePartMix(null)))
        sound(v.name + ".desk resolves to the untouched channel");
    }
    if (!deskHere) noDesk.push(where);
    hist(hGroove, doc.time.groove);
    if (doc.performance.take !== 0 || doc.performance.ontime !== true)
      say("performance defaults moved");

    // THE PAGE MUST NOT HAVE TO REPAIR IT. `normalize` fills a missing word,
    // prunes a word for a section that is gone and repoints a voice at a cell
    // that is not there — so if it CHANGES a precomposed record, the compiler
    // wrote something the page silently rewrites, and what plays is not what
    // this file said. A no-op here is the whole claim.
    {
      const before = JSON.stringify(doc);
      Doc.normalize(doc);
      if (JSON.stringify(doc) !== before) say("normalize() repaired the record");
    }
    // ...and every section becomes exactly one box the state tier can hold.
    {
      const bx = Doc.boxesOf(doc, "gate.");
      if (bx.length !== doc.form.sections.length) say("boxesOf lost a section");
      bx.forEach((b, i) => {
        if (b.len !== doc.form.sections[i].bars) say("box " + i + " len " + b.len);
        // EXEMPT ON A SILENT ROW: a box with no slots is a section nobody
        // plays, which is what a blank state IS. Everywhere else it is a bug.
        if (!SILENT && !b.stack[0].slots.length) say("box " + i + " has no slots");
      });
    }

    /* --- G2 THE CELL LENGTHS ------------------------------------------ */
    /* Every LINE cell is a whole multiple of stepsIn(meter), and `barsOf` is
       the longest of them in bars.

       THIS USED TO DEMAND ONE LENGTH FOR THE WHOLE DOCUMENT and does not any
       more (2026-09-05, the review's item 8: *"A three-bar ostinato under a
       four-bar tune is not writable."*). A hand may now give each chair its own
       phrase length; the walk loops each on its own period and the section's
       end cuts it, and the chord schedule stays shared because `toGenre` stamps
       `cellBars` and `kernel.js render` divides its loop counter by it.
       WHAT THE COMPOSER DEALS IS STILL ONE LENGTH — `cellBarsOf` picks one `cb`
       per record — so this gate still asserts the composed set is uniform (a
       reading that dealt two lengths by accident is still a bug) and says so as
       its own line rather than as the law it used to be. */
    /* ...AND THE BAR IS COUNTED IN THE RECORD'S OWN STEPS, THROUGH THE ONE
       OWNER (2026-09-07). This resolved the meter through `NF.METERLABEL` too,
       so a fractional signature fell to null and the cell was measured against
       SIXTEEN: `studioprog`'s 7/4 bar is 28 steps and `progmetal`'s 7/8 is 14,
       and both were reported as "not a multiple of 16" — a gate failing on a
       record that is exactly right. `K.stepsIn` is `metOf` and `metOf` reads
       the word, then the fraction, then home, which is the same walk every
       renderer makes. */
    const steps = K.stepsIn({ meter: T.meter });
    const lens = new Set(names.filter((n) => doc.material.cells[n].kind !== "drum")
                              .map((n) => doc.material.cells[n].deg.length));
    if (lens.size !== 1)
      bad.cell.push(where + ": the COMPOSER dealt " + lens.size +
                    " cell lengths (a hand may write two; a reading may not)");
    for (const L2 of lens)
      if (L2 % steps) bad.cell.push(where + ": cell " + L2 + " is not a multiple of " + steps);
    const L = Math.max(...lens);
    const cb = Doc.barsOf(doc);
    if (cb !== L / steps) bad.cell.push(where + ": barsOf says " + cb + ", the longest cell says " + L / steps);
    cbHist[cb] = (cbHist[cb] || 0) + 1;

    /* --- G3 ≥3 DISTINCT CELLS ---------------------------------------- */
    const shapes = new Set(names.filter((n) => doc.material.cells[n].kind !== "drum")
      .map((n) => doc.material.cells[n].deg.join(",") + "|" +
                  doc.material.cells[n].play.join("")));
    // EXEMPT ON A SILENT ROW: three distinct figures is a claim about a record
    // that has figures. The blank state has exactly one, and it is empty.
    if (shapes.size < 3 && !SILENT) bad.same.push(where + ": only " + shapes.size + " distinct cells");

    /* --- G4 NON-SILENCE, PER SECTION --------------------------------- */
    doc.form.sections.forEach((s, i) => {
      const ev = sectionEvents(doc, i);
      nEvents += ev.length;
      // EXEMPT ON A SILENT ROW, and this is the exemption that matters: G4
      // renders the ARTIFACT and asserts that every section sounds. On the
      // blank state the artifact is a bar of rests looping — the transport
      // runs, the countdown counts, and nothing plays. That is the feature.
      if (!ev.length && !SILENT) bad.silent.push(where + " section " + i + " (" + s.role + ")");
    });
  }

  // 139 since 2026-08-25, and the number is deliberately still a LITERAL: the
  // gate's whole point is that anchors() returns the catalog and not the
  // `lab.eight.N` session keys the page registers into the same table, and a
  // count derived from GENRES would pass while both drifted together. So it
  // is bumped by hand by whoever grows the catalog — 122 anchors + the eight
  // 2020s rows ("'now' is a lie, it's the 2010s", Paul, 2026-08-24) + the
  // nine African anchors ("fix the afrobeat parents and add the missing
  // African history", Paul, 2026-08-25: Aksum 540, Accra 1957, Johannesburg
  // 1935/1939/1994, Kinshasa 1960, Addis Ababa 1969, Bamako 1970, Oran 1985)
  // + the SIXTY of the world round ("Fill in lots of world historical genres
  // including non western stuff over a long period of time", Paul,
  // 2026-08-26: 21 in Latin America and the Caribbean, 9 in Africa, 5 in East
  // Asia, 6 in Southeast Asia, 3 in South Asia, 6 in the Middle East and
  // Central Asia, 5 in Europe and 5 in North America)
  // + the TWO news themes ("I want you to add 1970s news theme and 2000s news
  // theme as genres", Paul, 2026-08-28: London 1970 and New York 2006)
  // + the TWELVE of the four-traditions round ("Add the missing genres and
  // start filling in western, Arabic and Chinese and Indian classical music",
  // Paul, 2026-08-29): the two most-wanted missing ancestors in the whole
  // catalogue (jumpblues, wanted by six rows, and tinpanalley, wanted by
  // five), three Western art-music holes the table itself named (chorale,
  // belcanto, serial), three Arabic (taqsim, firqa, nuba), two Chinese
  // (guqin, sizhu) and two Indian (dhrupad, carnatic). FOUR MORE WERE
  // DRAFTED AND REFUSED under WORLD.md §4's primary-fact rule — jingju,
  // guoyue, khyal and gamelan — and the reasons are at the foot of that
  // block in genres.js, which is the point of the rule.
  // + the THIRTY-TWO of the genealogy round ("how can we add lots more
  // related genres quickly across time (then do it)", Paul, 2026-08-29):
  // grown by paying the catalog's own debts rather than a wishlist — the
  // wants census had 23 strings wanted by two or more rows and this round
  // paid seventeen of them by name (boogiewoogie ×3; deltablues, krautrock,
  // miamibass, quietstorm, spirituals, eurodisco, neworleans, berlinschool,
  // gothicrock, operaseria, danzon, maxixe, lundu, modinha, ottoman and
  // ballad ×2 each), plus habanera, acidrock, glam, phillysoul, italodisco,
  // newjackswing, hardcorerave and crunk on single wants, plus the two
  // ancestors the timeline demanded (gagaku Nara 752, andalusi Córdoba 822 —
  // the 8th and 9th centuries existed and the map now says so, plus isorhythm
  // Florence 1436 and lied Vienna 1814 for the two emptiest Western
  // centuries), plus four children that densify living clusters (gfunk,
  // grime, dubstep — the 2000s had eight rows — and quietstorm's own soul
  // shelf). FIVE multi-dependent wants were examined and DECLINED with
  // reasons at the foot of the genealogy block in genres.js: dastgah
  // (quarter tones, WORLD.md §2 wall 3), tape music (the material is not
  // notes), latin percussion (an instrumentation, not a genre), maringa
  // (first datable records contemporary with its own child) and the full
  // ottoman makam (paid narrowly as ottoman in Hicaz instead). TWO
  // backwards WANTS were found and rewritten in place, dated, at their
  // rows (hymn asking for spirituals, continuo for opera seria), and one
  // backwards PARENT edge was closed (motorik <- dusseldorfschool, three years
  // its own child's junior, reparented onto krautrock Cologne 1971).
  // + the THIRTY-SEVEN of the debts round ("Keep going on genres", Paul,
  // 2026-08-29, the same lane's next shift): grown by paying the wants
  // ledger again — six multi-dependent debts paid BY NAME (field holler as
  // `holler`, South Carolina 1853, Olmsted's eyewitness print, ×4 counting
  // skiffle's "work song"; cologneschool ×3; the amen break ×2 as `amenbreak`,
  // the band and the B-side, because a seven-second sample is a record and
  // not a genre; the cuban contradanza ×2, Havana 1803; abbasid court song
  // ×2 as `abbasid`, Baghdad 800; the zodiak free arts lab ×2) — plus the
  // decade histogram's own thin stretches filled at the isorhythm standard:
  // four rows where the 800s-1100s held three for seven centuries (sticheron,
  // sequence, winchester — which closes organum's gregorian:1
  // simplification — and antiphon), Josquin's 1500s (francoflemish, Venice 1502,
  // Petrucci's first single-composer print), BOTH halves of the 1610-1660
  // gap (secondapratica, sacredconcerto), the 1840s-50s (contradanza 1803 predates it;
  // holler 1853 and nothing else could be argued — the viennese waltz
  // stays declined on the triple-meter reason), twelve want-paying 19th-
  // and 20th-century rows (operetta, musichall, furnituremusic, march, broadway,
  // territoryband, modaljazz, girlgroup — which pays songwriterpiano AND
  // punk's "girl groups" — garagerock, baroquepop, psychrock, protopunk,
  // progrock), the metal wing the table lacked entirely (heavymetal
  // Workington 1969 — NOT Birmingham: the atlas's own Southall note
  // measured that dot blocked, so the row takes the first named
  // performance under the name, 30 August 1969 — nwobhm, thrash), the
  // culture gap before electro (blockparty, Bronx 1973), psychfunk, technopop,
  // triphop, chopped, and the 2010s brought from seven rows to ten
  // (synthwave Paris 2010, footwork Chicago 2013, gqom Durban 2016).
  // FOUR were examined and DECLINED with reasons at the debts round's
  // foot in genres.js: the amen break as its own row (a record, not a
  // genre), barbershop (no verifiable named dated performance found this
  // shift), vaudeville (a stage format, not a music) and muzak (a
  // licensing company). The genealogy round's five declines stand
  // unbeaten. TWO new shared wants were opened on purpose with matched
  // spellings so the ledger counts one debt each ("jamaican sound
  // system": boombap + blockparty; "hardcore": screamo + thrash).
  // + the EIGHT of the deep-time round ("Great keep going but also look
  // backwards in time to bone flutes and lutes" / "Don't forget Ancient
  // Rome", Paul, 2026-08-30): the catalog started at Rome 600 and now
  // starts forty millennia earlier — hohlefels (Hohle Fels 33000 BC, the
  // griffon-vulture flute), jiahu (Jiahu 6000 BC, the playable gudi),
  // urlyre (Ur 2500 BC, the Royal Cemetery lyres), hurrian (Ugarit 1400
  // BC, tablet h.6), delphic (Delphi 128 BC), carmen (Rome 17 BC,
  // Horace's Carmen Saeculare), skolion (Tralles 100, the oldest
  // complete song) and oxyrhynchus (Oxyrhynchus 300, the oldest notated
  // Christian music). BC years are NEGATIVE in WHEN — the label
  // convention ("Place Year BC") and the fail-closed argument are at
  // atlas.gate.js LABEL_RE. Declined with reasons at the round's header
  // in genres.js: the hydraulis, a lute row of its own, any
  // jiahu-to-downstream edge, and the Divje Babe artifact.
  // + the SEVEN of the same round's forward half — the previous shift's
  // own named debts: hardcore (Washington 1980, Bad Brains — paying the
  // matched "hardcore" want on screamo and thrash), honkytonk (Fort Worth
  // 1941) and westernswing (Tulsa 1940) for the 1940s' two missing
  // country rooms, dreampop (London 1984, paying shoegaze's want), doom
  // (Stockholm 1986, the metal wing's missing floor), jpop (Tokyo 1999)
  // and contenanceangloise (London 1420, the Old Hall Manuscript, paying isorhythm's
  // contenance-angloise want). The 2000s stay thin on purpose — 10 rows
  // to the 1990s' 29 — named as the next ask rather than half-paid.
  // + the SIXTEEN of the goth-and-globe round (Paul, 2026-08-30: "Need
  // way more gothy genres and way more spread of global jazz. Keep
  // using Wikipedia to add density."). THE GOTH WING, seven: deathrock
  // (Pomona 1982, Only Theatre of Pain — Pomona is Rozz Williams's own
  // town, the Kinks rule, LA 1982 being aor's), batcave (London 1982,
  // the Dean Street club-night on the zodiak venue ruling, paying
  // gothicrock's forward-pointing want by arrival), coldwave (Rennes
  // 1979, Dantzig Twist, paying postpunk's forward want the same way),
  // leedsgoth (York 1981 — the first DATABLE show; Leeds measured
  // blocked by Halifax at 5.8px under G10's 8.5 floor, the
  // Workington-not-Birmingham ruling replayed, noted in atlas.js),
  // gothicmetal (Halifax 1991, Paradise Lost's Gothic, the record that
  // named it), dungeonsynth (Notodden 1994, Født til å Herske) and
  // witchhouse (Traverse City 2010, King Night). THE JAZZ GEOGRAPHY,
  // nine, against a catalog that held ONE non-US jazz dot: gypsyjazz
  // (Paris 1934), latinjazz (New York 1947, Manteca), descarga (Havana
  // 1957, Cachao's Panart session), capejazz (Cape Town 1974,
  // Mannenberg), tradjazz (London 1954, New Orleans Joys — paying
  // skiffle's "trad jazz revival" BY NAME: Rock Island Line was cut
  // inside that album), indojazz (London 1966, Indo-Jazz Suite),
  // japanjazz (Tokyo 1974, Midnight Sugar), nordicjazz (Oslo 1970,
  // Afric Pepperbird — which deliberately OPENS "free jazz" as a want,
  // so the ledger asks for Ornette by name) and tsabatsaba (Bulawayo
  // 1947, the amenbreak a-record-is-the-honest-row ruling). EXAMINED
  // AND DECLINED with reasons at the round's header in genres.js:
  // darkwave and "township jazz" (umbrellas made of the catalog's own
  // rows), ethereal wave (its archetype record IS dreampop's anchor),
  // jazz manouche as a second key (Wikipedia's own filing), and the
  // five US-history jazz rooms (freejazz, hardbop, cooljazz, fusion,
  // spiritualjazz) the ask's geography did not cover and the ledger
  // did not owe.
  // + the TWELVE of the downtempo round (Paul, 2026-08-30: "Now we need
  // more noirhop massive attack and maybe 10 more downtempo bands.").
  // THE RULING FIRST: Blue Lines is `triphop`'s anchor, so Massive
  // Attack's own artist row (bristolsound, Bristol 1998) anchors on
  // Mezzanine — a record pays one debt, the amenbreak rule generalized;
  // the argument is at the round header in genres.js. The Bristol wing:
  // noirhop (Bristol 1994, Dummy — Barrow was a Coach House tape op
  // on Blue Lines) and knowlewest (Bristol 1995, Maxinquaye — the dot is
  // Bristol on the Kinks/Pomona rule, the tape ran in London). The
  // diaspora: acidjazz (London 1988, Frederick Lies Still — AJ001, the
  // scene the 90s crate-dug), viennadownbeat (Vienna 1993, G-Stoned),
  // chillout (London 1996, Who Can You Trust?), torchbreaks (Manchester 1996,
  // Lamb), instrumentalhiphop (San Francisco 1996, Endtroducing — instrumental by
  // its own genre line), downtempo (Washington 1996, Sounds
  // from the Thievery Hi-Fi — NOT instrumental, the ZIM lead names its
  // guest singers), air (Versailles 1998, Moon Safari — Versailles is a
  // new dot declared inside Paris in atlas.js WITHIN), nujazz (Paris
  // 2000, Tourist, instrumental) and tromso (Tromsø 2001, Melody A.M.
  // — the map's northernmost dot). EXAMINED AND DECLINED with reasons
  // at the round header: a `downtempo` umbrella row (the darkwave
  // ruling), chillout (a compilation of other people's records fails
  // the batcave test), nightmaresonwax (Leeds is measured blocked,
  // 5.8px, the leedsgoth wall), hooverphonic (Sint-Niklaas lands ~1 px
  // from Antwerp and "Antwerp 1996" would contradict the ZIM's own
  // infobox), boardsofcanada (the IDM shelf, which the catalog does
  // not hold at all — a named next ask), and zero7/bonobo/
  // groovearmada/unkle as thin.
  // + the TWENTY-FIVE of the folk-floor round (Paul, 2026-08-30: "we're
  // missing all kinds of folk traditions plus Pygmy and Romm and classic
  // nursery rhymes. We also could use some classic film soundtracks, 80s
  // and 90s sitcom themes, John Carpenter horror and incidental stock
  // music of all kinds. Plus tons of Miami vice jan hammer michael mann
  // synth incidental stuff"). THE FOLK FLOOR, sixteen, each on a named
  // collection/record/event: shanty (London 1961, Hugill), appalachia
  // (Hot Springs 1916, Sharp at Jane Gentry's), oldtime (Galax 1935, the
  // fiddlers' convention — paying THREE wants: bluegrass's old-time,
  // countrypop's fiddle, and folkduo's ballad via its parent row),
  // klezmer (New York 1923, Brandwein — the hijaz mode's second music),
  // georgian (Tbilisi 1966, Chakrulo/Erkomaishvili), nordicfolk (Oslo
  // 1853, Lindeman — paying nordicjazz), chanson (Paris 1936, Piaf —
  // paying nhacvang), taraf (Clejani 1986, the Ocora tapes — the row
  // pays the TRADITION, the edge to gypsyjazz cannot close by the WHEN
  // law and its want is reworded to the pre-Django 78s), flamenco
  // (Granada 1922, the Concurso — paying rumbacatalana), mbuti (Epulu
  // 1958, Turnbull — the HOCKET RULING: fill(1) + disjoint keep() masks
  // interlock four voices into one line, measured disjoint with the
  // union covering all sixteen places; the yodel break stays a cannot),
  // nursery (London 1744, Tommy Thumb's), polka (Prague 1837 — paying
  // nortena AND maxixe), cajun (New Orleans 1928, Falcon — paying
  // zydeco), tarantella (Galatina 1959, De Martino), seannos (Carna
  // 1957, Joe Heaney — paying irishtrad) and barbershop (New York 1910,
  // the American Quartet's Play That Barber Shop Chord — OVERTURNING
  // the debts round's decline on its own terms: the named dated record
  // it said was missing, found). THE COMMISSIONED SCREEN, nine, the
  // news pair's law at other desks: photoplay (Cleveland 1913, Zamecnik
  // — paying newsfanfare's "library music" and, via the existing
  // anchor, instrumentalhiphop's crates), goldenagescore (Los Angeles 1938), suspensescore
  // (Los Angeles 1960), spaghettiwestern (Rome 1966, voices scored as
  // instruments), spyscore (London 1962, the Bond theme — paying
  // noirhop), horrorsynth (Los Angeles 1978 — paying deathrock AND
  // synthwave), copshowsynth (Miami 1984 — synthwave's second dated
  // memory-edge), sitcom (Los Angeles 1983, Cheers) and sitcomsting (Los
  // Angeles 1989, Wolff's sampler sting, a NOLINK by honest failure).
  // DECLINED with reasons at the round header in genres.js:
  // bal-musette and the compás (the triple-meter wall, unchanged),
  // muzak (the debts ruling stands), the Hammer horror score, the
  // griot/jeliya row (primary-fact rule; named next ask), a second
  // library-beds row, and every umbrella the ask's plural implied.
  // 350 -> 358 on 2026-08-30, the walls-down round: waltz, musette,
  // tarab, dastgah, jingju, khyal, gamelan, tapemusic — the exemplars
  // for the five felled walls (genres.js, the walls-down block).
  // bal-musette's own decline above was REVERSED the same day it was
  // written (meter landed); guoyue was examined and stays EMPTY.
  // 358 -> 369 on 2026-08-30, the ledger round ("Fill in missing genres
  // that are wanted"): eleven rows, each the payment of a written want —
  // horrorscore, idm, exotica (the first Pacific dot; the coastline
  // re-bake), muwashshah, zajal, soundsystem, jubilee, rumba, lautari,
  // doina, chazzanut. The wants that stay open are CLOSED-with-reason at
  // the round's own ledger block in genres.js.
  // 369 -> 373 on 2026-08-30, the unlocking round ("Unlock the missing
  // stuff. Get qiyan working"): four rows, each the DEFEAT of a refusal
  // this catalog had already written down and dated — qiyan (Medina 705),
  // hardingfele (Oslo 1849), tasnif (Tehran 1924), scotsfiddle (Edinburgh
  // 1796). Every one fell to the same method and the ledger says so: the
  // previous shift probed one name per refusal, this one probed fifty.
  // Kulning and the griot/jeliya row were re-probed and STAY CLOSED, both
  // re-dated in place with the evidence that closed them.
  // 373 -> 374 on 2026-08-30, the Wax Trax round (Paul: "Where is wax trax
  // industrial"). ONE row, and it was already named in the catalogue's own
  // hand: `industrialrock` carried `wants: ["wax trax industrial"]` and the
  // two Chicago rows that descend from it — `industrialmetal` 1988 and `ebm`
  // 1989 — were already here, so the label was their missing PARENT and not
  // a new corner. `industrialdance` (Chicago 1981) ships on the batcave rule, which
  // the ZIM answers twice over: the label pressed Strike Under's Immediate
  // Action in 1980 and Ministry's Cold Life in 1981, and that second record
  // is the one the article says "set the stage".
  /* 374 -> 375, 2026-08-31: `balearic` (Montreal 2011). Paul asked for the
     band by name; the ZIM chose the RECORD — Shapeshifting rather than the
     2007 debut, because the debut is the Slowdive lineage `dreampop` already
     anchors and the ethereal-wave ruling forbids a second row for one
     archetype. The Lissvik production is the thing this table did not hold.
     Montreal is a new dot (North America), baked to 369 WHEN rows. */
  /* 375 -> 377, 2026-08-31: `ambientpop` (Sutton Courtenay 1993) and
     `slowcore` (Boston 1989). Paul, after balearic landed: "I guess we
     need Slowdive and Galaxie 500 too right?" — and the two rows ship for two
     DIFFERENT reasons, which is why neither is a duplicate. slowcore fills a
     HOLE: its own infobox reads "Indie rock / dream pop / slowcore" and
     slowcore had no anchor here at all, the Velvets-descended slow thin thing
     that is neither shoegaze's wall nor dreampop's wash. ambientpop is the
     bristolsound-vs-triphop shape instead: `shoegaze` is anchored on Loveless
     by its own comment, and Souvlaki is a different record making a different
     claim — half the snare, a sung lead, and a pad where the second wall of
     fuzz goes. The ethereal-wave ruling forbids a row whose ARCHETYPE is
     another row's anchor, and neither of these is that.
     ONE new dot for two rows, and the arithmetic is in atlas.js: Sutton
     Courtenay (9.3 px from Swindon, clearing the 8.5 floor by under a pixel),
     with Reading REFUSED at 5.1 px from Bray, Weston-super-Mare at 7.7 from
     Bristol, and Cambridge MA at 0.2 from Boston — that last one a refusal the
     gate could not have made, since G10 asserts only at the Britain arc.
     slowcore takes Boston, a dot the map already drew. Baked to 371 WHEN
     rows. `balearic`'s generic shoegaze 0.2 edge was replaced the same day
     by the two acts its article actually names. */
  /* 377 -> 387, 2026-09-01: Paul's list of missing acts — artrock,
     baggy, softrock, electroindustrial, electropop, artpop, worldbeat,
     beiruttarab, hinrg, newpop. Every place was checked in the ZIM (three of my
     guesses were wrong) and every parent checked for being EARLIER than its
     child; electropop is the early era only, because the later ones were
     already here as industrialmetal and industrialdance. */
  /* 387 -> 395, 2026-09-01, the soundtrack round: Paul, "add lots of movie
     soundtracks especially the Hans Zimmer type but also just in general
     nail down the current big braaaannnng sound and synth sweeps and
     orchestral vibes. Star Wars etc." Eight rows, keys all GENRE terms per
     the same message's naming law: spaceopera, epichybrid (the braam),
     trailerscore, crimejazz (paying newsfanfare's standing want by name),
     fantasyscore, nordicscore, dramascore, frontierscore. Two parents were
     refused on DATES against the round's own spec (suspensescore 1960 and rnb
     1994 out of crimejazz 1955; trailerscore re-dated 2012 so epichybrid
     2010 stays legal), and one label was refused by the MAP (spaceopera's
     Denham measured 4.0 px from Bray — the Reading ruling; the row's own
     comment carries the whole story). */
  /* 395 -> 396, 2026-09-01, the Rules round: Paul, "Add a 'silence' genre at
     the top of the genre list. This is a blank state." ONE row — `silence`,
     the blank state the box boots into: one eight-bar head section, one line
     cell of sixteen rests, nobody seated. It is a genre and not a mode so that
     every door the catalogue already has opens onto it, and it is counted here
     like every other anchor. The literal stays a literal for the reason :649
     gives — a count derived from GENRES would pass while both drifted. */
  /* 396 -> 417, 2026-09-02, THE MIDI-CORPUS ROUND (COMPOSER.md §5 item 2).
     Paul, 2026-09-01: a list of ~45 representative artists and "Make heavy
     use of our MIDI archive for these, don't just imagine", plus "you should
     also search the MIDI library for many more genres while you're in
     there." TWENTY-ONE rows, every structural number read off
     /mnt/sources/relocated/stellate-midi-corpus with tools/mine/mine-midi.js
     and printed in each row's own comment (file count, tempo distribution
     with tempo-event files only, meter and mode tallies, the drum lanes as a
     sixteen-step histogram, the four-bar cycle the corpus votes for):
     grunge, postgrunge, britpop, postbritpop, poppunk, numetal, glammetal,
     funkrock, blackmetal, skapunk, collegerock, raprock, southernhiphop,
     contemporaryrnb, trance, eurodance, teenpop, retrosoul, neotraditional,
     smoothjazz, chiptune. Keys are GENRE terms per the 2026-09-01 rename
     law; every act Paul named is in a row comment as the named record.
     Nine standing anchors were IMPROVED rather than twinned (artrock,
     boombap, gfunk, clubpop, powerballad, worldbeat, softfolk,
     singersongwriter, darkrnb) — the brief's own instruction where a genre
     already exists — and eight tempi moved because the corpus disagreed with
     what the row had been written from. Six places joined the map (Seattle,
     Berkeley, Long Beach, Athens, Virginia Beach, Kyoto) and the
     (place, year) key forced four rulings, each on its own row. The literal
     stays a literal for the reason :649 gives. */
  /* 417 -> 421, 2026-09-02, THE CHORDONOMICON GAPS (the catalogue round,
     shift 2). A census of the 666,000-progression Chordonomicon against this
     table returned nine labels with thousands of songs each and no row of
     ours. FIVE WERE DECLINED as twins or as machine labels and the declining
     is argued at the block in genres.js: album rock is `aor` (the ZIM even
     redirects the phrase to Album-oriented_rock), permanent wave redirects to
     Perm_(hairstyle) and is an EchoNest cluster tag, indie rock is
     `collegerock` + `janglepop` by its own article's lead, contemporary
     country is `countrypop`'s literal `roots: [0,4,5,3]` with 8,982 of 8,982
     songs also tagged plain "country", and hard rock is `rock`'s own
     `roots: [0,0,6,6,3,3,0,0]` with 137 of its 544 corpus files by `rock`'s
     named band. FOUR WERE REAL and three of them were already owed by a
     `wants` string: folkrock (Los Angeles 1965, Mr. Tambourine Man),
     countryrock (Nashville 1968, Sweetheart of the Rodeo), heartlandrock
     (Asbury Park 1975, Born to Run) and chamberpop (Boston 1994, Cardinal).
     Five wants closed, five downstream rows re-weighted in the other
     direction, one place joined the map.
     A SIXTH DECLINE, 2026-09-03 (shift 3): BRO-COUNTRY, asked for by name
     (Nashville 2012, "Cruise"), REFUSED ON A MEASUREMENT and argued at the
     same block in genres.js. Chordonomicon carries 5,151 labels and not one
     of them is that word in any spelling; the MIDI corpus carries 120,652
     files and returns ZERO for Florida Georgia Line, Luke Bryan, Jason
     Aldean, Blake Shelton, Cole Swindell, Chase Rice, Brantley Gilbert,
     Dustin Lynch, Thomas Rhett and Sam Hunt together. No tempo distribution,
     no meter tally, no drum histogram, no chord cycle — none of what the four
     rows above were built out of. The count stays 421.
     The literal stays a literal for the reason :649 gives.
     ...AND +7, 2026-09-03, SHIFT 4's BATCH C — beyond the Anglosphere and
     the metal wing, all seven off Chordonomicon and the MIDI corpus:
     rockenespanol (Buenos Aires 1967, Los Gatos' "La balsa"), nuevacancion
     (Santiago 1966, Violeta Parra's Las Últimas Composiciones — the map's
     first Chilean dot), schlager (Hamburg 1960, Polydor's Freddy Quinn),
     iskelma (Helsinki 1955, Olavi Virta on Rytmi), metalcore (Westfield
     2002, Alive or Just Breathing), powermetal (Hamburg 1985, Walls of
     Jericho — Hamburg twice, twenty-five years apart, which the label law
     allows) and symphonicmetal (Kitee 1997, Angels Fall First). Two of the
     seven are argued AGAINST a named alternative on a measurement rather
     than on taste: metalcore takes Westfield 2002 over Converge's Boston
     1998 because the label's Chordonomicon mass is 5 songs in the whole of
     the 1990s against 312 in the 2000s and its commonest distinctive window
     is melodic (`III i VI III`, 10.49x), and nuevacancion takes Santiago
     over Havana 1968 because the Cuban branch is the nueva TROVA and is
     named differently in its own language. Two rows report NO CORPUS FILES
     AT ALL (nuevacancion, iskelma) and say in their notes which of their
     numbers are therefore choices rather than readings.
     ...AND +6, 2026-09-03, SHIFT 4's BATCH B — pop, folk and the two
     Christian rows, every one of them off Chordonomicon and the MIDI corpus:
     ccm (Nashville 1978, Amy Grant's Myrrh debut, the year CCM Magazine
     coined the phrase), worship (Sydney 1993, Hillsong's "Shout to the
     Lord" — the map's first dot on the Australian mainland), indiefolk
     (London 2009, Sigh No More at Eastcote), powerpop (Memphis 1972, Big
     Star's #1 Record at Ardent, the year the article itself calls "year
     zero"), skatepunk (Los Angeles 1988, Bad Religion's Suffer at
     Westbeach) and indietronica (Seattle 2003, the Postal Service's Give
     Up on Sub Pop). Three of the six are argued AGAINST a named
     alternative: worship takes Sydney 1993 over Costa Mesa 1971 because
     the 1971 record is acoustic Jesus music and is `folkrock` with a hymn
     text on it; indiefolk takes London 2009 over Seattle 2008 because
     Fleet Foxes are a choral record and `softfolk`/`chamberpop` already
     hold that; skatepunk takes 1988 over the proposed 1990 because the
     article dates the melodic style to Suffer by name. TWO ROWS REPORT A
     SILENT CORPUS AND SAY SO: indiefolk matches ONE file in 120,652 (Of
     Monsters and Men, "Little Talks") and indietronica reaches its label
     through one act only (Owl City), so each says in its note which of its
     numbers is a reading and which is a choice. `indietronica` is also the
     round's first row whose natural article does not exist — Indietronica
     redirects into a SECTION — so it links Electronic rock and carries
     `as: "Indietronica"` under the plate law.
     ...AND +6, 2026-09-03, SHIFT 4's BATCH A — country, roots and blues,
     the six rooms this table had names for and no rows: rockabilly
     (Memphis 1954, "That's All Right" at Sun on 5 July, the session the
     article dates to the hour), nashvillesound (Nashville 1957, Jim
     Reeves's "Four Walls", which the article's own historian calls the
     first record of it), outlawcountry (Austin 1973, Shotgun Willie),
     southernrock (Macon 1969, The Allman Brothers Band), rootsrock
     (Berkeley 1969, Creedence's Green River) and bluesrock (West
     Hampstead 1966, the Beano album). TWO PLACES JOINED THE MAP and one
     was refused by measurement: Macon lands 5.8 CSS px from Atlanta at
     the North America arc, which G10 prints and does not assert on; West
     Hampstead lands 1.6 px from London at the BRITAIN arc, which G10 does
     assert on, so it is the fourth name in that list with a WITHIN row
     rather than a plain dot (its nearest undeclared neighbour is Bray at
     9.3 px, the Sutton Courtenay margin). EL CERRITO WAS REFUSED at 0.3
     px from Berkeley — tighter than Teaneck/New York at 1.1 and than
     Asbury Park/New York at 3.0 — on `slowcore`'s own ruling, which
     refused Cambridge MA at 0.2 from Boston; rootsrock takes the East Bay
     dot the map already draws and its note records the attempt so nobody
     re-derives it. "London 1966" was unavailable for bluesrock in any
     case: `indojazz` holds it. Two rows are argued AGAINST a named
     alternative on a measurement: rockabilly refuses mixolydian (bVII at
     1.18x against II at 1.53x over 3,280 Chordonomicon songs, where
     `rocknroll` resolves the other way) and takes SCALES.majpent, the
     only five-note alphabet in this wing; bluesrock refuses the twelve-bar
     its own repertory came from because the census's top window is a
     four-bar `IV I V IV` at 4.21x on 194 songs. EVERY ROW IN THIS BATCH
     REPORTS AT LEAST ONE SILENCE: "outlaw country", "nashville sound",
     "southern rock", "rockabilly" and "blues rock" all return ZERO files
     as filename terms; Waylon Jennings, Carl Perkins, Molly Hatchet and
     John Mayall return zero as acts; and bluesrock's own founding band is
     absent from the corpus while 27 of its 53 files are Clapton's solo
     catalogue — which the note says before it quotes a tempo.
     ...AND +7, 2026-09-03, SHIFT 4's BATCH D2 — MOTOWN AND THE FOUR ACTS
     PAUL NAMED ("Some things missing include a lot of motown... We also
     need Public Enemy, Digable Planets, Pharcyde, Mary J. Blige"). Every
     key is a genre term under the 2026-09-01 law and every note names the
     act in its own first sentence, so a row is findable by both:
     northernsoul (Manchester 1970, Gloria Jones's "Tainted Love" at the
     Twisted Wheel), progressivesoul (Detroit 1971, What's Going On),
     psychsoul2 (Detroit 1968, "Cloud Nine" — `as: "Psychedelic soul #2"`,
     the article held by psychsoul), politicalhiphop (Long Island 1988,
     It Takes a Nation of Millions), jazzrap (Brooklyn 1993, Reachin'),
     althiphop (South Central 1992, Bizarre Ride II the Pharcyde) and
     hiphopsoul (New York 1992, What's the 411? — it carried
     `as: "Hip-hop soul #2"` under the key `hiphopsoul2` until THE SWAP,
     2026-09-04, when Paul ruled on the disagreement this batch recorded:
     the article coins the term for this record, so it took the bare key
     and the article outright and the Jodeci row it displaced became
     `newjackswing2`, `as: "New jack swing #2"`). THREE LABELS ARE ARGUED AGAINST THE
     ONE THAT WAS PROPOSED, each on a measurement: "Wigan 1973" was
     REFUSED BY THE MAP (7.1 CSS px from Manchester, 7.3 from Liverpool,
     both under G10's 8.5 floor at the Britain arc, and neither pair
     declarable — the Southall ruling), so northernsoul takes the origin
     room and its note records that Blackpool measured CLEAR at 10.7 px
     for a future hand; althiphop takes South Central because `gfunk`
     already holds "Los Angeles 1992" and the two records really are two
     Los Angeleses; politicalhiphop takes Long Island over a free "New
     York 1988" by the Seattle ruling, the room over the desk. THREE ROWS
     REPORT NO CORPUS FILES AT ALL (politicalhiphop, jazzrap, althiphop —
     the one path matching "public enemy" is a wrestling theme) and
     hiphopsoul reports TWO after naming the five false positives; the
     Motown rows are measured instead on what the scene played (41
     Motown-catalogue files over 115 bpm; 9 Whitfield-era Temptations; 19
     Stevie Wonder and Marvin Gaye), and each note says which numbers are
     readings and which are choices. Chordonomicon carried all seven
     labels but one: "hip hop soul" returns ZERO songs and hiphopsoul
     says so before falling back to "hip pop".
     ...AND +6, 2026-09-03, SHIFT 4's BATCH D1 — "way more funk" (Paul:
     "DEFINITELY James Brown, we need way more funk"). deepfunk (Cincinnati
     1970, Sex Machine / Funky Drummer at Starday-King — the James Brown row
     asked for by name, and it is the 1970 J.B.'s rather than the 1967 Cold
     Sweat `funk` already holds, four differences argued in its note),
     neworleansfunk (New Orleans 1969, the Meters' "Cissy Strut"),
     jazzfunk (San Francisco 1973, Head Hunters at Wally Heider), gogo
     (Washington 1978, "Bustin' Loose"), boogie (New York 1981, D-Train on
     Prelude) and minneapolissound (Minneapolis 1982, Prince's 1999 — the
     map's first Minnesota dot, and the only new place the batch needed).
     TWO LABELS ARE ARGUED AGAINST THE ONE PROPOSED: jazzfunk takes San
     Francisco 1973 because `songwriterpiano` holds New York 1971 outright,
     and Head Hunters is the better record anyway; boogie takes New York
     1981 because it is the single free year between `disco` (1977) and
     `electro` (1982), which is the gap the row exists to fill.
     TWO ROWS REPORT NO CORPUS FILES AT ALL and say so rather than dressing
     up a false positive: gogo matches ZERO of 120,652 for Chuck Brown,
     Trouble Funk, Rare Essence or E.U. (the naive search returns fifteen
     hits and every one is Wham!, The Go-Go's or an agogô bell), and
     Chordonomicon carries ONE song at the `go-go` label. neworleansfunk
     matches seven files and NOT ONE OF THEM IS A METERS FILE; boogie
     matches eleven and every one is Kool & the Gang rather than D-Train.
     Each note says which of its numbers is a reading and which is a
     choice. THE ONE THAT MEASURED CLEAN, and it is worth the line: boogie's
     article states "tempo generally in the 110 to 116 beats-per-minute
     range" and the corpus set measured p25 110 / med 114 / p75 118
     independently — the encyclopaedia and the archive agreeing, which
     almost never happens. minneapolissound's snare balance is 0.86 over 50
     Prince files, the highest of the six sets, which is a Linn LM-1 with no
     ghost note in it and is the exact opposite of deepfunk's ghost lane.
     ONE EDGE WAS REFUSED ON THE DATE and the refusal is in the row: the
     Minneapolis sound article calls the genre "a subgenre of funk rock",
     and `funkrock` here is Los Angeles 1984, two years LATER, so the `not
     later` law refuses it and `funk` carries the share. `funk`'s own
     open want, "new orleans second line", ALSO stays open for the same
     law — New Orleans 1969 cannot parent Cincinnati 1967 — and
     neworleansfunk's note is where the next hand is told why.
     The literal stays a literal for the reason :649 gives. */
  /* 453 -> 478, 2026-09-03, the batch-E rounds: fifteen Western classical
     anchors and ten Indian and Chinese ones, the two halves of Paul's last
     brief of the night ("we really need to fill in India and China in the
     classical period... we should have lots of representative classical
     genres"). The literal stays a literal for the reason :649 gives. */
  /* 478 -> 479, 2026-09-04: `grandopera` (Paris 1831). Batch E DECLINED it
     on "Meyerbeer returns zero files anywhere"; that census read file PATHS
     and the composer is in the MIDI TEXT EVENTS, where a byte grep finds six
     of him. Paul: "Figure out what happened to grand opera."
     The literal stays a literal for the reason :649 gives. */
  /* 479 -> 482, 2026-09-06: the three STARTING POINTS (`dance`, `guitarrock`,
     `pop`). Paul: "Add a few simple genres at the top: dance, rock, pop —
     really basic starting points to go with silent." They are anchors to this
     gate like any other row — they compose, they seat a band, they render —
     and they are NOT anchors to the atlas, which is the distinction `EXCLUDE`
     draws and which G0 has never been about. The literal stays a literal for
     the reason :649 gives. */
  /* 482 -> 500, 2026-09-07: eighteen rows for Paul's two lists — the Lou
     Reed / Purple Rain / New Power Generation / Television / Talking Heads /
     Slayer / Justice / Steve Miller / Traffic / a-ha / Winwood / Whitney /
     Dolly Parton list, and "We definitely need all the Pink Floyd eras too."
     FOUR ROWS PAUL ASKED FOR WERE REFUSED BECAUSE THE TABLE ALREADY HELD
     THEM, which is why this is 500 and not 504: the Velvet Underground is
     `protopunk` (New York 1966), Kill 'Em All is `thrash` (San Francisco
     1983), the Meddle-era Floyd is `spacerock` (London 1973) and the Whitney
     ballad is `powerballad` (Los Angeles 1991), each said in its own row's
     first paragraph. The literal stays a literal for the reason :649 gives. */
  ok("G0 the catalog is 500 anchors, session keys excluded", () =>
    assert.strictEqual(ANCHORS.length, 500,
      "anchors() returned " + ANCHORS.length));
  ok("G0b " + ANCHORS.length * SEEDS.length + " records, no throw", () => {
    assert.strictEqual(bad.throw.length, 0, bad.throw.slice(0, 5).join("\n      "));
    assert.strictEqual(nRecords, ANCHORS.length * SEEDS.length);
  });
  ok("G1 shape against every vocabulary table", () =>
    assert.strictEqual(bad.shape.length, 0,
      bad.shape.length + " problems, first five:\n      " + bad.shape.slice(0, 5).join("\n      ")));
  ok("G2 the cell invariant", () =>
    assert.strictEqual(bad.cell.length, 0, bad.cell.slice(0, 5).join("\n      ")));
  ok("G3 ≥3 distinct cells per record", () =>
    assert.strictEqual(bad.same.length, 0, bad.same.slice(0, 5).join("\n      ")));
  ok("G4 no section is wholly silent", () =>
    assert.strictEqual(bad.silent.length, 0,
      bad.silent.length + " silent sections, first five:\n      " +
      bad.silent.slice(0, 5).join("\n      ")));

  /* ================================================================== G5
     THE IDIOM IS REAL. "A punk hook is not a bossa hook and not a chant" is
     the requirement, and a gate that does not check it is not checking it. */
  const hookOf = (gk) => {
    const d = docs.get(gk + "/1");
    const c = d.material.cells;
    return c.hook || c[Object.keys(c).find((k) => c[k].kind !== "drum")];
  };
  const onsets = (c) => c.play.filter((p) => p === "n").length;
  const heldMean = (c) => {
    let tot = 0, n = 0, i = 0;
    while (i < c.play.length) {
      if (c.play[i] !== "n") { i++; continue; }
      let L = 1; while (i + L < c.play.length && c.play[i + L] === "h") L++;
      tot += L; n++; i += L;
    }
    return n ? tot / n : 0;
  };
  const punk = hookOf("punk"), bossa = hookOf("bossa"), chant = hookOf("gregorian");
  ok("G5a punk's hook is not bossa's — deg, play and onset count all differ", () => {
    assert.notStrictEqual(punk.deg.join(","), bossa.deg.join(","), "same degrees");
    assert.notStrictEqual(punk.play.join(""), bossa.play.join(""), "same play row");
    assert.notStrictEqual(onsets(punk), onsets(bossa),
      "same onset count (" + onsets(punk) + ")");
  });
  ok("G5b punk's hook is not the chant's", () => {
    assert.notStrictEqual(punk.deg.join(","), chant.deg.join(","), "same degrees");
    assert.notStrictEqual(punk.play.join(""), chant.play.join(""), "same play row");
  });
  ok("G5c bossa's hook is not the chant's", () => {
    assert.notStrictEqual(bossa.deg.join(","), chant.deg.join(","), "same degrees");
    assert.notStrictEqual(bossa.play.join(""), chant.play.join(""), "same play row");
  });
  ok("G5d the chant holds its notes more than twice as long as punk does", () => {
    const c = heldMean(chant), p = heldMean(punk);
    assert.ok(c > p * 2, "chant " + c.toFixed(2) + " vs punk " + p.toFixed(2) +
      " × 2 — articulation is not reaching the play row");
  });

  /* ================================================================== G6
     DETERMINISM. Same arguments, deep-equal document; and a seed is a song. */
  ok("G6a genreToDocument is pure — a second call is deep-equal", () => {
    for (const gk of ANCHORS)
      assert.deepStrictEqual(J(P.genreToDocument(gk, 1)), J(docs.get(gk + "/1")), gk);
  });
  ok("G6b seed == null is seed 1", () =>
    assert.deepStrictEqual(J(P.genreToDocument("punk")), J(docs.get("punk/1"))));
  let moved = 0;
  for (const gk of ANCHORS)
    if (JSON.stringify(docs.get(gk + "/1")) !== JSON.stringify(docs.get(gk + "/2"))) moved++;
  /* G6c WAS GREEN WHILE THE BUG WAS SHIPPING, and the reason is written here
     because it is the whole lesson of the round. Paul, 2026-08-27: *"No matter
     how many times I hit REWRITE the hook is the same on Iranian pop."* He was
     right, and this check said 199 of 199 records moved — because `form`,
     `voices` and `sound` move with the seed and MATERIAL did not, on any
     anchor. "A different record" was true of the document and false of the
     tune. G6e below asks the question this one only looked like it was
     asking. */
  ok("G6c a different seed is a different record for ≥90% of anchors", () =>
    assert.ok(moved / ANCHORS.length >= 0.9,
      moved + " of " + ANCHORS.length + " moved between seed 1 and seed 2"));
  /* G6e A DIFFERENT READING IS A DIFFERENT TUNE — the claim the rewrite button
     makes, asserted on the CELLS and not on the document. Measured before the
     fix over 199 anchors x 8 seeds: 1,910 cell instances and NOT ONE changed
     content; the hook was byte-identical across five readings on 193 of the
     199. `cellOf` never took the seed (precompose §6b has the mechanism), so
     the number here was 6 of 199 and this gate did not exist. */
  {
    const hookMoved = [], anyMoved = [];
    for (const gk of ANCHORS) {
      const cells = SEEDS.map((s2) => (docs.get(gk + "/" + s2).material || {}).cells || {});
      const names = new Set();
      for (const c of cells) for (const k of Object.keys(c)) names.add(k);
      let any = false, hook = false;
      for (const k of names) {
        // PRESENT-AT-ONE-SEED IS NOT VARIATION. A kind the record deals in one
        // reading and not another makes `undefined !== {...}` true and says
        // nothing about the tune, which is exactly how the old measurement
        // flattered itself. Only cells that EXIST in two readings are compared.
        const seen = cells.map((c) => c[k]).filter(Boolean).map((v) => JSON.stringify(v));
        if (new Set(seen).size > 1) { any = true; if (k === "hook") hook = true; }
      }
      if (any) anyMoved.push(gk);
      if (hook) hookMoved.push(gk);
    }
    ok("G6e a different reading is a different TUNE — the hook's own notes " +
       "move for ≥90% of anchors across " + SEEDS.length + " readings", () =>
      assert.ok(hookMoved.length / ANCHORS.length >= 0.9,
        hookMoved.length + " of " + ANCHORS.length + " moved a hook; frozen: " +
        ANCHORS.filter((g) => !hookMoved.includes(g)).slice(0, 8).join(" ")));
    /* EXEMPT ON A SILENT ROW (2026-09-01). "No genre in the catalog has one
       tune and one only" is a claim about a genre that has a TUNE. Paul: "Add
       a 'silence' genre at the top of the genre list. This is a blank state."
       Its one cell is sixteen rests and it is the SAME sixteen rests at every
       reading, on purpose — a blank page that came back different each time
       you opened it would be a blank page with an opinion. Named off the row's
       own `silent`, like every other exemption in this file. */
    const TUNED = ANCHORS.filter((g) => !GENRES[g].silent);
    ok("G6f …and every anchor with a tune moves SOME cell, so no genre in the " +
       "catalog has one tune and one only", () =>
      assert.strictEqual(TUNED.length - anyMoved.filter((g) => !GENRES[g].silent).length, 0,
        TUNED.filter((g) => !anyMoved.includes(g)).slice(0, 8).join(" ")));
  }
  /* G6g READING 1 IS TODAY. The atlas opens every anchor at seed 1, so the
     record a hand LANDS on may not move when the reading machinery lands —
     only pressing rewrite may. Asserted against the frozen fixture rather than
     against a rerun of the same code, which would only prove the code equals
     itself: `cellOf` with no reading is what reading 1 composes. */
  ok("G6g reading 1 composes the cells `cellOf` composes with no reading at " +
     "all — absent is today, on every anchor", () => {
    const bad = [];
    for (const gk of ANCHORS) {
      const G = GENRES[gk];
      /* EXEMPT ON A SILENT ROW (2026-09-01): this mirror re-derives every cell
         through `cellOf`, and the blank state's `motif` is not a cellOf
         product at all — it is written directly, sixteen rests, by the third
         of precompose's three named `silent` exemptions. Re-deriving it here
         would be asking the idiom engine to answer for a cell it did not
         write. The claim it is exempt from — "reading 1 is today" — is held
         for the blank state instead by R4 in test/rules.test.js, which pins
         the cell exactly. */
      if (G.silent) continue;
      const { row: row0 } = P.idiomOf(gk);
      // THE ANCHOR'S OWN COUNT (2026-08-30, the walls-down round): this
      // call read `P.cellOf(row, k, 1, G, 16)` while no anchor declared a
      // meter; `waltz` and `musette` count in three now, and the door
      // (precompose:1852) attaches `met` to the theme row and derives
      // steps from it — so the mirror here must too, or the gate compares
      // a twelve-step record against a sixteen-step re-derivation of
      // itself and fails on the meter, not on a drift.
      /* ...AND THE THIRD COPY OF THE SAME STALE READER (2026-09-07). This
         said `K.METERS[G.meter]`, and `METERS` is the two WORDS — so the day a
         row wrote "7/4" the mirror re-derived a 28-step record at sixteen
         steps and reported a drift that was its own. `metOf` is the resolver
         every renderer uses (a word, then a fraction, then home) and it is
         what this mirror has to use to be a mirror. */
      const met = G.meter ? K.metOf({ meter: G.meter }) : null;
      const row = met ? { ...row0, met } : row0;
      const doc1 = docs.get(gk + "/1");
      const cells = (doc1.material || {}).cells || {};
      /* THE MIRROR READS cb OFF THE ARTIFACT (2026-09-01, the two-bar
         release). This call hard-coded `cb = 1` — correct while
         CELL_BAR_CEILING was 1, and the moment the ceiling rose to 2 the
         gate was comparing a two-bar record against a one-bar re-derivation
         of itself and failing on the ceiling, not on a drift (the same
         mirror bug this block already fixed once for the meter, above).
         Re-deriving cb from the section lens is CIRCULAR here — the doc's
         `bars` count cell bars, which already have cb divided out — so the
         mirror takes it from the cell under test: a cell's gate is cb bars
         of steps, and gate.length / steps-per-bar is a fact the document
         states rather than one this gate assumes. */
      const spb = met ? met.steps : 16;
      for (const k of Object.keys(cells)) {
        if (cells[k].kind !== "line") continue;          // `beat` is the kit
        // `play` is the cell's onset vector (spaceopera at cb 2: 32 entries,
        // waltz in three: 12) — measured, the first draft of this mirror read
        // a `gate` field cells do not carry and silently fell back to cb 1
        const pl = cells[k].play;
        const plen = Array.isArray(pl) ? pl.length : String(pl || "").length;
        const cb1 = Math.max(1, Math.round((plen || spb) / spb));
        const made = P.cellOf(row, k, cb1, G, spb);  // no sixth argument
        if (JSON.stringify(made.cell) !== JSON.stringify(cells[k])) bad.push(gk + "." + k);
      }
    }
    assert.strictEqual(bad.length, 0, bad.slice(0, 8).join(", "));
  });
  ok("G6d an unknown anchor throws BY NAME", () => {
    assert.throws(() => P.genreToDocument("no-such-genre", 1),
      /precompose: no anchor "no-such-genre"/);
  });

  /* ================================================================== G7
     ABSENT IS TODAY. This slice added two SCALES rows, a HARMONYLABEL row and
     one export to compose.js; none of them may move the shipped record. The
     frozen fixture is the pre-move capture of ui/eight.js `genreFor(i)`. */
  // The fixture is a PORTRAIT — a genre carries four functions and JSON drops
  // them — and `portrait()` is its single owner, required rather than
  // re-implemented for the reason its own header gives: a fixture and the
  // assertion that reads it must be two views of one function or they drift.
  const { portrait } = require("./fixtures/terms-genre.freeze.js");
  const FROZEN = require("./fixtures/terms-genre.json");
  ok("G7a the shipped chant compiles to the frozen genre at every section", () => {
    const T = J(TERMS);
    T.form.sections.forEach((s, i) => assert.deepStrictEqual(
      J(portrait(Doc.toGenre(T, i, GENRES, FLEET), K)), J(FROZEN.sections[i]),
      "section " + i));
  });
  ok("G7b the two new SCALES rows name the five anchors that had no word", () => {
    const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    for (const gk of ANCHORS) {
      const s = GENRES[gk].scale;
      if (!s) continue;
      assert.ok(Object.values(SCALES).some((v) => eq(v, s)) ||
                Object.values(MODES).some((v) => eq(v, s)),
        gk + " declares a scale no key names");
    }
    assert.deepStrictEqual(SCALES.blues, [0, 3, 5, 6, 7, 10]);
    assert.deepStrictEqual(SCALES.bluesx, [0, 1, 3, 5, 6, 8, 10]);
  });
  ok("G7c HARMONYLABEL names exactly the three words the catalog uses", () => {
    const used = [...new Set(Object.values(GENRES).map((g) => g.harmony))].sort();
    assert.deepStrictEqual(Object.keys(NG.HARMONYLABEL).sort(), used);
  });

  /* ================================================================== G8
     THE SOUND AXIS IS WRITTEN — STATE.md item 17, "the single largest gap in
     the round": "0 of 122 precomposed records carry a `voice.desk`, a
     `sound.buses` or a `sound.fx` … Click Kingston and you get a record whose
     seven voices have no desk on them at all."

     ABSENT IS STILL TODAY, AND IT IS PROVED FIRST. Everything after G8a is a
     count of what precompose now SAYS; G8a is the promise that a document
     which says nothing is unmoved, because a writer that made silence
     impossible would have broken the law it was asked to keep. */
  const DD = R("desk-doc.js");
  const stripSound = (doc) => {
    const d = J(doc);
    for (const v of d.voices) delete v.desk;
    delete d.sound.buses; delete d.sound.master; delete d.sound.fx;
    return d;
  };
  ok("G8a absent is today — strip the Sound axis off all 122 and the desk " +
     "takes the untouched branch", () => {
    for (const gk of ANCHORS) {
      const d = stripSound(docs.get(gk + "/1"));
      assert.strictEqual(DD.deskPartsOf(d, GENRES), null, gk + " deskPartsOf");
      assert.strictEqual(DD.busesOf(d), null, gk + " busesOf");
      assert.strictEqual(DD.masterOf(d), null, gk + " masterOf");
      // `assert.deepStrictEqual(DD.boxFxOf(d), [])` came off here 2026-08-27
      // with the reader itself — the record-wide chain is retired and
      // `deskIsDefault` no longer counts it (desk-doc.js has the tombstone).
      assert.strictEqual(DD.deskIsDefault(d, GENRES), true, gk + " deskIsDefault");
    }
  });
  ok("G8b every one of the " + ANCHORS.length * SEEDS.length +
     " records carries a sound.buses", () =>
    assert.strictEqual(nBuses, nRecords, nBuses + " of " + nRecords));
  ok("G8c every value is a legal registry key, walked off NF.BUSES / NF.PARTMIX", () =>
    assert.strictEqual(bad.sound.length, 0, bad.sound.length +
      " problems, first five:\n      " + bad.sound.slice(0, 5).join("\n      ")));
  ok("G8d the desk reaches the voices — ≥90% of records set a chair", () => {
    const withDesk = nRecords - noDesk.length;
    assert.ok(withDesk / nRecords >= 0.9, withDesk + " of " + nRecords +
      " records set a chair; the ones that do not: " + noDesk.slice(0, 6).join(" "));
  });
  ok("G8e desk-doc addresses every stored entry — no chair is written and lost", () => {
    for (const gk of ANCHORS) {
      const d = docs.get(gk + "/1");
      const set = d.voices.filter((v) => v.desk).length;
      const landed = Object.keys(DD.deskPartsOf(d, GENRES) || {}).length;
      assert.strictEqual(landed, set, gk + ": " + set + " voices carry a desk, " +
        landed + " reach a channel");
    }
  });

  /* --- G8f VARIETY. This is the assertion STATE.md item 18 exists for: a
     field that is written for the first time and says ONE word is a field
     nobody derived. "a bossa and a boom-bap are handed the same groove word."
     So the shape of the distribution is the test, not the presence of it. */
  const spread = (h, floor) => {
    const e = Object.entries(h).filter(([k]) => k !== "(none)");
    const tot = e.reduce((a, [, v]) => a + v, 0);
    const top = Math.max(...e.map(([, v]) => v));
    return { words: e.length, tot, top, share: top / tot,
             ok: e.length >= floor && top / tot <= 0.6 };
  };
  ok("G8f the groove word is various — every GROOVELABEL word is used, and " +
     "none of them covers more than 60% of the records that have one", () => {
    const sp = spread(hGroove, Object.keys(NF.GROOVELABEL).length);
    assert.ok(sp.ok, sp.words + " of " + Object.keys(NF.GROOVELABEL).length +
      " words, top share " + (sp.share * 100).toFixed(0) + "% — " +
      JSON.stringify(hGroove));
  });
  ok("G8g the return is various — ≥3 RETURNS words and ≥4 rooms", () => {
    const r = spread(hRet, 3), c = spread(hColor, 4);
    assert.ok(r.ok, "returns " + JSON.stringify(hRet));
    assert.ok(c.ok, "rooms " + JSON.stringify(hColor));
  });
  ok("G8h a dub record and a chant do not get the same return", () => {
    const b = (gk) => docs.get(gk + "/1").sound.buses.rev;
    assert.notDeepStrictEqual(b("dub"), b("gregorian"),
      "dub and gregorian share a bus row: " + JSON.stringify(b("dub")));
    assert.notStrictEqual(b("punk").ret, b("gregorian").ret,
      "punk and the chant land in the same return (" + b("punk").ret + ")");
    // ...and the echo bus exists exactly where the anchor asked for one
    for (const gk of ANCHORS) {
      const want = (GENRES[gk].fx || []).includes("echo");
      const has = !!docs.get(gk + "/1").sound.buses.echo;
      assert.strictEqual(has, want, gk + ": echo bus " + has + ", anchor says " + want);
    }
  });

  /* ================================================================== G8e
     THE ROOM CANNOT HOLD A PLAYER IT HAS NOT MET YET (Paul, 2026-08-25: "fix
     the zema organ thing").

     WHAT WENT WRONG, and it is the reason this gate exists rather than a
     patch: `zema` is Aksum 540, the oldest record in the catalog, and its own
     entry says out loud that it is "NOT a child of Rome 600 and must never be
     written as one". Measured on the shipped composer, all three seeds hired a
     European keyboard anyway — church organ, church organ, harpsichord — and
     two of the three hired a voice literally named `gregorian`. `mbube`
     (Johannesburg 1939, four men singing unaccompanied) took a harpsichord on
     all three. Nothing in the anchors was wrong: compose.js drew the guest
     from a per-FAMILY lean, and `vox` is a cluster held together by TEXTURE
     that runs from Aksum 540 to Leipzig 1725, so the lean was European because
     every choir in the table was European on the day it was typed.

     THE RULE GATED HERE IS THE LOOSER OF THE TWO, ON PURPOSE, and the number
     that decided it is in this file rather than in a commit message. The tight
     rule — "the drawn instrument must appear in the anchor's own `instr`, its
     parents' or its family's" — still fails 384 hires across 260 of the 417
     records AFTER the fix, and it should: a guest is a FOREIGN colour by
     construction, and the string quartet on a Beatles single (`counterpoint`,
     a harpsichord from Vienna 1725 on a Liverpool 1962 record) is the file's
     own worked example of the feature. Gating tightness would delete the
     feature Paul asked for ("you have stopped adding elements from other
     genres into the randomly generated songs").

     So the honest rule is the ERA one, which compose.js already applies to the
     PEDALS (FX_YEAR, "why would Chicago 1932 have enormous amounts of delay?")
     and now applies to the ROOM:
       1. no record hires a genre dated LATER than itself;
       2. no record plays an instrument the catalog first hears after its own
          year — the floor per id EXTRACTED as the earliest year any dated
          anchor claims it, so the table cannot drift from the anchors;
       3. a VOICE has no invention date and is exempt from 2 (extraction would
          floor `solo_vox` at Paris 1200, and people sang before Notre Dame),
          and from 1950 on — FX_YEAR's own line — a record may seat a late id
          of a KIND its own cast already plays, because extraction says when
          the CATALOG first hears an id and not when the thing was built:
          flatly applied it took the guitar solo off Chicago 1952 and St.
          Louis 1955, and Chuck Berry with no lead break is a worse lie than
          the one being fixed;
       4. an UNACCOMPANIED anchor — dated, no kit, no bass, every `instr` id a
          sung one — hires nobody at all. That predicate reads the anchor's own
          fields and finds gregorian, polychoral, organum, zema and mbube, which is
          why the two names in the complaint are not special cases in the code.
     Measured by re-running these very rules against the shipped composer:
     254 violations of rules 1-3 across 157 of the 417 records and 74 of the
     139 anchors, and 26 hires onto the 5 unaccompanied anchors in 15 records.
     Both are 0 after.

     IT READS THE DOCUMENT'S CAST, not compose()'s return value: `voices[]` and
     their `instrument` are what the page seats and what the reader is shown,
     and a policy that is right in the arranger and wrong by the time it is a
     document is the failure this suite is named for. */
  {
    const NC = R("compose.js");
    // WHO WAS HIRED cannot be read off the names alone, and the case that
    // proves it is `organum`: its document carries a voice called `pad`, which
    // is its own third chair — the held tenor — because precompose names a
    // base voice after its PART (precompose.js:1014) and `pad` is both a part
    // and a FUNCTION genre. Its instrument is `ahh_choir`, not `warm_pad`.
    // So identity comes from the arrangement, built with precompose.js:937-940's
    // own expression, and the INSTRUMENT — the thing the page actually seats —
    // is read off the document beside it.
    const late = [], hired = [], visited = [];
    for (const gk of ANCHORS) {
      const year = NC.genreYear(gk);
      const solo = NC.unaccompanied(gk);
      // THE RECORD'S OWN SINGER IS NOT A VISITOR (compose.js "a guest turns
      // up; a singer is on the record"), so rule 4 does not count it: a cantor
      // giving out the line alone is what `zema`'s `intro: "solo"` — "the
      // mergéta gives the line out alone" — describes, and plainchant has one
      // too. Rules 1-3 still apply to it, and a voice passes 3 anyway.
      const singer = NC.singerOf(GENRES[gk], gk);
      for (const seed of SEEDS) {
        const doc = docs.get(gk + "/" + seed);
        if (!doc) continue;
        const hires = new Set();
        for (const b of NC.compose(gk, seed).song)
          for (const e of b.stack.slice(1)) if (GENRES[e.g]) hires.add(e.g);
        for (const lk of hires) {
          if (lk === singer) continue;
          visited.push(gk + "/" + seed + " " + lk);
          if (solo) hired.push(gk + "/" + seed + ": " + GENRES[gk].label +
            " sings unaccompanied and hired " + lk);
          const gy = NC.genreYear(lk);
          if (year && gy && gy > year) late.push(gk + "/" + seed + ": " +
            GENRES[gk].label + " hired " + lk + " (" + GENRES[lk].label + ")");
        }
        // …and the INSTRUMENTS the document actually seats, held against the
        // arranger's own one-expression answer rather than a second copy of
        // it — `seatOK` carries rules 2, 3 and the after-1950 waiver together.
        for (const v of doc.voices)
          if (v.instrument && !NC.seatOK(gk, v.instrument))
            late.push(gk + "/" + seed + ": " + GENRES[gk].label + " seats " +
              v.name + " on " + v.instrument + ", which the catalog first " +
              "hears in " + NC.INSTR_YEAR[v.instrument] +
              " and no chair of its own plays a " + NC.kindOf(v.instrument));
      }
    }
    ok("G8e no record hires a player, or seats an instrument, from after its " +
       "own year — 254 violations in 157 of 417 records before this round", () =>
      assert.strictEqual(late.length, 0, late.length + " anachronistic, first " +
        "eight:\n      " + late.slice(0, 8).join("\n      ")));
    ok("G8e2 …and an anchor that sings unaccompanied hires nobody (26 hires " +
       "in 15 records before) — zema, mbube, gregorian, polychoral and organum, " +
       "found by reading their own kit/nobass/instr", () =>
      assert.strictEqual(hired.length, 0, hired.length + ":\n      " +
        hired.slice(0, 8).join("\n      ")));
    // …AND THE FEATURE IS STILL THERE. A filter that empties every ballot
    // passes both assertions above and deletes the guest, so the count is held
    // from BELOW as well: 3364 layer placements before this round, 3279 after,
    // and the Beatles' string quartet is named because it is precisely the
    // case the tight rule would have cost.
    ok("G8e3 …and the guest survives the law — the catalog still visits, and " +
       "the harpsichord on a 1962 Liverpool record is still the proof", () => {
      assert.ok(visited.length > 800, "only " + visited.length + " hires over " +
        (ANCHORS.length * SEEDS.length) + " records — the era law emptied the ballots");
      const quartet = [1, 2, 3].some((s2) => (docs.get("beatgroup/" + s2) || { voices: [] })
        .voices.some((v) => v.name === "counterpoint" && v.instrument === "harpsichord"));
      assert.ok(quartet, "no seed of beatgroup books the string quartet any more");
    });
  }

  /* ================================================================== G9
     TEST THE ARTIFACT. Everything above reads the DOCUMENT. This reads the
     numbers audio/desk.js hands the engine, through the same two functions
     desk-gate G6 uses on the shipped chant — because the finding fields.js:468
     names ("78% wet and bone dry, for as long as this page has existed") is a
     fact about `state.reverb`, not about a key being present in a JSON blob.

     WHAT WAS THERE BEFORE, MEASURED, because "the return was shut" turns out to
     be three-quarters true rather than wholly true and the difference belongs
     on the record. With precompose's bus block switched off, this loop reports
     `state.reverb` = 0.137 ×47 · 0.074 ×28 · nothing ×24 · 0.210 ×18 · 0.315 ×5
     — the MASTER's `space` bleed leaking into the return through audio/desk.js
     honest() ("SPACE OPENS THE RETURN … rgain = mrev*3.35"), which is the
     branch that same comment says should now stand down: "One owner for
     state.reverb, and it is the rack." So 24 records were bone dry, 98 were wet
     by accident at whatever the dry bleed happened to be, and none of them was
     at the number its own anchor asked for. With the bus block on it is
     0.180 ×48 · 0.320 ×45 · 0.500 ×15 · 0.625 ×14 — four returns, chosen.

     THE NEGATIVE CONTROL WAS RUN. With § 7's two lines commented out this file
     reports 21 passed, 8 failed; every one of the eight is in this block or in
     G8. A gate that cannot fail is not measuring anything.

     THE STUB IS desk-gate.js:19-45's, cited rather than reinvented: ui/state.js
     reads localStorage at evaluation and registers two module-scope listeners,
     so a bare `globalThis.window = globalThis` throws before a number is
     checked. It is set up HERE, at the foot of the file, so every gate above
     it stays the pure-node walk this file's header promises. */
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.document = { visibilityState: "visible", body: { append() {} },
    createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
  window.NuKernel = K; window.NuGenres = NG; window.NuFields = NF;
  window.NuSong = R("song.js"); window.NuInstruments = NI;
  window.NuCompose = R("compose.js"); window.PRESETS = R("presets.js").PRESETS;
  window.NuDocument = Doc; window.NuSongs = NuSongs;
  window.__REGISTRY = require(path.join(__dirname, "..", "engine", "registry-data.js"));
  const DESK = await import(path.join(__dirname, "..", "nukernel", "audio", "desk.js"));
  const { deskUnits, masterState } = DESK;

  // the four lines ui/eight.js push() runs (eight.js:250-253), run here, so
  // this is a statement about the page and not about the test
  const GKP = "lab.precompose.gate.";
  function pushBoxes(doc) {
    doc.form.sections.forEach((s2, i) => {
      GENRES[GKP + i] = Doc.toGenre(doc, i, GENRES, []); });
    const boxes = Doc.boxesOf(doc, GKP);
    const parts = DD.deskPartsOf(doc, GENRES);
    for (const b of boxes) b.parts = parts;
    return boxes;
  }

  let dry = [], retHist = {};
  for (const gk of ANCHORS) {
    const doc = docs.get(gk + "/1");
    const st = masterState(DD.masterOf(doc), DD.busesOf(doc));
    const r = st && st.reverb;
    hist(retHist, r == null ? null : r.toFixed(3));
    if (!(r > 0)) dry.push(gk + " -> " + JSON.stringify(st));
  }
  ok("G9a every precomposed record's reverb send lands in a NON-ZERO return " +
     "(desk-gate G6, for all 122 rather than for the chant alone)", () =>
    assert.strictEqual(dry.length, 0, dry.length + " still dry, first five:\n      " +
      dry.slice(0, 5).join("\n      ")));

  ok("G9b …and the return is the one the anchor's own tone.verb asked for", () => {
    for (const gk of ANCHORS) {
      const doc = docs.get(gk + "/1");
      const st = masterState(DD.masterOf(doc), DD.busesOf(doc));
      const want = NF.RETURNS[P.retOf(GENRES[gk])];
      assert.strictEqual(st.reverb, want, gk);
      assert.ok(st.reverbColor, gk + " has no reverb module");
    }
  });

  ok("G9c a per-voice desk reaches the units — the chairs of a reggae record " +
     "are not all at 1.0", () => {
    const doc = J(docs.get("reggae/1"));
    const chairs = DD.channelsOf(doc, GENRES);
    // a unit per chair, addressed the way audio/plan.js addresses one
    const units = {}, addr = {};
    chairs.forEach((k, i) => { units["u" + i] = { lvl: 1, module: "sampler",
      sampler: { id: "x" } }; addr["u" + i] = k; });
    const box = pushBoxes(doc)[0];
    const out = deskUnits(units, addr, box, null, null);
    const revs = Object.values(out).map((u) => u.rev);
    const lvls = Object.values(out).map((u) => u.lvl);
    assert.ok(revs.every((r) => r > 0), "a unit is dry: " + JSON.stringify(revs));
    assert.ok(new Set(revs.map((r) => r.toFixed(4))).size > 1,
      "every chair sends the same reverb (" + revs[0] + ") — the per-voice " +
      "desk is not reaching the units");
    assert.ok(new Set(lvls.map((l) => l.toFixed(4))).size > 1,
      "every chair is at the same level (" + lvls[0] + ")");
  });

  ok("G9d the untouched branch is still byte-identical — the same record with " +
     "its Sound axis stripped builds the units it always did", () => {
    const doc = stripSound(docs.get("reggae/1"));
    const chairs = DD.channelsOf(doc, GENRES);
    const units = {}, addr = {};
    chairs.forEach((k, i) => { units["u" + i] = { lvl: 1, module: "sampler",
      sampler: { id: "x" } }; addr["u" + i] = k; });
    const plain = Doc.boxesOf(J(doc), GKP);
    doc.form.sections.forEach((s2, i) => {
      GENRES[GKP + i] = Doc.toGenre(doc, i, GENRES, []); });
    const A2 = deskUnits(units, addr, plain[0], null, null);
    const B2 = deskUnits(units, addr, pushBoxes(doc)[0], null, null);
    assert.deepStrictEqual(A2, B2);
    assert.strictEqual(masterState(DD.masterOf(doc), DD.busesOf(doc)), null);
  });

  /* ================================================================== G11
     THE WORLD ROUND'S OWN LAWS (2026-08-26). Four assertions, and none of
     them existed before sixty anchors landed in one afternoon, because none
     of them could fail on a catalog somebody had read end to end.
     ================================================================== */
  {
    // G11a — NO ANCHOR PROMISES A SOUND THE REGISTRY CANNOT PLAY. Until this
    // round `instr` was checked only against NF.INSTRCHOICES, which is
    // DERIVED FROM `instr` — the union of every genre's own cast — so it can
    // never disagree with it and has never been a check at all. The real
    // authority is engine/registry-data.js SAMPLERS, the 123 ids with zones
    // on disk, and it is required here rather than in nukernel because the
    // registry sits a tier ABOVE this data (fields.js:1367 declines the same
    // import for the same reason). Sixty new anchors cast eleven ids nobody
    // had ever named — sitar, koto, shamisen, steel_drums, pan_flute,
    // clarinet, alto_sax, tuba, honky_tonk among them — and a typo in any of
    // them would have shipped a silent chair.
    //
    // WIDENED 2026-08-30, THE FIRST TIME AN ANCHOR CAST SOMETHING THAT IS NOT
    // A RECORDING, and the old rule is quoted rather than replaced because it
    // was right about everything it could see: "The real authority is
    // engine/registry-data.js SAMPLERS, the 123 ids with zones on disk". It
    // was right while every cast in the catalog WAS a recording. jiangnan
    // sizhu now casts `erhu`, which has no SAMPLERS row and never can: every
    // soundfont in this tree is GM bank 0, GM has no Chinese instrument, and
    // engine/faust/dsp/erhu.dsp exists precisely because the recording could
    // not. Under the old rule this file would have refused the one instrument
    // in the catalog that is NOT a stand-in.
    //
    // So the law is stated at the altitude it always meant: AN ANCHOR MAY NOT
    // PROMISE A SOUND THE ENGINE CANNOT MAKE. Two ways to keep it — a zone on
    // disk, or a compiled model the bridge routes to — and the second half is
    // asked of `to-engine.js recipeFor` itself, the same function the tape and
    // the page ask, rather than of a second list that could drift from it. An
    // id that is neither comes back `unrouted` and fails here exactly as a
    // typo did before. It is STRICTLY STRONGER than the sentence above: a
    // SAMPLERS row proves zones exist, and this proves the bridge reaches
    // them.
    const REG = require(path.join(__dirname, "..", "engine", "registry-data.js"));
    const REAL = new Set(Object.keys(REG.SAMPLERS));
    // the modelled half, asked of the bridge. `{}` for the library on purpose:
    // a sampled id falls through to the (empty) lib and reports `unrouted`, so
    // this branch answers TRUE only for an id the patch/mouth/voice tables
    // genuinely model — which is the question being asked.
    const modelled = (id) => {
      const un = [];
      const r = TE.recipeFor("line", { instr: id, tone: null, synth: null }, {}, un);
      return !un.length && String(r.source || "").split(":")[0] !== "unrouted" &&
             !!(r.m && r.m.model);
    };
    const unplayable = [], asModel = [];
    for (const gk of ANCHORS)
      for (const id of (Array.isArray(GENRES[gk].instr)
                        ? GENRES[gk].instr : [GENRES[gk].instr])) {
        if (REAL.has(id)) continue;
        if (modelled(id)) { asModel.push(gk + " -> " + id); continue; }
        unplayable.push(gk + " -> " + id);
      }
    ok("G11a every instrument every anchor casts is a sound the engine can " +
       "make — a zone on disk (" + REAL.size + " SAMPLERS ids) or a compiled " +
       "model recipeFor routes to — checked against the registry and the " +
       "bridge, never against the menu derived from these very casts", () => {
      assert.strictEqual(unplayable.length, 0, unplayable.join(", "));
      // ...and the modelled ones are PRINTED, every run, because an id that
      // has no recording behind it is the one a reader should be able to see
      // without reading the catalog.
      console.log("       cast as a MODEL, not a recording: " +
        (asModel.length ? asModel.join(", ") : "none"));
    });

    // G11b — THE `cannot` FIELD IS AN ADMISSION AND MUST READ LIKE ONE.
    // WORLD.md §7: "`wants` names a missing ANCESTOR; `cannot` names a
    // missing WORD IN THE LANGUAGE", and "prose drifts from the data it
    // labels", which is vocabulary.js's own argument for turning the prose
    // into data. A one-word `cannot` would be prose again, so the shape is
    // checked: an array of SENTENCES. Thirty-one anchors declare one.
    const badCannot = [];
    for (const gk of ANCHORS) {
      const c = GENRES[gk].cannot;
      if (c == null) continue;
      if (!Array.isArray(c) || !c.length) { badCannot.push(gk + ": not a non-empty array"); continue; }
      for (const line of c) {
        if (typeof line !== "string" || line.length < 24 || !/\s/.test(line))
          badCannot.push(gk + ": " + JSON.stringify(line) + " is not a sentence");
      }
    }
    const nCannot = ANCHORS.filter((gk) => GENRES[gk].cannot).length;
    ok("G11b every `cannot` is a list of SENTENCES, not a list of words — " +
       nCannot + " anchors declare what they cannot say", () =>
      assert.strictEqual(badCannot.length, 0, badCannot.slice(0, 5).join("\n      ")));

    // G11b2 — AND A ROLE HAS NOTHING TO ADMIT. The six FUNCTION genres are
    // parts and not traditions (atlas.js EXCLUDE says the same thing about
    // the map); a `pad` cannot fail to say a quarter tone, because a pad is
    // not claiming to be anywhere.
    const roleCannot = Object.keys(NG.GENRES)
      .filter((gk) => !/\d/.test(GENRES[gk].label || "1") && GENRES[gk].cannot);
    ok("G11b2 …and no FUNCTION genre declares one — a role has a job, not a " +
       "tradition it is falling short of", () =>
      assert.strictEqual(roleCannot.length, 0, roleCannot.join(" ")));

    // G11c — THE UNACCOMPANIED LAW IS STILL DERIVED, AND `sacredharp` IS THE
    // PROBE. compose.js finds the set by reading `kit`, `nobass` and `instr`
    // off each anchor, and it was written on 2026-08-25 knowing exactly five
    // records. Philadelphia 1844 was written without touching that predicate
    // and must fall into the set on its own three fields — if the law were a
    // name list wearing a function, it would not, and this assertion is the
    // difference between the two.
    const solo = ANCHORS.filter((gk) => NC.unaccompanied(gk));
    // ...AND `chorale` IS THE SECOND PROBE (2026-08-29). Nuremberg 1586 was
    // written the same way sacredharp was — four voices, `instr: "ahh_choir"`,
    // an empty kit, `nobass` — by somebody who did not read compose.js's
    // predicate, and it landed in the set on its own three fields. Two
    // independent arrivals is the difference between a derivation and a list.
    // ...AND THE GENEALOGY ROUND ADDED THREE MORE PROBES (2026-08-29):
    // `isorhythm` and `spirituals` are four unaccompanied parts and `ballad`
    // is ONE unaccompanied voice — the set's smallest possible member,
    // which no earlier arrival had tested. All three were written without
    // reading the predicate and landed on their own three fields; five
    // independent arrivals now, and the derived list below is the round's
    // whole edit to this gate.
    // ...AND THE DEBTS ROUND ADDED FIVE MORE PROBES (2026-08-29): `sticheron`,
    // `sequence` and `antiphon` are one unaccompanied chant voice each,
    // `winchester` is two, `francoflemish` four, and `holler` repeats ballad's
    // smallest-member test from the other side of an ocean. All were
    // written without reading the predicate and landed on their own three
    // fields; the derived list below is again the round's whole edit here.
    // (`winchester` is in the set and worth a beat: two ahh_choir voices,
    // empty kit, nobass — the predicate found the organum practice
    // unaccompanied, which it was.)
    // ...AND THE DEEP-TIME ROUND ADDED TWO MORE PROBES (2026-08-30):
    // `skolion` (one voice, a complete tune) and `oxyrhynchus` (one
    // Greek hymn line) — both written to the recipe, not to the
    // predicate, and both landed on their own three fields. `carmen` WAS
    // the instructive ABSENCE: fifty-four unaccompanied children, empty
    // kit, nobass — excluded only because genreYear failed closed on a BC
    // label. THE ALARM RANG AND WAS ANSWERED THE SAME DAY (2026-08-30):
    // genreYear learned the trailing-BC form and returns a negative year,
    // and carmen joined this list exactly as predicted. The prediction's
    // OTHER half was wrong and the measurement settles it: the five other
    // BC rows did NOT join, because they were never unaccompanied singing
    // — a bone flute, two lyres and an aulos hymn all carry instruments,
    // and the predicate correctly reads their fields, not their era. One
    // more independent arrival; the derived list below grew by one.
    ok("G11c the unaccompanied law is derived, not a list — it found the " +
       "five it was written on PLUS sacredharp, chorale, ballad, isorhythm, " +
       "spirituals, the debts round's six, the deep-time round's two, " +
       "and the folk-floor round's eight, " +
       "none of which it has ever heard of", () => {
      // ...and the ledger round's three (2026-08-30), each an
      // independent arrival on its own fields: `jubilee` is four
      // unaccompanied voices (the cluster's definition), `doina` one
      // voice on a mountain, `chazzanut` one voice over a hum. The
      // predicate found all three before this list heard of them.
      assert.deepStrictEqual(solo.slice().sort(),
["antiphon", "appalachia", "ballad", "barbershop", "carmen",
         "chazzanut", "chorale", "contenanceangloise", "doina",
         "francoflemish", "georgian", "gregorian", "holler", "isorhythm",
         "jubilee", "mbube", "mbuti", "nordicfolk", "nursery", "organum",
         "oxyrhynchus", "polychoral", "sacredharp", "seannos", "sequence",
         "shanty", "skolion", "spirituals", "sticheron", "winchester", "zema"]);
    });

    // G11d — EVERY PLACE IS IN EXACTLY ONE REGION, AND EVERY REGION ROW IS A
    // PLACE. atlas.js REGIONS is EXCLUDE's twin one tier up (WORLD.md §4: "a
    // cell is filled or declared empty with a reason"), and a hand-typed
    // table of 109 places is exactly the kind that rots, so it is held to
    // PLACES in both directions.
    const A2 = require(path.join(__dirname, "..", "nukernel", "atlas.js"));
    const placed = new Set(), twice = [], orphan = [];
    for (const [reg, list] of Object.entries(A2.REGIONS))
      for (const pl of list) {
        if (placed.has(pl)) twice.push(pl);
        placed.add(pl);
        if (!A2.PLACES[pl]) orphan.push(reg + " -> " + pl);
      }
    const homeless = Object.keys(A2.PLACES).filter((pl) => !placed.has(pl));
    ok("G11d every dot is in exactly one region and every region row is a " +
       "dot — " + Object.keys(A2.REGIONS).length + " regions, " +
       placed.size + " places, plus " +
       Object.keys(A2.REGIONS_EMPTY).length + " declared EMPTY", () => {
      assert.strictEqual(orphan.length, 0, "orphan region rows: " + orphan.join(", "));
      assert.strictEqual(twice.length, 0, "in two regions: " + twice.join(", "));
      assert.strictEqual(homeless.length, 0, "no region: " + homeless.join(", "));
      for (const [reg, why] of Object.entries(A2.REGIONS_EMPTY)) {
        assert.ok(!A2.REGIONS[reg], reg + " is declared empty AND has dots");
        assert.ok(why.length > 60, reg + " is declared empty with no reason in it");
      }
    });

  }

  /* ================================================================== G12
     THE THROAT CENSUS — WHAT EACH CHAIR ACTUALLY SOUNDS LIKE.

     Paul, 2026-08-26, by ear: "you keep assigning 'solo vox' but should be
     using native voices where possible."

     WHY THIS COUNT EXISTS AT ALL. Every other assertion in this file reads the
     DOCUMENT; a document names an instrument and says nothing about what will
     make the sound, because the id is resolved four tables later
     (`to-engine.js recipeFor`: the record's signature, then the mouth, then the
     singer, then the synth a GM patch is a photograph of, then the model, then
     the recording). So "which chairs are native" is not visible anywhere this
     file was already looking, and the number that went to ZERO — every one of
     the fifteen signature synths, silenced on every precomposed record —
     went there without a single check in this file moving.

     MEASURED THE MORNING THIS RAN, over 199 anchors x 3 seeds = 3228 line
     chairs:

                              before        after
       native seats           2062 (63.9%)  2485 (77.0%)
       the record's own synth    0 chairs      72 chairs, all 15 anchors
       sampled / unrouted     1166           743
       worst record, cost       36.80        42.00   (BUDGET 40, see G12d)
       mean modulation-strip     5.23         3.89   (CEILING 6, plan.js:462)
                                                    — approximated, see below

     "WHERE POSSIBLE", DERIVED — four clauses, in order, each of them a fact
     about what the voice IS rather than an entry on a list:

       1. THE ANCHOR'S OWN SIGNATURE OUTRANKS EVERYTHING. A `synth` block is
          the anchor saying "this is what this record sounds like". Fifteen say
          it; none was reaching a chair. (precompose.js, this round.)
       2. A SYNTHESISER IS NOT A RECORDING OF A SYNTHESISER. `saw_wave`,
          `polysynth`, `warm_pad` are photographs of an oscillator and the
          model IS the oscillator — there is no performance in the recording to
          lose. (to-engine.js PATCH_SYNTH, thirteen ids, already shipped.)
       3. A MOUTH IS CAST BY WHAT IT DOES. One person is `voice_lead`; a room
          of people is `voice_choir`; a machine that ARTICULATES, on a line
          chair, is `tract_voice`. The plural is in the name, and the catalog
          had already written the difference down — `blend`, documented
          "sections only", on ten `MOUTHS` rows that nothing could read.
          (instruments.js PATCH_VOICE, two rows, this round.)
       4. AND A RECORDING OF PEOPLE IS THE ONE THING A MODEL CANNOT BE. A
          violin section, a brass section, an accordion, a sax, a sitar: air
          through a body, played by somebody. They stay sampled, and this round
          did not move one of them — 743 chairs, and that number is not a
          backlog.

     THE TRACT IS NOT PART OF THIS. No seat was added to it and none is asked
     for: `mouthForInstr` reaches it only through `synth_voice` on a LINE chair
     and that is unchanged (nine chairs, before and after). What clause 1 did
     do is nearly TAKE those nine away — a signature synth would have displaced
     the chair the anchor cast as a voice — which is why `MOUTHY` exists in
     precompose. So VOICE.md §11's open question ("whether the tract sustains
     on the live path") is exactly as open as it was this morning; nothing here
     seats it on a held note, and nobody has run the browser probe.

     THE COST TRADE, STATED, because the second number is the one that hurts:
     a Faust seat is charged its pool x its module against a BUDGET of 40, and
     a sampled seat is charged a flat 0.3 — which `audio/plan.js:427` says out
     loud is a LIE ("never looks at `sampler.strip` at all... EVERY ONE of the
     822 states carries strips heavy enough to blow the same budget"). The load
     that actually starves the ring is CONCURRENCY of modulation stages on
     sampled voices, and a modelled voice has no `sampler.strip` at all, so it
     is charged nothing there. Moving 420 held choral chairs off the sampler
     took the mean strip load from 5.23 to 3.89 against a ceiling of 6 while
     taking the cost model from 17.26 to 23.61 against a budget of 40.
     THE STRIP NUMBER IS AN APPROXIMATION AND THE COST NUMBER IS NOT. It was
     taken offline with `trimStripLoad`'s own formula (stages x how many notes
     a seat sounds at once) and the second factor stood in as 3 for a held
     chair and 1 for a moving one, where the real one is counted off the
     compiled timeline. The DIRECTION is not in doubt — a modelled seat has no
     strip at all, so every chair that changed hands took its stages to zero —
     but the magnitude wants the live path. Only the cost is asserted below,
     because only the cost is measured exactly. */
  let CENSUS = null;
  {
    const SEng = require(path.join(__dirname, "..", "engine", "faust",
                                   "voices", "state-engine.js"));
    // WHICH CHAIRS ARE HELD. to-engine.js:224 CHAIR_ROLE is the owner of this
    // and does not export; the three pad parts are spelled here with the
    // citation rather than guessed, and G12f holds them against kernel PARTS.
    const PADPART = { pad: 1, drone: 1, stab: 1 };
    const seatsOf = (doc) => {
      const G = Doc.toGenre(doc, 0, GENRES, FLEET);
      const out = [];
      doc.voices.filter((v) => v.kind === "line").forEach((c, vi) => {
        const ch = (G.chairs || [])[vi] || null;
        const over = ch && ch.instr ? ch.instr : null;
        const syn = over ? null : ((ch && ch.synth) || G.synth) || null;
        const chair = PADPART[c.cast.part] ? "pad" : "line";
        const seat = { chair, instr: over || c.instrument, synth: syn,
                       tone: (ch && ch.tone) || G.tone || null };
        const r = TE.recipeFor(chair, seat, {}, []);
        const kind = String(r.source || "?").split(":")[0];
        out.push({ vi, part: c.cast.part, named: c.instrument, chair, seat,
                   source: r.source, kind, role: r.role, m: r.m,
                   native: kind !== "unrouted" && kind !== "font" && !!(r.m && r.m.model) });
      });
      return out;
    };
    const census = {}, sigSeen = {}, cost = [];
    let nChair = 0, nNative = 0;
    const saidSynth = [];
    for (const [key, doc] of docs) {
      const seats = seatsOf(doc);
      const paid = new Map();
      for (const s of seats) {
        nChair++; if (s.native) nNative++;
        census[s.kind] = (census[s.kind] || 0) + 1;
        if (s.kind === "synth") sigSeen[doc.basis] = s.source;
        if (s.named === "synth" && !SIG(doc)) saidSynth.push(key + " " + s.part);
        const k = s.chair + "|" + s.seat.instr + "|" +
                  (s.seat.synth ? s.seat.synth.dsp : "") + "|" +
                  JSON.stringify(s.seat.tone || null);
        if (paid.has(k)) continue;
        let c = 0.3;
        if (s.native) { try { c = SEng.unitCost(SEng.pitchedUnit(s.role, s.m,
          { bpm: 120, seed: 1 })); } catch (e) { c = 0.3; } }
        paid.set(k, c);
      }
      let tot = 0; for (const c of paid.values()) tot += c;
      cost.push({ key, cost: +tot.toFixed(2) });
    }
    cost.sort((a, b) => b.cost - a.cost);
    const SIGNED = ANCHORS.filter((k) => GENRES[k].synth && GENRES[k].synth.dsp);

    ok("G12a every anchor that declares a `synth` block seats it on at least " +
       "one chair — the whole point of the round, and it was 0 of " +
       SIGNED.length + " before it", () => {
      const missing = SIGNED.filter((k) => !sigSeen[k]);
      assert.deepStrictEqual(missing, [], "silenced: " + missing.join(" "));
    });

    ok("G12b the native-seat count is printed every run and can never " +
       "silently return to zero", () => {
      // A FLOOR, NOT AN EQUALITY. An anchor added tomorrow moves the exact
      // count and must not fail this file. There are TWO numbers here because
      // there are two ways this comes undone and neither one catches the
      // other, both measured by running them: putting an instrument name back
      // on every chair takes `census.synth` to 0 and the native count only
      // from 2485 to 2482 (the ids fall through to the patch table and stay
      // modelled — which is exactly how the seam hid), and deleting the two
      // PATCH_VOICE rows takes the native count to 2065 and leaves the
      // signatures alone. One assert apiece.
      assert.ok(nNative >= 2400, nNative + " native seats of " + nChair +
        " — the seam has regressed (measured 2485 the morning this was written)");
      assert.ok(census.synth >= 60, "only " + census.synth +
        " chairs play the record's own signature synth");
    });

    ok("G12c ABSENT IS TODAY — an anchor that declares no signature seats no " +
       "chair on 'synth', so a record whose anchor says nothing is unmoved", () => {
      assert.deepStrictEqual(saidSynth.slice(0, 5), [],
        saidSynth.length + " chairs say 'the record's own' with no record synth");
      // ...and the two PATCH_VOICE rows added this round took nothing from
      // another table: an id already answered by the mouth, the synth or the
      // model table would have CHANGED sound, not gained one.
      for (const id of Object.keys(NI.PATCHES.voice))
        if (NI.isSection(id))
          assert.ok(!NI.PATCHES.mouth[id] && !NI.PATCHES.synth[id] &&
                    !NI.PATCHES.model[id], id + " already had a patch row");
      assert.strictEqual(NI.PATCHES.voice.solo_vox.dsp, "voice_lead",
        "the one row that was here is unmoved");
      // A HOLE, NAMED RATHER THAN LEFT QUIET: G8e's era test asks
      // `compose.js seatOK(gk, id)` and `INSTR_YEAR` has no row for the string
      // "synth" (nor for any dsp name), so `undefined > year` is false and a
      // chair spelled "the record's own" is not era-checked. It is not a
      // live anachronism — all fifteen anchors that declare a signature are
      // electronic records of the 1970s onward and each declares its own dsp —
      // but the day an anchor from 1650 declares one, nothing here will say so.
      // The honest fix is a year per dsp beside INSTR_YEAR, which is a
      // compose.js round and not this one.
      // ...and every signature this file now seats is a dsp the fleet can
      // actually build, asked of the engine's own table rather than of a copy
      // of it — an unroutable `dsp` would have been silent before and would be
      // silent now, and silence is the one outcome nothing else here catches.
      for (const k of SIGNED)
        assert.ok(TE.SYNTH_OF(GENRES[k].synth.dsp),
          k + " declares dsp " + GENRES[k].synth.dsp + ", which no model names");
    });

    ok("G13 an `arpAlways` row carries its sequencer in EVERY section of " +
       "EVERY seed, at sixteen onsets to the bar", () => {
      /* Paul, 2026-09-01, after many rounds of me tuning a part that was
         sometimes not there at all: "I expect one four note arpeggiated phrase
         to play in line with the chord progression in sixteenth notes on a 303
         from the first to last measure and you must give me that for every
         young galaxy song."
         MEASURED BEFORE THIS GATE, bars of the arp chair carrying sixteenths:
         seed 1 64/76, seed 3 58/70, seed 7 69/73 — and seeds 5 and 9 at 0/66
         and 0/60, two songs in five with no arpeggio anywhere. Two causes, both
         features working as designed: the sequencer SLOT is dealt by a seeded
         chooser (so on an unlucky seed it was never dealt), and a kind's CELL
         binds a density BAND (so `sixteenths` could be read as its eighth-note
         neighbour). A promise made for every song needs a test that reads every
         song, which is what this is. */
      const rows = P.anchors().filter((g) => GENRES[g] && GENRES[g].arpAlways);
      assert.ok(rows.length, "no anchor declares arpAlways");
      for (const gk of rows) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const d = P.genreToDocument(gk, seed);
        const arp = d.voices.filter((v) => (v.material || {})[""] === "seq");
        assert.ok(arp.length === 1,
          gk + " seed " + seed + " has " + arp.length + " chairs homed on seq, want 1");
        const secs = d.form.sections.length;
        for (let i = 0; i < secs; i++) {
          const m = arp[0].material["s" + i];
          assert.ok(m === undefined || /^seq/.test(m),
            gk + " seed " + seed + " section " + i + " plays \"" + m +
            "\" on the arp chair, not the sequencer");
        }
      }
      // ...and the density is the pinned one, not a neighbour of it
      assert.strictEqual((P.KINDS.seq || {}).cell, "sixteenths",
        "the seq kind must ask for sixteenths");
      const Ideas = R("ideas-kit.js");
      const g16 = Ideas.CELLS && Ideas.CELLS.sixteenths;
      assert.ok(g16, "ideas-kit must own a `sixteenths` cell");
      assert.strictEqual(g16.g.filter(Boolean).length, 16,
        "the sixteenths cell must gate all sixteen steps");
    });

    ok("G12d the worst record's voice cost is measured, printed, and held " +
       "under a ceiling", () => {
      // BUDGET is the parent's mobile-safety line (state-engine.js:1986) and it
      // is ADVISORY here: `trimToBudget` runs inside `SE.voiceUnits`, and
      // to-engine.js:1288 adds nukernel's chairs AFTER it, so nothing sheds
      // them. The ceiling below is therefore the real guard, and it sits three
      // units above BUDGET with the reason written down. ONE record of 597 is
      // over the line — synthpop/3, at 42.00 — and it is over because it is a
      // six-piece band in which every chair resolved to a model: a Juno, a
      // supersaw, a singer, an Oberheim, a guitar and a choir. The parent's
      // own note allows "a dense blend can reach ~41-54"; the load that
      // actually starves THIS page — modulation strips on sampled voices,
      // plan.js:405-462 — went DOWN, not up (mean 5.23 -> 3.89 of a ceiling of
      // 6); and a ceiling that a real band cannot reach is a ceiling nobody
      // reads. What it does catch is the seam coming back: measured, writing
      // an instrument onto every chair again puts a record over 43.
      // 43 -> 46 on 2026-08-30, the ledger round, MEASURED not guessed:
      // the catalog grew 358 -> 369 and the guest draws re-dealt (they
      // hash the catalog), so baroquepop/1 gained a model-resolved guest
      // chair and became the worst record at 44.91 where synthpop/3's
      // 42.00 had been. That is a re-deal, not the seam: the per-chair
      // costs are unchanged, one record simply seats one more model. The
      // new ceiling keeps the same one-unit headroom over the measured
      // worst that 43 kept over 42.
      const CEILING = 46;
      assert.ok(cost[0].cost <= CEILING, cost[0].key + " costs " +
        cost[0].cost + ", over the stated ceiling of " + CEILING);
    });

    ok("G12e A GUEST DOES NOT BRING A SECOND CHOIR — a record holds exactly " +
       "the vocal SECTIONS its own anchor names, never one more", () => {
      // The ANCHOR may name two and often should: `hymn` is SATB, four parts
      // out of one choir, and it seats aah / ooh / aah so the two PATCH_VOICE
      // `phase` rotations put the parts on different vowels of the same
      // `MOUTHS.hymnal` walk. What a record may NOT gain is a section it never
      // asked for, and `backing` — a function genre whose whole instrument is
      // `ahh_choir` — was handing one to every record it landed on. A section
      // is a ROOM; two rooms singing the same backing part is not a bigger
      // choir, it is a phasing artefact with a second reverb on it, and (as of
      // this round) a second three-voice Faust pool at 12.2 cost units.
      const bad2 = [];
      for (const [key, doc] of docs) {
        const e = GENRES[doc.basis].instr;
        const anchorRooms = new Set((Array.isArray(e) ? e : [e]).filter(NI.isSection));
        const rooms = new Set(doc.voices.filter((v) => v.kind === "line" &&
          NI.isSection(v.instrument)).map((v) => v.instrument));
        if (rooms.size > Math.max(1, anchorRooms.size))
          bad2.push(key + " " + [...rooms].join("+") + " vs anchor " +
                    ([...anchorRooms].join("+") || "none"));
      }
      assert.deepStrictEqual(bad2.slice(0, 5), [],
        bad2.length + " records gained a choir the anchor never named");
    });

    ok("G12f the three held parts this census calls a pad are all real kernel " +
       "parts, and every one of them is one the kernel holds", () => {
      for (const p of Object.keys(PADPART)) assert.ok(K.PARTS[p], p);
    });

    /* G12g — AN ANCHOR NAMES ITS OWN BASS, AND THE NAME REACHES THE ENGINE.
       The grammar limit the 2026-09-02 QA report found: `plan.js castOf` seats
       the bass at `bRow.bassInstr || POOL.bass || BASS_INSTR`, `document.js
       toGenre` spreads `bassInstr` off the bass VOICE's `instrument`, and
       precompose wrote no such instrument — so the wire existed end to end
       with nothing feeding it and every anchor without a signature `synth`
       played the sampled upright.

       THREE ASSERTS, because there are three ways this comes undone and none
       of them catches another:
         · the row's word must be a word the BASS RACK owns (BASSCHOICES, not
           INSTRCHOICES — fields.js's header measures why);
         · the composed record's bass CHAIR must carry it, and `toGenre` must
           hand it back as `bassInstr` — the document is the thing that is
           saved and reopened, so the anchor's word has to survive the trip;
         · and the compiled recipe must ROUTE it, asked of `to-engine.js`
           itself, because "declared, costed and reaching no sound" is this
           box's characteristic bug and a bass id nothing seats is exactly it.

       IT CANNOT PASS VACUOUSLY. The last block applies the field to an anchor
       that does NOT declare one and walks the same three steps, so the day the
       catalogue declares zero `bassInstr` rows this gate still measures the
       mechanism — and the same block is the ABSENT-IS-TODAY proof: the row
       without the field composes a bass voice with no `instrument` key at all
       and `toGenre` spreads no `bassInstr`. */
    ok("G12g an anchor that declares `bassInstr` composes a bass chair with " +
       "that id, carries it through `toGenre`, and the compiled recipe " +
       "routes it", () => {
      const bassOf = (doc) => doc.voices.find((v) => v.kind === "bass") || null;
      /* "THE ENGINE CAN MAKE THIS SOUND" IS G11a's LAW, ASKED AGAIN — a zone
         on disk or a compiled model the bridge routes to. It has to be BOTH
         halves here for the reason G11a widened: `recipeFor` is handed `{}`
         for the library on purpose, so a SAMPLED id falls through the empty
         lib and reports `unrouted` even though its zones exist. Ten of the
         eleven BASSCHOICES ids are recordings — `bass_lead` is the only model
         — so asking only the bridge would have refused every honest hand on
         the list. (Measured 2026-09-02: picked_bass, finger_bass,
         acoustic_bass, slap_bass all answer `unrouted` from a bare recipeFor
         and all four have SAMPLERS rows.) */
      const REG2 = require(path.join(__dirname, "..", "engine", "registry-data.js"));
      const SAMPLED_ON_DISK = new Set(Object.keys(REG2.SAMPLERS));
      const routes = (id) => {
        if (SAMPLED_ON_DISK.has(id)) return true;
        const un = [];
        const r = TE.recipeFor("bass", { chair: "bass", instr: id }, {}, un);
        const kind = String((r && r.source) || "?").split(":")[0];
        return !un.length && kind !== "unrouted" && kind !== "?";
      };
      const DECLARED = ANCHORS.filter((k) => GENRES[k] && GENRES[k].bassInstr);
      for (const gk of DECLARED) {
        const id = GENRES[gk].bassInstr;
        assert.ok(Object.prototype.hasOwnProperty.call(NF.BASSCHOICES, id),
          gk + " names bass `" + id + "`, which the bass rack does not hold");
        assert.ok(!GENRES[gk].nobass,
          gk + " names a bass instrument and also declares `nobass`");
        const doc = P.genreToDocument(gk, 1);
        const b = bassOf(doc);
        assert.ok(b, gk + " declares a bass instrument and seats no bass");
        assert.strictEqual(b.instrument, id,
          gk + " composed a bass holding " + b.instrument + ", not " + id);
        assert.strictEqual(Doc.toGenre(doc, 0, GENRES).bassInstr, id,
          gk + "'s bass instrument does not survive toGenre");
        assert.ok(routes(id), gk + " names bass `" + id +
          "`, which to-engine.js does not route — declared and silent");
      }
      console.log("       " + DECLARED.length + " anchors name their own bass" +
        (DECLARED.length ? ": " + DECLARED.slice(0, 8).join(" ") : ""));

      // THE MECHANISM, PROVED ON A ROW THAT DECLARES NOTHING — and the
      // absent-is-today half in the same breath.
      const plain = ANCHORS.find((k) => GENRES[k] && !GENRES[k].bassInstr &&
                                        !GENRES[k].nobass);
      assert.ok(plain, "every anchor declares a bass instrument — pick another proof");
      const before = bassOf(P.genreToDocument(plain, 1));
      assert.ok(before && !("instrument" in before),
        plain + " composes a bass with an instrument key and declares none");
      assert.strictEqual(Doc.toGenre(P.genreToDocument(plain, 1), 0, GENRES).bassInstr,
        undefined, plain + " hands toGenre a bassInstr from nowhere");
      const row = GENRES[plain];
      const PROOF = "bass_lead";       // the one MODEL in the eleven
      try {
        row.bassInstr = PROOF;
        const after = bassOf(P.genreToDocument(plain, 1));
        assert.strictEqual(after.instrument, PROOF,
          "the field does not reach the composed bass chair");
        assert.strictEqual(
          Doc.toGenre(P.genreToDocument(plain, 1), 0, GENRES).bassInstr, PROOF,
          "the field does not survive toGenre");
        assert.ok(routes(PROOF), PROOF + " does not route");
      } finally { delete row.bassInstr; }
      assert.ok(!("instrument" in bassOf(P.genreToDocument(plain, 1))),
        "the catalogue did not come back unmodified");
    });
    CENSUS = { census, sigSeen, cost, nChair, nNative, SIGNED,
               BUDGET: SEng.BUDGET };
  }

  /* ================================================================== G14
     A VOCODER IS A MACHINE, NOT A THROAT.

     precompose.js door 1 refuses a singing GUEST on a record that is declared
     instrumental — unless the record already sings for itself, which is the
     `ownVoice` waiver. That waiver was asked through MOUTHY, which is
     PATCHES.voice OR PATCHES.mouth, and PATCHES.mouth holds exactly one id:
     `synth_voice`, whose dsp is `tract_voice`, a formant speech synthesiser.
     genres.js's own roboticpop row says what that id means — "Düsseldorf 1978
     IS A FORMANT SPEECH SYNTHESISER, not a metaphor for one … a Votrax, a
     Speak & Spell" — and a Votrax is not a person. Seven anchors seat that id
     and no throat: dusseldorfschool, electro, roboticpop, industrialdance,
     ebm, dancepostpunk, versailles. Every one of them silently answered YES to
     "does this record sing", so no Kraftwerk-lineage row could ever be
     declared `instrumental: true` and have the declaration bite — the waiver
     fired before the door did.
     The waiver now reads THROAT (PATCHES.voice: solo_vox, ahh_choir,
     ohh_voices) plus the row's own stated `tone.mouth`. DOOR 1 IS UNCHANGED
     and still reads VOCAL, which still contains the machine mouth: a machine
     cannot BUY a singer and cannot walk on as one either, and that asymmetry
     is the rule. Proved on a live row rather than asserted: the vocoder rows
     are handed `instrumental: true` here, one at a time, and must refuse a
     singing guest. */
  {
    const THROATS = Object.keys(NI.PATCHES.voice);
    const MOUTHS_ = Object.keys(NI.PATCHES.mouth);
    ok("G14a the machine mouth and the modelled throats are still two " +
       "different tables — the rule has something to stand on", () => {
      assert.ok(MOUTHS_.length && THROATS.length,
        "PATCHES.voice or PATCHES.mouth is empty; the rule has no subject");
      assert.deepStrictEqual(MOUTHS_.filter((id) => NI.PATCHES.voice[id]), [],
        "an id is in BOTH tables — 'a vocoder is not a throat' cannot be asked");
      assert.ok(MOUTHS_.includes("synth_voice"),
        "PATCHES.mouth no longer holds synth_voice — re-read this rule");
    });
    const instrList = (G) => (Array.isArray(G.instr) ? G.instr : G.instr ? [G.instr] : []);
    const VOCODED = ANCHORS.filter((k) => {
      const G = GENRES[k]; if (!G) return false;
      const l = instrList(G);
      return l.some((i) => NI.PATCHES.mouth[i]) &&
             !l.some((i) => NI.PATCHES.voice[i]) && !(G.tone && G.tone.mouth);
    });
    ok("G14 a record whose only voice is a vocoder does NOT count as singing " +
       "— " + VOCODED.length + " anchors (" + VOCODED.join(" ") + "), each of " +
       "which waived door 1 before this round", () => {
      assert.ok(VOCODED.length, "no anchor seats a machine mouth and no throat " +
        "— the rule has no subject left; delete it or re-read the catalogue");
      const sings = (gk) => {
        const doc = P.genreToDocument(gk, 1);
        return doc.voices.some((v) => v.instrument &&
          (NI.PATCHES.voice[v.instrument] ||
           (NI.SAMPLED_VOICES && NI.SAMPLED_VOICES[v.instrument])));
      };
      for (const gk of VOCODED) {
        const row = GENRES[gk];
        const had = Object.prototype.hasOwnProperty.call(row, "instrumental");
        const was = row.instrumental;
        try {
          row.instrumental = true;
          assert.ok(!sings(gk), gk + " (" + row.label + ") is declared " +
            "instrumental and its own voice is a VOCODER, and it still seats a " +
            "singer: the ownVoice waiver is reading the machine mouth again");
        } finally { if (had) row.instrumental = was; else delete row.instrumental; }
      }
      // …AND THE WAIVER STILL WORKS FOR A REAL THROAT, or the fix is just a
      // wider ban. A row that sings with its own instr keeps its guests.
      const singer = ANCHORS.find((k) => {
        const G = GENRES[k];
        return G && !G.instrumental && instrList(G).some((i) => NI.PATCHES.voice[i]);
      });
      assert.ok(singer, "no anchor sings with its own instr — check PATCHES.voice");
      const row = GENRES[singer];
      try {
        row.instrumental = true;
        assert.ok(sings(singer), singer + " sings with " +
          instrList(row).find((i) => NI.PATCHES.voice[i]) +
          " and the waiver no longer covers it — the fix banned real throats too");
      } finally { delete row.instrumental; }
    });

  /* ================================================================== G14b
     A DECORATIVE MODE — a row that names mixolydian or dorian and cannot
     sound it.

     `mode` is read in exactly three places (kernel.js harm(), chordsOf() and
     bass()) and all three need CHORD ROOTS. A `harmony: "modal"` row has none,
     so its mode colours nothing and every note comes out of `scale`; a `cycle`
     row whose roots never reach the degree the mode exists for (mixolydian's
     flat seventh, dorian's natural sixth) is in the same position. The glam
     row already found this by hand on 2026-09-02 ("These roots reach degrees
     0, 3 and 4 and never degree 6, so mixolydian's flat seventh never sounds")
     — this is that finding turned into a standing measurement.

     TEST THE ARTIFACT: the question is not asked of the roots array, it is
     asked of the RENDERED NOTES. Swap the declared mode for its plain
     neighbour (mixo -> ionian, dorian -> aeolian, the one-degree neighbours),
     re-render every section of seeds 1-3, and compare. Not one note moved
     means the mode is decoration. A row whose `scale` IS its mode is exempt:
     there the colour arrives through the scale and the mode field is a
     redundant copy, not a silent one.

     49 ROWS FAILED THE DAY THIS CHECK WAS WRITTEN AND NONE DO NOW, so the
     ceiling is ZERO and the number may only stay there. The first three came
     off because the row's own comment claimed the mode in words and the record
     played something else: `forro` ("the flattened seventh … IS the sound",
     singing SCALES.major), `modaljazz` ("So What is two dorian chords", handed
     a major pentatonic) and `oxyrhynchus` ("the mixolydian row, note for note",
     singing the natural minor). The other 47 were ruled on one at a time in
     the same shift, each argued in its own row comment with a named record,
     place and year, and each landing on one of the three answers the law at
     nukernel/genres.js MODES sets out:

       · TWELVE made the mode audible (`scale: MODES.<mode>`) because the
         record really is in it — gregorian (mode I of the Hartker tonary),
         organum, sequence, antiphon, troubadour, estampie, ballad, gagaku
         (the ritsu scale IS the dorian octave), shanty, nordicjazz, seannos
         and hardingfele. These twelve are the only rows in the sweep whose
         RENDERED NOTES changed.
       · FOURTEEN were renamed ionian, because the sounding third is major:
         the five twelve-bar rows whose roots are I-IV-V and never bVII
         (zydeco, neworleans, boogiewoogie, deltablues, territoryband — a
         blues has no flat-seven CHORD; its flat seven is melodic and comes
         from SCALES.blues, which they already play), the four on
         SCALES.majpent (ethiojazz, bhangra, protopunk, rumba — no seventh at
         all), the three where dorian contradicted a MAJOR third on the same
         line (krautrock, psychrock, appalachia), and mambo and latinjazz.
       · TWENTY-ONE were renamed aeolian, because the sounding third is minor
         or there is no evidence at all: the nine on SCALES.blues or BLUES,
         which has NO SIXTH — the one degree dorian exists for (holler,
         blockparty, psychfunk, chopped, footwork, acidjazz, chillout, nujazz,
         hambone) — plus sitcomsting, crimejazz (chromatic states every mode
         and so states none), funkrock (its roots DO reach degree 6 and still
         never degree 5), tarantella, and the rows whose tune is lost or was
         never notated: carmen (the acta name the singers, not the melody),
         delphic (where the Greek "Dorian" tonos is this table's PHRYGIAN),
         qiyan, abbasid, nuba, drone, viennadownbeat and downtempo.

     A row may come back onto this list only by earning it: a genre added
     tomorrow that declares mixo or dorian has to sound the degree it is named
     for. */
    const PLAIN = { mixo: "ionian", dorian: "aeolian" };
    const modeName = (a) => Array.isArray(a) &&
      Object.keys(MODES).find((k) => MODES[k].join() === a.join());
    const notesOf = (gk) => {
      const out = [];
      for (const seed of SEEDS) {
        let d; try { d = P.genreToDocument(gk, seed); } catch (e) { return null; }
        for (let i = 0; i < d.form.sections.length; i++) {
          let evs; try { evs = sectionEvents(d, i); } catch (e) { continue; }
          for (const e of evs) if (e.kind !== "hit")
            out.push(e.kind + ":" + e.t + ":" + (e.p != null ? e.p : e.n));
          const g = Doc.toGenre(d, i, GENRES);
          const lines = d.voices.filter((v) => v.kind === "line");
          const lead = lines.length &&
            Doc.toPhrase(d, Doc.materialAt(lines[0], d.form.sections[i].id));
          if (lead) for (let b = 0; b < 8; b++) {
            let cs; try { cs = K.chordsOf(lead, g, b); } catch (e) { cs = []; }
            for (const c of cs || []) out.push("chord:" + b + ":" + (c.pcs || []).join("+"));
          }
        }
      }
      return out.join("|");
    };
    const decorative = [];
    for (const gk of ANCHORS) {
      const G = GENRES[gk]; if (!G) continue;
      const mn = modeName(G.mode); if (!PLAIN[mn]) continue;
      if (Array.isArray(G.scale) && G.scale.join() === G.mode.join()) continue;
      const before = notesOf(gk); if (before == null) continue;
      const keep = G.mode;
      let after;
      try { G.mode = MODES[PLAIN[mn]]; after = notesOf(gk); }
      finally { G.mode = keep; }
      if (before === after) decorative.push(gk + " (" + mn + ", " + G.label + ")");
    }
    const DECOR_MAX = 0;
    ok("G14b " + decorative.length + " anchors name a mode the record cannot " +
       "sound — swapping mixo->ionian / dorian->aeolian moves not one rendered " +
       "note (was 49 when the check was written; the ceiling is now ZERO)", () => {
      assert.ok(decorative.length <= DECOR_MAX, decorative.length +
        " decorative mode(s), and the ceiling is " + DECOR_MAX + " — a row " +
        "declares mixolydian or dorian and cannot sound the degree it is " +
        "named for. Fix it the way the law at genres.js MODES says (make the " +
        "scale the mode, or name what it plays, or give it a root that uses " +
        "the degree) and argue it in the row. Offenders:\n      " +
        decorative.join("\n      "));
    });
    console.log("       decorative modes (" + decorative.length + "): " +
      decorative.map((s2) => s2.split(" ")[0]).join(" "));
  }

  /* ================================================================== G10
     THE PRINT-OUT PAUL READS (PROGRAM.md §5, PAUL'S EARS item 5): which IDIOM
     family row each anchor resolved to, and where an override overrode it. */
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("  " + nRecords + " records · " + nSections + " sections · " +
              nCells + " line cells · " + nEvents.toLocaleString() + " sounding events");
  console.log("  cell length, in bars: " +
    Object.entries(cbHist).map(([k, v]) => k + " bar" + (k === "1" ? "" : "s") +
      " ×" + v).join(" · "));

  console.log("\nTHE IDIOM TABLE, AS RESOLVED — " + ANCHORS.length + " anchors\n");
  const byFam = new Map();
  for (const gk of ANCHORS) {
    const r = P.idiomOf(gk);
    if (!byFam.has(r.family)) byFam.set(r.family, []);
    byFam.get(r.family).push({ gk, r });
  }
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  for (const [fam, rows] of byFam) {
    const base = P.IDIOM[fam];
    console.log("  " + fam.toUpperCase() + "  " +
      ["cell", "contour", "land", "sent", "len", "reg"].map((f) => f + ":" + base[f]).join(" "));
    const plain = rows.filter((x) => !x.r.override).map((x) => x.gk);
    for (const x of rows.filter((y) => y.r.override))
      console.log("      " + pad(x.gk, 16) + "OVERRIDE  " +
        ["cell", "contour", "land", "sent", "len"]
          .filter((f) => P.IDIOM_ANCHOR[x.gk][f] != null)
          .map((f) => f + ":" + P.IDIOM_ANCHOR[x.gk][f]).join(" "));
    for (let i = 0; i < plain.length; i += 6)
      console.log("      " + plain.slice(i, i + 6).map((g) => pad(g, 16)).join("").trimEnd());
  }
  const nOver = ANCHORS.filter((g) => P.idiomOf(g).override).length;
  console.log("\n  " + nOver + " anchors carry an override; " +
    (ANCHORS.length - nOver) + " take their family row.");
  console.log("  Does a punk hook sound like punk? That is the one question " +
    "this table cannot answer itself.\n");

  /* ---- THE TWO COUNTS STATE.md ASKED FOR, PRINTED -------------------- */
  const table = (h) => Object.entries(h).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => k + " ×" + v).join(" · ");
  console.log("THE POCKET — time.groove over all " + ANCHORS.length +
              " anchors (was: funk ×97, nothing ×25)\n");
  console.log("  " + table(hGroove));
  const byGroove = {};
  for (const gk of ANCHORS) {
    const w = P.grooveOf(GENRES[gk]) || "(none)";
    (byGroove[w] = byGroove[w] || []).push(gk);
  }
  for (const [w, list] of Object.entries(byGroove)) {
    if (w === "(none)") continue;
    console.log("    " + pad(w, 10) + list.join(" "));
  }
  console.log("    " + pad("(none)", 10) + byGroove["(none)"].length +
              " anchors declare no kit, so no drummer has a pocket");

  console.log("\nTHE RETURN — sound.buses.rev, over all " + ANCHORS.length +
              " anchors (was: 1 record, by hand, in songs.js)\n");
  console.log("  how far open   " + table(hRet));
  console.log("  which room     " + table(hColor));
  console.log("  nameplate      " + table(hName));
  console.log("  state.reverb   " + table(retHist));
  console.log("  echo bus       " + nEchoBus + " of " + nRecords +
              " records · time " + table(hEchoTime) + " · repeats " +
              table(hEchoFb) + " · tone " + table(hEchoTone));
  console.log("  chair chips    " + table(hBoxFx));
  console.log("  the board      " + nDeskVoices + " of " + nVoices +
              " voices carry a desk, over " + (nRecords - noDesk.length) +
              " of " + nRecords + " records · " + table(hDeskKey));
  console.log("  Does a dub record sound like a dub record and a chant like a " +
    "stone room?\n  That is the question this table cannot answer itself.\n");


  /* ================================================================== G15
     A MACHINE'S GUESTS ARE NATIVE.

     precompose.js doors 1 and 2 say WHO may sit at a record's guest table.
     Neither says what the guest brings, and `instrOf(lk, 0)` hands it the
     instrument of its own row — a RECORDING, wherever the guest row is an
     acoustic one. Measured over the 421 anchors at seed 1 before door 3:
     exactly two guest rows did all of it. `drone` arrived on `slow_strings`
     (a recorded string section) and `counterpoint` on a sampled
     `harpsichord`, onto acid, bleeptechno, chiptune, dusseldorfschool,
     electro, melodictechno, synthpop, technopop, trance and thirteen more —
     a 909 record with a harpsichord counter-line on it.

     THE ROW DECLARES IT: `guests: "native"`. There is no inference here, on
     purpose — "this sounds like a machine genre" is a report's opinion and an
     opinion may not change what the box plays. What the door moves is SAMPLES
     only (`instruments.js sampledId`, the sampler's own predicate), so a
     singing guest is untouched: `solo_vox` and `ahh_choir` are modelled
     throats, the door never sees them, and a vocal-trance record still has a
     singer on it. That asymmetry is the point, the same way it is at door 1.

     Three things are held here: the declaring rows seat NO sampled guest, the
     door left their singers alone, and a row that does NOT declare it is
     unchanged (or the door is a global rule wearing a field's clothes). */
  {
    const NATIVE_GUESTS = ANCHORS.filter((k) => GENRES[k] && GENRES[k].guests === "native");
    const guestChairs = (gk) => {
      const G = GENRES[gk];
      const doc = P.genreToDocument(gk, 1);
      const lines = doc.voices.filter((v) => v.kind === "line");
      return lines.slice(G.voices || 0);          // the base band first, then the guests
    };
    ok("G15 a machine row's guests are seated on the fleet, never on the " +
       "sampler — " + NATIVE_GUESTS.length + " rows declare `guests: \"native\"`", () => {
      assert.ok(NATIVE_GUESTS.length, "no row declares `guests: \"native\"` — the " +
        "door has no subject; delete it or declare it");
      const bad = [];
      for (const gk of NATIVE_GUESTS)
        for (const v of guestChairs(gk))
          if (NI.sampledId(v.instrument))
            bad.push(gk + " seats its `" + v.name + "` guest on a recording (" +
                     v.instrument + ")");
      assert.ok(!bad.length, bad.join("; ") + " — door 3 did not fire");
    });
    ok("G15b the door moves recordings and not singers: a declaring row that " +
       "seats a modelled throat still seats it", () => {
      const THROAT = (id) => !!NI.PATCHES.voice[id];
      const singers = NATIVE_GUESTS.filter((gk) =>
        guestChairs(gk).some((v) => THROAT(v.instrument)));
      assert.ok(singers.length, "not one of the " + NATIVE_GUESTS.length +
        " declaring rows seats a singing guest any more — the door is eating " +
        "throats, which is door 1's job and not this one's");
      console.log("       " + singers.length + " of " + NATIVE_GUESTS.length +
        " declaring rows keep a singing guest (" + singers.slice(0, 6).join(" ") + ")");
    });
    ok("G15c a row that does not declare it is untouched — the door is a " +
       "declaration, not a global rule", () => {
      const undeclared = ANCHORS.filter((k) => GENRES[k] && GENRES[k].guests !== "native");
      const stillSampled = undeclared.filter((gk) => {
        try { return guestChairs(gk).some((v) => NI.sampledId(v.instrument)); }
        catch (e) { return false; }
      });
      assert.ok(stillSampled.length, "every undeclared row also lost its sampled " +
        "guests — `guests` is not the thing deciding this");
      console.log("       " + stillSampled.length + " undeclared rows still seat a " +
        "sampled guest, as they should");
    });
  }

  /* ---- THE COVERAGE FRAME, PRINTED EVERY RUN (WORLD.md §4) ------------
     "Keep a gate that prints the largest inhabited region more than N km
     from any anchor every run. It must never be the thing that says 'done'."
     This is that, in the shape §6 asked for — anchors per region per
     century, the Euro-American share, and the empty cell named — and it
     asserts NOTHING, on purpose. G11d above is the assertion; this is the
     alarm. */
  {
    const AT = require(path.join(__dirname, "..", "nukernel", "atlas.js"));
  const regionOf = {};
  for (const [reg, list] of Object.entries(AT.REGIONS))
    for (const pl of list) regionOf[pl] = reg;
  const cent = (y) => Math.floor(y / 100) + 1;
  const rows = {}, EA = new Set(["Europe", "North America"]);
  let nEA = 0, nPlaced = 0;
  const cents = new Set();
  for (const gk of ANCHORS) {
    const w = AT.WHEN[gk]; if (!w) continue;
    const r = regionOf[AT.canon(w.place)] || "(no region)";
    const c = cent(w.year);
    cents.add(c);
    ((rows[r] = rows[r] || {})[c] = (rows[r][c] || 0) + 1);
    nPlaced++; if (EA.has(r)) nEA++;
  }
  const pad2 = (x, n) => (x + " ".repeat(n)).slice(0, n);
  const cols = [...cents].sort((a, b) => a - b);
  console.log("\nTHE COVERAGE FRAME — anchors per region per century, " +
              nPlaced + " place-year anchors\n");
  console.log("  " + pad2("", 34) + cols.map((c) => pad2(String(c) + "c", 6)).join("") + "total");
  for (const [reg] of Object.entries(AT.REGIONS)) {
    const r = rows[reg] || {};
    const tot = Object.values(r).reduce((a, b) => a + b, 0);
    console.log("  " + pad2(reg, 34) +
      cols.map((c) => pad2(r[c] ? String(r[c]) : "·", 6)).join("") + tot);
  }
  for (const [reg, why] of Object.entries(AT.REGIONS_EMPTY))
    console.log("  " + pad2(reg, 34) + cols.map(() => pad2("·", 6)).join("") + "0" +
                "\n      EMPTY, declared: " + why.slice(0, 96) + "…");
  console.log("\n  Euro-American share " + (100 * nEA / nPlaced).toFixed(1) +
              "% (" + nEA + " of " + nPlaced + ").  WORLD.md §4 measured " +
              "86.3% before the 2020s and African rounds and 80.5% the " +
              "morning of this one;\n  its target for the whole ~215-anchor " +
              "program is 51%, which is NOT this round's number and is not " +
              "meant to be.\n  The map is the alarm, not the specification: " +
              "a region with one dot in it is not covered, it is visited.\n");

  }

  /* THE THROAT CENSUS, PRINTED — the assertions are above, beside the
     other gates; this is the table Paul reads. */
  {
    const { census, sigSeen, cost, nChair, nNative, SIGNED, BUDGET } = CENSUS;
    /* ---- PRINTED EVERY RUN: the census, the signatures, the cost ---- */
    const order = Object.keys(census).sort((a, b) => census[b] - census[a]);
    console.log("\nTHE THROAT CENSUS — what makes the sound, over " + nChair +
                " line chairs\n");
    console.log("  native " + nNative + " of " + nChair + " (" +
                (100 * nNative / nChair).toFixed(1) + "%) · " +
                order.map((k) => k + " ×" + census[k]).join(" · "));
    console.log("  the record's own signature, honoured on " +
                Object.keys(sigSeen).length + " of " + SIGNED.length +
                " anchors that declare one:");
    console.log("    " + SIGNED.map((k) => k + "→" +
                String(sigSeen[k] || "SILENT").replace("synth:", "")).join("  "));
    const over = cost.filter((c) => c.cost > BUDGET);
    console.log("  cost, against the parent's BUDGET of " + BUDGET +
                " — heaviest five: " +
                cost.slice(0, 5).map((c) => c.key + " " + c.cost).join(" · "));
    console.log("  " + over.length + " of " + nRecords + " records over it" +
                (over.length ? " (" + over.map((c) => c.key).join(" ") + ")" : "") +
                " — advisory: to-engine.js:1288 seats nukernel's chairs after " +
                "the parent's own trim, so nothing sheds them.");
    console.log("  Does industrial rock sound like Nine Inch Nails and a hymn " +
                "like a room of people?\n  That is the question this table " +
                "cannot answer itself.\n");
  
  }

  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
