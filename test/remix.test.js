// test/remix.test.js — THE AUTO REMIX PIPELINE (docs/REMIX.md, 2026-09-06).
//
// Three claims, and they are the three the contract makes:
//
//   R0  THE EXTRACTION MOVED NOTHING — the four functions lifted out of
//       mine-melody.js and mine-groove.js this round agree with the bodies as
//       they stood before the lift, which are frozen in this file.
//   R1  DETERMINISM. The same file and the same seed produce a BYTE-IDENTICAL
//       row, twice, in the same process and in a fresh one. And the row is seed
//       INDEPENDENT on purpose — a measurement does not move when a die is
//       rolled — while the SESSION document does move, because the session is
//       a reading of the row and readings are what a seed is for.
//   R2  THE ROUND TRIP. A record written by the box's own exporter, read back
//       by the pipeline, recovers its tempo EXACTLY, its meter EXACTLY, its bar
//       count within one bar, its block count within +/-2, and at least one
//       motif. The tolerances are STATED here rather than discovered later, and
//       each one is the number the 2026-09-06 measurement actually produced
//       (docs/REMIX.md's recovery table) with the slack written beside it.
//   R3  IT MUST PLAY. Every row under tools/remix-out/ is loaded, registered in
//       the catalogue's own table IN MEMORY (nothing is written to
//       nukernel/genres/), composed by precompose.genreToDocument and compiled
//       by document.js scoreOf — and it has to render notes, seat the cast it
//       claims, and DIFFER from its neighbours. A row that does not sound is a
//       failed run; a row that sounds exactly like the row beside it is a
//       failed run too, because then the pipeline is not reading the file.
//
// R2 asks the ES-module exporter for a fresh .mid into os.tmpdir(), so this
// gate stands a window up the way tools/ableton/score-node.mjs does. Everything
// else is pure node.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const cp = require("child_process");
const R = path.resolve(__dirname, "..");
const Remix = require(R + "/tools/remix.js");
const Doc = require(R + "/nukernel/document.js");
const P2 = require(R + "/nukernel/precompose.js");
const NG = require(R + "/nukernel/genres.js");
const NSong = require(R + "/nukernel/song.js");
const { GENRES } = NG;

let pass = 0, fail = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };
const J = (x) => JSON.stringify(x);
const quiet = (fn) => { const o = console.log; console.log = () => {}; try { return fn(); } finally { console.log = o; } };

const OUT = path.join(R, "tools/remix-out");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nu-remix-"));

(async () => {
  const { SYNTH_NAMES } = await import(R + "/nukernel/audio/to-engine.js");
  const FLEET = SYNTH_NAMES();
  console.log("test/remix.test.js — the auto remix pipeline");

  /* ======================================================================
     R0 · THE EXTRACTION MOVED NOTHING.
     `tools/mine/mine-melody.js` and `mine-groove.js` had their arithmetic
     inside `main()`, where remix.js could not reach it, and this round lifted
     four functions out of them by CUTTING AND PASTING. That is a claim, and a
     claim gets a gate: the bodies AS THEY STOOD BEFORE THE LIFT are frozen
     below — copied out of the pre-lift source, the way
     test/fixtures/terms-genre.freeze.js froze the pre-move eight.js — and the
     exported functions have to agree with them over a deterministic
     pseudo-corpus. Neither CLI can be re-run here to prove it the other way:
     both open the corpus DB through `corpus-db.js requireSqlite()` and
     better-sqlite3 is not installed on this box.
     =================================================================== */
  console.log("\nR0 — the lift out of mine-melody/mine-groove moved nothing");
  const Mel = require(R + "/tools/mine/mine-melody.js");
  const Groove = require(R + "/tools/mine/mine-groove.js");

  // ---- the pre-lift bodies, verbatim ------------------------------------
  function preWindows(line, maxNotes, sigWindows) {
    const byWin = new Map();
    for (const n of line) {
      const o = Math.round(n.beat * 4) / 4;
      const w = Math.floor(o / 8);
      (byWin.get(w) || byWin.set(w, []).get(w)).push({ o: o - w * 8, pitch: n.pitch, dur: n.dur });
    }
    for (const win of byWin.values()) {
      if (win.length < 4 || win.length > maxNotes) continue;
      win.sort((a, b) => a.o - b.o || a.pitch - b.pitch);
      const dedup = [];
      for (const n of win) { const last = dedup[dedup.length - 1]; if (last && last.o === n.o) { if (n.pitch > last.pitch) { last.pitch = n.pitch; last.dur = n.dur; } } else dedup.push({ ...n }); }
      if (dedup.length < 4) continue;
      const sig = dedup.map((n) => n.o).join(",");
      const ps = dedup.map((n) => n.pitch), lo = Math.min(...ps), hi = Math.max(...ps);
      if (hi === lo) continue;
      (sigWindows.get(sig) || sigWindows.set(sig, []).get(sig)).push(dedup);
    }
    return sigWindows;
  }
  function preStats(w) {
    const iv = []; for (let i = 0; i + 1 < w.length; i++) iv.push(w[i + 1].pitch - w[i].pitch);
    const abs = iv.map(Math.abs);
    return { step: abs.filter((a) => a >= 1 && a <= 2).length / iv.length,
             up: iv.filter((v) => v > 0).length / Math.max(1, iv.filter((v) => v !== 0).length),
             range: Math.max(...w.map((n) => n.pitch)) - Math.min(...w.map((n) => n.pitch)) };
  }
  function preEmit(wins, stepMed) {
    let best = null, bestD = Infinity;
    for (const w of wins) {
      const st = preStats(w);
      const d = Math.abs(st.step - stepMed) + 0.5 * Math.abs(st.up - 0.5) + (st.range > 24 ? 1 : 0);
      if (d < bestD) { bestD = d; best = w; }
    }
    const lo = Math.min(...best.map((n) => n.pitch)), hi = Math.max(...best.map((n) => n.pitch));
    return best.map((n, i) => {
      const tone = Math.round(((n.pitch - lo) / (hi - lo)) * 7);
      const gap = (i + 1 < best.length ? best[i + 1].o : 8) - n.o;
      const d = Math.max(0.25, Math.min(2, Math.round(Math.min(n.dur, gap) * 4) / 4));
      return [n.o, d, tone % 4, tone >> 2];
    });
  }
  function preProfile(notes) {
    const sm = new Float64Array(16), n = new Float64Array(16);
    for (const note of notes) {
      const slot = Math.round((note.beat % 4) * 4) % 16;
      if (slot < 0 || slot > 15) continue;
      sm[slot] += note.vel; n[slot]++;
    }
    const mean = [...sm].reduce((a, b) => a + b, 0) / Math.max(1, [...n].reduce((a, b) => a + b, 0));
    return [...sm].map((s, i) => n[i] ? +Math.max(0.7, Math.min(1.3, (s / n[i]) / mean)).toFixed(3) : 1);
  }

  // a deterministic pseudo-corpus: an LCG, no rng library, same numbers every run
  let sd = 12345;
  const rnd = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
  const LINES = [];
  for (let L = 0; L < 400; L++) {
    const line = []; let beat = 0;
    const n = 6 + Math.floor(rnd() * 22);
    for (let i = 0; i < n; i++) {
      beat += [0.25, 0.5, 0.5, 1, 1.5][Math.floor(rnd() * 5)];
      line.push({ beat, pitch: 48 + Math.floor(rnd() * 30), dur: 0.25 + rnd(), vel: 40 + Math.floor(rnd() * 80) });
    }
    LINES.push(line);
  }
  const PRE = new Map(), POST = new Map();
  for (const l of LINES) { preWindows(l, 16, PRE); Mel.windowsOf(l, { win: 8, minNotes: 4, maxNotes: 16, into: POST }); }
  const strip = (m) => [...m.entries()].sort().map(([k, v]) =>
    k + "=>" + v.map((w) => w.map((n) => `${n.o}/${n.pitch}/${n.dur}`).join(";")).join("|")).join("\n");

  ok("R0a windowsOf is the pre-lift window/skyline body, note for note " +
     `(${PRE.size} onset signatures over 400 lines)`,
    () => assert.strictEqual(strip(POST), strip(PRE)));
  ok("R0b winStats is the pre-lift interval character", () => {
    for (const wins of PRE.values()) for (const w of wins)
      assert.strictEqual(J(Mel.winStats(w)), J(preStats(w)));
  });
  ok("R0c medoid + melPhrase are the pre-lift emit(), over three stepMed values", () => {
    for (const wins of PRE.values()) for (const sm of [0.2, 0.5, 0.8])
      assert.strictEqual(J(Mel.melPhrase(Mel.medoid(wins, sm), 8)), J(preEmit(wins, sm)));
  });
  ok("R0d accentProfile is the pre-lift velocity lean, clamp and all", () => {
    const all = LINES.flat();
    assert.strictEqual(J(Groove.accentProfile(all).prof), J(preProfile(all)));
  });

  /* ======================================================================
     R2 next, because it MAKES the input R1 and R3 want: a record whose form
     and tempo we know because the box wrote it.
     =================================================================== */
  console.log("\nR2 — the round trip through the box's own exporter");
  /* THE WINDOW GOES UP FIRST. ui/deps.js is "the SOLE reader of window.*" and
     it throws at module-evaluation time under node, so `shimWindow()` has to
     run BEFORE ui/state.js is imported — which is the whole reason
     score-node.mjs exports it. */
  const SN = await import(R + "/tools/ableton/score-node.mjs");
  SN.shimWindow();
  const { loadScore } = SN;
  const { smfFromScore } = await import(R + "/nukernel/export/smf.js");
  const state = await import(R + "/nukernel/ui/state.js");

  /* THE GROUND TRUTH IS A SONG, NOT A GENRE, and that is the point: a song of
     four boxes naming two alternating genres has a FORM the pipeline can be
     asked to find. `gregorian,techno,gregorian,techno` is the pair chosen
     because the two are maximally unlike each other — a chant and a machine —
     so a failure to see the alternation is a failure of the arranger rather
     than of the material. (The measured 2026-09-06 case where the arranger
     CANNOT see it is pop against guitarrock, which really are alike; that is
     written into docs/REMIX.md as a limit, not gated here as a promise.) */
  const KEYS = ["gregorian", "techno", "gregorian", "techno"];
  const raw = state.defaultSong();
  const tmpl = J(raw.song[0]);
  raw.song = KEYS.map((k) => { const b = JSON.parse(tmpl);
    b.stack = [{ g: k, slots: [0] }]; b.len = GENRES[k].bars || 4; return b; });
  const songPath = path.join(TMP, "gt.song.json");
  fs.writeFileSync(songPath, J(raw));
  const score = await loadScore({ songPath });
  const midPath = path.join(TMP, "gt.mid");
  fs.writeFileSync(midPath, Buffer.from(smfFromScore(score)));
  const GT = { bpm: score.bpm, bars: KEYS.reduce((a, k) => a + (GENRES[k].bars || 4), 0),
               blocks: KEYS.length, meter: "4/4",
               kit: [...new Set(KEYS.flatMap((k) => Object.keys(GENRES[k].kit || {})))].sort().join("") };

  const got = quiet(() => Remix.run(midPath, "remixgate", { seed: 1, dry: true, out: TMP, parents: false }));

  ok("R2a the tempo comes back EXACTLY (tolerance: 0 bpm — measured exact on 6 of 6)",
    () => assert.strictEqual(got.R.felt, GT.bpm, `${GT.bpm} in, ${got.R.felt} out`));
  ok("R2b the meter comes back EXACTLY (tolerance: 0 — measured exact on 6 of 6, 3/4 included)",
    () => assert.strictEqual(got.R.abc, GT.meter, `${GT.meter} in, ${got.R.abc} out`));
  ok("R2c the bar count is within a third (tolerance: 34% — a record's last chord RINGS " +
     "past its last barline and mine-midi's totalBeats counts the ring)",
    () => assert.ok(Math.abs(got.A.nBars - GT.bars) <= Math.ceil(GT.bars / 3),
      `${GT.bars} bars in, ${got.A.nBars} out`));
  ok("R2d the block count is within two (tolerance: +/-2 — measured 4->5 here, " +
     "4->1 on a waltz whose every bar is the same oom-pah)",
    () => assert.ok(Math.abs(got.A.sections.length - GT.blocks) <= 2,
      `${GT.blocks} blocks in, ${got.A.sections.length} out`));
  ok("R2e the kit comes back EXACTLY (tolerance: 0 — the modal bar of a machine is the machine)",
    () => assert.strictEqual(Object.keys(got.row.kit).sort().join(""), GT.kit,
      `${GT.kit} in, ${Object.keys(got.row.kit).sort().join("")} out`));
  ok("R2f at least one motif survives (tolerance: >= 1; measured 2 here, 8 on a folk tune)",
    () => assert.ok(got.M.motifs.length >= 1, "no motif at all"));
  ok("R2g the motifs are DEDUPED BY SHAPE, not by exact match",
    () => { const shapes = got.M.motifs.map((m) => m.shape);
            assert.strictEqual(new Set(shapes).size, shapes.length, "two motifs share a shape"); });

  /* ======================================================================
     R1 · DETERMINISM
     =================================================================== */
  console.log("\nR1 — the same file and the same seed, twice");
  const again = quiet(() => Remix.run(midPath, "remixgate", { seed: 1, dry: true, out: TMP, parents: false }));
  ok("R1a the row is byte-identical on a second run in the same process",
    () => assert.strictEqual(J(got.row), J(again.row)));
  ok("R1b the session document is byte-identical too",
    () => assert.strictEqual(J(got.doc), J(again.doc)));
  const fresh = JSON.parse(cp.execFileSync(process.execPath, ["-e",
    `const Rx=require(${J(R + "/tools/remix.js")});` +
    `const o=console.log;console.log=()=>{};` +
    `const r=Rx.run(${J(midPath)},"remixgate",{seed:1,dry:true,out:${J(TMP)},parents:false});` +
    `console.log=o;process.stdout.write(JSON.stringify(r.row));`], { encoding: "utf8" }));
  ok("R1c ...and byte-identical out of a FRESH node process (no module-load order in it)",
    () => assert.strictEqual(J(got.row), J(fresh)));
  const seeded = quiet(() => Remix.run(midPath, "remixgate", { seed: 7, dry: true, out: TMP, parents: false }));
  ok("R1d the ROW does not move when the seed does — a measurement is not a reading",
    () => assert.strictEqual(J(got.row), J(seeded.row)));
  ok("R1e ...and the SESSION does move, which is what the seed is for",
    () => assert.notStrictEqual(J(got.doc), J(seeded.doc)));

  /* ======================================================================
     R3 · IT MUST PLAY
     =================================================================== */
  console.log("\nR3 — every generated row compiles to notes");
  const rowFiles = fs.existsSync(OUT)
    ? fs.readdirSync(OUT).filter((f) => f.endsWith(".json") && !f.endsWith(".session.json")).sort()
    : [];
  ok("R3a there are rows to check (tools/remix-out/ is the demo directory; " +
     "if it is empty this gate has nothing to hold)",
    () => assert.ok(rowFiles.length >= 6, rowFiles.length + " rows found, wanted at least 6"));

  const fingerprints = new Map();
  for (const f of rowFiles) {
    const key = f.slice(0, -5);
    const row = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
    ok("R3b " + key + " compiles through scoreOf and RENDERS NOTES", () => {
      assert.ok(!Object.prototype.hasOwnProperty.call(GENRES, key),
        key + " is already in the catalogue — this gate must not shadow a shipped row");
      GENRES[key] = Remix.resolveRow(row);
      try {
        const d = Doc.normalize(P2.genreToDocument(key, 1));
        const S = Doc.scoreOf(d, GENRES, FLEET);
        const sounding = S.events.filter((e) => e.n != null && e.vel > 0);
        assert.ok(sounding.length > 0, "the record is SILENT — a row that does not sound is not a row");
        for (let i = 1; i < S.events.length; i++)
          assert.ok(S.events[i].t >= S.events[i - 1].t, "events out of time order at " + i);
        // ...THE CAST IT CLAIMS. `voices` is a number the row states and
        // `instr` is the list it states beside it; a record that seats fewer
        // line chairs than the row declares is a row lying about its band.
        const lines = d.voices.filter((v) => v.kind === "line");
        assert.ok(lines.length >= row.voices,
          `the row claims ${row.voices} voices and the record seats ${lines.length} line chairs`);
        const instrs = new Set(d.voices.map((v) => v.instrument));
        for (const i of row.instr) assert.ok(instrs.has(i),
          `the row names \`${i}\` and no chair holds it`);
        // ...AND THE KIT IT CLAIMS, where it claims one.
        if (row.kit && Object.keys(row.kit).length) {
          const drum = Object.values(d.material.cells).find((c) => c.kind === "drum");
          assert.ok(drum, "the row states a kit and the record has no drum cell");
        }
        fingerprints.set(key, sounding.slice(0, 400).map((e) => `${e.t}:${e.n}:${e.vel}`).join(","));
      } finally { delete GENRES[key]; }
    });
  }

  ok("R3c no two generated rows render the same record — a pipeline whose output " +
     "does not depend on its input is not reading the file", () => {
    const seen = new Map();
    const clash = [];
    for (const [k, fp] of fingerprints) {
      if (seen.has(fp)) clash.push(seen.get(fp) + " == " + k); else seen.set(fp, k);
    }
    assert.strictEqual(clash.length, 0, "identical records: " + clash.join(", "));
  });

  ok("R3d every generated row would survive tools/genres/build.js — the grammar, " +
     "the FIGURES vocabulary, the label law and the PROGS law, all checked without " +
     "writing a byte into nukernel/genres/", () => {
    const { validate } = require(R + "/tools/genres/grammar.js");
    const { rowTxt } = require(R + "/tools/genres/emit.js");
    const { FIGURES } = require(R + "/nukernel/genres-tables.js");
    for (const f of rowFiles) {
      const key = f.slice(0, -5);
      const row = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
      for (const c of ["entry", "reg", "realize", "word", "throat"])
        if (row[c]) validate(row[c], key + "." + c);
      assert.ok(row.plan != null && row.bpm != null, key + " must state plan and bpm");
      assert.ok(Object.prototype.hasOwnProperty.call(FIGURES, row.dyn),
        key + ".dyn names no figure: " + row.dyn);
      assert.ok(!row.note.includes("*/"), key + ".note carries a */");
      // THE LABEL LAW, read forwards: a Place Year IF AND ONLY IF parents.
      const dated = /\d{3,4}\s*$/.test(row.label || "");
      assert.strictEqual(dated, !!row.parents,
        key + ': a label is a "Place Year" if and only if the row declares parents');
      if (row.prog && row.roots) for (let i = 0; i < row.prog.length; i++)
        assert.strictEqual(row.prog[i].d, row.roots[i],
          key + ": prog and roots disagree at bar " + i);
      rowTxt(key, row);                       // it emits, or it throws
    }
  });

  ok("R3e every generated SESSION is a song this build can load", () => {
    for (const f of rowFiles) {
      const key = f.slice(0, -5);
      const sp = path.join(OUT, key + ".session.json");
      if (!fs.existsSync(sp)) continue;
      const row = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
      GENRES[key] = Remix.resolveRow(row);
      try {
        const res = NSong.load(JSON.parse(fs.readFileSync(sp, "utf8")));
        assert.ok(res.ok, key + ".session.json: " + J((res.errors || [])[0]));
      } finally { delete GENRES[key]; }
    }
  });

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
