#!/usr/bin/env node
// tools/ableton/als-gate.js — the four gates of PROGRAM.md §5's Ableton row.
// Zero dependencies. Exit non-zero and name the first failure.
//
//   Gate 0  well-formed, every pointee id unique, NextPointeeId above them all
//   Gate 1  round-trip, ASKING THE SONG AND NOT THE XML
//   Gate 2  donor conformance — and it REFUSES <Locator>, on purpose
//   Gate 3  sample audit, plus the donor's own absolute-path hazard
//   Gate 4  Live. Paul's machine. Printed by the CLI, never by a machine here.
//
// WHY GATE 1 RE-DERIVES THE SCORE. "TEST THE ARTIFACT: gates must read the
// RENDERED output; three features shipped broken while every check passed."
// A gate that asserts "some notes exist" is that gate. This one recompiles the
// song through the same one entrance the CLI used (score-node.loadScore ->
// state.adoptSong) and compares the MULTISET of (MidiKey, Time, Duration,
// Velocity) per clip, plus the two totals. A dropped bar, a doubled clip, a
// swing offset rounded away — each of those changes the multiset.
//
// 2026-08-28 — THERE ARE NOW TWO DONORS, AND THIS GATE STILL USES ONE.
// `donor/Ableton2.als` (Live 12.4.5) joined `donor/Generic.als` (Live 12.4.3);
// the schema stamp is identical in both (MinorVersion 12.0_12402,
// SchemaChangeCount 5), so nothing here breaks and nothing here changes.
// Generic stays the splice base AND the sole Gate-2 conformance corpus ON
// PURPOSE: Ableton2 contains DrumGroupDevice / MultiSampler / SampleRef /
// AudioClip shapes the exporter has no business emitting before P2 exists, and
// widening the corpus to the union would quietly license every one of them.
// P2 is the moment to make the corpus `Generic ∪ Ableton2`, and not before.
// What Ableton2 DID settle is recorded where it belongs — donor/README.md and
// the header of nukernel/export/als.js. Both donors still have zero <Locator>,
// so the Gate 2 refusal below is as live as it was, and the ask it points at is
// now the single ask at the end of donor/README.md.
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { balancedAt, elementAfter, pointeeIds, paceView } from "../../nukernel/export/als.js";
import { loadScore } from "./score-node.mjs";

const TOKEN = /<(\/?)([A-Za-z0-9._]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g;
const attrsOf = (s) => (s.match(/([A-Za-z0-9._]+)\s*=\s*"/g) || [])
  .map((a) => a.replace(/\s*=\s*"$/, ""));
const val = (xml, tag) => { const m = new RegExp("<" + tag + ' Value="([^"]*)"').exec(xml); return m && m[1]; };

/** Every (tag, sorted attribute names) shape in a document. */
function shapes(xml) {
  const out = new Set();
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(xml))) {
    if (m[1] === "/") continue;
    out.add(m[2] + "[" + attrsOf(m[3]).sort().join(",") + "]");
  }
  return out;
}

/** Balance check over the whole document — the cheapest proof it is XML. */
function wellFormed(xml) {
  const stack = [];
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(xml))) {
    if (m[2].startsWith("?") || m[3].startsWith("?")) continue;
    if (m[1] === "/") {
      const top = stack.pop();
      if (top !== m[2]) return "closed </" + m[2] + "> while inside <" + top + ">";
    } else if (m[4] !== "/") stack.push(m[2]);
  }
  return stack.length ? "unclosed <" + stack[stack.length - 1] + ">" : null;
}

/** The tracks of a LiveSet, by EffectiveName, with their text. */
function tracksOf(xml) {
  const out = [];
  const re = /<(MidiTrack|AudioTrack|ReturnTrack) [^>]*Id="\d+"[^>]*>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [a, b] = balancedAt(xml, m.index);
    const text = xml.slice(a, b);
    const nm = /<EffectiveName Value="([^"]*)"/.exec(text);
    out.push({ name: nm ? nm[1] : "", text });
    re.lastIndex = b;
  }
  return out;
}

/** Every MidiClip inside a track, as { name, arrangement, notes[] }. */
function clipsOf(trackText) {
  const out = [];
  const re = /<MidiClip [^>]*>/g;
  let m;
  while ((m = re.exec(trackText))) {
    const [a, b] = balancedAt(trackText, m.index);
    const text = trackText.slice(a, b);
    const notes = [];
    const kt = /<KeyTrack Id="\d+">/g;
    let k;
    while ((k = kt.exec(text))) {
      const [ka, kb] = balancedAt(text, k.index);
      const one = text.slice(ka, kb);
      const key = +val(one, "MidiKey");
      for (const e of one.match(/<MidiNoteEvent [^>]*\/>/g) || []) {
        const g = (n) => +new RegExp(n + '="([^"]*)"').exec(e)[1];
        notes.push([key, g("Time"), g("Duration"), g("Velocity")]);
      }
      kt.lastIndex = kb;
    }
    out.push({ name: val(text, "Name"), start: +val(text, "CurrentStart"),
               end: +val(text, "CurrentEnd"), notes });
    re.lastIndex = b;
  }
  return out;
}

const key4 = (n) => n[0] + "|" + n[1].toFixed(9) + "|" + n[2].toFixed(9) + "|" + n[3];
const bag = (ns) => { const m = new Map(); for (const n of ns) m.set(key4(n), (m.get(key4(n)) || 0) + 1); return m; };
const bagEq = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
// Name the first disagreement, in the (Key,Time,Duration,Velocity) spelling —
// "172 want, 172 got" told me nothing the day the clamp bug landed.
const diffOf = (want, got) => {
  for (const [k, v] of want) if (got.get(k) !== v) return "want " + k + " x" + v + ", got x" + (got.get(k) || 0);
  for (const [k, v] of got) if (want.get(k) !== v) return "output has " + k + " x" + v + ", the song has none";
  return "sizes " + want.size + " vs " + got.size;
};

export async function runGates(file, { genre = null, song = null, score: scorePath = null, all = false, grid = true, engine = true } = {}) {
  const xml = gunzipSync(readFileSync(file)).toString("utf8");
  const donorXml = gunzipSync(readFileSync(new URL("./donor/Generic.als", import.meta.url))).toString("utf8");
  const fail = (g, msg) => { console.error("  FAIL  " + g + " — " + msg); return false; };
  const pass = (g, msg) => { console.log("  pass  " + g + " — " + msg); return true; };
  let ok = true;

  /* ---- Gate 0 ---------------------------------------------------------- */
  const bad = wellFormed(xml);
  if (bad) return fail("gate 0", "not well-formed: " + bad);
  // The whole clone-renumber failure class, in one predicate, so it can be
  // pointed at a deliberately broken copy below.
  const idCheck = (x) => {
    const ids = pointeeIds(x).map((p) => p.id);
    const seen = new Set(), dup = new Set();
    for (const i of ids) (seen.has(i) ? dup : seen).add(i);
    const next = +val(x, "NextPointeeId"), max = Math.max(...ids);
    if (dup.size) return { err: dup.size + " duplicated pointee ids, first " + [...dup][0] +
      " — a clone kept its donor's ids and Live will point an automation lane at the wrong knob" };
    if (!(next > max)) return { err: "NextPointeeId " + next + " is not above the max id " + max };
    return { n: ids.length, next, max };
  };
  const g0 = idCheck(xml);
  if (g0.err) ok = fail("gate 0", g0.err);
  else {
    // A PROBE, because a check nobody has seen fail is a check nobody has
    // tested. Duplicate one pointee id in a copy and assert gate 0 goes red.
    const probe = idCheck(xml.replace(/<AutomationTarget Id="(\d+)"/, '<AutomationTarget Id="1"'));
    if (!probe.err) ok = fail("gate 0", "the duplicate-id probe was NOT caught — the id check is broken");
    else pass("gate 0", "well-formed · " + g0.n + " pointee ids, 0 duplicated · NextPointeeId " +
      g0.next + " > " + g0.max + " · duplicate probe caught");
  }

  /* ---- Gate 1 ---------------------------------------------------------- */
  const score = await loadScore({ genre, songPath: song, scorePath, grid, engine });
  const donorNames = new Set(tracksOf(donorXml).map((t) => t.name));
  const boxes = all ? score.boxes : score.boxes.slice(0, 1);
  /** Compare a whole document against the recompiled song. Null = agrees. */
  const cmp = (x) => {
    const mine = tracksOf(x).filter((t) => !donorNames.has(t.name));
    const found = new Map();                     // clip name -> [session, arrangement]
    for (const t of mine) for (const c of clipsOf(t.text)) {
      if (!found.has(c.name)) found.set(c.name, []);
      found.get(c.name).push(c);
    }
    let want = 0, wantN = 0, err = null;
    // THE PACED VIEW IS THE EXPORTER'S OWN (2026-08-30, the tempo map): a
    // paced box's notes go into the set UN-stretched with the tempo moving
    // instead, so the expectation must be the same transform — als.js
    // paceView, one arithmetic, two readers. For every unpaced record k is 1
    // everywhere and `v.notes` is the identity, so this line changes nothing
    // that ever shipped. (The transform itself is proved against the PCM's
    // own bar seconds by test/smf-tempo.test.js, not here — a gate that
    // expected what the splice writes could not catch a wrong k on its own.)
    const views = paceView(boxes);
    for (const v of views) { const box = v.box;
    for (const lane of (all ? box.lanes : box.lanes.slice(0, 1))) {
      const name = box.name + " · " + lane.name;
      want += 2; wantN += lane.notes.length * 2;
      const got = found.get(name) || [];
      if (got.length !== 2) { err = err || ('clip "' + name + '" appears ' + got.length + " times, want 2 (session + arrangement)"); continue; }
      const w = bag(v.notes(lane.notes).map((n) => [Math.round(n.midi), n.beat, n.dur, Math.max(1, Math.min(127, Math.round(n.vel)))]));
      for (const c of got) if (!bagEq(w, bag(c.notes)))
        err = err || ('clip "' + name + '" note multiset differs from the song: ' +
          diffOf(w, bag(c.notes)));
    } }
    const flat = [...found.values()].flat();
    const gotN = flat.reduce((s2, c) => s2 + c.notes.length, 0);
    if (!err && flat.length !== want) err = "clip count " + flat.length + ", want " + want;
    if (!err && gotN !== wantN) err = "note count " + gotN + ", want " + wantN;
    return err ? { err } : { clips: flat.length, notes: gotN };
  };
  const g1 = cmp(xml);
  if (g1.err) ok = fail("gate 1", g1.err);
  else {
    // The same probe idea: delete ONE note event and assert the multiset check
    // notices. This is the gate that is supposed to catch a dropped bar.
    const probe = cmp(xml.replace(/<MidiNoteEvent [^>]*\/>/, ""));
    if (!probe.err) ok = fail("gate 1", "the dropped-note probe was NOT caught — the round-trip is not comparing anything");
    else pass("gate 1", g1.clips + " clips, " + g1.notes + " notes, every " +
      "(MidiKey,Time,Duration,Velocity) multiset equals the song's · dropped-note probe caught");
  }

  /* ---- Gate 2 ---------------------------------------------------------- */
  // DERIVED, NOT LISTED. The set of element shapes we author is exactly the
  // shapes the output has that the donor does not — so there is no hand-written
  // table of "tags the exporter emits" to drift out of date. That is the
  // standing law of this repo applied to a gate: the conversion is done by
  // EXTRACTION, never by hand.
  const donorShapes = shapes(donorXml);
  const novel = [...shapes(xml)].filter((s) => !donorShapes.has(s));
  if (novel.length) ok = fail("gate 2", novel.length + " element shape(s) the donor never wrote: " +
    novel.slice(0, 6).join("  ") + " — Live 12.4.3 wrote every other byte of this file; " +
    "an element it did not write is a guess, and a guess opens as an error dialog");
  else {
    // THE REFUSAL IS THE FEATURE, AND IT IS PROVED EVERY RUN. The donor has no
    // <Locator> — `<Locators><Locators /></Locators>` is empty at
    // Generic.xml:22520-22522 — so a locator is exactly the kind of element we
    // must not invent. Rather than trust that the check above would catch it,
    // the gate injects one into a copy and asserts the check FAILS. Keep this
    // here: it turns "should we ask Paul for a donor with a locator?" from a
    // judgement call into a mechanical trigger — the day somebody writes
    // locator export, this line goes red until the donor grows one.
    const probe = shapes(xml.replace("<Locators>", '<Locators><Locator Id="1" Time="0" Name="probe" Annotation="" />'));
    const caught = [...probe].some((s) => !donorShapes.has(s));
    if (!caught) ok = fail("gate 2", "the locator probe was NOT refused — the conformance check is broken");
    else pass("gate 2", "every element shape in the output was written by Live 12.4.3 itself · " +
      "<Locator> probe REFUSED (NEITHER donor has one; the single ask at the end " +
      "of donor/README.md is what changes that)");
  }

  /* ---- Gate O: the order Live insists on --------------------------------
     Paul, the first report from inside Live itself: "Track has more send
     knobs than set has return tracks" — on a file all five gates passed.
     Every element was Live's own, so gate 2 saw nothing; what was wrong was
     WHERE ours sat. Live writes ReturnTracks last in <Tracks>, and a track
     placed after them is read with the return list already closed, so its
     send knobs point at nothing. Order is not shape, so it needs its own
     gate: no regular track may follow a return. */
  {
    const te = xml.indexOf("<Tracks>"), tz = xml.indexOf("</Tracks>");
    const seq = [...xml.slice(te, tz).matchAll(/<(MidiTrack|AudioTrack|ReturnTrack) Id="(\d+)"/g)];
    const firstRet = seq.findIndex((m) => m[1] === "ReturnTrack");
    const late = firstRet === -1 ? [] : seq.slice(firstRet).filter((m) => m[1] !== "ReturnTrack");
    const nRet = seq.filter((m) => m[1] === "ReturnTrack").length;
    const maxSends = Math.max(0, ...seq.map((m) => {
      const a = xml.indexOf(m[0], te), b = xml.indexOf("</" + m[1] + ">", a);
      return (xml.slice(a, b).match(/<TrackSendHolder Id=/g) || []).length;
    }));
    if (late.length) ok = fail("gate O", late.length + " track(s) sit AFTER the returns (" +
      late.map((m) => m[1] + " " + m[2]).join(", ") + "); Live reads their sends against a closed return list");
    else if (maxSends > nRet) ok = fail("gate O", "a track carries " + maxSends +
      " send knobs but the set has " + nRet + " return tracks");
    else pass("gate O", seq.length - nRet + " tracks then " + nRet + " returns, in Live's order · " +
      maxSends + " send knob(s) per track, " + nRet + " returns to land on");
  }

  /* ---- Gate 3 ---------------------------------------------------------- */
  const count = (x, re) => (x.match(re) || []).length;
  const sampleRe = /<(SampleRef|UserSample|MultiSamplePart|OriginalSimpler)[\s/>]/g;
  const before = count(donorXml, sampleRe), after = count(xml, sampleRe);
  const paths = [...xml.matchAll(/<Path Value="([^"]+)"/g)].map((m) => m[1]);
  const donorPaths = new Set([...donorXml.matchAll(/<Path Value="([^"]+)"/g)].map((m) => m[1]));
  const newAbs = paths.filter((p) => !donorPaths.has(p) && /^(\/|[A-Za-z]:\\)/.test(p));
  if (after > before) ok = fail("gate 3", "the export introduced " + (after - before) +
    " sample reference(s); P0-P1 ship no samples");
  else if (newAbs.length) ok = fail("gate 3", "authored an absolute path: " + newAbs[0]);
  else pass("gate 3", "no new sample references (" + after + ", the donor's own) · no authored absolute paths");
  // The donor's own hazard, printed EVERY run rather than filed in a README:
  // the M4L device on 1-MIDI names /Users/ford/... and one Simple Delay preset
  // names /Users/nsh/... . Both travel with every export and both are a missing
  // device on any machine but the one that saved them.
  const abs = [...new Set(paths.filter((p) => /^\/Users\//.test(p)))];
  for (const p of abs)
    console.log("  WARN  gate 3 — an absolute macOS path the DONOR brought with it travels " +
      "with every export: " + p);

  /* ---- Gate T — the tempo map and the meter (2026-08-30) ---------------- */
  // A paced record must carry its map in the MainTrack's tempo envelope and
  // on the scenes; an UNPACED record must leave both EXACTLY as the donor
  // wrote them — the absent-is-today tripwire, asserted every run on every
  // record rather than only when somebody exports jingju.
  {
    const views = paceView(score.boxes);
    const paced = views.some((v) => v.k !== 1);
    // the tempo envelope: the one whose PointeeId is the <Tempo> element's
    // own AutomationTarget id, read out of the OUTPUT the way als.js reads
    // the donor
    const tEl = elementAfter(xml, "Tempo");
    const targ = tEl && /<AutomationTarget Id="(\d+)"/.exec(tEl.text);
    let envEvents = null;
    if (targ) {
      const re = /<AutomationEnvelope Id="\d+">/g;
      let m;
      while ((m = re.exec(xml))) {
        const [ea, eb] = balancedAt(xml, m.index);
        const one = xml.slice(ea, eb);
        if (one.includes('<PointeeId Value="' + targ[1] + '" />')) {
          envEvents = [...one.matchAll(/<FloatEvent Id="\d+" Time="([^"]+)" Value="([^"]+)" \/>/g)]
            .map((x) => ({ time: +x[1], bpm: +x[2] }));
          break;
        }
        re.lastIndex = eb;
      }
    }
    const sceneOn = (xml.match(/<IsTempoEnabled Value="true" \/>/g) || []).length;
    if (!paced) {
      const clean = envEvents && envEvents.length === 1 && envEvents[0].time < 0 && sceneOn === 0;
      if (!clean) ok = fail("gate T", "unpaced record, but the tempo surfaces moved: envelope has " +
        (envEvents ? envEvents.length : 0) + " FloatEvent(s), " + sceneOn + " scene(s) tempo-enabled");
      else pass("gate T", "unpaced: the donor's tempo envelope and scenes are untouched (1 sentinel event, 0 scenes enabled)");
    } else {
      const bpm = Math.max(1, +score.bpm || 120);
      const segs = [];
      let cur = null;
      for (const v of views) { const b = bpm / v.k;
        if (cur == null || b !== cur) { segs.push({ at: v.beat0, bpm: b }); cur = b; } }
      // expected: sentinel at segs[0].bpm, then a double point per change
      let err = null;
      if (!envEvents) err = "no tempo AutomationEnvelope in the output";
      else {
        const wantN = 1 + (segs.length - 1) * 2;
        if (envEvents.length !== wantN) err = "envelope has " + envEvents.length + " events, want " + wantN;
        else if (Math.abs(envEvents[0].bpm - segs[0].bpm) > 1e-9 || envEvents[0].time >= 0)
          err = "sentinel event is " + envEvents[0].bpm + " at " + envEvents[0].time + ", want " + segs[0].bpm;
        else for (let i = 1; i < segs.length; i++) {
          const a = envEvents[2 * i - 1], b = envEvents[2 * i];
          if (!a || !b || Math.abs(a.time - segs[i].at) > 1e-9 || Math.abs(b.time - segs[i].at) > 1e-9 ||
              Math.abs(a.bpm - segs[i - 1].bpm) > 1e-9 || Math.abs(b.bpm - segs[i].bpm) > 1e-9)
            err = err || ("step " + i + " at beat " + segs[i].at + " is not the double point (" +
              segs[i - 1].bpm + " -> " + segs[i].bpm + ")");
        }
      }
      if (!err && all) {
        const wantScenes = views.filter((v) => v.k !== 1).length;
        if (sceneOn !== wantScenes) err = sceneOn + " scene(s) tempo-enabled, want " + wantScenes;
      }
      if (err) ok = fail("gate T", err);
      else pass("gate T", "paced: " + segs.length + " tempo segment(s) in the envelope as double-point steps" +
        (all ? " · " + views.filter((v) => v.k !== 1).length + " scene launch tempo(s)" : "") +
        " — CONFIRM IN LIVE with gate 4; the step encoding is inferred (donor/README.md ask)");
    }
    // ...and the meter: a declared signature must be on every authored clip,
    // and every box's beats must come out in whole bars of it.
    if (score.meterAbc) {
      const sm = /^(\d+)\/(\d+)$/.exec(score.meterAbc);
      const barBeats = sm ? (+sm[1] * 4) / +sm[2] : 4;
      const mine = tracksOf(xml).filter((t) => !donorNames.has(t.name));
      let bad = null, n = 0;
      for (const t of mine) {
        for (const c of t.text.matchAll(/<RemoteableTimeSignature Id="\d+">\s*<Numerator Value="(\d+)" \/>\s*<Denominator Value="(\d+)" \/>/g)) {
          n++;
          if (+c[1] !== +sm[1] || +c[2] !== +sm[2]) bad = bad || (c[1] + "/" + c[2] + " on " + t.name);
        }
      }
      const offBar = views.find((v) => Math.abs(v.beats / barBeats - Math.round(v.beats / barBeats)) > 1e-6);
      if (bad) ok = fail("gate T", "clip signature " + bad + ", want " + score.meterAbc);
      else if (!n) ok = fail("gate T", "meter " + score.meterAbc + " declared but no authored clip carries a RemoteableTimeSignature");
      else if (offBar) ok = fail("gate T", "a box's " + offBar.beats + " beats is not whole bars of " + score.meterAbc);
      else pass("gate T", "meter " + score.meterAbc + " on all " + n + " authored clips · every box is whole bars of " + barBeats + " beats");
    }
  }

  return ok;
}

// Run only when node was pointed AT THIS FILE. `endsWith(argv[1])` used to
// stand here and it threw under `node -e "import(...)"`, where argv[1] is
// undefined — which is exactly how the CLI imports this module for its own
// --gate pass.
const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith("--"));
  const at = (f) => { const i = argv.indexOf(f); return i < 0 ? null : argv[i + 1]; };
  if (!file) { console.log("usage: node tools/ableton/als-gate.js <out.als> (--genre <key> | --song <file.json> | --score <file.json>) [--all] [--rubato] [--no-engine]"); process.exit(2); }
  runGates(file, { genre: at("--genre"), song: at("--song"), score: at("--score"), all: argv.includes("--all"),
                   grid: !argv.includes("--rubato"), engine: !argv.includes("--no-engine") })
    .then((ok) => {
      // GATE 4 IS THE LAST LINE, whichever way you got here. The CLI prints it
      // too; a run of `export-als.js && als-gate.js` must not end on a Gate 3
      // warning, because the last line is the only line anybody reads and the
      // ask is the whole point of the exercise. Only Live proves a set opens.
      if (ok) {
        console.log("");
        console.log('GATE 4 — PAUL: open "' + resolve(file) + '" in Live 12 and say whether it opens.');
      }
      process.exit(ok ? 0 : 1);
    },
          (e) => { console.error("gate crashed: " + e.stack); process.exit(1); });
}
