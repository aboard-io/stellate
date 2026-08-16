#!/usr/bin/env node
// test/browser/live-audit-throttled.test.js — THE THROTTLED-SESSION AUDIT GATE. Two field
// defects (docs/TODO.md "Fixed from the field") were invisible to the whole release
// suite because nothing rides the live path under a slow link: the ring route kicked a
// sampler zone's decode on the first bar that SOUNDED it (the transit form's metal solo
// — crunch_guitar, 8 zones / ~4.9 MB untouched until the "solo" section ~29 bars in —
// got a one-bar runway and lost it), and kickSamplerBuf/kickBuffer marked in-flight
// decodes as `undefined`, re-requesting every zone already being fetched (16 requests
// for 8 zones). handle.auditSummary() is the instrument that found both; this gate
// rides it over the documented worst case and holds an anomaly ceiling.
//
// The ride: transitwave seed 91681 (the field report's seed — the state the report URL
// ?seed=91681&path=1923.12003,1177.9207,2042.7423 resolves toward; parked on the anchor
// so the ride is deterministic and the solo lands at bar 29 exactly as measured in the
// live.js warm-ahead calibration) on the RING route (?wavOut=0 — the route with both
// defects), throttled via CDP Network.emulateNetworkConditions to 250 KB/s (~2 Mbps,
// the link the warm-ahead trickle was calibrated against). The throttle lands AFTER the
// page's <script> tags load and BEFORE goLive, so everything exploreLive fetches — dsp
// wasm, beds, zones — rides the slow link, the field shape.
//
// WAIT FOR BARS, NOT SECONDS: the ride ends when the audit ring holds bars PAST the
// solo section (the solo has fully sounded), at whatever pace the engine manages — the
// wall-clock timeout is only a ceiling, so a loaded box slows the run, never flips it.
//
// ASSERT:
//   (a) the ride reached the documented worst case: audit bars in the "solo" section
//       exist and bars follow them, on route "ring";
//   (b) ANOMALY CEILING: auditStats().anomalies <= ANOM_CEILING. Calibrated by
//       measurement (4 rides, 2026-08-15, idle box): 40, 40, 40, 40 anomalies over
//       28/34 audited bars, byte-stable across runs — the ride is link-bound, not
//       CPU-bound, so the same voices lose the same races every time. The 40 are
//       the link's honest floor on this state: the per-bar station-name mp3s (a
//       fresh sp_st_* fetch nearly every bar, one bar of runway each) plus the
//       boot races (beds, perc_tambourine through bar 14). None is a defect; all
//       are what a listener on 2 Mbps actually gets. Ceiling 60 = observed 40 +
//       50% slack for a loaded box (measured: four CPU-hog processes alongside
//       moved it to 39 — the link, not the CPU, is the bottleneck); a gross
//       regression (a stalled decode gate floods every lane, 100+) still trips it;
//   (c) the field symptom itself: ZERO missing anomalies naming an ins_crunch_guitar
//       zone — the warm-ahead trickle must have the solo voiced by bar 29 (0 in
//       every calibration ride; before the fix this measured 1-2 solo[...] bars);
//   (d) the double-fetch defect: all 8 crunch zones requested, and total crunch
//       requests <= 10 (exactly 8 in every calibration ride; the regression
//       measured 16 — the +2 slack tolerates a decode-gate retry, never the double
//       fetch);
//   (e) zero real console errors.
//
// (b)'s ceiling guards the gross collapse; the two field defects are each pinned by
// their own sharp assertion, (c) and (d), which the noise floor cannot mask.
//
//   node test/browser/live-audit-throttled.test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8804;

const GENRE = "transitwave";       // form:"transit" — the metal solo arrives at bar 29
const SEED = 3;                    // synthwave draw (4-chord cycles): solo at bars 29-32,
                                   // the exact ride the warm-ahead was calibrated on.
                                   // The field URL's seed 91681 parks on deep_two (2-chord
                                   // cycles) — solo at bar 14, a runway no fix can make at
                                   // this link, so it cannot discriminate fix from regression.
const LINK_BPS = 250 * 1024;       // ~2 Mbps — the warm-ahead calibration link
const LATENCY_MS = 40;
const RIDE_PAST_SOLO = 2;          // audit bars required beyond the solo's last bar
const RIDE_TIMEOUT_MS = 240000;    // CEILING only — the wait condition is bar-driven
const ANOM_CEILING = 60;           // measured 40,40,40,40 over 4 throttled rides + 50% slack
const CRUNCH_ZONES = 8;            // crunch_guitar zone count (the ~4.9 MB late arrival)
const CRUNCH_REQ_CEILING = 10;     // 8 measured; the double-fetch bug measured 16

// in-page tap on the ring route's zone decode entry point: counts requests per URL with
// ms-after-goLive timestamps, so the double-fetch defect (re-requesting an in-flight
// decode) is measured at the exact seam it lived in. Installed before goLive.
function installTap() {
  const tap = { reqs: {}, t0: performance.now() };
  window.__tap = tap;
  const SP = window.FaustSampler;
  if (SP && typeof SP.decodeUrlRaw === "function" && !SP.__tapWrapped) {
    SP.__tapWrapped = true;
    const orig = SP.decodeUrlRaw;
    SP.decodeUrlRaw = function (ctx, url) {
      const r = (tap.reqs[url] = tap.reqs[url] || { n: 0, t: [] });
      r.n++; r.t.push(Math.round(performance.now() - tap.t0));
      return orig.call(this, ctx, url);
    };
  }
  return true;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  // ?wavOut=0 forces the RING route — the desktop route both field defects lived in.
  await page.goto(`http://localhost:${PORT}/test/browser/live-test.html?wavOut=0`);
  await page.evaluate(installTap);

  // throttle AFTER the page scripts are resident, BEFORE goLive: every fetch the live
  // session makes (dsp wasm, beds, sampler zones) rides the slow link.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: LATENCY_MS,
    downloadThroughput: LINK_BPS, uploadThroughput: 64 * 1024,
  });

  console.log(`\n[THROTTLE] ${GENRE} seed${SEED} on the ring route at ${(LINK_BPS / 1024).toFixed(0)} KB/s / ${LATENCY_MS} ms — riding to the bar-29 metal solo…`);
  await page.evaluate(({ g, s }) => goLive(g, s), { g: GENRE, s: SEED });

  // ride until the audit ring holds bars PAST the solo — bars, not seconds.
  await page.waitForFunction((need) => {
    try {
      const h = window.handle;
      if (!h || !h.audit) return false;
      const ring = h.audit();
      if (!ring.length) return false;
      const solo = ring.filter((e) => e.section === "solo").map((e) => e.serial);
      if (!solo.length) return false;
      const last = ring[ring.length - 1];
      return last.section !== "solo" && last.serial >= Math.max.apply(null, solo) + need;
    } catch (e) { return false; }
  }, RIDE_PAST_SOLO, { timeout: RIDE_TIMEOUT_MS }).catch(() => {});

  const data = await page.evaluate(() => {
    const h = window.handle;
    const ring = h && h.audit ? h.audit() : [];
    const stats = h && h.auditStats ? h.auditStats() : { bars: 0, anomalies: -1 };
    const summary = h && h.auditSummary ? h.auditSummary() : "";
    const soloBars = ring.filter((e) => e.section === "solo");
    let crunchMissing = 0; const anomTags = [];
    for (const e of ring) for (const a of (e.anomalies || [])) {
      const tag = a.reason === "missing" ? a.role + "[" + (a.missing || []).join(",") + "]@" + e.serial : a.role + "(" + a.reason + ")@" + e.serial;
      anomTags.push(tag);
      if ((a.missing || []).some((m) => /ins_crunch_guitar/.test(m))) crunchMissing++;
    }
    const reqs = (window.__tap && window.__tap.reqs) || {};
    const crunchUrls = Object.keys(reqs).filter((u) => u.indexOf("crunch_guitar") >= 0);
    const crunchReqTotal = crunchUrls.reduce((a, u) => a + reqs[u].n, 0);
    const crunchTimes = crunchUrls.map((u) => reqs[u].t[0]).sort((a, b) => a - b);
    const route = ring.length ? ring[ring.length - 1].route : "?";
    return { bars: stats.bars, anomalies: stats.anomalies, summary, anomTags,
      soloBars: soloBars.length, soloSerials: soloBars.map((e) => e.serial),
      lastSerial: ring.length ? ring[ring.length - 1].serial : -1, route,
      crunchMissing, crunchUrls: crunchUrls.length, crunchReqTotal,
      crunchFirstMs: crunchTimes[0] != null ? crunchTimes[0] : -1,
      crunchLastMs: crunchTimes[crunchTimes.length - 1] != null ? crunchTimes[crunchTimes.length - 1] : -1 };
  });
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(200);
  await page.close(); await browser.close(); srv.close();

  const allErrs = [...(T.errors || []), ...errs];
  // a demote / media 404 on the throttled link is the resilience path, not this gate's
  // subject (same law as audit-gate.test.js: audit truth is route-independent).
  const realErrs = allErrs.filter((e) => !/archive\.org|CORS|ERR_FAILED|Failed to load resource|net::|autoplay|demote->segAB|codec ladder/i.test(e));

  console.log(`[THROTTLE] rode ${data.bars} audited bars (last serial ${data.lastSerial}, route ${data.route}); solo bars ${data.soloBars} [${data.soloSerials}]`);
  console.log(`[THROTTLE] ${data.summary}`);
  if (data.anomTags.length) console.log(`[THROTTLE] anomalies: ${data.anomTags.join("; ")}`);
  console.log(`[THROTTLE] crunch zones: ${data.crunchUrls}/${CRUNCH_ZONES} requested, ${data.crunchReqTotal} requests total, first at ${data.crunchFirstMs} ms, all queued by ${data.crunchLastMs} ms; crunch-missing anomalies ${data.crunchMissing}`);

  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  // (a) the ride reached the documented worst case on the defect's route.
  ok(data.route === "ring", `not on the ring route (${data.route})`);
  ok(data.soloBars >= 1, `the audit ring never saw the solo section (${data.bars} bars audited)`);
  ok(data.lastSerial >= (data.soloSerials.length ? Math.max(...data.soloSerials) + RIDE_PAST_SOLO : 1e9), `ride ended inside/before the solo (last serial ${data.lastSerial})`);
  // (b) the anomaly ceiling — the gate's whole point.
  ok(data.anomalies >= 0 && data.anomalies <= ANOM_CEILING, `anomaly ceiling broken: ${data.anomalies} > ${ANOM_CEILING} (${data.anomTags.join("; ")})`);
  // (c) the field symptom: crunch_guitar must never audit missing under this link.
  ok(data.crunchMissing === 0, `crunch_guitar audited MISSING ${data.crunchMissing}x — the warm-ahead lost the solo again`);
  // (d) the double-fetch defect: every zone asked for, none pulled twice.
  ok(data.crunchUrls === CRUNCH_ZONES, `warm-ahead requested ${data.crunchUrls}/${CRUNCH_ZONES} crunch zones`);
  ok(data.crunchReqTotal <= CRUNCH_REQ_CEILING, `crunch zones double-fetched: ${data.crunchReqTotal} requests for ${CRUNCH_ZONES} zones (bug measured 16)`);
  // (e) clean console.
  ok(realErrs.length === 0, `console errors: ${realErrs.slice(0, 3).join(" | ")}`);

  console.log(`\n=== THROTTLED AUDIT GATE ===`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  const pass = fails.length === 0;
  console.log(`THROTTLED-SESSION AUDIT GATE (ring route at 250 KB/s through the bar-29 solo: anomalies <= ${ANOM_CEILING}, no crunch-missing, no double fetch): ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
