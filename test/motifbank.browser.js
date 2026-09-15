#!/usr/bin/env node
// test/motifbank.browser.js — THE BANK SHOWS THE MOTIFS (2026-09-14).
//
// Paul: "I'd expect to see the motifs as sheet music or drum patterns and then
// I can just click on them." Taken off the rendered page:
//
// M1  every line motif in the bank is drawn as an engraving (an <svg>)
// M2  every drum motif is drawn as a pattern: a cell per struck lane per step
// M3  the picture is a button, and a tap on it opens that motif
// M4  the open motif is still the bench (Paul, 2026-09-15: "Wait I miss the
//     old motif editor!!!") — the picture changed, the editor did not
// M5  the page never threw
//
// Run: MOTIF_URL=http://localhost:8777/nukernel/index.html node test/motifbank.browser.js
"use strict";
const URL_ = process.env.MOTIF_URL || "http://localhost:8777/nukernel/index.html";

let FAILS = 0;
const is = (cond, m) => { if (cond) console.log("  ok   " + m); else { FAILS++; console.log("  FAIL " + m); } };

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  console.log("motif bank gate · " + URL_);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(URL_);
  await page.waitForFunction(() => typeof window.__eightTabNow === "function", null, { timeout: 30000 });
  await page.waitForTimeout(800);
  // a record with a drum motif as well as line motifs
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#atlas button.nu-ixrow")];
    (rows.find((r) => /reggae/i.test(r.textContent)) || rows[rows.length - 40]).click();
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__eightTab("Band"); window.__eightRow("motifs", true); window.__eightMotif(null); });
  await page.waitForTimeout(3000);

  const bank = await page.evaluate(() => {
    const cells = window.__eightDoc().material.cells;
    return window.__eightBank().map((n) => {
      const pic = document.querySelector('[data-k="motifpic|' + CSS.escape(n) + '"]');
      const lanes = cells[n].lanes ? Object.keys(cells[n].lanes).filter((k) => /^[a-z]/i.test(k)).length : 0;
      return { n, drum: cells[n].kind === "drum", button: !!pic && pic.tagName === "BUTTON",
               svg: !!(pic && pic.querySelector("svg")), dots: pic ? pic.querySelectorAll(".nu-dthumb i").length : 0, lanes };
    });
  });
  const lines = bank.filter((b) => !b.drum), drums = bank.filter((b) => b.drum);
  is(lines.length > 0 && lines.every((b) => b.svg), "M1 every line motif is an engraving (" + lines.filter((b) => b.svg).length + "/" + lines.length + ")");
  is(drums.length > 0 && drums.every((b) => b.dots > 0), "M2 every drum motif is a pattern (" + drums.map((b) => b.dots + " cells").join(", ") + ")");
  is(bank.every((b) => b.button), "M3 every picture is a button");

  const name = lines[0].n;
  await page.click('[data-k="motifpic|' + name + '"]');
  await page.waitForTimeout(1500);
  is(await page.evaluate(() => window.__eightMotifNow()) === name, "M3 a tap on the picture opens " + name);
  const bench = await page.evaluate(() => document.querySelectorAll(".nu-bench").length);
  is(bench > 0, "M4 the open motif is still the bench (" + bench + " .nu-bench)");
  is(errs.length === 0, "M5 the page never threw" + (errs.length ? ": " + errs[0] : ""));

  await browser.close();
  console.log(FAILS ? "\nFAIL — " + FAILS + " assertion(s) failed" : "\nALL PASS");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
