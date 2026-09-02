// nukernel/ui/rules.js — THE GENRE, AS SENTENCES YOU CAN EDIT
// (2026-09-02, the composer round, slice 2b).
//
// Paul, 2026-09-01, B6: *"I click the genre, it starts to play, and there's a
// new view: A genre editor appears. This is the 'Rules' section; it'll need a
// new icon in the left nav. The genre data is expressed as logical sentences
// and rules derived from the data in the genre. They should be readable to a
// musician. You can edit them, add new rules from a palette, and set
// thresholds. It's a code-editing experience but it feels like simple
// sentences. The motifs don't need to be editable. Just the structural rules.
// The name of the genre should be obvious."*
//
// WHAT THIS FILE IS. The DRAWING half, and only that. What a rule IS, how it
// reads in English, what may be written into it, where the write lands and why
// it is meaningless on a particular row are all `nukernel/rules.js`'s — a data
// table in the same language as `askable.js` and `avail.js SHEETS` — and this
// file asks it four questions and nothing else:
//
//   NuRules.say(row, gk)        every rule, as sentence PARTS, on this record
//   NuRules.motifs(row, gk)     the vectors that are NOT rules, with the reason
//   NuRules.offerable(gk, row)  the palette: what this row does not yet declare
//   NuRules.applyRules(row, r)  the genre row a hand's edits resolve to
//
// so the two files can be wrong in only one place each. Every option list, the
// tier words, the refusals and the greying reasons come out of that call —
// there is not one word of the catalogue's vocabulary typed here.
//
// ---- HOW A SENTENCE BECOMES A CONTROL --------------------------------------
// A rule's `say` returns an array of parts: `{w}` is a word and `{w, v, slot}`
// is THE VALUE. The obvious drawing is "print the words, put a widget where the
// slot is" and it is refused, for a reason that is measured rather than
// aesthetic: `test/text-diet.test.js` counts every text node on the rendered
// page that is not a control label, a value or a refusal, against a ceiling of
// 1169 characters for the WHOLE box. Thirty-eight sentences of loose prose in
// one panel is about a thousand characters and the panel would have eaten the
// diet on its own.
//
// So the sentence IS the label, with the value ELIDED — `.nu-w` reads "the
// tempo is … beats a minute" and the control under it holds the 76. Three
// things fall out of that and all three are why it is the right drawing and
// not merely the cheap one: the words are inside a `<label>`, so a screen
// reader announces the whole sentence as the control's name; the row is a
// `.nu-field`, so it is the same 88px as every other question on the page
// (Paul: *"things are uneven based on how text wraps"*); and the answer sits
// on its own line where a menu can be 30ch wide without shoving the question.
// A row with nothing but a slot ("the record may be sung") has no words to
// elide, so it falls back to the rule's own `head`.
//
// ---- FOUR SHAPES OF ROW, AND THE SHAPE IS READ OFF `edit`, NEVER OFF A NAME -
//   number / enum / flag / pair  ONE label, the elided sentence, one or two
//                                controls on line two.
//   map                          a heading and one control per KEY the row's
//                                own plan owns (`edit.keys`).
//   list with a `count`          POSITIONAL — one menu per chair, because
//                                `part` and `instr` are indexed by voice and a
//                                row of checkboxes cannot say "voice 0 holds a
//                                guitar and voice 1 holds a guitar".
//   list with a `max`            A SET — checkboxes, because `fx` is the one
//                                place on this page more than one answer is
//                                allowed (test/selects.js's own exception).
//   changes                      SAID, not edited: the chord grid is the Key
//                                panel's, one chord at a time, and two panels
//                                owning `alphabet.prog` is the duplicate-owner
//                                bug this round's laws exist to stop.
//
// ---- WHERE AN EDIT LANDS ---------------------------------------------------
// `doc.rules = [{f, v}]` and then the tier the ROW declares — never a switch
// here. `compose` re-runs `genreToDocument(basis, reading, rules)` and lands it
// through `ctx.setDocument` (restarting the transport if it was running),
// `render` writes the list and calls `ctx.changed()` (`document.js toGenre`
// spreads the resolved row under the document on the next frame), `row` moves
// nothing that plays. The tier's own WORD is printed on every row before you
// press it, which is the whole of what "it's a code-editing experience" has to
// mean on a page that is playing while you edit.
//
// GENRES IS NEVER MUTATED. `applyRules` copies (rules.js §5), so share links
// and `test/precompose.test.js` G6a's purity sweep both stand; the gate
// `test/rules-view.browser.js` re-reads the whole catalogue after driving the
// panel and asserts it byte-for-byte.

import { GENRES, NuWiki, NuRules, NuPrecompose } from "./deps.js";
import { selectField } from "./selects.js";
import { el, kinOf } from "./xtab.js";

/* ---------- the three-liner every view in this directory carries ---------- */
const txt = (s) => document.createTextNode(String(s));

/* THE SENTENCE AS A LABEL. The value is elided to a `…` so the words read as a
   sentence with a hole in it and the control under them fills it. A row whose
   sentence is ENTIRELY its value has no hole to leave, so it takes the rule's
   own head — the two or three words `nukernel/rules.js` already keeps for
   exactly this (`head: "singing"`, `head: "the chips"`). */
const HOLE = "…";
function sayLabel(r) {
  const s = r.parts.map((p) => (p.slot ? HOLE : p.w)).join("")
    .replace(/\s+/g, " ").trim();
  return /[a-z0-9]/i.test(s.split(HOLE).join("")) ? s : r.head;
}
/* the whole sentence with its values IN, for the rows that are said and not
   edited — a refusal prints what it is refusing */
const sayFlat = (r) => r.parts.map((p) => p.w).join("").replace(/\s+/g, " ").trim();

const slotsOf = (r) => r.parts.filter((p) => p.slot);

export function mountRules(host, ctx) {
  const doc = ctx.doc();
  const gk = doc.basis;
  const base = GENRES[gk];
  const ax = ctx.section(host, "ax-rules", "The rules");
  if (!base) {
    /* THROW BY NAME is `precompose.js`'s law for a caller that asks for an
       anchor that is not there; a VIEW cannot throw at draw time without
       taking the page with it, so it refuses in the one way this page allows —
       visibly, with the reason. */
    ax.append(el("p", "no anchor “" + gk + "” — this record was " +
      "composed by a build that had one", "nu-why"));
    return () => {};
  }

  /* THE ROW A HAND IS LOOKING AT is the catalogue's row with this record's own
     rules resolved onto it — never `GENRES[gk]` raw, or every sentence would
     print the anchor as written and the edit you just made would be invisible
     in the sentence that made it. */
  const rules = () => (ctx.doc().rules || []);
  const declared = (f) => rules().some((e) => e.f === f);
  let row = base;
  try { row = NuRules.applyRules(base, rules()); }
  catch (e) { row = base; }   /* a stranger's field: song.js drops it at the door */

  /* ---------- the name plate (B6: "the name of the genre should be obvious")
     Three facts, each read off the table that owns it and none of them typed
     here: the WIKI title (or the key, when no article is claimed), the row's
     own `label` — which is "Place Year" by the atlas's own regex — and ONE
     line of lineage off `ui/xtab.js kinOf`, which is `ui/explain.js`'s own
     derivation moved rather than copied (children are DERIVED by scanning
     every row's `parents`, never a field). It is an `<h3>`, so the diet skips
     it the way it skips every other heading, and `.nu-namebar` is the ink
     plate the rest of the page gives a name. */
  const wiki = NuWiki && NuWiki.WIKI ? NuWiki.WIKI[gk] : null;
  const plate = el("h3", null, "nu-namebar nu-ruleplate");
  plate.dataset.k = "rules.name";
  /* THE WORD IS THE ARTICLE'S TITLE, ELSE THE ROW'S OWN LABEL, ELSE THE KEY
     (2026-09-02, the probe: the blank state read "silence · Silence" — the key
     in one spelling and the label in another). And the sub is dropped when it
     would only say the word again. ui/eight.js nameRecord carries the same
     rule for the foot plate; the two must agree. */
  const word = wiki ? String(wiki.title).replace(/_/g, " ") : (base.label || gk);
  plate.append(el("b", word));
  if (base.label && base.label !== word) plate.append(el("small", " · " + base.label));
  const kin = kinOf(gk, base);
  const kinWords = [];
  if (kin.parents.length)
    kinWords.push("out of " + kin.parents.map((p) => p[0]).join(", "));
  if (kin.kids.length)
    kinWords.push("into " + kin.kids.slice(0, 4).map((p) => p[0]).join(", ") +
      (kin.kids.length > 4 ? " +" + (kin.kids.length - 4) : ""));
  if (kinWords.length)
    plate.append(el("small", kinWords.join(" · "), "nu-rulekin"));
  ax.append(plate);

  /* ================= WHERE AN EDIT LANDS ==================================
     One door, three tiers, and the tier is the ROW's fact and not this
     function's opinion (`nukernel/rules.js` TIERS). */
  function apply(next, tier) {
    const d = ctx.doc();
    if (tier === "compose") {
      /* THE RECORD IS WRITTEN AGAIN AT THIS SEED. `ctx.reading()` is
         ui/atlas.js's `reading()` — the one owner of the seed — so an edit
         lands on the record you are looking at rather than on reading 1.
         The transport is restarted only if it was RUNNING: `setDocument`
         stops it (it is the one door and it always has), and a panel that
         started the music on a record that was silent would be a control with
         a side effect nobody asked for. */
      const was = ctx.transport().playing;
      const nd = NuPrecompose.genreToDocument(d.basis, ctx.reading(),
        next.length ? next : null);
      ctx.setDocument(nd);
      if (was) ctx.play();
      return;
    }
    if (next.length) d.rules = next.map((e) => ({ f: e.f, v: e.v }));
    else delete d.rules;
    /* `render` reaches the kernel through `document.js toGenre`, which spreads
       the resolved genre row under the document's own overrides — no recompile
       and no new record, which is exactly what the tier word promises. `row`
       moves nothing that plays and only wants the panel drawn again. */
    if (tier === "render") ctx.changed(); else ctx.redraw();
  }
  const land = (f, v) => apply(
    [...rules().filter((e) => e.f !== f), { f, v }], NuRules.tierOf(f));
  const drop = (f) => apply(rules().filter((e) => e.f !== f), NuRules.tierOf(f));

  /* ================= THE CONTROLS =========================================
     TWO SPELLINGS OF ONE ADDRESS, and the difference is which gate reads it
     back. A `<select>` is addressed by `data-sel` — ui/selects.js stamps
     `data-k = "sel|" + key` off it and puts focus back there after every
     `draw()` — so a menu's key is DOTTED, `rule.bpm`, the way every other
     `data-sel` on this page is dotted. Everything a hand touches that is not a
     menu — a range, a checkbox, the reset — carries its own `data-k`, and
     those are BARRED, `rule|bpm`, the way every other `data-k` is. Neither
     collides with an avail.js sheet key: `rule.` is a namespace no sheet has.
     An address does not move once it is written down.

     AND TWO OF THEM CARRY AN INDEX, WHICH PROGRAM.md §2.2 FORBIDS — "every
     control carries a unique, NEVER index-keyed `dataset.k`". The rule is
     about a key that is an ORDINAL INTO A LIST THAT CAN REORDER, because
     focus is put back by `data-k` after every rebuild and a reordered list
     puts your thumb on somebody else's control. `part` and `instr` are indexed
     BY CHAIR — `precompose.js:2500` reads `G.part[v]` for voice `v` — so the
     number in `rule.instr.1` is not a position in a list, it is the second
     chair, which is the fact the control is about and cannot move without the
     record changing. (`prog0d` in the Key panel is the same argument, made by
     the same page, about a bar of the changes.) */
  const K = (f, ...rest) => ["rule", f, ...rest].join("|");
  const SEL = (f, ...rest) => ["rule", f, ...rest].join(".");
  /* a genre row states one instrument or a list of them, and the LAST covers
     the rest (instruments.js instrOf) — so a positional menu reads through
     that rule rather than showing an empty answer on chair 3 */
  const asList = (v) => (Array.isArray(v) ? v.slice() : v == null ? [] : [v]);
  const atIndex = (cur, i) => (cur[i] == null
    ? (cur.length ? cur[cur.length - 1] : "") : cur[i]);

  /* a range with its readout, the two-event discipline every slider on this
     page keeps: `input` moves the number under your finger, `change` commits.
     (ui/eight.js `range()` is the same eight lines and is module-private to a
     13,000-line file; ui/engineer.js builds its own for the same reason. What
     may NOT be duplicated is a fact — this duplicates a widget.) */
  function rangeInto(lab, key, aria, value, edit, set, why) {
    const r = document.createElement("input");
    r.type = "range";
    r.min = String(edit.min); r.max = String(edit.max);
    r.step = String(edit.step == null ? 1 : edit.step);
    r.value = String(value);
    r.dataset.k = key;
    r.setAttribute("aria-label", why ? aria + ", " + why : aria);
    const out = el("output", String(value));
    if (why) { r.disabled = true; r.setAttribute("aria-disabled", "true");
               r.dataset.why = why; }
    r.addEventListener("input", () => { out.textContent = r.value; });
    r.addEventListener("change", () => set(+r.value));
    lab.append(r, txt(" "), out);
    return r;
  }

  /* ONE MENU, drawn by ui/selects.js and by nothing else — `.nu-combo`, the
     seated/said detent, the >24-option filter and the NO SILENT GREY throw all
     come with it. `spec.why` is what refuses the whole control and prints the
     reason where a sighted reader and a gate can both have it. */
  const menu = (parent, key, label, options, value, set, why) =>
    selectField(parent, { key, label, options, value,
                          why: why || null, ungated: true,
                          set: (v) => set(v) });

  /* ---------- the option lists, all four of them off `edit` --------------- */
  const enumOpts = (r) => (r.edit.values ? r.edit.values(row, gk) : [])
    .map((o) => ({ value: o.value == null ? "" : o.value, label: o.label }));
  /* A FLAG'S TWO WORDS ARE THE ROW'S OWN, ASKED FOR RATHER THAN TYPED. The
     sentence for `diatonic` is "the line follows the chords" at false and "the
     line stays in the key" at true, and both are in `nukernel/rules.js` — so
     the menu is built by SAYING the rule twice, once with each value, and
     keeping the slot word. Two booleans' English is never written here, which
     means a re-worded sentence re-words the menu by existing. */
  function flagOpts(r) {
    const R = NuRules.byField[r.field];
    const wordAt = (v) => {
      try {
        const alt = NuRules.applyRules(row, [{ f: r.field, v }]);
        const s = R.say(alt, gk).find((p) => p.slot);
        return s ? s.w : String(v);
      } catch (e) { return String(v); }
    };
    return [{ value: "", label: wordAt(false) },
            { value: "1", label: wordAt(true) }];
  }

  /* ---------- what a rule the row does not declare starts life as --------
     "the current genre value, or the table's first word" — and the first word
     is the first one that SAYS something: a leading `{value: null}` option is
     how a table spells "the row is silent about this", and an added rule whose
     value is the silence is a rule that did not arrive. */
  function firstWord(r) {
    const os = enumOpts(r);
    const said = os.find((o) => o.value !== "" && o.value != null);
    return said ? said.value : (os[0] ? os[0].value : null);
  }
  function startAt(r) {
    const e = r.edit, s = slotsOf(r)[0];
    /* THE ROW'S OWN DERIVED VALUE FIRST (2026-09-02, the fix round). A rule
       added from the palette used to open at `e.min` whenever the sentence had
       no number in it, and wave 2 measured what that meant: "maxHold 1, swing
       0" — a legato record whose notes already hold eight steps offering "no
       note holds longer than 1 step", which is a control that rewrites the
       record the instant it is added and the opposite of avail.js:15's law
       that you can always see the value you are on. Where the code DERIVES a
       value for an absent field, `nukernel/rules.js` says so on the row
       (`edit.start(g, gk, doc)` — `capOf` for maxHold, the document's own
       swing word read back through SWINGS) and this asks it. One owner: the
       derivation is the data tier's, never this file's. */
    if (typeof e.start === "function") {
      try { const v = e.start(row, gk, ctx.doc());
            if (v != null && !(typeof v === "number" && !isFinite(v))) return v; }
      catch (err) { /* a derivation that throws falls through to the sentence */ }
    }
    if (e.kind === "number") {
      if (typeof s?.v === "number" && isFinite(s.v)) return s.v;
      const n = s ? Number(s.w) : NaN;      /* "give or take 4" says its default */
      return isFinite(n) ? n : e.min;
    }
    if (e.kind === "enum") return firstWord(r) === "" ? null : firstWord(r);
    if (e.kind === "flag") return true;
    if (e.kind === "pair") { const o = {};
      for (const k of e.keys) o[k] = e.min; return o; }
    if (e.kind === "map") {
      const pre = e.presets ? e.presets().filter((o) => o.value != null) : [];
      if (pre.length) return pre[0].value;
      const ks = e.keys ? e.keys(row, gk) : [];
      const vs = e.values ? e.values(row, gk) : [];
      return ks.length && vs.length ? { [ks[0]]: vs[0].value } : {};
    }
    if (e.kind === "list") {
      const vs = e.values ? e.values(row, gk) : [];
      const one = vs.length ? vs[0].value : null;
      if (e.count) { const n = e.count(row, gk) || 1;
                     return Array.from({ length: n }, () => one); }
      return one == null ? [] : [one];
    }
    return null;
  }

  /* ================= ONE ROW ============================================== */
  function ruleRow(parent, r, major) {
    const div = el("div", null, "nu-rule");
    div.dataset.rule = r.field;
    /* THE TIER IS ON EVERY ROW AS DATA AND ON ALMOST NONE AS WORDS
       (2026-09-02) — see `tierInto` for the measurement that moved it. */
    div.dataset.tier = r.rederive;
    const e = r.edit;
    const why = r.why || null;

    /* SAID, NOT EDITED — and the refusal prints the sentence it is refusing,
       joined with its reason, in ONE `.nu-why`. That is a refusal-with-a-
       reason, which is one of the three kinds of word the diet allows, and it
       is also the only honest shape for a fact a musician should be able to
       READ (the figure arches, the chairs come in at bar 4) that has no row
       for a write to land on. */
    if (!e || e.kind === "changes") {
      const said = sayFlat(r) + (why ? " — " + why : e && e.kind === "changes"
        ? " — the chord grid is the Key panel's, one bar at a time"
        : "");
      div.append(el("p", said, "nu-why"));
      if (declared(r.field)) resetInto(div, r);
      parent.append(div);
      return;
    }

    if (e.kind === "map" || e.kind === "list") {
      /* A HEADING AND THEN ONE CONTROL PER KEY. The sentence is an `<h4>`
         because it names the group of controls under it — and because a
         heading is a label, which is what keeps it out of the diet's count
         the same way every other heading on this page is. */
      div.append(el("h4", sayFlat(r), "nu-rulehead"));
      (e.kind === "map" ? mapFields : listFields)(div, r);
    } else {
      const lab = el("label");
      lab.append(el("span", sayLabel(r), "nu-w"));
      simpleControl(lab, r);
      /* BOTH CLASS NAMES, AND NEITHER IS DECORATION. nu.css states the even
         88px row as `.nu-sel > label, .nu-field > label` — one recipe, two
         names, because a menu field and a slider field were built by different
         callers — and the `.nu-combo` width cap is written for `.nu-sel` only.
         A row here can hold either widget, so it answers to both selectors
         rather than growing a third rule that says what those two already say. */
      const f = el("div", null, "nu-field nu-sel");
      /* AND THE WHOLE ROW GOES FAINT WITH ITS CONTROL. `selectField` puts
         `is-off` on the wrapper it builds and `unwrap` throws that wrapper
         away, so the class is put back on the row that survived — a refused
         control that still looked live would be the silent grey's opposite
         and just as misleading. */
      if (why) f.classList.add("is-off");
      f.append(lab);
      div.append(f);
    }
    if (r.rederive !== major) tierInto(div, r);
    if (declared(r.field)) resetInto(div, r);
    parent.append(div);
  }

  /* number · enum · flag · pair — one label, the controls on its second line */
  function simpleControl(lab, r) {
    const e = r.edit, why = r.why || null, slots = slotsOf(r);
    if (e.kind === "number") {
      const s = slots[0];
      const v = typeof s?.v === "number" && isFinite(s.v) ? s.v
        : (isFinite(Number(s && s.w)) ? Number(s.w) : e.min);
      rangeInto(lab, K(r.field), sayLabel(r), v, e, (n) => land(r.field, n), why);
      return;
    }
    if (e.kind === "pair") {
      /* TWO NUMBERS, ONE FACT. `touch` is `{t, v}` — how loose the hand is in
         time and in level — and splitting it into two rules would make two
         sentences out of one thing a player does. Each range carries its own
         accessible name because a `<label>` names its first control only. */
      const cur = r.value || {};
      const write = (k, n) => land(r.field, { ...cur, [k]: n });
      for (const k of e.keys) {
        const v = typeof cur[k] === "number" ? cur[k] : e.min;
        rangeInto(lab, K(r.field, k), r.head + " " + k, v, e,
          (n) => write(k, n), why);
      }
      return;
    }
    const opts = e.kind === "flag" ? flagOpts(r) : enumOpts(r);
    const cur = e.kind === "flag" ? (r.value ? "1" : "")
      : (slots[0] && slots[0].v != null ? slots[0].v : "");
    const sel = selectField(lab, { key: SEL(r.field), label: sayLabel(r),
      options: opts, value: cur, why: why || null, ungated: true,
      set: (v) => land(r.field, e.kind === "flag" ? v === "1"
        : (v === "" ? null : coerce(opts, v))) });
    /* selectField appends a `<p class="nu-sel">` of its own; inside a
       `.nu-field > label` the label is already the even row, so the wrapper's
       chrome is dropped and its `<label>` is unwrapped into this one. ONE
       widget, ONE builder — the alternative was a second copy of the combo. */
    unwrap(lab, sel);
  }

  /* a `<select>`'s value is a STRING and the tables hold numbers (`rate: 0.5`)
     as well as words, so the option that was chosen says which it was */
  const coerce = (opts, v) => {
    const hit = opts.find((o) => String(o.value) === String(v));
    return hit ? hit.value : v;
  };

  /* selectField's `<p class="nu-sel">` carries a `<label>` and, when the whole
     control is refused, a `.nu-why`. Both are moved into the row's own label so
     the even-row geometry is the page's one recipe and not two. */
  function unwrap(lab, p) {
    const inner = p.querySelector("label");
    const combo = inner && inner.querySelector(".nu-combo");
    if (combo) lab.append(combo);
    for (const w of p.querySelectorAll(".nu-why")) lab.append(w);
    p.remove();
  }

  /* ---------- map: one control per role the row's own plan owns ----------- */
  function mapFields(div, r) {
    const e = r.edit, why = r.why || null;
    const keys = e.keys ? e.keys(row, gk) : [];
    const cur = r.value || {};
    if (!keys.length) {
      div.append(el("p", "this record's arrangement has no sections to " +
        "answer for", "nu-why"));
      return;
    }
    const write = (k, v) => {
      const next = { ...cur };
      if (v == null || v === "") delete next[k]; else next[k] = v;
      land(r.field, next);
    };
    for (const k of keys) {
      if (e.values) {
        const opts = [{ value: "", label: "—" },
          ...e.values(row, gk).map((o) => ({ value: o.value, label: o.label }))];
        menu(div, SEL(r.field, k), k, opts, cur[k] == null ? "" : cur[k],
          (v) => write(k, v === "" ? null : coerce(opts, v)), why);
      } else {
        /* a numeric map (`orn`) — one slider per decoration, and ABSENT IS
           THE DEFAULT, so the floor of the range deletes the key */
        const f = el("div", null, "nu-field");
        const lab = el("label");
        lab.append(el("span", k, "nu-w"));
        const v = typeof cur[k] === "number" ? cur[k] : e.min;
        rangeInto(lab, K(r.field, k), r.head + " " + k, v, e,
          (n) => write(k, n === e.min ? null : n), why);
        f.append(lab); div.append(f);
      }
    }
  }

  /* ---------- list: positional when it has a `count`, a set when a `max` --- */
  function listFields(div, r) {
    const e = r.edit, why = r.why || null;
    const opts = e.values ? e.values(row, gk) : [];
    if (e.count) {
      const n = e.count(row, gk) || 1;
      const cur = asList(r.value);
      for (let i = 0; i < n; i++) {
        menu(div, SEL(r.field, i), r.head + " " + (i + 1), opts, atIndex(cur, i),
          (v) => land(r.field, Array.from({ length: n },
            (_, j) => (j === i ? coerce(opts, v) : atIndex(cur, j)))), why);
      }
      return;
    }
    /* A SET, and the one control on this page that may hold more than one
       answer (test/selects.js names `fx` as its own exception). Each box is
       inside a `.nu-opt` label, which is the page's chip and is what makes the
       24px target `test/shell.js` A3 measures — the input itself is clipped. */
    const cur = asList(r.value);
    const chips = el("div", null, "nu-chips");
    for (const o of opts) {
      const lab = el("label", null, "nu-opt");
      const c = document.createElement("input");
      c.type = "checkbox";
      c.checked = cur.indexOf(o.value) >= 0;
      c.dataset.k = K(r.field, o.value);
      c.setAttribute("aria-label", why ? o.label + ", " + why : o.label);
      if (why) { c.disabled = true; c.dataset.why = why; }
      c.addEventListener("change", () => {
        const next = cur.filter((x) => x !== o.value);
        if (c.checked) next.push(o.value);
        land(r.field, e.max ? next.slice(0, e.max) : next);
      });
      lab.append(c, el("span", o.label, "nu-w"));
      chips.append(lab);
    }
    div.append(chips);
    if (why) div.append(el("p", why, "nu-why"));
  }

  /* ---------- the tier, and the way back ---------------------------------- */
  /* WHICH EDITS RESTART THE RECORD, SAID BEFORE YOU PRESS — ONCE PER AXIS.
     The words are `rules.js TIERS`'s and the sentence is still a `.nu-why`,
     because it is the same KIND of word as a refusal: a sentence about what
     the control will and will not do.
     WHERE IT SITS CHANGED (2026-09-02). It used to be appended to EVERY row,
     and the probe of the composer round measured what that reads like: *"'the
     record is written again at this seed' printed under EVERY compose-tier row
     in Rules (~12x). Say it once per axis (or once per panel)."* So the block
     says its COMMON tier once, at its foot, and only a row that DEPARTS from
     it carries the sentence itself — which is the whole of the information and
     none of the repetition. Measured on `reggae` after the tier audit: Time,
     Alphabet, Form, Cast, Development and Sound are one tier each (one
     sentence apiece), and Performance says its common tier once with two rows
     — the line's breath and decoration — carrying "the band plays it from the
     next bar" of their own. Every row still declares its tier as DATA
     (`data-tier`), which is what the gates read and what costs nothing. */
  const tierInto = (div, r) => div.append(el("small", r.tier, "nu-why"));
  /* the block's common tier: the one the most editable rows in it land in */
  function majorTier(rows) {
    const n = {};
    for (const r of rows) if (r.edit && r.edit.kind !== "changes")
      n[r.rederive] = (n[r.rederive] || 0) + 1;
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null;
  }
  const tierFoot = (sec, major) => { if (!major) return;
    const p2 = el("small", NuRules.TIERS[major], "nu-why nu-axtier");
    p2.dataset.tier = major;
    sec.append(p2); };

  function resetInto(div, r) {
    const b = el("button", "reset");
    b.type = "button";
    b.dataset.k = "rule-reset|" + r.field;
    b.setAttribute("aria-label", "reset " + r.head);
    b.addEventListener("click", () => drop(r.field));
    div.append(b);
  }

  /* ================= THE PALETTE ==========================================
     Paul: *"You can edit them, add new rules from a palette."* The offerable
     set is DERIVED and never typed — the editable rules this row does not
     declare — and a rule its own values make meaningless is GREYED WITH THE
     MEASURED REASON rather than hidden (avail.js:15: "Hiding destroys the
     shape of the possible"). `ui/selects.js` throws on a greyed option with no
     `why`, so the two halves cannot come apart. */
  function paletteInto(parent, axis, offers) {
    /* AN AXIS WITH NO EDITABLE RULE AT ALL GETS NO PALETTE, and that is not
       hiding: Material's rules are the sixteen-step vectors, which
       `askable.js:16-22` refuses to make settings of ("a drum groove, a bass
       figure, a melodic cell and a keys phrase are not knob VALUES, they are
       music"), and the axis says exactly that in the read-only lines above.
       A greyed "+ add a rule" there would be an offer the table never makes,
       with a reason that would have to be invented to sit under it. */
    if (!NuRules.RULES.some((r) => r.axis === axis && r.edit)) return;
    const rows = offers.filter((o) => o.axis === axis);
    const opts = [{ value: "", label: "+ add a rule" }, ...rows.map((o) => ({
      value: o.field, label: o.head,
      disabled: !!o.why || o.edit.kind === "changes",
      why: o.why || (o.edit.kind === "changes"
        ? "the chord grid is the Key panel's, one bar at a time" : null),
    }))];
    menu(parent, "rule-add|" + axis, "add a rule", opts, "", (f) => {
      if (!f) return;
      const r = NuRules.say(row, gk).find((x) => x.field === f);
      if (r) land(f, startAt(r));
    }, rows.length ? null : "every rule this axis has is already on the record");
  }

  /* ================= THE EIGHT AXES ======================================= */
  const said = NuRules.say(row, gk);
  const mot = NuRules.motifs(row, gk);
  const offers = NuRules.offerable(gk, row);
  /* ---- WHICH RULES GET A ROW, AND WHY THE PALETTE IS NOT A SECOND WAY IN --
     `say()` answers for all thirty-eight rules on every record, declared or
     not, because a sentence is derivable either way ("every section runs at
     the record's tempo" is a true thing to say about a row with no `paces`).
     Drawing all thirty-eight would make the palette a duplicate control: a
     rule with seven live menus on the page does not need a menu offering to
     add it, and two writers of one fact is the bug this round's laws are
     mostly about.
     So a ROW is a rule the record actually says — the anchor's own field, or
     one this hand has written (`doc.rules`, which a `flag` set to its off word
     can hold while the field itself is absent) — and the PALETTE is the rest,
     which is what makes it "the way in" on the blank state, where `silence`
     declares almost nothing. COMPOSER.md §2.4's own words for the pair: "a
     'reset' per row that the genre still says, and at the foot of each axis a
     palette listing the rules this row does not declare". */
  const shown = (r) => r.declared || declared(r.field);
  for (const axis of NuRules.AXES) {
    const mine = said.filter((r) => r.axis === axis && shown(r));
    const mine2 = mot.filter((r) => r.axis === axis);
    const offer = offers.filter((o) => o.axis === axis);
    if (!mine.length && !mine2.length && !offer.length) continue;
    const sec = el("section", null, "nu-rulax");
    sec.dataset.axis = axis;
    /* THE AXIS WORD IS A CONTROL LABEL AND NOT PROSE — AXES.md is the
       vocabulary ("that's how we are going to talk about nukernel") and
       `rules.js AXES` is the one list of the eight. An `<h3>`, because that is
       what it is: the name of the block under it. */
    sec.append(el("h3", axis, "nu-axword"));
    const major = majorTier(mine);
    for (const r of mine) ruleRow(sec, r, major);
    /* THE MOTIFS ARE READ AND NOT EDITED — Paul, in the same message: *"The
       motifs don't need to be editable. Just the structural rules."*
       `askable.js:16-22` owns the law and `rules.js MOTIF` carries the reason
       per row; this prints it. */
    for (const r of mine2) {
      const div = el("div", null, "nu-rule");
      div.dataset.rule = r.field;
      div.append(el("p", sayFlat(r) + " — " + r.why, "nu-why"));
      sec.append(div);
    }
    tierFoot(sec, major);
    paletteInto(sec, axis, offers);
    ax.append(sec);
  }

  /* NOTHING TO UNSUBSCRIBE. This panel installs no clock, no `on("pos")` and
     no listener outside its own DOM, so the handle is the contract and not a
     teardown — `BUILD` empties the host before every rebuild, which takes the
     listeners with it. The shape is ui/video.js's and ui/screensaver.js's,
     kept so a future strip or audition can be added here without the caller
     changing. */
  return () => {};
}

export default mountRules;
