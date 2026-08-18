#!/usr/bin/env node
// promote-genre.js — a genre somebody invented, written into the catalog.
//
//   node nukernel/promote-genre.js song.json lab.sheffield1989          # print it
//   node nukernel/promote-genre.js song.json lab.sheffield1989 --key techstep --write
//   node nukernel/promote-genre.js --recipe recipe.json --key techstep
//
// HAND-RUN, AND THAT IS THE DESIGN. A kept genre lives in the SONG (song.js
// `genres`, as a recipe) and plays there without anybody's permission — the LAB
// is finished the moment you can use what you invented. Promotion is the
// separate, deliberate act of saying THIS ONE IS A GENRE NOW: it enters the
// catalog every other song can reach, it enters the confusion the genealogy
// panel draws, and it becomes a thing a stranger's record can be built out of.
// That is a decision with a person's name on it, so nothing automates it and
// nothing calls this file. It is the parent project's `tools/genre/
// genre-tool.js` at nukernel's scale, and it borrows that tool's three laws:
//
//   * SPLICE THE SOURCE, DO NOT REGENERATE IT. genres.js is 3,000 lines and
//     most of them are prose explaining why an anchor is what it is. A tool
//     that rewrote the file would rewrite the arguments. This one inserts a
//     block and leaves every byte around it alone.
//   * WRITE A FLAT LITERAL. Not `blend(parents)` — the expanded anchor, in
//     house style, readable straight through, so a musician can argue with it.
//     the inheritance study, 1 spends four paragraphs on why the expansion is
//     COMPILE-TIME and this is the tool that does the compiling.
//   * REFUSE RATHER THAN GUESS. A duplicate key, a recipe the bench will not
//     validate, a family the table does not have, an anchor whose own file will
//     not parse afterwards — every one of them is a refusal with a reason, and
//     the file is not touched. The write is verified by REQUIRING the result
//     before it replaces the original, so a broken splice never lands.
//
// WHAT IT WRITES, in three places, because a genre is three facts:
//   1. nukernel/genres.js   — the anchor literal, with its `parents`/`wants`
//      lineage annotation, which the LAB knows BY CONSTRUCTION: the parents are
//      literally what somebody picked on the bench.
//   2. nukernel/genres.js   — the key into its dominant parent's FAMILIES row,
//      because `family` is stamped from that table at load and an anchor that
//      carried its own `family:` literal would be the only one in the file.
//      The dynamics triple follows from the family, exactly as for every other
//      anchor (DYN_FAMILY), so neither is written into the literal either.
//   3. nukernel/compose.js  — the BPM row. Tempo does not live on the anchor
//      ("where a genre wants to sit, in bpm"), and a genre the composer can
//      pick with no row there writes a song with a NaN tempo.
//
// THE MATERIAL IS SERIALIZED FROM ITS TABLE, NEVER FROM THE CLOSURE. A rolled
// `word` is a closure over a table the roll built (`word.__labTable`), and its
// `toString` reads `(v, s) => ((built[v] || [])[s] || …)` — text that means
// nothing outside the bench. So `word` is re-emitted as the literal operator
// calls the table names, which is both what genres.js's own anchors look like
// and the only form that survives being pasted into a file. Everything else
// architectural was PLUCKED WHOLE from a parent, so its source text already
// lives in genres.js and can simply be printed.
//
// TIER: analysis-tier CommonJS, node only, no caller. Nothing in the app, the
// gates or the deploy path runs it.
"use strict";

const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname);
const LAB = require("./lab.js");
const NG = require("./genres.js");
const NK = require("./kernel.js");
const NS = require("./song.js");
const NC = require("./compose.js");        // for PLAN_OF — the plan is inherited, not invented
const { GENRES } = NG;

const GENRES_JS = path.join(ROOT, "genres.js");
const COMPOSE_JS = path.join(ROOT, "compose.js");

// TWO MARGINS, because the file keeps two. Prose wraps at 74 — every comment
// block in genres.js does — while a VALUE is allowed out to 92, which is where
// the table's own one-line `tone:` and `prog:` rows sit: breaking a tone recipe
// across four lines to respect a comment margin would make it less readable,
// not more, and the whole argument for flat literals is that they read.
const WIDTH = 92, PROSE = 74;

/* ---------------------------------------------------------------- printing */
// A COMPACT JS PRINTER, not JSON.stringify. The difference is the point: the
// file's keys are bare identifiers and its strings are double-quoted, and an
// anchor printed with quoted keys would be the one block in genres.js that
// looks like data instead of like source.
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const keyText = k => (IDENT.test(k) ? k : JSON.stringify(k));
// numbers with the leading zero kept and NO exponent notation ever — a tone
// curve printed as 4e-3 is a tone curve nobody can scan down a column. (The
// table spells small decimals both ways, `q: 0.8` beside `atk: .004`; this
// writes the one that is never ambiguous.)
function numText(n) {
  if (!Number.isFinite(n)) throw new Error("promote: " + n + " is not a number");
  if (Number.isInteger(n)) return String(n);
  const s = String(Math.round(n * 1e6) / 1e6);
  return /e/i.test(s) ? n.toFixed(6).replace(/0+$/, "") : s;
}
// a function value prints as its own SOURCE, re-indented to where it now sits.
// It is safe because every closure on a candidate except `word` was PLUCKED
// WHOLE from a parent — the same text already compiles in this very file, with
// the same kernel helpers in scope.
function fnText(f, indent) {
  const src = String(f).replace(/\r/g, "");
  const lines = src.split("\n");
  if (lines.length === 1) return src.trim();
  // the parent's own indentation, minus its own left margin, plus ours
  const rest = lines.slice(1).filter(l => l.trim());
  const margin = Math.min(...rest.map(l => l.match(/^ */)[0].length));
  return [lines[0].trim()].concat(
    lines.slice(1).map(l => (l.trim() ? indent + l.slice(margin) : ""))).join("\n");
}
// A STEP VECTOR IS GROUPED IN BEATS, not comma-separated flat: the table
// writes `[1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]` and the grouping is the reason
// a kit is readable at all — the eye counts four beats, not sixteen numbers.
const isVec = v => Array.isArray(v) && v.length === 16 &&
  v.every(x => typeof x === "number");
const vecText = v => "[" + [0, 4, 8, 12]
  .map(i => v.slice(i, i + 4).map(numText).join(",")).join(", ") + "]";
// …and a KIT is one lane per line, aligned under the brace, for the same
// reason: lanes are read down the column, against each other.
const isLanes = v => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length > 1 && Object.values(v).every(isVec);

// A LONG STRING BREAKS ACROSS LINES AS CONCATENATION, which is the only way a
// string literal can wrap at all. `words` lines are prose — the roll writes
// "every fourth note gone; then filled to triplets of the grid" — and a genre
// whose description runs thirty columns past every other line in the file is a
// genre nobody reads. The join is a plain trailing space, so the value is
// byte-identical to the unwrapped one.
function strText(s, col) {
  const one = JSON.stringify(s);
  if (col + one.length <= WIDTH) return one;
  const words = s.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    // room for the quotes and the ` +` that follows every line but the last
    if (cur && col + next.length + 5 > WIDTH) { lines.push(cur + " "); cur = w; }
    else cur = next;
  }
  lines.push(cur);
  return lines.map(JSON.stringify).join(" +\n" + " ".repeat(col));
}

// `col` is the column the value STARTS at, so a wrapped object lines its later
// keys up under its first one instead of under some fixed margin
function valueText(v, col) {
  const pad = " ".repeat(col);
  if (typeof v === "function") return fnText(v, pad);
  if (v === null) return "null";
  if (typeof v === "number") return numText(v);
  if (typeof v === "string") return strText(v, col);
  if (typeof v === "boolean") return String(v);
  if (isVec(v)) return vecText(v);
  if (Array.isArray(v)) {
    const parts = v.map(x => valueText(x, col + 1));
    return wrapParts(parts, col + 1, "[", "]", "");
  }
  const inner = col + 2;
  const parts = Object.entries(v).map(([k, x]) =>
    keyText(k) + ": " + valueText(x, inner + keyText(k).length + 2));
  // a kit breaks ONE LANE PER LINE whatever the width says; everything else
  // packs as many entries onto a line as the margin allows, because a `tone`
  // recipe printed one number to a line is seven lines saying what one says
  return isLanes(v) ? "{ " + parts.join(",\n" + " ".repeat(inner)) + " }"
                    : wrapParts(parts, inner, "{ ", "}", " ");
}
// greedy packing to the value margin, with the continuation lined up under the
// first entry — which is what every wrapped literal in genres.js does
function wrapParts(parts, col, open, close, gap) {
  const lines = [];
  let line = "";
  parts.forEach((p, i) => {
    const t = p + (i === parts.length - 1 ? "" : ",");
    if (!line) line = t;
    else if (col + line.length + 1 + t.length + close.length <= WIDTH &&
             !line.includes("\n")) line += " " + t;
    else { lines.push(line); line = t; }
  });
  lines.push(line);
  return open + lines.join("\n" + " ".repeat(col)) + gap + close;
}

// THE ROLLED `word`, AS SOURCE. `word.__labTable` is TABLE[voice][section] =
// [{id, arg}] and lab.js's PALETTE says what each id builds; this table says
// what each id READS AS, keyed on the same ids, so a promoted anchor's word
// closure is the operator calls themselves rather than a reference to a bench
// that is not in the file. Same law as the parent project's gen-genre-info.js:
// every word comes from a table keyed on the operator the closure applies.
const OPSRC = {
  rotate: n => "rotate(" + n + ")",
  reverse: () => "reverse()",
  transpose: n => "transpose(" + n + ")",
  invert: n => "invert(" + n + ")",
  drop: n => "drop(" + n + ")",
  fill: n => "fill(" + n + ")",
  onlygate: n => "only(\"gate\", rotate(" + n + "))",
};
function wordText(word, indent) {
  const table = word && word.__labTable;
  if (!table) return fnText(word, indent);
  for (const rows of table)
    for (const ops of rows)
      for (const o of ops)
        if (!OPSRC[o.id])
          throw new Error("promote: the bench rolled an operator this tool has no " +
                          "source for (\"" + o.id + "\") — add it to OPSRC");
  const secs = table[0].length;
  const body = table.map(rows =>
    "\n" + indent + "  [" + rows.map(ops =>
      "[" + ops.map(o => OPSRC[o.id](o.arg)).join(", ") + "]").join(", ") + "]");
  return "(v, s) => [" + body.join(",") + ",\n" + indent + "][v][s % " + secs + "]";
}

/* ------------------------------------------------------------ the anchor */
// DERIVED FIELDS ARE NOT WRITTEN. `family` comes from the FAMILIES table and
// `stress`/`phrase`/`touch` from DYNAMICS/DYN_FAMILY, both stamped over every
// anchor at load — writing them into the literal would put a second, silently
// losing copy of each one in the file. `bpm` is not written either: it is
// compose.js's row, not an anchor field.
const SKIP = new Set(["family", "stress", "phrase", "touch", "bpm"]);

const HEAD = ["label", "rate", "bars", "voices", "parents"];
function anchorText(key, cand, ctx) {
  const IND = 6, ind = " ".repeat(IND);
  const L = [];
  const prose = (at, s) => L.push(wrapText(s, at + "// ").join("\n"));
  prose("    ", ctx.why);
  L.push("    " + keyText(key) + ": {");
  // the head line, exactly as the table writes it: name, rate, form, headcount
  L.push(ind + "label: " + JSON.stringify(cand.label) + ", rate: " + numText(cand.rate) +
         ", bars: " + numText(cand.bars) + ", voices: " + numText(cand.voices) + ",");
  prose(ind, "LINEAGE: crossed on the LAB bench (nukernel/lab.js) at seed " +
        ctx.seed + ". The weights are not somebody's later reading of this " +
        "anchor — they are what was PICKED, so the DNA below is true by " +
        "construction. `wants` is empty and that is a fact rather than an " +
        "omission: the bench only crosses anchors already in this table, so " +
        "there is no un-tabled ancestor left to name.");
  L.push(ind + "parents: " + valueText(cand.parents, IND + 9) + ",");
  L.push(ind + "wants: [],");
  const put = f => {
    const head = keyText(f) + ": ";
    const text = f === "word" ? wordText(cand.word, ind)
                              : valueText(cand[f], IND + head.length);
    L.push(ind + head + text + ",");
  };
  for (const f of LAB.ORDER)
    if (!SKIP.has(f) && !HEAD.includes(f) &&
        Object.prototype.hasOwnProperty.call(cand, f)) put(f);
  // anything the bench grew that ORDER has not been told about yet — printed
  // rather than dropped, because a field silently missing from a promoted
  // anchor is a genre that sounds different in the catalog than on the bench
  for (const f of Object.keys(cand))
    if (!SKIP.has(f) && !HEAD.includes(f) && !LAB.ORDER.includes(f)) put(f);
  L.push("    },");
  return L.join("\n");
}
// prose wrapped to the file's own column, so a promoted anchor's comment reads
// like the ones above it rather than running off the right of the editor
function wrapText(s, prefix) {
  const out = [];
  let line = "";
  for (const w of String(s).split(/\s+/)) {
    if (line && prefix.length + line.length + 1 + w.length > PROSE) { out.push(line); line = w; }
    else line = line ? line + " " + w : w;
  }
  if (line) out.push(line);
  return out.map(l => prefix + l);
}

/* ------------------------------------------------------------- the splices */
// Each splice is ANCHORED ON TEXT THAT IS ALREADY THERE and refuses if it does
// not find exactly one of it. A tool that silently no-ops on a moved landmark
// is a tool that reports success and writes nothing.
function spliceOnce(src, needle, replace, what) {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error("promote: cannot find " + what + " in the file");
  if (src.indexOf(needle, i + 1) >= 0)
    throw new Error("promote: " + what + " is not unique — refusing to guess");
  return src.slice(0, i) + replace + src.slice(i + needle.length);
}

// the anchor goes in LAST, just before the object closes: the table is not
// sorted (it reads in the order it was written) and the newest genre is the one
// at the bottom, which is also what makes the diff one hunk
const GENRES_END = "\n  };\n\n  // THE ARRANGEMENT'S COLUMN HEADINGS";

// THE FAMILIES ROW, re-wrapped rather than appended to. The row is a wrapped
// list with the family name padded into its own column; sticking a key on the
// end of the last line would push it past the margin every second time.
function spliceFamily(src, fam, key) {
  const re = new RegExp("\\n    \\[\"" + fam + "\",\\s*\\[([\\s\\S]*?)\\]\\],");
  const m = re.exec(src);
  if (!m) throw new Error("promote: no FAMILIES row for \"" + fam + "\"");
  // the row's own list, read back out of the source and re-emitted whole —
  // JSON.parse per entry, so a row this tool cannot actually read throws here
  // rather than being half-rewritten.
  const keys = m[1].replace(/\/\/[^\n]*/g, "").split(",")
    .map(s => s.trim()).filter(Boolean).map(s => JSON.parse(s)).concat([key]);
  const head = "    [" + (JSON.stringify(fam) + ",").padEnd(10) + "[";
  const cont = " ".repeat(head.length);
  const lines = [];
  let line = head;
  // the FAMILIES block keeps the NARROW margin — it is a list of names read
  // down the page, not a value row, and the surrounding rows all wrap here
  const FAMWIDTH = 78;
  keys.forEach((k, i) => {
    const t = JSON.stringify(k) + (i === keys.length - 1 ? "" : ",");
    if (line.length + 1 + t.length > FAMWIDTH && line !== head) {
      lines.push(line); line = cont + t;
    } else line = line === head ? head + t : line + " " + t;
  });
  lines.push(line + "]],");
  return src.slice(0, m.index) + "\n" + lines.join("\n") + src.slice(m.index + m[0].length);
}

// the two compose.js rows, at the LANDMARK each table now carries. The old
// anchor was the parts row's own text ("solo: 128, … pad: 74 };"), which was
// the end of the BPM table right up until twenty-nine genres landed under it
// — and then this tool refused to write anything at all. compose.js ends both
// tables with a comment that says what it is for, and a comment cannot stop
// being the last line of the thing it closes.
//
// AND THE PLAN, not just the tempo. compose() reads PLAN_OF[gk] and PLANS
// with no fallback on purpose ("NO SILENT DEFAULTS"), so a genre promoted with
// a tempo and no plan threw the moment anyone pressed WRITE on it. A promoted
// genre arranges the way its DOMINANT PARENT arranges: the bench already
// decided which parent that is, and a record's shape is the most inherited
// thing about it.
const PLAN_END = "    // PROMOTED PLANS GO ABOVE THIS LINE";
const BPM_END = "                // PROMOTED TEMPOS GO ABOVE THIS LINE";

/* ------------------------------------------------------------------ the run */
function readRecipe(argv) {
  const file = argv._[0], key = argv._[1];
  if (argv.recipe) {
    const r = JSON.parse(fs.readFileSync(argv.recipe, "utf8"));
    return { recipe: r, from: argv.recipe };
  }
  if (!file || !key)
    throw new Error("promote: give a song file and the session key in it " +
                    "(or --recipe <file>)");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const res = NS.load(raw);
  if (!res.ok)
    throw new Error("promote: that song does not load — " +
                    JSON.stringify(res.errors[0]));
  const set = res.song.genres || {};
  if (!set[key])
    throw new Error("promote: " + file + " carries no genre \"" + key + "\"" +
                    (Object.keys(set).length ? " (it has " +
                     Object.keys(set).join(", ") + ")" : " at all"));
  return { recipe: set[key], from: file + " " + key };
}

function promote(opts) {
  const { recipe } = readRecipe(opts);
  // THE CATALOG KEY IS NOT THE SESSION KEY. `lab.sheffield1989` is an address
  // in one song; a catalog anchor is a bare identifier the whole table uses.
  const key = opts.key ||
    String(recipe.label).toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!IDENT.test(key))
    throw new Error("promote: \"" + key + "\" is not usable as a catalog key — " +
                    "pass --key <name>");
  if (Object.prototype.hasOwnProperty.call(GENRES, key))
    throw new Error("promote: the catalog already holds \"" + key + "\" (" +
                    GENRES[key].label + ") — a promotion never overwrites");

  const built = LAB.rebuild(recipe);
  const cand = built.candidate;
  const errs = built.problems.filter(p => p.level === "error");
  if (errs.length)
    throw new Error("promote: the bench refuses this genre — " +
                    errs.map(p => (p.field ? p.field + ": " : "") + p.msg).join("; "));
  if (!cand.label)
    throw new Error("promote: a genre in the catalog needs a name (the recipe has none)");
  if (Object.keys(GENRES).some(k => GENRES[k].label === cand.label))
    throw new Error("promote: the label \"" + cand.label + "\" is already in the table");

  const fam = GENRES[built.dominant].family;
  if (!fam) throw new Error("promote: " + built.dominant + " has no family to join");
  const bpm = Math.max(70, Math.min(160, Math.round(cand.bpm || 120)));
  const parentLine = Object.entries(recipe.parents)
    .sort((a, b) => b[1] - a[1])
    .map(([p, w]) => GENRES[p].label + " " + Math.round(w * 100) + "%").join(" + ");
  const why = cand.label + " — invented on the LAB bench and promoted by hand: " +
    parentLine + ". The architecture is combined and plucked from those parents " +
    "(the inheritance study's field law); the material below — the kit, the " +
    "roots, the words — was drafted by the dice at this seed and kept.";

  const anchor = anchorText(key, cand, { seed: built.seed, why });
  const bpmRow =
    "                // promoted from the LAB bench: the tempo its parents\n" +
    "                // average to (nukernel/lab.js combineBpm)\n" +
    "                " + key + ": " + bpm + ",\n" + BPM_END;
  // the plan comes from the dominant parent, and it must be one the table has
  const plan = NC.PLAN_OF[built.dominant];
  if (!plan)
    throw new Error("promote: " + built.dominant + " has no plan to inherit");
  const planRow =
    "    // promoted from the LAB bench: it arranges the way its dominant\n" +
    "    // parent " + built.dominant + " arranges\n" +
    "    " + key + ": " + JSON.stringify(plan) + ",\n" + PLAN_END;

  let g = fs.readFileSync(opts.genres || GENRES_JS, "utf8");
  g = spliceOnce(g, GENRES_END, "\n\n" + anchor + GENRES_END, "the end of the GENRES table");
  g = spliceFamily(g, fam, key);
  let c = fs.readFileSync(opts.compose || COMPOSE_JS, "utf8");
  c = spliceOnce(c, PLAN_END, planRow, "the end of the compose.js PLAN_OF table");
  c = spliceOnce(c, BPM_END, bpmRow, "the end of the compose.js BPM table");

  return { key, fam, bpm, plan, anchor, candidate: cand, genres: g, compose: c,
           label: cand.label, dominant: built.dominant };
}

// THE WRITE IS VERIFIED BEFORE IT LANDS. The spliced text is written to a
// sibling temp file and REQUIRED — if it does not parse, or the anchor it adds
// does not come back out of the table with the label and the family it was
// given, nothing is renamed and the real file is untouched. This is the whole
// reason the tool can be trusted with a 3,000-line data file.
function verify(text, file, check) {
  // ABSOLUTE, because `require` reads a bare relative string as a package name
  // — and beside the original, because genres.js and compose.js require their
  // neighbours by relative path and a check file anywhere else resolves nothing
  const tmp = path.resolve(file) + ".promote-check.js";
  fs.writeFileSync(tmp, text);
  try {
    delete require.cache[require.resolve(tmp)];
    const mod = require(tmp);
    if (check) check(mod);
  } finally {
    try { delete require.cache[require.resolve(tmp)]; } catch (e) { /* never loaded */ }
    fs.unlinkSync(tmp);
  }
}

function run(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") opts.write = true;
    else if (a === "--key") opts.key = argv[++i];
    else if (a === "--recipe") opts.recipe = argv[++i];
    // --genres / --compose point the SPLICE at a copy, which is how the gate
    // exercises this tool without touching the catalog. They do not move the
    // catalog it CHECKS against: duplicate keys and duplicate labels are always
    // asked of the loaded table, because that is the table a promotion joins.
    else if (a === "--genres") opts.genres = argv[++i];
    else if (a === "--compose") opts.compose = argv[++i];
    else if (a.startsWith("--")) throw new Error("promote: unknown flag " + a);
    else opts._.push(a);
  }
  const r = promote(opts);
  const gfile = opts.genres || GENRES_JS, cfile = opts.compose || COMPOSE_JS;
  verify(r.genres, gfile, mod => {
    const anchor = mod.GENRES[r.key];
    if (!anchor) throw new Error("promote: the spliced file does not hold " + r.key);
    if (anchor.label !== r.label)
      throw new Error("promote: the spliced anchor is labelled " + anchor.label);
    if (anchor.family !== r.fam)
      throw new Error("promote: the spliced anchor landed in family " + anchor.family);
    if (typeof anchor.word !== "function")
      throw new Error("promote: the spliced anchor has no word closure");
    // AND THE ONLY CHECK THAT ACTUALLY MATTERS: the anchor that came back out
    // of the file must PLAY what the bench played. Every check above reads the
    // literal; this one reads the SCHEDULE, which is the artifact — a `word`
    // re-emitted from the wrong operator, a tone leaf rounded on the way to
    // source, a dynamics triple stamped by a family the dominant parent was not
    // in, all of them pass a shape check and none of them survives this one.
    const subj = NG.DEFAULT, j = x => JSON.stringify(x);
    for (const fn of ["render", "drums", "bass"])
      if (j(NK[fn](subj, anchor, anchor.bars)) !==
          j(NK[fn](subj, r.candidate, r.candidate.bars)))
        throw new Error("promote: the spliced anchor's " + fn + "() differs from " +
                        "the genre that was kept — it is not the same genre");
  });
  verify(r.compose, cfile, mod => {
    if (mod.BPM[r.key] !== r.bpm)
      throw new Error("promote: the spliced BPM row reads " + mod.BPM[r.key]);
    // ...and the plan, because a genre with a tempo and no plan is a genre
    // that throws the first time anyone presses WRITE on it
    if (mod.PLAN_OF[r.key] !== r.plan)
      throw new Error("promote: the spliced PLAN_OF row reads " + mod.PLAN_OF[r.key]);
  });
  if (opts.write) {
    fs.writeFileSync(gfile, r.genres);
    fs.writeFileSync(cfile, r.compose);
  }
  return r;
}

module.exports = { promote, run, anchorText, wordText, valueText, spliceFamily };

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.log("usage: node nukernel/promote-genre.js <song.json> <lab.key> " +
                "[--key <catalogKey>] [--write]");
    console.log("       node nukernel/promote-genre.js --recipe <file.json> " +
                "--key <catalogKey> [--write]");
    console.log("");
    console.log("prints the anchor it would write; --write splices genres.js " +
                "and compose.js after verifying that both still load.");
    process.exit(2);
  }
  let r;
  try { r = run(argv); }
  catch (e) { console.error(String(e.message || e)); process.exit(1); }
  console.log(r.anchor);
  console.log("");
  console.log("family  " + r.fam + " (from " + r.dominant + ")");
  console.log("tempo   " + r.bpm + " bpm -> compose.js BPM." + r.key);
  console.log(argv.includes("--write")
    ? "WRITTEN — genres.js and compose.js both re-loaded clean."
    : "dry run — both files verified, neither written. Add --write.");
}
