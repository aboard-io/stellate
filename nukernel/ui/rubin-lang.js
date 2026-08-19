// ui/rubin-lang.js — RUBINESQUE, the language. Pure: no DOM, no state, no
// audio — a lexicon, a grammar and a compiler, so every sentence the couch
// can say is provable in node.
//
// THE COUCH SPEAKS SENTENCES: a VERB, a SUBJECT, sometimes an ADJECTIVE, in
// either order after the verb — MAKE DRUMS BIGGER, CUT HIGH NOTES, ADD MORE
// NOTES, BRING UP REVERB. Synonyms are the point (tons of them: PUSH, BOOST,
// RAISE and BRING UP are one verb), and the one law of the tray is EXACTNESS:
// continuations() only ever offers a word that still leads to a sentence
// compile() accepts, so nothing tappable is decorative.
//
// TWO SCOPES, one graph: the SONG node compiles to the board's offset layer,
// the tempo and every-section ops; a SECTION node compiles to that box's own
// fields (fader, sends, eq, kit words, motion, period, ops) — the same
// registry vocabulary every other surface writes, which is what "fully
// expresses the capabilities of the system" means here. Up to FIVE standing
// commands per node (the producer says five things about a section, not
// fifty).

/* ---------- the lexicon: canon -> the many ways the couch says it ---------- */
const V = {           // verbs. canon: up / down / more / less / make
  up:   ["bring up", "turn up", "push", "boost", "raise", "lift", "pump up", "crank", "up"],
  down: ["bring down", "turn down", "pull back", "lower", "drop", "ease", "back off", "down"],
  more: ["add", "add more", "give me more", "more", "double", "stack"],
  less: ["cut", "remove", "strip", "lose", "kill", "less", "fewer", "thin out", "take out"],
  make: ["make", "get", "i want", "it should be", "make it", "let it be"],
};
const S = {           // subjects. canon -> synonyms
  drums:  ["drums", "the drums", "kit", "the kit", "beat", "the beat", "percussion"],
  bass:   ["bass", "the bass", "low end", "the bottom", "bottom end"],
  melody: ["melody", "the melody", "lead", "the lead", "the tune", "top line", "the hook"],
  chords: ["chords", "the chords", "pads", "the pad", "harmony", "the bed"],
  notes:  ["notes", "the notes"],
  reverb: ["reverb", "the reverb", "verb", "space", "the room", "air"],
  echo:   ["echo", "the echo", "delay", "the delay", "repeats"],
  song:   ["everything", "it", "it all", "the song", "the whole thing", "the record", "the track", "this"],
};
const A = {           // adjectives. canon -> synonyms
  bigger:   ["bigger", "big", "fatter", "fat", "huge", "massive", "thicker"],
  smaller:  ["smaller", "small", "thinner", "tighter", "leaner"],
  louder:   ["louder", "loud", "hotter", "hot", "forward"],
  quieter:  ["quieter", "quiet", "softer", "soft", "back", "lower in the mix"],
  brighter: ["brighter", "bright", "shinier", "crisper", "crisp", "sparklier"],
  darker:   ["darker", "dark", "duller", "moodier", "murkier"],
  warmer:   ["warmer", "warm", "rounder", "smoother"],
  wetter:   ["wetter", "wet", "roomier", "spacier", "washier"],
  drier:    ["drier", "dry", "closer", "tight to the mic", "in your face"],
  high:     ["high", "the high", "top", "upper"],
  low:      ["low", "the low", "deep"],
  more:     ["more", "extra", "busier"],
  fewer:    ["fewer", "less", "sparser", "simpler"],
  faster:   ["faster", "quicker", "uptempo", "with more urgency"],
  slower:   ["slower", "lazier", "laid back", "downtempo"],
  busier:   ["busier", "busy", "wilder"],
  simpler:  ["simpler", "simple", "sparse", "barer", "minimal"],
  open:     ["open", "opening", "blooming"],
  closed:   ["closed", "closing", "sinking"],
};
// one flat word -> {role, canon} map; multiword synonyms are single TOKENS
// (a chip is a phrase, not a word — "bring up" is one tap)
const WORDS = {};
for (const [canon, syns] of Object.entries(V)) for (const w of syns) WORDS[w] = { role: "verb", canon };
for (const [canon, syns] of Object.entries(S)) for (const w of syns) WORDS[w] = { role: "subj", canon };
for (const [canon, syns] of Object.entries(A)) for (const w of syns) WORDS[w] = { role: "adj", canon };

/* ---------- the semantics: (verb, subj, adj|null, scope) -> effects --------
   Effect shapes (the APPLY layer in ui/rubin.js lands each on its one writer):
     { t:"mix",   chan, key, delta }        board offset (song scope)
     { t:"mixeq", chan, band, delta }       board eq offset (song scope)
     { t:"bpm",   delta }                   tempo (song scope)
     { t:"secnum", key, delta }             sec.fader-style number, clamped
     { t:"seceq",  band, delta }            sec.eq band, dB
     { t:"secsend", key, step }             sec.rev / sec.echo enum, stepped
     { t:"seckit", word }                   sec.kit word
     { t:"secmot", word }                   sec.mot
     { t:"secper", word }                   sec.period
     { t:"ops",   add }                     append an op (section: that box;
                                            song: every playing box)
   A sentence compiles for a scope or it does not exist there — exactness. */
const CH = { drums: "drums", bass: "bass", melody: "lead", chords: "pad", song: "master" };
const FADER = 2.5, SEND = 0.12, EQ = 3, BPMSTEP = 6;

function compileOne(verb, subj, adj, scope) {
  const sec = scope !== "song";
  const fx = [];
  const chan = CH[subj];
  const dir = verb === "up" || verb === "more" ? 1 : verb === "down" || verb === "less" ? -1 : 0;

  // BRING UP REVERB / CUT THE ECHO — a parameter subject, no adjective needed
  if ((subj === "reverb" || subj === "echo") && (verb === "up" || verb === "down" ||
       verb === "more" || verb === "less") && !adj) {
    const key = subj === "reverb" ? "rev" : "del";
    return sec ? [{ t: "secsend", key: subj === "reverb" ? "rev" : "echo", step: dir }]
               : [{ t: "mix", chan: "master", key, delta: dir * SEND }];
  }
  // BRING UP THE DRUMS — an instrument subject, no adjective: a fader move
  if (chan && (verb === "up" || verb === "down") && !adj)
    return sec && subj === "song" ? [{ t: "secnum", key: "fader", delta: dir * FADER }]
      : sec ? null                               // per-section per-part trims live on the board
      : [{ t: "mix", chan, key: "fader", delta: dir * FADER }];

  // ADD MORE NOTES / CUT NOTES / CUT HIGH NOTES / ADD HIGH NOTES
  if (subj === "notes") {
    if ((verb === "more" || verb === "up") && (!adj || adj === "more"))
      return [{ t: "ops", add: "dens2" }];
    if ((verb === "less" || verb === "down") && (!adj || adj === "fewer"))
      return [{ t: "ops", add: "thin2" }];
    if (adj === "high")
      return verb === "less" || verb === "down"
        ? [{ t: "ops", add: "tight" }, sec ? { t: "seceq", band: "hi", delta: -EQ }
                                           : { t: "mixeq", chan: "master", band: "hi", delta: -EQ }]
        : verb === "more" || verb === "up"
        ? [{ t: "ops", add: "wide" }, sec ? { t: "seceq", band: "hi", delta: EQ }
                                          : { t: "mixeq", chan: "master", band: "hi", delta: EQ }]
        : null;
    if (adj === "low")
      return verb === "less" || verb === "down"
        ? [sec ? { t: "seceq", band: "lo", delta: -EQ } : { t: "mixeq", chan: "master", band: "lo", delta: -EQ }]
        : verb === "more" || verb === "up"
        ? [sec ? { t: "seceq", band: "lo", delta: EQ } : { t: "mixeq", chan: "master", band: "lo", delta: EQ }]
        : null;
    return null;
  }

  // MAKE <thing> <adjective> — the couch's home key. Also accepts UP/DOWN/
  // MORE/LESS with an adjective when the pair means the same thing exactly.
  if (!adj || !chan && subj !== "song") return null;
  const eq = (band, d) => sec ? { t: "seceq", band, delta: d }
                              : { t: "mixeq", chan, band, delta: d };
  const fader = (d) => sec && subj === "song" ? { t: "secnum", key: "fader", delta: d }
    : sec ? null : { t: "mix", chan, key: "fader", delta: d };
  const send = (key, d) => sec ? { t: "secsend", key: key === "del" ? "echo" : "rev", step: Math.sign(d) }
                               : { t: "mix", chan, key, delta: d };
  const only = (x) => (x == null || (Array.isArray(x) ? x.some(e => e == null) : false)) ? null
    : (Array.isArray(x) ? x : [x]);
  if (verb !== "make" && verb !== "up" && verb !== "down" && verb !== "more" && verb !== "less") return null;
  switch (adj) {
    case "bigger":   return only([fader(FADER * 0.8), send("rev", SEND * 0.5)]);
    case "smaller":  return only([fader(-FADER * 0.8), send("rev", -SEND * 0.5)]);
    case "louder":   return only(fader(FADER));
    case "quieter":  return only(fader(-FADER));
    case "brighter": return only(eq("hi", EQ));
    case "darker":   return only(eq("hi", -EQ));
    case "warmer":   return only([eq("lo", EQ * 0.7), eq("hi", -EQ * 0.4)]);
    case "wetter":   return only(send("rev", SEND));
    case "drier":    return only(send("rev", -SEND));
    case "faster":   return subj === "song" && !sec ? [{ t: "bpm", delta: BPMSTEP }] : null;
    case "slower":   return subj === "song" && !sec ? [{ t: "bpm", delta: -BPMSTEP }] : null;
    case "busier":   return subj === "drums" && sec ? [{ t: "seckit", word: "busy" }]
                        : subj === "drums" ? null : null;
    case "simpler":  return subj === "drums" && sec ? [{ t: "seckit", word: "sparse" }]
                        : subj === "song" && sec ? [{ t: "ops", add: "thin2" }] : null;
    case "open":     return sec && subj === "song" ? [{ t: "secmot", word: "open" }] : null;
    case "closed":   return sec && subj === "song" ? [{ t: "secmot", word: "close" }] : null;
    default: return null;
  }
}

/* ---------- grammar: a token list -> a compiled sentence, or nothing ------- */
export const MAX_CMDS = 5;                 // five statements per node, the law
export function parse(tokens, scope) {
  if (!tokens.length || tokens.length > 3) return null;
  const roles = tokens.map(w => WORDS[w]);
  if (roles.some(r => !r) || roles[0].role !== "verb") return null;
  let subj = null, adj = null;
  for (const r of roles.slice(1)) {
    if (r.role === "subj" && !subj) subj = r.canon;
    else if (r.role === "adj" && !adj) adj = r.canon;
    else return null;                       // two subjects, two adjectives: not a sentence
  }
  if (!subj) return null;
  const fx = compileOne(roles[0].canon, subj, adj, scope);
  return fx ? { verb: roles[0].canon, subj, adj, fx, text: tokens.join(" ").toUpperCase() } : null;
}

/* ---------- the tray's law: only words that still work exactly ------------- */
export function continuations(tokens, scope) {
  const ok = new Set();
  const cands = Object.keys(WORDS);
  for (const w of cands) {
    const r = WORDS[w];
    if (!tokens.length) { if (r.role !== "verb") continue; }
    else if (r.role === "verb") continue;
    const t2 = [...tokens, w];
    // a word survives if t2 parses, or if some third word completes it
    if (parse(t2, scope)) { ok.add(w); continue; }
    if (t2.length >= 3) continue;
    for (const w3 of cands) {
      if (WORDS[w3].role === "verb") continue;
      if (parse([...t2, w3], scope)) { ok.add(w); break; }
    }
  }
  return ok;
}

export const LEXICON = { V, S, A, WORDS };
