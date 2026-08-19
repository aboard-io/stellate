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
  const TAKEN = { drums: ["tempo", "feel"], bass: ["key", "mode", "changes", "tempo", "feel"] };

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
    { id: "key", ask: "what key are we in?", opts: Object.keys(B.KEYS).map((k) => ({
        w: "in " + k, is: (s) => s.key === k, apply: (s) => ({ ...s, key: k }) })) },
    { id: "mode", ask: "major or minor?", opts: [
      { w: "major", is: (s) => !s.minor, apply: (s) => ({ ...s, minor: false }) },
      { w: "minor", is: (s) => s.minor, apply: (s) => ({ ...s, minor: true }) } ] },
    { id: "form", ask: "what's the form?", opts:
      Object.entries(FORMS).map(([k, f]) => ({
        w: f.w, is: (s) => s.form === k, apply: (s) => ({ ...s, form: k }) })) },
    { id: "tempo", ask: "how fast do we take it?", opts: [
      { w: "slow, 72", is: (s) => s.bpm === 72, apply: (s) => ({ ...s, bpm: 72 }) },
      { w: "medium, 96", is: (s) => s.bpm === 96, apply: (s) => ({ ...s, bpm: 96 }) },
      { w: "up, 120", is: (s) => s.bpm === 120, apply: (s) => ({ ...s, bpm: 120 }) },
      { w: "fast, 144", is: (s) => s.bpm === 144, apply: (s) => ({ ...s, bpm: 144 }) } ] },
    { id: "feel", ask: "straight or swung?", opts: [
      { w: "straight", is: (s) => !s.swing, apply: (s) => ({ ...s, swing: null }) },
      { w: "swung", is: (s) => s.swing === "swing", apply: (s) => ({ ...s, swing: "swing" }) },
      { w: "shuffled", is: (s) => s.swing === "shuffle", apply: (s) => ({ ...s, swing: "shuffle" }) } ] },
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

  /* ---------- the three seats, one question at a time ---------- */
  const seatDecisions = (m, seat) => {
    if (seat === "arranger") return arrDecisions(m);
    const drop = TAKEN[seat] || [];
    const ds = seat === "drums" ? D.decisions(m.drums) : B.decisions(m.bass);
    return ds.filter((d) => !drop.includes(d.id)).map((d) => ({ ...d, seat }));
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
      return { ...m, song };
    }
    if (seat === "drums") return { ...m, drums: D.answer(m.drums, id, w) };
    return { ...m, bass: B.answer(m.bass, id, w) };
  }
  // the words each seat still has, beyond its interview
  const catalog = (m, seat) => (seat === "drums" ? D.catalog(m.drums)
    : seat === "bass" ? B.catalog(m.bass) : []);
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
      const g = toGenre(m, MODES, (m.song.chg || {})[key] || "fourchord");
      const per = (m.per || {})[i] || {};
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
      // an intro is the band arriving and an outro is the band leaving
      if (role === "intro" && !per.drums) g.kit = { ...g.kit, s: (g.kit.s || []).map(() => 0) };
      return { role, i, genre: g, bars: g.bars, per };
    });
  }
  // what a section can be asked, and how it is answered
  const sectionAsks = (m, i) => [
    { id: "drums", who: "the drums", opts: Object.entries(SECDRUMS).map(([k, v]) => ({
        w: v.w, key: k, answered: ((m.per || {})[i] || {}).drums === k ||
          (!((m.per || {})[i] || {}).drums && k === "same") })) },
    { id: "bass", who: "the bass", opts: Object.entries(SECBASS).map(([k, v]) => ({
        w: v.w, key: k, answered: ((m.per || {})[i] || {}).bass === k ||
          (!((m.per || {})[i] || {}).bass && k === "same") })) },
  ];
  const setSection = (m, i, who, key) => {
    const per = { ...(m.per || {}) };
    const one = { ...(per[i] || {}) };
    if (key === "same") delete one[who]; else one[who] = key;
    if (Object.keys(one).length) per[i] = one; else delete per[i];
    return { ...m, per };
  };

  function toGenre(m, MODES, changes) {
    const dg = D.toGenre(m.drums);
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
      nobass: false, bassStyle: B.STYLES[m.bass.style],
      key: (B.KEYS[m.song.key] || 0) + 12 * (m.bass.oct || 0),
      mode: MODES ? (m.song.minor ? MODES.dorian : MODES.ionian) : undefined,
      artic: m.bass.artic || undefined,
      tone: { wave: "sine", cut: 900, q: 1, atk: 0.01, rel: 0.25, gain: 0.001, verb: 0.08 },
      words: [], word: () => [],
    };
  }

  return { SEATS, TAKEN, FORMS, CALLED, rolesIn, blank, decisions, seatDecisions,
           nextAsk, nextAnywhere, answer, catalog, say, says, toGenre, toSong,
           SECDRUMS, SECBASS, sectionAsks, setSection, D, B };
});
