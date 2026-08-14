#!/usr/bin/env node
// test/browser/nukernel-survival.test.js — THE NUKERNEL SURVIVAL GATE.
//
//   node test/browser/nukernel-survival.test.js
//
// nukernel-audio.test.js proves the page makes the right sound while you are
// looking at it. Everything in THIS gate is about the moments you are not:
// the context suspended by an interruption, the tab hidden, the phone locked.
// The parent app's history says these paths ship broken while every
// foreground check passes — and that an analyser on the live graph is
// structurally BLIND to the one artifact that matters here, the rendered
// bounce blob a background <audio> element plays (its output never enters the
// AudioContext graph). So this gate reads the blob itself.
//
//   (A) THE CONTEXT RECOVERS. ctx.suspend() with NO visibility event — the
//       audio-session interruption shape — must self-heal via onstatechange:
//       state back to 'running', RMS back above the floor. Then a full
//       hidden/visible cycle must come back audible too.
//   (A0) THE CARRIER EXISTS FAST. Two-stage bounce: stage 'short' (the song's
//       first bars) reaches 'ready' within seconds of play — the old single
//       render waited ~3 bars plus a debounce and then took multiples of
//       realtime, so any switch-away in the first half minute found no
//       carrier — then stage 'full' replaces it and the duration grows.
//   (B) THE BOUNCE IS REAL MUSIC. window.__nuBounce reaches 'ready' at stage
//       'full'; the blob URL it names is fetched and decoded IN PAGE, and its
//       PCM carries energy in three windows across the file. The RENDERED
//       artifact, not the analyser.
//   (C) NO DOUBLE PLAYBACK. In the foreground the carrier element must sit at
//       volume 0 while the graph runs — two sources at once is the failure
//       class the parent had to instrument (live.js elAudible), and here the
//       second source is a phase-shifted copy of the same song.
//   (D) THE LOCK SCREEN TELLS THE TRUTH. MediaSession metadata + playbackState
//       follow the real transport.
//   (E) THE PLATFORM PREDICATE IS SPLIT, not smeared. The preemptive no-carrier
//       mute exists for the platforms whose ctx FREEZES on hide (iOS/iPadOS
//       WebKit) — Android keeps a running audible context in background like
//       desktop, and muting it was the real phone's "stops playing when I
//       switch out of the browser". ?bgtest=ios|android forces the predicate;
//       ?nobounce holds the no-carrier state so the branches can't be raced
//       past by a short render landing in seconds.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8973;                 // a PREFERENCE — the harness walks past a busy port
const RMS_FLOOR = 0.01;          // silence is ~1e-4; music here runs 0.2..0.6
const PCM_FLOOR = 0.003;         // post-limiter PCM windows sit well above this

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// Taps installed BEFORE any page script runs: capture the live AudioContext
// (and its construction options — the 44100/'playback' pin is a one-line
// regression nothing else can see) and hang an analyser off whatever connects
// to the destination. OfflineAudioContext is deliberately NOT wrapped: the
// bounce must run against the real thing.
function taps() {
  window.__acOpts = null;
  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
    window.__acOpts = a[0] || null;
    window.__ctx = c;
    const an = c.createAnalyser(); an.fftSize = 2048;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest === c.destination) { try { orig.call(this, an); } catch (e) {} }
      return orig.call(this, dest, ...rest);
    };
    window.__rms = () => {
      const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v;
      return Math.sqrt(s / d.length);
    };
    return c;
  };
}

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();  // the harness passes the autoplay flag
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(taps);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });

  // one phrase in the one box, and play — the same entry the audio gate uses.
  // The default song ships phrase 1 already ON in box 1 (the fresh page must
  // sound) and a .slot click TOGGLES, so guard it exactly as boot() below does.
  {
    const slot0 = page.locator(".slot").nth(0);
    if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
  }
  await page.click("#seed");
  await page.click("#play");
  await page.waitForFunction(() => window.__rms && window.__rms() > 0.01,
    null, { timeout: 30000 });
  ok("playing: live RMS above floor");

  const rmsN = (n, gapMs) => page.evaluate(async ({ n, gapMs }) => {
    const out = [];
    for (let i = 0; i < n; i++) { out.push(window.__rms()); await new Promise(r => setTimeout(r, gapMs)); }
    return out;
  }, { n, gapMs });

  // ── the pinned context: sampleRate 44100 + latencyHint 'playback' ──
  {
    const opts = await page.evaluate(() => window.__acOpts);
    const sr = await page.evaluate(() => window.__ctx.sampleRate);
    if (!opts || opts.sampleRate !== 44100 || opts.latencyHint !== "playback")
      fail(`the AudioContext is not pinned: options ${JSON.stringify(opts)} — ` +
           `'interactive' + device-rate is the underrun-prone default the recon retired`);
    else ok("AudioContext requested {sampleRate:44100, latencyHint:'playback'}");
    if (sr !== 44100) fail(`context runs at ${sr}, not 44100 — every zone decode now resamples`);
    else ok("context runs at 44100");
  }

  // ── (A0) two-stage bounce: a short carrier exists within seconds of play ──
  let shortDur = 0;
  {
    await page.waitForFunction(() =>
      window.__nuBounce && window.__nuBounce().state === "ready",
      null, { timeout: 15000 }).catch(() => {});
    const b = await page.evaluate(() => window.__nuBounce());
    if (b.state !== "ready")
      fail(`no carrier within 15 s of play (state '${b.state}'` +
           (b.lastError ? `, lastError '${b.lastError}'` : "") +
           `) — the first-half-minute pocket window is open again`);
    else if (b.stage !== "short")
      fail(`first ready carrier is stage '${b.stage}' — the short stage was ` +
           `skipped, so time-to-first-carrier is the full render again`);
    else {
      ok(`short carrier ready fast: ${b.durSec.toFixed(2)}s loop, ` +
         `rendered in ${b.lastRenderMs} ms`);
      shortDur = b.durSec;
    }
  }

  // ── (A1) interruption: suspend with NO visibility event ──
  // the onstatechange handler must mute-at-source, poke resume, and self-heal
  await page.evaluate(() => { window.__ctx.suspend(); });
  await page.waitForTimeout(3000);
  {
    const state = await page.evaluate(() => window.__ctx.state);
    const heal = await rmsN(6, 300);
    const alive = heal.filter(v => v > RMS_FLOOR).length;
    console.log("  post-suspend RMS:", heal.map(v => v.toFixed(3)).join(" "), "state:", state);
    if (state !== "running") fail(`ctx.state is '${state}' after a bare suspend() — ` +
      `the onstatechange recovery never ran, which is permanent silence on iOS`);
    else ok("bare ctx.suspend() self-heals: state back to 'running'");
    if (alive < 4) fail(`RMS did not return after the interruption (${alive}/6 samples audible)`);
    else ok(`RMS returned after the interruption (${alive}/6 samples audible)`);
  }

  // ── (A2) the hidden/visible cycle ──
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState",
      { get: () => window.__vis || "hidden", configurable: true });
    window.__vis = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(1500);
  {
    // while hidden, exactly one of two legal states: the graph still sounding
    // (desktop, no carrier yet) or the carrier element carrying (volume up,
    // graph muted). Silence in BOTH is the bug this file exists to catch.
    const h = await page.evaluate(() => ({
      rms: window.__rms(),
      b: window.__nuBounce ? window.__nuBounce() : null }));
    // carrying/elVolume are flags carry() SET; el.paused is what the element
    // is DOING — a handoff whose play() was refused must not count as audible
    const carrierUp = h.b && h.b.carrying && h.b.elVolume > 0 && h.b.elPaused === false;
    if (h.rms > RMS_FLOOR || carrierUp)
      ok(`hidden: audible via ${carrierUp ? "the carrier element" : "the live graph"}`);
    else fail(`hidden: graph RMS ${h.rms.toFixed(4)} and no carrier — the tab went silent`);
  }
  await page.evaluate(() => { window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(2000);
  {
    const back = await rmsN(6, 300);
    const alive = back.filter(v => v > RMS_FLOOR).length;
    const state = await page.evaluate(() => window.__ctx.state);
    console.log("  return RMS:", back.map(v => v.toFixed(3)).join(" "), "state:", state);
    if (alive < 4 || state !== "running")
      fail(`the page did not come back from hidden (${alive}/6 audible, state '${state}')`);
    else ok(`return from hidden: audible (${alive}/6) and running`);
  }

  // ── (B) the bounce: wait for the FULL stage, then read the RENDERED BLOB ──
  {
    await page.waitForFunction(() =>
      window.__nuBounce && window.__nuBounce().state === "ready" &&
      window.__nuBounce().stage === "full",
      null, { timeout: 120000 }).catch(() => {});
    const b = await page.evaluate(() => window.__nuBounce ? window.__nuBounce() : null);
    if (!b) fail("window.__nuBounce is missing — the page exposes no carrier state at all");
    else if (b.state !== "ready")
      fail(`the bounce never reached 'ready' (state '${b.state}') — no background carrier exists`);
    else if (b.stage !== "full")
      fail(`the full render never replaced the short carrier (stage '${b.stage}'` +
           (b.lastError ? `, lastError '${b.lastError}'` : "") + `)`);
    else {
      ok(`bounce ready: ${b.durSec.toFixed(2)}s, gen ${b.gen}, rendered in ${b.lastRenderMs} ms` +
         (b.sampledOnly ? " (SAMPLED-ONLY degrade — counted, as the contract requires)" : ""));
      if (shortDur && !(b.durSec > shortDur))
        fail(`the full carrier (${b.durSec.toFixed(2)}s) did not grow past the ` +
             `short stage (${shortDur.toFixed(2)}s) — the whole song never bounced`);
      else if (shortDur)
        ok(`the blob grew to the song: ${shortDur.toFixed(2)}s -> ${b.durSec.toFixed(2)}s`);
      // the carrier must be REAL instruments. The foreground gate fails on a
      // SINGLE live fallback as audibly wrong, and the rendered bounce is the
      // only thing a locked phone hears — oscillator boops carry plenty of
      // RMS, so the window checks below cannot catch this. sampledOnly stays
      // a printed, permitted degrade; the oscillator fallback does not.
      if (b.fallbacks)
        fail(`${b.fallbacks} offline fallback voice(s) in the rendered bounce — the ` +
             `background carrier is playing hand-rolled oscillator boops, the exact ` +
             `sound the foreground gate calls audibly wrong`);
      else ok("no offline fallback voice in the bounce");
      // decode the blob IN PAGE and measure its PCM — the artifact, not the analyser
      const probe = await page.evaluate(async () => {
        const x = window.__nuBounce();
        const ab = await (await fetch(x.url)).arrayBuffer();
        const oc = new OfflineAudioContext(1, 44100, 44100);
        const buf = await oc.decodeAudioData(ab);
        const d = buf.getChannelData(0);
        const win = Math.floor(buf.length / 3), rms = [];
        for (let w = 0; w < 3; w++) {
          let s = 0; const a = w * win, e = Math.min(buf.length, a + win);
          for (let i = a; i < e; i++) s += d[i] * d[i];
          rms.push(Math.sqrt(s / (e - a)));
        }
        return { durSec: buf.duration, sr: buf.sampleRate, rms };
      }).catch(e => ({ err: String(e) }));
      if (probe.err) fail(`the bounce blob does not decode: ${probe.err}`);
      else {
        console.log(`  blob: ${probe.durSec.toFixed(2)}s @ ${probe.sr}, ` +
                    `window RMS ${probe.rms.map(v => v.toFixed(4)).join(" / ")}`);
        if (Math.abs(probe.durSec - b.durSec) > 0.1)
          fail(`blob duration ${probe.durSec.toFixed(2)}s != declared ${b.durSec.toFixed(2)}s`);
        else ok("blob duration matches the declared song duration");
        const dead = probe.rms.filter(v => v < PCM_FLOOR).length;
        if (dead) fail(`${dead} of 3 windows of the rendered blob are silent ` +
                       `(RMS ${probe.rms.map(v => v.toFixed(4)).join(", ")}) — ` +
                       `the carrier would hand the background a blank tape`);
        else ok("all three PCM windows of the rendered blob carry music");
      }
    }
  }

  // ── (B2) THE HANDOFF, DETERMINISTICALLY. The (A2) cycle runs before the
  // render is ready, so the carrier branch was reachable only by race —
  // headless keeps the graph sounding and the check short-circuited on RMS.
  // With the bounce ready, hide again and require the ELEMENT to be the
  // source: not paused (a play() the browser refused is a silent pocket that
  // flags alone cannot see), volume up, currentTime advancing, and the graph
  // really muted. This is the artifact the whole file exists for.
  {
    const ready = await page.evaluate(() =>
      window.__nuBounce && window.__nuBounce().state === "ready");
    if (ready) {
      await page.evaluate(() => {
        window.__vis = "hidden"; document.dispatchEvent(new Event("visibilitychange")); });
      await page.waitForTimeout(800);
      const c1 = await page.evaluate(() => ({ b: window.__nuBounce(), rms: window.__rms() }));
      if (!c1.b.carrying || !(c1.b.elVolume > 0) || c1.b.elPaused !== false)
        fail(`hidden with a ready bounce: the carrier did not take over ` +
             `(carrying ${c1.b.carrying}, volume ${c1.b.elVolume}, paused ${c1.b.elPaused})`);
      else ok(`hidden with a ready bounce: the element is PLAYING at volume ${c1.b.elVolume}`);
      if (c1.rms > RMS_FLOOR)
        fail(`the graph still sounds while the element carries (RMS ${c1.rms.toFixed(4)}) — ` +
             `double playback in the pocket`);
      else ok("the graph is muted while the element carries");
      const t0 = c1.b.elTime;
      await page.waitForTimeout(600);
      const t1 = await page.evaluate(() => window.__nuBounce().elTime);
      if (!(t1 > t0)) fail(`el.currentTime does not advance while carrying (${t0} -> ${t1})`);
      else ok(`el.currentTime advances while carrying (${t0.toFixed(2)}s -> ${t1.toFixed(2)}s)`);
      await page.evaluate(() => {
        window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
      await page.waitForTimeout(2000);
      const back = await page.evaluate(() => ({ b: window.__nuBounce(), rms: window.__rms() }));
      if (back.b.carrying || back.rms < RMS_FLOOR)
        fail(`the reverse handoff failed (carrying ${back.b.carrying}, ` +
             `RMS ${back.rms.toFixed(4)})`);
      else ok("return from the carried hide: the graph is audible again");
    } else ok("bounce never reached ready — (B) already failed this; handoff cycle skipped");
  }

  // ── (C) no double playback in the foreground ──
  {
    const dp = await page.evaluate(() => ({
      b: window.__nuBounce(), state: window.__ctx.state, rms: window.__rms() }));
    if (dp.b.carrying) fail("the carrier claims to be carrying while the page is visible");
    else if (dp.b.elVolume !== 0 && dp.b.elVolume != null)
      fail(`the carrier element sits at volume ${dp.b.elVolume} in the foreground — ` +
           `the song is playing against a phase-shifted copy of itself`);
    else ok("foreground: element at volume 0 while the graph sounds — one source at a time");
    if (dp.state !== "running" || dp.rms < RMS_FLOOR)
      fail(`foreground graph not sounding (state '${dp.state}', RMS ${dp.rms.toFixed(4)})`);
    else ok("foreground: the graph is the audible source");
  }

  // ── (D) MediaSession follows the transport ──
  {
    const ms = await page.evaluate(() => ({
      state: navigator.mediaSession.playbackState,
      title: navigator.mediaSession.metadata && navigator.mediaSession.metadata.title,
      artist: navigator.mediaSession.metadata && navigator.mediaSession.metadata.artist }));
    if (ms.state !== "playing") fail(`playbackState '${ms.state}' while the transport runs`);
    else ok("playbackState 'playing' while playing");
    if (!ms.title) fail("MediaSession has no title — the lock screen shows the page URL");
    else ok(`MediaSession title: "${ms.title}"`);
    if (ms.artist !== "stellate nukernel") fail(`MediaSession artist is "${ms.artist}"`);
    else ok("MediaSession artist is 'stellate nukernel'");
    await page.click("#play");                     // stop
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => navigator.mediaSession.playbackState);
    if (after !== "paused") fail(`playbackState '${after}' after stop — the lock screen still says playing`);
    else ok("playbackState 'paused' after stop");
  }

  // the boot instrument existed and finished with a measurement, not a timer
  {
    const boot = await page.evaluate(() => window.__nuBoot ? window.__nuBoot() : null);
    if (!boot || boot.firstSound == null)
      fail("window.__nuBoot has no firstSound mark — a stalled phone boot would be invisible again");
    else ok(`boot marks: play->assets ${boot.assetsStart - boot.playPressed} ms, ` +
            `assets ${boot.assetsDone - boot.assetsStart} ms, ` +
            `first sound +${boot.firstSound - boot.playPressed} ms`);
  }

  // ── (E) the platform predicate, both ways, on fresh loads ──
  const hide = () => page.evaluate(() => {
    Object.defineProperty(document, "visibilityState",
      { get: () => window.__vis || "hidden", configurable: true });
    window.__vis = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
  });
  const show = () => page.evaluate(() => {
    window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); });
  const boot = async (q) => {
    await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html${q}`,
      { waitUntil: "networkidle" });
    // the .slot click TOGGLES the phrase into the box, and these reloads
    // RESTORE the earlier section's song from localStorage (pagehide flushes
    // the store, so clearing it pre-goto loses the race) — on a restored
    // song the slot is already in the box and a blind click would empty it,
    // leaving "nothing to play"
    const slot0 = page.locator(".slot").nth(0);
    if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
    await page.click("#seed");
    await page.click("#play");
    await page.waitForFunction(() => window.__rms && window.__rms() > 0.01,
      null, { timeout: 30000 });
  };

  // (E1) Android, no carrier: the ctx does NOT freeze on hide there — hiding
  // must leave the graph PLAYING. This is the real phone's complaint: the old
  // whole-of-mobile mute silenced a platform that never needed it.
  {
    await boot("?bgtest=android&nobounce=1");
    await hide();
    await page.waitForTimeout(600);
    const s = await rmsN(5, 250);
    const alive = s.filter(v => v > RMS_FLOOR).length;
    const b = await page.evaluate(() => window.__nuBounce());
    console.log("  android hidden RMS:", s.map(v => v.toFixed(3)).join(" "));
    if (b.state !== "idle" || b.carrying)
      fail(`the ?nobounce seam leaks (state '${b.state}', carrying ${b.carrying}) — ` +
           `this section is no longer testing the no-carrier branch`);
    if (alive < 4)
      fail(`android hidden with no carrier went quiet (${alive}/5 audible) — ` +
           `the preemptive mute is firing on a platform whose ctx never freezes`);
    else ok(`android hidden with no carrier: the graph keeps sounding (${alive}/5)`);
    await show(); await page.click("#play");
  }

  // (E2) iOS, no carrier: the freeze is real — hide must mute at source
  // (silence beats the frozen last quantum looping at the CoreAudio boundary)
  {
    await boot("?bgtest=ios&nobounce=1");
    await hide();
    await page.waitForTimeout(600);
    const rms = await page.evaluate(() => window.__rms());
    if (rms > RMS_FLOOR)
      fail(`ios hidden with no carrier still sounds (RMS ${rms.toFixed(4)}) — ` +
           `the mute-at-source before the freeze is gone`);
    else ok("ios hidden with no carrier: muted at source (the coded intent)");
    await show();
    await page.waitForTimeout(1500);
    const back = await rmsN(5, 250);
    const alive = back.filter(v => v > RMS_FLOOR).length;
    if (alive < 4) fail(`ios return from the muted hide is not audible (${alive}/5)`);
    else ok(`ios return from the muted hide: audible (${alive}/5)`);
    await page.click("#play");
  }

  // (E3) iOS with the bounce: after 'ready', a hide/show cycle carries
  {
    await boot("?bgtest=ios");
    await page.waitForFunction(() =>
      window.__nuBounce && window.__nuBounce().state === "ready",
      null, { timeout: 30000 });
    await hide();
    await page.waitForTimeout(800);
    const c = await page.evaluate(() => ({ b: window.__nuBounce(), rms: window.__rms() }));
    if (!c.b.carrying || !(c.b.elVolume > 0) || c.b.elPaused !== false)
      fail(`ios hidden with a ready bounce did not carry ` +
           `(carrying ${c.b.carrying}, volume ${c.b.elVolume}, paused ${c.b.elPaused})`);
    else ok(`ios hidden after ready: the carrier element plays (stage '${c.b.stage}')`);
    if (c.rms > RMS_FLOOR) fail(`the graph sounds under the ios carrier (RMS ${c.rms.toFixed(4)})`);
    else ok("the graph is muted under the ios carrier");
    await show();
    await page.waitForTimeout(1500);
    const back = await page.evaluate(() => ({ b: window.__nuBounce(), rms: window.__rms() }));
    if (back.b.carrying || back.rms < RMS_FLOOR)
      fail(`ios reverse handoff failed (carrying ${back.b.carrying}, RMS ${back.rms.toFixed(4)})`);
    else ok("ios return from the carried hide: the graph is audible again");
    await page.click("#play");
  }

  // (F) THE DROP LAW, under injected faults. A synth-identity genre whose
  // synth AND sampled cover both fail to fetch must go SILENT on that voice —
  // never the oscillator stub. This is the ten-beep sweep failure of
  // 2026-08-14 made reproducible: route-abort the 303's wasm and the guitar's
  // zones, play acid, and the beep counter must stay at zero while the drop
  // counter proves the law (and the kit keeps the RMS floor honest).
  {
    const p2 = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs2 = capturePageErrors(p2);
    await p2.route("**/dist/tb303*-module.wasm", (r) => r.abort());
    await p2.route("**/clean_guitar/**", (r) => r.abort());
    await p2.addInitScript(taps);
    await p2.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`, { waitUntil: "networkidle" });
    const s0 = p2.locator(".slot").nth(0);
    if ((await s0.getAttribute("aria-pressed")) !== "true") await s0.click();
    await p2.click("#seed");
    await p2.locator(".pchip", { hasText: /^Acid house$/ }).click();
    await p2.click("#play");
    await p2.waitForTimeout(12000);
    const d = await p2.evaluate(() => ({
      fallback: window.__nuFallback, dropped: window.__nuDropped, rms: window.__rms() }));
    if (d.fallback > 0)
      fail(`with both voices dead, ${d.fallback} oscillator beep(s) fired — ` +
           `the drop law is broken`);
    else ok("both voices dead: zero fallback beeps");
    if (!(d.dropped > 0))
      fail(`nothing was counted dropped (${d.dropped}) — either the injection ` +
           `missed or the notes went somewhere unaccounted`);
    else ok(`the dead voice's notes drop, counted: ${d.dropped}`);
    if (d.rms > RMS_FLOOR) ok(`the rest of the band plays on (RMS ${d.rms.toFixed(3)})`);
    else fail(`the whole mix died with one voice (RMS ${d.rms.toFixed(4)})`);
    // the injected aborts print their own resource failures — that is the
    // fault working, not a page error. Anything ELSE is real.
    const real = errs2.filter(x => !/Failed to load resource|ERR_FAILED/.test(x));
    if (real.length) fail(`drop-law page errors: ${real.slice(0, 2).join(" | ")}`);
    await p2.close();
  }

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  await browser.close(); await srv.close();
  console.log(`\nnukernel-survival: ${checks} checks` +
              (process.exitCode ? " — FAILURES ABOVE" : " pass"));
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
