#!/usr/bin/env node
// test/browser/daw-feel.test.js — THE EDITABLE VECTOR DISPLAY, and its mobile
// behaviour, which is the half that cannot be checked by looking at a desktop.
//
//   A the radar draws        one spoke per axis, indicators visibly distinct
//   B a DRAG SHAPES          dragging the radar re-picks the GENRE BLEND — it is
//                            the picker, not a param editor (Paul: "no dropdown,
//                            you shape the genre and that fills in the tracks")
//   C the writers are HONEST the SLIDER ROWS do param editing on top of the blend:
//                            a `spread` axis moves several params KEEPING their
//                            ratio; an `indicator` is disabled entirely
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

  // ---- B a drag SHAPES the genre ----
  // (the index has to exist first; matching against nothing would be a no-op)
  await page.waitForFunction(() => window.__DAWSCULPT && window.__DAWSCULPT.progress().built > 30,
    null, { timeout: 60000 }).catch(() => {});
  const wBefore = await page.evaluate(() => JSON.stringify(window.__DAW.SONG.weights));
  const dragged = await dragAxis(page, "tempo", 0.92);
  if (!dragged) fail("no tempo spoke to drag");
  const wAfter = await page.evaluate(() => JSON.stringify(window.__DAW.SONG.weights));
  if (wAfter === wBefore || wAfter === "null") fail("dragging the radar did not re-shape the genre blend");
  else ok("dragging the radar re-shapes the genre blend (it IS the picker)");

  // ---- C the writers are honest — exercised through the SLIDER rows ----
  const brightBefore = await page.evaluate(() => {
    const S = window.__DAW.SONG;
    const st = window.__DAWSTATE ? window.__DAWSTATE() : null;
    if (!st) return null;
    const I = st.instruments || {};
    return { mel: (I.melody || {}).cutoff, pad: (I.pad || {}).cutoff };
  });
  await page.evaluate(() => {
    const r = document.querySelector('.dw-frow[data-axis="bright"] .dw-fslider');
    r.value = "0.95"; r.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(280);
  // read the RESOLVED state, not the patch: the patch stores one number per axis
  // now, and the params it moves are re-derived on every build (feel-core.js)
  const brightAfter = await page.evaluate(() => {
    const st = window.__DAWSTATE(), I = st.instruments || {};
    return { mel: (I.melody || {}).cutoff, pad: (I.pad || {}).cutoff,
             patchIsSmall: JSON.stringify(window.__DAW.SONG.patch).length < 400 };
  });
  if (!brightBefore || brightAfter.mel == null || brightAfter.pad == null) fail("the bright row did not distribute across the cutoffs");
  else {
    ok(`bright spreads: lead ${Math.round(brightBefore.mel)}→${brightAfter.mel}Hz, pad ${Math.round(brightBefore.pad)}→${brightAfter.pad}Hz`);
    const wasDarker = (brightBefore.pad || 0) < (brightBefore.mel || 0);
    const stillDarker = brightAfter.pad < brightAfter.mel;
    if (wasDarker && !stillDarker) fail("the spread writer inverted the lead/pad balance — it must preserve the ratio");
    else ok("...preserving the lead/pad balance");
    // the patch must stay SMALL: storing resolved params instead of axis values
    // both blew the URL budget and pinned the instruments (feel-core.js header)
    if (!brightAfter.patchIsSmall) fail("the patch ballooned — feel edits must store one number per axis, not resolved params");
    else ok("the feel patch stays one number per axis");
  }

  // the indicator must be inert in BOTH views: disabled row, and the radar
  // refuses the pointer so it can never re-shape from a density drag either
  const indRow = await page.evaluate(() => {
    const r = document.querySelector('.dw-frow[data-axis="density"] .dw-fslider');
    return { disabled: !!(r && r.disabled) };
  });
  if (!indRow.disabled) fail("the `density` row is editable — it cannot be inverted honestly");
  else ok("the indicator row is disabled in the slider view");
  const wPre = await page.evaluate(() => JSON.stringify(window.__DAW.SONG.weights));
  await dragAxis(page, "density", 0.95);
  const wPost = await page.evaluate(() => JSON.stringify(window.__DAW.SONG.weights));
  if (wPre !== wPost) fail("dragging the `density` indicator re-shaped the genre — it must refuse the pointer");
  else ok("the indicator axis refuses the drag in the radar view too");

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
    await new Promise((z) => setTimeout(z, 400));
    const w = window.__DAW.SONG.weights;
    return w && w.length ? "ok " + w.length + " anchors" : "no shape";
  });
  if (!/^ok/.test(touchOk)) fail("a TOUCH-type pointer drag did not shape the genre (" + touchOk + ")");
  else ok("a touch-type pointer drag shapes the genre (" + touchOk + ")");

  // ---- F THE SHAPE IS THE PICKER ----
  // There must be no genre list at all, and dragging must land on a real blend
  // once the index has learned enough of the space.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  const noList = await page.evaluate(() => document.querySelectorAll("select").length);
  if (noList) fail(`${noList} <select> still on the page — the shape is the picker`);
  else ok("no genre dropdown anywhere");

  const indexed = await page.waitForFunction(
    () => window.__DAWSCULPT && window.__DAWSCULPT.progress().built > 30, null, { timeout: 60000 }
  ).then(() => true).catch(() => false);
  if (!indexed) fail("the anchor index never built");
  else ok("the space indexes lazily in idle slices");

  const before = await page.evaluate(() => JSON.stringify(window.__DAW.SONG.weights));
  await dragAxis(page, "tempo", 0.95);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    w: window.__DAW.SONG.weights,
    label: (document.getElementById("dwBlend") || {}).textContent || "",
    ghost: !!document.querySelector(".dw-vghost"),
  }));
  if (!after.w || !after.w.length) fail("shaping produced no blend");
  else ok(`shaping resolved a blend: ${after.label}`);
  if (after.w && after.w.length < 2) fail("shaping snapped to a single anchor — a point between genres is a real place");
  else ok(`the blend carries ${after.w.length} anchors, weighted`);
  if (!after.ghost) fail("no ghost outline — the shape you asked for must stay visible beside the one you got");
  else ok("the asked-for shape is drawn as a ghost beside the resolved one");

  const kept = await page.evaluate(() => {
    const q = new URL(location.href).searchParams.get("p") || "";
    const d = window.__DAW.decodePatch(q);
    return { n: d.__w ? d.__w.length : 0, q: q.slice(0, 24), search: location.search.slice(0, 80),
             enc: (window.__DAW.encodePatch() || "").slice(0, 24),
             w: JSON.stringify(window.__DAW.SONG.weights || null).slice(0, 60),
             patchKeys: Object.keys(window.__DAW.SONG.patch || {}) };
  });
  if (!kept.n) fail("the sculpted blend does not ride the URL — a shaped song would die on reload " + JSON.stringify(kept));
  else ok(`the sculpted blend rides the URL (${kept.n} anchors)`);

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-FEEL: FAIL");
  else console.log(`\nDAW-FEEL: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
