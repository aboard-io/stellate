#!/usr/bin/env node
// test/browser/font-rotation.test.js — THE 32-BAR SOUNDFONT ROTATION.
//
//   node test/browser/font-rotation.test.js
//
// The set changes instruments every ROTATE_BARS and keeps coming home to the
// analog font (app/audio/fonts.js FONT_CYCLE). Three things have to hold, and
// each of them was broken at some point while this was built:
//
//   A. THE ROTATION IS DETERMINISTIC FROM THE BAR. The share URL carries the
//      measure, so the instruments have to be a pure function of it or a link
//      would not reproduce the music it promises.
//   B. IT ACTUALLY CHANGES WHAT IS VOICED. Not "the active font key changed" —
//      the FILE the engine would play per role. The first working version passed
//      a font-key check and voiced identical samples throughout, because
//      state.samplerLib (the map forceSampled resolves through) was in no flip
//      and the playing state kept the old font's zones.
//   C. IT NEVER CUTS THE SOUND. That is the entire point: the old font picker
//      did stopLive() -> rebuild -> goLive(), and this exists to not do that.
//
//      MEASURED WITH THE AUDIT, NOT WITH RMS. handle.rms() is an instantaneous
//      meter and the quietest bar of four identical rides came out 0.0025, 0.1617,
//      0.0264 and 0.1047 — it cannot tell a dropout from a sampling instant that
//      landed between notes, so any threshold over it is a coin flip. The engine
//      already measures the real question per voice per bar: handle.auditSummary()
//      reports voices that were EXPECTED to sound and did not, which is exactly
//      what a font swap would break. That is deterministic; rms is used only to
//      confirm the ride made sound at all.
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", ".."), PORT = 8817;
const START_BAR = 60;        // 4 bars before a boundary, so the ride crosses several
const RIDE_TO = 108;         // far enough for two more boundaries (64, 96)
const RMS_FLOOR = 0.05;      // only a "did this ride make sound at all" sanity floor

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (c, m) => { console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fails.push(m); };

  await page.goto(`http://localhost:${PORT}/index.html?seed=7`);
  await page.waitForFunction(() => window.__X && window.__S, { timeout: 20000 });
  await page.waitForTimeout(400);

  // ---- A: the cycle is a pure function of the bar -----------------------------
  const cyc = await page.evaluate(async () => {
    const m = await import("./app/audio/fonts.js");
    const at = (b) => m.fontAt(b);
    return { cycle: m.FONT_CYCLE, bars: m.ROTATE_BARS,
      sample: [0, 31, 32, 63, 64, 96, 256].map(at),
      stable: at(70) === at(70) && at(70) === at(95) && at(70) !== at(96) };
  });
  ok(cyc.cycle.length >= 4, `A1: cycle has ${cyc.cycle.length} steps: ${cyc.cycle.join(" → ")}`);
  ok(cyc.bars === 32, `A2: rotates every ${cyc.bars} bars`);
  const analog = cyc.cycle.filter((f) => f === "analog").length;
  ok(analog >= cyc.cycle.length / 2, `A3: the analog font is ${analog} of ${cyc.cycle.length} steps — it keeps coming back`);
  ok(cyc.stable, `A4: the font is constant WITHIN a 32-bar step and changes at the boundary`);
  ok(cyc.sample[0] === cyc.sample[6], `A5: the cycle closes (bar 0 and bar 256 are the same font)`);
  console.log(`       bars 0/31/32/63/64/96 → ${cyc.sample.slice(0, 6).join(", ")}`);

  // ---- B + C: ride it -----------------------------------------------------------
  await page.evaluate(async (startBar) => {
    try { localStorage.removeItem("vaporwave-soundfont"); } catch (e) {}
    __S.seed = 7; __S.waypoints = [];
    const q = window.__X.POS.citypop; window.__X.retarget({ x: q[0], y: q[1] });
    __S.startBar = startBar;
    await window.__X.goLive();
  }, START_BAR);
  await page.waitForFunction(() => window.__S.barInfo, { timeout: 60000 });

  // SAMPLE FAST AND KEEP THE MAX PER BAR. handle.rms() is an INSTANTANEOUS meter,
  // so one reading per bar can land in the gap between notes and report ~0 for a
  // bar that was perfectly audible — measured, a single 0.0025 next to neighbours
  // at 0.2 which vanished entirely at 120ms polling. "Was this bar silent" is a
  // question about the loudest thing in it, not about one instant of it.
  const rows = []; let lastBar = -1;
  for (let i = 0; i < 3000; i++) {
    await page.waitForTimeout(120);
    const d = await page.evaluate(() => {
      const h = window.__X.handle && window.__X.handle();
      let voiced = "?";
      try {
        const u = window.FaustStateEngine.voiceUnits(window.CsdEngine, window.__S.playing);
        const one = (k) => { const x = u[k]; if (!x || !x.sampler) return (x && x.module) || "-";
          return String(((x.sampler.zones || [])[0] || {}).srcId || "?").replace(/_\d+$/, ""); };
        voiced = one("melody") + " " + one("pad") + " " + one("bass");
      } catch (e) { voiced = "ERR"; }
      return { bar: window.__S.barCount, live: !!window.__S.live, voiced,
        font: (window.GenreKernel.activeFont && window.GenreKernel.activeFont()) || "?",
        rms: h ? +(+h.rms()).toFixed(4) : -1,
        audit: (h && h.auditSummary) ? h.auditSummary() : "" };
    });
    if (d.bar !== lastBar) { lastBar = d.bar; rows.push(d); }
    else if (rows.length) { const cur = rows[rows.length - 1]; if (d.rms > cur.rms) cur.rms = d.rms; }
    if (rows.length && rows[rows.length - 1].bar >= RIDE_TO) break;
  }

  const changes = [];
  for (const r of rows) if (!changes.length || changes[changes.length - 1].voiced !== r.voiced) changes.push(r);
  console.log(`\n       what the engine voiced (melody pad bass):`);
  for (const c of changes) console.log(`         bar ${String(c.bar).padStart(4)}  [${c.font}]  ${c.voiced}`);

  ok(rows.length > 10, `B0: rode ${rows.length} bars (${rows[0] && rows[0].bar}..${lastBar})`);
  ok(changes.length >= 3, `B1: what is VOICED changed ${changes.length - 1} time(s) across the ride (want >=2)`);
  const sawSampledFont = changes.some((c) => /^ins_[a-z0-9]+__/.test(c.voiced));
  ok(sawSampledFont, `B2: an ALTERNATE sampled font actually sounded (a font-qualified zone id was voiced)`);
  const sawSynth = changes.some((c) => /modeld|juno60/.test(c.voiced));
  ok(sawSynth, `B3: the ANALOG font actually sounded (synth voices replaced the samplers)`);

  // C1: the AUDIT — voices that were expected to sound and did not. "N anomalies
  // over M/T bars"; M is what matters, and a clean rotation leaves it at 0.
  const audit = rows.length ? rows[rows.length - 1].audit : "";
  const m = /over (\d+)\/(\d+) bars/.exec(audit || "");
  const anomBars = m ? +m[1] : -1;
  console.log(`       ${audit}`);
  // THE CLAIM IS ABOUT THE BOUNDARIES, so that is what is asserted. A live ride
  // throws the odd present-but-silent bar with the rotation OFF too (measured on
  // both), so demanding a perfect 48 bars would be a flaky gate testing something
  // this feature does not promise. What it DOES promise is that swapping the font
  // costs you nothing: no anomalous bar within ±2 of a 32-bar boundary.
  const anomAt = (audit.match(/bars ([\d-]+)/g) || []).join(" ");
  const nums = (anomAt.match(/\d+/g) || []).map(Number);
  const nearBoundary = nums.filter((b) => Math.abs((b % 32) - 0) <= 2 || Math.abs((b % 32) - 32) <= 2);
  ok(anomBars >= 0, `C1a: the audit is readable (${anomBars} anomalous bar(s) over the ride)`);
  ok(nearBoundary.length === 0, `C1: no voice dropped at a font boundary${nearBoundary.length ? " — bars " + nearBoundary.join(",") : ""}`);
  ok(anomBars <= 2, `C1c: the ride stayed clean overall (${anomBars} anomalous bars, allowance 2 — the rotation-off baseline also produces the odd one)`);
  const loudest = Math.max(...rows.map((r) => r.rms));
  ok(loudest > RMS_FLOOR, `C1b: the ride made real sound (loudest bar ${loudest.toFixed(3)})`);
  ok(rows.every((r) => r.live), `C2: the engine stayed LIVE across every boundary (never stopped and restarted)`);
  ok(errs.length === 0, `C3: zero page errors (${errs.slice(0, 3).join(" | ")})`);

  await browser.close();
  srv.close();
  console.log(fails.length ? `\nFONT-ROTATION: FAILED (${fails.length})` : `\nFONT-ROTATION: PASS`);
  process.exit(fails.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
