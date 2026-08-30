// nukernel/ui/explain.js — THE ? MARK AND THE PAGE IT OPENS.
//
// Paul, 2026-08-30: *"add a ? Icon above the log icon that fully explains
// every aspect of a genre."*
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

/* one fact: a <div class="nu-xf"> with the NAME, the VALUE, and the OWNER on
   `data-own` — the owner stamped on the artifact rather than promised in a
   comment, so the report's "what each section reads from" is readable off the
   rendered page. A null/empty value is a fact the tables do not carry for
   this record, and it is DROPPED rather than printed as a blank: a silent
   empty cell is the grey this page's laws forbid. */
const fact = (name, value, own) => {
  if (value == null || value === "") return null;
  const d = el("div", null, "nu-xf");
  d.dataset.own = own;
  /* a table value that is itself a table (an orn map, a stress shape) is
     printed as its own JSON — verbatim data, never a prose paraphrase and
     never "[object Object]" */
  const word = typeof value === "object" ? JSON.stringify(value) : String(value);
  d.append(el("b", name), document.createTextNode(" "), el("span", word));
  return d;
};

const section = (head, kids) => {
  const rows = kids.filter(Boolean);
  if (!rows.length) return null;
  const s = el("section", null, "nu-xax");
  const h = el("h3", head);
  s.append(h, ...rows);
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

/* ---------- the eight sections, each an extraction ---------------------- */

function axisTime(g, doc) {
  const t = doc.time || {};
  return section("Time", [
    fact("tempo", t.bpm != null ? t.bpm + " bpm" : null, "doc.time.bpm"),
    t.bpm !== g.bpm ? fact("the row's tempo",
      g.bpm != null ? g.bpm + " bpm" : null, "genres.js bpm") : null,
    fact("rate", t.rate != null ? "×" + t.rate
      : g.rate != null ? "×" + g.rate + " (the row's)" : null,
      t.rate != null ? "doc.time.rate" : "genres.js rate"),
    fact("meter", t.meter || g.meter || null,
      t.meter ? "doc.time.meter" : "genres.js meter"),
    fact("swing", t.swing != null ? t.swing : g.swing != null ? g.swing : null,
      t.swing != null ? "doc.time.swing" : "genres.js swing"),
    fact("period", g.period || null, "genres.js period"),
  ]);
}

function axisAlphabet(g, doc) {
  const a = doc.alphabet || {};
  const gm = nameOf(MODES, g.mode), gs = nameOf(SCALES, g.scale);
  return section("Alphabet", [
    fact("key", a.key != null ? (KEYLABEL[String(a.key)] || a.key) : null,
      "doc.alphabet.key"),
    fact("mode", a.mode ? (MODELABEL[a.mode] || a.mode)
      : gm ? (MODELABEL[gm] || gm) : null,
      a.mode ? "doc.alphabet.mode" : "genres.js mode"),
    fact("the subject's scale", gs ? (SCALELABEL[gs] || gs) : null,
      "genres.js scale"),
    fact("harmony", a.harmony || g.harmony || null,
      a.harmony ? "doc.alphabet.harmony" : "genres.js harmony"),
    fact("the changes", progWord(a.prog), "doc.alphabet.prog"),
  ]);
}

function axisMaterial(g, doc) {
  const cells = (doc.material && doc.material.cells) || {};
  const names = Object.keys(cells);
  const rows = names.map((n) => {
    const c = cells[n] || {};
    const drum = c.kind === "drum";
    const steps = drum ? 16 : (c.deg || c.play || []).length || 16;
    return fact(n, (drum ? "a drum grid" : "a line") + ", " + steps + " steps",
      "doc.material.cells." + n);
  });
  if (!rows.length)
    /* AXES.md's own ruling, not this file's: "Motifs are optional. … Melody
       is a LAYER, not a prerequisite." Quoted, because an empty section with
       no sentence would read as a bug rather than as half the catalog. */
    rows.push(fact("cells", "none — “melody is a LAYER, not a prerequisite”" +
      " (AXES.md)", "AXES.md"));
  return section("Material", rows);
}

function axisForm(g, doc) {
  const secs = (doc.form && doc.form.sections) || [];
  const rows = secs.map((s, i) =>
    fact(String(i + 1) + " · " + (s.role || s.id),
      (s.bars != null ? s.bars + " bars" : "") , "doc.form.sections"));
  return section("Form", [
    fact("plan", g.plan || null, "genres.js plan"),
    fact("intro", g.intro || null, "genres.js intro"),
    fact("outro", g.outro || null, "genres.js outro"),
    ...rows,
  ]);
}

function axisDevelopment(g, doc) {
  const secs = (doc.form && doc.form.sections) || [];
  const voices = doc.voices || [];
  const rows = voices.map((v) => {
    const dev = v.development || {};
    const line = secs.map((s) => dev[s.id] || "as written").join(" · ");
    return fact(v.name || "voice", line, "doc.voices[].development");
  });
  const words = (g.words || []).map((w) =>
    fact("the row says", "“" + w + "”", "genres.js words"));
  return section("Development", [...words, ...rows]);
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
    return fact(v.name || "voice", bits, "doc.voices[]");
  });
  return section("Cast", [
    fact("the row seats", g.voices != null ? g.voices +
      (g.voices === 1 ? " voice" : " voices") : null, "genres.js voices"),
    g.instrumental ? fact("instrumental", "declared by the row — no chair " +
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
  return section("Sound", [
    fact("instruments", instr || null, "genres.js instr"),
    fact("the kit", kit, "genres.js kit"),
    fact("tone", tone, "genres.js tone"),
    fact("synth", g.synth && g.synth.dsp ? g.synth.dsp : null,
      "genres.js synth"),
    fact("level", s.level != null ? s.level : null, "doc.sound.level"),
    fact("buses", s.buses ? Object.keys(s.buses).map((b) => {
      const v = s.buses[b];
      return b + (v && v.ret ? " ret " + v.ret : "");
    }).join(", ") : null, "doc.sound.buses"),
  ]);
}

function axisPerformance(g, doc) {
  const p = doc.performance || {};
  return section("Performance", [
    fact("take", p.take != null ? p.take : null, "doc.performance.take"),
    fact("humanize", p.humanize != null ? p.humanize : null,
      "doc.performance.humanize"),
    fact("on the grid", p.ontime != null ? String(p.ontime) : null,
      "doc.performance.ontime"),
    fact("articulation", g.artic || null, "genres.js artic"),
    fact("touch", g.touch != null ? g.touch : null, "genres.js touch"),
    fact("stress", g.stress != null ? g.stress : null, "genres.js stress"),
  ]);
}

/* ---------- the lineage, DRAWN — parents up, children down --------------
   Children are not a field anywhere and must not become one: they are DERIVED
   here by scanning every row's own `parents` table — extraction, so a new
   anchor declaring `blues: .5` appears under blues by existing. A parent that
   is a ROLE (atlas.js EXCLUDE) or that has no atlas row is a NAME and not a
   door: a role gets EXCLUDE's own sentence, and nothing pretends a record it
   cannot open is tappable. */
function lineage(gk, g, go) {
  const kids = [];
  for (const k of Object.keys(GENRES)) {
    const p = GENRES[k].parents;
    if (p && p[gk] != null) kids.push([k, p[gk]]);
  }
  kids.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const ups = Object.keys(g.parents || {})
    .map((k) => [k, g.parents[k]])
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));

  const gline = (k, w, dir) => {
    const row = el("div", null, "nu-xf nu-xkin");
    row.dataset.own = dir === "up" ? "genres.js parents"
      : "derived: GENRES[*].parents";
    const label = (GENRES[k] && GENRES[k].label) || k;
    const wt = " ·" + w;
    if (NuAtlas.EXCLUDE && NuAtlas.EXCLUDE[k]) {
      /* a role has a job, not a history — EXCLUDE's own sentence, verbatim */
      row.append(el("span", label + wt + " — a role has a job, not a " +
        "history: " + NuAtlas.EXCLUDE[k]));
      return row;
    }
    if (!NuAtlas.WHEN[k]) { row.append(el("span", label + wt)); return row; }
    const b = el("button", label + wt, "nu-xgo");
    b.type = "button"; b.dataset.gk = k;
    b.addEventListener("click", () => go(k));
    row.append(b);
    return row;
  };

  const rows = [];
  if (ups.length)
    rows.push(el("p", "parents — what this row declares it is made of:",
      "nu-xnote"), ...ups.map(([k, w]) => gline(k, w, "up")));
  else
    rows.push(fact("parents", "none declared — a root (genres.js parents: {})",
      "genres.js parents"));
  if (kids.length)
    rows.push(el("p", "children — every row that declares this one:",
      "nu-xnote"), ...kids.map(([k, w]) => gline(k, w, "down")));
  if (Array.isArray(g.wants) && g.wants.length)
    rows.push(fact("wants", g.wants.join(", ") +
      " — the missing rungs this row names as debts", "genres.js wants"));
  const s = el("section", null, "nu-xax");
  s.append(el("h3", "Lineage"), ...rows);
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
  const line = (r, word) => {
    if (!r) return null;
    const d = el("div", null, "nu-xf");
    d.dataset.own = "atlas.js WHEN (chronology)";
    const b = el("button",
      word + " — " + ((GENRES[r.gk] && GENRES[r.gk].label) || r.label),
      "nu-xgo");
    b.type = "button"; b.dataset.gk = r.gk;
    b.addEventListener("click", () => go(r.gk));
    d.append(b);
    return d;
  };
  return section("Before · after",
    [line(all[i - 1], "before"), line(all[i + 1], "after")]);
}

/* ---------- the panel, assembled ---------------------------------------- */
function build(panel, doc, go) {
  panel.textContent = "";
  const gk = doc.basis;
  const g = GENRES[gk] || {};
  const head = el("div", null, "nu-xhead");
  const w = NuAtlas.WHEN[gk];
  head.append(el("h2", (g.label || gk)));
  const sub = [g.family ? "family: " + g.family : null,
               w ? w.place + ", " + w.year : null,
               "key: " + gk].filter(Boolean).join(" · ");
  const subEl = el("p", sub, "nu-xnote");
  subEl.dataset.own = "genres.js label/family · atlas.js WHEN";
  head.append(subEl);
  panel.append(head);
  const art = articleOf(gk);
  if (art) panel.append(art);
  const parts = [axisTime, axisAlphabet, axisMaterial, axisForm,
                 axisDevelopment, axisCast, axisSound, axisPerformance];
  AXES.forEach((name, i) => {
    const s = parts[i](g, doc);
    if (s) panel.append(s);
    else {
      /* an axis with nothing to say still keeps its heading — the eight are
         the organizing vocabulary, and a heading that vanished would teach a
         seven-axis model (the exact mistake AXES.md exists to stop) */
      const empty = el("section", null, "nu-xax");
      empty.append(el("h3", name),
        el("p", "nothing stated — the defaults carry it", "nu-xnote"));
      panel.append(empty);
    }
  });
  panel.append(lineage(gk, g, go));
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
