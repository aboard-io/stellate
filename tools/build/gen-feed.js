#!/usr/bin/env node
/* gen-feed.js — THE RELEASE FEED for the box at stellate.app: what shipped,
   in the project's own voice, with a PLAYABLE RECORD on every item.
   ==========================================================================
   WHAT IT MAKES. Four files in nukernel/, which is the web root:

     feed.xml            RSS 2.0        the latest 50 releases
     feed.json           JSON Feed 1.1  the same 50
     feed-archive.xml    RSS 2.0        every release, back to the first commit
     feed-archive.json   JSON Feed 1.1  the same

   nginx serves the two .xml as application/rss+xml and the two .json as
   application/feed+json, so nothing here writes a content type; what it owes
   the server is bytes that are actually valid under those types, which is what
   the self-check at the bottom is for (it runs on every build and exits
   non-zero rather than shipping a feed a reader will silently drop).

   WHY. The history of this branch is already written as release notes and has
   been for a year: a subject line that reads like a headline, a body of
   argued prose with ALL-CAPS section leads and quoted asks from Paul, and a
   closing wall of gate results. So this is not a commit firehose and it is not
   a changelog generator — it is a READER of a form the log already has:

     headline   = the commit subject (`v329: a tab is not a box, an × is not
                  lit, and the plate is whole from anywhere` is a headline)
     lede       = the body's opening prose, unwrapped, first sentences
     highlights = the ALL-CAPS sections, one line each
     verified   = the gate/test line, because the thesis of this project is
                  that a change lands only when the gates stay green
     ▶ play     = a URL that opens a real record in the box

   ── THE PLAYABLE LINK, which is the part that needed care ─────────────────

   This app has no map coordinates and no `?genre=` query. Its share grammar is
   a FRAGMENT, parsed by `readLink()` in nukernel/ui/eight.js and spent by
   `open()` in nukernel/ui/atlas.js:

       #at=<place>&y=<year>&s=<seed>&t=<tab>

   `at` and `y` name a record the way ui/atlas.js says a person means one:
   *"`at=Kingston` is a word a person can read in a URL and, when the catalog
   moves under it, `recordAt` resolves it to the nearest year rather than
   404ing on a key that was renamed."* So the link carries a PLACE AND A YEAR,
   never a genre key — and every genre row already carries exactly that pair,
   spelled as its `label`: "Kingston 1969", "Ur 2500 BC", "Vienna 1788".

   THE LABELS ARE READ, NEVER TYPED. `require("nukernel/genres.js").GENRES`
   is the catalogue; the label is split with the same regex nukernel/atlas.js
   uses for its own bake — /^(.+?)\s+(?:(\d{1,5})\s+BC|(\d{3,4}))$/ — so a BC
   label becomes a negative `y=` and the arithmetic on the other end is the
   signed number with no special case. No place and no year is invented here;
   if a row has no "Place Year" label it gets no link (see REFUSALS).

   AND EVERY LINK IS ROUND-TRIPPED THROUGH THE APP'S OWN RESOLVER BEFORE IT IS
   WRITTEN. `nukernel/atlas.js` is plain CommonJS, so this tool can require it
   and ask `recordAt(place, year)` the identical question the page will ask.
   A link is emitted only when the answer comes back as the row we meant. It
   costs one function call and it forecloses three ways of shipping a dead URL:

     · a row with no "Place Year" label at all — `silence`, `pop`, `riff` and
       the other seven the atlas itself EXCLUDEs. 10 rows today, and they are
       the only rows this build skips.
     · a place that is not on the globe (`PLACES` has no row) — the page would
       print "this link points at “X”, which is not a place on this globe" and
       open its own record instead. 0 rows today; the catalogue has drifted
       here before and will again.
     · two rows sharing a place AND a year — `recordAt` is nearest-year, tie to
       the earlier, so one of a colliding pair is unreachable by (place, year)
       and a link naming it would quietly play its sibling. 0 rows today.

   That is 500 of 510 rows addressable, checked on every build rather than
   remembered from the day this was written.

   THE SEED IS THE GENRE'S, NOT THE COMMIT'S, and that is a decision. A seed
   per sha would give every entry its own reading, which is prettier — but
   gen-sitemap.js has no sha and its brief is *"the same seed rule as the
   feed"*, and two seed rules is two things to drift. So the seed is a hash of
   the genre key, clamped into the app's own 1..65535 (ui/atlas.js `clampSeed`,
   Paul: *"a vertical slider from zero to 2^16"*). Consequence, stated plainly:
   two entries about the same genre play the same reading. That is the right
   trade — a link's job here is to be STABLE, so that the same URL in a feed
   reader, in the sitemap and in a search result is the same music.

   WHICH GENRE AN ENTRY GETS, in order, first match wins:
     1. a row's own label in the text — "MEASURED ON KINGSTON 1969" is a real
        line in this log and it names a record exactly.
     2. a genre file in the diff — nukernel/genres/<key>.json is unambiguous.
     3. a genre KEY as a word, but only when the commit touched the genre layer
        at all: this catalogue owns `house`, `trap`, `dub`, `garage`, `drone`,
        `minimal` and `swing`, and without that guard "the house style", "trap
        the error" and "a minimal diff" would each name a record.
     4. the topic table (THEMES below), where every row carries the sentence
        that says WHY that record exposes that change — drum work opens the
        record that is mostly drums, harmony work opens the one with nowhere
        for a chord to hide, and so on.
     5. HOME, the default: Kingston 1969. It is this project's own worked
        example — the gate bodies measure on it by name — so it is the record
        the box should hand a stranger who arrived by accident.

   ── OUTPUT, AND THE ONE RULE ──────────────────────────────────────────────
   The four files are DERIVED (the git log is the source), so they are
   gitignored like every other derived artifact and regenerated on the way out
   the door by the deploy. Nothing here is committed except this recipe.

   IDEMPOTENT ON PURPOSE: nothing in the bytes comes from the clock.
   `lastBuildDate` is the newest release's own date, not `new Date()`. A feed
   whose bytes change when nothing shipped is a feed the deploy rsyncs on every
   run and a reader re-downloads for nothing.

   ── USAGE ─────────────────────────────────────────────────────────────────
     node tools/build/gen-feed.js            # write all four
     node tools/build/gen-feed.js --limit 25 # a shorter live feed
     node tools/build/gen-feed.js --dry      # print what it would write, write nothing
     node tools/build/gen-feed.js --show 3   # dump 3 rendered entries as text
   Exits non-zero when the log is unreadable or a rendered feed fails its own
   validity check. Zero dependencies, no network: node + git + this repo.

   It is also a MODULE: gen-sitemap.js requires it for `linkFor` and `seedOf`,
   because the sitemap's URLs and the feed's URLs have to be built by the same
   hand or they are two grammars wearing one name. */

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "nukernel");
const SITE = "https://stellate.app";
const REPO = "https://github.com/aboard-io/stellate";
const AUTHOR = { name: "Paul Ford", email: "ford@ftrain.com", url: "https://www.ftrain.com/" };
const LIVE_MAX = 50;              // feed readers behave badly with a thousand items
const TAB = "band";               // the tab a shared record opens on: the song itself

// ══════════════════════════════════════════════════════════════════════════
// 1. THE CATALOGUE, AND THE APP'S OWN ANSWER ABOUT WHAT A LINK OPENS
// ══════════════════════════════════════════════════════════════════════════
const { GENRES } = require(path.join(OUT, "genres.js"));
const ATLAS = require(path.join(OUT, "atlas.js"));

// nukernel/atlas.js's own LABEL_RE, quoted rather than reinvented: "Place Year"
// or "Place Year BC", and BC is a negative number from here on down.
const LABEL_RE = /^(.+?)\s+(?:(\d{1,5})\s+BC|(\d{3,4}))$/;

function placeYear(gk) {
  const m = LABEL_RE.exec(String((GENRES[gk] && GENRES[gk].label) || ""));
  if (!m) return null;
  return { place: m[1], year: m[2] ? -Number(m[2]) : Number(m[3]) };
}

/* THE ROUND TRIP. Ask the page's own resolver what (place, year) opens, and
   believe it. `null` means "this row cannot be addressed by a link", and every
   caller here treats that as a refusal to emit rather than as an error. */
function addressable(gk) {
  const py = placeYear(gk);
  if (!py) return null;
  if (!ATLAS.PLACES[ATLAS.canon(py.place)]) return null;
  let r = null;
  try { r = ATLAS.recordAt(py.place, py.year); } catch (e) { return null; }
  if (!r || r.gk !== gk) return null;
  return py;
}

/* The seed: a stable 32-bit mix of the genre key, clamped to the app's slider
   range. FNV-1a because it is four lines and never changes its mind. */
function seedOf(gk) {
  let h = 0x811c9dc5;
  for (let i = 0; i < gk.length; i++) { h ^= gk.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 65535) + 1;                      // 1..65535; 0 is not a reading
}

/* THE ONE LINK BUILDER, and the only one in this repo. `full` false gives the
   fragment alone (for a log line); true gives the absolute URL a feed or a
   sitemap prints. Commas and slashes never appear, so nothing needs unescaping
   afterwards the way the old generator's `%2C` did. */
function linkFor(gk, opts) {
  const py = addressable(gk);
  if (!py) return null;
  const frag = "at=" + encodeURIComponent(py.place) +
               "&y=" + String(py.year) +
               "&s=" + String(seedOf(gk)) +
               "&t=" + TAB;
  /* THE PUBLISHED URL IS A QUERY AND THE CANONICAL ONE IS A FRAGMENT
     (2026-09-08). Both name the same record and the app reads both — see
     `readLink()` in nukernel/ui/eight.js. A crawler does not read fragments at
     all: `stellate.app/#at=Leipzig&y=1725` and `stellate.app/` are one URL to
     every search engine there is, so a sitemap of five hundred fragment links
     describes one page five hundred times. `?` is a different URL to a crawler
     and the same record to this box, which is what makes the catalogue
     addressable. The page rewrites a `?` arrival to `#` on landing, so what
     circulates between people is still the one shape this app writes. */
  const site = (opts && opts.site) || SITE;
  return { gk, place: py.place, year: py.year, seed: seedOf(gk),
           label: GENRES[gk].label, frag,
           url: site + "/?" + frag,
           hash: site + "/#" + frag };
}

// Every row that can be linked at all, in catalogue order. Both tools read it.
const LINKABLE = Object.keys(GENRES).filter((gk) => !!addressable(gk));
const UNLINKABLE = Object.keys(GENRES).filter((gk) => !addressable(gk));

// ══════════════════════════════════════════════════════════════════════════
// 2. NAMING A GENRE FROM A COMMIT
// ══════════════════════════════════════════════════════════════════════════
// label → key, for the "MEASURED ON KINGSTON 1969" case. Lowercased, because
// the log writes its section leads in capitals.
const BYLABEL = new Map();
for (const gk of LINKABLE) BYLABEL.set(String(GENRES[gk].label).toLowerCase(), gk);
// one pass over the text finds every "Place Year" / "Place Year BC" shape,
// which is far cheaper and far less trigger-happy than 492 separate regexes.
const LABEL_SCAN = /\b([A-Z][A-Za-z'’.\-]*(?:[ ][A-Z][A-Za-z'’.\-]*){0,3})\s+(\d{1,5}\s+BC|\d{3,4})\b/g;

/* THE AMBIGUOUS KEYS. This catalogue is 510 rows deep and a great many of its
   keys are also ordinary English or ordinary project vocabulary. These are
   only allowed to name a record when the commit actually touched the genre
   layer; the rest of the keys (`minneapolissound`, `retrohorrorsynth`) are
   distinctive enough to stand on their own anywhere. */
const AMBIG = new Set(["house", "trap", "dub", "garage", "drone", "minimal", "swing",
  "disco", "funk", "soul", "blues", "jazz", "rock", "punk", "pop", "waltz", "march",
  "vocal", "solo", "riff", "pad", "dance", "simple", "silence", "backing", "techno",
  "ambient", "chant", "opera", "shanty", "hymn", "bounce", "breakdown", "gospel",
  "chorale", "canon", "fugue", "study", "prelude", "surf", "twist", "stomp"]);
const GENRE_FILES = /(nukernel\/genres\/|nukernel\/genres\.js|nukernel\/genres-tables\.js|nukernel\/GENRES\.md|nukernel\/atlas\.js|tools\/genre-qa\/)/;

/* THEMES: topic → the record that best EXPOSES the change, and the sentence
   that says why. First match wins, so the order is the priority; the sentence
   is printed on the item, so it has to earn its place as prose, not as a tag.
   Every key here is checked at load (see the assertion under THEMES) — a
   catalogue rename that orphans one of these fails the build rather than
   quietly falling through to the default. */
const THEMES = [
  { t: "catalogue", re: /\b(catalogue|genre (row|list|table|key|rename)|chordonomicon|invent-genres|anchor row)\b/i,
    gk: "dhrupad", why: "an anchor mined out of a corpus rather than typed — the catalogue's own method" },
  { t: "drums", re: /\b(drums?|kit|snare|hi-?hat|kick|percussion|breakbeat|euclid|backbeat|drum lane)\b/i,
    gk: "amenbreak", why: "the record that is mostly drums, so a kit has nowhere to hide" },
  { t: "bass", re: /\b(bassline|reese|wobble|sub-?bass|808|low end)\b/i,
    gk: "dubstep", why: "the record that is mostly bass" },
  { t: "harmony", re: /\b(harmon\w*|chords?|progression|reharm\w*|cadence|voice[- ]leading|tonic|dominant|circle of fifths|diatonic)\b/i,
    gk: "jazz", why: "where a chord has the least anywhere to hide" },
  { t: "melody", re: /\b(melod\w*|motifs?|counterpoint|ornament\w*|lead line|contour)\b/i,
    gk: "fugue", why: "one subject, answered — a record that is nothing but its melody" },
  { t: "voice", re: /\b(vocals?|choir|chant|sung|lyrics?|syllable|espeak|singer)\b/i,
    gk: "gregorian", why: "unaccompanied voices in a room — the plainest test a vocal change gets" },
  { t: "sampler", re: /\b(sampler|samples?|soundfont|sf2|found sound|field recording|granular|crate)\b/i,
    gk: "tapemusic", why: "built out of recorded sound and nothing else" },
  { t: "meter", re: /\b(meter|metre|3\/4|6\/8|waltz|time signature|tempo|swing feel|downbeat)\b/i,
    gk: "waltz", why: "the 3/4 anchor — an odd meter is either right here or obviously wrong" },
  { t: "mix", re: /\b(mixdown|mix bus|eq|loudness|compressor|limiter|reverb|saturation|fader|clipping|lufs|dbfs)\b/i,
    gk: "dub", why: "the record where the mixing desk IS the instrument" },
  { t: "synth", re: /\b(synth\w*|oscillator|wavetable|fm|adsr|lfo|detune|portamento)\b/i,
    gk: "synthwave", why: "where the synthesis is the identity and not the decoration" },
  { t: "band", re: /\b(instruments?|ensemble|orchestrat\w+|voice column|band table)\b/i,
    gk: "symphony", why: "the largest cast the box seats — a change to who plays shows up here" },
  { t: "form", re: /\b(verse|chorus|refrain|coda|song form|arrangement|structure grid|sections?)\b/i,
    gk: "grandopera", why: "the longest-form record here, with room for a structural change to be wrong in" },
  { t: "atlas", re: /\b(globe|world map|latitude|longitude|deep time|year slider|place mark|era band)\b/i,
    gk: "hurrian", why: "the far end of the year slider, 1400 BC" },
  { t: "engine", re: /\b(worklet|ring buffer|underrun|wasm|audio ?context|dropout|realtime|glitch)\b/i,
    gk: "techno", why: "a machine record at speed — if the engine stutters you hear it in the first bar" },
  /* THE SURFACE IS LAST AND THAT IS THE POINT. Most rounds on this branch are
     chrome — a tab, a sheet, a cell, a token — and if this row sat any higher
     it would swallow the drum work and the harmony work, which mention their
     controls too. Last, it is the honest catch-all for "this changed how the
     box looks", and what falls past it has no musical subject at all. */
  { t: "surface", re: /\b(tabs?|sheets?|cells?|menu|hamburger|button|css|layout|design|plate|chrome|token|focus|aria|screen ?reader|mobile|iphone|viewport|hover|lozenge)\b/i,
    gk: "vaporwave", why: "the most obviously designed corner of the catalogue — surface work, on a surface" },
];

for (const th of THEMES) {
  if (!linkFor(th.gk)) {
    console.error(`gen-feed: THEMES row "${th.t}" names ${th.gk}, which no longer opens from a link.`);
    process.exit(1);
  }
}
const HOME = "reggae";            // Kingston 1969 — this project's worked example
if (!linkFor(HOME)) { console.error("gen-feed: the default record " + HOME + " no longer opens."); process.exit(1); }

function pickGenre(c) {
  const hay = c.subject + "\n" + c.body;

  // 1. a row's own label, spelled out
  LABEL_SCAN.lastIndex = 0;
  let m;
  while ((m = LABEL_SCAN.exec(hay))) {
    const gk = BYLABEL.get((m[1] + " " + m[2]).toLowerCase().replace(/\s+/g, " "));
    if (gk) return { gk, why: "the record this release names by name" };
  }

  // 2. a genre file in the diff
  for (const f of c.files) {
    const fm = /^nukernel\/genres\/([a-z0-9_-]+)\.json$/.exec(f);
    if (fm && linkFor(fm[1])) return { gk: fm[1], why: "the record whose recipe this release rewrote" };
  }

  /* 3. a genre key as a word — and a SINGLE passing mention does not count.
     Measured on this log: the launch plan says the old app's storage keys are
     `vaporwave-*`, which is one true occurrence of a genre key in a commit
     about nginx roots, and it was enough to make that entry play Portland
     2011. So a key wins only when it is in the SUBJECT (a headline names what
     a round is about), or the commit touched the genre layer at all, or the
     body says it more than once. */
  const low = hay.toLowerCase();
  const sub = c.subject.toLowerCase();
  const genreish = c.files.some((f) => GENRE_FILES.test(f));
  let best = null, bn = 0;
  for (const gk of LINKABLE) {
    if (gk.length < 5) continue;
    if (AMBIG.has(gk) && !genreish) continue;
    // underscores count as word characters: `bbc_electro_gong` is a sample id
    const re = new RegExp("(?:^|[^a-z0-9_])" + gk + "(?:[^a-z0-9_]|$)", "g");
    const n = (low.match(re) || []).length;
    if (!n) continue;
    if (n < 2 && !genreish && !re.test(sub)) continue;
    if (n > bn) { bn = n; best = gk; }
  }
  if (best) return { gk: best, why: "the record this release names" };

  /* 4. the topic table — ON THE SUBJECT, OR SAID TWICE. Same argument as step
     3 and it was measured the same way: a forty-line body about nginx roots
     holds the word "chord" nowhere and the word "changes" four times, and the
     first draft of this table read that as harmony work. A headline names what
     a round is about; one stray domain word in a long body does not. */
  const wide = hay + "\n" + c.files.join("\n");
  for (const th of THEMES) {
    const many = new RegExp(th.re.source, "gi");
    if (th.re.test(c.subject) || (wide.match(many) || []).length >= 2) {
      return { gk: th.gk, why: th.why };
    }
  }

  // 5. home
  return { gk: HOME, why: "the record this project measures on — where the box starts" };
}

// ══════════════════════════════════════════════════════════════════════════
// 3. READ THE LOG
// ══════════════════════════════════════════════════════════════════════════
const US = "\x1f", RS = "\x1e";
function readCommits() {
  let out;
  try {
    out = execFileSync("git", ["-C", ROOT, "log", "--no-merges", "--date=iso-strict", "--name-only",
      `--format=${RS}%H${US}%aI${US}%an${US}%s${US}%b${US}`], { encoding: "utf8", maxBuffer: 1 << 28 });
  } catch (e) {
    console.error("gen-feed: cannot read the git log — " + e.message);
    process.exit(1);
  }
  return out.split(RS).slice(1).map((chunk) => {
    const f = chunk.split(US);
    const files = (f[5] || "").split("\n").map((s) => s.trim()).filter(Boolean);
    return { sha: (f[0] || "").trim(), date: f[1], author: f[2],
             subject: (f[3] || "").trim(), body: f[4] || "", files };
  }).filter((c) => c.sha && c.subject);
}

/* COMMITS WE DO NOT WRITE HOME ABOUT. A bodied commit always gets to speak;
   these are the subjects that are pipes, not music. */
const CHORE = [
  /^merge\b/i, /^revert\b/i,
  /^(chore|wip|checkpoint|fixup|amend|squash|rebase|bump)\b/i,
  /^sw ?v?\d+\b/i, /^sw\.js/i,
  /^(fix )?typos?\b/i, /^whitespace\b/i, /^lint\b/i,
  /^regenerate the feed/i, /^feed:/i, /^sitemap:/i,
  /\(checkpoint, not deployed\)/i,
];
const PLUMBING = /(\.gitignore|gitignore|deploy manifest|\bci\b|workflow|package(-lock)?\.json|node_modules|\.mcp|submodule|rsync)/i;

// ══════════════════════════════════════════════════════════════════════════
// 4. READ A COMMIT MESSAGE AS RELEASE NOTES
// ══════════════════════════════════════════════════════════════════════════
const TRAILER = /^(co-authored-by|claude-session|signed-off-by|change-id|reviewed-by|🤖|https:\/\/claude\.ai)/i;
const NOISE = [
  /\bsw\.js\s*(->|→|to)\s*v\d+\.?/gi, /\bsw v\d+\.?/gi,
  /\s*\(local commits?[^)]*\)/gi,
];

const unwrap = (lines) => lines.join(" ").replace(/\s+/g, " ").trim();

function clean(s) {
  let t = s;
  for (const re of NOISE) t = t.replace(re, "");
  /* THE MARKDOWN COMES OFF, THE QUOTATION MARKS STAY. Paul's asks are written
     `*"like this"*` throughout the log and they are the best sentences in it;
     what a feed reader must not show is the asterisks, and what it must keep
     is the fact that somebody said it. Backticks around a filename go too —
     `nukernel/ui/atlas.js` is a filename either way and the tick is noise in
     a paragraph of plain text. */
  t = t.replace(/\*+(["“][^*]*?["”])\*+/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1")
       .replace(/(^|\s)\*([^*\s][^*]*?)\*(?=\s|$|[.,;:)])/g, "$1$2")
       .replace(/`([^`]+)`/g, "$1");
  return t.replace(/\s+/g, " ").replace(/\s+([,;])(?=\s|$)/g, "$1").replace(/\s+\.(?=\s|$)/g, ".").trim();
}

/* A SECTION LEAD IS A RUN WITH NO LOWERCASE IN IT, ended by a stop. That is
   the whole rule and it is chosen over "starts with two capitals" because this
   log's leads carry punctuation the naive version chokes on — "THE ×, WHICH
   NOTHING PAINTS." and "THE GATE CAUGHT A REAL REGRESSION AND I HAD SHIPPED
   IT. `table.browser.js` came" both land correctly here, and "Paul, in four
   notes:" is rejected at its second character because `a` is lowercase. */
function labelled(text) {
  const m = /^([^a-z]{4,80}?)\s*[.:,—]\s+(?=\S)/.exec(text);
  if (m && (m[1].match(/[A-Z]/g) || []).length >= 4) {
    const lab = m[1].replace(/[\s.:,;—-]+$/, "").trim();
    if (lab) return { label: clean(lab), text: clean(text.slice(m[0].length)) };
  }
  return { label: "", text: clean(text) };
}

function blocksOf(body) {
  const lines = body.split("\n").filter((l) => !TRAILER.test(l.trim()));
  const paras = lines.join("\n").split(/\n\s*\n/).map((p) => p.replace(/\s+$/, "")).filter((p) => p.trim());
  const out = [];
  for (const p of paras) {
    const ls = p.split("\n");
    if (ls.some((l) => /^\s*[-*•·]\s+/.test(l))) {
      const items = [];
      for (const l of ls) {
        if (/^\s*[-*•·]\s+/.test(l)) items.push([l.replace(/^\s*[-*•·]\s+/, "")]);
        else if (items.length) items[items.length - 1].push(l.trim());
        else items.push([l.trim()]);
      }
      for (const it of items) out.push(labelled(unwrap(it)));
      continue;
    }
    out.push(labelled(unwrap(ls)));
  }
  return out.filter((b) => b.text);
}

/* THE GATE LINE. Two shapes in this log: a labelled section (GREEN:, VERIFIED,
   MEASURED ON …) and a bare paragraph that names a gate file and its count
   ("test/document.test.js: 50 ok, 0 failed."). Both are the same claim. */
const GATEY = /^(gates?|gate wall|verified|verification|verify|tests?|test updates|proof|receipts|green|measured|the gates?)\b/i;
const GATEFILE = /\btest\/[\w./-]+\.js\b/;
const isGate = (b) => GATEY.test(b.label || b.text) || (GATEFILE.test(b.text) && /\b\d+\s+ok\b/i.test(b.text));

function clip(s, n) {
  if (s.length <= n) return s;
  const head = s.slice(0, n + 1);
  const stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("; "), head.lastIndexOf(" — "),
                        head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (stop > n * 0.45) return s.slice(0, stop + 1).replace(/[;,]$/, "").trim();
  const sp = head.lastIndexOf(" ");
  return (sp > 0 ? s.slice(0, sp) : s.slice(0, n)).replace(/[,;:—-]$/, "").trim() + "…";
}
function sentences(s, n) {
  const parts = s.split(/(?<=[.!?])\s+(?=[A-Z(“"'])/);
  let out = parts[0] || s;
  if (out.length < n * 0.55 && parts[1]) out += " " + parts[1];
  return clip(out, n);
}

function summarize(c) {
  const bs = blocksOf(c.body);
  const gates = bs.filter(isGate);
  const rest = bs.filter((b) => !isGate(b));
  let lede = "", start = 0;
  if (rest.length && !rest[0].label) { lede = sentences(rest[0].text, 320); start = 1; }
  const highlights = [];
  for (const b of rest.slice(start)) {
    if (highlights.length >= 5) break;
    if (b.text.length < 24) continue;
    if (/:$/.test(b.text)) continue;         // a heading whose list is elsewhere
    highlights.push({ label: b.label, text: clip(sentences(b.text, 220), 220) });
  }
  let verified = "";
  if (gates.length) {
    const g = clean(gates.map((b) => (b.label ? b.label + ": " : "") + b.text).join(" "))
      .replace(/^(gates?|gate wall|verified|verification|tests?|test updates|proof|receipts|green)\b[^A-Za-z0-9(]*/i, "")
      .replace(/^[—-]\s*/, "");
    verified = clip(g, 200);
  }
  return { lede, highlights, verified };
}

// ══════════════════════════════════════════════════════════════════════════
// 5. RENDER
// ══════════════════════════════════════════════════════════════════════════
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cdata = (s) => "<![CDATA[" + String(s).replace(/\]\]>/g, "]]&gt;") + "]]>";

function entry(c) {
  const s = summarize(c);
  const g = pickGenre(c);
  const link = linkFor(g.gk) || linkFor(HOME);
  const commitUrl = `${REPO}/commit/${c.sha}`;
  const short = c.sha.slice(0, 7);
  /* THE COLON, NOT A DASH. Several of the reasons below carry their own em
     dash ("one subject, answered — a record that is nothing but its melody"),
     and "▶ Play X — a — b" reads as a run-on. A colon does the same joining
     work and never collides with the sentence it introduces. */
  const play = `▶ Play ${link.label}: ${g.why}`;

  const html = [];
  if (s.lede) html.push(`<p>${esc(s.lede)}</p>`);
  if (s.highlights.length) {
    html.push("<ul>" + s.highlights.map((h) =>
      `<li>${h.label ? `<strong>${esc(h.label)}</strong> — ` : ""}${esc(h.text)}</li>`).join("") + "</ul>");
  }
  if (s.verified) html.push(`<p><em>Verified:</em> ${esc(s.verified)}</p>`);
  html.push(`<p><a href="${esc(link.url)}">${esc(play)}</a></p>`);
  html.push(`<p><small><a href="${esc(commitUrl)}">${short}</a> · <a href="${SITE}/">stellate.app</a> · <a href="${REPO}">source</a></small></p>`);

  const text = [
    s.lede,
    ...s.highlights.map((h) => (h.label ? h.label + " — " : "• ") + h.text),
    s.verified ? "Verified: " + s.verified : "",
    play + "\n" + link.url,
    short + " " + commitUrl,
  ].filter(Boolean).join("\n\n");

  const tags = [...new Set([g.gk, link.place])];
  const summary = s.lede ||
    (s.highlights[0] ? (s.highlights[0].label ? s.highlights[0].label + " — " : "") + s.highlights[0].text
                     : clean(c.subject));
  return { c, s, link, why: g.why, commitUrl, short, html: html.join("\n"), text, tags, summary };
}

function rss(items, meta) {
  // the build date is the newest release's date, never the clock (see IDEMPOTENT)
  const built = items[0] ? new Date(items[0].c.date).toUTCString() : new Date(0).toUTCString();
  const x = [];
  x.push('<?xml version="1.0" encoding="UTF-8"?>');
  x.push('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">');
  x.push("<channel>");
  x.push(`<title>${esc(meta.title)}</title>`);
  x.push(`<link>${SITE}/</link>`);
  x.push(`<description>${esc(meta.desc)}</description>`);
  x.push("<language>en-us</language>");
  x.push(`<managingEditor>${AUTHOR.email} (${esc(AUTHOR.name)})</managingEditor>`);
  x.push(`<webMaster>${AUTHOR.email} (${esc(AUTHOR.name)})</webMaster>`);
  x.push(`<copyright>MIT — © 2026 ${esc(AUTHOR.name)}. Source: ${REPO}</copyright>`);
  x.push(`<lastBuildDate>${built}</lastBuildDate>`);
  if (items[0]) x.push(`<pubDate>${new Date(items[0].c.date).toUTCString()}</pubDate>`);
  x.push("<generator>tools/build/gen-feed.js (stellate) — release notes read out of the git log</generator>");
  x.push("<docs>https://www.rssboard.org/rss-specification</docs>");
  x.push("<ttl>1440</ttl>");
  x.push("<category>Music</category><category>Generative music</category><category>Open source</category>");
  x.push(`<atom:link rel="self" href="${esc(meta.self)}" type="application/rss+xml"/>`);
  if (meta.next) x.push(`<atom:link rel="next" href="${esc(meta.next)}" type="application/rss+xml"/>`);
  x.push(`<atom:link rel="related" href="${REPO}" type="text/html" title="Source on GitHub"/>`);
  for (const it of items) {
    x.push("<item>");
    x.push(`<title>${esc(clean(it.c.subject))}</title>`);
    x.push(`<link>${esc(it.link.url)}</link>`);
    x.push(`<guid isPermaLink="false">${it.c.sha}</guid>`);
    x.push(`<pubDate>${new Date(it.c.date).toUTCString()}</pubDate>`);
    x.push(`<dc:creator>${esc(AUTHOR.name)}</dc:creator>`);
    x.push(`<author>${AUTHOR.email} (${esc(AUTHOR.name)})</author>`);
    for (const t of it.tags) x.push(`<category>${esc(t)}</category>`);
    x.push(`<description>${cdata(it.summary)}</description>`);
    x.push(`<content:encoded>${cdata(it.html)}</content:encoded>`);
    x.push(`<comments>${esc(it.commitUrl)}</comments>`);
    x.push("</item>");
  }
  x.push("</channel>", "</rss>", "");
  return x.join("\n");
}

function jsonfeed(items, meta) {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: meta.title,
    home_page_url: SITE + "/",
    feed_url: meta.self,
    description: meta.desc,
    language: "en-US",
    authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
    ...(meta.next ? { next_url: meta.next } : {}),
    _stellate: {
      about: "Release notes read out of the git log by tools/build/gen-feed.js at deploy time. Every item links to a record the box will play.",
      link_grammar: SITE + "/?at=<place>&y=<year>&s=<seed>&t=<tab> — place and year name a row in the catalogue; the seed is stable per row, so the same URL is always the same music. The app reads the same grammar after a '#', which is the form it writes back and the form people share.",
      archive: SITE + "/feed-archive.json",
      repository: REPO,
      license: "MIT",
    },
    items: items.map((it) => ({
      id: it.c.sha,
      url: it.link.url,
      external_url: it.commitUrl,
      title: clean(it.c.subject),
      summary: it.summary,
      content_html: it.html,
      content_text: it.text,
      date_published: new Date(it.c.date).toISOString(),
      authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
      tags: it.tags,
      _play: { genre: it.link.gk, record: it.link.label, place: it.link.place,
               year: it.link.year, seed: it.link.seed, why: it.why },
    })),
  }, null, 1) + "\n";
}

// ══════════════════════════════════════════════════════════════════════════
// 6. THE SELF-CHECK — no dependencies, so the feed validates itself
// ══════════════════════════════════════════════════════════════════════════
function checkXml(xml, label) {
  const errs = [];
  if (!/^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(xml)) errs.push("missing XML declaration");
  const masked = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "CDATA");
  const stack = [];
  const tag = /<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tag.exec(masked))) {
    if (m[2] === "?xml") continue;
    if (m[4] === "/" || m[3].endsWith("/")) continue;
    if (m[1] === "/") { const t = stack.pop(); if (t !== m[2]) errs.push(`unbalanced </${m[2]}> (open was <${t}>)`); }
    else stack.push(m[2]);
  }
  if (stack.length) errs.push("unclosed: " + stack.join(","));
  const bad = masked.replace(/<[^>]*>/g, "").match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi);
  if (bad) errs.push(`${bad.length} unescaped & in text`);
  const n = (xml.match(/<item>/g) || []).length;
  if (n !== (xml.match(/<guid /g) || []).length) errs.push("item/guid mismatch");
  if (!/<atom:link rel="self"/.test(xml)) errs.push("missing atom:link rel=self");
  // every <link> in an item must be a fragment link into the box
  for (const u of xml.match(/<link>[^<]*<\/link>/g) || []) {
    /* A RECORD LINK IS `?at=` SINCE 2026-09-08 AND `#at=` IS STILL ONE. The
       published form is the query (a crawler cannot read a fragment — see
       `linkFor`); the fragment is what the app writes and what people share,
       and both open the same record, so both pass. TRANSLATED, NOT LOOSENED:
       the check is still "every item points at a named record", and a link
       that is neither shape still fails. */
    if (!/<link>https:\/\/stellate\.app\/([?#]at=|<)/.test(u)) errs.push("an item link is not a record: " + u);
  }
  return { label, items: n, errs };
}
function checkJson(txt, label) {
  const errs = [];
  let j;
  try { j = JSON.parse(txt); } catch (e) { return { label, items: 0, errs: ["invalid JSON: " + e.message] }; }
  if (j.version !== "https://jsonfeed.org/version/1.1") errs.push("wrong JSON Feed version");
  for (const k of ["title", "home_page_url", "feed_url", "items"]) if (!j[k]) errs.push("missing " + k);
  for (const it of j.items || []) {
    if (!it.id) errs.push("item without id");
    if (!it.url || !/^https:\/\/stellate\.app\/[?#]at=/.test(it.url)) errs.push(`item ${String(it.id).slice(0, 7)} has no record link`);
    if (!it.date_published || isNaN(Date.parse(it.date_published))) errs.push(`item ${String(it.id).slice(0, 7)} has a bad date`);
  }
  return { label, items: (j.items || []).length, errs };
}

// ══════════════════════════════════════════════════════════════════════════
// main
// ══════════════════════════════════════════════════════════════════════════
function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(n);
  const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  const dry = flag("--dry");
  const limit = parseInt(val("--limit", String(LIVE_MAX)), 10) || LIVE_MAX;
  const show = parseInt(val("--show", "0"), 10) || 0;

  const commits = readCommits();
  const releases = commits
    .filter((c) => !CHORE.some((re) => re.test(c.subject)))
    .filter((c) => !(/^(docs?|readme)\b/i.test(c.subject) && c.files.length && c.files.every((f) => /\.md$/i.test(f))))
    .filter((c) => !(!c.body.replace(/^(co-authored-by|claude-session|https:).*$/gim, "").trim() && PLUMBING.test(c.subject)));
  if (!releases.length) { console.error("gen-feed: the log holds no releases — nothing to write."); process.exit(1); }

  const items = releases.map(entry);
  const live = items.slice(0, limit);

  if (show) {
    for (const it of items.slice(0, show)) {
      console.log("\n" + "═".repeat(78));
      console.log(new Date(it.c.date).toISOString().slice(0, 10) + "  " + clean(it.c.subject));
      console.log("─".repeat(78));
      console.log(it.text);
    }
    console.log(`\n(${items.length} releases from ${commits.length} commits; ${commits.length - releases.length} skipped as chores)`);
    return;
  }

  const liveMeta = {
    self: `${SITE}/feed.xml`, next: `${SITE}/feed-archive.xml`,
    title: "Stellate — release notes",
    desc: `What shipped in Stellate, the music box by ${AUTHOR.name}. Every entry opens a record the box will play. Source: ${REPO}`,
  };
  const archMeta = {
    self: `${SITE}/feed-archive.xml`, next: null,
    title: "Stellate — the complete release archive",
    desc: `Every release note in Stellate's history, back to ${new Date(items[items.length - 1].c.date).toISOString().slice(0, 10)}. The live feed (${SITE}/feed.xml) carries the most recent ${limit}.`,
  };
  const files = [
    ["feed.xml", rss(live, liveMeta)],
    ["feed.json", jsonfeed(live, { ...liveMeta, self: `${SITE}/feed.json`, next: `${SITE}/feed-archive.json` })],
    ["feed-archive.xml", rss(items, archMeta)],
    ["feed-archive.json", jsonfeed(items, { ...archMeta, self: `${SITE}/feed-archive.json` })],
  ];

  const checks = [
    checkXml(files[0][1], "feed.xml"), checkJson(files[1][1], "feed.json"),
    checkXml(files[2][1], "feed-archive.xml"), checkJson(files[3][1], "feed-archive.json"),
  ];
  const bad = checks.filter((k) => k.errs.length);
  if (bad.length) {
    for (const k of bad) console.error(`gen-feed: ${k.label} is not valid — ${k.errs.slice(0, 6).join("; ")}`);
    process.exit(1);
  }

  let bytes = 0;
  for (const [name, body] of files) {
    bytes += Buffer.byteLength(body);
    if (!dry) fs.writeFileSync(path.join(OUT, name), body);
  }
  const rec = new Set(items.map((it) => it.link.gk)).size;
  console.log(`${dry ? "would write" : "wrote"} nukernel/{feed,feed-archive}.{xml,json} — ` +
    `${live.length} live + ${items.length} archived releases from ${commits.length} commits, ` +
    `${rec} distinct records linked, ${LINKABLE.length}/${Object.keys(GENRES).length} rows addressable, ` +
    files.map(([n, b]) => `${n} ${Buffer.byteLength(b)}B`).join(" · "));
}

module.exports = { linkFor, seedOf, addressable, placeYear, LINKABLE, UNLINKABLE,
                   GENRES, SITE, TAB, LABEL_RE, HOME };
if (require.main === module) main();
