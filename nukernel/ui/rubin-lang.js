// ui/rubin-lang.js — RUBINESQUE, the language. Pure: no DOM, no state, no
// audio — a lexicon, a grammar and a compiler, so every sentence the couch
// can say is provable in node.
//
// THE COUCH SPEAKS SENTENCES — MAKE DRUMS BIGGER, BRING UP ECHO ON DRUMS,
// ADD MORE COMPRESSION, MAKE THE KICK HUGE, REDO THE MELODY, MAKE EVERYTHING
// FUNKIER, MAKE THE MELODY PIANO, MAKE GUITAR DISTORTED, MAKE VOCALS CRUNCH,
// THINK MORE PUNK. Synonyms are the point; the law of the tray is EXACTNESS
// (only words that still lead to a compilable sentence) plus COMPLETENESS
// (every compilable sentence's words are offered at their step), and the
// GRAMMAR READS THE RECORD: a sentence about something the record does not
// have is not a sentence there (ctx below).
//
// Scopes: SONG lands on the board's offset layer — which addresses three
// ways (a part chan "drums", a UNIT chan "unit:kick", an INSTRUMENT chan
// "inst:guitar" / "vocals"; audio/desk.js resolves all three) — plus the
// tempo, the pool and every-section ops. SECTION lands on that box's own
// fields. Five standing commands per node.

/* ---------- the lexicon ---------- */
const V = {
  up:   ["bring up", "turn up", "push", "boost", "raise", "lift", "pump up", "crank", "up"],
  down: ["bring down", "turn down", "pull back", "lower", "drop", "ease", "back off", "down"],
  more: ["add", "add more", "give me more", "more", "double", "stack"],
  less: ["cut", "remove", "strip", "lose", "kill", "less", "fewer", "thin out", "take out"],
  make: ["make", "get", "i want", "make it", "let it be"],
  think: ["think", "channel", "feel", "lean"],
  redo: ["redo", "rewrite", "try another", "flip"],
};
const S = {
  drums:  ["drums", "the drums", "kit", "the kit", "beat", "the beat", "percussion"],
  bass:   ["bass", "the bass", "low end", "the bottom"],
  melody: ["melody", "the melody", "lead", "the lead", "the tune", "top line", "the hook"],
  chords: ["chords", "the chords", "pads", "the pad", "harmony", "the bed"],
  vocals: ["vocals", "the vocals", "the voice", "the singer", "vox"],
  notes:  ["notes", "the notes"],
  reverb: ["reverb", "the reverb", "verb", "space", "the room", "air"],
  echo:   ["echo", "the echo", "delay", "the delay", "repeats"],
  compression: ["compression", "glue", "squash", "comp"],
  song:   ["everything", "it", "it all", "the song", "the whole thing", "the record", "the track"],
};
const U = {
  kick:  { syns: ["kick", "the kick", "kick drum", "bass drum"], unit: "kick" },
  snare: { syns: ["snare", "the snare", "backbeat"], unit: "snare" },
  hats:  { syns: ["hats", "the hats", "hihat", "cymbals"], unit: "hat" },
};
const I = {
  guitar:  { syns: ["guitar", "the guitar", "guitars"], chan: "guitar", cast: "clean_guitar" },
  piano:   { syns: ["piano", "the piano", "keys"], chan: "piano", cast: "yamaha_grand_piano" },
  organ:   { syns: ["organ", "the organ"], chan: "organ", cast: "rock_organ" },
  strings: { syns: ["strings", "the strings"], chan: "strings", cast: "slow_strings" },
  horns:   { syns: ["horns", "brass", "the horns"], chan: "horns", cast: "brass_section" },
  bells:   { syns: ["bells", "vibes"], chan: "bells", cast: "vibraphone" },
};
const A = {
  bigger:   ["bigger", "big", "fatter", "fat", "huge", "massive", "thicker"],
  smaller:  ["smaller", "small", "thinner", "leaner"],
  louder:   ["louder", "loud", "hotter", "forward"],
  quieter:  ["quieter", "quiet", "softer", "back"],
  brighter: ["brighter", "bright", "shinier", "crisper"],
  darker:   ["darker", "dark", "duller", "moodier"],
  warmer:   ["warmer", "warm", "rounder", "smoother"],
  wetter:   ["wetter", "wet", "roomier", "spacier"],
  drier:    ["drier", "dry", "closer", "in your face"],
  high:     ["high", "the high", "top", "upper"],
  low:      ["low", "the low", "deep"],
  more:     ["more", "extra"],
  fewer:    ["fewer", "less", "sparser"],
  faster:   ["faster", "quicker", "uptempo"],
  slower:   ["slower", "lazier", "laid back"],
  busier:   ["busier", "busy", "wilder"],
  simpler:  ["simpler", "simple", "sparse", "minimal"],
  open:     ["open", "opening", "blooming"],
  closed:   ["closed", "closing", "sinking"],
};
// HOW THE PLAYERS PLAY — the direction a producer gives a musician, in that
// musician's own vocabulary ("I want to tell the musicians how to be. Make
// bass slappier"). Each table is <adjective> -> the registry word that IS
// that instruction, so the couch reaches the sequencer's own operators.
const BASSFEEL = {                       // fields.js BASSOPS
  slappier: "sixteenths", walking: "walk", bouncier: "octaves",
  simpler_bass: "pedal", driving: "eighths", growlier: "reese",
  wobblier: "wobble", wider: "fifths",
};
const BASSWORD = {
  slappier: ["slappier", "slappy", "poppier"], walking: ["walking", "walky"],
  bouncier: ["bouncier", "in octaves"], simpler_bass: ["on one note", "pedalling"],
  driving: ["driving", "on eighths"], growlier: ["growlier", "nastier"],
  wobblier: ["wobblier", "wobbly"], wider: ["in fifths"],
};
const KITFEEL = {                        // kernel.js KITOPS, by ear
  four_floor: "four", offbeat_kit: "offbeat", halftime: "halftime",
  doubletime: "doubletime", shuffling: "shuffle", ghosted: "ghosts",
  flammed: "flams", riding: "ride", tighter: "tight", looser: "humanize",
  wilder_kit: "chaos", harder: "loud", gentler: "soft", linear_kit: "linear",
  stomping: "stomp", clapping: "claps", rolling: "roll",
};
const KITWORD = {
  four_floor: ["four on the floor"], offbeat_kit: ["offbeat"],
  halftime: ["half time"], doubletime: ["double time"],
  shuffling: ["shuffling"], ghosted: ["ghosted", "with ghost notes"],
  flammed: ["flammed"], riding: ["on the ride"], tighter: ["tighter"],
  looser: ["looser", "sloppier"], wilder_kit: ["wilder"], harder: ["harder"],
  gentler: ["gentler"], linear_kit: ["linear"], stomping: ["stomping"],
  clapping: ["with claps"], rolling: ["rolling"],
};
const FEELWORD = {                       // the record's own groove and swing
  swinging: { groove: null, swing: "swing" },
  shuffled:  { swing: "shuffle" },
  straighter: { swing: "straight" },
  laidback:  { groove: "laidback" },
  pushed:    { groove: "push" },
  funkier_feel: { groove: "funk" },
  dubbed:    { groove: "dub" },
  backbeaten: { groove: "backbeat" },
};
const FEELSYN = {
  swinging: ["swinging"], shuffled: ["shuffled"], straighter: ["straighter"],
  laidback: ["laid back behind"], pushed: ["pushing"], funkier_feel: ["with a funk feel"],
  dubbed: ["with a dub feel"], backbeaten: ["on the backbeat"],
};
const FXA = {
  crunch:  { syns: ["distorted", "crunchy", "crunch", "dirty", "gritty", "overdriven", "fuzzy"], chip: "crunch" },
  chorus:  { syns: ["chorused", "watery", "lush"], chip: "chorus" },
  phaser:  { syns: ["phased", "swirly"], chip: "phaser" },
  flanger: { syns: ["flanged", "jet plane"], chip: "flanger" },
  tremolo: { syns: ["trembling", "shivering", "pulsing"], chip: "tremolo" },
  leslie:  { syns: ["spinning", "rotary"], chip: "leslie" },
  wah:     { syns: ["quacky", "talky"], chip: "wah" },
  ringmod: { syns: ["robotic", "ring modulated", "alien"], chip: "ringmod" },
  sweep:   { syns: ["sweeping", "filtered"], chip: "sweep" },
  fenv:    { syns: ["squelchy", "auto-wah"], chip: "fenv" },
  echofx:  { syns: ["echoing", "dubbed out", "bouncing"], chip: "echo" },
};
const FXN = {
  crunch:  ["distortion", "drive", "fuzz", "grit"],
  chorus:  ["chorus"], phaser: ["phaser"], flanger: ["flanger"],
  tremolo: ["tremolo"], leslie: ["a leslie"], wah: ["a wah"],
  ringmod: ["ring mod"], sweep: ["a filter sweep"], fenv: ["an envelope filter"],
};
const G = {
  punk:      { syns: ["punk", "punkier", "punk rock"], anchor: "punk" },
  pop:       { syns: ["pop", "poppier", "poppy"], anchor: "clubpop" },
  rock:      { syns: ["rock", "rockier"], anchor: "rock" },
  jazz:      { syns: ["jazz", "jazzier", "jazzy"], anchor: "jazz" },
  funk:      { syns: ["funk", "funkier", "funky"], anchor: "funk" },
  disco:     { syns: ["disco"], anchor: "disco" },
  techno:    { syns: ["techno"], anchor: "techno" },
  acid:      { syns: ["acid house"], anchor: "acid" },
  house:     { syns: ["house"], anchor: "house" },
  dub:       { syns: ["dub", "dubbier", "dubby"], anchor: "dub" },
  reggae:    { syns: ["reggae"], anchor: "reggae" },
  gospel:    { syns: ["gospel", "church"], anchor: "gospel" },
  blues:     { syns: ["blues", "bluesier", "bluesy"], anchor: "blues" },
  soul:      { syns: ["soul", "soulful"], anchor: "blueeyedsoul" },
  rnb:       { syns: ["r&b"], anchor: "rnb" },
  hiphop:    { syns: ["hip hop", "boom bap"], anchor: "boombap" },
  trap:      { syns: ["trap"], anchor: "trap" },
  metal:     { syns: ["metal", "heavier"], anchor: "industrialmetal" },
  folk:      { syns: ["folk", "folkier", "folky"], anchor: "softfolk" },
  country:   { syns: ["country"], anchor: "altcountry" },
  ambient:   { syns: ["ambient", "atmospheric"], anchor: "ambient" },
  motown:    { syns: ["motown"], anchor: "motown" },
  dnb:       { syns: ["jungle"], anchor: "dnb" },
  vaporwave: { syns: ["vaporwave"], anchor: "vaporwave" },
  shoegaze:  { syns: ["shoegaze"], anchor: "shoegaze" },
  newwave:   { syns: ["new wave"], anchor: "newwave" },
  kraftwerk: { syns: ["kraftwerk"], anchor: "kraftwerk" },
  choir:     { syns: ["choir", "choral"], anchor: "spem" },
  bossa:     { syns: ["bossa nova"], anchor: "bossa" },
  garage:    { syns: ["uk garage"], anchor: "garage" },
};

const WORDS = {};
const put = (w, role, canon) => { if (!WORDS[w]) WORDS[w] = { role, canon }; };
for (const [c, syns] of Object.entries(V)) for (const w of syns) put(w, "verb", c);
for (const [c, syns] of Object.entries(S)) for (const w of syns) put(w, "subj", c);
for (const [c, g] of Object.entries(U)) for (const w of g.syns) put(w, "unit", c);
for (const [c, g] of Object.entries(I)) for (const w of g.syns) put(w, "inst", c);
for (const [c, syns] of Object.entries(A)) for (const w of syns) put(w, "adj", c);
for (const [c, g] of Object.entries(FXA)) for (const w of g.syns) put(w, "fxadj", c);
for (const [c, syns] of Object.entries(FXN)) for (const w of syns) put(w, "fxn", c);
for (const [c, g] of Object.entries(G)) for (const w of g.syns) put(w, "gen", c);
for (const [c, syns] of Object.entries(BASSWORD)) for (const w of syns) put(w, "bassadj", c);
for (const [c, syns] of Object.entries(KITWORD)) for (const w of syns) put(w, "kitadj", c);
for (const [c, syns] of Object.entries(FEELSYN)) for (const w of syns) put(w, "feeladj", c);
// THE TARGET IS ONE TAP ("only three taps for any sentence"). "on" was a word
// of its own, which made BRING UP ECHO ON DRUMS four taps; the phrase is one
// chip now — the same compounding "bring up" has always used — so every
// sentence in the language fits in three.
const ONWORD = {};
const onTok = (label, kind, canon) => { ONWORD[label] = { kind, canon };
  put(label, "on", label); };
for (const c of ["drums", "bass", "melody", "chords", "vocals"])
  onTok("on " + (c === "vocals" ? "the vocals" : c), "subj", c);
for (const [c, g] of Object.entries(U)) onTok("on the " + c, "unit", c);
for (const [c] of Object.entries(I)) onTok("on " + c, "inst", c);
// A WORD MAY WEAR TWO HATS. "more"/"less" are verbs in the first slot and
// adjectives after one (THINK MORE PUNK, ADD MORE NOTES), and WORDS is
// first-come — so the alternate reading is kept beside it and slots() reaches
// for it whenever a verb-role word turns up in a later position.
const ALT = {};
for (const [c, syns] of Object.entries(A))
  for (const w of syns) if (WORDS[w] && WORDS[w].role !== "adj") ALT[w] = { role: "adj", canon: c };

/* ---------- what the record has ---------- */
export const OPEN_CTX = {
  drumsOn: true, drumsOff: true,
  parts: { bass: true, melody: true, chords: true, vocals: true },
  insts: null,          // null = unknown: every instrument subject sayable
  fx: null,             // null = unknown: adding a chip is sayable, removing is not
  stacked: null,        // null = unknown: THINK both ways sayable
  rev: 1, revMax: 4, echo: 1, echoMax: 4,
};

/* ---------- semantics ---------- */
const CH = { drums: "drums", bass: "bass", melody: "lead", chords: "pad",
             song: "master", vocals: "vocals" };
const CAST_CHAIRS = { melody: ["lead", "line"], chords: ["pad"], bass: ["bass"] };
const FADER = 2.5, SEND = 0.12, EQ = 3, BPMSTEP = 6;

const chanOf = (n) => n == null ? null
  : n.kind === "subj" ? (CH[n.canon] || null)
  : n.kind === "unit" ? "unit:" + U[n.canon].unit
  : n.kind === "inst" ? "inst:" + I[n.canon].chan : null;
function present(n, ctx) {
  if (!n) return false;
  if (n.kind === "unit") return ctx.drumsOn;
  if (n.kind === "inst") return !ctx.insts || !!ctx.insts[n.canon];
  if (n.kind === "subj") {
    if (n.canon === "drums") return ctx.drumsOn;
    if (ctx.parts[n.canon] !== undefined) return !!ctx.parts[n.canon];
  }
  return true;
}
const hasChip = (ctx, chan, chip) => !!(ctx.fx && ctx.fx[chan] && ctx.fx[chan][chip]);

function compile(q, scope, ctx) {
  ctx = ctx || OPEN_CTX;
  const sec = scope !== "song";
  const n = q.nominal;
  const dir = q.verb === "up" || q.verb === "more" ? 1
    : q.verb === "down" || q.verb === "less" ? -1 : 0;

  /* THINK MORE PUNK · MAKE EVERYTHING FUNKIER */
  if (q.gen) {
    if (q.fxadj || q.fxn || q.glue || q.instAdj) return null;
    // A GENRE ALREADY MEANS THE WHOLE NODE. "ADD SHOEGAZE MORE EVERYTHING"
    // (2026-08-19) — the tray let EVERYTHING and MORE both trail a genre and
    // the line read as gibberish. Only MAKE takes the pronoun, because only
    // MAKE needs it to be a sentence at all: MAKE EVERYTHING FUNKIER.
    if (n) {
      if (!(n.kind === "subj" && n.canon === "song")) return null;
      if (q.verb !== "make") return null;
    }
    // the adjective's own polarity (absent = none), and the verb's
    const adjD = q.adj == null ? 0 : q.adj === "more" ? 1 : q.adj === "fewer" ? -1 : null;
    if (adjD === null) return null;              // any other adjective: not a genre sentence
    // ADD takes MORE, CUT takes LESS — "ADD SPARSER ROCK" was the survey's
    // funniest nonsense and it compiled cleanly
    if (q.verb === "more" && adjD < 0) return null;
    if (q.verb === "less" && adjD > 0) return null;
    // VERB AGREEMENT: a genre is THOUGHT, MADE, ADDED or CUT — never "brought
    // up" (the survey's own finding: BRING UP PUNK read as nonsense while
    // compiling perfectly).
    const dd = q.verb === "less" ? -1 : q.verb === "more" ? 1
      : (q.verb === "think" || q.verb === "make") ? (adjD || 1) : 0;
    if (!dd) return null;
    const anchor = G[q.gen].anchor;
    if (dd > 0 && ctx.stacked && ctx.stacked[anchor]) return null;
    if (dd < 0 && ctx.stacked && !ctx.stacked[anchor]) return null;
    return [{ t: "think", g: anchor, on: dd > 0 }];
  }
  if (q.verb === "think") return null;

  /* REDO THE MELODY */
  if (q.verb === "redo") {
    if (q.adj || q.fxadj || q.fxn || q.glue || q.instAdj) return null;
    if (!n || n.kind !== "subj") return null;
    if (n.canon !== "melody" && n.canon !== "notes" && n.canon !== "song") return null;
    if (n.canon === "melody" && !ctx.parts.melody) return null;
    return [{ t: "redo" }];
  }
  /* HOW THE PLAYERS PLAY: MAKE BASS SLAPPIER · MAKE DRUMS SHUFFLING ·
     MAKE IT SWINGING — the musician's own vocabulary, straight onto the
     sequencer's operators. */
  if (q.play) {
    if (q.verb !== "make" || q.adj || q.fxadj || q.fxn || q.glue || q.instAdj || q.gen) return null;
    if (!n || !present(n, ctx)) return null;
    if (q.play.role === "bassadj")
      return (n.kind === "subj" && n.canon === "bass")
        ? [{ t: "secbass", op: BASSFEEL[q.play.canon] }] : null;
    if (q.play.role === "kitadj")
      return (n.kind === "subj" && n.canon === "drums")
        ? [{ t: "seckit", word: KITFEEL[q.play.canon] }] : null;
    // the FEEL is the record's, so it only answers to the whole thing
    if (!(n.kind === "subj" && n.canon === "song") || sec) return null;
    const f = FEELWORD[q.play.canon], out = [];
    if (f.groove) out.push({ t: "groove", word: f.groove });
    if (f.swing) out.push({ t: "swing", word: f.swing });
    return out.length ? out : null;
  }
  if (q.play) return null;

  /* HIRING: ADD BASS · ADD PIANO · ADD CHORDS — the couch builds a band */
  if ((q.verb === "more" || q.verb === "less") && !q.adj && !q.glue && !q.fxadj &&
      !q.fxn && !q.instAdj && !q.gen && n) {
    const hirePart = (n.kind === "inst") ? (["strings", "organ"].includes(n.canon) ? "chords" : "melody")
      : (n.kind === "subj" && ["melody", "chords", "vocals", "bass"].includes(n.canon)) ? n.canon : null;
    if (hirePart && n.canon !== "drums") {
      const there = present(n, ctx);
      if (q.verb === "more") return there ? null
        : [{ t: "hire", part: hirePart, id: n.kind === "inst" ? I[n.canon].cast : null,
             what: n.canon }];
      return there ? [{ t: "fire", part: hirePart, what: n.canon,
                        id: n.kind === "inst" ? I[n.canon].cast : null }] : null;
    }
  }

  /* ON-PHRASES: BRING UP ECHO ON DRUMS · ADD DISTORTION ON GUITAR */
  if (q.glue) {
    const target = q.onNominal;
    if (!target || !present(target, ctx) || q.adj || q.instAdj) return null;
    if (!n && !q.fxn) return null;
    const chan = chanOf(target);
    if (!chan || chan === "master") return null;
    if (n && n.kind === "subj" && (n.canon === "reverb" || n.canon === "echo")) {
      if (!dir) return null;
      return [{ t: "mix", chan, key: n.canon === "reverb" ? "rev" : "del", delta: dir * SEND }];
    }
    if (n && n.kind === "subj" && n.canon === "compression") {
      if (!dir) return null;
      return [{ t: "mix", chan, key: "fader", delta: dir * FADER * 0.6 },
              { t: "mix", chan: "master", key: "glue", delta: dir * SEND * 0.5 }];
    }
    if (q.fxn) {
      // an effect is ADDED or CUT, never "brought up" (survey again)
      if (q.verb !== "more" && q.verb !== "less") return null;
      if (!dir) return null;
      const chip = FXA[q.fxn].chip;
      if (dir > 0 && hasChip(ctx, chan, chip)) return null;
      if (dir < 0 && (!ctx.fx || !hasChip(ctx, chan, chip))) return null;
      return [{ t: "fx", chan, chip, on: dir > 0 }];
    }
    return null;
  }
  if (q.fxn) return null;                 // an effect noun needs its ON <thing>
  if (!n) return null;

  /* MAKE GUITAR DISTORTED · MAKE VOCALS CRUNCH */
  if (q.fxadj) {
    if (q.instAdj || q.adj) return null;
    if (q.verb !== "make") return null;      // MAKE GUITAR DISTORTED, not "bring up guitar distorted"
    if (!present(n, ctx)) return null;
    const chan = chanOf(n);
    if (!chan || chan === "master") return null;
    const chip = FXA[q.fxadj].chip;
    if (hasChip(ctx, chan, chip)) return null;
    return [{ t: "fx", chan, chip, on: true }];
  }

  /* MAKE THE MELODY PIANO — the pool, hired for the record */
  if (q.instAdj) {
    if (q.verb !== "make" || q.adj || sec) return null;
    if (n.kind !== "subj" || !CAST_CHAIRS[n.canon] || !present(n, ctx)) return null;
    return [{ t: "cast", chairs: CAST_CHAIRS[n.canon], id: I[q.instAdj].cast }];
  }

  /* ADD MORE COMPRESSION — the record's own glue */
  if (n.kind === "subj" && n.canon === "compression") {
    if (q.adj && q.adj !== "more" && q.adj !== "fewer") return null;
    if (sec || !dir) return null;
    return [{ t: "mix", chan: "master", key: "glue", delta: dir * SEND }];
  }

  /* BRING UP REVERB */
  if (n.kind === "subj" && (n.canon === "reverb" || n.canon === "echo") && !q.adj) {
    if (!dir) return null;
    if (sec) {
      const at = n.canon === "reverb" ? ctx.rev : ctx.echo;
      const max = n.canon === "reverb" ? ctx.revMax : ctx.echoMax;
      if (dir > 0 && at >= max) return null;
      if (dir < 0 && at <= 0) return null;
      return [{ t: "secsend", key: n.canon === "reverb" ? "rev" : "echo", step: dir }];
    }
    return [{ t: "mix", chan: "master", key: n.canon === "reverb" ? "rev" : "del", delta: dir * SEND }];
  }

  /* ADD DRUMS / CUT THE DRUMS — presence */
  if (n.kind === "subj" && n.canon === "drums" && (q.verb === "more" || q.verb === "less") && !q.adj)
    return q.verb === "more" ? (ctx.drumsOff ? [{ t: "drums", on: true }] : null)
                             : (ctx.drumsOn ? [{ t: "drums", on: false }] : null);
  if (!present(n, ctx)) return null;

  const chan = chanOf(n);
  const isSong = n.kind === "subj" && n.canon === "song";

  /* BRING UP THE DRUMS / PUSH THE KICK — level */
  if ((q.verb === "up" || q.verb === "down") && !q.adj) {
    if (isSong) return sec ? [{ t: "secnum", key: "fader", delta: dir * FADER }]
                           : [{ t: "mix", chan: "master", key: "fader", delta: dir * FADER }];
    if (!chan) return null;
    return [{ t: "mix", chan, key: "fader", delta: dir * FADER }];
  }

  /* NOTES */
  if (n.kind === "subj" && n.canon === "notes") {
    if (q.verb !== "more" && q.verb !== "less") return null;   // ADD/CUT notes; nothing is "brought up"
    if (q.verb === "more" && (!q.adj || q.adj === "more")) return [{ t: "ops", add: "dens2" }];
    if (q.verb === "less" && (!q.adj || q.adj === "fewer")) return [{ t: "ops", add: "thin2" }];
    if (q.adj === "high")
      return (q.verb === "less" || q.verb === "down")
        ? [{ t: "ops", add: "tight" }, sec ? { t: "seceq", band: "hi", delta: -EQ }
                                           : { t: "mixeq", chan: "master", band: "hi", delta: -EQ }]
        : (q.verb === "more" || q.verb === "up")
        ? [{ t: "ops", add: "wide" }, sec ? { t: "seceq", band: "hi", delta: EQ }
                                          : { t: "mixeq", chan: "master", band: "hi", delta: EQ }] : null;
    if (q.adj === "low")
      return (q.verb === "less" || q.verb === "down")
        ? [sec ? { t: "seceq", band: "lo", delta: -EQ } : { t: "mixeq", chan: "master", band: "lo", delta: -EQ }]
        : (q.verb === "more" || q.verb === "up")
        ? [sec ? { t: "seceq", band: "lo", delta: EQ } : { t: "mixeq", chan: "master", band: "lo", delta: EQ }] : null;
    return null;
  }

  /* MAKE <thing> <adjective> */
  if (!q.adj) return null;
  // VERB AGREEMENT again: an adjective sentence is MADE. "BRING UP DRUMS
  // BIGGER" compiled and read as nonsense — the whole point of the survey.
  if (q.verb !== "make") return null;
  if (!isSong && !chan) return null;
  const at = isSong ? "master" : chan;
  const eqFx = (band, d) => sec ? { t: "seceq", band, delta: d } : { t: "mixeq", chan: at, band, delta: d };
  const faderFx = (d) => (sec && isSong) ? { t: "secnum", key: "fader", delta: d }
    : sec ? null : { t: "mix", chan: at, key: "fader", delta: d };
  const sendFx = (d) => sec ? { t: "secsend", key: "rev", step: Math.sign(d) }
    : { t: "mix", chan: at, key: "rev", delta: d };
  const only = (x) => (x == null || (Array.isArray(x) && x.some(e => e == null))) ? null
    : (Array.isArray(x) ? x : [x]);
  switch (q.adj) {
    case "bigger":   return only([faderFx(FADER * 0.8), sendFx(SEND * 0.5)]);
    case "smaller":  return only([faderFx(-FADER * 0.8), sendFx(-SEND * 0.5)]);
    case "louder":   return only(faderFx(FADER));
    case "quieter":  return only(faderFx(-FADER));
    case "brighter": return only(eqFx("hi", EQ));
    case "darker":   return only(eqFx("hi", -EQ));
    case "warmer":   return only([eqFx("lo", EQ * 0.7), eqFx("hi", -EQ * 0.4)]);
    case "wetter":   return only(sendFx(SEND));
    case "drier":    return only(sendFx(-SEND));
    case "faster":   return (isSong && !sec) ? [{ t: "bpm", delta: BPMSTEP }] : null;
    case "slower":   return (isSong && !sec) ? [{ t: "bpm", delta: -BPMSTEP }] : null;
    // (these four used to be section-only because the apply layer could not
    // reach past one box; it writes every playing section at song scope now)
    case "busier":   return n.canon === "drums" ? [{ t: "seckit", word: "busy" }] : null;
    case "simpler":  return n.canon === "drums" ? [{ t: "seckit", word: "sparse" }]
                        : isSong ? [{ t: "ops", add: "thin2" }] : null;
    case "open":     return isSong ? [{ t: "secmot", word: "open" }] : null;
    case "closed":   return isSong ? [{ t: "secmot", word: "close" }] : null;
    default: return null;
  }
}

/* ---------- grammar ---------- */
export const MAX_CMDS = 20;   // standing commands per node
export const MAX_WORDS = 3;   // the tap budget, and the whole grammar fits
function slots(tokens) {
  const q = { verb: null, adj: null, gen: null, fxadj: null, fxn: null,
              instAdj: null, play: null, glue: false, nominal: null, onNominal: null };
  let afterOn = false;
  for (let i = 0; i < tokens.length; i++) {
    let r = WORDS[tokens[i]];
    if (!r) return null;
    if (i === 0) { if (r.role !== "verb") return null; q.verb = r.canon; continue; }
    if (r.role === "verb" && ALT[tokens[i]]) r = ALT[tokens[i]];      // the second hat
    if (r.role === "verb") return null;
    if (r.role === "on") {
      if (q.glue || (!q.nominal && !q.fxn) || q.onNominal) return null;
      const t = ONWORD[r.canon];
      q.glue = true; q.onNominal = { kind: t.kind, canon: t.canon };
      afterOn = true; continue;
    }
    if (r.role === "subj" || r.role === "unit" || r.role === "inst") {
      const nom = { kind: r.role, canon: r.canon };
      if (afterOn) { if (q.onNominal) return null; q.onNominal = nom; }
      else if (!q.nominal) q.nominal = nom;
      else if (r.role === "inst" && q.nominal.kind === "subj" && !q.instAdj) q.instAdj = r.canon;
      else return null;
      continue;
    }
    if (afterOn) return null;
    if (r.role === "adj")   { if (q.adj)   return null; q.adj = r.canon; continue; }
    if (r.role === "bassadj" || r.role === "kitadj" || r.role === "feeladj") {
      if (q.play) return null; q.play = { role: r.role, canon: r.canon }; continue;
    }
    if (r.role === "fxadj") { if (q.fxadj) return null; q.fxadj = r.canon; continue; }
    if (r.role === "fxn")   { if (q.fxn)   return null; q.fxn = r.canon; continue; }
    if (r.role === "gen")   { if (q.gen)   return null; q.gen = r.canon; continue; }
    return null;
  }
  return q;
}
// THE SENTENCE AS ENGLISH: taps arrive in whatever order the couch chose, so
// the printed line puts the pre-nominal adjectives where they belong — CUT
// HIGH NOTES, not "cut notes high" (the survey's own reading test).
const PRENOM = new Set(["high", "low", "more", "fewer"]);
function pretty(tokens, q) {
  // a DIRECTION follows its player: MAKE DRUMS WITH GHOST NOTES
  if (q.play && q.nominal) {
    const pw = tokens.find(w => ["bassadj", "kitadj", "feeladj"].includes(WORDS[w].role));
    const nw = tokens.find(w => ["subj", "unit", "inst"].includes(WORDS[w].role));
    if (pw && nw && tokens.indexOf(pw) < tokens.indexOf(nw)) {
      const out = tokens.filter(w => w !== pw);
      out.splice(out.indexOf(nw) + 1, 0, pw);
      return out.join(" ").toUpperCase();
    }
  }
  if (!q.adj || !PRENOM.has(q.adj)) return tokens.join(" ").toUpperCase();
  if (!q.nominal && !q.gen) return tokens.join(" ").toUpperCase();
  const adjW = tokens.find(w => { const r = WORDS[w]; const alt = ALT[w];
    return (r.role === "adj" && r.canon === q.adj) || (alt && alt.canon === q.adj); });
  // the HEAD is the thing being modified: a genre when there is one (ADD MORE
  // SHOEGAZE), otherwise the nominal (CUT HIGH NOTES)
  const nomW = tokens.find(w => (q.gen ? WORDS[w].role === "gen"
    : ["subj", "unit", "inst"].includes(WORDS[w].role)));
  if (!adjW || !nomW) return tokens.join(" ").toUpperCase();
  const out = tokens.filter(w => w !== adjW);
  out.splice(out.indexOf(nomW), 0, adjW);
  return out.join(" ").toUpperCase();
}
export function parse(tokens, scope, ctx) {
  if (!tokens.length || tokens.length > MAX_WORDS) return null;
  const q = slots(tokens);
  if (!q) return null;
  const fx = compile(q, scope, ctx);
  return fx ? { ...q, fx, text: pretty(tokens, q) } : null;
}

/* ---------- the tray: exact AND complete ----------------------------------
   Semantics only ever see CANONS, so the search runs over one representative
   per (role, canon) and memoises on the SLOT STATE — two different word
   orders that fill the same slots are the same question, which is what keeps
   a four-word grammar instant. */
const REPS = (() => {
  const seen = new Set(), out = [];
  for (const [w, r] of Object.entries(WORDS)) {
    const k = r.role + ":" + r.canon;
    if (!seen.has(k)) { seen.add(k); out.push(w); }
  }
  return out;
})();
function reachable(tokens, scope, ctx, memo) {
  const q = slots(tokens);
  if (!q) return false;
  const key = tokens.length + "|" + JSON.stringify(q);
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let r = !!compile(q, scope, ctx);
  if (!r && tokens.length < MAX_WORDS) {
    for (const w of REPS) {
      if (WORDS[w].role === "verb") continue;
      if (reachable([...tokens, w], scope, ctx, memo)) { r = true; break; }
    }
  }
  memo.set(key, r);
  return r;
}
// the memo is MODULE-LEVEL and keyed by (scope, record-facts): a tray draw
// asks this ~250 times and a gate walks thousands of nodes, all against one
// unchanging record, so throwing the table away per call was the whole cost.
let memoKey = null, memoMap = new Map();
export function continuations(tokens, scope, ctx) {
  const ok = new Set();
  const key = scope + "|" + (ctx ? JSON.stringify(ctx) : "open");
  if (key !== memoKey) { memoKey = key; memoMap = new Map(); }
  const memo = memoMap;
  for (const w of Object.keys(WORDS)) {
    const r = WORDS[w];
    if (!tokens.length) { if (r.role !== "verb") continue; }
    else if (r.role === "verb" && !ALT[w]) continue;      // ...unless it wears a second hat
    if (reachable([...tokens, w], scope, ctx, memo)) ok.add(w);
  }
  return ok;
}

/* ---------- the translation ---------- */
const CHNAME = { drums: "drums", bass: "bass", lead: "melody", pad: "chords",
  master: "the whole record", vocals: "the voice" };
const chname = (c) => CHNAME[c] || (c.startsWith("unit:") ? "the " + c.slice(5)
  : c.startsWith("inst:") ? "the " + c.slice(5) : c);
const signed = (v, unit) => (v > 0 ? "+" : "") + (Math.round(v * 100) / 100) + (unit || "");
export function describeFx(fx, scope) {
  return fx.map((e) => {
    switch (e.t) {
      case "mix": return "board: " + chname(e.chan) + " " +
        (e.key === "fader" ? signed(e.delta, " dB")
         : e.key === "glue" ? "glue " + signed(e.delta)
         : (e.key === "rev" ? "reverb send " : "echo send ") + signed(e.delta));
      case "mixeq": return "board: " + chname(e.chan) + " eq " + e.band + " " + signed(e.delta, " dB");
      case "fx": return e.on ? "board: " + chname(e.chan) + " takes the " + e.chip + " chip"
                             : "board: the " + e.chip + " comes off " + chname(e.chan);
      case "cast": return "the " + e.chairs[0] + " chair is recast: " + e.id.replace(/_/g, " ");
      case "redo": return (scope === "song" ? "every section" : "this section") +
        " takes another phrase from the bank";
      case "bpm": return "tempo " + signed(e.delta) + " bpm";
      case "secnum": return "this section's fader " + signed(e.delta, " dB");
      case "seceq": return "this section's eq " + e.band + " " + signed(e.delta, " dB");
      case "secsend": return "this section's " + (e.key === "rev" ? "reverb" : "echo") +
        " " + (e.step > 0 ? "up" : "down") + " one step";
      case "seckit": return "this section's kit → " + e.word;
      case "secmot": return "this section's filter → " + e.word;
      case "secper": return "this section's period → " + e.word;
      case "ops": return (scope === "song" ? "every section: " : "this section: ") +
        "notes op “" + e.add + "”";
      case "think": return e.on
        ? (scope === "song" ? "every section: " : "this section: ") + e.g + " layered on the phrase"
        : "the " + e.g + " layer comes off";
      case "secbass": return (scope === "song" ? "every section" : "this section") +
        "'s bass plays " + e.op;
      case "groove": return "the record's groove → " + e.word;
      case "swing": return "the record's swing → " + e.word;
      case "hire": return (e.id ? e.id.replace(/_/g, " ") : e.what) + " joins the band" +
        (e.part === "bass" ? " on bass" : e.part === "chords" ? " on chords" : "");
      case "fire": return "the " + e.what + " leaves the band";
      case "drums": return e.on
        ? "drums back in (kit restored, board unmuted)"
        : (scope === "song" ? "every section's kit → nodrums" : "this section's kit → nodrums");
    }
    return e.t;
  }).join(" · ");
}

export const LEXICON = { V, S, U, I, A, FXA, FXN, G, ONWORD,
  BASSWORD, KITWORD, FEELSYN, WORDS };
