#!/usr/bin/env node
// test/browser/genre-viz.test.js — headless gate for the "INSIDE THE SOUND" info tool.
// Two changes this gate guards: the busted WAV-engine MIXER is
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
//   H. THE UNIT IS ALWAYS 8: the roll is a constant 8-cell window
//      for every genre; chordEvery=16 (prelude) PAGES — ONE 8-cell row per lane
//      (no stacked fold rows: those read as double bars, i.e. duplication)
//      with a quiet ·1/2 page indicator; idle shows page 1 (beats 1..8).
//   K. LIVE PLAYHEAD: parked on prelude, ONE shared beat cursor sweeps the roll
//      (beat monotonic within a bar) and DRIVES the paging — the window flips to
//      page 2 when the beat crosses 8; the cursor goes dark after ■.
//   L. TRANSITION LIVENESS — the viz must not drop when a transition starts:
//      live bars are scheduled a runway ahead of playback, so a glide flip that
//      rewrites progression/sections mid-flight leaves barInfo.ci pointing past
//      the new progression's chord count — the viz's [lo,hi) window then missed
//      every built event and the WHOLE timeline drew dead for that bar. Pure
//      regression: a stale barInfo (old section name + high ci) against a
//      freshly-flipped state must still yield notes. Live regression: ride a
//      real cross-genre flip with the ⓘ open — every sampled bar across the
//      flip window renders a non-empty timeline, zero page errors.
//   I. FOUND-LANE LIVENESS: a sustained bed shows as a ribbon in EVERY bar it
//      sounds (pure ci=1 check + a live ride parked on vaporwave).
//   J. DESCRIPTIONS name role+character, never the source (no sampler/DX7/
//      soundfont/raw ids); the MIND readout renders where the state carries
//      MUSIC-MIND axes (theory/pipes/rhythm).
//
//   node test/browser/genre-viz.test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const ROOT = path.join(__dirname, "..", "..");
let PORT = 8801;

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 850 });
  const errs = capturePageErrors(page);
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/screensaver.html`);
  await page.waitForFunction(() => window.__VIZ && window.__S && window.__X && window.__X.POS, { timeout: 20000 });
  await page.waitForTimeout(400);

  // ---- A: viz populated on load ----
  const load = await page.evaluate(() => window.__VIZ.data());
  const blendSum = load.blend.reduce((s, b) => s + b.pct, 0);
  ok(Array.isArray(load.blend) && load.blend.length >= 1, `A1: blend has ${load.blend.length} genres (want >=1)`);
  ok(blendSum >= 97 && blendSum <= 103, `A2: blend %s sum to ${blendSum} (want ~100)`);
  ok(load.feel.length >= 11 && load.feel.every(([n, v]) => typeof n === "string" && v >= 0 && v <= 1), `A3: >=11 feel axes in [0,1] (got ${load.feel.length}; the mind axes are radar axes too)`);
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
  ok(mix.chipRow.length === 3 && mix.chipRow.join(",") === "playChip,viewChip,cfgChip",
    `B4: chip row is [${mix.chipRow.join(", ")}] (want play,view,cfg — the ONE view button; there is no ▢/▦ background chip)`);
  console.log(`\n=== MIXER REMOVED ===\n  mixChip=${mix.chip} mixWrap=${mix.modal} glyph=${mix.glyph}  chips=[${mix.chipRow.join(", ")}]`);

  // ---- open the ⓘ tool ----
  await page.click("#viewChip");   // map -> viz (the one view button)
  await page.waitForTimeout(150);
  const shell = await page.evaluate(() => {
    const box = document.getElementById("inside");
    return { open: document.getElementById("insideWrap").classList.contains("open"),
      hasBar: !!box.querySelector(".vz-bar > div"), hasRadar: !!box.querySelector("svg.radar polygon"),
      hasRoll: !!box.querySelector(".vz-roll"),
      vizView: document.body.classList.contains("view-viz"),
      mapHidden: getComputedStyle(document.getElementById("map")).display === "none" };
  });
  ok(shell.open, `preopen: ⓘ modal did not open`);
  ok(shell.hasBar, `preopen: blend bar missing`);
  ok(shell.hasRadar, `preopen: feel radar missing`);
  ok(shell.hasRoll, `preopen: timeline roll missing`);   // (there is no "timeline —" header label)
  ok(shell.vizView && shell.mapHidden, `preopen: viz must be a 100% VIEW (body.view-viz=${shell.vizView}, map hidden=${shell.mapHidden})`);

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
      // EFFECTS ARE NODES: not listed under the piano rolls, but nodes in the
      // graph. The per-lane .vz-fxline is
      // gone; the mixing node graph (.vz-graph) under the rolls is the fx surface.
      const graph = box.querySelector(".vz-graph");
      const fxNodes = graph ? graph.querySelectorAll(".gins,.grev,.gdel,.gmaster").length : 0;
      const hasName = rows.some(r => { const nm = r.querySelector(".vz-tlname"); return nm && nm.textContent.trim().length > 0; });
      return { lanes: rows.length, blocks: box.querySelectorAll(".vz-blk").length,
        graph: !!graph, fxNodes, hasName,
        fxlines: box.querySelectorAll(".vz-fxline").length,   // must be 0 now
        notes: window.__notes.length, bars: window.__S.barCount, live: window.__S.live };
    });
    if (tl.lanes >= 2 && tl.blocks >= 1 && tl.graph && tl.fxNodes >= 1 && tl.notes > 0 && tl.bars >= 3) break;
    await page.waitForTimeout(300);
  }
  ok(tl.lanes >= 2, `C1: timeline rendered ${tl.lanes} lanes (want >=2)`);
  ok(tl.blocks >= 1, `C2: timeline rendered ${tl.blocks} note blocks (want >=1)`);
  ok(tl.graph && tl.hasName, `C3: the mixing node graph (.vz-graph) or named lanes did not render (graph=${tl.graph} named=${tl.hasName})`);
  ok(tl.fxNodes >= 1, `C4: graph shows no effect nodes (.gins/.grev/.gdel/.gmaster=${tl.fxNodes} — effects should be nodes)`);
  ok(tl.fxlines === 0, `C5: effects must be graph nodes, not a per-lane fx line under the roll (found ${tl.fxlines} .vz-fxline)`);
  console.log(`\n=== TIMELINE DOM (live house@seed1, bar ${tl.bars}) ===`);
  console.log(`  lanes=${tl.lanes} blocks=${tl.blocks}  graph=${tl.graph} fxNodes=${tl.fxNodes} fxlines=${tl.fxlines}`);

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

  // ---- H: THE UNIT IS ALWAYS 8. The visible roll is a constant
  // 8-cell window whatever the genre's chordEvery; longer chord bars PAGE — ONE
  // 8-cell row per lane, NEVER a stacked fold (a stack reads as double bars for
  // each lane: duplication, not continuation). prelude (chordEvery:16) must
  // page (2 pages, a quiet ·1/2 indicator, idle on page 1 = beats 1..8); house
  // (chordEvery 8) must show the SAME 8-unit ruler with no indicator.
  const H = await page.evaluate(() => {
    const p = window.__X.POS.prelude; window.__X.retarget({ x: p[0], y: p[1] });
    const d = window.__VIZ.data();
    window.__X.renderInside();
    const box = document.getElementById("inside");
    return { dom: d.blend[0] ? d.blend[0].g : null, cbeats: d.timeline.cbeats, view: d.timeline.view,
      pages: d.timeline.pages, spans: box.querySelectorAll(".vz-ruler span").length,
      stacks: box.querySelectorAll(".vz-rollstack").length,
      lanes: box.querySelectorAll(".vz-tlmain").length,
      rolls: box.querySelectorAll(".vz-roll").length,
      pageDivs: box.querySelectorAll(".vz-roll .vz-page").length,
      ind: (box.querySelector(".vz-pgind") || { textContent: "" }).textContent.trim(),
      firstBeat: (box.querySelector(".vz-ruler span") || { textContent: "" }).textContent.trim() };
  });
  const H2 = await page.evaluate(() => {
    const p = window.__X.POS.house; window.__X.retarget({ x: p[0], y: p[1] });
    const d = window.__VIZ.data(); window.__X.renderInside();
    return { cbeats: d.timeline.cbeats, view: d.timeline.view, pages: d.timeline.pages,
      spans: document.querySelectorAll("#inside .vz-ruler span").length,
      ind: !!document.querySelector("#inside .vz-pgind") };
  });
  ok(H.dom === "prelude", `H0: retarget dominant is ${H.dom} (want prelude)`);
  ok(H.cbeats > 8, `H1: prelude chord window is ${H.cbeats} beats (need >8 to exercise paging)`);
  ok(H.view === 8 && H.spans === 8, `H2: prelude view=${H.view} rulerUnits=${H.spans} (must both be 8)`);
  ok(H.stacks === 0 && H.lanes > 0 && H.rolls === H.lanes,
    `H3: lanes must be ONE row each, no fold stack (stacks=${H.stacks} rolls=${H.rolls} lanes=${H.lanes})`);
  ok(H.pages === Math.ceil(H.cbeats / 8) && H.pageDivs === H.lanes * H.pages,
    `H3b: paging wrong (pages=${H.pages} pageDivs=${H.pageDivs} for cbeats=${H.cbeats}, lanes=${H.lanes})`);
  ok(/1\s*\/\s*2/.test(H.ind), `H3c: page indicator missing/wrong for cbeats=16 (ind="${H.ind}")`);
  ok(H.firstBeat === "1", `H3d: idle must show page 1 (first ruler beat="${H.firstBeat}")`);
  ok(H2.view === 8 && H2.spans === 8, `H4: house view=${H2.view} rulerUnits=${H2.spans} (unit must be 8 for EVERY genre)`);
  ok(H2.pages === 1 && !H2.ind, `H5: house must be a single page with NO indicator (pages=${H2.pages} ind=${H2.ind})`);
  console.log(`\n=== 8-UNIT TIMELINE (PAGED) ===`);
  console.log(`  prelude cbeats=${H.cbeats} view=${H.view} ruler=${H.spans} pages=${H.pages} rolls=${H.rolls}/${H.lanes} ind="${H.ind}"`);
  console.log(`  house   cbeats=${H2.cbeats} view=${H2.view} ruler=${H2.spans} pages=${H2.pages}`);

  // ---- M: THE CHORD CHIPS ARE THE SOUNDING CHORDS. The ⓘ used to re-derive the
  // reharm walk itself — its own CsdTheory.reharmonize call on its own copy of the
  // +40961 stream offset — so the chips matched the audio only while two
  // implementations stayed in step, and nothing checked that they did. Both sides
  // now call CsdEngine.resolveProgression; this binds them: over every genre whose
  // state carries theory.reharm (where a drift would actually show), the panel's
  // chip list must equal the engine's resolved chord names for the same state.
  const M = await page.evaluate(() => {
    const E = window.CsdEngine, K = window.GenreKernel;
    if (!E || !E.resolveProgression) return { skip: "no resolveProgression on the engine" };
    const out = { checked: 0, reharmed: 0, mismatch: [], skeletonSame: 0 };
    for (const g of Object.keys(window.__X.POS).slice(0, 40)) {
      let st; try { st = K.track(g, { seed: 7 }); } catch (e) { continue; }
      if (!(st.theory && st.theory.reharm)) continue;
      const viz = window.__VIZ.harmonyFor ? window.__VIZ.harmonyFor(st) : null;
      const eng = E.resolveProgression(st);
      const engNames = (eng.chords || []).map((c) => String((c && c.name) || "")).filter(Boolean);
      out.checked++;
      if (!viz) { out.mismatch.push(g + ": panel produced no harmony"); continue; }
      if (JSON.stringify(viz.chords) !== JSON.stringify(engNames)) out.mismatch.push(g + ": " + viz.chords.join(",") + " vs " + engNames.join(","));
      const sk = (E.getProgression(st.progression).chords || []).map((c) => c.name);
      if (JSON.stringify(sk) === JSON.stringify(engNames)) out.skeletonSame++; else out.reharmed++;
    }
    return out;
  });
  if (M.skip) { ok(false, `M1: ${M.skip}`); }
  else {
    ok(M.checked >= 5, `M1: only ${M.checked} reharm genres checked (want >=5)`);
    ok(M.mismatch.length === 0, `M2: ${M.mismatch.length} chord-chip mismatches vs the engine: ${M.mismatch.slice(0, 3).join(" | ")}`);
    ok(M.reharmed >= 1, `M3: none of the ${M.checked} checked genres actually reharmonized — the check would pass vacuously`);
    console.log(`\n=== CHORD CHIPS == ENGINE ===`);
    console.log(`  ${M.checked} reharm genres checked, ${M.reharmed} genuinely reharmonized, ${M.mismatch.length} mismatches`);
  }

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
      // the mind meters are RADAR AXES (one unified vector rose,
      // no numeric readouts) — assert the axes render on the radar + the moves line
      const axes = [...box.querySelectorAll("svg.radar text.rax")].map(e => e.textContent);
      mindDom = { axes,
        hasMindAxes: ["adventure", "color", "motion"].every(a => axes.includes(a)),
        numerals: /\b(adventure|color|motion|tempo|swing)\b\s*\d/.test(box.textContent),   // no "axis 73"-style numbers anywhere
        moves: (box.querySelector(".vz-mmoves") || { textContent: "" }).textContent.trim() }; }
    // A LANE NAME IS AN INSTRUMENT, NOT A SHELF POSITION. Alongside the source-id
    // leak, sweep every sampled voice the catalog can resolve through the panel's
    // own naming layer: General MIDI numbers its variants ("Synth Bass 2",
    // "Synth Strings 1"), and the readout was reading those indices out loud
    // where every other lane said an instrument.
    const numbered = [];
    try {
      const K = window.GenreKernel, D = window.__VIZ.nameOf;
      if (D) for (const id of Object.keys(K.SAMPLERS || {})) {
        const said = D(id);
        if (said && /\s\d+$/.test(said)) numbered.push(id + " -> " + said);
      }
    } catch (e) { numbered.push("naming layer threw: " + e.message); }
    return { names, bad: names.filter(n => /dx7|fluidr3|sampler|\bsf2\b|_/i.test(n)),
      provenance, mindGenre, mind, mindDom, numbered };
  });
  ok(J.bad.length === 0, `J1: lane names leak source/provenance: [${J.bad.join(", ")}]`);
  ok(!J.provenance, `J2: modal text mentions soundfont/hardware provenance`);
  ok(J.numbered.length === 0,
    `J2b: ${J.numbered.length} sampler name(s) read out a General MIDI catalog index instead of an instrument: ${J.numbered.slice(0, 4).join(", ")}`);
  console.log(`  naming sweep: every sampler in the library named without a catalog index`);
  ok(!!J.mindGenre, `J3: no genre in POS yields a MIND readout (theory/pipes/rhythm all absent everywhere?)`);
  ok(J.mindDom && J.mindDom.hasMindAxes && J.mindDom.axes.length >= 11,
    `J4: radar must carry ALL vectors incl. adventure/color/motion (axes=[${J.mindDom && J.mindDom.axes.join(",")}])`);
  ok(J.mindDom && !J.mindDom.numerals, `J4b: numeric vector readouts must be gone`);
  console.log(`\n=== DESCRIPTIONS + MIND ===`);
  console.log(`  lane names=[${J.names.join(" · ")}]`);
  console.log(`  mind@${J.mindGenre}: ${JSON.stringify(J.mind)}  axes=${J.mindDom && J.mindDom.axes.length} moves="${J.mindDom && J.mindDom.moves}"`);

  // ---- K: LIVE PLAYHEAD + PLAYHEAD-DRIVEN PAGING. Park the ride ON prelude
  // (chordEvery:16) with the ⓘ open; ONE shared .vz-ph cursor must light, its
  // beat must advance monotonically within a bar, and the window must flip to
  // page 2 exactly when the beat crosses 8 (page = floor(beat/8)). After ■ the
  // cursor goes dark (the ticker cancels itself — zero cost idle).
  ok(await page.evaluate(() => document.getElementById("insideWrap").classList.contains("open")),
    `K pre: ⓘ modal must still be open for the playhead ride`);
  await page.evaluate(async () => {
    const p = window.__X.POS.prelude;
    window.__S.waypoints = [{ x: p[0], y: p[1] }, { x: p[0] + 1, y: p[1] + 1 }];
    window.__X.retarget({ x: p[0], y: p[1] });
    await window.__X.goLive();
  });
  await page.waitForFunction(() => window.__S.live && window.__S.barCount >= 1, { timeout: 40000 });
  // sample the cursor ~3x/sec across ~1.5 chord bars (prelude bars run ~14s)
  const K = [];
  for (let i = 0; i < 140; i++) {
    const s = await page.evaluate(() => {
      const ph = document.querySelector("#inside .vz-ph");
      const tl = document.querySelector("#inside .vz-tl");
      return { on: !!(ph && ph.classList.contains("on")), count: document.querySelectorAll("#inside .vz-ph").length,
        beat: ph && ph.dataset.beat != null ? parseFloat(ph.dataset.beat) : -1,
        page: ph ? +(ph.dataset.page || -1) : -1, pages: tl ? +(tl.dataset.pages || 0) : 0,
        serial: window.__S.barInfo ? window.__S.barInfo.serial : -1,
        cbeats: window.__S.barInfo ? window.__S.barInfo.cbeats : 0,
        firstBeat: (document.querySelector("#inside .vz-ruler span") || { textContent: "" }).textContent.trim(),
        ind: (document.querySelector("#inside .vz-pgind") || { textContent: "" }).textContent.trim() };
    });
    if (s.on && s.beat >= 0) K.push(s);
    // done once we've watched a full page-0 sweep AND landed on page 2
    if (K.length >= 12 && K.some(x => x.page === 1)) break;
    await page.waitForTimeout(350);
  }
  const flips = [], backsteps = [];
  for (let i = 1; i < K.length; i++) {
    const a = K[i - 1], b = K[i];
    if (a.serial !== b.serial) continue;                       // bar wrap: beat legally resets
    const wrap = a.beat > a.cbeats - 1.5 && b.beat < 1.5;      // serial/beat sampling skew at a bar edge (~100ms)
    if (b.beat < a.beat - 0.05 && !wrap) backsteps.push(`${a.beat.toFixed(2)}→${b.beat.toFixed(2)}@s${b.serial}`);
    if (a.page === 0 && b.page === 1) flips.push({ from: a.beat, to: b.beat });
  }
  const flip = flips[0];
  ok(K.length >= 12, `K1: playhead never lit / too few live samples (${K.length})`);
  ok(K.every(s => s.count === 1), `K2: want exactly ONE shared playhead (counts=[${[...new Set(K.map(s => s.count))]}])`);
  ok(backsteps.length === 0, `K3: beat not monotonic within a bar: ${backsteps.slice(0, 4).join(" | ")}`);
  ok(!!flip && flip.from < 8.6 && flip.to >= 7.9,
    `K4: no page flip at beat 8 (flips=${flips.length}${flip ? ` around ${flip.from.toFixed(2)}→${flip.to.toFixed(2)}` : ""})`);
  const onP2 = K.find(s => s.page === 1);
  ok(!!onP2 && onP2.firstBeat === "9" && /2\s*\/\s*2/.test(onP2.ind),
    `K5: page 2 must relabel the ruler 9..16 + indicator ·2/2 (first="${onP2 && onP2.firstBeat}" ind="${onP2 && onP2.ind}")`);
  console.log(`\n=== LIVE PLAYHEAD (prelude) ===`);
  console.log(`  samples=${K.length} cbeats=${K[0] && K[0].cbeats} pages=${K[0] && K[0].pages}`);
  console.log(`  beats=[${K.slice(0, 16).map(s => s.beat.toFixed(1) + "/p" + s.page).join(" ")}${K.length > 16 ? " …" : ""}]`);
  console.log(`  flip=${flip ? flip.from.toFixed(2) + "→" + flip.to.toFixed(2) : "none"} backsteps=${backsteps.length}`);
  // ■ — the cursor must go dark within a couple of ticker frames
  await page.evaluate(() => window.__X.stopLive());
  await page.waitForTimeout(400);
  const dark = await page.evaluate(() => !document.querySelector("#inside .vz-ph.on"));
  ok(dark, `K6: playhead still lit after stop (ticker did not cancel)`);

  // ---- L: TRANSITION LIVENESS — the viz must not drop when a transition
  // starts. PURE regression first — the exact divergence, deterministic: a
  // bar whose meta was scheduled under the OLD harmony (section name gone, ci
  // past the new progression's chord count) must still draw notes against the
  // freshly-flipped state (pre-fix this was 0 notes = a dead panel for 10+s).
  const L0 = await page.evaluate(() => {
    const p = window.__X.POS.house; window.__X.retarget({ x: p[0], y: p[1] });
    const probe = (bi) => {
      const save = window.__S.barInfo; window.__S.barInfo = bi;
      let notes = -1, err = null;
      try { const d = window.__VIZ.data(); notes = d.timeline.lanes.reduce((a, l) => a + l.notes.length, 0); }
      catch (e) { err = String(e).slice(0, 200); }
      window.__S.barInfo = save;
      return { notes, err };
    };
    return { fresh: probe({ ci: 0, serial: 3, section: (window.__S.playing.sections[0] || {}).name }),
      staleSec: probe({ ci: 5, serial: 5, section: "arrive" }),           // old-genre section, overflowed ci
      staleHi: probe({ ci: 7, serial: 9, section: "NO_SUCH_SECTION" }) }; // fully bogus meta
  });
  ok(L0.fresh.notes > 0 && !L0.fresh.err, `L0: sanity — fresh bar draws no notes (${JSON.stringify(L0.fresh)})`);
  ok(L0.staleSec.notes > 0 && !L0.staleSec.err,
    `L1: stale barInfo (old section + ci=5) drew a DEAD timeline (${JSON.stringify(L0.staleSec)}) — mid-flip divergence regressed`);
  ok(L0.staleHi.notes > 0 && !L0.staleHi.err,
    `L2: bogus barInfo (ci=7, unknown section) drew a DEAD timeline (${JSON.stringify(L0.staleHi)})`);
  // LIVE regression: ride a REAL cross-genre flip with the ⓘ open (house →
  // prelude: sections+harmony rewritten under the ride) — every sampled bar
  // across the flip window must render a non-empty timeline.
  await page.evaluate(async () => {
    const p = window.__X.POS.house;
    window.__S.waypoints = [{ x: p[0], y: p[1] }, { x: p[0] + 1, y: p[1] + 1 }];
    window.__X.retarget({ x: p[0], y: p[1] });
    await window.__X.goLive();
  });
  await page.waitForFunction(() => window.__S.live && window.__S.barCount >= 2, { timeout: 40000 });
  const Lb0 = await page.evaluate(() => {
    const p = window.__X.POS.prelude;                       // flip mid-ride
    window.__S.waypoints = [{ x: p[0], y: p[1] }, { x: p[0] + 1, y: p[1] + 1 }];
    window.__X.retarget({ x: p[0], y: p[1] });
    return window.__S.barCount;
  });
  const Lbars = [], Ldead = [];
  for (let i = 0; i < 300; i++) {
    const s = await page.evaluate(() => {
      const box = document.getElementById("inside");
      return { bar: window.__S.barCount, rows: box.querySelectorAll(".vz-tlrow").length,
        html: box.innerHTML.length,
        notes: (() => { try { return window.__VIZ.data().timeline.lanes.reduce((a, l) => a + l.notes.length, 0); } catch (e) { return -1; } })() };
    });
    if (!Lbars.length || Lbars[Lbars.length - 1].bar !== s.bar) {
      Lbars.push(s);
      if (s.rows < 2 || s.html < 1500 || s.notes <= 0) Ldead.push(s);
    }
    if (s.bar >= Lb0 + 7) break;
    await page.waitForTimeout(400);
  }
  ok(Lbars.length >= 6, `L3: flip ride sampled too few bars (${Lbars.length})`);
  ok(Ldead.length === 0, `L4: viz dropped on ${Ldead.length} bar(s) across the flip window: ${JSON.stringify(Ldead.slice(0, 3))}`);
  console.log(`\n=== TRANSITION LIVENESS (house→prelude flip) ===`);
  console.log(`  pure: fresh=${L0.fresh.notes} staleSec=${L0.staleSec.notes} staleHi=${L0.staleHi.notes} notes`);
  console.log(`  live: bars=[${Lbars.map(b => b.bar + ":" + b.notes + "n/" + b.rows + "r").join(" ")}] dead=${Ldead.length}`);
  await page.evaluate(() => window.__X.stopLive());
  await page.waitForTimeout(400);

  // ---- I: FOUND-LANE LIVENESS — found audio plays, so the viz must show it.
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
