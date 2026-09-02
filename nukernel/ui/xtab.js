// nukernel/ui/xtab.js — THE READ HALF OF A GENRE, SHARED BY TWO PANELS
// (2026-09-02, the composer round, slice 2b).
//
// WHY THIS FILE EXISTS. `ui/explain.js` was built on 2026-08-30 and reversed
// the same day — Paul: *"The question mark icon produces tons of stuff but
// it's hard to parse. It should be in tables and give a sense of what leads
// into what."* — and what came out of that reversal is a small vocabulary for
// saying a fact about a genre on a page: `row` (one fact, one line, and an
// empty fact is an OMITTED row rather than a dash), `pair` (a fact the genre
// row and the record both speak to, printed ONCE when they agree), `tableOf`
// (one axis, one table, `data-own` on every `<tr>`), `nameOf` (an array named
// back to the table that owns it, never a copied word list), `progWord` (the
// changes in the numerals the Key panel already speaks) and `lineage` (the
// hero: three generations up off `parents`, the record, and the children
// DERIVED by scanning every row's `parents`).
//
// The Rules view (`ui/rules.js`, 2026-09-02) is that same read half with its
// values replaced by controls, and it needs the name and the lineage. Paul's
// sentence for the Rules panel — *"The name of the genre should be obvious"* —
// is answered by a plate carrying exactly what `lineage` derives, so the
// choice was: copy six helpers into a second view, or move them under a name
// both views import. THE CONVERSION IS DONE BY EXTRACTION, NEVER BY HAND
// (2026-08-23) governs a data table and it governs this too: a second copy of
// `lineage`'s child-scan is a second thing to keep in step with `parents`.
//
// NOTHING HERE CHANGED IN THE MOVE. Every function below is `ui/explain.js`'s
// own, verbatim, with its own argument still attached; what is new is
// `kinOf`, which is the derivation `lineage` was already making, LIFTED so a
// caller that wants one line rather than a flow does not re-derive it.
// `ui/explain.js` imports these back and holds no second definition.
//
// `--vh`, `--d`, `.nu-xax`, `.nu-xtab`, `.nu-xf` and the rest of the classes
// are nu.css's, unchanged and un-renamed: this is a MOVE and not a redesign.

import { GENRES, ROMAN, NuAtlas, NuRules } from "./deps.js";

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
/* ONE TABLE, 2026-09-02. The literal that stood here —
     ["Time","Alphabet","Material","Form","Development","Cast","Sound","Performance"]
   — was the second copy of the eight words (nukernel/rules.js AXES is the
   first, and it throws by name at load on a row claiming a ninth axis), and
   two copies of a list is how they drift. The comment above still says "no
   table exports these eight words"; a table does now, and this reads it. */
const AXES = NuRules.AXES;

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

/* ---------- kinOf: the derivation, without the drawing (2026-09-02) ------
   `lineage` below walks three generations up and scans the whole catalogue
   down. A name plate wants ONE line — "out of rocksteady and ska; into dub" —
   and re-deriving that beside it would be a second reader of `parents` to
   keep in step. So the derivation is here, once, and `lineage` uses it for
   its own first generation and its children.

   The children are NOT a field and must not become one (ui/explain.js's own
   sentence, kept with the code): they are extracted by scanning every row's
   `parents`, so a new anchor declaring `blues: .5` appears under blues by
   existing. Both lists come back ordered by atlas year, the way the flow
   orders them, so a caller printing one line prints it in time order. */
const yearOf = (k) => (NuAtlas.WHEN[k] ? NuAtlas.WHEN[k].year : Infinity);
const byYear = (a, b) => yearOf(a[0]) - yearOf(b[0]) || (a[0] < b[0] ? -1 : 1);
export function kinOf(gk, g) {
  const row = g || GENRES[gk] || {};
  const parents = Object.keys(row.parents || {})
    .map((k) => [k, row.parents[k]]).sort(byYear);
  const kids = [];
  for (const k of Object.keys(GENRES)) {
    const p = GENRES[k].parents;
    if (p && p[gk] != null) kids.push([k, p[gk]]);
  }
  kids.sort(byYear);
  return { parents, kids, yearOf };
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
  /* THE CHILD SCAN AND THE YEAR ORDER ARE `kinOf`'s NOW (2026-09-02) — the
     same seven lines that stood here, moved up so the Rules plate reads them
     rather than writing them again. Nothing about the drawing changed. */
  const { kids, parents, yearOf } = kinOf(gk, g);

  /* the generations up: gens[0] = parents, gens[1] = grandparents, … */
  const gens = [];
  const seen = new Set([gk]);
  let cur = parents;
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

/* ---------- what the two panels import ----------------------------------
   `el` and `word` ride along because every one of the six above returns or
   builds with them and a caller holding a `row` has to be able to make one. */
export { el, word, AXES, nameOf, row, pair, tableOf, progWord, lineage };
