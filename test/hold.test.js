#!/usr/bin/env node
// test/hold.test.js — THE HOLD, MEASURED WITH THE WIRE CUT.
//
//   node test/hold.test.js [--secs 60] [--keep-open]
//
// PAUL, 2026-08-27, FROM A TRAIN: "Please cache everything you need to play one
// song it keeps cutting out while I'm going into tunnels on the train."
//
// This gate exists because the cut-out had a cause nothing on the page could
// see. The record's SAMPLES were held (audio/offline.js warmCache) and THE CODE
// THE CAST RESOLVES TO WAS NOT: measured on this page before the fix, changing
// the record to London 1985 and pressing play sent 29 requests to the network
// that were in no cache — juno60, solina, oberheim, stk_guitar, voice_lead,
// voice_choir, kick909, snare_clap, hat_metal, insert_chorus, insert_leslie,
// insert_higain, reverb_dattorro, rev_bleed, each as `-module.wasm` +
// `-meta.json`. In a tunnel every one of those fails and the voices never seat.
//
// WHY IT IS A BROWSER GATE AND NOT A NODE ONE. Every part of the fact under
// test lives in the artifact: the service worker only holds what goes THROUGH
// it, the render worker fetches on its own thread, and "it kept playing" is a
// claim about audio. So this serves the tree with COOP/COEP itself (the two
// headers decide which engine opens — test/soak-nukernel.js:1 for why), drives
// the page through its own doors, and reads an AnalyserNode interposed before
// ctx.destination. Nothing is asserted from a counter that the code under test
// also writes: the hold's ledger is CHECKED AGAINST Cache Storage, and the
// music is measured off the output.
//
// WHAT IS ASSERTED
//   H1  a record chosen on the atlas reaches "held — plays offline", and every
//       url its ledger names is really in a Cache Storage cache.
//   H2  press-play online after the hold sends NOTHING to the network but the
//       browser's own sw.js update check.
//   H3  wire cut BEFORE play: the record plays for the whole run with no silent
//       gap over 250 ms, no failed request, and the playhead reaches the end of
//       the record and comes round.
//   H4  the harder case: with the wire still cut, CHANGE to a genre held
//       earlier — it still plays.
//   H5  the honest negative: with the wire cut, a genre never visited REFUSES
//       IN WRITING — the engine sentence names what would not come and never
//       claims "held".
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SECS = +argOf("--secs", 60);          // the floor; the run goes on to the end of the record
const MAXSECS = +argOf("--max", 240);

/* ---------- playwright, borrowed (THE OFFLINE LAW: no node_modules here) ---------- */
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
    srv.listen(0);                                 // never fight ./serve.sh for 8777
  });
}

/* ---------- the ear: an AnalyserNode before ctx.destination ------------------ */
// Interposed by patching AudioNode.prototype.connect, NOT by replacing
// AudioWorkletNode — the soak's own note (audio/live.js health()) records that
// stubbing that class is what made a previous probe read rms 0 through two
// twelve-minute runs and call a live detector blind.
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

/* ---------- the page's own doors -------------------------------------------- */
// THE GLOBE'S TAP IS pointerdown/pointerup (drag versus tap), so a synthetic
// MouseEvent reaches nothing — measured, it changed no record and the gate
// silently tested the same song twice. The mark's keyboard door is the same
// choose(): ui/atlas.js:1270.
const choose = (page, name) => page.evaluate((n) => {
  const g = document.querySelector('.place[data-place="' + n + '"]');
  if (!g) return "no mark for " + n;
  if (g.focus) g.focus();
  g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  return "ok";
}, name);
/* STANDING AT A YEAR, THROUGH THE INSTRUMENT THAT IS ACTUALLY THERE
   (rewritten 2026-09-02). What stood here:

     "#atlasWhen is a DIV WRAPPING the input; setting .value on it is a silent
      no-op (the harness note in [[nukernel-deploy-and-probe]]). #atlasYear is
      the input, and it needs the native setter to fire ui/atlas.js's listener."

   Every word of that was true of a control ui/atlas.js DELETED on 2026-08-29 —
   Paul: *"Get rid of the time slider. Make the genre list permanent and always
   expanded. As I slide it light up the map with places."* The tombstone in
   atlas.js is explicit that the FACT survived and only the control went: "`yi`
   is still the state … What moves the year now, and there is nothing else: THE
   LIST, AS YOU SCROLL IT (`sweep()`) … a row you press … `showing()`". So this
   gate had been waiting sixty seconds for `#atlasYear` and dying of a timeout
   before its first check, which is a gate testing a page that no longer exists.

   The list IS the instrument, so the gate scrolls the list — `sweep()` reads
   the row nearest the middle of `#atlasIndex` and hands it to the same
   `setYear()` the slider used to call, so this drives exactly one door further
   out than the old helper did. It lands NEAR the year asked for rather than ON
   it (the middle of a 410-row list is a band of years, not a stop), so the
   caller reads the year back off `#atlasSay` instead of assuming it — which is
   what the gate wanted anyway: three records standing at one year. */
const standAt = (page, year) => page.evaluate((y) => {
  const box = document.getElementById("atlasIndex");
  const rows = [...document.querySelectorAll("#atlasIndexRows li[data-year]")]
    .filter((n) => +n.dataset.year === y);
  if (!box || !rows.length) return "no row at " + y;
  const mid = rows[Math.floor(rows.length / 2)];
  box.scrollTop = mid.offsetTop - box.clientHeight / 2 + mid.offsetHeight / 2;
  box.dispatchEvent(new Event("scroll", { bubbles: true }));
  return box.scrollTop;
}, year);
const holdOf = (page) => page.evaluate(() => (window.__nuHold ? window.__nuHold() : null));
const lineOf = (page) => page.evaluate(() => (window.__nuEngineLine ? window.__nuEngineLine() : null));
const mixOf = (page) => page.evaluate(() => { try { return window.__nuMix ? window.__nuMix() : null; } catch (e) { return null; } });
/* THE WORD ON THE TRANSPORT, NOT THE GLYPH BESIDE IT (rewritten 2026-09-02).
   This took the button's whole `textContent` and the three call sites compared
   it to "play". Wave 1a moved the transport into the foot and gave it a FACE —
   `paintIcon` writes the glyph and then the `.nu-vh` word into the same button
   — so the text is "▶play" and never equalled "play" again: every one of the
   three sites took its other branch, and the two that press twice to reach
   "playing" were pressing play and then STOP. Measured 2026-09-02: `#play`
   textContent "▶play", aria-label "play", `.nu-vh` "play". The word is read
   where the word is; the glyph is aria-hidden and is not the answer to "what
   will this button do". (The same repair, on the same day, is in
   test/commute.test.js, which had the same helper.) */
const playLabel = (page) => page.evaluate(() => {
  const e = document.getElementById("play");
  if (!e) return "";
  const vh = e.querySelector(".nu-vh");
  return String((vh && vh.textContent) || e.getAttribute("aria-label") ||
                e.textContent || "");
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fails = 0, checks = 0;
const ok = (cond, what, detail) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return true; }
  fails++; console.log("  FAIL " + what + (detail ? "\n         " + detail : ""));
  return false;
};

async function waitHeld(page, secs, label) {
  const t0 = Date.now();
  let h = null;
  while (Date.now() - t0 < secs * 1000) {
    h = await holdOf(page);
    if (h && h.want && !h.queued && !h.running) break;
    await sleep(250);
  }
  // the ledger without its url list, which is 60 lines of noise in a log and
  // is checked against Cache Storage below rather than read by eye
  const brief = h ? { ...h, urls: undefined } : null;
  console.log(`  ${label}: ${JSON.stringify(brief)} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return h;
}

// PLAY AND LISTEN. Returns the run's numbers: the gaps in the sound, where the
// playhead got to, and whether the record came round to its start again.
async function listen(page, { secs, until, label }) {
  const S = [];
  const t0 = Date.now();
  let lastBar = -1, maxBar = -1, wrapped = false, firstSoundMs = null, si = -1, maxSi = -1;
  while (Date.now() - t0 < (until || secs) * 1000) {
    const v = await page.evaluate(() => ({ rms: window.__tapRms ? window.__tapRms() : -1,
      mix: (() => { try { return window.__nuMix ? { si: window.__nuMix().si, bar: window.__nuMix().bar } : null; } catch (e) { return null; } })() }));
    const t = Date.now() - t0;
    S.push({ t, rms: v.rms });
    if (firstSoundMs == null && v.rms > 0.002) firstSoundMs = t;
    if (v.mix) {
      if (v.mix.bar != null && v.mix.bar >= 0) {
        if (lastBar >= 0 && v.mix.bar < lastBar && maxBar >= 1) wrapped = true;
        lastBar = v.mix.bar; if (v.mix.bar > maxBar) maxBar = v.mix.bar;
      }
      if (v.mix.si != null) { si = v.mix.si; if (si > maxSi) maxSi = si; }
    }
    if (wrapped && Date.now() - t0 >= secs * 1000) break;
    await sleep(100);
  }
  // GAPS ARE COUNTED FROM THE FIRST SOUND, never from the click: the engine's
  // own prefill is silence by design (audio/live.js "the start-up fix buys its
  // zero holes with SILENCE"), and counting it as a dropout would make every
  // run fail for the thing that stops runs failing.
  const gaps = []; let run = 0, at = 0;
  for (const s of S) {
    if (firstSoundMs == null || s.t < firstSoundMs) continue;
    if (s.rms < 0.002) { if (!run) at = s.t; run += 100; }
    else { if (run > 250) gaps.push({ ms: run, at }); run = 0; }
  }
  if (run > 250) gaps.push({ ms: run, at });
  const peak = S.reduce((m, s) => Math.max(m, s.rms), 0);
  console.log(`  [${label}] ${((Date.now() - t0) / 1000).toFixed(0)}s · first sound ${firstSoundMs == null ? "never" : (firstSoundMs / 1000).toFixed(1) + "s"}`
    + ` · peak rms ${peak.toFixed(4)} · gaps>250ms ${gaps.length} ${JSON.stringify(gaps.slice(0, 8))}`
    + ` · bars 0..${maxBar}${wrapped ? " (came round)" : ""} · sections 0..${maxSi}`);
  return { gaps, peak, firstSoundMs, maxBar, wrapped, maxSi, samples: S.length };
}

(async () => {
  if (!CHROME) { console.error("no chromium build found; set CHROME_PATH"); process.exit(2); }
  const srv = await serve();
  const base = "http://localhost:" + srv.port;
  const URL0 = base + "/nukernel/index.html";
  console.log("hold gate · " + ROOT + " on :" + srv.port + " with COOP:same-origin + COEP:require-corp");

  const browser = await chromium.launch({ headless: true, executablePath: CHROME,
    args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  const page = await ctx.newPage();
  await page.addInitScript(TAP);
  const failed = [];
  page.on("requestfailed", (r) => failed.push({ phase: PHASE, url: r.url().replace(base, ""), err: (r.failure() || {}).errorText }));
  const failedIn = (ph) => failed.filter((f) => f.phase === ph);

  // ── the first visit installs the worker; the second is the one under test.
  // A worker takes control AFTER the page that installed it has already
  // fetched itself, so visit one can never be the offline case.
  /* THE BOX BOOTS ON THE BLANK STATE (2026-09-02). Paul, the composer round:
     *"Add a 'silence' genre at the top of the genre list. This is a blank
     state."* — one eight-bar section, ZERO voices, one cell of rests. This gate
     is about a record with a band in it, so it names one in the address, the way
     a link does: the shipped chant, at seed 1 because the boot draws a seed now
     (*"Boot up every new session with a new seed unless there's a seed in the
     URL"*) and a gate that re-rolled its own subject would measure a different
     record every run. */
  await page.goto(URL0 + CHANT, { waitUntil: "load", timeout: 120000 });
  await sleep(8000);
  PHASE = "visit2";
  await page.goto(URL0, { waitUntil: "load", timeout: 120000 });
  await sleep(9000);

  // ── choose a record on the atlas, through the page's own doors. The globe is
  // built after boot, so WAIT FOR THE CONTROL rather than for a number of
  // seconds — a gate that sets .value on a null is a gate that tests nothing.
  // state "attached", not "visible": the axis may be scrolled away or folded,
  // and the gate drives the control rather than looking at it.
  /* THE WHERE TAB HAS TO BE OPEN. A shut panel is `[data-off]` and `inert`, so
     its rows have a zero rect and `#atlasIndex` has no scroll to drive — the
     probe of 2026-09-02 measured exactly that ("li[data-gk] has a zero rect off
     the Where tab (correct)"). `__eightTab` is the same call the stripe's own
     button makes. */
  await page.evaluate(() => { if (window.__eightTab) window.__eightTab("Where"); });
  await page.waitForSelector("#atlasIndexRows li[data-year]", { state: "attached", timeout: 60000 });
  await page.waitForSelector(".place", { state: "attached", timeout: 60000 });
  console.log("  stand at 1985: " + JSON.stringify(await standAt(page, 1985)));
  // the sweep settles at 120 ms and then paints; 1.5 s is two of those
  await sleep(1500);
  const say = await page.evaluate(() => document.getElementById("atlasSay").textContent);
  const names = say.split("·").pop().split(",").map((x) => x.trim()).filter((x) => x && !/more$/.test(x));
  const at = (say.split("·")[0] || "").trim();
  console.log("\n" + say);
  const A = names[0], B = names[1], C = names[2];
  ok(!!(A && B && C), "three records to work with at " + at, say);

  console.log("\nH1 — the hold");
  PHASE = "holdA";
  console.log("  choose " + A + ": " + await choose(page, A));
  await sleep(1500);
  const hA = await waitHeld(page, 90, "hold(" + A + ")");
  ok(!!hA && hA.line === "held — plays offline", "the sentence says held", hA && hA.line);
  ok(!!hA && hA.modules > 0, "the record's own Faust modules are in the set", hA && ("modules=" + (hA && hA.modules)));
  ok(!!hA && hA.lost.length === 0, "nothing was lost", JSON.stringify(hA && hA.lost));
  // THE LEDGER, CHECKED AGAINST THE ARTIFACT. `held` is the hold's own count;
  // Cache Storage is where the tunnel will actually look.
  const missCache = await page.evaluate(async () => {
    const rep = window.__nuHold ? window.__nuHold() : null;
    if (!rep) return ["no ledger"];
    const out = [];
    for (const u of (rep.urls || [])) if (!(await caches.match(u))) out.push(new URL(u).pathname);
    return out;
  });
  ok(Array.isArray(missCache) && missCache.length === 0,
    "every url the ledger names is really in Cache Storage",
    JSON.stringify(missCache).slice(0, 400));

  console.log("\nH2 — press play online: nothing NEW goes to the wire");
  // The worker rides stale-while-revalidate for app code, so a background
  // refresh of a file it ALREADY HOLDS is expected and costs a tunnel nothing —
  // the hit returns from cache and the refresh fails silently. What must be
  // zero is a request for something the cache does not have.
  const cachedNow = new Set(await page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys())
      for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
    return out;
  }));
  PHASE = "playA";
  if ((await playLabel(page)).trim() === "play") await page.click("#play");
  await sleep(12000);
  const onlineNew = [...new Set(HITS.filter((h) => h.phase === "playA").map((h) => h.url))]
    .filter((u) => u !== "/sw.js" && !cachedNow.has(u));   // sw.js is the browser's own update check
  ok(onlineNew.length === 0, "nothing outside the cache went to the network at press-play",
    JSON.stringify(onlineNew).slice(0, 500));
  /* THE PAINTED SENTENCE, WHERE IT IS PAINTED (rewritten 2026-09-02). This read
     `#engine`, an element index.html DELETED on 2026-08-28 — Paul: *"Get rid of
     the media (mediaEl) held plays offline etc section on the top; move that
     info to the logger."* Its tombstone is explicit that every clause of the
     old contract survived the move ("the sentence still has exactly one owner —
     `engineLine()` in audio/live.js … It is still outside #app"), so the claim
     is unchanged and only its ADDRESS moved: `#nu-log`, written by ui/eight.js
     `logEngine`. The log is PAINTED only while it is open (`addRow` returns
     early otherwise, which is the frozen-page discipline working), so the gate
     opens it through the page's own door — `__nuLogOpen` is the call the ¶
     button makes — and asks a reader's question with a reader's gesture.
     (test/commute.test.js carries the same repair, made the same day.) */
  const domLine = await page.evaluate(() => {
    try { if (window.__nuLogOpen) window.__nuLogOpen(true); } catch (e) {}
    return (document.getElementById("nu-log") || {}).textContent || "";
  });
  ok(/held — plays offline/.test(domLine), "the painted sentence carries the hold", domLine);

  // ── SETTLE THE PAIR, and hold both. Choosing a mark moves the atlas year TO
  // THAT RECORD'S YEAR, so the same place answers with a different genre the
  // second time (measured: London 1985 synthduo, then Manchester 1984
  // janglepop, then London *1983* synthsoul). A→B→A→B settles: the third pick
  // and the fifth are the same record. So the gate holds the SETTLED pair and
  // names the genre it holds, or H4 would silently test a genre nobody held.
  const genreNow = async () => {
    const t = await page.evaluate(() => document.getElementById("atlasSay").textContent);
    const m = /·\s([a-z0-9_]+)\s—/.exec(t);
    return m ? m[1] : t.slice(0, 40);
  };
  const holds = {};
  for (const [i, n] of [B, A, B].entries()) {
    PHASE = "settle" + i;
    await choose(page, n); await sleep(1500);
    const h = await waitHeld(page, 90, "hold(" + n + ")");
    holds[n] = { g: await genreNow(), held: !!(h && h.line === "held — plays offline"), want: h && h.want };
    console.log("  " + n + " → " + holds[n].g + " · " + (h && h.line));
  }
  PHASE = "settleA";
  await choose(page, A); await sleep(1500);
  const hA2 = await waitHeld(page, 90, "hold(" + A + ") settled");
  const gA = await genreNow();
  console.log("  " + A + " → " + gA + " · " + (hA2 && hA2.line));
  ok(!!hA2 && hA2.line === "held — plays offline", "the settled first record is held", hA2 && hA2.line);
  ok(!!holds[B] && holds[B].held, "the settled second record is held (H4 needs it)", JSON.stringify(holds[B]));

  console.log("\nH3 — CUT THE WIRE, then play " + A + " (" + gA + ")");
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await ctx.setOffline(true);
  PHASE = "offA";
  if ((await playLabel(page)).trim() !== "play") { await page.click("#play"); await sleep(500); }
  await page.click("#play");
  const rA = await listen(page, { secs: SECS, until: MAXSECS, label: "offline · " + A });
  ok(rA.firstSoundMs != null, "the record starts with the wire cut", "no sound in " + MAXSECS + "s");
  ok(rA.gaps.length === 0, "no silent gap over 250 ms", JSON.stringify(rA.gaps));
  const offHits = [...new Set(HITS.filter((h) => h.phase === "offA").map((h) => h.url))].filter((u) => u !== "/sw.js");
  ok(offHits.length === 0, "no request reached the server", JSON.stringify(offHits));
  ok(failedIn("offA").length === 0, "zero failed requests", JSON.stringify(failedIn("offA").slice(0, 8)));
  ok(rA.wrapped, "the record reached its end and came round",
    "got to bar " + rA.maxBar + " of the record in " + MAXSECS + "s");
  ok(/held — plays offline/.test(await lineOf(page)), "still says held while offline", await lineOf(page));

  console.log("\nH4 — with the wire still cut, change to " + B + " (" + (holds[B] || {}).g + ", held earlier)");
  PHASE = "offB";
  await choose(page, B);
  await sleep(5000);
  const gB = await genreNow();
  ok(gB === (holds[B] || {}).g, "it is the same genre that was held online",
    "held " + (holds[B] || {}).g + ", got " + gB);
  console.log("  hold(" + B + ") offline: " + JSON.stringify(((await holdOf(page)) || {}).line));
  if ((await playLabel(page)).trim() === "play") await page.click("#play");
  const rB = await listen(page, { secs: 30, label: "offline · " + B });
  ok(rB.firstSoundMs != null, "a held genre still plays with the wire cut", "no sound in 30s");
  ok(rB.gaps.length === 0, "no silent gap over 250 ms on the second record", JSON.stringify(rB.gaps));
  ok(failedIn("offB").length === 0, "zero failed requests", JSON.stringify(failedIn("offB").slice(0, 8)));

  console.log("\nH5 — with the wire cut, a genre never visited must refuse in writing");
  PHASE = "offC";
  // NOT the C the gate picked at the top, and NOT #atlasSay either: once a
  // record is chosen that line says what the record IS ("Manchester 1983 ·
  // dancepostpunk — 10 sections"), not which places are on the map. The marks
  // themselves are the list — a mark the year does not hold is display:none
  // (ui/atlas.js) and would refuse the tap.
  const here = await page.evaluate(() => [...document.querySelectorAll(".place[data-place]")]
    .filter((g) => getComputedStyle(g).display !== "none").map((g) => g.dataset.place));
  const C2 = here.filter((n) => n !== A && n !== B)[0] || C;
  console.log("  marks the year holds: " + here.join(", "));
  console.log("  choose " + C2 + ": " + await choose(page, C2));
  await sleep(6000);
  const hC = await holdOf(page);
  const lineC = await lineOf(page);
  console.log("  hold(" + C2 + "): " + JSON.stringify({ ...(hC || {}), urls: undefined }));
  console.log("  sentence: " + JSON.stringify(lineC));
  ok(!!hC && hC.lost.length > 0, "the hold knows it could not get this record", JSON.stringify(hC && hC.lost).slice(0, 200));
  ok(!/held — plays offline/.test(lineC || ""), "it does NOT claim to be held", lineC);
  ok(/would not come/.test(lineC || ""), "it names what would not come, in the engine sentence", lineC);

  console.log("\n" + (fails ? "FAIL " + fails + " of " + checks : "PASS " + checks + " checks"));
  await browser.close(); srv.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
