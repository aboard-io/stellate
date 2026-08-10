#!/usr/bin/env node
// test/browser/daw-sound.test.js — the INSTRUMENT PICK, door to speaker.
//
// The sound tab's two-level pick writes patch.sound; song.js applySound mirrors
// the kernel's pitched→sampler rewrite; state-engine's voiceUnits builds the
// native sampler unit from it. This gate walks that whole path THROUGH THE UI:
//
//   A the pick       real clicks on family → instrument chips change the
//                    RESOLVED st.instruments.melody to {model:"sampler",
//                    sampler:{id}} — the id the chip named
//   B rack law       the pick repaints ONLY the melody row's identity: every
//                    other row hashes pixel-identical; the melody row header
//                    names the new instrument
//   C the URL        reload restores the override (patch.sound + resolved id)
//                    and reproduces every row hash
//   D the engine     FaustStateEngine.voiceUnits maps the overridden voice to
//                    a native sampler unit that still carries the zones — and
//                    every zone source the rewrite injected is local, vol 0
//   E genre's own    the first chip drops the override and the kernel chooses
//                    again (patch.sound gone, baseline instrument back)
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

  // ---- A: pick an instrument through the real chips ----
  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  const picked = await page.evaluate(() => {
    const body = document.querySelector(".dw-sheetbody");
    const famBtns = [...body.querySelectorAll(".dw-chips")[0].querySelectorAll(".dw-chip")];
    if (famBtns.length < 2) return { err: "no family chips" };
    if (famBtns[0].textContent !== "genre's own") return { err: "first chip is not \"genre's own\"" };
    const baseId = (() => { const I = window.__DAWSTATE().instruments.melody || {};
      return (I.sampler && I.sampler.id) || null; })();
    for (let fi = 1; fi < famBtns.length; fi++) {
      famBtns[fi].click();                       // browsing a family writes nothing
      if ((window.__DAW.SONG.patch.sound || {}).melody) return { err: "browsing a family wrote an override" };
      const rows = [...body.querySelectorAll(".dw-chips")];
      const instBtns = rows[1] ? [...rows[1].querySelectorAll(".dw-chip")] : [];
      for (const ib of instBtns) {
        ib.click();
        const id = ((window.__DAW.SONG.patch.sound || {}).melody || {}).instrument;
        if (id && id !== baseId) return { id, chip: ib.textContent, family: famBtns[fi].textContent };
      }
    }
    return { err: "no instrument chip produced a new override" };
  });
  if (picked.err) fail(picked.err);
  else ok(`clicked ${picked.family} → "${picked.chip}" (browsing wrote nothing; the instrument chip is the edit)`);
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

  // ---- E: "genre's own" drops the override ----
  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const body = document.querySelector(".dw-sheetbody");
    [...body.querySelectorAll(".dw-chips")[0].querySelectorAll(".dw-chip")]
      .find((b) => b.textContent === "genre's own").click();
  });
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

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-SOUND: FAIL");
  else console.log(`\nDAW-SOUND: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
