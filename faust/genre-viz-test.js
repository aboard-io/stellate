#!/usr/bin/env node
// faust/genre-viz-test.js — headless gate for the "INSIDE THE SOUND" info tool.
// Two changes this gate guards (Paul, 2026-07): the busted WAV-engine MIXER is
// GONE, and the flat voice roster became an intelligent VOICE TIMELINE — a per-bar
// piano-roll computed deterministically from CsdEngine.buildEvents(S.playing).
//
//   A. window.__VIZ.data() populated on load: blend %s ~100 (>=1 genre), 6 feel
//      axes in [0,1], and a timeline object (cbeats/spb/bpm + lanes).
//   B. MIXER is fully removed: no #mixChip button, no #mixWrap modal, no "mix"
//      key in the modal registry.
//   C. the ⓘ modal renders a TIMELINE: >=2 lanes, >=1 note block, and a lane
//      header showing an instrument NAME + an effect label. (Driven LIVE on
//      house@seed1 so the lead lane reliably carries a chorus insert.)
//   D. LIVE proof: the timeline CHANGES when the traveler retargets to two very
//      different genre regions (lane roster + tempo differ).
//   E. NOTE FEED: DemoLayer.note(ev) is invoked during a live ride (a spy is
//      installed on window.DemoLayer before going live; call count must be > 0),
//      and the payload has the contract shape {role,midi,freq,vel,durSec,section}.
//   F. zero console/page errors throughout.
//
//   NODE_PATH=/home/ford/ftrain-2025/node_modules node faust/genre-viz-test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");
const ROOT = path.join(__dirname, ".."), PORT = 8801;

async function main() {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/explorer.html`);
  await page.waitForFunction(() => window.__VIZ && window.__S && window.__X && window.__X.POS, { timeout: 20000 });
  await page.waitForTimeout(400);

  // ---- A: viz populated on load ----
  const load = await page.evaluate(() => window.__VIZ.data());
  const blendSum = load.blend.reduce((s, b) => s + b.pct, 0);
  ok(Array.isArray(load.blend) && load.blend.length >= 1, `A1: blend has ${load.blend.length} genres (want >=1)`);
  ok(blendSum >= 97 && blendSum <= 103, `A2: blend %s sum to ${blendSum} (want ~100)`);
  ok(load.feel.length === 6 && load.feel.every(([n, v]) => typeof n === "string" && v >= 0 && v <= 1), `A3: 6 feel axes in [0,1]`);
  ok(load.timeline && Array.isArray(load.timeline.lanes) && load.timeline.cbeats >= 2, `A4: timeline object present (cbeats=${load.timeline && load.timeline.cbeats})`);
  console.log(`\n=== LOAD ===`);
  console.log(`  blend=[${load.blend.map(b => b.label + " " + b.pct + "%").join(" · ")}]  sum=${blendSum}`);
  console.log(`  feel={${load.feel.map(([n, v]) => n + " " + Math.round(v * 100)).join(" · ")}}  timeline.lanes=${load.timeline.lanes.length}`);

  // ---- B: the MIXER is gone ----
  const mix = await page.evaluate(() => ({
    chip: !!document.getElementById("mixChip"),
    modal: !!document.getElementById("mixWrap"),
    chipRow: [...document.querySelectorAll("#chips .chip")].map(c => c.id),
    glyph: document.getElementById("chips").textContent.includes("\u{1D11A}"), // 𝄚
  }));
  ok(!mix.chip, `B1: #mixChip still exists`);
  ok(!mix.modal, `B2: #mixWrap modal still exists`);
  ok(!mix.glyph, `B3: mixer glyph 𝄚 still on the chip row`);
  ok(mix.chipRow.length === 4 && mix.chipRow.join(",") === "playChip,insideChip,bgChip,cfgChip",
    `B4: chip row is [${mix.chipRow.join(", ")}] (want play,inside,bg,cfg — 4 chips)`);
  console.log(`\n=== MIXER REMOVED ===\n  mixChip=${mix.chip} mixWrap=${mix.modal} glyph=${mix.glyph}  chips=[${mix.chipRow.join(", ")}]`);

  // ---- open the ⓘ tool ----
  await page.click("#insideChip");
  await page.waitForTimeout(150);
  const shell = await page.evaluate(() => {
    const box = document.getElementById("inside");
    return { open: document.getElementById("insideWrap").classList.contains("open"),
      hasBar: !!box.querySelector(".vz-bar > div"), hasRadar: !!box.querySelector("svg.radar polygon"),
      hasTimelineSec: box.textContent.includes("timeline") };
  });
  ok(shell.open, `preopen: ⓘ modal did not open`);
  ok(shell.hasBar, `preopen: blend bar missing`);
  ok(shell.hasRadar, `preopen: feel radar missing`);
  ok(shell.hasTimelineSec, `preopen: timeline section label missing`);

  // ---- D: LIVE proof — retarget to two very different regions, timeline changes ----
  const sample = (g) => page.evaluate((genre) => {
    const p = window.__X.POS[genre];
    window.__X.retarget({ x: p[0], y: p[1] });
    const d = window.__VIZ.data();
    return { dom: d.blend[0] ? d.blend[0].g : null,
      lanes: d.timeline.lanes.map(l => l.name),
      laneKeys: d.timeline.lanes.map(l => l.key),
      notes: d.timeline.lanes.reduce((s, l) => s + l.notes.length, 0),
      tempo: (d.feel.find(f => f[0] === "tempo") || [, 0])[1] };
  }, g);
  const A = await sample("techno");        // fast, machine kit, synth-forward
  const B = await sample("neoclassical");  // slow, kit off, acoustic
  ok(A.dom === "techno" && B.dom === "neoclassical", `D0: retarget dominant ${A.dom}/${B.dom}`);
  ok(JSON.stringify(A.lanes) !== JSON.stringify(B.lanes) || JSON.stringify(A.laneKeys) !== JSON.stringify(B.laneKeys),
    `D1: timeline lanes did not change between regions ([${A.lanes}] vs [${B.lanes}])`);
  ok(Math.abs(A.tempo - B.tempo) > 0.05, `D2: feel tempo axis did not change (${A.tempo.toFixed(2)} vs ${B.tempo.toFixed(2)})`);
  console.log(`\n=== LIVE CHANGE ===`);
  console.log(`  techno       → lanes=[${A.lanes.join(", ")}] notes=${A.notes} tempo=${A.tempo.toFixed(2)}`);
  console.log(`  neoclassical → lanes=[${B.lanes.join(", ")}] notes=${B.notes} tempo=${B.tempo.toFixed(2)}`);

  // ---- C + E: go LIVE on house@seed1; assert timeline DOM + the note feed ----
  // Stub DemoLayer BEFORE going live: enabled + a note() spy. scheduleBarNotes
  // fires DemoLayer.note(ev) at each onset only when DemoLayer.enabled() is true.
  await page.evaluate(async () => {
    window.__notes = [];
    // keep the real layer's methods (setEnabled/next/…, the bg-sync loop calls them);
    // only force enabled() true and spy note() so scheduleBarNotes fires headlessly.
    const real = window.DemoLayer || {};
    window.DemoLayer = Object.assign({}, real, { enabled: () => true, pulse: real.pulse || (() => {}),
      note: (ev) => { window.__notes.push(ev); } });
    __S.seed = 1; __S.waypoints = [];
    const p = window.__X.POS.house; window.__X.retarget({ x: p[0], y: p[1] });
    await window.__X.goLive();
  });

  // poll the RENDERED timeline (a bar lasts seconds, so the DOM is stable per poll)
  // until a busy bar shows >=2 lanes, >=1 block, a name+fx lane, AND notes fired.
  let tl = { lanes: 0, blocks: 0, fxLane: false, fxName: null, fxLabel: null, notes: 0, bars: 0 };
  for (let i = 0; i < 60; i++) {
    tl = await page.evaluate(() => {
      const box = document.getElementById("inside");
      const rows = [...box.querySelectorAll(".vz-tlrow")];
      const fxRow = rows.find(r => {
        const nm = r.querySelector(".vz-tlname"), fx = r.querySelector(".vz-fx i");
        return nm && nm.textContent.trim().length > 0 && fx && fx.textContent.trim().length > 0;
      });
      return { lanes: rows.length, blocks: box.querySelectorAll(".vz-blk").length,
        fxLane: !!fxRow, fxName: fxRow ? fxRow.querySelector(".vz-tlname").textContent.trim() : null,
        fxLabel: fxRow ? fxRow.querySelector(".vz-fx i").textContent.trim() : null,
        notes: window.__notes.length, bars: window.__S.barCount, live: window.__S.live };
    });
    if (tl.lanes >= 2 && tl.blocks >= 1 && tl.fxLane && tl.notes > 0 && tl.bars >= 3) break;
    await page.waitForTimeout(300);
  }
  ok(tl.lanes >= 2, `C1: timeline rendered ${tl.lanes} lanes (want >=2)`);
  ok(tl.blocks >= 1, `C2: timeline rendered ${tl.blocks} note blocks (want >=1)`);
  ok(tl.fxLane, `C3: no lane header carries both an instrument name and an fx label`);
  ok(!!tl.fxName && !!tl.fxLabel, `C4: name/fx lane header incomplete (name=${tl.fxName} fx=${tl.fxLabel})`);
  console.log(`\n=== TIMELINE DOM (live house@seed1, bar ${tl.bars}) ===`);
  console.log(`  lanes=${tl.lanes} blocks=${tl.blocks}  fxLane="${tl.fxName}" {${tl.fxLabel}}`);

  // ---- G: AUDIT-TRUTH red-lane paint. Inject a stub audit for the CURRENT bar's serial
  // reporting the pad voice expected-but-silent (missing sample) and re-render the ⓘ; the
  // timeline must paint that lane RED/hatched (.vz-roll.vz-silent) with a reason badge.
  const paint = await page.evaluate(() => {
    const h = window.__X.handle && window.__X.handle();
    if (!h) return { ok: false, why: "no live handle" };
    const serial = window.__S.barInfo ? window.__S.barInfo.serial : null;
    // stub the audit lookup the timeline consults (auditFor(serial)).
    h.auditFor = () => ({ serial, anomalies: [{ key: "pad", role: "pad", notes: 4, rms: 0, reason: "missing", missing: ["ins_test_pad_2"] }] });
    window.__X.renderInside();
    const box = document.getElementById("inside");
    const silRoll = box.querySelector(".vz-roll.vz-silent");
    const silRow = box.querySelector(".vz-tlrow.vz-silent");
    const badge = box.querySelector(".vz-silbadge");
    // clear the stub so it doesn't bleed into later checks
    delete h.auditFor;
    return { ok: !!(silRoll && silRow && badge), hasRoll: !!silRoll, hasRow: !!silRow,
      badge: badge ? badge.textContent.trim() : null, badgeTitle: badge ? (badge.getAttribute("title") || "") : "" };
  });
  ok(paint.hasRoll && paint.hasRow, `G1: injected audit did not paint a red/hatched silent lane (roll=${paint.hasRoll} row=${paint.hasRow}) ${paint.why || ""}`);
  ok(!!paint.badge && /missing/i.test(paint.badge), `G2: silent-lane badge missing/incorrect (badge="${paint.badge}")`);
  ok(/ins_test_pad_2/.test(paint.badgeTitle), `G3: silent-lane tooltip does not name the missing srcId (title="${paint.badgeTitle}")`);
  console.log(`\n=== AUDIT RED-LANE PAINT ===\n  silentRoll=${paint.hasRoll} row=${paint.hasRow} badge="${paint.badge}" title="${paint.badgeTitle}"`);

  const noteInfo = await page.evaluate(() => {
    const n = window.__notes, s = n[Math.floor(n.length / 2)] || n[0] || null;
    const roles = [...new Set(n.map(e => e.role))];
    const shapeOk = s && ["role", "midi", "freq", "vel", "durSec", "section"].every(k => k in s);
    return { count: n.length, roles, sample: s, shapeOk };
  });
  ok(noteInfo.count > 0, `E1: DemoLayer.note was never called during the live ride`);
  ok(noteInfo.shapeOk, `E2: note payload missing contract keys {role,midi,freq,vel,durSec,section}: ${JSON.stringify(noteInfo.sample)}`);
  console.log(`\n=== NOTE FEED ===`);
  console.log(`  DemoLayer.note calls=${noteInfo.count}  roles=[${noteInfo.roles.join(", ")}]`);
  console.log(`  sample=${JSON.stringify(noteInfo.sample)}`);

  // stop; assert no further note calls fire after ■ (pending onsets cleared)
  await page.evaluate(() => window.__X.stopLive());
  await page.waitForTimeout(200);
  const afterStop = await page.evaluate(() => window.__notes.length);
  await page.waitForTimeout(600);
  const settled = await page.evaluate(() => window.__notes.length);
  ok(settled === afterStop, `E3: ${settled - afterStop} note(s) fired AFTER stop (pending onsets not cleared)`);
  console.log(`  after stop: ${afterStop} → ${settled} (no new onsets)`);

  // ---- F: no console/page errors (found-sound CORS in the sandbox is environmental) ----
  const isEnv = e => /archive\.org|CORS|ERR_FAILED|Failed to load resource|net::|found|autoplay|AudioContext/i.test(e);
  const real = errs.filter(e => !isEnv(e));
  ok(real.length === 0, `F: ${real.length} real console/page errors: ${real.slice(0, 3).join(" | ")}`);
  console.log(`\n=== ERRORS ===\n  real=${real.length}  environmental=${errs.length - real.length}`);
  if (real.length) console.log(`  REAL:\n   ${real.slice(0, 20).join("\n   ")}`);

  await browser.close(); srv.close();

  console.log(`\n=== GATE ===`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  const pass = fails.length === 0;
  console.log(`GENRE-VIZ GATE: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
