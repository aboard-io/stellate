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
    const bassV = (PL.cast() || []).find(c => c.chair === "bass");
    const out = { bars: PL.barCount(), drums: 0, pitched: 0, kicks: [] };
    for (let i = 0; i < PL.barCount(); i++) {
      const p = PL.barPlan(i);
      out.drums += p.ev.drums.length;
      // the BASS's own notes — a keys player is also pitched, and "one note
      // every four bars" was never a claim about the whole band
      out.pitched += p.ev.pitched.filter(e => !bassV || e.voice === bassV.v).length;
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

  // ── EVERY CHAIR SAYS HOW MUCH IT HAS LEFT ──
  // It said "1 question" for every chair that had any question at all, so a
  // chair with nine things to decide and a chair with one looked identical.
  {
    const labels = await page.evaluate(() => [...document.querySelectorAll(".dseat")]
      .map(x => x.textContent));
    ok(labels.length === 6, "the session has " + labels.length + " chairs");
    const counts = labels.map(l => parseInt((l.match(/(\d+) question/) || [])[1] || "0", 10));
    ok(counts.some(c => c > 1), "every chair claims one question: " + JSON.stringify(labels));
    ok(new Set(counts).size > 1, "every chair has the same number of questions left");
  }

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
  // WHICH VOICE IS THE BASS: the cast says so (plan.js cast()). Reading "the
  // first pitched event" found the keys player the moment one sat down.
  const voice = () => page.evaluate(async () => {
    const PL = await import("/nukernel/audio/plan.js"); PL.compile();
    const bassV = (PL.cast() || []).find(c => c.chair === "bass");
    let e = null;
    for (let i = 0; i < PL.barCount() && !e; i++)
      e = PL.barPlan(i).ev.pitched.find(x => bassV && x.voice === bassV.v);
    const u = e && ((PL.barPlan(0) || {}).units || {})[e.voice];
    return { module: u ? u.module : null, params: u ? u.params : null,
             chair: bassV ? bassV.chair : null,
             zones: u && u.sampler ? (u.sampler.zones || []).length : 0,
             dur: e ? e.dur : 0 }; });
  const asArranger = async (w) => {
    await seat("arranger");
    // the record is a FACT once it is called, so the way back to it is the
    // gig sheet — walking the interview only works before it is answered
    await page.evaluate(() => { const f = [...document.querySelectorAll(".dfact")]
      .find(x => (x.querySelector("b") || {}).textContent === "genre"); if (f) f.click(); });
    await page.waitForTimeout(280);
    if (await tap(w)) return true;
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
    // ...on a record with a SAMPLED kit, since the bottom band the gate reads
    // is a sampler strip and a 909 is a module with no zones to shape
    ok(await asArranger("a rock record"), "the record could not be changed to rock");
    await page.waitForTimeout(400);
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
    ok(before.kick.lo == null || after.kick.lo > before.kick.lo,
       "the kick was made huge and its bottom did not move (" +
       JSON.stringify([before.kick.lo, after.kick.lo]) + ")");
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

  // ── NO QUESTION OPENS WITH NOTHING TO TAP, AND EVERY CHAIR CAN BE CLEARED ──
  // Half the bass's subjects are about a note that has to exist first, so an
  // octave question over an empty bar was sixteen dead buttons ("when the
  // octave setting first shows up I can't select anything"). And a chair you
  // cannot clear is a chair you stop trying things in.
  {
    await seat("bass");
    for (let i = 0; i < 24; i++) {
      const cur = (await q())[0] || "";
      if (!cur || /tap anything/.test(cur)) break;
      const list = await opts();
      ok(list.some(o => !o.dead), "\"" + cur + "\" opens with nothing you can tap");
      await tap(list.find(o => !o.dead).w);
    }
    // the sheet holds what was said, including the line and the bar
    const facts = await page.evaluate(() => [...document.querySelectorAll(".dfact")]
      .map(x => (x.querySelector("b") || {}).textContent || x.textContent));
    for (const f of ["the figure", "the bar"])
      ok(facts.includes(f), "the bassist cannot get back to " + f + ": " + JSON.stringify(facts));
    ok(facts.some(f => /start over/.test(f)), "there is no way to clear this chair");
    // ...and the same question is not asked twice in two costumes
    ok(!facts.includes("the register"), "the register is asked twice");
    ok(!facts.includes("the line"), "the line is asked twice");
    // opening the bar gives sixteen live places
    await page.evaluate(() => { const f = [...document.querySelectorAll(".dfact")]
      .find(x => (x.querySelector("b") || {}).textContent === "the bar"); if (f) f.click(); });
    await page.waitForTimeout(300);
    const bar = await opts();
    ok(bar.length === 16 && !bar.some(o => o.dead),
       "the bar offers " + bar.length + " places, " + bar.filter(o => o.dead).length + " of them dead");
    // START OVER really clears
    const before = await page.evaluate(() => window.__bandModel());
    await page.evaluate(() => { const b = [...document.querySelectorAll(".dfact")]
      .find(x => x.textContent === "start over"); if (b) b.click(); });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__bandModel());
    ok(after !== before, "start over changed nothing");
    ok(JSON.parse(after).bass.fig === null, "start over left the bassist's line behind");
    ok(JSON.parse(after).song.genre === JSON.parse(before).song.genre,
       "clearing the bass chair uncalled the record");
  }

  // ── A 303 YOU CAN TURN, AND A FILTER THAT MOVES ──
  // The panel is only a panel if it reaches the voice the engine builds, and
  // a sweep is only a sweep if it reaches the bar's own automation.
  {
    // ...on a record whose bass IS a machine — a jazz date is holding a
    // P-bass, and a P-bass has no filter to open
    ok(await asArranger("a techno record"), "the record could not be changed to techno");
    await page.waitForTimeout(400);
    ok(/techno/.test(await page.evaluate(() => window.__bandModel())),
       "the record did not become a techno record");
    await seat("bass");
    // ...with a machine in your hands. Earlier blocks walk this chair and
    // clear it, so the bass in it is whatever they left — and a P-bass has
    // no filter to read.
    for (let i = 0; i < 12; i++) {
      if (await page.evaluate(() => JSON.parse(window.__bandModel()).bass.instr === "bass_lead")) break;
      if (await page.evaluate(() => { const f = [...document.querySelectorAll(".dfact")]
        .find(x => (x.querySelector("b") || {}).textContent === "instr");
        if (f) { f.click(); return true; } return false; })) {
        await page.waitForTimeout(260);
        if (await tap("a synth bass")) continue;
      }
      const list = (await opts()).filter(o => !o.dead);
      if (!list.length) break;
      await tap(list[0].w);
    }
    ok(await page.evaluate(() => JSON.parse(window.__bandModel()).bass.instr === "bass_lead"),
       "the bassist could not be handed a machine");
    // the BASS's own voice — with a keys player in the room the first
    // pitched event on the bar is somebody else's
    const voiceNow = () => page.evaluate(async () => {
      const PL = await import("/nukernel/audio/plan.js"); PL.compile();
      const U = (PL.barPlan(0) || {}).units || {}, p = PL.barPlan(0);
      const bassV = (PL.cast() || []).find(c => c.chair === "bass");
      const mine = p.ev.pitched.filter(x => bassV && x.voice === bassV.v);
      const e = mine[0] || p.ev.pitched[0], u = e && U[e.voice];
      return { params: u ? u.params : null, notes: mine.map(x => x.pch) }; });
    const before = await voiceNow();
    // reach the machine panel through the sheet
    // A SUBJECT IS EITHER A FACT OR THE QUESTION IN FRONT OF YOU. An
    // untouched panel has never been answered, so it is still in the queue —
    // reading only the sheet says a chair has no panel when it has one.
    const reach = async (label, heading) => {
      for (let i = 0; i < 20; i++) {
        if (await page.evaluate((l) => { const f = [...document.querySelectorAll(".dfact")]
          .find(x => (x.querySelector("b") || {}).textContent === l);
          if (f) { f.click(); return true; } return false; }, label)) {
          await page.waitForTimeout(280); return true; }
        const cur = (await q())[0] || "";
        if (cur.includes(heading)) return true;
        const list = (await opts()).filter(o => !o.dead);
        if (!list.length) return false;
        await tap(list[0].w);
      }
      return false;
    };
    const opened = await reach("at the machine", "what is the machine set to?");
    ok(opened, "there is no machine panel on a synth bass · sheet: " +
       JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".dfact")]
         .map(x => (x.querySelector("b") || {}).textContent))) + " · bass: " +
       (await page.evaluate(() => JSON.stringify(JSON.parse(window.__bandModel()).bass.instr))));
    if (opened) {
      await page.waitForTimeout(300);
      const controls = (await opts()).map(o => o.w);
      for (const w of ["dark filter", "screaming", "all the way", "snappy", "square"])
        ok(controls.includes(w), "the panel has no \"" + w + "\": " + JSON.stringify(controls.slice(0, 6)));
      // ...open it WIDE, since a techno record already ships dark and a
      // control that asks for what is already true proves nothing
      await tap("wide open filter");
      await page.waitForTimeout(400);
      const after = await voiceNow();
      ok(after.params && after.params.cutoff !== (before.params || {}).cutoff,
         "opening the filter did not reach the voice (" +
         JSON.stringify([(before.params || {}).cutoff, (after.params || {}).cutoff]) + ")");
      ok(after.params.cutoff === 5000, "the filter opened to " + after.params.cutoff);
      // ...and the squelch is its own knob, not derived from the filter
      const env0 = after.params.envmod;
      await reach("at the machine", "what is the machine set to?");
      await tap("all the way");
      await page.waitForTimeout(400);
      const after2 = await voiceNow();
      ok(after2.params.envmod !== env0 && after2.params.envmod > 0.8,
         "the envelope amount is still tied to the resonance: " + after2.params.envmod);
    }
    // ...and the notes the line uses
    const tonal = await reach("what notes it plays", "what notes does the line use?");
    if (tonal) {
      await page.waitForTimeout(300);
      const was = (await voiceNow()).notes.join();
      await tap("a full acid scale");
      await page.waitForTimeout(400);
      ok((await voiceNow()).notes.join() !== was, "a full acid scale played the same notes");
    }
  }
  {
    // the filter movement, per section, on the bar's own automation
    await page.evaluate(() => { const s = document.querySelectorAll(".dsec"); if (s[0]) s[0].click(); });
    await page.waitForTimeout(400);
    const swept = () => page.evaluate(async () => {
      const PL = await import("/nukernel/audio/plan.js"); PL.compile();
      const p = PL.barPlan(0);
      // a sweep is an sfx event on the bar (desk.js deskSweeps)
      return JSON.stringify((p.ev.sfx || []).map(s => [s.from, s.to])); });
    const flat = await swept();
    const hit = await page.evaluate(() => { const b = [...document.querySelectorAll(".dopt")]
      .find(e => e.textContent === "open the filter over it");
      if (b) { b.click(); return true; } return false; });
    ok(hit, "a section cannot be told to open the filter");
    await page.waitForTimeout(500);
    ok(await swept() !== flat, "the filter sweep never reached the bar: " + flat);
    await page.evaluate(() => { const b = [...document.querySelectorAll(".dpinkey")].pop();
      if (b) b.click(); });
    await page.waitForTimeout(250);
  }

  // ── SOMEBODY IS PLAYING THE CHORDS ──
  // Until the fifth chair the harmony was called and voiced by nobody. The
  // proof is the compiled bar: chords under the bass, moving with the
  // changes, and gone when the player lays out.
  {
    const pitched = () => page.evaluate(async () => {
      const PL = await import("/nukernel/audio/plan.js"); PL.compile();
      const keysV = (PL.cast() || []).find(c => c.chair !== "bass");
      const byVoice = {}, atZero = [];
      for (let i = 0; i < PL.barCount(); i++)
        for (const e of PL.barPlan(i).ev.pitched) {
          byVoice[e.voice] = (byVoice[e.voice] || 0) + 1;
          if (i === 0 && e.beat === 0 && (!keysV || e.voice === keysV.v)) atZero.push(e.pch);
        }
      return { byVoice, atZero, voices: Object.keys(byVoice).length,
               cast: (PL.cast() || []).map(c => c.chair) }; });
    // ...on a record whose keys hold PADS — techno's keys default to a drone,
    // and a drone is one note on purpose
    ok(await asArranger("a house record"), "the record could not be changed to house");
    await page.waitForTimeout(400);
    await seat("keys");
    const kq = (await q())[0] || "";
    ok(/playing|job|sit|bright|arrive|leave|colour/.test(kq),
       "in the keys chair the question is \"" + kq + "\"");
    const held = await pitched();
    ok(held.voices >= 2, "only " + held.voices + " pitched voice on a record with keys in it");
    ok(held.atZero.length >= 3, "the first chord is " + held.atZero.length + " note(s)");
    // comping is a different phrase from pads, in the bar the engine is handed
    const before = JSON.stringify(held.byVoice);
    for (let i = 0; i < 8; i++) {
      if (await tap("comping the changes")) break;
      const list = (await opts()).filter(o => !o.dead);
      if (!list.length) break;
      await tap(list[0].w);
    }
    await page.waitForTimeout(500);
    ok(JSON.stringify((await pitched()).byVoice) !== before,
       "comping played exactly what the pads did: " + before);
    // ...and laying out really stops. The job is a FACT by now, so the way
    // back to it is its own chip.
    for (let i = 0; i < 12; i++) {
      if (await tap("lay out")) break;
      const opened = await page.evaluate(() => { const f = [...document.querySelectorAll(".dfact")]
        .find(x => (x.querySelector("b") || {}).textContent === "job" ||
                   (x.querySelector("b") || {}).textContent === "what you are playing");
        if (f) { f.click(); return true; } return false; });
      if (opened) { await page.waitForTimeout(260); continue; }
      const list = (await opts()).filter(o => !o.dead);
      if (!list.length) break;
      await tap(list[0].w);
    }
    await page.waitForTimeout(500);
    // ...and with a guitarist in the room, "silent" is about the KEYS' own
    // voice, not the whole band: the cast is ordered as the chairs are.
    const out = await page.evaluate(async () => {
      const PL = await import("/nukernel/audio/plan.js"); PL.compile();
      // the cast names the INSTRUMENT each seat holds — which is how you
      // tell two pitched chairs apart
      const want = JSON.parse(window.__bandModel()).keys.instr;
      const keysV = (PL.cast() || []).find(c => c.instr === want);
      let n = 0;
      for (let i = 0; i < PL.barCount(); i++)
        n += PL.barPlan(i).ev.pitched.filter(e => keysV && e.voice === keysV.v).length;
      return { n, model: JSON.parse(window.__bandModel()).keys.job }; });
    ok(out.model === "out" ? out.n === 0 : true,
       "the keys player laid out and is still playing " + out.n + " notes");
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
