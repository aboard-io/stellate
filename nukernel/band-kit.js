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
    typeof require !== "undefined" ? require("./drums-kit.js") : root.NuDrums,
    typeof require !== "undefined" ? require("./bass-kit.js") : root.NuBass,
    typeof require !== "undefined" ? require("./keys-kit.js") : root.NuKeys,
    typeof require !== "undefined" ? require("./ideas-kit.js") : root.NuIdeas,
    typeof require !== "undefined" ? require("./guitar-kit.js") : root.NuGuitar,
    typeof require !== "undefined" ? require("./askable.js") : root.NuAskable);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuBand = api;
})(typeof self !== "undefined" ? self : this, function (D, B, Ky, Id, Gt, Ask) {
  "use strict";

  const SEATS = ["arranger", "drums", "bass", "keys", "guitar", "engineer"];
  // the questions the ARRANGER has already answered, so the players stop
  // asking them: a drummer does not set the tempo, a bassist does not pick
  // the key
  const TAKEN = { drums: ["tempo", "feel", "record"],
                  bass: ["key", "mode", "changes", "tempo", "feel"],
                  keys: ["key", "mode", "changes", "tempo", "feel"],
                  guitar: ["key", "mode", "changes", "tempo", "feel"] };

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
    { id: "bassfx", ask: "anything on the bass?", opts: [
      { w: "dry", mix: {} },
      { w: "a room on it", mix: { bass: { rev: 0.22 } } },
      { w: "echo on it", mix: { bass: { del: 0.3 } } },
      { w: "dub echo", mix: { bass: { del: 0.5, rev: 0.3 } } },
      { w: "thicken it", mix: { bass: { eq: { lo: 3, mid: 2 } } } } ] },
    { id: "bassmix", ask: "where does the bass sit?", opts: [
      { w: "under everything", mix: { bass: { fader: -3 } } },
      { w: "with the kick", mix: {} },
      { w: "out front", mix: { bass: { fader: 3 } } } ] },
  ];
  const engDecisions = (m) => ENG.map((d) => ({
    ...d, seat: "engineer", answered: (m.eng || {})[d.id] || null,
    opts: d.opts.map((o) => ({ ...o, answered: (m.eng || {})[d.id] === o.w,
      active: (m.eng || {})[d.id] === o.w })) }));
  // WHAT THE DESK IS TOLD: every answer's offsets, summed per channel. Two
  // answers that touch the same channel add rather than replace, the way two
  // hands on a board would.
  function mixOf(m) {
    const out = {};
    for (const d of ENG) {
      const w = (m.eng || {})[d.id];
      const o = w && d.opts.find((x) => x.w === w);
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
    return out;
  }

  const blank = () => ({ on: false, seat: "arranger",
    song: { key: "C", minor: false, form: null, chg: {}, bpm: 96, swing: null, answers: {} },
    drums: D.say(D.blank(), "start"), bass: B.say(B.blank(), "start"),
    keys: Ky.say(Ky.blank(), "start"),
    // THE IDEA belongs to the room. The arranger writes it; a section says
    // who picks it up. One melody to start with — the hook.
    idea: Id.say(Id.blank(), "start"),
    guitar: Gt.say(Gt.blank(), "start") });

  /* ---------- WHAT EACH PLAYER DOES IN EACH SECTION -----------------------
     The gig sheet sets up the SONG; a section is where a band actually
     arranges. So every section can ask each player one thing: what are you
     doing differently here? Nobody has to answer — "same as before" is the
     default and the honest one — but a chorus where the drums go half-time
     and the bass pedals the root is the whole difference between a loop and
     an arrangement. */
  const z16 = () => new Array(16).fill(0);
  const hitsAt = (...ix) => { const v = z16(); for (const i of ix) v[i] = 1; return v; };
  const SECDRUMS = {
    same:     { w: "same as before" },
    half:     { w: "half time", fn: (k) => ({ ...k, k: hitsAt(0, 6), s: hitsAt(8) }) },
    double:   { w: "double time", fn: (k) => ({ ...k, s: hitsAt(2, 6, 10, 14) }) },
    hatsonly: { w: "just the hats", fn: (k) => ({ h: k.h || z16() }) },
    nokit:    { w: "lay out", fn: () => ({}) },
    busier:   { w: "busier", fn: (k) => ({ ...k, h: new Array(16).fill(1),
                                           o: hitsAt(0, 8) }) },
    sparser:  { w: "sparser", fn: (k) => ({ k: hitsAt(0, 8), s: hitsAt(4, 12) }) },
    ride:     { w: "move to the ride", fn: (k) => ({ ...k, p: k.h || z16(), h: z16() }) },
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
    no:   { w: "nobody plays it" },
    keys: { w: "the keys take it", chair: "keys" },
    guitar: { w: "the guitar takes it", chair: "guitar" },
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
    strum:  { w: "spread the chords", p: [{ id: "strum", spread: 0.06 }] },
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
  const GENRES = {
    house:   { w: "a house record", fam: "the floor", bpm: 120, chords: "plain", when: ["the eighties", "the nineties", "now"], where: ["Chicago", "New York", "London"], venue: ["a warehouse", "a club"], gtr: ["a clean electric", "a jazz box", "a muted one"], gjob: "skank", keys: ["a warm pad", "a polysynth", "a Rhodes", "an electric piano", "strings"], kjob: "pads", forms: ["vamp", "dance", "twelve", "dj"], fig: "offbeat", artic: "staccato", tone: { cut: 700,  q: 6,  rel: 0.16 },
               grooves: ["house", "four on the floor", "disco", "uk garage"],
               machines: ["909", "808", "electronic kit"],
               styles: ["hold the root", "octaves", "eighths, driving"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["the four-chord one", "a minor vamp", "one chord, all night"] },
    techno:  { w: "a techno record", fam: "the floor", bpm: 120, chords: "plain", when: ["the eighties", "the nineties", "now"], where: ["Detroit", "Berlin"], venue: ["a warehouse", "a club"], gtr: ["a muted one", "a clean electric", "a crunchy one"], gjob: "out", keys: ["a glassy pad", "a polysynth", "a warm pad", "strings"], kjob: "drone", forms: ["vamp", "dance", "twelve", "dj"], fig: "acid", artic: "staccato", tone: { cut: 600,  q: 8,  rel: 0.13 },
               grooves: ["techno", "four on the floor", "gabber"],
               machines: ["909", "606", "electronic kit"],
               styles: ["hold the root", "eighths, driving", "sixteenths, busy"],
               instr: ["a synth bass", "with a pick"],
               chg: ["one chord, all night", "a pedal point", "a minor vamp"] },
    disco:   { w: "a disco record", fam: "the floor", bpm: 120, chords: "sevens", when: ["the seventies", "the eighties"], where: ["New York", "Philadelphia"], venue: ["a club", "a wedding"], gtr: ["a clean electric", "a jazz box", "a muted one"], gjob: "skank", keys: ["a Rhodes", "strings", "a clav", "an electric piano"], kjob: "comp", forms: ["dance", "versechorus", "vamp", "twelve"], fig: "discoct", artic: "staccato", tone: { cut: 950,  q: 3,  rel: 0.20 },
               grooves: ["disco", "four on the floor", "two step"],
               machines: ["acoustic kit", "room kit", "909"],
               styles: ["octaves", "eighths, driving", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["the four-chord one", "two-five-one", "the fifties changes"] },
    hiphop:  { w: "a boom-bap record", fam: "breaks", bpm: 96, chords: "sevens", when: ["the eighties", "the nineties", "the two-thousands"], where: ["New York", "Los Angeles"], venue: ["a block party", "a basement", "a club"], gtr: ["a clean electric", "a jazz box", "a muted one"], gjob: "out", keys: ["a Rhodes", "an electric piano", "a warm pad", "a grand piano"], kjob: "pads", forms: ["versechorus", "pop", "vamp"], artic: "normal", tone: { cut: 520,  q: 2,  rel: 0.45 },
               grooves: ["boom bap", "breakbeat", "trap"],
               machines: ["808", "909", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["a minor vamp", "one chord, all night", "two-five-one"] },
    jungle:  { w: "a jungle record", fam: "breaks", bpm: 144, chords: "plain", when: ["the nineties", "the two-thousands"], where: ["London", "Bristol"], venue: ["a warehouse", "a club"], gtr: ["a clean electric", "a muted one", "a jazz box"], gjob: "out", keys: ["a glassy pad", "a warm pad", "a polysynth", "strings"], kjob: "pads", forms: ["dance", "twelve", "vamp", "dj"], artic: "normal", tone: { cut: 480,  q: 5,  rel: 0.70 },
               grooves: ["amen break", "jungle", "breakbeat"],
               machines: ["electronic kit", "909", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "with a pick"],
               chg: ["a minor vamp", "one chord, all night"] },
    rock:    { w: "a rock record", fam: "rock", bpm: 120, chords: "plain", when: ["the sixties", "the seventies", "the eighties", "the nineties"], where: ["London", "Los Angeles", "New York"], venue: ["a stadium", "a bar", "a festival"], gtr: ["an overdriven one", "a crunchy one", "a distorted one", "a clean electric"], gjob: "power", keys: ["an organ", "a rock organ", "a grand piano", "an upright"], kjob: "comp", forms: ["versechorus", "pop", "full", "aaba"], artic: "normal", tone: { cut: 1100, q: 2,  rel: 0.24 },
               grooves: ["straight rock", "driving rock", "stomp", "half time"],
               machines: ["acoustic kit", "room kit", "big kit"],
               styles: ["hold the root", "eighths, driving", "root and fifth"],
               instr: ["with a pick", "fingers on a P-bass"],
               chg: ["the fifties changes", "the four-chord one", "a twelve-bar blues"] },
    punk:    { w: "a punk record", fam: "rock", bpm: 144, chords: "plain", when: ["the seventies", "the eighties"], where: ["London", "New York", "Manchester"], venue: ["a basement", "a bar", "a club"], gtr: ["a distorted one", "an overdriven one", "a crunchy one"], gjob: "drive", keys: ["a rock organ", "an organ", "an upright"], kjob: "comp", forms: ["versechorus", "pop", "vamp"], fig: "pump", artic: "staccato", tone: { cut: 1400, q: 2,  rel: 0.18 },
               grooves: ["punk", "driving rock", "stomp"],
               machines: ["acoustic kit", "big kit"],
               styles: ["eighths, driving", "hold the root"],
               instr: ["with a pick", "fingers on a P-bass"],
               chg: ["the four-chord one", "the fifties changes"] },
    kraut:   { w: "a krautrock record", fam: "rock", bpm: 120, chords: "plain", when: ["the seventies", "the eighties"], where: ["Berlin", "Düsseldorf"], venue: ["a studio", "a festival"], gtr: ["a clean electric", "a crunchy one", "a muted one"], gjob: "chug", keys: ["a polysynth", "a glassy pad", "a warm pad", "an organ"], kjob: "arp", forms: ["vamp", "dance", "full"], fig: "pump", artic: "normal", tone: { cut: 850,  q: 5,  rel: 0.30 },
               grooves: ["motorik", "bare bones", "half time"],
               machines: ["electronic kit", "room kit", "606"],
               styles: ["hold the root", "eighths, driving"],
               instr: ["a synth bass", "with a pick"],
               chg: ["one chord, all night", "a pedal point"] },
    jazz:    { w: "a jazz date", fam: "jazz", bpm: 144, chords: "sevens", when: ["the fifties", "the sixties", "now"], where: ["New York", "New Orleans", "Paris"], venue: ["a club", "a bar", "a studio"], gtr: ["a jazz box", "a nylon-string", "a clean electric"], gjob: "strum", keys: ["a grand piano", "a Rhodes", "an upright", "a church organ"], kjob: "comp", forms: ["head", "aaba", "blues"], swing: "swing", artic: "legato", tone: { cut: 1200, q: 1,  rel: 0.35 },
               grooves: ["jazz ride", "bebop", "brush swing"],
               machines: ["jazz kit", "brushes", "acoustic kit"],
               styles: ["walk it", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["two-five-one", "a twelve-bar blues", "the fifties changes"] },
    blues:   { w: "a blues", fam: "rock", bpm: 96, chords: "all7", when: ["the fifties", "the sixties"], where: ["Chicago", "Memphis", "New Orleans"], venue: ["a bar", "a club", "a porch"], gtr: ["a crunchy one", "a clean electric", "a steel-string acoustic"], gjob: "riff", keys: ["an upright", "a rock organ", "a grand piano", "a Rhodes"], kjob: "comp", forms: ["blues", "versechorus", "aaba"], swing: "shuffle", artic: "normal", tone: { cut: 1000, q: 1,  rel: 0.30 },
               grooves: ["shuffle", "train beat", "straight rock"],
               machines: ["acoustic kit", "room kit", "brushes"],
               styles: ["walk it", "root and fifth", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["a twelve-bar blues", "the fifties changes"] },
    funk:    { w: "a funk record", fam: "funk", bpm: 96, chords: "nines", when: ["the seventies", "the eighties"], where: ["New Orleans", "Detroit", "Los Angeles"], venue: ["a club", "a bar", "a festival"], gtr: ["a clean electric", "a muted one", "a jazz box"], gjob: "skank", keys: ["a clav", "a Rhodes", "an organ", "an electric piano"], kjob: "skank", forms: ["vamp", "versechorus", "dance"], fig: "funk16", artic: "staccato", tone: { cut: 900,  q: 7,  rel: 0.14 },
               grooves: ["funk", "linear funk", "new orleans", "motown"],
               machines: ["acoustic kit", "room kit", "808"],
               styles: ["sixteenths, busy", "octaves", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["one chord, all night", "a minor vamp"] },
    reggae:  { w: "a reggae record", fam: "latin", bpm: 96, chords: "plain", when: ["the seventies", "the eighties"], where: ["Kingston", "London"], venue: ["a dancehall", "a festival", "a yard"], gtr: ["a clean electric", "a muted one", "a jazz box"], gjob: "skank", keys: ["an organ", "a Rhodes", "a rock organ", "a grand piano"], kjob: "skank", forms: ["vamp", "dub", "versechorus"], fig: "bubble", artic: "legato", tone: { cut: 420,  q: 2,  rel: 0.55 },
               grooves: ["one drop", "steppers", "rockers"],
               machines: ["acoustic kit", "room kit", "808"],
               styles: ["hold the root", "octaves"],
               instr: ["fingers on a P-bass", "a synth bass"],
               chg: ["a minor vamp", "one chord, all night"] },
    bossa:   { w: "a bossa", fam: "latin", bpm: 120, chords: "sevens", when: ["the sixties", "the seventies"], where: ["Rio", "New York"], venue: ["a bar", "a studio", "a club"], gtr: ["a nylon-string", "a jazz box", "a steel-string acoustic"], gjob: "strum", keys: ["a grand piano", "a Rhodes", "a felt piano", "an upright"], kjob: "comp", forms: ["aaba", "versechorus", "head"], artic: "normal", tone: { cut: 1000, q: 1,  rel: 0.28 },
               grooves: ["bossa nova", "samba", "rumba", "cha cha"],
               machines: ["jazz kit", "brushes", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["two-five-one", "the four-chord one"] },
    slow:    { w: "something slow and open", fam: "rock", bpm: 72, chords: "sus", when: ["the nineties", "the two-thousands", "now"], where: ["Berlin", "Reykjavík", "London"], venue: ["a bedroom", "a studio", "a church"], gtr: ["a clean electric", "a steel-string acoustic", "a nylon-string"], gjob: "ring", keys: ["a warm pad", "strings", "a felt piano", "a glassy pad"], kjob: "swell", forms: ["vamp", "full", "dub"], fig: "stab", space: "four", artic: "legato", tone: { cut: 520,  q: 3,  rel: 1.20 },
               grooves: ["bare bones", "half time"],
               machines: ["electronic kit", "room kit", "808"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["a pedal point", "one chord, all night"] },
  };
  const genreOf = (m) => GENRES[m.song.genre] || null;

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
    sevens: { w: "sevenths, by function",
              q: (d) => (d === 0 ? "maj7" : d === 4 ? "dom7" : "m7") },
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
  const FIELDS3 = [["when", "what decade is it?"], ["where", "where are you?"],
                   ["venue", "where do you play?"]];
  const fits = (gk, s2) => FIELDS3.every(([f]) =>
    !s2[f] || (gk[f] || []).includes(s2[f]));
  const survivors = (s2) => Object.entries(GENRES).filter(([, gk]) => fits(gk, s2));
  // the values still worth offering for one field, given the others
  // ...and a decade is asked in the order decades happen, which no table
  // order can be relied on to give
  const DECADES = ["the fifties", "the sixties", "the seventies", "the eighties",
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
  const one16 = () => { const v = z16(); v[0] = 1; return v; };
  const SPACE = {
    none: { w: "keep it going" },
    half: { w: "a bar on, a bar off", bars: [1, 0, 1, 0] },
    bar:  { w: "one hit a bar", bars: [1, 1, 1, 1], one: true },
    four: { w: "one hit every four bars", bars: [1, 0, 0, 0], one: true },
  };
  const spaceOut = (g, sp) => {
    if (!sp || !sp.bars) return g;
    const kits = (g.kits && g.kits.length ? g.kits : [g.kit || {}]);
    const out = sp.bars.map((keep, b) => !keep ? {}
      : sp.one ? { k: one16() } : (kits[b % kits.length] || {}));
    return { ...g, kits: out, kit: out[0],
             bassBars: sp.bars.map((keep) => (keep ? one16() : 0)) };
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
    dance:    { w: "build, drop, breakdown, drop",
                secs: ["build", "drop", "break", "drop"] },
    twelve:   { w: "a twelve-inch: intro, build, drop, breakdown, drop, outro",
                secs: ["intro", "build", "drop", "break", "drop", "outro"] },
    dj:       { w: "a DJ tool: long intro, main, long outro",
                secs: ["intro", "drop", "outro"] },
    head:     { w: "head, solos, head", secs: ["head", "solo", "solo", "head"] },
    dub:      { w: "a version", secs: ["verse", "break", "verse"] },
  };
  // a role that is not one of the three the changes are called for still has
  // to know WHICH changes it takes — a drop is the chorus of a twelve-inch
  const CHGROLE = { intro: "verse", outro: "verse", build: "verse", drop: "chorus",
                    break: "verse", head: "verse", solo: "chorus" };
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
                 long: { w: "sixteen bars", v: 16 } };
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
    const f = FORMS[m.song.form || "vamp"];
    const want = new Set(f.secs.map((r) => CHGROLE[r] || r));
    return CALLED.filter((r) => want.has(r));
  };

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
    { id: "genre", ask: "what are we playing?", opts:
      Object.entries(GENRES).map(([k, gk]) => ({
        w: gk.w, is: (s) => s.genre === k,
        apply: (s) => ({ ...s, genre: k,
          bpm: gk.bpm != null && !(s.answers || {}).tempo ? gk.bpm : s.bpm,
        chords: !(s.answers || {}).chords ? (gk.chords || "plain") : s.chords,
          swing: !(s.answers || {}).feel ? (gk.swing || null) : s.swing,
          space: !(s.answers || {}).space ? (gk.space || "none") : s.space }) })) },
    { id: "arc", ask: "where does it go?", opts:
      Object.entries(ARC).map(([k, v]) => ({
        w: v.w, is: (s2) => (s2.arc || "flat") === k,
        apply: (s2) => ({ ...s2, arc: k }) })) },
    { id: "chords", ask: "what kind of chords?", opts:
      Object.entries(CHORDKIND).map(([k, v]) => ({
        w: v.w, is: (s2) => (s2.chords || "plain") === k,
        apply: (s2) => ({ ...s2, chords: k }) })) },
    { id: "key", ask: "what key are we in?", opts: Object.keys(B.KEYS).map((k) => ({
        w: "in " + k, is: (s) => s.key === k, apply: (s) => ({ ...s, key: k }) })) },
    { id: "mode", ask: "major or minor?", opts: [
      { w: "major", is: (s) => !s.minor, apply: (s) => ({ ...s, minor: false }) },
      { w: "minor", is: (s) => s.minor, apply: (s) => ({ ...s, minor: true }) } ] },
    { id: "form", ask: "what's the form?", opts:
      Object.entries(FORMS).map(([k, f]) => ({
        w: f.w, is: (s) => s.form === k, apply: (s) => ({ ...s, form: k }) })) },
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
    // HOW SLOW CAN THIS GO: a tempo of 48 is still four hits a bar. This is
    // the other axis — how much of the bar is nothing.
    { id: "space", ask: "how much space is there?", opts:
      Object.entries(SPACE).map(([k, sp]) => ({
        w: sp.w, is: (s) => (s.space || "none") === k,
        apply: (s) => ({ ...s, space: k }) })) },
  ];
  // ...and one CALL per role the form contains: "what are the chorus
  // changes?" is a thing a bandleader says out loud
  // ...one length question per role the form contains, beside its changes
  const lenDecisions = (m) => (m.song.form ? rolesIn(m) : []).map((r) => ({
    id: "len:" + r, seat: "arranger", ask: "how long is the " + r + "?",
    opts: Object.entries(LENS).map(([k, v]) => ({
      w: v.w, is: (s2) => ((s2.lens || {})[r] || "short") === k,
      apply: (s2) => ({ ...s2, lens: { ...(s2.lens || {}), [r]: k } }) })),
  }));
  const callDecisions = (m) => (m.song.form ? rolesIn(m) : []).map((r) => ({
    id: "chg:" + r, seat: "arranger", ask: "what are the " + r + " changes?",
    opts: Object.entries(B.CHANGEWORD).map(([k, w]) => ({
      w, is: (s) => (s.chg || {})[r] === k,
      apply: (s) => ({ ...s, chg: { ...(s.chg || {}), [r]: k } }) })),
  }));
  // the melody is the arranger's, and it is asked in the ideas module's own
  // words — one question per thing that makes a tune
  const ideaDecisions = (m) => Id.decisions(m.idea).map((d) => ({
    ...d, id: "idea:" + d.id, seat: "arranger",
    opts: d.opts.map((o) => ({ ...o,
      apply: (s2) => s2,                       // the melody is not a song field
      idea: true, iid: d.id })) }));
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
  const arrDecisionsNow = (m) => [...ARR, ...callDecisions(m), ...lenDecisions(m), ...ideaDecisions(m)]
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
        : d))
    .map((d) => ({
    // ...and an IDEA question is answered on the idea, not on the song, so
    // its own answer stands (overwriting it with the song's made the tune's
    // questions unanswerable — the arranger was asked "how long is it?"
    // forever)
    ...d, seat: "arranger",
    answered: d.id.startsWith("idea:") ? d.answered : ((m.song.answers || {})[d.id] || null),
    opts: d.opts.map((o) => ({ ...o, answered: (m.song.answers || {})[d.id] === o.w,
      active: (() => { try { return !!o.is(m.song); } catch (e) { return false; } })() })) }));

  // ...what calling a record actually does to the players
  function called(m, gk) {
    let d = m.drums, b = m.bass;
    const keep = (ans, list) => ans && list.includes(ans);
    // the groove and the kit the record is made of
    if (!keep((d.answers || {}).groove, gk.grooves)) d = D.answer(d, "groove", gk.grooves[0]);
    const mach = D.catalog(d, null).filter((i) => i.group === "the machine");
    const has = mach.find((i) => i.active && gk.machines.includes(i.words[0]));
    if (!has) {
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
    if (gk.fig && B.FIGURES[gk.fig] && !b.fig) b = B.figSet(b, B.FIGURES[gk.fig]);
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
    if (gk.kjob && !(kk.answers || {}).job) kk = Ky.say(kk, "job:" + gk.kjob);
    // ...and the guitar, the same way: a house record has a guitar chopping
    // the offbeats if it has one at all, and techno has none
    let gg2 = m.guitar;
    const gw = Gt.INSTRUMENTS[gg2.instr];
    if (!(gg2.answers || {}).instr || !keep(gw, gk.gtr || [])) {
      const want = Object.entries(Gt.INSTRUMENTS).find(([, w]) => w === (gk.gtr || [])[0]);
      if (want) gg2 = Gt.answer(gg2, "instr", want[1]);
    }
    if (gk.gjob && !(gg2.answers || {}).job) gg2 = Gt.say(gg2, "job:" + gk.gjob);
    if (!keep((b.answers || {}).instr, gk.instr)) b = B.answer(b, "instr", gk.instr[0]);
    // ...and the changes, which are the arranger's own but still have to be
    // changes this record has
    const chg = { ...(m.song.chg || {}) }, answers = { ...(m.song.answers || {}) };
    for (const r of CALLED) {
      const w = B.CHANGEWORD[chg[r]];
      if (chg[r] && !gk.chg.includes(w)) {
        chg[r] = Object.keys(B.CHANGEWORD).find((k) => B.CHANGEWORD[k] === gk.chg[0]);
        answers["chg:" + r] = gk.chg[0];
      }
    }
    return { ...m, drums: d, bass: b, keys: kk, guitar: gg2,
             song: { ...m.song, chg, answers } };
  }

  /* ---------- the three seats, one question at a time ----------
     NARROWED, NOT DECIDED. The genre says which grooves, which machines,
     which lines and which instruments are on the table; the player still
     picks. A filter that would leave fewer than two answers is dropped
     whole — at that point it is not a constraint, it is the arranger
     playing the drums. */
  const WORDSOF = { groove: "grooves", job: "styles", instr: "instr", form: "formw" };
  // the keys chair asks "what are you playing?" under the same id the bass
  // does, so the narrowing table is per SEAT, not per question id alone
  const KEYSOF = { instr: "keys" }, GTROF = { instr: "gtr" };
  const narrow = (m, seat, ds) => {
    const gk = genreOf(m);
    if (!gk) return ds;
    // the forms this record has, as the words the question offers
    const formw = (gk.forms || []).map((k) => FORMS[k] && FORMS[k].w).filter(Boolean);
    return ds.map((d) => {
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
  // START OVER, one chair at a time. A session where the only way back is
  // reloading the page is a session you stop experimenting in.
  function resetSeat(m, seat) {
    if (seat === "drums") return { ...m, drums: D.say(D.blank(), "start") };
    if (seat === "keys") return { ...m, keys: Ky.say(Ky.blank(), "start") };
    if (seat === "guitar") return { ...m, guitar: Gt.say(Gt.blank(), "start") };
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
  function sigNow(m) {
    let s0;
    try { s0 = toSong(m, MODESREF, 0)[0]; } catch (e) { return "?"; }
    if (!s0) return "?";
    const g = s0.genre;
    // A SILENT LANE IS NOT A LANE. `{h:[0,0,…]}` and `{}` are the same drum
    // part and different objects, and comparing the objects said two answers
    // differed when the record did not — which is exactly the lie this
    // signature exists to catch.
    const norm = (kit) => Object.fromEntries(Object.entries(kit || {})
      .filter(([, v]) => (Array.isArray(v) ? v.some(Boolean) : !!v)));
    const g2 = { ...g, kit: norm(g.kit), kits: (g.kits || []).map(norm) };
    return JSON.stringify([
      genreSig(g2), s0.pattern, s0.guitar, s0.box,
      s0.melody ? [s0.melody.phrase, genreSig(s0.melody.genre)] : null,
      mixOf(m), Id.toPhrase(m.idea), Id.regOf(m.idea),
      m.song.bpm, m.song.swing, m.song.key, m.song.minor, m.song.space, m.song.form,
      m.song.chg, m.keys.tone, m.guitar.tone, m.bass.tone,
    ]);
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
  const heardOptsNow = (m, seat, d) => {
    // A NARROWING QUESTION IS WORTH ASKING BEFORE IT CHANGES ANYTHING.
    // "What decade is it?" moves no note until the three answers collapse to
    // one record — and the pruner, which drops answers that change nothing,
    // ate the whole front door. Its options are already only the ones that
    // leave a record standing, which is the same law by a different route.
    if (d.three || d.cheap) return d.opts;   // distinct by construction
    const now = sigOf(m);
    const seen = new Map();
    return d.opts.filter((o) => {
      if (o.answered || o.active) return true;
      let sig;
      try { sig = sigOf(answer(m, seat, d.id, o.w)); } catch (e) { return true; }
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
  const knobDecisions = (m, seat) => Ask.forRole(seat).map((row) => ({
    id: "knob:" + row.field, seat, ask: row.ask, knob: row.field, cheap: true,
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
      : seat === "guitar" ? Gt.decisions(m.guitar) : B.decisions(m.bass);
    return [...narrow(m, seat, ds.filter((d) => !drop.includes(d.id))
      .map((d) => ({ ...d, seat }))), ...knobDecisions(m, seat)];
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
      if (d.answered) continue;
      const opts = heardOpts(m, s2, d);
      if (opts.length >= 2) return { ...d, opts };
    }
    return null;
  };
  // ...and the same walk, counted — what the chair rail shows
  const pending = (m, seat) => {
    let n = 0;
    for (const d of seatDecisions(m, seat)) {
      if (d.answered) continue;
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
  function answer(m, seat, id, w) {
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
      const d = (id.startsWith("idea:") ? ideaDecisions(m)
        : id.startsWith("len:") ? lenDecisions(m)
        : id.startsWith("chg:") ? callDecisions(m).map((x) => ({ ...x, seat: "arranger",
            opts: x.opts.map((o) => ({ ...o })) }))
        : ARR.map((x) => (x.three ? { ...x, opts: threeOpts(m, x.id) } : x)))
        .find((x) => x.id === id) || arrDecisions(m).find((x) => x.id === id);
      const o = d && d.opts.find((x) => x.w === w);
      if (!o) return m;
      // ...the melody's own answers land on the idea, not on the tune
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
      let out = { ...m, song };
      // WHAT KIND OF RECORD IS THIS is the drummer's own first question, and
      // the arranger has just answered it out loud. It is recorded on the
      // drummer (so their groove question is narrowed to that family) and
      // taken off their list — they are not asked what they were told.
      if (id === "genre") {
        const gk = GENRES[song.genre];
        if (gk) out.drums = D.answer(m.drums, "record", gk.fam);
        // CALLING A RECORD MAKES THE RECORD. Narrowing what a player MAY
        // choose is not the same as changing what they ARE playing, and a
        // genre that only edits a menu is a genre you cannot hear ("I change
        // the genre and nothing changes in the song"). So the call also
        // MOVES anything nobody has spoken for, and anything whose answer
        // this record does not have — a jazz ride in a punk record is not a
        // decision to respect, it is a groove that is no longer on the
        // table. A player's own answer, still available here, is untouched:
        // that is the half of the law that matters.
        if (gk) out = called(out, gk);
      }
      return out;
    }
    if (seat === "engineer") {
      const d = ENG.find((x) => x.id === id);
      if (!d || !d.opts.some((o) => o.w === w)) return m;
      return { ...m, eng: { ...(m.eng || {}), [id]: w } };
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
    return { ...m, bass: B.answer(m.bass, id, w) };
  }
  // the words each seat still has, beyond its interview
  const catalog = (m, seat) => {
    const list = seat === "drums" ? D.catalog(m.drums)
      : seat === "bass" ? B.catalog(m.bass)
      : seat === "keys" ? Ky.catalog(m.keys)
      : seat === "guitar" ? Gt.catalog(m.guitar)
      : seat === "arranger" ? Id.catalog(m.idea).filter((i) => i.group !== "start") : [];
    const gk = genreOf(m);
    if (!gk) return list;
    // the same law as the questions: a genre hides the grooves and the
    // machines that are not this record, and nothing else. Everything a
    // player does WITH a kit — the hands, the fills, the bar itself —
    // belongs to the player in every genre there is.
    return list.filter((i) => {
      const w = i.words[0];
      if (i.group.startsWith("grooves")) return (gk.grooves || []).includes(w);
      if (i.group === "the machine") return (gk.machines || []).includes(w);
      // ...and the same law for the bassist's own tray: a record that does
      // not have a walking line in it does not offer one here either
      if (i.group === "the line") return (gk.styles || []).includes(w);
      if (i.group === "what it is")
        return ((gk.keys || []).includes(w) || (gk.gtr || []).includes(w));
      if (i.group === "what you are playing" && !Ky.JOBS[i.id.replace(/^job:/, "")])
        return (gk.instr || []).includes(w);
      return true;
    });
  };
  const say = (m, seat, id) => (seat === "guitar" ? { ...m, guitar: Gt.say(m.guitar, id) }
    : seat === "arranger" ? { ...m, idea: Id.say(m.idea, id) }
    : seat === "keys" ? { ...m, keys: Ky.say(m.keys, id) }
    : seat === "drums" ? { ...m, drums: D.say(m.drums, id) }
    : seat === "bass" ? { ...m, bass: B.say(m.bass, id) } : m);
  const says = (m, seat, id) => (seat === "guitar" ? Gt.says(m.guitar, id)
    : seat === "arranger" ? Id.says(m.idea, id)
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
  const pairProg = (roots, per16, kind) => {
    const K2 = CHORDKIND[kind];
    const q = (d) => (K2 && K2.q ? { q: K2.q(((d % 7) + 7) % 7) } : {});
    const out = [];
    for (let i = 0; i < roots.length; i += per16)
      out.push(roots.slice(i, i + per16).map((d) => ({ d, beats: 16, ...q(d) })));
    return out.length ? out : [[{ d: 0, beats: 16 }]];
  };

  // `only` builds ONE section. Every signature below asks what one section
  // sounds like, and building the whole form to answer that made the
  // pruner — which runs per option, per question, per draw — cost the
  // length of the record. Absent, this is the whole take, as it was.
  function toSong(m, MODES, only) {
    if (MODES && !MODESREF) MODESREF = MODES;
    const f = FORMS[m.song.form || "vamp"];
    const secs = only == null ? f.secs
      : (f.secs[only] === undefined ? [] : [f.secs[only]]);
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
      const c = B.CHANGES[(m.song.chg || {})[key] || "fourchord"];
      let g = toGenre(m, MODES, (m.song.chg || {})[key] || "fourchord", dm, bm, km, gm);
      // how much space there is, before anything a section says: a section
      // that asks for busier hats over one-hit-every-four-bars gets them,
      // which is what asking meant
      g = spaceOut(g, SPACE[m.song.space || "none"]);
      // ...and what each player is doing HERE, if they said
      const dsec = SECDRUMS[per.drums];
      if (dsec && dsec.fn) {
        g.kit = dsec.fn(g.kit);
        g.kits = (g.kits || []).map((b) => dsec.fn(b));
      }
      const bsec = SECBASS[per.bass];
      if (bsec) {
        if (bsec.style) g.bassStyle = bsec.style;
        if (bsec.oct) g.key = g.key + 12 * bsec.oct;
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
      if (per.lift && per.drums !== "nokit") {
        const k = g.kits && g.kits.length ? g.kits.slice() : [g.kit || {}];
        const last = { ...(k[k.length - 1] || {}) };
        last.s = FILLBAR.s; last.t = FILLBAR.t;
        k[k.length - 1] = last;
        g.kits = k; g.kit = k[0];
      }
      if (per.follow) {
        const kick = (g.kits && g.kits.length ? g.kits : [g.kit || {}])
          .map((bar) => (bar && bar.k && bar.k.some(Boolean)) ? bar.k.map((v) => (v ? 1 : 0)) : 0);
        if (kick.some((x) => x)) g.bassBars = kick;
      }
      // the section's own strip, as the box fields nukernel's song already
      // has — the page writes them onto the box it builds
      // THE ARC, by where this section is in the record: the second chorus
      // is not the first one. A section that was told its own level keeps it
      // — the arc is what happens when nobody said.
      const arc = ARC[m.song.arc || "flat"];
      const nth = f.secs.slice(0, i).filter((r) => r === role).length;
      const of = f.secs.filter((r) => r === role).length;
      const shape = arc && arc.at ? arc.at(role, nth, of, i, f.secs.length) : null;
      const box = { ...((SECMIX[per.mix] || {}).box || {}),
                    ...((SECMOVE[per.move] || {}).box || {}) };
      // THE ARC OWNS THE LEVEL of the sections it shapes, and that includes
      // taking the FIRST chorus down a notch: "each chorus bigger than the
      // last" is a statement about the first one as much as the last, and a
      // rule that could only raise made the arc a no-op on a form whose
      // chorus already comes forward. A section somebody mixed by hand keeps
      // what they said — the arc is what happens when nobody did.
      if (shape && shape.lvl && !((m.per || {})[i] || {}).mix) box.lvl = shape.lvl;
      if (shape && shape.busier && !((m.per || {})[i] || {}).drums)
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
      const taker = TAKERS[per.idea] || TAKERS.no;
      if (taker.chair === "guitar" && !(per.keys && per.keys !== "same"))
        km = Ky.say(km, "job:comp");
      if (taker.chair === "keys" && !(per.guitar && per.guitar !== "same"))
        gm = Gt.say(gm, "job:strum");
      let melody = null;
      if (taker.chair && m.idea && m.idea.on) {
        const ph = Id.toPhrase(m.idea, c.roots);
        const per16 = ph.deg.length / 16;
        const lend = taker.chair === "guitar" ? Gt.toGenre(gm) : Ky.toGenre(km);
        melody = { phrase: ph, genre: {
          ...g, label: "Idea", voices: 1, part: () => "lead",
          // the idea's OWN register — a tune is not where the chords are
          realize: () => "line", reg: () => Id.regOf(m.idea),
          // the tune is on the instrument of whoever picked it up
          instr: lend.instr, tone: lend.tone,
          nobass: true, kit: {}, kits: null, bassFig: undefined,
          bars: Math.max(1, Math.ceil(g.bars / per16)),
          prog: per16 > 1 ? pairProg(c.roots, per16, m.song.chords)
                          : progOf(c.roots, m.song.chords),
        } };
      }
      // THE KEYS PLAYER'S PHRASE is the box's own pattern — a pitched voice
      // is a part AND a phrase, and only the phrase can say where the hands
      // fall. A chair that is out hands back a silent one.
      // THE SECTION'S OWN LENGTH, with the changes repeating inside it
      const bars = lenOf(m, role) || g.bars;
      return { role, i, genre: g, bars, per, melody,
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
    solo:   { drums: "ride", bass: "walk" },
  };
  const defaultsFor = (m, i) => {
    const f = FORMS[m.song.form || "vamp"];
    const role = f.secs[i], next = f.secs[i + 1];
    const d = { ...(ROLE[role] || {}) };
    // the drummer plays the band into the change; nobody has to ask
    if (next && next !== role) d.lift = true;
    return d;
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
             keys: per.keys != null ? per.keys : d.keys,
             guitar: per.guitar != null ? per.guitar : d.guitar,
             gwords: per.gwords || [],
             kwords: per.kwords || [],
             pipe: per.pipe != null ? per.pipe : d.pipe,
             mix: per.mix != null ? per.mix : d.mix,
             move: per.move != null ? per.move : d.move,
             lift: per.lift != null ? per.lift : !!d.lift,
             follow: per.follow != null ? per.follow : !!d.follow,
             dwords: per.dwords || [], bwords: per.bwords || [] };
  };

  // the fill a drummer plays into the next section — the one bar of an
  // arrangement everybody in a band can name
  const FILLBAR = { s: [0,0,0,0, 0,0,0,0, 1,0,1,1, 1,0,1,1],
                    t: [0,0,0,0, 0,0,0,0, 0,1,0,0, 0,1,0,0] };
  // the groups of a player's vocabulary that make sense said about ONE
  // SECTION. A machine is the record's, a tempo is the band's, and the bar's
  // own counting belongs to the drummer's own page; the hands, the kit, what
  // comes out and what is taken away are things you say about a chorus.
  const DGROUPS = ["at the kit", "the kit", "take away", "the fills"];
  const KGROUPS = ["what you are playing", "the bar", "the register", "at the machine"];
  const GGROUPS = ["what you are playing", "the bar", "the register", "at the amp"];
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
    const KIT = who === "drums" ? D : who === "keys" ? Ky : who === "guitar" ? Gt : B;
    const said = (who === "drums" ? per.dwords : who === "keys" ? per.kwords
      : who === "guitar" ? per.gwords : per.bwords) || [];
    let pm = who === "drums" ? m.drums : who === "keys" ? m.keys
      : who === "guitar" ? m.guitar : m.bass;
    for (const id of said) pm = KIT.say(pm, id);
    const groups = who === "drums" ? DGROUPS : who === "keys" ? KGROUPS
      : who === "guitar" ? GGROUPS : BGROUPS;
    // the HANDS first, then what is playing, then what comes out — the
    // order the words matter in when you are talking about one section
    return KIT.catalog(pm)
      .filter((x) => groups.includes(x.group))
      .sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group))
      .map((x) => ({ w: x.words[0], key: "w:" + x.id, answered: said.includes(x.id) }));
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
      s0.melody ? [s0.melody.phrase, genreSig(s0.melody.genre)] : null]);
  }

  const sectionAsks = (m, i) => {
    const per = partOf(m, i);
    // ...and the same law as the chairs': an option that would make the
    // identical section is not an option, and a question left with one is
    // not asked. (The signature here is the SECTION's, not the first one's.)
    const secSig = (mm) => secSigOf(mm, i);
    const prune = (a) => {
      const now = secSig(m), seen = new Map();
      const opts = a.opts.filter((o) => {
        if (o.answered) return true;
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
      { id: "bass", who: "the bass", opts: Object.entries(SECBASS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.bass === k || (!per.bass && k === "same") })) },
      { id: "bwords", who: "the bass player", opts: secWords(m, i, "bass") },
      { id: "idea", who: "the melody", opts: Object.entries(TAKERS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.idea === k || (!per.idea && k === "no") })) },
      { id: "pipe", who: "what comes out", opts: Object.entries(SECPIPE).map(([k, v]) => ({
          w: v.w, key: k, answered: per.pipe === k || (!per.pipe && k === "none") })) },
      { id: "mix", who: "the mix", opts: Object.entries(SECMIX).map(([k, v]) => ({
          w: v.w, key: k, answered: per.mix === k || (!per.mix && k === "same") })) },
      { id: "move", who: "the filter", opts: Object.entries(SECMOVE).map(([k, v]) => ({
          w: v.w, key: k, answered: per.move === k || (!per.move && k === "none") })) },
      { id: "band", who: "everybody", opts: [
          { w: "give it a lift", key: "lift", answered: per.lift },
          { w: "follow the kick", key: "follow", answered: per.follow } ] },
    ].map(prune).filter((a) => a.opts.length >= 2)
      // WHAT A SECTION IS ABOUT COMES FIRST. Twelve questions is a lot of
      // floor, and the melody — the one arrangement decision that changes
      // who is playing the tune — was ninth ("where is the melody question
      // in song????"). The canned parts and the calls are what you arrange
      // with; the players' whole vocabularies are underneath, for when you
      // want to say something specific.
      .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  };
  const ORDER = ["idea", "drums", "keys", "guitar", "bass", "pipe", "mix", "move", "band",
                 "dwords", "kwords", "gwords", "bwords"];
  const setSection = (m, i, who, key) => {
    const per = { ...(m.per || {}) };
    const one = { ...(per[i] || {}) };
    if (who === "band") {
      // an explicit false is a real answer here: the lift is ON by default
      // in the bar before a change, so "give it a lift" has to be sayable
      // in reverse — a band saying "don't" is saying something
      one[key] = !partOf(m, i)[key];
    } else if (who === "dwords" || who === "bwords" || who === "kwords" || who === "gwords") {
      // a word said about a section is said again to take it back
      const k = who;
      const id = String(key).slice(2);
      const list = (one[k] || []).slice();
      const at = list.indexOf(id);
      if (at >= 0) list.splice(at, 1); else list.push(id);
      if (list.length) one[k] = list; else delete one[k];
    } else if (key === "same") delete one[who];
    else one[who] = key;
    if (Object.keys(one).length) per[i] = one; else delete per[i];
    return { ...m, per };
  };

  function toGenre(m, MODES, changes, dm, bm, km, gm) {
    const drums = dm || m.drums, bass = bm || m.bass, keys = km || m.keys;
    const gtr = gm || m.guitar;
    const gk = genreOf(m);
    const kg = Ky.toGenre(keys), gg = Gt.toGenre(gtr);
    // TWO PITCHED CHAIRS, TWO VOICES. Each takes its own phrase (the box's
    // stack lists a slot per voice — derive.js walks phrase pi to voice pi),
    // its own part, its own register and its own instrument. A chair that is
    // out keeps its voice and hands back an empty phrase, so nothing
    // downstream has to know who is in the room.
    const chairs = [{ part: kg.part(0), reg: kg.reg(0), instr: kg.instr, tone: kg.tone,
                      pad: kg.realize(0) === "pad" },
                    { part: gg.part, reg: gg.reg, instr: gg.instr, tone: gg.tone,
                      pad: gg.pad }];
    const dg = D.toGenre(drums);
    const c = B.CHANGES[changes || (m.song.chg || {}).verse || "fourchord"];
    return {
      label: "Band", family: "kernel", rate: 1, bars: c.bars,
      entry: () => 0,
      // ...and the keys player's own chair: the PART they are playing, where
      // they sit, and what it is. A silent chair keeps the voice (the phrase
      // is empty) so nothing downstream has to know they are out.
      voices: 2,
      reg: (v) => chairs[v % 2].reg,
      realize: (v) => (chairs[v % 2].pad ? "pad" : "line"),
      part: (v) => chairs[v % 2].part,
      harmony: "cycle", roots: c.roots.slice(),
      // ...and the chords themselves, if a kind was called. `prog` outranks
      // `roots` in chordsOf, and carries the quality the roots cannot.
      prog: progOf(c.roots, m.song.chords),
      instr: chairs.map((c) => c.instr),
      // the drummer's kit, over whatever length the tune is (kernel's `at`
      // wraps a shorter schedule across a longer form)
      kit: dg.kit, kits: dg.kits, drumkit: dg.drumkit, humanize: dg.humanize,
      kitVel: dg.kitVel,
      // the bassist's line, in the arranger's key
      nobass: false, bassStyle: B.STYLES[bass.style],
      key: (B.KEYS[m.song.key] || 0) + 12 * (bass.oct || 0),
      mode: MODES ? (m.song.minor ? MODES.dorian : MODES.ionian) : undefined,
      artic: bass.artic || (gk && gk.artic) || undefined,
      bassArtic: bass.artic || (gk && gk.artic) || undefined,
      // A RECORD BRINGS ITS OWN LINE. House is offbeats, techno is an acid
      // line, disco is octaves — those are not densities, they are figures,
      // and a bassist who has written their own outranks the record.
      bassFig: bass.fig || (gk && gk.fig && B.FIGURES[gk.fig]) || undefined,
      bassNudge: bass.sit ? bass.sit * 2 : undefined,
      // WHAT THE BASS SOUNDS LIKE, per record. A synth bass with no tone of
      // its own ran on the engine's defaults and played one continuous line
      // — no filter, and a gate that lasted as long as the note. A record
      // names its own: a house bass is short and closed, a jazz bass is open
      // and long, and the slow one rings.
      // ...with the PLAYER'S OWN PANEL over it: a bassist sitting at a 303
      // turns the filter, and the record does not get to hold it shut
      bassTone: { wave: "saw", ...(gk && gk.tone ? gk.tone : { cut: 800, q: 4, rel: 0.22 }),
                  atk: 0.004, gain: 0.34, ...(bass.tone || {}) },
      tone: kg.tone, chairs,
      words: [], word: () => [],
    };
  }
  // (the annotated knobs are merged in toSong, over whatever the chairs made)

  return { SEATS, TAKEN, FORMS, CALLED, GENRES, SPACE, ROLE, ENG, SECMIX, SECMOVE, mixOf,
           resetSeat,
           genreOf, rolesIn, asked, pending, sigOf, secSigOf, survivors, FIELDS3, Ask,
           secWords, partOf,
           blank, decisions, seatDecisions,
           nextAsk, nextAnywhere, answer, catalog, say, says, toGenre, toSong,
           SECDRUMS, SECBASS, SECKEYS, SECPIPE, CHORDKIND, LENS, ARC, TAKERS,
           sectionAsks, setSection,
           D, B, Ky, Id, Gt };
});
