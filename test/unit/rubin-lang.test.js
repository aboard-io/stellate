// test/unit/rubin-lang.test.js — RUBINESQUE, the language, proven in node.
//
//   (a) the founding sentences compile: MAKE DRUMS BIGGER, CUT HIGH NOTES,
//       ADD MORE NOTES, BRING UP REVERB — and a fistful of synonym phrasings
//       land on the same canon.
//   (b) THE EXACTNESS LAW: at both scopes, every word the tray offers leads to
//       a sentence that compiles — walked to closure, no dead end anywhere.
//   (c) every compiled effect names real vocabulary: ops in the registry's own
//       OPS table, kit words the kit chip already takes, eq bands lo/hi, a
//       known effect shape — nothing a sentence says is unlandable.
//   (d) five commands per node is the cap the module exports.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

(async () => {
  const L = await import("../../nukernel/ui/rubin-lang.js");
  const NF = require("../../nukernel/fields.js");
  const SCOPES = ["song", "section"];

  /* (a) the founding sentences, plus synonyms onto the same canon */
  const say = (words, scope) => L.parse(words, scope);
  ok(!!say(["make", "drums", "bigger"], "song"), "MAKE DRUMS BIGGER does not compile at song");
  ok(!!say(["cut", "high", "notes"], "song"), "CUT HIGH NOTES does not compile at song");
  ok(!!say(["cut", "high", "notes"], "section"), "CUT HIGH NOTES does not compile at section");
  ok(!!say(["add", "more", "notes"], "section"), "ADD MORE NOTES does not compile at section");
  ok(!!say(["bring up", "reverb"], "song"), "BRING UP REVERB does not compile at song");
  ok(!!say(["bring up", "the room"], "section"), "BRING UP THE ROOM does not compile at section");
  const a = say(["make", "drums", "bigger"], "song");
  for (const alt of [["make", "the kit", "fatter"], ["make", "the beat", "huge"],
                     ["get", "percussion", "massive"]]) {
    const b = say(alt, "song");
    ok(b && JSON.stringify(b.fx) === JSON.stringify(a.fx),
       alt.join(" ") + " does not land where MAKE DRUMS BIGGER lands");
  }
  ok(JSON.stringify(say(["push", "the drums"], "song").fx) ===
     JSON.stringify(say(["bring up", "kit"], "song").fx),
     "PUSH THE DRUMS and BRING UP KIT disagree");
  ok(!!say(["make", "it", "slower"], "song"), "MAKE IT SLOWER does not compile");
  ok(!say(["make", "it", "slower"], "section"), "tempo compiled at a section — tempo is a song fact");

  /* (b) THE EXACTNESS LAW, walked to closure at both scopes */
  for (const scope of SCOPES) {
    let offered = 0, dead = 0;
    const walk = (tokens) => {
      const next = L.continuations(tokens, scope);
      for (const w of next) {
        offered++;
        const t2 = [...tokens, w];
        const done = L.parse(t2, scope);
        const more = t2.length < 3 ? L.continuations(t2, scope) : new Set();
        if (!done && !more.size) { dead++; if (dead < 4) console.log("  dead end:", scope, t2.join(" / ")); }
        if (!done && more.size && t2.length < 3) walk(t2);
      }
    };
    walk([]);
    ok(dead === 0, scope + ": " + dead + " tray offerings dead-end — the exactness law is broken");
    ok(offered > 400, scope + ": the tray offered only " + offered + " words — where are the synonyms?");
  }

  /* (c) every reachable sentence's effects name real vocabulary */
  {
    const shapes = new Set(["mix", "mixeq", "bpm", "secnum", "seceq", "secsend",
                            "seckit", "secmot", "secper", "ops", "drums", "think"]);
    let sentences = 0;
    for (const scope of SCOPES) {
      const first = L.continuations([], scope);
      for (const v of first) for (const w2 of L.continuations([v], scope)) {
        const p2 = L.parse([v, w2], scope);
        const check = (p) => {
          if (!p) return;
          sentences++;
          for (const e of p.fx) {
            ok(shapes.has(e.t), p.text + ": unknown effect shape " + e.t);
            if (e.t === "ops") ok(!!NF.OPS[e.add], p.text + ": op \"" + e.add + "\" is not in the registry");
            if (e.t === "seceq" || e.t === "mixeq")
              ok(["lo", "mid", "hi"].includes(e.band), p.text + ": eq band " + e.band);
            if (e.t === "seckit") ok(["busy", "sparse", "four", "nodrums"].includes(e.word),
              p.text + ": kit word " + e.word);
            if (e.t === "secmot") ok(["open", "close", "rise", "pump"].includes(e.word),
              p.text + ": mot word " + e.word);
            if (e.t === "mix") ok(["drums", "bass", "lead", "pad", "master"].includes(e.chan)
              && ["fader", "rev", "del"].includes(e.key), p.text + ": mix target " + e.chan + "." + e.key);
          }
        };
        check(p2);
        if (!p2) for (const w3 of L.continuations([v, w2], scope)) check(L.parse([v, w2, w3], scope));
      }
    }
    ok(sentences > 600, "only " + sentences + " reachable sentences — the couch deserves more");
    console.log("  reachable compiled sentences across both scopes:", sentences);
  }

  /* (c2) COMPLETENESS: the founding sentences are TAPPABLE — every word on
     the path is offered by the tray at its step (the MAKE family was once
     parseable but never offered; exactness held while completeness didn't) */
  for (const [words, scope] of [[["add", "drums"], "section"], [["cut", "the drums"], "song"],
      [["make", "drums", "bigger"], "song"],
      [["cut", "high", "notes"], "song"], [["add", "more", "notes"], "section"],
      [["bring up", "reverb"], "song"], [["make", "the bed", "warmer"], "song"]]) {
    let t = [];
    for (const w of words) {
      ok(L.continuations(t, scope).has(w),
         scope + ": the tray never offers \"" + w + "\" after \"" + t.join(" ") + "\"");
      t = [...t, w];
    }
  }
  /* (c2b) ADD DRUMS is presence, BRING UP is level — the two must differ */
  {
    const add = L.parse(["add", "drums"], "song");
    const up = L.parse(["bring up", "drums"], "song");
    ok(add && add.fx[0].t === "drums" && add.fx[0].on === true, "ADD DRUMS is not presence");
    ok(!!L.parse(["cut", "the drums"], "section") &&
       L.parse(["cut", "the drums"], "section").fx[0].on === false, "CUT THE DRUMS is not removal");
    ok(up && up.fx[0].t === "mix" && up.fx[0].key === "fader",
       "BRING UP DRUMS stopped being the fader");
  }
  /* (c2c) THE GRAMMAR READS THE RECORD: no drums means no drum sentences
     except ADD DRUMS; drums present means ADD DRUMS is not offered; a send at
     its ceiling cannot be brought up further; a missing part is no subject */
  {
    const NO_DRUMS = { ...L.OPEN_CTX, drumsOn: false, drumsOff: true };
    const ALL_DRUMS = { ...L.OPEN_CTX, drumsOn: true, drumsOff: false };
    ok(!L.parse(["make", "drums", "louder"], "song", NO_DRUMS),
       "MAKE DRUMS LOUDER compiled with no drums on the record");
    ok(!L.parse(["bring up", "drums"], "song", NO_DRUMS),
       "BRING UP DRUMS compiled with no drums on the record");
    ok(!!L.parse(["add", "drums"], "song", NO_DRUMS), "ADD DRUMS refused where drums are missing");
    ok(!L.parse(["add", "drums"], "song", ALL_DRUMS), "ADD DRUMS offered where drums already play");
    ok(!!L.parse(["cut", "the drums"], "song", ALL_DRUMS), "CUT THE DRUMS refused where drums play");
    ok(!L.parse(["cut", "the drums"], "song", NO_DRUMS), "CUT THE DRUMS offered with nothing to cut");
    ok(!L.continuations(["make"], "song", NO_DRUMS).has("drums"),
       "the tray offers DRUMS after MAKE on a drumless record");
    const CEIL = { ...L.OPEN_CTX, rev: 4, revMax: 4 };
    ok(!L.parse(["bring up", "reverb"], "section", CEIL),
       "BRING UP REVERB compiled at a section whose send is already at its ceiling");
    ok(!!L.parse(["bring down", "reverb"], "section", CEIL), "…but DOWN must still work there");
    const NO_CHORDS = { ...L.OPEN_CTX, parts: { bass: true, melody: true, chords: false } };
    ok(!L.parse(["make", "chords", "warmer"], "song", NO_CHORDS),
       "MAKE CHORDS WARMER compiled on a record with no chords");
  }
  /* (c2d) THINK — the genre system on the couch. MORE stacks, LESS unstacks,
     LESS only where stacked, MORE not where already thinking it; every
     THINKable word answers to a REAL anchor. */
  {
    const { GENRES } = require("../../nukernel/genres.js");
    for (const [canon, g] of Object.entries(L.LEXICON.G))
      ok(!!GENRES[g.anchor], "THINK " + canon + " names a missing anchor: " + g.anchor);
    ok(!!L.parse(["think", "more", "punk"], "section"), "THINK MORE PUNK does not compile");
    ok(!!L.parse(["think", "jazzy"], "song"), "THINK JAZZY (bare = more) does not compile");
    const NOSTACK = { ...L.OPEN_CTX, stacked: {} };
    ok(!L.parse(["think", "less", "pop"], "song", NOSTACK),
       "THINK LESS POP compiled with no pop layer standing");
    ok(!!L.parse(["think", "less", "pop"], "song", { ...L.OPEN_CTX, stacked: { clubpop: true } }),
       "THINK LESS POP refused where a pop layer stands");
    ok(!L.parse(["think", "more", "punk"], "song", { ...L.OPEN_CTX, stacked: { punk: true } }),
       "THINK MORE PUNK offered where punk is already thinking");
    ok(!L.parse(["make", "punk", "bigger"], "song"), "a genre took MAKE — genres are only THINKable");
  }
  /* (c2e) ADD DRUMS invents where a genre never had a kit (ctx.drumsOff covers
     the kitless case; the apply layer's kit word "four" is the mechanism) */
  {
    const KITLESS = { ...L.OPEN_CTX, drumsOn: false, drumsOff: true };
    ok(!!L.parse(["add", "drums"], "section", KITLESS), "ADD DRUMS refused on a kitless record");
  }
  /* (c3) every compiled sentence TRANSLATES: describeFx says something real */
  {
    const p = L.parse(["make", "drums", "bigger"], "song");
    const d = L.describeFx(p.fx, "song");
    ok(/drums/.test(d) && /dB/.test(d), "MAKE DRUMS BIGGER translates to: " + d);
    ok(L.describeFx(L.parse(["bring up", "reverb"], "song").fx, "song").includes("reverb"),
       "BRING UP REVERB's translation never says reverb");
  }

  /* (d) the cap */
  ok(L.MAX_CMDS === 5, "five commands per node is the law (got " + L.MAX_CMDS + ")");

  console.log(fails ? "\nrubin-lang: FAIL — " + fails + " of " + (pass + fails)
    : "rubin-lang: PASS — " + pass + " checks (the founding sentences, the exactness law "
      + "walked to closure, every effect lands on real vocabulary, five per node)");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error("rubin-lang: CRASH — " + (e && e.stack || e)); process.exit(1); });
