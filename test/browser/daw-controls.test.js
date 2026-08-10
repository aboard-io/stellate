#!/usr/bin/env node
// test/browser/daw-controls.test.js — THE CONTROL VOCABULARY at 390×844 touch.
//
// Pads, tiles and chips are the whole answer to "not radar, not sliders" — so
// this gate drives them the way a thumb does and holds their contracts:
//
//   A pad drag       a real touch drag on a drum-op PAD: the fill follows the
//                    finger MID-GESTURE, the release commits to patch.kits,
//                    and the landed value is the drag's geometry (Δy / height)
//   B tile drag      RELATIVE drag — starting at the tile's edge does NOT jump
//                    the value there; Δy/240 lands on top of where it was —
//                    committed to patch.layers with the "yours" dot
//   C double-tap     two quick taps on the tile revert to stock: the patch
//                    entry drops, the dot clears, the value returns
//   D no sliders     zero input[type=range] on the whole page, sheet open
//   E thumb floor    every ENABLED pad/tile/chip/tab in an open sheet ≥44px
//                    (ladder/matrix cells are row-height targets by law —
//                    columns stay fractional and are not measured here)
//   F keyboard       pads and tiles are role=slider for real: focus + arrow
//                    keys move the value AND commit through the same edit path
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

// a touch-type pointer sequence dispatched on the element — the controls.js
// listeners are pointer-events-only, so this is the real code path
const TOUCH_LIB = `
  window.__gateTouch = (el, pts) => {
    for (const [t, x, y] of pts)
      el.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: "touch",
        isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  };
`;

async function main() {
  const srv = await serve(ROOT, 8983);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=techno&seed=3`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.evaluate(TOUCH_LIB);

  // ---- A: a real touch drag on a drum-op pad ----
  await page.evaluate(() => window.__DAW.sheet.open("drums"));
  await page.waitForTimeout(300);
  const padDrag = await page.evaluate(() => {
    const pad = [...document.querySelectorAll(".dw-sheetbody .dw-pad")]
      .find((p) => +p.getAttribute("aria-valuenow") > 0.2);
    if (!pad) return { err: "no on-pad in the drums sheet" };
    pad.scrollIntoView({ block: "center" });
    const r = pad.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const v0 = +pad.getAttribute("aria-valuenow");
    const H = pad.clientHeight || 56;
    const fill = pad.querySelector(".dw-padfill");
    const f0 = fill.style.height;
    window.__gateTouch(pad, [["pointerdown", cx, cy],
      ["pointermove", cx, cy + 8], ["pointermove", cx, cy + 16],
      ["pointermove", cx, cy + 24], ["pointermove", cx, cy + 30]]);
    const mid = { fill: fill.style.height, now: +pad.getAttribute("aria-valuenow") };
    window.__gateTouch(pad, [["pointerup", cx, cy + 30]]);
    const v1 = +pad.getAttribute("aria-valuenow");
    const want = Math.max(0, Math.min(1, v0 - 30 / H));
    return { v0, v1, want, f0, mid, f1: fill.style.height,
      label: pad.getAttribute("aria-label") };
  });
  if (padDrag.err) fail(padDrag.err);
  else {
    if (padDrag.mid.fill === padDrag.f0 || Math.abs(padDrag.mid.now - padDrag.v0) < 0.01)
      fail(`the fill did not follow the finger mid-drag (${padDrag.f0} → ${padDrag.mid.fill})`);
    else ok(`the pad fill follows the finger mid-gesture (${padDrag.f0} → ${padDrag.mid.fill})`);
    if (Math.abs(padDrag.v1 - padDrag.want) > 0.1)
      fail(`pad landed at ${padDrag.v1}, drag geometry says ${padDrag.want.toFixed(2)}`);
    else ok(`the drag set the probability: "${padDrag.label}" ${padDrag.v0.toFixed(2)} → ${padDrag.v1.toFixed(2)}`);
    if (padDrag.f1 !== Math.round(padDrag.v1 * 100) + "%")
      fail(`fill ${padDrag.f1} disagrees with value ${padDrag.v1}`);
    else ok("the fill height IS the probability");
  }
  await page.waitForTimeout(400);
  const kits = await page.evaluate(() => Object.keys(window.__DAW.SONG.patch.kits || {}));
  if (!kits.length) fail("the pad release committed nothing to patch.kits");
  else ok(`release committed through the kit machine (patch.kits: ${kits.join(",")})`);

  // ---- B: tile RELATIVE drag (melody sound tab's level tile) ----
  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  const tileDrag = await page.evaluate(() => {
    const tile = [...document.querySelectorAll(".dw-sheetbody .dw-tile")]
      .find((t) => t.querySelector(".dw-tilelab").textContent === "level");
    if (!tile) return { err: "no level tile on the melody sound tab" };
    tile.scrollIntoView({ block: "center" });
    const r = tile.getBoundingClientRect();
    const v0 = +tile.getAttribute("aria-valuenow");
    // start at the EDGE the value is far from: if a start-point jump existed,
    // the value would leap there; relative means Δy/240 lands on top of v0
    const down = v0 >= 0.5;                     // drag down from the top edge
    const sx = r.left + r.width / 2;
    const sy = down ? r.top + 6 : r.bottom - 6;
    const dy = down ? 60 : -60;                 // 60px = 0.25 of range
    const pts = [["pointerdown", sx, sy]];
    for (let k = 1; k <= 4; k++) pts.push(["pointermove", sx, sy + (dy * k) / 4]);
    pts.push(["pointerup", sx, sy + dy]);
    window.__gateTouch(tile, pts);
    const want = Math.max(0, Math.min(1, v0 + (down ? -0.25 : 0.25)));
    return { v0, want, down, edgeV: down ? 1 - 6 / r.height : 6 / r.height };
  });
  if (tileDrag.err) fail(tileDrag.err);
  await page.waitForTimeout(400);
  const tileAfter = await page.evaluate(() => {
    const tile = [...document.querySelectorAll(".dw-sheetbody .dw-tile")]
      .find((t) => t.querySelector(".dw-tilelab").textContent === "level");
    return { v: +tile.getAttribute("aria-valuenow"), edited: tile.classList.contains("edited"),
      patch: ((window.__DAW.SONG.patch.layers || {}).melody || {}).level,
      txt: tile.querySelector(".dw-tileval").textContent };
  });
  if (!tileDrag.err) {
    if (Math.abs(tileAfter.v - tileDrag.want) > 0.06)
      fail(`tile landed at ${tileAfter.v} — relative drag says ${tileDrag.want.toFixed(2)} ` +
        `(a start-point jump would sit near ${tileDrag.edgeV.toFixed(2)})`);
    else ok(`RELATIVE drag: ${tileDrag.v0.toFixed(2)} ${tileDrag.down ? "−" : "+"}0.25 → ${tileAfter.v.toFixed(2)} (no jump to the touch point)`);
    if (tileAfter.patch == null) fail("the tile drag wrote nothing to patch.layers.melody.level");
    else ok(`committed to patch.layers (level: ${(+tileAfter.patch).toFixed(2)})`);
    if (!tileAfter.edited) fail("no \"yours\" dot after an edit");
    else ok("the edited dot marks yours (" + (tileAfter.txt || "…") + ")");
  }

  // ---- C: double-tap reverts to stock ----
  const v0Stock = await page.evaluate(async () => {
    const tile = [...document.querySelectorAll(".dw-sheetbody .dw-tile")]
      .find((t) => t.querySelector(".dw-tilelab").textContent === "level");
    const r = tile.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    window.__gateTouch(tile, [["pointerdown", x, y], ["pointerup", x, y]]);
    await new Promise((z) => setTimeout(z, 120));
    window.__gateTouch(tile, [["pointerdown", x, y], ["pointerup", x, y]]);
    await new Promise((z) => setTimeout(z, 250));
    return { v: +tile.getAttribute("aria-valuenow"), edited: tile.classList.contains("edited"),
      patch: ((window.__DAW.SONG.patch.layers || {}).melody || {}).level };
  });
  if (v0Stock.patch != null) fail("double-tap left the patch entry: " + v0Stock.patch);
  else ok("double-tap drops the patch entry — back to stock");
  if (v0Stock.edited) fail("the edited dot survived the revert");
  else ok("the dot clears on revert");
  if (!tileDrag.err && Math.abs(v0Stock.v - tileDrag.v0) > 0.02)
    fail(`revert did not restore the stock value: ${v0Stock.v} vs ${tileDrag.v0}`);
  else ok(`the value returns to stock (${v0Stock.v.toFixed(2)})`);

  // ---- D: no sliders, ever ----
  const nRange = await page.evaluate(() => document.querySelectorAll('input[type="range"]').length);
  if (nRange) fail(`${nRange} <input type=range> with the sound sheet open`);
  else ok("zero range inputs on the whole page (sheet open)");

  // ---- E: thumb floor across BOTH sheets we opened ----
  const floorOf = () => page.evaluate(() => {
    const small = [];
    for (const b of document.querySelectorAll(
      ".dw-sheetbody .dw-pad, .dw-sheetbody .dw-tile, .dw-sheetbody .dw-chip, #dwSheet .dw-sheettab, .dw-sheetbody .dw-mini")) {
      if (b.disabled) continue;
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width < 43.5 || r.height < 43.5)
        small.push(b.className.split(" ")[0] + "@" + Math.round(r.width) + "x" + Math.round(r.height));
    }
    return [...new Set(small)].slice(0, 6);
  });
  const smallSound = await floorOf();
  if (smallSound.length) fail("melody sound sheet controls under 44px: " + smallSound.join(", "));
  else ok("every enabled control on the sound sheet clears 44px");
  await page.evaluate(() => window.__DAW.sheet.open("drums"));
  await page.waitForTimeout(300);
  const smallDrums = await floorOf();
  if (smallDrums.length) fail("drums sheet controls under 44px: " + smallDrums.join(", "));
  else ok("every enabled control on the drums sheet clears 44px");

  // ---- F: keyboard — arrows on a pad, then on a tile ----
  const padKey0 = await page.evaluate(() => {
    const pad = [...document.querySelectorAll(".dw-sheetbody .dw-pad")]
      .find((p) => +p.getAttribute("aria-valuenow") > 0.2);
    if (!pad) return { err: "no on-pad to focus" };
    pad.focus();
    return { v: +pad.getAttribute("aria-valuenow"),
      kits: JSON.stringify(window.__DAW.SONG.patch.kits || {}),
      focused: document.activeElement === pad };
  });
  if (padKey0.err || !padKey0.focused) fail("pad not focusable: " + (padKey0.err || "focus lost"));
  else ok("a pad takes keyboard focus (role=slider)");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  const padKey1 = await page.evaluate(() => ({
    v: +document.activeElement.getAttribute("aria-valuenow"),
    kits: JSON.stringify(window.__DAW.SONG.patch.kits || {}) }));
  if (Math.abs(padKey1.v - (padKey0.v - 0.05)) > 0.01)
    fail(`ArrowDown moved the pad ${padKey0.v} → ${padKey1.v} (want −0.05)`);
  else ok(`ArrowDown nudges the pad: ${padKey0.v.toFixed(2)} → ${padKey1.v.toFixed(2)}`);
  if (padKey1.kits === padKey0.kits) fail("the keyboard step did not commit to patch.kits");
  else ok("each keyboard step commits through the kit machine");

  await page.evaluate(() => { window.__DAW.sheet.open("melody"); window.__DAW.sheet.tab("sound"); });
  await page.waitForTimeout(300);
  const tileKey0 = await page.evaluate(() => {
    const tile = [...document.querySelectorAll(".dw-sheetbody .dw-tile")]
      .find((t) => t.querySelector(".dw-tilelab").textContent === "level");
    tile.focus();
    return { v: +tile.getAttribute("aria-valuenow"), focused: document.activeElement === tile };
  });
  if (!tileKey0.focused) fail("tile not focusable");
  else ok("a tile takes keyboard focus (role=slider)");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  const tileKey1 = await page.evaluate(() => ({
    v: +document.activeElement.getAttribute("aria-valuenow"),
    patch: ((window.__DAW.SONG.patch.layers || {}).melody || {}).level }));
  if (Math.abs(tileKey1.v - Math.min(1, tileKey0.v + 0.02)) > 0.011)
    fail(`ArrowUp moved the tile ${tileKey0.v} → ${tileKey1.v} (want +0.02)`);
  else ok(`ArrowUp nudges the tile: ${tileKey0.v.toFixed(2)} → ${tileKey1.v.toFixed(2)}`);
  if (tileKey1.patch == null) fail("the tile's keyboard step did not commit to patch.layers");
  else ok("the tile's keyboard step commits through editLayer");

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-CONTROLS: FAIL");
  else console.log(`\nDAW-CONTROLS: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
