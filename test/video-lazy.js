#!/usr/bin/env node
// test/video-lazy.js — NOT ONE BYTE OF FILM UNTIL THE VIDEO TAB IS OPENED.
//
//   node test/video-lazy.js [--page http://127.0.0.1:PORT/nukernel/index.html]
//
// Paul, 2026-09-01: "Don't download video until I go to the video tab."
//
// MEASURED BEFORE THIS GATE WAS WRITTEN, ON THE DEPLOYED PAGE, IT ALREADY DID:
// zero .mp4 requests on load, zero after pressing play, and the first two only
// when `__eightTab("Video")` mounts the deck. So this gate does not fix a
// defect — it converts an ACCIDENT INTO A LAW. The deferral today is a side
// effect of the tab builder being lazy (`ui/eight.js` Video: mountVideo), and
// nothing anywhere states that the clips must not be preloaded, precached or
// warmed. One `<link rel=preload>`, one entry added to the offline hold, one
// eager `new Image()`-style warm and the page would quietly start pulling
// megabytes of 1920s film on a phone, and every other gate would stay green.
//
// THE NUMBERS THAT MAKE IT WORTH A GATE. `ui/video-clips.js` lists clips of
// 0.4-3.7 MB each; the deck mounts two at once and takes another every four
// bars. A page that warmed even a fraction of that on load would cost more than
// the whole band does (measured: 4.4 MB of audio on a cold load of Vancouver
// 1986, and 0.00 MB of video).
//
// TEST THE ARTIFACT. Nothing below reads video.js. It counts REQUESTS the
// browser actually made, in three phases, and the phases are the sentence:
// load, play, then the tab.
//
// WHAT IS ASSERTED
//   V1  zero video requests on a cold load, with no tab opened and no play
//   V2  zero video requests after pressing play — the record sounds without film
//   V3  opening the Video tab DOES fetch (the deferral is real, not a dead deck)
//   V4  leaving the tab stops the fetching again
//   V5  zero pageerrors across the whole run
"use strict";
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const BORROW = "/home/ford/ftrain-2025/node_modules";
// the shell build 1200 chromium.launch() resolves is not installed here; these
// two are (PROGRAM.md §5's own note on the borrowed playwright)
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
  let phase = "load";
  const got = { load: [], play: [], tab: [], left: [] };
  page.on("request", (r) => {
    const u = r.url();
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) got[phase].push(u.split("/").pop());
  });

  await page.goto(PAGE + "#at=Vancouver&y=1986", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  console.log("V1 — a cold load, no tab, no play");
  ok(got.load.length === 0, "zero video requests on load", got.load.join(" "));

  phase = "play";
  await page.evaluate(() => { const b = document.querySelector("#play"); if (b) b.click(); });
  await page.waitForTimeout(7000);
  console.log("\nV2 — the record plays, and it plays without film");
  ok(got.play.length === 0, "zero video requests after pressing play", got.play.join(" "));

  phase = "tab";
  const on = await page.evaluate(() => window.__eightTab("Video"));
  await page.waitForTimeout(12000);
  console.log("\nV3 — the tab is what fetches (or the deferral is a dead deck)");
  ok(on === "Video", "the Video tab opened", String(on));
  ok(got.tab.length > 0, "opening the tab DOES fetch film", "0 requests — the deck may be dead");

  phase = "left";
  await page.evaluate(() => window.__eightTab("Band"));
  await page.waitForTimeout(20000);
  console.log("\nV4 — and leaving it stops again");
  ok(got.left.length === 0, "zero video requests after leaving the tab", got.left.join(" "));

  console.log("\nV5 — nothing threw");
  ok(errs.length === 0, "zero pageerrors", errs.slice(0, 3).join(" | "));

  console.log("\ncounts: load " + got.load.length + " · play " + got.play.length +
              " · on-tab " + got.tab.length + " · after-leaving " + got.left.length);
  console.log(fails ? "FAIL " + fails + " of " + checks : "PASS " + checks + " checks");
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
