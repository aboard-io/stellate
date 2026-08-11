#!/usr/bin/env node
// test/browser/daw-sound.test.js — the INSTRUMENT PICK, door to speaker.
//
// The sound tab's instrument pick writes patch.sound; song.js applySound mirrors
// the kernel's pitched→sampler rewrite; state-engine's voiceUnits builds the
// native sampler unit from it. This gate walks that whole path THROUGH THE UI —
// which since 2026-08-11 is ONE TABLE in a drill-in picker view, not two rows of
// chips (the lozenge wall is gone; a picker is a place you go):
//
//   A the pick       clicking the pick row pushes the picker view; the table is
//                    grouped by family with "genre's own" first, the filter
//                    narrows it, and clicking a row changes the RESOLVED
//                    st.instruments.melody to {model:"sampler", sampler:{id}} —
//                    the id the row named — then pops back to the sound tab
//   B rack law       the pick repaints ONLY the melody row's identity: every
//                    other row hashes pixel-identical; the melody row header
//                    names the new instrument
//   C the URL        reload restores the override (patch.sound + resolved id)
//                    and reproduces every row hash
//   D the engine     FaustStateEngine.voiceUnits maps the overridden voice to
//                    a native sampler unit that still carries the zones — and
//                    every zone source the rewrite injected is local, vol 0
//   E genre's own    the table's first row drops the override and the kernel
//                    chooses again (patch.sound gone, baseline instrument back)
//   F readable       124 rows is where a table stops being a table: a screen
//                    down, the column head and the family header are STILL
//                    pinned to the top of the sheet, and the last row sits above
//                    the transport rather than behind it
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const TRACKS = ["chords", "melody", "bass", "pad", "drums", "samples"];

const allHashes = (page) => page.evaluate((tracks) => {
  const o = {};
  for (const t of tracks) o[t] = window.__DAW.grid.rowHash(t);
  return o;
}, TRACKS);

async function main() {
  const srv = await serve(ROOT, 8985);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=citypop&seed=7`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await page.waitForTimeout(400);

  const base = await page.evaluate(() => {
    const I = window.__DAWSTATE().instruments.melody || {};
    return { id: (I.sampler && I.sampler.id) || null, model: I.model };
  });
  ok(`baseline melody: ${base.model}${base.id ? " (" + base.id + ")" : ""}`);
  const preHashes = await allHashes(page);

  // ---- A: pick an instrument through the real table ----
  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => {
    const btn = document.querySelector(".dw-sheetbody .dw-pick");
    if (!btn) return { err: "no pick row on the sound tab" };
    btn.click();                                  // → the picker view
    const t = (window.__DAW.tables() || [])[0];
    if (!t) return { err: "the pick row opened no table" };
    const short = [...document.querySelectorAll(".dw-sheetbody .dw-trow")]
      .filter((r) => r.getBoundingClientRect().height < 44).length;
    return { depth: window.__DAW.sheet.depth(), rows: t.count(),
      first: t.ids()[0],
      groups: document.querySelectorAll(".dw-sheetbody .dw-tgroup").length,
      hasFilter: !!t.filterEl(), short,
      ranges: document.querySelectorAll('input[type="range"]').length };
  });
  if (opened.err) fail(opened.err);
  else if (opened.depth !== 2) fail("the pick row did not push a picker view (depth " + opened.depth + ")");
  else ok(`the pick row pushes a picker view: ${opened.rows} rows in ${opened.groups} family groups`);
  if (opened.first !== "__own") fail('the first row is not "genre\'s own": ' + opened.first);
  else ok('"genre\'s own" is the first row');
  if (!opened.hasFilter) fail("the instrument table has no filter box");
  else ok("the table filters");
  if (opened.short) fail(opened.short + " table rows are under 44px");
  else ok("every row clears 44px");
  if (opened.ranges) fail("a range input appeared: " + opened.ranges);
  else ok("still zero range inputs");

  const picked = await page.evaluate(() => {
    const t = (window.__DAW.tables() || [])[0];
    const baseId = (() => { const I = window.__DAWSTATE().instruments.melody || {};
      return (I.sampler && I.sampler.id) || null; })();
    t.filter("piano");                            // the filter narrows to a family's shelf
    const vis = t.visibleIds().filter((id) => id !== "__own" && id !== baseId);
    if (!vis.length) return { err: "the filter narrowed to nothing" };
    const narrowed = vis.length;
    const row = t.rowEl(vis[0]);
    const chip = row.querySelector(".dw-tname").textContent;
    const family = row.querySelector(".dw-tright").textContent;
    row.click();                                  // the row IS the edit
    const id = ((window.__DAW.SONG.patch.sound || {}).melody || {}).instrument;
    if (!id || id === baseId) return { err: "clicking a row wrote no new override" };
    return { id, chip, family, narrowed, depth: window.__DAW.sheet.depth() };
  });
  if (picked.err) fail(picked.err);
  else ok(`filtered to ${picked.narrowed} rows, clicked "${picked.chip}" (${picked.family}) → ${picked.id}`);
  if (!picked.err && picked.depth !== 1) fail("picking did not pop back to the sound tab (depth " + picked.depth + ")");
  else if (!picked.err) ok("picking commits and pops back to the sound tab");
  await page.waitForTimeout(400);

  const resolved = await page.evaluate(() => {
    const st = window.__DAWSTATE();
    const I = st.instruments.melody || {};
    return { model: I.model, id: I.sampler && I.sampler.id,
      zones: (I.sampler && I.sampler.zones && I.sampler.zones.length) || 0,
      playing: (document.querySelector(".dw-sheetbody .dw-edval") || {}).textContent || "" };
  });
  if (picked.err) {}
  else if (resolved.model !== "sampler" || resolved.id !== picked.id)
    fail(`resolved instrument is ${resolved.model}/${resolved.id}, chip said ${picked.id}`);
  else ok(`the resolved recipe is now sampler "${resolved.id}" (${resolved.zones} zones)`);
  if (!/playing:/.test(resolved.playing)) fail("the sheet header does not echo the pick: " + resolved.playing);
  else ok(`the sheet says so (${resolved.playing.trim()})`);

  // ---- B: only that row ----
  await page.evaluate(() => window.__DAW.sheet.close());
  await page.waitForTimeout(300);
  const postHashes = await allHashes(page);
  const spill = TRACKS.filter((t) => t !== "melody" && postHashes[t] !== preHashes[t]);
  if (spill.length) fail("the pick also repainted: " + spill.join(", ") + " — the rack law is not holding");
  else ok("every other row hashed pixel-identical (the rack law)");
  const rowWord = await page.evaluate(() =>
    document.querySelector('.dw-rowhead[data-track="melody"] .dw-rowinst').textContent);
  const wantWord = picked.id ? String(picked.id).replace(/_/g, " ").slice(0, 16) : "";
  if (picked.id && rowWord !== wantWord)
    fail(`the melody row header says "${rowWord}", not "${wantWord}"`);
  else ok(`the row header names the new instrument ("${rowWord}")`);

  // ---- C: it survives the URL ----
  const url = await page.evaluate(() => location.href);
  if (!/[?&]p=/.test(url)) fail("the pick never reached ?p");
  else ok("the pick rides the URL");
  const p2 = await browser.newPage();
  const errs2 = capturePageErrors(p2);
  await p2.goto(url, { waitUntil: "load" });
  await p2.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await p2.waitForTimeout(400);
  const back = await p2.evaluate(() => {
    const st = window.__DAWSTATE();
    const I = st.instruments.melody || {};
    return { patch: ((window.__DAW.SONG.patch.sound || {}).melody || {}).instrument,
      id: I.sampler && I.sampler.id, model: I.model };
  });
  if (errs2.length) fail("reloaded page errored: " + errs2.join(" | "));
  if (back.patch !== picked.id || back.id !== picked.id || back.model !== "sampler")
    fail(`reload lost the pick: patch=${back.patch} resolved=${back.model}/${back.id}`);
  else ok(`reload restores the override (sampler "${back.id}")`);
  const backHashes = await p2.evaluate((tracks) => {
    const o = {};
    for (const t of tracks) o[t] = window.__DAW.grid.rowHash(t);
    return o;
  }, TRACKS);
  const differ = TRACKS.filter((t) => postHashes[t] !== backHashes[t]);
  if (differ.length) fail("reload did not reproduce the rows: " + differ.join(", "));
  else ok("reload reproduces every row hash — the link IS the song");
  await p2.close();

  // ---- D: the state-engine map still carries the zones ----
  const unit = await page.evaluate(() => {
    const st = window.__DAWSTATE();
    const units = window.FaustStateEngine.voiceUnits(window.CsdEngine, st);
    const u = units.melody || {};
    const sp = u.sampler || {};
    const zones = Array.isArray(sp.zones) ? sp.zones : [];
    const srcIds = new Set((st.foundSources || []).map((f) => f.id));
    const injected = (st.foundSources || []).filter((f) => /^ins_/.test(f.id || ""));
    return {
      module: u.module, id: sp.id, nZones: zones.length,
      zonesResolvable: zones.every((z) => z.srcId && srcIds.has(z.srcId)),
      injected: injected.length,
      allLocal: injected.every((f) => !f.url && /^found\/samples\/instruments\//.test(f.samplePath || "")),
      allSilent: injected.every((f) => (f.vol || 0) === 0),
    };
  });
  if (unit.id !== picked.id || unit.module !== null)
    fail(`voiceUnits mapped melody to ${unit.module}/${unit.id}, not the native sampler "${picked.id}"`);
  else ok(`voiceUnits builds the native sampler unit (module:null, id "${unit.id}")`);
  if (!unit.nZones) fail("the mapped unit carries no zones");
  else ok(`the unit still carries ${unit.nZones} sampler zones`);
  if (!unit.zonesResolvable) fail("a zone's srcId is missing from foundSources — it cannot decode");
  else ok("every zone's srcId resolves in foundSources (the decode path is fed)");
  if (!unit.injected || !unit.allLocal)
    fail(`injected zone sources not all local: ${unit.injected} entries, local=${unit.allLocal}`);
  else ok(`all ${unit.injected} injected zone sources are local paths (no-remote-sources law)`);
  if (!unit.allSilent) fail("an injected zone source has vol > 0 — it would play as a bed");
  else ok("injected zone sources ride at vol 0 (instrument audio, never a bed)");

  // ---- E: "genre's own" drops the override (and the table opens ON the pick) ----
  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  const reopened = await page.evaluate(() => {
    document.querySelector(".dw-sheetbody .dw-pick").click();
    const t = (window.__DAW.tables() || [])[0];
    return { value: t.value(), rows: t.count() };
  });
  if (reopened.value !== picked.id)
    fail(`the picker did not open on the current instrument: ${reopened.value} vs ${picked.id}`);
  else ok(`the picker opens marked on the current instrument ("${reopened.value}" of ${reopened.rows})`);
  await page.waitForTimeout(500);
  const inView = await page.evaluate(() => {
    const b = document.querySelector(".dw-sheetbody"), r = b.querySelector(".dw-trow.on");
    if (!r) return false;
    const br = b.getBoundingClientRect(), rr = r.getBoundingClientRect();
    return rr.top >= br.top && rr.bottom <= br.bottom;
  });
  if (!inView) fail("the current row is not scrolled into view when the picker opens");
  else ok("the current row is scrolled into view");
  await page.evaluate(() => (window.__DAW.tables() || [])[0].rowEl("__own").click());
  await page.waitForTimeout(400);
  const own = await page.evaluate(() => {
    const st = window.__DAWSTATE();
    const I = st.instruments.melody || {};
    return { patch: (window.__DAW.SONG.patch.sound || {}).melody || null,
      id: (I.sampler && I.sampler.id) || null, model: I.model };
  });
  if (own.patch) fail("\"genre's own\" left the override: " + JSON.stringify(own.patch));
  else ok("\"genre's own\" drops the override");
  if (own.id !== base.id || own.model !== base.model)
    fail(`the kernel did not choose again: ${own.model}/${own.id} vs baseline ${base.model}/${base.id}`);
  else ok(`the genre's own instrument is back (${own.model}${own.id ? " " + own.id : ""})`);

  // ---- F the picker is READABLE: sticky heads, and a floor above the transport
  // 124 rows in a phone-sized sheet is exactly where a table stops being a table:
  // scroll a screen down and the column head and the family header have to still
  // be there, or you are looking at an unlabelled list of names — the failure the
  // lozenge wall had. And the LAST row has to be reachable: the sheet's floor is
  // the controller's ceiling, so nothing hides behind the transport bar.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  const stuck = await page.evaluate(async () => {
    document.querySelector(".dw-sheetbody .dw-pick").click();
    const body = document.querySelector(".dw-sheetbody");
    // the picker centres itself on the current row in a rAF (controls.js
    // scrollToCur through the OUTER scroller) — let that land first, or the gate
    // is racing the app for the same scrollTop.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    body.scrollTop = 900;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const br = body.getBoundingClientRect();
    const th = document.querySelector(".dw-sheetbody .dw-table thead .dw-th");
    const groups = [...document.querySelectorAll(".dw-sheetbody .dw-tgroup th")]
      .map((g) => g.getBoundingClientRect()).filter((r) => r.bottom > br.top && r.top < br.bottom);
    const rows = [...document.querySelectorAll(".dw-sheetbody .dw-trow")];
    const last = rows[rows.length - 1].getBoundingClientRect();
    const ctl = document.getElementById("dwCtl").getBoundingClientRect();
    const hr = th ? th.getBoundingClientRect() : null;
    return { scrolled: body.scrollTop,
      headOff: hr ? Math.round(hr.top - br.top) : null,
      headText: th ? th.textContent : null,
      groupOff: groups.length ? Math.round(groups[0].top - br.top) : null,
      groupSeen: groups.length, bodyBottom: Math.round(br.bottom),
      lastBottom: Math.round(last.bottom), ctlTop: Math.round(ctl.top) };
  });
  if (!(stuck.scrolled > 400)) fail("the picker did not scroll — 124 rows in one screen?");
  else if (stuck.headOff == null || stuck.headOff > 8 || stuck.headOff < -1)
    fail(`the column head unstuck at scrollTop ${stuck.scrolled} (${stuck.headOff}px off the body top)`);
  else ok(`the column head ("${stuck.headText}") stays pinned ${stuck.headOff}px under the sheet top at scrollTop ${stuck.scrolled}`);
  if (!stuck.groupSeen || stuck.groupOff == null || stuck.groupOff > 48)
    fail(`no family header pinned under it (${stuck.groupSeen} on screen, first at +${stuck.groupOff})`);
  else ok(`a family header rides ${stuck.groupOff}px under it — you always know which shelf you are on`);
  if (stuck.bodyBottom > stuck.ctlTop + 1)
    fail(`the sheet body (${stuck.bodyBottom}) runs under the controller (${stuck.ctlTop}) — the last rows are unreachable`);
  else ok("the picker's floor is the controller's ceiling — every row is reachable");
  await page.evaluate(() => window.__DAW.sheet.close());

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-SOUND: FAIL");
  else console.log(`\nDAW-SOUND: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
