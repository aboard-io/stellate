#!/usr/bin/env node
// faust/default-path-run.js — GATE for the initial-load GRAND TOUR (Paul's
// "much longer path with many shorter steps ... one genre to another over a
// single edge"). Drives explorer.html headless three times and asserts:
//   1. the boot tour exists: 10-16 waypoints, every leg <= TOUR_MAXLEG px, no
//      repeated stars (window.__TOUR reports names + per-leg lengths);
//   2. two fresh loads draw DIFFERENT tours (presentational variety);
//   3. waypoint delete (right-click) and drag mutate the tour like a normal
//      hand-drawn path in S.waypoints;
//   4. press ▶ and ride TWO leg boundaries with zero console/engine errors and
//      continuous (never-collapsing) RMS.
// Reuses journey-crash-run's bones for a SHORT 2-leg ride, not the 5-min run.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/default-path-run.js
"use strict";
const path = require("path");
const fs = require("fs");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8798;
const SHOT = path.join(ROOT, "scratch", "default-path.png");   // scratch/ is gitignored

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// read the boot tour + assert its shape. returns {names, legs, maxleg, wp}.
async function readTour(page) {
  return page.evaluate(() => ({
    names: (window.__TOUR && window.__TOUR.names) || [],
    legs: (window.__TOUR && window.__TOUR.legs) || [],
    maxleg: window.__TOUR ? window.__TOUR.maxleg : -1,
    wp: __S.waypoints.map(w => ({ x: w.x, y: w.y })),
  }));
}
function checkShape(t, tag, fails) {
  const n = t.names.length;
  if (n < 10 || n > 16) fails.push(`${tag}: waypoint count ${n} not in [10,16]`);
  const uniq = new Set(t.names);
  if (uniq.size !== n) fails.push(`${tag}: repeated stars (${n} pts, ${uniq.size} unique)`);
  const overs = t.legs.filter(L => L > t.maxleg + 0.01);
  if (overs.length) fails.push(`${tag}: ${overs.length} legs exceed maxleg ${t.maxleg} (max=${Math.max(...t.legs).toFixed(1)})`);
  // waypoints must equal the named stars (a real, editable path in S.waypoints)
  if (t.wp.length !== n) fails.push(`${tag}: S.waypoints length ${t.wp.length} != names ${n}`);
  return { n, uniq: uniq.size, min: t.legs.length ? Math.min(...t.legs) : 0, max: t.legs.length ? Math.max(...t.legs) : 0,
    med: t.legs.length ? [...t.legs].sort((a, b) => a - b)[Math.floor(t.legs.length / 2)] : 0 };
}

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1100, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];

  // ---- LOAD A: assert shape + screenshot ----
  await page.goto(`http://localhost:${PORT}/explorer.html`);
  await page.waitForFunction(() => window.__X && window.__S && window.__TOUR);
  await page.waitForTimeout(400);
  const A = await readTour(page);
  const sa = checkShape(A, "loadA", fails);
  await page.screenshot({ path: SHOT });
  console.log(`\n=== LOAD A tour (${A.names.length}) ===\n  ${A.names.join(" → ")}`);
  console.log(`  legs px: [${A.legs.map(L => L.toFixed(0)).join(", ")}]  maxleg=${A.maxleg}`);
  console.log(`  count=${sa.n} unique=${sa.uniq} legMin/med/max=${sa.min.toFixed(1)}/${sa.med.toFixed(1)}/${sa.max.toFixed(1)}`);
  console.log(`  screenshot -> ${SHOT}`);

  // ---- LOAD B: must differ from A; then delete + drag on the stopped tour ----
  await page.reload();
  await page.waitForFunction(() => window.__X && window.__S && window.__TOUR);
  await page.waitForTimeout(400);
  const B = await readTour(page);
  const sb = checkShape(B, "loadB", fails);
  const same = A.names.join(">") === B.names.join(">");
  if (same) fails.push("variety: loadA and loadB drew the identical tour");
  console.log(`\n=== LOAD B tour (${B.names.length}) ===\n  ${B.names.join(" → ")}`);
  console.log(`  differsFromA=${!same}  count=${sb.n} unique=${sb.uniq} legMax=${sb.max.toFixed(1)}`);

  // DELETE: right-click a middle waypoint -> length-1, that star gone, rest kept.
  const before = await page.evaluate(() => __S.waypoints.length);
  const delI = 3;
  const delName = B.names[delI];
  const delPt = await page.evaluate((i) => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const w = __S.waypoints[i];
    return { x: r.left + (w.x * r.width / 500) * __ZOOM.k + __ZOOM.ox,
             y: r.top + (w.y * r.height / 400) * __ZOOM.k + __ZOOM.oy };
  }, delI);
  await page.mouse.click(delPt.x, delPt.y, { button: "right" });
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ len: __S.waypoints.length,
    names: __S.waypoints.map(w => { const P = __X.POS; for (const g in P) if (P[g][0] === w.x && P[g][1] === w.y) return g; return null; }) }));
  const deleteOK = after.len === before - 1 && !after.names.includes(delName);
  if (!deleteOK) fails.push(`delete: len ${before}->${after.len} (want ${before - 1}), still has ${delName}=${after.names.includes(delName)}`);
  console.log(`\n=== EDIT: delete waypoint #${delI + 1} (${delName}) ===`);
  console.log(`  len ${before} -> ${after.len}  removed=${!after.names.includes(delName)}  deleteOK=${deleteOK}`);

  // DRAG: pointer-drag waypoint #1 to a new spot -> S.waypoints[1] follows.
  const dragI = 1;
  const dragFrom = await page.evaluate((i) => {
    const svg = document.getElementById("map"), r = svg.getBoundingClientRect();
    const w = __S.waypoints[i];
    return { sx: r.left + (w.x * r.width / 500) * __ZOOM.k + __ZOOM.ox,
             sy: r.top + (w.y * r.height / 400) * __ZOOM.k + __ZOOM.oy,
             lx: w.x, ly: w.y };
  }, dragI);
  await page.mouse.move(dragFrom.sx, dragFrom.sy);
  await page.mouse.down();
  await page.mouse.move(dragFrom.sx + 40, dragFrom.sy + 30, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const dragTo = await page.evaluate((i) => ({ lx: __S.waypoints[i].x, ly: __S.waypoints[i].y }), dragI);
  const moved = Math.hypot(dragTo.lx - dragFrom.lx, dragTo.ly - dragFrom.ly);
  const dragOK = moved > 5;
  if (!dragOK) fails.push(`drag: waypoint #${dragI + 1} moved only ${moved.toFixed(1)} logical px`);
  console.log(`\n=== EDIT: drag waypoint #${dragI + 1} ===`);
  console.log(`  logical (${dragFrom.lx},${dragFrom.ly}) -> (${dragTo.lx.toFixed(0)},${dragTo.ly.toFixed(0)})  moved=${moved.toFixed(1)}px  dragOK=${dragOK}`);

  // ---- LOAD C: ride TWO leg boundaries live, RMS + errors ----
  await page.reload();
  await page.waitForFunction(() => window.__X && window.__S && window.__TOUR);
  await page.waitForTimeout(400);
  const C = await readTour(page);
  checkShape(C, "loadC", fails);
  const errsBeforeRide = errs.length;
  await page.evaluate(() => { __S.pace = 8; });
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => __S.barCount >= 1, { timeout: 30000 }).catch(() => {});
  console.log(`\n=== LOAD C ride (${C.names.length} stops, pace=8) ===`);

  // sample per BAR ADVANCE (journey-crash-run's proven pattern): the engine's
  // rms() reads ~0 during the sub-second worklet warmup, so measure continuity
  // only from the first sound onward, one row per bar, skipping 2 warmup bars.
  const bars = [], segsSeen = new Set();
  const deadline = Date.now() + 120000;   // 2 legs @ 8 bars, warmup included
  let lastSeg = -1, lastBar = -1, startBar = await page.evaluate(() => __S.barCount);
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const h = window.FaustLive && FaustLive.lastHandle;
      return { seg: __S.travel.seg, bar: __S.barCount, rms: h ? +h.rms().toFixed(5) : -1,
        errN: h ? h.errors.length : -1 };
    });
    segsSeen.add(s.seg);
    if (s.bar !== lastBar) { lastBar = s.bar; bars.push(s); }
    if (s.seg !== lastSeg) { lastSeg = s.seg; console.log(`  crossed into leg seg=${s.seg} at bar ${s.bar} rms=${s.rms}`); }
    if (segsSeen.has(1) && segsSeen.has(2) && s.bar >= startBar + 3) break;
    await page.waitForTimeout(400);
  }
  const finalErrs = await page.evaluate(() => { const h = window.FaustLive && FaustLive.lastHandle; return h ? h.errors.slice() : []; });
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(300);

  // RMS gate: once sound is up (skip 2 warmup bars), it must never collapse to
  // silence for the rest of the ride.
  const body = bars.filter(b => b.bar >= startBar + 2 && b.rms >= 0);
  const rmsMin = body.length ? Math.min(...body.map(b => b.rms)) : -1;
  let maxQuiet = 0, run = 0;
  for (const b of body) { if (b.rms < 0.0008) { run++; maxQuiet = Math.max(maxQuiet, run); } else run = 0; }
  const rodeTwoLegs = segsSeen.has(1) && segsSeen.has(2);
  // partition errors: archive.org found-sound streaming is blocked by CORS in
  // the sandbox (environmental, present on main for ANY headless ride) — the
  // tour's own code must add ZERO real errors.
  const isEnv = e => /archive\.org|CORS|ERR_FAILED|Failed to load resource|net::|found/i.test(e);
  const rideErrsAll = errs.slice(errsBeforeRide);
  const realErrs = rideErrsAll.filter(e => !isEnv(e));
  const envErrs = rideErrsAll.filter(isEnv);
  if (!rodeTwoLegs) fails.push(`ride: only reached segs [${[...segsSeen].join(",")}], need boundaries 0->1 and 1->2`);
  if (maxQuiet > 0) fails.push(`ride: RMS collapsed to silence for ${maxQuiet} consecutive bars (min=${rmsMin})`);
  if (realErrs.length !== 0) fails.push(`ride: ${realErrs.length} real console/page errors: ${realErrs.slice(0, 3).join(" | ")}`);
  if (finalErrs.length !== 0) fails.push(`ride: ${finalErrs.length} engine errors`);

  await browser.close(); srv.close();

  console.log(`\n=== RIDE GATE ===`);
  console.log(`  segsSeen=[${[...segsSeen].sort().join(",")}] rodeTwoLegs=${rodeTwoLegs}`);
  console.log(`  barsSampled=${body.length} bodyRmsMin=${rmsMin} maxConsecutiveQuietBars=${maxQuiet}`);
  console.log(`  realErrorsDuringRide=${realErrs.length} envFoundSoundErrors=${envErrs.length} engineErrors=${finalErrs.length}`);
  if (realErrs.length) console.log(`  REAL errors:\n   ${realErrs.slice(0, 20).join("\n   ")}`);
  if (envErrs.length) console.log(`  (env found-sound errors, ignored): ${envErrs.length}`);

  console.log(`\n=== GATE ===`);
  if (fails.length) { console.log("FAILURES:\n  - " + fails.join("\n  - ")); }
  const pass = fails.length === 0;
  console.log(`DEFAULT-PATH GATE: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
