#!/usr/bin/env node
// test/browser/embed-audio.test.js — THE EMBED IS AUDIBLE. The gate that decides whether the
// embed ships at all.
//
//   node test/browser/embed-audio.test.js
//
// THE BUG THIS EXISTS FOR. stellate's default live engine is a ring of
// SharedArrayBuffers read by an AudioWorklet. A SharedArrayBuffer only exists on
// a CROSS-ORIGIN ISOLATED page (COOP:same-origin + COEP:require-corp, all the way
// up the frame chain). Our own origin sends those headers — but an <iframe> on
// somebody else's blog inherits THEIR (non-)isolation, so inside an embed
// `SharedArrayBuffer` is undefined and engine/faust/live/live.js throws
//   "FaustLive: SharedArrayBuffer unavailable (page must be cross-origin isolated…)"
// …and the embed is a silent black box. app/audio/live.js's NO-ISOLATION FALLBACK
// answers that by routing to the WAV-FIRST path (exploreLiveWav — a real <audio>
// element fed rendered media segments, no SAB anywhere) whenever isolation is
// missing, on any platform. This gate proves the fallback actually makes sound.
//
// WHY IT IS A HONEST TEST OF "CROSS-ORIGIN". Two servers, two origins:
//   PARENT  http://127.0.0.1:8801  — a bare host page, NO COOP/COEP headers
//   CHILD   http://localhost:8802  — the real repo, COOP/COEP exactly as nginx
//                                    sends them (probe-harness serve())
// Different scheme-host-port => a genuine cross-origin frame. The parent is not
// isolated, so the child frame is not isolated either, no matter what headers the
// child itself sends — which is precisely the production situation. The probe
// asserts that condition before it asserts anything else, so it can never pass
// by accidentally testing an isolated page.
//
// WHAT IT ASSERTS
//   1. the framed page really is NOT cross-origin isolated (SAB missing/unusable)
//   2. app/audio/live.js chose the WAV route automatically (window.__AUDIOROUTE.wavOut)
//   3. NO AUTOPLAY: nothing is live until the play affordance is clicked
//   4. after a real click on #embedPlay: an engine handle, a wav-family
//      outputRoute, and REAL RMS above the engine's own first-sound threshold
//   5. ?genre= landed (the embed points where the URL says)
//   6. no "SharedArrayBuffer" error anywhere in the console
//   7. CONTROL: the same build, loaded TOP-LEVEL on the isolated origin, still
//      reports SAB available — i.e. the fallback did not quietly demote desktop.
"use strict";
const http = require("http");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");

const CHILD_PORT = 8802, PARENT_PORT = 8801;
const CHILD_ORIGIN = `http://localhost:${CHILD_PORT}`;
const PARENT_ORIGIN = `http://127.0.0.1:${PARENT_PORT}`;
const EMBED_QS = "?genre=jungle&seed=7";
const RMS_FLOOR = 0.0008;          // the same threshold app/audio/live.js calls "real sound"
const PLAY_TIMEOUT_MS = 75000;     // the WAV route renders + encodes before it plays

// the host page: a plain, un-isolated third-party site with one <iframe>.
function parentHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>a third-party page</title></head>
<body style="margin:0;background:#fff">
<h1>Somebody's blog</h1>
<iframe id="f" src="${CHILD_ORIGIN}/embed.html${EMBED_QS}"
  title="STELLATE — draw a path through genre space"
  width="100%" height="480" loading="eager"
  allow="autoplay; clipboard-write"
  referrerpolicy="strict-origin-when-cross-origin"
  style="border:0;width:820px;height:480px"></iframe>
</body></html>`;
}
function serveParent(port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      // deliberately NO COOP/COEP here — that is the whole point of the gate.
      rsp.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      rsp.end(parentHtml());
    });
    srv.listen(port, () => res(srv));
  });
}

// OFFLINE ROUTE, two-origin flavour. probe-harness's installOfflineRoute keys on
// ONE localhost port; this run has two origins, so it carries its own copy of the
// same policy: our two servers pass through, esm.sh/CDN module URLs get a valid
// stub module, everything else (Google Fonts) gets an empty 200.
const MODULE_STUB =
  "export const h=()=>null;export const render=()=>null;export const Fragment=()=>null;export default function(){return null;};";
async function installTwoOriginOfflineRoute(page) {
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(CHILD_ORIGIN) || u.startsWith(PARENT_ORIGIN)) return route.continue();
    if (u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    if (/(?:esm\.sh|esm\.run|unpkg\.com|cdn\.skypack\.dev)/.test(u) || /\.m?js(?:\?|$)/.test(u))
      return route.fulfill({ status: 200, contentType: "text/javascript", body: MODULE_STUB });
    return route.fulfill({ status: 200, contentType: "text/css", body: "" });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function frameEval(frame, fn, arg) {
  try { return await frame.evaluate(fn, arg); } catch (e) { return { evalFail: String(e && e.message || e) }; }
}

(async () => {
  const childSrv = await serve(process.cwd(), CHILD_PORT);
  const parentSrv = await serveParent(PARENT_PORT);
  const browser = await launchChromium({ requireChromium: true });
  const fails = [], notes = [];

  // ── PASS 1: the framed embed ───────────────────────────────────────────────
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await installTwoOriginOfflineRoute(page);
  await page.goto(`${PARENT_ORIGIN}/`, { waitUntil: "domcontentloaded", timeout: 40000 });

  const fh = await page.waitForSelector("#f", { timeout: 20000 });
  const frame = await fh.contentFrame();
  if (!frame) { console.error("FAIL: no child frame"); process.exit(1); }

  // wait for the app to boot inside the frame
  let booted = false;
  for (let i = 0; i < 120 && !booted; i++) {
    booted = await frameEval(frame, () => !!(window.__X && window.__EMBED && window.__S && window.__S.playing)) === true;
    if (!booted) await wait(250);
  }
  if (!booted) fails.push("the embed never booted inside the cross-origin frame");

  const iso = await frameEval(frame, () => ({
    origin: location.origin,
    parentOrigin: (() => { try { return window.parent.location.origin; } catch (e) { return "(opaque — cross-origin, as intended)"; } })(),
    sabType: typeof SharedArrayBuffer,
    crossOriginIsolated: !!self.crossOriginIsolated,
    route: window.__AUDIOROUTE || null,
    genre: window.__EMBED ? window.__EMBED.genre() : null,
    overlay: window.__EMBED ? window.__EMBED.overlay() : null,
    live: !!(window.__S && window.__S.live),
  }));
  console.log("embed-audio-run — STELLATE inside a cross-origin iframe");
  console.log("  frame: " + JSON.stringify(iso));

  // 1. genuinely NOT isolated
  const notIsolated = iso.sabType === "undefined" || iso.crossOriginIsolated === false;
  if (!notIsolated) fails.push("the framed page IS cross-origin isolated — this gate is not testing the embed case");
  // 2. the fallback engaged
  if (!(iso.route && iso.route.wavOut === true))
    fails.push("app/audio/live.js did not auto-select the WAV route (__AUDIOROUTE=" + JSON.stringify(iso.route) + ")");
  // 3. no autoplay
  if (iso.live) fails.push("AUTOPLAY: the embed went live without a user gesture");
  if (iso.overlay !== true) fails.push("the play affordance (#embedPlay) is not showing on a fresh embed");
  // 5. ?genre= landed
  if (iso.genre !== "jungle") fails.push('?genre=jungle did not land (got ' + JSON.stringify(iso.genre) + ")");

  // 4. CLICK PLAY — a real trusted input event on the affordance, then wait for sound.
  console.log("  clicking #embedPlay inside the frame…");
  try { await frame.click("#embedPlay", { timeout: 15000 }); }
  catch (e) { fails.push("could not click #embedPlay: " + e.message); }

  let maxRms = 0, route = null, firstSoundMs = null, samples = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < PLAY_TIMEOUT_MS) {
    const s = await frameEval(frame, () => {
      const h = window.__X && window.__X.handle && window.__X.handle();
      let r = 0, rt = null;
      try { r = h ? +h.rms() : 0; } catch (e) {}
      try { rt = h ? (typeof h.outputRoute === "function" ? h.outputRoute() : h.outputRoute) : null; } catch (e) {}
      return { rms: r, route: rt, live: !!(window.__S && window.__S.live), bars: (window.__S && window.__S.barCount) || 0 };
    });
    samples++;
    if (s && !s.evalFail) {
      if (s.route) route = s.route;
      if (s.rms > maxRms) maxRms = s.rms;
      if (s.rms > RMS_FLOOR && firstSoundMs == null) firstSoundMs = Date.now() - t0;
    }
    if (firstSoundMs != null && Date.now() - t0 > (firstSoundMs + 4000)) break;   // heard it, and it kept going
    await wait(400);
  }
  const finalState = await frameEval(frame, () => ({
    live: !!(window.__S && window.__S.live), bars: (window.__S && window.__S.barCount) || 0,
    status: (window.__S && window.__S.status) || "", overlay: window.__EMBED ? window.__EMBED.overlay() : null,
  }));
  console.log(`  route=${route}  maxRms=${maxRms.toFixed(5)}  firstSound=${firstSoundMs == null ? "NEVER" : (firstSoundMs / 1000).toFixed(1) + "s"}  samples=${samples}`);
  console.log("  after play: " + JSON.stringify(finalState));

  if (maxRms <= RMS_FLOOR)
    fails.push(`THE EMBED IS SILENT — max RMS ${maxRms.toFixed(6)} <= ${RMS_FLOOR} after ${(PLAY_TIMEOUT_MS / 1000) | 0}s (status: ${finalState.status})`);
  if (!route) fails.push("no engine handle / outputRoute inside the frame after play");
  else if (!/^(mms-|mse-|segAB|wav)/.test(String(route)))
    fails.push(`outputRoute "${route}" is not a WAV-family route — the ring path cannot work in a frame`);
  if (finalState.overlay === true) notes.push("the play overlay came back (playback stopped) — check the status line above");

  // 6. the specific error this whole change exists to prevent
  const sabErr = errs.filter((e) => /SharedArrayBuffer/i.test(e));
  if (sabErr.length) fails.push("SharedArrayBuffer error(s) in the framed embed: " + JSON.stringify(sabErr));
  const otherErrs = errs.filter((e) => !/SharedArrayBuffer/i.test(e));
  if (otherErrs.length) notes.push(otherErrs.length + " other console/page error(s): " + JSON.stringify(otherErrs.slice(0, 6)));
  await page.close();

  // ── PASS 2 (CONTROL): top-level on the isolated origin still has its SAB ────
  // The fallback must be a FALLBACK: on stellate.app itself (COOP/COEP served,
  // no frame) the ring/worklet path must remain the default, or this change
  // silently demoted every desktop listener to the mobile route.
  const ctl = await browser.newPage();
  await installTwoOriginOfflineRoute(ctl);
  await ctl.goto(`${CHILD_ORIGIN}/index.html`, { waitUntil: "domcontentloaded", timeout: 40000 });
  let ctlRoute = null;
  for (let i = 0; i < 60; i++) {
    ctlRoute = await ctl.evaluate(() => window.__AUDIOROUTE || null).catch(() => null);
    if (ctlRoute) break;
    await wait(250);
  }
  console.log("  CONTROL (top-level, isolated): " + JSON.stringify(ctlRoute));
  if (!ctlRoute) fails.push("CONTROL: index.html never published window.__AUDIOROUTE");
  else {
    if (ctlRoute.sab !== true) notes.push("CONTROL: the top-level page has no SAB either (headless chromium isolation quirk) — the desktop-unchanged half of the contract is unproven on this box");
    else if (ctlRoute.wavOut !== undefined)
      fails.push("CONTROL: the isolated top-level page was pushed onto the WAV route (wavOut=" + ctlRoute.wavOut + ") — the fallback demoted desktop");
  }
  await ctl.close();

  await browser.close(); childSrv.close(); parentSrv.close();

  console.log("");
  for (const n of notes) console.log("  *** NOTICE (not a failure): " + n);
  if (fails.length) {
    for (const f of fails) console.log("  ✗ " + f);
    console.log(`\nembed-audio-run: FAIL — ${fails.length} problem(s)`);
    process.exit(1);
  }
  console.log("embed-audio-run: PASS — the cross-origin embed auto-routed around the missing SharedArrayBuffer, waited for a real gesture, and made sound (max RMS " + maxRms.toFixed(4) + " on " + route + ")");
  process.exit(0);
})().catch((e) => { console.error("embed-audio-run: THREW — " + (e && e.stack || e)); process.exit(1); });
