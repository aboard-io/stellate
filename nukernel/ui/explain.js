// nukernel/ui/explain.js — THE ? MARK AND THE PAGE IT OPENS.
//
// Paul, 2026-08-30: *"add a ? Icon above the log icon that fully explains
// every aspect of a genre."*
//
// AND, SAME DAY, ON THE FIRST SHIPPED FORM — the dated reversal this file's
// second round answers: *"The question mark icon produces tons of stuff but
// it's hard to parse. It should be in tables and give a sense of what leads
// into what. It's very repetitive."* The EXTRACTION below is unchanged — the
// same owners, the same facts, every one still stamped `data-own` — what
// reversed is the FORM, three ways:
//
//   1. TABLES. Each axis is now a two-column <table> (fact | value) in the
//      page's own table language (nu.css `table`/`th,td` — the ruled cells,
//      the zebra, the plate; no new bones). Where the genre row AND the
//      record's document both speak on one fact (g.bpm beside doc.time.bpm)
//      that is ONE ROW with two value columns — `genre | this record` — and
//      the row only splits when the two values DIFFER; equal values print
//      once, because "the row's tempo" restating the tempo was exactly the
//      repetition Paul named. An empty fact is an OMITTED row (a table of
//      dashes is noise); an axis with nothing keeps one honest sentence and
//      no frame.
//   2. WHAT LEADS INTO WHAT. Lineage is the panel's HERO, first after the
//      head, drawn as a FLOW the eye can walk: ancestors ABOVE (the parents
//      table walked recursively, up to three generations, deduped), THIS
//      RECORD as the bold middle line, the derived children BELOW — each
//      generation ordered by atlas year, each line indented one step further
//      down the page with a `└` connector (marks, not SVG), weight small,
//      tappable exactly as before. Sibling wants ride at the flow's foot as
//      one "still owed:" line.
//   3. DEDUPLICATED AT THE DRAWING. Measured on the shipped panel
//      (2026-08-30, waltz): "as written" printed 41 times, "a line, 12
//      steps" 8 times, "the row says" 3 times. Now: a voice's development
//      prints its MAJORITY word once with a count and only the departures by
//      section ("as written ×9; backwards §2 §8"); voices whose whole plan is
//      identical share one row; material cells with the same shape share one
//      row; the row's `words` are one row; and a parent that is a ROLE says
//      "a role" in the flow instead of repeating EXCLUDE's whole sentence
//      (the full sentence still prints, verbatim, when the OPEN record is a
//      role — that is T8f's byte-equal check and it stands).
//
// WHAT "FULLY EXPLAINS EVERY ASPECT" MEANS HERE, and it is not a paragraph
// somebody typed: the OPEN RECORD's genre, read out under the eight axes of
// AXES.md (Material / Alphabet / Time / Development / Form / Cast / Sound /
// Performance — the agreed vocabulary), every fact EXTRACTED from the table
// that already owns it and stamped with that owner's name (`data-own`), so the
// page teaches the vocabulary while explaining the record and nothing in it
// can drift away from the data it restates. The owners, by section:
//
//   · the genres.js row  — label, family, bpm/rate/swing, scale/mode/harmony,
//     plan/intro/outro, instr/kit/tone, artic, `words` (the row's own
//     sentences), `parents` (weighted), `wants` (the debts it names),
//     `instrumental`, and `cannot` — WHAT THE BOX ADMITS IT CANNOT SAY about
//     this music, printed verbatim and prominently, because that honesty is
//     the point of the row carrying it at all;
//   · the document       — the record's OWN reading beside the genre's idiom:
//     doc.time / doc.alphabet / doc.material.cells / doc.form.sections /
//     each voice's development words / doc.voices / doc.sound /
//     doc.performance (songs.js is the shape's owner, AXES.md the names');
//   · atlas.js WHEN      — the year and the place, and the chronological
//     neighbours (one line each, tappable);
//   · atlas.js EXCLUDE   — the six roles' own sentences ("a role has a job,
//     not a history"), for a basis or a parent that is a role;
//   · wiki.js            — the article, its kind, and the `why` sentence that
//     argued for it (or the MISSES row that argued against linking at all).
//
// WHAT COULD NOT BE EXTRACTED, SAID OUT LOUD: the row COMMENT — the argued
// named-record paragraph over each anchor in genres.js — is not exported as
// data, and this file does NOT parse source comments at runtime. The nearest
// table-carried argument is wiki.js's `why`, which is used; the rest of the
// comment's argument stays in genres.js where it lives.
//
// THE PANEL IS THE LOGGER'S OWN IDIOM, ONE RULE UP. Like #nu-log it is
// OUTSIDE #app (appended to <body>, position: fixed — POSITIONED, never
// inserted into flow), so draw() cannot destroy it, `window.__eightFrozen`
// never sees it, and playback — which may only write inside [data-live] —
// cannot rebuild it while it is open: the only writers are `set()` (the ?
// mark's own toggle, a hand) and a tap on a lineage/neighbour name (also a
// hand). It is `hidden` while shut so the text diet never counts it, and it
// does not EXIST until the first press builds it.
//
// THE MARK IS PERMANENT THE WAY #play IS: built once at module scope in
// ui/eight.js's foot (which `paintTray` never rebuilds — it empties only
// `trayUpBox` and `trayList`), directly above the log mark at every level.
// It is a DOOR, so it carries `aria-expanded` — the same discipline as
// #playops, "the honest word for a control that shows a set of siblings".
//
// (The mark's row belongs in ui/glyph.js's GLYPH table — the one owner of
// what a gutter button is — and that file is outside this round's fence, so
// the three columns are HERE, once, beside their only caller, flagged for the
// glyph owner to take in. No second table is created: it is one literal
// passed to glyph.js's own icon().)

import { GENRES, DRUMNAME, MODES, MODELABEL, SCALES, SCALELABEL,
         KEYLABEL, ROMAN, NuAtlas, NuWiki } from "./deps.js";
import { icon } from "./glyph.js";

/* ---------- the local kit (glyph.js's own three-liner) ------------------ */
const el = (tag, text, cls) => { const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n; };

/* THE EIGHT, BY NAME, IN THE EVALUATION ORDER. AXES.md is a document and not
   a module — no table exports these eight words — so they are stated once
   here, quoting their owner: "Time · Alphabet · Material · Form · Development
   · Cast · Sound · Performance" (AXES.md, THE SEQUENCE IS AN EVALUATION
   ORDER). The order is the reader's: written this way the eight can be read
   in one pass with no forward references, which is what makes this panel a
   document and not a list of topics. */
const AXES = ["Time", "Alphabet", "Material", "Form",
              "Development", "Cast", "Sound", "Performance"];

/* name an array back to its table key — the genre row carries `mode` and
   `scale` as ARRAYS (the kernel reads them; names are for people), and the
   tables that own the names are MODES/SCALES themselves. Reverse-matched, not
   copied: a renamed mode renames here by existing. */
const nameOf = (table, arr) => {
  if (!Array.isArray(arr)) return null;
  const s = JSON.stringify(arr);
  for (const k of Object.keys(table))
    if (JSON.stringify(table[k]) === s) return k;
  return null;
};

/* a table value that is itself a table (an orn map, a stress shape) is
   printed as its own JSON — verbatim data, never a prose paraphrase and
   never "[object Object]" */
const word = (v) => typeof v === "object" ? JSON.stringify(v) : String(v);

/* ---------- the row model (2026-08-30: "It should be in tables.") --------
   one fact = one row. `row` is a single-owner fact; `pair` is a fact BOTH the
   genre row and the record's document have a say on — one row, two value
   columns, and the row only splits when the values differ (equal values are
   ONE fact and print once, owned by both — printing them twice was the
   repetition being reversed). A null/empty value is a fact the tables do not
   carry for this record, and it is DROPPED rather than printed as a blank or
   a dash: a table of dashes is noise, and a silent empty cell is the grey
   this page's laws forbid. */
const row = (name, value, own) => {
  if (value == null || value === "") return null;
  return { name, val: word(value), own };
};
const pair = (name, gval, dval, gown, down) => {
  if (gval == null || gval === "")
    return row(name, dval, down);
  if (dval == null || dval === "")
    return row(name, gval, gown);
  if (word(gval) === word(dval))
    return { name, val: word(gval), own: gown + " = " + down };
  return { name, gval: word(gval), dval: word(dval),
           own: gown + " | " + down, dual: true };
};

/* one axis = one <table> in the page's own table language: nu.css already
   rules every cell, plates the table, zebras the body — no new bones. Rows
   are appended straight to the <table> (no <tbody>), the way every other
   table on this page is built ("table > tr is a real selector"). The owner
   is stamped on the <tr>. A header row (`fact | genre | this record`) exists
   ONLY when some row actually splits; single-value rows under it span the
   two value columns. */
const tableOf = (head, rows) => {
  rows = rows.filter(Boolean);
  if (!rows.length) return null;
  const s = el("section", null, "nu-xax");
  s.append(el("h3", head));
  const t = el("table", null, "nu-xtab");
  const dual = rows.some((r) => r.dual);
  if (dual) {
    const tr = el("tr");
    tr.append(el("th", "fact"), el("th", "genre"), el("th", "this record"));
    t.append(tr);
  }
  for (const r of rows) {
    const tr = el("tr");
    tr.dataset.own = r.own;
    const name = el("td");
    name.append(el("b", r.name));
    tr.append(name);
    if (r.dual) tr.append(el("td", r.gval), el("td", r.dval));
    else {
      const td = el("td", r.val);
      if (dual) td.colSpan = 2;
      tr.append(td);
    }
    t.append(tr);
  }
  s.append(t);
  return s;
};

/* the record's changes, said in the numerals the Key panel already speaks —
   ROMAN is kernel.js's own table, imported, never copied. */
const progWord = (prog) => {
  if (!Array.isArray(prog) || !prog.length) return null;
  return prog.map((p) => {
    const r = (ROMAN && ROMAN[((p.d % 7) + 7) % 7]) || String(p.d);
    return p.q && p.q !== "triad" ? r + " " + p.q : r;
  }).join(" – ");
};

/* ---------- the eight sections, each an extraction, each a table --------- */

function axisTime(g, doc) {
  const t = doc.time || {};
  return tableOf("Time", [
    pair("tempo", g.bpm != null ? g.bpm + " bpm" : null,
      t.bpm != null ? t.bpm + " bpm" : null, "genres.js bpm", "doc.time.bpm"),
    pair("rate", g.rate != null ? "×" + g.rate : null,
      t.rate != null ? "×" + t.rate : null, "genres.js rate", "doc.time.rate"),
    pair("meter", g.meter || null, t.meter || null,
      "genres.js meter", "doc.time.meter"),
    pair("swing", g.swing != null ? g.swing : null,
      t.swing != null ? t.swing : null, "genres.js swing", "doc.time.swing"),
    row("period", g.period || null, "genres.js period"),
  ]);
}

function axisAlphabet(g, doc) {
  const a = doc.alphabet || {};
  const gm = nameOf(MODES, g.mode), gs = nameOf(SCALES, g.scale);
  return tableOf("Alphabet", [
    row("key", a.key != null ? (KEYLABEL[String(a.key)] || a.key) : null,
      "doc.alphabet.key"),
    pair("mode", gm ? (MODELABEL[gm] || gm) : null,
      a.mode ? (MODELABEL[a.mode] || a.mode) : null,
      "genres.js mode", "doc.alphabet.mode"),
    row("the subject's scale", gs ? (SCALELABEL[gs] || gs) : null,
      "genres.js scale"),
    pair("harmony", g.harmony || null, a.harmony || null,
      "genres.js harmony", "doc.alphabet.harmony"),
    row("the changes", progWord(a.prog), "doc.alphabet.prog"),
  ]);
}

function axisMaterial(g, doc) {
  const cells = (doc.material && doc.material.cells) || {};
  const names = Object.keys(cells);
  /* cells GROUPED BY SHAPE (2026-08-30: "It's very repetitive."). The
     shipped panel printed "a line, 12 steps" once per cell — eight identical
     rows on waltz. The shape is the fact; the names that share it are one
     row. Nothing is lost: every name still prints, once. */
  const byShape = {};
  for (const n of names) {
    const c = cells[n] || {};
    const drum = c.kind === "drum";
    const steps = drum ? 16 : (c.deg || c.play || []).length || 16;
    const shape = (drum ? "a drum grid" : "a line") + ", " + steps + " steps";
    (byShape[shape] = byShape[shape] || []).push(n);
  }
  const rows = Object.keys(byShape).map((shape) =>
    row(byShape[shape].join(", "), shape, "doc.material.cells"));
  if (!rows.length)
    /* AXES.md's own ruling, not this file's: "Motifs are optional. … Melody
       is a LAYER, not a prerequisite." Quoted, because an empty section with
       no sentence would read as a bug rather than as half the catalog. */
    rows.push(row("cells", "none — “melody is a LAYER, not a prerequisite”" +
      " (AXES.md)", "AXES.md"));
  return tableOf("Material", rows);
}

function axisForm(g, doc) {
  const secs = (doc.form && doc.form.sections) || [];
  const rows = secs.map((s, i) =>
    row(String(i + 1) + " · " + (s.role || s.id),
      s.bars != null ? s.bars + " bars" : null, "doc.form.sections"));
  return tableOf("Form", [
    row("plan", g.plan || null, "genres.js plan"),
    row("intro", g.intro || null, "genres.js intro"),
    row("outro", g.outro || null, "genres.js outro"),
    ...rows,
  ]);
}

function axisDevelopment(g, doc) {
  const secs = (doc.form && doc.form.sections) || [];
  const voices = doc.voices || [];
  /* THE MAJORITY WORD, ONCE, WITH A COUNT — DEPARTURES BY SECTION
     (2026-08-30). The shipped panel said "as written" 41 times on waltz — a
     voice's whole development spelled out per section, eight voices deep.
     Now each voice's plan is its most common word ×count, then only the
     departures, grouped: "as written ×9; backwards §2 §8". Same table, same
     owner, every departure still named — the sameness is counted instead of
     chanted. Voices whose plans come out IDENTICAL share one row. */
  const planOf = (v) => {
    const dev = v.development || {};
    const words = secs.map((s) => dev[s.id] || "as written");
    if (!words.length) return null;
    const tally = {};
    for (const w of words) tally[w] = (tally[w] || 0) + 1;
    const major = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    const deps = {};
    words.forEach((w, i) => {
      if (w !== major) (deps[w] = deps[w] || []).push("§" + (i + 1));
    });
    const depWords = Object.keys(deps)
      .map((w) => w + " " + deps[w].join(" "));
    return major + " ×" + tally[major] +
      (depWords.length ? "; " + depWords.join(", ") : "");
  };
  const byPlan = {};
  for (const v of voices) {
    const p = planOf(v);
    if (p == null) continue;
    (byPlan[p] = byPlan[p] || []).push(v.name || "voice");
  }
  const rows = Object.keys(byPlan).map((p) =>
    row(byPlan[p].join(", "), p, "doc.voices[].development"));
  return tableOf("Development", [
    /* the row's own sentences — ONE row, however many it wrote (the shipped
       panel printed the label "the row says" once per sentence) */
    row("the row says", (g.words || []).length
      ? g.words.map((w) => "“" + w + "”").join("  ·  ") : null,
      "genres.js words"),
    ...rows,
  ]);
}

function axisCast(g, doc) {
  const voices = doc.voices || [];
  const rows = voices.map((v) => {
    const c = v.cast || {};
    const bits = [v.kind, v.instrument,
      c.part ? "part " + c.part : null,
      c.reg != null ? "reg " + c.reg : null,
      c.entry != null ? "enters bar " + c.entry : null,
      typeof v.material === "string" ? "reads " + v.material : null]
      .filter(Boolean).join(", ");
    return row(v.name || "voice", bits, "doc.voices[]");
  });
  return tableOf("Cast", [
    row("the row seats", g.voices != null ? g.voices +
      (g.voices === 1 ? " voice" : " voices") : null, "genres.js voices"),
    g.instrumental ? row("instrumental", "declared by the row — no chair " +
      "here may be seated with a voice or a mouth", "genres.js instrumental")
      : null,
    ...rows,
  ]);
}

function axisSound(g, doc) {
  const s = doc.sound || {};
  const instr = Array.isArray(g.instr) ? g.instr.join(", ") : g.instr;
  const lanes = Object.keys(g.kit || {});
  const kit = lanes.length
    ? lanes.map((k) => (DRUMNAME && DRUMNAME[k]) || k).join(", ") : null;
  const tone = g.tone
    ? Object.keys(g.tone).map((k) => k + " " + g.tone[k]).join(", ") : null;
  return tableOf("Sound", [
    row("instruments", instr || null, "genres.js instr"),
    row("the kit", kit, "genres.js kit"),
    row("tone", tone, "genres.js tone"),
    row("synth", g.synth && g.synth.dsp ? g.synth.dsp : null,
      "genres.js synth"),
    row("level", s.level != null ? s.level : null, "doc.sound.level"),
    row("buses", s.buses ? Object.keys(s.buses).map((b) => {
      const v = s.buses[b];
      return b + (v && v.ret ? " ret " + v.ret : "");
    }).join(", ") : null, "doc.sound.buses"),
  ]);
}

function axisPerformance(g, doc) {
  const p = doc.performance || {};
  return tableOf("Performance", [
    row("take", p.take != null ? p.take : null, "doc.performance.take"),
    row("humanize", p.humanize != null ? p.humanize : null,
      "doc.performance.humanize"),
    row("on the grid", p.ontime != null ? String(p.ontime) : null,
      "doc.performance.ontime"),
    row("articulation", g.artic || null, "genres.js artic"),
    row("touch", g.touch != null ? g.touch : null, "genres.js touch"),
    row("stress", g.stress != null ? g.stress : null, "genres.js stress"),
  ]);
}

/* ---------- the lineage, DRAWN AS A FLOW — the panel's hero --------------
   2026-08-30: "give a sense of what leads into what." Ancestors ABOVE — the
   parents table walked recursively up to THREE generations, deduped (a key
   met in a nearer generation does not print again farther up), each
   generation ordered by atlas year — then THIS RECORD as the bold middle
   line, then the children BELOW, also by year. Each line steps one indent
   further down the page behind a `└` connector: marks, not SVG, and the eye
   walks oldest → this record → what it fed. Weights ride small on every
   line. Sibling wants are ONE line at the flow's foot.

   Children are not a field anywhere and must not become one: they are DERIVED
   here by scanning every row's own `parents` table — extraction, so a new
   anchor declaring `blues: .5` appears under blues by existing. A parent that
   is a ROLE (atlas.js EXCLUDE) or that has no atlas row is a NAME and not a
   door: a role says so in TWO WORDS here ("a role") — EXCLUDE's full
   sentence prints verbatim only for an OPEN record that is a role (the
   article section), because printing it once per role parent was the
   repetition being reversed (2026-08-30) — and nothing pretends a record it
   cannot open is tappable. */
function lineage(gk, g, go) {
  const kids = [];
  for (const k of Object.keys(GENRES)) {
    const p = GENRES[k].parents;
    if (p && p[gk] != null) kids.push([k, p[gk]]);
  }
  const yearOf = (k) => NuAtlas.WHEN[k] ? NuAtlas.WHEN[k].year : Infinity;
  kids.sort((a, b) => yearOf(a[0]) - yearOf(b[0]) || (a[0] < b[0] ? -1 : 1));

  /* the generations up: gens[0] = parents, gens[1] = grandparents, … */
  const gens = [];
  const seen = new Set([gk]);
  let cur = Object.keys(g.parents || {}).map((k) => [k, g.parents[k]]);
  for (let d = 0; d < 3 && cur.length; d++) {
    const best = {};   /* two paths to one ancestor keep the heavier edge */
    for (const [k, w] of cur)
      if (!seen.has(k) && (best[k] == null || w > best[k])) best[k] = w;
    const gen = Object.keys(best).map((k) => [k, best[k]])
      .sort((a, b) => yearOf(a[0]) - yearOf(b[0]) || (a[0] < b[0] ? -1 : 1));
    if (!gen.length) break;
    const next = [];
    for (const [k] of gen) {
      seen.add(k);
      const pp = GENRES[k] && GENRES[k].parents;
      if (pp) for (const q of Object.keys(pp)) next.push([q, pp[q]]);
    }
    gens.push(gen);
    cur = next;
  }

  /* one line of the flow. depth 0 is the oldest generation shown; each
     generation nearer the record steps one indent right (`--d`, spent by
     nu.css), behind a `└`. The year rides on the line as data (`data-year`,
     the gate reads the ordering off the artifact) and in INK only when the
     label does not already say it — most anchors are named "Place Year" and
     printing the year twice per line is the repetition being reversed. */
  const flowLine = (k, w, depth, dir) => {
    const rowEl = el("div", null, "nu-xf nu-xkin");
    rowEl.dataset.own = dir === "up" ? "genres.js parents"
      : "derived: GENRES[*].parents";
    rowEl.dataset.dir = dir;
    rowEl.style.setProperty("--d", depth);
    const when = NuAtlas.WHEN[k];
    if (when != null) rowEl.dataset.year = when.year;
    if (depth > 0) rowEl.append(el("span", "└ ", "nu-xtie"));
    const label = (GENRES[k] && GENRES[k].label) || k;
    const y = when && String(when.year);
    const yearInk = y && label.indexOf(y) < 0 ? y + " · " : "";
    if (NuAtlas.EXCLUDE && NuAtlas.EXCLUDE[k]) {
      rowEl.append(el("span", label), el("span", " ·" + w + " — a role",
        "nu-xwt"));
      return rowEl;
    }
    if (!when) {
      rowEl.append(el("span", yearInk + label), el("span", " ·" + w, "nu-xwt"));
      return rowEl;
    }
    const b = el("button", null, "nu-xgo");
    b.type = "button"; b.dataset.gk = k;
    b.append(el("span", yearInk + label), el("span", " ·" + w, "nu-xwt"));
    b.addEventListener("click", () => go(k));
    rowEl.append(b);
    return rowEl;
  };

  const s = el("section", null, "nu-xax nu-xflow");
  s.append(el("h3", "Lineage"));
  const rows = [];
  if (gens.length) {
    /* oldest generation first: gens[last] at depth 0, parents just above
       the record, the record at gens.length, children one step further */
    for (let i = gens.length - 1; i >= 0; i--) {
      const depth = gens.length - 1 - i;
      for (const [k, w] of gens[i]) rows.push(flowLine(k, w, depth, "up"));
    }
  } else {
    const none = el("div", null, "nu-xf");
    none.dataset.own = "genres.js parents";
    none.append(el("b", "parents"), document.createTextNode(
      " none declared — a root (genres.js parents: {})"));
    rows.push(none);
  }
  const meDepth = gens.length;
  const me = el("div", null, "nu-xf nu-xkin nu-xme");
  me.dataset.own = "the open record";
  me.style.setProperty("--d", meDepth);
  const meWhen = NuAtlas.WHEN[gk];
  if (meWhen != null) me.dataset.year = meWhen.year;
  if (meDepth > 0) me.append(el("span", "└ ", "nu-xtie"));
  me.append(el("b", (g.label || gk) + " — this record"));
  rows.push(me);
  for (const [k, w] of kids) rows.push(flowLine(k, w, meDepth + 1, "down"));
  if (Array.isArray(g.wants) && g.wants.length) {
    const owed = el("p", "still owed: " + g.wants.join(", ") +
      " — the missing rungs this row names as debts", "nu-xnote");
    owed.dataset.own = "genres.js wants";
    rows.push(owed);
  }
  s.append(...rows);
  return s;
}

/* ---------- what the box cannot say — the row's own admission, verbatim - */
function cannotOf(g) {
  if (!Array.isArray(g.cannot) || !g.cannot.length) return null;
  const s = el("section", null, "nu-xax nu-xcannot");
  s.append(el("h3", "What the box cannot say"));
  const ul = el("ul");
  for (const c of g.cannot) ul.append(el("li", c));
  const own = el("div", null, "nu-xf");
  own.dataset.own = "genres.js cannot";
  own.append(ul);
  s.append(own);
  return s;
}

/* ---------- the article — wiki.js speaks, or refuses by name ------------ */
function articleOf(gk) {
  const s = el("section", null, "nu-xax");
  s.append(el("h3", "The article"));
  if (NuAtlas.EXCLUDE && NuAtlas.EXCLUDE[gk]) {
    const d = el("div", null, "nu-xf");
    d.dataset.own = "atlas.js EXCLUDE";
    d.append(el("span", "a role has a job, not a history — " +
      NuAtlas.EXCLUDE[gk]));
    s.append(d);
    return s;
  }
  const w = NuWiki && NuWiki.WIKI && NuWiki.WIKI[gk];
  if (w) {
    const d = el("div", null, "nu-xf");
    d.dataset.own = "wiki.js WIKI";
    const a = el("a", w.title.replace(/_/g, " "), "nu-xgo");
    a.href = NuWiki.url(gk); a.target = "_blank"; a.rel = "noopener";
    d.append(a, document.createTextNode(" — " + w.kind + ". " + w.why));
    s.append(d);
    return s;
  }
  const miss = NuWiki && NuWiki.MISSES &&
    NuWiki.MISSES.find((m) => m.key === gk);
  if (miss) {
    const d = el("div", null, "nu-xf");
    d.dataset.own = "wiki.js MISSES";
    d.append(el("span", "no link, on purpose — " + miss.why));
    s.append(d);
    return s;
  }
  return null;
}

/* ---------- before and after — the chronology, one line each ------------ */
function neighboursOf(gk, go) {
  const w = NuAtlas.WHEN[gk];
  if (!w) return null;
  const all = NuAtlas.ALL.slice()
    .sort((a, b) => a.year - b.year || (a.gk < b.gk ? -1 : 1));
  const i = all.findIndex((r) => r.gk === gk);
  if (i < 0) return null;
  const line = (r, wordSide) => {
    if (!r) return null;
    const d = el("div", null, "nu-xf");
    d.dataset.own = "atlas.js WHEN (chronology)";
    const b = el("button",
      wordSide + " — " + ((GENRES[r.gk] && GENRES[r.gk].label) || r.label),
      "nu-xgo");
    b.type = "button"; b.dataset.gk = r.gk;
    b.addEventListener("click", () => go(r.gk));
    d.append(b);
    return d;
  };
  const rows = [line(all[i - 1], "before"), line(all[i + 1], "after")]
    .filter(Boolean);
  if (!rows.length) return null;
  const s = el("section", null, "nu-xax");
  s.append(el("h3", "Before · after"), ...rows);
  return s;
}

/* ---------- the panel, assembled ----------------------------------------
   ORDER (2026-08-30): head, the anchor strip, then the LINEAGE FLOW as the
   hero — "what leads into what" is the first thing the panel says — then
   the article, the eight axis tables, the cannot well, the neighbours. */
function build(panel, doc, go) {
  panel.textContent = "";
  const gk = doc.basis;
  const g = GENRES[gk] || {};
  const head = el("div", null, "nu-xhead");
  const w = NuAtlas.WHEN[gk];
  head.append(el("h2", (g.label || gk)));
  /* the label of nearly every anchor IS "Place Year" — when it is, the sub
     line does not say the place and the year a second time (2026-08-30) */
  const said = w && (g.label === w.place + " " + w.year);
  const sub = [g.family ? "family: " + g.family : null,
               w && !said ? w.place + ", " + w.year : null,
               "key: " + gk].filter(Boolean).join(" · ");
  const subEl = el("p", sub, "nu-xnote");
  subEl.dataset.own = "genres.js label/family · atlas.js WHEN";
  head.append(subEl);
  panel.append(head);

  /* THE ANCHOR STRIP — the eight words as one-tap jumps within the panel
     (2026-08-30: the panel is long; a thumb needs a way down it). Wired to
     the sections AFTER they exist; scrolls the panel itself, never the page
     (the panel is the scroll box). The h3 headings are ALSO sticky (nu.css)
     so mid-panel the reader always sees which axis they are inside — that
     half costs zero height. */
  const jumps = {};
  const nav = el("nav", null, "nu-xnav");
  nav.setAttribute("aria-label", "jump to an axis");
  for (const name of AXES) {
    const b = el("button", name, "nu-xjump");
    b.type = "button";
    b.addEventListener("click", () => {
      const sec = jumps[name];
      if (sec) panel.scrollTop = sec.offsetTop - nav.offsetHeight;
    });
    nav.append(b);
  }
  panel.append(nav);

  panel.append(lineage(gk, g, go));
  const art = articleOf(gk);
  if (art) panel.append(art);
  const parts = [axisTime, axisAlphabet, axisMaterial, axisForm,
                 axisDevelopment, axisCast, axisSound, axisPerformance];
  AXES.forEach((name, i) => {
    let s = parts[i](g, doc);
    if (!s) {
      /* an axis with nothing to say still keeps its heading — the eight are
         the organizing vocabulary, and a heading that vanished would teach a
         seven-axis model (the exact mistake AXES.md exists to stop) — but it
         gets one honest sentence, never an empty frame */
      s = el("section", null, "nu-xax");
      s.append(el("h3", name),
        el("p", "nothing stated — the defaults carry it", "nu-xnote"));
    }
    jumps[name] = s;
    panel.append(s);
  });
  const cant = cannotOf(g);
  if (cant) panel.append(cant);
  const near = neighboursOf(gk, go);
  if (near) panel.append(near);
}

/* ---------- the mark and its door ---------------------------------------
   ctx = { doc: () => DOC, atlas: () => ATLAS } — two getters, read at press
   time and never captured, because both are ui/eight.js module state that a
   document swap replaces. */
export function makeExplain(ctx) {
  let panel = null, isOpen = false;

  /* THE ATLAS DOOR, THE SAME SEAM THE GENRE LIST ROWS USE. A list row's tap is
     openRow: the record's own year onto the slider, then the place — and
     `open()` is that gesture as an API: `recordAt(place, year)` returns
     exactly the row (verified over the whole WHEN table in ui/atlas.js), the
     seed is kept at the reading the bar already prints, and the swap goes
     through ctx.setDocument like every other arrival. No second compose path
     is invented here. */
  const go = (gk) => {
    const A = ctx.atlas && ctx.atlas();
    const w = NuAtlas.WHEN[gk];
    if (!A || !w) return false;
    const r = A.open({ at: w.place, y: w.year, s: A.reading() });
    if (r === true && isOpen && panel) build(panel, ctx.doc(), go);
    return r === true;
  };

  const btn = icon({ k: "explain", glyph: "?", word: "explain",
    say: "every aspect of this record's genre — the eight axes, its " +
         "lineage, and what the box admits it cannot say" });
  btn.id = "explain";
  btn.setAttribute("aria-controls", "nu-explain");
  btn.setAttribute("aria-expanded", "false");

  const set = (open) => {
    isOpen = !!open;
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (isOpen) {
      if (!panel) {
        /* built on the first press, not at boot — a page that never opens it
           never pays for it, and the text diet never counts a panel that is
           not in the document. OUTSIDE #app, last in <body>, position: fixed
           (nu.css): the three reasons #nu-log ships where it does. */
        panel = el("div", null, "nu-explain");
        panel.id = "nu-explain";
        panel.setAttribute("aria-label", "the record, explained");
        panel.hidden = true;
        document.body.append(panel);
      }
      build(panel, ctx.doc(), go);
      panel.hidden = false;
    } else if (panel) {
      panel.hidden = true;
      panel.textContent = "";
    }
  };

  btn.addEventListener("click", () => set(!isOpen));
  /* Escape closes, exactly as it closes the log and the say popover. */
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) set(false);
  });

  return { btn, set, open: () => isOpen };
}
