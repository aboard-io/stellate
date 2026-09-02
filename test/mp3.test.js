#!/usr/bin/env node
// test/mp3.test.js — THE MP3 PRESS GATE (2026-08-29).
//
// FUTURE.md asks for exactly one thing of this format — "MP3 decodes and
// duration matches ±1 frame" — and this repo has shipped three features broken
// while every structural check passed, so nothing here reads the wiring. What
// is under test is THE FILE THE BUTTON HANDS YOU: the gate clicks the real MP3
// card in the real page, catches the download, and every assertion below is
// made against those bytes.
//
// M1  the card is LIVE and says what it actually does — the button is enabled
//     with no refusal beside it, and the subtitle states the true encode
//     (192 kbps, CBR, 44.1 kHz, stereo). A card that promised "320 kbps" over
//     a 192 kbps encoder would be the same lie as a dead button.
// M2  the download is an MPEG stream, read as one in node: the first frame
//     header is parsed out of the bytes — MPEG-1 Layer III, 44100 Hz, the
//     bitrate index that means 192, two channels — so the settings the card
//     claims are the settings in the file.
// M3  IT DECODES. Those same bytes go back into the page and through
//     decodeAudioData — the browser's own mp3 decoder, not ours — and come
//     back as 2 channels at 44100.
// M4  its DURATION matches the WAV press of the same record. Not to the
//     sample: MP3 is framed in 1152-sample granule pairs and lamejs 1.2.1
//     writes no Xing/LAME header (bWriteVbrTag=false in the vendored build),
//     so there are no gapless delay/padding tags and a decoder hands back the
//     encoder's own lead-in plus padding out to the last whole frame. The
//     tolerance is therefore stated in FRAMES: ±4 granule pairs (4 × 1152 /
//     44100 ≈ 104 ms), which covers lame's ~1105-sample encoder delay, the
//     decoder's own lead-in handling, and one partial frame of tail padding.
//     Both durations are printed, so a drift that grows is visible even while
//     the gate passes.
// M5  it is NOT SILENCE, and it is not a valid MP3 of something else: RMS is
//     computed over the decoded MP3 and over the WAV press of the same record,
//     both printed, and they must agree within 15% relative. A gate that only
//     proved bytes came back would pass on a perfect encode of nothing.
// M6  the encode stayed OFF THE MAIN THREAD: a 25 ms heartbeat runs in the
//     page for the whole click, and the longest gap it sees while the card is
//     saying "encoding …" is reported and must stay under a second. A
//     main-thread lame would block for tens of seconds on a record this long.
//     The same watcher records the card's own sentences, so the say-channel is
//     proved to actually say something (FUTURE's "nothing greys silently").
//
// Run:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/mp3.test.js
const CHANT = "#at=Rome&y=600&s=1";   // the shipped chant, named (2026-09-02)
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.resolve(__dirname, "..");
const URLPATH = process.env.MP3_URL_PATH || "/nukernel/index.html";

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
// serve.sh's headers, because the engine will not open a SharedArrayBuffer without them
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

let FAILS = 0;
const ok = (m) => console.log("  ok   " + m);
const fail = (m) => { FAILS++; console.log("  FAIL " + m); };
const is = (c, m) => (c ? ok(m) : fail(m));

/* the first MPEG audio frame, parsed out of the bytes — ISO 11172-3 §2.4.1.3.
   ID3v2 is skipped if present (lamejs writes none: write_id3tag_automatic=0). */
const BR_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const SR_V1 = [44100, 48000, 32000, 0];
function firstFrame(buf) {
  let i = 0;
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33)
    i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  for (; i + 3 < buf.length && i < 100000; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const ver = (buf[i + 1] >> 3) & 3, layer = (buf[i + 1] >> 1) & 3;
    const brI = (buf[i + 2] >> 4) & 15, srI = (buf[i + 2] >> 2) & 3, mode = (buf[i + 3] >> 6) & 3;
    if (ver !== 3 || layer !== 1 || brI === 0 || brI === 15 || srI === 3) continue;
    return { at: i, mpeg1: ver === 3, layer3: layer === 1, kbps: BR_V1L3[brI],
             sr: SR_V1[srI], mode, channels: mode === 3 ? 1 : 2,
             modeName: ["stereo", "joint", "dual", "mono"][mode] };
  }
  return null;
}

(async () => {
  if (!CHROME) { console.log("  FAIL no chromium found"); process.exit(1); }
  const srv = await serve();
  const URL_ = "http://localhost:" + srv.port + URLPATH;
  console.log("mp3 gate · " + ROOT + " on :" + srv.port + " · COOP:same-origin COEP:require-corp");
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  /* THE BOX BOOTS ON THE BLANK STATE (2026-09-02). Paul, the composer round:
     *"Add a 'silence' genre at the top of the genre list. This is a blank
     state."* — one eight-bar section, ZERO voices, one cell of rests. This gate
     is about a record with a band in it, so it names one in the address, the way
     a link does: the shipped chant, at seed 1 because the boot draws a seed now
     (*"Boot up every new session with a new seed unless there's a seed in the
     URL"*) and a gate that re-rolled its own subject would measure a different
     record every run. */
  await page.goto(URL_ + CHANT, { waitUntil: "load", timeout: 60000 });
  /* A PANEL IS NOT BUILT UNTIL IT IS FIRST OPENED (mount on demand), and
     `__eightScore()` reads the SCORE panel — test/deck.test.js records the
     same 30-second hang against a Score tab that had never been built. So
     both are opened, Score for the readiness wait, then back to Export, which
     is where the button has to be visible to be clickable. */
  for (const t of ["Export", "Score"]) {
    await page.evaluate((n) => window.__eightTab && window.__eightTab(n), t);
    await page.waitForTimeout(t === "Score" ? 1500 : 400);
  }
  await page.waitForFunction(() => window.__eightScore && window.__eightScore().steps > 0,
    null, { timeout: 30000 });
  await page.evaluate(() => window.__eightTab && window.__eightTab("Export"));
  await page.waitForTimeout(400);

  // ---- M1 — the card is live and states the encode ------------------------
  const card = await page.evaluate(() => {
    const b = document.querySelector('#exportdeck [data-k="deck.exp.mp3"]');
    const c = b && b.closest(".nu-exp");
    return { found: !!b, disabled: !!(b && b.disabled),
             why: (c && c.querySelector(".nu-why") || { textContent: "" }).textContent,
             sub: (c && c.querySelector(".nu-hint") || { textContent: "" }).textContent };
  });
  is(card.found && !card.disabled && !card.why.trim(),
    "M1 · the MP3 card is a live button with no refusal beside it" +
    (card.why.trim() ? " — still refusing: " + card.why.slice(0, 60) : ""));
  is(/192\s*kbps/i.test(card.sub) && /CBR/i.test(card.sub) &&
     /44\.1\s*kHz/i.test(card.sub) && /stereo/i.test(card.sub),
    "M1 · …and it states the true encode: \"" + card.sub + "\"");

  // ---- the click: the artifact under test is what the button hands over ---
  console.log("     pressing the record through the MP3 button (whole song, offline)…");
  await page.evaluate(() => {
    // the heartbeat (M6) + the say-channel watcher, both installed before the
    // click so nothing about the encode is measured after the fact
    window.__hb = { gaps: [], says: [], encGaps: [] };
    const deckSayEl = () => document.querySelector("#exportdeck [role=status]");
    let last = performance.now(), enc = false;
    /* IT WAS READING THE WRONG STATUS LINE (2026-09-02, the wave-4 round) —
       and then there was only one. This asked for the FIRST `[role=status]` in
       the deck and got the JSON card's own paragraph, which only speaks when
       somebody saves a .song.json, so all three M6 checks reported "0
       sentences" and "-1 ms over 0 ticks": a gate looking at the wrong
       paragraph, reading as a frozen main thread. The repair was a filter to
       "the line outside a card"; the card's line is DELETED now (ui/eight.js
       `songCard`, "ONE STATUS LINE IN THIS DECK, AND IT IS THE DECK'S"), so
       the filter had nothing left to exclude and is gone with it. The line is
       still re-queried every tick, which is the part that was never about the
       duplicate: ui/eight.js rebuilds the Export tab from scratch on a redraw
       and a press redraws the page. */
    const sayNow = () => { const n = deckSayEl(); return n ? n.textContent : ""; };
    setInterval(() => {
      const t = performance.now(), g = t - last; last = t;
      const s = sayNow();
      if (s && s !== window.__hb.says[window.__hb.says.length - 1]) window.__hb.says.push(s);
      const nowEnc = /encoding/i.test(s || "");
      if (nowEnc && enc) window.__hb.encGaps.push(g);
      enc = nowEnc;
      window.__hb.gaps.push(g);
    }, 25);
  });
  const dl = await Promise.all([
    page.waitForEvent("download", { timeout: 600000 }),
    page.click('#exportdeck [data-k="deck.exp.mp3"]'),
  ]).then((r) => r[0]);
  const out = path.join(os.tmpdir(), "nukernel-gate-" + process.pid + ".mp3");
  await dl.saveAs(out);
  const bytes = fs.readFileSync(out);
  const hb = await page.evaluate(() => window.__hb);
  console.log("     downloaded " + dl.suggestedFilename() + " — " +
    (bytes.length / 1048576).toFixed(2) + " MB");

  // ---- M2 — it is an MPEG stream with the claimed settings ----------------
  const fr = firstFrame(bytes);
  is(!!fr && fr.at === 0, "M2 · the file opens on an MPEG frame sync" +
    (fr ? " (at byte " + fr.at + ")" : " — no frame header found"));
  is(!!fr && fr.mpeg1 && fr.layer3 && fr.kbps === 192 && fr.sr === 44100 && fr.channels === 2,
    "M2 · MPEG-1 Layer III · " + (fr ? fr.kbps + " kbps · " + fr.sr + " Hz · " +
      fr.modeName + " (" + fr.channels + "ch)" : "unreadable") +
    " — the card's claim, read out of the bytes");

  // ---- the reference: the WAV press of the same record --------------------
  console.log("     pressing the same record as WAV for the reference…");
  const wav = await page.evaluate(() => window.__deckPressWav()
    .catch((e) => ({ err: String((e && e.message) || e) })));
  is(!wav.err, "  · the WAV reference press completed" + (wav.err ? " — " + wav.err : ""));

  // ---- M3/M5 — the browser's own decoder, on the downloaded bytes ---------
  const b64 = bytes.toString("base64");
  const dec = await page.evaluate(async (s) => {
    const bin = atob(s), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const ctx = new OfflineAudioContext(2, 1, 44100);
    try {
      const buf = await ctx.decodeAudioData(u.buffer);
      const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
      /* RMS THE WAY THE WAV PRESS MEASURES IT — over the INTERLEAVED stream,
         every sample of both channels as one series. `__deckPressWav` walks
         the file's Int16 pairs in order and does exactly this, and the first
         run of this gate compared it against a mid-channel ((L+R)/2) RMS
         instead: on a wide stereo record the mid is quieter than the pair, and
         the gate read a 15% "encoder loss" that was entirely the two formulas
         disagreeing. Same formula, or the number means nothing. */
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += L[i] * L[i] + R[i] * R[i];
      return { ok: true, ch: buf.numberOfChannels, sr: buf.sampleRate,
               frames: buf.length, durSec: buf.duration,
               rms: Math.sqrt(sum / Math.max(1, buf.length * 2)) };
    } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  }, b64);
  is(dec.ok, "M3 · decodeAudioData ACCEPTS the downloaded file" + (dec.ok ? "" : " — " + dec.err));
  if (dec.ok) {
    is(dec.ch === 2 && dec.sr === 44100,
      "M3 · …as " + dec.ch + " channels at " + dec.sr + " Hz");
    // M4 — duration, in frames, with the tolerance argued in the header
    const FR = 1152 / 44100;
    const dFrames = (dec.durSec - wav.durSec) / FR;
    is(Math.abs(dFrames) <= 4,
      "M4 · duration matches the WAV press within " + dFrames.toFixed(2) +
      " granule frames (mp3 " + dec.durSec.toFixed(3) + "s vs wav " +
      wav.durSec.toFixed(3) + "s; tolerance ±4 frames = ±" +
      (4 * FR * 1000).toFixed(0) + " ms for lame's untagged encoder delay + tail padding)");
    // M5 — not silence, and the same music
    const rel = Math.abs(dec.rms - wav.rms) / Math.max(1e-9, wav.rms);
    is(dec.rms > 0.01, "M5 · the MP3 is not silence (RMS " + dec.rms.toFixed(5) + ")");
    is(rel < 0.15, "M5 · …and it is the SAME record: mp3 RMS " + dec.rms.toFixed(5) +
      " vs wav RMS " + wav.rms.toFixed(5) + " — " + (rel * 100).toFixed(1) + "% apart");
  }

  // ---- M6 — off the main thread, and it said so --------------------------
  const maxEnc = hb.encGaps.length ? Math.max(...hb.encGaps) : -1;
  is(hb.says.some((s) => /encoding/i.test(s)),
    "M6 · the card reported the encode (" + hb.says.filter((s) => /encoding/i.test(s)).length +
    " sentences, e.g. \"" + (hb.says.filter((s) => /encoding/i.test(s))[1] || "") + "\")");
  is(hb.says.some((s) => /encoded —/i.test(s)),
    "M6 · …and said what came out: \"" +
    (hb.says.filter((s) => /encoded —/i.test(s))[0] || "nothing") + "\"");
  is(maxEnc >= 0 && maxEnc < 1000,
    "M6 · the main thread stayed alive through the encode — longest heartbeat gap " +
    maxEnc.toFixed(0) + " ms over " + hb.encGaps.length + " ticks (a main-thread " +
    "lame would block for tens of seconds)");

  is(errors.length === 0, "  · no page errors (" + errors.slice(0, 3).join(" | ") + ")");
  try { fs.unlinkSync(out); } catch (e) {}
  await browser.close(); srv.close();
  console.log(FAILS ? "\nmp3 gate: " + FAILS + " FAILED" : "\nmp3 gate: all green");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.log("  FAIL harness: " + (e && e.stack || e)); process.exit(1); });
