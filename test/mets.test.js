#!/usr/bin/env node
/* test/mets.test.js — THE METRONOME MARKS ON THE BAND PAGE (2026-09-05).
 *
 * Paul: the band page has no metronome marks. It had none: `ui/abc.js
 * toScore` refused a `Q:` in writing ("the tempo mark costs a line of height
 * … a score that repeats it buys nothing"), so a printed part left this page
 * with a key, a signature, dynamics, chord symbols and repeat marks and no
 * tempo at all — while the OTHER staff on the page, the engraving, had a `Q:`
 * of its own that no caller passed a tempo to. Two staves, two answers, and
 * the second answer was silence.
 *
 * WHAT IS ASSERTED
 *   M1  THE BEAT IS THE DENOMINATOR'S. ♩ for /4, ♪ for /8, 𝅗𝅥 for /2, and the
 *       fraction the `L:` line already writes ("1/17") where Unicode has no
 *       single notehead for the value — the same refusal timeHead makes.
 *   M2  THE NUMBER IS WHAT PLAYS, not what is written. bpm × rate × d/4, and
 *       a bar at that mark lasts exactly the seconds the record gives it
 *       (ui/derive.js secsOf: `units / rate` clock sixteenths). Twelve
 *       signatures × five tempos × three reading speeds.
 *   M3  REGGAE · KINGSTON 1969 — thirteen sections, ONE mark, in the header.
 *   M4  ROME 600 — the same, with the half-time rule NAMED beside it, and the
 *       number is the sounding 40 and not the written 80.
 *   M5  A MARK IS PRINTED WHERE IT CHANGES AND NOWHERE ELSE — a per-section
 *       reading speed and a per-section signature, both hand-made (measured:
 *       0 of 479 catalogue anchors deal a per-section rate).
 *   M6  `Q:` IS THE BAND MARK. The score's header field, the engraving's
 *       header field and `metMark().q` are one string, off one function.
 *   M7  THE ARTIFACT PARSES. The emitted ABC through the vendored abcjs: the
 *       tempo element's duration is 1/d and its bpm is the mark's, an inline
 *       change is a SECOND tempo element, and no structural warning.
 *   M8  THE WORDS ARE THE CATALOGUE'S. Every key `metsOf` can ask for is in
 *       nukernel/ui/copy.js, so a second language reaches the paper.
 *
 * TEST THE ARTIFACT: every claim below is read off the emitted ABC STRING or
 * off abcjs's parse of it, never off the model alone.
 *
 * RUN: node test/mets.test.js
 */
"use strict";
const path = require("path");
const R = (p) => path.join(__dirname, "..", p);

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n       " + detail : ""));
  return false;
};

/* ---------- the stub window (meter.test.js's own harness) ---------------- */
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", readyState: "complete",
  body: { append() {} }, querySelectorAll: () => [], addEventListener() {},
  createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
window.NuKernel = require(R("nukernel/kernel.js"));
window.NuGenres = require(R("nukernel/genres.js"));
window.NuFields = require(R("nukernel/fields.js"));
window.NuSong = require(R("nukernel/song.js"));
window.NuInstruments = require(R("nukernel/instruments.js"));
window.NuCompose = require(R("nukernel/compose.js"));
window.PRESETS = require(R("nukernel/presets.js")).PRESETS;
window.NuDocument = require(R("nukernel/document.js"));
window.NuSongs = require(R("nukernel/songs.js"));
window.__REGISTRY = require(R("engine/registry-data.js"));

const K = window.NuKernel;
const NF = window.NuFields;
const { GENRES } = window.NuGenres;
const NuDoc = window.NuDocument;
const P = require(R("nukernel/precompose.js"));

(async () => {
const ABC = await import(R("nukernel/ui/abc.js"));
const COPY = await import(R("nukernel/ui/copy.js"));
const A = require(R("vendor/abcjs/abcjs-basic-min.js"));
const { metMark, metsOf, toScore, toEngraving, BEAT_GLYPH } = ABC;

console.log("test/mets.test.js — the metronome marks on the band page\n");

/* the sections of one record, as the page reads them: what each ACTUALLY
   plays. `toGenre` is the pure compiler's fold of the same row the page's
   `sectionRender` folds, so the reading speed and the signature here are the
   ones the engine is handed. */
function sectionsOf(doc) {
  const out = [];
  let bar = 0;
  for (let si = 0; si < doc.form.sections.length; si++) {
    const g = NuDoc.toGenre(doc, si, GENRES, []);
    const m = K.metOf(g);
    out.push({ rate: g.rate > 0 ? g.rate : 1, sig: m.num + "/" + m.den, bar });
    bar += doc.form.sections[si].bars | 0;
  }
  return out;
}
const swungOf = (doc) => !!(doc.time.swing && NF.SWINGS[doc.time.swing] > 0);
const marksOf = (doc) => metsOf({ bpm: doc.time.bpm, swing: swungOf(doc),
                                  sections: sectionsOf(doc), say: COPY.t });

/* ONE SYSTEM OF THE RECORD, AS A STRING — the artifact every claim below is
   read off. Two voices of plain quarter notes, the record's own signature and
   bar count, and the marks handed in exactly as ui/eight.js buildScore hands
   them to toScore. */
function paperOf(doc, M, bars) {
  const met = doc.time.meter ? K.metOf(doc.time) : K.MET4;
  const spb = met.steps;
  const N = spb * bars;
  const ph = { deg: Array.from({ length: N }, (_, i) => i % 7),
               oct: new Array(N).fill(0), gate: new Array(N).fill(1),
               vel: new Array(N).fill(80) };
  return toScore([{ name: "lead", phrase: ph }, { name: "bass", phrase: ph }],
    { stepsPerBar: spb, close: "|]",
      ...(met === K.MET4 ? {} : { abc: met.abc, beam: met.beam }),
      ...(M && M.q ? { q: M.q } : {}),
      ...(M && M.mets.size ? { mets: M.mets } : {}) }).abc;
}
const qLine = (abc) => { const m = /^Q:(.+)$/m.exec(abc); return m ? m[1] : null; };
const inlineQ = (abc) => (abc.match(/\[Q:[^\]]*\]/g) || []);
const inlineM = (abc) => (abc.match(/\[M:[^\]]*\]/g) || []);

/* ===== M1 · THE BEAT IS THE DENOMINATOR'S ================================ */
console.log("M1 · the beat unit the denominator names");
{
  /* THE GLYPHS BY CODE POINT, not retyped: a note value has one Unicode
     character (U+1D15D WHOLE NOTE … U+1D162 THIRTY-SECOND NOTE, with the
     quarter and the eighth at U+2669/U+266A where they have lived since
     Unicode 1.1), and a second copy of them spelled out in this file would be
     a second copy that can be a decomposed sequence instead. */
  const want = { 1: 0x1d15d, 2: 0x1d15e, 4: 0x2669,
                 8: 0x266a, 16: 0x1d161, 32: 0x1d162 };
  const bad = [];
  for (const d of Object.keys(want)) {
    const g = metMark({ bpm: 76, meter: "4/" + d }).glyph;
    if (g !== String.fromCodePoint(want[d]))
      bad.push("1/" + d + " drew U+" +
               (g ? g.codePointAt(0).toString(16) : "none").toUpperCase());
  }
  ok(!bad.length, "M1a a power-of-two denominator names a notehead", bad.join(" · "));
  const odd = metMark({ bpm: 76, meter: "21/17" });
  ok(odd.glyph === null && odd.unit === "1/17" && odd.text.startsWith("1/17 = "),
     "M1b 21/17 writes its beat as the fraction, the way L: does — " + odd.text);
  ok(metMark({ bpm: 76, meter: "13/12" }).text.startsWith("1/12 = "),
     "M1c 13/12 too — " + metMark({ bpm: 76, meter: "13/12" }).text);
  ok(metMark({ bpm: 79, meter: "4/4" }).text === "♩ = 79",
     "M1d the mark reads \"♩ = 79\" — " + metMark({ bpm: 79, meter: "4/4" }).text);
  ok(Object.keys(BEAT_GLYPH).length === 6, "M1e six note values and no more");
}

/* ===== M2 · THE NUMBER IS WHAT PLAYS ===================================== */
console.log("\nM2 · bpm x rate x d/4, and the bar lasts what the record gives it");
{
  const METS = ["4/4", "3/4", "7/8", "5/4", "11/16", "13/12", "21/17", "3/2",
                "15/9", "1/1", "9/8", "2/32"];
  const TEMPOS = [1, 33.3, 76, 240, 999];
  const RATES = [0.5, 1, 2];
  const badN = [], badS = [], badR = [];
  for (const m of METS) for (const bpm of TEMPOS) for (const rate of RATES) {
    const [n, d] = m.split("/").map(Number);
    const mk = metMark({ bpm, rate, meter: m });
    const exact = bpm * rate * d / 4;
    if (mk.perMin !== Math.round(exact * 10) / 10)
      badN.push(m + "@" + bpm + "x" + rate + " " + mk.perMin +
                " want " + (Math.round(exact * 10) / 10));
    /* AND THE SECONDS, WHICH IS THE ONLY THING THAT ANSWERS FOR A MARK. A bar
       of n/d is n beats of 1/d, so at `exact` of them a bar lasts n*60/exact
       — and ui/derive.js secsOf gives that same bar `units / rate` clock
       sixteenths at 60/bpm/4 each. The two must be ONE number, exactly. */
    const fromMark = (n * 60) / exact;
    const fromRecord = (K.metOf({ meter: m }).units / rate) * (60 / bpm / 4);
    if (Math.abs(fromMark - fromRecord) > 1e-9 * fromRecord)
      badS.push(m + "@" + bpm + "x" + rate + " " + fromMark.toFixed(9) +
                " want " + fromRecord.toFixed(9));
    // ...and what the TENTH costs, which is the only distance between the
    // exact number and the printed one: half a tenth, never more.
    if (Math.abs(mk.perMin - exact) > 0.05 + 1e-9)
      badR.push(m + "@" + bpm + "x" + rate + " " + mk.perMin + " vs " + exact);
  }
  ok(!badN.length, "M2a the number is bpm x rate x d/4, to a tenth (180 cases)",
     badN.slice(0, 4).join(" · "));
  ok(!badS.length, "M2b a bar at the mark lasts exactly what ui/derive.js secsOf gives it",
     badS.slice(0, 4).join(" · "));
  ok(!badR.length, "M2b2 and the printed tenth is never more than 0.05 off it",
     badR.slice(0, 4).join(" · "));
  ok(metMark({ bpm: 33.3, meter: "4/4" }).q === "1/4=33.3",
     "M2c the tenth survives (v286's law) — " + metMark({ bpm: 33.3, meter: "4/4" }).q);
}

/* ===== M3 · REGGAE · KINGSTON 1969 ====================================== */
console.log("\nM3 · reggae, seed 1 — thirteen sections, one mark");
const RG = NuDoc.normalize(P.genreToDocument("reggae", 1));
{
  const S = sectionsOf(RG), M = marksOf(RG);
  ok(S.length === 13, "M3a thirteen sections — " + S.length);
  ok(S.every((s) => s.rate === 1 && s.sig === "4/4"),
     "M3b every one of them plays 4/4 at the written speed");
  ok(M && M.q === "1/4=" + RG.time.bpm,
     "M3c the header mark is 1/4=" + RG.time.bpm + " — " + (M && M.q));
  ok(M && M.marks.filter((x) => x.printed).length === 1,
     "M3d exactly one mark is printed, at section 0");
  ok(M && M.mets.size === 0, "M3e and nothing inline: the tempo never moves");
  const abc = paperOf(RG, M, 4);
  ok(qLine(abc) === M.q, "M3f the paper's Q: field is that mark — Q:" + qLine(abc));
  ok(!inlineQ(abc).length && !inlineM(abc).length,
     "M3g no inline field anywhere in the system");
  /* THE BEFORE, MEASURED: the same paper with no marks handed in is the
     string this page has always drawn, and it says nothing about tempo. */
  const bare = paperOf(RG, null, 4);
  ok(qLine(bare) === null && !/Q:/.test(bare),
     "M3h before: the same system carries no tempo mark at all");
  ok(abc.replace(/^Q:.*\n/m, "") === bare,
     "M3i and the mark is the ONLY difference between them");
}

/* ===== M4 · ROME 600, IN HALF TIME ====================================== */
console.log("\nM4 · gregorian, seed 1 — the rule is named and the number is the sounding one");
{
  const doc = NuDoc.normalize(P.genreToDocument("gregorian", 1));
  const S = sectionsOf(doc), M = marksOf(doc);
  const bpm = doc.time.bpm;
  ok(S.every((s) => s.rate === 0.5),
     "M4a every section reads at half speed (the row's own rate)");
  ok(M && M.marks.filter((x) => x.printed).length === 1 && M.mets.size === 0,
     "M4b one mark, in the header, and nothing inline");
  ok(M && M.q === "1/4=" + (bpm / 2) + " \"" + COPY.t("mark.halfTime") + "\"",
     "M4c the mark is the SOUNDING tempo with its rule named — " + (M && M.q));
  ok(M && M.marks[0].mark.text === "♩ = " + (bpm / 2) + " " + COPY.t("mark.halfTime"),
     "M4d ...and reads \"" + (M && M.marks[0].mark.text) + "\", not the written " + bpm);
  const abc = paperOf(doc, M, 4);
  ok(qLine(abc) === M.q, "M4e the paper says it: Q:" + qLine(abc));
}

/* ===== M5 · PRINTED WHERE IT CHANGES, AND NOWHERE ELSE =================== */
console.log("\nM5 · a change, and only a change");
{
  /* MEASURED FIRST, 2026-09-05: no anchor in the catalogue deals a
     per-section reading speed, so this case is made by hand — `rate` is a ROW
     field (document.js FIELDS, tier "row") and a hand may write it. */
  let dealt = 0;
  for (const gk of P.anchors()) {
    let d; try { d = NuDoc.normalize(P.genreToDocument(gk, 1)); } catch (e) { continue; }
    if (d.form.sections.some((s) => s.rate)) dealt++;
  }
  ok(dealt === 0, "M5a 0 of 479 anchors deal a per-section speed — " + dealt);

  const doc = NuDoc.normalize(P.genreToDocument("reggae", 1));
  doc.form.sections[4].rate = "half";
  const S = sectionsOf(doc), M = marksOf(doc);
  ok(S[4].rate === 0.5 && S[3].rate === 1 && S[5].rate === 1,
     "M5b section 4 alone reads at half speed");
  const printed = M.marks.filter((x) => x.printed).map((x) => x.si);
  ok(printed.join(",") === "0,4,5",
     "M5c marks at sections 0, 4 and 5 — the change and the change back — got " +
     printed.join(","));
  const bpm = doc.time.bpm;
  ok(M.marks[4].mark.q === "1/4=" + (bpm / 2) + " \"" + COPY.t("mark.halfTime") + "\"",
     "M5d the new mark names the rule — " + M.marks[4].mark.q);
  ok(M.marks[5].mark.q === "1/4=" + bpm,
     "M5e ...and the one that returns states the tempo alone — " + M.marks[5].mark.q);
  const bars = doc.form.sections.reduce((a, s) => a + (s.bars | 0), 0);
  const abc = paperOf(doc, M, bars);
  const ins = inlineQ(abc);
  ok(ins.length === 2, "M5f two inline fields on the paper — " + ins.length);
  ok(ins[0] === "[Q:" + M.marks[4].mark.q + "]" &&
     ins[1] === "[Q:" + M.marks[5].mark.q + "]",
     "M5g and they are those two marks — " + ins.join(" "));
  /* ON THE TOP STAFF ONLY, which is where a metronome mark goes. */
  const v1 = abc.split("\n").find((l) => /^\[Q:|\[Q:/.test(l) && !/^Q:/.test(l));
  const perVoice = abc.split("\n").filter((l) => /\[Q:/.test(l));
  ok(perVoice.length === 1, "M5h ...on ONE staff, not on every voice — " + perVoice.length);
  ok(v1 != null, "M5i the marked line is a music line");
  /* AND AT THE RIGHT BAR: section 4 starts on the bar the record starts it on,
     and the mark is that many barlines into the line. */
  const barsBefore = doc.form.sections.slice(0, 4).reduce((a, s) => a + (s.bars | 0), 0);
  const upTo = perVoice[0].slice(0, perVoice[0].indexOf("[Q:"));
  ok((upTo.match(/ \|{1,2}[:\]]? /g) || []).length === barsBefore,
     "M5j the first mark opens bar " + barsBefore + " — the bar section 4 starts on");

  /* A SIGNATURE CHANGE prints `[M:]` with it. `meter` is a RECORD field
     today (document.js FIELDS, tier "record"), so this is asked of `metsOf`
     directly — the one owner of the change law. */
  const MM = metsOf({ bpm: 100, swing: false, say: COPY.t, sections: [
    { rate: 1, sig: "4/4", bar: 0 }, { rate: 1, sig: "4/4", bar: 4 },
    { rate: 1, sig: "7/8", bar: 8 }, { rate: 1, sig: "7/8", bar: 12 }] });
  ok(MM.q === "1/4=100" && MM.mets.size === 1,
     "M5k four sections, one signature change, one inline field");
  ok(MM.mets.get(8) === "[M:7/8][Q:1/8=200]",
     "M5l the signature and the new beat, at bar 8 — " + MM.mets.get(8));
  const nomove = metsOf({ bpm: 100, swing: false, say: COPY.t, sections: [
    { rate: 1, sig: "2/4", bar: 0 }, { rate: 1, sig: "4/4", bar: 2 }] });
  ok(nomove.mets.get(2) === "[M:4/4]",
     "M5m a signature change at the same beat prints the signature alone — " +
     nomove.mets.get(2));
}

/* ===== M6 · Q: IS THE BAND MARK ========================================= */
console.log("\nM6 · one function, two staves");
{
  const bad = [];
  for (const m of ["4/4", "6/8", "3/4", "21/17", "3/2"])
    for (const bpm of [76, 33.3, 122]) for (const rate of [0.5, 1]) {
      const mk = metMark({ bpm, rate, meter: m });
      const row = K.metOf({ meter: m });
      const N = row.steps;
      const ph = { deg: new Array(N).fill(0), oct: new Array(N).fill(0),
                   gate: new Array(N).fill(1), vel: new Array(N).fill(80) };
      // the ENGRAVING's own header, the one v286 taught the tenth to
      const eng = toEngraving(ph, { stepsPerBar: N, abc: row.abc || undefined,
                                    beam: row.beam, bpm, rate });
      const engQ = qLine(eng.abc);
      // ...and the SCORE's, which had none at all until today
      const sc = toScore([{ name: "lead", phrase: ph }],
        { stepsPerBar: N, abc: row.abc || undefined, beam: row.beam, q: mk.q });
      const scQ = qLine(sc.abc);
      if (engQ !== mk.q || scQ !== mk.q)
        bad.push(m + "@" + bpm + "x" + rate + " eng=" + engQ + " score=" + scQ +
                 " mark=" + mk.q);
    }
  ok(!bad.length, "M6a the engraving's Q:, the score's Q: and metMark().q are one string",
     bad.slice(0, 3).join(" · "));
  /* AND THE BAND PAGE'S OWN, on the record the page opens with. */
  const M = marksOf(RG);
  const abc = paperOf(RG, M, 4);
  const S = sectionsOf(RG);
  ok("Q:" + metMark({ bpm: RG.time.bpm, rate: S[0].rate, meter: S[0].sig }).q ===
     "Q:" + qLine(abc),
     "M6b the band page's header field is metMark's answer for section 0");
}

/* ===== M7 · THE ARTIFACT PARSES ========================================= */
console.log("\nM7 · the vendored abcjs reads what was written");
{
  const doc = NuDoc.normalize(P.genreToDocument("nationalism", 1));
  const S = sectionsOf(doc), M = marksOf(doc);
  ok(S[0].sig === "6/8" && M.q === "1/8=" + doc.time.bpm * 2,
     "M7a a 6/8 record counts its beat in eighths — " + M.q);
  const abc = paperOf(doc, M, 4);
  const t = A.parseOnly(abc)[0];
  const warn = ((t && t.warnings) || []).filter((w) => !/Duration not representable/.test(w));
  ok(!warn.length, "M7b abcjs parses it with no structural warning",
     warn.slice(0, 2).map((w) => String(w).replace(/<[^>]*>/g, "")).join(" · "));
  const tp = t && t.metaText && t.metaText.tempo;
  ok(tp && Math.abs(tp.duration[0] - 1 / 8) < 1e-9 && tp.bpm === doc.time.bpm * 2,
     "M7c the drawn mark is an eighth at " + (tp && tp.bpm));

  /* an INLINE change comes back as a second tempo element, in the staff. */
  const doc2 = NuDoc.normalize(P.genreToDocument("reggae", 1));
  doc2.form.sections[4].rate = "half";
  const M2 = marksOf(doc2);
  const bars = doc2.form.sections.reduce((a, s) => a + (s.bars | 0), 0);
  const t2 = A.parseOnly(paperOf(doc2, M2, bars))[0];
  const tempos = [];
  for (const l of (t2.lines || [])) {
    if (!l.staff) continue;
    for (const st of l.staff) for (const v of st.voices) for (const el of v)
      if (el.el_type === "tempo") tempos.push(el.bpm);
  }
  /* WHAT THE TENTH COSTS ON THE PAPER, MEASURED AND WRITTEN DOWN. The
     vendored abcjs reads a tempo with `parseInt`, so a mark of 39.5 is drawn
     39 — reggae's 79 in half time is the case, and it is the same shape of
     refusal `timeHead` already makes for a seventeenth: the STRING says the
     true number (anything reading the ABC back gets 39.5), the drawn glyph is
     the nearest one the renderer has. Asserted rather than tolerated, so an
     abcjs that one day keeps the tenth is caught here rather than surprising
     somebody. */
  ok(tempos.length === 2 &&
     tempos[0] === Math.trunc(doc2.time.bpm / 2) && tempos[1] === doc2.time.bpm,
     "M7d two inline tempo elements, " + tempos.join(" then ") +
     ", where the record changes speed");
  ok(/\[Q:1\/4=39\.5 /.test(paperOf(doc2, M2, bars)),
     "M7d2 ...and the string kept the tenth abcjs truncates (39.5 drawn 39)");
  const w2 = (t2.warnings || []).filter((w) => !/Duration not representable/.test(w));
  ok(!w2.length, "M7e and no structural warning on that one either",
     w2.slice(0, 2).map((w) => String(w).replace(/<[^>]*>/g, "")).join(" · "));
}

/* ===== M8 · THE WORDS ARE THE CATALOGUE'S =============================== */
console.log("\nM8 · every word on the mark is translatable");
{
  const keys = ["mark.halfTime", "mark.doubleTime", "mark.pair", "field.swing"];
  const missing = keys.filter((k) => !COPY.has(k));
  ok(!missing.length, "M8a every key metsOf can ask for is in the catalogue",
     missing.join(" "));
  /* the two reading speeds the vocabulary HAS words for are exactly
     fields.js RATES — a rate it has no word for gets no word, not a wrong one */
  const M = metsOf({ bpm: 80, swing: true, say: COPY.t, sections: [
    { rate: 2, sig: "4/4", bar: 0 }, { rate: 0.25, sig: "4/4", bar: 4 }] });
  ok(M.q === '1/4=160 "' + COPY.t("mark.pair",
       { a: COPY.t("mark.doubleTime"), b: COPY.t("field.swing") }) + '"',
     "M8b two rules at one mark join through mark.pair — " + M.q);
  ok(M.mets.get(4) === "[Q:1/4=20]",
     "M8c a speed the vocabulary has no word for states the number alone — " +
     M.mets.get(4));
  ok(Object.keys(NF.RATES).length === 2,
     "M8d fields.js RATES is the owning table and still has two entries");
  /* the words are the CALLER's: a gate with no catalogue gets the keys back
     and nothing in this file has a literal in it */
  const raw = metsOf({ bpm: 80, swing: false, sections: [{ rate: 0.5, sig: "4/4", bar: 0 }] });
  ok(raw.q === '1/4=40 "mark.halfTime"',
     "M8e ...and abc.js itself holds no word, only the key — " + raw.q);
}

console.log("\nmets: " + (checks - fails) + " ok, " + fails + " failed");
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
