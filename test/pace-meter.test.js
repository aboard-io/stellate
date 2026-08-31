#!/usr/bin/env node
// test/pace-meter.test.js — THE TIME LANE'S TWO WALLS, MEASURED (2026-08-30).
//
// WALL A — PER-SECTION PACE. ui/derive.js:697 declared "There is no
// per-section tempo control and there will not be one: the tempo is a fact
// about the SONG." Reversed 2026-08-30 (audio/plan.js paceTL carries the dated
// reversal): `pace` is a section WORD (compose.js PACES, dealt by dealPaces
// off an anchor's own `paces:` row), a multiplier on the record's ONE bpm
// (the 70..160 fence is untouched; engine spb stays 60/bpm on both paths).
// The word rides the rail the tempo map already rides — barBeats per bar —
// so the live walk and the press cannot disagree.
//
// WALL B — TRIPLE METER, the catalog path. kernel METERS, chair regrid and
// ideas-kit CELLS3/CELLS6 all predate this round; the wall was precompose
// hardcoding `meter: null` ("0 of 122 anchors declare a meter") and
// kernel.keep reading positions modulo 16 whatever the bar. An anchor row now
// says `meter: "three" | "six"` and the whole extraction counts in it.
//
// TEST THE ARTIFACT. A4/A5/B5 do not read tables — they compile a real
// record through audio/plan.js and, for the PCM claims, feed the REAL stream
// renderer (engine/faust/live/stream-renderer.js) with the REAL WASM procs
// (engine/faust/press/press.js mkProc — the same offline processors the
// press drives) and measure the frames each fed bar renders. Bar seconds at
// the PCM, not bar seconds in a comment.
//
// ABSENT IS TODAY is held by the neighbours, not re-proved here: the
// precompose frozen fixture (test/precompose.test.js, 46 green with these
// changes in) and deck byte-determinism (test/deck.test.js D3, green) both
// ran over records that say no pace and no meter.
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

/* ---------- the stub window (tape-reach's own harness) --------------------- */
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
const { GENRES } = window.NuGenres;
const NuDoc = window.NuDocument;
const NC = window.NuCompose;
const P = require(R("nukernel/precompose.js"));

(async () => {
console.log("test/pace-meter.test.js — the section's own clock, and the bar that counts in three\n");

const ST = await import(R("nukernel/ui/state.js"));
const PLAN = await import(R("nukernel/audio/plan.js"));

/* ===== A · PACE ========================================================== */

/* ---- A1 · absent is today at the deal: the declared set is a DECISION,
   and no anchor outside it may compose a worded section.
   REWRITTEN 2026-08-30, hours after it was written (the walls-down round;
   the old check read "no shipped anchor says `paces`, so no composed
   section may carry a word" — true for exactly the hours between the time
   lane landing and the exemplars shipping): `jingju` (banshi) and `khyal`
   (vilambit into drut) are the catalog's two paces rows now, listed here
   the way hook.test.js lists FROZEN_RHYTHM — a decision, so a third
   anchor growing a paces row trips this gate and gets argued, not
   smuggled. ------------------------------------------------------------ */
{
  /* THE THIRD EXEMPLAR, DECLARED 2026-08-31. `scotsfiddle` grew a `paces` map
     in the slowdive round and this gate caught it as an undeclared pace, which
     is exactly the job: the list is a DECISION and a row cannot join it by
     merely wanting to. The decision is yes. The record is a strathspey-into-
     reel SET, and a set that does not accelerate is not a set — the row argues
     it in place (steady through the strathspey, push into the reel, with the
     prechorus named so a bar of written tempo cannot sit inside the
     strathspey). That is the same kind of claim jingju's banshi and khyal's
     vilambit-to-drut make, which is what this list is for. */
  const PACED = ["jingju", "khyal", "scotsfiddle"];
  const anchors = P.anchors();
  const declared = anchors.filter((gk) => GENRES[gk] && GENRES[gk].paces);
  let worded = 0, outside = 0;
  for (const gk of anchors) {
    const Rr = NC.compose(gk, 2);
    for (const b of Rr.song) if (b.pace) {
      worded++;
      if (PACED.indexOf(gk) < 0) outside++;
    }
  }
  ok(declared.slice().sort().join(",") === PACED.slice().sort().join(",") &&
     outside === 0 && worded > 0,
     "A1 · the paced set is exactly the declared exemplars (jingju, khyal); " +
     "every other anchor composes wordless (" + anchors.length + " anchors, seed 2)",
     "declared=" + declared.join(",") + " worded=" + worded + " outside=" + outside);
}

/* ---- A2 · the deal: verbatim at seed 1, the anchor's own vocabulary at
   every seed, deterministic --------------------------------------------- */
{
  GENRES["test.pace"] = { ...GENRES.rock, label: "probe pace",
                          paces: { verse: "slow", chorus: "half" } };
  const r1 = NC.compose("test.pace", 1);
  // the deal's own addressing law: a stored build/prechorus is addressed by
  // its cue (compose.js sectionWord), so a prechorus-stored verse gets no
  // word from a row that names only verse and chorus
  const want = { verse: "slow", chorus: "half" };
  const verb = r1.song.every((b) =>
    (b.pace || undefined) === want[NC.sectionWord(b)]);
  ok(verb, "A2 · seed 1 applies the paces row verbatim (verse slow, chorus half)",
     r1.song.map((b) => NC.sectionWord(b) + ":" + (b.pace || "")).join(" "));
  const own = new Set(["slow", "half"]);
  let outside = 0, moved = 0;
  for (const s of [2, 3, 4, 5]) {
    const rs = NC.compose("test.pace", s);
    rs.song.forEach((b, i) => {
      if (b.pace && !own.has(b.pace)) outside++;
      const b1 = r1.song.find((x) => x.role === b.role);
      if (b.pace && b1 && b1.pace && b.pace !== b1.pace) moved++;
    });
  }
  ok(outside === 0, "A2 · every dealt word is from the anchor's own row (seeds 2..5)");
  ok(moved > 0, "A2 · the deal actually moves a section at some seed (formOf precedent)",
     "moved=" + moved);
  const x = JSON.stringify(NC.compose("test.pace", 3));
  const y = JSON.stringify(NC.compose("test.pace", 3));
  ok(x === y, "A2 · one seed, one record — the pace deal is deterministic");
}

/* ---- A3 · the carry: compose section -> form.sections[].pace -> box.pace */
{
  const doc = P.genreToDocument("test.pace", 1);
  const secWords = doc.form.sections.map((s) => s.pace || null);
  ok(secWords.some((w) => w === "slow") && secWords.some((w) => w === "half"),
     "A3 · form.sections[] carries the dealt words", JSON.stringify(secWords));
  const boxes = NuDoc.boxesOf(doc, "test.pace.carry.");
  const boxWords = boxes.map((b) => b.pace);
  ok(boxes.every((b, i) => (b.pace || null) === (doc.form.sections[i].pace || null)),
     "A3 · boxesOf copies pace beside lvl/env, present-only", JSON.stringify(boxWords));
}

/* ---- the seat: a real record into ui/state SONG/SLOTS, like ui/eight.js - */
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
const beatsBySection = (TL) => {
  const m = new Map();
  TL.forEach((bar) => { if (!m.has(bar.si)) m.set(bar.si, []); m.get(bar.si).push(bar.barSteps / 4); });
  return m;
};
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

/* ---- A4 · the clock: a half section's bars run 2x the beats, the tempo
   map's breathing intact on top; steady and absent are the same clock ---- */
await PLAN.warmEngine();
{
  const doc = P.genreToDocument("rock", 1);
  seatDoc(doc, "probe.pace.a4.");
  const base = beatsBySection(PLAN.compile());
  ST.SONG[1].pace = "half"; ST.SONG[2].pace = "steady";
  const paced = beatsBySection(PLAN.compile());
  const r1 = mean(paced.get(1)) / mean(base.get(1));
  ok(near(r1, 2, 0.02), "A4 · pace 'half' doubles the section's bar beats (x" + r1.toFixed(4) + ")");
  const r2 = mean(paced.get(2)) / mean(base.get(2));
  ok(r2 === 1, "A4 · pace 'steady' multiplies by nothing at all — not even x1 (x" + r2 + ")");
  const r0 = mean(paced.get(0)) / mean(base.get(0));
  ok(r0 === 1, "A4 · an unpaced neighbour is byte-identical (x" + r0 + ")");
  // the events stretch with their bar: the last event still lands inside it
  const TL = PLAN.compile();
  const inBar = TL.filter((b) => b.si === 1)
    .every((b) => b.ev.every((e) => e.off <= b.barSteps + 1));
  ok(inBar, "A4 · the paced bars' events scaled with the clock (none stranded past the bar)");
}

/* ---- A5 · the PCM: the real renderer, the real WASM, frames per fed bar - */
const PRESS = require(R("engine/faust/press/press.js"));
const SRE = require(R("engine/faust/live/stream-renderer.js"));
const RC = require(R("engine/faust/press/render-core.js"));
const SP = require(R("engine/faust/voices/sampler.js"));
const SE = require(R("engine/faust/voices/state-engine.js"));
const FP = require(R("engine/faust/voices/found-player.js"));
const SR = 44100, BS = 64;
const D = await PLAN.warmEngine();
async function framesPerBar(pickSis) {
  const state = PLAN.parentState();
  const eng = SRE.makeStreamEngine({ E: D.E, SE, FP, SP, mergeIvals: RC.mergeIvals,
    mkProc: PRESS.mkProc, rootOf: PRESS.rootOf, SR, BS, dx7Presets: PRESS.loadDx7Presets() });
  await eng.openLive({ ...state }, {});
  const spb = 60 / ST.bpm;
  const TL = PLAN.compile();
  const out = new Map();
  for (let i = 0; i < TL.length; i++) {
    const si = TL[i].si;
    if (!pickSis.includes(si)) continue;
    if ((out.get(si) || []).length >= 3) continue;
    const p = PLAN.barPlan(i);
    const fb = await eng.feedBar({ units: p ? p.units : {}, events: [], fxParams: null,
      spb, lo: 0, hi: PLAN.barBeatsAt(i), barStartSec: 0, sweeps: [], found: [],
      foundCi: 0, meta: { serial: i } });
    const c = eng.renderChunk(fb.index);
    if (!out.has(si)) out.set(si, []);
    out.get(si).push(c.length);
  }
  return out;
}
{
  const doc = P.genreToDocument("rock", 1);
  doc.form.sections[1].pace = "half";
  seatDoc(doc, "probe.pace.a5.");
  PLAN.compile();
  const f = await framesPerBar([0, 1]);
  const ratio = mean(f.get(1)) / mean(f.get(0));
  ok(near(ratio, 2, 0.03),
     "A5 · a half-paced bar occupies 2x the rendered PCM (x" + ratio.toFixed(4) +
     " — " + Math.round(mean(f.get(0))) + " -> " + Math.round(mean(f.get(1))) + " frames)");
}

/* ===== B · TRIPLE METER, THE CATALOG PATH ================================ */

/* ---- B1 · the anchor syntax, validated by name -------------------------- */
{
  GENRES["test.badmeter"] = { ...GENRES.barcarolle, meter: "waltzish" };
  let threw = "";
  try { P.genreToDocument("test.badmeter", 1); } catch (e) { threw = e.message; }
  ok(/test\.badmeter/.test(threw) && /meter/.test(threw),
     "B1 · an unknown meter word throws BY NAME at the door", threw);
  delete GENRES["test.badmeter"];
}

/* ---- B2 · a waltz exemplar on the rails: twelve steps end to end -------- */
GENRES["test.waltz"] = { ...GENRES.barcarolle, meter: "three", label: "probe waltz" };
const wdoc = P.genreToDocument("test.waltz", 1);
{
  ok(wdoc.time.meter === "three", "B2 · the document's Time axis carries the WORD",
     JSON.stringify(wdoc.time));
  const lens = Object.values(wdoc.material.cells)
    .filter((c) => c && c.deg).map((c) => c.deg.length);
  ok(lens.length > 0 && lens.every((n) => n % 12 === 0),
     "B2 · every line cell is extracted on twelve places (" + JSON.stringify(lens) + ")");
  const g0 = NuDoc.toGenre(wdoc, 0, GENRES);
  ok(K.stepsIn(g0) === 12 && g0.meter && g0.meter.pulse === 4,
     "B2 · toGenre re-attaches the METERS object and the kernel counts 12");
  const ph = NuDoc.toPhrase(wdoc, NuDoc.materialAt(
    wdoc.voices.filter((v) => v.kind === "line")[0], wdoc.form.sections[0].id));
  ok(ph.bar === 12 && ph.pulse === 4,
     "B2 · the phrase is stamped with its own bar (keep's meter door)");
  // ...and the word spelling reaches the kernel on the DIRECT path too
  ok(K.stepsIn({ meter: "three" }) === 12 && K.stepsIn({ meter: "nonsense" }) === 16,
     "B2 · kernel metOf resolves the word itself; an unknown word counts in four");
}

/* ---- B3 · it renders: real events, inside 12-step bars, not silent ------ */
{
  const g0 = NuDoc.toGenre(wdoc, 0, GENRES);
  const sec = wdoc.form.sections[0];
  const lines = wdoc.voices.filter((v) => v.kind === "line");
  const ph = NuDoc.toPhrase(wdoc, NuDoc.materialAt(lines[0], sec.id));
  const cb = NuDoc.barsOf(wdoc);
  const musical = Math.max(1, sec.bars * cb);
  const total = Math.ceil(musical / g0.bars) * g0.bars;
  const ev = K.render(ph, g0, total);
  const to = musical * K.stepsIn(g0) / g0.rate;
  const inside = ev.filter((e) => e.t < to);
  ok(inside.length > 0, "B3 · the 12-step record renders real events (" + inside.length + ")");
  // the downbeats land on multiples of 12, not 16: at least one event on a
  // 12-step bar line beyond step 0, and none claiming a 16-grid bar line that
  // a 12-bar doesn't have
  const on12 = inside.some((e) => e.t > 0 && e.t % 12 === 0);
  ok(on12, "B3 · bar lines fall every twelve steps");
}

/* ---- B4 · keep(), the named debt: correct in three, six, and unchanged in
   four -------------------------------------------------------------------- */
{
  const mk = (n) => ({ gate: new Array(n).fill(1), deg: new Array(n).fill(0) });
  const k3 = K.keep(0, 4, 8, 12)({ ...mk(12), bar: 12, pulse: 4 }).gate.join("");
  const k6 = K.keep(0, 4, 8, 12)({ ...mk(12), bar: 12, pulse: 6 }).gate.join("");
  const k16 = K.keep(0, 4, 8, 12)(mk(16)).gate.join("");
  ok(k3 === "100010001000", "B4 · keep(the beats) in three keeps the three beats (" + k3 + ")");
  ok(k6 === "100000100000", "B4 · keep(the beats) in six keeps the two big beats (" + k6 + ")");
  ok(k16 === "1000100010001000", "B4 · an unstamped phrase takes the mod-16 line it always did");
  // a two-bar 12-step phrase keeps its beats in BOTH bars (the very failure
  // the mod-16 comment promised)
  const k2bar = K.keep(0, 4, 8)({ ...mk(24), bar: 12, pulse: 4 }).gate.join("");
  ok(k2bar === "100010001000100010001000",
     "B4 · a two-bar twelve-step phrase keeps the beats in both bars (" + k2bar + ")");
}

/* ---- B5 · the PCM: a bar in three is three quarters of a bar in four ---- */
{
  seatDoc(wdoc, "probe.waltz.");
  const TL = PLAN.compile();
  const beats = TL.map((b) => b.barSteps / 4);
  ok(near(mean(beats), 3, 0.15),
     "B5 · every bar of the waltz compiles to ~3 beats (mean " + mean(beats).toFixed(3) + ")");
  const f = await framesPerBar([0]);
  const sec0 = mean(f.get(0)) / SR;
  const want = 3 * (60 / ST.bpm);
  ok(near(sec0, want, want * 0.05),
     "B5 · a 3/4 bar renders ~3 quarters of PCM at the record's own bpm (" +
     sec0.toFixed(3) + "s vs " + want.toFixed(3) + "s)");
  // determinism: the same waltz twice is the same record
  const a = JSON.stringify(P.genreToDocument("test.waltz", 2));
  const b = JSON.stringify(P.genreToDocument("test.waltz", 2));
  ok(a === b, "B5 · the meter'd record is deterministic, seed for seed");
}

delete GENRES["test.pace"]; delete GENRES["test.waltz"];
console.log("\n" + (fails ? fails + " failed of " + checks : "all " + checks + " checks pass"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
