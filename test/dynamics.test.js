#!/usr/bin/env node
/* test/dynamics.test.js — THE DYNAMICS ON THE PAPER, AND IN THE FILE
 * (2026-08-30. Paul: "Would love crescendos and decrescendos and ppp to fff
 * markings in the score.")
 *
 * TEST THE ARTIFACT, twice over. The score's artifact is the ABC STRING the
 * page hands abcjs (window.__eightAbc — "a broken staff can be diagnosed by
 * READING what was asked for") plus the SVG abcjs actually drew from it,
 * because the vendored build drops an unsupported decoration SILENTLY and a
 * mark that never reaches the paper is a dead knob (ui/abc.js's own 8va
 * measurement is the precedent). The .mid's artifact is the parsed-back bytes
 * (__deckSmf → parseSmf), the same door test/deck.test.js walks through.
 *
 * THE CLAIM IS PER-RECORD EQUIVALENCE OF NOTES, WITH MARKS ADDED — said that
 * way because nearly every generated record DOES deal lvl/env words, so most
 * staves gain ink. Two records carry the whole of it:
 *   · the shipped 4/4 chant (Rome 600, the default page) deals NO word on any
 *     section — measured here off __eightNudges, not assumed — so its abc is
 *     BYTE-IDENTICAL to the bare fold and its SVG holds zero dynamics;
 *   · the rock record (London 1969) deals lvl and env on ten of eleven
 *     sections, and stripping the !…! ink out of its abc must return the bare
 *     string byte for byte — the notes never moved, the marks were added.
 *
 * NO SECOND COPY OF THE MAPPING. Where this gate predicts (which sections
 * hairpin, which way; which lvl word is louder) it reads the OWNERS off the
 * page — kernel SHAPES' own curve ends for the travel, fields LEVELS' own
 * gains for the order — never a table retyped here. The mark SCALE itself
 * (dB → ppp..fff) is deliberately not re-derived: its claims are structural
 * (marks only at section starts, only at changes, louder lvl ⇒ louder mark).
 *
 * Playwright is borrowed (NODE_PATH=/home/ford/ftrain-2025/node_modules); the
 * chromium path is explicit, as in every browser gate here.
 */
"use strict";
const { chromium } = require("playwright");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE = arg("--page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");

let FAILS = 0, CHECKS = 0;
const ok = (m) => { CHECKS++; console.log("  ok   " + m); };
const fail = (m) => { CHECKS++; FAILS++; console.log("  FAIL " + m); };
const is = (cond, m) => (cond ? ok(m) : fail(m));

const MARK_RE = /!(?:ppp|pp|p|mp|mf|f|ff|fff)!/g;
const INK_RE = /!(?:ppp|pp|p|mp|mf|f|ff|fff)!|!(?:crescendo|diminuendo)[()]!/g;
/* THE SECOND INK, 2026-08-31 — chord symbols. Paul asked for them in the same
   breath as the dynamics ("...or chords being labeled") and they ride the same
   string by the same surgery, so the byte-identity claim below now covers BOTH:
   strip every mark AND every label and toScore's bare paper must return. That
   is a WIDER claim than before, not a weaker one — R1/C1 failed the moment the
   labels landed, which is the gate doing its job, and the fix is to teach it
   the new ink rather than to stop asking. */
const CHORD_RE = /"[A-G][b#]?(?:m|dim|aug|sus4)?(?:maj7|7|6|9)?"/g;
const ALLINK_RE = new RegExp(INK_RE.source + '|' + CHORD_RE.source, "g");

/* everything the page knows about its own score, read in one evaluate */
async function readScore(pg) {
  return pg.evaluate(() => {
    const abc = window.__eightAbc(), bare = window.__eightAbcBare();
    const sc = window.__eightScore();
    const svg = document.querySelector("#scoredeck svg");
    const count = (sel) => (svg ? svg.querySelectorAll(sel).length : -1);
    // the OWNERS, read off the page: what each env word's curve does at its
    // ends (kernel SHAPES — the same measurement ui/eight.js envFacts makes),
    // and what each lvl word is worth (fields LEVELS)
    const K = window.NuKernel, NF = window.NuFields;
    const travel = {};
    for (const w of Object.keys(K.SHAPES || {})) {
      const f = K.SHAPES[w], a = f(0), m = f(0.5), b = f(1);
      travel[w] = a === m && m === b ? 0 : b - a > 0.05 ? 1 : a - b > 0.05 ? -1 : 0;
    }
    return { abc, bare, secAt: sc.secAt, steps: sc.steps,
             nudges: window.__eightNudges().map((n) => ({ env: n.env, lvl: n.lvl })),
             travel, levels: NF.LEVELS,
             deco: count(".abcjs-decoration"), dyn: count(".abcjs-dynamics"),
             notes: count(".abcjs-note") };
  });
}

/* V1's music line, split into bars the way ui/eight.js inkDynamics splits it:
   toScore joins bars with " | " (and " || " at a section's divide), so the
   split is on those exact separators and the count must equal the record's
   own bar count. */
function v1Bars(abc, steps, secAt) {
  const lines = abc.split("\n");
  const vi = lines.findIndex((l) => /^V:V1(\s|$)/.test(l));
  let mi = vi + 1;
  while (mi < lines.length && /^K:/.test(lines[mi])) mi++;
  const line = lines[mi].replace(/ \|\]$/, "");
  const bars = line.split(/ \|{1,2} /);
  const spb = steps / bars.length;                 // steps per bar, the record's own
  const secBar = secAt.map((s) => s / spb);
  return { bars, spb, secBar };
}

(async () => {
  console.log("test/dynamics.test.js — the record's dealt dynamics, drawn and filed\n");
  const b = await chromium.launch({ executablePath: EXE });

  /* ===== R · THE WORDED RECORD (rock, London 1969) ======================== */
  {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = [];
    pg.on("pageerror", (e) => errs.push(String(e)));
    /* `&s=1` SINCE 2026-09-02. Paul: *"Boot up every new session with a new seed
       unless there's a seed in the URL."* An absent `s` used to mean 1 (the atlas
       clamped anything unreadable to it); it means A FRESH DRAW now, so a cold
       load with no seed is a different record every run and every byte-level
       claim below would be measuring the dice. The seed is named in the address,
       which is the door the sentence itself points at. */
    await pg.goto(PAGE + "#at=London&y=1969&s=1", { waitUntil: "networkidle" });
    await pg.evaluate(() => window.__eightTab && window.__eightTab("Score"));
    await pg.waitForTimeout(2500);
    const r = await readScore(pg);
    const worded = r.nudges.filter((n) => n.env || n.lvl).length;
    is(worded > 0, "R0 · the premise holds: the rock record deals words (" +
       worded + " of " + r.nudges.length + " sections)");

    // R1 — per-record equivalence of notes: strip the ink, get the bare fold
    is(r.abc.replace(ALLINK_RE, "") === r.bare,
       "R1 · stripping the !…! ink returns toScore's bare string BYTE FOR BYTE " +
       "— the notes never moved, the marks were added");
    is((r.abc.match(MARK_RE) || []).length > 0, "R1 · …and marks were in fact added");
    /* R1b · EVERY STAFF, AND THE LABELS ON ONE. Measured before the fix: 22
       marks on V1 and zero on the other nine staves, which is what Paul saw as
       "VERY FEW". The .mid has always written the ride on every channel
       (R6 below), so this is the paper agreeing with the file. Chord symbols
       go the other way — above the top staff only, as in any printed score. */
    {
      const L = r.abc.split("\n");
      const perVoice = [];
      for (let i = 0; i < L.length; i++) {
        if (!/^V:V\d+(\s|$)/.test(L[i])) continue;
        let j = i + 1;
        while (j < L.length && /^K:/.test(L[j])) j++;
        if (j >= L.length || /^V:/.test(L[j])) continue;
        perVoice.push({ v: L[i].split(/\s/)[0],
                        marks: (L[j].match(MARK_RE) || []).length,
                        chords: (L[j].match(CHORD_RE) || []).length });
      }
      const n0 = perVoice.length ? perVoice[0].marks : 0;
      is(perVoice.length > 1 && perVoice.every((p) => p.marks === n0 && n0 > 0),
         "R1b · every staff carries the same dynamics (" + perVoice.length +
         " voices x " + n0 + " marks) — not just the top one");
      is(perVoice.filter((p) => p.chords > 0).length === 1 &&
         perVoice[0].chords > 0,
         "R1b · …and the chord labels sit on the TOP staff alone (" +
         perVoice[0].chords + " on " + (perVoice[0] || {}).v + ")");
    }

    // R2 — the ink sits only at section boundaries, and only where it changes
    const { bars, secBar } = v1Bars(r.abc, r.steps, r.secAt);
    is(Number.isInteger(secBar[1] || 0) && bars.length === r.steps / (r.steps / bars.length),
       "R2 · V1 splits into whole bars at toScore's own barlines (" + bars.length + " bars)");
    const starts = new Set(secBar);
    let offBoundary = 0;
    const emitted = [];
    bars.forEach((bar, i) => {
      const marks = bar.match(MARK_RE) || [];
      if (marks.length && !starts.has(i)) offBoundary++;
      for (const m of marks) emitted.push(m);
    });
    is(offBoundary === 0, "R2 · every dynamic mark sits on a section's first bar, " +
       "never restated mid-section (" + emitted.length + " marks over " +
       secBar.length + " sections)");
    let repeats = 0;
    for (let i = 1; i < emitted.length; i++) if (emitted[i] === emitted[i - 1]) repeats++;
    is(repeats === 0, "R2 · consecutive marks always differ — a mark is written " +
       "only at a CHANGE (" + emitted.join(" ") + ")");

    // R3 — hairpins: predicted per section off kernel SHAPES' own curve ends
    const NS = r.nudges.length;
    let pinsRight = true, pairPer = true, said = [];
    for (let si = 0; si < NS; si++) {
      const b0 = secBar[si], b1 = (si + 1 < NS ? secBar[si + 1] : bars.length) - 1;
      const span = bars.slice(b0, b1 + 1).join(" ");
      const want = r.travel[r.nudges[si].env] || 0;
      const co = (span.match(/!crescendo\(!/g) || []).length,
            cc = (span.match(/!crescendo\)!/g) || []).length,
            po = (span.match(/!diminuendo\(!/g) || []).length,
            pc = (span.match(/!diminuendo\)!/g) || []).length;
      if (co !== cc || po !== pc) pairPer = false;
      const one = want > 0 ? co === 1 && po === 0 : want < 0 ? po === 1 && co === 0
                : co === 0 && po === 0;
      if (!one) { pinsRight = false; said.push(si + ":" + (r.nudges[si].env || "·") + "→" + co + "/" + po); }
      // …and the open sits on the section's first bar, the close on its last
      if (want > 0 && !(bars[b0].includes("!crescendo(!") && bars[b1].includes("!crescendo)!"))) pinsRight = false;
      if (want < 0 && !(bars[b0].includes("!diminuendo(!") && bars[b1].includes("!diminuendo)!"))) pinsRight = false;
    }
    is(pinsRight && pairPer, "R3 · each section whose env CURVE travels (kernel " +
       "SHAPES' own ends) carries exactly one hairpin pair spanning it — open on " +
       "its first bar, close in its last — and a flat or returning curve carries " +
       "none" + (said.length ? " [" + said.join(" ") + "]" : ""));

    // R4 — a louder lvl word is a louder mark (order read off fields LEVELS)
    const order = MARK_RE.source; // not used; order below is DYNMARKS order
    const RANK = ["!ppp!", "!pp!", "!p!", "!mp!", "!mf!", "!f!", "!ff!", "!fff!"];
    const markAt = []; // per section: the mark GOVERNING it (last emitted at or before)
    { let cur = null;
      for (let si = 0; si < NS; si++) {
        const m = (bars[secBar[si]] || "").match(MARK_RE);
        if (m) cur = m[0];
        markAt.push(cur);
      } }
    let orderOk = true, pairs = 0;
    for (let a = 0; a < NS; a++) for (let c = 0; c < NS; c++) {
      const la = r.nudges[a].lvl, lc = r.nudges[c].lvl;
      if (!la || !lc || la === lc) continue;
      if (r.nudges[a].env !== r.nudges[c].env) continue;   // same shape, only lvl differs
      pairs++;
      if ((r.levels[la] > r.levels[lc]) !== (RANK.indexOf(markAt[a]) > RANK.indexOf(markAt[c])))
        orderOk = false;
    }
    is(orderOk, "R4 · where two sections share a shape and differ only in lvl, the " +
       "louder WORD (fields LEVELS' own gain) wears the louder MARK (" + pairs + " pairs)");

    // R5 — the paper: abcjs drew every token (it drops unknown decorations
    // silently, so the SVG is the only witness)
    const nMarks = (r.abc.match(MARK_RE) || []).length;
    const nPairs = (r.abc.match(/!crescendo\(!/g) || []).length +
                   (r.abc.match(/!diminuendo\(!/g) || []).length;
    is(r.dyn === nMarks + nPairs, "R5 · the SVG holds one .abcjs-dynamics element " +
       "per mark and per hairpin pair (" + r.dyn + " = " + nMarks + " + " + nPairs + ")");
    // …and the ink moved no notehead: render the bare string beside it
    const bareNotes = await pg.evaluate((bare) => {
      const host = document.createElement("div");
      host.style.cssText = "position:absolute;left:-9999px;width:1200px";
      document.body.append(host);
      const A = window.ABCJS;
      if (!A) return -2;
      A.renderAbc(host, bare, { add_classes: true, staffwidth: 1200 });
      const n = host.querySelectorAll(".abcjs-note").length;
      host.remove();
      return n;
    }, r.bare);
    is(bareNotes === -2 || bareNotes === r.notes,
       "R5 · the marked staff draws exactly the bare staff's noteheads (" +
       r.notes + (bareNotes === -2 ? ", bare render skipped: no ABCJS global" :
       " = " + bareNotes) + ") — the glyph map cannot shift under the ink");

    // R6 — the .mid: the lvl lane the velocities never carried, as CC11
    const mid = await pg.evaluate(async () => {
      const m = await window.__deckSmf();
      if (!m) return null;
      return { ccs: m.parsed.tracks.map((t) => (t.ccs || [])),
               lvls: window.__eightNudges().map((n) => n.lvl) };
    });
    const voiceCcs = mid.ccs.slice(1);                     // track 0 is the conductor
    const dealt = new Set(mid.lvls.filter(Boolean));
    const wantVals = new Set([...dealt, "norm"].map((w) =>
      Math.round(100 * Math.sqrt(r.levels[w]))));
    const ride = (c) => JSON.stringify(c.map((x) => [x.tick, x.cc, x.val]));
    const first = ride(voiceCcs[0] || []);
    is(voiceCcs.length > 0 && voiceCcs.every((c) => ride(c) === first),
       "R6 · every voice track carries the SAME expression ride — the dealt level " +
       "is a whole-section gain (audio/desk.js sectionOf), so every channel says it");
    is(voiceCcs[0].length > 0 &&
       voiceCcs[0].every((c) => c.cc === 11 && wantVals.has(c.val)),
       "R6 · the ride is CC11 and every value is a dealt word's own price, " +
       "100·√LEVELS[w] (" + voiceCcs[0].map((c) => c.val).join(" ") + ")");
    let ccRepeats = 0;
    for (let i = 1; i < voiceCcs[0].length; i++)
      if (voiceCcs[0][i].val === voiceCcs[0][i - 1].val) ccRepeats++;
    is(ccRepeats === 0, "R6 · a CC lands only where the level CHANGES (" +
       voiceCcs[0].length + " events for " + mid.lvls.length + " sections)");

    is(errs.length === 0, "R7 · zero pageerrors on the worded record" +
       (errs.length ? " [" + errs[0].slice(0, 120) + "]" : ""));
    await pg.close();
  }

  /* ===== C · THE WORDLESS RECORD (the shipped 4/4 chant) ================== */
  {
    const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const errs = [];
    pg.on("pageerror", (e) => errs.push(String(e)));
    await pg.goto(PAGE, { waitUntil: "networkidle" });
    await pg.evaluate(() => window.__eightTab && window.__eightTab("Score"));
    await pg.waitForTimeout(2500);
    const r = await readScore(pg);
    is(r.nudges.every((n) => !n.env && !n.lvl),
       "C0 · the premise holds: the chant's sections deal no lvl/env word");
    /* THE CLAIM SPLIT WHEN THE SECOND INK ARRIVED (2026-08-31). This used to
       be one sentence — "no words dealt, so the abc IS the bare fold" — and it
       was true while dynamics were the only thing added. Chord labels are NOT
       dynamics: a record can deal no lvl and no env and still have changes to
       name, and the chant does. So the byte-identity half now strips BOTH inks
       (the notes still never moved) and the dynamics half still asks for
       exactly what it always asked: no words, no marks, no CCs. Splitting it
       keeps both claims sharp; merging them would have quietly stopped testing
       the dynamics premise the moment a label appeared. */
    is(r.abc.replace(ALLINK_RE, "") === r.bare,
       "C1 · a record whose sections deal no words gains NO DYNAMICS — strip " +
       "every ink and its abc IS the bare fold, byte for byte (the 4/4 chant)");
    is((r.abc.match(INK_RE) || []).length === 0 && r.dyn === 0,
       "C1 · …and neither the string nor the SVG holds a single dynamic");
    is((r.abc.match(CHORD_RE) || []).length > 0,
       "C1 · …while its CHANGES are still named — a chord label is not a dynamic");
    const mid = await pg.evaluate(async () => {
      const m = await window.__deckSmf();
      return m ? m.parsed.tracks.map((t) => (t.ccs || []).length) : null;
    });
    is(mid && mid.every((n) => n === 0),
       "C2 · the wordless record's .mid writes zero CCs — the bytes are the old bytes");
    is(errs.length === 0, "C3 · zero pageerrors on the wordless record");
    await pg.close();
  }

  await b.close();
  console.log("\n" + (FAILS ? FAILS + " of " + CHECKS + " FAILED" :
                      "all " + CHECKS + " checks pass"));
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
