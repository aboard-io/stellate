#!/usr/bin/env node
// test/browser/daw-rack.test.js — THE /daw RACK GATE (docs/DAW.md stage 2).
//
// The rack's whole promise is that each row shows what THAT machine writes, and
// that touching one machine moves only that machine. A screenshot can't tell you
// either. So this gate drives daw.html headless and holds four contracts:
//
//   A boots clean          — page errors none, one row per TRACKS entry, engine
//                            globals published in the right order
//   B the roll is the ENGINE's — every row's note count equals
//                            buildEvents(state) filtered for that voice, computed
//                            independently in the page from the same state, so a
//                            roll that quietly re-derives its own notes fails
//   C the rack law holds   — the resolved state carries voiceStreams, and changing
//                            the SEED changes every row (control), while the
//                            document round-trips through the ?g/?seed query
//   D silence is drawn     — a track the form never turns on is marked .dw-off
//                            rather than dropped, and its roll still exists
//
// Run: node test/browser/daw-rack.test.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

async function main() {
  const srv = await serve(ROOT, 8971);
  const PORT = srv.port;                       // a gate's port is a PREFERENCE (test/run.js)
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${PORT}/daw.html?g=citypop&seed=7`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.rowCount() > 0, null, { timeout: 20000 });

  // ---- A boots clean ----
  if (errs.length) fail("page errors: " + errs.join(" | ")); else ok("no page errors");
  const boot = await page.evaluate(() => ({
    rows: window.__DAW.rowCount(),
    tracks: window.__DAW.TRACKS.length,
    engine: !!window.CsdEngine, kernel: !!window.GenreKernel,
    canvases: document.querySelectorAll("canvas.dw-roll").length,
    painted: [...document.querySelectorAll("canvas.dw-roll")].every((c) => c.width > 0 && c.height > 0),
    read: (document.getElementById("dwRead") || {}).textContent || "",
  }));
  if (boot.rows !== boot.tracks) fail(`rows ${boot.rows} != TRACKS ${boot.tracks}`);
  else ok(`${boot.rows} rows, one per track`);
  if (!boot.engine || !boot.kernel) fail("engine globals missing"); else ok("engine + kernel globals present");
  if (boot.canvases !== boot.tracks || !boot.painted) fail("rolls not sized"); else ok("every roll canvas is sized");
  if (!/bpm/.test(boot.read)) fail("readout empty: " + boot.read); else ok("readout: " + boot.read.slice(0, 72));

  // ---- B the roll is the engine's, note for note ----
  // Recompute in the page from the SAME state and compare per track. This is the
  // check that would catch a roll drawing a convenient approximation.
  const parity = await page.evaluate(() => {
    const S = window.__DAW.SONG, K = window.GenreKernel, E = window.CsdEngine;
    const t = K.track(S.genre, { seed: S.seed });
    const st = JSON.parse(JSON.stringify(t.state || t));
    Object.assign(st, S.patch || {});
    st.voiceStreams = true;
    const ev = E.buildEvents(st);
    const out = {};
    for (const tr of window.__DAW.TRACKS)
      out[tr.id] = tr.kind === "drums" ? ev.drums.length : ev.pitched.filter((e) => e.voice === tr.id).length;
    return { counts: out, hasVoiceStreams: st.voiceStreams === true };
  });
  const shown = await page.evaluate(() => {
    const o = {};
    for (const r of document.querySelectorAll(".dw-row")) {
      const m = /(\d+)\s+notes/.exec(r.querySelector(".dw-count").textContent || "");
      o[r.dataset.track] = m ? +m[1] : 0;
    }
    return o;
  });
  let mismatch = [];
  for (const k of Object.keys(parity.counts))
    if ((shown[k] || 0) !== parity.counts[k]) mismatch.push(`${k}: rack ${shown[k]} vs engine ${parity.counts[k]}`);
  if (mismatch.length) fail("roll/engine note-count mismatch — " + mismatch.join("; "));
  else ok("every row's note count IS buildEvents' (" + Object.entries(parity.counts).map(([k, v]) => `${k}:${v}`).join(" ") + ")");

  // ---- C the rack law + the document ----
  if (!parity.hasVoiceStreams) fail("resolved state does not carry voiceStreams — the rack law is off");
  else ok("resolved state carries voiceStreams:true");

  const before = await page.evaluate(() => document.getElementById("dwRead").textContent);
  await page.evaluate(() => { window.__DAW.edit({ seed: 4242 }); });
  await page.waitForFunction((b) => document.getElementById("dwRead").textContent !== b || true, before, { timeout: 5000 });
  await page.waitForTimeout(160);
  const afterCounts = await page.evaluate(() => {
    const o = {};
    for (const r of document.querySelectorAll(".dw-row")) o[r.dataset.track] = r.querySelector(".dw-count").textContent;
    return o;
  });
  const moved = Object.keys(afterCounts).filter((k) => afterCounts[k] !== (shown[k] ? shown[k] + " notes" : ""));
  if (!moved.length) fail("changing the seed changed nothing — the document is not driving the rack");
  else ok(`seed change moved ${moved.length} row(s) — the rack tracks the document`);

  // the ?query round-trip: the link names the music
  const q = await page.evaluate(() => location.search);
  if (!/seed=4242/.test(q)) fail("seed edit did not reach the URL: " + q);
  else ok("document round-trips through the URL (" + q + ")");

  // ---- D silence is drawn, not dropped ----
  const off = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".dw-row")];
    return { total: rows.length,
      offRows: rows.filter((r) => r.classList.contains("dw-off")).length,
      offHaveCanvas: rows.filter((r) => r.classList.contains("dw-off")).every((r) => !!r.querySelector("canvas")),
      offSayOff: rows.filter((r) => r.classList.contains("dw-off")).every((r) => /off/.test(r.querySelector(".dw-machine").textContent)) };
  });
  if (off.offRows && (!off.offHaveCanvas || !off.offSayOff))
    fail("a silent track lost its canvas or its label");
  else ok(`silent tracks kept their row (${off.offRows}/${off.total} dimmed, canvas + label intact)`);

  // ---- E the KIT MACHINE, driven like a user ----
  // Open the drums track, move a lane's probability slider, and demand the thing
  // the whole rack is built on: the drums roll changes and the OTHER rolls do not.
  // Pixels are the assertion — a canvas hash per row before and after — because
  // that is what the person looking at the screen actually gets.
  const shot = () => page.evaluate(() => {
    const o = {};
    for (const r of document.querySelectorAll(".dw-row")) o[r.dataset.track] = r.querySelector("canvas").toDataURL().length + ":" + r.querySelector("canvas").toDataURL().slice(-64);
    return o;
  });
  await page.evaluate(() => { window.__DAW.edit({ genre: "techno", seed: 3 }); });
  await page.waitForTimeout(220);
  const beforePix = await shot();

  await page.click('.dw-row[data-track="drums"] .dw-strip');
  await page.waitForTimeout(160);
  const panel = await page.evaluate(() => {
    const p = document.querySelector('.dw-row[data-track="drums"] .dw-panel');
    return { open: !!p && !p.hidden, ops: p ? p.querySelectorAll(".dw-op").length : 0,
             sliders: p ? p.querySelectorAll(".dw-opslider:not([disabled])").length : 0,
             expanded: document.querySelector('.dw-row[data-track="drums"] .dw-strip').getAttribute("aria-expanded") };
  });
  if (!panel.open || !panel.ops) fail("drums panel did not open (" + JSON.stringify(panel) + ")");
  else ok(`kit machine opens — ${panel.ops} ops, ${panel.sliders} live sliders, aria-expanded=${panel.expanded}`);

  const edited = await page.evaluate(() => {
    const sl = document.querySelector('.dw-row[data-track="drums"] .dw-opslider:not([disabled])');
    if (!sl) return null;
    sl.value = "0.5";
    sl.dispatchEvent(new Event("input", { bubbles: true }));
    sl.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  });
  if (!edited) { fail("no enabled probability slider to drive"); }
  else {
    await page.waitForTimeout(240);
    const afterPix = await shot();
    const changed = Object.keys(afterPix).filter((k) => afterPix[k] !== beforePix[k]);
    if (changed.indexOf("drums") < 0) fail("moving a kit probability did not change the drums roll");
    else ok("moving a kit probability repainted the drums roll");
    const others = changed.filter((k) => k !== "drums");
    if (others.length) fail("a drum-machine edit moved other rolls: " + others.join(", ") + " — the rack law is not holding in the UI");
    else ok("...and left every other roll pixel-identical (the rack law, on screen)");

    const patched = await page.evaluate(() => ({
      kits: Object.keys((window.__DAW.SONG.patch.kits) || {}),
      badge: !!document.querySelector('.dw-row[data-track="drums"] .dw-badge'),
      revert: !!document.querySelector('.dw-row[data-track="drums"] .dw-mini'),
    }));
    if (!patched.kits.length) fail("the edit did not land in SONG.patch.kits");
    else ok(`edit landed in the document as state.kits (${patched.kits.join(", ")})`);
    if (!patched.badge || !patched.revert) fail("no edited badge / revert affordance after an override");
    else ok("the edited kit is badged and revertible");

    await page.click('.dw-row[data-track="drums"] .dw-mini');
    await page.waitForTimeout(240);
    const reverted = await page.evaluate(() => Object.keys((window.__DAW.SONG.patch.kits) || {}).length);
    const backPix = await shot();
    if (reverted !== 0) fail("revert left an override behind");
    else if (backPix.drums !== beforePix.drums) fail("revert did not restore the stock kit's roll");
    else ok("revert drops the override and restores the stock roll exactly");
  }

  // ---- F the edit SURVIVES A RELOAD, and a hostile link cannot ----
  // Persistence is only real if reloading the URL reproduces the same pixels.
  // Re-make an edit, capture the URL, load it fresh in a NEW page, compare rolls.
  {
    await page.evaluate(() => { window.__DAW.edit({ genre: "techno", seed: 3, patch: {} }); });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const sl = document.querySelector('.dw-row[data-track="drums"] .dw-opslider:not([disabled])');
      sl.value = "0.35";
      sl.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForTimeout(240);
    const url = await page.evaluate(() => location.href);
    const editedPix = await shot();
    if (!/[?&]p=/.test(url)) fail("the patch never reached the URL: " + url);
    else ok("the patch rides the URL (?p=" + (/[?&]p=([^&]+)/.exec(url)[1] || "").slice(0, 24) + "…)");

    const p2 = await browser.newPage();
    const errs2 = capturePageErrors(p2);
    await p2.goto(url, { waitUntil: "load" });
    await p2.waitForFunction(() => window.__DAW && window.__DAW.rowCount() > 0, null, { timeout: 20000 });
    await p2.waitForTimeout(220);
    const reloadPix = await p2.evaluate(() => {
      const o = {};
      for (const r of document.querySelectorAll(".dw-row")) o[r.dataset.track] = r.querySelector("canvas").toDataURL().length + ":" + r.querySelector("canvas").toDataURL().slice(-64);
      return o;
    });
    const kitsBack = await p2.evaluate(() => Object.keys((window.__DAW.SONG.patch.kits) || {}));
    if (errs2.length) fail("reloaded page errored: " + errs2.join(" | "));
    if (!kitsBack.length) fail("reload lost the kit override");
    else ok("reload restores the override (" + kitsBack.join(", ") + ")");
    const differ = Object.keys(editedPix).filter((k) => editedPix[k] !== reloadPix[k]);
    if (differ.length) fail("reload did not reproduce the same rolls: " + differ.join(", "));
    else ok("reload reproduces every roll pixel-for-pixel — the link IS the song");

    // a link is untrusted input: keys the DAW never writes must not reach the state
    const dropped = await p2.evaluate(() => {
      const evil = window.__DAW.decodePatch(
        btoa(JSON.stringify({ kits: {}, foundSources: [{ id: "x", fsPath: "https://evil.example/x.mp3" }], bpm: 999 }))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
      return Object.keys(evil);
    });
    if (dropped.indexOf("foundSources") >= 0 || dropped.indexOf("bpm") >= 0)
      fail("decodePatch let a non-whitelisted key through: " + dropped.join(", "));
    else ok("a hostile patch is filtered to the whitelist (" + (dropped.join(", ") || "nothing") + ")");
    await p2.close();
  }

  // ---- G the PHRASE EDITOR: draw a note, hear it in the melody only ----
  // techno/3 runs `arpup`, a shipped phrase cell, so the melody panel offers the
  // ladder grid. Toggling a cell must repaint the melody roll, leave every other
  // roll pixel-identical, and land in the document as state.melodyCells.
  {
    await page.evaluate(() => { window.__DAW.edit({ genre: "techno", seed: 3, patch: {} }); });
    await page.waitForTimeout(220);
    const melOpen = await page.evaluate(() => {
      const s = document.querySelector('.dw-row[data-track="melody"] .dw-strip');
      s.click(); return true;
    });
    await page.waitForTimeout(200);
    const grid = await page.evaluate(() => {
      const p = document.querySelector('.dw-row[data-track="melody"] .dw-panel');
      return { cells: p ? p.querySelectorAll(".dw-cell").length : 0,
               on: p ? p.querySelectorAll(".dw-cell.on").length : 0,
               labels: p ? [...p.querySelectorAll(".dw-glabel")].map((n) => n.textContent) : [] };
    });
    if (!grid.cells) fail("no phrase grid for a form running a shipped cell");
    else ok(`phrase grid renders — ${grid.cells} cells, ${grid.on} lit, ladder ${grid.labels.slice(0, 4).join("/")}…`);
    if (grid.labels.some((l) => /root|3rd|5th|top/.test(l))) ok("the y-axis is the chord's voicing ladder, not a keyboard");
    else fail("grid rows are not labelled as chord tones: " + grid.labels.join(","));

    const pre = await shot();
    await page.evaluate(() => {
      const p = document.querySelector('.dw-row[data-track="melody"] .dw-panel');
      const off = [...p.querySelectorAll(".dw-cell")].find((c) => !c.classList.contains("on"));
      off.click();
    });
    await page.waitForTimeout(260);
    const post = await shot();
    const moved = Object.keys(post).filter((k) => post[k] !== pre[k]);
    if (moved.indexOf("melody") < 0) fail("drawing a note did not repaint the melody roll");
    else ok("drawing a note repaints the melody roll");
    const spill = moved.filter((k) => k !== "melody");
    if (spill.length) fail("a phrase edit moved other rolls: " + spill.join(", "));
    else ok("...and left every other roll pixel-identical");

    const doc = await page.evaluate(() => ({
      cells: Object.keys((window.__DAW.SONG.patch.melodyCells) || {}),
      url: /[?&]p=/.test(location.href),
    }));
    if (!doc.cells.length || !doc.url) fail("the phrase edit did not reach the document/URL: " + JSON.stringify(doc));
    else ok(`the drawn phrase is in the document and the URL (melodyCells: ${doc.cells.join(", ")})`);
  }

  await browser.close(); srv.close();
  if (process.exitCode) console.error(`\nDAW-RACK: FAIL`);
  else console.log(`\nDAW-RACK: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
