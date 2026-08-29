#!/usr/bin/env node
// test/leak-procs.js — DOES THE ENGINE LEAK ITS PROCESSORS?
//
//   node test/leak-procs.js [--mins 6] [--every 30]
//
// Paul, on staging: "Crackle showing up after 5 minutes -- if I leave it for an
// hour it warns me of out of memory", with the console repeating faustwasm's
// own per-processor line ("sampleSize: 4 bufferSize: 64 ... x21").
//
// This measures the claim rather than assuming it. Serves the tree with the two
// headers the ring engine needs (COOP/COEP — test/hold.test.js's server, copied),
// presses play, and every --every seconds reads:
//
//   * the worker's PROC CENSUS (stream-worker.js `self.__nuProcCensus`): how many
//     offline processors have ever been made, how many are still REACHABLE
//     (WeakRef.deref, so a collected one drops out), how many of those reachable
//     ones have had destroy() called on them, and the total byteLength of their
//     WebAssembly memories.
//   * performance.measureUserAgentSpecificMemory() from the page — the only
//     number that spans the whole agent cluster (page + dedicated workers) and
//     the reason cross-origin isolation is worth having here. It forces a GC
//     before it answers, so a rising line is a real retention, not GC lag.
//   * performance.memory.usedJSHeapSize (main thread only, for contrast).
//
// The success condition is a FLAT reachable-proc line across stream re-opens,
// not a smaller slope.
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MINS = +argOf("--mins", 6);
const EVERY = +argOf("--every", 30);
const TAG = argOf("--tag", "run");
const CHURN = +argOf("--churn", 0);   // seconds between record changes (0 = leave it playing)

const BORROW = "/home/ford/ftrain-2025/node_modules";
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { ({ chromium } = require(BORROW + "/playwright")); }
const CHROME = [process.env.CHROME_PATH,
  path.join(process.env.HOME || "", ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"),
  path.join(process.env.HOME || "", ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome"),
].filter(Boolean).find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm",
  ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
function serve() {
  return new Promise((res, rej) => {
    const srv = http.createServer((req, rsp) => {
      const rel = decodeURIComponent(req.url.split("?")[0]);
      const p = path.normalize(path.join(ROOT, rel));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream",
        "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp",
        "Cache-Control": "no-cache" });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.on("error", rej);
    srv.on("listening", () => { srv.port = srv.address().port; res(srv); });
    srv.listen(0);
  });
}

const TAP = () => {
  // WHO IS BEING BUILT AND WHO IS BEING TAKEN DOWN. A record change tears the
  // whole engine down and stands a new one up (ui/eight.js setDocument calls
  // stop()), so the question "what is left over" is first a question about
  // contexts and workers, not about processors.
  window.__life = { ctxMade: 0, ctxClosed: 0, wkMade: 0, wkTerm: 0 };
  try {
    const AC = window.AudioContext;
    function WrappedAC() {
      const c = new AC(...arguments);
      window.__life.ctxMade++;
      const cl = c.close.bind(c);
      c.close = function () { window.__life.ctxClosed++; return cl(); };
      return c;
    }
    WrappedAC.prototype = AC.prototype;
    window.AudioContext = WrappedAC;
  } catch (e) {}
  try {
    const WK = window.Worker;
    function WrappedWK() {
      const w = new WK(...arguments);
      window.__life.wkMade++;
      const tm = w.terminate.bind(w);
      w.terminate = function () { window.__life.wkTerm++; return tm(); };
      return w;
    }
    WrappedWK.prototype = WK.prototype;
    window.Worker = WrappedWK;
  } catch (e) {}
  // THE RINGS. Each engine generation allocates its two ~10.6 MB ring
  // SharedArrayBuffers (live.js RING_SEC 30 x 44100 x 2ch x 4B). Counting them
  // with WeakRefs says whether a retired generation's rings are actually let go.
  window.__sab = { made: 0, bytes: 0, refs: [] };
  try {
    const SAB = window.SharedArrayBuffer;
    function WrappedSAB() {
      const b = new SAB(...arguments);
      window.__sab.made++; window.__sab.bytes += b.byteLength;
      try { window.__sab.refs.push(new WeakRef(b)); } catch (e) {}
      return b;
    }
    WrappedSAB.prototype = SAB.prototype;
    window.SharedArrayBuffer = WrappedSAB;
    window.__sabLive = () => { const keep = []; let n = 0, by = 0;
      for (const r of window.__sab.refs) { const b = r.deref(); if (!b) continue; keep.push(r); n++; by += b.byteLength; }
      window.__sab.refs = keep;
      return { made: window.__sab.made, madeMB: +(window.__sab.bytes / 1048576).toFixed(1),
               live: n, liveMB: +(by / 1048576).toFixed(1) }; };
  } catch (e) { window.__sabLive = () => null; }
  window.__tapRms = () => -1;
  const taps = new WeakMap(); let installing = false;
  const orig = AudioNode.prototype.connect;
  const install = (ctx) => {
    try {
      const an = ctx.createAnalyser(); an.fftSize = 2048;
      const buf = new Float32Array(an.fftSize);
      an.connect(ctx.destination);
      window.__tapRms = () => { an.getFloatTimeDomainData(buf); let s = 0;
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        return Math.sqrt(s / buf.length); };
      return an;
    } catch (e) { return null; }
  };
  AudioNode.prototype.connect = function (d, ...rest) {
    try {
      if (!installing && d && d.context && d === d.context.destination) {
        let an = taps.get(d.context);
        if (an === undefined) { installing = true; try { an = install(d.context); } finally { installing = false; } taps.set(d.context, an); }
        if (an) return orig.call(this, an, ...rest);
      }
    } catch (e) {}
    return orig.call(this, d, ...rest);
  };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MB = (b) => +(b / 1048576).toFixed(2);

(async () => {
  if (!CHROME) { console.error("no chromium build found; set CHROME_PATH"); process.exit(2); }
  const srv = await serve();
  const base = "http://localhost:" + srv.port;
  console.log(`leak probe [${TAG}] · ${ROOT} on :${srv.port} · COOP/COEP · ${MINS}min, sample every ${EVERY}s`);

  const browser = await chromium.launch({ headless: true, executablePath: CHROME,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage",
           ] });
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  const page = await ctx.newPage();
  await page.addInitScript(TAP);
  let faustLines = 0;
  page.on("console", (m) => { if (/sampleSize: \d+ bufferSize: \d+/.test(m.text())) faustLines++; });
  page.on("pageerror", (e) => console.log("  pageerror: " + String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") console.log("  cerr: " + m.text().slice(0, 200)); });

  await page.goto(base + "/nukernel/index.html", { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector("#play", { state: "attached", timeout: 60000 });
  await sleep(8000);
  const label = await page.evaluate(() => (document.getElementById("play") || {}).textContent || "");
  // THE LABEL IS "▶play", NOT "play" — an equality test on it silently skipped
  // the click and the first three runs of this probe measured an idle page.
  if (/play/i.test(label)) await page.click("#play");
  console.log("  pressed play (label was " + JSON.stringify(label.trim()) + ")");
  // WAIT FOR SOUND. A run that measures an idle page measures nothing: poll the
  // engine's own state until it is playing, and say so if it never is.
  {
    const t = Date.now(); let st = null;
    while (Date.now() - t < 90000) {
      st = await page.evaluate(() => { try { return window.__nuEngine ? window.__nuEngine().state : null; } catch (e) { return null; } });
      const r = await page.evaluate(() => (window.__tapRms ? window.__tapRms() : -1));
      if (st === "ready" && r > 0.002) break;
      await sleep(1000);
    }
    console.log("  engine state " + st + " after " + ((Date.now() - t) / 1000).toFixed(1) + "s");
  }

  // EVERY WORKER, SUMMED. The ring conductor runs TWO stream-workers (the one
  // playing and the bridge it crossfades to), so reading the first that answers
  // reads half the engine.
  const census = async () => {
    let any = false; const t = { made: 0, live: 0, dead: 0, wasmBytes: 0, closes: 0, workers: 0 };
    for (const w of page.workers()) {
      try {
        const c = await w.evaluate(() => (self.__nuProcCensus ? self.__nuProcCensus.live() : null));
        if (!c) continue;
        any = true; t.workers++;
        t.made += c.made; t.live += c.live; t.dead += c.dead; t.wasmBytes += c.wasmBytes;
        t.closes += c.closes || 0;
      } catch (e) {}
    }
    return any ? t : null;
  };
  // measureUserAgentSpecificMemory only answers after the browser gets round to a
  // garbage collection, and under a busy audio page that can be a minute or more —
  // long enough to stall the sample loop it is supposed to be measuring. Raced
  // against a deadline so a slow answer costs one blank cell, not the run.
  const uaMemRaw = () => page.evaluate(async () => {
    try {
      const m = await performance.measureUserAgentSpecificMemory();
      const byType = {}, byScope = {};
      for (const b of (m.breakdown || [])) {
        if (!b.bytes) continue;
        const k = (b.types || []).join("+") || "?";
        byType[k] = (byType[k] || 0) + b.bytes;
        const at = (b.attribution || []).map((a) => (a.scope || "?") + " " + String(a.url || "").split("/").pop()).join(",") || "unattributed";
        byScope[at] = (byScope[at] || 0) + b.bytes;
      }
      return { bytes: m.bytes, byType, byScope };
    } catch (e) { return { err: String(e).slice(0, 80) }; }
  });
  const uaMem = () => Promise.race([uaMemRaw().catch((e) => ({ err: String(e).slice(0, 60) })),
    sleep(20000).then(() => ({ err: "slow" }))]);
  const jsHeap = () => page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : -1));
  const rms = () => page.evaluate(() => (window.__tapRms ? window.__tapRms() : -1));
  const eng = () => page.evaluate(() => { try { return window.__nuEngine ? window.__nuEngine() : null; } catch (e) { return null; } });
  const line = () => page.evaluate(() => (document.getElementById("engine") || {}).textContent || "");
  const mix = () => page.evaluate(() => { try { return window.__nuMix ? { si: window.__nuMix().si, bar: window.__nuMix().bar, route: window.__nuMix().route } : null; } catch (e) { return null; } });

  // ── THE CHURN. Leaving one record playing never re-opens the stream, and the
  // whole defect surface is what happens at a re-open. Changing the record on
  // the atlas is the page's own door for that (test/hold.test.js's `choose`:
  // the mark answers to Enter, not to a synthetic click), and it is what the
  // box does to itself every time a section's cast changes.
  // THE MARKS THE YEAR ACTUALLY HOLDS. ui/atlas.js choose() refuses a name that
  // is not in `shown` ("no record here at 1985") — measured, the first version of
  // this churn picked marks in DOM order, changed nothing, and left the stream
  // open for the whole run. #atlasSay names the records that are here, which is
  // the same list hold.test.js reads.
  // THE MARKS THE YEAR ACTUALLY HOLDS. ui/atlas.js choose() refuses a name that
  // is not in `shown` ("no record here at 1985"), and a mark the year does not
  // hold is display:none — so ask the DOM which ones are showing rather than
  // parsing the sentence (measured: parsing #atlasSay handed choose() the words
  // "reading 2." nine times and the stream was never re-opened).
  const marks = async () => page.evaluate(() =>
    [...document.querySelectorAll(".place")]
      .filter((g) => getComputedStyle(g).display !== "none")
      .map((g) => g.getAttribute("data-place")).filter(Boolean));
  const choose = (name) => page.evaluate((n) => {
    const g = document.querySelector('.place[data-place="' + n + '"]');
    if (!g) return "no mark for " + n;
    if (g.focus) g.focus();
    g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    return "ok";
  }, name);
  let pi = 0, nextChurn = CHURN * 1000, churns = 0;
  if (CHURN > 0) {
    try { await page.waitForSelector(".place", { state: "attached", timeout: 30000 }); } catch (e) {}
    console.log("  churn every " + CHURN + "s · here now: " + JSON.stringify(await marks()));
  }

  const rows = [];
  const t0 = Date.now();
  const END = MINS * 60 * 1000;
  let next = 0;
  while (Date.now() - t0 < END) {
    const t = Date.now() - t0;
    if (t >= next) {
      next += EVERY * 1000;
      // uaMem FIRST: measureUserAgentSpecificMemory forces a garbage collection
      // before it answers, so the census read right after it counts processors
      // that survived a GC — reachable, not merely uncollected.
      const um = await uaMem();
      const [c, jh, r, mx] = [await census(), await jsHeap(), await rms(), await mix()];
      const row = { min: +(t / 60000).toFixed(2), made: c && c.made, liveProcs: c && c.live,
        destroyedButLive: c && c.dead, wasmMB: c ? MB(c.wasmBytes) : null,
        clusterMB: um && um.bytes != null ? MB(um.bytes) : (um && um.err),
        pageHeapMB: jh > 0 ? MB(jh) : null, rms: r > 0 ? +r.toFixed(4) : r,
        bar: mx && mx.bar, route: mx && mx.route, faustLogLines: faustLines,
        st: (await eng()) ? (await eng()).state : null, say: (await line()).slice(0, 90),
        workers: page.workers().length, engWorkers: c && c.workers, closes: c && c.closes, churns };
      row.life = await page.evaluate(() => window.__life || null);
      row.sab = await page.evaluate(() => (window.__sabLive ? window.__sabLive() : null));
      rows.push(row);
      console.log("  " + JSON.stringify(row));
      if (um && um.byScope) console.log("    where: " + JSON.stringify(Object.fromEntries(
        Object.entries(um.byScope).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, MB(v)]))));
      if (um && um.byType && rows.length <= 1) console.log("    breakdown: " + JSON.stringify(Object.fromEntries(Object.entries(um.byType).map(([k, v]) => [k, MB(v)]))));
    }
    if (CHURN > 0 && t >= nextChurn) {
      nextChurn += CHURN * 1000;
      const here = await marks();
      const n = here.length ? here[(pi++) % here.length] : null;
      const r = n ? await choose(n) : "nothing here";
      churns++;
      console.log("  churn " + churns + " -> " + n + ": " + r
        + " | " + (await page.evaluate(() => (document.getElementById("atlasSay") || {}).textContent || "")).slice(0, 70));
      // a record change can settle the transport back to stopped on some paths;
      // press play again rather than measure a silent page
      const lbl = await page.evaluate(() => (document.getElementById("play") || {}).textContent || "");
      if (/^\s*▶?play/i.test(lbl)) await page.click("#play");
    }
    await sleep(500);
  }
  // ── THE HEAP SNAPSHOT. "Something in the window is holding it" is not an
  // answer; the retaining path is. --snap writes a V8 heap snapshot that
  // test/who-holds.js walks upward from the ring buffers to a GC root.
  if (argv.indexOf("--snap") >= 0) {
    const cdp = await ctx.newCDPSession(page);
    const out = fs.createWriteStream("/tmp/leak-" + TAG + ".heapsnapshot");
    cdp.on("HeapProfiler.addHeapSnapshotChunk", (e) => out.write(e.chunk));
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, treatGlobalObjectsAsRoots: true });
    await new Promise((r) => out.end(r));
    console.log("  heap snapshot -> /tmp/leak-" + TAG + ".heapsnapshot");
  }

  // ── POST-MORTEM: WHO IS HOLDING THE RINGS? Each engine generation allocates
  // two ~10 MB ring SharedArrayBuffers; if they are still live after every
  // context is closed and every worker terminated, something in the window is
  // holding them. Drop the one reference the engine publishes about itself
  // (live.js `root.FaustLive.lastHandle = handle`) and see how much comes back.
  {
    const before = await page.evaluate(() => (window.__sabLive ? window.__sabLive() : null));
    await uaMem();
    const afterGc = await page.evaluate(() => (window.__sabLive ? window.__sabLive() : null));
    await page.evaluate(() => { try { if (window.FaustLive) window.FaustLive.lastHandle = null; } catch (e) {} });
    await uaMem(); await uaMem();
    const afterDrop = await page.evaluate(() => (window.__sabLive ? window.__sabLive() : null));
    const um = await uaMem();
    console.log("\n  post-mortem rings: " + JSON.stringify({ before, afterGc, afterDrop })
      + "\n  cluster after dropping FaustLive.lastHandle: " + (um && um.bytes ? MB(um.bytes) + "MB" : um && um.err));
  }

  const first = rows[1] || rows[0], last = rows[rows.length - 1];
  console.log("\n  === " + TAG + " ===");
  console.log("  procs made: " + last.made + " · reachable: " + first.liveProcs + " -> " + last.liveProcs
    + " · wasm " + first.wasmMB + "MB -> " + last.wasmMB + "MB"
    + " · cluster " + first.clusterMB + "MB -> " + last.clusterMB + "MB");
  fs.writeFileSync("/tmp/leak-" + TAG + ".json", JSON.stringify(rows, null, 1));
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
