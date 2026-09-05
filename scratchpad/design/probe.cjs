#!/usr/bin/env node
"use strict";
const { chromium } = require("playwright");
const path = require("path"); const fs = require("fs");
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
const PAGE = "http://127.0.0.1:8777/nukernel/index.html#at=Kingston&y=1969&s=1";
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  p.on("pageerror", (e) => console.log("ERR", e.message));
  await p.goto(PAGE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2800);
  await p.evaluate(() => window.__eightTab("Band"));
  await p.waitForTimeout(400);
  const D = await p.evaluate(() => window.__eightDoc());
  console.log("voices:", D.voices.map((v) => v.name + "/" + v.part).join(", "));
  console.log("sections:", D.form.sections.map((s) => s.id).join(", "));
  const sec = D.form.sections[0].id;
  const drums = (D.voices.find((v) => /drum|kit|perc/i.test((v.part||"")+(v.name||"")))||{}).name;
  console.log("drums:", drums);
  const openCell = async (k) => { await p.evaluate((key) => {
      const el = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (!el) return "missing"; if (!el.classList.contains("is-sel")) el.click();
      const e2 = document.querySelector('#pan-band [data-k="' + key + '"]');
      if (e2 && e2.getAttribute("aria-expanded") !== "true") e2.click(); }, k);
    await p.waitForTimeout(450); };
  if (drums) { await openCell("tcell|" + drums + "|" + sec);
    const ks = await p.evaluate(() => [...document.querySelectorAll("#pan-band tr.nu-wopen [data-k]")].map((x) => x.dataset.k).slice(0, 60));
    console.log("drum cell keys:", ks.join(" | "));
  }
  // row sheet
  await p.evaluate(() => { for (const el of document.querySelectorAll('#pan-band [aria-expanded="true"]')) el.click(); });
  await p.waitForTimeout(300);
  await p.evaluate((s) => document.querySelector('#pan-band [data-k="trow|' + s + '"]').click(), sec);
  await p.waitForTimeout(500);
  const rk = await p.evaluate(() => [...document.querySelectorAll("#pan-band tr.nu-wopen [data-k], #pan-band tr.nu-wopen [data-sel]")].map((x) => (x.dataset.k||"")+ (x.dataset.sel?("@"+x.dataset.sel):"")).slice(0, 80));
  console.log("row sheet keys:", rk.join(" | "));
  // time row
  await p.evaluate(() => { for (const el of document.querySelectorAll('#pan-band [aria-expanded="true"]')) el.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__eightRow("time", true));
  await p.waitForTimeout(500);
  const tk = await p.evaluate(() => [...document.querySelectorAll("#pan-band tr.nu-wopen [data-k], #pan-band tr.nu-wopen [data-sel]")].map((x) => (x.dataset.k||"")+(x.dataset.sel?("@"+x.dataset.sel):"")).slice(0, 90));
  console.log("time row keys:", tk.join(" | "));
  // mix
  await p.evaluate(() => { for (const el of document.querySelectorAll('#pan-band [aria-expanded="true"]')) el.click(); });
  await p.waitForTimeout(300);
  const okMix = await p.evaluate((v) => window.__eightMix(v), D.voices[0].name);
  console.log("mix open?", okMix, "keys:", (await p.evaluate(() => [...document.querySelectorAll("#pan-band tr.nu-wopen [data-k]")].map((x)=>x.dataset.k).slice(0,30))).join(" | "));
  // bar
  const bar = await p.evaluate(() => { const c = [...document.querySelectorAll("body > *")].map((x)=>x.tagName+"."+x.className).join("\n"); return c; });
  console.log("body children:\n" + bar);
  await b.close();
})();
