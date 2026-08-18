#!/usr/bin/env node
// nukernel-genre.test.js — the gate on nukernel/genre-verifier.js.
//   node test/unit/nukernel-genre.test.js
//
// The verifier answers one question — is each of the 110 genres still more like
// itself than like anything else on the shelf — and this holds the answer still.
// It exists because the failure it guards against is invisible to every other
// gate in the tree: Chicago 1987's 303 had its resonance and envmod at about
// half strength for weeks, the anchor rendered, the app played, every check was
// green, and the genre was gone. Nothing was BROKEN. It had just been tuned into
// its neighbours.
//
// Gates, in order:
//   1  the vector is sound       77 features, no NaN anywhere, and the key list
//                                still matches the baked profile (a new feature
//                                invalidates the baseline — re-bake, read the diff)
//   2  no new confusions         every genre that loses its own row is one the
//                                committed profile already knows about
//   3  margins hold              no genre's separation from its nearest rival
//                                has fallen more than DELTA below the baseline
//   4  no anchor has drifted     every centroid is within one catalog spread of
//                                the frozen one, feature by feature
//   5  it can feel a dulled knob the sensitivity proof: halve the 303's
//                                resonance and envmod IN MEMORY and gate 4's own
//                                measurement must trip on it
//   6  it is reading the SCORE   put a four-on-the-floor kit under a boom-bap
//                                anchor and the rhythm group must move — the
//                                verifier reads the emitted bars, not the table
//
// Pure node, no audio, no browser, no network. One measurement pass (~32s) feeds
// gates 1-4; gates 5 and 6 cost three composed records each.
"use strict";
const V = require("../../nukernel/genre-verifier.js");

const DELTA = 4;          // points a margin may lose before it is a regression
let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};

(async () => {
  const base = V.loadProfiles();
  const m = await V.measure(base.seeds);
  const mx = V.matrixOf(m);

  // ---- 1: the vector is sound ----
  {
    const same = m.keys.length === base.features.length &&
                 m.keys.every((k, i) => k === base.features[i]);
    gate("feature list matches the baked profile", same,
         `${m.keys.length} features` + (same ? "" : " — run `genre-verifier.js bake`"));
    let bad = "";
    for (const g of m.genres)
      for (const v of m.vecs[g])
        for (const k of m.keys)
          if (!Number.isFinite(v[k])) bad = bad || `${g}.${k}`;
    gate("every feature of every genre is a finite number", !bad, bad && "NaN at " + bad);
  }

  // ---- 2: no new confusions ----
  {
    const known = new Set(base.failing);
    const now = mx.rows.filter(r => !r.ok).map(r => r.g);
    const fresh = now.filter(g => !known.has(g));
    const healed = base.failing.filter(g => !now.includes(g));
    gate(`diagonal dominant: ${mx.dominant}/${m.genres.length}`, !fresh.length,
         fresh.length
           ? "NEW: " + fresh.map(g => {
               const r = mx.rows.find(x => x.g === g);
               return `${g} (self ${r.self} <= ${r.rival} ${r.rivalScore})`;
             }).join(", ")
           : "known: " + base.failing.join(", "));
    // not a failure — a genre that pulled away from its neighbour is the point
    if (healed.length)
      console.log("      note: " + healed.join(", ") + " now win their own rows; re-bake to keep the baseline honest");
  }

  // ---- 3: margins hold ----
  {
    const lost = mx.rows.filter(r => base.margins[r.g] != null &&
                                     r.margin < base.margins[r.g] - DELTA)
      .map(r => `${r.g} ${base.margins[r.g]}->${r.margin} (vs ${r.rival})`);
    gate(`no genre lost more than ${DELTA} points of margin`, !lost.length,
         lost.length ? lost.join(", ") : `tightest: ` +
           [...mx.rows].filter(r => r.ok).sort((a, b) => a.margin - b.margin).slice(0, 3)
             .map(r => `${r.g} +${r.margin}`).join(" "));
  }

  // ---- 4: no anchor has drifted ----
  {
    const d = V.driftOf(m, base).filter(x => x.by >= V.DRIFT_Z);
    gate(`every anchor within ${V.DRIFT_Z} spread of its baked centroid`, !d.length,
         d.length ? d.map(x => `${x.g} ${x.worst} ${x.by.toFixed(2)}`).join(", ")
                  : "110 centroids unmoved");
  }

  // ---- 5: it can feel a dulled knob ----
  // THE GATE THAT TESTS THE GATE. A tripwire nobody has ever seen trip is a
  // decoration, so this is the acid failure itself, replayed in memory: back the
  // squelch off to what shipped and gate 4's own measurement must name the genre
  // AND the knob. The table is restored before anything else reads it.
  {
    const G = require("../../nukernel/genres.js");
    const set = G.GENRES.acid.synth.set, keep = { ...set };
    set.resonance = 0.58; set.envmod = 0.42;         // the bland 303, as it shipped
    let d = [];
    try {
      const dull = await V.measure(base.seeds);
      d = V.driftOf(dull, base).filter(x => x.by >= V.DRIFT_Z);
    } finally { Object.assign(set, keep); }
    const hit = d.find(x => x.g === "acid");
    gate("a half-strength 303 trips the drift alarm", !!hit,
         hit ? `acid ${hit.worst} moved ${hit.by.toFixed(2)} spreads`
             : "the verifier could not feel the knob it was written for");
    gate("...and it names acid alone", d.length === 1,
         d.map(x => x.g).join(", ") || "nothing");
  }

  // ---- 6: it is reading the SCORE ----
  // The same proof from the other side. Everything above could in principle be
  // read off the genre table; this one cannot — a kit vector only becomes a
  // number after compose() writes the record and songBars buckets it, so if the
  // rhythm group moves when the kit is swapped, the pipeline is genuinely reading
  // the emitted bars.
  {
    const G = require("../../nukernel/genres.js");
    const bb = G.GENRES.boombap, keep = bb.kit;
    const before = m.centroids.boombap;
    bb.kit = { k: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
               h: [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1] };
    let after = null;
    // one genre, not all 110 — the baked spreads do the comparing
    try { after = (await V.measure(base.seeds, ["boombap"])).centroids.boombap; }
    finally { bb.kit = keep; }
    const z = k => Math.abs(after[k] - before[k]) / base.scale[k];
    gate("a four-on-the-floor kit under boom-bap moves the rhythm group",
         z("r_four") >= 1, `r_four ${before.r_four.toFixed(2)} -> ` +
         `${after.r_four.toFixed(2)} (${z("r_four").toFixed(2)} spreads)`);
  }

  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
