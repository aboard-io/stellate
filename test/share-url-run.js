#!/usr/bin/env node
// test/share-url-run.js — THE BOOKMARKABLE-MIX GATE (Paul 2026-07-10: seed +
// node positions + the current measure ride the query string; loading such a
// URL drops in at that measure; the playhead is draggable along the path).
// Asserts:
//   (a) a URL with seed/path/pace/m RESTORES: seed set, waypoints match, the
//       default loop is NOT seeded over them, travel sits at the m measure;
//   (b) play DROPS IN: the first onBar's serial == m-1 (the walk fast-forwarded)
//       and audio is real;
//   (c) the address bar UPDATES per bar (m advances) and __X.shareUrl() round-trips;
//   (d) the PLAYHEAD DRAG applies: a synthetic pointer grab on the traveler,
//       dragged toward waypoint 2, moves S.travel off its start and re-places
//       startBar while stopped;
//   (e) zero page errors; macros are GONE from the ⚙ panel (the removal held).
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node test/share-url-run.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = 8957;
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  // (a) restore: 3 waypoints, seed 42, pace 64, measure 97
  const PATH = "1691.4502,1826.3140,1101.20620";
  await page.goto(`http://localhost:${PORT}/index.html?seed=42&path=${PATH}&pace=64&m=97`);
  await page.waitForFunction(() => window.__X && window.__S, { timeout: 20000 });
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({
    seed: __S.seed, pace: __S.pace, wps: __S.waypoints.map((w) => Math.round(w.x) + "." + Math.round(w.y)).join(","),
    travel: __S.travel, startBar: __S.startBar, share: __X.shareUrl(),
  }));
  if (st.seed === 42) ok("seed restored"); else fail(`seed ${st.seed}`);
  if (st.wps === PATH) ok("waypoints restored verbatim (default loop skipped)"); else fail(`waypoints ${st.wps}`);
  if (st.startBar === 96) ok("startBar = m-1"); else fail(`startBar ${st.startBar}`);
  // CONSTANT PACE (2026-07-11): bar 96 = distance 96×(500/64)=750 units along the
  // perimeter; leg 0 (len ~1369) contains it, so seg 0, t ~0.548 (was seg 1, t 0.5
  // under the old fixed-bars-per-leg model — distance between nodes no longer
  // changes the traveler's speed, so the measure maps by arc-length now).
  if (st.travel.seg === 0 && Math.abs(st.travel.t - 0.548) < 0.006) ok(`travel at measure 97 (seg ${st.travel.seg}, t ${st.travel.t.toFixed(3)})`);
  else fail(`travel ${JSON.stringify(st.travel)}`);
  if (/seed=42/.test(st.share) && /m=97/.test(st.share) && st.share.includes("path=")) ok("shareUrl round-trips");
  else fail(`shareUrl ${st.share}`);

  // (b) drop-in: first bar's serial continues from m-1
  await page.evaluate(() => { window.__X.goLive(); });
  await page.waitForFunction(() => window.__S.barInfo && window.__S.live, {}, { timeout: 25000 });
  const first = await page.evaluate(() => window.__S.barInfo.serial);
  if (first >= 96 && first < 100) ok(`walk dropped in at serial ${first} (asked 96)`);
  else fail(`walk serial ${first}, wanted ~96`);
  await page.waitForFunction(() => { try { return window.__X.handle() && window.__X.handle().rms() > 0.0008; } catch (e) { return false; } }, {}, { timeout: 25000 });
  ok("real audio at the drop-in measure");

  // (c) the address bar advances with the measure
  const m0 = await page.evaluate(() => +new URLSearchParams(location.search).get("m"));
  await page.waitForFunction((m) => +new URLSearchParams(location.search).get("m") > m, m0, { timeout: 30000 });
  ok(`URL measure advances (${m0} -> live)`);
  await page.evaluate(() => window.__X.stopLive());
  await page.waitForTimeout(300);

  // (d) playhead drag while stopped: pointer down on the traveler, slide 80px
  const drag = await page.evaluate(async () => {
    const svg = document.getElementById("map");
    const r = svg.getBoundingClientRect();
    // traveler screen pos is published for the pulse: use the cursor's logical pos through the same transform drawMap used
    const Z = window.__X; // zoom helpers not exported; reconstruct from map: cursor is at S.cursor
    const cur = __S.cursor;
    // recompute screen coords exactly like drawMap/toXY do
    const zk = 1; // after boot centerView, ZOOM.k>=1; we read the drawn circle instead:
    const dot = [...svg.querySelectorAll("circle.cur")].pop();  // the traveler core
    if (!dot) return { err: "no traveler dot" };
    const cx = +dot.getAttribute("cx"), cy = +dot.getAttribute("cy");
    const before = { seg: __S.travel.seg, t: __S.travel.t, sb: __S.startBar };
    const fire = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x, clientY: r.top + y, pointerId: 7, button: 0, isPrimary: true }));
    fire("pointerdown", cx, cy);
    for (let i = 1; i <= 8; i++) fire("pointermove", cx + i * 10, cy);
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }));
    await new Promise((res) => setTimeout(res, 200));
    return { before, after: { seg: __S.travel.seg, t: __S.travel.t, sb: __S.startBar } };
  });
  if (drag.err) fail("playhead drag: " + drag.err);
  else if (drag.after.t !== drag.before.t || drag.after.seg !== drag.before.seg) ok(`playhead dragged (t ${drag.before.t.toFixed(3)} -> ${drag.after.t.toFixed(3)}, startBar ${drag.after.sb})`);
  else fail(`playhead drag did not move travel: ${JSON.stringify(drag)}`);

  // (d2) transport law: stop remembers the measure; STOP TWICE rewinds to the top
  const tr = await page.evaluate(() => {
    const afterStop = { sb: __S.startBar, seg: __S.travel.seg };      // stopLive already ran above
    window.__X.stopLive();                                            // second stop while stopped = rewind
    return { afterStop, afterDouble: { sb: __S.startBar, seg: __S.travel.seg, t: __S.travel.t, m: new URLSearchParams(location.search).get("m") } };
  });
  if (tr.afterStop.sb > 0) ok(`stop remembers the measure (startBar ${tr.afterStop.sb})`);
  else fail(`stop lost the measure: ${JSON.stringify(tr.afterStop)}`);
  if (tr.afterDouble.sb === 0 && tr.afterDouble.seg === 0 && tr.afterDouble.t === 0 && tr.afterDouble.m == null)
    ok("stop twice rewinds to the top (startBar 0, travel 0/0, URL m dropped)");
  else fail(`double-stop did not rewind: ${JSON.stringify(tr.afterDouble)}`);

  // (e) macros gone + no errors
  const macroCount = await page.evaluate(() => document.querySelectorAll("#panel .mac, #panel .mrow").length);
  if (macroCount === 0) ok("macros gone from the panel"); else fail(`${macroCount} macro rows still render`);
  if (errs.length === 0) ok("zero page errors"); else fail(`page errors: ${JSON.stringify(errs.slice(0, 4))}`);

  await browser.close(); srv.close();
  console.log(process.exitCode ? "\nSHARE-URL: FAILED" : `\nSHARE-URL: PASS (${checks} checks)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
