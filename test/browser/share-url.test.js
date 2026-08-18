#!/usr/bin/env node
// test/browser/share-url.test.js — THE BOOKMARKABLE-MIX GATE: seed + node positions +
// the current measure ride the query string; loading such a URL drops in at
// that measure; the playhead is draggable along the path.
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
//   node test/browser/share-url.test.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8957;
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  // (a) restore: 3 waypoints, seed 42, pace 64, measure 97
  const PATH = "1691.4502,1826.3140,1101.20620";
  await page.goto(`http://localhost:${PORT}/screensaver.html?seed=42&path=${PATH}&pace=64&m=97`);
  await page.waitForFunction(() => window.__X && window.__S, { timeout: 20000 });
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({
    seed: __S.seed, pace: __S.pace, wps: __S.waypoints.map((w) => Math.round(w.x) + "." + Math.round(w.y)).join(","),
    travel: __S.travel, startBar: __S.startBar, share: __X.shareUrl(),
  }));
  if (st.seed === 42) ok("seed restored"); else fail(`seed ${st.seed}`);
  if (st.wps === PATH) ok("waypoints restored verbatim (default loop skipped)"); else fail(`waypoints ${st.wps}`);
  if (st.startBar === 96) ok("startBar = m-1"); else fail(`startBar ${st.startBar}`);
  // CONSTANT PACE: bar 96 = distance 96×(500/64)=750 units along the
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

  // (f) THE LIVE URL FOLLOWS THE PLAYHEAD. If buildShareUrl's live
  // branch reads the ENGINE's bar serial, copying the URL after a
  // mid-live playhead drag bookmarked a measure the user was no longer at (the
  // traveler had moved; the serial had not). It now reads barForTravel(S.travel)
  // — the same inverse stopLive uses — so the copied link, the visible playhead
  // and the resume measure are one answer. Drag while LIVE, then assert the URL's
  // m == the traveler's measure AND that it is NOT the stale serial+1.
  // drop in mid-leg first: at travel 0/0 the traveler sits ON waypoint 1 and the
  // waypoint wins the hit-test (it is authoritative), so the grab must start from
  // a spot where only the playhead lives.
  await page.evaluate(() => { window.__S.startBar = 300; window.__X.goLive(); });
  await page.waitForFunction(() => window.__S.barInfo && window.__S.live, {}, { timeout: 25000 });
  const livedrag = await page.evaluate(async () => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const dot = [...svg.querySelectorAll("circle.cur")].pop();
    if (!dot) return { err: "no traveler dot" };
    const cx = +dot.getAttribute("cx"), cy = +dot.getAttribute("cy");
    const fire = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: r.left + x, clientY: r.top + y, pointerId: 9, button: 0, isPrimary: true }));
    const before = { seg: __S.travel.seg, t: __S.travel.t, serial: __S.barInfo.serial };
    fire("pointerdown", cx, cy);
    for (let i = 1; i <= 20; i++) fire("pointermove", cx + i * 12, cy + i * 6);
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 9 }));
    await new Promise((res) => setTimeout(res, 200));
    // the traveler's measure, computed independently of share.js (arc length / pace)
    const wps = __S.waypoints, legs = wps.map((a, i) => { const b = wps[(i + 1) % wps.length]; return Math.hypot(b.x - a.x, b.y - a.y); });
    let d = 0; for (let i = 0; i < __S.travel.seg; i++) d += legs[i];
    d += __S.travel.t * legs[__S.travel.seg];
    const want = Math.max(0, Math.round(d / __X.paceSpeed())) + 1;
    return { before, after: { seg: __S.travel.seg, t: __S.travel.t, serial: __S.barInfo.serial },
      want, m: +new URLSearchParams(__X.shareUrl().split("?")[1]).get("m") };
  });
  if (livedrag.err) fail("live playhead drag: " + livedrag.err);
  else {
    const moved = livedrag.after.seg !== livedrag.before.seg || Math.abs(livedrag.after.t - livedrag.before.t) > 1e-6;
    const stale = livedrag.after.serial + 1;
    if (moved) ok(`live playhead dragged (seg ${livedrag.before.seg}/${livedrag.before.t.toFixed(3)} -> ${livedrag.after.seg}/${livedrag.after.t.toFixed(3)})`);
    else fail(`live playhead drag did not move travel: ${JSON.stringify(livedrag)}`);
    if (livedrag.m === livedrag.want) ok(`shared URL m=${livedrag.m} == the dragged playhead's measure`);
    else fail(`shared URL m=${livedrag.m}, playhead is at measure ${livedrag.want}`);
    if (Math.abs(stale - livedrag.want) >= 2) ok(`…and NOT the engine serial (the old formula would have said m=${stale})`);
    else fail(`drag too small to distinguish: serial says ${stale}, playhead says ${livedrag.want}`);
  }
  await page.evaluate(() => window.__X.stopLive());
  await page.waitForTimeout(200);

  // (e) macros gone + no errors
  const macroCount = await page.evaluate(() => document.querySelectorAll("#panel .mac, #panel .mrow").length);
  if (macroCount === 0) ok("macros gone from the panel"); else fail(`${macroCount} macro rows still render`);
  if (errs.length === 0) ok("zero page errors"); else fail(`page errors: ${JSON.stringify(errs.slice(0, 4))}`);

  await browser.close(); srv.close();
  console.log(process.exitCode ? "\nSHARE-URL: FAILED" : `\nSHARE-URL: PASS (${checks} checks)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
