#!/usr/bin/env node
// shot-settings.js — screenshot the ⚙ settings popup (needs playback for the panel
// to render). NODE_PATH=/home/ford/ftrain-2025/node_modules node test/shot-settings.js
"use strict";
const path = require("path");
const { serve, launchChromium } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8804;
const OUT = path.join(ROOT, "scratch", "settings.png");

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S, { timeout: 20000 });
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => window.__S.playing, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.getElementById("cfgChip").click());
  await page.waitForTimeout(700);
  // find the settings panel element and shoot just it, plus a full-page shot
  const box = await page.evaluate(() => {
    const cands = [...document.querySelectorAll("div,section,aside")].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 180 && r.width < 640 && r.height > 160 && el.querySelector(".row");
    });
    cands.sort((a, b) => (a.getBoundingClientRect().width * a.getBoundingClientRect().height) - (b.getBoundingClientRect().width * b.getBoundingClientRect().height));
    const el = cands[0]; if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  require("fs").mkdirSync(path.dirname(OUT), { recursive: true });
  if (box) await page.screenshot({ path: OUT, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.w + 16, height: box.h + 16 } });
  else await page.screenshot({ path: OUT });
  console.log("panel box:", JSON.stringify(box), "-> wrote", OUT);
  await browser.close(); srv.close();
}
main().catch(e => { console.error(e); process.exit(1); });
