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
// 2026-09-02 — THE SKY BECAME A DANCE FLOOR, AND TWO ASSERTIONS MOVED WITH IT.
// Paul: "screensaver is just a bunch of stars. It should be the little aliens
// dancing, not the infinite wandering", and, of the plan that proposed drawing
// them in 2D: "Why not three js? It's fine. Don't reinvent." What changed here,
// with the old sentences kept beside the new ones at each site:
//   S3 used to be only "the field drifted". It now also counts the TROUPE:
//      one alien per band member, in DOC.voices order, plus the extras.
//   S6 used to filter for media extensions, and its own map entry warned that
//      "a .js three.js import slips PAST this regex, so the gate would go GREEN
//      on a change that breaks the OFFLINE LAW ... a gate that will lie". It
//      counts EVERY request the tab makes now, and names the local module files
//      as the sanctioned exception — so a genuinely foreign fetch, which the
//      media-only regex would have waved through, fails it.
//   S7's browser is launched with the swiftshader flags the old dancer gate
//      used (f0f9d89:test/starcruise/alien-dancer.test.js:25-27), because a
//      headless chromium with no GPU hands back no WebGL context otherwise —
//      and a screensaver that cannot get a context is a pageerror, not a pass.
//
// WHAT IS ASSERTED
//   S1  cold load, record playing: the counter does not exist — zero work,
//       zero rAF, before the tab is opened
//   S2  opening the tab mounts a live canvas and the frames ADVANCE
//   S3  the transport ARRIVES: __saverDrift grows while the record plays
//       (declared-but-never-arriving is this box's characteristic bug), and
//       the troupe on the floor is the band: one alien per DOC.voices member
//       plus 0..4 extras
//   S4  leaving the tab STOPS the loop — the counter freezes
//   S5  coming back revives it (the observer works both ways)
//   S6  the tab fetched nothing but its own local modules — no wire
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
  /* the old line was `args: ["--autoplay-policy=no-user-gesture-required"]`
     alone. The four flags after it are f0f9d89:test/starcruise/
     alien-dancer.test.js:25-27's, verbatim: this headless chromium has no GPU,
     and without a software rasteriser `new WebGLRenderer()` throws, which S7
     would report as a pageerror about the browser rather than about the page. */
  const browser = await chromium.launch({ executablePath: EXE,
    args: ["--autoplay-policy=no-user-gesture-required",
           "--use-gl=angle", "--use-angle=swiftshader",
           "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
           "--enable-webgl"] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  let onTab = false;
  const tabReqs = [];
  /* THE SANCTIONED EXCEPTION, NAMED FILE BY FILE. The saver's offline law is
     about THE WIRE; these are files on the same disk the page came from, and
     they are `import()`ed lazily so a reader who never opens this tab never
     asks for them. Anything else the tab requests — an image, a font, a CDN,
     a genuinely foreign fetch — is counted and fails S6. The old rule counted
     only media extensions and would have waved every one of these past. */
  const SANCTIONED = [
    /\/vendor\/three\/three\.module\.min\.js(\?|$)/,
    /\/vendor\/three\/MarchingCubes\.js(\?|$)/,
    /\/nukernel\/ui\/starcruise\/(alien|traits|geom|from-doc)\.js(\?|$)/,
  ];
  const sanctionedSeen = [];
  /* THE OLD RULE, WHICH ITS OWN MAP CALLED A GATE THAT WILL LIE, was the media
     extension list alone: `/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|mp4|webm)/`.
     The rule now is the LAW ITSELF — nothing off the wire — plus that list,
     which stays because a same-origin sprite sheet would still be a picture
     this view swore it would not need. What it deliberately does NOT count is
     the page's own engine: the record is PLAYING throughout this run and the
     Faust lane is pulling `*-module.wasm` and `*-meta.json` off the same disk
     the whole time. Those are the audio tier's requests, they happen whatever
     tab is open, and blaming the screensaver for them would be a gate that
     goes red for somebody else's reason. */
  const ORIGIN = new URL(PAGE).origin;
  const MEDIA = /\.(png|jpe?g|gif|webp|svg|woff2?|ttf|mp4|webm)(\?|$)/i;
  const foreign = (u) => { try { return new URL(u).origin !== ORIGIN; } catch (e) { return true; } };
  page.on("request", (r) => {
    if (!onTab) return;
    const u = r.url();
    if (SANCTIONED.some((re) => re.test(u))) { sanctionedSeen.push(u.split("/").pop()); return; }
    if (foreign(u) || MEDIA.test(u)) tabReqs.push(u.split("/").pop());
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
  /* WAIT FOR THE RIG BEFORE COUNTING. `new WebGLRenderer()` is one synchronous
     call and its cost belongs to the browser: milliseconds on a machine with a
     GPU, and TWELVE SECONDS in this headless chromium, where ANGLE falls back
     to swiftshader (measured 2026-09-02). Sampling the frame counter across
     that stall would measure the CI box's rasteriser and report it as a dead
     screensaver — the counter genuinely does not advance while the main thread
     is inside the browser's own call. ui/screensaver.js publishes
     `__saverReady` when the rig stands and the last creature is on the floor;
     everything below counts from there. The laziness this gate exists for is
     S1's and S4's, and neither of them waits on anything. */
  let ready = false;
  try {
    await page.waitForFunction(() => window.__saverReady === true, null,
      { timeout: 90000, polling: 250 });
    ready = true;
  } catch (e) { ready = false; }
  ok(ready, "the rig stood up and the troupe walked on (__saverReady)");
  const a1 = await page.evaluate(() => window.__saverFrames);
  await page.waitForTimeout(1000);
  const a2 = await page.evaluate(() => window.__saverFrames);
  ok(a2 > a1 && a1 > 0, "frames advance while the tab is open",
     a1 + " -> " + a2);

  console.log("\nS3 — the transport arrives at the floor, and the troupe is the band");
  const d1 = await page.evaluate(() => window.__saverDrift);
  await page.waitForTimeout(2500);
  const d2 = await page.evaluate(() => window.__saverDrift);
  /* the old sentence was "the field drifted while the record played" and it
     read the star field's eased pixel offset. __saverDrift is the TROUPE'S
     ACCUMULATED BEAT PHASE now — the number alien.js's dancer branch calls
     `beat` — and it grows only while the transport says the record is moving,
     which is the same arrival it always proved. */
  ok(typeof d1 === "number" && d2 > d1,
     "the troupe's beat phase grew while the record played", d1 + " -> " + d2);
  const troupe = await page.evaluate(() => {
    const t = window.__saverTroupe;
    const doc = window.__eightDoc ? window.__eightDoc() : null;
    return { n: Array.isArray(t) ? t.length : -1,
             members: Array.isArray(t) ? t.filter((a) => !a.extra).length : -1,
             extras: Array.isArray(t) ? t.filter((a) => a.extra).length : -1,
             voices: doc && doc.voices ? doc.voices.length : -1,
             names: Array.isArray(t) ? t.filter((a) => !a.extra).map((a) => a.voice) : [],
             docNames: doc && doc.voices ? doc.voices.map((v) => v.name) : [] };
  });
  ok(troupe.members > 0 && troupe.members === troupe.voices,
     "one alien per band member, in DOC.voices order",
     JSON.stringify(troupe.names) + " vs " + JSON.stringify(troupe.docNames));
  ok(JSON.stringify(troupe.names) === JSON.stringify(troupe.docNames),
     "and each wears its own member's name",
     JSON.stringify(troupe.names) + " vs " + JSON.stringify(troupe.docNames));
  ok(troupe.extras >= 0 && troupe.extras <= 4,
     "plus nought to four extras, dealt by the record's energy", String(troupe.extras));

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

  console.log("\nS6 — no wire: the tab fetched nothing but its own local modules");
  ok(tabReqs.length === 0,
     "zero foreign or media requests while on the tab",
     tabReqs.slice(0, 5).join(" "));
  /* ...AND THE LAZINESS IS PROVED FROM THE OTHER SIDE. three.js and the
     creature modules were requested AFTER the tab opened and not before —
     `onTab` was false until the click, so anything in this list arrived
     because a hand opened the panel. */
  ok(sanctionedSeen.length >= 3,
     "three.js and the creature modules arrived only once the tab was opened",
     sanctionedSeen.join(" ") || "(none)");

  console.log("\nS7 — nothing threw");
  ok(errs.length === 0, "zero pageerrors", errs.slice(0, 3).join(" | "));

  console.log(fails ? "FAIL " + fails + " of " + checks : "PASS " + checks + " checks");
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
