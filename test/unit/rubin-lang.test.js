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
                            "seckit", "secmot", "secper", "ops"]);
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

  /* (d) the cap */
  ok(L.MAX_CMDS === 5, "five commands per node is the law (got " + L.MAX_CMDS + ")");

  console.log(fails ? "\nrubin-lang: FAIL — " + fails + " of " + (pass + fails)
    : "rubin-lang: PASS — " + pass + " checks (the founding sentences, the exactness law "
      + "walked to closure, every effect lands on real vocabulary, five per node)");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error("rubin-lang: CRASH — " + (e && e.stack || e)); process.exit(1); });
