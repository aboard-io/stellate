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
//   (B3) THE CARRIER CARRIES THE MASTER. The song owns a master bus (drive,
//       glue, tape, space, width, tilt, ceiling — fields.js MASTER). The live
//       graph and the offline bounce must build it through the SAME
//       graph.buildMasterChain, or the pocket gets an untreated tape of a song
//       the ear just heard treated. Banded off the decoded blob, before and
//       after arming every global; the shape has to move, and clearing them
//       has to put the seven-node default chain back.
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
//   (G) CARRIER-FIRST ON MOBILE — the element is the audible path from the
//       FIRST PLAY, not from the hide. A page whose foreground output is a
//       WebAudio graph is not media, so the OS gives it no session and no
//       audio focus; that is the phone report of 2026-08-15 and it is what
//       docs/WAV-FIRST.md says to do ("THROUGHOUT"). Both predicates: the
//       element is unmuted, playing and advancing with the graph silent under
//       it BEFORE any hide; hide changes nothing; show does not flap the path
//       back; and the lock-screen controls are pressed for real through
//       window.__nuMedia().fire(). This REPLACES the old (E3), which asserted
//       the opposite law (carry on hide, hand back on show) — that law was the
//       bug, and a gate that still held it would forbid the fix.
//   (G2) THE LESS-DYNAMIC TRADEOFF, HONEST. A phone edit is heard when its
//       re-render lands and swaps at the loop wrap: the readout must SAY so
//       while it is pending, the new generation must actually land, and the
//       live graph must never come back up to cover the wait.
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

  // THE PHRASE EDITOR IS THE COMPOSE PAGE ("compose, arrange, mix",
  // 2026-08-16): .slot and #seed live on it, reached through a PATTERN
  // thumbnail on the row — the tap NAVIGATES (data-page flips to "compose";
  // at this desk viewport every page is visible anyway, so nothing covers
  // the deck and closeEditor has nothing left to close).
  const openEditor = async (p) => {
    await p.locator(".box").first().locator(".bch").first().click();
    await p.waitForFunction(() =>
      document.getElementById("chassis").dataset.page === "compose",
      null, { timeout: 10000 });
  };
  const closeEditor = async (p) => {};

  // one phrase in the one box, and play — the same entry the audio gate uses.
  // The default song ships phrase 1 already ON in box 1 (the fresh page must
  // sound) and a .slot click TOGGLES, so guard it exactly as boot() below does.
  await openEditor(page);
  {
    const slot0 = page.locator(".slot").nth(0);
    if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
  }
  await page.click("#seed");
  await closeEditor(page);
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
  // `shortBars` is the SHORT cut's own bar count, kept so (B) can ask the only
  // question that survives a whole-box insurance tape: did the full render
  // cover MORE BARS than the cut did. Seconds cannot answer it — a song whose
  // timeline is one box has two stages of identical length, legitimately —
  // and DOM `.box` rows cannot either: a fresh page ships four of them and
  // buildTimeline only walks the ones carrying a phrase.
  let shortDur = 0, shortBars = 0;
  {
    await page.waitForFunction(() =>
      window.__nuBounce && window.__nuBounce().state === "ready",
      null, { timeout: 15000 }).catch(() => {});
    const b = await page.evaluate(() => window.__nuBounce());
    const r0 = await page.evaluate(() => window.__nuRender && window.__nuRender());
    if (r0 && r0.stage === "short") shortBars = r0.wantBars || 0;
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
      // THE FULL TAPE IS THE WHOLE SONG, which is not the same claim as "it is
      // longer than the short one". The short stage cuts on a BOX LINE now
      // ("the insurance tape is a whole phrase, because two bars is not a
      // song") and takes the first box WHOLE however long it is — so on this
      // gate's ONE-BOX song the two stages are legitimately the same tape, and
      // a strict `>` was asserting the old two-bar fragment. The claim that
      // survives: the full tape never SHRINKS below the insurance one, and it
      // covers every bar the TIMELINE has. Bars, not seconds and not DOM rows
      // — measured on this gate's own song, a fresh page shows four `.box`
      // rows but only the first carries a phrase, so buildTimeline walks 4
      // bars and the full render honestly wants all 4 of them. Asking `.box`
      // reported "4 boxes, the render stopped at the insurance cut" about a
      // tape that was already the whole song.
      const fullBars = await page.evaluate(() =>
        (window.__nuRender && window.__nuRender().wantBars) || 0);
      if (shortDur && b.durSec < shortDur - 0.01)
        fail(`the full carrier (${b.durSec.toFixed(2)}s) is SHORTER than the ` +
             `short stage (${shortDur.toFixed(2)}s) — the whole song never bounced`);
      else if (shortBars && fullBars > shortBars && !(b.durSec > shortDur))
        fail(`the full render covers ${fullBars} bars against the cut's ` +
             `${shortBars}, but the tape is still ${b.durSec.toFixed(2)}s — the ` +
             `render stopped at the insurance cut`);
      else if (shortDur)
        ok(`the blob is every bar the timeline has: ${shortBars} -> ${fullBars} ` +
           `bars, ${shortDur.toFixed(2)}s -> ${b.durSec.toFixed(2)}s`);
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
      // ADVANCE IS MEASURED ON THE LOOP, NOT ON THE NUMBER. The carrier is a
      // LOOPING element — that is the whole point of the insurance tape — so
      // `t1 > t0` is only true when the 600 ms window happens to miss the wrap.
      // Measured: a tape 7.61 s long sampled at 7.55 s came back at 0.56 s and
      // failed a playing element for playing. Modulo the tape's own length the
      // reading is exact (7.55 -> 0.56 is +0.62 s of a 7.61 s loop), and it
      // says MORE than the old one did: the tape must advance by roughly the
      // wall time that passed, so a stuck element and a 2x element both fail.
      const t0 = c1.b.elTime, dur = c1.b.durSec || 0;
      await page.waitForTimeout(600);
      const t1 = await page.evaluate(() => window.__nuBounce().elTime);
      const moved = dur > 0 ? ((t1 - t0) % dur + dur) % dur : t1 - t0;
      if (!(moved > 0.2 && moved < 1.6))
        fail(`el.currentTime does not advance while carrying (${t0.toFixed(2)} -> ` +
             `${t1.toFixed(2)}s, ${moved.toFixed(2)}s of a ${dur.toFixed(2)}s loop, ` +
             `against 0.6s of wall clock)`);
      else ok(`el.currentTime advances while carrying (${t0.toFixed(2)}s -> ` +
              `${t1.toFixed(2)}s, +${moved.toFixed(2)}s on a ${dur.toFixed(2)}s loop)`);
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

  // ── (B3) THE CARRIER CARRIES THE MASTER TREATMENT ──
  // The song owns a master bus now (fields.js MASTER, the session bank on the
  // SONG page): drive, glue, tape, space, width, tilt, ceiling. The live graph
  // plays through it and the offline bounce is supposed to render through the
  // SAME builder — and "supposed to" is exactly the class of claim this file
  // exists to disbelieve, because the carrier is the one signal path no
  // analyser on the live graph can see. A bounce that forked from
  // graph.buildMasterChain would sound right all day in the foreground and
  // hand the pocket an untreated tape of the same song.
  //
  // So: band the blob, arm every global, wait for the RE-RENDER the master
  // change must trigger (audio/bounce.js sig() carries it, or the stale blob
  // would simply be kept), band it again, and require the shape to move. The
  // correlation bar is nukernel-audio's — two passes of the same sound measure
  // ~0.995 there and the bounce is more deterministic still.
  {
    // Goertzel over log-spaced bands, eight windows across the file. SHAPE, not
    // level: the master ends in a brickwall whose whole job is flattening the
    // level a treatment adds, so measuring loudness here measures the limiter.
    const bandsOf = () => page.evaluate(async () => {
      const x = window.__nuBounce();
      const ab = await (await fetch(x.url)).arrayBuffer();
      const oc = new OfflineAudioContext(1, 44100, 44100);
      const buf = await oc.decodeAudioData(ab);
      const d = buf.getChannelData(0), sr = buf.sampleRate, N = 4096, NB = 28;
      const acc = new Float64Array(NB);
      const hop = Math.max(N, Math.floor((d.length - N) / 8));
      let w = 0;
      for (let s = 0; s + N <= d.length && w < 8; s += hop, w++) {
        for (let b = 0; b < NB; b++) {
          const hz = 60 * Math.pow(200, b / (NB - 1));      // 60 Hz .. 12 kHz
          const cw = 2 * Math.cos(2 * Math.PI * hz / sr);
          let s0 = 0, s1 = 0, s2 = 0;
          for (let i = 0; i < N; i++) { s0 = d[s + i] + cw * s1 - s2; s2 = s1; s1 = s0; }
          acc[b] += Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - cw * s1 * s2)) / N;
        }
      }
      return { bands: Array.from(acc, v => v / Math.max(1, w)), gen: x.gen,
               dur: x.durSec };
    });
    const corr = (a, b) => {
      const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length;
      let n = 0, da = 0, db = 0;
      for (let i = 0; i < a.length; i++) {
        const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y;
      }
      return n / Math.sqrt(da * db);
    };
    const plain = await bandsOf().catch(e => ({ err: String(e) }));
    if (plain.err) fail(`could not band the untreated carrier: ${plain.err}`);
    else {
      // every global, through the REAL controls — the rack KNOBS on the MIX
      // page now (ui/mixtbl.js buildKnob, ids #m-<key> kept): role=slider,
      // Home is the empty detent, ArrowRight steps, data-value mirrors it
      const setKnob = async (id, want) => {
        const k = page.locator("#" + id);
        await k.focus();
        await page.keyboard.press("Home");
        for (let i = 0; i < 12; i++) {
          if ((await k.getAttribute("data-value")) === (want || "")) return;
          await page.keyboard.press("ArrowRight");
        }
        if ((await k.getAttribute("data-value")) !== (want || ""))
          fail(`the rack knob #${id} never reached "${want}" by keyboard`);
      };
      for (const [id, v] of [["m-drive", "dirt"], ["m-tape", "worn"],
                             ["m-space", "hall"], ["m-tilt", "dark"],
                             ["m-width", "huge"], ["m-glue", "pump"],
                             ["m-ceiling", "loud"]])
        await setKnob(id, v);
      // the LIVE graph must have swapped its chain (the same object the audio
      // gate reads); this is the precondition for asking about the carrier
      const live = await page.evaluate(() => window.__nuMix().master);
      if (!live || !live.stages.length)
        fail(`the live master chain reports no stages after every global was set ` +
             `(${JSON.stringify(live)}) — nothing to carry`);
      else ok(`live master armed: [${live.stages}]`);
      // …and the bounce must notice. sig() carries the master, so the adopted
      // blob is stale and a NEW generation has to land (4 s debounce + render).
      const advanced = await page.waitForFunction((g) => {
        const b = window.__nuBounce();
        return b.state === "ready" && b.stage === "full" && b.gen > g;
      }, plain.gen, { timeout: 180000 }).then(() => true).catch(() => false);
      if (!advanced)
        fail(`the carrier never re-rendered after the master changed — ` +
             `audio/bounce.js sig() is blind to the master bus, so the pocket ` +
             `keeps playing the untreated tape`);
      else {
        ok("a master change invalidates the carrier and re-renders it");
        const treated = await bandsOf().catch(e => ({ err: String(e) }));
        if (treated.err) fail(`the re-rendered carrier does not decode: ${treated.err}`);
        else {
          const r = corr(plain.bands, treated.bands);
          console.log(`  carrier shape corr    : plain vs mastered ${r.toFixed(4)} ` +
                      `(gen ${plain.gen} -> ${treated.gen})`);
          if (r < 0.98)
            ok(`the BOUNCED BLOB carries the master treatment: shape ` +
               `correlation ${r.toFixed(4)}`);
          else fail(`the rendered carrier's spectral shape is ${r.toFixed(4)} ` +
                    `correlated with the untreated one — the bounce is not ` +
                    `building through graph.buildMasterChain, so the background ` +
                    `plays a different mix from the foreground`);
        }
      }
      // leave the song as it was found: the sections below re-load it from
      // localStorage, and a treated master would ride along into (E)
      for (const id of ["m-drive", "m-tape", "m-space", "m-tilt", "m-width",
                        "m-glue", "m-ceiling"])
        await setKnob(id, "");
      await page.waitForTimeout(500);
      const back = await page.evaluate(() => window.__nuMix().master);
      // seven nodes: input, busComp, makeup, limiter, lp, SAFETY, out — the
      // safety net is unconditional since b1adc27 (this line said 6 for one
      // commit and failed on the truth)
      if (!back || back.stages.length || back.nodes !== 7)
        fail(`clearing the globals did not restore the chain the page always ` +
             `built (${JSON.stringify(back && back.stages)}, ` +
             `${back && back.nodes} nodes) — absent must be today`);
      else ok("clearing the globals restores the seven-node master chain");
    }
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
    // leaving "nothing to play". Both live in the editor popup now.
    await openEditor(page);
    const slot0 = page.locator(".slot").nth(0);
    if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
    await page.click("#seed");
    await closeEditor(page);
    await page.click("#play");
    // SOUNDING BY EITHER PATH. On a mobile predicate the graph is audible only
    // until the first render lands (carrier-first, (G) below) and then goes
    // deliberately silent — so waiting on graph RMS alone would time out on
    // exactly the pages this file cares most about.
    await page.waitForFunction(() =>
      (window.__rms && window.__rms() > 0.01) ||
      (window.__nuBounce && window.__nuBounce().carrying &&
       window.__nuBounce().elPaused === false),
      null, { timeout: 40000 });
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

  // ── (G) CARRIER-FIRST: ON MOBILE THE ELEMENT IS THE PATH FROM THE FIRST
  // PLAY, and hiding changes nothing. This section replaces the old (E3),
  // which asserted the OPPOSITE law on ios — carry on hide, hand back on show
  // — because that law is the bug. A page whose foreground output is a
  // WebAudio graph is not media: the OS attaches no session to it, grants it
  // no audio focus, and backgrounds it as a page ("focus is not being applied
  // to this app", a real phone, 2026-08-15). docs/WAV-FIRST.md reads
  // "THROUGHOUT"; nukernel had implemented "on hide".
  //
  // So for each mobile predicate: the element must be genuinely audible media
  // BEFORE any hide (unmuted, playing, volume up, currentTime advancing) with
  // the graph silent under it; a hide must change NOTHING; a show must not
  // flap the path back to the graph; and the lock-screen controls must exist
  // and WORK, pressed through window.__nuMedia().fire() the way the OS would
  // press them.
  const carrierFirstPass = async (plat) => {
    await boot(`?bgtest=${plat}`);
    const took = await page.waitForFunction(() => {
      const b = window.__nuBounce();
      return b.carrying && b.elPaused === false;
    }, null, { timeout: 40000 }).then(() => true).catch(() => false);
    const b0 = await page.evaluate(() => window.__nuBounce());
    if (!took) {
      fail(`${plat}: the element never became the audible path in the foreground ` +
           `(state '${b0.state}', carrying ${b0.carrying}, paused ${b0.elPaused}, ` +
           `demoted ${b0.demoted}) — the page is still a WebAudio graph, which is ` +
           `what the OS refuses to give a media session`);
      await page.click("#play");
      return;
    }
    if (!b0.carrierFirst) fail(`${plat}: carrierFirst is false on a mobile predicate`);
    else ok(`${plat}: carrier-first mode is on (mode '${b0.mode}', stage '${b0.stage}')`);
    // GENUINELY AUDIBLE MEDIA: muted media is not media, and a volume-0
    // element is not audible. Both are how you get a session the OS drops.
    if (b0.elMuted !== false || !(b0.elVolume > 0))
      fail(`${plat}: the element is not audible media before any hide ` +
           `(muted ${b0.elMuted}, volume ${b0.elVolume})`);
    else ok(`${plat}: before any hide the element is unmuted at volume ${b0.elVolume}`);
    // LET THE ANALYSER CATCH UP FIRST. window.__rms reads a 2048-sample window
    // — 46 ms of HISTORY — and the handoff is detected within milliseconds of
    // it, so the first read is still full of the graph's last quantum before
    // the mute. That is the tap's latency, not two sources: goCarrier() mutes
    // BEFORE it raises the element, and only then sets the flag this waited
    // on. Settle, then require silence in every sample.
    await page.waitForTimeout(300);
    const g0 = await rmsN(4, 250);
    const loud = g0.filter(v => v > RMS_FLOOR).length;
    if (loud) fail(`${plat}: the live graph still sounds under the element ` +
                   `(${loud}/4 samples, ${g0.map(v => v.toFixed(3)).join(" ")}) — two sources`);
    else ok(`${plat}: the graph is muted while the element carries — one source`);
    const t0 = await page.evaluate(() => window.__nuBounce().elTime);
    await page.waitForTimeout(700);
    const t1 = await page.evaluate(() => window.__nuBounce().elTime);
    if (!(t1 > t0 || t1 < t0))   // advancing, or wrapped past the loop end
      fail(`${plat}: el.currentTime is frozen at ${t0} — the element is not playing`);
    else ok(`${plat}: el.currentTime advances in the foreground (${t0.toFixed(2)} -> ${t1.toFixed(2)})`);

    // THE HIDE IS A NON-EVENT. That is the whole design: nothing to hand off
    // means nothing to race, and nothing for iOS to refuse.
    await hide();
    await page.waitForTimeout(900);
    const h = await page.evaluate(() => ({ b: window.__nuBounce(), rms: window.__rms() }));
    if (!h.b.carrying || h.b.elPaused !== false || !(h.b.elVolume > 0))
      fail(`${plat}: hiding changed the audible source ` +
           `(carrying ${h.b.carrying}, paused ${h.b.elPaused}, volume ${h.b.elVolume})`);
    else ok(`${plat}: hidden — the element is still the source, unchanged`);
    if (Math.abs(h.b.elVolume - b0.elVolume) > 1e-6)
      fail(`${plat}: the element's volume moved on hide ` +
           `(${b0.elVolume} -> ${h.b.elVolume}) — there is still a handoff here`);
    else ok(`${plat}: no volume handoff on hide (${h.b.elVolume} throughout)`);
    if (h.rms > RMS_FLOOR) fail(`${plat}: the graph woke up while hidden (RMS ${h.rms.toFixed(4)})`);
    const th0 = h.b.elTime;
    await page.waitForTimeout(700);
    const th1 = await page.evaluate(() => window.__nuBounce().elTime);
    if (th1 === th0) fail(`${plat}: the element stopped while hidden (${th0})`);
    else ok(`${plat}: the element keeps playing while hidden (${th0.toFixed(2)} -> ${th1.toFixed(2)})`);

    // …AND THE SHOW IS A NON-EVENT TOO. Handing back on return would drop the
    // media session every time the user looked at the page.
    await show();
    await page.waitForTimeout(1200);
    const v = await page.evaluate(() => ({ b: window.__nuBounce(), rms: window.__rms() }));
    if (!v.b.carrying || v.b.elPaused !== false)
      fail(`${plat}: the path flapped back to the graph on return ` +
           `(carrying ${v.b.carrying}, paused ${v.b.elPaused})`);
    else ok(`${plat}: return from hidden — the element is still the path`);
    if (v.rms > RMS_FLOOR)
      fail(`${plat}: the graph came back up under the carrier (RMS ${v.rms.toFixed(4)}) — ` +
           `double playback on return`);
    else ok(`${plat}: the graph stays muted on return — still one source`);

    // ── the lock screen: metadata, position, and handlers that WORK ──
    const m = await page.evaluate(() => {
      const x = window.__nuMedia();
      return { actions: x.actions, state: x.state, title: x.title, artist: x.artist,
               position: x.position, duration: x.duration };
    });
    for (const a of ["play", "pause", "stop", "seekto"])
      if (!m.actions.includes(a))
        fail(`${plat}: MediaSession has no '${a}' handler — the lock screen ` +
             `draws a control that does nothing`);
    ok(`${plat}: MediaSession actions [${m.actions.join(", ")}]`);
    if (!m.title || m.artist !== "stellate nukernel")
      fail(`${plat}: MediaSession metadata is wrong (title "${m.title}", artist "${m.artist}")`);
    else ok(`${plat}: MediaSession metadata "${m.title}" — ${m.artist}`);
    if (m.state !== "playing") fail(`${plat}: playbackState '${m.state}' while the tape plays`);
    else ok(`${plat}: playbackState 'playing'`);
    if (!(m.duration > 0)) fail(`${plat}: MediaSession duration ${m.duration} — no position slider`);
    else ok(`${plat}: position ${m.position.toFixed(2)}s of an honest ${m.duration.toFixed(2)}s`);
    // seekto must move THE TAPE — the audible thing — not just the transport
    const sk = await page.evaluate(async () => {
      const before = window.__nuBounce().elTime, dur = window.__nuMedia().duration;
      const target = (before + dur / 2) % dur;
      window.__nuMedia().fire("seekto", { action: "seekto", seekTime: target });
      await new Promise(r => setTimeout(r, 300));
      return { before, target, after: window.__nuBounce().elTime, dur };
    });
    // MEASURED ROUND THE WRAP. elTime is a PHASE — it is the position in the
    // loop, and the loop is now a whole box rather than the whole song, which
    // on this gate's song is 7.6 s. Seeking to the far side of a 7.6 s tape
    // lands near its end, and the 300 ms of playback this waits out carries
    // the phase past the wrap to ~0.0: a straight subtraction read that as
    // "the scrubber is decorative" about a scrubber that had just worked. So
    // the difference is taken modulo the loop, and the window is opened by the
    // 300 ms the tape was allowed to advance.
    const dt = ((sk.after - sk.target) % sk.dur + sk.dur) % sk.dur;
    const off = Math.min(dt, sk.dur - dt);
    if (off > 0.95)
      fail(`${plat}: seekto asked for ${sk.target.toFixed(2)}s and the tape sits at ` +
           `${sk.after.toFixed(2)}s of ${sk.dur.toFixed(2)}s (${off.toFixed(2)}s off, ` +
           `round the wrap) — the lock-screen scrubber is decorative`);
    else ok(`${plat}: seekto moves the tape (${sk.before.toFixed(2)} -> ` +
            `${sk.after.toFixed(2)}s, ${off.toFixed(2)}s off target)`);
    // pause/play, the two buttons a locked phone actually shows
    await page.evaluate(() => window.__nuMedia().fire("pause"));
    await page.waitForTimeout(600);
    const pz = await page.evaluate(() => ({ b: window.__nuBounce(),
      state: window.__nuMedia().state, rms: window.__rms() }));
    if (pz.b.elPaused !== true || pz.state !== "paused" || pz.rms > RMS_FLOOR)
      fail(`${plat}: the lock-screen pause left something running ` +
           `(elPaused ${pz.b.elPaused}, state '${pz.state}', graph RMS ${pz.rms.toFixed(4)})`);
    else ok(`${plat}: lock-screen pause stops the tape and the graph both`);
    await page.evaluate(() => window.__nuMedia().fire("play"));
    await page.waitForFunction(() => {
      const b = window.__nuBounce(); return b.carrying && b.elPaused === false;
    }, null, { timeout: 20000 }).catch(() => {});
    const rp = await page.evaluate(() => ({ b: window.__nuBounce(),
      state: window.__nuMedia().state, rms: window.__rms() }));
    if (!rp.b.carrying || rp.b.elPaused !== false || !(rp.b.elVolume > 0))
      fail(`${plat}: lock-screen play did not put the tape back ` +
           `(carrying ${rp.b.carrying}, paused ${rp.b.elPaused}, volume ${rp.b.elVolume})`);
    else ok(`${plat}: lock-screen play resumes the tape at volume ${rp.b.elVolume}`);
    if (rp.rms > RMS_FLOOR)
      fail(`${plat}: lock-screen play brought the graph up too (RMS ${rp.rms.toFixed(4)})`);
    await page.click("#play");                     // park the transport for the next boot
  };
  await carrierFirstPass("android");
  await carrierFirstPass("ios");

  // ── (G2) A PHONE EDIT IS HEARD WHEN ITS RE-RENDER LANDS, and the page says
  // so while it is on its way. The tradeoff is settled (Paul: "Less dynamic is
  // fine") — what is not permitted is a silent one, an edit that never lands,
  // or a swap that yanks the source mid-bar instead of at the loop wrap.
  {
    await boot("?bgtest=ios");
    await page.waitForFunction(() => {
      const b = window.__nuBounce(); return b.carrying && b.elPaused === false;
    }, null, { timeout: 40000 }).catch(() => {});
    const before = await page.evaluate(() => window.__nuBounce());
    if (!before.carrying) ok("carrier never took over — (G) already failed this; edit pass skipped");
    else {
      // a real musical edit through a real control: the tempo fader. Driven
      // as the finger drives it (value + 'input'), because .fill() on a range
      // is a Playwright convenience and this gate is about the real path.
      await page.evaluate(() => {
        const el = document.getElementById("bpm");
        el.value = "138";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      // PENDING, VISIBLY: the readout has to carry the news, because the sound
      // is deliberately behind the edit now
      const said = await page.waitForFunction(() =>
        /carrier: (re-)?rendering|swaps at the loop|new take/.test(
          document.getElementById("readout").textContent),
        null, { timeout: 8000 }).then(() => true).catch(() => false);
      if (!said) fail(`the readout never mentioned the pending re-render — the phone ` +
                      `goes quiet-ish for seconds with no explanation ` +
                      `("${(await page.textContent("#readout")).slice(0, 90)}")`);
      else ok("the readout announces the pending re-render");
      // and it must actually land and swap, ON A NEW GENERATION, without the
      // element ever stopping
      const landed = await page.waitForFunction((g) => {
        const b = window.__nuBounce();
        return b.gen > g && b.state === "ready" && !b.pending && b.carrying &&
               b.elPaused === false;
      }, before.gen, { timeout: 90000 }).then(() => true).catch(() => false);
      const after = await page.evaluate(() => ({ b: window.__nuBounce(), rms: window.__rms() }));
      if (!landed)
        fail(`the edit never reached the tape (gen ${before.gen} -> ${after.b.gen}, ` +
             `pending ${after.b.pending}, state '${after.b.state}') — on this path that ` +
             `is an instrument that ignores you`);
      else ok(`the edit reached the tape and swapped at the loop (gen ${before.gen} -> ${after.b.gen})`);
      if (after.rms > RMS_FLOOR)
        fail(`the graph came up during the swap (RMS ${after.rms.toFixed(4)}) — two sources`);
      else ok("the swap never brought the graph back up");
    }
    // leave the tempo as it was found: the store is flushed on pagehide and
    // the sections below re-load this song
    await page.evaluate(() => {
      const el = document.getElementById("bpm");
      el.value = "126";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
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
    await openEditor(p2);
    const s0 = p2.locator(".slot").nth(0);
    if ((await s0.getAttribute("aria-pressed")) !== "true") await s0.click();
    await p2.click("#seed");
    await closeEditor(p2);
    // the genre chips live in the GENRE cell's popup; Esc first, or its scrim
    // sits over #play
    await p2.locator(".box").first().locator(".bgenre").click();
    await p2.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
    // acid house wears its city-and-year label now ("every genre is a city
    // and a year", 102bb37) — the id is still `acid`, the chip says this
    // SCOPED TO THE POPOVER: the lab bench deals the same dated anchors as its
    // parent chips, so the label alone matches two buttons on the page now.
    await p2.locator("#rowpop .pchip", { hasText: /^Chicago 1987$/ }).click();
    await p2.keyboard.press("Escape");
    await p2.waitForSelector("#rowpop", { state: "hidden" });
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
