#!/usr/bin/env node
// corpus-db.test.js — gates for tools/corpus-db.js (the SQLite MIDI corpus).
//   node test/corpus-db.test.js
//
// Gates, in order:
//   1  pack round-trip     packNotes -> unpackNotes is lossless (tick/dur/pitch/vel/ch)
//   2  build round-trip    engine-exported MIDI built into a temp DB: files/notes/
//                          melody/vec rows exist, unpacked note count == parsed count
//   3  melody-ID           on engine exports the extractor picks the MELODY channel
//                          (ch2) over pads/bass/drums for >= 3 of 4 states, conf > .4
//   4  near() sanity       a file's nearest neighbour by cosine is its own seed-twin
//                          (same genre, other seed), not a different genre
// Skips cleanly (exit 0) when better-sqlite3 isn't installed — CI runs without
// tools/node_modules.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

let Sqlite;
try { Sqlite = require("../tools/node_modules/better-sqlite3"); }
catch (e) { console.log("SKIP  corpus-db: better-sqlite3 not installed (npm install in tools/)"); process.exit(0); }

const K = require("../engine/genre-kernel.js");
const M = require("../engine/midi-export.js");
const Mine = require("../tools/mine-midi.js");
const C = require("../tools/corpus-db.js");

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};

// ---- 1: pack round-trip ----
(() => {
  const parsed = Mine.parseSmf(M.buildMidi(K.track("jazz", { seed: 1 })));
  const back = C.unpackNotes(C.packNotes(parsed, parsed.notes), parsed.ppq);
  let ok = back.length === parsed.notes.length;
  for (let i = 0; ok && i < back.length; i++) {
    const a = parsed.notes[i], b = back[i];
    if (a.tick !== b.tick || a.pitch !== b.pitch || a.vel !== b.vel || a.ch !== b.ch) ok = false;
    if (Math.abs(a.dur - b.dur) > 1 / parsed.ppq + 1e-9) ok = false;
  }
  gate("pack round-trip lossless", ok, `${back.length} notes`);
})();

// ---- 2+3+4: temp corpus from engine exports ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-db-test-"));
const states = [["jazz", 1], ["jazz", 5], ["jungle", 1], ["folk", 3]];
for (const [g, s] of states)
  fs.writeFileSync(path.join(tmp, `${g}-s${s}.mid`), M.buildMidi(K.track(g, { seed: s })));
const dbPath = path.join(tmp, "test.db");
const db = C.openDb(Sqlite, dbPath);
const res = C.buildDirs(db, [tmp], {});
(() => {
  const n = db.prepare("SELECT COUNT(*) c FROM files").get().c;
  const blobs = db.prepare("SELECT COUNT(*) c FROM notes").get().c;
  const vecs = db.prepare("SELECT COUNT(*) c FROM vec").get().c;
  let countsOk = true;
  for (const r of db.prepare("SELECT f.id,f.path,f.ppq,f.n_notes,n.blob FROM files f JOIN notes n ON n.file_id=f.id").all()) {
    const parsed = Mine.parseSmf(fs.readFileSync(r.path));
    if (C.unpackNotes(r.blob, r.ppq).length !== parsed.notes.length || r.n_notes !== parsed.notes.length) countsOk = false;
  }
  gate("build round-trip: rows + note counts", n === 4 && blobs === 4 && vecs === 4 && res.failed === 0 && countsOk,
    `${n} files, ${blobs} note blobs, ${vecs} vectors`);
})();
(() => {
  // the two-sided contract: real leads (jazz) are found on ch2 with conf above
  // the report threshold (.55); leadless arrangements (jungle seed 1 has SIX
  // melody notes, folk seed 3 a 43-note wisp) must come back BELOW it — the
  // extractor's job there is honest uncertainty, not a confident wrong answer
  const rows = db.prepare("SELECT path, mel_ch, mel_conf, mel_n FROM files").all();
  const jazz = rows.filter(r => /jazz/.test(r.path));
  const leadless = rows.filter(r => /jungle|folk/.test(r.path));
  const jazzOk = jazz.length === 2 && jazz.every(r => r.mel_ch === 2 && r.mel_conf >= 0.55);
  const leadlessOk = leadless.every(r => r.mel_conf < 0.55);
  gate("melody-ID: leads found, leadless untrusted", jazzOk && leadlessOk,
    rows.map(r => `${path.basename(r.path)}:ch${r.mel_ch}@${r.mel_conf}`).join(" "));
})();
(() => {
  const jazz1 = db.prepare("SELECT id FROM files WHERE path LIKE '%jazz-s1%'").get();
  const vb = db.prepare("SELECT blob FROM vec WHERE file_id=?").get(jazz1.id).blob;
  const target = { id: jazz1.id, v: new Float32Array(vb.buffer, vb.byteOffset, vb.byteLength / 4) };
  const top = C.near(db, target, 1)[0];
  gate("near(): jazz seed 1's neighbour is jazz seed 5", /jazz-s5/.test(top.path), `got ${path.basename(top.path)} sim=${top.sim}`);
})();

db.close();
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fails ? 1 : 0);
