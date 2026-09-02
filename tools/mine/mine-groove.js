#!/usr/bin/env node
// mine-groove.js — per-genre VELOCITY-accent profiles from the corpus DB, in
// the shape pipes.js's accentProfile consumes: 16 amp multipliers, one per
// 16th-note slot of a 4-beat measure, normalized to mean 1.
//
//   node tools/mine/mine-groove.js <rip> [--db path] [--min-conf 0.55]
//
// This is the "groove profile" organ: WHERE in the bar a genre leans. The
// timing half of groove already lives in the unified time-feel (swing/
// push-pull); this mines the LOUDNESS half — dub's offbeat skank lean, jazz's
// 2-and-4, folk's downbeat plainness — from the trusted melody lines'
// velocities. Emitted tables are clamped to ±30% so the profile is a lean,
// never a gate; splice into pipes.js ACCENT_PROFILES.
"use strict";
const C = require("./corpus-db.js");

function main() {
  const argv = process.argv.slice(2);
  const rip = argv[0];
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
  if (!rip || rip.startsWith("--")) { console.error("usage: mine-groove.js <rip> [--db p] [--min-conf .55]"); process.exit(1); }
  const Sqlite = C.requireSqlite();
  const db = new Sqlite(opt("--db", "/mnt/sources/relocated/stellate-midi-corpus/corpus.db"), { readonly: true });
  const minConf = +opt("--min-conf", 0.55);

  const rows = db.prepare("SELECT f.ppq, m.blob FROM files f JOIN melody m ON m.file_id=f.id WHERE f.rip=? AND f.mel_conf>=?").all(rip, minConf);
  const sum = new Float64Array(16), n = new Float64Array(16);
  for (const r of rows) {
    for (const note of C.unpackNotes(r.blob, r.ppq)) {
      const slot = Math.round((note.beat % 4) * 4) % 16;
      if (slot < 0 || slot > 15) continue;
      sum[slot] += note.vel; n[slot]++;
    }
  }
  const mean = [...sum].reduce((a, b) => a + b, 0) / Math.max(1, [...n].reduce((a, b) => a + b, 0));
  const prof = [...sum].map((s, i) => n[i] ? +Math.max(0.7, Math.min(1.3, (s / n[i]) / mean)).toFixed(3) : 1);
  console.log(`${rip}: ${rows.length} trusted lines, ${[...n].reduce((a, b) => a + b, 0)} notes`);
  console.log(`  slots (16ths of a 4-beat bar): beats ${prof.slice(0, 4).join(" ")} | ${prof.slice(4, 8).join(" ")} | ${prof.slice(8, 12).join(" ")} | ${prof.slice(12).join(" ")}`);
  console.log(`  splice:  ${rip}: [${prof.join(",")}],`);
  const beats = [0, 4, 8, 12].map(i => prof[i]);
  const offs = [2, 6, 10, 14].map(i => prof[i]);
  console.log(`  lean: downbeats ${(beats.reduce((a, b) => a + b) / 4).toFixed(3)}  8th-offbeats ${(offs.reduce((a, b) => a + b) / 4).toFixed(3)}`);
}
main();
