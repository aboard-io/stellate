#!/usr/bin/env node
// test/browser/bg-handoff.test.js — HEADLESS GATE for the BACKGROUND-WAV HANDOFF.
//
//   node test/browser/bg-handoff.test.js
//
// Verifies the WIRING of faust/live.js's iOS background-audio handoff (real iOS
// background playback can only be confirmed by a human on a device — this proves
// the state machine + the WAV blob, headlessly):
//   1. loads index.html?clicktest=1&wavOut=0 through the live RING engine under a
//      MOBILE user-agent (mobile UA arms `wantBg`; wavOut=0 keeps us on the ring
//      path, since WAV-FIRST otherwise routes every mobile UA to exploreLiveWav,
//      which has no background-WAV handoff to test), goLive;
//   2. waits for the rolling background-WAV producer to have a blob ready
//      (handle.__bgWavReady());
//   3. asserts the blob is a VALID WAV — RIFF/WAVE header + nonzero audio (so the
//      background loop is real music, not silence);
//   4. dispatches visibilitychange → HIDDEN and asserts the handoff: the <audio>
//      element has a blob: src and is PLAYING (not paused), and the live worklet is
//      muted at source (C_STATE=2);
//   5. dispatches visibilitychange → VISIBLE and asserts hand-back: the <audio> is
//      paused and the worklet is running again (C_STATE=1).
//
// Serves cross-origin-ISOLATED (COOP/COEP/CORP) like ring-test-run.js so
// SharedArrayBuffer is available; borrows launchChromium from probe-harness.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { launchChromium, MIME } = require("../lib/probe-harness.js");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8813;
// an iPhone UA so live.js's isMobile predicate is true → wantBg (background path) on.
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function coiServe(root, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      if (req.url === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      let rel = decodeURIComponent(req.url.split("?")[0]);
      if (rel === "/") rel = "/index.html";
      const p = path.normalize(path.join(root, rel));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end("nf"); }
      rsp.writeHead(200, {
        "Content-Type": MIME[path.extname(p)] || "application/octet-stream",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(p).pipe(rsp);
    });
    // same port-is-a-preference rule as probe-harness serve(): this gate carries its
    // own server, so it needs its own walk or it reintroduces the collision the shared
    // harness just fixed.
    let attempt = 0;
    srv.on("error", (e) => { if (e && e.code === "EADDRINUSE" && attempt < 40) { attempt++; setTimeout(() => srv.listen(port + attempt), 0); } });
    srv.on("listening", () => { srv.port = srv.address().port; res(srv); });
    srv.listen(port);
  });
}

(async () => {
  const srv = await coiServe(ROOT, PORT);
  PORT = srv.port;   // the server may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const context = await browser.newContext({ userAgent: IPHONE_UA });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERR: " + e.message));
  const fails = [];

  // …AND FORCE THE RING PATH (?wavOut=0). A mobile user-agent alone no longer
  // reaches the mechanism this gate exists for: WAV-FIRST (docs/WAV-FIRST.md) made
  // wavOutWanted() true for every mobile UA, so exploreLive returns exploreLiveWav
  // before the ring conductor's `wantBg` block is ever constructed, and the handle
  // it hands back has no __bgState/__bgWavReady — which is exactly the
  // `h.__bgState is not a function` this gate had been dying on. The rolling
  // background-WAV handoff is still LIVE code, just not on mobile: the ring path
  // arms it for `forceMediaEl || forceBgWav || isMobile || isSafari`, so desktop
  // Safari ships it. wavOut=0 is how you reach the ring path deliberately, and it
  // keeps the mobile UA so the isMobile arm of `wantBg` is the one under test.
  await page.goto(`http://localhost:${PORT}/index.html?clicktest=1&wavOut=0`, { waitUntil: "domcontentloaded" });

  const isolated = await page.evaluate(() => crossOriginIsolated);
  if (!isolated) fails.push("crossOriginIsolated=false — SharedArrayBuffer unavailable");
  console.log(`crossOriginIsolated=${isolated}`);

  await page.waitForFunction(() => window.__X && window.__S, { timeout: 15000 });
  await page.evaluate(() => __X.goLive());

  // ── install a controllable visibilityState so we can dispatch hidden/visible ──
  await page.evaluate(() => {
    window.__vis = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => window.__vis });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => window.__vis === "hidden" });
  });

  // ── wait for the rolling background WAV to be ready ──
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {   // up to ~40s
    await page.waitForTimeout(500);
    ready = await page.evaluate(() => {
      const h = window.FaustLive && window.FaustLive.lastHandle;
      return !!(h && h.__bgWavReady && h.__bgWavReady());
    });
  }
  const st0 = await page.evaluate(() => { const h = window.FaustLive.lastHandle; return h.__bgState(); });
  console.log(`bgState after goLive:`, JSON.stringify(st0));
  if (!st0.enabled) fails.push("wantBg not enabled under mobile UA (background path off)");
  if (!ready) fails.push("background WAV never became ready");

  // ── (3) validate the WAV blob: RIFF/WAVE header + nonzero audio ──
  if (ready) {
    const wav = await page.evaluate(async () => {
      const h = window.FaustLive.lastHandle;
      const url = h.__bgUrl();
      const buf = await (await fetch(url)).arrayBuffer();
      const dv = new DataView(buf);
      const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
      const riff = tag(0), wave = tag(8), data = tag(36);
      const dataLen = dv.getUint32(40, true);
      let maxAbs = 0, nonzero = 0;
      const n = Math.min(dataLen / 2, 44100 * 8 * 2);   // scan up to 8s of int16 samples
      for (let i = 0; i < n; i++) { const s = dv.getInt16(44 + i * 2, true); const a = Math.abs(s); if (a) nonzero++; if (a > maxAbs) maxAbs = a; }
      return { bytes: buf.byteLength, riff, wave, data, dataLen, nonzero, maxAbs, channels: dv.getUint16(22, true), sr: dv.getUint32(24, true), bits: dv.getUint16(34, true) };
    });
    console.log(`WAV: ${wav.bytes} bytes  ${wav.riff}/${wav.wave}/${wav.data}  ${wav.channels}ch ${wav.sr}Hz ${wav.bits}bit  dataLen=${wav.dataLen}  nonzero=${wav.nonzero} maxAbs=${wav.maxAbs}`);
    if (wav.riff !== "RIFF" || wav.wave !== "WAVE" || wav.data !== "data") fails.push(`bad WAV header (${wav.riff}/${wav.wave}/${wav.data})`);
    if (wav.channels !== 2 || wav.bits !== 16 || wav.sr !== 44100) fails.push(`unexpected WAV format ${wav.channels}ch/${wav.bits}bit/${wav.sr}Hz`);
    if (wav.dataLen < 44100 * 2 * 2) fails.push(`WAV too short (dataLen ${wav.dataLen})`);
    if (wav.nonzero < 1000 || wav.maxAbs < 16) fails.push(`WAV audio is silent (nonzero ${wav.nonzero}, maxAbs ${wav.maxAbs}) — background loop would be silence`);
  }

  // ── (4) go HIDDEN: assert handoff to <audio> + worklet muted ──
  await page.evaluate(() => { window.__vis = "hidden"; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(500);
  const hid = await page.evaluate(() => window.FaustLive.lastHandle.__bgState());
  console.log(`bgState HIDDEN:`, JSON.stringify(hid));
  if (!(hid.audioSrc && hid.audioSrc.startsWith("blob:"))) fails.push(`hidden: <audio> src is not a blob (${hid.audioSrc})`);
  if (hid.audioPaused !== false) fails.push(`hidden: <audio> is not playing (paused=${hid.audioPaused})`);
  if (hid.active !== true) fails.push(`hidden: handoff not active`);
  if (hid.cstate !== 2) fails.push(`hidden: worklet not muted (C_STATE=${hid.cstate}, want 2)`);

  // ── (5) go VISIBLE: assert hand-back — <audio> paused + worklet running ──
  await page.evaluate(() => { window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(500);
  const vis = await page.evaluate(() => window.FaustLive.lastHandle.__bgState());
  console.log(`bgState VISIBLE:`, JSON.stringify(vis));
  if (vis.audioPaused !== true) fails.push(`visible: <audio> did not pause (paused=${vis.audioPaused})`);
  if (vis.active !== false) fails.push(`visible: handoff still active`);
  if (vis.cstate !== 1) fails.push(`visible: worklet not resumed (C_STATE=${vis.cstate}, want 1)`);

  if (errs.length) console.log(`  page errors (${errs.length}):`, errs.slice(0, 5));
  if (errs.filter((e) => e.startsWith("PAGEERR")).length) fails.push("page errors");

  await context.close(); await browser.close(); srv.close();
  console.log(`\n=== BG-HANDOFF GATE ===`);
  console.log(fails.length ? "FAIL:\n  - " + fails.join("\n  - ") : "PASS");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
