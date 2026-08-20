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
  ok(asks.map((a) => a.id).join(",") === "drums,dwords,bass,bwords,band",
     "a section asks " + asks.map((a) => a.id).join(","));
  let movers = 0;
  for (const a of asks) {
    // the two PART questions always have an answer — the role's own, if
    // nobody said anything. The word lists start with nothing said, which is
    // exactly what "nothing different here" looks like.
    if (a.id === "drums" || a.id === "bass")
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

/* (f) THE ARRANGER CALLS THE GENRE, and it NARROWS the players */
// A bandleader says "it's a jazz date" before anybody plays. Everything a
// row here names has to be a word the player actually knows — the LINN DRUM
// lesson, where a machine word named a kit the engine did not have — and the
// narrowing has to leave the player something to decide, or the arranger is
// playing the drums.
console.log("the genre is called first, and it narrows without deciding");
{
  const m0 = on();
  const first = Band.nextAnywhere(m0);
  ok(first && first.id === "genre",
     "the band's first question is " + (first && first.id) + ", not the genre");
  const arr = Band.seatDecisions(m0, "arranger");
  const gq = arr.find((d) => d.id === "genre");
  ok(!!gq && gq.opts.length >= 8, "only " + (gq ? gq.opts.length : 0) + " records to call");

  // the words each player knows, to hold the table against
  const D = Band.D, B = Band.B;
  const dm = { ...Band.blank().drums, on: true };
  const grooveWords = new Set(D.catalog(dm, null)
    .filter((i) => i.group.startsWith("grooves")).map((i) => i.words[0]));
  const machineWords = new Set(D.catalog(dm, null)
    .filter((i) => i.group === "the machine").map((i) => i.words[0]));
  const styleWords = new Set(Object.values(B.STYLEWORD));
  const instrWords = new Set(Object.values(B.INSTRUMENTS));
  const changeWords = new Set(Object.values(B.CHANGEWORD));

  for (const [key, gk] of Object.entries(Band.GENRES)) {
    ok(!!gk.w && !!gk.fam, key + " is not a record anybody can call");
    for (const w of gk.grooves) ok(grooveWords.has(w), key + ": no drummer knows \"" + w + "\"");
    for (const w of gk.machines) ok(machineWords.has(w), key + ": there is no machine called \"" + w + "\"");
    for (const w of gk.styles) ok(styleWords.has(w), key + ": no bassist knows \"" + w + "\"");
    for (const w of gk.instr) ok(instrWords.has(w), key + ": there is no bass called \"" + w + "\"");
    for (const w of gk.chg) ok(changeWords.has(w), key + ": there are no changes called \"" + w + "\"");
    ok(gk.grooves.length >= 2, key + " leaves the drummer " + gk.grooves.length + " groove");
    ok(gk.machines.length >= 2, key + " leaves the drummer " + gk.machines.length + " machine");
    ok(gk.styles.length >= 2, key + " leaves the bassist " + gk.styles.length + " line");
    ok(gk.instr.length >= 2, key + " leaves the bassist " + gk.instr.length + " instrument");

    // CALLED: the record narrows what the players are offered, and every
    // groove offered belongs to the family the arranger named
    const m = Band.answer(on(), "arranger", "genre", gk.w);
    ok(m.drums.fam === gk.fam, key + ": the drummer was told " + m.drums.fam);
    ok(!Band.seatDecisions(m, "drums").some((d) => d.id === "record"),
       key + ": the drummer is still asked what kind of record this is");
    const offered = (seat, id) => {
      const d = Band.seatDecisions(m, seat).find((x) => x.id === id);
      return d ? d.opts.map((o) => o.w) : [];
    };
    for (const [seat, id, allow] of [["drums", "groove", gk.grooves],
                                     ["bass", "job", gk.styles],
                                     ["bass", "instr", gk.instr]]) {
      const opts = offered(seat, id);
      ok(opts.length >= 2, key + "/" + id + ": the player is left " + opts.length + " answer");
      for (const w of opts) ok(allow.includes(w),
        key + "/" + id + ": \"" + w + "\" is not this kind of record");
    }
    // ...and the words beyond the interview are narrowed the same way
    const cat = Band.catalog(m, "drums");
    for (const i of cat) {
      if (i.group.startsWith("grooves")) ok(gk.grooves.includes(i.words[0]),
        key + ": the tray still offers the groove \"" + i.words[0] + "\"");
      if (i.group === "the machine") ok(gk.machines.includes(i.words[0]),
        key + ": the tray still offers the machine \"" + i.words[0] + "\"");
    }
    ok(cat.some((i) => i.group === "at the kit"),
       key + ": narrowing took the drummer's own hands away");
    // the record still plays
    for (const sec of Band.toSong(m, MODES)) {
      const ev = play(sec.genre);
      ok(ev.drums.length + ev.bass.length > 0, key + ": the " + sec.role + " is silent");
      ok(ev.drums.every((e) => Number.isFinite(e.t) && Number.isFinite(e.vel)) &&
         ev.bass.every((e) => Number.isFinite(e.t) && Number.isFinite(e.n)),
         key + ": the " + sec.role + " is not finite");
    }
  }
  // A PLAYER STILL CHOOSES. Calling the record must not answer the player's
  // own questions for them.
  const jazz = Band.answer(on(), "arranger", "genre", "a jazz date");
  ok(Band.nextAsk(jazz, "drums") !== null, "the drummer has nothing left to decide");
  ok(Band.nextAsk(jazz, "bass") !== null, "the bassist has nothing left to decide");
}

/* (g) HOW SLOW IT CAN GO */
// One kick per four measures, one bass note per four measures, and the note
// HOLDS across the gap. Tempo is not the axis here — a schedule is.
console.log("a band can leave four measures between two notes");
{
  let m = Band.answer(on(), "arranger", "genre", "a rock record");
  const full = Band.toSong(m, MODES)[0];
  const fullEv = play(full.genre);
  const counts = {};
  for (const [key, sp] of Object.entries(Band.SPACE)) {
    const m2 = Band.answer(m, "arranger", "space", sp.w);
    ok((m2.song.answers || {}).space === sp.w, key + ": the space was not recorded");
    const sec = Band.toSong(m2, MODES)[0];
    const ev = play(sec.genre);
    counts[key] = [ev.drums.length, ev.bass.length];
    ok(ev.drums.every((e) => Number.isFinite(e.t)) && ev.bass.every((e) => Number.isFinite(e.n)),
       key + " does not render finite events");
  }
  ok(counts.none[0] === fullEv.drums.length && counts.none[1] === fullEv.bass.length,
     "\"keep it going\" changed the band");
  ok(counts.half[0] < counts.none[0] && counts.half[1] < counts.none[1],
     "a bar on and a bar off is as busy as before: " + JSON.stringify(counts));
  ok(counts.bar[0] < counts.half[0], "one hit a bar is busier than half of one");
  ok(counts.four[0] === 1, "one hit every four bars played " + counts.four[0] + " drum hits");
  ok(counts.four[1] === 1, "one hit every four bars played " + counts.four[1] + " bass notes");
  // ...and the one hit each is a KICK and a note that lasts
  const sec = Band.toSong(Band.answer(m, "arranger", "space", "one hit every four bars"), MODES)[0];
  const ev = play(sec.genre);
  ok(ev.drums[0].d === "k" && ev.drums[0].t === 0,
     "the one hit in four bars is a " + ev.drums[0].d + " at " + ev.drums[0].t);
  ok(ev.bass[0].dur > 48, "the bass note lasts " + ev.bass[0].dur.toFixed(1) +
     " steps — it stopped instead of holding");
  // a section can still say something different in all that space
  const busy = Band.setSection(
    Band.answer(m, "arranger", "space", "one hit every four bars"), 0, "drums", "busier");
  ok(play(Band.toSong(busy, MODES)[0].genre).drums.length > 1,
     "a section that asked to be busier stayed empty");
  // and every form survives the sparsest setting
  for (const [form, f] of Object.entries(Band.FORMS)) {
    const m3 = Band.answer(Band.answer(m, "arranger", "form", f.w),
                           "arranger", "space", "one hit every four bars");
    for (const s2 of Band.toSong(m3, MODES)) {
      const ev2 = play(s2.genre);
      ok(ev2.drums.every((e) => Number.isFinite(e.t)) && ev2.bass.every((e) => Number.isFinite(e.n)),
         form + "/" + s2.role + " is not finite at its sparsest");
      ok(ev2.drums.length + ev2.bass.length >= 1,
         form + "/" + s2.role + " went completely silent");
    }
  }
}

/* (h) A SECTION ARRIVES WITH ITS PART ALREADY IN IT */
// Nobody in a band asks what to play in the intro. A chorus is bigger than
// the verse, a bridge goes somewhere else, an outro thins out, and somebody
// plays a fill into every change — before a word is said about any of it.
console.log("a chorus is bigger than the verse before anybody says so");
{
  const m = Band.answer(Band.answer(on(), "arranger", "genre", "a rock record"),
                        "arranger", "form", Band.FORMS.full.w);
  const secs = Band.toSong(m, MODES);
  const by = {};
  secs.forEach((s2) => { by[s2.role] = by[s2.role] || play(s2.genre); });
  ok(by.chorus.drums.length > by.verse.drums.length,
     "the chorus (" + by.chorus.drums.length + ") is no bigger than the verse (" +
     by.verse.drums.length + ")");
  ok(by.intro.drums.length < by.verse.drums.length, "the intro comes in at full size");
  ok(by.outro.drums.length < by.verse.drums.length, "the outro goes out at full size");
  ok(sig(by.bridge) !== sig(by.verse), "the bridge is the verse again");
  // every default part is a part the section could have been TOLD to play —
  // no role invents vocabulary of its own
  for (const [role, d] of Object.entries(Band.ROLE)) {
    if (d.drums) ok(!!Band.SECDRUMS[d.drums], role + " defaults the drums to " + d.drums);
    if (d.bass) ok(!!Band.SECBASS[d.bass], role + " defaults the bass to " + d.bass);
  }
  // THE FILL INTO THE CHANGE: the last bar of a section followed by a
  // different one, and nowhere else
  const tomsIn = (g) => (g.kits || [g.kit]).map((bar) => ((bar.t || []).some(Boolean) ? 1 : 0));
  secs.forEach((s2, i) => {
    const next = secs[i + 1], lift = tomsIn(s2.genre);
    if (next && next.role !== s2.role) {
      ok(lift[lift.length - 1] === 1, s2.role + " does not play the band into the " + next.role);
      ok(lift.slice(0, -1).every((x) => !x), s2.role + " fills in a bar that is not the last one");
    } else if (!next) ok(lift.every((x) => !x), "the last section fills into nothing");
  });
  // ...and it can be called off, which is a thing a band says
  const no = Band.setSection(m, 1, "band", "lift");
  ok(tomsIn(Band.toSong(no, MODES)[1].genre).every((x) => !x),
     "\"give it a lift\" said in reverse still filled");
  // FOLLOW THE KICK: the bass plays where the kick plays — one player asking
  // another for something neither can do alone
  const f = Band.setSection(m, 1, "band", "follow");
  const sec = Band.toSong(f, MODES)[1];
  const kicks = (sec.genre.kits || [sec.genre.kit])
    .reduce((n, b2) => n + (b2.k || []).filter(Boolean).length, 0);
  const notes = play(sec.genre).bass.length;
  ok(notes === kicks, "following the kick played " + notes + " notes over " + kicks + " kicks");
}

/* (i) A MUSICIAN CAN SIT OUT */
// The oldest arrangement instruction there is: sayable per instrument, per
// section, and it leaves everybody else playing.
console.log("anybody can sit out a section, and the rest of the band plays on");
{
  const m = Band.answer(Band.answer(on(), "arranger", "genre", "a rock record"),
                        "arranger", "form", Band.FORMS.pop.w);
  const base = Band.toSong(m, MODES).map((s2) => play(s2.genre));
  const dOut = Band.toSong(Band.setSection(m, 1, "drums", "nokit"), MODES).map((s2) => play(s2.genre));
  const bOut = Band.toSong(Band.setSection(m, 1, "bass", "out"), MODES).map((s2) => play(s2.genre));
  ok(dOut[1].drums.length === 0, "the drummer sat out and still played " + dOut[1].drums.length);
  ok(dOut[1].bass.length === base[1].bass.length, "the drummer sitting out took the bass with them");
  ok(bOut[1].bass.length === 0, "the bassist sat out and still played " + bOut[1].bass.length);
  ok(bOut[1].drums.length === base[1].drums.length, "the bassist sitting out took the drums with them");
  for (const [w, out] of [["drums", dOut], ["bass", bOut]])
    for (let i = 0; i < base.length; i++)
      if (i !== 1) ok(sig(out[i]) === sig(base[i]),
        "the " + w + " sitting out of the chorus changed section " + i);
  const both = Band.toSong(Band.setSection(Band.setSection(m, 1, "drums", "nokit"),
                                           1, "bass", "out"), MODES).map((s2) => play(s2.genre));
  ok(both[1].drums.length + both[1].bass.length === 0, "the whole band could not drop out");
  ok(both[0].drums.length > 0, "everybody dropped out everywhere");
}

/* (j) A SECTION IS ARRANGED IN THE PLAYERS' OWN WORDS */
// "Swap hands", "ride it", "ghost the snare" — a bandleader does not hand a
// drummer eight canned options for the chorus, they say the things a drummer
// says. Said once it lands on that section; said again it is taken back; the
// player's song-wide decisions never move.
console.log("a section is arranged in the players' own words");
{
  const m = Band.answer(Band.answer(on(), "arranger", "genre", "a rock record"),
                        "arranger", "form", Band.FORMS.pop.w);
  const base = Band.toSong(m, MODES).map((s2) => play(s2.genre));
  for (const who of ["dwords", "bwords"]) {
    const a = Band.sectionAsks(m, 1).find((x) => x.id === who);
    ok(!!a && a.opts.length >= 6, who + ": a section is offered " +
       (a ? a.opts.length : 0) + " of the player's own words");
    let moved = 0;
    for (const o of a.opts.slice(0, 12)) {
      const m2 = Band.setSection(m, 1, who, o.key);
      const after = Band.toSong(m2, MODES).map((s2) => play(s2.genre));
      if (sig(after[1]) !== sig(base[1])) moved++;
      for (let i = 0; i < after.length; i++)
        if (i !== 1) ok(sig(after[i]) === sig(base[i]),
          "\"" + o.w + "\" said about the chorus changed section " + i);
      ok(after.every((x) => x.drums.every((e) => Number.isFinite(e.t)) &&
                            x.bass.every((e) => Number.isFinite(e.n))),
         "\"" + o.w + "\" made something unplayable");
      const back = Band.setSection(m2, 1, who, o.key);
      ok(sig(play(Band.toSong(back, MODES)[1].genre)) === sig(base[1]),
         "\"" + o.w + "\" could not be taken back");
      ok(JSON.stringify(m2.drums) === JSON.stringify(m.drums) &&
         JSON.stringify(m2.bass) === JSON.stringify(m.bass),
         "\"" + o.w + "\" said about one section changed the player for the whole song");
    }
    ok(moved >= 4, who + ": only " + moved + " of the player's words changed the section");
  }
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
