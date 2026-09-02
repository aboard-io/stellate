#!/usr/bin/env node
// test/commute.test.js — THE COMMUTE, DRIVEN.
//
//   node test/commute.test.js [--secs 60] [--only T1|T2|T3]
//
// PAUL, 2026-08-27, FROM A TRAIN: "Please cache everything you need to play one
// song it keeps cutting out while I'm going into tunnels on the train."
//
// test/hold.test.js asks whether the HOLD is complete — a ledger question, and
// a good one. This file asks the COMMUTE question, which is a different one and
// is the one the report is judged on: does the sound survive the tunnel. So
// every case here cuts the wire MID-JOURNEY rather than at a convenient moment,
// and every verdict is taken off the OUTPUT (an AnalyserNode before
// ctx.destination) rather than off any counter the code under test writes.
//
//   T1  THE TUNNEL       — load online, wait for the hold, cut the wire, play
//                          60 s. Unbroken audio, no failed request from ANY
//                          target (page or worker), nothing reaches the server,
//                          and the readout still says held.
//   T2  THE COLD TUNNEL  — hold online, then a FULL RELOAD with the wire cut,
//                          so the service worker has to serve the shell from
//                          nothing. Boot, play, same assertions.
//   T3  THE FLICKER      — tunnels come in sequence. Cut and restore three
//                          times inside one 60 s play; the audio must not
//                          notice.
//
// EACH CASE GETS A COLD BROWSER CONTEXT, and that is not tidiness. Run in one
// context the three cases share a Cache Storage, so T3 would be measuring what
// T1 and T2 happened to pull — measured 2026-08-27, exactly that: T3 passed
// green in a shared context while its own hold said `modules: 0`. A commute
// starts from whatever the phone has, and the honest floor is "nothing".
//
// WHAT COUNTS AS A FAILED REQUEST, and why the coverage is measured rather than
// hoped for. The renderer is a real module Worker on its own thread, so "the
// page saw no failure" is only worth something if the harness can see a
// worker's failures at all. C0 below measures exactly that: during the online
// boot it diffs the SERVER'S OWN LOG (ground truth — every byte the browser
// pulled, worker fetches included) against what Playwright reported, and prints
// the shortfall. A non-empty shortfall would mean the later zero-failures
// assertions are blind, and the run says so.
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SECS = +argOf("--secs", 60);
const ONLY = argOf("--only", null);
const HOLDWAIT = +argOf("--holdwait", 150);

const BORROW = "/home/ford/ftrain-2025/node_modules";
let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { ({ chromium } = require(BORROW + "/playwright")); }
const CHROME = [process.env.CHROME_PATH,
  path.join(process.env.HOME || "", ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome"),
  path.join(process.env.HOME || "", ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome"),
].filter(Boolean).find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });

/* ---------- the server: the two headers ARE half of what is under test ------ */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm",
  ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const HITS = [];
let PHASE = "boot";
function serve() {
  return new Promise((res, rej) => {
    const srv = http.createServer((req, rsp) => {
      const rel = decodeURIComponent(req.url.split("?")[0]);
      HITS.push({ phase: PHASE, url: rel });
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

/* ---------- the ear ---------------------------------------------------------
   An AnalyserNode interposed by patching AudioNode.prototype.connect. NOT by
   replacing AudioWorkletNode — audio/live.js health()'s note records that
   stubbing that class is what made a previous probe read rms 0 for twelve
   minutes and call a live detector blind. */
const TAP = () => {
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
let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n         " + detail : ""));
  return false;
};

const holdOf = (page) => page.evaluate(() => { try { return window.__nuHold ? window.__nuHold() : null; } catch (e) { return null; } });
const lineOf = (page) => page.evaluate(() => { try { return window.__nuEngineLine ? window.__nuEngineLine() : null; } catch (e) { return null; } });
/* THE PAINTED SENTENCE, WHERE IT IS PAINTED (rewritten 2026-09-02). This read
   `#engine`, which is an element index.html deleted on 2026-08-28 — Paul: *"Get
   rid of the media (mediaEl) held plays offline etc section on the top; move
   that info to the logger."* The tombstone in index.html is explicit that every
   clause of the old contract survived the move ("the sentence still has exactly
   one owner — `engineLine()` in audio/live.js … It is still outside #app"), so
   what this check wants is unchanged and only its ADDRESS moved: `#nu-log`,
   written by ui/eight.js `logEngine`, one line a second and only when the
   sentence actually changes. Reading the whole log rather than one node is
   correct AND stricter — the claim is "a reader can see it", and the log keeps
   its predecessors, which the deleted paragraph never could. */
const domLine = (page) => page.evaluate(() => {
  /* THE LOG IS PAINTED WHEN IT IS OPEN, and only then: `addRow` returns early
     unless `logOpen`, which is the frozen-page discipline working (a shut
     panel is not a surface the clock writes into). `__nuLogOpen` is the page's
     own door onto the ¶ button — the same call the button makes — so this asks
     a reader's question ("can somebody SEE the sentence") through a reader's
     gesture rather than by reaching into `logs`. */
  try { if (window.__nuLogOpen) window.__nuLogOpen(true); } catch (e) {}
  return (document.getElementById("nu-log") || {}).textContent || "";
});
/* THE WORD ON THE TRANSPORT, NOT THE GLYPH BESIDE IT (rewritten 2026-09-02).
   This took the button's whole `textContent` and compared it to "play" — and
   the transport moved into the foot with a FACE on it (wave 1a: `paintIcon`
   writes the glyph and then the `.nu-vh` word into the same button), so the
   text is now "▶play" and never equalled "play" again. `press()` therefore took
   its ELSE branch on every single call: click (the record starts), 400 ms,
   click (the record STOPS) — and then listened to sixty seconds of silence and
   reported "sound arrives with the wire cut: no sound in 60s" on a page that
   was playing perfectly. Measured 2026-09-02: `#play` textContent "▶play",
   aria-label "play", `.nu-vh` "play".
   So the word is read where the word IS: the `.nu-vh` span if there is one,
   else the aria-label, else the raw text — the glyph is aria-hidden and is not
   the answer to "what will this button do". */
const playLabel = (page) => page.evaluate(() => {
  const e = document.getElementById("play");
  if (!e) return "";
  const vh = e.querySelector(".nu-vh");
  return String((vh && vh.textContent) || e.getAttribute("aria-label") ||
                e.textContent || "").trim();
});

// WAIT FOR A LEDGER THAT HAS STOPPED MOVING, not for one that is momentarily
// idle. `queued 0, running 0` is true in the gap before holdModules' manifest
// promise resolves, and it is true of a warm that ran before the record
// compiled — measured 2026-08-27, that second case is how a gate came to test a
// five-file ledger and call it a held record. So: the warm must say it SAW a
// record, and the numbers must repeat once.
async function waitHeld(page, secs, label) {
  const t0 = Date.now(); let h = null, prev = "";
  while (Date.now() - t0 < secs * 1000) {
    h = await holdOf(page);
    const key = h ? [h.want, h.held, h.queued, h.running, h.sawRecord].join("/") : "";
    if (h && h.want && h.sawRecord && !h.queued && !h.running && key === prev) break;
    prev = key;
    await sleep(300);
  }
  const brief = h ? { want: h.want, held: h.held, queued: h.queued, running: h.running,
                      modules: h.modules, sawRecord: h.sawRecord, settleTries: h.settleTries,
                      lost: h.lost, line: h.line } : null;
  console.log(`  ${label}: ${JSON.stringify(brief)} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return h;
}

/* ---------- listen, and say what the ear got -------------------------------- */
// Sampled every 100 ms (the brief asks for 4/s; ten is finer and so is the
// stricter reading of a 250 ms hole). Gaps are counted FROM THE FIRST SOUND —
// the engine's prefill is silence by design (audio/live.js: "the start-up fix
// buys its zero holes with SILENCE") and counting it would fail every run for
// the thing that stops runs failing.
async function listen(page, { secs, label, during }) {
  const S = []; const t0 = Date.now();
  let firstSoundMs = null, maxBar = -1, wrapped = false, lastBar = -1;
  let marks = [];
  while (Date.now() - t0 < secs * 1000) {
    const v = await page.evaluate(() => ({ rms: window.__tapRms ? window.__tapRms() : -1,
      bar: (() => { try { return window.__nuMix ? window.__nuMix().bar : null; } catch (e) { return null; } })() }));
    const t = Date.now() - t0;
    S.push({ t, rms: v.rms });
    if (firstSoundMs == null && v.rms > 0.002) firstSoundMs = t;
    if (v.bar != null && v.bar >= 0) {
      if (lastBar >= 0 && v.bar < lastBar && maxBar >= 1) wrapped = true;
      lastBar = v.bar; if (v.bar > maxBar) maxBar = v.bar;
    }
    if (during) { const m = await during(t); if (m) marks.push(m); }
    await sleep(100);
  }
  const gaps = []; let run = 0, at = 0;
  for (const s of S) {
    if (firstSoundMs == null || s.t < firstSoundMs) continue;
    if (s.rms < 0.002) { if (!run) at = s.t; run += 100; }
    else { if (run > 250) gaps.push({ ms: run, at }); run = 0; }
  }
  if (run > 250) gaps.push({ ms: run, at });
  const peak = S.reduce((m, s) => Math.max(m, s.rms), 0);
  const quiet = S.filter((s) => s.rms < 0.002).length;
  const longest = (() => { let best = 0, r = 0;
    for (const s of S) { if (firstSoundMs == null || s.t < firstSoundMs) continue;
      if (s.rms < 0.002) { r += 100; if (r > best) best = r; } else r = 0; } return best; })();
  console.log(`  [${label}] ${((Date.now() - t0) / 1000).toFixed(0)}s · ${S.length} samples`
    + ` · first sound ${firstSoundMs == null ? "NEVER" : (firstSoundMs / 1000).toFixed(1) + "s"}`
    + ` · peak rms ${peak.toFixed(4)} · silent samples ${quiet}/${S.length}`
    + ` · longest hole ${longest}ms · gaps>250ms ${gaps.length} ${JSON.stringify(gaps.slice(0, 8))}`
    + ` · bars 0..${maxBar}${wrapped ? " (came round)" : ""}`);
  if (marks.length) console.log("    wire: " + marks.join(" "));
  return { gaps, peak, firstSoundMs, longest, maxBar, wrapped, samples: S.length };
}

(async () => {
  if (!CHROME) { console.error("no chromium build found; set CHROME_PATH"); process.exit(2); }
  const srv = await serve();
  const base = "http://localhost:" + srv.port;
  const URL0 = base + "/nukernel/index.html";
  console.log("commute gate · " + ROOT + " on :" + srv.port + " · COOP:same-origin COEP:require-corp · secs=" + SECS);

  const browser = await chromium.launch({ headless: true, executablePath: CHROME,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage"] });

  // A COLD CONTEXT: its own Cache Storage, its own worker registration.
  async function session(tag) {
    const ctx = await browser.newContext({ serviceWorkers: "allow" });
    await ctx.addInitScript(TAP);
    const page = await ctx.newPage();
    // TWO CLASSES OF FAILURE, AND ONLY ONE OF THEM IS A DROPOUT. sw.js runs the
    // app cache stale-while-revalidate: every hit it serves ALSO fires a
    // background `fetch` to refresh the copy for next time, and in a tunnel that
    // background fetch fails BY DESIGN while the consumer already has the bytes.
    // Counting those as dropouts would make a correct offline load report dozens
    // of failures; not counting them at all would hide a real miss. They are
    // separated by initiator — Playwright's `request.serviceWorker()` is
    // non-null exactly for a fetch the service worker itself issued — and both
    // numbers are printed. What must be ZERO is UNANSWERED: a request some
    // consumer (the page, a frame, the render worker) made and got nothing for.
    const failed = [], seenReq = new Set();
    const initiator = (r) => { try { return r.serviceWorker() ? "sw" : "consumer"; } catch (e) { return "consumer"; } };
    const note = (r, src) => failed.push({ phase: PHASE, src, kind: initiator(r),
      url: r.url().replace(base, ""), err: ((r.failure && r.failure()) || {}).errorText });
    page.on("requestfailed", (r) => note(r, "page"));
    ctx.on("requestfailed", (r) => note(r, "ctx"));
    page.on("request", (r) => { try { seenReq.add(new URL(r.url()).pathname); } catch (e) {} });
    ctx.on("request", (r) => { try { seenReq.add(new URL(r.url()).pathname); } catch (e) {} });
    const inPhase = (ph) => { const seen = new Set(); return failed.filter((f) => {
      if (ph.indexOf(f.phase) < 0) return false;
      const k = f.kind + " " + f.url; if (seen.has(k)) return false; seen.add(k); return true; }); };
    const S = {
      ctx, page, seenReq,
      failedIn: (...ph) => inPhase(ph).filter((f) => f.kind === "consumer"),
      revalIn: (...ph) => inPhase(ph).filter((f) => f.kind === "sw"),
    };
    S.wireSay = (...ph) => "unanswered " + S.failedIn(...ph).length
      + " · sw background revalidations that failed (benign) " + S.revalIn(...ph).length;
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    S.wire = async (up) => {
      await ctx.setOffline(!up);
      await cdp.send("Network.emulateNetworkConditions",
        { offline: !up, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    };
    return S;
  }
  const hitsIn = (...ph) => [...new Set(HITS.filter((h) => ph.indexOf(h.phase) >= 0).map((h) => h.url))];

  // BOOT AND HOLD, on the wire. Returns the ledger the tunnel will live on.
  async function bootAndHold(S, phase, label) {
    PHASE = phase;
    /* THE BOX BOOTS ON THE BLANK STATE (2026-09-02). Paul, the composer round:
       *"Add a 'silence' genre at the top of the genre list. This is a blank
       state."* — one eight-bar section, ZERO voices, one cell of rests. This gate
       is about a record with a band in it, so it names one in the address, the way
       a link does: the shipped chant, at seed 1 because the boot draws a seed now
       (*"Boot up every new session with a new seed unless there's a seed in the
       URL"*) and a gate that re-rolled its own subject would measure a different
       record every run. */
    await S.page.goto(URL0 + CHANT, { waitUntil: "load", timeout: 120000 });
    await S.page.waitForSelector("#play", { state: "attached", timeout: 60000 });
    await sleep(9000);
    return await waitHeld(S.page, HOLDWAIT, label);
  }
  const press = async (page) => {
    if ((await playLabel(page)) === "play") await page.click("#play");
    else { await page.click("#play"); await sleep(400); await page.click("#play"); }
  };

  let r1 = null, r2 = null, r3 = null, s1 = null, s2 = null, s3 = null;

  /* ── T1 · THE TUNNEL ─────────────────────────────────────────────────────── */
  if (!ONLY || ONLY === "T1") {
    console.log("\nT1 — THE TUNNEL: cold load, hold online, cut the wire, play " + SECS + "s");
    s1 = await session("T1");
    const h = await bootAndHold(s1, "T1boot", "  hold(boot record)");
    // C0 · CAN THIS HARNESS SEE A WORKER'S REQUESTS AT ALL? The renderer runs on
    // its own thread, so "the page saw no failure" is worth nothing unless the
    // harness can see a worker's failures. The SERVER'S log is ground truth —
    // every byte the browser pulled, worker fetches included — so the shortfall
    // against what Playwright reported IS the coverage number.
    const serverSaw = hitsIn("T1boot").filter((u) => u !== "/sw.js");
    const blind = serverSaw.filter((u) => !s1.seenReq.has(u));
    console.log(`  coverage: server logged ${serverSaw.length} distinct paths; playwright reported ${s1.seenReq.size}`);
    ok(blind.length === 0, "every request the server saw was reported to the harness (worker targets included)",
      blind.length + " unreported: " + JSON.stringify(blind.slice(0, 12)));
    ok(!!h && h.line === "held — plays offline", "the record on the page reaches held BEFORE the tunnel", h && h.line);
    ok(!!h && h.modules > 0, "the held set contains the record's own Faust modules", "modules=" + (h && h.modules));
    ok(!!h && h.sawRecord === true, "the hold was looking at a compiled record when it counted", JSON.stringify(h && { sawRecord: h.sawRecord, settleTries: h.settleTries }));

    await s1.wire(false);
    PHASE = "T1";
    await press(s1.page);
    r1 = await listen(s1.page, { secs: SECS, label: "T1 offline" });
    ok(r1.firstSoundMs != null, "sound arrives with the wire cut", "no sound in " + SECS + "s");
    ok(r1.gaps.length === 0, "no hole over 250 ms", "longest " + r1.longest + "ms · " + JSON.stringify(r1.gaps));
    console.log("  requests: " + s1.wireSay("T1"));
    ok(s1.failedIn("T1").length === 0, "zero unanswered requests, any target", JSON.stringify(s1.failedIn("T1").slice(0, 8)));
    ok(hitsIn("T1").filter((u) => u !== "/sw.js").length === 0, "nothing reached the server", JSON.stringify(hitsIn("T1")));
    const l1 = await lineOf(s1.page), d1 = await domLine(s1.page);
    ok(/held — plays offline/.test(l1 || ""), "the readout still says held", l1);
    ok(/held — plays offline/.test(d1 || ""), "and the PAINTED sentence says it too", d1);
    await s1.ctx.close();
  }

  /* ── T2 · THE COLD TUNNEL ────────────────────────────────────────────────── */
  if (!ONLY || ONLY === "T2") {
    console.log("\nT2 — THE COLD TUNNEL: cold load + hold, then a FULL RELOAD with the wire cut");
    s2 = await session("T2");
    const h = await bootAndHold(s2, "T2boot", "  hold(before the cold reload)");
    ok(!!h && h.line === "held — plays offline", "held while the wire was up", h && h.line);
    await s2.wire(false);
    PHASE = "T2";
    let booted = true;
    try { await s2.page.reload({ waitUntil: "load", timeout: 60000 }); }
    catch (e) { booted = false; console.log("  reload threw: " + String(e).split("\n")[0]); }
    ok(booted, "the page reloaded with the wire cut (the worker served the shell)");
    let hasPlay = false;
    try { await s2.page.waitForSelector("#play", { state: "attached", timeout: 45000 }); hasPlay = true; } catch (e) {}
    ok(hasPlay, "the shell painted: there is a transport to press");
    if (hasPlay) {
      const h2 = await waitHeld(s2.page, 60, "  hold(after the cold boot, offline)");
      ok(!!h2 && h2.line === "held — plays offline", "the cold-booted page says held with the wire still cut", h2 && h2.line);
      await press(s2.page);
      r2 = await listen(s2.page, { secs: SECS, label: "T2 cold offline" });
      ok(r2.firstSoundMs != null, "the cold-booted record makes sound offline", "no sound in " + SECS + "s");
      ok(r2.gaps.length === 0, "no hole over 250 ms", "longest " + r2.longest + "ms · " + JSON.stringify(r2.gaps));
      console.log("  requests: " + s2.wireSay("T2"));
      ok(s2.failedIn("T2").length === 0, "zero unanswered requests through the cold boot and the play",
        JSON.stringify(s2.failedIn("T2").slice(0, 10)));
      ok(hitsIn("T2").filter((u) => u !== "/sw.js").length === 0, "nothing reached the server",
        JSON.stringify(hitsIn("T2").slice(0, 10)));
      console.log("  readout: " + JSON.stringify(await lineOf(s2.page)));
    }
    await s2.ctx.close();
  }

  /* ── T3 · THE FLICKER ────────────────────────────────────────────────────── */
  if (!ONLY || ONLY === "T3") {
    console.log("\nT3 — THE FLICKER: cold load, then three tunnels inside one " + SECS + "s play");
    s3 = await session("T3");
    const h = await bootAndHold(s3, "T3boot", "  hold(before the flicker)");
    ok(!!h && h.line === "held — plays offline", "held before the first tunnel", h && h.line);
    PHASE = "T3";
    await press(s3.page);
    const script = [[8000, false], [18000, true], [26000, false], [36000, true], [44000, false], [54000, true]];
    let next = 0;
    r3 = await listen(s3.page, { secs: SECS, label: "T3 flicker", during: async (t) => {
      if (next < script.length && t >= script[next][0]) {
        const [ms, up] = script[next++];
        await s3.wire(up);
        return (up ? "up@" : "CUT@") + (ms / 1000) + "s";
      }
      return null;
    } });
    ok(r3.firstSoundMs != null, "sound through the flicker", "no sound in " + SECS + "s");
    ok(r3.gaps.length === 0, "no hole over 250 ms across three cuts",
      "longest " + r3.longest + "ms · " + JSON.stringify(r3.gaps));
    console.log("  requests: " + s3.wireSay("T3"));
    ok(s3.failedIn("T3").length === 0, "zero unanswered requests across three cuts",
      JSON.stringify(s3.failedIn("T3").slice(0, 10)));
    console.log("  readout: " + JSON.stringify(await lineOf(s3.page)));
    await s3.wire(true);
    await s3.ctx.close();
  }

  const N = (r, S, ph) => r && { firstSoundMs: r.firstSoundMs, longestHoleMs: r.longest,
    gapsOver250ms: r.gaps.length, peakRms: +r.peak.toFixed(4), bars: r.maxBar,
    unanswered: S.failedIn(ph).length, swRevalidateFails: S.revalIn(ph).length, samples: r.samples };
  console.log("\n" + (fails ? "FAIL " + fails + " of " + checks : "PASS " + checks + " checks"));
  console.log("SUMMARY " + JSON.stringify({ T1: N(r1, s1, "T1"), T2: N(r2, s2, "T2"), T3: N(r3, s3, "T3") }));
  await browser.close(); srv.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
