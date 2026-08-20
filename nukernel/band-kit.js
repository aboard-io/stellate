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
    typeof require !== "undefined" ? require("./bass-kit.js") : root.NuBass);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuBand = api;
})(typeof self !== "undefined" ? self : this, function (D, B) {
  "use strict";

  const SEATS = ["arranger", "drums", "bass"];
  // the questions the ARRANGER has already answered, so the players stop
  // asking them: a drummer does not set the tempo, a bassist does not pick
  // the key
  const TAKEN = { drums: ["tempo", "feel", "record"],
                  bass: ["key", "mode", "changes", "tempo", "feel"] };

  const blank = () => ({ on: false, seat: "arranger",
    song: { key: "C", minor: false, form: null, chg: {}, bpm: 96, swing: null, answers: {} },
    drums: D.say(D.blank(), "start"), bass: B.say(B.blank(), "start") });

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
    busier:   { w: "busier", fn: (k) => ({ ...k, h: new Array(16).fill(1) }) },
    sparser:  { w: "sparser", fn: (k) => ({ k: hitsAt(0, 8), s: hitsAt(4, 12) }) },
    ride:     { w: "move to the ride", fn: (k) => ({ ...k, p: k.h || z16(), h: z16() }) },
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
    house:   { w: "a house record", fam: "the floor", bpm: 120,
               grooves: ["house", "four on the floor", "disco", "uk garage"],
               machines: ["909", "808", "electronic kit"],
               styles: ["hold the root", "octaves", "eighths, driving"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["the four-chord one", "a minor vamp", "one chord, all night"] },
    techno:  { w: "a techno record", fam: "the floor", bpm: 120,
               grooves: ["techno", "four on the floor", "gabber"],
               machines: ["909", "606", "electronic kit"],
               styles: ["hold the root", "eighths, driving", "sixteenths, busy"],
               instr: ["a synth bass", "with a pick"],
               chg: ["one chord, all night", "a pedal point", "a minor vamp"] },
    disco:   { w: "a disco record", fam: "the floor", bpm: 120,
               grooves: ["disco", "four on the floor", "two step"],
               machines: ["acoustic kit", "room kit", "909"],
               styles: ["octaves", "eighths, driving", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["the four-chord one", "two-five-one", "the fifties changes"] },
    hiphop:  { w: "a boom-bap record", fam: "breaks", bpm: 96,
               grooves: ["boom bap", "breakbeat", "trap"],
               machines: ["808", "909", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["a minor vamp", "one chord, all night", "two-five-one"] },
    jungle:  { w: "a jungle record", fam: "breaks", bpm: 144,
               grooves: ["amen break", "jungle", "breakbeat"],
               machines: ["electronic kit", "909", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "with a pick"],
               chg: ["a minor vamp", "one chord, all night"] },
    rock:    { w: "a rock record", fam: "rock", bpm: 120,
               grooves: ["straight rock", "driving rock", "stomp", "half time"],
               machines: ["acoustic kit", "room kit", "big kit"],
               styles: ["hold the root", "eighths, driving", "root and fifth"],
               instr: ["with a pick", "fingers on a P-bass"],
               chg: ["the fifties changes", "the four-chord one", "a twelve-bar blues"] },
    punk:    { w: "a punk record", fam: "rock", bpm: 144,
               grooves: ["punk", "driving rock", "stomp"],
               machines: ["acoustic kit", "big kit"],
               styles: ["eighths, driving", "hold the root"],
               instr: ["with a pick", "fingers on a P-bass"],
               chg: ["the four-chord one", "the fifties changes"] },
    kraut:   { w: "a krautrock record", fam: "rock", bpm: 120,
               grooves: ["motorik", "bare bones", "half time"],
               machines: ["electronic kit", "room kit", "606"],
               styles: ["hold the root", "eighths, driving"],
               instr: ["a synth bass", "with a pick"],
               chg: ["one chord, all night", "a pedal point"] },
    jazz:    { w: "a jazz date", fam: "jazz", bpm: 144, swing: "swing",
               grooves: ["jazz ride", "bebop", "brush swing"],
               machines: ["jazz kit", "brushes", "acoustic kit"],
               styles: ["walk it", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["two-five-one", "a twelve-bar blues", "the fifties changes"] },
    blues:   { w: "a blues", fam: "rock", bpm: 96, swing: "shuffle",
               grooves: ["shuffle", "train beat", "straight rock"],
               machines: ["acoustic kit", "room kit", "brushes"],
               styles: ["walk it", "root and fifth", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["a twelve-bar blues", "the fifties changes"] },
    funk:    { w: "a funk record", fam: "funk", bpm: 96,
               grooves: ["funk", "linear funk", "new orleans", "motown"],
               machines: ["acoustic kit", "room kit", "808"],
               styles: ["sixteenths, busy", "octaves", "hold the root"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["one chord, all night", "a minor vamp"] },
    reggae:  { w: "a reggae record", fam: "latin", bpm: 96,
               grooves: ["one drop", "steppers", "rockers"],
               machines: ["acoustic kit", "room kit", "808"],
               styles: ["hold the root", "octaves"],
               instr: ["fingers on a P-bass", "a synth bass"],
               chg: ["a minor vamp", "one chord, all night"] },
    bossa:   { w: "a bossa", fam: "latin", bpm: 120,
               grooves: ["bossa nova", "samba", "rumba", "cha cha"],
               machines: ["jazz kit", "brushes", "acoustic kit"],
               styles: ["hold the root", "octaves"],
               instr: ["fingers on a P-bass", "with a pick"],
               chg: ["two-five-one", "the four-chord one"] },
    slow:    { w: "something slow and open", fam: "rock", bpm: 72, space: "four",
               grooves: ["bare bones", "half time"],
               machines: ["electronic kit", "room kit", "808"],
               styles: ["hold the root", "octaves"],
               instr: ["a synth bass", "fingers on a P-bass"],
               chg: ["a pedal point", "one chord, all night"] },
  };
  const genreOf = (m) => GENRES[m.song.genre] || null;

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
  const FORMS = {
    vamp:     { w: "one vamp, round and round", secs: ["verse"] },
    blues:    { w: "a blues, three choruses", secs: ["verse", "verse", "verse"] },
    versechorus: { w: "verse, chorus", secs: ["verse", "chorus"] },
    pop:      { w: "verse, chorus, verse, chorus", secs: ["verse", "chorus", "verse", "chorus"] },
    aaba:     { w: "AABA", secs: ["verse", "verse", "bridge", "verse"] },
    full:     { w: "intro, verse, chorus, bridge, chorus, outro",
                secs: ["intro", "verse", "chorus", "bridge", "chorus", "outro"] },
  };
  // the roles that need their own changes called (an intro and an outro take
  // the verse's, the way a band would)
  const CALLED = ["verse", "chorus", "bridge"];
  const rolesIn = (m) => {
    const f = FORMS[m.song.form || "vamp"];
    return CALLED.filter((r) => f.secs.includes(r));
  };

  /* ---------- WHAT THE ARRANGER DECIDES ---------- */
  const ARR = [
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
          swing: !(s.answers || {}).feel ? (gk.swing || null) : s.swing,
          space: !(s.answers || {}).space ? (gk.space || "none") : s.space }) })) },
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
  const callDecisions = (m) => (m.song.form ? rolesIn(m) : []).map((r) => ({
    id: "chg:" + r, seat: "arranger", ask: "what are the " + r + " changes?",
    opts: Object.entries(B.CHANGEWORD).map(([k, w]) => ({
      w, is: (s) => (s.chg || {})[r] === k,
      apply: (s) => ({ ...s, chg: { ...(s.chg || {}), [r]: k } }) })),
  }));
  const arrDecisions = (m) => [...ARR, ...callDecisions(m)].map((d) => ({
    ...d, seat: "arranger", answered: (m.song.answers || {})[d.id] || null,
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
    return { ...m, drums: d, bass: b, song: { ...m.song, chg, answers } };
  }

  /* ---------- the three seats, one question at a time ----------
     NARROWED, NOT DECIDED. The genre says which grooves, which machines,
     which lines and which instruments are on the table; the player still
     picks. A filter that would leave fewer than two answers is dropped
     whole — at that point it is not a constraint, it is the arranger
     playing the drums. */
  const WORDSOF = { groove: "grooves", job: "styles", instr: "instr" };
  const narrow = (m, seat, ds) => {
    const gk = genreOf(m);
    if (!gk) return ds;
    return ds.map((d) => {
      const keep = gk[WORDSOF[d.id]];
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
  const seatDecisions = (m, seat) => {
    if (seat === "arranger") return narrow(m, seat, arrDecisions(m));
    const drop = TAKEN[seat] || [];
    const ds = seat === "drums" ? D.decisions(m.drums) : B.decisions(m.bass);
    return narrow(m, seat, ds.filter((d) => !drop.includes(d.id))
      .map((d) => ({ ...d, seat })));
  };
  const decisions = (m) => SEATS.flatMap((s) => seatDecisions(m, s));
  const nextAsk = (m, seat) => seatDecisions(m, seat || m.seat).find((d) => !d.answered) || null;
  // the whole band's next question, in session order: the tune first, then
  // the drummer, then the bass
  const nextAnywhere = (m) => {
    for (const s of SEATS) { const q = nextAsk(m, s); if (q) return { ...q, seat: s }; }
    return null;
  };
  function answer(m, seat, id, w) {
    if (seat === "arranger") {
      const d = arrDecisions(m).find((x) => x.id === id);
      const o = d && d.opts.find((x) => x.w === w);
      if (!o) return m;
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
    if (seat === "drums") return { ...m, drums: D.answer(m.drums, id, w) };
    return { ...m, bass: B.answer(m.bass, id, w) };
  }
  // the words each seat still has, beyond its interview
  const catalog = (m, seat) => {
    const list = seat === "drums" ? D.catalog(m.drums)
      : seat === "bass" ? B.catalog(m.bass) : [];
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
      return true;
    });
  };
  const say = (m, seat, id) => (seat === "drums" ? { ...m, drums: D.say(m.drums, id) }
    : seat === "bass" ? { ...m, bass: B.say(m.bass, id) } : m);
  const says = (m, seat, id) => (seat === "drums" ? D.says(m.drums, id)
    : seat === "bass" ? B.says(m.bass, id) : "");

  /* ---------- ONE GENRE, BOTH PLAYERS -------------------------------------
     The kit is the drummer's, the line is the bassist's, and the key, the
     changes and the length are the arranger's — which is the only way the
     two parts can be about the same tune. */
  // THE WHOLE TAKE: one section per part of the form, each with its own
  // changes, and the players' own decisions under all of them. What a band
  // plays is a FORM, not a loop.
  function toSong(m, MODES) {
    const f = FORMS[m.song.form || "vamp"];
    return f.secs.map((role, i) => {
      const key = (role === "intro" || role === "outro") ? "verse" : role;
      const per = partOf(m, i);
      // WHAT A PLAYER DOES HERE IS SAID IN THEIR OWN WORDS. A bandleader
      // does not hand the drummer eight canned options for the chorus; they
      // say "swap hands", "ride it", "ghost the snare", "leave the kick" —
      // the same things the drummer says to themselves. So a section runs
      // the player's OWN vocabulary over a copy of that player, and what
      // comes out is this section's part. The player's song-wide decisions
      // are untouched: this is one chorus, not a new drummer.
      let dm = m.drums, bm = m.bass;
      for (const id of per.dwords || []) dm = D.say(dm, id);
      for (const id of per.bwords || []) bm = B.say(bm, id);
      let g = toGenre(m, MODES, (m.song.chg || {})[key] || "fourchord", dm, bm);
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
      return { role, i, genre: g, bars: g.bars, per };
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
    intro:  { drums: "hatsonly", bass: "pedal" },
    verse:  {},
    chorus: { drums: "busier", bass: "octave" },
    bridge: { drums: "ride", bass: "walk" },
    outro:  { drums: "sparser", bass: "pedal" },
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
  // WHAT A BASSIST IS TOLD ABOUT ONE SECTION: the line, how the notes come
  // out, the register, and where they sit against the drums. Not which bass
  // they are holding — nobody changes instrument for the chorus — and not
  // the changes, the key or the tempo, which are the arranger's.
  const BGROUPS = ["the line", "how you play them", "the register", "the feel"];
  const secWords = (m, i, who) => {
    const per = partOf(m, i);
    const said = (who === "drums" ? per.dwords : per.bwords) || [];
    let pm = who === "drums" ? m.drums : m.bass;
    for (const id of said) pm = (who === "drums" ? D : B).say(pm, id);
    const groups = who === "drums" ? DGROUPS : BGROUPS;
    // the HANDS first, then what is playing, then what comes out — the
    // order the words matter in when you are talking about one section
    return (who === "drums" ? D.catalog(pm) : B.catalog(pm))
      .filter((x) => groups.includes(x.group))
      .sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group))
      .map((x) => ({ w: x.words[0], key: "w:" + x.id, answered: said.includes(x.id) }));
  };
  // what a section can be asked, and how it is answered
  const sectionAsks = (m, i) => {
    const per = partOf(m, i);
    return [
      { id: "drums", who: "the drums", opts: Object.entries(SECDRUMS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.drums === k || (!per.drums && k === "same") })) },
      { id: "dwords", who: "at the kit", opts: secWords(m, i, "drums") },
      { id: "bass", who: "the bass", opts: Object.entries(SECBASS).map(([k, v]) => ({
          w: v.w, key: k, answered: per.bass === k || (!per.bass && k === "same") })) },
      { id: "bwords", who: "the bass player", opts: secWords(m, i, "bass") },
      { id: "band", who: "everybody", opts: [
          { w: "give it a lift", key: "lift", answered: per.lift },
          { w: "follow the kick", key: "follow", answered: per.follow } ] },
    ].filter((a) => a.opts.length);
  };
  const setSection = (m, i, who, key) => {
    const per = { ...(m.per || {}) };
    const one = { ...(per[i] || {}) };
    if (who === "band") {
      // an explicit false is a real answer here: the lift is ON by default
      // in the bar before a change, so "give it a lift" has to be sayable
      // in reverse — a band saying "don't" is saying something
      one[key] = !partOf(m, i)[key];
    } else if (who === "dwords" || who === "bwords") {
      // a word said about a section is said again to take it back
      const k = who === "dwords" ? "dwords" : "bwords";
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

  function toGenre(m, MODES, changes, dm, bm) {
    const drums = dm || m.drums, bass = bm || m.bass;
    const dg = D.toGenre(drums);
    const c = B.CHANGES[changes || (m.song.chg || {}).verse || "fourchord"];
    return {
      label: "Band", family: "kernel", rate: 1, bars: c.bars, voices: 1,
      entry: () => 0, reg: () => 0, realize: () => "line",
      harmony: "cycle", roots: c.roots.slice(),
      instr: "yamaha_grand_piano",
      // the drummer's kit, over whatever length the tune is (kernel's `at`
      // wraps a shorter schedule across a longer form)
      kit: dg.kit, kits: dg.kits, drumkit: dg.drumkit, humanize: dg.humanize,
      kitVel: dg.kitVel,
      // the bassist's line, in the arranger's key
      nobass: false, bassStyle: B.STYLES[bass.style],
      key: (B.KEYS[m.song.key] || 0) + 12 * (bass.oct || 0),
      mode: MODES ? (m.song.minor ? MODES.dorian : MODES.ionian) : undefined,
      artic: bass.artic || undefined,
      bassNudge: bass.sit ? bass.sit * 2 : undefined,
      tone: { wave: "sine", cut: 900, q: 1, atk: 0.01, rel: 0.25, gain: 0.001, verb: 0.08 },
      words: [], word: () => [],
    };
  }

  return { SEATS, TAKEN, FORMS, CALLED, GENRES, SPACE, ROLE, genreOf, rolesIn,
           secWords, partOf,
           blank, decisions, seatDecisions,
           nextAsk, nextAnywhere, answer, catalog, say, says, toGenre, toSong,
           SECDRUMS, SECBASS, sectionAsks, setSection, D, B };
});
