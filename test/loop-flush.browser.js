#!/usr/bin/env node
/* test/loop-flush.browser.js — DOES A LONG LOOP DRIFT, AND DOES A RESTART FLUSH?
 *
 *   node test/loop-flush.browser.js [--mins 3] [--quick] [--record "at=London&y=1969&s=1"]
 *
 * PAUL, 2026-09-03: *"after five minutes on safari desktop a little static creeps
 * in. i think when you restart a song you should basically flush everything and
 * start again. it happens on loop."*
 *
 * WHY THIS IS NOT test/soak-nukernel.js. The soak waits for a busy machine to
 * provide a hole and then reports what happened; its own header says an idle soak
 * is not a gate. This asks the OTHER half of the question — not "does the box
 * stall" but "WHAT DOES THE ENGINE DO WITH A STALL IT HAS ALREADY HAD" — and for
 * that it does not need a busy machine at all, because the engine carries the
 * stall as a test hook: `handle.__starve(sec)` holds the feed pump so the ring
 * genuinely runs dry through the same code path, the same counters and the same
 * reader. So phase A is DETERMINISTIC on any box, quiet or loaded, and it is the
 * one that bites.
 *
 * THE DEFECT IT PINS (measured 2026-09-03, this box, London 1969, quiet — load
 * average 3.3 — so none of it is contention):
 *
 *      healthy      runway 8.01s  keepUp 1.00  deficit 0.00s  backlog 0.0s  natLate -210ms
 *      __starve(16) runway 0.00s  keepUp 0.00  deficit 8.11s  backlog 12.8s natLate +549ms
 *      +30s later   runway 0.17s  keepUp 0.61  deficit 8.11s  backlog  9.1s natLate +550ms
 *
 * The deficit is the reader's output ledger minus the ring's consumed count, and
 * it never came back: ring-player.js does not advance a dry ring's R_READ but
 * always advances the global output cursor, so one hole permanently breaks the
 * identity "ring frame f sounds at global frame startGlobal + f". After it, the
 * engine's honest runway reads 0 for ever (so the box now runs on a ~0.2 s
 * cushion instead of 8 s — the first hole GUARANTEES the next one, which is
 * "static creeps in"), the pump's fed ledger overstates what has played so the
 * producer's backlog climbs without bound (58 s by minute five of an 8-minute
 * run), and `armNative` anchors every sampled voice and the whole kit against a
 * cursor seconds ahead of the audio, so a bar's notes clump at `now` instead of
 * spreading across the bar. Only a restart cleared it — which is exactly what
 * Paul found by ear. engine/faust/live/live.js "THE DEFICIT HEALS" is the fix and
 * this is its gate.
 *
 * PHASE B is the drift check Paul's sentence asks for literally: three minutes of
 * the record on loop, with the STANDING graph counted (a census over
 * BaseAudioContext's factory methods held in WeakRefs, so a collected node drops
 * out) and the OUTPUT ITSELF measured through an analyser interposed before
 * ctx.destination — because static is broadband energy that GROWS, and a gate
 * that reads the plan instead of the artifact would not see it. Minute 3 must
 * measure like minute 1, and a stop/start must return everything to baseline.
 *
 * SERVES ITSELF, for the reason test/soak-nukernel.js gives at length: without
 * COOP + COEP there is no SharedArrayBuffer, the ring engine never opens, and the
 * page demotes to a different engine with no conceal and no counters. The two
 * header lines are serve.sh:23,28 verbatim.
 */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MINS = +argOf("--mins", 3);
const QUICK = argv.includes("--quick");
const RECORD = argOf("--record", "at=London&y=1969&s=1");
const STARVE = +argOf("--starve", 16);
const JSONOUT = argOf("--json", "");

/* playwright, borrowed — there is no node_modules in this repo and none may be
   added (THE OFFLINE LAW); the explicit executablePath matters because
   chromium.launch() with no path resolves a build that is not installed here. */
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
  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".sf2": "application/octet-stream" };
function serve() {
  return new Promise((res, rej) => {
    const srv = http.createServer((req, rsp) => {
      const rel = decodeURIComponent(req.url.split("?")[0]);
      if (rel === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
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

/* ---------- the page-side instrument, installed before any script runs ------
   TWO THINGS, and the second one is the reason this is a browser gate at all.
   (1) A NODE CENSUS over BaseAudioContext's factory methods, each new node held
   in a WeakRef so a read can say how many are still reachable. AudioWorkletNode
   is deliberately NOT wrapped: a probe that replaces that class breaks
   faustwasm's generated node and reads the click monitor as dead (the 2026-08-24
   false bug report, docs in nukernel-deploy-and-probe).
   (2) AN ANALYSER interposed before ctx.destination, polled every 40 ms — the
   window is 2048 frames (~43 ms), so the coverage is near-continuous — with the
   bucket carrying rms, the HIGH BAND's share of the spectrum, sample-to-sample
   jumps over 0.30 and hard clips. Static is broadband energy that grows; a gate
   that read `hits` off the plan could not see any of it. */
const TAP = () => {
  window.__nodes = { made: {}, refs: [] };
  try {
    const P = window.BaseAudioContext ? BaseAudioContext.prototype : AudioContext.prototype;
    for (const m of Object.getOwnPropertyNames(P)) {
      if (!/^create[A-Z]/.test(m)) continue;
      if (m === "createMediaStreamDestination" || m === "createMediaElementSource") continue;
      const orig = P[m];
      if (typeof orig !== "function") continue;
      const kind = m.slice(6);
      P[m] = function () {
        const n = orig.apply(this, arguments);
        try { const M = window.__nodes.made; M[kind] = (M[kind] || 0) + 1;
              window.__nodes.refs.push([kind, new WeakRef(n)]); } catch (e) {}
        return n;
      };
    }
  } catch (e) {}
  window.__nodesLive = () => {
    const keep = [], live = {};
    for (const r of window.__nodes.refs) { if (!r[1].deref()) continue; keep.push(r); live[r[0]] = (live[r[0]] || 0) + 1; }
    window.__nodes.refs = keep;
    let tot = 0; for (const k in live) tot += live[k];
    // STANDING vs CHURN. BufferSource/Gain are the per-note lane (one source, one
    // envelope, per note) and they breathe with the bar; Analyser/Delay/
    // DynamicsCompressor are the channel strips, one per voice for the player's
    // life (sampler.js F4 hoist). A leak shows in the STANDING half.
    const standing = (live.Analyser || 0) + (live.Delay || 0) + (live.DynamicsCompressor || 0);
    return { live, total: tot, standing, made: Object.assign({}, window.__nodes.made) };
  };
  window.__life = { ctxMade: 0, ctxClosed: 0, wkMade: 0, wkTerm: 0 };
  try {
    const AC = window.AudioContext;
    function WrappedAC() { const c = new AC(...arguments); window.__life.ctxMade++;
      const cl = c.close.bind(c); c.close = function () { window.__life.ctxClosed++; return cl(); }; return c; }
    WrappedAC.prototype = AC.prototype; window.AudioContext = WrappedAC;
  } catch (e) {}
  try {
    const WK = window.Worker;
    function WrappedWK() { const w = new WK(...arguments); window.__life.wkMade++;
      const tm = w.terminate.bind(w); w.terminate = function () { window.__life.wkTerm++; return tm(); }; return w; }
    WrappedWK.prototype = WK.prototype; window.Worker = WrappedWK;
  } catch (e) {}
  window.__sab = { made: 0, bytes: 0, refs: [] };
  try {
    const SAB = window.SharedArrayBuffer;
    function WrappedSAB() { const b = new SAB(...arguments); window.__sab.made++; window.__sab.bytes += b.byteLength;
      try { window.__sab.refs.push(new WeakRef(b)); } catch (e) {} return b; }
    WrappedSAB.prototype = SAB.prototype; window.SharedArrayBuffer = WrappedSAB;
    window.__sabLive = () => { const keep = []; let n = 0, by = 0;
      for (const r of window.__sab.refs) { const b = r.deref(); if (!b) continue; keep.push(r); n++; by += b.byteLength; }
      window.__sab.refs = keep;
      return { made: window.__sab.made, live: n, liveMB: +(by / 1048576).toFixed(1) }; };
  } catch (e) { window.__sabLive = () => null; }

  window.__monDrain = () => null;
  const taps = new WeakMap(); let installing = false;
  const orig = AudioNode.prototype.connect;
  const install = (ctx) => {
    try {
      const an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0;
      an.connect(ctx.destination);
      const td = new Float32Array(an.fftSize), fd = new Float32Array(an.frequencyBinCount);
      const B = { n: 0, sumsq: 0, peak: 0, jumps: 0, clips: 0, hf: 0, tot: 0 };
      window.__monDrain = () => {
        const out = { frames: B.n, rms: B.n ? Math.sqrt(B.sumsq / (B.n * td.length)) : 0,
          peak: B.peak, jumps: B.jumps, clips: B.clips, hfShare: B.tot > 0 ? B.hf / B.tot : 0 };
        B.n = 0; B.sumsq = 0; B.peak = 0; B.jumps = 0; B.clips = 0; B.hf = 0; B.tot = 0;
        return out;
      };
      const binHz = ctx.sampleRate / an.fftSize, hf0 = Math.floor(9000 / binHz);
      setInterval(() => {
        try {
          an.getFloatTimeDomainData(td);
          let s = 0, pk = 0, j = 0, cl = 0, prev = td[0];
          for (let i = 0; i < td.length; i++) {
            const x = td[i]; s += x * x;
            const a = x < 0 ? -x : x; if (a > pk) pk = a; if (a > 0.999) cl++;
            const d = x - prev; if ((d < 0 ? -d : d) > 0.30) j++;
            prev = x;
          }
          B.n++; B.sumsq += s; if (pk > B.peak) B.peak = pk; B.jumps += j; B.clips += cl;
          if (s / td.length > 1e-8) {
            an.getFloatFrequencyData(fd);
            let hf = 0, tot = 0;
            for (let i = 1; i < fd.length; i++) { const p = Math.pow(10, fd[i] / 10); tot += p; if (i >= hf0) hf += p; }
            B.hf += hf; B.tot += tot;
          }
        } catch (e) {}
      }, 40);
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

const READ = () => {
  const h = (window.FaustLive && window.FaustLive.lastHandle) || null;
  const S = (fn, d) => { try { const v = fn(); return v == null ? d : v; } catch (e) { return d; } };
  const E = S(() => window.__nuEngine(), {});
  const an = S(() => h.__barAnchors(), []) || [];
  const late = an.slice(-24).map((a) => a.lateMs);
  const rw = S(() => h.__runway(), null);
  const prod = S(() => h.__producer(), null);
  return {
    route: E.route, ring: !!E.ring, state: E.state,
    runway: E.runwaySec, keepUp: E.keepUp,
    epi: (E.starve || {}).episodes | 0, quanta: (E.starve || {}).quanta | 0,
    deficit: E.ringDeficit | 0, healedSec: E.healedSec || 0, heals: E.heals || 0,
    clicks: E.clicks, backlogSec: rw ? rw.backlogSec : null, fedSec: rw ? rw.fedSec : null,
    prodRecent: prod && prod.recent && prod.recent.length
      ? +(prod.recent.reduce((a, b) => a + b, 0) / prod.recent.length).toFixed(3) : null,
    natLateMs: late.length ? +(late.reduce((a, b) => a + b, 0) / late.length).toFixed(1) : null,
    strips: (S(() => h.__samplerInserts(), []) || []).length,
    nodes: S(() => window.__nodesLive(), null),
    life: window.__life || null, sab: S(() => window.__sabLive(), null),
    heap: (performance.memory && performance.memory.usedJSHeapSize) || 0,
    mon: S(() => window.__monDrain(), null),
  };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MB = (b) => +(b / 1048576).toFixed(1);
/* COLLECT IN A DIFFERENT JOB FROM THE ONE THAT READS. A WeakRef whose target was
   `deref()`d is kept alive for the rest of that job by spec, so gc-then-read
   inside one evaluate reports every node the previous read touched as still
   live — measured, that is the difference between "standing while stopped = 10"
   and the truth, which is 2. Two collections in two separate turns, then the
   census in a third. */
const collect = async (page) => {
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => { try { if (window.gc) window.gc(); } catch (e) {} });
    await sleep(60);
  }
};
const checks = [];
const ck = (name, ok, note) => { checks.push([name, !!ok, note]); console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}  (${note})`); };

(async () => {
  if (!CHROME) { console.error("no chromium build found; set CHROME_PATH"); process.exit(2); }
  const srv = await serve();
  const base = "http://localhost:" + srv.port;
  console.log(`loop-flush · ${RECORD} · phase A starve ${STARVE}s · phase B ${QUICK ? "skipped" : MINS + " min"} · :${srv.port}`);
  const browser = await chromium.launch({ headless: true, executablePath: CHROME,
    /* --expose-gc IS LOAD-BEARING, not tidiness. `handle.stop()` disconnects the
       graph and defers `ctx.close()` + worker terminate by 1200 ms, so a census
       taken straight after a stop counts nodes that are unreachable and merely
       uncollected — measured, this gate read "standing while stopped = 19" and
       10 live rings until a GC was forced, and 2 and 5 the moment one was.
       A leak check that cannot tell "retained" from "not yet collected" is a
       leak check that fails on a healthy engine. (test/leak-procs.js reaches the
       same guarantee through measureUserAgentSpecificMemory, which forces a GC
       before it answers; that costs up to a minute per read, and this gate takes
       a dozen.) */
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage",
           "--enable-precise-memory-info", "--js-flags=--expose-gc"] });
  const page = await browser.newPage();
  await page.addInitScript(TAP);
  const cerr = [], perr = [];
  page.on("console", (m) => { if (m.type() === "error") cerr.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => perr.push(String(e).slice(0, 160)));
  const readNow = async () => { await collect(page); return page.evaluate(READ); };
  await page.goto(base + "/nukernel/index.html#" + RECORD, { waitUntil: "load", timeout: 120000 });
  await page.waitForSelector("#play", { state: "attached", timeout: 60000 });
  await sleep(2500);
  await page.click("#play");

  // WAIT FOR A HEALTHY RUNWAY, and say so if it never comes: every number below
  // is read against "the engine had 8 seconds and then lost them", so a box that
  // cannot prime in ninety seconds has not run this gate, it has run a different
  // one. That is a FAIL with its reason in the note, never a silent skip.
  let healthy = null;
  for (let i = 0; i < 90; i++) {
    healthy = await readNow();
    if (healthy.ring && healthy.runway > 4 && healthy.keepUp > 0.9 && healthy.epi === 0) break;
    await sleep(1000);
  }
  const rows = [{ tag: "baseline", ...healthy }];
  const say = (t, s) => console.log(`  ${t.padEnd(12)} runway=${String(s.runway).padStart(5)} keep=${String(s.keepUp).padStart(5)}`
    + ` epi=${String(s.epi).padStart(2)} deficit=${(s.deficit / 44100).toFixed(2)}s healed=${s.healedSec}s`
    + ` bklog=${s.backlogSec}s natLate=${s.natLateMs}ms strips=${s.strips}`
    + ` nodes=${s.nodes && s.nodes.total}/${s.nodes && s.nodes.standing} heap=${MB(s.heap)}MB clicks=${s.clicks}`);
  say("baseline", healthy);
  ck("the streaming engine, primed and clean",
    !!healthy.ring && healthy.runway > 4 && healthy.keepUp > 0.9 && healthy.epi === 0,
    `ring=${healthy.ring} runway=${healthy.runway} keepUp=${healthy.keepUp} epi=${healthy.epi}`);
  ck("nothing owed before the hole", healthy.deficit === 0 && healthy.healedSec === 0,
    `deficit=${healthy.deficit} healedSec=${healthy.healedSec}`);
  const baseLate = healthy.natLateMs;

  /* ---------- PHASE A: ONE HOLE, ON PURPOSE ---------- */
  console.log(`\n  -- forcing a ${STARVE}s starvation (handle.__starve) --`);
  await page.evaluate((s) => { try { window.FaustLive.lastHandle.__starve(s); } catch (e) {} }, STARVE);
  await sleep((STARVE + 3) * 1000);
  const hole = await readNow(); rows.push({ tag: "hole", ...hole });
  say("hole", hole);
  ck("the hole actually happened", hole.epi >= 1 && hole.quanta > 100,
    `episodes=${hole.epi} quanta=${hole.quanta} (${(hole.quanta * 128 / 44100).toFixed(2)}s dry)`);

  /* READ THE SERIES, NOT A SAMPLE. The runway is a SAWTOOTH and the soak next
     door spends a page saying so: the producer publishes one chord bar at a
     time, so the ring gains a whole bar at once and is eaten at 1.00 s per
     second in between — measured here, 8.16 / 7.75 / 2.18 over three healthy
     samples. A check on the last of those would fail on a healthy engine and
     pass on a sick one at the top of its tooth. So the claim is about the
     WINDOW: after the hole the runway must REACH its target again (before the
     fix it never exceeded 0.63 s in 105 s) and the backlog must COME BACK to a
     bar (before the fix it never fell below 9.07 s). */
  console.log("  -- and then it is left alone for 45s --");
  let after = hole; const heals = [];
  for (let i = 0; i < 3; i++) {
    await sleep(15000); after = await readNow(); heals.push(after);
    rows.push({ tag: "heal+" + (i + 1) * 15, ...after }); say("heal+" + (i + 1) * 15, after);
  }
  const bestRunway = Math.max(...heals.map((h) => h.runway || 0));
  const bestKeep = Math.max(...heals.map((h) => h.keepUp || 0));
  const leastBacklog = Math.min(...heals.map((h) => (h.backlogSec == null ? 99 : h.backlogSec)));

  // THE FOUR THINGS THE HOLE BROKE, EACH ASKED SEPARATELY — because before the
  // fix all four failed together and a single check could not say which repair
  // had stopped working.
  ck("A1 the deficit is repaid (ring frame f sounds at startGlobal + f again)",
    after.deficit <= 4410, `${(after.deficit / 44100).toFixed(3)}s still owed (was ${(hole.deficit / 44100).toFixed(2)}s at the hole)`);
  /* THE INVARIANT, AND IT IS AN EQUALITY. Every dry frame is one frame the
     output cursor took and the ring did not, so what the heal absorbs must equal
     what the reader concealed — measured against the CURRENT total (the box may
     have added holes of its own since the forced one, and those are dry frames
     too). A drift here is the repair missing a case, which is the only way this
     bug comes back. */
  const dryNow = after.quanta * 128 / 44100;
  ck("A2 what was absorbed equals what was concealed (healed == dry)",
    after.healedSec > 0 && Math.abs(after.healedSec - dryNow) < Math.max(0.3, dryNow * 0.12),
    `healedSec=${after.healedSec} dry=${dryNow.toFixed(3)} over ${after.epi} episodes, ${after.heals} repairs`);
  /* AND THE BOX HAS TO HAVE BEEN QUIET, WHICH IS A FACT THIS GATE CAN READ.
     A3 and A4 ask "did the engine get its cushion back", and a machine that is
     still starving on its own has not let it try — so the reason is NAMED rather
     than blamed on the repair. It is a FAIL and not a skip: a gate that goes
     green on a box too loaded to run it is the worse of the two lies. Run it
     alone (it is `solo` in test/all.js for this reason, the same reason
     commute is). */
  const newEpi = after.epi - hole.epi;
  const boxNoisy = newEpi > 0 ? ` — THE BOX ADDED ${newEpi} HOLE(S) OF ITS OWN in the window, so this run measured contention, not the repair; run it on an idle machine` : "";
  ck("A3 the runway comes back (the first hole must not guarantee the next)",
    bestRunway >= 6.0 && bestKeep >= 0.9,
    `the tooth reached ${bestRunway}s / keepUp ${bestKeep} in 45s (unhealed it never passed 0.63s)${boxNoisy}`);
  ck("A4 the producer's backlog returns to one bar",
    leastBacklog <= 2.5,
    `backlog came back to ${leastBacklog}s (unhealed it never fell below 9.07s)${boxNoisy}`);
  ck("A5 the native lane is anchored ahead of its bar again, not clumped at now",
    after.natLateMs != null && after.natLateMs < 100,
    `natLateMs=${after.natLateMs} (baseline ${baseLate}; +550 is the clump)`);

  /* ---------- PHASE B: THREE MINUTES ON LOOP ---------- */
  let m1 = null, m3 = null, loopRef = null;
  if (!QUICK) {
    console.log(`\n  -- ${MINS} minutes on loop: minute 1 against minute ${MINS} --`);
    await sleep(60000);
    m1 = await readNow(); rows.push({ tag: "min1", ...m1 }); say("min1", m1);
    await sleep((MINS - 1) * 60000);
    m3 = await readNow(); rows.push({ tag: "min" + MINS, ...m3 }); say("min" + MINS, m3);
    /* THE TOLERANCE IS THE DESK, NOT SLOPPINESS. A strip is rebuilt when its
       spec changes (sampler.js stripFor retires the old chain on an 8 s drain),
       so the compressor/filter count breathes by two or three across a section
       change; measured over an 8-minute run the standing count sat at 17-20 the
       whole way. A LEAK in this lane is one strip per NOTE — the 2026-08-27
       measurement was 97 gain nodes a second — so it arrives in the hundreds
       and four is a wall it cannot walk under. */
    ck("B1 the standing graph does not grow on a loop",
      m3.nodes.standing <= m1.nodes.standing + 4 && m3.strips <= m1.strips,
      `standing ${m1.nodes.standing}->${m3.nodes.standing}, strips ${m1.strips}->${m3.strips}`);
    ck("B2 no second engine was built behind your back",
      m3.life.ctxMade === m1.life.ctxMade && m3.life.wkMade === m1.life.wkMade && m3.sab.live === m1.sab.live,
      `ctx ${m1.life.ctxMade}->${m3.life.ctxMade} workers ${m1.life.wkMade}->${m3.life.wkMade} rings ${m1.sab.live}->${m3.sab.live}`);
    ck("B3 the heap is flat", m1.heap > 0 && m3.heap <= 1.25 * m1.heap,
      `${MB(m1.heap)}MB -> ${MB(m3.heap)}MB`);
    ck("B4 the noise floor did not creep up (broadband energy, off the output)",
      m1.mon && m3.mon && m1.mon.hfShare > 0 && m3.mon.hfShare <= Math.max(0.05, m1.mon.hfShare * 2.5) && m3.mon.clips === 0,
      `hfShare ${(m1.mon.hfShare * 100).toFixed(3)}% -> ${(m3.mon.hfShare * 100).toFixed(3)}%, clips ${m3.mon.clips}`);
    ck("B5 the deficit stays repaid across the whole loop", m3.deficit <= 4410,
      `${(m3.deficit / 44100).toFixed(3)}s owed at minute ${MINS}`);
    loopRef = m3;
  }

  /* ---------- THE RESTART: Paul's own remedy, measured ---------- */
  console.log("\n  -- stop / start (#play, the one transport door) --");
  const tStop = Date.now();
  await page.click("#play");
  await sleep(2500);
  const stopped = await readNow(); rows.push({ tag: "stopped", ...stopped });
  console.log(`  stopped      nodes=${stopped.nodes.total} standing=${stopped.nodes.standing} rings=${stopped.sab.live} heap=${MB(stopped.heap)}MB`);
  const tGo = Date.now();
  await page.click("#play");
  let backMs = null;
  for (let i = 0; i < 900; i++) {
    const c = await page.evaluate(() => { try { const h = window.FaustLive.lastHandle; return h && h.readCursor ? h.readCursor() : 0; } catch (e) { return 0; } });
    if (c > 0) { backMs = Date.now() - tGo; break; }
    await sleep(100);
  }
  let re = null;
  for (let i = 0; i < 60; i++) { re = await readNow(); if (re.runway > 4 && re.keepUp > 0.9) break; await sleep(1000); }
  rows.push({ tag: "restarted", ...re }); say("restarted", re);
  console.log(`  first sample back ${backMs} ms after the second press`);
  /* THE FLUSH, AS THREE FACTS ABOUT THE OLD RUN rather than one absolute. The
     graph must COME DOWN (the standing strips of the run that just ended are
     gone, not merely quiet), every context but the live one must be closed, and
     the ring SharedArrayBuffers must not accumulate a generation per press —
     that last one is the 2026-08-28 leak (20.2 MB a generation, 70 -> 184 MB
     across four record changes) and it is the reason this is measured and not
     assumed. `standing` is compared against the run that just ended rather than
     against 0, because the deferred `ctx.close()` is 1200 ms and the census is
     a WeakRef sweep, not a promise. */
  const wasStanding = (loopRef || hole).nodes.standing;
  ck("C1 a restart flushes: no engine of the old run survives",
    stopped.nodes.standing <= Math.max(4, Math.round(wasStanding * 0.35))
      && re.life.ctxClosed === re.life.ctxMade - 1
      && re.sab.live <= (loopRef || hole).sab.live,
    `standing ${wasStanding} playing -> ${stopped.nodes.standing} stopped; ctx ${re.life.ctxClosed}/${re.life.ctxMade - 1} closed;`
    + ` live rings ${(loopRef || hole).sab.live} -> ${re.sab.live} (a leak here is one generation per press)`);
  ck("C2 a restart re-primes to minute-0 health",
    re.epi === 0 && re.deficit === 0 && re.healedSec === 0 && re.runway >= 4 && re.keepUp >= 0.9,
    `epi=${re.epi} deficit=${re.deficit} healed=${re.healedSec} runway=${re.runway} keepUp=${re.keepUp}`);
  ck("C3 the restart seam costs no more than a cold start",
    backMs != null && backMs <= 30000, `first sample back after ${backMs} ms (the 8 s prefill is most of it)`);
  ck("C4 the page said nothing broken", cerr.length === 0 && perr.length === 0,
    `console=${cerr.length} pageerror=${perr.length}`);

  await browser.close(); srv.close();
  for (const e of cerr.slice(0, 6)) console.log("    cerr " + e);
  for (const e of perr.slice(0, 6)) console.log("    perr " + e);
  if (JSONOUT) fs.writeFileSync(JSONOUT, JSON.stringify({ record: RECORD, rows, checks, cerr, perr }, null, 1));
  const bad = checks.filter(([, ok]) => !ok);
  console.log(`\n  ${bad.length ? "loop-flush FAILED: " + bad.map(([n]) => n).join("; ") : "loop-flush PASSED (" + checks.length + " checks)"}`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
