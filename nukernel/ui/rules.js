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
// ---- ...AND THE ELISION IS REVERSED, 2026-09-02 (wave 4 §4) ----------------
// THE PARAGRAPH ABOVE STANDS AS WRITTEN and everything it says about the diet
// is still true — which is why the fix below keeps its one load-bearing move
// (the sentence lives inside a `<label>`, where the diet does not count it and
// a reader hears it as the control's name) and reverses only the elision.
//
// Paul, after using the deployed page: *"The genre editor is great. It can be
// a lot tighter though — it has text all over the place. Look at it from the
// point of view of a user just seeing it for the first time."*
//
// Measured on the rendered panel at 390 before this round: 27 rows, 4117px of
// deck, row heights from 33 to 478px, and every editable row three stacked
// things — a bold question line, a control line under it, and (on twelve of
// them) a tier line under that. The hole was the whole problem: a sentence
// with a `…` in it is a sentence you read twice, once for the words and once
// for the answer sitting somewhere below them.
//
// SO THE CONTROL SITS IN THE SENTENCE. `r.parts` was always the right shape
// for this — `{w}` is a word and `{w, v, slot}` is the value — and the drawing
// now walks it in order, printing the words and putting the widget AT the slot
// instead of a `…`. One line, one sentence, one row. What else left the row:
//   · the TIER WORD is not printed at all any more, per row or per axis. It
//     rides as `data-tier` (data, which every gate reads and which costs no
//     words) and as `data-say`, the hold/hover explainer `ui/glyph.js wireSay`
//     already runs for the whole page. The 2026-09-02 move that put it once
//     per axis instead of once per row was right and did not go far enough.
//   · a REFUSED said-only row is the row greyed, with `data-why` on it, and
//     no second line spelling the reason out — the reason is in `data-why`
//     (where a gate reads it) and in `data-say` (where a thumb does).
//   · the seven MOTIF lines collapse into ONE row, "the motifs are written in
//     the tracker", with the read-only list behind `data-say`.
//   · the palette is one compact `+` menu at the block's foot.
//
// ---- ...AND THE ROW BECOMES TWO LINES, 2026-09-03 --------------------------
// THE BLOCK ABOVE STANDS: the hole does not come back, the tier is still not
// printed, the motifs are still one row. What is reversed is the ONE geometry
// sentence in it — "One line, one sentence, one row".
//
// Paul, after using the deployed composer: *"Arrange things so the slider and
// function descriptions are on a line with the slider after that line, not
// bunched together."*
//
// Measured at 390 before the change: ten of the twenty-five rows wrapped
// INSIDE the sentence, so the tempo row read `the tempo is [==slider==] 76`
// and put `beats a minute` on a second line under the control. So the row is
// a COLUMN of two: the sentence with its value printed in it (an `<output
// class="nu-rv">` for a number, which the slider moves live; the menu's own
// word only where the grammar needs it — see `sentenceInto`), and under it
// the control alone at full width. Both lines are inside the row's one
// `<label>`, so every claim the block above makes about the text diet and the
// accessible name is untouched.
//
// ---- FOUR SHAPES OF ROW, AND THE SHAPE IS READ OFF `edit`, NEVER OFF A NAME -
//   number / enum / flag / pair  ONE label, the sentence, one control standing
//                                in each of the sentence's own slots.
//   map                          one control per KEY the row's own plan owns
//                                (`edit.keys`), all of them at the one slot,
//                                each wearing its key as a small word.
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
// through `ctx.evolve` while the transport is running — the same record,
// written again at the same seed, swapped in place and heard at the next bar
// (2026-09-03; it was `ctx.setDocument`, which stops, and the sentence here
// read "restarting the transport if it was running") — and through
// `ctx.setDocument` on a box that is stopped, where there is no position to
// keep. `render` writes the list and calls `ctx.changed()` (`document.js toGenre`
// spreads the resolved row under the document on the next frame), `row` moves
// nothing that plays. The tier rides every row as `data-tier` and is the first
// half of its `data-say`, so what an edit will do to a record that is playing
// is one hold away — which is the whole of what "it's a code-editing
// experience" has to mean on a page that is playing while you edit.
// (IT USED TO BE PRINTED ON EVERY ROW, then once per axis, and now on none:
// Paul, wave 4 §4, *"it has text all over the place"*.)
//
// GENRES IS NEVER MUTATED. `applyRules` copies (rules.js §5), so share links
// and `test/precompose.test.js` G6a's purity sweep both stand; the gate
// `test/rules-view.browser.js` re-reads the whole catalogue after driving the
// panel and asserts it byte-for-byte.

import { GENRES, NuWiki, NuRules, NuPrecompose } from "./deps.js";
import { selectField } from "./selects.js";
import { el, kinOf } from "./xtab.js";
/* THE CATALOGUE (src/copy/index.ts). This file is an ES module under ui/, so
   it imports the reader directly rather than reading the global the classic
   scripts use. Every word this panel prints is a key. */
import { t } from "./copy.js";

/* ---------- the three-liner every view in this directory carries ---------- */
const txt = (s) => document.createTextNode(String(s));

/* THE HOLE IS GONE (2026-09-02, wave 4 §4). This file kept a `sayLabel` that
   replaced the value with a `…` so the words could read as a sentence with a
   gap in it and the control under them could fill it. The control is IN the
   sentence now — `sentenceInto` walks the parts and builds at the slot — so
   there is no gap to spell and no second reading of the same line. What the
   elided form was also doing, and what has NOT gone, is naming the control:
   `sayFlat(r)` (the sentence with its values in) is what every widget on a
   rule row takes as its `aria-label`, so a reader still hears the whole
   sentence and not the field's short head.

   the whole sentence with its values IN, for the rows that are said and not
   edited — and for every control's accessible name */
const sayFlat = (r) => r.parts.filter((p) => !p.aside)
  .map((p) => p.w).join("").replace(/\s+/g, " ").trim();
/* THE CLAUSE THAT DOES NOT STAND ON THE ROW — rules.js `aside()`, 2026-09-02.
   It is a derived reading of the answer (the plan's section roles), not a
   second fact, and printing it put a 255px third line under a one-line
   sentence: MEASURED on the rendered Rules panel at 390, the `plan` row was
   96px against the 88px "two tap rows" ceiling every other question keeps.
   Behind the hold it costs nothing and is still there, which is the trade the
   motifs row already made. */
const asideOf = (r) => r.parts.filter((p) => p.aside)
  .map((p) => p.w).join(" ").replace(/\s+/g, " ").trim();

const slotsOf = (r) => r.parts.filter((p) => p.slot);

export function mountRules(host, ctx) {
  const doc = ctx.doc();
  const gk = doc.basis;
  const base = GENRES[gk];
  const ax = ctx.section(host, "ax-rules", t("rule.deckName"));
  if (!base) {
    /* THROW BY NAME is `precompose.js`'s law for a caller that asks for an
       anchor that is not there; a VIEW cannot throw at draw time without
       taking the page with it, so it refuses in the one way this page allows —
       visibly, with the reason. */
    ax.append(el("p", t("rule.noAnchor", { name: gk }), "nu-why"));
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
  const plate = el("h3", null, "nu-namebar nu-ruleplate");
  plate.dataset.k = "rules.name";
  /* THE WORD IS THE ARTICLE'S TITLE, ELSE THE ROW'S OWN LABEL, ELSE THE KEY
     (2026-09-02, the probe: the blank state read "silence · Silence" — the key
     in one spelling and the label in another). And the sub is dropped when it
     would only say the word again. ui/eight.js nameRecord carries the same
     rule for the foot plate; the two must agree. */
  /* ONE LINE, AND THEN THE LINEAGE UNDER IT (2026-09-02, wave 4 §4: *"the name
     plate is one line"*). It was a wrapping flex row, so at 390 the name, the
     place-and-year and the lineage came out as three ragged lines of ink. The
     name and its place-year are now one nowrap line that ellipsises rather
     than wraps, and the lineage is the dim line under it — the same two facts,
     in the two lines the plate is for. */
  /* AND THE WORD IS THE PLATE NAME, NOT THE ARTICLE TITLE (2026-09-03). Paul:
     *"look for names in genre list, you still have people and bands in
     there."* 33 rows link an act or a work because that is the honest
     evidence, so wiki.js carries `as` — the genre a reader sees — and
     `NuWiki.name()` is its one owner (`as` else `title`, underscores spent).
     ui/atlas.js's row and ui/eight.js's foot plate read the same call; the
     three must agree and now they agree by construction. */
  const word = (NuWiki && NuWiki.name ? NuWiki.name(gk) : null) || base.label || gk;
  const line1 = el("span", null, "nu-ruleline");
  line1.append(el("b", word));
  if (base.label && base.label !== word) line1.append(el("small", " · " + base.label));
  plate.append(line1);
  const kin = kinOf(gk, base);
  const kinWords = [];
  if (kin.parents.length)
    kinWords.push(t("rule.kinFrom", { value: kin.parents.map((p) => p[0]).join(", ") }));
  if (kin.kids.length)
    kinWords.push(t("rule.kinTo", { value: kin.kids.slice(0, 4).map((p) => p[0]).join(", ") +
      (kin.kids.length > 4 ? " +" + (kin.kids.length - 4) : "") }));
  if (kinWords.length) {
    /* ONE LINE, AND THE REST BEHIND A HOLD. The lineage is a nowrap line that
       ellipsises (a plate whose height depends on how many children a genre
       had is a plate that is a different height on every record), so the whole
       of it rides `data-say` — ui/glyph.js's page-wide hover/hold popover,
       which is where this panel now puts every word it does not print. */
    const k = el("small", kinWords.join(" · "), "nu-rulekin");
    k.dataset.say = kinWords.join(" · ");
    plate.append(k);
  }
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

         ---- AND IT EVOLVES RATHER THAN RESTARTING, 2026-09-03 -------------
         WHAT STOOD HERE: *"The transport is restarted only if it was RUNNING:
         `setDocument` stops it (it is the one door and it always has), and a
         panel that started the music on a record that was silent would be a
         control with a side effect nobody asked for."* The second half of
         that is still the law and is still obeyed by the `else` below. The
         first half was the bug.
         Paul, after using the deployed composer: *"When I change things in
         the 'Rules' section, evolve the song, don't just restart it."*

         MEASURED BEFORE, on the rendered page, reggae at reading 3, playing,
         one drag of the tempo rule: `transport:state` fired false and then
         true 361 ms later, the position feed's serial went 1 -> 0, the
         document was a new object, and the engine paid its whole eight-second
         ring prefill again — a stop, an open and a start from the top of the
         record, for a number.

         WHAT MAKES THE EVOLVE HONEST IS THE SEED AND NOTHING CLEVERER.
         `genreToDocument` is pure in (basis, reading, rules), so composing
         again at the SAME reading with one more sentence returns the same
         record with that sentence's own consequence in it — measured on this
         page rather than assumed: the whole document diffs at `.time.bpm` and
         `.rules` and nowhere else, so the slots, the section plan and the cast
         are byte-identical. There is nothing to preserve by hand.

         AND THE SWAP GOES THROUGH THE DOOR THAT ALREADY EXISTS. `ctx.evolve`
         is `changed()` with the document replaced first — push() -> commit
         ("box") -> audio/live.js's changed law -> the plan the walk reads on
         the next bar it asks for (58dda6c: *"a change lands at the next
         bar"*). This file schedules nothing and knows no bar numbers; a
         second swap path is exactly the duplicate owner this panel's laws
         exist to stop.

         EVERY COMPOSE RULE EVOLVES — there is no row that still restarts, and
         the reason is structural rather than lucky: `push()` re-derives the
         boxes, the phrases, the desk and the tempo from the whole document
         every time, and it is already the path a hand takes when it adds a
         section (ui/eight.js:12849 `addSection(); push(); draw();`), changes
         a chair's instrument, or drags the Time panel's own tempo. A rule can
         say nothing those cannot. */
      const nd = NuPrecompose.genreToDocument(d.basis, ctx.reading(),
        next.length ? next : null);
      if (ctx.transport().playing && ctx.evolve) ctx.evolve(nd);
      else ctx.setDocument(nd);
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
  /* `readout` IS THE ONE ARGUMENT THE TWO-LINE ROW ADDED (2026-09-03). The
     number a slider is on belongs in the SENTENCE, which is now the line
     above — so a caller that has already put an `<output>` up there hands it
     over and the slider goes down alone; a caller with no line of its own (a
     map's per-key cell) passes nothing and gets the readout beside the
     control, exactly as before. One widget, two placements, no second copy of
     the two-event discipline. */
  function rangeInto(lab, key, aria, value, edit, set, why, readout) {
    const r = document.createElement("input");
    r.type = "range";
    r.min = String(edit.min); r.max = String(edit.max);
    r.step = String(edit.step == null ? 1 : edit.step);
    r.value = String(value);
    r.dataset.k = key;
    r.setAttribute("aria-label", why ? aria + ", " + why : aria);
    const out = readout || el("output", String(value));
    if (why) { r.disabled = true; r.setAttribute("aria-disabled", "true");
               r.dataset.why = why; }
    r.addEventListener("input", () => { out.textContent = r.value; });
    r.addEventListener("change", () => set(+r.value));
    if (readout) lab.append(r); else lab.append(r, txt(" "), out);
    return r;
  }

  /* ONE MENU, drawn by ui/selects.js and by nothing else — `.nu-combo`, the
     seated/said detent, the >24-option filter and the NO SILENT GREY throw all
     come with it. `spec.why` is what refuses the whole control and prints the
     reason where a sighted reader and a gate can both have it.

     IT IS BUILT INTO A BIN AND MOVED (2026-09-02). `selectField` appends a
     `<p class="nu-sel">` carrying its own question on line one and the menu on
     line two, which is exactly the two-line field this round is taking out of
     the panel: the question is the SENTENCE now and the menu stands in it. So
     the widget is built where it always was — one builder, one look, one
     throw — and only the `.nu-combo` (with any `.nu-why` it grew) is lifted
     out and dropped at the slot. The bin is detached, so `selectField`'s own
     `document.querySelector` duplicate-key check still sees the live page and
     nothing half-built is ever in it. */
  function menu(parent, key, label, options, value, set, why) {
    const bin = document.createElement("div");
    const p = selectField(bin, { key, label, options, value,
                                 why: why || null, ungated: true,
                                 set: (v) => set(v) });
    const inner = p.querySelector("label");
    const combo = inner && inner.querySelector(".nu-combo");
    if (combo) parent.append(combo);
    for (const wn of p.querySelectorAll(".nu-why")) parent.append(wn);
    return combo;
  }

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

  /* ================= ONE ROW =============================================
     ONE SENTENCE, WITH THE CONTROLS STANDING IN IT (2026-09-02, wave 4 §4 —
     Paul: *"It can be a lot tighter though — it has text all over the place.
     Look at it from the point of view of a user just seeing it for the first
     time."*). The row is a single `<label>`: the rule's own `parts`, in order,
     words as `<span class="nu-w">` and the widget where the slot is. Nothing
     else goes on the row — not the tier, not the refusal's sentence, not a
     heading over a group of controls — because everything else the row has to
     say is either DATA a gate reads (`data-tier`, `data-why`) or an explainer
     a hold opens (`data-say`, ui/glyph.js's page-wide popover).

     STILL INSIDE A `<label>`, and that is the one thing the old drawing had
     right and this must not lose: `test/text-diet.test.js`'s SKIP list holds
     `label`, so thirty-eight sentences cost the diet nothing, and a screen
     reader announces the sentence as the first control's name. A `<p>` here
     would put about a thousand characters of prose on a page whose whole
     budget is 1,169. */
  function ruleRow(parent, r) {
    const div = el("div", null, "nu-rule");
    div.dataset.rule = r.field;
    div.dataset.tier = r.rederive;
    const e = r.edit;
    const why = r.why || null;
    /* WHAT A HOLD SAYS: the refusal first where there is one, then the tier —
       which is the whole of what the two removed lines used to print, in the
       one place a first-time reader can ask for it instead of having it
       pushed at them thirty-eight times. */
    const tail = asideOf(r);
    div.dataset.say = (why ? why + " — " : "") + r.tier +
      (tail ? " — " + tail : "");
    if (why) { div.dataset.why = why; div.classList.add("is-off"); }

    /* SAID, NOT EDITED — one line, the sentence, and the row greyed. The
       reason is NOT a second line any more: it is `data-why` (which is where
       `test/text-diet.test.js` T3 and the no-silent-grey law both look) and
       `data-say` (which is where a thumb looks). `.nu-why` because that is
       what it is — a refusal — and because the diet skips it. */
    if (!e || e.kind === "changes") {
      div.append(el("p", sayFlat(r), "nu-why"));
      if (!why && e && e.kind === "changes") {
        const w2 = t("rule.chordsFromKey");
        div.dataset.why = w2;
        div.dataset.say = w2 + " — " + r.tier;
        div.classList.add("is-off");
      }
      if (declared(r.field)) resetInto(div, r);
      parent.append(div);
      return;
    }

    /* THE SHAPE, AS DATA, AND ONLY ON A ROW THAT HAS A CONTROL. nu.css gives
       a sentence with several answers in it (a positional `list`, a numeric
       `map`) a narrower cap per answer, and it reads the shape off here rather
       than off a field name — one owner: this is `edit.kind`, the same fact
       `controlAt` reads to pick the widget. A said-only row carries none, and
       that is the honest spelling: `changes` is an `edit.kind` that draws
       nothing, so a row wearing it would claim a widget it does not have. */
    div.dataset.shape = e.kind;

    /* A CHIP SET IS A FIELDSET, NOT A LABEL, AND THE REASON IS THE ONE
       CONTROL THAT WOULD OTHERWISE STOP WORKING. `fx` is the one rule on this
       page that may hold more than one answer, and its chip is a
       `<label class="nu-opt">` around a visually-clipped checkbox — the LABEL
       is the 24px target, so a chip that is not a label is a chip a thumb
       cannot press. Nesting one label inside the row's own is not a shape a
       browser is asked to make sense of. So the multi-answer row wears the
       markup a group of checkboxes has always wanted: a `<fieldset>` with the
       sentence as its `<legend>` — which the text diet skips exactly as it
       skips a `<label>`, and which ui/sheets.js already uses for every multi
       sheet on this page. One line either way; the chips are still chips. */
    if (e.kind === "list" && !e.count) {
      const fs = document.createElement("fieldset");
      fs.className = "nu-said";
      if (why) fs.classList.add("is-off");
      const lg = document.createElement("legend");
      lg.className = "nu-w";
      lg.textContent = sayFlat(r);
      fs.append(lg);
      /* THE CHIPS GO ON THE LINE UNDER THE LEGEND (2026-09-03, Paul's
         two-line row): the legend was floated left and the chips flowed
         around it, which is the same bunching the sentence rows had. Same
         `.nu-ctl` the sentence rows use, so the chip line and the control
         line are one shape and not two. */
      const ct = el("span", null, "nu-ctl");
      listFields(ct, r);
      fs.append(ct);
      div.append(fs);
      if (declared(r.field)) resetInto(div, r);
      parent.append(div);
      return;
    }

    const lab = el("label", null, "nu-said");
    if (why) lab.classList.add("is-off");
    sentenceInto(lab, r);
    div.append(lab);
    if (declared(r.field)) resetInto(div, r);
    parent.append(div);
  }

  /* THE WALK. Words print; the slot builds. A rule with more than one slot
     (`touch` — "loose by … steps and … in level") builds one control per slot,
     in slot order, which is why the index is counted rather than assumed. A
     rule whose sentence is ENTIRELY its value ("the record may be sung") has
     no words at all, and the control is the whole line — the rule's own `head`
     is put on it as the accessible name, which is what the `<label>` used to
     print and no longer needs to.

     ---- AND THE WALK BUILDS TWO LINES, 2026-09-03 -------------------------
     Paul, after using the deployed composer: *"Arrange things so the slider
     and function descriptions are on a line with the slider after that line,
     not bunched together."*

     WHAT THIS REVERSES, AND WHAT IT KEEPS. The wave-4 §4 drawing put the
     widget AT the slot, inside the sentence, to close the `…` hole the
     elided form left. It closed it and it bunched: MEASURED on the rendered
     panel at 390 before this change, the tempo row read `the tempo is
     [======slider======] 76` and then wrapped `beats a minute` onto a second
     line UNDER the slider, so the sentence was read in two pieces with a
     control between them — 66px of row for a question you have to reassemble.
     Ten of the twenty-five rows wrapped that way at 390.

     THE HOLE STILL DOES NOT COME BACK, and that is the part of wave 4 §4 this
     keeps: the sentence on line one is COMPLETE, with its value printed in it
     as an `<output class="nu-rv">` — "the tempo is 76 beats a minute" — and
     the slider under it moves that number live on `input`. You read one
     sentence; you move one control; neither is inside the other. Both lines
     are inside the row's own `<label>`, which is what keeps thirty-eight
     sentences out of `test/text-diet.test.js`'s 1,169-character budget and
     what makes a screen reader announce the whole sentence as the control's
     name. */
  function sentenceInto(lab, r) {
    const wl = el("span", null, "nu-wline");   // line 1: the sentence, values in
    const ct = el("span", null, "nu-ctl");     // line 2: the controls, alone
    const parts = r.parts.filter((p) => !p.aside);   // the aside rides data-say
    /* WHERE THE SENTENCE'S LAST WORD IS, and it decides ONE thing: whether a
       menu's answer is printed on line one as well as shown on the menu.
       MEASURED on the first drawing of this round, at 390: `the mode is
       **natural minor**` over a menu reading `natural minor`, and the same
       doubling on rate, scale, harmony, plan, part and instr — six rows
       saying their answer twice, which is the "text all over the place" this
       panel spent wave 4 §4 removing. A menu SHOWS its own value; a slider
       does not. So a slot whose sentence ENDS there hands the answer to the
       control under it, and a slot with words after it keeps the answer where
       the grammar needs it ("the drums are a **room** kit"). A number always
       prints: its `<output>` is the only readout a range has. */
    let lastWord = -1;
    parts.forEach((p, j) => { if (!p.slot && p.w && String(p.w).trim()) lastWord = j; });
    let i = 0, built = false;
    for (let j = 0; j < parts.length; j++) {
      const p = parts[j];
      if (!p.slot) { if (p.w) wl.append(el("span", p.w, "nu-w")); continue; }
      const n = i++;
      if (controlAt(wl, ct, r, n, p, j < lastWord)) built = true;
    }
    /* A LINE WITH NO WORDS ON IT IS NOT A LINE. Two rows reach this: the one
       whose sentence is entirely its value, and the one whose `say` is all
       slot ("the record may be sung"). The rule's own `head` names it — which
       is exactly what the elided drawing used to print and what the control
       still carries as its accessible name. */
    if (!wl.textContent.trim()) wl.append(el("span", built ? r.head : sayFlat(r), "nu-w"));
    lab.append(wl, ct);
  }
  /* THE ANSWER, PRINTED IN THE SENTENCE. A menu's current word and a map's
     summary are already the slot part's own `w` — the table said them — so
     this places them and never re-derives them. */
  const valInto = (wl, part) => {
    if (part && part.w != null && String(part.w).trim())
      wl.append(el("b", String(part.w), "nu-rv"));
  };

  /* ONE SLOT, ONE WIDGET — and the widget's shape is read off `edit.kind`,
     never off the field's name. `map` and `list` put ALL of their controls at
     the first slot, because the sentence has one hole and the rule has one per
     chair or per role: "they hold [organ] [bass] [drums]" is one sentence with
     three answers in it, which is the true shape of a positional list. */
  /* TWO PARENTS SINCE 2026-09-03 (see `sentenceInto`): `wl` is the sentence's
     own line and takes the ANSWER as words; `ct` is the line under it and
     takes the control. A widget is built once and it is not built twice. */
  function controlAt(wl, ct, r, i, part, tail) {
    const e = r.edit, why = r.why || null;
    const lab = ct;
    if (e.kind === "number") {
      const v = typeof part.v === "number" && isFinite(part.v) ? part.v
        : (isFinite(Number(part.w)) ? Number(part.w) : e.min);
      /* THE NUMBER IS THE SENTENCE'S WORD AND THE SLIDER'S READOUT AT ONCE —
         one `<output>`, standing where the value stands in the sentence, and
         handed to `rangeInto` so a live drag moves it there. */
      const out = el("output", String(v), "nu-rv");
      wl.append(out);
      rangeInto(lab, K(r.field), sayFlat(r), v, e, (n) => land(r.field, n),
        why, out);
      return true;
    }
    if (e.kind === "pair") {
      /* TWO NUMBERS, ONE FACT. `touch` is `{t, v}` — how loose the hand is in
         time and in level — and splitting it into two rules would make two
         sentences out of one thing a player does. The sentence has a slot for
         each, so each range lands in its own hole; each carries its own
         accessible name because a `<label>` names its first control only. */
      const k = e.keys[i];
      if (k == null) return false;
      const cur = r.value || {};
      const v = typeof cur[k] === "number" ? cur[k] : e.min;
      const out = el("output", String(v), "nu-rv");
      wl.append(out);
      rangeInto(lab, K(r.field, k), r.head + " " + k, v, e,
        (n) => land(r.field, { ...cur, [k]: n }), why, out);
      return true;
    }
    if (e.kind === "map") { if (i === 0) { if (tail) valInto(wl, part);
                                           mapFields(lab, r); }
                            return true; }
    /* only the POSITIONAL list arrives here; a chip set is a fieldset row and
       never walks the sentence (see `ruleRow`) */
    if (e.kind === "list") { if (i === 0) { if (tail) valInto(wl, part);
                                            listFields(lab, r); }
                             return true; }
    const opts = e.kind === "flag" ? flagOpts(r) : enumOpts(r);
    const cur = e.kind === "flag" ? (r.value ? "1" : "")
      : (part.v != null ? part.v : "");
    if (tail) valInto(wl, part);
    menu(lab, SEL(r.field), sayFlat(r), opts, cur,
      (v) => land(r.field, e.kind === "flag" ? v === "1"
        : (v === "" ? null : coerce(opts, v))), why);
    return true;
  }

  /* a `<select>`'s value is a STRING and the tables hold numbers (`rate: 0.5`)
     as well as words, so the option that was chosen says which it was */
  const coerce = (opts, v) => {
    const hit = opts.find((o) => String(o.value) === String(v));
    return hit ? hit.value : v;
  };

  /* ---------- map: one control per key the row's own plan owns -----------
     IN THE SENTENCE, NOT UNDER A HEADING. The `<h4>` this used to print over
     the group is gone with every other second line: a map is a sentence with
     several answers ("the sections run [half] [steady] [push]"), and each
     answer wears its key as a small word rather than a full field label. */
  function mapFields(lab, r) {
    const e = r.edit, why = r.why || null;
    const keys = e.keys ? e.keys(row, gk) : [];
    const cur = r.value || {};
    if (!keys.length) {
      lab.append(el("span", t("rule.nothingToAnswer"), "nu-w"));
      return;
    }
    const write = (k, v) => {
      const next = { ...cur };
      if (v == null || v === "") delete next[k]; else next[k] = v;
      land(r.field, next);
    };
    for (const k of keys) {
      const box = el("span", null, "nu-cell");
      box.append(el("i", k, "nu-k"));
      if (e.values) {
        const os = [{ value: "", label: "—" },
          ...e.values(row, gk).map((o) => ({ value: o.value, label: o.label }))];
        menu(box, SEL(r.field, k), r.head + " " + k, os, cur[k] == null ? "" : cur[k],
          (v) => write(k, v === "" ? null : coerce(os, v)), why);
      } else {
        /* a numeric map (`orn`) — one slider per decoration, and ABSENT IS
           THE DEFAULT, so the floor of the range deletes the key */
        const v = typeof cur[k] === "number" ? cur[k] : e.min;
        rangeInto(box, K(r.field, k), r.head + " " + k, v, e,
          (n) => write(k, n === e.min ? null : n), why);
      }
      lab.append(box);
    }
  }

  /* ---------- list: positional when it has a `count`, a set when a `max` --- */
  function listFields(lab, r) {
    const e = r.edit, why = r.why || null;
    const opts = e.values ? e.values(row, gk) : [];
    if (e.count) {
      const n = e.count(row, gk) || 1;
      const cur = asList(r.value);
      for (let i = 0; i < n; i++)
        menu(lab, SEL(r.field, i), r.head + " " + (i + 1), opts, atIndex(cur, i),
          (v) => land(r.field, Array.from({ length: n },
            (_, j) => (j === i ? coerce(opts, v) : atIndex(cur, j)))), why);
      return;
    }
    /* A SET, and the one control on this page that may hold more than one
       answer (test/selects.js names `fx` as its own exception). Each box is
       inside a `.nu-opt` label, which is the page's chip and is what makes the
       24px target `test/shell.js` A3 measures — the input itself is clipped.
       The row that holds them is a `<fieldset>` and not a `<label>` for
       exactly that reason (see `ruleRow`): the chip has to stay a label. */
    const cur = asList(r.value);
    for (const o of opts) {
      const chip = el("label", null, "nu-opt");
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
      chip.append(c, el("span", o.label, "nu-w"));
      lab.append(chip);
    }
  }

  /* ---------- the way back ------------------------------------------------
     THE TIER IS NOT PRINTED, ANYWHERE (2026-09-02, wave 4 §4). The old drawing
     appended `r.tier` to every row; the fix round of the same morning moved it
     to one sentence per axis foot plus the departures. Paul's answer to the
     result — *"it has text all over the place"* — is why there is now no
     printed tier at all: `data-tier` on every row is what the gates read, and
     `data-say` is what a hold or a hover opens. Nothing about WHICH tier a
     rule is in changed; only whether the panel says it before it is asked. */
  function resetInto(div, r) {
    const b = el("button", t("act.reset"));
    b.type = "button";
    b.dataset.k = "rule-reset|" + r.field;
    b.setAttribute("aria-label", t("rule.reset", { name: r.head }));
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
    const opts = [{ value: "", label: t("rule.addRule") }, ...rows.map((o) => ({
      value: o.field, label: o.head,
      disabled: !!o.why || o.edit.kind === "changes",
      why: o.why || (o.edit.kind === "changes" ? t("rule.chordsFromKey") : null),
    }))];
    /* ONE COMPACT `+` AT THE BLOCK'S FOOT (2026-09-02, wave 4 §4: *"the
       palette is ONE compact '+ add' combo per axis at the block's foot"*). It
       was a full `.nu-sel` field — a 44px line reading "add a rule" over a
       44px menu whose first option said "+ add a rule" again — which is the
       same question printed twice and 88px of it under every one of the eight
       blocks. The VISIBLE label is gone; the accessible one is not (the menu's
       `aria-label` is still "add a rule to <axis>", which is what selectEl
       writes onto the control), and the offer is still the first option's own
       words, where a reader who can see it already reads it. */
    const p = el("p", null, "nu-pal");
    menu(p, "rule-add|" + axis, t("rule.addRuleTo", { name: axis }), opts, "", (f) => {
      if (!f) return;
      const r = NuRules.say(row, gk).find((x) => x.field === f);
      if (r) land(f, startAt(r));
    }, rows.length ? null : t("rule.allRulesOn"));
    parent.append(p);
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
    sec.append(el("h3", t("axis." + axis.toLowerCase()), "nu-axword"));
    for (const r of mine) ruleRow(sec, r);
    /* THE MOTIFS ARE READ AND NOT EDITED — Paul, in the same message: *"The
       motifs don't need to be editable. Just the structural rules."*
       `askable.js:16-22` owns the law and `rules.js MOTIF` carries the reason
       per row.
       ...AND THEY ARE ONE ROW, NOT SEVEN (2026-09-02, wave 4 §4). Seven
       read-only lines — the drum grid, the section grids, the velocities, the
       chances, the fill, the bass grid, the ghost notes — each with its step
       count and its reason, is 400 characters of the Material block saying one
       thing seven times, and it is the first block a first-time reader
       reaches. It says the one thing once, in the words that answer the
       question a reader actually has ("can I edit these? where?"), and the
       seven lines are the hold explainer behind it. No fact is lost and none
       of them was ever editable here. */
    if (mine2.length) {
      const div = el("div", null, "nu-rule nu-motifs");
      div.dataset.rule = "motifs";
      div.dataset.tier = "row";
      div.dataset.say = mine2.map((r) => sayFlat(r)).join(" \u00b7 ") +
        " \u00b7 " + t("rule.phrasesEdited");
      div.append(el("p", t("rule.phrasesEdited"), "nu-why"));
      sec.append(div);
    }
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
