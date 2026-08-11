#!/usr/bin/env node
// test/browser/daw-rack.test.js — THE RACK LAW on THE GRID.
//
// The deck's strips are gone; the grid (tracks × sections) is the screen now,
// and the rack law is its demo: editing one track's generator repaints that ROW
// only — every other row stays pixel-identical (state.voiceStreams). Rows are
// hashed through the gate hook __DAW.grid.rowHash (per-cell canvases, DAW-GRID
// spec "Probe hooks").
//
//   A boots clean     6 rows × the resolved section count, every cell canvas
//                     sized, voiceStreams:true on the resolved state
//   B cause → effect  dragging a drum op PAD (a real pointer drag on the sheet)
//                     repaints the drums row; melody/bass/pad/chords/samples
//                     rows hash identical
//   C silence drawn   a voice the form keeps off stays a dimmed ∅ cell — the
//                     row never loses its cell
//   D it survives     the edit rides ?p; reload reproduces every row hash
//   E hostile links   decodePatch drops resource-pointing keys, fake secover
//                     section ids, and non-SAMPLERS instruments
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
  const srv = await serve(ROOT, 8971);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=techno&seed=3`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await page.waitForTimeout(400);

  // ---- A boots clean ----
  if (errs.length) fail("page errors: " + errs.join(" | ")); else ok("no page errors");
  const boot = await page.evaluate(() => ({
    rows: window.__DAW.grid.rows(),
    cols: window.__DAW.grid.cols(),
    cells: window.__DAW.grid.cellCount(),
    secs: window.__DAWSTATE().sections.length,
    sized: [...document.querySelectorAll(".dw-cellcv")].every((c) => c.width > 0),
    streams: window.__DAWSTATE().voiceStreams === true,
    head: (document.getElementById("dwCtl") || {}).textContent || "",
  }));
  if (boot.rows.length !== 6 || boot.cols !== boot.secs || boot.cells !== 6 * boot.cols)
    fail(`grid shape: ${boot.rows.length} rows × ${boot.cols} cols (${boot.secs} sections), ${boot.cells} cells`);
  else ok(`the grid is ${boot.rows.length} tracks × ${boot.cols} sections (${boot.cells} cells)`);
  if (!boot.sized) fail("cell canvases not sized"); else ok("every cell canvas is sized");
  if (!boot.streams) fail("resolved state lost voiceStreams — the rack law is off");
  else ok("the resolved state carries voiceStreams:true");
  if (!/bpm/.test(boot.head)) fail("the transport controller is empty");
  else ok("the unified controller carries the readout");

  // ---- B cause → effect: a real pointer drag on a drum op pad ----
  const pre = await allHashes(page);
  const preFurn = await page.evaluate(() => ({
    kernel: (document.querySelector(".dw-kernelcell") || {}).textContent || "",
    master: (document.querySelector(".dw-mastercell") || {}).textContent || "",
  }));
  await page.evaluate(() => window.__DAW.sheet.open("drums"));
  await page.waitForTimeout(300);
  const pad = await page.$(".dw-sheetbody .dw-pad");
  if (!pad) fail("no op pad in the drums sheet");
  else {
    // the pad now lives in the RAIL, which is subscribed to the document: hold
    // on to the node so the drag can prove the edit does not tear the control
    // out from under the finger mid-gesture (sheet.js refreshes controls, it
    // does not re-render the body — that is the whole reason it may).
    await page.evaluate(() => { window.__gatePad = document.querySelector(".dw-sheetbody .dw-pad"); });
    const bb = await pad.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 + 16, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  const kits = await page.evaluate(() => Object.keys(window.__DAW.SONG.patch.kits || {}));
  if (!kits.length) fail("the pad drag wrote no kit edit");
  else ok(`the pad drag landed in patch.kits (${kits.join(",")})`);
  const post = await allHashes(page);
  if (post.drums === pre.drums) fail("the drums ROW did not repaint after a drum edit");
  else ok("the drums row repainted");
  const spill = TRACKS.filter((t) => t !== "drums" && post[t] !== pre[t]);
  if (spill.length) fail("the edit also repainted: " + spill.join(", ") + " — the rack law is not holding");
  else ok("every other row hashed pixel-identical (the rack law)");
  const survived = await page.evaluate(() => ({
    same: !!window.__gatePad && document.contains(window.__gatePad) &&
          window.__gatePad === document.querySelector(".dw-sheetbody .dw-pad"),
    view: window.__DAW.sheet.view(), depth: window.__DAW.sheet.depth(),
  }));
  if (!survived.same || survived.depth !== 1 || (survived.view || {}).target !== "drums")
    fail("the edit tore the flyout down under the gesture: " + JSON.stringify(survived));
  else ok("the flyout stays put across the edit — the very pad you dragged is still the pad");
  // the kernel and master rows are FURNITURE: a kit edit is not news to either,
  // so an edit that rewrites them is an edit that rewrote the whole screen.
  const postFurn = await page.evaluate(() => ({
    kernel: (document.querySelector(".dw-kernelcell") || {}).textContent || "",
    master: (document.querySelector(".dw-mastercell") || {}).textContent || "",
  }));
  if (postFurn.kernel !== preFurn.kernel || postFurn.master !== preFurn.master)
    fail(`a kit edit rewrote the furniture rows: kernel "${preFurn.kernel}"→"${postFurn.kernel}", ` +
         `master "${preFurn.master}"→"${postFurn.master}"`);
  else ok("the kernel and master rows read the same after a kit edit");
  await page.evaluate(() => window.__DAW.sheet.close());

  // ---- C silence is drawn ----
  const off = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".dw-cellbtn.off")];
    return { n: cells.length, kept: cells.every((c) => !!c.querySelector("canvas")) };
  });
  if (off.n && !off.kept) fail("a silent cell lost its canvas");
  else ok(`silence is drawn (${off.n} dimmed ∅ cells keep their canvas)`);

  // ---- D it survives a reload ----
  const url = await page.evaluate(() => location.href);
  if (!/[?&]p=/.test(url)) fail("the edit never reached the URL");
  else ok("the edit rides the URL");
  const p2 = await browser.newPage();
  const errs2 = capturePageErrors(p2);
  await p2.goto(url, { waitUntil: "load" });
  await p2.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await p2.waitForTimeout(400);
  const back = await p2.evaluate((tracks) => {
    const o = { hashes: {}, kits: Object.keys(window.__DAW.SONG.patch.kits || {}) };
    for (const t of tracks) o.hashes[t] = window.__DAW.grid.rowHash(t);
    return o;
  }, TRACKS);
  if (errs2.length) fail("reloaded page errored: " + errs2.join(" | "));
  if (!back.kits.length) fail("reload lost the kit edit");
  else ok("reload restores the edit (patch.kits: " + back.kits.join(",") + ")");
  const differ = TRACKS.filter((t) => post[t] !== back.hashes[t]);
  if (differ.length) fail("reload did not reproduce the rows: " + differ.join(", "));
  else ok("reload reproduces every row hash — the link IS the song");

  // ---- E hostile links ----
  const RESOURCE = ["foundSources", "samplerLib", "sampleEvents", "vocoderSourceId", "speech"];
  const hostile = await p2.evaluate((keys) => {
    const enc = (o) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const evil = { layers: {} };
    for (const k of keys) evil[k] = [{ id: "x", fsPath: "https://evil.example/x.mp3" }];
    const out1 = window.__DAW.decodePatch(enc(evil));
    const out2 = window.__DAW.decodePatch(enc({
      secover: { "notasection": { drums: "house" }, "__proto__": { cycles: 4 },
                 "0:warm": { drums: "not_a_kit", melody: "not_a_pattern", cycles: 99 } },
      sound: { melody: { instrument: "not_in_samplers" }, bass: 7,
               drums: { instrument: "epiano" } },
    }));
    return {
      leaked: keys.filter((k) => Object.keys(out1).indexOf(k) >= 0),
      secover: out2.secover || null, sound: out2.sound || null,
    };
  }, RESOURCE);
  if (hostile.leaked.length) fail("decodePatch let resource key(s) through: " + hostile.leaked.join(", "));
  else ok("a hostile link cannot smuggle a resource key");
  if (hostile.secover) fail("hostile secover survived: " + JSON.stringify(hostile.secover));
  else ok("fake section ids / non-vocabulary names / out-of-range cycles all drop");
  if (hostile.sound) fail("hostile sound survived: " + JSON.stringify(hostile.sound));
  else ok("a non-SAMPLERS instrument (and a drums sound override) cannot enter");
  await p2.close();

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-RACK: FAIL");
  else console.log(`\nDAW-RACK: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
