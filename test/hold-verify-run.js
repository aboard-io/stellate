#!/usr/bin/env node
// hold-verify-run.js — verify the INSTRUMENT-INTRODUCTION HOLD: an instrument
// that gets introduced lasts for at least a few measures. We drive a
// FAST drag that alternates the dominant genre (blues <-> tango) every ~bar so
// the lead timbre wants to flip every bar; the hold must cap that to <= once per
// HOLD window (4 bars). Then we snap to PURE neoclassical (an ARRIVAL) and check
// the lead flips to felt_piano promptly despite the hold (arrival override).
//   node faust/hold-verify-run.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8795, HOLD = 4;

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S);
  await page.waitForTimeout(400);
  // start on a genuine blues<->tango blend (dominant well under the 0.85 arrival
  // threshold, so nothing here counts as an arrival)
  await page.evaluate(() => { __S.seed = 12345; __S.waypoints = []; __X.retarget({ x: 117, y: 315 }); });
  await page.evaluate(() => __X.goLive());
  await page.waitForFunction(() => __S.barCount >= 1, { timeout: 30000 }).catch(() => {});

  const snap = () => `(() => { const m = __S.playing.instruments.melody;
    return { bar: __S.barCount, lead: m.model + (m.sampler?":"+m.sampler.id:""),
      w0: (__S.weights[0]||{}).g, w0w: +(((__S.weights[0]||{}).w)||0).toFixed(2) }; })()`;
  const curBar = () => page.evaluate(() => __S.barCount);
  const trace = [];
  const rec = async (phase) => { const s = await page.evaluate(snap()); trace.push({ phase, ...s }); return s; };
  const waitBars = async (n) => { const b = await curBar();
    await page.waitForFunction(x => __S.barCount >= x, b + n, { timeout: 120000 }).catch(() => {}); };

  // PHASE 1: alternate the DOMINANT genre every 3 bars between a blues-leaning and
  // a tango-leaning blend point (neither pure -> no arrival override). Without the
  // hold the lead would chase every switch (flip every ~2 bars); the hold caps it.
  const BLUES_LEAN = { x: 122, y: 317 }, TANGO_LEAN = { x: 112, y: 313 };   // dominant ~0.69/0.75, both < 0.85 (no arrival)
  for (let round = 0; round < 6; round++) {
    await page.evaluate((p) => __X.retarget(p), round % 2 ? BLUES_LEAN : TANGO_LEAN);
    await rec(1);
    await waitBars(3);
    await rec(1);
  }
  const p1EndBar = await curBar();
  // PHASE 2: ARRIVAL — snap to PURE neoclassical; the lead must reach felt_piano
  // even though the lead voice is mid-hold (arrival overrides the hold). Give the
  // per-2-bar flip queue time to drain to the lead-voice flip.
  await page.evaluate(() => { const p = __X.POS.neoclassical; __X.retarget({ x: p[0], y: p[1] }); });
  for (let i = 0; i < 18; i++) {
    const s = await rec(2);
    if (/felt_piano/.test(s.lead)) break;
    await waitBars(1);
  }
  await page.evaluate(() => __X.stopLive()).catch(() => {});
  await page.waitForTimeout(300);
  await browser.close(); srv.close();

  // dedupe by bar (rec() is sampled twice per round), keeping the last sample
  const byBar = new Map();
  for (const t of trace) byBar.set(t.bar + ":" + t.phase, t);
  const uniq = [...byBar.values()].sort((a, b) => a.bar - b.bar || a.phase - b.phase);
  console.log("bar / phase / lead / dominant");
  for (const t of uniq) console.log(`  bar ${String(t.bar).padStart(3)} p${t.phase} ${t.lead.padEnd(28)} ${t.w0} ${t.w0w}`);

  // Phase-1 lead changes must be spaced >= HOLD (no arrivals in phase 1)
  const p1 = uniq.filter(t => t.phase === 1);
  const changeBars = [];
  for (let i = 1; i < p1.length; i++) if (p1[i].lead !== p1[i - 1].lead) changeBars.push(p1[i].bar);
  let minGap = Infinity;
  for (let i = 1; i < changeBars.length; i++) minGap = Math.min(minGap, changeBars[i] - changeBars[i - 1]);
  const gapOk = changeBars.length < 2 || minGap >= HOLD;
  // Arrival override: lead reached felt_piano in phase 2
  const p2 = uniq.filter(t => t.phase === 2);
  const arrivalOk = p2.some(t => /felt_piano/.test(t.lead));
  const arrivalBars = p2.length ? (p2[p2.length - 1].bar - p1EndBar) : -1;

  console.log(`\nphase1 lead changes at bars [${changeBars.join(",")}] minGap=${changeBars.length > 1 ? minGap : "-"} (need >= ${HOLD})`);
  console.log(`phase2 arrival -> felt_piano reached=${arrivalOk} within ${arrivalBars} bars of the snap`);
  console.log(`pageErrors=${errs.length}`);
  const pass = gapOk && arrivalOk && errs.length === 0;
  console.log(`HOLD RULE GATE: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
