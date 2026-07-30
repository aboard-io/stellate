#!/usr/bin/env node
// test/browser/transit-arrival.test.js — THE TRANSIT-ARRIVAL GATE. Moving from blues to
// industrial the ride crosses dnb: it loads, but the promised instruments never
// show up and play — you keep the flute you had earlier.
//
// The transit cousin of test/browser/blend-arrival.test.js: that gate PARKS on a destination;
// this one rides a path THROUGH a genre's neighborhood and asserts the crossed
// genre actually SOUNDS while its card is up. The bug it pins:
//
//   The blend-arrival fix tiered the flip queue: never-applied-this-journey
//   dimensions first, then a stable per-seed hash order. appliedFlips was only
//   cleared on CONVERGENCE (diffs empty) — which never happens mid-travel. So
//   ~24 bars into any journey every dimension was tier 2 and the queue
//   degenerated to one FIXED per-seed order. A crossed neighborhood's dwell
//   (dnb: ~10 of 256 bars on blues->industrial) only ever executed the head
//   few flips of that fixed order — dimensions ranked late ("lead voice" is
//   rank 10 of 12 for seed 43) NEVER fired again for the rest of the journey,
//   at ANY pace: the dwell scales with pace but so does the approach, so the
//   same head-of-order flips win every neighborhood. The flute (the lead
//   installed in the FIRST neighborhood) survives every later genre.
//
// Geometry (computed from POS + weightsAt, logged live): the test leg is the
// blues->industrial line's t=0.30..0.50 slice at pace 64 — same neighborhoods
// as the full ride (amapiano -> dnb -> chromeufo -> glosspump), dnb's weight
// peaks at 1.00 and stays dominant ~13 bars. At the real pace 256 the full leg
// gives dnb the same ~4% share (~10 bars): the contract must scale with
// bars-in-neighborhood, i.e. identity flips re-tiered per dominant genre, not
// per wall clock.
//
// Seed 43 (deterministic, chosen by sweep): dnb lead = rhodes_ep SAMPLER with
// 3/8 melody-on sections; the tier-2 hash order puts "lead voice" 10th and
// "drum kit" 11th — the exact starvation shape the bug produces.
//
// Asserts, while dnb's weight is dominant (>=0.5, first-ranked):
//   (a) the PLAYING lead identity becomes dnb's lead (rhodes_ep) within
//       LEAD_BARS of dominance and holds >= STICK_BARS consecutive bars;
//   (b) the PLAYING kit becomes dnb's ("breaks") within KIT_BARS;
//   (c) the new lead actually SOUNDS: after the flip lands we PARK inside the
//       neighborhood (what a listener does when the card they want comes up) and ride
//       until the section walk reaches a melody-on section — SamplerLive
//       note() calls whose zone srcId is ins_rhodes_ep_* (tapped via
//       FaustSampler.rateFor, only evaluated for notes that reach the graph)
//       MUST arrive: no silent pitched collapse. (Unconditional: melody/pads
//       are section-gated — dnb plays melody in 3/8 sections — so the moving
//       window alone can land entirely in melody-off bars and prove nothing.)
//   (d) pitched note() calls keep flowing across the crossing, RMS stays
//       real, zero page errors (the blues side must also play first).
//
//   node test/browser/transit-arrival.test.js
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8946;
const SEED = 43;        // dnb lead = rhodes_ep sampler; "lead voice" ranks 10/12 in tier-2 hash order
const PACE = 64;        // bars per leg on the test slice (dnb dwell ~13 bars, mirrors pace-256 reality)
const T0 = 0.30, T1 = 0.50;   // blues->industrial line slice: amapiano > dnb > chromeufo > glosspump
const LEAD_BARS = 8;    // dnb's lead identity must land within this many bars of dominance
const KIT_BARS = 8;     // dnb's kit ("breaks") within this many bars of dominance
const STICK_BARS = 4;   // ...and the lead must HOLD at least this many consecutive bars
const MIN_DWELL = 6;    // geometry sanity: dnb must actually be dominant this long pre-park
const PARK_AFTER = 6;   // bars of dominance to ride BEFORE parking (arrival must happen in transit)
const SOUND_BARS = 60;  // parked bars allowed for the walk to reach a melody-on section
const RMS_FLOOR = 0.0008;
const DNB_LEAD = "rhodes_ep";
const DNB_KIT = "breaks";

async function main() {
  const srv = await serve(ROOT, PORT);
  PORT = srv.port;   // the harness may have walked past a busy port
  const browser = await launchChromium({ requireChromium: true });
  const page = await browser.newPage();
  const errs = capturePageErrors(page);
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForFunction(() => window.__X && window.__S, { timeout: 20000 });
  await page.waitForTimeout(400);

  // deterministic seed + the two sound taps:
  //   __NOTES  — real SamplerLive.note() calls into the graph (drum vs pitched,
  //              the blend-arrival tap: scheduling truth, not state truth);
  //   __SRC    — per-zone-srcId note counts via FaustSampler.rateFor, which
  //              live.js scheduleNative evaluates ONLY for notes that pass the
  //              player/buffer guards — so a count here IS a sounded note, and
  //              the srcId names the instrument (ins_rhodes_ep_* = dnb's lead).
  await page.evaluate((seed) => {
    __S.seed = seed;
    window.__NOTES = { drum: 0, pitched: 0 };
    window.__SRC = {};
    const SP = window.FaustSampler;
    const origLive = SP.SamplerLive;
    SP.SamplerLive = (ctx, dests) => {
      const p = origLive(ctx, dests);
      const on = p.note.bind(p);
      p.note = (buf, when, o) => {
        if (o && o.strip && o.strip.hpf === 28) window.__NOTES.drum++;
        else window.__NOTES.pitched++;
        return on(buf, when, o);
      };
      return p;
    };
    const origRate = SP.rateFor;
    SP.rateFor = (z, midi) => {
      try { if (z && z.srcId) window.__SRC[z.srcId] = (window.__SRC[z.srcId] || 0) + 1; } catch (e) {}
      return origRate(z, midi);
    };
    // per-bar recorder: one snapshot per barCount tick (poll-from-node misses
    // bars at 170bpm), drained by the test loop
    window.__LOG = [];
    let lastB = -1;
    const leadOf = (st) => { const m = ((st || {}).instruments || {}).melody || {}; return (m.sampler && m.sampler.id) || m.model; };
    const srcSum = (pre) => { let n = 0; for (const k in window.__SRC) if (k.indexOf(pre) === 0) n += window.__SRC[k]; return n; };
    setInterval(() => {
      if (!window.__S || !__S.live) return;
      const b = __S.barCount; if (b === lastB) return; lastB = b;
      const p = __S.playing || {}, t = __S.target || {};
      const w = (__S.weights || []).slice(0, 2).map((x) => ({ g: x.g, w: +(+x.w).toFixed(2) }));
      const secName = (__S.barInfo || {}).section || "";
      const sec = (p.sections || []).find((s) => s.name === secName) || {};
      const h = window.FaustLive && FaustLive.lastHandle;
      window.__LOG.push({
        bar: b, w,
        pLead: leadOf(p), tLead: leadOf(t),
        pKit: (p.genreMeta || {}).kit, tKit: (t.genreMeta || {}).kit,
        sec: secName, secMel: sec.melody || "?", bpm: p.bpm, q: (__S.queue || []).length,
        status: __S.status,
        notes: { d: window.__NOTES.drum, p: window.__NOTES.pitched },
        lead$: srcSum("ins_" + "rhodes_ep" + "_"),
        rms: h ? +(+h.rms()).toFixed(4) : null,
        hErr: h ? h.errors.length : 0,
      });
      if (window.__LOG.length > 400) window.__LOG.shift();
    }, 120);
  }, SEED);

  // park on BLUES (the journey's origin — its lead, hammond for seed 43, is the
  // "flute we had earlier" stand-in) and go live
  await page.evaluate(() => {
    const p = __X.POS.blues;
    __S.waypoints = [{ x: p[0], y: p[1] }, { x: p[0] + 1, y: p[1] + 1 }];
    __S.travel = { seg: 0, t: 0 };
    __X.retarget({ x: p[0], y: p[1] });
  });
  await page.evaluate(() => __X.goLive());

  // ── PHASE 1: blues must PLAY (no start-of-set regression) ──
  let bluesOk = false, bluesPitched = 0, bluesLead = "";
  let deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => ({
      bar: __S.barCount,
      rms: window.FaustLive && FaustLive.lastHandle ? +FaustLive.lastHandle.rms() : 0,
      pitched: window.__NOTES.pitched,
      lead: (((__S.playing || {}).instruments || {}).melody || {}).model,
    }));
    if (s.bar >= 4 && s.rms > RMS_FLOOR && s.pitched > 0) {
      bluesOk = true; bluesPitched = s.pitched; bluesLead = s.lead;
      console.log("BLUES OK:", JSON.stringify(s));
      break;
    }
    await page.waitForTimeout(500);
  }

  // ── PHASE 2: the TRANSIT leg — a slice of the blues->industrial line that
  // crosses dnb's neighborhood (waypoints computed from POS, dominance logged) ──
  const leg = await page.evaluate(([t0, t1, pace]) => {
    const B = __X.POS.blues, I = __X.POS.industrial;
    const L = (t) => ({ x: B[0] + (I[0] - B[0]) * t, y: B[1] + (I[1] - B[1]) * t });
    __S.waypoints = [L(t0), L(t1)];
    __S.travel = { seg: 0, t: 0 };
    // PACE IS A DURATION MULTIPLE NOW, not a bars-per-leg field. This used to set
    // `__S.pace = 64`; nothing reads that any more (core/share.js: the path's own
    // LENGTH sets a base duration and S.durMult scales it), so the traveler crawled
    // at the default pace, never left the first neighbourhood inside the sampling
    // window, and the gate failed with "dwell 0, peak w=0" — a control that no
    // longer exists, not a transit bug. loopBars() is bars-per-loop at the current
    // multiple and scales linearly with it, so one measurement calibrates the rest.
    const at1 = Math.max(1, __X.loopBars());
    __S.durMult = Math.max(0.01, pace / at1);
    window.__LOG.length = 0;
    return { startBar: __S.barCount, A: L(t0), B: L(t1), loopBars: __X.loopBars(), durMult: __S.durMult };
  }, [T0, T1, PACE]);
  console.log(`TRANSIT: target ${PACE} bars/loop -> durMult ${leg.durMult.toFixed(3)} (loopBars now ${leg.loopBars}), leg (${leg.A.x.toFixed(0)},${leg.A.y.toFixed(0)}) -> (${leg.B.x.toFixed(0)},${leg.B.y.toFixed(0)}), start bar ${leg.startBar}`);

  // ── PHASE 3: ride the crossing IN TRANSIT; per-bar evidence from the page
  // recorder. The arrival contract (lead/kit within N bars of dominance) must
  // be met while still TRAVELING — parking comes only after PARK_AFTER bars. ──
  const bars = [];
  let domStart = -1, domEnd = -1, dnbPeak = 0;
  let leadArrive = -1, kitArrive = -1, leadStreak = 0, bestStreak = 0;
  let lowRms = 0, rmsSamples = 0;
  let pitchedAtDom = -1, pitchedEnd = 0, lead$End = 0;
  let parkedBar = -1, soundBar = -1, melActiveRhodes = 0, leadLostParked = false;
  deadline = Date.now() + 420000;
  outer: while (Date.now() < deadline) {
    const drained = await page.evaluate(() => window.__LOG.splice(0));
    for (const s of drained) {
      bars.push(s);
      console.log(parkedBar < 0 ? "T" : "K", JSON.stringify(s));
      if (s.rms != null) { rmsSamples++; if (s.rms <= RMS_FLOOR) lowRms++; }
      const w0 = s.w[0] || {};
      const dnbW = (s.w.find((x) => x.g === "dnb") || {}).w || 0;
      if (dnbW > dnbPeak) dnbPeak = dnbW;
      const dom = w0.g === "dnb" && w0.w >= 0.5;
      if (dom) { if (domStart < 0) { domStart = s.bar; pitchedAtDom = s.notes.p; } domEnd = s.bar; }
      if (domStart >= 0) {
        if (s.pLead === DNB_LEAD) {
          if (leadArrive < 0) leadArrive = s.bar;
          leadStreak++; if (leadStreak > bestStreak) bestStreak = leadStreak;
        } else { leadStreak = 0; if (parkedBar >= 0) leadLostParked = true; }
        if (kitArrive < 0 && s.pKit === DNB_KIT) kitArrive = s.bar;
      }
      if (parkedBar >= 0 && s.pLead === DNB_LEAD && s.secMel && s.secMel !== "off" && s.secMel !== "?") melActiveRhodes++;
      pitchedEnd = s.notes.p; lead$End = s.lead$;
      if (parkedBar >= 0 && s.lead$ > 0 && melActiveRhodes >= 1) { soundBar = s.bar; break outer; }   // the new lead SOUNDED
      if (parkedBar >= 0 && s.bar - parkedBar > SOUND_BARS) break outer;   // parked long enough — judge below
      if (parkedBar < 0 && s.bar - leg.startBar > PACE + 16) break outer;   // rode past the leg (or never met dnb)
    }
    // PARK once the transit contract had its window: PARK_AFTER bars of dominance
    // ridden while traveling. Freeze the loop at the CURRENT cursor (inside dnb's
    // neighborhood) so the section walk can reach a melody-on section.
    if (parkedBar < 0 && domStart >= 0 && bars.length && bars[bars.length - 1].bar >= domStart + PARK_AFTER) {
      parkedBar = await page.evaluate(() => {
        const c = __S.cursor;
        __S.waypoints = [{ x: c.x, y: c.y }, { x: c.x + 1, y: c.y + 1 }];
        __S.travel = { seg: 0, t: 0 };
        return __S.barCount;
      });
      console.log("PARKED inside dnb neighborhood at bar", parkedBar);
    }
    await page.waitForTimeout(400);
  }

  try { await page.evaluate(() => __X.stopLive()); } catch (e) {}
  await browser.close(); srv.close();

  // ── VERDICT ──
  const dwell = domStart >= 0 ? domEnd - domStart + 1 : 0;
  const domOk = domStart >= 0 && dwell >= MIN_DWELL && dnbPeak >= 0.85;
  const leadOk = leadArrive >= 0 && leadArrive - domStart <= LEAD_BARS;
  const stickOk = bestStreak >= STICK_BARS && !leadLostParked;
  const kitOk = kitArrive >= 0 && kitArrive - domStart <= KIT_BARS;
  const soundOk = lead$End > 0 && soundBar >= 0;   // rhodes zone srcIds got real note() calls
  const flowOk = pitchedAtDom >= 0 && pitchedEnd > pitchedAtDom;   // pitched notes kept flowing across the crossing
  const rmsOk = rmsSamples > 4 && lowRms <= 3;
  const errsOk = errs.length === 0 && (bars.length === 0 || bars[bars.length - 1].hErr === 0);
  console.log(`\nblues plays: ${bluesOk} (pitched ${bluesPitched}, lead ${bluesLead})`);
  console.log(`dnb dominance: bars ${domStart}..${domEnd} (dwell ${dwell}, gate >= ${MIN_DWELL}), peak w=${dnbPeak}`);
  console.log(`lead arrival (in transit): bar ${leadArrive} (rel ${leadArrive >= 0 && domStart >= 0 ? leadArrive - domStart : "-"}, gate <= ${LEAD_BARS}), streak ${bestStreak} (gate >= ${STICK_BARS}, lost while parked: ${leadLostParked})`);
  console.log(`kit arrival (in transit): bar ${kitArrive} (rel ${kitArrive >= 0 && domStart >= 0 ? kitArrive - domStart : "-"}, gate <= ${KIT_BARS})`);
  console.log(`dnb lead sounds: ${lead$End} rhodes note() calls (sounded at bar ${soundBar}; parked at ${parkedBar}; melody-active rhodes bars: ${melActiveRhodes})`);
  console.log(`pitched flow: ${pitchedAtDom} -> ${pitchedEnd}; rms real: ${rmsOk} (${lowRms}/${rmsSamples} low); page errors: ${errs.length}`);
  if (errs.length) console.log("  " + errs.slice(0, 6).join("\n  "));
  const pass = bluesOk && domOk && leadOk && stickOk && kitOk && soundOk && flowOk && rmsOk && errsOk;
  console.log(pass ? "TRANSIT-ARRIVAL GATE: PASS" : "TRANSIT-ARRIVAL GATE: FAIL");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
