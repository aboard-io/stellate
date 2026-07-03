#!/usr/bin/env node
// faust/live-test-run.js — headless live gate for the FaustLive facade.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/live-test-run.js
//
// Serves the repo root on a local port, drives faust/live-test.html in
// headless chromium (playwright, autoplay allowed): goes live on jungle for
// ~30s with a jungle->house state swap at 15s, then asserts:
//   - AnalyserNode RMS nonzero (music actually played)
//   - load ratio >= 0.97 (audio clock kept up with wall clock)
//   - zero engine/page errors across the swap (the glide is param-only)
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = 8791;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".wasm": "application/wasm", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg" };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      if (req.url === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split("?")[0])));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        console.log("  [404]", req.url); rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*" });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(PORT, () => res(srv));
  });
}

async function main() {
  const { chromium } = require("playwright");
  const srv = await serve();
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  if (!fs.existsSync(exe)) throw new Error("chromium-1217 not found at " + exe);
  const browser = await chromium.launch({
    headless: true,
    executablePath: exe,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"],
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });

  await page.goto(`http://localhost:${PORT}/faust/live-test.html`);
  console.log("page loaded; going live on jungle…");
  await page.evaluate(() => goLive("jungle", 3));
  await page.waitForTimeout(15000);
  const midRms = await page.evaluate(() => TEST.rms.slice(-6));
  console.log("15s in — swapping to house. recent RMS:", midRms.map(v => v.toFixed(3)).join(" "));
  await page.evaluate(() => swapTo("house", 3));
  await page.waitForTimeout(15000);
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(500);
  await browser.close();
  srv.close();

  const rmsNZ = T.rms.filter(v => v > 0.001).length, rmsMax = Math.max(...T.rms, 0);
  const rmsPost = T.rms.slice(Math.floor(T.rms.length / 2)).filter(v => v > 0.001).length;
  const lr = T.loads.map(l => l.r), loadLast = lr[lr.length - 1];
  const t0 = T.loads.length ? T.loads[0].t : 0;
  const steady = T.loads.filter(l => l.t - t0 > 5);
  const loadMin = Math.min(...steady.map(l => l.r));
  console.log("load trace:", T.loads.map(l => `${(l.t - t0).toFixed(0)}:${l.r.toFixed(2)}`).join(" "));
  const sections = [...new Set(T.bars.map(b => b.section))];
  const errs = [...T.errors, ...pageErrors];

  console.log(`bars scheduled: ${T.bars.length} (sections: ${sections.join(", ")})`);
  console.log(`RMS samples: ${T.rms.length}, nonzero: ${rmsNZ}, max ${rmsMax.toFixed(3)}, nonzero after swap: ${rmsPost}`);
  console.log(`load ratio: min(steady, t>5s) ${isFinite(loadMin) ? loadMin.toFixed(3) : "n/a"}, last ${loadLast && loadLast.toFixed(3)}`);
  console.log(`errors: ${errs.length}${errs.length ? "\n  " + errs.slice(0, 8).join("\n  ") : ""}`);

  const pass = rmsNZ > 10 && rmsPost > 5 && loadMin >= 0.97 && errs.length === 0 && T.bars.length >= 8;
  console.log(pass ? "LIVE GATE: PASS" : "LIVE GATE: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
