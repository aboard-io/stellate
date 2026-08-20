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
const ENGIDS = Band.ENG.map((d) => d.id);   // (the engineer's own question ids)
const play = (g) => ({ drums: K.drums(P, g, g.bars), bass: K.bass(P, g, g.bars) });
const sig = (o) => JSON.stringify(o.drums.map((e) => [+e.t.toFixed(3), e.d, e.vel])) +
                   "|" + JSON.stringify(o.bass.map((e) => [+e.t.toFixed(3), e.n]));

/* (a) THREE SEATS, ONE QUESTION AT A TIME */
console.log("an arranger and two players, each asked what is theirs");
{
  const m = on();
  ok(Band.SEATS.join(",") === "arranger,drums,bass,keys,guitar,engineer",
     "the band is " + Band.SEATS.join(","));
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
  ok(asks.map((a) => a.id).join(",") ===
     // ordered so the arrangement decisions come first and the players'
     // whole vocabularies sit underneath — the melody was ninth of twelve
     "idea,drums,keys,guitar,bass,pipe,mix,move,band,dwords,kwords,gwords,bwords",
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
  // THE FRONT DOOR IS NOT A MENU. Nobody starts a session by picking a
  // genre off a list of fifteen — they know when it is, where they are and
  // what room they are playing, and the record is what those add up to.
  const first = Band.nextAnywhere(m0);
  ok(first && first.id === "when",
     "the band's first question is " + (first && first.id) + ", not the decade");
  for (const [f, ask] of Band.FIELDS3) {
    const d = Band.seatDecisions(m0, "arranger").find((x) => x.id === f);
    ok(!!d && d.ask === ask, "nobody is asked \"" + ask + "\"");
    ok(d.opts.length >= 2, ask + " offers " + d.opts.length + " answer(s)");
  }
  // ...and every record is reachable through it
  const reach = new Set();
  for (const [k, gk] of Object.entries(Band.GENRES)) {
    ok(Array.isArray(gk.when) && gk.when.length, k + " comes from no decade");
    ok(Array.isArray(gk.where) && gk.where.length, k + " comes from nowhere");
    ok(Array.isArray(gk.venue) && gk.venue.length, k + " is played nowhere");
    for (const w of gk.when)
      for (const p of gk.where)
        for (const v of gk.venue) {
          const left = Band.survivors({ when: w, where: p, venue: v });
          ok(left.length >= 1, k + ": " + w + "/" + p + "/" + v + " leads to nothing");
          if (left.some(([k2]) => k2 === k)) reach.add(k);
        }
  }
  ok(reach.size === Object.keys(Band.GENRES).length,
     "only " + reach.size + " of " + Object.keys(Band.GENRES).length +
     " records can be arrived at");
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
  // it rings for a bar and leaves three bars of air — a held gate is not an
  // envelope, and four bars of unbroken tone is a drone, not a bass note
  ok(ev.bass[0].dur > 12 && ev.bass[0].dur <= 16,
     "the bass note lasts " + ev.bass[0].dur.toFixed(1) + " steps — a bar is 16");
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

/* (k) EVERY RECORD HAS A BASS SOUND, AND THE NOTES HAVE ENDS */
// The bass chair was handed no tone at all, so a synth bass ran on the
// engine's defaults in every genre — no filter of its own, and a gate as
// long as the note ("the synth bass just plays continually"). A record names
// its own filter, its own decay and how long its notes are held.
console.log("every record says what its bass sounds like");
{
  for (const [key, gk] of Object.entries(Band.GENRES)) {
    ok(gk.tone && gk.tone.cut >= 60 && gk.tone.cut <= 16000,
       key + ": a bass cutoff of " + (gk.tone && gk.tone.cut));
    ok(gk.tone.q >= 0.7 && gk.tone.q <= 12, key + ": a bass q of " + gk.tone.q);
    ok(gk.tone.rel >= 0.05 && gk.tone.rel <= 2.8, key + ": a bass decay of " + gk.tone.rel);
    ok(["staccato", "normal", "legato"].includes(gk.artic),
       key + ": the bass notes are held \"" + gk.artic + "\"");
    const m = Band.answer(on(), "arranger", "genre", gk.w);
    const g = Band.toSong(m, MODES)[0].genre;
    ok(g.bassTone && g.bassTone.cut === gk.tone.cut,
       key + ": the record's bass tone does not reach the section");
    ok(g.bassArtic === gk.artic, key + ": the record's note length does not reach the section");
    // a plucked record really is shorter than a ringing one, in the render
    const notes = play(g).bass;
    const first = notes[0];
    ok(first && first.dur > 0, key + ": the first bass note has no length");
    // THE GAP IS THE RECORD'S OWN. A quarter is not the unit here — a reggae
    // bubble puts its notes three sixteenths apart, and a note that fills a
    // three-step gap is as legato as one that fills four.
    const gap = notes.length > 1 ? notes[1].t - notes[0].t : 4;
    if (gk.artic === "staccato") ok(first.dur < gap * 0.7,
      key + ": a staccato bass note lasts " + first.dur.toFixed(2) +
      " of a " + gap.toFixed(2) + "-step gap");
    if (gk.artic === "legato") ok(first.dur >= gap * 0.9,
      key + ": a ringing bass note lasts " + first.dur.toFixed(2) +
      " of a " + gap.toFixed(2) + "-step gap");
  }
  // ...and the player still outranks the record
  const m = Band.answer(on(), "arranger", "genre", "a house record");
  const said = Band.answer(m, "bass", "notes", "let them ring");
  ok(Band.toSong(said, MODES)[0].genre.bassArtic === "legato",
     "a bassist told to let them ring is still playing the record's staccato");
}

/* (l) SOMEBODY IS MIXING THIS */
// A band in a room is four jobs. How close the mics are, how big the kick
// is, whether the snare has a plate on it and how hard the whole thing is
// squeezed are decisions no amount of drumming makes.
console.log("the engineer has the fourth chair, and it lands on the desk");
{
  const CHAN = /^(drums|bass|lead|master|unit:[a-z]+)$/;
  const KEYS = ["fader", "rev", "del", "pan", "eq", "mute",
                "glue", "drive", "tape", "space"];
  ok(Band.SEATS.includes("engineer"), "there is nobody mixing this");
  const m0 = on();
  const ds = Band.seatDecisions(m0, "engineer");
  ok(ds.length >= 6, "the engineer is asked " + ds.length + " things");
  for (const d of ds) {
    ok(d.ask.endsWith("?"), "\"" + d.ask + "\" is not a question");
    ok(d.opts.length >= 2, "\"" + d.ask + "\" offers one answer");
    for (const o of d.opts) {
      ok(o.mix && typeof o.mix === "object", d.id + "/" + o.w + " says nothing to the desk");
      for (const [chan, vals] of Object.entries(o.mix)) {
        ok(CHAN.test(chan), d.id + "/" + o.w + ": \"" + chan + "\" is not a channel the desk has");
        for (const [k, v] of Object.entries(vals)) {
          ok(KEYS.includes(k), d.id + "/" + o.w + ": the desk has no \"" + k + "\"");
          if (k === "eq") for (const [b2, db] of Object.entries(v))
            ok(["lo", "mid", "hi"].includes(b2) && Math.abs(db) <= 12,
               d.id + "/" + o.w + ": eq " + b2 + " " + db);
          else if (["rev", "del", "glue", "drive", "tape", "space"].includes(k))
            ok(v >= 0 && v <= 1, d.id + "/" + o.w + ": " + k + " " + v + " is outside 0..1");
          else if (k === "fader") ok(Math.abs(v) <= 12, d.id + "/" + o.w + ": a " + v + " dB fader");
        }
      }
    }
  }
  // the seats do not do each other's jobs
  for (const d of ds) ok(!["key", "form", "groove", "job", "tempo"].includes(d.id),
    "the engineer is deciding " + d.id);
  for (const seat of ["arranger", "drums", "bass"])
    for (const d of Band.seatDecisions(m0, seat))
      ok(!ENGIDS.includes(d.id), "the " + seat + " chair is being asked " + d.id);
  // an empty board until somebody says something
  ok(Object.keys(Band.mixOf(m0)).length === 0, "the board is not flat before anybody touches it");
  // ...and every answer lands on it
  for (const d of ds)
    for (const o of d.opts) {
      const m = Band.answer(m0, "engineer", d.id, o.w);
      ok((m.eng || {})[d.id] === o.w, d.id + ": \"" + o.w + "\" was not recorded");
      ok(JSON.stringify(Band.mixOf(m)) === JSON.stringify(o.mix),
         d.id + "/" + o.w + ": the desk heard " + JSON.stringify(Band.mixOf(m)));
      // ...and mixing changes nothing about what anybody PLAYS
      ok(JSON.stringify(Band.toSong(m, MODES).map((s2) => sig(play(s2.genre)))) ===
         JSON.stringify(Band.toSong(m0, MODES).map((s2) => sig(play(s2.genre)))),
         d.id + "/" + o.w + ": mixing the record changed the notes");
    }
  // two hands on the same channel add rather than replace
  const both = Band.answer(Band.answer(m0, "engineer", "room", "down the hall"),
                           "engineer", "snare", "a plate on it");
  const mix = Band.mixOf(both);
  ok(mix["unit:snare"] && mix["unit:snare"].del > 0 && mix["unit:snare"].rev > 0,
     "two answers on the snare did not stack: " + JSON.stringify(mix["unit:snare"]));
  ok(mix.drums && mix.drums.rev === 0.5, "the room went missing when the snare was set");
}

/* (m) THE FORMS ARE THE RECORD'S OWN, and so is the line */
// A house record has no bridge. Song forms and dance forms are different
// shapes with different words, and offering "AABA" for a twelve-inch was the
// same mistake as offering a jazz ride to a punk drummer.
console.log("a house record has no bridge, and every record brings its own line");
{
  for (const [key, gk] of Object.entries(Band.GENRES)) {
    ok(Array.isArray(gk.forms) && gk.forms.length >= 2,
       key + " offers " + ((gk.forms || []).length) + " forms");
    for (const f of gk.forms) ok(!!Band.FORMS[f], key + ": there is no form called " + f);
    const m = Band.answer(on(), "arranger", "genre", gk.w);
    const fq = Band.seatDecisions(m, "arranger").find((d) => d.id === "form");
    ok(fq.opts.length === gk.forms.length,
       key + ": the form question offers " + fq.opts.length + " of " + gk.forms.length);
    for (const o of fq.opts)
      ok(gk.forms.some((f) => Band.FORMS[f].w === o.w),
         key + ": \"" + o.w + "\" is not a form this record has");
    // every form it names plays, section by section, with its changes called
    for (const f of gk.forms) {
      let m2 = Band.answer(m, "arranger", "form", Band.FORMS[f].w);
      for (const r of Band.rolesIn(m2)) {
        const d = Band.seatDecisions(m2, "arranger").find((x) => x.id === "chg:" + r);
        ok(!!d, key + "/" + f + ": nobody is asked for the " + r + " changes");
        if (d) m2 = Band.answer(m2, "arranger", d.id, d.opts[0].w);
      }
      const secs = Band.toSong(m2, MODES);
      ok(secs.length === Band.FORMS[f].secs.length, key + "/" + f + ": wrong length");
      for (const s2 of secs) {
        const ev = play(s2.genre);
        ok(ev.drums.every((e) => Number.isFinite(e.t)) && ev.bass.every((e) => Number.isFinite(e.n)),
           key + "/" + f + "/" + s2.role + " is not finite");
        // every role a form uses has a part of its own, or is the plain one
        ok(s2.role === "verse" || s2.role === "head" || Band.ROLE[s2.role],
           key + "/" + f + ": nobody knows what a " + s2.role + " is");
      }
    }
  }
  // THE LINE: a figure is a written-out bass part, and a record brings one
  const B2 = Band.B;
  for (const [key, gk] of Object.entries(Band.GENRES)) {
    if (!gk.fig) continue;
    ok(!!B2.FIGURES[gk.fig], key + ": there is no figure called " + gk.fig);
    const g = Band.toSong(Band.answer(on(), "arranger", "genre", gk.w), MODES)[0].genre;
    ok(g.bassFig && JSON.stringify(g.bassFig.grid) === JSON.stringify(B2.FIGURES[gk.fig].grid),
       key + ": the record's figure does not reach the section");
    const notes = play(g).bass;
    ok(notes.length > 0, key + ": the figure plays nothing");
    ok(notes.some((e) => e.acc), key + ": the figure has no accents in the render");
  }
  // ...and an acid line is what an acid line is: sixteenths, octaves, slides
  const acid = B2.FIGURES.acid;
  const g = { ...Band.toSong(Band.answer(on(), "arranger", "genre", "a techno record"), MODES)[0].genre };
  const ev = play(g).bass;
  ok(ev.some((e) => e.sld), "an acid line with nothing sliding");
  ok(new Set(ev.map((e) => e.n)).size > 1, "an acid line on one note");
  ok(ev.length >= acid.grid.filter(Boolean).length, "the acid line lost notes on the way");
}

/* (n) A SECTION CAN BE MIXED, TOO */
// "The engineer doesn't seem to be able to adjust sections." A section's own
// strip is not the offset board — it is the box fields nukernel's song has
// always carried, composed under everything else by audio/desk.js.
console.log("a breakdown can go wet without the verse moving");
{
  let m = Band.answer(Band.answer(on(), "arranger", "genre", "a house record"),
                      "arranger", "form", Band.FORMS.twelve.w);
  const boxes = () => Band.toSong(m, MODES).map((s2) => JSON.stringify(s2.box));
  const before = boxes();
  const ask = Band.sectionAsks(m, 1).find((a) => a.id === "mix");
  ok(!!ask && ask.opts.length >= 6, "a section is offered " +
     (ask ? ask.opts.length : 0) + " mix moves");
  ok(ask.opts.some((o) => o.answered), "a section arrives with no mix at all");
  for (const o of ask.opts) {
    const m2 = Band.setSection(m, 1, "mix", o.key);
    const after = Band.toSong(m2, MODES);
    for (let i = 0; i < after.length; i++)
      if (i !== 1) ok(JSON.stringify(after[i].box) === before[i],
        "\"" + o.w + "\" on the build changed section " + i);
    const box = after[1].box;
    if (o.key !== "same") {
      ok(box && Object.keys(box).length > 0, "\"" + o.w + "\" said nothing to the desk");
      for (const [k, v] of Object.entries(box || {})) {
        ok(["lvl", "rev", "echo", "fx", "pan", "verb", "mot"].includes(k),
           "\"" + o.w + "\": a box has no \"" + k + "\"");
        if (k === "lvl") ok(["hush", "back", "norm", "fwd"].includes(v), "lvl " + v);
        if (k === "rev" || k === "echo")
          ok(["none", "touch", "some", "wet", "drown"].includes(v), k + " " + v);
        if (k === "fx") ok(Array.isArray(v), "fx is not a list");
      }
    }
    // ...and mixing a section changes nobody's part
    ok(JSON.stringify(after.map((x) => sig(play(x.genre)))) ===
       JSON.stringify(Band.toSong(m, MODES).map((x) => sig(play(x.genre)))),
       "\"" + o.w + "\" changed what somebody plays");
  }
  // THE FILTER MOVES, and it is the engineer's signature move on a dance
  // record — the reason a build sounds like a build rather than a loop with
  // more hats on it.
  {
    const ask2 = Band.sectionAsks(m, 1).find((a) => a.id === "move");
    ok(!!ask2 && ask2.opts.length >= 4, "a section is offered " +
       (ask2 ? ask2.opts.length : 0) + " ways for the filter to move");
    for (const o of ask2.opts) {
      const m2 = Band.setSection(m, 1, "move", o.key);
      const box = Band.toSong(m2, MODES)[1].box || {};
      if (o.key === "none") ok(!box.mot, "\"no movement\" still swept");
      else ok(["open", "close", "rise", "pump"].includes(box.mot),
        "\"" + o.w + "\" wrote mot=" + box.mot);
      // ...and it changes nobody's notes
      ok(JSON.stringify(Band.toSong(m2, MODES).map((x) => sig(play(x.genre)))) ===
         JSON.stringify(Band.toSong(m, MODES).map((x) => sig(play(x.genre)))),
         "\"" + o.w + "\" changed what somebody plays");
    }
    // a build rises and a drop opens without anybody saying so
    const secs2 = Band.toSong(m, MODES);
    ok((secs2.find((x) => x.role === "build").box || {}).mot === "rise",
       "a build does not rise");
    ok((secs2.find((x) => x.role === "drop").box || {}).mot === "open",
       "a drop does not open up");
  }

  // ...and the BASS can reach the effects, which it could not at all
  {
    const q = Band.seatDecisions(on(), "engineer").find((d) => d.id === "bassfx");
    ok(!!q, "the engineer cannot put anything on the bass");
    const wet = q.opts.filter((o) => Object.keys(o.mix).length);
    ok(wet.length >= 3, "only " + wet.length + " things can be done to the bass");
    for (const o of wet) {
      const mix = Band.mixOf(Band.answer(on(), "engineer", "bassfx", o.w));
      ok(mix.bass && Object.keys(mix.bass).length,
         "\"" + o.w + "\" did not reach the bass channel");
    }
  }

  // a breakdown is wet and an outro is back before anybody says so
  const secs = Band.toSong(m, MODES);
  ok(secs.find((s2) => s2.role === "break").box, "a breakdown arrives dry as the verse");
  ok(secs[secs.length - 1].box, "the outro arrives at full level");
}

/* (o) THE RECORD'S LINE IS THE BASSIST'S OWN, AND EVERY CHAIR CAN BE CLEARED */
// The figure used to sit only on the genre, so the bass chair showed the
// STYLE's quarters while an acid line was playing — and writing one note
// into that bar replaced the acid line with quarters. "The bass drops out on
// techno."
console.log("the bassist holds the record's line, and a chair can be cleared");
{
  const B2 = Band.B;
  for (const [key, gk] of Object.entries(Band.GENRES)) {
    if (!gk.fig) continue;
    const m = Band.answer(on(), "arranger", "genre", gk.w);
    ok(m.bass.fig, key + ": the bassist was never handed the record's line");
    ok(JSON.stringify(B2.figOf(m.bass).grid) === JSON.stringify(B2.FIGURES[gk.fig].grid),
       key + ": the bassist's bar is not the line that is playing");
    // ...so editing one note edits THAT line, not a fresh one
    const edited = { ...m, bass: B2.say(m.bass, "note:15") };
    const was = B2.figOf(m.bass).grid, now = B2.figOf(edited.bass).grid;
    const moved = was.map((v, i) => v !== now[i]).filter(Boolean).length;
    ok(moved === 1, key + ": writing one note moved " + moved + " of them");
    // one note in, one note out — counted in ONE bar, since a section
    // repeats the figure across all of them
    const inBar = (mm) => play(Band.toSong(mm, MODES)[0].genre).bass.filter((e) => e.t < 16).length;
    // ...unless the record leaves four measures between two notes, where the
    // SPACE schedule outranks the figure and a sixteenth nobody plays is a
    // sixteenth nobody hears. That is the axis working, not the bar failing.
    const moved2 = Math.abs(inBar(edited) - inBar(m));
    ok(gk.space ? moved2 === 0 : moved2 === 1,
       key + ": one note changed the bar by " + moved2);
  }
  // a bassist who wrote their own keeps it when the record is called again
  const mine = { ...on(), bass: Band.B.say(Band.B.say(Band.B.blank(), "start"), "note:5") };
  const called = Band.answer(mine, "arranger", "genre", "a techno record");
  ok(JSON.stringify(called.bass.fig) === JSON.stringify(mine.bass.fig),
     "calling a record overwrote a line the bassist had written");

  // START OVER, one chair at a time
  let m = Band.answer(Band.answer(on(), "arranger", "genre", "a jazz date"),
                      "arranger", "form", Band.FORMS.head.w);
  m = Band.answer(m, "drums", "job", Band.seatDecisions(m, "drums").find(d => d.id === "job").opts[1].w);
  m = Band.answer(m, "engineer", "kick", "huge");
  const d0 = Band.resetSeat(m, "drums");
  ok(!(d0.drums.answers || {}).job, "clearing the drums left their answers");
  ok(d0.drums.on, "clearing the drums put the drummer away");
  ok(JSON.stringify(d0.bass) === JSON.stringify(m.bass), "clearing the drums touched the bass");
  ok(JSON.stringify(d0.eng) === JSON.stringify(m.eng), "clearing the drums touched the desk");
  const e0 = Band.resetSeat(m, "engineer");
  ok(Object.keys(Band.mixOf(e0)).length === 0, "clearing the desk left it written on");
  ok(JSON.stringify(e0.drums) === JSON.stringify(m.drums), "clearing the desk moved the drummer");
  const a0 = Band.resetSeat(m, "arranger");
  ok(!a0.song.genre && !a0.song.form, "clearing the arranger left the tune called");
  ok(a0.drums.on && a0.bass.on, "clearing the arranger sent the players home");
  // ...and everything still plays after any of them
  for (const m2 of [d0, e0, a0, Band.resetSeat(m, "bass")])
    for (const s2 of Band.toSong(m2, MODES)) {
      const ev = play(s2.genre);
      ok(ev.drums.every((e) => Number.isFinite(e.t)) && ev.bass.every((e) => Number.isFinite(e.n)),
         "a cleared chair left something unplayable");
    }
}

/* (p) SOMEBODY IS PLAYING THE CHORDS */
// The arranger called the changes, the bassist realized their roots, and
// until this chair the chords themselves were imaginary — a rhythm section,
// not a band. A keys player is also not a pad machine: pads are one of the
// things a pair of hands does.
console.log("the fifth chair plays the harmony that was being called");
{
  const Ky = Band.Ky;
  const m0 = on();
  ok(Band.SEATS.includes("keys"), "nobody is playing the chords");
  const ds = Band.seatDecisions(m0, "keys");
  ok(ds.length >= 5, "the keys player is asked " + ds.length + " things");
  for (const id of Band.TAKEN.keys)
    ok(!ds.some((d) => d.id === id), "the keys player is still asked " + id);
  // the chair reaches the genre AND the phrase
  for (const [k, j] of Object.entries(Ky.JOBS)) {
    const m = { ...m0, keys: Ky.say(m0.keys, "job:" + k) };
    const s2 = Band.toSong(m, MODES)[0];
    ok(typeof s2.genre.part === "function", k + ": the section carries no part");
    ok(s2.genre.part(0) === (j.part || "line"), k + ": the part is " + s2.genre.part(0));
    ok(s2.pattern && s2.pattern.gate.length === 16, k + ": the section carries no phrase");
    const ev = K.render(s2.pattern, s2.genre, s2.bars);
    if (k === "out") ok(ev.length === 0, k + " played " + ev.length + " notes");
    else {
      ok(ev.length > 0, k + " plays nothing in the band");
      ok(ev.every((e) => Number.isFinite(e.n) && Number.isFinite(e.t)), k + " is not finite");
    }
  }
  // A CHORD IS SEVERAL NOTES, and they move with the called changes
  const s3 = Band.toSong(m0, MODES)[0];
  const ev = K.render(s3.pattern, s3.genre, s3.bars);
  ok(ev.filter((e) => e.t === 0).length >= 3, "the first chord is one note");
  const perBar = [0, 1, 2, 3].map((b) => ev.filter((e) => e.t >= b * 16 && e.t < (b + 1) * 16)
    .map((e) => e.n).sort().join(","));
  ok(new Set(perBar).size > 1, "the chords never move: " + perBar[0]);
  // ...and every record narrows the keys the way it narrows everything else
  for (const [key, gk] of Object.entries(Band.GENRES)) {
    ok(Array.isArray(gk.keys) && gk.keys.length >= 3,
       key + " offers " + ((gk.keys || []).length) + " keyboards");
    for (const w of gk.keys)
      ok(Object.values(Ky.INSTRUMENTS).includes(w), key + ": nobody makes \"" + w + "\"");
    ok(!gk.kjob || Ky.JOBS[gk.kjob], key + ": there is no job called " + gk.kjob);
    const m = Band.answer(on(), "arranger", "genre", gk.w);
    ok(gk.keys.includes(Ky.INSTRUMENTS[m.keys.instr]),
       key + ": the keys picked up " + Ky.INSTRUMENTS[m.keys.instr]);
    if (gk.kjob) ok(m.keys.job === gk.kjob, key + ": the keys are " + m.keys.job);
    const iq = Band.seatDecisions(m, "keys").find((d) => d.id === "instr");
    for (const o of iq.opts) ok(gk.keys.includes(o.w),
      key + ": \"" + o.w + "\" is not on this record");
  }
  // a section can tell them something, and it stays in that section
  let m = Band.answer(Band.answer(on(), "arranger", "genre", "a house record"),
                      "arranger", "form", Band.FORMS.pop.w);
  const before = Band.toSong(m, MODES).map((s4) =>
    JSON.stringify([s4.pattern.gate, s4.genre.part(0)]));
  const ask = Band.sectionAsks(m, 1).find((a) => a.id === "keys");
  ok(!!ask && ask.opts.length >= 5, "a section cannot tell the keys anything");
  for (const o of ask.opts) {
    const m2 = Band.setSection(m, 1, "keys", o.key);
    const after = Band.toSong(m2, MODES).map((s4) =>
      JSON.stringify([s4.pattern.gate, s4.genre.part(0)]));
    for (let i = 0; i < after.length; i++)
      if (i !== 1) ok(after[i] === before[i],
        "\"" + o.w + "\" in the chorus changed section " + i);
    ok(JSON.stringify(m2.keys) === JSON.stringify(m.keys),
       "\"" + o.w + "\" said about one section changed the player for the whole song");
  }
}

/* (q) THE MELODY BELONGS TO THE ROOM */
// The arranger writes it and a section says whose hands are on it — which is
// why it does not live in any chair's file. A player who picks it up lends
// it their instrument and stops playing their own part for that section.
console.log("a melody is written once and picked up by whoever is asked");
{
  const Id2 = Band.Id;
  let m = Band.answer(Band.answer(on(), "arranger", "genre", "a house record"),
                      "arranger", "form", Band.FORMS.pop.w);
  ok(m.idea && m.idea.on, "the room has no idea in it");
  // the arranger is asked about it, in the ideas module's own words
  const ds = Band.seatDecisions(m, "arranger").filter((d) => d.id.startsWith("idea:"));
  ok(ds.length >= 4, "the arranger is asked " + ds.length + " things about the tune");
  for (const d of ds) ok(d.opts.length >= 2, "\"" + d.ask + "\" offers one answer");
  // ...and answering one moves the tune, not the song
  const before = JSON.stringify(m.song);
  const m2 = Band.answer(m, "arranger", ds[0].id, ds[0].opts[1].w);
  ok(JSON.stringify(m2.song) === before, "writing the tune changed the tune's SONG fields");
  ok(JSON.stringify(m2.idea) !== JSON.stringify(m.idea), "the answer never reached the idea");

  // nobody plays it until a section says so
  const secs = Band.toSong(m, MODES);
  ok(secs.every((s2) => !s2.melody), "the melody is playing before anybody picked it up");
  const took = Band.setSection(m, 1, "idea", "keys");
  const secs2 = Band.toSong(took, MODES);
  ok(!!secs2[1].melody, "the keys were asked to take it and did not");
  ok(secs2.filter((s2) => s2.melody).length === 1, "the melody leaked into another section");
  // the player who takes it stops playing their own part there
  ok(secs2[1].pattern.gate.filter(Boolean).length === 0,
     "the keys are playing the melody AND their own part in the same hands");
  ok(secs2[0].pattern.gate.join() === secs[0].pattern.gate.join(),
     "picking the melody up in the chorus changed the verse");
  // it renders, it lands in a singable range, and it follows the changes
  const g = secs2[1].melody.genre, ph = secs2[1].melody.phrase;
  const ev = K.render(ph, g, g.bars);
  ok(ev.length > 0, "the melody plays nothing");
  ok(ev.every((e) => Number.isFinite(e.n) && e.n >= 48 && e.n <= 96),
     "the melody is off the end of the keyboard: " + ev.map((e) => e.n).join(" "));
  ok(g.part(0) === "lead", "the melody is not a lead part");
  ok(ph.deg.length % 16 === 0, "the phrase is not a whole number of bars");
  // A LONGER PHRASE READS THE CHANGES: the kernel takes a phrase's own
  // length AS the bar, so a two-bar tune over four chords would hear two —
  // unless the changes are paired into it, which is what `prog` is for here
  if (ph.deg.length > 16) {
    ok(Array.isArray(g.prog) && g.prog.length >= 1,
       "a two-bar tune was handed no paired changes");
    const roots = new Set(ev.map((e) => e.n % 12));
    ok(roots.size > 1, "the tune never hears the changes move");
  }
  // every idea word still leaves something playable, in the band
  for (const i of Id2.catalog(m.idea)) {
    if (!i.changes) continue;
    const m3 = { ...took, idea: Id2.say(m.idea, i.id) };
    const s3 = Band.toSong(m3, MODES)[1];
    const ev3 = K.render(s3.melody.phrase, s3.melody.genre, s3.melody.genre.bars);
    ok(ev3.every((e) => Number.isFinite(e.t) && Number.isFinite(e.n)),
       "\"" + i.words[0] + "\" made an unplayable tune");
    ok(ev3.length > 0, "\"" + i.words[0] + "\" silenced the tune");
  }
}

/* (r) A SIXTH CHAIR, AND TWO PITCHED VOICES */
// A guitarist is not a second keyboard: it chugs, it strums the offbeat, and
// its dirt is an INSTRUMENT rather than a knob. Two pitched chairs mean two
// voices, each with its own phrase, part, register and instrument.
console.log("the guitarist takes the second pitched voice");
{
  const Gt = Band.Gt;
  const m0 = on();
  ok(Band.SEATS.includes("guitar"), "nobody is playing guitar");
  const ds = Band.seatDecisions(m0, "guitar");
  ok(ds.length >= 4, "the guitarist is asked " + ds.length + " things");
  for (const id of Band.TAKEN.guitar)
    ok(!ds.some((d) => d.id === id), "the guitarist is still asked " + id);
  const s2 = Band.toSong(m0, MODES)[0];
  ok(s2.genre.voices === 2, "the band has " + s2.genre.voices + " pitched voice(s)");
  ok(Array.isArray(s2.genre.instr) && s2.genre.instr.length === 2,
     "the two chairs share one instrument: " + JSON.stringify(s2.genre.instr));
  ok(s2.genre.instr[0] !== s2.genre.instr[1], "both chairs picked up the same thing");
  ok(!!s2.guitar && s2.guitar.gate.length === 16, "the section carries no guitar phrase");
  // every job is a real part, plays, and is its own phrase
  const shapes = new Set();
  for (const [k, j] of Object.entries(Gt.JOBS)) {
    const m = { ...m0, guitar: Gt.say(m0.guitar, "job:" + k) };
    const sec = Band.toSong(m, MODES)[0];
    ok(["riff", "stab", "counter", "line", "pad", "lead", undefined, null].includes(j.part),
       k + ": the kernel has no part called " + j.part);
    if (k === "out") ok(sec.guitar.gate.every((x) => !x), "laying out still strums");
    else {
      ok(sec.guitar.gate.some(Boolean), k + " strums nothing");
      shapes.add(sec.guitar.gate.join(""));
      const ev = K.render(sec.guitar, { ...sec.genre, voices: 1,
        part: () => j.part, reg: () => 0 }, sec.bars);
      ok(ev.length > 0 && ev.every((e) => Number.isFinite(e.n)), k + " is not playable");
    }
  }
  ok(shapes.size >= 5, "the guitar jobs are " + shapes.size + " different phrases");
  // every guitar is one the pool can cast
  const fs = require("fs");
  const src = fs.readFileSync(require("path").join(__dirname, "../../nukernel/genres.js"), "utf8");
  const known = new Set((src.match(/"[a-z0-9_]+"/g) || []).map((x) => x.slice(1, -1)));
  for (const id of Object.keys(Gt.INSTRUMENTS))
    ok(known.has(id), "no genre in the catalog plays \"" + id + "\"");
  // a section can tell the guitarist something, and it stays there
  let m = Band.answer(Band.answer(on(), "arranger", "genre", "a rock record"),
                      "arranger", "form", Band.FORMS.pop.w);
  const before = Band.toSong(m, MODES).map((x) => x.guitar.gate.join(""));
  const ask = Band.sectionAsks(m, 1).find((a) => a.id === "guitar");
  ok(!!ask && ask.opts.length >= 6, "a section cannot tell the guitar anything");
  for (const o of ask.opts.slice(0, 6)) {
    const m2 = Band.setSection(m, 1, "guitar", o.key);
    const after = Band.toSong(m2, MODES).map((x) => x.guitar.gate.join(""));
    for (let i = 0; i < after.length; i++)
      if (i !== 1) ok(after[i] === before[i], "\"" + o.w + "\" changed section " + i);
    ok(JSON.stringify(m2.guitar) === JSON.stringify(m.guitar),
       "\"" + o.w + "\" changed the player for the whole song");
  }
  // ...and the guitarist can take the melody, on their own instrument
  const took = Band.setSection(m, 1, "idea", "guitar");
  const sec = Band.toSong(took, MODES)[1];
  ok(!!sec.melody, "the guitar was asked for the tune and did not take it");
  ok(sec.melody.genre.instr === took.guitar.instr,
     "the tune is not on the guitar that took it: " + sec.melody.genre.instr);
  ok(sec.guitar.gate.every((x) => !x),
     "the guitarist is playing the tune AND their own part in the same hands");
}

/* (s) WHAT THE BAND DOES TO WHAT IT PLAYED */
// The pipes are the kernel's second organ and no chair could reach them:
// seeded transforms on the RENDERED stream. Not a player's decision and not
// the desk's — what the band does to what it has already played.
console.log("the pipes are reachable, and they only touch their own section");
{
  let m = Band.answer(Band.answer(on(), "arranger", "genre", "a rock record"),
                      "arranger", "form", Band.FORMS.pop.w);
  const ev = (mm, i) => { const s2 = Band.toSong(mm, MODES)[i];
    return K.render(s2.pattern, s2.genre, s2.bars); };
  const base = [0, 1, 2, 3].map((i) => ev(m, i).length);
  const ask = Band.sectionAsks(m, 1).find((a) => a.id === "pipe");
  ok(!!ask && ask.opts.length >= 5, "a section cannot be told what comes out");
  let moved = 0;
  for (const o of ask.opts) {
    const m2 = Band.setSection(m, 1, "pipe", o.key);
    const now = [0, 1, 2, 3].map((i) => ev(m2, i).length);
    for (let i = 0; i < 4; i++)
      if (i !== 1) ok(now[i] === base[i], "\"" + o.w + "\" changed section " + i);
    if (now[1] !== base[1]) moved++;
    const g = Band.toSong(m2, MODES)[1].genre;
    if (o.key !== "none") {
      ok(Array.isArray(g.pipes) && g.pipes.length, "\"" + o.w + "\" wrote no pipes");
      for (const p2 of g.pipes)
        ok(p2 && typeof p2.id === "string", "\"" + o.w + "\": a pipe with no id");
    }
    ok(ev(m2, 1).every((e) => Number.isFinite(e.t) && Number.isFinite(e.n)),
       "\"" + o.w + "\" made something unplayable");
  }
  ok(moved >= 3, "only " + moved + " of the pipes changed what comes out");
  // ...and nobody's PART moved: a pipe is what happens to the notes after
  ok(JSON.stringify(Band.toSong(Band.setSection(m, 1, "pipe", "thirds"), MODES)[1].pattern) ===
     JSON.stringify(Band.toSong(m, MODES)[1].pattern),
     "a pipe rewrote somebody's phrase, which is not what a pipe is");
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
  : `\nband-kit: PASS — ${pass} checks (six chairs, the arranger owns the tune, every form plays, a section is its own, the engineer mixes it)`);
process.exit(fails ? 1 : 0);
