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

/* UMD, 2026-09-07 (docs/REMIX.md "the pipeline in the browser"), body NOT
   reindented so the diff is the head and the foot alone. `corpus-db.js` moved
   into `main()`: `accentProfile` takes NOTES, not a database, and the top-level
   require was a leftover of the file it was lifted out of — it dragged `fs`,
   `path` and a `better-sqlite3` probe onto any page that wanted a velocity
   lean. The clamp and the mean-1 law are untouched and still documented above. */
(function (root) {
"use strict";
const NODE = typeof module !== "undefined" && !!module.exports;

/* LIFTED OUT OF main() 2026-09-06 for tools/remix.js, which measures the same
   lean on ONE file's notes rather than on a rip's trusted lines. The body is
   this script's own, cut and pasted, so the CLI prints what it always printed;
   only the accumulation loop moved out of the DB read. The ±30% clamp and the
   "normalized to mean 1" law are the table's, not the caller's, and they stay
   here where they are documented. */
function accentProfile(notes, { slots = 16, beatsPerBar = 4 } = {}) {
  const sum = new Float64Array(slots), n = new Float64Array(slots);
  for (const note of notes) {
    const slot = Math.round((note.beat % beatsPerBar) * (slots / beatsPerBar)) % slots;
    if (slot < 0 || slot > slots - 1) continue;
    sum[slot] += note.vel; n[slot]++;
  }
  const tot = [...n].reduce((a, b) => a + b, 0);
  const mean = [...sum].reduce((a, b) => a + b, 0) / Math.max(1, tot);
  const prof = [...sum].map((s, i) => n[i] ? +Math.max(0.7, Math.min(1.3, (s / n[i]) / mean)).toFixed(3) : 1);
  return { prof, notes: tot };
}

function main() {
  const argv = process.argv.slice(2);
  const rip = argv[0];
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
  if (!rip || rip.startsWith("--")) { console.error("usage: mine-groove.js <rip> [--db p] [--min-conf .55]"); process.exit(1); }
  const C = require("./corpus-db.js");     // the DB is the CLI's, not the module's
  const Sqlite = C.requireSqlite();
  const db = new Sqlite(opt("--db", "/mnt/sources/relocated/stellate-midi-corpus/corpus.db"), { readonly: true });
  const minConf = +opt("--min-conf", 0.55);

  const rows = db.prepare("SELECT f.ppq, m.blob FROM files f JOIN melody m ON m.file_id=f.id WHERE f.rip=? AND f.mel_conf>=?").all(rip, minConf);
  const all = [];
  for (const r of rows) for (const note of C.unpackNotes(r.blob, r.ppq)) all.push(note);
  const { prof, notes: nTot } = accentProfile(all);
  console.log(`${rip}: ${rows.length} trusted lines, ${nTot} notes`);
  console.log(`  slots (16ths of a 4-beat bar): beats ${prof.slice(0, 4).join(" ")} | ${prof.slice(4, 8).join(" ")} | ${prof.slice(8, 12).join(" ")} | ${prof.slice(12).join(" ")}`);
  console.log(`  splice:  ${rip}: [${prof.join(",")}],`);
  const beats = [0, 4, 8, 12].map(i => prof[i]);
  const offs = [2, 6, 10, 14].map(i => prof[i]);
  console.log(`  lean: downbeats ${(beats.reduce((a, b) => a + b) / 4).toFixed(3)}  8th-offbeats ${(offs.reduce((a, b) => a + b) / 4).toFixed(3)}`);
}
const api = { accentProfile };
if (NODE) module.exports = api;
else root.NuMineGroove = api;
if (NODE && require.main === module) main();
})(typeof window !== "undefined" ? window : globalThis);
