#!/usr/bin/env node
// test/browser/daw-transport.test.js — /daw actually PLAYS.
//
// "The button toggled" is not the contract. This gate taps the real audio graph
// with an AnalyserNode and requires non-silence, then holds the two things that
// make it a WORKSTATION transport rather than a play button:
//
//   A it sounds            RMS above a floor on the live AudioContext
//   B the playhead runs    the head element advances while playing, and the roll
//                          canvases DO NOT repaint to move it (that is the whole
//                          reason the head is a separate element)
//   C edits land LIVE      changing a machine mid-playback does not stop the
//                          music — exploreLive re-reads the state each bar
//   D a new song STOPS     changing genre/seed is a new song, not a glide; the
//                          DAW must stop cleanly rather than pretend
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

async function main() {
  const srv = await serve(ROOT, 8974);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=techno&seed=3`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.rowCount() > 0, null, { timeout: 20000 });

  // press PLAY like a user — the AudioContext unlock rides the real gesture
  await page.click("#dwPlay");
  const started = await page.waitForFunction(
    () => window.__DAWTRANSPORT && window.__DAWTRANSPORT.isPlaying(), null, { timeout: 30000 }
  ).then(() => true).catch(() => false);
  if (!started) { fail("transport never reported playing"); }
  else ok("transport started from a real click");

  // ---- A IT SOUNDS ----
  // Sample the live engine's own analyser (faust/live/live.js handle.rms). A gate
  // that only checked "the button toggled" would pass happily over a silent graph,
  // which is exactly how this fails in practice.
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
  if (!(bars.t1 > bars.t0)) fail(`the beat clock did not advance (${bars.t0} -> ${bars.t1}) — nothing is playing`);
  else ok(`the beat clock advanced ${bars.t0.toFixed(1)} → ${bars.t1.toFixed(1)} beats`);

  // ---- B the playhead runs, and the canvases do NOT repaint for it ----
  const head = await page.evaluate(async () => {
    const h = document.querySelector(".dw-head");
    if (!h) return null;
    const canvasBefore = document.querySelector('.dw-row[data-track="drums"] canvas').toDataURL().slice(-48);
    const a = h.style.left;
    // The head now INTERPOLATES between bars, so a short window is enough — but
    // sample generously anyway: at a slow tempo a chord bar is several seconds,
    // and a gate that only ever straddles a bar boundary would pass on a head
    // that merely jumps (which is what it used to do).
    await new Promise((r) => setTimeout(r, 1200));
    const b = h.style.left;
    const canvasAfter = document.querySelector('.dw-row[data-track="drums"] canvas').toDataURL().slice(-48);
    return { a, b, mounted: document.querySelectorAll(".dw-head").length, repainted: canvasBefore !== canvasAfter };
  });
  if (!head) fail("no playhead element mounted");
  else {
    const pa = parseFloat(head.a), pb = parseFloat(head.b);
    if (!(pb > pa)) fail(`playhead did not advance (${head.a} -> ${head.b}) — it should GLIDE between bars, not jump`);
    else if (pb - pa > 8) fail(`playhead jumped ${(pb - pa).toFixed(2)}% in 1.2s — that is a bar-sized leap, not interpolation`);
    else ok(`playhead glided ${head.a} → ${head.b} across ${head.mounted} rolls`);
    if (head.repainted) fail("the roll canvas repainted just to move the playhead — that is the cost this design avoids");
    else ok("the rolls did NOT repaint while the playhead moved");
  }

  // ---- C an edit lands without stopping the music ----
  const live = await page.evaluate(async () => {
    const before = window.__DAWTRANSPORT.beatNow();
    const row = document.querySelector('.dw-row[data-track="drums"]');
    if (!row.classList.contains("dw-open")) row.querySelector(".dw-strip").click();
    await new Promise((r) => setTimeout(r, 300));
    const d = row.querySelector('.dw-opvec .dw-vdot[role="slider"]');
    if (!d) return { err: "no kit radar handle" };
    d.focus();
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await new Promise((r) => setTimeout(r, 2500));
    return { before, after: window.__DAWTRANSPORT.beatNow(),
             stillPlaying: window.__DAWTRANSPORT.isPlaying(),
             kits: Object.keys(window.__DAW.SONG.patch.kits || {}) };
  });
  if (live.err) fail(live.err);
  else {
    if (!live.stillPlaying) fail("editing a machine stopped the music — edits must land at the next bar");
    else if (!(live.after > live.before)) fail("the clock stalled after an edit");
    else ok(`edited a machine mid-playback and the music kept running (${live.kits.join(",")})`);
  }

  // ---- D changing the song stops cleanly ----
  await page.evaluate(() => { document.getElementById("dwSeed").value = "99"; document.getElementById("dwSeed").dispatchEvent(new Event("change", { bubbles: true })); });
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
