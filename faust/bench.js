#!/usr/bin/env node
// bench.js — headless benchmark of the per-voice FAUST worklet graph.
// Run: NODE_PATH=/home/ford/ftrain-2025/node_modules node bench.js
// Needs ./serve.sh already listening on 8777 (it serves the repo root).
//
// Phases:
//   A  60s sustained playback         -> audio really plays (RMS), 0 errors
//   B  20s playback + 50ms param storm-> recompile-free timbre glide proof
//   C  20s playback + storm at 4x CPU throttle (CDP Emulation)
"use strict";
const { chromium } = require("playwright");

const URL = "http://localhost:8777/faust/index.html";
const EXE = "/home/ford/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function snap(page) {
  return page.evaluate(() => {
    const e = window.__eng;
    return { rms: e.rms(), errors: e.errors.slice(), jank: { ...e.jank }, ctxState: e.ctx.state, nodes: e.nodeCount };
  });
}

async function phase(page, label, ms, sampleEvery = 1000) {
  await page.evaluate(() => window.__eng.resetJank());
  const rmsSamples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await sleep(sampleEvery);
    rmsSamples.push(await page.evaluate(() => window.__eng.rms()));
  }
  const s = await snap(page);
  const nz = rmsSamples.filter(r => r > 1e-4).length;
  const out = {
    label, seconds: ms / 1000,
    rmsMean: +(rmsSamples.reduce((a, b) => a + b, 0) / rmsSamples.length).toFixed(4),
    rmsNonzeroSamples: `${nz}/${rmsSamples.length}`,
    worstRafGapMs: +s.jank.worstRafGapMs.toFixed(1),
    rafGapsOver50: s.jank.rafGapsOver50,
    worstAudioStallMs: +s.jank.worstAudioStallMs.toFixed(1),
    workletErrors: s.errors.length, ctxState: s.ctxState,
  };
  console.log(JSON.stringify(out));
  return out;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
  });
  const page = await browser.newPage();
  page.on("console", m => { if (m.type() === "error") console.log("[page-error]", m.text()); });
  page.on("pageerror", e => console.log("[pageerror]", e.message));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__eng, null, { timeout: 30000 });
  console.log("engine ready:", JSON.stringify(await page.evaluate(() => ({
    nodes: window.__eng.nodeCount, sr: window.__eng.ctx.sampleRate,
  }))));

  await page.evaluate(async () => { await window.__eng.ctx.resume(); window.__eng.play(); });
  await sleep(1500); // let the graph spin up before measuring

  const A = await phase(page, "A: sustained 60s playback", 60000);

  await page.evaluate(() => window.__eng.stormStart());
  const B = await phase(page, "B: 20s param storm (cutoff sweep all voices @50ms)", 20000);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const C = await phase(page, "C: 20s storm + playback at 4x CPU throttle", 20000);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.evaluate(() => window.__eng.stormStop());

  const pass = (p, storm) => p.rmsMean > 0.005 && p.workletErrors === 0 && p.worstAudioStallMs < (storm ? 30 : 15);
  console.log("\nVERDICT-ish:",
    JSON.stringify({ A: pass(A), B: pass(B, true), C: pass(C, true) }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
