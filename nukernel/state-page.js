#!/usr/bin/env node
/* nukernel/state-page.js — PUT THE JSON IN THE PAGE.

   (Paul, 2026-08-23, in order: "Get rid of all HTML and show me the app
   state as indented JSON. Use a pretty printer." … "Don't render anything"
   … "Just PUT the json in the page.")

   So nothing renders. state.html is not a program that computes a state and
   writes it into an element — it is a file with the state IN it. No
   stylesheet, no module graph, no service worker, no engine: the whole page
   is a <pre> and the value inside it, and there is nothing that can fail
   between the state and your eye.

   This is the program that writes that file, and it is the only reason the
   page is not hand-typed: the state is EXTRACTED from the running data tier
   (band-kit's opening record, producer.js's tempo, interview.js's questions
   and answers), exactly as vocabulary.js is extracted from the running box.
   Re-run it and the page is current:

       node nukernel/state-page.js            # writes nukernel/state.html
       node nukernel/state-page.js --roll     # ...from a rolled record instead

   WHAT IS NOT IN THE STATE, and why. The live page carried two DEVICE
   settings — whether the transport is sounding, and the volume this browser
   keeps (ui/state.js VOLSTORE) — and neither is a fact about the record.
   A file printed on a machine with no speaker must not claim them. What is
   left is the record's own: whether the band is counted in, and the tempo
   the ENGINE would be handed (the producer's, if a note moved it). */
"use strict";

const fs = require("fs");
const path = require("path");
const Band = require("./band-kit.js");
const Prod = require("./producer.js");
const Interview = require("./interview.js");
const { MODES } = require("./genres.js");

/* THE PRETTY PRINTER, and it is a real one rather than JSON.stringify's
   indent argument. That argument has no idea what fits: it put each of the
   sixteen numbers of a drum vector on a line of its own, which is 9,203
   lines of state most of which is a column of 1s and 0s. This is the classic
   fits-on-a-line rule (Wadler's `group`, in eight lines): a value whose flat
   spelling fits the width prints flat, and only what does not opens up. A
   kit pattern is one line; the record it belongs to is a page. 3,738 lines.

   Two spaces, because that is what every other JSON this tree prints uses
   and a state you read on a phone should not indent itself off the screen. */
const WIDTH = 88;
function pretty(v, ind) {
  const flat = JSON.stringify(v);
  if (flat === undefined) return "null";                    // a function, a symbol
  if (v === null || typeof v !== "object" || ind.length + flat.length <= WIDTH)
    return flat;
  const in2 = ind + "  ";
  if (Array.isArray(v))
    return v.length
      ? "[\n" + v.map((x) => in2 + pretty(x, in2)).join(",\n") + "\n" + ind + "]" : "[]";
  const ks = Object.keys(v).filter((k) => v[k] !== undefined);
  return ks.length
    ? "{\n" + ks.map((k) => in2 + JSON.stringify(k) + ": " + pretty(v[k], in2))
        .join(",\n") + "\n" + ind + "}"
    : "{}";
}

/* THE STATE, three parts, and the middle one is the whole former page:

     transport  what the room is doing — counted in or not, at what tempo
     record     what was said: band-kit's model, the document itself
     interview  what was ASKED, and what every other answer would have been —
                interview.js interviewOf, seat by seat, grouped by the heading
                each question declares, plus the per-section rows

   The SCORE (what gets played — toSong's event list, ~100 KB) is deliberately
   not here: it is derived from the record and it is the engine's copy, not the
   app's state. */
function stateOf(m) {
  const produced = Prod.run(m, Band.toSong(m, MODES));
  return {
    transport: { on: !!m.on, bpm: produced.bpm },
    record: m,
    interview: Interview.interviewOf(m, MODES),
  };
}

// the record the room opens with (ui/band.js `Band.opening()`), or a rolled
// one — the same two records the removed keys used to reach
const roll = process.argv.includes("--roll");
const model = roll ? Band.randomSong() : Band.opening();
const json = pretty(stateOf(model), "");

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>The band — the state</title>
<meta name="robots" content="noindex">
<!-- THE JSON IS IN THE PAGE. Nothing renders it: no stylesheet, no scripts,
     no service worker, no engine — a <pre> and the value. Written by
     nukernel/state-page.js, which extracts it from the running data tier;
     re-run that to make this current. The page it replaces (headings,
     questions, form controls, two staves, a circle of fifths) is recoverable
     whole: git stash list -> "band UI before the JSON state dump". -->
</head>
<body>
<pre>
${json.replace(/&/g, "&amp;").replace(/</g, "&lt;")}
</pre>
</body>
</html>
`;
const out = path.join(__dirname, "state.html");
fs.writeFileSync(out, page);
console.error(out + ": " + json.split("\n").length + " lines of state, " +
  Interview.everyAsk(stateOf(model).interview).length + " questions" +
  (roll ? " (rolled record)" : " (the opening record)"));
