#!/usr/bin/env node
// test/browser/audit-gate.test.js — the AUDIT-TRUTH instrument gate: track when a node is
// expected to produce sound and doesn't. Proves the per-voice
// expected-vs-actual audit actually CATCHES a silenced voice: we drive the
// real live WAV path (mp3 route, one continuous timeline) on a sampler-heavy genre and
// PERMANENTLY drop a deterministic fraction of the sampler sample decodes. A bar baked
// without its sample buffer is expected-but-silent; the renderer measures RMS≈0 for that
// voice + records the MISSING srcId, and the conductor logs it in the downloadable audit
// ring. A/B against a NO-DROP control isolates the signal.
//
// ASSERT: (drop ON) the audit ring fills, records MISSING anomalies whose srcIds are the
// dropped samples, and the downloadable JSON contains them; (control OFF) zero missing
// anomalies (every sampler voice sounds); the instrument is SPECIFIC (healthy voices are
// NOT flagged); no double-playback leak; zero console errors.
//
//   node test/browser/audit-gate.test.js
"use strict";
const path = require("path");
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8802;

// In-page fault: PERMANENTLY reject a deterministic fraction of the pitched-sampler AND
// sampled-drum decodes (both the FaustSampler and the FoundPlayer entry points the
// conductor calls — the sampled drum one-shots come through the latter). Speech is left
// alone. dropPct=0 is the control. Records the dropped URLs for srcId correlation.
function installDrop(cfg) {
  const inj = { dropped: [], calls: 0 };
  window.__inj = inj;
  const hash = (s) => { let a = 7; for (let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) >>> 0; return a; };
  const wrap = (obj, key) => {
    if (!obj || typeof obj[key] !== "function" || obj["__wrapDrop_" + key]) return;
    const orig = obj[key]; obj["__wrapDrop_" + key] = true;
    obj[key] = function (ctx, url) {
      inj.calls++;
      if (/speech\//.test(url)) return orig.call(this, ctx, url);
      const drop = cfg.dropPct > 0 && (hash(url) % 100) < cfg.dropPct;
      if (drop) {
        if (inj.dropped.indexOf(url) < 0) inj.dropped.push(url);
        // slight delay so the boot decode-gate resolves it as a real failure, then reject forever.
        return new Promise((_, rej) => setTimeout(() => rej(new Error("audit-gate: injected permanent decode drop")), 120));
      }
      return orig.call(this, ctx, url);
    };
  };
  wrap(window.FaustSampler, "decodeUrlRaw");
  wrap(window.FoundPlayer, "decodeUrlToBuffer");
  return true;
}

// pull the live audit ring + counters off the handle (the same data the ?wavDebug
// "download audit" button serializes).
const pull = (page) => page.evaluate(() => {
  let ring = [], stats = null, ws = null;
  try { ring = window.handle.audit ? window.handle.audit() : []; } catch (e) {}
  try { stats = window.handle.auditStats ? window.handle.auditStats() : null; } catch (e) {}
  try { ws = window.handle.__wavState ? window.handle.__wavState() : null; } catch (e) {}
  const dropped = (window.__inj && window.__inj.dropped) || [];
  // reduce
  let missingAnoms = 0, silentAnoms = 0, nanAnoms = 0, healthyBars = 0;
  const missingSrcs = new Set();
  for (const e of ring) {
    let anySilent = false, anyVoice = false;
    for (const k of Object.keys(e.voices || {})) {
      const v = e.voices[k]; if (v.notes) anyVoice = true;
      if (v.silent) { anySilent = true;
        if (v.reason === "missing") { missingAnoms++; (v.missing || []).forEach((m) => missingSrcs.add(m)); }
        else if (v.reason === "nan") nanAnoms++; else silentAnoms++;
      }
    }
    if (anyVoice && !anySilent) healthyBars++;
  }
  const json = JSON.stringify(ring);   // exactly what the download button writes (bars array)
  return { bars: ring.length, stats, summary: (window.handle.auditSummary ? window.handle.auditSummary() : ""),
    missingAnoms, silentAnoms, nanAnoms, healthyBars, missingSrcs: [...missingSrcs], dropped,
    doublePlay: ws ? ws.doublePlayAnoms : null, route: ws ? ws.outputRoute : "?",
    jsonHasMissingSrc: [...missingSrcs].some((s) => json.indexOf(JSON.stringify(s)) >= 0),
    jsonLen: json.length };
});

async function runMode(browser, base, dropPct) {
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.goto(base + "&codec=mp3&decodeFirst=1&bootDecodeCap=3500&genDecodeCap=3500");
  await page.evaluate(installDrop, { dropPct });
  // jazz uses a SAMPLED brush drum kit (native one-shots) firing every bar, plus
  // sampled pitched instruments — every audited voice depends on a decoded buffer.
  await page.evaluate(() => goLive("jazz", 3));
  // let the stream boot + play long enough that many segments of bars flow through the ring
  // RIDE UNTIL THE RING HAS BARS, not for a fixed wall clock. 24 s is plenty on an idle
  // box and not always enough on a busy one — the audit ring needs BARS, and bars come
  // at the tempo the engine manages, so wait for the thing actually being measured and
  // keep the fixed timeout only as the ceiling.
  await page.waitForFunction(() => {
    try {
      const h = window.__X && window.__X.handle && window.__X.handle();
      const s = h && h.auditSummary && h.auditSummary();
      const m = /over \d+\/(\d+) bars/.exec(s || "");
      return !!m && +m[1] >= 6;
    } catch (e) { return false; }
  }, null, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const data = await pull(page);
  const T = await page.evaluate(() => stopLive());
  await page.waitForTimeout(200); await page.close();
  data.errors = [...(T.errors || []), ...errs];
  return data;
}

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const base = `http://localhost:${PORT}/test/browser/live-test.html?wavOut=1&segSec=4&firstSegSec=3`;

  console.log("\n[AUDIT] jazz seed3 (SAMPLED brush kit + sampled instruments) on the mp3 wav route…");
  const ON = await runMode(browser, base, 100);   // drop ALL sampler decodes, permanently
  const OFF = await runMode(browser, base, 0);     // control: nothing dropped

  await browser.close(); srv.close();

  const fmt = (m) => `bars=${m.bars} missing=${m.missingAnoms}(srcs ${m.missingSrcs.length}) present-silent=${m.silentAnoms} nan=${m.nanAnoms} healthyBars=${m.healthyBars} dropped=${m.dropped.length} dbl=${m.doublePlay} route=${m.route} errs=${m.errors.length}`;
  console.log(`[AUDIT] ON  (drop 100%): ${fmt(ON)}`);
  console.log(`[AUDIT]   summary: ${ON.summary}`);
  console.log(`[AUDIT]   dropped→missing srcIds in JSON: ${ON.jsonHasMissingSrc} (${ON.missingSrcs.slice(0, 6).join(", ")})`);
  console.log(`[AUDIT] OFF (control): ${fmt(OFF)}`);
  console.log(`[AUDIT]   summary: ${OFF.summary}`);

  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  // (1) the ring is populated on both runs (the instrument is recording heard bars).
  ok(ON.bars >= 4, `ON audit ring near-empty (${ON.bars} bars)`);
  ok(OFF.bars >= 4, `OFF audit ring near-empty (${OFF.bars} bars)`);
  // (2) the injected drop IS CAUGHT: missing anomalies recorded with the dropped srcIds,
  //     and those srcIds are in the downloadable JSON (the download button's payload).
  ok(ON.dropped.length > 0, `ON never actually dropped a sampler decode (${ON.dropped.length})`);
  ok(ON.missingAnoms > 0, `ON recorded ZERO missing-buffer anomalies (instrument missed the drop)`);
  ok(ON.missingSrcs.length > 0, `ON missing anomalies carry no srcIds`);
  ok(ON.jsonHasMissingSrc, `downloadable audit JSON does not contain the missing srcIds`);
  // (3) the CONTROL has zero missing anomalies AND healthy voiced bars — the SAME voices
  //     that ON flags DO sound when their buffers are present. This is the specificity /
  //     no-false-positive proof (the instrument only fires on real silence).
  ok(OFF.missingAnoms === 0, `OFF (no drop) still reported ${OFF.missingAnoms} missing anomalies (false positives)`);
  ok(OFF.healthyBars > 0, `OFF (no drop) has no healthy voiced bars — control did not actually play voices`);
  // (5) no double-playback leak in either run; no NaN blowups; zero console errors.
  ok((ON.doublePlay || 0) === 0 && (OFF.doublePlay || 0) === 0, `double-playback anomalies: ON ${ON.doublePlay} OFF ${OFF.doublePlay}`);
  ok(ON.nanAnoms === 0 && OFF.nanAnoms === 0, `NaN anomalies present (ON ${ON.nanAnoms} OFF ${OFF.nanAnoms})`);
  // A CODEC DEMOTE IS NOT A DEFECT. When the box is loaded the mp3 route can miss its
  // first-append watchdog and the engine steps down to segAB — that is the resilience
  // path working exactly as designed (live-resilience.test.js is what proves it). This
  // gate is about AUDIT TRUTH, which is route-independent, so a demote must not read as
  // a console error here. Seen for real: a full `ship.sh --prod` running alongside this
  // gate starved the boot and turned a green run red with nothing wrong in the code.
  const realErr = (m) => m.errors.filter((e) => !/archive\.org|CORS|ERR_FAILED|Failed to load resource|net::|autoplay|injected permanent decode drop|audit-gate|demote->segAB|codec ladder/i.test(e));
  ok(realErr(ON).length === 0 && realErr(OFF).length === 0, `console errors: ON [${realErr(ON).slice(0, 3)}] OFF [${realErr(OFF).slice(0, 3)}]`);

  console.log(`\n=== AUDIT GATE ===`);
  if (fails.length) console.log("FAILURES:\n  - " + fails.join("\n  - "));
  const pass = fails.length === 0;
  console.log(`AUDIT-TRUTH GATE (injected dropped buffer → missing anomaly recorded + in downloadable JSON; specific; control clean): ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
