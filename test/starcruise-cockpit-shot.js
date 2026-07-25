#!/usr/bin/env node
// starcruise-cockpit-shot.js — captures ONE fly-away / cockpit frame of the
// 🛸 STAR-CRUISE mode: land on a genre, then DEPART so the pilot lifts off into
// the space/cockpit state (planet receding below, genre console lit) and grab a
// PNG of the display canvas. Reuses only the documented __STARCRUISE probe hooks.
//
//   node test/starcruise-cockpit-shot.js
"use strict";
const path = require("path");
const fs = require("fs");
const { serve, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8813;
const OUT = path.join(ROOT, "scratch", "shots");

async function launchGL() {
  const { chromium } = require("playwright");
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  const args = ["--no-sandbox", "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist", "--enable-webgl"];
  const opts = { headless: true, args };
  if (fs.existsSync(exe)) opts.executablePath = exe;
  return chromium.launch(opts);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(ROOT, PORT);
  const browser = await launchGL();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 768 });
  const errs = capturePageErrors(page);

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__STARCRUISE && document.getElementById("cruiseChip"), { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__STARCRUISE.start());
  await page.waitForFunction(() => window.__STARCRUISE.isRunning() && window.__STARCRUISE.hasThree(), { timeout: 20000 });
  await page.waitForTimeout(300);

  // Land on a genre, then DEPART into the cockpit/space climb.
  const info = await page.evaluate(() => {
    const SC = window.__STARCRUISE;
    // clean flying baseline
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 1, beatPhase: 0, playing: true });
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__step(0.2);
    // land on vaporwave
    SC.__injectTravel({ weights: [{ g: "vaporwave", w: 1 }], dominant: "vaporwave", position: { x: 0, y: 0 }, live: true, seed: 1 });
    for (let i = 0; i < 120; i++) { if (SC.__step(0.1).phase === "DANCE") break; }
    // DEPART — lift off into space/cockpit
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    const prog = [];
    for (let i = 0; i < 16; i++) { SC.__step(0.2); prog.push(+SC.space().spaceProgress.toFixed(3)); }
    const sp = SC.space();
    const smp = SC.sampleLowRes();
    return { cockpit: sp.hasCockpit, planet: sp.hasPlanet, genres: sp.genres,
      spaceProgress: sp.spaceProgress, planetY: sp.planetY,
      nonBg: smp && smp.nonBg, blank: smp && smp.blank, prog };
  });
  // let the compositor present a few frames
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__STARCRUISE.__step(0.016); });
  await page.waitForTimeout(300);

  const outPath = path.join(OUT, "starcruise-cockpit.png");
  const handle = await page.$("#starcruise-canvas");
  await handle.screenshot({ path: outPath });
  let sz = fs.statSync(outPath).size;
  if (sz < 3000) {
    const durl = await page.evaluate(() => {
      window.__STARCRUISE.__step(0);
      const c = document.getElementById("starcruise-canvas");
      try { return c.toDataURL("image/png"); } catch (e) { return null; }
    });
    if (durl && durl.startsWith("data:image/png")) {
      fs.writeFileSync(outPath, Buffer.from(durl.split(",")[1], "base64"));
      sz = fs.statSync(outPath).size;
    }
  }

  console.log(`  COCKPIT  cockpit=${info.cockpit} planet=${info.planet} spaceProgress=${Number(info.spaceProgress).toFixed(2)} genres=${JSON.stringify(info.genres)} nonBg=${info.nonBg} -> ${outPath} (${sz} bytes)`);
  if (errs.length) console.log("PAGE ERRORS:\n  " + errs.join("\n  "));

  await page.evaluate(() => { window.__STARCRUISE.__injectTravel(null); window.__STARCRUISE.__injectBeat(null); window.__STARCRUISE.stop(); });
  await browser.close();
  srv.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
