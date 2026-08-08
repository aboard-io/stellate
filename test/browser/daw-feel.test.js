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
    const svg = document.querySelector(".dw-orbit");
    const r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll(".dw-oaxlab")];
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
  await page.waitForFunction(() => document.querySelector(".dw-orbit .dw-opoly.on"), null, { timeout: 20000 });

  // ---- A the radar draws ----
  const shape = await page.evaluate(() => ({
    spokes: document.querySelectorAll(".dw-orbit .dw-ospoke").length,
    dots: document.querySelectorAll(".dw-orbit .dw-odot").length,
    inds: document.querySelectorAll(".dw-orbit .dw-odot.ind").length,
    hits: document.querySelectorAll(".dw-orbit .dw-ohit").length,
    rows: 0,
    labels: [...document.querySelectorAll(".dw-orbit .dw-oaxlab")].map((t) => t.textContent),
  }));
  if (shape.spokes < 8 || shape.dots !== shape.spokes) fail("radar geometry wrong: " + JSON.stringify(shape));
  else ok(`radar draws ${shape.spokes} spokes (${shape.labels.slice(0, 5).join("/")}…)`);
  const zoom = await page.evaluate(async () => {
    const before = window.__DAWORBIT.focus();
    window.__DAWORBIT.focusLayer("drums");
    await new Promise((r) => setTimeout(r, 250));
    return { before, after: window.__DAWORBIT.focus(),
             refiner: (document.querySelector(".dw-orefine") || {}).textContent.slice(0, 40) };
  });
  if (zoom.after !== "drums") fail("zooming to a ring did not change focus: " + JSON.stringify(zoom));
  else ok(`zoom moves through the stack (${zoom.before} → ${zoom.after}, refiner follows)`);
  await page.evaluate(async () => { window.__DAWORBIT.focusLayer("genre"); await new Promise((r) => setTimeout(r, 250)); });
  const rings = await page.evaluate(() => ({
    n: document.querySelectorAll(".dw-orbit .dw-oring").length,
    ids: window.__DAWORBIT.LAYERS,
  }));
  if (rings.n < 8) fail(`the stack should show 8 layers, found ${rings.n} rings`);
  else ok(`the stack fans out from the kernel: ${rings.ids.join(" → ")}`);
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

  // ---- C NO SLIDERS, and what you set is what you get ----
  const anyRange = await page.evaluate(() => document.querySelectorAll('input[type="range"]').length);
  if (anyRange) fail(`${anyRange} <input type=range> still on the page — the radar is the control`);
  else ok("no range inputs anywhere on the page");

  const kbd = await page.evaluate(() => {
    const d = document.querySelector('.dw-orbit .dw-odot[role="slider"]');
    return d ? { tab: d.getAttribute("tabindex"), now: d.getAttribute("aria-valuenow"), lab: d.getAttribute("aria-label") } : null;
  });
  if (!kbd || kbd.tab !== "0" || kbd.now == null) fail("radar handles are not keyboard/AT operable: " + JSON.stringify(kbd));
  else ok(`handles carry the accessibility themselves (role=slider, tabindex=0, ${kbd.lab})`);

  // THE NO-SNAP CONTRACT. Drag a spoke, then let the blend resolve; the handle
  // must still be where you left it. This is the bug Paul reported: the panel used
  // to repaint every handle from the resolved state, so shaping made the spokes
  // jump and nothing could be set.
  await dragAxis(page, "bright", 0.95);
  await page.waitForTimeout(600);
  const held = await page.evaluate(() => {
    const set = window.__DAW.SONG.patch.feel || {};
    const st = window.__DAWSTATE();
    // the orbit labels a handle "<layer> <axis>", so the genre ring's bright
    // handle is "genre bright"
    const dot = [...document.querySelectorAll('.dw-orbit .dw-odot[role="slider"]')]
      .find((d) => /\bbright$/.test(d.getAttribute("aria-label") || ""));
    return { setV: set.bright, shown: dot ? +dot.getAttribute("aria-valuenow") : null,
             patchLen: JSON.stringify(window.__DAW.SONG.patch).length,
             cutoff: ((st.instruments || {}).melody || {}).cutoff };
  });
  if (held.setV == null) fail("dragging bright recorded nothing");
  else if (Math.abs(held.shown - held.setV) > 0.01)
    fail(`the handle SNAPPED: set ${held.setV}, showing ${held.shown} — it must stay where it was put`);
  else ok(`the handle stays where it was put (set ${held.setV.toFixed(2)}, showing ${held.shown.toFixed(2)})`);
  if (!(held.cutoff > 0)) fail("the set axis never reached the resolved state");
  else ok(`the set axis reaches the engine (lead cutoff ${Math.round(held.cutoff)}Hz)`);
  if (held.patchLen >= 400) fail("the patch ballooned — feel edits must store one number per axis, not resolved params");
  else ok(`the feel patch stays one number per axis (${held.patchLen} chars)`);

  const noInd = await page.evaluate(() =>
    [...document.querySelectorAll(".dw-orbit .dw-oaxlab")].map((t) => t.textContent).indexOf("density"));
  if (noInd >= 0) fail("the `density` indicator is on the genre ring — it cannot be set, so it must not be a handle");
  else ok("the un-invertible axis is kept off the editable ring entirely");

  // ---- D every layer stays visible while one is focused ----
  const stack = await page.evaluate(() => ({
    polys: document.querySelectorAll(".dw-orbit .dw-opoly").length,
    focused: document.querySelectorAll(".dw-orbit .dw-opoly.on").length,
  }));
  if (stack.focused !== 1) fail(`exactly one ring should be focused, found ${stack.focused}`);
  else ok(`one ring focused, ${stack.polys} layer shapes on screen at once`);

  // ---- E MOBILE ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(450);
  const m = await page.evaluate(() => {
    const svg = document.querySelector(".dw-orbit"), r = svg.getBoundingClientRect();
    const small = [];
    for (const el of document.querySelectorAll(".dw-btn, .dw-strip")) {
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
    const svg = document.querySelector(".dw-orbit"), r = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll(".dw-oaxlab")];
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

  }));
  if (!after.w || !after.w.length) fail("shaping produced no blend");
  else ok(`shaping resolved a blend: ${after.label}`);
  if (after.w && after.w.length < 2) fail("shaping snapped to a single anchor — a point between genres is a real place");
  else ok(`the blend carries ${after.w.length} anchors, weighted`);
  if (!after.w) fail("shaping produced no blend");
  else ok("the centre ring shapes the genre");

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

  // ---- G MATCH WEIGHTING: the axis you drag has to actually move ----
  // Uniform distance let tempo count as much as record-crackle, so dragging tempo
  // to the top could hand back something that was not faster. This asserts the
  // CONSEQUENCE rather than the weights: shape tempo low, read the bpm; shape it
  // high, read it again; high must be faster. Same for swing.
  const shapeAndRead = async (axis, frac) => {
    await dragAxis(page, axis, frac);
    await page.waitForTimeout(500);
    return page.evaluate(() => {
      const st = window.__DAWSTATE();
      return { bpm: st.bpm, swing: st.swing || 0,
               blend: (window.__DAW.SONG.weights || []).map((w) => w.g).join(",") };
    });
  };
  await page.evaluate(() => window.__DAW.edit({ patch: {}, weights: null }));
  await page.waitForTimeout(300);
  const slow = await shapeAndRead("tempo", 0.12);
  const fast = await shapeAndRead("tempo", 0.98);
  if (!(fast.bpm > slow.bpm)) fail(`shaping tempo did not change the music's speed: slow ${slow.bpm} vs fast ${fast.bpm}`);
  else ok(`shaping tempo moves the music: ${slow.bpm} → ${fast.bpm} bpm`);
  if (slow.blend === fast.blend) fail("the two tempo extremes returned the SAME anchors — the match is ignoring tempo");
  else ok("...and the two extremes land on different anchors");

  await page.evaluate(() => window.__DAW.edit({ patch: {}, weights: null }));
  await page.waitForTimeout(300);
  const straight = await shapeAndRead("swing", 0.02);
  const shuffled = await shapeAndRead("swing", 0.98);
  if (!(shuffled.swing > straight.swing)) fail(`shaping swing did nothing: ${straight.swing} vs ${shuffled.swing}`);
  else ok(`shaping swing moves the music: ${straight.swing} → ${shuffled.swing}`);

  // ---- H an OUTER ring writes its own layer, and only that ----
  // The genre ring shapes the blend; every ring outside it is a param write on
  // that voice. Drive the drums ring and demand the kit level moves while the
  // patch stays one number per axis.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(async () => {
    window.__DAW.edit({ patch: {}, weights: null });
    window.__DAWORBIT.focusLayer("drums");
    await new Promise((r) => setTimeout(r, 300));
  });
  const kickBefore = await page.evaluate(() => (window.__DAWSTATE().instruments.drums || {}).kick);
  await page.evaluate(async () => {
    const d = [...document.querySelectorAll('.dw-orbit .dw-odot[role="slider"]')]
      .find((x) => /\bkick$/.test(x.getAttribute("aria-label") || ""));
    if (!d) return;
    d.focus();
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
  });
  const ring = await page.evaluate(() => ({
    kick: (window.__DAWSTATE().instruments.drums || {}).kick,
    layers: window.__DAW.SONG.patch.layers,
    len: JSON.stringify(window.__DAW.SONG.patch).length,
  }));
  if (!(ring.kick > kickBefore)) fail(`the drums ring did not move the kit (${kickBefore} -> ${ring.kick})`);
  else ok(`an outer ring writes its own layer (kick ${(+kickBefore).toFixed(2)} → ${(+ring.kick).toFixed(2)})`);
  if (!ring.layers || !ring.layers.drums) fail("the layer edit did not land in patch.layers");
  else ok(`the edit lands as patch.layers.drums (${JSON.stringify(ring.layers.drums)})`);
  if (ring.len >= 400) fail("the layer patch ballooned — one number per axis, not resolved params");
  else ok(`the layer patch stays one number per axis (${ring.len} chars)`);

  // ---- I PINCH ZOOM ----
  // The gesture Paul reached for first. Two real touch pointers, spread apart:
  // focus must move OUTWARD through the stack. (I claimed pinch in a code comment
  // before implementing it — this is the check that keeps the claim honest.)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  const pinch = await page.evaluate(async () => {
    const svg = document.querySelector(".dw-orbit"), r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    window.__DAWORBIT.setFocus(0);
    await new Promise((z) => setTimeout(z, 200));
    const before = window.__DAWORBIT.focus();
    const send = (type, id, x, y) => svg.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: "touch", isPrimary: id === 1, bubbles: true, cancelable: true, clientX: x, clientY: y }));
    send("pointerdown", 1, cx - 20, cy);
    send("pointerdown", 2, cx + 20, cy);
    // spread to ~4x the starting distance: several layers outward
    for (const d of [40, 70, 110, 160]) { send("pointermove", 1, cx - d, cy); send("pointermove", 2, cx + d, cy); }
    send("pointerup", 1, cx - 160, cy); send("pointerup", 2, cx + 160, cy);
    await new Promise((z) => setTimeout(z, 250));
    const spread = window.__DAWORBIT.focus();
    // and back in
    send("pointerdown", 3, cx - 160, cy); send("pointerdown", 4, cx + 160, cy);
    for (const d of [110, 70, 40, 20]) { send("pointermove", 3, cx - d, cy); send("pointermove", 4, cx + d, cy); }
    send("pointerup", 3, cx - 20, cy); send("pointerup", 4, cx + 20, cy);
    await new Promise((z) => setTimeout(z, 250));
    return { before, spread, pinched: window.__DAWORBIT.focus() };
  });
  if (pinch.spread === pinch.before) fail(`spreading two fingers did not zoom out through the stack (stuck on ${pinch.before})`);
  else ok(`pinch works — spread ${pinch.before} → ${pinch.spread}`);
  if (pinch.pinched === pinch.spread) fail(`pinching back in did not return toward the kernel (stuck on ${pinch.spread})`);
  else ok(`...and back in: ${pinch.spread} → ${pinch.pinched}`);

  if (errs.length) fail("page errors: " + errs.join(" | "));
  else ok("no page errors");

  await browser.close(); srv.close();
  if (process.exitCode) console.error("\nDAW-FEEL: FAIL");
  else console.log(`\nDAW-FEEL: PASS — ${checks} checks`);
}
main().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
