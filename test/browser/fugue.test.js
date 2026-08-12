#!/usr/bin/env node
// test/browser/fugue.test.js — /fugue: the page IS the documentation.
//
// The claim is that scrolling top to bottom documents every option the system
// has, and that each option's EFFECT is rendered directly under its prose. The
// failure modes: a section that explains something the page cannot do, a control
// whose effect is not visible, a play button that plays the finished piece
// instead of the thing being explained, and a fugue that renders silent.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const srv = await serve(ROOT, 8988);
  const browser = await launchChromium();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await ctx.newPage();
  const errors = capturePageErrors(page);

  console.log("\nA. the document");
  await page.goto(`http://localhost:${srv.port}/fugue.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__FUGUE && window.__FUGUE.ready, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  if (errors.length) fail("errors on boot: " + errors.join(" | ")); else ok("zero page errors");

  // EVERY OPTION IS DOCUMENTED. The kernel's options are subject, answer,
  // voices, overlap, later and genre — six, and the page must have a section for
  // each, in order, each with its effect panel underneath.
  const doc = await page.evaluate(() => {
    const steps = [...document.querySelectorAll(".fg-step")];
    return steps.map((s) => ({ id: s.id, h: (s.querySelector("h2") || {}).textContent,
      hasEffect: !!s.querySelector(".fg-effect"),
      effectBelowProse: (() => {
        const e = s.querySelector(".fg-effect"), p = s.querySelector("p");
        return !e || !p || e.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_PRECEDING;
      })() }));
  });
  const want = ["s-what", "s-subject", "s-answer", "s-voices", "s-stretto", "s-transforms", "s-sound", "s-whole"];
  doc.map((d) => d.id).join() === want.join() ? ok("eight sections, in order: " + want.slice(1).join(" · "))
    : fail("sections are " + doc.map((d) => d.id).join());
  doc.slice(1, 7).every((d) => d.hasEffect) ? ok("every option section carries an effect panel")
    : fail("a section explains something with no effect shown");
  doc.every((d) => d.effectBelowProse) ? ok("and the effect sits BELOW the prose that explains it")
    : fail("an effect panel is above its explanation");

  console.log("\nB. each option visibly does what it says");
  const moved = async (label, sel, mutate) => {
    const before = await page.evaluate((s) => document.querySelector(s).innerHTML, sel);
    await page.evaluate(mutate);
    await sleep(300);
    const after = await page.evaluate((s) => document.querySelector(s).innerHTML, sel);
    after !== before ? ok(label) : fail(label + " — nothing changed on screen");
  };
  await moved("drawing a note redraws the subject grid", "#fgGrid", () =>
    window.__FUGUE.edit({ subject: [[0, .5, 5], [.5, .5, 3], [1, .5, 1], [1.5, .5, 4]] }));
  await moved("changing the answer redraws its roll", "#fgAnsRoll", () => window.__FUGUE.edit({ answer: 4 }));
  await moved("adding a voice redraws the entry map", "#fgMap", () => window.__FUGUE.edit({ voices: 2 }));
  await moved("stretto redraws the entry map", "#fgMap2", () => window.__FUGUE.edit({ overlap: 0.5 }));
  await moved("adding a transform marks its card", "#fgTrans", () => window.__FUGUE.edit({ later: ["retrograde"] }));
  await moved("and the whole-piece roll follows all of it", "#fgFull", () => window.__FUGUE.edit({ voices: 3 }));

  // the transform cards must draw THEIR OWN shape, or they are decoration
  // THE CLAIM THE PAGE MAKES, checked end to end: every entry carries the
  // subject's exact interval shape in the RENDERED events. The first version of
  // this page failed this and shipped anyway, because nothing asked.
  const shaped = await page.evaluate(() => {
    window.__FUGUE.edit({ subject: [[0, .5, 0], [.5, .5, 1], [1, .5, 2], [1.5, .5, 1], [2, .5, 3], [2.5, .5, 2], [3, .5, 4], [3.5, .5, 2]],
      voices: 3, overlap: 1, answer: 2, later: [] });
    const F = window.CsdFugue, E = window.CsdEngine, K = window.GenreKernel;
    const st = F.build(JSON.parse(JSON.stringify(K.track("neoclassical", { seed: 7 }))), { voices: 3 }).state;
    const p = F.plan({ voices: 3 });
    const lead = E.getProgression(st.progression).chords[0].lead.map((x) => E.pchToMidi(x) + (st.keyOffset || 0));
    const deg = (m) => { for (let g = -4; g < 12; g++) { const w = lead[((g % 4) + 4) % 4] + Math.floor(g / 4) * 12; if (Math.abs(w - m) < 0.5) return g; } return null; };
    const ev = E.buildEvents(st).pitched.filter((e) => e.voice === "melody" && e.beat < st.chordEvery - 0.2).sort((a, b) => a.beat - b.beat);
    const shape = (a) => a.slice(1).map((x, i) => x - a[i]).join(",");
    const want = shape(p.subject.map((n) => n[2]));
    return p.entries.map((e) => {
      const w = ev.filter((x) => x.beat >= e.at - 0.15 && x.beat < e.at + p.span - 0.15).map((x) => deg(E.pchToMidi(x.pch)));
      return { role: e.role, got: shape(w), ok: shape(w) === want, n: w.length };
    });
  });
  shaped.every((x) => x.ok) ? ok("every rendered entry carries the subject's exact shape (" + shaped[0].got + ")")
    : fail("an entry is not the subject: " + JSON.stringify(shaped));
  shaped.every((x) => x.n === 8) ? ok("and all eight notes of it, in every voice")
    : fail("notes per entry: " + shaped.map((x) => x.n).join(","));
  await page.evaluate(() => window.__FUGUE.edit({ voices: 3, later: [] }));
  await sleep(250);

  const shapes = await page.evaluate(() => {
    const seen = new Set();
    for (const c of document.querySelectorAll(".fg-tcard")) seen.add(c.querySelector("svg").innerHTML);
    return seen.size;
  });
  shapes >= 4 ? ok("each transform card draws its own shape (" + shapes + " distinct)")
    : fail("the transform cards show " + shapes + " distinct shapes");

  console.log("\nC. each section plays ITS OWN thing");
  // Playing the finished piece while explaining one option teaches nothing about
  // the option, so the scopes must actually differ.
  await page.evaluate(() => window.__FUGUE.edit({ voices: 3, later: ["inversion"], overlap: 1 }));
  await sleep(250);
  const scopes = await page.evaluate(() => [...document.querySelectorAll(".fg-play")].map((b) => b.dataset.play));
  new Set(scopes).size >= 4 ? ok("the play buttons name " + new Set(scopes).size + " different scopes")
    : fail("only " + new Set(scopes).size + " scopes");

  console.log("\nD. it sounds");
  await page.evaluate(() => window.__FUGUE.play("all"));
  let peak = 0, nonzero = 0;
  for (let i = 0; i < 30; i++) {
    await sleep(280);
    const v = await page.evaluate(() => window.__FUGUE.rms());
    if (v > 0) { nonzero++; peak = Math.max(peak, v); }
  }
  // a fugue is a few melodic lines and no kit, so the bar is lower than a band's
  peak > 0.004 ? ok(`the fugue is not silent (peak ${peak.toFixed(4)}, ${nonzero}/30 samples)`)
    : fail(`silent: peak ${peak.toFixed(4)}`);
  const drums = await page.evaluate(() => window.CsdEngine.buildEvents(
    window.CsdFugue.build(JSON.parse(JSON.stringify(window.GenreKernel.track("neoclassical", { seed: 7 }))), { voices: 3 }).state).drums.length);
  drums === 0 ? ok("and carries no percussion at all") : fail(drums + " drum events in a fugue");
  await page.evaluate(() => window.__FUGUE.stop());
  await sleep(300);

  console.log("\nE. the link and the laws");
  await page.evaluate(() => window.__FUGUE.edit({ subject: [[0, .5, 2], [.5, .5, 5], [1, 1, 3]], voices: 2, overlap: 0.5, answer: 3, later: ["augmentation"], genre: "ragtime" }));
  await sleep(300);
  const shared = await page.evaluate(() => window.__FUGUE.url());
  const p2 = await ctx.newPage();
  const e2 = capturePageErrors(p2);
  await p2.goto(shared, { waitUntil: "domcontentloaded" });
  await p2.waitForFunction(() => window.__FUGUE && window.__FUGUE.ready);
  await p2.waitForTimeout(300);
  const round = await p2.evaluate(() => ({ ...window.__FUGUE.doc }));
  (round.voices === 2 && round.overlap === 0.5 && round.answer === 3 && round.genre === "ragtime"
    && round.later.join() === "augmentation" && round.subject.length === 3)
    ? ok("the whole document survives the link") : fail("round-trip lost " + JSON.stringify(round));
  if (e2.length) fail("errors on the shared link: " + e2.join(" | "));
  await p2.close();

  // a hostile link: every field is a small number, a degree digit, or a key of
  // the committed genre table — so there is nothing to sanitize, and that has to
  // be true rather than claimed
  const p3 = await ctx.newPage();
  const e3 = capturePageErrors(p3);
  await p3.goto(`http://localhost:${srv.port}/fugue.html?s=__proto__&v=99&o=-5&a=zzz&t=drop,inversion&g=../etc`, { waitUntil: "domcontentloaded" });
  await p3.waitForFunction(() => window.__FUGUE && window.__FUGUE.ready);
  await p3.waitForTimeout(300);
  const h = await p3.evaluate(() => ({ ...window.__FUGUE.doc, n: window.__FUGUE.plan().entries.length }));
  (h.voices === 3 && h.genre === "neoclassical" && h.overlap === 1 && h.later.join() === "inversion")
    ? ok("a hostile link drops everything invalid and keeps only what the engine names")
    : fail("hostile link gave " + JSON.stringify(h));
  if (e3.length) fail("errors on the hostile link: " + e3.join(" | ")); else ok("and boots clean");
  await p3.close();

  for (const [w, hh, label] of [[390, 844, "phone"], [1440, 900, "desk"]]) {
    await page.setViewportSize({ width: w, height: hh });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const small = [];
      for (const el of document.querySelectorAll("button, a.fg-btn")) {
        if (!el.offsetParent) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1) continue;
        if (el.classList.contains("fg-cell")) continue;   // a grid cell is a pixel in a bar
        if (r.height < 40) small.push(el.className + " " + Math.round(r.height));
      }
      return { ranges: document.querySelectorAll("input[type=range]").length,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: small.slice(0, 5) };
    });
    m.ranges === 0 ? ok(label + ": zero input[type=range]") : fail(label + ": " + m.ranges + " sliders");
    m.over <= 1 ? ok(label + ": no sideways overflow") : fail(label + ": overflows by " + m.over);
    m.small.length === 0 ? ok(label + ": every control clears 40px") : fail(label + ": under 40px — " + m.small.join(", "));
  }

  if (errors.length) fail("page errors accumulated: " + errors.slice(0, 3).join(" | "));
  await browser.close();
  srv.close();
  console.log(process.exitCode ? "\nfugue: FAIL" : `\nfugue: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
