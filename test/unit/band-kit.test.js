#!/usr/bin/env node
// test/unit/band-kit.test.js — THE BAND, proven in node.
//
// A drummer and a bass player each have their own page and their own gate.
// This one is about the thing that makes them a BAND rather than two loops
// in the same room: somebody decides the key, the tempo and the form, the
// players stop being asked what is not theirs, and every section of the
// arrangement can differ from the one before it without touching it.
//
//   (a) the seats: an arranger, a drummer, a bass player, one question each
//   (b) WHO OWNS WHAT: the arranger is asked key/mode/form/tempo/feel and
//       the players are never asked them again
//   (c) the form is a SONG: one section per part, the called changes under
//       each, and every section renders something finite
//   (d) THE ARRANGEMENT: a per-section part changes THAT section and no
//       other one — the difference between an arrangement and a loop
//   (e) nothing numeric ever carries a word (the swing-NaN law)
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

const Band = require("../../nukernel/band-kit.js");
const K = require("../../nukernel/kernel.js");
const { MODES } = require("../../nukernel/genres.js");
const P = { deg: new Array(16).fill(0), oct: new Array(16).fill(0),
  vel: new Array(16).fill(6), inc: new Array(16).fill(0), stk: new Array(16).fill(0),
  gate: new Array(16).fill(0), acc: new Array(16).fill(0), sld: new Array(16).fill(0) };
const on = () => ({ ...Band.blank(), on: true });
const play = (g) => ({ drums: K.drums(P, g, g.bars), bass: K.bass(P, g, g.bars) });
const sig = (o) => JSON.stringify(o.drums.map((e) => [+e.t.toFixed(3), e.d, e.vel])) +
                   "|" + JSON.stringify(o.bass.map((e) => [+e.t.toFixed(3), e.n]));

/* (a) THREE SEATS, ONE QUESTION AT A TIME */
console.log("an arranger and two players, each asked what is theirs");
{
  const m = on();
  ok(Band.SEATS.join(",") === "arranger,drums,bass", "the band is " + Band.SEATS.join(","));
  for (const seat of Band.SEATS) {
    const ds = Band.seatDecisions(m, seat);
    ok(ds.length > 0, seat + " is asked nothing");
    for (const d of ds) {
      ok(d.ask.endsWith("?"), seat + ": \"" + d.ask + "\" is not a question");
      ok(d.opts.length >= 2, seat + ": \"" + d.ask + "\" offers one answer");
      const words = d.opts.map((o) => o.w);
      ok(new Set(words).size === words.length,
         seat + ": \"" + d.ask + "\" says the same word twice");
    }
  }
  const first = Band.nextAnywhere(m);
  ok(first && first.seat === "arranger",
     "the band's first question belongs to " + (first && first.seat) + ", not the arranger");
}

/* (b) WHO OWNS WHAT */
console.log("the arranger owns the tune; nobody else is asked for it");
{
  const m = on();
  const arr = Band.seatDecisions(m, "arranger").map((d) => d.id);
  for (const id of ["key", "mode", "form", "tempo", "feel"])
    ok(arr.includes(id), "the arranger is never asked " + id);
  for (const seat of ["drums", "bass"]) {
    const ids = Band.seatDecisions(m, seat).map((d) => d.id);
    for (const taken of Band.TAKEN[seat])
      ok(!ids.includes(taken), "the " + seat + " player is still asked " + taken +
         " — the arranger already decided it");
    ok(ids.length > 0, "the " + seat + " player has nothing left to decide");
  }
}

/* (c) THE FORM IS A SONG */
console.log("every form renders section by section, and the changes are called");
{
  for (const [form, f] of Object.entries(Band.FORMS)) {
    let m = Band.answer(on(), "arranger", "form", f.w);
    ok((m.song.answers || {}).form === f.w, form + ": the form was not recorded");
    // the arranger calls the changes for every role the form contains
    const roles = Band.rolesIn(m);
    for (const r of roles) {
      const d = Band.seatDecisions(m, "arranger").find((x) => x.id === "chg:" + r);
      ok(!!d, form + ": nobody is asked for the " + r + " changes");
      if (d) m = Band.answer(m, "arranger", d.id, d.opts[1].w);
    }
    const secs = Band.toSong(m, MODES);
    ok(secs.length === f.secs.length,
       form + ": " + secs.length + " sections for a form of " + f.secs.length);
    ok(secs.map((s) => s.role).join(",") === f.secs.join(","),
       form + ": the sections came out " + secs.map((s) => s.role).join(","));
    for (const s of secs) {
      ok(s.bars > 0, form + "/" + s.role + ": a section of " + s.bars + " bars");
      const o = play(s.genre);
      ok(o.drums.length + o.bass.length > 0, form + "/" + s.role + " is silent");
      for (const e of o.drums)
        ok(Number.isFinite(e.t) && Number.isFinite(e.vel),
           form + "/" + s.role + ": a drum hit at " + e.t + " vel " + e.vel);
      for (const e of o.bass)
        ok(Number.isFinite(e.t) && Number.isFinite(e.n),
           form + "/" + s.role + ": a bass note at " + e.t + " pitch " + e.n);
    }
    // an intro is the band arriving: no backbeat until the tune starts
    if (f.secs[0] === "intro")
      ok(!(secs[0].genre.kit.s || []).some(Boolean),
         form + ": the intro came in with the backbeat already going");
  }
}

/* ...and every answer any seat can give still renders */
console.log("every answer in the book renders finite events");
{
  for (const seat of Band.SEATS) {
    for (const d of Band.seatDecisions(on(), seat)) {
      for (const o of d.opts) {
        const m = Band.answer(on(), seat, d.id, o.w);
        ok(m !== undefined, seat + "/" + d.id + ": \"" + o.w + "\" was refused");
        for (const s of Band.toSong(m, MODES)) {
          const ev = play(s.genre);
          const bad = ev.drums.filter((e) => !Number.isFinite(e.t) || !Number.isFinite(e.vel))
            .concat(ev.bass.filter((e) => !Number.isFinite(e.t) || !Number.isFinite(e.n)));
          ok(bad.length === 0, seat + "/" + d.id + " \"" + o.w + "\": " + bad.length +
             " events that are not numbers in the " + s.role);
        }
      }
    }
  }
}

/* (d) THE ARRANGEMENT: a section is its own */
console.log("what happens in the chorus stays in the chorus");
{
  let m = Band.answer(on(), "arranger", "form", Band.FORMS.pop.w);
  const before = Band.toSong(m, MODES).map((s) => sig(play(s.genre)));
  const asks = Band.sectionAsks(m, 1);
  ok(asks.map((a) => a.id).join(",") === "drums,bass",
     "a section asks " + asks.map((a) => a.id).join(","));
  let movers = 0;
  for (const a of asks) {
    ok(a.opts.some((o) => o.answered), a.who + ": nothing is the default in a fresh section");
    for (const o of a.opts) {
      const m2 = Band.setSection(m, 1, a.id, o.key);
      const after = Band.toSong(m2, MODES).map((s) => sig(play(s.genre)));
      for (let i = 0; i < after.length; i++)
        if (i !== 1) ok(after[i] === before[i],
          "\"" + o.w + "\" in section 1 changed section " + i + " as well");
      if (o.key !== "same" && after[1] !== before[1]) movers++;
      // ...and the section it changed still plays something a machine can read
      for (const s of Band.toSong(m2, MODES)) {
        const ev = play(s.genre);
        ok(ev.drums.every((e) => Number.isFinite(e.t)) &&
           ev.bass.every((e) => Number.isFinite(e.n)),
           "\"" + o.w + "\": the " + s.role + " stopped being finite");
      }
    }
  }
  // A PART THAT IS ALREADY WHAT YOU ARE DOING CHANGES NOTHING, and that is
  // honest, not broken: the bassist's default job pedals the root, so
  // "pedal the root" in a section is a no-op. What must be true is that the
  // section CAN be made different — most of the words move it.
  ok(movers >= 8, "only " + movers + " of the section's parts changed the section");

  // two players, two parts, in the same section
  const both = Band.setSection(Band.setSection(m, 1, "drums", "half"), 1, "bass", "pedal");
  const secs = Band.toSong(both, MODES);
  ok(secs[1].per.drums === "half" && secs[1].per.bass === "pedal",
     "a section cannot hold both players' parts at once");
  ok(sig(play(secs[0].genre)) === before[0], "arranging the chorus moved the verse");
  // and saying "same as before" puts it back
  const undone = Band.setSection(Band.setSection(both, 1, "drums", "same"), 1, "bass", "same");
  ok(sig(play(Band.toSong(undone, MODES)[1].genre)) === before[1],
     "\"same as before\" did not put the section back");
}

/* (e) NOTHING NUMERIC CARRIES A WORD */
// The swing NaN: the genre once held the WORD "swing" where the kernel
// computes (i % 2) * (g.swing || 0), and every time in the record became
// NaN. Any numeric field is a number here or the band does not play.
console.log("no word ever sits in a numeric field");
{
  const NUM = ["swing", "humanize", "bars", "rate", "voices", "key", "bpm"];
  let checked = 0;
  for (const seat of Band.SEATS)
    for (const d of Band.seatDecisions(on(), seat))
      for (const o of d.opts) {
        const m = Band.answer(on(), seat, d.id, o.w);
        for (const s of Band.toSong(m, MODES))
          for (const k of NUM) {
            const v = s.genre[k];
            checked++;
            ok(v === undefined || v === null || typeof v === "number",
               seat + "/" + d.id + " \"" + o.w + "\": genre." + k + " is " + JSON.stringify(v));
          }
      }
  ok(checked > 100, "only " + checked + " numeric fields were looked at");
}

console.log(fails ? `\nband-kit: FAIL — ${fails} of ${pass + fails}`
  : `\nband-kit: PASS — ${pass} checks (three seats, the arranger owns the tune, every form plays, a section is its own)`);
process.exit(fails ? 1 : 0);
