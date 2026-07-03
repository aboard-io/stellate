#!/usr/bin/env node
// faust/insert-test-run.js — headless live gate for per-voice INSERT chains.
//
//   INSERT_STATE_DIR=<dir with st-*.json> node faust/insert-test-run.js
//
// Two passes over faust/insert-test.html in headless chromium:
//   1. LOAD pass — full-band state (drums on) with phaser-pad + distort-bass
//      + filtersweep-lead: 30s live, glide at ~10s, type swap at ~18s.
//      Asserts: nonzero RMS, steady load >= 0.97, zero errors.
//   2. CLICK pass — same inserts, drums OFF (transient-free content): the
//      analyser click scan (max per-sample delta, overlapping 2048-sample
//      windows every 25ms) must show no outlier after the glide/swap marks
//      beyond 1.3x the steady-state max + 0.02.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STATES = process.env.INSERT_STATE_DIR;
const PORT = 8792;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".wasm": "application/wasm", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg" };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      if (req.url === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      const u = decodeURIComponent(req.url.split("?")[0]);
      const base = u.startsWith("/scratch/") ? STATES : ROOT;
      const rel = u.startsWith("/scratch/") ? u.slice(9) : u;
      const p = path.normalize(path.join(base, rel));
      if (!p.startsWith(base) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        console.log("  [404]", req.url); rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream",
        "Access-Control-Allow-Origin": "*" });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(PORT, () => res(srv));
  });
}

async function runPass(browser, stateUrl, label) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });
  await page.goto(`http://localhost:${PORT}/faust/insert-test.html`);
  console.log(`\n[${label}] going live on ${stateUrl}…`);
  await page.evaluate((u) => goLive(u), stateUrl);
  await page.waitForTimeout(10000);
  await page.evaluate(() => glideParams());
  await page.waitForTimeout(8000);
  await page.evaluate(() => swapTypes());
  await page.waitForTimeout(12000);
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(400);
  await page.close();
  T.pageErrors = pageErrors;
  return T;
}

function analyze(T, label) {
  const errs = [...T.errors, ...T.pageErrors];
  const rmsNZ = T.rms.filter((v) => v > 0.001).length;
  const lr = T.loads.map((l) => l.r);
  const t0 = T.loads.length ? T.loads[0].t : 0;
  const steady = T.loads.filter((l) => l.t - t0 > 5);
  const loadMin = steady.length ? Math.min(...steady.map((l) => l.r)) : NaN;
  // click analysis relative to the glide/swap marks. A param glide/type swap
  // legitimately CHANGES the spectrum (heavier distortion = steeper slopes),
  // so a raised plateau after the transition is fine — a CLICK is a brief
  // outlier in the transition window that exceeds BOTH the pre plateau and
  // the settled post plateau (x1.3 + 0.02), or any near-full-scale step.
  const d0 = T.deltas.length ? T.deltas[0].t : 0;
  const end = T.deltas.length ? T.deltas[T.deltas.length - 1].t : 0;
  const win = (a, b) => T.deltas.filter((x) => x.t >= a && x.t < b).map((x) => x.d);
  const mx = (a) => (a.length ? Math.max(...a) : 0);
  const g = T.marks.glide || d0 + 10, s = T.marks.swap || g + 8;
  const baseMax = mx(win(d0 + 3, g));
  const glideMax = mx(win(g, g + 4));
  const glideSettled = mx(win(g + 4, s));
  const swapMax = mx(win(s, s + 4));
  const swapSettled = mx(win(s + 4, end));
  const glideLimit = Math.max(baseMax, glideSettled) * 1.3 + 0.02;
  const swapLimit = Math.max(glideSettled, swapSettled) * 1.3 + 0.02;
  // absolute cap only bites on transient-free content (drum hits legitimately
  // exceed 0.5 sample-to-sample; the click pass runs drums-off)
  const cap = Math.max(0.5, baseMax * 1.15);
  const glideOk = glideMax <= glideLimit && glideMax < cap;
  const swapOk = swapMax <= swapLimit && swapMax < cap;
  console.log(`[${label}] bars ${T.bars.length}, RMS nonzero ${rmsNZ}/${T.rms.length}, ` +
    `load min(steady) ${isFinite(loadMin) ? loadMin.toFixed(3) : "n/a"}, errors ${errs.length}` +
    (errs.length ? "\n  " + errs.slice(0, 6).join("\n  ") : ""));
  console.log(`[${label}] load trace: ` + T.loads.map((l) => `${(l.t - t0).toFixed(0)}:${l.r.toFixed(2)}${l.e ? "e" + l.e : ""}`).join(" "));
  console.log(`[${label}] max|Δsample| — pre ${baseMax.toFixed(3)} | glide ${glideMax.toFixed(3)} ` +
    `(settled ${glideSettled.toFixed(3)}, limit ${glideLimit.toFixed(3)}, ${glideOk ? "ok" : "CLICK"}) | ` +
    `swap ${swapMax.toFixed(3)} (settled ${swapSettled.toFixed(3)}, limit ${swapLimit.toFixed(3)}, ${swapOk ? "ok" : "CLICK"})`);
  return { errs: errs.length, rmsNZ, loadMin, glideOk, swapOk, bars: T.bars.length };
}

async function main() {
  if (!STATES) throw new Error("set INSERT_STATE_DIR to the dir holding st-combo-ins.json / st-noclick-ins.json");
  const { chromium } = require("playwright");
  const srv = await serve();
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  if (!fs.existsSync(exe)) throw new Error("chromium-1217 not found at " + exe);
  const browser = await chromium.launch({ headless: true, executablePath: exe,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"] });

  const load = analyze(await runPass(browser, "/scratch/st-combo-ins.json", "load"), "load");
  const click = analyze(await runPass(browser, "/scratch/st-noclick-ins.json", "click"), "click");

  await browser.close();
  srv.close();

  const pass =
    load.errs === 0 && load.rmsNZ > 10 && load.loadMin >= 0.97 && load.bars >= 6 &&
    click.errs === 0 && click.rmsNZ > 10 && click.glideOk && click.swapOk;
  console.log(pass ? "\nINSERT LIVE GATE: PASS" : "\nINSERT LIVE GATE: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
