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
const path = require("path");
const R = (p) => path.join(__dirname, p);

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
        derivedPartTone, deskChannelBase, mergeEq } = DESK;

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
  const parts = DD.deskPartsOf(doc, GENRES), fx = DD.boxFxOf(doc);
  for (const b of boxes) { b.parts = parts; b.fx = fx; }
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
  ok(eq(DD.boxFxOf(doc), []), "boxFxOf is []");
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
  doc.voices[0].desk = { fader: -2.5, lvl: "back", pan: "hl", rev: "wet",
                         echo: "touch", room: "none", eq: { lo: 0, mid: -1.5, hi: 2 },
                         fx: ["chorus"], mute: false, solo: false };
  doc.sound.buses = { rev: { name: "plate", ret: "hall", color: "plate" },
                      echo: { name: "slap", time: "d8", fb: "more", tone: "dark" } };
  doc.sound.master = { drive: "warm", glue: "glue", tape: "tape", space: "room" };
  doc.sound.fx = ["crunch"];
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
  ok(saved.parts && saved.parts.line && eq(saved.parts.line.fx, ["chorus"]),
     "a per-voice chip survives the round trip",
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
  const revs = Object.entries(units).filter(([k]) => k !== "kick")
    .map(([, u]) => u.rev);
  ok(revs.every((r) => near(r, 0.78)),
     "every unit asks for rev 0.78 — gregorian's own tone.verb",
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
  doc.voices[0].desk = { fader: -3, pan: "hl", echo: "some", eq: { hi: 4 },
                         fx: ["chorus"] };
  const box = pushBoxes(doc)[0];
  const units = deskUnits(mkUnits(), ADDR, box, null, null);
  ok(near(units.v0.lvl, 0.7079, 5e-5), "fader -3 dB is lvl 0.7079",
     String(units.v0.lvl));
  ok(near(units.v0.pan, -0.35), "pan `hl` is -0.35", String(units.v0.pan));
  ok(near(units.v0.del, 0.3), "echo `some` is del 0.3", String(units.v0.del));
  ok(units.v0.inserts && units.v0.inserts[0] &&
     units.v0.inserts[0].module === "insert_chorus",
     "a chip is an insert named insert_chorus",
     JSON.stringify(units.v0.inserts));
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
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForSelector("#boardtbl", { timeout: 20000 });

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
  const sel = await page.evaluate(() => [...document.querySelectorAll("select")]
    .filter((s) => !s.closest("#app"))
    .map((s) => ({ k: s.dataset.k || s.id || s.getAttribute("aria-label") || "?",
                   sel: s.dataset.sel || null,
                   strip: !!s.closest("#boardtbl") })));
  const onStrip = sel.filter((s) => s.strip);
  const notRack = sel.filter((s) => !/^(master|bus)\|/.test(s.sel || ""));
  ok(onStrip.length === 0,
     "NOT ONE DROPDOWN ON THE CHANNEL STRIP — the twenty-three per-instrument " +
     "menus of 2026-08-24 are still knobs (Paul: \"the options for each " +
     "instrument in a song section are now just one thing in a dropdown. " +
     "That's not effective\"). The master's own fifteen are a different " +
     "sentence and are check 3.",
     JSON.stringify(onStrip.map((s) => s.k)));
  ok(notRack.length === 0,
     "…and every other <select> outside #app is one of the rack's own, drawn " +
     "by ui/selects.js — the atlas's three navigation menus are still deleted " +
     "outright and the accessible path is the globe's marks (test/atlas.js G11)",
     JSON.stringify(notRack.map((s) => s.k)));

  /* ---- 2 · every word the board used to offer is still reachable ----
     Not "a knob exists" — the knob is DRIVEN across its whole travel and the
     word it prints at every stop is collected, because a range with the wrong
     max silently hides its last detent and would pass any check that only
     counted controls. */
  const TBL = { pan: { table: F.PANS, labels: F.PANLABEL },
                rev: { table: F.SENDS, labels: F.SENDLABEL },
                echo: { table: F.SENDS, labels: F.SENDLABEL },
                room: { table: F.SENDS, labels: F.SENDLABEL } };
  const swept = await page.evaluate((TB) => {
    const out = {};
    for (const el of document.querySelectorAll('#boardtbl input[type=range]')) {
      const m = /^b\|(pan|rev|echo|room)\|(.+)$/.exec(el.dataset.k || "");
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
  }, TBL);
  const chansOnPage = await page.evaluate(() =>
    [...document.querySelectorAll("#boardtbl thead th.nu-ch")].map((t) => t.dataset.ch));
  ok(Object.keys(swept).length === chansOnPage.length * 4,
     chansOnPage.length + " channels × 4 knobs = " + Object.keys(swept).length +
     " (place + the three sends, one pot each)", JSON.stringify(chansOnPage));
  const missing = [], crooked = [];
  for (const [k, words] of Object.entries(swept)) {
    const field = k.split("|")[0], T = TBL[field];
    const want = Object.keys(T.table).map((x) => T.labels[x] || x);
    for (const w of want) if (!words.includes(w)) missing.push(k + " has no " + w);
    if (!words.includes("as it stands")) missing.push(k + " has no empty detent");
    // A SLIDER OVER WORDS IS ONLY HONEST IF THE WORDS ARE A SCALE. Map each
    // stop back to fields.js's own number (the blank resolves the way
    // resolvePartMix({}) resolves it) and insist the run never goes backwards.
    const back = {};
    for (const x of Object.keys(T.table)) back[T.labels[x] || x] = T.table[x];
    back["as it stands"] = F.resolvePartMix({})[field === "echo" ? "del" : field];
    const ns = words.map((w) => back[w]);
    for (let i = 1; i < ns.length; i++)
      if (!(ns[i] >= ns[i - 1])) crooked.push(k + ": " + words.join(" ") +
        " -> " + ns.join(" "));
  }
  ok(!missing.length, "every word the dropdowns offered is still on a knob",
     missing.join("; "));
  ok(!crooked.length, "…and every knob runs in fields.js's own numeric order, " +
     "with the blank detent AT its own number", crooked.join("; "));

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
  const sheets = await page.evaluate(() => {
    const out = {};
    for (const f of document.querySelectorAll("fieldset.nu-sheet")) {
      if (!/^(master|bus)\|/.test(f.dataset.sheet)) continue;
      out[f.dataset.sheet] = [...f.querySelectorAll(".nu-opt")].map((o) => o.dataset.v);
    }
    // ...AND THE SAME ROWS AS MENUS. An <option>'s `data-v` is the word the
    // sheet's `.nu-opt` carried under the same name (ui/selects.js writes it
    // for exactly this reason), so the two shapes read back identically and
    // the option-by-option check below is unchanged.
    for (const s2 of document.querySelectorAll("select[data-sel]")) {
      if (!/^(master|bus)\|/.test(s2.dataset.sel)) continue;
      out[s2.dataset.sel] = [...s2.options].map((o) => o.dataset.v);
    }
    return out;
  });
  // ONCE EACH, NOT ONE PER CHANNEL — said as a count as well as by key, because
  // "one drive for the whole record" is a claim about how MANY were drawn and a
  // map keyed by name cannot fail on a duplicate.
  const drawnRack = await page.evaluate(() =>
    [...document.querySelectorAll('select[data-sel], fieldset.nu-sheet')]
      .map((n2) => n2.dataset.sel || n2.dataset.sheet)
      .filter((k) => /^(master|bus)\|/.test(k || "")));
  const want = [];
  for (const f of F.MASTER) want.push(["master|" + f.key, f.table]);
  for (const b of F.BUSES) for (const k of b.knobs)
    want.push(["bus|" + b.bus + "|" + k.key, k.table]);
  const gone = [], short = [];
  for (const [key, table] of want) {
    const got = sheets[key];
    if (!got) { gone.push(key); continue; }
    const need = [""].concat(Object.keys(table));
    for (const v of need) if (!got.includes(v)) short.push(key + " has no " + (v || "(blank)"));
  }
  ok(!gone.length, "all " + want.length + " master and bus choices are drawn at " +
     "the master end — one each for the whole record, not one per channel",
     gone.join(", "));
  ok(drawnRack.length === want.length,
     "…and drawn ONCE each: " + drawnRack.length + " controls for " + want.length +
     " rows", JSON.stringify(drawnRack));
  ok(!short.length, "…and every option each one offers is its fields.js table's own",
     short.join("; "));
  const perChannelSheet = Object.keys(sheets).filter((k) =>
    chansOnPage.some((c) => k.endsWith("|" + c)));
  ok(!perChannelSheet.length, "no master control is drawn per channel",
     perChannelSheet.join(", "));

  /* ---- 4 · the numbers it draws are still the desk's ----
     The fill is deskChannelBase().gain, computed HERE off the same shipped
     record and compared with what the browser wrote into the meter's own title.
     A board that drew its own arithmetic would pass every check above. */
  const box = pushBoxes(clone(TERMS))[0];
  const drawn = await page.evaluate(() => {
    const out = {};
    for (const tr of document.querySelectorAll('#boardtbl tr[data-row="fader"]')) {
      const tds = [...tr.querySelectorAll("td")];
      const th = [...document.querySelectorAll("#boardtbl thead th.nu-ch")];
      tds.forEach((td, i) => {
        const m = td.querySelector("meter"), o = td.querySelector("output");
        out[th[i].dataset.ch] = { fill: m && m.value,
          title: m && m.title, off: o && o.textContent };
      });
    }
    return out;
  });
  const F_LO = -36, F_HI = 12;                       // engineer.js gainToF, quoted
  const gainToF = (g) => Math.max(0, Math.min(1,
    (20 * Math.log10(Math.max(1e-4, g)) - F_LO) / (F_HI - F_LO)));
  const wrongFill = [], wrongOff = [];
  for (const key of Object.keys(drawn)) {
    const g = deskChannelBase(box, key).gain;
    if (!near(drawn[key].fill, gainToF(g), 1e-3))
      wrongFill.push(key + ": drew " + drawn[key].fill + ", desk says " + gainToF(g));
    // ...and the OTHER half of "show both without lying": the number beside the
    // bar is YOUR offset (0.0 dB on a record with no desk), never the automation
    if (drawn[key].off !== "0.0") wrongOff.push(key + ": " + drawn[key].off);
  }
  ok(Object.keys(drawn).length === chansOnPage.length,
     "every channel still draws a meter and an offset", JSON.stringify(Object.keys(drawn)));
  ok(!wrongFill.length, "every meter is deskChannelBase().gain through gainToF — " +
     "the automation, not the board's own arithmetic", wrongFill.join("; "));
  ok(!wrongOff.length, "…and the number beside it is the stored offset, 0.0 dB " +
     "on a record whose voices carry no desk", wrongOff.join("; "));

  /* ---- 5 · the knob writes the document's own word, and unwrites it ---- */
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
    drive("as it stands"); await wait();
    return { found, set, back: deskOf() === undefined };
  });
  ok(trip.found && trip.set && trip.set.rev === "wet",
     "driving the cantor's reverb pot to `wet` writes voice.desk.rev = \"wet\"",
     JSON.stringify(trip.set));
  ok(trip.back === true,
     "…and driving it back to the blank detent DELETES the key — absent is the " +
     "only spelling of a default (desk-doc.js:154)");

  ok(!errs.length, "the page raised no console error while the board was driven",
     errs.slice(0, 4).join(" | "));
  await browser.close();
  }
}

console.log("\n" + (fails ? "FAILED " + fails + " of " + checks
                          : "all " + checks + " checks pass"));
process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
