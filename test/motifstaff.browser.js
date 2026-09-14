#!/usr/bin/env node
// test/motifstaff.browser.js — THE MOTIF EDITED WHERE IT IS DRAWN (2026-09-14).
//
// Paul: "I'd expect to see the motifs as sheet music or drum patterns and then
// I can just click on them to edit them." This replaces test/bench.test.js,
// whose sixteen-row step table the staff editor replaced (ui/motifedit.js).
// Every assertion is taken off the rendered page, and the record is read back
// through __eightDoc, so what the page shows and what it wrote are compared.
//
// S1  the bank draws every line motif as an engraving and every drum motif as
//     a pattern, and the picture is the button that opens it
// S2  an open line motif has no step table; every notehead on its staff is
//     wired to the step it starts on
// S3  a tap on a note selects it, and the row under the staff names it
// S4  ArrowUp raises that note one degree in the record, and the selection
//     survives the re-engrave
// S5  a tap on a rest writes a note that fills the rest, selected
// S6  a vertical drag on a note moves it up the scale
// S7  × makes the selected note a rest
// S8  a drum motif is a pattern: a row per lane, a count cell per step (the
//     playhead's), and a tap walks rest → hit → accent → ghost → rest in the
//     record
// S9  at 390px the open drum pattern never scrolls the page sideways
// S10 the page never threw
//
// Run: MOTIF_URL=http://localhost:8777/nukernel/index.html node test/motifstaff.browser.js
"use strict";
const URL_ = process.env.MOTIF_URL || "http://localhost:8777/nukernel/index.html";

let FAILS = 0;
const is = (cond, m) => { if (cond) console.log("  ok   " + m); else { FAILS++; console.log("  FAIL " + m); } };

async function boot(browser, viewport) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(URL_);
  await page.waitForFunction(() => typeof window.__eightTabNow === "function", null, { timeout: 30000 });
  await page.waitForTimeout(800);
  // a record with a drum motif and several line motifs
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#atlas button.nu-ixrow")];
    (rows.find((r) => /reggae/i.test(r.textContent)) || rows[rows.length - 40]).click();
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__eightTab("Band"); window.__eightRow("motifs", true); });
  await page.waitForTimeout(400);
  return { page, errs };
}

const doc = (page, name) => page.evaluate((n) => JSON.parse(JSON.stringify(window.__eightDoc().material.cells[n])), name);
const center = async (h) => { const b = await h.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  console.log("motif staff gate · " + URL_);
  const { page, errs } = await boot(browser, { width: 1280, height: 900 });

  /* ---- S1 the bank -------------------------------------------------------- */
  await page.evaluate(() => window.__eightMotif(null));
  await page.waitForTimeout(2500);
  const bank = await page.evaluate(() => {
    const cells = window.__eightDoc().material.cells;
    return window.__eightBank().map((n) => {
      const pic = document.querySelector('[data-k="motifpic|' + CSS.escape(n) + '"]');
      return { n, kind: cells[n].kind, pic: !!pic, button: pic && pic.tagName === "BUTTON",
               svg: !!(pic && pic.querySelector("svg")), thumb: !!(pic && pic.querySelector(".nu-dthumb")) };
    });
  });
  const lines = bank.filter((b) => b.kind !== "drum"), drums = bank.filter((b) => b.kind === "drum");
  is(lines.length > 0 && lines.every((b) => b.button && b.svg),
    "S1 every line motif in the bank is an engraving on a button (" + lines.filter((b) => b.svg).length + "/" + lines.length + ")");
  is(drums.length > 0 && drums.every((b) => b.button && b.thumb),
    "S1 every drum motif in the bank is a pattern on a button (" + drums.filter((b) => b.thumb).length + "/" + drums.length + ")");
  const lineName = lines[0].n, drumName = drums[0].n;
  await page.click('[data-k="motifpic|' + lineName + '"]');
  await page.waitForTimeout(2000);
  is(await page.evaluate(() => window.__eightMotifNow()) === lineName, "S1 a tap on the picture opens " + lineName);

  /* ---- S2 wired staff, no table -------------------------------------------- */
  const wired = await page.evaluate(() => {
    const heads = [...document.querySelectorAll("#staff .abcjs-note")];
    return { bench: document.querySelectorAll(".nu-bench").length, heads: heads.length,
             wired: heads.filter((h) => h.dataset.step != null).length };
  });
  is(wired.bench === 0, "S2 no step table (" + wired.bench + " .nu-bench)");
  is(wired.heads > 0 && wired.wired === wired.heads, "S2 every notehead knows its step (" + wired.wired + "/" + wired.heads + ")");

  /* ---- S3 select ----------------------------------------------------------- */
  let head = (await page.$$("#staff .abcjs-note"))[0];
  const step = +(await head.getAttribute("data-step"));
  let c = await center(head);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(300);
  const selNow = () => page.evaluate(() => { const s = document.querySelector("#staff .abcjs-note.nu-sel"); return s ? +s.dataset.step : null; });
  is(await selNow() === step, "S3 the tapped note is selected (step " + step + ")");
  const label = await page.textContent(".nu-notelab");
  is(!/tap a note/.test(label), "S3 the row under the staff names it: " + JSON.stringify(label));

  /* ---- S4 keyboard pitch --------------------------------------------------- */
  const before = await doc(page, lineName);
  const expectDeg = Math.min(7, (before.deg[step] | 0) + 1);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(900);
  is((await doc(page, lineName)).deg[step] === expectDeg, "S4 ArrowUp writes degree " + expectDeg + " at step " + step);
  is(await selNow() === step, "S4 the selection survives the re-engrave");

  /* ---- S5 write on a rest -------------------------------------------------- */
  const rest = await page.$("#staff .abcjs-rest");
  if (rest) {
    const at = +(await rest.getAttribute("data-rest"));
    c = await center(rest);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(900);
    const after = await doc(page, lineName);
    is(after.play[at] === "n", "S5 a tapped rest at step " + at + " is a note in the record");
    is(await selNow() === at, "S5 …and the new note is selected");
  } else is(false, "S5 the motif has a rest to tap");

  /* ---- S6 drag ------------------------------------------------------------- */
  head = (await page.$$("#staff .abcjs-note"))[0];
  const dStep = +(await head.getAttribute("data-step"));
  const d0 = (await doc(page, lineName)).deg[dStep] | 0;
  c = await center(head);
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.mouse.move(c.x, c.y - 10, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(900);
  const d1 = (await doc(page, lineName)).deg[dStep] | 0;
  is(d0 >= 7 ? d1 === d0 : d1 > d0, "S6 dragging up moves the note up the scale (" + d0 + " → " + d1 + ")");

  /* ---- S7 delete ----------------------------------------------------------- */
  const selAt = await selNow();
  await page.click(".nu-nbdel");
  await page.waitForTimeout(900);
  is(selAt != null && (await doc(page, lineName)).play[selAt] === "r", "S7 × makes the selected note a rest");

  /* ---- S8 drum pattern ----------------------------------------------------- */
  await page.evaluate((n) => window.__eightMotif(n), drumName);
  await page.waitForTimeout(1200);
  const pat = await page.evaluate(() => {
    const t = document.querySelector(".nu-drumpat");
    if (!t) return null;
    return { rows: t.querySelectorAll("tr[data-lane]").length,
             counts: [...t.querySelectorAll("th.nu-dpcount")].filter((th) => th.dataset.live === "count").length };
  });
  const lanes = Object.keys((await doc(page, drumName)).lanes || {}).length;
  is(pat && pat.rows === lanes, "S8 a row per lane (" + (pat && pat.rows) + "/" + lanes + ")");
  is(pat && pat.counts >= 12, "S8 a playhead count cell per step (" + (pat && pat.counts) + ")");
  const cell = await page.$(".nu-drumpat .nu-dp");
  const key = await cell.getAttribute("data-k");               // "kit" + lane + step
  const m = key.match(/^kit(.+?)(\d+)$/);
  // rest → hit → accent → ghost → rest, from wherever the step starts
  const next = (v) => (v === 0 ? 4 : v >= 7 ? 1 : v <= 1 ? 0 : 7);
  let v = +(await cell.getAttribute("data-v"));
  const want = [], seen = [];
  for (let k = 0; k < 4; k++) {
    v = next(v); want.push(v);
    await cell.click(); await page.waitForTimeout(150);
    seen.push(+(await cell.getAttribute("data-v")));
  }
  is(JSON.stringify(seen) === JSON.stringify(want), "S8 taps walk the levels " + JSON.stringify(want) + ": " + JSON.stringify(seen));
  const lv = (await doc(page, drumName)).lanes[m[1]][+m[2]] | 0;
  is(seen[3] === 0 ? lv === 0 : lv > 0, "S8 …and the record follows the face (level " + lv + ")");

  is(errs.length === 0, "S10 the page never threw" + (errs.length ? ": " + errs[0] : ""));
  await page.close();

  /* ---- S9 phone ------------------------------------------------------------ */
  const phone = await boot(browser, { width: 390, height: 844 });
  await phone.page.evaluate((n) => window.__eightMotif(n), drumName);
  await phone.page.waitForTimeout(1200);
  const over = await phone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  is(over <= 0, "S9 at 390px the drum pattern does not scroll the page sideways (" + over + "px over)");
  is(phone.errs.length === 0, "S10 the phone page never threw" + (phone.errs.length ? ": " + phone.errs[0] : ""));

  await browser.close();
  console.log(FAILS ? "\nFAIL — " + FAILS + " assertion(s) failed" : "\nALL PASS");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
