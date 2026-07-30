#!/usr/bin/env node
// test/browser/font-rotation.test.js — THE 32-BAR SOUNDFONT ROTATION, DUCKED.
//
//   node test/browser/font-rotation.test.js
//
// The set changes instruments every ROTATE_BARS and keeps coming home to the analog
// font. It was off for an afternoon — a cold sampled font is 28-51 MB of zones
// arriving at a bar boundary and it stalled the music — and it is back because the
// swap now DUCKS: app/audio/fonts.js applyFont() drops the instruments to 14% on an
// AudioParam ramp, swaps under the dip, and blooms back when the new zones have
// actually decoded. Four things have to hold:
//
//   A. THE ROTATION IS DETERMINISTIC FROM THE BAR. The share URL carries the measure,
//      so the instruments must be a pure function of it or a link would not reproduce
//      the music it promises.
//   B. IT ACTUALLY CHANGES WHAT IS VOICED. Not "the font key changed" — the FILE the
//      engine would play per role. The first working version passed a font-key check
//      and voiced identical samples throughout.
//   C. IT NEVER CUTS THE SOUND. The whole point: the old picker did stopLive() ->
//      rebuild -> goLive().
//   D. THE DUCK IS REAL AND IT RECOVERS. A duck that never lifts is a worse bug than
//      the stall it replaced — the music would just quietly stay at 14% forever.
//
//      MEASURED WITH THE AUDIT, NOT WITH RMS. handle.rms() is an instantaneous meter
//      and the quietest bar of four identical rides came out 0.0025, 0.1617, 0.0264
//      and 0.1047 — no threshold over it is anything but a coin flip. The engine
//      already measures the real question per voice per bar: handle.auditSummary()
//      reports voices that were EXPECTED to sound and did not. rms is used only to
//      confirm the ride made sound, and voiceLevel() for the duck itself.
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", "..");
let PORT = 8817;
const START_BAR = 60;        // 4 bars before a boundary, so the ride crosses several
const RIDE_TO = 108;         // far enough for two more boundaries (64, 96)
const RMS_FLOOR = 0.05;      // only a "did this ride make sound at all" sanity floor

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
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
  // THE DUCK IS SAMPLED AT THE POLL RATE, NOT THE BAR RATE. Rows are appended once
  // per BAR (~2 s) and the dip is ~1.6 s end to end, so reading the voice gain only
  // when the bar ticks lands on the ramp's shoulders and reports 0.905 for a duck that
  // genuinely reached 0.14. The minimum has to be taken across every 120 ms poll.
  const rows = []; let lastBar = -1; let duckMin = 1, duckLast = 1;
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
        duck: (h && h.voiceLevel) ? +h.voiceLevel().toFixed(3) : 1,
        font: (window.GenreKernel.activeFont && window.GenreKernel.activeFont()) || "?",
        rms: h ? +(+h.rms()).toFixed(4) : -1,
        audit: (h && h.auditSummary) ? h.auditSummary() : "" };
    });
    if (typeof d.duck === "number") { if (d.duck < duckMin) duckMin = d.duck; duckLast = d.duck; }
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

  // D: THE DUCK. It has to actually dip — otherwise the swap is uncovered and we are
  // back to the stall — and it has to come back up, which is the failure mode that
  // would be worst to ship: a rotation that leaves the band at 14% and never returns.
  const minDuck = duckMin, endDuck = duckLast;
  ok(minDuck < 0.9, `D1: the instruments DUCKED under a swap (voice gain reached ${minDuck})`);
  ok(endDuck > 0.95, `D2: and came back up (voice gain ended at ${endDuck})`);

  // C1: the AUDIT — voices that were expected to sound and did not.
  const audit = rows.length ? rows[rows.length - 1].audit : "";
  const m = /over (\d+)\/(\d+) bars/.exec(audit || "");
  const anomBars = m ? +m[1] : -1;
  console.log(`       ${audit}`);
  // THE CLAIM IS ABOUT THE BOUNDARIES, so that is what is asserted. A live ride throws
  // the odd present-but-silent bar with the rotation OFF too (measured on both), so
  // demanding a perfect 48 bars would be a flaky gate testing something this feature
  // does not promise. What it DOES promise: swapping the font costs you nothing — no
  // anomalous bar within ±2 of a 32-bar boundary.
  const anomAt = (audit.match(/bars ([\d-]+)/g) || []).join(" ");
  const nums = (anomAt.match(/\d+/g) || []).map(Number);
  const nearBoundary = nums.filter((b) => Math.abs((b % 32) - 0) <= 2 || Math.abs((b % 32) - 32) <= 2);
  ok(anomBars >= 0, `C1a: the audit is readable (${anomBars} anomalous bar(s) over the ride)`);
  ok(nearBoundary.length === 0, `C1: no voice dropped at a font boundary${nearBoundary.length ? " — bars " + nearBoundary.join(",") : ""}`);
  ok(anomBars <= 2, `C1c: the ride stayed clean overall (${anomBars} anomalous bars, allowance 2)`);
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
