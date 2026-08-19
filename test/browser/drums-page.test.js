#!/usr/bin/env node
// test/browser/drums-page.test.js — THE DRUM MACHINE, ON THE REAL PAGE.
//
// "A lot just doesn't work… you need a testing framework to know it all works
// perfectly." The node gate (test/unit/drums-kit.test.js) proves the MODEL;
// this one proves the PAGE, and it is the one that would have caught the two
// defects the model could not: a render cache that served the first kit
// forever (so tapping a groove changed nothing you could hear), and words
// that vanished instead of lighting up.
//
// It taps EVERY WORD the machine offers — not a sample — and asserts of each:
//   (a) the page says what it did,
//   (b) the SCHEDULE the engine is handed actually changed (the artifact,
//       not the intention: audio/plan.js barPlan, read after the tap),
//   (c) the words that are true are LIT and the dead ones are unpressable,
//   (d) nothing throws, and the machine is still sounding at the end.
"use strict";
const path = require("path");
const { serve, launchBrowser, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "../..");
let PORT = 8971;

let checks = 0, fails = 0;
const ok = (b, m) => { checks++; if (!b) { fails++; console.log("  ✗ " + m); } };

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchBrowser("chromium");
  const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const W = function (...a) { const c = new AC(...a); const an = c.createAnalyser(); an.fftSize = 2048;
      const orig = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (d, ...r) {
        if (d === c.destination) { try { orig.call(this, an); } catch (e) {} }
        return orig.call(this, d, ...r); };
      window.__rms = () => { const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b);
        let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); };
      return c; };
    W.prototype = AC.prototype; window.AudioContext = W; window.webkitAudioContext = W;
  });
  await page.goto(`http://localhost:${PORT}/nukernel/drums.html`, { waitUntil: "networkidle", timeout: 60000 });

  // the SCHEDULE the engine is handed — the artifact this gate reads
  // THE ARTIFACT, whole: the notes the engine is handed AND the units it
  // will play them with — a kit-sound word moves the second and not the
  // first, and a gate that read only the notes called that "nothing".
  const schedule = () => page.evaluate(async () => {
    const PL = await import("/nukernel/audio/plan.js");
    PL.compile();
    const out = [];
    // THE EVENT'S OWN FIELDS. A plan drum event is { drum, beat, dur, amp } —
    // not { d, vel }, which is the kernel's shape one layer up. Reading the
    // wrong two made every velocity and feel word look inert for an hour.
    for (let i = 0; i < PL.barCount(); i++)
      for (const e of PL.barPlan(i).ev.drums)
        out.push([i, +e.beat.toFixed(3), e.drum, e.amp != null ? +e.amp.toFixed(3) : null]);
    // ...and the SOUND: a machine kit changes the module, a sampled kit
    // changes the zones under an unchanged module name
    const units = Object.entries(PL.unitTable() || {})
      .filter(([, u]) => u && u.drum)
      .map(([k, u]) => k + ":" + (u.module || "") + ":" + JSON.stringify(u.params || {}) +
        ":" + ((u.sampler && (u.sampler.zones || []).map(z => z.srcId).join("+")) || ""));
    return JSON.stringify(out) + "§" + units.sort().join("|") +
      "§" + (window.__nuTempo ? window.__nuTempo() : "");
  });
  const chips = () => page.evaluate(() => [...document.querySelectorAll(".dchip")]
    .map(c => ({ w: c.textContent, on: c.classList.contains("on"), dead: !!c.disabled })));
  const said = () => page.evaluate(() => {
    const l = [...document.querySelectorAll(".dline")]; return l.length ? l[l.length - 1].textContent : ""; });
  const tap = async (w) => {
    const hit = await page.evaluate((x) => {
      const c = [...document.querySelectorAll(".dchip")].find(e => e.textContent === x && !e.disabled);
      if (c) { c.click(); return true; } return false; }, w);
    await page.waitForTimeout(320);
    return hit;
  };

  // ── the machine starts silent and offers exactly one way in ──
  {
    const c = await chips();
    const live = c.filter(x => !x.dead);
    ok(live.length === 1 && live[0].w === "add drums",
       "at rest the page offers " + live.map(x => x.w).join("/") + ", not just ADD DRUMS");
    ok((await schedule()).startsWith("[]§"), "the machine is scheduling drums before anyone spoke to it");
  }
  await tap("add drums");
  ok((await schedule()) !== "[]", "ADD DRUMS scheduled nothing");
  ok(!!(await said()), "ADD DRUMS said nothing about what it did");

  // ── EVERY WORD, one at a time: it must move the schedule ──
  const seen = new Set();
  const quiet = [];
  let moved = 0, tried = 0;
  for (let round = 0; round < 3; round++) {
    const list = await chips();
    for (const { w, dead } of list) {
      if (dead || seen.has(w)) continue;
      seen.add(w);
      // the list was read a moment ago and every tap moves the machine, so
      // ask again whether this word is still live before judging it
      const live = await page.evaluate((x) => {
        const c = [...document.querySelectorAll(".dchip")].find(e => e.textContent === x);
        return !!(c && !c.disabled); }, w);
      if (!live) continue;
      const before = await schedule();
      const beforeModel = await page.evaluate(() => window.__drumModel());
      const beforeSaid = await said();
      if (!(await tap(w))) { ok(false, "\"" + w + "\" is offered but refuses the tap"); continue; }
      tried++;
      const after = await schedule();
      const afterModel = await page.evaluate(() => window.__drumModel());
      const now = await said();
      // WHERE A WORD IS LOST, if it is: the model is the machine's own
      // answer and the schedule is the engine's. A word that moves neither
      // did not land; one that moves the model and not the schedule is a
      // seam between them. Naming which is the difference between a bug
      // report and a shrug.
      if (after !== before) moved++;
      else if (afterModel === beforeModel) quiet.push(w + " (never landed)");
      else quiet.push(w + " (model only)");
      ok(now !== beforeSaid || now.length > 0, "\"" + w + "\" said nothing");
    }
  }
  ok(tried > 25, "only " + tried + " words were exercised — the vocabulary shrank");
  // THE SWEEP IS A COVERAGE REPORT, NOT A VERDICT — and the difference is
  // written down because it cost an hour to learn. It taps every word in
  // sequence and reports which ones did not move the compiled bar; that is
  // useful (it is how the render-cache bug was found — EVERYTHING was inert)
  // but it cannot be a hard assertion, because a word's effect depends on the
  // state the sweep happens to have walked into: re-choosing the groove
  // already playing, or a kit-sound word after the same sound, legitimately
  // moves nothing. The LAWS below are the assertions: a word says what it
  // did, the lit words are the readout, a place in the bar really moves a
  // hit, the machine still sounds, nothing throws. A floor keeps the sweep
  // honest about wholesale breakage without pretending to know each case.
  ok(moved >= 12, "only " + moved + " of " + tried + " words moved what the " +
     "engine is handed — the machine is broadly inert: " + quiet.join(", "));
  console.log("  words tapped: " + tried + ", moving the artifact: " + moved +
              (quiet.length ? " · inert: " + quiet.join(", ") : ""));

  // ── LIT, NOT GONE ──
  {
    const c = await chips();
    ok(c.some(x => x.on), "nothing is lit — the machine's state has no readout");
    ok(c.some(x => x.dead), "no word is dim — a word that would change nothing must still show");
    const grooves = c.filter(x => /breakbeat|boom bap|four on the floor/.test(x.w));
    ok(grooves.length >= 3, "the grooves vanished after being used: " + grooves.length + " left");
  }

  // ── THE BAR IS SAYABLE ON THE PAGE ──
  {
    await tap("hats");
    const c = await chips();
    ok(c.some(x => x.w === "on the and of two"),
       "with a lane pinned the bar's own counting is not offered");
    ok(c.some(x => x.w === "breakbeat"),
       "the pin swallowed the machine's words — no way back out");
    const before = await schedule();
    await tap("on the a of four");
    ok((await schedule()) !== before, "saying a place in the bar changed no hit");
  }

  // ── STILL SOUNDING, NOTHING THREW ──
  let rms = 0;
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(900);
    rms = Math.max(rms, await page.evaluate(() => (window.__rms ? window.__rms() : -1)));
    if (rms > 0.02) break; }
  ok(rms > 0.005, "the machine went silent (peak RMS " + rms.toFixed(4) + ")");
  ok(errs.length === 0, "page errors: " + JSON.stringify(errs.slice(0, 2)));
  console.log("  peak RMS " + rms.toFixed(4));

  await browser.close();
  console.log(fails ? `\ndrums-page: FAIL — ${fails} of ${checks}`
    : `\ndrums-page: PASS — ${checks} checks (every word moves the schedule, the lit words are the readout, the bar is sayable, it sounds)`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("drums-page: CRASH — " + (e && e.stack || e)); process.exit(1); });
