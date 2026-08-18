#!/usr/bin/env node
// test/browser/bg-cart.test.js — headless gate against a STICKING wasm background: the
// demoscene cart must ROTATE in mode 2 (demos-only), and the alternator must
// STAND DOWN while the star-cruise runs
// (there the cart is PLANET-KEYED by starcruise ensureSurface).
//
//   node test/browser/bg-cart.test.js
//
// Gates:
//   A. mode 2 rotates: the layer is ALWAYS ON at boot (mode fixed 2 since the
//      there is no chip); with the backstop shortened (?bgAltMs=1200),
//      DemoLayer.current() advances within ~6s of idle wall-clock.
//   B. cruise guard: with a fake __STARCRUISE running, __BGALT.flip() leaves
//      the cart untouched (the planet owns its sky).
//   C. zero page errors throughout.
"use strict";
const path = require("path");
const H = require(path.join(__dirname, "..", "lib", "probe-harness.js"));

(async () => {
  let PORT = 8793;
  const srv = await H.serve(path.join(__dirname, "..", ".."), PORT);
  const browser = await H.launchChromium();
  const page = await browser.newPage();
  const errs = H.capturePageErrors(page);
  await H.installOfflineRoute(page, PORT);

  const fails = [];
  const ok = (cond, msg) => { console.log((cond ? "PASS  " : "FAIL  ") + msg); if (!cond) fails.push(msg); return cond; };

  await page.goto(`http://localhost:${PORT}/screensaver.html?bgAltMs=1200`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.DemoLayer && window.__BGALT && window.__BGALT.state().mode === 2, null, { timeout: 30000 });
  await page.waitForFunction(() => window.DemoLayer.enabled && window.DemoLayer.enabled(), null, { timeout: 30000 });

  // A — mode-2 idle rotation via the wall-clock backstop
  const c0 = await page.evaluate(() => window.DemoLayer.current());
  await page.waitForFunction((prev) => window.DemoLayer.current() !== prev, c0, { timeout: 8000 }).catch(() => {});
  const c1 = await page.evaluate(() => window.DemoLayer.current());
  ok(c1 !== c0, `A. mode-2 cart rotates on the idle backstop (${c0} -> ${c1})`);

  // B — the cruise guard: flip() must NOT advance the cart while cruising
  const guard = await page.evaluate(() => {
    const before = window.DemoLayer.current();
    const saved = window.__STARCRUISE;
    window.__STARCRUISE = { isRunning: () => true };
    window.__BGALT.flip();
    const after = window.DemoLayer.current();
    window.__STARCRUISE = saved;
    return { before, after };
  });
  ok(guard.after === guard.before, `B. alternator stands down while cruising (cart stays ${guard.before})`);

  ok(errs.length === 0, `C. zero page errors${errs.length ? " — " + errs.slice(0, 2).join(" | ") : ""}`);

  await browser.close(); srv.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("probe failed:", e.message); process.exit(1); });
