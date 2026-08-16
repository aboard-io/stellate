#!/usr/bin/env node
// test/browser/nukernel-preview.test.js — A PREVIEW SHOWS THE WHOLE PHRASE.
//
//   node test/browser/nukernel-preview.test.js
//
// The one DOM probe for the pattern thumbnails ("The little patterns often cut
// off on the bottom", Paul, 2026-08-16). What was cutting them was not the
// drawing: `.box` below the desk breakpoint has no bottom padding, `.bchips`
// had none either, so the bottom line of thumbnails ended EXACTLY on the
// section row's bottom edge — the line where `.bprog` (the 2px play-through
// hairline, a later sibling in the row, painted in the table ground) and the
// `.box.sel` / `.live` / `.looped` inset rings are drawn. They landed on the
// thumbnails: bottom border gone, corners squared, the ✕ lane's bottom rule and
// the [+]'s bottom dash erased, two pixels off every drawing. So the assertion
// that matters is not "is the path inside the svg" (it always was, by
// construction — thumbPath is bounded by its viewBox) but "does the thumbnail
// clear the edge its row decorates".
//
// It is measured, at both widths, against phrases chosen to span the space the
// drawing can occupy — empty, all-sixteen-gates, one whose notes sit in the
// LOWEST pitch row (the clamp floor, where the drawing is closest to its own
// bottom edge), one in the highest, ties, and two ordinary ones — because a
// spot check on the default phrase is exactly what shipped this.
//
//   (A) FLOOR      every thumbnail's border box lies inside its row's border
//                  box with >= FLOOR px of clearance below it — more than the
//                  thickest thing the row paints on that edge (3px);
//   (B) INSIDE     the drawn <path> lies inside its <svg>, the <svg> lies
//                  inside the chip's CONTENT box, and the path's bbox lies
//                  inside the viewBox in user units (all rows it claims to
//                  draw, at every step);
//   (C) NUMBER     the superimposed numeral is present, non-empty, and its box
//                  overlaps the drawing — over the grid, not beside it;
//   (D) ONE SIZE   every thumbnail on a strip is the same width and height.
//
// Checked on the row strips, the layer sub-row strips AND the bank behind [+].
// DOM geometry only — no audio, no play button.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8969;                 // a PREFERENCE — the harness walks past a busy port
const FLOOR = 4;                 // px a thumbnail must clear its row's bottom edge by

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// the spread: empty -> dense, including the LOWEST pitch row and a full 16
const PHRASES = () => {
  const z = () => new Array(16).fill(0);
  const f = (v) => new Array(16).fill(v);
  const P = (o) => Object.assign({ deg: z(), oct: z(), vel: f(5), inc: z(), stk: z(),
                                   gate: z(), acc: z(), sld: z() }, o);
  return [
    P({}),                                                            // empty
    P({ gate: f(1), deg: f(0) }),                                     // all 16, mid
    P({ gate: f(1), acc: f(1), sld: f(1), deg: f(-7), oct: f(-2) }),  // dense, LOWEST row
    P({ gate: f(1), acc: f(1), sld: f(1), deg: f(7), oct: f(2) }),    // dense, highest row
    P({ gate: f(1), deg: [0, 1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5, -6, -7, 0],
        oct: [0, 0, 0, 0, 1, 1, 1, 1, -1, -1, -1, -1, 0, 0, 0, 0],
        acc: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        sld: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] }),     // mixed, sld wraps
    P({ gate: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        deg: [0, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, -7, 0, 0, 0],
        oct: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2, 0, 0, 0] }),    // sparse, ONE low note
    P({ gate: f(1), sld: f(1), deg: f(0) }),                          // all ties
    P({ gate: [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
        deg: [0, 2, 0, 4, 0, -3, 5, 0, 1, 0, -7, 3, 0, 6, 0, -5],
        oct: [0, 0, 0, 1, 0, -1, 0, 0, 0, 0, -2, 0, 0, 2, 0, 0] }),   // ordinary
  ];
};

// read every thumbnail on the page as pure geometry
const MEASURE = () => {
  const out = [];
  document.querySelectorAll(".bchips").forEach((strip, si) => {
    // the row a strip is decorated by: a section row, a layer sub-row, or (for
    // the bank behind [+]) the popover row it unfolds into
    const row = strip.closest(".box, .lrow, .rowpop");
    if (!row) return;
    const rr = row.getBoundingClientRect();
    const chips = [...strip.querySelectorAll(".bch:not(.bplus)")];
    if (!chips.length) return;
    out.push({
      strip: si, cls: strip.className, rowCls: row.className,
      rowBottom: rr.bottom, rowTop: rr.top,
      chips: chips.map((c) => {
        const cr = c.getBoundingClientRect(), cs = getComputedStyle(c);
        const inner = {
          top: cr.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop),
          bottom: cr.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom),
          left: cr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
          right: cr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
        };
        const svg = c.querySelector(".bcmini"), sr = svg.getBoundingClientRect();
        const p = svg.querySelector("path"), pr = p.getBoundingClientRect();
        let bb = null; try { bb = p.getBBox(); } catch (e) { /* no geometry */ }
        const vb = svg.viewBox.baseVal;
        const n = c.querySelector(".bcn"), nr = n && n.getBoundingClientRect();
        return {
          num: n && n.textContent, w: cr.width, h: cr.height,
          top: cr.top, bottom: cr.bottom, inner,
          svg: { top: sr.top, bottom: sr.bottom, left: sr.left, right: sr.right },
          path: { top: pr.top, bottom: pr.bottom, left: pr.left, right: pr.right,
                  empty: pr.width === 0 && pr.height === 0 },
          bbox: bb && { y: bb.y, bottom: bb.y + bb.height, x: bb.x, right: bb.x + bb.width },
          vb: { w: vb.width, h: vb.height },
          numBox: nr && { top: nr.top, bottom: nr.bottom, left: nr.left, right: nr.right },
        };
      }),
    });
  });
  return out;
};

function assertStrips(strips, W, where) {
  let clipped = 0, outside = 0, noNum = 0, ragged = 0, chips = 0, minClear = Infinity;
  for (const s of strips) {
    const sizes = new Set();
    for (const c of s.chips) {
      chips++;
      sizes.add(c.w.toFixed(2) + "x" + c.h.toFixed(2));
      // (A) the thumbnail clears the row's decorated bottom edge
      const clear = s.rowBottom - c.bottom;
      minClear = Math.min(minClear, clear);
      if (clear < FLOOR || c.top < s.rowTop - 0.5) {
        clipped++;
        if (clipped <= 3)
          fail(`${where} ${W}px: phrase ${c.num} on ${s.rowCls} clears its row's ` +
               `bottom edge by ${clear.toFixed(2)}px (need ${FLOOR})`);
      }
      // (B) path inside svg inside the chip's content box, and bbox inside the viewBox
      const eps = 0.51;
      const bad = [];
      if (!c.path.empty) {
        if (c.path.bottom > c.svg.bottom + eps) bad.push("path below svg");
        if (c.path.top < c.svg.top - eps) bad.push("path above svg");
        if (c.path.left < c.svg.left - eps) bad.push("path left of svg");
        if (c.path.right > c.svg.right + eps) bad.push("path right of svg");
        if (c.bbox) {
          if (c.bbox.bottom > c.vb.h + 1e-6) bad.push("bbox below viewBox");
          if (c.bbox.y < -1e-6) bad.push("bbox above viewBox");
          if (c.bbox.right > c.vb.w + 1e-6) bad.push("bbox right of viewBox");
        }
      }
      if (c.svg.bottom > c.inner.bottom + eps) bad.push("svg below the content box");
      if (c.svg.top < c.inner.top - eps) bad.push("svg above the content box");
      if (bad.length) {
        outside++;
        if (outside <= 3) fail(`${where} ${W}px: phrase ${c.num} — ${bad.join(", ")}`);
      }
      // (C) the number is there, and it is OVER the drawing
      const over = c.numBox && c.numBox.top < c.svg.bottom && c.numBox.bottom > c.svg.top &&
                   c.numBox.left < c.svg.right && c.numBox.right > c.svg.left;
      if (!c.num || !c.num.trim() || !over) {
        noNum++;
        if (noNum <= 3) fail(`${where} ${W}px: phrase ${c.num} — numeral missing or off the grid`);
      }
    }
    // (D) one size to a strip
    if (sizes.size > 1) {
      ragged++;
      fail(`${where} ${W}px: ${s.rowCls} strip has ${sizes.size} thumbnail sizes: ` +
           [...sizes].join(", "));
    }
  }
  return { chips, clipped, outside, noNum, ragged, minClear };
}

(async () => {
  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();

  // a real song first — the composer writes the sections, the layers and the
  // stacks a strip actually renders; the crafted phrases then ride in its bank
  let raw;
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
    const errs = capturePageErrors(page);
    await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html?nobounce`,
      { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("nukernel.song.v1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.selectOption("#composeg", "beatles");
    await page.click("#compose");
    await page.waitForTimeout(700);
    raw = await page.evaluate(() => JSON.parse(localStorage.getItem("nukernel.song.v1")));
    if (!raw || !raw.slots) fail("the composer wrote no song to read back");
    if (errs.length) fail("page errors while composing: " + errs.slice(0, 3).join(" | "));
    await page.close();
  }
  if (raw && raw.slots) {
    raw.slots = PHRASES();
    // section 1's authority plays every one of them, so one strip carries the
    // whole spread and has to WRAP at 390 — the case that was cut
    raw.song[0].stack[0].slots = [0, 1, 2, 3, 4, 5, 6, 7];
    if (raw.song[0].stack[1]) raw.song[0].stack[1].slots = [2, 3, 7];
  }

  for (const W of [390, 1280]) {
    // the store is written BEFORE the app boots: a page.reload would fire
    // pagehide, and pagehide saves the in-memory song over anything we wrote
    const ctx = await browser.newContext({ viewport: { width: W, height: 1400 } });
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* private */ } },
      ["nukernel.song.v1", JSON.stringify(raw)]);
    const page = await ctx.newPage();
    const errs = capturePageErrors(page);
    await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html?nobounce`,
      { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const strips = await page.evaluate(MEASURE);
    const rowChips = strips.reduce((n, s) => n + s.chips.length, 0);
    if (rowChips < 8) fail(`${W}px: only ${rowChips} thumbnails on the page — the crafted ` +
                           "bank did not load, so nothing was proved");
    const r = assertStrips(strips, W, "row");
    if (!r.clipped) ok(`${W}px: ${r.chips} row thumbnails clear their row's bottom edge ` +
                       `(worst ${r.minClear.toFixed(2)}px, floor ${FLOOR})`);
    if (!r.outside) ok(`${W}px: every drawing sits inside its svg, inside the chip's content box`);
    if (!r.noNum) ok(`${W}px: every thumbnail carries its numeral, over the grid`);
    if (!r.ragged) ok(`${W}px: every strip's thumbnails are one size`);

    // ...and the same, for the bank behind [+]
    await page.click(".bchips.has .bch.bplus");
    await page.waitForTimeout(300);
    const bankStrips = (await page.evaluate(MEASURE)).filter(s => /\bbank\b/.test(s.cls));
    if (!bankStrips.length) fail(`${W}px: [+] opened no bank to measure`);
    else {
      const b = assertStrips(bankStrips, W, "bank");
      if (!b.clipped && !b.outside && !b.noNum && !b.ragged)
        ok(`${W}px: ${b.chips} bank thumbnails behind [+] are whole too ` +
           `(worst ${b.minClear.toFixed(2)}px)`);
    }

    if (W === 390) {
      const shot = process.env.NUPREVIEW_SHOT;
      if (shot) { await page.screenshot({ path: shot }); console.log("  shot:", shot); }
    }
    if (errs.length) fail(`${W}px page errors: ` + errs.slice(0, 3).join(" | "));
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log(process.exitCode ? "nukernel-preview: FAIL" : `nukernel-preview: PASS (${checks} checks)`);
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
