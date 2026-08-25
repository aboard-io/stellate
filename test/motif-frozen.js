#!/usr/bin/env node
// test/motif-frozen.js — THE FROZEN-INTERFACE GATE.
//
// Paul, 2026-08-24, and it is the whole reason this file exists:
//
//   "When playing -- Don't change motifs visually or change the editing
//    interface. It's too confusing when it changes. Instead, show the fully
//    composed motif ABOVE the editable version of the motif."
//
// So there are two claims to prove, and one of them is a NEGATIVE — the hard
// kind. THE EDITABLE HALF OF #app DOES NOT CHANGE when the transport starts,
// when a section boundary goes past, or when the transport stops; and the
// composed half DOES, or the page has simply frozen and passes by doing
// nothing.
//
// TEST THE ARTIFACT (three features have shipped broken in this repo while
// every check passed): nothing here reads ui/eight.js. Every assertion is a
// string taken off the RENDERED page in a real browser, at 390px and at
// 1400px, because the 1516 ms rebuild that started this round only showed up
// on the wide viewport.
//
// THE EXCLUSION IS THE PAGE'S OWN, NOT THIS FILE'S. `window.__eightFrozen()`
// clones #app and calls `replaceChildren()` on every `[data-live]` — a DOM
// operation over a set only the builders can join. This gate cannot invent a
// permission for a surface that misbehaves; it can only ask what eight.js
// declared. A1 closes the smuggling hole: nothing inside a [data-live] may be
// an editing control, or "put it in a data-live" becomes a way past A3.
//
// A1  no input/select/textarea/button/fieldset inside any [data-live]
// A2  both staves per measure exist WHILE STOPPED (the composed staff is not
//     conditional on `playing` — a staff that appears on play is the editing
//     interface changing, which is the complaint itself)
// A3  the frozen half is byte-identical across play + two section boundaries
// A4  ...and the live half moved: at least one composed caption changed. An
//     independent second proof that a boundary happened, and it fails a "fix"
//     that froze the composed staff along with everything else.
// A5  nothing inside #app moved RELATIVE TO #app — the first fieldset, which
//     is above the staves, and the band axis, which is below them and is the
//     one that a composed staff changing height would push. Measured against
//     #app and not against the document on purpose: pressing play makes the
//     engine readout appear (0 -> 18px, so #app itself drops 34px), and that
//     readout is OUTSIDE #app, is D1's whole point, and happens on your press
//     rather than on the clock. It is named here rather than asserted away —
//     the fix is a line reserve in the shell, which this gate does not own.
// A6  abcjs was asked to draw at most once per line voice per boundary — the
//     change detector in repaintPlayed() works
// A7  no longtask >= 100 ms AT A SECTION BOUNDARY, and none at all after the
//     engine has started. Measured before this round: 409/436 ms at 390px and
//     419/1516 ms at 1400px, every one of them a draw() on the clock. Measured
//     after: two tasks, 170 ms at +215 ms and 119 ms at +1045 ms, both inside
//     the first second of the press and neither anywhere near a boundary —
//     that is audio/live.js building the plan and starting the worklet, which
//     is your gesture and not the clock. So the window before START_QUIET is
//     printed and allowed, and everything after it must be silent.
// A8  stopping does not rebuild either — C === A, the second draw() that used
//     to hang off `transport:state`
//
// Run:  NODE_PATH=/home/ford/ftrain-2025/node_modules node test/motif-frozen.js
// A bare chromium.launch() resolves a shell build that is not installed here,
// so the executable is explicit and checked before use; and the page needs
// cross-origin isolation for SharedArrayBuffer, which is what serve.sh gives.

const fs = require("fs");
const path = require("path");

const URL = process.env.MOTIF_URL || "http://localhost:8777/nukernel/index.html";
const WIDTHS = [390, 1400];
const HEIGHT = 844;
const SETTLE = 4000;            // abcjs engraves on a promise; the page grows late
// HOW LONG THE ENGINE IS ALLOWED TO BE BUSY AFTER THE PRESS. The two long
// tasks measured on 2026-08-24 land at +215 ms and +1045 ms and are the audio
// starting, not the page redrawing; the first section boundary landed at
// +22.5 s. Three seconds separates the two by an order of magnitude.
const START_QUIET = 3000;

const CANDIDATES = [
  "chromium-1234/chrome-linux64/chrome",
  "chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
  "chromium-1217/chrome-linux64/chrome",
];
function executable() {
  const root = path.join(process.env.HOME, ".cache/ms-playwright");
  for (const c of CANDIDATES) {
    const p = path.join(root, c);
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no installed chromium under " + root);
}

let FAILS = 0;
const ok = (m) => console.log("  ok   " + m);
const fail = (m) => { FAILS++; console.log("  FAIL " + m); };
const is = (cond, m) => (cond ? ok(m) : fail(m));

// WHERE TWO STRINGS PART, said as the ELEMENT and not as an offset. A diff
// that prints "character 41,203" names the file; a diff that prints the two
// hundred characters around it names the thing that moved, which is what
// somebody reading a red gate actually needs.
function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 90);
  return "at char " + i + " of " + a.length + "/" + b.length +
    "\n        before: …" + a.slice(from, i + 110).replace(/\n/g, " ") +
    "\n        after : …" + b.slice(from, i + 110).replace(/\n/g, " ");
}

(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ executablePath: executable(),
    args: ["--autoplay-policy=no-user-gesture-required"] });
  console.log("motif-frozen gate · " + URL);

  for (const width of WIDTHS) {
    console.log("[" + width + "]");
    const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(SETTLE);

    // ---- the page has to have the probes, or nothing below means anything
    const probed = await page.evaluate(() => !!(window.__eightFrozen &&
      window.__eightEngraves && window.__eightSec && window.__eightCaptions));
    if (!probed) { fail(width + " · the page has no __eightFrozen probe"); break; }

    // A1 — the excluded set contains no editing interface at all
    const smuggled = await page.evaluate(() => [...document.querySelectorAll(
      "#app [data-live] input, #app [data-live] select, #app [data-live] textarea," +
      " #app [data-live] button, #app [data-live] fieldset")]
      .map((e) => e.tagName.toLowerCase() + (e.dataset.k ? "[" + e.dataset.k + "]" : "")));
    is(smuggled.length === 0,
      "A1 " + width + " · no control inside a [data-live] (" + smuggled.join(", ") + ")");

    // A2 — two staves per measure, WHILE STOPPED
    const shape = await page.evaluate(() => ({
      svgs: document.querySelectorAll("#staff svg").length,
      lives: document.querySelectorAll('#staff [data-live="played"]').length,
      counts: document.querySelectorAll('#app [data-live="count"]').length,
      lineHosts: document.querySelectorAll('#staff [data-live="played"] > p > div').length,
      written: document.querySelectorAll("#staff > p > div").length,
      caps: window.__eightCaptions(),
      playing: (document.getElementById("play") || {}).textContent,
    }));
    console.log("     " + shape.svgs + " staves · " + shape.lives + " live blocks · " +
      shape.counts + " count cells · " + shape.written + " written measures");
    is(shape.playing === "play", "A2 " + width + " · the transport is stopped to start with");
    is(shape.lives > 0 && shape.lineHosts === shape.written &&
       shape.svgs === shape.lineHosts + shape.written,
      "A2 " + width + " · a composed staff over every written one while STOPPED (" +
      shape.lineHosts + " composed, " + shape.written + " written, " + shape.svgs + " svgs)");
    is(shape.caps.length === shape.lives && shape.caps.every((c) => c && c.length > 3),
      "A2 " + width + " · every composed block is captioned: " + JSON.stringify(shape.caps));

    // ---- the before picture, and the instruments
    const A = await page.evaluate(() => window.__eightFrozen());
    const before = await page.evaluate(() => {
      // the long tasks are collected from the moment play is pressed; the
      // buffer is installed first so nothing is missed in the gap
      window.__longs = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries())
        window.__longs.push({ d: Math.round(e.duration),
                              at: Math.round(e.startTime - window.__t0) }); })
        .observe({ entryTypes: ["longtask"] });
      window.__t0 = performance.now();
      // POSITIONS RELATIVE TO #app. See A5's note: the engine readout is
      // outside #app and appears on the press, which moves #app itself.
      const rel = (sel) => { const e = document.querySelector(sel);
        const a = document.getElementById("app");
        return e ? Math.round(e.getBoundingClientRect().top -
                              a.getBoundingClientRect().top) : -1; };
      return { caps: window.__eightCaptions(), eng: window.__eightEngraves(),
               si: window.__eightSec(), step: window.__eightStep(),
               top: rel("#app fieldset"), band: rel("#ax-band"),
               scroll: Math.round(document.scrollingElement.scrollTop),
               voices: window.__eightDoc().voices.filter((v) => v.kind === "line").length,
               bpm: window.__eightDoc().time.bpm,
               bars: window.__eightDoc().form.sections.map((s) => s.bars) };
    });

    // ---- play, and PROVE the boundaries rather than waiting for them.
    // Measured 2026-08-24: the first boundary landed at ~26 s on a section
    // arithmetic predicts at 16.5 s, because the engine runs a runway. A fixed
    // sleep would be a coin toss.
    await page.click("#play");
    await page.waitForFunction(() => document.getElementById("play").textContent === "stop",
      null, { timeout: 15000 }).catch(() => {});
    const budget = ((before.bars[0] || 4) + (before.bars[1] || 4)) * 4 * 60 /
      Math.max(30, before.bpm) * 1000 + 25000;
    const t0 = Date.now();
    const seq = [before.si], at = [];
    while (seq.length < 3 && Date.now() - t0 < budget) {
      await page.waitForTimeout(100);
      const now = await page.evaluate(() => ({ si: window.__eightSec(),
        t: Math.round(performance.now() - window.__t0) }));
      if (now.si !== seq[seq.length - 1]) { seq.push(now.si); at.push(now.t); }
    }
    const crossed = seq.length - 1;
    console.log("     sections seen: " + seq.join(" → ") + "  at " +
      at.map((x) => (x / 1000).toFixed(1) + "s").join(", "));
    is(crossed >= 2, "  · two section boundaries crossed (" + seq.join(" → ") + ")");

    const after = await page.evaluate(() => {
      const rel = (sel) => { const e = document.querySelector(sel);
        const a = document.getElementById("app");
        return e ? Math.round(e.getBoundingClientRect().top -
                              a.getBoundingClientRect().top) : -1; };
      return { caps: window.__eightCaptions(), eng: window.__eightEngraves(),
               step: window.__eightStep(), longs: window.__longs.slice(),
               top: rel("#app fieldset"), band: rel("#ax-band"),
               scroll: Math.round(document.scrollingElement.scrollTop) };
    });
    const B = await page.evaluate(() => window.__eightFrozen());

    // A3 — THE ASSERTION THE ROUND EXISTS FOR
    is(A === B, "A3 " + width + " · the editable half is byte-identical across " +
      crossed + " boundaries (" + A.length + " chars)" +
      (A === B ? "" : "\n        " + firstDiff(A, B)));

    // A4 — ...and the live half is alive. The caption always names the
    // sounding section, so a boundary MUST move it.
    is(JSON.stringify(after.caps) !== JSON.stringify(before.caps),
      "A4 " + width + " · a composed caption moved: " +
      JSON.stringify(before.caps) + " → " + JSON.stringify(after.caps));
    is(after.step !== before.step,
      "A4 " + width + " · the playhead is running (step " + before.step +
      " → " + after.step + ")");

    // A5 — nothing inside #app moved, above the staves OR below them, and
    // nothing was scroll-jacked. The band axis is the load-bearing half: it
    // sits under every composed block, so a composed staff or a caption that
    // changed height would show up here and nowhere else.
    is(after.top === before.top, "A5 " + width + " · the first fieldset is where it was " +
      "in #app (" + before.top + " → " + after.top + ")");
    is(after.band === before.band, "A5 " + width + " · the band axis — everything " +
      "under the staves — is where it was in #app (" + before.band + " → " + after.band + ")");
    is(after.scroll === before.scroll, "A5 " + width + " · the scroll was not moved (" +
      before.scroll + " → " + after.scroll + ")");

    // A6 — the change detector
    const grew = after.eng - before.eng, cap = before.voices * crossed;
    is(grew <= cap, "A6 " + width + " · " + grew + " abcjs renders across " + crossed +
      " boundaries (at most " + cap + " — one per line voice per boundary)");

    // A7 — the main thread, and WHEN each task landed
    const say = (e) => e.d + " ms at +" + (e.at / 1000).toFixed(1) + "s";
    const start = after.longs.filter((e) => e.d >= 100 && e.at < START_QUIET);
    const bad = after.longs.filter((e) => e.d >= 100 && e.at >= START_QUIET);
    if (start.length) console.log("     the engine starting: " +
      start.map(say).join(", ") + " (allowed — your press, not the clock)");
    is(bad.length === 0, "A7 " + width + " · no long task >= 100 ms after the engine " +
      "started, and none at a boundary (" + (bad.length ? bad.map(say).join(", ")
        : String(after.longs.filter((e) => e.at >= START_QUIET).length) +
          " short tasks, longest " + Math.max(0, ...after.longs
            .filter((e) => e.at >= START_QUIET).map((e) => e.d)) + " ms") + ")");

    // A8 — stopping does not rebuild either
    await page.click("#play");
    await page.waitForFunction(() => document.getElementById("play").textContent === "play",
      null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    const C = await page.evaluate(() => window.__eightFrozen());
    is(C === A, "A8 " + width + " · stop did not rebuild the editable half" +
      (C === A ? "" : "\n        " + firstDiff(A, C)));

    is(errors.length === 0, "  · no page errors (" + errors.slice(0, 3).join(" | ") + ")");
    await page.close();
  }

  await browser.close();
  console.log(FAILS ? "\n" + FAILS + " failed" : "\nall checks pass");
  process.exit(FAILS ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
