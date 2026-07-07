#!/usr/bin/env node
// clicktest-run.js — acceptance gate for the rebuilt engine. Loads explorer.html
// with the ?clicktest bed through the NEW ring-engine live.js, rides, and asserts
// the always-on Faust clickmon reports ZERO discontinuities (the bed is kickless,
// so any click is a real seam artifact), zero underruns, and continuous RMS.
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/clicktest-run.js [mode] [seconds]
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { launchChromium, capturePageErrors, MIME } = require("./probe-harness.js");
const ROOT = path.join(__dirname, "..");
const PORT = 8791;
const MODE = process.argv[2] || "1";
const SECONDS = +(process.argv[3] || 60);

function serve(root, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      p = path.join(root, p === "/" ? "explorer.html" : p);
      fs.readFile(p, (err, buf) => {
        if (err) { rsp.writeHead(404); return rsp.end("nf"); }
        rsp.writeHead(200, {
          "Content-Type": MIME[path.extname(p)] || "application/octet-stream",
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cross-Origin-Resource-Policy": "same-origin",
        });
        rsp.end(buf);
      });
    });
    srv.listen(port, () => res(srv));
  });
}

(async () => {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = [];
  page.on("console", (m) => { const t = m.text(); if (t.startsWith("🔊CLICK")) errs.push("CLICK-LOG: " + t.slice(0, 120)); });
  page.on("pageerror", (e) => errs.push("PAGEERR: " + e.message));
  page.on("requestfailed", (r) => { const u = r.url(); if (/archive\.org/.test(u)) errs.push("archive.org req: " + u.slice(0, 80)); });

  await page.goto(`http://localhost:${PORT}/explorer.html?clicktest=${MODE}`, { waitUntil: "domcontentloaded" });
  const isolated = await page.evaluate(() => crossOriginIsolated);
  await page.waitForFunction(() => window.__X && window.__S, { timeout: 15000 });
  await page.evaluate(() => __X.goLive());

  // sample the handle every second
  const samples = [];
  for (let i = 0; i < SECONDS; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const s = await page.evaluate(() => {
      const h = window.FaustLive && window.FaustLive.lastHandle;
      if (!h) return null;
      return {
        clicks: h.clickMon ? (h.clickMon() || {}).clicks : null,
        peak: h.clickMon ? (h.clickMon() || {}).peakjump : null,
        under: h.underruns ? h.underruns() : null,
        rms: h.rms ? h.rms() : null,
        cur: h.readCursor ? h.readCursor() : null,
      };
    });
    if (s) samples.push(s);
  }
  await browser.close(); srv.close();

  if (!samples.length) { console.log("FAIL: no handle samples"); process.exit(1); }
  const last = samples[samples.length - 1];
  const first = samples[0];
  const clicks = last.clicks;
  const under = last.under;
  const rmsMin = Math.min(...samples.map((s) => s.rms == null ? 1 : s.rms));
  const rmsCollapsed = samples.filter((s) => s.rms != null && s.rms < 1e-4).length;
  const curAdvanced = (last.cur || 0) - (first.cur || 0);

  console.log(`crossOriginIsolated=${isolated}`);
  console.log(`clicktest mode=${MODE}  rode ${SECONDS}s, ${samples.length} samples`);
  console.log(`  clickMon.clicks (total):  ${clicks}`);
  console.log(`  clickMon.peakjump (max):  ${last.peak}`);
  console.log(`  underruns:                ${under}`);
  console.log(`  rms min over ride:        ${rmsMin && rmsMin.toFixed ? rmsMin.toFixed(5) : rmsMin}  (collapsed samples: ${rmsCollapsed})`);
  console.log(`  read cursor advanced:     ${curAdvanced} samples (~${(curAdvanced / 44100).toFixed(1)}s)`);
  if (errs.length) console.log(`  console/page issues (${errs.length}):`, errs.slice(0, 8));

  const fails = [];
  if (!isolated) fails.push("not crossOriginIsolated");
  if (clicks == null) fails.push("clickMon unavailable");
  else if (clicks > 0) fails.push(`clickMon.clicks=${clicks} (expected 0 on kickless bed)`);
  if (under == null || under > 0) fails.push(`underruns=${under}`);
  if (rmsCollapsed > 2) fails.push(`RMS collapsed in ${rmsCollapsed} samples`);
  if (curAdvanced < SECONDS * 44100 * 0.9) fails.push(`cursor advanced too little (${curAdvanced})`);
  if (errs.filter((e) => e.startsWith("PAGEERR")).length) fails.push("page errors");

  console.log(`\n=== CLICKTEST GATE (mode ${MODE}) ===`);
  console.log(fails.length ? "FAIL: " + fails.join("; ") : "PASS");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
