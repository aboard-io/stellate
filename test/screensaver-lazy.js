#!/usr/bin/env node
// test/screensaver-lazy.js — NOT ONE FRAME OF SKY UNTIL THE TAB IS OPENED,
// AND NOT ONE AFTER YOU LEAVE.
//
//   node test/screensaver-lazy.js [--page http://127.0.0.1:PORT/nukernel/index.html]
//
// Paul, 2026-09-01: "Bring back the screensaver from stellate as a new view
// like the video view." The video view's law (test/video-lazy.js) is written
// in REQUESTS, because film is megabytes; the screensaver fetches nothing
// ever (its sky is arithmetic — ui/screensaver.js, OFFLINE LAW), so its
// currency is FRAMES. The failure this gate exists to catch is the quiet one:
// a rAF loop that keeps ticking under a shut panel, 60 times a second,
// forever, with nothing on screen to show for it. ui/screensaver.js parks its
// loop on the host's `data-off` via a MutationObserver; this gate measures
// that both edges of that switch actually happen, off `window.__saverFrames`
// (the counter idiom the old chart's `__pulseFrames` established).
//
// TEST THE ARTIFACT: nothing below reads screensaver.js. It counts frames the
// page actually ran and reads the drift the transport actually delivered.
//
// WHAT IS ASSERTED
//   S1  cold load, record playing: the counter does not exist — zero work,
//       zero rAF, before the tab is opened
//   S2  opening the tab mounts a live canvas and the frames ADVANCE
//   S3  the transport ARRIVES: __saverDrift grows while the record plays
//       (declared-but-never-arriving is this box's characteristic bug)
//   S4  leaving the tab STOPS the loop — the counter freezes
//   S5  coming back revives it (the observer works both ways)
//   S6  the tab fetched no media/imagery/fonts — the sky is arithmetic
//   S7  zero pageerrors across the whole run
"use strict";
const path = require("path");
const BORROW = "/home/ford/ftrain-2025/node_modules";
const EXE = process.env.HOME + "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
const { chromium } = require(path.join(BORROW, "playwright"));

const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PAGE = argOf("--page", "http://localhost:8777/nukernel/index.html");

let checks = 0, fails = 0;
const ok = (cond, what, saw) => {
  checks++;
  if (cond) { console.log("  ok   " + what); return; }
  fails++;
  console.log("  FAIL " + what + (saw == null ? "" : "\n       saw: " + saw));
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  let onTab = false;
  const tabReqs = [];
  page.on("request", (r) => {
    const u = r.url();
    if (onTab && /\.(png|jpe?g|gif|webp|svg|woff2?|ttf|mp4|webm)(\?|$)/i.test(u))
      tabReqs.push(u.split("/").pop());
  });

  await page.goto(PAGE + "#at=Vancouver&y=1986", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { const b = document.querySelector("#play"); if (b) b.click(); });
  await page.waitForTimeout(5000);
  console.log("S1 — a cold load, the record playing, the tab never opened");
  const f0 = await page.evaluate(() => window.__saverFrames);
  ok(f0 === undefined, "no frame counter exists — zero rAF before the tab", String(f0));

  onTab = true;
  const on = await page.evaluate(() => window.__eightTab("Screensaver"));
  await page.waitForTimeout(1200);
  console.log("\nS2 — the tab mounts and animates");
  ok(on === "Screensaver", "the Screensaver tab opened", String(on));
  const canv = await page.evaluate(() =>
    !!document.querySelector("#saverdeck .nu-saver-canvas"));
  ok(canv, "a canvas is on the panel");
  const a1 = await page.evaluate(() => window.__saverFrames);
  await page.waitForTimeout(1000);
  const a2 = await page.evaluate(() => window.__saverFrames);
  ok(a2 > a1 && a1 > 0, "frames advance while the tab is open",
     a1 + " -> " + a2);

  console.log("\nS3 — the transport arrives at the field");
  const d1 = await page.evaluate(() => window.__saverDrift);
  await page.waitForTimeout(2500);
  const d2 = await page.evaluate(() => window.__saverDrift);
  ok(typeof d1 === "number" && d2 > d1,
     "the field drifted while the record played", d1 + " -> " + d2);

  console.log("\nS4 — leaving the tab stops the loop");
  onTab = false;
  await page.evaluate(() => window.__eightTab("Band"));
  await page.waitForTimeout(300);            // let the parking edge land
  const b1 = await page.evaluate(() => window.__saverFrames);
  await page.waitForTimeout(1500);
  const b2 = await page.evaluate(() => window.__saverFrames);
  ok(b2 === b1, "the frame counter froze after leaving", b1 + " -> " + b2);

  console.log("\nS5 — and coming back revives it");
  await page.evaluate(() => window.__eightTab("Screensaver"));
  await page.waitForTimeout(1000);
  const c1 = await page.evaluate(() => window.__saverFrames);
  ok(c1 > b2, "frames advance again on return", b2 + " -> " + c1);

  console.log("\nS6 — the sky is arithmetic: the tab fetched no media");
  ok(tabReqs.length === 0, "zero image/font/media requests while on the tab",
     tabReqs.slice(0, 5).join(" "));

  console.log("\nS7 — nothing threw");
  ok(errs.length === 0, "zero pageerrors", errs.slice(0, 3).join(" | "));

  console.log(fails ? "FAIL " + fails + " of " + checks : "PASS " + checks + " checks");
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
