#!/usr/bin/env node
// test/browser/daw-transport.test.js — /daw actually PLAYS, over THE GRID.
//
// "The button toggled" is not the contract. This gate taps the real audio graph
// (the live engine's own analyser, handle.rms) and requires non-silence, then
// holds the three things that make it a WORKSTATION transport:
//
//   A it sounds            RMS above a floor on the live AudioContext
//   B the playhead runs    .dw-ghead advances over the grid (transform, piecewise
//                          beat → column), and the cell canvases DO NOT repaint
//                          to move it — the head is a separate element BY LAW
//   C edits land LIVE      a drum pad edit mid-playback does not stop the music
//                          — exploreLive re-reads getState() every chord bar
//   D a new song STOPS     changing the seed is a new song, not a glide; the
//                          transport stops cleanly
//
// Chromium needs --autoplay-policy=no-user-gesture-required, which the harness's
// launch flags already provide for the app's own live gates.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

const headX = (page) => page.evaluate(() => {
  const h = document.querySelector(".dw-ghead");
  const m = /translateX\(([\d.]+)px\)/.exec(h ? h.style.transform : "");
  return m ? +m[1] : null;
});

async function main() {
  const srv = await serve(ROOT, 8974);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=techno&seed=3`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });

  // press PLAY like a user — the AudioContext unlock rides the real gesture
  await page.click("#dwPlay");
  const started = await page.waitForFunction(
    () => window.__DAWTRANSPORT && window.__DAWTRANSPORT.isPlaying(), null, { timeout: 30000 }
  ).then(() => true).catch(() => false);
  if (!started) { fail("transport never reported playing"); }
  else ok("transport started from a real click");

  // ---- A IT SOUNDS ----
  const audio = await page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 40; i++) {                   // ~10s of sampling
      samples.push(window.__DAWTRANSPORT.rms());
      await new Promise((r) => setTimeout(r, 250));
    }
    const nums = samples.filter((v) => typeof v === "number");
    return { n: nums.length, nonzero: nums.filter((v) => v > 0.001).length,
             max: nums.length ? Math.max.apply(null, nums) : 0 };
  });
  if (!audio.n) fail("the transport exposed no RMS — cannot prove it makes sound");
  else if (audio.nonzero < 5) fail(`the graph is SILENT (${audio.nonzero}/${audio.n} nonzero, max ${audio.max})`);
  else ok(`audible: ${audio.nonzero}/${audio.n} RMS samples nonzero, peak ${audio.max.toFixed(3)}`);

  // and the beat clock must be advancing, not just the audio ringing out
  const bars = await page.evaluate(async () => {
    const t0 = window.__DAWTRANSPORT.beatNow();
    await new Promise((r) => setTimeout(r, 6000));
    return { t0, t1: window.__DAWTRANSPORT.beatNow() };
  });
  if (!(bars.t1 > bars.t0)) fail(`the beat clock did not advance (${bars.t0} -> ${bars.t1})`);
  else ok(`the beat clock advanced ${bars.t0.toFixed(1)} → ${bars.t1.toFixed(1)} beats`);

  // ---- B the playhead runs over the grid; the canvases hold still ----
  const preHash = await page.evaluate(() => ({
    drums: window.__DAW.grid.rowHash("drums"), melody: window.__DAW.grid.rowHash("melody") }));
  const a = await headX(page);
  await page.waitForTimeout(1200);
  const b = await headX(page);
  const postHash = await page.evaluate(() => ({
    drums: window.__DAW.grid.rowHash("drums"), melody: window.__DAW.grid.rowHash("melody") }));
  if (a == null || b == null) fail("no .dw-ghead playhead over the grid");
  else if (!(b > a)) fail(`the grid playhead did not advance (${a} -> ${b}) — it should GLIDE`);
  else ok(`the grid playhead glided ${a.toFixed(1)} → ${b.toFixed(1)}px`);
  const visible = await page.evaluate(() =>
    getComputedStyle(document.querySelector(".dw-ghead")).opacity);
  if (!(+visible > 0.5)) fail("the playhead line is invisible while playing");
  else ok("the playhead line is visible while playing");
  if (preHash.drums !== postHash.drums || preHash.melody !== postHash.melody)
    fail("cell canvases repainted during a still window — the head must not be a repaint");
  else ok("the cell canvases did NOT repaint while the head moved (byte-identical rows)");

  // ---- C an edit lands without stopping the music ----
  const live = await page.evaluate(async () => {
    const before = window.__DAWTRANSPORT.beatNow();
    window.__DAW.sheet.open("drums");
    await new Promise((r) => setTimeout(r, 300));
    const pads = window.__DAW.controls.pads();
    if (!pads.length) return { err: "no pads registered on the drums sheet" };
    const el = pads[0].el;
    el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await new Promise((r) => setTimeout(r, 2500));
    window.__DAW.sheet.close();
    return { before, after: window.__DAWTRANSPORT.beatNow(),
             stillPlaying: window.__DAWTRANSPORT.isPlaying(),
             kits: Object.keys(window.__DAW.SONG.patch.kits || {}) };
  });
  if (live.err) fail(live.err);
  else {
    if (!live.kits.length) fail("the pad keyboard edit wrote nothing");
    if (!live.stillPlaying) fail("editing a machine stopped the music — edits must land at the next bar");
    else if (!(live.after > live.before)) fail("the clock stalled after an edit");
    else ok(`edited the kit mid-playback and the music kept running (${live.kits.join(",")})`);
  }

  // ---- D changing the song stops cleanly ----
  await page.evaluate(() => { document.getElementById("dwSeed").value = "99";
    document.getElementById("dwSeed").dispatchEvent(new Event("change", { bubbles: true })); });
  await page.waitForTimeout(700);
  const stopped = await page.evaluate(() => ({ playing: window.__DAWTRANSPORT.isPlaying(),
    label: document.getElementById("dwPlay").textContent.trim() }));
  if (stopped.playing) fail("a seed change left the old song playing — the DAW is not a glide");
  else ok(`changing the song stopped playback cleanly (button reads "${stopped.label}")`);

  const fatal = errs.filter((e) => !/AudioContext|autoplay|user gesture/i.test(e));
  if (fatal.length) fail("page errors: " + fatal.join(" | "));
  else ok("no fatal page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-TRANSPORT: FAIL");
  else console.log(`\nDAW-TRANSPORT: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
