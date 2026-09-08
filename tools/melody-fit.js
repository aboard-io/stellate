#!/usr/bin/env node
// tools/melody-fit.js — IS THE TUNE ALL OVER THE PLACE? Four measures of the
// melody the page ACTUALLY RENDERS, each printed beside the number real music
// holds for the same measure.
//
//   node tools/melody-fit.js                       # the five default records
//   node tools/melody-fit.js --rec "Tehran 1974" --rec "Kingston 1969"
//   node tools/melody-fit.js --repertoire          # the corpus numbers alone
//   node tools/melody-fit.js --url http://127.0.0.1:8791/nukernel/index.html
//
// WHY IT EXISTS. Paul, 2026-09-08: *"Our melodies are now a little all over the
// place and it's hard to catch simple motifs. You can see it in Iranian pop."*
// The first answer to that was written blind — an octave-leap rate in
// compose.js, argued from numbers taken off `tools/ableton/score-node.mjs
// loadScore({genre})`. THAT PATH NEVER RUNS compose.js: it stands up
// `state.defaultSong()` on the DEFAULT seed phrase (genres.js:1039), so its
// 20.6%-over-an-octave was a fact about the seed phrase and about nothing a
// hand hears. Measured properly, on the page's own `__eightEvents`, the change
// moved NOTHING: 252 lanes byte-identical before and after. The reason is
// written in the tree already — precompose.js:1836, *"cellOf reads `ph.deg`,
// `ph.vel`, `ph.gate` and `ph.hold` and NOT `ph.oct`: the octave does not cross
// into the document cell at all"* — so the composer's octave punctuation is
// dead the moment a record becomes a document, and the compiled hook's `oct`
// is thirty-two zeroes on every record this box plays.
//
// So: TEST THE ARTIFACT. This reads `window.__eightEvents(si)`, which is what
// ui/derive.js sectionRender hands the engine — the notes that sound.
//
// THE FOUR MEASURES, and what each one caught:
//
//   1 · MOTION       stepwise share, moves over a fifth, moves over an octave,
//                    median interval. The box's leads: 67% stepwise, 7% over a
//                    fifth, 1.2% over an octave, median 2.
//                    THE REPERTOIRE: 62% / 13% / 0% / 2.9.
//   2 · COMPASS      how far the line wanders, inside one section and across
//                    the record. The box's leads: 11.9 semitones in a section,
//                    20.6 over the record.
//                    THE REPERTOIRE: 13.7 over a whole tune (Bach's invention
//                    24, Yesterday's verse 15, the hymns 9-17).
//   3 · RETURN       how many bars repeat a bar heard earlier — the same
//                    onsets (rhythm) and the same up/down (contour). A motif is
//                    a thing that COMES BACK, so this is the measure that
//                    speaks to "hard to catch". The box's leads: 33% inside a
//                    section, 56% over the record.
//                    THE REPERTOIRE, inside a section: 43% rhythm, 33% contour
//                    — and it is a WIDE band, Joel's verses at 0% and Depeche
//                    Mode's riff at 88%.
//   4 · TEXTURE      how many line lanes sound in one bar, and how many notes
//                    that bar holds. The box: 2.6 lanes, 14.5 notes; Tehran
//                    1974 and Kingston 1969 run 17-24 notes a bar with a
//                    busiest bar of 45-57.
//
// WHAT THAT ADDS UP TO, honestly: on the first three the rendered leads sit
// INSIDE the repertoire's own spread, and on the third they sit low in it. The
// one number that is not a melodic statistic at all is the fourth.
//
// QUANTIZE BEFORE YOU COUNT — the trap this file fell into first. `e.t` carries
// the PERFORMANCE on it: swing, the seeded micro-timing in ninths of a step
// (kernel.js perfDice), the agogic push. Spelled to the raw `t`, two bars of the
// identical figure never match and every lane reports 0% return. An ear hears
// the grid; count on the grid.
//
// THE CORPUS STAYS OFF THE TREE. `--repertoire` reads the frozen four-century
// benchmark (Bach's invention, Yesterday, Joel, Depeche Mode, three hymns) as
// bar/pos/pitch out of the memory directory, NOT out of this repo — the working
// tree is a public web root and transcriptions of other people's songs do not
// belong in it. Absent, the corpus numbers above are printed as the constants
// they were measured at.
//
// Playwright is borrowed the way every browser gate here borrows it, and the
// chromium path is explicit (chromium.launch() with no path resolves shell
// build 1200, which is not installed on this machine).
"use strict";

const path = require("path");
const fs = require("fs");

const BORROW = "/home/ford/ftrain-2025/node_modules";
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { ({ chromium } = require(BORROW + "/playwright")); }

const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const argAll = (k) => argv.reduce((a, x, i) => (x === k ? a.concat(argv[i + 1]) : a), []);
const URL0 = argOf("--url", "http://127.0.0.1:8791/nukernel/index.html");
const CHROME = argOf("--chrome", path.join(process.env.HOME || "",
  ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"));
const REPDIR = argOf("--repertoire-dir", path.join(process.env.HOME || "",
  ".claude/projects/-home-ford-stellate/memory/keeps/repertoire-benchmark"));
const SEEDS = (argOf("--seeds", "1,4")).split(",").map(Number);
const WAIT = +argOf("--wait", 4200);
// A record is named the way the atlas names it — "Tehran 1974" — because that
// is the label on the row and the two halves are exactly the link's `at` and
// `y`. Five defaults: the one Paul named, and four that stand in different
// corners of the catalogue.
const RECS = (argAll("--rec").length ? argAll("--rec")
  : ["Tehran 1974", "Kingston 1969", "Rio de Janeiro 1958", "Bristol 1991",
     "Sedalia 1899"]).map((s) => {
  const m = String(s).match(/^(.*)\s+(\d{3,4})$/);
  if (!m) { console.error("a record is \"Place Year\": " + s); process.exit(2); }
  return [m[1], +m[2]];
});

/* ---------- the counters, shared by both ends ---------- */
const pct = (n, d) => (d ? +((n / d) * 100).toFixed(1) : 0);
const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0);
// how many entries repeat one seen earlier, as a percentage
function back(list) {
  const seen = new Set(); let n = 0;
  for (const x of list) { if (seen.has(x)) n++; else seen.add(x); }
  return pct(n, list.length);
}
function motion(pitches) {
  const iv = [];
  for (let i = 1; i < pitches.length; i++) iv.push(Math.abs(pitches[i] - pitches[i - 1]));
  if (iv.length < 6) return null;
  const s = [...iv].sort((a, b) => a - b);
  return { n: pitches.length, range: Math.max(...pitches) - Math.min(...pitches),
           med: s[Math.floor(s.length / 2)], max: s[s.length - 1],
           step: pct(iv.filter((x) => x <= 2).length, iv.length),
           over7: pct(iv.filter((x) => x > 7).length, iv.length),
           over12: pct(iv.filter((x) => x > 12).length, iv.length) };
}
// A BAR IS SPELLED TWICE: its onsets alone, and its onsets plus up/down/same.
// The first is the figure a drummer would recognise, the second the shape an
// ear holds; the pitches themselves are deliberately not in either, because a
// figure said again over the next chord is still the same figure.
function spellBars(ev, stepsPerBar) {
  const bars = new Map();
  for (const e of ev) {
    const q = Math.round(e.t);                     // the grid, not the performance
    const k = Math.floor(q / stepsPerBar);
    if (!bars.has(k)) bars.set(k, []);
    bars.get(k).push([q % stepsPerBar, e.n]);
  }
  const rhythm = [], contour = [];
  for (const [, ns] of bars) {
    if (ns.length < 2) continue;
    ns.sort((a, b) => a[0] - b[0]);
    rhythm.push(ns.map((x) => x[0]).join(" "));
    contour.push(ns.map((x, i) => (i ? x[0] + Math.sign(x[1] - ns[i - 1][1])
                                     : x[0] + "^")).join(" "));
  }
  return { rhythm, contour };
}

/* ---------- the corpus ---------- */
// The measured constants, so the tool says something useful on a machine that
// does not carry the benchmark.
const CORPUS = { motion: { step: 61.7, over7: 12.9, over12: 0, med: 2.9, range: 13.7 },
                 within: { rhythm: 43.2, contour: 33.1 }, note: "measured 2026-09-08" };
function repertoire() {
  const files = [["bach", "bach/melody.json"], ["yesterday", "yesterday/melody.json"],
                 ["joel", "joel/melody.json"], ["dm", "dm/melody.json"]];
  const lines = [];
  for (const [tune, f] of files) {
    const p = path.join(REPDIR, f);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const k of Object.keys(j)) {
      const ns = j[k];
      if (!Array.isArray(ns) || ns.length < 8 || ns[0].pitch == null) continue;
      lines.push([tune + "." + k, [...ns].sort((a, b) => (a.bar - b.bar) || (a.pos - b.pos))]);
    }
  }
  const hy = path.join(REPDIR, "hymns/hymns.json");
  if (fs.existsSync(hy)) {
    const H = JSON.parse(fs.readFileSync(hy, "utf8"));
    for (const k of Object.keys(H)) {
      const ns = Array.isArray(H[k]) ? H[k] : (H[k] && (H[k].melody || H[k].notes));
      if (Array.isArray(ns) && ns.length >= 8 && ns[0].pitch != null)
        lines.push(["hymn." + k, ns]);
    }
  }
  if (!lines.length) return null;
  const rows = [];
  for (const [name, ns] of lines) {
    const m = motion(ns.map((n) => n.pitch));
    if (!m) continue;
    // a section of the corpus is one key of the file — v1, c1, the whole hymn
    const bars = new Map();
    for (const n of ns) { if (!bars.has(n.bar)) bars.set(n.bar, []);
      bars.get(n.bar).push([n.pos, n.pitch]); }
    const rhythm = [], contour = [];
    for (const [, b] of bars) {
      if (b.length < 2) continue;
      b.sort((x, y) => x[0] - y[0]);
      rhythm.push(b.map((x) => x[0]).join(" "));
      contour.push(b.map((x, i) => (i ? x[0] + Math.sign(x[1] - b[i - 1][1])
                                      : x[0] + "^")).join(" "));
    }
    rows.push([name, m, back(rhythm), back(contour)]);
  }
  return rows;
}
function printRepertoire(rows) {
  console.log("\nTHE REPERTOIRE — " + (rows ? rows.length + " lines off the frozen benchmark"
    : "not on this machine, printing the measured constants"));
  if (!rows) {
    console.log("  motion   stepwise " + CORPUS.motion.step + "% · over a fifth " +
      CORPUS.motion.over7 + "% · over an octave " + CORPUS.motion.over12 +
      "% · median " + CORPUS.motion.med);
    console.log("  compass  " + CORPUS.motion.range + " semitones a tune");
    console.log("  return   inside a section: rhythm " + CORPUS.within.rhythm +
      "% · contour " + CORPUS.within.contour + "%   (" + CORPUS.note + ")");
    return;
  }
  for (const [n, m, r, c] of rows)
    console.log("  " + n.padEnd(20) + " step " + String(m.step).padStart(5) +
      "% · over8 " + String(m.over7).padStart(5) + "% · over12 " +
      String(m.over12).padStart(4) + "% · compass " + String(m.range).padStart(3) +
      " · back " + String(r).padStart(5) + "%/" + String(c).padStart(5) + "%");
  const avg = (f) => mean(rows.map(f));
  console.log("  ALL: stepwise " + avg((r) => r[1].step) + "% · over a fifth " +
    avg((r) => r[1].over7) + "% · over an octave " + avg((r) => r[1].over12) +
    "% · median " + avg((r) => r[1].med) + " · compass " + avg((r) => r[1].range) +
    " · back inside a section " + avg((r) => r[2]) + "% rhythm, " +
    avg((r) => r[3]) + "% contour");
}

/* ---------- the box ---------- */
// One page evaluation per record: every pitched LINE event of every section,
// grouped by the voice that plays it. Drums and bass are not tunes and are not
// counted; a `pad` that holds one note is left in the ALL row and out of the
// LEADS row, which is what the two rows are for.
const LEADISH = /lead|vocal|voice|flute|piano|solo|topline|sing|guitar|horn|sax/i;
async function box() {
  const b = await chromium.launch({ executablePath: CHROME,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const lanes = [], density = [];
  try {
    for (const [at, y] of RECS) for (const seed of SEEDS) {
      const frag = "#at=" + encodeURIComponent(at) + "&y=" + y + "&s=" + seed;
      await p.goto(URL0 + frag, { waitUntil: "load" });
      await p.waitForTimeout(WAIT);
      const got = await p.evaluate(() => {
        const D = window.__eightDoc(), song = window.__eightSong();
        const names = (D.voices || []).map((v, i) => v.name || ("v" + i));
        const per = new Map();          // lv -> { secs: [[{t,n}]], all: [{t,n}] }
        const bars = new Map();         // "si:bar" -> { lanes:Set, n:0 }
        for (let si = 0; si < song.length; si++) {
          const byLv = new Map();
          for (const e of window.__eightEvents(si) || []) {
            if (e.kind !== "line" || e.n == null) continue;
            if (!byLv.has(e.lv)) byLv.set(e.lv, []);
            byLv.get(e.lv).push({ t: e.t, n: e.n });
            const k = si + ":" + Math.floor(Math.round(e.t) / 16);
            if (!bars.has(k)) bars.set(k, { lanes: [], n: 0 });
            const B = bars.get(k);
            if (!B.lanes.includes(e.lv)) B.lanes.push(e.lv);
            B.n++;
          }
          for (const [lv, ev] of byLv) {
            if (!per.has(lv)) per.set(lv, { secs: [], all: [] });
            per.get(lv).secs.push(ev);
            per.get(lv).all.push(...ev);
          }
        }
        return { basis: D.basis,
                 voices: (D.voices || []).length,
                 bars: [...bars.values()].map((x) => [x.lanes.length, x.n]),
                 lanes: [...per.entries()].map(([lv, o]) =>
                   [names[lv] || ("v" + lv), o.secs, o.all]) };
      });
      const tag = got.basis + "/" + seed;
      for (const [name, secs, all] of got.lanes) {
        if (all.length < 24) continue;
        all.sort((a, c) => a.t - c.t);               // sections arrive in order
        const m = motion(all.map((e) => e.n));
        if (!m) continue;
        const inSec = [], secBack = [], secBackC = [];
        for (const ev of secs) {
          if (ev.length < 8) continue;
          const ns = ev.map((e) => e.n);
          inSec.push(Math.max(...ns) - Math.min(...ns));
          const sp = spellBars(ev, 16);
          if (sp.rhythm.length >= 3) { secBack.push(back(sp.rhythm));
                                       secBackC.push(back(sp.contour)); }
        }
        const whole = spellBars(all, 16);
        lanes.push([tag, name, m, mean(inSec), mean(secBack), mean(secBackC),
                    back(whole.rhythm)]);
      }
      density.push([tag, got.bars.length, mean(got.bars.map((x) => x[0])),
                    mean(got.bars.map((x) => x[1])),
                    got.bars.length ? Math.max(...got.bars.map((x) => x[1])) : 0,
                    got.voices]);
    }
  } finally { await b.close(); }
  return { lanes, density };
}

(async () => {
  const rows = repertoire();
  if (argv.includes("--repertoire")) { printRepertoire(rows); return; }
  const { lanes, density } = await box();
  if (!lanes.length) { console.error("no lines rendered — is the page served at " + URL0 + "?");
    process.exit(1); }

  console.log("1 · MOTION and 2 · COMPASS, lane by lane");
  console.log("  record/seed      voice        notes  step  over8  over12  med  in a section  whole");
  for (const [tag, name, m, inSec] of lanes)
    console.log("  " + tag.padEnd(17) + name.padEnd(12) + String(m.n).padStart(6) +
      String(m.step + "%").padStart(6) + String(m.over7 + "%").padStart(7) +
      String(m.over12 + "%").padStart(8) + String(m.med).padStart(5) +
      String(inSec).padStart(14) + String(m.range).padStart(7));

  console.log("\n3 · RETURN — bars that repeat one heard earlier");
  console.log("  record/seed      voice        inside a section        whole record");
  for (const [tag, name, , , r, c, w] of lanes)
    console.log("  " + tag.padEnd(17) + name.padEnd(12) +
      String(r + "% rhythm").padStart(16) + String(c + "% contour").padStart(15) +
      String(w + "% rhythm").padStart(16));

  console.log("\n4 · TEXTURE — how much is going on at once");
  console.log("  record/seed        bars   lanes in a bar   notes a bar   busiest   voices");
  for (const [tag, bars, l, n, worst, v] of density)
    console.log("  " + tag.padEnd(19) + String(bars).padStart(4) + String(l).padStart(15) +
      String(n).padStart(14) + String(worst).padStart(10) + String(v).padStart(9));

  const leads = lanes.filter((r) => LEADISH.test(r[1]));
  const say = (label, rs) => rs.length && console.log(label + " (" + rs.length + " lanes): " +
    "stepwise " + mean(rs.map((r) => r[2].step)) + "% · over a fifth " +
    mean(rs.map((r) => r[2].over7)) + "% · over an octave " +
    mean(rs.map((r) => r[2].over12)) + "% · median " + mean(rs.map((r) => r[2].med)) +
    " · compass " + mean(rs.map((r) => r[3])) + " in a section, " +
    mean(rs.map((r) => r[2].range)) + " over the record · back " +
    mean(rs.map((r) => r[4])) + "% in a section, " + mean(rs.map((r) => r[6])) + "% whole");
  console.log("");
  say("THE BOX, ALL LANES", lanes);
  say("THE BOX, THE LEADS", leads);
  console.log("THE BOX, TEXTURE: " + mean(density.map((d) => d[2])) +
    " line lanes in a bar · " + mean(density.map((d) => d[3])) + " notes a bar · " +
    mean(density.map((d) => d[5])) + " voices on the record");
  printRepertoire(rows);
})();
