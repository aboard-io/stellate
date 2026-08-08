#!/usr/bin/env node
// test/browser/daw-feel.test.js — THE RADARS, one per strip, under their roll.
//
// The single zoomable orbit is gone (Paul: break it up, put each radar under its
// piano roll, scroll up and down). So the zoom and pinch assertions that used to
// live here are gone with it — there is no gesture left to hold. What remains is
// what the controls still have to promise:
//
//   A every layer has a radar, and the kernel's is the sculptor
//   B NO SLIDERS anywhere, and the handles carry their own accessibility
//   C IT DOES NOT SNAP — a handle stays where you put it after the blend resolves
//   D an outer strip's radar writes its OWN layer, one number per axis
//   E shaping the kernel actually moves the music (tempo, swing)
//   F MOBILE — thumb targets, no sideways scroll, a real touch drag writes
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const KERNEL = '.dw-strip2[data-layer="genre"]';

async function dragAxis(page, label, frac) {
  const geo = await page.evaluate(({ lab, sel }) => {
    const svg = document.querySelector(sel + " .dw-vec");
    if (!svg) return null;
    // THE DECK SCROLLS. Focusing a handle on another strip scrolls it into view,
    // which puts the kernel radar off-screen — and a mouse event at a negative
    // coordinate lands nowhere. Bring it back before measuring.
    svg.scrollIntoView({ block: "center" });
    const r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll(".dw-vlab")];
    const i = texts.findIndex((t) => t.textContent === lab);
    if (i < 0) return null;
    const n = texts.length, ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const rr = svg.getBoundingClientRect();          // re-measure AFTER the scroll
    return { cx: rr.left + rr.width / 2, cy: rr.top + rr.height / 2,
             dx: Math.cos(ang), dy: Math.sin(ang), R: rr.width / 2 - 34 };
  }, { lab: label, sel: KERNEL });
  if (!geo) return false;
  await page.mouse.move(geo.cx + geo.dx * geo.R * 0.3, geo.cy + geo.dy * geo.R * 0.3);
  await page.mouse.down();
  await page.mouse.move(geo.cx + geo.dx * geo.R * frac, geo.cy + geo.dy * geo.R * frac, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(320);
  return true;
}

async function main() {
  const srv = await serve(ROOT, 8977);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=citypop&seed=7`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector(`${'.dw-strip2[data-layer="genre"]'} .dw-vpoly`), null, { timeout: 20000 });
  await page.waitForTimeout(400);

  // ---- A a radar per layer ----
  const shape = await page.evaluate((sel) => ({
    strips: document.querySelectorAll(".dw-strip2").length,
    radars: document.querySelectorAll(".dw-strip2 .dw-vec").length,
    kernelSpokes: document.querySelectorAll(sel + " .dw-vdot").length,
    hits: document.querySelectorAll(sel + " .dw-vhit").length,
    labels: [...document.querySelectorAll(sel + " .dw-vlab")].map((t) => t.textContent),
    underRoll: (() => {
      const s = document.querySelector('.dw-strip2[data-layer="melody"]');
      if (!s) return false;
      const roll = s.querySelector("canvas.dw-roll"), vec = s.querySelector(".dw-vec");
      return !!(roll && vec) && roll.getBoundingClientRect().bottom <= vec.getBoundingClientRect().top + 2;
    })(),
  }), KERNEL);
  if (shape.radars < shape.strips - 1) fail(`${shape.strips} strips but only ${shape.radars} radars`);
  else ok(`${shape.radars} radars, one per layer`);
  if (!shape.underRoll) fail("the radar is not UNDER its piano roll");
  else ok("each radar sits under its own roll");
  if (shape.kernelSpokes < 8) fail("kernel radar: " + shape.labels.join(","));
  else ok(`the kernel radar carries ${shape.kernelSpokes} spokes (${shape.labels.slice(0, 5).join("/")}…)`);
  if (shape.hits !== shape.kernelSpokes) fail("wedge hit targets missing");
  else ok(`${shape.hits} wedge hit targets`);
  if (shape.labels.indexOf("density") >= 0) fail("the un-invertible axis is on an editable radar");
  else ok("the un-invertible axis is kept off the editable radar");

  // ---- B no sliders ----
  const anyRange = await page.evaluate(() => document.querySelectorAll('input[type="range"]').length);
  if (anyRange) fail(`${anyRange} <input type=range> still on the page`);
  else ok("no range inputs anywhere");
  const kbd = await page.evaluate((sel) => {
    const d = document.querySelector(sel + ' .dw-vdot[role="slider"]');
    return d ? { tab: d.getAttribute("tabindex"), now: d.getAttribute("aria-valuenow"), lab: d.getAttribute("aria-label") } : null;
  }, KERNEL);
  if (!kbd || kbd.tab !== "0") fail("handles are not keyboard operable: " + JSON.stringify(kbd));
  else ok(`handles carry their own accessibility (role=slider, ${kbd.lab})`);

  // ---- C it does not snap ----
  await page.waitForFunction(() => window.__DAWSCULPT && window.__DAWSCULPT.progress().built > 30, null, { timeout: 60000 }).catch(() => {});
  await dragAxis(page, "bright", 0.95);
  await page.waitForTimeout(600);
  const held = await page.evaluate((sel) => {
    const set = window.__DAW.SONG.patch.feel || {};
    const dot = [...document.querySelectorAll(sel + ' .dw-vdot[role="slider"]')]
      .find((d) => /bright/.test(d.getAttribute("aria-label") || ""));
    return { setV: set.bright, shown: dot ? +dot.getAttribute("aria-valuenow") : null,
             patchLen: JSON.stringify(window.__DAW.SONG.patch).length,
             cutoff: ((window.__DAWSTATE().instruments || {}).melody || {}).cutoff };
  }, KERNEL);
  if (held.setV == null) fail("dragging bright recorded nothing");
  else if (Math.abs(held.shown - held.setV) > 0.02)
    fail(`the handle SNAPPED: set ${held.setV}, showing ${held.shown}`);
  else ok(`the handle stays where it was put (set ${held.setV.toFixed(2)})`);
  if (!(held.cutoff > 0)) fail("the set axis never reached the engine");
  else ok(`the set axis reaches the engine (lead cutoff ${Math.round(held.cutoff)}Hz)`);
  if (held.patchLen >= 400) fail("the patch ballooned — one number per axis, not resolved params");
  else ok(`the patch stays one number per axis (${held.patchLen} chars)`);

  // ---- D an outer strip writes its own layer ----
  await page.evaluate(() => window.__DAW.edit({ patch: {}, weights: null }));
  await page.waitForTimeout(320);
  const kickBefore = await page.evaluate(() => (window.__DAWSTATE().instruments.drums || {}).kick);
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.dw-strip2[data-layer="drums"] .dw-vdot[role="slider"]')]
      .find((x) => /kick$/.test(x.getAttribute("aria-label") || ""));
    if (d) { d.focus(); d.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })); }
  });
  await page.waitForTimeout(380);
  const ring = await page.evaluate(() => ({
    kick: (window.__DAWSTATE().instruments.drums || {}).kick,
    layers: window.__DAW.SONG.patch.layers,
    len: JSON.stringify(window.__DAW.SONG.patch).length,
  }));
  if (!(ring.kick > kickBefore)) fail(`the drums radar did not move the kit (${kickBefore} -> ${ring.kick})`);
  else ok(`an outer strip writes its own layer (kick ${(+kickBefore).toFixed(2)} → ${(+ring.kick).toFixed(2)})`);
  if (!ring.layers || !ring.layers.drums) fail("the edit did not land in patch.layers");
  else ok(`the edit lands as patch.layers.drums (${JSON.stringify(ring.layers.drums)})`);
  if (ring.len >= 400) fail("the layer patch ballooned");
  else ok(`the layer patch stays one number per axis (${ring.len} chars)`);

  // ---- E shaping moves the music ----
  const shapeAndRead = async (axis, frac) => {
    await dragAxis(page, axis, frac);
    await page.waitForTimeout(520);
    return page.evaluate(() => { const st = window.__DAWSTATE(); return { bpm: st.bpm, swing: st.swing || 0 }; });
  };
  await page.evaluate(() => window.__DAW.edit({ patch: {}, weights: null }));
  await page.waitForTimeout(320);
  const slow = await shapeAndRead("tempo", 0.12);
  const fast = await shapeAndRead("tempo", 0.98);
  if (!(fast.bpm > slow.bpm)) fail(`shaping tempo did not change speed: ${slow.bpm} vs ${fast.bpm}`);
  else ok(`shaping tempo moves the music: ${slow.bpm} → ${fast.bpm} bpm`);
  await page.evaluate(() => window.__DAW.edit({ patch: {}, weights: null }));
  await page.waitForTimeout(320);
  const straight = await shapeAndRead("swing", 0.02);
  const shuffled = await shapeAndRead("swing", 0.98);
  if (!(shuffled.swing > straight.swing)) fail(`shaping swing did nothing: ${straight.swing} vs ${shuffled.swing}`);
  else ok(`shaping swing moves the music: ${straight.swing} → ${shuffled.swing}`);

  // ---- F mobile ----
  await page.setViewportSize({ width: 390, height: 844 });

  await page.waitForTimeout(500);
  const m = await page.evaluate((sel) => {
    const svg = document.querySelector(sel + " .dw-vec"), r = svg.getBoundingClientRect();
    const small = [];
    for (const el of document.querySelectorAll(".dw-btn, .dw-dlitem")) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && b.height < 40) small.push((el.className || "").split(" ")[0] + "@" + Math.round(b.height));
    }
    return { touchAction: getComputedStyle(svg).touchAction, vecW: Math.round(r.width), vw: window.innerWidth,
             overflow: document.documentElement.scrollWidth - window.innerWidth,
             small: [...new Set(small)].slice(0, 5) };
  }, KERNEL);
  if (m.touchAction !== "none") fail(`touch-action is "${m.touchAction}" — a drag will scroll the page`);
  else ok("touch-action:none — a drag edits rather than scrolling");
  if (m.vecW > m.vw - 16) fail(`the radar is ${m.vecW}px on a ${m.vw}px viewport`);
  else ok(`the radar fits the phone (${m.vecW}px of ${m.vw}px)`);
  if (m.overflow > 1) fail(`the page scrolls sideways by ${m.overflow}px`);
  else ok("no horizontal overflow at 390px");
  if (m.small.length) fail("controls under 40px: " + m.small.join(", "));
  else ok("every control clears a thumb");

  const touchOk = await page.evaluate(async (sel) => {
    const svg = document.querySelector(sel + " .dw-vec"), r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll(".dw-vlab")];
    const i = texts.findIndex((t) => t.textContent === "dust");
    if (i < 0) return "no dust axis";
    const n = texts.length, ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2 - 34;
    const mk = (t, x, y) => svg.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    mk("pointerdown", cx + Math.cos(ang) * R * 0.2, cy + Math.sin(ang) * R * 0.2);
    mk("pointermove", cx + Math.cos(ang) * R * 0.9, cy + Math.sin(ang) * R * 0.9);
    mk("pointerup", cx + Math.cos(ang) * R * 0.9, cy + Math.sin(ang) * R * 0.9);
    await new Promise((z) => setTimeout(z, 400));
    const f = window.__DAW.SONG.patch.feel || {};
    return f.dust != null ? "ok dust=" + f.dust : "no write";
  }, KERNEL);
  if (!/^ok/.test(touchOk)) fail("a touch drag did not edit (" + touchOk + ")");
  else ok("a touch-type pointer drag edits (" + touchOk + ")");

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-FEEL: FAIL");
  else console.log(`\nDAW-FEEL: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
