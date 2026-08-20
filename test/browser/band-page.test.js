#!/usr/bin/env node
// test/browser/band-page.test.js — THE BAND, on the real page.
//
// band-kit.test.js proves the model in node. This one proves the ARTIFACT:
// that what the arranger calls reaches the engine, that the chair you are
// sitting in is the chair that gets asked (it did not, once — the drums seat
// handed you the arranger's next question with the drummer's name over it),
// and that "one hit every four bars" really is one hit every four bars in
// the bar the engine is handed, not just in the model.
"use strict";
const path = require("path");
const { launchBrowser, serve, capturePageErrors } =
  require(path.join(process.cwd(), "test/lib/probe-harness.js"));
let checks = 0, fails = 0;
const ok = (b, msg) => { checks++; if (!b) { fails++; console.log("  ✗ " + msg); } };

(async () => {
  const srv = await serve(process.cwd(), 8829);
  const browser = await launchBrowser("chromium");
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = capturePageErrors(page);
  await page.addInitScript(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const W = function (...a) {
      const c = new AC(...a), an = c.createAnalyser(); an.fftSize = 2048;
      const o = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (d, ...r) {
        if (d === c.destination) { try { o.call(this, an); } catch (e) {} }
        return o.call(this, d, ...r); };
      window.__rms = () => { const b = new Float32Array(an.fftSize);
        an.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v;
        return Math.sqrt(s / b.length); };
      return c; };
    W.prototype = AC.prototype; window.AudioContext = W; window.webkitAudioContext = W;
  });
  await page.goto(`http://localhost:${srv.port}/nukernel/band.html`,
                  { waitUntil: "networkidle", timeout: 60000 });

  const q = () => page.evaluate(() => [...document.querySelectorAll(".dq")].map(x => x.textContent));
  const opts = () => page.evaluate(() => [...document.querySelectorAll(".dopt")]
    .map(x => ({ w: x.textContent, dead: !!x.disabled })));
  const tap = async (w) => { const hit = await page.evaluate((x) => {
      const b = [...document.querySelectorAll(".dopt, .dchip")]
        .find(e => e.textContent === x && !e.disabled);
      if (b) { b.click(); return true; } return false; }, w);
    await page.waitForTimeout(320); return hit; };
  const seat = async (name) => { await page.evaluate((n) => {
      const b = [...document.querySelectorAll(".dseat")].find(x => x.textContent.startsWith(n));
      if (b) b.click(); }, name); await page.waitForTimeout(320); };
  const plan = () => page.evaluate(async () => {
    const PL = await import("/nukernel/audio/plan.js"); PL.compile();
    const out = { bars: PL.barCount(), drums: 0, pitched: 0, kicks: [] };
    for (let i = 0; i < PL.barCount(); i++) {
      const p = PL.barPlan(i);
      out.drums += p.ev.drums.length; out.pitched += p.ev.pitched.length;
      if (p.ev.drums.some(e => e.drum === "kick")) out.kicks.push(i);
    }
    return out; });

  // ── THE FIRST QUESTION IS WHAT WE ARE PLAYING ──
  ok(await tap("count it in"), "the session will not start");
  ok((await q())[0] === "what are we playing?",
     "the band's first question is \"" + (await q())[0] + "\"");
  const records = (await opts()).map(o => o.w);
  ok(records.length >= 8, "only " + records.length + " records to call");
  ok(records.includes("a jazz date"), "you cannot call a jazz date");
  ok(await tap("a jazz date"), "calling the record was refused");

  // ── THE CALL REACHES THE PLAYERS ──
  await seat("drums");
  const dq = (await q())[0] || "";
  ok(!/key|form|how fast|changes/.test(dq),
     "in the drums chair the drummer is asked \"" + dq + "\" — that is the arranger's question");
  // ...and the groove the record picked is on their sheet, still theirs to
  // change — narrowed to the three a jazz date has
  await page.evaluate(() => { const f = [...document.querySelectorAll(".dfact")]
    .find(x => (x.querySelector("b") || {}).textContent === "groove"); if (f) f.click(); });
  await page.waitForTimeout(300);
  const grooves = (await opts()).map(o => o.w);
  ok(grooves.length >= 2, "the drummer is left " + grooves.length + " groove");
  ok(grooves.every(w => ["jazz ride", "bebop", "brush swing"].includes(w)),
     "a jazz date offers " + grooves.join("/"));
  ok((await opts()).some(o => o.w === grooves[0]), "the groove question is not answerable");
  await tap(grooves[0]);
  await seat("bass");
  const bq = (await q())[0] || "";
  ok(!/key|form|how fast|what are the/.test(bq),
     "in the bass chair the bassist is asked \"" + bq + "\"");

  // ── THE SPARSEST THING A BAND CAN DO ──
  await seat("arranger");
  for (let i = 0; i < 16; i++) {                       // answer the tune out
    const cur = (await q())[0] || "";
    if (/how much space/.test(cur)) break;
    const list = (await opts()).filter(o => !o.dead);
    if (!list.length) break;
    await tap(list[0].w);
  }
  ok(/how much space/.test((await q())[0] || ""),
     "the arranger is never asked how much space there is");
  const busy = await plan();
  ok(await tap("one hit every four bars"), "the sparsest setting was refused");
  await page.waitForTimeout(500);
  const sparse = await plan();
  ok(sparse.drums < busy.drums, "asking for space changed nothing: " +
     JSON.stringify({ busy: busy.drums, sparse: sparse.drums }));
  ok(sparse.drums === Math.ceil(sparse.bars / 4),
     sparse.bars + " bars came out with " + sparse.drums + " drum hits, not one per four");
  ok(sparse.pitched === Math.ceil(sparse.bars / 4),
     sparse.bars + " bars came out with " + sparse.pitched + " bass notes, not one per four");
  ok(sparse.kicks.every((b, i) => b === i * 4),
     "the hits land on bars " + sparse.kicks.join(",") + " — not every fourth one");

  // ── AND IT STILL SOUNDS ──
  let rms = 0;
  for (let i = 0; i < 22; i++) { await page.waitForTimeout(900);
    rms = Math.max(rms, await page.evaluate(() => (window.__rms ? window.__rms() : -1)));
    if (rms > 0.02) break; }
  ok(rms > 0.004, "the band went silent (peak RMS " + rms.toFixed(4) + ")");
  ok(errs.length === 0, "page errors: " + JSON.stringify(errs.slice(0, 2)));
  console.log("  peak RMS " + rms.toFixed(4) + " · " + sparse.bars + " bars, " +
              sparse.drums + " hits, " + sparse.pitched + " notes");

  await browser.close();
  console.log(fails ? `\nband-page: FAIL — ${fails} of ${checks}`
    : `\nband-page: PASS — ${checks} checks (the genre is called first, the chair you sit in is the one asked, the space reaches the engine, it sounds)`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("band-page: CRASH — " + (e && e.stack || e)); process.exit(1); });
