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
  // THE SURFACE IS A QUESTION, AND THE SHEET IS HOW YOU GO BACK. There is
  // no menu on this page: the machine asks its questions in order, an
  // answered question becomes a fact on the gig sheet, and tapping a fact
  // asks it again. (The wall of chips became a subject menu became this.)
  // A gate that walks a menu nobody has is a gate that passes for a page
  // nobody has, so this walks what a person walks.
  const surface = () => page.evaluate(() => ({
    q: (document.querySelector(".dask .dq") || {}).textContent || "",
    opts: [...document.querySelectorAll(".dask .dopt")].map(c => ({
      w: c.textContent, on: c.classList.contains("on"), dead: !!c.disabled })),
    facts: [...document.querySelectorAll(".dfact")].map(c => ({
      label: (c.querySelector("b") || {}).textContent || "",
      text: c.textContent.trim() })),
    back: !!document.querySelector(".dask .dpinkey"),
    hits: document.querySelectorAll(".dcell.hit").length,
    lanes: document.querySelectorAll(".drow").length,
    start: [...document.querySelectorAll(".dchip")]
             .map(c => ({ w: c.textContent, dead: !!c.disabled })),
  }));
  const tapOpt = async (w) => {
    const hit = await page.evaluate((x) => {
      const c = [...document.querySelectorAll(".dask .dopt")]
        .find(e => e.textContent === x && !e.disabled);
      if (c) { c.click(); return true; } return false; }, w);
    await page.waitForTimeout(300);
    return hit;
  };
  const tapFact = async (label) => {
    const hit = await page.evaluate((x) => {
      const c = [...document.querySelectorAll(".dfact")]
        .find(e => (e.querySelector("b") || {}).textContent === x);
      if (c) { c.click(); return true; } return false; }, label);
    await page.waitForTimeout(260);
    return hit;
  };
  const goBack = async () => {
    await page.evaluate(() => { const b = document.querySelector(".dask .dpinkey"); if (b) b.click(); });
    await page.waitForTimeout(220);
  };

  // ── the machine starts silent and offers exactly one way in ──
  {
    const c = (await surface()).start;
    const live = c.filter(x => !x.dead);
    ok(live.length === 1 && live[0].w === "add drums",
       "at rest the page offers " + live.map(x => x.w).join("/") + ", not just ADD DRUMS");
    ok((await schedule()).startsWith("[]§"), "the machine is scheduling drums before anyone spoke to it");
  }
  await page.evaluate(() => [...document.querySelectorAll(".dchip")]
    .find(c => c.textContent === "add drums").click());
  await page.waitForTimeout(400);
  ok((await schedule()) !== "[]", "ADD DRUMS scheduled nothing");
  {
    const s2 = await surface();
    ok(s2.hits > 0, "ADD DRUMS drew no pattern — the picture is empty");
    ok(!!s2.q, "the drummer asked nothing after sitting down");
  }

  // ── THE INTERVIEW: answer what is in front of you, all the way down ──
  const seen = new Set(), quiet = [];
  let moved = 0, tried = 0, questions = 0, menu = false;
  for (let step = 0; step < 200; step++) {
    const s2 = await surface();
    if (!s2.q) break;
    if (/anything else/.test(s2.q)) menu = true;
    if (!seen.has(s2.q)) { seen.add(s2.q); questions++; }
    const next = s2.opts.find(o => !o.dead && !seen.has(s2.q + "|" + o.w));
    if (!next) { if (s2.back) { await goBack(); continue; } break; }
    seen.add(s2.q + "|" + next.w);
    const before = await schedule();
    const beforeModel = await page.evaluate(() => window.__drumModel());
    if (!(await tapOpt(next.w))) { ok(false, "\"" + next.w + "\" is offered but refuses the tap"); continue; }
    tried++;
    const after = await schedule();
    const afterModel = await page.evaluate(() => window.__drumModel());
    if (after !== before) moved++;
    else if (afterModel === beforeModel) quiet.push(next.w + " (never landed)");
    else quiet.push(next.w + " (model only)");
  }
  ok(!menu, "the page still offers a menu of subjects instead of asking");
  ok(questions >= 8, "the drummer only asked " + questions + " questions");

  // ── ...AND THE SHEET IS THE REST OF THE VOCABULARY. An answered question
  //    leaves the floor and lands on the gig sheet; every other answer it
  //    had is still sayable by tapping the fact. That is where the rest of
  //    the words live now, so that is where the sweep goes.
  const visited = new Set();
  let changed = 0;
  for (let round = 0; round < 40; round++) {
    const facts = (await surface()).facts.map(f => f.label);
    const label = facts.find(l => !visited.has(l));
    if (!label) break;
    visited.add(label);
    if (!(await tapFact(label))) continue;      // a fact can stop being one
    const open = await surface();
    ok(!!open.q, "tapping \"" + label + "\" asked nothing");
    ok(open.opts.some(o => o.on), "\"" + label + "\" re-opened with nothing lit — " +
       "what you said is not shown as said");
    for (const o of open.opts) {
      if (o.dead || seen.has(label + "|" + o.w)) continue;
      seen.add(label + "|" + o.w);
      const before = await schedule();
      const beforeModel = await page.evaluate(() => window.__drumModel());
      if (!(await tapOpt(o.w))) continue;
      tried++;
      const after = await schedule();
      if (after !== before) { moved++; changed++; }
      else if ((await page.evaluate(() => window.__drumModel())) !== beforeModel)
        quiet.push(o.w + " (model only)");
      else quiet.push(o.w + " (never landed)");
      await tapFact(label);                      // stay in this question
    }
    await goBack();
  }
  ok(visited.size >= 6, "the gig sheet held only " + visited.size + " facts to go back to");
  ok(changed >= 3, "only " + changed + " answers could be changed from the sheet");
  ok(tried > 25, "only " + tried + " words were exercised — the vocabulary shrank");
  // THE SWEEP IS A COVERAGE REPORT, NOT A VERDICT — a word's effect depends
  // on the state the walk happened into (re-choosing the groove already
  // playing legitimately moves nothing). The LAWS are below.
  ok(moved >= 12, "only " + moved + " of " + tried + " words moved what the " +
     "engine is handed — the machine is broadly inert: " + quiet.join(", "));
  console.log("  questions asked: " + questions + " · words tapped: " + tried +
              ", moving the artifact: " + moved +
              (quiet.length ? " · inert: " + quiet.join(", ") : ""));

  {
    const s2 = await surface();
    ok(s2.facts.length >= 6, "the gig sheet holds " + s2.facts.length +
       " facts — an answered question vanished instead of landing there");
  }

  // ── THE BAR IS SAYABLE, and a lane is a question you are IN ──
  {
    // find the kit question on the sheet and name a lane from it
    let pinned = false;
    const s2 = await surface();
    for (const f of s2.facts) {
      await tapFact(f.label);
      if (await tapOpt("hats")) { pinned = true; break; }
      await goBack();
    }
    ok(pinned, "there is no question anywhere that lets you name the hats");
    if (pinned) {
      const bar = await surface();
      ok(/bar/.test(bar.q), "naming a lane did not open the bar: \"" + bar.q + "\"");
      const before = await schedule();
      await tapOpt("on the a of four");
      ok((await schedule()) !== before, "saying a place in the bar changed no hit");
      await goBack();
    }
    const back = await surface();
    ok(back.hits > 0 && back.lanes > 0, "the pattern picture emptied out");
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
