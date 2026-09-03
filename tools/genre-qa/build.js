#!/usr/bin/env node
/* tools/genre-qa/build.js — THE MIRROR OF THE CATALOGUE.
 *
 *   node tools/genre-qa/build.js                  full build (catalogue + corpus + db)
 *   node tools/genre-qa/build.js --no-corpus      catalogue only; reuse any cached corpus pass
 *   node tools/genre-qa/build.js --recorpus       force the corpus pass even if it is cached
 *   node tools/genre-qa/build.js --corpus-db PATH point at another corpus.db
 *   node tools/genre-qa/build.js --no-chordonomicon   skip the 666k-progression load
 *   node tools/genre-qa/build.js --rechordonomicon    re-derive the chord tables ALONE
 *   node tools/genre-qa/report.js                 the checks, worst-first, into scratch/genre-qa/REPORT.md
 *
 * WHY THIS EXISTS. genres.js is 26,000 lines and 421 rows, and half of every
 * row is closures and an argued comment — which is exactly why that file stays
 * the source of truth and this is only a MIRROR. Nothing here edits a genre. It
 * reads the catalogue, composes every row at seed 1, measures the MIDI corpus
 * that matches each row, and writes the whole thing into one SQLite database so
 * the questions Paul asked ("is this named right, linked right, located at its
 * earliest space and time…") become queries instead of 417 readings.
 *
 * REGENERABLE, AND THE DB IS DERIVED. scratch/ is gitignored; this builder is
 * committed. Delete scratch/genre-qa and run the one command again.
 *
 * ZERO DEPS, AND SQLITE THROUGH python3. better-sqlite3 is not installed on
 * this tree (tools/mine/corpus-db.js shells out to `npm install` for it and
 * that install has never happened here), so node extracts to JSON lines and
 * python3's stdlib sqlite3 loads them. The same interpreter does the corpus
 * measurement, because corpus.db is a 5 GB SQLite file and python reads it
 * without a dependency either.
 *
 * WHAT IS WRITTEN
 *   scratch/genre-qa/catalog.jsonl   one object per genre — the data half of
 *                                    the row, the composed record, the atlas
 *                                    facts, the wiki row, the rules sentences
 *   scratch/genre-qa/corpus.jsonl    one object per genre — the corpus files
 *                                    that match it and what they measure
 *   scratch/genres.db                the seven tables, loaded from both
 *
 * THE LANES. A chair's instrument is one of three things and the report's
 * instrumentation check is built on the distinction:
 *   native   audio/to-engine.js patchForInstr() names a Faust module for the id
 *            (or the row declares a `synth`, or the kit is one of the four
 *            classic machines) — the engine MODELS it
 *   sampled  no patch table claims the id, so recipeBase hands it to the
 *            sampler library — it is a RECORDING (instruments.js sampledId is
 *            the page's own predicate for exactly this and is gated against
 *            recipeFor's routing in test/loop-words.test.js)
 *   found    the id is a `found:` crate address — a bed, a one-shot, or a
 *            collage pool
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "scratch", "genre-qa");
const DB = path.join(ROOT, "scratch", "genres.db");
const ARGV = process.argv.slice(2);
const has = (f) => ARGV.includes(f);
const opt = (f, d) => { const i = ARGV.indexOf(f); return i >= 0 ? ARGV[i + 1] : d; };

const NG = require(path.join(ROOT, "nukernel/genres.js"));
const NA = require(path.join(ROOT, "nukernel/atlas.js"));
const NW = require(path.join(ROOT, "nukernel/wiki.js"));
const NI = require(path.join(ROOT, "nukernel/instruments.js"));
const NR = require(path.join(ROOT, "nukernel/rules.js"));
const NP = require(path.join(ROOT, "nukernel/precompose.js"));

const GENRES = NG.GENRES;

/* ---------------------------------------------------------------------------
 * 1 · THE ROW'S OWN TEXT — the comment
 *
 * The comment is not decoration: 21 rows carry a "MEASURED over N files (…)"
 * line naming the artists the corpus round profiled, and that list is the only
 * record of WHICH files a row was written from. Without it every row falls back
 * to a word search, and the report says which strategy answered.
 *
 * IT IS READ FROM THE ROW, NOT SCRAPED OUT OF genres.js (2026-09-02, the
 * inversion). This function used to walk the 27,000 lines of nukernel/genres.js
 * counting brackets and deciding which lines were comment-only, because the
 * prose lived in a comment and a comment is not data. It is data now:
 * `nukernel/genres/<key>.json` carries the whole argued block as `note`, and
 * the shipped genres.js is GENERATED from it (nukernel/GENRES.md). So the
 * scraper is gone and its two failure modes with it — a row it could not find,
 * and a comment it attributed to the wrong row.
 *
 * `line` is null and stays null. A row's address is its FILE now, and a line
 * number into a generated artifact is a number about the emitter's layout
 * rather than about the catalogue. The column survives in the schema
 * (tools/genre-qa/load.py) because dropping a column is a migration; nothing
 * reads it.
 * ------------------------------------------------------------------------ */
function rowText() {
  const dir = path.join(ROOT, "nukernel/genres");
  const out = {};
  for (const gk of Object.keys(GENRES)) {
    const f = path.join(dir, gk + ".json");
    if (!fs.existsSync(f)) continue;
    const row = JSON.parse(fs.readFileSync(f, "utf8"));
    out[gk] = { line: null, file: "nukernel/genres/" + gk + ".json", comment: row.note || "" };
  }
  return out;
}

const flatten = (comment) =>
  comment.replace(/^\s*(\/\/|\/\*|\*\/|\*)\s?/gm, " ").replace(/\s+/g, " ").trim();

/* THE ACT THE ROW IS WRITTEN FROM, where the comment names one. Almost every
   anchor's first sentence is `GENRE [near] — Place Year. Act, "Record" (label,
   city, year)`, so the name before a quoted title is the act. TWO WORDS AT
   LEAST, on purpose: a one-word capital is as often a city, a label or a
   composer's surname as a searchable act, and a wrong match is worse than no
   match. The QUOTED TITLES are deliberately NOT used — measured over the 417
   comments they add 40 rows and drag in `dreams`, `africa` and `london` as
   needles, which is 350 wrong files to buy 40 right ones. */
const ACT_RE = /([A-Z][\w&.'’-]*(?:[ ](?:of|the|and|van|de|von|du|di|la|le|el))?(?:[ ][A-Z0-9][\w&.'’-]*){1,3})(?:,\s*|’s\s+|'s\s+)["“]/g;
function actsOf(comment) {
  const flat = flatten(comment).slice(0, 900);
  const out = new Set();
  let m;
  ACT_RE.lastIndex = 0;
  while ((m = ACT_RE.exec(flat))) {
    const a = m[1].replace(/^.*?\.\s+/, "").trim().replace(/^[,\s]+|[,\s]+$/g, "");
    if (a.includes(" ") && a.length >= 7) out.add(a);
  }
  return [...out];
}

/* the corpus round's own citation, parsed back out of the prose */
function citedOf(comment) {
  const flat = flatten(comment);
  const m = /MEASURED over (?:the )?(\d+) (?:corpus )?files \(([^)]*)\)/.exec(flat);
  if (!m) {
    const m2 = /MEASURED over (?:the )?(\d+) (?:corpus )?files/.exec(flat);
    return m2 ? { n: +m2[1], artists: [], raw: m2[0] } : null;
  }
  const artists = m[2].split(/·|;/).map((s) => s.replace(/\s+\d+\s*$/, "").trim())
    .filter((s) => s && s.length > 1 && !/^(and|the rest|others)$/i.test(s));
  return { n: +m[1], artists, raw: m[0] };
}

/* ---------------------------------------------------------------------------
 * 2 · THE DATA HALF OF THE ROW — every field, closures as their source text
 * ------------------------------------------------------------------------ */
function dataHalf(g) {
  const out = {};
  for (const [k, v] of Object.entries(g)) out[k] = (typeof v === "function") ? { __fn: String(v) } : v;
  return out;
}

/* ---------------------------------------------------------------------------
 * 3 · THE LANES
 * ------------------------------------------------------------------------ */
const SAMPLED_KITS = new Set(["acoustic", "brush", "electronic", "jazz", "power", "room"]);
const MACHINE_KITS = new Set(["tr808", "tr909", "tr606", "cr78"]);
/* THE MODELLED-THROAT AND MODELLED-BODY DSPS: native, but ORGANIC. This is the
   distinction behind Paul's catch — "Chiptune sounds very organic! Instead of
   like a SID chip!" — and it is NOT the native/sampled line, because a modelled
   larynx is exactly as native as a Minimoog. A chip genre seating voice_lead
   and voice_choir is 100% native and still sounds like people. */
const ORGANIC_DSP = new Set(["voice_lead", "voice_choir", "tract_voice", "choir",
                             "stk_guitar", "stk_piano", "gtr_amp", "erhu", "mallet",
                             "bell", "organ"]);

async function laneTable() {
  const TE = await import("file://" + path.join(ROOT, "nukernel/audio/to-engine.js"));
  return {
    SYNTH_NAMES: TE.SYNTH_NAMES(),
    /* one chair -> { lane, dsp, why } */
    of(voice, G) {
      const kind = voice.kind;
      if (kind === "drums") {
        const kit = voice.instrument || G.drumkit || "acoustic";
        if (MACHINE_KITS.has(kit)) return { lane: "native", dsp: "machine:" + kit, why: "a classic machine, voiced per hit by the engine" };
        if (SAMPLED_KITS.has(kit)) return { lane: "sampled", dsp: null, why: "found/samples/drums/" + kit };
        return { lane: "unknown", dsp: null, why: 'kit id "' + kit + '" is neither a machine nor a sampled directory' };
      }
      if (kind === "bass") {
        const st = (voice.cast && voice.cast.style) || G.bassStyle || "root";
        if (st === "reese" || st === "wobble")
          return { lane: "native", dsp: NI.BASSSYNTH[st].dsp, why: "bassStyle " + st + " is a modelled bass" };
        /* ...AND THE ROW MAY NAME ITS OWN BASS NOW (2026-09-02, the catalogue
           round). This returned "the default acoustic_bass" for every record
           in the table, which was true right up until `bassInstr` existed:
           precompose writes the anchor's word onto the bass VOICE's
           `instrument` and `audio/plan.js castOf` seats it. Reading the chair
           the same way a line chair is read — through `patchForInstr` and
           `sampledId`, one owner for "is this a model" — is the only way this
           column can report the fix; without it thirty-seven re-argued rows
           would still read "sampled" here. Absent is still the recorded
           upright, and it still says so. */
        const bid = voice.instrument || null;
        if (bid) {
          let p = null;
          try { p = TE.patchForInstr(bid, G.tone || {}, false); } catch (e) { p = null; }
          if (p && p.dsp)
            return { lane: "native", dsp: p.dsp,
                     why: "the row's own bassInstr " + bid + " -> " + p.dsp };
          if (NI.sampledId(bid))
            return { lane: "sampled", dsp: null,
                     why: "the row's own bassInstr " + bid + ", a recording" };
          return { lane: "unknown", dsp: null,
                   why: 'bassInstr "' + bid + '" is in no patch table and no sampler' };
        }
        return { lane: "sampled", dsp: null, why: "the default " + NI.BASS_INSTR };
      }
      const id = voice.instrument;
      if (!id) return { lane: "unknown", dsp: null, why: "no instrument on the chair" };
      if (String(id).startsWith("found:")) return { lane: "found", dsp: null, why: "the found crate" };
      if (id === "synth") {
        const sy = (G.synth && G.synth.dsp) || null;
        return sy ? { lane: "native", dsp: sy, why: "the row's signature synth" }
                  : { lane: "unknown", dsp: null, why: "the `synth` sentinel with no row synth" };
      }
      let p = null;
      try { p = TE.patchForInstr(id, G.tone || {}, kind === "pad"); } catch (e) { p = null; }
      if (p && p.dsp) return { lane: "native", dsp: p.dsp, why: "patchForInstr -> " + p.dsp };
      if (NI.sampledId(id)) return { lane: "sampled", dsp: null, why: "no patch table claims it; the sampler library plays it" };
      return { lane: "unknown", dsp: null, why: "not an INSTRCHOICES id and no patch" };
    },
  };
}

/* ---------------------------------------------------------------------------
 * 4 · THE SEARCH TERMS a genre offers the corpus
 *
 * In order of trust:
 *   cited   the row comment's own "MEASURED over N files (Artist · Artist)" —
 *           the corpus round's own file set, recovered from the prose
 *   rip     the corpus's own labelled directories (ragtime, dub, jazz, folk,
 *           the five classical rips) where a row IS that music
 *   word    the genre key and the wiki title, as words that appear in a
 *           filename
 * The strategy is recorded on every row, so a number measured off a word search
 * is never mistaken for a number measured off a named corpus.
 * ------------------------------------------------------------------------ */
const RIP_HINT = {
  ragtime: ["ragtime"], dub: ["dub"], reggae: ["dub"], jazz: ["jazz"],
  bebop: ["jazz"], swing: ["jazz"], folk: ["folk"], appalachian: ["folk"],
  seanos: ["folk"], irishtrad: ["folk"], contradance: ["folk"], shanty: ["folk"],
  classical: ["classical_greats", "classical_piano", "classical_midiworld", "classical_mfiles"],
  romantic: ["classical_greats", "classical_piano"],
  baroque: ["classical_greats", "classical_mfiles"],
  fugue: ["classical_greats", "classical_mfiles"],
  counterpoint: ["classical_greats", "classical_mfiles"],
  classicalguitar: ["classical_guitar"], flamenco: ["classical_guitar"],
};
/* THE KEYS WHOSE WORD IS A WORD ABOUT SOMETHING ELSE. A search that returns the
   wrong music is worse than a search that returns nothing (wiki.js's own "a
   wrong link is worse than none", one floor down), so these keys are refused
   the word strategy BY NAME and the reason is carried into the report. */
const WORD_REFUSED = {
  simple: "an English adjective", silence: "the blank state — there is no music to match",
  drone: "an aircraft", house: "a building", garage: "a building",
  trap: "a snare, in the other sense", rock: "a stone", soul: "a person's",
  dnb: "an abbreviation nothing is filed under", march: "a month",
  blues: "a mood", swing: "a motion", bounce: "a motion",
  chorale: "a genre word that is also a form word", minimalism: "an art movement",
  classical: "the whole tradition", ambient: "an adjective",
  industrial: "an economic sector", garagerock: "a building",
  waltz: "a form every tradition writes, not this row's music",
  polka: "a form every tradition writes, not this row's music",
};

function termsFor(gk, cited, wiki, acts) {
  if (cited && cited.artists.length) return { strategy: "cited", terms: cited.artists };
  if (RIP_HINT[gk]) return { strategy: "rip", terms: RIP_HINT[gk] };
  const t = new Set(acts);
  if (WORD_REFUSED[gk])
    return t.size ? { strategy: "act", terms: [...t], why: WORD_REFUSED[gk] }
                  : { strategy: "refused", terms: [], why: WORD_REFUSED[gk] };
  if (gk.length >= 5) t.add(gk);
  if (wiki && wiki.title) {
    const w = wiki.title.replace(/_/g, " ").replace(/\s*\([^)]*\)\s*/g, "").trim().toLowerCase();
    if (w.length >= 5 && !/^(list|music) /.test(w)) t.add(w);
  }
  return { strategy: t.size ? (acts.length ? "word+act" : "word") : "none", terms: [...t] };
}

/* ------------------------------------------------------------------------ */
/* --rechordonomicon — RE-DERIVE THE CHORD TABLES AND NOTHING ELSE.
 *
 * A full build always rebuilds them (chordonomicon.py DROPs its own three
 * tables every run), so there is no "force" to add; what was missing was the
 * other half — a way to redo the 666k-progression pass WITHOUT the four-minute
 * corpus decode and the whole catalogue extract, which is what you want when
 * the chord tokenizer changes and nothing about a genre row has.
 *
 * It runs the same step the full build runs, against the DB that is already
 * there. The cross-walk reads `genres`, so the DB must have been built once.
 */
async function rechordonomicon() {
  const CHORD = opt("--chordonomicon", "/mnt/sources/relocated/chordonomicon/chordonomicon_v2.csv");
  if (!fs.existsSync(DB)) {
    console.error("--rechordonomicon: no db at " + path.relative(ROOT, DB) + " — run a full build first");
    process.exit(1);
  }
  if (!fs.existsSync(CHORD)) {
    console.error("--rechordonomicon: no CSV at " + CHORD);
    process.exit(1);
  }
  const r = spawnSync("python3", [path.join(__dirname, "chordonomicon.py"),
                                  "--csv", CHORD, "--db", DB], { stdio: "inherit" });
  if (r.status !== 0) { console.error("chordonomicon.py failed (" + r.status + ")"); process.exit(1); }
  console.log("db: " + path.relative(ROOT, DB) + " (chord tables only)");
  console.log("next: node tools/genre-qa/report.js");
}

async function main() {
  if (has("--rechordonomicon")) return rechordonomicon();
  fs.mkdirSync(OUT, { recursive: true });
  const text = rowText();
  const LANES = await laneTable();
  const keys = Object.keys(GENRES);
  const rows = [];

  for (const gk of keys) {
    const G = GENRES[gk];
    const t = text[gk] || { line: null, comment: "" };
    const cited = citedOf(t.comment || "");
    const wiki = NW.WIKI[gk] || null;
    const miss = NW.MISSES.find((m) => m.key === gk) || null;
    const when = NA.WHEN[gk] || null;
    const region = when
      ? (Object.entries(NA.REGIONS).find(([, ps]) => ps.includes(NA.canon(when.place))) || [null])[0]
      : null;

    let doc = null, docErr = null;
    try { doc = NP.genreToDocument(gk, 1); } catch (e) { docErr = String((e && e.message) || e); }

    let rules = [], rulesErr = null;
    try {
      rules = NR.say(G, gk).map((r) => ({
        field: r.field, axis: r.axis, head: r.head, declared: r.declared ? 1 : 0,
        tier: r.rederive, sentence: r.parts.map((p) => p.w).join(""),
        value: (r.value && typeof r.value === "object") ? JSON.stringify(r.value)
             : (r.value === undefined ? null : String(r.value)),
      }));
    } catch (e) { rulesErr = String((e && e.message) || e); }

    const chairs = (doc ? doc.voices : []).map((v, i) => {
      const L = LANES.of(v, G);
      return {
        idx: i, name: v.name, kind: v.kind,
        part: (v.cast && v.cast.part) || null,
        reg: (v.cast && v.cast.reg != null) ? v.cast.reg : null,
        entry: (v.cast && v.cast.entry != null) ? v.cast.entry : null,
        style: (v.cast && v.cast.style) || null,
        instrument: v.instrument || null,
        lane: L.lane, dsp: L.dsp, lane_why: L.why,
        organic: L.dsp ? (ORGANIC_DSP.has(L.dsp) ? 1 : 0) : (L.lane === "sampled" ? 1 : 0),
        desk: v.desk ? JSON.stringify(v.desk) : null,
      };
    });

    const sections = (doc ? doc.form.sections : []).map((s, i) => ({
      idx: i, id: s.id, role: s.role, bars: s.bars,
      period: s.period || null, lvl: s.lvl || null, env: s.env || null,
    }));

    const parents = [];
    for (const [p, w] of Object.entries(G.parents || {})) parents.push({ parent: p, weight: w, kind: "parent" });
    for (const w of (G.wants || [])) parents.push({ parent: String(w), weight: null, kind: "want" });

    const kit = G.kit || {};
    const kitLanes = Object.keys(kit);
    const kitHits = kitLanes.reduce((a, l) => a + (kit[l] || []).reduce((x, y) => x + (y ? 1 : 0), 0), 0);
    const kitSteps = kitLanes.reduce((a, l) => a + (kit[l] || []).length, 0);
    const terms = termsFor(gk, cited, wiki, actsOf(t.comment || ""));

    rows.push({
      gk,
      row: dataHalf(G),
      label: G.label, family: G.family || null, plan: G.plan, bpm: G.bpm,
      jitter: G.jitter == null ? null : G.jitter, voices: G.voices, bars: G.bars,
      rate: G.rate, harmony: G.harmony, near: G.near || null,
      artic: G.artic || null, max_hold: G.maxHold == null ? null : G.maxHold,
      bass_style: G.bassStyle || null, swing: G.swing == null ? null : G.swing,
      drumkit: G.drumkit || null, nobass: G.nobass ? 1 : 0, silent: G.silent ? 1 : 0,
      instrumental: G.instrumental ? 1 : 0, diatonic: G.diatonic ? 1 : 0,
      // the row's own declared answer to the instrumentation column: "there is
      // no model of these instruments and the recording IS the instrument"
      // (2026-09-02, the catalogue round; twelve rows say it)
      organic: G.organic ? 1 : 0,
      intro: G.intro || null,
      prog_len: (G.prog || []).length,
      prog_quals: (G.prog || []).map((p) => p.q).join(" ") || null,
      roots: (G.roots || []).join(" ") || null,
      fx: (G.fx || []).join(" ") || null,
      cannot: (G.cannot || []).join(" | ") || null,
      has_synth: G.synth ? 1 : 0, synth_dsp: (G.synth && G.synth.dsp) || null,
      kit_lanes: kitLanes.join("") || null, kit_hits: kitHits, kit_steps: kitSteps,
      kit_density: kitSteps ? +(kitHits / kitSteps).toFixed(4) : 0,
      words: (G.words || []).join(" | "),
      comment: t.comment,
      comment_lines: (t.comment || "").split("\n").filter((x) => x.trim()).length,
      cited_n: cited ? cited.n : null, cited_artists: cited ? cited.artists.join(" | ") : null,
      place: when ? when.place : null, year: when ? when.year : null,
      year_word: when ? NA.yearWord(when.year) : null,
      era: when ? NA.eraOf(when.year) : null, region,
      wiki_title: wiki ? wiki.title : null, wiki_kind: wiki ? wiki.kind : null,
      wiki_why: wiki ? wiki.why : null, wiki_url: wiki ? NW.url(gk) : null,
      wiki_miss_why: miss ? miss.why : null,
      doc_err: docErr,
      doc_bpm: doc ? doc.time.bpm : null, doc_meter: doc ? doc.time.meter : null,
      doc_swing: doc ? doc.time.swing : null, doc_rate: doc ? doc.time.rate : null,
      doc_mode: doc ? doc.alphabet.mode : null, doc_scale: doc ? doc.alphabet.scale : null,
      doc_harmony: doc ? doc.alphabet.harmony : null,
      doc_prog_len: doc ? (doc.alphabet.prog || []).length : null,
      doc_prog_quals: doc ? (doc.alphabet.prog || []).map((p) => p.q).join(" ") : null,
      doc_prog_degs: doc ? (doc.alphabet.prog || []).map((p) => p.d).join(" ") : null,
      doc_sections: sections.length,
      doc_bars: sections.reduce((a, s) => a + (s.bars || 0), 0),
      doc_section_bars: sections.map((s) => s.bars).join(" "),
      doc_roles: sections.map((s) => s.role).join(" "),
      doc_chairs: chairs.length,
      n_native: chairs.filter((c) => c.lane === "native").length,
      n_sampled: chairs.filter((c) => c.lane === "sampled").length,
      n_found: chairs.filter((c) => c.lane === "found").length,
      n_unknown: chairs.filter((c) => c.lane === "unknown").length,
      n_organic: chairs.filter((c) => c.organic).length,
      dsps: [...new Set(chairs.map((c) => c.dsp).filter(Boolean))].join(" "),
      rules_err: rulesErr,
      corpus_strategy: terms.strategy, corpus_terms: terms.terms.join(" | "),
      corpus_refused_why: terms.why || null,
      chairs, sections, parents, rules,
    });
  }

  const jl = path.join(OUT, "catalog.jsonl");
  fs.writeFileSync(jl, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log("catalog: " + rows.length + " genres -> " + path.relative(ROOT, jl));

  /* ---- the corpus pass ---- */
  const cj = path.join(OUT, "corpus.jsonl");
  const corpusDb = opt("--corpus-db", "/mnt/sources/relocated/stellate-midi-corpus/corpus.db");
  const cached = fs.existsSync(cj);
  if (has("--no-corpus")) {
    console.log("corpus: skipped (--no-corpus)" + (cached ? "; reusing the cached pass" : "; none cached"));
  } else if (cached && !has("--recorpus")) {
    console.log("corpus: cached at " + path.relative(ROOT, cj) + " (--recorpus to redo it)");
  } else if (!fs.existsSync(corpusDb)) {
    console.log("corpus: SKIPPED — no corpus.db at " + corpusDb);
  } else {
    const r = spawnSync("python3", [path.join(__dirname, "corpus.py"), "--catalog", jl,
                                    "--corpus", corpusDb, "--out", cj], { stdio: "inherit" });
    if (r.status !== 0) { console.error("corpus.py failed (" + r.status + ")"); process.exit(1); }
  }

  /* ---- the load ---- */
  const r2 = spawnSync("python3", [path.join(__dirname, "load.py"), "--catalog", jl,
                                   "--corpus", fs.existsSync(cj) ? cj : "", "--db", DB], { stdio: "inherit" });
  if (r2.status !== 0) { console.error("load.py failed (" + r2.status + ")"); process.exit(1); }

  /* ---- Chordonomicon, if the CSV has been fetched ----
     AFTER load.py, always: that script DROPs and rebuilds its own seven
     tables, and the cross-walk reads `genres` to map a label to a key. */
  const CHORD = opt("--chordonomicon", "/mnt/sources/relocated/chordonomicon/chordonomicon_v2.csv");
  if (has("--no-chordonomicon")) console.log("chordonomicon: skipped (--no-chordonomicon)");
  else if (!fs.existsSync(CHORD))
    console.log("chordonomicon: SKIPPED — no CSV at " + CHORD + "\n" +
      "  fetch it with:  mkdir -p " + path.dirname(CHORD) + " && curl -sL -o " + CHORD + " \\\n" +
      "    https://huggingface.co/datasets/ailsntua/Chordonomicon/resolve/main/chordonomicon_v2.csv");
  else {
    const r3 = spawnSync("python3", [path.join(__dirname, "chordonomicon.py"),
                                     "--csv", CHORD, "--db", DB], { stdio: "inherit" });
    if (r3.status !== 0) { console.error("chordonomicon.py failed (" + r3.status + ")"); process.exit(1); }
  }
  console.log("db: " + path.relative(ROOT, DB));
  console.log("next: node tools/genre-qa/report.js");
}

main().catch((e) => { console.error(e); process.exit(1); });
