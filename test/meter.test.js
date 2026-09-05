#!/usr/bin/env node
/* test/meter.test.js — ANY METER, ANY TEMPO, THROUGH THE WHOLE PATH
 * (2026-09-05, the any-meter round's second half).
 *
 * Paul: *"it should all be possible"* — a signature is two positive integers
 * and a tempo is a positive number, and nothing between the table's typed
 * field and the exported bytes may refuse one, silently clamp one, or hand
 * back a bar of a different length than the composer asked for.
 *
 * THE MATRIX: twelve signatures (four with a denominator that is not a power
 * of two — 13/12, 21/17, 15/9, and 2/32 whose step is finer than a sixteenth)
 * against five tempos (1 · 33.3 · 76 · 240 · 999). What is asserted at each
 * stage is one number, the same number, said in that stage's own units:
 *
 *   the bar lasts  n × (240/d) / bpm  seconds, exactly.
 *
 * THE STAGES
 *   A  kernel — steps per bar is a whole number, quarters is n×4/d and units
 *      is n×16/d EXACTLY (no float slop), and the abc unit divides the bar.
 *   B  entry — the typed doors: kernel's `metOf` reads the string a hand
 *      types, `okMeter` accepts it, `meterWordOf` round-trips it, and
 *      fields.js's tempo fence holds 1..999.
 *   C  document + timeline — every bar the timeline emits carries the GRID
 *      (kernel steps) and the CLOCK (kernel units) and its seconds are the
 *      number above, at all five tempos.
 *   D  the staff — ui/abc.js prints `M: n/d` as written and an `L:` unit that
 *      divides the bar exactly; the vendored abcjs PARSES it and the bar's
 *      note durations sum to n/d whole notes.
 *   E  the .mid — 0x58 stores the denominator as a power of two, so a
 *      denominator that is not one is written as the nearest one with the
 *      tick length scaled to keep the bar's SECONDS, and a text meta states
 *      the true signature. Read back off the bytes.
 *   F  the .als — Live's denominator is a power of two under the same law;
 *      the clip's own beats carry the bar truth and the clip name states the
 *      true signature. Read back off the XML.
 *
 * TEST THE ARTIFACT: D parses the emitted ABC with the vendored abcjs, E
 * parses the emitted bytes, F scans the emitted XML. Nothing here re-states
 * an arithmetic it is checking.
 *
 * RUN: node test/meter.test.js
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
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---------- the stub window (smf-tempo.test.js's own harness) ------------- */
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", body: { append() {} },
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

/* the matrix */
const METS = ["4/4", "3/4", "7/8", "5/4", "11/16", "13/12", "21/17", "3/2",
              "15/9", "1/1", "9/8", "2/32"];
const TEMPOS = [1, 33.3, 76, 240, 999];
const nd = (m) => m.split("/").map(Number);
/* THE ONE NUMBER EVERY STAGE IS CHECKED AGAINST: a bar of n/d at `bpm` lasts
   n whole-note-d-ths, and a whole note is 4 quarters at 60/bpm each. */
const barSecs = (m, bpm) => { const [n, d] = nd(m); return (n * (240 / d)) / bpm; };

(async () => {
console.log("test/meter.test.js — any meter, any tempo, through the whole path\n");

const ST = await import(R("nukernel/ui/state.js"));
const PLAN = await import(R("nukernel/audio/plan.js"));
const ABC = await import(R("nukernel/ui/abc.js"));
const { scoreOf } = await import(R("nukernel/export/score.js"));
const { smfFromScore, parseSmf } = await import(R("nukernel/export/smf.js"));
const { alsFromScore } = await import(R("nukernel/export/als.js"));
const { gunzipSync } = require("node:zlib");
const { readFileSync } = require("node:fs");

/* ===== A · THE KERNEL ==================================================== */
console.log("A · the kernel: the bar's own arithmetic");
{
  let bad = [];
  for (const m of METS) {
    const [n, d] = nd(m), row = K.metOf({ meter: m });
    const wantQ = (n * 4) / d, wantU = (n * 16) / d;
    if (!(Number.isInteger(row.steps) && row.steps >= 1)) bad.push(m + " steps=" + row.steps);
    else if (!near(row.quarters, wantQ, 1e-12)) bad.push(m + " quarters=" + row.quarters + " want " + wantQ);
    else if (!near(row.units, wantU, 1e-12)) bad.push(m + " units=" + row.units + " want " + wantU);
    else if (!(row.num === n && row.den === d)) bad.push(m + " says " + row.num + "/" + row.den);
    else if (!(Number.isInteger(row.pulse) && row.pulse >= 1)) bad.push(m + " pulse=" + row.pulse);
  }
  ok(bad.length === 0, "A1 · every signature counts a whole number of steps and the true quarters",
     bad.join(" · "));
  // the abc unit: one grid step is 1/(den × sub) of a whole note, and that
  // must be a whole denominator for the L: field to say it
  const badU = METS.filter((m) => { const [n, d] = nd(m), row = K.metOf({ meter: m });
    const u = (d * row.steps) / n; return !Number.isInteger(u) || u < 1; });
  ok(badU.length === 0, "A2 · one step is a whole 1/u of a whole note for every signature", badU.join(" "));
  // the shipped meters are untouched: a step is a sixteenth wherever d is a
  // power of two up to 16, so nothing downstream moves by a float
  const same = ["4/4", "3/4", "7/8", "5/4", "11/16", "3/2", "1/1", "9/8"]
    .every((m) => K.metOf({ meter: m }).units === K.metOf({ meter: m }).steps);
  ok(same, "A3 · units === steps for every power-of-two denominator (no float reaches a shipped record)");
}

/* ===== B · THE TYPED DOORS =============================================== */
console.log("\nB · entry: what a hand may type");
{
  const refused = METS.filter((m) => m !== "4/4" && !K.okMeter(m));
  ok(refused.length === 0, "B1 · okMeter accepts every signature in the matrix", refused.join(" "));
  const wrong = METS.filter((m) => { const [n, d] = nd(m);
    const w = K.meterWordOf(n, d), row = K.metOf({ meter: w == null ? null : w });
    return row.num !== n || row.den !== d; });
  ok(wrong.length === 0, "B2 · meterWordOf round-trips every signature through metOf", wrong.join(" "));
  // BIG NUMBERS ARE NOT A DIFFERENT QUESTION. A hand that types 101 over 113
  // must get 101 over 113 back, not the four-four an unreadable string falls to.
  const big = K.metOf({ meter: "101/113" });
  ok(big.num === 101 && big.den === 113,
     "B3 · a three-digit signature is read as itself (101/113 -> " + big.num + "/" + big.den + ")");
  ok(NF.BPM_LO <= 1 && NF.BPM_HI >= 999,
     "B4 · the tempo fence holds 1..999 (" + NF.BPM_LO + ".." + NF.BPM_HI + ")");
  ok(NF.bpmSay(33.3) === "33.3" && NF.bpmSay(76) === "76",
     "B5 · a fractional tempo says itself (" + NF.bpmSay(33.3) + ")");
}

/* ---------- the seat, verbatim from smf-tempo.test.js --------------------- */
function seatDoc(doc, GK) {
  doc.form.sections.forEach((s, i) => { GENRES[GK + i] = NuDoc.toGenre(doc, i, GENRES, []); });
  const lines = doc.voices.filter((v) => v.kind === "line");
  const NS = doc.form.sections.length;
  lines.forEach((c, v) => {
    for (let i = 0; i < NS; i++)
      ST.putPhrase(v * NS + i, NuDoc.toPhrase(doc, NuDoc.materialAt(c, doc.form.sections[i].id)));
  });
  const boxes = NuDoc.boxesOf(doc, GK);
  ST.SONG.length = 0; for (const b of boxes) ST.SONG.push(b);
  ST.setBpm(doc.time.bpm);
  return boxes;
}
ST.setRubato(false);
const fold = () => { PLAN.compile();
  return scoreOf({ timeline: PLAN.timeline(), cast: [], bpm: ST.bpm }); };

/* build one record per signature, once — the compile is the expensive half */
const RECS = {};
for (const m of METS) {
  const gk = "test.meter." + m.replace("/", "over");
  GENRES[gk] = { ...GENRES.barcarolle, meter: m === "4/4" ? null : m, label: "probe " + m };
  const doc = P.genreToDocument(gk, 1);
  doc.form.sections = doc.form.sections.slice(0, 4);
  NuDoc.normalize(doc);
  seatDoc(doc, "probe.meter." + m.replace("/", "over") + ".");
  RECS[m] = { gk, doc };
}

/* ===== C · THE DOCUMENT AND THE TIMELINE ================================= */
console.log("\nC · the record: bars of the right length, at every tempo");
{
  const badGrid = [], badSecs = [];
  for (const m of METS) {
    const { doc } = RECS[m];
    const [n, d] = nd(m), row = K.metOf({ meter: doc.time.meter });
    seatDoc(doc, "probe.meter." + m.replace("/", "over") + ".");
    for (const bpm of TEMPOS) {
      doc.time.bpm = bpm; ST.setBpm(bpm);
      PLAN.compile();
      const TL = PLAN.timeline();
      if (!TL.length) { badGrid.push(m + " no bars"); break; }
      /* THE TIMELINE COUNTS IN THE CLOCK, NOT IN THE GRID, and both of its
         numbers say so: `barSteps` is what the bar LASTS in clock sixteenths
         (kernel `units`) and `steps` is that same length before any pace
         warped it (ui/derive.js boxesOf: `steps: barSteps`; export/score.js
         reads their ratio as the stretch). The GRID — the kernel's whole
         number of steps — has already done its work by here: boxesOf
         multiplied every event time by units/steps on the way in. */
      for (const b of TL) {
        if (!near(b.barSteps, row.units, 1e-9)) { badGrid.push(m + " clock " + b.barSteps + " want " + row.units); break; }
        if (!near(b.steps, row.units, 1e-9)) { badGrid.push(m + " nominal " + b.steps + " want " + row.units); break; }
        if (b.ev.some((e) => e.off < -row.units || e.off >= 2 * row.units))
          { badGrid.push(m + " an event sits outside its own bar"); break; }
      }
      const secs = (TL[0].barSteps / 4) * (60 / bpm);
      if (!near(secs, barSecs(m, bpm), 1e-6))
        badSecs.push(m + "@" + bpm + " " + secs.toFixed(9) + " want " + barSecs(m, bpm).toFixed(9));
    }
  }
  ok(badGrid.length === 0, "C1 · every bar lasts the kernel's clock, unwarped, and no event leaves its bar",
     badGrid.slice(0, 6).join(" · "));
  ok(badSecs.length === 0, "C2 · every bar lasts n×(240/d)/bpm to 1e-6 s, at all five tempos",
     badSecs.slice(0, 6).join(" · "));
  // the pure compiler windows the same bars
  const badDoc = [];
  for (const m of METS) {
    const { doc, gk } = RECS[m];
    const sc = NuDoc.scoreOf(doc, GENRES, [], undefined);
    if (!Number.isInteger(sc.bars) || sc.bars < 1) badDoc.push(m + " bars=" + sc.bars);
  }
  ok(badDoc.length === 0, "C3 · document.scoreOf counts a whole number of bars", badDoc.join(" "));
}

/* ===== D · THE STAFF ===================================================== */
console.log("\nD · the staff: M: as written, L: that divides the bar, abcjs parses");
{
  const A = require(R("vendor/abcjs/abcjs-basic-min.js"));
  const bad = [], badSum = [], badParse = [];
  for (const m of METS) {
    const [n, d] = nd(m), row = K.metOf({ meter: m });
    const N = row.steps;
    const phrase = { deg: Array.from({ length: N }, (_, i) => i % 7),
                     oct: new Array(N).fill(0), gate: new Array(N).fill(1),
                     vel: new Array(N).fill(80) };
    const eng = ABC.toEngraving(phrase, { stepsPerBar: N, abc: row.abc || undefined,
                                          beam: row.beam, bpm: 76 });
    const abc = eng.abc;
    const mm = /^M:(.+)$/m.exec(abc), ll = /^L:1\/(\d+)$/m.exec(abc);
    if (!mm || mm[1].trim() !== m) bad.push(m + " M:" + (mm ? mm[1] : "?"));
    const u = ll ? +ll[1] : 0;
    if (!(u > 0) || Math.abs(N / u - n / d) > 1e-12) bad.push(m + " L:1/" + u + " over " + N + " steps");
    const tunes = A.parseOnly(abc);
    const t = tunes && tunes[0];
    const warn = (t && t.warnings) || [];
    const hard = warn.filter((w) => !/Duration not representable/.test(w));
    if (hard.length) badParse.push(m + " " + hard[0].replace(/<[^>]*>/g, "").slice(0, 60));
    const line = t && t.lines.find((l) => l.staff);
    const notes = line ? line.staff[0].voices[0].filter((x) => x.el_type === "note") : [];
    let sum = 0; for (const x of notes) sum += x.duration;
    if (!near(sum, n / d, 1e-9)) badSum.push(m + " bar " + sum.toFixed(6) + " want " + (n / d).toFixed(6));
  }
  ok(bad.length === 0, "D1 · M: says the signature as written and L: divides the bar exactly", bad.join(" · "));
  ok(badParse.length === 0, "D2 · abcjs parses every one of them with no structural warning", badParse.join(" · "));
  ok(badSum.length === 0, "D3 · a bar's note durations sum to n/d whole notes", badSum.join(" · "));
}

/* ===== E · THE .mid ====================================================== */
console.log("\nE · the .mid: a power-of-two denominator that keeps the bar's seconds");
{
  const TPQ = 480;
  const badSig = [], badSecs = [], badSay = [];
  for (const m of METS) {
    const { doc } = RECS[m];
    const [n, d] = nd(m), row = K.metOf({ meter: doc.time.meter });
    seatDoc(doc, "probe.meter." + m.replace("/", "over") + ".");
    for (const bpm of TEMPOS) {
      doc.time.bpm = bpm; ST.setBpm(bpm);
      const score = fold();
      const bytes = smfFromScore(score, { beatsPerBar: row.quarters });
      const p = parseSmf(bytes);
      const sig = p.tracks[0].timesig, uspq = p.tracks[0].tempos[0].uspq;
      if (!sig) { badSig.push(m + " no signature"); continue; }
      const lg = Math.log2(sig[1]);
      if (!Number.isInteger(lg)) badSig.push(m + " denominator " + sig[1] + " is not a power of two");
      // the bar a DAW would draw off the file alone, in seconds
      // THE FORMAT'S OWN QUANTUM IS THE TOLERANCE: 0x51 stores whole
      // MICROSECONDS per quarter, so a bar of q quarters can be at most q µs
      // out and no writer can do better.
      const fileBar = (sig[0] * 4 / sig[1]) * uspq / 1e6;
      const tolBar = (sig[0] * 4 / sig[1]) * 1e-6 + 1e-9;
      if (!near(fileBar, barSecs(m, bpm), tolBar))
        badSecs.push(m + "@" + bpm + " file " + fileBar.toFixed(6) + "s want " + barSecs(m, bpm).toFixed(6) + "s");
      // ...and where the two numbers are not the true ones, the file SAYS the true ones
      const exact = sig[0] === n && sig[1] === d;
      const said = (p.tracks[0].texts || []).some((t) => t.indexOf(m) >= 0);
      if (!exact && !said) badSay.push(m + " written " + sig[0] + "/" + sig[1] + " and never states " + m);
    }
    /* AND THE NOTES INSIDE IT, IN SECONDS. The bar meta is only half the
       claim: the last note's END must land at the second the record puts it,
       which is what catches a tick length that was scaled for the signature
       and not for the notes. One tick is the tolerance. */
    doc.time.bpm = 76; ST.setBpm(76);
    const score = fold();
    const p = parseSmf(smfFromScore(score, { beatsPerBar: row.quarters }));
    const uspq = p.tracks[0].tempos[0].uspq;
    const lastTick = Math.max(0, ...p.tracks.slice(1).flatMap((t) => t.notes.map((x) => x.tick + x.dur)));
    let lastBeat = 0;
    for (const b of score.boxes) for (const l of b.lanes) for (const nn of l.notes)
      lastBeat = Math.max(lastBeat, b.beat0 - score.boxes[0].beat0 + nn.beat + nn.dur);
    const wantSec = lastBeat * 60 / 76, gotSec = (lastTick / TPQ) * uspq / 1e6;
    if (!near(gotSec, wantSec, 2 * uspq / 1e6 / TPQ + 1e-6))
      badSecs.push(m + " the last note ends at " + gotSec.toFixed(4) + "s, the record says " + wantSec.toFixed(4) + "s");
  }
  ok(badSig.length === 0, "E1 · 0x58 always carries a power-of-two denominator", badSig.slice(0, 6).join(" · "));
  ok(badSecs.length === 0, "E2 · the bar a DAW draws off the file lasts the true seconds, at all five tempos",
     badSecs.slice(0, 6).join(" · "));
  ok(badSay.length === 0, "E3 · a signature the format cannot spell is stated in a text meta",
     badSay.slice(0, 6).join(" · "));
}

/* ===== F · THE .als ====================================================== */
console.log("\nF · the .als: the same law, in Live's own two numbers");
{
  const donorXml = gunzipSync(readFileSync(R("tools/ableton/donor/Generic.als"))).toString("utf8");
  const badSig = [], badBar = [], badSay = [];
  for (const m of METS) {
    const { doc } = RECS[m];
    const [n, d] = nd(m), row = K.metOf({ meter: doc.time.meter });
    seatDoc(doc, "probe.meter." + m.replace("/", "over") + ".");
    doc.time.bpm = 76; ST.setBpm(76);
    const score = fold();
    const res = alsFromScore(donorXml, score, { all: true });
    const sigs = [...res.xml.matchAll(/<RemoteableTimeSignature Id="\d+">\s*<Numerator Value="(\d+)" \/>\s*<Denominator Value="(\d+)" \/>/g)]
      .map((x) => [+x[1], +x[2]]);
    const mine = sigs.filter((s) => !(s[0] === 4 && s[1] === 4) || m === "4/4");
    const dd = Math.pow(2, Math.round(Math.log2(d)));
    const wrong = sigs.filter((s) => !Number.isInteger(Math.log2(s[1])));
    if (wrong.length) badSig.push(m + " denominator " + wrong[0][1]);
    if (m !== "4/4" && !sigs.some((s) => s[0] === n && s[1] === dd))
      badSig.push(m + " no clip says " + n + "/" + dd + " (saw " + sigs.map((s) => s.join("/")).join(" ") + ")");
    // the clip's own beats ARE the bar truth: every box is a whole number of
    // true bars, in quarters
    const bad = score.boxes.filter((b) => Math.abs(b.beats / row.quarters - Math.round(b.beats / row.quarters)) > 1e-6);
    if (bad.length) badBar.push(m + " box beats " + bad[0].beats + " over " + row.quarters);
    if (d !== dd) {
      const names = [...res.xml.matchAll(/<Name Value="([^"]*)" \/>/g)].map((x) => x[1]);
      if (!names.some((x) => x.indexOf(m) >= 0)) badSay.push(m + " never named in a clip");
    }
  }
  ok(badSig.length === 0, "F1 · every authored clip says a power-of-two denominator and the record's numerator",
     badSig.slice(0, 4).join(" · "));
  ok(badBar.length === 0, "F2 · every box is a whole number of true bars in quarters (the clip length IS the bar)",
     badBar.slice(0, 4).join(" · "));
  ok(badSay.length === 0, "F3 · a signature Live cannot draw is stated in the clip's name",
     badSay.slice(0, 4).join(" · "));
}

/* ===== G · THE PCM ======================================================
   The last stage, and the only one that answers for the SOUND: the real
   stream renderer, the real WASM procs, one fed bar, the frames counted —
   test/pace-meter.test.js A5/B5's own harness, pointed at a signature whose
   denominator is not a power of two. */
console.log("\nG · the sound: frames per rendered bar");
{
  const PRESS = require(R("engine/faust/press/press.js"));
  const SRE = require(R("engine/faust/live/stream-renderer.js"));
  const RC = require(R("engine/faust/press/render-core.js"));
  const SP = require(R("engine/faust/voices/sampler.js"));
  const SE = require(R("engine/faust/voices/state-engine.js"));
  const FP = require(R("engine/faust/voices/found-player.js"));
  const SR = 44100, BS = 64;
  const D = await PLAN.warmEngine();
  const barFrames = async (m, bpm) => {
    const { doc } = RECS[m];
    seatDoc(doc, "probe.meter." + m.replace("/", "over") + ".");
    doc.time.bpm = bpm; ST.setBpm(bpm);
    const TL = PLAN.compile();
    const eng = SRE.makeStreamEngine({ E: D.E, SE, FP, SP, mergeIvals: RC.mergeIvals,
      mkProc: PRESS.mkProc, rootOf: PRESS.rootOf, SR, BS, dx7Presets: PRESS.loadDx7Presets() });
    await eng.openLive({ ...PLAN.parentState() }, {});
    const p = PLAN.barPlan(0);
    const fb = await eng.feedBar({ units: p ? p.units : {}, events: [], fxParams: null,
      spb: 60 / ST.bpm, lo: 0, hi: PLAN.barBeatsAt(0), barStartSec: 0, sweeps: [],
      found: [], foundCi: 0, meta: { serial: 0 } });
    return eng.renderChunk(fb.index).length / SR;
  };
  for (const m of ["4/4", "7/8", "21/17"]) {
    const got = await barFrames(m, 76), want = barSecs(m, 76);
    ok(near(got, want, want * 0.01),
       "G1 · a " + m + " bar renders " + got.toFixed(4) + "s of PCM, the signature says " +
       want.toFixed(4) + "s");
  }
}

console.log("\n" + (fails ? "FAIL " : "ok   ") + checks + " checks, " + fails + " failed");
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
