#!/usr/bin/env node
// mine-weave.js — the mined melody ORGAN (theory.js mold, melodic edition):
// per-genre-family Markov tables for a generative melody walk, fit from the
// corpus DB's extracted melody lines.
//
//   node tools/mine-weave.js <rip> [<rip>...] [--db path] [--min-conf .55] [--splice]
//
// Two chains per family, in the engine's own alphabet:
//   PITCH — first-order over the 8-slot voicing ladder (leadIndex 0..3 ×
//   octave 0..1; per-8-beat-window rank normalization, same mapping the
//   mined cells use). Chord-safety is automatic: slots ARE chord tones.
//   RHYTHM — first-order over quantized inter-onset intervals
//   [.25,.5,.75,1,1.5,2,3,4], plus a start distribution and a legato ratio
//   (median dur/IOI).
//
// HELD-OUT GATE (the theory.js law): files split by id parity; tables fit on
// the train half must beat the WANDER-EQUIVALENT baseline — the engine's
// hand-authored generative melody (slot walk = clamp(prev + U{-1,0,1}); its
// fixed rhythm cycle [1,.5,.5,1,1,2] as a smoothed distribution) — on mean
// held-out log-likelihood for BOTH chains, else --splice refuses the family.
//
// --splice regenerates the MINED-WEAVE block in engine/csd-engine.js between
// its markers. Patterns are opt-in per anchor (lead pool names "<rip>weave");
// unwired states are byte-identical.
"use strict";
const fs = require("fs");
const path = require("path");
const C = require("./corpus-db.js");

const IOI = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const qIoi = (x) => { let bi = 0, bd = Infinity; for (let i = 0; i < IOI.length; i++) { const d = Math.abs(IOI[i] - x); if (d < bd) { bd = d; bi = i; } } return bi; };
const norm = (a) => { const s = a.reduce((x, y) => x + y, 0) || 1; return a.map(v => +(v / s).toFixed(4)); };

// the wander-equivalent baselines (the hand prior being challenged)
function wanderSlotP(prev, next) {
  let p = 0;
  for (const d of [-1, 0, 1]) { const t = Math.max(0, Math.min(7, prev + d)); if (t === next) p += 1 / 3; }
  return Math.max(p, 1e-3);
}
const WANDER_IOI = (() => { const c = new Array(IOI.length).fill(1e-3); for (const v of [1, .5, .5, 1, 1, 2]) c[qIoi(v)] += 1 / 6; return c; })();

function mineRip(db, rip, minConf) {
  const rows = db.prepare("SELECT f.id, f.ppq, m.blob FROM files f JOIN melody m ON m.file_id=f.id WHERE f.rip=? AND f.mel_conf>=?").all(rip, minConf);
  const mk = () => ({ start: new Array(8).fill(0.5), slot: Array.from({ length: 8 }, () => new Array(8).fill(0.5)),
    ioiU: new Array(IOI.length).fill(0.5), ioi: Array.from({ length: IOI.length }, () => new Array(IOI.length).fill(0.5)), leg: [] });
  const train = mk(), testBags = { slot: [], ioi: [] };
  let nWin = 0;
  for (const r of rows) {
    const line = C.unpackNotes(r.blob, r.ppq);
    const byWin = new Map();
    for (const n of line) {
      const o = Math.round(n.beat * 4) / 4, w = Math.floor(o / 8);
      (byWin.get(w) || byWin.set(w, []).get(w)).push({ o: o - w * 8, pitch: n.pitch, dur: n.dur });
    }
    const isTrain = r.id % 2 === 0;
    for (const win of byWin.values()) {
      if (win.length < 4) continue;
      win.sort((a, b) => a.o - b.o || b.pitch - a.pitch);
      const ded = []; for (const n of win) { const l = ded[ded.length - 1]; if (!l || l.o !== n.o) ded.push(n); }
      if (ded.length < 4) continue;
      const lo = Math.min(...ded.map(n => n.pitch)), hi = Math.max(...ded.map(n => n.pitch));
      if (hi === lo) continue;
      nWin++;
      const slots = ded.map(n => Math.round(((n.pitch - lo) / (hi - lo)) * 7));
      const iois = []; for (let i = 0; i + 1 < ded.length; i++) iois.push(qIoi(ded[i + 1].o - ded[i].o));
      if (isTrain) {
        train.start[slots[0]]++;
        for (let i = 0; i + 1 < slots.length; i++) train.slot[slots[i]][slots[i + 1]]++;
        for (const i of iois) train.ioiU[i]++;
        for (let i = 0; i + 1 < iois.length; i++) train.ioi[iois[i]][iois[i + 1]]++;
        for (let i = 0; i + 1 < ded.length; i++) { const g = ded[i + 1].o - ded[i].o; if (g > 0) train.leg.push(Math.min(1, ded[i].dur / g)); }
      } else {
        for (let i = 0; i + 1 < slots.length; i++) testBags.slot.push([slots[i], slots[i + 1]]);
        for (let i = 0; i + 1 < iois.length; i++) testBags.ioi.push([iois[i], iois[i + 1]]);
      }
    }
  }
  const slotP = train.slot.map(norm), ioiP = train.ioi.map(norm);
  const evalLL = () => {
    let sM = 0, sW = 0, sU = 0;
    for (const [a, b] of testBags.slot) { sM += Math.log(Math.max(slotP[a][b], 1e-4)); sW += Math.log(wanderSlotP(a, b)); sU += Math.log(1 / 8); }
    let iM = 0, iW = 0, iU = 0;
    for (const [a, b] of testBags.ioi) { iM += Math.log(Math.max(ioiP[a][b], 1e-4)); iW += Math.log(WANDER_IOI[b]); iU += Math.log(1 / IOI.length); }
    const n1 = Math.max(1, testBags.slot.length), n2 = Math.max(1, testBags.ioi.length);
    return { slot: { mined: +(sM / n1).toFixed(4), wander: +(sW / n1).toFixed(4), uniform: +(sU / n1).toFixed(4), n: n1 },
             ioi: { mined: +(iM / n2).toFixed(4), wander: +(iW / n2).toFixed(4), uniform: +(iU / n2).toFixed(4), n: n2 } };
  };
  const legSorted = train.leg.sort((a, b) => a - b);
  // stepFrac target for the v2 passing-tone connectors: measured on the
  // trusted lines directly (fraction of 1-2 semitone intervals)
  let step = 0, ivN = 0;
  for (const r of rows.filter(r => r.id % 2 === 0)) {
    const line = C.unpackNotes(r.blob, r.ppq);
    for (let i = 0; i + 1 < line.length; i++) { const a = Math.abs(line[i + 1].pitch - line[i].pitch); if (a >= 1 && a <= 2) step++; ivN++; }
  }
  return { lines: rows.length, windows: nWin, held: evalLL(),
    table: { start: norm(train.start), slot: slotP, ioiStart: norm(train.ioiU), ioi: ioiP,
      legato: +(legSorted[legSorted.length >> 1] || 0.9).toFixed(3),
      step: +(ivN ? step / ivN : 0).toFixed(3) } };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
  const rips = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--db" && argv[i - 1] !== "--min-conf");
  if (!rips.length) { console.error("usage: mine-weave.js <rip> [<rip>...] [--db p] [--min-conf .55] [--splice]"); process.exit(1); }
  const Sqlite = C.requireSqlite();
  const db = new Sqlite(opt("--db", "/mnt/sources/relocated/stellate-midi-corpus/corpus.db"), { readonly: true });
  const minConf = +opt("--min-conf", 0.55);

  const winners = {};
  for (const spec of rips) {
    const [rip, alias] = spec.split(":");   // "classical_guitar:guitar" -> pattern "guitarweave"
    const r = mineRip(db, rip, minConf);
    const h = r.held;
    const wins = h.slot.mined > h.slot.wander && h.ioi.mined > h.ioi.wander;
    console.log(`${rip}: ${r.lines} lines, ${r.windows} windows, legato ${r.table.legato}`);
    console.log(`  held-out slot: mined ${h.slot.mined}  wander ${h.slot.wander}  uniform ${h.slot.uniform}  (n=${h.slot.n})`);
    console.log(`  held-out ioi:  mined ${h.ioi.mined}  wander ${h.ioi.wander}  uniform ${h.ioi.uniform}  (n=${h.ioi.n})`);
    console.log(`  ${wins ? "MINED WINS both chains" : "wander holds — this family does NOT ship"}`);
    if (wins) winners[(alias || rip) + "weave"] = r.table;
  }

  if (argv.includes("--splice")) {
    if (!Object.keys(winners).length) { console.error("splice refused: no family beat the wander baseline"); process.exit(3); }
    const cj = path.join(__dirname, "..", "engine", "csd-engine.js");
    const src = fs.readFileSync(cj, "utf8");
    const BEGIN = "  // ---- MINED-WEAVE BEGIN (tools/mine-weave.js — do not hand-edit) ----";
    const END = "  // ---- MINED-WEAVE END ----";
    const day = new Date().toISOString().slice(0, 10);
    const block = `${BEGIN}
  // The mined melody ORGAN (${day}): per-family Markov walks in the engine's
  // own alphabet — pitch over the 8-slot voicing ladder (idx 0..3 × oct 0..1),
  // rhythm over quantized IOIs. Fit on the trove corpus, held-out-gated
  // against the wander baseline (the tool refuses a losing family). Opt-in
  // via lead pattern names (keys below); unwired states byte-identical.
  const MINED_WEAVE=${JSON.stringify(winners)};
${END}`;
    const b = src.indexOf(BEGIN), e = src.indexOf(END);
    let next;
    if (b >= 0 && e > b) next = src.slice(0, b) + block + src.slice(e + END.length);
    else {
      const anchor = "  // ---- MUSIC-MIND melody rhythm cells (state.rhythm) ----";
      if (!src.includes(anchor)) { console.error("splice: anchor not found"); process.exit(3); }
      next = src.replace(anchor, block + "\n" + anchor);
    }
    fs.writeFileSync(cj, next);
    console.log(`spliced MINED_WEAVE (${Object.keys(winners).join(", ")}) into engine/csd-engine.js`);
  }
}
main();
