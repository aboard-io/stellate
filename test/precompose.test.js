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
const Doc = R("document.js"), P = R("precompose.js");
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

    /* --- G1 SHAPE, against every vocabulary table --------------------- */
    for (const k of ["basis", "time", "alphabet", "material", "form",
                     "voices", "sound", "performance"])
      if (doc[k] == null) say("no " + k);
    if (doc.basis !== gk) say("basis is " + doc.basis);

    const T = doc.time;
    if (!Number.isFinite(T.bpm) || T.bpm < 60 || T.bpm > 200) say("bpm " + T.bpm);
    if (!Number.isFinite(T.rate) || T.rate <= 0) say("rate " + T.rate);
    if (T.meter != null && !NF.METERLABEL[T.meter]) say("meter " + T.meter);
    if (T.swing != null && !NF.SWINGS[T.swing]) say("swing " + T.swing);
    if (T.groove != null && !NF.GROOVELABEL[T.groove]) say("groove " + T.groove);

    const A = doc.alphabet;
    if (!KEYS.includes(String(A.key))) say("key " + A.key);
    if (!MODES[A.mode]) say("mode " + A.mode);
    if (A.scale != null && !SCALES[A.scale] && !MODES[A.scale]) say("scale " + A.scale);
    if (typeof A.diatonic !== "boolean") say("diatonic " + A.diatonic);
    if (!["modal", "cycle", "emergent"].includes(A.harmony)) say("harmony " + A.harmony);
    if (!Array.isArray(A.prog) || !A.prog.length) say("no prog");
    for (const c of A.prog || []) {
      if (!Number.isInteger(c.d)) say("prog degree " + c.d);
      if (!QUAL.has(c.q)) say("prog quality " + c.q);
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
      if (!c.play.includes("n")) say("cell " + n + " has no onset");
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
        if (!NF.INSTRCHOICES[v.instrument]) say(v.name + " instrument " + v.instrument);
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
    if (!lines) say("no line voices");
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
    hist(hBoxFx, (doc.sound.fx || []).join("+") || null);
    for (const k of doc.sound.fx || [])
      if (!Object.prototype.hasOwnProperty.call(NF.FX, k)) sound("sound.fx " + k + " is not an FX key");
    if ((doc.sound.fx || []).length > NF.MAX_FX) sound("sound.fx is longer than MAX_FX");

    let deskHere = 0;
    for (const v of doc.voices) {
      nVoices++;
      if (!v.desk) continue;
      deskHere++; nDeskVoices++;
      for (const [k, val] of Object.entries(v.desk)) {
        hist(hDeskKey, k);
        const f = NF.PARTMIXBY[k];
        if (!f) { sound(v.name + ".desk." + k + " is not a PARTMIX key"); continue; }
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
        if (!b.stack[0].slots.length) say("box " + i + " has no slots");
      });
    }

    /* --- G2 THE CELL INVARIANT --------------------------------------- */
    // Every LINE cell in one document is the SAME length and a whole multiple
    // of stepsIn(meter). Two lengths give two voices different bar arithmetic
    // against one `total` (ui/derive.js:420) — that is the failure mode.
    const steps = K.stepsIn({ meter: NF.METERLABEL[T.meter] ? K.METERS[T.meter] : null });
    const lens = new Set(names.filter((n) => doc.material.cells[n].kind !== "drum")
                              .map((n) => doc.material.cells[n].deg.length));
    if (lens.size !== 1) bad.cell.push(where + ": " + lens.size + " different cell lengths");
    const L = [...lens][0];
    if (L % steps) bad.cell.push(where + ": cell " + L + " is not a multiple of " + steps);
    const cb = Doc.barsOf(doc);
    if (cb !== L / steps) bad.cell.push(where + ": barsOf says " + cb + ", cell says " + L / steps);
    cbHist[cb] = (cbHist[cb] || 0) + 1;

    /* --- G3 ≥3 DISTINCT CELLS ---------------------------------------- */
    const shapes = new Set(names.filter((n) => doc.material.cells[n].kind !== "drum")
      .map((n) => doc.material.cells[n].deg.join(",") + "|" +
                  doc.material.cells[n].play.join("")));
    if (shapes.size < 3) bad.same.push(where + ": only " + shapes.size + " distinct cells");

    /* --- G4 NON-SILENCE, PER SECTION --------------------------------- */
    doc.form.sections.forEach((s, i) => {
      const ev = sectionEvents(doc, i);
      nEvents += ev.length;
      if (!ev.length) bad.silent.push(where + " section " + i + " (" + s.role + ")");
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
  // 1935/1939/1994, Kinshasa 1960, Addis Ababa 1969, Bamako 1970, Oran 1985).
  ok("G0 the catalog is 139 anchors, session keys excluded", () =>
    assert.strictEqual(ANCHORS.length, 139,
      "anchors() returned " + ANCHORS.length));
  ok("G0b 366 records, no throw", () => {
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
  ok("G6c a different seed is a different record for ≥90% of anchors", () =>
    assert.ok(moved / ANCHORS.length >= 0.9,
      moved + " of " + ANCHORS.length + " moved between seed 1 and seed 2"));
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
  const { SYNTH_NAMES } = await import(path.join(__dirname, "..",
    "nukernel", "audio", "to-engine.js"));
  const FLEET = SYNTH_NAMES();
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
      assert.deepStrictEqual(DD.boxFxOf(d), [], gk + " boxFxOf");
      assert.strictEqual(DD.deskIsDefault(d, GENRES), true, gk + " deskIsDefault");
    }
  });
  ok("G8b every one of the 366 records carries a sound.buses", () =>
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
    const parts = DD.deskPartsOf(doc, GENRES), fx = DD.boxFxOf(doc);
    for (const b of boxes) { b.parts = parts; b.fx = fx; }
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
  console.log("  box chip       " + table(hBoxFx));
  console.log("  the board      " + nDeskVoices + " of " + nVoices +
              " voices carry a desk, over " + (nRecords - noDesk.length) +
              " of " + nRecords + " records · " + table(hDeskKey));
  console.log("  Does a dub record sound like a dub record and a chant like a " +
    "stone room?\n  That is the question this table cannot answer itself.\n");

  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
