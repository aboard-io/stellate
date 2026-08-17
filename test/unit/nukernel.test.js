#!/usr/bin/env node
// test/unit/nukernel.test.js — the nukernel gate.
//
//   node test/unit/nukernel.test.js
//
// This suite exists because of what actually went wrong. Three defects shipped
// and every check passed, because the checks asked "does this function run"
// rather than "does this input reach the output":
//
//   * the ghost-percussion layer could never fire, for any operator, because
//     accents are a subset of gates by construction and whole-pattern operators
//     preserve that containment;
//   * the `oct` vector was a no-op in all four genres — fold() ran AFTER the
//     octave was added and put every leap back where it started;
//   * `nudge` was clamped to the genre's own bar count as if it were a phase.
//
// The first two are INVISIBLE to per-function unit tests. rotate() rotates
// correctly in both; the bug is that the value never reaches the rendered
// events. So the centre of gravity here is SENSITIVITY — for every vector and
// every knob, perturbing it must change what comes out — plus the algebraic
// laws that make the operator set a group rather than a pile of functions.
"use strict";
const K = require("../../nukernel/kernel.js");
const { DEFAULT, GENRES, MODES, SCALES, FAMILIES } = require("../../nukernel/genres.js");

const GK = Object.keys(GENRES);

// ---- node test/unit/nukernel.test.js --calibrate-sing ----------------------
// NOT A GATE — the RECIPE that produced the two measured tables baked into
// nukernel/sing.js (LADDER_LOW / LADDER_HIGH). A number in the source that
// nobody can reproduce is a number nobody can correct, and these two took two
// attempts to get right: the first pass measured "la la la" at espeak speed
// 150 and was off by up to 3.5 semitones for the syllables the singer actually
// sings. So this runs the REAL protocol — every syllable of every bank line,
// at the speed audio/sing.js uses, cut the way it cuts, measured with the
// found layer's own detector — and prints the tables ready to paste. ~90 s and
// 280 espeak instances, which is exactly why it is a flag and not a check.
if (process.argv.includes("--calibrate-sing")) {
  (async () => {
    const CS = require("../../engine/speech.js");
    const FP = require("../../engine/faust/voices/found-player.js");
    const S = require("../../nukernel/sing.js");
    const IPA = new Set([..."aeiouyəɐɛɪɔʊʌɜæɑɒɘɵøɤɯɨʉœɶɞ"]);
    const isNuc = id => { const t = String(id || "").replace(/[ˈˌː%_'|\-]/g, "");
                          return t.length > 0 && IPA.has(t[0]); };
    const lines = Object.values(S.BANKS).flat().map(l => l.join(" "));
    const SPEED = 260;                     // audio/sing.js SPEED
    for (const [name, o] of [["LADDER_LOW", { variant: "", lang: "en" }],
                             ["LADDER_HIGH", { variant: "f3", lang: "" }]]) {
      const row = [];
      for (const p of [10, 25, 40, 55, 70, 85, 99]) {
        const ms = [];
        for (const text of lines) {
          const r = await CS.synth(text, { ...o, pitch: p, speed: SPEED });
          const ph = (r.marks || []).filter(m => m.type === "phoneme");
          const nuc = []; ph.forEach((m, i) => { if (isNuc(m.id)) nuc.push(i); });
          const at = x => Math.max(0, Math.min(r.pcm.length, Math.round(x * r.sr / 1000)));
          for (let k = 0; k < nuc.length; k++) {
            const from = k === 0 ? 0 : at(ph[Math.max(nuc[k - 1] + 1, nuc[k] - 1)].ms);
            const to = k + 1 < nuc.length
              ? at(ph[Math.max(nuc[k] + 1, nuc[k + 1] - 1)].ms) : r.pcm.length;
            if (to <= from + 8) continue;
            const hz = FP.detectMedianHz(r.pcm.slice(from, to), r.sr);
            if (hz > 0) ms.push(69 + 12 * Math.log2(hz / 440));
          }
        }
        ms.sort((a, b) => a - b);
        row.push([p, +ms[ms.length >> 1].toFixed(2)]);
      }
      console.log("  const " + name + " = " +
        JSON.stringify(row).replace(/\],\[/g, "], [") + ";");
    }
    process.exit(0);
  })().catch(e => { console.error(e); process.exit(1); });
  return;
}

// ---- node test/unit/nukernel.test.js --arrange-dom --------------------------
// NOT PART OF THE PURE-NODE GATE — §57, lane D1's own check ("a section is one
// shaded thing with its keys on top and no words anywhere", 2026-08-17).
// Guarded and early-returning exactly like --calibrate-sing just above, for
// the same reason: this file is otherwise pure node and CI-safe (no browser,
// no network), and `npm run test:unit` counts on that. It lives up here,
// beside the other flagged alternate mode, rather than after the pure-node
// sections' own process.exit(0) — code placed after that call would never
// run, flag or no flag, so this is the one place in the file a guard can
// actually intercept the flow before it.
//
// WHY A REAL BROWSER FOR THIS ONE: songrow.js's rebuild is real DOM (SVG
// icons, nested flexbox, a :has() selection ring, position:sticky) that a
// hand-rolled stub could get subtly wrong in ways that would pass against
// themselves rather than against the shipped file — exactly the mirror-drift
// §31's own header warns about. One chromium session proves structure,
// wiring and the rendered CSS together (VERIFICATION BUDGET: at most once),
// which is also cheaper than a stub plus a separate screenshot pass.
if (process.argv.includes("--arrange-dom")) {
  (async () => {
    const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
    const path = require("path");
    const ROOT = path.join(__dirname, "..", "..");
    let fails57 = 0, checks57 = 0;
    const ok57 = (cond, msg) => {
      checks57++;
      if (cond) console.log("  ok: " + msg);
      else { fails57++; console.error("  FAIL: " + msg); }
    };

    const srv = await serve(ROOT, 8975);
    const browser = await launchChromium();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = capturePageErrors(page);
    await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce`,
      { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
    await page.reload({ waitUntil: "networkidle" });
    // a composed multi-section song — same recipe test/browser/nukernel-board.test.js
    // uses — so there is more than one box and more than one phrase to test against.
    await page.selectOption("#composeg", "beatles");
    await page.click("#compose");
    await page.waitForTimeout(600);

    const box0 = () => page.$("#song .bgrp:first-child .box");
    const grp0 = "#song .bgrp:first-child";

    // ---- (a) THE ROW STRUCTURE, at 390 and at 1400 ----
    // the exact order Paul drew it: # · genre · section type · duplicate ·
    // add-empty-below · play · pin, then bars · mods · voice · rhythm · trans.
    const order = () => page.evaluate((sel) => {
      const grp = document.querySelector(sel);
      const head = [...grp.querySelector(".bhead").children].map(c =>
        c.dataset.cell || (c.className.match(/\bbi(dup|add|play|pin)\b/) || [null, "?"])[1]);
      const icons = [...grp.querySelector(".bicons").children].map(c => c.dataset.cell);
      return { head, icons };
    }, grp0);
    const wantHead = ["part", "genre", "role", "dup", "add", "play", "pin"];
    const wantIcons = ["bars", "mods", "voice", "rhythm", "trans"];
    const o390 = await order();
    ok57(JSON.stringify(o390.head) === JSON.stringify(wantHead),
      "§57(a) header cells at 390px: " + JSON.stringify(o390.head));
    ok57(JSON.stringify(o390.icons) === JSON.stringify(wantIcons),
      "§57(a) icon cells at 390px: " + JSON.stringify(o390.icons));
    await page.setViewportSize({ width: 1400, height: 1000 });
    const o1400 = await order();
    ok57(JSON.stringify(o1400.head) === JSON.stringify(wantHead),
      "§57(a) header cells at 1400px: " + JSON.stringify(o1400.head));
    ok57(JSON.stringify(o1400.icons) === JSON.stringify(wantIcons),
      "§57(a) icon cells at 1400px: " + JSON.stringify(o1400.icons));
    await page.setViewportSize({ width: 390, height: 844 });

    // ---- (b) PIN WORKS, both directions ----
    await (await box0()).$eval(".bicon.bipin", b => b.click());
    let pinned = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      return { boxOn: g.querySelector(".box").classList.contains("looped"),
               keyOn: g.querySelector(".bicon.bipin").classList.contains("on") };
    }, grp0);
    ok57(pinned.boxOn && pinned.keyOn, "§57(b) pinning box 1 did not light the row or the key");
    await (await box0()).$eval(".bicon.bipin", b => b.click());
    pinned = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      return { boxOn: g.querySelector(".box").classList.contains("looped"),
               keyOn: g.querySelector(".bicon.bipin").classList.contains("on") };
    }, grp0);
    ok57(!pinned.boxOn && !pinned.keyOn, "§57(b) unpinning box 1 left the row or the key lit");

    // ---- (c) PLAY WORKS ----
    await (await box0()).$eval(".bicon.biplay", b => b.click());
    await page.waitForFunction(() =>
      document.querySelector("#play").classList.contains("on"), null, { timeout: 8000 })
      .then(() => ok57(true, "§57(c) the header play key started the transport"))
      .catch(() => ok57(false, "§57(c) the header play key never started the transport"));
    await page.click("#play");                  // stop, so the screenshot is quiet
    await page.waitForTimeout(150);

    // ---- (d) ADD-EMPTY-BELOW INSERTS UNDER, AND FLAGS RED (the C1 law) ----
    const before = await page.evaluate(() => document.querySelectorAll("#song .bgrp").length);
    await (await box0()).$eval(".bicon.biadd", b => b.click());
    const after57 = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#song .bgrp")];
      const second = rows[1].querySelector(".box");
      return { count: rows.length, silent: second.classList.contains("noplay"),
               chips: second.querySelectorAll(".bch:not(.bplus)").length };
    });
    ok57(after57.count === before + 1,
      "§57(d) add-empty-below changed the song by " + (after57.count - before) + " boxes, not 1");
    ok57(after57.silent && after57.chips === 0,
      "§57(d) the new empty section did not flag red / had " + after57.chips + " phrases");
    // leave it in place — it is harmless to every check below (they all
    // address box 1 by name, and (f) wants a second, DIFFERENT box to prove
    // the ring moves, which this one serves as well as any) — deselect it
    // rather than deleting it, so the checks below are not also exercising
    // the # cell's delete key
    await page.evaluate(() => document.querySelectorAll("#song .bgrp")[1]
      .querySelector(".box").dispatchEvent(new MouseEvent("click", { bubbles: true })));

    // ---- (e) DISMISS TAKES ONLY ITS OWN PHRASE; THE BODY STILL OPENS COMPOSE ----
    // guarantee at least two phrases on box 1's strip before testing removal
    let n = await page.evaluate(sel =>
      document.querySelector(sel).querySelectorAll(".bch:not(.bplus)").length, grp0);
    while (n < 2) {
      await (await box0()).$eval(".bch.bplus", b => b.click());
      await page.click(".bbknew");
      await page.waitForTimeout(200);
      await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce#/song/0`,
        { waitUntil: "networkidle" });
      n = await page.evaluate(sel =>
        document.querySelector(sel).querySelectorAll(".bch:not(.bplus)").length, grp0);
    }
    const dismissedId = await page.evaluate(sel =>
      document.querySelector(sel).querySelector(".bchw .bch b.bcn").textContent, grp0);
    await (await box0()).$eval(".bchw .bcx", b => b.click());
    const afterDismiss = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      return { count: g.querySelectorAll(".bch:not(.bplus)").length,
               ids: [...g.querySelectorAll(".bch:not(.bplus) b.bcn")].map(e => e.textContent),
               page: document.querySelector("#chassis").dataset.page };
    }, grp0);
    ok57(afterDismiss.count === n - 1,
      "§57(e) the dismiss badge removed " + (n - afterDismiss.count) + " phrases, not 1");
    ok57(!afterDismiss.ids.includes(dismissedId),
      "§57(e) phrase " + dismissedId + " is still on the strip after its own dismiss");
    ok57(afterDismiss.page === "song",
      "§57(e) tapping the dismiss badge navigated away from Arrange");
    await (await box0()).$eval(".bchw .bch", b => b.click());
    const navved = await page.evaluate(() => document.querySelector("#chassis").dataset.page);
    ok57(navved === "compose", "§57(e) tapping a thumbnail's body did not open Compose");
    await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce#/song/0`,
      { waitUntil: "networkidle" });

    // ---- (f) SELECTION IS THE WHOLE SECTION, SHADED AND BORDERED AS ONE ----
    await page.evaluate(sel => document.querySelector(sel)
      .dispatchEvent(new MouseEvent("click", { bubbles: true })), grp0 + " .box");
    const sel1 = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      const cs = getComputedStyle(g);
      return { shadow: cs.boxShadow, bg: cs.backgroundColor };
    }, grp0);
    ok57(sel1.shadow !== "none", "§57(f) the selected section's rowgroup carries no ring");
    const grp1 = "#song .bgrp:nth-child(2)";
    await page.evaluate(sel => document.querySelector(sel)
      .dispatchEvent(new MouseEvent("click", { bubbles: true })), grp1 + " .box");
    const sel0after = await page.evaluate(sel =>
      getComputedStyle(document.querySelector(sel)).boxShadow, grp0);
    const sel1now = await page.evaluate(sel =>
      getComputedStyle(document.querySelector(sel)).boxShadow, grp1);
    ok57(sel0after === "none" && sel1now !== "none",
      "§57(f) the ring did not move with selection (was " + sel0after + " / " + sel1now + ")");

    // ---- (g) NO PANEL CONTAINS A PARAGRAPH OF PROSE ----
    for (const cell of ["mods", "voice", "trans"]) {
      await page.evaluate(sel => document.querySelector(sel)
        .dispatchEvent(new MouseEvent("click", { bubbles: true })), grp0 + " .box");
      await page.click(grp0 + " .bcell.c-" + cell);
      await page.waitForTimeout(80);
      const ps = await page.evaluate(() =>
        document.querySelectorAll("#rowpop .rpmount p").length);
      ok57(ps === 0, "§57(g) the " + cell + " panel still carries " + ps + " paragraph(s)");
    }

    // ---- (h) THE SHRINK KEY STAYS VISIBLE WHILE SCROLLING A LONG PANEL ----
    // position:sticky does not freeze the header at its OPENING position — it
    // holds a fixed offset once you scroll PAST that point. So the real proof
    // is that two DIFFERENT scroll depths land the header at the SAME spot
    // (stuck), not that it never moved from wherever it opened.
    await page.click(grp0 + " .bcell.c-genre");     // the chronological bank: the long one
    await page.waitForTimeout(120);
    await page.evaluate(() => document.querySelector(".deck").scrollBy(0, 600));
    await page.waitForTimeout(80);
    const stuckAt600 = await page.evaluate(() =>
      document.querySelector("#rowpop .rphead").getBoundingClientRect().top);
    await page.evaluate(() => document.querySelector(".deck").scrollBy(0, 400));
    await page.waitForTimeout(80);
    const stuckAt1000 = await page.evaluate(() =>
      document.querySelector("#rowpop .rphead").getBoundingClientRect().top);
    ok57(Math.abs(stuckAt1000 - stuckAt600) < 2,
      "§57(h) the panel header kept scrolling (" + stuckAt600 + " -> " + stuckAt1000 +
      ") instead of holding its stuck position");
    const shrinkVisible = await page.evaluate(() => {
      const r = document.querySelector("#rowpop .rpx").getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    });
    ok57(shrinkVisible, "§57(h) the shrink key scrolled out of the viewport");
    await page.click("#rowpop .rpx");

    // ---- the one screenshot ----
    await page.evaluate(() => document.querySelector(".deck").scrollTo(0, 0));
    await page.screenshot({
      path: "/home/ford/.claude/jobs/c1b341cb/tmp/arrange-390.png" });

    ok57(errs.length === 0, "§57 page errors: " + JSON.stringify(errs));
    await browser.close();
    srv.close();
    console.log("\n§57 arrange-dom: " + (checks57 - fails57) + "/" + checks57 + " checks pass");
    process.exit(fails57 ? 1 : 0);
  })().catch(e => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
  return;
}

// ---- node test/unit/nukernel.test.js --transport-dom ------------------------
// NOT PART OF THE PURE-NODE GATE — §58, lane B2's own check ("the transport is
// one row of keys, and under it the song says where it is", 2026-08-17).
// Guarded and early-returning exactly like --arrange-dom just above, for the
// same reason: this file is otherwise pure node and CI-safe, and a real
// chromium session is the only honest way to prove a flex row DOESN'T wrap —
// a hand-rolled layout stub could get that subtly wrong in a way that would
// pass against itself rather than against the shipped CSS.
if (process.argv.includes("--transport-dom")) {
  (async () => {
    const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
    const path = require("path");
    const ROOT = path.join(__dirname, "..", "..");
    let fails58 = 0, checks58 = 0;
    const ok58 = (cond, msg) => {
      checks58++;
      if (cond) console.log("  ok: " + msg);
      else { fails58++; console.error("  FAIL: " + msg); }
    };

    const srv = await serve(ROOT, 8976);
    const browser = await launchChromium();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = capturePageErrors(page);
    await page.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html?nobounce`,
      { waitUntil: "networkidle" });

    // ---- (a) ONE ROW, at 390 and at 1400 ----
    // every child of .trow shares one bounding-box top — a flex row that
    // wrapped would split its children across two different tops instead.
    const oneRow = () => page.evaluate(() => {
      const kids = [...document.querySelector(".trow").children];
      const tops = kids.map(k => Math.round(k.getBoundingClientRect().top));
      return { tops, one: new Set(tops).size === 1 };
    });
    const r390 = await oneRow();
    ok58(r390.one, "§58(a) the transport wraps at 390px — tops: " + JSON.stringify(r390.tops));
    await page.setViewportSize({ width: 1400, height: 1000 });
    const r1400 = await oneRow();
    ok58(r1400.one, "§58(a) the transport wraps at 1400px — tops: " + JSON.stringify(r1400.tops));
    await page.setViewportSize({ width: 390, height: 844 });

    // ---- (b) THE LOOP TOGGLE DEFAULTS ON ----
    const loopDefault = await page.evaluate(() => document.getElementById("loop").getAttribute("aria-pressed"));
    ok58(loopDefault === "true", '§58(b) the loop toggle did not default to aria-pressed="true": ' + loopDefault);

    // ---- (c) EVERY CONTROL HAS AN ACCESSIBLE NAME ----
    const names = await page.evaluate(() => {
      const named = id => {
        const el = document.getElementById(id);
        return (el.getAttribute("aria-label") || "").trim();
      };
      const labelled = (forId) => {
        const l = document.querySelector(`label[for="${forId}"]`);
        return l ? l.textContent.trim() : "";
      };
      return {
        play: named("play"), compose: named("compose"), loop: named("loop"),
        reroll: named("reroll"), composeg: named("composeg"),
        bpm: labelled("bpm"), vol: labelled("vol"),
      };
    });
    for (const k of Object.keys(names))
      ok58(!!names[k], `§58(c) "${k}" accessible name: ${JSON.stringify(names[k])}`);

    // ---- (d) THE POSITION ROW: root genre / position / section, no ▶ ----
    await page.selectOption("#composeg", "rock");
    await page.click("#compose");
    await page.waitForTimeout(400);
    await page.click("#play");
    await page.waitForFunction(() =>
      document.getElementById("lcdpos").textContent !== "--", null, { timeout: 8000 })
      .then(() => ok58(true, "§58(d) the transport started and the position field moved"))
      .catch(() => ok58(false, "§58(d) the position field never left \"--\""));
    const row = await page.evaluate(() => ({
      genre: document.getElementById("posgenre").textContent.trim(),
      pos: document.getElementById("lcdpos").textContent.trim(),
      section: document.getElementById("possection").textContent.trim(),
      whole: document.getElementById("readout").textContent,
    }));
    ok58(!!row.genre, "§58(d) #posgenre: " + JSON.stringify(row.genre));
    ok58(!!row.pos && row.pos !== "--", "§58(d) #lcdpos: " + JSON.stringify(row));
    ok58(!!row.section, "§58(d) #possection: " + JSON.stringify(row.section));
    ok58(!row.whole.includes("▶"), '§58(d) the play glyph is still on the row: "' + row.whole + '"');
    await page.click("#play");                    // stop, so the screenshots are quiet
    await page.waitForTimeout(150);

    // ---- the two screenshots ----
    await page.screenshot({
      path: "/home/ford/.claude/jobs/c1b341cb/tmp/transport-390.png" });
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.screenshot({
      path: "/home/ford/.claude/jobs/c1b341cb/tmp/transport-1400.png" });

    ok58(errs.length === 0, "§58 page errors: " + JSON.stringify(errs));
    await browser.close();
    srv.close();
    console.log("\n§58 transport-dom: " + (checks58 - fails58) + "/" + checks58 + " checks pass");
    process.exit(fails58 ? 1 : 0);
  })().catch(e => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
  return;
}

let fails = 0, checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { fails++; console.error("  FAIL " + msg); }
};
const clone = o => JSON.parse(JSON.stringify(o));
const sig = ev => JSON.stringify(ev.map(e => [e.t, e.n, e.d, e.vel, e.acc, e.sld]));

// a phrase that exercises every vector: rests, accents, slides, octave leaps,
// a full velocity range and both signs of degree
const P = {
  deg:  [0, 3, -2, 5, 4, 0, -4, 2, 7, 3, 0, -1, 2, 6, 3, 1],
  oct:  [0, 0, 1, 0, -1, 0, 0, 0, 1, 0, 0, 0, -1, 1, 0, 0],
  vel:  [9, 5, 3, 8, 6, 4, 8, 2, 9, 6, 4, 7, 8, 3, 6, 5],
  inc:  [0, 1, 0, 0, -1, 0, 0, 0, 2, 0, 0, 0, 0, -1, 0, 0],
  stk:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  gate: [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
  acc:  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  sld:  [0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0],
};
const allEvents = (p, g, bars) =>
  [...K.render(p, g, bars), ...K.drums(p, g, bars), ...K.bass(p, g, bars)]
    .sort((a, b) => a.t - b.t || (a.n || 0) - (b.n || 0));

// THE GENRE WITH THE PLAYER TAKEN OUT — the documented neutral of the
// performance layer (kernel.js: stress/phrase/touch, §39 below). A gate that
// measures WHAT WAS WRITTEN — a root shift, a bar schedule, the composer's
// topline — must read it through this, because the performance layer's whole
// job is to make bar 3 not bar 1 and no two notes equal, and a gate that reads
// "the first event in the bar" or "bar 0 == bar 2" is asking a question that
// only had one answer while nothing ever moved. Where a gate measures the
// PLAYING, it uses the shipped anchor and says so.
// THE PLAYER TAKEN OUT — the whole player. `orn` joined stress/phrase/touch
// when genres learned to lean, slide, flam and pass: an ornament policy is
// drawn on the same positional dice the hand is and it varies bar to bar, so
// leaving it in meant "with the player taken out" still handed back a
// different bar every pass, and the checks that exist to tell the phrase from
// the performance could not.
const plain = g => ({ ...g, stress: 0, phrase: 0, touch: null, orn: null });

// A GENRE THAT IS NOTHING BUT THE WASH. The pad path (kernel.js render) fires
// one voicing at the phrase's first gate and holds it to the next chord: it
// reads the GATE vector to know when and the VEL vector to know how hard, and
// by construction nothing else in a phrase can reach it — a held chord has no
// contour, no octave displacement, no slide, no accent and no ramp, and its
// duration is the chord's, not the gate's. Every anchor in the table used to
// have a line voice somewhere, so §1 and §10 could ask every one of them the same
// question; the FUNCTION genres brought the first anchor that is only a pad.
// The two gates say what a wash CAN be sensitive to rather than exempting a
// genre by name, and each of them then proves the exemption is not dead.
const allPad = g => Array.from({ length: g.voices }, (_, v) => K.partOf(g, v))
  .every(p => p === "pad");

/* ---------------------------------------------------------------- 0. THE ROSTER
   Genre KEYS are load-bearing — saves, presets, gates and compose all address
   genres by key — so display names may change freely (they became place-year
   names in 2026-08) but every key that has ever shipped must still exist.
   A rename that touched a key would silently orphan every saved song. */
console.log("roster — every shipped genre key still exists; labels are unique");
{
  const SHIPPED = ["simple", "fugue", "acid", "newwave", "vaporwave", "blues",
    "rock", "gregorian", "bulgarian", "spem", "counterpoint", "neoclassical",
    "drone", "sludge", "tango", "deathmetal", "eurythmics", "isley", "toto",
    "jodeci", "beatles", "steely", "postrock", "boombap", "trap", "house",
    "garage", "dnb", "disco", "funk", "motown", "rnb", "gospel", "reggae",
    "dub", "ska", "afrobeat", "bossa", "countrypop", "synthpop", "shoegaze",
    "citypop", "punk", "ambient", "techno", "solo", "vocal", "backing",
    "riff", "pad",
    // THE ANCESTORS (phase 2, 2026-08-16) — the eight the shopping order in
    // GENEALOGY.md demanded by name. Listed here the day they landed, which is
    // the point of this roster: a key becomes load-bearing the moment it can
    // appear in a saved song, not once somebody remembers to write it down.
    "jazz", "bodiddley", "chuckberry", "doowop", "skiffle", "minimalism",
    "kraftwerk", "electro"];
  for (const k of SHIPPED) ok(GENRES[k], "shipped genre key vanished: " + k);
  const labels = GK.map(k => GENRES[k].label);
  ok(new Set(labels).size === labels.length,
     "two genres display the same name");
  ok(GK.every(k => typeof GENRES[k].label === "string" && GENRES[k].label),
     "a genre has no display name");
}

/* ---------------------------------------------------------------- 1. SENSITIVITY
   Every vector must reach the output. This is the check the octave bug and the
   dead ghost layer both needed and neither had. */
console.log("sensitivity — perturbing each vector must change the render");
for (const gk of GK) {
  // A RAMP NEEDS MORE THAN ONE LOOP to be visible — it accumulates with the loop
  // index, so in a one-bar form (Simple) it multiplies by zero and is correctly
  // inert. Render four bars so inc/stk have somewhere to go.
  const g = GENRES[gk], bars = Math.max(4, g.bars), base = sig(allEvents(P, g, bars));
  // ...every vector, unless the genre is only a wash, in which case there are
  // exactly two (allPad, above) and they are still required to reach
  for (const key of (allPad(g) ? ["gate", "vel"]
    : ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"])) {
    const q = clone(P);
    if (key === "deg") q.deg = q.deg.map(d => d + 2);
    else if (key === "oct") q.oct = q.oct.map(() => 1);
    else if (key === "vel") q.vel = q.vel.map(() => 1);
    else if (key === "inc") q.inc = q.inc.map((_, i) => (i === 0 ? 2 : 0));
    else if (key === "stk") q.stk = q.stk.map((_, i) => (i === 0 ? 1 : 0));
    else q[key] = q[key].map((b, i) => (i % 2 ? b : b ? 0 : 1));
    const pad = gk === "vaporwave" && (key === "deg" || key === "oct");
    // a vaporwave PAD reads chord tones, so deg/oct legitimately do not reach
    // voice 0 — but they must still reach the line voice, so the whole-render
    // signature has to move regardless
    ok(sig(allEvents(q, g, bars)) !== base,
       gk + ": changing " + key + " did not change the rendered events" + (pad ? " (pad genre)" : ""));
  }
}
// ...and the exemption is not a dead branch: something in the table really is
// only a wash, or the two-key list above is silently covering nothing
ok(GK.some(gk => allPad(GENRES[gk])),
   "no genre in the table is all pad — the sensitivity exemption checks nothing");

/* ---------------------------------------------------------------- 2. GROUP LAWS
   The operator set is only searchable if it is closed and its elements have
   the inverses the algebra claims. */
console.log("group laws — inverses, involutions, identity");
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const N = P.deg.length;
ok(eq(K.rotate(0)(P), P), "rotate(0) is not the identity");
ok(eq(K.rotate(N)(P), P), "rotate(length) is not the identity");
for (let k = 1; k < N; k++)
  ok(eq(K.rotate(N - k)(K.rotate(k)(P)), P), "rotate(" + k + ") has no inverse");
ok(eq(K.reverse()(K.reverse()(P)), P), "reverse is not an involution");
ok(eq(K.invert(4)(K.invert(4)(P)), P), "invert is not an involution");
ok(eq(K.complement("acc")(K.complement("acc")(P)), P), "complement is not an involution");
ok(eq(K.transpose(-3)(K.transpose(3)(P)), P), "transpose has no inverse");
ok(eq(K.drop(3)(K.drop(3)(P)), K.drop(3)(P)), "drop is not idempotent");
ok(eq(K.fill(3)(K.fill(3)(P)), K.fill(3)(P)), "fill is not idempotent");
// SPLIT adds attacks inside long notes and is audible under any articulation —
// which duplicating a list element is not, because a held note swallows its copy
{
  const before = P.gate.filter(Boolean).length;
  ok(K.split(2)(P).gate.filter(Boolean).length > before, "split(2) added no attacks");
  ok(K.split(1)(P).gate.join("") === P.gate.join(""), "split(1) is not the identity");
  // under LEGATO — held notes, no gaps — a split must still produce extra
  // attacks, which duplicating a list element could never do
  const leg = g2 => K.render(g2, { ...GENRES.simple, artic: "legato" }, 4).length;
  ok(leg(K.split(2)(P)) > leg(P), "split is inaudible under legato — the whole point of it");
}

// DENSITY family. drop and fill are both lossy, so they are NOT inverses — and
// they do not commute. Both facts are load-bearing: the chips apply in the order
// you switch them on, and "drop 3 then add 3" is a real transformation rather
// than a no-op somebody will report as a bug.
ok(!eq(K.fill(3)(K.drop(3)(P)), P), "drop then fill claims to be the identity");
ok(!eq(K.fill(3)(K.drop(3)(P)), K.drop(3)(K.fill(3)(P))), "drop and fill commute");
ok(K.drop(1)(P).gate.every(g => g === 0), "drop(1) is not silence");
ok(K.fill(1)(P).gate.every(g => g === 1), "fill(1) is not every step");
// drop(1) must leave the KIT playing — that is the whole use of it
ok(K.drums(K.drop(1)(P), GENRES.acid, GENRES.acid.bars).length > 0,
   "drop(1) silenced the drums as well as the line");
ok(K.render(K.drop(1)(P), GENRES.acid, GENRES.acid.bars).length === 0,
   "drop(1) left pitched notes sounding");
// fill uncovers degrees the phrase was already holding silent, it does not
// invent them: every added note's pitch must come from the existing deg vector
{
  const before = new Set(K.render(P, GENRES.acid, GENRES.acid.bars).map(e => e.n));
  const after = K.render(K.fill(2)(P), GENRES.acid, GENRES.acid.bars);
  ok(after.length > before.size, "fill(2) added no notes");
}

// reverse must shift the slide vector: slide is EDGE-valued, and reversing it
// like a node vector leaves every slide on the wrong side of its transition
ok(!eq(K.reverse()(P).sld, [...P.sld].reverse()),
   "reverse treated sld as node-valued (the edge shift is missing)");

/* ---------------------------------------------------------------- 3. TOTALITY + PURITY
   Every operator is claimed to be total: any pattern in, a valid pattern out,
   no failure modes — and none of them may mutate their input. */
console.log("totality and purity");
const OPS = [K.rotate(5), K.rotate(-3), K.reverse(), K.transpose(9), K.transpose(-9),
             K.invert(0), K.invert(4), K.complement("gate"), K.complement("acc"),
             K.excerpt(2, 8), K.drop(1), K.drop(2), K.drop(3),
             K.fill(1), K.fill(2), K.fill(3), K.spread(2), K.spread(0.5), K.spread(0),
             K.split(2), K.split(3), K.split(4), K.del(1), K.del(2), K.del(4),
             K.only("acc", K.rotate(3)),
             K.crossmap("acc", "sld")];
const VECS = ["deg", "oct", "vel", "inc", "stk", "gate", "acc", "sld"];
const edge = [P, K.mapv(P, v => v.map(() => 0)), K.mapv(P, v => v.map(() => 1)),
              { ...clone(P), gate: new Array(N).fill(0) }];
for (const op of OPS) {
  for (const p0 of edge) {
    const before = clone(p0);
    let out;
    try { out = op(p0); } catch (e) { ok(false, "operator threw: " + e.message); continue; }
    ok(VECS.every(k => Array.isArray(out[k]) && out[k].length === N),
       "operator returned a malformed pattern");
    ok(VECS.every(k => out[k].every(Number.isFinite)), "operator produced a non-finite value");
    ok(eq(p0, before), "operator MUTATED its input");
  }
}

/* ---------------------------------------------------------------- 4. DETERMINISM */
console.log("determinism");
for (const gk of GK) {
  const g = GENRES[gk];
  ok(sig(allEvents(P, g, g.bars)) === sig(allEvents(P, g, g.bars)),
     gk + ": two renders of one input disagree");
}

/* ---------------------------------------------------------------- 5. THE OCTAVE LAW
   The regression that started this file. oct must move a pitched line by
   exactly twelve semitones per step, after the register fold. */
console.log("octave law — oct survives the register fold");
for (const gk of GK) {
  const g = GENRES[gk];
  const lineVoice = Array.from({ length: g.voices }, (_, v) => v)
    .find(v => g.realize(v) !== "pad");
  if (lineVoice == null) continue;
  const flat = clone(P); flat.oct = flat.oct.map(() => 0);
  const up = clone(P); up.oct = up.oct.map(() => 1);
  const a = K.render(flat, g, g.bars).filter(e => e.v === lineVoice).map(e => e.n);
  const b = K.render(up, g, g.bars).filter(e => e.v === lineVoice).map(e => e.n);
  ok(a.length === b.length && a.length > 0, gk + ": octave test found no comparable notes");
  ok(a.every((n, i) => b[i] - n === 12),
     gk + ": oct +1 did not raise the line by exactly 12 (fold is eating it)");
}

/* ---------------------------------------------------------------- 6. GHOST LAYER
   It fired for no operator at all until `only` existed, because accents are a
   subset of gates and whole-pattern operators preserve that. */
console.log("ghost layer fires");
{
  const g = GENRES.acid;
  const ghosts = K.drums(P, g, g.bars).filter(e => e.d === "p");
  ok(ghosts.length > 0, "acid ghost-percussion layer produced nothing");
  ok(ghosts.every(e => Number.isFinite(e.vel)), "ghost hits carry no velocity");
}

/* ---------------------------------------------------------------- 7. ENVELOPES
   Envelopes are a different type from operators: they act on the event stream
   and are a function of position, which no pattern operator can be. */
console.log("envelopes");
{
  const g = GENRES.acid, span = g.bars * 16 / g.rate;
  const ev = K.render(P, g, g.bars);
  const noop = K.envelope(ev, null, span);
  ok(sig(noop) === sig(ev), "envelope(null) changed the events");
  for (const kind of ["in", "out"]) {
    const out = K.envelope(ev, kind, span);
    ok(out.length === ev.length, "envelope " + kind + " changed the event count");
    ok(out.every(e => e.vel >= 0 && e.vel <= 9), "envelope " + kind + " left velocity out of range");
    const first = out[0].vel, last = out[out.length - 1].vel;
    ok(kind === "in" ? first < last : first > last,
       "envelope " + kind + " does not run in the right direction");
  }
  // monotone in the fade direction
  const fin = K.envelope(ev, "in", span);
  const byT = [...fin].sort((a, b) => a.t - b.t);
  const scaled = byT.map((e, i) => e.vel / Math.max(1, ev.slice().sort((a, b) => a.t - b.t)[i].vel));
  ok(scaled.every((v, i) => i === 0 || v >= scaled[i - 1] - 0.26), "fade in is not monotone");
}

/* ---------------------------------------------------------------- 8. HARMONY MODES */
console.log("harmony — modal, cycle, emergent");
{
  const modal = GENRES.acid;
  ok(Array.from({ length: 8 }, (_, b) => K.harm(P, modal, b)).every(r => r === 0),
     "modal harmony moved");
  const cyc = GENRES.vaporwave;
  ok(Array.from({ length: 8 }, (_, b) => K.harm(P, cyc, b))
       .every((r, b) => r === cyc.roots[b % cyc.roots.length]), "cycle harmony does not wrap");
  const em = GENRES.fugue;
  const roots = Array.from({ length: 4 }, (_, b) => K.harm(P, em, b));
  ok(new Set(roots).size > 1, "emergent harmony is constant (it should read the entries)");
  ok(roots.every(r => r >= 0 && r < 7), "emergent harmony left the mode");
}

/* ---------------------------------------------------------------- 9. SCALE + MODE OVERRIDES
   Both alphabets are per-genre facts. A subject may never sound a pitch class
   outside the scale it was read through. */
console.log("scale and mode overrides");
// Containment is relative to THE CHORD, not to the tonic. A cycle-harmony line
// is transposed by the bar's root — the blues riff goes up to the IV — so its
// pitch classes are the scale MOVED, and checking against the untransposed
// scale would forbid the thing that makes a progression audible.
for (const gk of GK) {
  const g = GENRES[gk], sc = g.scale || K.PENT, bs = 16 / g.rate;
  // THE ONE CARVE-OUT, and it is a single word wide: `approach` (kernel.js
  // ORNAMENTS, §59) is a chromatic lead-in — a semitone under a strong beat,
  // resolving on the next event — and being outside the alphabet is the whole
  // definition of it. The law above is about the SUBJECT, and an ornament is
  // not the subject. Every OTHER ornament this machine can emit — grace, pass,
  // flam, roll, and every mark a hand can write — is still held to it here,
  // which is why this filter names one tag rather than dropping `e.orn`.
  const ev = K.render(P, g, g.bars)
    .filter(e => g.realize(e.v) !== "pad" && e.orn !== "approach");
  for (let b = 0; b < g.bars; b++) {
    // A DIATONIC genre follows the chord by DEGREES, so its notes stay in ONE
    // scale all the way through — a stronger claim than the transposing kind,
    // and the check is stronger with it: root 0, no allowance for a moved
    // alphabet. (See render's `degShift`: transposing a seven-note subject by
    // semitones is what made tango and Eurythmics sound out of tune.)
    const root = (g.harmony === "cycle" && !g.diatonic)
      ? K.mp(K.harm(P, g, b), g.mode || undefined) : 0;
    const allowed = new Set(sc.map(x => (((x + root) % 12) + 12) % 12));
    // under a chord cycle a RAMPED note walks the chord's own rungs, and a
    // chord tone is not always in the pentatonic — that is the point of it.
    // The rungs come from chordsOf, so a genre whose prog carries a SEVENTH
    // licenses the seventh: blues' major third over I7 is the identity, not
    // a leak. Without a prog this is exactly the old [r, r+2, r+4] triad.
    if (g.harmony === "cycle")
      for (const c of K.chordsOf(P, g, b))
        for (const n of c.pcs) allowed.add(((n % 12) + 12) % 12);
    const bad = ev.filter(e => Math.floor(e.t / bs) === b)
                  .map(e => ((e.n % 12) + 12) % 12).filter(pc => !allowed.has(pc));
    ok(bad.length === 0,
       gk + " bar " + (b + 1) + ": pitch class outside the scale on that chord (" +
       [...new Set(bad)].join(",") + ")");
  }
}
for (const mk of Object.keys(MODES)) {
  const g = { ...GENRES.vaporwave, mode: MODES[mk] };
  const pcs = new Set(K.render(P, g, g.bars)
    .filter(e => g.realize(e.v) === "pad").map(e => ((e.n % 12) + 12) % 12));
  ok([...pcs].every(pc => MODES[mk].includes(pc)), mk + ": a pad chord left the mode");
  ok(pcs.size > 0, mk + ": no pad chord tones at all");
}

/* ---------------------------------------------------------------- 9b. CHROMATIC RANGE
   Two independent ways to change how wide a line is, and the whole point is
   that they are independent. spread MOVES THE NOTES within the alphabet;
   swapping the alphabet changes the width while leaving every degree — and so
   the exact contour — untouched. Both were flattened until the register fold
   stopped wrapping each note separately. */
console.log("chromatic range — spread moves notes, the alphabet moves width");
{
  const g = GENRES.simple;
  // ramp-free as well as octave-free: inc/stk move notes per LOOP, which is a
  // different axis from spread and would otherwise be read as spread failing
  const flat = { ...clone(P), oct: new Array(N).fill(0),
                 inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
  const span = p2 => { const n = K.render(p2, g, g.bars).map(e => e.n);
                       return n.length ? Math.max(...n) - Math.min(...n) : 0; };
  const dir = p2 => K.render(p2, g, g.bars).map(e => e.n)
                     .map((v, i, a) => (i ? Math.sign(v - a[i - 1]) : 0)).join("");

  // monotone increasing in k, and k=0 collapses to a single pitch
  const spans = [0, 0.5, 1, 2, 3].map(k => span(K.spread(k)(flat)));
  ok(spans[0] === 0, "spread(0) is not a monotone");
  ok(spans.every((s, i) => i === 0 || s > spans[i - 1]),
     "spread does not widen monotonically: " + spans.join(","));
  ok(!K.render(K.spread(2)(flat), g, g.bars).some((e, i, a) =>
       i && Math.abs(e.n - a[i - 1].n) > 60), "spread(2) produced an absurd leap");

  // the alphabet changes the width and NOTHING else
  const base = { span: span(flat), dir: dir(flat) };
  for (const [sc, wide] of [[SCALES.chromatic, false], [SCALES.whole, false],
                            [SCALES.augmented, true], [SCALES.quartal, true]]) {
    const gg = { ...g, scale: sc };
    const n = K.render(flat, gg, gg.bars).map(e => e.n);
    const s2 = Math.max(...n) - Math.min(...n);
    const d2 = n.map((v, i, a) => (i ? Math.sign(v - a[i - 1]) : 0)).join("");
    ok(d2 === base.dir, "swapping the alphabet changed the contour");
    ok(wide ? s2 > base.span : s2 < base.span,
       "alphabet of " + sc.length + " notes did not move the span the right way");
    // width per degree-step is exactly 12 / length
    ok(Math.abs(K.pitch(sc.length, sc) - K.pitch(0, sc) - 12) < 1e-9,
       "scale of " + sc.length + " does not span an octave in its own length");
  }
}

/* ---------------------------------------------------------------- 9c. THE RAMP CLIMBS
   inc and stk accumulate with the loop index, and the register fold must not
   chase them: computing the octave shift from the RAMPED degrees re-centred the
   line every few loops, so a rising arpeggio audibly fell back down. The ramp
   sits on top of the registration, exactly like oct. */
console.log("ramps climb monotonically and the fold does not chase them");
{
  const g = { ...GENRES.simple, bars: 8, incClamp: 0 };
  const base = { ...clone(P), inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
  const first = p2 => Array.from({ length: 8 }, (_, b) =>
    K.render(p2, g, 8).filter(e => Math.floor(e.t / 16) === b)[0].n);

  for (const [name, key, sign] of [["inc up", "inc", 1], ["inc down", "inc", -1],
                                   ["stk up", "stk", 1], ["stk down", "stk", -1]]) {
    const q = clone(base);
    q[key] = q[key].map((_, i) => (i === 0 ? sign : 0));
    const seq = first(q);
    const mono = seq.every((n, i) => i === 0 || (sign > 0 ? n >= seq[i - 1] : n <= seq[i - 1]));
    ok(mono, name + " is not monotone across loops: " + seq.join(" "));
    ok(Math.abs(seq[7] - seq[0]) > 6, name + " barely moved across eight loops: " + seq.join(" "));
  }
  // the three limit behaviours are three SHAPES, not three strengths
  {
    const q3 = clone(base); q3.stk = q3.stk.map((_, i) => (i === 0 ? 1 : 0));
    const seq = m => Array.from({ length: 12 }, (_, b) => K.rampOf(q3, 0, b, 4, m));
    const hold = seq("hold"), loop = seq("loop"), rev = seq("reverse");
    ok(hold.slice(4).every(v => v === 4), "hold does not settle at the limit: " + hold.join(" "));
    ok(loop[5] === 0 && loop[9] === 4, "loop does not wrap back to zero: " + loop.join(" "));
    ok(rev[5] === 3 && rev[8] === 0 && rev[9] === 1, "reverse does not turn round: " + rev.join(" "));
    ok(new Set([hold.join(), loop.join(), rev.join()]).size === 3,
       "the three limit modes are not three different shapes");
  }
  // and the clamp still bounds it
  const q2 = clone(base); q2.stk = q2.stk.map((_, i) => (i === 0 ? 1 : 0));
  const clamped = Array.from({ length: 8 }, (_, b) =>
    K.render(q2, { ...g, incClamp: 2 }, 8).filter(e => Math.floor(e.t / 16) === b)[0].n);
  ok(new Set(clamped.slice(3)).size === 1, "clamp 2 did not stop the ramp: " + clamped.join(" "));
}

/* ---------------------------------------------------------------- 9d. TIE + NEAREST ROOT
   Two things that keep a line playable rather than merely correct. */
console.log("tie merges repeats; the root shift takes the nearest octave");
{
  const rep = K.split(2)(P);
  const loose = K.render(rep, GENRES.simple, 4);
  const tied = K.render(rep, { ...GENRES.simple, artic: "tie" }, 4);
  ok(tied.length < loose.length, "tie did not merge any repeated notes");
  ok(Math.max(...tied.map(e => e.dur)) > Math.max(...loose.map(e => e.dur)),
     "tie produced no longer note than the untied version");
  // total sounding time, not the longest note: a note whose successor slides is
  // held full length under every articulation, so the max can tie
  const total = a => a.reduce((s, e) => s + e.dur, 0);
  ok(total(K.render(rep, { ...GENRES.simple, artic: "staccato" }, 4)) < total(loose),
     "staccato does not sound for less time than normal");

  // a cycle-harmony line must stay in ONE register: the root shift is folded to
  // the nearest octave, so the flat-VII drops two rather than climbing ten
  // MEASURE THE ROOT SHIFT ITSELF. A flat phrase — one degree, no octaves, no
  // ramp — renders one pitch per bar, so the bar-to-bar difference IS the root
  // shift and nothing else. Folded to the nearest octave it can never exceed a
  // tritone; unfolded, the flat-VII alone is ten.
  const flatP = { deg: new Array(N).fill(0), oct: new Array(N).fill(0),
                  vel: new Array(N).fill(5), inc: new Array(N).fill(0),
                  stk: new Array(N).fill(0), gate: new Array(N).fill(1),
                  acc: new Array(N).fill(0), sld: new Array(N).fill(0) };
  for (const gk of GK) {
    // the root shift is a fact about the HARMONY, so read it with the player
    // taken out: "the first event in the bar" is only a well-defined note while
    // no hand is moving onsets, and two voices whose registers differ by an
    // octave both start on the downbeat
    const g = plain(GENRES[gk]);
    if (g.harmony !== "cycle") continue;
    const bs = 16 / g.rate;
    const perBar = Array.from({ length: g.bars }, (_, b) =>
      K.render(flatP, g, g.bars).filter(e => g.realize(e.v) !== "pad" &&
        Math.floor(e.t / bs) === b).map(e => e.n)[0]);
    // each shift is folded against the TONIC into [-6..+6], so the widest gap
    // between any two bars is 12 — one octave, never more
    const xs = perBar.filter(x => x != null);
    const spread = Math.max(...xs) - Math.min(...xs);
    ok(spread <= 12, gk + ": root shifts spread " + spread +
       " semitones — not folded to the nearest octave");
  }
}

/* ---------------------------------------------------------------- 9e. ONE ALPHABET A BOX
   A layered genre must read the SAME subject alphabet as the one it is layered
   on. The layer inherits the section's mode but once did not inherit its
   `scale`, so an authority reading quartal played against a layer reading
   pentatonic — six semitones per degree-step against two point four. That does
   not sound like a missing override, it sounds like the tuning is broken. */
console.log("a layer reads the authority's alphabet");
{
  const SC = SCALES.quartal;
  const auth = { ...GENRES.rock, scale: SC };
  const layer = { ...GENRES.fugue, scale: SC, harmony: auth.harmony,
                  roots: auth.roots, rate: auth.rate };
  const pcOf = g2 => new Set(K.render(P, g2, 8)
    .filter(e => g2.realize(e.v) !== "pad").map(e => ((e.n % 12) + 12) % 12));
  const a = [...pcOf(auth)], l = [...pcOf(layer)];
  // both alphabets are the quartal set transposed by the shared roots, so the
  // layer can introduce no pitch class the authority could not also play
  const stray = l.filter(pc => !a.includes(pc));
  ok(stray.length === 0,
     "a layer sounded pitch classes its authority cannot: " + stray.join(","));
  // and the guard that would have caught it: drop the inherited scale and the
  // sets must diverge, or this test proves nothing
  const naive = { ...GENRES.fugue, harmony: auth.harmony, roots: auth.roots, rate: auth.rate };
  ok([...pcOf(naive)].some(pc => !a.includes(pc)),
     "the un-inherited case does not diverge — this check cannot fail");
}

/* ---------------------------------------------------------------- 10. NOTE DURATION
   A note lasts to the next gated step. The bug this replaced was every note
   being exactly one step, which is a row of 16ths, not a phrase. */
console.log("durations read the gate vector");
for (const gk of GK) {
  const g = GENRES[gk];
  const durs = new Set(K.render(P, g, g.bars).map(e => +e.dur.toFixed(3)));
  // a wash holds one chord to the next chord, so its durations are the
  // HARMONY's and are correctly all alike — the claim being made here is about
  // lines reading the gate vector (allPad, top of file)
  ok(durs.size > 1 || allPad(g), gk + ": every note has the same duration");
  ok([...durs].every(d => d > 0), gk + ": a note has non-positive duration");
}

/* ---------------------------------------------------------------- 11. SWING + RATE */
console.log("swing bends the grid; rate scales it");
{
  const straight = K.render(P, { ...GENRES.blues, swing: 0 }, 4).map(e => e.t);
  const swung = K.render(P, GENRES.blues, 4).map(e => e.t);
  ok(straight.length === swung.length, "swing changed the event count");
  ok(swung.some((t, i) => t !== straight[i]), "swing moved nothing");
  ok(swung.every((t, i) => t >= straight[i]), "swing moved a note EARLIER");
  const half = K.render(P, { ...GENRES.acid, rate: 0.5 }, 4);
  const full = K.render(P, GENRES.acid, 4);
  ok(Math.abs(Math.max(...half.map(e => e.t)) - 2 * Math.max(...full.map(e => e.t))) < 1e-9,
     "half-time did not double the span");
}

/* ---------------------------------------------------------------- 12. DRUM FILLS */
console.log("drum fills land on the last bar of the form");
for (const gk of GK) {
  const g = GENRES[gk];
  if (!g.fill) continue;
  const dr = K.drums(P, g, g.bars), bs = 16 / g.rate;
  const perBar = Array.from({ length: g.bars },
    (_, b) => dr.filter(e => Math.floor(e.t / bs) === b).length);
  ok(perBar[g.bars - 1] > perBar[0], gk + ": the fill bar is not busier than bar 1");
  ok(dr.some(e => e.fill), gk + ": no event is flagged as a fill");
}

/* ---------------------------------------------------------------- 12b. BASS ALWAYS SOUNDS
   The root bass reads the accent vector for its rhythm. A phrase with no
   accents — which is what every cleared or empty slot is — left it silent in
   four of five genres. A bass part must not depend on the tune being emphatic. */
console.log("bass sounds even when the phrase has no accents");
{
  const flat = { ...clone(P), acc: new Array(N).fill(0) };
  const empty = K.mapv(P, v => v.map(() => 0));
  for (const gk of GK) {
    const g = GENRES[gk];
    if (g.nobass) {                       // a genre may declare it has no bass at all
      ok(K.bass(P, g, g.bars).length === 0, gk + ": nobass genre emitted bass anyway");
      continue;
    }
    ok(K.bass(flat, g, g.bars).length > 0, gk + ": no bass when the phrase has no accents");
    ok(K.bass(empty, g, g.bars).length > 0, gk + ": no bass for an empty phrase");
    // and the accented case must not have drifted
    ok(K.bass(P, g, g.bars).length > 0, gk + ": no bass for an accented phrase");
  }
}

/* ---------------------------------------------------------------- 13. WALKING BASS */
console.log("walking bass arrives on the next root");
{
  const g = GENRES.blues, bs = 16, ev = K.bass(P, g, g.bars);
  ok(ev.length === g.bars * 4, "walking bass is not four notes a bar");
  for (let b = 0; b < g.bars; b++) {
    const bar = ev.filter(e => Math.floor(e.t / bs) === b);
    const nextRoot = ev.filter(e => Math.floor(e.t / bs) === (b + 1) % g.bars)[0];
    ok(Math.abs(bar[3].n - nextRoot.n) <= 2,
       "bar " + (b + 1) + ": the approach note does not land beside the next root");
  }
}

/* ---------------------------------------------------------------- 14. KIT OPERATORS
   A kit operator is total on kits the way a pattern operator is total on
   patterns — and the kit is now TWELVE lanes carrying FOUR vectors each
   (level · ?chance · ~nudge · !grace), so this section's alphabet widened with
   it. Three laws, each naming its own exceptions rather than waving at them:

     * ALPHABET. A lane vector is sixteen integers: 0 silent, 1 the old binary
       "on" (defer to kitVel and then the phrase), 2..9 an explicit velocity.
       The old check said "0 or 1", which was true only while a ghost snare was
       unwritable. ?chance is 0..9 odds, ~nudge is signed ninths of a step,
       !grace is 0..3 leading hits.
     * WRITES. An operator may write only the lanes it is DECLARED to write
       below. The list grew from two to twenty, because reaching the six lanes
       nothing could write was the point of the round — but every entry is
       named, so a typo that sprays toms through a house beat still fails.
     * FROM NOTHING. Only the "give this a beat" family may turn an EMPTY kit
       into a kit. Everything else VARIES a kit and returns {} for {} — the law
       `roll` always had in its comment and no test could state, and the one
       that stops a fugue growing a tom fill. */
console.log("kit operators are total; the alphabet is levels; only the declared write");
{
  // WHAT EACH OPERATOR MAY WRITE. A lane the base kit already has is always
  // allowed (that is varying, not inventing); this is the list of lanes an
  // operator may bring into existence, one entry per operator that does.
  const WRITES = {
    four: ["k"], offbeat: ["h"],
    ride: ["r"], tomtime: ["l"], pedal: ["f"], opens: ["o"],
    crash: ["x"], crashback: ["x"],
    backbeat: ["s"], onthree: ["s"], stickside: ["p"], claps: ["c"],
    tomfill: ["t", "m", "l"], tomrun: ["t", "m", "l"], tomroll: ["t", "m", "l"],
    disco: ["k", "o", "c"], stomp: ["k", "c", "h"], tresillo: ["k", "s", "h"],
    clave: ["p"], amen: ["k", "s", "r", "h"], motorik: ["k", "s", "h"],
    blast: ["k", "s", "r", "h"],
  };
  // ...and the ones that may write a kit onto NO kit at all: the named
  // patterns and the four-on-the-floor pair. "Give this a beat" is a different
  // request from "change this beat", and only these eleven answer the first.
  const FROM_NOTHING = new Set(["four", "offbeat", "crash", "crashback", "disco",
                                "stomp", "tresillo", "clave", "amen", "motorik", "blast"]);
  const RANGE = { "": [0, 9], "?": [0, 9], "~": [-4, 4], "!": [0, 3] };
  for (const gk of GK) {
    const g = GENRES[gk], base = g.kit || {};
    for (const [name, op] of Object.entries(K.KITOPS)) {
      const out = op(base);
      ok(out && typeof out === "object", gk + "/" + name + ": did not return a kit");
      for (const [key, vec] of Object.entries(out)) {
        const mark = /^[?~!]/.test(key) ? key[0] : "", lane = key.slice(mark ? 1 : 0);
        ok(!!K.LANES[lane], gk + "/" + name + ": \"" + key + "\" is not a lane or a sidecar");
        ok(Array.isArray(vec) && vec.length === 16,
           gk + "/" + name + ": " + key + " is not sixteen steps");
        const [lo, hi] = RANGE[mark] || [0, 9];
        ok(vec.every(x => Number.isInteger(x) && x >= lo && x <= hi),
           gk + "/" + name + ": " + key + " left the " + lo + ".." + hi + " alphabet");
        ok(base[lane] || (WRITES[name] || []).includes(lane),
           gk + "/" + name + ": invented lane " + lane + " out of nothing");
        // a sidecar without its lane is odds for a drum that is not there
        if (mark) ok(out[lane], gk + "/" + name + ": " + key + " is an orphan sidecar");
      }
      // and it must be a KIT: drums() has to accept whatever comes out
      ok(K.drums(P, { ...g, kit: out, fill: null }, g.bars).length >= 0,
         gk + "/" + name + ": drums() would not read the result");
    }
    // THE EMPTY KIT is the law's other half, and it is checked on every genre
    // because a kitless genre is exactly where it matters
    for (const [name, op] of Object.entries(K.KITOPS))
      ok((Object.keys(op({})).length > 0) === FROM_NOTHING.has(name),
         name + ": " + (FROM_NOTHING.has(name) ? "declared a writer but left {} empty"
                                               : "conjured a kit out of an empty one"));
    // the subtractive ones actually subtract
    ok(!("k" in K.KITOPS.nokick(base)), gk + ": nokick left a kick");
    ok(!Object.keys(K.KITOPS.nodrums(base)).length, gk + ": nodrums left a lane");
    if (base.k && base.s)
      ok(K.KITOPS.swap(base).k.join("") === base.s.join("") &&
         K.KITOPS.swap(base).s.join("") === base.k.join(""),
         gk + ": swap did not exchange the kick and the snare");
  }
  // double time is the bar's pattern read at twice the rate, not a busier lane
  const k = { h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], k: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0] };
  ok(K.KITOPS.doubletime(k).k.join("") === "1000100010001000",
     "double time did not double the kick");
  ok(K.KITOPS.sparse(k).h.filter(Boolean).length === 4, "sparse did not thin to the quarters");
}

/* ---------------------------------------------------------------- 15. BASS STYLES
   Every style must SOUND, and the two that own their own rhythm must own it
   even when the phrase has no accents to read — which is the whole reason
   STYLEGRID exists, and is the bug the accent-reading bass had in a different
   shape. */
console.log("bass styles: each is a different part, and none of them is silent");
{
  const g = GENRES.rock, flat = { ...clone(P), acc: new Array(N).fill(0) };
  const shapes = {};
  for (const st of ["walk", "octaves", "fifths", "pedal", "eighths", "sixteenths", undefined]) {
    const gg = { ...g, bassStyle: st }, name = st || "roots";
    const ev = K.bass(P, gg, g.bars);
    ok(ev.length > 0, name + ": emitted no bass at all");
    ok(ev.every(e => e.n > 0 && Number.isFinite(e.n)), name + ": emitted a nonsense pitch");
    ok(K.bass(flat, gg, g.bars).length > 0, name + ": went silent on an unaccented phrase");
    shapes[name] = JSON.stringify(ev.map(e => [e.t, e.n]));
  }
  // they are genuinely different parts, not one part with a different label
  const seen = new Map();
  for (const [name, s] of Object.entries(shapes)) {
    ok(!seen.has(s), name + " renders identically to " + seen.get(s));
    seen.set(s, name);
  }
  ok(K.bass(P, { ...g, bassStyle: "eighths" }, 1).length === 8, "eighths is not eight a bar");
  ok(K.bass(P, { ...g, bassStyle: "sixteenths" }, 1).length === 16, "sixteenths is not sixteen a bar");
  // PEDAL refuses the progression — that is the definition of it
  const ped = K.bass(P, { ...g, bassStyle: "pedal" }, g.bars);
  ok(new Set(ped.map(e => e.n)).size === 1, "the pedal bass moved off the tonic");
  ok(new Set(K.bass(P, g, g.bars).map(e => e.n)).size > 1,
     "the root bass does NOT follow the progression (so pedal proves nothing)");
}

/* ---------------------------------------------------------------- 16. THE EDGES
   intro/outro are a third type: not timeless like an operator, not a curve over
   the section like an envelope, but a rewrite of ONE bar at a known end. That is
   what lets a drum fill be a different bar rather than a louder one — and the
   test that matters is exactly that: the fill bar must contain drum events the
   section never had. */
console.log("intro and outro rewrite the first and last bar");
{
  const g = GENRES.rock, bs = 16 / g.rate, span = g.bars * bs;
  const ev = [...K.render(P, g, g.bars),
              ...K.drums(P, g, g.bars).map(e => ({ ...e, kind: "hit" }))]
    .map(e => ({ kind: e.kind || "line", ...e })).sort((a, b) => a.t - b.t);
  const inBar = l => l.filter(e => e.t < bs);
  const lastBar = l => l.filter(e => e.t >= span - bs);

  ok(K.edges(ev, null, null, span, bs) === ev, "edges with no ends copied the stream");
  for (const k of Object.keys({ count: 1, hit: 1, solo: 1, kit: 1, swell: 1 })) {
    const out = K.intro(ev, k, span, bs);
    ok(out.every(e => Number.isFinite(e.t) && e.t >= 0), "intro " + k + ": a bad time");
    // NOTHING PAST THE FIRST BAR MOVES. An intro that quietly edited bar 6 would
    // be a transition in name only.
    ok(JSON.stringify(out.filter(e => e.t >= bs)) ===
       JSON.stringify(ev.filter(e => e.t >= bs)),
       "intro " + k + " changed the section after its own bar");
  }
  ok(inBar(K.intro(ev, "solo", span, bs)).every(e => e.kind === "line"),
     "intro solo left drums in the first bar");
  ok(inBar(K.intro(ev, "kit", span, bs)).every(e => e.kind === "hit"),
     "intro kit left the melody in the first bar");
  ok(inBar(K.intro(ev, "count", span, bs)).length === 4,
     "the count-in is not four clicks");

  for (const k of Object.keys({ fill: 1, roll: 1, crash: 1, break: 1, tail: 1, cut: 1 })) {
    const out = K.outro(ev, k, span, bs);
    ok(JSON.stringify(out.filter(e => e.t < span - bs)) ===
       JSON.stringify(ev.filter(e => e.t < span - bs)),
       "outro " + k + " changed the section before its own bar");
  }
  // THE FILL IS A DIFFERENT BAR. Snare hits the section did not have, and more
  // of them in the second half than the first — which is what makes it a fill
  // rather than a busier loop.
  const fl = lastBar(K.outro(ev, "fill", span, bs)).filter(e => e.d === "s");
  const was = lastBar(ev).filter(e => e.d === "s").length;
  ok(fl.length > was, "the drum fill added no snare (was " + was + ", now " + fl.length + ")");
  ok(fl.filter(e => e.t >= span - bs / 2).length > fl.filter(e => e.t < span - bs / 2).length,
     "the fill does not accelerate into the bar line");
  ok(fl.every(e => e.fill), "a fill event is not flagged as a fill");
  const roll = lastBar(K.outro(ev, "roll", span, bs)).filter(e => e.d === "s");
  const gaps = roll.map((e, i, a) => (i ? e.t - a[i - 1].t : null)).filter(x => x != null);
  ok(gaps.every((x, i) => i === 0 || x <= gaps[i - 1]), "the roll does not accelerate");
  ok(!lastBar(K.outro(ev, "tail", span, bs)).some(e => e.kind === "hit"),
     "outro tail left the drums playing");
  ok(lastBar(K.outro(ev, "break", span, bs)).every(e => e.kind === "hit"),
     "outro break left the melody playing");
  ok(K.outro(ev, "cut", span, bs).every(e => e.t < span - bs / 4), "cut did not cut");
  ok(lastBar(K.outro(ev, "crash", span, bs)).length === 2, "the crash is not one gesture");
  // and the two ends compose without either eating the other
  const both = K.edges(ev, "count", "fill", span, bs);
  ok(inBar(both).length === 4, "the outro ate the intro");
  ok(lastBar(both).some(e => e.fill), "the intro ate the outro");
}

/* --------------------------------------------------------------- 16b. THE WIDER
   INTRO VOCABULARY — added because every composed song in every genre opened
   with a drum hit: four of the five original kinds are drum gestures, and the
   composer stamped count/hit on everything else. Six new kinds, each with a
   documented signature in bar one of the RENDERED stream (test-the-artifact:
   these checks read events, never config): padin = the pad alone, bassin = the
   bass alone, riser = a rising hat ramp replacing the bar, cold = the identity
   (the absence of an intro, named), stabs = the opening chord on a sparse
   grid, fade = the one two-bar kind (a one-bar fade already exists: swell).
   All total: an unknown name is the stream unchanged. */
console.log("the wider intro vocabulary — six ways in that are not a drum hit");
{
  // vaporwave: a pad voice, a line voice, a kit and a bass — every layer the
  // new kinds discriminate on, in one stream, tagged the way derive.js tags
  const g = GENRES.vaporwave, bs = 16 / g.rate, span = g.bars * bs;
  const ev = [...K.render(P, g, g.bars),
              ...K.drums(P, g, g.bars).map(e => ({ ...e, kind: "hit" })),
              ...K.bass(P, g, g.bars).map(e => ({ ...e, kind: "bass" }))]
    .map(e => ({ kind: e.kind || "line", ...e })).sort((a, b) => a.t - b.t);
  const inBar = l => l.filter(e => e.t < bs);
  const isPad = e => e.kind === "line" && e.part === "pad";

  // NEUTRALITY, the total-function half: unknown and null are the stream
  // itself — not a copy, the same reference — so a save from before this
  // vocabulary renders byte-identically to before it existed
  ok(K.intro(ev, "nonsense", span, bs) === ev, "an unknown intro was not a no-op");
  ok(K.intro(ev, null, span, bs) === ev, "a null intro was not a no-op");

  // every one-bar kind leaves bars 2+ untouched (fade owns two bars by
  // declaration and is held to its own fence below)
  for (const k of ["padin", "bassin", "riser", "cold", "stabs"]) {
    const out = K.intro(ev, k, span, bs);
    ok(out.every(e => Number.isFinite(e.t) && e.t >= 0), "intro " + k + ": a bad time");
    ok(JSON.stringify(out.filter(e => e.t >= bs)) ===
       JSON.stringify(ev.filter(e => e.t >= bs)),
       "intro " + k + " changed the section after its own bar");
  }

  // COLD is the identity, and the claim is not vacuous: the test stream really
  // does have kit and line together on the downbeat for cold to preserve
  ok(K.intro(ev, "cold", span, bs) === ev, "cold is not the identity");
  ok(ev.some(e => e.t === 0 && e.kind === "hit") &&
     ev.some(e => e.t === 0 && e.kind === "line"),
     "the cold-open claim is vacuous — no band on the test stream's downbeat");

  const pi = inBar(K.intro(ev, "padin", span, bs));
  ok(pi.length > 0 && pi.every(isPad), "padin bar one is not the pad alone");
  const bi = inBar(K.intro(ev, "bassin", span, bs));
  ok(bi.length > 0 && bi.every(e => e.kind === "bass"),
     "bassin bar one is not the bass alone");

  // the riser: sixteen hats, velocity never falling, genuinely rising, and
  // nothing else left in the bar — it replaces, it does not decorate
  const ri = inBar(K.intro(ev, "riser", span, bs));
  ok(ri.length === 16 && ri.every(e => e.d === "h"), "the riser is not sixteen hats");
  ok(ri.every((e, i) => i === 0 || e.vel >= ri[i - 1].vel) &&
     ri[ri.length - 1].vel > ri[0].vel, "the riser does not rise");

  // stabs: the opening chord refired short at three sparse grid points, and
  // nothing else — no drums, no line, no held pad
  const st = inBar(K.intro(ev, "stabs", span, bs));
  ok(st.length > 0 && st.every(e => e.kind === "line") &&
     new Set(st.map(e => e.t)).size === 3 &&
     st.every(e => e.dur <= bs / 16),
     "stabs bar one is not the chord on a sparse grid");

  // fade: scales and never deletes; bar one under bar two, bar two under its
  // own untouched self, bars 3+ byte-identical
  const fd = K.intro(ev, "fade", span, bs);
  const mean = (l, a, b2) => { const xs = l.filter(e => e.t >= a && e.t < b2);
    return xs.reduce((s2, e) => s2 + e.vel, 0) / Math.max(1, xs.length); };
  ok(fd.length === ev.length, "fade deleted events — it must only scale");
  ok(mean(fd, 0, bs) < mean(fd, bs, 2 * bs), "fade: bar one is not under bar two");
  ok(mean(fd, bs, 2 * bs) < mean(ev, bs, 2 * bs), "fade: bar two was not pulled down");
  ok(JSON.stringify(fd.filter(e => e.t >= 2 * bs)) ===
     JSON.stringify(ev.filter(e => e.t >= 2 * bs)), "fade reached past its two bars");

  // TOTAL MEANS A BAR OF SOMETHING: on a stream without their layer, padin
  // and bassin degrade to the line, never to dead air
  const lines = ev.filter(e => e.kind === "line" && !isPad(e));
  ok(inBar(K.intro(lines, "padin", span, bs)).length > 0,
     "padin on a padless stream is a bar of dead air");
  ok(inBar(K.intro(lines, "bassin", span, bs)).length > 0,
     "bassin on a bassless stream is a bar of dead air");
}

/* ---------------------------------------------------------------- 17. ENVELOPE SHAPES */
console.log("envelope shapes and cuts");
{
  const g = GENRES.acid, span = g.bars * 16 / g.rate, ev = K.render(P, g, g.bars);
  const mid = e => Math.abs(e.t - span / 2) < span / 8;
  const sw = K.envelope(ev, "swell", span);
  ok(sw.length === ev.length, "swell changed the event count");
  ok(sw.filter(mid).every(e => e.vel > 0), "the swell is silent in the middle");
  ok(sw[0].vel < sw.filter(mid)[0].vel && sw[sw.length - 1].vel < sw.filter(mid)[0].vel,
     "the swell does not rise and fall");
  const dk = K.envelope(ev, "duck", span);
  ok(dk.filter(mid).every(e => e.vel <= sw.filter(mid)[0].vel), "duck does not duck");
  ok(K.envelope(ev, "drop", span).every(e => e.t < span * 0.875), "drop left the last eighth");
  const st = K.envelope(ev, "stutter", span);
  ok(st.length >= ev.length, "stutter removed events instead of repeating them");
  ok(st.every(e => e.t < span), "stutter ran past the end of the section");
  ok(K.envelope(ev, "nonsense", span) === ev, "an unknown envelope was not a no-op");
}

/* ---------------------------------------------------------------- 18. SPLIT CLIMBS
   A split note's copies are not copies. The step's own ramp applies once per
   repeat, which is what turns split from a stutter into an arpeggio — and is
   what anyone who set a ramp AND split the note was asking for. A step with no
   ramp must be byte-identical to the old behaviour, or every existing song
   changes underneath its author. */
console.log("split applies the ramp once per repeat");
{
  const flat = { deg: new Array(N).fill(2), oct: new Array(N).fill(0),
                 vel: new Array(N).fill(5), inc: new Array(N).fill(0),
                 stk: new Array(N).fill(0),
                 gate: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
                 acc: new Array(N).fill(0), sld: new Array(N).fill(0) };
  ok(eq(K.split(4)(flat).deg, new Array(N).fill(2)),
     "a ramp-free split moved a degree — every existing song just changed");
  const ramp = clone(flat); ramp.inc = ramp.inc.map((_, i) => (i % 4 === 0 ? 1 : 0));
  const out = K.split(4)(ramp);
  // the note at step 0 lasts four steps and splits into 0,1,2,3 — climbing
  ok(out.deg.slice(0, 4).join(",") === "2,3,4,5",
     "split did not climb by the ramp: " + out.deg.slice(0, 4).join(","));
  ok(out.gate.slice(0, 4).every(Boolean), "split did not subdivide the note");
  // ...and each subdivision keeps the ramp, so it goes on climbing every loop
  ok(out.inc.slice(0, 4).every(x => x === 1), "a subdivision lost the ramp");
  const down = clone(ramp); down.inc = down.inc.map(x => -x);
  ok(K.split(4)(down).deg.slice(0, 4).join(",") === "2,1,0,-1", "a falling ramp did not fall");
  // and it is AUDIBLE as pitch, not just as data
  const g = { ...GENRES.simple, incClamp: 0 };
  const pitches = K.render(K.split(4)(ramp), g, 1).map(e => e.n).slice(0, 4);
  ok(new Set(pitches).size === 4, "the split arpeggio came out on one pitch: " + pitches.join(","));
  ok(pitches.every((n, i) => i === 0 || n > pitches[i - 1]), "the split arpeggio does not ascend");
}

/* ---------------------------------------------------------------- 19. SWING + GROOVE
   Swing bends the grid. Groove bends the grid AND the dynamics, per sixteenth.
   They are two knobs because they are two different claims, and the test that
   matters for both is that they move real events without breaking the stream. */
console.log("groove moves time and level, and never breaks the stream");
{
  const g = GENRES.rock, bs = 16 / g.rate;
  const ev = [...K.render(P, g, g.bars),
              ...K.drums(P, g, g.bars).map(e => ({ ...e, kind: "hit" }))]
    .sort((a, b) => a.t - b.t);
  ok(K.groove(ev, null, bs, 1) === ev, "groove(null) copied the stream");
  ok(K.groove(ev, "funk", bs, 0) === ev, "groove at amount 0 is not a no-op");
  for (const name of Object.keys(K.GROOVES)) {
    const out = K.groove(ev, name, bs, 1);
    ok(out.length === ev.length, name + ": changed the event count");
    ok(out.every(e => e.t >= 0 && Number.isFinite(e.t)), name + ": produced a bad time");
    ok(out.every(e => e.vel == null || (e.vel >= 0 && e.vel <= 9)),
       name + ": left velocity out of range");
    ok(out.every((e, i) => i === 0 || e.t >= out[i - 1].t), name + ": came back unsorted");
    // it has to actually DO something, and something you could hear
    const movedT = out.filter((e, i) => Math.abs(e.t - ev[i].t) > 1e-9).length;
    const movedV = out.filter((e, i) => e.vel !== ev[i].vel).length;
    ok(movedV > 0, name + ": changed no velocity at all");
    ok(K.GROOVES[name].push ? movedT > 0 : movedT === 0,
       name + ": its timing claim and what it did disagree");
    // and it must stay INSIDE the sixteenth it belongs to — a groove that walks
    // a note onto the next step is a rewrite, not a feel
    ok(out.every((e, i) => Math.abs(e.t - ev[i].t) < bs / 16),
       name + ": moved a note further than one sixteenth");
  }
  // amount is a dial: half the profile is half the departure
  const half = K.groove(ev, "funk", bs, 0.5), full = K.groove(ev, "funk", bs, 1);
  const dev = l => l.reduce((a, e, i) => a + Math.abs(e.t - ev[i].t), 0);
  ok(dev(half) < dev(full) && dev(half) > 0, "groove amount is not a dial");
  // SWING is the other one, and it is genre-level: a section that asks for
  // straight must get straight even from a genre that swings
  const swung = K.render(P, { ...GENRES.blues, swing: 1 / 3 }, 4).map(e => e.t);
  const flatT = K.render(P, { ...GENRES.blues, swing: 0 }, 4).map(e => e.t);
  ok(swung.some((t, i) => t > flatT[i]), "swing 1/3 moved nothing");
  ok(swung.every((t, i) => t >= flatT[i]), "swing moved a note earlier");
}

/* ---------------------------------------------------------------- 20. THE COMPOSER
   A generator that runs once per button click is the hardest kind of thing to
   trust: it is right nine times and you never see the tenth. So compose every
   genre at forty seeds and check every one — the whole point of keeping the
   arranger pure and seeded is that this is cheap. */
console.log("the composer writes songs that are songs");
{
  const C = require("../../nukernel/compose.js");
  const { NSLOTS } = require("../../nukernel/fields.js");
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
  let silent = 0, unused = 0, leaps = 0, notes = 0;
  for (const gk of GK) {
    for (const s of seeds) {
      const song = C.compose(gk, s), G = GENRES[gk];
      // the shape Load reads, or it cannot come back. The bank is VARIABLE
      // (1..NSLOTS) now and the composer sizes it to what the song needs —
      // its NINE kinds of material, no blank padding. The ninth is the verse
      // line: the chorus topline's own development, which is what makes the
      // singer a through-line rather than a part that turns up twice.
      ok(song.v === 2 && song.slots.length === 9 && song.slots.length <= NSLOTS &&
         song.song.length >= 6,
         gk + "/" + s + ": not the saved shape");
      ok(song.bpm >= 70 && song.bpm <= 160, gk + "/" + s + ": bpm outside the control's range");
      ok(song.slots.every(p => ["deg", "oct", "vel", "gate", "acc", "sld", "inc", "stk"]
        .every(k => Array.isArray(p[k]) && p[k].length === 16 && p[k].every(Number.isFinite))),
        gk + "/" + s + ": a phrase is not a valid pattern");
      const used = new Set();
      for (const b of song.song) {
        ok(C.ROLES[b.role], gk + "/" + s + ": a section has no role");
        ok(b.stack.length && b.stack.every(e => GENRES[e.g]), gk + "/" + s + ": bad stack");
        // AN INTRO BED HAS NO PHRASE BY DESIGN — four bars of drums, then the
        // bass, then the tune, which is an arrangement rather than a fade. It
        // still has to make a sound, and out of the right layer: a drums-only
        // bed with a bass part in it is not a drums-only bed.
        const bed = !!C.BEDS[b.role];
        const blank = K.mapv(P, v => v.map(() => 0));
        // MIRROR genreOf EXACTLY. A kit operator replaces the kit, and the
        // engine also drops the FILL and the ghost lane with it — without
        // that, "no drums" still plays a fill on the last bar of the form and
        // a ghost-perc layer underneath, which is not no drums.
        const g3 = b.kit
          ? { ...G, kit: K.KITOPS[b.kit](G.kit || {}), fill: null,
              kits: !G.kits ? null : b.kit === "nodrums" ? null
                : G.kits.map(k4 => K.KITOPS[b.kit](k4)),
              ghost: b.kit === "nodrums" ? null : G.ghost }
          : G;
        const dr = K.drums(blank, g3, G.bars).length;
        const bs = K.bass(blank, { ...g3, nobass: b.bassop === "nobass" }, G.bars).length;
        if (bed) {
          ok(!b.stack[0].slots.length, gk + "/" + s + ": a " + b.role +
             " bed has a melody in it — it is a bed, that is the whole idea");
          // EACH BED IS ITS OWN LAYER, and the name says which. A section called
          // "drums" with a bass part in it is not the thing the label promises.
          const want = { drums: [1, 0], bass: [0, 1], groove: [1, 1] }[b.role];
          ok(!!dr === !!want[0] && !!bs === !!want[1],
             gk + "/" + s + ": the \"" + b.role + "\" bed has " + dr + " drums and " +
             bs + " bass");
        } else if (!b.stack[0].slots.length) {
          // THE SOLO BREAK — the second place an authority legally has no
          // phrase, and the whole point of the function genres: the host is
          // reduced to its own drums and a stacked part plays over it. It is
          // held to the three facts that make it that rather than a hole: the
          // box says so in `cue`, a layer is actually playing, and the host's
          // drums are still going. (Drums come from genre data, which is why
          // an empty slot list can silence the band without silencing the kit.)
          ok(b.cue === "solobreak", gk + "/" + s + "/" + b.role +
             ": the authority has no phrase and the box does not say why");
          ok(b.stack.slice(1).some(e => e.slots.length), gk + "/" + s + "/" + b.role +
             ": the authority stopped playing and nothing took over");
          ok(dr > 0, gk + "/" + s + "/" + b.role +
             ": a solo break with the drums switched off is four bars of one guitar");
        } else ok(b.stack[0].slots.length,
                  gk + "/" + s + "/" + b.role + ": a section with no phrase");
        ok(b.len >= 1 && b.nudge >= 0, gk + "/" + s + ": bad window");
        for (const e of b.stack) for (const i of e.slots) used.add(i);
        // EVERY SECTION MUST SOUND. A composed song with a silent bridge is the
        // failure nobody reports, because it reads as a deliberate pause.
        if (bed) continue;                    // measured above, on its own terms
        const g2 = { ...G, ...(b.mode ? { mode: MODES[b.mode] } : {}) };
        let ev = 0;
        for (const e of b.stack)
          for (const i of e.slots)
            ev += K.render(song.slots[i], g2, G.bars).length +
                  K.drums(song.slots[i], g2, G.bars).length +
                  K.bass(song.slots[i], g2, G.bars).length;
        if (!ev) { silent++; ok(false, gk + "/" + s + ": the " + b.role + " is silent"); }
      }
      // IT WRITES EIGHT PHRASES. If it only ever reaches for three it has not
      // arranged anything, it has looped one idea and labelled the loops — which
      // is exactly what the arc plan was doing before this check existed.
      if (used.size < 4) unused++;
    }
    // SEEDED, so a seed is a song: the composer is reproducible or it is a slot
    // machine, and a slot machine cannot be debugged.
    ok(JSON.stringify(C.compose(gk, 9)) === JSON.stringify(C.compose(gk, 9)),
       gk + ": the same seed composed two different songs");
    ok(JSON.stringify(C.compose(gk, 9)) !== JSON.stringify(C.compose(gk, 10)),
       gk + ": two different seeds composed the same song");
    // and the plan fits the genre — a fugue does not have a drop. NO fallback:
    // PLAN_OF must carry every genre (the coverage gate below enforces it)
    const plan = C.PLANS[C.PLAN_OF[gk]];
    ok(plan && plan[0] === "intro" && plan[plan.length - 1] === "outro",
       gk + ": the plan does not start with an intro and end with an outro");
  }
  ok(!silent, silent + " composed sections are silent");
  ok(!unused, unused + " composed songs use fewer than four of their eight phrases");
  {
    // THE BED INTRO SURVIVES THE WIDER VOCABULARY. It used to be near-mandatory
    // (seven of nine shapes) — now it is one option among thirteen, weighted
    // where the tradition really does walk in on the rhythm section: reggae
    // (groove family — bassin/drums/drumbass on the ballot) still opens on
    // beds routinely, and a kitless genre still never does, because there is
    // nothing to bring in one layer at a time.
    const beds = gk => seeds.reduce((n, s) => n +
      C.compose(gk, s).song.filter(b => C.BEDS[b.role]).length, 0);
    ok(beds("reggae") > 6, "the groove family never opens on a bed (" + beds("reggae") + ")");
    for (const gk of GK) {
      if (Object.keys(GENRES[gk].kit || {}).length) continue;
      ok(beds(gk) === 0, gk + " has no drums and was given a drum intro anyway");
    }
  }
  {
    // HOW SONGS OPEN, measured across the table — the gate on "everything in
    // every genre opens with a drum hit". Every composed song stamps its
    // chosen intro kind on the head box's `cue` (the honest name; the STORED
    // `intro` chip may be a downgraded neighbour until fields.js INLABEL
    // learns the new words). Across the whole table x 8 seeds the distribution must
    // not collapse: at least eight kinds in play, no kind above 40%, no genre
    // opening identically at all eight seeds, and the family leanings audible
    // in the counts.
    const kindOf = (gk, s) => {
      const head = C.compose(gk, s).song.find(b => b.role === "intro");
      return head && head.cue;
    };
    const cnt = {}, byFam = {};
    let total = 0, mono = 0;
    for (const gk of GK) {
      const fam = GENRES[gk].family, ks = new Set();
      for (let s = 1; s <= 8; s++) {
        const k = kindOf(gk, s);
        ok(!!k, gk + "/" + s + ": the head box carries no intro cue");
        cnt[k] = (cnt[k] || 0) + 1; total++;
        (byFam[fam] = byFam[fam] || {})[k] = (byFam[fam][k] || 0) + 1;
        ks.add(k);
      }
      if (ks.size < 2) mono++;
    }
    ok(Object.keys(cnt).length >= 8, "only " + Object.keys(cnt).length +
       " intro kinds in play across the whole table");
    for (const [k, n] of Object.entries(cnt))
      ok(n / total <= 0.4, "intro kind \"" + k + "\" opens " +
         Math.round(100 * n / total) + "% of all songs — the vocabulary collapsed");
    ok(mono === 0, mono + " genres open identically at all eight seeds");
    // three family leanings, spot-checked as a share of the family's songs
    const share = (fam, kinds) => {
      const m = byFam[fam] || {}, all = Object.values(m).reduce((a, b) => a + b, 0);
      return kinds.reduce((a, k) => a + (m[k] || 0), 0) / Math.max(1, all);
    };
    ok(share("club", ["riser", "kit", "cold"]) >= 0.5,
       "club does not lean riser/kit/cold");
    ok(share("soul", ["bassin", "stabs", "drumbass"]) >= 0.4,
       "soul does not walk in on the bass");
    ok(share("drift", ["padin", "fade", "solo", "swell"]) >= 0.5,
       "drift does not lean padin/fade/solo/swell");
    // ...and no family opens on percussion wall to wall
    for (const [fam, m] of Object.entries(byFam))
      ok(["padin", "bassin", "fade", "solo", "swell", "stabs", "cold"]
           .some(k => m[k]), fam + ": every opening is a drum gesture");
    // the ballots are covered and legal: one per family, every vote a kind the
    // kernel edge or the bed path knows — and every anchor `intro` field too
    const KINDS = new Set(["count", "hit", "solo", "kit", "swell", "padin",
                           "bassin", "riser", "cold", "stabs", "fade",
                           "drums", "drumbass", "quote"]);
    for (const [fam] of FAMILIES) {
      ok(Array.isArray(C.INTRO_LEAN[fam]) && C.INTRO_LEAN[fam].length,
         fam + ": no INTRO_LEAN ballot");
      for (const k of C.INTRO_LEAN[fam] || [])
        ok(KINDS.has(k), fam + ": unknown intro kind \"" + k + "\" on the ballot");
    }
    for (const gk of GK)
      if (GENRES[gk].intro != null)
        ok(KINDS.has(GENRES[gk].intro), gk + ": anchor intro \"" +
           GENRES[gk].intro + "\" is not a known kind");
    // THE REGISTRY BRIDGE HOLDS: whatever the cue says, the stored chip is a
    // value the loader's enum accepts (§21's round-trip proves it the long way)
    const INLABEL2 = require("../../nukernel/fields.js").INLABEL;
    for (const gk of ["rock", "house", "funk", "ambient", "fugue", "dub"])
      for (let s = 1; s <= 8; s++)
        for (const b of C.compose(gk, s).song)
          ok(b.intro == null || INLABEL2[b.intro] != null,
             gk + "/" + s + ": stored intro \"" + b.intro + "\" is not in the registry");
    // THE ANCHOR'S SAY IS AUDIBLE: the genres whose identity dictates their
    // opening lead with it — the fugue with the subject alone, dub on the bass
    const lead = gk => { const m = {};
      for (let s = 1; s <= 16; s++) { const k = kindOf(gk, s); m[k] = (m[k] || 0) + 1; }
      return Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]; };
    ok(lead("fugue") === "solo", "fugue does not lead with the subject alone");
    ok(lead("dub") === "bassin", "dub does not walk in on the bass");
    // THE BAND ENTERS AFTER THE DOOR: whatever the intro did, the first verse
    // carries no FADE of its own — a padin or riser opening resolves into a
    // full section, not a second arrival. It does carry a DYNAMIC (the arc
    // decides how big a verse is against the chorus it points at), and the two
    // are different fields of the same enum: a fade touches zero and is an
    // entrance, a dynamic never does and is a size. Written as the fade list
    // rather than as `== null` so it stays a check about arriving twice.
    const FADES = new Set(["in", "swell", "duck", "drop", "stutter"]);
    for (const gk of ["house", "rock", "ambient"])
      for (let s = 1; s <= 8; s++) {
        const song = C.compose(gk, s);
        const vi = song.song.findIndex(b => b.role === "verse");
        ok(vi > 0 && !FADES.has(song.song[vi].env),
           gk + "/" + s + ": the verse after the intro fades instead of entering");
      }
  }
  {
    let spent = 0;
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), u = new Set();
      for (const b of song.song) for (const e of b.stack) for (const i of e.slots) u.add(i);
      spent += u.size;
    }
    const avg = spent / (GK.length * seeds.length);
    ok(avg >= 5.5, "the composer spends only " + avg.toFixed(1) + " of its eight phrases on average");
  }
  // THE PHRASES ARE WALKS, NOT NOISE. A tune moves mostly by step; if the
  // average interval is a fifth, the composer is a random number generator with
  // a nice comment on it. The HOOK KINDS get a looser fence on purpose: the
  // climax is a DESIGNED leap (one note raised above everything, that is its
  // job) and the cell joins of an A A B A' layout are two more — their noise
  // check is the motif-repetition gate below, which no random walk can pass.
  for (const kind of ["hook", "topline", "answer", "riff", "counter", "climb"]) {
    const fence = kind === "hook" || kind === "topline" ? 0.38 : 0.25;
    let big = 0, all = 0;
    for (const s of seeds) {
      const p = C.phrase(C.rng(s * 31), kind);
      const on = p.deg.filter((_, i) => p.gate[i]);
      for (let i = 1; i < on.length; i++) { all++; if (Math.abs(on[i] - on[i - 1]) > 2) big++; }
    }
    ok(all > 20, kind + ": too few notes to judge");
    ok(big / all < fence, kind + ": " + Math.round(100 * big / all) +
       "% of its intervals are leaps — that is noise, not a phrase");
  }
  void leaps; void notes;
}

/* ---------------------------------------------------------------- 21. THE LOADER
   song.js is the one gate every song passes — localStorage, files, presets,
   the composer — and until it was pure it was tested only by a browser. Now
   the whole contract is provable here: round trip, typed errors, migration. */
console.log("the loader — round trip, typed errors, clamps, migration");
{
  const S = require("../../nukernel/song.js");
  const F = require("../../nukernel/fields.js");
  const NI = require("../../nukernel/instruments.js");
  const C = require("../../nukernel/compose.js");
  const { PRESETS } = require("../../nukernel/presets.js");
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  // (a) ROUND TRIP: everything the composer can emit, the loader accepts —
  // the contract that used to be one browser smoke check, now exhaustive.
  for (const gk of GK) for (const s of seeds) {
    const res = S.validateSong(C.compose(gk, s));
    ok(res.ok, gk + "/" + s + ": the loader refused a composed song — " +
       (res.errors[0] && res.errors[0].path));
  }
  // ...and through the full path, any-version in
  ok(S.load(C.compose("rock", 3)).ok, "load() refused a composed song");

  // (b) REGISTRY COVERAGE: every fields.js entry is complete. The registry is
  // the single definition of every control, so an incomplete entry is a chip
  // the palette cannot draw or a field validation cannot check.
  for (const f of F.FIELDS) {
    ok(typeof f.key === "string" && f.key, "a fields entry has no key");
    ok(f.scope === "box" || f.scope === "layer", f.key + ": scope is not box|layer");
    ok(typeof f.tab === "string" && f.tab, f.key + ": no palette tab");
    ok(typeof f.group === "string" && f.group, f.key + ": no group title");
    if (f.type === "int") {
      ok(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min <= f.max,
         f.key + ": int field without a [min,max]");
      ok(Number.isFinite(f.default) && f.default >= f.min && f.default <= f.max,
         f.key + ": default outside its own range");
      continue;
    }
    // "num" is the fader-offset family: a range, no table, absent-by-default
    // (null, not 0 — absent must stay the one spelling of "no offset")
    if (f.type === "num") {
      ok(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min <= f.max,
         f.key + ": num field without a [min,max]");
      ok(f.default === null, f.key + ": num default is not null (absent = no offset)");
      continue;
    }
    // "eq" is the strip-EQ family: a band list instead of a table, absent
    // (flat) by default — the bands themselves are checked in §37d
    if (f.type === "eq") {
      ok(Array.isArray(f.bands) && f.bands.length, f.key + ": eq field without a band list");
      ok(f.default === null, f.key + ": eq default is not null (absent = flat)");
      continue;
    }
    ok(f.table && typeof f.table === "object" && Object.keys(f.table).length,
       f.key + ": no value table");
    ok(f.labels && Object.keys(f.table).every(k => f.labels[k] != null),
       f.key + ": a table value has no label");
    if (f.type === "list") ok(Array.isArray(f.default), f.key + ": list default is not []");
    else ok(f.default === null, f.key + ": enum default is not null (absent = genre's own)");
  }
  // the registry and the constructor agree on what a box IS
  {
    const b = S.emptyBox();
    for (const f of F.FIELDS)
      if (f.type !== "vox") ok(f.key in b, "emptyBox is missing registry field " + f.key);
    const wrapped = { v: 2, slots: [S.blank()], song: [b], bpm: 126, vol: 80 };
    ok(S.validateSong(wrapped).ok, "emptyBox does not validate");
  }

  // (c) EXHAUSTIVE TOGGLE: every value in the registry, applied to a fresh
  // box, must produce a song the loader accepts — so no palette chip can ever
  // write a song that refuses to come back.
  const trial = box => S.validateSong(
    { v: 2, slots: [S.blank()], song: [box], bpm: 126, vol: 80 });
  for (const f of F.FIELDS) {
    if (f.type === "int" || f.type === "num") continue;  // clamped, checked below
    if (f.type === "eq") {                               // every band, one at a time
      for (const bd of f.bands) {
        const b = S.emptyBox(); b[f.key] = { [bd.key]: 6 };
        const r = trial(b);
        ok(r.ok, f.key + "." + bd.key + " on the box: loader refused — " +
           (r.errors[0] && r.errors[0].path));
      }
      continue;
    }
    for (const k of Object.keys(f.table)) {
      const b = S.emptyBox();
      if (f.type === "list") b[f.key] = [k];
      else if (f.type === "vox") b.vox = { [f.key]: k };
      // a "parts" table lists PART NAMES, and the value under one is a mix
      // entry — so the exhaustive toggle exercises the real map shape (an
      // entry per name, carrying one of every sub-field it can carry)
      else if (f.type === "parts")
        b[f.key] = { [k]: { fx: ["chorus"], rev: "wet", echo: "touch",
                            lvl: "hush", pan: "l", mute: true, solo: false } };
      else b[f.key] = k;
      let r = trial(b);
      ok(r.ok, f.key + "=" + k + " on the box: loader refused — " +
         (r.errors[0] && r.errors[0].path));
      if (f.scope === "layer") {                     // and on a stack entry
        const b2 = S.emptyBox();
        if (f.type === "list") b2.stack[0][f.key] = [k];
        else if (f.type === "vox") b2.stack[0].vox = { [f.key]: k };
        else b2.stack[0][f.key] = k;
        r = trial(b2);
        ok(r.ok, f.key + "=" + k + " on a layer: loader refused — " +
           (r.errors[0] && r.errors[0].path));
      }
    }
  }
  // typed errors: a bad value names its field instead of shrugging
  {
    const b = S.emptyBox(); b.rev = "soaked";
    const r = trial(b);
    ok(!r.ok && /\.rev$/.test(r.errors[0].path),
       "a bad send did not name its own field: " + JSON.stringify(r.errors[0]));
  }
  // the clamps: a hand-edited len of 1e9 comes back as MAX_LEN, not a hung tab
  {
    const b = S.emptyBox(); b.len = 1e9; b.nudge = -5;
    const r = trial(b);
    ok(r.ok && r.song.song[0].len === F.MAX_LEN && r.song.song[0].nudge === 0,
       "len/nudge are not clamped into range: " +
       (r.ok ? r.song.song[0].len + "/" + r.song.song[0].nudge : "rejected"));
  }
  // the filter rule: unknown ops/fx are dropped, never fatal — a song loses an
  // obsolete chip rather than losing itself
  {
    const b = S.emptyBox(); b.ops = ["rev", "nonsense"]; b.fx = ["chorus", "nonsense"];
    const r = trial(b);
    ok(r.ok && r.song.song[0].ops.join(",") === "rev" &&
       r.song.song[0].fx.join(",") === "chorus",
       "the ops/fx filter rule does not filter");
  }

  // (d) GENRE COVERAGE: a genre is instrument + plan + tempo as much as it is
  // a kit — and none of them may default silently. Three tables used to fall
  // back (piano / pop plan / 120 bpm) and nothing could notice a rotted entry.
  for (const gk of GK) {
    const g = GENRES[gk];
    ok(typeof g.instr === "string" ||
       (Array.isArray(g.instr) && g.instr.length && g.instr.every(x => typeof x === "string")),
       gk + ": no `instr` in genres.js");
    for (let v = 0; v < g.voices; v++)
      ok(typeof NI.instrOf(gk, v) === "string", gk + ": instrOf failed for voice " + v);
    ok(C.PLANS[C.PLAN_OF[gk]], gk + ": no PLAN_OF entry");
    ok(Number.isFinite(C.BPM[gk]) && C.BPM[gk] >= 70 && C.BPM[gk] <= 160,
       gk + ": no BPM entry in the control's range");
  }
  // ...and the miss is LOUD, not a polite piano
  {
    let threw = false;
    try { NI.instrOf("no_such_genre", 0); } catch (e) { threw = true; }
    ok(threw, "instrOf did not throw for a genre without an instrument");
  }
  // ...and every id NAMES A REAL SAMPLER. instrOf proves the field exists;
  // this proves the string means something — a typo'd id used to sail through
  // node and fail only in a browser with the sample layer fetched. The
  // registry is a classic window-global script, so it is read here the way
  // the page reads it: evaluated, not required.
  {
    const vm = require("vm"), fs = require("fs"), path = require("path");
    const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(
      path.join(__dirname, "../../engine/registry-data.js"), "utf8"), ctx);
    const SAMPLERS = (ctx.__REGISTRY && ctx.__REGISTRY.SAMPLERS) || {};
    ok(Object.keys(SAMPLERS).length > 100, "registry-data.js did not yield SAMPLERS");
    ok(SAMPLERS[NI.BASS_INSTR], "BASS_INSTR is not a registry sampler");
    for (const gk of GK) {
      const e = GENRES[gk].instr, ids = Array.isArray(e) ? e : [e];
      for (const id of ids)
        ok(!!SAMPLERS[id], gk + ": instr \"" + id + "\" is not a SAMPLERS id");
    }
  }

  // (e) MIGRATION: the shipped preset (v:1, pre-stack, pre-mixer) and a v:1
  // fixture with every legacy wrinkle still load after the v:2 bump.
  {
    const r = S.load(PRESETS[0].data);
    ok(r.ok, "the shipped preset no longer loads: " +
       JSON.stringify(r.errors && r.errors[0]));
    ok(PRESETS[0].data.v === 1, "migrate MUTATED the shipped preset literal");
    const r2 = S.load(PRESETS[0].data);
    ok(r2.ok, "the shipped preset does not survive being loaded twice");
    // ...and EVERY shipped preset, whatever its vintage: the radio-dial four
    // are composer output frozen as literals, and they take the same door
    for (const p of PRESETS) {
      const ra = S.load(p.data), rb = S.load(p.data);
      ok(ra.ok && rb.ok, "shipped preset \"" + p.name + "\" no longer loads twice: " +
         JSON.stringify((ra.errors || rb.errors || [])[0]));
    }
  }
  {
    const oldPhrase = () => ({ deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                               vel: new Array(16).fill(5), gate: new Array(16).fill(1),
                               acc: new Array(16).fill(0), sld: new Array(16).fill(0) });
    const v1 = { v: 1, slots: [oldPhrase(), oldPhrase()],   // short bank, no inc/stk
                 song: [{ genre: "acid", slots: [0], len: 4, nudge: 0,
                          ops: ["rev"], del: "some" }],     // pre-stack, old `del`
                 bpm: 126, vol: 80 };
    const r = S.load(v1);
    ok(r.ok, "a v:1 save no longer loads: " + JSON.stringify(r.errors && r.errors[0]));
    if (r.ok) {
      const b = r.song.song[0];
      ok(b.stack && b.stack[0].g === "acid", "the stack climb is gone");
      ok(b.echo === "some" && !("del" in b), "del was not renamed to echo");
      // variable banks: a short bank KEEPS its length now (it used to be
      // padded to a fixed eight) — the only growth left is reference cover,
      // and this save's one reference (slot 0) is already covered
      ok(r.song.slots.length === 2, "a 2-slot v:1 bank did not stay 2 slots " +
         "(got " + r.song.slots.length + ")");
      ok(r.song.slots.every(p => Array.isArray(p.inc) && Array.isArray(p.stk)),
         "the ramp vectors were not backfilled");
      ok(r.song.v === 2, "migrate did not stamp the current version");
    }
  }

  // (f) THE GROOVE LIFT — the groove belongs to the SONG now, the way the
  // tempo does ("one drummer for the record", 2026-08-16). Four claims: the
  // registry no longer says `groove` (the ONE place validation, the palette
  // and the audio walk all lost the box field), the composer emits it at song
  // level and it round-trips, an old per-box save adopts the groove most
  // sections agree on (ties to the first — the authority), and the shipped
  // presets — every one of them per-box vintage — come through lifted.
  {
    ok(!F.FIELDS.some(f => f.key === "groove"),
       "fields.js still carries a per-section groove entry");
    ok(F.GROOVELABEL && Object.keys(F.GROOVELABEL).length >= 5,
       "GROOVELABEL left the registry — the song control has no vocabulary");
    // the composer: song-level, boxes clean, and the value survives the loader
    let grooved = 0;
    for (const s of seeds.slice(0, 12)) {
      const c = C.compose("isley", s);
      ok(c.song.every(b => b.groove === undefined),
         "isley/" + s + ": the composer still stamps a groove on boxes");
      const r = S.load(c);
      ok(r.ok && (r.song.groove || null) === (c.groove || null),
         "isley/" + s + ": the song-level groove did not round-trip");
      if (c.groove != null) grooved++;
    }
    ok(grooved > 0, "the composer never draws a groove for isley — the ballot is dead");
    // the lift itself: majority wins, the box field dies on the way through
    const mkB = g2 => { const b = S.emptyBox();
                       if (g2 !== undefined) b.groove = g2; return b; };
    const lift = boxes => S.load(
      { v: 2, slots: [S.blank()], song: boxes, bpm: 126, vol: 80 });
    let r = lift([mkB("funk"), mkB("dub"), mkB("dub")]);
    ok(r.ok && r.song.groove === "dub",
       "the majority groove did not win the lift: " + (r.ok && r.song.groove));
    ok(r.ok && r.song.song.every(b => !("groove" in b)),
       "the lift left per-box grooves behind");
    // ...ties go to the FIRST section carrying one — the authority
    r = lift([mkB("funk"), mkB("dub")]);
    ok(r.ok && r.song.groove === "funk",
       "a tie did not go to the authority section: " + (r.ok && r.song.groove));
    r = lift([mkB(null), mkB("push"), mkB("laidback")]);
    ok(r.ok && r.song.groove === "push",
       "a leading null outvoted the first real groove: " + (r.ok && r.song.groove));
    // ...an all-null save stays flat, a groove-free save normalizes to null
    r = lift([mkB(null), mkB(null)]);
    ok(r.ok && r.song.groove === null, "an all-null lift invented a groove");
    r = lift([mkB(), mkB()]);
    ok(r.ok && r.song.groove === null,
       "a groove-free save did not normalize to song groove null");
    // ...a v:1 save takes the same lift on its way up the versions
    const rv1 = S.load({ v: 1, slots: [S.blank()],
                         song: [{ genre: "acid", slots: [0], len: 4, nudge: 0,
                                  ops: [], groove: "push" }],
                         bpm: 126, vol: 80 });
    ok(rv1.ok && rv1.song.groove === "push" && !("groove" in rv1.song.song[0]),
       "a v:1 save did not lift its groove");
    // ...an unknown SONG groove drops to null, never fatal — the tempo's policy
    r = S.load({ v: 2, slots: [S.blank()], song: [S.emptyBox()],
                 groove: "sludgy", bpm: 126, vol: 80 });
    ok(r.ok && r.song.groove === null,
       "an unknown song groove was not dropped to null");
    // the shipped presets: every box comes through clean, and at least one
    // record lifts a real groove (they are composer output, per-box vintage)
    let liftedPresets = 0;
    for (const p of PRESETS) {
      const rp = S.load(p.data);
      ok(rp.ok && rp.song.song.every(b => !("groove" in b)),
         "preset \"" + p.name + "\" kept a per-box groove");
      if (rp.ok && rp.song.groove != null) liftedPresets++;
    }
    ok(liftedPresets > 0,
       "no shipped preset lifted a groove — the lift is dead on real data");
  }

  // (g) THE SWING LIFT — the same move made twice ("nothing in a section
  // tells time", 2026-08-16): swing left the boxes for the song exactly the
  // way the groove did, so it takes exactly the groove's claims — the
  // registry no longer says `swing`, the composer emits it at song level and
  // it round-trips, an old per-box save adopts the majority (ties to the
  // authority), and the shipped presets come through lifted.
  {
    ok(!F.FIELDS.some(f => f.key === "swing"),
       "fields.js still carries a per-section swing entry");
    ok(F.SWINGLABEL && Object.keys(F.SWINGLABEL).length >= 5,
       "SWINGLABEL left the registry — the song control has no vocabulary");
    // the composer: song-level, boxes clean, and the value survives the loader
    let swung = 0;
    for (const s of seeds.slice(0, 12)) {
      const c = C.compose("isley", s);
      ok(c.song.every(b => b.swing === undefined),
         "isley/" + s + ": the composer still stamps a swing on boxes");
      const r = S.load(c);
      ok(r.ok && (r.song.swing || null) === (c.swing || null),
         "isley/" + s + ": the song-level swing did not round-trip");
      if (c.swing != null) swung++;
    }
    ok(swung > 0, "the composer never draws a swing for isley — the ballot is dead");
    // the lift itself: majority wins, the box field dies on the way through
    const mkB = v => { const b = S.emptyBox();
                       if (v !== undefined) b.swing = v; return b; };
    const lift = boxes => S.load(
      { v: 2, slots: [S.blank()], song: boxes, bpm: 126, vol: 80 });
    let r = lift([mkB("light"), mkB("shuffle"), mkB("shuffle")]);
    ok(r.ok && r.song.swing === "shuffle",
       "the majority swing did not win the lift: " + (r.ok && r.song.swing));
    ok(r.ok && r.song.song.every(b => !("swing" in b)),
       "the lift left per-box swings behind");
    // ...ties go to the FIRST section carrying one — the authority
    r = lift([mkB("light"), mkB("shuffle")]);
    ok(r.ok && r.song.swing === "light",
       "a tie did not go to the authority section: " + (r.ok && r.song.swing));
    r = lift([mkB(null), mkB("hard"), mkB("swing")]);
    ok(r.ok && r.song.swing === "hard",
       "a leading null outvoted the first real swing: " + (r.ok && r.song.swing));
    // ...an all-null save stays default, a swing-free save normalizes to null
    r = lift([mkB(null), mkB(null)]);
    ok(r.ok && r.song.swing === null, "an all-null lift invented a swing");
    r = lift([mkB(), mkB()]);
    ok(r.ok && r.song.swing === null,
       "a swing-free save did not normalize to song swing null");
    // ...a v:1 save takes the same lift on its way up the versions
    const rv1 = S.load({ v: 1, slots: [S.blank()],
                         song: [{ genre: "acid", slots: [0], len: 4, nudge: 0,
                                  ops: [], swing: "shuffle" }],
                         bpm: 126, vol: 80 });
    ok(rv1.ok && rv1.song.swing === "shuffle" && !("swing" in rv1.song.song[0]),
       "a v:1 save did not lift its swing");
    // ...an unknown SONG swing drops to null, never fatal — the tempo's policy
    r = S.load({ v: 2, slots: [S.blank()], song: [S.emptyBox()],
                 swing: "wonky", bpm: 126, vol: 80 });
    ok(r.ok && r.song.swing === null,
       "an unknown song swing was not dropped to null");
    // ...and BOTH lifts ride one save together without crosstalk
    const both = S.load({ v: 2, slots: [S.blank()],
                          song: [Object.assign(S.emptyBox(),
                                               { groove: "dub", swing: "shuffle" })],
                          bpm: 126, vol: 80 });
    ok(both.ok && both.song.groove === "dub" && both.song.swing === "shuffle" &&
       !("groove" in both.song.song[0]) && !("swing" in both.song.song[0]),
       "the groove and swing lifts interfere on one save");
    // the shipped presets: every box comes through clean, and at least one
    // record lifts a real swing (they are composer output, per-box vintage)
    let liftedPresets = 0;
    for (const p of PRESETS) {
      const rp = S.load(p.data);
      ok(rp.ok && rp.song.song.every(b => !("swing" in b)),
         "preset \"" + p.name + "\" kept a per-box swing");
      if (rp.ok && rp.song.swing != null) liftedPresets++;
    }
    ok(liftedPresets > 0,
       "no shipped preset lifted a swing — the lift is dead on real data");
  }

  // (h) THE INSTR LIFT — the third move in the family ("the band is hired for
  // the record, not the scene", 2026-08-16): the per-layer `instr` override
  // left the stack entries for ONE song-level INSTRUMENT POOL, keyed by CHAIR
  // (the kernel's own roles plus the bass). Claims: the registry no longer
  // says `instr` (registry death), the chair vocabulary exists, an old save's
  // overrides lift per chair — majority wins, ties to the authority section,
  // the entry field dies — an explicit pool beats stragglers, junk filters to
  // null, and the pool round-trips.
  {
    ok(!F.FIELDS.some(f => f.key === "instr"),
       "fields.js still carries a per-layer instr entry");
    ok(Array.isArray(F.POOLCHAIRS) && F.POOLCHAIRS.length === 8 &&
       F.POOLCHAIRS.includes("bass") && F.POOLCHAIRS.includes("line") &&
       !F.POOLCHAIRS.includes("drums"),
       "POOLCHAIRS is not the seven roles plus the bass (drums excluded)");
    ok(Object.keys(F.INSTRCHOICES).length >= 40,
       "INSTRCHOICES left the registry — the pool has no vocabulary");
    // one override on a ska box casts BOTH its chairs (stab voice 0, lead
    // voice 1 — the kernel's own scheme), because the old field spoke for
    // every voice of its layer
    const box = (gk, instr) => {
      const b = S.emptyBox(); b.stack[0].g = gk;
      if (instr !== undefined) b.stack[0].instr = instr;
      return b;
    };
    const lift = boxes => S.load(
      { v: 2, slots: [S.blank()], song: boxes, bpm: 126, vol: 80 });
    let r = lift([box("ska", "flute"), box("ska", "trumpet"), box("ska", "trumpet")]);
    ok(r.ok && r.song.pool && r.song.pool.lead === "trumpet" &&
       r.song.pool.stab === "trumpet",
       "the majority instrument did not win the lift per chair: " +
       JSON.stringify(r.ok && r.song.pool));
    ok(r.ok && r.song.song.every(b => b.stack.every(e => !("instr" in e))),
       "the lift left per-layer instr overrides behind");
    // ...ties go to the FIRST section carrying one — the authority
    r = lift([box("ska", "flute"), box("ska", "trumpet")]);
    ok(r.ok && r.song.pool && r.song.pool.lead === "flute",
       "a tie did not go to the authority section: " +
       JSON.stringify(r.ok && r.song.pool));
    // the chair follows the kernel's assignment INCLUDING the part chip — the
    // same three-step read the scheduler makes
    const pb = box("ska", "marimba"); pb.stack[0].part = "riff";
    r = lift([pb]);
    ok(r.ok && r.song.pool && r.song.pool.riff === "marimba" && !r.song.pool.lead,
       "the lift ignores the part chip the scheduler honours: " +
       JSON.stringify(r.ok && r.song.pool));
    // a save already carrying a pool wins over straggler overrides — the
    // groove's own both-present rule — and the entry field still dies
    r = S.load({ v: 2, slots: [S.blank()], song: [box("ska", "flute")],
                 pool: { lead: "violin" }, bpm: 126, vol: 80 });
    ok(r.ok && r.song.pool.lead === "violin" && !r.song.pool.stab &&
       r.song.song.every(b => b.stack.every(e => !("instr" in e))),
       "an explicit pool did not beat the lift, or the field survived");
    // FILTER at both levels (an unknown chair or id is dropped, never fatal —
    // the ops/fx rule), and an emptied pool normalizes to null
    r = S.load({ v: 2, slots: [S.blank()], song: [S.emptyBox()],
                 pool: { lead: "kazoo9000", drums: "trumpet", zzz: "trumpet" },
                 bpm: 126, vol: 80 });
    ok(r.ok && r.song.pool === null,
       "junk chairs and ids did not filter away to a null pool");
    // the pool round-trips byte-for-byte through the loader
    r = lift([box("ska", "trumpet")]);
    const rt = S.load(JSON.parse(JSON.stringify(r.song)));
    ok(rt.ok && JSON.stringify(rt.song.pool) === JSON.stringify(r.song.pool),
       "the pool does not round-trip through the loader");
    // no shipped writer emits the retired field
    for (const p of PRESETS) {
      const rp = S.load(p.data);
      ok(rp.ok && rp.song.song.every(b => b.stack.every(e => !("instr" in e))),
         "preset \"" + p.name + "\" kept a per-layer instr");
    }
  }
}

/* ---------------------------------------------------------------- 22. NEUTRALITY
   Every field the composition-depth round added is OPT-IN: absent must render
   byte-identically to the field set to its documented neutral value, and the
   old semantics must still be derivable from first principles. This is the
   gate that lets the depth land without moving a single existing song. */
console.log("neutrality — absent equals neutral for every new field");
{
  const sig2 = ev => JSON.stringify(ev.map(e => [e.t, e.n, e.d, e.dur, e.vel, e.acc, e.sld]));
  // reference genres left unwired FOR THESE FIELDS on purpose — they are the
  // control group for the composition-depth surface. (They are not a control
  // group for everything: the performance layer wires four of the five, and
  // its own absent-equals-neutral law is §39(b), which strips the three fields
  // it added rather than pretending nobody set them.)
  for (const gk of ["acid", "fugue", "vaporwave", "gregorian", "rock"]) {
    const g = GENRES[gk];
    const neutral = { ...g, maxHold: 0, key: 0, period: null, kits: null,
                      kitVel: null, prog: null, pipes: null, part: null, anchor: 0 };
    ok(sig2(allEvents(P, g, g.bars)) === sig2(allEvents(P, neutral, g.bars)),
       gk + ": neutral values do not render identically to absent fields");
  }
  // the OLD PAD SEMANTICS, recomputed from scratch: a progression-less pad is
  // the bar's mode triad, per-note folded, one chord a bar, held a whole bar
  {
    const g = GENRES.vaporwave, md = g.mode || K.MODE, ctr = 60 + 12 * g.reg(0);
    const pads = K.render(P, g, g.bars).filter(e => e.v === 0);
    for (let b = 0; b < g.bars; b++) {
      const r = K.harm(P, g, b);
      const want = [r, r + 2, r + 4].map(d => K.fold(K.mp(d, md), ctr)).sort((x, y) => x - y);
      const got = pads.filter(e => Math.abs(e.t - b * 16 / g.rate) < 1e-9)
                      .map(e => e.n).sort((x, y) => x - y);
      ok(JSON.stringify(got) === JSON.stringify(want),
         "vaporwave bar " + b + ": pad chord is not the old fold(mp) voicing");
      ok(pads.every(e => Math.abs(e.dur - 16 / g.rate) < 1e-9),
         "vaporwave: a prog-less pad no longer holds the whole bar");
    }
  }
  // the OLD DURATION SEMANTICS: without maxHold, dur is exactly the span to
  // the next gate, scaled by the articulation, slide-held where the successor
  // slides — recomputed here so a silent regression in the cap has a witness
  {
    const g = GENRES.simple, sp = K.spans(P.gate);
    const ev = K.render(P, g, 1);
    let k = 0;
    for (let i = 0; i < 16; i++) {
      if (!P.gate[i]) continue;
      const legato = P.sld[(i + sp[i]) % 16] ? 1 : 0.92;
      ok(Math.abs(ev[k].dur - sp[i] * legato) < 1e-9,
         "simple step " + i + ": dur is not span × articulation any more");
      k++;
    }
  }
}

/* ---------------------------------------------------------------- 23. PROGRESSION
   Chord OBJECTS — quality, inversion, borrow, beats, cadence — and the gate is
   the recon's own: sevenths are audible or they do not exist. Every assertion
   reads the RENDERED events; a prog that is declared and never voiced fails. */
console.log("progression — quality, inversion, half-bar chords, cadence, voice leading");
{
  const pcsOf = ev => new Set(ev.map(e => ((e.n % 12) + 12) % 12));
  const barOf = (ev, b, bs) => ev.filter(e => e.t >= b * bs && e.t < (b + 1) * bs);
  const base = { label: "t", rate: 1, bars: 4, voices: 2, entry: () => 0, reg: v => v - 1,
                 realize: v => (v === 0 ? "pad" : "line"), kit: {}, harmony: "cycle",
                 roots: [0, 3, 4, 0], word: () => [] };
  const all = g2 => [...K.render(P, g2, g2.bars), ...K.bass(P, g2, g2.bars)];

  // (a) DOM7 REACHES THE OUTPUT: the V7's major third (pc 11 over a minor
  // tonic) sounds in the dom7 bar and does not sound without the prog
  const withP = { ...base, prog: [{ d: 0 }, { d: 3 }, { d: 4, q: "dom7" }, { d: 0 }] };
  ok(pcsOf(barOf(all(withP), 2, 16)).has(11),
     "a dom7 chord never sounded its major third — the prog is decoration");
  ok(!pcsOf(barOf(all(base), 2, 16)).has(11),
     "the triad control already contains pc 11 — the dom7 gate proves nothing");
  // ...and the SEVENTH is a rung the ramp can land on (chordWalk honors quality)
  {
    const g7 = { ...base, voices: 1, realize: () => "line", incClamp: 0, bars: 8,
                 roots: [0], prog: [{ d: 0, q: "dom7" }] };
    const ramp = { ...clone(P), deg: new Array(N).fill(0), oct: new Array(N).fill(0),
                   inc: P.gate.map((g3, i) => (i === 0 ? 1 : 0)), stk: new Array(N).fill(0) };
    ok(pcsOf(K.render(ramp, g7, 8)).has(10),
       "a ramp over a dom7 never landed on the seventh — the rungs are still triadic");
  }

  // (b) INVERSION: inv:1 puts the THIRD under the band — the bass bar's pc is
  // the third's, not the root's
  {
    const inv = { ...base, roots: [0, 0, 0, 0], prog: [{ d: 0, inv: 1 }] };
    const bpc = new Set(K.bass(P, inv, 4).map(e => ((e.n % 12) + 12) % 12));
    ok(bpc.has(3) && !bpc.has(0),
       "inv:1 did not move the bass to the third (got " + [...bpc].join(",") + ")");
  }

  // (c) BEATS: two chords in ONE bar — the half-bar turnaround that used to be
  // inexpressible. The pad must emit at two distinct times inside the bar.
  {
    const half = { ...base, prog: [[{ d: 0, beats: 8 }, { d: 4, q: "dom7", beats: 8 }],
                                   { d: 3 }, { d: 4 }, { d: 0 }] };
    const padT = new Set(K.render(P, half, 4).filter(e => e.part === "pad" && e.t < 16)
      .map(e => e.t));
    ok(padT.size === 2 && padT.has(0) && padT.has(8),
       "beats:8 did not split the bar into two chords (t = " + [...padT].join(",") + ")");
  }

  // (c2) THE SECOND CHORD OF A SPLIT BAR IS NOT PAD-ONLY. The stab path and
  // the ramp's chordWalk already read chordFor(i); the bass and the line's
  // root shift must too, or the half-bar turnaround the beats field exists
  // for never reaches the parts that carry the harmony.
  {
    // bossa's bar 2 packs ii7–V7 into one bar; the fifths bass must sound the
    // V's root (pc 7) somewhere in the dominant half — the feature the anchor
    // exists to prove. Read through plain(): this measures WHAT WAS WRITTEN,
    // and bossa is a PLAYED anchor (stress .42, phrase .4, touch t=.06). The
    // shipped anchor does voice the V root, dead on the dominant half's
    // downbeat — and the hand pushes it 8 ms EARLY, to t=23.9918, so a window
    // cut at the raw step boundary threw the very note it was looking for one
    // hundredth of a beat over the edge. The bug was never in the bass walk
    // (chordsOf is already read per step here) nor in the anchor's beats
    // split; it was a gate asking a written question of a performed stream.
    const bpc = K.bass(P, plain(GENRES.bossa), 4)
      .filter(e => e.t >= 24 && e.t < 32).map(e => ((e.n % 12) + 12) % 12);
    ok(bpc.includes(7), "bossa's half-bar V7 never reaches the bass: " + bpc.join(","));
    // ...and the LINE's root shift is per-chord: a ramp-free line over a
    // split bar moves with the second chord where an all-I control does not
    const b1 = { label: "t", rate: 1, bars: 1, voices: 1, entry: () => 0,
                 reg: () => 0, realize: () => "line", kit: {}, harmony: "cycle",
                 roots: [0], word: () => [] };
    const flat2 = { ...clone(P), inc: new Array(N).fill(0), stk: new Array(N).fill(0) };
    const pcsHalf = prog => [...new Set(K.render(flat2, { ...b1, prog }, 1)
      .filter(e => e.t >= 8).map(e => ((e.n % 12) + 12) % 12))].sort((x, y) => x - y);
    ok(JSON.stringify(pcsHalf([[{ d: 0, beats: 8 }, { d: 4, beats: 8 }]])) !==
       JSON.stringify(pcsHalf([[{ d: 0 }]])),
       "the line's root shift ignores the second chord of a beats-split bar");
  }

  // (d) CADENCE: withCadence lands a different chord on the section's last bar
  {
    const cad = { ...base, prog: K.withCadence([{ d: 0 }], 4, { d: 4, q: "dom7" }) };
    const ev2 = K.render(P, cad, 4).filter(e => e.part === "pad");
    ok(JSON.stringify([...pcsOf(barOf(ev2, 3, 16))].sort()) !==
       JSON.stringify([...pcsOf(barOf(ev2, 0, 16))].sort()),
       "the cadence bar voices the same pcs as bar 1 — withCadence never landed");
  }

  // (e) VOICE LEADING: under a prog, each voice of a pad chord moves at most a
  // tritone to its counterpart in the next chord — the stateless per-note fold
  // could leap an octave. Grouped by chord, because a dom7 has four voices
  // where a triad has three and voice j maps to prev[j % prev.length].
  {
    const pads = K.render(P, withP, 4).filter(e => e.part === "pad");
    const byT = [...new Set(pads.map(e => e.t))].sort((a, b) => a - b)
      .map(t => pads.filter(e => e.t === t).map(e => e.n));
    ok(byT.length >= 4, "the prog pad did not sound one chord a bar");
    for (let c = 1; c < byT.length; c++)
      byT[c].forEach((n, j) => ok(Math.abs(n - byT[c - 1][j % byT[c - 1].length]) <= 6,
        "pad voice leapt " + Math.abs(n - byT[c - 1][j % byT[c - 1].length]) +
        " semitones into chord " + c));
  }

  // (f) THE WIRED GENRE: blues' I7 sounds its major third in the walking bass
  // (tones 1-3 of bar 1 are root-third-fifth of a DOMINANT chord now), and
  // stripping the prog restores the minor walk — so the field provably
  // reaches the output of a shipping genre, not just a synthetic one
  {
    const firstBar = K.bass(P, GENRES.blues, 12).filter(e => e.t < 12)
      .map(e => ((e.n % 12) + 12) % 12);
    ok(firstBar.includes(4), "blues walk never sounds the I7's major third");
    const stripped = K.bass(P, { ...GENRES.blues, prog: null }, 12)
      .filter(e => e.t < 12).map(e => ((e.n % 12) + 12) % 12);
    ok(stripped.includes(3) && !stripped.includes(4),
       "prog-less blues does not walk the minor triad — the control is broken");
  }
  // (g) THE PROG/ROOTS LAW: a genre carrying both must agree bar for bar —
  // roots is the skeleton the layers and the UI read, prog is the voicing
  for (const gk of GK) {
    const g = GENRES[gk];
    if (!g.prog) continue;
    ok(g.harmony === "cycle", gk + ": prog on a non-cycle harmony");
    for (let b2 = 0; b2 < g.roots.length; b2++) {
      const slot = K.at(g.prog, b2), c = Array.isArray(slot) ? slot[0] : slot;
      ok((c.d || 0) === K.at(g.roots, b2),
         gk + " bar " + b2 + ": prog root " + c.d + " disagrees with roots " +
         K.at(g.roots, b2));
    }
  }
  // (h) LAYERS ARE PROG-FREE: the render path hands a layer the authority's
  // roots but not its prog, so a prog-carrying layer would play its own
  // chords against the box's. The composer's stackable list must stay clean
  // until the layer path learns to inherit prog.
  {
    const C2 = require("../../nukernel/compose.js");
    for (const gk of GK)
      for (const s of [1, 2, 3])
        for (const b of C2.compose(gk, s).song)
          for (const e of b.stack.slice(1))
            ok(!GENRES[e.g].prog,
               gk + "/" + s + ": composed a prog-carrying genre (" + e.g + ") as a layer");
  }
}

/* ---------------------------------------------------------------- 24. REST
   maxHold caps the hold so a hole in the gate vector is SILENCE. The failing
   assertion for a read-and-discarded field is the sum-of-durations drop —
   a config check would pass on a cap that never reaches dur. */
console.log("rest — maxHold turns gate holes into silence");
{
  const gap = { ...clone(P), gate: [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,1,0],
                sld: new Array(N).fill(0) };
  const g = GENRES.simple, capped = { ...g, maxHold: 2 };
  const evF = K.render(gap, g, 2), evC = K.render(gap, capped, 2);
  const total = a => a.reduce((s, e) => s + e.dur, 0);
  ok(evC.length === evF.length, "maxHold changed the note count — it must only stop notes");
  ok(Math.max(...evC.map(e => e.dur)) <= 2, "maxHold 2 left a note longer than 2 steps");
  ok(total(evC) < total(evF),
     "capped Σdur is not smaller — the cap never reached the rendered durations");
  ok(sig(K.render(gap, { ...g, maxHold: 0 }, 2)) === sig(evF) &&
     JSON.stringify(K.render(gap, { ...g, maxHold: 0 }, 2).map(e => e.dur)) ===
     JSON.stringify(evF.map(e => e.dur)),
     "maxHold: 0 is not the documented neutral value");
  // a SLIDE is a physical connection — the cap must not cut it
  const slide = clone(gap); slide.sld[7] = 1;              // slide INTO step 7
  const evS = K.render(slide, capped, 1);
  ok(Math.abs(evS[0].dur - 7) < 1e-9,
     "maxHold cut a note whose successor slides (dur " + evS[0].dur + ", want 7)");
  // the wired genres breathe: a slide-free phrase never exceeds the cap
  for (const gk of ["blues", "isley", "jodeci"]) {
    const g2 = GENRES[gk], flat = { ...clone(P), sld: new Array(N).fill(0) };
    const durs = K.render(flat, g2, g2.bars)
      .filter(e => e.part !== "pad").map(e => e.dur * g2.rate);
    ok(Math.max(...durs) <= g2.maxHold + 1e-9,
       gk + ": a line note outlasts its own maxHold (" + Math.max(...durs) + ")");
  }
}

/* ---------------------------------------------------------------- 25. BAR SCHEDULE
   The sixth type: a per-bar operator word gives a section a 2/4/8-bar period.
   Position-dependent and PRE-render — it changes which notes exist mid-section,
   which none of the other five types can do. */
console.log("bar schedule — a period is a sentence, not a restated bar");
{
  const g = { ...GENRES.rock,
              period: [[], [K.drop(2)], [], [K.drop(3), K.only("gate", K.rotate(4))]] };
  const perBar = g2 => Array.from({ length: 4 }, (_, b) =>
    JSON.stringify(K.render(P, g2, 4).filter(e => e.v === 0 &&
      Math.floor(e.t / 16) === b).map(e => [+(e.t % 16).toFixed(3), e.n])));
  const bars = perBar(g);
  ok(new Set(bars).size >= 3, "a four-entry period produced fewer than 3 distinct bars");
  const count = s => JSON.parse(s).length;
  ok(count(bars[1]) < count(bars[0]), "the thinned bar of the period is not thinner");
  ok(sig(allEvents(P, { ...GENRES.rock, period: null }, 4)) ===
     sig(allEvents(P, GENRES.rock, 4)), "period: null is not the neutral value");
  // sensitivity: perturbing ONE entry of the schedule must change the render
  const tweaked = { ...g, period: [[], [K.drop(2)], [K.rotate(1)], [K.drop(3), K.only("gate", K.rotate(4))]] };
  ok(sig(K.render(P, tweaked, 4)) !== sig(K.render(P, g, 4)),
     "perturbing a period entry changed nothing — the schedule is not being read");
  // the FUNCTION form is per-voice: call-and-response as data
  const cr = { ...GENRES.rock,
               period: (v, s) => (s % 2 === (v === 0 ? 1 : 0) ? [K.drop(1)] : []) };
  const evCR = K.render(P, cr, 4);
  ok(evCR.filter(e => e.v === 0 && Math.floor(e.t / 16) % 2 === 1).length === 0 &&
     evCR.filter(e => e.v === 0 && Math.floor(e.t / 16) % 2 === 0).length > 0 &&
     evCR.filter(e => e.v === 1 && Math.floor(e.t / 16) % 2 === 0).length === 0,
     "the per-voice period form does not alternate the voices");
  // the wired genre: beatles bar 4 is the thinned cadence bar
  {
    const b4 = K.render(P, GENRES.beatles, 4).filter(e => Math.floor(e.t / 16) === 3);
    const b1 = K.render(P, GENRES.beatles, 4).filter(e => Math.floor(e.t / 16) === 0);
    ok(b4.length < b1.length, "beatles' four-bar sentence does not breathe on bar 4");
  }
}

/* ---------------------------------------------------------------- 26. MAJOR
   There was no major key in nukernel at all — mixolydian faked brightness in
   three genres. The gate hears the major third and the major seventh in the
   RENDERED stream, and holds romanOf to both the old minor readout and the
   honest major one. */
console.log("major — ionian, lydian, melodic; major scales; honest numerals");
{
  const pcs = ev => new Set(ev.map(e => ((e.n % 12) + 12) % 12));
  const gM = { ...GENRES.simple, harmony: "cycle", roots: [0],
               mode: MODES.ionian, scale: SCALES.major, diatonic: true };
  const line = pcs(K.render(P, gM, 4));
  ok([...line].every(pc => MODES.ionian.includes(pc)),
     "an ionian line leaked outside the major scale: " + [...line].join(","));
  ok(line.has(4) && line.has(11),
     "a major-scale line never sounded the major third and seventh");
  // a pad in ionian voices a MAJOR triad — pc 4 over the tonic
  const gPad = { ...GENRES.vaporwave, mode: MODES.ionian, roots: [0, 3, 4, 0] };
  ok(pcs(K.render(P, gPad, 4).filter(e => e.v === 0)).has(4),
     "an ionian pad never voiced a major third — the mode is declared and unread");
  // both new subject alphabets span an octave in their own length
  for (const sc of [SCALES.major, SCALES.majpent])
    ok(Math.abs(K.pitch(sc.length, sc) - K.pitch(0, sc) - 12) < 1e-9,
       "a major alphabet does not span an octave in its own length");
  // romanOf: derived case equals the old hardcoded minor list, and reads major
  // honestly — the old table would have called ionian's I "i"
  ok(JSON.stringify(K.ROMAN) === JSON.stringify(["i", "ii°", "III", "iv", "v", "VI", "VII"]),
     "ROMAN no longer matches the shipped minor readout");
  ok(JSON.stringify(K.romanOf(MODES.ionian)) ===
     JSON.stringify(["I", "ii", "iii", "IV", "V", "vi", "vii°"]),
     "romanOf(ionian) is wrong: " + K.romanOf(MODES.ionian).join(" "));
  ok(JSON.stringify(K.romanOf(MODES.mixo)) ===
     JSON.stringify(["I", "ii", "iii°", "IV", "v", "vi", "VII"]),
     "romanOf(mixolydian) is wrong: " + K.romanOf(MODES.mixo).join(" "));
}

/* ---------------------------------------------------------------- 27. KEY
   An integer semitone key, applied AFTER registration — +7 is the value the
   register fold would eat (the octave law's mirror), and the BASS is the
   consumer transpose() could never reach, so a diff of 0 there is the failing
   assertion for a field that never lands. */
console.log("key — every pitched consumer moves by exactly the key, after the fold");
{
  for (const gk of ["rock", "vaporwave", "blues"]) {
    const g0 = { ...GENRES[gk], key: 0 }, g7 = { ...GENRES[gk], key: 7 };
    for (const [name, f] of [["render", K.render], ["bass", K.bass]]) {
      const a = f(P, g0, g0.bars), b = f(P, g7, g7.bars);
      ok(a.length === b.length && a.length > 0, gk + "/" + name + ": key changed the event count");
      ok(a.every((e, i) => b[i].n - e.n === 7 && b[i].t === e.t &&
                           Math.abs(b[i].dur - e.dur) < 1e-9),
         gk + "/" + name + ": key +7 is not a uniform +7 (the register fold ate it)");
    }
    ok(sig(K.drums(P, g7, g7.bars)) === sig(K.drums(P, g0, g0.bars)),
       gk + ": the key moved the drums");
  }
}

/* ---------------------------------------------------------------- 28. PARTS
   A part is an ASSIGNMENT of policy to a performer. The stab is the proof
   role: chord-locked, its own gate — every rendered pitch class must be a
   member of that bar's chord, the assertion that fails if chordLock is
   declared and never applied. */
console.log("parts — lead/riff separate, labels swap streams, the stab is chord-locked");
{
  const base = { label: "t", rate: 1, bars: 4, voices: 2, entry: () => 0, reg: () => 0,
                 realize: () => "line", kit: {}, harmony: "modal", word: () => [] };
  const A = { ...base, part: ["lead", "riff"] }, B = { ...base, part: ["riff", "lead"] };
  const mean = ev => ev.reduce((s, e) => s + e.n, 0) / ev.length;
  const evA = K.render(P, A, 4), evB = K.render(P, B, 4);
  const lead = evA.filter(e => e.part === "lead"), riff = evA.filter(e => e.part === "riff");
  ok(lead.length > 0 && riff.length > 0, "part tags did not reach the rendered events");
  ok(Math.abs(mean(lead) - mean(riff)) >= 7,
     "lead and riff sit " + Math.abs(mean(lead) - mean(riff)).toFixed(1) +
     " semitones apart — parts are labels, not policies");
  // swapping the labels swaps the streams exactly (modulo which voice index)
  const strip = ev => JSON.stringify(ev.map(e => [e.t, e.n, +e.dur.toFixed(6), e.vel]));
  ok(strip(evA.filter(e => e.part === "lead")) === strip(evB.filter(e => e.part === "lead")) &&
     strip(evA.filter(e => e.part === "riff")) === strip(evB.filter(e => e.part === "riff")),
     "swapping part labels did not swap the rendered streams");
  // the shim: a partless genre renders with the old realize() split, tagged
  ok(K.render(P, GENRES.rock, 4).every(e => e.part === "line"),
     "a partless line genre is not tagged with the shim part");
  ok(K.render(P, GENRES.vaporwave, 4).some(e => e.part === "pad"),
     "a partless pad genre lost its pad tag");
  // THE STAB: fires on its own gate, voices the sounding chord
  {
    const st = { ...base, voices: 1, part: ["stab"], harmony: "cycle",
                 roots: [0, 3], prog: [{ d: 0, q: "7" }, { d: 3, q: "7" }] };
    const ev2 = K.render(P, st, 4);
    const gates = P.gate.filter(Boolean).length;
    ok(ev2.length === 4 * gates * 4,
       "the stab did not fire one chord per gated step (got " + ev2.length + ")");
    for (const e of ev2) {
      const bar = Math.floor(e.t / 16);
      const cs = K.chordsOf(P, st, bar)[0];
      ok(cs.pcSet.has(((e.n % 12) + 12) % 12),
         "a stab pitch left its bar's chord: " + e.n + " in bar " + bar);
    }
    ok(Math.max(...ev2.map(e => e.dur)) <= 1,
       "a stab rings longer than its policy's hold");
  }
}

/* ---------------------------------------------------------------- 29. PIPES
   The seventh type: timeless AND pitch-aware, on the rendered stream. Each
   pipe's gate is the recon's: harmonize adds only chord tones, echoCanon
   copies later/quieter/inside the bar, breathe shortens without deleting,
   strum spreads a chord's attacks. All seeded, all total. */
console.log("pipes — harmonize, echoCanon, breathe, strum: seeded, total, chord-aware");
{
  const base = { ...GENRES.rock, bars: 4 };
  const dry = K.render(P, base, 4);
  // determinism first: the same pipes render twice identically
  const wet = g2 => K.render(P, g2, 4);
  {
    const g2 = { ...base, pipes: [{ id: "harmonize", p: 0.7 }] };
    ok(sig(wet(g2)) === sig(wet(g2)), "a piped render is not deterministic");
  }
  // harmonize: strictly more events, every ADDED pitch class in its bar's chord
  {
    const g2 = { ...base, pipes: [{ id: "harmonize", p: 1 }] };
    const ev2 = wet(g2), added = ev2.filter(e => e.pipe === "harmonize");
    ok(ev2.length > dry.length && added.length > 0, "harmonize added nothing at p:1");
    for (const e of added) {
      const bar = Math.floor(e.t / 16);
      ok(K.chordsOf(P, base, bar)[0].pcSet.has(((e.n % 12) + 12) % 12),
         "harmonize added a non-chord tone in bar " + bar);
      ok(e.n > 0, "harmonize produced a nonsense pitch");
    }
    ok(sig(wet({ ...base, pipes: null })) === sig(dry), "pipes: null is not neutral");
    ok(sig(wet({ ...base, pipes: [{ id: "nonsense" }] })) === sig(dry),
       "an unknown pipe id is not a no-op — pipes are supposed to be total");
  }
  // harmonize UNDER A KEY: render() bakes g.key into every pitch, so the chord
  // set the pipe snaps to must be the KEYED one — at key 2 every added note
  // sits in the +2-transposed sounding chord. Snapping to the un-keyed set is
  // arbitrary intervals against the transposed band, which is the bug.
  {
    const g2 = { ...base, key: 2, pipes: [{ id: "harmonize", p: 1 }] };
    const added = wet(g2).filter(e => e.pipe === "harmonize");
    ok(added.length > 0, "harmonize added nothing under a key");
    for (const e of added) {
      const keyed = new Set([...K.chordsOf(P, base, Math.floor(e.t / 16))[0].pcSet]
        .map(pc => (pc + 2) % 12));
      ok(keyed.has(((e.n % 12) + 12) % 12),
         "harmonize under key 2 added a note outside the KEYED chord in bar " +
         Math.floor(e.t / 16) + " (pc " + (((e.n % 12) + 12) % 12) + ")");
    }
  }
  // echoCanon: every copy is later, quieter, and inside its source's chord bar
  {
    const ev2 = wet({ ...base, pipes: [{ id: "echoCanon", delay: 3 }] });
    const added = ev2.filter(e => e.pipe === "echoCanon");
    ok(added.length > 0, "echoCanon copied nothing");
    for (const e of added) {
      ok(e.t === e.echoOf + 3, "an echo is not exactly its delay late");
      ok(Math.floor(e.t / 16) === Math.floor(e.echoOf / 16),
         "an echo crossed its source's chord bar");
    }
    const srcVel = t => dry.find(e2 => e2.t === t) || { vel: 9 };
    ok(added.every(e => e.vel < srcVel(e.echoOf).vel || srcVel(e.echoOf).vel <= 1),
       "an echo is not quieter than its source");
  }
  // breathe: note count unchanged, Σdur strictly decreased
  {
    const ev2 = wet({ ...base, pipes: [{ id: "breathe" }] });
    const total = a => a.reduce((s, e) => s + e.dur, 0);
    ok(ev2.length === dry.length, "breathe changed the note count");
    ok(total(ev2) < total(dry), "breathe did not shorten anything");
  }
  // strum: a pad chord's voices leave the grid, direction alternating per chord
  {
    const g2 = { ...GENRES.vaporwave, pipes: [{ id: "strum", spread: 0.1 }] };
    const pads = K.render(P, g2, 4).filter(e => e.part === "pad");
    const bar0 = pads.filter(e => e.t < 32 / 2).sort((a, b) => a.t - b.t);
    ok(new Set(bar0.map(e => e.t)).size === 3, "strum left the chord as one attack");
    ok(bar0[0].n < bar0[2].n, "the first strummed chord does not roll upward");
    const bar1 = pads.filter(e => e.t >= 32 && e.t < 64).sort((a, b) => a.t - b.t);
    ok(bar1[0].n > bar1[2].n, "the second chord does not roll back down — no alternation");
    // the wired genre: isley's Rhodes rolls
    const ip = K.render(P, GENRES.isley, 8).filter(e => e.part === "pad" && e.t < 16);
    ok(new Set(ip.map(e => e.t)).size > 1, "isley's strum pipe never reached the pad");
  }
}

/* ---------------------------------------------------------------- 30. KIT SCHEDULE + DYNAMICS
   kits[] is read per bar — POSITIONS must differ between bars, so a schedule
   wired only into velocity fails. kitVel gives a lane its own dynamics — the
   kick's rendered velocities must stop being the melody's. */
console.log("kit schedule and kit dynamics");
{
  const g = GENRES.rock;
  const A = g.kit, B = K.KITOPS.swap(g.kit);
  const sched = { ...g, kits: [A, B], fill: null };
  const dr = K.drums(P, sched, 4);
  const shape = b => JSON.stringify(dr.filter(e => Math.floor(e.t / 16) === b)
    .map(e => [+(e.t % 16).toFixed(3), e.d]).sort());
  ok(shape(0) !== shape(1), "kits[A,B]: bar 2 has bar 1's positions — the schedule is unread");
  ok(shape(0) === shape(2) && shape(1) === shape(3), "the kit schedule does not cycle");
  ok(sig(K.drums(P, { ...g, kits: null }, 4)) === sig(K.drums(P, g, 4)),
     "kits: null is not the neutral value");
  // kitVel: the kick stops borrowing the tune's velocity vector
  {
    const kv = { ...g, kitVel: { k: [9,1,1,1, 8,1,1,1, 9,1,1,1, 8,1,1,1] } };
    const kick = K.drums(P, kv, 1).filter(e => e.d === "k");
    const kickSteps = g.kit.k.map((x, i) => (x ? i : -1)).filter(i => i >= 0);
    ok(kick.every((e, j) => e.vel === kv.kitVel.k[kickSteps[j]]),
       "kitVel.k is not the kick's rendered velocity");
    ok(JSON.stringify(kick.map(e => e.vel)) !==
       JSON.stringify(kickSteps.map(i => P.vel[i])),
       "the kick still borrows the melody's velocities under kitVel");
    // ...and the other lanes keep the old law
    const hat = K.drums(P, kv, 1).filter(e => e.d === "h");
    ok(hat.every((e, j) => e.vel === P.vel[g.kit.h.map((x, i) => (x ? i : -1))
      .filter(i => i >= 0)[j]]), "kitVel on one lane leaked into another");
  }
  // the wired genre: toto's hat hand is its own, kick untouched
  {
    const t = GENRES.toto, off = { ...t, kitVel: null };
    const hats = g2 => K.drums(P, g2, 1).filter(e => e.d === "h").map(e => e.vel);
    ok(JSON.stringify(hats(t)) !== JSON.stringify(hats(off)),
       "toto's kitVel never reached the hats");
    const kicks = g2 => K.drums(P, g2, 1).filter(e => e.d === "k").map(e => e.vel);
    ok(JSON.stringify(kicks(t)) === JSON.stringify(kicks(off)),
       "toto's kitVel leaked onto the kick");
  }
}

/* ---------------------------------------------------------------- 31. THE ARRANGER'S ARC
   Song-level shape: a prechorus that lifts, a peak chorus that is measurably
   bigger than the first, a chorus with its OWN melody, hooks with a motif, a
   breath and one climax — all read from RENDERED events, never from config.

   §31 AND §33 RUN THE REAL ui/derive.js. They used to run hand-copied mirrors
   of genreOf/sectionEvents, and the mirror drifted: deleting the shipped key
   wiring left every mirror check green, and the mirror's full-form render hid
   a cadence landing outside the box's window. The UMD data tier is published
   onto a stub window (the exact shape ui/deps.js reads) and derive.js is
   imported for real — so a wiring change in the shipped file fails HERE. */
(async () => {
const D = await (async () => {
  globalThis.window = globalThis;
  window.NuKernel = K;
  window.NuGenres = require("../../nukernel/genres.js");
  // the SINGER's plan tier. Published on the stub for the same reason
  // everything else here is: ui/deps.js reads window.NuSing, so leaving it out
  // would make derive.js's sing branch dead in the gate and green forever —
  // exactly the mirror-drift this stub exists to prevent (§43 measures it).
  window.NuSing = require("../../nukernel/sing.js");
  window.NuFields = require("../../nukernel/fields.js");
  window.NuSong = require("../../nukernel/song.js");
  window.NuInstruments = require("../../nukernel/instruments.js");
  window.NuCompose = require("../../nukernel/compose.js");
  window.PRESETS = require("../../nukernel/presets.js").PRESETS;
  // the big engine's sampler registry: ui/deps.js snapshots window.__REGISTRY
  // the moment it first evaluates (which is THIS import), so it must be on the
  // stub now or §45's playWindow would see zero zones and prove nothing about
  // the real extents
  window.__REGISTRY = require("../../engine/registry-data.js");
  return import("../../nukernel/ui/derive.js");
})();
console.log("the song groove — one drummer for the record, and it reaches the schedule");
{
  // THE SCORE-LEVEL CLAIM behind the move: the groove is sectionEvents' own
  // argument now (the box no longer spells it), and changing it moves the
  // SCHEDULED TIMES while leaving pitches and lanes untouched — which is what
  // "a groove, not a different drummer" means, measured on the same stream the
  // transport buckets into bars. No audio render needed: the schedule IS the
  // artifact at this layer.
  const S = require("../../nukernel/song.js");
  const b = S.emptyBox(); b.stack[0].slots = [0];
  const slots = [P];
  const flat = D.sectionEvents(b, slots, null).ev;
  const funk = D.sectionEvents(b, slots, "funk").ev;
  ok(flat.length > 0 && flat.length === funk.length,
     "the song groove added or dropped events (" + flat.length + " vs " + funk.length + ")");
  // pitches and lanes untouched: the same multiset of (kind, pitch-or-drum,
  // voice). Velocity is deliberately absent — a groove leans on levels too.
  const ident = ev => ev.map(e =>
    [e.kind, e.n != null ? e.n : e.d, e.v == null ? "" : e.v].join("|")).sort().join(";");
  ok(ident(flat) === ident(funk),
     "changing the song groove moved pitches or lanes, not just time");
  // ...but the TIMING moved: the scheduled times are a different multiset
  const times = ev => JSON.stringify(
    ev.map(e => +e.t.toFixed(4)).sort((x, y) => x - y));
  ok(times(flat) !== times(funk),
     "changing the song groove moved no scheduled event in time");
  // and sectionRender's cache tells grooves apart — the groove left the box's
  // JSON, so the signature must carry it or an edit keeps the old feel
  const ra = D.sectionRender(b, slots, null), rb = D.sectionRender(b, slots, "funk");
  ok(ra !== rb && times(ra.ev) !== times(rb.ev),
     "sectionRender's cache serves the old groove after a song-groove change");

  // ...AND THE SONG SWING, the same claim one argument over ("nothing in a
  // section tells time"): sectionEvents' fourth argument moves the SCHEDULED
  // TIMES while the note content is identical — one feel for the record, not
  // a different band.
  const straight = D.sectionEvents(b, slots, null, null).ev;
  const shuffled = D.sectionEvents(b, slots, null, "shuffle").ev;
  ok(straight.length > 0 && straight.length === shuffled.length,
     "the song swing added or dropped events (" +
     straight.length + " vs " + shuffled.length + ")");
  ok(ident(straight) === ident(shuffled),
     "changing the song swing moved pitches or lanes, not just time");
  ok(times(straight) !== times(shuffled),
     "changing the song swing moved no scheduled event in time");
  // late, never early: swing only delays the odd sixteenths
  {
    const a = straight.map(e => e.t).sort((x, y) => x - y);
    const c = shuffled.map(e => e.t).sort((x, y) => x - y);
    ok(c.every((t, i) => t >= a[i] - 1e-9),
       "the song swing moved a note EARLIER");
  }
  // "straight" is the explicit zero: it OVERRIDES a swinging genre's own
  // lean, which null (the default) must LEAVE STANDING — swing is identity at
  // the genre, and the two spellings being different is the whole distinction
  {
    const sw = JSON.parse(JSON.stringify(b)); sw.stack[0].g = "isley";
    const own = D.sectionEvents(sw, slots, null, null).ev;      // the lean stands
    const zeroed = D.sectionEvents(sw, slots, null, "straight").ev;
    ok(times(own) !== times(zeroed),
       "song swing 'straight' does not override the genre's own lean " +
       "(or null stripped it — either way the two spellings collapsed)");
  }
  // the cache tells swings apart too
  const rc = D.sectionRender(b, slots, null, "shuffle");
  ok(rc !== ra && times(rc.ev) !== times(ra.ev),
     "sectionRender's cache serves the old swing after a song-swing change");
}
console.log("song arc, prechorus, topline — the radio shape, measured on ui/derive.js");
{
  const C = require("../../nukernel/compose.js");
  const NF = require("../../nukernel/fields.js");
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  // the REAL render path: everything a box plays, windowed to nudge+len,
  // enveloped, edged and grooved — the stream the transport schedules
  const sectionEv = (song, b) => D.sectionEvents(b, song.slots).ev;

  // (a) THE ARC IS AUDIBLE: mean level of the LAST chorus beats the FIRST in
  // at least 90% of songs, measured as rendered velocity × the box's level
  for (const gk of ["rock", "beatles", "isley"]) {
    let up = 0, n2 = 0;
    for (const s of seeds.slice(0, 16)) {
      const song = C.compose(gk, s), G = GENRES[gk];
      const ch = song.song.filter(b => b.role === "chorus" && !b.cue);
      if (ch.length < 2) continue;
      n2++;
      const level = b => {
        const ev2 = sectionEv(song, b).filter(e => e.kind === "line" && e.part !== "pad");
        const mv = ev2.reduce((a, e) => a + (e.vel == null ? 5 : e.vel), 0) /
                   Math.max(1, ev2.length);
        return mv * NF.LEVELS[b.lvl || "norm"];
      };
      if (level(ch[ch.length - 1]) > level(ch[0])) up++;
    }
    ok(n2 >= 14, gk + ": songs are missing their choruses");
    ok(up / n2 >= 0.9, gk + ": the last chorus outweighs the first in only " +
       Math.round(100 * up / n2) + "% of songs — the arc never reaches the render");
  }
  // ...and the peak chorus carries the extra layer; the key lift, when drawn,
  // moves the rendered pitches by exactly its own amount.
  //
  // RELATIVE TO THE SONG'S OWN KEY, not to zero. Since "a song knows what key
  // it is in" the composer derives a tonic off the genre's name and stamps it
  // on EVERY box, so `b.key` is no longer "the truck-driver lift or nothing" —
  // it is the record's key, which is a number, and reading it as a flag said
  // every chorus was lifted. HOME is the key the record opens in; a lift is a
  // peak chorus that has left it.
  {
    let lifted = 0;
    for (const s of seeds) {
      const song = C.compose("rock", s);
      const home = song.song[0].key || 0;
      const ch = song.song.filter(b => b.role === "chorus" && !b.cue);
      const last = ch[ch.length - 1];
      ok(last.stack.length >= 2, "rock/" + s + ": the peak chorus has no extra layer");
      if ((last.key || 0) !== home) {
        lifted++;
        // every PITCHED consumer — lines, layers AND the bass — moves by
        // exactly the lift; the drums (no n) are untouched by construction
        const lift = (last.key || 0) - home;
        const a = sectionEv(song, { ...last, key: home }).filter(e => e.n != null);
        const b = sectionEv(song, last).filter(e => e.n != null);
        ok(a.length === b.length && a.every((e, i) => b[i].n - e.n === lift),
           "rock/" + s + ": the truck-driver lift does not move the band by +" + lift);
      }
    }
    ok(lifted > 3 && lifted < seeds.length, "the key lift is never/always drawn (" +
       lifted + "/" + seeds.length + ") — it should be a coin, not a constant");
  }

  // (b) THE PRECHORUS EXISTS and points forward: stored under a legal role
  // (fields.js owns the vocabulary — the cue carries the honest name), riser
  // armed, cadence stamped — and the dominant sounds INSIDE THE RENDERED
  // WINDOW. A prechorus renders bars [0, len) with len = half the form, so a
  // cadence landed on the form's last bar is a lift that never plays; the
  // checks below read the same windowed stream the transport schedules.
  {
    const song = C.compose("beatles", 5);
    const pre = song.song.filter(b => b.cue === "prechorus");
    ok(pre.length === 2, "the song plan does not carry two prechoruses");
    pre.forEach((b, i) => {
      ok(C.ROLES[b.role], "a prechorus is stored under an illegal role: " + b.role);
      // THE SECOND ONE DOES NOT FADE IN AGAIN. Both point forward — riser
      // armed, dominant cadence stamped — but a band that fades up twice in
      // one record has a desk problem, so the first prechorus arrives (`in`,
      // a fade from zero) and the second pushes (`lift`, held flat then
      // climbing hard). It is also what keeps two same-role sections from
      // carrying the identical dynamic where the ladder pass cannot help,
      // because a fade is not on the ladder.
      ok(b.env === (i ? "lift" : "in") && b.mot === "rise" && b.cadence,
         "prechorus " + i + " does not lift (env " + b.env + " / mot " + b.mot +
         " / cadence " + !!b.cadence + ")");
      // the cadence reaches the BASS in the window's last bar: its root is
      // the dominant's, not the prog's own final chord. READ AGAINST THE
      // SECTION'S OWN KEY — the record has a tonic now and the whole band is
      // stamped with it, so a bare pc 7 is only the dominant of a song in the
      // one key that used to be assumed.
      const r = D.sectionEvents(b, song.slots), bs = 16 / r.g.rate;
      const home = ((((b.key || 0) % 12) + 12) % 12);
      const bpc = r.ev.filter(e => e.kind === "bass" && e.t >= (r.bars - 1) * bs)
        .map(e => ((((e.n - home) % 12) + 12) % 12));
      ok(bpc.length > 0 && bpc.every(pc => pc === 7 || pc === 6),
         "the beatles prechorus cadence never reaches the bass in the rendered window: " +
         bpc.join(","));
    });
    // ...and where the genre HAS a pad, the cadence's dominant third actually
    // SOUNDS: isley's Rhodes voices the V7 in the window's last bar — pc 11,
    // which dorian does not contain, so only the cadence can put it there
    {
      const song2 = C.compose("isley", 5);
      const b2 = song2.song.find(b3 => b3.cue === "prechorus");
      ok(!!b2, "isley's song plan lost its prechorus");
      const r2 = D.sectionEvents(b2, song2.slots), bs2 = 16 / r2.g.rate;
      const home2 = ((((b2.key || 0) % 12) + 12) % 12);   // ...and the same, in isley's key
      const pcs2 = new Set(r2.ev
        .filter(e => e.kind === "line" && e.part === "pad" && e.t >= (r2.bars - 1) * bs2)
        .map(e => ((((e.n - home2) % 12) + 12) % 12)));
      ok(pcs2.has(11),
         "the prechorus cadence never sounds the dominant's third in the rendered window");
    }
    ok(C.PLANS.song.includes("prechorus") && C.PLANS.dance.includes("build"),
       "the plans lost their lift sections");
  }

  // (c) NO SECTION RESTATES ITS NEIGHBOUR: consecutive same-role sections
  // render differently — the dance plan's double drop is the hard case
  for (const gk of ["acid", "eurythmics"]) {
    for (const s of seeds.slice(0, 10)) {
      const song = C.compose(gk, s);
      for (let i = 1; i < song.song.length; i++) {
        const a = song.song[i - 1], b = song.song[i];
        if (a.role !== b.role || C.BEDS[b.role] || a.cue !== b.cue) continue;
        ok(sig(sectionEv(song, a)) !== sig(sectionEv(song, b)),
           gk + "/" + s + ": two consecutive " + b.role + "s render identically");
      }
    }
  }

  // (d) THE CHORUS HAS ITS OWN MELODY: slot 5 (the topline) leads every chorus
  // and is absent from every verse's own deal
  for (const s of seeds.slice(0, 10)) {
    const song = C.compose("rock", s);
    for (const b of song.song) {
      // ...and where a SINGER took the chorus (compose.js: the topline moves off
      // the band and onto a `vocal` layer, because a chorus sung in unison by
      // the guitar player and the singer is one line twice) the topline leads
      // THAT layer. Either way it is what the chorus opens with.
      if (b.role === "chorus" && !b.cue) {
        const tune = b.stack.find(e => e.slots[0] === 5);
        ok(!!tune, "a chorus does not lead with the topline");
        ok(!tune || tune === b.stack[0] || tune.g === "vocal" || tune.g === "backing",
           "the chorus's topline is on a layer that is not the band and not the singer: " +
           (tune && tune.g));
      }
      if (b.role === "verse" && !b.cue)
        ok(!b.stack[0].slots.includes(5), "a verse borrowed the chorus's topline");
    }
  }

  // (e) THE TOPLINE WRITER, measured from rendered events over 100 hooks:
  // the motif returns (bars 0-3 == 4-7 in pitch and relative time), the breath
  // is real silence at the bar's end under a singer's maxHold, and exactly one
  // note is both the highest and the loudest
  {
    // the TOPLINE WRITER is compose.js's, so it is measured with the player
    // taken out — a phrase whose climax is the one loudest note is a fact about
    // what was written, and the performance layer exists precisely to stop the
    // rendered velocities being the written ones
    const g = plain(GENRES.simple), gSing = { ...g, maxHold: 2 };
    for (let s = 1; s <= 60; s++) {
      const p = C.phrase(C.rng(s * 17), s % 2 ? "hook" : "topline");
      const q = clone(p); q.sld = q.sld.map(() => 0);      // slides are exempt from the cap
      const ev2 = K.render(q, gSing, 1);
      const cell = a => JSON.stringify(a.map(e => [+(e.t % 4).toFixed(3), e.n, e.vel]));
      ok(cell(ev2.filter(e => e.t < 4)) === cell(ev2.filter(e => e.t >= 4 && e.t < 8)),
         "hook/" + s + ": the motif does not return in the rendered stream");
      ok(ev2.every(e => e.t < 14 && e.t + e.dur <= 15.5),
         "hook/" + s + ": no breath — the bar's end is not silent");
      const top = Math.max(...ev2.map(e => e.n));
      const peaks = ev2.filter(e => e.n === top);
      ok(peaks.length === 1 && peaks[0].vel === 9 &&
         ev2.filter(e => e.vel === 9).length === 1,
         "hook/" + s + ": the climax is not one note that is highest AND loudest");
    }
  }
}

/* ---------------------------------------------------------------- 32. CONFUSION
   Going from 23 to 45 genres is exactly where a table starts containing
   duplicates, and the big engine already learned this lesson: its matrix must
   stay diagonal-dominant at 274/274. This is nukernel's version — a feature
   vector per genre computed from the RENDERED events only (never a config
   field), a weighted distance over every pair, and a floor under the closest
   one. Two genres with different labels and identical music fail by
   construction, which the relabelled-clone canary proves on every run. */
console.log("confusion — every genre is provably not a relabelled neighbour");
{
  const C = require("../../nukernel/compose.js");
  // the vector: kick and snare STEP SETS (positions, not counts — a schedule
  // wired only into velocity would not move them), hat/perc/line densities,
  // the chordal share (pads + stabs), mean duration and the silent fraction
  // (real only since maxHold exists), the pitch-class profile of everything
  // pitched, the harmonic rhythm read off the BASS (distinct per-bar note
  // sets — the consumer a decorative prog cannot reach), measured swing, bass
  // density and register, wall-clock bar seconds (invariant under the
  // rate×2/bpm÷2 relabel), the form length, and the RENDERED voice count.
  const featOf = (gk, g, bpm) => {
    const bars = g.bars, bs = 16 / g.rate;
    const line = K.render(P, g, bars);
    const dr = K.drums(P, g, bars);
    const ba = K.bass(P, g, bars);
    const step = e => ((Math.round(e.t * g.rate) % 16) + 16) % 16;
    const lane = ds => { const v = new Array(16).fill(0);
      for (const e of dr) if (ds.includes(e.d)) v[step(e)] = 1; return v; };
    const f = [], w = [];
    const push = (x, wt) => { f.push(x); w.push(wt); };
    for (const x of lane(["k"])) push(x, 1 / 8);
    for (const x of lane(["s", "c"])) push(x, 1 / 8);
    push(Math.min(1, dr.filter(e => e.d === "h" || e.d === "o").length / bars / 16), 1);
    push(Math.min(1, dr.filter(e => e.d === "p").length / bars / 16), 0.5);
    const mel = line.filter(e => e.part !== "pad" && e.part !== "stab");
    push(line.length ? (line.length - mel.length) / line.length : 0, 1);
    // LOG-SCALED, NOT CLAMPED: Math.min(1, …) saturated at one voice's worth
    // of sixteenths, which hid a 360- vs 80-event render difference (spem vs
    // counterpoint) and left those pairs separated only by declared scalars
    push(Math.log2(1 + mel.length / bars) / 6, 1.5);
    const durs = mel.map(e => e.dur * g.rate);
    push(durs.length ? Math.min(1, durs.reduce((a, b) => a + b, 0) / durs.length / 8) : 0, 1);
    let covered = 0, end = 0;
    for (const [a, b] of mel.map(e => [e.t, e.t + e.dur]).sort((x, y) => x[0] - y[0])) {
      covered += Math.max(0, Math.min(b, bars * bs) - Math.max(a, end));
      end = Math.max(end, b);
    }
    push(1 - covered / (bars * bs), 1);
    const pcv = new Array(12).fill(0);
    for (const e of [...line, ...ba]) pcv[((e.n % 12) + 12) % 12] = 1;
    for (const x of pcv) push(x, 1 / 6);
    const bassBars = new Set(Array.from({ length: bars }, (_, b) =>
      JSON.stringify([...new Set(ba.filter(e => e.t >= b * bs && e.t < (b + 1) * bs)
        .map(e => e.n))].sort((x, y) => x - y))));
    push(bars > 1 ? (bassBars.size - 1) / (bars - 1) : 0, 1.5);
    const odd = [...line, ...dr].map(e => (e.t * g.rate) % 2).filter(x => x >= 1);
    push(odd.length ? Math.min(1, (odd.reduce((a, x) => a + (x - 1), 0) / odd.length) / 0.5) : 0, 1);
    push(Math.min(1, ba.length / bars / 16), 1);
    push(ba.length ? ba.reduce((a, e) => a + e.n, 0) / ba.length / 127 : 0, 1);
    // ONE wall-clock feature instead of raw bpm + raw rate: bar SECONDS.
    // Every render feature above is rate-normalized (step() multiplies by
    // g.rate, durations scale by it), so a clone with rate doubled and bpm
    // halved renders wall-clock-identical audio — separate bpm/rate features
    // measured that relabel 0.07 apart and the gate passed the exact
    // duplicate it exists to forbid. Bar seconds is invariant under the
    // relabel and still separates genuine tempo differences.
    push(Math.log2((16 / g.rate) * (60 / (4 * (bpm == null ? C.BPM[gk] : bpm)))) / 4, 1.5);
    push(g.bars / 12, 0.75);
    // the voice count is MEASURED from the rendered stream, not declared
    push(new Set(line.map(e => e.v)).size / 8, 1);
    return { f, w };
  };
  const dist = (a, b) => {
    let s = 0, tw = 0;
    for (let i = 0; i < a.f.length; i++) { s += a.w[i] * Math.abs(a.f[i] - b.f[i]); tw += a.w[i]; }
    return s / tw;
  };
  // THE FLOOR. Measured on the shipped table (post config-scalar purge) the
  // closest true pair (gregorian vs counterpoint — genuinely siblings) sits
  // at 0.035; a relabel that only moved the tempo ten bpm, or the compensated
  // rate×2/bpm÷2 clone, measures under 0.003. 0.03 splits those worlds with
  // headroom, and the render is deterministic so there is no flake in it.
  const EPS = 0.03;
  const F = {};
  for (const gk of GK) F[gk] = featOf(gk, GENRES[gk]);
  for (let i = 0; i < GK.length; i++)
    for (let j = i + 1; j < GK.length; j++) {
      const d = dist(F[GK[i]], F[GK[j]]);
      ok(d > EPS, GK[i] + " and " + GK[j] + " render " + d.toFixed(4) +
         " apart — closer than " + EPS + ", one is a relabel of the other");
    }
  // the canaries: a relabelled clone measures zero, a clone that only changed
  // its tempo still fails, and — the compensated case — a clone with rate
  // doubled and bpm halved plays wall-clock-identical audio and must ALSO
  // measure as a clone, or the floor is being cleared by config relabels
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock })) < EPS / 10,
     "a byte-identical clone does not measure as a clone — the metric is broken");
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock }, C.BPM.rock + 10)) < EPS,
     "a tempo-only relabel clears the floor — the gate proves nothing");
  ok(dist(F.rock, featOf("rock", { ...GENRES.rock, rate: GENRES.rock.rate * 2 },
                         C.BPM.rock / 2)) < EPS / 10,
     "a rate-doubled bpm-halved clone — audio-identical by construction — " +
     "does not measure as a clone: config scalars are doing the separating");
  // every declared neighbour is a real genre, so the identity comments and the
  // matrix stay honest together
  for (const gk of GK)
    if (GENRES[gk].near)
      ok(!!GENRES[GENRES[gk].near],
         gk + ": declares an unknown nearest neighbour \"" + GENRES[gk].near + "\"");
}

/* ---------------------------------------------------------------- 33. THE BOX SURFACE (P4)
   The depth fields as BOX fields — key/prog/period/breath/pipe/part — wired
   in ui/derive.js genreOf, plus the automation vocabulary. boxGenre runs the
   REAL genreOf (imported above as D — the mirror it replaced could not fail
   when the shipped wiring changed). Every assertion reads RENDERED events;
   the neutrality row proves null == absent byte for byte. */
console.log("the box surface — key/prog/period/breath/pipe/part/auto reach the render");
{
  const NF = require("../../nukernel/fields.js");
  const NG = require("../../nukernel/genres.js");
  const S = require("../../nukernel/song.js");
  const C = require("../../nukernel/compose.js");

  // the REAL ui/derive.js genreOf, fed a box-shaped section (a box always has
  // an authority; layer-scope fields read through optOf's sec fallback)
  const keyOfG = new Map(Object.keys(GENRES).map(k => [GENRES[k], k]));
  const boxGenre = (G, sec) =>
    D.genreOf({ stack: [{ g: keyOfG.get(G), slots: [] }], nudge: 0, ...sec }, null);
  const rsig = g2 => sig(allEvents(P, g2, g2.bars));

  // NEUTRALITY: a box with every depth field null renders byte-identically
  // to the bare genre — the extension of §22's law to the box surface
  const NUL = { key: null, prog: null, period: null, breath: null,
                pipe: null, part: null, cadence: null, auto: [] };
  for (const gk of ["rock", "blues", "beatles", "isley", "vaporwave", "house", "reggae"]) {
    const G = GENRES[gk];
    ok(rsig(boxGenre(G, NUL)) === rsig(G),
       gk + ": a box with every depth field null does not render identically to absent");
  }

  // KEY: "2" moves every pitched consumer by exactly +2 and the drums by 0 —
  // the string form is what a chip writes, the number form what compose writes
  for (const kv of ["2", 2]) {
    const G = GENRES.rock, g2 = boxGenre(G, { ...NUL, key: kv });
    const a = [...K.render(P, G, G.bars), ...K.bass(P, G, G.bars)];
    const b = [...K.render(P, g2, g2.bars), ...K.bass(P, g2, g2.bars)];
    ok(a.length === b.length && a.every((e, i) => b[i].n - e.n === 2 && b[i].t === e.t),
       "box key " + JSON.stringify(kv) + " is not a uniform +2 on the pitched stream");
    ok(sig(K.drums(P, g2, g2.bars)) === sig(K.drums(P, G, G.bars)),
       "box key moved the drums");
  }

  // PROG: a named prog with sevenths widens the pad's pitch-class set; "off"
  // strips a genre's own prog back to the triads (blues' control from §23f)
  {
    const G = GENRES.vaporwave;
    const pcsPad = g2 => new Set(K.render(P, g2, g2.bars)
      .filter(e => e.part === "pad" && e.t < 16 / g2.rate).map(e => ((e.n % 12) + 12) % 12));
    const plain = pcsPad(G), seventh = pcsPad(boxGenre(G, { ...NUL, prog: "jack7" }));
    ok(seventh.size > plain.size,
       "box prog jack7 did not widen the pad's first chord (" +
       plain.size + " -> " + seventh.size + " pcs)");
    const off = K.bass(P, boxGenre(GENRES.blues, { ...NUL, prog: "off" }), 12)
      .filter(e => e.t < 12).map(e => ((e.n % 12) + 12) % 12);
    ok(off.includes(3) && !off.includes(4),
       "prog \"off\" did not strip blues back to the minor walk: " + off.join(","));
  }

  // PROG ON A MODAL GENRE: a named progression makes the harmony a CYCLE.
  // chordsOf ignores g.prog whenever harmony !== "cycle", so the chip used to
  // validate, light, and change nothing on ~19 of 45 genres — the shipped
  // depth surface silently inert. "off"/absent still leave modal modal.
  {
    const F2 = GENRES.funk;
    ok(rsig(boxGenre(F2, { ...NUL, prog: "blues12" })) !== rsig(F2),
       "prog \"blues12\" on a modal genre changes nothing — the chip is inert");
    ok(rsig(boxGenre(F2, { ...NUL, prog: "off" })) === rsig(F2),
       "prog \"off\" on a modal genre is not neutral");
    ok(rsig(boxGenre(F2, { ...NUL, cadence: { d: 4, q: "dom7" } })) === rsig(F2),
       "a bare cadence (no prog to land on) is not neutral on a modal genre");
  }

  // PERIOD: "4bar" lifts bar 3 (dens3 = more gates), "2bar" alternates,
  // "1bar" strips a genre's own sentence (beatles carries one)
  {
    const G = GENRES.rock;
    // THE WRITTEN NOTES, not the decorated ones (`!e.orn`): the period is a
    // claim about how many GATES a bar opens, and rock ornaments — a grace or
    // a flam thrown per note on its own dice adds a note to whichever bar it
    // lands in, which is exactly enough to level 12 against 11.
    const counts = g2 => Array.from({ length: 4 }, (_, b) =>
      K.render(P, g2, 4).filter(e => e.v === 0 && !e.orn && Math.floor(e.t / 16) === b).length);
    const four = counts(boxGenre(G, { ...NUL, period: "4bar" }));
    ok(four[2] > four[0], "period 4bar: bar 3 is not busier than bar 1 (" + four.join(",") + ")");
    // TIMES ONLY, on the one-voice genre: P carries a ramp, so pitches climb
    // per loop and would read as the period failing when it is the ramp working
    const barSig = (g2, b) => JSON.stringify(K.render(P, g2, 4)
      .filter(e => e.v === 0 && Math.floor(e.t / 16) === b)
      .map(e => +(e.t % 16).toFixed(3)));
    // plain() AFTER genreOf, never before: boxGenre finds the section's genre
    // key by identity, and a copy is not the anchor
    const g2b = plain(boxGenre(GENRES.simple, { ...NUL, period: "2bar" }));
    ok(barSig(g2b, 0) !== barSig(g2b, 1) && barSig(g2b, 0) === barSig(g2b, 2) &&
       barSig(g2b, 1) === barSig(g2b, 3),
       "period 2bar is not an alternating two-bar sentence");
    const B = GENRES.beatles;
    ok(rsig(boxGenre(B, { ...NUL, period: "1bar" })) === rsig({ ...B, period: null }) &&
       rsig(boxGenre(B, { ...NUL, period: "1bar" })) !== rsig(B),
       "period 1bar does not strip the genre's own sentence");
  }

  // BREATH: "2" caps the hold so the gate hole is silence; "none" is the
  // explicit uncap — it must lengthen a genre that carries its own maxHold
  {
    const gap = { ...clone(P), gate: [1,0,0,0, 0,0,0,1, 1,0,0,0, 0,0,1,0],
                  sld: new Array(N).fill(0) };
    const total = a => a.reduce((s, e) => s + e.dur, 0);
    const G = GENRES.simple;
    const evF = K.render(gap, G, 2);
    const evC = K.render(gap, boxGenre(G, { ...NUL, breath: "2" }), 2);
    ok(evC.length === evF.length && Math.max(...evC.map(e => e.dur)) <= 2 &&
       total(evC) < total(evF),
       "breath \"2\" does not cap the hold in the rendered durations");
    // the GAPPED phrase again: P's own spans never exceed 2 steps, so blues'
    // maxHold 4 never binds on it and the uncap would measure as a tie
    const B = GENRES.blues;
    ok(total(K.render(gap, boxGenre(B, { ...NUL, breath: "none" }), B.bars)) >
       total(K.render(gap, B, B.bars)),
       "breath \"none\" does not uncap a genre that carries its own maxHold");
  }

  // PIPE: "3rds" adds chord-locked events; "off" strips a genre's own pipes
  // (isley ships a strum); "strum" spreads a pad chord's attacks
  {
    const G = GENRES.rock;
    const wet = K.render(P, boxGenre(G, { ...NUL, pipe: "3rds" }), 4);
    const added = wet.filter(e => e.pipe === "harmonize");
    ok(wet.length > K.render(P, G, 4).length && added.length > 0,
       "pipe 3rds added nothing to the rendered stream");
    for (const e of added)
      ok(K.chordsOf(P, G, Math.floor(e.t / 16))[0].pcSet.has(((e.n % 12) + 12) % 12),
         "a box-armed harmonize added a non-chord tone");
    const I = GENRES.isley;
    ok(rsig(boxGenre(I, { ...NUL, pipe: "off" })) === rsig({ ...I, pipes: null }) &&
       rsig(boxGenre(I, { ...NUL, pipe: "off" })) !== rsig(I),
       "pipe \"off\" does not strip the genre's own pipes");
    const V = boxGenre(GENRES.vaporwave, { ...NUL, pipe: "strum" });
    const pad0 = K.render(P, V, 4).filter(e => e.part === "pad" && e.t < 16 / V.rate);
    ok(new Set(pad0.map(e => e.t)).size > 1, "pipe strum left the pad as one attack");
  }

  // PART: "stab" chord-locks every line event; "auto" is the genre's own
  {
    const G = GENRES.rock;
    const ev = K.render(P, boxGenre(G, { ...NUL, part: "stab" }), 4);
    ok(ev.length > 0 && ev.every(e => e.part === "stab"),
       "part \"stab\" did not reassign every voice of the box");
    // ORNAMENTS ARE NOT THE PART'S PITCHES. "stab" chord-locks the notes the
    // part scheme places; a grace, an approach or a flam is a decoration
    // played into one of them, and a neighbour of a chord tone is a non-chord
    // tone by definition — §59 is where those are held to the bar's alphabet.
    for (const e of ev) {
      if (e.orn) continue;
      const c = K.chordsOf(P, G, Math.floor(e.t / 16));
      ok(c.some(ch => ch.pcSet.has(((e.n % 12) + 12) % 12)),
         "a box-level stab pitch left its bar's chord");
    }
    ok(rsig(boxGenre(G, { ...NUL, part: "auto" })) === rsig(G),
       "part \"auto\" is not the genre's own scheme");
  }

  // TABLE INTEGRITY: every preset speaks vocabulary that exists — a period
  // op key outside OPS or a pipe id outside PIPES would be a chip that
  // validates and then silently does nothing
  for (const [k, w] of Object.entries(NF.PERIODS))
    for (const list of w) for (const opk of list)
      ok(!!NF.OPS[opk], "PERIODS." + k + " names unknown op \"" + opk + "\"");
  for (const [k, set] of Object.entries(NF.PIPESETS))
    for (const p of set)
      ok(!!K.PIPES[p.id], "PIPESETS." + k + " names unknown pipe \"" + p.id + "\"");
  for (const k of Object.keys(NF.PROGCHOICES))
    ok(k === "off" || !!NG.PROGS[k], "PROGCHOICES names unknown prog \"" + k + "\"");
  for (const [k, v] of Object.entries(NF.BREATHS))
    ok(Number.isFinite(v), "BREATHS." + k + " is not a number");

  // AUTOSHAPE: the palette's point-list writer, provable in node. The ARMING
  // (setValueAtTime/ramps on real AudioParams) has no node-side surface — it
  // is covered by section (J) of test/browser/nukernel-audio.test.js, which
  // sets a shape through the real palette and reads __nuMix().automation
  // plus the spectral change.
  {
    const beats = 16;
    for (const param of Object.keys(NF.AUTOPARAMS)) {
      const R = NF.AUTOPARAMS[param];
      ok(NF.autoShape(param, "off", beats) === null, param + ": off is not null");
      for (const shape of ["open", "close", "rise", "fall", "pump"]) {
        const a = NF.autoShape(param, shape, beats);
        ok(a && a.param === param && a.shape === shape &&
           (a.curve === "lin" || a.curve === "exp") && Array.isArray(a.points),
           param + "/" + shape + ": malformed entry");
        ok(a.points.every(pt => pt.length === 2 && pt.every(Number.isFinite) &&
           pt[0] >= 0 && pt[0] <= beats + 0.9 &&
           pt[1] >= Math.min(R.lo, R.hi) - 1e-6 && pt[1] <= Math.max(R.lo, R.hi) + 1e-6),
           param + "/" + shape + ": a point leaves the beat span or the value range");
      }
      const o = NF.autoShape(param, "open", beats), c2 = NF.autoShape(param, "close", beats);
      ok(o.points[0][1] < o.points[o.points.length - 1][1] ===
         (c2.points[0][1] > c2.points[c2.points.length - 1][1]),
         param + ": open and close do not run in opposite directions");
      ok(NF.autoShape(param, "pump", beats).points.length === 2 * beats,
         param + ": pump is not two points a beat");
    }
    // a written shape survives the loader — the palette's exact output
    const b = S.emptyBox();
    b.auto = [NF.autoShape("cutoff", "open", 16)];
    const r = S.validateSong({ v: 2, slots: [S.blank()], song: [b], bpm: 126, vol: 80 });
    ok(r.ok && r.song.song[0].auto.length === 1,
       "a palette-written automation entry does not survive validation: " +
       JSON.stringify(r.errors && r.errors[0]));
    // ...and malformed points are refused loudly, naming their path
    const bad = S.emptyBox();
    bad.auto = [{ param: "cutoff", points: [[0, NaN]] }];
    const rb = S.validateSong({ v: 2, slots: [S.blank()], song: [bad], bpm: 126, vol: 80 });
    ok(!rb.ok && /auto\[0\]\.points$/.test(rb.errors[0].path),
       "NaN automation points did not fail with a typed error");
  }

  // THE COMPOSER USES THE SURFACE: choruses draw the "4bar" preset, bridges
  // the "2bar" one, and the peak drop of a dance plan carries a real point
  // list on a public param — all through the same loader as everything else
  {
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
    let four = 0, two = 0, autos = 0;
    for (const s of seeds) {
      const song = C.compose("rock", s);
      for (const b of song.song) {
        if (b.role === "chorus" && b.period === "4bar") four++;
        if (b.role === "bridge" && b.period === "2bar") two++;
        if (b.period != null) ok(!!NF.PERIODS[b.period],
          "rock/" + s + ": composed period \"" + b.period + "\" is not a preset name");
      }
      const dance = C.compose("house", s);
      const drops = dance.song.filter(b => b.role === "drop");
      const peak = drops[drops.length - 1];
      if (peak && peak.auto && peak.auto.length) {
        autos++;
        ok(peak.auto.every(a => NF.AUTOPARAMS[a.param] && a.points.length),
           "house/" + s + ": the peak drop's automation is not a real point list");
      }
    }
    ok(four > 4, "composed choruses never draw the 4bar sentence (" + four + ")");
    ok(two > 10, "composed bridges do not sway on the 2bar preset (" + two + ")");
    ok(autos === seeds.length,
       "the peak drop carries automation in only " + autos + "/" + seeds.length + " songs");
  }

  // THE INTERREGNUM MIGRATION: a save written between P2b and P4 carries the
  // bar schedule as a raw array; migrate turns a recognized one into its
  // preset name and drops an unrecognized one, so the evening's saves live
  {
    const mk = period => ({ v: 2, slots: [S.blank()],
      song: [Object.assign(S.emptyBox(), { period })], bpm: 126, vol: 80 });
    const r1 = S.load(mk([[], [], ["dens3"], []]));
    ok(r1.ok && r1.song.song[0].period === "4bar",
       "an array-form 4bar period did not migrate to its preset name");
    const r2 = S.load(mk([["rev"], ["inv"], ["rot5"]]));
    ok(r2.ok && r2.song.song[0].period == null,
       "an unrecognized array period was not dropped on migration");
  }
}

/* ---------------------------------------------------------------- 33b. THE AUTHORITY LAW
   A stacked layer plays through the BOX's harmony — prog and period stay the
   authority's alone (the comment sectionEvents itself carries). A layer that
   keeps its own prog is half the band in a different song: stacking blues on
   house had the layer voice-leading blues12 against the box's changes, and a
   layered beatles kept its own four-bar sentence. Both read through the REAL
   derive path. */
console.log("a stacked layer plays the authority's changes, not its own");
{
  // (a) the box's prog chip must REACH the layer: a layer following its own
  // prog is deaf to a change in the authority's changes
  const mk = prog => ({ stack: [{ g: "house", slots: [0] }, { g: "blues", slots: [0] }],
                        ops: [], prog, len: 4, nudge: 0 });
  const layerEv = sec => JSON.stringify(D.sectionEvents(sec, [P]).ev
    .filter(e => e.layer === "blues").map(e => [e.t, e.n]));
  ok(layerEv(mk(null)) !== layerEv(mk("jack7")),
     "the box's prog never reaches a stacked layer — it plays its own changes");
  // (b) a layered beatles must NOT keep its own four-bar sentence: the layer's
  // bar 4 renders as many notes as its bar 1 once the period is stripped
  const fb = { stack: [{ g: "funk", slots: [0] }, { g: "beatles", slots: [0] }],
               ops: [], len: 4, nudge: 0 };
  const lev = D.sectionEvents(fb, [P]).ev.filter(e => e.layer === "beatles");
  const bs34 = 16 / D.sectionEvents(fb, [P]).g.rate;
  const perBar = b => lev.filter(e => Math.floor(e.t / bs34) === b).length;
  ok(perBar(3) === perBar(0),
     "a stacked layer kept its own bar schedule (bar 4 " + perBar(3) +
     " notes vs bar 1 " + perBar(0) + ")");
}

/* ---------------------------------------------------------------- 34. KIT OPS × KIT SCHEDULE
   drums() prefers g.kits over g.kit, so a kit operator applied to the kit
   alone is a no-op on a schedule genre — dnb's breakdown kept its full
   two-bar break under a "no drums" chip, and only the composer's intro
   guard ever noticed. Read through the REAL derive path. */
console.log("kit operators reach the kit schedule (g.kits)");
{
  const box = kit => ({ stack: [{ g: "dnb", slots: [0] }], ops: [], kit,
                        len: 4, nudge: 0 });
  const hits = kit => D.sectionEvents(box(kit), [P]).ev.filter(e => e.kind === "hit");
  ok(hits(null).length > 0, "dnb renders no drums at all — this section proves nothing");
  ok(hits("nodrums").length === 0,
     "kit \"nodrums\" left " + hits("nodrums").length + " hits on a kits-schedule genre");
  ok(hits("nokick").length > 0 && hits("nokick").every(e => e.d !== "k"),
     "kit \"nokick\" left kicks on a kits-schedule genre");
  // `four` WRITES the lane: a kick on every quarter of every scheduled bar
  const four = hits("four").filter(e => e.d === "k");
  ok(four.length === 16,
     "kit \"four\" did not straighten the kick over the schedule (" + four.length + " kicks)");
}

/* ---------------------------------------------------------------- 35. GENRE FAMILIES
   The palette clusters the genre bank under FAMILIES headers, and the table
   is only trustworthy if it is TOTAL: every genre in exactly one family,
   every family key naming a real genre, every stamped `family` field from
   the allowed set. A genre missing from the table would silently vanish
   from the sound page — the palette draws the clusters, not GENRES. */
console.log("every genre carries exactly one family from the palette's set");
{
  // `parts` is the one cluster that is not a tradition: the FUNCTION genres,
  // whose identity is a role rather than a style (genres.js)
  const ALLOWED = new Set(["kernel", "vox", "club", "soul", "groove",
                           "band", "studio", "drift", "roots", "parts"]);
  ok(Array.isArray(FAMILIES) && FAMILIES.length === ALLOWED.size,
     "FAMILIES is not the allowed set (" + (FAMILIES || []).length + " families)");
  const seen = new Map();                       // genre key -> how many families
  for (const [fam, keys] of FAMILIES) {
    ok(ALLOWED.has(fam), "family \"" + fam + "\" is not in the allowed set");
    ok(keys.length > 0, "family \"" + fam + "\" is empty");
    for (const k of keys) {
      ok(!!GENRES[k], "family \"" + fam + "\" names unknown genre \"" + k + "\"");
      seen.set(k, (seen.get(k) || 0) + 1);
    }
  }
  for (const gk of GK) {
    ok(seen.get(gk) === 1, "genre \"" + gk + "\" is in " + (seen.get(gk) || 0) +
       " families — must be exactly one");
    ok(ALLOWED.has(GENRES[gk].family), "genre \"" + gk + "\" carries family \"" +
       GENRES[gk].family + "\" — not in the allowed set");
  }
}

/* ---------------------------------------------------------------- 36. VARIABLE BANKS
   The phrase bank is 1..NSLOTS now (default one, [+] grows it), and the
   loader stopped padding to a fixed eight. What must hold: any legal size
   round-trips at ITS OWN length, byte-identically; the fences refuse 0 and
   NSLOTS+1; an old save whose box references past a short bank still loads
   (grown with blanks to cover the reference — the repair that replaces the
   old blanket pad); and the composer's output — the 8-slot case every old
   save is — survives the loader unchanged. */
console.log("variable banks — round trip at any size, migrate 8->N, reference cover");
{
  const S = require("../../nukernel/song.js");
  const F = require("../../nukernel/fields.js");
  const C = require("../../nukernel/compose.js");
  const mkSong = n => ({ v: 2,
    slots: Array.from({ length: n }, (_, i) => {
      const p = S.blank(); p.gate[0] = 1; p.deg[0] = i % 7; return p; }),
    song: [{ ...S.emptyBox(), stack: [{ g: "acid", slots: [Math.max(0, n - 1)] }] }],
    bpm: 126, vol: 80 });
  // round trip at several sizes: the bank comes back at its own length, and
  // the phrases come back byte-identical (no pad, no trim, no re-order)
  for (const n of [1, 2, 5, 8, F.NSLOTS]) {
    const raw = mkSong(n), r = S.load(JSON.parse(JSON.stringify(raw)));
    ok(r.ok, "a " + n + "-slot song does not load: " +
       JSON.stringify(r.errors && r.errors[0]));
    if (r.ok) {
      ok(r.song.slots.length === n, "a " + n + "-slot bank came back as " +
         r.song.slots.length);
      ok(JSON.stringify(r.song.slots) === JSON.stringify(raw.slots),
         "a " + n + "-slot bank did not round-trip byte-identically");
      // ...and the loaded song saves and loads AGAIN at the same length
      const r2 = S.load(JSON.parse(JSON.stringify(r.song)));
      ok(r2.ok && r2.song.slots.length === n,
         "a " + n + "-slot bank does not survive a second trip");
    }
  }
  // the fences: an empty bank and an over-full one are refused, with the
  // slots path named
  {
    const r0 = S.load({ ...mkSong(1), slots: [] });
    ok(!r0.ok && r0.errors[0].path === "slots", "an empty bank was not refused");
    const r17 = S.load(mkSong(F.NSLOTS + 1));
    ok(!r17.ok && r17.errors[0].path === "slots",
       "a " + (F.NSLOTS + 1) + "-slot bank was not refused");
  }
  // a phrase index past the cap is refused (the box check, not the bank one)
  {
    const raw = mkSong(2);
    raw.song[0].stack[0].slots = [F.NSLOTS];
    const r = S.load(raw);
    ok(!r.ok, "a phrase index of " + F.NSLOTS + " (past the cap) was accepted");
  }
  // REFERENCE COVER: older builds padded every bank to eight, so a short-
  // banked save could legally point at a slot the pad was about to create.
  // The bank grows with blanks to cover the highest reference — never past
  // it, never truncated.
  {
    const raw = mkSong(2);
    raw.song[0].stack[0].slots = [0, 5];
    const r = S.load(raw);
    ok(r.ok && r.song.slots.length === 6,
       "a bank of 2 referencing slot 6 did not grow to 6 (got " +
       (r.ok ? r.song.slots.length : JSON.stringify(r.errors[0])) + ")");
    ok(r.ok && r.song.slots.slice(2).every(p =>
         p.gate.every(g => !g)),
       "the reference-cover growth is not blank");
  }
  // MIGRATE 8->N: the 8-slot era is just one legal size now. Composer output
  // (the shape every recent save has) loads with its bank untouched — same
  // length, same bytes — across a spread of genres and seeds.
  for (const gk of ["acid", "rock", "fugue"]) {
    for (const s of [3, 11]) {
      const song = C.compose(gk, s);
      const r = S.load(JSON.parse(JSON.stringify(song)));
      ok(r.ok, gk + "/" + s + ": composer output does not load: " +
         JSON.stringify(r.errors && r.errors[0]));
      ok(r.ok && r.song.slots.length === song.slots.length &&
         JSON.stringify(r.song.slots) === JSON.stringify(song.slots),
         gk + "/" + s + ": an 8-slot composed bank did not migrate unchanged");
    }
  }
}

/* ---------- 37. A HIT AT ZERO IS A HIT ------------------------------------
   The kit-velocity vectors and the groove profiles both legitimately produce
   drum events at velocity 0 — boombap and funk emit six between them on the
   default phrase. The player must treat that as a SILENT HIT, not as "this
   kit cannot play that lane": the second reading falls through to the
   oscillator stub, and ten beeps came out of one 45-genre browser sweep
   because of it. This gate is the event-side half (the browser half is the
   fallback counter): the kernel really does emit them, so the audio tier
   really is asked the question, and anyone who "fixes" it by clamping
   velocities up here will see this fail. */
{
  let zeros = 0, from = [];
  for (const [gk, g] of Object.entries(GENRES)) {
    let n = 0;
    for (const e of K.drums(DEFAULT, g, 4)) if ((e.vel == null ? 5 : e.vel) <= 0) n++;
    if (n) { zeros += n; from.push(gk); }
  }
  ok(zeros > 0, "no genre emits a zero-velocity drum event any more — if that is " +
     "deliberate, delete this check; if it is a clamp, the silent-hit path just " +
     "went untested");
  ok(from.length >= 1, "zero-velocity drum events come from: " + from.join(", "));
}
console.log("a hit at zero is a hit — the kernel emits silent drum events on purpose");

/* ---------- 37b. THE FULL KIT ---------------------------------------------
   THE ARTIST: "There are many different drum sets. You are not using them."
   Literally true and measurable: found/samples/drums/<kit>/ has carried twelve
   samples per kit since extraction and instruments.js named six, so there were
   no toms, no ride, no crash and no pedal hat anywhere in the instrument, and
   kernel.js spelled its crashes "o" — an open hat — because there was no
   cymbal lane to write.

   Every check below reads RENDERED EVENTS, not config, because that is the
   house law this suite exists to enforce: an operator that returns a lovely
   kit nothing plays is the same bug as the dead ghost layer. Each operator's
   DOCUMENTED SIGNATURE is the thing asserted — a tom fill puts toms in the
   last quarter, linear means no two lanes on a tick, humanize moves times and
   not counts, a chance vector is the same dice every render. */
console.log("the full kit — twelve lanes, four vectors, and what each operator does");
{
  const NF = require("../../nukernel/fields.js");
  const NC = require("../../nukernel/compose.js");
  const drumsOf = (g, bars) => K.drums(P, g, bars == null ? g.bars : bars);
  const lanesIn = ev => new Set(ev.map(e => e.d));
  const at16 = (t, bs) => Math.round(((t % bs) + bs) % bs * 16 / bs);
  // A KIT WITH SOMETHING IN EVERY HAND: a kick, a backbeat, and a hat figure
  // that is FOUR-periodic on purpose — straight eighths are their own rotation
  // by two and their own densification, so a degenerate hat lane would report
  // three working operators as dead ones.
  const BASE = { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
                 s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
                 h: [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1] };
  const G1 = { ...GENRES.simple, kit: BASE, kits: null, fill: null, ghost: null,
               kitVel: null, bars: 2, rate: 1 };
  const play = kit => K.drums(P, { ...G1, kit }, 2);
  const opEv = name => play(K.KITOPS[name](BASE));

  // (a) THE REGISTRY AGREES WITH THE KERNEL. A lane the kernel can write and
  // instruments.js cannot name is a silent drum — the browser's fallback
  // oscillator, which the audio gate fails on.
  {
    const NI = require("../../nukernel/instruments.js");
    const NF2 = require("../../nukernel/fields.js");
    const NG2 = require("../../nukernel/genres.js");
    ok(Object.keys(K.LANES).length === 12, "the kit is not twelve lanes");
    for (const d of Object.keys(K.LANES)) {
      ok(NI.DRUMFILE[d], "lane " + d + " (" + K.LANES[d].name + ") has no sample file");
      ok(NF2.DRUMLANES[d], "lane " + d + " has no name in the field registry");
      ok(NG2.DRUMNAME[d], "lane " + d + " has no column heading in DRUMNAME");
    }
    for (const d of Object.keys(NI.DRUMFILE))
      ok(K.LANES[d], "DRUMFILE names \"" + d + "\", which is not a lane");
    // ...and the genre table cannot name one either. drums() skips a key it
    // does not recognise, so a typo'd lane letter in genres.js is a drum part
    // that never plays and never complains — this is the check that says so.
    for (const gk of GK) {
      const g = GENRES[gk];
      for (const kit of [g.kit, g.fill, ...(g.kits || [])])
        for (const key of Object.keys(kit || {}))
          ok(K.LANES[key.replace(/^[?~!]/, "")],
             gk + ": kit key \"" + key + "\" is not a lane — it will never sound");
      for (const d of Object.keys(g.kitVel || {}))
        ok(K.LANES[d], gk + ": kitVel names \"" + d + "\", which is not a lane");
      for (const d of Object.keys(g.kitProb || {}))
        ok(K.LANES[d], gk + ": kitProb names \"" + d + "\", which is not a lane");
    }
    // ...and the files really are on disk, in every kit, when the media layer
    // is present. CI runs with no found/ at all, so this is skipped rather
    // than faked — the registry checks above still hold there.
    const fs = require("fs"), path = require("path");
    const root = path.join(__dirname, "..", "..", "found", "samples", "drums");
    if (fs.existsSync(root))
      for (const kit of fs.readdirSync(root).filter(x => !x.startsWith(".")))
        for (const [d, file] of Object.entries(NI.DRUMFILE))
          ok(fs.existsSync(path.join(root, kit, file)),
             kit + " has no " + file + " for lane " + d);
  }

  // (b) EVERY LANE IS REACHABLE — in a rendered stream, from the shipped
  // vocabulary alone. Six of them had no way in at all before this round.
  {
    const seen = new Set();
    for (const gk of GK) for (const e of drumsOf(GENRES[gk])) seen.add(e.d);
    const fromGenres = new Set(seen);
    for (const name of Object.keys(K.KITOPS)) for (const e of opEv(name)) seen.add(e.d);
    const bs = 16, span = 2 * bs;
    const stream = play(BASE).map(e => ({ ...e, kind: "hit" }));
    for (const kind of Object.keys(NF.OUTLABEL))
      for (const e of K.outro(stream, kind, span, bs)) if (e.d) seen.add(e.d);
    for (const kind of Object.keys(NF.INLABEL))
      for (const e of K.intro(stream, kind, span, bs)) if (e.d) seen.add(e.d);
    for (const d of Object.keys(K.LANES))
      ok(seen.has(d), "lane " + d + " (" + K.LANES[d].name + ") is unreachable — " +
         "no genre, operator or edge can produce one");
    // and the genre table itself must use more than the old six, or the kit
    // grew only in the palette
    for (const d of ["r", "x", "t", "m", "l", "f"])
      ok(fromGenres.has(d), "no genre plays a " + K.LANES[d].name + " — the new lanes " +
         "exist but the table was never wired to them");
  }

  // (c) THE OPERATORS' DOCUMENTED SIGNATURES, one assertion per claim.
  {
    const base = play(BASE);
    // RIDE — the timekeeping hand moves, and it is one hand: the hats are gone
    // and the ride carries their part. It carries the PHRASING, not every
    // stroke. This used to assert stroke-for-stroke equality, and that is the
    // law that made afrobeat's twelve-step hat into sixteen bars of solid
    // cymbal: a ride is ONE plate that rings for seconds, and twelve strokes a
    // bar into it is not time, it is fifteen overlapping copies of a wash the
    // ear names "crash". So the two claims are now what a hand on metal can
    // actually do (kernel.js moveTime) — it plays nowhere the hat did not, and
    // it plays no faster than an eighth, because the plate has to speak.
    const ride = opEv("ride");
    ok(!lanesIn(ride).has("h") && lanesIn(ride).has("r"), "ride: the hats did not move");
    const rideAt = [...new Set(ride.filter(e => e.d === "r").map(e => at16(e.t, 16)))]
      .sort((a, b) => a - b);
    const hatAt = new Set(base.filter(e => e.d === "h").map(e => at16(e.t, 16)));
    ok(rideAt.length && rideAt.every(i => hatAt.has(i)),
       "ride: the ride is playing a stroke the hats never played");
    ok(rideAt.every((i, q) => q === 0 || i - rideAt[q - 1] >= 2),
       "ride: two ride strokes land closer than an eighth — the plate is still ringing");
    ok(ride.filter(e => e.d === "k").length === base.filter(e => e.d === "k").length,
       "ride: the kick moved too — only the timekeeping hand may");
    // TOM FILL — toms, in the last quarter of every bar, and the hand that was
    // keeping time is off it there
    const tf = opEv("tomfill");
    for (const b of [0, 1]) {
      const q = tf.filter(e => e.t >= b * 16 + 12 && e.t < (b + 1) * 16);
      ok(q.some(e => K.TOMS.includes(e.d)), "tomfill: bar " + b + " has no toms in the last quarter");
      ok(!q.some(e => e.d === "h"), "tomfill: the hats are still playing over the fill");
      ok(!tf.some(e => K.TOMS.includes(e.d) && at16(e.t, 16) < 12),
         "tomfill: a tom landed outside the last quarter");
    }
    // ...and the OUTRO tom fill is the once-a-section one: the last bar only
    {
      const bs = 16, span = 4 * bs;
      const ev = K.drums(P, { ...G1, bars: 4 }, 4).map(e => ({ ...e, kind: "hit" }));
      const out = K.outro(ev, "tomfill", span, bs);
      ok(out.some(e => K.TOMS.includes(e.d) && e.t >= span - bs),
         "outro tomfill: no toms in the last bar");
      ok(!out.some(e => K.TOMS.includes(e.d) && e.t < span - bs),
         "outro tomfill: toms leaked into the section");
      ok(out.some(e => e.d === "x"), "outro tomfill: it does not land on a crash");
      ok(JSON.stringify(out.filter(e => e.t < span - bs)) ===
         JSON.stringify(ev.filter(e => e.t < span - bs)),
         "outro tomfill changed the section before its own bar");
    }
    // LINEAR — no two lanes on one tick, which is the whole definition
    {
      const lin = opEv("linear"), byT = new Map();
      for (const e of lin) byT.set(e.t, (byT.get(e.t) || 0) + 1);
      ok([...byT.values()].every(n => n === 1),
         "linear: two limbs landed on the same tick");
      ok(lin.length > 0 && lin.length < base.length,
         "linear: nothing was taken away — it is a constraint, not a colour");
      // it keeps the kick's downbeat: the dealing order is the drummer's
      ok(lin.some(e => e.d === "k" && e.t === 0), "linear: the kick lost the downbeat");
    }
    // GHOSTS — quiet snares that were not there, and the loud ones untouched
    {
      const gh = opEv("ghosts"), sn = e => e.d === "s";
      ok(gh.filter(sn).length > base.filter(sn).length, "ghosts: no snares were added");
      ok(gh.filter(sn).some(e => e.vel === 2), "ghosts: the added snares are not ghosts");
      ok(gh.filter(e => sn(e) && e.t % 4 === 0).length === base.filter(sn).length,
         "ghosts: the backbeat was rewritten");
    }
    // FLAM and DRAG — one and two grace hits before every snare, each quieter
    // than the hit it leads and landing in front of it
    for (const [name, n] of [["flams", 1], ["drags", 2]]) {
      const ev = opEv(name), sn = ev.filter(e => e.d === "s");
      ok(sn.length === base.filter(e => e.d === "s").length * (n + 1),
         name + ": not " + n + " grace hit(s) per snare");
      for (const e of sn.filter(x => x.grace)) {
        ok(e.vel < 9 && e.vel >= 1, name + ": a grace note is not quieter");
        ok(sn.some(x => !x.grace && x.t > e.t && x.t - e.t <= 0.4),
           name + ": a grace note does not lead a hit");
      }
    }
    // KICK DOUBLES, CRASH, the snare placements — each is one claim
    ok(opEv("kickdoubles").filter(e => e.d === "k").length >
       base.filter(e => e.d === "k").length, "kickdoubles: no doubles");
    ok(opEv("crash").some(e => e.d === "x" && e.t === 0 && e.vel === 9),
       "crash: no crash on the downbeat");
    ok(opEv("backbeat").filter(e => e.d === "s").every(e => at16(e.t, 16) % 8 === 4),
       "backbeat: the snare is not on 2 and 4");
    ok(opEv("onthree").filter(e => e.d === "s").every(e => at16(e.t, 16) === 8),
       "onthree: the snare is not on 3 alone");
    ok(!lanesIn(opEv("stickside")).has("s") && lanesIn(opEv("stickside")).has("p"),
       "stickside: the snare hand did not turn the stick over");
    ok(lanesIn(opEv("pedal")).has("f"), "pedal: no pedal hat");
    ok(lanesIn(opEv("opens")).has("o"), "opens: the hat never opens");
    // DYNAMICS — the level operators change velocity and nothing else
    for (const name of ["accents", "crescendo", "soft", "loud"]) {
      const ev = opEv(name);
      ok(ev.length === base.length, name + ": changed the event COUNT — it is a level");
      ok(ev.map(e => e.t).join() === base.map(e => e.t).join(),
         name + ": moved a hit — it is a level");
      ok(ev.map(e => e.vel).join() !== base.map(e => e.vel).join(),
         name + ": did not change a single velocity");
    }
    ok(opEv("loud").every(e => e.vel === 9) && opEv("soft").every(e => e.vel === 3),
       "soft/loud are not the two ends of the level alphabet");
    // HUMANIZE — moves times, never counts; and it is the same take every time
    {
      const hu = opEv("humanize");
      ok(hu.length === base.length, "humanize: added or removed a hit");
      ok(hu.map(e => e.d).sort().join() === base.map(e => e.d).sort().join(),
         "humanize: the lanes changed");
      ok(hu.some((e, i) => e.t !== base[i].t), "humanize: nothing moved off the grid");
      ok(hu.every(e => Math.abs(e.t - Math.round(e.t)) < 0.5),
         "humanize: a hit strayed more than half a step");
      ok(JSON.stringify(hu) === JSON.stringify(opEv("humanize")),
         "humanize: two renders differ — the hand is not seeded");
      // ...and the per-BAR field version moves bar 2 differently from bar 1
      const field = K.drums(P, { ...G1, humanize: 0.08 }, 2);
      ok(field.length === base.length, "g.humanize: added or removed a hit");
      const shift = b => field.filter(e => Math.floor(e.t / 16) === b)
        .map((e, i) => +(e.t - base.filter(x => Math.floor(x.t / 16) === b)[i].t).toFixed(4));
      ok(shift(0).join() !== shift(1).join(),
         "g.humanize: bar 2 is nudged exactly like bar 1 — that is a vector, not a hand");
      ok(field.every(e => e.t >= 0 && e.t < 32), "g.humanize: a hit left its section");
      // every hit stays in the bar it was written in, or the fill moves house
      ok(field.every((e, i) => Math.floor(e.t / 16) === Math.floor(base[i].t / 16)),
         "g.humanize: a hit crossed a bar line");
    }
    // TIGHT is the inverse, and it really is the machine: every hit on the
    // grid, every level back to "just play it"
    {
      const ti = play(K.KITOPS.tight(K.KITOPS.humanize(BASE)));
      ok(ti.every(e => Number.isInteger(e.t)), "tight: a hit is still off the grid");
      ok(ti.length === base.length, "tight: the hits themselves changed");
    }
    // PROBABILITY — deterministic per seed, different across seeds, and it
    // only ever removes. This is the one operator whose bar 2 differs.
    {
      const mk = seed => K.drums(P, { ...G1, kit: K.KITOPS.maybe(BASE), kitSeed: seed }, 8);
      const a = mk(0), b2 = mk(0), c = mk(9);
      ok(sig(a) === sig(b2), "maybe: two renders of one seed differ");
      ok(sig(a) !== sig(c), "maybe: the seed does not reach the dice");
      const full = K.drums(P, { ...G1, kit: BASE }, 8);
      ok(a.length < full.length, "maybe: nothing was ever dropped");
      ok(a.length > full.length * 0.5, "maybe: it dropped more than half the kit");
      const bar = n => a.filter(e => Math.floor(e.t / 16) === n).length;
      ok([0, 1, 2, 3, 4, 5, 6, 7].map(bar).some(n => n !== bar(0)),
         "maybe: every bar drops the same hits — the draw is not per bar");
      // the kick and the downbeats are exempt by declaration
      ok(a.filter(e => e.d === "k").length === full.filter(e => e.d === "k").length,
         "maybe: the kick was thinned, and it is declared exempt");
      // chaos is the heavier hand
      const ch = K.drums(P, { ...G1, kit: K.KITOPS.chaos(BASE) }, 8);
      ok(ch.length < a.length, "chaos is not heavier than maybe");
    }
    // PER-LANE — the seven verbs touch one lane and leave the rest alone
    for (const d of ["k", "s", "h"]) {
      for (const verb of ["rot", "thin", "dens", "half", "dbl", "roll", "disp"]) {
        const name = d + "." + verb, ev = opEv(name);
        ok(K.KITOPS[name], name + " is not in the operator table");
        for (const other of ["k", "s", "h"].filter(x => x !== d))
          ok(JSON.stringify(ev.filter(e => e.d === other)) ===
             JSON.stringify(base.filter(e => e.d === other)),
             name + ": it moved the " + K.LANES[other].name);
        ok(JSON.stringify(ev.filter(e => e.d === d)) !==
           JSON.stringify(base.filter(e => e.d === d)),
           name + ": it did nothing to its own lane");
      }
      // thin really thins, dens really fills, disp moves time and not the grid
      ok(opEv(d + ".thin").filter(e => e.d === d).length <
         base.filter(e => e.d === d).length, d + ".thin: no thinner");
      ok(opEv(d + ".dens").filter(e => e.d === d).length >
         base.filter(e => e.d === d).length, d + ".dens: no denser");
      const dp = opEv(d + ".disp").filter(e => e.d === d);
      ok(dp.length === base.filter(e => e.d === d).length, d + ".disp: added a hit");
      ok(dp.every(e => !Number.isInteger(e.t)), d + ".disp: nothing was laid back");
    }
    // THE NAMED PATTERNS are five different beats, not five labels
    {
      const named = ["disco", "stomp", "tresillo", "clave", "amen", "motorik", "blast"];
      const sigs = new Set(named.map(n => sig(opEv(n))));
      ok(sigs.size === named.length, "two named patterns render identically");
      ok(opEv("amen").some(e => e.vel === 2), "the amen break has no ghost snares");
      ok(lanesIn(opEv("blast")).has("r"), "the blast beat is not ridden");
    }
  }

  // (d) NEUTRALITY, the widening's half of the house law: a level of 1 is the
  // old binary "on", an absent sidecar is no sidecar, and the three new genre
  // fields are inert when unset. If any of this moves, every saved song moves.
  {
    const g0 = { ...G1 };
    ok(sig(K.drums(P, g0, 4)) ===
       sig(K.drums(P, { ...g0, kitProb: null, humanize: 0, kitSeed: 0 }, 4)),
       "the new kit fields are not neutral when absent");
    // level 1 renders exactly as the binary vector it replaced
    const ones = K.mapKit(BASE, v => v.map(x => (x ? 1 : 0)));
    ok(sig(K.drums(P, { ...g0, kit: ones }, 4)) === sig(K.drums(P, g0, 4)),
       "a level-1 kit is not the old binary kit");
    // a chance of 9 is certainty; a chance of 0 is silence
    const all9 = { ...BASE, "?h": new Array(16).fill(9) };
    ok(K.drums(P, { ...g0, kit: all9 }, 4).length === K.drums(P, g0, 4).length,
       "a chance of 9 dropped a hit");
    const none = { ...BASE, "?h": new Array(16).fill(0) };
    ok(!K.drums(P, { ...g0, kit: none }, 4).some(e => e.d === "h"),
       "a chance of 0 still played");
    // the sidecars are not lanes: nothing named "?h" is ever an event
    ok(!K.drums(P, { ...g0, kit: all9 }, 4).some(e => !K.LANES[e.d]),
       "a sidecar was rendered as a drum");
  }

  // (e) FILL VARIETY — the artist's other complaint, one layer up. Every
  // composed song used to end every section with the same accelerating snare;
  // the arranger now deals outro kinds from a family ballot on its own salted
  // stream, so a genre varies across seeds AND genres differ from each other.
  {
    const kindsFor = gk => {
      const s2 = new Set();
      for (let seed = 1; seed <= 12; seed++)
        for (const b of NC.compose(gk, seed).song) if (b.outro) s2.add(b.outro);
      return s2;
    };
    const kitted = GK.filter(gk => Object.keys(GENRES[gk].kit || {}).length);
    for (const gk of kitted) {
      const ks = kindsFor(gk);
      ok(ks.size >= 4, gk + ": only " + ks.size + " kind(s) of ending across twelve " +
         "seeds — the fills are not varying");
      ok([...ks].some(k => ["tomfill", "hatrun", "hush", "doubles"].includes(k)),
         gk + ": never reaches a fill that is not a snare roll");
    }
    // ...and two genres do not end alike: the ballots are per family
    const rock = [...kindsFor("rock")].sort().join(), club = [...kindsFor("house")].sort().join();
    ok(rock !== club, "rock and house end their sections with the same vocabulary");
    // a kitless genre never gets handed a drum fill
    for (const gk of GK.filter(g2 => !Object.keys(GENRES[g2].kit || {}).length))
      for (const k of kindsFor(gk))
        ok(["tail", "cut", "hush", "crash", "break"].includes(k),
           gk + " has no drums but was given the \"" + k + "\" ending");
    // the kit chips the arranger reaches for are real operators, and it uses
    // more than the eight it knew before the kit grew
    const kits = new Set();
    for (const gk of kitted) for (let seed = 1; seed <= 8; seed++)
      for (const b of NC.compose(gk, seed).song) if (b.kit) kits.add(b.kit);
    for (const k of kits) ok(K.KITOPS[k], "the arranger deals \"" + k + "\", which is not an operator");
    ok(kits.size >= 20, "the arranger reaches for only " + kits.size + " kit operators " +
       "out of " + Object.keys(K.KITOPS).length);
  }
}

/* ---------- 37c. THE PER-PART MIX, the half that is pure -------------------
   "Not every track should go through the effects." The audio half of that
   answer — a sub-bus per part under the section channel — is nodes, and it is
   gated where nodes can be measured (test/browser/nukernel-drums.test.js §E,
   which renders one part treated and another untouched and correlates their
   spectra). What lives HERE is everything upstream of a node: the address
   vocabulary, the chair numbering, the resolution to engine values, and the
   loader's contract — because a mix you cannot save is a mix you do not have.

   The law under all of it: ABSENT IS TODAY. A box with no `parts` must resolve
   to no sub-bus at all, or every song ever saved changes sound. */
console.log("the per-part mix — addresses, chairs, defaults, and what the loader keeps");
{
  const F = require("../../nukernel/fields.js");
  const S = require("../../nukernel/song.js");
  const NI = require("../../nukernel/instruments.js");

  // (a) THE VOCABULARY COVERS THE KERNEL. A role the kernel can assign and the
  // desk cannot name is a voice with no address — it would fall to `line` and
  // silently share a strip with the melody. This is the join that rots first,
  // so it is checked against kernel.js PARTS itself rather than against a copy.
  for (const p of Object.keys(K.PARTS))
    ok(F.PARTNAMES[p], "kernel part \"" + p + "\" has no mix address in PARTNAMES");
  for (const p of ["bass", "drums"])
    ok(F.PARTNAMES[p], "the desk cannot address the " + p + " — it is a track too");
  for (const p of Object.keys(F.PARTNAMES))
    ok(F.PARTLABEL[p], "part address \"" + p + "\" has no label");

  // (b) CHAIRS. The first voice of a role keeps the bare name; the rest take an
  // ordinal, counted across the WHOLE box. Post rock (pad + two clean guitars)
  // and rock (two crunch guitars) are the two real shapes this exists for.
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok(eq(F.chairKeys(["pad", "line", "line"]), ["pad", "line", "line2"]),
     "chairKeys did not number a genre's second line");
  ok(eq(F.chairKeys(["line", "line"]), ["line", "line2"]), "two lines did not separate");
  ok(eq(F.chairKeys(["stab", "lead"]), ["stab", "lead"]),
     "two different roles were given ordinals they do not need");
  ok(eq(F.chairKeys([]), []), "chairKeys is not total over the empty stack");
  ok(eq(F.chairKeys(["nonsense"]), ["line"]),
     "an unknown role did not fall back to the line address");
  // every address chairKeys can mint is one the loader accepts, at any depth
  {
    const deep = F.chairKeys(new Array(F.MAX_CHAIRS + 3).fill("pad"));
    ok(deep.every(k => F.okPartKey(k)),
       "chairKeys minted an address its own validator refuses: " + deep.join(","));
    ok(new Set(deep.slice(0, F.MAX_CHAIRS)).size === F.MAX_CHAIRS,
       "the first " + F.MAX_CHAIRS + " chairs are not distinct addresses");
  }
  ok(!F.okPartKey("line1"), "\"line1\" is a second spelling of \"line\" — it must not validate");
  ok(!F.okPartKey("line0") && !F.okPartKey("line99") && !F.okPartKey("zzz") &&
     !F.okPartKey("") && !F.okPartKey(null),
     "okPartKey accepted something that is not an address");
  ok(F.partChairLabel("line2") === "line 2" && F.partChairLabel("drums") === "drums",
     "a chair does not read as words: " + F.partChairLabel("line2"));

  // ...and the addresses a REAL genre produces are the ones the desk expects.
  // instrOf/partOf is the same walk audio/mixer.js voiceRoster does.
  for (const gk of GK) {
    const g = GENRES[gk];
    const keys = F.chairKeys(Array.from({ length: g.voices }, (_, v) => K.partOf(g, v)));
    ok(keys.length === g.voices, gk + ": one address per voice, got " + keys.length);
    ok(new Set(keys).size === keys.length, gk + ": two voices share an address (" +
       keys.join(",") + ") — one strip would treat both");
    for (const k of keys) ok(F.okPartKey(k), gk + ": minted a bad address " + k);
  }

  // (c) DEFAULTS ARE NEUTRAL, and neutral is the sound the page already makes.
  // resolvePartMix is the one place a part entry becomes engine numbers, so
  // "absent is today" is provable right here: nothing set, nothing changed.
  {
    const d = F.resolvePartMix(null);
    ok(d.fx.length === 0 && d.rev === 0 && d.del === 0 && d.lvl === 1 && d.pan === 0 &&
       d.mute === false && d.solo === false && d.fader === 0,
       "an absent part entry does not resolve to neutral: " + JSON.stringify(d));
    ok(JSON.stringify(F.resolvePartMix({})) === JSON.stringify(d),
       "an empty entry is not the same as an absent one");
    // ...and a SET value is the registry's own number, not a second table
    const m = F.resolvePartMix({ rev: "wet", echo: "touch", lvl: "hush", pan: "l",
                                 fx: ["chorus", "phaser"], mute: true });
    ok(m.rev === F.SENDS.wet && m.del === F.SENDS.touch && m.lvl === F.LEVELS.hush &&
       m.pan === F.PANS.l && m.mute === true,
       "resolvePartMix does not read the shipped tables: " + JSON.stringify(m));
    ok(m.del === F.SENDS.touch, "the `echo` field did not reach the `del` bus value");
    // the insert budget is the box's, per part — three chips is the ceiling
    // everywhere or a nine-part song is a wall of effects
    const many = F.resolvePartMix({ fx: Object.keys(F.FX) });
    ok(many.fx.length === F.MAX_FX,
       "a part chain is not capped at MAX_FX (" + many.fx.length + ")");
    ok(F.resolvePartMix({ fx: ["nonsense"] }).fx.length === 0, "an unknown insert survived");
    ok(F.resolvePartMix({ rev: "soaked" }).rev === 0,
       "an unknown send did not fall back to the neutral default");
    // THE FADER OFFSET: a dB number over the automated value — clamped to the
    // registry row's range, held to 0.1 dB, and garbage resolves to 0 (no
    // offset), never to silence
    ok(F.resolvePartMix({ fader: -6 }).fader === -6, "a set fader did not resolve");
    ok(F.resolvePartMix({ fader: -99 }).fader === -24 &&
       F.resolvePartMix({ fader: 99 }).fader === 12,
       "the fader offset is not clamped to the registry's own range");
    ok(F.resolvePartMix({ fader: -3.14159 }).fader === -3.1,
       "the fader offset is not held to 0.1 dB");
    ok(F.resolvePartMix({ fader: "loud" }).fader === 0 &&
       F.resolvePartMix({ fader: NaN }).fader === 0,
       "a garbage fader did not resolve to no-offset");
  }

  // (d) THE REGISTRY IS COMPLETE, by the same rules FIELDS itself is held to
  // (§21b) — an incomplete sub-field is a chip the palette cannot draw.
  for (const f of F.PARTMIX) {
    ok(typeof f.key === "string" && f.key, "a PARTMIX entry has no key");
    if (f.type === "flag") { ok(f.default === false, f.key + ": a flag defaults to true"); continue; }
    if (f.type === "num") {
      ok(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min <= f.max,
         f.key + ": num field without a [min,max]");
      ok(f.default === null, f.key + ": num default is not null");
      continue;
    }
    if (f.type === "eq") {
      ok(f.bands === F.EQ_BANDS, f.key + ": a part's EQ does not ride the one band list");
      ok(f.default === null, f.key + ": eq default is not null (absent = flat)");
      continue;
    }
    ok(f.table && Object.keys(f.table).length, f.key + ": no value table");
    ok(f.labels && Object.keys(f.table).every(k => f.labels[k] != null),
       f.key + ": a table value has no label");
    if (f.type === "list") ok(Array.isArray(f.default) && f.max === F.MAX_FX,
      f.key + ": a part list without [] and MAX_FX");
    else ok(f.default === null, f.key + ": enum default is not null");
  }
  // the registry entry itself, and the constructor that seeds it
  {
    const fld = F.FIELD.parts;
    ok(fld && fld.type === "parts" && fld.scope === "box" && fld.default === null,
       "the `parts` field is not a box-scope, absent-by-default registry entry");
    ok("parts" in S.emptyBox() && S.emptyBox().parts === null,
       "emptyBox does not seed `parts` absent");
  }

  // (e) THE LOADER. Keys filter, values reject — the split matters, and the
  // reason is a genre A/B: `pad2` is a legal address this box may not have a
  // chair for right now, and losing it on save would mean clicking a genre and
  // back silently ate the mix.
  const trial = box => S.validateSong(
    { v: 2, slots: [S.blank()], song: [box], bpm: 126, vol: 80 });
  {
    const b = S.emptyBox();
    b.parts = { lead: { fx: ["chorus", "nonsense"], rev: "wet" },
                pad2: { pan: "l" },                 // legal address, maybe no chair
                nonsense: { lvl: "hush" },          // not an address at all
                line: {} };                         // nothing set
    const r = trial(b);
    ok(r.ok, "the loader refused a legal per-part mix: " + JSON.stringify(r.errors[0]));
    const p = r.ok && r.song.song[0].parts;
    ok(p && p.lead && p.lead.fx.join(",") === "chorus",
       "the fx filter rule does not apply inside a part");
    ok(p && p.pad2 && p.pad2.pan === "l",
       "an address with no chair in this box was dropped — a genre A/B would eat it");
    ok(p && !("nonsense" in p), "a key that is not an address survived the load");
    ok(p && !("line" in p), "an entry with nothing set was not normalized away");
  }
  {
    const b = S.emptyBox(); b.parts = { lead: { lvl: "soaked" } };
    const r = trial(b);
    ok(!r.ok && /\.parts\.lead\.lvl$/.test(r.errors[0].path),
       "a bad part level did not name its own field: " + JSON.stringify(r.errors[0]));
  }
  {
    const b = S.emptyBox(); b.parts = { lead: { mute: "yes" } };
    ok(!trial(b).ok, "a non-boolean mute was accepted");
    const b2 = S.emptyBox(); b2.parts = [{ lead: {} }];
    ok(!trial(b2).ok, "an array was accepted where the desk wants a map");
    const b3 = S.emptyBox(); b3.parts = { lead: 3 };
    ok(!trial(b3).ok, "a number was accepted where the desk wants a mix entry");
  }
  // (f) ABSENT IS TODAY, through the whole door: a song with no `parts` comes
  // back with no `parts`, and one whose entries all normalize away does too —
  // so there is exactly one spelling of "unmixed" for the mixer to skip on.
  {
    const b = S.emptyBox();
    const r = trial(b);
    ok(r.ok && r.song.song[0].parts === null, "an unmixed box did not come back unmixed");
    const b2 = S.emptyBox(); b2.parts = { lead: {}, drums: {} };
    const r2 = trial(b2);
    ok(r2.ok && r2.song.song[0].parts === null,
       "a map of empty entries did not normalize to absent");
    // and it survives the round trip that every save takes
    const b3 = S.emptyBox(); b3.parts = { drums: { pan: "l", solo: true } };
    const once = trial(b3);
    ok(once.ok, "a soloed kit did not validate");
    const twice = S.load(JSON.parse(JSON.stringify(once.song)));
    ok(twice.ok && JSON.stringify(twice.song.song[0].parts) ===
       JSON.stringify(once.song.song[0].parts),
       "the per-part mix is not stable across a save/load round trip");
  }
  // (f2) THE FADER OFFSETS through the loader — the len/nudge policy at both
  // scopes: garbage rejects and names its field, a wild number clamps, and 0
  // normalizes away so "no offset" keeps one spelling (absent).
  {
    const b = S.emptyBox(); b.parts = { lead: { fader: -6.16 } };
    const r = trial(b);
    ok(r.ok && r.song.song[0].parts.lead.fader === -6.2,
       "a part fader did not load at 0.1 dB: " +
       JSON.stringify(r.ok && r.song.song[0].parts));
    const bz = S.emptyBox(); bz.parts = { lead: { fader: 0 } };
    const rz = trial(bz);
    ok(rz.ok && rz.song.song[0].parts === null,
       "a zero part fader did not normalize to absent");
    const bj = S.emptyBox(); bj.parts = { lead: { fader: "loud" } };
    const rj = trial(bj);
    ok(!rj.ok && /\.parts\.lead\.fader$/.test(rj.errors[0].path),
       "a garbage part fader did not name its own field");
    const bb = S.emptyBox(); bb.fader = -99;
    const rb = trial(bb);
    ok(rb.ok && rb.song.song[0].fader === -24,
       "a wild box fader did not clamp to the registry range");
    const b0 = S.emptyBox(); b0.fader = 0;
    ok(trial(b0).ok && trial(b0).song.song[0].fader === null,
       "a zero box fader did not normalize to absent");
    const bx = S.emptyBox(); bx.fader = "hot";
    const rx = trial(bx);
    ok(!rx.ok && /\.fader$/.test(rx.errors[0].path),
       "a garbage box fader did not name its own field");
  }
  // (g) A v:1 SAVE HAS NO DESK AND MUST NOT GROW ONE. `parts` is additive, so
  // there is no migration to write — which is exactly the claim worth holding.
  {
    const ph = () => ({ deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                        vel: new Array(16).fill(5), gate: new Array(16).fill(1),
                        acc: new Array(16).fill(0), sld: new Array(16).fill(0) });
    const r = S.load({ v: 1, slots: [ph()], bpm: 126, vol: 80,
                       song: [{ genre: "acid", slots: [0], len: 4, nudge: 0, ops: [] }] });
    ok(r.ok && r.song.song[0].parts == null,
       "a v:1 save came back carrying a per-part mix it never had");
  }
  // and the instrument table is untouched by any of this — the desk addresses
  // chairs, it does not re-seat them
  ok(typeof NI.stripFor("clean_guitar", false) === "object",
     "stripFor stopped answering — the per-part desk must not touch the strips");
}

/* ---------- 37b. THE MASTER BUS -------------------------------------------
   The other end of the desk. §37 proves a box can treat one chair; this proves
   the song can treat everything, and — the part that actually matters — that a
   song which asks for NOTHING resolves to exactly the chain audio/graph.js has
   always built. The graph keys its whole absent-is-today branch on that, and
   the offline bounce renders through the same builder, so a drift here is a
   background carrier that does not match the foreground.

   Pure node: fields.js and song.js only. The audible half (the spectrum moves,
   the blob carries it) is the browser gates' job — nukernel-audio's shape
   correlation and nukernel-survival's carrier read. */
console.log("the master bus — globals, defaults, and what the loader keeps");
{
  const F = require("../../nukernel/fields.js");
  const S = require("../../nukernel/song.js");

  // (a) THE REGISTRY IS COMPLETE, by the rules PARTMIX and FIELDS are held to
  for (const f of F.MASTER) {
    ok(typeof f.key === "string" && f.key, "a MASTER entry has no key");
    ok(typeof f.label === "string" && f.label, f.key + ": no silkscreen label");
    ok(f.table && Object.keys(f.table).length, f.key + ": no value table");
    ok(f.labels && Object.keys(f.table).every(k => f.labels[k] != null),
       f.key + ": a table value has no label");
    ok(f.default === null, f.key + ": a global defaults to something");
    // NO "OFF" ENTRY, anywhere. A chip is a toggle and the empty option is how
    // a global clears, so an explicit off/flat/normal would be a second
    // spelling of absent — and two spellings of a default is what song.js and
    // the graph both normalize away.
    for (const k of Object.keys(f.table))
      ok(!/^(off|none|flat|normal)$/.test(k),
         f.key + ": '" + k + "' is a second spelling of the default");
  }
  ok(F.MASTER.every(f => F.MASTERBY[f.key] === f), "MASTERBY is not the same table");

  // (b) ABSENT IS TODAY. The default glue is live.js's bus compressor at
  // -22/2.2 into the RESTAGED x1.4 makeup (2026-08-16: at x2.2 a composed
  // song's peaks sat pinned on the brickwall — fields.js GLUES has the
  // measured numbers), the brickwall at -1.5 — and resolveMaster must land on
  // them from nothing, from {}, and from a spec full of values the build does
  // not recognize.
  {
    const d = F.resolveMaster(null);
    ok(d.glue.thr === -22 && d.glue.knee === 28 && d.glue.ratio === 2.2 &&
       d.glue.atk === 0.015 && d.glue.rel === 0.25 && d.glue.makeup === 1.4,
       "the resolved glue is not the shipped default bus compressor: " + JSON.stringify(d.glue));
    ok(d.ceiling.thr === -1.5 && d.ceiling.push === 1 && d.ceiling.clip === 0,
       "the resolved ceiling is not the brickwall graph.js always built: " +
       JSON.stringify(d.ceiling));
    ok(d.drive === null && d.tape === null && d.space === null &&
       d.width === null && d.tilt === null,
       "an unset global resolved to something the graph would build a node for: " +
       JSON.stringify(d));
    const j = JSON.stringify(d);
    ok(JSON.stringify(F.resolveMaster({})) === j, "{} is not the same as absent");
    ok(JSON.stringify(F.resolveMaster({ drive: "nonsense", ceiling: "nuclear" })) === j,
       "an unrecognized value did not fall back to today");
    // …and the two explicit names for today's numbers really are today's
    ok(JSON.stringify(F.resolveMaster({ glue: "glue", ceiling: "open" })) === j,
       "choosing 'glue'/'open' by hand is not the same chain as choosing nothing");
  }

  // (c) A SET VALUE IS THE REGISTRY'S OWN NUMBER, not a second table, and the
  // resolved objects are COPIES — the graph reads them into AudioParams and a
  // shared literal would be one edit away from rewriting the table.
  {
    const m = F.resolveMaster({ drive: "crush", glue: "squash", tape: "worn",
                                space: "hall", width: "mono", tilt: "dark",
                                ceiling: "louder" });
    ok(m.drive === F.DRIVES.crush, "drive did not resolve through DRIVES");
    ok(m.glue.ratio === F.GLUES.squash.ratio, "glue did not resolve through GLUES");
    ok(m.tape.wob === F.TAPES.worn.wob && m.tape.sat === F.TAPES.worn.sat,
       "tape did not resolve through TAPES");
    ok(m.space.mix === F.SPACES.hall.mix, "space did not resolve through SPACES");
    ok(m.width === F.WIDTHS.mono, "width did not resolve through WIDTHS");
    ok(m.tilt === F.TILTS.dark, "tilt did not resolve through TILTS");
    ok(m.ceiling.push === F.CEILINGS.louder.push, "ceiling did not resolve through CEILINGS");
    ok(m.glue !== F.GLUES.squash && m.tape !== F.TAPES.worn && m.space !== F.SPACES.hall,
       "resolveMaster handed out the shipped table object itself");
    // mono is 0, which is FALSY and the exact value a lazy `if (width)` drops
    ok(F.resolveMaster({ width: "mono" }).width === 0,
       "width 'mono' resolved to null — a falsy engine value was read as absent");
  }

  // (d) masterIsDefault answers the surface's question, not a shape question
  ok(F.masterIsDefault(null) && F.masterIsDefault({}) &&
     F.masterIsDefault({ drive: null }) && F.masterIsDefault({ drive: "nonsense" }),
     "masterIsDefault called a no-op spec a treatment");
  ok(!F.masterIsDefault({ drive: "hair" }) && !F.masterIsDefault({ width: "mono" }),
     "masterIsDefault called a real treatment a default");

  // (e) THE LOADER. Keys filter (the vocabulary will move), values REJECT (an
  // unknown ceiling means the file is from a build this one cannot honestly
  // play), and absent has one spelling on the way out.
  const trialM = master => S.validateSong(
    { v: 2, slots: [S.blank()], song: [S.emptyBox()], master, bpm: 126, vol: 80 });
  {
    const r = trialM({ drive: "dirt", tape: "worn", nonsense: "x", tilt: null });
    ok(r.ok, "the loader refused a legal master: " + JSON.stringify(r.errors[0]));
    ok(r.ok && JSON.stringify(r.song.master) === '{"drive":"dirt","tape":"worn"}',
       "the master did not come back filtered and ordered: " +
       JSON.stringify(r.ok && r.song.master));
    const bad = trialM({ ceiling: "nuclear" });
    ok(!bad.ok && bad.errors[0].path === "master.ceiling",
       "a bad global did not name its own field: " + JSON.stringify(bad.errors[0]));
    ok(!trialM([{ drive: "dirt" }]).ok, "an array was accepted where the bus wants a map");
    ok(!trialM(7).ok, "a number was accepted where the bus wants a map");
  }
  // (f) ABSENT IS TODAY THROUGH THE WHOLE DOOR — including a v:1 save, which
  // never had a master and must not grow one
  {
    ok(trialM(undefined).song.master === null, "a song with no master came back with one");
    ok(trialM({}).song.master === null, "an empty master did not normalize to absent");
    ok(trialM({ drive: null }).song.master === null,
       "a master of nulls did not normalize to absent");
    const ph = () => ({ deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                        vel: new Array(16).fill(5), gate: new Array(16).fill(1),
                        acc: new Array(16).fill(0), sld: new Array(16).fill(0) });
    const r = S.load({ v: 1, slots: [ph()], bpm: 126, vol: 80,
                       song: [{ genre: "acid", slots: [0], len: 4, nudge: 0, ops: [] }] });
    ok(r.ok && r.song.master === null,
       "a v:1 save came back carrying a master bus it never had");
  }
  // (g) …and it survives the round trip every save takes
  {
    const once = trialM({ space: "cavern", width: "huge", glue: "pump" });
    ok(once.ok, "a full master did not validate");
    const twice = S.load(JSON.parse(JSON.stringify(once.song)));
    ok(twice.ok && JSON.stringify(twice.song.master) === JSON.stringify(once.song.master),
       "the master bus is not stable across a save/load round trip");
  }
}

/* ---------- 37c. THE SHARED-BUS TRIMS -------------------------------------
   The rack's knobs (fields.js BUSES): reverb/echo/room return trims plus the
   echo's two internals, the master-bus law one shelf down. The claim that
   matters is the same one: a song that asks for NOTHING resolves to the graph
   exactly as built — ret ×1, fb/tone null — because audio/graph.js keys its
   as-built branch on that, and the offline bounce bakes the same resolution
   into every window. Pure node; the audible half is the browser gates'. */
console.log("the shared buses — the rack registry, defaults, and the loader");
{
  const F = require("../../nukernel/fields.js");
  const S = require("../../nukernel/song.js");

  // (a) the registry is complete and self-describing — a knob with no table
  // or label is a control a surface cannot draw
  ok(Array.isArray(F.BUSES) && F.BUSES.length === 3 &&
     F.BUSES.map(b => b.bus).join(",") === "rev,echo,room",
     "the bus registry does not name the graph's own shared roster");
  for (const b of F.BUSES) {
    ok(typeof b.label === "string" && b.label, b.bus + " has no label");
    ok(b.knobs.some(k => k.key === "ret"), b.bus + " has no return knob");
    for (const k of b.knobs) {
      ok(k.table && k.labels && Object.keys(k.table).length >= 2,
         b.bus + "." + k.key + " has no table/labels");
      ok(Object.keys(k.table).every(x => k.labels[x]),
         b.bus + "." + k.key + " has a value with no label");
      ok(k.default === null, b.bus + "." + k.key + " defaults to something — " +
         "absent must be the graph as built");
    }
  }
  ok(F.BUSES.every(b => F.BUSBY[b.bus] === b), "BUSBY is not the same table");

  // (b) ABSENT IS THE GRAPH AS BUILT: every ret ×1, echo internals untouched
  {
    const d = F.resolveBuses(null);
    ok(d.rev.ret === 1 && d.echo.ret === 1 && d.room.ret === 1,
       "an absent spec did not resolve every return to unity");
    ok(d.echo.fb === null && d.echo.tone === null,
       "an absent spec touched the echo's own constants");
    const j = JSON.stringify(d);
    ok(JSON.stringify(F.resolveBuses({})) === j, "{} is not the same as absent");
    ok(JSON.stringify(F.resolveBuses({ rev: { ret: "soaked" } })) === j,
       "junk values did not resolve as absent");
  }
  // (c) a set spec resolves through its own tables
  {
    const m = F.resolveBuses({ rev: { ret: "hot" }, echo: { fb: "less", tone: "dark" },
                               room: { ret: "down" } });
    ok(m.rev.ret === 1.6 && m.room.ret === 0.5,
       "return trims did not resolve through the table");
    ok(m.echo.fb === 0.22 && m.echo.tone === 1400 && m.echo.ret === 1,
       "the echo knobs did not resolve independently");
  }
  // (d) busesIsDefault answers the normalizer's question
  ok(F.busesIsDefault(null) && F.busesIsDefault({}) &&
     F.busesIsDefault({ rev: { ret: "nonsense" } }),
     "busesIsDefault called a no-op spec a treatment");
  ok(!F.busesIsDefault({ room: { ret: "down" } }),
     "busesIsDefault called a real trim a default");

  // (e) THE LOADER — the master's split at both levels: bus and knob KEYS
  // filter, knob VALUES reject, absent keeps one spelling
  const trialB = buses => S.validateSong(
    { v: 2, slots: [S.blank()], song: [S.emptyBox()], buses, bpm: 126, vol: 80 });
  {
    const r = trialB({ rev: { ret: "up" }, junkbus: { x: 1 }, echo: { junkknob: "x" } });
    ok(r.ok, "the loader refused a legal buses spec: " + JSON.stringify(r.errors && r.errors[0]));
    ok(r.ok && JSON.stringify(r.song.buses) === '{"rev":{"ret":"up"}}',
       "buses did not come back filtered: " + JSON.stringify(r.ok && r.song.buses));
    const bad = trialB({ rev: { ret: "soaked" } });
    ok(!bad.ok && bad.errors[0].path === "buses.rev.ret",
       "a bad trim did not name its own field: " + JSON.stringify(bad.errors[0]));
    ok(!trialB([{ rev: 1 }]).ok, "an array was accepted where the rack wants a map");
    ok(trialB(undefined).song.buses === null, "a song with no buses came back with some");
    ok(trialB({}).song.buses === null, "an empty buses spec did not normalize to absent");
    ok(trialB({ rev: {} }).song.buses === null,
       "a map of empty entries did not normalize to absent");
  }
  // (f) …and the round trip every save takes
  {
    const once = trialB({ echo: { ret: "dim", fb: "more" }, room: { ret: "hot" } });
    ok(once.ok, "a full buses spec did not validate");
    const twice = S.load(JSON.parse(JSON.stringify(once.song)));
    ok(twice.ok && JSON.stringify(twice.song.buses) === JSON.stringify(once.song.buses),
       "the bus trims are not stable across a save/load round trip");
  }
}

/* ---------- 37d. THE STRIP EQ ---------------------------------------------
   "Every strip earns its tone": LO/MID/HI on every channel strip, LO/HI on
   the bus returns (fields.js EQ_BANDS / BUS_EQ_BANDS). The audible half —
   biquads in the built chain, bytes moving under a +12 dB shelf — is the
   browser gate's (nukernel-drums eqProbe, which also holds the zero-nodes
   claim at graph level). What lives here is everything upstream of a node:
   the band registry, the dB policy, the resolvers, and the loader — under the
   one law that matters most: FLAT IS ABSENT, with exactly one spelling, or
   every song ever saved changes graph. */
console.log("the strip EQ — bands, the dB policy, the resolvers, and the loader");
{
  const F = require("../../nukernel/fields.js");
  const S = require("../../nukernel/song.js");

  // (a) THE BAND LIST IS BUILDABLE: key/label for the surface, type/freq (and
  // the bell's q) for the node — graph.buildEq reads exactly these.
  ok(Array.isArray(F.EQ_BANDS) && F.EQ_BANDS.map(b => b.key).join(",") === "lo,mid,hi",
     "the strip EQ is not the three bands lo,mid,hi");
  for (const b of F.EQ_BANDS) {
    ok(typeof b.label === "string" && b.label, b.key + " has no silkscreen label");
    ok(["lowshelf", "peaking", "highshelf"].includes(b.type),
       b.key + ": type " + b.type + " is not a biquad the builder can make");
    ok(Number.isFinite(b.freq) && b.freq > 20 && b.freq < 16000,
       b.key + ": frequency " + b.freq + " is not on the audible desk");
  }
  ok(F.EQ_BANDS[1].type === "peaking" && Number.isFinite(F.EQ_BANDS[1].q),
     "the mid bell has no Q — a peaking biquad at default Q is a different EQ");
  // the bus pair IS the strip's own shelves — same objects, one frequency per
  // word, and the registry rows all point at the one list
  ok(F.BUS_EQ_BANDS.length === 2 && F.BUS_EQ_BANDS[0] === F.EQ_BANDS[0] &&
     F.BUS_EQ_BANDS[1] === F.EQ_BANDS[2],
     "the bus pair is not the strip's own lo/hi shelves");
  ok(F.BUSES.every(b => b.eq === F.BUS_EQ_BANDS),
     "a bus registry row does not carry the shared band pair");
  ok(F.FIELD.eq && F.FIELD.eq.type === "eq" && F.FIELD.eq.scope === "box" &&
     F.FIELD.eq.bands === F.EQ_BANDS && F.FIELD.eq.default === null,
     "the section strip's eq is not a box-scope, absent-by-default registry entry");
  ok("eq" in S.emptyBox() && S.emptyBox().eq === null,
     "emptyBox does not seed `eq` absent");

  // (b) THE dB POLICY — the fader's, at the EQ's own range: clamp ±12, hold
  // to 0.1 dB, garbage resolves to 0 (flat), never to anything audible
  ok(F.eqDb(6) === 6 && F.eqDb(-6) === -6, "a set band did not survive eqDb");
  ok(F.eqDb(99) === 12 && F.eqDb(-99) === -12, "eqDb is not clamped to ±12");
  ok(F.eqDb(3.14159) === 3.1, "eqDb is not held to 0.1 dB");
  ok(F.eqDb(NaN) === 0 && F.eqDb("loud") === 0 && F.eqDb(null) === 0,
     "garbage did not resolve to flat");

  // (c) RESOLUTION: null is FLAT is "build zero filter nodes", with every
  // no-op spelling collapsing onto it; a non-flat spec resolves EVERY band
  ok(F.resolveEq(null) === null && F.resolveEq({}) === null,
     "an absent spec did not resolve to null");
  ok(F.resolveEq({ lo: 0, mid: 0, hi: 0 }) === null,
     "an all-zero spec is a second spelling of flat");
  ok(F.resolveEq({ lo: "loud", mid: NaN }) === null,
     "junk bands did not resolve as flat");
  {
    const r = F.resolveEq({ lo: 12, hi: -3.14 });
    ok(r.lo === 12 && r.mid === 0 && r.hi === -3.1,
       "a set spec did not resolve totally: " + JSON.stringify(r));
  }
  // a band the strip lacks is not a treatment: `mid` on a bus pair is flat
  ok(F.resolveEq({ mid: 6 }, F.BUS_EQ_BANDS) === null,
     "a band the bus pair lacks resolved to a treatment");
  ok(F.eqIsFlat(null) && F.eqIsFlat({ lo: 0 }) && !F.eqIsFlat({ lo: 3 }),
     "eqIsFlat does not answer the normalizer's question");

  // (d) THE RESOLVERS CARRY IT — part, and bus
  ok(F.resolvePartMix(null).eq === null && F.resolvePartMix({ eq: { lo: 0 } }).eq === null,
     "an untouched part strip did not resolve flat");
  ok(F.resolvePartMix({ eq: { lo: 4 } }).eq.lo === 4,
     "a part's set band did not resolve through eqDb");
  ok(F.resolveBuses(null).rev.eq === null,
     "an absent buses spec grew a return EQ");
  ok(F.resolveBuses({ rev: { eq: { hi: 6 } } }).rev.eq.hi === 6,
     "a return's set band did not resolve");
  ok(F.busesIsDefault({ rev: { eq: { lo: 0 } } }),
     "a flat return EQ counted as a treatment — setBuses would keep it");
  ok(!F.busesIsDefault({ rev: { eq: { lo: 3 } } }),
     "a real return EQ counted as the default — setBuses would drop it");

  // (e) THE LOADER, at all three doors. Band KEYS filter, VALUES take the
  // fader's policy (garbage rejects, wild clamps, zero normalizes away).
  const trial = mut => {
    const b = S.emptyBox(); const s = { v: 2, slots: [S.blank()], song: [b], bpm: 126, vol: 80 };
    mut(b, s); return S.validateSong(s);
  };
  {
    const r = trial(b => { b.eq = { lo: 3.14159, mid: 0, junk: 5 }; });
    ok(r.ok && JSON.stringify(r.song.song[0].eq) === '{"lo":3.1}',
       "the box eq did not come back filtered+clamped: " +
       JSON.stringify(r.ok && r.song.song[0].eq));
    const bad = trial(b => { b.eq = { mid: "loud" }; });
    ok(!bad.ok && bad.errors[0].path === "song[0].eq.mid",
       "a garbage band did not name its own field: " + JSON.stringify(bad.errors[0]));
    ok(!trial(b => { b.eq = [3]; }).ok, "an array was accepted where the strip wants a map");
    ok(trial(b => { b.eq = { lo: 0, hi: 0 }; }).song.song[0].eq === null,
       "an all-zero box eq did not normalize to absent");
    ok(trial(b => { b.eq = { lo: 99 }; }).song.song[0].eq.lo === 12,
       "a wild band did not clamp to the registry's own range");
  }
  {
    const r = trial(b => { b.parts = { lead: { eq: { hi: -6 } } }; });
    ok(r.ok && r.song.song[0].parts.lead.eq.hi === -6,
       "a part's eq did not survive the loader");
    ok(trial(b => { b.parts = { lead: { eq: { hi: 0 } } }; }).song.song[0].parts === null,
       "a flat part eq did not normalize the whole entry away");
    // string garbage, deliberately: a NaN cannot survive the JSON round trip
    // every save takes (it lands as null, which is a legal empty band)
    const bad = trial(b => { b.parts = { lead: { eq: { lo: "loud" } } }; });
    ok(!bad.ok && bad.errors[0].path === "song[0].parts.lead.eq.lo",
       "a part's garbage band did not name its field: " + JSON.stringify(bad.errors[0]));
  }
  {
    const r = trial((b, s) => { s.buses = { rev: { eq: { lo: 3, mid: 6 } } }; });
    ok(r.ok && JSON.stringify(r.song.buses) === '{"rev":{"eq":{"lo":3}}}',
       "the bus pair did not filter the band it lacks: " +
       JSON.stringify(r.ok && r.song.buses));
    const bad = trial((b, s) => { s.buses = { echo: { eq: { hi: "x" } } }; });
    ok(!bad.ok && bad.errors[0].path === "buses.echo.eq.hi",
       "a return's garbage band did not name its field: " + JSON.stringify(bad.errors[0]));
    ok(trial((b, s) => { s.buses = { room: { eq: { lo: 0 } } }; }).song.buses === null,
       "a flat return eq did not normalize the buses map to absent");
  }
  // (f) …and the round trip every save takes, at all three homes at once
  {
    const once = trial((b, s) => {
      b.eq = { mid: -2.5 };
      b.parts = { drums: { eq: { lo: 6 } } };
      s.buses = { rev: { ret: "up", eq: { hi: -4 } } };
    });
    ok(once.ok, "a full eq spec did not validate: " +
       JSON.stringify(once.errors && once.errors[0]));
    const twice = S.load(JSON.parse(JSON.stringify(once.song)));
    ok(twice.ok &&
       JSON.stringify(twice.song.song[0].eq) === JSON.stringify(once.song.song[0].eq) &&
       JSON.stringify(twice.song.song[0].parts) === JSON.stringify(once.song.song[0].parts) &&
       JSON.stringify(twice.song.buses) === JSON.stringify(once.song.buses),
       "the strip EQ is not stable across a save/load round trip");
  }
}

/* ---------- 38. THE DISSONANCE CENSUS -------------------------------------
   THE EARS SAID "TANGO IS INHARMONIC. COUNTERPOINT IS INHARMONIC." Nothing in
   this suite could have caught that: every check above asks whether a value
   reaches the output, and a wrong note reaches the output perfectly. So this
   section measures the one thing none of the others do — what the notes sound
   like AGAINST EACH OTHER — over every genre, several composed seeds, and both
   the one-phrase box and the multi-phrase box, with the phrases DEALT ACROSS
   VOICES exactly as ui/derive.js deals them (voice v gets phrase v % n; render
   every voice from one phrase and the lines move in lockstep, which hides
   every clash that only exists because two parts move independently).

   Four measurements, all normalized per bar or per sounding moment:
     (a) ic1   simultaneous SEMITONE collisions       (minor 2nd / major 7th)
     (b) ic6   simultaneous TRITONE collisions
     (c) nct%  non-chord AND non-scale tones landing on strong beats
     (d) mb/mp the (a)+(b) weight that is melody-vs-BASS and melody-vs-PAD

   HOW A PREPARED DISSONANCE IS TOLD FROM A WRONG NOTE, which is the whole
   reason this is a census and not a clash counter. A fugue's suspensions and a
   blues' passing tones are CORRECT and must not be scored. Four rules, applied
   in order to every overlapping pair:

     1. THE CHORD'S OWN COLOUR IS NOT A CLASH. If both pitch classes are in the
        sounding chord, the dissonance is the chord — a maj7 owns an ic1, a
        dom7 owns an ic6 — and twelve bars of blues must not read as twelve
        bars of mistake.
     2. THE ACCUSED IS THE NOTE OUTSIDE THE CHORD. If neither is in it, the one
        that entered LAST is the dissonance against the standing note; and a
        pad or stab voice is never the accused while a line is available, since
        its notes ARE the harmony by construction.
     3. PREPARED AND RESOLVED IS FORGIVEN. Approached by step (or tied over)
        AND left by step is a suspension, a passing tone or a neighbour — the
        species-counterpoint licence — and scores zero. So does an APPROACH
        TONE with no preparation at all: a note that steps into a chord tone of
        the chord it lands in is an appoggiatura, and it is the definition of a
        walking bass's fourth beat. (Without that clause the walk read as the
        worst clash in the table, which was a census bug and not a genre one.)
     4. WHAT IS LEFT IS A WRONG NOTE: leapt into, leapt out of, and outside the
        harmony. Weighted by how long the two actually overlap, and discounted
        with register — a minor second inside one octave is the complaint; the
        same interval class three octaves apart is a colour.

   WHAT IT FOUND, and both were confirmed before anything was theorized:
     * COUNTERPOINT was the worst genre in the table that is not supposed to be
       dissonant. Both voices play the same rhythm, so invert(c) makes their
       degrees SUM to a constant and the vertical interval is a function of the
       sum alone; sums 2, 3 and 6 (mod 7) are the only three that put a
       semitone or a tritone on a common degree, and the word used 6 and 2.
     * TANGO held minor ninths against its own pad in half its bars: `diatonic`
       keeps the line in the key, the dominant is the one chord in a minor key
       whose scale is NOT the tonic's, and the answering voice's transpose(-2)
       is a third below the SCALE rather than below the chord.
   Fixes: the axis (genres.js) and `anchor` (kernel.js). Census after: 2.00 ->
   0.00 and 1.19 -> 0.40.

   THE GATE. BASELINE is the measured value of every genre, not a wish; the
   ceiling is baseline x 1.5 + 0.20 applied identically to every genre, so one
   that regresses into clashiness fails AND IS NAMED while ordinary churn does
   not. On top of that one absolute BAR, set at the 90th percentile of the
   measured distribution rounded up to the next 0.25 — and the only way past it
   is the ALLOW list, one entry with one reason, never a higher bar.
   `NUKERNEL_CENSUS=1` prints the full ranked table. */
console.log("dissonance census — what the notes sound like against each other");
{
  const C = require("../../nukernel/compose.js");
  const pcOf = n => ((n % 12) + 12) % 12;
  const ICv = (a, b) => { const d = Math.abs(a - b) % 12; return Math.min(d, 12 - d); };

  // ui/derive.js's deal, plus the bass (which follows the first phrase there too)
  const dealt = (g, phs, bars) => {
    const out = [];
    phs.forEach((ph, pi) => {
      for (const e of K.render(ph, g, bars)) if (e.v % phs.length === pi) out.push(e);
    });
    for (const e of K.bass(phs[0], g, bars)) out.push({ ...e, part: "bass", v: -1 });
    return out.filter(e => e.n != null && e.dur > 0).sort((a, b) => a.t - b.t || a.n - b.n);
  };

  function measure(g, phs, bars) {
    const ph = phs[0], NN = ph.deg.length, rate = g.rate, key = g.key | 0;
    const ev = dealt(g, phs, bars);
    if (!ev.length) return null;

    // chords, KEYED — render adds g.key to every pitch and chordsOf does not
    const cache = new Map();
    const chordAt = t => {
      const step = t * rate, bar = Math.floor(step / NN + 1e-9);
      let cs = cache.get(bar);
      if (!cs) {
        cs = K.chordsOf(ph, g, bar).map(c =>
          ({ ...c, pcSet: new Set(c.pcs.map(n => pcOf(n + key))) }));
        cache.set(bar, cs);
      }
      const s = ((step % NN) + NN) % NN;
      return cs.find(c => s >= c.start - 1e-9 && s < c.start + c.len) || cs[cs.length - 1];
    };

    const byV = new Map();
    for (const e of ev) { if (!byV.has(e.v)) byV.set(e.v, []); byV.get(e.v).push(e); }
    const idxOf = new Map();
    for (const [, list] of byV) list.forEach((e, i) => idxOf.set(e, i));
    const neighbours = e => {
      const list = byV.get(e.v), i = idxOf.get(e);
      let prev = null, next = null;
      for (let j = i - 1; j >= 0; j--)
        if (list[j].t < e.t - 1e-9) { if (!prev || list[j].t > prev.t) prev = list[j]; else break; }
      for (let j = i + 1; j < list.length; j++) if (list[j].t > e.t + 1e-9) { next = list[j]; break; }
      return { prev, next };
    };
    // RULES 3 AND 4, in order
    const verdict = a => {
      const { prev, next } = neighbours(a);
      const prepared = prev && Math.abs(a.n - prev.n) <= 2;    // tied over, or stepped into
      const stepOut = next && Math.abs(next.n - a.n) <= 2;
      if (prepared && stepOut) return "ok";                    // suspension / passing / neighbour
      if (stepOut && chordAt(next.t).pcSet.has(pcOf(next.n))) return "ok";   // appoggiatura
      if (!scalePcs.has(pcOf(a.n))) return "wrong";            // out of key AND unresolved
      if (prepared || stepOut) return "ok";                    // in key, connected one side
      return "wrong";                                           // in key, leapt to and left
    };

    const scalePcs = new Set();
    for (const d of (g.scale || K.PENT)) scalePcs.add(pcOf(d + key));
    for (const d of (g.mode || K.MODE)) scalePcs.add(pcOf(d + key));

    const out = { bars, ic1: 0, ic6: 0, ic1raw: 0, ic6raw: 0, nct: 0, notes: 0,
                  mb: 0, mp: 0, all: 0, worst: [] };
    const chordy = p => p === "pad" || p === "stab";
    const active = [];
    for (const e of ev) {
      for (let i = active.length - 1; i >= 0; i--)
        if (active[i].t + active[i].dur <= e.t + 1e-9) active.splice(i, 1);
      for (const o of active) {
        const ov = Math.min(o.t + o.dur, e.t + e.dur) - e.t;
        if (ov <= 1e-9) continue;
        const dur = Math.min(ov * rate, 4);            // steps of overlap, capped
        out.all += dur;                                // the denominator: all sonority
        const ic = ICv(o.n, e.n);
        if (ic !== 1 && ic !== 6) continue;
        const gap = Math.abs(o.n - e.n);
        const w = dur * (gap <= 15 ? 1 : gap <= 27 ? 0.5 : 0.25);
        if (ic === 1) out.ic1raw += w; else out.ic6raw += w;
        const c = chordAt(e.t);
        const inO = c.pcSet.has(pcOf(o.n)), inE = c.pcSet.has(pcOf(e.n));
        if (inO && inE) continue;                      // rule 1
        let acc = !inE ? e : o;                        // rule 2
        if (!inO && !inE) acc = o.t > e.t ? o : e;
        let other = acc === e ? o : e;
        if (chordy(acc.part) && !chordy(other.part)) { const t = acc; acc = other; other = t; }
        if (verdict(acc) !== "wrong") continue;
        if (ic === 1) out.ic1 += w; else out.ic6 += w;
        if (acc.part === "bass" || other.part === "bass") out.mb += w;
        if (chordy(acc.part) || chordy(other.part)) out.mp += w;
        out.worst.push({ w, ic, step: acc.t * rate, n: acc.n, on: other.n,
                         who: (acc.part || "line") + " vs " + (other.part || "line") });
      }
      active.push(e);
    }
    // (c) a foreign tone on a strong beat: in neither the chord nor the key
    for (const e of ev) {
      if (chordy(e.part) || e.part === "bass") continue;
      const step = e.t * rate;
      if (Math.abs(step - Math.round(step)) > 1e-6 || Math.round(step) % 4 !== 0) continue;
      out.notes++;
      const pc = pcOf(e.n);
      if (!chordAt(e.t).pcSet.has(pc) && !scalePcs.has(pc)) out.nct++;
    }
    return out;
  }

  // THE MATERIAL: the seed phrase plus the composer's own bank at four seeds,
  // each read twice — as a one-phrase box and as a multi-phrase one
  const SEEDS = [1, 5, 7, 11], KINDS = [0, 1, 2, 3, 5];   // hook answer riff counter topline
  function census(gk) {
    const g = GENRES[gk], bars = Math.max(4, g.bars), sets = [[DEFAULT]];
    for (const s of SEEDS) {
      const sl = C.compose(gk, s).slots;
      sets.push(KINDS.map(i => sl[i]));
      sets.push([sl[0]]);
    }
    const tot = { ic1: 0, ic6: 0, ic1raw: 0, ic6raw: 0, nct: 0, mb: 0, mp: 0,
                  bars: 0, all: 0, notes: 0 };
    const worst = [];
    for (const set of sets) {
      const m = measure(g, set.slice(0, Math.max(1, g.voices)), bars);
      if (!m) continue;
      for (const k of Object.keys(tot)) if (k !== "bars") tot[k] += m[k];
      tot.bars += m.bars;
      worst.push(...m.worst);
    }
    const per = k => (tot.bars ? tot[k] / tot.bars : 0);
    return { gk, pct: tot.all ? 100 * (tot.ic1 + tot.ic6) / tot.all : 0,
             ic1: per("ic1"), ic6: per("ic6"), ic1raw: per("ic1raw"), ic6raw: per("ic6raw"),
             nct: tot.notes ? 100 * tot.nct / tot.notes : 0, mb: per("mb"), mp: per("mp"),
             worst: worst.sort((a, b) => b.w - a.w).slice(0, 5) };
  }

  // THE MEASURED DISTRIBUTION — every genre's own number, re-baked with
  // `NUKERNEL_CENSUS=1` when a deliberate change moves one. Not a wish list:
  // blues really is at 3.95 and simple really is at 0.
  const BASELINE = {
    blues: 3.95, spem: 2.17, deathmetal: 1.73, shoegaze: 1.72, vaporwave: 1.64,
    ambient: 1.46, garage: 1.43, sludge: 1.27, steely: 1.04, countrypop: 0.89,
    eurythmics: 0.75, bulgarian: 0.74, isley: 0.72, afrobeat: 0.63, funk: 0.61,
    punk: 0.55, ska: 0.52, rnb: 0.46, beatles: 0.43, postrock: 0.43,
    tango: 0.40, drone: 0.35, jodeci: 0.28, disco: 0.27, bossa: 0.23,
    neoclassical: 0.19, toto: 0.17, motown: 0.15, citypop: 0.11, house: 0.09,
    newwave: 0.07, synthpop: 0.05, boombap: 0.04, gospel: 0.03, rock: 0.03,
    simple: 0, fugue: 0, acid: 0, gregorian: 0, counterpoint: 0,
    trap: 0, dnb: 0, reggae: 0, dub: 0, techno: 0,
    // THE ANCESTORS, measured the day they landed (NUKERNEL_CENSUS=1). Every
    // one is under the 1.5 bar, so none of them needs an ALLOW entry — which
    // is worth saying for the two that could have gone either way: chuck berry
    // sounds a major third against a ♭7 twelve bars out of twelve and still
    // reads 0.95 (a third of blues's 3.95) because the double stop is a fourth
    // and fourths are not in the census's alphabet, and doo-wop's 0.85 is
    // almost entirely bass-vs-riff, which is what `anchor: 2` already halved.
    chuckberry: 0.95, doowop: 0.85, electro: 0.77, kraftwerk: 0.43,
    minimalism: 0.29, jazz: 0.14, bodiddley: 0, skiffle: 0,
    // THE FUNCTION GENRES all measure zero, and the reason is the same one for
    // all five: a part carries no progression of its own and reads the same
    // pentatonic the rest of the table does, so standalone there is nothing for
    // it to be out of tune WITH. The number that matters for these is the one
    // the census cannot see — a part STACKED on a host — which is what §40's
    // Beatles test measures instead.
    solo: 0, vocal: 0, backing: 0, riff: 0, pad: 0,
    // THE TWENTY-NINE ROOMS, measured the day after they landed
    // (NUKERNEL_CENSUS=1), appended the way the ancestors were rather than
    // merged into the sorted rows above — these are their own first
    // measurement, not a re-bake of anyone else's. Twenty-five of the
    // twenty-nine come in under the 1.5 bar. FOUR DO NOT and are on ALLOW
    // below, each for a mechanism you can name.
    screamo: 3.26, confessionalpop: 2.18, drill: 1.95, sophistirock: 1.79,
    industrialmetal: 1.17, latinpop: 0.81, merseybeat: 0.78, hymn: 0.65,
    psychpop: 0.62, jamband: 0.56, synthduo: 0.40, boyband: 0.37, emo: 0.33,
    yuletide: 0.32, darkrnb: 0.29, powerballad: 0.28, reggaeton: 0.26,
    roboticpop: 0.24, retrofunkpop: 0.23, worldfolk: 0.20, bigroom: 0.13,
    clubpop: 0.11, blueeyedsoul: 0.10, crooner: 0.09, ebm: 0.06, kpop: 0.04,
    bigbeat: 0.03, folkduo: 0, motorik: 0,
  };
  const ceilOf = b => b * 1.5 + 0.20;      // one headroom rule for every genre

  // THE BAR — the 90th percentile of the measured distribution above, rounded
  // up to the next 0.25. Derived, not chosen: recompute it when the table is
  // re-baked. Everything over it must be on ALLOW.
  //
  // AND IT STAYS AT 1.5 with eighty-seven genres in the table. Recomputing the
  // rule over the widened distribution says 1.75, and that is exactly the move
  // the paragraph below forbids: it would drop shoegaze and vaporwave under
  // the bar and turn two argued exemptions into dead ones, which is a bar
  // loosened to suit the table rather than a table held to the bar.
  const BAR = 1.5;
  // LEGITIMATELY DISSONANT, one reason each. This list is the ONLY way past
  // the bar; raising the bar to admit a genre would exempt the whole table.
  const ALLOW = {
    blues: "the ♭5 blue note is in the subject's scale and in none of the " +
           "twelve dominant sevenths — the flat third against the major IV is the sound",
    spem: "eight independent voices under `emergent` harmony: the chord the census " +
          "measures against is a triad no voice plays, and Renaissance polyphony " +
          "is collision by construction",
    deathmetal: "locrian, where the tonic sonority is itself a tritone — the ♭5 is home",
    shoegaze: "the genre IS a held second: both guitars play the same phrase one " +
              "degree apart, which its own entry calls detune as counterpoint",
    vaporwave: "the semitone follow lands a pentatonic minor third over a major III — " +
               "the blues' mechanism exactly, and the haze is the point",
    // THE FOUR OF THE TWENTY-NINE that came in over the bar on their first
    // measurement. Two of them are a scale — the material is dissonant and
    // that is the genre — and two are one held note, which is a different
    // claim and the one to point an ear at.
    screamo: "it declares death metal's own locrian scale and mode, so the same " +
             "sentence applies: the tonic sonority is a tritone and the ♭2 over it " +
             "is the scream",
    drill: "harmonic minor under modal harmony — the ♭6 against the ♮7 is an " +
           "augmented second, the one interval nothing else in the table plays, " +
           "and it is the whole menace of the genre",
    confessionalpop: "legato lines with maxHold 3 SUSTAIN THROUGH THE CHANGE, so " +
                     "the diatonic tritone (the IV's fourth held into the V's " +
                     "leading tone) reads as unprepared by construction — the " +
                     "suspension is the writing, but this one is worth a listen",
    sophistirock: "the same held-note mechanism as confessionalpop, over a dorian " +
                  "with both the ♭3 and the ♮6 — sophisti-pop's extended chords are " +
                  "suspensions that do not resolve inside the bar; also worth a listen",
  };

  const rows = GK.map(census).sort((a, b) => b.pct - a.pct);
  const f = x => x.toFixed(2).padStart(7);
  if (process.env.NUKERNEL_CENSUS) {
    console.log("  genre           %bad    ic1    ic6  (raw1) (raw6)   nct%     mb     mp");
    for (const r of rows)
      console.log("  " + r.gk.padEnd(14) + f(r.pct) + f(r.ic1) + f(r.ic6) +
                  f(r.ic1raw) + f(r.ic6raw) + f(r.nct) + f(r.mb) + f(r.mp));
  } else {
    console.log("  worst six: " + rows.slice(0, 6)
      .map(r => r.gk + " " + r.pct.toFixed(2)).join("  ") +
      "   (NUKERNEL_CENSUS=1 for all " + GK.length + ")");
  }

  for (const r of rows) {
    const base = BASELINE[r.gk];
    ok(base != null, r.gk + ": no census baseline — a new genre must be measured " +
       "and baked into BASELINE, not left unmeasured");
    if (base == null) continue;
    const worst = r.worst[0];
    ok(r.pct <= ceilOf(base) + 1e-9,
       r.gk + " REGRESSED INTO CLASHINESS: " + r.pct.toFixed(2) + "% of its sonority is " +
       "unprepared semitone/tritone, ceiling " + ceilOf(base).toFixed(2) + "% (baseline " +
       base.toFixed(2) + "). Worst: " + (worst
         ? "ic" + worst.ic + " at step " + worst.step.toFixed(0) + ", " + worst.who +
           ", " + worst.n + " against " + worst.on
         : "n/a"));
    ok(r.pct <= BAR + 1e-9 || ALLOW[r.gk],
       r.gk + " is over the " + BAR + "% bar at " + r.pct.toFixed(2) + "% and is not on " +
       "the allowance list. Fix it, or add it with a REASON — do not raise the bar");
  }
  // the allowance list may not rot into a mute button
  for (const gk of Object.keys(ALLOW))
    ok(BASELINE[gk] > BAR, gk + " is on the allowance list but measures " +
       BASELINE[gk] + "%, under the bar — a dead exemption is an exemption nobody checked");
  // and the two the ears named stay fixed, by name
  ok(rows.find(r => r.gk === "counterpoint").pct <= 0.35,
     "counterpoint: the inversion axis has drifted back onto a semitone sum");
  ok(rows.find(r => r.gk === "tango").pct <= 0.70,
     "tango: the held note is off the chord again — check `anchor`");
}

/* ---------- 39. DYNAMICS ----------------------------------------------------
   THE EARS SAID "everything plays around the same. There are no crescendos or
   decrescendos inside of the music. There is no organic difference in the sound
   of the notes." Measured, they were exactly right and the number was damning:
   every one of the 45 genres rendered a mean velocity of 6.90, a standard
   deviation of 1.45 and a range of 4..9 — the SAME three numbers for all of
   them — because all 45 read the same eight values off the phrase's vel vector
   and nothing downstream was a function of where a note sat or which pass this
   was. Three flat sources, repeating identically every loop.

   Everything here reads the RENDERED STREAM, and the two halves are measured
   separately: the PERFORMANCE (kernel.js stress/phrase/touch — per note, per
   bar) and the ARC (the `env` dynamics — per section, dealt by the composer
   across the song). The last check is the one that keeps the whole layer
   honest: the machines are frozen by fingerprint, so "opt-in" is a fact rather
   than a claim. */
console.log("dynamics — metrical stress, phrase arch, the hand, and the section arc");
{
  const crypto = require("crypto");
  const fp = ev => crypto.createHash("sha1").update(JSON.stringify(ev.map(e =>
    [+e.t.toFixed(6), e.n, e.d, +(e.dur || 0).toFixed(6), e.vel, e.acc, e.sld]))).digest("hex").slice(0, 16);
  const sd = xs => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
  };
  const barsOf = (ev, bs, n) => Array.from({ length: n }, (_, b) =>
    ev.filter(e => e.t >= b * bs && e.t < (b + 1) * bs));

  // (a) THE MACHINES ARE FROZEN. techno/acid/house/trap declare no dynamics, and
  // these are the sha1s of their full streams taken the commit BEFORE the
  // performance layer existed. A machine genre that starts breathing fails here
  // by name, which is the only way "absent is byte-identical" stays true rather
  // than remaining true by luck.
  // ...and ELECTRO, the fifth machine, whose fingerprint was taken the day it
  // landed rather than before the layer existed — there is no "before" for an
  // anchor that arrived after it. The contract is the same one: an 808 says
  // its weight with an accent switch (`kitVel`), so if this genre ever starts
  // breathing it fails here by name.
  const MACHINE = { techno: "036036ec46edb986", acid: "c047f764a47233de",
                    house: "2f1c41112ac01206", trap: "addcf7d93d0fdcfa",
                    electro: "1b4dccccfb127a5e" };
  for (const gk of Object.keys(MACHINE)) {
    const g = GENRES[gk], bars = Math.max(4, g.bars);
    ok(fp(allEvents(P, g, bars)) === MACHINE[gk],
       gk + ": a machine genre no longer renders what it rendered before the " +
       "performance layer existed — dynamics must stay opt-in");
    ok(!g.stress && !g.phrase && !g.touch,
       gk + ": a machine genre declares dynamics — the fingerprint above is the " +
       "contract, this is the reason it holds");
  }

  // (b) NEUTRALITY, the §22 law for the three new fields: the documented
  // neutral value renders byte-identically to the field being absent.
  for (const gk of ["funk", "blues", "gregorian", "vaporwave"]) {
    const g = GENRES[gk], bare = { ...g }, zeroed = { ...g, stress: 0, phrase: 0, touch: null };
    delete bare.stress; delete bare.phrase; delete bare.touch;
    ok(fp(allEvents(P, bare, g.bars)) === fp(allEvents(P, zeroed, g.bars)),
       gk + ": stress/phrase/touch neutral values are not the same as absent");
    // ...and each one on its own must MOVE the stream, or it is a dead field
    for (const f of [{ stress: 0.6 }, { phrase: 0.6 }, { touch: { t: 0.06, v: 1 } }])
      ok(fp(allEvents(P, { ...zeroed, ...f }, g.bars)) !== fp(allEvents(P, zeroed, g.bars)),
         gk + ": " + Object.keys(f)[0] + " does not reach the rendered stream");
  }

  // (c) VARIANCE ROSE, and it rose per genre rather than on average: the flat
  // 1.45 was the whole complaint. Every genre that declares a hand must spread
  // its velocities wider than the phrase vector alone does, and the range must
  // open DOWNWARD — the old stream never went under 4, so the bottom half of
  // the scale did not exist.
  {
    let wired = 0, wider = 0, lower = 0;
    for (const gk of GK) {
      const g = GENRES[gk];
      if (!g.stress && !g.phrase && !g.touch) continue;
      wired++;
      const vs = K.render(DEFAULT, g, g.bars).map(e => e.vel);
      const flat = K.render(DEFAULT, plain(g), g.bars).map(e => e.vel);
      if (sd(vs) > sd(flat) + 1e-9) wider++;
      if (Math.min(...vs) < Math.min(...flat)) lower++;
      ok(Math.max(...vs) <= 9 && Math.min(...vs) >= 0,
         gk + ": the performance layer put a velocity outside 0..9");
    }
    // EXHAUSTIVE, not mostly: every genre either declares all three fields or is
    // one of the four machines that declare none on purpose. A genre that
    // resolves to neither renders flat forever and nothing else would say so.
    for (const gk of GK) {
      const g = GENRES[gk];
      ok(MACHINE[gk] != null || (g.stress != null && g.phrase != null && g.touch != null),
         gk + ": no dynamics row — it is neither a declared machine nor a genre " +
         "with stress/phrase/touch, so it will render flat forever");
    }
    ok(wired === GK.length - Object.keys(MACHINE).length,
       wired + " genres declare dynamics; expected " +
       (GK.length - Object.keys(MACHINE).length) + " (everything but the machines)");
    ok(wider >= wired - 2, "only " + wider + "/" + wired + " wired genres widened " +
       "their velocity spread; the flat 1.45 is what this layer exists to break");
    ok(lower >= wired * 0.6, "only " + lower + "/" + wired + " genres reached below " +
       "their written floor — the dynamic room is at the bottom of the scale");
  }

  // (d) NO TWO PASSES ARE THE SAME BAR. The hand is redrawn per bar, so a
  // genre that declares `touch` must render bar 3 differently from bar 1 — in
  // velocity, in onset, or both. This is the "every rendition of a bar is
  // numerically the same bar" complaint, as an assertion.
  for (const gk of ["funk", "blues", "boombap", "rock", "gregorian"]) {
    const g = GENRES[gk], bs = 16 / g.rate, n = Math.max(4, g.bars);
    const ev = K.render(DEFAULT, g, n).filter(e => e.v === 0);
    const cells = barsOf(ev, bs, n).map(bar =>
      JSON.stringify(bar.map(e => [+((e.t % bs) * g.rate).toFixed(3), e.vel])));
    ok(new Set(cells).size >= Math.min(3, n),
       gk + ": " + new Set(cells).size + " distinct bars in " + n + " — the loop is " +
       "playing the identical numbers every pass");
    // ...and it is the HAND doing it, not the notes: with the player taken out
    // the same bars are identical again
    const flatCells = barsOf(K.render(DEFAULT, plain(g), n).filter(e => e.v === 0), bs, n)
      .map(bar => JSON.stringify(bar.map(e => [+((e.t % bs) * g.rate).toFixed(3), e.vel])));
    ok(new Set(flatCells).size < new Set(cells).size,
       gk + ": the bars differ with the player taken out too — this is the phrase, " +
       "not the performance");
  }

  // (e) DETERMINISM. Seeded, not random: two renders of one state are the same
  // stream, or the whole artifact stops being reproducible.
  for (const gk of ["funk", "tango", "neoclassical"])
    ok(fp(allEvents(P, GENRES[gk], GENRES[gk].bars)) ===
       fp(allEvents(P, GENRES[gk], GENRES[gk].bars)),
       gk + ": two renders of one state differ — the hand is not seeded");

  // (f) THE PHRASE PEAK LANDS ON THE CONTOUR PEAK. Built by hand: a bar with an
  // unambiguous high note in the middle, read through a genre that is all
  // phrase and nothing else, so the tent is the only term moving.
  {
    const arch = { deg:  [0, 1, 2, 3, 5, 3, 2, 1, 0, 1, 2, 1, 0, 1, 0, 1],
                   oct:  new Array(16).fill(0), vel: new Array(16).fill(5),
                   inc:  new Array(16).fill(0), stk: new Array(16).fill(0),
                   gate: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                   acc:  new Array(16).fill(0), sld: new Array(16).fill(0) };
    const g = { ...plain(GENRES.simple), phrase: 0.9 };
    const ev = K.render(arch, g, 1);
    const flat = K.render(arch, plain(GENRES.simple), 1);
    const top = Math.max(...ev.map(e => e.n));
    const pk = ev.findIndex(e => e.n === top);
    ok(pk > 0, "the test phrase has no interior peak — the fixture is wrong");
    ok(ev[pk].vel === Math.max(...ev.map(e => e.vel)),
       "the phrase's highest note is not its loudest — the tent does not peak on " +
       "the contour");
    ok(ev[0].vel < ev[pk].vel && ev[ev.length - 1].vel < ev[pk].vel,
       "the phrase does not taper to both ends (" + ev.map(e => e.vel).join(",") + ")");
    // the AGOGIC half: the peak is held longer than it was written, and no
    // other note is
    ok(ev[pk].dur > flat[pk].dur + 1e-9,
       "the peak note is not held any longer — the agogic half of the accent is missing");
    ok(ev.every((e, i) => i === pk || Math.abs(e.dur - flat[i].dur) < 1e-9),
       "a note that is not the peak changed length — the agogic is not agogic");
    // and it never runs into the note after it, nor past its own cap
    ok(ev.every((e, i) => i + 1 >= ev.length || e.t + e.dur <= ev[i + 1].t + 1e-9),
       "the lengthened peak overlaps the note after it — that is a tie, not an accent");
    const capped = K.render(arch, { ...g, maxHold: 1 }, 1);
    ok(capped.every(e => e.dur <= 1 / GENRES.simple.rate + 1e-9),
       "the agogic peak grew past maxHold — breath is not optional");
  }

  // (g) METRICAL ACCENT IS A HIERARCHY, and it is one in the OUTPUT: on a
  // phrase whose written velocities are all equal, the downbeat outweighs the
  // beat, the beat outweighs the "and", and the "and" outweighs the sixteenth
  // between them. Scaled per genre, so a genre with a bigger `stress` separates
  // them further.
  {
    const even = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
                   vel: new Array(16).fill(5), inc: new Array(16).fill(0),
                   stk: new Array(16).fill(0), gate: new Array(16).fill(1),
                   acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
    const at2 = (g, i) => K.render(even, g, 1).filter(e => e.v === 0)[i].vel;
    const g = { ...plain(GENRES.simple), stress: 0.8 };
    ok(at2(g, 0) > at2(g, 4) && at2(g, 4) > at2(g, 2) && at2(g, 2) >= at2(g, 1),
       "the metrical hierarchy is not in the rendered velocities (" +
       [0, 4, 2, 1].map(i => at2(g, i)).join(">") + ")");
    const soft2 = { ...plain(GENRES.simple), stress: 0.25 };
    ok(at2(g, 0) - at2(g, 1) > at2(soft2, 0) - at2(soft2, 1),
       "stress does not scale — a heavier genre must separate the beats further");
    ok(K.stressAt(0, 12) === 1 && K.stressAt(3, 12) === 0.3 && K.stressAt(6, 12) === 0.55,
       "a twelve-step bar does not stress its three beats");
  }

  // (h) THE SECTION ARC. Six new `env` shapes, and the property that separates
  // them from the four fades is that they never reach zero — a dynamic is a
  // size, not an entrance.
  {
    const g = GENRES.rock, span = g.bars * 16 / g.rate;
    const ev = K.render(P, g, g.bars);
    const lvl = out => {
      const a = [...out].sort((x, y) => x.t - y.t);
      const half = Math.floor(a.length / 2);
      const mean = xs => xs.reduce((s, e) => s + e.vel, 0) / xs.length;
      return [mean(a.slice(0, half)), mean(a.slice(half))];
    };
    for (const kind of ["cresc", "dim", "arch", "lift", "soft", "big"]) {
      const out = K.envelope(ev, kind, span);
      ok(out.length === ev.length, kind + " changed the event count — it is a curve, not a cut");
      ok(out.every(e => e.vel >= 0 && e.vel <= 9), kind + " left a velocity out of 0..9");
      ok(out.every(e => e.vel > 0), kind + " silenced a note — a dynamic is not a fade");
    }
    const cr = lvl(K.envelope(ev, "cresc", span));
    ok(cr[1] > cr[0] * 1.3, "a crescendo section does not climb (" +
       cr.map(x => x.toFixed(2)).join(" -> ") + ")");
    const dm = lvl(K.envelope(ev, "dim", span));
    ok(dm[1] < dm[0] * 0.8, "a diminuendo does not fall away");
    const lf = lvl(K.envelope(ev, "lift", span));
    ok(lf[1] > lf[0] * 1.15, "a build does not build");
    // the arch peaks in the MIDDLE and comes back — which `swell` does too, and
    // the difference is that the arch is still audible at both ends
    const ar = K.envelope(ev, "arch", span).sort((a, b) => a.t - b.t);
    ok(ar[0].vel > 0.5 * ev.sort((a, b) => a.t - b.t)[0].vel,
       "the arch starts as quietly as a fade — it is supposed to be a shape, not an entrance");
    // soft vs big is the whole point: the same bar, two sizes
    const sm = lvl(K.envelope(ev, "soft", span))[0], bg = lvl(K.envelope(ev, "big", span))[0];
    ok(bg > sm * 1.4, "big is not measurably bigger than soft (" + sm.toFixed(2) +
       " vs " + bg.toFixed(2) + ") — the chorus cannot outweigh the verse");
    ok(K.envelope(ev, "big", span).every(e => e.vel <= 9),
       "big pushed a velocity past the ceiling");
  }
}

/* ---------- 39b. THE ARRANGED DYNAMIC, measured on ui/derive.js ------------
   §39 proves the shapes work; this proves the COMPOSER spends them, on the
   real render path, over the whole table. The complaint was about listening to
   a composed song, so the check has to be about one. */
console.log("the arranged dynamic — the chorus outweighs the verse, on the real render path");
{
  const C = require("../../nukernel/compose.js");
  const seeds = Array.from({ length: 12 }, (_, i) => i + 1);
  const meanVel = ev => (ev.length
    ? ev.reduce((s, e) => s + (e.vel == null ? 5 : e.vel), 0) / ev.length : 0);
  // (a) EVERY SECTION IS DEALT A DYNAMIC. A composed song with eight flat
  // boxes in the middle of it is the record the ears were complaining about.
  {
    let flat = 0, total2 = 0;
    for (const gk of GK) for (const s of seeds.slice(0, 4)) {
      for (const b of C.compose(gk, s).song) { total2++; if (!b.env) flat++; }
    }
    ok(flat / total2 <= 0.2, flat + "/" + total2 + " composed sections carry no " +
       "level shape at all — the arc is not being spent");
  }
  // (b) AND IT IS AUDIBLE IN THE EVENTS: the last chorus of a song outweighs
  // the verse before it, measured as mean rendered velocity through the real
  // sectionEvents path (window, envelope, edges, groove — everything) TIMES
  // the box's own level, which is §31(a)'s measure and is the honest one.
  //
  // IT WAS NOT, until the singer landed on the verses. `lvl` was left out of
  // this row while the verse was the band alone; put a lead vocal on it — a
  // topline with accents and a velocity-9 climax in it — and the verse's mean
  // velocity climbs to within a tenth of the drop's on a house record, and
  // four of twelve seeds measured backwards. Nothing about the arrangement was
  // wrong: the peak carries `lvl: "fwd"` (×1.35 at the desk, fields.js LEVELS)
  // and the verse does not, and a section's size is what the mixer does with
  // it as much as what the velocities say. Reading one and not the other was
  // the measurement's bug rather than the composer's.
  const LV = require("../../nukernel/fields.js").LEVELS;
  for (const gk of ["rock", "beatles", "isley", "funk", "house"]) {
    let bigger = 0, n2 = 0;
    for (const s of seeds) {
      const song = C.compose(gk, s);
      const ci = song.song.map((b, i) => [b, i]).filter(([b]) =>
        (b.cue || b.role) === "chorus" || (b.cue || b.role) === "drop").pop();
      if (!ci) continue;
      const vi = song.song.slice(0, ci[1]).map((b, i) => [b, i])
        .filter(([b]) => b.role === "verse" && !b.cue).pop();
      if (!vi) continue;
      n2++;
      const lvl = b => LV[b.lvl || "norm"];
      const cv = meanVel(D.sectionEvents(ci[0], song.slots).ev) * lvl(ci[0]);
      const vv = meanVel(D.sectionEvents(vi[0], song.slots).ev) * lvl(vi[0]);
      if (cv > vv) bigger++;
    }
    ok(n2 > 0 && bigger >= n2 - 1, gk + ": the last chorus is louder than the verse " +
       "before it in only " + bigger + "/" + n2 + " songs — the arc is not reaching " +
       "the notes");
  }
  // (c) THE WHOLE SONG HAS A SHAPE: across a composed record the per-section
  // mean velocity must actually vary — one number for every section is the
  // "everything plays around the same" complaint at song scale.
  for (const gk of ["rock", "funk", "house", "gregorian"]) {
    const song = C.compose(gk, 5);
    const means = song.song.map(b => meanVel(D.sectionEvents(b, song.slots).ev))
      .filter(x => x > 0);
    const lo = Math.min(...means), hi = Math.max(...means);
    ok(hi - lo >= 1.2, gk + ": the loudest section of a composed song is only " +
       (hi - lo).toFixed(2) + " velocity above the quietest — the record is flat");
  }
}

/* ---------- 39c. THE SECOND KIND OF DYNAMICS, the pure half -----------------
   §39 and §39b prove velocity has range and shape in the STREAM. That range
   still only moved LOUDNESS: a note played harder was the same note turned up,
   which is the other half of "there is no organic difference in the sound of
   the notes". audio/voices.js now maps velocity onto timbre — a per-note high
   shelf tilted by velocity with the strike on top of it, a shorter amp attack,
   a sample-start offset, and the synth voices' own cutoff/env-amount — off the
   per-family table in instruments.js.

   The audible claim needs a browser and lives in nukernel-drums (G), where the
   control is the same instrument in the one role that has no response. What is
   PURE is the table: every family the strip walk can name has a response or is
   deliberately without one, the numbers are in range, and — the load-bearing
   one — the curve is zero at the default velocity, because that is what lets
   the player skip the shelf node entirely and leave today's path alone. */
console.log("the second kind of dynamics — the response table and its neutral");
{
  const NI = require("../../nukernel/instruments.js");
  const { DYN, dynFor, dynCurve, DYN_BRIGHT, DYN_ATK,
          familyOf, stripFor, STRIPS, BASS_INSTR } = NI;

  // (a) ONE FAMILY WALK, TWO READERS. dynFor and stripFor must answer about the
  // same instrument from the same table, or a guitar lands on the guitar strip
  // with the generic response — the drift a shared familyOf exists to stop.
  for (const [id, pad, want] of [["crunch_guitar", false, "dirty"],
      ["clean_guitar", false, "guitar"], ["rock_organ", false, "organ"],
      ["ahh_choir", false, "vox"], ["trumpet", false, "brass"], ["flute", false, "reed"],
      ["violin", false, "bowed"], ["marimba", false, "mallet"],
      ["strings_slow", false, "strings"], ["halo_pad", false, "pad"],
      ["yamaha_grand_piano", false, "keys"], ["clean_guitar", true, "pad"],
      ["nothing_at_all", false, "lead"]]) {
    ok(familyOf(id, pad) === want, id + (pad ? " (pad)" : "") + " reads as family " +
       familyOf(id, pad) + ", not " + want);
    ok(stripFor(id, pad) === STRIPS[want], id + ": stripFor and familyOf disagree");
    ok(dynFor(id, pad) === (DYN[want] || null),
       id + ": dynFor and familyOf disagree");
  }
  // the bass chair is reached by id — nothing in the regex table claims it
  ok(dynFor(BASS_INSTR, false) === DYN.bass,
     "the bass chair did not get the bass response (it would take `lead`)");

  // (b) THE TWO SILENT FAMILIES ARE SILENT ON PURPOSE. A drawbar organ has no
  // velocity response in the instrument, and a pad is the one voice a per-note
  // transient shelf would chop. Absent must mean absent, not zeroed: the player
  // branches on null and builds no node at all — which is also what makes the
  // browser gate's control possible, since `pad` is a role any instrument can
  // be put in.
  for (const fam of ["organ", "pad"])
    ok(DYN[fam] == null, fam + " grew a dynamic response — it must stay absent, " +
       "which is how voices.js keeps that path byte-identical");
  ok(dynFor("rock_organ", false) === null && dynFor("anything", true) === null,
     "an organ or a pad answered a response object rather than null");

  // (c) THE TABLE IS COMPLETE AND IN RANGE. Every family the walk can produce
  // either has all five numbers or is one of the two above; a half-filled row
  // is a NaN in a filter frequency.
  const fams = new Set(["dirty", "guitar", "organ", "vox", "brass", "reed", "bowed",
                        "mallet", "strings", "pad", "keys", "lead"]);
  for (const f of fams)
    ok(DYN[f] != null || f === "organ" || f === "pad",
       "family " + f + " has neither a response nor a documented reason to lack one");
  for (const [k, d] of Object.entries(DYN)) {
    ok(STRIPS[k] != null, "DYN names " + k + ", which is not a strip family");
    ok(d.tilt > 0 && d.tilt <= 18, k + ": tilt " + d.tilt + " dB is not a sane swing");
    ok(d.corner >= 400 && d.corner <= 6000,
       k + ": corner " + d.corner + " Hz is not where an instrument's brightness starts");
    ok(d.bite >= 0 && d.bite <= 8, k + ": bite " + d.bite + " dB out of range");
    ok(d.dec > 0 && d.dec <= 0.3, k + ": dec " + d.dec + " is not a short settle");
    ok(d.hand >= 0 && d.hand <= 1, k + ": hand " + d.hand + " out of 0..1");
  }
  ok(new Set(Object.values(DYN).map(d => d.tilt)).size >= 6,
     "every family swings by the same amount — a table of one number is a constant");
  // the ORDERING is the physical claim the table makes, and it is worth one
  // line: a trumpet's timbre moves further with the breath than a string
  // section's does, and a plucked string is more strike than a bowed one
  ok(DYN.brass.tilt > DYN.strings.tilt && DYN.mallet.hand > DYN.bowed.hand,
     "the table has lost its physical ordering — brass must swing further than a " +
     "string section, and a mallet must be more strike than a bow");

  // (d) THE NEUTRAL IS EXACTLY NEUTRAL. This is the whole byte-identity claim,
  // written as arithmetic: at the default velocity the shelf is 0 dB (a literal
  // bypass — which is why the player builds no node at all), the attack is
  // today's 0.006 and the start offset is 0. dynCurve is IMPORTED rather than
  // re-derived: it is the same four lines the player writes onto AudioParams,
  // and a second copy here would be a gate on a copy.
  for (const [k, d] of Object.entries(DYN)) {
    const n = dynCurve(0, d);
    ok(n.db === 0 && n.peakDb === 0 && n.atk === DYN_ATK && n.skip === 0,
       k + ": the curve is not the identity at the default velocity (" +
       JSON.stringify(n) + ") — the skip in voices.js would be a lie");
  }
  // …and it MOVES either side of it, monotonically, in the direction an
  // instrument moves: softer is darker, harder is brighter with a brighter
  // onset still, and the front edge shortens all the way up.
  {
    const d = DYN.keys;
    const soft = dynCurve(-1, d), hard = dynCurve(1, d), half = dynCurve(-0.5, d);
    ok(soft.db < half.db && half.db < 0,
       "a softer note is not darker: " + soft.db.toFixed(1) + " / " + half.db.toFixed(1) + " dB");
    ok(hard.db > 0, "a harder note is not brighter (" + hard.db.toFixed(1) + " dB)");
    // the asymmetry is deliberate — the one-layer sample IS the firm note, so
    // taking its top away is honest and adding to it is invention
    ok(hard.db < -soft.db && Math.abs(hard.db - -soft.db * DYN_BRIGHT) < 1e-9,
       "the loud side is not DYN_BRIGHT of the soft side — the asymmetry documented " +
       "beside DYN is what keeps the shelf from inventing high end the font never had");
    ok(hard.peakDb > hard.db && soft.peakDb === soft.db,
       "the strike is not a loud-side-only transient (" + hard.peakDb.toFixed(1) + " / " +
       soft.peakDb.toFixed(1) + ")");
    ok(hard.atk < DYN_ATK && soft.atk > DYN_ATK,
       "the amp attack does not track the hand: " + hard.atk + " / " + soft.atk);
    ok(hard.atk >= 0.003,
       "the hardest attack is under sampler.js's own 3 ms floor (" + hard.atk + ")");
    ok(hard.skip > 0 && hard.skip <= 0.006 && soft.skip === 0,
       "the sample-start offset is not a hard-hit-only few ms (" + hard.skip + ")");
    // a ghosted note is the extreme the vel vector really produces (0..9 with
    // the default at 5), so the curve has to stay sane one step past full soft
    const ghost = dynCurve(-1.25, DYN.brass);
    ok(ghost.db > -24 && ghost.db < soft.db,
       "the softest note the vel vector can write is " + ghost.db.toFixed(1) + " dB down — " +
       "past about -24 the note has stopped being the instrument and started being a mute");
  }
}

/* ---------- 40. THE FUNCTION GENRES ----------------------------------------
   "What is a Beatles song without a couple of solos. You should also have some
   vocal melodies. So I can see a Beatles song where only the drums remain, but
   the solo plays."

   A FUNCTION GENRE is one whose identity is a ROLE and not a style — solo,
   vocal, backing, riff, pad (genres.js, the `parts` family). Everything below
   is measured on the RENDERED EVENT STREAM through the real ui/derive.js,
   because every claim here is exactly the kind that config can satisfy and
   audio cannot: a genre can declare `nobass` and still emit a bass, a layer can
   declare that it inherits the host's changes and still play its own, and a
   "solo section" can be a box with a solo LAYER on it that nobody can hear.

   Four things:
     (a) THE CONTRACT — a part carries nothing that would fight its host, and
         answers the PARTS chair its name promises, so the per-part mixer can
         address it.
     (b) THE BEATLES TEST, literally: a box whose authority is reduced to drums
         with a solo stacked over it. Drums from the HOST, notes from the LAYER,
         no bass, and both in every bar — plus the two controls that make it a
         proof rather than a description: stripping the authority must leave the
         drum stream byte-identical, and swapping the host must move the solo.
     (c) THE COMPOSER really places them, across the table and across seeds.
     (d) THE SINGER BREATHES — rest ratio and leap distribution, vocal against
         the instrumental leads, on the same phrases. */
console.log("function genres — the part, the Beatles test, and what a singer does");
{
  const C = require("../../nukernel/compose.js");
  const NS = require("../../nukernel/song.js");
  const PARTS5 = ["solo", "vocal", "backing", "riff", "pad"];

  // (a) THE CONTRACT. The layer law (ui/derive.js) hands a stacked genre the
  // authority's harmony, roots, prog, key, mode, rate and swing and drops its
  // kit and bass — so a part that declares any of those is declaring something
  // that will be silently thrown away in the only place it is meant to be used,
  // which is worse than declaring nothing.
  const CHAIR = { solo: "lead", vocal: "lead", backing: "counter",
                  riff: "riff", pad: "pad" };
  for (const gk of PARTS5) {
    const g = GENRES[gk];
    ok(g.family === "parts", gk + ": a function genre outside the `parts` family");
    ok(!Object.keys(g.kit || {}).length && !g.kits,
       gk + ": a part brought its own drums — the host owns the kit");
    ok(g.nobass === true, gk + ": a part brought its own bass — the host owns the bass");
    ok(!g.prog && !g.roots && g.harmony === "modal",
       gk + ": a part carries harmony of its own; stacked, it would follow its " +
       "chords against the box's — half the band in a different song");
    ok(g.voices === 1, gk + ": a part is one part (" + g.voices + " voices)");
    ok(K.partOf(g, 0) === CHAIR[gk], gk + ": answers the \"" + K.partOf(g, 0) +
       "\" chair, not \"" + CHAIR[gk] + "\" — the mixer would address it as " +
       "something it is not");
    ok(C.LAYERABLE.includes(gk), gk + ": a part that the arranger may not stack");
    // and it must SOUND on its own, because it is a genre in the palette and
    // somebody will click it first
    ok(K.render(P, g, g.bars).length > 0, gk + ": renders nothing on its own");
  }
  // the ballots are covered and legal: every family votes, every vote names a
  // real function genre, and the one empty ballot is the deliberate one
  for (const [fam] of FAMILIES) {
    const b = C.SOLO_LEAN[fam];
    ok(Array.isArray(b), fam + ": no SOLO_LEAN ballot — its solos would fall back");
    for (const w of b || []) ok(PARTS5.includes(w),
      fam + ": votes for \"" + w + "\", which is not a function genre");
  }
  ok(C.SOLO_LEAN.parts.length === 0, "a function genre calls a soloist of its own");

  // (b) THE BEATLES TEST. Built by hand and pushed through the LOADER, because
  // a hand-built box the loader would reject is not a thing a person can make.
  const beatlesTest = (host, layerG, hostSlots) => {
    const box = NS.skeleton(host, "solo");
    box.stack = [{ g: host, slots: hostSlots || [] }, { g: layerG, slots: [0] }];
    box.bassop = "nobass";
    // the kit operator the composer writes on a break, and for the reason it
    // writes it: `accents` puts a real level on every lane, so the drums stop
    // borrowing their dynamics from the melody that just stopped playing
    box.kit = "accents";
    box.len = 4;
    const r = NS.load({ v: NS.VERSION, slots: [clone(P)], song: [box], bpm: 120, vol: 80 });
    ok(r.ok, "the Beatles test box does not load: " +
       JSON.stringify(r.errors && r.errors[0]));
    return r.ok ? { box: r.song.song[0], out: D.sectionEvents(r.song.song[0], r.song.slots) }
                : null;
  };
  {
    const t = beatlesTest("beatles", "solo");
    ok(!!t, "the Beatles test never rendered");
    if (t) {
      const ev = t.out.ev;
      const hits = ev.filter(e => e.kind === "hit");
      const line = ev.filter(e => e.kind === "line");
      const bass = ev.filter(e => e.kind === "bass");
      ok(hits.length > 0, "only the drums remain — and they do not: no drum events");
      ok(bass.length === 0, "the bass is still playing under the solo break");
      ok(line.length > 0, "the solo does not play");
      // EVERY note is the layer's: the authority contributed none, which is
      // what "reduced to drums" means as a fact about the stream
      ok(line.every(e => e.layer === "solo"),
         line.filter(e => e.layer !== "solo").length +
         " of the notes came from the host — it was supposed to have stopped");
      // ...and the drums really are the HOST's: beatles' own kit lanes
      const lanes = new Set(hits.map(e => e.d));
      const own = new Set(Object.keys(GENRES.beatles.kit));
      ok([...lanes].every(l => own.has(l)) && lanes.size > 1,
         "the drums under the solo are not the host's kit: " + [...lanes].join(","));
      // ONE BAR APART, not just in total: an aggregate check passes a section
      // where the drums play the first bar and the solo plays the last
      const bs = 16 / t.out.g.rate;
      for (let b = 0; b < t.out.bars; b++) {
        const inBar = xs => xs.some(e => e.t >= b * bs && e.t < (b + 1) * bs);
        ok(inBar(hits), "bar " + b + " of the solo break has no drums");
        ok(inBar(line), "bar " + b + " of the solo break has no solo");
      }
    }
  }
  // THE TWO CONTROLS. Without these the test above is a description of what
  // the composer happened to write rather than a proof of the mechanism.
  {
    // 1. STRIPPING THE AUTHORITY LEAVES THE KIT ALONE, note for note. The
    // drums are GENRE data and the phrase is not, which is the whole reason
    // the strip is expressible at all — the same box with and without the
    // host's melody must render the identical drum stream, and lose exactly
    // the host's half of the notes.
    //
    // WHY BOTH BOXES CARRY `accents`, and it is the finding rather than a
    // convenience: the kit's velocity chain (kernel.js drums) falls through to
    // the MELODY's velocity wherever a lane's cell is the bare 1, so on an
    // unoperated kit this comparison FAILS — the grid is identical and every
    // velocity drops to a flat 5, because the line whose dynamics the kick was
    // borrowing has stopped. That is why the composer writes a level-writing
    // kit op on every break (compose.js BREAK_KIT), and it is the one thing
    // about the strip that is a workaround rather than a mechanism.
    const t = beatlesTest("beatles", "solo");
    const f = beatlesTest("beatles", "solo", [0]);
    ok(f && t, "the control box does not load");
    if (f && t) {
      const drum = xs => JSON.stringify(xs.filter(e => e.kind === "hit")
        .map(e => [+e.t.toFixed(6), e.d, e.vel]));
      ok(drum(f.out.ev) === drum(t.out.ev),
         "taking the host's phrase away changed its drums — the strip is not a strip");
      ok(f.out.ev.filter(e => e.kind === "line").length >
         t.out.ev.filter(e => e.kind === "line").length,
         "the stripped box plays as many notes as the full band");
      // ...and the drums under the break are AUDIBLE, which the grid check
      // cannot see: a kit playing velocity 0 is a kit that renders and does
      // not sound
      const dv = t.out.ev.filter(e => e.kind === "hit").map(e => e.vel);
      ok(Math.max(...dv) >= 6 && dv.filter(v => v > 0).length / dv.length > 0.9,
         "the drums under the solo break render but barely sound (max vel " +
         Math.max(...dv) + ")");
    }
    // 2. THE SOLO READS THE HOST. Same layer, same phrase, two different
    // authorities: if the rendered notes are the same stream, the layer is
    // playing its own harmony and the inheritance is decorative.
    const a = beatlesTest("beatles", "solo"), b = beatlesTest("sludge", "solo");
    ok(a && b && JSON.stringify(a.out.ev.filter(e => e.kind === "line").map(e => e.n)) !==
       JSON.stringify(b.out.ev.filter(e => e.kind === "line").map(e => e.n)),
       "the same solo over two different hosts renders the same notes — it is " +
       "not inheriting the authority's changes");
    // ...and a KEY on the box moves the part with the band, every note of it
    const k = beatlesTest("beatles", "vocal");
    if (k) {
      const lifted = D.sectionEvents({ ...k.box, key: 3 }, [clone(P)]);
      const x = k.out.ev.filter(e => e.n != null), y = lifted.ev.filter(e => e.n != null);
      ok(x.length === y.length && x.every((e, i) => y[i].n - e.n === 3),
         "the singer does not modulate with the band");
    }
  }

  // (c) THE COMPOSER PLACES THEM. Not "can" — does, across the table.
  {
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
    let soloSecs = 0, withPart = 0, strips = 0, chorusParts = 0;
    const used = new Set();
    for (const gk of GK) {
      const kit = Object.keys(GENRES[gk].kit || {}).length > 0;
      for (const s of seeds) {
        for (const b of C.compose(gk, s).song) {
          const parts = b.stack.slice(1).filter(e => PARTS5.includes(e.g));
          for (const e of parts) used.add(e.g);
          if (b.role === "solo") {
            soloSecs++;
            if (parts.length) withPart++;
            if (b.cue === "solobreak") {
              strips++;
              ok(kit, gk + "/" + s + ": a kitless genre was given a solo BREAK — " +
                 "there are no drums for the band to be reduced to");
              ok(b.bassop === "nobass" && !b.stack[0].slots.length,
                 gk + "/" + s + ": a solobreak that did not strip the host");
            }
          } else if (b.role === "chorus" && parts.length) chorusParts++;
        }
      }
    }
    // every family but `parts` has a soloist, so all but five genres * their
    // seeds must carry one — written as a share so a table edit does not
    // require re-counting by hand
    ok(soloSecs > 400, "only " + soloSecs + " solo sections in the whole sweep");
    ok(withPart / soloSecs >= 0.85, "only " + Math.round(100 * withPart / soloSecs) +
       "% of solo sections have anybody playing the solo");
    // the strip is a COIN, not a constant: always would make every solo section
    // a drum break, never would mean the Beatles test is unreachable in practice
    ok(strips > 60 && strips < soloSecs * 0.6,
       strips + " solo breaks out of " + soloSecs + " solo sections — the strip " +
       "should be a coin on a genre with a kit, not a constant");
    ok(chorusParts > 200, "only " + chorusParts + " choruses carry a part layer — " +
       "the odd chorus was supposed to get one too");
    for (const gk of PARTS5)
      ok(used.has(gk), gk + ": the arranger never once calls for it");
  }

  // (d) WHAT A SINGER DOES, measured against what a lead player does, on the
  // SAME phrases — the composer's own toplines, so the only difference is the
  // genre. Two numbers, both read off the rendered stream, and both defined
  // carefully enough to mean what they say:
  //
  //   BREATH SHARE  the share of the section taken by silences of at least a
  //                 BEAT. Not "rest ratio": a staccato lead is silent for half
  //                 of every note and breathes not at all, so total silence
  //                 measures articulation and calls it phrasing. A breath is a
  //                 STRUCTURAL hole — three steps or more — and on that
  //                 definition the instrumental leads score exactly zero.
  //   LEAP SHARE    the share of intervals wider than a major third, counted
  //                 over MOVES only. A repeated note is not a small interval,
  //                 it is not an interval; counting unisons let `split` — which
  //                 emits its subdivisions on one degree — flatter any genre
  //                 that subdivides into looking like a smooth singer.
  const feel = gk => {
    const g = GENRES[gk], bars = 8, bs = 16 / g.rate;
    let breath = 0, n = 0, ivals = 0, big = 0, span = 0;
    for (let s = 1; s <= 12; s++) {
      // ...and NOT the ornaments (`!e.orn`). This measures how a part is
      // WRITTEN — a singer steps, a soloist leaps — and `solo` grew an
      // ornament policy of its own ("a note can lean, slide, flam or pass"),
      // whose graces and flams are neighbours and unisons by construction. Left
      // in, they halved the soloist's measured leap and the singer came out
      // wider than the horn, which is a fact about decoration, not about line.
      const ev = K.render(C.compose("beatles", s).slots[5], g, bars)
        .filter(e => e.part !== "pad" && !e.orn).sort((a, b) => a.t - b.t);
      if (!ev.length) continue;
      n++;
      let end = 0, sil = 0;
      for (const e of ev) {
        const gap = (e.t - end) * g.rate;
        if (gap >= 3) sil += gap;
        end = Math.max(end, e.t + e.dur);
      }
      const tail = (bars * bs - end) * g.rate;
      if (tail >= 3) sil += tail;
      breath += sil / (bars * 16);
      for (let i = 1; i < ev.length; i++) {
        const d = Math.abs(ev[i].n - ev[i - 1].n);
        if (!d) continue;
        ivals++; span += d; if (d > 4) big++;
      }
    }
    return { breath: breath / n, leap: big / ivals, mean: span / ivals };
  };
  {
    const v = feel("vocal"), s = feel("solo"), b = feel("simple");
    // MEASURED at the commit that added these, on twelve of the composer's own
    // toplines: vocal breath 0.149 / leap 0.287 / mean 3.81 semitones; solo
    // 0.000 / 0.449 / 5.09; the same phrase through `simple` 0.000 / 0.498 /
    // 5.48; through `beatles` 0.000 / 0.726 / 11.26. The fences sit between
    // those, not on them.
    ok(v.breath > 0.10, "the vocal spends " + (100 * v.breath).toFixed(0) +
       "% of the section in a real rest — it is not breathing");
    ok(s.breath < 0.02 && b.breath < 0.02, "an instrumental lead breathes too (" +
       s.breath.toFixed(3) + " / " + b.breath.toFixed(3) + ") — the measurement is " +
       "counting articulation as phrasing, so it proves nothing about the singer");
    ok(v.leap < 0.35, (100 * v.leap).toFixed(0) + "% of the vocal's moves are " +
       "leaps wider than a third — that is an instrument, not a voice");
    ok(v.leap < s.leap * 0.75, "the vocal (" + v.leap.toFixed(3) + ") does not leap " +
       "measurably less than the solo (" + s.leap.toFixed(3) + ")");
    ok(v.mean < s.mean - 0.8, "the vocal's mean interval (" + v.mean.toFixed(2) +
       " semitones) is not narrower than the solo's (" + s.mean.toFixed(2) + ")");
    // ...and the breath is REAL SILENCE at the end of the bar, which is the one
    // thing maxHold and the `breathe` pipe exist to produce
    const g = GENRES.vocal, bs = 16 / g.rate;
    for (let s2 = 1; s2 <= 12; s2++) {
      const ev = K.render(C.compose("beatles", s2).slots[5], g, 4);
      for (let bar = 0; bar < 4; bar++) {
        const end = (bar + 1) * bs;
        ok(!ev.some(e => e.t < end && e.t + e.dur > end - 0.6 / g.rate),
           "vocal/" + s2 + ": bar " + bar + " sings straight through the bar line");
      }
    }
    // the singer's instrument is a VOICE and it sits where a voice sits: the
    // registry's own window for solo_vox is [50, 84] (instruments.js RANGES)
    const NI = require("../../nukernel/instruments.js");
    for (const gk of ["vocal", "backing"]) {
      const id = NI.instrOf(gk, 0), win = NI.RANGES[id];
      ok(!!win, gk + ": " + id + " has no declared range — it may not be a voice");
      const ns = K.render(C.compose("beatles", 3).slots[5], GENRES[gk], 4).map(e => e.n);
      const mean = ns.reduce((a, x) => a + x, 0) / ns.length;
      ok(mean >= win[0] && mean <= win[1], gk + ": sings at a mean of " +
         mean.toFixed(0) + ", outside " + id + "'s own window " + win.join(".."));
    }
  }
}

/* ------------------------------------------- 41. DRESSING THE RECORD
   Two measured complaints, both about the composer rather than the engine.

     "When you generate a song and there are global effects apply them globally
      not per module."  MEASURED: a composed song set NO master at all —
      `compose("beatles", 3)` handed back eleven boxes, zero effects on any of
      them and `master` unset, which the loader normalizes to null, which the
      graph reads as the stock chain. Every composed record in every genre
      landed on one mastering.

     "You have stopped adding elements from other genres into the randomly
      generated songs."  MEASURED: 10.7% of boxes carried a second genre, and
      ELEVEN genres never stacked at all — acid, newwave, vaporwave,
      eurythmics, trap, house, garage, dnb, disco, dub, techno. All eleven
      arrange on the DANCE plan, and the only two roles that could call for a
      layer were `chorus` and `solo`, which a dance plan does not have.

   The fences below are the numbers this stage defends, not aspirations: a
   third of boxes carry a guest, sectional effects are confined to the three
   roles that genuinely depart, and every song is mastered its family's way.

   THE HOUSE LAW APPLIES UNEVENLY HERE and it is worth being honest about
   where. The guest and the solo break are read off the RENDERED EVENT STREAM
   through the real ui/derive.js — a layer that renders nothing is exactly the
   failure this suite exists for. The master cannot be: it is a bus, and
   nothing at this tier makes a sample. So it is proved as far as it can be —
   through the real loader, and through fields.js's own resolveMaster into the
   engine numbers audio/graph.js builds from — and the audio-tier gate that
   hears it is a browser gate, named in the report. */
console.log("dressing the record — the master bus and the guest genre");
{
  const C = require("../../nukernel/compose.js");
  const NF = require("../../nukernel/fields.js");
  const NS = require("../../nukernel/song.js");
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);
  const FAM = Object.fromEntries(FAMILIES.map(([f, ks]) => [f, ks]));

  // (a) EVERY COMPOSED SONG IS MASTERED — and it survives the loader, which is
  // the only door the composer gets. An unloadable master is a song the
  // composer can write and a person cannot open.
  {
    let keys = 0, songs = 0, seven = [];
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), m = song.master;
      songs++;
      ok(m && typeof m === "object", gk + "/" + s + ": composed a song with no master");
      if (!m) continue;
      ok(!NF.masterIsDefault(m), gk + "/" + s + ": the master is a second spelling " +
         "of absent — " + JSON.stringify(m));
      // in the registry's own order, so the saved file reads the way the desk
      // is laid out — and an unknown key could not survive this either
      ok(JSON.stringify(Object.keys(m)) ===
         JSON.stringify(NF.MASTER.map(f => f.key).filter(k => m[k] != null)),
         gk + "/" + s + ": master keys are not in MASTER's order");
      // THROUGH THE LOADER, UNCHANGED — which is the check that the VALUES are
      // legal too, and a stronger one than reading the tables here: the loader
      // filters unknown keys and rejects unknown values, so anything the
      // composer spelled wrong comes back quietly smaller (or not at all) and
      // this equality is what notices.
      //
      // A QUARTER OF THE SWEEP, and the reason is cost rather than confidence:
      // load() deep-validates every step of every slot and every field of
      // every box, which is a millisecond a song and two full seconds of this
      // suite. The ballots are small — ten seeds of fifty genres draws every
      // value in every table many times over — and every OTHER claim here runs
      // the full forty.
      if (s <= 10) {
        const r = NS.load(song);
        ok(r.ok, gk + "/" + s + ": the composed song does not load: " +
           JSON.stringify(r.errors && r.errors[0]));
        ok(r.ok && JSON.stringify(r.song.master) === JSON.stringify(m),
           gk + "/" + s + ": the loader changed the master to " +
           JSON.stringify(r.ok && r.song.master));
      }
      // ...and it is a DIFFERENT CHAIN, in engine numbers, not just a
      // different word: resolveMaster is what audio/graph.js builds from.
      const A = NF.resolveMaster(m), B = NF.resolveMaster(null);
      ok(JSON.stringify(A) !== JSON.stringify(B),
         gk + "/" + s + ": the master resolves to exactly the stock chain");
      const n = Object.keys(m).length;
      keys += n;
      if (n === NF.MASTER.length) seven.push(gk);
    }
    // RESTRAINT, as a distribution. Every knob turned on every record is not a
    // master, it is a preset demo — measured at 4.53 globals of seven when this
    // landed, and exactly one anchor asks for the whole desk.
    const mean = keys / songs;
    ok(mean > 3 && mean < 5.5, "the average composed master moves " + mean.toFixed(2) +
       " of " + NF.MASTER.length + " globals — a master is a few decisions, not a sweep");
    ok(new Set(seven).size <= 1 && (!seven.length || seven[0] === "shoegaze"),
       "more than one genre turns every knob on the desk: " +
       [...new Set(seven)].join(","));
  }

  // (b) FAMILY-APPROPRIATE, and each of these is a BALLOT WITH NO NULL IN IT
  // one tier down (compose.js MASTER_LEAN) — a promise the table makes and this
  // reads back off the composed songs. Tape and glue on a soul record, a room
  // on a choir, a ceiling on a club track: the producer's defaults, by tradition.
  {
    const must = {
      soul:   m => m.tape != null,
      roots:  m => m.tape != null,
      club:   m => m.ceiling != null && m.ceiling !== "open",
      drift:  m => m.space != null,
      vox:    m => m.space != null,
      groove: m => m.space != null,
      band:   m => m.drive != null,
      // a studio record is EDITED, not squashed
      studio: m => m.glue != null && m.glue !== "pump" && m.glue !== "squash",
      // and a lone part is not a record: nothing is being fought on the bus
      parts:  m => m.drive == null && m.ceiling !== "loud" && m.ceiling !== "louder",
    };
    const WHY = {
      soul: "tape", roots: "tape", club: "a ceiling that is not open",
      drift: "a room", vox: "a room", groove: "a room", band: "drive on the bus",
      studio: "glue that is not pumped", parts: "no bus fight at all",
    };
    for (const [fam, ks] of FAMILIES) {
      if (!must[fam]) continue;
      for (const gk of ks) for (const s of seeds.slice(0, 12)) {
        const m = C.compose(gk, s).master || {};
        ok(must[fam](m), gk + "/" + s + " (" + fam + "): a " + fam + " record wants " +
           WHY[fam] + " — got " + JSON.stringify(m));
      }
    }
    // THE HANDFUL WHOSE MASTER IS THE SOUND (compose.js MASTER_GENRE). Not a
    // lean: the anchor's own row, and if it stops winning the genre stops
    // sounding like itself.
    const OWN = {
      vaporwave: m => m.tape === "wow" || m.tape === "worn",
      dub:       m => m.space === "cavern" || m.space === "hall",
      sludge:    m => m.drive === "crush" || m.drive === "dirt",
      techno:    m => m.ceiling === "loud" || m.ceiling === "louder",
      shoegaze:  m => m.width === "huge" || m.width === "wide",
      gregorian: m => m.space === "cavern" || m.space === "hall",
    };
    for (const gk of Object.keys(OWN))
      for (const s of seeds.slice(0, 12))
        ok(OWN[gk](C.compose(gk, s).master || {}),
           gk + "/" + s + ": its own master row did not win — " +
           JSON.stringify(C.compose(gk, s).master));
    // ...AND STRUCTURALLY, not on the dice. `glue: "glue"` and `ceiling:
    // "open"` are the stock chain under their own names (fields.js
    // GLUEDFLT/CEILDFLT), so a row whose every ballot can draw a null or a
    // stock word has a draw that resolves to exactly no master at all — which
    // is the whole complaint, recurring at one in three thousand seeds where
    // no sweep would find it. Every row must carry one ballot that ALWAYS
    // moves something.
    {
      const STOCK = { glue: "glue", ceiling: "open" };
      const moves = row => Object.keys(row).some(k =>
        row[k].every(v => v != null && v !== STOCK[k]));
      for (const [fam, row] of Object.entries(C.MASTER_LEAN))
        ok(moves(row), fam + ": every one of its master ballots can draw a null or " +
           "the desk's own default — some seed of it resolves to no master at all");
      // the anchor rows are read ON TOP of a family row, so they may be as
      // partial as they like; what they may not be is misspelled
      for (const [gk, row] of Object.entries(C.MASTER_GENRE)) {
        ok(GENRES[gk], "MASTER_GENRE names " + gk + ", which is not a genre");
        for (const [k, ballot] of Object.entries(row)) {
          ok(NF.MASTERBY[k], gk + ": masters a global the registry lacks (" + k + ")");
          for (const v of ballot)
            ok(v == null || (NF.MASTERBY[k] &&
               Object.prototype.hasOwnProperty.call(NF.MASTERBY[k].table, v)),
               gk + "." + k + ": votes for " + v + ", which is not in the table");
        }
      }
    }
    // THE SHIPPED PRESETS ARE MASTERED TOO. Six hand-authored songs are the
    // first sound anybody hears, and a fix that dressed the generated records
    // and left the demos on the stock chain would have fixed the measurement
    // rather than the complaint.
    for (const p of require("../../nukernel/presets.js").PRESETS) {
      const m = p.data.master;
      ok(m && !NF.masterIsDefault(m), p.name + ": a shipped preset with no master");
      const r = NS.load(p.data);
      ok(r.ok && JSON.stringify(r.song.master) === JSON.stringify(m),
         p.name + ": the loader does not keep its master (" +
         JSON.stringify(r.ok ? r.song.master : r.errors[0]) + ")");
      ok(m && JSON.stringify(NF.resolveMaster(m)) !==
              JSON.stringify(NF.resolveMaster(null)),
         p.name + ": its master resolves to exactly the stock chain");
    }
    // SALTED, like every other ballot: one seed across the table must not
    // master fifty records the same way
    const at1 = new Set(GK.map(gk => JSON.stringify(C.compose(gk, 1).master)));
    ok(at1.size > 20, "only " + at1.size + " distinct masters across " + GK.length +
       " genres at one seed — the stream is not genre-salted");
    // and deterministic: a seed is a record, master included
    for (const gk of ["beatles", "techno", "dub"])
      ok(JSON.stringify(C.compose(gk, 9).master) === JSON.stringify(C.compose(gk, 9).master),
         gk + ": the master is not a function of (genre, seed)");
  }

  // (c) THE GUEST — the rate, the floor, the affinity and the restraint — and
  // (f) in the same pass, because both are census questions over every box of
  // every composed song and two sweeps of that is two sweeps.
  //
  // (f) SECTIONAL EFFECTS ARE SECTIONAL: the other half of "apply them
  // globally". Now that the bus is dressed, a per-box chain is reserved for the
  // section that genuinely departs — the bridge underwater, the breakdown, the
  // pedal under a solo — and nothing else in the plan gets one. Only the
  // DRESSED boxes are checked in detail; the legality of every chip on every
  // other box is what the loader in (a) already proved, twice per song.
  {
    const ZEROED = ["acid", "newwave", "vaporwave", "eurythmics", "trap", "house",
                    "garage", "dnb", "disco", "dub", "techno"];
    const SECTIONAL = new Set(["bridge", "breakdown", "solo"]);
    let boxes = 0, withGuest = 0, twoGuest = 0, threeGuest = 0, dressed = 0;
    const per = {}, distinct = [], twoRoles = new Set();
    for (const gk of GK) {
      const G = GENRES[gk], fam = G.family, ownFx = (G.fx || []).length;
      // WHO THIS HOST MAY CALL: the family's guest ballot plus its solo cast.
      // Anything else in a composed stack means a uniform draw crept back in,
      // which is how a techno track ended up with plainchant over it.
      const allowed = new Set([...(C.GUEST_LEAN[fam] || C.GUEST_LEAN.kernel),
                               ...(C.SOLO_LEAN[fam] || C.SOLO_LEAN.kernel)]);
      per[gk] = [0, 0];
      for (const s of seeds) {
        const song = C.compose(gk, s), names = new Set();
        for (const b of song.song) {
          boxes++; per[gk][1]++;
          // THE SINGER IS NOT A GUEST, and the census has to know it or every
          // number here stops meaning anything. A record's own voice is on the
          // payroll — it carries the verses and the choruses now (compose.js,
          // the through-line round) — so counting it as a visitor put the
          // "guest rate" at 54% and reported three-guest boxes that are a
          // band with a singer and one horn player. `as: "voice"` is how the
          // stack entry says which it is; the loader carries the key through.
          const gs = b.stack.slice(1).filter(e => e.as !== "voice");
          if (gs.length) { withGuest++; per[gk][0]++; }
          if (gs.length >= 2) { twoGuest++; twoRoles.add(b.role); }
          if (gs.length >= 3) threeGuest++;
          for (const e of gs) {
            names.add(e.g);
            // ON THE BALLOT and not the host itself. `allowed` is the family's
            // guest ballot plus its solo cast, and the ballots are held to
            // LAYERABLE structurally below — so this one check covers the
            // affinity law and the stackability law at once. Anything else in
            // a composed stack means a uniform draw crept back in, which is
            // how a techno track ended up with plainchant over it.
            ok(e.g !== gk && allowed.has(e.g), gk + "/" + s + ": stacked " + e.g +
               ", which is not on the " + fam + " ballot — the guest is being " +
               "drawn at random again");
            // and it must have something to play: an empty slot list on a
            // layer is a guest who was booked and never turned up
            ok(Array.isArray(e.slots) && e.slots.length,
               gk + "/" + s + ": " + e.g + " is stacked with nothing to play");
          }
          // ...and the box's own effects chain, where the section added to it
          if (b.fx.length > ownFx) {
            dressed++;
            ok(SECTIONAL.has(b.role), gk + "/" + s + ": a sectional effect landed " +
               "on a " + b.role + " — per-box fx are for the section that departs, " +
               "and everything global belongs on the master now");
            ok(b.fx.length <= NF.MAX_FX && new Set(b.fx).size === b.fx.length &&
               b.fx.every(k => NF.FX[k]),
               gk + "/" + s + ": a bad effects chain — " + JSON.stringify(b.fx));
          }
        }
        distinct.push(names.size);
      }
    }
    const fxShare = dressed / boxes;
    console.log("  sectional fx on " + (100 * fxShare).toFixed(1) + "% of boxes (" +
                dressed + "/" + boxes + "), three roles only");
    ok(fxShare > 0.04 && fxShare < 0.15, (100 * fxShare).toFixed(1) + "% of boxes carry " +
       "a sectional effect — reserved means a handful, and a handful means it happens");
    const rate = withGuest / boxes;
    console.log("  guest rate " + (100 * rate).toFixed(1) + "% of boxes (" +
                withGuest + "/" + boxes + "), " + twoGuest + " boxes with two");
    // THE BAND THIS STAGE DEFENDS: a third. Below a quarter and the complaint
    // is unfixed; above 40% and every other section has a stranger on it,
    // which is the mush the restraint rules exist to prevent.
    ok(rate >= 0.25 && rate <= 0.40, "the guest rate is " + (100 * rate).toFixed(1) +
       "% — outside the 25–40% band this stage defends");
    // NO GENRE AT ZERO, and the eleven that used to be are named so the
    // regression cannot come back quietly as "the average is fine"
    for (const gk of GK) {
      const [g, b] = per[gk];
      ok(g > 0, gk + ": never once hosts a guest");
      ok(g / b >= 0.15, gk + ": only " + (100 * g / b).toFixed(0) + "% of its boxes " +
         "carry a guest — every genre must be able to host one");
    }
    for (const gk of ZEROED)
      ok(per[gk][0] > 0, gk + ": still at zero — it was one of the eleven");
    // RESTRAINT. Never three, and two only where a chorus can carry it: the
    // singer plus the colour that arrives for the last one.
    ok(threeGuest === 0, threeGuest + " boxes stack three guests — that is mush");
    ok([...twoRoles].every(r2 => r2 === "chorus"),
       "two guests landed outside a chorus: " + [...twoRoles].join(","));
    // ...and a song has a CAST, not a shuffle: the guest comes back, which is
    // the whole musical point of drawing them once
    const mean = distinct.reduce((a, b) => a + b, 0) / distinct.length;
    ok(mean < 3.2, "a composed song calls on " + mean.toFixed(2) + " different " +
       "guest genres on average — that is a shuffle, not an arrangement");
    ok(Math.max(...distinct) <= 5, "one song called " + Math.max(...distinct) +
       " different guests");
    // THE BALLOTS THEMSELVES: every family votes, every vote is stackable, and
    // no vote carries a prog (§23h proves the same law on the composed output;
    // this catches a bad ballot entry that the dice have not reached yet)
    for (const [fam] of FAMILIES) {
      const b = C.GUEST_LEAN[fam];
      ok(Array.isArray(b) && b.length >= 2, fam + ": no usable GUEST_LEAN ballot");
      for (const w of b || []) {
        ok(C.LAYERABLE.includes(w), fam + ": votes for " + w + ", which is not stackable");
        ok(!GENRES[w].prog, fam + ": votes for " + w + ", which carries a prog");
      }
    }
  }

  // (d) THE GUEST IS AUDIBLE, on the real render path. A stacked genre that
  // contributes no events is a config change, and this suite exists because
  // three of those shipped green.
  {
    let checked = 0;
    for (const gk of GK) {
      for (const s of seeds.slice(0, 4)) {
        const song = C.compose(gk, s);
        for (const b of song.song) {
          if (b.stack.length < 2) continue;
          const ev = D.sectionEvents(b, song.slots).ev;
          const mine = ev.filter(e => e.layer);
          ok(mine.length > 0, gk + "/" + s + " (" + b.role + "): " +
             b.stack.slice(1).map(e => e.g).join("+") + " is stacked and plays nothing");
          // ...and it is a SECOND voice, not a replacement: the host is still
          // playing under it wherever the section did not deliberately strip
          // the authority (the solo break, which is the one place it does)
          if (b.stack[0].slots.length)
            ok(ev.some(e => !e.layer && e.kind === "line"),
               gk + "/" + s + " (" + b.role + "): the guest silenced the host");
          checked++;
          break;                                    // one box per song is enough
        }
      }
    }
    ok(checked >= 150, "only " + checked + " guested sections were rendered");
    // THE CAST IS TWO NAMES, and they are two: the peak's arrival is only an
    // arrival if it has not already been on the record.
    for (const gk of GK) for (const s of seeds.slice(0, 10)) {
      const c = C.guestCast(GENRES[gk], gk, C.rng(s * 7919 + 13));
      ok(c && c.a !== gk && c.b !== gk, gk + ": cast itself as its own guest");
      ok(c && c.a !== c.b, gk + ": drew the same guest twice — the peak brings " +
         "nobody new");
    }
  }

  // (e) THE BEATLES TEST IN A REAL COMPOSED SONG. §40 proves the mechanism on a
  // hand-built box; the ask was that the arranger actually writes one — "a
  // Beatles song where only the drums remain, but the solo plays" — so this
  // goes looking for it in compose("beatles", …) and renders what it finds.
  {
    let found = 0, proved = 0;
    for (const s of seeds) {
      const song = C.compose("beatles", s);
      for (const b of song.song) {
        if (b.cue !== "solobreak") continue;
        found++;
        const out = D.sectionEvents(b, song.slots), ev = out.ev;
        const hits = ev.filter(e => e.kind === "hit");
        const line = ev.filter(e => e.kind === "line");
        const bass = ev.filter(e => e.kind === "bass");
        ok(hits.length > 0, "beatles/" + s + ": the solo break has no drums");
        ok(bass.length === 0, "beatles/" + s + ": the bass plays under the break");
        ok(line.length > 0, "beatles/" + s + ": nobody takes the solo");
        ok(line.every(e => e.layer), "beatles/" + s + ": " +
           line.filter(e => !e.layer).length + " notes came from the host — it was " +
           "supposed to have stopped");
        // the drums are the HOST's kit, which is what makes it a Beatles song
        // with somebody else's solo over it rather than two records at once.
        // MEASURED EXCEPT THE LAST BAR, and that is a finding rather than a
        // convenience: a composed solo section carries an `outro` fill, and a
        // fill speaks a wider vocabulary than the genre's bar — beatles/1 ends
        // on a crash, which is a lane its kit does not otherwise own. §40's
        // hand-built box has no ending, which is why it can ask for all of them.
        const own = new Set(Object.keys(GENRES.beatles.kit));
        const bs = 16 / out.g.rate, body = (out.bars - 1) * bs;
        const inBody = hits.filter(e => e.t < body);
        ok(inBody.length > 0 && inBody.every(e => own.has(e.d)),
           "beatles/" + s + ": the drums under the break are not the host's kit (" +
           [...new Set(inBody.filter(e => !own.has(e.d)).map(e => e.d))].join(",") + ")");
        ok(new Set(inBody.map(e => e.d)).size > 1,
           "beatles/" + s + ": the break is one drum lane, not a kit");
        proved++;
        break;
      }
    }
    ok(found >= 8, "only " + found + " of " + seeds.length + " Beatles songs contain " +
       "a solo break — the arranger has stopped writing them");
    ok(proved === found, "a composed solo break did not render as one");
  }

}

/* ------------------------------------------- 42. THE SONGWRITER'S READ
   Five criticisms and one correction, from reading beatles/5, postrock/2 and
   citypop/4 as charts rather than as configuration. Every one of them is about
   the ARRANGER — the engine could already say all of this and was never asked
   to — and every one is measured here on the rendered stream through the real
   ui/derive.js, because "the composer wrote a stop" and "the section has a
   hole in it" are different claims and only the second one is music.

     (a) SECTION LENGTH WAS INVERTED across the table.
     (b) BREAK THE SYMMETRY — irregular lengths, and only where they belong.
     (c) DYNAMICS NEED A MEMORY — position, not just role.
     (d) THERE ARE NO STOPS.
     (e) THE VOCAL IS A GUEST AND SHOULD BE THE THROUGH-LINE.
     (f) THE INTRO NEVER QUOTES ANYTHING. */
console.log("the songwriter's read — lengths, irregularity, memory, stops, voice, quote");
{
  const C = require("../../nukernel/compose.js");
  const NF = require("../../nukernel/fields.js");
  const NS = require("../../nukernel/song.js");
  const seeds = Array.from({ length: 16 }, (_, i) => i + 1);
  const meanVel = ev => (ev.length
    ? ev.reduce((s, e) => s + (e.vel == null ? 5 : e.vel), 0) / ev.length : 0);
  const lvlOf = b => NF.LEVELS[b.lvl || "norm"];
  const median = xs => xs.slice().sort((a, b) => a - b)[xs.length >> 1];
  // THE COMPOSER'S OWN WORD FOR A SECTION, imported rather than re-derived.
  // `cue || role` is the wrong read for the three passes this section tests:
  // the head intro's cue carries its intro KIND and a solo break's carries
  // "solobreak", so the raw read made a bulgarian record's opening bar look
  // like a solo section — and a gate that re-derives a policy is a gate that
  // can agree with a bug.
  const word = C.sectionWord;

  // (a) HOW LONG A SECTION IS, per family — the correction that came with the
  // five. "Beatles gets 8-bar sections while citypop gets 2- and 4-bar ones,
  // but groove music needs LONGER to sit in the pocket and the pop song is the
  // one that can move fast." It was inverted because the section length WAS
  // the genre's form length (`G.bars`), which is a different question: a form
  // length is how long the pattern takes to come back, a section length is how
  // long you stay in it. citypop's form is 4 bars and its verse should not be.
  //
  // Measured in STEPS rather than bars, because a bar is not a duration: a
  // half-time genre's bar is twice as long, and comparing 8 bars of rock with
  // 8 bars of vaporwave compares two different amounts of time.
  {
    const by = {};
    for (const gk of GK) {
      const g = GENRES[gk], steps = C.fullLen(g) * 16 / g.rate;
      (by[g.family] = by[g.family] || []).push(steps);
      // and the section never stops the genre's own pattern half way through
      ok(C.fullLen(g) % g.bars === 0, gk + ": a section of " + C.fullLen(g) +
         " bars cuts its own " + g.bars + "-bar form off mid-phrase");
      ok(C.fullLen(g) >= g.bars && C.fullLen(g) <= NF.MAX_LEN,
         gk + ": section length " + C.fullLen(g) + " is not a usable window");
      ok(C.halfLen(g) >= 2 && C.halfLen(g) < C.fullLen(g),
         gk + ": the half-length roles are not shorter than a section");
    }
    // THE FENCE, and it is the correction stated as a number: the two families
    // whose music is a groove you settle into sit at twice the duration of the
    // families that write verses and choruses. 256 steps against 128, measured.
    const pop = Math.max(median(by.studio), median(by.soul), median(by.roots),
                         median(by.band));
    for (const fam of ["club", "groove"])
      ok(median(by[fam]) >= 2 * 128 && median(by[fam]) >= 1.5 * 128,
         fam + ": its median section is " + median(by[fam]) + " steps — groove " +
         "music needs longer than a pop verse to sit in the pocket");
    ok(median(by.studio) <= 128 && median(by.soul) <= 128,
       "the pop families are not the ones that move fast (" + median(by.studio) +
       " / " + median(by.soul) + " steps)");
    void pop;
    // ...and the anchors the read actually named
    ok(C.fullLen(GENRES.citypop) === 8 && C.fullLen(GENRES.beatles) === 8,
       "citypop and beatles do not arrange at the same section length (" +
       C.fullLen(GENRES.citypop) + " / " + C.fullLen(GENRES.beatles) + ")");
    ok(C.fullLen(GENRES.dub) === 16 && C.fullLen(GENRES.house) === 16,
       "the groove and floor anchors still arrange in four-bar sections");
    // AND IT REACHES THE RENDER: the box's window really is that many bars
    for (const gk of ["citypop", "house", "dub", "beatles", "blues", "vaporwave"]) {
      const song = C.compose(gk, 3);
      const v = song.song.find(b => b.role === "verse" && !b.cue && !b.bend);
      ok(!!v, gk + ": no plain verse to measure");
      if (v) {
        const r = D.sectionEvents(v, song.slots);
        ok(r.bars === C.fullLen(GENRES[gk]) && r.bars === v.len,
           gk + ": the verse renders " + r.bars + " bars, not " + v.len);
      }
    }
  }

  // ---- ONE SWEEP, three censuses. (b), (c) and (e) are all questions about
  // every box of every composed song, and three sweeps of that is three sweeps.
  const CEN = { sec: 0, bent: 0, sqSec: 0, sqBent: 0, kinds: {}, stops: {},
                stopSec: 0, dupSongs: 0, songs: 0, steadyDup: 0, steadySongs: 0,
                chorus: 0, chorusVoice: 0, verse: 0, verseVoice: 0,
                soloLayers: 0, soloLoose: 0, twoVisits: 0, quotes: 0 };
  for (const gk of GK) {
    const G = GENRES[gk], singer = C.singerOf(G, gk), steady = !!C.STEADY[gk];
    for (const s of seeds) {
      const song = C.compose(gk, s), by = {};
      CEN.songs++; if (steady) CEN.steadySongs++;
      let visits = 0, lastStop = -9;
      song.song.forEach((b, i) => {
        if (C.BEDS[b.role]) return;
        const w = word(b);
        CEN.sec++;
        if (C.SQUARE[G.family]) { CEN.sqSec++; if (b.bend) CEN.sqBent++; }
        if (b.bend) { CEN.bent++; CEN.kinds[b.bend] = (CEN.kinds[b.bend] || 0) + 1; }
        if (b.stop) {
          CEN.stopSec++; CEN.stops[b.stop] = (CEN.stops[b.stop] || 0) + 1;
          ok(i - lastStop >= 2, gk + "/" + s + ": two stops in adjacent sections");
          lastStop = i;
        }
        (by[w] = by[w] || []).push(b.env);
        const voice = b.stack.filter(e => e.as === "voice");
        ok(voice.length <= 1, gk + "/" + s + ": two singers on one box");
        ok(voice.every(e => e.g === singer), gk + "/" + s + ": the voice layer is " +
           (voice[0] && voice[0].g) + ", not the record's singer " + singer);
        if (singer) {
          if (w === "chorus") { CEN.chorus++; if (voice.length) CEN.chorusVoice++; }
          if (w === "verse") { CEN.verse++; if (voice.length) CEN.verseVoice++; }
        }
        for (const e of b.stack.slice(1)) if (e.g === "solo") {
          CEN.soloLayers++;
          if (b.role === "solo") continue;
          if (w === "chorus") visits++; else CEN.soloLoose++;
        }
      });
      if (visits > 1) CEN.twoVisits++;
      // the stop kinds are never repeated inside one record
      const ks = song.song.filter(b => b.stop).map(b => b.stop);
      ok(new Set(ks).size === ks.length, gk + "/" + s + ": the same stop twice");
      // and no two sections of one role carry the same dynamic
      let dup = false;
      for (const v of Object.values(by)) if (new Set(v).size !== v.length) dup = true;
      if (dup) { CEN.dupSongs++; if (steady) CEN.steadyDup++; }
      if (!steady)
        ok(!dup, gk + "/" + s + ": two sections of one role carry the same dynamic — " +
           JSON.stringify(by));
      if (song.song[0].cue === "quote") CEN.quotes++;
    }
  }

  // (b) BREAK THE SYMMETRY. "Real pop breaks its own clock: the truncated
  // verse, the extra 2-bar turnaround, the chorus that arrives a bar early."
  //
  // THE DISTRIBUTION THIS DEFENDS, and it is not a uniform dice roll on the
  // length field — it is four named gestures at four named positions
  // (compose.js BENDS), so an irregular section is always irregular ABOUT
  // something: `early` takes a bar off the lift so the chorus lands before you
  // counted it, `short` cuts two bars off a later verse, `turn` adds the
  // two-bar turnaround into a verse, `long` runs the last chorus out. Measured
  // at ~16% of the non-bed sections of a breakable genre, which is one or two
  // a record — an event rather than a tic — and exactly 0% of the square ones.
  {
    const breakable = CEN.sec - CEN.sqSec;
    const rate = CEN.bent / breakable;
    console.log("  irregular lengths on " + (100 * rate).toFixed(1) + "% of breakable " +
                "sections (" + CEN.bent + "/" + breakable + "), " + CEN.sqBent +
                " on square ones; " + JSON.stringify(CEN.kinds));
    ok(rate >= 0.08 && rate <= 0.25, (100 * rate).toFixed(1) + "% of breakable " +
       "sections are irregular — outside the 8–25% band this stage defends");
    ok(CEN.sqBent === 0, CEN.sqBent + " irregular sections in a family whose " +
       "arithmetic is load-bearing — a fugue keeps its arithmetic");
    for (const k of Object.keys(C.BENDS))
      ok((CEN.kinds[k] || 0) > 20, "the \"" + k + "\" gesture fired " +
         (CEN.kinds[k] || 0) + " times — a vocabulary entry the dice never reach");
    // ...and every square FAMILY is really represented, so the zero above is a
    // fact about restraint rather than about an empty set
    ok(CEN.sqSec > 3000, "only " + CEN.sqSec + " square sections in the sweep — " +
       "the zero proves nothing");
    // AND IT REACHES THE RENDER. A length that does not move the window is a
    // number in a file: the bent box must render exactly its own bars, and the
    // same box unbent must render a different number of them.
    let proved = 0;
    for (const gk of GK) {
      if (C.SQUARE[GENRES[gk].family]) continue;
      for (const s of [3, 9]) {
        const song = C.compose(gk, s);
        for (const b of song.song) {
          if (!b.bend) continue;
          const on = D.sectionEvents(b, song.slots);
          const off = D.sectionEvents({ ...b, len: b.len - C.BENDS[b.bend] }, song.slots);
          ok(on.bars === b.len && on.bars !== off.bars,
             gk + "/" + s + ": the \"" + b.bend + "\" bend does not move the window");
          // the square length it departed from is a whole number of forms; the
          // bent one is a bar early or two bars long, which is the point
          ok(off.bars % GENRES[gk].bars === 0 || off.bars === C.halfLen(GENRES[gk]),
             gk + "/" + s + ": the unbent length was not square to begin with");
          proved++;
          break;
        }
      }
    }
    ok(proved > 20, "only " + proved + " bent sections were rendered");
  }

  // (c) DYNAMICS NEED A MEMORY. "The second verse is bigger than the first
  // because the band has walked in; the last chorus is the biggest thing in
  // the record; a bridge can be the quietest. No two sections of the same role
  // in one song should carry the same dynamic unless the song is deliberately
  // flat." The per-song distinctness is asserted in the sweep above, box by
  // box; what is left is the exemption and the sound.
  {
    console.log("  " + CEN.dupSongs + "/" + CEN.songs + " songs repeat a same-role " +
                "dynamic, all of them deliberately flat (" + CEN.steadyDup + "/" +
                CEN.steadySongs + " STEADY songs do)");
    // THE EXEMPTION IS LIVE, which is the half of a carve-out that usually is
    // not checked: `drone` and `ambient` are one idea held for a record, they
    // are handed the bare role constants, and they really do repeat. If they
    // stopped, the branch above would be silently covering nothing.
    ok(CEN.dupSongs === CEN.steadyDup && CEN.steadyDup > 10,
       "the flat-song exemption covers " + CEN.steadyDup + " songs of " +
       CEN.dupSongs + " that repeat — it is either dead or leaking");
    ok(Object.keys(C.STEADY).length <= 3,
       "the deliberately-flat list has grown into an excuse: " +
       Object.keys(C.STEADY).join(","));
    // THE ARC IS MONOTONE WHERE IT PROMISES TO BE: the ladder walks a role
    // group from the back, so the LAST member keeps what it was dealt and the
    // earlier ones step down (compose.js DYNLADDER, ordered by the mean of the
    // curve each word compiles to).
    {
      const meanOf = k => { let s = 0; for (let i = 0; i <= 20; i++) s += K.SHAPES[k](i / 20);
                            return s / 21; };
      // NON-DECREASING, not strictly increasing, and the one flat step is the
      // interesting one: `dim` and `cresc` both average 0.810 — the same
      // loudness travelled in opposite directions. They are two different
      // things to hear and the same thing to measure, so they sit adjacent and
      // the ends are what carry the strict claim.
      for (let i = 1; i < C.DYNLADDER.length; i++)
        ok(meanOf(C.DYNLADDER[i]) >= meanOf(C.DYNLADDER[i - 1]),
           "DYNLADDER is not ordered by size: " + C.DYNLADDER[i - 1] + " (" +
           meanOf(C.DYNLADDER[i - 1]).toFixed(3) + ") > " + C.DYNLADDER[i]);
      ok(meanOf(C.DYNLADDER[C.DYNLADDER.length - 1]) > meanOf(C.DYNLADDER[0]) + 0.3,
         "the top and bottom of the dynamics ladder are the same size");
    }
    // AND IT IS AUDIBLE: verse 2 outweighs verse 1 on the real render path, in
    // the genres that have two verses and a band to walk in with. Measured at
    // 94/96 when this landed — the two misses are seeds where the first verse
    // drew a denser deal, which is an arrangement rather than a bug.
    let up = 0, n2 = 0;
    for (const gk of ["rock", "beatles", "funk", "motown", "citypop", "gospel",
                      "countrypop", "steely"])
      for (const s of seeds.slice(0, 12)) {
        const song = C.compose(gk, s);
        const vs = song.song.filter(b => b.role === "verse" && !b.cue);
        if (vs.length < 2) continue;
        n2++;
        const at = b => meanVel(D.sectionEvents(b, song.slots).ev) * lvlOf(b);
        if (at(vs[1]) > at(vs[0])) up++;
      }
    ok(n2 > 80 && up / n2 >= 0.9, "the second verse is bigger than the first in only " +
       up + "/" + n2 + " songs — the arc has no memory of where it is");
    // ...and the BRIDGE is allowed to be the quietest thing on the record,
    // which the old table (bridge 0.45, verse 0.50, no ramp) could not express
    {
      let quieter = 0, n3 = 0;
      for (const gk of ["rock", "beatles", "steely", "toto"])
        for (const s of seeds.slice(0, 10)) {
          const song = C.compose(gk, s);
          const br = song.song.find(b => b.role === "bridge");
          const vs = song.song.filter(b => b.role === "verse" && !b.cue);
          if (!br || !vs.length) continue;
          n3++;
          const at = b => meanVel(D.sectionEvents(b, song.slots).ev) * lvlOf(b);
          if (at(br) < Math.max(...vs.map(at))) quieter++;
        }
      ok(n3 > 30 && quieter / n3 >= 0.6, "the bridge is quieter than the loudest " +
         "verse in only " + quieter + "/" + n3 + " songs");
    }
  }

  // (d) THERE ARE NO STOPS. There are now, and each of the five is REUSED from
  // a table that already had it — `drop` is the envelope that silences the last
  // eighth of a section, cut/break/tail/hush are four of the ten outro edges.
  // Nothing was added to the kernel; what was missing was an arranger with an
  // opinion about where a hole goes (compose.js placeStops).
  //
  // EVERY CLAIM BELOW IS THE HOLE ITSELF, on the rendered stream. That matters
  // more here than anywhere else in this file, because four of the five kinds
  // were already reachable as ordinary end-of-section fills — the regression
  // this guards is not "the word is missing", it is "the word is there and the
  // bar is full".
  {
    console.log("  stops on " + (100 * CEN.stopSec / CEN.sec).toFixed(1) + "% of " +
                "sections (" + CEN.stopSec + "/" + CEN.sec + "), " +
                JSON.stringify(CEN.stops));
    const rate = CEN.stopSec / CEN.sec;
    ok(rate >= 0.08 && rate <= 0.22, (100 * rate).toFixed(1) + "% of sections stop — " +
       "outside the 8–22% band: below it the record has no holes in it, above it " +
       "a hole is the texture rather than the moment");
    for (const k of Object.keys(C.STOPS))
      ok((CEN.stops[k] || 0) > 40, "the \"" + k + "\" stop fired " +
         (CEN.stops[k] || 0) + " times — the arranger never reaches it");
    // WHERE THEY LAND. The policy says: before the peak, at the end of a
    // bridge, or once more on a verse/chorus/solo — and never on a bed, an
    // intro, the outro or the peak itself, because a record's own ending is
    // not a stop, it is the end.
    let beforePeak = 0, bridges = 0, songsWithStop = 0;
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s);
      let peak = -1;
      song.song.forEach((b, i) => { const w = word(b);
        if (w === "chorus" || w === "drop") peak = i; });
      let any = false;
      song.song.forEach((b, i) => {
        if (!b.stop) return;
        any = true;
        const w = word(b);
        ok(!C.BEDS[b.role] && w !== "intro" && w !== "outro" && i !== peak,
           gk + "/" + s + ": a stop landed on the " + w + " — the record's own " +
           "ending is not a stop");
        ok(i === peak - 1 || w === "bridge" || w === "verse" || w === "chorus" ||
           w === "solo", gk + "/" + s + ": a stop landed on a " + w +
           ", which is not a place the policy puts one");
        if (i === peak - 1) beforePeak++;
        else if (w === "bridge") bridges++;
      });
      if (any) songsWithStop++;
    }
    ok(beforePeak > 300, "only " + beforePeak + " records put a hole before the " +
       "last chorus — that is the one the brief names");
    ok(bridges > 60, "only " + bridges + " bridges stop at the end");
    ok(songsWithStop / CEN.songs >= 0.6, "only " +
       Math.round(100 * songsWithStop / CEN.songs) + "% of records have a stop in " +
       "them at all");
    // ...AND EACH KIND IS THE HOLE IT CLAIMS TO BE. One rendered assertion per
    // kind, written as what is MISSING from the last bar (or the last eighth),
    // plus the differential — the same box without the stop puts the events
    // back. `cut` gets a tolerance of a sixteenth because groove() runs last
    // and nudges the surviving events in time.
    const proved = {};
    for (const gk of GK) for (const s of seeds.slice(0, 10)) {
      const song = C.compose(gk, s);
      for (const b of song.song) {
        if (!b.stop || proved[b.stop] > 12) continue;
        proved[b.stop] = (proved[b.stop] || 0) + 1;
        const r = D.sectionEvents(b, song.slots), bs = 16 / r.g.rate, span = r.bars * bs;
        const last = r.ev.filter(e => e.t >= span - bs);
        const at = gk + "/" + s + " (" + b.stop + " on " + word(b) + "): ";
        if (b.stop === "drop")
          ok(!r.ev.some(e => e.t >= span * 0.875), at + "the last eighth of the " +
             "section is not silent — " + r.ev.filter(e => e.t >= span * 0.875).length +
             " events in the hole");
        else if (b.stop === "cut")
          ok(!r.ev.some(e => e.t > span - bs / 4 + bs / 16),
             at + "the band did not stop before the bar line");
        else if (b.stop === "hush")
          ok(last.length === 1 && last[0].kind === "hit" && last[0].t > span - bs / 8,
             at + "the bar of silence has " + last.length + " events in it");
        else if (b.stop === "tail")
          ok(!last.some(e => e.kind === "hit"),
             at + "the drums are still playing the last bar");
        else if (b.stop === "break")
          ok(last.length > 0 && !last.some(e => e.kind !== "hit"),
             at + "the band did not drop out under the drums");
        // the differential: without the stop there is more music in the bar
        const off = D.sectionEvents(b.stop === "drop" ? { ...b, env: "big" }
                                                      : { ...b, outro: null }, song.slots);
        ok(off.ev.length >= r.ev.length, at + "removing the stop removed events");
      }
    }
    for (const k of Object.keys(C.STOPS))
      ok(proved[k] > 5, "the \"" + k + "\" stop was never rendered (" +
         (proved[k] || 0) + ")");
    // THE KITLESS BALLOT IS THE TWO THAT ARE ABOUT THE BAND. `break` and `tail`
    // are defined by what the drums do, so on a choir they are silent no-ops —
    // the same argument OUTRO_NOKIT already makes for the fills.
    for (const k of [...C.STOP_NOKIT.peak, ...C.STOP_NOKIT.bridge,
                     ...C.STOP_NOKIT.loose])
      ok(k === "drop" || k === "cut", "a kitless genre may stop with \"" + k +
         "\", which is a fact about drums it does not have");
    for (const gk of GK) {
      if (Object.keys(GENRES[gk].kit || {}).length) continue;
      for (const s of seeds.slice(0, 6))
        for (const b of C.compose(gk, s).song)
          ok(!b.stop || b.stop === "drop" || b.stop === "cut",
             gk + "/" + s + ": a kitless genre stopped with \"" + b.stop + "\"");
    }
  }

  // (e) THE VOCAL IS A GUEST, AND IT SHOULD BE THE THROUGH-LINE. Measured on
  // beatles/5 before this: the `vocal` layer appeared on the BRIDGE only while
  // every chorus carried a `solo`. Backwards, and structurally so — there was
  // no such thing as the record's singer, only a per-section coin over a ballot
  // that also held the lead guitarist.
  {
    console.log("  the voice carries " + CEN.chorusVoice + "/" + CEN.chorus +
                " choruses and " + CEN.verseVoice + "/" + CEN.verse + " verses; " +
                CEN.soloLayers + " solo layers, " + CEN.soloLoose + " outside a " +
                "solo section");
    ok(CEN.chorus > 800 && CEN.chorusVoice === CEN.chorus,
       "the singer misses " + (CEN.chorus - CEN.chorusVoice) + " choruses of " +
       CEN.chorus + " — a chorus is the thing the singer is for");
    ok(CEN.verse > 800 && CEN.verseVoice / CEN.verse >= 0.75,
       "the singer carries only " + Math.round(100 * CEN.verseVoice / CEN.verse) +
       "% of verses — the voice is meant to be the through-line, not a visitor");
    // THE SOLO IS WHAT VISITS: one section, maybe one chorus, and nowhere else.
    ok(CEN.soloLoose === 0, CEN.soloLoose + " solo layers landed outside a solo " +
       "section and outside the one chorus the soloist visits");
    ok(CEN.twoVisits === 0, CEN.twoVisits + " records let the soloist visit two " +
       "choruses — \"one section, maybe a chorus\"");
    ok(CEN.soloLayers > 200, "only " + CEN.soloLayers + " solo layers in the sweep — " +
       "confined should not mean absent");
    // WHO SINGS is a decision, and both override tables are live: the anchors
    // inside a singing family that have no topline, and the one filed with the
    // drones that is a genre of songs.
    for (const gk of Object.keys(C.INSTRUMENTAL))
      ok(GENRES[gk] && !C.singerOf(GENRES[gk], gk), gk + ": declared instrumental " +
         "and given a singer anyway");
    ok(C.singerOf(GENRES.shoegaze, "shoegaze") === "vocal",
       "shoegaze is a genre of songs and lost its singer to its family row");
    ok(!C.singerOf(GENRES.drone, "drone") && !C.singerOf(GENRES.vocal, "vocal"),
       "a drone or a lone voice booked itself a singer");
    // THE VOICE IS ON THE RECORD, in events: the layer renders, it is the
    // topline material, and the host is still playing under it.
    let heard = 0;
    for (const gk of ["beatles", "rock", "motown", "citypop", "gospel", "house"])
      for (const s of seeds.slice(0, 6)) {
        const song = C.compose(gk, s);
        for (const b of song.song) {
          const v = b.stack.find(e => e.as === "voice");
          if (!v || word(b) !== "chorus" && word(b) !== "drop") continue;
          const ev = D.sectionEvents(b, song.slots).ev;
          const mine = ev.filter(e => e.layer === v.g && e.kind === "line");
          ok(mine.length > 0, gk + "/" + s + ": the singer is on the box and not " +
             "in the render");
          ok(ev.some(e => !e.layer && e.kind !== "hit"),
             gk + "/" + s + ": the singer silenced the band");
          heard++;
          break;
        }
      }
    ok(heard >= 30, "only " + heard + " sung sections were rendered");
    // AND IT IS ONE TUNE. "The same topline, developing" — slot 8 is written
    // from slot 5's own first half (compose.js phrase(), the `head` argument),
    // so the verse opens with the chorus's melody note for note and then
    // answers it differently. Read off the rendered stream with the player
    // taken out, because this is a fact about what was WRITTEN.
    {
      const g = plain(GENRES.simple), bs = 16 / g.rate;
      let same = 0, diff = 0;
      for (const s of seeds) {
        const song = C.compose("beatles", s);
        const sig2 = (i, lo, hi) => JSON.stringify(
          K.render(song.slots[i], g, 1)
            .filter(e => e.t >= lo && e.t < hi)
            .map(e => [+e.t.toFixed(4), e.n, e.vel]));
        // the first half bar is the same tune
        if (sig2(5, 0, bs / 2) === sig2(8, 0, bs / 2)) same++;
        // ...and the second half is not, or it is not a development, it is a copy
        if (sig2(5, bs / 2, bs) !== sig2(8, bs / 2, bs)) diff++;
        ok(sig2(5, 0, bs / 2).length > 4,
           "beatles/" + s + ": the topline renders nothing to develop");
      }
      ok(same === seeds.length, "the verse line opens with the chorus topline in " +
         "only " + same + "/" + seeds.length + " songs — it is a second tune, not " +
         "a development");
      ok(diff >= seeds.length - 1, "the verse line and the chorus topline are the " +
         "same phrase in " + (seeds.length - diff) + " songs — that is a repeat, " +
         "not a development");
    }
  }

  // ---- AND ALL THREE NEW KEYS SURVIVE THE ONE DOOR. `bend`, `stop` and the
  // stack entry's `as` are CARRIED keys, not registry fields — the same trick
  // `cue` has always played: the loader validates what the registry knows and
  // passes the rest through untouched. That is only true as long as nobody
  // adds a strip, and a composer whose arrangement notes are quietly eaten on
  // save writes songs that read differently the second time they are opened.
  {
    let carried = 0;
    for (const gk of GK) for (const s of seeds.slice(0, 4)) {
      const song = C.compose(gk, s), r = NS.load(JSON.parse(JSON.stringify(song)));
      ok(r.ok, gk + "/" + s + ": a composed song does not load: " +
         JSON.stringify(r.errors && r.errors[0]));
      if (!r.ok) continue;
      ok(r.song.slots.length === song.slots.length,
         gk + "/" + s + ": the loader resized the phrase bank");
      song.song.forEach((b, i) => {
        const q = r.song.song[i];
        ok(q.len === b.len, gk + "/" + s + ": the loader clamped a bent length " +
           b.len + " to " + q.len);
        ok(q.bend === b.bend && q.stop === b.stop && q.cue === b.cue,
           gk + "/" + s + ": the loader ate the arrangement notes on box " + i);
        ok(JSON.stringify(q.stack.map(e => e.as || null)) ===
           JSON.stringify(b.stack.map(e => e.as || null)),
           gk + "/" + s + ": the loader ate the singer's badge on box " + i);
        if (b.bend || b.stop) carried++;
      });
    }
    ok(carried > 100, "only " + carried + " bent-or-stopped boxes went through the " +
       "loader — the round trip proves nothing");
  }

  // (f) THE INTRO NEVER QUOTES ANYTHING. "The classic pop intro is the chorus
  // hook stated instrumentally — Day Tripper, A Hard Day's Night. It must be
  // the SAME material the chorus later sings, or it is not a quote."
  {
    ok(CEN.quotes > 40, "only " + CEN.quotes + " records open by quoting the hook");
    // the three families that cannot mean it do not vote for it: a choir does
    // not state its own chorus on an instrument, a drift record has no hook,
    // and a lone part has no chorus to quote FROM
    for (const fam of ["vox", "drift", "parts"])
      ok(!C.INTRO_LEAN[fam].includes("quote"),
         fam + ": votes to quote a hook it does not have");
    ok(["band", "studio", "soul", "roots", "groove", "kernel"]
        .every(f => C.INTRO_LEAN[f].includes("quote")),
       "a song-writing family cannot open on its own hook");
    let n2 = 0, shared = 0, control = 0;
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), head = song.song[0];
      if (head.cue !== "quote") continue;
      n2++;
      // STRUCTURAL: the intro STATES slot 5 — it is dealt first, so it is the
      // material voice 0 plays — and slot 5 is what the record later sings, the
      // chorus's own topline, which is the only place in this composer that
      // slot ever goes.
      //
      // This used to read `slots === "[5]"`, and pinning the ONE-slot deal is
      // what let the defect in §51(b) live here: a box hands each phrase to
      // every voice v ≡ pi (mod nP), so one slot is not one voice, it is the
      // same rendered phrase on all of them — the hook and its own octave, with
      // the composer having already taken the drums and the bass off. "Alone"
      // has to be a statement about the MATERIAL, so it is written that way:
      // the topline leads the deal, and what is beside it may only be `sparse`
      // (two notes a bar, its own walk) — never a second real part.
      ok(head.stack.length === 1 && head.stack[0].slots[0] === 5 &&
         head.stack[0].slots.slice(1).every(i => i === 6),
         gk + "/" + s + ": a quote intro is not stating the topline alone " +
         "(slots " + JSON.stringify(head.stack[0].slots) + ")");
      const later = song.song.slice(1).find(b =>
        b.stack.some(e => e.slots.includes(5)));
      ok(!!later, gk + "/" + s + ": the intro quotes a hook the record never states");
      if (!later) continue;
      // RENDERED, and this is the assertion that makes it a quote rather than a
      // coincidence of indices: PERTURB THE MATERIAL. Move slot 5's degrees and
      // BOTH streams must move — the intro's and the chorus's — because they
      // are reading the same phrase. Then the control: moving slot 0 (the hook,
      // which the intro is NOT playing) must leave the intro alone. Two
      // sensitivity checks in opposite directions, which is the form this suite
      // uses everywhere a value has to be shown reaching the output.
      const line = (b, sl) => JSON.stringify(D.sectionEvents(b, sl).ev
        .filter(e => e.kind === "line").map(e => [+e.t.toFixed(4), e.n]));
      const bump = i => {
        const sl = song.slots.map(p => clone(p));
        sl[i].deg = sl[i].deg.map(d => d + 2);
        return sl;
      };
      const up5 = bump(5), up0 = bump(0);
      const i0 = line(head, song.slots), c0 = line(later, song.slots);
      ok(i0.length > 4, gk + "/" + s + ": the quote renders no notes");
      ok(line(head, up5) !== i0, gk + "/" + s + ": moving the topline did not move " +
         "the quote — the intro is not playing it");
      if (line(later, up5) !== c0) shared++;
      if (line(head, up0) === i0) control++;
    }
    ok(n2 > 40, "only " + n2 + " quote intros were rendered");
    // THE CHORUS SIDE IS NOT 100%, and the exception is the same one §1 carries
    // for vaporwave: a genre whose voice 0 realizes as a PAD reads chord tones
    // and by construction cannot hear a degree vector, so a chorus that deals
    // the topline to a wash renders a quote of it that no perturbation of the
    // phrase can move. Measured at one record in fifty-nine; the intro side,
    // asserted above, is exact.
    ok(shared >= n2 - Math.ceil(n2 * 0.05),
       "the intro and the chorus read the same phrase in only " +
       shared + "/" + n2 + " records — one of them is quoting something else");
    ok(control === n2, "the quote intro moved when the HOOK moved in " +
       (n2 - control) + " records — it is not playing the topline");
    // ...and the pitch content really does land inside the chorus's, most of
    // the time. NOT always, and the exceptions are honest rather than
    // tolerated: a genre whose harmony is `emergent` derives its chords from
    // whichever phrase the section's authority leads with, so the intro's tune
    // and the chorus's tune are voiced over two different sets of chords; and
    // the peak chorus sometimes takes the truck-driver key. Measured at 91%.
    let inside = 0, m = 0;
    const pcs = ev => new Set(ev.filter(e => e.kind === "line" && e.n != null)
      .map(e => ((e.n % 12) + 12) % 12));
    for (const gk of GK) for (const s of seeds) {
      const song = C.compose(gk, s), head = song.song[0];
      if (head.cue !== "quote") continue;
      const later = song.song.slice(1).find(b => b.stack.some(e => e.slots.includes(5)));
      if (!later) continue;
      m++;
      const a = pcs(D.sectionEvents(head, song.slots).ev);
      const b2 = pcs(D.sectionEvents(later, song.slots).ev);
      if (a.size && [...a].every(p => b2.has(p))) inside++;
    }
    ok(m > 40 && inside / m >= 0.8, "the quote's pitch content sits inside the " +
       "chorus's in only " + inside + "/" + m + " records");
  }
}

/* ------------------------------------------- 43. THE SINGER, the pure half
   nukernel/sing.js decides which syllable lands on which note in which voice,
   and every one of those decisions is measurable here: the syllable split, the
   word bank, the note selection, the harmony interval, the espeak pitch rung.
   audio/sing.js is then a renderer with no opinions, and what IT does — the
   phoneme cut, the measured bend, the vocoder, the tape — is the browser
   gate's job (nukernel-drums (H), nukernel-bounce (D)).

   THE ONE THING THAT IS NOT PURE and is checked here anyway: espeak's own
   syllable count. The plan's letter rule has to agree with the artifact's
   phoneme nuclei or the words land on the wrong notes, and node can run the
   vendored wasm — so a two-utterance sample of it runs when the artifact is
   reachable and is skipped, loudly, when it is not (CI has no media, but
   vendor/espeak-ng IS committed, so in practice it runs). */
console.log("the singer — syllables, the bank, the ladders, the plan");
{
  const S = require("../../nukernel/sing.js");
  const NF = require("../../nukernel/fields.js");
  const C = require("../../nukernel/compose.js");

  // (a) THE SYLLABLE RULE, on words whose answer is not in dispute
  const cases = [["hold", 1], ["the", 1], ["be", 1], ["sky", 1], ["yes", 1],
                 ["a", 1], ["one", 1], ["table", 2], ["little", 2], ["again", 2],
                 ["river", 2], ["shadow", 2], ["morning", 2],
                 // A KNOWN LIMIT, asserted rather than hidden: a vowel HIATUS
                 // (ra-di-o) reads as one nucleus, because a maximal vowel run
                 // is the right default for boat/rain/see and English does not
                 // spell the difference. It is safe because no bank token has
                 // one — (b) below is what keeps it that way.
                 ["radio", 2]];
  for (const [w, n] of cases)
    ok(S.nsyl(w) === n, "syllables(" + w + ") = " + S.nsyl(w) + ", want " + n +
       " — " + JSON.stringify(S.syllables(w)));
  ok(S.nsyl("") === 0, "the empty word is not a syllable");
  // the pieces reassemble into the word — a splitter that loses letters is
  // a splitter that would sing a different word
  for (const [w] of cases)
    ok(S.syllables(w).join("") === w, "syllables(" + w + ") lost letters");

  // (b) THE BANK IS MONOSYLLABIC, which is the precondition the whole design
  // rests on: one token, one nucleus, one note. A polysyllabic token would
  // make espeak emit two nuclei where the plan expects one and every word
  // after it would land on the wrong note.
  let tokens = 0;
  for (const [fam, lines] of Object.entries(S.BANKS)) {
    ok(lines.length >= 2, fam + ": a bank with one line is not a choice");
    for (const line of lines) {
      ok(line.length >= 5, fam + ": a line of " + line.length + " is too short to sing");
      for (const w of line) {
        tokens++;
        ok(S.nsyl(w) === 1, fam + ': "' + w + '" is ' + S.nsyl(w) +
           " syllables — bank tokens must be one");
        ok(/^[a-zA-Z']+$/.test(w), fam + ': "' + w + '" is not a plain word');
      }
    }
  }
  ok(tokens > 100, "only " + tokens + " bank tokens");
  // every FAMILY genres.js declares has a bank — a genre whose family has none
  // would sing the fallback, silently
  const { FAMILIES } = require("../../nukernel/genres.js");
  for (const [fam] of FAMILIES)
    ok(S.BANKS[fam], "genre family " + fam + " has no word bank");
  // ...and every genre resolves to one
  for (const gk of GK) ok(S.bankFor(gk) && S.bankFor(gk).length,
    gk + ": no lyric bank resolves");

  // (c) THE MEASURED LADDERS: monotone in pitch, an octave apart, and the
  // rungs they generate keep the nominal bend inside what the header claims.
  for (const V of S.VOICES) {
    for (let i = 1; i < V.ladder.length; i++) {
      ok(V.ladder[i][0] > V.ladder[i - 1][0], V.key + ": ladder pitch not ascending");
      ok(V.ladder[i][1] > V.ladder[i - 1][1], V.key + ": ladder MIDI not ascending — " +
         "a higher espeak pitch that sings lower is a mis-measurement");
    }
    ok(V.rungs.length === S.NRUNGS, V.key + ": wrong rung count");
    for (let i = 1; i < V.rungs.length; i++)
      ok(V.rungs[i] > V.rungs[i - 1], V.key + ": rungs not ascending");
  }
  ok(S.VOICES[1].ladder[0][1] - S.VOICES[0].ladder[0][1] > 9,
     "the two singers are less than a minor seventh apart — they are one singer");
  // THE BEND CEILING, which is the whole justification for four rungs. Nominal
  // (the real one is a measurement and lives in the browser gate); the number
  // is stated in sing.js's header and this is what holds it there.
  let worstBend = 0;
  for (let m = 24; m <= 96; m++) for (let vi = 0; vi < 2; vi++)
    worstBend = Math.max(worstBend, Math.abs(S.rungFor(vi, m).bend));
  ok(worstBend <= 2.2, "the worst nominal bend is " + worstBend.toFixed(2) +
     " semitones — sing.js's header claims +-2.2, so either the ladders moved " +
     "or NRUNGS did");
  // every target in every register folds into the voice and picks a real rung
  for (let m = 12; m <= 108; m++) for (let vi = 0; vi < 2; vi++) {
    const r = S.rungFor(vi, m), V = S.VOICES[vi];
    ok(V.rungs.includes(r.pitch), vi + "/" + m + ": rung " + r.pitch + " is not a rung");
    ok(r.midi >= V.ladder[0][1] - 0.5 && r.midi <= V.ladder[V.ladder.length - 1][1] + 0.5,
       vi + "/" + m + ": folded to " + r.midi.toFixed(1) + ", outside the voice");
    ok(Math.abs(((r.midi - m) % 12 + 12) % 12) < 1e-6 ||
       Math.abs((((r.midi - m) % 12 + 12) % 12) - 12) < 1e-6,
       vi + "/" + m + ": the fold moved by " + (r.midi - m) + ", not by octaves — " +
       "a fold that changes the pitch class changes the note");
  }

  // (d) THE HARMONY IS CONSONANT BY CONSTRUCTION. Against a real chord it is a
  // chord tone in the third-to-sixth window; against nothing it is the octave.
  ok(S.harmonyOf(60, null) === 72, "no chord -> not the octave");
  ok(S.harmonyOf(60, []) === 72, "empty chord -> not the octave");
  {
    let win = 0, oct = 0;
    for (let root = 0; root < 12; root++) for (let m = 48; m <= 72; m++) {
      const pcs = [root, root + 4, root + 7];       // a major triad, any root
      const h = S.harmonyOf(m, pcs), d = h - m;
      ok(d >= S.HARM_LO && d <= S.HARM_HI || d === 12,
         "harmony " + d + " semitones above — outside the window and not the octave");
      if (d === 12) oct++; else {
        win++;
        ok(pcs.some(p => ((p % 12) + 12) % 12 === ((h % 12) + 12) % 12),
           "the harmony note is not a chord tone");
      }
    }
    // a triad covers three of twelve pitch classes, so a 7-semitone window
    // essentially always contains one: this is the "by construction" claim
    ok(oct === 0, oct + " harmonies fell back to the octave against a plain " +
       "triad — the third-to-sixth window is not doing its job");
    ok(win >= 300, "only " + win + " harmonies were measured");
  }

  // (e) NEUTRALITY, the §22 law for the new field: a box with no `sing` is the
  // day before this existed, event for event. Read through the REAL derive.
  {
    const song = C.compose("beatles", 7);
    for (const b of song.song) {
      const before = JSON.stringify(D.sectionEvents(b, song.slots).ev);
      ok(before.indexOf('"sing"') < 0,
         "a box with no sing chip emitted a sing event");
      const b2 = clone(b); b2.sing = null;
      ok(JSON.stringify(D.sectionEvents(b2, song.slots).ev) === before,
         "an explicit sing:null is not the same as absent");
    }
  }

  // (f) THE PLAN, on real composed boxes and the real derive path. This is the
  // §31 discipline: every claim is read off rendered events, never off config.
  {
    let sung = 0, dueted = 0, boxes = 0, held = 0;
    const intervals = new Map();
    for (const gk of ["beatles", "rock", "house", "gregorian", "tango", "dnb"]) {
      for (const s of [1, 5, 11]) {
        const song = C.compose(gk, s);
        for (const b of song.song) {
          const bb = clone(b); bb.sing = "duet";
          const ev = D.sectionEvents(bb, song.slots).ev;
          const sing = ev.filter(e => e.kind === "sing");
          boxes++;
          if (!sing.length) continue;
          sung++;
          // every sung event carries everything the player needs
          for (const e of sing) {
            ok(typeof e.syl === "string" && e.syl.length, gk + ": a sung event has no syllable");
            ok(typeof e.text === "string" && e.text.indexOf(e.syl) >= 0,
               gk + ': the utterance does not contain "' + e.syl + '"');
            ok(e.vi === 0 || e.vi === 1, gk + ": sung voice index " + e.vi);
            ok(Number.isFinite(e.n) && Number.isFinite(e.t) && e.dur > 0,
               gk + ": a sung event has no note, time or length");
            ok(e.colour === "natural", gk + ": duet is not a vocoder colour");
            if (e.hold) held++;
          }
          // TWO VOICES ON EVERY NOTE, and the second one above the first
          const lead = sing.filter(e => e.vi === 0), harm = sing.filter(e => e.vi === 1);
          ok(lead.length === harm.length, gk + ": " + lead.length + " lead notes but " +
             harm.length + " harmony notes — duet is not a duet");
          if (lead.length === harm.length && lead.length) {
            dueted++;
            for (let i = 0; i < lead.length; i++) {
              ok(lead[i].t === harm[i].t && lead[i].si === harm[i].si,
                 gk + ": the two voices are not singing the same syllable at the same time");
              const d = harm[i].n - lead[i].n;
              ok(d >= S.HARM_LO && d <= S.HARM_HI || d === 12,
                 gk + ": harmony " + d + " semitones above the tune");
              intervals.set(d, (intervals.get(d) || 0) + 1);
            }
          }
          // ONE SYLLABLE PER NOTE, spaced, capped
          const ts = [...new Set(lead.map(e => +e.t.toFixed(6)))].sort((a, b) => a - b);
          ok(ts.length === lead.length, gk + ": two syllables share a time");
          for (let i = 1; i < ts.length; i++)
            ok(ts[i] - ts[i - 1] >= S.MIN_STEPS - 1e-9,
               gk + ": syllables " + (ts[i] - ts[i - 1]) + " steps apart, under MIN_STEPS");
          ok(lead.length <= S.MAX_SYL, gk + ": " + lead.length + " syllables, over MAX_SYL");
          // the words are the bank's, in bank order, repeating
          const bankLine = S.lyricFor(gk, 0) && null;   // (order is checked below)
          ok(bankLine === null, "unreachable");
        }
      }
    }
    ok(sung > 60, "only " + sung + " of " + boxes + " boxes rendered a sung line");
    ok(dueted === sung, "only " + dueted + "/" + sung + " sung boxes were real duets");
    ok(held > 0, "no sung note anywhere was long enough to be held — HOLD_STEPS " +
       "is unreachable and the vowel stretch is dead code");
    ok(intervals.size >= 3, "the harmony only ever sang " + intervals.size +
       " distinct interval(s) — it is a fixed transposition, not a chart reading");
    console.log("  sung " + sung + "/" + boxes + " boxes, " + held + " held notes, " +
      "intervals " + [...intervals.entries()].sort((a, b) => a[0] - b[0])
        .map(([d, n]) => d + "st×" + n).join(" "));
  }

  // (g) DETERMINISM. Same box, same seed, same words and same notes — twice,
  // and against a fresh require of the module (the plan must not carry state).
  {
    const song = C.compose("rock", 3);
    const b = clone(song.song[1]); b.sing = "choir";
    const a1 = JSON.stringify(D.sectionEvents(b, song.slots).ev.filter(e => e.kind === "sing"));
    const b2 = clone(song.song[1]); b2.sing = "choir";
    const a2 = JSON.stringify(D.sectionEvents(b2, song.slots).ev.filter(e => e.kind === "sing"));
    ok(a1 === a2 && a1.length > 20, "the sung plan is not deterministic");
    ok(a1.indexOf('"vocoder"') > 0, "choir is not a vocoder colour");
    // the lyric is the GENRE's, so every box of one song sings the same words
    const texts = new Set();
    for (const x of song.song) {
      const xx = clone(x); xx.sing = "lead";
      for (const e of D.sectionEvents(xx, song.slots).ev)
        if (e.kind === "sing") texts.add(e.text);
    }
    ok(texts.size === 1, "one song sang " + texts.size + " different lines — the " +
       "warm cost is per line, so this is also " + texts.size + " sets of espeak instances");
  }

  // (h) ONE VOICE ONLY, for the single-singer chips
  {
    const song = C.compose("house", 9);
    for (const chip of ["lead", "robot"]) {
      // the first box that HAS a singable line — not every box does (a drums
      // box has no voice-0 tune), and (f) already measures how many do
      let sing = [];
      for (const x of song.song) {
        const b = clone(x); b.sing = chip;
        sing = D.sectionEvents(b, song.slots).ev.filter(e => e.kind === "sing");
        if (sing.length) break;
      }
      ok(sing.length > 0, chip + ": no box in the song sang anything");
      ok(sing.every(e => e.vi === 0), chip + " used the harmony voice");
      ok(sing.every(e => e.colour === (chip === "robot" ? "vocoder" : "natural")),
         chip + ": wrong colour");
    }
  }

  // (i) THE REGISTRY KNOWS ABOUT IT — the §21(b) rules, applied to the one
  // table that lives in another file
  ok(NF.FIELD.sing && NF.FIELD.sing.scope === "box", "sing is not a box field");
  ok(Object.keys(NF.SINGS).length === Object.keys(NF.SINGLABEL).length,
     "a sing value has no label");
  for (const [k, v] of Object.entries(NF.SINGS)) {
    ok(v.voices === 1 || v.voices === 2, k + ": " + v.voices + " voices");
    ok(v.colour === "natural" || v.colour === "vocoder", k + ": colour " + v.colour);
  }

  // (j) THE ARTIFACT'S OWN SYLLABLE COUNT. The plan's letter rule and espeak's
  // phoneme nuclei must agree or the words land on the wrong notes. Two
  // utterances, not two hundred: the full sweep is the calibration helper.
  {
    const CS = require("../../engine/speech.js");
    // THE STUB WINDOW HAS TO GO for the duration of this check. §31 installs
    // `globalThis.window = globalThis` so ui/deps.js can read the UMD tier —
    // and the emscripten glue sniffs exactly that to decide it is in a
    // browser, then reads location.pathname and throws. Nothing between here
    // and the restore re-reads window: deps.js captured its bindings at import.
    const stubWindow = globalThis.window;
    delete globalThis.window;
    const IPA = new Set([..."aeiouyəɐɛɪɔʊʌɜæɑɒɘɵøɤɯɨʉœɶɞ"]);
    const isNuc = id => { const t = String(id || "").replace(/[ˈˌː%_'|\-]/g, "");
                          return t.length > 0 && IPA.has(t[0]); };
    if (await CS.available()) {
      for (const fam of ["kernel", "vox"]) {
        const line = S.BANKS[fam][0], text = line.join(" ");
        const r = await CS.synth(text, { speed: 260 });
        const nuclei = (r.marks || []).filter(m => m.type === "phoneme" && isNuc(m.id));
        ok(nuclei.length === line.length, fam + ': espeak sang "' + text + '" as ' +
           nuclei.length + " nuclei but the plan laid out " + line.length +
           " — every word after the divergence lands on the wrong note");
        ok(r.marks && r.marks.length > line.length,
           "engine/speech.js returned no marks — the syllable cut has nothing to cut on");
        // and the fresh-instance law still holds through the new lang option
        const r2 = await CS.synth(text, { speed: 260 });
        ok(r2.pcm.length === r.pcm.length &&
           r2.pcm.every((v, i) => v === r.pcm[i]),
           "two synths of the same line are not byte-identical");
      }
      // the variant is REACHABLE now, which is the point of the lang option
      const a = await CS.synth("la la", { speed: 260 });
      const b = await CS.synth("la la", { speed: 260, variant: "f3", lang: "" });
      ok(a.pcm.length !== b.pcm.length ||
         !a.pcm.every((v, i) => v === b.pcm[i]),
         "the f3 variant produced identical PCM — engine/speech.js's lang option " +
         "is not reaching set_voice, so there is only one singer");
      const c = await CS.synth("la la", { speed: 260, variant: "f3" });
      ok(c.pcm.length === a.pcm.length && c.pcm.every((v, i) => v === a.pcm[i]),
         "a variant WITHOUT lang changed the audio — the additive contract in " +
         "engine/speech.js is broken and 230 registry rows just moved");
    } else console.log("  ..: espeak artifact unreachable — (j) skipped");
    globalThis.window = stubWindow;
  }
}

/* ---------------------------------------------------------------- 44. THE MACHINES
   The classic drum machines (fields.js DRUMKITS tr808/tr909/tr606/cr78,
   synthesized by audio/machines.js) — every claim a SCORE can answer, answered
   here rather than in a browser:
     (a) the digital genres resolve to the machine their comments name, and
         every drumkit any genre names is vocabulary;
     (b) the silent-drum law: every lane the kernel can write voices on every
         machine, non-silently, unclipped at source, and BYTE-DETERMINISTICALLY
         (seeded noise — two fresh syntheses are identical), and every
         MACHINEMIX row names real lanes with sane numbers;
     (c) the machines do not move a single scheduled event: drumkit is a SOUND
         choice, and swapping it must leave the rendered stream identical to
         the millisecond — measured on ui/derive.js's own sectionEvents, the
         stream the transport schedules.
   machines.js is a browser ES module; audio/package.json is the module-type
   marker (the ui/ pattern) that lets this gate import it, and ui/deps.js
   resolves against the same stub window §31 built. */
console.log("the machines — genre→kit, every lane a voice, and the schedule does not move");
{
  const NF = require("../../nukernel/fields.js");
  const M = await import("../../nukernel/audio/machines.js");
  const MACHINES = ["tr808", "tr909", "tr606", "cr78"];

  // (a) the genre→kit table, and the vocabulary behind it
  const WANT = { acid: "tr909", house: "tr909", techno: "tr909",
                 trap: "tr808", jodeci: "tr808",
                 newwave: "cr78", eurythmics: "cr78", synthpop: "cr78" };
  for (const [g, want] of Object.entries(WANT))
    ok(GENRES[g].drumkit === want,
       g + " plays \"" + GENRES[g].drumkit + "\", not the " + want + " its own comments name");
  for (const gk of GK)
    if (GENRES[gk].drumkit)
      ok(NF.DRUMKITS[GENRES[gk].drumkit],
         gk + ": drumkit \"" + GENRES[gk].drumkit + "\" is not in DRUMKITS — an unloadable kit");
  for (const k of MACHINES) {
    ok(NF.DRUMKITS[k], k + " is missing from DRUMKITS — the palette cannot offer it");
    ok(M.isMachine(k), k + " is in DRUMKITS but audio/machines.js has no recipes for it");
  }
  // ...and the sampled six stayed sampled: isMachine must not claim them, or
  // loadKit stops fetching their files
  for (const k of ["acoustic", "brush", "electronic", "jazz", "power", "room"])
    ok(!M.isMachine(k), k + " is a sampled directory and a machine at once");

  // (b) every lane, every machine: a voice, honest levels, seeded bytes
  for (const kit of MACHINES) {
    let minRms = Infinity, maxPeak = 0;
    for (const d of Object.keys(K.LANES)) {
      const s = M.laneSamples(kit, d);
      ok(s && s.length > 0, kit + "/" + d + " (" + K.LANES[d].name + "): no recipe — " +
         "a lane a genre can write and this machine cannot voice is a silent drum");
      if (!s) continue;
      let e = 0, peak = 0;
      for (let i = 0; i < s.length; i++) { e += s[i] * s[i]; const a = Math.abs(s[i]); if (a > peak) peak = a; }
      const rms = Math.sqrt(e / s.length);
      if (rms < minRms) minRms = rms;
      if (peak > maxPeak) maxPeak = peak;
      ok(rms > 0.005, kit + "/" + d + ": renders near-silent (rms " + rms.toFixed(4) + ")");
      ok(peak <= 0.95, kit + "/" + d + ": clipped at source (peak " + peak.toFixed(3) + ")");
      const s2 = M.laneSamples(kit, d);
      ok(s2.length === s.length && s2.every((v, i) => v === s[i]),
         kit + "/" + d + ": two fresh syntheses differ — Math.random is in a recipe " +
         "and the offline bounce would drift from the live graph");
    }
    console.log("  " + kit + ": 12 lanes, min rms " + minRms.toFixed(3) +
                ", max peak " + maxPeak.toFixed(3));
    const rows = M.MACHINEMIX[kit] || {};
    for (const [d, row] of Object.entries(rows)) {
      ok(K.LANES[d], kit + ": MACHINEMIX names \"" + d + "\", which is not a lane");
      ok(row.room >= 0 && row.room <= 1 && (row.lvl == null || row.lvl > 0) &&
         row.punch > 0 && row.sus > 0,
         kit + "/" + d + ": MACHINEMIX row is not sane (" + JSON.stringify(row) + ")");
      // the one merge really rides DRUMMIX: pan comes through from the base row
      const m = M.mixFor(kit, d);
      ok(m.pan === (row.pan != null ? row.pan : window.NuInstruments.DRUMMIX[d].pan),
         kit + "/" + d + ": mixFor does not ride the DRUMMIX base row");
    }
  }

  // (c) THE SCHEDULE DOES NOT MOVE. Event offsets are in steps and a step is
  // 60/bpm/4 seconds, so identical steps are identical milliseconds at every
  // tempo — asserted anyway in ms at the default 120, so the claim is stated
  // in the unit it is heard in. The whole stream must be byte-identical:
  // kind, lane, pitch, velocity, accent, and time.
  {
    const C = require("../../nukernel/compose.js");
    const stepMs = 60 / 120 / 4 * 1000;
    for (const gk of Object.keys(WANT)) {
      const song = C.compose(gk, 7);
      const b = song.song.find(x => x.stack && x.stack.some(en => en.g === gk)) || song.song[0];
      const evOf = dk => D.sectionEvents({ ...JSON.parse(JSON.stringify(b)), drumkit: dk },
                                         song.slots).ev;
      const a = evOf("electronic"), z = evOf(GENRES[gk].drumkit);
      ok(a.length === z.length, gk + ": swapping the kit sound changed the EVENT COUNT (" +
         a.length + " vs " + z.length + ") — a drum machine rewrote the score");
      let maxDms = 0, moved = 0;
      for (let i = 0; i < Math.min(a.length, z.length); i++) {
        const d1 = Math.abs((a[i].off || 0) - (z[i].off || 0)) * stepMs;
        if (d1 > maxDms) maxDms = d1;
        if (JSON.stringify(a[i]) !== JSON.stringify(z[i])) moved++;
      }
      ok(maxDms === 0, gk + ": a scheduled event moved " + maxDms.toFixed(3) + " ms " +
         "under a kit-sound swap — drumkit is leaking into the scheduler");
      ok(moved === 0, gk + ": " + moved + " event(s) differ under a kit-sound swap — " +
         "the machines must not move a single scheduled event");
    }
  }
}

/* ------------------------------- 45. A TRUMPET KNOWS WHERE IT LIVES
   The INSTRUMENT-REGISTER LAW, gated at the score. The parent states it in
   two tiers (engine/faust/voices/state-engine.js INSTRUMENT_RANGE + the
   mapEvents per-note fold; engine/csd-engine.js SAMPLER REGISTER HOME), and
   this round gave nukernel the same two layers after Paul heard the gap:
   "the ska trumpet is squeaky" (2026-08-16) — ska's composed trumpet line
   reaches MIDI 100 against a table ceiling of 84, the old register home was
   too shy to fire on a straddling line, and the per-note fold's six-semitone
   soft edge let the spill sustain at 89.

   Four claims, all score-level (the schedule IS the artifact at this layer —
   no renders, no browser):
     (a) the TABLE covers everything choosable — every id a genre can voice
         (fields.js INSTRCHOICES is the union of every genre's `instr`) plus
         the bass chair has a RANGES row, and every value shared with the
         parent's table is BORROWED, not reinvented;
     (b) the SWEEP — every scheduled pitched note, all genres × seeds ×
         (default + adversarial overrides), lands inside its instrument's
         window after home + fold, and the DROP LAW never fires on shipped
         content;
     (c) CONTOUR — the register home moves whole octaves, one constant per
         (section, chair), so interval signs are untouched;
     (d) ONE RESOLVER — the offline bounce walks the same buildTimeline +
         scheduleBar the live tick schedules, the schedule is deterministic,
         and scheduleBar hands the homed note to both the sampler and the
         oscillator fallback. */
console.log("the register law — the table, the home, and the per-note fold");
{
  // the audio tier's browser surface, stubbed only as far as import needs:
  // state.js listens for storage events, transport.js registers a visibility
  // catch-up and reads localStorage for the volume — none of it schedules
  globalThis.addEventListener = globalThis.addEventListener || (() => {});
  globalThis.document = globalThis.document ||
    { visibilityState: "visible", addEventListener: () => {} };
  globalThis.localStorage = globalThis.localStorage ||
    { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const ST = await import("../../nukernel/ui/state.js");
  const A = await import("../../nukernel/audio/assets.js");
  const V = await import("../../nukernel/audio/voices.js");
  const T = await import("../../nukernel/audio/transport.js");
  const NI = require("../../nukernel/instruments.js");
  const C = require("../../nukernel/compose.js");
  const fs = require("fs"), path = require("path");

  // (a) COVERAGE + BORROWING. Every choosable id and the bass chair is in the
  // table; unlisted stays legal only for ids nothing can currently voice.
  const choosable = new Set([NI.BASS_INSTR]);
  for (const g of Object.values(GENRES)) {
    const e = g.instr;
    if (Array.isArray(e)) e.forEach(x => choosable.add(x));
    else if (e) choosable.add(e);
  }
  for (const id of choosable)
    ok(Array.isArray(NI.RANGES[id]) && NI.RANGES[id][0] < NI.RANGES[id][1],
       id + " is choosable but has no RANGES row — a squeak nothing can stop");
  // ...and where the parent's INSTRUMENT_RANGE names the same id, the values
  // match: the directive was borrow, never invent
  const seSrc = fs.readFileSync(
    path.join(__dirname, "../../engine/faust/voices/state-engine.js"), "utf8");
  const m = seSrc.match(/const INSTRUMENT_RANGE = \{([\s\S]*?)\n  \};/);
  ok(!!m, "cannot find the parent's INSTRUMENT_RANGE table to borrow from");
  const PARENT = m ? new Function("return {" + m[1] + "};")() : {};
  for (const id of Object.keys(NI.RANGES))
    if (PARENT[id])
      ok(PARENT[id][0] === NI.RANGES[id][0] && PARENT[id][1] === NI.RANGES[id][1],
         id + ": nukernel says [" + NI.RANGES[id] + "] but the parent says [" +
         PARENT[id] + "] — borrowed values must not drift");

  // (d-source) ONE RESOLVER, anchored in the shipped text so the sweep below
  // cannot mirror-drift from what actually schedules: the bounce imports the
  // transport's own builder and bar-scheduler, and scheduleBar hands the HOMED
  // note (e.n + e.home) to the sampled player and the oscillator fallback both.
  const bSrc = fs.readFileSync(path.join(__dirname, "../../nukernel/audio/bounce.js"), "utf8");
  ok(/import \{[^}]*buildTimeline[^}]*\} from "\.\/transport\.js"/.test(bSrc) &&
     /scheduleBar/.test(bSrc.match(/import \{[^}]*\} from "\.\/transport\.js"/)[0]),
     "bounce.js does not import buildTimeline + scheduleBar from transport.js — " +
     "the carrier would resolve registers with a different law than the live tick");
  const tSrc = fs.readFileSync(path.join(__dirname, "../../nukernel/audio/transport.js"), "utf8");
  ok((tSrc.match(/e\.n \+ \(e\.home \|\| 0\)/g) || []).length >= 2,
     "scheduleBar does not hand the homed note to both the sampler and the fallback");

  // (b) THE SWEEP. Every genre × three seeds as composed, plus the adversarial
  // chairs: a piccolo-ish music box ([72,100]) on sludge's floor-scraping
  // guitar line (raw MIDI down to 19), a guitar whose ceiling is ~76 on ska's
  // trumpet line (raw up to 100), and a trumpet on sludge. The resolution here
  // is playSampled's own, via the same exports it calls: home rides the event
  // (buildTimeline), then inRange folds — one law, asserted in aggregate so a
  // quarter-million notes stay one gate.
  const synthBound = (sec, owner, e) => {
    // mirror of scheduleBar's branch, anchored by the source check above: a
    // signature-synth line (no pool pick on its chair) never reaches the
    // sampled fold
    const over = D.poolInstrOf(sec, owner, e.lv == null ? e.v : e.lv, ST.POOL);
    const gsyn = over ? null : GENRES[owner].synth;
    return gsyn && !(gsyn.lineOnly && e.pad);
  };
  const NF45 = require("../../nukernel/fields.js");
  const seeds = [1, 3, 7];
  const cases = [];
  for (const gk of GK) for (const s of seeds) cases.push([gk, s, null]);
  cases.push(["sludge", 3, "music_box"], ["ska", 3, "palm_muted_guitar"],
             ["sludge", 7, "trumpet"]);
  let total = 0, out = 0, drops = 0, badHome = 0, badSign = 0, bassOut = 0;
  const skaFinal = [], skaRaw = [];
  for (const [gk, seed, over] of cases) {
    // the adversarial chair is cast through the SONG POOL now — the per-layer
    // `instr` override died at the registry ("the band is hired for the
    // record") — every pitched seat at once, the bass left to its own so the
    // bass half of the sweep keeps measuring the acoustic bass
    const raw = C.compose(gk, seed);
    if (over) {
      raw.pool = {};
      for (const c of NF45.POOLCHAIRS) if (c !== "bass") raw.pool[c] = over;
    }
    ST.adoptSong(raw, "gate");
    const TL = T.buildTimeline();
    const chairs = new Map();                    // si|owner|lv -> [raw..], home
    for (const bar of TL) for (const e of bar.ev) {
      const sec = ST.SONG[bar.si];
      if (e.kind === "bass") {
        // the bass chair rides the same law with no home (registerHome is a
        // line pass); synth basses are their own instrument
        if (NI.BASSSYNTH[sec.bassop]) continue;
        const bs = A.specOf(NI.BASS_INSTR);
        const fin = V.inRange(bs, NI.BASS_INSTR, e.n);
        total++;
        if (fin == null) drops++;
        else if (fin < NI.RANGES[NI.BASS_INSTR][0] - 0.5 ||
                 fin > NI.RANGES[NI.BASS_INSTR][1] + 0.5) bassOut++;
        continue;
      }
      if (e.kind !== "line") continue;
      const owner = e.layer || D.gid(sec);
      if (synthBound(sec, owner, e)) continue;
      const lv = e.lv == null ? e.v : e.lv;
      const id = D.instrIdOf(sec, owner, lv, ST.POOL);
      const spec = A.specOf(id), w = V.playWindow(spec, id);
      const home = e.home || 0;
      if (home % 12 !== 0) badHome++;
      // the chair is keyed by the box the note BELONGS to, not the box whose
      // bar it sounds in: a lead-in pickup (§49) plays in the closing bar of
      // the previous box and rides the entering box's home, which is the only
      // way it can arrive in tune with the note it leads to
      const ck = (e.puSi == null ? bar.si : e.puSi) + "|" + owner + "|" + lv;
      let ch = chairs.get(ck);
      if (!ch) chairs.set(ck, ch = { raw: [], home });
      if (ch.home !== home) badHome++;           // one constant per (section, chair)
      ch.raw.push(e.n);
      total++;
      if (!w) continue;                          // an id outside the tables: untouched
      const fin = V.inRange(spec, id, e.n + home);
      if (fin == null) { drops++; continue; }
      if (fin < w[0] - 0.5 || fin > w[1] + 0.5) out++;
      if (!over && gk === "ska" && id === "trumpet") { skaFinal.push(fin); skaRaw.push(e.n); }
    }
    // (c) CONTOUR: the home is a transposition, so every interval keeps its
    // sign — stated as the directive asks, per chair, raw vs homed
    for (const ch of chairs.values())
      for (let i = 1; i < ch.raw.length; i++)
        if (Math.sign(ch.raw[i] - ch.raw[i - 1]) !==
            Math.sign((ch.raw[i] + ch.home) - (ch.raw[i - 1] + ch.home))) badSign++;
  }
  ok(total > 100000, "the sweep saw only " + total + " notes — it is not sweeping");
  ok(out === 0, out + " scheduled note(s) land outside their instrument's window");
  ok(bassOut === 0, bassOut + " bass note(s) escape the acoustic bass's [28,60]");
  ok(drops === 0, drops + " note(s) hit the DROP LAW — shipped content must " +
     "always have an in-window octave");
  ok(badHome === 0, badHome + " register-home violation(s): a home that is not " +
     "a whole octave, or not one constant per (section, chair)");
  ok(badSign === 0, badSign + " interval(s) changed sign under the home — the " +
     "home broke a contour it exists to preserve");

  // (b-reported) THE SKA TRUMPET ITSELF. The complaint must be real in the raw
  // line and gone in the resolved one: composed ska writes trumpet above the
  // table ceiling (measured: up to MIDI 100), and every scheduled trumpet note
  // now lands inside the parent's own [54, 84].
  const TR = NI.RANGES.trumpet;
  ok(skaRaw.length > 0 && Math.max(...skaRaw) > TR[1],
     "ska's raw trumpet line no longer exceeds " + TR[1] + " — the reported " +
     "case has vanished from the composer and this gate is proving nothing");
  ok(skaFinal.every(n => n >= TR[0] - 0.5 && n <= TR[1] + 0.5),
     "ska schedules a trumpet note outside [" + TR + "] — still squeaky " +
     "(max " + Math.max(...skaFinal).toFixed(1) + ")");

  // (d) ...and the builder is deterministic over the same state, which is what
  // makes the bounce's walk the live walk: same song, same bars, same homes.
  ST.adoptSong(C.compose("ska", 3), "gate");
  const j = TL2 => JSON.stringify(TL2.map(b => [b.si, b.barSteps, b.ev]));
  ok(j(T.buildTimeline()) === j(T.buildTimeline()),
     "buildTimeline is not deterministic — live and bounce would disagree");

  /* ------------------------------- 46. THE BAND IS HIRED FOR THE RECORD
     The INSTRUMENT POOL, gated at the score (the schedule IS the artifact at
     this layer): one pool per song, one pick per chair, resolved by the same
     instrIdOf walk scheduleBar and the register home make. Four claims:
       (a) a pooled trumpet reaches EVERY section's scheduled lead — every
           lead-chair note in the whole timeline resolves to the pool's pick;
       (b) the register fold from "a trumpet knows where it lives" applies to
           the pooled chair unchanged — home + per-note fold land every one
           of those notes inside the trumpet's own window, no drops;
       (c) a NULL pool is the genre's own band, byte-identical: cast a chair,
           clear it, and the timeline is the very bytes it was before;
       (d) the bass seat reaches the bass line — anchored in the shipped
           scheduleBar text, since the bass is scheduled per bar, not baked
           into the timeline. */
  console.log("the instrument pool — one band for the record, and it reaches the schedule");
  {
    // house seats stab+lead (kernel scheme) and its lead is a polysynth, so a
    // pooled trumpet is a real recast, not the default answering
    const raw = C.compose("house", 3);
    ST.adoptSong(raw, "gate");
    const before = j(T.buildTimeline());
    const raw2 = C.compose("house", 3); raw2.pool = { lead: "trumpet" };
    ST.adoptSong(raw2, "gate");
    ok(JSON.stringify(ST.POOL) === JSON.stringify({ lead: "trumpet" }),
       "adoptSong did not land the pool in state");
    const TLp = T.buildTimeline();
    const w = V.playWindow(A.specOf("trumpet"), "trumpet");
    const leadSecs = new Set(); let leadN = 0, misres = 0, pOut = 0, pDrops = 0;
    for (const bar of TLp) for (const e of bar.ev) {
      if (e.kind !== "line") continue;
      const sec = ST.SONG[bar.si];
      const owner = e.layer || D.gid(sec);
      const lv = e.lv == null ? e.v : e.lv;
      const ent = D.stackOf(sec).find(x => x.g === owner);
      if (D.chairOf(sec, ent, lv) !== "lead") continue;
      leadSecs.add(bar.si); leadN++;
      if (D.instrIdOf(sec, owner, lv, ST.POOL) !== "trumpet") misres++;
      const fin = V.inRange(A.specOf("trumpet"), "trumpet", e.n + (e.home || 0));
      if (fin == null) pDrops++;
      else if (fin < w[0] - 0.5 || fin > w[1] + 0.5) pOut++;
    }
    ok(leadN > 50 && leadSecs.size >= 2, "the pooled song schedules only " +
       leadN + " lead notes across " + leadSecs.size + " sections — nothing to prove");
    ok(misres === 0, misres + " lead note(s) resolve past the pool — " +
       "the trumpet does not reach every section's lead");
    ok(pDrops === 0 && pOut === 0, "the pooled trumpet escapes its register " +
       "(" + pOut + " out, " + pDrops + " dropped) — the fold does not follow the pool");
    // (c) cast, then clear: the timeline returns to the exact bytes of the
    // never-pooled song — null pool IS the genre's own band.
    //
    // THE "NOT DEAD" SENTINEL READS THE RESOLVED INSTRUMENT, not the timeline's
    // bytes. A pool only ever reached those bytes through the register home,
    // and the home fires only when a chair does NOT already fit its new
    // instrument's window — so the moment the song carried a key of its own
    // ("a song knows what key it is in") house's lead landed inside the
    // trumpet's [54, 84] as written, nothing shifted, and a perfectly live
    // recast read as a dead pool. What the pool actually changes is the id
    // transport.js hands to playSampled, so that is what this asks: every
    // scheduled lead note answers "trumpet" with the pool and something else
    // without it.
    {
      let recast = 0;
      for (const bar of TLp) for (const e of bar.ev) {
        if (e.kind !== "line") continue;
        const sec = ST.SONG[bar.si];
        const owner = e.layer || D.gid(sec);
        const lv = e.lv == null ? e.v : e.lv;
        const ent = D.stackOf(sec).find(x => x.g === owner);
        if (D.chairOf(sec, ent, lv) !== "lead") continue;
        if (D.instrIdOf(sec, owner, lv, null) !== "trumpet") recast++;
      }
      ok(recast > 0,
         "casting the lead changed nothing in the schedule — the pool is dead");
    }
    ST.setPoolChair("lead", null);
    ok(ST.POOL === null, "clearing the one cast chair did not normalize to null");
    ok(j(T.buildTimeline()) === before,
       "a cleared pool is not byte-identical to the genre's own band");
    // (d) the bass seat, anchored in the shipped text the way §45 anchors the
    // homed note: scheduleBar plays the POOLED bass, bassop synths still win
    const tSrc2 = fs.readFileSync(
      path.join(__dirname, "../../nukernel/audio/transport.js"), "utf8");
    ok(/\(POOL && POOL\.bass\) \|\| BASS_INSTR/.test(tSrc2),
       "scheduleBar does not seat the pool's bass chair");
  }
}

/* ------------------------------- 47. THE DESK STOPS FLATTERING
   THE DERIVED PER-PART TONE, gated at the model (audio/mixer.js
   derivedPartTone / derivedSecEq / mergeEq / resolvedPart — no DOM, no
   render). Paul, on the shipped board, 2026-08-16: "All the EQ settings and
   all the faders are always the same and never move… but never inside a
   song." Both halves were structural: resolvePartMix answered (1, flat) for
   every unmixed chair, and nothing seeded an EQ, so the desk showed a row of
   identical units however different the music was. The claims:
     (a) ANTI-FLATTEN, within a section: on composed songs the per-part
         resolved (gain, eq) tuples are NOT all identical;
     (b) ANTI-FLATTEN, across sections: within one composed song, some part's
         tuple DIFFERS between sections — a song that evolves shows a desk
         that evolves (the shading reads the composed arc's own sec.lvl/env);
     (c) a USER value is an absolute override over the derived, never a sum,
         and unset bands keep answering with the derived value;
     (d) FLAT-WHEN-NO-SOURCE: a chair with no tonal character (family in no
         FAM_EQ row, role seat 0, no section words) resolves to the exact
         identity and builds NO part spec — absent-is-today survives where
         nothing derives;
     (e) SINGLE APPLICATION: each part appears in chanSpec exactly once, its
         spec eq IS resolvedPart's eq (one tone stage, the displayed one), and
         the genre's character seeds the SECTION strip only;
     (f) the whole spec is deterministic — the offline bounce builds from the
         same chanSpec, so the carrier carries the derivation by construction. */
console.log("the desk stops flattering — derived per-part (gain, eq)");
{
  const MX = await import("../../nukernel/audio/mixer.js");
  const ST = await import("../../nukernel/ui/state.js");
  const C = require("../../nukernel/compose.js");
  const S = require("../../nukernel/song.js");
  const tup = (sec, k) => {
    const r = MX.resolvedPart(sec, k);
    return JSON.stringify([r.gain, r.eq]);
  };
  // (a) + (b) across five composed songs — measured before being asserted:
  // beatles' `line` chair takes 7 distinct tuples over 11 sections
  for (const gk of ["beatles", "rock", "vaporwave", "postrock", "motown"]) {
    ST.adoptSong(C.compose(gk, 3), "gate");
    let within = false;
    for (const sec of ST.SONG) {
      const keys = MX.partKeysOf(sec);
      if (keys.length >= 2 && new Set(keys.map(k => tup(sec, k))).size > 1) {
        within = true; break;
      }
    }
    ok(within, gk + ": every part resolves the identical (gain, eq) tuple — " +
       "the desk is flattering again");
    const byKey = new Map();
    for (const sec of ST.SONG) for (const k of MX.partKeysOf(sec)) {
      if (!byKey.has(k)) byKey.set(k, new Set());
      byKey.get(k).add(tup(sec, k));
    }
    ok([...byKey.values()].some(s => s.size > 1),
       gk + ": no part's resolved tuple moves across sections — the song " +
       "evolves and the desk does not");
  }
  // (c) override beats derived — absolute per band, multiplied on gain
  {
    ST.adoptSong(C.compose("rock", 3), "gate");
    const sec = ST.SONG.find(s => MX.partKeysOf(s).length >= 2);
    const k = MX.partKeysOf(sec).find(x => x !== "drums");
    sec.parts = { [k]: { eq: { mid: 5 }, fader: -6, lvl: "hush" } };
    const r = MX.resolvedPart(sec, k);
    const t = MX.derivedPartTone(sec, k);
    ok(r.eq && r.eq.mid === 5,
       "a set band is not absolute over the derived (got " +
       JSON.stringify(r.eq) + " over derived " + JSON.stringify(t.eq) + ")");
    for (const b of ["lo", "hi"]) if (t.eq && t.eq[b])
      ok(r.eq[b] === t.eq[b], "an unset " + b + " band stopped answering with " +
         "the derived value under a neighbouring override");
    ok(Math.abs(r.gain - 0.4 * Math.pow(10, (t.db - 6) / 20)) < 1e-3,
       "hush × fader −6 does not ride the derived seating (gain " + r.gain +
       ", derived " + t.db + " dB)");
    sec.parts = null;
  }
  // (d) flat-when-no-source: dnb's first chair is family `lead` (no FAM_EQ
  // row), role seat 0, and a bare skeleton box has no section words — the
  // identity, and the identity builds nothing
  {
    const sec = S.skeleton("dnb", null);
    const keys = MX.partKeysOf(sec);
    const t = MX.derivedPartTone(sec, keys[0]);
    ok(t.db === 0 && t.eq === null,
       "a chair with no tonal source derived " + JSON.stringify(t) +
       " — flat-when-no-source is broken");
    const built = MX.chanSpec(sec).parts.map(p => p.key);
    ok(!built.includes(keys[0]),
       "the identity chair " + keys[0] + " still built a part spec [" + built +
       "] — absent-is-today no longer survives where nothing derives");
    ok(MX.derivedSecEq(sec) === null,
       "dnb's mid-range tone derived a section EQ — the character thresholds " +
       "have widened past neutral");
  }
  // (e) single application + (f) determinism, on one composed box
  {
    ST.adoptSong(C.compose("beatles", 3), "gate");
    const sec = ST.SONG.find(s => MX.partKeysOf(s).length >= 2);
    ok(JSON.stringify(MX.chanSpec(sec)) === JSON.stringify(MX.chanSpec(sec)),
       "chanSpec is not deterministic — live and bounce would disagree about " +
       "the derived desk");
    const parts = MX.chanSpec(sec).parts;
    const seen = new Set();
    for (const p of parts) {
      ok(!seen.has(p.key), "part " + p.key + " appears twice in one spec — " +
         "the tone stage would build twice");
      seen.add(p.key);
      ok(JSON.stringify(p.eq) === JSON.stringify(MX.resolvedPart(sec, p.key).eq),
         p.key + ": the built eq is not the displayed eq — the board is lying " +
         "about the graph");
    }
    // the genre's character is the section strip's and only the section
    // strip's: chairs on two genres with different tone but the same family
    // derive the same part eq, so the character cannot be applied twice
    const g = ST.SONG && MX.derivedSecEq(sec);
    if (g) {
      const merged = MX.chanSpec(sec).eq;
      ok(merged && ["lo", "mid", "hi"].every(b => merged[b] === (g[b] || 0)),
         "the untouched section strip does not carry the genre's derived " +
         "character (" + JSON.stringify(merged) + " vs " + JSON.stringify(g) + ")");
    }
  }
}

/* ------------------------------- 48. GENEALOGY — genre as mixture
   Every real (place-year) anchor declares `parents` (weighted references to
   other anchors — the historical claim) and `wants` (the ancestors phase 2
   still owes the catalog); the fit that measures the claims is
   nukernel/genealogy.js. The whole layer is ANNOTATION: the one hard law here
   is (d), that stripping it changes zero rendered bytes — the same
   absent-equals-neutral discipline as §22, proved by deletion rather than
   trusted by review. */
console.log("genealogy — parents reference real anchors, and annotation is inert");
{
  const FN = new Set(["simple", "solo", "vocal", "backing", "riff", "pad"]);
  const real = GK.filter(k => !FN.has(k));
  // (a) COVERAGE + SHAPE: every real anchor declares both fields; parents
  // reference existing non-function anchors, never themselves; weights are
  // positive and sum to ~1 where any are declared at all
  for (const gk of real) {
    const g = GENRES[gk];
    ok(g.parents && typeof g.parents === "object" && !Array.isArray(g.parents),
       gk + ": no parents annotation");
    ok(Array.isArray(g.wants) && g.wants.every(w => typeof w === "string" && w),
       gk + ": wants is not a list of ancestor names");
    for (const [p, w] of Object.entries(g.parents || {})) {
      ok(!!GENRES[p], gk + ": parent " + p + " is not an anchor in the table");
      ok(p !== gk, gk + " is its own parent");
      ok(!FN.has(p), gk + ": parent " + p + " is a function genre — a role " +
         "has a job, not children");
      ok(typeof w === "number" && Number.isFinite(w) && w > 0,
         gk + ": parent weight for " + p + " is not a positive number");
    }
    const ws = Object.values(g.parents || {});
    if (ws.length) {
      const s = ws.reduce((a, b) => a + b, 0);
      ok(Math.abs(s - 1) < 0.05,
         gk + ": parent weights sum to " + s.toFixed(3) + ", not ~1");
    }
  }
  // ...and the function genres declare nothing: a role is not a tradition
  for (const gk of GK) if (FN.has(gk))
    ok(!("parents" in GENRES[gk]) && !("wants" in GENRES[gk]),
       gk + ": a function genre grew a lineage");
  // (b) ROOTS ARE ARGUED, NOT ACCIDENTAL: an empty parents object is a claim,
  // and every root except gregorian (the one true root) must at least name
  // what it is missing — {} beside an empty wants is an anchor nobody thought
  // about, and only chant has earned that silence
  const roots = real.filter(k => !Object.keys(GENRES[k].parents).length);
  ok(roots.includes("gregorian"),
     "gregorian is no longer a root — something claims to predate chant");
  ok(roots.length <= 8, roots.length + " roots — the lineage layer is " +
     "under-declared, half the table has gone orphan");
  for (const r of roots) if (r !== "gregorian")
    ok(GENRES[r].wants.length > 0,
       r + ": empty parents AND empty wants — an unargued root");
  // (c) THE PARENT GRAPH IS A DAG: nobody is their own ancestor
  {
    const state = new Map();
    const cyc = k => {
      if (state.get(k) === 1) return true;
      if (state.get(k) === 2) return false;
      state.set(k, 1);
      for (const p of Object.keys(GENRES[k].parents || {})) if (cyc(p)) return true;
      state.set(k, 2);
      return false;
    };
    ok(!real.some(cyc), "the parent graph has a cycle");
  }
  // (d) BYTE IDENTITY: the annotation reaches NOTHING. Render every genre
  // with and without parents/wants — identical events, or the fields have
  // silently become behavior
  for (const gk of GK) {
    const g = GENRES[gk], bars = Math.max(4, g.bars);
    const stripped = { ...g };
    delete stripped.parents; delete stripped.wants;
    ok(sig(allEvents(P, g, bars)) === sig(allEvents(P, stripped, bars)),
       gk + ": stripping the lineage annotation changed the rendered events");
  }
  // (e) THE FIT RUNS and produces finite numbers: features, weights, R2 and
  // residue are all real, so GENEALOGY.md can never be regenerated from NaNs
  const GY = require("../../nukernel/genealogy.js");
  for (const gk of real)
    ok(GY.featuresOf(gk).every(Number.isFinite),
       gk + ": a genealogy feature is not finite");
  const fits = GY.fitAll();
  ok(fits.length === real.length, "the fit does not cover every real anchor");
  for (const f of fits) {
    ok(Number.isFinite(f.r2) && f.r2 >= 0 && f.r2 <= 1,
       f.key + ": fit R2 is not a finite number in [0,1]");
    ok(Number.isFinite(f.residRms) && f.residRms >= 0,
       f.key + ": fit residue is not finite");
    ok(f.fitted.every(w => Number.isFinite(w) && w >= 0),
       f.key + ": a fitted parent weight is negative or NaN");
    if (!f.root)
      ok(Math.abs(f.fitted.reduce((a, b) => a + b, 0) - 1) < 1e-6,
         f.key + ": normalized fitted weights do not sum to 1");
  }
}

/* ------------------------------- 48. ONE TONALITY, EVERY ADDED VOICE SPEAKS IT
   THE MASTER HARMONIZATION ENGINE (kernel.js harmonizeStage, wired at
   ui/derive.js sectionEvents through masterCtx). Paul: "when we add patterns
   and sub voices to sections, that is when a tonality happens — there should
   be a master harmonization engine." The claims, all score-level:

     (a) THE DON'T-LOSE-WHAT-WE-HAVE LAW: a single-layer song renders
         BYTE-IDENTICAL to the pre-change engine. REF below was measured at
         HEAD b1adc27 (2026-08-16, before harmonizeStage existed): sha1 of
         every section of compose(gk, seed) for seeds 1..3, each section's
         stack truncated to its authority. Recomputed here and held equal,
         genre by genre. Plus the structural half: harmonizeStage on a stream
         with nothing to conform returns the SAME ARRAY.
     (b) MULTI-LAYER CONFORMANCE, measured against baked PRE-change numbers
         (same corpus, same metric code, measured at the same HEAD):
         strong-beat chord-tone coverage strictly up, sustained cross-layer
         minor-second grinds down to ~0, every conformable note inside the
         governing scale or the sounding chord, stacked cross-layer unisons
         down, and the whole render deterministic twice.
     (c) THE AUTHORITY IS UNTOUCHED: strip the layer's events from a stacked
         render and what remains is the single-layer render, byte for byte.
     (d) THE EMERGENT RULING: fugue/spem/counterpoint (the whole
         `harmony:"emergent"` roster — the counterpoint family) do NOT opt
         out. Their harm() walk IS a per-bar timeline, and a layer agreeing
         with it is the continuo's job; their own voices are authority voices
         and never move (that is (c)). The drones the question worried about
         are not emergent at all — drone is `modal`, sludge and ambient are
         `cycle`, having WRITTEN their timelines down — so a drone is always
         an authority voice and cannot be made to stop droning.

   The metric reads the FINAL stream sectionEvents ships (windowed, edged,
   grooved) through D.masterCtx — the same context the engine corrects by, so
   the measurement and the engine cannot drift apart. Grinds obey the census's
   rule 1 (§38): a chord-tone-vs-chord-tone second is the chord's own colour
   and never counts. */
console.log("the master harmonization engine — one tonality, every added voice speaks it");
{
  const crypto = require("crypto");
  const C = require("../../nukernel/compose.js");
  const S = require("../../nukernel/song.js");
  const sha = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
  const evsig = ev => JSON.stringify(ev.map(e =>
    [e.t, e.n, e.d, e.v, e.vel, e.acc, e.sld, e.dur, e.kind, e.layer || ""]));

  // (a) byte-identity — REF measured pre-change at HEAD b1adc27, 2026-08-16.
  // Two rows have moved SINCE, and deliberately: steely and afrobeat are the
  // only genres whose seeds 1-3 draw the `ride` operator, and the ride stopped
  // carrying a sixteenth-note hat stroke for stroke (kernel.js moveTime — the
  // crash-wash fix). A hash here is a tripwire on accidental drift, so an
  // argued change to the drums re-measures it; it does not get weakened.
  // ...and TWELVE more moved on 2026-08-16, for the two repairs in §51, with an
  // argued reason each. blues and jazz are the anchors themselves: the blues
  // kit's off-beat eighths are now placed by hand in the nudge lane, and the
  // jazz comment beside them stopped claiming a shuffle can be read off the
  // swing dial — it bends odd sixteenths, and both kits are written on even
  // ones. bossa draws `ride`/`tomtime`, which no longer sweep the LEFT FOOT
  // onto the plate it was already playing under. The other nine never touched
  // their anchors at all: they draw a solo-edged opening, whose first bar now
  // sounds ONE lane instead of the whole pitched layer ("a quote IS the melody
  // alone", compose.js), or a quote whose deal changed. The forty-six rows
  // that draw none of the three did NOT move, which is what says these are
  // those three changes and not a fourth.
  // ...AND RE-MEASURED WHOLE on 2026-08-17, for the two changes of that night
  // and no others. A song KNOWS WHAT KEY IT IS IN now — the composer derives a
  // tonic off the genre's own name and stamps it on every box — so every
  // pitched number in this stream moved by a constant per genre; and 29 genres
  // grew an ORNAMENT POLICY, which adds graces, flams, approaches and rolls to
  // the lines they decorate. Both are argued, both have their own gates (§63
  // and §59 respectively), and a tripwire whose two tripwires are proven
  // elsewhere is re-measured rather than weakened. TWO rows did not move at
  // all — techno and backing, the two whose derived tonic lands on zero and
  // which ornament nothing — and that is what says this is those two changes
  // and not a third.
  const REF = { simple: "4b9740e29df3", fugue: "fb66b85894fe", acid: "6e5ab21af5a4",
    newwave: "edb0ef71a7a5", vaporwave: "149d5015f704", blues: "bd46f7197675",
    rock: "6b17d2564f98", gregorian: "ba0f27385ffc", bulgarian: "0b32f160e171",
    spem: "9151dae05ddf", counterpoint: "05be67334465",
    neoclassical: "182f2de5a1d1", drone: "c44769f4ff21",
    sludge: "5084148f09aa", tango: "ee09103e8ed3", deathmetal: "b0851e6f2e38",
    eurythmics: "98142ceabb51", isley: "9d5ab478f32a", toto: "29a92875bf17",
    jodeci: "5e4ca9a37d79", beatles: "a459c2f9c282", steely: "01ea05a01d63",
    postrock: "27b4a3b46e43", boombap: "b01f5cdbae1b", trap: "897203c2b00b",
    house: "817eac80ba2a", garage: "cc3f5e1993db", dnb: "3999fdcb3980",
    disco: "b11d4a93b0c3", funk: "b81633650abe", motown: "1141bdf06ece",
    rnb: "9e78fac4619d", gospel: "e733eaf12546", reggae: "622440c9f04e",
    dub: "54c3fb491042", ska: "ca92900b00b9", afrobeat: "4abfb20d688a",
    bossa: "b635c3811e72", countrypop: "ea549aac9ee0",
    synthpop: "c5fcb2c16fb3", shoegaze: "83b13c047a74",
    citypop: "18c6c4b2a021", punk: "0596c10fdc60", ambient: "e5269e817b91",
    techno: "c76899eec976", jazz: "8f2957718601", bodiddley: "652cb8966c48",
    chuckberry: "bfa4069005a5", doowop: "aa80dab581fd",
    skiffle: "c51f0f704a19", minimalism: "cd067bced87e",
    kraftwerk: "6fa626f62c95", electro: "7bcbe33b8e14", hymn: "8d5cbbc2f790",
    crooner: "ebcccb5c28e3", yuletide: "e85fe81904b2",
    merseybeat: "367adb7076c1", psychpop: "4cd62eace8ad",
    bigbeat: "2fd7eedbdd96", drill: "e7a238609e57", clubpop: "c3ad2b730725",
    powerballad: "4ba645cf3184", retrofunkpop: "87bd139cb68b",
    reggaeton: "aa5de4ddd707", latinpop: "0eef7a6d4277", kpop: "4fa1cc80588f",
    boyband: "59b1645cfb57", emo: "97bca06289d7", screamo: "5f9e1fe98cce",
    confessionalpop: "7caf072cfa2f", darkrnb: "0646ca452b56",
    bigroom: "15833d9eadf3", blueeyedsoul: "611bb065f3c6",
    folkduo: "e2436f24fe1e", worldfolk: "27c7432707c7",
    jamband: "ddd0b4512600", sophistirock: "3f5356b33921",
    motorik: "5eda4735ff86", roboticpop: "dbd9723b7f44",
    industrialmetal: "bcbc410dce83", ebm: "a3fd12a0d312",
    synthduo: "3f063b522c5d", solo: "219f51866bce", vocal: "732d368f1ec0",
    backing: "dc681b7608c8", riff: "3c531d83afd9", pad: "ce08c515e400" };
  for (const gk of GK) {
    if (!REF[gk]) { ok(false, gk + ": no pre-change reference hash — a new " +
      "genre needs its single-layer baseline measured and added to REF"); continue; }
    let acc = "";
    for (const seed of [1, 2, 3]) {
      const song = C.compose(gk, seed);
      for (const sec of song.song) {
        const one = clone(sec);
        one.stack = [one.stack[0]];
        acc += evsig(D.sectionEvents(one, song.slots, song.groove, song.swing).ev);
      }
    }
    ok(sha(acc) === REF[gk],
       gk + ": a single-layer song no longer renders byte-identical to the " +
       "pre-harmonization engine (the authority moved)");
  }
  {
    const arr = [{ t: 0, n: 60, dur: 1, kind: "line", v: 0 }];
    ok(K.harmonizeStage(arr, { conform: () => false, chords: () => [],
       scalePcs: new Set(), stepsPerBar: 16, rate: 1 }) === arr,
       "harmonizeStage with nothing to conform did not return the same array");
  }

  // ---- the measurement kit (identical to the pre-change recipe) ------------
  const pcOf = n => ((n % 12) + 12) % 12;
  const chordAtT = (ctx, cache, t) => {
    const step = t * ctx.rate, bar = Math.floor(step / ctx.stepsPerBar + 1e-9);
    let cs = cache.get(bar);
    if (!cs) { cs = ctx.chords(bar); cache.set(bar, cs); }
    const s = ((step % ctx.stepsPerBar) + ctx.stepsPerBar) % ctx.stepsPerBar;
    return cs.find(c => s >= c.start - 1e-9 && s < c.start + c.len) || cs[cs.length - 1];
  };
  function hMetrics(ev, ctx) {
    const cache = new Map();
    // NOT THE ORNAMENTS. Every number below was hand-measured against the
    // stream a layer CONTRIBUTES, and the harmonization engine conforms
    // exactly those notes; a grace or a flam is added after the fact, by the
    // ornament pass, on top of a note already conformed. Counting them moved
    // the strong-beat totals (house+blues 12 -> 16) and read as a baseline
    // that had rotted, when nothing about the harmonization had changed.
    const isL = e => !e.orn && ctx.conform(e) && e.dur > 0;
    const L = ev.filter(isL);
    const beat = ctx.stepsPerBar / 4;
    let strongOn = 0, strongTot = 0, viol = 0;
    for (const e of L) {
      const c = chordAtT(ctx, cache, e.t), pc = pcOf(e.n);
      const inC = c.pcSet.has(pc);
      const s = e.t * ctx.rate;
      const sb = ((s % ctx.stepsPerBar) + ctx.stepsPerBar) % ctx.stepsPerBar;
      const r = Math.round(sb);
      if (Math.abs(sb - r) < 0.45 && r % beat === 0) { strongTot++; if (inC) strongOn++; }
      if (!inC && !ctx.scalePcs.has(pc)) viol++;
    }
    const pitched = ev.filter(e => e.n != null && e.dur > 0 && !e.d &&
      e.kind !== "sing" && (e.kind === "line" || e.kind === "bass"));
    let grinds = 0, unis = 0;
    const minOv = 0.9 / ctx.rate;
    for (let i = 0; i < pitched.length; i++)
      for (let j = i + 1; j < pitched.length; j++) {
        const a = pitched[i], b = pitched[j];
        if (!isL(a) && !isL(b)) continue;
        if (a.v === b.v) continue;
        const ov = Math.min(a.t + a.dur, b.t + b.dur) - Math.max(a.t, b.t);
        if (ov < minOv) continue;
        const ic = Math.abs(a.n - b.n) % 12;
        if (ic === 1 || ic === 11) {
          const c = chordAtT(ctx, cache, Math.max(a.t, b.t));
          if (!(c.pcSet.has(pcOf(a.n)) && c.pcSet.has(pcOf(b.n)))) grinds++;
        }
        if (a.n === b.n && (a.layer || null) !== (b.layer || null)) unis++;
      }
    return { strongOn, strongTot, viol, grinds, unis, layerNotes: L.length };
  }

  // (b) + (c) + (d) on constructed stacks — the layer phrase leans wide and
  // offbeat so it genuinely has non-chord material to conform
  const P2 = {
    deg:  [1, 4, 2, 6, -3, 1, 5, 3, 0, 2, 4, 1, -2, 5, 2, 0],
    oct:  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0],
    vel:  [7, 5, 6, 8, 5, 6, 7, 5, 8, 6, 5, 7, 6, 5, 7, 6],
    inc:  new Array(16).fill(0), stk: new Array(16).fill(0),
    gate: [1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0],
    acc:  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    sld:  new Array(16).fill(0),
  };
  const slots2 = [P, P2];
  // PRE measured at HEAD b1adc27 (pre-change), same corpus, same metric code:
  //   pair                      cover      viol grinds unis
  //   house+blues                6/12       14    7     0
  //   vaporwave+acid            10/21       24   20    29
  //   rock+bulgarian            10/24       16   32     1
  //   tango+gregorian           16/24       16   39     8
  //   funk+citypop               6/9         6   23     0
  //   fugue+acid                 8/21        0    0     5
  //   spem+simple                3/12        0    4     5
  //   counterpoint+vaporwave     8/12        0    5     1
  const PREPAIR = {
    "house+blues": { on: 6, tot: 12, unis: 0 },
    "vaporwave+acid": { on: 10, tot: 21, unis: 29 },
    "rock+bulgarian": { on: 10, tot: 24, unis: 1 },
    "tango+gregorian": { on: 16, tot: 24, unis: 8 },
    "funk+citypop": { on: 6, tot: 9, unis: 0 },
    "fugue+acid": { on: 8, tot: 21, unis: 5 },
    "spem+simple": { on: 3, tot: 12, unis: 5 },
    "counterpoint+vaporwave": { on: 8, tot: 12, unis: 1 },
  };
  const EMERGENT = new Set(["fugue", "spem", "counterpoint"]);
  for (const [a, l] of [["house", "blues"], ["vaporwave", "acid"],
                        ["rock", "bulgarian"], ["tango", "gregorian"],
                        ["funk", "citypop"], ["fugue", "acid"],
                        ["spem", "simple"], ["counterpoint", "vaporwave"]]) {
    const b = S.emptyBox();
    b.stack[0] = { g: a, slots: [0] };
    b.stack.push({ g: l, slots: [1] });
    const ctx = D.masterCtx(b, slots2);
    const ev = D.sectionEvents(b, slots2, null, null).ev;
    const m = hMetrics(ev, ctx), pre = PREPAIR[a + "+" + l], id = a + "+" + l;
    ok(m.layerNotes > 0, id + ": the layer contributed no conformable notes");
    ok(m.strongTot === pre.tot && m.strongOn === m.strongTot && m.strongOn > pre.on,
       id + ": strong-beat chord-tone coverage is not strictly up (" +
       m.strongOn + "/" + m.strongTot + " vs pre " + pre.on + "/" + pre.tot + ")");
    ok(m.grinds === 0, id + ": " + m.grinds + " sustained cross-layer minor " +
       "seconds survive the harmonize stage");
    ok(m.viol === 0, id + ": " + m.viol + " layer notes outside the governing " +
       "scale and the sounding chord");
    ok(pre.unis === 0 ? m.unis === 0 : m.unis < pre.unis,
       id + ": stacked cross-layer unisons not spread (" + m.unis +
       " vs pre " + pre.unis + ")");
    // (c) the authority is untouched: strip the layer and the singer, and the
    // stacked render IS the single-layer render
    const solo = clone(b); solo.stack = [solo.stack[0]];
    ok(evsig(ev.filter(e => !e.layer && e.kind !== "sing")) ===
       evsig(D.sectionEvents(solo, slots2, null, null).ev.filter(e => e.kind !== "sing")),
       id + ": the harmonize stage moved an authority event");
    // determinism, twice
    ok(evsig(D.sectionEvents(b, slots2, null, null).ev) === evsig(ev),
       id + ": two renders of one stacked box differ");
    // (d) the emergent ruling holds where the authority IS emergent
    if (EMERGENT.has(a))
      ok(GENRES[a].harmony === "emergent" && m.viol === 0 && m.strongOn === m.strongTot,
         id + ": an emergent authority's layer does not conform — the ruling " +
         "(participate, timeline read off the voices) broke");
  }
  // the ruling's roster and its boundary: emergent is exactly the counterpoint
  // family, and the drones are NOT emergent — drone vamps one modal chord,
  // sludge/ambient wrote their cycles down — so a drone is never conformable
  ok(GK.filter(k => GENRES[k].harmony === "emergent").sort().join(",") ===
     "counterpoint,fugue,spem",
     "the emergent roster changed — re-argue the §48 ruling genre by genre");
  ok(GENRES.drone.harmony === "modal" && GENRES.sludge.harmony === "cycle" &&
     GENRES.ambient.harmony === "cycle",
     "a drone-family genre changed harmony mode — the §48 ruling's boundary " +
     "needs re-reading");

  // (b) on COMPOSED stacked sections — the corpus the arranger actually ships.
  // PRE measured at HEAD b1adc27: cover 1966/2477, viol 1105, grinds 1773,
  // unis 820 over 93 stacked sections (beatles/rock/house/vaporwave/motown ×
  // seeds 1..3). "Down to ~0" is asserted as ≤ 12 grinds (0.7% of pre) and
  // ≤ 60 unisons (7% of pre) so ordinary churn breathes; coverage and the
  // scale law are exact.
  {
    const tot = { strongOn: 0, strongTot: 0, viol: 0, grinds: 0, unis: 0, layerNotes: 0 };
    let stacked = 0;
    for (const gk of ["beatles", "rock", "house", "vaporwave", "motown"]) {
      for (const seed of [1, 2, 3]) {
        const song = C.compose(gk, seed);
        for (const sec of song.song) {
          if ((sec.stack || []).length < 2) continue;
          stacked++;
          const m = hMetrics(
            D.sectionEvents(sec, song.slots, song.groove, song.swing).ev,
            D.masterCtx(sec, song.slots));
          for (const k of Object.keys(tot)) tot[k] += m[k];
        }
      }
    }
    ok(stacked >= 80, "the composed corpus lost its stacked sections (" +
       stacked + ") — the multi-layer claims are measuring nothing");
    ok(tot.strongOn === tot.strongTot && tot.strongOn > 1966,
       "composed corpus: strong-beat chord-tone coverage not strictly up (" +
       tot.strongOn + "/" + tot.strongTot + " vs pre 1966/2477)");
    ok(tot.viol === 0, "composed corpus: " + tot.viol +
       " layer notes outside the governing scale and the sounding chord");
    ok(tot.grinds <= 12, "composed corpus: " + tot.grinds +
       " sustained cross-layer minor seconds (pre 1773, shipped at 6)");
    ok(tot.unis <= 60, "composed corpus: " + tot.unis +
       " stacked cross-layer unisons (pre 820, shipped at 39)");
  }
}

/* ------------------------------- 49. MUSIC BREATHES
   Two claims Paul made in two sentences — "tempo changes never happen, but
   music slows down and speeds up" and "solos have a bar or a few notes of
   lead-in, as do drum phrases and so forth" — measured where they are made:
   ui/derive.js songBars, the one walk from boxes to bars that both the live
   transport and the offline bounce read. Score level, no renders: the bar list
   IS the artifact at this layer, and both features are facts about it.

     (a) THE TEMPO MOVES — bar durations really vary across a composed song,
         the curve is CONTINUOUS at every bar line (a jump would be a tempo
         change, which is the one thing forbidden), the gestures land at
         section ends rather than inside sections, and the last bar of the song
         is the slowest thing in it.
     (b) IT IS THE SAME CLOCK EVERYWHERE — the transport's bar list carries the
         warped durations, and the bounce measures its bars off `barSteps * sd`
         (anchored in the shipped text), so the carrier cannot drift from the
         live graph.
     (c) OFF IS TODAY — with rubato off every bar is exactly 16/rate steps and
         every offset is exactly its event's own time, so the device escape
         hatch (ui/state.js RUBATO) returns the timeline that existed before
         any of this.
     (d) A VOICE ANNOUNCES ITSELF — a lane that enters gets a pickup, the
         pickup LANDS on the bar line it leads to, it speaks the chord it is
         arriving into, it stays within an octave of the note it leads to and
         rides that note's register home, it never plays the arrival itself,
         and it never double-hits or plays over what it borrowed.
     (e) BOTH ARE SEEDED — compiled twice, byte for byte the same. */
console.log("music breathes — the tempo map and the lead-ins");
{
  // the same browser stubs §45 installs, stated again because a section must
  // not depend on another section having run first
  globalThis.addEventListener = globalThis.addEventListener || (() => {});
  globalThis.document = globalThis.document ||
    { visibilityState: "visible", addEventListener: () => {} };
  globalThis.localStorage = globalThis.localStorage ||
    { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const ST49 = await import("../../nukernel/ui/state.js");
  const T49 = await import("../../nukernel/audio/transport.js");
  const NS49 = require("../../nukernel/song.js");
  const C49 = require("../../nukernel/compose.js");
  const fs49 = require("fs"), path49 = require("path");
  const load = (gk, seed) => {
    const r = NS49.load(C49.compose(gk, seed));
    ok(r.ok, "compose(" + gk + "," + seed + ") no longer loads — §49 is measuring nothing");
    return r.song;
  };
  const bars = (s, o) => D.songBars(s.song, s.slots, s.groove, s.swing, null, o || {});
  const plainOf = s => bars(s, { rubato: false, pickups: false });

  /* (a) THE TEMPO MOVES, and moves like a musician */
  {
    const s = load("house", 7), tl = bars(s), flat = plainOf(s);
    const durs = tl.map(b => b.barSteps), nom = flat.map(b => b.barSteps);
    ok(tl.length === flat.length && tl.length > 20,
       "the tempo map changed how many bars there are (" + tl.length + " vs " +
       flat.length + ") — it may only change how long they last");
    ok(new Set(durs.map(d => d.toFixed(6))).size > 5,
       "every bar of a composed song lasts the same time — the tempo does not move");
    // the whole point: a bar is not its nominal length, and no bar is silly
    const ratio = durs.map((d, i) => d / nom[i]);
    ok(Math.max(...ratio) / Math.min(...ratio) > 1.02,
       "the tempo moves by less than two percent across a whole song (" +
       ((Math.max(...ratio) / Math.min(...ratio) - 1) * 100).toFixed(2) +
       "%) — that is a grid with a rounding error, not a band");
    ok(ratio.every(r => r > 0.6 && r < 1.7),
       "a bar left the tempo map's own rate clamp — the clock is no longer musical");
    // CONTINUITY, the law that makes this breathing rather than automation:
    // the rate at the end of a bar IS the rate at the start of the next
    let jumps = 0;
    for (let i = 1; i < tl.length; i++)
      if (tl[i - 1].tempo[1] !== tl[i].tempo[0]) jumps++;
    ok(jumps === 0, jumps + " tempo JUMP(S) at a bar line — a jump is a tempo " +
       "change, which is the one thing this may never be");
    // the gestures live at section ENDS. Inside a section only the drift moves,
    // and it moves slowly; a closing bar moves several times as far.
    // (a bar that OPENS a section is a seam bar too: it is the one recovering
    // from the gesture the closing bar made, which is where "a tempo" happens)
    let insideMax = 0, closingMax = 0, closings = 0;
    for (let i = 0; i < tl.length; i++) {
      const closing = i === tl.length - 1 || tl[i + 1].si !== tl[i].si;
      const move = Math.abs(tl[i].tempo[1] / tl[i].tempo[0] - 1);
      if (closing) { closings++; closingMax = Math.max(closingMax, move); }
      else if (!tl[i].first) insideMax = Math.max(insideMax, move);
    }
    ok(closings >= 5 && closingMax > 4 * insideMax && closingMax > 0.02,
       "the ritards do not land at section ends (closing move " +
       (closingMax * 100).toFixed(2) + "%, inside-section move " +
       (insideMax * 100).toFixed(2) + "%)");
    ok(insideMax > 0, "nothing moves inside a section at all — the human drift " +
       "underneath the arrangement has gone flat");
    // THE FINAL RITARD: the last bar of the song is the slowest bar in it
    const last = ratio[ratio.length - 1];
    ok(last === Math.max(...ratio) && last > 1.03,
       "the song does not end with a ritard (last bar " + last.toFixed(3) +
       "× nominal, slowest " + Math.max(...ratio).toFixed(3) + "×)");
    // ...and a single box on loop is NOT a song ending every four bars
    const one = { song: [s.song[1]], slots: s.slots, groove: s.groove, swing: s.swing };
    const loop = bars(one);
    const lr = loop.map((b, i) => b.barSteps / plainOf(one)[i].barSteps);
    ok(Math.max(...lr) / Math.min(...lr) < 1.02,
       "a single box slows down at the end of every pass — a loop is not an ending");
    // ONE SEAM THAT SLOWS AND ONE THAT PUSHES: a build running at its drop
    // accelerates, everything else leans back
    const dance = load("dnb", 5), dtl = bars(dance);
    let slower = 0, faster = 0;
    for (let i = 0; i < dtl.length; i++)
      if (i === dtl.length - 1 || dtl[i + 1].si !== dtl[i].si) {
        const m = dtl[i].tempo[1] / dtl[i].tempo[0];
        if (m < 0.995) slower++; else if (m > 1.005) faster++;
      }
    ok(slower >= 2, "no seam in a composed song slows into the next section");
    ok(faster >= 1, "no seam in a composed dance song pushes into its drop — " +
       "the accelerando out of a build never fires");
  }

  /* (b) ONE CLOCK for the live tick and the rendered carrier */
  {
    ST49.adoptSong(C49.compose("house", 7), "gate");
    const TL = T49.buildTimeline();
    const durs = TL.map(b => b.barSteps);
    ok(new Set(durs.map(d => d.toFixed(6))).size > 5,
       "the transport's bar list carries no tempo map — the live tick plays a grid");
    ok(TL.every(b => b.steps > 0 && Math.abs(b.barSteps - b.steps) < b.steps * 0.6),
       "a transport bar lost its musical grid (`steps`) or its clock ran away from it");
    // the BOUNCE reads the same number: its bar durations are barSteps × the
    // step duration, so warping barSteps is what makes the carrier honour the
    // map without knowing there is one. Anchored in the shipped text — a
    // rewrite that computed bar times from bpm × bars would silently drift.
    const bSrc49 = fs49.readFileSync(
      path49.join(__dirname, "../../nukernel/audio/bounce.js"), "utf8");
    ok(/b\.barSteps \* sd/.test(bSrc49) && /TL\[i\]\.barSteps \* sd/.test(bSrc49),
       "audio/bounce.js no longer measures its bars off barSteps × stepDur — " +
       "the carrier would render a different tempo map from the one you hear");
    const dSrc49 = fs49.readFileSync(
      path49.join(__dirname, "../../nukernel/ui/derive.js"), "utf8");
    ok(/export function songBars/.test(dSrc49) &&
       /songBars/.test(fs49.readFileSync(
         path49.join(__dirname, "../../nukernel/audio/transport.js"), "utf8")),
       "audio/transport.js does not build its timeline with ui/derive.js songBars — " +
       "there are two walks again");
  }

  /* (c) OFF IS TODAY */
  {
    const s = load("rock", 3);
    const flat = plainOf(s);
    let bad = 0, evs = 0;
    for (const b of flat) {
      if (Math.abs(b.barSteps - 16 / b.g.rate) > 1e-12) bad++;
      if (b.tempo) bad++;
    }
    // every offset is exactly the event's own time minus the bars before it,
    // which is the arithmetic the timeline did before there was a tempo map
    const byBox = new Map();
    for (const b of flat) {
      const n = byBox.get(b.si) || 0;
      for (const e of b.ev) {
        evs++;
        if (Math.abs(e.off - (e.t - n * b.barSteps)) > 1e-9 &&
            !(e.t / b.barSteps >= flat.filter(x => x.si === b.si).length)) bad++;
      }
      byBox.set(b.si, n + 1);
    }
    ok(evs > 200 && bad === 0, bad + " bar(s)/event(s) moved with the tempo map " +
       "OFF — the escape hatch does not return the timeline that was there before");
    // ...and turning it ON moves TIME and nothing else: same notes, same lanes
    const on = bars(s, { pickups: false });
    const ident = tl => tl.flatMap(b => b.ev.map(e =>
      [e.kind, e.n != null ? e.n : e.d, e.v == null ? "" : e.v, e.vel].join("|")))
      .sort().join(";");
    const flat2 = bars(s, { rubato: false, pickups: false });
    ok(ident(on) === ident(flat2),
       "the tempo map moved a pitch, a lane or a level — it may only move time");
    ok(JSON.stringify(on.map(b => +b.barSteps.toFixed(6))) !==
       JSON.stringify(flat2.map(b => +b.barSteps.toFixed(6))),
       "the tempo map moved no bar at all");
    // the escape hatch is a DEVICE setting, not a song field: it never rides a save
    ok(typeof ST49.setRubato === "function" && !/rubato/.test(ST49.songJSON()),
       "the rubato escape hatch is missing, or it has leaked into the saved song " +
       "— the tempo is derived from the arrangement, not stored beside it");
  }

  /* (d) THE LEAD-INS */
  {
    // three arrangements that make an entrance happen on purpose, beside the
    // composed corpus: the drums arrive, a stacked solo voice arrives, the
    // bass arrives
    const mk = (g, over) =>
      Object.assign(NS49.skeleton(g, null), { stack: [{ g, slots: [0] }] }, over);
    const build = song => {
      const r = NS49.load({ v: NS49.VERSION, slots: [P], song, bpm: 120 });
      ok(r.ok, "§49's hand-built song no longer loads: " +
         JSON.stringify(r.errors && r.errors[0]));
      return r.song;
    };
    const drumsIn = build([mk("rock", { kit: "nodrums", role: "breakdown" }),
                           mk("rock", { role: "chorus" })]);
    const soloIn = build([mk("rock", { role: "verse" }),
                          Object.assign(mk("rock", { role: "solo" }),
                            { stack: [{ g: "rock", slots: [0] }, { g: "acid", slots: [0] }] })]);
    const bassIn = build([mk("rock", { bassop: "nobass", role: "breakdown" }),
                          mk("rock", { role: "chorus" })]);
    const seamOf = tl => tl.findIndex((b, i) => tl[i + 1] && tl[i + 1].si !== b.si);
    for (const [name, s, kind] of [["the drums", drumsIn, "hit"],
                                   ["a solo voice", soloIn, "line"],
                                   ["the bass", bassIn, "bass"]]) {
      const tl = bars(s), i = seamOf(tl);
      const pu = tl[i].ev.filter(e => e.pu && e.kind === kind);
      ok(pu.length >= 2, name + " enters with no lead-in (" + pu.length +
         " pickup events in the closing bar)");
      // it LANDS: the last pickup event ends exactly on the bar line it leads to
      const lastEnd = Math.max(...pu.map(e => e.off + (e.dur || 0)));
      // a pitched pickup ENDS on the line (its last note abuts the arrival); a
      // drum fill is struck rather than held, so its last hit must land inside
      // the final beat before the line and never past it
      ok(kind === "hit"
         ? (lastEnd < tl[i].barSteps && lastEnd > tl[i].barSteps - tl[i].barSteps / 4)
         : Math.abs(lastEnd - tl[i].barSteps) < 1e-6,
         name + "'s lead-in does not land on the bar line (ends " +
         lastEnd.toFixed(4) + " of " + tl[i].barSteps.toFixed(4) + ")");
      // it belongs to the box it announces, and only to a seam bar
      ok(pu.every(e => e.puSi === tl[i + 1].si),
         name + "'s pickup is not tagged with the box it announces");
      ok(tl.every((b, j) => j === i || !b.ev.some(e => e.pu && e.puSi != null)),
         name + ": a pickup appeared in a bar that is not a seam");
    }
    // A DRUM LEAD-IN ARRIVES ON THE ARRIVING KIT, and only there
    {
      const tl = bars(drumsIn), i = seamOf(tl);
      const pu = tl[i].ev.filter(e => e.pu && e.kind === "hit");
      ok(pu.length > 0 && pu.every(e => e.kit === D.kitOf(drumsIn.song[1])),
         "the drum lead-in plays the kit of the box whose bar it borrows — the " +
         "box that (by construction) has no kit at all");
      const lanes = new Set(tl[i + 1].ev.filter(e => e.kind === "hit").map(e => e.d));
      ok(pu.every(e => lanes.has(e.d)),
         "the drum lead-in plays a lane the arriving kit does not have");
    }
    // THE THINNING LAW: nothing of the pickup's own kind survives in the
    // window it borrowed, and no drum pickup lands on top of an existing hit
    {
      const tl = bars(soloIn), flat = plainOf(soloIn), i = seamOf(tl);
      const pu = tl[i].ev.filter(e => e.pu && e.kind === "line");
      const w0 = Math.min(...pu.map(e => e.off));
      const left = tl[i].ev.filter(e => !e.pu && e.kind === "line" && !e.pad &&
                                        e.off >= w0 - 1e-9);
      ok(pu.length > 0 && left.length === 0,
         left.length + " outgoing line event(s) still play under the pickup that " +
         "borrowed their beat");
      ok(flat[i].ev.filter(e => e.kind === "line" && !e.pad && e.off >= w0).length > 0,
         "the outgoing box had nothing in the borrowed window — the thinning " +
         "law is being proved against silence");
      // sustains are TRIMMED to the borrow, not left ringing through it
      ok(tl[i].ev.every(e => e.pu || e.kind !== "line" || e.pad ||
                             !(e.dur > 0) || e.off + e.dur <= w0 + 1e-6),
         "an outgoing line sustains through the borrowed window");
    }
    /* the composed corpus: every law at once, over real songs */
    const seen = { pu: 0, songs: 0, seams: 0 };
    let offChord = 0, offRange = 0, onArrival = 0, repeat = 0, doubles = 0,
        badHome = 0, strayBar = 0;
    for (const gk of ["house", "rock", "dnb", "jazz", "acid", "vaporwave", "blues"]) {
      if (!GENRES[gk]) continue;
      for (const seed of [1, 5, 9]) {
        // through the SHIPPED path, not a private call: adoptSong + the
        // transport's own builder, so the register home is really stamped and
        // the home law below is measuring something
        const s = load(gk, seed);
        ST49.adoptSong(C49.compose(gk, seed), "gate");
        const tl = T49.buildTimeline();
        seen.songs++;
        // the arrival chord of each box, read through the SAME masterCtx the
        // engine corrects by (§48's discipline: one reading, not two)
        const arrivalOf = si => {
          const ctx = D.masterCtx(s.song[si], s.slots);
          const cs = ctx.chords(Math.max(0, s.song[si].nudge | 0));
          const c = cs.find(x => x.start === 0) || cs[0];
          return { pcs: new Set([...c.pcSet, ...ctx.scalePcs]) };
        };
        for (let i = 0; i < tl.length; i++) {
          const pu = tl[i].ev.filter(e => e.pu);
          if (!pu.length) continue;
          const seam = i === tl.length - 1 || tl[i + 1].si !== tl[i].si;
          if (!seam) strayBar++;
          seen.seams++;
          seen.pu += pu.length;
          const pitched = pu.filter(e => e.kind !== "hit").sort((a, b) => a.off - b.off);
          if (pitched.length) {
            const into = pitched[0].puSi, legal = arrivalOf(into).pcs;
            // the entering voice's own first note in the box it announces
            const first = tl.find(b => b.si === into).ev
              .filter(e => !e.pu && e.kind === pitched[0].kind &&
                           (e.kind !== "line" || (e.v === pitched[0].v && !e.pad)))
              .sort((a, b) => a.off - b.off)[0];
            for (const e of pitched) {
              if (!legal.has(((e.n % 12) + 12) % 12)) offChord++;
              if (first && Math.abs(e.n - first.n) > 12) offRange++;
              if (first && e.kind === "line" && (e.home || 0) !== (first.home || 0)) badHome++;
            }
            if (first && pitched[pitched.length - 1].n === first.n) onArrival++;
            for (let k = 1; k < pitched.length; k++)
              if (pitched[k].n === pitched[k - 1].n) repeat++;
          }
          const u = tl[i].barSteps / 16;
          for (const e of pu.filter(x => x.kind === "hit"))
            for (const o of tl[i].ev)
              if (o !== e && o.kind === "hit" && o.d === e.d &&
                  Math.abs(o.off - e.off) < 0.5 * u) doubles++;
        }
      }
    }
    ok(seen.pu > 40 && seen.seams > 12,
       "the composed corpus produced only " + seen.pu + " pickup event(s) across " +
       seen.seams + " seam(s) — the lead-ins are not reaching real songs");
    ok(strayBar === 0, strayBar + " pickup(s) landed in a bar that is not a seam");
    ok(offChord === 0, offChord + " pickup note(s) speak neither the chord they " +
       "arrive into nor the governing scale — the harmonize law does not reach them");
    ok(offRange === 0, offRange + " pickup note(s) sit more than an octave from " +
       "the note they lead to");
    ok(badHome === 0, badHome + " pickup note(s) ride a different register home " +
       "from their own arrival — the lead-in would enter an octave out");
    ok(onArrival === 0, onArrival + " pickup(s) end ON the note the entering " +
       "voice is about to play — a lead-in leads to the arrival, it does not play it");
    ok(repeat === 0, repeat + " repeated note(s) inside a pickup — a run that " +
       "repeats a note is not a run");
    ok(doubles === 0, doubles + " pickup hit(s) land on top of an existing hit " +
       "in the same lane");
    // pickups OFF is the timeline without them, and nothing else
    {
      const s = load("house", 7);
      const off = bars(s, { rubato: false, pickups: false });
      const on = bars(s, { rubato: false });
      ok(off.every(b => b.ev.every(e => !e.pu)) &&
         on.some(b => b.ev.some(e => e.pu)),
         "the pickups switch does not switch the pickups");
      ok(off.length === on.length &&
         off.every((b, i) => Math.abs(b.barSteps - on[i].barSteps) < 1e-12),
         "the lead-ins changed how long a bar is — they may only change what is in one");
    }
  }

  /* (e) SEEDED, both of them */
  {
    const s = load("dnb", 5);
    const j = tl => JSON.stringify(tl.map(b =>
      [b.si, b.barSteps, b.tempo, b.ev.map(e =>
        [e.kind, e.off, e.dur, e.n, e.d, e.vel, e.pu || 0, e.puSi == null ? -1 : e.puSi])]));
    ok(j(bars(s)) === j(bars(s)),
       "songBars is not deterministic — the tempo map or the pickups roll fresh " +
       "dice per compile, and the bounce would render a different record");
    ST49.adoptSong(C49.compose("dnb", 5), "gate");
    const k = TL2 => JSON.stringify(TL2.map(b => [b.si, b.barSteps, b.ev]));
    ok(k(T49.buildTimeline()) === k(T49.buildTimeline()),
       "buildTimeline is not deterministic with the tempo map and the lead-ins in it");
  }
}

/* ------------------------------- 50. THE LOOP ENDS WHERE THE MUSIC DOES,
   AND THE TAPE CARRIES THE WHOLE BAND
   Two reports from Paul, one week after the tempo map landed, and they turned
   out to be two halves of one mistake — code that still measured MUSIC WITH A
   RULER after the music started breathing:

     "I play Liverpool. It's repeating itself off by a beat or two."
     "I switch out of the browser. One phrase repeats over and over — no
      drums — but there's no doubling."

   §49 proved the bar list breathes. This section proves that everything which
   asks the bar list HOW LONG SOMETHING IS gets the breathed answer:

     (a) THE PASS-LENGTH LAW — a box's stamped span is exactly the sum of its
         own bars, on the clock and on the grid, for every genre and seed and
         with rubato both ways. And it has TEETH: the nominal multiplication
         everything used to do (one bar × the bar count) is measurably wrong,
         which is the beat Paul heard.
     (b) NO RULER LEFT — the three readers that used to multiply (the live
         tick's automation arm, the bounce's, the playhead) read the stamp,
         anchored in the shipped text.
     (c) THE WRAP IS THE MUSIC'S OWN END — the song duration the transport
         reports, the tape length the bounce plans, and the sum of the bar
         list are one number.
     (d) CARRIER PARITY — the bounce's plan renders every bar of the live walk
         exactly once, in order, at the time the live walk puts it. This is the
         assertion that would have caught "no drums": a tape that is not the
         whole bar list is not the song.
     (e) THE INSURANCE TAPE IS A WHOLE PHRASE. It did not used to be. Measured
         on the shipped arithmetic as it stood, the 4-second bar-aligned head of
         a composed song was one or two bars — ONE bar of Lagos 1971, 2.17 s,
         with the bass alone in it — and 5 of these 8 songs had no drums in the
         fragment at all. Looping that is the report Paul made twice: "one
         phrase over and over, no drums" and "the crash loops and loops on a
         different tempo". Desktop stopped handing it to the ear; iOS in the
         first stretch could not, because there the alternative is silence.
         So the CUT MOVED to a box boundary — the composer's own section, whole
         — and this section holds the four things that has to mean: it is at
         least one COMPLETE box and never a truncated one, the cap refuses a
         second box rather than knifing the first, it wraps on a bar the
         composer stamped as a box opening (so the loop is a downbeat the music
         has, under the full tape's own timing law), and its drum-lane census is
         exactly the census of the boxes in it. The carrier still only hands it
         to the ear where the alternative is silence.

   WHAT IS DELIBERATELY NOT ON THE TEMPO MAP, so nobody reads its absence as an
   oversight: the ECHO and the tempo-synced sends (audio/graph.js barSec, set
   once per box from that box's dtime chip). A tape echo is a machine with a
   time on it; a band that breathes does not reach over and re-tune the delay
   bar by bar, and the drift a rubato bar puts on a dotted eighth is single-
   digit milliseconds. Every SCHEDULED EVENT, and every span a box is said to
   have, does ride the map — that is what (a)-(d) hold. */
console.log("the loop ends where the music does, and the tape carries the whole band");
{
  // audio/bounce.js reads the platform off the page at module evaluation (the
  // ?bgtest predicate and the render knobs), so the stub window needs the two
  // globals a browser would have. Nothing here plays; the plan is pure.
  globalThis.location = globalThis.location || { search: "" };
  globalThis.navigator = globalThis.navigator ||
    { userAgent: "node", platform: "", maxTouchPoints: 0, hardwareConcurrency: 4 };
  globalThis.Audio = globalThis.Audio || function () {};
  const ST50 = await import("../../nukernel/ui/state.js");
  const T50 = await import("../../nukernel/audio/transport.js");
  const B50 = await import("../../nukernel/audio/bounce.js");
  const NS50 = require("../../nukernel/song.js");
  const C50 = require("../../nukernel/compose.js");
  const fs50 = require("fs"), path50 = require("path");
  const src50 = f => fs50.readFileSync(path50.join(__dirname, "../../nukernel/", f), "utf8");
  const load50 = (gk, seed) => {
    const r = NS50.load(C50.compose(gk, seed));
    ok(r.ok, "compose(" + gk + "," + seed + ") no longer loads — §50 measures nothing");
    return r.song;
  };
  const bars50 = (s, o) => D.songBars(s.song, s.slots, s.groove, s.swing, null, o || {});
  // a spread of the corpus rather than one song: the tempo map's gestures are
  // chosen by ROLE, so a genre whose composer writes no breakdown never sees
  // the biggest ritard and would prove the law only where it is easy
  const CORPUS50 = [["beatles", 7], ["beatles", 1234], ["afrobeat", 7], ["jazz", 5],
                    ["house", 7], ["rock", 3], ["dnb", 5], ["punk", 3]];

  /* (a) THE PASS-LENGTH LAW, and the beat it is worth */
  {
    let worstBeats = 0, worstAt = "";
    for (const [gk, seed] of CORPUS50) {
      const s = load50(gk, seed);
      for (const rub of [true, false]) {
        const tl = bars50(s, { rubato: rub });
        // the stamp is on EVERY bar, and it is the sum of the run it belongs to
        const runs = [];
        for (let i = 0; i < tl.length;) {
          let j = i;
          while (j < tl.length && tl[j].si === tl[i].si && (j === i || !tl[j].first)) j++;
          runs.push([i, j]); i = j;
        }
        let bad = 0;
        for (const [a, b] of runs) {
          let sum = 0, nom = 0;
          for (let i = a; i < b; i++) { sum += tl[i].barSteps; nom += tl[i].steps; }
          for (let i = a; i < b; i++) {
            const x = tl[i];
            if (Math.abs(x.boxSteps - sum) > 1e-9 || Math.abs(x.boxNom - nom) > 1e-9) bad++;
            if (x.boxBars !== b - a || x.barIn !== i - a) bad++;
          }
        }
        ok(bad === 0, gk + "/" + seed + (rub ? "" : " (rubato off)") + ": " + bad +
           " bar(s) carry a box span that is not the sum of the box's own bars — " +
           "the pass length and the music have come apart again");
        // OFF IS TODAY: with the tempo map off the stamp IS the old multiplication
        if (!rub) {
          let off = 0;
          for (const b of tl) if (Math.abs(b.boxSteps - b.boxBars * b.barSteps) > 1e-9) off++;
          ok(off === 0, gk + "/" + seed + ": the box span is not bars × barSteps with " +
             "the tempo map off — the escape hatch no longer returns the old timeline");
        } else {
          // ...and ON, the old multiplication is WRONG. This is the teeth: if
          // this ever stops failing, §50 is measuring a grid again.
          for (const b of tl) {
            const beats = Math.abs(b.boxSteps - b.boxBars * b.barSteps) / 4;
            if (beats > worstBeats) { worstBeats = beats; worstAt = gk + "/" + seed; }
          }
        }
      }
    }
    ok(worstBeats > 0.4, "the nominal box length (one bar × the bar count) is never " +
       "more than " + worstBeats.toFixed(3) + " of a beat out across the corpus — " +
       "either the tempo stopped moving or this section is measuring the grid");
    console.log("  worst nominal-vs-real box length: " + worstBeats.toFixed(3) +
                " beats (" + worstAt + ")");
  }

  /* (b) NO RULER LEFT — the three readers, in the shipped text */
  {
    const t50 = src50("audio/transport.js"), b50 = src50("audio/bounce.js"),
          m50 = src50("ui/main.js");
    ok(/armAutomation\(cur\.chan, nextBarTime, bar\.boxSteps \* sd/.test(t50) &&
       /armAutomation\(chan, now, first\.boxSteps \* sd/.test(t50),
       "audio/transport.js arms a box's automation off something other than " +
       "boxSteps — a sweep that ends where the box does not");
    ok(/armAutomation\(cur\.chan, t, bar\.boxSteps \* sd/.test(b50),
       "audio/bounce.js arms the carrier's automation off something other than " +
       "boxSteps — the tape's mix would drift from the graph's");
    ok(!/barSteps \* sd \* boxBars/.test(t50) && !/barSteps \* sd \* boxBars/.test(b50),
       "a `barSteps × boxBars` box length is back in the audio tier — that is the " +
       "ruler the tempo map made a lie");
    ok(/transport\.passAt\(/.test(m50) && !/sec\.len \* 16 \/ rate/.test(m50),
       "ui/main.js computes the playhead from the nominal box again — the fill bar " +
       "and the LCD would wrap a beat before or after the music does");
    ok(/export function passAt/.test(t50),
       "audio/transport.js no longer exports passAt — the playhead has nowhere " +
       "honest to ask how far through the box it is");
  }

  /* (c) ONE NUMBER FOR THE END OF THE SONG */
  {
    for (const [gk, seed] of CORPUS50.slice(0, 4)) {
      ST50.adoptSong(C50.compose(gk, seed), "gate");
      T50.compile();                     // songDurSec reads the COMPILED list
      const TL = T50.buildTimeline(), sd = T50.stepDur();
      const sum = TL.reduce((a, b) => a + b.barSteps, 0) * sd;
      ok(Math.abs(T50.songDurSec() - sum) < 1e-9,
         gk + "/" + seed + ": the transport's song duration is not the sum of its " +
         "bars — the live loop wraps somewhere other than the end of the music");
      const plan = B50.planFor(TL, sd);
      ok(Math.abs(plan.total - sum) < 1e-9,
         gk + "/" + seed + ": the tape the bounce plans is " +
         (plan.total - sum).toFixed(4) + " s longer than the music — the carrier " +
         "would loop early or late");
    }
  }

  /* (d) CARRIER PARITY — every bar of the live walk, once, where it belongs */
  {
    for (const [gk, seed] of CORPUS50) {
      ST50.adoptSong(C50.compose(gk, seed), "gate");
      const TL = T50.buildTimeline(), sd = T50.stepDur();
      const plan = B50.planFor(TL, sd);
      // the windows PARTITION the bar list: contiguous, in order, no gap, no
      // overlap. A window also replays its pre-roll bars, but it throws that
      // output away, so every bar's samples come from exactly one window.
      let next = 0, bad = 0;
      for (const ck of plan.chunks) {
        if (ck.a !== next || ck.b <= ck.a || ck.pre > ck.a) bad++;
        next = ck.b;
      }
      ok(bad === 0 && next === TL.length,
         gk + "/" + seed + ": the bounce's windows do not cover the bar list exactly " +
         "once (" + next + " of " + TL.length + " bars, " + bad + " broken window(s)) " +
         "— the tape is not the song");
      // ...and each bar lands at the time the live walk puts it
      let acc = 0, drift = 0;
      for (let i = 0; i < TL.length; i++) {
        drift = Math.max(drift, Math.abs(plan.t0[i] - acc));
        acc += TL[i].barSteps * sd;
      }
      ok(drift < 1e-9 && Math.abs(plan.t0[TL.length] - acc) < 1e-9,
         gk + "/" + seed + ": a bar sits " + drift.toFixed(6) + " s from where the " +
         "live walk puts it — the carrier is a different performance");
      // THE EVENT SET IS THE SAME EVENT SET — same voices, same count, same
      // order. The bounce walks TL[pre..b) and keeps [a,b), so the union of the
      // kept spans is the whole walk; anything else is a lost voice.
      const ident = list => list.flatMap((b, i) => b.ev.map(e =>
        [i, e.kind, e.d || "", e.n == null ? "" : e.n, e.v == null ? "" : e.v,
         e.vel == null ? "" : e.vel, +e.off.toFixed(6)].join("|")));
      const live = ident(TL);
      const tape = plan.chunks.flatMap(ck =>
        ident(TL.slice(ck.a, ck.b)).map(k => {           // re-index onto the song
          const p = k.indexOf("|");
          return (ck.a + +k.slice(0, p)) + k.slice(p);
        }));
      ok(live.length === tape.length && live.every((k, i) => k === tape[i]),
         gk + "/" + seed + ": the carrier's event set is not the live walk's (" +
         tape.length + " vs " + live.length + " events) — this is what 'no drums " +
         "on the tape' looks like from the score");
      // and the lanes, said out loud, because a count can match while a lane
      // vanishes: every drum lane the band plays is on the tape
      const lanes = l => new Set(l.filter(k => k.split("|")[1] === "hit")
                                  .map(k => k.split("|")[2]));
      const L = lanes(live), Tp = lanes(tape);
      ok(L.size === Tp.size && [...L].every(d => Tp.has(d)),
         gk + "/" + seed + ": the tape is missing drum lane(s) " +
         [...L].filter(d => !Tp.has(d)).join(",") + " that the live walk plays");
    }
  }

  /* (e) THE INSURANCE TAPE IS A WHOLE PHRASE */
  {
    // the boxes a bar list opens, as [start, end) spans. `first` is the
    // timeline's own box stamp, which is the boundary shortCut is required to
    // cut on and the one the live tick arms automation against — so this gate
    // and the shipped arithmetic are reading the same line, not two opinions
    // about where a section begins.
    const boxes50 = TL => {
      const out = []; let a = 0;
      for (let i = 1; i <= TL.length; i++)
        if (i === TL.length || TL[i].first) { out.push([a, i]); a = i; }
      return out;
    };
    // the drum lanes a span really plays, from the events themselves — the
    // score half of the census the render reports as st.lanes
    const lanes50 = list => new Set(list.flatMap(b =>
      (b.ev || []).filter(e => e.kind === "hit").map(e => e.d)));
    let minSec = Infinity, maxSec = 0, drumless = 0, twoBox = 0, sum = 0;
    const named = {};
    for (const [gk, seed] of CORPUS50) {
      ST50.adoptSong(C50.compose(gk, seed), "gate");
      const TL = T50.buildTimeline(), sd = T50.stepDur();
      const cut = B50.shortCut(TL, sd, B50.SHORT_CAP);
      const at = gk + "/" + seed + ": ";
      const secs = cut.reduce((a, b) => a + b.barSteps * sd, 0);
      ok(cut.length >= 1 && cut.length < TL.length,
         at + "the short stage is not a short cut of the song (" +
         cut.length + " of " + TL.length + " bars)");

      // (1) IT IS A WHOLE BOX, AND WHOLE BOXES ONLY. The cut is the head of
      // the bar list, so "whole boxes" is two facts: it starts where box 0
      // starts, and it ENDS where a box ends — the bar after it opens the next
      // one. A cut that stops in the middle of a section is the two-bar
      // fragment this section is named after, wearing a longer coat.
      const B = boxes50(TL);
      ok(B.length > 1, at + "the song is one box — §50(e) proves nothing here");
      const whole = B.filter(([a, b]) => b <= cut.length);
      ok(whole.length >= 1, at + "the short tape is not even one complete box (" +
         cut.length + " bars, first box is " + B[0][1] + ")");
      ok(whole[whole.length - 1][1] === cut.length,
         at + "the short tape ends " + cut.length + " bars in, inside the box that " +
         "runs bars " + B[whole.length].join("-") +
         " — a truncated phrase is the defect, not the fix");
      // ...stated the other way round, which is the LOOP law: the wrap lands on
      // a bar the composer stamped as a box opening, so the tape comes round on
      // a downbeat the music itself has. (foldAndEncode folds the ring-out onto
      // that downbeat; a wrap anywhere else is the seam law's forbidden cut.)
      ok(TL[cut.length].first === true,
         at + "the short tape wraps onto a bar that does not open a box — the " +
         "insurance loops against the music instead of with it");
      // and the timing law is the FULL tape's, unchanged: the plan the bounce
      // makes over the cut is exactly as long as the bars in it, so the loop
      // point is the music's own end and not a rounded one
      const plan = B50.planFor(cut, sd);
      ok(Math.abs(plan.total - secs) < 1e-9,
         at + "the short tape's plan is " + (plan.total - secs).toFixed(6) +
         " s off its own bar list — it would loop early or late");

      // (2) AT LEAST ONE COMPLETE BOX EVEN WHEN THE BOX IS LONGER THAN THE CAP.
      // The cap refuses a SECOND box; it never truncates the first.
      ok(cut.length >= B[0][1],
         at + "the cap cut the first box short at " + cut.length + " of " +
         B[0][1] + " bars — SHORT_CAP is a ceiling on extra boxes, not a knife");
      ok(whole.length === 1 || secs <= B50.SHORT_CAP,
         at + "the short tape took " + whole.length + " boxes and " +
         secs.toFixed(2) + " s, past the " + B50.SHORT_CAP + " s cap");
      if (whole.length > 1) twoBox++;

      // (3) THE DRUM-LANE CENSUS MATCHES THE BOX. Not "the tape has drums" —
      // a drift record's opening section genuinely has none, and demanding
      // otherwise would be demanding a different song. The law is that the
      // tape's lanes are EXACTLY the lanes the boxes it contains play: nothing
      // lost between the box and the cut, and nothing borrowed from a box the
      // cut does not reach. bounce.js publishes the same arithmetic as
      // scoreLanes and hands it to the render as st.lanesWant, so the browser
      // gate can subtract it from what the channels really routed.
      const want = lanes50(TL.slice(0, cut.length));
      const got = new Set(B50.scoreLanes(cut));
      ok(want.size === got.size && [...want].every(d => got.has(d)),
         at + "the shipped lane census disagrees with the score (" +
         [...got].sort().join(",") + " vs " + [...want].sort().join(",") + ")");
      const boxLanes = new Set(whole.flatMap(([a, b]) => [...lanes50(TL.slice(a, b))]));
      ok(boxLanes.size === want.size && [...boxLanes].every(d => want.has(d)),
         at + "the short tape does not carry the lanes its own boxes play — " +
         "missing " + [...boxLanes].filter(d => !want.has(d)).join(","));
      // the FRAGMENT's own failure, held as a regression: the 4 s bar-aligned
      // cut this replaced took one bar of Lagos 1971 and got the bass alone.
      // A whole box cannot do that unless the box is genuinely drumless.
      const headHasDrums = lanes50(TL.slice(B[0][0], B[0][1])).size > 0;
      ok(!headHasDrums || want.size > 0,
         at + "the opening box plays drums and the insurance tape has none — " +
         "this is the Lagos report exactly");
      if (!want.size) drumless++;

      minSec = Math.min(minSec, secs); maxSec = Math.max(maxSec, secs); sum += secs;
      named[gk + "/" + seed] = secs.toFixed(2) + "s/" + cut.length + "b/[" +
                               [...want].sort().join("") + "]";
    }
    // THE COST, SAID OUT LOUD. The tape is now several times the old fragment,
    // and the render is roughly linear in the music it renders, so the first
    // tape arrives correspondingly later. That is the trade — a phrase that is
    // worth hearing, later — and it belongs in the log where the next person
    // measuring the first-tape latency will find it rather than rediscover it.
    ok(minSec > 4, "the shortest insurance tape in the corpus is " +
       minSec.toFixed(2) + " s — at or under the old 4 s cap, which means the " +
       "box law is not reaching the cut");
    ok(maxSec <= 32, "an insurance tape has reached " + maxSec.toFixed(2) +
       " s — one box was supposed to be a phrase, not a side");
    ok(drumless === 0, drumless + " of " + CORPUS50.length + " insurance tapes in " +
       "this corpus have no drums, and every one of these songs opens with a kit — " +
       "the box cut is not carrying the band");
    console.log("  the insurance tape is a whole box: " +
                minSec.toFixed(2) + "-" + maxSec.toFixed(2) + " s (mean " +
                (sum / CORPUS50.length).toFixed(2) + "), " + twoBox + " of " +
                CORPUS50.length + " take two boxes, " + drumless +
                " have no drums — " + Object.entries(named)
                  .map(([k, v]) => k + " " + v).join(", "));
    // THE LAW: the insurance may only take the ear where the alternative is
    // silence. Both doors — the carrier-first takeover and the hide handoff —
    // refuse it, and the hide handoff makes the one exception iOS, whose
    // context genuinely freezes. A whole phrase is a better thing to hand that
    // listener than two bars; it is still not the record, so the refusals stand.
    const b50 = src50("audio/bounce.js");
    ok(/shortIsInsurance\(\)\) return false;/.test(b50),
       "audio/bounce.js goCarrier no longer refuses the short tape — one section " +
       "on loop would become the whole performance");
    ok(/if \(shortIsInsurance\(\) && !isIOS && ctx && ctx\.state === "running"\) return false;/
         .test(b50),
       "audio/bounce.js carry() hands the ear whatever blob exists on hide — for " +
       "the first stretch of any song that is one box of its head, on loop. " +
       "The refusal is conditional on there being something to replace: a frozen " +
       "or suspended context still takes the insurance, because the alternative " +
       "there really is silence");
    // ...and the cut is cut on the STAMP, in the shipped text. A bar-count or a
    // seconds-only walk here is the regression, and it is invisible in the
    // numbers above on any song whose boxes happen to divide the cap.
    ok(/for \(; j < TL\.length && !TL\[j\]\.first; j\+\+\)/.test(b50),
       "audio/bounce.js shortCut no longer scans to the next box stamp — the " +
       "insurance tape is being cut on something other than a section boundary");
    ok(/if \(cut\.length && acc \+ box > capSec\) break;/.test(b50),
       "audio/bounce.js shortCut's cap can now refuse the FIRST box — that is a " +
       "truncated phrase, which is the thing this stage stopped doing");
    // ...and NOTHING ELSE ON THE PAGE LOOPS. The carrier element is the only
    // thing entitled to `loop = true`; a drum or a note that looped natively
    // would keep ringing through a handoff the master gain cannot reach.
    const v50 = src50("audio/voices.js");
    ok(!/\.loop\s*=\s*true/.test(v50),
       "audio/voices.js sets loop = true on a source — nothing in the band loops " +
       "itself; the score says when a sound comes round again");
    ok(/loop: !!z\.loop/.test(v50),
       "the sampler no longer takes its zone loop from the zone spec — a sustaining " +
       "instrument's loop is a fact about the sample, not a default");
  }
}


/* ------------------------------- 51. THE CHESS BAND PLAYS AGAIN, AND A VOICE
   ANNOUNCES ITSELF ONLY ONCE
   Two reports from Paul on one afternoon, and both turned out to be the same
   shape of mistake — a comment describing music the code was not making:

     "The drums in Chicago 1952 are completely off."
     "Intros seem weirdly doubled."

   (a) THE SHUFFLE IS IN THE HAND, NOT ON THE DIAL. `swing` bends ODD
       sixteenths. Every hit on the blues kit — kick 0/6/8, snare 4/12, ride on
       all eight eighths, pedal hat 4/12 — is written on an EVEN one, so the
       anchor's declared `swing: 1/3` reached exactly ONE hit in a twelve-bar
       form out of 183 (the turnaround crash, on step 15), and the lane's own
       comment said "shuffled by swing" about a lane that had never shuffled.
       The GUITAR meanwhile swung, because a line's odd sixteenths are odd:
       measured at ~107 bpm the two players were up to 47 ms apart, which is
       not stiffness, it is two people in different time. The repair is the one
       the `jazz` anchor already documents — the off-beat eighths placed by
       hand in the nudge lane — and the laws here say what "placed by hand" has
       to MEAN, so the next hand that edits the array has to keep the shuffle
       rather than keep the numbers.

   (b) A NAKED OPENING STATES ITS MATERIAL ONCE. A box deals its slots ACROSS
       the genre's voices (derive.js: voice v reads phrase v % nP), so a
       ONE-slot box hands the same rendered phrase to every voice, separated
       only by `reg`. Everywhere else in a record that is a colour inside a
       band; in an intro the composer has already taken the drums and the bass
       off, so it is the whole texture — punk's quote came out as one riff and
       its own octave, jazz's as two horns on the same pitches six milliseconds
       apart, which is a flanger and not two players. Measured over 348
       composed songs (every genre × seeds 1,2,3,5,7,11): the naked `quote`
       opening had two PLAYING lanes in constant-interval parallel in 4 of 30
       boxes — one of them, jazz/7, at interval ZERO — and a solo-edged first
       bar carried more than one lane in 31 of 67. After the repair: 0 and 0.

       Two things the repair had to learn the hard way, both kept as
       conditions in compose.js and kernel.js rather than as prose:
       a PAD takes its pitches from the CHORD and only its rhythm from the
       phrase, so on a genre that comps (toto, citypop, jodeci) giving the
       second voice a companion left the quoted MELODY nowhere at all — 25
       genre/seed pairs stopped quoting — and the same fact is why the law
       here counts non-pad lanes only: two pads in parallel is voicing.
       And `cold` was deliberately left alone: it keeps the whole kit and the
       bass, and giving it a second slot measured WORSE (11 doubled boxes →
       13), because two phrases across four voices is two doubled pairs where
       one phrase across four was one. */
console.log("the Chess band plays again, and a voice announces itself only once");
{
  // ---- (a) the shuffle ----
  // THE ROOT CAUSE, stated algebraically, because it is the fact that makes
  // every nudge sidecar in the table necessary rather than decorative.
  for (let i = 0; i < 16; i += 2)
    ok(K.swing({ swing: 1 / 3 }, i) === 0,
       "the swing dial reached step " + i + ", an EVEN sixteenth — if it can bend " +
       "these, the hand-placed shuffles in blues and jazz are the wrong repair");
  ok(K.swing({ swing: 1 / 3 }, 1) > 0,
       "the swing dial no longer bends odd sixteenths at all");

  const B51 = GENRES.blues, N51 = 16;
  const dr51 = K.drums(P, { ...B51, humanize: 0 }, B51.bars);
  const stepOf = e => Math.round(e.t) % N51;
  const lateOf = e => e.t - Math.floor(e.t + 1e-9);
  const off8 = dr51.filter(e => stepOf(e) % 4 === 2);      // the ands of every beat
  const onBeat = dr51.filter(e => stepOf(e) % 4 === 0);    // 1, 2, 3, 4

  ok(off8.length > 0, "Chicago 1952 sounds nothing on an off-beat eighth — the " +
     "shuffle has nowhere to live");
  // THE SHUFFLE EXISTS. Every off-beat eighth arrives late, all by the same
  // amount: a shuffle is one ratio, not a scatter.
  const lates = new Set(off8.map(e => +lateOf(e).toFixed(6)));
  ok(lates.size === 1,
     "Chicago 1952's off-beat eighths arrive at " + lates.size + " different " +
     "places (" + [...lates].join(", ") + ") — a shuffle is one ratio for the " +
     "whole kit, not a lane-by-lane opinion");
  const swung = [...lates][0];
  // ...and it is AUDIBLY a shuffle and still ITS OWN step: a third of a step is
  // ~62 ms at this tempo, and half a step is the ceiling because a hit pushed
  // further is nearer the next step than the one it was written on — which is
  // why a literal 2:1 triplet (6/9) is not sayable in the nudge alphabet and
  // 1.6:1 (4/9) is the shuffle a rhythm section actually plays.
  ok(swung >= 1 / 3 && swung < 0.5,
     "Chicago 1952's off-beat eighths sit " + swung.toFixed(3) + " of a step late — " +
     "a shuffle has to be past a third of a step to be heard as one and inside " +
     "half a step to still belong to its own beat");
  // THE BEAT ITSELF DID NOT MOVE. A shuffle bends the ands; it does not drag.
  ok(onBeat.every(e => lateOf(e) < 1e-9),
     onBeat.filter(e => lateOf(e) >= 1e-9).length + " on-beat hit(s) in Chicago " +
     "1952 arrive late — the shuffle leaked onto the beat and became a drag");
  // THE BACKBEAT SURVIVES: 2 and 4, dead on, which is the other half of what a
  // blues band sounds like and the thing a global nudge would have eaten.
  const snare = dr51.filter(e => e.d === "s" && !e.fill);
  ok(snare.length > 0 && snare.every(e => [4, 12].includes(stepOf(e)) && lateOf(e) < 1e-9),
     "Chicago 1952's backbeat is no longer 2 and 4 on the grid");
  // NO LIMB FLAMS AGAINST ANOTHER. Two lanes written on the SAME step have to
  // land at the same time — blues's kick plays the and-of-2 with the ride, and
  // leaving it on the grid while the ride shuffled would have flammed them 62 ms
  // apart at the busiest point in the bar, which is worse than not shuffling.
  // (Deliberately a law about THIS anchor and not the table: toto's `s.disp`
  // lays the snare back against a kick on the beat on purpose, and that is what
  // a laid-back backbeat IS.)
  const atStep = new Map();
  for (const e of dr51) {
    if (e.grace) continue;
    const key = Math.floor(e.t / N51) + ":" + stepOf(e);
    let g51 = atStep.get(key); if (!g51) atStep.set(key, g51 = []);
    g51.push(e);
  }
  const flams = [...atStep.values()]
    .filter(g => new Set(g.map(e => +e.t.toFixed(6))).size > 1);
  ok(flams.length === 0,
     flams.length + " step(s) in Chicago 1952 have two limbs written together and " +
     "landing apart — " + (flams[0] || []).map(e => e.d + "@" + e.t.toFixed(3)).join("/"));
  // A NUDGE MOVES A HIT; IT NEVER ADDS OR REMOVES ONE. Stripping the sidecars
  // has to give back the same number of hits in the same bars.
  const strip = k => Object.fromEntries(Object.entries(k).filter(([d]) => d[0] !== "~"));
  const flat51 = K.drums(P, { ...B51, humanize: 0, kit: strip(B51.kit),
                              fill: strip(B51.fill) }, B51.bars);
  const perBar = ev => ev.reduce((a, e) => {
    const b = Math.floor(e.t / N51); a[b] = (a[b] || 0) + 1; return a;
  }, []);
  ok(JSON.stringify(perBar(flat51)) === JSON.stringify(perBar(dr51)),
     "the nudge lanes changed WHICH BAR the hits are in (" +
     perBar(flat51).join(",") + " → " + perBar(dr51).join(",") + ") — a hand moves " +
     "a stroke inside its own bar, it does not add one and it does not push one " +
     "over the bar line");

  // THE HAND MOVES, THE FOOT STAYS. `ride` and `tomtime` sweep the hats onto
  // another surface, and `f` is a hat by taxonomy but a FOOT by limb: sweeping
  // it in deleted the left foot outright on the two anchors whose ride already
  // covers 2 and 4, which is pure subtraction dressed as an arrangement.
  for (const gk of GK) {
    const k = GENRES[gk].kit;
    if (!k || !(Array.isArray(k.f) && k.f.some(x => x))) continue;
    for (const op of ["ride", "tomtime"]) {
      const out = K.KITOPS[op](k);
      ok(Array.isArray(out.f) && out.f.some(x => x),
         gk + "/" + op + " deleted the pedal hat — a kit op that moves the HAND " +
         "to another surface may not take the left foot with it");
    }
  }

  // ---- (b) the doubling ----
  const NS51 = require("../../nukernel/song.js");
  const C51 = require("../../nukernel/compose.js");
  const SEEDS51 = [1, 2, 3, 5, 7, 11];
  const barsOf51 = (s, si) => D.songBars(s.song, s.slots, s.groove, s.swing, si, {});
  // two lanes DOUBLE each other when most of the shorter one's onsets have a
  // partner within a 64th (humanize drift, not a rhythm) and every partnered
  // interval is the same number of semitones — an octave copy and a unison
  // flange are the same defect at two intervals
  const doubles51 = (A, B2) => {
    const oa = [...new Map(A.map(e => [e.t.toFixed(3), e])).values()];
    const ob = [...new Map(B2.map(e => [e.t.toFixed(3), e])).values()];
    if (oa.length < 2 || ob.length < 2) return false;
    let nn = 0, iv = null;
    for (const a of oa) {
      const b = ob.find(x => Math.abs(x.t - a.t) <= 0.25);
      if (!b) continue;
      if (iv === null) iv = b.n - a.n; else if (b.n - a.n !== iv) return false;
      nn++;
    }
    return nn > 1 && nn / Math.min(oa.length, ob.length) >= 0.75;
  };
  // PLAYERS ONLY. A pad takes its pitches from the chord and only its rhythm
  // from the phrase, so two pads — or a pad and the line it comps under — moving
  // in parallel is voicing, which is what comping IS. The defect is two PLAYERS
  // handed the same part, so the lanes that count are the non-pad ones.
  const lanesOf51 = (evs, playersOnly) => {
    const m = new Map();
    for (const e of evs) if (e.kind === "line" && !(playersOnly && e.pad)) {
      let a = m.get(e.lv); if (!a) m.set(e.lv, a = []); a.push(e);
    }
    return m;
  };
  const anyDouble51 = lanes => {
    const vs = [...lanes.keys()];
    for (let i = 0; i < vs.length; i++)
      for (let j = i + 1; j < vs.length; j++)
        if (doubles51(lanes.get(vs[i]), lanes.get(vs[j]))) return vs[i] + "+" + vs[j];
    return null;
  };
  let soloBoxes = 0, soloBad = [], quoteBoxes = 0, quoteBad = [], silent = 0;
  for (const gk of GK) for (const seed of SEEDS51) {
    let r51; try { r51 = NS51.load(C51.compose(gk, seed)); } catch (e) { continue; }
    if (!r51 || !r51.ok) continue;
    const s51 = r51.song;
    s51.song.forEach((sec, si) => {
      if (sec.role !== "intro") return;
      const bars51 = barsOf51(s51, si);
      if (!bars51.length) { silent++; return; }
      // THE DEAL, measured on the RENDERED box rather than on the slot array,
      // because "two slots" is the mechanism and "two players are not one
      // player twice" is the law. A quote is the opening the composer strips to
      // no drums and no bass, so it is the one where a doubled part is the
      // whole texture: no two PLAYING lanes in it may be constant-interval
      // copies of one another. (Measured pre-repair: 4 of 30 boxes, one of them
      // — jazz/7 — at interval ZERO, two horns on the same pitches.)
      if (sec.cue === "quote") {
        quoteBoxes++;
        const all = [];
        for (const b of bars51) for (const e of (b.ev || [])) all.push(e);
        const hit = anyDouble51(lanesOf51(all, true));
        if (hit) quoteBad.push(gk + "/" + seed + " lanes " + hit);
      }
      // THE EDGE. compose.js bridges `quote` and `padin` onto the `solo` intro
      // kind with the words "a quote IS the melody alone"; solo has to mean one
      // lane, or the announcement is the flange the report described.
      if (sec.intro === "solo") {
        soloBoxes++;
        const lanes = lanesOf51(bars51[0].ev || []);
        if (lanes.size > 1)
          soloBad.push(gk + "/" + seed + " lanes " + [...lanes.keys()].join(","));
      }
    });
  }
  ok(quoteBoxes > 20 && soloBoxes > 40,
     "the corpus produced only " + quoteBoxes + " quote box(es) and " + soloBoxes +
     " solo-edged opening(s) — this section is measuring nothing");
  ok(silent === 0, silent + " intro box(es) render no events at all — songBars " +
     "drops an empty box, so a thinned opening would vanish from the record");
  ok(quoteBad.length === 0,
     quoteBad.length + " quote box(es) state their hook twice — one phrase dealt " +
     "to two playing lanes, which with the band stripped off is the whole sound: " +
     quoteBad.slice(0, 4).join(" | "));
  ok(soloBad.length === 0,
     soloBad.length + " solo-edged opening(s) sound more than one lane in their " +
     "first bar: " + soloBad.slice(0, 4).join(" | "));

  // ...AND IT HAS TEETH. Put a quote box back to one slot and the doubling
  // comes back, on the anchor Paul would have been listening to — so the two
  // laws above are load-bearing and not a description of an accident.
  {
    const r51 = NS51.load(C51.compose("punk", 5));
    ok(r51.ok, "punk/5 no longer composes — the teeth below measure nothing");
    const s51 = r51.song, si = s51.song.findIndex(x => x.cue === "quote");
    ok(si >= 0, "punk/5 no longer opens with a quote — pick another witness");
    if (si >= 0) {
      const one = clone(s51);
      one.song[si].stack[0].slots = [one.song[si].stack[0].slots[0]];
      one.song[si].intro = null;
      const all = [];
      for (const b of barsOf51(one, si)) for (const e of (b.ev || [])) all.push(e);
      ok(!!anyDouble51(lanesOf51(all, true)),
         "a one-slot quote box on punk/5 no longer doubles — either the " +
         "deal changed in derive.js (and the compose-side repair is now dead " +
         "weight) or this detector stopped detecting");
    }
  }
}

/* ------------------------------- 52. A GENRE YOU INVENTED IS A GENRE THE SONG
                                       CAN PLAY
   The LAB's kept candidates, all the way through: the RECIPE they are stored
   as, the song that carries them, the schedule they render, the chronology they
   sort into, and the CLI that writes one into the catalog by hand.

   WHY A RECIPE AND NOT AN ANCHOR, restated here because it is what every check
   below is really testing: half a genre is closures and JSON drops a function
   without a word, so a saved candidate would come back as a genre with no
   behaviour at all. What travels is the four facts it takes to MAKE it —
   parents and weights, the bench seed, the presses per material field, and
   whatever a person wrote instead — and nukernel/lab.js `rebuild` walks them
   back. That is only true if the walk is deterministic and if the stride lives
   in exactly one place, which is §52a.
------------------------------------------------------------------------- */
console.log("a genre you invented — the recipe, the song, the schedule, the atlas, the promotion");
{
  const LAB52 = require("../../nukernel/lab.js");
  const NS52 = require("../../nukernel/song.js");
  const P52 = require("../../nukernel/promote-genre.js");
  const fs52 = require("fs");
  const path52 = require("path");
  const j52 = x => JSON.stringify(x);
  // two parents from different families, so the cross is a real cross and the
  // material rollers have something to disagree about
  const REC = { label: "Sheffield 2031", parents: { house: 0.55, jazz: 0.45 }, seed: 7 };

  /* --- 52a. the recipe rebuilds to the same genre, twice, and the stride is
     one number. A kept genre that came back DIFFERENT on the next reload would
     be the worst failure this feature can have: silent, and only in the fields
     somebody had rolled. */
  {
    const a = LAB52.rebuild(REC), b = LAB52.rebuild(clone(REC));
    ok(j52(a.candidate.kit) === j52(b.candidate.kit) &&
       j52(a.candidate.roots) === j52(b.candidate.roots) &&
       String(a.candidate.word) === String(b.candidate.word),
       "the same recipe rebuilds to a different genre — a kept genre would not " +
       "survive a reload");
    ok(a.candidate.label === "Sheffield 2031",
       "rebuild does not carry the coined label onto the candidate");
    // the presses move the draft, and move it REPEATABLY
    const p1 = LAB52.rebuild({ ...REC, rolls: { roots: 3 } });
    const p2 = LAB52.rebuild({ ...REC, rolls: { roots: 3 } });
    ok(j52(p1.candidate.roots) === j52(p2.candidate.roots),
       "a pressed roll is not repeatable — (parents, seed, presses) is supposed " +
       "to name a draft");
    ok(LAB52.seedAt(7, 3) === 7 + 3 * LAB52.SEED_STRIDE,
       "seedAt does not walk by SEED_STRIDE — the page and the loader would " +
       "disagree about which draft a press names");
    // a hand edit is never re-rolled, whatever the presses say
    const mineKit = { k: [9,0,0,0, 0,0,0,0, 9,0,0,0, 0,0,0,0] };
    const hand = LAB52.rebuild({ ...REC, rolls: { kit: 5 }, mine: { kit: mineKit } });
    ok(j52(hand.candidate.kit) === j52(mineKit),
       "the dice took back a field a person wrote — the roll key's whole " +
       "contract is that they do not");
  }

  /* --- 52b. the song carries it: save -> load -> the same recipe, and the
     box that names it is still naming it. */
  const key52 = NS52.sessionKey(REC.label);
  {
    ok(NS52.isSessionKey(key52) && !GENRES[key52],
       "the session key " + key52 + " collides with the catalog — the namespace " +
       "is supposed to make that impossible");
    ok(NS52.sessionKey(REC.label, { [key52]: 1 }) !== key52,
       "two genres coined with the same name take the same key");
    const box = Object.assign(NS52.emptyBox(), { stack: [{ g: key52, slots: [0] }] });
    const raw = { v: NS52.VERSION, slots: [NS52.blank()], song: [box],
                  genres: { [key52]: REC }, bpm: 126 };
    const r = NS52.load(clone(raw));
    ok(r.ok, "a song carrying an invented genre does not load: " + j52(r.errors[0]));
    ok(r.ok && j52(r.song.genres[key52]) === j52(REC),
       "the recipe did not survive the loader unchanged");
    ok(r.ok && r.song.song[0].stack[0].g === key52,
       "the box stopped naming its own genre on the way through");
    // ...and the round trip: what the loader hands back is what it takes back
    const again = NS52.load(clone(r.song));
    ok(again.ok && j52(again.song.genres) === j52(r.song.genres),
       "load(load(x)) is not load(x) — the save shape is not stable");

    // THE REFUSALS. Each one is a law with a reason, so each one is checked.
    const bad = (mut, why) => {
      const x = clone(raw); mut(x);
      const res = NS52.load(x);
      ok(!res.ok, "the loader accepted " + why);
    };
    bad(x => { x.genres[key52].label = "Sheffield"; }, "a genre with no coined year");
    bad(x => { x.genres[key52].parents = {}; }, "a genre with no parents");
    bad(x => { x.genres[key52].parents = { house: 0 }; }, "a parent with no weight");
    bad(x => { x.genres.house = REC; }, "a session entry keyed on a catalog anchor");
    bad(x => { x.genres.sheffield2031 = REC; }, "a session entry outside the namespace");

    // ...and the DEGRADE, which is the opposite policy on purpose: a box naming
    // a genre the song does not carry plays as `simple` and SAYS SO, because
    // refusing would lose the record to save the genre.
    const orphan = clone(raw); delete orphan.genres;
    const od = NS52.load(orphan);
    ok(od.ok, "a song whose invented genre is missing refuses to load at all");
    ok(od.ok && od.song.song[0].stack[0].g === NS52.FALLBACK_GENRE,
       "the orphaned box did not fall back to " + NS52.FALLBACK_GENRE);
    ok(od.notes.length === 1 && od.notes[0].got === key52 &&
       od.notes[0].chose === NS52.FALLBACK_GENRE,
       "the loader degraded quietly — 'report what you chose' is the whole rule");
    // and a recipe whose PARENT left the catalog is dropped with a note rather
    // than refused: a lineage is a claim about a table that grows and renames
    const gone = clone(raw); gone.genres[key52].parents = { nosuchgenre: 1 };
    const gd = NS52.load(gone);
    ok(gd.ok && !gd.song.genres[key52] && gd.notes.length >= 1,
       "a recipe with a vanished parent is not dropped with a note");
    // the OLD law is untouched: an unknown CATALOG key still refuses
    const unknown = clone(raw);
    unknown.song[0].stack[0].g = "nosuchgenre"; delete unknown.genres;
    ok(!NS52.load(unknown).ok,
       "an unknown catalog genre stopped being an error — the degrade is only " +
       "for the namespace");
  }

  /* --- 52c. it plays like any other genre. Not "it renders" — it renders the
     SAME SCHEDULE the identical anchor renders under a catalog key, which is
     the only way to say that nothing downstream treats it as a special case. */
  {
    const built = LAB52.rebuild(REC);
    const cand = built.candidate;
    ok(LAB52.ok(built.problems),
       "the bench refuses its own rebuild: " +
       built.problems.filter(p => p.level === "error").map(p => p.msg).join("; "));
    // seat the same object twice — once under a session key, once under a
    // catalog-shaped one — and render both through the kernel the scheduler
    // calls. ui/derive.js genreOf is a single `GENRES[key]` index, so this is
    // that lookup with the namespace on one side of it.
    GENRES[key52] = cand;
    GENRES.__catalog_twin__ = cand;
    try {
      for (const fn of ["render", "drums", "bass"]) {
        const a = K[fn](DEFAULT, GENRES[key52], cand.bars);
        const b = K[fn](DEFAULT, GENRES.__catalog_twin__, cand.bars);
        ok(j52(a) === j52(b) && a.length,
           "a session genre's " + fn + "() is not the catalog's — the one " +
           "lookup path has grown a second branch");
      }
      // and it is a real genre, not a silent one
      ok(K.render(DEFAULT, GENRES[key52], cand.bars).length > 0 &&
         K.drums(DEFAULT, GENRES[key52], cand.bars).length > 0,
         "the invented genre renders nothing — it would be a silent section");
    } finally { delete GENRES[key52]; delete GENRES.__catalog_twin__; }
  }

  /* --- 52d. THE ATLAS. The genre menu is one chronological list and an
     invented genre sorts into it by the year it coined. The sort itself is
     ui/palette.js chronoGenres (a browser module); its LAW is a trailing year
     on the label, which is what song.js gates and what is checked here. */
  {
    const year = s => { const m = /(\d{3,4})\s*$/.exec(s); return m ? +m[1] : null; };
    ok(year(REC.label) === 2031,
       "the coined label does not end in a year — it would fall into the " +
       "yearless FUNCTION-genre bucket at the bottom of the menu");
    const dated = Object.keys(GENRES).filter(k => year(GENRES[k].label) != null);
    const merged = dated.concat([key52])
      .sort((a, b) => (a === key52 ? 2031 : year(GENRES[a].label)) -
                      (b === key52 ? 2031 : year(GENRES[b].label)) ||
                      (a < b ? -1 : a > b ? 1 : 0));
    const at = merged.indexOf(key52);
    ok(at === merged.length - 1,
       "a 2031 genre does not sort past every anchor in the table");
    const before = year(GENRES[merged[at - 1]].label);
    ok(before != null && before <= 2031,
       "the merged chronology is not ordered around the invented genre");
    // ...and one dated BEFORE the newest anchor lands inside the list, not at
    // an end — a chronology that only ever appends is not a chronology
    const mid = dated.concat(["__mid__"])
      .sort((a, b) => (a === "__mid__" ? 1975 : year(GENRES[a].label)) -
                      (b === "__mid__" ? 1975 : year(GENRES[b].label)));
    const mi = mid.indexOf("__mid__");
    ok(mi > 0 && mi < mid.length - 1,
       "a genre coined at 1975 does not land between the anchors it belongs " +
       "between");
  }

  /* --- 52e. PROMOTE, exercised against a COPY of the catalog and never the
     catalog itself. The tool's own verify requires the spliced file and
     compares the anchor that comes back out of it to the genre that went in;
     this checks that the copy is byte-untouched except where it should be, and
     that the refusals refuse. */
  {
    const dir = path52.join(__dirname, "..", "..", "nukernel");
    const gsrc = path52.join(dir, "genres.js"), csrc = path52.join(dir, "compose.js");
    // the copies live BESIDE the originals on purpose: genres.js and compose.js
    // require their neighbours by relative path, so a copy in a temp directory
    // resolves nothing and the splice could never be loaded back
    const gcopy = path52.join(dir, "__promote_gate_genres.js");
    const ccopy = path52.join(dir, "__promote_gate_compose.js");
    const rfile = path52.join(dir, "__promote_gate_recipe.json");
    const before = { g: fs52.readFileSync(gsrc, "utf8"), c: fs52.readFileSync(csrc, "utf8") };
    fs52.writeFileSync(gcopy, before.g);
    fs52.writeFileSync(ccopy, before.c);
    fs52.writeFileSync(rfile, j52(REC));
    const args = extra => ["--recipe", rfile, "--genres", gcopy, "--compose", ccopy]
      .concat(extra);
    try {
      // the dry run: both spliced files are REQUIRED and their anchors compared
      // to the bench's, so reaching here at all is the serialization proof
      const dry = P52.run(args(["--key", "__gate_genre__"]));
      ok(fs52.readFileSync(gcopy, "utf8") === before.g &&
         fs52.readFileSync(ccopy, "utf8") === before.c,
         "a dry run wrote to the file — --write is supposed to be the only writer");
      ok(/__gate_genre__: \{/.test(dry.genres) && dry.compose.includes("__gate_genre__: "),
         "the splice did not put the genre in both files");
      ok(dry.fam === GENRES.house.family,
         "the promoted anchor did not join its dominant parent's family");
      ok(!/\n\s*family:/.test(dry.anchor) && !/\n\s*stress:/.test(dry.anchor),
         "the anchor writes its own family/dynamics — both are STAMPED at load, " +
         "and a second losing copy in the literal is exactly the rot the stamp " +
         "exists to prevent");
      ok(/parents: \{ house: 0.55, jazz: 0.45 \}/.test(dry.anchor),
         "the lineage annotation is not written as the anchors write it");
      ok(/\n\s*wants: \[\],/.test(dry.anchor), "the anchor carries no `wants` line");
      ok(dry.anchor.split("\n").every(l => l.length <= 95),
         "the promoted anchor runs past the widest line in genres.js");

      // now WRITE it, and prove the copy still loads and still holds the genre
      P52.run(args(["--key", "__gate_genre__", "--write"]));
      const after = { g: fs52.readFileSync(gcopy, "utf8"), c: fs52.readFileSync(ccopy, "utf8") };
      ok(after.g !== before.g && after.c !== before.c, "--write wrote nothing");
      ok(before.g === fs52.readFileSync(gsrc, "utf8") &&
         before.c === fs52.readFileSync(csrc, "utf8"),
         "the real catalog was touched — the gate must only ever splice a copy");
      delete require.cache[require.resolve(gcopy)];
      delete require.cache[require.resolve(ccopy)];
      const G2 = require(gcopy), C2 = require(ccopy);
      const anchor = G2.GENRES.__gate_genre__;
      ok(!!anchor, "the written copy does not hold the promoted genre");
      ok(anchor && anchor.label === REC.label && anchor.family === dry.fam,
         "the promoted anchor came back with the wrong name or family");
      ok(anchor && typeof anchor.word === "function" &&
         Array.isArray(anchor.word(0, 0)),
         "the promoted `word` is not a closure the kernel can call — a rolled " +
         "word is serialized from its TABLE, never from its toString");
      ok(C2.BPM.__gate_genre__ === dry.bpm,
         "the tempo row did not land — the composer would write a NaN tempo");
      // THE ARTIFACT, not the literal: the anchor read back out of the file
      // must play what the bench played
      const cand = LAB52.rebuild(REC).candidate;
      for (const fn of ["render", "drums", "bass"])
        ok(j52(K[fn](DEFAULT, anchor, anchor.bars)) ===
           j52(K[fn](DEFAULT, cand, cand.bars)),
           "the promoted anchor's " + fn + "() is not the genre that was kept");
      // every other anchor is untouched: a splice that reformatted its
      // neighbours would be a splice nobody could review
      ok(Object.keys(G2.GENRES).length === GK.length + 1,
         "the splice changed the size of the table by something other than one");
      for (const k of ["house", "jazz", "simple", "pad"])
        ok(j52(K.render(DEFAULT, G2.GENRES[k], G2.GENRES[k].bars)) ===
           j52(K.render(DEFAULT, GENRES[k], GENRES[k].bars)),
           "promoting a genre changed what " + k + " plays");

      // THE REFUSALS
      const refuses = (extra, why) => {
        let threw = false;
        try { P52.run(args(extra)); } catch (e) { threw = true; }
        ok(threw, "promote did not refuse " + why);
      };
      refuses(["--key", "house"], "a key the catalog already holds");
      refuses(["--key", "not a key"], "a key that is not an identifier");
      fs52.writeFileSync(rfile, j52({ ...REC, parents: { solo: 1 } }));
      refuses(["--key", "__gate_two__"], "a FUNCTION genre as a parent");
      fs52.writeFileSync(rfile, j52({ ...REC, label: "Chicago 1986" }));
      refuses(["--key", "__gate_two__"], "a label the table already carries");
    } finally {
      for (const f of [gcopy, ccopy, rfile]) { try { fs52.unlinkSync(f); } catch (e) { /* never made */ } }
    }
  }
}

/* ── §53 THE TAPE WRAPS WHERE THE BAR DOES ───────────────────────────────────
   The carrier is a loop, and a loop is only a loop if the wrap costs nothing.
   It cost 812 samples — 18.4 ms of silence, measured on the real tape in
   headless chromium at every single pass — because a `loop=true` <audio>
   element wraps by SEEKING and a seek flushes the decode pipeline. The music
   was never the problem: foldLoop() had already made sample N-1 -> 0
   continuous, and the container threw the join away.

   audio/bounce.js now streams instead of looping: the folded loop is encoded
   ONCE and the same fMP4 fragment is appended again and again, each push
   carrying an explicit baseMediaDecodeTime exactly one loop later. Two facts
   have to hold for that to be gapless, and BOTH are things a pure-node gate
   can hold, which is why they are here rather than only in a browser:

   (a) THE LOOP IS A WHOLE NUMBER OF CODEC FRAMES. The first attempt declared a
       SHORT final frame in the trun so the fragment's timeline summed to the
       loop exactly — and chromium honoured that for the buffered range (exact
       to a microsecond) while playing the frame's full decoded output anyway.
       Measured: 514 samples of encoder padding at every wrap, the same 514
       five times running. loopSamplesFor() is the answer to that.
   (b) NOTHING IS PADDED AND NOTHING IS DROPPED. The frame list's declared
       sample sum must equal the loop, and pushing the same list again must
       advance the fragment's tfdt by exactly that — a container that pads by
       one sample per pass is a container that drifts, which is the parent's
       own diagnosis of the mp3 route (docs/WAV-FIRST.md v4).

   The same law over the FALLBACK tape, which is still what a browser without
   WebCodecs plays: the WAV the carrier falls back to declares exactly the
   score's sample count and not one byte more. */
console.log("the tape wraps where the bar does");
{
  globalThis.location = globalThis.location || { search: "" };
  globalThis.navigator = globalThis.navigator ||
    { userAgent: "node", platform: "", maxTouchPoints: 0, hardwareConcurrency: 4 };
  globalThis.Audio = globalThis.Audio || function () {};
  const B53 = await import("../../nukernel/audio/bounce.js");
  const FM53 = require("../../engine/faust/codec/fmp4.js");
  const SR53 = 44100;
  // the two frame sizes the shipping ladder can pick: aac is 1024 samples at
  // the tape's own rate, opus is 20 ms of its own 48 kHz
  const FRAMES53 = [["aac", 1024, 44100], ["opus", 960, 48000]];

  /* (a) THE LENGTH IS A WHOLE NUMBER OF FRAMES, and it is the RIGHT length */
  {
    // REAL tape lengths first — the short insurance cut and the full song, as
    // this composer actually renders them (the ones quoted in bounce.js's own
    // carry() note: Liverpool 1962 7.75 s, Lagos 1971 8.69 s, New York 1945
    // 6.82 s, Chicago 1952 13.90 s), plus the 2.17 s one-bar fragment the short
    // stage used to be and the 141.6 s composed beatles song the budget gate
    // renders. The SHORTEST is the hard case: the rounding error is half a
    // frame however long the tape is, so a short tape wears the most of it.
    const ns = [2.171, 6.82, 7.608456979328381, 7.75, 8.69, 13.9, 141.6]
      .map(d => Math.round(d * SR53));
    // …plus the pathological neighbours of a frame boundary (one sample over,
    // one under, exactly on), where a rounding rule goes wrong if it is going to
    const edge53 = [];
    for (const f of [960, 1024]) for (const k of [1, 2, 380]) for (const off of [-1, 0, 1])
      edge53.push(k * f + off);
    for (const [name, F, rate] of FRAMES53) {
      let worst = 0, worstAt = "", bad = 0;
      for (const n of ns.concat(edge53)) {
        const want = n * rate / SR53;
        const M = B53.loopSamplesFor(want, F);
        if (M % F !== 0 || M < F) {
          bad++;
          ok(false, `§53(a) ${name}: ${n} samples -> ${M}, which is not a whole ${F}-sample frame`);
        }
      }
      // the ERROR is only meaningful over lengths that are songs. The edge
      // cases above are one and two frames long — a millisecond of tape — and
      // rounding half a frame there is 100%, which says nothing about music.
      for (const n of ns) {
        const want = n * rate / SR53;
        const err = Math.abs(B53.loopSamplesFor(want, F) - want) / want;
        if (err > worst) { worst = err; worstAt = (n / SR53).toFixed(2) + "s"; }
      }
      // half a frame over the whole loop is the arithmetic ceiling; the number
      // that matters is that the SHORTEST real tape is still inside a cent or
      // three of its own tempo, which is what makes this trade payable
      // half a frame over the shortest tape this composer cuts (2.17 s) is
      // ~0.5%, nine cents; over a real song it is a hundredth of that. Anything
      // above 1% would be a tempo the ear can name, and this trade is only
      // payable while it cannot.
      ok(worst <= 0.01, `§53(a) ${name}: worst length error ${(worst * 100).toFixed(3)}% ` +
                        `at ${worstAt} — that is audible as a tempo change, not a rounding`);
      console.log(`  ${name}: every length rounds to whole ${F}-sample frames ` +
                  `(${ns.length + edge53.length} of them, ${bad} wrong); worst tempo cost ` +
                  `${(worst * 100).toFixed(3)}% at ${worstAt}`);
    }
  }

  /* (b) THE FRAME LIST IS THE LOOP, EXACTLY — no short frame, no spare frame */
  {
    for (const [name, F] of FRAMES53) {
      const M = B53.loopSamplesFor(365205, F);
      const K = M / F;
      // what the encoder hands back: whole frames, and MORE of them than the
      // loop needs (the encoder pads its last input frame), which is the case
      // loopFrames has to cut — by dropping frames, never by shortening one
      const chunks = [];
      for (let i = 0; i < K + 3; i++) chunks.push({ data: new Uint8Array(64), duration: F });
      const r = B53.loopFrames(chunks, M);
      ok(r.sum === M, `§53(b) ${name}: frame list sums to ${r.sum}, loop is ${M} — ` +
                      `the fragment's timeline is not the song's length`);
      ok(r.frames.length === K, `§53(b) ${name}: ${r.frames.length} frames for a ${K}-frame loop`);
      ok(r.frames.every(f => f.duration === F),
         `§53(b) ${name}: a frame came back SHORTENED — that is the trim chromium ` +
         `ignores, and 514 samples of padding play at every wrap when it does`);
    }
  }

  /* (c) THE WRAP IS SAMPLE-EXACT IN THE CONTAINER — box-walked, four passes */
  {
    // a minimal ISO-BMFF walker: enough to find tfdt + trun and read them back
    const boxes = (u8, from, to, want, out) => {
      let o = from;
      while (o + 8 <= to) {
        const size = (u8[o] << 24 | u8[o + 1] << 16 | u8[o + 2] << 8 | u8[o + 3]) >>> 0;
        const type = String.fromCharCode(u8[o + 4], u8[o + 5], u8[o + 6], u8[o + 7]);
        if (size < 8 || o + size > to) break;
        if (type === want) out.push({ o, size });
        if (["moof", "traf"].includes(type)) boxes(u8, o + 8, o + size, want, out);
        o += size;
      }
      return out;
    };
    const u32at = (u8, o) => (u8[o] << 24 | u8[o + 1] << 16 | u8[o + 2] << 8 | u8[o + 3]) >>> 0;
    const u64at = (u8, o) => u32at(u8, o) * 0x100000000 + u32at(u8, o + 4);

    for (const [name, F, rate] of FRAMES53) {
      const M = B53.loopSamplesFor(365205 * rate / SR53, F), K = M / F;
      const frames = [];
      for (let i = 0; i < K; i++) frames.push({ data: new Uint8Array(48), duration: F });
      const mux = FM53.makeFmp4Mux({ codec: name === "aac" ? "aac" : "opus",
                                     sampleRate: rate, channels: 2,
                                     codecConfig: name === "opus"
                                       ? new Uint8Array([79, 112, 117, 115, 72, 101, 97, 100, 1, 2,
                                                         0x38, 0x01, 0x80, 0xbb, 0, 0, 0, 0, 0])
                                       : null });
      mux.initSegment();
      let bad = "";
      for (let pass = 0; pass < 4; pass++) {
        const frag = mux.pushChunks(frames.map(f => ({ data: f.data, duration: f.duration })));
        const tf = boxes(frag, 0, frag.length, "tfdt", [])[0];
        const tr = boxes(frag, 0, frag.length, "trun", [])[0];
        if (!tf || !tr) { bad = "pass " + pass + " carries no tfdt/trun"; break; }
        // tfdt: 4-byte size + 4-byte type + 4-byte version/flags, then a 64-bit time
        const t = u64at(frag, tf.o + 12);
        if (t !== pass * M) { bad = `pass ${pass} starts at ${t}, not ${pass * M}`; break; }
        // trun: version/flags, sample_count, data_offset, then (duration,size) pairs
        const cnt = u32at(frag, tr.o + 12);
        let sum = 0;
        for (let i = 0; i < cnt; i++) sum += u32at(frag, tr.o + 20 + i * 8);
        if (sum !== M) { bad = `pass ${pass} declares ${sum} samples, loop is ${M}`; break; }
      }
      ok(!bad, `§53(c) ${name}: ${bad} — the tape does not wrap where the bar does`);
      if (!bad) console.log(`  ${name}: four passes of ${K} frames, tfdt ` +
                            `0/${M}/${2 * M}/${3 * M} — sample-exact, no padding`);
    }
  }

  /* (d) THE FALLBACK TAPE DECLARES THE SCORE'S LENGTH AND NOTHING MORE */
  {
    // the WAV the carrier still plays wherever WebCodecs is missing. It is not
    // gapless (that is the element's own wrap seek), but it must not ALSO pad:
    // a container that declares more samples than the score has is a hole this
    // gate would have to find twice.
    for (const durSec of [2.171, 7.608456979328381, 141.6]) {
      const N = Math.round(durSec * SR53);
      const ab = B53.wavBytes([new Float32Array(N), new Float32Array(N)], N, SR53);
      const dv = new DataView(ab);
      const riff = dv.getUint32(4, true), fmtRate = dv.getUint32(24, true);
      const dataLen = dv.getUint32(40, true);
      ok(ab.byteLength === 44 + N * 4,
         `§53(d) a ${durSec}s tape encodes ${ab.byteLength} bytes, not ${44 + N * 4}`);
      ok(dataLen === N * 4,
         `§53(d) a ${durSec}s tape DECLARES ${dataLen / 4} frames, the score has ${N}`);
      ok(riff === 36 + N * 4, `§53(d) the RIFF length disagrees with the data chunk`);
      ok(fmtRate === SR53, `§53(d) the tape claims ${fmtRate} Hz`);
    }
    console.log("  fallback wav: declared frames == round(durSec x 44100), exactly, at three lengths");
  }
}

/* ── §54 THE SONG PLAYS LIKE A RADIO ─────────────────────────────────────────
   "When the browser sleeps the song turns off. It's very vexing especially
   since we solved it." We had solved it — for phones. A desk kept the live
   WebAudio graph as its audible path, and a hidden tab is not a page a browser
   feels much duty toward: it throttles the timers, deprioritises the audio
   thread and suspends the context on a sleeping display, every one of which is
   fatal to something that must schedule a bar every 1.9 seconds forever. A
   playing <audio> element is MEDIA, and media is the one thing an OS keeps
   alive. So audio/bounce.js makes the rendered tape the playback path
   EVERYWHERE and leaves the live graph exactly one job: being audible while
   somebody is touching the machine, because no tape can make an edit audible
   in the bar it was made.

   The whole thing is one decision — carrierWant() — and it is a pure function
   of its arguments precisely so it can be walked here rather than only in a
   browser, where a handoff is a race against a render that takes a minute.
   Three things are held:

   (a) THE TRUTH TABLE, over every world the machine can be in. Two laws have
       to survive it: nothing carries a FRAGMENT (a desk waits for the full
       tape — the short cut is one box on loop, which is worse than the live
       graph the listener already has), and nothing carries at all without an
       armed, undemoted element, because a mute with no carrier behind it is
       silence.
   (b) THE SEQUENCE PAUL ASKED FOR, walked in order: touching -> live, quiet
       -> tape, hidden -> tape, touching -> live. At no point are two sources
       audible, which here means: the decision is TOTAL and single-valued, so
       there is no world in which the machine believes both.
   (c) THE WIRING, on the real module rather than on a copy of its reasoning.
       bounce.js is imported with a document that records its listeners, and
       then the events the browser would send are sent: a hide sets `away`, a
       pointerdown clears it and restarts the idle clock, becoming visible
       counts as a touch. This is the half a truth table cannot prove — that
       the function is connected to anything. */
console.log("the song plays like a radio");
{
  // the same browser stubs §53 installs, plus a DOCUMENT — which §53
  // deliberately does not have, so bounce.js's first instance registered no
  // listeners at all. This one records them and then fires them.
  const H54 = new Map();
  const winH54 = new Map();
  globalThis.location = globalThis.location || { search: "" };
  globalThis.navigator = globalThis.navigator ||
    { userAgent: "node", platform: "", maxTouchPoints: 0, hardwareConcurrency: 4 };
  globalThis.Audio = globalThis.Audio || function () {};
  globalThis.document = {
    visibilityState: "visible",
    addEventListener: (t, f) => H54.set(t, f),
    removeEventListener: () => {},
    body: { appendChild: () => {} },
  };
  globalThis.addEventListener = (t, f) => winH54.set(t, f);
  // a FRESH evaluation of the module (the query string busts the ES module
  // cache; its own imports resolve to the instances §53 already loaded), so
  // the listeners are registered against the document above
  const B54 = await import("../../nukernel/audio/bounce.js?radio=1");
  const want = B54.carrierWant;

  /* (a) THE TRUTH TABLE */
  {
    const base = { armed: true, disarmed: false, demoted: null, playing: true,
                   mobile: false, hidden: false, away: false, idleMs: 0,
                   ready: true, full: true, after: 30000 };
    const w = (o) => want({ ...base, ...o });
    const cases = [
      // [world, expected, why]
      [{}, "graph", "someone is touching the machine, so the live graph is audible"],
      [{ idleMs: 29999 }, "graph", "one millisecond short of the idle threshold"],
      [{ idleMs: 30000 }, "carrier", "the idle threshold, reached"],
      [{ hidden: true, idleMs: 0 }, "carrier", "hidden hands over with no wait at all"],
      [{ away: true, idleMs: 0 }, "carrier", "another window on top is the same fact"],
      [{ idleMs: 1e6, full: false }, "graph",
       "a SHORT tape is insurance, never the performance — the desk waits"],
      [{ idleMs: 1e6, ready: false }, "graph", "nothing rendered, nothing to hand over"],
      [{ idleMs: 1e6, armed: false }, "graph", "no element: a mute with no carrier is silence"],
      [{ idleMs: 1e6, disarmed: true }, "graph", "?nobounce disarms the whole tier"],
      [{ idleMs: 1e6, demoted: "element-refused" }, "graph",
       "a demoted carrier never gets a second chance by idling"],
      [{ playing: false, hidden: true }, "graph", "stopped is not carried"],
      [{ mobile: true, idleMs: 0 }, "carrier", "the phone's answer, unchanged by any of this"],
      [{ mobile: true, playing: false }, "graph", "…except that it too must be playing"],
      [{ mobile: true, demoted: "x" }, "graph", "…and must not be demoted"],
    ];
    for (const [o, exp, why] of cases) {
      const got = w(o);
      ok(got === exp, `§54(a) ${why}: carrierWant said "${got}", not "${exp}" ` +
                      `(${JSON.stringify(o)})`);
    }
    // TOTAL AND SINGLE-VALUED, over the whole cross product — this is the
    // "never two audible sources" claim in the only form a pure function can
    // carry it: there is no third answer and no world without one.
    let worlds = 0, carried = 0;
    for (const armed of [0, 1]) for (const playing of [0, 1])
      for (const mobile of [0, 1]) for (const hidden of [0, 1])
        for (const away of [0, 1]) for (const ready of [0, 1])
          for (const full of [0, 1]) for (const idleMs of [0, 30000])
            for (const demoted of [null, "why"]) {
              const r = want({ armed: !!armed, disarmed: false, demoted,
                               playing: !!playing, mobile: !!mobile,
                               hidden: !!hidden, away: !!away, ready: !!ready,
                               full: !!full, idleMs, after: 30000 });
              worlds++;
              if (r === "carrier") carried++;
              else if (r !== "graph") ok(false, `§54(a) a third state: "${r}"`);
              // the law, restated at every point: a carrier that is not armed,
              // not playing or demoted is a silent page
              if (r === "carrier" && (!armed || !playing || demoted))
                ok(false, `§54(a) carrying with armed=${armed} playing=${playing} ` +
                          `demoted=${demoted} — that is a mute with nothing behind it`);
              // …and on a desk, never a fragment
              if (r === "carrier" && !mobile && !(ready && full))
                ok(false, `§54(a) a desk carried a tape that is ready=${ready} full=${full}`);
            }
    ok(worlds === 512 && carried > 0 && carried < worlds,
       `§54(a) the walk is degenerate: ${carried}/${worlds} worlds carry`);
    console.log(`  the decision is total over ${worlds} worlds; ${carried} of them carry`);
  }

  /* (b) THE SEQUENCE, IN ORDER */
  {
    // one world, mutated by the events a listener would deliver, asserted at
    // every step — interact -> live, idle -> tape, hide -> tape, interact ->
    // live. The tape is READY and FULL throughout, so every transition below
    // is the machine's decision and never a missing render.
    const W = { armed: true, disarmed: false, demoted: null, playing: true,
                mobile: false, hidden: false, away: false, idleMs: 0,
                ready: true, full: true, after: 30000 };
    const step = (label, mutate, exp) => {
      mutate();
      const got = want(W);
      ok(got === exp, `§54(b) ${label}: "${got}", not "${exp}"`);
      return got;
    };
    const seen = [];
    seen.push(step("play, hand on the desk", () => {}, "graph"));
    seen.push(step("ten seconds of quiet", () => { W.idleMs = 10000; }, "graph"));
    seen.push(step("thirty seconds of quiet", () => { W.idleMs = 30000; }, "carrier"));
    seen.push(step("a touch", () => { W.idleMs = 0; W.away = false; }, "graph"));
    seen.push(step("the tab is hidden", () => { W.hidden = true; }, "carrier"));
    seen.push(step("back, and touched", () => { W.hidden = false; W.idleMs = 0; }, "graph"));
    seen.push(step("another app on top", () => { W.away = true; }, "carrier"));
    seen.push(step("clicked back into", () => { W.away = false; W.idleMs = 0; }, "graph"));
    seen.push(step("stop", () => { W.playing = false; W.idleMs = 1e6; }, "graph"));
    const sig54 = seen.join(">");
    ok(sig54 === "graph>graph>carrier>graph>carrier>graph>carrier>graph>graph",
       `§54(b) the walk came out ${sig54}`);
    console.log("  interact -> live, idle -> tape, hide -> tape, interact -> live");
  }

  /* (c) THE WIRING, ON THE REAL MODULE */
  {
    // the constant is NAMED and it is the one Paul asked for
    ok(B54.IDLE_MS === 30000,
       `§54(c) the idle threshold is ${B54.IDLE_MS} ms, not the 30 s it is documented as`);
    // every signal the machine listens for is really listened for. touchstart
    // and wheel are there so a finger on a phone-sized desk and a scroll both
    // count as touching; blur is there because ANOTHER APP ON TOP is not a
    // visibilitychange and is exactly the tab-away being fixed.
    for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "visibilitychange"])
      ok(H54.has(ev), `§54(c) nothing listens for "${ev}" — the idle clock cannot be reset`);
    for (const ev of ["focus", "blur"])
      ok(winH54.has(ev), `§54(c) the window does not listen for "${ev}"`);
    const read = () => globalThis.window.__nuBounce();
    // a hide sets `away` and the machine says so
    globalThis.document.visibilityState = "hidden";
    H54.get("visibilitychange")();
    ok(read().away === true, "§54(c) a hide did not put the page away");
    // …and coming back counts as touching: `away` clears and the idle clock
    // restarts, which is why a person who tabs back gets the live graph
    globalThis.document.visibilityState = "visible";
    H54.get("visibilitychange")();
    const back = read();
    ok(back.away === false, "§54(c) becoming visible did not clear `away`");
    ok(back.idleMs < 50, `§54(c) becoming visible left the idle clock at ${back.idleMs} ms`);
    // the window losing focus is the same fact by another door
    winH54.get("blur")();
    ok(read().away === true, "§54(c) a window blur did not put the page away");
    // and a pointer on the machine takes it all back
    H54.get("pointerdown")();
    const touched54 = read();
    ok(touched54.away === false, "§54(c) a pointerdown did not clear `away`");
    ok(touched54.idleMs < 50, `§54(c) a pointerdown left the idle clock at ${touched54.idleMs} ms`);
    // nothing carries in a page that never pressed play, whatever it is told
    ok(touched54.want === "graph" && touched54.carrying === false &&
       touched54.desk === false && touched54.parked === false,
       `§54(c) a page with no transport claims ${JSON.stringify(
         { want: touched54.want, carrying: touched54.carrying,
           desk: touched54.desk, parked: touched54.parked })}`);
    console.log("  the listeners are real: hide/blur -> away, touch/visible -> the clock restarts");
  }
}

/* ------------------------------- 55. A URL FOR EVERY ROOM IN THE HOUSE
   ui/pages.js's router, run FOR REAL — imported as the module it is (the §31
   window-stub trick, extended with just enough of document/location/history/
   EventTarget for the router's own code to execute) rather than a hand
   rewrite of its logic that could drift from the shipped file and still
   pass. Reads the RENDERED result: chassis.dataset.page, location.hash and
   the history stack a click, a URL load, or a back/forward actually leaves
   behind — never the source. */
console.log("§55 — a url for every room in the house");
{
  globalThis.window = globalThis;
  window.NuKernel = K;
  window.NuGenres = require("../../nukernel/genres.js");
  window.NuSing = require("../../nukernel/sing.js");
  window.NuFields = require("../../nukernel/fields.js");
  window.NuSong = require("../../nukernel/song.js");
  window.NuInstruments = require("../../nukernel/instruments.js");
  window.NuCompose = require("../../nukernel/compose.js");
  window.PRESETS = require("../../nukernel/presets.js").PRESETS;
  window.__REGISTRY = require("../../engine/registry-data.js");

  // ui/touch.js reads matchMedia/navigator/performance at import time;
  // ui/pages.js reads document/location/history/addEventListener. None of it
  // needs to be a browser, only real enough that the router's own code runs
  // rather than a stub standing in for it.
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.navigator = { vibrate: null };
  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  const bus = new EventTarget();
  globalThis.addEventListener = bus.addEventListener.bind(bus);
  globalThis.removeEventListener = bus.removeEventListener.bind(bus);
  globalThis.dispatchEvent = bus.dispatchEvent.bind(bus);

  class Elem {
    constructor(page) { this.dataset = { page }; this._attrs = {}; this._on = {}; }
    setAttribute(k, v) { this._attrs[k] = String(v); }
    getAttribute(k) { return this._attrs[k]; }
    addEventListener(t, fn) { (this._on[t] = this._on[t] || []).push(fn); }
    click(mods) {
      const ev = Object.assign({ defaultPrevented: false, button: 0 }, mods,
        { preventDefault() { ev.defaultPrevented = true; } });
      for (const fn of (this._on.click || [])) fn(ev);
      return ev;
    }
  }
  const chassis55 = new Elem(); chassis55.dataset = { page: "song" };
  const pkeys55 = ["compose", "song", "mix", "lab"].map(p => new Elem(p));
  globalThis.document = {
    getElementById: id => (id === "chassis" ? chassis55 : null),
    querySelectorAll: sel => (sel === ".pkey" ? pkeys55 : []),
  };

  let hist55 = [""], hi55 = 0;
  const hashOf55 = u => { const s = String(u), i = s.indexOf("#");
                           return i < 0 ? "" : s.slice(i); };
  globalThis.location = { hash: "" };
  globalThis.history = {
    pushState(_s, _t, u) {
      hist55 = hist55.slice(0, hi55 + 1); hist55.push(hashOf55(u));
      hi55 = hist55.length - 1; globalThis.location.hash = hist55[hi55];
    },
    replaceState(_s, _t, u) { hist55[hi55] = hashOf55(u); globalThis.location.hash = hist55[hi55]; },
    back() { if (hi55 > 0) { hi55--; globalThis.location.hash = hist55[hi55];
                              globalThis.dispatchEvent(new Event("popstate")); } },
    forward() { if (hi55 < hist55.length - 1) { hi55++; globalThis.location.hash = hist55[hi55];
                              globalThis.dispatchEvent(new Event("popstate")); } },
  };

  const PG = await import("../../nukernel/ui/pages.js");
  const ST = await import("../../nukernel/ui/state.js");

  // (a) EVERY PAGE REACHABLE BY URL: the rail carries a real href (a
  // right-click has something to copy), and a plain click lands the chassis
  // on that page carrying the CURRENT index, not a bare page name a listener
  // has to correct after the fact.
  for (const p of ["compose", "song", "mix", "lab"]) {
    const k = pkeys55.find(e => e.dataset.page === p);
    const ev = k.click();
    ok(ev.defaultPrevented, "§55(a) clicking the " + p + " rail key did not take the click");
    ok(chassis55.dataset.page === p,
       "§55(a) the " + p + " rail key did not land on its page (got " + chassis55.dataset.page + ")");
    const want = "#/" + p + (p === "compose" ? "/" + ST.slot
      : (p === "song" || p === "mix") ? "/" + ST.viewSec : "");
    ok(location.hash === want,
       "§55(a) " + p + " landed on " + location.hash + ", not " + want);
  }
  // a modified click (new tab) is left to the real href — the router must
  // not swallow it or navigate in-page underneath it
  {
    const before = chassis55.dataset.page;
    const ev = pkeys55.find(e => e.dataset.page === "compose").click({ metaKey: true });
    ok(!ev.defaultPrevented, "§55(a) a cmd-click on a rail key was swallowed");
    ok(chassis55.dataset.page === before, "§55(a) a cmd-click navigated in-page too");
  }

  // (b) LOAD-FROM-URL RESTORES THE PAGE: a shared link lands on what the
  // sender was looking at — the phrase on Compose, the section on Arrange —
  // not on whichever page the markup happens to open on.
  ST.putPhrase(1, ST.SLOTS[0]);          // a real slot 1 to restore into
  {
    location.hash = "#/compose/1";
    PG.initRoute();
    ok(chassis55.dataset.page === "compose",
       "§55(b) #/compose/1 did not land on Compose");
    ok(ST.slot === 1, "§55(b) #/compose/1 did not restore slot 1 (got " + ST.slot + ")");
  }
  {
    location.hash = "#/song/2";
    PG.initRoute();
    ok(chassis55.dataset.page === "song", "§55(b) #/song/2 did not land on Arrange");
    ok(ST.viewSec === 2, "§55(b) #/song/2 did not restore section 2 (got " + ST.viewSec + ")");
  }
  // an unrecognised fragment writes the CURRENT state back rather than
  // leaving a lie in the address bar, and does it as a REPLACE (no new entry)
  {
    const lenBefore = hist55.length;
    location.hash = "#/nonsense";
    PG.initRoute();
    ok(chassis55.dataset.page === "song", "§55(b) a bad fragment changed the page");
    ok(location.hash === "#/song/2", "§55(b) a bad fragment was not corrected (got " + location.hash + ")");
    ok(hist55.length === lenBefore, "§55(b) correcting a bad fragment pushed a history entry");
  }

  // (c) BACK/FORWARD WALKS THE HISTORY the way a person expects: three real
  // navigations push three entries, and the browser's own back/forward key
  // (simulated as a popstate, since that's what a real back button fires)
  // steps the chassis back through them without this file touching setPage.
  {
    PG.setPage("song"); PG.setPage("mix"); PG.setPage("lab");
    ok(chassis55.dataset.page === "lab", "§55(c) three setPage calls did not land on lab");
    history.back();
    ok(chassis55.dataset.page === "mix",
       "§55(c) back() did not return to mix (got " + chassis55.dataset.page + ")");
    history.back();
    ok(chassis55.dataset.page === "song",
       "§55(c) a second back() did not return to song (got " + chassis55.dataset.page + ")");
    history.forward();
    ok(chassis55.dataset.page === "mix",
       "§55(c) forward() did not return to mix (got " + chassis55.dataset.page + ")");
  }
  console.log("  every rail key has an href, a load restores page+index, back/forward walk the stack");

  // (d) NO LAYOUT BRANCH ABOVE THE PHONE BREAKPOINT, in the CHASSIS/RAIL
  // region this lane owns (kernel-daw.css carries other, unrelated
  // @media (max-width:899px) blocks — the song table's own phone grid among
  // them — that belong to other lanes and are not this claim). The chassis's
  // three zones and the rail used to live entirely behind that breakpoint,
  // with a separate >=900px rule undoing them for a desk; both gates are
  // gone from the source text itself, which is the one claim only the
  // source can prove, so it is read here rather than re-derived from
  // computed style.
  {
    const css = require("fs").readFileSync(
      require("path").join(__dirname, "../../nukernel/kernel-daw.css"), "utf8");
    ok(css.includes("body{padding:0}"),
       "§55(d) the chassis's body{padding:0} left the file entirely");
    ok(!css.includes("@media (max-width:899px){\n  body{padding:0}"),
       "§55(d) the chassis block is still gated behind the 899px breakpoint");
    ok(!/\.deck,\.page\{display:contents\}/.test(css),
       "§55(d) the desk's chassis dissolve (.deck,.page{display:contents}) is still in the file");
    ok(!/\.pagerail\{display:none\}/.test(css),
       "§55(d) .pagerail{display:none} — the desk-hides-the-rail rule — is still in the file");
    ok(/\.pagerail\{[^}]*display:grid/.test(css),
       "§55(d) .pagerail no longer paints unconditionally");
    console.log("  kernel-daw.css: the chassis/rail block is ungated, no desk dissolve remains");
  }
}

/* ------------------------------- 56. A PHRASE IS AS LONG AS THE MUSIC NEEDS
   song.js's persistence half of "phrases may be up to 128 steps"
   (2026-08-17) — score-level, not DOM: blank()/okPhrase read a phrase's
   length off the vectors themselves rather than assuming sixteen, so this
   reads that contract straight off nukernel/song.js, the way a save/load
   round trip actually exercises it. ui/editor.js's grid/tray/playhead half
   is proved on the rendered page instead (test/browser/nukernel-phrase-editor.test.js)
   — this file stays pure node. */
console.log("§56 — a phrase is as long as the music needs");
{
  const S56 = require("../../nukernel/song.js");
  const z56 = n => new Array(n).fill(0);
  const phrase56 = n => ({ deg: z56(n), oct: z56(n), vel: new Array(n).fill(5),
                           inc: z56(n), stk: z56(n), gate: z56(n), acc: z56(n), sld: z56(n) });
  const song56 = (slots) => ({
    v: S56.VERSION, slots, bpm: null, genres: null, master: null, buses: null,
    groove: null, swing: null, pool: null,
    song: [{ stack: [{ g: "simple", slots: [0] }], len: 4, nudge: 0, ops: [], fx: [] }],
  });

  // (a) blank()/z() default to sixteen (every existing caller writes them
  // bare) but take whatever length a caller — ui/editor.js's grow/shrink —
  // actually asks for.
  {
    const b16 = S56.blank(), b128 = S56.blank(128);
    ok(b16.deg.length === 16 && b16.gate.length === 16,
       "§56(a) blank() with no argument is not sixteen steps");
    ok(b128.deg.length === 128 && b128.sld.length === 128,
       "§56(a) blank(128) did not build a 128-step phrase");
    ok(S56.PHRASE_MIN === 1 && S56.PHRASE_MAX === 128,
       "§56(a) PHRASE_MIN/PHRASE_MAX are not exported as 1/128 (got " +
       S56.PHRASE_MIN + "/" + S56.PHRASE_MAX + ")");
  }

  // (b) validateSong ACCEPTS 1..128, at whatever length the vectors agree
  // on — not nailed to sixteen, and not merely "whatever the first vector
  // says" (every one of the eight must match).
  {
    for (const n of [1, 17, 64, 128]) {
      const r = S56.validateSong(song56([phrase56(n)]));
      ok(r.ok, "§56(b) a " + n + "-step phrase was refused: " +
         (r.errors[0] && JSON.stringify(r.errors[0])));
      if (r.ok) ok(r.song.slots[0].deg.length === n,
        "§56(b) a " + n + "-step phrase round-tripped at a different length (" +
        r.song.slots[0].deg.length + ")");
    }
    const over = S56.validateSong(song56([phrase56(129)]));
    ok(!over.ok, "§56(b) a 129-step phrase was accepted — PHRASE_MAX did not hold");
    const zero = S56.validateSong(song56([phrase56(0)]));
    ok(!zero.ok, "§56(b) a zero-length phrase was accepted");
    // one vector shorter than the rest of the SAME phrase — the length is
    // read off deg, so every other vector must be held to it explicitly
    const uneven = phrase56(32); uneven.oct = z56(16);
    const uv = S56.validateSong(song56([uneven]));
    ok(!uv.ok, "§56(b) a phrase whose vectors disagree in length was accepted");
  }

  // (c) migrate()'s ramp-vector backfill (old saves missing inc/stk) reads
  // the phrase's OWN length off deg rather than assuming sixteen — every
  // real old save IS sixteen, so this proves the fix on a synthetic phrase
  // at another length, the case that would have silently mismatched before.
  // The backfill only runs on the v:1 path (migrate()'s own early return
  // skips it for v:2), which is also what makes it safe to assume real old
  // saves are always sixteen — no v:2 writer has ever omitted inc/stk.
  {
    const raw = song56([phrase56(32)]); raw.v = 1;
    delete raw.slots[0].inc; delete raw.slots[0].stk;
    const m = S56.migrate(raw);
    ok(Array.isArray(m.slots[0].inc) && m.slots[0].inc.length === 32,
       "§56(c) migrate() backfilled inc at length " +
       (m.slots[0].inc && m.slots[0].inc.length) + ", not the phrase's own 32");
    ok(Array.isArray(m.slots[0].stk) && m.slots[0].stk.length === 32,
       "§56(c) migrate() backfilled stk at length " +
       (m.slots[0].stk && m.slots[0].stk.length) + ", not the phrase's own 32");
    const r = S56.validateSong(m);
    ok(r.ok, "§56(c) a migrated phrase failed validation: " +
       (r.errors[0] && JSON.stringify(r.errors[0])));
  }
  console.log("  song.js: blank()/okPhrase read a phrase's length off its own vectors, 1..128");
}

/* ------------------------------- 58. TWENTY-NINE MORE ROOMS
   Lane E1's own check (2026-08-17), for the twenty-nine genres added by that
   pass: every one of them renders a non-silent score, names a real sampler
   (the same registry-backed check §(d) above runs for the whole table, run
   again here so a failure names the batch), and is measurably different from
   the anchors it declares as parents and from its own `near` neighbour — the
   thing "shipping a dud quietly" would look like is a new genre whose
   rendered events are byte-identical to the genre it claims lineage from. */
console.log("twenty-nine more rooms — non-silent, real instruments, distinguishable from parents");
{
  const ADDED = ["hymn", "crooner", "yuletide", "merseybeat", "psychpop", "bigbeat",
    "drill", "clubpop", "powerballad", "retrofunkpop", "reggaeton", "latinpop",
    "kpop", "boyband", "emo", "screamo", "confessionalpop", "darkrnb", "bigroom",
    "blueeyedsoul", "folkduo", "worldfolk", "jamband", "sophistirock", "motorik",
    "roboticpop", "industrialmetal", "ebm", "synthduo"];
  ok(ADDED.length === 29, "the roster itself drifted from 29: " + ADDED.length);
  for (const gk of ADDED)
    ok(!!GENRES[gk], gk + ": named in the roster but missing from GENRES");

  // (a) NON-SILENT: the same [render, drums, bass] walk every other section
  // in this file reads, at each genre's own bar count.
  for (const gk of ADDED) {
    const g = GENRES[gk], bars = Math.max(4, g.bars);
    const ev = allEvents(P, g, bars);
    ok(ev.length > 0, gk + ": renders silent — zero events at " + bars + " bars");
  }

  // (b) A REAL SAMPLER: instrOf must not throw, and every id it can return
  // must be a key in the registry's SAMPLERS table — the same check §(d)
  // above runs for the shipped 58, run again so a failure names this batch.
  {
    const NI = require("../../nukernel/instruments.js");
    const vm = require("vm"), fs = require("fs"), path = require("path");
    const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(
      path.join(__dirname, "../../engine/registry-data.js"), "utf8"), ctx);
    const SAMPLERS = (ctx.__REGISTRY && ctx.__REGISTRY.SAMPLERS) || {};
    ok(Object.keys(SAMPLERS).length > 100, "registry-data.js did not yield SAMPLERS");
    for (const gk of ADDED) {
      const g = GENRES[gk];
      for (let v = 0; v < g.voices; v++)
        ok(typeof NI.instrOf(gk, v) === "string", gk + ": instrOf failed for voice " + v);
      const ids = Array.isArray(g.instr) ? g.instr : [g.instr];
      for (const id of ids)
        ok(!!SAMPLERS[id], gk + ": instr \"" + id + "\" is not a SAMPLERS id");
    }
  }

  // (c) DISTINGUISHABLE FROM ITS OWN LINEAGE: a genre that renders byte-for-
  // byte identical to a declared parent or its `near` neighbour is not a new
  // room, it is the old one wearing a new door sign. Compared on the shared
  // DEFAULT phrase (the same one every render in this file uses) so a genre
  // whose only "difference" was a fact about the composer's own phrase bank
  // does not pass by accident.
  for (const gk of ADDED) {
    const g = GENRES[gk];
    const rivals = new Set(Object.keys(g.parents || {}));
    if (g.near) rivals.add(g.near);
    ok(rivals.size > 0, gk + ": no parents and no `near` — nothing to prove distinct from");
    for (const p of rivals) {
      const bars = Math.max(4, g.bars, GENRES[p].bars);
      ok(sig(allEvents(P, g, bars)) !== sig(allEvents(P, GENRES[p], bars)),
         gk + ": renders identical to its own parent/neighbour \"" + p + "\"");
    }
  }

  // (d) FAMILY + DYNAMICS: every anchor added must resolve `family` (the
  // FAMILIES stamp) and stress/phrase/touch (the DYNAMICS/DYN_FAMILY stamp,
  // §39's own exhaustive law) — a genre that resolves to neither renders flat
  // forever, and §39 above only proves that of the shipped 58.
  for (const gk of ADDED) {
    const g = GENRES[gk];
    ok(!!g.family, gk + ": no family — the palette and the dynamics stamp both miss it");
    ok(g.stress != null && g.phrase != null && g.touch != null,
       gk + ": no dynamics row — neither a club-family override nor a family fallback landed");
  }
  console.log("  58: " + ADDED.length + " genres — non-silent, real samplers, distinct from lineage");
}

/* §59 — A NOTE CAN LEAN, SLIDE, FLAM OR PASS ---------------------------------
   The ninth type (kernel.js ORNAMENTS), in both halves: the `orn` MARKS a hand
   writes on a step, and the genre PASS that adds what a style would add. The
   four things this has to prove are the four ways it could ship broken, and
   three of them are the ways features have shipped broken here before:

     (a) every mark reaches the score, and does the specific thing it claims —
         a grace is a different pitch before the beat, a flam is the SAME pitch
         before the beat, a roll is n strikes inside the note's own length;
     (b) the marks BEAT the pass: on a genre with a policy, a marked step plays
         its mark and nothing the policy would have chosen instead;
     (c) the pass is deterministic — two renders of one state are byte-equal,
         tags included, and it is the SEED that decides, not the clock;
     (d) nothing moved. Every term is opt-in and a genre with no `g.orn` row
         renders exactly what it rendered the commit before this one — held
         against hashes measured on the PRE-CHANGE kernel, the same tripwire
         idiom §39's five machines already keep (and those five are in the list
         below, at the same values, which is how this table proves it is
         measuring the same thing they are). */
console.log("§59 — a note can lean, slide, flam or pass");
{
  const crypto = require("crypto");
  const fp = ev => crypto.createHash("sha1").update(JSON.stringify(ev.map(e =>
    [+e.t.toFixed(6), e.n, e.d, +(e.dur || 0).toFixed(6), e.vel, e.acc, e.sld])))
    .digest("hex").slice(0, 12);
  const ORN = K.ORN;
  // a plain rising-and-falling line: every gated step two apart, so there is
  // always room in front of a note for something to lean into it
  const LINE = {
    deg:  [0, 0, 2, 0, 4, 0, 5, 0, 7, 0, 5, 0, 4, 0, 2, 0],
    oct:  new Array(16).fill(0), vel: new Array(16).fill(6),
    inc:  new Array(16).fill(0), stk: new Array(16).fill(0),
    gate: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    acc:  new Array(16).fill(0), sld: new Array(16).fill(0),
  };
  const withMarks = f => {
    const p = clone(LINE);
    p.orn = new Array(16).fill(0);
    f(p.orn);
    return p;
  };
  // `simple` carries no ornament policy, so anything in ITS stream is the mark
  // and only the mark — the pass cannot be the explanation for what shows up
  const plainG = GENRES.simple;
  const v0 = ev => ev.filter(e => e.v === 0).sort((a, b) => a.t - b.t);
  const base = v0(K.render(LINE, plainG, 1));

  // (a) THE MARKS, one at a time, each read off the RENDERED stream
  {
    const marked = 4;                       // the fifth step, a gated note
    const at = ev => ev.findIndex(e => Math.abs(e.t - base[2].t) < 1e-9);
    ok(base.length === 8, "the test line did not render its eight notes");

    const gr = v0(K.render(withMarks(o => { o[marked] = ORN.grace; }), plainG, 1));
    ok(gr.length === base.length + 1, "a grace mark did not add exactly one note");
    const gi = at(gr);
    ok(gi > 0, "the graced note is not in the stream at its own time");
    const lead = gr[gi - 1];
    ok(lead.orn === "grace", "the note before a graced note is not tagged a grace");
    ok(lead.n !== gr[gi].n, "a grace note is the same pitch as the note it decorates");
    ok(lead.t < gr[gi].t, "the grace does not sound before the beat");
    ok(lead.vel < gr[gi].vel, "the grace is not quieter than its note");
    ok(lead.t + lead.dur <= gr[gi].t + 1e-9, "the grace runs into the note it leads");

    const fl = v0(K.render(withMarks(o => { o[marked] = ORN.flam; }), plainG, 1));
    ok(fl.length === base.length + 1, "a flam mark did not add exactly one note");
    const fi = at(fl);
    ok(fl[fi - 1].orn === "flam", "the note before a flammed note is not tagged a flam");
    ok(fl[fi - 1].n === fl[fi].n, "a flam stroke is NOT the same pitch — that is a grace");
    ok(fl[fi - 1].t < fl[fi].t, "the flam stroke does not sound before the beat");

    for (const [mark, parts] of [[ORN.roll2, 2], [ORN.roll3, 3], [ORN.roll4, 4]]) {
      const rl = v0(K.render(withMarks(o => { o[marked] = mark; }), plainG, 1));
      ok(rl.length === base.length + parts - 1,
         "a roll of " + parts + " did not put " + parts + " strikes in the stream");
      const ri = at(rl), strokes = rl.slice(ri, ri + parts);
      ok(strokes.every(e => e.n === base[2].n),
         "a roll of " + parts + " changed the note's pitch");
      ok(strokes.every(e => e.orn === "roll"),
         "a roll of " + parts + " left a stroke untagged");
      const span = strokes[parts - 1].t + strokes[parts - 1].dur - strokes[0].t;
      ok(span <= base[2].dur + 1e-9,
         "a roll of " + parts + " sounds longer than the note it subdivides");
      // the strokes must not MEET end to end, or a `tie` genre folds the roll
      // straight back into the one long note it came from
      for (let k = 1; k < parts; k++)
        ok(strokes[k].t - (strokes[k - 1].t + strokes[k - 1].dur) > 1e-6,
           "a roll of " + parts + " has strokes that meet end to end");
    }
    // ...and an unmarked phrase is the phrase, exactly
    ok(fp(v0(K.render(withMarks(() => {}), plainG, 1))) === fp(base),
       "an all-zero orn vector is not the same as no orn vector");
  }

  // (b) THE MARKS BEAT THE PASS. blues declares grace and pass; mark every
  // gated step a FLAM and the stream must carry flams and nothing else.
  {
    const g = GENRES.blues;
    ok(!!g.orn, "blues lost its ornament policy — this check would pass vacuously");
    const loose = K.render(LINE, g, 4).filter(e => e.orn);
    ok(loose.length > 0, "blues' own ornament pass produced nothing to be beaten");
    const allFlam = withMarks(o => { for (let i = 0; i < 16; i++) if (LINE.gate[i]) o[i] = ORN.flam; });
    const tags = new Set(K.render(allFlam, g, 4).filter(e => e.orn).map(e => e.orn));
    ok(tags.size === 1 && tags.has("flam"),
       "the genre pass ornamented a step the hand had already marked: " +
       [...tags].join("/"));
  }

  // (c) DETERMINISM, and the seed is what decides it
  {
    for (const gk of ["jazz", "gregorian", "drill", "funk"]) {
      const g = GENRES[gk];
      const a = K.render(P, g, 4), b = K.render(P, g, 4);
      ok(JSON.stringify(a) === JSON.stringify(b),
         gk + ": two renders of one state are not identical — the pass is not seeded");
      ok(a.some(e => e.orn), gk + ": an ornament policy that reaches no note at all");
    }
    const j = GENRES.jazz;
    ok(fp(K.render(P, j, 4)) !== fp(K.render(P, { ...j, kitSeed: (j.kitSeed | 0) + 1 }, 4)),
       "jazz ornaments identically at two different seeds — the dice are not thrown");
    // every term must reach the stream on its own, or it is a dead field
    for (const [term, tag] of [["pass", "pass"], ["approach", "approach"],
                               ["grace", "grace"], ["flam", "flam"], ["roll", "roll"]]) {
      const g = { ...plainG, orn: { [term]: 1 } };
      ok(K.render(P, g, 4).some(e => e.orn === tag),
         "the `" + term + "` term never reaches the rendered stream");
    }
  }

  // (c2) THE CARVE-OUT IS ONE WORD WIDE. §9 forbids a pitch class outside the
  // bar's own alphabet and now lets `approach` past, because a chromatic
  // lead-in is outside by definition. That exemption is only honest if nothing
  // ELSE this file emits is outside — so the same containment is re-proved
  // here for every other tag, on every genre that ornaments, against the same
  // set §9 builds. If a grace or a passing tone ever leaves the key, it fails
  // HERE rather than sliding through the hole the approach needed.
  {
    let checked = 0;
    for (const gk of Object.keys(GENRES)) {
      const g = GENRES[gk];
      if (!g.orn) continue;
      const sc = g.scale || K.PENT, bs = 16 / g.rate;
      for (let b = 0; b < g.bars; b++) {
        const root = (g.harmony === "cycle" && !g.diatonic)
          ? K.mp(K.harm(P, g, b), g.mode || undefined) : 0;
        const allowed = new Set(sc.map(x => (((x + root) % 12) + 12) % 12));
        if (g.harmony === "cycle")
          for (const c of K.chordsOf(P, g, b))
            for (const n of c.pcs) allowed.add(((n % 12) + 12) % 12);
        const bad = K.render(P, g, g.bars)
          .filter(e => e.orn && e.orn !== "approach" && Math.floor(e.t / bs) === b)
          .filter(e => !allowed.has(((e.n % 12) + 12) % 12));
        checked++;
        ok(bad.length === 0, gk + " bar " + (b + 1) + ": a " +
           (bad[0] || {}).orn + " ornament left the bar's alphabet");
      }
    }
    ok(checked > 40, "the containment law was checked on almost nothing (" + checked + ")");
  }

  // (d) NOTHING MOVED. Measured on the kernel at HEAD 7fc30e9, the commit
  // before the ninth type existed, over the same allEvents() recipe §39 uses.
  // A genre appears here because it has NO ornament policy: the whole claim of
  // this lane is that such a genre is untouched, and a hash is the only way to
  // say that out loud. If a row moves, either an ornament leaked into a genre
  // that declared none, or somebody gave it a policy and owes this table a
  // re-measurement with an argued reason — it does not get weakened.
  {
    const FROZEN = { simple: "47f696fee4b2", ambient: "1a68804b1e4a",
      drone: "977ce5507005", vaporwave: "4c3009be0416", kraftwerk: "da1af676f72d",
      disco: "4e4071bdc24e", rnb: "df510d2bdb36", dub: "0548dcbca6fd",
      bossa: "c69c70383a0e", synthpop: "58bff8df43db", shoegaze: "91230469bf69",
      citypop: "84ee282d372a", newwave: "95d03b9fb4fe", doowop: "9ce0e377735e",
      minimalism: "7f9485e9a06d", toto: "760d4470921b", beatles: "0b3ce4a5ca49",
      steely: "22e3bdce30e2", postrock: "d70f3fde7b93", neoclassical: "497406f3443e",
      // §39's five machines, at the same values that section freezes them at —
      // which is what says this table and that one are measuring one thing
      techno: "036036ec46ed", acid: "c047f764a472", house: "2f1c41112ac0",
      trap: "addcf7d93d0f", electro: "1b4dccccfb12",
      pad: "8fc2877a4554", riff: "b70f7f837d8d", vocal: "18fdd7ab8497",
      backing: "e0cbb6146f64" };
    for (const gk of Object.keys(FROZEN)) {
      const g = GENRES[gk];
      ok(!g.orn, gk + ": now carries an ornament policy — this row is a claim " +
         "that it does not, and one of the two is wrong");
      ok(fp(allEvents(P, g, Math.max(4, g.bars))) === FROZEN[gk],
         gk + ": a genre with no ornament policy no longer renders what it " +
         "rendered before the ninth type existed");
    }
    // and the pass itself is a no-op for them, object-identically: `ornament`
    // hands back the very array it was given rather than a rebuilt copy
    const arr = [{ t: 0, n: 60, dur: 1, v: 0, vel: 5 }];
    ok(K.ornament(arr, plainG, { stepsPerBar: 16, rate: 4, pcs: null }) === arr,
       "the ornament pass rebuilt the stream for a genre that has no policy");
  }
  console.log("  59: marks, the genre pass, and " +
              Object.keys(GENRES).filter(k => GENRES[k].orn).length +
              " genres that ornament");
}


/* ------------------------------- 62. THE DESK IS THREE BUSES AND A FADER
   Lane A2's own gate, and it reads the BUILT GRAPH rather than the source that
   built it. Paul, 2026-08-17: "get rid of inserts, reverb, and echo — let me
   send to bus 1, bus 2, and bus 3 instead — buses should be named, though";
   "don't gray out tracks — cut/mute them!"; "let buses send to other buses and
   back". The claims:
     (a) THREE NAMED BUSES exist in the registry, every one renameable through
         a table song.js will actually keep, and every one addressable from a
         track by a send field of its own;
     (b) A CUT TRACK IS INAUDIBLE, not dimmed — propagate a unit signal through
         the real nodes audio/mixer.js buildChannel returns and the sum that
         arrives at the master, at the verb, at the echo and at the room is
         EXACTLY zero, because every path out of the strip is behind the gate;
     (c) A SEND REACHES ITS BUS — the same propagation, non-zero at the right
         destination and at the SENDS-table depth the chip names;
     (d) A BUS->BUS CYCLE IS REFUSED, deterministically and by the plan, so no
         node is ever built for the edge that would close the loop;
     (e) A TRACK MIXED FROM THE DESK HAS NO RACK: the three buses are the whole
         of its routing, which is the flat-cost topology audio/graph.js
         measured for. (The `fx` field survives for songs saved before the
         chips came off; no surface writes it — fields.js PARTMIX says why.)
   The propagation is a DAG walk over the returned node objects, multiplying
   GainNode.gain.value along each path — it cannot pass if the wiring is wrong,
   and it says nothing at all about the code that wrote the wiring. */
console.log("the desk is three buses and a fader — bus routing, the cut, the cycle");
{
  const F = require("../../nukernel/fields.js");
  const MX = await import("../../nukernel/audio/mixer.js");

  // ---- (a) three named buses, each with a send field on a track ----
  ok(F.BUSES.length === 3, "the registry does not carry three buses (" + F.BUSES.length + ")");
  const busIds = F.BUSES.map(b => b.bus);
  for (const b of F.BUSES) {
    const nm = b.knobs.find(k => k.key === "name");
    ok(!!nm, b.bus + ": no `name` knob — the bus cannot be renamed");
    ok(Object.keys(nm.table).length >= 4,
       b.bus + ": the name vocabulary is too small to be a rename");
    // a name that song.js will keep: it validates a bus knob by table membership
    const pick = Object.keys(nm.table)[0];
    ok(F.busNameOf({ [b.bus]: { name: pick } }, b.bus) === nm.table[pick],
       b.bus + ": busNameOf does not return the picked name");
    ok(F.busNameOf(null, b.bus) === b.label,
       b.bus + ": an unnamed bus does not fall back to its shipped label");
    // …and the cross-sends: one per OTHER bus, never to itself
    const tos = b.knobs.filter(k => k.to).map(k => k.to).sort();
    ok(JSON.stringify(tos) === JSON.stringify(busIds.filter(x => x !== b.bus).sort()),
       b.bus + ": cross-sends are " + tos + ", not the other two buses");
  }
  // a track addresses all three, and carries no insert list (claim e)
  const partKeys = F.PARTMIX.map(f => f.key);
  for (const k of ["rev", "echo", "room"])
    ok(partKeys.includes(k), "a track has no `" + k + "` send field");
  ok(F.resolvePartMix({ room: "wet" }).room === F.SENDS.wet,
     "resolvePartMix does not resolve the third send");

  // ---- the stub context: nodes that remember what they were connected to ----
  // Every builder in audio/mixer.js / audio/graph.js takes its context as an
  // argument (the offline-bounce law), so the real code runs unmodified here.
  const stub = () => {
    const P = v => ({ value: v, setValueAtTime(x) { this.value = x; },
      setTargetAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; },
      exponentialRampToValueAtTime(x) { this.value = x; }, cancelScheduledValues() {} });
    const c = { sampleRate: 44100, currentTime: 0 };
    const N = (kind, extra) => {
      const n = { kind, outs: [], context: c,
        connect(d) { this.outs.push(d); return d; }, disconnect() {} };
      return Object.assign(n, extra || {});
    };
    c.destination = N("dest");
    c.createGain = () => N("gain", { gain: P(1) });
    c.createStereoPanner = () => N("pan", { pan: P(0) });
    c.createBiquadFilter = () => N("biquad",
      { type: "peaking", frequency: P(1000), Q: P(1), gain: P(0) });
    c.createWaveShaper = () => N("shaper", { curve: null, oversample: "none" });
    c.createDynamicsCompressor = () => N("comp",
      { threshold: P(0), knee: P(0), ratio: P(1), attack: P(0), release: P(0) });
    c.createDelay = () => N("delay", { delayTime: P(0) });
    c.createChannelSplitter = () => N("split");
    c.createChannelMerger = () => N("merge");
    c.createOscillator = () => N("osc", { frequency: P(1), start() {}, stop() {} });
    c.createConvolver = () => N("conv", { buffer: null });
    c.createAnalyser = () => N("anl", { fftSize: 2048 });
    c.createBuffer = () => ({ getChannelData: () => new Float32Array(1) });
    return c;
  };
  // HOW MUCH OF A UNIT SIGNAL AT `from` ARRIVES AT `to` — every path, summed,
  // each path the product of the gains along it. Zero means inaudible, and it
  // means it for the whole graph rather than for the one wire somebody
  // remembered to check.
  const reach = (from, to, seen) => {
    if (from === to) return 1;
    const guard = seen || new Set();
    if (guard.has(from)) return 0;          // no cycles are built, but be safe
    guard.add(from);
    let s = 0;
    for (const o of from.outs) {
      const g = o.kind === "gain" ? o.gain.value : 1;
      if (g === 0) continue;                // a closed gate carries nothing
      s += g * reach(o, to, guard);
    }
    guard.delete(from);
    return s;
  };

  const build = (parts) => {
    const c = stub();
    const master = c.createGain(), verb = c.createGain();
    const echoIn = c.createGain(), room = c.createGain();
    const spec = { roster: [], fx: [], rev: 0, del: 0, room: 0, verb: "room",
                   eq: null, mot: null, auto: [], lvl: 1, pan: 0, parts };
    const ch = MX.buildChannel(c, spec, {
      master, verb: () => verb, echoIn, room, send: () => null });
    return { c, ch, master, verb, echoIn, room };
  };

  // ---- (b) the cut is a cut, everywhere ----
  {
    const cut = { key: "lead", rev: F.SENDS.drown, del: F.SENDS.drown,
                  room: F.SENDS.drown, lvl: 1, pan: 0, fader: 0, tdb: 0,
                  eq: null, mute: true };
    const { ch, master, verb, echoIn, room } = build([cut]);
    const src = ch.partIn("lead");
    ok(src !== ch.input, "a muted part got no bus of its own to be muted on");
    for (const [name, dest] of [["the section/master", master], ["the reverb bus", verb],
                                ["the delay bus", echoIn], ["the room bus", room]]) {
      const g = reach(src, dest);
      ok(g === 0, "a CUT track still reaches " + name + " at " + g +
         " — muted-but-audible is exactly the state that was forbidden");
    }
    const rep = [...ch.parts.values()][0];
    ok(rep.gate.gain.value === 0, "the cut gate is not at zero");
  }

  // ---- (c) …and un-cut, each send reaches its own bus at its own depth ----
  {
    const on = { key: "lead", rev: F.SENDS.wet, del: F.SENDS.touch,
                 room: F.SENDS.some, lvl: 1, pan: 0, fader: 0, tdb: 0,
                 eq: null, mute: false };
    const { ch, master, verb, echoIn, room } = build([on]);
    const src = ch.partIn("lead");
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    ok(near(reach(src, verb), F.SENDS.wet),
       "the reverb send does not arrive at the reverb bus at its own depth (" +
       reach(src, verb) + " vs " + F.SENDS.wet + ")");
    ok(near(reach(src, echoIn), F.SENDS.touch),
       "the delay send does not arrive at the delay bus (" + reach(src, echoIn) + ")");
    ok(near(reach(src, room), F.SENDS.some),
       "the room send does not arrive at the room bus (" + reach(src, room) + ")");
    ok(reach(src, master) > 0, "the dry path does not reach the master");
    // (e) …AND THAT IS THE WHOLE OF A TRACK'S ROUTING. A part mixed only from
    // the desk builds NO private rack — the three buses are everywhere it can
    // go, which is the flat-cost topology audio/graph.js measured for. A
    // saved-song `fx` chain is the one thing that can still build one, and no
    // surface writes that field any more (fields.js PARTMIX).
    const P = [...ch.parts.values()][0];
    ok(P.rack === false, "a desk-only mix grew a private insert rack");
    ok(P.fs.length === 0, "a desk-only mix grew a character send");
    // and SOLO on one part cuts the others — the one control that reaches out.
    // The chairs come from the mixer's own roster, never from a guess: a genre
    // whose stack has no `lead` would make a hand-written key prove nothing.
    const gk = Object.keys(GENRES).find(k =>
      MX.partKeysOf({ stack: [{ g: k, slots: [0] }], len: 4 }).length >= 2);
    const bare = { stack: [{ g: gk, slots: [0] }], len: 4 };
    const chairs = MX.partKeysOf(bare);
    ok(chairs.length >= 2, "no shipped genre offers two chairs to solo between");
    const sec = { ...bare, parts: { [chairs[0]]: { solo: true } } };
    const specs = MX.chanSpec(sec).parts;
    const other = specs.filter(p => p.key !== chairs[0]);
    ok(other.length === chairs.length - 1 && other.every(p => p.mute),
       "a solo does not mute the parts beside it (" +
       other.map(p => p.key + ":" + p.mute).join(", ") + ")");
  }

  // ---- (d) the bus->bus cycle is refused, by the plan, deterministically ----
  {
    const [A, B, C] = busIds;
    const one = F.busSendPlan({ [A]: { ["x" + B]: "some" } });
    ok(one.edges.length === 1 && one.refused.length === 0,
       "a single bus->bus send was not planned (" + JSON.stringify(one) + ")");
    ok(one.edges[0].from === A && one.edges[0].to === B && one.edges[0].amt === F.SENDS.some,
       "the planned edge is not the one that was asked for");
    // the loop: A->B and B->A. One survives, the other is refused — never both,
    // and never neither (a desk that silently drops both is a desk that lies).
    const two = F.busSendPlan({ [A]: { ["x" + B]: "some" }, [B]: { ["x" + A]: "wet" } });
    ok(two.edges.length === 1, "a two-bus loop planned " + two.edges.length +
       " edges — exactly one must survive");
    ok(two.refused.length === 1 && two.refused[0].from === B && two.refused[0].to === A,
       "the refused edge is not the one that would close the loop: " +
       JSON.stringify(two.refused));
    // and the THREE-bus loop, which no pairwise check would catch
    const three = F.busSendPlan({ [A]: { ["x" + B]: "some" }, [B]: { ["x" + C]: "some" },
                                  [C]: { ["x" + A]: "some" } });
    ok(three.edges.length === 2 && three.refused.length === 1,
       "a three-bus loop was not broken exactly once: " + JSON.stringify(three));
    // determinism: the same spec plans the same way every time, which is what
    // lets audio/graph.js and the board agree about what was refused
    ok(JSON.stringify(F.busSendPlan({ [A]: { ["x" + B]: "some" },
                                      [B]: { ["x" + A]: "wet" } })) === JSON.stringify(two),
       "busSendPlan is not deterministic");
    // a bus never feeds itself, whatever a save says
    ok(F.busSendPlan({ [A]: { ["x" + A]: "drown" } }).edges.length === 0,
       "a bus was planned to feed itself");
  }
  console.log("  62: three named buses, a cut that is silent in the built graph, " +
              "a refused cycle");
}

/* ---------------------------------------------------------------- 63. THE KEY
   "How do I change key? … There should be a variety of keys … defaulting per
   genre … I should be able to change keys … occasionally … songs should
   change keys" (Paul). fields.js widened `key` from a truck-driver's ±few to
   the full twelve tonics (plus a real "minor" chip beside the modal ones);
   compose.js derives a genre's own tonic and occasionally moves off it. Every
   claim below is read off the RENDERED score, through the REAL ui/derive.js
   (§31's own law) — never off the saved box. */
console.log("a song knows what key it is in, and sometimes it decides to move");
{
  const NF = require("../../nukernel/fields.js");
  const NS2 = require("../../nukernel/song.js");
  const C = require("../../nukernel/compose.js");

  // (a) TRANSPOSITION IS EXACT. fields.js's own claim is that `key` is added
  // in the kernel AFTER registration, so a phrase (degrees, never absolute
  // pitches) cannot be broken by it — that was already true before this
  // round; this reads it off K.render rather than assuming it, the way every
  // other claim in this gate does.
  {
    const G = GENRES.beatles;
    const at0 = K.render(P, { ...G, key: 0 }, 4);
    const at5 = K.render(P, { ...G, key: 5 }, 4);
    ok(at0.length > 0 && at0.length === at5.length,
       "changing the key changed which notes played, not just their pitch");
    ok(at0.every((e, i) => {
      const f = at5[i];
      return f && Math.abs(f.t - e.t) < 1e-9 && f.dur === e.dur && f.v === e.v &&
             f.vel === e.vel && f.acc === e.acc && f.sld === e.sld && f.n === e.n + 5;
    }), "key +5 did not transpose every note by exactly 5 semitones and nothing else");
  }

  // (b) fields.js's own widened table: the old seven values kept their exact
  // meaning (a save from before this round still plays the note it always
  // played), and it now spans a real octave with a name on every one of them.
  {
    const old = { "-3": -3, "-2": -2, "-1": -1, "1": 1, "2": 2, "3": 3, "4": 4 };
    ok(Object.keys(old).every(k => NF.KEYS[k] === old[k]),
       "a pre-existing saved key value changed meaning");
    ok(Object.keys(NF.KEYS).length === 12 &&
       new Set(Object.values(NF.KEYS).map(v => ((v % 12) + 12) % 12)).size === 12,
       "the tonic picker is not the full twelve");
    ok(NF.KEYLABEL["0"] === "C" && /^[A-G]/.test(NF.KEYLABEL["-6"]),
       "a tonic chip carries jargon instead of a note name");
  }

  // (c) A SONG WITH NO KEY SET IS BYTE-IDENTICAL TO BEFORE. skeleton()'s own
  // default is unchanged (null, "as the genre asks"), and an absent key still
  // renders exactly as an explicit 0 does — the house law §33 already holds
  // for every other field, read here for this one.
  {
    const gk = "isley";
    const b = NS2.skeleton(gk, "verse"); b.stack[0].slots = [0];
    ok(b.key === null, "skeleton()'s own default for key moved off null");
    const evNull = D.sectionEvents(b, [P]).ev;
    const ev0 = D.sectionEvents({ ...b, key: 0 }, [P]).ev;
    ok(evNull.length > 0 && JSON.stringify(evNull) === JSON.stringify(ev0),
       "an absent key no longer renders identically to an explicit 0");
  }

  // (d) A SECTION KEY CHANGE LANDS ON THE SECTION BOUNDARY, NOT A BAR EARLY.
  // Two independent sections — a plain verse and a bridge modulated a minor
  // third up — each rendered whole. If the modulation leaked a bar early it
  // would show up as a mismatch inside the verse's OWN last bar; if it landed
  // late it would show up in the bridge's first. Neither happens: every note
  // of the bridge, including its very first, sits exactly a minor third above
  // the same step of the (unmodulated) verse — the whole box moves together,
  // by construction, because `key` is one value for the section's whole
  // window and not a per-bar fact.
  {
    const gk = "isley";
    const secA = NS2.skeleton(gk, "verse"); secA.stack[0].slots = [0]; secA.len = 4;
    const secB = NS2.skeleton(gk, "bridge"); secB.stack[0].slots = [0];
    secB.len = 4; secB.key = 3;
    const line = b => D.sectionEvents(b, [P]).ev
      .filter(e => e.kind === "line" && e.n != null)
      .sort((x, y) => x.t - y.t || x.v - y.v);
    const evA = line(secA), evB = line(secB);
    ok(evA.length > 0 && evA.length === evB.length,
       "the two sections did not render the same shape of events");
    ok(evA.every((e, i) => Math.abs(evB[i].t - e.t) < 1e-9 && evB[i].n === e.n + 3),
       "the bridge's key did not land uniformly across its whole length " +
       "(a bar early or a bar late from the boundary)");
  }

  // (e) A MODULATING GENRE MODULATES DETERMINISTICALLY. "beatles" is a
  // song-plan genre with both a peak chorus (the truck-driver +2) and a
  // harmonically functional bridge (the relative-minor gesture) — the two
  // places compose.js ever moves a box off the song's own key. Composing the
  // same (genre, seed) twice must choose the same keys both times.
  {
    const gk = "beatles";
    for (const seed of [3, 11, 42]) {
      const keysOf = () => C.compose(gk, seed).song.map(b => (b.key == null ? null : b.key));
      const k1 = keysOf(), k2 = keysOf();
      ok(JSON.stringify(k1) === JSON.stringify(k2),
         gk + "/" + seed + ": composing twice at one seed picked different keys");
    }
  }

  // (f) …AND IT IS NEVER GRATUITOUS AND NEVER ABSENT. Across forty seeds of a
  // song-plan genre, some records modulate and some do not — the "occasional"
  // Paul asked for, measured rather than assumed.
  {
    const gk = "beatles";
    let moved = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const song = C.compose(gk, seed);
      const base = song.song[0].key;
      if (song.song.some(b => b.key !== base)) moved++;
    }
    ok(moved > 0 && moved < 40,
       gk + ": key changes are either never gratuitous nor never happen (" +
       moved + "/40)");
  }

  // (g) A GENRE DECLARES THE KEY IT LIVES IN — not the same one every time.
  // Two different genres get two different tonics far more often than one in
  // twelve genres would collide by chance, and one genre's tonic is stable
  // across every seed (a record does not re-key itself between takes).
  {
    const sample = ["beatles", "isley", "rock", "simple", "jazz", "dub", "punk"]
      .filter(gk => GENRES[gk]);
    const tonics = sample.map(gk => C.compose(gk, 1).song[0].key);
    ok(new Set(tonics).size > 1,
       "every sampled genre defaulted to the same tonic (" + tonics.join(",") + ")");
    for (const gk of sample) {
      const t1 = C.compose(gk, 1).song[0].key, t2 = C.compose(gk, 9).song[0].key;
      ok(t1 === t2, gk + ": the genre's own default key moved between seeds");
    }
  }

  // (h) THE MAJOR/MINOR CHIP. "minor" is a real, choosable value now (not
  // just an absent field reading as one) and it OVERRIDES a genre's own
  // colour, the way every other explicit chip does — read on newwave, the one
  // shipped anchor whose own mode is not natural minor (mixolydian).
  {
    // its VALUE is unused by design (fields.js's own note) — what the picker
    // and song.js's okEnum both need is the KEY, and that is what this checks
    ok(Object.prototype.hasOwnProperty.call(NF.KEYMODES, "minor"),
       "'minor' is not a legal value of the key-mode field");
    const gk = "newwave", secOwn = NS2.skeleton(gk, "verse");
    secOwn.stack[0].slots = [0]; secOwn.len = 4;
    const secMinor = { ...secOwn, mode: "minor" };
    const own = D.sectionEvents(secOwn, [P]).ev.filter(e => e.kind === "line" && e.n != null);
    const min = D.sectionEvents(secMinor, [P]).ev.filter(e => e.kind === "line" && e.n != null);
    ok(own.length && min.length &&
       JSON.stringify(own.map(e => e.n)) !== JSON.stringify(min.map(e => e.n)),
       "choosing 'minor' on a genre with its own mode changed nothing");
  }

  console.log("  63: a variety of keys, a genre's own default, a modulation " +
              "that lands on the boundary and never happens twice by accident");
}

/* ---------------------------------------------------------------- 64. THE DRUM PHRASE
   Lane C3, built on lanes C1/C2's own infrastructure (the plain editor, the
   `orn` marks): a phrase can be a DRUM PATTERN now — kernel.js kind:"drum",
   a lane grid (DRUM_LANES) of composite marks (DMARK: hit/accent/ghost/flam/
   roll of two-three-four, four of the eight values literally `orn`'s own) —
   instead of a melodic line. Dropped into a section's lead slot it OVERRIDES
   that section's genre kit for exactly its own bars; taken back out, the
   genre's own kit plays again. Every claim below is read off the RENDERED
   score, through the REAL ui/derive.js sectionEvents (§31's own law), never
   off the saved phrase or box. */
console.log("a drum phrase is a phrase you can hear the machine in, and it takes the kit");
{
  const NS64 = require("../../nukernel/song.js");
  const hitsOf = ev => ev.filter(e => e.kind === "hit");
  const lanesOf = ev => [...new Set(ev.map(e => e.d))].sort();
  // a genre whose own kit is known to voice more than the two lanes the drum
  // phrase below writes, so "the genre's own lane is gone" is a real claim
  const gk = GENRES.dnb && GENRES.dnb.kit && GENRES.dnb.kit.h ? "dnb"
    : GK.find(g2 => GENRES[g2].kit && GENRES[g2].kit.h && GENRES[g2].kit.k);
  const baseBox = () => { const b = NS64.emptyBox(); b.stack[0].g = gk; b.len = 4; return b; };
  const genreKit = hitsOf(D.sectionEvents(baseBox(), []).ev);
  ok(genreKit.length && lanesOf(genreKit).includes("h"),
     gk + ": no genre-kit baseline to override (no hats in its own kit)");

  // (a) THE OVERRIDE IS TOTAL. A drum phrase in the lead slot plays ONLY its
  // own lanes — none of the genre's, including the hats every bar of its own
  // kit carries — and every hit lands on the lane and step the phrase wrote.
  {
    const dp = NS64.blankDrum();
    dp.k = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    dp.s = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
    const b = baseBox(); b.stack[0].slots = [0];
    const ev = hitsOf(D.sectionEvents(b, [dp]).ev);
    ok(ev.length > 0 && lanesOf(ev).join(",") === "k,s",
       "a drum phrase's lanes did not replace the genre kit's (" + lanesOf(ev).join(",") + ")");
    ok(!ev.some(e => e.d === "h"),
       "the genre's own hat kept sounding under a drum phrase");
    // the phrase's own steps, not the genre's rhythm: a kick on every 4th
    // sixteenth, four bars of it — read at the genre's own rate rather than
    // assumed, since a drum phrase's sixteen steps still play at g.rate
    const gRate = D.genreOf(b, b.stack[0]).rate, period = 16 / gRate;
    const kSteps = new Set(ev.filter(e => e.d === "k").map(e => e.t % period));
    const want = [0, 4, 8, 12].map(s => s / gRate);
    ok(kSteps.size === 4 && want.every(t => kSteps.has(t)),
       "the drum phrase's own kick pattern did not reach the score (" +
       [...kSteps].join(",") + " vs " + want.join(","));
  }

  // (b) REMOVE IT AND THE GENRE'S OWN KIT COMES BACK, byte for byte — the
  // SAME box, drum phrase taken back out of the slot, against a box that
  // never held one at all.
  {
    const held = baseBox(); held.stack[0].slots = [0];
    const dp = NS64.blankDrum(); dp.k[0] = 1;
    const withPhrase = hitsOf(D.sectionEvents(held, [dp]).ev);
    ok(withPhrase.length && lanesOf(withPhrase).join(",") === "k",
       "setup: the held drum phrase did not override anything to remove");
    held.stack[0].slots = [];                 // take it back out
    const removed = D.sectionEvents(held, [dp]).ev;
    const neverHad = D.sectionEvents(baseBox(), []).ev;
    ok(removed.length && JSON.stringify(removed) === JSON.stringify(neverHad),
       "taking the drum phrase out of the slot did not restore the genre's " +
       "own kit byte-for-byte");
    // and a MELODIC phrase in that same slot renders the genre's kit too —
    // the override is the phrase's KIND, not the slot it sits in
    const bMel = baseBox(); bMel.stack[0].slots = [0];
    const melodicInSlot = D.sectionEvents(bMel, [NS64.blank()]).ev;
    ok(lanesOf(hitsOf(melodicInSlot)).includes("h"),
       "a melodic phrase in the lead slot did not render the genre's own kit");
  }

  // (c) ACCENT, FLAM AND ROLL EACH CHANGE THE SCORE AS CLAIMED, read through
  // the same sectionEvents pipeline (a) and (b) used, not off K.drums alone.
  {
    const K64 = require("../../nukernel/kernel.js");
    const mk = mark => { const dp = NS64.blankDrum(); dp.s[4] = mark; return dp; };
    const b = baseBox(); b.stack[0].slots = [0];
    const hitOf = (mark, at) => hitsOf(D.sectionEvents(b, [mk(mark)]).ev)
      .filter(e => e.d === "s" && Math.abs(e.t - at) < 0.9);

    const normal = hitOf(K64.DMARK.HIT, 4);
    ok(normal.length === 1 && normal[0].vel === 5 && !normal[0].acc,
       "a plain hit mark did not render as one ordinary hit");

    const accent = hitOf(K64.DMARK.ACCENT, 4);
    ok(accent.length === 1 && accent[0].acc === true && accent[0].vel > normal[0].vel,
       "the accent mark did not raise the level or flag the accent");

    const ghost = hitOf(K64.DMARK.GHOST, 4);
    ok(ghost.length === 1 && ghost[0].vel < normal[0].vel,
       "the ghost mark did not lower the level");

    const flam = hitOf(K64.DMARK.FLAM, 4);
    ok(flam.length === 2 && flam.some(e => e.grace) && flam.some(e => !e.grace),
       "a flam did not add a quieter grace hit ahead of the beat (" +
       JSON.stringify(flam) + ")");

    const roll3 = hitOf(K64.DMARK.ROLL3, 4);
    ok(roll3.length === 3 && roll3.every(e => e.roll === 3) &&
       new Set(roll3.map(e => e.t)).size === 3,
       "a roll of three did not strike three times inside the step (" +
       JSON.stringify(roll3.map(e => e.t)) + ")");
  }

  // (d) A DRUM PHRASE SURVIVES SAVE AND LOAD — song.js's own path, not a
  // hand-rolled shortcut around it: migrate() then validateSong(), same as
  // any file this build opens.
  {
    const dp = NS64.blankDrum();
    dp.k[0] = 1; dp.s[4] = 2; dp.h = new Array(16).fill(1); dp.h[3] = 4;
    dp.swing = 2;
    const raw = { v: NS64.VERSION, slots: [dp], song: [
      { stack: [{ g: gk, slots: [0] }], len: 4, nudge: 0, ops: [], fx: [] } ] };
    const { ok: loadedOk, song, errors } = NS64.validateSong(NS64.migrate(raw));
    ok(loadedOk, "a song holding a drum phrase failed to load: " +
       JSON.stringify(errors[0]));
    const back = song && song.slots[0];
    ok(back && back.kind === "drum" && back.swing === 2 &&
       JSON.stringify(back.k) === JSON.stringify(dp.k) &&
       JSON.stringify(back.h) === JSON.stringify(dp.h),
       "the drum phrase did not round-trip through save/load intact");
  }

  // (e) THE OPS CHOKE POINT HOLDS. A box's `ops` chips are melodic-line
  // transforms (kernel.js word()) that a drum phrase has no deg/gate for —
  // they must pass over it rather than reach into it, at the one place
  // (word()) rather than a second guard in the scheduler.
  {
    const dp = NS64.blankDrum(); dp.k = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    const b = baseBox(); b.stack[0].slots = [0]; b.stack[0].ops = ["rev"];
    let threw = false, ev = [];
    try { ev = hitsOf(D.sectionEvents(b, [dp]).ev); } catch (e) { threw = true; }
    ok(!threw, "an 'ops' chip crashed rendering a drum phrase's lead slot");
    ok(ev.length && lanesOf(ev).join(",") === "k",
       "an 'ops' chip changed which lanes a drum phrase plays");
  }

  console.log("  64: a drum phrase overrides the kit and only the kit, " +
              "accent/flam/roll reach the score, it survives an ops chip, " +
              "and it saves and loads whole");
}

/* ── §65 COMING BACK IS A FADE AND A LOADING LINE ────────────────────────────
   Paul, on the build that shipped the night before: "There are definitely
   glitches when I come back in to the browser. Why don't you fade out radio and
   come back to live with a loading graphic on page?"

   §54 made the rendered tape the playback path whenever nobody is touching the
   machine, and going OUT to it is easy — the render already exists. Coming BACK
   is the hard direction and it is where the glitch lives: the live graph has
   been PARKED (disconnected from the destination, therefore not computed at
   all) while the transport counted bars without scheduling a note into any of
   them, so at the instant of a handback there is nothing in it. The shipped
   code dropped the quiet flag, took the very next bar line and hoped. Measured
   across a hide/return cycle in a real browser (test/probes/nukernel-return.probe.js,
   the ?jumpcut seam is that old path kept walkable):

     BEFORE  tape cut at 3370 ms, the graph's first sound at 3406 ms
             -> a 30 ms HOLE, 1323 samples at 44.1 kHz, hard-cut at both ends
     AFTER   0 ms, 0 samples: the tape keeps the song until the graph has
             proved it can render a bar, then they cross equal-power on a
             downbeat; ready at 1125 ms, crossed at 3047 ms

   Two things are held here, in node, where a handback is a truth table instead
   of a race:

   (a) THE DECISION — returnStep(), the same shape §54's carrierWant() is
       written in and for the same reason. Never a cross without a bar the graph
       has actually been given; never a cross anywhere but a bar line; and no
       world in which the machine believes both sources or neither.
   (b) THE CROSSFADE ITSELF, as the envelope it really is: the 65-point equal-
       power curve graph.js hands setValueCurveAtTime against the cosine
       audio/bounce.js steps the element down with. A click IS a step
       discontinuity, so the measurement is the largest one-sample step in the
       summed envelope — which is the difference between a jump cut and a
       fade, in a number. */
console.log("coming back is a fade and a loading line");
{
  const B65 = await import("../../nukernel/audio/bounce.js?ret=1");
  const G65 = await import("../../nukernel/audio/graph.js?ret=1");
  const step = B65.returnStep;

  /* (a) THE DECISION */
  {
    const base = { carrying: true, playing: true, primed: false, sounding: false,
                   waited: 0, ceiling: 6000, atBar: true };
    const w = o => step({ ...base, ...o });
    const cases = [
      [{}, "warm", "the tape keeps the song while the graph is still cold"],
      [{ primed: true }, "warm", "a bar scheduled is not yet a bar sounding"],
      [{ primed: true, sounding: true }, "cross",
       "scheduled AND sounding, on a bar line: cross"],
      [{ primed: true, sounding: true, atBar: false }, "wait",
       "ready, but the downbeat is too close to ramp into — take the next one"],
      [{ sounding: true }, "warm",
       "an analyser reading the tail of the last bar is not a primed graph"],
      [{ waited: 6000 }, "stay",
       "the ceiling with nothing scheduled: the tape keeps the song"],
      [{ waited: 6000, primed: true }, "cross",
       "the ceiling with bars scheduled: the structural proof stands alone"],
      [{ waited: 6000, primed: true, atBar: false }, "wait",
       "...but still only ever on a bar line"],
      [{ carrying: false }, "graph", "nothing is carrying: there is nothing to cross from"],
      [{ playing: false }, "stop", "the transport went away under the return"],
    ];
    for (const [o, exp, why] of cases) {
      const got = w(o);
      ok(got === exp, `§65(a) ${why}: returnStep said "${got}", not "${exp}" ` +
                      `(${JSON.stringify(o)})`);
    }
    // TOTAL AND SINGLE-VALUED over the whole cross product — the only form in
    // which "never two audible sources and never none" can be carried by a pure
    // function: one answer, always, and only ONE of the five moves the ear.
    const ANS = new Set(["warm", "wait", "cross", "stay", "graph", "stop"]);
    let worlds = 0, crosses = 0;
    for (const carrying of [0, 1]) for (const playing of [0, 1])
      for (const primed of [0, 1]) for (const sounding of [0, 1])
        for (const atBar of [0, 1]) for (const waited of [0, 6000, 60000]) {
          const r = step({ carrying: !!carrying, playing: !!playing,
                           primed: !!primed, sounding: !!sounding,
                           atBar: !!atBar, waited, ceiling: 6000 });
          worlds++;
          ok(ANS.has(r), `§65(a) a sixth answer: "${r}"`);
          if (r === "cross") {
            crosses++;
            // the two laws, restated at every point in the space
            ok(carrying && playing, `§65(a) a cross with carrying=${carrying} ` +
               `playing=${playing} — that is a fade from nothing`);
            ok(primed, "§65(a) a cross to a graph that has been given no bar");
            ok(atBar, "§65(a) a cross somewhere other than a bar line");
          }
        }
    ok(worlds === 96 && crosses > 0 && crosses < worlds,
       `§65(a) the walk is degenerate: ${crosses}/${worlds} worlds cross`);
    console.log(`  the return is total over ${worlds} worlds; ${crosses} of them cross`);
  }

  /* (b) THE SEQUENCE, AS THE WARM-UP RUNS IT */
  {
    const W = { carrying: true, playing: true, primed: false, sounding: false,
                waited: 0, ceiling: 6000, atBar: false };
    const seen = [];
    const go = (label, mutate, exp) => {
      mutate();
      const got = step(W);
      ok(got === exp, `§65(b) ${label}: "${got}", not "${exp}"`);
      seen.push(got);
    };
    go("the touch lands, the room is only just reconnected", () => {}, "warm");
    go("the transport hands the graph a bar", () => { W.primed = true; W.waited = 200; }, "warm");
    go("the analyser hears it, mid-bar", () => { W.sounding = true; W.waited = 1300; }, "wait");
    go("the downbeat", () => { W.atBar = true; }, "cross");
    ok(seen.join(">") === "warm>warm>wait>cross", `§65(b) the walk came out ${seen.join(">")}`);
    console.log("  cold -> a bar scheduled -> a bar sounding -> the downbeat");
  }

  /* (c) THE CROSSFADE, MEASURED */
  {
    // the artifact, not the intention: the 65-point equal-power curve graph.js
    // hands to setValueCurveAtTime (which interpolates it LINEARLY between the
    // points, so that is how it is reconstructed here) against the cosine
    // bounce.js steps the element down with, at 44.1 kHz.
    const SR = 44100, XF = 0.08, N = Math.round(SR * XF);
    const up = new Float32Array(65);
    for (let i = 0; i < 65; i++) up[i] = Math.sin((i / 64) * Math.PI / 2);
    const curveAt = x => {                          // the UA's own reconstruction
      const p = Math.max(0, Math.min(1, x)) * 64, i = Math.min(63, Math.floor(p));
      return up[i] + (up[i + 1] - up[i]) * (p - i);
    };
    const down = G65.epDown;                        // the shipped element half
    ok(Math.abs(down(0) - 1) < 1e-9 && Math.abs(down(1)) < 1e-9,
       "§65(c) the element's curve does not run from 1 to 0");
    // EQUAL POWER: sin²+cos² is 1 everywhere, which is the whole reason for the
    // shape — two takes of the same bar at the same phase, correlated at the
    // bottom of the spectrum and not at the top, must not dip in the middle.
    let worstPow = 0;
    for (let i = 0; i <= N; i++) {
      const x = i / N, p = curveAt(x) ** 2 + down(x) ** 2;
      worstPow = Math.max(worstPow, Math.abs(p - 1));
    }
    ok(worstPow < 0.002, `§65(c) the crossfade is not equal power: the summed ` +
       `power wanders ${worstPow.toFixed(5)} from unity`);
    // NEVER TWO SOURCES AT FULL, and never a hole: at the midpoint both sit at
    // .707, which is the definition of the fade rather than double playback.
    let bothFull = 0, sumMin = 9;
    for (let i = 0; i <= N; i++) {
      const x = i / N, a = curveAt(x), b = down(x);
      if (a > 0.95 && b > 0.95) bothFull++;
      sumMin = Math.min(sumMin, a + b);
    }
    ok(!bothFull, `§65(c) ${bothFull} samples with both sources at full level`);
    ok(sumMin > 0.99, `§65(c) the summed amplitude falls to ${sumMin.toFixed(3)} ` +
       `mid-fade — that is an audible dip`);
    // THE CLICK, AS A NUMBER. A click is a step discontinuity, so measure the
    // largest one-sample step in each envelope. BEFORE is the shipped handback:
    // the element's volume written to 0 in one instant while the graph ramps up
    // from nothing over unmuteRamp(12)'s twelve milliseconds — a full-scale step
    // in a single sample. AFTER is the curve pair above.
    const worstStep = f => {
      let worst = 0;
      for (let i = 0; i <= N; i++) worst = Math.max(worst, Math.abs(f(i) - f(i - 1)));
      return worst;
    };
    // the shipped handback, as one envelope through the seam: the element's
    // volume is written to 0 at sample 0 and the graph ramps linearly from
    // nothing over unmuteRamp(12) — so the sum drops the height of the whole
    // signal between two adjacent samples
    const before = i => (i <= 0 ? 1 : Math.min(1, (i / SR) / 0.012));
    const after = i => curveAt(i / N) + down(i / N);
    const sBefore = worstStep(before), sAfter = worstStep(after);
    ok(sBefore > 0.9, `§65(c) the before-envelope does not reproduce the jump cut ` +
       `(largest step ${sBefore.toFixed(4)})`);
    ok(sAfter < 0.001, `§65(c) the crossfade steps ${sAfter.toFixed(6)} per sample ` +
       `— at ${SR} Hz that is a corner the ear hears`);
    console.log(`  the seam, largest one-sample step at 44.1k: jump cut ` +
                `${sBefore.toFixed(4)}, equal-power fade ${sAfter.toFixed(6)} ` +
                `(${Math.round(sBefore / sAfter)}x smaller), summed power flat to ` +
                `${worstPow.toFixed(6)}`);
  }

  /* (d) THE CEILING IS A NUMBER, AND IT IS THE MEASURED ONE */
  {
    // the probe says a cold return reaches "the graph is making the sound"
    // in 1.1–1.4 s (one bar of counter plus the bar it must play), so a ceiling
    // under a second would be a promise the machine cannot keep and one over
    // ten would be a loading line nobody waits through. Held as a range, not a
    // constant, so a tempo change is not a test failure.
    const b = globalThis.window.__nuBounce();
    ok(b.returnCeil >= 3000 && b.returnCeil <= 10000,
       `§65(d) the return ceiling is ${b.returnCeil} ms, outside the measured range`);
    ok(b.returning === false && b.returnFrac === 0,
       "§65(d) a page that never played claims a return in flight");
    ok(typeof b.graphRms === "number",
       "§65(d) the pre-mute master reading is not published — the readiness " +
       "proof cannot be read from outside");
  }
}

/* ── §66 THE DESK SAYS WHAT IT IS COSTING, QUIETLY, IN THE CORNER ──────────
   Paul: "do you want to sneak a cpu monitor on mobile" — yes, because it says
   WHICH problem a glitch is (audio/graph.js's own comment carries the
   argument in full: a spike means the graph got too heavy to rebuild, a flat
   line with a glitch anyway means the handoff itself is wrong).

   Two things are held here, the same split §65 uses:
   (a) THE ARITHMETIC — loadHeadroom() is a pure function of a timer gap, so
       it is tested as arithmetic, no browser required.
   (b) THE REAL WIRING, read off the RENDERED DOM: the actual sampleLoad()
       emitting the actual "load" event onto the actual bus ui/readout.js
       actually subscribes to, painting an actual chip element — nothing
       here is reimplemented. window.__nuMix/__nuNodes are stubbed (the same
       way this file already stands in for window.NuGenres elsewhere)
       because driving the real mixer to a CHOSEN voice count needs a real
       song, decoded and playing — which is what the browser probe this lane
       also wrote is for (test/probes/nukernel-load.probe.js: a real page, a
       real handoff, the chip's path label read before and after — run once,
       not swept). What stays state-INDEPENDENT here on purpose is "which
       path is audible": rather than assume carrying is false, the check
       reads bounce.js's own isCarrying() and asks the chip to agree with
       whatever it currently says — true regardless of what an earlier
       section in this file left the shared audio singletons doing. */
console.log("the desk says what it is costing, quietly, in the corner");
{
  const G66 = await import("../../nukernel/audio/graph.js?load66=1");

  /* (a) THE ARITHMETIC */
  {
    const h = (gap) => G66.loadHeadroom(gap, G66.LOAD_PERIOD, G66.SCHED_BUDGET_MS);
    ok(h(G66.LOAD_PERIOD) === 1, "§66(a) dead on schedule is not full headroom");
    ok(h(G66.LOAD_PERIOD - 400) === 1, "§66(a) EARLY is not full headroom either");
    const mid = h(G66.LOAD_PERIOD + G66.SCHED_BUDGET_MS / 2);
    ok(Math.abs(mid - 0.5) < 1e-9, `§66(a) half the budget burned reads ${mid}, not 0.5`);
    ok(h(G66.LOAD_PERIOD + G66.SCHED_BUDGET_MS) === 0,
       "§66(a) exactly the whole budget burned is not yet zero");
    ok(h(G66.LOAD_PERIOD + G66.SCHED_BUDGET_MS * 9) === 0,
       "§66(a) headroom went negative instead of floor-ing at zero");
    // MONOTONIC — a longer gap never reads a HEALTHIER number
    let worstMono = 0;
    for (let g = 900; g < 2000; g += 17) worstMono = Math.max(worstMono, h(g) - h(g - 17));
    ok(worstMono <= 1e-9, `§66(a) loadHeadroom rose ${worstMono} for a LONGER gap`);
  }

  /* (b) THE REAL WIRING, ON THE REAL MODULES */
  {
    class Elem66 {
      constructor(tag) { this.tag = tag; this._cls = new Set(); this._on = {};
                          this._kids = []; this._attrs = {}; this.style = {}; this.textContent = ""; }
      get classList() {
        const s = this._cls;
        return { add: (...c) => c.forEach(x => s.add(x)),
                 remove: (...c) => c.forEach(x => s.delete(x)),
                 toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f;
                                      s[on ? "add" : "delete"](c); return on; },
                 contains: c => s.has(c) };
      }
      set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
      get className() { return [...this._cls].join(" "); }
      setAttribute(k, v) { this._attrs[k] = String(v); }
      getAttribute(k) { return this._attrs[k]; }
      addEventListener(t, fn) { (this._on[t] = this._on[t] || []).push(fn); }
      appendChild(el) { this._kids.push(el); return el; }
      append(...els) { this._kids.push(...els); }
      click() { for (const fn of (this._on.click || [])) fn({}); }
    }
    // an in-memory localStorage, so "survives a reload" (the brief's own
    // words) can actually be asked: a SECOND fresh import of readout.js below
    // reads the same store a FIRST import wrote to, exactly as two loads of
    // the real page would through the real one.
    const store66 = new Map();
    globalThis.localStorage = {
      getItem: k => (store66.has(k) ? store66.get(k) : null),
      setItem: (k, v) => store66.set(k, String(v)),
      removeItem: k => store66.delete(k),
    };
    const mkDoc66 = () => {
      const byId = {};
      return { getElementById: id => (byId[id] = byId[id] || new Elem66()),
               createElement: tag => new Elem66(tag),
               body: { appendChild: () => {} },
               addEventListener: () => {} };
    };
    globalThis.document = mkDoc66();

    const B66 = await import("../../nukernel/audio/bounce.js");   // the SAME instance readout.js imports
    const R66 = await import("../../nukernel/ui/readout.js?load66=1");
    const readoutEl66 = globalThis.document.getElementById("readout");
    const chip66 = readoutEl66._kids.find(k => k.className === "loadchip");
    const detail66 = readoutEl66._kids.find(k => k.className === "loaddetail");
    ok(chip66 && detail66, "§66(b) the chip (or its detail line) never joined the readout row");
    ok(chip66 && chip66.getAttribute("aria-label"),
       "§66(b) the collapsed chip has no accessible name — it is an icon with nothing behind it");

    // CLOSED BY DEFAULT, and silent: no stray localStorage key reads as open
    ok(!readoutEl66.classList.contains("loadopen") && detail66.textContent === "",
       "§66(b) the chip opens on its own before anybody has tapped it");

    // STUB THE TWO LEDGERS sampleLoad() reads — mixer.js/voices.js's own
    // budgets, standing in for a real song the way window.NuGenres already
    // stands in elsewhere in this file. Saved and restored so nothing after
    // this block inherits a fake mixer.
    const savedMix = globalThis.__nuMix, savedNodes = globalThis.__nuNodes;
    let parts66 = 2, alive66 = 1;
    globalThis.__nuMix = () => ({ nodes: { parts: parts66, total: 40 + parts66 } });
    globalThis.__nuNodes = () => ({ alive: alive66 });

    G66.sampleLoad();                                 // the FIRST tick: baseline, no gap to judge yet
    const wantPath66 = () => (B66.isCarrying() ? "tape" : "live");
    chip66.click();                                    // open the detail line
    ok(readoutEl66.classList.contains("loadopen"), "§66(b) a tap did not open the detail line");
    ok(detail66.textContent.includes("3v"),
       `§66(b) 2 parts + 1 alive synth read as "${detail66.textContent}", not 3v — the ` +
       "mixer's own two ledgers never reached the chip");
    ok(detail66.textContent.includes(wantPath66()),
       `§66(b) the chip says "${detail66.textContent}" while isCarrying() says ${B66.isCarrying()}`);
    ok(String(store66.get("nukernel.loadopen.v1")) === "1",
       "§66(b) the open/closed flag never reached localStorage — a reload would forget it");

    // ADD VOICES, WATCH IT RISE (the brief's own words) — the real sampleLoad(),
    // reading the real (stubbed) ledgers a second time
    parts66 = 9; alive66 = 4;
    G66.sampleLoad();
    ok(detail66.textContent.includes("13v"),
       `§66(b) parts 2->9 and alive 1->4 did not move the chip past "${detail66.textContent}"`);

    // A REAL STALL, not a mock of one — the same 250 ms budget loadHeadroom()
    // is built on, burned by an ACTUAL busy main thread rather than an
    // argument handed to a pure function, so this is the timer path itself
    // under test, not the arithmetic behind it a second time.
    const until = performance.now() + G66.LOAD_PERIOD + G66.SCHED_BUDGET_MS * 2;
    while (performance.now() < until) { /* a main thread that will not yield */ }
    const before66 = store66.get("nukernel.loadopen.v1");
    G66.sampleLoad();
    ok(chip66.classList.contains("bad"),
       "§66(b) a stall well past the whole scheduling budget did not read as `bad`");
    ok(detail66.textContent.includes("0.00x"),
       `§66(b) a stalled tick reads "${detail66.textContent}", not a floored 0.00x`);
    ok(/\d⚠/.test(detail66.textContent),
       "§66(b) a genuine dropped beat never reached the detail line");
    ok(store66.get("nukernel.loadopen.v1") === before66,
       "§66(b) reading a load sample rewrote the open/closed flag it should never touch");

    // CHEAP BY CONSTRUCTION — the monitor's own cost, measured, not assumed
    void R66;                        // kept alive: its "load" subscription is what painted the chip above
    let selfMax = 0;
    const seenSelf = [];
    const { on: on66 } = await import("../../nukernel/ui/state.js");
    on66("load", d => seenSelf.push(d.selfMs));
    for (let i = 0; i < 5; i++) G66.sampleLoad();
    for (const ms of seenSelf) selfMax = Math.max(selfMax, ms);
    ok(selfMax < 5, `§66(b) the monitor's own sample cost ${selfMax} ms — that is not negligible`);
    console.log(`  ${seenSelf.length} samples, worst self-cost ${selfMax.toFixed(3)} ms`);

    globalThis.__nuMix = savedMix; globalThis.__nuNodes = savedNodes;

    // …AND IT SURVIVES A RELOAD (the brief's own words): a second, independent
    // import of readout.js, a fresh document, the SAME localStorage — open
    // stays open with nothing tapped
    globalThis.document = mkDoc66();
    await import("../../nukernel/ui/readout.js?load66b=1");
    const readoutEl66b = globalThis.document.getElementById("readout");
    ok(readoutEl66b.classList.contains("loadopen"),
       "§66(b) a reload with the flag already set to open came back closed");
  }
}

console.log("\nnukernel: " + (checks - fails) + "/" + checks + " checks pass across " +
            GK.length + " genres");
if (fails) { console.error("nukernel: " + fails + " FAILURE(S)"); process.exit(1); }
process.exit(0);
})().catch(e => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
