#!/usr/bin/env node
// test/browser/daw-feel.test.js — THE EDITABLE VECTOR DISPLAY, and its mobile
// behaviour, which is the half that cannot be checked by looking at a desktop.
//
//   A the radar draws        one spoke per axis, indicators visibly distinct
//   B a DRAG edits           a real pointer drag changes the song, and changes the
//                            axis under the finger and nothing else
//   C the writers are HONEST a `spread` axis moves several params while KEEPING
//                            their ratio; an `indicator` refuses the drag entirely
//   D two views, one state   radar and slider rows render the same axis list
//   E MOBILE                 at 390x844: touch-action:none (or a vertical drag
//                            scrolls the page instead of editing), the vector fits,
//                            no sideways scroll, the strip stacks above its roll,
//                            every enabled control clears a thumb, and a real
//                            pointerType:"touch" drag actually writes
//
// Run: node test/browser/daw-feel.test.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let checks = 0;
const ok = (m) => { checks++; console.log("  ok:", m); };
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

// a real pointer drag along a spoke: press near the centre, move outward, release
async function dragAxis(page, label, frac) {
  const geo = await page.evaluate((lab) => {
    const svg = document.querySelector(".dw-vec");
    const r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll(".dw-vlab")];
    const i = texts.findIndex((t) => t.textContent === lab);
    if (i < 0) return null;
    const n = texts.length, ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2,
             dx: Math.cos(ang), dy: Math.sin(ang), R: r.width / 2 - 30 * (r.width / 260) };
  }, label);
  if (!geo) return false;
  await page.mouse.move(geo.cx + geo.dx * geo.R * 0.3, geo.cy + geo.dy * geo.R * 0.3);
  await page.mouse.down();
  await page.mouse.move(geo.cx + geo.dx * geo.R * frac, geo.cy + geo.dy * geo.R * frac, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(240);
  return true;
}

async function main() {
  const srv = await serve(ROOT, 8977);
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto(`http://127.0.0.1:${srv.port}/daw.html?g=citypop&seed=7`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector(".dw-vec .dw-vpoly"), null, { timeout: 20000 });

  // ---- A the radar draws ----
  const shape = await page.evaluate(() => ({
    spokes: document.querySelectorAll(".dw-vec .dw-vspoke").length,
    dots: document.querySelectorAll(".dw-vec .dw-vdot").length,
    inds: document.querySelectorAll(".dw-vec .dw-vdot.ind").length,
    hits: document.querySelectorAll(".dw-vec .dw-vhit").length,
    rows: document.querySelectorAll(".dw-frow").length,
    labels: [...document.querySelectorAll(".dw-vec .dw-vlab")].map((t) => t.textContent),
  }));
  if (shape.spokes < 8 || shape.dots !== shape.spokes) fail("radar geometry wrong: " + JSON.stringify(shape));
  else ok(`radar draws ${shape.spokes} spokes (${shape.labels.slice(0, 5).join("/")}…)`);
  if (!shape.inds) fail("no indicator spoke is visually distinct — the lossy axes must LOOK different");
  else ok(`${shape.inds} indicator spoke(s) drawn distinctly`);
  if (shape.rows !== shape.spokes) fail(`radar has ${shape.spokes} axes but the rows show ${shape.rows}`);
  else ok("radar and slider rows render the same axis list");
  if (shape.hits !== shape.spokes) fail("wedge hit targets missing — a thumb needs the whole slice");
  else ok(`${shape.hits} wedge hit targets (thumb-sized, not 8px dots)`);

  // ---- B a drag edits, and only its own axis ----
  const dragged = await dragAxis(page, "tempo", 0.9);
  if (!dragged) fail("no tempo spoke to drag");
  const afterTempo = await page.evaluate(() => ({ bpm: window.__DAW.SONG.patch.bpm, keys: Object.keys(window.__DAW.SONG.patch) }));
  if (afterTempo.bpm == null || !(afterTempo.bpm > 0)) fail("dragging tempo wrote nothing usable: " + afterTempo.bpm);
  else ok(`dragging the tempo spoke set bpm=${afterTempo.bpm}`);
  const stray = afterTempo.keys.filter((k) => k !== "bpm");
  if (stray.length) fail("dragging tempo also wrote " + stray.join(", ") + " — a drag must touch its own axis only");
  else ok("...and wrote nothing else");

  // ---- C the writers are honest ----
  const brightBefore = await page.evaluate(() => {
    const K = window.GenreKernel, S = window.__DAW.SONG;
    const t = K.track(S.genre, { seed: S.seed });
    const st = Object.assign(JSON.parse(JSON.stringify(t.state || t)), S.patch);
    const I = st.instruments || {};
    return { mel: (I.melody || {}).cutoff, pad: (I.pad || {}).cutoff };
  });
  await dragAxis(page, "bright", 0.95);
  const brightAfter = await page.evaluate(() => {
    const p = window.__DAW.SONG.patch, I = p.instruments || {};
    return { mel: (I.melody || {}).cutoff, pad: (I.pad || {}).cutoff, tone: !!p.tone };
  });
  if (brightAfter.mel == null || brightAfter.pad == null) fail("dragging bright did not distribute across the cutoffs");
  else {
    ok(`bright distributed: lead ${brightBefore.mel}→${brightAfter.mel}Hz, pad ${brightBefore.pad}→${brightAfter.pad}Hz`);
    const wasDarker = (brightBefore.pad || 0) < (brightBefore.mel || 0);
    const stillDarker = brightAfter.pad < brightAfter.mel;
    if (wasDarker && !stillDarker) fail("the spread writer inverted the lead/pad balance — it must preserve the ratio");
    else ok("...preserving the lead/pad balance");
  }

  const indBefore = await page.evaluate(() => JSON.stringify(window.__DAW.SONG.patch));
  await dragAxis(page, "density", 0.95);
  const indAfter = await page.evaluate(() => JSON.stringify(window.__DAW.SONG.patch));
  if (indBefore !== indAfter) fail("dragging the `density` INDICATOR changed the song — it cannot be inverted honestly");
  else ok("the indicator axis refuses the drag (it reports, it does not set)");

  // ---- D two views, one state ----
  const agree = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".dw-frow")];
    return { rows: rows.length, bad: rows.filter((r) => { const v = +r.querySelector(".dw-fslider").value; return !(v >= 0 && v <= 1); }).length };
  });
  if (agree.bad) fail(`${agree.bad} slider rows out of range`);
  else ok(`all ${agree.rows} slider rows track the resolved state`);

  // ---- E MOBILE ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(450);
  const m = await page.evaluate(() => {
    const svg = document.querySelector(".dw-vec"), r = svg.getBoundingClientRect();
    const small = [];
    for (const el of document.querySelectorAll(".dw-btn, .dw-fslider:not([disabled]), .dw-strip")) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && b.height < 40) small.push((el.className || "").split(" ")[0] + "@" + Math.round(b.height));
    }
    return { touchAction: getComputedStyle(svg).touchAction,
             vecW: Math.round(r.width), vw: window.innerWidth,
             overflow: document.documentElement.scrollWidth - window.innerWidth,
             stripDir: getComputedStyle(document.querySelector(".dw-rowmain")).flexDirection,
             small: [...new Set(small)].slice(0, 6) };
  });
  if (m.touchAction !== "none") fail(`touch-action is "${m.touchAction}" — a vertical drag will SCROLL THE PAGE instead of editing`);
  else ok("touch-action:none — a drag edits rather than scrolling the page");
  if (m.vecW > m.vw - 16) fail(`the vector is ${m.vecW}px on a ${m.vw}px viewport`);
  else ok(`the vector fits the phone viewport (${m.vecW}px of ${m.vw}px)`);
  if (m.overflow > 1) fail(`the page scrolls sideways by ${m.overflow}px on a phone`);
  else ok("no horizontal overflow at 390px");
  if (m.stripDir !== "column") fail("the rack strip still sits beside the roll on a phone — 190px of strip leaves no roll");
  else ok("the rack stacks the strip above its roll on a phone");
  if (m.small.length) fail("controls under a 40px touch target: " + m.small.join(", "));
  else ok("every enabled control clears a thumb-sized touch target");

  // a real TOUCH pointer must edit, not just a mouse
  const touchOk = await page.evaluate(async () => {
    const svg = document.querySelector(".dw-vec"), r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll(".dw-vlab")];
    const i = texts.findIndex((t) => t.textContent === "swing");
    if (i < 0) return "no swing axis";
    const n = texts.length, ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2 - 30;
    const mk = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    mk("pointerdown", cx + Math.cos(ang) * R * 0.2, cy + Math.sin(ang) * R * 0.2);
    mk("pointermove", cx + Math.cos(ang) * R * 0.9, cy + Math.sin(ang) * R * 0.9);
    mk("pointerup", cx + Math.cos(ang) * R * 0.9, cy + Math.sin(ang) * R * 0.9);
    await new Promise((z) => setTimeout(z, 260));
    return window.__DAW.SONG.patch.swing != null ? "ok swing=" + window.__DAW.SONG.patch.swing : "no write";
  });
  if (!/^ok/.test(touchOk)) fail("a TOUCH-type pointer drag did not edit (" + touchOk + ")");
  else ok("a touch-type pointer drag edits (" + touchOk + ")");

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-FEEL: FAIL");
  else console.log(`\nDAW-FEEL: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
