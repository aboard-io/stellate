#!/usr/bin/env node
/* test/copy.test.js — THE CATALOGUE IS THE COPY, AND IT IS HELD TO A STANDARD.
 *
 * (nukernel/TABLE.md §11 "THE FUNCTIONAL TEXT PASS" and §12b "copy that can be
 * translated"; the voice is nukernel/DESIGN.md §4. Paul, 2026-09-05: *"There's
 * all this copy like 'the sections own' and so forth. Just call things
 * 'default.' Rewrite it all to be familiar and app like. It's very random and
 * claudeish right now."* / *"look for ways to simplify copy strings assuming
 * they will eventually be translated."*)
 *
 * THIS GATE READS THE CATALOGUE. Its twin, test/copy.browser.js, reads the
 * RENDERED PAGE and fails on any printed word the catalogue did not produce —
 * the [[test-the-artifact]] half, and the one that catches a string composed at
 * runtime. Neither is sufficient alone: a page can print a sentence no table
 * holds, and a table can hold a sentence no budget allows.
 *
 * WHAT IS ASSERTED
 *   C1  EVERY KEY IS SHAPED LIKE A KEY — `<surface>.<meaning>` in camelCase,
 *       no spaces, no punctuation but the dots. A key is an address.
 *   C2  NO STRING IS OVER BUDGET. DESIGN.md §4 sets two numbers: a chip or a
 *       face is ≤ 6 words, a sentence beside a refused control is ≤ 12. Which
 *       of the two a key is held to is read off the key itself (`.aria`,
 *       `.say`, `.why`, `.title`, `.alt` and the `refuse.` family are
 *       sentences; a `.unit` is two words; everything else is a face). Words
 *       are counted by the audit's own `copyWords` — a number with its unit is
 *       one token, an enumerated list is one token, a `·`-joined readout is
 *       measured segment by segment.
 *   C3  NO BANNED PATTERN. The twenty families the audit measured, verbatim
 *       from scratchpad/copy-audit/REPORT.md.
 *   C4  NO TWO KEYS MEAN THE SAME THING — one meaning, one key, or a
 *       translator translates the same sentence twice and they drift.
 *   C5  PLURALS COME IN PAIRS. A `.one` without its `.other` is a caller
 *       about to write `n === 1 ? a : b`.
 *   C6  PLACEHOLDERS ARE WELL FORMED, and `{n}` only appears where a count is
 *       passed. No `{}` left half-written, no `%s`, no `$1`.
 *   C7  EVERY KEY THE CODE ASKS FOR EXISTS. Every `t("…")`, `tn("…")` and
 *       `COPY.t("…")` in the served tree is resolved against the catalogue —
 *       a missing key prints as the key itself, which is a bug the browser
 *       never has to reach.
 *   C8  `fmt` FORMATS ONE WAY. 79 BPM, −1.5 dB, 8 ms, 50%, no trailing zeros.
 *   C9  NOTHING IS BLANK, and nothing carries stray whitespace.
 *
 * RUN: node test/copy.test.js          (fast — no browser, no server)
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push(what);
  console.log((ok ? "  ok   " : "  FAIL ") + what); };

/* ===== THE BANNED PATTERNS =============================================
   scratchpad/copy-audit/REPORT.md, "The banned-phrase list a gate should
   hold" — the twenty families it measured on the rendered page, moved here
   unchanged so the audit and the gate cannot drift. test/copy.browser.js
   requires this array off this file. */
const BANNED = [
  ["tap-to instructions inside a label", / — tap (to|again|for|one)|tap a name to|tap one first|tap to (select|type|set)/i],
  ["a date", /\b(19|20)\d\d-\d\d-\d\d\b|\bmeasured 20\d\d/],
  ["Paul, or a quoted person", /\bPaul\b|“|”/],
  ["commit narrative", /\b(REPOINTED|RE-DATED|THE SWAP|the great rename|SHIPPED|RULED|APPROVED|this ZIM)\b/],
  ["possessives of the box", /\bthe (record|section|genre|row|zone|band|box|anchor|composer)['’]s (own|key|mode|swing|groove|delay|lane|chairs?|performance|time)\b/i],
  ["\"not an honest word\" refusal", /not an honest word/i],
  ["\"open this X's vector\"", /open (this|what) [a-z]+.s? (vector|instrument|questions|plays)/i],
  ["a question used as a control label", /^(how|what|where|when|does|do|and|the filter) [a-z].*\?$/i],
  ["inherited said any other way", /\b(inherited|what it inherits|clear to inherit|derived:)\b/i],
  ["ungrammatical refusal template", /it.s as \w+ as it.s going to get/i],
  ["\"deal\"/\"dealt\" for a default value", /\b(deals?|dealt) (it|this|the|them|these)\b|\(as dealt\)/i],
  ["a source file, path or identifier", /[\w-]+\.(js|ts|json|md)\b|\bdocs\//],
  ["written here / nothing written / nothing said", /\b(written here|nothing written|nothing said)\b/i],
  ["narrative colour", /round and round|the hand.s dice|somebody else|declared but never|as it was cast|what it has always done|the tune you follow|the bottom of the band|under everything|the blank state/i],
  ["tempo said as prose", /\b(a minute|the record counts|this box counts|counts what you tapped)\b/i],
  ["\"chair\"/\"seat\" for a player or a track", /\b(chairs?|seats?) (sit|come in|on the desk|is out of|of the record)|its seat on the/i],
  ["the app calls itself a box", /\bthis box\b|\byour box\b|\bthe box (has|would|writes|counts|deal)/i],
  ["a code identifier in parentheses", /\((capOf|cellBarsOf|toPhrase|rmsNow|IDIOM|cast\.reg|box\.focus)\)?/],
  ["the atlas as an actor", /\bthe atlas (deals?|dealt)\b|\bas the atlas\b/i],
  ["\"reading\" for a seed", /\breading \d+|another reading of/i],
];

/* THE REVIEW'S GLOSSARY (TABLE.md §12a), as a second, narrower net: the words
   the musicologist renamed. These are about the app's own vocabulary rather
   than about narrative, so they are their own list and their own line. */
const GLOSSARY = [
  ["\"chair\" for a part", /\bchairs?\b/i],
  /* ...AND THIS ONE IS THE OTHER WAY ROUND SINCE 2026-09-05 (TABLE.md §13e).
     Paul: *"Call phrases motifs."* The review renamed the bank's thing to
     `phrase` and the box has been addressing it `motif` all along
     (`motifpoint|…`, `A.motifLamp`, the MOTIFS row's own `data-special`), so
     the word went back to the address. What is banned is `phrase` FOR THAT
     THING; the form's own terms keep it — `phrasing` is an articulation (the
     PERFORMANCE row) and `phrase structure` / `phrase length` are the
     Development axis's, which is why the net exempts them by name rather than
     by hoping no key says them. */
  ["\"phrase\" for a motif", /\bphrases?\b(?!\s+(structure|length))/i],
  ["\"alphabet\" for a scale", /\balphabets?\b/i],
  ["\"word operator\" for a transformation", /\bword operators?\b/i],
  ["\"pace\" for feel", /\bpace\b/i],
  ["\"period\" for phrase structure", /\bperiods?\b/i],
];

/* ===== THE WORD COUNT ==================================================
   REPORT.md, "Length budgets per kind" — copy words, not data words. A number
   with its unit is one token; an enumerated list is one token; a `·`-joined
   value string is measured segment by segment, longest segment wins; an em
   dash is not a word. A `{placeholder}` is one word: it stands for a name or a
   number, and a budget that counted its braces would punish the very shape
   this round exists to introduce. */
function copyWords(s) {
  const t = String(s)
    .replace(/\{[a-zA-Z]\w*\}/g, "N")
    .replace(/\b([a-z]+ \d+)(, [a-z]+ \d+)+/gi, "LIST")
    .replace(/\b\d+(\.\d+)?\s?(BPM|dB|ms|kHz|kbps|bars?|steps?|bit|%)\b/gi, "N");
  return Math.max(...t.split(/\s+[·|]\s+/)
    .map((seg) => seg.replace(/[—–]/g, " ").trim().split(/\s+/).filter(Boolean).length));
}

/** Which budget a key is held to, read off the key itself. A key whose LAST
 *  SEGMENT begins with aria/say/why/title/alt/help is the sentence beside a
 *  control (`bar.play.aria`, `glyph.nav.up.sayBack`); a `refuse.` is a
 *  refusal's sentence; a `.unit` is a unit. Everything else is a face. */
function budgetOf(key) {
  const last = key.split(".").pop() || "";
  if (last === "unit") return 2;
  if (/^(aria|say|why|title|alt|help)/i.test(last)) return 12;
  /* A REFUSAL and a STATUS LINE are the same kind of thing: a sentence
     printed beside a control, not a word on one. `hold.*` is the offline
     readout ("held — plays offline"), which a person acts on before a
     tunnel. */
  if (/^(refuse|hold)\./.test(key)) return 12;
  return 6;
}

/* Keys whose value is a sentence for a reason that the suffix rule cannot see.
   EVERY ENTRY IS AN ARGUMENT, not a silencer: a key that lands here because it
   is long is a key that should have been shortened. */
const SENTENCE_KEYS = new Set([]);

/* Two keys may hold the same text only when they are two different MEANINGS
   that English happens to spell the same, which `merge` cannot know and a
   translator must be able to tell apart. Every entry is an argument.

   · `glyph.tab.time` is the TAB's word and it is an ADDRESS — `ui/eight.js`
     TABS is keyed by it and five gates read it back off the page — while
     `axis.time` is the heading over the Time rules in the Rules deck. One
     word today; two strings a translator may want to spell differently, and
     one of them may not move at all. */
const SAME_TEXT_OK = [
  ["glyph.tab.time", "axis.time", "group.time"],
  /* ...AND THE SHEET GROUPS, 2026-09-05 (TABLE.md §11c). `group.*` are the
     HEADINGS over a sheet's fields — the composer's four/five words for what a
     run of controls is about — and five of the thirteen are spelled the same
     as a word that already exists somewhere else on this page. Each pair is
     two meanings, and each is a pair a translator must be free to spell
     differently:
       · `glyph.tab.mix` is the TAB's word and an ADDRESS (`ui/eight.js` TABS
         is keyed by it, exactly as `glyph.tab.time` is above); `group.mix` is
         "where this player sits", over a register and an entry.
       · `axis.form` is the heading over the FORM rules in the Rules deck — a
         family of rules; `group.form` is the section's own shape (its type,
         its bars, its repeats).
       · `env.plate` is the accessible NAME of one envelope plate
         (`src/envelope/adsr.ts`); `group.envelope` is the heading over the
         plate and the two words beside it.
       · `knobs.tone` is a KNOB called Tone on a modelled throat
         (`knobs.js:1723`); `group.tone` is the heading over that whole throat.
     In every case one of the two may not move at all, which is the test this
     list's own first entry states. */
  ["glyph.tab.mix", "group.mix"],
  ["axis.form", "group.form"],
  ["env.plate", "group.envelope"],
  ["knobs.tone", "group.tone"],
  /* ...and `rule.headMeter` is a COLUMN HEAD in the rules deck's own table
     (which meter a rule is about); `group.meter` is the heading over the TIME
     row's meter chips and its two numbers. */
  ["rule.headMeter", "group.meter"],
  /* ...AND TWO MORE OF THE SAME SHAPE, 2026-09-05 (TABLE.md §13f, Paul: *"Add
     chords below time and move chord stuff into it"*):
       · `rule.headHarmony` is a COLUMN HEAD in the rules deck (which harmony
         a rule is about — the same argument `rule.headMeter` makes one line
         up); `group.harmony` is the heading over the CHORDS sheet's second
         group, the harmony cycle and the melody flag.
       · `field.chords` is a FIELD's label — the section row's own chart
         (`avail.js` keys `prog` to it) and the rules deck's row for it;
         `special.chords.word` is the WORD ON THE ROW, the record-level
         subject the whole sheet opens. A translator may spell "the chords of
         this section" and "CHORDS" differently, and one of the two may not
         move at all, which is this list's own first entry's test. */
  ["rule.headHarmony", "group.harmony"],
  ["field.chords", "special.chords.word"],
  /* (TWO PAIRS STOOD HERE UNTIL 2026-09-06, TABLE.md §15a. Paul: *"Get rid of
     the words 'the record' and the Section header entirely — we can make
     room."* `grid.sections.word` was the heading over the grid and
     `special.record.word` the heading over the record's seven; both rows are
     gone and both keys are deleted, so the exemptions they needed are deleted
     with them rather than left pointing at nothing. An exemption for a key
     that does not exist is the same orphan the keys themselves would have
     been.) */
];

async function run() {
  console.log("\ncopy — the catalogue, held to DESIGN.md §4");

  /* THE CATALOGUE AS THE PAGE GETS IT: the committed nukernel/ui/copy.js, not
     the TypeScript source. `ui-build --check` is what says the two agree, and
     reading the built artifact here means this gate is about the file the
     browser loads. (nukernel/ui/package.json marks the directory as ESM, so a
     dynamic import from this CommonJS gate is the door.) */
  const built = path.join(ROOT, "nukernel", "ui", "copy.js");
  if (!fs.existsSync(built)) {
    console.log("  FAIL nukernel/ui/copy.js does not exist — run node tools/ui/build.js");
    process.exit(1);
  }
  const COPY = await import("file://" + built);
  const S = COPY.STRINGS;
  const keys = Object.keys(S);
  console.log("  … " + keys.length + " keys in the catalogue");

  /* C1 — a key is an address. */
  const badKey = keys.filter((k) => !/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(k));
  check(!badKey.length, "C1 every key is <surface>.<meaning>" +
    (badKey.length ? " — " + badKey.slice(0, 6).join(", ") : ""));

  /* C2 — the budgets. */
  const over = [];
  for (const k of keys) {
    const b = SENTENCE_KEYS.has(k) ? 12 : budgetOf(k);
    const w = copyWords(S[k]);
    if (w > b) over.push(k + " (" + w + " > " + b + ") " + JSON.stringify(S[k]));
  }
  check(!over.length, "C2 no string is over budget (a face 6 words, a sentence 12)" +
    (over.length ? " — " + over.length + " over: " + over.slice(0, 5).join(" · ") : ""));

  /* C3 — the twenty banned families, and the glossary. */
  const hits = [];
  for (const k of keys)
    for (const [name, re] of BANNED)
      if (re.test(S[k])) hits.push(name + ": " + k + " " + JSON.stringify(S[k]));
  check(!hits.length, "C3 no banned pattern in the catalogue" +
    (hits.length ? " — " + hits.length + ": " + hits.slice(0, 5).join(" · ") : ""));

  const gloss = [];
  for (const k of keys)
    for (const [name, re] of GLOSSARY)
      if (re.test(S[k])) gloss.push(name + ": " + k + " " + JSON.stringify(S[k]));
  check(!gloss.length, "C3b the review's glossary is kept" +
    (gloss.length ? " — " + gloss.length + ": " + gloss.slice(0, 5).join(" · ") : ""));

  /* C4 — one meaning, one key. */
  const byText = new Map();
  for (const k of keys) {
    const t = S[k].trim();
    if (!byText.has(t)) byText.set(t, []);
    byText.get(t).push(k);
  }
  /* A PLURAL PAIR MAY READ THE SAME IN ENGLISH and must still be two keys:
     "{n} more" is "{n} more" either way here and is not in Polish. Siblings of
     one base are one meaning, so they are not a duplicate. */
  const base = (k) => k.replace(/\.(one|other)$/, "");
  const dup = [...byText.entries()].filter(([t, ks]) => ks.length > 1 &&
    new Set(ks.map(base)).size > 1 &&
    !SAME_TEXT_OK.some((set) => ks.every((k) => set.includes(k))))
    .map(([t, ks]) => JSON.stringify(t) + " = " + ks.join(" + "));
  check(!dup.length, "C4 no two keys mean the same thing" +
    (dup.length ? " — " + dup.length + ": " + dup.slice(0, 5).join(" · ") : ""));

  /* C5 — plurals in pairs. */
  const lonely = keys.filter((k) => /\.(one|other)$/.test(k))
    .filter((k) => !S[k.replace(/\.(one|other)$/, (m) => m === ".one" ? ".other" : ".one")]);
  check(!lonely.length, "C5 every plural has both forms" +
    (lonely.length ? " — " + lonely.join(", ") : ""));

  /* C6 — placeholders. */
  const badPh = [];
  for (const k of keys) {
    const v = S[k];
    if (/%s|%d|\$\d|\{\}|\{\s|\s\}/.test(v)) badPh.push(k + " " + JSON.stringify(v));
    /* a lone brace is a placeholder somebody half-typed. */
    const braces = (v.match(/[{}]/g) || []).length;
    if (braces % 2) badPh.push(k + " (odd brace) " + JSON.stringify(v));
  }
  check(!badPh.length, "C6 placeholders are {name}-shaped" +
    (badPh.length ? " — " + badPh.join(", ") : ""));

  /* C7 — every key the code asks for exists. The sweep reads the SERVED tree
     and the TypeScript that builds part of it; generated ui/*.js mirror their
     sources and are swept too, which costs nothing and catches a stale
     artifact. */
  const files = [];
  const walk = (dir, re) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, re); }
      else if (re.test(e.name)) files.push(p);
    }
  };
  walk(path.join(ROOT, "nukernel"), /\.(js|ts)$/);
  const asked = new Map();
  const KEYRE = /(?:\bCOPY\.)?\b(t|tn)\(\s*"([a-zA-Z][\w.]*)"/g;
  for (const f of files) {
    if (/[/\\](copy\.js|copy)[/\\]?$/.test(f) || /src[/\\]copy[/\\]/.test(f)) continue;
    if (/[/\\]ui[/\\]copy\.js$/.test(f)) continue;
    /* COMMENTS ARE BLANKED FIRST — this tree's house style is long prose in
       the source, and one of those paragraphs says `a t("key") there would
       call a DOM node`. A sweep that read comments would ask the catalogue
       for `key`. (The copy audit blanked them for the same reason.) */
    const src = fs.readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
    let m;
    while ((m = KEYRE.exec(src))) {
      const key = m[1] === "tn" ? m[2] + ".one" : m[2];
      if (!asked.has(key)) asked.set(key, f);
      if (m[1] === "tn" && !asked.has(m[2] + ".other")) asked.set(m[2] + ".other", f);
    }
  }
  /* A KEY BUILT FROM A PREFIX (`t("env.seg." + seg)`) is legitimate — one
     family, one call site — and it is checked as a FAMILY: the catalogue must
     hold at least one key under it. What the exact members are is the browser
     gate's B1, which reads the keys the page actually asked for. */
  const unresolved = [...asked.entries()].filter(([k]) => {
    if (k in S) return false;
    if (/\.$/.test(k)) return !keys.some((x) => x.startsWith(k));
    return true;
  }).map(([k, f]) => k + " (" + path.relative(ROOT, f) + ")");
  check(!unresolved.length, "C7 every key the code asks for is in the catalogue (" +
    asked.size + " asked)" +
    (unresolved.length ? " — " + unresolved.length + " missing: " +
      unresolved.slice(0, 8).join(", ") : ""));

  const unused = keys.filter((k) => !asked.has(k));
  console.log("  …  " + (keys.length - unused.length) + " of " + keys.length +
    " keys are reached by a literal call site" +
    (unused.length ? " (" + unused.length + " reached dynamically or unused)" : ""));

  /* C8 — one formatter. */
  const F = COPY.fmt;
  const fmtCases = [[79, "BPM", "79 BPM"], [-1.5, "dB", "−1.5 dB"],
    [1.5, "dB", "+1.5 dB"], [8, "ms", "8 ms"], [50, "%", "50%"],
    [0.5, "", "0.5"], [2, "×", "2×"], [120.0, "BPM", "120 BPM"]];
  const badFmt = fmtCases.filter(([n, u, want]) => F(n, u) !== want)
    .map(([n, u, want]) => n + " " + u + " -> " + JSON.stringify(F(n, u)) +
      " want " + JSON.stringify(want));
  check(!badFmt.length, "C8 fmt formats one way" +
    (badFmt.length ? " — " + badFmt.join(" · ") : ""));

  /* C9 — nothing blank, nothing padded. */
  const blank = keys.filter((k) => !S[k] || S[k] !== S[k].trim());
  check(!blank.length, "C9 no blank or padded string" +
    (blank.length ? " — " + blank.join(", ") : ""));

  console.log("\ncopy: " + notes.length + " ok, " + fails.length + " failed");
  return fails.length ? 1 : 0;
}

/* REQUIRED, NOT RUN, when test/copy.browser.js asks for the banned list: the
   two gates hold ONE copy of the twenty patterns and of the word count, and a
   gate that exited the process on `require` would take its twin with it. */
module.exports = { BANNED, GLOSSARY, copyWords, budgetOf };

if (require.main === module)
  run().then((code) => process.exit(code),
             (e) => { console.error(e); process.exit(1); });
