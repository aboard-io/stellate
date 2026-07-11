#!/usr/bin/env node
// starcruise-shot.js — SCREENSHOT harness for the 🛸 STAR-CRUISE 3D video mode.
//
// Reuses starcruise-run.js's exact page-setup + WebGL launch + injected FLY->LAND
// approach, but instead of asserting the scaffold it FORCES a landing on each of a
// set of contrasting genres, advances the flight machine into its DANCE phase (so
// the alien band assembles + plays on the beat with its city/farm backdrop), and
// saves a PNG of the UPSCALED display canvas (#starcruise-canvas — the pixels the
// user actually sees) so a human can eyeball the genre->band diversity.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/starcruise-shot.js
//
// Writes scratch/shots/starcruise-<genre>.png. Reads NOTHING from app/ or engine/
// beyond the documented window.__STARCRUISE probe hooks; injects only the
// production-null __injectTravel/__injectBeat overrides the run harness already uses.
"use strict";
const path = require("path");
const fs = require("fs");
const { serve, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8812;
const OUT = path.join(ROOT, "scratch", "shots");

const GENRES = ["heavymetal", "jazz", "ambient", "techno", "vaporwave"];

// same GL launch as starcruise-run.js — a real WebGL context via SwiftShader/ANGLE.
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

// Drive the flight machine to DANCE on ONE genre and return its assembled band
// TRAITS (for the human-readable report). Mirrors starcruise-run.js sections G/H:
// depart to a clean flying baseline, then inject a strong single-genre dominant so
// the machine flies FLY->APPROACH->LAND->OPEN->GREET->DANCE and spawns the band.
async function driveToDance(page, genre) {
  return page.evaluate((G) => {
    const SC = window.__STARCRUISE;
    // 1) DEPART to a clean flying baseline (tears down any prior band/backdrop/ship).
    SC.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 1, beatPhase: 0, playing: true });
    SC.__injectTravel({ weights: [], dominant: null, position: null, live: false, seed: 1 });
    for (let i = 0; i < 12; i++) SC.__step(0.2);
    // 2) Inject a strong single-genre dominant -> fly in and LAND on THIS genre.
    SC.__injectTravel({ weights: [{ g: G, w: 1 }], dominant: G, position: { x: 0, y: 0 }, live: true, seed: 1 });
    const phases = [];
    for (let i = 0; i < 120; i++) {
      const st = SC.__step(0.1);
      if (phases[phases.length - 1] !== st.phase) phases.push(st.phase);
      if (st.phase === "DANCE") break;
    }
    const tr = SC.traits();
    return {
      phases, phase: SC.state().phase, band: SC.band().length,
      backdrop: tr && tr.backdrop, crowd: tr && tr.crowd, skin: tr && tr.skin,
      genre: tr && tr._genre,
      members: (tr && tr.band || []).map((m) => ({
        role: m.role, family: m.instrument.family, playStyle: m.instrument.playStyle,
        hitsPerBeat: m.instrument.hitsPerBeat,
      })),
      groove: tr && tr.groove ? { tempoBpm: Math.round(tr.groove.tempoBpm), energy: +tr.groove.energy.toFixed(2),
        bounce: +tr.groove.bounce.toFixed(2) } : null,
      bpm: tr && tr._features ? Math.round(tr._features.bpm) : null,
    };
  }, genre);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(ROOT, PORT);
  const browser = await launchGL();
  const page = await browser.newPage();
  // a comfortable frame so the landed band + backdrop read clearly.
  await page.setViewportSize({ width: 1024, height: 768 });
  const errs = capturePageErrors(page);

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__STARCRUISE && document.getElementById("cruiseChip"), { timeout: 20000 });
  await page.waitForTimeout(300);

  // activate the mode once (Three lazy-loads on the first start()); the RAF loop then
  // renders continuously, so once we park in DANCE the display canvas keeps showing it.
  await page.evaluate(() => window.__STARCRUISE.start());
  await page.waitForFunction(() => window.__STARCRUISE.isRunning() && window.__STARCRUISE.hasThree(), { timeout: 20000 });
  await page.waitForTimeout(300);

  const report = [];
  for (const genre of GENRES) {
    const info = await driveToDance(page, genre);
    if (info.phase !== "DANCE") console.warn(`  WARN  ${genre}: reached ${info.phase}, not DANCE (${info.phases.join("->")})`);

    // Park the beat mid-swing (hands off their contact) so the still clearly reads as
    // a band caught PLAYING, then let the live RAF loop composite a few frames at that
    // pose before we grab the pixels.
    await page.evaluate(() => {
      window.__STARCRUISE.__injectBeat({ bpm: 120, spb: 0.5, cbeats: 8, serial: 2, beatPhase: 0.28, playing: true });
      for (let i = 0; i < 4; i++) window.__STARCRUISE.__step(0.016);
    });
    await page.waitForTimeout(250);   // let the compositor present the DANCE frame

    // sanity: the low-res target is a real non-blank frame right now.
    const s = await page.evaluate(() => window.__STARCRUISE.sampleLowRes());

    const outPath = path.join(OUT, `starcruise-${genre}.png`);
    const handle = await page.$("#starcruise-canvas");
    if (!handle) throw new Error("no #starcruise-canvas to screenshot");
    await handle.screenshot({ path: outPath });

    // fallback: if the compositor screenshot came out tiny/blank, capture the canvas
    // pixels directly via toDataURL (the RAF loop just rendered a fresh frame).
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

    report.push({ genre, info, sample: s, outPath, size: sz });
    console.log(`  SHOT  ${genre.padEnd(11)} phase=${info.phase} band=${info.band} backdrop=${info.backdrop} nonBg=${s && s.nonBg} spread=${s && s.spread} -> ${outPath} (${sz} bytes)`);
  }

  await page.evaluate(() => window.__STARCRUISE.stop());
  await browser.close();
  srv.close();

  console.log("\n==== BAND MAKEUP PER GENRE ====");
  for (const r of report) {
    const i = r.info;
    console.log(`\n${r.genre}  [${i.backdrop} backdrop, ${i.skin} skin, ~${i.bpm}bpm, energy ${i.groove && i.groove.energy}] — ${i.crowd} players:`);
    for (const m of i.members) console.log(`   • ${m.role.padEnd(5)} ${m.family.padEnd(14)} ${m.playStyle.padEnd(7)} ${m.hitsPerBeat} hit/beat`);
  }
  if (errs.length) console.log("\nPAGE ERRORS:\n  " + errs.join("\n  "));
  console.log("\nDONE — " + report.length + " screenshots in " + OUT);
  // machine-readable dump for the caller.
  console.log("\nJSON " + JSON.stringify(report.map((r) => ({ genre: r.genre, size: r.size, path: r.outPath,
    band: r.info.members, backdrop: r.info.backdrop, crowd: r.info.crowd }))));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
