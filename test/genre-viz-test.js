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
//   H. THE UNIT IS ALWAYS 8 (Paul 2026-07): the roll is a constant 8-cell window
//      for every genre; chordEvery=16 (prelude) FOLDS into stacked 8-cell rows.
//   I. FOUND-LANE LIVENESS: a sustained bed shows as a ribbon in EVERY bar it
//      sounds (pure ci=1 check + a live ride parked on vaporwave).
//   J. DESCRIPTIONS name role+character, never the source (no sampler/DX7/
//      soundfont/raw ids); the MIND readout renders where the state carries
//      MUSIC-MIND axes (theory/pipes/rhythm).
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

  await page.goto(`http://localhost:${PORT}/index.html`);
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
      // fx now render as a tiny " · "-joined line UNDER the lane (was stacked pills);
      // require the FULL chain shows (>1 effect), which is the point of the change.
      const fxRow = rows.find(r => {
        const nm = r.querySelector(".vz-tlname"), fx = r.querySelector(".vz-fxline");
        return nm && nm.textContent.trim().length > 0 && fx && fx.textContent.includes(" · ");
      });
      return { lanes: rows.length, blocks: box.querySelectorAll(".vz-blk").length,
        fxLane: !!fxRow, fxName: fxRow ? fxRow.querySelector(".vz-tlname").textContent.trim() : null,
        fxLabel: fxRow ? fxRow.querySelector(".vz-fxline").textContent.trim() : null,
        stackedPills: box.querySelectorAll(".vz-tlrow .vz-fx i").length,
        notes: window.__notes.length, bars: window.__S.barCount, live: window.__S.live };
    });
    if (tl.lanes >= 2 && tl.blocks >= 1 && tl.fxLane && tl.notes > 0 && tl.bars >= 3) break;
    await page.waitForTimeout(300);
  }
  ok(tl.lanes >= 2, `C1: timeline rendered ${tl.lanes} lanes (want >=2)`);
  ok(tl.blocks >= 1, `C2: timeline rendered ${tl.blocks} note blocks (want >=1)`);
  ok(tl.fxLane, `C3: no lane shows a name + a full (multi-effect) fx line under it`);
  ok(!!tl.fxName && !!tl.fxLabel, `C4: name/fx lane incomplete (name=${tl.fxName} fx=${tl.fxLabel})`);
  ok(tl.stackedPills === 0, `C5: fx must be tiny text, not stacked lozenges (found ${tl.stackedPills} pills)`);
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

  // ---- H: THE UNIT IS ALWAYS 8 (Paul 2026-07). The visible roll is a constant
  // 8-cell window whatever the genre's chordEvery; longer chord bars FOLD into
  // stacked 8-cell rows (they never shrink). prelude (chordEvery:16) must fold;
  // house (chordEvery 8) must show the SAME 8-unit ruler.
  const H = await page.evaluate(() => {
    const p = window.__X.POS.prelude; window.__X.retarget({ x: p[0], y: p[1] });
    const d = window.__VIZ.data();
    window.__X.renderInside();
    const box = document.getElementById("inside");
    const stack = box.querySelector(".vz-rollstack");
    return { dom: d.blend[0] ? d.blend[0].g : null, cbeats: d.timeline.cbeats, view: d.timeline.view,
      folds: d.timeline.folds, spans: box.querySelectorAll(".vz-ruler span").length,
      hasStack: !!stack, foldRolls: stack ? stack.querySelectorAll(".vz-roll").length : 0 };
  });
  const H2 = await page.evaluate(() => {
    const p = window.__X.POS.house; window.__X.retarget({ x: p[0], y: p[1] });
    const d = window.__VIZ.data(); window.__X.renderInside();
    return { cbeats: d.timeline.cbeats, view: d.timeline.view,
      spans: document.querySelectorAll("#inside .vz-ruler span").length };
  });
  ok(H.dom === "prelude", `H0: retarget dominant is ${H.dom} (want prelude)`);
  ok(H.cbeats > 8, `H1: prelude chord window is ${H.cbeats} beats (need >8 to exercise the fold)`);
  ok(H.view === 8 && H.spans === 8, `H2: prelude view=${H.view} rulerUnits=${H.spans} (must both be 8)`);
  ok(H.hasStack && H.folds === Math.ceil(H.cbeats / 8) && H.foldRolls === H.folds,
    `H3: fold stack wrong (stack=${H.hasStack} folds=${H.folds} rolls=${H.foldRolls} for cbeats=${H.cbeats})`);
  ok(H2.view === 8 && H2.spans === 8, `H4: house view=${H2.view} rulerUnits=${H2.spans} (unit must be 8 for EVERY genre)`);
  console.log(`\n=== 8-UNIT TIMELINE ===`);
  console.log(`  prelude cbeats=${H.cbeats} view=${H.view} ruler=${H.spans} folds=${H.folds}/${H.foldRolls}`);
  console.log(`  house   cbeats=${H2.cbeats} view=${H2.view} ruler=${H2.spans}`);

  // ---- J: descriptions never name the source (no sampler/DX7/soundfont/raw ids),
  // and the MIND readout renders for a genre whose state carries the MUSIC-MIND axes.
  const J = await page.evaluate(() => {
    const box = document.getElementById("inside");
    const names = [...box.querySelectorAll(".vz-tlname")].map(e => e.textContent.trim());
    const provenance = /FluidR3|DX7|soundfont|\bSF2\b/i.test(box.textContent) || /\bMIT\b/.test(box.textContent);
    let mindGenre = null, mind = null, mindDom = null;
    for (const g of Object.keys(window.__X.POS)) {
      const p = window.__X.POS[g]; window.__X.retarget({ x: p[0], y: p[1] });
      const d = window.__VIZ.data();
      if (d.mind && (d.mind.pipes.length || d.mind.adventure > 0 || d.mind.complexity > 0)) { mindGenre = g; mind = d.mind; break; }
    }
    if (mindGenre) { window.__X.renderInside();
      mindDom = { meters: box.querySelectorAll(".vz-mind .vz-mrow").length,
        moves: (box.querySelector(".vz-mmoves") || { textContent: "" }).textContent.trim() }; }
    return { names, bad: names.filter(n => /dx7|fluidr3|sampler|\bsf2\b|_/i.test(n)), provenance, mindGenre, mind, mindDom };
  });
  ok(J.bad.length === 0, `J1: lane names leak source/provenance: [${J.bad.join(", ")}]`);
  ok(!J.provenance, `J2: modal text mentions soundfont/hardware provenance`);
  ok(!!J.mindGenre, `J3: no genre in POS yields a MIND readout (theory/pipes/rhythm all absent everywhere?)`);
  ok(J.mindDom && J.mindDom.meters === 3, `J4: MIND section did not render 3 meters (got ${J.mindDom && J.mindDom.meters})`);
  console.log(`\n=== DESCRIPTIONS + MIND ===`);
  console.log(`  lane names=[${J.names.join(" · ")}]`);
  console.log(`  mind@${J.mindGenre}: ${JSON.stringify(J.mind)}  dom meters=${J.mindDom && J.mindDom.meters} moves="${J.mindDom && J.mindDom.moves}"`);

  // ---- I: FOUND-LANE LIVENESS (Paul: "found audio plays but the viz shows nothing").
  // Beds emit ONE event at section start and sustain across the whole cycle; every
  // bar with ci>0 used to show a dead found lane. First the pure path: a ci=1 bar
  // of vaporwave (bed-heavy) must carry a sustained bed ribbon. Then the live path:
  // park the ride ON vaporwave and require found activity within a few bars.
  const I0 = await page.evaluate(() => {
    const p = window.__X.POS.vaporwave; window.__X.retarget({ x: p[0], y: p[1] });
    const st = window.__S.playing;
    const sec = (st.sections || []).find(s => s.found && s.found.sourceId);
    const save = window.__S.barInfo;
    window.__S.barInfo = { ci: 1, serial: 3, section: sec ? sec.name : "" };
    const d = window.__VIZ.data();
    window.__S.barInfo = save;
    const L = d.timeline.lanes.find(l => l.key === "found");
    return { dom: d.blend[0] ? d.blend[0].g : null, hasSec: !!sec, lane: !!L,
      notes: L ? L.notes.length : 0, bed: L ? L.notes.some(n => n.bed) : false, cbeats: d.timeline.cbeats };
  });
  ok(I0.dom === "vaporwave", `I0a: retarget dominant is ${I0.dom} (want vaporwave)`);
  ok(I0.hasSec, `I0b: vaporwave state has no bed-carrying section to test against`);
  ok(I0.lane && I0.notes > 0 && I0.bed, `I0c: ci=1 bar shows a dead found lane (lane=${I0.lane} notes=${I0.notes} bed=${I0.bed})`);
  // the live ride: park waypoints on vaporwave, go live, found lane must show
  // activity at a ci>0 bar within ~8 bars.
  await page.evaluate(async () => {
    const p = window.__X.POS.vaporwave;
    window.__S.waypoints = [{ x: p[0], y: p[1] }, { x: p[0] + 1, y: p[1] + 1 }];
    await window.__X.goLive();
  });
  let fb = { lane: false, notes: 0, ci: 0, bedSeen: false, bars: 0 };
  for (let i = 0; i < 80; i++) {
    const s = await page.evaluate(() => {
      const d = window.__VIZ.data();
      const L = d.timeline.lanes.find(l => l.key === "found");
      return { lane: !!L, notes: L ? L.notes.length : 0, bed: L ? L.notes.some(n => n.bed) : false,
        ci: window.__S.barInfo ? window.__S.barInfo.ci : 0, bars: window.__S.barCount };
    });
    fb.lane = fb.lane || s.lane; fb.bars = s.bars;
    if (s.bars >= 2) fb.bedSeen = fb.bedSeen || s.bed;   // only count LIVE-authored bars (barInfo pre-live is stale)
    if (s.bars >= 2 && s.ci > 0 && s.notes > 0) { fb.notes = s.notes; fb.ci = s.ci; break; }
    await page.waitForTimeout(500);
  }
  ok(fb.lane, `I1: found lane never appeared on a live vaporwave ride`);
  ok(fb.ci > 0 && fb.notes > 0, `I2: found lane dead at ci>0 while beds play (ci=${fb.ci} notes=${fb.notes} bars=${fb.bars})`);
  ok(fb.bedSeen, `I3: no sustained bed ribbon ever drawn in the found lane`);
  console.log(`\n=== FOUND-LANE LIVENESS (vaporwave) ===`);
  console.log(`  pure ci=1: lane=${I0.lane} notes=${I0.notes} bed=${I0.bed}  live: ci=${fb.ci} notes=${fb.notes} bedSeen=${fb.bedSeen} bars=${fb.bars}`);
  await page.evaluate(() => window.__X.stopLive());

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
