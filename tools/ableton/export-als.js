#!/usr/bin/env node
// tools/ableton/export-als.js — the CLI. gunzip the donor, splice the score in,
// gzip it back out, run the structural gates, and end by asking Paul to open it.
//
// ZERO DEPENDENCIES, by the offline law and by main:docs/ABLETON-EXPORT.md's own
// sentence: "a Node CLI, zero deps (zlib + string XML are built in)". Nothing
// here is installed and nothing here fetches.
//
// THE LAST LINE IS THE ASK, ALWAYS. Four structural gates can prove the file is
// well-formed, id-unique, round-trips against the song and emits no element the
// donor does not already contain. None of them can prove Live opens it, and Live
// is on Paul's machine. That is the LIVE-gate law this repo has missed every
// time (memory: "verify.sh misses the live path"), so the ask is printed on
// every successful run whether or not anybody asked for it.
import { gzipSync, gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { alsFromScore } from "../../nukernel/export/als.js";
import { loadScore } from "./score-node.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DONOR = path.join(HERE, "donor", "Generic.als");

function parseArgs(argv) {
  const a = { genre: null, song: null, score: null, out: null, all: false, grid: true, gate: true, engine: true };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--genre") a.genre = argv[++i];
    else if (v === "--song") a.song = argv[++i];
    else if (v === "--score") a.score = argv[++i];
    else if (v === "--out") a.out = argv[++i];
    else if (v === "--all") a.all = true;
    else if (v === "--rubato") a.grid = false;
    else if (v === "--grid") a.grid = true;
    else if (v === "--no-gate") a.gate = false;
    else if (v === "--no-engine") a.engine = false;
    else if (v === "-h" || v === "--help") a.help = true;
    else throw new Error("unknown argument: " + v);
  }
  return a;
}

const USAGE = `usage: node tools/ableton/export-als.js (--genre <key> | --song <file.json> | --score <file.json>) --out <file.als>
  --score    splice a Score the PAGE already folded (test/als-page.browser.js
             hands this the browser button's own output — score-node.mjs says why).
  --all      P1: every lane of every box, session + arrangement + scene names.
             The default is P0: the first box's first lane, one clip.
  --rubato   keep nukernel's tempo map (bars come out fractional in Live).
  --no-engine  skip the 222 ms engine warm: no cast, no register home.
  --no-gate  skip the structural gates (you almost never want this).`;

export async function main(argv) {
  const a = parseArgs(argv);
  if (a.help || (!a.genre && !a.song && !a.score) || !a.out) { console.log(USAGE); return a.help ? 0 : 2; }

  const score = await loadScore({ genre: a.genre, songPath: a.song, scorePath: a.score,
                                 grid: a.grid, engine: a.engine });
  const donorXml = gunzipSync(readFileSync(DONOR)).toString("utf8");
  const { RACK_GZIP_B64 } = await import("../../nukernel/export/drumrack.js");
  const rack = gunzipSync(Buffer.from(RACK_GZIP_B64, "base64")).toString("utf8");
  const res = alsFromScore(donorXml, score, { all: a.all, drumRack: rack });
  writeFileSync(a.out, gzipSync(Buffer.from(res.xml, "utf8")));

  console.log("nukernel -> Ableton  ·  " + (a.all ? "P1 (all lanes)" : "P0 (one lane)"));
  console.log("  song     " + (a.song || a.genre || a.score) + "  ·  " + score.bpm + " bpm  ·  " +
              score.boxes.length + " boxes");
  // The flag prints its choice on every run, because the alternative is Paul
  // opening a set whose bars are 3.98 beats long and having no idea why.
  console.log("  time     " + (a.grid ? "--grid: rubato off, bars are metric; the swing and " +
              "humanize offsets stay baked into the note times" :
              "--rubato: nukernel's tempo map is on, bars will be fractional in Live"));
  // P0 does not warm the engine, so it has no cast and no register home. Say so
  // here rather than letting it be discovered as "why is the bass so high?".
  console.log("  cast     " + (score.engine
    ? score.cast.map((c) => c.v + " " + c.instr).join(", ") + "  (register home applied)"
    : "--no-engine: no cast and no register home — notes are at their WRITTEN octave " +
      "and tracks are named by seat alone"));
  if (score.folded) console.log("  folded   " + score.folded + " octave shift(s) to bring lanes inside MIDI 0..127");
  if (score.skipped) console.log("  skipped  " + score.skipped + " events with no pitch and no drum lane");
  for (const n of res.notes) console.log("  clip     " + n);
  console.log("  wrote    " + a.out + "  (" + res.tracks + " track" +
              (res.tracks === 1 ? "" : "s") + ", " + res.clips + " clips, " +
              readFileSync(a.out).length + " bytes)");

  if (a.gate) {
    const { runGates } = await import("./als-gate.js");
    const ok = await runGates(a.out, { genre: a.genre, song: a.song, score: a.score,
                                      all: a.all, grid: a.grid, engine: a.engine });
    if (!ok) return 1;
  }
  console.log("");
  console.log('GATE 4 — PAUL: open "' + path.resolve(a.out) + '" in Live 12.4.3 and say whether it opens.');
  return 0;
}

// Same guard as als-gate.js, same reason: argv[1] is undefined under `node -e`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c),
    (e) => { console.error("export failed: " + e.message); process.exit(1); });
}
