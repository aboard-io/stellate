#!/usr/bin/env node
// test/soak-nukernel.js — THE CRACKLE GATE (PROGRAM.md D1, §5).
//
//   node test/soak-nukernel.js [--mins 12] [--load 2] [--url <page>] [--no-deep]
//
// WHAT PAUL SAID, 2026-08-24: "after a few minutes the audio crackles like
// vinyl." The defect is a ring starvation and it does not happen on a quiet
// machine. Two things follow, and they are the whole reason this file is not
// three lines of playwright:
//
//   1. IT SERVES ITSELF. The headers are HALF OF WHAT IS UNDER TEST. Without
//      COOP + COEP there is no SharedArrayBuffer, exploreLive throws at
//      engine/faust/live/live.js:536, and nukernel/audio/live.js demotes to a
//      DIFFERENT ENGINE — one with no conceal, no counters and two still-open
//      ENGINE-AUDIT items (www.ftrain.com serves the page exactly that way
//      today: `curl -sI` shows Cache-Control and nothing else). A gate that
//      borrows whatever server happens to be running cannot tell the two
//      engines apart, so this one sends the two lines from serve.sh:23,28
//      itself, on a port it picked. (Static-server shape lifted from
//      main:test/lib/probe-harness.js, which is not on this branch.)
//
//   2. AN IDLE SOAK IS NOT A GATE. The 2026-08-23 soak on a quiet box measured
//      ZERO episodes in twelve minutes (scratch/longrun/light-after.log) and
//      the record still crackled for Paul. Both of 2026-08-24's reproductions
//      needed contention — 583 ms at 10:51 and 447 ms at 7:53, each on four
//      cores already carrying something else. So `--load N` spawns N busy-loop
//      children for the whole run and they start BEFORE the music does.
//
// It reads window.__nuEngine() (nukernel/audio/live.js health()), which is the
// only place the engine's own instruments — underrunShape, runwaySec,
// loadRatio, __producer, clickMon, auditStats — reach a caller.
//
// --no-deep runs the A/B: it pins FaustLive.deepRunway to false from an init
// script, so the F3 line in audio/live.js can be measured against its own
// absence WITHOUT editing the file between runs (targetFrames() re-reads the
// flag on every pump, engine/faust/live/live.js:1392).
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MINS = +argOf("--mins", 12);
const LOAD = +argOf("--load", 2);
const POLL = +argOf("--poll", 5);
const NODEEP = argv.includes("--no-deep");
const TAG = argOf("--tag", NODEEP ? "nodeep" : "deep");
const JSONOUT = argOf("--json", "");

/* ---------- playwright, borrowed ---------- */
// There is no node_modules in this repo and none may be added (THE OFFLINE
// LAW). Every browser gate in the parent borrows the install next door; the
// explicit executablePath matters because chromium.launch() with no path
// resolves shell build 1200, which is not installed here.
const BORROW = "/home/ford/ftrain-2025/node_modules";
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { ({ chromium } = require(BORROW + "/playwright")); }
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  path.join(process.env.HOME || "", ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"),
  path.join(process.env.HOME || "", ".cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"),
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });

/* ---------- the server, with the two headers that decide the engine ---------- */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm",
  ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".sf2": "application/octet-stream" };

function serve() {
  return new Promise((res, rej) => {
    const srv = http.createServer((req, rsp) => {
      const rel = decodeURIComponent(req.url.split("?")[0]);
      if (rel === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      const p = path.normalize(path.join(ROOT, rel));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        rsp.writeHead(404); return rsp.end();
      }
      rsp.writeHead(200, {
        "Content-Type": MIME[path.extname(p)] || "application/octet-stream",
        // serve.sh:23,28 verbatim. require-corp, not credentialless: Safari has
        // never shipped the latter (docs/HOSTING.md §1).
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.on("error", rej);
    srv.on("listening", () => { srv.port = srv.address().port; res(srv); });
    srv.listen(0);                      // ephemeral: never fight ./serve.sh for 8777
  });
}

/* ---------- the contention ---------- */
// Plain busy loops, one child per core asked for. They are children rather
// than worker threads so the OS scheduler treats them exactly like the second
// browser that produced run B on 2026-08-24.
const kids = [];
function loadOn(n) {
  for (let i = 0; i < n; i++) {
    const c = spawn(process.execPath,
      ["-e", "let x=0;for(;;){x=Math.sqrt(x+Math.random())+Math.sin(x);}"],
      { stdio: "ignore" });
    kids.push(c);
  }
}
function loadOff() { for (const c of kids) { try { c.kill("SIGKILL"); } catch (e) {} } kids.length = 0; }
process.on("exit", loadOff);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { loadOff(); process.exit(130); });

/* ---------- the page-side hooks ---------- */
// PIN deepRunway OFF for the A/B. FaustLive is published by one assignment
// (engine/faust/live/live.js:3659 `root.FaustLive = {...}`), so a window
// accessor installed before any script runs can hand every later reader a
// deepRunway that refuses to be set. Nothing in the product moves.
const INIT_NODEEP = () => {
  let _fl;
  Object.defineProperty(window, "FaustLive", {
    configurable: true,
    get() { return _fl; },
    set(v) {
      _fl = v;
      try { Object.defineProperty(v, "deepRunway", { get: () => false, set: () => {}, configurable: true }); }
      catch (e) {}
    },
  });
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
const f = (v, n, w) => (v == null ? "-" : (+v).toFixed(n)).padStart(w);

(async () => {
  if (!CHROME) { console.error("no chromium build found; set CHROME_PATH"); process.exit(2); }
  const srv = await serve();
  const URL = argOf("--url", `http://localhost:${srv.port}/nukernel/index.html`);
  console.log(`soak [${TAG}]  ${MINS} min · ${LOAD} busy core(s) · poll ${POLL}s`);
  console.log(`  serving ${ROOT} on :${srv.port} with COOP:same-origin + COEP:require-corp`);
  console.log(`  page ${URL}`);
  // ── WHAT ELSE IS ON THE BOX. `--load N` means "N busy cores ON TOP OF AN
  // OTHERWISE IDLE MACHINE"; that is the premise the episode counts are read
  // against. On 2026-08-24 a run of this gate failed at t=47 with the producer
  // at 1.19x budget while eight other agents were compiling on the same four
  // cores (1-minute load average 16.9) — a real starvation, and not the one the
  // gate is asking about. So the machine states its own load, before and after,
  // and a reader can tell "the engine is behind" from "the box is behind".
  const la = () => os.loadavg().map((v) => v.toFixed(1)).join(" ");
  console.log(`  ${os.cpus().length} cores · load average before ${la()} (this gate assumes the box is otherwise idle)`);

  loadOn(LOAD);

  const browser = await chromium.launch({
    headless: true, executablePath: CHROME,
    args: ["--autoplay-policy=no-user-gesture-required", "--enable-precise-memory-info",
           "--no-sandbox"],
  });
  const page = await browser.newPage();
  const cerr = [], perr = [];
  page.on("console", (m) => { if (m.type() === "error") cerr.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => perr.push(String(e).slice(0, 200)));
  if (NODEEP) await page.addInitScript(INIT_NODEEP);

  await page.goto(URL, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.click("#play");

  const rows = [];
  const t0 = Date.now(), END = t0 + MINS * 60000;

  // ── WHAT THE PREFILL COSTS, AS A NUMBER ───────────────────────────────────
  // The start-up fix (STATE.md item 16) buys its zero holes with SILENCE: the
  // engine now holds the ring reader at C_STATE=0 until the ring holds a real
  // runway, so the page takes longer before the first note. That is a thing
  // Paul feels, so it is measured here rather than asserted in a comment — the
  // read cursor is monotonic and advances ONLY while the worklet is running, so
  // its first non-zero is the first sample that reached the speaker. Polled at
  // 100 ms because a 5-second poll cannot see a 6-second change honestly. This
  // is a REPORT, never a check: nothing here can fail the gate, and the holes
  // it exists to explain are still counted by starve.episodes alone.
  let firstNoteMs = null;
  for (let i = 0; i < 600 && Date.now() < END; i++) {
    let cur = 0;
    try {
      cur = await page.evaluate(() => {
        const h = (window.FaustLive && window.FaustLive.lastHandle) || null;
        try { return (h && h.readCursor) ? h.readCursor() : 0; } catch (e) { return 0; }
      });
    } catch (e) { break; }
    if (cur > 0) { firstNoteMs = Date.now() - t0; break; }
    await sleep(100);
  }
  console.log(`  first note at ${firstNoteMs == null ? "never (within 60s)" : (firstNoteMs / 1000).toFixed(2) + "s"} after the click`);

  console.log("\n   t(s)  route      iso ring  runway     fed  bklog  keepUp   epi  worstMs  lastAtSec  quanta  anom  clicks  cmRms  deficit  pMean  pPeak  heapMB");
  while (Date.now() < END) {
    await sleep(POLL * 1000);
    let s;
    try {
      s = await page.evaluate(() => {
        const E = window.__nuEngine ? window.__nuEngine() : null;
        const h = (window.FaustLive && window.FaustLive.lastHandle) || null;
        const S = (fn, d) => { try { const v = fn(); return v == null ? d : v; } catch (e) { return d; } };
        return {
          eng: E,
          line: window.__nuEngineLine ? window.__nuEngineLine() : null,
          dom: (document.getElementById("engine") || {}).textContent || null,
          cmRms: h && h.clickMon ? S(() => h.clickMon().rms, null) : null,
          // THE TWO LEDGERS, SIDE BY SIDE (engine __runway(); "the phantom
          // runway", docs/ENGINE-AUDIT-2026-07). `fed` is frames POSTED to the
          // producer, `ring` is frames the producer has actually RENDERED, and
          // their gap is its unrendered backlog. Without both, the runwaySec
          // sawtooth is unreadable: a ring that rises by one chord bar and falls
          // at exactly 1.00 s per second under a FLAT 8 s feed ledger is chunk
          // granularity, and the identical curve under a COLLAPSING ledger would
          // be the conductor having stopped feeding. Same picture, opposite bug.
          rw: h && h.__runway ? S(() => h.__runway(), null) : null,
          heap: (performance.memory && performance.memory.usedJSHeapSize) || 0,
          deep: !!(window.FaustLive && window.FaustLive.deepRunway),
        };
      });
    } catch (e) { console.log("  poll failed:", String(e).slice(0, 140)); break; }
    const E = s.eng || {};
    const row = { t: +((Date.now() - t0) / 1000).toFixed(0), ...E, cmRms: s.cmRms,
                  fedSec: s.rw ? s.rw.fedSec : null, backlogSec: s.rw ? s.rw.backlogSec : null,
                  heap: s.heap, line: s.line, dom: s.dom, deep: s.deep };
    rows.push(row);
    const st = E.starve || {};
    console.log([
      f(row.t, 0, 7), " " + String(E.route || "-").padEnd(10),
      String(!!E.isolated).padEnd(4), String(!!E.ring).padEnd(5),
      f(E.runwaySec, 2, 6), f(row.fedSec, 2, 7), f(row.backlogSec, 2, 6), f(E.keepUp, 3, 7), f(st.episodes, 0, 5), f(st.worstMs, 1, 8),
      f(st.lastAtSec, 1, 10), f(st.quanta, 0, 7), f(E.anomalies, 0, 5), f(E.clicks, 0, 7),
      f(row.cmRms, 3, 6), f(E.ringDeficit, 0, 8),
      f(E.producer && E.producer.mean, 3, 6), f(E.producer && E.producer.peak, 3, 6),
      f(row.heap / 1048576, 1, 7),
    ].join(" "));
  }

  const last = rows[rows.length - 1] || {};
  const line = last.line;
  // the engine's own account of the prefill: what was asked, what the ring held
  // when the reader was released, how long that took, and whether the wait was
  // ended by PREFILL_MAX_MS instead of by the ring filling.
  let prefill = null;
  try {
    prefill = await page.evaluate(() => {
      const h = (window.FaustLive && window.FaustLive.lastHandle) || null;
      try { return (h && h.__prefill) ? h.__prefill() : null; } catch (e) { return null; }
    });
  } catch (e) {}
  await browser.close();
  srv.close();
  loadOff();

  /* ---------- the verdict ---------- */
  const keeps = rows.map((r) => r.keepUp).filter((v) => typeof v === "number");
  const heapAt2 = (rows.find((r) => r.t >= 120) || rows[0] || {}).heap || 0;
  const heapEnd = last.heap || 0;
  const maxEpi = Math.max(0, ...rows.map((r) => (r.starve && r.starve.episodes) | 0));
  const worst = rows.reduce((a, r) => Math.max(a, (r.starve && r.starve.worstMs) || 0), 0);
  const lastAt = rows.reduce((a, r) => Math.max(a, (r.starve && r.starve.lastAtSec) || 0), 0);
  const maxAnom = Math.max(0, ...rows.map((r) => r.anomalies | 0));
  const clicks = rows.reduce((a, r) => Math.max(a, r.clicks || 0), 0);
  const cmAlive = rows.some((r) => r.clickMonAlive);
  const pPeak = rows.reduce((a, r) => Math.max(a, (r.producer && r.producer.peak) || 0), 0);
  const p05 = pct(keeps, 0.05);
  const runwayAfter1min = rows.filter((r) => r.t >= 60).map((r) => r.runwaySec);

  const checks = [
    ["the streaming engine, cross-origin isolated",
      !!last.isolated && !!last.ring, `isolated=${!!last.isolated} ring=${!!last.ring} route=${last.route}`],
    ["starve.episodes === 0", maxEpi === 0,
      `episodes=${maxEpi} worstMs=${worst} lastAtSec=${lastAt}`],
    ["keepUp p05 >= 0.92", p05 != null && p05 >= 0.92, `p05=${p05}`],
    ["clickMonAlive && clicks === 0 (F6)", cmAlive && clicks === 0,
      `clickMonAlive=${cmAlive} clicks=${clicks}`],
    ["anomalies === 0", maxAnom === 0, `anomalies=${maxAnom}`],
    ["end heap <= 1.25x minute-2 heap", heapAt2 > 0 && heapEnd <= 1.25 * heapAt2,
      `${(heapAt2 / 1048576).toFixed(1)}MB -> ${(heapEnd / 1048576).toFixed(1)}MB`],
    ["zero console errors, zero pageerrors", cerr.length === 0 && perr.length === 0,
      `console=${cerr.length} pageerror=${perr.length}`],
    ["producer.peak <= 3.0", pPeak <= 3.0, `peak=${pPeak}`],
  ];

  console.log("");
  for (const [name, ok, note] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}  (${note})`);
  console.log("");
  console.log(`  readout: ${JSON.stringify(line)}`);
  console.log(`  first note: ${firstNoteMs == null ? "never seen" : (firstNoteMs / 1000).toFixed(2) + "s"} after the click   prefill: ${JSON.stringify(prefill)}`);
  if (last.dom != null) console.log(`  #engine: ${JSON.stringify(last.dom)}`);
  console.log(`  deepRunway seen by the engine: ${last.deep}`);
  console.log(`  load average after ${la()} on ${os.cpus().length} cores (the ${LOAD} busy children this gate spawned are already dead by here)`);
  // ── THE SAWTOOTH IS THE CHUNK, NOT A STARVATION ──────────────────────────
  // STATE.md, 2026-08-24: "the runway does not sit at 8 s, though; it sawtooths
  // between about 2.7 s and 8.1 s, so design 01's claim of runwaySec >= 7.5 from
  // the first minute did not reproduce". It sawtooths, it is HEALTHY, and the
  // three ledgers printed above are the proof. The producer publishes ONE CHORD
  // BAR at a time (stream-worker renders a chunk, THEN stores R_WRITE), so the
  // ring gains a whole bar at once and is eaten continuously at exactly 1.00 s
  // per second in between: the tooth's amplitude IS one bar and its fall IS the
  // reader. Measured, 2026-08-24, a healthy minute with a 4.1 s bar:
  //
  //     ring 7.16 6.05 4.98 3.91 | 5.99 4.94 3.90 | 7.04 6.02 4.98 3.93
  //     fed 11.28 10.17 9.10 8.03 | 10.16 9.11 8.07 | 11.22 10.20 9.15 8.11
  //     bklog 4.12 4.12 4.12 4.12 | 4.17 4.17 4.17 | 4.17 4.17 4.17 4.17
  //
  // The FEED ledger is the same sawtooth one bar higher (the pump tops up
  // whenever it falls under the 8 s target) and the BACKLOG — fed minus rendered,
  // the producer's queue — is a FLAT 4.1 s, one bar in flight and never a second.
  // ring = fed − backlog, exactly. Design 01's "runwaySec >= 7.5" was a claim
  // about the feed ledger, which does sit up there.
  //
  // AND HERE IS THE SAME PICTURE WHEN IT IS THE REAL THING (the run that
  // reproduced starvation at t=47 on an over-subscribed box): the feed ledger
  // keeps sawtoothing around the target — the CONDUCTOR is fine — while the
  // backlog climbs 4.11 → 8.23 → 12.43 and never comes back, the ring flatlines
  // at 0.00 and keepUp goes to 0.000. So the discriminator is not the ring's
  // shape at all, it is whether the backlog is CONSTANT (one bar in flight, the
  // pipeline quantum) or GROWING (the producer is losing). That is why both
  // columns are printed beside the runway from now on.
  console.log(`  runway after 1 min: min ${Math.min(...runwayAfter1min).toFixed(2)}s  max ${Math.max(...runwayAfter1min).toFixed(2)}s  (the tooth = one chord bar; the floor that matters is 0.5s, and keepUp p05 above is the ring measured against it)`);
  const fedAfter1min = rows.filter((r) => r.t >= 60).map((r) => r.fedSec).filter((v) => typeof v === "number");
  if (fedAfter1min.length) console.log(`  feed ledger after 1 min: min ${Math.min(...fedAfter1min).toFixed(2)}s  max ${Math.max(...fedAfter1min).toFixed(2)}s  (the same tooth one bar higher = the conductor never stopped feeding)`);
  const bkAfter1min = rows.filter((r) => r.t >= 60).map((r) => r.backlogSec).filter((v) => typeof v === "number");
  if (bkAfter1min.length) console.log(`  producer backlog after 1 min: min ${Math.min(...bkAfter1min).toFixed(2)}s  max ${Math.max(...bkAfter1min).toFixed(2)}s  (CONSTANT = one bar in flight, the pipeline quantum; GROWING = the producer is losing, which is what a real starvation looks like)`);
  if (cerr.length) console.log("  console errors:\n    " + cerr.slice(0, 8).join("\n    "));
  if (perr.length) console.log("  page errors:\n    " + perr.slice(0, 8).join("\n    "));
  if (last.errors && last.errors.length) console.log("  handle.errors: " + JSON.stringify(last.errors));

  const bad = checks.filter(([, ok]) => !ok);
  if (bad.length) {
    // THE SERIES IS THE EVIDENCE. A single end-state cannot tell a hole at
    // 10:51 from crackle throughout, and `lastAtSec` is what places it.
    console.log("\n  --- the whole series (a failure is a shape, not a number) ---");
    for (const r of rows) {
      const st2 = r.starve || {};
      console.log(`  t=${String(r.t).padStart(4)}s route=${r.route} ring=${r.ring} runway=${(r.runwaySec || 0).toFixed(2)} keepUp=${r.keepUp} epi=${st2.episodes | 0} maxRun=${st2.maxRun | 0} worstMs=${st2.worstMs || 0} lastAtSec=${st2.lastAtSec || 0} anom=${r.anomalies} clicks=${r.clicks} cmRms=${r.cmRms} heapMB=${(r.heap / 1048576).toFixed(1)}`);
    }
  }
  if (JSONOUT) fs.writeFileSync(JSONOUT, JSON.stringify({ tag: TAG, mins: MINS, load: LOAD, rows, checks, cerr, perr }, null, 1));
  console.log(`\n  ${bad.length ? "SOAK FAILED: " + bad.map(([n]) => n).join("; ") : "SOAK PASSED"}`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { loadOff(); console.error(e); process.exit(2); });
