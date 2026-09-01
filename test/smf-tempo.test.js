#!/usr/bin/env node
// test/smf-tempo.test.js — THE EXPORTED TEMPO MAP, PARSED BACK (2026-08-30,
// the five-walls follow-up round).
//
// The five-walls round proved pace and meter at the PCM (test/pace-meter.test.js
// A5/B5: a `half` section renders 2x the frames; a 3/4 bar renders 2.395s
// against 2.368 expected at the record's own bpm). What it left named as a
// follow-up is the EXPORTS: the .mid and .als carried a paced section as
// STRETCHED note values at one tempo, and a 3/4 record as bars of 4/4. Now:
//
//   T1  a paced record's .mid carries SET-TEMPO metas at each section
//       boundary where the pace changes (bpm x PACE_RATE, measured off the
//       timeline as box.k — export/score.js), the notes UN-stretched; the
//       tempo events land at the right ticks, and the bar seconds a
//       DAW-shaped read of the FILE implies equal the timeline's own bar
//       seconds — the same numbers the PCM gate proved land at the speakers.
//   T2  an UNPACED record's .mid has exactly one tempo meta and no
//       signature change — and two exports are byte-identical (the D4c pin;
//       the before/after pin against v199's own writer was run once at land
//       time: beatgroup --genre, 10,001 bytes, byte-identical).
//   T3  a metered record's .mid says its true signature (3/4, 6/8 — kernel
//       METERS' own abc through the Score's meterAbc stamp) and its implied
//       bar seconds match the PCM measurement the pace-meter gate reported.
//   T4  the .als: same fold, same map — the donor's OWN tempo-envelope shape
//       (MainTrack AutomationEnvelope -> PointeeId of <Tempo>'s
//       AutomationTarget, FloatEvent rows — measured in BOTH donors) carries
//       the map as double-point steps, the scenes carry launch tempos, the
//       clips carry the true signature, and every element shape in the paced
//       output is a shape the donor already holds (gate 2's own check, run
//       here on the paced record nobody exports by --genre).
//
// Everything asserted here is read off the BYTES (parseSmf over the .mid,
// string scans over the .als XML) — TEST THE ARTIFACT.
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

/* ---------- the stub window (pace-meter's own harness) --------------------- */
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

const { GENRES } = window.NuGenres;
const NuDoc = window.NuDocument;
const P = require(R("nukernel/precompose.js"));
const TPQ = 480;

(async () => {
console.log("test/smf-tempo.test.js — the tempo map, parsed back off the exported bytes\n");

const ST = await import(R("nukernel/ui/state.js"));
const PLAN = await import(R("nukernel/audio/plan.js"));
const { scoreOf } = await import(R("nukernel/export/score.js"));
const { smfFromScore, parseSmf } = await import(R("nukernel/export/smf.js"));
const { alsFromScore, paceView } = await import(R("nukernel/export/als.js"));
const { gunzipSync } = require("node:zlib");
const { readFileSync } = require("node:fs");

/* the seat, verbatim from pace-meter.test.js */
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
// the exporters run on the GRID (score-node loadScore / als-page pageScore
// both switch rubato off for the fold) — so does this gate
ST.setRubato(false);

const fold = () => { PLAN.compile();
  return scoreOf({ timeline: PLAN.timeline(), cast: [], bpm: ST.bpm }); };

/* ===== T1 · the paced .mid ============================================== */
{
  const doc = P.genreToDocument("rock", 1);
  doc.form.sections[1].pace = "half";
  seatDoc(doc, "probe.smf.pace.");
  const score = fold();
  const ks = score.boxes.map((b) => b.k);
  ok(ks[0] === 1 && ks[1] === 2 && ks.slice(2).every((k) => k === 1),
     "T1 · scoreOf measured the stretch off the timeline (k = " + ks.join(",") + ")");
  const bytes = smfFromScore(score, { beatsPerBar: 4 });
  const parsed = parseSmf(bytes);
  const cond = parsed.tracks[0];
  // base tempo + into-half + back-to-steady = 3 tempo events
  ok(cond.tempos.length === 3,
     "T1 · the conductor carries the map: " + cond.tempos.length + " set-tempo metas (base, half, back)");
  const bpm = score.bpm;
  const t1 = Math.round(score.boxes[0].beats * TPQ);
  const t2 = Math.round((score.boxes[0].beats + score.boxes[1].beats / 2) * TPQ);
  ok(cond.tempos[0].tick === 0 && cond.tempos[1].tick === t1 && cond.tempos[2].tick === t2,
     "T1 · the metas land at the section doors (ticks " +
     cond.tempos.map((t) => t.tick).join(",") + " want 0," + t1 + "," + t2 + ")");
  const bpmOf = (u) => 60e6 / u;
  ok(near(bpmOf(cond.tempos[0].uspq), bpm, 0.51) &&
     near(bpmOf(cond.tempos[1].uspq), bpm / 2, 0.51) &&
     near(bpmOf(cond.tempos[2].uspq), bpm, 0.51),
     "T1 · the values are bpm x PACE_RATE: " +
     cond.tempos.map((t) => bpmOf(t.uspq).toFixed(1)).join(",") + " at bpm " + bpm);
  // THE DAW-SHAPED READ AGREES WITH THE TIMELINE'S OWN BAR SECONDS — the
  // same numbers pace-meter A5 proved land at the PCM (a half bar = 2x the
  // frames). Inside the paced section the file says: 4 quarter beats per bar
  // at uspq(half) microseconds a beat.
  const TL = PLAN.timeline();
  const tlBar = TL.filter((b) => b.si === 1).map((b) => (b.barSteps / 4) * (60 / bpm));
  const fileBar = 4 * cond.tempos[1].uspq / 1e6;
  ok(near(fileBar, tlBar[0], 0.005),
     "T1 · a paced bar's seconds in the FILE equal the timeline's (" +
     fileBar.toFixed(3) + "s vs " + tlBar[0].toFixed(3) + "s — the PCM-proved number)");
  // notes are UN-stretched: every note tick inside the paced section fits in
  // its true 4-beat bars
  const end1 = t2;
  let outOfGrid = 0;
  for (const tr of parsed.tracks.slice(1))
    for (const n of tr.notes) if (n.tick >= t1 && n.tick < end1 && n.dur > 4 * TPQ * 1.5) outOfGrid++;
  ok(outOfGrid === 0, "T1 · no note in the paced section still wears the stretch (0 of them over 1.5 bars long)");
  const again = smfFromScore(score, { beatsPerBar: 4 });
  ok(Buffer.compare(Buffer.from(bytes), Buffer.from(again)) === 0,
     "T1 · the paced .mid is byte-deterministic (re-pinned for paced records, 2026-08-30 — " +
     "D4c's pin covers unpaced; paced records changed THIS round, on purpose)");
}

/* ===== T2 · the unpaced .mid is untouched ================================ */
{
  const doc = P.genreToDocument("rock", 1);
  seatDoc(doc, "probe.smf.plain.");
  const score = fold();
  ok(score.boxes.every((b) => b.k === 1), "T2 · every unpaced box measures k = 1 exactly");
  const bytes = smfFromScore(score, { beatsPerBar: 4 });
  const parsed = parseSmf(bytes);
  ok(parsed.tracks[0].tempos.length === 1 && parsed.tracks[0].tempos[0].tick === 0,
     "T2 · one tempo meta at tick 0 and nothing else");
  ok(parsed.tracks[0].timesig && parsed.tracks[0].timesig[0] === 4 && parsed.tracks[0].timesig[1] === 4,
     "T2 · the signature is the old 4/4 meta, byte for byte");
  const again = smfFromScore(score, { beatsPerBar: 4 });
  ok(Buffer.compare(Buffer.from(bytes), Buffer.from(again)) === 0,
     "T2 · byte-deterministic (the D4c pin's own property, held here in node)");
}

/* ===== T3 · the metered .mid ============================================= */
{
  GENRES["test.smf.waltz"] = { ...GENRES.barcarolle, meter: "three", label: "probe waltz" };
  const doc = P.genreToDocument("test.smf.waltz", 1);
  seatDoc(doc, "probe.smf.waltz.");
  const score = fold();
  ok(score.meterAbc === "3/4", "T3 · the Score carries the record's own signature (" + score.meterAbc + ")");
  const bytes = smfFromScore(score, { beatsPerBar: 3 });
  const parsed = parseSmf(bytes);
  const sig = parsed.tracks[0].timesig;
  ok(sig && sig[0] === 3 && sig[1] === 4, "T3 · the file says 3/4 (" + (sig || []).join("/") + ")");
  // implied bar seconds off the FILE alone: nn/dd * 4 quarters * uspq —
  // against the number the pace-meter gate MEASURED at the PCM (B5:
  // "a 3/4 bar renders ~3 quarters of PCM at the record's own bpm" —
  // 2.395s measured, 2.368s expected at bpm 76)
  const uspq = parsed.tracks[0].tempos[0].uspq;
  const fileBar = (sig[0] * 4 / sig[1]) * uspq / 1e6;
  const tlBar = 3 * 60 / score.bpm;
  ok(near(fileBar, tlBar, 0.005),
     "T3 · the file implies " + fileBar.toFixed(3) + "s bars = the record's own " +
     tlBar.toFixed(3) + "s (the PCM measured 2.395s on this probe, within its 5%)");
  ok(near(fileBar, 2.395, 2.395 * 0.05),
     "T3 · ...and it is the pace-meter gate's own measured bar, within the same 5%");
  // 6/8 says six-eight, not the 3/4 the arithmetic reduces to
  GENRES["test.smf.six"] = { ...GENRES.barcarolle, meter: "six", label: "probe six" };
  const doc6 = P.genreToDocument("test.smf.six", 1);
  seatDoc(doc6, "probe.smf.six.");
  const s6 = fold();
  const p6 = parseSmf(smfFromScore(s6, { beatsPerBar: 3 }));
  ok(s6.meterAbc === "6/8" && p6.tracks[0].timesig[0] === 6 && p6.tracks[0].timesig[1] === 8,
     "T3 · a six-eight record says 6/8 outright (twelve steps reduce to 3/4 and only ever " +
     "to 3/4 — the declared signature is the only honest spelling)");
  delete GENRES["test.smf.six"];
}

/* ===== T4 · the paced + metered .als ===================================== */
{
  const donorXml = gunzipSync(readFileSync(R("tools/ableton/donor/Generic.als"))).toString("utf8");

  // the paced record through the real splicer
  const doc = P.genreToDocument("rock", 1);
  doc.form.sections = doc.form.sections.slice(0, 4);   // the donor holds 8 scenes
  NuDoc.normalize(doc);
  doc.form.sections[1].pace = "half";
  seatDoc(doc, "probe.als.pace.");
  const score = fold();
  const res = alsFromScore(donorXml, score, { all: true });
  const xml = res.xml;
  // the map, in the donor's own envelope shape
  const envM = /<PointeeId Value="8" \/>[\s\S]*?<Events>([\s\S]*?)<\/Events>/.exec(xml);
  const evs = envM ? [...envM[1].matchAll(/<FloatEvent Id="\d+" Time="([^"]+)" Value="([^"]+)" \/>/g)]
    .map((m) => ({ time: +m[1], bpm: +m[2] })) : [];
  const views = paceView(score.boxes);
  const t1 = views[1].beat0, t2 = views[2].beat0;
  ok(evs.length === 5 && evs[0].time < 0 &&
     evs[1].time === t1 && evs[2].time === t1 && evs[3].time === t2 && evs[4].time === t2 &&
     near(evs[2].bpm, score.bpm / 2, 1e-9) && near(evs[4].bpm, score.bpm, 1e-9),
     "T4 · the tempo envelope carries the map as double-point steps at beats " +
     t1 + " and " + t2 + " (" + evs.map((e) => e.time + ":" + e.bpm).join(" ") + ")");
  const on = (xml.match(/<IsTempoEnabled Value="true" \/>/g) || []).length;
  ok(on === 1, "T4 · exactly the paced box's scene carries a launch tempo (" + on + ")");
  ok(new RegExp('<Tempo Value="' + score.bpm / 2 + '" \\/>').test(xml),
     "T4 · ...and it is bpm/2 = " + score.bpm / 2);
  // gate 2's own conformance check, on the paced output: every element shape
  // (tag + sorted attribute names) already exists in the donor
  const TOKEN = /<(\/?)([A-Za-z0-9._]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g;
  const attrsOf = (s) => (s.match(/([A-Za-z0-9._]+)\s*=\s*"/g) || []).map((a) => a.replace(/\s*=\s*"$/, ""));
  const shapes = (x) => { const out = new Set(); TOKEN.lastIndex = 0; let m;
    while ((m = TOKEN.exec(x))) if (m[1] !== "/") out.add(m[2] + "[" + attrsOf(m[3]).sort().join(",") + "]");
    return out; };
  const donorShapes = shapes(donorXml);
  const novel = [...shapes(xml)].filter((s) => !donorShapes.has(s));
  ok(novel.length === 0, "T4 · every element shape in the paced output is one Live itself wrote (" +
     (novel.length ? novel.join(" ") : "0 novel") + ")");

  // the metered record: clips say 3/4 and the loop lengths are whole 3-beat bars
  GENRES["test.smf.waltz2"] = { ...GENRES.barcarolle, meter: "three", label: "probe waltz" };
  const wdoc = P.genreToDocument("test.smf.waltz2", 1);
  wdoc.form.sections = wdoc.form.sections.slice(0, 4);
  NuDoc.normalize(wdoc);
  seatDoc(wdoc, "probe.als.waltz.");
  const wscore = fold();
  const wres = alsFromScore(donorXml, wscore, { all: true });
  const sigs = [...wres.xml.matchAll(/<RemoteableTimeSignature Id="\d+">\s*<Numerator Value="(\d+)" \/>\s*<Denominator Value="(\d+)" \/>/g)]
    .map((m) => m[1] + "/" + m[2]);
  const mineSigs = sigs.filter((s) => s === "3/4").length;
  ok(mineSigs >= wres.clips && sigs.filter((s) => s !== "3/4" && s !== "4/4").length === 0,
     "T4 · every authored clip says 3/4 on its own RemoteableTimeSignature (" +
     mineSigs + " of " + wres.clips + " clips; the donor's own pool clip keeps its 4/4)");
  const bad = wscore.boxes.filter((b) => Math.abs(b.beats / 3 - Math.round(b.beats / 3)) > 1e-6);
  ok(bad.length === 0, "T4 · every box is whole bars of three beats — the true beats were " +
     "already in the fold, now verified (" + wscore.boxes.map((b) => b.beats).join(",") + ")");
  delete GENRES["test.smf.waltz2"]; delete GENRES["test.smf.waltz"];

  // absent is today, .als: the unpaced, unmetered record splices byte-identically
  const pdoc = P.genreToDocument("rock", 1);
  pdoc.form.sections = pdoc.form.sections.slice(0, 4);
  NuDoc.normalize(pdoc);
  seatDoc(pdoc, "probe.als.plain.");
  const pscore = fold();
  const a = alsFromScore(donorXml, pscore, { all: true }).xml;
  const b = alsFromScore(donorXml, pscore, { all: true }).xml;
  ok(a === b, "T4 · the unpaced .als XML is deterministic" +
     " (the v199-vs-now byte pin ran at land time: beatgroup --genre --all, XML byte-identical)");
  ok(!/<IsTempoEnabled Value="true" \/>/.test(a) &&
     (a.match(/<FloatEvent /g) || []).length === (donorXml.match(/<FloatEvent /g) || []).length,
     "T4 · ...and its tempo surfaces are the donor's own, untouched");
}

console.log("\n" + (fails ? fails + " failed of " + checks : "all " + checks + " checks pass"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
