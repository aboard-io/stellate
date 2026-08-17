#!/usr/bin/env node
// test/probes/nukernel-return.probe.js — HOW LONG IS THE HOLE WHEN YOU COME
// BACK, in milliseconds and in samples.
//
//   node test/probes/nukernel-return.probe.js
//
// Paul, on the build that shipped 2026-08-16: "there are definitely glitches
// when I come back in to the browser." The tape carries the song while the desk
// is quiet (audio/bounce.js), and coming back hands the ear to a live graph that
// has been PARKED — not pulled, therefore not computing, with a transport that
// has been counting bars without scheduling a note into any of them. The
// shipped handback dropped the quiet flag, took the very next bar line and
// hoped. This measures what that costs, and what the warm-up costs instead.
//
// WHY A PROBE AND NOT A GATE: the two readings have to be taken on the same
// page, on the same tape, by the same sampler, and one of them requires the OLD
// behaviour — which is why bounce.js keeps it as `?jumpcut` (the `?noseam`
// precedent). This is an instrument, hand-run, not in any npm script.
//
// WHAT IS SAMPLED, every 10 ms across the whole return:
//   rms       — window.__rms, an analyser hung off ctx.destination: what the
//               SPEAKER gets from the live graph, post-mute, post-fade
//   graphRms  — the master tap PRE-mute: what the graph is MAKING, audible or
//               not. The difference between the two is the crossfade itself
//   elVolume  — the tape's level, and elPaused, so the second source counts
//
// THE HOLE is the run of samples where NEITHER source is audible — rms under
// the floor and the element at zero — which is exactly what an ear hears as a
// glitch. Reported in ms and in samples at 44100.
"use strict";
const { serve, launchChromium } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SR = 44100;
const FLOOR = 0.01;

const sampler = () => {
  window.__ret = [];
  window.__retOn = () => {
    window.__ret = [];
    const t0 = performance.now();
    window.__retIv = setInterval(() => {
      const b = window.__nuBounce();
      window.__ret.push({
        t: +(performance.now() - t0).toFixed(1),
        rms: +window.__rms().toFixed(5),
        g: b.graphRms, v: b.elVolume, p: b.elPaused ? 1 : 0,
        c: b.carrying ? 1 : 0, k: b.parked ? 1 : 0, r: b.returning ? 1 : 0,
        f: b.returnFrac,
        L: (() => { const e = document.querySelector(".posload");
                    return e && document.getElementById("readout")
                      .classList.contains("loading") ? 1 : 0; })(),
      });
    }, 10);
  };
  window.__retOff = () => { clearInterval(window.__retIv); return window.__ret; };
};

const taps = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
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
};

// the runs of samples in which NOTHING is audible, and the runs in which BOTH
// are — the two failures the return can have. A single 10 ms sample is the
// resolution; anything shorter than one sample is below this instrument.
function analyse(rows) {
  let hole = 0, holeAt = null, both = 0, run = 0, bestRun = 0, bestAt = null;
  for (const r of rows) {
    const live = r.rms > FLOOR, tape = r.v > 0.02 && !r.p;
    if (!live && !tape) {
      run++; if (run > bestRun) { bestRun = run; bestAt = r.t - (run - 1) * 10; }
      hole++;
    } else run = 0;
    if (live && tape && r.rms > FLOOR * 4 && r.v > 0.5) both++;
  }
  holeAt = bestAt;
  return { holeMs: bestRun * 10, holeAt, holeSamples: Math.round(bestRun * 10 * SR / 1000),
           holeTotalMs: hole * 10, bothMs: both * 10 };
}

(async () => {
  const srv = await serve(ROOT, 8981);
  const PORT = srv.port;
  const browser = await launchChromium();

  const run = async (label, qs) => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.addInitScript(taps);
    await page.addInitScript(sampler);
    // ?idle=90000 — the desk must NOT hand itself back over mid-measurement, so
    // the handover is driven by the one signal Paul's report is about: the tab
    // being hidden and then looked at again.
    await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html?idle=90000${qs}`,
      { waitUntil: "networkidle" });
    await page.locator(".box").first().locator(".bch").first().click();
    await page.waitForFunction(() =>
      document.getElementById("chassis").dataset.page === "compose", null, { timeout: 10000 });
    const slot0 = page.locator(".slot").nth(0);
    if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
    await page.click("#seed");
    await page.click("#play");
    await page.waitForFunction(() => window.__rms && window.__rms() > 0.01, null, { timeout: 30000 });
    // the FULL tape — a desk never carries a fragment
    await page.waitForFunction(() =>
      window.__nuBounce().state === "ready" && window.__nuBounce().stage === "full",
      null, { timeout: 240000 });
    // ...and then LOOK AWAY. A hidden tab is Paul's report exactly, and it is
    // the worst case for the return: hidden, the transport's lookahead is two
    // seconds, so the bar counter runs that far in front of the clock while
    // nothing is being scheduled into it.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState",
        { get: () => window.__vis || "visible", configurable: true });
      window.__vis = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const carried = await page.waitForFunction(() => {
      const b = window.__nuBounce();
      return b.desk && b.carrying && b.parked && b.elPaused === false;
    }, null, { timeout: 40000 }).then(() => true).catch(() => false);
    if (!carried) {
      const b = await page.evaluate(() => window.__nuBounce());
      console.log(`  ${label}: the desk never handed over —`, JSON.stringify(b).slice(0, 300));
      await page.close();
      return null;
    }
    await page.waitForTimeout(3000);               // hidden, parked, on tape

    // THE RETURN, as a person performs it: the tab becomes visible again.
    await page.evaluate(() => window.__retOn());
    await page.waitForTimeout(120);
    const bpmDur = await page.evaluate(() => {
      window.__vis = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
      return window.__nuBounce().durSec;
    });
    await page.waitForTimeout(9000);
    const rows = await page.evaluate(() => window.__retOff());
    const b = await page.evaluate(() => window.__nuBounce());
    await page.close();
    return { label, rows, b, bpmDur };
  };

  const report = (r) => {
    if (!r) return;
    const { rows, b, label } = r;
    const a = analyse(rows);
    const touchAt = 120;
    const firstLive = rows.find(x => x.rms > FLOOR && x.t > touchAt);
    const firstMade = rows.find(x => x.g > 0.004 && x.t > touchAt);
    const crossed = rows.find(x => x.c === 0 && x.t > touchAt);
    const loader = rows.filter(x => x.L === 1);
    console.log(`\n── ${label} ─────────────────────────────`);
    console.log(`  touch at ${touchAt} ms of the sample window`);
    console.log(`  graph MAKING sound at  ${firstMade ? (firstMade.t - touchAt).toFixed(0) : "never"} ms after the touch`);
    console.log(`  graph AUDIBLE at       ${firstLive ? (firstLive.t - touchAt).toFixed(0) : "never"} ms`);
    console.log(`  tape released at       ${crossed ? (crossed.t - touchAt).toFixed(0) : "never"} ms`);
    console.log(`  THE HOLE:              ${a.holeMs} ms  (${a.holeSamples} samples @44.1k)` +
                (a.holeAt != null ? `, starting ${(a.holeAt - touchAt).toFixed(0)} ms after the touch` : ""));
    console.log(`  total silent samples:  ${a.holeTotalMs} ms across the whole return`);
    console.log(`  both sources up:       ${a.bothMs} ms`);
    console.log(`  loader visible:        ${loader.length * 10} ms` +
                (loader.length ? `, ${loader[0].f} -> ${loader[loader.length - 1].f}` : ""));
    console.log(`  bounce says: returnMs ${b.returnMs}, stalled ${b.returnStalled}, carrying ${b.carrying}`);
    // the shape of it, 40 ms per character: · nothing, t tape, g graph, X both
    const glyph = rows.filter((_, i) => i % 4 === 0).map(x => {
      const live = x.rms > FLOOR, tape = x.v > 0.02 && !x.p;
      return live && tape ? "X" : live ? "g" : tape ? "t" : "·";
    }).join("");
    console.log(`  ${glyph}`);
  };

  const before = await run("BEFORE — ?jumpcut, the shipped handback", "&jumpcut");
  report(before);
  const after = await run("AFTER — the warm-up and the crossfade", "");
  report(after);

  await browser.close();
  srv.close();
})();
