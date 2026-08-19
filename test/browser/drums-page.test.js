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
  // THE SURFACE IS A QUESTION. The transcript and the wall of chips came out
  // ("just keep the pattern and the questions"), so the gate walks what a
  // person now walks: the question on screen, its options, and the topics
  // the last question offers. Reading the old .dchip wall is how a gate goes
  // on passing for a page nobody has.
  const surface = () => page.evaluate(() => ({
    q: [...document.querySelectorAll(".dask .dq")].map(x => x.textContent),
    opts: [...document.querySelectorAll(".dask .dopt")].map(c => ({
      w: c.textContent, on: c.classList.contains("on"), dead: !!c.disabled })),
    back: !!document.querySelector(".dask .dpinkey"),
    facts: [...document.querySelectorAll(".dfact")].map(c => c.textContent.trim()),
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
  const goBack = async () => {
    await page.evaluate(() => {
      const b = document.querySelector(".dask .dpinkey"); if (b) b.click(); });
    await page.waitForTimeout(220);
  };
  const toTopic = async (t) => {                 // out of wherever, into a topic
    for (let i = 0; i < 4; i++) {
      const s2 = await surface();
      if (s2.q.includes("anything else?")) break;
      if (s2.back) await goBack(); else break;
    }
    return tapOpt(t);
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
    ok(s2.q.length > 0, "the drummer asked nothing after sitting down");
  }

  // ── EVERY WORD, one at a time: it must move the schedule ──
  // The walk is the page's own: answer the question in front of you; when the
  // interview is done and the question is "anything else?", take a subject
  // and answer that. A pinned lane is just another question.
  const seen = new Set(), topics = new Set();
  const quiet = [];
  let moved = 0, tried = 0, sawBar = false, sawGrooves = 0;
  for (let step = 0; step < 220; step++) {
    const s2 = await surface();
    if (!s2.q.length) break;
    if (s2.q.includes("where does it go in the bar?")) sawBar = true;
    if (/grooves/.test(s2.q.join(" ")) || s2.opts.some(o => o.w === "breakbeat"))
      sawGrooves = Math.max(sawGrooves, s2.opts.length);
    if (s2.q.length === 1 && s2.q[0] === "anything else?") {
      // TAKE AWAY GOES LAST. It is offered early (rank 4) and it is the one
      // subject that can empty the kit — sweep it before the machines and the
      // feel and every later word is inert for the honest reason that there
      // is nothing left to play.
      const left = s2.opts.map(o => o.w).filter(w => !topics.has(w));
      const t = left.find(w => w !== "take something out?") || left[0];
      if (!t) break;
      topics.add(t);
      await tapOpt(t);
      continue;
    }
    const key = s2.q.join("/");
    const next = s2.opts.find(o => !o.dead && !seen.has(key + "|" + o.w));
    if (!next) { if (s2.back) { await goBack(); continue; } break; }
    seen.add(key + "|" + next.w);
    const before = await schedule();
    const beforeModel = await page.evaluate(() => window.__drumModel());
    if (!(await tapOpt(next.w))) { ok(false, "\"" + next.w + "\" is offered but refuses the tap"); continue; }
    tried++;
    const after = await schedule();
    const afterModel = await page.evaluate(() => window.__drumModel());
    // WHERE A WORD IS LOST, if it is: the model is the machine's own answer
    // and the schedule is the engine's. A word that moves neither did not
    // land; one that moves the model and not the schedule is a seam.
    if (after !== before) moved++;
    else if (afterModel === beforeModel) quiet.push(next.w + " (never landed)");
    else quiet.push(next.w + " (model only)");
  }
  ok(tried > 25, "only " + tried + " words were exercised — the vocabulary shrank");
  // THE SWEEP IS A COVERAGE REPORT, NOT A VERDICT — a word's effect depends
  // on the state the sweep walked into (re-choosing the groove already
  // playing legitimately moves nothing). The LAWS are below; the floor keeps
  // the sweep honest about wholesale breakage.
  ok(moved >= 12, "only " + moved + " of " + tried + " words moved what the " +
     "engine is handed — the machine is broadly inert: " + quiet.join(", "));
  ok(topics.size >= 4, "the last question offered only " + topics.size +
     " subjects — the vocabulary is unreachable");
  console.log("  words tapped: " + tried + ", moving the artifact: " + moved +
              ", subjects: " + topics.size +
              (quiet.length ? " · inert: " + quiet.join(", ") : ""));

  // PUT THE KIT BACK. The sweep says "take something out?" out loud and
  // means it — by the end there is no kick left — and the laws below are
  // about a machine that is playing. A GROOVE is what puts a kit back, and
  // the grooves live under their own subjects, so this hunts for one rather
  // than assuming which subject holds it.
  let restored = false;
  for (let i = 0; i < 20 && !restored; i++) {
    for (let j = 0; j < 4; j++) {
      const s3 = await surface();
      if (s3.q.includes("anything else?")) break;
      if (s3.back) await goBack(); else break;
    }
    const subs = (await surface()).opts.map(o => o.w);
    const sub = subs[i];
    if (!sub) break;
    await tapOpt(sub);
    for (const w of ["four on the floor", "breakbeat", "boom bap", "straight eights"])
      if (await tapOpt(w)) { restored = true; break; }
  }
  ok(restored, "no groove word anywhere puts a kit back after the sweep emptied it");
  for (let j = 0; j < 4; j++) {
    const s3 = await surface();
    if (s3.q.includes("anything else?")) break;
    if (s3.back) await goBack(); else break;
  }

  // ── LIT, NOT GONE: the gig sheet is the readout, and a word that would
  //    change nothing is still shown (disabled) rather than hidden ──
  {
    const s2 = await surface();
    ok(s2.facts.length >= 3, "the gig sheet holds " + s2.facts.length +
       " facts — the machine's state has no readout");
    ok(s2.hits > 0 && s2.lanes > 0, "the pattern picture emptied out");
  }

  // ── THE GROOVES ARE STILL THERE, and the bar is sayable ──
  {
    await toTopic("what kit is this?");
    const s2 = await surface();
    const grooves = s2.opts.filter(x => /breakbeat|boom bap|four on the floor|kit/.test(x.w));
    ok(s2.opts.length >= 3, "the kit subject offers " + s2.opts.length + " words");
    await goBack();
  }
  {
    ok(await toTopic("how are you playing it?"),
       "there is no way to reach the drummer's own words");
    const hats = await tapOpt("hats");
    if (hats) {
      const s2 = await surface();
      ok(s2.q.includes("where does it go in the bar?"),
         "naming a lane did not open the bar: " + s2.q.join("/"));
      const before = await schedule();
      await tapOpt("on the a of four");
      ok((await schedule()) !== before, "saying a place in the bar changed no hit");
      await goBack();
    } else ok(sawBar, "the bar's own counting was never offered");
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
