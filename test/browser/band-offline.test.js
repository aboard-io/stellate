#!/usr/bin/env node
// test/browser/band-offline.test.js — DOES IT NEED THE INTERNET?
//
// It did: the pages in this box never registered the service worker, so
// every load went to the network and every sample was fetched again the
// first time it was played. On a phone, in a room with no signal, that is a
// silent app.
//
// This is the only test that can answer the question, because the answer is
// behaviour: warm a record online, CUT THE WIRE, reload, and play. The laws
// are that the page comes back, the session comes back with it, the record
// sounds, and NOTHING goes to the network — a single failed request is a
// sample somebody will not hear on a train.
"use strict";
const path = require("path");
const { launchBrowser, serve, capturePageErrors } = require(path.join(process.cwd(), "test/lib/probe-harness.js"));
(async () => {
  const srv = await serve(process.cwd(), 8931);
  const browser = await launchBrowser("chromium");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const W = function (...a) { const c = new AC(...a), an = c.createAnalyser(); an.fftSize = 2048;
      const o = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (d, ...r) { if (d === c.destination) { try { o.call(this, an); } catch (e) {} } return o.call(this, d, ...r); };
      window.__rms = () => { const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b);
        let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); };
      return c; };
    W.prototype = AC.prototype; window.AudioContext = W; window.webkitAudioContext = W; });
  const errs = capturePageErrors(page);
  const missed = [];
  page.on("requestfailed", (r) => missed.push(r.url().replace(/^https?:\/\/[^/]+/, "")));
  await page.goto(`http://localhost:${srv.port}/nukernel/band.html`, { waitUntil: "networkidle", timeout: 60000 });
  const tap = async (w) => { await page.evaluate((x) => {
      const b = [...document.querySelectorAll(".dopt, .dchip")].find(e => e.textContent === x && !e.disabled);
      if (b) b.click(); }, w); await page.waitForTimeout(320); };
  await tap("count it in");
  for (const w of ["the seventies", "London", "a bar"]) await tap(w);
  await page.waitForTimeout(1500);
  let pass = 0, fails = 0;
  const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };
  ok(await page.evaluate(() => !!navigator.serviceWorker.controller),
     "the service worker never took control — every load is a network load");
  const w = await page.evaluate(() => window.__bandWarm ? window.__bandWarm() : []);
  ok(w.length > 20, "only " + w.length + " files were warmed for a whole record");
  ok(w.some(u => /instruments/.test(u)), "no instrument samples were warmed");
  ok(w.some(u => /\.html|\.js|\.css/.test(u)), "the page's own shell was not warmed");

  // give the fetches a moment to land in the cache
  await page.waitForTimeout(3000);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    let n = 0;
    for (const k of names) n += (await (await caches.open(k)).keys()).length;
    return { names, n }; });
  ok(cached.n > 40, "only " + cached.n + " things are cached");
  ok(cached.names.some(n => /media/.test(n)), "no media cache: " + cached.names.join(","));
  // ---- NOW CUT THE WIRE ----
  await ctx.setOffline(true);
  let reloaded = true;
  await page.reload({ waitUntil: "load", timeout: 30000 })
    .catch(() => { reloaded = false; });
  ok(reloaded, "the page will not load with the wire cut");
  await page.waitForTimeout(2500);
  const alive = await page.evaluate(() => ({
    mods: [...document.querySelectorAll(".dmod")].map(x => x.textContent),
    q: (document.querySelector(".dq") || {}).textContent || null,
    model: !!window.__bandModel }));
  ok(alive.mods.length === 3, "the page came back without its modules: " + JSON.stringify(alive.mods));
  ok(alive.model, "the page came back without its script");
  ok(!!alive.q, "the page came back with nothing to ask");
  // does it still PLAY with the wire cut?
  await page.evaluate(() => { const b = document.getElementById("dplay"); if (b) b.click(); });
  let rms = 0;
  for (let i = 0; i < 16; i++) { await page.waitForTimeout(900);
    rms = Math.max(rms, await page.evaluate(() => (window.__rms ? window.__rms() : -1)));
    if (rms > 0.02) break; }
  ok(rms > 0.01, "the record is silent with the wire cut (peak RMS " + rms.toFixed(4) + ")");
  ok(errs.length === 0, "page errors offline: " + JSON.stringify(errs.slice(0, 2)));
  const kinds = {};
  for (const u of missed) { const k = u.replace(/[^/]+$/, "*"); kinds[k] = (kinds[k] || 0) + 1; }
  ok(missed.length === 0, "went to the network with the wire cut: " + JSON.stringify(kinds));
  console.log("  peak RMS " + rms.toFixed(4) + " · " + w.length + " files warmed · " +
              cached.n + " cached · " + missed.length + " requests failed");
  await ctx.setOffline(false);
  await browser.close();
  console.log(fails ? `\nband-offline: FAIL — ${fails} of ${pass + fails}`
    : `\nband-offline: PASS — ${pass} checks (one visit online, then the record plays with the wire cut and asks the network for nothing)`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error("band-offline: CRASH — " + (e && e.stack || e)); process.exit(1); });
