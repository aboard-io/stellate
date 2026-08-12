// orchestrate.js — CHOOSE AN INSTRUMENT BY WHAT THE PART NEEDS.
//
// The previous answer was `nearest by brightness`, and it reconstructed 801 of
// 822 slots — which sounds good until you notice what one number cannot know.
// It cannot know that a pizzicato sample stops ringing after 1.5 seconds, so it
// will happily hand a whole-note pad to a plucked string and the chord will
// simply not be there. Brightness is a position; this is a FIT.
//
// WHAT THE PART DEMANDS, all measured off the events rather than declared:
//   longest    the longest note it has to hold, in seconds
//   density    notes per beat — how fast it has to articulate
//   poly       how many notes sound at once
//
// WHAT AN INSTRUMENT OFFERS, all read from the shipped registry:
//   sustains   any zone loops -> it can hold a note indefinitely
//   ring       mean zone length in seconds -> how long it rings if it cannot
//   bright     the mean cutoff the 274 anchors assign it (the taste axis)
//   family     the coarse timbral neighbourhood
//
// TWO OF THOSE ARE HARD AND THE REST ARE PREFERENCES, which is the whole design.
// A hard constraint disqualifies; a preference only ranks. That ordering is what
// stops the scorer from picking something beautiful that cannot play the part.
//
// WHAT IT DELIBERATELY DOES NOT USE: the zones' `lo`/`hi`. They look like an
// instrument range and they are not — they are GM extraction splits, so a cello
// reads as MIDI 0-117. Using them as a range constraint would be reading a
// sampling artifact as a musical fact.

(function (root) {
  "use strict";
  const engineRef = () => (typeof module !== "undefined" && module.exports)
    ? require("./csd-engine.js") : root.CsdEngine;

  // ------------------------------------------------------- what each one offers
  let _cap = null;
  function capabilities(K_) {
    if (_cap) return _cap;
    K_ = K_ || root.GenreKernel;
    const S = K_.SAMPLERS || {}, out = {};
    // the taste axis: how brightly the catalogue actually uses each instrument
    const bright = {}, slots = {};
    for (const g of Object.keys(K_.GENRES)) {
      const t = K_.track(g, { seed: 7 }), st = t.state || t, I = st.instruments || {};
      for (const slot of ["bass", "melody", "pad"]) {
        const r = I[slot]; if (!r) continue;
        const id = (r.sampler && r.sampler.id) || r.model; if (!id) continue;
        (bright[id] = bright[id] || []).push(+r.cutoff || 0);
        (slots[id] = slots[id] || { bass: 0, melody: 0, pad: 0 })[slot]++;
      }
    }
    for (const id of Object.keys(S)) {
      const zs = S[id].zones || []; if (!zs.length) continue;
      const sr = S[id].sr || 44100;
      const secs = zs.map((z) => (z.le || z.len || 0) / sr).filter((x) => x > 0);
      const b = bright[id];
      out[id] = {
        id,
        sustains: zs.some((z) => z.loop),
        ring: secs.length ? secs.reduce((a, x) => a + x, 0) / secs.length : 0,
        bright: b ? b.reduce((a, x) => a + x, 0) / b.length : 0,
        family: (K_.instrFamily && K_.instrFamily(id)) || "other",
        // WHICH SLOT THE CATALOGUE PUTS IT IN. This is the register term, and it
        // has to come from here because the zones cannot supply it: their lo/hi
        // are GM extraction splits, so a cello reads as MIDI 0-117 and range is
        // unusable as a constraint. Without it every voice ranked identically —
        // the hard constraint discriminated and nothing else did, so a bass part
        // was offered a church organ.
        slots: slots[id] || { bass: 0, melody: 0, pad: 0 },
        seen: b ? b.length : 0,
      };
    }
    _cap = out;
    return out;
  }

  // ------------------------------------------------------ what the part demands
  // Read off real events, so a part that turned out sparse is scored as sparse
  // whatever the pattern name claimed.
  function demands(events, voice, bpm) {
    const spb = 60 / Math.max(20, bpm || 110);
    const es = events.filter((e) => e.voice === voice);
    if (!es.length) return null;
    let longest = 0, lo = 999, hi = -1;
    for (const e of es) {
      longest = Math.max(longest, (e.dur || 0) * spb);
      const m = engineRef().pchToMidi(e.pch);
      lo = Math.min(lo, m); hi = Math.max(hi, m);
    }
    const span = Math.max(...es.map((e) => e.beat)) - Math.min(...es.map((e) => e.beat));
    // simultaneity: the most notes overlapping at any onset
    const sorted = es.slice().sort((a, b) => a.beat - b.beat);
    let poly = 1;
    for (let i = 0; i < sorted.length; i++) {
      let n = 1;
      for (let j = i + 1; j < sorted.length && sorted[j].beat < sorted[i].beat + 0.02; j++) n++;
      poly = Math.max(poly, n);
    }
    return { longest, density: span > 0 ? es.length / span : es.length, poly, lo, hi, n: es.length };
  }

  // ------------------------------------------------------------------ the fit
  // HARD: a part that must hold a note longer than an instrument rings, on an
  // instrument that does not loop, is not a choice — the note is simply absent
  // for the rest of its length. A 20% margin, because a note dying slightly early
  // under a following note is normal playing and not a failure.
  const canHold = (cap, d) => cap.sustains || cap.ring * 1.2 >= d.longest;

  function score(cap, d, want) {
    if (!canHold(cap, d)) return -Infinity;                 // hard
    let s = 0;
    // BRIGHTNESS is taste and it is what the catalogue's own choices encode, so
    // it carries the most weight of the soft terms.
    if (want && want.bright != null) s -= 2.0 * Math.abs(cap.bright - want.bright) / 4000;
    // A FAST PART ON A LONG-RINGING INSTRUMENT turns into mud: every note is
    // still sounding when the next three arrive. Penalise ring against density.
    if (d.density > 2) s -= 0.9 * Math.min(1, (cap.ring * d.density) / 6);
    // A SUSTAINED PART wants something that actually sustains, beyond merely
    // being able to survive its longest note.
    if (d.longest > 1.2 && !cap.sustains) s -= 0.6;
    // prefer an instrument the catalogue actually reaches for; an unused zone map
    // is a guess
    s += Math.min(0.3, cap.seen * 0.02);
    if (want && want.family && cap.family === want.family) s += 0.25;
    // REGISTER, from the catalogue's own habit rather than from the zone map.
    // Weighted above brightness: putting a bass part on a bass instrument matters
    // more than matching a cutoff, and the failure is louder when you get it wrong.
    if (want && want.slot) {
      const tot = cap.slots.bass + cap.slots.melody + cap.slots.pad;
      s += tot ? 2.6 * (cap.slots[want.slot] / tot) : 0;
      if (tot && !cap.slots[want.slot]) s -= 1.2;      // never used here at all
    }
    return s;
  }

  // Rank every instrument for this part. Returns the sorted candidates so a
  // caller can show its reasoning rather than just its answer.
  function rank(d, want, K_) {
    const caps = capabilities(K_);
    const out = [];
    for (const id of Object.keys(caps)) {
      const sc = score(caps[id], d, want);
      if (sc > -Infinity) out.push({ id, score: sc, cap: caps[id] });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  const choose = (d, want, K_) => { const r = rank(d, want, K_); return r.length ? r[0].id : null; };

  // Which instruments the part RULES OUT, and why — the useful half of a fit,
  // and the thing a nearest-by-brightness pick can never tell you.
  function rejected(d, K_) {
    const caps = capabilities(K_);
    return Object.keys(caps).filter((id) => !canHold(caps[id], d))
      .map((id) => ({ id, ring: caps[id].ring, needs: d.longest }));
  }

  const api = { capabilities, demands, rank, choose, rejected, canHold, score };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CsdOrchestrate = api;
})(typeof window !== "undefined" ? window : globalThis);
