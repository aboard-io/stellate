#!/usr/bin/env node
// test/browser/daw-feel.test.js — THE KERNEL SCULPTOR under THE GRID, on a phone.
//
// The deck's radar-per-layer is gone (DAW-GRID spec): ONE radar remains — the
// kernel card's genre sculptor — and every other surface speaks pads / tiles /
// chips. So this gate holds the sculptor's own contract at 390×844 touch:
//
//   A the card       collapsed row boots visible; tap expands to the sculptor;
//                    the radar fits the phone and claims its drags (touch-action)
//   B no sliders     zero input[type=range] ON THE WHOLE PAGE — including with
//                    the busiest sheet open (the standing gate law)
//   C accessibility  handles are focusable role=slider; the ghost polygon rides
//                    behind the set shape (what the space actually gave you)
//   D no snap-back   a touch drag writes patch.feel and the handle STAYS where
//                    the finger put it after the blend resolves
//   E it reaches     shaping tempo moves the resolved bpm; the patch stays one
//                    number per axis (never resolved params)
//   F thumb floor    every pad/tile/chip/button in an open sheet ≥44px
//                    (the ladder/matrix kept editors are row-height targets —
//                    their cells hold the 44px height; columns stay fractional)
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

// a touch-type pointer drag on one sculptor axis (vector.js hit-tests geometry,
// so dispatching on the svg with client coordinates is the real code path)
async function touchDrag(page, label, frac) {
  return page.evaluate(async ({ lab, frac }) => {
    const svg = document.querySelector(".dw-kcard .dw-vec");
    if (!svg) return "no radar";
    svg.scrollIntoView({ block: "center" });
    const r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll(".dw-vlab")];
    const i = texts.findIndex((t) => t.textContent === lab);
    if (i < 0) return "no axis " + lab;
    const n = texts.length, ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2 - 34;
    const mk = (t, x, y) => svg.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true,
      cancelable: true, clientX: x, clientY: y }));
    mk("pointerdown", cx + Math.cos(ang) * R * 0.2, cy + Math.sin(ang) * R * 0.2);
    mk("pointermove", cx + Math.cos(ang) * R * frac, cy + Math.sin(ang) * R * frac);
    mk("pointerup", cx + Math.cos(ang) * R * frac, cy + Math.sin(ang) * R * frac);
    await new Promise((z) => setTimeout(z, 380));
    return "ok";
  }, { lab: label, frac });
}

async function main() {
  const srv = await serve(ROOT, 8977);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=citypop&seed=7`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__DAW && window.__DAW.grid && window.__DAW.grid.cols() > 0,
    null, { timeout: 20000 });
  await page.waitForTimeout(300);

  // ---- A the card ----
  await page.click(".dw-krow");
  const card = await page.evaluate(() => {
    const c = document.querySelector(".dw-kcard");
    const svg = c.querySelector(".dw-vec");
    const r = svg ? svg.getBoundingClientRect() : { width: 0 };
    return { open: c.classList.contains("open"), vec: !!svg,
      touchAction: svg ? getComputedStyle(svg).touchAction : "",
      vecW: Math.round(r.width), vw: window.innerWidth,
      expanded: c.querySelector(".dw-krow").getAttribute("aria-expanded") };
  });
  if (!card.open || !card.vec) fail("tapping the kernel row did not open the sculptor");
  else ok("kernel card expands to the sculptor (aria-expanded=" + card.expanded + ")");
  if (card.touchAction !== "none") fail(`radar touch-action "${card.touchAction}" — a drag will scroll`);
  else ok("touch-action:none — a drag edits rather than scrolling");
  if (card.vecW > card.vw - 16) fail(`radar ${card.vecW}px on a ${card.vw}px viewport`);
  else ok(`the radar fits the phone (${card.vecW}px of ${card.vw}px)`);

  // ---- C accessibility + the ghost ----
  const acc = await page.evaluate(() => {
    const svg = document.querySelector(".dw-kcard .dw-vec");
    const dots = [...svg.querySelectorAll('.dw-vdot[role="slider"]')];
    return { n: dots.length, tab: dots.length ? dots[0].getAttribute("tabindex") : null,
      labels: dots.map((d) => d.getAttribute("aria-label")),
      ghost: !!svg.querySelector(".dw-vghost") };
  });
  if (acc.n < 8 || acc.tab !== "0") fail("handles not keyboard operable: " + JSON.stringify(acc));
  else ok(`${acc.n} focusable role=slider handles (${acc.labels.slice(0, 4).join("/")}…)`);
  if (!acc.ghost) fail("no ghost polygon — the resolved shape must ride behind the set one");
  else ok("the dashed ghost rides behind the set shape");

  // ---- D no snap-back (a real touch drag) ----
  await page.waitForFunction(() => window.__DAWSCULPT && window.__DAWSCULPT.progress().built > 30,
    null, { timeout: 60000 }).catch(() => {});
  const dragRes = await touchDrag(page, "bright", 0.95);
  if (dragRes !== "ok") fail("touch drag: " + dragRes);
  await page.waitForTimeout(500);
  const held = await page.evaluate(() => {
    const set = window.__DAW.SONG.patch.feel || {};
    const dot = [...document.querySelectorAll('.dw-kcard .dw-vdot[role="slider"]')]
      .find((d) => /bright/.test(d.getAttribute("aria-label") || ""));
    return { setV: set.bright, shown: dot ? +dot.getAttribute("aria-valuenow") : null,
      weights: (window.__DAW.SONG.weights || []).length,
      patchLen: JSON.stringify(window.__DAW.SONG.patch).length };
  });
  if (held.setV == null) fail("dragging bright recorded nothing in patch.feel");
  else if (Math.abs(held.shown - held.setV) > 0.02)
    fail(`the handle SNAPPED: set ${held.setV}, showing ${held.shown}`);
  else ok(`no snap-back: the handle stays where the finger put it (set ${held.setV.toFixed(2)})`);
  if (!held.weights) fail("the sculpt did not re-blend (SONG.weights empty)");
  else ok(`the sculptor re-blends the space (${held.weights} anchors)`);
  if (held.patchLen >= 400) fail(`the patch ballooned (${held.patchLen} chars) — one number per axis`);
  else ok(`the patch stays one number per axis (${held.patchLen} chars)`);

  // ---- E shaping reaches the music ----
  await page.evaluate(() => window.__DAW.edit({ patch: { feel: {} }, weights: null }));
  await page.waitForTimeout(300);
  const bpm0 = await page.evaluate(() => window.__DAWSTATE().bpm);
  await touchDrag(page, "tempo", 0.98);
  await page.waitForTimeout(500);
  const bpm1 = await page.evaluate(() => window.__DAWSTATE().bpm);
  if (!(bpm1 > bpm0)) fail(`shaping tempo did not speed the song: ${bpm0} → ${bpm1}`);
  else ok(`shaping tempo moves the music: ${bpm0} → ${bpm1} bpm`);

  // ---- B no sliders, with the busiest sheet open ----
  await page.evaluate(() => window.__DAW.sheet.open("drums"));
  await page.waitForTimeout(300);
  const nRange = await page.evaluate(() => document.querySelectorAll('input[type="range"]').length);
  if (nRange) fail(`${nRange} <input type=range> with the drums sheet open`);
  else ok("zero range inputs on the whole page (drums sheet open)");

  // ---- F thumb floor in the open sheet + no sideways scroll ----
  const floor = await page.evaluate(() => {
    const small = [];
    for (const b of document.querySelectorAll(
      ".dw-sheetbody .dw-pad, .dw-sheetbody .dw-tile, .dw-sheetbody .dw-chip, .dw-sheetbody .dw-sheettab, #dawbar .dw-btn")) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width < 43.5 || r.height < 43.5)
        small.push(b.className.split(" ")[0] + "@" + Math.round(r.width) + "x" + Math.round(r.height));
    }
    return { small: [...new Set(small)].slice(0, 6),
      overflow: document.documentElement.scrollWidth - window.innerWidth };
  });
  if (floor.small.length) fail("controls under 44px: " + floor.small.join(", "));
  else ok("every pad/tile/chip in the sheet clears a thumb (≥44px)");
  if (floor.overflow > 1) fail(`the page scrolls sideways by ${floor.overflow}px`);
  else ok("no horizontal overflow at 390px");

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-FEEL: FAIL");
  else console.log(`\nDAW-FEEL: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
