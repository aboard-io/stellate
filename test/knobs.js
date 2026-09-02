#!/usr/bin/env node
/* test/knobs.js — THE VOICE'S OWN KNOBS, AND THE TWO THINGS THAT MOVE TIME.
 *
 *   node test/knobs.js
 *   node test/knobs.js --page http://localhost:8777/nukernel/index.html
 *
 * VOICE.md §10 is the specification for checks 1-7 and it puts ABSENT-IS-TODAY
 * first on purpose: before a control exists, nothing it could write may already
 * be written. Checks 8-10 are the two asks that came with it — a take that
 * re-seeds and a tempo row that is about tempo — and they are here rather than
 * in a file of their own because all three features share one predicate:
 * A CONTROL ON THIS PAGE MOVES SOMETHING THE ENGINE READS, or it is a lie.
 *
 * TEST THE ARTIFACT. Checks 1-3, 5 and 7 are pure node — they are about the
 * TABLE and the ENGINE, and a browser would only slow them down. Checks 4, 6
 * and 8-10 drive the rendered page and read the DOM the browser actually built,
 * because "three features shipped broken here while every check passed" and
 * every one of those three passed a check that asked a module what it WOULD
 * draw.
 *
 * Playwright is borrowed (NODE_PATH=/home/ford/ftrain-2025/node_modules) and
 * the executable path is EXPLICIT — chromium.launch() with no path resolves
 * shell build 1200, which is not installed on this machine.
 */
"use strict";
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
const path = require("path");
const { execFileSync } = require("child_process");
const R = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const PAGE = arg("--page", "http://localhost:8777/nukernel/index.html");
const EXE = arg("--chrome", process.env.HOME +
  "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome");

const notes = [], fails = [];
const check = (ok, what) => { (ok ? notes : fails).push((ok ? "  ok   " : "  FAIL ") + what); };
const J = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  const KN = require(R + "/nukernel/knobs.js");
  const SE = require(R + "/engine/faust/voices/state-engine.js");
  const K = require(R + "/nukernel/kernel.js");
  const NG = require(R + "/nukernel/genres.js");
  const Doc = require(R + "/nukernel/document.js");
  const PC = require(R + "/nukernel/precompose.js");
  const Songs = require(R + "/nukernel/songs.js");
  const TE = await import("file://" + R + "/nukernel/audio/to-engine.js");
  const { portrait } = require(R + "/test/fixtures/terms-genre.freeze.js");
  const FLEET = TE.SYNTH_NAMES();
  const ST = { bpm: 120, seed: 1 };

  console.log("test/knobs.js — the voice's own knobs");

  /* ---- 1 NOTHING TOUCHED SOUNDS IDENTICAL -----------------------------
     The first law and the first check. `knobs.js` publishes a `derived` for
     every one of its rows; a table that had accidentally WRITTEN any of them
     would show up here as a compile that differs from the compile of the same
     document with the key taken away. Every anchor, plus the shipped chant,
     plus every seated voice in the fleet. */
  const anchors = Object.keys(NG.GENRES).filter((g) => NG.GENRES[g] && NG.GENRES[g].bars != null);
  let same = 0, moved = [];
  for (const gk of anchors) {
    let doc; try { doc = PC.genreToDocument(gk, 1); } catch (e) { continue; }
    for (let i = 0; i < doc.form.sections.length; i++) {
      const a = J(portrait(Doc.toGenre(doc, i, NG.GENRES, FLEET), K));
      const b = J(portrait(Doc.toGenre(J(doc), i, NG.GENRES, FLEET), K));
      if (JSON.stringify(a) === JSON.stringify(b)) same++;
      else moved.push(gk + "#" + i);
    }
  }
  check(!moved.length && same > 100, "1 " + anchors.length +
    " anchors compile identically twice over (" + same + " sections) " +
    JSON.stringify(moved.slice(0, 3)));

  // …and a knob WRITTEN and then CLEARED puts the record back byte for byte,
  // which is the dim-vs-lit law stated as an equality rather than as prose.
  const T0 = J(Songs.TERMS);
  const before = JSON.stringify(J(portrait(Doc.toGenre(T0, 1, NG.GENRES, FLEET), K)));
  const T1 = J(Songs.TERMS);
  const cantor = T1.voices.find((v) => v.name === "cantor");
  // …ON A KEY THE RECORD DOES NOT ALREADY STATE, and the distinction matters:
  // the chant's cantor SAYS `breath: 0.07`, so clearing that key returns to the
  // parent's 0.06 and not to the chant's 0.07 — which is correct and is the
  // whole of the law (there is no third layer; the record's `set` IS the user
  // value). `cutoff` is unstated there, so absent means absent both times.
  cantor.set = { ...cantor.set, cutoff: 9000 };
  const turned = JSON.stringify(J(portrait(Doc.toGenre(T1, 1, NG.GENRES, FLEET), K)));
  delete cantor.set.cutoff;
  const cleared = JSON.stringify(J(portrait(Doc.toGenre(T1, 1, NG.GENRES, FLEET), K)));
  check(before !== turned, "1b turning a knob MOVES the record");
  check(before === cleared, "1c …and clearing it puts the record back, byte for byte");

  /* ---- 2 EVERY CONTROL REACHES A PARAMETER -----------------------------
     The extractor's own predicate, run as an assertion: a row that stops
     reaching fails the build rather than drawing dead. */
  const dead = [];
  for (const [dsp, V] of Object.entries(KN.voices)) {
    for (const r of V.rows) {
      const probe = (set) => { try { return TE.voiceUnit(dsp, set, ST); } catch (e) { return null; } };
      const shot = (u) => JSON.stringify(u && [u.params, u.vowels, u.vowelEvery,
                                               u.freqMin, u.freqMax, u.module, u.dx7Preset]);
      let a, b;
      if (r.kind === "patch") { a = probe(r.patches[0]); b = probe(r.patches[r.patches.length - 1]); }
      else if (r.kind === "word" || r.kind === "vowels") {
        const vals = r.values || r.words;
        a = probe({ [r.key]: vals[0] }); b = probe({ [r.key]: vals[vals.length - 1] });
      } else { a = probe({ [r.key]: r.min }); b = probe({ [r.key]: r.max }); }
      if (shot(a) === shot(b)) dead.push(dsp + "/" + r.key);
    }
  }
  check(!dead.length, "2 all " + KN.total + " controls move a parameter at their own ends " +
    JSON.stringify(dead.slice(0, 5)));

  // …and every published range is REACHABLE and lands on its own grid, which is
  // what stops a slider drawing the record's number as a number the record does
  // not say (measured: the chant's `attack: 0.03` drew 0.031).
  const offGrid = [];
  for (const [dsp, V] of Object.entries(KN.voices))
    for (const r of V.rows) {
      if (r.kind !== "number" || r.derived == null || r.unreachable) continue;
      const k = (r.derived - r.min) / r.step;
      if (Math.abs(k - Math.round(k)) > 1e-6 || r.derived < r.min || r.derived > r.max)
        offGrid.push(dsp + "/" + r.key + " " + r.derived + " in [" + r.min + "," + r.max + "]/" + r.step);
    }
  check(!offGrid.length, "2b every derived value is on its slider's own grid " +
    JSON.stringify(offGrid.slice(0, 4)));

  // …and ONE OWNER PER PARAMETER: two document keys reaching one param is the
  // two-owners bug in miniature, and the fleet has four such pairs.
  const twoOwners = [];
  for (const [dsp, V] of Object.entries(KN.voices)) {
    const seen = {};
    for (const r of V.rows) {
      if (seen[r.param]) twoOwners.push(dsp + "/" + r.param + ": " + seen[r.param] + " and " + r.key);
      seen[r.param] = r.key;
    }
  }
  check(!twoOwners.length, "2c one document key per parameter " + JSON.stringify(twoOwners));

  /* ---- 3 NO CONTROL IS ON THE MEASURED-INERT LIST --------------------- */
  const quietKeys = [];
  for (const [dsp, V] of Object.entries(KN.voices)) {
    const live = new Set(V.rows.map((r) => r.key));
    for (const q of V.quiet) {
      if (live.has(q.key)) quietKeys.push(dsp + "/" + q.key);
      if (!q.why || !q.why.trim()) quietKeys.push(dsp + "/" + q.key + " (no reason)");
    }
  }
  check(!quietKeys.length, "3 no measured-silent key is drawn as a control, and every " +
    "one of them carries its number " + JSON.stringify(quietKeys));

  /* ---- 5 THE VOWEL SEQUENCE ROUND-TRIPS ------------------------------
     The rows are swapped: `voice_lead` reads a CSOUND table indexed a-e-i-o-u
     and `tract_voice` reads tract.lib's, indexed i-e-a-o-u. A UI that wrote a
     vowel as a NUMBER would sing the wrong vowel on one of the two families and
     nothing would ever fail — so this is the check that would have failed. */
  const trips = [];
  for (const [dsp, V] of Object.entries(KN.voices)) {
    const row = V.rows.find((r) => r.kind === "vowels");
    if (!row) continue;
    const words = [];
    for (const a of row.words) for (const b of row.words) words.push(a + b + a);
    for (const w of words) {
      const u = TE.voiceUnit(dsp, { vowels: w }, ST);
      const back = u.vowels.map((n) => Object.keys(row.rowOf).find((L) => row.rowOf[L] === n));
      if (back.join("") !== w) trips.push(dsp + " " + w + " -> " + back.join(""));
    }
    // …and the letter the page prints under the stave is the letter the engine
    // walks to, for the same beat, by the parent's own arithmetic.
    const ev = 2, word = "aeo";
    const u2 = TE.voiceUnit(dsp, { vowels: word, vowelEvery: ev }, ST);
    for (let beat = 0; beat < 16; beat += 0.5) {
      const step = Math.round(beat / u2.vowelEvery);
      const engineRow = u2.vowels[((step % u2.vowels.length) + u2.vowels.length) % u2.vowels.length];
      const pageLetter = word[((step % word.length) + word.length) % word.length];
      if (row.rowOf[pageLetter] !== engineRow)
        trips.push(dsp + " beat " + beat + " page " + pageLetter + " engine row " + engineRow);
    }
  }
  check(!trips.length, "5 every word the widget can make round-trips through the " +
    "swapped rows, and the printed letter is the sung one " + JSON.stringify(trips.slice(0, 3)));

  /* ---- 7 knobs.js REGENERATES ---------------------------------------- */
  let regen = "";
  try { execFileSync(process.execPath, [R + "/nukernel/knobs-extract.js", "--check"],
    { cwd: R, stdio: "pipe" }); }
  catch (e) { regen = String(e.stdout || "") + String(e.stderr || ""); }
  check(!regen, "7 `node nukernel/knobs-extract.js --check` agrees with the engine " + regen.slice(0, 200));

  /* ---- 9 A TAKE IS A SEED (node half) --------------------------------
     `performance.take` was in every document and no compiler read it: the page
     drew a slider for it, the atlas printed it, and every record this box has
     ever made was take one. */
  const takeDoc = J(Songs.TERMS);
  const t1 = JSON.stringify(J(portrait(Doc.toGenre(takeDoc, 1, NG.GENRES, FLEET), K)));
  takeDoc.performance.take = 1;
  const t1b = JSON.stringify(J(portrait(Doc.toGenre(takeDoc, 1, NG.GENRES, FLEET), K)));
  takeDoc.performance.take = 3;
  const t3 = JSON.stringify(J(portrait(Doc.toGenre(takeDoc, 1, NG.GENRES, FLEET), K)));
  takeDoc.performance.take = 4;
  const t4 = JSON.stringify(J(portrait(Doc.toGenre(takeDoc, 1, NG.GENRES, FLEET), K)));
  takeDoc.performance.take = 3;
  const t3again = JSON.stringify(J(portrait(Doc.toGenre(takeDoc, 1, NG.GENRES, FLEET), K)));
  check(t1 === t1b, "9 take 0 and take 1 are the same reading — absent is today");
  check(t1 !== t3 && t3 !== t4, "9b take 3 and take 4 are two different performances");
  check(t3 === t3again, "9c …and take 3 is the same performance forever");
  // …and it moves the ENGINE and not the MODEL: no decision is downstream of a
  // take, which is what makes "the same song, played again" true by construction.
  const g1 = Doc.toGenre(J(Songs.TERMS), 1, NG.GENRES, FLEET);
  const d3 = J(Songs.TERMS); d3.performance.take = 3;
  const g3 = Doc.toGenre(d3, 1, NG.GENRES, FLEET);
  const diff = Object.keys(g3).filter((k) => typeof g3[k] !== "function" &&
    k !== "__v" && JSON.stringify(g3[k]) !== JSON.stringify(g1[k]));
  check(diff.length && diff.every((k) => k === "kitSeed" || k === "pipes"),
    "9d a take moves the dice and nothing else " + JSON.stringify(diff));

  /* ================= THE RENDERED PAGE ================================= */
  let chromium = null;
  try { chromium = require("playwright").chromium; }
  catch (e) { fails.push("  FAIL  playwright is not on NODE_PATH: " + e.message); }
  if (chromium) {
    const b = await chromium.launch({ executablePath: EXE });
    const errs = [];
    for (const [W, H] of [[390, 844], [1280, 900]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H } });
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errs.push(W + ": pageerror " + e.message));
      p.on("console", (m) => { if (m.type() === "error") errs.push(W + ": console " + m.text()); });
      /* ===== THE BOX BOOTS ON THE BLANK STATE NOW (2026-09-02) ================
         Paul, the composer round: *"Add a 'silence' genre at the top of the genre
         list. This is a blank state."* The box opens on `silence` — one eight-bar
         section, ZERO voices, one cell of rests — instead of on a copy of the
         shipped chant, because a box that opened playing somebody else's record was
         answering a question nobody had asked yet.
         THIS GATE IS ABOUT A RECORD WITH A BAND IN IT, so it asks for one, in the
         address, the way a link does: `#at=Rome&y=600&s=1` is the shipped chant —
         the very `songs.js TERMS` this file used to inherit from the boot — named
         rather than assumed. `s=1` because the boot draws a seed now (Paul: *"Boot
         up every new session with a new seed unless there's a seed in the URL"*) and
         a gate that re-rolled its own subject would measure a different record every
         run. Naming the fixture is the honest half of the change: what this file
         asserts about "the record" is now a claim about a record it chose. */
      await p.goto(PAGE, { waitUntil: "networkidle" });
      await p.waitForTimeout(2200);
      /* ...AND THE FIXTURE IS THE SHIPPED CHANT ITSELF, BY NAME (2026-09-02).
         The paragraph above is right that this gate needs a record with a band
         in it; what it needs is THE SHIPPED ONE — its checks name `cantor` and
         read `T1.voices.find(v => v.name === "cantor")` off `songs.js TERMS`,
         and a COMPOSED anchor at Rome 600 names its players `voice`, `voice2`,
         `vocal`. So the record is asked for through the page's own document
         door rather than through the address: `__eightShipped()` is
         `CTX.setDocument(a deep copy of TERMS)`, the same call a link makes,
         and it is the inherited boot record made explicit. */
      await p.evaluate(() => window.__eightShipped && window.__eightShipped());
      await p.waitForTimeout(1200);
      const tag = " @" + W;

      /* THE VOICE TABS ARE THE STRIPE'S `band` LEVEL SINCE 2026-08-28 (Paul:
         *"There should be one vertical stripe max with an 'up' icon to get to
         the parent level"*). This read `#tabs button` and matched on
         `textContent`; it reads `#nu-tray [data-k^="tab"]` and matches on the
         `aria-label`, which is the voice's name and the one string ui/glyph.js
         owns.
         AND IT OPENS THE BAND TAB FIRST, which it never did. `#tabs` only
         existed while the Band panel was open (2026-08-27, the nine tabs), so
         from that day until this one every `tab(...)` and every `seat(...)`
         click in this gate found nothing and fired nothing — the gate was
         driving the record through `__eightDoc()` alone and its clicks were
         silent. `__eightTab` is the page's own door and is what a thumb does. */
      /* ...AND A DOOR TO ANY OF THE NINE, for the two checks below that are
         not about the band at all. Fixing the crash above turned this gate
         back on and ten checks came up red the first time it ran end to end:
         every one of them was looking for a control on a panel it had never
         opened — `[data-k^="tempo-"]` is the Tempo tab and `.nu-syll` is the
         Score deck, and eight panels out of nine are `display: none` and
         `inert`. Those are not new failures, they are the failures the crash
         was standing in front of since 2026-08-27; they are repaired here by
         opening the tab, which is the same one-line repair test/sheets.js and
         test/selects.js already took for `+ drums`. */
      const top = async (n) => { await p.evaluate((x) => window.__eightTab(x), n);
        await p.waitForTimeout(500); };
      const band = async () => { await top("Band"); };
      /* ...AND `performance` IS INSIDE `Structure` SINCE 2026-09-02. Paul:
         *"Sections/Structure has the same challenges. … Bring performance into
         structure."* It is the last block of that panel and `tabperformance`
         is the row in the stripe that opens it — the KEY did not move, because
         an address does not move when a row does; the branch it hangs under
         did. Every other name this helper is called with is a voice, and
         voices are still the Band's. */
      const tab = async (name) => {
        if (name === "performance" || name === "form") {
          await top("Structure");
          await p.evaluate(() => { const t =
            document.querySelector('[data-k="tabperformance"]'); if (t) t.click(); });
          await p.waitForTimeout(450);
          return;
        }
        await band(); await p.evaluate((n) => {
        const t = [...document.querySelectorAll('#nu-tray [data-k^="tab"]')]
          .find((x) => (x.getAttribute("aria-label") || "").trim() === n);
        if (t) t.click(); }, name);
        await p.waitForTimeout(450); };
      const seat = async (dsp) => { await p.evaluate((d) => { const doc = window.__eightDoc();
          const v = doc.voices.find((x) => x.kind === "line");
          v.instrument = d; delete v.set; }, dsp);
        await band();
        await p.evaluate(() => document.querySelector('#nu-tray [data-k^="tab"]').click());
        await p.waitForTimeout(250); await tab("cantor"); };

      /* ---- 4 NO CONTROL DRAWS FOR A VOICE THAT CANNOT USE IT ---------- */
      for (const dsp of ["tract_voice", "ahh_choir", "dx7_alg5", "fm2op", "vp330", "hammond"]) {
        await seat(dsp);
        const r = await p.evaluate(() => {
          const t = document.querySelector("table.nu-knobs");
          const off = t ? [...t.querySelectorAll("input:disabled,select:disabled")] : [];
          const h3 = [...document.querySelectorAll("#app h3")].map((x) => x.textContent);
          return { has: !!t, silent: off.filter((c) => !c.dataset.why).length,
                   n: t ? t.querySelectorAll("input,select").length : 0,
                   heading: h3.includes("the mouth") ? "the mouth"
                     : h3.includes("the instrument") ? "the instrument" : null,
                   why: [...document.querySelectorAll("#app .nu-why")].map((w) => w.textContent).join(" | ") };
        });
        check(r.heading != null, "4 " + dsp + " draws a heading" + tag);
        check(r.silent === 0, "4 " + dsp + ": no silent grey (" + r.silent + ")" + tag);
        if (dsp === "ahh_choir")
          check(!r.has && /a recording has one breath in it/.test(r.why),
            "4 a sampled instrument says why there is nothing to turn" + tag);
        if (dsp === "vp330")
          check(/0\.4 dB across its whole range/.test(r.why),
            "4 the VP-330's silent breath control prints its number" + tag);
        if (dsp === "dx7_alg5")
          check(r.n === 1 && /114 of them/.test(r.why),
            "4 a DX7 is edited with its cartridges, and says so" + tag);
        if (dsp === "fm2op")
          check(r.n >= 9, "4 two-operator FM reaches " + r.n + " controls" + tag);
        if (dsp === "tract_voice") {
          const g = await p.evaluate(() => {
            const t = document.querySelector("table.nu-knobs");
            const off = [...t.querySelectorAll("input:disabled")].map((c) => c.dataset.k);
            return { off, n: t.querySelectorAll("input,select").length };
          });
          check(g.off.length >= 4 && g.off.some((k) => /^tongue/.test(k)),
            "4 the articulators are shut while the driver has them " + JSON.stringify(g.off) + tag);
        }
      }

      /* ---- 6 TEST THE ARTIFACT: a slider writes, and clearing DELETES -- */
      await seat("tract_voice");
      const wrote = await p.evaluate(() => {
        const r = document.querySelector('table.nu-knobs input[data-k^="breath#"]');
        const frozenBefore = document.querySelectorAll("[data-live] input,[data-live] select").length;
        r.value = String(+r.max);
        r.dispatchEvent(new Event("input", { bubbles: true }));
        r.dispatchEvent(new Event("change", { bubbles: true }));
        return { frozenBefore };
      });
      await p.waitForTimeout(600);
      const after = await p.evaluate(() => {
        const v = window.__eightDoc().voices.find((x) => x.kind === "line");
        return { set: v.set ? { ...v.set } : null,
                 live: document.querySelectorAll("[data-live] input,[data-live] select").length,
                 clear: !!document.querySelector('[data-k^="clear|"]') };
      });
      check(after.set && after.set.breath != null, "6 a slider writes voice.set " +
        JSON.stringify(after.set) + tag);
      check(after.live === 0 && wrote.frozenBefore === 0,
        "6b a slider is not a live surface — no control inside [data-live]" + tag);
      check(after.clear, "6c …and a set key offers `clear`" + tag);
      await p.evaluate(() => document.querySelector('[data-k^="clear|"]').click());
      await p.waitForTimeout(600);
      const gone = await p.evaluate(() => {
        const v = window.__eightDoc().voices.find((x) => x.kind === "line");
        return { set: v.set || null, has: !!(v.set && "breath" in v.set) };
      });
      check(!gone.has, "6d clearing DELETES the key, it does not zero it " +
        JSON.stringify(gone.set) + tag);

      /* ---- 6e THE VOWEL ROW ROUND-TRIPS ON THE PAGE ------------------- */
      await tab("cantor");
      const vow = await p.evaluate(async () => {
        const len = document.querySelector('input[data-k^="vowlen#"]');
        if (!len) return { err: "no vowlen input", ks: [...document.querySelectorAll("#app [data-k]")]
          .map((x) => x.dataset.k).slice(0, 12) };
        len.value = "3"; len.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      });
      await p.waitForTimeout(600);
      const vow2 = await p.evaluate(() => {
        const sels = [...document.querySelectorAll('select[data-sel^="vow"]')];
        if (sels.length > 1) { sels[1].value = "o";
          sels[1].dispatchEvent(new Event("change", { bubbles: true })); }
        return sels.length;
      });
      await p.waitForTimeout(600);
      const vow3 = await p.evaluate(() => {
        const v = window.__eightDoc().voices.find((x) => x.kind === "line");
        return { word: v.set && v.set.vowels,
                 sels: [...document.querySelectorAll('select[data-sel^="vow"]')].map((s) => s.value) };
      });
      /* 6f IS A CHECK ABOUT THE SCORE, so it looks at the score. `.nu-syll` is
         drawn by the deck (`#scoredeck`), which is the Score tab; read on the
         Band tab it was `undefined` every time. */
      await top("Score");
      vow3.line = await p.evaluate(() =>
        (document.querySelector(".nu-syll") || {}).textContent);
      await band();
      check(vow === true && vow2 >= 3 && vow3.word && vow3.word.length === 3 && vow3.word[1] === "o",
        "6e the vowel row round-trips: " + JSON.stringify(vow3.word) + " / " +
        JSON.stringify(vow3.sels) + " " + JSON.stringify(vow) + tag);
      check(vow3.line && vow3.line.indexOf(vow3.word[0]) > 0,
        "6f …and the score prints what it sings: " + JSON.stringify(vow3.line) + tag);


      /* ---- 11 THE PAD IS A SECOND VIEW OVER ONE STORE ----------------
         Paul, 2026-08-26: *"a nice radial graph structure for editing the
         voice"*, and the recipe's own gate for it: every spoke moves a
         parameter knobs.js measured as audible; dragging writes the same
         document values the numeric control does and they agree BOTH ways;
         with the stylesheet off every value is still readable and settable.

         NOT ONE GEOMETRY CONSTANT IS REPEATED HERE, and that is the whole
         design of this block. ui/eight.js owns the radii and the pad's frame;
         a test that re-typed 74 and 128 would pass forever after somebody
         moved them. So every assertion is read off the RENDERED picture — the
         two rings it actually drew and the face rect it actually drew — and
         the claim is that a value's place lands ON them. */
      await seat("tract_voice");
      // take the tongue by hand, which is the record's own escape from the
      // driver and the thing Paul could not find: it is the `babble` mode
      // menu, and it is what makes the pad live at all.
      await p.evaluate(() => { const s = document.querySelector('[data-k="sel|babble|cantor"]');
        if (s) { s.value = "hand"; s.dispatchEvent(new Event("change", { bubbles: true })); } });
      await p.waitForTimeout(600);
      /* …AND OPEN `artic`, WHICH IS THE SECOND HALF OF THE SAME FACT AND IS
         WORTH SEEING FAIL. A tube with nothing written on it answers `artic` 0,
         so on a BARE tract_voice every tongue knob is shut by the OTHER gate as
         well — "the tube is one uniform pipe until artic opens". The picture's
         own escape from that is the dot on the line, which is never gated;
         this drives the slider because the drag is what 11d is testing. */
      await p.evaluate(() => { const s = document.querySelector('input[data-k="artic#cantor"]');
        s.value = "0.5"; s.dispatchEvent(new Event("input", { bubbles: true }));
        s.dispatchEvent(new Event("change", { bubbles: true })); });
      await p.waitForTimeout(600);
      const pad0 = await p.evaluate(() => {
        const s = document.querySelector("svg.nu-pad");
        if (!s) return { has: false };
        const rings = [...s.querySelectorAll(".nu-pad-ring")].map((c) => +c.getAttribute("r")).sort((a, b) => a - b);
        const face = s.querySelector(".nu-pad-face");
        return { has: true, hidden: s.getAttribute("aria-hidden") === "true",
          controls: s.querySelectorAll("input,select,button,textarea,[tabindex]").length,
          inLive: !!s.closest("[data-live]"),
          spokes: [...s.querySelectorAll(".nu-pad-lab")].map((t) => t.textContent),
          rings, face: { x: +face.getAttribute("x"), w: +face.getAttribute("width"),
                         y: +face.getAttribute("y"), h: +face.getAttribute("height") },
          offSpokes: [...s.querySelectorAll(".nu-pad-knot.is-off")].length,
          offSliders: [...document.querySelectorAll("table.nu-knobs input:disabled")].length };
      });
      check(pad0.has, "11 a tube draws the pad" + tag);
      if (pad0.has) {
        const K11 = KN.voices.tract_voice;
        const audible = new Set(K11.rows.map((r) => r.key));
        const quiet = new Set(K11.quiet.map((q) => q.key));
        const bad = pad0.spokes.filter((k) => !audible.has(k) || quiet.has(k));
        check(pad0.spokes.length >= 8 && !bad.length,
          "11 every one of the " + pad0.spokes.length + " spokes is a MEASURED-AUDIBLE key " +
          JSON.stringify(bad) + tag);
        check(pad0.hidden && pad0.controls === 0 && !pad0.inLive,
          "11b the picture is not a control and not a live surface (aria-hidden " +
          pad0.hidden + ", " + pad0.controls + " controls)" + tag);

        /* 11c THE OTHER DIRECTION: move the SLIDER, and the knot lands on the
           ring the picture drew. Bottom of the row's range on the inner ring,
           top on the outer, halfway between them halfway along. */
        const spoke = pad0.spokes.find((k) => !["tongue", "tongueD"].includes(k)) || "fric";
        const row = K11.rows.find((r) => r.key === spoke);
        const rAt = async (v) => {
          await p.evaluate(([k, val]) => { const s = document.querySelector('input[data-k="' + k + '#cantor"]');
            s.value = String(val); s.dispatchEvent(new Event("input", { bubbles: true }));
            s.dispatchEvent(new Event("change", { bubbles: true })); }, [spoke, v]);
          await p.waitForTimeout(500);
          return p.evaluate((k) => { const s = document.querySelector("svg.nu-pad");
            const i = [...s.querySelectorAll(".nu-pad-lab")].findIndex((t) => t.textContent === k);
            const n = s.querySelectorAll(".nu-pad-knot")[i];
            const c = s.querySelector(".nu-pad-ring");
            const cx = +c.getAttribute("cx"), cy = +c.getAttribute("cy");
            return Math.hypot(+n.getAttribute("cx") - cx, +n.getAttribute("cy") - cy);
          }, spoke);
        };
        const lo = await rAt(row.min), hi = await rAt(row.max);
        const mid = await rAt(row.min + (row.max - row.min) / 2);
        const near = (a, b) => Math.abs(a - b) < 0.75;
        check(near(lo, pad0.rings[0]) && near(hi, pad0.rings[1]) &&
              near(mid, (pad0.rings[0] + pad0.rings[1]) / 2),
          "11c the slider moves the knot onto the rings the picture drew — " +
          spoke + " " + lo.toFixed(1) + "/" + mid.toFixed(1) + "/" + hi.toFixed(1) +
          " against " + pad0.rings.map((x) => x.toFixed(1)).join("/") + tag);

        /* 11d THIS direction: DRAG the pad's face and the two tongue sliders
           and the document all say the same number. Driven at the element's
           own on-screen point — `page.click()` scrolls its target into view
           first and has manufactured three false bug reports in this repo. */
        const geo = await p.evaluate(() => { const s = document.querySelector("svg.nu-pad");
          s.scrollIntoView({ block: "center" }); return null; });
        await p.waitForTimeout(300);
        const box = await p.evaluate(() => { const s = document.querySelector("svg.nu-pad");
          const r = s.getBoundingClientRect(), vb = s.viewBox.baseVal;
          return { x: r.left, y: r.top, kx: r.width / vb.width, ky: r.height / vb.height,
                   vx: vb.x, vy: vb.y }; });
        const on = (vx, vy) => ({ x: box.x + (vx - box.vx) * box.kx,
                                  y: box.y + (vy - box.vy) * box.ky });
        const F = pad0.face;
        const scrollWas = await p.evaluate(() => scrollY);
        const from = on(F.x + F.w * 0.5, F.y + F.h * 0.5);
        const to = on(F.x + F.w * 0.25, F.y + F.h * 0.75);
        await p.mouse.move(from.x, from.y);
        await p.mouse.down();
        await p.mouse.move(to.x, to.y, { steps: 6 });
        await p.mouse.up();
        await p.waitForTimeout(700);
        const agreed = await p.evaluate(() => {
          const v = window.__eightDoc().voices.find((x) => x.kind === "line");
          const s = (k) => document.querySelector('input[data-k="' + k + '#cantor"]');
          return { set: { tongue: v.set.tongue, tongueD: v.set.tongueD },
            sliders: { tongue: +s("tongue").value, tongueD: +s("tongueD").value },
            scroll: scrollY };
        });
        check(JSON.stringify(agreed.set) === JSON.stringify(agreed.sliders) &&
              Math.abs(agreed.set.tongue - 0.25) < 0.02 &&
              Math.abs(agreed.set.tongueD - 0.25) < 0.02,
          "11d a drag on the face writes the document and the sliders to the same " +
          "number " + JSON.stringify(agreed.set) + " / " + JSON.stringify(agreed.sliders) + tag);
        check(agreed.scroll === scrollWas,
          "11e …and the page did not move under the finger (" + scrollWas + ")" + tag);

        /* 11f A GATED DIMENSION READS AS GATED ON THE GRAPH TOO, which is the
           whole reason this picture exists: Paul read past four disabled
           sliders. Hand the tongue back to the driver and count. */
        await p.evaluate(() => { const s = document.querySelector('[data-k="sel|babble|cantor"]');
          s.value = "babble"; s.dispatchEvent(new Event("change", { bubbles: true })); });
        await p.waitForTimeout(600);
        const shut = await p.evaluate(() => {
          const s = document.querySelector("svg.nu-pad");
          const off = [...document.querySelectorAll("table.nu-knobs input:disabled")]
            .map((c) => (c.dataset.k || "").split("#")[0]);
          const spokes = [...s.querySelectorAll(".nu-pad-lab")].map((t) => t.textContent);
          const offSpokes = spokes.filter((k, i) =>
            s.querySelectorAll(".nu-pad-knot")[i].classList.contains("is-off"));
          const whys = [...s.parentElement.querySelectorAll(".nu-why")].map((w) => w.textContent);
          return { off, offSpokes, hand: s.querySelector(".nu-pad-hand").classList.contains("is-off"),
            web: s.querySelectorAll(".nu-pad-web line").length,
            said: whys.some((w) => /greyed here and in the table below/.test(w)) };
        });
        const shouldBeOff = shut.off.filter((k) => pad0.spokes.includes(k)).sort();
        check(JSON.stringify(shut.offSpokes.sort()) === JSON.stringify(shouldBeOff) &&
              shut.hand && shut.off.includes("tongue"),
          "11f every spoke the table greys is greyed on the graph too, and so is " +
          "the handle " + JSON.stringify(shut.offSpokes) + tag);
        check(shut.said && shut.web > 0,
          "11g …with the reason printed, and the driver's own territory drawn (" +
          shut.web + " segments)" + tag);

        /* 11h WITH THE STYLESHEET OFF. The picture is decoration; the eleven
           values are still readable and settable, because they are ranges with
           outputs in a table and always were. */
        const naked = await p.evaluate((keys) => {
          for (const s of [...document.querySelectorAll("link[rel=stylesheet],style")]) s.disabled = true;
          return keys.map((k) => {
            const r = document.querySelector('input[data-k="' + k + '#cantor"]');
            const o = r && r.nextElementSibling;
            return { k, range: !!r && r.type === "range", value: r ? r.value : null,
                     say: o && o.tagName === "OUTPUT" ? o.textContent : null,
                     named: !!(r && r.getAttribute("aria-label")) };
          });
        }, [...pad0.spokes, "tongue", "tongueD", "artic"]);
        const missing = naked.filter((x) => !x.range || !x.say || !x.named);
        check(!missing.length, "11h with the stylesheet off all " + naked.length +
          " of the pad's values are still readable and settable " +
          JSON.stringify(missing.map((x) => x.k)) + tag);
      }
      /* ---- 8 THE TEMPO ICONS ARE ABOUT TEMPO ------------------------- */
      // ...AND THEY ARE ON THE TEMPO TAB, which this never opened (see `top`).
      await top("Tempo");
      const t0 = await p.evaluate(() => ({ bpm: window.__eightDoc().time.bpm,
        rate: window.__eightDoc().time.rate,
        n: document.querySelectorAll('[data-k^="tempo-"]').length,
        tap: document.querySelectorAll('[data-k="tempo-tap"]').length,
        silent: [...document.querySelectorAll('[data-k^="tempo-"]')]
          .filter((x) => x.disabled && !x.dataset.why).length }));
      /* THIS READ `t0.n === 8`, "8 eight tempo icons", and it was right about
         the eight. Rewritten rather than loosened, 2026-09-02, because a NINTH
         mark joined them on the same keyspace and by Paul's own sentence:
         *"Tap tempo, the tempo editor appears."* (B7). `tempo-tap` wears the
         same plate and moves the same fact — `time.bpm`, through the slider's
         own key — so a census of "what moves the tempo here" must find it, and
         a count that excluded it would be a gate measuring yesterday's panel.
         Still an EXACT count and still the point: the eight operations drawn
         ONCE (they were drawn twice for one afternoon in August, panel and
         gutter both) plus the one tap, and no tenth. */
      check(t0.n === 9, "8 the eight tempo icons and the tap, drawn once " +
        "(" + t0.n + ")" + tag);
      check(t0.tap === 1, "8a …and exactly one of them is tap tempo" + tag);
      check(t0.silent === 0, "8b …and a refused one prints its reason" + tag);
      const press = async (w) => { await p.evaluate((k) => {
          const b2 = document.querySelector('[data-k="tempo-' + k + '"]');
          if (b2 && !b2.disabled) b2.click(); }, w);
        await p.waitForTimeout(600);
        return p.evaluate(() => ({ bpm: window.__eightDoc().time.bpm,
          rate: window.__eightDoc().time.rate,
          gbpm: (window.__eightGenres ? window.__eightGenres() : {}) })); };
      const faster = await press("a little faster");
      check(faster.bpm > t0.bpm, "8c `a little faster` moves the clock " +
        t0.bpm + " -> " + faster.bpm + tag);
      const half = await press("half time");
      check(half.rate === 0.5 && half.bpm === faster.bpm,
        "8d `half time` moves the READING and not the clock " + JSON.stringify(half) + tag);
      // THE WORD IS `default` SINCE 2026-08-26 (Paul: "'the record's own' --
      // make that 'default'"), and `data-k` on this row is "tempo-" + the word,
      // so the key this presses moved with the label.
      const own = await press("the default speed");
      check(own.rate == null, "8e …and there is a way back to the default" + tag);
      await band();   // and back to where the rest of this gate lives

      /* ---- 10 A TAKE CHANGES THE RENDERED SCORE ---------------------- */
      await tab("performance");
      const take = await p.evaluate(async () => {
        const abcOf = () => { const s = document.querySelector("[data-live=score] svg");
          return s ? s.outerHTML.length + "|" + (s.textContent || "").slice(0, 400) : ""; };
        const evOf = () => JSON.stringify(window.__eightSong ? window.__eightSong() : null);
        const r = document.querySelector('input[data-k="take"]');
        const was = { has: !!r, v: r && r.value };
        return { was, abc: abcOf(), ev: evOf() };
      });
      check(take.was.has, "10 there IS a take control on the page" + tag);
      const bumped = await p.evaluate(async () => {
        const r = document.querySelector('input[data-k="take"]');
        r.value = "7"; r.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((z) => setTimeout(z, 700));
        const g = window.__eightDoc();
        return { take: g.performance.take };
      });
      await p.waitForTimeout(500);
      const seeded = await p.evaluate(() => {
        const G = window.__eightGenres ? window.__eightGenres() : null;
        const ks = G ? Object.values(G).map((x) => x && x.kitSeed).filter((x) => x != null) : [];
        return { ks: ks.slice(0, 4), n: ks.length };
      });
      check(bumped.take === 7, "10b the take slider writes performance.take" + tag);
      check(seeded.n > 0 && new Set(seeded.ks).size === seeded.ks.length,
        "10c …and every section of the compiled record carries its own seed " +
        JSON.stringify(seeded) + tag);

      await ctx.close();
    }
    check(!errs.length, "zero console errors / pageerrors " + JSON.stringify(errs.slice(0, 3)));
    await b.close();
  }

  for (const n of notes) console.log(n);
  for (const f of fails) console.log(f);
  console.log(fails.length ? "\nFAILED " + fails.length + " of " +
    (fails.length + notes.length) : "\nALL PASS  " + notes.length + " checks");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
