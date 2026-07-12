#!/usr/bin/env node
// starcruise-stand-shot.js — CLEAN LANDED WIDE shots proving the band STANDS with its
// FEET ON THE GROUND (faces visible), for the feet-plant fix. Reuses starcruise-shot.js's
// drive-to-DANCE, but frames a WIDE, front-on, slightly-elevated view (no aggressive close
// dolly) so the whole band + the little planet surface under their feet is in frame.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/starcruise-stand-shot.js
// Writes scratch/shots/stand-<genre>.png.
"use strict";
const path = require("path");
const fs = require("fs");
const { serve, capturePageErrors, installOfflineRoute } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8815;
const OUT = path.join(ROOT, "scratch", "shots");
const GENRES = ["heavymetal", "jazz", "vaporwave"];
const ORBIT_SPEED = 0.0055;

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

async function driveToDance(page, genre) {
  return page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 1, beatPhase: 0, playing: true });
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__step(0.2);
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    const phases = [];
    for (let i = 0; i < 120; i++) {
      const st = SC.__step(0.1);
      if (phases[phases.length - 1] !== st.phase) phases.push(st.phase);
      if (st.phase === "DANCE") break;
    }
    return { phases, phase: SC.state().phase, band: SC.band().length };
  }, genre);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(ROOT, PORT);
  const browser = await launchGL();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 768 });
  page.setDefaultTimeout(180000);
  page.setDefaultNavigationTimeout(180000);
  await installOfflineRoute(page, PORT, { neutralizeMain: true });
  const errs = capturePageErrors(page);

  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: "commit" }).catch(() => {});
  await page.waitForFunction(() => window.__STARCRUISE && document.getElementById("cruiseChip"), { timeout: 120000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__STARCRUISE.start());
  await page.waitForFunction(() => window.__STARCRUISE.isRunning() && window.__STARCRUISE.hasThree(), { timeout: 20000 });
  await page.waitForTimeout(300);

  const report = [];
  for (const genre of GENRES) {
    const info = await driveToDance(page, genre);
    if (info.phase !== "DANCE") console.warn(`  WARN  ${genre}: reached ${info.phase}, not DANCE`);

    // hold a mid-swing beat so hands are caught PLAYING.
    await page.evaluate(() => {
      window.__STARCRUISE.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0.28, playing: true });
      for (let i = 0; i < 4; i++) window.__STARCRUISE.__step(0.016);
    });
    await page.waitForTimeout(200);

    // WIDE FRAMING via the REAL nav path (suspends the auto music-cam for 2.5s):
    //   yaw -> 0 (front-on, the +Z-facing band looks at the lens)
    //   pitch -> +0.14 (a touch ELEVATED, looking gently DOWN so the FEET + the little
    //            planet surface under them AND the faces are all in frame)
    const handle0 = await page.$("#starcruise-canvas");
    const box = await handle0.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate((SPEED) => {
      const SC = window.__STARCRUISE, o = SC.orbit();
      const TARGET_PITCH = 0.14;
      const dx = o.yaw / SPEED;
      const dy = (o.pitch - TARGET_PITCH) / SPEED;
      SC.__drag(dx, dy);
    }, ORBIT_SPEED);
    // dolly OUT to a WIDE distance so the whole standing band + ground reads (no close-up).
    for (let z = 0; z < 20; z++) {
      const o = await page.evaluate(() => window.__STARCRUISE.orbit());
      if (o.dist >= 13) break;
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(20);
    }
    await page.evaluate(() => { window.__STARCRUISE.__step(0.016); window.__STARCRUISE.__step(0.016); });
    await page.waitForTimeout(200);

    const s = await page.evaluate(() => window.__STARCRUISE.sampleLowRes());
    const orbitNow = await page.evaluate(() => window.__STARCRUISE.orbit());
    const outPath = path.join(OUT, `stand-${genre}.png`);
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
    report.push({ genre, outPath, size: sz });
    console.log(`  SHOT  ${genre.padEnd(11)} phase=${info.phase} band=${info.band} nonBg=${s && s.nonBg} dist=${orbitNow && orbitNow.dist.toFixed(2)} pitch=${orbitNow && orbitNow.pitch.toFixed(2)} -> ${outPath} (${sz} bytes)`);
  }

  await page.evaluate(() => window.__STARCRUISE.stop());
  await browser.close();
  srv.close();
  if (errs.length) console.log("\nPAGE ERRORS:\n  " + errs.join("\n  "));
  console.log("\nDONE — " + report.length + " wide standing shots in " + OUT);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
