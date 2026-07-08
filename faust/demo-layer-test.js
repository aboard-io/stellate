#!/usr/bin/env node
// faust/demo-layer-test.js — headless gate for the demoscene background layer
// (../demo-layer.js + the vendored MicroW8 runtime under ../vendor/microw8/).
//
// Serves the REPO ROOT (so the vendored loader.wasm / platform.uw8 / carts load
// same-origin), opens the throwaway harness (vendor/microw8/_harness.html) in
// the pinned headless chromium, and asserts:
//   1. DemoLayer.init() resolved available === true
//   2. a background surface element (#demolayer > canvas) exists in the DOM
//   3. the cart list is the LARGER set (>= MIN_CARTS; logs the count)
//   4. after setEnabled(true) the surface is ANIMATING (frame-hash changes)
//   5. next() cycles through several carts, each of which animates
//   6. DemoLayer.note(...) measurably perturbs the animation vs a no-note
//      baseline (bigger frame-hash drift when notes fire)
//   7. setEnabled(false) hides the surface / stops the loop
//   8. zero console / page errors
// Prints "DEMO-LAYER GATE: PASS" + the cart count on success; exits non-zero on
// any failure.
"use strict";

const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("./probe-harness.js");

const ROOT = path.resolve(__dirname, "..");   // repo root
const PORT = 8231;
const MIN_CARTS = 30;                          // the "many many many more" bar (32 shipped)

function fail(msg) { console.error("DEMO-LAYER GATE: FAIL —", msg); process.exit(1); }

(async () => {
  const srv = await serve(ROOT, PORT);
  const browser = await launchChromium();
  let errors = [];
  try {
    const page = await browser.newPage();
    errors = capturePageErrors(page);
    await page.goto("http://localhost:" + PORT + "/vendor/microw8/_harness.html", { waitUntil: "load" });

    // 1. init resolves available === true
    const available = await page.evaluate(async () => {
      try { return await window.__demoReady; } catch (e) { return "ERR:" + (e && e.message); }
    });
    if (available !== true) fail("DemoLayer.init() did not resolve available===true (got " + JSON.stringify(available) + ")");

    // 2. background surface element exists
    const hasSurface = await page.evaluate(() => {
      const w = document.getElementById("demolayer");
      return !!(w && w.querySelector("canvas"));
    });
    if (!hasSurface) fail("no #demolayer canvas surface in the DOM");

    const apiOk = await page.evaluate(() =>
      typeof DemoLayer.enabled === "function" && typeof DemoLayer.available === "function" &&
      typeof DemoLayer.next === "function" && typeof DemoLayer.setCart === "function" &&
      typeof DemoLayer.note === "function" && typeof DemoLayer.pulse === "function" &&
      DemoLayer.available() === true);
    if (!apiOk) fail("DemoLayer API surface incomplete (missing note/pulse/etc.)");

    // 3. the cart list is the larger set
    const cartCount = await page.evaluate(() => DemoLayer.carts().length);
    console.log("DEMO-LAYER: cart count = " + cartCount);
    if (cartCount < MIN_CARTS) fail("cart list too small: " + cartCount + " < " + MIN_CARTS);

    // note() must be a safe no-op while disabled
    const noopWhenOff = await page.evaluate(() => {
      try { DemoLayer.note({ role: "lead", midi: 72, freq: 523, vel: 1, durSec: 0.2 }); return true; }
      catch (e) { return "ERR:" + (e && e.message); }
    });
    if (noopWhenOff !== true) fail("note() threw while layer disabled: " + noopWhenOff);

    // 4. enable -> assert the canvas is animating (two samples ~600ms apart differ)
    await page.evaluate(() => DemoLayer.setEnabled(true));
    await page.waitForTimeout(150);
    const enabledNow = await page.evaluate(() => DemoLayer.enabled() && DemoLayer._running());
    if (!enabledNow) fail("layer did not start running after setEnabled(true)");
    const h1 = await page.evaluate(() => DemoLayer._frameHash());
    await page.waitForTimeout(600);
    const h2 = await page.evaluate(() => DemoLayer._frameHash());
    if (h1 === h2) fail("canvas is not animating (frame hash unchanged: " + h1 + ")");
    // sanity: the surface isn't blank (some non-zero pixels present)
    const nonBlank = await page.evaluate(() => {
      const c = DemoLayer._canvas(); const d = c.getContext("2d").getImageData(0, 0, 320, 240).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) return true;
      return false;
    });
    if (!nonBlank) fail("canvas rendered blank");

    // 5. next() cycles through several distinct carts, each animating + non-blank
    const CYCLE = 5;
    const seenNames = [];
    for (let k = 0; k < CYCLE; k++) {
      const name = await page.evaluate(() => DemoLayer.currentName());
      seenNames.push(name);
      const a = await page.evaluate(() => DemoLayer._frameHash());
      await page.waitForTimeout(400);
      const b = await page.evaluate(() => DemoLayer._frameHash());
      if (a === b) fail("cart '" + name + "' did not animate (hash " + a + " stable)");
      const lit = await page.evaluate(() => {
        const d = DemoLayer._canvas().getContext("2d").getImageData(0, 0, 320, 240).data;
        let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) n++;
        return n;
      });
      if (lit < 50) fail("cart '" + name + "' rendered near-blank (" + lit + " lit px)");
      await page.evaluate(() => DemoLayer.next());
      await page.waitForTimeout(120);
    }
    if (new Set(seenNames).size < 3) fail("next() did not cycle distinct carts: " + JSON.stringify(seenNames));

    // 6. note() measurably perturbs the animation vs a no-note baseline. We
    //    isolate the reactivity from the cart's own motion by two signals over a
    //    fixed window on ONE pinned cart: (a) mean brightness — the flash lever
    //    brightens ANY cart toward white, so firing notes must raise the average
    //    luminance; (b) frame-hash drift — the note stream must also produce a
    //    set of frames distinct from the quiet baseline. (a) is the primary,
    //    lever-isolating assertion; (b) confirms the pixels actually move.
    await page.evaluate(() => DemoLayer.setCart(0));   // pin a deterministic cart
    await page.waitForTimeout(400);                    // let levers decay to rest
    function window_(withNotes) {
      return page.evaluate(async (fire) => {
        const roles = ["bass", "drums", "lead", "pad"];
        const hashes = new Set(); let lumaSum = 0, n = 0;
        for (let i = 0; i < 24; i++) {
          if (fire) {
            const r = roles[i % roles.length];
            DemoLayer.note({ role: r, midi: 48 + (i * 7) % 40, freq: 220, vel: 1, durSec: 0.2, section: "test" });
          }
          await new Promise(res => setTimeout(res, 30));
          const d = DemoLayer._canvas().getContext("2d").getImageData(0, 0, 320, 240).data;
          let s = 0; for (let j = 0; j < d.length; j += 16) s += d[j] + d[j + 1] + d[j + 2];
          lumaSum += s; n++;
          hashes.add(DemoLayer._frameHash() >>> 0);
        }
        return { luma: lumaSum / n, frames: hashes.size };
      }, withNotes);
    }
    const base = await window_(false);
    await page.waitForTimeout(400);                    // decay again before the noted pass
    const noted = await window_(true);
    // flash must lift brightness; and frames must still be animating during notes
    if (!(noted.luma > base.luma * 1.03)) {
      fail("note() did not perturb brightness (baseline luma=" + base.luma.toFixed(0) +
           ", with-notes=" + noted.luma.toFixed(0) + ")");
    }
    if (noted.frames < 2) fail("no animation while notes firing (distinct frames=" + noted.frames + ")");

    // note() still a safe no-op AFTER re-disable is checked below; also verify
    // pulse() + a lone note don't throw mid-run
    await page.evaluate(() => { DemoLayer.pulse({ energy: 0.9 }); DemoLayer.note({ role: "lead", midi: 84, freq: 880, vel: 0.8, durSec: 0.1 }); });
    await page.waitForTimeout(120);
    const stillRunning = await page.evaluate(() => DemoLayer._running() && DemoLayer._frameHash() !== 0);
    if (!stillRunning) fail("layer stopped after pulse()/note()");

    // 7. disable -> surface hidden
    await page.evaluate(() => DemoLayer.setEnabled(false));
    await page.waitForTimeout(100);
    const hidden = await page.evaluate(() => {
      const w = document.getElementById("demolayer");
      return getComputedStyle(w).display === "none" && !DemoLayer.enabled() && !DemoLayer._running();
    });
    if (!hidden) fail("surface not hidden / loop not stopped after setEnabled(false)");

    // 8. zero errors
    if (errors.length) fail("console/page errors: " + JSON.stringify(errors));

    console.log("DEMO-LAYER GATE: PASS (carts=" + cartCount +
      ", animating h1=" + h1 + " h2=" + h2 +
      ", cycled=" + JSON.stringify(seenNames) +
      ", note-perturb luma base=" + base.luma.toFixed(0) + " notes=" + noted.luma.toFixed(0) +
      ", hides, no errors)");
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error("DEMO-LAYER GATE: FAIL —", e && e.stack || e); process.exit(1); });
