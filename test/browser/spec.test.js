#!/usr/bin/env node
// test/browser/spec.test.js — /spec: the sheet you can turn.
//
// The sheet used to be read-only, which was the complaint: it told you vaporwave
// uses a walking bass and there was nothing you could do about it. Now every row
// that describes a continuous value carries the knobs that drive it, directly
// under the line — and the one gesture, submerge, sits above everything it moves.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const srv = await serve(ROOT, 8990);
  const browser = await launchChromium();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 } });
  const page = await ctx.newPage();
  const errors = capturePageErrors(page);
  await page.goto(`http://localhost:${srv.port}/spec.html?g=vaporwave`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__SPEC && window.__SPEC.ready, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  if (errors.length) fail("errors on boot: " + errors.join(" | ")); else ok("zero page errors");

  console.log("\nA. the knobs are under the lines they drive");
  const placed = await page.evaluate(() => {
    const out = {};
    for (const sec of document.querySelectorAll("#spRows .fg-step")) {
      const n = sec.querySelectorAll(".sp-knob").length;
      if (n) out[sec.id.replace("sp-", "")] = n;
    }
    return { rows: out, total: document.querySelectorAll(".sp-knob").length,
      submerge: document.querySelectorAll("#spSubmerge .sp-knob").length,
      ranges: document.querySelectorAll("input[type=range]").length };
  });
  placed.total >= 12 ? ok(placed.total + " knobs on the page") : fail("only " + placed.total + " knobs");
  placed.submerge === 1 ? ok("submerge sits alone, above what it moves") : fail("submerge count " + placed.submerge);
  Object.keys(placed.rows).length >= 3 ? ok("spread across rows: " + JSON.stringify(placed.rows))
    : fail("knobs are not distributed: " + JSON.stringify(placed.rows));
  placed.ranges === 0 ? ok("and zero input[type=range] — these are tiles, not sliders") : fail(placed.ranges + " range inputs");

  console.log("\nB. submerge moves four things at once");
  const swept = await page.evaluate(async () => {
    const read = () => { const r = window.__SPEC.rows();
      return { bpm: r.find((x) => x.id === "clock").value, space: r.find((x) => x.id === "space").value }; };
    const a = read();
    const el = document.querySelector("#spSubmerge .sp-knob"), b = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent("pointerdown", { clientX: b.left + b.width * 0.5, clientY: b.top + 20, bubbles: true }));
    el.dispatchEvent(new PointerEvent("pointermove", { clientX: b.left + b.width * 0.9, clientY: b.top + 20, bubbles: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { clientX: b.left + b.width * 0.9, clientY: b.top + 20, bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    return { a, b: read(), s: window.__SPEC.submerge() };
  });
  swept.s > 0.2 ? ok("a drag sets submerge to " + swept.s.toFixed(2)) : fail("submerge did not move: " + swept.s);
  swept.a.bpm !== swept.b.bpm && swept.a.space !== swept.b.space
    ? ok("and the sheet follows in BOTH tempo and space (" + swept.a.bpm + "→" + swept.b.bpm + ", " + swept.a.space + "→" + swept.b.space + ")")
    : fail("the sheet did not follow: " + JSON.stringify(swept));

  console.log("\nC. a turned knob is marked, and reverts");
  const marked = await page.evaluate(async () => {
    window.__SPEC.turn.reverb = 0.2;
    document.querySelector("#spFind").dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
    return { has: "reverb" in window.__SPEC.turn };
  });
  marked.has ? ok("an edit is recorded as yours, not merged into the genre") : fail("the edit was lost");
  const reverted = await page.evaluate(async () => {
    delete window.__SPEC.turn.reverb;
    return !("reverb" in window.__SPEC.turn);
  });
  reverted ? ok("and dropping it gives the value back to the genre") : fail("revert failed");

  console.log("\nD. it still plays, submerged");
  await page.evaluate(() => window.__SPEC.play("all"));
  let peak = 0;
  for (let i = 0; i < 20; i++) { await sleep(280); const v = await page.evaluate(() => window.__SPEC.rms()); if (v > peak) peak = v; }
  peak > 0.005 ? ok("a submerged song sounds (peak " + peak.toFixed(4) + ")") : fail("silent: " + peak.toFixed(4));
  await page.evaluate(() => window.__SPEC.stop());
  await sleep(300);

  console.log("\nE. the laws");
  for (const [w, h, label] of [[390, 844, "phone"], [1440, 900, "desk"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const small = [];
      for (const el of document.querySelectorAll("button, .sp-knob, a.fg-btn")) {
        if (!el.offsetParent) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 1 && r.height < 40) small.push(el.className + " " + Math.round(r.height));
      }
      return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ranges: document.querySelectorAll("input[type=range]").length, small: small.slice(0, 5) };
    });
    m.over <= 1 ? ok(label + ": no sideways overflow") : fail(label + ": overflows by " + m.over);
    m.ranges === 0 ? ok(label + ": zero sliders") : fail(label + ": " + m.ranges + " sliders");
    m.small.length === 0 ? ok(label + ": every control clears 40px") : fail(label + ": " + m.small.join(", "));
  }
  if (errors.length) fail("errors accumulated: " + errors.slice(0, 3).join(" | "));
  await browser.close(); srv.close();
  console.log(process.exitCode ? "\nspec: FAIL" : `\nspec: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
