#!/usr/bin/env node
// test/browser/nukernel-board.test.js — THE DESK SHOWS THE SONG'S TRUTH.
//
//   node test/browser/nukernel-board.test.js
//
// The one DOM probe for the derived-desk round (Paul, 2026-08-16: "All the EQ
// settings and all the faders are always the same and never move… but never
// inside a song", then "One channel per voice!!"). test/unit/nukernel.test.js
// §47 proves the MODEL — derivedPartTone/derivedSecEq differentiate the parts
// within a section and move them across sections, overrides are absolute,
// no-source stays flat, one tone stage per part. What only the DOM can prove
// is that the BOARD renders that truth:
//
//   (A) two strips in one section show DIFFERENT cap heights and DIFFERENT
//       knob angles — the board no longer flattens;
//   (B) the roster is the SONG's, fixed: crossing a section boundary changes
//       VALUES on stable strips (count and chair list identical, the moving
//       chair's cap/knobs move), and a chair the section does not sound is
//       dimmed .idle rather than removed;
//   (C) a user turn BRIGHTENS (.set, data-value) and STICKS across a
//       boundary round-trip, while unturned knobs keep their dim derived
//       angle (data-derived).
//
// DOM + model reads only — no play button, no analyser: the values the board
// paints are the same resolvedPart numbers buildChannel bakes (the unit gate
// holds that identity), so a board that shows them is showing the graph.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8963;                 // a PREFERENCE — the harness walks past a busy port

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  const errs = capturePageErrors(page);
  // ?nobounce: no background render competing with the probe's clicks
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html?nobounce`,
    { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
  await page.reload({ waitUntil: "networkidle" });

  // a composed song is the one whose sections genuinely differ (the arc words
  // the derivation reads); beatles is the longest thing the composer writes
  await page.selectOption("#composeg", "beatles");
  await page.click("#compose");
  await page.waitForTimeout(600);

  // one board snapshot: every channel strip's chair, idle state, cap height
  // and knob faces — read off the painted styles, not off any model call
  const snap = () => page.evaluate(() => {
    return [...document.querySelectorAll(".mrow:not(.msec)")].map(r => ({
      part: r.querySelector(".mval") ? r.querySelector(".mval").dataset.part : null,
      idle: r.classList.contains("idle"),
      cap: r.querySelector(".fcap").style.getPropertyValue("--f"),
      kas: [...r.querySelectorAll(".eqface")]
        .map(f => f.style.getPropertyValue("--ka")).join("|"),
      derived: [...r.querySelectorAll(".eqk")].map(b => b.dataset.derived).join("|"),
      set: [...r.querySelectorAll(".eqk")].map(b => b.classList.contains("set")),
      values: [...r.querySelectorAll(".eqk")].map(b => b.dataset.value).join("|"),
    }));
  });
  const view = (i) => page.evaluate((n) => import("/nukernel/ui/state.js")
    .then(s => { s.setViewSec(n); s.commit("selection"); }), i)
    .then(() => page.waitForTimeout(200));

  // (A) within one section, the strips differ
  await view(0);
  const s0 = await snap();
  {
    const live = s0.filter(r => !r.idle);
    const caps = new Set(live.map(r => r.cap));
    if (live.length < 2)
      fail(`only ${live.length} active strip(s) in section 0 — nothing to compare`);
    if (caps.size < 2)
      fail(`every active cap sits at the same height (${[...caps]}) — the faders ` +
           `are flattering again`);
    else ok(`caps differ across ${live.length} strips: ${live.map(r =>
      r.part + "@" + (+r.cap).toFixed(3)).join(", ")}`);
    const faces = new Set(live.map(r => r.kas));
    if (faces.size < 2)
      fail(`every strip's knob angles are identical — the EQs are not seeded ` +
           `by the song`);
    else ok(`knob angles differ per strip (${faces.size} distinct tone faces)`);
    const dim = live.filter(r => r.derived.replace(/\|/g, "") !== "");
    if (!dim.length)
      fail("no strip carries a derived (dim) EQ value — data-derived is empty " +
           "everywhere");
    else ok(`${dim.length} strip(s) show dim derived tone (data-derived set, unlit)`);
    if (live.some(r => r.set.some(Boolean)))
      fail("an untouched board shows a LIT knob — derived values must be dim");
    else ok("every derived knob is dim (.set only ever means a user value)");
  }

  // (B) the boundary: find a section where some shared chair's resolved tuple
  // differs from section 0's — the model's own answer, then the DOM's
  const j = await page.evaluate(async () => {
    const [stm, mx] = await Promise.all([
      import("/nukernel/ui/state.js"), import("/nukernel/audio/mixer.js")]);
    const t = (sec, k) => JSON.stringify(mx.resolvedPart(sec, k));
    const k0 = mx.partKeysOf(stm.SONG[0]);
    for (let i = 1; i < stm.SONG.length; i++) {
      const ki = mx.partKeysOf(stm.SONG[i]);
      if (ki.some(k => k0.includes(k) && t(stm.SONG[i], k) !== t(stm.SONG[0], k)))
        return i;
    }
    return -1;
  });
  if (j < 0) fail("no section's resolved desk differs from section 0's — the " +
                  "composed song does not evolve (the unit gate should have caught this)");
  else {
    await view(j);
    const sj = await snap();
    if (sj.length !== s0.length ||
        sj.map(r => r.part).join(",") !== s0.map(r => r.part).join(","))
      fail(`the strip set changed at a boundary: [${s0.map(r => r.part)}] -> ` +
           `[${sj.map(r => r.part)}] — one channel per voice means a FIXED roster`);
    else ok(`the roster is fixed across the boundary (${sj.length} strips, ` +
            `same chairs, section 0 -> ${j})`);
    const moved = sj.filter((r, i) =>
      !r.idle && !s0[i].idle && (r.cap !== s0[i].cap || r.kas !== s0[i].kas));
    if (!moved.length)
      fail(`crossing into section ${j} moved not one cap or knob — the desk ` +
           `does not follow the song`);
    else ok(`the boundary moves the desk: ${moved.map(r => r.part).join(", ")} ` +
            `changed cap/tone`);
    // idle bookkeeping: dimmed strips are exactly the chairs this section
    // does not sound
    const expectIdle = await page.evaluate(async (n) => {
      const [stm, mx] = await Promise.all([
        import("/nukernel/ui/state.js"), import("/nukernel/audio/mixer.js")]);
      return mx.partKeysOf(stm.SONG[n]);
    }, j);
    const wrong = sj.filter(r => r.idle === expectIdle.includes(r.part));
    if (wrong.length)
      fail(`idle marking disagrees with the section's chairs: ` +
           `${wrong.map(r => r.part + (r.idle ? " idle" : " awake")).join(", ")}`);
    else ok(`idle strips are exactly the silent chairs ` +
            `(${sj.filter(r => r.idle).map(r => r.part).join(", ") || "none"})`);

    // (C) a user turn brightens and sticks — 40 px at 0.15 dB/px is +6 dB
    const row = page.locator(".mrow:not(.msec)").first();
    const lo = row.locator('.eqk[data-band="lo"]');
    {
      // the board sits below the song table and the pool bank — raw mouse
      // coordinates outside the glass are silently dead, so bring the knob in
      await lo.scrollIntoViewIfNeeded();
      const bb = await lo.boundingBox();
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx, cy - 40, { steps: 8 });
      await page.mouse.up();
    }
    await page.waitForTimeout(200);
    const lit = await lo.evaluate(el => ({
      set: el.classList.contains("set"), value: el.dataset.value }));
    if (!lit.set || lit.value === "")
      fail(`a 40 px turn did not brighten the knob (${JSON.stringify(lit)})`);
    else ok(`a user turn lights the knob at ${lit.value} dB`);
    await view(0); await view(j);            // a boundary round-trip
    const back = await lo.evaluate(el => ({
      set: el.classList.contains("set"), value: el.dataset.value }));
    if (!back.set || back.value !== lit.value)
      fail(`the user's turn did not survive a boundary round-trip ` +
           `(${JSON.stringify(back)} after ${JSON.stringify(lit)})`);
    else ok(`the turn sticks across the boundary (${back.value} dB, still lit)`);
    // …and it is an override, not a sum: the stored band equals the shown dB
    const stored = await page.evaluate(async (n) => {
      const stm = await import("/nukernel/ui/state.js");
      const sec = stm.SONG[n];
      const p = sec.parts && Object.values(sec.parts)[0];
      return p && p.eq ? p.eq.lo : (sec.eq && sec.eq.lo);
    }, j);
    if (String(stored) !== lit.value)
      fail(`the store holds ${stored} but the knob shows ${lit.value} — the ` +
           `turn is not the absolute override the law promises`);
    else ok(`the store holds the same absolute ${stored} dB the knob shows`);
  }

  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
  else ok("no page errors");

  await browser.close();
  await srv.close();
  console.log(process.exitCode ? `\nFAILED (${checks} passed)` : `\nPASS (${checks} checks)`);
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
