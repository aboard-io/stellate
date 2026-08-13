#!/usr/bin/env node
// test/browser/nukernel-audio.test.js — THE NUKERNEL AUDIO GATE.
//
//   node test/browser/nukernel-audio.test.js
//
// test/unit/nukernel.test.js proves the kernel emits the right EVENTS. It cannot
// see what happens to them afterwards, and everything that has actually gone
// wrong in the audio path went wrong after the events were correct:
//
//   * a Faust freq param has a declared range (DX7 stops at 1000 Hz,
//     bass_reese at 500) and writing past it does not throw, it CLAMPS — so
//     vaporwave's line put five different pitches on the same 1000 Hz and the
//     kernel was blameless;
//   * the WebAudio graph can be built, connected and scheduled and still emit
//     silence, which no event-level check can tell from music.
//
// So this gate asks two questions of the real browser:
//   (A) NOTHING CLAMPS. Every value written to a synth's freq param sits
//       strictly inside that param's own [minValue, maxValue]. Landing exactly
//       on a boundary is the signature of a clamp, and it is a failure.
//   (B) IT MAKES A SOUND. An AnalyserNode on the destination measures real
//       output RMS per genre — the artifact, not the intent.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8971;
const RMS_FLOOR = 0.01;                 // silence is ~1e-4; music here runs 0.2..0.6
const GENRES = ["Simple", "Fugue", "Acid house", "Vaporwave", "Blues", "Rock"];

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// Taps installed BEFORE any page script runs: wrap AudioWorkletNode so every
// param write is recorded against that param's declared range, and hang an
// analyser off whatever connects to the destination.
function taps() {
  window.__param = [];      // {node, path, value, min, max}
  window.__nodes = [];
  const OW = window.AudioWorkletNode;
  window.AudioWorkletNode = function (ctx, name, opts) {
    const n = new OW(ctx, name, opts);
    window.__nodes.push(name);
    try {
      for (const [p, a] of n.parameters) {
        const set = a.setValueAtTime.bind(a);
        a.setValueAtTime = (v, t) => {
          window.__param.push({ node: name, path: p, value: v,
                                min: a.minValue, max: a.maxValue });
          return set(v, t);
        };
      }
    } catch (e) { /* a node with no enumerable params */ }
    return n;
  };
  window.AudioWorkletNode.prototype = OW.prototype;

  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
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
  const browser = await launchChromium();   // the harness already passes the autoplay flag
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(taps);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });

  // one phrase, in the one box, for every genre in turn
  await page.locator(".slot").nth(0).click();
  await page.click("#seed");

  const seen = { rms: {}, worst: null };
  for (const g of GENRES) {
    await page.locator(".pchip", { hasText: new RegExp("^" + g + "$") }).click();
    await page.click("#play");
    await page.waitForTimeout(3500);                 // decode + a bar or two
    let peak = 0;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(180);
      const r = await page.evaluate(() => (window.__rms ? window.__rms() : 0));
      if (r > peak) peak = r;
    }
    seen.rms[g] = +peak.toFixed(4);
    await page.click("#play");                        // stop
    await page.waitForTimeout(120);
  }

  // (A) nothing clamps
  const writes = await page.evaluate(() => window.__param.filter(p => /\/freq$/.test(p.path)));
  const nodes = await page.evaluate(() => [...new Set(window.__nodes)]);
  console.log("  worklets instantiated:", nodes.join(", ") || "(none)");
  console.log("  freq writes captured :", writes.length);
  if (!writes.length) fail("no synth freq writes captured — the synth path never ran");
  else ok(`${writes.length} freq writes across ${new Set(writes.map(w => w.node)).size} voice(s)`);

  const clamped = writes.filter(w => w.value <= w.min + 1e-6 || w.value >= w.max - 1e-6);
  if (clamped.length) {
    const c = clamped[0];
    fail(`${clamped.length} freq write(s) sit ON a param boundary — that is a clamp, ` +
         `and different notes collapse onto one pitch. e.g. ${c.path}=${c.value} ` +
         `in [${c.min}..${c.max}]`);
  } else ok("every freq write is strictly inside its param's declared range");

  const out = writes.filter(w => w.value < w.min || w.value > w.max);
  if (out.length) fail(`${out.length} freq write(s) outside the declared range entirely`);
  else ok("no freq write exceeds its range");

  // (B) it makes a sound
  for (const g of GENRES) {
    if (seen.rms[g] >= RMS_FLOOR) ok(`${g}: peak RMS ${seen.rms[g]}`);
    else fail(`${g}: peak RMS ${seen.rms[g]} — that is silence (floor ${RMS_FLOOR})`);
  }

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  await browser.close(); await srv.close();
  console.log(`\nnukernel-audio: ${checks} checks` +
              (process.exitCode ? " — FAILURES ABOVE" : " pass"));
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
