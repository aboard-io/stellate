// musicality.test.js — pure-node gates for the musicality law library
// (engine/musicality.js, docs/MUSICALITY.md phase 2: the symbolic laws).
//   node test/musicality.test.js
//
// Law unit tests run on SYNTHETIC states + hand-built event bundles (the law
// functions take (state, ev) exactly so they can be fed truth tables), plus
// integration on real kernel anchors and a full-catalog smoke: auditAll over
// every anchor completes, one row per genre, deterministic, no throws.
"use strict";
const M = require("../engine/musicality.js");
const E = require("../engine/csd-engine.js");
const K = require("../engine/genre-kernel.js");

let fails = 0;
function gate(name, fn) {
  try { fn(); console.log("PASS  " + name); }
  catch (e) { fails++; console.log("FAIL  " + name + " — " + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- synthetic scaffolding ----------
// royal_road is a real 4-chord PROGRESSIONS entry -> 8-beat chord bars,
// 32-beat sections, the engine's default grid.
function synthState(sections, extra) {
  return Object.assign({
    bpm: 120, seed: 1, keyOffset: 0, progression: "royal_road",
    instruments: E.defaultInstruments(), foundSources: [], sections,
  }, extra || {});
}
const EV = (o) => Object.assign({ pitched: [], drums: [], found: [], sfx: [], bpm: 120, totalBeats: 128 }, o || {});
const kick = (beat, amp) => ({ drum: "kick", beat, dur: 0.3, amp: amp == null ? 0.3 : amp });
const hat = (beat) => ({ drum: "hat", beat, dur: 0.08, amp: 0.1 });
const mel = (beat, pch, amp) => ({ voice: "melody", beat, dur: 0.5, pch: pch || "8.00", amp: amp == null ? 0.13 : amp });
const pad = (beat, pch, amp) => ({ voice: "pad", beat, dur: 8, pch: pch || "7.00", amp: amp == null ? 0.09 : amp });

const FULLSEC = { cycles: 1, drums: "four", bass: "root", melody: "arp", pads: true };

// ---------- BLOOM ----------
gate("BLOOM: a declared lead that never sounds is a named HARD fail", () => {
  const st = synthState([{ cycles: 2, drums: "four", bass: "root", melody: "arp", pads: false }]);
  const ev = EV({ drums: [kick(0)], pitched: [{ voice: "bass", beat: 0, dur: 1, pch: "6.00", amp: 0.2 }] });
  const r = M.laws.bloom(st, ev, "pop");
  assert(r.hard === true, "hard flag not set");
  assert(r.failures.some((f) => f.hard && /melody.*NEVER sounds/.test(f.what)), "never-sounds failure not named: " + JSON.stringify(r.failures));
  assert(r.score < 1, "score must drop");
});

gate("BLOOM: late arrival named with beat + bound + form; on-time passes", () => {
  const st = synthState([FULLSEC, FULLSEC, FULLSEC, FULLSEC, FULLSEC, FULLSEC, FULLSEC]);   // 7 x 32 beats
  const late = EV({ drums: [kick(0)], pitched: [{ voice: "bass", beat: 0, dur: 1, pch: "6.00", amp: 0.2 }, mel(200), pad(0)] });
  const r = M.laws.bloom(st, late, "pop");
  assert(r.failures.some((f) => /melody first sounds at beat 200 \(bound 192, form pop\)/.test(f.what)), "late melody not named: " + JSON.stringify(r.failures));
  assert(!r.hard, "late is not hard");
  const onTime = EV({ drums: [kick(0)], pitched: [{ voice: "bass", beat: 2.5, dur: 1, pch: "6.00", amp: 0.2 }, mel(8), pad(0)] });
  const r2 = M.laws.bloom(st, onTime, "pop");
  assert(r2.score === 1 && r2.failures.length === 0, "on-time parts must pass (got " + JSON.stringify(r2.failures) + ")");
});

gate("BLOOM: in-bar pattern offset is groove, not lateness (bar-floor arrival)", () => {
  const st = synthState([FULLSEC, FULLSEC]);
  // bass bound 32; first onset at 34.5 = beat 2.5 of bar 5 -> arrival bar 32 -> pass
  const ev = EV({ drums: [kick(0)], pitched: [{ voice: "bass", beat: 34.5, dur: 1, pch: "6.00", amp: 0.2 }, mel(0), pad(0)] });
  const r = M.laws.bloom(st, ev, "pop");
  assert(!r.failures.some((f) => f.part === "bass"), "bass at 34.5 must arrive at bar 32: " + JSON.stringify(r.failures));
});

gate("BLOOM: one full harmonic cycle is never late (12-bar piano-chorus intro)", () => {
  // blues_12 progression -> long cycle; drums enter after one full cycle.
  const st = synthState([{ cycles: 1, drums: "off", bass: "off", melody: "arp", pads: true },
                         { cycles: 1, drums: "four", bass: "root", melody: "arp", pads: true }],
                        { progression: "blues_12" });
  const P = M.partsOf(st, EV());
  const cyc = P.spans.cycleBeats;
  assert(cyc > 64, "blues_12 cycle should exceed the pop drums bound, got " + cyc);
  const ev = EV({ drums: [kick(cyc)], pitched: [mel(0), pad(0), { voice: "bass", beat: cyc, dur: 1, pch: "6.00", amp: 0.2 }] });
  const r = M.laws.bloom(st, ev, "pop");
  assert(!r.failures.some((f) => f.part === "drums" || f.part === "bass"),
    "kit after ONE full cycle must be idiomatic, not late: " + JSON.stringify(r.failures));
});

gate("BLOOM: a part declared only in exposed/release nodes is a contrast device (exempt)", () => {
  // pads exist ONLY in the bridge (exposed) — the designed late pad wall.
  const st = synthState([
    { name: "verse", cycles: 4, drums: "four", bass: "root", melody: "arp", pads: false },
    { name: "bridge", cycles: 1, drums: "off", bass: "root", melody: "sparse", pads: true }]);
  const ev = EV({ drums: [kick(0)], pitched: [mel(0), pad(128), { voice: "bass", beat: 0, dur: 1, pch: "6.00", amp: 0.2 }] });
  const r = M.laws.bloom(st, ev, "pop");
  assert(!r.failures.some((f) => f.part === "pads"), "bridge-only pads must be exempt: " + JSON.stringify(r.failures));
});

gate("BLOOM: a part first declared at the 3-minute evolution boundary is a gift, not lateness", () => {
  const st = synthState([
    { name: "drop", cycles: 6, drums: "four", bass: "root", melody: "off", pads: true },
    { name: "outro", cycles: 2, drums: "four", bass: "root", melody: "wander", pads: true }]);
  st.genreMeta = { genres: ["synthcase"], evolutions: [{ at: 1, tSec: 170, kind: "reroll", detail: "x/wander" }] };
  const ev = EV({ drums: [kick(0)], pitched: [mel(200), pad(0), { voice: "bass", beat: 0, dur: 1, pch: "6.00", amp: 0.2 }] });
  const r = M.laws.bloom(st, ev, "pop");
  assert(!r.failures.some((f) => f.part === "melody"), "evolution-introduced melody must be exempt: " + JSON.stringify(r.failures));
  // without the evolution record the same layout IS late
  delete st.genreMeta;
  const r2 = M.laws.bloom(st, ev, "pop");
  assert(r2.failures.some((f) => f.part === "melody"), "un-evolved late melody must still be named");
});

gate("BLOOM: an on-design arrival is the form's identity, not drag (design floor)", () => {
  // K.FORM_ENTRY is derived from the form graphs (wave bass enters at the
  // swell, 3/8 of the base cycles). A 13-cycle wave (416 beats) whose bass
  // arrives at beat 160 = 38.5% is ON design (the beat table says 144); one
  // arriving at 60% is drag the form never asked for — still named.
  assert(K.FORM_ENTRY && Math.abs(K.FORM_ENTRY.wave.bass - 0.375) < 1e-9 && Math.abs(K.FORM_ENTRY.pop.melody - 0.375) < 1e-9
    && Math.abs(K.FORM_ENTRY.dj.melody - 0.4) < 1e-9, "FORM_ENTRY fractions drifted: " + JSON.stringify(K.FORM_ENTRY));
  const sec = (cyc, bass) => ({ cycles: cyc, drums: "off", bass: bass ? "rolling" : "off", melody: "off", pads: true });
  const st = synthState([sec(2, false), sec(3, false), sec(3, true), sec(3, false), sec(2, false)]);   // 13 x 32 = 416 beats
  const mkEv = (beat) => EV({ pitched: [pad(0), { voice: "bass", beat, dur: 1, pch: "6.00", amp: 0.2 }], totalBeats: 416 });
  const r = M.laws.bloom(st, mkEv(160.5), "wave");
  assert(!r.failures.some((f) => f.part === "bass"), "on-design swell bass (38.5%) must pass: " + JSON.stringify(r.failures));
  // design bound = .375*416 + 32 = 188; beat 256 (61%) is past design + slack
  const st2 = synthState([sec(2, false), sec(3, false), sec(3, false), sec(3, true), sec(2, false)]);
  const r2 = M.laws.bloom(st2, mkEv(256), "wave");
  assert(r2.failures.some((f) => f.part === "bass"), "off-design bass (61%) must still be named");
});

gate("BLOOM: all-sections-off drums = drumless by design = exempt (not declared)", () => {
  const st = synthState([{ cycles: 2, drums: "off", bass: "off", melody: "arp", pads: true }]);
  const ev = EV({ pitched: [mel(0), pad(0)] });
  const r = M.laws.bloom(st, ev, "pop");
  assert(r.score === 1 && !r.hard, "drumless-by-design state must pass clean: " + JSON.stringify(r.failures));
});

// ---------- REGISTER ----------
gate("REGISTER: sampled voice scored against the natural window, synth exempt", () => {
  const st = synthState([FULLSEC]);
  st.instruments = JSON.parse(JSON.stringify(st.instruments));
  st.instruments.melody = { model: "sampler", sampler: { id: "testflute", zones: [{ root: 60 }, { root: 72 }] } };  // window [48..78]
  const ev = EV({ pitched: [mel(0, "8.00"), mel(1, "10.06")] });   // midi 60 in, midi 90 out (12 st above)
  const r = M.laws.register(st, ev);
  assert(Math.abs(r.score - 0.5) < 1e-9, "score should be 0.5, got " + r.score);
  assert(r.failures.some((f) => /testflute.*50% of 2 notes outside natural range \[48\.\.78\]/.test(f.what)), "violation not named: " + JSON.stringify(r.failures));
  st.instruments.melody = { model: "saw" };                        // synth voice: exempt
  const r2 = M.laws.register(st, ev);
  assert(r2.score === 1 && r2.failures.length === 0, "synth voices must be exempt");
});

gate("REGISTER HOME: a misregistered sampled lead is homed at the source (balance loop 2)", () => {
  // synthetic: progression leads live at pch octave 8-9 (midi 60-95); give the
  // melody a sampler whose window tops far below — buildEvents must shift the
  // whole line into the window and report the decision on the bundle.
  const st = synthState([FULLSEC, FULLSEC]);
  st.instruments = JSON.parse(JSON.stringify(st.instruments));
  st.instruments.melody = { model: "sampler", sampler: { id: "testhorn", zones: [{ root: 52 }, { root: 78 }] } };  // window [40..84]; the line asks 64-89 (78% in)
  const ev = E.buildEvents(st);
  const mids = ev.pitched.filter((p) => p.voice === "melody" && !p.solo).map((p) => E.pchToMidi(p.pch));
  assert(mids.length > 0, "no melody events");
  const inW = mids.filter((m) => m >= 40 && m <= 84).length / mids.length;
  assert(inW >= 0.95, "line not homed: " + Math.round(inW * 100) + "% in window");
  assert(ev.regHome && ev.regHome.melody < 0, "decision not reported on the bundle: " + JSON.stringify(ev.regHome));
  // the pin is honored verbatim (the kernel pins it so live per-bar rebuilds
  // apply a constant): a pinned build applies exactly the pinned shift.
  const st2 = synthState([FULLSEC, FULLSEC]);
  st2.instruments = st.instruments;
  st2.regHome = { melody: ev.regHome.melody };
  const ev2 = E.buildEvents(st2);
  assert(JSON.stringify(ev2.pitched) === JSON.stringify(ev.pitched), "pinned build must reproduce the measured build byte-for-byte");
});

gate("REGISTER HOME: kernel pins regHome only where a slot misfits; anchor overrides are respected", () => {
  // chalkvespers homes its chant with the leadOctave anchor (-2, loop 1): the
  // auto pass must find the line already fitting and pin NOTHING.
  const cv = K.track("chalkvespers", { seed: 1 });
  assert(cv.leadOctave === -2, "chalkvespers anchor changed?");
  assert(cv.regHome == null, "chalkvespers must not be double-shifted: " + JSON.stringify(cv.regHome));
  // kettlefunk s1 (french_horns lead, the register class): pinned and audited clean.
  const kf = K.track("kettlefunk", { seed: 1 });
  assert(kf.regHome && kf.regHome.melody < 0, "kettlefunk s1 must pin a melody home: " + JSON.stringify(kf.regHome));
  const a = M.audit(kf);
  assert(a.laws.register.failures.length === 0, "kettlefunk s1 register not clean: " + JSON.stringify(a.laws.register.failures));
});

// ---------- PROMISES ----------
gate("PROMISES: drumless passes on a chalkvespers-like state, fails on a kitted one", () => {
  const quiet = synthState([{ cycles: 2, drums: "off", bass: "off", melody: "arp", pads: true }]);
  const r = M.laws.promises({ drumless: true }, quiet, EV({ pitched: [mel(0)] }));
  assert(r.score === 1 && r.failures.length === 0, "drumless must pass on zero drum events");
  const kitted = synthState([FULLSEC]);
  const r2 = M.laws.promises({ drumless: true }, kitted, EV({ drums: [kick(0), kick(4)] }));
  assert(r2.score === 0 && r2.failures.some((f) => /drumless promised but 2 drum events/.test(f.what)), "kitted state must break drumless: " + JSON.stringify(r2.failures));
});

gate("PROMISES: kickOn detection on a hand drum list (>=60% of kitted bars)", () => {
  const st = synthState([FULLSEC, FULLSEC]);
  // 8 measures marked kitted by hats; kick ON beat 3 (pos 2) in 7 of 8
  const drums = [];
  for (let m = 0; m < 8; m++) { drums.push(hat(m * 4)); if (m !== 5) drums.push(kick(m * 4 + 2)); }
  const r = M.laws.promises({ kickOn: [3] }, st, EV({ drums }));
  assert(r.score === 1, "7/8 measures with kick-on-3 must keep the promise: " + JSON.stringify(r.failures));
  // one-drop missing: kicks on beat 1 only
  const drums2 = []; for (let m = 0; m < 8; m++) { drums2.push(hat(m * 4)); drums2.push(kick(m * 4)); }
  const r2 = M.laws.promises({ kickOn: [3] }, st, EV({ drums: drums2 }));
  assert(r2.score === 0 && r2.failures.some((f) => /kickOn\[3\] broken.*beat 3 in 0%/.test(f.what)), "kick-on-1 must break kickOn[3]: " + JSON.stringify(r2.failures));
});

gate("PROMISES: skankOffbeat measures off-eighth onsets (>=70%)", () => {
  const st = synthState([FULLSEC]);
  const off = EV({ pitched: [pad(1.5), pad(3.5), pad(5.5), pad(7.5)] });
  assert(M.laws.promises({ skankOffbeat: "pad" }, st, off).score === 1, "all-offbeat pad skank must pass");
  const on = EV({ pitched: [pad(0), pad(2), pad(4), pad(6)] });
  const r = M.laws.promises({ skankOffbeat: "pad" }, st, on);
  assert(r.score === 0 && r.failures.some((f) => /skankOffbeat:pad broken: 0%/.test(f.what)), "downbeat pads must break the skank: " + JSON.stringify(r.failures));
});

gate("PROMISES: meter + partPresent + bassStyle vocabulary", () => {
  const waltz = synthState([FULLSEC], { meter: { beats: 3, unit: 4 } });
  const ev = EV({ drums: [kick(0)], pitched: [mel(0), pad(0), { voice: "bass", beat: 0, dur: 1, pch: "6.00", amp: 0.2 }] });
  assert(M.laws.promises({ meter: "3/4" }, waltz, ev).score === 1, "3/4 meter promise must hold");
  const r = M.laws.promises({ meter: "3/4" }, synthState([FULLSEC]), ev);
  assert(r.score === 0 && r.failures.some((f) => /meter 3\/4 promised but state resolves 4\/4/.test(f.what)), "4/4 state must break the 3/4 promise");
  const r2 = M.laws.promises({ partPresent: ["counter"] }, synthState([FULLSEC]), ev);
  assert(r2.score === 0 && r2.failures.some((f) => /counter is not sounding/.test(f.what)), "missing counter must be named: " + JSON.stringify(r2.failures));
  assert(M.laws.promises({ bassStyle: ["root", "walk"] }, synthState([FULLSEC]), ev).score === 1, "bassStyle root must match the section pattern");
  const r3 = M.laws.promises({ bassStyle: "melodic" }, synthState([FULLSEC]), ev);
  assert(r3.score === 0 && r3.failures.some((f) => /bassStyle/.test(f.what)), "wrong bassStyle must fail");
});

gate("PROMISES: unknown promise key = WARN, never a crash, never scored", () => {
  const st = synthState([FULLSEC]);
  let r;
  try { r = M.laws.promises({ flibberwock: 7, drumless: false }, st, EV({ drums: [kick(0)] })); }
  catch (e) { throw new Error("unknown key threw: " + e.message); }
  assert(r.warnings.length === 1 && /unknown promise key "flibberwock"/.test(r.warnings[0].what), "unknown key must WARN: " + JSON.stringify(r.warnings));
  assert(r.score === 1, "unknown key must not enter the denominator (drumless:false kept on a kitted state)");
});

// ---------- MOTION ----------
gate("MOTION: >2 byte-identical consecutive sections WARN; varied sections pass", () => {
  const st = synthState([FULLSEC, FULLSEC, FULLSEC, FULLSEC]);   // 4 x 32 beats
  const loop = [], varied = [];
  for (let s = 0; s < 4; s++) {
    const b = s * 32;
    loop.push(kick(b), kick(b + 4), hat(b + 2));
    varied.push(kick(b), kick(b + 4), hat(b + 2 + s * 0.5));     // hat drifts per section
  }
  const r = M.laws.motion(st, EV({ drums: loop }));
  assert(r.failures.length === 1 && /sections 1-4 identical x4/.test(r.failures[0].what), "verbatim loop not flagged: " + JSON.stringify(r.failures));
  assert(r.score < 1, "boredom must cost score");
  const r2 = M.laws.motion(st, EV({ drums: varied }));
  assert(r2.score === 1 && r2.failures.length === 0, "varied sections must pass: " + JSON.stringify(r2.failures));
});

// ---------- integration on real anchors ----------
gate("integration: chalkvespers keeps drumless, salondawdle keeps 3/4, reggae keeps the stab skank", () => {
  for (const g of ["chalkvespers", "salondawdle", "reggae"]) {
    const a = M.audit(g, { seeds: [1, 2] });
    assert(a.laws.promises.declared > 0, g + " must have a seed promise");
    assert(a.laws.promises.score === 1, g + " promise broken: " + JSON.stringify(a.laws.promises.failures));
  }
});

gate("determinism: same seed, same scorecard (byte-equal)", () => {
  const a = JSON.stringify(M.audit("techno", { seeds: [1, 2] }));
  const b = JSON.stringify(M.audit("techno", { seeds: [1, 2] }));
  assert(a === b, "audit not deterministic across identical calls");
});

gate("audit accepts a raw state object", () => {
  const st = K.track("vaporwave", { seed: 4 });
  const a = M.audit(st);
  assert(a.genre === "vaporwave" && a.seeds.length === 1 && a.seeds[0] === 4, "state-object audit misread genre/seed: " + a.genre + " " + JSON.stringify(a.seeds));
  for (const l of ["bloom", "register", "promises", "motion"]) assert(typeof a.laws[l].score === "number", l + " score missing");
});

// ---------- full-catalog smoke ----------
gate("smoke: auditAll --rank completes over the whole catalog, one row per anchor", () => {
  const nGenres = Object.keys(K.GENRES).length;
  const rows = M.auditAll({ seeds: [1], rank: true });
  assert(rows.length === nGenres, "rows " + rows.length + " !== anchors " + nGenres);
  for (let i = 1; i < rows.length; i++) assert(rows[i - 1].overall <= rows[i].overall, "rank not sorted worst-first at row " + i);
  for (const r of rows) {
    assert(["OK", "WARN", "FAIL"].includes(r.verdict), r.genre + " bad verdict " + r.verdict);
    for (const l of ["bloom", "register", "promises", "motion"])
      assert(r.laws[l].score >= 0 && r.laws[l].score <= 1, r.genre + "." + l + " score out of [0,1]");
  }
  assert(typeof M.rankTable(rows) === "string" && M.rankTable(rows).split("\n").length === nGenres + 1, "rankTable malformed");
});

console.log(fails ? "\n" + fails + " FAILING" : "\nall green");
process.exit(fails ? 1 : 0);
