#!/usr/bin/env node
// test/od-route.test.js — THE OVERDRIVE GUITAR'S OWN ROUTE, MEASURED.
//
// Paul, 2026-08-30: "Wherever you use overdrive guitar bring it down 12. Throw
// it to some mild reverb and delay. I did this for bristolsound and it did
// wonders." The table is audio/to-engine.js ID_ROUTE and its whole argument is
// written there; this file holds the four things a later edit could break
// without anything else going red.
//
//   O1  the table names ONE instrument, not a module's worth. `stk_guitar`
//       carries six guitar ids and PAGE_TRIM keys on the module, which is why
//       this table exists at all — so the other five must still answer null.
//   O2  the route product is -12.00 dB EXACTLY against where the instrument sat
//       this morning, and it is a product WITH the module's measured page
//       make-up rather than a replacement for it.
//   O3  the desk ADDS the mild send into the composed base (a send is a
//       proportion, not a fader) and SKIPS it on any bus the chair's own part
//       already names — the four goth rows keep their 0.30 echo.
//   O4  TEST THE ARTIFACT: rendered through the shipped mix loop, the trim
//       moves dry, rev and del TOGETHER by the same dB, and the wet/dry RATIO
//       rises by exactly the mild number — which is what makes it a send and
//       not a level.
//
// The catalogue-wide readings (109 records, the before/after chair table, both
// buses proved to arrive, four byte-identical controls) are the probes, not
// this file: test/_odguitar.cjs, test/_odsound.cjs, test/_odpress.cjs and
// test/_odear.cjs, whose numbers are quoted in ID_ROUTE's own header.
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
const db = (x) => 20 * Math.log10(x);

/* ---------- the stub window (tape-reach's own harness) -------------------- */
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
const DD = require(R("nukernel/desk-doc.js"));
const { TERMS } = require(R("nukernel/songs.js"));
const SP = require(R("engine/faust/voices/sampler.js"));
const RC = require(R("engine/faust/press/render-core.js"));
const SRE = require(R("engine/faust/live/stream-renderer.js"));

const SR = 44100, BS = 64, N = 1 << 15;
const clone = (o) => JSON.parse(JSON.stringify(o));
const mkNoise = (seed) => { let x = seed >>> 0; const o = new Float32Array(N);
  for (let i = 0; i < N; i++) { x = (x * 1103515245 + 12345) >>> 0; o[i] = x / 2147483648 - 1; }
  return o; };
const NOISE = mkNoise(12345);
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i];
                     return Math.sqrt(s / a.length); };

(async () => {
console.log("test/od-route.test.js — the overdrive guitar's own route\n");
const DESK = await import(R("nukernel/audio/desk.js"));
const { deskUnits } = DESK;
const TE = await import(R("nukernel/audio/to-engine.js"));

/* ---- O1 · the table names an INSTRUMENT, and one of them ----------------- */
console.log("O1 — one instrument, not a module's worth");
const ROW = TE.idRoute("overdrive_guitar");
ok(ROW && ROW.trim > 0, "overdrive_guitar has a route row", JSON.stringify(ROW));
// the six ids that share stk_guitar (audio/to-engine.js PATCH_MODEL) — the
// whole reason this table is keyed by instrument and PAGE_TRIM is not enough
const SIX = ["clean_guitar", "jazz_guitar", "palm_muted_guitar",
             "crunch_guitar", "distortion_guitar", "overdrive_guitar"];
/* SOME OF THE SIX, NEVER ALL SIX — widened 2026-08-31 and the claim got
   STRONGER, not weaker. This said "exactly ONE is named", which was true while
   overdrive_guitar was the only routed id; the point it was making is O1's own
   title, that the table names an INSTRUMENT and not a module's worth. Paul
   then asked for the palm chug: "You love that palm chug guitar. You use it
   everywhere. Wherever you use it, bring it down 20% and add some reverb and a
   little delay" — and two of six siblings carrying DIFFERENT routes through
   ONE shared module is a better demonstration of per-instrument keying than
   one was. What would falsify the claim is all six being named with the same
   row, because that is a module trim wearing six hats — and that is what this
   now fails on. */
/* ALL SIX ARE NAMED NOW — rewritten 2026-09-01, Paul: "Whenever you bring in
   guitar it's like 2x too loud and needs more tail, it's a loud plink every
   time." The previous check's own falsification is the one that survives: a
   module trim wearing six hats would be SIX IDENTICAL ROWS, and these are
   not — the trims run from none at all (jazz_guitar carries only a tail
   floor) through -1.9 (palm) and -6 (clean/crunch, which measured the same
   and honestly share a row) to -12 (overdrive/distortion). The count check
   ("some, never all") had to go because the census went and measured all
   six: every id that pressed over the balanced band got a row, and jazz —
   fitted quiet at the neck box — got the tail without the cut. */
const named = SIX.filter((id) => TE.idRoute(id));
const distinct = new Set(named.map((id) => JSON.stringify(TE.idRoute(id))));
const JZ = TE.idRoute("jazz_guitar");
ok(named.length === SIX.length && distinct.size > 1 && JZ && JZ.trim == null,
   "…and all six ids that route through stk_guitar are named with " +
   distinct.size + " distinct rows — including one with NO trim at all — " +
   "a per-INSTRUMENT table, not a module trim");
ok(!TE.idRoute("solo_vox") && !TE.idRoute("acoustic_bass") && !TE.idRoute("") &&
   !TE.idRoute("guitar_harmonics") && !TE.idRoute("di_guitar"),
   "every other instrument answers null — absent is today " +
   "(guitar_harmonics and di_guitar seat zero records and stay un-rowed)");

/* ---- O2 · the product, in dB -------------------------------------------- */
console.log("\nO2 — the route is a PRODUCT: the module's page make-up x the instrument's offset");
const MOD = TE.pageTrim("stk_guitar");
const PROD = MOD * ROW.trim;
ok(near(db(ROW.trim), -12, 0.01),
   "the instrument's own offset is -12.00 dB, Paul's number: " + db(ROW.trim).toFixed(2) + " dB");
ok(MOD > 1 && near(db(PROD / MOD), -12, 0.01),
   "…and the module's measured page make-up (" + MOD + ") is kept underneath it, " +
   "so the route is " + PROD.toFixed(4) + " and the instrument sits exactly 12 dB " +
   "under where it sat, not 12 dB under raw");

/* ---- O3 · the desk adds the send, and yields to an explicit one ---------- */
console.log("\nO3 — the mild send is ADDED into the composed base, and explicit wins");
function record(desk0) {
  const d = clone(TERMS);
  if (desk0) d.voices[0].desk = desk0;
  return NuDoc.normalize(d);
}
const GK = "od.route.";
function boxOf(doc) {
  doc.form.sections.forEach((s, i) => { GENRES[GK + i] = NuDoc.toGenre(doc, i, GENRES, []); });
  const boxes = NuDoc.boxesOf(doc, GK);
  const parts = DD.deskPartsOf(doc, GENRES);
  for (const b of boxes) b.parts = parts;
  return boxes[0];
}
const ADDR = { v0: "line", v1: "line2" };
// v0 is the seat under test; v1 is the control beside it, same module, no row
// ...as to-engine.js trimRoute hands them over: `dry` has ALREADY been
// multiplied by the route gain there (the desk never touches dry for the
// trim, only `u.pageTrim` for the sends), so a fixture that left dry at 1
// would be measuring a unit no seat ever produces.
const mkUnits = (on) => ({
  v0: on ? { lvl: 1, module: "stk_guitar", dry: PROD, pageTrim: PROD,
             idRev: ROW.rev, idDel: ROW.del }
         : { lvl: 1, module: "stk_guitar", dry: MOD, pageTrim: MOD },
  v1: { lvl: 1, module: "stk_guitar", dry: MOD, pageTrim: MOD },
});
{
  const box = boxOf(record());
  const off = deskUnits(mkUnits(false), ADDR, box, null, null);
  const on = deskUnits(mkUnits(true), ADDR, box, null, null);
  // the ratio the engine actually sees: a send is a PROPORTION of the unit's
  // own output, so send/dry is the number that must move by exactly 0.12
  const ratio = (u, k) => (u[k] || 0) / (u.dry != null ? u.dry : 1);
  ok(near(ratio(on.v0, "rev") - ratio(off.v0, "rev"), ROW.rev, 1e-6),
     "the rev the engine sees rises by exactly " + ROW.rev + " of the unit's own " +
     "output — a proportion, unchanged by how far down the trim puts it",
     (ratio(on.v0, "rev") - ratio(off.v0, "rev")).toFixed(6));
  ok(near(ratio(on.v0, "del") - ratio(off.v0, "del"), ROW.del, 1e-6),
     "…and so does the del", (ratio(on.v0, "del") - ratio(off.v0, "del")).toFixed(6));
  ok(off.v1.rev === on.v1.rev && off.v1.del === on.v1.del,
     "the chair beside it, same module and no row, does not move at all");
}
{
  // THE FOUR GOTH ROWS: precompose spends the record's echo on the chair
  // carrying the tune (ECHOSEND, 0.30). A chair that has been given a number
  // has already answered the question, and must keep 0.30 rather than 0.42.
  const box = boxOf(record({ echo: "some" }));
  const on = deskUnits(mkUnits(true), ADDR, box, null, null);
  const off = deskUnits(mkUnits(false), ADDR, box, null, null);
  const rOn = (on.v0.del || 0) / on.v0.dry, rOff = (off.v0.del || 0) / off.v0.dry;
  ok(near(rOn, rOff, 1e-6) && rOff > 0,
     "a chair whose own part names an echo keeps the record's number (" +
     rOff.toFixed(3) + "), not that number plus the mild one");
}

/* ---- O4 · TEST THE ARTIFACT --------------------------------------------- */
console.log("\nO4 — rendered through the shipped mix loop");
const eng = SRE.makeStreamEngine({ E: null, SE: null, FP: null, SP,
  mergeIvals: RC.mergeIvals, mkProc: null, rootOf: null, SR, BS });
function renderModelled(u) {
  const buses = { dry: new Float32Array(N), rev: new Float32Array(N),
                  del: new Float32Array(N), pp: new Float32Array(N),
                  wL: new Float32Array(N), wR: new Float32Array(N) };
  let pos = 0;
  const proc = { setParamValue() {},
    render(ins, len) { const a = NOISE.subarray(pos, pos + len); pos += len; return [a]; } };
  const v = { proc, R: "/x/", pending: [], ivals: [[0, N]], busyUntil: -1,
              lastOff: null, curOut: 1, curPP: 0, renderedEnd: 0 };
  eng.__test.renderUnitWindow({ u, procs: [v], chain: null, chainPrev: null },
                              buses, 0, N, 0.5, null);
  return { dry: rms(buses.dry), rev: rms(buses.rev), del: rms(buses.del) };
}
{
  const box = boxOf(record());
  const off = renderModelled(deskUnits(mkUnits(false), ADDR, box, null, null).v0);
  const on = renderModelled(deskUnits(mkUnits(true), ADDR, box, null, null).v0);
  ok(near(db(on.dry / off.dry), -12, 0.05),
     "the rendered DRY moves -12.00 dB: " + db(on.dry / off.dry).toFixed(2) + " dB");
  ok(off.rev > 0 && on.rev > 0 && off.del === 0 && on.del > 0,
     "the rendered DEL goes from silence to signal — the mild delay is not a " +
     "number in a table, it is energy on bus 2",
     JSON.stringify({ delOff: off.del, delOn: on.del }));
  // the ratio is the send; it must have RISEN even though everything got quieter
  ok(near((on.rev / on.dry) - (off.rev / off.dry), ROW.rev, 1e-3),
     "…and the rendered wet/dry RATIO rose by exactly " + ROW.rev +
     " while the whole voice went down 12 dB — which is the difference between " +
     "a send and a fader",
     ((on.rev / on.dry) - (off.rev / off.dry)).toFixed(4));
}

/* ---- O5 · the 2026-09-01 guitar rows: the trims, and the tail floor ------ */
console.log("\nO5 — the guitar census rows (2026-09-01): trims by measurement, tail as a floor");
{
  // the trim column, in dB — clean/crunch take Paul's "2x" (-6.0), distortion
  // takes the overdrive's own -12 for the overdrive's own measured reason
  const CG = TE.idRoute("clean_guitar"), DG = TE.idRoute("distortion_guitar"),
        KG = TE.idRoute("crunch_guitar");
  ok(near(db(CG.trim), -6, 0.05) && near(db(KG.trim), -6, 0.05) && CG.rev > 0 && KG.rev > 0,
     "clean and crunch sit -6.00 dB (\"2x too loud\") with a mild reverb: " +
     db(CG.trim).toFixed(2) + " / " + db(KG.trim).toFixed(2) + " dB");
  ok(near(db(DG.trim), -12, 0.05) && DG.rev > 0 && DG.del > 0,
     "distortion sits -12.00 dB, the overdrive precedent for a chair pressing " +
     "OVER its band: " + db(DG.trim).toFixed(2) + " dB");
  const NY = TE.idRoute("nylon_string_guitar"), ST = TE.idRoute("steel_string_guitar");
  ok(NY && NY.trim == null && ST && ST.trim == null && NY.rel > 0 && ST.rel > 0,
     "the sampled pair (nylon/steel) pressed IN range and carries NO trim — " +
     "tail and a touch of reverb only");
  ok(!TE.idRoute("palm_muted_guitar").rel,
     "palm_muted_guitar keeps NO tail floor — its 0.06 s release IS the mute");
}
{
  // THE FLOOR ARRIVES, ON BOTH LANES, AND ONLY AS A FLOOR. recipeFor is the
  // seam (relFloored, between recipeBase and worded) and m.release is the one
  // field both lanes read — model via PATCH_MODEL's M.rel, sampled via
  // toneRecipe. A VOX rel word is the user's own edit and lands AFTER.
  const K = require(R("engine/genre-kernel.js"));
  const lib = TE.samplerLibFor(K, 1).samplerLib || {};
  const rFor = (instr, tone, vox) =>
    TE.recipeFor("line", { instr, tone, ...(vox ? { vox } : {}) }, lib, []);
  const mc = rFor("clean_guitar", { rel: 0.3 });
  ok(mc.m.model !== "sampler" && near(mc.m.release, 0.9, 1e-9),
     "model lane: clean_guitar on a tone.rel 0.3 genre rings 0.9 s — the floor, " +
     "through PATCH_MODEL: " + mc.m.release);
  /* LANE CHANGE, 2026-09-01. Paul: "Merciliessly replace ALL guitars with
     the synthesized faust guitars everywhere" — steel_string_guitar (this
     check's sampled-lane specimen) is an EKS recipe now, so the identical
     assertion flipped from proof of the sampled floor to proof of the sweep:
     same id, same tone.rel 0.3, same 0.9 s floor, MODEL lane. The sampled-
     lane floor code in toneRecipe still ships and is dormant — every id with
     a rel column rides the model lane today — so the day a sampled row lands
     in ID_ROUTE, restore the old form of this check against that id. */
  const ms = rFor("steel_string_guitar", { rel: 0.3 });
  ok(ms.m.model !== "sampler" && near(ms.m.release, 0.9, 1e-9),
     "the swept steel guitar rides the MODEL lane and keeps its 0.9 s floor: " +
     "model=" + ms.m.model + " release=" + ms.m.release);
  const ml = rFor("clean_guitar", { rel: 1.5 });
  ok(near(ml.m.release, 1.5, 1e-9),
     "a genre already ringing 1.5 s is untouched — a FLOOR, not a set: " + ml.m.release);
  const mv = rFor("clean_guitar", { rel: 0.3 }, { rel: "tight" });
  ok(near(mv.m.release, 0.03, 1e-9),
     "…and a chair's own VOX word still wins over the floor (\"tight\" -> 0.03 s), " +
     "worded runs after: " + mv.m.release);
  const mo = rFor("overdrive_guitar", { rel: 0.3 });
  ok(near(mo.m.release, 0.3, 1e-9),
     "a row with no rel column moves nothing: overdrive keeps its genre's 0.3 s");
}

console.log("\n" + (fails ? "FAILED " + fails + " of " + checks
                          : "ok — " + checks + " checks, 0 failures"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
