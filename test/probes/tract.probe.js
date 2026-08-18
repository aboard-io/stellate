#!/usr/bin/env node
// test/probes/tract.probe.js — VERIFICATION PROBE: is the tube audibly a MOUTH?
//
//   node test/probes/tract.probe.js
//
// test/unit/tract-cast.test.js proves REACHABILITY at the score level — which
// records ask for engine/faust/dsp/tract_voice.dsp, that the module is on disk,
// that every knob written is a knob it has, that no genre seats more than one.
// None of that is a sound. This is the ear's half, run once in a real browser on
// the really-compiled wasm, and it asks the only question the score cannot:
//
//   IS IT A MOUTH, OR IS IT A FILTERED SAW WITH A GOOD STORY?
//
// THE MEASUREMENT, and why it is this one. A vowel and a fricative differ most
// obviously in where their energy sits, and the cheapest honest proxy for that
// with no FFT in the room is the ZERO-CROSSING RATE: a voiced /a/ at 130 Hz
// crosses zero a few hundred times a second, an /s/ crosses several thousand.
// So a mouth SPEAKING has a zero-crossing rate that swings by an order of
// magnitude, several times a second, inside one held note — that IS the
// consonant — while a filtered saw holding the same note has a zero-crossing
// rate that barely moves at all, because a sawtooth through a fixed lowpass is
// the same waveform for as long as you hold it.
//
// So the probe renders three seconds of each, offline, in chromium, at one
// pitch with the gate held down the whole time, and prints the two ZCR
// trajectories. The tract must swing and the saw must not. It also plays the
// three cast genres on the real page and confirms a tract_voice worklet is in
// the graph and the master is making a sound — the 404-at-the-worklet failure,
// which is a silence nothing else notices.
// MEASURED 2026-08-18, chromium, 48 kHz, three seconds at 130 Hz with the gate
// held down for all of it:
//
//   tract_voice   zcr  min 400  med 1200  p90 4800  max 10500   fricative 18%
//   pad_saw       zcr  min   0  med  700  p90  800  max   900   fricative  0%
//
// Eighteen percent of the tube's frames are crossing zero faster than 2 kHz and
// none of the saw's ever do; the tube's timbre travels x4.0 inside the note and
// the saw's x1.14. That is a mouth. And on the real page all three cast records
// play — engine ready, direct route, nothing unrouted, exactly one tract_voice
// unit each, master RMS 0.036 to 0.30.
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", "..");

(async () => {
  const srv = await serve(ROOT, 8799);
  const browser = await launchChromium();
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.goto(`http://localhost:${srv.port}/test/browser/live-test.html`);

  // ---- 1. THE A/B, OFFLINE, ON THE COMPILED WASM --------------------------
  const ab = await page.evaluate(async () => {
    const { FaustWasmInstantiator, FaustMonoDspGenerator } =
      await import("/engine/faust/node_modules/@grame/faustwasm/dist/esm/index.js");
    const SR = 48000, SEC = 3;

    async function render(dsp, sets) {
      const ctx = new OfflineAudioContext(1, SR * SEC, SR);
      const fac = await FaustWasmInstantiator.loadDSPFactory(
        `/engine/faust/dist/${dsp}-module.wasm`, `/engine/faust/dist/${dsp}-meta.json`);
      const node = await new FaustMonoDspGenerator().createNode(ctx, dsp, fac);
      const P = (name) => {
        for (const k of node.parameters.keys()) if (k.endsWith("/" + name)) return node.parameters.get(k);
        return null;
      };
      const missing = [];
      for (const [k, v] of Object.entries(sets)) {
        const p = P(k); if (!p) { missing.push(k); continue; }
        p.setValueAtTime(v, 0);
      }
      node.connect(ctx.destination);
      const buf = await ctx.startRendering();
      return { pcm: Array.from(buf.getChannelData(0)), missing, params: [...node.parameters.keys()].length };
    }

    // per-10ms zero-crossing rate, in crossings per second, over frames that
    // actually carry signal (a rest has no timbre to measure)
    const zcr = (pcm) => {
      const hop = 480, out = [];
      for (let i = 0; i + hop < pcm.length; i += hop) {
        let z = 0, e = 0;
        for (let j = i + 1; j < i + hop; j++) {
          if ((pcm[j] >= 0) !== (pcm[j - 1] >= 0)) z++;
          e += pcm[j] * pcm[j];
        }
        const rms = Math.sqrt(e / hop);
        if (rms > 3e-4) out.push(z * (48000 / hop));
      }
      return out;
    };
    const stat = (a) => {
      if (!a.length) return null;
      const s = a.slice().sort((x, y) => x - y);
      const med = s[(s.length * 0.5) | 0], p90 = s[(s.length * 0.9) | 0];
      return { n: a.length, min: s[0], med, p90, max: s[s.length - 1],
        // THE TWO NUMBERS THE VERDICT READS.
        //   fric  the share of frames crossing zero faster than 2 kHz. That is a
        //         FRICATIVE, and a 130 Hz sawtooth through a 6 kHz lowpass cannot
        //         produce one at any setting: its waveform has one crossing per
        //         cycle plus whatever the filter left, and it is the same
        //         waveform for as long as the note is held.
        //   swing p90 over the median — how far the timbre travels inside one
        //         note. A vowel moving to a consonant and back is a big number;
        //         a filter sitting still is 1.
        fric: a.filter(x => x > 2000).length / a.length,
        swing: p90 / Math.max(1, med) };
    };
    const rms = (pcm) => Math.sqrt(pcm.reduce((p, c) => p + c * c, 0) / pcm.length);

    // the mouth, speaking: one pitch, gate held for the whole three seconds, the
    // driver doing all the moving
    const mouth = await render("tract_voice", {
      freq: 130, gate: 1, babble: 0.85, rate: 4, seed: 7, vowel: 2,
      push: 0.5, breath: 0.06, level: 0.7, gain: 0.6, cutoff: 9000, attack: 0.02 });
    // ...and the thing it must not be: a saw through a fixed lowpass, same pitch,
    // same three seconds, same gate
    const saw = await render("pad_saw", {
      freq: 130, gate: 1, cutoff: 6000, level: 0.7, gain: 0.6, attack: 0.02 });

    return { mouth: { rms: rms(mouth.pcm), zcr: stat(zcr(mouth.pcm)), missing: mouth.missing, params: mouth.params },
             saw: { rms: rms(saw.pcm), zcr: stat(zcr(saw.pcm)), missing: saw.missing } };
  });

  console.log("\n--- the A/B, three seconds, one pitch, gate held ---");
  console.log("tract_voice  rms", ab.mouth.rms.toFixed(4), " params", ab.mouth.params,
              " unwritable:", JSON.stringify(ab.mouth.missing));
  console.log("             zcr", JSON.stringify(ab.mouth.zcr));
  console.log("pad_saw      rms", ab.saw.rms.toFixed(4));
  console.log("             zcr", JSON.stringify(ab.saw.zcr));
  const M = ab.mouth.zcr, S = ab.saw.zcr;
  const verdict = M && S && M.fric > 0.05 && S.fric < 0.01 && M.swing > 2 && M.swing > S.swing * 2;
  console.log(verdict
    ? "VERDICT: a mouth — " + (M.fric * 100).toFixed(0) + "% of frames are fricative " +
      "(the saw: " + (S.fric * 100).toFixed(0) + "%), and the timbre travels x" +
      M.swing.toFixed(1) + " inside one held note against the saw's x" + S.swing.toFixed(2)
    : "VERDICT: NOT A MOUTH — fric " + (M && M.fric) + " vs " + (S && S.fric) +
      ", swing " + (M && M.swing) + " vs " + (S && S.swing));

  // ---- 2. THE REAL PAGE ----------------------------------------------------
  // the 404-at-the-worklet failure: a cast that resolves perfectly and never
  // instantiates. Play each talking genre and look for the module in the graph.
  const p2 = await browser.newPage();
  const errs2 = capturePageErrors(p2);
  // the same destination tap test/browser/nukernel-engine.test.js installs — the
  // artifact, not the intention: an analyser on whatever actually reaches
  // ctx.destination, so "it sounds" is a measured number and not a state field
  await p2.addInitScript(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const W = function (...a) {
      const c = new AC(...a);
      const an = c.createAnalyser(); an.fftSize = 2048;
      const orig = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dest, ...rest) {
        if (dest === c.destination) { try { orig.call(this, an); } catch (e) {} }
        return orig.call(this, dest, ...rest);
      };
      window.__rms = () => {
        const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
        let e = 0; for (let i = 0; i < d.length; i++) e += d[i] * d[i];
        return Math.sqrt(e / d.length);
      };
      return c;
    };
    W.prototype = AC.prototype;
    window.AudioContext = W; window.webkitAudioContext = W;
  });
  await p2.goto(`http://localhost:${srv.port}/nukernel/kernel-daw.html`, { waitUntil: "networkidle" });
  for (const gk of ["electro", "roboticpop", "ebm"]) {
    await p2.evaluate((x) => { document.getElementById("composeg").value = x; }, gk);
    await p2.click("#compose");
    await p2.waitForTimeout(9000);
    const rms = [];
    for (let i = 0; i < 8; i++) {
      await p2.waitForTimeout(900);
      rms.push(await p2.evaluate(() => Math.max(window.__rms ? window.__rms() : -1,
        (window.__nuEngine && window.__nuEngine().rms) || -1)));
    }
    const r = await p2.evaluate(() => {
      const m = window.__nuMix(), b = window.__nuBounce();
      const keys = Object.keys(m.units);
      const tract = keys.filter((k) => m.units[k].module === "tract_voice");
      return { units: keys.length, tract: tract.length, rms: b.rms != null ? b.rms : null,
               state: b.state, route: b.route, unrouted: b.unrouted,
               where: tract.map((k) => k + " pool=" + m.units[k].pool +
                 (m.units[k].params ? " babble=" + m.units[k].params.babble +
                   " rate=" + (+m.units[k].params.rate).toFixed(2) +
                   " seed=" + m.units[k].params.seed : "")) };
    });
    console.log(gk, JSON.stringify(r), " rms " +
      Math.min(...rms).toFixed(4) + ".." + Math.max(...rms).toFixed(4));
  }
  if (errs.length) console.log("page errors (harness):", errs.slice(0, 5));
  if (errs2.length) console.log("page errors (daw):", errs2.slice(0, 5));

  await browser.close(); srv.close();
  process.exit(verdict ? 0 : 1);
})();
