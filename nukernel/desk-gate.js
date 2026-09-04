// nukernel/desk-gate.js — WHAT PROVES THE ENGINEER. `node nukernel/desk-gate.js`,
// non-zero exit on failure, seconds to run, no DOM and no audio.
//
// It lives beside its data rather than in test/ for the precedent vocabulary.js
// set: a data-tier self-check belongs with the tier it checks. What it needs
// from a browser is nothing — audio/desk.js "does not build a single audio
// node", which is the property that makes the board's numbers checkable without
// ears — so the UMD tier is stood up on a stub window exactly the way
// main:test/unit/nukernel.test.js:2688 does, and the real ES modules are
// imported on top of it. A wiring change in the shipped file fails HERE.
//
// WHAT THIS GATE DOES NOT DO: render audio, or check that reverb is AUDIBLE.
// Paul's ears are the backstop for that, at
// http://localhost:8777/nukernel/index.html — and the question to ask there is
// the one G6 cannot: does it sound like a stone room?
"use strict";
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
const path = require("path");
const R = (p) => path.join(__dirname, p);
/* THE ONE DRIVER FOR A MENU, 2026-09-02 (wave 4). ui/selects.js draws an
   `<input role=combobox>` now and this file read `<select>` in five places;
   test/lib-combo.js is the shared reader every browser gate uses. It is a
   GATE's helper and never the page's — nothing in nukernel/ reads it. */
const { installCombo } = require(path.join(__dirname, "..", "test", "lib-combo.js"));

let fails = 0, checks = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(cond, what, detail) {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++;
  console.log("  FAIL " + what + (detail == null ? "" : "\n         " + detail));
  return false;
}
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-9 : tol);
/* A BUS SLOT'S KNOBS ARE CONDITIONAL ON ITS SEAT (2026-09-03), and three
   registry walks in this file have to know it. Paul: *"I was expecting it to
   just be three effects I could set normally."* The genre bus row now declares
   twelve slot keys — `fx<n>` (the seat) plus `fxw<n>`/`fxa<n>`/`fxb<n>` (its
   wet and the module's own one or two settings) — and ui/engineer.js `slotEl`
   draws the three knobs ONLY when a seat is filled, exactly as a voice strip's
   insert slot has since 2026-08-27: a wet on an empty seat is a pot for an
   effect that is not there, and which two face knobs exist depends on WHICH
   module is seated (fields.js FXFACE: ringmod declares one, chorus two, sweep
   two of its own).
   SO THE THREE "is every registry row drawn?" WALKS SKIP THEM, and this is a
   pointer rather than a hole: G15b DRIVES all four keys of slot 1 on the
   rendered plate — seat it, move its wet, move its face knob, read the words
   back off the document, unseat it and watch the row vanish. The seats
   themselves are unconditional and are asserted present by G3. */
const SLOTKNOB = (key) => /^fx[wab]?[123]$/.test(String(key));
const BUSSEAT = (k) => /^bus\|[a-z]+\|fx[123]$/.test(String(k || ""));

(async () => {

/* ---------- the stub window (main:test/unit/nukernel.test.js:2688) --------- */
// ui/state.js is the one file that needs more than the data tier: it reads
// localStorage at evaluation and registers two `addEventListener` handlers at
// module scope, so a bare `globalThis.window = globalThis` throws before a
// single number is checked.
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", body: { append() {} },
  createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
window.NuKernel = require(R("kernel.js"));
window.NuGenres = require(R("genres.js"));
window.NuFields = require(R("fields.js"));
window.NuSong = require(R("song.js"));
window.NuInstruments = require(R("instruments.js"));
window.NuCompose = require(R("compose.js"));
window.PRESETS = require(R("presets.js")).PRESETS;
window.NuDocument = require(R("document.js"));
// ...AND THE SHIPPED RECORD, which this stub did not carry until 2026-08-24.
// ui/deps.js gained `export const { TERMS } = window.NuSongs` in the W3
// integration (the atlas needs the chant to get back to Rome 600), and a
// DESTRUCTURE of a missing global throws where `export const X = window.X`
// only yields undefined — so this gate died on `deps.js:122` before it checked
// a single number. A harness that stands the data tier up stands ALL of it up.
window.NuSongs = require(R("songs.js"));
window.__REGISTRY = require(R("../engine/registry-data.js"));

const F = window.NuFields, NG = window.NuGenres, K = window.NuKernel;
const { GENRES } = NG;
const { TERMS } = require(R("songs.js"));
const DD = require(R("desk-doc.js"));
const NuDoc = window.NuDocument;
const DESK = await import(R("audio/desk.js"));
const STATE = await import(R("ui/state.js"));
const { deskUnits, masterState, voiceRoster, partKeysOf, resolvedPart,
        derivedPartTone, deskChannelBase, mergeEq,
        deskBusFeed, BUS_REACH, MAIN_TO_BUS1, FIXED_EDGES } = DESK;

/* ---------- the document, compiled the way ui/eight.js push() does it ------ */
const GK = "desk.gate.";
const clone = (o) => JSON.parse(JSON.stringify(o));
// register per-section genres and hand back the boxes, which is the whole of
// what push() does that this gate depends on
function boxesFor(doc) {
  const secs = doc.form.sections;
  secs.forEach((s, i) => { GENRES[GK + i] = NuDoc.toGenre(doc, i, GENRES, []); });
  return NuDoc.boxesOf(doc, GK);
}
// THE INTEGRATION, RUN HERE TOO. These are the four lines the recipe adds to
// push(); running them in the gate is what makes G1 a statement about the page
// and not about this file.
function pushBoxes(doc) {
  const boxes = boxesFor(doc);
  const parts = DD.deskPartsOf(doc, GENRES);
  // `b.fx = DD.boxFxOf(doc)` came off here 2026-08-27 with the record-wide
  // Character chain itself (desk-doc.js's own tombstone has the whole reason).
  for (const b of boxes) b.parts = parts;
  return boxes;
}

/* ---------- a unit table to write onto -------------------------------------
   Hand-built rather than compiled, because audio/plan.js drags in the whole
   Faust fleet and the thing under test is the arithmetic deskUnits does over a
   table, not how the table was made. Three units on purpose: a SAMPLED voice, a
   MODELLED one and a WIDE one.

   THIS COMMENT USED TO SAY "a MODELLED one (it does not — desk.js `if
   (u.sampler)`)", and the fixture was built around that absence as if it were
   the design. It was the defect: the desk computed the whole tone decision for a
   modelled voice and dropped it. The fixture stands unchanged — the same three
   units are still the right three — but what G8 asks of v1 is now the opposite
   question. */
const mkUnits = () => ({
  v0: { lvl: 1, module: "sampler", sampler: { id: "ahh_choir" } },
  v1: { lvl: 1, module: "tract_voice" },
  v2: { lvl: 1, module: "voice_choir", stereo: true, sampler: { id: "voice_choir" },
        inserts: [] },
  kick: { lvl: 1, drum: true, module: "drum" },
});
const ADDR = { v0: "line", v1: "line2", v2: "line", kick: "drums" };

console.log("desk-gate — the engineer, the board and the return\n");

// EVERY DESK KEY OFF. G1 asks what a document that says nothing about the desk
// does, and TERMS will not be that document for long — the integrator's one
// deliberate line (`sound.buses.rev.ret`) is what turns G6 green. Stripping here
// keeps G1 asking its own question after that lands, instead of quietly becoming
// a test of the shipped record.
function stripDesk(doc) {
  const d = clone(doc);
  for (const v of d.voices) delete v.desk;
  // `sound.fx` is deleted too, and deliberately AFTER its retirement: a
  // stripped fixture must not depend on document.js normalize having run.
  if (d.sound) { delete d.sound.buses; delete d.sound.master; delete d.sound.fx; }
  return d;
}

/* ================= G1 · ABSENT IS TODAY =================================== */
console.log("G1  absent is today — a document with no desk changes nothing");
{
  const doc = stripDesk(TERMS);
  ok(DD.deskPartsOf(doc, GENRES) === null, "deskPartsOf is null");
  ok(DD.masterOf(doc) === null, "masterOf is null");
  ok(DD.busesOf(doc) === null, "busesOf is null");
  ok(DD.deskIsDefault(doc, GENRES) === true, "deskIsDefault");
  // the box push() built BEFORE this round (boxesOf alone, untouched) against
  // the box push() builds AFTER it (the recipe's four lines applied)
  const before = boxesFor(doc)[0];
  const after = pushBoxes(doc)[0];
  const A = deskUnits(mkUnits(), ADDR, before, null, null);
  const B = deskUnits(mkUnits(), ADDR, after, null, null);
  ok(eq(A, B), "the unit tables are byte-identical",
     JSON.stringify(A) + "\n         " + JSON.stringify(B));
  ok(masterState(DD.masterOf(doc), DD.busesOf(doc)) === null,
     "masterState says nothing, so the engine's own master stands");
}

/* ================= G2 · THE ADDRESS IS THE DESK'S ========================= */
console.log("\nG2  the address is audio/desk.js's, not a second walk");
{
  const cases = [
    ["the shipped chant", clone(TERMS)],
    ["a pad, a bass and a kit", (() => {
      const d = clone(TERMS);
      d.voices[1].cast.part = "pad";
      d.voices.push({ name: "third", kind: "line",
        cast: { part: "line", reg: 0, entry: 0 }, material: "bed",
        instrument: "ahh_choir", level: 0.5, development: {} });
      d.voices.push({ name: "bottom", kind: "bass", cast: { style: "root" },
        development: {} });
      d.voices.push({ name: "kit", kind: "drums", cast: { on: true },
        instrument: "acoustic", material: "beat", development: {} });
      d.material.cells.beat = { kind: "drum", lanes: { k: [1, 0, 0, 0] } };
      return NuDoc.normalize(d);
    })()],
  ];
  for (const [name, doc] of cases) {
    const box = pushBoxes(doc)[0];
    const roster = voiceRoster(box);
    const want = partKeysOf(box, roster);
    const got = DD.channelsOf(doc, GENRES);
    ok(eq(got, want), name + ": " + JSON.stringify(got),
       "desk says " + JSON.stringify(want));
  }
}

/* ================= G3 · THE VOCABULARY IS ONE ============================= */
console.log("\nG3  every word in the document is the registry's own");
{
  const doc = clone(TERMS);
  // `fx: ["chorus"]` came off this fixture on 2026-08-26 (Paul: "Don't let me
  // add effects to instruments") and CAME BACK ON 2026-08-27 with its slot
  // knobs, by the same owner: *"I think we need to do what everyone else does
  // with effects. Add per voice effects, up to three. Each has a wet dry mix
  // and its own settings."* `fxw1` is slot 1's wet (the chip's own mix param
  // surfaced) and `fxa1` its first face param — both plain PARTMIX enums, so
  // this fixture asks the round-trip question about the whole 2026-08-27
  // vocabulary at once. `aux` stays from the 2026-08-26 round.
  doc.voices[0].desk = { fader: -2.5, lvl: "back", pan: "hl", rev: "wet",
                         echo: "touch", room: "none", aux: "some",
                         fx: ["chorus"], fxw1: "half", fxa1: "low",
                         eq: { lo: 0, mid: -1.5, hi: 2 },
                         mute: false, solo: false };
  // THE FIXTURE'S BUS NAMES CAME OFF THE NEW VOCABULARY, 2026-08-26. They were
  // `plate` and `slap`, and both are words fields.js BUSNAMES no longer holds —
  // the table was replaced whole that day with a JOB vocabulary because the old
  // one repeated REVERBLABEL back at itself (Paul: *"'name' is a very confusing
  // row because the 'name' seems to be reverb types."*). A fixture carrying a
  // retired name would now load with a NOTE rather than a value, which is the
  // right behaviour for a person's old save and the wrong thing to exercise
  // here: this fixture's job is to prove a NAMED bus round-trips.
  doc.sound.buses = { rev: { name: "ambience", ret: "hall", color: "plate" },
                      echo: { name: "throw", time: "d8", fb: "more", tone: "dark" } };
  doc.sound.master = { drive: "warm", glue: "glue", tape: "tape", space: "room" };
  // `doc.sound.fx = ["crunch"]` CAME OFF HERE 2026-08-27. The record-wide
  // Character chain is retired (desk-doc.js's tombstone has the reason); the
  // chip's one owner is the strip, and this fixture's first voice already
  // carries one — `desk.fx: ["chorus"]`, three assertions down.
  const pmKeys = F.PARTMIX.map((f) => f.key);
  const bad = [];
  for (const v of doc.voices) for (const k of Object.keys(v.desk || {}))
    if (!pmKeys.includes(k)) bad.push("voice.desk." + k);
  ok(!bad.length, "every voice.desk key is a PARTMIX key", bad.join(", "));
  const mKeys = F.MASTER.map((f) => f.key);
  const badM = Object.keys(doc.sound.master).filter((k) => !mKeys.includes(k));
  ok(!badM.length, "every sound.master key is a MASTER key", badM.join(", "));
  const badB = [];
  for (const [bus, row] of Object.entries(doc.sound.buses)) {
    const reg = F.BUSES.find((b) => b.bus === bus);
    if (!reg) { badB.push(bus + " is not a bus"); continue; }
    const knobs = reg.knobs.map((k) => k.key).concat("eq");
    for (const k of Object.keys(row)) if (!knobs.includes(k)) badB.push(bus + "." + k);
  }
  ok(!badB.length, "every sound.buses.<bus> key is in that row's knobs", badB.join(", "));
  // ...and it round-trips through the saver, which walks the same registries
  const S = require(R("song.js"));
  const box = pushBoxes(doc)[0];
  const song = { v: S.VERSION, slots: [S.blank()], song: [box],
                 buses: DD.busesOf(doc), master: DD.masterOf(doc) };
  const v = S.validateSong(clone(song));
  ok(v && !(v.errors || []).length,
     "song.js accepts the document's own spelling",
     JSON.stringify((v || {}).errors || "no result"));
  const saved = (v.song && v.song.song ? v.song.song[0] : (v.song || [])[0]) || {};
  // THE ASSERTION IS REVERSED A SECOND TIME, 2026-08-27, and both turns are
  // dated because both were Paul's. 2026-08-24 it read "a per-voice chip
  // survives the round trip"; 2026-08-26 ("Don't let me add effects to
  // instruments") it proved the opposite — `fx` was not a PARTMIX key and the
  // loader dropped it. 2026-08-27 ("Add per voice effects, up to three. Each
  // has a wet dry mix and its own settings") the field is back with its slot
  // knobs, so the original claim returns WIDENED: the chip survives, and so
  // do the wet and the face word, through the same registry walk.
  ok(saved.parts && saved.parts.line && eq(saved.parts.line.fx, ["chorus"]),
     "the per-voice chip survives the round trip again (Paul, 2026-08-27) — " +
     "`fx` is a PARTMIX list once more and song.js's one array branch takes it",
     JSON.stringify(saved.parts));
  ok(saved.parts && saved.parts.line && saved.parts.line.fxw1 === "half" &&
     saved.parts.line.fxa1 === "low",
     "…and the slot's wet and face words survive it — nine plain enum rows, " +
     "no new loader machinery",
     JSON.stringify(saved.parts));
  ok(saved.parts && saved.parts.line && saved.parts.line.aux === "some",
     "…and the FOURTH send still survives it, which is what proves the loader " +
     "is walking the registry rather than a remembered list",
     JSON.stringify(saved.parts));
}

/* ================= G4 · THE RACK REACHES THE STATE ======================== */
console.log("\nG4  the rack reaches the parent's own state fields");
{
  const d = masterState(null, { echo: { time: "d8" } });
  ok(d && near(d.delay.beats, 0.75), "d8 in four is 0.75 beats", JSON.stringify(d));
  ok(near(d.delay.feedback, 0.25) && near(d.delay.cutoff, 2600),
     "the engine's own two stand where the rack is silent", JSON.stringify(d.delay));
  STATE.setMeter("three");
  const d3 = masterState(null, { echo: { time: "d8" } });
  ok(d3 && near(d3.delay.beats, 0.5625),
     "d8 under `three` is 0.5625 beats — a dotted eighth is still a dotted eighth",
     JSON.stringify(d3 && d3.delay));
  STATE.setMeter(null);
  ok(near(masterState(null, { echo: { fb: "more" } }).delay.feedback, 0.62),
     "fb `more` is 0.62");
  ok(near(masterState(null, { echo: { tone: "dark" } }).delay.cutoff, 1400),
     "tone `dark` is 1400 Hz");
  const rv = masterState(null, { rev: { ret: "hall" } });
  ok(rv && near(rv.reverb, 0.5), "ret `hall` is state.reverb 0.5", JSON.stringify(rv));
  // the parent's own arithmetic, quoted: state-engine fxParams
  const rgain = Math.max(0, Math.min(2, 0.5 * 3.2));
  ok(near(rgain, 1.6), "…which the engine reads as rgain 1.6");
  const col = masterState(null, { rev: { color: "plate" } });
  ok(col && col.reverbColor === "dattorro", "color `plate` is the dattorro module");
  const SE = require(R("../engine/faust/voices/state-engine.js"));
  const RC = (SE.REVERB_COLORS || (SE.default && SE.default.REVERB_COLORS));
  ok(RC && RC.dattorro === "reverb_dattorro",
     "…and REVERB_COLORS holds it", JSON.stringify(RC));
  const badColor = Object.entries(F.REVERBS)
    .filter(([, v]) => !RC || !RC[v]).map(([k]) => k);
  ok(!badColor.length, "every REVERBS word names a module the parent ships",
     badColor.join(", "));
}

/* ========== G4b · THE ECHO IS A FRACTION OF A BAR, ALL THE WAY DOWN ======= */
// Paul, 2026-08-24: "delay should be bpm aligned with settings right?"
//
// G4 above stops at `d8 -> delay.beats 0.75`, and BEATS ARE NOT SECONDS — a
// beat count is only tempo-aligned if something downstream multiplies it by the
// seconds-per-beat, and nothing in this repo asserted that anything did. So the
// question could not be answered by reading a label, and this block does not:
// it calls the PARENT'S OWN fxParams, the single function that turns a state
// into the fx_bus sliders the DSP reads, and checks the SECONDS that come out.
// (state-engine.js is a UMD module with no audio in it, and G4 already requires
// it for REVERB_COLORS, so this costs nothing.)
console.log("\nG4b the echo arrives at the DSP in seconds, off the record's own bpm");
{
  const SE = require(R("../engine/faust/voices/state-engine.js"));
  // the state live.js getState() builds, in its own order: the compiled base,
  // then the tempo, then the rack ON TOP (audio/live.js:173).
  const stateFor = (bpm, buses, base) =>
    ({ ...(base || {}), bpm, ...(masterState(null, buses) || {}) });

  const at120 = SE.fxParams(stateFor(120, { echo: { time: "d8" } }));
  ok(near(at120.dtime, 0.75 * 0.5, 1e-9),
     "a dotted eighth at 120 is 0.375 s — 0.75 beats x (60/120)", "dtime " + at120.dtime);
  const at96 = SE.fxParams(stateFor(96, { echo: { time: "d8" } }));
  ok(near(at96.dtime, 0.75 * (60 / 96), 1e-9),
     "…the SAME word at 96 is 0.469 s: the seconds move with the tempo",
     "dtime " + at96.dtime);
  ok(at96.dtime > at120.dtime,
     "…and slower means longer, which is the whole of what `bpm aligned` means");

  // THE OTHER HALF OF THE ALIGNMENT: fields.js DTIMES is a fraction of a BAR,
  // and a bar is not always four beats. Under `three` a dotted eighth has to
  // come out 0.5625 beats or the echo is in a different metre from the band.
  STATE.setMeter("three");
  const three = SE.fxParams(stateFor(120, { echo: { time: "d8" } }));
  STATE.setMeter(null);
  ok(near(three.dtime, 0.5625 * 0.5, 1e-9),
     "…and a dotted eighth in three is 0.281 s, not four's 0.375",
     "dtime " + three.dtime);

  // EVERY WORD IN THE TABLE, not just the one the shipped record uses: the
  // fraction of a bar the page offers has to be the fraction of a bar the DSP
  // delays by, for all six. In four at 120 a bar is 2 s, so the answer is
  // simply the table's own number x 2 — which is the arithmetic a reader can
  // check by eye, and the reason this loop is worth more than one spot value.
  const wrong = Object.entries(F.DTIMES).filter(([w, frac]) =>
    !near(SE.fxParams(stateFor(120, { echo: { time: w } })).dtime, frac * 2, 1e-9));
  ok(!wrong.length, "all six DTIMES words arrive as their own fraction of a 2 s bar",
     wrong.map(([w]) => w).join(", "));

  // THE SPREAD ORDER IS THE LAW (audio/live.js:173: "the spread lands OVER it,
  // per stream, so the rack's return is what the engine reads and the compiled
  // default stands whenever the document says nothing"). audio/plan.js hands
  // toEngine `delay: 0`, which is FALSY, so to-engine.js:1172 writes the
  // engine's own { beats: 0.75, feedback: 0.25 } into every compiled state —
  // and if the rack were spread FIRST that stale default would win and the
  // echo bus would be decorative. Pinned with a base that carries it.
  const compiled = { delay: { beats: 0.75, feedback: 0.25 } };
  const over = SE.fxParams(stateFor(120, { echo: { time: "2" } }, compiled));
  ok(near(over.dtime, 1.0, 1e-9),
     "the rack's `1/2` beats the compiled default: 1.0 s, not 0.375",
     "dtime " + over.dtime);

  // AND WHEN THE DOCUMENT SAYS NOTHING the engine's own dotted eighth still
  // rides the record's tempo — absent is today, and today was already aligned.
  const silent = SE.fxParams(stateFor(96, null, compiled));
  ok(near(silent.dtime, 0.75 * (60 / 96), 1e-9),
     "a record with no echo bus still delays in tempo, at the engine's own 0.75",
     "dtime " + silent.dtime);
}

/* ================= G5 · ONE OWNER FOR THE RETURN ========================== */
console.log("\nG5  one owner for state.reverb — the rack, with space as the bleed");
{
  const both = masterState({ space: "room" }, { rev: { ret: "hall" } });
  ok(near(both.reverb, 0.5), "the rack wins", JSON.stringify(both));
  ok(near(both.mrev, 0.13), "space still owns the global dry bleed");
  const alone = masterState({ space: "room" }, null);
  ok(near(alone.reverb, 0.137), "space alone is unchanged from today: 0.137",
     JSON.stringify(alone));
  const shut = masterState({ space: "cavern" }, { rev: { ret: "off" } });
  ok(shut.reverb === 0, "`shut` is an explicit zero space cannot reopen",
     JSON.stringify(shut));
}

/* ================= G6 · THE SHIPPED CHANT IS NO LONGER DRY ================ */
console.log("\nG6  the shipped chant carries rev 0.78 into a NON-ZERO return");
{
  const doc = clone(TERMS);
  const box = pushBoxes(doc)[0];
  const units = deskUnits(mkUnits(), ADDR, box, null, null);
  // TIMES THE CHANNEL'S OWN STRIP GAIN ON A MODELLED VOICE, 2026-08-27. This
  // asserted `revs.every(r => near(r, 0.78))` — every unit's rev field the
  // verb verbatim — and went red the day the per-channel fader reached the
  // modelled route (FUTURE.md Phase 0; deskUnits' own comment has the
  // measurement). A SAMPLED unit's send ratio stays 0.78 because its strip
  // gain rides `lvl` into the note SOURCE (sampler.js note gain), trimming
  // dry and sends together; a MODELLED unit has no such source knob, so the
  // same trim lands on the route — rev 0.78 x p.gain. Same balance, different
  // carrier, and the fixture's v1 (the cantor, line2) carries a derived seat
  // gain of 0.8913. Asserting the bare 0.78 on it now would assert the very
  // bug the round fixed.
  const P0 = { line: resolvedPart(box, "line").gain,
               line2: resolvedPart(box, "line2").gain };
  const wantRev = (k) => k === "v1" ? 0.78 * P0.line2 : 0.78;
  const revs = Object.entries(units).filter(([k]) => k !== "kick")
    .map(([k, u]) => [k, u.rev]);
  ok(revs.every(([k, r]) => near(r, wantRev(k), 1e-4)),
     "every unit asks for rev 0.78 — gregorian's own tone.verb — times the " +
     "channel strip's own gain where the strip rides the route (the modelled " +
     "cantor: 0.78 x " + P0.line2 + ")",
     JSON.stringify(revs));
  const st = masterState(DD.masterOf(doc), DD.busesOf(doc));
  const passed = ok(st && st.reverb > 0,
     "…and the return it lands in is open",
     "masterState = " + JSON.stringify(st));
  if (!passed) console.log(
    "         THIS IS THE FINDING, NOT A BROKEN GATE. audio/plan.js:367 hands\n" +
    "         toEngine `reverb: 0`, fxParams reads rgain = clamp(reverb*3.2,0,2),\n" +
    "         and nothing on this page could write state.reverb. 78% wet and bone\n" +
    "         dry. It goes green when songs.js TERMS says\n" +
    "           sound: { level: 1, buses: { rev: { ret: \"hall\", color: \"plate\" } } }\n" +
    "         — the one line of this round that changes how the shipped record\n" +
    "         SOUNDS, which is why PROGRAM.md §2.6 gives it to the integrator.");
}

/* ================= G7 · THE HONEST MASTER IS UNMOVED ====================== */
console.log("\nG7  a bus row moves the rack and nothing else on the master");
{
  const BUSES = { rev: { ret: "hall", color: "plate" },
                  echo: { time: "d8", fb: "more", tone: "dark" } };
  const SKIP = ["reverb", "reverbColor", "delay"];
  const drives = [null, ...Object.keys(F.DRIVES)];
  const glues = [null, ...Object.keys(F.GLUES)];
  const tapes = [null, ...Object.keys(F.TAPES)];
  const spaces = [null, ...Object.keys(F.SPACES)];
  let n = 0, bad = null;
  for (const drive of drives) for (const glue of glues)
    for (const tape of tapes) for (const space of spaces) {
      const m = {};
      if (drive) m.drive = drive;
      if (glue) m.glue = glue;
      if (tape) m.tape = tape;
      if (space) m.space = space;
      const a = masterState(m, BUSES) || {}, b = masterState(m, null) || {};
      const strip = (o) => { const c = { ...o }; for (const k of SKIP) delete c[k]; return c; };
      n++;
      if (!eq(strip(a), strip(b)) && !bad)
        bad = JSON.stringify(m) + "\n         " + JSON.stringify(strip(a)) +
              "\n         " + JSON.stringify(strip(b));
    }
  ok(!bad, "all " + n + " drive/glue/tape/space combinations are unmoved", bad);
}

/* ================= G8 · THE PART MIX REACHES THE UNITS ==================== */
console.log("\nG8  a strip's numbers arrive on the parent's units");
{
  const doc = clone(TERMS);
  doc.voices[0].desk = { fader: -3, pan: "hl", echo: "some", eq: { hi: 4 } };
  const box = pushBoxes(doc)[0];
  const units = deskUnits(mkUnits(), ADDR, box, null, null);
  ok(near(units.v0.lvl, 0.7079, 5e-5), "fader -3 dB is lvl 0.7079",
     String(units.v0.lvl));
  ok(near(units.v0.pan, -0.35), "pan `hl` is -0.35", String(units.v0.pan));
  ok(near(units.v0.del, 0.3), "echo `some` is del 0.3", String(units.v0.del));
  // REVERSED, 2026-08-26, AND REVERSED BACK, 2026-08-27 — the check has now
  // pointed both ways and each turn was Paul's own word. 2026-08-26 it proved
  // a chip COULD NOT reach the units ("Don't let me add effects to
  // instruments"); 2026-08-27 ("Add per voice effects, up to three") the wire
  // is back, so the pair below asks both halves of the honest question: a
  // record that says nothing still gets not one insert (absent is today), and
  // a record that seats a chip gets it WITH ITS WET AND FACE KNOBS applied —
  // the wet is the chip's own mix param (fields.js FXWETS -> params.mix) and
  // the face word lands in the module's own units (FXFACE), both finished
  // through the parent's own insertChain by insertsFor.
  ok(!(units.v0.inserts && units.v0.inserts.length),
     "a record with no `fx` still hands the units not one insert — absent is " +
     "today on the slots too",
     JSON.stringify(units.v0.inserts));
  {
    const d3 = clone(TERMS);
    d3.voices[0].desk = { fx: ["crunch"], fxw1: "half", fxa1: "most" };
    const u3 = deskUnits(mkUnits(), ADDR, pushBoxes(d3)[0], null, null);
    const ins = (u3.v0.inserts || [])[0];
    ok(ins && ins.module === "insert_higain" &&
       near(ins.params.mix, 0.5) && near(ins.params.drive, 1),
       "a seated chip reaches the units as its module with the SLOT'S OWN " +
       "knobs on it — crunch -> insert_higain, wet `half` -> mix 0.5, drive " +
       "face `most` -> 1 (Paul, 2026-08-27: \"a wet dry mix and its own " +
       "settings\")",
       JSON.stringify(ins));
    ok(F.PARTMIX.some((f) => f.key === "fx") &&
       ["fxw1", "fxa1", "fxb1"].every((k) => F.PARTMIXBY[k]),
       "…and PARTMIX declares the field and its slot knobs, so song.js's " +
       "registry walk owns the validation with no second list");
  }
  ok(units.v0.sampler && units.v0.sampler.strip &&
     near(units.v0.sampler.strip.hi, 4),
     "the SAMPLED voice's strip carries the merged EQ",
     JSON.stringify(units.v0.sampler));

  /* ---- THE CHECK THAT USED TO PIN THE BUG -------------------------------
     It read, verbatim, under the heading "THE LAW, not an accident":

         ok(!("sampler" in units.v1),
            "the MODELLED voice has no sampler key, so no strip EQ can reach it");

     That is a gate that goes RED the moment somebody fixes the defect. It did
     not merely miss the hole — it defended it, and it named the defence a law.
     The absence was real (a Faust module has no `sampler` key) but the
     CONCLUSION was wrong: what followed from it was not "no EQ can reach a
     modelled voice", it was "the strip is in the wrong place". 555 of 856
     chair-boxes in the catalog are modelled and 527 of them had a non-flat tone
     decision computed and thrown away, including the cantor of the shipped
     chant, sitting beside a sampled schola that got hers.

     What replaces it asks the opposite question, and the same one of both
     voices: the merged EQ reaches this unit, whichever kind it is. */
  const A2 = { v0: "line", v1: "line", v2: "line", kick: "drums" };
  const both = deskUnits(mkUnits(), A2, box, null, null);
  ok(!("sampler" in both.v1) && both.v1.strip &&
     near(both.v1.strip.hi, 4),
     "the MODELLED voice has no sampler key AND carries the merged EQ, at `strip`",
     JSON.stringify(both.v1.strip));
  ok(eq(both.v1.strip, both.v0.sampler.strip),
     "…the SAME three numbers the sampled voice on the same chair gets — one " +
     "tone decision, two carriers, never two spellings",
     JSON.stringify(both.v1.strip) + " vs " + JSON.stringify(both.v0.sampler.strip));

  /* ---- ABSENT IS TODAY: the round ADDS a carrier, it moves nothing ------- */
  ok(DESK.__test.stripWith(undefined, null) === null &&
     DESK.__test.stripWith(undefined, { lo: 0, mid: 0, hi: 0 }) === null,
     "a flat EQ builds no strip at all, so a record that says nothing about " +
     "tone writes no `strip` key");
  // ...and nothing else on any unit moved. deskUnits may add exactly these keys
  // to a unit it was handed; `strip` is the only new one this round, and it is
  // the only one that appears on v1.
  const ALLOWED = ["lvl", "rev", "del", "pan", "dry", "inserts", "sampler", "strip"];
  const base = mkUnits();
  let stray = [];
  for (const [k, u] of Object.entries(both)) {
    for (const f of Object.keys(u || {}))
      if (!(f in base[k]) && ALLOWED.indexOf(f) < 0) stray.push(k + "." + f);
    if (base[k].sampler && "strip" in u) stray.push(k + ": a SAMPLED unit grew a top-level strip");
  }
  ok(!stray.length, "no unit grew a field this round did not name — a sampled " +
     "voice's carrier is exactly where it was", stray.join(", "));

  // ...and a WIDE unit keeps its width, which means it keeps no chips
  const doc2 = clone(TERMS);
  doc2.voices[0].desk = { fx: ["chorus"] };
  const u2 = deskUnits(mkUnits(), ADDR, pushBoxes(doc2)[0], null, null);
  ok(eq(u2.v2.inserts, []), "a stereo unit's chain is dropped (widthKept)",
     JSON.stringify(u2.v2.inserts));
}

/* ============ G8b · ...AND THE NUMBERS BECOME SOUND ======================= */
/*
 * TEST THE ARTIFACT. Every check above this one reads a FIELD IN AN OBJECT, and
 * that is exactly how the desk's three-band EQ managed to reach no sound at all
 * on any voice for as long as this page existed while its only gate stayed
 * green: `near(units.v0.sampler.strip.hi, 4)` passed while the renderer, one
 * layer down, had no case for the word `hi`. Measured through the parent's own
 * strip on 2026-08-24, `{lo:-12, mid:+12, hi:+12}` came out BIT-IDENTICAL to a
 * flat strip.
 *
 * So this block renders AUDIO and measures a spectrum. Both paths are the
 * shipped ones — the modelled voice goes through stream-renderer.js's own
 * renderUnitWindow (the function where a unit becomes samples on the buses), the
 * sampled voice through sampler.js's own mixPCM. The source is deterministic
 * noise from an LCG: no rng, no wall clock, no ears, ~1 s.
 *
 * IT FAILS ON THE TREE AS IT STOOD THIS MORNING, on both voices — the modelled
 * one because desk.js wrote it no strip at all, the sampled one because
 * makeStrip had no shelf.
 */
console.log("\nG8b …and the numbers become SOUND — a measured spectrum, not a field");
{
  const SP = require(R("../engine/faust/voices/sampler.js"));
  const RC = require(R("../engine/faust/press/render-core.js"));
  const SRE = require(R("../engine/faust/live/stream-renderer.js"));
  const SR = 44100, BS = 64, N = 1 << 15;

  // THE SILKSCREEN AND THE FILTER MUST AGREE. fields.js EQ_BANDS is what the
  // board draws and what song.js validates a save against; sampler.js BOARD_EQ
  // is what the biquad is actually built from. One number, two files, so it is
  // gated rather than trusted.
  {
    const T = { lowshelf: "ls", peaking: "peak", highshelf: "hs" };
    const bad = F.EQ_BANDS.filter((b) => {
      const e = SP.BOARD_EQ[b.key];
      return !e || e.f !== b.freq || e.type !== T[b.type] ||
             (b.q != null && !near(e.q, b.q));
    });
    ok(!bad.length, "all 3 board bands are the same Hz and the same filter type " +
       "in fields.js EQ_BANDS and in the engine's BOARD_EQ",
       JSON.stringify(bad) + " vs " + JSON.stringify(SP.BOARD_EQ));
  }

  // deterministic source, one array reused by every render
  const mkNoise = (seed) => { let x = seed >>> 0; const o = new Float32Array(N);
    for (let i = 0; i < N; i++) { x = (x * 1103515245 + 12345) >>> 0; o[i] = x / 2147483648 - 1; }
    return o; };
  const NOISE = mkNoise(12345), NOISE_R = mkNoise(777);
  // band energy in dB, averaged over a spread of probe frequencies. A SHELF is
  // measured at its stopband asymptote and never at the corner: at the corner a
  // shelf is at HALF its nominal gain, which is a measurement artefact people
  // have mistaken for a broken filter.
  const bandDb = (x, f0, f1) => {
    let p = 0, n = 0;
    for (let f = f0; f <= f1; f += (f1 - f0) / 12) {
      let re = 0, im = 0; const w = 2 * Math.PI * f / SR;
      for (let i = 0; i < 8192; i++) { re += x[i] * Math.cos(w * i); im += x[i] * Math.sin(w * i); }
      p += re * re + im * im; n++;
    }
    return 10 * Math.log10(p / n + 1e-30);
  };
  // FOUR probe bands, not three, and the fourth is the reason: a low shelf
  // measured AT its own 120 Hz corner reads HALF its nominal gain (-6 for a -12
  // ask), which is a measurement artefact and not a broken filter. 50 Hz is the
  // asymptote. 120 Hz stays in the list as the band the OTHER two must leave
  // alone, which is the more interesting question there anyway.
  const CURVE = (x) => [bandDb(x, 35, 70), bandDb(x, 100, 140),
                        bandDb(x, 900, 1100), bandDb(x, 13000, 17000)];
  const dCurve = (a, b) => a.map((v, i) => v - b[i]);
  const fmt = (c) => c.map((v) => v.toFixed(2)).join(" / ") + " dB @ 50 / 120 / 1k / 15k";

  /* ---- the MODELLED path: the shipped renderUnitWindow ------------------- */
  const eng = SRE.makeStreamEngine({ E: null, SE: null, FP: null, SP,
    mergeIvals: RC.mergeIvals, mkProc: null, rootOf: null, SR, BS });
  function renderModelled(u) {
    const buses = { dry: new Float32Array(N), rev: new Float32Array(N),
                    del: new Float32Array(N), pp: new Float32Array(N),
                    wL: new Float32Array(N), wR: new Float32Array(N) };
    let pos = 0;
    const proc = { setParamValue() {},
      render(ins, len) { const a = NOISE.subarray(pos, pos + len),
                               b = NOISE_R.subarray(pos, pos + len);
                         pos += len; return u.stereo ? [a, b] : [a]; } };
    const v = { proc, R: "/x/", pending: [], ivals: [[0, N]], busyUntil: -1,
                lastOff: null, curOut: 1, curPP: 0, renderedEnd: 0 };
    eng.__test.renderUnitWindow({ u, procs: [v], chain: null, chainPrev: null },
                                buses, 0, N, 0.5, null);
    return buses;
  }
  const M = (strip) => renderModelled({ lvl: 1, module: "tract_voice", strip });

  // ABSENT IS TODAY, measured: with no strip the unit's dry bus is the source
  // itself, sample for sample — the path this round did not touch.
  {
    const d = M(null).dry;
    let same = true; for (let i = 0; i < N; i++) if (d[i] !== NOISE[i]) { same = false; break; }
    ok(same, "a modelled voice with NO strip renders bit-identically to the " +
       "source — the old direct path is untouched");
    const z = M({ lo: 0, mid: 0, hi: 0 }).dry;
    let same2 = true; for (let i = 0; i < N; i++) if (z[i] !== NOISE[i]) { same2 = false; break; }
    ok(same2, "…and an all-flat strip is bit-identical too: 0 dB builds no biquad");
  }

  const flatM = CURVE(M(null).dry);
  const hiM = dCurve(CURVE(M({ lo: 0, mid: 0, hi: 12 }).dry), flatM);
  ok(hiM[3] >= 8 && Math.abs(hiM[1]) < 0.5 && Math.abs(hiM[2]) < 1.0,
     "a MODELLED voice: `hi: +12` lifts 15 kHz and leaves 120 Hz alone — " + fmt(hiM));
  const loM = dCurve(CURVE(M({ lo: -12, mid: 0, hi: 0 }).dry), flatM);
  ok(loM[0] <= -8 && Math.abs(loM[3]) < 0.5,
     "…and `lo: -12` cuts the bottom and leaves 15 kHz alone — " + fmt(loM));
  const midM = dCurve(CURVE(M({ lo: 0, mid: -12, hi: 0 }).dry), flatM);
  ok(midM[2] <= -8 && Math.abs(midM[1]) < 1.5 && Math.abs(midM[3]) < 1.0,
     "…and `mid: -12` scoops 1 kHz — " + fmt(midM));

  /* ---- the SAMPLED path: the shipped mixPCM ------------------------------ */
  // one zone of the SAME noise at root = the note played, so rate = 1 and the
  // buffer is delivered sample for sample: what comes out is the strip and
  // nothing else.
  const zone = { srcId: "z", root: 60, lo: 0, hi: 127, vlo: 0, vhi: 127,
                 loop: false, loopStart: 0, loopEnd: 0, len: N, sr: SR };
  function renderSampled(strip) {
    const into = { dry: new Float32Array(N), rev: new Float32Array(N), del: new Float32Array(N) };
    SP.mixPCM([{ freq: 261.625565, zones: [zone], tSec: 0, durSec: 0.6, gain: 0.5,
                 atk: 0.001, rel: 0.01, sr: SR }],
              { z: NOISE }, SR, into, { dry: 1, rev: 0, del: 0, strip }, null, null);
    return into.dry;
  }
  const flatS = CURVE(renderSampled(null));
  const hiS = dCurve(CURVE(renderSampled({ lo: 0, mid: 0, hi: 12 })), flatS);
  ok(hiS[3] >= 8 && Math.abs(hiS[1]) < 0.5,
     "a SAMPLED voice: the same `hi: +12` does the same thing — " + fmt(hiS));

  /* ---- ONE STAGE, NOT TWO SPELLINGS ------------------------------------- */
  ok(Math.abs(hiM[3] - hiS[3]) < 0.5 && Math.abs(hiM[1] - hiS[1]) < 0.5,
     "the modelled curve and the sampled curve agree within 0.5 dB — the two " +
     "carriers run the same filter, which is the whole point of the round",
     fmt(hiM) + "  vs  " + fmt(hiS));

  /* ---- STEREO KEEPS ITS WIDTH ------------------------------------------- */
  // chorale -> voice_choir is the gregorian schola on the shipped record, and it
  // is one of the four STEREO fleet voices. The renderer's INSERT path is
  // mono-summing, which is why widthKept drops every chip on a wide unit — so a
  // tone stage that took the same shortcut would have collapsed the very voice
  // sitting beside the one that was complained about. It does not: a strip has
  // no cross-channel state, so a wide unit gets two of them.
  {
    const b = renderModelled({ lvl: 1, module: "voice_choir", stereo: true,
                               strip: { lo: 0, mid: 0, hi: 12 } });
    let widest = 0, sumDry = 0;
    for (let i = 0; i < N; i++) { const d = Math.abs(b.wL[i] - b.wR[i]);
      if (d > widest) widest = d; sumDry += Math.abs(b.dry[i]); }
    ok(widest > 0.1 && sumDry === 0,
       "a STEREO modelled voice EQ'd on the board still arrives on wL/wR as two " +
       "different channels — the width survives the tone stage",
       "max|L-R| " + widest.toFixed(3) + ", mono dry bus energy " + sumDry);
    const flatW = renderModelled({ lvl: 1, module: "voice_choir", stereo: true });
    const wide = dCurve(CURVE(b.wL), CURVE(flatW.wL));
    ok(wide[3] >= 8, "…and it is EQ'd, not merely passed through — " + fmt(wide));
  }

  /* ---- WHAT IT COSTS ----------------------------------------------------- */
  // The number that belongs in the commit. pad_saw = 1.0 COST unit measured at
  // 516 ms of CPU per 8 s of audio on this box (state-engine.js COST table);
  // this prints the board EQ against that scale so a regression in the stage is
  // visible as a number rather than as a crackle in Paul's headphones.
  {
    // MEASURED IN THE LOOP THE RENDERER RUNS — a warm, monomorphic
    // read-modify-write over a Float32Array through the module's own stripStep,
    // minus the cost of the same loop doing nothing. Two ways of measuring this
    // were tried and thrown away for lying: a bare `acc += stripStep(...)` timed
    // an EMPTY strip SLOWER than a three-band one (call overhead, not filter),
    // and a delta between two renderUnitWindow calls read 5x high because each
    // call allocates six buses and a fresh state, so GC and deopt swamped the
    // signal. What is left is the inner loop, which is the thing that runs.
    const S3 = SP.makeStrip({ lo: -3, mid: -1.5, hi: 4 }, SR);
    const step = SP.stripStep, buf = new Float32Array(N);
    // BEST OF FIVE, because the first version of this line printed 42 ms on one
    // run and 7 ms on the next: a mean over a JIT and a garbage collector is a
    // measure of what else the machine was doing. The minimum is the closest
    // thing to the cost of the arithmetic.
    const time = (f) => { for (let r = 0; r < 20; r++) f();          // warm
      let best = Infinity;
      for (let k = 0; k < 5; k++) {
        const t0 = process.hrtime.bigint();
        for (let r = 0; r < 40; r++) f();
        best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6 / 40);
      }
      return best; };
    buf.set(NOISE);
    const withEq = time(() => { for (let i = 0; i < N; i++) buf[i] = step(S3, buf[i], i / SR); });
    buf.set(NOISE);
    const idle = time(() => { for (let i = 0; i < N; i++) buf[i] = buf[i]; });
    const per8s = (withEq - idle) * (8 * SR) / N;
    const cost = per8s / 516.2;   // pad_saw = 516.2 ms per 8 s (state-engine COST)
    // the number goes on a REPORT line, not into the check's own sentence: a
    // wall-clock reading is the one thing in this file that cannot be
    // deterministic, and every other line of this gate's output is byte-stable
    // run to run. The threshold is the check; the reading is the note.
    console.log("       three-band board EQ: " + per8s.toFixed(1) + " ms per 8 s of audio = " +
                cost.toFixed(3) + " COST units (pad_saw = 1.0; BUDGET 40, awake ceiling ~28)");
    ok(cost < 0.15, "the board EQ costs well under a fifth of one voice, so 25 " +
       "modelled voices carrying one stay under a single pad_saw against a " +
       "BUDGET of 40 and an awake ceiling of ~28",
       cost.toFixed(3) + " COST units");
  }
}

/* ================= G9 · SOLO CUTS ========================================= */
console.log("\nG9  solo cuts every channel that is not soloed");
{
  const doc = clone(TERMS);
  doc.voices[1].desk = { solo: true };
  const units = deskUnits(mkUnits(), ADDR, pushBoxes(doc)[0], null, null);
  ok(units.v0.lvl === 0, "the un-soloed line is cut", String(units.v0.lvl));
  ok(units.v1.lvl !== 0, "the soloed line is not", String(units.v1.lvl));
  ok(DD.deskIsDefault(doc, GENRES) === false,
     "…and the document no longer reads as default, so the board can say so");
}

/* ================= G10 · THE CAPS HOLD ==================================== */
console.log("\nG10 every rail holds, and nothing resolves to NaN");
{
  const doc = clone(TERMS);
  doc.voices[0].desk = { fx: ["chorus", "phaser", "flanger", "tremolo", "leslie", "wah"],
                         fader: -1e9, eq: { hi: 99 },
                         rev: "sideways", lvl: "enormous", pan: "yonder" };
  const m = F.resolvePartMix(doc.voices[0].desk);
  ok(m.fx.length === F.MAX_FX, "six chips resolve to MAX_FX", String(m.fx.length));
  ok(m.fader === -24, "a fader of -1e9 resolves to -24 dB", String(m.fader));
  ok(m.eq.hi === 12, "an eq.hi of 99 resolves to 12 dB", String(m.eq.hi));
  ok(m.rev === 0 && m.lvl === 1 && m.pan === 0,
     "words no table names resolve to the default",
     JSON.stringify({ rev: m.rev, lvl: m.lvl, pan: m.pan }));
  const units = deskUnits(mkUnits(), ADDR, pushBoxes(doc)[0], null, null);
  const nan = [];
  for (const [k, u] of Object.entries(units))
    for (const f of ["lvl", "pan", "rev", "del"])
      if (u[f] != null && !Number.isFinite(u[f])) nan.push(k + "." + f);
  ok(!nan.length, "no unit carries a NaN", nan.join(", "));
  ok(units.v0.rev <= 1 && units.v0.del <= 1, "the send clamps hold");
  // ...and the rack's own rails: an unknown knob word is absent, never NaN
  const st = masterState(null, { rev: { ret: "cathedral" }, echo: { time: "eventually" } });
  ok(st === null, "a rack of words the tables do not name says nothing",
     JSON.stringify(st));
  const huge = masterState(null, { rev: { ret: "huge" } });
  ok(near(huge.reverb, 0.625),
     "`huge` is the saturation point — clamp(0.625*3.2,0,2) === 2, and there is nothing above it");
}

/* ================= G11 · NOT ONE DROPDOWN ON THE BOARD ====================
   THE GATE THAT WAS MISSING, and the reason it was missing is the lesson.
   test/sheets.js asserted `#app select` is empty and it was — 0 — but the board
   mounts in `#deck`, and a page-wide count on 2026-08-24 found TWENTY-THREE
   `<select>`s, every one of them on this board: `place` and the three sends on
   each channel (8), and the master's own fifteen. Per-instrument options in
   dropdowns is the exact thing Paul objected to. PROGRAM.md §5 named the
   subtree; the subtree was not where the board lived. So this one counts the
   WHOLE DOCUMENT and subtracts only what is deliberately still a menu.

   THREE `<select>`s SURVIVE AND THEY ARE ALL IN THE ATLAS — `era`, `look at`
   and the fallback listbox. They are NAVIGATION and the deliberate accessible
   path to a record (D6/G11 in test/atlas.js proves the listbox writes exactly
   `genreToDocument("reggae", 1)`), not options on an instrument. They are
   asserted PRESENT below as well as exempted, so a later round that "finishes
   the job" by deleting them turns this gate red instead of quietly removing the
   keyboard route to sixty-two records.

   This is the one check in this file that needs a browser, because it is the
   one claim about the RENDERED page — "test the artifact: gates must read the
   rendered output; three features shipped broken here while every check
   passed." Playwright is borrowed rather than installed (THE OFFLINE LAW), and
   the path is pushed onto this module's own resolution list so the gate works
   whether or not its caller remembered NODE_PATH. */
console.log("\n" + "G11 the board, as the browser actually draws it");
{
  module.paths.push("/home/ford/ftrain-2025/node_modules");
  const PAGE = (() => { const i = process.argv.indexOf("--page");
    return i < 0 ? "http://localhost:8777/nukernel/index.html" : process.argv[i + 1]; })();
  const EXE = (() => { const i = process.argv.indexOf("--chrome");
    return i < 0 ? process.env.HOME +
      "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome" : process.argv[i + 1]; })();

  // A GATE THAT SKIPS WHEN IT IS INCONVENIENT IS THE BUG THIS BLOCK EXISTS FOR.
  // The finding above survived a whole round because a check was faithful to a
  // scope that did not contain the thing, so an unreachable page is a FAILURE
  // here with the command to fix it printed, not a quiet pass.
  let chromium = null, why = null;
  try { chromium = require("playwright").chromium; }
  catch (e) { why = "playwright is not resolvable — NODE_PATH=" +
    "/home/ford/ftrain-2025/node_modules, or run this through `node test/all.js`"; }
  let up = false;
  if (chromium) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 5000);
      up = (await fetch(PAGE, { signal: c.signal })).ok;
      clearTimeout(t);
    } catch (e) { up = false; }
    if (!up) why = PAGE + " is not answering — start it with " +
      "`cd " + path.join(__dirname, "..") + " && (nohup ./serve.sh 8777 >/dev/null 2>&1 &)`";
  }
  if (why) { ok(false, "the page is reachable and playwright is borrowed", why); }
  else {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text()))
    errs.push("console: " + m.text()); });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  /* ===== THE BOX BOOTS ON THE BLANK STATE NOW (2026-09-02) ================
     Paul, the composer round: *"Add a 'silence' genre at the top of the genre
     list. This is a blank state."* The box opens on `silence` — one eight-bar
     section, ZERO voices, one cell of rests — instead of on a copy of the
     shipped chant, because a box that opened playing somebody else's record was
     answering a question nobody had asked yet.
     THIS GATE IS ABOUT A RECORD WITH A BAND IN IT, so it asks for one, in the
     address, the way a link does: `#at=Rome&y=600&s=1` is the shipped chant —
     the very `songs.js TERMS` this file used to inherit from the boot — named
     rather than assumed. `s=1` because the boot draws a seed now (Paul: *"Boot
     up every new session with a new seed unless there's a seed in the URL"*) and
     a gate that re-rolled its own subject would measure a different record every
     run. Naming the fixture is the honest half of the change: what this file
     asserts about "the record" is now a claim about a record it chose. */
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await installCombo(page);
  /* ...AND THE FIXTURE IS THE SHIPPED CHANT ITSELF, BY NAME (2026-09-02).
     This gate's checks NAME the chant's own players (`cantor`, `schola`),
     and a COMPOSED anchor at Rome 600 names its players `voice`, `voice2`,
     `vocal` — so the address lands the right PLACE and the wrong ROSTER.
     `__eightShipped()` is `CTX.setDocument(a deep copy of songs.js TERMS)`,
     the same document door a link uses; it is the record this file
     inherited from the boot until the box began booting on the blank state
     (Paul: *"Add a 'silence' genre at the top of the genre list. This is a
     blank state."*), asked for by name instead of assumed. */
  await page.evaluate(() => window.__eightShipped && window.__eightShipped());
  await page.waitForTimeout(1200);
  /* AND THE BOARD IS THE `Mix` TAB SINCE 2026-08-27. Paul: *"Why don't we make
     tabs at the top level and let go of the idea of scrolling everything? The
     tabs are: Where / Tempo / Key / Motif / Band / Mix / Produce / Score /
     Export."* The board is the sixth of the nine and the page boots on the
     first, so `#boardpanel` does not exist at all until this call — the wait
     below would have hung for twenty seconds and then reported an empty board.
     `window.__eightTab` is ui/eight.js's own door for a gate and is the same
     call the tab button's listener makes.

     THE BOARD'S OWN TABS ARE NESTED INSIDE THIS ONE AND ARE NOT FLATTENED
     INTO IT — Paul, the same day: *"Put the effects buses and mains into
     special tabs after the voices -- now the board is one tabbed space that
     is consistent and easy to understand."* The nine are the places a record
     is worked on; which channel strip is open is a fact about the Mix panel.
     Everything below — `openTab`, `openBus`, the whole G11 walk — is
     unchanged and still walks the INNER strip. */
  await page.evaluate(() => window.__eightTab && window.__eightTab("Mix"));
  await page.waitForTimeout(400);
  /* ONE PANEL, AND WHAT IS IN IT CHANGED AGAIN, 2026-08-28. This line waited
     on `#boardtbl` and `#racktbl` while the board was two tables
     (2026-08-25→27); then on `#strips` AND `#rack` while the strips were
     tabbed and the rack stood below them; then on `#boardpanel #strips
     .nu-strip`, because the first tab was a voice and "WAITING ON `#rack
     .nu-plate` HERE WOULD NOW HANG FOREVER".

     PAUL, 2026-08-28: *"You were supposed to remove the voices from the mixing
     board and just put them as nav items in the voices themselves."* So the
     board's first tab is the GENRE PLATE and `#strips` does not exist on this
     page at all — the sentence above is exactly inverted, and the wait is
     inverted with it. A voice's strip is `#voicemix .nu-strip`, on the BAND
     tab, inside the voice, on its `mix` facet: `openVoice` below is the one
     gesture that reaches it and every per-voice check calls it. */
  await page.waitForSelector("#boardpanel #rack .nu-plate", { timeout: 20000 });

  /* ---- THE STRIPS ARE INSIDE THE VOICES SINCE 2026-08-28, so this gate goes
     to them there ----
     Paul: *"add another nav item for the mixing and give it a channel design
     like the mixer … add it in a new nav element called mix that is per
     voice."* A strip is `#voicemix .nu-strip`, on the Band tab, inside the
     voice, on its `mix` mark — and `openVoice` above is the three taps that
     reach it. The strip ITSELF is unchanged: same `.nu-strip` skin, same rows,
     same `b|…` and `ins|…` keys, because ui/engineer.js's `stripOf` was LIFTED
     to a module function (`channelStrip`) rather than re-drawn, which is what
     lets every check below stand word for word.

     THE HAZARD THIS HELPER EXISTS FOR IS THIS FILE'S OWN, WRITTEN AT THE TOP
     OF G11: "A GATE THAT SKIPS WHEN IT IS INCONVENIENT IS THE BUG THIS BLOCK
     EXISTS FOR … a check faithful to a scope that does not contain the thing."
     Every per-strip check below reads ONE strip and counts against
     `chansOnPage`, and with one strip on the page all of them would go on
     passing while only the FIRST voice was ever examined. Measured on the
     tabbed page before this helper landed: 138/138 green with four of the
     five voices never looked at. So the per-strip checks run ONCE PER VOICE —
     `perTab` walks `channelVoicesOf`'s own list now instead of a row of board
     tabs, which is the same set and one indirection fewer. */
  // ...AND THE BUSES JOINED THE ROW, 2026-08-27, so a tab now has a KIND.
  // The key is `boardtab|<kind>|<name>` (it was `boardtab-<name>` while only
  // voices had tabs — the page's own `|` scoping convention, and what keeps a
  // voice called `main` from claiming the main plate's tab). THE KIND IS
  // ALWAYS `bus` SINCE 2026-08-28 and the shape is kept anyway, because the
  // address is the address: this walk still reads it out of the key rather
  // than assuming, so a voice tab that came BACK to this row would be seen
  // rather than silently counted as a bus.
  /* THE ROW IS THE GUTTER NOW, 2026-09-02 (slice 2e). It read
     `document.querySelectorAll("#boardtabs button")` and this file's own map
     named the hazard of that line before the row moved: "if the row moves to
     #nu-tray, allTabs() returns [] and every downstream perBus walk silently
     measures nothing — precisely the 'a gate faithful to a scope that does not
     contain the thing' hazard this gate names."
     Paul, B11: *"Instead of having four icons on top and section automation
     that should have been five subicons under the 'Mix' icon."* So the scope
     moves with the thing, and the ADDRESS does not move at all: the five
     buttons are `#nu-tray [data-k="boardtab|<kind>|<key>"]`, which is the same
     key the deleted row wore and the same key `openBus` has always clicked.
     Read off `#nu-tray` and not off the document, so a stray `boardtab|…`
     anywhere else would be a miss rather than a silent pass. */
  const allTabs = async () => {
    /* THE FIVE ARE CHILDREN OF A BRANCH, SO THE BRANCH IS OPENED FIRST. The
       gutter is a tree (2026-09-02): `showTab("Mix")` expands `toptab-Mix` and
       the five rows appear under it, and `__eightUp()` — which `openVoice`
       below calls to get back to the tabs — folds every branch on the page.
       A read taken after that would find no rows and report an empty row,
       which is this block's own named hazard rather than a finding. */
    await topTab("Mix");
    return page.evaluate(() =>
    [...document.querySelectorAll('#nu-tray [data-k^="boardtab|"]')].map((b) => {
      const m = /^boardtab\|([^|]+)\|(.+)$/.exec(b.dataset.k || "");
      return m ? { kind: m[1], key: m[2] } : { kind: "?", key: b.dataset.k };
    }));
  };
  const busTabs = () => allTabs()
    .then((t) => t.filter((x) => x.kind === "bus").map((x) => x.key));
  /* THE VOICES ARE NOT A TAB ROW ANY MORE, so the list of them is read off the
     MODEL — desk-doc's `channelVoicesOf`, which is the answer the audio tier
     builds from (G2's law) and is exactly what `boardTabs()` used to be
     checked AGAINST one block down. Reading it here is strictly stronger than
     reading a row: a voice the page failed to draw a strip for now fails
     `openVoice` below rather than quietly leaving the walk one voice short. */
  const voiceNames = () => page.evaluate(() =>
    window.NuDeskDoc.channelVoicesOf(window.__eightDoc(), window.NuGenres.GENRES)
      .map((c) => c.voice.name));
  const topTab = async (t) => {
    await page.evaluate((x) => window.__eightTab(x), t);
    await page.waitForTimeout(250);
  };
  /* ONE GESTURE, THREE TAPS, AND IT IS THE PERSON'S OWN (Paul, 2026-08-28:
     *"add it in a new nav element called mix that is per voice"*): go to the
     Band tab, tap the voice in the gutter, tap its `mix` mark. The gutter
     draws ONE LEVEL at a time — the voices are the `band` level and the facets
     are the `voice` level — so a walk that is already standing inside one
     voice has to come `up` before the next voice's mark exists, which is what
     `trayup` is. Waiting on the STRIP'S OWN NAME (`.nu-sname`) rather than on
     a timeout is the same law the old `openTab` obeyed: the check is that the
     strip on the page belongs to the voice that was asked for. */
  const openVoice = async (name) => {
    await topTab("Band");
    await page.evaluate(async (n) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      let b = document.querySelector('[data-k="tab' + n + '"]');
      if (!b) {
        /* `[data-k="trayup"]` STOOD HERE AND THERE IS NO ↑ (2026-09-02).
           Paul: *"We should never need the 'up' icon because we can expand
           multiple levels of interface option."* The gutter is a tree: a
           member's row exists whenever its own tab's branch is open, and
           `__eightUp()` — fold everything — is what puts the stripe back where
           the tabs are so the tab press above can open it again. */
        if (window.__eightUp) { window.__eightUp(); await wait(250); }
        b = document.querySelector('[data-k="tab' + n + '"]');
      }
      if (b) b.click();
      await wait(250);
      /* ...AND A VOICE'S STRIP IS ITS COLUMN SHEET SINCE 2026-09-04
         (nukernel/TABLE.md wave 2c): `facet-mix` is deleted with the pane it
         switched, and `voiceMix` is seated in the column sheet the head opens
         — which `openVoice` already opens on arrival. The tap below is the
         belt: it opens the head if the arrival did not. */
      const h = document.querySelector('#pan-band [data-k="tcol|' + n + '"]');
      if (h && h.getAttribute("aria-expanded") !== "true") h.click();
    }, name);
    await page.waitForFunction((n) => {
      const s = document.querySelector("#voicemix .nu-strip .nu-sname");
      return s && s.textContent === n;
    }, name, { timeout: 5000 });
  };
  // ...AND THE SAME GESTURE FOR A BUS TAB. A plate is only on the page while
  // its tab is marked, so every check that reads `#rack` calls this first —
  // "a gate faithful to a scope that does not contain the thing" is this
  // block's own named hazard, and a `querySelector('#rack …')` that answers
  // null because the tab is shut is exactly that shape.
  // ...AND `openBus` GOES TO THE Mix TAB FIRST, 2026-08-28. The two kinds of
  // surface this gate drives are on two different top-level tabs now — a
  // voice's strip is on `Band`, a bus's plate is on `Mix` — so each opener
  // says which, rather than relying on where the check before it happened to
  // leave the page. That reliance is precisely this block's own named hazard
  // ("a gate faithful to a scope that does not contain the thing").
  /* THE TAP IS THE NAV'S NOW, 2026-09-02, AND THE SELECTOR DID NOT CHANGE.
     `[data-k="boardtab|bus|<k>"]` was the in-panel row's key and is the
     gutter row's key — "an address does not move when a row moves" — so this
     opener is word for word what it was, with the branch opened first (see
     `allTabs`). What DID change is that a tap now runs ui/eight.js's own
     `draw()` as well as ui/engineer.js's `showBoard`, which is why the wait is
     still on the PLATE rather than on the button's mark. */
  const openBus = async (key) => {
    await topTab("Mix");
    await page.evaluate((k) => {
      const b = document.querySelector('[data-k="boardtab|bus|' + k + '"]');
      if (b) b.click();
    }, key);
    await page.waitForFunction((k) => {
      const p = document.querySelector("#boardpanel #rack .nu-plate");
      return p && p.dataset.bus === k;
    }, key, { timeout: 5000 });
  };
  /* ...AND THE FIFTH CHILD, WHICH IS NOT A BUS. Paul, B11: *"One of them is
     section automation."* The grid is `PLATES.auto` now — a plate in the same
     `#rack`, keyed `boardtab|auto|auto` and answering to `data-bus="auto"` (a
     word no BUSROWS row holds, which is how a reader tells the grid from a
     stage). Everything below that walks the SERIES still walks `busTabs()`;
     this opener exists so the checks that are about the FIVE can reach the one
     that is not a bus. */
  const openAuto = async () => {
    await topTab("Mix");
    await page.evaluate(() => {
      const b = document.querySelector('[data-k="boardtab|auto|auto"]');
      if (b) b.click();
    });
    await page.waitForFunction(() => {
      const p = document.querySelector("#boardpanel #rack .nu-plate");
      return p && p.dataset.bus === "auto";
    }, null, { timeout: 5000 });
  };
  // run `fn` with each voice's strip open in turn, and leave the first open
  const perTab = async (fn) => {
    const out = [];
    const names = await voiceNames();
    for (const n of names) { await openVoice(n); out.push([n, await fn(n)]); }
    if (names[0]) await openVoice(names[0]);
    return out;
  };
  // ...and the same, per bus plate, leaving the FIRST BUS tab open so the page
  // is back where the next check expects it. (It used to leave the first VOICE
  // tab open; there is no voice tab on this board any more, and leaving the
  // page on the Band tab would strand every plate check that follows.)
  const perBus = async (fn) => {
    const out = [];
    const keys = await busTabs();
    for (const k of keys) { await openBus(k); out.push([k, await fn(k)]); }
    if (keys[0]) await openBus(keys[0]);
    return out;
  };
  {
    const tabs = await allTabs();
    const names = tabs.filter((t) => t.kind === "voice").map((t) => t.key);
    const buses = tabs.filter((t) => t.kind === "bus").map((t) => t.key);
    // the channel list from the page's OWN model — desk-doc's channelVoicesOf,
    // which is the answer the audio tier builds from (G2)
    const chans = await voiceNames();
    /* REVERSED 2026-08-28, AND THE REVERSAL IS THE WHOLE ROUND. This read:
       `ok(names.length > 0 && eq(names, chans), "the board draws ONE TAB PER
       SEATED VOICE, in desk-doc's channel order …")`. Paul: *"You were
       supposed to remove the voices from the mixing board and just put them as
       nav items in the voices themselves."* So the claim is turned round and
       pointed at the same fact from the other side: the board draws NO voice
       tab, and every voice the desk seats has a strip SOMEWHERE — on its own
       `mix` facet, which `openVoice` reaches and every per-voice check below
       walks. The ORDER claim retires with the row (a gutter's voice marks are
       ui/eight.js's own roster order, which test/shell.js owns); the
       COMPLETENESS claim is stronger than it was, because it is now measured
       against strips that have to be OPENED rather than against a row of
       buttons that might open nothing. */
    ok(!names.length,
       "THE BOARD DRAWS NO VOICE TAB — the voices left it (Paul, 2026-08-28: " +
       "\"remove the voices from the mixing board and just put them as nav " +
       "items in the voices themselves\")", JSON.stringify(names));
    const strips = await perTab(() => page.evaluate(() => {
      const s = document.querySelector("#voicemix .nu-strip");
      return s ? { name: s.querySelector(".nu-sname").textContent,
                   ch: s.dataset.ch,
                   onBoard: !!document.querySelector("#boardpanel .nu-strip") }
               : null;
    }));
    const missing = strips.filter(([n, v]) => !v || v.name !== n);
    ok(chans.length > 0 && !missing.length &&
       strips.every(([, v]) => v && !v.onBoard),
       "…and EVERY seated voice has one, inside itself: all " + chans.length +
       " of " + JSON.stringify(chans) + " draw `#voicemix .nu-strip` on their " +
       "own `mix` facet, and not one of them is on the board",
       JSON.stringify(missing));
    // ...AND THEN THE SERIES, AFTER THEM (2026-08-27, Paul: "Put the effects
    // buses and mains into special tabs AFTER the voices"). The order is the
    // signal's — genre → delay → reverb → main — and the membership is the
    // REGISTRY's: every fields.js bus carrying an `engine` tag is a stage the
    // renderers run and must have a tab (a plate you cannot reach is the one
    // thing a tab may never make), and the two GROUPS have no plate and so no
    // tab. The check is written against F.BUSES rather than against a typed
    // list so a sixth engine bus fails here the day it is added rather than
    // going quietly untabbed.
    const engineBuses = F.BUSES.filter((b) => b.engine).map((b) => b.bus);
    const missingBus = engineBuses.filter((b) => !buses.includes(b));
    const groupTab = buses.filter((b) => F.BUSES.some((x) => x.bus === b && !x.engine));
    /* REWRITTEN 2026-09-02 (slice 2e) — the fifth child. It read `…&&
       tabs.slice(names.length).every((t) => t.kind === "bus")` and its
       sentence was "the FOUR STAGES OF THE SERIES follow them, in signal
       order — one tab per engine bus the registry declares plus the main, and
       no tab for a group". Both halves of that are kept and still asserted;
       what is added is Paul's own count. B11: *"Instead of having four icons
       on top and section automation that should have been five subicons under
       the 'Mix' icon. One of them is section automation."* The row is FIVE, it
       is the four stages then the grid, and the grid is deliberately NOT a bus
       — `boardtab|auto|auto`, a kind no BUSROWS row holds — which is the
       distinction the tagged pair was built for and is what keeps the walks
       below (`busTabs`, the registry want-list) asking about stages only. */
    const kinds = tabs.map((t) => t.kind);
    ok(eq(buses, ["genre", "echo", "rev", "main"]) && !missingBus.length &&
       !groupTab.length && eq(kinds, ["bus", "bus", "bus", "bus", "auto"]),
       "…and the FIVE CHILDREN OF THE MIX ICON are the four stages of the " +
       "series in signal order — " + JSON.stringify(buses) + ", one per engine " +
       "bus the registry declares plus the main and no row for a group — then " +
       "the section-automation grid, which is not a bus and says so",
       JSON.stringify({ buses, kinds, engineBuses, missingBus, groupTab }));
    // ...AND THE PANEL STILL HOLDS EXACTLY ONE THING, which is what "one
    // tabbed space" has meant since 2026-08-27. What changed on 2026-08-28 is
    // WHICH one: it was a strip at boot (the first tab was a voice) and it is
    // a PLATE now, with `#strips` absent from the whole document.
    await openBus("genre");
    /* `marked` IS READ OFF THE GUTTER, 2026-09-02 (slice 2e). It read
       `#boardtabs button[aria-pressed="true"]` and there is no `#boardtabs`;
       the mark is the STRIPE's now, and the stripe's own law is stronger than
       the row's was — test/shell.js A6c: exactly ONE `<mark>` and one
       `aria-pressed="true"` in `#nu-tray`, and it is the deepest OPEN thing.
       So the question this line asks becomes "is the open plate the marked row
       in the nav", which is the same claim about a better-fenced surface. */
    const one = await page.evaluate(() => ({
      panels: document.querySelectorAll("#boardpanel > *").length,
      strips: document.querySelectorAll("#boardpanel .nu-strip").length,
      anyStripsId: document.querySelectorAll("#strips").length,
      plates: document.querySelectorAll("#boardpanel #rack .nu-plate").length,
      oldRow: document.querySelectorAll("#boardtabs").length,
      marked: [...document.querySelectorAll('#nu-tray [aria-pressed="true"]')]
        .map((b) => b.dataset.k),
      shown: (document.querySelector("#boardpanel .nu-busname") || {}).textContent }));
    ok(one.panels === 1 && one.plates === 1 && one.strips === 0 &&
       one.anyStripsId === 0 && one.oldRow === 0 &&
       one.marked.length === 1 && one.marked[0] === "boardtab|bus|genre",
       "…and ONE PANEL HOLDS EXACTLY ONE PLATE at a time — the marked row's " +
       "(" + one.shown + "), with no strip on the board beside it, no " +
       "`#strips` node anywhere on the page, and no in-panel tab row left " +
       "(Paul, B11: \"five subicons under the 'Mix' icon\")", JSON.stringify(one));
    /* ...AND IT IS FIVE NOW, NOT FOUR. Paul, B11: *"Instead of having four
       icons on top and section automation that should have been five subicons
       under the 'Mix' icon. One of them is section automation."* The walk was
       `perBus` — the four stages — and the automation grid was not a tab at
       all: it was appended to the board's HOST and stood under whichever plate
       was open. It is `PLATES.auto` now, so the claim covers all five children
       the nav offers, the auto plate included, and the marked row is checked
       against the child's own key rather than against `boardtab|bus|…` (the
       fifth is `boardtab|auto|auto`, which is what made the pair a tagged one
       in the first place). */
    const readOpen = () => page.evaluate(() => ({
      plates: [...document.querySelectorAll("#boardpanel #rack .nu-plate")]
        .map((p) => p.dataset.bus),
      strips: document.querySelectorAll("#boardpanel .nu-strip").length,
      marked: [...document.querySelectorAll('#nu-tray [aria-pressed="true"]')]
        .map((b) => b.dataset.k) }));
    const openedPlates = [];
    for (const t of await allTabs()) {
      if (t.kind === "auto") await openAuto(); else await openBus(t.key);
      openedPlates.push([t.key, await readOpen(),
                         "boardtab|" + t.kind + "|" + t.key]);
    }
    await openBus("genre");
    const badPlate = openedPlates.filter(([k, m, want]) =>
      m.plates.length !== 1 || m.plates[0] !== k || m.strips !== 0 ||
      m.marked.length !== 1 || m.marked[0] !== want);
    ok(openedPlates.length === 5 && !badPlate.length,
       "…and each of the FIVE children of the Mix icon opens ITS OWN plate " +
       "into the same panel, alone and marked in the stripe — the four stages " +
       "of the series and the section-automation grid",
       JSON.stringify(badPlate));
  }

  /* ---- 1 · the count, page-wide ---- */
  /* THIS GATE IS ABOUT THE BOARD AND THE ATLAS, AND IT SAYS SO NOW. It read
     `document.querySelectorAll("select")` — the WHOLE page — and asserted the
     count was zero. That was true for sixteen hours and it is a reversal
     written down rather than deleted, because both sentences behind it are
     Paul's and neither was a mistake:

       2026-08-24, morning — "the options for each instrument in a song section
       are now just one thing in a dropdown. That's not effective. sheets of
       organized options should light up", and "get rid of the era select boxes,
       the look at select box, the 'nearby' select box, the genre list, etc."
       2026-08-24, evening — "We can return some things to select menus: meter /
       reading speed / swing / key / mode / the changes / chord quality can be
       selects inside the 'the changes' table … in the band 'form' section --
       return to dropdowns/select … in voices -- plays, material, instrument --
       dropdowns/selects."

     The morning sentence is about the DEVELOPMENT WORDS and about NAVIGATION
     chrome; the evening one is about SETTLED PARAMETERS. #app now holds both
     kinds and the count of menus there is not this gate's fact to hold —
     test/selects.js owns which controls are menus and test/sheets.js owns that
     no development word is one. One owner per fact.

     WHAT IS STILL THIS GATE'S, AND IS UNCHANGED BY THE EVENING: the BOARD has
     no menu (its twenty-three became ranges and sheets, and a console column is
     40px wide) and the ATLAS has none (all three navigation menus were DELETED,
     not hidden — ERAS survives as the word in #atlasSay, VIEWS as internal
     fly-to data behind arcFor(), and the accessible path moved onto the globe's
     own place marks, <g role="button" tabindex aria-label="Kingston 1969,
     reggae">, reachable on either hemisphere; test/atlas.js G11 holds that,
     focus() plus Enter writing byte-identical bytes to a pointer tap). So the
     probe is therefore EVERYTHING OUTSIDE #app, which is exactly the board,
     the atlas and the transport bar — stronger than naming the two container
     ids, because a menu that appears somewhere new outside #app is caught by
     the same line rather than by nobody. */
  /* ...AND THEN THE EVENING SENTENCE CAUGHT UP WITH THE BOARD TOO, 2026-08-25,
     WHICH IS A REVERSAL REWRITTEN AND NOT RELAXED. This asserted a flat zero:

         ok(sel.length === 0, "no <select> on the board or in the atlas")

     Paul, since: *"There are still many boxes that should be selects"*, and
     the rule that settled out of it is one line — A SINGLE-CHOICE CONTROL IS A
     `<select>`. The master's seven and the three buses' eight are single
     choices about the whole record, so `sheetRow` routes them through
     ui/selects.js like every other settled parameter and there are fifteen
     menus on the board again. Measured 2026-08-25: 15, every one carrying
     `data-sel`, every one in `#board` and NOT ONE in `#boardtbl`.

     THE FINDING THIS GATE WAS BUILT ON IS UNTOUCHED BY THAT AND IS WHAT IS
     ASSERTED NOW. The twenty-three were per-INSTRUMENT — "place" and three
     sends on each channel — and Paul's objection was to per-instrument options
     in dropdowns. Those are still knobs in a 92px column (check 2 sweeps every
     one of them). So the two claims left are the two that were ever the point:
     the CHANNEL STRIP has no menu at all, and the ATLAS has none — its three
     navigation menus were deleted outright ("get rid of the era select boxes,
     the look at select box, the 'nearby' select box, the genre list, etc."),
     the accessible path is the globe's own place marks, and test/atlas.js G11
     holds that. Anything else outside `#app` must be one of the fifteen, drawn
     by ui/selects.js — a hand-rolled <select> appearing somewhere new out here
     is still caught by the same line. */
  /* ...AND THEN THE BOARD GREW THE REST OF THE DESK, 2026-08-25, WHICH MOVES
     WHERE THIS PROBE HAS TO LOOK — a third rewrite of the same claim, and the
     claim itself is untouched. Paul: *"master and the buses should also be
     arranged like the mixing board no?"*, so the buses and the main are COLUMNS
     in `#boardtbl` now, and their fourteen menus are inside the table that this
     check used to say had none. `!!s.closest("#boardtbl")` would call every one
     of them a violation.

     THE FINDING WAS NEVER ABOUT THE TABLE. It was about a CHANNEL: "the options
     for each instrument in a song section are now just one thing in a
     dropdown". A bus's name and the master's glue are not per-instrument — they
     are one choice about the whole record, which is the evening sentence's
     territory and a `<select>` by that rule. So the probe reads the COLUMN KIND
     the board stamps on every cell (`data-col`: ch / bus / main) and the claim
     becomes exactly the sentence Paul typed: no menu in a channel column. */
  /* ...AND THEN THE INSERT SEATS ARRIVED, 2026-08-27, WHICH REVERSES THE
     FIRST CLAIM BY NAME AND KEEPS ITS LAW. "NOT ONE DROPDOWN ON THE CHANNEL
     STRIP" held from the day the twenty-three per-instrument menus became
     knobs until Paul asked the one per-instrument menu a console genuinely
     has back: *"Add per voice effects, up to three"* — an insert SEAT is a
     single choice from a set of names (which pedal sits here), which is
     exactly the evening-of-2026-08-24 rule for a <select>. So a strip now
     carries EXACTLY MAX_FX seat menus, keyed `ins|<voice>|<n>`, and NOTHING
     ELSE: the sends, the EQ and the fader are vertical sliders, pan is a
     detent row, and a second kind of menu appearing on a strip still fails
     here by existing. */
  // GATHERED ACROSS THE WHOLE TAB ROW SINCE 2026-08-27 (the board tabs), and
  // the reason is this block's own named hazard: the master's and the buses'
  // menus live on plates that are only on the page while their tab is marked,
  // so a single sweep with one tab open would have found none of them and
  // called the page clean. The union of one sweep per bus tab is the same set
  // the flat page used to hand over.
  // ...AND THE INSERT SEATS LEFT THIS SWEEP'S SCOPE ON 2026-08-28, WITHOUT
  // LEAVING THE GATE. The probe is "every <select> OUTSIDE #app", which was
  // exactly the board, the atlas and the transport bar; the strips are inside
  // #app now (they are inside the voices), so the three `ins|…` seats per
  // voice are no longer out here. They did not stop being checked: the
  // `perStripMenus` walk below reads each strip DIRECTLY and asserts both
  // halves — exactly MAX_FX seats, and no other kind of menu — which is
  // stronger than a container filter and is where the claim always lived.
  // (test/sheets.js check 1 carries the other half of the move: a hand-rolled
  // seat inside #app is named there, dated, rather than counted as rogue.)
  // ...AND A MENU STOPPED BEING A `<select>` ON 2026-09-02 (wave 4). Paul:
  // *"The combo boxes just don't work and are confusing. I was expecting more
  // of onfocus show custom dropdown then filter based on input — one line
  // instead of two."* ui/selects.js draws an `<input role=combobox>` now, at
  // the same `data-sel` / `data-k` addresses, and the insert seats
  // (ui/engineer.js `seatSelect`) are still hand-rolled `<select>`s. A sweep
  // that named only the tag therefore found NOTHING outside #app and `notRack`
  // below passed on an empty list — a vacuous pass, which is the one result a
  // gate must never give. Both spellings are swept, and the tag is no longer
  // what makes something a menu: `[data-sel]` is.
  const sweepSelects = () => page.evaluate(() =>
    [...document.querySelectorAll("select, [role=combobox][data-sel]")]
      .filter((s) => !s.closest("#app"))
      .map((s) => ({ k: s.dataset.k || s.id || s.getAttribute("aria-label") || "?",
                     sel: s.dataset.sel || null,
                     /* A SEAT, EITHER SPELLING (2026-09-03). `ins|<voice>|<n>`
                        is a strip's; `bus|<bus>|fx<n>` is the genre bus's, and
                        it is the SAME control drawn by the same function for
                        the same reason — ui/engineer.js `slotEl` with a second
                        owner. It is a raw <select> like its twin rather than a
                        ui/selects.js combo, which is what this filter has to be
                        told. */
                     seat: /^ins\|/.test(s.dataset.k || "") ||
                           /^bus\|[a-z]+\|fx[123]$/.test(s.dataset.k || ""),
                     strip: !!s.closest(".nu-strip"),
                     produce: !!s.closest("#produce") })));
  const sel = (await sweepSelects())
    .concat(...(await perBus(sweepSelects)).map(([, v]) => v));
  // REWRITTEN 2026-08-27 (the tabs) AND RE-AIMED 2026-08-28 (the voices): this
  // counted `stripCount * MAX_FX` seats over every strip on the page, then
  // per board tab, and now per VOICE. The CLAIM is per voice and always was,
  // so it is asked per voice — every voice's `mix` facet is opened and its
  // strip is examined. A stray menu on ANY voice's strip fails, not just on
  // the one that happens to be open at mount.
  const perStripMenus = await perTab(() => page.evaluate(() => {
    const strip = document.querySelector("#voicemix .nu-strip");
    // both spellings, for the reason written at `sweepSelects` above
    const all = [...strip.querySelectorAll("select, [role=combobox][data-sel]")];
    return { seats: all.filter((x) => /^ins\|/.test(x.dataset.k || ""))
               .map((x) => x.dataset.k),
             stray: all.filter((x) => !/^ins\|/.test(x.dataset.k || ""))
               .map((x) => x.dataset.k || x.getAttribute("aria-label") || "?") };
  }));
  const strayOnStrip = perStripMenus.filter(([, m]) => m.stray.length);
  ok(strayOnStrip.length === 0,
     "the ONLY menu on a strip is an insert seat — sends, EQ and the fader " +
     "are vertical sliders and pan is a detent row (the 2026-08-24 finding, " +
     "kept under the 2026-08-27 reversal), on ALL " + perStripMenus.length +
     " voices' strips — and this is the one place that claim is measured now " +
     "that a strip is inside #app", JSON.stringify(strayOnStrip));
  const shortSeats = perStripMenus.filter(([n, m]) => m.seats.length !== F.MAX_FX ||
    !m.seats.every((k, i) => k === "ins|" + n + "|" + (i + 1)));
  ok(!shortSeats.length,
     "every one of the " + perStripMenus.length + " voices' strips carries " +
     "EXACTLY " + F.MAX_FX + " insert seats, keyed `ins|<voice>|<n>` (Paul " +
     "2026-08-27: \"Add per voice effects, up to three\")",
     JSON.stringify(shortSeats));
  // every OTHER select outside #app is the rack's or the main's, drawn by
  // ui/selects.js (`master|`/`bus|` from selectEl, `master.fx` from sheet()) —
  // the atlas's navigation menus are still deleted outright (test/atlas.js).
  // …AND, SINCE 2026-08-27, THE PRODUCER'S. The page reordered — "producer
  // last to say, score last to see" (FUTURE.md) — and the producer's section
  // left #app for its own host, #produce, between the board and the score
  // deck. Its taps (`prod.verb` and kin) were lawful selects the day before
  // the move and did not change by moving; what changed is that this probe's
  // "outside #app" now sees them. So a `prod.*` select is allowed EXACTLY
  // when it sits inside #produce — a producer menu loose anywhere else on the
  // page, or a stranger's menu inside #produce, still fails by existing.
  const notRack = sel.filter((s) => !s.seat &&
    !/^(master[|.]|bus\|)/.test(s.sel || "") &&
    !(s.produce && /^prod\./.test(s.sel || "")));
  ok(notRack.length === 0 && sel.length > 0,
     "…and every other menu outside #app (" + sel.length + " swept, either " +
     "spelling) is one of the rack's own or the producer's own inside " +
     "#produce (the 2026-08-27 reorder), drawn by ui/selects.js",
     JSON.stringify(notRack.map((s) => s.k)));

  /* ---- 2 · every word the board used to offer is still reachable ----
     Not "a knob exists" — the knob is DRIVEN across its whole travel and the
     word it prints at every stop is collected, because a range with the wrong
     max silently hides its last detent and would pass any check that only
     counted controls. */
  // THE ROW OF KNOBS CHANGED WITH THE SERIES, 2026-08-27, and the sweep sweeps
  // what a strip now carries. It read "5 knobs (level + place + the three
  // sends, one pot each)"; the one-board round (Paul: "Have one bus for genre
  // specific effects, into a delay bus, into reverb, into main. Each
  // instrument can send post effects mix to all of the four buses") redrew a
  // strip's send row as GENRE · DELAY · REVERB · MAIN, of which two are live
  // (`echo`/`rev`, today's u.del/u.rev) and two are refused with reasons —
  // check G12 holds the refusals. `lvl` left the SURFACE (one gain lane per
  // strip, FUTURE.md — the fader; the word still loads and still resolves),
  // `room`/`aux` left with the group plates (the reversal is written at the
  // rack), and `place` became a detent-button row named `pan` (§5 rename
  // table). So the sweep is the two live sends, driven stop by stop exactly
  // as before, and the pan row is checked as buttons.
  const TBL = { rev: { table: F.SENDS, labels: F.SENDLABEL },
                echo: { table: F.SENDS, labels: F.SENDLABEL } };
  // PER VOICE SINCE 2026-08-27 — the sweep visits every voice's strip, so a
  // slider with the wrong max on the fourth voice is still the failure it was
  // when all four strips stood on the page at once. It walked BOARD tabs until
  // 2026-08-28 and walks the voices' own `mix` facets now; same set, same
  // claim, one indirection fewer.
  const sweptPer = await perTab(() => page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('#voicemix .nu-strip input[type=range]')) {
      const m = /^b\|(rev|echo)\|(.+)$/.exec(el.dataset.k || "");
      if (!m) continue;
      const keep = el.value, words = [];
      for (let i = +el.min; i <= +el.max; i++) {
        el.value = String(i);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        words.push(el.getAttribute("aria-valuetext"));
      }
      el.value = keep;                       // put it back; never fire `change`
      el.dispatchEvent(new Event("input", { bubbles: true }));
      out[m[1] + "|" + m[2]] = words;
    }
    return out;
  }));
  const swept = Object.assign({}, ...sweptPer.map(([, o]) => o));
  const chansOnPage = await perTab(() => page.evaluate(() =>
    document.querySelector("#voicemix .nu-strip").dataset.ch))
    .then((rows) => rows.map(([, ch]) => ch));
  ok(Object.keys(swept).length === chansOnPage.length * 2,
     chansOnPage.length + " strips × 2 live sends = " + Object.keys(swept).length +
     " (delay + reverb; genre and main are refused, G12)",
     JSON.stringify(chansOnPage));
  const missing = [], crooked = [];
  for (const [k, words] of Object.entries(swept)) {
    const field = k.split("|")[0], T = TBL[field];
    const want = Object.keys(T.table).map((x) => T.labels[x] || x);
    for (const w of want) if (!words.includes(w)) missing.push(k + " has no " + w);
    // one word for absence everywhere (Paul, 2026-08-26), and one word for
    // this gate to look for — the gate drives controls by their printed word.
    if (!words.includes("default")) missing.push(k + " has no empty detent");
    const back = {};
    for (const x of Object.keys(T.table)) back[T.labels[x] || x] = T.table[x];
    back["default"] = F.resolvePartMix({})[field === "echo" ? "del" : field];
    const ns = words.map((w) => back[w]);
    for (let i = 1; i < ns.length; i++)
      if (!(ns[i] >= ns[i - 1])) crooked.push(k + ": " + words.join(" ") +
        " -> " + ns.join(" "));
  }
  ok(!missing.length, "every word a send offers is on the slider",
     missing.join("; "));
  ok(!crooked.length, "…and every slider runs in fields.js's own numeric " +
     "order, with the blank detent AT its own number", crooked.join("; "));
  // THE PAN ROW: five detents, every PANS word a button, tapping the pressed
  // one clears the key (absent is the only spelling of a default — with
  // buttons there is no other way to spell it).
  const pans = (await perTab(() => page.evaluate(() => {
    const s = document.querySelector("#voicemix .nu-strip");
    return { ch: s.dataset.ch,
             n: s.querySelectorAll(".nu-panbtn").length,
             labels: [...s.querySelectorAll(".nu-panbtn")]
               .map((b) => b.getAttribute("aria-label")) };
  }))).map(([, x]) => x);
  const wantPan = Object.keys(F.PANS).map((k) => F.PANLABEL[k] || k);
  const badPan = pans.filter((p) => p.n !== wantPan.length ||
    !wantPan.every((w) => p.labels.some((l) => l && l.endsWith(w))));
  ok(!badPan.length,
     "every strip's pan is " + wantPan.length + " detent buttons wearing " +
     "PANLABEL's own words", JSON.stringify(badPan));

  /* ---- 3 · the master's fifteen are drawn ONCE, at the master end ----
     WAS: "the master's fifteen are SHEETS, once, not per channel", reading
     `fieldset.nu-sheet[data-sheet^=master|]` and its `.nu-opt` rows. Since
     2026-08-25 they are `<select>`s (see check 1 for the sentence that moved
     them), so that query matched nothing and the gate reported all fifteen
     "gone" while all fifteen were on the page.

     THE CLAIM WAS NEVER ABOUT THE WIDGET AND IS NOT NOW. It is about WHERE and
     HOW MANY: there is one drive, one glue, one reverb room and one echo time
     for the whole record — fields.js MASTER and BUSES have always said so by
     being per-bus rather than per-part — so each is drawn ONCE, at the master
     end, and never once per channel. Read through whichever widget, so this
     survives the next time the router changes its mind. */
  // PER BUS TAB SINCE 2026-08-27 (the board tabs): a plate is on the page only
  // while its own tab is marked, so this sweep runs once per tab and the
  // results are merged. The CLAIM is unchanged and is still about WHERE and
  // HOW MANY — one drive, one glue, one reverb room, one echo time for the
  // whole record, each drawn ONCE at the master end and never once per
  // channel. A key drawn on two different plates now shows up as a duplicate
  // in `drawnRack` below, which it could not have done when the rack was one
  // flat block.
  const sheetsPer = await perBus(() => page.evaluate(() => {
    const out = {};
    // THE TWO RETURNS ARE POTS — vertical sliders since 2026-08-27, driven
    // across their whole travel with the word collected at every stop, so a
    // range with the wrong max fails here exactly as a short menu would.
    for (const r of document.querySelectorAll('#rack input[type=range]')) {
      const k = r.dataset.k || "";
      if (!/^bus\|/.test(k) || r.disabled) continue;
      const keep = r.value, words = [];
      for (let i = +r.min; i <= +r.max; i++) {
        r.value = String(i);
        r.dispatchEvent(new Event("input", { bubbles: true }));
        words.push(r.getAttribute("aria-valuetext"));
      }
      r.value = keep; r.dispatchEvent(new Event("input", { bubbles: true }));
      out[k] = words;
    }
    // ...AND THE SETTLED SINGLE CHOICES AS MENUS, exactly as before the
    // geometry changed: an <option>'s `data-v` is ui/selects.js's own word.
    for (const s2 of document.querySelectorAll("[data-sel]")) {
      if (!/^(master|bus)\|/.test(s2.dataset.sel)) continue;
      out[s2.dataset.sel] = window.__combo.words(s2).map((o) => o.v);
    }
    return out;
  }));
  const sheets = Object.assign({}, ...sheetsPer.map(([, o]) => o));
  // THE WANT LIST NAMES WHAT THE RACK DRAWS, AND THE RACK IS THE SERIES,
  // 2026-08-27. This walked every F.BUSES row's every knob — four buses, the
  // groups' `name`/`to` included — while the board drew four bus strips. The
  // one-board round retired the group PLATES on Paul's word ("Have one bus
  // for genre specific effects, into a delay bus, into reverb, into main" —
  // the groups are not in the line), so the rack draws bus 1 and bus 2's
  // knobs and the master's seven, and the groups' knobs are asserted ABSENT
  // below rather than present: their facts still load and still route
  // (G14's model half), and a knob may not point at a stage the board does
  // not draw.
  const drawnRack = [].concat(...(await perBus(() => page.evaluate(() =>
    [...document.querySelectorAll('[data-sel], fieldset.nu-sheet, ' +
      '#rack input[type=range]')]
      .map((n2) => n2.dataset.sel || n2.dataset.sheet || n2.dataset.k)
      .filter((k) => /^(master|bus)\|/.test(k || ""))))).map(([, v]) => v));
  const want = [];
  for (const f of F.MASTER) want.push(["master|" + f.key, f.table, f.labels]);
  for (const b of F.BUSES) {
    if (!b.engine) continue;               // a group draws no plate — see above
    for (const k of b.knobs) {
      if (SLOTKNOB(k.key)) continue;       // conditional on its seat — SLOTKNOB
      want.push(["bus|" + b.bus + "|" + k.key, k.table, k.labels]);
    }
  }
  const gone = [], short = [];
  for (const [key, table, labels] of want) {
    const got = sheets[key];
    if (!got) { gone.push(key); continue; }
    // `ret` since 2026-08-27 morning; `bleed` and `level` joined the pots the
    // same day's series-bus engine round (the delay's bleed knob and the genre
    // bus's level→delay are vknob sliders like the returns, so their collected
    // words are LABELS, not keys)
    const pot = /^bus\|.+\|(ret|bleed|level)$/.test(key);
    const need = pot
      ? ["default"].concat(Object.keys(table).map((v) => (labels && labels[v]) || v))
      : [""].concat(Object.keys(table));
    for (const v of need) if (!got.includes(v)) short.push(key + " has no " + (v || "(blank)"));
  }
  ok(!gone.length, "all " + want.length + " master and engine-bus controls are " +
     "drawn on their own plate, behind their own tab — one each for the whole " +
     "record, not one per channel", gone.join(", "));
  /* THE SEATS THE WALK ABOVE SKIPPED, ASSERTED BY NAME (2026-09-03). SLOTKNOB
     takes the genre bus's twelve slot keys out of `want` because nine of them
     exist only once a seat is filled; the three SEATS do not, and a hole in a
     registry walk is only honest if what it leaves out is claimed somewhere.
     Here is where: every `fx<n>` a bus row declares is a menu on that bus's
     plate. (What the seat DOES — the wet and the face knobs it grows, the
     document it writes — is G15b, driven.) */
  {
    const wantSeats = [];
    for (const b of F.BUSES) { if (!b.engine) continue;
      for (const kn of b.knobs) if (/^fx[123]$/.test(kn.key))
        wantSeats.push("bus|" + b.bus + "|" + kn.key); }
    const seatsDrawn = [].concat(...(await perBus(() => page.evaluate(() =>
      [...document.querySelectorAll("#rack select[data-k]")]
        .map((n2) => n2.dataset.k)
        .filter((k) => /^bus\|[a-z]+\|fx[123]$/.test(k || ""))))).map(([, v]) => v));
    const missSeat = wantSeats.filter((k) => seatsDrawn.indexOf(k) < 0);
    ok(wantSeats.length > 0 && !missSeat.length,
       "…and every effect SEAT the registry declares is a menu on its bus's " +
       "plate (" + wantSeats.length + " of them) — the three slot knobs behind " +
       "each are conditional on it and are G15b's, driven",
       JSON.stringify(missSeat));
  }
  const wantKeys = new Set(want.map((w) => w[0]));
  const inReg = drawnRack.filter((k) => wantKeys.has(k));
  const extra = drawnRack.filter((k) => !wantKeys.has(k));
  const dupes = inReg.filter((k, i) => inReg.indexOf(k) !== i);
  ok(inReg.length === want.length && !dupes.length,
     "…and drawn ONCE each: " + inReg.length + " controls for " + want.length +
     " rows, no duplicates", JSON.stringify(dupes.length ? dupes : drawnRack));
  ok(!extra.length,
     "…and no control on a plate names a row the rack does not draw — the " +
     "groups' `name`/`to` knobs left with their plates (the refused sliders " +
     "wear the `x|` namespace precisely so this walk cannot mistake them for " +
     "registry rows): " + JSON.stringify(extra));
  ok(!short.length, "…and every option each one offers is its fields.js table's own",
     short.join("; "));
  const perChannelSheet = Object.keys(sheets).filter((k) =>
    chansOnPage.some((c) => k.endsWith("|" + c)));
  ok(!perChannelSheet.length, "no master control is drawn per channel",
     perChannelSheet.join(", "));

  /* ---- 4 · the numbers it draws are still the desk's ----
     REWRITTEN 2026-08-27 WITH THE METERS' HONESTY, and the turn is the wave's
     own law: NEVER FAKE A MEASUREMENT. The old board drew a <meter> per
     channel filled from deskChannelBase().gain — the MODEL — and this check
     compared the fill to the model. Under Enamel, green means MEASURED
     (engine truth), and the engine has ONE tap: every voice sums into shared
     buses (render-core.js), so there is no per-channel signal to measure.
     The strips therefore draw the model's number as a dim LABELLED readout
     ("model −X.X dB", .nu-drive) beside a REFUSED meter well, and the one
     green meter on the board is the MAIN strip's, fed from audio/live.js
     rmsNow — the master tap the crackle monitor already reads. The CLAIM
     this check makes is unchanged: the number on the strip is the desk's,
     computed here off the same shipped record, never the board's own
     arithmetic. */
  const box = pushBoxes(clone(TERMS))[0];
  const drawn = Object.assign({}, ...(await perTab(() => page.evaluate(() => {
    const out = {};
    for (const s of document.querySelectorAll("#voicemix .nu-strip")) {
      const drive = s.querySelector(".nu-drive");
      const fadeIn = s.querySelector('input[data-k^="b|fader|"]');
      const fadeOut = fadeIn && fadeIn.closest(".nu-vs").querySelector("output");
      /* THE STRIP'S METER WELL IS MEASURED, 2026-09-02 (slice 2e). It read
         `.nu-vs.is-off input[aria-label$='meter (refused)']` and asserted the
         refusal was drawn and sentenced — METER_WHY, "one master tap … a green
         bar here would be a fake measurement". The engine grew the tap the
         refusal's own words implied (engine/faust/live/live.js `samplerOf` →
         `voiceRms`, and the bar audit for the Faust lane), so the well is a
         real one now: a `.nu-meterwell[data-live="meter"]` with a
         `.nu-meterbar` in it, captioned with what the number IS. The refusal
         is DELETED rather than kept — "a refusal that has been kept is not a
         refusal" — and this line asks the opposite question. */
      const well = s.querySelector('.nu-meterwell[data-live="meter"]');
      out[s.dataset.ch] = { drive: drive && drive.textContent,
        off: fadeOut && fadeOut.textContent,
        stillRefused: !!s.querySelector("input[aria-label$='meter (refused)']"),
        meterMeasured: !!(well && well.querySelector(".nu-meterbar") &&
                          /rms|not yet measured/.test(well.title || "")) };
    }
    return out;
  }))).map(([, o]) => o));
  const wrongDrive = [], wrongOff = [], fakeMeter = [];
  for (const key of Object.keys(drawn)) {
    const g = deskChannelBase(box, key).gain;
    const wantDb = (g2 => (g2 > 0 ? "+" : "") + g2.toFixed(1))(
      +(20 * Math.log10(Math.max(1e-4, g))).toFixed(1));
    if (drawn[key].drive !== "model " + wantDb + " dB")
      wrongDrive.push(key + ": drew \"" + drawn[key].drive + "\", desk says " + wantDb);
    if (drawn[key].off !== "0.0") wrongOff.push(key + ": " + drawn[key].off);
    if (!drawn[key].meterMeasured || drawn[key].stillRefused) fakeMeter.push(key);
  }
  ok(Object.keys(drawn).length === chansOnPage.length,
     "every strip draws the model readout and the offset",
     JSON.stringify(Object.keys(drawn)));
  ok(!wrongDrive.length, "every strip's dim readout is deskChannelBase().gain " +
     "in dB, labelled `model` — the desk's number, not the board's arithmetic",
     wrongDrive.join("; "));
  ok(!wrongOff.length, "…and the number beside the fader is the stored offset, " +
     "0.0 dB on a record whose voices carry no desk", wrongOff.join("; "));
  /* REVERSED 2026-09-02 (slice 2e). It read: "…and every strip's meter well is
     REFUSED with its reason — no green bar without a measurement behind it",
     and the second clause is the law, unchanged and still enforced. What
     changed is that there IS a measurement behind it. Paul, B11: *"Light up
     which instrument is playing, make a little volume meter INSIDE the
     heading."* The well is measured now, on the strip and in every column head
     of the automation plate, off nukernel/audio/live.js `voiceLevels()` — and
     the honesty rule moved INTO the well rather than being dropped: a chair
     with no tap and no audit draws NO BAR and says "not yet measured — plays
     first", because 0 is a claim of silence about a voice nobody measured.
     test/meter-reach.browser.js proves the number itself on rendered sound;
     this asks that the strip is wired to it and that the old refusal is gone
     rather than left standing beside its own replacement. */
  ok(!fakeMeter.length, "…and every strip's meter well is MEASURED and " +
     "captioned with what the number is — the per-voice tap the engine grew " +
     "(voiceRms / the bar audit), with the refusal it replaces deleted rather " +
     "than kept beside it", fakeMeter.join(", "));
  /* ===== ONE METER, THEN MANY — REWRITTEN 2026-09-02 (slice 2e) ==========
     WHAT STOOD HERE, and both halves are kept because both were true of the
     board they measured:

       2026-08-27: "THE MAIN TAB IS OPENED FIRST: the one green meter lives on
       the main plate, and a plate is on the page only while its tab is
       marked. The claim is unchanged — ONE measured meter on the whole page —
       and it is asked with the main open (where the meter must be) and again
       with a VOICE'S MIX FACET open (where nothing may grow one)."
       2026-08-28: "SO IT IS ASKED OF THE STRIP ITSELF: no measured meter
       inside `#voicemix`, which is the claim the old count was reaching for
       ('never fake a measurement' — the engine has ONE tap and a per-channel
       bar would be a green bar with nothing behind it)."
     The assertion was `greenMeters.main === 1 && greenMeters.all === 1 &&
     greenNow.all === 1 && greenNow.onStrip === 0 && greenNow.refusedWells === 1`.

     THE COUNT WAS NEVER THE CLAIM — the ENGINE'S ONE TAP WAS, and the engine
     has more than one now. Paul, B11: *"Light up which instrument is playing,
     make a little volume meter INSIDE the heading."* Slice 0b gave every
     sampled unit its own AnalyserNode and read the bar audit for the Faust
     lane; `voiceLevels()` joins both to chair keys. So "exactly one
     `.nu-meterbar`" becomes ONE PER COLUMN HEAD PLUS THE MASTER, EACH
     MEASURED — and the durable half of the old line is kept and made explicit:
     every bar on the page must be somewhere a real number reaches it, which
     is now three places and not one. A bar anywhere else is still the fake
     measurement the 2026-08-27 sentence forbade. */
  await openBus("main");
  const greenMeters = await page.evaluate(() => ({
    main: document.querySelectorAll("#rack .nu-plate[data-bus='main'] .nu-meterbar").length,
  }));
  await openAuto();
  const chansForHeads = await voiceNames();
  const heads = await page.evaluate(() => {
    const th = [...document.querySelectorAll("#trimgrid thead th")];
    const w = [...document.querySelectorAll("#trimgrid thead th .nu-meterbar")];
    return { cols: th.length - 1, bars: w.length,
             declared: [...document.querySelectorAll("#trimgrid thead th .nu-meterwell")]
               .filter((n) => n.dataset.live === "meter").length,
             captioned: [...document.querySelectorAll("#trimgrid thead th .nu-meterwell")]
               .filter((n) => /rms|not yet measured/.test(n.title || "")).length,
             named: th.slice(1).map((h) => {
               const b = h.querySelector("button[data-k^='col|']");
               return b ? { k: b.dataset.k,
                            instr: (b.querySelector(".nu-colinstr") || {}).textContent,
                            name: (b.querySelector(".nu-colname") || {}).textContent }
                        : null; }) };
  });
  ok(heads.cols === chansForHeads.length && heads.bars === heads.cols &&
     heads.declared === heads.cols && heads.captioned === heads.cols,
     "ONE MEASURED METER PER COLUMN HEAD on the automation plate — " +
     heads.bars + " bars for " + heads.cols + " channels, each in a " +
     "`.nu-meterwell[data-live=\"meter\"]` that says what its number is " +
     "(Paul: \"make a little volume meter INSIDE the heading\")",
     JSON.stringify(heads));
  const unnamed = heads.named.filter((h) => !h || !h.name || !h.instr);
  ok(!unnamed.length,
     "…and every column head NAMES AN INSTRUMENT AND A PLAYER, in a button " +
     "that opens that player (Paul: \"the columns should list the instrument " +
     "and when I click on the column head let me edit the instrument!\"): " +
     JSON.stringify(heads.named.map((h) => h && (h.instr + " / " + h.name))),
     JSON.stringify(unnamed));
  await openVoice((await voiceNames())[0]);
  const greenNow = await page.evaluate(() => {
    const bars = [...document.querySelectorAll(".nu-meterbar")];
    const home = (n) => n.closest("#voicemix") ? "strip"
      : n.closest(".nu-plate[data-bus='main']") ? "master"
      : n.closest("#trimgrid thead") ? "head" : "STRAY";
    return { all: bars.length, onStrip: document.querySelectorAll("#voicemix .nu-meterbar").length,
             refusedWells: document.querySelectorAll(
               "#voicemix .nu-vs.is-off input[aria-label$='meter (refused)']").length,
             strays: bars.map(home).filter((h) => h === "STRAY").length,
             where: bars.map(home) };
  });
  ok(greenMeters.main === 1 && greenNow.onStrip === 1 &&
     greenNow.refusedWells === 0 && greenNow.strays === 0,
     "…and EVERY measured bar on the page is somewhere a real number reaches " +
     "it — the master's on the main plate, one per column head, one on the " +
     "open voice's own strip — and nowhere else; the strip's refused well is " +
     "gone rather than standing beside its replacement",
     JSON.stringify({ ...greenMeters, ...greenNow }));

  /* ---- 5 · the knob writes the document's own word, and unwrites it ---- */
  // THE CANTOR'S MIX FACET IS OPENED FIRST, 2026-08-27 and re-aimed
  // 2026-08-28: this drives `input[data-k="b|rev|cantor"]`, and that control
  // is on the page only while the cantor is the open voice AND `mix` is the
  // open facet. The cantor happens to be the first voice on the shipped chant
  // — which is exactly the accident that would let this check go on passing
  // after the default changed, so it is said rather than relied on.
  await openVoice("cantor");
  const trip = await page.evaluate(async () => {
    const drive = (word) => {
      const el = document.querySelector('input[data-k="b|rev|cantor"]');
      for (let i = +el.min; i <= +el.max; i++) {
        el.value = String(i);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        if (el.getAttribute("aria-valuetext") === word) {
          el.dispatchEvent(new Event("change", { bubbles: true })); return true; }
      }
      return false;
    };
    const wait = () => new Promise((r) => setTimeout(r, 350));
    const deskOf = () => (window.__eightDoc().voices.find((v) => v.name === "cantor") || {}).desk;
    const found = drive("wet"); await wait();
    const set = JSON.parse(JSON.stringify(deskOf() || null));
    drive("default"); await wait();
    return { found, set, back: deskOf() === undefined };
  });
  ok(trip.found && trip.set && trip.set.rev === "wet",
     "driving the cantor's reverb pot to `wet` writes voice.desk.rev = \"wet\"",
     JSON.stringify(trip.set));
  ok(trip.back === true,
     "…and driving it back to the blank detent DELETES the key — absent is the " +
     "only spelling of a default (desk-doc.js:154)");

  /* ================= G12 · THE ROUTING, END TO END =====================
     (Paul, 2026-08-25: "I should be able to use the board to send signal to the
     buses and then from the buses to the master mix too." And, in the same
     message: "Do not draw a control that reaches nothing without saying so on
     the page.")

     THIS IS THE ONE CLAIM THE BOARD MAKES THAT NOTHING ELSE CHECKED. Every
     other check here is about what a control WRITES; this one is about whether
     the wire under it exists at all, which is the difference between a desk and
     a picture of a desk. It runs against the RENDERED page and against the
     ENGINE'S OWN REPORT (`window.__nuMix()`, "the numbers the desk wrote onto
     the parent's voice units for the bar that is sounding"), never against the
     model twice.

     audio/desk.js BUS_REACH is the single answer to "does this bus reach the
     main", with the sentence for the two that do not. The page is asserted to
     agree with it BOTH WAYS: a movable bus has a live pot, an unmovable one is
     refused AND its exact words are on the page. */
  console.log("\n" + "G12 what the board's wires actually reach");
  {
    // ---- 1 · the model's answer, so the page has something to be wrong about
    const box = pushBoxes(clone(TERMS))[0];
    const feed = deskBusFeed(box, null, null);
    // TWO MOVABLE RETURNS SINCE 2026-08-27, not one. This line asserted
    // `feed.echo.movable === false` ("one of the FOUR buses reaches the main
    // with a fader this page can move, and it is bus 1") for as long as
    // state-engine fxParams emitted `dgain: 1` and read no state. fxParams
    // reads `state.delay.gain` now and BUSROWS gives echo a `ret` knob, so
    // bus 2's return is the record's own word too (FUTURE.md Phase 0).
    ok(feed.rev.movable === true && feed.echo.movable === true &&
       feed.room.movable === false && feed.aux.movable === false,
       "two of the FOUR buses reach the main with a fader this page can " +
       "move — bus 1 (`buses.rev.ret` -> state.reverb -> fx_bus rgain) and " +
       "bus 2 (`buses.echo.ret` -> state.delay.gain -> fx_bus dgain)",
       JSON.stringify(Object.fromEntries(Object.entries(feed)
         .map(([k, v]) => [k, v.movable]))));
    ok(feed.rev.feed > 0,
       "…and the shipped chant is genuinely sending into it: " +
       feed.rev.feed + " summed across the channels (gregorian's tone.verb)",
       JSON.stringify(feed.rev));

    // ---- 2 · the page draws exactly that, and says why where it cannot.
    // REWRITTEN 2026-08-27: the rack is the SERIES now — genre → delay →
    // reverb → main, four `.nu-plate`s in `#rack`, in that order (Paul: "Have
    // one bus for genre specific effects, into a delay bus, into reverb, into
    // main"). Bus 1 and bus 2 keep their live return pots (the same data-k
    // keys as the table era, `bus|rev|ret` / `bus|echo|ret`); the GENRE stage
    // and the delay→reverb BLEED were drawn REFUSED here — "the genre bus is
    // engine work — not wired", "the bleed is a constant in the DSP — not
    // wired" — and BOTH REFUSALS DIED ON 2026-08-27 (the series-bus engine
    // round): the renderers grew the genre accumulator (its chained return
    // sums into the delay bus) and fx_bus's `d*0.2` literal became the
    // `bleed` slider, so this gate now asserts the two controls LIVE, on the
    // registry's own rows. The two GROUP plates of 2026-08-26 stay asserted
    // ABSENT with the reversal printed — the groups are not in the series.
    // Their facts still load and still route: the model half of G14 holds it.
    // ...AND THE SERIES WENT INTO THE TAB ROW, 2026-08-27 (Paul: "Put the
    // effects buses and mains into special tabs after the voices -- now the
    // board is one tabbed space that is consistent and easy to understand").
    // The four plates are the same four plates — same order, same `data-bus`,
    // same controls — but one is on the page at a time, so this walks the tab
    // row instead of a flat `#rack`. The ORDER claim is now the ROW's (the
    // tabs run genre → delay → reverb → main and each opens its own plate,
    // G11 check 1 holds it) and the LIVE claim is asked with each plate's own
    // tab open. The two GROUP plates stay asserted absent — with the tabs,
    // "no plate" also means "no tab", which is the stronger sentence.
    const rackDrawn = Object.assign(
      { plates: [], groupPlates: 0 },
      ...(await perBus(() => page.evaluate(() => {
        const p = document.querySelector("#boardpanel #rack .nu-plate");
        const live = (k) => { const c = document.querySelector(
          'input[data-k="' + k + '"]'); return !!(c && !c.disabled); };
        const out = { plates: [p ? p.dataset.bus : "(none)"] };
        if (live("bus|rev|ret")) out.revLive = true;
        if (live("bus|echo|ret")) out.echoLive = true;
        if (live("bus|genre|level")) out.genreLive = true;
        if (live("bus|echo|bleed")) out.bleedLive = true;
        return out;
      }))).map(([, v]) => v));
    rackDrawn.plates = [].concat(...(await perBus(() => page.evaluate(() =>
      [...document.querySelectorAll("#boardpanel #rack .nu-plate")]
        .map((p) => p.dataset.bus)))).map(([, v]) => v));
    rackDrawn.groupTabs = (await busTabs())
      .filter((b) => b === "room" || b === "aux").length;
    rackDrawn.groupPlates = rackDrawn.plates
      .filter((b) => b === "room" || b === "aux").length;
    ok(eq(rackDrawn.plates, ["genre", "echo", "rev", "main"]),
       "the rack is four plates in series order — genre → delay → reverb → " +
       "main — one per tab, opened in the row's own order",
       JSON.stringify(rackDrawn.plates));
    // THE SERIES IS STILL LEGIBLE, which is the thing tabs put at risk and is
    // why this check exists at all: hiding a chain behind tabs is how a desk
    // becomes four unrelated boxes. Two owners of the PICTURE, and both are
    // measured. (1) THE ROW draws the chain from every tab, a voice's
    // included — the four bus tabs sit in their own `role="group"` separated
    // by literal `→` glyphs, so `the strips feed → genre fx → delay → reverb
    // → main` is readable without opening anything. (2) EACH PLATE says it
    // for itself — its header prints who feeds it (`in ← …`) and its footer
    // carries the connector that used to stand between the plates (`into the
    // delay bus`, `into the reverb bus`, `into main — the record`), so a hand
    // riding one bus can tell what it feeds without reading the row.
    /* ===== THE SERIES IS DRAWN IN THE GUTTER NOW, 2026-09-02 (slice 2e) ==
       Paul, B11: *"Instead of having four icons on top and section automation
       that should have been five subicons under the 'Mix' icon."*

       WHAT STOOD HERE read `#boardtabs .nu-busgroup` and asserted six things
       about it — `role="group"`, four `.nu-tabarrow` glyphs, the chain
       `genre fx → delay → reverb → main` joined from the buttons'
       `aria-label`s, `stages === "1234"` off the `.nu-n` badges, the
       `.nu-seamlab` reading "the voices feed", and `openKind === "rack"`. Its
       own sentence was: "THE SERIES IS DRAWN IN THE TAB ROW, in order and
       numbered, from every tab, under a label that names who feeds it." Every
       one of those six was true of a row that no longer exists.

       THE PROPERTY SURVIVES THE FURNITURE, WHICH IS WHY THIS CHECK IS
       REWRITTEN AND NOT DELETED. What it has always been for is the thing tabs
       put at risk: "hiding a chain behind tabs is how a desk becomes four
       unrelated boxes." The chain is still drawn, one level down in the
       stripe, and it is drawn BETTER — the five children stand in a column in
       signal order under the Mix icon, so the order is the reading order and
       needs no arrows to say so.

       SO THE ORDER IS ASSERTED OFF THE NAV'S OWN ROWS, in the order the nav
       paints them, with the WORDS coming off `aria-label` exactly as they did
       before (one string per row from one table — and the four bus words are
       now the fields.js registry's own labels, read by ui/eight.js
       `mixTrayItems`, which is the same law the deleted row obeyed: "a renamed
       row is renamed on the tab by existing"). The AUTOMATION child is last,
       which is where a grid belongs relative to the signal it trims.

       WHAT IS NOT RE-HOMED, said so the loss is on the record rather than
       quietly absorbed: the `.nu-seamlab` sentence "the voices feed". It was
       proposed as the automation plate's caption and refused by the text diet
       (test/text-diet.test.js — the ceiling is re-earned, not raised). The
       FACT it carried is unchanged and is still drawn twice: each plate's
       `in ←` header names who feeds it and its footer names what it feeds,
       which is the second half of this same check, immediately below. */
    const seriesRow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#nu-tray [data-k^="boardtab|"]')];
      return { keys: rows.map((b) => b.dataset.k),
               chain: rows.map((b) => (b.getAttribute("aria-label") || "").trim())
                 .join(" \u2192 "),
               words: rows.map((b) => ((b.querySelector(".nu-vh") || {}).textContent || "").trim()),
               oldRow: document.querySelectorAll("#boardtabs").length,
               openKind: (document.querySelector("#boardpanel > *") || {}).id };
    });
    ok(seriesRow && seriesRow.oldRow === 0 &&
       eq(seriesRow.keys, ["boardtab|bus|genre", "boardtab|bus|echo",
                           "boardtab|bus|rev", "boardtab|bus|main",
                           "boardtab|auto|auto"]) &&
       seriesRow.chain === "genre fx \u2192 delay \u2192 reverb \u2192 main \u2192 automation" &&
       seriesRow.openKind === "rack",
       "THE SERIES IS DRAWN IN THE GUTTER, in signal order, as the five " +
       "children of the Mix icon — genre fx \u2192 delay \u2192 reverb \u2192 main, " +
       "then the automation grid that trims them (Paul, B11: \"five subicons " +
       "under the 'Mix' icon\"): " + JSON.stringify(seriesRow && seriesRow.chain),
       JSON.stringify(seriesRow));
    const saysWhereItGoes = await perBus(() => page.evaluate(() => {
      const p = document.querySelector("#boardpanel #rack .nu-plate");
      return { in: (p.querySelector(".nu-busin") || {}).textContent || "",
               out: [...p.querySelectorAll(".nu-flow")]
                 .map((f) => f.textContent.trim()) };
    }));
    const WANT_OUT = { genre: "into the delay bus", echo: "into the reverb bus",
                       rev: "into main — the record", main: null };
    const mute = saysWhereItGoes.filter(([k, v]) =>
      !/^in ←/.test(v.in) ||
      (WANT_OUT[k] === null ? v.out.length !== 0
                            : !v.out.includes(WANT_OUT[k])));
    ok(!mute.length,
       "…and every plate says it for itself too — `in ← …` in its header and " +
       "the series connector in its footer (the three that used to stand " +
       "BETWEEN the plates, re-homed onto the plate each was describing; the " +
       "main takes none because it is the end of the line)",
       JSON.stringify(mute));
    ok(rackDrawn.revLive && rackDrawn.echoLive,
       "bus 1's and bus 2's returns are LIVE pots (the wires G4/R5 prove: " +
       "buses.rev.ret -> rgain, buses.echo.ret -> dgain)",
       JSON.stringify(rackDrawn));
    ok(rackDrawn.genreLive,
       "the genre stage is LIVE (2026-08-27 series-bus round — the refusal " +
       "\"engine work, not wired\" died with the engine work): bus|genre|level " +
       "is an enabled pot on the registry's own row", JSON.stringify(rackDrawn));
    ok(rackDrawn.bleedLive,
       "…and the delay→reverb bleed is LIVE (same round — fx_bus.dsp's " +
       "`d*0.2` literal is the `bleed` slider now): bus|echo|bleed is an " +
       "enabled pot", JSON.stringify(rackDrawn));
    // THE "PRINTED, NOT SILENT" HALF IS RETIRED, 2026-08-28. This also asked
    // that `body.includes("bus 3 and bus 4") && body.includes("draw no plate")`
    // — the groups' reversal drawn as a sentence on the board's foot. Paul:
    // *"the text below Section Automation is vast and should all be removed."*
    // A refusal-with-reason is load-bearing when a reader can reach it FROM
    // THE CONTROL it refuses; bus 3 and bus 4 have no control, so that
    // sentence was explanation about an absence and it came off the page (the
    // argument is written where the list used to be built, ui/engineer.js).
    // What the gate must still hold is the fact a save depends on, and that
    // fact was never the sentence: no plate, no tab, and the old routes still
    // load and still route — G14's model half measures the routing itself.
    ok(rackDrawn.groupPlates === 0 && rackDrawn.groupTabs === 0,
       "the two group plates are gone — no plate AND, since the board tabs, " +
       "no tab (their sends and aims still load and still route; G14's model " +
       "half measures that, and the retired sentence did not)",
       JSON.stringify({ plates: rackDrawn.plates, groupTabs: rackDrawn.groupTabs }));
    // THE MAIN TAB CARRIES THE MASTER'S WORDS, so it is opened before they are
    // looked for (2026-08-27, the board tabs).
    //
    // THE CLAIM IS REVERSED, 2026-08-28. It used to be that width, tilt and
    // ceiling "round-trip and reach no sound", so the gate held them DISABLED
    // with their reason printed. All three are wired now — audio/desk.js
    // masterState -> fx_bus mswidth / mtilt / clipl — and the last of
    // them was the round's headline: Paul, listening to the Iranian pop
    // record, *"There doesn't seem to be a way to even turn the final mix off
    // — the minimum amount of things is soft, not none."* `ceiling` was the
    // word that claimed the soft clip, and the soft clip was unconditional in
    // fx_bus master(). So the gate now asserts the opposite of what it used
    // to: every master word is LIVE, every vocabulary opens with `none`, and
    // the strip carries the one-touch bypass that writes all seven at once.
    await openBus("main");
    const master = await page.evaluate(() => {
      const out = [];
      for (const k of ["drive", "glue", "tape", "space", "width", "tilt", "ceiling"]) {
        const s2 = document.querySelector('[data-sel="master|' + k + '"]');
        out.push({ k, live: !!(s2 && !s2.disabled), why: (s2 && s2.dataset.why) || null,
                   // `.options` is a `<select>`'s; a combo box's words come
                   // off its `li[role=option]`s (test/lib-combo.js, 2026-09-02)
                   none: !!(s2 && window.__combo.words(s2)
                     .some((o) => o.v === "none")) });
      }
      const b = document.querySelector('[data-k="master|bypass"]');
      return { words: out, bypass: !!b, pressed: b && b.getAttribute("aria-pressed") };
    });
    ok(master.words.every((h) => h.live && !h.why && h.none),
       "every master word is LIVE and every vocabulary opens with `none` — " +
       "the three that used to be refused (width / tilt / ceiling) reach " +
       "fx_bus now, and no cell prints a refusal it no longer owes",
       JSON.stringify(master.words));
    ok(master.bypass && master.pressed === "false",
       "…and the main strip carries the one-touch master bypass, a VIEW over " +
       "those seven words (it writes `none` into each) rather than an eighth " +
       "stored fact — unpressed on a record that has not been bypassed",
       JSON.stringify({ bypass: master.bypass, pressed: master.pressed }));
    // PER TAB SINCE 2026-08-27: the two model lines sit on the delay and the
    // reverb plates, one of which is on the page at a time. Gathered by
    // opening each bus tab in turn, which also proves the readout is REBUILT
    // per plate rather than left behind by the tab before it.
    const modelSaid = [].concat(...(await perBus(() => page.evaluate(() =>
      [...document.querySelectorAll("#boardpanel #rack .nu-busmodel")]
        .map((m) => m.textContent)))).map(([, v]) => v));
    ok(modelSaid.length === 2 && modelSaid.every((s2) => /model · in [\d.]+/.test(s2)),
       "each engine bus plate prints the MODEL's in/out numbers, labelled as " +
       "the model — a return you cannot hear still shows what is arriving, " +
       "and nothing green fakes a measurement", JSON.stringify(modelSaid));

    // ---- 3 · A SEND ACTUALLY MOVES WHAT THE ENGINE IS HANDED.
    // Not the document, and not the model: `__nuMix()` reports the unit table
    // the parent was given for the sounding bar, which is the artifact.
    // THE VOICE'S OWN STRIP IS OPENED FIRST, 2026-08-28: this drives
    // `b|echo|<name>`, which is on the page only while that voice's `mix`
    // facet is. It reads the name and the chair key off the strip it finds,
    // exactly as it did when the strip was the board's.
    await openVoice((await voiceNames())[0]);
    const sent = await page.evaluate(async () => {
      const wait = () => new Promise((r) => setTimeout(r, 700));
      const drive = (k, word) => {
        const el = document.querySelector('input[data-k="' + k + '"]');
        if (!el) return false;
        for (let i = +el.min; i <= +el.max; i++) {
          el.value = String(i);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          if (el.getAttribute("aria-valuetext") === word) {
            el.dispatchEvent(new Event("change", { bubbles: true })); return true; }
        }
        return false;
      };
      // the open STRIP's name and chair key (the strips replaced the table's
      // header row on 2026-08-27 and moved into the voices on 2026-08-28 —
      // same facts, new home, twice)
      const name = document.querySelector('#voicemix .nu-strip .nu-sname').textContent;
      const key = document.querySelector('#voicemix .nu-strip').dataset.ch;
      // settle first so `before` is a compiled bar and not `null`
      drive("b|echo|" + name, "dry"); await wait();
      const rd = () => { const m = window.__nuMix(); if (!m) return null;
        const u = Object.values(m.units).find((x) => x.role === key) ||
                  m.units[key] || null;
        return u ? { rev: u.rev, del: u.del } : null; };
      const keys0 = window.__nuMix() ? Object.keys(window.__nuMix().units) : [];
      const before = window.__nuMix() ? Object.fromEntries(Object.entries(
        window.__nuMix().units).map(([k, u]) => [k, u.del])) : null;
      const found = drive("b|echo|" + name, "drown"); await wait();
      const after = window.__nuMix() ? Object.fromEntries(Object.entries(
        window.__nuMix().units).map(([k, u]) => [k, u.del])) : null;
      drive("b|echo|" + name, "default"); await wait();
      const back = window.__nuMix() ? Object.fromEntries(Object.entries(
        window.__nuMix().units).map(([k, u]) => [k, u.del])) : null;
      return { name, key, found, keys0, before, after, back, rd: rd() };
    });
    const moved = sent.before && sent.after &&
      Object.keys(sent.after).filter((k) => sent.after[k] !== sent.before[k]);
    ok(sent.found && moved && moved.length > 0,
       "MOVING A CHANNEL'S DELAY SEND MOVES WHAT THE ENGINE IS HANDED — " +
       JSON.stringify(moved) + " changed in __nuMix().units[].del",
       JSON.stringify({ before: sent.before, after: sent.after }));
    ok(sent.back && eq(sent.back, sent.before),
       "…and putting it back on the blank detent puts the engine's numbers " +
       "back exactly (absent is the only spelling of a default)",
       JSON.stringify({ before: sent.before, back: sent.back }));

    // ---- 4 · AND THE BUS'S OWN FADER WRITES THE RECORD'S OWN WORD, which is
    // as far as the ARTIFACT can be read today — and the reason is a finding of
    // this round rather than a gap in the check.
    //
    // `__nuMix().master` is `audio/live.js engineReport()`, and engineReport
    // reads `parentState()` — the COMPILED state, which carries plan.js's
    // deliberate `reverb: 0`. The state the stream is actually opened with is
    // `getState()`, which spreads `masterState(MASTER, BUSES)` OVER that
    // (live.js:173, and its own comment says why). So the report is blind to the
    // whole rack and the whole master strip. MEASURED on the rendered page:
    // with `buses.echo.fb = "more"` (0.62) and `tone = "bright"` (5600) in the
    // document, `__nuMix().master.echo` still answered
    // `{ ret: "1.00", fb: "0.25", tone: 2600 }` — the engine's own defaults —
    // and with `buses.rev.color = "plate"` set, `master.rev` was `{}` and
    // `stages` was `["limit"]`. The SOUND is right (getState folds it in, and G4
    // above proves the arithmetic); the REPORT is one word wrong, in a file this
    // slice does not own. Recipe left for it.
    //
    // So what is asserted here is the half that can be: the fader writes the
    // record's own word, and G4 above already carries `ret:"hall" -> reverb 0.5
    // -> rgain 1.6` on the resolver the engine uses.
    // THE REVERB TAB IS OPENED FIRST (2026-08-27, the board tabs): `bus|rev|ret`
    // is on the page only while the reverb plate is. Said rather than relied
    // on, exactly as the cantor's tab is said one check up.
    await openBus("rev");
    const ret = await page.evaluate(async () => {
      const wait = () => new Promise((r) => setTimeout(r, 700));
      const drive = (word) => {
        const el = document.querySelector('input[data-k="bus|rev|ret"]');
        if (!el) return false;
        for (let i = +el.min; i <= +el.max; i++) {
          el.value = String(i);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          if (el.getAttribute("aria-valuetext") === word) {
            el.dispatchEvent(new Event("change", { bubbles: true })); return true; }
        }
        return false;
      };
      const rd = () => { const d = window.__eightDoc();
        return JSON.parse(JSON.stringify(((d.sound || {}).buses || {}).rev || null)); };
      const words = (() => { const el = document.querySelector('input[data-k="bus|rev|ret"]');
        const keep = el.value, w = [];
        for (let i = +el.min; i <= +el.max; i++) { el.value = String(i);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          w.push(el.getAttribute("aria-valuetext")); }
        el.value = keep; el.dispatchEvent(new Event("input", { bubbles: true }));
        return w; })();
      const okWet = drive("as wet as it goes"); await wait(); const wet = rd();
      const okOff = drive("shut"); await wait(); const off = rd();
      return { words, okWet, wet, okOff, off };
    });
    ok(ret.okWet && ret.wet && ret.wet.ret === "huge",
       "BUS 1'S FADER WRITES THE RETURN — driving it to `as wet as it goes` " +
       "writes sound.buses.rev.ret = \"huge\", which masterState resolves to " +
       "state.reverb 0.625 and the parent to rgain 2 (G4 above)",
       JSON.stringify(ret));
    ok(ret.okOff && ret.off && ret.off.ret === "off",
       "…and driving it to `shut` writes `off`, which is a WORD and not an " +
       "absence — the empty detent one stop to its left is the absence, and " +
       "the two are different facts (0 by choice vs. whatever the master's " +
       "`space` bleed leaves)", JSON.stringify(ret.off));
    ok(new Set(ret.words).size === ret.words.length,
       "…and no two stops on it say the same word: " + JSON.stringify(ret.words),
       JSON.stringify(ret.words));
    console.log("  note the recipe this line used to leave was TAKEN, 2026-08-30" +
      " (the volume-census round): engineReport() reads getState() now — the" +
      " state the stream is opened with — and prints the default zita's own" +
      " return, so __nuMix().master follows the rack. The artifact-level drag" +
      " of `bus|rev|ret` against that report is test/vol-reach.browser.js V5.");

    // ---- 5 · THE LISTENING FADER IS ON THE STORE'S OWN SCALE.
    // Paul: "the 'listening' slider doesn't make much sense." It did not: it
    // was `min=0 max=1` over a 0..100 store (ui/state.js readVol, audio/live.js
    // `vol / 100`), so one touch took the monitor from 80 to 0.5 — 44 dB down —
    // and localStorage kept it. This is the check that it cannot happen again.
    // THE LISTENING FADER IS ON THE MAIN PLATE, so the main tab is opened
    // first (2026-08-27, the board tabs). It was `#vol2` on a rack that was
    // always on the page; it is the same control with the same id on the tab
    // the main now lives behind.
    await openBus("main");
    /* …AND ITS PARTNER IS A LEVEL OF THE GUTTER NOW, SO THE LEVEL IS OPENED
       TOO (2026-08-29). This check reads `#vol` — the other view of the same
       store — and until today `#vol` was in the `.nu-bar`, which was on the
       page from boot to close. Paul, 2026-08-29: *"Get rid of the play buttons
       and the title of the song"* / *"Add a permanent play button to the top
       of the nav. When I tap it the nav is taken over by play options. The
       volume slider is now vertical."* The band is deleted and `#vol` exists
       only while the gutter is standing on its `play` level, so
       `document.getElementById("vol")` answered null here and the whole check
       returned `null` — both assertions failing on an absence rather than on
       a scale.
       THE GESTURE WAS PAUL'S OWN AND THE PAGE TOOK IT AWAY — CORRECTED
       2026-08-30 (the volume-census round). This block pressed `#play` twice:
       written 2026-08-29, when pressing play dropped the stripe to the `play`
       level (where the fader is) as a side effect. v192 SPLIT the transport —
       ui/eight.js, "ONE CONTROL, ONE JOB": `#play` only starts and stops now,
       and the door to the play level is its own mark, `#playops` — so the two
       presses started and stopped the record, the stripe never moved, `#vol`
       was never on the page, and all three checks below failed on `null`
       (measured on this gate's own run, 2026-08-30: `FAIL … null` three
       times). The gesture is the person's CURRENT one — one tap on the door —
       and it starts nothing, so the silent-box promise below needs no
       start/stop dance at all; the second `#playops` tap after the read puts
       the stripe back at root, leaving the page exactly as found.
       THE PLATE STAYS UP BEHIND THE LEVEL — the gutter's level and the panel
       under it are two different facts — which is why `openBus` comes first
       and why both faders can be read in one round trip. */
    await page.evaluate(() => document.getElementById("playops").click());
    await page.waitForTimeout(500);
    const lis = await page.evaluate(async () => {
      const v2 = document.getElementById("vol2"), v1 = document.getElementById("vol");
      if (!v2 || !v1) return null;
      // `.closest(".nu-vs")` since 2026-08-27: the fader stood up (vertical
      // chassis — the input rides inside the track, the output is the wrap's),
      // so the readout is no longer a sibling of the input's parent. Same
      // control, same store, same claim. Both faders are vertical now, so both
      // are read the same way.
      const say = (el) => ((el.closest(".nu-vs") || el.parentNode)
        .querySelector("output") || {}).textContent;
      const shape = { min: v2.min, max: v2.max, step: v2.step, value: v2.value,
                      barMin: v1.min, barMax: v1.max, barStep: v1.step };
      const drive = async (el, v) => { el.value = String(v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 300));
        return localStorage.getItem("nukernel.vol.v1"); };
      /* THE GUTTER'S FADER IS DRIVEN TOO, AND IT IS DRIVEN FIRST (2026-08-29).
         The claim this check was written for is "two views over ONE store",
         and until today only one of the two views was ever touched: the scale
         halves matched, which proves they were DESIGNED alike, not that they
         OWN the same number. Now each is driven in turn and the store is read
         after each — one key, `nukernel.vol.v1`, written by both. The order
         puts the main plate's touch last so the box is left at 55 exactly as
         it was before this line was rewritten, and the checks that follow do
         not have to know this one happened. */
      const barStore = await drive(v1, 42);
      const store = await drive(v2, 55);
      return { shape, barStore, barOut: say(v1), store, out: say(v2) };
    });
    ok(lis && lis.shape.min === lis.shape.barMin && lis.shape.max === lis.shape.barMax,
       "the listening fader runs on the same 0..100 the gutter's own volume " +
       "does — two views over ONE store means one SCALE too",
       JSON.stringify(lis && lis.shape));
    ok(lis && +lis.barStore === 42 && lis.barOut === "42%",
       "…and the GUTTER's fader owns that store: a touch on `#vol` writes 42 " +
       "to nukernel.vol.v1 and prints 42%",
       JSON.stringify(lis && { barStore: lis.barStore, barOut: lis.barOut }));
    ok(lis && +lis.store === 55 && lis.out === "55%",
       "…and a touch on it writes 55 to the store and prints 55%, not 0.55",
       JSON.stringify(lis));
    // the stripe goes back up to root — the door out is the door in (v192's
    // own law: the level is entered on purpose, so it is left on purpose)
    await page.evaluate(() => document.getElementById("playops").click());
    await page.waitForTimeout(300);
    /* MEASURED AND SAID OUT LOUD, 2026-08-29: the two views share the store
       but neither REPAINTS when the other is moved (drive `#vol2` to 55 and
       `#vol` still reads 80 until it is touched). That is a fact about the
       page, not about this gate, and it is not asserted either way here — the
       store is the owner and both faders write it, which is the claim. */
    // put the board back on its first BUS tab, so the checks after this one
    // start where the page starts. (It read "its first voice tab" until
    // 2026-08-28; there is no voice tab on this board now, and leaving the
    // page parked on the Band panel would strand the next plate check.)
    await openBus((await busTabs())[0]);
  }

  /* ================= G13 · THE SPLIT, MEASURED =========================
     (Paul, 2026-08-25: "Do you want to put the bus and main into their own
     board so it's not all empty")

     THE COMPLAINT WAS A NUMBER AND SO IS THE CHECK. Measured on the rendered
     page before the split: ONE `#boardtbl` of 7 header cells and 177 cells in
     all, 99 of them EMPTY — 55.9%, and 98 of the 144 body cells, 68.1%. A
     channel's rows and a return's rows and the master's are almost disjoint
     sets, so one grid over all three kinds is mostly hole.

     WHAT IS ASSERTED IS THE PROPERTY AND NOT THE LAYOUT: each board carries
     only strips of the kinds its rows are about, and AT MOST ONE empty body
     cell survives on either. One does — the main has no name and no name is
     invented for it — and this check names it, so a second blank appearing
     anywhere is a failure with the cell printed rather than a slow slide back
     to a grid full of holes. */
  /* ================= G14 · FOUR BUSES, AND WHERE THEY GO ================
     (Paul, 2026-08-26: "Don't let me add effects to instruments. That's bus
     and board stuff. But let me have up to four buses and a way to direct them
     to each other.")

     TWO THINGS HAVE TO BE TRUE AT ONCE and only one of them is about drawing.
     A board can show four columns and a routing menu in an afternoon; what
     makes it not a picture is that MOVING THE MENU MOVES WHAT THE ENGINE IS
     HANDED. So this reads `__nuMix()` — the unit table for the sounding bar —
     the way G12 does, and it asks the question that only a GROUP can answer:
     the same send, aimed two ways, has to arrive on two different numbers.

     AND THE OTHER HALF IS AN ABSENCE, which is harder to check and is why it
     is checked on the rendered page rather than in the source: there is no
     per-voice effects control anywhere. Not disabled — absent. */
  console.log("\n" + "G14 four buses, and a way to direct them to each other");
  {
    // ---- 1 · FOUR, AND THE REGISTRY IS WHERE THE NUMBER COMES FROM
    // FIVE ROWS SINCE 2026-08-27 (series-bus round): the genre bus joined the
    // registry as a REAL engine accumulator (`engine: "genre"`), appended
    // last so the four shipped positional names hold — it is deliberately
    // absent from BUSTO (its destination is the series: level → delay).
    ok(F.BUSES.length === 5,
       "the registry declares FIVE buses: " +
       F.BUSES.map((b, i) => "bus " + (i + 1) + " " + b.label +
         " (" + (b.engine || "a group") + ")").join(", "),
       String(F.BUSES.length));
    const engines = F.BUSES.filter((b) => b.engine).map((b) => b.engine);
    ok(eq(engines, ["rev", "del", "genre"]),
       "…and exactly three of them are the engine's own accumulators (rev, " +
       "del, genre — the genre stage landed 2026-08-27; the parent's `pp` " +
       "stays unfeedable from this page)",
       JSON.stringify(engines));
    ok(!Object.prototype.hasOwnProperty.call(F.BUSTO, "genre") &&
       Object.keys(F.BUSTO).length === 4,
       "…and BUSTO still aims groups at the FOUR shipped buses only — the " +
       "genre bus takes no group feed (its route IS the series)",
       JSON.stringify(F.BUSTO));
    // ...AND THE PAGE DRAWS FOUR STAGES IN SERIES, 2026-08-27 — this counted
    // "four bus strips" as `#racktbl` columns while the registry's four buses
    // each had one; the series reversal (G12 part 2 has the quote) means the
    // page's four are now genre → delay → reverb → main, of which two are the
    // registry's engine buses wearing the series' order and two (genre, main)
    // are the series' own ends. The groups draw no plate; G12 holds that with
    // the reason printed.
    // ...AND THEN THE FOUR STAGES BECAME FOUR TABS, 2026-08-27 (Paul: "Put the
    // effects buses and mains into special tabs after the voices"). The COUNT
    // is the claim and it is unchanged; where it is counted is not, because a
    // flat `#rack .nu-plate` sweep would now answer 1 and this check would
    // fail for a reason that has nothing to do with the four buses. Each tab
    // is opened and its plate collected.
    const cols = [].concat(...(await perBus(() => page.evaluate(() =>
      [...document.querySelectorAll("#boardpanel #rack .nu-plate")]
        .map((t) => t.dataset.bus)))).map(([, v]) => v));
    ok(cols.length === 4, "and the board draws four stages in series, one per " +
       "tab: " + JSON.stringify(cols), String(cols.length));

    // ---- 2 · THE PER-VOICE EFFECTS CONTROL IS BACK, AND ONLY WHERE THE
    // STRIP SEATS IT — REVERSED 2026-08-27, the second turn of this exact
    // check. It read "NO PER-VOICE EFFECTS CONTROL IS DRAWN ANYWHERE" on
    // Paul's 2026-08-26 "Don't let me add effects to instruments"; his
    // 2026-08-27 sentence reverses it by name — *"I think we need to do what
    // everyone else does with effects. Add per voice effects, up to three"*
    // — so the claim flips WITHOUT losing its teeth: a control offering the
    // registry's effect names against a voice must be an INSERT SEAT
    // (`ins|<voice>|<n>`), and any OTHER control offering them against a voice
    // (an `eng|`/`b|` keyed one — the voice-tab chip, the old board
    // multiselect) is still a failure by existing. The walk is unchanged:
    // every control on the page, tested by the registry's own words.
    //
    // WHERE THE SEAT IS HAS MOVED TWICE AND THE CHECK DOES NOT CARE, which is
    // the point of asking it by KEY rather than by container: it was the
    // board's strip, then ui/eight.js `voiceSound` drew a SECOND set of
    // `desk.fx<n>|<voice>` menus beside it (2026-08-28, and Paul's "it is just
    // a bunch of dropdowns" is what ended them), and the seat is now the one
    // strip, inside the voice. The voice's `mix` facet is opened first so the
    // seats are on the page to be found — a sweep taken with them shut would
    // report `seats: []` and turn this red for the wrong reason.
    await openVoice((await voiceNames())[0]);
    const chips = await page.evaluate((fxKeys) => {
      const bad = [], seats2 = [];
      for (const c of document.querySelectorAll("select, input, button")) {
        const k = c.dataset.k || c.dataset.sel || c.name || c.id || "";
        // A MENU'S WORDS, EITHER SPELLING (2026-09-02). `.options` is
        // undefined on the `<input role=combobox>` ui/selects.js draws now, so
        // this read [] for every converted menu and the sweep could no longer
        // catch a rogue one offering the FX vocabulary.
        const words = c.getAttribute("role") === "combobox"
          ? window.__combo.words(c).map((o) => o.v)
          : [...(c.options || [])].map((o) => o.value);
        const offersFx = words.some((w) => fxKeys.includes(w));
        if (!offersFx) continue;
        if (/^ins\|/.test(k)) { seats2.push(k); continue; }
        if (/^(eng|b)[.|]/.test(k)) bad.push(k);
      }
      return { bad, seats: seats2,
               multi: document.querySelectorAll("select[multiple]").length };
    }, Object.keys(F.FX));
    ok(!chips.bad.length && chips.seats.length > 0,
       "every control offering the FX vocabulary against a voice is an insert " +
       "SEAT on that voice's strip (" + chips.seats.length + " of them, " +
       "`ins|…`) — no second per-voice effects widget anywhere (Paul, " +
       "2026-08-27; and no `desk.fx…` menu row, 2026-08-28)",
       JSON.stringify(chips.bad));
    ok(F.PARTMIX.some((f) => f.key === "fx"),
       "…and the field is DECLARED again, so the seat writes a word the " +
       "loader knows: PARTMIX carries `fx` (reversed 2026-08-27; it was " +
       "asserted absent while 2026-08-26 stood)",
       F.PARTMIX.map((f) => f.key).join(","));

    // ---- 2b · AND THE OTHER HALF OF THE SENTENCE. "That's bus and board
    // stuff" is an ADDRESS, not only a refusal, so the round is not done when
    // the chip is gone — it is done when the chain has a home that reaches the
    // engine. THAT HOME IS THE STRIP NOW (2026-08-27). This block asserted the
    // record-wide `sound.fx` through `DD.writeBoxFx`/`DD.boxFxOf` and the
    // record chip landing on every seated voice; Paul retired the control
    // ("We can get rid of Character right? We don't really use it any more do
    // we?") and FUTURE.md §5 had ruled the same. So the same three questions
    // are asked of the door that replaced it — writable, reaching the units,
    // and silent when nothing asks — plus the one the migration owes: a
    // document saved with the retired key still sounds like itself.
    {
      const d2 = clone(TERMS);
      DD.writeDesk(d2.voices[0], "fx", ["crunch"]);
      ok(eq((d2.voices[0].desk || {}).fx, ["crunch"]),
         "the CHAIR's chain is writable through desk-doc — one owner, and it " +
         "is the strip", JSON.stringify((d2.voices[0].desk || {}).fx));
      const bx = pushBoxes(d2)[0];
      const u2 = deskUnits(mkUnits(), ADDR, bx, null, null);
      const ins = (u2.v0.inserts || []).map((i) => i.module);
      ok(ins.includes("insert_higain"),
         "…and it REACHES THE UNITS: a chair's chip is an insert on that " +
         "chair's voice (crunch -> insert_higain), which is the whole of " +
         "\"that's bus and board stuff\" said in the engine's own words",
         JSON.stringify(ins));
      const one = pushBoxes(clone(TERMS))[0];
      ok(!((deskUnits(mkUnits(), ADDR, one, null, null).v0.inserts || []).length),
         "…and the shipped chant, which asks for no chain, still gets not one " +
         "insert — absent is today on this axis too");
      // THE OLD SAVE, RESOLVED ON READ. A session written before the
      // retirement carries `sound.fx`; document.js normalize folds it onto
      // every chair and deletes the key, so the record still sounds like
      // itself and the retired key has no second life.
      const d3 = clone(TERMS);
      d3.sound = { ...(d3.sound || {}), fx: ["crunch"] };
      NuDoc.normalize(d3);
      ok(d3.sound.fx === undefined,
         "…and a document saved with the retired `sound.fx` comes out of " +
         "normalize without it — one owner, resolved at the door");
      ok(d3.voices.every((v) => eq((v.desk || {}).fx, ["crunch"])),
         "…with the chip on EVERY chair, which is exactly who the record-wide " +
         "chain reached",
         JSON.stringify(d3.voices.map((v) => (v.desk || {}).fx)));
      const bx3 = pushBoxes(d3)[0];
      const ins3 = (deskUnits(mkUnits(), ADDR, bx3, null, null).v0.inserts || [])
        .map((i) => i.module);
      ok(eq(ins3, ins),
         "…and it renders the IDENTICAL insert chain the record-wide key did — " +
         "the migration is a move, not a remix", JSON.stringify(ins3));
    }

    // ---- 3 · THE CYCLE IS REFUSED, IN THE MODEL AND ON THE PAGE.
    // A group may be aimed at another group, so a loop is two clicks away. The
    // model falls back to the shipped fold and says `cycle`; the page greys the
    // option that would close it, with the reason printed, which is this
    // board's own standing precedent.
    const loop = F.busRoute({ room: { to: "aux" }, aux: { to: "room" } });
    ok(loop.room.cycle && loop.aux.cycle &&
       loop.room.engine === "rev" && loop.aux.engine === "rev",
       "a cycle is REFUSED and falls back to the shipped fold (bus 1) rather " +
       "than clamped — a clamped loop would be a route the tape does not have",
       JSON.stringify(loop));
    ok(F.busToOk({}, "room", "aux") === true &&
       F.busToOk({ aux: { to: "room" } }, "room", "aux") === false &&
       F.busToOk({}, "room", "room") === false,
       "…and the refusal is measured ON THE MOVE: aiming bus 3 at bus 4 is " +
       "fine until bus 4 points back, and a bus may never aim at itself");

    // ---- 4 · THE PROOF. A GROUP'S SEND, AIMED TWO WAYS, LANDS ON TWO
    // DIFFERENT NUMBERS IN THE ENGINE'S OWN REPORT.
    //
    // REWRITTEN 2026-08-27, and the reversal is the geometry's, not the
    // wire's. This check used to DRIVE the page: a `b|room|<voice>` send pot
    // and the `bus|room|to` aim menu, read back through `__nuMix()`. The
    // one-board round retired both CONTROLS with the group plates (Paul:
    // "Have one bus for genre specific effects, into a delay bus, into
    // reverb, into main" — the groups are not in the series; G12 part 2
    // asserts the plates gone and the reversal printed). THE WIRE IS NOT
    // RETIRED and must stay proven, so the proof moves to the exact layer
    // the page fed: deskUnits IS the table audio/plan.js hands the parent
    // (barPlan calls it with these arguments), and the route reads the SAME
    // live BUSES binding the page's setBuses writes. Same send, aimed two
    // ways, two different numbers in the engine's own table — a loaded old
    // save that carries a room send and an aim still lands where it says.
    const sums4 = (d4) => {
      const u = deskUnits(mkUnits(), ADDR, pushBoxes(d4)[0], null, null);
      let rev = 0, del = 0;
      for (const x of Object.values(u)) { rev += x.rev || 0; del += x.del || 0; }
      return { rev: +rev.toFixed(4), del: +del.toFixed(4) };
    };
    const d4 = clone(TERMS);
    d4.voices[0].desk = { room: "drown" };
    const at1 = sums4(d4);
    STATE.setBuses({ room: { to: "echo" } });
    const at2 = sums4(d4);
    STATE.setBuses(null);
    const at3 = sums4(d4);
    ok(at2.del > at1.del && at2.rev < at1.rev,
       "AIMING BUS 3 AT BUS 2 MOVES WHAT THE ENGINE IS HANDED — the same " +
       "send leaves `rev` and arrives on `del` in the unit table plan.js " +
       "hands the parent: " + JSON.stringify(at1) + " -> " + JSON.stringify(at2),
       JSON.stringify({ at1, at2 }));
    ok(eq(at3, at1),
       "…and clearing the aim puts the numbers back exactly — absent is the " +
       "fold this desk has always done, which is the absent-is-today law " +
       "applied to a ROUTE rather than to a level",
       JSON.stringify({ at1, at3 }));

    // ---- 5 · THE ONE BUS-TO-BUS SEND THAT DOES REACH THE ENGINE IS NAMED,
    // AND IT IS NOT DRAWN TWICE. REWRITTEN 2026-08-27 (the text diet,
    // FUTURE.md §2): the board printed MAIN_TO_BUS1 and every FIXED_EDGES
    // sentence to end users — fx_bus.dsp line numbers included — and that
    // essay moved to nukernel/docs/BOARD-ROUTING.md with a one-line pointer
    // left on the board. "An edge nobody knows about is the same as no edge"
    // still binds, so the claim is now held in two halves: the RENDERED page
    // must carry the pointer (a real link to the doc), and the DOC must carry
    // each edge's own words verbatim — audio/desk.js stays the one owner and
    // this diff is what keeps the quotes from drifting.
    const said = await page.evaluate(() => document.body.innerText);
    const routePtr = await page.evaluate(() => {
      const a = [...document.querySelectorAll("#board a")]
        .find((x) => /BOARD-ROUTING\.md$/.test(x.getAttribute("href") || ""));
      return a ? { href: a.getAttribute("href"), text: a.textContent } : null;
    });
    ok(!!routePtr && /docs\/BOARD-ROUTING\.md/.test(routePtr.text),
       "the board carries the one-line pointer to docs/BOARD-ROUTING.md " +
       "(the essay moved, the address is printed)", JSON.stringify(routePtr));
    // the doc wraps its quotes as markdown blockquotes, so the comparison is
    // whitespace-flattened — the WORDS must match, not the line breaks.
    const routeDoc = require("fs").readFileSync(R("docs/BOARD-ROUTING.md"), "utf8")
      .replace(/^> /gm, "").replace(/\s+/g, " ");
    ok(routeDoc.includes(MAIN_TO_BUS1.why),
       "the doc prints the one live bus-to-bus send in the engine's own " +
       "words, and points at the control that owns it (`space`)");
    for (const e of FIXED_EDGES)
      ok(routeDoc.includes(e.why),
         "…and the fixed edge " + e.from + " -> " + e.to + " at " + e.amount +
         " is printed in the doc rather than drawn as a knob that cannot move");
    // COUNTED ACROSS THE WHOLE TAB ROW, 2026-08-27 (the board tabs). `space`
    // lives on the MAIN plate, which is on the page only while its tab is
    // marked, so a single sweep would have answered 0 and failed a claim
    // about ownership for a reason about geometry. Summed over every tab the
    // board has, which is the stronger reading of "on the page": one owner,
    // and not a second copy hiding behind another tab.
    const spaceCtl = (await perBus(() => page.evaluate(() =>
      document.querySelectorAll('[data-sel^="master|space"]').length)))
      .reduce((a, [, n]) => a + n, 0) +
      (await perTab(() => page.evaluate(() =>
        document.querySelectorAll('[data-sel^="master|space"]').length)))
      .reduce((a, [, n]) => a + n, 0);
    ok(spaceCtl === 1,
       "…with exactly ONE control for it anywhere in the tab row — one owner " +
       "per fact, and the owner is the main plate's `space`", String(spaceCtl));
  }

  /* ================= G15 · THE SLOTS AND THE GRID, DRIVEN ================
     NEW 2026-08-27 with the surfaces it drives. Two writers this wave added,
     each proven on the RENDERED page and read back off the document AND the
     model: an insert SEAT plus its WET (Paul: "Add per voice effects, up to
     three. Each has a wet dry mix and its own settings"), and a SECTION GRID
     cell (one-board §III: "A word is a trim on the strip's fader for that
     section"). The audio side of both wires is held elsewhere — the insert
     modules' rendered spectra and the trim's rendered dB are the wave's
     probe report; the fader wire the trim rides is test/tape-reach R1. */
  console.log("\n" + "G15 the insert slots and the section grid, driven");
  {
    /* THE TWO HALVES OF THIS CHECK ARE ON TWO DIFFERENT TABS SINCE 2026-08-28,
       so they are two `evaluate`s now instead of one. The SLOT half drives
       `ins|<name>|1`, `b|fxw1|<name>` and `b|fxa1|<name>`, which are on the
       voice's own `mix` facet (Band tab); the GRID half taps
       `t|<name>|<secId>`, which is the section-automation table and STAYED ON
       THE BOARD (Mix tab) for the reason it has always had — it is a
       cross-voice table, sections down and every voice across, and a table
       with one column is not a table. Splitting the evaluate is the whole of
       the change: every drive, every read-back and every assertion below is
       word for word what it was. */
    {
      const first = await page.evaluate(() =>
        (window.__eightDoc().voices.find((v) => v.kind === "line") || {}).name);
      if (first) await openVoice(first);
    }
    const slotTrip = await page.evaluate(async () => {
      const wait = () => new Promise((r) => setTimeout(r, 500));
      const doc2 = () => window.__eightDoc();
      const v0 = () => doc2().voices.find((v) => v.kind === "line");
      const name = v0().name;
      const drive = (k, word) => {
        const el2 = document.querySelector('input[data-k="' + k + '"]');
        if (!el2) return false;
        for (let i = +el2.min; i <= +el2.max; i++) {
          el2.value = String(i);
          el2.dispatchEvent(new Event("input", { bubbles: true }));
          if (el2.getAttribute("aria-valuetext") === word) {
            el2.dispatchEvent(new Event("change", { bubbles: true })); return true; }
        }
        return false;
      };
      const seat = (v) => {
        const s = document.querySelector('select[data-k="ins|' + name + '|1"]');
        if (!s) return false;
        s.value = v; s.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };
      seat("crunch"); await wait();
      const seated = JSON.parse(JSON.stringify((v0().desk || {}).fx || null));
      const wet = drive("b|fxw1|" + name, "half"); await wait();
      const face = drive("b|fxa1|" + name, "most"); await wait();
      const after = JSON.parse(JSON.stringify(v0().desk || null));
      seat(""); await wait();
      const cleared = JSON.parse(JSON.stringify(v0().desk || null));
      return { name, secId: doc2().form.sections[1].id,
               seated, wet, face, after, cleared };
    });
    /* ...AND THE GRID, WHICH IS THE BOARD'S FIFTH PLATE SINCE 2026-09-02.
       Paul: *"Instead of having four icons on top and section automation that
       should have been five subicons under the 'Mix' icon. One of them is
       section automation."* It was appended to the board's HOST — under
       whichever bus plate was open, and not a tab — so reaching the Mix tab
       was enough to find a `t|voice|section` cell; it is `PLATES.auto` now and
       its own mark has to be pressed. The key did not move. */
    /* THROUGH `openAuto`, 2026-09-02, AND NOT THROUGH A BARE `if (a) a.click()`.
       The inline version swallowed a missing button and left the walk reading
       a plate that was never opened — the silent-skip shape this gate's own
       header calls "a gate faithful to a scope that does not contain the
       thing". `openAuto` WAITS for the plate and fails by name if it does not
       arrive. */
    await openAuto();
    Object.assign(slotTrip, await page.evaluate(async () => {
      const wait = () => new Promise((r) => setTimeout(r, 500));
      const doc2 = () => window.__eightDoc();
      const v0 = () => doc2().voices.find((v) => v.kind === "line");
      const name = v0().name, secId = doc2().form.sections[1].id;
      /* ===== TAP THE CELL, TAP THE WORD — 2026-09-02, wave 4 ==========
         Paul: *"make those tables of dropdowns full of tappable grids that
         change options rather than dropdowns … institutionalize it."* The
         grid is a ui/wordgrid.js instance now, so the GESTURE this block
         drives changed and nothing else did.
         IT READ: `cell().click()` twice — "the cycle: — → out → hush → …" —
         and then four more clicks to come round to `—`. Six taps to say one
         word, and no way to see the six words at all. Now a tap on the cell
         OPENS the strip and a tap on a CHIP says the word, so `hush` is two
         taps and `—` is two taps, and the assertions below are word for word
         what they were: the document reads `hush`, and clearing it deletes
         the map. The address did not move — the cell is still
         `t|<voice>|<secId>` and a chip is that key plus its own word. */
      const cell = () => document.querySelector(
        'button[data-k="t|' + name + '|' + secId + '"]');
      const chip = (w) => document.querySelector(
        'button[data-k="t|' + name + '|' + secId + '|' + w + '"]');
      cell().click(); await wait();          // the strip of words opens
      const words = [...document.querySelectorAll(".nu-wopen .nu-wchip")]
        .map((b) => b.textContent);
      chip("hush").click(); await wait();     // -> hush
      const trimmed = JSON.parse(JSON.stringify(
        (v0().desk && v0().desk.trim) || null));
      const shut = !document.querySelector(".nu-wopen");
      cell().click(); await wait();
      chip("").click(); await wait();         // -> as mixed, the absent word
      const trimCleared = (v0().desk && v0().desk.trim) || null;
      return { trimmed, trimCleared, words, shut };
    }));
    // RECORD GAIN MOVED BEHIND THE MAIN TAB, 2026-08-27 (the board tabs) —
    // this line read the main plate out of a rack that was always on the page,
    // from inside the strip's own evaluate. Same control, same `data-k`, same
    // plate; it is asked with the main tab open and the board is put back.
    await openBus("main");
    slotTrip.recordGain = await page.evaluate(() => !!document.querySelector(
      '#boardpanel #rack .nu-plate[data-bus="main"] input[data-k="level"]'));
    await openBus((await busTabs())[0]);
    ok(eq(slotTrip.seated, ["crunch"]),
       "seating `crunch` in slot 1 writes voice.desk.fx = [\"crunch\"]",
       JSON.stringify(slotTrip.seated));
    ok(slotTrip.wet && slotTrip.face && slotTrip.after &&
       slotTrip.after.fxw1 === "half" && slotTrip.after.fxa1 === "most",
       "…its wet and face sliders write the slot's own words (fxw1 `half`, " +
       "fxa1 `most`) — the document speaks the registry's vocabulary",
       JSON.stringify(slotTrip.after));
    ok(slotTrip.cleared === null ||
       (!slotTrip.cleared.fx && !slotTrip.cleared.fxw1 && !slotTrip.cleared.fxa1),
       "…and unseating the chip deletes the list AND the slot's knobs — " +
       "absent is the only spelling of a default, knobs included",
       JSON.stringify(slotTrip.cleared));
    ok(slotTrip.trimmed && slotTrip.trimmed[slotTrip.secId] === "hush",
       "tapping a grid cell and then the `hush` chip writes voice.desk.trim[" +
       slotTrip.secId + "] = \"hush\" — the strip offered " +
       JSON.stringify(slotTrip.words),
       JSON.stringify(slotTrip.trimmed));
    ok(slotTrip.shut === true,
       "…and the strip folded behind the word — one strip open at a time, and " +
       "none open once a word has been said");
    ok(slotTrip.trimCleared === null,
       "…and the `—` chip deletes the map — a cleared grid is a " +
       "byte-identical record", JSON.stringify(slotTrip.trimCleared));
    ok(slotTrip.recordGain,
       "record gain (`sound.level`, Time's stray slider) is on the MAIN " +
       "plate — FUTURE.md §5's rename, landed, with the pointer left in Time");
    // ...AND THE TRIM REACHES THE ENGINE'S TABLE, at the layer plan.js hands
    // it: the box under the trimmed section carries the trimmed gain and the
    // others are untouched (the per-box overlay in ui/eight.js push()).
    {
      const dT = clone(TERMS);
      const chair = DD.channelsOf(dT, GENRES)[0];
      dT.voices[0].desk = { trim: { [dT.form.sections[1].id]: "hush" } };
      const boxes = boxesFor(dT);
      const parts = DD.deskPartsOf(dT, GENRES);
      boxes.forEach((b, i2) => {
        b.parts = parts; b.fx = [];
        const t = dT.voices[0].desk.trim[dT.form.sections[i2].id];
        if (t != null && Object.prototype.hasOwnProperty.call(F.TRIMS, String(t))) {
          b.parts = { ...(parts || {}) };
          b.parts[chair] = F.trimApply(b.parts[chair], t);
        }
      });
      const g0 = deskChannelBase(boxes[0], chair).gain;
      const g1 = deskChannelBase(boxes[1], chair).gain;
      const wantDb = F.TRIMS.hush;
      const gotDb = 20 * Math.log10(g1 / g0);
      ok(near(gotDb, wantDb, 0.05),
         "the trimmed box's channel gain moves by TRIMS.hush = " + wantDb +
         " dB exactly (" + gotDb.toFixed(2) + " dB) and the untrimmed box is " +
         "untouched — the word grid is score-level data on the fader's own " +
         "proven wire", JSON.stringify({ g0, g1 }));
    }

    /* ===== G15b · THE GENRE BUS IS THREE EFFECTS, SET NORMALLY (2026-09-03)
       Paul: *"The 'genre bus' doesn't really make a lot of sense. I was
       expecting it to just be three effects I could set normally. It has this
       concept of chips. We don't need all that, just a set of chained effects
       that can be fed."* The plate drew three bare `<select>`s of effect names
       labelled "chip 1..3" and nothing else. It draws the STRIP'S OWN SLOT now
       — ui/engineer.js `slotEl`, one drawing and two owners — so this is G15's
       trip made against the bus's own keys, plus the two claims that are
       specifically about the ask: no "chip" word anywhere on the plate, and
       the FEED still named in the header (the sends are the point of a bus).

       WHY IT IS DRIVEN AND NOT READ. The slots' knobs only EXIST once a seat
       is filled — `slotEl` returns the empty box before it builds a body — so
       a structural read of the shipped plate would find three seats and no
       pots and could not tell "set normally" from "named only". */
    await openBus("genre");
    const busTrip = await page.evaluate(async () => {
      const wait = () => new Promise((r) => setTimeout(r, 400));
      const doc2 = () => window.__eightDoc();
      const row = () => JSON.parse(JSON.stringify(
        ((doc2().sound || {}).buses || {}).genre || null));
      const plate = () => document.querySelector(
        '#boardpanel #rack .nu-plate[data-bus="genre"]');
      const drive = (k, word) => {
        const el2 = document.querySelector('input[data-k="' + k + '"]');
        if (!el2) return false;
        for (let i = +el2.min; i <= +el2.max; i++) {
          el2.value = String(i);
          el2.dispatchEvent(new Event("input", { bubbles: true }));
          if (el2.getAttribute("aria-valuetext") === word) {
            el2.dispatchEvent(new Event("change", { bubbles: true })); return true; }
        }
        return false;
      };
      const seat = (n, v) => {
        const sel = document.querySelector(
          'select[data-k="bus|genre|fx' + n + '"]');
        if (!sel) return false;
        sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };
      const before = { seats: [1, 2, 3].map((n) => !!document.querySelector(
                         'select[data-k="bus|genre|fx' + n + '"]')),
                       pots: !!document.querySelector(
                         'input[data-k="bus|genre|fxw1"]'),
                       chip: /chip/i.test((plate() || {}).textContent || ""),
                       head: ((plate() || {}).querySelector
                         ? (plate().querySelector(".nu-busin") || {}).textContent
                         : null) };
      seat(1, "ringmod"); await wait();
      const seated = row();
      const wet = drive("bus|genre|fxw1", "half"); await wait();
      const face = drive("bus|genre|fxa1", "most"); await wait();
      seat(2, "chorus"); await wait();
      const after = row();
      const chained = [1, 2, 3].map((n) => {
        const sel = document.querySelector('select[data-k="bus|genre|fx' + n + '"]');
        return sel ? sel.value : null;
      });
      seat(1, ""); await wait();
      seat(1, ""); await wait();          // the compaction moved chorus into 1
      const cleared = row();
      return { before, seated, wet, face, after, chained, cleared };
    });
    ok(busTrip.before.seats.every(Boolean) && !busTrip.before.chip,
       "the genre bus draws THREE effect seats (bus|genre|fx1..3) and the word " +
       "\"chip\" is nowhere on the plate", JSON.stringify(busTrip.before));
    ok(/^in ←/.test(busTrip.before.head || ""),
       "…and it still says what FEEDS it — the strips' genre sends are the " +
       "point of the bus: " + JSON.stringify(busTrip.before.head));
    ok(busTrip.seated && busTrip.seated.fx1 === "ringmod",
       "seating `ring mod` in slot 1 writes sound.buses.genre.fx1 — the row's " +
       "OWN key, unmoved, so a saved session opens onto these seats",
       JSON.stringify(busTrip.seated));
    ok(busTrip.wet && busTrip.face && busTrip.after &&
       busTrip.after.fxw1 === "half" && busTrip.after.fxa1 === "most",
       "…and the slot's WET and its own SETTING are live pots that write the " +
       "registry's words (fxw1 `half`, fxa1 `most`) — set normally, like " +
       "every other effect on the board", JSON.stringify(busTrip.after));
    ok(eq(busTrip.chained, ["ringmod", "chorus", ""]),
       "…and a second effect chains after it, in slot order",
       JSON.stringify(busTrip.chained));
    ok(busTrip.cleared === null,
       "…and unseating them deletes the row, knobs included — absent is the " +
       "only spelling of a default", JSON.stringify(busTrip.cleared));
    await openBus((await busTabs())[0]);
  }

  /* G13 REWRITTEN 2026-08-27 (THIRD TIME THAT DAY), and every reversal is
     kept in writing rather than deleted.

     FIRST IT MEASURED THE SPLIT (two tables; "99 of 177 cells empty" was the
     finding, "at most one blank survives" was the property). Those tables
     retired with the one-board round, so it was rewritten to measure the tall
     strips: STACKED AT 390, SIDE BY SIDE AT 1280, and THE PAGE IS NEVER WIDE.
     Then the strips went into tabs and "one column at 390 and two at 1280"
     stopped being a claim about anything — worse, it PASSED VACUOUSLY on the
     tabbed page (1 >= min(2, 1)) — so it was rewritten again as NO SIDEWAYS
     GROWTH, EVERY CONTROL REACHABLE. Every measurement behind all three is
     real and is in this file's git history.

     NOW THE BUSES AND THE MAIN ARE TABS TOO. Paul, 2026-08-27: *"Put the
     effects buses and mains into special tabs after the voices -- now the
     board is one tabbed space that is consistent and easy to understand."*
     Two of the previous version's three geometry probes walked furniture that
     is no longer always on the page — `#strips` is absent while a bus tab is
     open, and `#rack` is absent while a voice tab is — so a check reading
     either unconditionally would throw or, worse, quietly measure `null`.

     THE DURABLE CLAIM SURVIVES ALL THREE REWRITES AND IS WHAT IS ASSERTED
     HERE, WIDENED TO THE WHOLE ROW: NO SIDEWAYS GROWTH, EVERY CONTROL
     REACHABLE, AND EVERY REFUSAL STILL SENTENCED ON ITS OWN TAB.
       * no sideways growth: the document, the tab row and the ONE PANEL, at
         390 and at 1280, measured with each kind of tab open — a plate is a
         different shape from a strip and either could be the one that pushes.
       * every control reachable: the union of the control keys across ALL the
         tabs — voices AND buses — must be exactly what the flat board drew.
         One strip or one plate hidden behind a tab is a thing you can reach;
         one DROPPED is a knob that no longer exists.
       * every refusal sentenced: a disabled control carries `data-why` and
         its words are printed on the tab it lives on. This is the half the
         tabs put at most risk, because a refusal whose sentence is on another
         tab is exactly the "silent grey" the board's own header forbids.

     THE NUMBERS THAT BOUGHT THE CHANGE, measured on the rendered page, the
     shipped chant: BEFORE, at 390, a 1,007px strip with a 2,561px rack under
     it and a 9,872px document; at 1280, 876px + 2,162px and 8,449px. AFTER:
     the panel is one thing — 1,007px (a strip) or 534/530/447/926px (genre /
     delay / reverb / main) at 390 — and the document is 7,381px at 390 and
     6,306px at 1280. 2,491px and 2,143px of scroll gone, and the tallest
     plate is now one tap from the strip that sends into it instead of a page
     of console away. */
  console.log("\n" + "G13 the tabbed board's geometry, measured on the page");
  {
    const wide = [];
    const shape = {};
    const voices = await voiceNames();
    const busKeys = await busTabs();
    for (const w of [390, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
      /* MEASURED ON BOTH SURFACES, 2026-08-27 and re-aimed 2026-08-28: a
         voice's STRIP and a bus's PLATE are different shapes and either could
         be the one that pushes the document sideways, so "nothing grows
         sideways" is asked of every one of them rather than of whichever
         happened to be open. What changed is where the strip is measured: it
         is the Band tab's `#voicemix` now and the panel it is measured against
         is `#app` (the tab panel it lives in), not `#boardpanel`. The bus
         readings are untouched. */
      const per = {};
      await openVoice(voices[0]);
      per["voice|" + voices[0]] = await page.evaluate(() => {
        const host = document.querySelector("#voicemix");
        const panel = host.closest("[id^='panel-'],.nu-panel,section,div") || host.parentNode;
        const body = host.querySelector(".nu-strip");
        return { doc: document.documentElement.scrollWidth,
                 win: document.documentElement.clientWidth,
                 kind: host.id,
                 panelScroll: panel.scrollWidth, panelClient: panel.clientWidth,
                 barScroll: 0, barClient: 0,
                 h: body ? Math.round(body.getBoundingClientRect().height) : 0,
                 bw: body ? Math.round(body.getBoundingClientRect().width) : 0 };
      });
      /* THE PANEL READING NO LONGER MEASURES A TAB ROW, 2026-09-02 (slice
         2e): `barScroll`/`barClient` were `#boardtabs`'s and there is no
         `#boardtabs`. The two readings that were ever load-bearing are the
         DOCUMENT and the PANEL, and both are untouched. The row's own "does
         it wrap rather than scroll" question moved to the stripe, which is
         test/nav-tree.js's (it measures every width for sideways scroll).
         ...AND THE FIFTH CHILD IS MEASURED WITH THE FOUR. The automation grid
         is the widest thing on this board by construction — one column per
         voice, and each column head now holds a button and a meter — so it is
         exactly the plate most likely to push the document sideways, which is
         the whole question this loop asks. It was never measured here at all
         while it was appended to the host. */
      for (const t of ["bus|genre", "bus|echo", "bus|rev", "bus|main", "auto|auto"]
             .filter((k) => k === "auto|auto" || busKeys.includes(k.slice(4)))) {
        if (t === "auto|auto") await openAuto(); else await openBus(t.slice(4));
        per[t] = await page.evaluate(() => {
          const panel = document.getElementById("boardpanel");
          const open = panel.firstElementChild;
          const body = open && open.querySelector(".nu-plate");
          return { doc: document.documentElement.scrollWidth,
                   win: document.documentElement.clientWidth,
                   kind: open ? open.id : "(empty)",
                   panelScroll: panel.scrollWidth, panelClient: panel.clientWidth,
                   barScroll: 0, barClient: 0,
                   h: body ? Math.round(body.getBoundingClientRect().height) : 0,
                   bw: body ? Math.round(body.getBoundingClientRect().width) : 0 };
        });
      }
      await openBus(busKeys[0]);
      /* THE ROW'S GEOMETRY IS THE STRIPE'S GEOMETRY NOW. It read `tabs`,
         `tabLines`, `voiceLines`, `seriesLines` and `seamFirst` off
         `#boardtabs`; what is asked instead is the claim those five were
         serving — the five children of the Mix icon are a COLUMN in the
         stripe, one row each, in one order, at both widths — plus the panel's
         width, which the wide-check below still uses. */
      const m = await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#nu-tray [data-k^="boardtab|"]')];
        const lineOf = (n) => Math.round(n.getBoundingClientRect().top);
        return { tabs: rows.length,
                 tabLines: [...new Set(rows.map(lineOf))].length,
                 keys: rows.map((b) => b.dataset.k),
                 oldRow: document.querySelectorAll("#boardtabs").length,
                 panelW: Math.round(document.getElementById("boardpanel")
                   .getBoundingClientRect().width) };
      });
      shape[w] = { ...m, per };
      console.log("  note at " + w + "px: " + m.tabs + " Mix children on " +
        m.tabLines + " line(s) in the stripe, panel " + m.panelW + "px, bodies " +
        Object.entries(per).map(([k, v]) => k + " " + v.bw + "x" + v.h).join(" · "));
      for (const [k, v] of Object.entries(per)) {
        if (v.doc > v.win) wide.push("document " + w + " on " + k + ": " + v.doc + " > " + v.win);
        if (v.panelScroll > v.panelClient)
          wide.push("panel " + w + " on " + k + ": " + v.panelScroll + " > " + v.panelClient);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    const onePer = [];
    for (const w of [390, 1280])
      for (const [k, v] of Object.entries(shape[w].per)) {
        // `voicemix` for a voice's own facet, `rack` for a bus's plate. It
        // read `strips` for the first of those until 2026-08-28, when the
        // strips left the board and `#strips` stopped existing.
        const wantKind = k.startsWith("voice") ? "voicemix" : "rack";
        if (v.kind !== wantKind) onePer.push(w + " " + k + " opened " + v.kind);
        if (!(v.h > 0)) onePer.push(w + " " + k + " drew nothing");
      }
    ok(!onePer.length,
       "ONE THING IN VIEW, at both widths — a voice's `mix` mark opens ITS " +
       "strip and each bus tab opens its own plate into the board's one panel " +
       "(Paul, 2026-08-27: \"now the board is one tabbed space\"; 2026-08-28: " +
       "\"a new nav element called mix that is per voice\")",
       JSON.stringify(onePer));
    ok(!wide.length,
       "NO SIDEWAYS GROWTH at 390 or at 1280, on EITHER surface and on all " +
       "FIVE of the Mix icon's children — not the document, not the panel a " +
       "strip or a plate sits in, the section-automation grid (a button and a " +
       "meter in every column head) included", wide.join("; "));
    /* THE SEAM, REWRITTEN 2026-08-28 — the property survives the thing it was
       cutting between. It read: "THE SEAM HOLDS: the bus tabs begin their own
       line UNDER THE VOICES at both widths", measured through `seriesBreaks`
       (the group's first button lower than every voice button). There are no
       voice buttons in this row now, so that comparison is against an empty
       set and would pass vacuously — `Math.max()` of nothing is -Infinity and
       everything is greater than it. That is exactly the shape of a check that
       goes quietly green while measuring nothing, which this file has been
       caught by before.
       WHAT WAS ASSERTED INSTEAD, 2026-08-28, was what the group was FOR now
       that it separated nothing: "it is the row's own first item (its
       `.nu-seamlab` label leads the line), it names its four buttons as one
       thing for a screen reader, and the whole series is ONE LINE at 1280 —
       which is the smallest a four-stage chain can be drawn in."

       REWRITTEN AGAIN 2026-09-02 (slice 2e), AND THE ROW IS GONE. Paul, B11:
       *"Instead of having four icons on top and section automation that should
       have been five subicons under the 'Mix' icon."* There is no
       `.nu-busgroup`, no `.nu-seamlab` and no in-panel line to lead, so all
       three clauses above are claims about furniture rather than about the
       board. What is left of the property — and it is the durable half — is
       that the five are ONE PER LINE in the stripe, in one order, at both
       widths: a column of five rows is the shape the gutter promises, and a
       row that wrapped or a child that vanished at 390 would be the same
       defect the old line was watching for one screen over. */
    ok(shape[390].oldRow === 0 && shape[1280].oldRow === 0 &&
       shape[390].tabs === 5 && shape[1280].tabs === 5 &&
       shape[390].tabLines === 5 && shape[1280].tabLines === 5 &&
       eq(shape[390].keys, shape[1280].keys),
       "THE SERIES IS A COLUMN IN THE STRIPE AT BOTH WIDTHS — five children, " +
       "one per line, same order at 390 and at 1280, and no in-panel tab row " +
       "left on the page (390: " + shape[390].tabs + " on " +
       shape[390].tabLines + " line(s); 1280: " + shape[1280].tabs + " on " +
       shape[1280].tabLines + ")",
       JSON.stringify({ 390: { tabs: shape[390].tabs, lines: shape[390].tabLines,
                               keys: shape[390].keys, oldRow: shape[390].oldRow },
                        1280: { tabs: shape[1280].tabs, lines: shape[1280].tabLines,
                                keys: shape[1280].keys, oldRow: shape[1280].oldRow } }));
    /* THE SENTENCE, REWRITTEN 2026-08-28 — NOT THE PROPERTY. It read
       "…and a strip and a plate take THE SAME width at 1280 (Npx against
       Npx) RATHER THAN THE WHOLE WINDOW", and the last clause named a cap
       that is gone: nu.css capped `.nu-strips` and `.nu-rack` at 780px so a
       single strip would not stretch across a desktop, and Paul, 2026-08-28:
       *"Make elements like tables and grids 100% wide."* Both are 100% now,
       so at 1280 a strip and a plate are 1256px — the whole of the column,
       which is exactly what the retired clause said they must not be. The
       clause was NEVER the point of this check and its own words say so: the
       point is that the strip and the buses it sends into are ONE OBJECT, and
       one object means ONE WIDTH, whatever that width is. So the equality
       stands unchanged and the sentence now says what the equality means.
       (`stripW > 400` stays: it is the check that neither body collapsed and
       made the equality vacuous — two zeroes are also equal.) */
    const stripW = shape[1280].per["voice|" + voices[0]].bw;
    const plateW = shape[1280].per["bus|main"].bw;
    ok(stripW > 400 && Math.abs(stripW - plateW) <= 1,
       "…and a strip and a plate take THE SAME width at 1280 (" + stripW +
       "px against " + plateW + "px) — whatever the column is, they are both " +
       "it; the strip and the buses it sends into are one object, which is " +
       "the whole of \"consistent\"", JSON.stringify({ stripW, plateW }));

    /* EVERY CONTROL REACHABLE — the half a tabbed surface puts at risk, over
       both of them: every voice's `mix` facet AND every bus tab. */
    const reach = await perTab(() => page.evaluate(() => {
      const s = document.querySelector("#voicemix .nu-strip");
      return [...s.querySelectorAll("[data-k]")].map((n) => n.dataset.k);
    }));
    const readPlate = () => page.evaluate(() => {
      const p = document.querySelector("#boardpanel #rack .nu-plate");
      // `data-sel` FIRST: ui/selects.js stamps a menu with BOTH — `data-sel`
      // is the registry key (`master|space`) and `data-k` is the widget's own
      // handle (`sel|master|space`) — and the registry key is what this walk
      // is checking reachability of.
      return [...p.querySelectorAll("[data-k],[data-sel]")]
        .map((n) => n.dataset.sel || n.dataset.k);
    });
    const busReach = await perBus(readPlate);
    /* ...AND THE FIFTH PLATE'S KEYS JOIN THE WALK, 2026-09-02 (slice 2e). The
       automation grid was never in this list — it was appended to the board's
       HOST and stood under every plate, so its keys belonged to no tab and the
       `dupes` walk below could not see them. It is `PLATES.auto` now and it
       brings THREE namespaces of its own: the cells' `t|<voice>|<secId>` (old,
       unmoved), and two this wave minted — `col|<voice.name>` on a column head
       (Paul, B11: "when I click on the column head let me edit the
       instrument!") and `row|<secId>` on a section's own jump ("I need to be
       able to jump to a section somehow, by clicking on them"). None of the
       three may collide with a strip's `b|…`/`ins|…` or a plate's `bus|…`, and
       `dupes` is the check that says so. */
    await openAuto();
    const autoReach = [["auto", await readPlate()]];
    const chansOrder = await page.evaluate(() =>
      window.NuDeskDoc.channelVoicesOf(window.__eightDoc(), window.NuGenres.GENRES)
        .map((c) => c.voice.name));
    // every voice's strip must offer the SAME control vocabulary, differing
    // only in the voice's own name — that is what "every control reachable"
    // means when the strips are drawn one at a time.
    const shapeOf = (name, keys) => keys.map((k) =>
      k.split("|").filter((x) => x !== name).join("|")).sort();
    const first = reach[0] ? shapeOf(reach[0][0], reach[0][1]) : [];
    const odd = reach.filter(([n, keys]) => !eq(shapeOf(n, keys), first));
    ok(reach.length === chansOrder.length && first.length > 0 && !odd.length,
       "EVERY CONTROL REACHABLE: all " + reach.length + " voices' `mix` marks " +
       "open a strip carrying the same " + first.length + " controls, " +
       "differing only in the voice's own name — nothing was dropped in the " +
       "move out of the board",
       JSON.stringify(odd.map(([n, keys]) => n + ": " +
         JSON.stringify(shapeOf(n, keys)))));
    // ...AND EVERY BUS CONTROL THE REGISTRY DECLARES IS ON EXACTLY ONE TAB.
    // The want-list is fields.js's own (every engine bus's every knob, plus
    // the master's fields and the record gain), so a knob that fell off a
    // plate in the move fails here by being unreachable rather than by being
    // noticed.
    const busKeysDrawn = {};
    for (const [k, keys] of busReach.concat(autoReach)) for (const key of keys)
      (busKeysDrawn[key] = busKeysDrawn[key] || []).push(k);
    const wantBus = [];
    for (const b of F.BUSES) { if (!b.engine) continue;
      for (const kn of b.knobs) {
        if (SLOTKNOB(kn.key)) continue;    // conditional on its seat — SLOTKNOB
        wantBus.push("bus|" + b.bus + "|" + kn.key); } }
    for (const f of F.MASTER) wantBus.push("master|" + f.key);
    wantBus.push("level");                        // the record gain, on the main
    const unreachable = wantBus.filter((k) => !busKeysDrawn[k]);
    const twice = Object.entries(busKeysDrawn).filter(([, v]) => v.length > 1);
    /* THE AUTOMATION PLATE'S OWN THREE, asserted BY NAME rather than left to
       the registry walk: the registry does not declare a column head or a row
       jump, so `unreachable` cannot notice either one going missing. One
       `col|` per channel, one `row|` per section, and the cells unchanged. */
    const autoKeys = autoReach[0][1];
    const wantCols = chansOrder.map((n) => "col|" + n);
    const wantRows = await page.evaluate(() =>
      window.__eightDoc().form.sections.map((s2) => "row|" + s2.id));
    const missCol = wantCols.filter((k) => autoKeys.indexOf(k) < 0);
    const missRow = wantRows.filter((k) => autoKeys.indexOf(k) < 0);
    ok(!unreachable.length && !twice.length,
       "…and all " + wantBus.length + " bus and master controls the registry " +
       "declares are reachable, each on EXACTLY ONE tab — the plates moved " +
       "line for line, nothing was left behind and nothing is drawn twice",
       JSON.stringify({ unreachable, twice }));
    ok(wantCols.length > 0 && wantRows.length > 0 &&
       !missCol.length && !missRow.length,
       "…AND THE AUTOMATION PLATE OFFERS ONE `col|<voice>` PER CHANNEL AND " +
       "ONE `row|<section>` PER SECTION — " + wantCols.length + " column " +
       "heads that open a player's instrument and " + wantRows.length + " row " +
       "heads that put the ear there (Paul, B11: \"when I click on the column " +
       "head let me edit the instrument\" / \"I need to be able to jump to a " +
       "section somehow\")", JSON.stringify({ missCol, missRow }));
    const dupes = (() => { const seen = new Set(), d = [];
      for (const [, keys] of reach.concat(busReach).concat(autoReach)) for (const k of keys) {
        if (seen.has(k)) d.push(k); seen.add(k); }
      return d; })();
    ok(!dupes.length,
       "…and no two tabs draw the same `data-k` — the keys stay unique across " +
       "the whole walk, so focus restoration and this gate's own drives can " +
       "never land on the wrong voice or the wrong bus", JSON.stringify(dupes.slice(0, 6)));

    /* EVERY REFUSAL STILL SENTENCED, ON ITS OWN TAB. A refusal whose reason
       is on another tab is the silent grey the board's header forbids, and
       the move is exactly the accident that would cause one. Asked of every
       tab: each disabled control carries `data-why`, and its words are
       printed in the panel it lives in. */
    const naked = [];
    /* THE SCOPE IS THE SURFACE THE CONTROL IS ON, 2026-08-28 — `#boardpanel`
       for a plate and `#voicemix` for a strip. It was `#boardpanel` for both
       while the board drew the strips; reading a strip's refusals out of
       `#boardpanel` now would find NONE and report a clean page, which is this
       block's own named hazard ("a check faithful to a scope that does not
       contain the thing"). The CLAIM is untouched and is the standing law: a
       disabled control carries `data-why` AND its words are printed beside it,
       because a silent grey is the bug and a reason on another screen is a
       silent grey. */
    const readRefusals = (sel) => () => page.evaluate((q) => {
      const panel = document.querySelector(q);
      if (!panel) return [];
      const text = panel.innerText;
      return [...panel.querySelectorAll("[disabled],[aria-disabled='true']")]
        .map((c) => ({ k: c.dataset.k || c.dataset.sel ||
                          c.getAttribute("aria-label") || c.tagName,
                       why: !!(c.dataset.why || "").trim(),
                       said: !!(c.dataset.why &&
                         (text.includes(c.dataset.why) ||
                          (c.closest(".nu-vs,.nu-sel,.nu-slot,p") || panel)
                            .querySelector(".nu-why"))) }));
    }, sel);
    const sentenced = (await perTab(readRefusals("#voicemix")))
      .concat(await perBus(readRefusals("#boardpanel")));
    let refusals = 0;
    for (const [tab, list] of sentenced) for (const c of list) {
      refusals++;
      if (!c.why || !c.said) naked.push(tab + ": " + c.k);
    }
    ok(refusals > 0 && !naked.length,
       "EVERY REFUSAL KEEPS ITS SENTENCE WHERE IT LIVES — all " + refusals +
       " disabled controls across the " + sentenced.length + " surfaces (a " +
       "strip per voice, a plate per bus) carry `data-why` AND print their " +
       "reason beside them (a silent grey is the bug, and a reason on another " +
       "screen is a silent grey)",
       JSON.stringify(naked));

    /* AND THE PAGE DOES NOT MOVE WHEN YOU CHANGE TABS (the anchor law:
       ui/eight.js's whole `anchorWant` machinery exists because Paul's page
       used to scroll itself under a still thumb). Nothing above `#boardpanel`
       is rebuilt on a tap, so this should be zero BY CONSTRUCTION — which is
       exactly the kind of claim that is worth measuring rather than reasoning
       about, and MORE worth it now that a tap can swap a 1,007px strip for a
       471px plate and shorten the document under the thumb.

       IT IS DRIVEN FROM THE GUTTER NOW, 2026-09-02 (slice 2e), and the change
       makes it a STRONGER question rather than a rewritten one. It read
       `document.getElementById("boardtabs")` and clicked every button in that
       row; this file's own map named the hazard of leaving it there — "driving
       the five from the gutter instead makes this loop iterate zero buttons
       and pass vacuously, the same silent-green shape this file was already
       caught by." So it clicks the five children in `#nu-tray` and measures
       two things that used to be one: `scrollY`, and the position of the
       PANEL, which is now the top thing on the board (there is no row above it
       to hold still). A tap that scrolls the page or moves the panel under the
       thumb fails here at either width. */
    for (const w of [390, 1280]) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.waitForTimeout(150);
      await topTab("Mix");
      const moved = await page.evaluate(async () => {
        const panel = document.getElementById("boardpanel");
        const rows = [...document.querySelectorAll('#nu-tray [data-k^="boardtab|"]')];
        scrollTo(0, Math.max(0, panel.getBoundingClientRect().top + scrollY - 120));
        await new Promise((r) => setTimeout(r, 200));
        const out = [];
        for (const b of rows) {
          const y = scrollY, top = Math.round(panel.getBoundingClientRect().top);
          b.click();
          await new Promise((r) => setTimeout(r, 260));
          out.push({ tab: b.dataset.k, dY: scrollY - y,
                     dRow: Math.round(panel.getBoundingClientRect().top) - top });
        }
        return out;
      });
      const jumped = moved.filter((m) => m.dY !== 0 || m.dRow !== 0);
      ok(moved.length === 5 && !jumped.length,
         "at " + w + ": tapping each of the " + moved.length + " children of " +
         "the Mix icon — the four stages of the series and the automation " +
         "grid — moves neither scrollY nor the board's panel itself — the " +
         "page does not move under the thumb (dY " +
         JSON.stringify(moved.map((m) => m.dY)) + ")",
         JSON.stringify(jumped));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await openBus(busKeys[0]);
  }

  ok(!errs.length, "the page raised no console error while the board was driven",
     errs.slice(0, 4).join(" | "));
  await browser.close();
  }
}

console.log("\n" + (fails ? "FAILED " + fails + " of " + checks
                          : "all " + checks + " checks pass"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
