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

  // ── THE BASS HAS A SOUND OF ITS OWN ──
  // The bass chair was handed no tone, so a synth bass ran on the engine's
  // defaults (cutoff 1400, decay 0.4) in every record there is — no filter
  // and a gate as long as the note. This asks the VOICE the engine built.
  // the unit the bass notes are actually played by — the plan names it on
  // the event, and reading "the first pitched-looking unit" found the sfx
  const voice = () => page.evaluate(async () => {
    const PL = await import("/nukernel/audio/plan.js"); PL.compile();
    const U = PL.unitTable() || {}, p = PL.barPlan(0);
    const e = p.ev.pitched[0];
    const u = e && U[e.voice];
    return { module: u ? u.module : null, params: u ? u.params : null,
             zones: u && u.sampler ? (u.sampler.zones || []).length : 0,
             dur: e ? e.dur : 0 }; });
  const asArranger = async (w) => {
    await seat("arranger");
    for (let i = 0; i < 20; i++) {
      const cur = (await q())[0] || "";
      if (/what are we playing/.test(cur)) break;
      await page.evaluate(() => { const f = [...document.querySelectorAll(".dfact")]
        .find(x => (x.querySelector("b") || {}).textContent === "genre"); if (f) f.click(); });
      await page.waitForTimeout(260);
      if (/what are we playing/.test((await q())[0] || "")) break;
      const list = (await opts()).filter(o => !o.dead);
      if (!list.length) break;
      await tap(list[0].w);
    }
    return tap(w); };
  {
    // out of the sparsest setting first — a held note is a bar long whatever
    // the record says, and the question here is the record's own sound
    await seat("arranger");
    await page.evaluate(() => { const f = [...document.querySelectorAll(".dfact")]
      .find(x => (x.querySelector("b") || {}).textContent === "space"); if (f) f.click(); });
    await page.waitForTimeout(260);
    await tap("keep it going");
    ok(await asArranger("a techno record"), "the record could not be changed");
    await page.waitForTimeout(600);
    const techno = await voice();
    ok(await asArranger("something slow and open"), "the record could not be changed again");
    await page.waitForTimeout(600);
    const slow = await voice();
    for (const [name, v] of [["techno", techno], ["slow", slow]]) {
      ok(!!v.params, name + ": the bass voice has no params at all");
      if (!v.params) continue;
      ok(v.params.cutoff !== 1400, name + ": the bass is still on the engine's default cutoff");
      ok(v.dur > 0, name + ": the bass note has no length");
    }
    ok(techno.params && slow.params &&
       JSON.stringify(techno.params) !== JSON.stringify(slow.params),
       "two records built the same bass voice: " + JSON.stringify(techno.params));
    ok(techno.dur < slow.dur, "a plucked record holds its bass as long as a ringing one (" +
       techno.dur.toFixed(2) + " vs " + slow.dur.toFixed(2) + ")");
  }

  // ── SOMEBODY IS MIXING THIS, and the desk hears it ──
  // The engineer's answers are mix OFFSETS over the composed mix, so the
  // proof is the units the bar is played with — not the model, not the
  // board, the numbers the engine is handed.
  const units = () => page.evaluate(async () => {
    const PL = await import("/nukernel/audio/plan.js"); PL.compile();
    const U = (PL.barPlan(0) || {}).units || {};
    const one = (k) => U[k] ? { lvl: U[k].lvl, rev: U[k].rev, del: U[k].del,
      lo: U[k].sampler && U[k].sampler.strip ? U[k].sampler.strip.lo : null } : null;
    return { kick: one("kick"), snare: one("snare"), hat: one("hat") }; });
  {
    await seat("engineer");
    const dq2 = (await q())[0] || "";
    ok(/drums|kick|snare|hats|squeeze|tape|bass/.test(dq2),
       "in the engineer's chair the question is \"" + dq2 + "\"");
    const before = await units();
    for (const w of ["down the hall", "huge", "a plate on it", "keep them down"]) {
      if (!(await tap(w))) {
        // the questions come in order; walk to the one that offers this word
        for (let i = 0; i < 8 && !(await opts()).some(o => o.w === w); i++) {
          const list = (await opts()).filter(o => !o.dead);
          if (!list.length) break;
          await tap(list[0].w);
        }
        await tap(w);
      }
    }
    await page.waitForTimeout(500);
    const after = await units();
    ok(after.kick.lvl > before.kick.lvl,
       "the kick was made huge and its level did not move (" + before.kick.lvl + " → " + after.kick.lvl + ")");
    ok(after.kick.lo > before.kick.lo, "the kick was made huge and its bottom did not move");
    ok(after.snare.rev > before.snare.rev, "a plate on the snare added no reverb");
    ok(after.hat.lvl < before.hat.lvl, "the hats were told to come down and did not");
    ok(after.kick.rev > before.kick.rev, "the room never reached the kit");
    // ...and mixing did not rewrite the parts
    const ev = await page.evaluate(async () => {
      const PL = await import("/nukernel/audio/plan.js"); PL.compile();
      let d = 0; for (let i = 0; i < PL.barCount(); i++) d += PL.barPlan(i).ev.drums.length;
      return d; });
    ok(ev > 0, "mixing the record silenced it");
  }

  // ── THE PAGE SCROLLS ──
  // Nothing on this page scrolled once the wall of chips came out, and a
  // section asks six questions.
  {
    await page.evaluate(() => { const s = document.querySelectorAll(".dsec"); if (s[0]) s[0].click(); });
    await page.waitForTimeout(400);
    const sc = await page.evaluate(() => { const w = document.querySelector(".dwrap");
      w.scrollTop = w.scrollHeight;
      return { h: w.scrollHeight, view: w.clientHeight, top: w.scrollTop,
               lastVisible: (() => { const a = [...document.querySelectorAll(".dask")].pop();
                 if (!a) return false; const r = a.getBoundingClientRect();
                 return r.top >= 0 && r.bottom <= window.innerHeight + 2; })() }; });
    ok(sc.h > sc.view, "a section with six questions in it fits the screen exactly?");
    ok(sc.top > 0, "the page will not scroll");
    ok(sc.lastVisible, "the last question cannot be reached by scrolling");
    // ...and the section offers the players' own words AND the mix
    const whos = await page.evaluate(() => [...document.querySelectorAll(".dq")].map(x => x.textContent));
    for (const w of ["the drums", "at the kit", "the bass", "the mix", "everybody"])
      ok(whos.some(x => x.includes(w)), "a section does not ask about " + w);
    await page.evaluate(() => { const b = [...document.querySelectorAll(".dpinkey")].pop();
      if (b) b.click(); });
    await page.waitForTimeout(250);
  }

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
