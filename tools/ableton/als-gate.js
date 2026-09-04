#!/usr/bin/env node
// tools/ableton/als-gate.js — the four gates of PROGRAM.md §5's Ableton row.
// Zero dependencies. Exit non-zero and name the first failure.
//
//   Gate 0  well-formed, every pointee id unique, NextPointeeId above them all
//   Gate U  every Id unique inside its OWN parent's list — the other key space,
//           and the sentence Live refused a v261 export with ("Non-unique list
//           ids"); the four donors are the control and are scanned every run
//   Gate 1  round-trip, ASKING THE SONG AND NOT THE XML
//   Gate 2  donor conformance — and it REFUSES <Locator>, on purpose
//   Gate 3  sample audit, plus the donor's own absolute-path hazard
//   Gate 4  Live. Paul's machine. Printed by the CLI, never by a machine here.
//   Gate O  the ORDER Live insists on: no regular track after a return
//   Gate M  the mix tables have not drifted from their owners
//   Gate T  the tempo map and the meter
// ...and the two the GROOVE round added on 2026-09-03, when Paul asked whether
// the feel survives the trip and why every clip is the same colour:
//   Gate R  the FEEL is in the file — the swing, the groove's push, the hand's
//           nudge and the humanize drift arrive as real off-grid Times, the
//           file's own numbers equal the engine's, a machine record stays on
//           the grid, and a quantise probe proves the check can see it
//   Gate C  every clip wears its track's colour, every track wears its part
//           family's, and the donor's own tracks keep the colours Live gave them
// ...and the five the P3 round added on 2026-09-03, when the export started
// writing the SOUND and not only the notes:
//   Gate P  every PointeeId resolves to an AutomationTarget that exists
//   Gate E  the tone the chair asked for is IN THE FILE, read back out of it,
//           and a record that composed automation carries some
//   Gate A  export/score.js MOT_LANES vs audio/desk.js compileAuto
//   Gate F  live-devices.js FX_PARAMS vs fields.js FX
//   Gate Q  live-devices.js resOfQ vs audio/to-engine.js toneRecipe
// ...and the three the ANSWERS round added on 2026-09-03, when Paul's third
// donor closed the master-chain row and one of the two refused enums:
//   Gate S  the two enums, asserted against the donors THEMSELVES — the
//           highpass Paul switched, the sync switches he turned on, and (since
//           donor 4) the sixteenth BUTTON TABLE the synced echo is written
//           with, against every Delay in all four files
//   Gate G  live-devices.js MASTER_DRIVES/GLUES/CEILINGS vs fields.js
//   Gate B  the master BUS in the file: a record with a `master` carries the
//           devices its words ask for with every knob inside the range the
//           donor prints, and a record without one leaves the donor's MainTrack
//           untouched — plus a SYNTHETIC full master, because almost no record
//           has one and `width` and `tilt` would otherwise never be read back
// ...and the one the ANSWERS2 round added on 2026-09-03, when Paul's fourth
// donor settled the sixteenth table and brought the two devices two chips had
// been going without:
//   Gate D  donor 4's devices — `phaser` on a PhaserNew (it had NO device at
//           all) and `crunch` on an Amp + Cabinet (Roar could say two of its
//           nine knobs), built against the real library, every knob inside the
//           donor's printed range, and read back out of the file when the
//           record names one
//
// WHY GATE 1 RE-DERIVES THE SCORE. "TEST THE ARTIFACT: gates must read the
// RENDERED output; three features shipped broken while every check passed."
// A gate that asserts "some notes exist" is that gate. This one recompiles the
// song through the same one entrance the CLI used (score-node.loadScore ->
// state.adoptSong) and compares the MULTISET of (MidiKey, Time, Duration,
// Velocity) per clip, plus the two totals. A dropped bar, a doubled clip, a
// swing offset rounded away — each of those changes the multiset.
//
// 2026-08-31 — AND NOW IT USES BOTH, BECAUSE THE EXPORT DOES. The note below
// set the condition exactly right and then the condition arrived: "P2 is the
// moment to make the corpus `Generic ∪ Ableton2`, and not before." The moment
// is Paul asking for the drum rack he supplied — "I gave you lots of
// instruments including a drum rack and you're using only operator and drift" —
// and the exporter now splices `1-DS Drum Rack` out of Ableton2 for the drums
// lane. Its shapes (DrumGroupDevice, DrumBranch, InstrumentGroupDevice,
// MidiToAudioDeviceChain) and its ten `/Applications/Ableton Live 12 Suite.app`
// paths are LIVE'S OWN, out of a committed donor, so the corpus is the union
// and the licence the note worried about is granted DELIBERATELY rather than
// quietly. What is NOT granted: the corpus is still two files Live wrote, so an
// element in neither is still a guess and still fails — which is the whole
// point, and the <Locator> refusal below still proves it every run.
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
import { balancedAt, elementAfter, pointeeIds, paceView, addDevice,
         columnNames, clipNameOf, colorOfLane, TRACK_COLOR,
         CHAIR_LEVEL, LEVEL_GAIN,
         // gate X re-runs the whole writer twice with one cell offset between
         // the runs, which is the only way to read a per-cell envelope OUT OF
         // THE FILE rather than out of the plan (TABLE.md wave 3)
         alsFromScore } from "../../nukernel/export/als.js";
import { instrumentTagOf, deviceOf, instrumentParams, paramRange, getParam,
         // gate X finds a knob's envelope the way Live does — by the
         // AutomationTarget id the Mixer prints beside it
         targetIdOf,
         resOfQ, FX_PARAMS, KIT_FILTER, deviceLibrary, masterDevices, buildFx,
         chipParams, delaySyncIndex, delaySixteenthsAt, AF_LOWPASS, AF_HIGHPASS,
         DELAY_SYNC_MAX, DELAY_SYNC_BUTTONS, DELAY_SYNC_WITNESSES,
         MASTER_DRIVES, MASTER_GLUES, MASTER_CEILINGS, MASTER_WIDTHS,
         MASTER_TILTS, MASTER_TILT_HZ, TILT_BANDS, tiltPaths,
         MASTER_HOMELESS } from "../../nukernel/export/live-devices.js";
import { MOT_LANES } from "../../nukernel/export/score.js";
import { createRequire } from "node:module";
import { loadScore } from "./score-node.mjs";

/* WHICH KNOBS THE MASTER MAPPING WRITES, so gate B can read exactly those
   back out of the file. It is the same list live-devices.js masterDevices
   sets, and a knob added there without being added here is simply unchecked —
   which is why the gate also compares the whole device's spliced XML through
   `getParam` rather than trusting this list to be the definition. */
const PARAMS_OF = {
  Saturator: ["BaseDrive", "DryWet"],
  GlueCompressor: ["Threshold", "Ratio", "Makeup"],
  StereoGain: ["StereoWidth"],
  Eq8: [...tiltPaths(TILT_BANDS.low), ...tiltPaths(TILT_BANDS.high)],
  Limiter: ["Ceiling", "Gain"],
};
/* The master chain in the order masterDevices builds it, which is fields.js
   MASTER's own order with the two words that have no device left out. */
const MASTER_TAGS = ["Saturator", "GlueCompressor", "StereoGain", "Eq8", "Limiter"];

const TOKEN = /<(\/?)([A-Za-z0-9._]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g;
const attrsOf = (s) => (s.match(/([A-Za-z0-9._]+)\s*=\s*"/g) || [])
  .map((a) => a.replace(/\s*=\s*"$/, ""));
const val = (xml, tag) => { const m = new RegExp("<" + tag + ' Value="([^"]*)"').exec(xml); return m && m[1]; };

/** Every (tag, sorted attribute names) shape in a document. */
// the one track of the second donor the exporter actually splices — so this
// gate's sample ceiling is raised by what we TAKE, not by everything Ableton2
// happens to contain (its Cabasa rack has 60 sampler zones we never touch)
function rackTrackOf(xml) {
  for (const m of xml.matchAll(/<MidiTrack Id="\d+"/g)) {
    const end = xml.indexOf("</MidiTrack>", m.index);
    const seg = xml.slice(m.index, end);
    if (seg.includes('<EffectiveName Value="1-DS Drum Rack"')) return seg;
  }
  return "";
}

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

/**
 * GATE U'S SCANNER — every parent element whose direct children repeat an Id.
 *
 * WHAT LIVE MEANS BY "Non-unique list ids" (Paul, 2026-09-03, on a v261 export
 * Live 12 refused to open). An `Id="…"` in this schema is the KEY OF A CHILD IN
 * ITS PARENT'S LIST — the Devices of a chain, the ClipSlots of a track, the
 * AutomationEnvelopes of a track, the Scenes of a set, the KeyTracks of a clip
 * — and two siblings may not share one. The key space is the PARENT'S, so the
 * check is per-parent and NOT document-wide (`Id="0"` appears thousands of
 * times in a legal set, once per list), and it is keyed by the ID ALONE and NOT
 * by (tag, id): the tags in one list differ and the ids still must not collide.
 * That reading is not a guess — all four donors, files Live itself wrote, are
 * clean under it, which is the control this gate re-runs on every single run so
 * that a false positive shows up as a donor failure rather than as a bug report.
 *
 * Distinct from gate 0, which owns the OTHER key space: pointee ids, which are
 * document-wide and are what `als.js renumber` rewrites. A file can be perfect
 * by gate 0 and refused by Live, and on 2026-09-03 every one of them was.
 */
function listDupes(xml) {
  const out = [];
  const stack = [{ tag: "#doc", path: "", kids: new Map() }];
  const finish = (f) => {
    for (const [id, hits] of f.kids) {
      if (hits.length < 2) continue;
      out.push({ path: f.path || "#doc", id, count: hits.length,
                 tags: [...new Set(hits.map((h) => h.tag))].join("+"),
                 lines: hits.map((h) => lineAt(xml, h.at)) });
    }
  };
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(xml))) {
    if (m[2].startsWith("?") || m[3].startsWith("?")) continue;
    if (m[1] === "/") { const f = stack.pop(); if (f) finish(f); continue; }
    const parent = stack[stack.length - 1];
    const id = /(?:^|\s)Id="([^"]*)"/.exec(m[3]);
    if (id && parent) {
      if (!parent.kids.has(id[1])) parent.kids.set(id[1], []);
      parent.kids.get(id[1]).push({ tag: m[2], at: m.index });
    }
    if (m[4] !== "/") stack.push({ tag: m[2], path: (parent ? parent.path : "") + "/" + m[2],
                                   kids: new Map() });
  }
  while (stack.length) finish(stack.pop());
  return out;
}
/** 1-based line number of a character offset — only ever called on a failure. */
function lineAt(xml, at) {
  let n = 1;
  for (let i = 0; i < at; i++) if (xml.charCodeAt(i) === 10) n++;
  return n;
}
/**
 * A DELIBERATELY DUPLICATED FIXTURE, built out of the document itself so the
 * probe cannot go stale: find the first parent that has two Id-bearing children
 * and give the second one the first one's id. A scanner that does not go red on
 * this is not scanning.
 */
function dupFixture(xml) {
  const stack = [{ kids: [] }];
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(xml))) {
    if (m[2].startsWith("?") || m[3].startsWith("?")) continue;
    if (m[1] === "/") { stack.pop(); continue; }
    const parent = stack[stack.length - 1];
    const id = /(?:^|\s)Id="([^"]*)"/.exec(m[3]);
    if (id && parent) {
      // the offset of the id VALUE inside the whole document (id[0] is
      // ` Id="…"`, so the value starts one quote back from its end)
      const at = m.index + m[0].indexOf(id[0]) + id[0].length - id[1].length - 1;
      if (parent.kids.length && parent.kids[0].id !== id[1])
        return xml.slice(0, at) + parent.kids[0].id + xml.slice(at + id[1].length);
      parent.kids.push({ id: id[1] });
    }
    if (m[4] !== "/") stack.push({ kids: [] });
  }
  return null;
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
    // the clip's OWN colour — the first `<Color>` in the element, which is the
    // clip's because a clip holds no device (gate C)
    const col = /<Color Value="(-?\d+)"/.exec(text);
    out.push({ name: val(text, "Name"), start: +val(text, "CurrentStart"),
               end: +val(text, "CurrentEnd"), color: col ? +col[1] : null, notes });
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
  // the second donor, which the drums lane is now spliced out of
  const rackXml = gunzipSync(readFileSync(new URL("./donor/Ableton2.als", import.meta.url))).toString("utf8");
  // ...and the third, which the master chain and both decoded enums come from
  const answersXml = gunzipSync(readFileSync(new URL("./donor/Answers.als", import.meta.url))).toString("utf8");
  // ...and the fourth, which settled the sixteenth table and brought the
  // Phaser, the Amp and the Cabinet (nukernel/export/fxrack2.js)
  const answers2Xml = gunzipSync(readFileSync(new URL("./donor/Answers2.als", import.meta.url))).toString("utf8");
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

  /* ---- Gate U — "Non-unique list ids", the sentence Live refused with ---
     2026-09-03. Paul: "Ableton can't load: Non-unique list ids." Gate 0 was
     green on that file and so was every other gate: gate 0 owns the POINTEE
     key space, and the id Live was complaining about is a different one — the
     key of a child in its parent's list. Three collisions were in the shipped
     sets, all of them devices, all of them the same cause: every device in this
     exporter is a photograph of a device that sat somewhere in a donor's chain
     and it arrives carrying THAT chain's key. `als.js addDevice` gives each one
     the next free id in the chain it lands in; this is the gate that says so.

     THE DONORS ARE THE CONTROL AND THEY ARE RE-RUN EVERY TIME, not once at
     development time: four files Live itself wrote, scanned by the same
     function, and if any of them ever goes red the scanner is wrong and not the
     export. That is the whole difference between a check and a superstition. */
  {
    const gU = listDupes(xml);
    const donors = [["Generic", donorXml], ["Ableton2", rackXml],
                    ["Answers", answersXml], ["Answers2", answers2Xml]];
    const dirtyDonor = donors.map(([n, x]) => [n, listDupes(x)]).find(([, d]) => d.length);
    if (gU.length) {
      const c = gU[0];
      ok = fail("gate U", gU.length + " list(s) with a repeated Id — Live refuses this file " +
        'with "Non-unique list ids". First: ' + c.path + ' holds ' + c.count + " <" + c.tags +
        ' Id="' + c.id + '"> children, at lines ' + c.lines.join(", ") +
        (gU.length > 1 ? " (and " + (gU.length - 1) + " more)" : ""));
    } else if (dirtyDonor) {
      ok = fail("gate U", "the scan flags donor " + dirtyDonor[0] + ", a file LIVE wrote — " +
        dirtyDonor[1][0].path + ' Id="' + dirtyDonor[1][0].id + '". The scanner is wrong, ' +
        "not the export; fix listDupes before trusting a failure above.");
    } else {
      const fixture = dupFixture(xml);
      if (!fixture) ok = fail("gate U", "no two Id-bearing siblings anywhere in the document — " +
        "the probe cannot be built, so this gate proved nothing");
      else if (!listDupes(fixture).length)
        ok = fail("gate U", "the duplicated-id fixture was NOT caught — the per-list scan is blind");
      else {
        /* ...AND THE EXACT REGRESSION, PINNED WHERE THE RECORD CANNOT HIDE IT.
           The scan above only sees what THIS record happened to build, and a
           `boombap` with no `mot: rise` and no master words builds neither of
           the two chains that were broken. So the splice itself is asserted:
           the same donor device, photographed once and added twice, is what
           `mot: rise` does (one AutoFilter2 template, a lowpass and a highpass)
           and what a master chain does (Generic's Eq8 at Id 3 beside Answers'
           Limiter at Id 3), and both must land on different keys. */
        const one = '<AutoFilter2 Id="1"><Name Value="x" /></AutoFilter2>';
        const chain = addDevice(addDevice(addDevice(
          '<MidiTrack Id="0"><Devices /></MidiTrack>', one), one),
          '<Eq8 Id="1"><Name Value="y" /></Eq8>');
        const keys = [...chain.matchAll(/<(?:AutoFilter2|Eq8) Id="(\d+)"/g)].map((k) => k[1]);
        if (keys.length !== 3 || new Set(keys).size !== 3)
          ok = fail("gate U", "als.js addDevice put one donor device into a chain three times " +
            "and gave it the keys " + keys.join(",") + " — two of them collide, which is the " +
            "v261 bug itself");
        else pass("gate U", "every Id is unique inside its own parent's list · all four donors " +
          "scan clean by the same function · duplicate-sibling fixture caught · one donor device " +
          "added three times keys as " + keys.join(",") + ", never twice the same");
      }
    }
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
    // the same lane order the exporter walks, so the columns get the same names
    const laneNames = [];
    for (const b of boxes) for (const l of (all ? b.lanes : b.lanes.slice(0, 1)))
      if (!laneNames.includes(l.name)) laneNames.push(l.name);
    const cols = columnNames(boxes, laneNames);
    for (const v of views) { const box = v.box;
    for (const lane of (all ? box.lanes : box.lanes.slice(0, 1))) {
      // the exporter owns the name; this gate asks it rather than rebuilding
      // it (it rebuilt it once, and went stale the day the naming changed)
      const name = clipNameOf(box, cols[lane.name]);
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
  /* THE CORPUS IS THREE FILES NOW, and the same rule let each one in: a donor
     joins the conformance corpus at the moment the exporter SPLICES OUT OF IT,
     never before. Ableton2 joined when the drums lane became its drum rack;
     `donor/Answers.als` joins today because the master chain is spliced out of
     its MainTrack (nukernel/export/masterrack.js) and the two enums are read
     out of its AutoFilter2 and its Delay. What that licenses is small and
     measurable: Answers is Ableton2 with tracks removed plus four devices, so
     the shapes it adds are the three master devices' parameters and nothing
     else — it has no sampler, no SampleRef and no AudioClip of its own. */
  const donorShapes = new Set([...shapes(donorXml), ...shapes(rackXml),
                               ...shapes(answersXml), ...shapes(answers2Xml)]);
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

  /* ---- Gate M: the mix tables have not drifted from their owners ---------
     als.js keeps its own copy of "what a chair asks for" (CHAIR_LEVEL) and
     "what that word is worth" (LEVEL_GAIN), because the exporter is browser-
     safe and cannot import the UMD modules that own them. A copied table is a
     drift risk, so this gate reads the REAL ones out of precompose.js and
     fields.js and fails the moment the two disagree. That is the same shape as
     gate 1 asking the exporter for its clip names: duplicate the value if you
     must, never duplicate the authority. */
  {
    const req = createRequire(import.meta.url);
    let real = null, err = null;
    try {
      const src = readFileSync(new URL("../../nukernel/precompose.js", import.meta.url), "utf8");
      const m = /const CHAIRLVL = (\{[^}]*\})/.exec(src);
      const m2 = /const CHAIRLVL2 = (\{[^}]*\})/.exec(src);
      const NF = req("../../nukernel/fields.js");
      const LEVELS = (NF.LEVELS || (NF.NuFields && NF.NuFields.LEVELS));
      if (!m || !m2) err = "could not find CHAIRLVL/CHAIRLVL2 in precompose.js";
      else if (!LEVELS) err = "fields.js exports no LEVELS";
      else real = { lvl: eval("(" + m[1] + ")"), lvl2: eval("(" + m2[1] + ")"), LEVELS };
    } catch (e) { err = e.message; }
    if (err) ok = fail("gate M", "cannot read the owning tables: " + err);
    else {
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      if (!same(real.lvl, CHAIR_LEVEL))
        ok = fail("gate M", "als.js CHAIR_LEVEL " + JSON.stringify(CHAIR_LEVEL) +
          " has drifted from precompose CHAIRLVL " + JSON.stringify(real.lvl));
      else if (!same(real.LEVELS, LEVEL_GAIN))
        ok = fail("gate M", "als.js LEVEL_GAIN " + JSON.stringify(LEVEL_GAIN) +
          " has drifted from fields LEVELS " + JSON.stringify(real.LEVELS));
      else if (real.lvl2.lead !== "norm")
        ok = fail("gate M", "precompose CHAIRLVL2.lead is " + real.lvl2.lead +
          ", but als.js chairGain hard-codes the second lead to norm");
      else pass("gate M", "the mix tables match their owners · chairs " +
        Object.keys(CHAIR_LEVEL).join("/") + " · second lead sits at norm");
    }
  }

  /* ---- Gate P: every PointeeId resolves (2026-09-03, the P3 round) -------
     Gate 0 proves no two things claim the same pointee id. This proves the
     other direction, which only became reachable today: an ENVELOPE names an
     id, and an id that names nothing is the silent failure als.js's own
     pointee comment describes — "Live still opens the set: it just points an
     automation lane at somebody else's knob". Before P3 the only PointeeIds in
     the file were the donor's own two on the MainTrack, so there was nothing
     to get wrong; there are now up to eight per track, every one of them read
     off a device AFTER `renumber` rewrote it, and that read is exactly the
     kind of thing that works until an ordering changes. */
  {
    const have = new Set(pointeeIds(xml).map((p) => p.id));
    const refs = [...xml.matchAll(/<PointeeId Value="(\d+)" \/>/g)].map((m) => +m[1]);
    const dangling = refs.filter((r) => !have.has(r));
    if (dangling.length) ok = fail("gate P", dangling.length + " of " + refs.length +
      " PointeeId(s) name an AutomationTarget that is not in this file, first " +
      dangling[0] + " — Live opens the set and the envelope moves nothing");
    else {
      // the probe, same idea as gate 0's: break one on a copy and assert red
      const broken = xml.replace(/<PointeeId Value="\d+" \/>/, '<PointeeId Value="999999999" />');
      const bRefs = [...broken.matchAll(/<PointeeId Value="(\d+)" \/>/g)].map((m) => +m[1]);
      if (bRefs.every((r) => have.has(r)))
        ok = fail("gate P", "the dangling-pointee probe was NOT caught");
      else pass("gate P", refs.length + " PointeeId reference(s), every one resolving to a " +
        "real AutomationTarget · dangling probe caught");
    }
  }

  /* ---- Gate E: the SOUND arrived (2026-09-03, the P3 round) --------------
     Paul: "the midi shifts aren't showing up in ableton, like the envelope
     settings that would tweak the sound and filters and so forth." The whole
     class of bug behind that sentence is this repo's most familiar one —
     memory calls it "declared but never arriving" — and the only gate that
     catches it is one that READS THE RENDERED FILE for the value, which is
     the other standing law ("gates must read the RENDERED output; three
     features shipped broken while every check passed").

     So this asks the exporter's own table what each chair's instrument should
     be set to (the same move gate 1 makes when it asks als.js for a clip name
     rather than rebuilding it) and then goes and finds those numbers in the
     XML. A path typo, a wrong nesting, a clamp that ate the value: all red.
     And it counts what a record composed against what the file carries, so a
     record with automation that produced none fails and a record with none
     passes at zero. */
  {
    const mine = tracksOf(xml).filter((t) => !donorNames.has(t.name));
    const cols = (() => {
      const laneNames = [];
      for (const b of boxes) for (const l of (all ? b.lanes : b.lanes.slice(0, 1)))
        if (!laneNames.includes(l.name)) laneNames.push(l.name);
      return { laneNames, names: columnNames(boxes, laneNames) };
    })();
    const laneOf = (name) => {
      for (const b of boxes) for (const l of b.lanes) if (l.name === name) return l;
      return null;
    };
    /** Read the instrument device out of an authored track. */
    const instrOfTrack = (text) => {
      const tag = instrumentTagOf(text);
      return tag ? { tag, xml: deviceOf(text, tag) } : null;
    };
    let checked = 0, envN = 0, devN = 0, err = null, probeAt = null;
    for (const name of cols.laneNames) {
      if (name === "drums") continue;
      const lane = laneOf(name);
      const col = cols.names[name];
      const t = mine.find((x) => x.name === col);
      if (!t) { err = err || ('gate E cannot find the track named "' + col + '"'); continue; }
      envN += (t.text.match(/<AutomationEnvelope Id="\d+">/g) || []).length;
      devN += (t.text.match(/<(AutoFilter2|Chorus2|AutoPan2|Roar|Delay|Shifter) Id="\d+"/g) || []).length;
      if (!lane || !lane.tone) continue;
      const dev = instrOfTrack(t.text);
      if (!dev || !dev.xml) { err = err || ('track "' + col + '" carries no instrument device'); continue; }
      const want = instrumentParams(dev.tag, lane.tone, lane.syn || null);
      for (const [path, v] of Object.entries(want)) {
        if (v == null || !isFinite(v)) continue;
        const r = paramRange(dev.xml, path);
        if (!r) continue;                         // a knob with no printed range
        const target = Math.min(Math.max(v, r.min), r.max);
        const got = +getParam(dev.xml, path);
        checked++;
        if (!probeAt) probeAt = { track: t.text, tag: dev.tag, path, target, col };
        if (!(Math.abs(got - target) < 1e-6))
          err = err || ('track "' + col + '" ' + dev.tag + " " + path + " is " + got +
            ", the chair asks for " + target);
      }
    }
    // what the record COMPOSED, asked of the score and not of the file
    const wantsAuto = boxes.some((b) => (b.auto || []).some((a) => a.param !== "hpf") || b.lvl);
    const wantsFx = boxes.some((b) => (b.fx || []).length);
    if (err) ok = fail("gate E", err);
    else if (wantsAuto && !envN) ok = fail("gate E", "the record composes automation (" +
      boxes.filter((b) => (b.auto || []).length || b.lvl).length +
      " box(es) with a lane or a level shade) and the file carries NO automation envelope");
    else if (wantsFx && !devN) ok = fail("gate E", "the record names effect chips (" +
      [...new Set(boxes.flatMap((b) => b.fx || []))].join(", ") +
      ") and the file carries NO effect device");
    else if (checked && probeAt) {
      /* THE PROBE, because a check nobody has seen fail is a check nobody has
         tested. It moves ONE knob that this gate actually checked — the first
         one, on a real authored track — inside a copy of that track's own XML,
         and then re-reads it exactly the way the loop above does: find the
         instrument by tag, lift the device, read the Manual at the path. If
         that comes back unchanged, the reader is looking somewhere other than
         at the bytes, and every "pass" above it was meaningless. */
      const bad = probeAt.track.replace(
        new RegExp("(<" + probeAt.path.split("/").pop().replace(/\./g, "\\.") +
          ">\\s*<LomId Value=\"0\" />\\s*)<Manual Value=\"[^\"]*\" />"),
        '$1<Manual Value="7654.321" />');
      const dev2 = deviceOf(bad, probeAt.tag);
      const caught = bad !== probeAt.track && dev2 &&
        Math.abs(+getParam(dev2, probeAt.path) - probeAt.target) >= 1e-6;
      if (!caught) ok = fail("gate E", "the moved-knob probe was NOT caught on " +
        probeAt.col + " " + probeAt.tag + " " + probeAt.path +
        " — the instrument check is reading something other than the file");
      else pass("gate E", checked + " instrument parameter(s) in the file equal what the " +
        "chair's tone asks for · " + envN + " automation envelope(s) · " + devN +
        " effect device(s) · moved-knob probe caught");
    } else pass("gate E", "this record has no tone, no lanes and no chips — " +
      envN + " envelopes, " + devN + " devices, as it should be");
  }

  /* ---- Gates A / F / Q: the three tables P3 copied, held to their owners --
     Same shape as gate M and the same argument: export/ is browser-safe and
     cannot import the UMD data tier or the engine bridge, so it carries copies
     of three tables — and a copied table is a drift risk unless something
     reads the ORIGINAL every run and fails on disagreement. Duplicate the
     value if you must, never duplicate the authority.
       A  export/score.js MOT_LANES   vs  audio/desk.js compileAuto
       F  export/live-devices.js FX_PARAMS  vs  fields.js FX
       Q  live-devices.js resOfQ       vs  audio/to-engine.js toneRecipe */
  {
    const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
    // A — the four `mot` words, read out of compileAuto's own body
    try {
      const desk = src("../../nukernel/audio/desk.js");
      const body = /function compileAuto\([\s\S]*?\n}/.exec(desk);
      if (!body) throw new Error("could not find compileAuto in audio/desk.js");
      const nums = (re) => { const m = re.exec(body[0]); return m ? m.slice(1).map(Number) : null; };
      const real = {
        open: nums(/sec\.mot === "open"\)\s*\n?\s*out\.push\(\{ param: "cutoff", curve: "exp", points: \[\[0, (\d+)\], \[beats, (\d+)\]\] \}\)/),
        close: nums(/sec\.mot === "close"\)\s*\n?\s*out\.push\(\{ param: "cutoff", curve: "exp", points: \[\[0, (\d+)\], \[beats, (\d+)\]\] \}\)/),
        rise: nums(/sec\.mot === "rise"\)\s*\n?\s*out\.push\(\{ param: "hpf", curve: "exp", points: \[\[0, (\d+)\], \[beats, (\d+)\]\] \}\)/),
        pump: nums(/pts\.push\(\[b, ([\d.]+)\], \[b \+ ([\d.]+), (\d+)\]\)/),
      };
      const mineL = { open: MOT_LANES.open(8).points, close: MOT_LANES.close(8).points,
                      rise: MOT_LANES.rise(8).points, pump: MOT_LANES.pump(2).points };
      const bad = ["open", "close", "rise"].find((k) =>
        !real[k] || mineL[k][0][1] !== real[k][0] || mineL[k][1][1] !== real[k][1]);
      const pumpBad = !real.pump || mineL.pump[0][1] !== real.pump[0] ||
        mineL.pump[1][0] !== real.pump[1] || mineL.pump[1][1] !== real.pump[2];
      if (bad) ok = fail("gate A", "export/score.js MOT_LANES." + bad + " " +
        JSON.stringify(mineL[bad]) + " has drifted from audio/desk.js compileAuto " +
        JSON.stringify(real[bad]));
      else if (pumpBad) ok = fail("gate A", "export/score.js MOT_LANES.pump has drifted from " +
        "audio/desk.js compileAuto " + JSON.stringify(real.pump));
      // ...and the three chips a kit does not take, out of desk.js KIT_FILTER
      const kf = /const KIT_FILTER = \{([^}]*)\}/.exec(desk);
      const realKit = kf ? kf[1].split(",").map((s) => s.split(":")[0].trim()).filter(Boolean) : null;
      if (!realKit) ok = fail("gate A", "could not find KIT_FILTER in audio/desk.js");
      // `sweep` is the SURFACE word and `filtersweep` is the chip's `type`;
      // desk.js filters on type and this file is keyed on the word, so the
      // export's table is desk.js's plus the alias. Anything else has drifted.
      else if (realKit.some((k) => !KIT_FILTER[k]) ||
               Object.keys(KIT_FILTER).some((k) => !realKit.includes(k) && k !== "sweep"))
        ok = fail("gate A", "live-devices.js KIT_FILTER " + Object.keys(KIT_FILTER).join("/") +
          " has drifted from audio/desk.js KIT_FILTER " + realKit.join("/"));
      else if (bad || pumpBad) { /* already reported above */ }
      else pass("gate A", "the four `mot` lanes match audio/desk.js compileAuto · " +
        "open 320→16000 · close 16000→320 · rise 20→1400 (hpf) · pump 0.32→1 per beat · " +
        "the kit refuses " + realKit.join("/") + ", same as desk.js");
    } catch (e) { ok = fail("gate A", "cannot read compileAuto: " + e.message); }
  /* ---- Gate X: A CELL'S OFFSET MOVES ITS OWN TRACK, IN ITS OWN SECTION ----
     (TABLE.md wave 3, 2026-09-04.)

     ¶A: *"we still want per-section mix automation, with per-cell relative to
     that."* The section's ride is gate E's business; this is the other half —
     what ONE VOICE rides it by in ONE SECTION — and it is gated the way
     everything in this file is gated: by reading the finished document. The
     probe writes an offset into the Score, re-runs the WHOLE writer, and asks
     the two files what changed. Nothing here consults als.js's intentions.

     WHAT IT ASSERTS, in ¶A's own language:
       · the offset track's VOLUME is the base's TIMES the offset's own dB
         through THAT SECTION's beats and exactly the base's everywhere else,
         so the cell rides the row's lane rather than replacing it and no curve
         is applied twice;
       · its PAN is the base's PLUS the offset, on the same span;
       · EVERY OTHER TRACK is byte-identical — a cell is one cell.

     WHY THE PROBE INJECTS AT THE SCORE AND NOT AT THE DOCUMENT. `box.cellauto`
     is keyed by UNIT KEY, which is what a Live track IS; the walk that gets a
     document's per-CHAIR cell lanes onto those keys is export/score.js's, and
     it is gated where it lives (test/table.test.js T4k reads the same offset
     off the DESK, on the rendered unit table). This gate owns the WRITER, so
     it starts where the writer starts.

     AND IT PROVES ITS OWN RECONSTRUCTION FIRST: run A, with nothing injected,
     must equal the shipped file byte for byte, or the two runs below are a
     conversation about some other export. */
  {
    const { RACK_GZIP_B64 } = await import("../../nukernel/export/drumrack.js");
    const { FXRACK_GZIP_B64 } = await import("../../nukernel/export/fxrack.js");
    const { FXRACK2_GZIP_B64 } = await import("../../nukernel/export/fxrack2.js");
    const { MASTERRACK_GZIP_B64 } = await import("../../nukernel/export/masterrack.js");
    const unz = (b) => gunzipSync(Buffer.from(b, "base64")).toString("utf8");
    const OPTS = { all, drumRack: unz(RACK_GZIP_B64), fxRack: unz(FXRACK_GZIP_B64),
                   masterRack: unz(MASTERRACK_GZIP_B64), fxRack2: unz(FXRACK2_GZIP_B64) };
    const J = (o) => JSON.parse(JSON.stringify(o));
    // the lane to put the offset on: the drums track is a Drum Rack and als.js
    // rides neither a fader nor a pan on it, so it has nothing to measure
    const lane = (all ? boxes[0].lanes : boxes[0].lanes.slice(0, 1))
      .map((l) => l.name).find((n) => n !== "drums");
    const si = 1;
    const DB = 6, PAN = 0.35;
    if (!lane || boxes.length < 2) {
      pass("gate X", "this export carries " + boxes.length + " box(es)" +
        (lane ? "" : " and no non-drum track") + " — a per-cell offset is a " +
        "fact about ONE section of one voice, and it needs a second section " +
        "to be absent from before there is anything here to measure (the " +
        "--all row does)");
    } else {
      const runA = alsFromScore(donorXml, J(score), OPTS).xml;
      const probe = J(score);
      probe.boxes[si].cellauto = { [lane]: { fader: DB, pan: PAN } };
      const runB = alsFromScore(donorXml, probe, OPTS).xml;
      /* THE ENVELOPE, READ OUT OF A TRACK. An AutomationEnvelope names its
         target by PointeeId and the Mixer prints that id beside the knob, so
         the knob is found the way Live finds it and never by position. A
         parameter with no envelope answers with its Manual value, which is
         what Live plays for it. */
      const envOf = (text, path) => {
        const mix = elementAfter(text, "Mixer");
        const id = mix ? targetIdOf(mix.text, path) : null;
        if (id == null) return null;
        let out = null;
        for (const m of text.matchAll(/<AutomationEnvelope Id="\d+">/g)) {
          const [a, b] = balancedAt(text, m.index);
          const seg = text.slice(a, b);
          if (!seg.includes('<PointeeId Value="' + id + '" />')) continue;
          out = [...seg.matchAll(/<FloatEvent Id="\d+" Time="([-\d.eE]+)" Value="([-\d.eE]+)" \/>/g)]
            .map((e) => ({ time: +e[1], value: +e[2] }));
          break;
        }
        return { manual: +getParam(mix.text, path), events: out };
      };
      // what the parameter reads at a beat: the last breakpoint at or before it
      // (a box boundary is written as a STEP — als.js stitchEnvelope — so
      // sampling mid-box never lands on a ramp between two sections), or the
      // Manual value when the record wrote no envelope at all
      const at = (e, t) => {
        if (!e) return null;
        if (!e.events) return e.manual;
        let v = e.events.length ? e.events[0].value : e.manual;
        for (const ev of e.events) { if (ev.time > t + 1e-9) break; v = ev.value; }
        return v;
      };
      const views = paceView(boxes);
      const mid = views.map((v) => v.beat0 + v.beats / 2);
      const laneNames = [];
      for (const b of boxes) for (const l of (all ? b.lanes : b.lanes.slice(0, 1)))
        if (!laneNames.includes(l.name)) laneNames.push(l.name);
      const col = columnNames(boxes, laneNames)[lane];
      const trackOf = (x) => (tracksOf(x).find((t) => t.name === col) || {}).text || "";
      const A = trackOf(runA), B = trackOf(runB);
      const g = Math.pow(10, DB / 20);
      let bad = null;
      if (runA !== xml)
        bad = "gate X could not reproduce the shipped file (" + runA.length + " vs " +
              xml.length + " chars) — the two runs below would be about some other export";
      else if (!A || !B) bad = 'gate X cannot find the track named "' + col + '"';
      if (!bad) {
        // ...AND EVERY OTHER TRACK IS UNTOUCHED. A cell is one cell.
        const others = (x) => tracksOf(x).filter((t) => t.name !== col)
          .map((t) => t.text).join(" ");
        if (others(runA) !== others(runB))
          bad = "one cell's offset changed a track that is not its own";
      }
      const moved = [];
      /* ONE PARAMETER, READ OFF BOTH FILES. `eA` is what the record exports
         without the cell and `eB` with it, and the claim is ¶A's in two
         halves: the offset box moved by exactly the offset, and every other
         box did not move at all.

         WHERE THE BASE COMES FROM, and why it is not the Manual value. A
         parameter the record does not automate has NO envelope in run A — so
         its base is what run B itself holds through the boxes the cell did not
         touch, which is the number Live plays there. Reading the mixer's
         `Manual` instead would be reading a different knob: als.js writes the
         static strip and the envelope hold from two places and this gate is
         not the place to conflate them (measured 2026-09-04: Manual 0.22 while
         the pan hold is 0.57 on techno). The "did not move" half keeps its
         teeth either way — every untouched box has to agree with every other
         untouched box, which a leak across sections would break. */
      const check = (name, eA, eB, apply, fmt) => {
        if (bad) return;
        if (!eB || eB.events == null) {
          bad = "the cell offset wrote NO " + name + " envelope on its track"; return;
        }
        const drew = !!(eA && eA.events);
        let flat = null;
        for (let i = 0; i < mid.length; i++) {
          if (i === si) continue;
          const got = at(eB, mid[i]);
          const want = drew ? at(eA, mid[i]) : (flat == null ? (flat = got) : flat);
          if (Math.abs(got - want) > 1e-5 * Math.max(1, Math.abs(want))) {
            bad = "the " + name + " of box " + i + " reads " + got + " and the record " +
                  "without the cell says " + want + " — the offset leaked out of its section";
            return;
          }
        }
        const base = drew ? at(eA, mid[si]) : flat;
        const got = at(eB, mid[si]), want = apply(base);
        if (Math.abs(got - want) > 1e-5 * Math.max(1, Math.abs(want))) {
          bad = "the " + name + " of box " + si + " reads " + got + ", and the row's own " +
                base + " plus this cell's offset is " + want;
          return;
        }
        moved.push(fmt(base, got));
      };
      if (!bad) {
        check("volume", envOf(A, "Volume"), envOf(B, "Volume"), (b) => b * g,
              (b, x) => "volume " + b.toFixed(4) + " -> " + x.toFixed(4) +
                        " (+" + (20 * Math.log10(x / b)).toFixed(2) + " dB, asked +" + DB + ")");
        check("pan", envOf(A, "Pan"), envOf(B, "Pan"), (b) => b + PAN,
              (b, x) => "pan " + b.toFixed(3) + " -> " + x.toFixed(3) +
                        " (+" + PAN + ")");
      }
      if (bad) ok = fail("gate X", bad);
      else pass("gate X", 'a cell offset on "' + col + '" in box ' + si + " of " +
        boxes.length + " moves that track's exported envelopes THERE AND NOWHERE ELSE (" +
        moved.join(" · ") + ") · every other track byte-identical · run A " +
        "reproduces the shipped file exactly");
    }
  }

    // F — the eleven chips' declared knobs
    {
      const req = createRequire(import.meta.url);
      const NF = req("../../nukernel/fields.js");
      const realFX = NF.FX || (NF.NuFields && NF.NuFields.FX);
      if (!realFX) ok = fail("gate F", "fields.js exports no FX");
      else {
        const mineK = Object.keys(FX_PARAMS).sort(), realK = Object.keys(realFX).sort();
        let bad = null;
        if (mineK.join() !== realK.join())
          bad = "chip list " + mineK.join("/") + " vs fields.js " + realK.join("/");
        else for (const k of mineK)
          if (JSON.stringify(FX_PARAMS[k]) !== JSON.stringify(realFX[k].params))
            bad = bad || (k + " " + JSON.stringify(FX_PARAMS[k]) + " vs fields.js " +
              JSON.stringify(realFX[k].params));
        if (bad) ok = fail("gate F", "live-devices.js FX_PARAMS has drifted from fields.js FX: " + bad);
        else pass("gate F", mineK.length + " chip parameter set(s) match fields.js FX exactly");
      }
    }
    // Q — the one arithmetic live-devices.js shares with the engine bridge
    try {
      const te = src("../../nukernel/audio/to-engine.js");
      const m = /tone\.q != null\) out\.res = clamp\(\(tone\.q - ([\d.]+)\) \/ (\d+), (\d+), ([\d.]+)\)/.exec(te);
      if (!m) throw new Error("could not find toneRecipe's `res` line in audio/to-engine.js");
      const [, off, div, lo, hi] = m.map(Number);
      const same = [0.7, 3, 11, 20].every((q) => {
        const want = Math.min(Math.max((q - off) / div, lo), hi);
        return Math.abs(resOfQ(q) - want) < 1e-12;
      });
      if (!same) ok = fail("gate Q", "live-devices.js resOfQ has drifted from to-engine.js " +
        "toneRecipe `(q - " + off + ") / " + div + "` clamped to " + lo + ".." + hi);
      else pass("gate Q", "resOfQ quotes to-engine.js toneRecipe: (q - " + off + ") / " +
        div + ", clamped " + lo + ".." + hi);
    } catch (e) { ok = fail("gate Q", "cannot read toneRecipe: " + e.message); }

    /* ---- Gate S — THE TWO ENUMS, ASSERTED AGAINST THE FILES THAT DECODED
       THEM. donor/README.md carried the first ask from 2026-08-31 to
       2026-09-03 ("put an Auto Filter on any track and switch its filter to
       HIGHPASS; put a Delay beside it and set its left and right times to a
       synced 1/8") and Answers.als answered it. The SIXTEENTH INDEX took a
       second file and a sentence: Paul, hours later, with the device on screen
       — "So the Ableton number for delay is 'delay time in 16th notes,' so it
       should be 2." Answers2.als is that click, and this gate now asserts the
       BUTTON TABLE — sixteenths -> position in [1,2,3,4,5,6,8,16] — against
       every Delay in all four donors, so the day a re-save moves a value the
       reading goes red rather than the export quietly writing a wrong echo.

       THE "CONFIRM IN LIVE" CLAUSE THAT USED TO END THIS GATE IS GONE, and
       that is the point of the round: the discrepancy it printed was never a
       discrepancy. Paul's index 6 was the button labelled 8 — position 6 —
       and the arithmetic reading was simply wrong about the last two buttons. */
    {
      const af = deviceOf(answersXml, "AutoFilter2");
      const afG = deviceOf(donorXml, "AutoFilter2");
      const afA = deviceOf(rackXml, "AutoFilter2");
      const g = (x, path) => (x ? getParam(x, path) : null);
      const r = af && paramRange(af, "Filter_Type");
      let bad = null;
      if (!af) bad = "donor/Answers.als has no AutoFilter2";
      else if (+g(af, "Filter_Type") !== AF_HIGHPASS)
        bad = "Answers' AutoFilter2 reads Filter_Type " + g(af, "Filter_Type") +
              ", live-devices.js says highpass is " + AF_HIGHPASS;
      else if (+g(afG, "Filter_Type") !== AF_LOWPASS || +g(afA, "Filter_Type") !== AF_LOWPASS)
        bad = "an untouched donor AutoFilter2 no longer reads Filter_Type " + AF_LOWPASS +
              " (Generic " + g(afG, "Filter_Type") + ", Ableton2 " + g(afA, "Filter_Type") + ")";
      else if (!r || r.min !== 0 || r.max !== 9)
        bad = "Filter_Type's range is no longer 0..9";

      /* ---- THE SIXTEENTH TABLE, AGAINST ALL FIVE WITNESSES.
         Every Delay any donor carries, in document order, with the index
         live-devices.js DELAY_SYNC_WITNESSES says it holds. Two of them are
         Paul's own clicks and three are untouched controls; the table has to
         explain all five or it is not the table. */
      const DONORS = { Generic: donorXml, Ableton2: rackXml,
                       Answers: answersXml, Answers2: answers2Xml };
      const delaysOf = (xml) => {
        const out = [];
        for (let i = xml.indexOf("<Delay Id="); i >= 0; i = xml.indexOf("<Delay Id=", i + 1)) {
          const [a, b] = balancedAt(xml, i);
          out.push(xml.slice(a, b));
        }
        return out;
      };
      const nth = { Generic: 0, Ableton2: 0, Answers: 0, Answers2: 0 };
      const seenIdx = [];
      if (!bad) for (const w of DELAY_SYNC_WITNESSES) {
        const all = delaysOf(DONORS[w.donor]);
        const d = all[nth[w.donor]++];
        if (!d) { bad = w.donor + " has no Delay #" + nth[w.donor]; break; }
        const idx = +getParam(d, "DelayLine_SyncedSixteenthL");
        const rr = paramRange(d, "DelayLine_SyncedSixteenthL");
        if (idx !== w.index) {
          bad = w.donor + " " + w.where + " reads SyncedSixteenthL " + idx +
                ", live-devices.js records " + w.index + " (" + w.note + ")";
          break;
        }
        if (!rr || rr.min !== 0 || rr.max !== DELAY_SYNC_MAX) {
          bad = w.donor + "'s DelayLine_SyncedSixteenth range is no longer 0.." + DELAY_SYNC_MAX;
          break;
        }
        if (delaySixteenthsAt(idx) == null) {
          bad = "index " + idx + " is off the end of DELAY_SYNC_BUTTONS";
          break;
        }
        seenIdx.push(w.donor + " " + idx + '="' + delaySixteenthsAt(idx) + '"');
      }
      // ...and the switches Paul turned on, on both of the devices he touched.
      if (!bad) for (const w of DELAY_SYNC_WITNESSES.filter((x) => x.hand)) {
        const d = delaysOf(DONORS[w.donor])[0];
        if (getParam(d, "DelayLine_SyncL") !== "true" || getParam(d, "DelayLine_SyncR") !== "true")
          bad = w.donor + "'s Delay is not synced (SyncL " + getParam(d, "DelayLine_SyncL") +
                ", SyncR " + getParam(d, "DelayLine_SyncR") + ")";
      }
      /* THE ARITHMETIC WITNESS, computed rather than quoted: Ableton2's
         untouched Delay sits at index 2 AND at a free-running DelayLine_TimeL
         of 0.375 SECONDS (its own range prints the unit), and at that donor's
         own tempo 0.375 s is exactly 3 sixteenths — so DELAY_SYNC_BUTTONS[2]
         has to be 3, which is the one place the table and the old arithmetic
         agreed and still do. */
      let corr = null;
      if (!bad) {
        const d2 = delaysOf(rackXml)[0];
        const tempo = (() => { const t = elementAfter(rackXml, "Tempo"); return t ? +val(t.text, "Manual") : 120; })();
        const secs = +getParam(d2, "DelayLine_TimeL");
        const sixteenths = secs * (tempo / 60) * 4;
        const idx = +getParam(d2, "DelayLine_SyncedSixteenthL");
        if (Math.abs(sixteenths - 3) > 1e-3)
          bad = "the untouched Ableton2 Delay's free time is " + secs + " s = " +
                sixteenths.toFixed(3) + " sixteenths at " + tempo + " bpm, not 3";
        else if (delaySyncIndex(sixteenths) !== idx)
          bad = "delaySyncIndex(" + sixteenths + ") = " + delaySyncIndex(sixteenths) +
                ", but that device's own index is " + idx;
        else corr = secs.toFixed(3) + " s at " + tempo + " bpm = 3/16 at index " + idx;
      }
      /* THE THIRD CORROBORATION, and it needed no click at all. Answers2 also
         carries an ECHO — Live's modern delay — and ITS equivalent parameter
         prints a range of 1..16, the sixteenth COUNT. Eight values cannot be a
         count that runs to sixteen, so the old Delay's 0..7 is a POSITION. The
         file says so on its own. */
      let echoSays = null;
      if (!bad) {
        const ec = deviceOf(answers2Xml, "Echo");
        const er = ec && paramRange(ec, "Delay_SyncedSixteenthL");
        if (!ec) bad = "donor/Answers2.als has no Echo — the count-vs-position corroboration is gone";
        else if (!er || er.min !== 1 || er.max !== DELAY_SYNC_BUTTONS[DELAY_SYNC_BUTTONS.length - 1])
          bad = "Echo/Delay_SyncedSixteenth's range is " + (er ? er.min + ".." + er.max : "absent") +
                ", not the 1..16 that makes it a COUNT beside the Delay's POSITION";
        else echoSays = "Echo/Delay_SyncedSixteenth is 1.." + er.max + " (a COUNT) beside " +
                        "Delay's 0.." + DELAY_SYNC_MAX + " (a POSITION)";
      }
      /* AND THE REFUSALS, which is the half of the table the arithmetic got
         wrong in both directions: 7 sixteenths has no button and must go down
         the seconds path; 8 and 16 have one and the arithmetic could not spell
         either (it wrote 7 for the eight and nothing at all for the sixteen). */
      if (!bad) {
        const wantNull = [0, 2.5, 7, 9, 12, 15, 17];
        for (const n of wantNull)
          if (delaySyncIndex(n) !== null) { bad = "delaySyncIndex(" + n + ") = " +
            delaySyncIndex(n) + ", but no button spells " + n + " sixteenths"; break; }
        if (!bad) for (let i = 0; i < DELAY_SYNC_BUTTONS.length; i++)
          if (delaySyncIndex(DELAY_SYNC_BUTTONS[i]) !== i) {
            bad = "delaySyncIndex(" + DELAY_SYNC_BUTTONS[i] + ") = " +
                  delaySyncIndex(DELAY_SYNC_BUTTONS[i]) + ", want " + i; break;
          }
      }
      /* ...AND THE ARTIFACT. If this record has an echo chip, the Delay in the
         FILE must be synced to the index the chip's own time asks for —
         "gates must read the RENDERED output", which is the whole reason the
         checks above are not enough. */
      let seen = null;
      if (!bad) {
        const wantsEcho = score.boxes.some((b) => (b.fx || []).some((k) => k === "echo" || k === "delay"));
        if (wantsEcho) {
          const sm = /^(\d+)\/(\d+)$/.exec(score.meterAbc || "");
          const beatsPerBar = sm ? (+sm[1] * 4) / +sm[2] : 4;
          const want = delaySyncIndex(FX_PARAMS.echo.timeBars * beatsPerBar * 4);
          const mine = tracksOf(xml).filter((t) => !donorNames.has(t.name));
          let found = 0;
          for (const t of mine) {
            const d = deviceOf(t.text, "Delay");
            if (!d) continue;
            found++;
            if (getParam(d, "DelayLine_SyncL") !== "true" || getParam(d, "DelayLine_SyncR") !== "true")
              bad = bad || ("the Delay on " + t.name + " is not synced");
            else if (want != null && +getParam(d, "DelayLine_SyncedSixteenthL") !== want)
              bad = bad || ("the Delay on " + t.name + " is at index " +
                getParam(d, "DelayLine_SyncedSixteenthL") + ", want " + want +
                " for " + FX_PARAMS.echo.timeBars + " bars");
          }
          if (!found) bad = bad || "the record names an echo chip and no authored track carries a Delay";
          seen = found + ' echo Delay(s) at index ' + want + ' = the button "' +
                 delaySixteenthsAt(want) + '" = ' + delaySixteenthsAt(want) + "/16 of the bar";
        }
      }
      if (bad) ok = fail("gate S", bad);
      else pass("gate S", "both enums read out of the donors themselves: " +
        "AutoFilter2 Filter_Type " + AF_HIGHPASS + " = HIGHPASS (untouched donors " +
        AF_LOWPASS + " = lowpass) · DelayLine_SyncedSixteenth is a POSITION in [" +
        DELAY_SYNC_BUTTONS.join(",") + "], asserted against all " +
        DELAY_SYNC_WITNESSES.length + " donor Delays (" + seenIdx.join(", ") + ")" +
        (corr ? " · " + corr : "") + (echoSays ? " · " + echoSays : "") +
        (seen ? " · " + seen : ""));
    }

    /* ---- Gate D — DONOR 4'S DEVICES, IN THE FILE AND IN THE MAPPING.
       Paul, 2026-09-03: "I added a zip with all the missing effects and many
       more." Two chips changed hands with that file and both of them are the
       kind of change this repo has a memory note about:

         `phaser` had NO DEVICE AT ALL. From the day the chips landed it came
           out on the receipt as "neither donor carries a Phaser" — a word the
           box can say, costed and drawn, arriving as nothing.
         `crunch` had a device that could only say TWO of its nine knobs. Roar
           took `drive` and `mix`; low / mid / high / presence / level went
           nowhere, which is [[declared-but-never-arriving]] exactly. Live's Amp
           has all six on one printed 0..10 scale, and the Cabinet is the DSP's
           own fixed cab.

       So this gate does two things, and the first one runs on EVERY record
       whether or not it names either chip — because almost none of them do,
       and a gate that only fires on a record with a phaser is a gate that will
       not fire. It builds both chips against the real four-rack library and
       asserts every knob landed, at the value the chip asks for, inside the
       range the donor prints. Then, if the record DOES name one, it reads the
       device back out of the rendered XML. */
    {
      const { FXRACK_GZIP_B64 } = await import("../../nukernel/export/fxrack.js");
      const { FXRACK2_GZIP_B64 } = await import("../../nukernel/export/fxrack2.js");
      const { MASTERRACK_GZIP_B64: MR } = await import("../../nukernel/export/masterrack.js");
      const un = (b) => gunzipSync(Buffer.from(b, "base64")).toString("utf8");
      const lib = deviceLibrary(donorXml, un(FXRACK_GZIP_B64), un(MR), un(FXRACK2_GZIP_B64));
      let bad = null;
      /* WHAT EACH CHIP MUST LAND, as {path: value} — the same arithmetic
         live-devices.js does, written a second time here on purpose. A copy of
         the mapping in the gate is what makes the gate an independent reader
         rather than a mirror; gate F does the same for FX_PARAMS. */
      const P = FX_PARAMS.phaser, C = FX_PARAMS.crunch;
      const EXPECT = {
        phaser: { device: "PhaserNew", extra: [], knobs: {
          Modulation_Frequency: P.rate, Modulation_Amount: P.depth, DryWet: P.mix,
          Notches: 2, Feedback: 0.5, CenterFrequency: Math.sqrt(180 * 3200) },
          flags: { Modulation_Sync: "false" } },
        crunch: { device: "Amp", extra: ["Cabinet"], knobs: {
          Gain: C.drive * 10, Bass: C.low * 10, Middle: C.mid * 10,
          Treble: C.high * 10, Presence: C.presence * 10, Volume: C.level * 10,
          DryWet: C.mix }, flags: {} },
      };
      const near = (a, b) => Math.abs(a - b) < 1e-3;
      for (const [chip, want] of Object.entries(EXPECT)) {
        if (bad) break;
        const built = buildFx(lib, chip, chipParams(chip), { bpm: 120, beatsPerBar: 4 });
        if (built.unmapped || built.missing) {
          bad = chip + " builds nothing: " + (built.unmapped || ("no " + built.missing +
            " in the four-rack library")); break;
        }
        if (built.device !== want.device) {
          bad = chip + " -> " + built.device + ", want " + want.device; break;
        }
        if ((built.extra || []).map((e) => e.device).join("/") !== want.extra.join("/")) {
          bad = chip + " brings [" + (built.extra || []).map((e) => e.device).join(",") +
            "], want [" + want.extra.join(",") + "]"; break;
        }
        for (const [path, v] of Object.entries(want.knobs)) {
          const got = +getParam(built.xml, path);
          const r = paramRange(built.xml, path);
          if (!near(got, v)) { bad = chip + " -> " + want.device + "/" + path + " = " + got +
            ", want " + v; break; }
          if (r && (got < r.min || got > r.max)) { bad = chip + " -> " + path + " = " + got +
            " is outside the donor's own " + r.min + ".." + r.max; break; }
        }
        if (bad) break;
        for (const [path, v] of Object.entries(want.flags))
          if (getParam(built.xml, path) !== v) { bad = chip + " -> " + path + " is " +
            getParam(built.xml, path) + ", want " + v; break; }
        if (bad) break;
        /* NOT A COUNT. `set` is how many bytes CHANGED, not how many knobs were
           written — the phaser asks for Notches 2 and Modulation_Sync false and
           the donor already carries both, so a correct build reports 6 where
           the mapping names 8. Measured, and it is why this line is a floor and
           not an equality: what proves a path is real is the value read back
           above, which is NaN for a path that matched nothing and fails `near`
           before it gets here. */
        if (!(built.set > 0))
          bad = chip + " -> " + want.device + " changed nothing at all";
      }
      /* THE PROBE: ask for a chip whose device the library does NOT carry and
         assert the exporter reports it rather than substituting. This is the
         behaviour the `phaser` row itself relied on for a fortnight, and it has
         to keep working now that the phaser has somewhere to go. */
      if (!bad) {
        const thin = deviceLibrary(donorXml, "", "", "");
        const b2 = buildFx(thin, "phaser", chipParams("phaser"), {});
        if (!b2.missing) bad = "a library with no fx rack 2 still built a phaser — " +
          "the missing-device report is broken";
      }
      /* ...AND THE ARTIFACT, when this record actually names one of the two. */
      let seen = [];
      if (!bad) {
        const mine = tracksOf(xml).filter((t) => !donorNames.has(t.name));
        for (const chip of ["phaser", "crunch"]) {
          const asked = score.boxes.some((b) => (b.fx || []).some((k) =>
            k === chip || (chip === "crunch" && k === "higain")));
          if (!asked) continue;
          const want = EXPECT[chip];
          let found = 0;
          for (const t of mine) {
            const d = deviceOf(t.text, want.device);
            if (!d) continue;
            found++;
            for (const [path, v] of Object.entries(want.knobs))
              if (!near(+getParam(d, path), v))
                bad = bad || (want.device + " on " + t.name + " has " + path + " = " +
                  getParam(d, path) + ", want " + v);
            for (const tag of want.extra)
              if (!t.text.includes("<" + tag + " Id="))
                bad = bad || (t.name + " carries a " + want.device + " and no " + tag);
          }
          if (!found) bad = bad || ("the record names a " + chip + " chip and no authored " +
            "track carries a " + want.device);
          seen.push(found + " " + want.device + "(s) for " + chip);
        }
      }
      if (bad) ok = fail("gate D", bad);
      else pass("gate D", "donor 4's devices, every knob read back: phaser -> PhaserNew " +
        "(rate/depth/mix from the chip, notches/feedback/centre from the DSP's own " +
        "constants), crunch -> Amp + Cabinet (six knobs on Live's 0..10 amp scale, " +
        "where Roar could say two) · missing-rack probe reports instead of substituting" +
        (seen.length ? " · " + seen.join(", ") : " · this record names neither chip"));
    }

    /* ---- Gate G — the master vocabulary has not drifted from fields.js.
       Same shape as gate F and the same argument: export/ is browser-safe and
       cannot import the UMD data tier, so the numbers are copied and the copy
       is held to its owner mechanically. */
    {
      const req = createRequire(import.meta.url);
      const NF = req("../../nukernel/fields.js");
      const real = { drive: NF.DRIVES, glue: NF.GLUES, ceiling: NF.CEILINGS,
                     width: NF.WIDTHS, tilt: NF.TILTS };
      const mine = { drive: MASTER_DRIVES, glue: MASTER_GLUES, ceiling: MASTER_CEILINGS,
                     width: MASTER_WIDTHS, tilt: MASTER_TILTS };
      let bad = null;
      for (const k of Object.keys(mine)) {
        if (!real[k]) { bad = bad || ("fields.js exports no table for " + k); continue; }
        if (JSON.stringify(mine[k]) !== JSON.stringify(real[k]))
          bad = bad || (k + ": " + JSON.stringify(mine[k]) + " vs fields.js " + JSON.stringify(real[k]));
      }
      if (bad) ok = fail("gate G", "live-devices.js has drifted from fields.js MASTER: " + bad);
      else pass("gate G", "the master vocabulary matches fields.js exactly · " +
        Object.keys(MASTER_DRIVES).length + " drives, " + Object.keys(MASTER_GLUES).length +
        " glues, " + Object.keys(MASTER_WIDTHS).length + " widths, " +
        Object.keys(MASTER_TILTS).length + " tilts, " +
        Object.keys(MASTER_CEILINGS).length + " ceilings · " +
        MASTER_HOMELESS.length + " word(s) still with no device (" +
        MASTER_HOMELESS.join(", ") + ")");
    }

    /* ---- Gate B — THE MASTER BUS, READ BACK OUT OF THE FILE.
       The absent-is-today tripwire and the present-is-real check in one gate,
       asserted every run on every record rather than only when somebody
       exports a mastered one: a record with no `master` must leave the donor's
       own MainTrack exactly as Live wrote it (no devices at all, in both older
       donors), and a record with one must carry exactly the devices its words
       ask for, with every knob inside the range the DONOR prints for it. */
    {
      const { MASTERRACK_GZIP_B64 } = await import("../../nukernel/export/masterrack.js");
      const mrack = gunzipSync(Buffer.from(MASTERRACK_GZIP_B64, "base64")).toString("utf8");
      const lib = deviceLibrary(donorXml, "", mrack);
      const want = masterDevices(lib, score.master);
      const TAGS = MASTER_TAGS;
      // what the OUTPUT's MainTrack actually holds, in its own order
      const check = (x) => {
        const mt = elementAfter(x, "MainTrack");
        if (!mt) return "no MainTrack in the output";
        /* IN THE DOCUMENT'S OWN ORDER, not in the table's. A `filter` over
           MASTER_TAGS answers the table back at itself and would pass a file
           whose Limiter sat first — which is a different master chain. Read
           the tags off the MainTrack in the order Live will run them. */
        const have = [...mt.text.matchAll(/<([A-Za-z0-9]+) Id="\d+"/g)]
          .map((m) => m[1]).filter((t) => TAGS.includes(t));
        const wantTags = want.devices.map((d) => d.tag);
        if (have.join("/") !== wantTags.join("/"))
          return "the Main track carries " + (have.join("/") || "no master device") +
                 ", the record's master asks for " + (wantTags.join("/") || "none");
        for (const d of want.devices) {
          const got = deviceOf(mt.text, d.tag);
          if (!got) return "no " + d.tag + " in the Main track";
          for (const path of PARAMS_OF[d.tag]) {
            const a = getParam(d.xml, path), b = getParam(got, path);
            if (a !== b) return d.tag + "/" + path + " is " + b + " in the file, want " + a;
            const r = paramRange(got, path);
            if (r && (+b < r.min || +b > r.max))
              return d.tag + "/" + path + " = " + b + " is outside the donor's own " +
                     r.min + ".." + r.max;
          }
        }
        return null;
      };
      const err = check(xml);
      if (err) ok = fail("gate B", err);
      else if (!want.devices.length)
        pass("gate B", (score.master ? "this record's master words build no device" :
          "this record has no master") + " — the donor's MainTrack ships untouched, " +
          "with the " + (elementAfter(xml, "MainTrack").text.match(/<Devices \/>/) ? "empty <Devices /> " : "") +
          "chain Live wrote" +
          (want.unmapped.length ? " · " + want.unmapped.length + " word(s) with no device anywhere" : ""));
      else {
        /* THE PROBE, same idea as gate 0's and gate E's: move one knob on a
           copy and assert this check goes red. A gate nobody has seen fail is
           a gate nobody has tested. */
        // A device whose knob is a plain leaf, because the probe below rewrites
        // the Manual by regex: the Eq8's tilt paths are nested three deep
        // (`Bands.0/ParameterA/Gain`) and there is always a leaf device beside
        // it — a record with a tilt and nothing else is the one case there is
        // not, and it falls through to the first device rather than to nothing.
        const flat = want.devices.find((d) => PARAMS_OF[d.tag].every((x) => !x.includes("/")));
        const d0 = flat || want.devices[0];
        const p0 = PARAMS_OF[d0.tag].find((x) => !x.includes("/")) || PARAMS_OF[d0.tag][0];
        const at = xml.indexOf("<" + d0.tag + " Id=", xml.indexOf("<MainTrack "));
        const [a, b] = balancedAt(xml, at);
        const moved = xml.slice(0, a) +
          xml.slice(a, b).replace(new RegExp("(<" + p0 + ">\\s*<LomId Value=\"0\" />\\s*<Manual Value=\")[^\"]*"),
                                  "$1-99") + xml.slice(b);
        if (!check(moved)) ok = fail("gate B", "the moved-knob probe was NOT caught on " +
          d0.tag + "/" + p0 + " — the master check is reading nothing");
        else pass("gate B", want.devices.length + " master device(s) on the Main track, every " +
          "knob equal to what the record's words ask for and inside the donor's own range · " +
          want.devices.map((d) => d.tag).join(" -> ") + " · moved-knob probe caught" +
          (want.unmapped.length ? " · " + want.unmapped.length + " word(s) with no device anywhere" : ""));
      }

      /* ---- THE SYNTHETIC MASTER, because almost no record has one.
         `master` is PRESENT-ONLY (score.js: "a record that never touched the
         master exports as it always did"), so on every preset in the repo the
         branch above is the absent branch and the two words that landed on
         2026-09-03 — `width` on the Utility, `tilt` on the EQ Eight — would
         never once be read back. This builds a full master out of the
         vocabulary itself and asserts the chain, the order and every knob,
         against the ranges the DONOR prints. It is a unit test living in the
         gate because the alternative is a feature nobody's machine ever ran. */
      {
        const full = { drive: "warm", glue: "glue", tape: "tape", space: "hall",
                       width: "huge", tilt: "bright", ceiling: "safe" };
        const syn = masterDevices(lib, full);
        let sbad = null;
        if (syn.devices.map((d) => d.tag).join("/") !== MASTER_TAGS.join("/"))
          sbad = "a full master builds " + syn.devices.map((d) => d.tag).join("/") +
                 ", want " + MASTER_TAGS.join("/") + " in fields.js MASTER order";
        else if (syn.unmapped.length !== MASTER_HOMELESS.length)
          sbad = syn.unmapped.length + " homeless word(s), want " + MASTER_HOMELESS.length +
                 " (" + MASTER_HOMELESS.join(", ") + ")";
        if (!sbad) {
          const sg = syn.devices.find((d) => d.tag === "StereoGain");
          const w = +getParam(sg.xml, "StereoWidth");
          const rw = paramRange(sg.xml, "StereoWidth");
          if (w !== MASTER_WIDTHS.huge)
            sbad = "width huge -> StereoWidth " + w + ", want " + MASTER_WIDTHS.huge;
          else if (!rw || w < rw.min || w > rw.max)
            sbad = "StereoWidth " + w + " is outside the donor's own " +
                   (rw ? rw.min + ".." + rw.max : "absent range");
        }
        if (!sbad) {
          const eq = syn.devices.find((d) => d.tag === "Eq8");
          const t = MASTER_TILTS.bright;
          for (const [half, band] of Object.entries(TILT_BANDS)) {
            const wantG = half === "low" ? -t : t;
            for (const path of tiltPaths(band)) {
              const v = +getParam(eq.xml, path);
              const wantV = path.endsWith("Freq") ? MASTER_TILT_HZ : wantG;
              if (Math.abs(v - wantV) > 1e-6) { sbad = "tilt bright -> " + path + " = " + v +
                ", want " + wantV; break; }
              const rr = paramRange(eq.xml, path);
              if (rr && (v < rr.min || v > rr.max)) { sbad = path + " = " + v +
                " is outside the donor's own " + rr.min + ".." + rr.max; break; }
            }
            if (sbad) break;
          }
          /* ...AND THE MODE IS NEVER WRITTEN, which is the whole reason the
             two shelves are honest: band 0 is a LOW SHELF and band 3 a HIGH
             SHELF because Live saved them that way, not because this exporter
             decided so. Read the donor's own Modes back and refuse to ship if
             they have moved (bells all read 3). */
          if (!sbad) {
            const modeOf = (b) => getParam(lib.Eq8, "Bands." + b + "/ParameterA/Mode");
            const lo = modeOf(TILT_BANDS.low), hi = modeOf(TILT_BANDS.high);
            const bell = modeOf(1);
            if (lo === bell || hi === bell || lo === hi)
              sbad = "Eq8 bands " + TILT_BANDS.low + "/" + TILT_BANDS.high + " read Mode " +
                     lo + "/" + hi + " against the bell's " + bell +
                     " — they are no longer a shelf PAIR and the tilt is not a tilt";
            else if (getParam(eq.xml, "Bands." + TILT_BANDS.low + "/ParameterA/Mode") !== lo)
              sbad = "the tilt wrote Eq8 Bands." + TILT_BANDS.low + " Mode, which it must never do";
          }
        }
        if (sbad) ok = fail("gate B", "the synthetic full master: " + sbad);
        else pass("gate B (synthetic)", "a record with all seven master words builds " +
          MASTER_TAGS.join(" -> ") + " in fields.js MASTER order · width huge -> " +
          "Utility StereoWidth " + MASTER_WIDTHS.huge + " · tilt bright -> EQ Eight shelves at " +
          MASTER_TILT_HZ + " Hz, " + (-MASTER_TILTS.bright) + "/+" + MASTER_TILTS.bright +
          " dB with Mode untouched · " + MASTER_HOMELESS.join(" and ") +
          " still have no device and say why");
      }
    }
  }

  /* ---- Gate 3 ---------------------------------------------------------- */
  const count = (x, re) => (x.match(re) || []).length;
  const sampleRe = /<(SampleRef|UserSample|MultiSamplePart|OriginalSimpler)[\s/>]/g;
  // the DS rack carries no samples of its own (its pads are Drum Synth Max
  // devices, not samplers), so this ceiling is still Generic's — measured, not
  // assumed: a rack that DID bring zones would raise it here and say so.
  const before = count(donorXml, sampleRe) + count(rackTrackOf(rackXml), sampleRe);
  const after = count(xml, sampleRe);
  const paths = [...xml.matchAll(/<Path Value="([^"]+)"/g)].map((m) => m[1]);
  const donorPaths = new Set([...donorXml.matchAll(/<Path Value="([^"]+)"/g)].map((m) => m[1])
    .concat([...rackXml.matchAll(/<Path Value="([^"]+)"/g)].map((m) => m[1]))
    // ...and donor 4's, because the PhaserNew we splice carries three of its
    // own: `/Applications/Ableton Live 12 Suite.app/…/Phaser-Flanger`, the
    // device's `LastPresetRef`. Same class as the drum rack's ten Suite paths —
    // a factory device inside the application bundle, never a user folder — and
    // an unresolved LastPresetRef costs a preset NAME, never the device.
    .concat([...answers2Xml.matchAll(/<Path Value="([^"]+)"/g)].map((m) => m[1])));
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
  /* ...AND THE SUITE PATHS, counted rather than listed, because they are a
     different hazard with a different cost. `/Applications/Ableton Live 12
     Suite.app/…` is a factory device inside the APPLICATION bundle, not a file
     on anybody's disk: the drum rack's ten pads need theirs to make a sound
     (Suite-only, README.md says so), and donor 4's PhaserNew carries three that
     are only its `LastPresetRef` — an unresolved one costs a preset NAME in the
     title bar and never the device. Printed every run so the day one of these
     turns into a `/Users/` path somebody sees it. */
  const suite = [...new Set(paths.filter((p) => /^\/Applications\//.test(p)))];
  if (suite.length)
    console.log("  note  gate 3 — " + suite.length + " distinct path(s) into the Live Suite " +
      "application bundle travel with this export (the drum rack's pads need theirs to make " +
      "a sound; the PhaserNew's one, repeated three times per device, is a LastPresetRef " +
      "and costs only a preset name)");

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

  /* ---- Gate R — THE FEEL IS IN THE FILE (2026-09-03) --------------------
     Paul: "The groove gets lost in Ableton I think?" It does not, and this is
     the gate that keeps it that way. MEASURED BEFORE IT WAS WRITTEN, which is
     the only order this repo accepts: a funk export (swing 0.12 + the funk
     groove) carries 828 of its 904 note Times off the sixteenth grid, its
     second sixteenths sitting 0.185 of a sixteenth late where swing 0.12 plus
     the groove's own +0.06 odd-slot push predicts 0.18; a techno export has
     1,236 notes and not one of them off it. Both the .als and the .mid wrote the
     played time, because export/score.js reads `e.off` — the HUMANIZED offset
     — and als.js `num()` refuses to round it ("the groove micro-timing IS the
     music"). So there was nothing to fix here and there is everything to pin:
     the one edit that would silently destroy it is a `toFixed(3)` in `num`.

     THE CLAIM IS ASSERTED AGAINST THE ENGINE, NOT AGAINST A TABLE, and that is
     deliberate. A record's DECLARED swing is not always a swing you can hear:
     kernel.js swings ODD STEPS only (`swing(g,i) = (i%2) * g.swing`), so a
     genre whose kit and line are written on even sixteenths — gospel, measured:
     every hit of its first two bars on an even step — declares 1/3 and plays
     none of it. A gate that demanded 1/3 in the file would be demanding the
     export invent a feel the box does not have. So the file is held to the
     SCORE (the engine's own event times), the declared number is checked only
     where the engine actually played it, and where it did not the gate SAYS SO
     rather than passing in silence. */
  {
    const TOL = 1 / 256;                     // 0.4% of a sixteenth: float noise
    const devOf = (beat) => { const x = beat * 4; return x - Math.round(x); };
    const feelOf = (times) => {
      let off = 0, worst = 0, sum = 0;
      const odd = [];
      for (const t of times) {
        const d = devOf(t);
        if (Math.abs(d) > TOL) off++;
        if (Math.abs(d) > worst) worst = Math.abs(d);
        sum += Math.abs(d);
        if ((((Math.round(t * 4) % 2) + 2) % 2) === 1) odd.push(d);
      }
      odd.sort((a, b) => a - b);
      return { n: times.length, off, worst, mean: times.length ? sum / times.length : 0,
               nOdd: odd.length, medOdd: odd.length ? odd[odd.length >> 1] : 0 };
    };
    // the ENGINE's own times, walked exactly as gate 1 walks them (paceView,
    // because a paced box's notes go in un-stretched)
    const sTimes = [];
    for (const v of paceView(boxes))
      for (const lane of (all ? v.box.lanes : v.box.lanes.slice(0, 1)))
        for (const n of v.notes(lane.notes)) sTimes.push(n.beat);
    /* ...and the FILE's, off the authored clips only — AND EACH CLIP ONCE.
       Every clip is written twice, into the Session slot and into the
       Arrangement, with the same note times both times ("Note times stay
       relative to the clip's own start in both cases", als.js midiClip). A
       naive walk therefore counts every note twice and the comparison with the
       Score is off by exactly 2x, which is how this line came to exist rather
       than by foresight. The name is unique per box+lane (gate 1 counts by it),
       so the first of each pair is one whole clip. */
    const fileTimes = (x) => {
      const out = [], seen = new Set();
      for (const t of tracksOf(x).filter((tr) => !donorNames.has(tr.name)))
        for (const c of clipsOf(t.text)) {
          if (seen.has(c.name)) continue;
          seen.add(c.name);
          for (const n of c.notes) out.push(n[1]);
        }
      return out;
    };
    const S = feelOf(sTimes), F = feelOf(fileTimes(xml));
    const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + "%";

    /* THE RECORD'S DECLARED FEEL, off the two tables that own it — fields.js
       SWINGS for the song's word and kernel.js GROOVES for the sixteen-slot
       push, both required rather than copied, the same move gates M/A/F/Q
       make. audio/plan.js:473 is the precedence and it is quoted, not guessed:
       "the SONG's swing outranks the genre's; null leaves the genre's own lean
       standing". A `--score` run has no record to ask and says so. */
    let decl = null, declErr = null;
    try {
      const req = createRequire(import.meta.url);
      const NF = req("../../nukernel/fields.js");
      const NK = req("../../nukernel/kernel.js");
      const NG = req("../../nukernel/genres.js");
      const SWINGS = NF.SWINGS, GROOVES = NK.GROOVES, GENRES = NG.GENRES;
      if (!SWINGS || !GROOVES || !GENRES) throw new Error("fields SWINGS / kernel GROOVES / genres GENRES not exported");
      let keys = [], sw = null, gr = null;
      if (genre) keys = [genre];
      else if (song) {
        const raw = JSON.parse(readFileSync(song, "utf8"));
        sw = raw.swing || null; gr = raw.groove || null;
        for (const b of (raw.song || []))
          for (const e of (b.stack || [])) if (e && e.g && !keys.includes(e.g)) keys.push(e.g);
      }
      /* ...AND WHETHER A HAND IS PLAYING THIS KIT, read out of kernel.js's own
         source the way gate A reads compileAuto's. The HAND LAW (kernel.js,
         2026-08-19): an acoustic kit is humanised by default — "a machine's
         exactness is its identity, and the MACHINE fingerprint gates pin it" —
         with `hand: "exact"` the opt-out and a declared `humanize` the louder
         say. Both halves matter here: a record with either must arrive off the
         grid, or the drift is gone and nobody would see it. */
      const ksrc = readFileSync(new URL("../../nukernel/kernel.js", import.meta.url), "utf8");
      const hm = /const HAND_KITS = (\{[^}]*\})/.exec(ksrc);
      if (!hm) throw new Error("could not find HAND_KITS in kernel.js");
      const HAND_KITS = eval("(" + hm[1] + ")");
      if (keys.length) {
        const own = keys.map((k) => (GENRES[k] && GENRES[k].swing) || 0);
        const handed = keys.some((k) => { const g = GENRES[k] || {};
          return (g.humanize > 0) || (HAND_KITS[g.drumkit] === 1 && g.hand !== "exact"); });
        const swing = (sw != null && SWINGS[sw] != null) ? SWINGS[sw] : Math.max(...own);
        const G = gr && GROOVES[gr];
        // the groove's mean push over the ODD slots — the eight the swing also
        // moves, so the two add on the same notes
        const push = G && G.push
          ? G.push.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / 8 : 0;
        decl = { keys, swing, groove: gr, push, expect: swing + push, handed };
      }
    } catch (e) { declErr = e.message; }

    let bad = null;
    // R1 — nothing was quantised on the way out: the file's own feel numbers
    // ARE the engine's
    if (F.off !== S.off)
      bad = "the file has " + F.off + " off-grid note(s), the engine plays " + S.off +
            " — something between the Score and the clip moved the time";
    else if (Math.abs(F.medOdd - S.medOdd) > 1e-9)
      bad = "the file's second sixteenths sit " + F.medOdd.toFixed(4) +
            " of a sixteenth late, the engine's " + S.medOdd.toFixed(4);
    else if (Math.abs(F.worst - S.worst) > 1e-9)
      bad = "the file's widest offset is " + F.worst.toFixed(4) + ", the engine's " + S.worst.toFixed(4);
    /* R2 — a record that declares a swing AND plays it must still be leaning in
       the file. ONE-SIDED, AND MEASUREMENT IS WHY. The first version of this
       clause demanded |measured − declared| < 0.08 and the shipped preset
       "Motown 45" failed it honestly: detroitsoul declares 0.120 and its
       second sixteenths sit 0.219 late, because the median runs over every
       odd-sixteenth note in a NINE-lane, two-genre record — the swung kit, the
       melody's ornaments, and four boxes of neoclassical that declare no swing
       at all. There is no upper bound worth asserting there: a hand is allowed
       to arrive later than the table says, and every mechanism that does it
       (the kit's `~` nudge in ninths of a step, the groove's push, the
       humanize drift) is the feel and not an error. What is NOT allowed is
       arriving EARLY — a lean that has been rounded back towards the grid is
       the whole of Paul's question, and half the declared swing is a floor no
       quantised file can clear. */
    if (!bad && decl && decl.expect > 0.02 && S.medOdd > 0.02 && S.nOdd >= 24 &&
        F.medOdd < 0.5 * decl.expect)
      bad = "the record declares swing " + decl.swing.toFixed(3) +
            (decl.groove ? " + the " + decl.groove + " groove's " + decl.push.toFixed(3) + " push" : "") +
            " = " + decl.expect.toFixed(3) + " of a sixteenth, and the file's second " +
            "sixteenths sit only " + F.medOdd.toFixed(3) + " late — under half of it, " +
            "which is what a quantise looks like";
    // R2b — a HANDED record must arrive off the grid. The hand is the half of
    // the feel that no table declares and no ear checks: silently losing the
    // jitter is the failure this whole gate exists for.
    if (!bad && decl && decl.handed) {
      const want = Math.max(8, Math.round(0.02 * S.n));
      if (F.off < want) bad = "the record is played by a hand (" +
        decl.keys.join("/") + " — a humanize or an unexact acoustic kit) and only " +
        F.off + " of " + F.n + " notes in the file sit off the grid, want at least " + want;
    }
    // R3 — a machine record stays ON the grid: nothing may invent a feel
    if (!bad && S.off === 0 && F.off !== 0)
      bad = "the engine plays this record dead on the grid and the file has " + F.off + " off-grid note(s)";
    if (bad) ok = fail("gate R", bad);
    else {
      // THE PROBE. Snap every Time in a copy onto the sixteenth grid — the
      // exact damage "the groove gets lost in Ableton" describes — and assert
      // this gate goes red. On a record the engine plays straight there is
      // nothing to snap, and the probe says so instead of pretending.
      const snapped = xml.replace(/(<MidiNoteEvent Time=")([^"]*)(")/g,
        (w, a, t, b) => a + String(Math.round(+t * 4) / 4) + b);
      const P = feelOf(fileTimes(snapped));
      if (S.off > 0 && P.off === F.off)
        ok = fail("gate R", "the quantise probe was NOT caught — this gate is reading nothing");
      else pass("gate R", (S.off ? S.off + " of " + S.n + " notes (" + pct(S.off, S.n) +
          ") sit off the sixteenth grid in the file, exactly as the engine plays them" +
          " · second sixteenths " + (S.medOdd >= 0 ? "+" : "") + S.medOdd.toFixed(3) +
          " of a sixteenth (n=" + S.nOdd + "), widest offset " + S.worst.toFixed(3) +
          " · quantise probe caught"
        : "this record is played dead on the grid (" + S.n + " notes, 0 off it) " +
          "and the file is too — a machine's exactness is its identity") +
        (decl ? " · the record declares swing " + decl.swing.toFixed(3) +
          (decl.groove ? " + the " + decl.groove + " groove (+" + decl.push.toFixed(3) + " on the odd slots)" : "") +
          (decl.handed ? ", played by a hand" : ", no hand") +
          (decl.expect > 0.02 && !(S.medOdd > 0.02 && S.nOdd >= 24)
            ? " — NOT ASSERTED: kernel.js swings odd steps only (swing(g,i) = (i%2)*g.swing) and this " +
              "record puts " + S.nOdd + " note(s) there, so the declared lean is not playable and the " +
              "export cannot invent it"
            : "")
        : declErr ? " · the declared feel could not be read (" + declErr + ")"
                  : " · no record to ask for a declared swing (--score run)"));
    }
  }

  /* ---- Gate C — THE COLOURS (2026-09-03) --------------------------------
     Paul: "all of the clips are the same color -- they should be the color of
     the track." They were: every clip is a copy of the GroovePool template and
     carried its `<Color Value="7" />` into all thirty-odd clips of a set whose
     tracks were 20 / 7 / 18 / 24. Two things are asserted here and both are
     read off the donors rather than decided:

       · A CLIP WEARS ITS TRACK'S COLOUR. That is Live's own rule and it is
         visible in every file Paul saved — Ableton2, Answers and Answers2 each
         have every clip's Color equal to its track's (24/24, 16/16, 12/12,
         2/2, 1/1), because a clip inherits the track's colour when Live makes
         it. Nothing in this repo invented that.
       · A TRACK WEARS ITS PART FAMILY'S COLOUR, from als.js TRACK_COLOR, and
         the gate ASKS THE EXPORTER (colorOfLane) rather than keeping a second
         copy of the table — gate 1 does the same for clip names, and the day
         it did not it went stale.
     ...and the corollary Paul's sentence implies: two ADJACENT tracks may
     share a colour only when they are the same family, which is what makes the
     colours mean something instead of being six numbers. */
  {
    const laneNames = [];
    for (const b of boxes) for (const l of (all ? b.lanes : b.lanes.slice(0, 1)))
      if (!laneNames.includes(l.name)) laneNames.push(l.name);
    const cols = columnNames(boxes, laneNames);
    const laneOfCol = {};
    for (const n of laneNames) laneOfCol[cols[n]] = n;
    const trackColor = (t) => { const m = /<Color Value="(-?\d+)"/.exec(t); return m ? +m[1] : null; };
    /** Null = agrees. Pointed at a deliberately recoloured copy for the probe. */
    const check = (x) => {
      const mine = tracksOf(x).filter((t) => !donorNames.has(t.name));
      if (!mine.length) return "no authored track in the output";
      const seq = [];
      for (const t of mine) {
        const tc = trackColor(t.text);
        const lane = laneOfCol[t.name];
        const want = lane != null ? colorOfLane(boxes, lane) : null;
        if (want == null) return 'track "' + t.name + '" answers to no lane of this record';
        if (tc !== want) return 'track "' + t.name + '" is colour ' + tc +
          ", and als.js colorOfLane says " + want;
        for (const c of clipsOf(t.text))
          if (c.color !== tc) return 'clip "' + c.name + '" is colour ' + c.color +
            ' on a track coloured ' + tc + " — a clip wears its track's colour, which is what Live's own donors do";
        seq.push({ name: t.name, lane, color: tc });
      }
      for (let i = 1; i < seq.length; i++)
        if (seq[i].color === seq[i - 1].color &&
            colorOfLane(boxes, seq[i].lane) !== colorOfLane(boxes, seq[i - 1].lane))
          return 'the adjacent tracks "' + seq[i - 1].name + '" and "' + seq[i].name +
            '" share colour ' + seq[i].color + " without sharing a family";
      // ...and the donor's own tracks and returns keep what Live gave them
      const donorCol = new Map(tracksOf(donorXml).map((t) => [t.name, trackColor(t.text)]));
      for (const t of tracksOf(x)) if (donorNames.has(t.name) && donorCol.get(t.name) !== trackColor(t.text))
        return 'donor track "' + t.name + '" was recoloured to ' + trackColor(t.text) +
          ", want the " + donorCol.get(t.name) + " Live gave it";
      return null;
    };
    const cErr = check(xml);
    if (cErr) ok = fail("gate C", cErr);
    else {
      // THE PROBE: put the old template colour back on one clip and assert red.
      const probe = check(xml.replace(/(<MidiClip [^>]*>[\s\S]{0,4000}?<Color Value=")(-?\d+)(")/,
                                      "$1" + 7 + "$3"));
      if (!probe) ok = fail("gate C", "the recoloured-clip probe was NOT caught — the colour check is reading nothing");
      else {
        const mine = tracksOf(xml).filter((t) => !donorNames.has(t.name));
        const nClips = mine.reduce((a, t) => a + clipsOf(t.text).length, 0);
        pass("gate C", nClips + " clip(s) on " + mine.length + " track(s), every clip the colour " +
          "of the track it sits on · " + mine.map((t) => t.name + " " + trackColor(t.text)).join(", ") +
          " · the six family colours are " +
          Object.entries(TRACK_COLOR).map(([k, v]) => k + " " + v).join(" / ") +
          " · recoloured-clip probe caught");
      }
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
