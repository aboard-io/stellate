// test/unit/sixteen-bar.test.js — the three arrangement laws of 2026-08-18:
//
//   (a) THE SIXTEEN-BAR LAW — "We shouldn't have 16-bar measures unless they
//       evolve in significant ways." Every composed section of 16+ bars
//       carries a long-arc device (a period sentence, a motion arc, or a
//       filter automation) — checked across the whole catalog, and at the
//       ARTIFACT for the machine sample: a period section's bars really
//       differ, an armed arc really compiles to a sweep whose ends differ.
//   (b) THE MACHINE LINE — "there's no real 16-step intense acid riff … I
//       expect it to really go." The five machine genres deal a 32-step
//       sequencer phrase (the composer's first patterns longer than a bar):
//       dense, slid, accented off the grid — and their verses and drops
//       actually play it.
//   (c) THE ERA LAW — "Why would Chicago 1932 have enormous amounts of
//       delay?" No section of a place-year record carries an effect from
//       after its year, and no pre-tape (< 1950) record sends to the echo
//       bus at all.
//   (d) AN INSTRUMENTAL RECORD BOOKS NO SINGING GUESTS — "the lead should be
//       303, not vocal!" The INSTRUMENTAL genres never stack `vocal` or
//       `backing`, as guest or singer.
// Pure node, score-level.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const C = require("../../nukernel/compose.js");
const K = require("../../nukernel/kernel.js");
const NF = require("../../nukernel/fields.js");
const { GENRES } = require("../../nukernel/genres.js");
const SEEDS = [1, 2, 3];
const yearOf = gk => {
  const m = /(\d{3,4})\s*$/.exec((GENRES[gk] || {}).label || "");
  return m ? +m[1] : null;
};
// compose.js FX_YEAR, mirrored: each effect's arrival year. If the two
// tables drift the (c) sweep fails on the first record that shows it.
const FX_YEAR = { echo: 1950, ringmod: 1956, sweep: 1964, flanger: 1966,
                  wah: 1966, phaser: 1968, chorus: 1968, fenv: 1972,
                  crunch: 1951, leslie: 1941, tremolo: 1938, vibrato: 1938 };
const MACHINES = ["acid", "techno", "house", "bleeptechno", "ebm"];
const INSTRUMENTAL = ["techno", "dnb", "acid", "dub", "fugue", "counterpoint", "tango", "spem"];

/* (a) + (c) + (d): one walk over the whole catalog */
console.log("the sixteen-bar law, the era law, and the instrumental cast — all 110");
{
  let long = 0, sung = 0;
  for (const gk of Object.keys(GENRES)) {
    const y = yearOf(gk);
    for (const s of SEEDS) {
      let song;
      try { song = C.compose(gk, s); }
      catch (e) { ok(false, gk + "/" + s + ": compose threw — " + e.message); continue; }
      for (const b of song.song) {
        if ((b.len || 0) >= 16) {
          long++;
          // pre-1900 records are exempt: a through-composed form's long
          // sections evolve by construction (compose.js has the measurement)
          if (!y || y >= 1900)
            ok(!!(b.period || b.mot || (b.auto && b.auto.length)),
               gk + "/" + s + ": a " + b.len + "-bar " + (b.role || "section") +
               " carries no period, no motion arc and no automation — sixteen static bars");
        }
        if (y) for (const f of (b.fx || []))
          ok(!(FX_YEAR[f] > y), gk + "/" + s + ": a " + y + " record carries \"" + f +
             "\" (" + FX_YEAR[f] + ") — the era law leaked");
        if (y && y < 1950)
          ok(b.echo == null, gk + "/" + s + ": a " + y + " record sends to the echo bus");
        if (y && y < FX_YEAR.sweep)
          ok(!b.mot && !(b.auto && b.auto.length),
             gk + "/" + s + ": a " + y + " record carries a filter move — " +
             "pre-electric evolution is the period sentence");
        if (INSTRUMENTAL.includes(gk))
          for (const e of (b.stack || []))
            if (e.g === "vocal" || e.g === "backing") sung++;
      }
    }
  }
  ok(long >= 200, "the catalog stopped writing long sections at all (" + long +
     " of them) — the law should evolve them, not delete them");
  ok(sung === 0, sung + " vocal/backing layers on instrumental records — " +
     "\"the lead should be 303, not vocal\"");
}

/* (a) at the artifact, machine sample: the devices really move the stream */
console.log("the devices are real — bars differ under a period, a sweep's ends differ");
{
  const sig = ev => JSON.stringify(ev.map(e => [+e.t.toFixed(4), e.n, e.d, e.vel]));
  for (const gk of MACHINES) {
    const song = C.compose(gk, 1);
    const withPer = song.song.find(b => (b.len || 0) >= 16 && b.period);
    if (withPer) {
      // render the box's own genre with the period armed vs stripped: the
      // period is the thing that makes bar 2 not bar 1, so the streams differ
      const g = GENRES[gk];
      const p = song.slots[withPer.stack[0].slots[0]];
      // the box's period word resolved exactly as ui/derive.js resolves it:
      // the preset's op keys through the registry's own OPS table
      const armed = { ...g,
        period: NF.PERIODS[withPer.period].map(w => w.map(k => NF.OPS[k])) };
      ok(sig(K.render(p, armed, 4)) !== sig(K.render(p, g, 4)),
         gk + ": period \"" + withPer.period + "\" renders byte-identical to no period");
    }
    const withArc = song.song.find(b => (b.len || 0) >= 16 && (b.mot || (b.auto && b.auto.length)));
    if (withArc && withArc.mot)
      ok(["open", "close", "rise", "pump"].includes(withArc.mot),
         gk + ": motion arc \"" + withArc.mot + "\" is not a compilable gesture");
    if (withArc && withArc.auto && withArc.auto.length) {
      const lane = withArc.auto[0];
      const ys = lane.points.map(pt => pt[1]);
      ok(Math.max(...ys) !== Math.min(...ys),
         gk + ": an automation lane that never moves is not an evolution");
    }
    ok(!!(withPer || withArc), gk + ": no long section carries any device at seed 1");
  }
}

/* (b) THE MACHINE LINE */
console.log("the machine line — 32 steps, dense, slid, accented, and actually played");
{
  for (const gk of MACHINES) {
    for (const s of SEEDS) {
      const song = C.compose(gk, s);
      ok(song.slots.length === 10, gk + "/" + s + ": no tenth slot — the machine line was not dealt");
      const q = song.slots[9];
      if (!q) continue;
      ok(q.deg.length === 32 && q.gate.length === 32,
         gk + "/" + s + ": the machine line is " + q.deg.length + " steps, not 32");
      const dens = b => q.gate.slice(b * 16, b * 16 + 16).reduce((a, x) => a + x, 0);
      ok(dens(0) >= 12 && dens(1) >= 12,
         gk + "/" + s + ": the line does not RUN (" + dens(0) + "/" + dens(1) + " of 16 gated)");
      ok(q.sld.reduce((a, x) => a + x, 0) >= 2,
         gk + "/" + s + ": a 303 line with fewer than two slides");
      ok(q.acc.reduce((a, x) => a + x, 0) >= 6,
         gk + "/" + s + ": fewer than six accents across two bars");
      // bar two DEVELOPS bar one — the long pattern evolves inside itself
      ok(JSON.stringify(q.deg.slice(0, 16)) !== JSON.stringify(q.deg.slice(16)),
         gk + "/" + s + ": bar two of the line restates bar one exactly");
      // ...and the record PLAYS it: every verse and drop leads with slot 9
      const vd = song.song.filter(b => b.role === "verse" || b.role === "drop");
      ok(vd.length > 0 && vd.every(b => b.stack[0].slots.includes(9)),
         gk + "/" + s + ": a verse or drop does not play the machine line");
    }
  }
  // ...and nobody else was dealt one: the tenth slot is the machines' own
  for (const gk of ["gospel", "jazz", "beatles", "vaporwave"])
    ok(C.compose(gk, 1).slots.length === 9,
       gk + ": dealt a tenth slot — the machine line leaked out of the machine set");
}

/* (e) THE SIGNATURE MASTERS — "We've lost the sense of true pro mixing per
   genre, those signature sounds." The mastering character varies across the
   catalog, and the named idioms keep their named hand. */
console.log("the signature masters — the catalog is not one compressor");
{
  const sigs = new Set();
  for (const gk of Object.keys(GENRES)) sigs.add(JSON.stringify(C.compose(gk, 1).master));
  ok(sigs.size >= 95, "only " + sigs.size + " distinct master signatures across " +
     Object.keys(GENRES).length + " genres at seed 1 — the catalog is being mastered by one hand");
  // the named hands, structurally: across seeds the row's character holds
  const HAND = { boombap: { glue: ["squash", "pump"] }, jazz: { glue: ["soft", "glue"] },
                 dnb: { ceiling: ["louder", "loud"] }, acid: { glue: ["pump", "tight"] },
                 motown: { tape: ["tape", "warm"] }, punk: { drive: ["dirt", "hair"] } };
  for (const [gk, want] of Object.entries(HAND))
    for (const sd of SEEDS) {
      const m = C.compose(gk, sd).master || {};
      for (const [k, allowed] of Object.entries(want))
        ok(allowed.includes(m[k]), gk + "/" + sd + ": master " + k + " is " +
           JSON.stringify(m[k]) + ", not the idiom's own (" + allowed.join("/") + ")");
    }
}

/* (f) THE HAND LAW — "humanize the drums… it feels like an organic drum
   machine." An acoustic kit's hats spread across a hand's dynamics and
   breathe off the grid; a machine kit stays exact. */
console.log("the hand law — acoustic kits breathe, machines do not");
{
  const P = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
    vel: new Array(16).fill(6), inc: new Array(16).fill(0), stk: new Array(16).fill(0),
    gate: new Array(16).fill(1), acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
  for (const gk of ["bossa", "beatles", "rock", "motown", "funk", "disco"]) {
    const hats = K.drums(P, GENRES[gk], 4).filter(e => e.d === "h");
    if (!hats.length) continue;
    ok(new Set(hats.map(e => e.vel)).size >= 4,
       gk + ": an acoustic kit's hats play " + new Set(hats.map(e => e.vel)).size +
       " loudnesses — the organic drum machine again");
    const off = hats.filter(e => Math.abs(e.t - Math.round(e.t)) > 1e-6).length;
    ok(off >= hats.length / 2, gk + ": only " + off + "/" + hats.length +
       " hat hits breathe off the grid");
  }
  for (const gk of ["acid", "techno", "electro"]) {
    const dr = K.drums(P, GENRES[gk], 4);
    ok(dr.every(e => Math.abs(e.t - Math.round(e.t)) < 1e-6),
       gk + ": a machine kit drifted off the grid — exactness is its identity");
  }
}

console.log(fails ? "\nsixteen-bar: FAIL — " + fails + " of " + (pass + fails)
  : "sixteen-bar: PASS — " + pass + " checks (long sections evolve, machines run a " +
    "32-step line, no effect precedes its own invention, instrumental records stay instrumental)");
process.exit(fails ? 1 : 0);
