#!/usr/bin/env node
// corpus-db.js — the MIDI trove as a queryable SQLite corpus: raw notes as
// packed integer blobs, an extracted MELODY LINE per file, and a feature
// vector for similarity exploration. Parsing happens once (mine-midi.js does
// the SMF work); every question after that is a query.
//
//   node tools/mine/corpus-db.js build <dir> [dir...] --db <path> [--limit N]
//   node tools/mine/corpus-db.js stats   --db <path>
//   node tools/mine/corpus-db.js keycheck --db <path> [--rip x]     detector vs embedded sigs
//   node tools/mine/corpus-db.js melody  --db <path> [--rip x]      interval/contour report
//   node tools/mine/corpus-db.js near    --db <path> <id|path> [-k 10]   cosine neighbours
//   node tools/mine/corpus-db.js bench   --db <path>
//
// The DB is DERIVED and lives OFF-REPO (default under /mnt/sources — found/
// is rsynced to the droplet by ship.sh, so multi-GB artifacts must never land
// there). Rebuildable from the rips at any time; this builder is the recipe.
//
// Storage: notes are 11-byte fixed records (u32 tick, u32 durTicks, u8 pitch,
// u8 vel, u8 ch, little-endian); melody is the same format, holding only the
// extracted line. ~120k-file bulk ≈ a few GB — fine on the external drive.
//
// Melody identification (the honest hard part): per-channel scorer
// (monophony × register × density × size), then a SKYLINE pass (top note per
// onset group) within the winning channel — for single-channel piano files the
// skyline IS the right-hand line, roughly. mel_conf is stored so downstream
// statistics can drop low-confidence extractions instead of averaging them in.
// Validate on labeled corpora before trusting (test/unit/corpus-db.test.js).
"use strict";
const fs = require("fs");
const path = require("path");
const Mine = require("./mine-midi.js");

function requireSqlite() {
  try { return require("better-sqlite3"); }
  catch (e) { console.error("better-sqlite3 missing — run `npm install` in tools/"); process.exit(2); }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS files(
  id INTEGER PRIMARY KEY,
  rip TEXT NOT NULL, path TEXT UNIQUE NOT NULL,
  ppq INT, format INT, ntrk INT,
  bpm REAL, tsig TEXT,
  ksig_sf INT, ksig_mi INT,
  key_tonic INT, key_mode TEXT, key_r REAL, key_margin REAL,
  total_beats REAL, n_notes INT,
  mel_src TEXT, mel_ch INT, mel_conf REAL, mel_n INT,
  feat TEXT
);
CREATE TABLE IF NOT EXISTS notes(file_id INTEGER PRIMARY KEY REFERENCES files(id), blob BLOB);
CREATE TABLE IF NOT EXISTS melody(file_id INTEGER PRIMARY KEY REFERENCES files(id), blob BLOB);
CREATE TABLE IF NOT EXISTS vec(file_id INTEGER PRIMARY KEY REFERENCES files(id), blob BLOB);
CREATE INDEX IF NOT EXISTS files_rip ON files(rip);
`;

// vector legend (stored in meta so a reader never has to guess)
const VEC_LEGEND = ["bpm/200", "offgrid", "snareBalance/4", "hatDensity/4", "drumDensity/6", "variation",
  "swing/1.5", "motion", "seventh", "interlock",
  "chroma0", "chroma1", "chroma2", "chroma3", "chroma4", "chroma5", "chroma6", "chroma7", "chroma8", "chroma9", "chroma10", "chroma11",
  "melStepFrac", "melMeanAbsIv/12", "melRange/36", "melSync16"];

// ---------------- note packing (11 bytes LE per note) ----------------
const REC = 11;
function packNotes(parsed, notes) {
  const buf = Buffer.allocUnsafe(notes.length * REC);
  let o = 0;
  for (const n of notes) {
    buf.writeUInt32LE(n.tick >>> 0, o);
    buf.writeUInt32LE(Math.max(1, Math.round(n.dur * parsed.ppq)) >>> 0, o + 4);
    buf[o + 8] = n.pitch; buf[o + 9] = n.vel; buf[o + 10] = n.ch;
    o += REC;
  }
  return buf;
}
function unpackNotes(blob, ppq) {
  const out = [];
  for (let o = 0; o + REC <= blob.length; o += REC)
    out.push({ tick: blob.readUInt32LE(o), beat: blob.readUInt32LE(o) / ppq,
      dur: blob.readUInt32LE(o + 4) / ppq, pitch: blob[o + 8], vel: blob[o + 9], ch: blob[o + 10] });
  return out;
}

// ---------------- melody identification ----------------
// score each non-drum channel: monophony (little overlap), register, density
// in a singable range, enough notes to mean anything. Then skyline the winner.
function channelStats(notes, totalBeats) {
  const byCh = {};
  for (const n of notes) if (n.ch !== 9) (byCh[n.ch] = byCh[n.ch] || []).push(n);
  const stats = [];
  for (const [ch, ns] of Object.entries(byCh)) {
    if (ns.length < 16) continue;
    ns.sort((a, b) => a.tick - b.tick);
    let overlap = 0;
    for (let i = 0; i + 1 < ns.length; i++) {
      const gap = ns[i + 1].beat - ns[i].beat;
      if (gap < ns[i].dur * 0.5) overlap++;
    }
    const mono = 1 - overlap / ns.length;
    const meanPitch = ns.reduce((s, n) => s + n.pitch, 0) / ns.length;
    const density = ns.length / Math.max(1, totalBeats);
    const densityScore = density >= 0.4 && density <= 8 ? 1 : density < 0.4 ? density / 0.4 : 8 / density;
    const register = Math.max(0, Math.min(1, (meanPitch - 45) / 35));
    // bass-register penalty: a perfectly monophonic bassline outscores the true
    // melody on mono alone (the jazz/folk exports proved it) — melodies almost
    // never live below meanPitch ~52
    const bassPenalty = meanPitch < 52 ? 0.55 : 1;
    const score = bassPenalty * (0.4 * Math.max(0, mono) + 0.3 * register + 0.2 * densityScore + 0.1 * Math.min(1, ns.length / 200));
    stats.push({ ch: +ch, notes: ns, mono, meanPitch, density, score });
  }
  return stats.sort((a, b) => b.score - a.score);
}
// skyline: group onsets within a 32nd, keep the top pitch of each group
function skyline(notes, ppq) {
  const q = Math.max(1, Math.round(ppq / 8));
  const groups = new Map();
  for (const n of notes) {
    const g = Math.round(n.tick / q);
    const cur = groups.get(g);
    if (!cur || n.pitch > cur.pitch) groups.set(g, n);
  }
  return [...groups.values()].sort((a, b) => a.tick - b.tick);
}
function extractMelody(parsed) {
  const cand = channelStats(parsed.notes, parsed.totalBeats);
  if (!cand.length) {
    const line = skyline(parsed.notes.filter(n => n.ch !== 9), parsed.ppq);
    return { line, src: "skyline-all", ch: -1, conf: line.length >= 16 ? 0.2 : 0 };
  }
  const best = cand[0];
  // a POLYPHONIC winner means no channel really is a melody (leadless
  // arrangement) — we take the skyline of the harmony but say so: src flags it
  // and conf drops below the report threshold, so melody statistics never
  // average in chord-tops as if they were lines
  if (best.mono < 0.5) return { line: skyline(best.notes, parsed.ppq), src: "skyline-poly", ch: best.ch, conf: +(best.score * 0.6).toFixed(3) };
  return { line: skyline(best.notes, parsed.ppq), src: "ch", ch: best.ch, conf: +best.score.toFixed(3) };
}

// melody-line statistics (used by the vector + the melody report)
function melodyStats(line) {
  if (line.length < 8) return null;
  const iv = [];
  for (let i = 0; i + 1 < line.length; i++) iv.push(line[i + 1].pitch - line[i].pitch);
  const abs = iv.map(Math.abs);
  const stepFrac = abs.filter(a => a >= 1 && a <= 2).length / iv.length;
  const repeatFrac = abs.filter(a => a === 0).length / iv.length;
  const leapFrac = abs.filter(a => a >= 5).length / iv.length;
  const meanAbs = abs.reduce((s, a) => s + a, 0) / iv.length;
  const ps = line.map(n => n.pitch);
  const range = Math.max(...ps) - Math.min(...ps);
  const up = iv.filter(v => v > 0).length, down = iv.filter(v => v < 0).length;
  const sync16 = line.filter(n => { const f = n.beat * 4 - Math.round(n.beat * 4); return Math.abs(f) > 0.2; }).length / line.length
    + line.filter(n => { const f = (n.beat * 4) % 2; return Math.abs(f - 1) < 0.2; }).length / line.length; // off-16th + on the weak 16th
  return { n: line.length, iv, stepFrac: +stepFrac.toFixed(3), repeatFrac: +repeatFrac.toFixed(3),
    leapFrac: +leapFrac.toFixed(3), meanAbs: +meanAbs.toFixed(2), range,
    upFrac: +(up / Math.max(1, up + down)).toFixed(3), sync16: +Math.min(1, sync16).toFixed(3) };
}

// ---------------- feature vector ----------------
function chromaOf(parsed) {
  const w = new Float64Array(12); let tot = 0;
  for (const n of parsed.notes) if (n.ch !== 9) { const x = n.dur * (n.vel / 127); w[n.pitch % 12] += x; tot += x; }
  return [...w].map(x => tot ? x / tot : 0);
}
function vectorOf(feat, chroma, mel) {
  const v = new Float32Array(26);
  v[0] = Math.min(1, feat.bpm / 200); v[1] = feat.offgrid; v[2] = Math.min(4, feat.snareBalance) / 4;
  v[3] = Math.min(4, feat.hatDensity) / 4; v[4] = Math.min(6, feat.drumDensity) / 6; v[5] = feat.variation;
  v[6] = Math.min(1.5, feat.swing) / 1.5; v[7] = feat.motion; v[8] = feat.seventh; v[9] = feat.interlock;
  for (let i = 0; i < 12; i++) v[10 + i] = chroma[i];
  if (mel) { v[22] = mel.stepFrac; v[23] = Math.min(12, mel.meanAbs) / 12; v[24] = Math.min(36, mel.range) / 36; v[25] = mel.sync16; }
  return v;
}
function cosine(a, b) {
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += a[i] * b[i]; da += a[i] * a[i]; db += b[i] * b[i]; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// ---------------- build ----------------
function* midiFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) yield* midiFiles(f);
    else if (/\.midi?$/i.test(e.name)) yield f;
  }
}
function openDb(Sqlite, dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Sqlite(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('vec_legend',?)").run(JSON.stringify(VEC_LEGEND));
  db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('schema',?)").run("1");
  return db;
}
function buildDirs(db, dirs, opts) {
  opts = opts || {};
  const insFile = db.prepare(`INSERT OR IGNORE INTO files(rip,path,ppq,format,ntrk,bpm,tsig,ksig_sf,ksig_mi,key_tonic,key_mode,key_r,key_margin,total_beats,n_notes,mel_src,mel_ch,mel_conf,mel_n,feat)
    VALUES (@rip,@path,@ppq,@format,@ntrk,@bpm,@tsig,@ksig_sf,@ksig_mi,@key_tonic,@key_mode,@key_r,@key_margin,@total_beats,@n_notes,@mel_src,@mel_ch,@mel_conf,@mel_n,@feat)`);
  const insBlob = { notes: db.prepare("INSERT OR REPLACE INTO notes(file_id,blob) VALUES(?,?)"),
    melody: db.prepare("INSERT OR REPLACE INTO melody(file_id,blob) VALUES(?,?)"),
    vec: db.prepare("INSERT OR REPLACE INTO vec(file_id,blob) VALUES(?,?)") };
  const seen = new Set(db.prepare("SELECT path FROM files").all().map(r => r.path));
  let added = 0, skipped = 0, failed = 0;
  const t0 = process.hrtime.bigint();
  const batch = db.transaction((jobs) => {
    for (const j of jobs) {
      const info = insFile.run(j.row);
      if (!info.changes) continue;
      const id = info.lastInsertRowid;
      insBlob.notes.run(id, j.notesBlob);
      if (j.melodyBlob) insBlob.melody.run(id, j.melodyBlob);
      insBlob.vec.run(id, Buffer.from(j.vec.buffer, j.vec.byteOffset, j.vec.byteLength));
    }
  });
  let jobs = [];
  for (const dir of dirs) {
    const rip = opts.rip || path.basename(path.resolve(dir));
    for (const f of midiFiles(dir)) {
      if (opts.limit && added + skipped >= opts.limit) break;
      const rel = path.resolve(f);
      if (seen.has(rel)) { skipped++; continue; }
      try {
        const parsed = Mine.parseSmf(fs.readFileSync(f));
        if (!parsed.notes.length) throw new Error("no notes");
        const feat = Mine.featuresOf(parsed);
        const key = Mine.detectKey(parsed);
        const mel = extractMelody(parsed);
        const ms = melodyStats(mel.line);
        const ks = parsed.keySigs.length ? parsed.keySigs[0] : null;
        const ts = parsed.timeSigs.length ? `${parsed.timeSigs[0].nn}/${parsed.timeSigs[0].den}` : "4/4";
        jobs.push({
          row: { rip, path: rel, ppq: parsed.ppq, format: parsed.format, ntrk: parsed.ntrk,
            bpm: feat.bpm, tsig: ts, ksig_sf: ks ? ks.sf : null, ksig_mi: ks ? ks.mi : null,
            key_tonic: key.tonic, key_mode: key.mode, key_r: key.r, key_margin: key.margin,
            total_beats: +parsed.totalBeats.toFixed(2), n_notes: parsed.notes.length,
            mel_src: mel.src, mel_ch: mel.ch, mel_conf: mel.conf, mel_n: mel.line.length,
            feat: JSON.stringify(feat) },
          notesBlob: packNotes(parsed, parsed.notes),
          melodyBlob: mel.line.length ? packNotes(parsed, mel.line) : null,
          vec: vectorOf(feat, chromaOf(parsed), ms),
        });
        added++;
      } catch (e) { failed++; }
      if (jobs.length >= 200) { batch(jobs); jobs = []; if (added % 1000 < 200) console.log(`  ${added} added…`); }
    }
  }
  if (jobs.length) batch(jobs);
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  console.log(`build: ${added} added, ${skipped} already present, ${failed} failed, ${secs.toFixed(1)}s`);
  return { added, skipped, failed, secs };
}

// ---------------- queries ----------------
function loadVecs(db, rip) {
  const rows = rip
    ? db.prepare("SELECT v.file_id id, v.blob b FROM vec v JOIN files f ON f.id=v.file_id WHERE f.rip=?").all(rip)
    : db.prepare("SELECT file_id id, blob b FROM vec").all();
  return rows.map(r => ({ id: r.id, v: new Float32Array(r.b.buffer, r.b.byteOffset, r.b.byteLength / 4) }));
}
function near(db, target, k) {
  const all = loadVecs(db);
  const scored = all.filter(x => x.id !== target.id).map(x => ({ id: x.id, sim: cosine(target.v, x.v) }));
  scored.sort((a, b) => b.sim - a.sim);
  const get = db.prepare("SELECT id,rip,path,bpm,key_tonic,key_mode FROM files WHERE id=?");
  return scored.slice(0, k).map(s => ({ ...get.get(s.id), sim: +s.sim.toFixed(4) }));
}

function cliMelodyReport(db, rip) {
  const rows = rip ? db.prepare("SELECT f.id,f.ppq,f.mel_conf,m.blob FROM files f JOIN melody m ON m.file_id=f.id WHERE f.rip=?").all(rip)
                   : db.prepare("SELECT f.id,f.ppq,f.mel_conf,m.blob FROM files f JOIN melody m ON m.file_id=f.id").all();
  const CONF = 0.55;
  const kept = rows.filter(r => r.mel_conf >= CONF);
  const hist = {}; const agg = { step: [], repeat: [], leap: [], meanAbs: [], range: [], up: [], sync: [] };
  for (const r of kept) {
    const ms = melodyStats(unpackNotes(r.blob, r.ppq));
    if (!ms) continue;
    for (const v of ms.iv) { const key = Math.max(-12, Math.min(12, v)); hist[key] = (hist[key] || 0) + 1; }
    agg.step.push(ms.stepFrac); agg.repeat.push(ms.repeatFrac); agg.leap.push(ms.leapFrac);
    agg.meanAbs.push(ms.meanAbs); agg.range.push(ms.range); agg.up.push(ms.upFrac); agg.sync.push(ms.sync16);
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  console.log(`melody report${rip ? " [" + rip + "]" : ""}: ${kept.length}/${rows.length} files at mel_conf>=${CONF}`);
  console.log(`  step ${med(agg.step)}  repeat ${med(agg.repeat)}  leap ${med(agg.leap)}  meanAbs ${med(agg.meanAbs)}  range ${med(agg.range)}  upFrac ${med(agg.up)}  sync16 ${med(agg.sync)}   (medians)`);
  const tot = Object.values(hist).reduce((a, b) => a + b, 0) || 1;
  const bar = (n) => "#".repeat(Math.round(200 * n / tot));
  console.log("  interval histogram (semitones, ±12 clamp):");
  for (let i = -12; i <= 12; i++) if (hist[i]) console.log(`   ${String(i).padStart(3)}  ${String(hist[i]).padStart(7)}  ${bar(hist[i])}`);
}

// ---------------- CLI ----------------
const api = { SCHEMA, VEC_LEGEND, packNotes, unpackNotes, extractMelody, melodyStats, chromaOf, vectorOf, cosine, openDb, buildDirs, near, requireSqlite };
if (typeof module !== "undefined" && module.exports) module.exports = api;

if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
  const dbPath = opt("--db", "/mnt/sources/relocated/stellate-midi-corpus/corpus.db");
  const Sqlite = requireSqlite();
  const db = openDb(Sqlite, dbPath);
  if (cmd === "build") {
    const dirs = argv.slice(1).filter(a => !a.startsWith("--") && a !== opt("--db") && a !== opt("--limit") && a !== opt("--rip"));
    if (!dirs.length) { console.error("build: no dirs given"); process.exit(1); }
    buildDirs(db, dirs, { limit: +opt("--limit", 0), rip: opt("--rip", null) });
  } else if (cmd === "stats") {
    const rips = db.prepare("SELECT rip, COUNT(*) n, SUM(n_notes) notes, AVG(mel_conf) conf FROM files GROUP BY rip ORDER BY n DESC").all();
    for (const r of rips) console.log(`${r.rip.padEnd(20)} ${String(r.n).padStart(6)} files  ${String(r.notes).padStart(10)} notes  mel_conf avg ${(+r.conf).toFixed(2)}`);
    const sz = fs.statSync(dbPath).size;
    console.log(`db: ${dbPath}  ${(sz / 1e6).toFixed(1)} MB, ${db.prepare("SELECT COUNT(*) c FROM files").get().c} files`);
  } else if (cmd === "keycheck") {
    const rip = opt("--rip", null);
    const rows = (rip ? db.prepare("SELECT * FROM files WHERE ksig_sf IS NOT NULL AND rip=?").all(rip)
                      : db.prepare("SELECT * FROM files WHERE ksig_sf IS NOT NULL").all());
    let exact = 0, rel = 0;
    for (const r of rows) {
      const expT = Mine.keySigTonic(r.ksig_sf, r.ksig_mi), expM = r.ksig_mi ? "minor" : "major";
      const relT = expM === "major" ? (expT + 9) % 12 : (expT + 3) % 12;
      if (r.key_tonic === expT && r.key_mode === expM) exact++;
      else if (r.key_mode !== expM && r.key_tonic === relT) rel++;
    }
    console.log(`keycheck${rip ? " [" + rip + "]" : ""}: ${rows.length} with sigs — exact ${Math.round(100 * exact / rows.length)}%, exact-or-relative ${Math.round(100 * (exact + rel) / rows.length)}%`);
  } else if (cmd === "melody") cliMelodyReport(db, opt("--rip", null));
  else if (cmd === "near") {
    const which = argv[1];
    const row = /^\d+$/.test(which) ? db.prepare("SELECT id FROM files WHERE id=?").get(+which)
                                    : db.prepare("SELECT id FROM files WHERE path LIKE ?").get("%" + which + "%");
    if (!row) { console.error("near: no such file"); process.exit(1); }
    const vb = db.prepare("SELECT blob FROM vec WHERE file_id=?").get(row.id).blob;
    const target = { id: row.id, v: new Float32Array(vb.buffer, vb.byteOffset, vb.byteLength / 4) };
    const self = db.prepare("SELECT rip,path FROM files WHERE id=?").get(row.id);
    console.log(`near: [${self.rip}] ${path.basename(self.path)}`);
    for (const n of near(db, target, +opt("-k", 10)))
      console.log(`  ${n.sim}  [${n.rip}] ${path.basename(n.path)}  bpm ${n.bpm} ${Mine.PCN[n.key_tonic]} ${n.key_mode}`);
  } else if (cmd === "merge") {
    // merge shard DBs (from a sharded bulk build) into --db: file ids are
    // remapped, blobs follow their file row, duplicate paths skipped
    const srcs = argv.slice(1).filter(a => !a.startsWith("--") && a !== opt("--db"));
    const insF = db.prepare(`INSERT OR IGNORE INTO files(rip,path,ppq,format,ntrk,bpm,tsig,ksig_sf,ksig_mi,key_tonic,key_mode,key_r,key_margin,total_beats,n_notes,mel_src,mel_ch,mel_conf,mel_n,feat)
      VALUES (@rip,@path,@ppq,@format,@ntrk,@bpm,@tsig,@ksig_sf,@ksig_mi,@key_tonic,@key_mode,@key_r,@key_margin,@total_beats,@n_notes,@mel_src,@mel_ch,@mel_conf,@mel_n,@feat)`);
    const insB = { notes: db.prepare("INSERT OR REPLACE INTO notes(file_id,blob) VALUES(?,?)"),
      melody: db.prepare("INSERT OR REPLACE INTO melody(file_id,blob) VALUES(?,?)"),
      vec: db.prepare("INSERT OR REPLACE INTO vec(file_id,blob) VALUES(?,?)") };
    for (const s of srcs) {
      const src = new Sqlite(s, { readonly: true });
      const rows = src.prepare("SELECT * FROM files").all();
      const gb = { notes: src.prepare("SELECT blob FROM notes WHERE file_id=?"),
        melody: src.prepare("SELECT blob FROM melody WHERE file_id=?"),
        vec: src.prepare("SELECT blob FROM vec WHERE file_id=?") };
      let n = 0;
      const tx = db.transaction(() => {
        for (const r of rows) {
          const oldId = r.id; delete r.id;
          const info = insF.run(r);
          if (!info.changes) continue;
          const id = info.lastInsertRowid;
          for (const t of ["notes", "melody", "vec"]) { const b = gb[t].get(oldId); if (b) insB[t].run(id, b.blob); }
          n++;
        }
      });
      tx();
      console.log(`merged ${s}: ${n}/${rows.length} files`);
      src.close();
    }
  } else if (cmd === "bench") {
    let t = process.hrtime.bigint();
    const vecs = loadVecs(db);
    const loadMs = Number(process.hrtime.bigint() - t) / 1e6;
    t = process.hrtime.bigint();
    if (vecs.length) { const q = vecs[0]; for (const x of vecs) cosine(q.v, x.v); }
    const scanMs = Number(process.hrtime.bigint() - t) / 1e6;
    t = process.hrtime.bigint();
    db.prepare("SELECT rip, AVG(bpm) FROM files GROUP BY rip").all();
    const sqlMs = Number(process.hrtime.bigint() - t) / 1e6;
    console.log(`bench: ${vecs.length} vectors — load ${loadMs.toFixed(0)}ms, full cosine scan ${scanMs.toFixed(1)}ms, SQL aggregate ${sqlMs.toFixed(1)}ms`);
  } else { console.log("usage: corpus-db.js build <dir...> --db p | stats | keycheck [--rip x] | melody [--rip x] | near <id|path> [-k n] | bench   (--db defaults to the external-drive corpus)"); process.exit(1); }
}
