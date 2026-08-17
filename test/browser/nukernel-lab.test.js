#!/usr/bin/env node
// test/browser/nukernel-lab.test.js — THE LAB PLAYS WHAT YOU ARE MIXING.
//
//   node test/browser/nukernel-lab.test.js
//
// Paul, 2026-08-17: "When I select genres and move sliders, adjust the
// OTHER sliders. Start playing the genre mix right away and take over the
// audio… As I change sliders and select genres, transition in one bar to
// the new mix… Get rid of all the other info." ui/lab.js's own §-comments
// prove nothing by themselves — a check that only reads the source it just
// wrote is not a check (this project's own "test the artifact" law). So
// this gate reads the RENDERED page: real audio through a real AnalyserNode,
// the model's own probe (window.__nuLab), and the DOM text a person would
// actually see.
//
//   (A) picking two genres takes over the transport and MAKES A SOUND —
//       auditioning flips true immediately and real RMS crosses the floor
//       within one generous bar (the same conservative bound
//       test/browser/nukernel-audio.test.js uses for a genre's own bucket).
//   (B) dragging one weight slider RENORMALISES THE OTHERS — the model's
//       own weights always sum to 1, mid-drag and after.
//   (C) that settled drag changes the AUDIBLE mix (spectral shape moves)
//       WITHOUT A RESTART (RMS never drops to silence across the change) —
//       the one-bar update-in-place, not a stop/start click.
//   (D) no analytical text survives on the page: no provenance, no novelty
//       verdict, no field-by-field ledger — the DOM says none of the words
//       ui/lab.js used to print.
//
// The AnalyserNode tap is test/browser/nukernel-audio.test.js's own taps(),
// trimmed to the two readings this gate needs (RMS, spectrum) — same
// mechanism, not a second one.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8974;                 // a PREFERENCE — the harness walks past a busy port
const RMS_FLOOR = 0.01;          // nukernel-audio.test.js's own silence floor

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

function taps() {
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
    window.__spec = () => {
      const n = an.frequencyBinCount, d = new Float32Array(n);
      an.getFloatFrequencyData(d);
      return Array.from(d.slice(0, 512), (db) => Math.pow(10, db / 20));
    };
    return c;
  };
}
const corr = (a, b) => {
  const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y;
  }
  return num / Math.sqrt(da * db);
};

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  // PHONE WIDTH, deliberately: under 899px is where the page rail is real
  // navigation (one page visible at a time) rather than the desk's "every
  // page at once" — the surface this gate's page-leave law (ui/lab.js
  // `on("page", …)`) and the .pkey click actually exercise.
  const page = await browser.newPage({ viewport: { width: 414, height: 950 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(taps);
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html`,
    { waitUntil: "networkidle" });

  // to the lab, and wait for the bench (its ~123 KB analysis tier fetches on
  // first sight of the tab — ui/lab.js §2)
  await page.click('.pkey[data-page="lab"]');
  await page.waitForFunction(() => window.__nuLab && window.__nuLab().loaded,
    null, { timeout: 20000 });
  ok("the bench loaded");

  // (A) pick two genres — the first pick starts the audition synchronously
  // (ui/lab.js reaudition: no scratch yet -> startAudition() with no debounce),
  // the second updates the mix in place
  const chips = page.locator("#labwrap .labchips .pchip");
  const n = await chips.count();
  if (n < 2) fail(`the lab's chip bank only has ${n} genres — cannot pick two`);
  else ok(`the chip bank deals ${n} genres`);
  const t0 = Date.now();
  await chips.nth(0).click();
  await page.waitForFunction(() => window.__nuLab().parents.length === 1,
    null, { timeout: 5000 });
  const auditFlips = await page.evaluate(() => window.__nuLab().auditioning);
  if (!auditFlips) fail("picking the first genre did not start an audition (auditioning is false)");
  else ok("picking a genre starts the audition immediately (auditioning flips true)");

  // real sound, within one generous bar — the same conservative bound
  // nukernel-audio.test.js uses for a genre's own worst-case bucket
  let peak = 0, gotSound = false;
  for (let i = 0; i < 40 && !gotSound; i++) {
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => (window.__rms ? window.__rms() : 0));
    if (r > peak) peak = r;
    if (r >= RMS_FLOOR) gotSound = true;
  }
  const startedMs = Date.now() - t0;
  if (!gotSound) fail(`no audio within ${startedMs} ms of the first pick (peak RMS ${peak.toFixed(4)})`);
  else ok(`the transport is audibly playing the lab within ${startedMs} ms (peak RMS ${peak.toFixed(4)})`);

  await chips.nth(1).click();
  await page.waitForFunction(() => window.__nuLab().parents.length === 2,
    null, { timeout: 5000 });
  ok("a second genre joins the mix");

  // (B) THE MIX RENORMALISES. Two parents, so w0 + w1 === 1 always — read
  // straight off the model, not off a percentage printed anywhere (there is
  // none any more; see (D)).
  const w2 = await page.evaluate(() => window.__nuLab().weights);
  if (w2.length !== 2 || Math.abs(w2[0] + w2[1] - 1) > 1e-3)
    fail(`two parents' weights do not sum to 1: ${JSON.stringify(w2)}`);
  else ok(`two parents' weights sum to 1: ${w2.map((x) => x.toFixed(3)).join(" + ")}`);

  // drag the FIRST slider hard the other way and check the model renormalises
  // mid-drag too, not only once it settles
  const slider0 = page.locator("#labwrap .labw .labwr").first();
  const dragTo = async (pct) => {
    await slider0.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, pct);
  };
  await dragTo(15);
  const wMid = await page.evaluate(() => window.__nuLab().weights);
  await dragTo(88);
  const wEnd = await page.evaluate(() => window.__nuLab().weights);
  const sumOk = (w) => Math.abs(w[0] + w[1] - 1) <= 1e-3;
  if (!sumOk(wMid) || !sumOk(wEnd))
    fail(`dragging left the mix not summing to 1 (mid ${JSON.stringify(wMid)}, end ${JSON.stringify(wEnd)})`);
  else ok(`dragging one slider renormalises the other at every step ` +
          `(mid ${wMid.map((x) => x.toFixed(2)).join("/")}, ` +
          `end ${wEnd.map((x) => x.toFixed(2)).join("/")})`);
  if (Math.abs(wEnd[0] - 0.88) > 0.02)
    fail(`the dragged slider did not land near 0.88 (read ${wEnd[0]})`);
  else ok(`the dragged slider's own share reads back what the finger set (${wEnd[0].toFixed(2)})`);

  // (C) THE AUDIBLE MIX CHANGES ON THE NEXT BAR, WITHOUT A RESTART. Sample the
  // spectrum before the drag (already playing the 50/50-ish blend above),
  // then watch RMS continuously across the debounce + transition window —
  // a restart would show as a silence gap, an in-place update should not.
  const spec = async (secs) => {
    let acc = null, m = 0;
    for (let i = 0; i < secs * 5; i++) {
      await page.waitForTimeout(200);
      const v = await page.evaluate(() => window.__spec());
      acc = acc ? acc.map((x, j) => x + v[j]) : v; m++;
    }
    return acc.map((x) => x / m);
  };
  const before = await spec(2);
  await dragTo(92);                     // a hard, decisive push toward parent 0
  let seenBelowFloor = 0, samples = 0;
  const t1 = Date.now();
  while (Date.now() - t1 < 3600) {       // debounce (220ms) + a generous bar margin
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => window.__rms());
    samples++;
    if (r < RMS_FLOOR) seenBelowFloor++;
  }
  if (seenBelowFloor / samples > 0.15)
    fail(`the transition looks like a restart: ${seenBelowFloor}/${samples} samples ` +
         `dropped to silence while the mix changed`);
  else ok(`the mix changes with no restart click: ${seenBelowFloor}/${samples} ` +
          `samples silent across the transition (continuous playback)`);
  const after = await spec(2);
  const r = corr(before, after);
  if (r >= 0.985)
    fail(`pushing the mix hard toward one parent left the spectral shape at ` +
         `${r.toFixed(4)} correlation — the audible mix did not change`);
  else ok(`the audible mix changed after the slider settled: shape correlation ${r.toFixed(4)}`);

  // (D) NO ANALYTICAL TEXT SURVIVES. The old page printed a provenance table
  // ("plucked from…", "combined", "snapped to a parent's own value"), a
  // novelty verdict ("wearing a hat", "cousin of…", "nearest … at …"), and a
  // field-by-field ledger with "why" paragraphs under every row. None of it
  // may still be VISIBLE text — it is fine (required, even) that it still
  // exists as a `title` attribute, which innerText does not surface.
  const text = await page.locator("#labwrap").innerText();
  const banned = [
    /plucked from/i, /snapped to/i, /combined \(/i, /wearing a hat/i,
    /cousin of/i, /nearest .* at /i, /the table's own neighbours/i,
    /architecture — what the parents/i, /material — the machine/i,
    /passes every law/i, /error\(s\)/i,
  ];
  const hit = banned.find((re) => re.test(text));
  if (hit) fail(`analytical text survives on the page (matched ${hit}): ${JSON.stringify(text.slice(0, 400))}`);
  else ok(`no analytical text on the page (${text.length} visible chars, ` +
          `sample: ${JSON.stringify(text.slice(0, 120))})`);
  // and the tooltip law: the roll keys and Keep still carry the reasoning,
  // just not as visible text
  const rollTitle = await page.locator("#labwrap .labroll").first().getAttribute("title").catch(() => null);
  if (!rollTitle) fail("a roll key has no title tooltip — the reasoning was deleted, not hidden");
  else ok(`a roll key's reasoning survives as a tooltip: ${JSON.stringify(rollTitle.slice(0, 80))}`);

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  console.log(checks + " checks");
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error(e); process.exit(1); });
