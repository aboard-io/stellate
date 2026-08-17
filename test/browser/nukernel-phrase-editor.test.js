#!/usr/bin/env node
// test/browser/nukernel-phrase-editor.test.js — THE PLAIN PHRASE EDITOR, ON
// THE BUILT PAGE (2026-08-17: "get rid of seed" [read as: get rid of the
// WORD], the tracker, the tray).
//
//   node test/browser/nukernel-phrase-editor.test.js
//
// Five things Paul asked for, each read off the rendered DOM/audio state
// rather than the source that was supposed to produce it:
//   (1) LENGTH   the two length keys double/halve a phrase 16..128, and the
//                phrase's own LAST row (not row 127, row `len`) is a real,
//                clickable cell — the off-by-one this pass was warned about.
//   (2) ORIENTATION  thumbPath (ui/editor.js, exported) draws time on x and
//                pitch bottom-to-top, at both a 16- and a 128-step length —
//                called directly, in-page, via a dynamic import, because the
//                claim is about the FUNCTION's geometry, not a screenshot.
//   (3) CLONE    the tray gains one pad, at the END, carrying the same
//                picture as the phrase it was cloned from.
//   (4) THE RED FLAG  deleting the one phrase a box's stack depends on sets
//                `sec.silent` on that SONG box — read back off the saved
//                document, the same round-trip a real reload takes.
//   (5) PLAYHEAD  while the open phrase is the one sounding, both the grid's
//                own bar (#stepgrid .phhead) and its tray thumbnail's bar
//                (.slot.live .phth) advance — sampled twice, a beat apart,
//                and required to have MOVED, not just existed.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8972;                 // a PREFERENCE — the harness walks past a busy port

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
  const errs = capturePageErrors(page);

  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html?nobounce`,
    { waitUntil: "networkidle" });
  // a FRESH default song — box 1's authority plays phrase 1 alone, which is
  // exactly the fixture (4) needs and the comment two lines up describes
  await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
  await page.reload({ waitUntil: "networkidle" });
  // #stepgrid exists (built once, every page alive underneath) but the
  // chassis paints it only once data-page="compose" — attached, not visible
  await page.waitForSelector("#stepgrid", { state: "attached" });
  await page.click('.pkey[data-page="compose"]');
  await page.waitForFunction(() =>
    document.getElementById("chassis").dataset.page === "compose", null, { timeout: 8000 });

  // sanity the fixture this gate depends on: box 1's ONLY phrase is slot 0.
  // If that ever changes, failing loudly here is better than a false pass
  // three checks later.
  {
    const raw = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("nukernel.song.v1") || "null"));
    const st = raw && raw.song && raw.song[0] && raw.song[0].stack;
    const only0 = !!st && st.length === 1 && st[0].slots.length === 1 && st[0].slots[0] === 0;
    if (!only0) fail("fixture assumption broke: box 1 no longer plays slot 0 alone — " +
      "update this gate's assumption before trusting check (4)");
    else ok("fixture: box 1's stack plays phrase 1 alone");
  }

  /* ---------- (1) LENGTH: grow to 128, the last row is real ---------- */
  for (let i = 0; i < 3; i++) { await page.click("#grow"); await page.waitForTimeout(60); }
  const rowCount = await page.$$eval('#stepgrid [role="row"]', els => els.length);
  // +1 for the header row
  if (rowCount !== 129) fail(`growing x3 (16->32->64->128) produced ${rowCount - 1} data rows, want 128`);
  else ok("three grows take a phrase from 16 to 128 steps");
  const lastGate = '#stepgrid .prow[data-step="128"] .cell[data-row="gate"]';
  const found = await page.$(lastGate);
  if (!found) fail("the phrase's row 128 is not in the DOM at all — the fencepost bit");
  else {
    const before = await page.$eval(lastGate, b => b.classList.contains("on"));
    await page.click(lastGate);
    const after = await page.$eval(lastGate, b => b.classList.contains("on"));
    if (before === after) fail("clicking the phrase's own last row (128) did not toggle it");
    else ok("the phrase's last row is a real, clickable cell (the off-by-one this pass " +
             "was warned about is `i < len`, not `i < len - 1`, in both buildBody and " +
             "patchGrid — verified by construction: row 128 exists and answers a click)");
  }
  if (errs.length) fail("page errors after growing the phrase: " + errs.slice(0, 3).join(" | "));

  /* ---------- (2) ORIENTATION: thumbPath, called directly ---------- */
  const geom = await page.evaluate(async () => {
    const { thumbPath } = await import("/nukernel/ui/editor.js");
    const z = n => new Array(n).fill(0);
    const probe = n => {
      const p = { deg: z(n), oct: z(n), vel: z(n), inc: z(n), stk: z(n),
                  gate: z(n), acc: z(n), sld: z(n) };
      p.gate[0] = 1; p.deg[0] = 7;              // step 0: gated, HIGHEST pitch
      p.gate[n - 1] = 1; p.deg[n - 1] = -7;      // last step: gated, LOWEST pitch
      const d = thumbPath(p);
      // pull every "M x y" pair out of the path — box() always starts a
      // segment with a move, so these are the drawn rectangles' origins
      const pts = [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)]
        .map(m => ({ x: +m[1], y: +m[2] }));
      return pts;
    };
    return { p16: probe(16), p128: probe(128) };
  });
  for (const [label, pts] of [["16-step", geom.p16], ["128-step", geom.p128]]) {
    if (pts.length < 4) { fail(`${label} thumbPath drew too few segments to read (${pts.length})`); continue; }
    // two boxes per gated step (the gate tooth + the pitch mark): the first
    // pair belongs to step 0, the last pair to the final step
    const early = pts.slice(0, 2), late = pts.slice(-2);
    const earlyX = Math.min(...early.map(p => p.x)), lateX = Math.max(...late.map(p => p.x));
    if (!(earlyX < lateX)) fail(`${label}: step 0 did not draw LEFT of the last step (x ${earlyX} vs ${lateX}) — time is not left-to-right`);
    else ok(`${label}: time runs left-to-right (step 0 at x=${earlyX.toFixed(1)}, last step at x=${lateX.toFixed(1)})`);
    // the pitch mark is the SECOND box of each pair (gate tooth, then note)
    const earlyY = early[1].y, lateY = late[1].y;
    if (!(earlyY < lateY)) fail(`${label}: the HIGH note (step 0) did not draw above the LOW note (last step) (y ${earlyY} vs ${lateY}) — pitch is not bottom-to-top`);
    else ok(`${label}: pitch runs bottom-to-top (the high note sits at a smaller y, ${earlyY.toFixed(1)} < ${lateY.toFixed(1)})`);
  }

  /* ---------- (5) PLAYHEAD: while phrase 1 is still box 1's own ---------- */
  // phrase 1 is both OPEN (nothing has called setSlot since page load — the
  // grow/toggle/orientation steps above never touch which slot is open) and
  // box 1's only phrase (the fixture checked at the top), so this runs
  // BEFORE clone/delete below, both of which move the open slot or the
  // song's own shape.
  await page.click("#play");
  await page.waitForFunction(() => document.querySelector("#stepgrid.live"), null, { timeout: 8000 })
    .catch(() => fail("the grid never went .live — either playback did not start or the " +
                       "playhead never saw phrase 1 as sounding"));
  const sample = () => page.evaluate(() => {
    const g = document.querySelector("#stepgrid .phhead"), p = document.querySelector(".slot.live .phth");
    return { gridTop: g && g.style.top, padLeft: p && p.style.left };
  });
  const s1 = await sample();
  await page.waitForTimeout(500);
  const s2 = await sample();
  await page.click("#play");                    // stop, before the next section touches the song
  if (!s1.gridTop || !s2.gridTop) fail("the grid's playhead (.phhead) never positioned itself");
  else if (s1.gridTop === s2.gridTop) fail(`the grid's playhead did not move (${s1.gridTop} both samples)`);
  else ok(`the grid's playhead advances while phrase 1 sounds (${s1.gridTop} -> ${s2.gridTop})`);
  if (!s1.padLeft || !s2.padLeft) fail("the tray thumbnail's playhead (.phth) never positioned itself");
  else if (s1.padLeft === s2.padLeft) fail(`the tray thumbnail's playhead did not move (${s1.padLeft} both samples)`);
  else ok(`the tray thumbnail's playhead advances with the grid (${s1.padLeft} -> ${s2.padLeft})`);

  /* ---------- (3) CLONE: lands at the end, same picture ---------- */
  const before3 = await page.$$eval(".slots .slot", els => els.length);
  const srcD = await page.$eval(".slot:first-child .mini path", p => p.getAttribute("d"));
  await page.click(".slot:first-child .ico-copy");
  await page.waitForTimeout(150);
  const after3 = await page.$$eval(".slots .slot", els => els.length);
  if (after3 !== before3 + 1) fail(`clone changed the tray by ${after3 - before3} pads, want +1`);
  else ok("clone adds exactly one pad to the tray");
  // :last-of-type, not :last-child — .slots' actual last CHILD is the [+]
  // key (a <button>, a different tag from .slot's <div>), so the last DIV
  // sibling is the tray's last phrase pad
  const lastD = await page.$eval(".slots .slot:last-of-type .mini path", p => p.getAttribute("d"));
  if (lastD !== srcD) fail("the clone did not land at the END of the tray carrying the source's picture");
  else ok("the clone lands at the end of the tray, carrying the source phrase's own picture");

  /* ---------- (4) THE RED FLAG: delete phrase 1, box 1 goes silent ------ */
  await page.click(".slots .slot:first-child .ico-x");
  await page.waitForTimeout(500);                // the debounced save (250ms) plus slack
  const raw2 = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nukernel.song.v1") || "null"));
  if (!raw2 || !raw2.song || !raw2.song[0]) fail("no song read back after deleting phrase 1");
  else if (raw2.song[0].silent !== true)
    fail("deleting box 1's only phrase did not set sec.silent on it");
  else ok("deleting a box's only phrase flags that section silent (sec.silent, for the " +
           "arrange row's own renderer to paint red)");

  if (errs.length) fail("page errors: " + errs.slice(0, 5).join(" | "));

  await browser.close();
  srv.close();
  console.log(process.exitCode ? "nukernel-phrase-editor: FAIL" :
    `nukernel-phrase-editor: PASS (${checks} checks)`);
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
