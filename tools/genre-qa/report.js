#!/usr/bin/env node
/* tools/genre-qa/report.js — THE CHECKS, AS QUERIES, WORST FIRST.
 *
 *   node tools/genre-qa/build.js       (first — writes scratch/genres.db)
 *   node tools/genre-qa/report.js      -> scratch/genre-qa/REPORT.md
 *   node tools/genre-qa/report.js --top 60
 *   node tools/genre-qa/report.js --no-kiwix
 *
 * SEVEN COLUMNS, one sentence each, and every one of them is a QUERY against
 * the mirror rather than a second walk of genres.js:
 *
 *   named           the key is a genre term — no band, no person, no record —
 *                   and the label is 'Place Year' with the place on the atlas
 *   linked          the wiki row resolves, and the article's own stated decade
 *                   agrees with the year we put on the record
 *   earliest        the record is not later than the article says, and not
 *                   older than a genre it declares as a parent
 *   closest         the declared parents are the nearest older neighbours by a
 *                   feature vector; a near older neighbour that is not a parent
 *                   is a missing edge, a far parent is a wrong one
 *   structure       the composed section roster against the corpus's own form
 *                   estimate
 *   instrumentation the native / sampled / found share of the seated chairs,
 *                   and whether a machine genre is being played by people
 *   rhythm          swing, cycle, hold and tempo against the corpus
 *
 * THE SCORE IS 0..1 PER COLUMN and the rank is the SUM, so a row that fails
 * four columns badly outranks a row that fails one. A column that cannot be
 * measured for a row scores `null` and is left out of the sum and out of the
 * denominator — an unmeasured row must never sort as a clean one.
 *
 * NOT A GATE. Nothing here is registered in test/all.js: this is analysis, it
 * has opinions, and an opinion in a gate is how a gate stops being trusted.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const DB = path.join(ROOT, "scratch", "genres.db");
const OUT = path.join(ROOT, "scratch", "genre-qa");
const ARGV = process.argv.slice(2);
const has = (f) => ARGV.includes(f);
const opt = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 ? ARGV[i + 1] : d; };
const TOP = +opt("--top", 40);

function Q(sql) {
  const r = spawnSync("python3", [path.join(__dirname, "q.py"), "--db", DB, "--sql", sql],
                      { maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    console.error(String(r.stderr || "").slice(0, 800));
    throw new Error("query failed");
  }
  return JSON.parse(r.stdout.toString("utf8") || "[]");
}
const tableExists = (t) =>
  Q("SELECT name FROM sqlite_master WHERE type='table' AND name='" + t + "'").length > 0;

/* THE SIX INTERNAL ROLES AND THE BLANK STATE are not genres and are held to no
   column but `instrumentation`. wiki.js says it in as many words — "a role has
   a job, not a history" — and holding `pad` to a Wikipedia article would put
   seven guaranteed failures at the top of a list about the other 410. */
const ROLES = new Set(["simple", "solo", "vocal", "backing", "riff", "pad", "silence"]);

/* ------------------------------------------------------------------ kiwix */
const KHOST = process.env.KIWIX_HOST || "localhost";
const KPORT = Number(process.env.KIWIX_PORT || 8888);
const BOOK = "wikipedia_en_all_maxi_2026-02";
const CACHE = path.join(OUT, "decades.json");

function kget(p) {
  return new Promise((res) => {
    const req = http.get({ host: KHOST, port: KPORT, path: p }, (r) => {
      let b = ""; r.setEncoding("utf8");
      r.on("data", (d) => (b += d));
      r.on("end", () => res({ code: r.statusCode, loc: r.headers.location, body: b }));
    });
    req.on("error", () => res(null));
    req.setTimeout(15000, () => { req.destroy(); res(null); });
  });
}
const plain = (s) => s
  .replace(/<div[^>]*class="[^"]*hatnote[^"]*"[\s\S]*?<\/div>/gi, " ")
  .replace(/<(style|script|table)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/\[\s*\d+\s*\]/g, " ").replace(/\s+/g, " ").trim();

function firstPara(body) {
  let s = body;
  const i = s.indexOf("<section"); if (i > 0) s = s.slice(i);
  for (const p of (s.match(/<p\b[\s\S]*?<\/p>/gi) || [])) {
    const t = plain(p);
    if (t.length >= 140 && !/^This article is issued from Wikipedia/i.test(t)) return t;
  }
  return null;
}

/* THE DECADE THE ARTICLE ITSELF CLAIMS. A genre article's lead dates the music
   in its first two sentences — "originated in the late 1970s", "developed in
   Chicago in the mid-1980s". THE EARLIEST YEAR IN THE PARAGRAPH IS NOT THAT
   DATE and the first build of this measure proved it: on an ARTIST article the
   earliest year is the person's birth (`softfolk` read 1948 for a 1970 record
   because James Taylor was born in 1948), and on a `work` article it is the
   excavation (`urlyre` read 1922 for a 2500 BC lyre, because Woolley dug in
   1922). So the year is taken from an ORIGIN CLAUSE where the paragraph has
   one — a date within sixty characters after `originated`, `emerged`,
   `developed`, `began`, `dates from` and their kin — and the method rides
   along, so the column can decline to judge a date it only guessed. */
const ORIGIN = /\b(originat\w*|emerg\w*|develop\w*|began|begun|arose|aros\w*|first appeared|dates? from|dating from|dates? to|created|invented|introduced|founded|first record\w*|first perform\w*|flourish\w*)\b/gi;
function yearsIn(s) {
  const out = [];
  for (const m of s.matchAll(/\b(1[0-9]{3}|20[0-4][0-9])s?\b/g)) out.push(+m[1]);
  for (const m of s.matchAll(/\b(\d{1,2})(?:st|nd|rd|th) century\b/gi))
    out.push((+m[1] - 1) * 100 + 50);
  return out;
}
function decadeOf(para) {
  if (!para) return null;
  const near = [];
  ORIGIN.lastIndex = 0;
  let m;
  while ((m = ORIGIN.exec(para))) near.push(...yearsIn(para.slice(m.index, m.index + 70)));
  if (near.length) return { year: Math.min(...near), how: "origin clause" };
  const all = yearsIn(para);
  return all.length ? { year: Math.min(...all), how: "earliest year in the lead" } : null;
}

async function decades(rows) {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch (e) { cache = {}; }
  if (has("--no-kiwix")) return { cache, up: false, why: "--no-kiwix" };
  const probe = await kget("/content/" + BOOK + "/Music");
  if (!probe || probe.code >= 400)
    return { cache, up: false, why: "kiwix-serve is not answering on " + KHOST + ":" + KPORT };
  let n = 0;
  for (const g of rows) {
    if (!g.wiki_title || cache[g.gk] !== undefined) continue;
    let title = g.wiki_title, body = null;
    for (let hop = 0; hop < 6; hop++) {
      const r = await kget("/content/" + BOOK + "/" +
        encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",")
          .replace(/%28/g, "(").replace(/%29/g, ")").replace(/%21/g, "!"));
      if (!r) break;
      if (r.code === 302 && r.loc) { title = decodeURIComponent(r.loc.split("/").pop()); continue; }
      if (r.code !== 200) break;
      const meta = /<meta[^>]+http-equiv="refresh"[^>]+URL='\.\/([^']+)'/i.exec(r.body);
      if (meta) { title = decodeURIComponent(meta[1].split("#")[0]); continue; }
      body = r.body; break;
    }
    const para = body ? firstPara(body) : null;
    const d = decadeOf(para);
    cache[g.gk] = { decade: d ? d.year : null, how: d ? d.how : null,
                    para: para ? para.slice(0, 320) : null };
    n++;
    if (n % 40 === 0) process.stderr.write("  kiwix " + n + "\n");
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  return { cache, up: true, fetched: n };
}

/* ------------------------------------------------------ the feature vector */
const MAJORISH = new Set(["major", "ionian", "lydian", "mixolydian", "mixo"]);
function vecOf(g) {
  const maj = MAJORISH.has(String(g.doc_scale || g.doc_mode || "").toLowerCase()) ? 1 : 0;
  const h = { modal: 0, cycle: 1, emergent: 2 }[g.harmony] ?? 1;
  const p = { song: 0, dance: 1, arc: 2 }[g.plan] ?? 0;
  return {
    bpm: (g.bpm || 100) / 200,
    swing: g.swing || 0,
    maj,
    kit: g.kit_density || 0,
    h0: h === 0 ? 1 : 0, h1: h === 1 ? 1 : 0, h2: h === 2 ? 1 : 0,
    p0: p === 0 ? 1 : 0, p1: p === 1 ? 1 : 0, p2: p === 2 ? 1 : 0,
    nobass: g.nobass ? 1 : 0,
    instrumental: g.instrumental ? 1 : 0,
    family: g.family || "",
  };
}
const W = { bpm: 1.4, swing: 1.0, maj: 0.8, kit: 1.2, h0: .7, h1: .7, h2: .7,
            p0: .5, p1: .5, p2: .5, nobass: .4, instrumental: .4 };
function dist(a, b) {
  let s = (a.family && a.family === b.family) ? 0 : 1.2 * 1.2;
  for (const k of Object.keys(W)) { const d = (a[k] - b[k]) * W[k]; s += d * d; }
  return Math.sqrt(s);
}

/* ----------------------------------------------------------------- checks */
const clamp = (x) => Math.max(0, Math.min(1, x));

function main() {
  if (!fs.existsSync(DB)) { console.error("no " + DB + " — run build.js first"); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });

  const G = Q("SELECT * FROM genres");
  const byKey = Object.fromEntries(G.map((g) => [g.gk, g]));
  const CS = Object.fromEntries(Q("SELECT * FROM corpus_stats").map((r) => [r.gk, r]));
  const PARENTS = {};
  for (const r of Q("SELECT gk, parent, weight, kind FROM parents"))
    (PARENTS[r.gk] = PARENTS[r.gk] || []).push(r);
  const CHILDREN = {};
  for (const r of Q("SELECT gk, parent FROM parents WHERE kind='parent'"))
    (CHILDREN[r.parent] = CHILDREN[r.parent] || []).push(r.gk);

  const hasChord = tableExists("genre_xwalk");
  const XW = hasChord ? Q("SELECT * FROM genre_xwalk") : [];

  return { G, byKey, CS, PARENTS, CHILDREN, hasChord, XW };
}

/* --------------------------------------------------------------- the run */
(async function run() {
  const { G, byKey, CS, PARENTS, CHILDREN, hasChord, XW } = main();
  const D = await decades(G);

  /* ---- vectors and the nearest-older table ---- */
  const V = Object.fromEntries(G.map((g) => [g.gk, vecOf(g)]));
  const NEAR = {};
  for (const g of G) {
    if (g.year == null) { NEAR[g.gk] = []; continue; }
    NEAR[g.gk] = G.filter((o) => o.gk !== g.gk && o.year != null && o.year <= g.year && !ROLES.has(o.gk))
      .map((o) => ({ gk: o.gk, d: dist(V[g.gk], V[o.gk]), year: o.year }))
      .sort((a, b) => a.d - b.d);
  }

  /* ---- the synthesis-implied rows: a machine genre played by people ----
     Not a hand list of keys: a row IMPLIES SYNTHESIS when it declares a
     signature synth, OR its drum machine is one of the four classic boxes, OR
     its own comment/words name a chip, a machine or a sequencer, OR its family
     is `club` and it is later than 1975. The chiptune catch is the first of
     these three failing at once. */
  const MACHINE_WORD = /\b(chip|SID|8-bit|eight-bit|square wave|synthes|synthesiser|synthesizer|sequencer|drum machine|oscillator|arpeggiator|TR-?[0-9]{3}|303|808|909|Moog|DX7|FM |analog(ue)? synth|monosynth|polysynth)\b/i;
  const impliesSynth = (g) =>
    !!(g.has_synth || ["tr808", "tr909", "tr606", "cr78"].includes(g.drumkit) ||
       MACHINE_WORD.test(g.comment || "") || MACHINE_WORD.test(g.words || "") ||
       (g.family === "club" && (g.year || 0) >= 1975));

  const checks = [];      // rows for the checks table
  const rows = [];        // per-genre report rows

  for (const g of G) {
    const role = ROLES.has(g.gk);
    const cs = CS[g.gk] || {};
    const kv = D.cache[g.gk] || {};
    /* THE DATE IS ONLY USABLE WHERE IT IS A DATE. An origin clause is a claim
       about the music; the earliest year on an ACT's page is a birthday and on
       a WORK's page an excavation, and below 500 CE every article's numbers
       are about the digging rather than the playing.

       AN ORIGIN CLAUSE OR NOTHING. Falling back to the earliest year anywhere
       in the lead was tried and convicted 46 more rows of being late because a
       genre article's lead names its ROOTS in its first sentence — `blues`
       read 1860 against a Chicago 1952 label, which is the article describing
       the tradition this row's SOUND deliberately post-dates. */
    const dateUsable = kv.decade != null && kv.how === "origin clause" &&
      (g.year == null || g.year >= 500);
    const dec = dateUsable ? kv.decade : null;
    const par = (PARENTS[g.gk] || []).filter((p) => p.kind === "parent");
    const wants = (PARENTS[g.gk] || []).filter((p) => p.kind === "want");
    const c = {};

    /* ---------- named ---------- */
    if (role) c.named = { s: null, v: "role", d: "an internal role, not a genre" };
    else {
      let s = 1; const w = [];
      const lab = /^(.+?) (\d{1,5})( BC)?$/.exec(g.label || "");
      if (!lab) { s -= 0.6; w.push("the label is not 'Place Year'"); }
      else {
        const yr = (lab[3] ? -1 : 1) * +lab[2];
        if (g.place == null) { s -= 0.5; w.push("the label's place is not on the atlas"); }
        else if (lab[1] !== g.place || yr !== g.year) {
          s -= 0.4; w.push("the label says " + lab[1] + " " + lab[2] + " and the atlas says " + g.place + " " + g.year_word);
        }
      }
      if (!/^[a-z][a-z0-9]*$/.test(g.gk)) { s -= 0.4; w.push("the key is not a plain lower-case word"); }
      /* THE KEY CANNOT BE READ, so this is the proxy and it is weighted like
         one. After the great rename (2026-09-01) every key IS a genre term;
         what an `artist`/`work` article says is that the music this row plays
         has no article of its own and the row was written from ONE act or ONE
         piece. That is a naming RISK, not a naming error — the same fact is
         scored properly one column over, in `linked`. */
      if (g.wiki_kind === "artist") { s -= 0.25; w.push("the only article for this music is an ACT (" + g.wiki_title + ") — the row is written from one band rather than from a named music"); }
      else if (g.wiki_kind === "work") { s -= 0.2; w.push("the only article for this music is a WORK (" + g.wiki_title + ") — one piece standing in for a genre"); }
      c.named = { s: clamp(s), v: w.length ? "check" : "ok", d: w.join("; ") || "genre term, label round-trips through the atlas" };
    }

    /* ---------- linked ---------- */
    if (role) c.linked = { s: null, v: "role", d: "a role has a job, not a history" };
    else {
      let s = 1; const w = [];
      if (!g.wiki_title) {
        if (g.wiki_miss_why) { s = 0.6; w.push("no article, with a written reason (a documented miss)"); }
        else { s = 0; w.push("NO article and NO reason — neither a link nor a miss"); }
      } else {
        if (g.wiki_kind === "broader") { s -= 0.3; w.push("the article is wider than the row (" + g.wiki_title + ")"); }
        if (g.wiki_kind === "artist" || g.wiki_kind === "work") { s -= 0.35; w.push("the article is an " + g.wiki_kind); }
        if (D.up) {
          /* NO DATE IS NOT A FAULT. 103 leads name no origin clause; docking
             them a tenth put a quarter of the catalogue on the flagged list
             for something the ARTICLE did not say. It is recorded, not
             scored. */
          if (dec != null && g.year != null && Math.abs(g.year - dec) > 25) {
            s -= 0.35;
            w.push("the article's " + kv.how + " dates it " + dec + " and the row says " + g.year_word +
                   " (" + (g.year > dec ? "we are " + (g.year - dec) + " years late" : "we are " + (dec - g.year) + " years early") + ")");
          }
        }
      }
      const nodate = g.wiki_title && D.up && dec == null ? " (the lead names no origin date)" : "";
      c.linked = { s: clamp(s), v: w.length ? "check" : "ok",
                   d: (w.join("; ") || (g.wiki_title + (dec != null ? " · its origin clause dates it " + dec : ""))) + (w.length ? nodate : "") };
    }

    /* ---------- earliest ---------- */
    if (role || g.year == null) c.earliest = { s: null, v: "role", d: "no year on this row" };
    else {
      let s = 1; const w = [];
      for (const p of par) {
        const P = byKey[p.parent];
        if (!P) { s -= 0.3; w.push("parent `" + p.parent + "` is not a row in this table"); continue; }
        if (P.year != null && P.year > g.year)
          { s -= 0.35; w.push("parent `" + p.parent + "` (" + P.year_word + ") is YOUNGER than this row (" + g.year_word + ")"); }
      }
      if (D.up && dec != null && g.year - dec > 25)
        { s -= 0.3; w.push("later than the article's " + kv.how + " (" + dec + ") by " + (g.year - dec) + " years — a genre placed at a famous record rather than at its first"); }
      if (D.up && dec != null && dec - g.year > 40)
        { s -= 0.2; w.push("earlier than the article's " + kv.how + " (" + dec + ") by " + (dec - g.year) + " years"); }
      c.earliest = { s: clamp(s), v: w.length ? "check" : "ok",
                     d: w.join("; ") || "no parent predates it and the article agrees" };
    }

    /* ---------- closest ---------- */
    if (role || g.year == null || !NEAR[g.gk].length)
      c.closest = { s: null, v: "role", d: "nothing older to compare against" };
    else {
      /* RANK AS A PERCENTILE, not as a count. A parent 60th of 400 older rows
         is in the nearest sixth and the first build called that "a long way
         from this sound" for 269 rows — a measurement that fires on two thirds
         of the catalogue is measuring the threshold, not the catalogue. A
         parent is FAR when it sits in the further half of what came before,
         and BADLY far in the further quarter. */
      const near = NEAR[g.gk];
      const rank = Object.fromEntries(near.map((n, i) => [n.gk, i]));
      const N = near.length;
      let s = 1; const w = [];
      /* A ROOT ROW HONESTLY HAS NO PARENTS — 47 of these are the world and
         early-music anchors that ARE the root — so this is a quarter, not a
         half: it says "check the lineage", not "the lineage is wrong". */
      if (!par.length) { s -= 0.25; w.push("declares NO parents (a root row, or a missing lineage); the nearest older row is `" + near[0].gk + "` (" + byKey[near[0].gk].year_word + ")"); }
      for (const p of par) {
        const r = rank[p.parent];
        if (r === undefined) {
          const P = byKey[p.parent];
          if (P && P.year != null && P.year > g.year) continue;    // already said by `earliest`
          s -= 0.2; w.push("parent `" + p.parent + "` is not comparable");
          continue;
        }
        const q = N > 1 ? r / (N - 1) : 0;
        if (q > 0.75) { s -= 0.3; w.push("parent `" + p.parent + "` (weight " + p.weight + ") is in the FURTHEST quarter of the " + N + " rows older than this one (rank " + (r + 1) + ")"); }
        else if (q > 0.5) { s -= 0.15; w.push("parent `" + p.parent + "` (weight " + p.weight + ") sits in the further half of the " + N + " older rows (rank " + (r + 1) + ")"); }
      }
      const parSet = new Set(par.map((p) => p.parent));
      const wantSet = new Set(wants.map((p) => p.parent));
      const strangers = near.slice(0, 3).filter((n) => !parSet.has(n.gk) && !wantSet.has(n.gk));
      const bestParIdx = Math.min(...par.map((p) => rank[p.parent] ?? Infinity), Infinity);
      const bestParD = par.length && isFinite(bestParIdx) ? near[bestParIdx].d : Infinity;
      /* only where there IS a declared parent to be nearer than — the
         parentless rows are already convicted one branch up, and saying it
         twice makes 47 rows read as two faults */
      if (par.length && strangers.length && strangers[0].d < 0.6 * bestParD) {
        s -= 0.3;
        w.push("`" + strangers[0].gk + "` (" + byKey[strangers[0].gk].year_word +
               ") is much nearer than any declared parent" +
               (isFinite(bestParIdx) ? " (the nearest, `" + near[bestParIdx].gk + "`, ranks " + (bestParIdx + 1) + ")" : "") +
               " and is neither a parent nor a want");
      }
      c.closest = { s: clamp(s), v: w.length ? "check" : "ok",
                    d: w.join("; ") || "the declared parents ARE the near older neighbours" };
    }

    /* ---------- structure ---------- */
    if (role) c.structure = { s: null, v: "role", d: "an internal role" };
    else if (!cs.form_bars || cs.n < 12) c.structure = { s: null, v: "no corpus",
      d: cs.n ? "no usable form estimate from " + cs.n + " file(s)" : "no corpus files matched" };
    else {
      const bars = (g.doc_section_bars || "").split(" ").filter(Boolean).map(Number);
      const modal = bars.length ? bars.slice().sort((a, b) => bars.filter((x) => x === a).length - bars.filter((x) => x === b).length).pop() : null;
      let s = 1; const w = [];
      if (modal && cs.form_bars) {
        const ratio = cs.form_bars / modal;
        if (ratio >= 2 || ratio <= 0.5) {
          s -= 0.4;
          w.push("the corpus repeats every " + cs.form_bars + " bars and the composed sections are " + modal + " bars");
        }
      }
      if (g.doc_sections <= 2) { s -= 0.2; w.push("only " + g.doc_sections + " sections are composed"); }
      c.structure = { s: clamp(s), v: w.length ? "check" : "ok",
                      d: w.join("; ") || ("sections " + g.doc_section_bars + " against a " + cs.form_bars + "-bar corpus form") };
    }

    /* ---------- instrumentation ---------- */
    {
      const tot = g.doc_chairs || 0;
      let s = 1; const w = [];
      const share = tot ? g.n_native / tot : 0;
      if (g.silent) { s = null; }
      else {
        if (!tot) { s = 0; w.push("NO chairs are seated"); }
        else {
          const machine = impliesSynth(g);
          const organicDsp = (g.dsps || "").split(" ")
            .filter((x) => /voice_lead|voice_choir|tract_voice|choir|stk_|gtr_amp|erhu|mallet|bell|organ/.test(x));
          /* A ROW THAT SAYS `organic: true` IS ANSWERING THIS CHECK, not
             failing it (2026-09-02, the catalogue round). Twelve rows seat
             zero native chairs and every one of them was read: there is no
             Faust model of a pipe organ, a harpsichord, a baroque string band,
             a guqin, a shō or a tape splice, and there should not be. The
             recording IS the instrument on those rows, they now declare it in
             genres.js (and say it in `rules.js`), and scoring an honest
             recording as a hole was this column telling twelve rows to become
             something they are not. It is a DECLARED FACT and not a mute: the
             sentence is still printed, so a reader sees what the row seats. */
          if (g.n_native === 0 && g.organic) {
            w.push("every seat is a recording, and the row DECLARES it " +
                   "(`organic: true`) — there is no model of these instruments " +
                   "in the fleet and the recording is the instrument");
          } else if (g.n_native === 0) {
            s -= machine ? 0.5 : 0.3;
            w.push("ZERO native chairs — every seat is a recording" +
                   (machine ? ", on a row whose own sound is a machine" : "; the engine may model some of these better than the sampler plays them"));
          } else if (share < 0.34) { s -= 0.25; w.push("only " + g.n_native + " of " + tot + " chairs are native"); }
          if (g.n_unknown) { s -= 0.3; w.push(g.n_unknown + " chair(s) route to NOTHING"); }
          if (machine && g.n_organic > 0) {
            s -= 0.35;
            w.push("a machine genre with " + g.n_organic + " ORGANIC chair(s)" +
                   (organicDsp.length ? " — modelled throats and bodies (" + organicDsp.join(", ") + ")" : "") +
                   (g.n_sampled ? (organicDsp.length ? " plus " : " — ") + g.n_sampled + " sampled recording(s)" : "") +
                   ": this is what makes it sound played rather than generated");
          }
          if (machine && g.n_sampled > g.n_native) {
            s -= 0.2; w.push("a machine genre seating more samples (" + g.n_sampled + ") than models (" + g.n_native + ")");
          }
        }
      }
      c.instrumentation = s == null ? { s: null, v: "silent", d: "the blank state seats nobody" }
        : { s: clamp(s), v: w.length ? "check" : "ok",
            d: w.join("; ") || (g.n_native + "/" + tot + " native" + (g.n_found ? ", " + g.n_found + " found" : "") + " · " + (g.dsps || "—")) };
    }

    /* ---------- rhythm / harmony / motif ---------- */
    if (role) c.rhythm = { s: null, v: "role", d: "an internal role" };
    else if (!cs.n) c.rhythm = { s: null, v: "no corpus",
      d: cs.refused_why ? "no corpus files: the word is " + cs.refused_why : "no corpus files matched" };
    else if (cs.n < 12) c.rhythm = { s: null, v: "thin corpus",
      d: "only " + cs.n + " corpus file(s) matched (" + cs.strategy + ") — too few to disagree with" };
    else {
      const dis = [];
      /* THE MELODIC MEASURES NEED A POPULATION. `hold`, `sync` and the
         interval mean come off corpus-db's EXTRACTED melody line, gated at
         mel_conf 0.55; a genre with eight usable lines has a number, not a
         distribution, and the first build read softrock's 90th-percentile
         hold at 0.229 sixteenths off exactly that. */
      const melodic = cs.melodic_n >= 8 && cs.hold_n >= 200;
      if (cs.bpm_med != null && g.bpm) {
        const r = g.bpm / cs.bpm_med;
        // NOTATION TEMPO IS A CONVENTION (mine-midi.js): a clean 2x or 1/2x is
        // a metric-level disagreement, not a tempo one, and is scored softer.
        const half = Math.abs(r - 0.5) < 0.12 || Math.abs(r - 2) < 0.25;
        if (!half && (r > 1.35 || r < 0.74))
          dis.push([Math.abs(Math.log2(r)) * 0.9, "the row says " + g.bpm + " bpm and the corpus median over " +
                    cs.bpm_n + " files is " + cs.bpm_med]);
        else if (half)
          dis.push([0.25, "the row's " + g.bpm + " bpm is a metric level away from the corpus's " + cs.bpm_med + " (notation, probably, not tempo)"]);
      }
      if (cs.swing_med != null) {
        const ours = g.swing || 0;
        if (Math.abs(ours - cs.swing_med) > 0.28)
          dis.push([Math.abs(ours - cs.swing_med), "the row swings " + ours + " and the corpus median is " + cs.swing_med]);
      }
      if (cs.cycle_vote && g.prog_len) {
        if (cs.cycle_vote !== g.prog_len && !(g.prog_len % cs.cycle_vote === 0))
          dis.push([0.45, "the row's chord cycle is " + g.prog_len + " long and the corpus votes " + cs.cycle_vote]);
      } else if (cs.cycle_vote && !g.prog_len && g.harmony === "cycle" && (g.roots || "").split(" ").filter(Boolean).length) {
        const rl = (g.roots || "").split(" ").filter(Boolean).length;
        if (rl !== cs.cycle_vote && rl % cs.cycle_vote !== 0)
          dis.push([0.35, "the row's " + rl + " roots against a " + cs.cycle_vote + "-bar corpus cycle"]);
      }
      if (melodic && cs.hold_p90 != null && cs.hold_p90 >= 1 && g.max_hold != null) {
        const r = g.max_hold / cs.hold_p90;
        if (r > 2.5 || r < 0.4)
          dis.push([Math.abs(Math.log2(r)) * 0.6, "maxHold " + g.max_hold + " sixteenths against a corpus 90th-percentile hold of " +
                    cs.hold_p90 + " over " + cs.melodic_n + " melody lines"]);
      }
      if (melodic && cs.hold_p50 != null && g.artic) {
        if (g.artic === "staccato" && cs.hold_p50 > 3)
          dis.push([0.4, "the row is staccato and the corpus holds " + cs.hold_p50 + " sixteenths at the median"]);
        if (g.artic === "legato" && cs.hold_p50 < 1.2)
          dis.push([0.4, "the row is legato and the corpus holds only " + cs.hold_p50 + " sixteenths at the median"]);
      }
      if (cs.drum_density_med != null) {
        if (!g.kit_lanes && cs.drum_density_med > 1.5)
          dis.push([0.5, "the row seats NO kit and the corpus files average " + cs.drum_density_med + " drum hits a beat"]);
        if (g.kit_lanes && cs.drum_density_med === 0 && cs.n >= 20)
          dis.push([0.5, "the row seats a kit and not one of " + cs.n + " corpus files has a percussion channel"]);
      }
      if (cs.modes) {
        const m = JSON.parse(cs.modes);
        const tot = (m.major || 0) + (m.minor || 0);
        const majShare = tot ? (m.major || 0) / tot : null;
        const ourMaj = MAJORISH.has(String(g.doc_scale || "").toLowerCase());
        if (majShare != null && tot >= 20) {
          if (ourMaj && majShare < 0.3) dis.push([0.35, "the row composes in " + g.doc_scale + " and " + Math.round((1 - majShare) * 100) + "% of the corpus is minor"]);
          if (!ourMaj && majShare > 0.72) dis.push([0.35, "the row composes in " + g.doc_scale + " and " + Math.round(majShare * 100) + "% of the corpus is major"]);
        }
      }
      dis.sort((a, b) => b[0] - a[0]);
      const s = clamp(1 - dis.reduce((a, d) => a + Math.min(0.4, d[0] * 0.35), 0));
      const prov = " [" + cs.n + " files, " + cs.strategy + "]";
      c.rhythm = { s, v: dis.length ? "check" : "ok",
                   d: (dis.length ? dis[0][1] + (dis.length > 1 ? " (+" + (dis.length - 1) + " more)" : "")
                                  : "swing, cycle, hold and tempo agree with the corpus") + prov };
    }

    const cols = ["named", "linked", "earliest", "closest", "structure", "instrumentation", "rhythm"];
    const got = cols.filter((k) => c[k] && c[k].s != null);
    const score = got.length ? got.reduce((a, k) => a + c[k].s, 0) / got.length : null;
    /* THE SENTENCE: the worst-scoring measured column's own detail. */
    const worst = got.slice().sort((a, b) => c[a].s - c[b].s)[0];
    rows.push({ gk: g.gk, g, c, score, measured: got.length,
                sentence: worst && c[worst].s < 0.999 ? c[worst].d : "nothing to improve that this tool can see",
                worstCol: worst });
    for (const k of cols)
      if (c[k]) checks.push({ gk: g.gk, name: k, score: c[k].s, verdict: c[k].v, detail: c[k].d });
  }

  /* ---- write the checks back ---- */
  const cf = path.join(OUT, "checks.jsonl");
  fs.writeFileSync(cf, checks.map((x) => JSON.stringify(x)).join("\n") + "\n");
  spawnSync("python3", [path.join(__dirname, "q.py"), "--db", DB, "--checks", cf], { stdio: "ignore" });

  /* ---- column totals ---- */
  const cols = ["named", "linked", "earliest", "closest", "structure", "instrumentation", "rhythm"];
  const totals = cols.map((k) => {
    const m = rows.filter((r) => r.c[k] && r.c[k].s != null);
    return {
      col: k, measured: m.length, unmeasured: rows.length - m.length,
      failing: m.filter((r) => r.c[k].s < 0.999).length,
      bad: m.filter((r) => r.c[k].s < 0.7).length,
      mean: m.length ? +(m.reduce((a, r) => a + r.c[k].s, 0) / m.length).toFixed(3) : null,
    };
  });

  /* ---- the closure census ---- */
  const census = closureCensus();

  /* ---- chordonomicon ---- */
  const chord = hasChord ? chordSections(XW, byKey) : null;

  /* ---- write ---- */
  /* THE SIX ROLES AND THE BLANK STATE ARE NOT RANKED. `riff` scored 0.75 on
     its one measured column and landed 25th on a list about genres; a row held
     to one seventh of the checks cannot be compared with a row held to all
     seven. Their `instrumentation` rows are still in the `checks` table and in
     that column's own roster below. */
  const ranked = rows.filter((r) => r.score != null && !ROLES.has(r.gk))
    .sort((a, b) => a.score - b.score);
  fs.writeFileSync(path.join(OUT, "REPORT.md"),
                   render({ rows, ranked, totals, cols, D, census, chord, byKey, CS }));
  console.log("wrote " + path.relative(ROOT, path.join(OUT, "REPORT.md")));
  console.log(totals.map((t) => t.col + " " + t.failing + "/" + t.measured + " flagged (mean " + t.mean + ")").join("\n"));

  /* --------------------------------------------------------------------- */
  function closureCensus() {
    /* THE CLOSURE CENSUS — the sticking point in "should the rows become
       data?". `entry`, `reg`, `realize` and `word` are FUNCTIONS on every one
       of the 417 rows, and a function does not survive JSON. The question is
       how many DISTINCT SHAPES there really are: if a dozen shapes cover four
       hundred rows, the closures are a small enumerable vocabulary with
       arguments and the rows can be data. The shapes below are computed by
       normalising the source text — whitespace collapsed, every numeric
       literal to N, every string literal to "S" — so `v => v * 2` and
       `v => v * 3` are one shape with one argument. */
    const src = Q("SELECT gk, row_json, voices FROM genres");
    const FIELDS = ["entry", "reg", "realize", "word"];
    const norm = (s) => s
      .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ")
      .replace(/\s+/g, " ")
      .replace(/"[^"]*"|'[^']*'/g, '"S"')
      .replace(/-?\b\d+(\.\d+)?\b/g, "N")
      .trim();
    const out = {};
    let partCovers = 0, partAny = 0;
    for (const f of FIELDS) out[f] = { shapes: new Map(), n: 0 };
    for (const r of src) {
      const row = JSON.parse(r.row_json);
      for (const f of FIELDS) {
        const v = row[f];
        if (!v || !v.__fn) continue;
        const sh = norm(v.__fn);
        out[f].n++;
        const m = out[f].shapes;
        if (!m.has(sh)) m.set(sh, []);
        m.get(sh).push(r.gk);
      }
      if (Array.isArray(row.part)) {
        partAny++;
        if (row.part.length >= (row.voices || 0)) partCovers++;
      }
    }
    const res = {};
    for (const f of FIELDS) {
      const arr = [...out[f].shapes.entries()].map(([sh, gks]) => ({ shape: sh, n: gks.length, gks }))
        .sort((a, b) => b.n - a.n);
      const top10 = arr.slice(0, 10).reduce((a, x) => a + x.n, 0);
      res[f] = {
        rows: out[f].n, distinct: arr.length, top: arr.slice(0, 15),
        top10Share: out[f].n ? +(top10 / out[f].n).toFixed(3) : 0,
        singletons: arr.filter((x) => x.n === 1),
      };
    }
    return { res, partAny, partCovers };
  }

  function chordSections(XW, byKey) {
    const mapped = XW.filter((x) => x.gk);
    const byGk = {};
    for (const x of mapped) (byGk[x.gk] = byGk[x.gk] || []).push(x);
    const gks = Object.keys(byGk);
    const cycles = {};
    for (const gk of gks) {
      const labels = byGk[gk].map((x) => x.label.replace(/'/g, "''"));
      const inList = labels.map((L) => "'" + L + "'").join(",");
      const r = Q("SELECT c.roman_cycle cyc, COUNT(*) n FROM chordonomicon c " +
                  "JOIN chordonomicon_genre g ON g.song_id=c.song_id " +
                  "WHERE g.label IN (" + inList + ") AND c.roman_cycle IS NOT NULL " +
                  "GROUP BY cyc ORDER BY n DESC LIMIT 5");
      const tot = Q("SELECT COUNT(DISTINCT song_id) n FROM chordonomicon_genre WHERE label IN (" + inList + ")")[0].n;
      /* AND THE FOUR-GRAM CENSUS, which is the honest version of "their chord
         cycle". `roman_cycle` is the main section's FIRST four distinct
         chords, so it over-reports openings — `I IV I IV` tops almost every
         label because almost every chorus starts on the tonic and moves to
         the subdominant. Counting every four-chord WINDOW inside the section
         instead lets a turnaround that lives in the middle of the phrase be
         seen. */
      const mains = Q("SELECT c.roman_main m FROM chordonomicon c " +
                      "JOIN chordonomicon_genre g ON g.song_id=c.song_id " +
                      "WHERE g.label IN (" + inList + ") AND c.roman_main IS NOT NULL LIMIT 6000");
      const grams = new Map();
      for (const row of mains) {
        const seq = [];
        for (const t of row.m.split(" ")) if (t && seq[seq.length - 1] !== t) seq.push(t);
        const seen = new Set();
        for (let i = 0; i + 4 <= seq.length; i++) {
          const k = seq.slice(i, i + 4).join(" ");
          if (seen.has(k)) continue;      // once per song, so one long vamp is one vote
          seen.add(k);
          grams.set(k, (grams.get(k) || 0) + 1);
        }
      }
      const top4 = [...grams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([cyc, n]) => ({ cyc, n }));
      cycles[gk] = { songs: tot, top: r, gram: top4, sampled: mains.length,
                     labels: byGk[gk].map((x) => x.label + " (" + x.n_songs + ")") };
    }
    /* ONE ROW PER LABEL. A label can be Spotify's `main_genre` on one song and
       a sub-genre on another, and the xwalk keeps those apart on purpose (the
       two carry different weight); a census of "what we have no row for"
       wants them added together, or `pop` and `country` each appear twice in
       a list of thirty. */
    const um = new Map();
    for (const x of XW) {
      if (x.gk) continue;
      const e = um.get(x.label) || { label: x.label, n_songs: 0, kinds: [], note: x.note };
      e.n_songs += x.n_songs; e.kinds.push(x.kind + " " + x.n_songs);
      e.note = e.note || x.note;
      um.set(x.label, e);
    }
    const unmapped = [...um.values()].sort((a, b) => b.n_songs - a.n_songs);
    const totalSongs = Q("SELECT COUNT(*) n FROM chordonomicon")[0].n;
    const totalLabels = XW.length;
    return { cycles, unmapped, totalSongs, totalLabels, mappedLabels: mapped.length };
  }
})().catch((e) => { console.error(e); process.exit(1); });

/* ------------------------------------------------------------------ render */
function render(x) {
  const { rows, ranked, totals, cols, D, census, chord, byKey, CS } = x;
  const L = [];
  const pct = (n, d) => d ? Math.round(100 * n / d) + "%" : "—";
  const num = (v) => v == null ? "—" : (Math.round(v * 100) / 100);
  L.push("# The genre catalogue, checked");
  L.push("");
  L.push("Generated by `node tools/genre-qa/build.js && node tools/genre-qa/report.js`. " +
         "The database is `scratch/genres.db` (derived, gitignored); the builder is committed. " +
         "**Nothing here edits a genre** — `nukernel/genres.js` stays the source of truth.");
  L.push("");
  L.push("`" + rows.length + "` rows. " + (D.up
    ? "Wikipedia decades read from the local kiwix ZIM at " + (process.env.KIWIX_HOST || "localhost") + ":" + (process.env.KIWIX_PORT || 8888) + "."
    : "**Wikipedia decades were NOT read** — " + D.why + " — so the `linked` and `earliest` columns are missing their date half and say so."));
  L.push("");

  L.push("## Column totals");
  L.push("");
  L.push("| column | measured | flagged | badly (<0.7) | mean | not measured |");
  L.push("|---|---:|---:|---:|---:|---:|");
  for (const t of totals)
    L.push("| " + t.col + " | " + t.measured + " | " + t.failing + " (" + pct(t.failing, t.measured) + ") | " +
           t.bad + " | " + t.mean + " | " + t.unmeasured + " |");
  L.push("");

  L.push("## All " + ranked.length + " genres, worst first");
  L.push("");
  L.push("Columns are `named · linked · earliest · closest · structure · instrumentation · rhythm`; " +
         "`·` means the column could not be measured for that row and is left out of its average. " +
         "The sentence is the worst measured column's own detail. " +
         "The six internal roles and `silence` are not ranked — they are held to one column, not seven.");
  L.push("");
  L.push("| # | genre | label | score | nam | lnk | ear | clo | str | ins | rhy | what to improve |");
  L.push("|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|");
  ranked.forEach((r, i) => {
    L.push("| " + (i + 1) + " | `" + r.gk + "` | " + (r.g.label || "") + " | " + num(r.score) + " | " +
      cols.map((k) => r.c[k] && r.c[k].s != null ? num(r.c[k].s) : "·").join(" | ") + " | " +
      (r.sentence || "").replace(/\|/g, "\\|") + " |");
  });
  L.push("");

  /* ------- per-column rosters ------- */
  for (const k of cols) {
    const bad = ranked.filter((r) => r.c[k] && r.c[k].s != null && r.c[k].s < 0.999)
      .sort((a, b) => a.c[k].s - b.c[k].s);
    if (!bad.length) continue;
    L.push("## " + k + " — " + bad.length + " flagged");
    L.push("");
    for (const r of bad.slice(0, 90))
      L.push("- **`" + r.gk + "`** (" + num(r.c[k].s) + ") " + r.c[k].d);
    if (bad.length > 90) L.push("- …and " + (bad.length - 90) + " more (query `checks` for the rest)");
    L.push("");
  }

  /* ------- the closure census ------- */
  L.push("## Closure census — could the rows be data?");
  L.push("");
  L.push("`entry`, `reg`, `realize` and `word` are functions on every row and a function does not " +
         "survive JSON. Shapes are the SOURCE TEXT normalised: comments stripped, whitespace collapsed, " +
         "every numeric literal to `N`, every string literal to `\"S\"` — so `v => v * 2` and `v => v * 3` " +
         "are one shape with one argument.");
  L.push("");
  L.push("| field | rows | distinct shapes | share in the top 10 shapes | one-off shapes |");
  L.push("|---|---:|---:|---:|---:|");
  for (const f of ["entry", "reg", "realize", "word"]) {
    const r = census.res[f];
    L.push("| `" + f + "` | " + r.rows + " | " + r.distinct + " | " + Math.round(r.top10Share * 100) + "% | " + r.singletons.length + " |");
  }
  L.push("");
  L.push("`part[]` overrides `realize` at `precompose.js:2795` (`(G.part && G.part[v]) || G.realize(v)`). " +
         "**" + census.partAny + "** rows declare a `part` array and **" + census.partCovers +
         "** of those cover every one of their own voices — on those rows `realize` is already dead code.");
  L.push("");
  for (const f of ["entry", "reg", "realize", "word"]) {
    const r = census.res[f];
    L.push("### `" + f + "` — top 15 of " + r.distinct + " shapes");
    L.push("");
    L.push("| n | shape | e.g. |");
    L.push("|---:|---|---|");
    for (const s of r.top)
      L.push("| " + s.n + " | `" + s.shape.replace(/\|/g, "\\|").slice(0, 190) + "` | " + s.gks.slice(0, 3).join(", ") + " |");
    L.push("");
    if (r.singletons.length) {
      L.push("<details><summary>" + r.singletons.length + " rows whose `" + f + "` fits no other row (these stay as formula text)</summary>");
      L.push("");
      L.push(r.singletons.map((s) => "`" + s.gks[0] + "`").join(" · "));
      L.push("");
      L.push("</details>");
      L.push("");
    }
  }

  /* ------- chordonomicon ------- */
  if (chord) {
    L.push("## Chordonomicon — 666,000 progressions beside our rows");
    L.push("");
    L.push("`" + chord.totalSongs.toLocaleString() + "` songs loaded from " +
           "`/mnt/sources/relocated/chordonomicon/chordonomicon_v2.csv` (Kantarelis et al., arXiv:2410.22046, " +
           "CC BY-NC 4.0), off-repo beside `corpus.db`. `" + chord.totalLabels + "` distinct genre labels, " +
           "`" + chord.mappedLabels + "` of them mapped to one of our keys. Keys are ESTIMATED " +
           "(Krumhansl-Schmuckler on the chord-tone histogram) and every roman numeral inherits that.");
    L.push("");
    L.push("### Harmony: their cycles against our `prog`");
    L.push("");
    L.push("`opening` is the main section's first four distinct chords; `commonest 4` is the most frequent " +
           "four-chord window anywhere inside it, counted once per song. The opening column over-reports " +
           "`I IV I IV` because almost every chorus starts on the tonic — read the second column for the " +
           "turnaround. Our own `prog` is degrees (0-based) with qualities where the row declares them, " +
           "or the row's `roots` where it does not.");
    L.push("");
    L.push("| genre | our prog / roots | songs | their opening | their commonest 4 |");
    L.push("|---|---|---:|---|---|");
    const gks = Object.keys(chord.cycles).sort((a, b) => chord.cycles[b].songs - chord.cycles[a].songs);
    for (const gk of gks.slice(0, 60)) {
      const g = byKey[gk], cc = chord.cycles[gk];
      const ours = (g.prog_quals ? g.doc_prog_degs + " [" + g.prog_quals + "]" : (g.roots || "—"));
      L.push("| `" + gk + "` | " + ours + " | " + cc.songs + " | " +
             cc.top.slice(0, 3).map((t) => "`" + t.cyc + "` ×" + t.n).join(" · ") + " | " +
             cc.gram.slice(0, 4).map((t) => "`" + t.cyc + "` ×" + t.n).join(" · ") + " |");
    }
    L.push("");
    L.push("### Common genres we do not have — their biggest unmapped labels");
    L.push("");
    L.push("A label with thousands of songs and no key of ours is either a genre this catalogue lacks or an " +
           "umbrella it deliberately refuses. Both are worth reading; the table does not decide which.");
    L.push("");
    L.push("| label | songs | as | note |");
    L.push("|---|---:|---|---|");
    for (const u of chord.unmapped.slice(0, 30))
      L.push("| " + u.label + " | " + u.n_songs + " | " + u.kinds.join(", ") + " | " + (u.note || "") + " |");
    L.push("");
  }

  /* ------- what could not be measured ------- */
  L.push("## What the extractor could not measure");
  L.push("");
  const noCorpus = rows.filter((r) => !(CS[r.gk] || {}).n);
  L.push("- **" + noCorpus.length + " of " + rows.length + " rows matched no MIDI corpus file**, so `structure` " +
         "and `rhythm` are blank for them. The corpus is 120,652 files with no genre metadata: a row is matched " +
         "by the artists its own comment cites (21 rows), by one of the corpus's labelled rips (12), or by its " +
         "key/wiki title appearing in a filename. Most of the world, folk and early-music rows are simply not in " +
         "a corpus assembled from Western pop MIDI.");
  L.push("- **The corpus carries no release year**, so `earliest` cannot be checked against the earliest matching " +
         "file — only against the article's own date and against the declared parents' years.");
  L.push("- **Notation tempo is a convention, not a truth** (`tools/mine/mine-midi.js`): dub and reggae MIDI is " +
         "written double-time and 2/4-notated ragtime reads half as fast as it feels. A clean 2× or ½× tempo " +
         "disagreement is scored as a metric-level question, not a tempo error.");
  L.push("- **Chords, form and key are all estimates.** Chords are template-matched per bar from a bass-weighted " +
         "pitch-class histogram; form is the lag at which bar fingerprints repeat; Chordonomicon keys are " +
         "Krumhansl-Schmuckler on chord tones. Each is right most of the time.");
  if (!D.up) L.push("- **Wikipedia decades were not read** (" + D.why + "), so nothing here checks our year against the article's.");
  L.push("- **`named` cannot read a key.** There is no list of band names to check against; the proxy is the " +
         "row's own wiki `kind` — a row whose article is an ACT or a WORK is a row still named after one — plus " +
         "the label's round-trip through `atlas.js`.");
  L.push("- **The composed record is one seed.** Every chair, section and prog above is `genreToDocument(gk, 1)`; " +
         "a different seed casts a different band, and the report does not sweep seeds.");
  L.push("");
  return L.join("\n");
}
