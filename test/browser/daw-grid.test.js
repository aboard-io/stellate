#!/usr/bin/env node
// test/browser/daw-grid.test.js — THE GRID itself: rows × sections, the sheet
// routing, per-section rules, and the URL as the song.
//
//   A shape          6 track rows × the RESOLVED section count; every cell has a
//                    sized canvas; the SONG bar carries one chip per section
//   B routing        a real click on a cell opens the sheet FOR THAT TRACK
//                    (title + tabs); row header = whole song; master row =
//                    master sheet; a song-bar chip = the section sheet
//   C secover off    turning one section's voice off (patch.secover) dims
//                    EXACTLY that cell (∅) and drops that voice's events in
//                    that span — every other span keeps its notes
//   D round-trip     secover + sound ride ?p; a fresh page restores both, the
//                    dimmed cell, and the resolved sampler id
//   E hostile ?p     a crafted ?p with foundSources smuggling, fake secover
//                    section ids and a non-SAMPLERS instrument boots clean and
//                    resolves BYTE-IDENTICAL to a patchless boot
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const TRACKS = ["chords", "melody", "bass", "pad", "drums", "samples"];
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const allHashes = (page) => page.evaluate((tracks) => {
  const o = {};
  for (const t of tracks) o[t] = window.__DAW.grid.rowHash(t);
  return o;
}, TRACKS);

// the section-span math song.js walks (cycles × chords × chordEvery), replicated
// in-page so the gate windows events exactly where the grid draws them
const IN_PAGE_LIB = `
  window.__gateSpans = (st) => {
    const E = window.CsdEngine;
    const prg = (E.resolveProgression ? E.resolveProgression(st) : null) || E.PROGRESSIONS[st.progression];
    const n = (prg && prg.chords && prg.chords.length) || 4;
    const cb = Math.max(2, Math.round(st.chordEvery || (st.meter ? 6 : 8)));
    const out = []; let at = 0;
    (st.sections || []).forEach((sec, i) => {
      const beats = Math.max(1, (sec.cycles || 1)) * n * cb;
      out.push({ id: i + ":" + (sec.name || ""), i, start: at, beats, sec }); at += beats;
    });
    return out;
  };
  // events per section span for one voice. GUARD: humanize jitters a bar's
  // first note a few ms EARLY (measured: verse's downbeat at 31.999 against a
  // span start of 32), so the window shifts half a beat left — a note belongs
  // to the section whose bar it plays in, not the raw float comparison.
  window.__gateVoiceCounts = (voice) => {
    const st = window.__DAWSTATE(), GUARD = 0.5;
    const ev = window.CsdEngine.buildEvents(st);
    return window.__gateSpans(st).map((sp) =>
      ev.pitched.filter((e) => e.voice === voice &&
        e.beat >= sp.start - GUARD && e.beat < sp.start + sp.beats - GUARD).length);
  };
`;

async function main() {
  const srv = await serve(ROOT, 8981);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  const BASE = `http://127.0.0.1:${srv.port}/daw.html?g=citypop&seed=7`;

  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.evaluate(IN_PAGE_LIB);

  // ---- A shape ----
  const shape = await page.evaluate(() => ({
    rows: window.__DAW.grid.rows(), cols: window.__DAW.grid.cols(),
    cells: window.__DAW.grid.cellCount(),
    secs: window.__DAWSTATE().sections.length,
    sized: [...document.querySelectorAll(".dw-cellcv")].every((c) => c.width > 0 && c.height > 0),
    chips: document.querySelectorAll("#dwSong .dw-secchip").length,
  }));
  if (shape.rows.length !== 6 || shape.cols !== shape.secs || shape.cells !== 6 * shape.cols)
    fail(`grid shape: ${shape.rows.length} rows × ${shape.cols} cols vs ${shape.secs} sections (${shape.cells} cells)`);
  else ok(`the grid is 6 tracks × ${shape.cols} resolved sections (${shape.cells} cells)`);
  if (!shape.sized) fail("a cell canvas is unsized"); else ok("every cell canvas is sized");
  if (shape.chips !== shape.cols) fail(`song bar has ${shape.chips} chips for ${shape.cols} sections`);
  else ok("the SONG bar carries one chip per section");

  // ---- B routing: real clicks, then read the sheet ----
  const route = async (click, want) => {
    const got = await page.evaluate((c) => {
      eval(c);
      const el = window.__DAW.sheet.el();
      return { hidden: el.hidden, title: el.querySelector(".dw-sheettitle").textContent,
        tabs: [...el.querySelectorAll(".dw-sheettab")].map((t) => t.textContent) };
    }, click);
    await page.evaluate(() => window.__DAW.sheet.close());
    return got;
  };
  const cell = await route(`document.querySelector('.dw-cellbtn[data-track="drums"][data-sec="1"]').click()`);
  if (cell.hidden || !/^drums/.test(cell.title)) fail("cell tap did not open the drums sheet: " + JSON.stringify(cell));
  else ok(`a drums cell opens the drums sheet ("${cell.title}")`);
  if (cell.tabs.join(",") !== "part,sound") fail("drums sheet tabs: " + cell.tabs.join(","));
  else ok("the voice sheet carries PART | SOUND tabs");
  const rowh = await route(`document.querySelector('.dw-rowhead[data-track="melody"]').click()`);
  if (rowh.hidden || rowh.title !== "melody") fail("row-header tap: " + JSON.stringify(rowh));
  else ok("a row header opens the whole-song sheet for that track");
  const mast = await route(`document.querySelector('.dw-mastercell').click()`);
  if (mast.hidden || mast.title !== "master") fail("master cell: " + JSON.stringify(mast));
  else ok("the master row opens the master sheet");
  const secs = await route(`document.querySelector('#dwSong .dw-secchip').click()`);
  if (secs.hidden || !/^section/.test(secs.title)) fail("song-bar chip: " + JSON.stringify(secs));
  else ok(`a song-bar chip opens the section sheet ("${secs.title}")`);

  // ---- C secover: one section's voice off dims that cell + drops its events ----
  const target = await page.evaluate(() => {
    const st = window.__DAWSTATE();
    const spans = window.__gateSpans(st);
    for (const voice of ["bass", "melody"]) {
      const counts = window.__gateVoiceCounts(voice);
      for (const sp of spans) {
        const v = sp.sec[voice];
        if (v && v !== "off" && counts[sp.i] > 0) return { voice, i: sp.i, id: sp.id, counts };
      }
    }
    return null;
  });
  if (!target) { fail("no section plays bass or melody — cannot exercise secover"); }
  else {
    ok(`target: ${target.voice} in section ${target.i} (${target.counts[target.i]} events)`);
    const preOff = await page.evaluate((t) =>
      [...document.querySelectorAll(`.dw-cellbtn[data-track="${t}"]`)].map((c) => c.classList.contains("off")),
      target.voice);
    const preHashes = await allHashes(page);
    await page.evaluate((t) => {
      const p = Object.assign({}, window.__DAW.SONG.patch);
      p.secover = Object.assign({}, p.secover || {}, { [t.id]: { [t.voice]: "off" } });
      window.__DAW.edit({ patch: p });
    }, target);
    await page.waitForTimeout(400);
    const after = await page.evaluate((t) => ({
      off: [...document.querySelectorAll(`.dw-cellbtn[data-track="${t.voice}"]`)].map((c) => c.classList.contains("off")),
      counts: window.__gateVoiceCounts(t.voice),
      resolved: (window.__DAWSTATE().sections[t.i] || {})[t.voice],
    }), target);
    if (after.resolved !== "off") fail("secover did not reach the resolved section: " + after.resolved);
    else ok("the override lands on the resolved section (never Object.assign onto state)");
    const dimDiff = after.off.map((v, i) => v !== preOff[i] ? i : -1).filter((i) => i >= 0);
    if (dimDiff.join(",") !== String(target.i))
      fail(`dimmed cells changed at [${dimDiff.join(",")}] — expected exactly [${target.i}]`);
    else ok(`exactly that cell dims to ∅ (section ${target.i})`);
    if (after.counts[target.i] !== 0) fail(`section ${target.i} still has ${after.counts[target.i]} ${target.voice} events`);
    else ok("the voice's events in that span are gone");
    // NOTE the engine's voice stream is CONTINUOUS across sections (bar patterns
    // index by bars played), so later sections legitimately reflow — the contract
    // is the off section silent and the song poorer by its notes, nothing more.
    const sum = (a) => a.reduce((n, x) => n + x, 0);
    if (sum(after.counts) >= sum(target.counts))
      fail(`total ${target.voice} events did not drop: ${sum(target.counts)} → ${sum(after.counts)}`);
    else ok(`the song lost that section's notes (${sum(target.counts)} → ${sum(after.counts)} total)`);
    const postHashes = await allHashes(page);
    const spill = TRACKS.filter((t) => t !== target.voice && postHashes[t] !== preHashes[t]);
    if (spill.length) fail("the section rule also repainted: " + spill.join(","));
    else ok("only that voice's row repainted (the rack law holds for rules too)");
  }

  // ---- D round-trip: secover + sound in ?p ----
  const picked = await page.evaluate(() => {
    const st = window.__DAWSTATE(), K = window.GenreKernel;
    const cur = (st.instruments.melody && st.instruments.melody.sampler && st.instruments.melody.sampler.id) || null;
    const id = Object.keys(K.SAMPLERS).find((k) => k !== cur &&
      K.SAMPLERS[k].zones && K.SAMPLERS[k].zones.length);
    const p = Object.assign({}, window.__DAW.SONG.patch, { sound: { melody: { instrument: id } } });
    window.__DAW.edit({ patch: p });
    return id;
  });
  await page.waitForTimeout(400);
  const resolved = await page.evaluate(() => {
    const I = window.__DAWSTATE().instruments.melody || {};
    return { model: I.model, id: I.sampler && I.sampler.id, url: location.href };
  });
  if (resolved.model !== "sampler" || resolved.id !== picked)
    fail(`sound override did not resolve: model=${resolved.model} id=${resolved.id} wanted ${picked}`);
  else ok(`patch.sound rewrites the melody recipe to sampler "${picked}"`);
  if (!/[?&]p=/.test(resolved.url)) fail("the edits never reached ?p");
  else ok("secover + sound ride the URL");

  const p2 = await browser.newPage();
  const errs2 = capturePageErrors(p2);
  await p2.goto(resolved.url, { waitUntil: "load" });
  await p2.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await p2.waitForTimeout(400);
  const back = await p2.evaluate((t) => {
    const P = window.__DAW.SONG.patch, st = window.__DAWSTATE();
    return {
      secover: P.secover || null, sound: P.sound || null,
      resolvedSec: t ? (st.sections[t.i] || {})[t.voice] : null,
      dimmed: t ? document.querySelector(`.dw-cellbtn[data-track="${t.voice}"][data-sec="${t.i}"]`)
        .classList.contains("off") : null,
      samplerId: st.instruments.melody && st.instruments.melody.sampler && st.instruments.melody.sampler.id,
    };
  }, target);
  if (errs2.length) fail("reloaded page errored: " + errs2.join(" | "));
  if (!back.secover || (target && back.resolvedSec !== "off") || (target && !back.dimmed))
    fail("reload lost the secover rule: " + JSON.stringify({ secover: back.secover, resolvedSec: back.resolvedSec, dimmed: back.dimmed }));
  else ok("reload restores the section rule and the dimmed ∅ cell");
  if (!back.sound || back.samplerId !== picked)
    fail(`reload lost the sound override: patch=${JSON.stringify(back.sound)} resolved=${back.samplerId}`);
  else ok("reload restores the instrument override (resolved sampler id intact)");
  await p2.close();

  // ---- E hostile ?p resolves byte-identical to a patchless boot ----
  const evil = b64u({
    foundSources: [{ id: "x", url: "https://evil.example/x.mp3",
      samplePath: "https://evil.example/x.mp3", vol: 1 }],
    secover: { "notasection": { drums: "house" },
               "0:__nope__": { drums: "not_a_kit", melody: "not_a_pattern", cycles: 99 },
               "99:ghost": { drums: "house" } },
    sound: { melody: { instrument: "not_a_sampler_id" }, drums: { instrument: "house" }, bass: 5 },
  });
  const pHost = await browser.newPage();
  const errsH = capturePageErrors(pHost);
  await pHost.goto(BASE + "&p=" + evil, { waitUntil: "load" });
  await pHost.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await pHost.waitForTimeout(400);
  const pClean = await browser.newPage();
  await pClean.goto(BASE, { waitUntil: "load" });
  await pClean.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await pClean.waitForTimeout(400);

  const read = (pg) => pg.evaluate((tracks) => {
    const st = window.__DAWSTATE(), P = window.__DAW.SONG.patch;
    const hashes = {};
    for (const t of tracks) hashes[t] = window.__DAW.grid.rowHash(t);
    return { hashes, bpm: st.bpm,
      secNames: (st.sections || []).map((s) => s.name + ":" + (s.cycles || 1)).join("|"),
      melModel: (st.instruments.melody || {}).model,
      evilSrc: (st.foundSources || []).some((f) => /evil\.example/.test((f.url || "") + (f.samplePath || ""))),
      patchFound: "foundSources" in P, patchSound: P.sound || null,
      secoverIds: Object.keys(P.secover || {}) };
  }, TRACKS);
  const H = await read(pHost), C = await read(pClean);
  if (errsH.length) fail("hostile page errored: " + errsH.join(" | "));
  else ok("a hostile ?p boots without a page error");
  if (H.patchFound) fail("foundSources smuggled into the patch");
  else ok("foundSources cannot ride the patch (the no-remote-sources law)");
  if (H.evilSrc) fail("a remote source reached the resolved state");
  else ok("no remote source in the resolved state");
  if (H.patchSound) fail("hostile sound survived decode: " + JSON.stringify(H.patchSound));
  else ok("a non-SAMPLERS instrument (and drums/bass junk) drops at the door");
  const badIds = H.secoverIds.filter((id) => id !== "99:ghost");
  if (badIds.length) fail("malformed secover ids survived: " + badIds.join(","));
  else ok("fake / malformed section ids drop (a well-formed ghost id stays inert)");
  const drift = TRACKS.filter((t) => H.hashes[t] !== C.hashes[t]);
  if (drift.length || H.secNames !== C.secNames || H.bpm !== C.bpm || H.melModel !== C.melModel)
    fail("hostile boot drifted from the clean boot: rows " + drift.join(",") +
      ` form ${H.secNames === C.secNames} bpm ${H.bpm}/${C.bpm} melody ${H.melModel}/${C.melModel}`);
  else ok("the hostile boot resolves byte-identical to a patchless boot (dropped SILENTLY)");
  await pHost.close(); await pClean.close();

  // ---- F a patch whose KEYS are whitelisted but whose SHAPE detonates in the
  // engine (kits with junk ops, pipes naming no transform) must not kill boot:
  // main.js trial-builds the decoded patch and drops it whole if buildEvents
  // throws. The adversarial review found exactly this hole — a shareable link
  // that leaves the DAW dead with an unpainted grid.
  // measured in node against the resolved citypop state (this gate's base):
  // ops:"junk" on "full" — the kit the form PLAYS — throws "hs is not iterable"
  // deep in buildEvents, past every key-level whitelist. The bomb must target
  // the played vocabulary: junk on a kit the form never draws is inert.
  const bomb = b64u({
    kits: { full: { ops: "junk" } },
    pipes: [{ id: "not-a-pipe", prob: 0.5 }],
  });
  const pBomb = await browser.newPage();
  const errsB = capturePageErrors(pBomb);
  await pBomb.goto(BASE + "&p=" + bomb, { waitUntil: "load" });
  await pBomb.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await pBomb.waitForTimeout(300);
  const bombState = await pBomb.evaluate(() => ({
    patchKeys: Object.keys(window.__DAW.SONG.patch || {}),
    cols: window.__DAW.grid.cols(),
  }));
  if (errsB.length) fail("malformed-shape ?p killed the page: " + errsB.join(" | "));
  else ok("a whitelisted-key patch with a detonating SHAPE still boots (trial build)");
  if (bombState.patchKeys.length) fail("the unbuildable patch survived the trial build: " + bombState.patchKeys.join(","));
  else ok("the unbuildable patch dropped whole — the grid painted " + bombState.cols + " sections");
  await pBomb.close();

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors on the main page");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-GRID: FAIL");
  else console.log(`\nDAW-GRID: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
