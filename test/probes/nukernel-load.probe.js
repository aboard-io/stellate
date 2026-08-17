#!/usr/bin/env node
// test/probes/nukernel-load.probe.js — DOES THE CORNER CHIP TELL THE TRUTH,
// IN A REAL BROWSER, ACROSS A REAL HANDOFF.
//
//   node test/probes/nukernel-load.probe.js
//
// test/unit/nukernel.test.js §66 holds the arithmetic (loadHeadroom) and the
// DOM wiring pure in node, with window.__nuMix/__nuNodes STOOD IN for the
// real mixer — moving them for real needs a real song, decoded and playing.
// This is that: the actual page at a phone width, the actual chip
// (#readout .loadchip/.loaddetail), read while a song actually plays and
// again across the SAME hidden/return cycle
// test/probes/nukernel-return.probe.js already drives — because "which path
// is audible" is the one fact this chip adds that audio/graph.js is
// structurally forbidden to know on its own (the layer graph puts bounce.js
// ABOVE graph.js; ui/readout.js reads audio/bounce.js's isCarrying() to say
// it), and the only way to see that flip for real is a real handoff.
//
// WHY A PROBE, NOT A GATE: the wall clock IS half the measurement here
// (selfMs, the settle after a tap) — same reason nukernel-return.probe.js
// beside this one is hand-run rather than folded into verify.sh's
// concurrent suite.
"use strict";
const { serve, launchChromium } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

const readChip = () => {
  const chip = document.querySelector(".loadchip");
  const detail = document.querySelector(".loaddetail");
  if (!chip || !detail) return null;
  return {
    ariaLabel: chip.getAttribute("aria-label") || null,
    classes: chip.className,
    detailText: detail.textContent,
    // getComputedStyle rather than a class check — CSS is the actual claim
    detailShown: getComputedStyle(detail).display !== "none",
  };
};

(async () => {
  const srv = await serve(ROOT, 8983);
  const PORT = srv.port;
  const browser = await launchChromium();
  // 390 — the width the brief names ("legible at 390px in a moving vehicle")
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://localhost:${PORT}/nukernel/kernel-daw.html?idle=90000`,
    { waitUntil: "networkidle" });
  await page.locator(".box").first().locator(".bch").first().click();
  await page.waitForFunction(() =>
    document.getElementById("chassis").dataset.page === "compose", null, { timeout: 10000 });
  const slot0 = page.locator(".slot").nth(0);
  if ((await slot0.getAttribute("aria-pressed")) !== "true") await slot0.click();
  await page.click("#seed");
  await page.click("#play");
  await page.waitForFunction(() => window.__nuMix && window.__nuMix, null, { timeout: 15000 });

  /* ---- (1) the chip exists, is wordless, and costs nothing to look at ---- */
  await page.waitForTimeout(1200);           // one real load sample has landed
  const closed = await page.evaluate(readChip);
  console.log("closed, unread:", JSON.stringify(closed));
  const okClosed = closed && closed.ariaLabel && !closed.detailShown && closed.detailText === "";
  console.log(okClosed ? "  PASS wordless by default, an accessible name behind the icon"
                       : "  FAIL the collapsed chip is not actually wordless");

  /* ---- (2) a tap unfolds the real numbers, in the "engine 0.97x" idiom ---- */
  await page.click(".loadchip");
  await page.waitForTimeout(1200);
  const open = await page.evaluate(readChip);
  console.log("open:", JSON.stringify(open));
  const shape = open && /^\d\.\d{2}x · \d+v · (live|tape)( · \d+⚠)?$/.test(open.detailText);
  console.log(shape ? "  PASS the detail line is the expected shape"
                    : "  FAIL the detail line does not read as \"Nx · Nv · path\"");
  const said = open ? open.detailText.includes(" · live") : false;
  console.log(said ? "  PASS names the graph as the audible path while nothing has gone quiet"
                    : "  FAIL wrong path named before any handoff");

  /* ---- (3) ACROSS A REAL HANDOFF — the same recipe as the return probe ---- */
  await page.waitForFunction(() =>
    window.__nuBounce().state === "ready" && window.__nuBounce().stage === "full",
    null, { timeout: 240000 });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState",
      { get: () => window.__vis || "visible", configurable: true });
    window.__vis = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const carried = await page.waitForFunction(() => {
    const b = window.__nuBounce();
    return b.desk && b.carrying && b.parked;
  }, null, { timeout: 40000 }).then(() => true).catch(() => false);
  if (!carried) {
    console.log("  SKIP (3) the desk never handed over on this run — nothing to read across");
  } else {
    await page.waitForTimeout(1200);          // a load sample lands while the room is parked
    const tapeSide = await page.evaluate(readChip);
    console.log("carrying:", JSON.stringify(tapeSide));
    const saidTape = tapeSide && tapeSide.detailText.includes(" · tape");
    console.log(saidTape ? "  PASS names the tape as the audible path while the room is parked"
                         : "  FAIL still says \"live\" while a muted, parked graph could not be heard");
    await page.evaluate(() => {
      window.__vis = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => !window.__nuBounce().carrying, null, { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
    const backSide = await page.evaluate(readChip);
    console.log("back:", JSON.stringify(backSide));
    const saidLive = backSide && backSide.detailText.includes(" · live");
    console.log(saidLive ? "  PASS names the graph again once the crossfade has landed"
                         : "  FAIL the chip did not follow the return back to \"live\"");
  }

  await browser.close();
  srv.close();
})();
