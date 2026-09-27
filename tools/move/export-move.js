#!/usr/bin/env node
// tools/move/export-move.js — the CLI. Read the donor Set, compose the genre, write the
// Set folder Move wants, and end by naming the one thing this process cannot settle.
//
// ZERO DEPENDENCIES, the same law export-als.js states: nothing here is installed and
// nothing here fetches. A Move Set is plain JSON, so unlike the .als side there is not even
// a zlib call — readFileSync, JSON.parse, JSON.stringify, writeFileSync.
//
// THE LAST LINE IS THE ASK, ALWAYS — but for Move the ask is answerable by a machine, and
// this is the one export target where that is true. als-gate.js has to finish at "GATE 4 —
// PAUL: open it in Live and say whether it opens", because Live is on Paul's machine and no
// gate here can drive it. Move will answer for itself over D-Bus in about five seconds
// (move-gate.js gate 4, tools/move/probe.sh), so the line this prints is a command and not
// a request. It is still printed on every successful run whether or not anybody asked.
//
//   node tools/move/export-move.js --genre acid --seed 7 --out /tmp/sets
//   node tools/move/export-move.js --list
//
// --presets DIR points at a copy of a Move's "/data/CoreLibrary/Track Presets" (pull one
// with tools/move/diagnose.sh) and swaps in core-library instruments for the genre. Without
// it the donor's own four instruments are kept, which is what the gate's offline rows use
// so they compare like with like.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { moveSet, sections, presetUri } from "../../nukernel/export/move.js";
import { nukernel } from "./nukernel-node.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DONOR = path.join(HERE, "donor", "Song.abl");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };

const ns = nukernel();
const S = sections(ns);

if (flag("--list")) {
  for (const g of S.genreList()) console.log(g.key.padEnd(20) + g.title);
  process.exit(0);
}

const key = opt("--genre", argv[0] && !argv[0].startsWith("--") ? argv[0] : "acid");
const seed = Number(opt("--seed", "7"));
const outDir = opt("--out", path.join(process.cwd(), "sets"));
const presetsDir = opt("--presets", null);

const list = S.genreList();
let gk = key;
if (!list.some((g) => g.key === gk)) {
  const q = String(gk).toLowerCase();
  const hits = list.filter((g) => g.key.includes(q) || g.title.toLowerCase().includes(q) ||
                                  g.label.toLowerCase().includes(q));
  if (hits.length === 1) gk = hits[0].key;
  else {
    console.error(`unknown genre "${key}".` +
      (hits.length ? " Did you mean: " + hits.slice(0, 12).map((g) => `${g.key} (${g.title})`).join(", ") : "") +
      `\nRun with --list for all ${list.length}.`);
    process.exit(1);
  }
}
if (!Number.isFinite(seed)) { console.error("--seed wants a number"); process.exit(1); }

// The Track Presets a Move carries, indexed the way choosePresets wants them.
function presetsFrom(dir) {
  const files = [];
  (function walk(d, rel) {
    for (const e of readdirSync(d)) {
      const full = path.join(d, e);
      if (statSync(full).isDirectory()) walk(full, rel + e + "/");
      else if (/\.json$/i.test(e)) files.push(rel + e);
    }
  })(dir, "");
  return {
    index: files.map((rel) => ({ rel, name: path.basename(rel, ".json"), cat: path.dirname(rel) })),
    load: (rel) => { try { return JSON.parse(readFileSync(path.join(dir, rel), "utf8")); } catch (e) { return null; } },
  };
}

const donor = JSON.parse(readFileSync(DONOR, "utf8"));
const picks = presetsDir ? presetsFrom(presetsDir) : null;
const r = moveSet(ns, donor, gk, seed, picks);

const dir = path.join(outDir, r.name);
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "Song.abl"), JSON.stringify(r.song, null, 2));
writeFileSync(path.join(dir, "song_mode.json"), JSON.stringify(r.songMode));

const bars = Math.round(r.plan.entries.reduce((n, e) => n + e.beats, 0) / 4);
const ts = r.song.timeSignature;
console.log(`${r.name}: ${r.song.tempo} BPM, ${ts.upper}/${ts.lower}, key ${r.song.rootNote} ${r.song.scale}, ` +
            `${bars} bars, ${r.plan.entries.length} sections`);
console.log("scenes: " + r.plan.scenes.map((s) => s.name).join(" | "));
console.log("sounds: " + r.sounds.join(" / ") + (picks ? "" : "   (the donor's own -- pass --presets to swap them)"));
console.log("clips per track: " + r.plan.columns.map((c, t) => ["drums", "bass", "keys", "lead"][t] + " " + c.filter(Boolean).length).join(", "));
if (r.plan.stats.approxTrackPicks)
  console.log(`note: ${r.plan.stats.approxTrackPicks} late-section part(s) reuse their closest clip (out of the 8 slots)`);
console.log("wrote " + dir);
console.log("");
console.log(`GATE 4 — ask Move itself, it will answer: node tools/move/move-gate.js "${path.join(dir, "Song.abl")}" --genre ${gk} --seed ${seed}`);
