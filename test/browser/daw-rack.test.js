#!/usr/bin/env node
// test/browser/daw-rack.test.js — THE DECK: one strip per layer, what it plays on
// top and the knobs that make it underneath.
//
//   A boots clean        one strip per layer, every lane canvas sized, the kernel
//                        carrying its tempo + structure tracts
//   B the roll is the ENGINE's — each voice strip's note count equals
//                        buildEvents' for that voice, recomputed independently
//   C cause next to effect — turning a spoke repaints THAT strip's roll and
//                        leaves every other strip pixel-identical (the rack law,
//                        which is the whole reason the knobs sit under the roll)
//   D silence is drawn   a track the form never turns on keeps its strip
//   E the refiners       phrase grid, kit periods, bass cells — the things a
//                        radius cannot say — live under their own radar
//   F it SURVIVES A RELOAD and a hostile link cannot smuggle a resource key
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const VOICES = ["melody", "bass", "pad", "drums"];

async function main() {
  const srv = await serve(ROOT, 8971);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=citypop&seed=7`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll(".dw-strip2").length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(450);

  // ---- A boots clean ----
  if (errs.length) fail("page errors: " + errs.join(" | ")); else ok("no page errors");
  const boot = await page.evaluate(() => ({
    strips: [...document.querySelectorAll(".dw-strip2")].map((s) => s.dataset.layer),
    lanes: document.querySelectorAll(".dw-strip2 canvas.dw-roll").length,
    sized: [...document.querySelectorAll(".dw-strip2 canvas")].every((c) => c.width > 0),
    tracts: document.querySelectorAll('.dw-strip2[data-layer="genre"] .dw-tcanvas').length,
    radars: document.querySelectorAll(".dw-strip2 .dw-vec").length,
    head: (document.getElementById("dwHead") || {}).textContent || "",
  }));
  if (boot.strips.length < 8) fail("strips: " + boot.strips.join(","));
  else ok(`the deck reads top to bottom: ${boot.strips.join(" → ")}`);
  if (boot.tracts !== 2) fail(`the kernel needs its tempo + structure tracts, found ${boot.tracts}`);
  else ok("tempo and structure ride atop the kernel");
  if (!boot.lanes || !boot.sized) fail("lane canvases not sized");
  else ok(`${boot.lanes} lanes drawn, ${boot.radars} radars under them`);
  if (!/bpm/.test(boot.head)) fail("the bottom-right playhead is empty: " + boot.head);
  else ok("the playhead sits bottom-right: " + boot.head.replace(/\s+/g, " ").trim().slice(0, 40));

  // ---- B the roll is the engine's ----
  const parity = await page.evaluate((voices) => {
    const E = window.CsdEngine, st = window.__DAWSTATE(), ev = E.buildEvents(st);
    const out = {};
    for (const v of voices) out[v] = v === "drums" ? ev.drums.length : ev.pitched.filter((e) => e.voice === v).length;
    return { counts: out, hasVoiceStreams: st.voiceStreams === true };
  }, VOICES);
  const shown = await page.evaluate((voices) => {
    const o = {};
    for (const v of voices) {
      const s = document.querySelector(`.dw-strip2[data-layer="${v}"] .dw-s2count`);
      const m = /(\d+)\s+notes/.exec((s && s.textContent) || "");
      o[v] = m ? +m[1] : 0;
    }
    return o;
  }, VOICES);
  const bad = VOICES.filter((v) => shown[v] !== parity.counts[v]);
  if (bad.length) fail("roll/engine mismatch: " + bad.map((v) => `${v} ${shown[v]}!=${parity.counts[v]}`).join("; "));
  else ok("every strip's count IS buildEvents' (" + VOICES.map((v) => `${v}:${parity.counts[v]}`).join(" ") + ")");
  if (!parity.hasVoiceStreams) fail("the resolved state lost voiceStreams — the rack law is off");
  else ok("the resolved state carries voiceStreams:true");

  // ---- C cause next to effect ----
  const shot = () => page.evaluate(() => {
    const o = {};
    for (const s of document.querySelectorAll(".dw-strip2")) {
      const c = s.querySelector("canvas.dw-roll");
      o[s.dataset.layer] = c ? c.toDataURL().slice(-64) : "";
    }
    return o;
  });
  await page.evaluate(() => window.__DAW.edit({ genre: "techno", seed: 3, patch: {}, weights: null }));
  await page.waitForTimeout(360);
  const pre = await shot();
  const drove = await page.evaluate(() => {
    // drive an OP PROBABILITY, not a mix level: level changes what you hear, the
    // probability changes what is PLAYED, and the roll draws events
    const d = [...document.querySelectorAll('.dw-strip2[data-layer="drums"] .dw-vdot[role="slider"]')]
      .find((x) => /\?$/.test(x.getAttribute("aria-label") || ""));
    if (!d) return false;
    d.focus();
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    return true;
  });
  if (!drove) fail("no handle on the drums strip's radar");
  await page.waitForTimeout(380);
  const post = await shot();
  const moved = Object.keys(post).filter((k) => post[k] && post[k] !== pre[k]);
  if (moved.indexOf("drums") < 0) fail("turning the drums radar did not repaint the drums roll");
  else ok("a spoke repaints the roll directly above it");
  const spill = moved.filter((k) => k !== "drums");
  if (spill.length) fail("it also moved: " + spill.join(", ") + " — the rack law is not holding");
  else ok("...and every other strip stayed pixel-identical");

  // ---- D silence is drawn ----
  const off = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".dw-strip2.dw-off")];
    return { n: rows.length, keptCanvas: rows.every((r) => !!r.querySelector("canvas")) };
  });
  if (off.n && !off.keptCanvas) fail("a silent strip lost its lane");
  else ok(`silent strips keep their lane (${off.n} dimmed)`);

  // ---- E the refiners ----
  const refine = await page.evaluate(() => ({
    drums: document.querySelectorAll('.dw-strip2[data-layer="drums"] .dw-s2refine .dw-op').length,
    melodyCells: document.querySelectorAll('.dw-strip2[data-layer="melody"] .dw-s2refine .dw-cell').length,
    bassCells: document.querySelectorAll('.dw-strip2[data-layer="bass"] .dw-s2refine .dw-cell').length,
  }));
  if (!refine.drums) fail("the drums refiner lost its op list (period is a choice, not a radius)");
  else ok(`refiners carry what a radius cannot: ${refine.drums} kit ops, ${refine.melodyCells} phrase cells, ${refine.bassCells} bass cells`);

  // ---- F reload + the hostile link ----
  const url = await page.evaluate(() => location.href);
  if (!/[?&]p=/.test(url)) fail("the edit never reached the URL: " + url);
  else ok("the edit rides the URL");
  const p2 = await browser.newPage();
  const errs2 = capturePageErrors(p2);
  await p2.goto(url, { waitUntil: "load" });
  await p2.waitForFunction(() => document.querySelectorAll(".dw-strip2").length > 0, null, { timeout: 20000 });
  await p2.waitForTimeout(500);
  const back = await p2.evaluate(() => {
    const o = {};
    for (const s of document.querySelectorAll(".dw-strip2")) {
      const c = s.querySelector("canvas.dw-roll");
      o[s.dataset.layer] = c ? c.toDataURL().slice(-64) : "";
    }
    return { pix: o, layers: Object.keys((window.__DAW.SONG.patch.layers) || {}) };
  });
  if (errs2.length) fail("reloaded page errored: " + errs2.join(" | "));
  if (!back.layers.length) fail("reload lost the layer edit");
  else ok(`reload restores the edit (patch.layers: ${back.layers.join(", ")})`);
  const differ = Object.keys(post).filter((k) => post[k] && post[k] !== back.pix[k]);
  if (differ.length) fail("reload did not reproduce the same rolls: " + differ.join(", "));
  else ok("reload reproduces every strip pixel-for-pixel — the link IS the song");

  const RESOURCE = ["foundSources", "samplerLib", "sampleEvents", "vocoderSourceId", "speech"];
  const leaked = await p2.evaluate((keys) => {
    const evil = { layers: {} };
    for (const k of keys) evil[k] = [{ id: "x", fsPath: "https://evil.example/x.mp3" }];
    const out = window.__DAW.decodePatch(
      btoa(JSON.stringify(evil)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    return keys.filter((k) => Object.keys(out).indexOf(k) >= 0);
  }, RESOURCE);
  if (leaked.length) fail("decodePatch let RESOURCE-POINTING key(s) through: " + leaked.join(", "));
  else ok("a hostile link cannot smuggle a resource key");
  await p2.close();

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-DECK: FAIL");
  else console.log(`\nDAW-DECK: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
