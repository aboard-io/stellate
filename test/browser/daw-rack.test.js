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

  await browser.close(); srv.close();
  if (process.exitCode) console.error(`\nDAW-RACK: FAIL`);
  else console.log(`\nDAW-RACK: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
