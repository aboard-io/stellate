// nukernel/band-kit.js — THE BAND. An arranger and two players, and the
// division of labour is the whole idea: the ARRANGER calls the tune — key,
// mode, changes, tempo, feel — and the DRUMMER and BASSIST each decide only
// what is theirs. That is how a session works, and it is why the drummer is
// no longer asked how fast it is: somebody already said.
//
// Pure, like both players: it composes drums-kit.js and bass-kit.js rather
// than re-implementing either, and hands the engine ONE genre carrying both
// parts — the kit from the drummer, the line from the bassist, the key and
// the changes from the arranger.
(function (root, factory) {
  const api = factory(
    typeof require !== "undefined" ? require("./chair.js") : root.NuChair,
    typeof require !== "undefined" ? require("./drums-kit.js") : root.NuDrums,
    typeof require !== "undefined" ? require("./bass-kit.js") : root.NuBass,
    typeof require !== "undefined" ? require("./keys-kit.js") : root.NuKeys,
    typeof require !== "undefined" ? require("./ideas-kit.js") : root.NuIdeas,
    typeof require !== "undefined" ? require("./guitar-kit.js") : root.NuGuitar,
    typeof require !== "undefined" ? require("./askable.js") : root.NuAskable,
    typeof require !== "undefined" ? require("./vocal-kit.js") : root.NuVocal,
    // ...and the INSTRUMENTS, for one thing only: `RANGES`, the compass of
    // every instrument a chair can hold (instruments.js lifts it verbatim
    // from the parent's state-engine.js INSTRUMENT_RANGE). A record seats
    // its band inside the instrument's own notes rather than inside numbers
    // this file made up. Loaded before band-kit in every page that has one
    // (index.html), and requireable standalone in node.
    typeof require !== "undefined" ? require("./instruments.js") : root.NuInstruments);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuBand = api;
})(typeof self !== "undefined" ? self : this, function (C, D, B, Ky, Id, Gt, Ask, Vo, Instr) {
  "use strict";

  const SEATS = ["arranger", "drums", "bass", "keys", "guitar", "voice", "engineer"];
  // the questions the ARRANGER has already answered, so the players stop
  // asking them: a drummer does not set the tempo, a bassist does not pick
  // the key
  const TAKEN = { drums: ["tempo", "feel", "record"],
                  bass: ["key", "mode", "changes", "tempo", "feel"],
                  keys: ["key", "mode", "changes", "tempo", "feel"],
                  guitar: ["key", "mode", "changes", "tempo", "feel"],
                  voice: ["key", "mode", "changes", "tempo", "feel"] };

  /* ---------- THE FOURTH CHAIR: SOMEBODY IS MIXING THIS -------------------
     A band in a room is four jobs, not three. The drummer decides what they
     PLAY; how close the mics are, how big the kick is, whether the snare has
     a plate on it and how hard the whole thing is squeezed are somebody
     else's decisions entirely, and no amount of drumming makes them.
     Everything here lands on the desk nukernel already has — the mix-offset
     layer (ui/state.js MIXER, applied in audio/desk.js over the composed
     mix), addressed by the channels it already understands: a part chan
     ("drums", "bass"), a UNIT chan ("unit:kick"), and "master". */
  const ENG = [
    { id: "room", ask: "how close are the drums?", opts: [
      { w: "right up close", mix: {} },
      { w: "in the room", mix: { drums: { rev: 0.25 } } },
      { w: "down the hall", mix: { drums: { rev: 0.5 }, "unit:snare": { del: 0.12 } } } ] },
    { id: "kick", ask: "how big is the kick?", opts: [
      { w: "tight", mix: { "unit:kick": { eq: { lo: -2, hi: 2 } } } },
      { w: "round", mix: { "unit:kick": { eq: { lo: 3 } } } },
      { w: "huge", mix: { "unit:kick": { eq: { lo: 6 }, fader: 2 } } } ] },
    { id: "snare", ask: "and the snare?", opts: [
      { w: "dry, cracking", mix: { "unit:snare": { eq: { hi: 3 } } } },
      { w: "fat", mix: { "unit:snare": { eq: { lo: 3, mid: 2 } } } },
      { w: "a plate on it", mix: { "unit:snare": { rev: 0.45 } } } ] },
    { id: "hats", ask: "the hats?", opts: [
      { w: "keep them down", mix: { "unit:hat": { fader: -4 } } },
      { w: "as they are", mix: {} },
      { w: "bright", mix: { "unit:hat": { eq: { hi: 4 }, fader: 1 } } } ] },
    // REVERB AND DELAY, said as an engineer says them: how big the space is
    // and what is throwing back off it. `rev` and `del` are the desk's own
    // sends, `space` the master reverb — the same three the mixer page has.
    { id: "verb", ask: "how much reverb on the whole thing?", opts: [
      { w: "dry", mix: {} },
      { w: "a small room", mix: { master: { space: 0.2 }, drums: { rev: 0.12 } } },
      { w: "a big hall", mix: { master: { space: 0.5 }, drums: { rev: 0.3 },
                                bass: { rev: 0.1 } } },
      { w: "drowned", mix: { master: { space: 0.8 }, drums: { rev: 0.55 },
                             bass: { rev: 0.25 } } } ] },
    { id: "delay", ask: "any delay?", opts: [
      { w: "none", mix: {} },
      { w: "a slap on the snare", mix: { "unit:snare": { del: 0.18 } } },
      { w: "an echo on the snare", mix: { "unit:snare": { del: 0.45 } } },
      { w: "dub it — echo on everything", mix: { drums: { del: 0.35 },
                                                 bass: { del: 0.2 },
                                                 "unit:snare": { del: 0.4 } } } ] },
    { id: "squeeze", ask: "how hard do you squeeze it?", opts: [
      { w: "leave it alone", mix: {} },
      { w: "a little glue", mix: { master: { glue: 0.3 } } },
      { w: "pumping", mix: { master: { glue: 0.7, drive: 0.2 } } } ] },
    { id: "tape", ask: "how much tape?", opts: [
      { w: "none", mix: {} },
      { w: "warm", mix: { master: { tape: 0.35 } } },
      { w: "cooking", mix: { master: { tape: 0.7, drive: 0.3 } } } ] },
    // A PATH FOR EVERY INSTRUMENT, not just the kit and the bass. The desk
    // addresses an instrument by family (audio/desk.js INST_CHANS), so these
    // land wherever that chair's instrument actually is.
    // ...AND A CHANNEL'S TREATMENTS COMPOSE (2026-08-21). "A room" and "a
    // slapback" and "darker" are three different lanes on the desk — the rev
    // send, the del send, the strip's tone bands — and an engineer lights
    // all three on one guitar every day of the week. So the four channel
    // questions are TOGGLE SETS (`multi`), not one-of-N: an answer lights or
    // unlights, the lit set is stored joined in the menu's own order ("a
    // room, a slapback, darker" — which is also what the gig sheet says),
    // and mixOf sums every lit word's offsets onto its lanes, clamped at the
    // desk's own ranges. The one honest exclusion is the `dry` word — dry
    // MEANS the empty set said out loud, so lighting it clears the rest and
    // lighting anything else clears it. The wet words ("wide and wet",
    // "washed out", "dub echo") COEXIST with the rest — they are more send,
    // and more send plus a room is just a wetter room, the caps holding the
    // sum on the rails. The voice's two placements ("in the distance"/"up
    // front") are the one pair that contradict — a voice has one position —
    // so they exclude each other (`excl`) and compose with everything else.
    // (The DRUMS block above stays one-of-N on purpose: its words are a
    // gate's contract, and "how close are the drums?" is one distance.)
    { id: "keysfx", ask: "anything on the keys?", multi: true, dry: "dry", opts: [
      { w: "dry", mix: {} },
      { w: "a room", mix: { "inst:keys": { rev: 0.25 }, "inst:pads": { rev: 0.25 } } },
      { w: "echo", mix: { "inst:keys": { del: 0.3 }, "inst:pads": { del: 0.3 } } },
      { w: "wide and wet", mix: { "inst:keys": { rev: 0.5, del: 0.15 },
                                  "inst:pads": { rev: 0.55, del: 0.2 } } },
      { w: "darker", mix: { "inst:keys": { eq: { hi: -3, lo: 2 } },
                            "inst:pads": { eq: { hi: -3, lo: 2 } } } } ] },
    { id: "gtrfx", ask: "anything on the guitar?", multi: true, dry: "straight in", opts: [
      { w: "straight in", mix: {} },
      { w: "a room", mix: { "inst:guitar": { rev: 0.25 } } },
      { w: "a slapback", mix: { "inst:guitar": { del: 0.22 } } },
      { w: "washed out", mix: { "inst:guitar": { rev: 0.55, del: 0.3 } } },
      { w: "brighter", mix: { "inst:guitar": { eq: { hi: 4 } } } } ] },
    { id: "voxfx", ask: "anything on the voice?", multi: true, dry: "close and dry",
      excl: [["in the distance", "up front"]], opts: [
      { w: "close and dry", mix: {} },
      { w: "a plate", mix: { vocals: { rev: 0.4 } } },
      { w: "a long echo", mix: { vocals: { del: 0.4, rev: 0.25 } } },
      { w: "in the distance", mix: { vocals: { rev: 0.7, fader: -3 } } },
      { w: "up front", mix: { vocals: { fader: 3, eq: { hi: 2 } } } } ] },
    { id: "bassfx", ask: "anything on the bass?", multi: true, dry: "dry", opts: [
      { w: "dry", mix: {} },
      { w: "a room", mix: { bass: { rev: 0.22 } } },
      { w: "echo", mix: { bass: { del: 0.3 } } },
      { w: "dub echo", mix: { bass: { del: 0.5, rev: 0.3 } } },
      { w: "thicken it", mix: { bass: { eq: { lo: 3, mid: 2 } } } } ] },
    { id: "bassmix", ask: "where does the bass sit?", opts: [
      { w: "under everything", mix: { bass: { fader: -3 } } },
      { w: "with the kick", mix: {} },
      { w: "out front", mix: { bass: { fader: 3 } } } ] },
  ];
  // the lit set of a multi question, read back out of the stored phrase —
  // the phrase IS the storage ("a room, a slapback"), so an old session's
  // single word reads as a one-word set and nothing migrates
  const engSet = (m, id) => { const s = (m.eng || {})[id]; return s ? s.split(", ") : []; };
  // one toggle: dry is exclusive both ways, an excl pair keeps one of two
  // contradictory placements, and the result is canonicalized to the menu's
  // own order so a set lit in any order has one spelling
  const engToggle = (d, cur, w) => {
    // ...AND THE DRY WORD IS IDEMPOTENT (2026-08-23). It used to toggle off
    // like any other, which emptied the set and put the question back
    // OPEN — a third state that only ever meant "unanswered". Now that a
    // record seeds every channel and "dry" is the word it seeds them with,
    // that state is a bug with a name: tapping the answer already lit
    // un-answered the question, so the interview asked it again and the
    // tree gate reported it as an edge that answered nothing. Dry MEANS
    // the empty set said out loud, and saying it twice says the same thing
    // twice; you leave it by lighting something else.
    if (w === d.dry) return [d.dry];
    let next = cur.includes(w) ? cur.filter((x) => x !== w)
      : [...cur.filter((x) => x !== d.dry), w];
    for (const pair of d.excl || [])
      if (pair.includes(w) && next.includes(w))
        next = next.filter((x) => x === w || !pair.includes(x));
    // ...and unlighting the last thing lit lands on the dry word rather
    // than on nothing, for the same reason: the empty set IS "dry", and the
    // only thing the two spellings ever told apart was answered from
    // unanswered — which the provenance ledger says properly now.
    if (!next.length) next = [d.dry];
    const at = (x) => d.opts.findIndex((o) => o.w === x);
    return next.sort((a, b) => at(a) - at(b));
  };
  const engDecisions = (m) => ENG.map((d) => {
    const said = (m.eng || {})[d.id] || null;
    const lit = d.multi ? engSet(m, d.id) : null;
    const hit = (w) => (d.multi ? lit.includes(w) : said === w);
    return { ...d, seat: "engineer", answered: said,
      opts: d.opts.map((o) => ({ ...o, answered: hit(o.w), active: hit(o.w) })) };
  });
  // WHAT THE DESK IS TOLD: every answer's offsets, summed per channel. Two
  // answers that touch the same channel add rather than replace, the way two
  // hands on a board would.
  function mixOf(m) {
    const out = {};
    for (const d of ENG) {
      const words = d.multi ? engSet(m, d.id)
        : (m.eng || {})[d.id] ? [(m.eng || {})[d.id]] : [];
      for (const w of words) {
        const o = d.opts.find((x) => x.w === w);
        if (!o) continue;
        for (const [chan, vals] of Object.entries(o.mix)) {
          const c = out[chan] || (out[chan] = {});
          for (const [k, v] of Object.entries(vals)) {
            if (k === "eq") { const e = c.eq || (c.eq = {});
              for (const [b, db] of Object.entries(v)) e[b] = (e[b] || 0) + db; }
            else c[k] = (c[k] || 0) + v;
          }
        }
      }
    }
    // THE CAPS. Several lit treatments sum on one lane now, so the sum is
    // held to the desk's own ranges (audio/desk.js c01 on the sends,
    // fields.js faderDb -24..12, eqDb ±12) — all-on is wet, never clipped.
    // A single answer is always inside the caps, so one word's offsets pass
    // through byte-identical.
    const r3 = (v) => Math.round(v * 1000) / 1000;
    for (const c of Object.values(out)) {
      for (const k of ["rev", "del", "glue", "drive", "tape", "space"])
        if (c[k] != null) c[k] = r3(Math.min(1, Math.max(0, c[k])));
      if (c.fader != null) c.fader = r3(Math.max(-24, Math.min(12, c.fader)));
      if (c.eq) for (const b of Object.keys(c.eq))
        c.eq[b] = r3(Math.max(-12, Math.min(12, c.eq[b])));
    }
    return out;
  }

  const blank = () => ({ on: false, seat: "arranger",
    song: { key: "C", minor: false, form: null, chg: {}, bpm: 96, swing: null,
            meter: null, answers: {} },
    drums: D.say(D.blank(), "start"), bass: B.say(B.blank(), "start"),
    keys: Ky.say(Ky.blank(), "start"),
    // THE IDEA belongs to the room. The arranger writes it; a section says
    // who picks it up. One melody to start with — the hook — and room for
    // its ANSWER (theme B, made only when the arranger asks for one, so a
    // record that never says the word is byte-identical).
    idea: Id.say(Id.blank(), "start"), ideaB: null,
    guitar: Gt.say(Gt.blank(), "start"),
    voice: Vo.say(Vo.blank(), "start") });

  // THE ANSWER, as it is first written: a CONTRAST, because that is what an
  // answer is — where the tune arches and closes on the root, the answer is
  // a short call that falls away and opens on the fifth. (A B theme that
  // started as a copy of A would be A with extra steps.) One constructor,
  // two callers — the arranger's own "a second theme answers it", and the
  // record the room opens with — so the two cannot drift apart.
  const answerTheme = () => Id.say({ ...Id.blank(), name: "the answer",
    cell: "call", contour: "fall", land: "fifth" }, "start");

  /* ---------- THE RECORD THE ROOM OPENS WITH (2026-08-22) ------------------
     Paul, verbatim: "The start again 'default' song should play and
     interpret the theme and its answer across a verse-chorus structure."

     `blank()` is the EMPTY ROOM and stays empty — the dice rolls from it,
     every gate measures from it, and a default written into it would land
     on every record this box has ever made. What "start again" hands you is
     this: the same empty room with a record already standing in it, so that
     counting in before answering anything DEMONSTRATES the machine rather
     than looping one four-bar vamp with a tune nobody picks up.

     Verse, chorus, verse, chorus. THEME A is stated in the verses and THEME
     B — the answer — takes the choruses, which is the oldest arrangement
     there is and the one thing that makes two themes audibly two themes.
     The last chorus brings the answer back UP A STEP: a return that is not
     a repeat, which is the whole of what the transform words are for.

     Every one of these is an ORDINARY value on the ordinary model — a form
     nobody has answered yet (`answers.form` is unset, so the question is
     still open and the first thing the page asks is still "when is it?"),
     two ordinary section words on the ordinary `per` ledger. So all of it
     is overridden by any answer, exactly as today: tap a form and the boxes
     reseed, tap "one theme is plenty" and B goes away, tap a section's own
     "which theme" and yours wins. Calling a record still moves the form to
     one the record has (`called`), which is what should happen to a shape
     nobody asked for. */
  const opening = () => {
    const m = blank();
    return { ...m,
      song: { ...m.song, form: "pop", themeB: true },
      ideaB: answerTheme(),
      // the verses take the tune (a chorus in the shape means the "home"
      // law hands it to the chorus, so the verses say so themselves), the
      // choruses take the answer, and the last one returns it up a step
      per: { 0: { idea: "keys" }, 1: { theme: "b" },
             2: { idea: "keys" }, 3: { theme: "b", back: "up" } } };
  };

  /* ---------- WHAT EACH PLAYER DOES IN EACH SECTION -----------------------
     The gig sheet sets up the SONG; a section is where a band actually
     arranges. So every section can ask each player one thing: what are you
     doing differently here? Nobody has to answer — "same as before" is the
     default and the honest one — but a chorus where the drums go half-time
     and the bass pedals the root is the whole difference between a loop and
     an arrangement. */
  /* ---------- HOW THE RECORD COUNTS -------------------------------------
     Meter is a SONG fact, like the key, the tempo and the swing: a record
     counts in three or it does not, and a section that changed meter mid-way
     would be a different feature. So it lives on `m.song.meter` beside them,
     it is nullable, and NOTHING says it by default — a record that never
     answers the question renders byte for byte what it always did.

     One word in, two numbers out (chair.js METS · kernel.js METERS): how
     many sixteenth-steps the bar has, and how many of those are a felt
     beat. Everything else — the players' grids, the count row, the staff's
     signature, the parent's per-bar beat count — reads those two. */
  const METS = C.METS;
  const metOf = (song) => (song && song.meter && METS[song.meter]) || null;
  const stepsOfSong = (song) => { const t = metOf(song); return t ? t.steps : 16; };
  // ...and the meter, stamped onto every chair so their bars are the record's
  const seatMeter = (m, met) => ({ ...m,
    drums: { ...m.drums, met: met || null }, bass: { ...m.bass, met: met || null },
    keys: { ...m.keys, met: met || null }, guitar: { ...m.guitar, met: met || null },
    voice: { ...m.voice, met: met || null }, idea: { ...m.idea, met: met || null },
    ideaB: m.ideaB ? { ...m.ideaB, met: met || null } : m.ideaB });
  /* A METER IS THE WHOLE BAND'S. One word, and every chair counts the new
     bar — the drummer's table of grooves, the bassist's figure, the pitched
     chairs' places, the theme's own cells. The chairs' hand-edits are
     trimmed, never re-seated (chair.js `refit`), and the drummer's family/
     groove/backbeat answers are REOPENED, because a waltz is not a
     four-on-the-floor with a beat cut off.
     TWO CALLERS, one law: the arranger's own "how does it count?", and a
     record that counts in three by being what it is. Both pass the meter
     the band was on before, and this is a no-op when the bar has not
     actually moved — saying "in four" to a record already counting in four
     is a word, not a change, and re-seating there would sweep a drummer's
     jazz ride for a kit nobody asked to hear. */
  const remeter = (out, was) => {
    if ((out.song.meter || null) === (was || null)) return out;
    let o = seatMeter(out, METS[out.song.meter] || null);
    const dr = { ...o.drums };
    const da = { ...(dr.answers || {}) };
    delete da.record; delete da.groove; delete da.backbeat;
    dr.answers = da;
    // ...and the provenance marks go with the answers: a mark on a row that
    // no longer has an answer is a row nothing will ever fill in again
    // (measured: a rolled record that changed meter came out with no groove
    // at all, because the dice read the stale mark and left it alone).
    { const sd = o.song.seeded;
      if (sd && (sd["drums/record"] || sd["drums/groove"] || sd["drums/backbeat"])) {
        const next = { ...sd };
        delete next["drums/record"]; delete next["drums/groove"];
        delete next["drums/backbeat"];
        o = { ...o, song: { ...o.song, seeded: next } };
      } }
    // ...and the kit itself moves to the new bar's first groove, so the
    // record is playable the instant the word is said
    o = { ...o, drums: D.say({ ...dr, on: false }, "start") };
    if (o.drums.answers !== da) o = { ...o, drums: { ...o.drums, answers: da } };
    // ...and the bassist's WRITTEN line is trimmed to the new bar rather than
    // re-seated (chair.js `refit`, the hand-edit law): a mark you made stays
    // where you made it for as long as the bar reaches it. Without this the
    // figure kept the length of the bar it was written in, and the kernel —
    // which reads a grid with `at`, wrapping — played the first twelve of
    // sixteen places and dropped the rest into silence.
    if (o.bass && o.bass.fig) {
      const m2 = METS[o.song.meter] || null, f = o.bass.fig;
      o = { ...o, bass: { ...o.bass, fig: {
        grid: C.refit(f.grid, m2), oct: C.refit(f.oct, m2), acc: C.refit(f.acc, m2),
        sld: C.refit(f.sld, m2), deg: f.deg ? C.refit(f.deg, m2) : f.deg } } };
    }
    return o;
  };

  const z16 = () => new Array(16).fill(0);
  const zn = (n) => new Array(n || 16).fill(0);
  // HOW LONG THIS KIT'S BAR IS, read off the kit itself: a section operator
  // is handed a bar and must answer in the same length it was given.
  const barLen = (k) => { for (const v of Object.values(k || {}))
    if (Array.isArray(v) && v.length) return v.length; return 16; };
  const hitsAt = (...ix) => { const v = z16(); for (const i of ix) v[i] = 1; return v; };
  const SECDRUMS = {
    same:     { w: "same as before" },
    half:     { w: "half time", fn: (k) => ({ ...k, k: hitsAt(0, 6), s: hitsAt(8) }) },
    double:   { w: "double time", fn: (k) => ({ ...k, s: hitsAt(2, 6, 10, 14) }) },
    hatsonly: { w: "just the hats", fn: (k) => ({ h: k.h || z16() }) },
    nokit:    { w: "lay out", fn: () => ({}) },
    busier:   { w: "busier", fn: (k) => ({ ...k, h: new Array(barLen(k)).fill(1),
                                           o: hitsAt(0, 8) }) },
    sparser:  { w: "sparser", fn: (k) => ({ k: hitsAt(0, 8), s: hitsAt(4, 12) }) },
    ride:     { w: "move to the ride",
                fn: (k) => { const n = barLen(k), Z = zn(n);
                             return { ...k, p: k.h || Z.slice(), h: Z.slice() }; } },
  };
  // WHAT THE ENGINEER DOES TO ONE SECTION. Not the offset board — that is
  // the record's whole mix — but the SECTION's own strip, which nukernel's
  // song boxes have always carried (`lvl`, `rev`, `echo`, `fx`) and which
  // audio/desk.js composes under everything else. A breakdown that goes wet
  // and a chorus that comes forward are mix decisions about one section,
  // and they belong to whoever is mixing.
  // WHO PICKS IT UP. A melody belongs to the room; a section says whose
  // hands are on it. (The vocalist and the guitarist take the same idea when
  // their chairs exist — that is the whole reason it does not live in one.)
  const TAKERS = {
    no:   { w: "nobody takes it" },
    keys: { w: "the keys take it", chair: "keys" },
    guitar: { w: "the guitar takes it", chair: "guitar" },
    voice:  { w: "the singer takes it", chair: "voice" },
  };
  const SECMIX = {
    same:  { w: "same as before" },
    fwd:   { w: "bring it forward", box: { lvl: "fwd" } },
    back:  { w: "push it back", box: { lvl: "back" } },
    hush:  { w: "way down", box: { lvl: "hush" } },
    wet:   { w: "open the reverb", box: { rev: "wet" } },
    drown: { w: "drown it", box: { rev: "drown", lvl: "back" } },
    echo:  { w: "throw an echo", box: { echo: "some" } },
    dub:   { w: "dub it out", box: { echo: "wet", rev: "wet", fx: ["echo"] } },
    dry:   { w: "bone dry", box: { rev: "none", echo: "none" } },
  };
  /* ---------- WHAT THE BAND DOES TO WHAT IT PLAYED ------------------------
     The pipes are the kernel's second organ (kernel.js PIPES) and no chair
     could reach them: seeded transforms on the RENDERED stream — a
     chord-locked third above the line, a canon a few steps behind it, a
     strum that spreads a chord, a breath that thins it. They are not a
     player's decision and not the desk's: they are what the band does to
     what it has already played, which is why they live beside "give it a
     lift" as a section-level call.  */
  const SECPIPE = {
    none:   { w: "as played" },
    thirds: { w: "double it in thirds", p: [{ id: "harmonize", p: 0.6 }] },
    sixths: { w: "double it in sixths", p: [{ id: "harmonize", p: 0.6, gap: "sixth" }] },
    echo:   { w: "echo it round", p: [{ id: "echoCanon", delay: 3 }] },
    // two entries, one per part that holds chords: "spread the chords" means
    // all of them, whichever chair holds them (a strum pipe admits one
    // declared part — pads undeclared, the guitarist's stabs by name)
    strum:  { w: "spread the chords", p: [{ id: "strum", spread: 0.06 },
                                          { id: "strum", spread: 0.06, part: "stab" }] },
    breathe:{ w: "let it breathe", p: [{ id: "breathe" }] },
    both:   { w: "thirds and an echo",
              p: [{ id: "harmonize", p: 0.5 }, { id: "echoCanon", delay: 3 }] },
  };

  // THE MOVEMENT — a filter sweep over one section, which is the engineer's
  // signature move on a dance record and the reason a build sounds like a
  // build. It is the box's own `mot` lane (audio/desk.js compileAuto), so it
  // rides the parent's master sweep exactly as the mixer page's does.
  const SECMOVE = {
    none:  { w: "no movement" },
    open:  { w: "open the filter over it", box: { mot: "open" } },
    close: { w: "close it down", box: { mot: "close" } },
    rise:  { w: "rise into the change", box: { mot: "rise" } },
    pump:  { w: "pump it on the beat", box: { mot: "pump" } },
  };
  const SECBASS = {
    same:   { w: "same as before" },
    pedal:  { w: "pedal the root", style: "pedal" },
    walk:   { w: "walk it", style: "walk" },
    octave: { w: "octaves", style: "octaves" },
    eighths:{ w: "drive it in eighths", style: "eighths" },
    up:     { w: "up an octave", oct: 1 },
    out:    { w: "lay out", out: true },
  };

  /* ---------- THE BANDSTAND: WHO IS LISTENING TO WHOM ---------------------
     Paul, 2026-08-23: "make players affect each other (a graph, not a
     hierarchy) — the drums and the bass." Until now the box CAST each chair
     off the record and every chair then played blind: `toGenre` fans six
     models into one flat genre and the kernel renders drums, bass and the
     pitched voices from the same `(subj, g, bars)`, so nothing any player
     did could reach anybody else. A band is not that. The bass lands with
     the kick, the guitar keeps out of the singer's register, the keys thin
     out when the guitar chugs, and a drummer plays busier under a bass that
     has left them the room.

     THIS IS NOT A NEW MECHANISM — it is the one this file already had,
     declared. Two edges were already here, written out by hand:

       `per.follow` (below in toSong) — "follow the kick" is the bass locking
         to the drummer's own kick, applied to the assembled genre after both
         chairs have spoken, as `g.bassBars`
       the TAKER's hole — "whoever takes the tune leaves a hole": a guitarist
         playing the hook is not also playing the chords, so the other
         pitched chair steps up (`km = Ky.say(km, "job:comp")`)

     Both live ABOVE the chairs, both are guarded so that a hand wins, and
     both are one line of code apiece for one hard-coded pair. This table is
     those two ideas as data, with the pairs Paul named added to them.

     WHY IT IS A TABLE AND NOT A RULE THAT EVERYBODY OBEYS. If every chair
     adjusts to every other chair the records converge on one texture and
     the genre stops meaning anything: an influence that is universal is not
     an influence, it is a sound. So an edge DECLARES WHERE IT LIVES, by the
     family the record is in — and the two oldest families in the box hear
     NOTHING from this table. A Bach chorale's voices follow strict
     voice-leading and nobody "locks with the drums", because there are no
     drums; a pavane's inner parts do not thin out for a guitar. Sixteen of
     the thirty records are deliberately untouched (`the old world`, `the
     ballroom`), which is what makes the other fourteen mean something.

     THE FOUR LAWS EVERY EDGE OBEYS, and each is a guard on the row rather
     than a habit somebody has to remember:

       A HAND OUTRANKS THE GRAPH.  `hand` names what a person would have had
         to say for this edge to be none of its business — the section's own
         word, or an ANSWER on the chair (chair.js: `say` touches the model,
         `answer` writes the ledger, and `song.seeded` says which answers a
         record put there). Same rank the take already gives a hand.
       NOTHING IS FABRICATED.  An edge that writes drums may only THICKEN OR
         THIN A LANE THAT ALREADY HAS HITS. `SECDRUMS.busier` writes
         `h: fill(1)` and can therefore invent sixteen hats over a concerto;
         nothing here may, which is the kitless law held by construction
         rather than by a `kitlessOf` check bolted on afterwards.
       A WRITTEN LINE OUTRANKS A DENSITY.  A style word ("driving eighths")
         says how BUSY a part is and yields; a figure (`bassFig` — an acid
         line, a disco octave, the funk sixteenth pop) says where every note
         goes and does not.
       IT IS A FUNCTION OF THE MODEL.  No dice, no clock, no take. Same seed,
         same bytes.

     `stage` says when an edge is heard, and there are honestly two:

       "chairs"  before `toGenre` — the edge changes what somebody DECIDES to
                 play (a register, a job). It is a `say`, never an `answer`.
       "lanes"   after `toGenre` — the edge changes where the notes GO, on
                 the assembled genre, which is the tier `per.follow` already
                 worked at and the only tier where one part can read another
                 part's rhythm at all.  */

  /* HOW MUCH ROOM A BASS LEAVES — the drummer's own reading of the line, and
     deliberately NOT its onset count. A pedalled root and a walking line
     play the same four places (kernel.js STYLEGRID only writes a grid for
     eighths and sixteenths; everything else falls to quarters) and leave the
     room utterly differently: one note ringing under the bar is space, four
     notes going somewhere is not. So the room is DECLARED per style word,
     which is the word the bassist actually said.
       2  a held root — the drummer has the bar
       1  moving, but on the beats
       0  the bass is keeping the time
      -1  the bass is playing the sixteenths; get out of the way
     A written FIGURE outranks the word, as it does everywhere else: it says
     where every note is, so it is counted. */
  const BASSROOM = { pedal: 2, root: 2, fifths: 2, octaves: 1,
                     walk: 0, eighths: 0, sixteenths: -1 };
  const bassRoom = (g) => {
    const fig = g.bassFig || null;
    if (fig && fig.grid) { const n = fig.grid.filter(Boolean).length;
                           return n <= 3 ? 2 : n <= 5 ? 1 : n <= 8 ? 0 : -1; }
    const r = BASSROOM[g.bassStyle];
    return r === undefined ? 1 : r;
  };
  // the kit's bars, as the one shape every drum edge reads and writes
  const kitBars = (g) => (g.kits && g.kits.length ? g.kits : [g.kit || {}]);
  // ...and written back ONLY when a bar actually moved. Writing an unchanged
  // schedule is not free: a record that carries `kit` and no `kits` would
  // gain a one-entry `kits`, which is a different genre to `genreSig` and so
  // a different record to the pruner — a question could be retired because
  // an edge that did nothing said it had.
  const setKit = (g, bars) => {
    const was = kitBars(g);
    if (bars.length === was.length && bars.every((b, i) => b === was[i])) return g;
    g.kits = bars; g.kit = bars[0]; return g;
  };
  // WHICH LANE IS THE DRUMMER'S BUSY HAND, and only if it is already
  // playing. The hats, or the ride when they have moved to it — never a
  // lane this record does not have, which is the whole of "no mechanism may
  // put an instrument on a record that does not have one".
  const busyLane = (bar) => ["h", "p"].find((k) =>
    Array.isArray(bar && bar[k]) && bar[k].some(Boolean)) || null;
  // the registers of a chair, low to high, as the words that chair knows
  const regLadder = (K2) => Object.entries(K2.REG)
    .sort((a, b) => a[1].v - b[1].v);
  /* AN EDGE DOES NOT SPEAK THROUGH THE TRAY. A chair's `say` is guarded by
     `m.on` (chair.js: a word is only offered to a chair somebody has turned
     on), and four of the thirty records — rock, kraut, blues, pianobar —
     have a guitarist who plays without ever having been turned on. Measured
     the day this landed: the `room` edge fired on all four, `Gt.say` handed
     the model straight back, and the notes did not move by a semitone while
     every counter said the edge had run. That is the exact shape of bug
     this repo has shipped three times ("test the artifact"), so the graph
     writes the FIELD — the identical write the chair's own decision row
     makes (`apply: (m) => ({ ...m, reg: k })`), and like it, not a word on
     the `answers` ledger. Said, not answered; and heard by a chair that is
     merely playing rather than being interviewed.  */
  const seatAt = (cm, k) => ({ ...cm, reg: k });
  const jobAt = (cm, k) => ({ ...cm, job: k, gate: null });

  // the guitar jobs that are already keeping the rhythm, and the keys jobs
  // that would be keeping it with them
  const CHUGGING = new Set(["chug", "power", "drive", "skank"]);
  const CHOPPING = new Set(["comp", "charleston", "pushes", "push", "skank"]);
  // A HAND OUTRANKS THE GRAPH — the chair half of it. `answers` is the
  // ledger a person writes (chair.js `say` never touches it) and
  // `song.seeded` names the rows a RECORD put there, so an answer no record
  // seeded is a hand and no edge may move it.
  const handAt = (m, seat, id) => !!(((m[seat] || {}).answers || {})[id])
    && !seededAt(m, seat, id);

  const LISTENS = [
    /* THE ONE PAUL NAMED. A bass player and a drummer are one instrument
       with two people on it, and in every family where that is true the
       bass plays WHERE THE KICK IS rather than where a metronome is. This
       is `per.follow` with nobody having to say it — the identical write
       (`g.bassBars`, kernel.js:2427 `barGrid`), so a record that already
       said "follow the kick" is byte-for-byte what it was.
       Not jazz: a walking bass is defined by NOT following the drummer (and
       kernel.js:2447 fences the walk off from every grid but its own), and a
       jazz kick is feathered, not played. Not the old world: no kick. */
    { id: "kick", from: "drums", to: "bass", stage: "lanes",
      w: "the bass lands with the kick",
      fam: ["funk", "the floor", "breaks", "rock", "latin"],
      hand: (m, i, per) => !!per.follow || ((m.per || {})[i] || {}).bass != null,
      apply: (g, m, i, per, kit0) => {
        if (g.bassFig) return g;              // a written line outranks a lock
        if (g.bassStyle === "walk") return g; // a walk goes where it is going
        // ...and a bass that has ALREADY been scheduled is not free to
        // relock: `spaceOut` writes `bassBars` for the slow records ("one
        // hit every four bars"), and that sparseness is the record's, not
        // something a kick gets to fill in.
        if (g.bassBars) return g;
        /* THE LOCK IS TO THE GROOVE, NOT TO THIS BAR — `kit0`, the kit this
           record is made of, taken before the section said anything about
           the drums. A bass player who lands with the kick has learned the
           GROOVE; when the drummer lays out for a section they go on playing
           the line they learned, they do not revert to quarters. Reading the
           section's own kit instead broke the oldest law on this page — "a
           musician can sit out, and it leaves everybody else playing"
           (band-kit.test.js (i)) — because a nokit section has no kick and
           the bass silently became a different part. `per.follow` said out
           loud still reads the section's kit, exactly as it always has: that
           is somebody asking for THIS bar, and a hand outranks the graph. */
        if (!kit0 || !kit0.some((x) => x)) return g;   // no kick to land on
        g.bassBars = kit0;
        return g;
      } },

    /* AND THE SAME PAIR, HEARD THE OTHER WAY. "The drummer plays busier
       when the bass is sparse" — a drummer under a bass holding one root a
       bar fills the room, and gets out of the way of a sixteenth line. Both
       halves are the SAME LANE moved in opposite directions, and the lane
       is one the record already has: no lane, no edge. */
    { id: "space", from: "bass", to: "drums", stage: "lanes",
      w: "the drummer answers the room the bass leaves",
      fam: ["funk", "rock", "breaks"],
      // A ROLE DEFAULT IS NOT A HAND. The file's own test for "somebody
      // actually answered this" is the raw `m.per[i]`, not the resolved
      // `per` — `drumsAsked` and `liftAsked` in toSong are written exactly
      // this way, because every section role arrives with a drum part
      // already in it and reading the resolved word would silence the edge
      // on every section but a bare verse.
      hand: (m, i) => ((m.per || {})[i] || {}).drums != null,
      apply: (g) => {
        const room = bassRoom(g);
        if (room === 0 || room === 1) return g;      // the bass is keeping time: nothing to answer
        const bars = kitBars(g).map((bar) => {
          const lane = busyLane(bar);
          if (!lane) return bar;                     // no lane, no edge
          const v = bar[lane].slice(), n = v.length, p = (n % 6 === 0) ? 3 : 2;
          if (room >= 2) { for (let k = p; k < n; k += p * 2) if (!v[k]) v[k] = 1; }
          else { for (let k = 0; k < n; k++) if (k % (p * 2) !== 0) v[k] = 0; }
          if (!v.some(Boolean)) return bar;          // never thin a lane to nothing
          if (v.every((x, k) => x === bar[lane][k])) return bar;
          return { ...bar, [lane]: v };
        });
        return setKit(g, bars);
      } },

    /* KEEP OUT OF THE SINGER'S WAY. The oldest instruction in popular
       music, and the box could not say it: the singer's layer and the
       accompanists' are seated independently off the record's own plan
       (`finish`, plan.seat), so a mid-register guitar and a mid-register
       voice sat on top of each other and neither knew. An accompanist SEATED
       where the singer is seated moves one step off them — down by
       preference, up where the part's own compass has no down left.
       Not the old world and not the ballroom: a chorale's alto sits in the
       singer's register on purpose, and that is the voice-leading, not a
       collision. */
    { id: "room", from: "voice", to: "keys+guitar", stage: "chairs",
      w: "the accompanists keep out of the singer's register",
      fam: ["rock", "funk", "the floor", "breaks", "latin", "jazz"],
      hand: () => false,                     // guarded per chair, below
      chairs: (ctx) => {
        const vg = Vo.toGenre(ctx.vm);
        if (vg.silent) return ctx;
        /* A COLLISION IS WHERE THE PARTS SIT, NOT WHAT THEY ARE CALLED.
           "Where it sits" means a different octave to a pad, a stab and a
           riff — `stand` seats every part in its own compass — so comparing
           the register WORDS said two players were on top of each other
           whenever they happened to have answered the same question the same
           way, which is most of the time. Measured on the shipped menus, the
           word comparison fired on 18 of the 30 records and cost the
           guitarist their own register question on a rock record and the
           keys player theirs on a jazz date: the bounce landed exactly on
           one of the two words still standing, and the pruner (rightly)
           dropped a row with one answer left in it. Comparing the SEATS
           fires only where somebody is genuinely in somebody else's way. */
        const vv = stand(vg.part, vg.reg);
        for (const [seat, K2, key, floor] of [["keys", Ky, "km", null],
                                              ["guitar", Gt, "gm", GFLOOR]]) {
          const cm = ctx[key];
          if (K2.toGenre(cm).silent) continue;         // not in the room
          if (handAt(ctx.m, seat, "reg")) continue;    // a hand seated them
          /* DOWN IF THERE IS A DOWN, AND UP IF THERE IS NOT. A register word
             is not where a part ends up: `stand` clamps every chair to its
             PART's own compass (GFLOOR — a guitar riff bottoms out at 0, a
             pad likewise), and four of the thirty records have a guitarist
             already sitting on that floor. Measured: the edge fired on rock,
             kraut, blues and pianobar and the clamp ate all four — the word
             moved, the notes did not. So the candidate is judged by the
             STANDING register the kernel will actually use, and the first
             one that genuinely clears the singer is the one taken. */
          const seatedAt = (mm) => { const gg = K2.toGenre(mm);
            const pt = typeof gg.part === "function" ? gg.part(0) : gg.part;
            const rg = typeof gg.reg === "function" ? gg.reg(0) : gg.reg;
            return stand(pt, rg, floor || undefined); };
          const was = seatedAt(cm);
          if (was !== vv) continue;                    // not in anybody's way
          const lad = regLadder(K2), at = lad.findIndex(([k2]) => k2 === cm.reg);
          for (const cand of [lad[at - 1], lad[at + 1]]) {
            if (!cand) continue;
            const nx = seatAt(cm, cand[0]);
            if (seatedAt(nx) === was) continue;        // the compass swallowed it
            ctx[key] = nx; break;
          }
        }
        return ctx;
      } },

    /* AND THE ONE BETWEEN THE TWO HANDS IN THE MIDDLE. Paul: "the keys thin
       out when the guitar chugs." Two chairs comping the same chords in the
       same eighths is the sound of a demo, not a band — the taker rule
       already says as much in the other direction ("a guitarist playing the
       hook is not also playing the chords"), and this is the same sentence
       with the guitar keeping the rhythm instead of the tune. The keys go to
       `held` — the chords still there, ringing to the change instead of
       chopped against a part that is already chopping. */
    { id: "chug", from: "guitar", to: "keys", stage: "chairs",
      w: "the keys thin out under a chugging guitar",
      fam: ["rock", "funk", "the floor"],
      hand: (m, i) => ((m.per || {})[i] || {}).keys != null
        || handAt(m, "keys", "job"),
      chairs: (ctx) => {
        const gj = ctx.gm.job, kj = ctx.km.job;
        if (!CHUGGING.has(gj) || !CHOPPING.has(kj)) return ctx;
        if (Gt.toGenre(ctx.gm).silent) return ctx;
        // ...and a BAR SOMEBODY WROTE is a hand: a new job clears the gate
        // (chair.js), so a keys player who has moved their own hands keeps
        // the part they moved them for.
        if (ctx.km.gate) return ctx;
        ctx.km = jobAt(ctx.km, "held");
        return ctx;
      } },
  ];
  // WHICH EDGES THIS RECORD HEARS. The family is the record's own
  // (`GENRES[...].fam`); a record the arranger has not called hears nothing,
  // because an influence without an idiom is exactly the mush this table
  // exists to avoid.
  const earsOf = (m) => {
    const gk = GENRES[m.song.genre];
    if (!gk || !gk.fam) return [];
    return LISTENS.filter((e) => e.fam.includes(gk.fam));
  };

  /* HOW AN EDGE IS ACTUALLY HEARD. Two appliers, one per stage, and both
     are the same four lines: which edges does this record hear, did a hand
     already say this, and then the edge's own function. They are pure —
     `listenChairs` hands back new chair models (every chair word returns a
     new object) and `listenLanes` writes onto the section's own `g`, which
     `toSong` has already built fresh for this section.
     A RECORD NOBODY CALLED HEARS NOTHING: `earsOf` returns [] without a
     family, so a blank model, the opening record and every session saved
     before this existed render byte for byte what they always did. */
  // ONE HIT EVERY FOUR BARS IS NOT A BAND NOT LISTENING. `spaceOut` is the
  // slowest thing a band can do, and it has already decided both the kit
  // and the bass schedule by the time an edge is heard — so the whole table
  // stands down on a spaced record, exactly as the arc's `busier` already
  // does (`!(SPACE[m.song.space || "none"] || {}).bars`, in toSong).
  const spaced = (m) => !!(SPACE[m.song.space || "none"] || {}).bars;
  const listenChairs = (m, i, per, ctx) => {
    if (spaced(m)) return ctx;
    for (const e of earsOf(m)) {
      if (e.stage !== "chairs" || !e.chairs) continue;
      if (e.hand(m, i, per)) continue;
      ctx = e.chairs(ctx) || ctx;
    }
    return ctx;
  };
  const listenLanes = (m, i, per, g, kit0) => {
    if (spaced(m)) return g;
    for (const e of earsOf(m)) {
      if (e.stage !== "lanes" || !e.apply) continue;
      if (e.hand(m, i, per)) continue;
      g = e.apply(g, m, i, per, kit0) || g;
    }
    return g;
  };
  // ...and the same table, as a thing a gate or a page can read: who is
  // listening to whom on THIS record, in the band's own words.
  const listensOn = (m) => earsOf(m).map((e) =>
    ({ id: e.id, from: e.from, to: e.to, stage: e.stage, w: e.w }));

  /* ---------- WHAT KIND OF RECORD: the arranger calls the genre ----------
     A bandleader says "it's a jazz date" or "this one's a house record"
     before anybody plays a note, and everything after that is narrowed by
     it — narrowed, NOT decided. The drummer still picks the groove and the
     kit, the bassist still picks the line and the instrument; the genre
     only says which of them are on the table. A constraint that leaves one
     answer is not a constraint, it is a decision, and the arranger does not
     get to make the players' decisions for them (see `narrow`).

     Everything here is stored as the WORD the player actually knows, so a
     row that names a groove or a machine nobody has fails the gate rather
     than quietly offering nothing. */
  /* HOW FAST THE CHORDS MOVE, per record (HRATE above). A record carries a
     `hrw` only when it is a record that does NOT take its changes a bar at a
     time; everything else is offered all three words and the dice reaches
     them all. THE GENRE-LABELLED CORPUS IS WHY, and it is unusually clean —
     median share of barlines carrying a change, by rip:
       jazz 0.667 · classical_midiworld 0.593 · classical_greats 0.563 ·
       classical_piano 0.557 · ragtime 0.550 · classical_guitar 0.545 ·
       classical_mfiles 0.514 · classical_violin 0.506 · bulk 0.504 ·
       folk 0.450 · dub 0.431
     Jazz moves fastest and classical is next, which is why a jazz date, a
     Viennese classic, a concerto and the waltzes may still say "a chord a
     bar" — but NOT ONE of the eleven families exceeds 2.2% of records
     pinned at 0.95 or above (classical piano, classical violin, folk, dub
     and ragtime are at 0.0%), so no idiom gets to be pinned there for a
     whole record. */
  const HRSLOW = ["two bars each", "one to a phrase"];

  const GENRES = {
    house:   { w: "a house record", fam: "the floor", bpm: 120, chords: "plain", when: ["the eighties", "the nineties", "now"], where: ["Chicago", "New York", "London"], venue: ["a warehouse", "a club"], gtr: ["a clean electric", "a jazz box", "a muted one"], gjob: "skank", keys: ["a warm pad", "a polysynth", "a Rhodes", "an electric piano", "strings"], kjobs: ["pads", "arp", "skank", "swell"], forms: ["vamp", "dance", "twelve", "dj"], fig: "offbeat", artic: "staccato", tone: { cut: 700,  q: 6,  rel: 0.16 },
               grooves: ["house", "four on the floor", "disco", "uk garage"],
               machines: ["909", "808", "electronic kit"],
               styles: ["hold the root", "octaves", "driving eighths"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["the four-chord one", "a minor vamp", "one chord, all night"] },
    techno:  { w: "a techno record", fam: "the floor", bpm: 120, chords: "plain", when: ["the eighties", "the nineties", "now"], where: ["Detroit", "Berlin"], venue: ["a warehouse", "a club"], gtr: ["a muted one", "a clean electric", "a crunchy one"], gjob: "out", keys: ["a glassy pad", "a polysynth", "a warm pad", "strings"], kjobs: ["drone", "pads", "arp", "riff"], forms: ["vamp", "dance", "twelve", "dj"], fig: "acid", artic: "staccato", tone: { cut: 600,  q: 8,  rel: 0.13 },
               grooves: ["techno", "four on the floor", "gabber"],
               machines: ["909", "606", "electronic kit"],
               styles: ["hold the root", "driving eighths", "busy sixteenths"],
               instr: ["a synth bass", "with a pick"],
               chg: ["one chord, all night", "a pedal", "a minor vamp"], hrw: HRSLOW },
    disco:   { w: "a disco record", fam: "the floor", bpm: 120, chords: "sevens", when: ["the seventies", "the eighties"], where: ["New York", "Philadelphia"], venue: ["a club", "a wedding"], gtr: ["a clean electric", "a jazz box", "a muted one"], gjob: "skank", keys: ["a Rhodes", "strings", "a clav", "an electric piano"], kjobs: ["comp", "skank", "arp", "push"], forms: ["dance", "versechorus", "vamp", "twelve"], fig: "discoct", artic: "staccato", tone: { cut: 950,  q: 3,  rel: 0.20 },
               grooves: ["disco", "four on the floor", "two step"],
               machines: ["acoustic kit", "room kit", "909"],
               styles: ["octaves", "driving eighths", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["the four-chord one", "two-five-one", "the doo-wop changes"] },
    hiphop:  { w: "a boom-bap record", fam: "breaks", bpm: 96, chords: "sevens", when: ["the eighties", "the nineties", "the two-thousands"], where: ["New York", "Los Angeles"], venue: ["a block party", "a basement", "a club"], gtr: ["a clean electric", "a jazz box", "a muted one"], gjob: "out", keys: ["a Rhodes", "an electric piano", "a warm pad", "a grand piano"], kjobs: ["pads", "comp", "riff", "held"], forms: ["versechorus", "pop", "vamp"], artic: "normal", tone: { cut: 520,  q: 2,  rel: 0.45 },
               grooves: ["boom bap", "breakbeat", "trap"],
               machines: ["808", "909", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["a minor vamp", "one chord, all night", "two-five-one"], hrw: HRSLOW },
    jungle:  { w: "a jungle record", fam: "breaks", bpm: 144, chords: "plain", when: ["the nineties", "the two-thousands"], where: ["London", "Bristol"], venue: ["a warehouse", "a club"], gtr: ["a clean electric", "a muted one", "a jazz box"], gjob: "out", keys: ["a glassy pad", "a warm pad", "a polysynth", "strings"], kjobs: ["pads", "swell", "drone", "riff"], forms: ["dance", "twelve", "vamp", "dj"], artic: "normal", tone: { cut: 480,  q: 5,  rel: 0.70 },
               grooves: ["amen break", "jungle", "breakbeat"],
               machines: ["electronic kit", "909", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "with a pick"],
               chg: ["a minor vamp", "one chord, all night"], hrw: HRSLOW },
    rock:    { w: "a rock record", fam: "rock", bpm: 120, chords: "plain", when: ["the sixties", "the seventies", "the eighties", "the nineties"], where: ["London", "Los Angeles", "New York"], venue: ["a stadium", "a bar", "a festival"], gtr: ["an overdriven one", "a crunchy one", "a distorted one", "a clean electric", "a re-amped DI"], gjob: "power", keys: ["an organ", "a rock organ", "a grand piano", "an upright"], kjobs: ["comp", "pads", "held", "riff"], forms: ["versechorus", "pop", "full", "aaba"], artic: "normal", gtrTone: { cut: 1300 }, tone: { cut: 1100, q: 2,  rel: 0.24 },
               grooves: ["straight rock", "driving rock", "stomp", "half time"],
               machines: ["acoustic kit", "room kit", "big kit"],
               styles: ["hold the root", "driving eighths", "root and fifth"],
               instr: ["with a pick", "fingers on a P-bass"],
               chg: ["the doo-wop changes", "the four-chord one", "a twelve-bar blues"] },
    punk:    { w: "a punk record", fam: "rock", bpm: 144, chords: "plain", when: ["the seventies", "the eighties"], where: ["London", "New York", "Manchester"], venue: ["a basement", "a bar", "a club"], gtr: ["a distorted one", "an overdriven one", "a crunchy one", "a re-amped DI"], gjob: "drive", keys: ["a rock organ", "an organ", "an upright"], kjobs: ["comp", "push", "riff"], forms: ["versechorus", "pop", "vamp"], fig: "pump", artic: "staccato", tone: { cut: 1400, q: 2,  rel: 0.18 },
               grooves: ["punk", "driving rock", "stomp"],
               machines: ["acoustic kit", "big kit"],
               styles: ["driving eighths", "hold the root"],
               instr: ["with a pick", "fingers on a P-bass"],
               chg: ["the four-chord one", "the doo-wop changes"] },
    kraut:   { w: "a krautrock record", fam: "rock", bpm: 120, chords: "plain", when: ["the seventies", "the eighties"], where: ["Berlin", "Düsseldorf"], venue: ["a studio", "a festival"], gtr: ["a clean electric", "a crunchy one", "a muted one"], gjob: "chug", keys: ["a polysynth", "a glassy pad", "a warm pad", "an organ"], kjobs: ["arp", "drone", "pads", "riff"], forms: ["vamp", "dance", "full"], fig: "pump", artic: "normal", tone: { cut: 850,  q: 5,  rel: 0.30 },
               grooves: ["motorik", "bare bones", "half time"],
               machines: ["electronic kit", "room kit", "606"],
               styles: ["hold the root", "driving eighths"],
               instr: ["a synth bass", "with a pick"],
               chg: ["one chord, all night", "a pedal"], hrw: HRSLOW },
    jazz:    { w: "a jazz date", fam: "jazz", bpm: 144, chords: "sevens", when: ["the fifties", "the sixties", "now"], where: ["New York", "New Orleans", "Paris"], venue: ["a club", "a bar", "a studio"], gtr: ["a jazz box", "a nylon-string", "a clean electric"], gjob: "strum", keys: ["a grand piano", "a Rhodes", "an upright", "a church organ"], kjobs: ["comp", "charleston", "pushes", "held", "counter"], forms: ["head", "aaba", "blues"], swing: "swing", artic: "legato", gtrTone: { cut: 1000 }, tone: { cut: 1200, q: 1,  rel: 0.35 },
               grooves: ["jazz ride", "bebop", "brush swing"],
               machines: ["jazz kit", "brushes", "acoustic kit"],
               styles: ["walk it", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["two-five-one", "a twelve-bar blues", "the doo-wop changes"] },
    blues:   { w: "a blues", fam: "rock", bpm: 96, chords: "all7", when: ["the fifties", "the sixties"], where: ["Chicago", "Memphis", "New Orleans"], venue: ["a bar", "a club", "a porch", "a parlor"], gtr: ["a crunchy one", "a clean electric", "a steel-string acoustic"], gjob: "riff", keys: ["an upright", "a rock organ", "a grand piano", "a Rhodes"], kjobs: ["comp", "riff", "held", "push"], forms: ["blues", "versechorus", "aaba"], swing: "shuffle", artic: "normal", gtrTone: { cut: 1300 }, tone: { cut: 1000, q: 1,  rel: 0.30 },
               grooves: ["shuffle", "train beat", "straight rock"],
               machines: ["acoustic kit", "room kit", "brushes"],
               styles: ["walk it", "root and fifth", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["a twelve-bar blues", "the doo-wop changes"], hrw: HRSLOW },
    funk:    { w: "a funk record", fam: "funk", bpm: 96, chords: "nines", when: ["the seventies", "the eighties"], where: ["New Orleans", "Detroit", "Los Angeles"], venue: ["a club", "a bar", "a festival"], gtr: ["a clean electric", "a muted one", "a jazz box"], gjob: "skank", keys: ["a clav", "a Rhodes", "an organ", "an electric piano"], kjobs: ["skank", "comp", "riff", "push"], forms: ["vamp", "versechorus", "dance"], fig: "funk16", artic: "staccato", tone: { cut: 900,  q: 7,  rel: 0.14 },
               grooves: ["funk", "linear funk", "new orleans", "motown"],
               machines: ["acoustic kit", "room kit", "808"],
               styles: ["busy sixteenths", "octaves", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["one chord, all night", "a minor vamp"], hrw: HRSLOW },
    reggae:  { w: "a reggae record", fam: "latin", bpm: 96, chords: "plain", when: ["the seventies", "the eighties"], where: ["Kingston", "London"], venue: ["a dancehall", "a festival", "a yard"], gtr: ["a clean electric", "a muted one", "a jazz box"], gjob: "skank", keys: ["an organ", "a Rhodes", "a rock organ", "a grand piano"], kjobs: ["skank", "comp", "pads"], forms: ["vamp", "dub", "versechorus"], fig: "bubble", artic: "legato", gtrTone: { cut: 1600 }, tone: { cut: 420,  q: 2,  rel: 0.55 },
               grooves: ["one drop", "steppers", "rockers"],
               machines: ["acoustic kit", "room kit", "808"],
               styles: ["hold the root", "octaves"],
               instr: ["fingers on a P-bass", "a synth bass"],
               chg: ["a minor vamp", "one chord, all night"], hrw: HRSLOW },
    bossa:   { w: "a bossa", fam: "latin", bpm: 120, chords: "sevens", when: ["the sixties", "the seventies"], where: ["Rio", "New York"], venue: ["a bar", "a studio", "a club"], gtr: ["a nylon-string", "a jazz box", "a steel-string acoustic"], gjob: "strum", keys: ["a grand piano", "a Rhodes", "a felt piano", "an upright"], kjobs: ["comp", "charleston", "pushes", "arp"], forms: ["aaba", "versechorus", "head"], artic: "normal", tone: { cut: 1000, q: 1,  rel: 0.28 },
               grooves: ["bossa nova", "samba", "rumba", "cha cha"],
               machines: ["jazz kit", "brushes", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["two-five-one", "the four-chord one"] },
    slow:    { w: "something slow and open", fam: "rock", bpm: 72, chords: "sus", when: ["the nineties", "the two-thousands", "now"], where: ["Berlin", "Reykjavík", "London"], venue: ["a bedroom", "a studio", "a church"], gtr: ["a clean electric", "a steel-string acoustic", "a nylon-string", "harmonics"], gjob: "ring", keys: ["a warm pad", "strings", "a felt piano", "a glassy pad"], kjobs: ["swell", "pads", "drone", "arp"], forms: ["vamp", "full", "dub"], fig: "stab", space: "four", artic: "legato", tone: { cut: 520,  q: 3,  rel: 1.20 },
               grooves: ["bare bones", "half time"],
               machines: ["electronic kit", "room kit", "808"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["a pedal", "one chord, all night"], hrw: HRSLOW },
    // A CHAMBER BALLAD (PLAN.md THE THROUGH-COMPOSED THEME, the Yesterday
    // study's front-door gap): the sixties, London or Liverpool, a studio —
    // the quartet in the room and the song on the steel-string, so the
    // front door stops needing to lie by a century. Named the way the
    // records name themselves: not "chamber pop" (nobody in 1965 said it),
    // not "a ballad" (the slow record owns half that word). Its kitless
    // default rides the universal-tacet law (drums-kit grooveOpts): any
    // drummer can sit out, whatever the family.
    chamber: { w: "a chamber ballad", fam: "jazz", bpm: 84, chords: "plain",
               // ...two entries per door on purpose (the catalog's own law:
               // a city all alone on one record strands the questions beside
               // it — Liverpool must leave a second decade and a second room
               // standing): the strings-and-song records run into the
               // seventies, and the quartet plays halls as well as studios
               when: ["the sixties", "the seventies"],
               where: ["London", "Liverpool"],
               venue: ["a studio", "a concert hall"],
               gtr: ["a steel-string acoustic", "a nylon-string", "a clean electric"],
               gjob: "strum",
               keys: ["an upright", "strings", "a felt piano", "a grand piano"],
               kjobs: ["comp", "arp", "counter", "held"],
               forms: ["aaba", "full", "versechorus", "strophic"], artic: "normal",
               tone: { cut: 900, q: 1, rel: 0.5 },
               grooves: ["nobody on the kit", "brush swing"],
               machines: ["brushes", "room kit"],
               styles: ["hold the root", "root and fifth", "walk it"],
               instr: ["a cello", "an upright bass"],
               chg: ["a descending line", "the doo-wop changes", "the four-chord one"], hrw: HRSLOW },

    /* ---- THE OLD WORLD (2026-08-21): twelve records, Rome 600 → New York
       1892. The design law for every one of them: a pre-1900 record never
       REMOVES a chair — it narrows each chair to what the century can
       honestly hold and defaults the anachronistic ones to their sit-out
       words (gjob "out", the drummer's "nobody on the kit", SECBASS.out per
       section). The dice stays complete: every array ≥2 entries, every
       combination renders (drumless is proven playable by the bass chair —
       the band's bass always plays unless a section says out, and an
       upright pedal under a chant is the ison, which is real practice).
       Every groove here is from the drummer's own "the old world" family,
       every bass word from the two period instruments the bass chair
       gained, and the lute is the nylon-string said plainly. */
    chant:    { w: "a chant record", fam: "the old world", scale: "mode", bpm: 72, chords: "plain",
                when: ["the six-hundreds", "the twelve-hundreds"], where: ["Rome", "Paris"],
                venue: ["a cathedral", "a chapel"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "out",
                // the harp is the psalmist's own instrument — the one
                // keyboard-chair word here older than the chant itself
                keys: ["voices", "a church organ", "a harp"], kjobs: ["drone"],
                forms: ["vamp", "strophic"], artic: "legato",
                tone: { cut: 2000, q: 1, rel: 2.2 },
                grooves: ["nobody on the kit", "a processional"],
                machines: ["brushes", "room kit"],
                styles: ["hold the root", "octaves"],
                instr: ["an upright bass", "a cello"],
                chg: ["a pedal", "one chord, all night"], hrw: HRSLOW },
    organum:  { w: "an organum", fam: "the old world", scale: "mode", bpm: 72, chords: "plain",
                when: ["the twelve-hundreds"], where: ["Paris", "Reims"],
                venue: ["a cathedral"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "out",
                keys: ["voices", "a church organ", "a harp"], kjobs: ["drone", "held"],
                forms: ["vamp", "strophic"], artic: "legato",
                tone: { cut: 2000, q: 1, rel: 2.8 },
                grooves: ["nobody on the kit", "a processional"],
                machines: ["brushes", "room kit"],
                styles: ["hold the root", "octaves"],
                instr: ["an upright bass", "a cello"],
                chg: ["a pedal", "one chord, all night"], hrw: HRSLOW },
    trobar:   { w: "a troubadour song", fam: "the old world", scale: "mode", bpm: 96, chords: "plain",
                when: ["the twelve-hundreds", "the thirteen-hundreds"],
                // Reims is the trouvères' Champagne — the northern answer to
                // the troubadours, and what keeps that city's door two-wide
                where: ["Provence", "Paris", "Reims"], venue: ["a court", "a village green"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "strum",
                // the keys of 1210 are an organetto or nothing — the
                // harpsichord waits three centuries for the pavane
                keys: ["voices", "a church organ", "a harp"], kjobs: ["pads", "drone", "arp"],
                forms: ["strophic", "aaba", "versechorus"], artic: "legato",
                tone: { cut: 2400, q: 1, rel: 1.1 },
                grooves: ["nobody on the kit", "the tabor"],
                machines: ["brushes", "room kit"],
                styles: ["hold the root", "root and fifth"],
                instr: ["an upright bass", "a cello"],
                chg: ["a pedal", "a descending line"], hrw: HRSLOW },
    estampie: { w: "an estampie", fam: "the old world", scale: "mode", bpm: 120, chords: "plain",
                when: ["the thirteen-hundreds"], where: ["Paris", "Provence"],
                venue: ["a village green", "a court"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "ring",
                keys: ["a church organ", "voices", "a harp"], kjobs: ["drone", "riff", "arp"],
                forms: ["vamp", "dacapo"], artic: "normal",
                tone: { cut: 2600, q: 1, rel: 0.5 },
                grooves: ["the tabor", "a processional"],
                machines: ["room kit", "brushes"],
                styles: ["hold the root", "octaves"],
                instr: ["an upright bass", "a cello"],
                chg: ["a pedal", "one chord, all night"], hrw: HRSLOW },
    pavane:   { w: "a pavane", fam: "the old world", scale: "mode", bpm: 72, chords: "plain",
                // ...into the sixteen-hundreds honestly: Dowland's pavans and
                // Sweelinck's keyboard ones are 1600s music
                when: ["the fifteen-hundreds", "the sixteen-hundreds"], where: ["Antwerp", "London"],
                venue: ["a court", "a chapel"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "strum",
                keys: ["a harpsichord", "voices", "a church organ"], kjobs: ["comp", "held", "arp"],
                forms: ["dacapo", "vamp", "strophic"], artic: "normal",
                tone: { cut: 2400, q: 1, rel: 0.8 },
                grooves: ["a processional", "the tabor"],
                machines: ["room kit", "brushes"],
                styles: ["hold the root", "root and fifth"],
                instr: ["an upright bass", "a cello"],
                chg: ["the old passamezzo", "a descending line"], hrw: HRSLOW },
    monody:   { w: "the new music", fam: "the old world", scale: "mode", bpm: 72, chords: "sus",
                // the Camerata met through the 1590s; Le nuove musiche is
                // 1602 — the practice straddles the century line. And the
                // opera house is monody's own child (Peri, Monteverdi), which
                // is also what keeps that venue's door two-wide.
                when: ["the fifteen-hundreds", "the sixteen-hundreds"],
                where: ["Florence", "Venice"],
                venue: ["a court", "a salon", "an opera house"],
                gtr: ["a nylon-string", "a jazz box"], gjob: "out",
                // the arpa doppia is real continuo practice — Caccini's own pit
                keys: ["a harpsichord", "a church organ", "a harp"], kjobs: ["comp", "arp", "held"],
                forms: ["strophic", "dacapo", "aaba"], artic: "legato",
                tone: { cut: 2200, q: 1, rel: 1.4 },
                grooves: ["nobody on the kit", "the tabor"],
                machines: ["brushes", "room kit"],
                styles: ["hold the root", "walk it"],
                instr: ["a cello", "an upright bass"],
                chg: ["a descending line", "a pedal"], hrw: HRSLOW },
    concerto: { w: "a concerto", fam: "the old world", scale: "mode", bpm: 120, chords: "sevens",
                // Corelli's concerto grosso is the 1680s: the form starts in
                // the sixteen-hundreds and peaks in the seventeen-hundreds
                when: ["the sixteen-hundreds", "the seventeen-hundreds"],
                where: ["Venice", "Leipzig"],
                venue: ["a court", "a concert hall", "a church"],
                gtr: ["a nylon-string", "a jazz box"], gjob: "out",
                keys: ["a harpsichord", "a church organ", "strings"], kjobs: ["comp", "arp", "counter", "held"],
                forms: ["head", "dacapo", "full"], artic: "normal",
                tone: { cut: 2600, q: 1, rel: 0.6 },
                grooves: ["nobody on the kit", "a processional"],
                machines: ["room kit", "brushes"],
                styles: ["driving eighths", "walk it", "hold the root"],
                instr: ["a cello", "an upright bass"],
                chg: ["a descending line", "two-five-one"] },
    vienna:   { w: "a Viennese classic", fam: "the old world", scale: "mode", bpm: 120, chords: "plain",
                when: ["the seventeen-hundreds"], where: ["Vienna"],
                venue: ["a salon", "a court", "a concert hall"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "out",
                // the Alberti hand IS the arpeggios job
                keys: ["a grand piano", "a harpsichord", "strings"], kjobs: ["arp", "comp", "counter", "held"],
                forms: ["aaba", "dacapo", "full", "versechorus"], artic: "normal",
                tone: { cut: 3000, q: 1, rel: 0.7 },
                grooves: ["nobody on the kit", "a processional"],
                machines: ["brushes", "room kit"],
                styles: ["hold the root", "root and fifth", "walk it"],
                instr: ["an upright bass", "a cello"],
                chg: ["two-five-one", "the doo-wop changes"] },
    nocturne: { w: "a nocturne", fam: "the old world", scale: "mode", bpm: 72, chords: "sevens",
                when: ["the eighteen-hundreds"], where: ["Paris", "Vienna"],
                venue: ["a salon", "a parlor"],
                gtr: ["a nylon-string", "a jazz box"], gjob: "out",
                keys: ["a grand piano", "a felt piano", "an upright"], kjobs: ["arp", "pads", "counter", "swell"],
                forms: ["dacapo", "aaba"], artic: "legato",
                tone: { cut: 2600, q: 1, rel: 2.0 },
                grooves: ["nobody on the kit", "a processional"],
                machines: ["brushes", "room kit"],
                styles: ["hold the root", "octaves"],
                instr: ["an upright bass", "a cello"],
                chg: ["the doo-wop changes", "a descending line"], hrw: HRSLOW },
    romantic: { w: "a romantic symphony", fam: "the old world", scale: "mode", bpm: 72, chords: "sevens",
                when: ["the eighteen-hundreds"], where: ["Vienna", "Paris"],
                venue: ["a concert hall", "an opera house"],
                gtr: ["a nylon-string", "a jazz box"], gjob: "out",
                keys: ["strings", "a church organ", "a warm pad"], kjobs: ["swell", "pads", "arp", "counter"],
                forms: ["full", "dacapo", "aaba"], artic: "legato",
                tone: { cut: 2000, q: 1, rel: 2.4 },
                // the timpani tread first: an orchestra HAS a drum
                grooves: ["a processional", "nobody on the kit"],
                machines: ["room kit", "brushes"],
                styles: ["hold the root", "walk it", "octaves"],
                instr: ["a cello", "an upright bass"],
                chg: ["a descending line", "two-five-one", "a minor vamp"], hrw: HRSLOW },
    salon:    { w: "a barcarolle", fam: "the old world", scale: "mode", bpm: 96, chords: "plain",
                // ...AND IT SAYS SIX NOW (2026-08-22). A barcarolle IS 6/8 —
                // the gondolier's rock — and this row used to buy the lilt
                // with a shuffle over a sixteen-step bar, which is a triplet
                // FEEL in four and not the meter at all. The comment said so
                // out loud ("the 6/8 rock is the triplet feel, honestly"); a
                // record whose comment admits it is faking is exactly the
                // thing to make honest the moment the bar can be twelve.
                // The swing comes off with it: swinging a compound bar bends
                // the eighths that ARE the lilt — and the TEMPO moves too:
                // in compound time the felt beat is the dotted quarter, so
                // the 72 this row used to say is a pulse of 48 a minute,
                // under the floor the tempo question is itself written
                // against ("72 IS THE FLOOR ON PURPOSE"). 96 is a
                // barcarolle's own rock: 64 dotted quarters to the minute.
                meter: "six",
                when: ["the eighteen-hundreds"], where: ["Paris", "Vienna"],
                venue: ["a salon", "an opera house"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "ring",
                keys: ["a harp", "a grand piano", "a felt piano"], kjobs: ["arp", "comp", "counter", "held"],
                forms: ["dacapo", "strophic", "versechorus"], artic: "legato",
                tone: { cut: 2400, q: 1, rel: 1.6 },
                // ...and the six-count table's own: the drummer sits out (a
                // salon has no kit), or plays the siciliana that is the
                // rocking figure itself
                grooves: ["nobody on the kit", "a siciliana"],
                machines: ["brushes", "room kit"],
                styles: ["hold the root", "root and fifth"],
                instr: ["a cello", "an upright bass"],
                chg: ["the doo-wop changes", "a pedal"], hrw: HRSLOW },
    parlor:   { w: "a parlor song", fam: "the old world", scale: "mode", bpm: 96, chords: "plain",
                when: ["the eighteen-hundreds"], where: ["New York", "London"],
                venue: ["a parlor", "a salon"],
                gtr: ["a steel-string acoustic", "a nylon-string"], gjob: "strum",
                keys: ["an upright", "a grand piano", "a felt piano"], kjobs: ["comp", "charleston", "arp", "push"],
                forms: ["versechorus", "strophic", "aaba"], artic: "normal",
                tone: { cut: 2600, q: 1, rel: 0.9 },
                grooves: ["nobody on the kit", "the tabor"],
                machines: ["brushes", "room kit"],
                styles: ["hold the root", "root and fifth", "walk it"],
                instr: ["an upright bass", "a cello"],
                chg: ["the doo-wop changes", "the four-chord one"], hrw: HRSLOW },

    /* ---- THE RECORDS THAT COUNT IN THREE (2026-08-22) -------------------
       Meter landed as a question (ARR `meter`) and nothing on the front door
       used it, which meant a waltz was two taps away from a record that was
       not one — and the repertoire panel's own verdict was that meter
       excludes repertoire BEFORE A NOTE IS WRITTEN. A record is when it is,
       where it is and what room it is in; how it COUNTS is the same kind of
       fact, so it belongs on the row beside the tempo and the feel, said
       once by the arranger who calls the tune.

       `meter` on a row is the WORD (chair.js METS), not the numbers, and it
       lands exactly the way `swing` and `bpm` do: it is what the room
       assumes until somebody says otherwise, and answering "how does it
       count?" outranks it. A row that says nothing about it is byte for
       byte the record it always was.

       THREE LAWS a metered row obeys, and the gate holds all three:
       a groove belongs to a meter (the words here are from the drummer's
       own three-count table, never the sixteen-step one); a FIGURE means
       sixteen (bass-kit FOURONLY), so none of these rows names one; and
       every one of them still leaves two answers standing at every
       question, so the dice can roll it. */
    // THE VIENNESE WALTZ, which the daw's own catalog has carried as a DEBT
    // since the old world landed (genres.js `barcarolle`: "the Viennese
    // waltz is BLOCKED on purpose... a waltz in 4/4 is not a waltz"). It is
    // not blocked here any more: the bar can be twelve.
    waltz:    { w: "a waltz", fam: "the ballroom", scale: "mode", bpm: 144,
                chords: "plain", meter: "three",
                // ...and it did not stop in 1899: a ballroom is still a
                // ballroom, the New Year's concert and a floor with a
                // teacher on it. The catalog's two-wide law needs the second
                // era anyway — "a ballroom" is a door only this record has,
                // so one decade would leave "when is it?" with a single
                // answer, which is not a question.
                when: ["the eighteen-hundreds", "now"], where: ["Vienna", "Paris"],
                venue: ["a ballroom", "a salon"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "out",
                keys: ["a grand piano", "strings", "a harp"], kjobs: ["comp", "arp", "held", "counter"],
                forms: ["dacapo", "aaba", "strophic", "versechorus"], artic: "normal",
                tone: { cut: 2600, q: 1, rel: 0.9 },
                grooves: ["a waltz", "a viennese lift", "boom chick chick"],
                machines: ["room kit", "brushes"],
                // oom-pah-pah: the root on the boom, the band on the chicks
                styles: ["root and fifth", "hold the root", "walk it"],
                instr: ["an upright bass", "a cello"],
                chg: ["two-five-one", "the doo-wop changes"] },
    hymn:     { w: "a hymn tune", fam: "the old world", scale: "mode", bpm: 96,
                chords: "plain", meter: "three",
                // SLANE ("Be Thou My Vision") is 3/4 and shipped from this
                // box as 4/4 with a machine-added tied fourth beat — every
                // bar a third too long, and no tempo can compensate. A
                // hymnal is of course mixed: "in four" is one tap, and
                // common metre is right there.
                when: ["the eighteen-hundreds", "now"], where: ["London", "New York"],
                venue: ["a church", "a chapel"],
                gtr: ["a nylon-string", "a steel-string acoustic"], gjob: "out",
                // the organ holds it and the congregation is the choir; each
                // chord rings to the change, which is what `held` means
                keys: ["a church organ", "voices", "a grand piano"], kjobs: ["held", "comp", "pads"],
                forms: ["strophic", "versechorus", "aaba"], artic: "legato",
                tone: { cut: 2000, q: 1, rel: 1.4 },
                // nobody is on a kit in a church; the tread is the other
                // honest answer, and both are the three-count old world
                grooves: ["nobody on the kit", "a slow three"],
                machines: ["room kit", "brushes"],
                styles: ["hold the root", "octaves"],
                instr: ["an upright bass", "a cello"],
                chg: ["two-five-one", "a descending line"], hrw: HRSLOW },
    pianobar: { w: "a piano-bar waltz", fam: "rock", bpm: 120, chords: "sevens",
                meter: "three",
                // the modern one, and the one the panel named: most of the
                // Joel songbook is unreachable without a bar of three
                // ("Piano Man" is 3/4 and the box could not hold it)
                when: ["the seventies", "now"], where: ["New York", "Los Angeles"],
                venue: ["a bar", "a piano bar"],
                gtr: ["a steel-string acoustic", "a clean electric", "a nylon-string"],
                gjob: "strum",
                keys: ["a grand piano", "an upright", "a Rhodes", "strings"], kjobs: ["comp", "charleston", "arp", "pushes", "counter"],
                forms: ["versechorus", "pop", "aaba", "strophic"], artic: "normal",
                tone: { cut: 1000, q: 1, rel: 0.35 },
                grooves: ["a rock waltz", "nobody on the kit"],
                machines: ["brushes", "acoustic kit", "room kit"],
                styles: ["hold the root", "root and fifth", "walk it"],
                instr: ["fingers on a P-bass", "an upright bass"],
                chg: ["the doo-wop changes", "the four-chord one", "two-five-one"] },
  };
  const genreOf = (m) => GENRES[m.song.genre] || null;

  /* ======================================================================
     THE RECORD ARRIVES FINISHED (PLAN.md THE PRODUCT §2, 2026-08-22)
     ======================================================================
     Paul, verbatim: "I answer a few questions about time, location and
     genre. You compose themes and set everything up clamped and mixed to
     that. I can tweak it all but you make logical decisions about the
     songs."

     Until now the front door cast a band and called a record and then left
     four things generic, whatever the idiom: the THEME came out of
     ideas-kit's blank model (three notes and a rest, arching, two bars,
     photocopied — the same tune for a punk record and a plainchant), every
     chair sat in the register its blank model happened to start in, the
     desk was untouched, and every section was four bars long. A record that
     arrives generic is not a record, it is a starting position.

     FOUR TABLES, and every value in them is an ANSWER. `called()` seeds
     them the way it already seeds the groove and the kit — through the
     chairs' own `answer`, so each one lands on the answers ledger, shows on
     the gig sheet as a decision, and tapping it re-opens that question with
     the chosen word lit. A decision made for you is not a wall.

     THE LAW OF THE SEED, which is what keeps it from being one:
     A RECORD MAY MOVE WHAT THE LAST RECORD PUT THERE, AND NOTHING ELSE.
     `seeded()` below compares the standing answer with what the PREVIOUS
     record would have seeded; equal (or absent) means nobody has spoken for
     it and the new record may seat it, anything else is a hand and is left
     alone. It is the same half-of-the-law `called()` already keeps for the
     guitar ("an answered guitar is the player's, full stop") — said once,
     for four more tables.

     AND NOTHING ALREADY SAVED MOVES. All of this runs inside `called()`,
     which fires when a record is CALLED; a session restored from
     localStorage is a model whose fields are already set and whose genre is
     not answered again, so a stored record renders exactly as it did.

     THE PLAN IS PER FAMILY, OVERRIDDEN PER RECORD. A record with no row of
     its own inherits its family's, so a genre added tomorrow arrives
     finished too rather than throwing or falling back to generic — the
     opposite of the two-table law in compose.js, and deliberately, because
     these are decisions with a defensible default and PLAN_OF/BPM are
     facts with none. */

  /* ---------- 1. THE THEME IS AN IDIOM'S THEME ---------------------------
     A punk hook is not a bossa hook and not a chant. The theme machinery
     carries cell, contour, landing, length, register and sentence plan, and
     one blank model was answering all six for all thirty records — measured
     on the critic's corpus-derived bands, the single most expensive fault
     in the box is `rep.halfPhotocopy` (bars 5-8 of a section identical to
     bars 1-4, which real records essentially never do), and it is a two-bar
     theme tiled over an eight-bar section.

     Fourteen shapes, named the way a musician names them, each one six
     ordinary answers. They are not fourteen new mechanisms: every field
     here is a word ideas-kit already offers, so the tray, the staff and the
     count row all read a seeded theme exactly as they read a typed one. */
  const THEMES = {
    // short, said twice, and it does not travel — the garage/punk hook
    hook:   { len: "two",   cell: "call",   sent: "vary", contour: "insist",
              land: "root",    reg: "mid" },
    // the sung eight: a pickup into the bar, an arch, and home
    topline:{ len: "eight", cell: "pickup", sent: "vary", contour: "fall",
              land: "root",    reg: "mid" },
    // the floor's figure — four bars off the beat, hovering, opening out
    figure: { len: "four",  cell: "push",   sent: "vary", contour: "fall",
              land: "fifth",   reg: "mid" },
    // an insistent two-bar riff, down where a riff lives
    riff:   { len: "four",  cell: "riff",   sent: "vary", contour: "zig",
              land: "root",    reg: "low" },
    // a bop head: eight bars of gallop that leans on the seventh
    head:   { len: "eight", cell: "gallop", sent: "vary", contour: "fall",
              land: "seventh", reg: "mid" },
    // a sung line that falls and warms on the third (bossa, soul, reggae)
    sung:   { len: "eight", cell: "pickup", sent: "hold", contour: "fall",
              land: "third",   reg: "mid" },
    // the strophe: A A B B over eight bars, which is what a hymn, a canso
    // and a parlor ballad all are (`aabb` is the one plan that says a
    // measure twice on purpose)
    strophe:{ len: "eight", cell: "three",  sent: "aabb", contour: "rise",
              land: "root",    reg: "mid" },
    // plainchant: four bars of long notes hovering round one note
    chantline: { len: "eight", cell: "three", sent: "vary", contour: "fall",
              land: "root",    reg: "mid" },
    // an aria: one long note, then a run, arching, up where a voice sings
    aria:   { len: "eight", cell: "hang",   sent: "vary", contour: "fall",
              land: "root",    reg: "high" },
    // an anthem: walking up to the beat and rising, carried over the line
    anthem: { len: "eight", cell: "walkup", sent: "vary", contour: "rise",
              land: "root",    reg: "mid" },
    // a dance tune: running eighths that turn back on themselves
    reel:   { len: "eight", cell: "even",   sent: "vary", contour: "zig",
              land: "root",    reg: "mid" },
    // the lilt of a waltz or a barcarolle: a pickup, an arch, the third
    lilt:   { len: "eight", cell: "pickup", sent: "vary", contour: "fall",
              land: "third",   reg: "mid" },
    // a blues line: a long note, a run, dropping, hanging under the root
    blue:   { len: "four",  cell: "hang",   sent: "vary", contour: "fall",
              land: "lead",    reg: "mid" },
    // a processional: three notes and a rest, arching, eight bars of it
    march:  { len: "eight", cell: "three",  sent: "vary", contour: "rise",
              land: "root",    reg: "mid" },
  };
  // the words those keys are, for `Id.answer` — one place, so a renamed
  // option in ideas-kit fails the gate here rather than seeding silence
  const THEMEASK = { len: Id.LENGTHS, cell: Id.CELLS, sent: Id.SENTENCES,
                     contour: Id.CONTOURS, land: Id.LANDINGS, reg: Id.REG };

  /* ---------- 2. THE REGISTER IS CLAMPED TO THE MUSIC --------------------
     A chant's voices do not sit where a funk bass sits, and neither of them
     sits wherever a blank chair model happened to start. So a record seats
     its band — and then the seat is CLAMPED to the instrument that chair is
     actually holding.

     THE COMPASS IS THE ENGINE'S OWN. `instruments.js RANGES` is the
     parent's `state-engine.js INSTRUMENT_RANGE` — MIDI windows per
     instrument id, the same table the per-note fold reads — so nothing here
     is a number somebody chose. What IS measured is the chair's own span:
     forcing every register word on every record in the catalog (3 seeds x
     30 records x every word) and normalising the composed line back to reg
     0, the bass writes [38,60] at every one of its three words, an exact
     twelve-semitone shift, and the pitched chairs' spans are wider because
     a chair that takes the tune plays the tune. Those are the numbers in
     SPAN, and the probe that measured them is the one the gate re-runs.

     WHY THE CLAMP IS ON THE SEED AND NOT ON THE ANSWER. "Down low" on a
     P-bass writes MIDI 26 and the instrument's floor is 28 — a real fault,
     and the parent's whole-line fold moves it at the seam — but a clamp on
     the ANSWER would delete the word from the question (a question with one
     answer is dropped), would take `bassReg` out of the kernel's reachable
     set, and would move a saved record that had said it. So the clamp is on
     what the BOX seats: the record you are handed is in compass, and the
     word is still there to say.

     MEASURED, and this is what it bought: forcing every register word on
     every record in the catalog and reading the composed line back off the
     bar list, 19% of chair seatings sat outside the notes their instrument
     has (384 semitones outside in total, the worst single seat sixteen — an
     ahh_choir singing MIDI 32, a cello at 24, a guitar under its own low E).
     After: 7%, 74 semitones, worst seat six, and the bass chair's 28 bad
     seats down to 1. What is left is the GUITAR,
     and it is not a seat fault: the power-chord and chug jobs carry a
     register of their own (guitar-kit JOBS `reg: -1`), so that line reaches
     under the low E at every one of the chair's three words and no seat
     fixes it. Said here rather than hidden. */
  const SPAN = {
    // chair -> the composed line's [lo, hi] at its middle register, measured
    // over the whole catalog (4 seeds x 30 records x every register word,
    // normalised back to reg 0). It is a NOMINAL window, not a bound: a
    // pitched chair that takes the tune plays the tune's register, so these
    // are the widest thing that chair writes rather than a promise about one
    // record.
    bass:   [34, 64], keys: [44, 78], guitar: [39, 87], voice: [51, 91],
  };
  // the register words each chair has, with the octave each one means
  const REGWORD = {
    bass:   [["down low", -1], ["where it sits", 0], ["up the neck", 1]],
    keys:   [["down low", -1], ["where it sits", 0], ["up out of the way", 1],
             ["right at the top", 2]],
    guitar: [["down low", -1], ["where it sits", 0], ["up the neck", 1]],
    voice:  [["down low", -1], ["where it sits", 0], ["up high", 1]],
  };
  // how far outside the instrument's compass a register puts that chair —
  // zero is "the instrument has these notes"
  const overflow = (chair, v, win) => {
    const s = SPAN[chair]; if (!s || !win) return 0;
    return Math.max(0, win[0] - (s[0] + 12 * v)) +
           Math.max(0, (s[1] + 12 * v) - win[1]);
  };
  // the register word this record wants, moved to the nearest one the
  // instrument in that chair's hands can actually hold
  const fitReg = (chair, want, instr) => {
    const rows = REGWORD[chair] || [];
    const win = (Instr && Instr.RANGES) ? Instr.RANGES[instr] : null;
    if (!win) return want;                       // unlisted: the zone window is the law
    const at = rows.findIndex(([w]) => w === want);
    if (at < 0) return want;
    let best = at, bestOver = overflow(chair, rows[at][1], win);
    if (!bestOver) return want;
    for (let i = 0; i < rows.length; i++) {
      const o = overflow(chair, rows[i][1], win);
      if (o < bestOver || (o === bestOver && Math.abs(i - at) < Math.abs(best - at)))
        { best = i; bestOver = o; }
    }
    return rows[best][0];
  };

  /* ---------- 3. THE DESK ARRIVES SET ------------------------------------
     A chamber ballad is not a techno record, and both of them used to come
     out of the front door with the engineer's chair empty and the board
     flat. Every word here is one the fourth chair already says (ENG above),
     so a seeded desk is the same offsets a tapped one is — and the
     producer's own stack still ADDS on top of it (ui/band.js push: the
     engineer's `mixOf` and the producer's `produced().mix` are summed per
     channel, and addition commutes), which is why this is the record's mix
     and not a producer note. */
  const DESKS = {
    // the floor: a big kick in a room, bright hats, pumped
    club:   { room: "in the room", kick: "huge", snare: "dry, cracking",
              hats: "bright", verb: "a small room", delay: "none",
              squeeze: "pumping", tape: "none" },
    // a band in a small room: close, tight, glued, a little tape
    garage: { room: "right up close", kick: "tight", snare: "dry, cracking",
              hats: "as they are", verb: "a small room", delay: "none",
              squeeze: "a little glue", tape: "warm" },
    // sampled drums: deep low end, the hats down, a slap on the snare
    crate:  { room: "in the room", kick: "huge", snare: "fat",
              hats: "keep them down", verb: "a small room",
              delay: "a slap on the snare", squeeze: "a little glue",
              tape: "warm" },
    // a live date: the kit in the room and nobody squeezing anything
    date:   { room: "in the room", kick: "round", snare: "fat",
              hats: "as they are", verb: "a small room", delay: "none",
              squeeze: "leave it alone", tape: "none" },
    // the dub board: echo on everything, and the room is the instrument
    version:{ room: "down the hall", kick: "huge", snare: "a plate on it",
              hats: "as they are", verb: "a big hall",
              delay: "dub it — echo on everything", squeeze: "a little glue",
              tape: "warm" },
    // a big room with a long tail and nothing squeezed
    hall:   { room: "down the hall", kick: "round", snare: "a plate on it",
              hats: "keep them down", verb: "a big hall", delay: "none",
              squeeze: "leave it alone", tape: "none" },
    // one room, close and dry, nothing on anything
    parlour:{ room: "right up close", kick: "tight", snare: "dry, cracking",
              hats: "keep them down", verb: "a small room", delay: "none",
              squeeze: "leave it alone", tape: "none" },
  };
  /* A RECORD ARRIVES WITH A ROOM AND A BOARD; WHAT GOES ON EACH CHANNEL IS
     THE ENGINEER'S OWN. The eight ids above are the ones that describe how
     the RECORD sounds — the distance to the kit, the kick, the snare, the
     hats, the space, the echo, the squeeze and the tape. The five that name
     one channel (`keysfx` `gtrfx` `voxfx` `bassfx` `bassmix`) are left open,
     and not as an oversight: a chair with nothing left to ask is a dead
     chair, which is a law this box holds and `test/unit/question-trees.test.js`
     enforces ("nothing is ever asked"). Seeding all thirteen retired the
     fourth chair entirely. */
  const DESKBOARD = ["room", "kick", "snare", "hats", "verb", "delay",
                     "squeeze", "tape"];

  /* ---------- 4. A RECORD HAS PROPORTIONS, AND THEY ARE THE IDIOM'S ------
     "How long is the verse?" is a question the arranger has had since the
     proportions landed, and nothing answered it: unasked, a section is as
     long as its changes, which is four bars, so every called record came
     out a rectangle of fours. Measured against the length-matched corpus
     stratum, that is two of the box's four biggest systematic faults at
     once (`form.distinctLens` "every section is the same length" and
     `form.squareness`) and most of the third (`harm.rate`, since a
     four-bar section is the ceiling that forces a four-chord cycle to a
     chord a bar). The lengths here are LENS keys — the same words the
     question offers.

     WHAT IS DELIBERATELY NOT SEEDED HERE: the ARC ("where does it go?").
     It is the obvious next fact — measured, a third of the box's records
     have no climax at all — and seeding it (`build` on the song families,
     `rise` on the old world) was tried and measured WORSE on the same 298
     records: the median fell from the 60th percentile to the 54th, three
     records became unplayable, and `dyn.drumLift` went from 30% out of band
     to 46%, because the arc writes hush/back LEVELS onto sections and a
     hushed chorus is a chorus with fewer drums than its verse. The arc is a
     real word and it stays a question; what it needs is a shape that lifts
     without emptying, which is an arrangement problem and not a seed. */
  const PROPS = {
    pop:    { verse: "long",   chorus: "eight",  bridge: "eight" },
    tight:  { verse: "eight",  chorus: "eight",  bridge: "short" },
    twelve: { verse: "twelve", chorus: "twelve", bridge: "short" },
    strain: { verse: "long",   chorus: "eight",  bridge: "short" },
    strophe:{ verse: "eight",  chorus: "twelve", bridge: "eight" },
  };

  /* ---------- THE RECORD'S OWN PLAN --------------------------------------
     One row per family, overridden per record where the record is not its
     family — a punk hook is not a rock topline, a blues is a twelve-bar
     chorus, a chant is not a concerto. `hr` is present only where the idiom
     is emphatic about it, and only where the record's own `hrw` allows the
     word (a row that narrows the question cannot then be seeded past it). */
  const FAMPLAN = {
    "the floor":     { theme: "figure",  desk: "club",    props: "strain",
                       seat: { bass: "where it sits", keys: "up out of the way",
                               guitar: "where it sits", voice: "up high" },
                       hr: "one to a phrase" },
    // NO CHAIR IS SEATED "DOWN LOW", and the clamp is why rather than taste:
    // the bass writes [38,60] at its middle word, so an octave under it is
    // [26,48] and every bass in the room floors at 28 (the cello at 36) —
    // there is no bass instrument that HAS those notes. The guitar is the
    // same story one string up ([33,72] against a low E of 40, which is the
    // MIDI 38 a called record used to hand the guitarist). The word is still
    // on every one of those questions for a hand to say; a RECORD does not
    // seat a player under their own instrument.
    "breaks":        { theme: "riff",    desk: "crate",   props: "strain",
                       seat: { bass: "where it sits", keys: "where it sits",
                               guitar: "where it sits", voice: "where it sits" },
                       hr: "one to a phrase" },
    "rock":          { theme: "topline", desk: "garage",  props: "pop",
                       seat: { bass: "where it sits", keys: "up out of the way",
                               guitar: "where it sits", voice: "where it sits" } },
    "jazz":          { theme: "head",    desk: "date",    props: "tight",
                       seat: { bass: "where it sits", keys: "where it sits",
                               guitar: "where it sits", voice: "where it sits" } },
    "funk":          { theme: "riff",    desk: "club",    props: "strain",
                       seat: { bass: "where it sits", keys: "up out of the way",
                               guitar: "up the neck", voice: "where it sits" },
                       hr: "one to a phrase" },
    "latin":         { theme: "sung",    desk: "date",    props: "tight",
                       seat: { bass: "where it sits", keys: "up out of the way",
                               guitar: "up the neck", voice: "where it sits" } },
    "the old world": { theme: "march",   desk: "hall",    props: "strophe",
                       seat: { bass: "where it sits", keys: "where it sits",
                               guitar: "where it sits", voice: "where it sits" } },
    "the ballroom":  { theme: "lilt",    desk: "hall",    props: "pop",
                       seat: { bass: "where it sits", keys: "where it sits",
                               guitar: "where it sits", voice: "where it sits" } },
  };
  const RECPLAN = {
    // the floor
    // techno takes the floor's own figure; what makes it techno is the kit,
    // the 606 and one chord all night, not a different tune
    disco:   { theme: "topline", props: "pop", hr: null },
    // breaks
    jungle:  { theme: "figure" },
    // rock's family, which is five different records
    punk:    { theme: "hook",    props: "tight" },
    kraut:   { theme: "reel",    props: "strain" },
    blues:   { theme: "blue",    desk: "date",   props: "twelve" },
    slow:    { theme: "aria",    desk: "hall",   props: "strain" },
    pianobar:{ theme: "lilt",    desk: "parlour", props: "pop" },
    // jazz's family: a chamber ballad is a quartet in a studio, not a club
    chamber: { theme: "topline", desk: "parlour", props: "pop" },
    // latin
    reggae:  {                   desk: "version", props: "strain" },
    bossa:   { theme: "sung",    desk: "date" },
    // the old world, which is nine centuries and not one idiom
    chant:   { theme: "chantline", props: "strophe",
               seat: { bass: "where it sits", keys: "where it sits",
                       guitar: "where it sits", voice: "where it sits" } },
    organum: { theme: "chantline", props: "strophe" },
    trobar:  { theme: "strophe",   props: "tight" },
    estampie:{ theme: "reel",      props: "tight" },
    pavane:  { theme: "march",     props: "tight" },
    monody:  { theme: "aria",      props: "strophe" },
    concerto:{ theme: "reel",      props: "pop" },
    vienna:  { theme: "topline",   props: "pop" },
    nocturne:{ theme: "aria",      desk: "parlour", props: "pop" },
    romantic:{ theme: "anthem",    props: "pop" },
    salon:   { theme: "lilt",      desk: "parlour", props: "pop" },
    parlor:  { theme: "strophe",   desk: "parlour", props: "strophe" },
    hymn:    { theme: "strophe",   props: "strophe" },
  };
  const planOf = (key, gk) => ({ ...(FAMPLAN[gk && gk.fam] || FAMPLAN.rock),
                                 ...(RECPLAN[key] || {}) });

  /* ---------- WHERE THE RECORD GOES ---------------------------------------
     Measured on two takes: the second chorus was bigger than the first only
     because a different player happened to be handed the tune. "Each chorus
     is bigger than the last" — the shape of a whole record, and the oldest
     arrangement idea there is — was unsayable. It is a song fact, not a
     section one: the same chorus in two places is two different moments.  */
  const LEVELS4 = ["hush", "back", "norm", "fwd"];
  const ARC = {
    flat:  { w: "it stays where it is" },
    build: { w: "each chorus bigger than the last",
             at: (role, n, of) => (role === "chorus" || role === "drop"
               ? { lvl: LEVELS4[Math.min(3, 2 + n)], busier: n > 0 } : null) },
    rise:  { w: "it builds all the way through",
             at: (role, n, of, i, secs) => ({ lvl: LEVELS4[Math.min(3, 1 + Math.floor(i / Math.max(1, secs / 3)))] }) },
    drop:  { w: "it builds, then drops away at the end",
             at: (role, n, of, i, secs) => (i >= secs - 2
               ? { lvl: LEVELS4[Math.max(0, 2 - (i - (secs - 2)))] }
               : { lvl: LEVELS4[Math.min(3, 1 + Math.floor(i / Math.max(1, (secs - 2) / 3)))] }) },
  };

  /* ---------- WHAT KIND OF CHORDS ----------------------------------------
     The arranger has been calling ROOTS. `CHANGES` is a roots array, and the
     kernel's `prog` takes chord OBJECTS — quality, inversion, borrow, beats
     — which is the whole difference between a jazz date's harmony and a pop
     record's, and the reason the keys player, the first chair that plays
     harmony, could only ever voice triads.

     Quality is applied BY FUNCTION rather than flat, because that is what
     the words mean: "sevenths" on a major-key tune is Imaj7 / ii m7 / V7,
     not four dominant sevenths in a row. The kernel's own tables are the
     vocabulary (QSTEPS triad/7/nine/sus4/six, QFIX maj7/m7/dom7). */
  const CHORDKIND = {
    plain:  { w: "plain triads", q: null },
    // "where they belong": I and IV are the MAJOR sevenths of the key —
    // giving only I the special case handed IV a chromatic m7 (measured in
    // F: Bb-C#-F-Ab, a Bbm7 in the middle of a major tune) where Bbmaj7
    // (Bb-D-F-A) is what the words mean. vii would be m7b5, but the
    // kernel's QFIX carries maj7/m7/dom7 only, so it stays m7 — close
    // enough that nobody has called it, and honest here rather than silent.
    sevens: { w: "sevenths where they belong",
              q: (d) => (d === 0 || d === 3 ? "maj7" : d === 4 ? "dom7" : "m7") },
    all7:   { w: "sevenths on everything", q: () => "7" },
    nines:  { w: "ninths", q: () => "nine" },
    sus:    { w: "suspended", q: () => "sus4" },
    sixes:  { w: "sixths", q: () => "six" },
  };
  // the changes as chord OBJECTS, when a kind has been called
  const progOf = (roots, kind) => {
    const K2 = CHORDKIND[kind];
    if (!K2 || !K2.q) return undefined;
    return roots.map((d) => ({ d, q: K2.q(((d % 7) + 7) % 7) }));
  };

  /* ---------- "LEAN INTO THE NEXT ONE" — the secondary dominant ----------
     Not called that, because the word is what a leader says; the chord it
     writes is V7-of-what-follows. The kernel already plays every piece of
     this: root = mp(d)+borrow, QFIX.dom7 is the absolute stack ("the one
     deliberate exit"), the bass hears a seventh as a note the line may pass
     through, and the melody layer carries q/borrow through its pairing.
       d      = next.d + 4 (the degree a fifth above — the sequence's move)
       borrow = the semitone fix making the root exactly a fifth over next's
                root; in every church mode the diatonic fifth-above is 0 or
                ±1 off, so the clamp never bites a real mode.
     Verified against the benchmark: F major, next = Dm (d 5) → d 2, borrow
     0, dom7 = A–C♯–E–G — the A7 whose C♯ is in the rip. */
  const dp7 = (d, md) => md[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  const IONIAN = [0, 2, 4, 5, 7, 9, 11];
  const dominantOf = (next, md0) => {
    const md = Array.isArray(md0) && md0.length === 7 ? md0 : IONIAN;
    const d = (((next.d || 0) + 4) % 7 + 7) % 7;
    const wantPc = (((dp7(next.d || 0, md) + (next.borrow || 0) + 7) % 12) + 12) % 12;
    const havePc = ((dp7(d, md) % 12) + 12) % 12;
    let borrow = wantPc - havePc;
    if (borrow > 6) borrow -= 12; if (borrow < -6) borrow += 12;
    borrow = Math.max(-1, Math.min(1, borrow));
    return { d, q: "dom7", ...(borrow ? { borrow } : {}),
             ...(next.beats ? { beats: next.beats } : {}) };
  };

  /* ---------- CHANGES OF THE BAND'S OWN ----------------------------------
     `m.song.chgx = { [role]: [bar, …] }` — each bar one or two chord
     objects ({ d 0..6, q?, borrow? -1..1, beats? 8 } — two chords split the
     bar in halves, which is the Em7|A7 bar), 2..16 bars. Present-only:
     absent, every path below resolves the catalog row exactly as today.
     PARANOIA AT THE ACCESSOR, because the model rides the session whole:
     a malformed bar is dropped, and a list left shorter than two bars is
     no list at all. */
  const QWORDS = ["maj7", "m7", "dom7", "7", "nine", "sus4", "six", "triad"];
  const chgxOf = (m, role) => {
    const raw = (m.song.chgx || {})[role];
    if (!Array.isArray(raw)) return null;
    const bars = [];
    for (const bar of raw.slice(0, 16)) {
      const list = (Array.isArray(bar) ? bar : [bar]).slice(0, 2)
        .filter((c) => c && Number.isInteger(c.d) && c.d >= 0 && c.d <= 6)
        .map((c) => ({ d: c.d,
          ...(QWORDS.includes(c.q) ? { q: c.q } : {}),
          ...(c.borrow === 1 || c.borrow === -1 ? { borrow: c.borrow } : {}),
          ...(c.beats === 8 ? { beats: 8 } : {}) }));
      if (list.length) bars.push(list);
    }
    return bars.length >= 2 ? bars : null;
  };
  // ONE RESOLVER, ONE OWNER: what changes does this role play? The hand's
  // own list first (its LENGTH is the section's length — the precedence
  // law), the catalog row second — with "does anything lean?" materializing
  // the one dom7 bar over the cycle. A bar the hand left plain (`q` absent)
  // takes the record's chord kind, so "sevenths" still colors the bars
  // nobody spelled.
  const modeArrOf = (m) => (MODESREF ? MODESREF[modeKeyOf(m.song)] : null) || IONIAN;

  /* ---------- HOW FAST DO THE CHORDS MOVE ---------------------------------
     A CHART IS NOT A BAR COUNTER. `B.CHANGES` gives a cycle one root per bar
     and the kernel reads `at(roots, bar)`, so "the doo-wop changes" meant a
     new chord at every single barline for the length of the record. Nobody
     plays them that way and, measured, almost nobody records them that way.

     THE CORPUS (4,449 bulk records with four or more chord runs, measured
     through the same estimator the critic bands with):
       * a chord lasts ONE bar 60.2% of the time, two 21.4%, three 8.0%,
         four 4.0%, longer 6.3%;
       * only 1.7% of real records hold every chord for the same number of
         bars — a harmonic rhythm is a shape, not a setting;
       * changes land at p10 0.197 / MEDIAN 0.504 / p90 0.770 of barlines,
         and only 1.3% of real records change at 95% of them or more.
     Against that, 30.8% of this box's records changed chord at EVERY
     barline, and the nine idioms that scored worst against real records
     (parlor, punk, chamber, pavane, disco, trobar, house, romantic,
     nocturne) are exactly the nine whose changes are `fourchord`,
     `fifties`, `descending` or `passamezzo` — the four cycles that move on
     every bar. The idioms that scored BEST (kraut, hiphop, jungle, funk,
     techno, jazz, reggae) are the ones that vamp. It is the cycle, not the
     idiom and not the tempo.

     So a cycle whose roots move at every barline is laid out as a PHRASE —
     each chord held for as many bars as the record takes them at. Three
     words, because a bandleader says all three ("two bars each"), and the
     record narrows which two are on the table (`hrw`) the way it narrows
     everything else: a punk record may take them a bar at a time; a pavane
     may not. TWO THINGS ARE LEFT ALONE ON PURPOSE — a cycle that already
     repeats a root (the vamps, two-five-one, the twelve-bar) has a harmonic
     rhythm of its own and is not given another, and a role whose changes the
     HAND authored is never re-timed, because the hand moves last. */
  const HRATE = {
    bar:    { w: "a chord a bar",   hold: 1 },
    two:    { w: "two bars each",   hold: 2 },
    phrase: { w: "one to a phrase", hold: 4 },
  };
  // "two bars each" is the unanswered default: it is the corpus's own median
  // (a cycle laid out at two bars a chord changes at 0.500 of its barlines,
  // against a real median of 0.504) and the one that costs a cycle nothing —
  // every chord the arranger called is still heard, in order.
  const HRDEF = "two";
  const hrOf = (m) => HRATE[(m.song || {}).hr] || HRATE[HRDEF];
  // does this cycle move at every barline? (the wrap is not counted — the
  // passamezzo returns to its own tonic, and that is a cadence, not a hold)
  const movesEveryBar = (roots) => roots.length >= 2 &&
    roots.every((d, i) => i === 0 || d !== roots[i - 1]);
  /* the cycle as a phrase. THE SECTION'S OWN LENGTH IS THE CEILING: a role
     the arranger gave four bars gets four bars, so a four-chord cycle in it
     is a chord a bar and stays one — an arranger who asked for a short
     section did not ask to hear half the changes. Unanswered, the phrase
     IS the length (`g.bars` follows `c.bars`), which is how a record that
     says nothing comes out with eight-bar sections instead of four. */
  const phraseOf = (m, role, c) => {
    const want = hrOf(m).hold;
    if (want <= 1 || !movesEveryBar(c.roots)) return { bars: c.bars, roots: c.roots };
    const len = lenOf(m, role);
    // TWO CHORDS IS THE FLOOR, and it is the only thing the section's own
    // length is allowed to say here. A four-bar verse at two bars a chord
    // hears the first two changes of the cycle and not all four — which is
    // what "two bars each" MEANS, and a four-bar section holding two chords
    // is the commonest four bars in music. What it may never become is ONE
    // chord: a section with a single chord in it is a vamp and nobody
    // called one. (The first cut of this capped the hold so the whole cycle
    // always fit, and measured, that made the word do nothing at all on
    // every role anybody had given four bars — the largest single group of
    // records still changing chord at every barline.)
    const cap = len ? Math.max(1, Math.floor(len / 2)) : want;
    const hold = Math.max(1, Math.min(want, cap));
    if (hold <= 1) return { bars: c.bars, roots: c.roots };
    const roots = [];
    for (const d of c.roots) for (let k = 0; k < hold; k++) roots.push(d);
    return { bars: roots.length, roots };
  };

  function changesOf(m, role) {
    const list = chgxOf(m, role);
    if (list) {
      const K2 = CHORDKIND[m.song.chords];
      const prog = list.map((bar) => bar.map((c) => (c.q || !K2 || !K2.q ? { ...c }
        : { ...c, q: K2.q(((c.d % 7) + 7) % 7) })));
      return { bars: list.length, roots: list.map((b) => b[0].d), prog,
               authored: true, word: "changes of our own" };
    }
    const c = phraseOf(m, role, B.CHANGES[(m.song.chg || {})[role] || "fourchord"]);
    const lw = (m.song.lean || {})[role];
    if (lw === "last" || lw === "mid") {
      // a lean FORCES prog materialization even under plain triads — the
      // honest cost: roots become triad objects plus the one dom7 bar.
      // Everything else about the cycle is byte-identical.
      const K2 = CHORDKIND[m.song.chords];
      const prog = c.roots.map((d) => (K2 && K2.q
        ? { d, q: K2.q(((d % 7) + 7) % 7) } : { d }));
      const at = lw === "last" ? c.bars - 1 : Math.floor(c.bars / 2) - 1;
      if (at >= 0 && at < prog.length)
        prog[at] = dominantOf(prog[(at + 1) % prog.length], modeArrOf(m));
      return { bars: c.bars, roots: c.roots, prog, leaned: true };
    }
    return { bars: c.bars, roots: c.roots, prog: progOf(c.roots, m.song.chords) };
  }
  /* the API the picker (and the dice) writes through — validated exactly
     like setSection: clamps, drops malformed bars, returns m unchanged on
     an empty or one-bar list. Writing a role's own changes RETIRES its
     length question (a question whose answers cannot change the record is
     not asked — the house pruning law, not a silent override) and clears
     its lean (a lean on changes that left is a mark on silence). */
  function setChanges(m, role, list) {
    if (!CALLED.includes(role)) return m;
    const probe = { song: { chgx: { [role]: list }, chords: m.song.chords } };
    const clean = chgxOf(probe, role);
    if (!clean) return m;
    const answers = { ...(m.song.answers || {}) };
    delete answers["len:" + role];
    answers["chg:" + role] = "changes of our own";
    const lens = { ...(m.song.lens || {}) }; delete lens[role];
    const lean = { ...(m.song.lean || {}) }; delete lean[role];
    return { ...m, song: { ...m.song, answers, lens, lean,
                           chgx: { ...(m.song.chgx || {}), [role]: clean } } };
  }

  /* ---------- WHERE A RECORD COMES FROM -----------------------------------
     Nobody starts a session by picking a genre off a list of fifteen. They
     know when it is, where they are and what room they are playing — and a
     genre is what those three things ADD UP TO. Chicago in the eighties in a
     warehouse is one record; Chicago in the fifties in a bar is a different
     one, and nobody had to name either.

     Every record carries `when`/`where`/`room` and the three questions
     narrow: an option is only offered if some record still standing has it,
     which means there are no dead ends by construction — you cannot answer
     your way to nothing. When one record is left it is CALLED, without being
     asked. */
  // "when is it?" not "what decade is it?" — the axis starts in Rome now,
  // and "the twelve-hundreds" is not a decade. One question either way: the
  // GRANULARITY of the answers mirrors the density of the catalog (centuries
  // where records differ by century, decades where they differ by decade),
  // which is what the narrowing machine already does everywhere else.
  const FIELDS3 = [["when", "when is it?"], ["where", "where are you?"],
                   ["venue", "where do you play?"]];
  const fits = (gk, s2) => FIELDS3.every(([f]) =>
    !s2[f] || (gk[f] || []).includes(s2[f]));
  const survivors = (s2) => Object.entries(GENRES).filter(([, gk]) => fits(gk, s2));
  // the values still worth offering for one field, given the others
  // ...and a decade is asked in the order decades happen, which no table
  // order can be relied on to give
  // ...prepended 2026-08-21 with the CENTURIES (PLAN.md phase 3: "century
  // first, then decade where it matters") — the old-world records answer in
  // centuries because "the twelve-thirties" is not how anyone remembers
  // Notre Dame. GROW-ONLY: every existing decade word keeps its place, so
  // every existing tap still lands.
  const DECADES = ["the six-hundreds", "the twelve-hundreds", "the thirteen-hundreds",
                   "the fifteen-hundreds", "the sixteen-hundreds",
                   "the seventeen-hundreds", "the eighteen-hundreds",
                   "the fifties", "the sixties", "the seventies", "the eighties",
                   "the nineties", "the two-thousands", "now"];
  const openOf = (s2, field) => {
    const out = [];
    for (const [, gk] of survivors({ ...s2, [field]: null }))
      for (const v of gk[field] || []) if (!out.includes(v)) out.push(v);
    return field === "when"
      ? DECADES.filter((d) => out.includes(d)) : out;
  };

  /* ---------- HOW MUCH SPACE: the slowest thing a band can do -------------
     Tempo is not the only way to be slow, and below about 60 bpm it stops
     being the useful one — what makes a record feel enormous is a bar with
     one hit in it and three bars of nothing after. That is not a tempo, it
     is a SCHEDULE: the drums read `kits` per bar and the bass now reads
     `bassBars` the same way (kernel.js), so "one hit every four measures"
     is four entries where three of them are empty, and the bass note
     HOLDS across the gap rather than stopping. */
  const one16 = (n) => { const v = zn(n); v[0] = 1; return v; };
  const SPACE = {
    none: { w: "keep it going" },
    half: { w: "one bar on, one off", bars: [1, 0, 1, 0] },
    bar:  { w: "one hit a bar", bars: [1, 1, 1, 1], one: true },
    four: { w: "one hit every four bars", bars: [1, 0, 0, 0], one: true },
  };
  const spaceOut = (g, sp) => {
    if (!sp || !sp.bars) return g;
    const n = (g.meter && g.meter.steps) || 16;
    const kits = (g.kits && g.kits.length ? g.kits : [g.kit || {}]);
    const out = sp.bars.map((keep, b) => !keep ? {}
      : sp.one ? { k: one16(n) } : (kits[b % kits.length] || {}));
    return { ...g, kits: out, kit: out[0],
             bassBars: sp.bars.map((keep) => (keep ? one16(n) : 0)) };
  };

  /* ---------- THE FORM: what the arranger calls out ----------------------
     WHO DECIDES THE CHANGES? Not the bassist — a bass player REALIZES the
     root motion, they do not choose it. In a band the changes belong to
     whoever wrote the tune (the harmony instrument: guitar, piano, the
     leader), and in jazz the chart decides while the leader calls it. So
     the changes live with the arranger here, and they are called out
     SECTION BY SECTION, which is what "calling a tune" actually is.  */
  // A HOUSE RECORD HAS NO BRIDGE. Song forms and dance forms are different
  // shapes with different words — a twelve-inch goes intro/build/drop/
  // breakdown/drop and a jazz date plays the head, some solos and the head
  // again — so the forms are named the way each music names them, and the
  // arranger is only offered the ones this record has (see GENRES.forms).
  const FORMS = {
    vamp:     { w: "one vamp, round and round", secs: ["verse"] },
    blues:    { w: "a blues, three choruses", secs: ["verse", "verse", "verse"] },
    versechorus: { w: "verse, chorus", secs: ["verse", "chorus"] },
    pop:      { w: "verse, chorus, verse, chorus", secs: ["verse", "chorus", "verse", "chorus"] },
    aaba:     { w: "AABA", secs: ["verse", "verse", "bridge", "verse"] },
    full:     { w: "intro, verse, chorus, bridge, chorus, outro",
                secs: ["intro", "verse", "chorus", "bridge", "chorus", "outro"] },
    dance:    { w: "build, drop, break, drop",
                secs: ["build", "drop", "break", "drop"] },
    twelve:   { w: "a twelve-inch: intro, build, drop, break, drop, outro",
                secs: ["intro", "build", "drop", "break", "drop", "outro"] },
    dj:       { w: "a DJ tool: long intro, main, long outro",
                secs: ["intro", "drop", "outro"] },
    head:     { w: "head, solos, head", secs: ["head", "solo", "solo", "head"] },
    dub:      { w: "a version", secs: ["verse", "break", "verse"] },
    // ...the two shapes most of pre-1900 music actually takes (2026-08-21):
    // strophic song — the same verse, again and again, which is a hymn, a
    // canso and a parlor ballad alike — and da capo ABA, which is everything
    // from the pavane's ouvert/clos pairing to the nocturne's middle section.
    strophic: { w: "verses, one after another", secs: ["verse", "verse", "verse"] },
    dacapo:   { w: "A, then B, then A again", secs: ["verse", "bridge", "verse"] },
  };
  // a role that is not one of the three the changes are called for still has
  // to know WHICH changes it takes — a drop is the chorus of a twelve-inch
  // (...and a TAG plays the tune's own changes out the door)
  const CHGROLE = { intro: "verse", outro: "verse", build: "verse", drop: "chorus",
                    break: "verse", head: "verse", solo: "chorus", tag: "verse" };
  /* ---------- REPRISE AND DOORS (PLAN.md THE THROUGH-COMPOSED THEME) ------
     Not new FORMS rows per combination (± intro ± tag ± reprise would cube
     the table) and not a repeat grammar: two small arranger questions that
     WRAP the chosen form, both defaulting to nothing. `secsOf` is the one
     mechanism — every .secs read goes through it, and with both fields
     absent it returns the form's own array untouched (the same reference),
     so every saved record and every dice roll from before is byte-identical.
       reprise "bridge": secs + everything from the bridge on — AABA becomes
       V V B V B V, and it composes with any bridged form.
       doors: an intro prepended, a tag appended, or both, around the
       (reprised) secs. */
  /* ---------- THE BOXES ARE REAL (2026-08-22) -----------------------------
     Paul, verbatim: "'add a box' doesn't really add a box. i can't move
     boxes around. it gives me very very few options for song structure I
     want many more."

     He was right about the model, not just the button: the record's shape
     was a CLOSED SET of named shapes and nothing could append to it, so
     "add a box" honestly had nothing to do but re-open "what's the form?".
     A form is a STARTING SHAPE, not a jail — every band that has ever
     played an AABA has then decided to take the bridge twice — so the
     boxes get a list of their own.

     `m.song.secs` — the record's sections, in order, as role words. ABSENT
     is the whole of the old behaviour: the form, wrapped by the reprise
     and the doors, the same array reference it always returned, so every
     saved record and every dice roll from before is byte-identical.
     PRESENT it is the truth and the form label is only how the shape
     STARTED — which is why `shapeOf` reads the boxes rather than the label
     and the form fact stops claiming "AABA" the moment you edit one.

     Paranoia at the ACCESSOR, the chgxOf law: the model rides the session
     whole (localStorage), so a list carrying a role this build cannot play
     is no list at all and the form answers for it. `cleanSecs` returns the
     SAME array when it is clean — secsOf is on the hot path (partOf →
     defaultsFor → secsOf, per section, per draw) and must not allocate. */
  const SECROLES = {
    intro: "an intro", verse: "a verse", chorus: "a chorus", bridge: "a bridge",
    build: "a build", drop: "a drop", break: "a breakdown", head: "a head",
    solo: "a solo", tag: "a tag", outro: "an outro",
  };
  /* the ceiling. It used to be sixteen, with the note "longer than any
     record this box has ever made and half the [page's] sweep" — and then
     somebody asked for hours-long solo handoffs and sixteen boxes became the
     first wall: MEASURED, the longest record reachable was 16 sections of at
     most 16 bars, and with a twelve-bar solo the actual maximum was 188 bars
     — 6.3 minutes at 120 in four. The page's sweep was the only real
     constraint and it now reads THIS NUMBER (ui/band.js push) rather than
     carrying its own copy, so the ceiling is one fact in one place.

     TWENTY-FOUR, with the lengths widened beside it (LENS below, and a solo
     that can be asked how long it is): 24 × 32 = 768 bars, 25 minutes at 120
     in four and three quarters of an hour at a ballad tempo. What it is NOT
     is hours — that needs sections MADE WHILE IT PLAYS, which is an
     architectural piece above secsOf and is not in this round. */
  const MAXSECS = 24;
  const cleanSecs = (own) => (Array.isArray(own) && own.length >= 1 &&
    own.length <= MAXSECS && own.every((r) => SECROLES[r])) ? own : null;
  const secsOf = (m) => {
    const own = cleanSecs(m.song.secs);
    if (own) return own;
    let secs = FORMS[m.song.form || "vamp"].secs;
    if (m.song.reprise === "bridge" && secs.includes("bridge"))
      secs = [...secs, ...secs.slice(secs.indexOf("bridge"))];
    const d = m.song.doors;
    if (d === "intro" || d === "both") secs = ["intro", ...secs];
    if (d === "tag" || d === "both") secs = [...secs, "tag"];
    return secs;
  };
  // has anybody edited the boxes? (the form label is then a starting point,
  // not the shape)
  const boxesEdited = (m) => !!cleanSecs(m.song.secs);
  // WHAT SHAPE IS THIS RECORD, read off the boxes rather than the label —
  // the honest answer to "what's the form?" once the boxes have diverged
  // from the row that seeded them
  const shapeOf = (m) => secsOf(m).join(", ");
  /* EVERY BOX EDIT IS THE SAME TWO MOVES: the list, and the per-section
     arrangement that rides its INDEXES. `m.per` is keyed by position, so a
     box that moves takes what was said about it with it — otherwise the
     chorus's "open the reverb" would stay behind on whatever landed in its
     slot. Materializing is implicit: the first edit reads the shape the
     form was making and writes it down. */
  const shiftPer = (per, at) => {
    const out = {};
    for (const k of Object.keys(per || {})) {
      const j = at(+k);
      if (j != null && j >= 0) out[j] = per[k];
    }
    return out;
  };
  function addSection(m, at, role) {
    if (!SECROLES[role]) return m;
    const cur = secsOf(m);
    if (cur.length >= MAXSECS) return m;
    const p = Number.isInteger(at) && at >= 0 && at <= cur.length ? at : cur.length;
    return { ...m, per: shiftPer(m.per, (j) => (j >= p ? j + 1 : j)),
             song: { ...m.song, secs: [...cur.slice(0, p), role, ...cur.slice(p)] } };
  }
  function moveSection(m, i, dir) {
    const cur = secsOf(m), j = i + (dir < 0 ? -1 : 1);
    if (!(i >= 0 && i < cur.length && j >= 0 && j < cur.length)) return m;
    const secs = cur.slice();
    secs[i] = cur[j]; secs[j] = cur[i];
    return { ...m, per: shiftPer(m.per, (k) => (k === i ? j : k === j ? i : k)),
             song: { ...m.song, secs } };
  }
  // ...and a record cannot be emptied: a song with no sections is not a
  // shorter song, it is a page that stops compiling
  function removeSection(m, i) {
    const cur = secsOf(m);
    if (cur.length <= 1 || !(i >= 0 && i < cur.length)) return m;
    return { ...m, per: shiftPer(m.per, (k) => (k === i ? null : k > i ? k - 1 : k)),
             song: { ...m.song, secs: cur.filter((_, j) => j !== i) } };
  }
  // ...and the way BACK: a FORMS row is a starting point you can always
  // return to, which is what answering "what's the form?" now means
  const reseed = (song) => { const s = { ...song }; delete s.secs; return s; };
  /* ---------- HOW LONG IS IT ----------------------------------------------
     A section was as long as the changes it was called with, and nothing
     could say otherwise: the only lengths reachable anywhere in the graph
     were 4 and 12 (twelve only via a blues). Every record came out a
     rectangle — six four-bar sections, forty-eight seconds — and proportion
     is most of what form IS. So the LENGTH is its own question, per role,
     and the changes simply repeat inside it (the kernel reads `at(roots,
     bar)`, so a four-chord cycle under an eight-bar chorus goes round
     twice). */
  const LENS = { short: { w: "four bars", v: 4 }, eight: { w: "eight bars", v: 8 },
                 // TWELVE, because a record is not a stack of powers of two.
                 // Size-matched corpus (bulk rows with the box's own 2..7
                 // sections, n=513): only 40% of real sections are 2/4/8/16
                 // at the median and 83% at p90 — the box was running 83%
                 // AS ITS MEDIAN. Twelve is the length the vernacular
                 // already owns (the blues chorus, the hymn strophe, the
                 // sixteen-bar tune with a four-bar tag), it is the one
                 // non-square length every theme this box can write still
                 // tiles into whole (1, 2 and 4 bars all divide it), and it
                 // is APPENDED so nothing that answered "four bars" moves.
                 twelve: { w: "twelve bars", v: 12 },
                 long: { w: "sixteen bars", v: 16 },
                 // ...AND TWO LONGER ONES, APPENDED (2026-08-23), so nothing
                 // that ever answered "four bars" moves. Sixteen was the
                 // ceiling on every section in the box, which is why the
                 // longest record it could make was 6.3 minutes: a solo that
                 // takes two choruses of a sixteen-bar tune is thirty-two
                 // bars, and that is not an exotic length, it is what a solo
                 // IS on most of the records this box is imitating.
                 double: { w: "twenty-four bars", v: 24 },
                 huge:   { w: "thirty-two bars", v: 32 } };
  const lenOf = (m, role) => {
    // ...by its OWN role, not the one whose CHANGES it borrows: an intro
    // takes the verse's chords and is not eight bars long because the verse
    // is. Unasked roles keep the length of their changes, which is four.
    const said = (m.song.lens || {})[role];
    return said ? (LENS[said] || {}).v || null : null;
  };

  // the roles that need their own changes called (an intro and an outro take
  // the verse's, the way a band would)
  const CALLED = ["verse", "chorus", "bridge"];
  const rolesIn = (m) => {
    const want = new Set(secsOf(m).map((r) => CHGROLE[r] || r));
    return CALLED.filter((r) => want.has(r));
  };
  // THE RECORD HAS A SHAPE ONCE ANYBODY HAS DECIDED ONE — a called form, or
  // boxes of its own. Until then it is one vamp and the per-role calls
  // ("what are the chorus changes?", "how long is the verse?") name roles
  // no box carries, which is why they wait.
  const hasShape = (m) => !!(m.song.form || cleanSecs(m.song.secs));

  /* ---------- THE COLOUR OF THE KEY --------------------------------------
     "major or minor?" stays the first ask, exactly as it always was — and
     behind it a colour question names WHICH minor (natural · dorian ·
     harmonic · melodic minor) or WHICH major (major · mixolydian · lydian).
     THE UNANSWERED DEFAULTS DO NOT MOVE: plain "minor" has meant dorian on
     this page since the page existed, and every saved session
     (nu.band.session replays the whole model) and every gate spine answered
     "minor" into that sound — so dorian stays the silent default even
     though aeolian is the commoner pop minor, and the colour question is
     where "natural" becomes sayable out loud. Each row is
     [key, the word said, the MODES key it plays]. */
  // ...and PHRYGIAN, which the alphabet has carried since the day it was
  // written and no word could reach (2026-08-23, the open-the-racks round).
  // genres.js MODES holds eight scales; this table offered seven of them, so
  // [0,1,3,5,7,8,10] — the flat second, the one minor colour a listener can
  // name blindfolded — was a mode the engine plays, the catalog casts, and
  // the band page could not say. It is a MINOR, and it goes last in that
  // family on purpose: the row's order is what a session calls in, and
  // nobody reaches for phrygian before they have reached for natural.
  const COLORS = {
    minor: [["natural", "natural", "aeolian"],
            ["dorian", "dorian", "dorian"],
            ["harmonic", "harmonic", "harmonic"],
            ["melodic", "melodic minor", "melodic"],
            ["phrygian", "phrygian", "phrygian"]],
    major: [["major", "major", "ionian"],
            ["mixo", "mixolydian", "mixo"],
            ["lydian", "lydian", "lydian"]],
  };
  const colorOf = (s) => {
    const list = COLORS[s.minor ? "minor" : "major"];
    return list.some(([k]) => k === s.mcolor) ? s.mcolor
      : (s.minor ? "dorian" : "major");   // a colour from the other family is no colour
  };
  // song -> the MODES key toGenre (and the staff, and the audition) plays
  const modeKeyOf = (s) => COLORS[s.minor ? "minor" : "major"]
    .find(([k]) => k === colorOf(s))[2];
  const colorRow = (m) => ({ id: "mcolor", seat: "arranger",
    ask: m.song.minor ? "what kind of minor?" : "what kind of major?",
    opts: COLORS[m.song.minor ? "minor" : "major"].map(([k, w]) => ({
      w, is: (s2) => colorOf(s2) === k,
      apply: (s2) => ({ ...s2, mcolor: k }) })) });

  /* ---------- WHAT THE ARRANGER DECIDES ---------- */
  const ARR = [
    // ...and before the genre, the three things a genre is MADE of. Each
    // one's options are the ones still standing, so every answer leaves at
    // least one record — and when one is left it is called without being
    // asked.
    ...FIELDS3.map(([f, ask]) => ({ id: f, ask, opts: null, three: true })),
    // ...and before the genre, the three things a genre is MADE of. Each
    // one's options are the ones still standing, so every answer leaves at
    // least one record and the last one is called for you.
    // THE GENRE COMES FIRST because everything else is narrowed by it — and
    // because it is the question a band actually asks first ("what are we
    // playing?"). It sets what the players may choose from, the tempo and
    // the feel the record usually takes, and in one case ("something slow
    // and open") how much space there is; none of those are locked, they
    // are just what the room assumes until somebody says otherwise.
    // ...and HOW IT COUNTS, on the same footing as the feel: a waltz record
    // counts in three because that is what the word means, and "how does it
    // count?" outranks it the moment anybody answers it. A record that says
    // nothing writes null, which is the sixteen-step bar it always had.
    { id: "genre", ask: "what are we playing?", opts:
      Object.entries(GENRES).map(([k, gk]) => ({
        w: gk.w, is: (s) => s.genre === k,
        // ...and "answered" here means BY A HAND. Every one of these five
        // is now answered on a called record — the record names the tempo,
        // the chords, the count, the feel and the space it arrives with —
        // so reading the ledger alone would have frozen the first record's
        // words onto every record after it (measured: a rock record called
        // after a waltz went on counting in three). `songHand` asks the
        // provenance ledger the question this line always meant to ask.
        apply: (s) => ({ ...s, genre: k,
          bpm: gk.bpm != null && !songHand(s, "tempo") ? gk.bpm : s.bpm,
        chords: !songHand(s, "chords") ? (gk.chords || "plain") : s.chords,
          meter: !songHand(s, "meter") ? (gk.meter || null) : s.meter,
          swing: !songHand(s, "feel") ? (gk.swing || null) : s.swing,
          space: !songHand(s, "space") ? (gk.space || "none") : s.space }) })) },
    { id: "arc", ask: "where does it go?", opts:
      Object.entries(ARC).map(([k, v]) => ({
        w: v.w, is: (s2) => (s2.arc || "flat") === k,
        apply: (s2) => ({ ...s2, arc: k }) })) },
    { id: "chords", ask: "what kind of chords?", opts:
      Object.entries(CHORDKIND).map(([k, v]) => ({
        w: v.w, is: (s2) => (s2.chords || "plain") === k,
        apply: (s2) => ({ ...s2, chords: k }) })) },
    // ...and how fast they move, which is the other half of the same
    // sentence and the one nobody could say (HRATE above). The record
    // narrows it to the two words that record would use, so a punk record
    // may take the four-chord one a bar at a time and a pavane may not.
    { id: "hr", ask: "how fast do the chords move?", opts:
      Object.entries(HRATE).map(([k, v]) => ({
        w: v.w, is: (s2) => (s2.hr || HRDEF) === k,
        apply: (s2) => ({ ...s2, hr: k }) })) },
    { id: "key", ask: "what key are we in?", opts: Object.keys(B.KEYS).map((k) => ({
        w: "in " + k, is: (s) => s.key === k, apply: (s) => ({ ...s, key: k }) })) },
    { id: "mode", ask: "major or minor?", opts: [
      { w: "major", is: (s) => !s.minor, apply: (s) => ({ ...s, minor: false }) },
      { w: "minor", is: (s) => s.minor, apply: (s) => ({ ...s, minor: true }) } ] },
    // ...and THE COLOUR behind it, the way a musician actually says it:
    // "minor" is a family, not one scale, and the follow-up names which one
    // (built per model in arrDecisionsNow/answer — the words depend on which
    // half of "major or minor?" the room is in)
    { id: "mcolor", color: true },
    // A FORM IS A STARTING SHAPE. Once the boxes have been edited none of
    // these rows is what the record IS any more (`shapeOf` says that out
    // loud), so none of them reads as current — and tapping one is the way
    // back: it RESEEDS the boxes from that shape.
    { id: "form", ask: "what's the form?", opts:
      Object.entries(FORMS).map(([k, f]) => ({
        w: f.w, is: (s) => !cleanSecs(s.secs) && s.form === k,
        apply: (s) => ({ ...reseed(s), form: k }) })) },
    // THE FORM, WRAPPED (PLAN.md THE THROUGH-COMPOSED THEME §form): a
    // reprise and the doors. Both default to writing nothing — an
    // unanswered record is byte-identical, and the pruner retires "again
    // from the bridge" on a form with no bridge (secsOf is a no-op there).
    // Both WRAP the form, so both reseed the boxes for the same reason the
    // form row does: a wrap you cannot see is not a wrap.
    { id: "reprise", ask: "once through, or round again?", opts: [
      { w: "once through", is: (s2) => !cleanSecs(s2.secs) && !s2.reprise,
        apply: (s2) => ({ ...reseed(s2), reprise: null }) },
      { w: "again from the bridge",
        is: (s2) => !cleanSecs(s2.secs) && s2.reprise === "bridge",
        apply: (s2) => ({ ...reseed(s2), reprise: "bridge" }) } ] },
    { id: "doors", ask: "how does it open and close?", opts: [
      { w: "straight in", is: (s2) => !cleanSecs(s2.secs) && !s2.doors,
        apply: (s2) => ({ ...reseed(s2), doors: null }) },
      { w: "an intro", is: (s2) => !cleanSecs(s2.secs) && s2.doors === "intro",
        apply: (s2) => ({ ...reseed(s2), doors: "intro" }) },
      { w: "a tag on the end", is: (s2) => !cleanSecs(s2.secs) && s2.doors === "tag",
        apply: (s2) => ({ ...reseed(s2), doors: "tag" }) },
      { w: "an intro and a tag", is: (s2) => !cleanSecs(s2.secs) && s2.doors === "both",
        apply: (s2) => ({ ...reseed(s2), doors: "both" }) } ] },
    // A SECOND THEME (PLAN.md THE THEME COMPOSER §1): named and few — A and
    // B, the tune and the answer. The question lands on the song's ledger
    // like any other; the theme itself is a MODEL fact (m.ideaB), made in
    // answer() the way the melody's own answers land on the idea — because
    // a theme is not a song field, it is a claim the room keeps. Unanswered
    // (or answered "one theme is plenty") there is no B and every phrase,
    // section and staff is byte-identical to the one-theme box.
    { id: "second", ask: "does the tune have an answer?", opts: [
      { w: "one theme is plenty", is: (s2) => !s2.themeB,
        apply: (s2) => ({ ...s2, themeB: false }) },
      { w: "a second theme answers it", is: (s2) => !!s2.themeB,
        apply: (s2) => ({ ...s2, themeB: true }) } ] },
    // 72 IS THE FLOOR ON PURPOSE. nukernel's tempo dial runs 70..160 and
    // song.js drops a document that says otherwise, so a band that agreed
    // to play at 48 would lose it the moment anyone pressed WRITE. Below 72
    // the honest axis is not the tempo, it is the SPACE question underneath:
    // one hit every four bars at 72 leaves thirteen seconds between kicks.
    { id: "tempo", ask: "how fast do we take it?", opts: [
      { w: "slow, 72", is: (s) => s.bpm === 72, apply: (s) => ({ ...s, bpm: 72 }) },
      { w: "medium, 96", is: (s) => s.bpm === 96, apply: (s) => ({ ...s, bpm: 96 }) },
      { w: "up, 120", is: (s) => s.bpm === 120, apply: (s) => ({ ...s, bpm: 120 }) },
      { w: "fast, 144", is: (s) => s.bpm === 144, apply: (s) => ({ ...s, bpm: 144 }) } ] },
    { id: "feel", ask: "straight or swung?", opts: [
      { w: "straight", is: (s) => !s.swing, apply: (s) => ({ ...s, swing: null }) },
      { w: "swung", is: (s) => s.swing === "swing", apply: (s) => ({ ...s, swing: "swing" }) },
      { w: "shuffled", is: (s) => s.swing === "shuffle", apply: (s) => ({ ...s, swing: "shuffle" }) } ] },
    // HOW DOES IT COUNT — the arranger's, because meter sits with the key,
    // the tempo and the form and is called before anybody plays. Not "what
    // meter?" (nobody says that at a session), not "what's the time?" (that
    // reads as tempo, which is already a question on this page), not "is it
    // a waltz?" (which names one genre for a whole class). "In four" is the
    // default and writes nothing, so an unanswered record is byte-identical
    // and the dice stays complete by construction.
    { id: "meter", ask: "how does it count?", opts: [
      { w: "in four", is: (s) => !s.meter, apply: (s) => ({ ...s, meter: null }) },
      { w: "in three", is: (s) => s.meter === "three", apply: (s) => ({ ...s, meter: "three" }) },
      { w: "in six-eight", is: (s) => s.meter === "six", apply: (s) => ({ ...s, meter: "six" }) } ] },
    // HOW SLOW CAN THIS GO: a tempo of 48 is still four hits a bar. This is
    // the other axis — how much of the bar is nothing.
    { id: "space", ask: "how much space is there?", opts:
      Object.entries(SPACE).map(([k, sp]) => ({
        w: sp.w, is: (s) => (s.space || "none") === k,
        apply: (s) => ({ ...s, space: k }) })) },
    // HOW DOES IT END. The kernel has carried ten ending gestures since the
    // outro organ (kernel.js outro(), fields.js `outro` on the box) and on
    // this page nothing ever wrote one — the record just stopped. The
    // question PINS a gesture on the last section; "however it falls" is
    // the default and writes nothing, so an unanswered record is
    // byte-identical and the dice stays complete by construction.
    { id: "end", ask: "how does it end?", opts: [
      { w: "however it falls", is: (s2) => !s2.end, apply: (s2) => ({ ...s2, end: null }) },
      { w: "a hard out", is: (s2) => s2.end === "cut", apply: (s2) => ({ ...s2, end: "cut" }) },
      { w: "ring it out", is: (s2) => s2.end === "tail", apply: (s2) => ({ ...s2, end: "tail" }) },
      { w: "hush it down", is: (s2) => s2.end === "hush", apply: (s2) => ({ ...s2, end: "hush" }) },
      { w: "a fill and out", is: (s2) => s2.end === "fill", apply: (s2) => ({ ...s2, end: "fill" }) } ] },
  ];
  // ...and a drum-shaped ending needs drums: on a section whose kit is empty
  // every fill degrades to the endings that are about the sound instead
  // (the same law compose.js OUTRO_NOKIT holds on the daw side)
  const OUT_NOKIT = { fill: "tail", roll: "tail", tomfill: "tail", hatrun: "cut",
                      doubles: "cut", "break": "tail", crash: "hush" };
  // a groove with nothing on the kit — the one fact both the endings above
  // and the default lift degrade on
  const kitlessOf = (g) => {
    const k = g.kits && g.kits.length ? g.kits : [g.kit || {}];
    return !k.some((bar) => Object.entries(bar || {})
      .some(([, v]) => Array.isArray(v) && v.some(Boolean)));
  };
  // the four kinds that accelerate INTO a downbeat — the lift's own ballot,
  // dealt deterministically by where the section sits
  const OUT_LIFT = ["roll", "hatrun", "doubles", "tomfill"];
  // ...and one CALL per role the form contains: "what are the chorus
  // changes?" is a thing a bandleader says out loud
  // ...one length question per role the form contains, beside its changes
  // ...and a role whose changes the hand AUTHORED has no length question:
  // the list's length IS the section's length (the precedence law), and a
  // question whose answers cannot change the record is not asked
  /* ...AND A SOLO IS ASKED HOW LONG IT IS. `rolesIn` is the list of roles
     whose CHANGES get called, and a solo's changes are the head's — that is
     what a solo is — so it was never in it and could never be asked its
     length either. But "how many choruses?" is the most ordinary question
     on a bandstand, and until it could be answered every solo in every
     record was exactly the twelve bars ROLEBARS gives it. Length only: a
     solo still borrows its changes, and it is asked only where the record
     actually has one. */
  const lenRoles = (m) => {
    const rs = rolesIn(m);
    return secsOf(m).includes("solo") ? [...rs, "solo"] : rs;
  };
  const lenDecisions = (m) => (hasShape(m) ? lenRoles(m) : [])
    .filter((r) => !chgxOf(m, r)).map((r) => ({
    id: "len:" + r, seat: "arranger", ask: "how long is the " + r + "?",
    opts: Object.entries(LENS).map(([k, v]) => ({
      w: v.w, is: (s2) => ((s2.lens || {})[r] || "short") === k,
      apply: (s2) => ({ ...s2, lens: { ...(s2.lens || {}), [r]: k } }) })),
  }));
  // "DOES ANYTHING LEAN?" — one small question per called role, after its
  // changes: the turnaround (the last bar leaning home) and the mid-cycle
  // lean, offered only where the cycle has four bars and the mid bar's next
  // differs from it (a lean into the same chord is the same wearing a
  // costume). Per-bar freedom is what the authored picker is FOR, so a role
  // with changes of its own is not asked — the lean is a mark IN its list.
  const leanDecisions = (m) => (hasShape(m) ? rolesIn(m) : [])
    .filter((r) => !chgxOf(m, r)).map((r) => {
    const c = B.CHANGES[(m.song.chg || {})[r] || "fourchord"];
    const mid = Math.floor(c.bars / 2) - 1;
    const midOk = c.bars >= 4 && c.roots[mid] !== c.roots[(mid + 1) % c.bars];
    return { id: "lean:" + r, seat: "arranger",
      ask: "does anything lean in the " + r + "?",
      opts: [
        { w: "no, it sits", is: (s2) => !(s2.lean || {})[r],
          apply: (s2) => { const lean = { ...(s2.lean || {}) }; delete lean[r];
                           return { ...s2, lean }; } },
        { w: "the last bar leans home", is: (s2) => (s2.lean || {})[r] === "last",
          apply: (s2) => ({ ...s2, lean: { ...(s2.lean || {}), [r]: "last" } }) },
        ...(midOk ? [{ w: "halfway, it leans into the turn",
          is: (s2) => (s2.lean || {})[r] === "mid",
          apply: (s2) => ({ ...s2, lean: { ...(s2.lean || {}), [r]: "mid" } }) }] : []),
      ] };
  });
  const callDecisions = (m) => (hasShape(m) ? rolesIn(m) : []).map((r) => ({
    id: "chg:" + r, seat: "arranger", ask: "what are the " + r + " changes?",
    opts: Object.entries(B.CHANGEWORD).map(([k, w]) => ({
      w, is: (s) => (s.chg || {})[r] === k,
      apply: (s) => ({ ...s, chg: { ...(s.chg || {}), [r]: k } }) })),
  }));
  // the melody is the arranger's, and it is asked in the ideas module's own
  // words — one question per thing that makes a tune. Theme B, when the
  // arranger has asked for one, gets the same interview under its own ids
  // ("ideaB:…"): the same five-or-six questions, aimed at the answer.
  const ideaDecisions = (m) => [
    ...Id.decisions(m.idea).map((d) => ({
      ...d, id: "idea:" + d.id, seat: "arranger",
      opts: d.opts.map((o) => ({ ...o,
        apply: (s2) => s2,                     // the melody is not a song field
        idea: true, iid: d.id })) })),
    ...(m.ideaB && m.ideaB.on ? Id.decisions(m.ideaB).map((d) => ({
      ...d, id: "ideaB:" + d.id, seat: "arranger",
      ask: "and the answer — " + d.ask,
      opts: d.opts.map((o) => ({ ...o,
        apply: (s2) => s2,
        idea: "b", iid: d.id })) })) : []),
  ];
  const threeOpts = (m, f) => openOf(m.song, f).map((v) => ({
    w: v, is: (s2) => s2[f] === v, apply: (s2) => ({ ...s2, [f]: v }) }));
  // memoised per model, like the chairs' lists: `answer` builds this to find
  // one row, and a fresh model on every answer made composing a record cost
  // milliseconds per tap for lists nobody read
  const ARRD = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  const arrDecisions = (m) => {
    if (!ARRD) return arrDecisionsNow(m);
    let hit = ARRD.get(m);
    if (!hit) ARRD.set(m, hit = arrDecisionsNow(m));
    return hit;
  };
  const arrDecisionsNow = (m) => [...ARR, ...callDecisions(m), ...leanDecisions(m),
                                  ...lenDecisions(m), ...ideaDecisions(m)]
    .map((d) => (d.three ? { ...d, opts: threeOpts(m, d.id) }
      : d.id === "genre"
        // THE RECORDS STILL STANDING — but read WITHOUT the room, so the
        // question keeps something to offer after the third answer has
        // called one. It is answered by then, so nobody is asked it; it sits
        // on the sheet as a fact, and tapping it offers the neighbours (the
        // other records of that decade and that city) rather than a list of
        // fifteen. Removing it outright left no way to say "actually, make
        // it a punk record".
        ? { ...d, opts: d.opts.filter((o) =>
            survivors({ ...m.song, venue: null }).some(([, gk]) => gk.w === o.w)) }
        : d.color ? colorRow(m)
        : d))
    .map((d) => ({
    // ...and an IDEA question is answered on the idea, not on the song, so
    // its own answer stands (overwriting it with the song's made the tune's
    // questions unanswerable — the arranger was asked "how long is it?"
    // forever)
    ...d, seat: "arranger",
    // an IDEA question (either theme's) is answered on the idea's own
    // ledger, not the song's
    // ...and THE FORM ANSWERS OFF THE BOXES once anybody has edited them.
    // A sheet that still says "AABA" over boxes reading intro/verse/verse/
    // bridge/verse/solo/outro is a sheet lying about the record: what the
    // record IS is what the boxes say, so that is the word this fact wears.
    answered: d.id === "form" && boxesEdited(m) ? shapeOf(m)
      : d.id.startsWith("idea") ? d.answered : ((m.song.answers || {})[d.id] || null),
    // the chair's own option mapper, aimed at the SONG: what was said, and
    // what is true of the tune right now.
    // ...AND AN IDEA ROW IS AIMED AT THE IDEA (2026-08-22). A theme question
    // is answered on the tune's own ledger, and this mapper was reading the
    // SONG's — so the answered option never lit and `is()` was being handed a
    // song where it expected an idea. Invisible while nothing but the dice
    // ever answered a theme question; the moment a called record seeds one
    // (THEMES above), a decision the sheet says was made shows no word lit,
    // which is the difference between "you decided this" and "something
    // happened to you".
    opts: d.id.startsWith("ideaB:")
      ? C.mapOpts(d.opts, d.answered, m.ideaB || {})
      : d.id.startsWith("idea:")
        ? C.mapOpts(d.opts, d.answered, m.idea)
        : C.mapOpts(d.opts, (m.song.answers || {})[d.id], m.song) }));

  /* ---------- ANOTHER TAKE (Paul, 2026-08-22) ----------------------------
     "We should also have a reseed button to rebuild the current song with
     variation on its core identity."

     THE LAW: WHAT WAS ANSWERED IS HELD; WHAT WAS DERIVED IS RE-DERIVED. A
     take moves ONE field — `song.take` — and that field reaches the ENGINE
     and not the model, so every answered fact is byte-identical by
     construction rather than by care: the genre, the key, the tempo, the
     meter, the form and its lengths, every chair's answers, every theme bar
     a hand wrote and every producer note are all upstream of it and cannot
     move. What DOES move is everything the kernel decides with a seed (see
     toSong): which chance hits land, the hand's micro-timing, the velocity
     humanisation, the ornament rolls, and where a canon falls.

     REPEATABLE, because a record is a document: the take is a number on the
     model, so the same record at the same take is the same performance, and
     a saved session comes back as the take it was saved on. Take 1 (and the
     absent field, which is every record made before this) is the
     performance this box has always given.

     WHAT A TAKE DELIBERATELY DOES NOT RE-DERIVE: the four tables above.
     The theme, the seats, the desk and the proportions are seeded as
     ANSWERS — that is the whole of "every default stays a question" — and
     the law says an answer is held. A second take is the same band playing
     the same tune again, not a second tune. */
  const anotherTake = (m, n) => {
    const now = m.song.take | 0;
    const take = n != null ? Math.max(1, n | 0) : Math.max(1, now || 1) + 1;
    if (take === (now || 1)) return m;
    const out = { ...m, song: { ...m.song, take } };
    const gk = genreOf(out);
    // ...and a room with no record in it has no material to re-write: the
    // take is still the take, and the performance seed still moves.
    if (!gk) return out;
    // THE MATERIAL PASS ONLY, and not `finish()`. The four tables are what
    // the record IS — its theme's register and length plan, where the band
    // sits, the board, the proportions — and re-running them on a take
    // re-derives them, which is a different record at the same take
    // number. `settle` is the half that rolls.
    return stampSeeds(m, settle(out, gk, planOf(out.song.genre, gk), take));
  };
  const takeOf = (m) => Math.max(1, m.song.take | 0);

  /* ---------- WHO PUT IT THERE -------------------------------------------
     "I expect all the questions to have answers now when I make a song."
     (Paul, 2026-08-23.) He was right and it was not true: walked from the
     front door to a called record, the seats read 28 of 86 answered — the
     record HAD decided the groove, the machine, the line, the instruments,
     the tune, the seats, the desk and the proportions, and the sheet read
     blank for sixty of them, because a record's decisions were a SAY
     (chair.js sayOf: the model moves, the ledger does not) or simply the
     model's own standing state, which no ledger records at all.

     That distinction was worth keeping and the CONSEQUENCE was not, so it
     stops being a distinction between "answered" and "unanswered" and
     becomes one between WHO ANSWERED. One ledger, `song.seeded`, keyed
     "<seat>/<id>": a record put this here. Everything else follows from it:

       the gig sheet   reads `answered` and shows a word for every row
       the interview   skips only what a HAND said, so a seeded row is still
                       asked — with its word lit — and no seat goes dead
       the law         a record may move what a record put there and may
                       never move a hand's answer, now by NAME rather than
                       by comparing against what the previous record's plan
                       would have seeded
       another take    re-rolls what the record put there and holds the rest

     AND A SESSION SAVED BEFORE THIS IS UNTOUCHED: no `seeded` key means
     every standing answer reads as a hand's, which is the safe half of
     every law above — nothing is re-asked, nothing is re-rolled, the record
     restores byte-identical. */
  const seedKey = (seat, id) => seat + "/" + id;
  const seededAt = (m, seat, id) => !!((m.song.seeded || {})[seedKey(seat, id)]);
  // ...and the one question the walkers ask: did a PERSON say this?
  const handSaid = (m, seat, d) => !!d.answered && !seededAt(m, seat, d.id);
  // ...and the same question of a SONG alone, for the option tables that
  // are handed one (the genre row's own apply): did a person say this?
  const songHand = (s, id) => !!(s.answers || {})[id] &&
    !((s.seeded || {})["arranger/" + id]);
  // ...and the public form of it: who said this? — "hand", "record", or
  // nobody. The page reads it to draw a record's word differently from
  // yours; the gates read it to hold the law.
  // ...and WHICH KIND of the record's: "chose" (a decision out of a table)
  // or "named" (the word for a state it was already in). The dice reads it,
  // and so does anything else that wants to roll a record without rolling
  // the finishing away.
  const seedKind = (m, seat, id) => (m.song.seeded || {})[seedKey(seat, id)] || null;
  const saidBy = (m, seat, id) => {
    const said = seat === "engineer" ? (m.eng || {})[id]
      : seat === "arranger" ? (id.startsWith("knob:")
          ? ((m.song.knobs || {}).__said || {})[id.slice(5)]
          : id.startsWith("ideaB:") ? ((m.ideaB || {}).answers || {})[id.slice(6)]
          : id.startsWith("idea:") ? ((m.idea || {}).answers || {})[id.slice(5)]
          : (m.song.answers || {})[id])
      : (((m[seat] || {}).answers) || {})[id];
    if (!said) return null;
    return seededAt(m, seat, id) ? "record" : "hand";
  };
  /* TWO KINDS OF SEED, and the difference is what the dice reads. A record
     CHOSE some of these — the tune's shape, where the band sits, the board,
     the proportions, the groove, the cast, the changes: decisions, out of a
     table, and the reason a called record sounds like itself. The rest it
     merely NAMED: the word for a state the model was already in ("normal",
     "straight", "however they fall"), which carries no decision at all and
     is only on the ledger so the sheet is not blank.
       Both are the record's, so both are re-asked and both are movable.
     They part company at the DICE: rolling a record's decisions at random
     is rolling the finishing away, and it measured exactly that — the
     critic's median fell from the 60th percentile to the 51st and D-grades
     went from 3 to 14 the moment the dice started re-rolling the four
     tables. So the dice rolls what the record NAMED and keeps what it
     CHOSE, which is also the honest reading of what a dice is for: a random
     RECORD, played the way that record is played. */
  const markSeed = (m, seat, id, how) => ({ ...m, song: { ...m.song,
    seeded: { ...(m.song.seeded || {}), [seedKey(seat, id)]: how || "named" } } });
  const chose = (m, seat, id) => (m.song.seeded || {})[seedKey(seat, id)] === "chose";
  const unseed = (m, seat, id) => {
    const s = m.song.seeded;
    if (!s || !s[seedKey(seat, id)]) return m;
    const next = { ...s }; delete next[seedKey(seat, id)];
    return { ...m, song: { ...m.song, seeded: next } };
  };

  /* WHAT A RECORD WROTE, MEASURED RATHER THAN THREADED. `called()` writes
     answers through six different chairs' own `answer` functions and four
     more ledgers besides; asking each of those call sites to also stamp a
     provenance flag is eleven places for the next one to be forgotten. So
     the stamp is a DIFF: every answer ledger on the model, before and
     after, and anything that arrived or moved was the record's doing. A
     hand's answer that the record did not touch keeps its rank by simply
     not appearing in the diff. */
  const LEDGERS = (m) => {
    const out = { arranger: { ...(m.song.answers || {}) },
                  engineer: { ...(m.eng || {}) } };
    for (const [f, w] of Object.entries(((m.song.knobs || {}).__said) || {}))
      out.arranger["knob:" + f] = w;
    for (const [dim, w] of Object.entries((m.idea && m.idea.answers) || {}))
      out.arranger["idea:" + dim] = w;
    for (const [dim, w] of Object.entries((m.ideaB && m.ideaB.answers) || {}))
      out.arranger["ideaB:" + dim] = w;
    for (const seat of ["drums", "bass", "keys", "guitar", "voice"])
      out[seat] = { ...((m[seat] || {}).answers || {}) };
    // ...and the two things a record writes that are not on any ledger: the
    // bassist's written-out figure and whatever the chairs were SAID rather
    // than asked (the cast). Both are answers in every sense the sheet
    // cares about, so both get a key of their own here.
    out.bass["fig"] = m.bass && m.bass.fig ? "written" : null;
    return out;
  };
  // ...and THE DICE IS NOT A HAND. Every answer in a rolled record was made
  // by the machine, so every one of them is the record's: a take may
  // re-write the tune it rolled, and calling a different record may move
  // what it cast. (Rolled and then EDITED is the ordinary case again — the
  // moment a person taps a word, `answer()` takes that row off this ledger
  // and no take touches it.) Without this, "another take" on a rolled
  // record moved nothing but the performance seed, which is the feature
  // this ledger exists to make possible.
  const allSeeded = (m) => {
    const led = LEDGERS(m), seeded = { ...(m.song.seeded || {}) };
    for (const seat of Object.keys(led))
      for (const [id, w] of Object.entries(led[seat]))
        if (w != null && !seeded[seedKey(seat, id)]) seeded[seedKey(seat, id)] = "chose";
    return { ...m, song: { ...m.song, seeded } };
  };
  const stampSeeds = (before, after) => {
    const a = LEDGERS(after), b = LEDGERS(before);
    const seeded = { ...(after.song.seeded || {}) };
    let moved = false;
    for (const seat of Object.keys(a))
      for (const [id, w] of Object.entries(a[seat])) {
        if (w == null || w === b[seat][id]) continue;
        const k = seedKey(seat, id);
        // ...and a mark already made STANDS: `settle` runs inside this diff
        // and writes its own NAMED marks, which must not be promoted to
        // decisions by the very pass that is measuring them.
        if (!seeded[k]) { seeded[k] = "chose"; moved = true; }
      }
    // ...and an answer the record took AWAY stops being the record's
    for (const seat of Object.keys(b))
      for (const id of Object.keys(b[seat]))
        if (a[seat][id] == null && seeded[seedKey(seat, id)])
          { delete seeded[seedKey(seat, id)]; moved = true; }
    return moved ? { ...after, song: { ...after.song, seeded } } : after;
  };

  /* ---------- 5. AND EVERY REMAINING QUESTION GETS ITS WORD --------------
     The four tables above are the things nobody was PLAYING. This is the
     rest of the sheet: sixty rows the record had already decided and could
     not say. THE RULE IS THAT A RECORD NAMES WHAT IT IS, IT DOES NOT
     RETUNE ITSELF — which is why this whole pass is render-neutral by
     construction, and why running it changed no note of any record:

       1. THE WORD THAT IS ALREADY TRUE. Every option in this box carries
          an `is()` — that is what lights the "active" dot — so the answer
          to "how hard are you hitting?" on a record that is hitting
          normally is "normal", and writing it down applies nothing. 38 of
          the 58 blank rows are this, and it is the honest majority: the
          record HAD decided, the ledger just never heard.
       2. A DESCRIBER, where `is()` is too strict to have a winner but the
          fact is legible anyway — the drummer's job (read off the hands),
          the tone panels (the nearest word to what the chair's own
          `toGenre` is actually sounding, engine defaults included) and the
          annotated knobs (the value the composed genre already carries).
          Named, not applied, for the same reason: 0.05 seconds of attack
          is "straight away" to a musician, and moving it to exactly 0.01
          so the word can be exact would be the tail wagging the record.
       3. THE PLAINEST THING, said as such, where a record genuinely has no
          opinion — `knob:fill` on the 30 records that carry no fill kit at
          all, where neither "on the snare" nor "round the toms" is true of
          anything and the drummer's own "where do the fills go?" has
          already said there are none.

     ...and TWO KINDS OF ROW ARE DECIDED RATHER THAN NAMED, listed here so
     the exception is visible: `where` and `venue` (facts about the session,
     answered out of the record's own lists, and which move no note), and
     the engineer's five per-channel questions — whose ledger IS the desk,
     and whose neutral word ("dry", "straight in", "close and dry", "with
     the kick") carries an EMPTY offset table, so a board seeded at the
     record's own treatments is the same board an untouched one is wherever
     the record has nothing to say.

     THE FIFTH CHAIR IS NOT RETIRED BY THIS, which is what killed the last
     attempt at it ("Seeding all thirteen retired the fourth chair
     entirely" — the note that used to stand over DESKBOARD). It was true
     while an answered question was a closed one; the provenance ledger
     above is what makes it false, and `test/unit/question-trees.test.js`
     ("nothing is ever asked") is the gate that says so. */
  // the tone panels, by the chair that owns them — the describer reads the
  // chair's own `toGenre`, so what the sheet says a guitar sounds like is
  // what the engine is handed and not a second table beside it
  const PANELOF = { keys: Ky, guitar: Gt, voice: Vo };
  // ...and the two panel keys whose default lives in the ENGINE rather than
  // the chair's tone block (state-engine.js `singer`): a voice nobody has
  // cast is a tenor, and a fold nobody has stirred does not move.
  const ENGTONE = { voice: "tenor", sway: 0 };
  const toneWord = (m, seat, d) => {
    const K2 = PANELOF[seat];
    const p = K2 && (K2.PANEL || []).find((x) => x.id === d.id);
    if (!p) return null;
    let val;
    try { val = K2.toGenre(m[seat]).tone[p.key]; } catch (e) { val = undefined; }
    if (val === undefined) val = ENGTONE[p.key];
    if (val === undefined) return null;
    let best = null, gap = Infinity;
    for (const o of p.opts) {
      if (o.v === val) return o.w;
      if (typeof o.v !== "number" || typeof val !== "number") continue;
      const g2 = Math.abs(o.v - val);
      if (g2 < gap) { gap = g2; best = o.w; }
    }
    return best;
  };
  // the annotated knobs: the word for the value the composed genre already
  // carries. `null` and `undefined` are the same absence to the merge
  // (askable.js `merge` skips both), so a row with a word for the absence
  // — "none", "every one", "flat" — answers itself.
  const knobWord = (row, g) => {
    const val = g ? g[row.field] : undefined;
    const j = JSON.stringify(val);
    for (const [w, v] of row.opts) if (JSON.stringify(v) === j) return w;
    if (val == null)
      for (const [w, v] of row.opts) if (v == null || v === 0 || v === false) return w;
    if (typeof val === "number") {
      let best = null, gap = Infinity;
      for (const [w, v] of row.opts)
        if (typeof v === "number" && Math.abs(v - val) < gap) { gap = Math.abs(v - val); best = w; }
      if (best) return best;
    }
    return null;
  };
  // the drummer's own job, read off the hands rather than off a ledger: a
  // pair of hands in sixteenths is driving it, in eighths is holding it
  // down, and a kit with nothing in the hands at all is staying out of the
  // way. (`is()` cannot answer this one — every option there rewrites the
  // kit it is testing, so a record's own groove matches none of them.)
  const drumJobWord = (dm) => {
    const hands = (dm.kit && [...(dm.kit.h || []), ...(dm.kit.p || [])]) || [];
    const n = hands.filter(Boolean).length, steps = (dm.met && dm.met.steps) || 16;
    if (!n) return "stay out of the way";
    return n >= steps * 0.75 ? "drive it" : "hold it down";
  };

  /* A TAKE ROLLS THE MATERIAL AND HOLDS THE RECORD (Paul, 2026-08-23:
     "'Another take' should create new figures/themes").

     A take used to move ONE field — the performance seed — so the chance
     hits, the micro-timing, the humanised velocities and the ornament rolls
     varied and the TUNE was identical every time: about 13% of notes moved
     and not one of them was a different note to play. The reason was the
     law above ("what was answered is held") applied to answers the player
     never gave — the RECORD gave them — and the ledger is what tells the
     two apart. So the rule falls straight out of the provenance:

       ANOTHER TAKE RE-ROLLS WHAT THE RECORD PUT THERE, AND HOLDS WHAT THE
       HAND SAID.

     MATERIAL is the list of rows that are a musical invention rather than
     an identity: the tune's own shape and its answer's, the groove and the
     fills, the bassist's line and how they play it, and what each pair of
     hands is doing. Everything else a record seeded — the genre and its
     route, the key, the mode, the tempo, the meter, the form and its
     lengths, the cast, the seats, the desk, the proportions — is what the
     record IS, and a second take is the same record.

     REPEATABLE, because a record is a document: the roll is seeded from
     (take, genre, seat, question), so take 2 of a record is take 2 of it
     forever, and take 1 is byte-for-byte the record this box has always
     made. And a roll never lands where it already is when it has anywhere
     else to go, so a take is a NEW line rather than a coin flip that half
     the time writes the same one. */
  const MATERIAL = {};
  for (const k of ["arranger/idea:len", "arranger/idea:cell", "arranger/idea:sent",
                   "arranger/idea:contour", "arranger/idea:land",
                   "arranger/ideaB:len", "arranger/ideaB:cell", "arranger/ideaB:sent",
                   "arranger/ideaB:contour", "arranger/ideaB:land",
                   "drums/groove", "drums/fills", "bass/job", "keys/job"])
    MATERIAL[k] = true;
  /* WHAT A TAKE DELIBERATELY DOES NOT RE-ROLL, and it is a short list
     because the line between material and identity is exactly where a
     musician would draw it:
       the cast          which guitar, which voice, which drum machine — a
                         band does not change instruments between takes
       the seats         where each chair sits, which is the arrangement
       how they play     the drummer's touch, the bassist's articulation,
                         the tone panels: that is who the player IS
       the guitar and voice PARTS, for the same reason the cast is held —
                         they are one pair of hands each and the record
                         already said what they are for
       a WRITTEN-OUT FIGURE (`bass.fig`) — an acid line is not a bassist's
                         choice on the night, it IS the record; the take
                         re-rolls the bassist's LINE, which is what plays on
                         the 22 of 30 records that carry no figure */
  // a small deterministic hash: the same take of the same record rolls the
  // same way on any machine, which is what makes a take a document
  const rollAt = (take, key, n) => {
    let h = (take * 2654435761) >>> 0;
    for (let i = 0; i < key.length; i++) h = (Math.imul(h ^ key.charCodeAt(i), 16777619)) >>> 0;
    return n ? h % n : 0;
  };

  /* WRITING A WORD DOWN WITHOUT PLAYING IT. Every ledger this box keeps, in
     one place: the arranger's own, the annotated knobs' `__said`, the two
     themes', the five chairs', and the engineer's — whose ledger IS the
     desk (mixOf reads `m.eng` directly), so for that one seat writing the
     word down and setting the board are the same act. */
  /* A DESCRIPTION OF THE LAST RECORD IS NOT AN ANSWER TO THIS ONE. The
     naming pass writes a word on every row (5, below), and every guard in
     `called()` asks "has this chair spoken for itself?" by looking for an
     answer — so read as answers, the last record's descriptions froze its
     cast onto the next one: called after a techno record, a house record
     kept techno's drone, because "a drone" was standing on the keys'
     ledger where nothing had stood before. CHOSEN words stay (they are
     what the last record decided, and the law of the seed governs them);
     NAMED words come off, and the naming pass puts them back from whatever
     the new record actually plays. */
  const dropAnswer = (m, seat, id) => {
    if (id.startsWith("knob:")) {
      const k2 = m.song.knobs || {}, said = { ...(k2.__said || {}) };
      delete said[id.slice(5)];
      return { ...m, song: { ...m.song, knobs: { ...k2, __said: said } } };
    }
    if (seat === "engineer") { const eng = { ...(m.eng || {}) }; delete eng[id];
      return { ...m, eng }; }
    if (seat === "arranger") {
      if (id.startsWith("ideaB:") || id.startsWith("idea:")) {
        const which = id.startsWith("ideaB:") ? "ideaB" : "idea";
        const im = m[which]; if (!im) return m;
        const ans = { ...(im.answers || {}) };
        delete ans[id.slice(which === "ideaB" ? 6 : 5)];
        return { ...m, [which]: { ...im, answers: ans } };
      }
      const ans = { ...(m.song.answers || {}) }; delete ans[id];
      return { ...m, song: { ...m.song, answers: ans } };
    }
    const cm = m[seat]; if (!cm) return m;
    const ans = { ...(cm.answers || {}) }; delete ans[id];
    return { ...m, [seat]: { ...cm, answers: ans } };
  };
  const stripNamed = (m) => {
    const sd = m.song.seeded;
    if (!sd) return m;
    let out = m, seeded = null;
    for (const [k, kind] of Object.entries(sd)) {
      if (kind !== "named") continue;
      const at = k.indexOf("/");
      out = dropAnswer(out, k.slice(0, at), k.slice(at + 1));
      seeded = seeded || { ...sd };
      delete seeded[k];
    }
    return seeded ? { ...out, song: { ...out.song, seeded } } : out;
  };

  const noteAnswer = (m, seat, id, w) => {
    if (id.startsWith("knob:")) {
      const f = id.slice(5), k2 = m.song.knobs || {};
      return { ...m, song: { ...m.song, knobs: { ...k2,
        __said: { ...(k2.__said || {}), [f]: w } } } };
    }
    if (seat === "engineer") return { ...m, eng: { ...(m.eng || {}), [id]: w } };
    if (seat === "arranger") {
      if (id.startsWith("ideaB:")) return m.ideaB ? { ...m, ideaB: { ...m.ideaB,
        answers: { ...(m.ideaB.answers || {}), [id.slice(6)]: w } } } : m;
      if (id.startsWith("idea:")) return { ...m, idea: { ...m.idea,
        answers: { ...(m.idea.answers || {}), [id.slice(5)]: w } } };
      return { ...m, song: { ...m.song, answers: { ...(m.song.answers || {}), [id]: w } } };
    }
    const cm = m[seat];
    if (!cm) return m;
    return { ...m, [seat]: { ...cm, answers: { ...(cm.answers || {}), [id]: w } } };
  };

  // THE RECORD'S OWN CHANNELS. The eight board words describe how the
  // RECORD sounds and live in DESKS; these five describe what is on one
  // instrument, and the neutral word of each carries an empty offset table
  // — so a desk that says nothing here is the same board an untouched one
  // is, and a desk that does is the idiom talking (a version board echoes
  // everything, a hall puts a plate on the voice, a club washes the keys).
  const CHANS = ["keysfx", "gtrfx", "voxfx", "bassfx", "bassmix"];
  const DESKDRY = { keysfx: "dry", gtrfx: "straight in", voxfx: "close and dry",
                    bassfx: "dry", bassmix: "with the kick" };
  const DESKCHAN = {
    club:   { keysfx: "wide and wet", voxfx: "a plate", bassmix: "out front" },
    garage: { gtrfx: "a room" },
    crate:  { bassfx: "thicken it", bassmix: "out front" },
    date:   { keysfx: "a room", voxfx: "a plate" },
    version:{ keysfx: "echo", gtrfx: "a slapback", voxfx: "a long echo",
              bassfx: "dub echo", bassmix: "out front" },
    hall:   { keysfx: "a room", gtrfx: "a room", voxfx: "in the distance",
              bassmix: "under everything" },
    parlour:{},
  };
  const chanWord = (id, plan) =>
    ((DESKCHAN[plan && plan.desk] || {})[id]) || DESKDRY[id] || null;

  /* THE ONE PASS. Every seat, every question, in the order the chairs ask
     them — and for each one the first of these that has something to say.
     Nothing here reaches for a table before it has asked the model what is
     already true, which is the whole difference between a record that
     arrives finished and a record that arrives overwritten. */
  const seedWord = (m, seat, d, plan, composed) => {
    const act = d.opts.filter((o) => o.active);
    if (act.length) return act[0].w;                       // the word that is true
    if (seat === "drums" && d.id === "job") return drumJobWord(m.drums);
    if (d.id.startsWith("knob:")) {
      const row = Ask.ASKABLE.find((r) => r.field === d.knob);
      const w = row && knobWord(row, composed());
      if (w && d.opts.some((o) => o.w === w)) return w;
    }
    const t = toneWord(m, seat, d);
    if (t && d.opts.some((o) => o.w === t)) return t;
    if (seat === "engineer") {
      const w = chanWord(d.id, plan);
      if (w && d.opts.some((o) => o.w === w)) return w;
    }
    // the changes, when nothing has been called: the kernel's own standing
    // default is the four-chord cycle (`m.song.chg[role] || "fourchord"`),
    // so that is the true word wherever the record still offers it
    if (d.id.startsWith("chg:")) {
      const w = B.CHANGEWORD.fourchord;
      if (w && d.opts.some((o) => o.w === w)) return w;
    }
    return d.opts.length ? d.opts[0].w : null;             // the plainest thing
  };

  /* A TAKE'S OWN ROLL: one of this question's live answers, chosen from the
     WHOLE list rather than from "anything but the one standing" — and that
     is the one non-obvious line in this feature. Rolling against the
     standing word reads better and is not repeatable: take 3 reached from
     take 2 would exclude take 2's answer while take 3 reached from take 1
     would exclude take 1's, so the same take number would name two
     different records depending on the road you took to it. A take is a
     document, so the roll depends on the take, the record and the question
     and on nothing else. The cost is that one row in n lands where it
     already was; with ten material rows rolling at once, a take that
     repeats every one of them is not a thing that happens. */
  // ...and A TAKE NEVER LAYS A PLAYER OUT. Every pitched chair's job list
  // ends in "lay out" — a real answer, and the record's to give — but a
  // second take is the same band playing the same song again, and a band
  // does not lose its keys player between takes. Measured before this rule:
  // one roll in a hundred and fifty came back with a chair seated and
  // silent, which the critic calls unplayable by its own hard law
  // ("a chair the record seats sounds somewhere", engine/musicality.js:161).
  const KITOF = { keys: Ky, guitar: Gt, voice: Vo };
  const layOut = (seat) => Object.values((KITOF[seat] || {}).JOBS || {})
    .filter((j) => !j.part).map((j) => j.w);
  const rollWord = (m, seat, d, take) => {
    let opts = d.opts;
    if (d.id === "job") {
      const out = layOut(seat);
      if (out.length) { const keep = opts.filter((o) => !out.includes(o.w));
        if (keep.length) opts = keep; }
    }
    /* A TAKE DOES NOT HAND THE CHANT THE CHARLESTON (2026-08-23).

       The same law as the drummer's below, said for the other pair of
       hands, and it had the same hole. `keys/job` is a MATERIAL row, so a
       take re-rolls it — and NOTHING narrowed it: the bassist's line is
       drawn from the record's own `styles` (`narrow`, WORDSOF), the
       drummer's groove from its `grooves`, the kit from its `machines`,
       and the keyboard player had no per-record list at all. The roll is
       seeded from (take, seat, question) and the option count was
       therefore the same thirteen on every record, so it landed on the
       SAME FOUR WORDS IN THE SAME ORDER for all thirty: measured, takes
       2..6 were "arpeggios · the Charleston · pads · a counter-line · on
       the offbeats" on the house record, on the jazz date, on the hymn and
       on the Gregorian chant alike — one distinct sequence across thirty
       records, and the Charleston is a 1920s dance rhythm arriving in a
       ninth-century monastery because the dice said so.

       So a record declares `kjobs` — the keyboard jobs that are idiomatic
       FOR IT — and the roll draws from that and nothing else. The head of
       the list is what `called()` casts, so take one is byte-identical
       everywhere; a one-entry list (chant: a held drone, and that is what a
       chant's keyboard is) makes the roll a no-op and the take varies
       somewhere else, exactly as a kitless record's groove roll does.

       HERE AND NOT IN `narrow`, deliberately, and it is the difference
       between a MECHANISM and a HAND. `narrow` drops any filter that would
       leave fewer than two answers — so the chant's single word could not
       be expressed there at all — and, more importantly, narrowing would
       take the Charleston off the table for a PERSON who wants it. A hand
       outranks a record; a take does not. (The dice is a hand in a hurry —
       "the ordinary path taken quickly" — and is left alone for the same
       reason.) */
    if (seat === "keys" && d.id === "job") {
      const want = (genreOf(m) || {}).kjobs || [];
      if (want.length) {
        const words = want.map((id) => (Ky.JOBS[id] || {}).w).filter(Boolean);
        const keep = opts.filter((o) => words.includes(o.w));
        if (keep.length) opts = keep;
      }
    }
    /* A TAKE DOES NOT SEAT A DRUMMER THE RECORD DOES NOT HAVE (Paul,
       2026-08-23: "sometimes you add drums to the 1800s").

       A take is the same band playing the same song again. It may vary what
       the record ALLOWS, and the other direction of that law was already
       held — a take may never lay a player out — but nobody had said the
       first direction, and the material roll walked straight through it:
       measured on the twelve old-world records, called with an empty kit,
       three takes put 9 to 96 hits on it. Two doors, and both are shut
       here rather than in a table of record names:

         the groove   salon's own list is "nobody on the kit · a siciliana"
                      and the roll took the siciliana — a drummer arriving
                      in a parlour in 1870 because the dice said so
         the fills    "end of every four" is not on any record's list, so
                      nothing narrowed it, and it FABRICATES a bar of kit
                      out of an empty one: chant, organum, monody and
                      vienna all gained hits without their groove ever
                      moving

       So the roll asks the drummer what each word would actually make and
       keeps only the words that leave the kit AS THE RECORD HAS IT. Both
       directions, because they are one law said twice: a record with
       nobody on the kit keeps nobody on it (chant, salon, hymn — where
       "no fills" and "nobody on the kit" are the only survivors, so the
       roll is a no-op and the take varies elsewhere), and a record with a
       drummer keeps the drummer (romantic's own list is "a processional ·
       nobody on the kit", and the roll took the second — 256 hits to none,
       which is the take laying a player out, the half of this law that was
       already written down). Every record whose grooves are all of one
       kind — which is 26 of the 30 — rolls exactly as it always did. */
    /* ...AND THE RECKONING IS THE RECORD'S, ONE AXIS AT A TIME (2026-08-23).
       The law above is right and it was being asked of the wrong model. `bare`
       came off `m.drums` — the model this take starts from, which is the
       PREVIOUS take — and the two material rows read each other, so:
         · "nobody on the kit" with fills still switched on is not a kitless
           genre (the fill bars have hits), so the groove roll kept the tacet
           whenever the take before it happened to roll the fills ON;
         · and a take that landed on the tacet made the NEXT take's reference
           kitless, which changed what that one was allowed to roll.
       Both make a take number name two different records depending on the road
       there — take three off take two disagreeing with take three off take one
       — which is the one thing test/unit/band-kit.test.js says a take may never
       do. Measured on the shipped file before this: 43 of 200 seeded records
       walked to a different take three than they were handed, and the gate
       samples eight seeds, so it had never landed on one. (It landed on seed 6
       the moment the racks opened and seed 6 became a rock record in six-eight.)
       So the reference is the RECORD'S OWN GROOVE, which no take can move, and
       each row is judged on its own axis: a groove is weighed with the fills
       switched off, and the fills are weighed whole. */
    if (seat === "drums") {
      const noFill = (dm) => { try { return D.answer(dm, "fills", "no fills"); }
                               catch (e) { return dm; } };
      const kitless = (dm, whole) => kitlessOf(D.toGenre(whole ? dm : noFill(dm)));
      const rec = (genreOf(m) || {}).grooves || [];
      let ref = m.drums;
      if (rec.length) { try { ref = D.answer(m.drums, "groove", rec[0]); } catch (e) { ref = m.drums; } }
      const whole = d.id === "fills";
      const bare = kitless(ref, whole);
      const keep = opts.filter((o) => {
        try { return kitless(D.answer(m.drums, d.id, o.w), whole) === bare; }
        catch (e) { return false; }
      });
      if (!keep.length) return null;
      opts = keep;
    }
    if (!opts.length) return null;
    return opts[rollAt(take, seedKey(seat, d.id), opts.length)].w;
  };

  // ONE MODEL PER SEAT, NOT ONE PER ANSWER. A ledger write cannot change
  // what any other question is offered, so the naming answers are batched
  // and written once a seat — which is what keeps `called()` a tap rather
  // than a pause: the cost here is rebuilding a seat's question list, and
  // that list is memoised per model.
  const noteAll = (m, seat, notes) => {
    let out = m;
    // ...INCLUDING THE ENGINEER'S FIVE, whose ledger IS the desk and which
    // are therefore a decision rather than a description. They are marked
    // NAMED anyway, and for a measured reason: the dice draws once per row
    // it rolls, so a row that stops being rolled shifts every draw after it
    // and every seed names a different record. Held here, `randomSong`
    // rolls exactly the rows it has always rolled and seed N is still the
    // record seed N always was — which is what the dice gate, the critic's
    // dice cohort and every reproduction in this file's history depend on.
    // A rolled board is what a rolled record always had.
    const how = "named";
    for (const [id, w] of Object.entries(notes))
      out = markSeed(noteAnswer(out, seat, id, w), seat, id, how);
    return out;
  };

  /* A TAKE STARTS FROM THE RECORD'S OWN TUNE. One row in the tune's six is
     asked only sometimes — "how does it speak?" needs more than one bar to
     be a sentence (ideas-kit `when`) — so a take that rolls the LENGTH down
     to one bar leaves the sentence plan standing, and the standing one is
     whatever the take before it happened to write. That is the one way a
     take number could name two records depending on the road there: take
     three off take two kept take two's sentence, take three off take one
     kept take one's. So every material dim of the theme is put back to the
     record's own word before anything is rolled, which makes the base
     canonical and the roll a function of the take alone. */
  const rebase = (m, plan) => {
    const shape = THEMES[plan.theme] || THEMES.topline;
    const isHand = (id, im, dim) => (im.answers || {})[dim] &&
      !seededAt(m, "arranger", id);
    let out = m, seeded = null;
    const drop = (id) => { seeded = seeded || { ...(out.song.seeded || {}) };
      delete seeded[seedKey("arranger", id)]; };
    // THE TUNE goes back to the record's own shape...
    let a = out.idea;
    for (const dim of ["len", "cell", "sent", "contour", "land"]) {
      const id = "idea:" + dim;
      if (isHand(id, a, dim)) continue;
      const t = THEMEASK[dim][shape[dim]];
      if (t && t.w && (a.answers || {})[dim] !== t.w) a = Id.answer(a, dim, t.w);
    }
    if (a !== out.idea) out = { ...out, idea: a };
    // ...and THE ANSWER goes back to being an answer. A record seeds theme
    // B's LENGTH and its seat and nothing else, because what makes B the
    // answer is its CONTRAST (`answerTheme`: a short call that falls away
    // and opens on the fifth), so its base is that contrast rather than the
    // record's own shape — reset the way it was made, ledger entry and all,
    // so a dim the last take rolled and this one cannot ask (a one-bar
    // theme has no sentence plan) leaves nothing standing behind it.
    if (out.ideaB && out.ideaB.on) {
      const zero = answerTheme();
      let b = out.ideaB;
      for (const dim of ["cell", "sent", "contour", "land"]) {
        const id = "ideaB:" + dim;
        if (isHand(id, b, dim)) continue;
        if (b[dim] === zero[dim] && !(b.answers || {})[dim]) continue;
        const ans = { ...(b.answers || {}) }; delete ans[dim];
        b = { ...b, [dim]: zero[dim], answers: ans };
        drop(id);
      }
      const t = THEMEASK.len[shape.len];
      if (t && t.w && !isHand("ideaB:len", b, "len") && (b.answers || {}).len !== t.w)
        b = Id.answer(b, "len", t.w);
      if (b !== out.ideaB) out = { ...out, ideaB: b };
    }
    return seeded ? { ...out, song: { ...out.song, seeded } } : out;
  };

  function settle(m, gk, plan, take) {
    let out = take > 1 ? rebase(m, plan) : m, genre, tried = false;
    const composed = () => {
      if (!tried) { tried = true;
        try { genre = toSong(out, MODESREF, 0)[0].genre; } catch (e) { genre = null; } }
      return genre;
    };
    for (const seat of SEATS) {
      let notes = null;
      const ids = seatDecisions(out, seat).map((d) => d.id);
      for (const id of ids) {
        const d = seatDecisions(out, seat).find((x) => x.id === id);
        if (!d || handSaid(out, seat, d)) continue;
        // THE FRONT DOOR ANSWERS ITSELF, AND A RECORD MAY NOT ANSWER IT FOR
        // YOU. `when`/`where`/`venue` are facts about the SESSION — what
        // decade it is, what city you are in, what room you are playing —
        // and a record does not know any of them; it is what they add up
        // to. Two answers often call a record on their own ("the fifties ·
        // New York" is jazz and nothing else), and naming the third out of
        // that record's own list would end the door a question early — the
        // page's door asks the first row nobody has answered (ui/band.js
        // doorQ), so a seeded venue is a question you never get asked.
        // Left open here, the door finishes its own three and every one of
        // them is answered by the person who walked through it.
        if (d.three) continue;
        const key = seedKey(seat, id);
        if (take > 1 && MATERIAL[key]) {
          if (notes) { out = noteAll(out, seat, notes); notes = null; }
          const w = rollWord(out, seat, d, take);
          if (w) { out = markSeed(answer(out, seat, id, w), seat, id, "chose"); tried = false; }
          continue;
        }
        if (d.answered) continue;              // the record has already said it
        const w = seedWord(out, seat, d, plan, composed);
        if (!w) continue;
        (notes || (notes = {}))[id] = w;
      }
      if (notes) out = noteAll(out, seat, notes);
    }
    return out;
  }

  // ...what calling a record actually does to the players
  function called(m, gk, prevKey) {
    const was0 = m;                 // ...to stamp what this record decides
    m = stripNamed(m);              // ...the last record's descriptions go
    let d = m.drums, b = m.bass;
    const keep = (ans, list) => ans && list.includes(ans);
    // the groove and the kit the record is made of
    if (!keep((d.answers || {}).groove, gk.grooves)) d = D.answer(d, "groove", gk.grooves[0]);
    // ...AND THE KIT, ON THE SAME LAW AS THE KEYS AND THE GUITAR (2026-08-23).
    // This used to keep whatever kit the drummer happened to be on whenever the
    // record merely ALLOWED it — and since every drummer starts on the acoustic
    // kit and most records list it somewhere, a boom-bap record whose first
    // machine is an 808 arrived on an acoustic kit, a jungle record on an
    // acoustic kit, a jazz date and a bossa likewise. Allowed, and not the kit
    // the record hands you: the identical bug the guitar and keys chairs had
    // fixed in the de-jangle round, still standing here because the kit had no
    // QUESTION and so no answer to be kept. Now it has one, so the same two
    // halves apply — a drummer who ANSWERED keeps their answer, and an
    // unspoken kit follows the record.
    // (Measured: four of the thirty records move — boom-bap to the 808, jungle
    // to the electronic kit, the jazz date to the jazz kit, the bossa to
    // brushes. The other twenty-six name a kit they were already on.)
    const mach = D.catalog(d, null).filter((i) => i.group === "the machine");
    if (!(d.answers || {}).kit) {
      const want = mach.find((i) => i.words[0] === gk.machines[0]);
      if (want) d = D.say(d, want.id);
    }
    // the line and the bass it is played on
    if (!keep((b.answers || {}).job, gk.styles)) b = B.answer(b, "job", gk.styles[0]);
    // THE RECORD'S FIGURE BECOMES THE BASSIST'S OWN. It used to sit only on
    // the genre, so the bass chair showed the STYLE's quarters while an acid
    // line was playing — and writing one note into that bar replaced the
    // acid line with quarters. "The bass drops out on techno." A bassist who
    // has written their own figure keeps it.
    // ...AND THE FIGURE IS THE BAR'S. `figFor` (bass-kit) is the one law
    // both surfaces read: a written-out line re-seats into the bar being
    // counted — "house offbeats" in three is the offbeats of three beats —
    // and the hand-written 303 lines, which mean sixteen places of accent
    // and slide, come back null rather than mangled, so the record's STYLE
    // (a density, which ports) plays instead. Without it a 16-place grid
    // reached a 12-step bar and quietly lost its last four steps.
    const fig = gk.fig && B.figFor(b, B.FIGURES[gk.fig], gk.fig);
    if (fig && !b.fig) b = B.figSet(b, fig);
    // ...and the keys: what they are holding and what they are doing with it
    let kk = m.keys;
    // UNSPOKEN FOLLOWS THE RECORD. Keeping whatever the chair happened to
    // hold if the record merely allows it left a rock band on the clean
    // electric its blank model starts with — allowed, but not the guitar a
    // rock record hands you. A player who ANSWERED keeps their answer.
    const kw = Ky.INSTRUMENTS[kk.instr];
    if (!(kk.answers || {}).instr || !keep(kw, gk.keys || [])) {
      const want = Object.entries(Ky.INSTRUMENTS).find(([, w]) => w === (gk.keys || [])[0]);
      if (want) kk = Ky.answer(kk, "instr", want[1]);
    }
    // ...and the KEYBOARD JOB IS A LIST NOW (`kjobs`, 2026-08-23), whose HEAD
    // is the cast — the same shape `grooves`, `styles` and `machines` have
    // always had, and for the same reason: what a record casts and what a
    // record ALLOWS are two different facts, and only one of them was
    // written down. The cast is unchanged for all thirty records (every
    // list's head is the word that used to be the singular `kjob`), so a
    // called record sounds exactly as it did; the rest of the list is what
    // a take may reach for (rollWord, above).
    if ((gk.kjobs || []).length && !(kk.answers || {}).job)
      kk = Ky.say(kk, "job:" + gk.kjobs[0]);
    // ...and the guitar, the same way: a house record has a guitar chopping
    // the offbeats if it has one at all, and techno has none
    let gg2 = m.guitar;
    // AN ANSWERED GUITAR IS THE PLAYER'S, FULL STOP (2026-08-22). This used to
    // re-cast an answered instrument the moment the new record's `gtr` did not
    // list it — which was invisible while the question only OFFERED that list,
    // and becomes a bug the moment the rack is open (`narrow`/openRack): you
    // pick up harmonics, change the record, and the guitar is silently swapped
    // for something you never said. The UNSPOKEN half of the law is unchanged
    // and is the half that matters — a chair that has not been asked follows
    // the record rather than sitting on the blank model's clean electric.
    // (The keys line above keeps both halves: that rack is still narrowed, so
    // an answer there is always one of the record's own anyway.)
    // ...and the record's own cast is SAID, not ANSWERED (chair.js sayOf
    // touches the model and not the `answers` ledger), which is what makes the
    // two halves separable at all: `answers.instr` now means "the player said
    // this" and nothing else, so the next record can still move an unspoken
    // guitar and can never move a spoken one. It is also what the `gjob` line
    // below has always done.
    if (!(gg2.answers || {}).instr) {
      const want = Object.entries(Gt.INSTRUMENTS).find(([, w]) => w === (gk.gtr || [])[0]);
      if (want) gg2 = Gt.say(gg2, "instr:" + want[0]);
    }
    if (gk.gjob && !(gg2.answers || {}).job) gg2 = Gt.say(gg2, "job:" + gk.gjob);
    if (!keep((b.answers || {}).instr, gk.instr)) b = B.answer(b, "instr", gk.instr[0]);
    // ...and the changes, which are the arranger's own but still have to be
    // changes this record has
    const chg = { ...(m.song.chg || {}) }, answers = { ...(m.song.answers || {}) };
    const lean2 = { ...(m.song.lean || {}) };
    for (const r of CALLED) {
      // the hand's own list is an answered change the record cannot veto —
      // same rank as an answered groove
      if (chgxOf(m, r)) continue;
      const w = B.CHANGEWORD[chg[r]];
      if (chg[r] && !gk.chg.includes(w)) {
        chg[r] = Object.keys(B.CHANGEWORD).find((k) => B.CHANGEWORD[k] === gk.chg[0]);
        answers["chg:" + r] = gk.chg[0];
        delete lean2[r];                 // a lean on changes that left
      }
      // ...and the SAME LAW AS THE FORM for a cycle nobody has called: the
      // standing default is the four-chord one (`m.song.chg[r] ||
      // "fourchord"` at every reader), so an unset cycle moves only where
      // this record refuses that word — a record that has it keeps the
      // quiet default and renders exactly as it always did.
      if (false && !chg[r] && gk.chg && gk.chg.length && !gk.chg.includes(B.CHANGEWORD.fourchord)) {
        chg[r] = Object.keys(B.CHANGEWORD).find((k) => B.CHANGEWORD[k] === gk.chg[0]);
        answers["chg:" + r] = gk.chg[0];
      }
    }
    // THE FORM IS THE RECORD'S TOO. called() moved the groove, the bass,
    // the keys and the changes — and left the form null, which renders as
    // "vamp": a freshly called nocturne played one vamp round and round, a
    // shape its own forms list refuses to offer (the era audit caught it —
    // and rock and jazz had been doing the same thing quietly all along).
    // Same law as the changes: an ANSWERED form this record allows is kept;
    // anything else becomes the record's first form, spoken in the
    // question's own word so the gig sheet shows what was decided.
    // Two cases, and only two: an ANSWERED form the record refuses moves to
    // the record's first; an UNANSWERED form moves only when the implicit
    // vamp default is itself a form this record refuses — a record that
    // allows vamp keeps the quiet default (the slow record's "one hit every
    // four bars" lives on that vamp, and moving it broke the sparseness law).
    let form = m.song.form;
    const allowed = gk.forms || [];
    if ((form && !allowed.includes(form)) ||
        (!form && allowed.length && !allowed.includes("vamp"))) {
      form = allowed[0] || form;
      if (form && FORMS[form]) answers.form = FORMS[form].w;
    }
    return stampSeeds(was0, finish({ ...m, drums: d, bass: b, keys: kk, guitar: gg2,
             song: { ...m.song, form, chg, answers,
                     ...(m.song.lean ? { lean: lean2 } : {}) } }, gk, prevKey));
  }

  /* ---------- WHAT A CALLED RECORD ARRIVES WITH ---------------------------
     `called()` above moves what a record makes a player play. This moves
     the four things nobody was playing at all: the tune, where the band
     sits, the desk and the proportions. Everything it writes is an ANSWER
     on the ordinary ledger — the gig sheet shows it, tapping it re-opens
     the question with that word lit, and the law of the seed (above) means
     a record only ever moves what the LAST record put there.  */
  function finish(m, gk, prevKey) {
    const take = takeOf(m), seed0 = m.song.seeded || {};
    const plan = planOf(m.song.genre, gk);
    const wasGk = prevKey && GENRES[prevKey] ? GENRES[prevKey] : null;
    const was = wasGk ? planOf(prevKey, wasGk) : null;
    // unspoken, or exactly what the last record seated: the record may move
    // it. Anything else is a hand, and a hand outranks a record.
    // ...AND THE LEDGER SAYS SO OUTRIGHT (2026-08-23). The comparison
    // against what the LAST record's plan would have seeded is still here,
    // for sessions saved before `song.seeded` existed; where the ledger has
    // an entry it simply answers the question, which is what lets a take
    // re-derive a value no previous record ever put there.
    const mine = (said, before, seat, id) => !said
      || (seat && seed0[seedKey(seat, id)])
      || (before != null && said === before);
    let out = m;

    /* --- the tune -------------------------------------------------------
       Six answers, in the ideas module's own words, on whichever theme the
       record has. Theme B, when a record carries one, keeps its CONTRAST
       (a short call that falls away and opens on the fifth — answerTheme)
       and takes only the two facts that make it the same record's answer:
       how long it is and where it sits. */
    const shape = THEMES[plan.theme] || THEMES.topline;
    const before = was ? (THEMES[was.theme] || THEMES.topline) : null;
    const wordOf = (dim, sh) => { const t = THEMEASK[dim][sh[dim]]; return t ? t.w : null; };
    let idea = out.idea;
    for (const dim of ["len", "cell", "sent", "contour", "land", "reg"]) {
      const w = wordOf(dim, shape);
      if (!w) continue;
      if (!mine((idea.answers || {})[dim], before ? wordOf(dim, before) : null,
                "arranger", "idea:" + dim)) continue;
      idea = Id.answer(idea, dim, w);
    }
    if (idea !== out.idea) out = { ...out, idea };
    if (out.ideaB && out.ideaB.on) {
      let b2 = out.ideaB;
      for (const dim of ["len", "reg"]) {
        const w = wordOf(dim, shape);
        if (!w) continue;
        if (!mine((b2.answers || {})[dim], before ? wordOf(dim, before) : null,
                  "arranger", "ideaB:" + dim)) continue;
        b2 = Id.answer(b2, dim, w);
      }
      if (b2 !== out.ideaB) out = { ...out, ideaB: b2 };
    }

    /* --- where the band sits, inside the instruments' own compasses ----- */
    const SEATOF = { bass: B, keys: Ky, guitar: Gt, voice: Vo };
    for (const chair of ["bass", "keys", "guitar", "voice"]) {
      const want = (plan.seat || {})[chair];
      if (!want) continue;
      const wasWant = was && was.seat ? was.seat[chair] : null;
      const cm = out[chair];
      if (!cm || !mine((cm.answers || {}).reg, wasWant, chair, "reg")) continue;
      const w = fitReg(chair, want, cm.instr);
      const nx = SEATOF[chair].answer(cm, "reg", w);
      if (nx !== cm) out = { ...out, [chair]: nx };
    }

    /* --- the desk ------------------------------------------------------- */
    const desk = DESKS[plan.desk] || DESKS.garage;
    const wasDesk = was ? (DESKS[was.desk] || DESKS.garage) : null;
    const eng = { ...(out.eng || {}) };
    let moved = false;
    for (const d of ENG) {
      if (!DESKBOARD.includes(d.id)) continue;
      const w = desk[d.id];
      if (!w || !d.opts.some((o) => o.w === w)) continue;
      if (!mine(eng[d.id], wasDesk ? wasDesk[d.id] : null, "engineer", d.id)) continue;
      if (eng[d.id] === w) continue;
      eng[d.id] = w; moved = true;
    }
    if (moved) out = { ...out, eng };

    /* --- the proportions, and how fast the chords move ------------------ */
    const props = PROPS[plan.props] || PROPS.tight;
    const wasProps = was ? (PROPS[was.props] || PROPS.tight) : null;
    const lens = { ...(out.song.lens || {}) };
    const answers = { ...(out.song.answers || {}) };
    let song = out.song, touched = false;
    for (const role of CALLED) {
      const k = props[role];
      if (!k || !LENS[k]) continue;
      if (!mine(answers["len:" + role], wasProps && wasProps[role]
        ? (LENS[wasProps[role]] || {}).w : null, "arranger", "len:" + role)) continue;
      if (lens[role] === k) continue;
      lens[role] = k; answers["len:" + role] = LENS[k].w; touched = true;
    }
    // ...and the harmonic rate, only where the idiom is emphatic about it
    // AND the record's own `hrw` leaves that word standing
    const hrw = plan.hr;
    if (hrw) {
      const k = Object.keys(HRATE).find((x) => HRATE[x].w === hrw);
      const allowed = !gk.hrw || gk.hrw.includes(hrw);
      if (k && allowed &&
          mine(answers.hr, was && was.hr ? was.hr : null, "arranger", "hr") && song.hr !== k) {
        song = { ...song, hr: k }; answers.hr = hrw; touched = true;
      }
    }
    if (touched || song !== out.song)
      out = { ...out, song: { ...song, lens, answers } };
    // ...and the rest of the sheet (5, above): every question this record
    // has not answered yet gets the word for what it already is.
    return settle(out, gk, plan, take);
  }

  /* ---------- the three seats, one question at a time ----------
     NARROWED, NOT DECIDED. The genre says which grooves, which machines,
     which lines and which instruments are on the table; the player still
     picks. A filter that would leave fewer than two answers is dropped
     whole — at that point it is not a constraint, it is the arranger
     playing the drums. */
  // (THREE RECORDS GAINED A WORD with the new guitars, 2026-08-22, APPENDED
  // only: rock and punk name the re-amped DI, and the slow one names
  // harmonics. `gtr[0]` is the one entry that decides anything — it is the
  // guitar `called()` casts on a chair that has not spoken — so appending
  // moves no render, and what it does move is which side of the rack's two
  // rows a word is drawn under.)
  const WORDSOF = { groove: "grooves", job: "styles", instr: "instr", form: "formw",
                    hr: "hrw" };
  // the keys chair asks "what are you playing?" under the same id the bass
  // does, so the narrowing table is per SEAT, not per question id alone
  const KEYSOF = { instr: "keys" }, GTROF = { instr: "gtr" };
  /* THE RECORD RECOMMENDS, IT DOES NOT JAIL — the guitar rack, 2026-08-22
     ("give me lots more guitar options rather than the three you offer").

     The law above is right for a groove and wrong for a RACK. Narrowing keeps
     a record coherent, and a record's `gtr` is three or four words, so the
     guitarist saw three or four of the ten guitars in the room and had no way
     to reach the rest — `narrow` only drops a filter when it would leave fewer
     than TWO answers, and three is plenty by that test. Measured before this:
     house 3 of 8, jazz 3, blues 3, bossa 3, rock 4. The instruments a genre
     hides are not off the table the way a drum machine that had not been
     invented yet is; a guitarist in a jazz club can pick up a distorted one,
     and the record simply has an opinion about it.

     So the record's picks come FIRST, under a label in the house voice, and
     the rest of the rack follows under a second one. Everything stays ONE
     radio group and the record's own first pick is still the head of the list
     — which is the same answer `called()` casts — so nothing about what a
     record SOUNDS like moved; only what it will let you say. The row words are
     ui/band.js's `.drowlab` mechanism, already carried by every option
     (chair.js `instrRows`) and already drawn full-width by the radio grid;
     `ROWORDER` does not name these two, so the grid's sort is a no-op across
     them and this order stands.

     GUITAR ONLY, deliberately — and that stood for one day. The note here read
     "the same courtesy would be one line each for keys and bass, and it is NOT
     taken: the keys rack is 17 words and the record's four are a genuinely
     useful cut of it, so opening that one is a design question about a longer
     list, asked separately." It was asked, and answered, the next morning: see
     EVERY RACK, OPEN below. */
  /* ---------- EVERY RACK, OPEN (2026-08-23) --------------------------------
     "Similar to guitar give me all choices for keys and all instruments and
     kits" — the artist, on seeing the guitar rack opened. The mechanism below
     was written guitar-only and the note above said the same courtesy for keys
     and bass was "a design question about a longer list, asked separately".
     This is that question, answered: the keys rack is 31 words now and a
     record showed 4 of them, the bass rack is 11 and a record showed 2, and
     the drummer had no kit question AT ALL — ten kits reachable only by typing
     at the word tray. Measured before this round, on a jazz date: keys 4 of
     17, bass 2 of 5, kit 0 of 10.

     THE DRUMMER'S HALF IS A QUESTION, NOT A CAST. Every record already
     declares `machines` and `called()` already seeds one from it, so a house
     record has been playing a 909 all along — what was missing was the ROW.
     drums-kit.js DECISIONS now asks it, and the record's own two or three are
     the head of the list here, exactly as the guitar's are.

     ONE CHANGE TO THE MECHANISM, and it is about the row labels. The keys rack
     already groups itself (pianos: · organs: · bells & mallets: · …), which is
     what makes thirty-one words readable, and stamping "the rest of the rack:"
     over all of it would have thrown that away to say something less useful.
     So the RECORD'S OWN half takes the new label and the REST KEEPS THE ROW IT
     ALREADY HAD — a rack with no families of its own (guitar, bass) falls back
     to "the rest of the rack:" and reads exactly as the guitar rack shipped.
     ui/band.js ROWORDER names both new labels so the record's own sorts first
     and the fallback sorts last; the family labels keep their old places in
     between. */
  const RACKROWS = { own: "the record's own:", rest: "the rest of the rack:" };
  const openRack = (d, want) => {
    const w = want || [];
    const rank = (o) => { const i = w.indexOf(o.w); return i < 0 ? w.length : i; };
    const own = d.opts.filter((o) => w.includes(o.w))
      .sort((a, b) => rank(a) - rank(b))
      .map((o) => ({ ...o, row: RACKROWS.own }));
    // ...and the REST STAYS GROUPED. A rack with families interleaves once the
    // record's own picks are lifted out of it (jazz took a piano, a Rhodes, an
    // upright and an organ, which is three of the four keyboard families), and
    // the page's ROWORDER sort hid that while every other reader — the gig
    // sheet, the fingerprint gate, anything that walks `opts` — saw the
    // interleaving. So the grouping is done HERE, in first-appearance order,
    // and the page's sort becomes a no-op over an already-grouped list.
    const rest = [], seen = [];
    for (const o of d.opts) {
      if (w.includes(o.w)) continue;
      const row = o.row || RACKROWS.rest;
      if (!seen.includes(row)) seen.push(row);
      rest.push({ ...o, row });
    }
    rest.sort((a, b) => seen.indexOf(a.row) - seen.indexOf(b.row));
    // a record whose picks are the whole rack (or none of it) gets no labels:
    // a row heading over every option says nothing
    if (!own.length || !rest.length) return d;
    return { ...d, opts: [...own, ...rest] };
  };
  // WHICH LIST A SEAT'S RACK IS RECOMMENDED FROM. One row per seat that has a
  // rack and a record with an opinion about it; a seat missing here is a seat
  // whose rack was never narrowed in the first place (the singer: five voices,
  // and no record names a subset of them).
  // (the drummer's list is `machines`, which every record has declared since
  // the day it was written and which `called()` already casts from — the kit
  // was record-idiomatic all along and simply had no QUESTION to be asked in)
  // ...and THE BOARD IS A RACK TOO (2026-08-23). Eleven inserts, offered per
  // chair, none of them recommended by any record — every record in this box
  // plays every instrument straight in, which is what it has always sounded
  // like, so the dry word is the head of every board and openRack is a no-op
  // over it (`own` is the whole list). What the row IS here for is the second
  // half of the same law: one field, distinct values, so the pruner must not
  // compose the record once per pedal to find that out.
  const RACKOF = { guitar: { instr: (gk) => gk.gtr, pedal: () => null },
                   keys: { instr: (gk) => gk.keys, pedal: () => null },
                   bass: { instr: (gk) => gk.instr, pedal: () => null },
                   drums: { kit: (gk) => gk.machines },
                   // the singer's rack is not recommended from anything (no
                   // record names a subset of five voices), and it is still a
                   // RACK — which is what the row below is for
                   voice: { instr: () => null, pedal: () => null } };
  /* ---------- A RACK IS DISTINCT BY CONSTRUCTION -------------------------
     THE PRUNER WAS COMPOSING THE RECORD ONCE PER INSTRUMENT. `heardOptsNow`
     drops an answer that would change nothing, and it finds that out by
     rendering — which is right for a row whose two words might land on the
     same record and pure cost for a rack, where every word casts a DIFFERENT
     INSTRUMENT and a different instrument is a different recording or a
     different patch. Measured over all 30 records, walking every seat: 119
     rack rows, 5,236 options, and NOT ONE option pruned. Opening the racks
     multiplied that by three (a jazz date's keys row went from 4 renders to
     31), which is exactly the cost the de-rendering round exists to stop.
     So the rows declare what they write, the way askable's knob rows do.

     CHECKED, NOT ASSERTED — the same law `knobDistinct` is held to, and for
     the same reason: this is a claim about a table in another file. The claim
     is read off the row it is about — every word in the row is one of the
     chair's own, and the chair's id->word table is a bijection, so two
     different words are two different instruments — and a row that fails it
     simply pays for itself. What the claim does NOT say is that two
     instruments SOUND different; that is a fact about the engine, and it is
     held where it belongs, in test/unit/rack-identity.test.js, which renders
     the recipe for every word in every rack and holds them byte-distinct. */
  const boardWords = (K2) => { const out = {};
    for (const [k, p] of Object.entries(K2.PEDALS || {})) out[k] = p.w;
    return out; };
  const RACKTAB = { "keys/instr": () => Ky.INSTRUMENTS, "guitar/instr": () => Gt.INSTRUMENTS,
                    "bass/instr": () => B.INSTRUMENTS, "voice/instr": () => Vo.INSTRUMENTS,
                    "drums/kit": () => D.MACHINES,
                    "keys/pedal": () => boardWords(Ky), "guitar/pedal": () => boardWords(Gt),
                    "bass/pedal": () => boardWords(B), "voice/pedal": () => boardWords(Vo) };
  const CHEAPRACK = new Map();
  const rackCheap = (seat, d) => {
    if (!(RACKOF[seat] || {})[d.id]) return false;
    const key = seat + "/" + d.id;
    if (CHEAPRACK.has(key)) return CHEAPRACK.get(key);
    const tab = (RACKTAB[key] || (() => null))();
    const words = tab ? Object.values(tab) : [];
    const mine = d.opts.map((o) => o.w);
    const out = !!words.length && new Set(words).size === words.length &&
      new Set(mine).size === mine.length && mine.every((w) => words.includes(w));
    CHEAPRACK.set(key, out);
    return out;
  };
  const markRacks = (seat, ds) => ds.map((d) =>
    (rackCheap(seat, d) ? { ...d, cheap: true } : d));
  const narrow = (m, seat, ds) => {
    const gk = genreOf(m);
    if (!gk) return ds;
    // the forms this record has, as the words the question offers
    const formw = (gk.forms || []).map((k) => FORMS[k] && FORMS[k].w).filter(Boolean);
    return ds.map((d) => {
      const rack = (RACKOF[seat] || {})[d.id];
      if (rack) return openRack(d, rack(gk));
      const keep = d.id === "form" ? formw
        : seat === "keys" ? gk[KEYSOF[d.id]]
        : seat === "guitar" ? gk[GTROF[d.id]]
        : gk[WORDSOF[d.id]];
      if (!keep) {
        // ...and the changes the arranger calls are the genre's own
        if (!d.id.startsWith("chg:") || !gk.chg) return d;
        const o2 = d.opts.filter((o) => gk.chg.includes(o.w));
        return o2.length >= 2 ? { ...d, opts: o2 } : d;
      }
      const opts = d.opts.filter((o) => keep.includes(o.w));
      return opts.length >= 2 ? { ...d, opts } : d;
    });
  };
  /* ---------- THE DICE -----------------------------------------------------
     A whole record by answering every question at random — which is only
     possible because the graph is complete: every question has at least two
     answers, every answer leaves something playable, and nothing can be
     answered into a dead end. So the dice is not a special path through the
     app, it is the ORDINARY path taken quickly, and if it can produce an
     unplayable record then so can a person.

     `rnd` is injectable so a gate can seed it: the same seed makes the same
     record, which is what lets a thousand of them be checked. */
  function randomSong(rnd) {
    const R = rnd || Math.random;
    const pick = (a) => a[Math.floor(R() * a.length) % a.length];
    let m = { ...blank(), on: true };
    // where and when: the front door, whose options never lead to nothing
    for (const [f] of FIELDS3) {
      const opts = openOf(m.song, f);
      if (opts.length) m = answer(m, "arranger", f, pick(opts));
    }
    if (!m.song.genre) {                       // several records still fit: call one
      const left = survivors(m.song);
      if (left.length) m = answer(m, "arranger", "genre", pick(left)[1].w);
    }
    // then every chair, question by question, until nobody has anything left.
    // The UNPRUNED list on purpose: pruning asks what every answer would
    // sound like before offering it, which is right for a person choosing
    // and pure cost for a dice that is about to choose anyway (measured,
    // 640 ms a roll against 90).
    for (const seat of SEATS)
      for (let round = 0; round < 3; round++) {
        // ...and a RECORD'S answer is still on the table for the dice: a
        // seeded sheet is a finished record, not a finished session, and a
        // dice that skipped every seeded row would roll the same record
        // thirty ways.
        const left = seatDecisions(m, seat).filter((d) => !d.answered
          || (m.song.seeded || {})[seedKey(seat, d.id)] === "named");
        if (!left.length) break;
        for (const d of left) if (d.opts.length) m = answer(m, seat, d.id, pick(d.opts).w);
      }
    // ...THE HAND ON THE DICE (PLAN.md THE THROUGH-COMPOSED THEME): the
    // composer's powers are ordinary answers, so the dice reaches them the
    // ordinary way — the lean and the wrap questions are interview rows the
    // loop above already rolls. Two powers are VOCABULARY (a hand's marks),
    // so the dice says those words itself: sometimes it writes one bar of
    // the tune out (the same seeded-from-what-you-heard path a person taps),
    // and rarely it authors a role's changes whole, 3–8 bars through the
    // same public setChanges the picker uses — measured over 300 seeded
    // rolls: ~45 write a bar, ~40 author changes.
    if (R() < 0.25 && Id.barsOf(m.idea) > 1) {
      const b = 1 + Math.floor(R() * (Id.barsOf(m.idea) - 1));
      let idea = Id.say(m.idea, "bar:" + b);
      idea = Id.say(idea, "note:" + Math.floor(R() * Id.NOF(m.idea)));
      m = { ...m, idea };
    }
    if (R() < 0.12) {
      const roles = rolesIn(m);
      if (roles.length) {
        const r = roles[Math.floor(R() * roles.length)];
        const n = 3 + Math.floor(R() * 6);
        // ...and A HAND WRITING CHANGES WRITES A PHRASE. Rolling n bars of n
        // different roots is the one place the dice was still manufacturing
        // the fault HRATE exists to end (a new chord at every barline, which
        // 1.3% of real records do). So a bar sometimes holds the one before
        // it — measured against the corpus's own pooled shape, where 60% of
        // chords last a bar and 21% last two.
        const list = [];
        for (let b = 0; b < n; b++)
          list.push(b && R() < 0.4 ? list[b - 1].map((x) => ({ ...x }))
                                   : [{ d: Math.floor(R() * 7) }]);
        // ...and sometimes its last bar leans home — the turnaround, as data
        if (R() < 0.5) list[n - 1] = [dominantOf(list[0][0], modeArrOf(m))];
        m = setChanges(m, r, list);
      }
    }
    // ...and an arrangement: about half the sections get one thing said
    // about them, which is what makes two dice rolls different records
    const secs = toSong(m, MODESREF);
    for (let i = 0; i < secs.length; i++) {
      if (R() < 0.5) continue;
      const asks = sectionAsks(m, i, true);   // raw: a dice does not need pruning
      if (!asks.length) continue;
      const a = pick(asks);
      const o = pick(a.opts);
      if (o) m = setSection(m, i, a.id, o.key);
    }
    // A ROLLED ANSWER MUST BE HEARD. The dice answers "a second theme
    // answers it" like any other question, but assignment lives on the
    // section node — and measured over 52 rolls, 22 composed a B and 0
    // sections ever named it: a theme that exists only in the model is not
    // a structure, it is a file. So when this roll composed one and no
    // section (rolled above, or a hand's later answer — which overwrites
    // this exactly as it overwrites any dice answer) carries it, the dice
    // gives it the CONTRAST section, which is what an answer is for: the
    // bridge where the form has one, else the last theme-carrying section
    // of the form — never the ONLY one, which would erase the tune to play
    // its answer. A section whose role brought no taker gets the chorus's
    // own ("keys", ROLE above). And a form with no room for a second theme
    // — one place a melody can sound — honestly rolls "one theme is
    // plenty" instead of composing an answer nobody will hear.
    if (m.song.themeB && m.ideaB && m.ideaB.on) {
      const fsecs = secsOf(m);
      const takes = fsecs.map((_, i) => {
        const p = partOf(m, i); return !!p.idea && p.idea !== "no";
      });
      const bAt = fsecs.findIndex((_, i) => ((m.per || {})[i] || {}).theme === "b");
      if (bAt >= 0) {
        // the roll already placed it — seat a taker there if the role
        // brought none, so the placement is a sound and not a label
        if (!takes[bAt]) m = setSection(m, bAt, "idea", "keys");
      } else {
        let home = fsecs.indexOf("bridge");
        if (home < 0) {
          const carriers = takes.reduce((a2, t, i) => (t ? a2.concat(i) : a2), []);
          home = carriers.length > 1 ? carriers[carriers.length - 1] : -1;
        }
        if (home >= 0) {
          m = setSection(m, home, "theme", "b");
          if (!takes[home]) m = setSection(m, home, "idea", "keys");
        } else m = answer(m, "arranger", "second", "one theme is plenty");
      }
    }
    return allSeeded(m);
  }

  // START OVER, one chair at a time. A session where the only way back is
  // reloading the page is a session you stop experimenting in.
  function resetSeat(m, seat) {
    // ...and the record's own marks on that chair go with it: a reset chair
    // has nothing on its ledger for a take to re-roll or a record to move
    const s2 = m.song.seeded;
    if (s2 && Object.keys(s2).some((k) => k.startsWith(seat + "/"))) {
      const next = {};
      for (const k of Object.keys(s2)) if (!k.startsWith(seat + "/")) next[k] = true;
      m = { ...m, song: { ...m.song, seeded: next } };
    }
    if (seat === "drums") return { ...m, drums: D.say(D.blank(), "start") };
    if (seat === "keys") return { ...m, keys: Ky.say(Ky.blank(), "start") };
    if (seat === "guitar") return { ...m, guitar: Gt.say(Gt.blank(), "start") };
    if (seat === "voice") return { ...m, voice: Vo.say(Vo.blank(), "start") };
    if (seat === "bass") return { ...m, bass: B.say(B.blank(), "start") };
    if (seat === "engineer") return { ...m, eng: {} };
    // the arranger's own reset takes the tune back but leaves the players
    // where they are — and the per-section arrangement goes with the form
    return { ...m, song: { ...blank().song }, per: {} };
  }
  /* ---------- AN ANSWER THAT CHANGES NOTHING IS NOT AN ANSWER -------------
     Two words that make the identical take are one answer wearing two hats,
     and a question whose options all make the same take is a question with
     one answer — "why ask?". The trees are walked by a gate now
     (test/unit/question-trees.test.js) and that gate found eighteen of them
     across six chairs, every one a real thing you could tap twice for the
     same music.

     The signature is the FIRST section only, and no kernel render: that is
     enough to tell answers apart (a part, a phrase, a register, a tone, a
     desk offset, a tempo) and cheap enough to run on every draw. */
  const SIGS = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function sigOf(m) {
    // a model is immutable here — every word returns a new object — so the
    // signature of one can be remembered for as long as it exists. Without
    // this the trees are re-rendered once per option per draw, which
    // measured at minutes for a full walk.
    if (SIGS && SIGS.has(m)) return SIGS.get(m);
    const out = sigNow(m);
    if (SIGS) SIGS.set(m, out);
    return out;
  }
  /* ---------- THE SIGNATURE, IN PARTS ------------------------------------
     A question only ever moves PART of a record, and comparing the parts it
     cannot reach is most of what the pruner was spending. So the signature
     is declared in five pieces — which is also what makes the cheap prunes
     below provable, since a piece is exactly "somewhere the record is read
     VERBATIM":

       SEC    the composed first section — the expensive one, a whole toSong
       MIX    the desk, `mixOf(m)`: the only thing `m.eng` reaches
       MEL    the tune and its answer, as phrases
       SONG   the song fields printed BY NAME — `SONGSIG`, below
       TONE   the three chairs whose `tone` is printed beside them

     `sigNow` prints them in the order it has always printed them, so the
     string is byte-identical to the one every gate has ever compared; what
     is new is that a caller may ask for one piece. */
  // the song fields the signature prints by name, in print order. THE LIST
  // IS THE PROOF: a question whose answers write only these fields is
  // decided by SONG alone, so `songRow` below reads this same array rather
  // than a second copy of it that could drift.
  const SONGSIG_A = ["bpm", "swing", "meter", "key", "minor", "space",
                     "form", "chg", "end"];
  // ...and the song facts the FIRST section cannot show: a length, a
  // reprise, the doors, a lean or an authored list on a role that is
  // not section 0's. Blind here, the pruner retired real questions —
  // "how long is the chorus?" was invisible the day this list missed
  // `lens`.
  const SONGSIG_B = ["lens", "reprise", "doors", "lean", "chgx"];
  // the ones printed as `|| null`, so an absent field and a false one read
  // exactly as they always did
  const SONGNULL = new Set(["meter", "end", "lens", "reprise", "doors",
                            "lean", "chgx"]);
  // ...and THE BOXES, for the same reason: a record whose sections have
  // been edited by hand has a shape its form label no longer names, and
  // blind here the pruner retired the one tap that puts a FORMS row
  // back (same form, different boxes, "nothing changed")
  const SONGSIG = new Set([...SONGSIG_A, ...SONGSIG_B, "secs"]);
  const songPart = (m) => SONGSIG_A.map((k) =>
    (SONGNULL.has(k) ? (m.song[k] || null) : m.song[k]));
  const songPart2 = (m) => [...SONGSIG_B.map((k) => m.song[k] || null),
                            cleanSecs(m.song.secs) || null];
  /* ...AND WHICH BASS IS IN THE ROOM (2026-08-23). Every other chair's
     instrument reaches this signature through the composed section — the two
     pitched chairs on the genre's `chairs` seam, the singer on their own
     layer, the drummer as `drumkit` — and the BASSIST'S did not, because the
     bass instrument is not a score fact at all: it is cast through the song's
     INSTRUMENT POOL (ui/band.js setPoolChair, audio/plan.js `POOL.bass`), one
     layer above anything toSong writes. So the signature was blind to it, and
     the pruner is the signature: measured on the shipped file, the bassist's
     "what are you playing it on?" was dropped ENTIRELY — five basses, four of
     them pruned as changing nothing and the fifth left alone in a row that is
     then not worth asking, so the question never appeared. The rack was not
     narrow, it was gone. (question-trees says the same thing from the other
     side once the row is restored: "with a pick" and "fingers on a P-bass"
     make the identical take.)
     One field on the signature, and it is the honest one: what the page
     actually casts. */
  const tonePart = (m) => [m.keys.tone, m.guitar.tone, m.bass.tone, m.bass.instr,
    // ...and WHAT IS ON EACH BOARD, for exactly the reason the bass instrument
    // is here: a pedal is carried on the chair's `tone.pedals` and spent by
    // audio/to-engine's recipe, which is a layer above anything toSong writes,
    // so without this line the signature is blind to it and the pruner eats
    // the whole row. (The singer's board reaches the signature through their
    // own layer — secPart prints `s0.voice` — and is printed here too so all
    // four read the same way.)
    m.keys.pedal, m.guitar.pedal, m.bass.pedal, m.voice.pedal];
  const melPart = (m) => [Id.toPhrase(m.idea), Id.regOf(m.idea),
    // ...and the answer, when there is one — without it every question
    // about theme B would look like it changed nothing and be pruned
    m.ideaB && m.ideaB.on ? [Id.toPhrase(m.ideaB), Id.regOf(m.ideaB)] : null];
  function secPart(m) {
    let s0;
    try { s0 = toSong(m, MODESREF, 0)[0]; } catch (e) { return null; }
    if (!s0) return null;
    const g = s0.genre;
    // A SILENT LANE IS NOT A LANE. `{h:[0,0,…]}` and `{}` are the same drum
    // part and different objects, and comparing the objects said two answers
    // differed when the record did not — which is exactly the lie this
    // signature exists to catch.
    const norm = (kit) => Object.fromEntries(Object.entries(kit || {})
      .filter(([, v]) => (Array.isArray(v) ? v.some(Boolean) : !!v)));
    const g2 = { ...g, kit: norm(g.kit), kits: (g.kits || []).map(norm) };
    return [
      genreSig(g2), s0.pattern, s0.guitar, s0.box,
      s0.melody ? [s0.melody.phrase, genreSig(s0.melody.genre)] : null,
      // ...and the singer, who is a layer of their own. Left out of this,
      // every question the singer has looked like it changed nothing and was
      // pruned away — the chair existed and was never asked anything.
      s0.voice ? [s0.voice.phrase, genreSig(s0.voice.genre)] : null];
  }
  function sigNow(m) {
    const sec = secPart(m);
    if (!sec) return "?";
    return JSON.stringify([...sec, mixOf(m), ...melPart(m),
      ...songPart(m), ...tonePart(m), ...songPart2(m)]);
  }
  // the MODES table toSong needs, remembered from the first call the page or
  // a gate makes — the kits are pure and this file never imports genres.js
  let MODESREF = null;
  const HEARD = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  const heardOpts = (m, seat, d) => {
    if (HEARD) {
      let per = HEARD.get(m);
      if (!per) HEARD.set(m, per = {});
      const key = seat + "\u0000" + d.id;
      if (per[key]) return per[key];
      return (per[key] = heardOptsNow(m, seat, d));
    }
    return heardOptsNow(m, seat, d);
  };
  /* ---------- WHAT A QUESTION CAN MOVE, DERIVED ---------------------------
     THE PRUNER WAS RENDERING THE WHOLE RECORD PER OPTION PER DRAW. Measured
     on one called record: 83 questions, 414 options, and 325 full `toSong`
     renders every time the chair rail was drawn — because "distinct by
     construction" was a flag somebody remembered to set (`cheap`, on four
     knob rows) rather than something the code worked out.

     A question cannot move what its answer does not write, so a row only
     has to be compared on the PARTS above its answers can reach. Three of
     the four narrowings are proofs and the fourth is measured:

       the engineer   `answerNow` writes `m.eng` and nothing else, and
                      `m.eng` reaches the signature only through `mixOf`
                      (toSong never reads the desk — mixOf's only other
                      caller is the page). So MIX decides these rows
                      EXACTLY, drops included: the four toggle-set rows go
                      on losing the options they always lost, because a
                      cheaper signature here is the same signature.
       a song row     a row every one of whose answers writes only fields
                      SONGSIG names is decided by SONG alone, for the same
                      reason — the pieces it cannot write are equal on both
                      sides of the comparison. Which rows those are is
                      MEASURED, once per row, by running the row's own
                      applies and diffing (`songRow`); it is not a list.
                      That is what keeps "where does it go?" honest: `arc`
                      writes a field the signature does NOT print, so it
                      still renders, and it still drops the answers a flat
                      arc makes identical.
       a chair        `answerNow` writes `m[seat]`, which reaches the
                      signature through the composed section and through
                      the three printed `tone`s — so SEC+TONE, and a
                      drummer's question stops re-deriving the tune, the
                      desk and the song facts once per option.
       the tune       the melody's own questions are pruned against the
                      PHRASE — `Id.toPhrase`/`regOf`, the same pure calls
                      the signature already prints, instead of composing a
                      section around them. This one is measured rather than
                      proved: over 30 records and 12 dice rolls, 281 rows,
                      the same options in the same order.  */
  const sigMix = (m) => JSON.stringify(mixOf(m));
  const sigMel = (m) => JSON.stringify(melPart(m));
  // ...remembered per model, exactly as the whole signature is (`SIGS`),
  // and as a STRING for the same reason: a model is immutable, and a
  // WeakMap holding the composed objects instead would keep a section's
  // worth of arrays alive for every option the pruner ever tried.
  const SIGC = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  const sigChair = (m) => {
    if (SIGC && SIGC.has(m)) return SIGC.get(m);
    const sec = secPart(m);
    const out = sec ? JSON.stringify([...sec, ...tonePart(m)]) : "?";
    if (SIGC) SIGC.set(m, out);
    return out;
  };
  const sigSong = (m) => JSON.stringify([...songPart(m), ...songPart2(m)]);
  // WHICH ROWS ARE SONG ROWS, MEASURED ONCE. The applies are pure functions
  // of the song, so one record answers the question for every record: a row
  // is a song row when every answer it offers writes only fields the
  // signature prints by name. Remembered against the row's own words, so a
  // row whose options were narrowed away is asked again rather than
  // inheriting a wider row's verdict.
  const SONGROW = new Map();
  const rowKey = (seat, d) => seat + "\u0000" + d.id + "\u0000" +
    d.opts.map((o) => o.w).join("\u0001");
  const songRow = (m, d) => {
    const key = rowKey("arranger", d);
    if (SONGROW.has(key)) return SONGROW.get(key);
    let out = true;
    for (const o of d.opts) {
      if (!o.apply || o.idea) { out = false; break; }
      let s2;
      try { s2 = o.apply(m.song); } catch (e) { out = false; break; }
      if (!s2 || typeof s2 !== "object") { out = false; break; }
      for (const k of new Set([...Object.keys(s2), ...Object.keys(m.song)]))
        if (!SONGSIG.has(k) && s2[k] !== m.song[k]) { out = false; break; }
      if (!out) break;
    }
    SONGROW.set(key, out);
    return out;
  };
  const sigFor = (m, seat, d) => {
    if (seat === "engineer") return sigMix;
    if (seat !== "arranger") return sigChair;
    if (d.id.startsWith("idea:") || d.id.startsWith("ideaB:")) return sigMel;
    return songRow(m, d) ? sigSong : sigOf;
  };
  const heardOptsNow = (m, seat, d) => {
    // A NARROWING QUESTION IS WORTH ASKING BEFORE IT CHANGES ANYTHING.
    // "What decade is it?" moves no note until the three answers collapse to
    // one record — and the pruner, which drops answers that change nothing,
    // ate the whole front door. Its options are already only the ones that
    // leave a record standing, which is the same law by a different route.
    if (d.three || d.cheap) return d.opts;   // distinct by construction
    const sig = sigFor(m, seat, d);
    const now = sig(m);
    const seen = new Map();
    // ...and ONCE PER OPTION. The two passes below both ask what an answer
    // would sound like, and `answer` hands back a new model each time, so
    // every option the standing answer's pass touched was composed twice —
    // on a called record, where every row has a standing answer, that was a
    // whole extra record per question.
    const SIG = new Map();
    const sigOpt = (o) => {
      if (SIG.has(o)) return SIG.get(o);
      let out;
      try { out = sig(answer(m, seat, d.id, o.w)); } catch (e) { out = null; }
      SIG.set(o, out);
      return out;
    };
    // TWO PASSES, because the standing answer is not first in the list. The
    // word you are on registers its take BEFORE anything is filtered, so an
    // option earlier in the row that lands on the same record is dropped
    // behind it rather than surviving by arriving first.
    for (const o of d.opts) {
      if (!o.answered && !o.active) continue;
      const sig = sigOpt(o);
      if (sig && sig !== now) seen.set(sig, o.w);
    }
    return d.opts.filter((o) => {
      const sig = sigOpt(o);
      if (sig == null) return true;
      // THE STANDING ANSWER IS ALWAYS OFFERED — you can always see the word
      // you are on — but it is no longer INVISIBLE to the dedupe: it puts
      // its own take in the map, so a second option that lands on the same
      // record is dropped behind it. Before this the lit word skipped the
      // map entirely, and a question whose only other answer was a
      // different spelling of the one already given still read as a real
      // fork (measured: a romantic symphony's "a processional" and "nobody
      // on the kit", which compose to the same silent kit). Invisible while
      // a called record's groove was simply never asked again; the moment
      // every question is asked, it is the difference between a question
      // and a wall with two doors into the same room.
      if (o.answered || o.active) return true;
      if (sig === now || seen.has(sig)) return false;
      seen.set(sig, o.w);
      return true;
    });
  };

  // MEMOISED PER MODEL. A model is immutable — every word returns a new
  // object — so a chair's question list for one model is a fact, and both
  // the page (five chairs, every draw) and the gates (a walk that asks the
  // same model several times) recompute it otherwise. Measured: nextAsk was
  // 6.8 ms, and most of it was rebuilding lists it had already built.
  const DEC = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  const seatDecisions = (m, seat) => {
    if (DEC) {
      let per = DEC.get(m);
      if (!per) DEC.set(m, per = {});
      if (per[seat]) return per[seat];
      const out = seatDecisionsNow(m, seat);
      per[seat] = out;
      return out;
    }
    return seatDecisionsNow(m, seat);
  };
  // THE ANNOTATED KNOBS. One row per kernel field (askable.js) says which
  // chair is asked and what the answers are; the value lands on the song and
  // is merged into every section's genre. Distinct by construction — one
  // field, distinct values — so the pruner never has to render a section to
  // know two of these answers differ, which is what makes them free.
  // ...and CHECKED, not asserted (2026-08-23). `cheap: true` was written on
  // this row by hand, which is a claim about a table in another file: the
  // day askable.js grows a row that says the same thing twice, the pruner
  // would go on believing the hand. So the claim is read off the row it is
  // about, once per field, and a row that fails it simply pays for itself.
  const KNOBD = new Map();
  const knobDistinct = (row) => {
    if (KNOBD.has(row.field)) return KNOBD.get(row.field);
    const seen = new Set();
    let out = true;
    for (const [, v] of row.opts) {
      const k = JSON.stringify(v === undefined ? null : v);
      if (seen.has(k)) { out = false; break; }
      seen.add(k);
    }
    KNOBD.set(row.field, out);
    return out;
  };
  const knobDecisions = (m, seat) => Ask.forRole(seat).map((row) => ({
    id: "knob:" + row.field, seat, ask: row.ask, knob: row.field,
    cheap: knobDistinct(row),
    answered: ((m.song.knobs || {}).__said || {})[row.field] || null,
    opts: row.opts.map(([w, v]) => ({ w,
      answered: ((m.song.knobs || {}).__said || {})[row.field] === w,
      active: JSON.stringify((m.song.knobs || {})[row.field]) === JSON.stringify(v),
      apply: (s2) => ({ ...s2,
        knobs: { ...(s2.knobs || {}), [row.field]: v,
                 __said: { ...((s2.knobs || {}).__said || {}), [row.field]: w } } }) })),
  }));

  const seatDecisionsNow = (m, seat) => {
    if (seat === "arranger")
      return [...narrow(m, seat, arrDecisions(m)), ...knobDecisions(m, seat)];
    if (seat === "engineer") return engDecisions(m);
    const drop = TAKEN[seat] || [];
    const ds = seat === "drums" ? D.decisions(m.drums)
      : seat === "keys" ? Ky.decisions(m.keys)
      : seat === "guitar" ? Gt.decisions(m.guitar)
      : seat === "voice" ? Vo.decisions(m.voice) : B.decisions(m.bass);
    return [...markRacks(seat, narrow(m, seat, ds.filter((d) => !drop.includes(d.id))
      .map((d) => ({ ...d, seat })))), ...knobDecisions(m, seat)];
  };
  // every seat's questions, with the answers that would change nothing
  // dropped — and a question left with one answer dropped whole
  const asked = (m, seat) => seatDecisions(m, seat)
    .map((d) => ({ ...d, opts: heardOpts(m, seat, d) }))
    .filter((d) => d.opts.length >= 2 || d.answered);
  const decisions = (m) => SEATS.flatMap((s) => seatDecisions(m, s));
  // LAZY. `asked` prunes every question, which means rendering every answer
  // of every question — and `nextAsk` needs exactly one. So it walks the
  // unanswered ones in order and prunes them one at a time, stopping at the
  // first that still has something to ask.
  const nextAsk = (m, seat) => {
    const s2 = seat || m.seat;
    for (const d of seatDecisions(m, s2)) {
      if (handSaid(m, s2, d)) continue;      // only a HAND closes a question
      const opts = heardOpts(m, s2, d);
      if (opts.length >= 2) return { ...d, opts };
    }
    return null;
  };
  // ...and the same walk, counted — what the chair rail shows
  const pending = (m, seat) => {
    let n = 0;
    for (const d of seatDecisions(m, seat)) {
      if (handSaid(m, seat, d)) continue;
      if (heardOpts(m, seat, d).length >= 2) n++;
    }
    return n;
  };
  // the whole band's next question, in session order: the tune first, then
  // the drummer, then the bass
  const nextAnywhere = (m) => {
    for (const s of SEATS) { const q = nextAsk(m, s); if (q) return { ...q, seat: s }; }
    return null;
  };
  // A HAND ANSWERING TAKES THE ROW OFF THE RECORD'S LEDGER — which is the
  // whole of "a hand always outranks". Every road into answering runs
  // through here, including the recursive ones (`called` answering the
  // genre, the front door's last-one-standing), so the mark is cleared in
  // exactly one place.
  function answer(m, seat, id, w) {
    const out = answerNow(m, seat, id, w);
    return out === m ? m : unseed(out, seat, id);
  }
  function answerNow(m, seat, id, w) {
    if (id.startsWith("knob:")) {
      const d = knobDecisions(m, seat).find((x) => x.id === id);
      const o = d && d.opts.find((x) => x.w === w);
      return o ? { ...m, song: o.apply(m.song) } : m;
    }
    if (seat === "arranger") {
      // FIND THE ROW, DON'T BUILD THE LIST. Answering one question used to
      // construct every arranger question there is — the calls, the tune's
      // own five, the narrowing — to find one row, which measured at 9 ms a
      // tap and is most of what composing a record cost.
      const d = (id.startsWith("idea") ? ideaDecisions(m)
        : id.startsWith("len:") ? lenDecisions(m)
        : id.startsWith("lean:") ? leanDecisions(m)
        : id.startsWith("chg:") ? callDecisions(m).map((x) => ({ ...x, seat: "arranger",
            opts: x.opts.map((o) => ({ ...o })) }))
        : ARR.map((x) => (x.three ? { ...x, opts: threeOpts(m, x.id) }
                          : x.color ? colorRow(m) : x)))
        .find((x) => x.id === id) || arrDecisions(m).find((x) => x.id === id);
      const o = d && d.opts.find((x) => x.w === w);
      if (!o) return m;
      // ...the melody's own answers land on the idea, not on the tune —
      // whichever theme the question was about
      if (o.idea === "b") return { ...m, ideaB: Id.answer(m.ideaB, o.iid, w) };
      if (o.idea) return { ...m, idea: Id.answer(m.idea, o.iid, w) };
      // THE LAST ONE STANDING IS CALLED. Answering the third question when
      // only one record fits is answering the genre — asking "and which of
      // these one records is it?" is the kind of question this box exists
      // not to ask.
      if (d.three) {
        const song2 = { ...o.apply(m.song), answers: { ...(m.song.answers || {}), [id]: w } };
        const left = survivors(song2);
        let out2 = { ...m, song: song2 };
        if (left.length === 1 && song2.genre !== left[0][0])
          out2 = answer(out2, "arranger", "genre", left[0][1].w);
        return out2;
      }
      const song = { ...o.apply(m.song), answers: { ...(m.song.answers || {}), [id]: w } };
      // A CATALOG CALL REPLACES THE HAND'S LIST, WHOLE — the words replace
      // each other — and a changed cycle takes its lean with it: a lean on
      // changes that left is a mark on silence (the invalidates law).
      if (id.startsWith("chg:")) {
        const r = id.slice(4);
        if ((song.chgx || {})[r]) { const chgx = { ...song.chgx }; delete chgx[r];
          song.chgx = chgx; }
        if ((song.lean || {})[r] && (m.song.answers || {})["chg:" + r] !== w) {
          const lean = { ...song.lean }; delete lean[r]; song.lean = lean; }
      }
      // A COLOUR BELONGS TO ITS FAMILY: crossing "major or minor?" to the
      // other word takes the colour answer with it (chair.js spells this
      // `invalidates`; the arranger's own walker does it by hand), so a
      // harmonic minor never lingers on a record that just went major.
      if (id === "mode" && (m.song.answers || {}).mode !== w) {
        delete song.answers.mcolor;
        if (song.mcolor) song.mcolor = null;
      }
      let out = { ...m, song };
      // A METER IS THE WHOLE BAND'S. One answer, and every chair counts the
      // new bar — the drummer's table of grooves, the bassist's figure, the
      // pitched chairs' places, the theme's own cells. The chairs' own
      // hand-edits are trimmed, never re-seated (chair.js `refit`), and the
      // drummer's family/groove answers are reopened because a waltz is not
      // a four-on-the-floor with a beat cut off.
      // ...and only when the BAR actually moves: saying "in four" to a record
      // that already counts in four is a word, not a change, and re-seating
      // the band there would sweep a drummer's jazz ride for a kit nobody
      // asked to hear.
      if (id === "meter") out = remeter(out, m.song.meter);
      // A SECOND THEME IS MADE THE MOMENT IT IS ASKED FOR — and it starts
      // as a CONTRAST, because that is what an answer is: where the tune
      // arches and closes on the root, the answer is a short call that
      // falls away and opens on the fifth. (A B theme that started as a
      // copy of A would be A with extra steps.) Saying "one theme is
      // plenty" takes it back out; saying it twice changes nothing.
      if (id === "second")
        out.ideaB = song.themeB
          ? (m.ideaB || answerTheme())
          : null;
      // WHAT KIND OF RECORD IS THIS is the drummer's own first question, and
      // the arranger has just answered it out loud. It is recorded on the
      // drummer (so their groove question is narrowed to that family) and
      // taken off their list — they are not asked what they were told.
      if (id === "genre") {
        const gk = GENRES[song.genre];
        // ...AND A RECORD MAY COUNT DIFFERENTLY. "A waltz" moves the bar the
        // same way the arranger's own word does, and for the same reason: a
        // band handed a new record counts the new record. It runs BEFORE the
        // call below, so the groove the record names is chosen out of the
        // table the record is actually in.
        out = remeter(out, m.song.meter);
        if (gk) out.drums = D.answer(out.drums, "record", gk.fam);
        // CALLING A RECORD MAKES THE RECORD. Narrowing what a player MAY
        // choose is not the same as changing what they ARE playing, and a
        // genre that only edits a menu is a genre you cannot hear ("I change
        // the genre and nothing changes in the song"). So the call also
        // MOVES anything nobody has spoken for, and anything whose answer
        // this record does not have — a jazz ride in a punk record is not a
        // decision to respect, it is a groove that is no longer on the
        // table. A player's own answer, still available here, is untouched:
        // that is the half of the law that matters.
        if (gk) out = called(out, gk, m.song.genre);
      }
      return out;
    }
    if (seat === "engineer") {
      const d = ENG.find((x) => x.id === id);
      if (!d || !d.opts.some((o) => o.w === w)) return m;
      if (!d.multi) return { ...m, eng: { ...(m.eng || {}), [id]: w } };
      // a toggle set: the word lights or unlights; an emptied set is the
      // question back open, not a different kind of silence
      const next = engToggle(d, engSet(m, id), w);
      const eng = { ...(m.eng || {}) };
      if (next.length) eng[id] = next.join(", "); else delete eng[id];
      return { ...m, eng };
    }
    if (seat === "drums") return { ...m, drums: D.answer(m.drums, id, w) };
    // an annotated knob answers onto the SONG, whichever chair was asked
    if (id.startsWith("knob:")) {
      const d = knobDecisions(m, seat).find((x) => x.id === id);
      const o = d && d.opts.find((x) => x.w === w);
      return o ? { ...m, song: o.apply(m.song) } : m;
    }
    if (seat === "keys") return { ...m, keys: Ky.answer(m.keys, id, w) };
    if (seat === "guitar") return { ...m, guitar: Gt.answer(m.guitar, id, w) };
    if (seat === "voice") return { ...m, voice: Vo.answer(m.voice, id, w) };
    return { ...m, bass: B.answer(m.bass, id, w) };
  }
  // the words each seat still has, beyond its interview
  const catalog = (m, seat, theme) => {
    // the arranger's tray is the theme's own words — aimed at whichever
    // theme the page is editing (the tune unless it says "b")
    const idm = theme === "b" && m.ideaB ? m.ideaB : m.idea;
    const list = seat === "drums" ? D.catalog(m.drums)
      : seat === "bass" ? B.catalog(m.bass)
      : seat === "keys" ? Ky.catalog(m.keys)
      : seat === "guitar" ? Gt.catalog(m.guitar)
      : seat === "voice" ? Vo.catalog(m.voice)
      : seat === "arranger" ? Id.catalog(idm).filter((i) => i.group !== "start") : [];
    const gk = genreOf(m);
    if (!gk) return list;
    // the same law as the questions: a genre hides the grooves and the
    // machines that are not this record, and nothing else. Everything a
    // player does WITH a kit — the hands, the fills, the bar itself —
    // belongs to the player in every genre there is.
    return list.filter((i) => {
      const w = i.words[0];
      // ...and A GROOVE LIST NAMES A BAR. A record's list is written in the
      // record's own meter, so it narrows the tray exactly as long as the
      // band is still counting the record's way — a waltz offers its three
      // ballroom grooves, a house record its four. The moment somebody
      // COUNTS IT DIFFERENTLY (a house record taken in three) the list is a
      // list of words for another bar, and a record cannot narrow what it
      // has no words for: the meter's own table is the tray then, and the
      // exactness law upstairs (`changes`) drops anything from another bar.
      if (i.group.startsWith("grooves"))
        return (m.song.meter || null) === (gk.meter || null)
          ? (gk.grooves || []).includes(w) : true;
      // ...and the same law for the bassist's own tray: a record that does
      // not have a walking line in it does not offer one here either
      if (i.group === "the line") return (gk.styles || []).includes(w);
      // ...and EVERY RACK IS OPEN HERE TOO (the guitar's since 2026-08-22, the
      // other three since 2026-08-23). The questions stopped jailing them
      // (`narrow`/openRack above) and a tray that still did would be the same
      // jail one surface over: a word you can answer and cannot then find is
      // worse than a word you never had. The rows do the recommending in the
      // question; the tray is a flat word list and simply carries the room —
      // ten guitars, thirty-one keyboards, eleven basses and ten kits.
      // (The two lines this replaces read `(gk.machines||[]).includes(w)` and
      // `(gk.keys||[]).includes(w)`; `the machine` and `what it is` now fall
      // through to the `return true` below, as `what you are playing` does.)
      return true;
    });
  };
  const say = (m, seat, id, theme) => (seat === "voice" ? { ...m, voice: Vo.say(m.voice, id) }
    : seat === "guitar" ? { ...m, guitar: Gt.say(m.guitar, id) }
    : seat === "arranger" ? (theme === "b" && m.ideaB
        ? { ...m, ideaB: Id.say(m.ideaB, id) }
        : { ...m, idea: Id.say(m.idea, id) })
    : seat === "keys" ? { ...m, keys: Ky.say(m.keys, id) }
    : seat === "drums" ? { ...m, drums: D.say(m.drums, id) }
    : seat === "bass" ? { ...m, bass: B.say(m.bass, id) } : m);
  const says = (m, seat, id, theme) => (seat === "voice" ? Vo.says(m.voice, id)
    : seat === "guitar" ? Gt.says(m.guitar, id)
    : seat === "arranger" ? Id.says(theme === "b" && m.ideaB ? m.ideaB : m.idea, id)
    : seat === "keys" ? Ky.says(m.keys, id)
    : seat === "drums" ? D.says(m.drums, id)
    : seat === "bass" ? B.says(m.bass, id) : "");

  /* ---------- ONE GENRE, BOTH PLAYERS -------------------------------------
     The kit is the drummer's, the line is the bassist's, and the key, the
     changes and the length are the arranger's — which is the only way the
     two parts can be about the same tune. */
  // THE WHOLE TAKE: one section per part of the form, each with its own
  // changes, and the players' own decisions under all of them. What a band
  // plays is a FORM, not a loop.
  // the same changes, read by a voice whose bar is `per16` bars long
  const pairProg = (roots, per16, kind, steps) => {
    const K2 = CHORDKIND[kind], N2 = steps || 16;
    const q = (d) => (K2 && K2.q ? { q: K2.q(((d % 7) + 7) % 7) } : {});
    const out = [];
    for (let i = 0; i < roots.length; i += per16)
      out.push(roots.slice(i, i + per16).map((d) => ({ d, beats: N2, ...q(d) })));
    return out.length ? out : [[{ d: 0, beats: N2 }]];
  };
  // ...and the same pairing over chord OBJECTS — the authored (or leaned)
  // changes carry q/borrow/beats the roots cannot, and the tune's harmony
  // layer must hear them: a split bar keeps its two half-bar chords, a
  // whole bar spans its sixteen steps.
  const pairProgX = (bars, per16, steps) => {
    const out = [], N2 = steps || 16;
    for (let i = 0; i < bars.length; i += per16) {
      out.push(bars.slice(i, i + per16).flatMap((bar) => {
        const list = Array.isArray(bar) ? bar : [bar];
        // A SPLIT BAR IS HALF OF THIS BAR, not eight steps of somebody
        // else's: in three that is six, not eight-and-then-four.
        return list.length > 1 ? list.map((cc) => ({ ...cc, beats: N2 / 2 }))
                               : [{ ...list[0], beats: N2 }];
      }));
    }
    return out.length ? out : [[{ d: 0, beats: N2 }]];
  };

  // `only` builds ONE section. Every signature below asks what one section
  // sounds like, and building the whole form to answer that made the
  // pruner — which runs per option, per question, per draw — cost the
  // length of the record. Absent, this is the whole take, as it was.
  function toSong(m, MODES, only) {
    if (MODES && !MODESREF) MODESREF = MODES;
    const fsecs = secsOf(m);
    const secs = only == null ? fsecs
      : (fsecs[only] === undefined ? [] : [fsecs[only]]);
    return secs.map((role, ix) => {
      const i = only == null ? ix : only;
      const key = CHGROLE[role] || role;
      const per = partOf(m, i);
      // WHAT A PLAYER DOES HERE IS SAID IN THEIR OWN WORDS. A bandleader
      // does not hand the drummer eight canned options for the chorus; they
      // say "swap hands", "ride it", "ghost the snare", "leave the kick" —
      // the same things the drummer says to themselves. So a section runs
      // the player's OWN vocabulary over a copy of that player, and what
      // comes out is this section's part. The player's song-wide decisions
      // are untouched: this is one chorus, not a new drummer.
      let dm = m.drums, bm = m.bass, km = m.keys, gm = m.guitar;
      for (const id of per.dwords || []) dm = D.say(dm, id);
      for (const id of per.bwords || []) bm = B.say(bm, id);
      for (const id of per.kwords || []) km = Ky.say(km, id);
      for (const id of per.gwords || []) gm = Gt.say(gm, id);
      if (per.keys && KEYJOB[per.keys]) km = Ky.say(km, "job:" + KEYJOB[per.keys]);
      if (per.guitar && per.guitar !== "same") gm = Gt.say(gm, "job:" + per.guitar);
      // THE SINGER'S OWN SECTION WORDS, said here rather than at the voice
      // layer below, because somebody has to be in the room before anybody
      // can keep out of their way (the BANDSTAND's `room` edge reads this).
      // Nothing between here and there reads `vm`, so this is a move.
      let vm = m.voice;
      for (const id of per.vwords || []) vm = Vo.say(vm, id);
      if (per.voice && per.voice !== "same") vm = Vo.say(vm, "job:" + per.voice);
      // ...AND NOW THE BAND HEARS ITSELF (LISTENS, above). The "chairs" half
      // runs here, before anybody's model becomes a genre, because these
      // edges change what a player DECIDES to play — a register, a job — and
      // a decision has to be made before it can be rendered. Every write is
      // a `say`, never an `answer`: the record's own cast law, so the graph
      // can never be mistaken for something a person said.
      ({ km, gm, vm } = listenChairs(m, i, per, { m, i, per, dm, bm, km, gm, vm }));
      // ONE RESOLVER, ONE OWNER: the hand's own list first (chgx), the
      // catalog row (with its lean, if called) second
      const c = changesOf(m, key);
      let g = toGenre(m, MODES, c, dm, bm, km, gm);
      // how much space there is, before anything a section says: a section
      // that asks for busier hats over one-hit-every-four-bars gets them,
      // which is what asking meant
      g = spaceOut(g, SPACE[m.song.space || "none"]);
      // THE KIT THIS RECORD IS MADE OF, before this section says anything
      // about it — what the BANDSTAND's `kick` edge locks to. See the note
      // on that edge: a bass player who lands with the kick has learned the
      // groove, not this bar, so a section where the drummer lays out must
      // not take the bass line with it (band-kit.test.js (i)).
      const kit0 = (g.kits && g.kits.length ? g.kits : [g.kit || {}])
        .map((bar) => (bar && bar.k && bar.k.some(Boolean))
          ? bar.k.map((v) => (v ? 1 : 0)) : 0);
      // ...and what each player is doing HERE, if they said
      // ...and a canned drum part needs a KIT, the same law the default
      // lift below already follows: on a kitless groove ("nobody on the
      // kit") the chorus's role default "busier" and the tag's "sparser"
      // FABRICATE hits from an empty bar — sixteen hats over a concerto, a
      // backbeat under a chant — because their fns write lanes rather than
      // thickening ones that exist. So a part nobody said stands down when
      // the record has nothing on the kit; a part somebody actually
      // ANSWERED still wins, which is what asking meant.
      const drumsAsked = ((m.per || {})[i] || {}).drums != null;
      const dsec = SECDRUMS[per.drums];
      if (dsec && dsec.fn && (drumsAsked || !kitlessOf(g))) {
        g.kit = dsec.fn(g.kit);
        g.kits = (g.kits || []).map((b) => dsec.fn(b));
      }
      const bsec = SECBASS[per.bass];
      if (bsec) {
        if (bsec.style) g.bassStyle = bsec.style;
        // THE KEY IS THE TUNE'S, NOT THE BASSIST'S — the same law toGenre
        // states, which this line was quietly breaking one level down. "Up
        // an octave" is a thing the BASS PLAYER does, and folding it into
        // `g.key` moved the key centre for every chair in the section AND
        // for the melody and voice layers that inherit the box's genre. The
        // dice found it: a chorus told to take the bass up, on a record
        // already in a high key, put the tune at MIDI 111 — three semitones
        // above the top of a piano. `bassReg` is the bass's own octave and
        // kernel.bass() is the only thing that reads it.
        if (bsec.oct) g.bassReg = (g.bassReg || 0) + bsec.oct;
        if (bsec.out) g.nobass = true;
      }
      // ...and the annotated knobs, over whatever the chairs made: they are
      // the kernel's own fields, asked by name
      g = Ask.merge(g, (m.song.knobs || {}));
      delete g.__said;
      // ...and what the band does to what it played
      const pp = (SECPIPE[per.pipe] || {}).p;
      if (pp) g.pipes = pp;
      // TWO THINGS A BAND SAYS THAT NEITHER PLAYER OWNS ALONE. "Give it a
      // lift" is a fill in the last bar, played INTO the next section —
      // arrangement, not drumming. "Follow the kick" is the bass locking to
      // the drummer's own kick pattern, which is a thing one player asks
      // another for and neither can do by themselves.
      // ...and a fill needs a KIT: on a kitless groove ("nobody on the kit")
      // the DEFAULT lift stands down — a snare fill from a kit that isn't
      // there, before the bridge — the same law OUT_NOKIT holds for the
      // endings below. A lift somebody actually ANSWERED still wins, which
      // is what asking meant.
      const liftAsked = ((m.per || {})[i] || {}).lift != null;
      if (per.lift && per.drums !== "nokit" && (liftAsked || !kitlessOf(g))) {
        const k = g.kits && g.kits.length ? g.kits.slice() : [g.kit || {}];
        const last = { ...(k[k.length - 1] || {}) };
        const FB = fillBarFor((g.meter && g.meter.steps) || 16);
        last.s = FB.s; last.t = FB.t;
        k[k.length - 1] = last;
        g.kits = k; g.kit = k[0];
      }
      if (per.follow) {
        const kick = (g.kits && g.kits.length ? g.kits : [g.kit || {}])
          .map((bar) => (bar && bar.k && bar.k.some(Boolean)) ? bar.k.map((v) => (v ? 1 : 0)) : 0);
        if (kick.some((x) => x)) g.bassBars = kick;
      }
      // ...and the rest of what the band hears (LISTENS, above). The "lanes"
      // half runs HERE — after every chair has spoken and `per.follow` has
      // had its say, on the assembled genre, which is the one tier where a
      // part can read another part's rhythm at all. An edge whose hand-guard
      // is true never runs, so "follow the kick" said out loud is still the
      // only thing that wrote `bassBars` on the records that said it.
      g = listenLanes(m, i, per, g, kit0);
      // the section's own strip, as the box fields nukernel's song already
      // has — the page writes them onto the box it builds
      // THE ARC, by where this section is in the record: the second chorus
      // is not the first one. A section that was told its own level keeps it
      // — the arc is what happens when nobody said.
      const arc = ARC[m.song.arc || "flat"];
      const nth = fsecs.slice(0, i).filter((r) => r === role).length;
      const of = fsecs.filter((r) => r === role).length;
      const shape = arc && arc.at ? arc.at(role, nth, of, i, fsecs.length) : null;
      const box = { ...((SECMIX[per.mix] || {}).box || {}),
                    ...((SECMOVE[per.move] || {}).box || {}) };
      // THE ARC OWNS THE LEVEL of the sections it shapes, and that includes
      // taking the FIRST chorus down a notch: "each chorus bigger than the
      // last" is a statement about the first one as much as the last, and a
      // rule that could only raise made the arc a no-op on a form whose
      // chorus already comes forward. A section somebody mixed by hand keeps
      // what they said — the arc is what happens when nobody did.
      if (shape && shape.lvl && !((m.per || {})[i] || {}).mix) box.lvl = shape.lvl;
      if (shape && shape.busier && !((m.per || {})[i] || {}).drums &&
          !(SPACE[m.song.space || "none"] || {}).bars && !kitlessOf(g))
        { const fn = SECDRUMS.busier.fn; g.kit = fn(g.kit); g.kits = (g.kits || []).map(fn); }
      // THE MELODY IS ITS OWN LAYER. A two-bar phrase cannot ride the bar
      // clock the rhythm section keeps — the kernel reads a phrase's own
      // length AS the bar, so a 32-step tune over a four-chord progression
      // hears two chords, not four. So the idea gets a genre of its own with
      // the changes PAIRED to its length (chordsOf reads a bar that carries
      // several chords), and the player who picks it up lends it their
      // instrument and their register.
      // WHOEVER TAKES THE TUNE LEAVES A HOLE, and a band fills it. One chair
      // is one pair of hands: a guitarist playing the hook is not also
      // playing the chords, and measured, a chorus where that happened came
      // out THINNER than its verse (26 events a bar against 29) — the
      // biggest moment in the record, quieter, because the part that carried
      // it left. So the other pitched chair steps up, which is what the
      // other player would do.
      // A PLAYER WHO HAS LAID OUT IS NOT IN THE ROOM. "Lay out" silences a
      // chair's VOICE (part null, empty phrase — the guitar-out precedent),
      // but the tune's default home (a vamp's verse and a chorus both hand
      // it to the keys) still built the melody layer on that chair's own
      // instrument — a laid-out keys player, audibly playing the hook. So
      // the taker is resolved against who is actually in the room, as this
      // section hears them (a section that says per.keys "pads" has brought
      // the chair back, and then it can take the tune again): an out taker's
      // tune falls to the other pitched chair — the hole rule played
      // backwards — and to nobody when the room is empty. The hole-filling
      // below gets the same guard, because "the keys take it" must not
      // resurrect a laid-out guitar with a strum job either.
      // ...WITH ONE HONEST DISTINCTION PER VOCABULARY. For the keys and the
      // guitar, the JOB is the chair's whole musical existence — Ky/Gt's "out"
      // IS the player leaving the room, so a laid-out keys chair neither plays
      // nor takes. The SINGER'S chair is TWO things (CLAUDE.md: "a TAKER of
      // the idea, AND parts of its own"), and vocal-kit's own words keep them
      // apart: its jobs group is "what you are SINGING" — the accompaniment
      // parts — and "lay out" (job:out, said song-wide or as a section's own
      // word) silences THOSE, while the taking is the section's `idea` word
      // and belongs to the arranger. A verse that says "the singer takes it"
      // and "lay out" is the bare verse where somebody just sings the tune —
      // reading the singer's own-part word as the room emptied un-took the
      // melody from exactly that record. A seated singer is always in the
      // room for taking; only not being in the band could say otherwise.
      const inRoom = { keys: !Ky.toGenre(km).silent, guitar: !Gt.toGenre(gm).silent,
                       voice: true };
      let taker = TAKERS[per.idea] || TAKERS.no;
      if (taker.chair && !inRoom[taker.chair]) {
        const next = (taker.chair === "keys" ? ["guitar"]
          : taker.chair === "guitar" ? ["keys"] : ["keys", "guitar"])
          .find((c) => inRoom[c]);
        taker = next ? TAKERS[next] : TAKERS.no;
      }
      if (taker.chair === "guitar" && inRoom.keys && !(per.keys && per.keys !== "same"))
        km = Ky.say(km, "job:comp");
      if (taker.chair === "keys" && inRoom.guitar && !(per.guitar && per.guitar !== "same"))
        gm = Gt.say(gm, "job:strum");
      let melody = null, soloPeriod = null;
      // WHICH THEME, AND HOW IT COMES BACK (PLAN.md THE THEME COMPOSER §2,
      // §5). The section node says which theme it carries — the tune, or
      // its answer when the arranger wrote one — and how the return is
      // made: the same, up a step, augmented, or just its head. The same
      // theme over different sections' changes is the Jimmy Webb engine
      // (recurrence over different ground); the transformation is the
      // section's, applied to the rendered phrase, so the theme itself is
      // never rewritten by being played.
      const theme = per.theme === "b" && m.ideaB && m.ideaB.on ? m.ideaB : m.idea;
      if (taker.chair && theme && theme.on) {
        const ph = Id.transform(Id.toPhrase(theme, c.roots), per.back, metOf(m.song));
        // how many of THIS record's bars the theme spans
        const NB = (g.meter && g.meter.steps) || 16;
        const per16 = ph.deg.length / NB;
        /* ---- A SOLO DEVELOPS THE TUNE, AND THE NEXT SOLOIST PICKS IT UP --
           The one write to the kernel's bar schedule (`g.period`, its sixth
           type) anywhere on the band page, and the only mechanism in the box
           that can change which notes exist in the MIDDLE of a section: a
           section-level word — a part, a return, a pipe, a mix — is one
           answer for the whole section, so the most it can make is a
           different loop.

           THE INDEX IS THE RECORD'S, NOT THE SECTION'S. Rung 0 is the first
           bar of the first solo, and the count carries across the handoff,
           one rung of overlap per change of player: soloist k's first
           statement IS the statement soloist k-1 ended on, and then it goes
           on. That is the whole difference between a band and a playlist —
           what the guitar plays in bar one of its chorus is a development of
           what the piano was doing in bar twelve of its own, rather than a
           second performance of the same eight ideas. Measured before it
           existed: handing the tune round three players over 188 bars gave a
           self-similarity of 0.98 at lag 12 and again at 24 — a perfect
           twelve-bar loop with three people taking turns playing it.

           The rung count is in THEME STATEMENTS, not bars, because that is
           what the kernel's `s` counts: a melody layer renders the phrase's
           own length as its bar (ui/band.js says so), so a two-bar tune
           advances the ladder every two bars, which is the right rate for it
           anyway — a soloist develops a phrase, not a barline. */
        if (role === "solo") {
          // this record's solo length, by the same arithmetic `bars` uses
          // below — every solo shares one role and therefore one length, so
          // the rung count per solo is exact rather than assumed
          const L = (c.authored ? null : lenOf(m, role) || ROLEBARS[role]) || g.bars;
          const reps = Math.max(1, Math.ceil(L / (per16 || 1)));
          const nth = fsecs.slice(0, i).filter((r) => r === "solo").length;
          const base = nth * Math.max(1, reps - 1);
          soloPeriod = (v, sr) => Id.soloWord(base + sr);
        }
        const lend = taker.chair === "guitar" ? Gt.toGenre(gm)
          : taker.chair === "voice" ? Vo.toGenre(m.voice) : Ky.toGenre(km);
        melody = { phrase: ph, genre: {
          ...g, label: "Idea", voices: 1, part: () => "lead",
          // the idea's OWN register — a tune is not where the chords are
          realize: () => "line",
          reg: () => tuneReg(Id.regOf(theme), g.key | 0) - LAYER_LIFT,
          // the tune is on the instrument of whoever picked it up.
          // A LAYER'S SEAT IS ITS OWN: `...g` copies the band's two-chair
          // `chairs` seam onto this one-voice layer, and derive.js
          // poolInstrOf reads chairs FIRST — the stacked voice index (2, 3)
          // wrapped `v % 2` straight back onto chairs[0], and the tune (and
          // the singer below) came out on the keys' instrument and the keys'
          // tone, laid out or not. One voice, one chair, declared here.
          chairs: [{ part: "lead", instr: lend.instr, tone: lend.tone }],
          instr: lend.instr, tone: lend.tone,
          // LEGATO IS THE DEFAULT ARTICULATION OF A SUNG THEME (PLAN.md THE
          // THEME COMPOSER §4) — and of any theme that has learned to speak
          // in sentences: a line whose measures differ and whose ties cross
          // barlines is a LINE, and the record's own articulation (a house
          // record says staccato) must not chop it into the comping's
          // eighths. Gated on the new machinery — a sentence plan, or a
          // written tie anywhere in the phrase — so every theme from before
          // the composer landed keeps the record's word and renders byte
          // for byte; the written ties themselves are safe either way,
          // because the kernel plays an explicit hold at its full written
          // length under any articulation.
          ...((theme.sent || "plain") !== "plain" || ph.hold
              ? { artic: "legato" } : {}),
          // ...and the ladder, on solos only (above). Absent everywhere
          // else, so every section that states a theme renders byte for byte
          // as it always has.
          ...(soloPeriod ? { period: soloPeriod } : {}),
          nobass: true, kit: {}, kits: null, bassFig: undefined,
          bars: Math.max(1, Math.ceil(g.bars / per16)),
          // the tune's harmony layer hears the authored (or leaned) chord
          // objects — q and borrow carried through the pairing — and the
          // catalog path stays the object it always built, byte for byte
          prog: per16 > 1
            ? (c.authored || c.leaned ? pairProgX(c.prog, per16, NB)
                                      : pairProg(c.roots, per16, m.song.chords, NB))
            : (c.authored || c.leaned ? c.prog : progOf(c.roots, m.song.chords)),
        } };
      }
      // THE SINGER IS A LAYER OF ITS OWN. Two pitched chairs already share
      // the band's genre as two voices; a third would want a role the pool
      // has to cast, and a voice must not lose its own recording to whatever
      // else happens to hold that role. So it rides beside the melody, with
      // its own genre and its own instrument — the shape CLAUDE.md's chair
      // recipe names for exactly this case.
      const vg = Vo.toGenre(vm);
      const voice = vg.silent ? null : { phrase: Vo.toPattern(vm), genre: {
        ...g, label: "Voice", voices: 1, part: () => vg.part,
        realize: () => (vg.pad ? "pad" : "line"),
        reg: () => stand(vg.part, vg.reg) - LAYER_LIFT,
        // "a voice must not lose its own recording" — same law as the
        // melody's chair above: the layer declares its OWN one-seat chairs,
        // or the band's inherited pair answers for it
        chairs: [{ part: vg.part, instr: vg.instr, tone: vg.tone,
                   ...(vg.pad ? { pad: true } : {}) }],
        instr: vg.instr, tone: vg.tone, nobass: true, kit: {}, kits: null,
        bassFig: undefined, pipes: undefined } };
      // THE KEYS PLAYER'S PHRASE is the box's own pattern — a pitched voice
      // is a part AND a phrase, and only the phrase can say where the hands
      // fall. A chair that is out hands back a silent one.
      // HOW WE GET OUT OF IT — the leaving section owns the gesture. A
      // section's own call outranks the record's ending; the record's ending
      // ("how does it end?") lands only on the last section, and only when
      // the section said nothing itself.
      let outro = null;
      if (per.out === "fill") outro = "fill";
      else if (per.out === "lift") outro = OUT_LIFT[i % OUT_LIFT.length];
      else if (per.out !== "none" && i === fsecs.length - 1 && m.song.end)
        outro = m.song.end;
      if (outro) box.outro = kitlessOf(g) ? (OUT_NOKIT[outro] || outro) : outro;
      // THE SECTION'S OWN LENGTH, with the changes repeating inside it —
      // and an AUTHORED list's length IS the length, outranking any stale
      // length answer (setChanges retires the question and its answer)
      const bars = (c.authored ? null : lenOf(m, role) || ROLEBARS[role]) || g.bars;
      /* ---------- ANOTHER TAKE (Paul, 2026-08-22: "a reseed button to
         rebuild the current song with variation on its core identity") ----
         A TAKE IS A SEED, AND THIS BOX HAD ONE SEED IT NEVER WROTE.
         `kitSeed` is the kernel's own per-take dice (kernel.js `rollAt`):
         it decides which chance hits actually land, the HAND — seeded
         micro-timing in ninths of a step — the per-hit velocity
         humanisation, and the ornament rolls. Nothing in nukernel has ever
         set it, so every record this box has made has been take zero, and
         two performances of the same song were the same performance to the
         byte. `song.take` is that seed, said out loud: absent (or 1) is
         take one and every record before this renders byte-identical.

         It reaches the engine and NOT the model, which is what makes the
         law hold by construction: a take cannot move a decision, because
         no decision is downstream of it. The section index goes into it so
         the same figure is not humanised identically in every section. */
      const take = (m.song.take | 0);
      if (take > 1) {
        const ks = (take * 0x9E3779B1 + i * 0x85EBCA77) | 0;
        g.kitSeed = ks;
        if (melody) melody.genre = { ...melody.genre, kitSeed: ks };
        if (voice) voice.genre = { ...voice.genre, kitSeed: ks };
        // ...and the PIPES, whose operators carry a seed of their own
        // (kernel.js: `prng(((op.seed || 0) + 1) * ...)`) and were handed
        // none — so a canon fell in the same places every time
        if (Array.isArray(g.pipes) && g.pipes.length)
          g.pipes = g.pipes.map((op, k) => ({ ...op, seed: ks + k }));
      }
      return { role, i, genre: g, bars, per, melody, voice,
               pattern: Ky.toPattern(taker.chair === "keys" && melody
                 ? Ky.say(km, "job:out") : km),
               guitar: Gt.toPattern(taker.chair === "guitar" && melody
                 ? Gt.say(gm, "job:out") : gm),
               box: Object.keys(box).length ? box : null };
    });
  }
  /* ---------- WHAT A SECTION IS, BEFORE ANYBODY SAYS ANYTHING -------------
     Nobody in a band asks what to play in the intro. A chorus is bigger
     than the verse, a bridge goes somewhere else, an outro thins out, and
     the bar before a change gets a fill — that is not an arrangement
     decision, it is what the roles MEAN, and a band plays it on the first
     take without discussing it. So a section arrives with its part already
     in it, per instrument, and everything you say about that section is an
     override of something already musical rather than a blank to fill. */
  const ROLE = {
    // an intro is the band ARRIVING: hats, a pedalled root, and one chord
    // ringing rather than the guitar part that has not started yet
    intro:  { drums: "hatsonly", bass: "pedal", guitar: "ring", keys: "pads" },
    verse:  {},
    // A CHORUS LIFTS BY MOVING FOUR THINGS AT ONCE, which is what a band
    // does: the drums open up, the bass goes to octaves, the level comes
    // forward and THE TUNE ARRIVES. Measured before this, the chorus was
    // 1.07× the verse — a rounding error where the biggest moment in the
    // record should be.
    chorus: { drums: "busier", bass: "octave", mix: "fwd", idea: "keys" },
    // a bridge is a CONTRAST, not a peak: measured, it was the loudest thing
    // in the record because four dense bars sat next to eight-bar verses.
    // The ride, a walking bass and the keys on pads — different, thinner.
    bridge: { drums: "ride", bass: "walk", keys: "pads", guitar: "ring" },
    outro:  { drums: "sparser", bass: "pedal", mix: "back", guitar: "ring" },
    // ...and the dance-record roles, which are the same kind of fact: a
    // build is hats and eighths climbing, a drop is everything at once, a
    // breakdown is the drums gone and the bass holding the room
    build:  { drums: "hatsonly", bass: "eighths", move: "rise" },
    drop:   { drums: "busier", bass: "same", move: "open", mix: "fwd", idea: "keys" },
    break:  { drums: "nokit", bass: "pedal", mix: "wet", move: "close" },
    head:   {},
    // A SOLO IS SOMEBODY PLAYING (2026-08-23). This row named the rhythm
    // section and nobody else, so the box's solo was a ride cymbal and a
    // walking bass with the tune switched off: measured over the longest
    // record it could make, 8 of 188 bars carried the tune and three of
    // them were distinct. Who takes it is not in this table because it is
    // not the same answer twice — the point of a solo section is that the
    // NEXT one is somebody else — so it is dealt in `defaultsFor`, by which
    // solo this is.
    solo:   { drums: "ride", bass: "walk" },
    // a TAG is the hook's head, played out the door: thin, back, and the
    // tune fragmented — the one role that carries a default `back`
    tag:    { drums: "sparser", bass: "pedal", mix: "back", idea: "keys",
              back: "frag" },
  };
  // a way in, a way out, and the hole in the middle: the sections a tune is
  // not AT HOME in, whatever else a record is made of
  const DOORROLE = { intro: 1, outro: 1, tag: 1, break: 1 };
  /* ...AND A DOOR IS NOT A VERSE, so it is not a verse LONG either. Only the
     three called roles (verse / chorus / bridge) can be asked how long they
     are; everything else took the length of the changes it borrowed, so an
     intro was as long as the verse and a tag was as long as the chorus and
     the record came out a rectangle. Measured over 6,540 records, 29% used
     ONE length for every section, where a real record of 2..7 sections uses
     a different length for half of them at p10 and all of them at the median
     (struct-bands.json distinctLens, n=513). These are the lengths the roles
     already mean — a band arrives in four, a solo takes a chorus and a half,
     a tag is four bars out the door — and an answered length still wins. */
  const ROLEBARS = { intro: 4, outro: 8, tag: 4, break: 4, build: 8, solo: 12 };
  // the roles a record LIFTS INTO — where the tune arrives and the band
  // opens up. Read by the verse's hold-back below, and by nothing else.
  const LIFTROLE = { chorus: 1, drop: 1 };
  /* WHO COULD TAKE A SOLO ON THIS RECORD, in the order the horn line would
     go: the guitar first (the head's own default taker is the keys, and a
     band does not open the solos with the player who just played the tune),
     then the keys, then the singer. A chair that is out is not a soloist —
     the same `silent` test toSong's `inRoom` uses — and the singer is asked
     of the SONG's voice model, exactly as the chorus's hand-over is.
     Memoised per model: the answer is a fact about the band and not about
     the section, and `defaultsFor` is called once per section per rail
     draw. */
  const TAKERM = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  const soloTakers = (m) => {
    if (TAKERM && TAKERM.has(m)) return TAKERM.get(m);
    const out = [];
    if (!Gt.toGenre(m.guitar).silent) out.push("guitar");
    if (!Ky.toGenre(m.keys).silent) out.push("keys");
    if (!Vo.toGenre(m.voice).silent) out.push("voice");
    if (TAKERM) TAKERM.set(m, out);
    return out;
  };
  const homeRole = (fsecs) => (fsecs.includes("head") ? "head"
    : fsecs.includes("verse") ? "verse"
    : (fsecs.find((r) => !DOORROLE[r]) || fsecs[0]));
  const defaultsFor = (m, i) => {
    const fsecs = secsOf(m);
    const role = fsecs[i], next = fsecs[i + 1];
    const d = { ...(ROLE[role] || {}) };
    // THE TUNE HAS A HOME IN EVERY FORM. "The hook plays in every chorus by
    // default, because a melody that appears once is an event, not a
    // structure" — and a melody that appears NOWHERE is not even an event.
    // A chorus and a drop bring their own taker (ROLE above); a form with
    // neither — a vamp, a blues, AABA, a jazz head, a dub, a strophic song,
    // da capo — left every theme silent unless somebody said the words. So
    // those forms give theme A the same default the chorus gets, in the
    // section that IS the tune in that form: the head where the form has
    // one (that is what a head means), the verse everywhere else (that is
    // what strophic means). The bridge stays a contrast, exactly as it is
    // in a chorus form. A per-section answer still outranks this (partOf).
    // ...a TAG is a door, not the tune's home: its own default taker (the
    // hook's head, out the door) must not un-home the verse's
    // ...and NOW THAT ANY SEQUENCE IS REACHABLE (the boxes are real,
    // 2026-08-22) the home cannot be a two-way guess. A hand-built
    // intro/bridge/outro has no chorus, no head and no verse, and the old
    // line quietly left every theme in that record silent. So the home is
    // the first section that is not a DOOR — a way in, a way out or the
    // hole in the middle — and the head/verse rows above it are what that
    // rule already says on every form there has ever been (byte-identical:
    // every FORMS row without a chorus or a drop carries a head or a verse).
    if (!fsecs.some((r) => r !== "tag" && (ROLE[r] || {}).idea) &&
        role === homeRole(fsecs))
      d.idea = "keys";
    /* A VERSE ONLY SITS BACK WHEN THERE IS SOMEWHERE TO GO ------------------
       PLAN.md says a chorus lifts, and this file's own ROLE table moves four
       things to make it happen. MEASURED at scale it does not: over the
       records that have both a verse and a chorus, the chorus came out
       SMALLER than the verse in pitched parts 61% of the time (median lift
       0.92, against the ~2.0 the Pet Shop Boys study measured across 17
       records), and the shape that dominated was "the verse with more
       drums" — the kit up 1.65x while the parts went nowhere.

       The cause is arithmetic, not taste. A verse has BOTH pitched chairs
       comping (measured 6.95 + 7.32 notes a bar); the chorus takes one of
       them away, because whoever picks up the tune stops playing chords —
       one chair is one pair of hands, which is right — and the tune only
       puts back 4.9. So the biggest moment in the record was two chairs
       becoming one and a half.

       The band's answer is not to give the pianist three hands. It is that
       THE VERSE WAS TOO FULL: a rhythm guitar strumming every bar under a
       comping keyboard for the whole verse leaves the chorus nothing to
       add. So a verse whose record HAS a chorus lets the guitar ring —
       long chords, out of the way — and takes it back when the tune
       arrives. A verse with nowhere to go (strophic, a vamp, a jazz head)
       is untouched: it is the whole record, and thinning it would just be a
       thinner record. Anybody can still say otherwise; this is what nobody
       had to say. */
    if (!d.guitar && LIFTROLE[fsecs[i]] === undefined &&
        (role === "verse" || role === "head") && fsecs.some((r) => LIFTROLE[r]))
      d.guitar = "ring";
    /* ...AND THE TUNE ARRIVES ON A PAIR OF HANDS THAT IS FREE.
       The other half of the same arithmetic. `ROLE.chorus` hands the tune to
       the keys, and the keys are the chair already holding the chords, so
       the chorus paid for its melody by losing its accompaniment. A band
       does not do that: in a chorus THE SINGER takes the tune and the
       players keep playing. So where a record has a singer in the room, a
       lifting section gives them the tune; where it does not (an
       instrumental — the vocal chair laid out), the keys take it exactly as
       before, because a tune on a voice nobody hired is not an arrangement.
       A section's own answer still outranks this, like every other default
       in this table. */
    if (d.idea === "keys" && LIFTROLE[role] && !Vo.toGenre(m.voice).silent)
      d.idea = "voice";
    /* ...AND THE SOLOS GO ROUND THE ROOM ---------------------------------
       The one place in a record where "who takes it" has a different answer
       every time it is asked, which is exactly why it cannot be a row in
       ROLE. Each solo hands the tune to the next player who is actually in
       the band, dealt by WHICH SOLO this is, so a record with three solos
       is three people and not one person three times.

       ONLY WHO IS IN THE ROOM (`soloTakers`, memoised per model). The
       record's own law: no mechanism may put an instrument on a record that
       does not have one — a laid-out guitar chair is not a soloist, and an
       instrumental record has no singer to hand anything to. toSong's own
       fallback would re-seat an impossible taker, but it re-seats onto the
       chair NEXT DOOR, and two consecutive solos on the same pair of hands
       is the handoff not happening. So the rotation is over the players who
       exist, and a one-player room simply plays every solo.

       Deliberately BEFORE the return ladder below, and deliberately not
       subject to it: see the `role !== "solo"` there. */
    if (role === "solo" && !d.idea) {
      const who = soloTakers(m);
      if (who.length)
        d.idea = who[fsecs.slice(0, i).filter((r) => r === "solo").length % who.length];
    }
    if (LIFTROLE[role] && !d.pipe) d.pipe = "thirds";
    /* ...AND A RETURN IS NOT A REPEAT (PLAN.md THE THEME COMPOSER §5).
       The transform words existed and nothing ever said one: every time the
       tune's home role came round again it played the identical phrase over
       the identical changes. That is the shape the corpus is most emphatic
       about — `halfExactSame` (four bars of tune repeated note for note) has
       a MEDIAN OF 0.00 in every stratum of the bulk corpus and a p90 of 0.00
       among records of this box's length; real writing keeps the rhythm and
       moves the notes. And it is the box's own written law: "the same theme
       over different sections' changes is the Jimmy Webb engine".
       So the SECOND time a theme-carrying section comes round it goes up a
       step, and later returns stretch out — the sequence's own move first,
       because that is the one every idiom in the catalog owns. The first
       statement is never touched (a theme is stated whole before it is
       anything else) and a section that says its own `back` wins. */
    /* ...AND A SOLO'S RETURN IS NOT A WORD, IT IS THE LADDER. Every other
       theme-carrying section states the tune once and a single word says
       how — that is what a return IS. A solo does not state the tune, it
       WORKS on it, bar by bar, and it picks up where the last soloist put
       it down (toSong's `period`, ideas-kit SOLO). Handing it a section-
       level `back` on top would restate the tune at the top of every solo,
       which is the loop this whole round exists to end. */
    if (d.idea && d.idea !== "no" && !d.back && role !== "solo") {
      const nth = fsecs.slice(0, i).filter((r) => r === role).length;
      if (nth === 1) d.back = "up";
      else if (nth >= 2) d.back = nth % 2 ? "aug" : "up";
    }
    // the drummer plays the band into the change; nobody has to ask
    if (next && next !== role) d.lift = true;
    // A CALLED SPACE OWNS THE SCHEDULE. "One hit every four bars" is a
    // schedule, not a tempo — and a fill is itself a drum event, so a
    // section whose kit speaks once per four bars has no bar to fill. When
    // the arranger has called space, the role's canned drum/bass parts and
    // the default fill-into-the-change stand down; a section somebody
    // actually ASKED to be busier still gets it, which is what asking meant.
    const sp = SPACE[m.song.space || "none"];
    if (sp && sp.bars) { delete d.drums; delete d.bass; d.lift = false; }
    return d;
  };
  /* ---------- A THEME IS STATED WHOLE BEFORE IT IS FRAGMENTED ------------
     The tag is the ONE role that carries a default `back` — "the hook's
     head, played out the door" — and a head is only the head of something
     you have already heard. Nobody asked for it there; the role did.

     Measured on 120 dice rolls (the written theme, against the melody
     layer's own compiled events): 24 of 303 theme-carrying sections never
     sounded their theme's written second half, and every one of them was a
     canned `frag` — 23 tags and one drop. Worse at record scale: 47 of the
     120 rolls compose an ANSWER, and in 9 of them theme B's second half was
     never heard ANYWHERE, because the dice's own "a rolled answer must be
     heard" law seats B on the last theme-carrying section — which, in every
     form that ends in a tag, IS the tag. The answer was composed, placed,
     and decapitated by a default written for the hook. ("I never hear the
     second half of the answer.")

     THE LAW: a theme sounds its whole length somewhere. A `back` somebody
     ANSWERED is untouched — fragmenting on purpose is a real musical call,
     and this only ever stands down the role's own canned one. A record
     whose hook is stated in a verse or a chorus is byte-identical: the tag
     frags it exactly as it always did. */
  const themeAt = (m, j) => (((((m.per || {})[j] || {}).theme === "b") &&
                              m.ideaB && m.ideaB.on) ? "b" : "a");
  // the returns that keep every note the theme wrote — `aug` (the head at
  // half speed) and `frag` (the head) do not, by their own definitions.
  // ...and NOR DOES `dim`: a diminution halves every onset's place, so two
  // notes a step apart land on one and the earlier one keeps it (ideas-kit).
  // Inversion and retrograde keep all of them — a reflection and a reversal
  // are bijections on the onsets — so a theme stated upside down or
  // backwards HAS been stated whole, and the tag's canned fragment may
  // stand.
  const WHOLE_BACK = { same: 1, up: 1, inv: 1, retro: 1 };
  const statedWhole = (m, i) => {
    const which = themeAt(m, i);
    return secsOf(m).some((_, j) => {
      if (j === i || themeAt(m, j) !== which) return false;
      const p = (m.per || {})[j] || {};
      // `idea` and `back` exactly as partOf resolves them — read here
      // rather than through partOf so the two never recurse into each other
      const id = p.idea != null ? p.idea : defaultsFor(m, j).idea;
      if (!id || id === "no") return false;
      const bk = p.back != null ? p.back : defaultsFor(m, j).back;
      return !bk || !!WHOLE_BACK[bk];
    });
  };

  // what this section actually is: the role's own part, with anything said
  // about it on top
  const partOf = (m, i) => {
    const per = (m.per || {})[i] || {}, d = defaultsFor(m, i);
    // A SECTION THAT HAS BEEN ARRANGED IN WORDS IS NOT ALSO HANDED THE
    // ROLE'S CANNED PART. Otherwise the chorus's default "octaves" quietly
    // overwrote every line the bassist was actually told to play here, and
    // the words looked broken when they were only outranked.
    const spoke = (k) => (per[k] || []).length > 0;
    return { drums: per.drums != null ? per.drums
               : (spoke("dwords") ? undefined : d.drums),
             bass: per.bass != null ? per.bass
               : (spoke("bwords") ? undefined : d.bass),
             idea: per.idea != null ? per.idea : d.idea,
             // which theme this section carries (A when unsaid), and how it
             // comes back — the same · up a step · augmented · just its
             // head. Unsaid they are ABSENT, not defaulted: a serialized
             // section that never heard the new words is byte-identical,
             // and every consumer treats undefined as "the tune, as it was".
             theme: per.theme,
             // ...the tag role brings its own return (`d.back`, the
             // fragmented hook); everywhere else unsaid stays ABSENT — and
             // the canned fragment stands down where this theme has not
             // been stated whole anywhere else (statedWhole, above)
             back: per.back != null ? per.back
               : (d.back === "frag" && !statedWhole(m, i) ? undefined : d.back),
             keys: per.keys != null ? per.keys : d.keys,
             guitar: per.guitar != null ? per.guitar : d.guitar,
             gwords: per.gwords || [],
             voice: per.voice != null ? per.voice : d.voice,
             vwords: per.vwords || [],
             kwords: per.kwords || [],
             pipe: per.pipe != null ? per.pipe : d.pipe,
             mix: per.mix != null ? per.mix : d.mix,
             move: per.move != null ? per.move : d.move,
             out: per.out != null ? per.out : null,
             // a said way out owns the whole gesture: the default
             // fill-into-the-change stands down for it
             lift: per.lift != null ? per.lift : (per.out ? false : !!d.lift),
             follow: per.follow != null ? per.follow : !!d.follow,
             dwords: per.dwords || [], bwords: per.bwords || [] };
  };

  // the fill a drummer plays into the next section — the one bar of an
  // arrangement everybody in a band can name
  const FILLBAR = { s: [0,0,0,0, 0,0,0,0, 1,0,1,1, 1,0,1,1],
                    t: [0,0,0,0, 0,0,0,0, 0,1,0,0, 0,1,0,0] };
  // ...and the same bar in a bar that counts differently: the fill is the
  // BACK HALF of it, whatever half that is. Four is the literal above.
  const fillBarFor = (n) => (n === 16 ? FILLBAR : (() => {
    const h = Math.round(n / 2), S = zn(n), T = zn(n);
    for (let i = h; i < n; i++) S[i] = (i - h) % 3 === 1 ? 0 : 1;
    T[h + 1] = 1; if (h + 4 < n) T[h + 4] = 1;
    return { s: S, t: T };
  })());
  // the groups of a player's vocabulary that make sense said about ONE
  // SECTION. A machine is the record's, a tempo is the band's, and the bar's
  // own counting belongs to the drummer's own page; the hands, the kit, what
  // happens to it and what is taken away are things you say about a chorus.
  const DGROUPS = ["at the kit", "the kit", "take away", "the fills"];
  const KGROUPS = ["what you are playing", "the bar", "the register", "at the machine"];
  const GGROUPS = ["what you are playing", "the bar", "the register", "at the amp"];
  const VGROUPS = ["what you are singing", "the bar", "the register", "at the mic"];
  // the section's own shorthand for the keys, on top of their whole vocabulary
  const KEYJOB = { pads: "pads", comp: "comp", skank: "skank", riff: "riff",
                   arp: "arp", drone: "drone", out: "out" };
  const SECKEYS = {
    same:  { w: "same as before" },
    pads:  { w: "pads under it" },
    comp:  { w: "comp the changes" },
    skank: { w: "chop the offbeats" },
    riff:  { w: "the riff" },
    arp:   { w: "arpeggios" },
    drone: { w: "hold one note" },
    out:   { w: "lay out" },
  };
  // WHAT A BASSIST IS TOLD ABOUT ONE SECTION: the line, how the notes come
  // out, the register, and where they sit against the drums. Not which bass
  // they are holding — nobody changes instrument for the chorus — and not
  // the changes, the key or the tempo, which are the arranger's.
  const BGROUPS = ["the line", "the figure", "what notes it plays", "at the machine",
                   "how you play them", "the register", "the feel"];
  const secWords = (m, i, who) => {
    const per = partOf(m, i);
    const KIT = who === "drums" ? D : who === "keys" ? Ky : who === "guitar" ? Gt
      : who === "voice" ? Vo : B;
    const said = (who === "drums" ? per.dwords : who === "keys" ? per.kwords
      : who === "guitar" ? per.gwords : who === "voice" ? per.vwords : per.bwords) || [];
    let pm = who === "drums" ? m.drums : who === "keys" ? m.keys
      : who === "guitar" ? m.guitar : who === "voice" ? m.voice : m.bass;
    for (const id of said) pm = KIT.say(pm, id);
    const groups = who === "drums" ? DGROUPS : who === "keys" ? KGROUPS
      : who === "guitar" ? GGROUPS : who === "voice" ? VGROUPS : BGROUPS;
    // the HANDS first, then what is playing, then what comes out — the
    // order the words matter in when you are talking about one section
    // ...and A WORD THAT DOES NOTHING HERE SAYS SO. Every catalog in the
    // box already works out, per word, whether saying it would change this
    // player at all, and every `say` hands back a model equal to the one it
    // was given when it would not — so such a word composes the IDENTICAL
    // section, which is the one thing the pruner below was composing a
    // section to find out. A third of the tray, measured over 30 records
    // and 12 rolls: 8,707 of 26,880 word options rendered only to be
    // thrown away.
    //   ...WITH ONE CATCH, and it is the reason this is a probe rather than
    // a flag. The FIRST word said about a chair also takes the role's own
    // canned part off the section (`partOf`'s `spoke`: a bassist who was
    // told something is not also handed the chorus's octaves), so on a
    // section nobody has spoken to yet, even a word that does nothing to
    // the player changes the section. Asked here as a question rather than
    // written down as a list of which chairs carry that guard: say a word
    // nobody's vocabulary has and see whether the section's PART moves.
    const bare = (p) => JSON.stringify({ ...p, dwords: 0, bwords: 0,
                                         kwords: 0, gwords: 0, vwords: 0 });
    const wk = who === "drums" ? "dwords" : who === "keys" ? "kwords"
      : who === "guitar" ? "gwords" : who === "voice" ? "vwords" : "bwords";
    const quiet = bare(per) === bare(partOf(setSection(m, i, wk, "w:\u0000"), i));
    return KIT.catalog(pm)
      .filter((x) => groups.includes(x.group))
      .sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group))
      .map((x) => ({ w: x.words[0], key: "w:" + x.id, answered: said.includes(x.id),
                     silent: quiet && !x.changes }));
  };
  // what a section can be asked, and how it is answered
  // WHAT ONE SECTION SOUNDS LIKE, in one place: the pruner uses it to drop
  // answers that change nothing, and the tree gate uses the same function so
  // the two can never disagree about what "different" means.
  // EVERY FIELD, NOT A LIST OF THEM. Hand-listing what a section sounds like
  // meant that every new thing a chair could write was invisible to the
  // pruner until somebody remembered to add it — and an invisible field makes
  // its own question look like it changes nothing, so the question
  // disappears. That is exactly how the pipes vanished the day they were
  // wired: `g.pipes` was not on the list, so "what comes out" was pruned to
  // one answer and dropped. The genre's own keys are the list now; the
  // functions are dropped and the values they return are read beside them.
  const genreSig = (g) => JSON.stringify([
    Object.entries(g).filter(([, v]) => typeof v !== "function")
      .sort(([a], [b]) => (a < b ? -1 : 1)),
    [0, 1].map((v) => { try { return [g.part(v), g.reg(v), g.realize(v)]; }
                        catch (e) { return null; } }),
  ]);
  function secSigOf(mm, i) {
    let s0;
    try { s0 = toSong(mm, MODESREF, i)[0]; } catch (e) { return "?"; }
    if (!s0) return "?";
    return JSON.stringify([genreSig(s0.genre), s0.pattern, s0.guitar, s0.box,
      s0.melody ? [s0.melody.phrase, genreSig(s0.melody.genre)] : null,
      // ...and the singer, who is a layer of their own — left out of this,
      // every question about the voice looked like it changed nothing and
      // was pruned away, which is the pipes' bug all over again
      s0.voice ? [s0.voice.phrase, genreSig(s0.voice.genre)] : null]);
  }

  /* ---------- THE TWO SECTION ROWS THAT COST NOTHING ----------------------
     A section question is pruned by composing the section once per option,
     and MOST of them have to be: measured over 30 records and 12 rolls,
     sixteen of the eighteen rows really do drop options, because the table
     they read from is not the only thing writing where it writes. "The mix"
     is the clearest case — SECMIX writes `box.lvl`, and so does the ARC
     when nobody has mixed that section by hand, so two of its words compose
     to the same box and one of them is rightly not offered.

     Two rows are different, and the tables say why rather than a hand:

       "what happens to it"  SECPIPE writes `g.pipes`, and `g.pipes` has
                             exactly one other writer — the seeding pass
                             below it, which stamps the same seeds on
                             whatever is there. secSigOf prints the genre.
       "the filter"          SECMOVE writes `box.mot`, which no other table
                             and no arc touches. secSigOf prints the box.

     So distinct table rows ARE distinct sections there. Both halves of that
     are checked at load — the rows differ, and the keys are the row's own —
     so a table that grows a duplicate, or a `lvl` in SECMOVE, puts the
     question back on the expensive path instead of quietly answering it
     wrong. */
  const tableDistinct = (t, of) => {
    const seen = new Set();
    for (const v of Object.values(t)) {
      const k = JSON.stringify(of(v) === undefined ? null : of(v));
      if (seen.has(k)) return false;
      seen.add(k);
    }
    return true;
  };
  const boxKeys = (t) => new Set(Object.values(t)
    .flatMap((v) => Object.keys(v.box || {})));
  const SECFREE = new Set([
    ...(tableDistinct(SECPIPE, (v) => v.p) ? ["pipe"] : []),
    ...(tableDistinct(SECMOVE, (v) => v.box) &&
        ![...boxKeys(SECMOVE)].some((k) => boxKeys(SECMIX).has(k) || k === "lvl")
        ? ["move"] : []),
  ]);

  const sectionAsks = (m, i, raw) => {
    const per = partOf(m, i);
    // ...and the same law as the chairs': an option that would make the
    // identical section is not an option, and a question left with one is
    // not asked. (The signature here is the SECTION's, not the first one's.)
    const secSig = (mm) => secSigOf(mm, i);
    // ...asked ONCE. What this section sounds like right now is the same
    // answer for all eighteen questions about it, and it was being composed
    // eighteen times a draw.
    const now = secSig(m);
    const prune = (a) => {
      if (SECFREE.has(a.id)) return a;   // distinct by construction (below)
      const seen = new Map();
      const opts = a.opts.filter((o) => {
        if (o.answered) return true;
        // a word that changes nothing about this player composes the
        // identical section — no need to compose it to find out. (It is
        // dropped rather than remembered, exactly as `sg === now` below
        // drops it, so the dedupe map sees the same words in the same
        // order it always did.)
        if (o.silent) return false;
        let sg; try { sg = secSig(setSection(m, i, a.id, o.key)); } catch (e) { return true; }
        if (sg === now || seen.has(sg)) return false;
        seen.set(sg, o.w); return true;
      });
      return { ...a, opts };
    };
    return [
      { id: "drums", who: "the drums", opts: Object.entries(SECDRUMS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.drums === k || (!per.drums && k === "same") })) },
      { id: "dwords", who: "at the kit", opts: secWords(m, i, "drums") },
      { id: "keys", who: "the keys", opts: Object.entries(SECKEYS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.keys === k || (!per.keys && k === "same") })) },
      { id: "kwords", who: "at the keys", opts: secWords(m, i, "keys") },
      { id: "guitar", who: "the guitar", opts: [{ w: "same as before", key: "same",
            answered: !per.guitar || per.guitar === "same" },
          ...Object.entries(Gt.JOBS).map(([k, j]) => ({
            w: j.w, key: k, answered: per.guitar === k }))] },
      { id: "gwords", who: "at the amp", opts: secWords(m, i, "guitar") },
      { id: "voice", who: "the voice", opts: [{ w: "same as before", key: "same",
            answered: !per.voice || per.voice === "same" },
          ...Object.entries(Vo.JOBS).map(([k, j]) => ({
            w: j.w, key: k, answered: per.voice === k }))] },
      { id: "vwords", who: "at the mic", opts: secWords(m, i, "voice") },
      { id: "bass", who: "the bass", opts: Object.entries(SECBASS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.bass === k || (!per.bass && k === "same") })) },
      { id: "bwords", who: "the bass player", opts: secWords(m, i, "bass") },
      { id: "idea",
        who: (secsOf(m)[i] === "solo") ? "the solo" : "the melody",
        opts: Object.entries(TAKERS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.idea === k || (!per.idea && k === "no") })) },
      // ASSIGNMENT ON THE SECTION NODE (PLAN.md THE THEME COMPOSER §2, §5):
      // which theme this section carries — asked only when there IS a
      // second one — and how it comes back, asked only where somebody is
      // actually carrying it. Both default to the byte-identical answer,
      // and the prune below already retires a transformation that would
      // make the identical section (fragmenting a one-bar tune is "the
      // same" wearing a costume).
      ...(m.ideaB && m.ideaB.on ? [{ id: "theme", who: "which theme", opts: [
          { w: "the tune", key: "a", answered: !per.theme || per.theme === "a" },
          { w: "the answer", key: "b", answered: per.theme === "b" } ] }] : []),
      ...(per.idea && per.idea !== "no" ? [{ id: "back", who: "how it comes back",
        opts: Object.entries(Id.TRANSFORMS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.back === k || (!per.back && k === "same") })) }] : []),
      { id: "pipe", who: "what happens to it", opts: Object.entries(SECPIPE).map(([k, v]) => ({
          w: v.w, key: k, answered: per.pipe === k || (!per.pipe && k === "none") })) },
      { id: "mix", who: "the mix", opts: Object.entries(SECMIX).map(([k, v]) => ({
          w: v.w, key: k, answered: per.mix === k || (!per.mix && k === "same") })) },
      { id: "move", who: "the filter", opts: Object.entries(SECMOVE).map(([k, v]) => ({
          w: v.w, key: k, answered: per.move === k || (!per.move && k === "none") })) },
      // HOW DO WE GET OUT OF IT — the engine hangs the gesture on the bar
      // being LEFT, so the leaving section is the one asked
      { id: "out", who: "how do we get out", opts: [
          { w: "straight through", key: "none", answered: per.out === "none" },
          { w: "a fill", key: "fill", answered: per.out === "fill" },
          { w: "a lift into it", key: "lift", answered: per.out === "lift" } ] },
      { id: "band", who: "everybody", opts: [
          { w: "give it a lift", key: "lift", answered: per.lift },
          { w: "follow the kick", key: "follow", answered: per.follow } ] },
    ].map((a) => (raw ? a : prune(a))).filter((a) => a.opts.length >= 2)
      // WHAT A SECTION IS ABOUT COMES FIRST. Twelve questions is a lot of
      // floor, and the melody — the one arrangement decision that changes
      // who is playing the tune — was ninth ("where is the melody question
      // in song????"). The canned parts and the calls are what you arrange
      // with; the players' whole vocabularies are underneath, for when you
      // want to say something specific.
      .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  };
  const ORDER = ["idea", "theme", "back", "drums", "keys", "guitar", "bass", "voice",
                 "pipe", "mix", "move", "out",
                 "band", "dwords", "kwords", "gwords", "bwords", "vwords"];
  const setSection = (m, i, who, key) => {
    const per = { ...(m.per || {}) };
    const one = { ...(per[i] || {}) };
    if (who === "band") {
      // an explicit false is a real answer here: the lift is ON by default
      // in the bar before a change, so "give it a lift" has to be sayable
      // in reverse — a band saying "don't" is saying something
      one[key] = !partOf(m, i)[key];
    } else if (["dwords", "bwords", "kwords", "gwords", "vwords"].includes(who)) {
      // a word said about a section is said again to take it back
      const k = who;
      const id = String(key).slice(2);
      const list = (one[k] || []).slice();
      const at = list.indexOf(id);
      if (at >= 0) list.splice(at, 1); else list.push(id);
      if (list.length) one[k] = list; else delete one[k];
    } else if (key === "same" || (who === "theme" && key === "a")) delete one[who];
    else one[who] = key;
    if (Object.keys(one).length) per[i] = one; else delete per[i];
    return { ...m, per };
  };

  // A PART STAYS ON ITS INSTRUMENT. The register and the part's own centre
  // both shift octaves and they STACK — a drone ("down low", ctr −12) under a
  // low key landed at MIDI 19, two octaves below the bottom of a piano. The
  // engine's register home would lift it, but a part written there is wrong
  // before anybody plays it. Found by rolling three hundred random records;
  // a person choosing those two answers would have found it too.
  // ...and the ceiling matters as much as the floor: a pad "right at the
  // top" over a high chord reached MIDI 109, which is above the top of a
  // piano (21..108 is the whole instrument). Both ends, per part, because a
  // drone sits an octave below where it is told to and a lead an octave
  // above.
  const FLOOR = { riff: 0, drone: 1, pad: 0, stab: 0, line: -1, counter: 0, lead: -1 };
  // ...and the GUITAR'S OWN FLOOR (the de-jangle round): its STAB reaches
  // -1, because "power chords, down low" is reg -2 by its own words and a
  // floor of 0 rendered the chord centred on MIDI 60 — an octave above the
  // hand (~MIDI 42-54 is where a low guitar part lives). Per CHAIR, not per
  // part, and stab ONLY: the keys player's chords keep the 0 floor, and the
  // riff keeps it on both chairs — the kernel's riff realization already
  // sits low (a chug at reg -1 reached MIDI 19 in key C; found by the dice,
  // roll 270, both times this was tried wider). The drone keeps its floor
  // everywhere, which is what the clamp was written for.
  const GFLOOR = { riff: 0, drone: 1, pad: 0, stab: -1, line: -1, counter: 0, lead: -1 };
  const CEIL  = { riff: 1, drone: 2, pad: 1, stab: 1, line: 1, counter: 1, lead: 1 };
  const stand = (part, reg, F) => Math.max((F || FLOOR)[part] == null ? -1 : (F || FLOOR)[part],
                                        Math.min(CEIL[part] == null ? 1 : CEIL[part], reg));

  /* ---------- THE SEAM TAKES AN OCTAVE, SO THE WORD HAS TO GIVE IT BACK ----
     `ui/derive.js` renders every STACKED layer at `L.reg(v) + 1`. That is the
     daw's own convention and it is right there: a layer is a second synth
     sitting ON TOP of the box, a bright 303 over a dark one. On this page a
     layer is not that. It is THE TUNE and THE SINGER, and "down low / where
     it sits / up high" (ideas-kit REG) are a writer's words about where a
     line lives — words the seam was quietly overruling by an octave.
     MEASURED, over 6,540 records: the tune's median note came out at MIDI 85
     against a corpus band of 62..81 (p10..p90 of 2,042 real melodies,
     lib/bands.json melCentre, median 71.5), and 10.9% of records put a note
     above MIDI 108 — off the top of a piano, which is `test/unit/dice.test.js:79`'s
     own law. THE DICE GATE CANNOT SEE IT: it renders the melody genre
     directly (`K.render(s.melody.phrase, s.melody.genre, …)`) and the octave
     is added downstream of that call, in the bar list the transport actually
     plays. So the two layers this page builds declare their register one
     octave BELOW their word, the seam adds it back, and the word comes true.
     Nothing else in the box moves: `+1` stays exactly what it is for every
     other stacked layer in nukernel. */
  const LAYER_LIFT = 1;

  /* ...AND THE TUNE'S OWN CEILING, for the same reason FLOOR and CEIL exist
     above: THE REGISTER WORD AND THE KEY BOTH SHIFT OCTAVES AND THEY STACK.
     A theme written "up high" is a lead part (PARTS.lead, another octave)
     over the record's own key (kernel.js adds it last), and measured over
     1,074 melody layers across 400 rolls the top note of a tune runs about
     87 + 12·reg + key: at reg 1 it tops out at 99 in C, 104 in E flat, 107
     in E and 112 in G — off the end of the piano, which is
     test/unit/dice.test.js:79's law and was found by it (roll 150). The
     four keys that sit a minor third or more above C therefore take a tune
     "up high" one octave lower, exactly the way a singer would. Below that
     nothing moves, and the word means what it says. */
  const tuneReg = (r, key) => Math.min(r, key >= 3 ? 0 : 1);

  function toGenre(m, MODES, changes, dm, bm, km, gm) {
    const drums = dm || m.drums, bass = bm || m.bass, keys = km || m.keys;
    const gtr = gm || m.guitar;
    const gk = genreOf(m);
    const kg = Ky.toGenre(keys), gg = Gt.toGenre(gtr);
    // THE RECORD'S TONE REACHES THE GUITAR, exactly as it reaches the bass:
    // a record may carry `gtrTone` beside `tone` (which has always been the
    // bass's). It sits between the chair's own defaults and the player's
    // answered panel — the player at the amp outranks the record, the record
    // outranks the default, and a record that names none is byte-identical.
    const ggTone = { ...gg.tone, ...((gk && gk.gtrTone) || {}), ...((gtr && gtr.tone) || {}) };
    // TWO PITCHED CHAIRS, TWO VOICES. Each takes its own phrase (the box's
    // stack lists a slot per voice — derive.js walks phrase pi to voice pi),
    // its own part, its own register and its own instrument. A chair that is
    // out keeps its voice and hands back an empty phrase, so nothing
    // downstream has to know who is in the room.
    // A PART STAYS ON ITS INSTRUMENT. The register and the part's own centre
    // both shift octaves and they STACK — a drone ("down low", ctr −12) under
    // a low key landed at MIDI 19, two octaves under the bottom of a piano.
    // The engine's register home would lift it, but a part written there is
    // wrong before anybody plays it. Found by rolling three hundred records.
    // ...and each chair's CHORD POLICY rides with it. The chairs array has
    // always been on the genre and the kernel read it nowhere; now the
    // chordLock branch reads exactly these facts — the keys hand's comping
    // (theory-voiced shells, the anticipating push, the ring-to-the-change
    // hold) and the driven guitar's power-chord fifths. Spread-if-set so a
    // chair that declares nothing is the same object it always was.
    const chairs = [{ part: kg.part(0), reg: stand(kg.part(0), kg.reg(0)),
                      instr: kg.instr, tone: kg.tone, pad: kg.realize(0) === "pad",
                      ...(kg.comping ? { comping: true } : {}),
                      ...(kg.antic ? { antic: true } : {}),
                      ...(kg.maxHold ? { maxHold: kg.maxHold } : {}) },
                    { part: gg.part, reg: stand(gg.part, gg.reg, GFLOOR), instr: gg.instr,
                      tone: ggTone, pad: gg.pad,
                      ...(gg.fifths ? { fifths: true } : {}) }];
    const dg = D.toGenre(drums);
    // THE TUNE'S ALPHABET IS THE RECORD'S OWN, when the record says so.
    // kernel.js reads `g.scale || PENT` for every line part, so a record
    // that declares nothing sings minor pentatonic whatever its harmony
    // says — right for a rock riff, and "the blues scale" over a 1600s
    // monody. An old-world record declares scale:"mode": the tune walks
    // the same diatonic colour the arranger called (mcolor moves the mode
    // and the alphabet together, so the lamento minor IS the tune's
    // notes). The hand's own answer ("what notes is the tune made of?")
    // lands in toSong's Ask.merge, OVER this — asked outranks the record.
    const ownScale = gk && gk.scale
      ? (gk.scale === "mode" ? (MODES ? MODES[modeKeyOf(m.song)] : null) : gk.scale)
      : null;
    // `changes` arrives three ways: the RESOLVED object (toSong's own calls,
    // through changesOf), a catalog key (older callers and the gates), or
    // nothing — the verse's own resolution, exactly what it always meant
    const c = changes && changes.roots ? changes
      : typeof changes === "string" && B.CHANGES[changes]
        ? { bars: B.CHANGES[changes].bars, roots: B.CHANGES[changes].roots,
            prog: progOf(B.CHANGES[changes].roots, m.song.chords) }
        : changesOf(m, "verse");
    const met = metOf(m.song);
    return {
      label: "Band", family: "kernel", rate: 1, bars: c.bars,
      // HOW THIS BAR COUNTS. Present-only: without an answer there is no
      // `meter` key on the genre at all and every reader downstream — the
      // kernel's stress and ornaments, derive's bar length, the staff — is
      // on the sixteen-step path it has always been on.
      ...(met ? { meter: { steps: met.steps, pulse: met.pulse } } : {}),
      entry: () => 0,
      // ...and the keys player's own chair: the PART they are playing, where
      // they sit, and what it is. A silent chair keeps the voice (the phrase
      // is empty) so nothing downstream has to know they are out.
      voices: 2,
      reg: (v) => chairs[v % 2].reg,
      realize: (v) => (chairs[v % 2].pad ? "pad" : "line"),
      part: (v) => chairs[v % 2].part,
      harmony: "cycle", roots: c.roots.slice(),
      // ...and the chords themselves, if a kind was called — or as the hand
      // spelled them. `prog` outranks `roots` in chordsOf, and carries the
      // quality (and the lean's borrow) the roots cannot.
      prog: c.prog,
      instr: chairs.map((c) => c.instr),
      // the drummer's kit, over whatever length the tune is (kernel's `at`
      // wraps a shorter schedule across a longer form)
      kit: dg.kit, kits: dg.kits, drumkit: dg.drumkit, humanize: dg.humanize,
      kitVel: dg.kitVel,
      // ...and the rest of the drummer's one humanization answer (C2): the
      // kernel reads touch and hand off the genre, and a fact that stops at
      // the chair is a fact nobody hears
      ...(dg.touch != null ? { touch: dg.touch } : {}),
      ...(dg.hand ? { hand: dg.hand } : {}),
      // the bassist's line, in the arranger's key
      nobass: false, bassStyle: B.STYLES[bass.style],
      // THE KEY IS THE TUNE'S, NOT THE BASSIST'S. Folding their register in
      // here moved the key centre for every chair — the keys and the guitar
      // went down an octave because the bass player did, which is how a pad
      // ended up at MIDI 14.
      key: (B.KEYS[m.song.key] || 0),
      bassReg: bass.oct || 0,
      // a band's pads are voice-led over a real progression, and this is the
      // room they are allowed to walk in
      padRoom: true,
      // ...in the colour the arranger called: unanswered, minor is still
      // dorian and major still ionian (the page's shipped defaults, held so
      // no saved session moves); the mcolor answer reaches the kernel here
      mode: MODES ? MODES[modeKeyOf(m.song)] : undefined,
      ...(ownScale ? { scale: ownScale } : {}),
      artic: bass.artic || (gk && gk.artic) || undefined,
      bassArtic: bass.artic || (gk && gk.artic) || undefined,
      // A RECORD BRINGS ITS OWN LINE. House is offbeats, techno is an acid
      // line, disco is octaves — those are not densities, they are figures,
      // and a bassist who has written their own outranks the record.
      // ...and it is the BAR'S figure: `figFor` re-seats a written line into
      // the bar being counted and answers null for the three that mean
      // sixteen, so a record's line can never reach a twelve-step bar with
      // four steps hanging off the end of it (the kernel reads a grid with
      // `at`, which wraps, so those four were lost in silence).
      bassFig: bass.fig ||
        (gk && gk.fig && B.figFor(bass, B.FIGURES[gk.fig], gk.fig)) || undefined,
      bassNudge: bass.sit ? bass.sit * 2 : undefined,
      // WHAT THE BASS SOUNDS LIKE, per record. A synth bass with no tone of
      // its own ran on the engine's defaults and played one continuous line
      // — no filter, and a gate that lasted as long as the note. A record
      // names its own: a house bass is short and closed, a jazz bass is open
      // and long, and the slow one rings.
      // ...with the PLAYER'S OWN PANEL over it: a bassist sitting at a 303
      // turns the filter, and the record does not get to hold it shut
      // ...and the BASSIST'S OWN BOARD rides on the same block, because the
      // bass tone is the one a chair hands down whole (audio/plan.js reads
      // `bassTone` where every other chair reads `chairs[].tone`). Absent when
      // nothing is plugged in, so a dry bass is byte-identical.
      bassTone: { wave: "saw", ...(gk && gk.tone ? gk.tone : { cut: 800, q: 4, rel: 0.22 }),
                  atk: 0.004, gain: 0.34, ...(bass.tone || {}),
                  ...(B.pedalsOf(bass) ? { pedals: B.pedalsOf(bass) } : {}) },
      tone: kg.tone, chairs,
      // the guitarist's own call on their chords (the default strum pipe a
      // chording job carries) — a section's explicit pipe call still replaces
      // it wholesale, because the band outranks the chair
      ...(gg.pipes ? { pipes: gg.pipes } : {}),
      words: [], word: () => [],
    };
  }
  // (the annotated knobs are merged in toSong, over whatever the chairs made)

  // WHAT THE THEME IS CALLED. The record decides, nobody is asked: a hook
  // when the singer carries it, a riff when the guitar does, a figure when
  // it keeps turning up under the keys, a chant when it sits on one note.
  // (The node title and the themes prose read this; asking "what kind of
  // theme is it?" would duplicate a derived fact.)
  function themeName(m, which) {
    // theme B is the answer — that is its whole name, the way "the hook"
    // is A's when the singer carries it
    if (which === "b") return "the answer";
    const takers = secsOf(m).map((r, i) => (TAKERS[partOf(m, i).idea] || {}).chair)
      .filter(Boolean);
    if (takers.includes("voice")) return "the hook";
    if (takers.includes("guitar")) return "the riff";
    if (m.idea && (m.idea.contour === "hold" || m.idea.contour === "insist"))
      return "the chant";
    if (takers.includes("keys")) return "the figure";
    return "the hook";
  }

  return { SEATS, TAKEN, FORMS, CALLED, CHGROLE, GENRES, SPACE, ROLE, ENG, SECMIX, SECMOVE, mixOf, themeName,
           // the record-arrives-finished tables, so a gate can hold the seed
           // to the same numbers the seat is chosen with
           THEMES, DESKS, PROPS, SPAN, planOf, fitReg, anotherTake, takeOf,
           METS, metOf, stepsOfSong, seatMeter,
           resetSeat, randomSong, modeKeyOf,
           genreOf, rolesIn, asked, pending, sigOf, secSigOf, survivors, FIELDS3, Ask,
           secWords, partOf,
           LISTENS, listensOn,
           blank, opening, decisions, seatDecisions,
           // WHO SAID IT: "hand" · "record" · null (band-kit's `song.seeded`),
           // and which kind of the record's: "chose" · "named" · null
           saidBy, seedKind,
           // THE BOXES: the record's own sections, and the four moves a
           // hand makes on them
           SECROLES, MAXSECS, shapeOf, boxesEdited, homeRole,
           addSection, moveSection, removeSection,
           nextAsk, nextAnywhere, answer, catalog, say, says, toGenre, toSong,
           SECDRUMS, SECBASS, SECKEYS, SECPIPE, CHORDKIND, LENS, ARC, TAKERS,
           sectionAsks, setSection,
           secsOf, changesOf, setChanges, dominantOf,
           D, B, Ky, Id, Gt, Vo };
});
