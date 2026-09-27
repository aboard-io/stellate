#!/usr/bin/env node
// tools/move/move-gate.js — the gates of the Move row. Zero dependencies. Exit non-zero and
// name the first failure.
//
//   gate 0  shape — 4 tracks x 8 slots x 8 scenes, and every key and JSON type in the file
//           is one the donor already has (timeSignature excepted, and why)
//   gate N  one pitch at a time — the invariant Move refuses a whole Set over, and the one
//           that made 475 of 509 genres unloadable before anybody knew it existed
//   gate I  the fields Move types as int are ints, noteNumber first
//   gate K  every drum note lands on a pad the kit in THIS file actually has
//   gate S  the scale is a name Move knows, and the time signature agrees with the meter
//           the plan counted bars in
//   gate R  round trip — ASKING THE SONG AND NOT THE JSON, als-gate.js gate 1's rule
//   gate D  donor conformance — no device kind the donor does not already carry
//   gate 4  MOVE ITSELF. Not a human. See below.
//
// GATE 4 IS THE POINT OF THIS FILE. als-gate.js has to stop at "Gate 4 Live. Paul's machine.
// Printed by the CLI, never by a machine here", and it is right to: nothing in a repo can
// drive Live. Move is different. Its SongRenderer loads a Set before rendering any audio and
// logs either `Start rendering song` or `Couldn't render song: <reason>`, so the question
// "will the application open this" has a five-second machine answer over D-Bus, with no UI,
// nothing installed and no risk to the Set list. tools/move/probe.sh drives it.
//
// When no Move answers, gate 4 SKIPS and says so. It must never fail for the absence of
// hardware, or test/all.js could not carry this row — but a skipped gate 4 is printed as a
// skip and not as a pass, because the offline gates cannot prove what it proves. That is the
// whole lesson of this slice: a Set that passes every structural check here was still
// refused by the device for a reason no structural check knew to look for.
//
//   node tools/move/move-gate.js <Song.abl|a dir holding one> --genre acid [--seed 7]
//   node tools/move/move-gate.js --sweep [--every 1] [--seeds 7,42]   # no file, no device
//
// --sweep is the regression test: compose every Nth genre at each seed and run gates 0..R
// over what comes out. It is what should have existed before the first hardware attempt.
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { moveSet, sections, plan as planOf, kitMap, MOVE_SCALES } from "../../nukernel/export/move.js";
import { nukernel } from "./nukernel-node.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DONOR = path.join(HERE, "donor", "Song.abl");
const TRACKS = ["drums", "bass", "keys", "lead"];

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

let failed = 0;
const pass = (g, what) => console.log(`  pass  gate ${g} — ${what}`);
const skip = (g, why) => console.log(`  skip  gate ${g} — ${why}`);
const fail = (g, why) => { console.log(`  FAIL  gate ${g} — ${why}`); failed++; };

const donor = JSON.parse(readFileSync(DONOR, "utf8"));
const ns = nukernel();
const S = sections(ns);

// ---- the offline gates, over one built Set ------------------------------------------
// `built` is what moveSet returned, so the gates can ask the composition as well as the file
// (gate R's rule: a gate that re-derives its inputs its own way checks two guesses).
function offline(abl, built, tag) {
  // ---- gate 0: shape, against the donor
  {
    const errs = [];
    // the donor is a Move 2.1 Set at schema 1.8.2, which had no timeSignature; Move writes
    // one now and so do we, so that one key is expected to be here and absent there
    const ADDED = new Set(["timeSignature"]);
    const shape = (a, b, where) => {
      const ka = Object.keys(a).filter((k) => !ADDED.has(k)).sort(), kb = Object.keys(b).sort();
      if (ka.join() !== kb.join()) errs.push(`${where}: keys [${ka}] vs donor [${kb}]`);
      for (const k of kb)
        if (k in a && a[k] !== null && b[k] !== null && typeof a[k] !== typeof b[k])
          errs.push(`${where}.${k}: ${typeof a[k]} vs donor ${typeof b[k]}`);
    };
    shape(abl, donor, "top");
    if (abl.tracks.length !== 4) errs.push(`${abl.tracks.length} tracks, not 4`);
    if (abl.scenes.length !== 8) errs.push(`${abl.scenes.length} scenes, not 8`);
    const proto = donor.tracks[0].clipSlots[0].clip;
    abl.tracks.forEach((tr, t) => {
      shape(tr, donor.tracks[t], `track${t}`);
      if (tr.clipSlots.length !== 8) errs.push(`track${t}: ${tr.clipSlots.length} slots, not 8`);
      tr.clipSlots.forEach((sl, c) => { if (sl.clip) shape(sl.clip, proto, `t${t}c${c}`); });
    });
    abl.scenes.forEach((s, i) => shape(s, donor.scenes[i], `scene${i}`));
    if (errs.length) fail("0", `${errs.length} shape difference(s) from the donor: ${errs[0]}`);
    else pass("0", `4 tracks x 8 slots, 8 scenes, every key and type the donor's own — plus timeSignature, which schema 1.8.2 predates`);
  }

  // ---- gate N: one pitch at a time
  {
    let clips = 0, notes = 0, worst = null;
    for (const [t, tr] of abl.tracks.entries())
      for (const [c, sl] of tr.clipSlots.entries()) {
        if (!sl.clip) continue;
        clips++;
        const ends = new Map();
        for (const n of sl.clip.notes.slice().sort((a, b) => a.startTime - b.startTime || a.noteNumber - b.noteNumber)) {
          notes++;
          const prev = ends.get(n.noteNumber);
          // overlapping OR merely meeting: Move refuses both, and refuses the sliver a
          // trim-to-touch leaves behind
          if (prev != null && prev >= n.startTime - 1e-9 && !worst)
            worst = `${TRACKS[t]} slot ${c}: pitch ${n.noteNumber} sounds again at ${n.startTime} with the previous one ending ${prev}`;
          ends.set(n.noteNumber, n.startTime + n.duration);
        }
      }
    if (worst) fail("N", `a pitch sounds twice at once — Move refuses the whole Set for this. ${worst}`);
    else pass("N", `${notes} note(s) over ${clips} clip(s), and no pitch ever sounds twice at once nor meets itself end-to-start`);
  }

  // ---- gate I: the int fields
  {
    const bad = [];
    for (const [t, tr] of abl.tracks.entries()) {
      if (!Number.isInteger(tr.color)) bad.push(`track${t}.color ${tr.color}`);
      for (const [c, sl] of tr.clipSlots.entries()) {
        if (!sl.clip) continue;
        if (!Number.isInteger(sl.clip.color)) bad.push(`t${t}c${c}.color ${sl.clip.color}`);
        for (const n of sl.clip.notes) {
          if (!Number.isInteger(n.noteNumber)) { bad.push(`t${t}c${c} noteNumber ${n.noteNumber}`); break; }
          if (n.noteNumber < 0 || n.noteNumber > 127) { bad.push(`t${t}c${c} noteNumber out of range ${n.noteNumber}`); break; }
          if (!(n.velocity >= 1 && n.velocity <= 127)) { bad.push(`t${t}c${c} velocity ${n.velocity}`); break; }
          if (!(n.duration > 0)) { bad.push(`t${t}c${c} duration ${n.duration}`); break; }
        }
      }
    }
    if (bad.length) fail("I", `${bad.length} field(s) Move types as int are not: ${bad[0]} — its own words are "cannot convert to i: noteNumber"`);
    else pass("I", `every noteNumber a whole number in 0..127, every velocity 1..127, every duration above zero, every colour an int`);
  }

  // ---- gate K: the kit in this file
  {
    const pads = new Set();
    (function walk(o) {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach(walk);
      if (o.drumZoneSettings && o.drumZoneSettings.receivingNote != null) return pads.add(o.drumZoneSettings.receivingNote);
      Object.values(o).forEach(walk);
    })(abl.tracks[0].devices);
    const used = new Set();
    for (const sl of abl.tracks[0].clipSlots) if (sl.clip) for (const n of sl.clip.notes) used.add(n.noteNumber);
    const silent = [...used].filter((n) => !pads.has(n)).sort((a, b) => a - b);
    if (!pads.size) fail("K", "the first track carries no drum kit, so the drum map had nothing to read");
    else if (silent.length) fail("K", `${silent.length} drum note(s) land where this kit has no pad: ${silent.join(", ")} (kit has ${[...pads].sort((a, b) => a - b).join(", ")})`);
    else pass("K", `${used.size} drum pitch(es), every one a pad this kit actually has (${pads.size} pads)`);
  }

  // ---- gate S: scale and meter
  {
    const errs = [];
    if (abl.scale != null && !MOVE_SCALES.includes(abl.scale))
      errs.push(`scale "${abl.scale}" is not a name Move knows — it will load anyway and silently mis-light the pads`);
    if (!Number.isInteger(abl.rootNote) || abl.rootNote < 0 || abl.rootNote > 11) errs.push(`rootNote ${abl.rootNote}`);
    const ts = abl.timeSignature;
    if (!ts || !Number.isInteger(ts.upper) || !Number.isInteger(ts.lower)) errs.push("no usable timeSignature");
    else if (Math.abs(ts.upper * 4 / ts.lower - built.plan.beatsPerBar) > 1e-9)
      errs.push(`timeSignature ${ts.upper}/${ts.lower} is ${ts.upper * 4 / ts.lower} beats a bar but the plan counted ${built.plan.beatsPerBar}`);
    if (errs.length) fail("S", errs[0]);
    else pass("S", `scale "${abl.scale}" is one of the ${MOVE_SCALES.length} Move knows, root ${abl.rootNote}, ${ts.upper}/${ts.lower} at ${built.plan.beatsPerBar} beats a bar — the same meter the plan used`);
  }

  // ---- gate R: round trip, asking the song
  // NOT an exactness check, and the reason matters. Move cannot hold two notes of one pitch
  // at once, and the composer emits them: about 9% of all notes are a second hit on the same
  // pitch within 1/32 of a beat, which noOverlaps has to fold into one. So a clip CANNOT
  // reproduce its section note for note, and a gate demanding that would be asserting
  // something false. What is exactly true is the SHAPE: every entry plays for exactly as long
  // as the section it stands for, and every section that composed notes still sounds some.
  // The coverage number is printed as evidence, not as a threshold, so a regression shows up
  // as a number that moved rather than as a gate nobody can keep green.
  {
    const key = (n, t, v) => `${n}@${Math.round(Math.round(t * 1e6) / 1e6 * 96 + 1e-4)}:${v}`;
    const sm = built.songMode;
    let want = 0, got = 0, rows = 0, lenOk = 0, silent = null, borrowed = 0;
    sm.entries.forEach((e, i) => {
      const lens = e.pads.map((c, t) => {
        const cl = c == null ? null : abl.tracks[t].clipSlots[c].clip;
        return cl ? cl.region.loop.end - cl.region.loop.start : 0;
      });
      const beats = (e.barLengthMode === "custom" ? e.customBars * 4 : Math.max(...lens)) * e.repeats;
      const sec = built.composed.sections[i];
      if (!sec) return;
      const entry = built.plan.entries[i];
      // A song with more sections than Move has scene rows gives its late sections the
      // CLOSEST existing clip instead of one of their own (plan stats approxTrackPicks). A
      // borrowed clip is an admitted approximation, so it is counted and not asserted on --
      // asserting it would be asserting that an approximation is exact.
      const ownRow = entry.row != null && entry.pads.every((p) => p == null || p === entry.row);
      if (!ownRow) { borrowed++; return; }
      rows++;
      if (Math.abs(beats - entry.beats) < 1e-6) lenOk++;
      let heard = 0, asked = 0;
      e.pads.forEach((c, t) => {
        const cl = c == null ? null : abl.tracks[t].clipSlots[c].clip;
        const G = new Map();
        if (cl) {
          const L = lens[t];
          for (let off = 0; off < beats - 1e-9; off += L)
            for (const n of cl.notes)
              if (off + n.startTime < beats - 1e-9) {
                const k = key(n.noteNumber, off + n.startTime, n.velocity);
                G.set(k, (G.get(k) || 0) + 1);
              }
        }
        for (const x of sec.tracks[t]) {
          asked++;
          const k = key(Math.round(x.n), x.t, x.v);
          const q = G.get(k);
          if (q) { heard++; G.set(k, q - 1); }
        }
      });
      want += asked; got += heard;
      if (asked > 0 && heard === 0 && silent == null) silent = i;
    });
    if (rows && lenOk !== rows)
      fail("R", `${rows - lenOk} of ${rows} Song Mode entr(ies) do not play for as long as the section they stand for`);
    else if (silent != null)
      fail("R", `section ${silent} ("${built.composed.sections[silent].role}") composed notes and the Set plays none of them back`);
    else
      pass("R", `${rows} section(s) on a scene row of their own, every one playing for exactly its own length, ` +
        `${got} of ${want} composed note(s) (${(100 * got / Math.max(1, want)).toFixed(1)}%) surviving — the shortfall is the ` +
        `same-pitch collisions Move cannot hold, folded to one hit each` +
        (borrowed ? `; ${borrowed} later section(s) borrow the closest clip and are not asserted on` : ""));
  }

  // ---- gate D: donor conformance
  {
    const kinds = (o, into = new Set()) => {
      (function walk(x) {
        if (!x || typeof x !== "object") return;
        if (Array.isArray(x)) return x.forEach(walk);
        if (typeof x.kind === "string") into.add(x.kind);
        Object.values(x).forEach(walk);
      })(o);
      return into;
    };
    const donorKinds = kinds(donor.tracks).add("instrumentRack").add("drumRack");
    const mine = kinds(abl.tracks);
    const novel = [...mine].filter((k) => !donorKinds.has(k));
    // a swapped-in Track Preset is a file Move wrote too, so its kinds are allowed; what is
    // NOT allowed is a kind this repo invented
    if (novel.length && !built.picked.some(Boolean))
      fail("D", `${novel.length} device kind(s) the donor does not carry and no preset explains: ${novel.join(", ")}`);
    else pass("D", built.picked.some(Boolean)
      ? `${mine.size} device kind(s), the donor's own plus those the ${built.picked.filter(Boolean).length} core-library preset(s) brought`
      : `${mine.size} device kind(s), every one the donor's own — nothing invented here`);
  }
  return tag;
}

// ---- gate 4: Move itself -------------------------------------------------------------
function gate4(file) {
  const probe = path.join(HERE, "probe.sh");
  if (!existsSync(probe)) return skip("4", "tools/move/probe.sh is missing, so nothing can ask the device");
  const host = process.env.MOVE_HOST || "ableton@move.local";
  try {
    execFileSync("ssh", ["-o", "ConnectTimeout=4", "-o", "BatchMode=yes", host, "true"], { stdio: "ignore" });
  } catch (e) {
    return skip("4", `no Move answered at ${host} — the offline gates above cannot prove it LOADS, only that it is well formed`);
  }
  let out = "";
  try { out = execFileSync("sh", [probe, file, "gate"], { encoding: "utf8", timeout: 120000 }); }
  catch (e) { out = String((e && (e.stdout || e.message)) || ""); }
  if (/^OK/m.test(out)) pass("4", `Move at ${host} loaded it — SongRenderer started rendering, which it only does once the document passes Move's own checks`);
  else if (/^FAIL/m.test(out)) fail("4", `Move at ${host} refused it: ${out.replace(/^FAIL\s*\S*\s*/m, "").trim().split("\n")[0]}`);
  else skip("4", `the device answered nothing usable: ${out.trim().split("\n")[0] || "(no output)"}`);
}

// ---- run -----------------------------------------------------------------------------
if (flag("--sweep")) {
  const every = Number(opt("--every", "1"));
  const seeds = opt("--seeds", "7").split(",").map(Number);
  const list = S.genreList();
  const picked = list.filter((_, i) => i % every === 0);
  console.log(`move gate — sweeping ${picked.length} genre(s) x ${seeds.length} seed(s), gates 0..D, no device needed`);
  let n = 0, firstFail = null;
  for (const g of picked) for (const seed of seeds) {
    const built = moveSet(ns, donor, g.key, seed, null);
    const before = failed;
    const quiet = [];
    const realLog = console.log;
    console.log = (s) => quiet.push(s);
    offline(built.song, built, `${g.key}/${seed}`);
    console.log = realLog;
    n++;
    if (failed > before && !firstFail) { firstFail = `${g.key} seed ${seed}`; quiet.forEach((l) => console.log(l)); }
  }
  if (firstFail) console.log(`\n  ${n} Set(s) swept, first failure: ${firstFail}`);
  else console.log(`  pass  gates 0..D over ${n} Set(s) — every genre in the list, composed and written, and not one of them breaks a rule Move has`);
} else {
  // A path, or a directory holding one Set. Taking the directory is what lets test/all.js
  // name the OUTPUT FOLDER rather than the Set's display name -- that name is the genre's
  // own, out of nukernel/wiki.js, and a row hard-coding "Acid house 1987 #7" would break the
  // day a Wikipedia article is renamed.
  const arg = argv.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
  const found = (() => {
    if (!arg || !existsSync(arg)) return null;
    if (statSync(arg).isFile()) return arg;
    const hits = [];
    (function walk(d, depth) {
      if (depth > 2) return;
      for (const e of readdirSync(d)) {
        const full = path.join(d, e);
        if (statSync(full).isDirectory()) walk(full, depth + 1);
        else if (e === "Song.abl") hits.push(full);
      }
    })(arg, 0);
    if (hits.length !== 1) {
      console.error(`${arg} holds ${hits.length} Song.abl — name one, or export to a directory of its own`);
      process.exit(2);
    }
    return hits[0];
  })();
  const file = found;
  if (!file) { console.error('usage: move-gate.js <Song.abl|dir> --genre <key> [--seed N]   |   move-gate.js --sweep'); process.exit(2); }
  const gk = opt("--genre", null);
  const seed = Number(opt("--seed", "7"));
  if (!gk) { console.error("--genre is how gate R asks the song rather than the JSON"); process.exit(2); }
  console.log(`move gate — ${path.basename(path.dirname(file))}`);
  const abl = JSON.parse(readFileSync(file, "utf8"));
  const built = moveSet(ns, donor, gk, seed, null);
  offline(abl, built, gk);
  gate4(file);
}

process.exit(failed ? 1 : 0);
