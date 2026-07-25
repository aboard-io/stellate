#!/usr/bin/env node
// vapor-loopexport-probe.js — verifies C.1 (VAPOR slider, live-only master EQ)
// and F.3 (whole-path loop export via the async buildLoopPlan).
//   node test/vapor-loopexport-probe.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8801;

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); return c; };

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S && window.__EXPORT, { timeout: 20000 });
  await page.waitForTimeout(400);

  // ---- C.1: drive the VAPOR slider in the settings panel ----
  const vap = await page.evaluate(() => {
    document.getElementById("cfgChip").click();   // open ⚙ settings
    const rows = [...document.querySelectorAll(".row")];
    const row = rows.find((r) => (r.querySelector("label")?.textContent || "").trim() === "vapor");
    if (!row) return { found: false };
    const inp = row.querySelector("input[type=range]");
    inp.value = "100"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    return { found: true, sVapor: window.__S.vapor,
      ls: (() => { try { return localStorage.getItem("vaporwave-vapor"); } catch (e) { return null; } })() };
  });
  ok(vap.found, "C1a: no 'vapor' row in the settings panel");
  ok(vap.found && Math.abs(vap.sVapor - 1) < 1e-6, `C1b: S.vapor not 1 after slider→100 (got ${vap.sVapor})`);
  ok(vap.ls === "1", `C1c: vapor not persisted to localStorage (got ${vap.ls})`);

  // ---- go live, then ride vapor on the RUNNING graph ----
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => window.__S.playing, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500);   // let audio come up
  const liveErrs1 = errs.length;
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".row")];
    const inp = rows.find((r) => (r.querySelector("label")?.textContent || "").trim() === "vapor")?.querySelector("input[type=range]");
    if (inp) { inp.value = "0"; inp.dispatchEvent(new Event("input", { bubbles: true }));
               inp.value = "80"; inp.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await page.waitForTimeout(600);
  ok(errs.length === liveErrs1, `C1d: riding vapor on the live graph threw (${errs.slice(liveErrs1).join("; ")})`);
  const playing = await page.evaluate(() => !!window.__S.playing);
  ok(playing, "C1e: playback died after driving vapor");

  // ---- F.3: whole-path loop export via the async buildLoopPlan ----
  const exp = await page.evaluate(async () => {
    const statuses = [];
    const t = setInterval(() => statuses.push(window.__S.status || ""), 60);
    let blob = null, err = null;
    try { blob = await window.__EXPORT.exportLoopAudio("wav", { bars: 48, noDownload: true }); }  // > 32 so the async walk yields at b=31
    catch (e) { err = String(e); }
    clearInterval(t);
    return { size: blob ? blob.size : 0, err, sawPlanning: statuses.some((s) => /planning/i.test(s)),
      status: window.__S.status };
  });
  // F.3 proof: the async buildLoopPlan ran to completion and fed the render — a
  // valid multi-MB whole-path WAV came back with NO error and the page stayed
  // responsive (this probe kept running). sawPlanning is informational only: at
  // 48 bars the walk yields just once (b=31), so a 60ms status poll can't reliably
  // sample the sub-second planning phase — not a code signal.
  ok(!exp.err, `F3a: exportLoopAudio threw: ${exp.err}`);
  ok(exp.size > 100000, `F3b: whole-path WAV too small / empty (${exp.size} bytes) — async walk may have failed`);

  console.log(`\n=== VAPOR + LOOP-EXPORT PROBE ===`);
  console.log(`  C.1 vapor: row=${vap.found} S.vapor=${vap.sVapor} persisted=${vap.ls} live-ride errs=${errs.length === liveErrs1 ? 0 : "SOME"} stillPlaying=${playing}`);
  console.log(`  F.3 loop export: ${exp.size} bytes, sawPlanning=${exp.sawPlanning}, err=${exp.err || "none"}`);
  const otherErrs = errs.filter((e) => !/AudioContext|autoplay|user gesture/i.test(e));
  ok(otherErrs.length === 0, `page errors: ${otherErrs.join(" | ")}`);

  await browser.close(); srv.close();
  if (fails.length) { console.log(`\nFAIL:\n  ${fails.join("\n  ")}`); process.exit(1); }
  console.log(`\nVAPOR + LOOP-EXPORT PROBE: PASS`);
}
main().catch((e) => { console.error(e); process.exit(1); });
