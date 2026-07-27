#!/usr/bin/env node
// transcode-beds.js — re-encode the found-sound BEDS smaller.
//
// Beds are the biggest thing a listener downloads: 192 files, ~104 MB, and
// nearly half the media bytes of a session. They were already MP3, just
// generously encoded (~90 kbps mono 44.1 kHz for 40-second loops).
//
// WHY THE OUTPUT IS RENAMED. Media under found/ is immutable-by-name: nginx
// serves it with a one-year immutable header, the service worker's media cache
// is cache-first and NEVER revalidates, and the deploy aborts on
// "CHANGED-UNDER-SAME-NAME". Re-encoding in place would therefore fail the
// deploy, and if forced, every returning listener would keep the old bytes
// forever. So the new encode lands at found/<id>.64.mp3 and the resolver's
// convention moves with it. The bitrate is in the name on purpose: change the
// encode again and you change the name again, which is the whole discipline.
//
// WHY NOT EVERYTHING. Beds are long, filtered, pitched-down ambience with no
// sample-aligned metadata — no loop points, no slice grid — so a decoder's
// ~25 ms lead-in lands inside the ambience and is inaudible. Anything that
// fires ON a beat (drums, perc, hits, chimes, breaks, stml chops) stays WAV:
// 25 ms is about half a 16th at 170 bpm, which is audibly late.
//
//   node tools/transcode-beds.js [--dry] [--keep-old] [--jobs N]
"use strict";
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = path.join(__dirname, "..");
process.chdir(ROOT);
global.window = global;
require("./../engine/theory.js");
require("./../engine/pipes.js");
require("./../engine/csd-engine.js");
const K = require("./../engine/genre-kernel.js");

const DRY = process.argv.includes("--dry");
const KEEP = process.argv.includes("--keep-old");
const JOBS = process.argv.includes("--jobs") ? +process.argv[process.argv.indexOf("--jobs") + 1] : 4;

const KBPS = 64, SUFFIX = ".64.mp3";

const run = (cmd, args) => new Promise((res, rej) =>
  execFile(cmd, args, { maxBuffer: 1 << 26 }, (e, so, se) => (e ? rej(new Error(se || e.message)) : res(so))));

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

(async () => {
  const ids = Object.keys(K.SOURCES).filter((id) => fs.existsSync("found/" + id + ".mp3"));
  let bIn = 0, bOut = 0, failed = [];

  const results = await pool(ids, JOBS, async (id) => {
    const oldMp3 = "found/" + id + ".mp3";
    // ALWAYS the existing mp3, never the sibling .ogg. The .ogg is the RAW
    // archive download; the .mp3 is a trimmed excerpt (fetch-found-sound.sh
    // cuts `-ss <start> -t <dur>` out of it). Re-deriving from the .ogg looks
    // like it avoids a second generation of loss and instead throws the trim
    // away — it turned 38 beds from ~40s into ~300s and made the crate BIGGER.
    const src = oldMp3;
    const dst = "found/" + id + SUFFIX;
    const inB = fs.statSync(oldMp3).size;
    if (DRY) return { id, inB, outB: Math.round(inB * KBPS / 90), src, oldMp3, dry: true };
    try {
      await run("ffmpeg", ["-v", "error", "-y", "-i", src, "-ac", "1", "-ar", "44100",
        "-c:a", "libmp3lame", "-b:a", KBPS + "k", "-write_xing", "1", dst]);
      const outB = fs.statSync(dst).size;
      if (!outB) throw new Error("empty output");
      return { id, inB, outB, src, oldMp3 };
    } catch (e) {
      try { fs.unlinkSync(dst); } catch {}
      return { id, err: e.message, oldMp3 };
    }
  });

  for (const r of results) {
    if (!r) continue;
    if (r.err) { failed.push(r.id + ": " + r.err); continue; }
    bIn += r.inB; bOut += r.outB;
  }

  // Retire the old names only after every new one exists — the old file is the
  // only source for the 154 beds with no .ogg twin.
  if (!DRY && !KEEP && !failed.length)
    for (const r of results) if (r && !r.err) { try { fs.unlinkSync(r.oldMp3); } catch {} }

  const mb = (b) => (b / 1048576).toFixed(1) + "MB";
  console.log(`${DRY ? "[dry] " : ""}transcode-beds: ${results.filter((r) => r && !r.err).length} beds @ ${KBPS}k mono 44.1k`);
  console.log(`  before ${mb(bIn)}  after ${mb(bOut)}  saved ${mb(bIn - bOut)}  (${(100 * bOut / (bIn || 1)).toFixed(0)}% of original)`);
  if (failed.length) { console.log(`  FAILED (${failed.length}), old files kept:`); failed.forEach((f) => console.log("    " + f)); }
  console.log(`  resolver convention must be found/<id>${SUFFIX} — see engine/faust/found-player.js localPathFor`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
