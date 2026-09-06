// nukernel/src/lozenge/field.ts — EVERY OPTION ON THE GLASS AT ONCE.
//
// DESIGN.md §2 component 16. Paul, 2026-09-05: *"a novel interface for when
// there are tons of options and some of them can be multiple… tight lozenges,
// organized by color and clustered semantically by the kind of things they
// present… visibility into all of the options"*.
//
// ===== WHAT THIS IS FOR, AND WHAT IT IS NOT FOR ========================
// src/menus/index.ts's header states the split this component sits on the far
// side of: *"sheets where you compare, menus where you have decided."* The
// native picker and the typed combo answer a SETTLED PARAMETER — the meter,
// the key, what a voice plays. This answers the other kind: sixty-eight kit
// words, forty-two chord qualities, sixty-three scales, the transformations,
// the instruments — a vocabulary you are SHOPPING in, where the shape of the
// possible is the useful thing and a wheel that shows one word at a time hides
// exactly that. It replaces the picker for those vocabularies on EVERY
// pointer; the picker stays where a vocabulary is long AND flat (a genre
// list), which is the one case a heading cannot help with.
//
// ===== THE LAWS, AND WHERE EACH ONE IS IN THE CODE BELOW ===============
//
//  1 · EVERY OPTION IS IN THE DOM AT ONCE. Nothing is behind a wheel, a scroll
//      box, or a "more". `draw()` renders the whole vocabulary every time.
//      The ONE thing that hides options is a FOLDED CLUSTER, it starts OPEN,
//      and its heading says how many it holds (`.nu-lzcount`) so a fold is
//      never a disappearance. The fold is the `hidden` attribute on the wrap
//      AND `.is-folded` on the section: the attribute so the fold is real with
//      no stylesheet at all, the class so nu.css can draw it. (A rule setting
//      `display` on `.nu-lzwrap` must therefore spell it `:not([hidden])` or
//      hang it off `.is-folded` — a bare `.nu-lzwrap{display:flex}` outranks
//      the UA's `[hidden]` and would un-fold every fold on the page.)
//
//  2 · THE BUTTON IS THE PILL IS THE HIT TARGET, AND NOTHING OVERLAPS.
//      `.nu-lz` is the `<button>`; it is what a thumb presses AND what a
//      reader sees. §2/16's *"~28px tall visually with a 44px hit area through
//      its margins"* was drawn as `padding: 8px` and `margin-block: -5px`, and
//      Paul photographed what that is on a phone (2026-09-05: *"The lozenges
//      all overlap"*): the border is on the button, so the DRAWN pill was 44px
//      inside a 34px row pitch and every row crossed the outlines of the row
//      above it — measured 10px of overlap on 35 of the mode picker's 42
//      pills. The 44px comes from `min-block-size` and padding ONLY; the row
//      pitch is the pill's own rendered height plus a gap; there is no
//      negative margin anywhere in the field. A pill is as tall as its word
//      needs and wraps to a second line only when the word cannot fit.
//      NOT ONE HEIGHT IS SET IN THIS FILE, and no colour: nu.css owns both.
//
//  3 · A LONG PRESS SAYS, A SHORT PRESS WRITES. 600 ms and 8px, and the shape
//      is `src/envelope/plate.ts`'s handle exactly — a timer armed on
//      `pointerdown`, disarmed by a move past the slop or by the release. Past
//      600 ms the option's sentence (its `why`, else its own word) is printed
//      into `.nu-lzsay` and the write is SWALLOWED; before it, the browser's
//      own `click` writes. The plate uses 3px because a plate is a drag
//      surface; a lozenge sits on a wrapping field on a scrolling page, so the
//      slop is 8px — past that the gesture belongs to the page and is neither
//      a press nor a write.
//
//  4 · A VALUE TAP NEVER DISMISSES ANYTHING. DESIGN.md §3: *"Nothing dismisses
//      under a finger that is changing a value."* This component never closes
//      itself, never re-mounts itself, and never replaces its own host: every
//      write goes through `draw()`, which is `render()` into the SAME element,
//      the way `chips()` does. The pointer handlers are DELEGATED on the host
//      and bound once, so a redraw cannot land between a `pointerdown` and its
//      `click` and lose the gesture — which is the bug the combo's
//      `gestures`/`bornAt` guard two directories over exists to survive.
//
//  5 · A CHAIN KEEPS ITS ORDER. Multi-select `values` is an ORDERED list: an
//      unselected word APPENDS, a selected one is REMOVED and the rest keep
//      their order and re-number. `onToggle` is handed the NEW order whole, so
//      no caller ever reconstructs it. With `ordered` the position is PRINTED
//      (`.nu-lzn`), because "transpose then invert" is not "invert then
//      transpose" and a chain whose order is invisible is a chain you cannot
//      edit.
//
//  6 · NO SILENT GREY — AND A PILL CARRIES A WORD, NEVER A SENTENCE. The same
//      throw, in the same words, as `src/menus/index.ts refuseSilentGrey` — a
//      `disabled` or `quiet` word with no `why` is a page error and not a
//      console warning. A refused lozenge is `aria-disabled`, carries
//      `data-why`, and has the reason in its accessible name.
//      IT DOES NOT PRINT THE REASON INSIDE ITSELF. It did (`<small
//      class="nu-lzwhy">`, `chips()`'s two-line precedent) and Paul
//      photographed it on 2026-09-05: *"you added sentences of text to some of
//      them"* — "ukrainian dorian" drawn as a pill holding "the record is
//      straight, and modal harmony has no changes", 54px tall in a field of
//      44px words, crossing three of its neighbours. A chip strip is one line
//      of a few words and can afford a second line; a field of forty-two is a
//      SHAPE, and a sentence inside one word destroys the shape that is the
//      whole reason this component exists.
//      SO THE SENTENCE HAS ONE PLACE — `.nu-lzsay`, the field's own say line,
//      which reserves its room at creation and never moves anything. A long
//      press prints it there (law 3), and so does a plain TAP on a refused
//      word, which is why a refused lozenge is `aria-disabled` and NOT
//      `disabled`: a `disabled` button gets no click, so its reason would be
//      reachable only through a screen reader — which is the silent grey this
//      law is named after, wearing an accessible name.
//
//  7 · A WHOLE-FIELD REFUSAL IS THE SAME LAW ONE TIER UP. `.is-off`,
//      `aria-disabled`, `data-why`, every lozenge refused with it, and the sentence
//      printed ONCE as `<small class="nu-why">` — the class `menuField()`
//      already uses for exactly this sentence, so there is one refusal line in
//      the stylesheet and not two.
//
//  8 · IT IS ARROWABLE. Left/Right walk the field's lozenges in reading order
//      (clamped at the ends — Home/End are the ends, and a wrap-around on a
//      sixty-eight-word field is a way to get lost). Up/Down move BY CLUSTER,
//      holding the ordinal position: the same slot in the cluster above or
//      below, clamped to its length, which on a wrapping field is the only
//      "up" that means anything stable. Enter/Space write, because a `<button>`
//      already does. Each cluster keeps ONE tab stop (roving `tabindex`: the
//      selected word, else the first sayable one), so Tab walks heading ·
//      cluster · heading · cluster rather than through sixty-eight stops, and
//      the headings are real buttons so Tab reaches every fold.
//      A REFUSED LOZENGE IS SKIPPED — by the arrows and by the roving stop
//      (`tabindex="-1"`), because a word you may not choose is not a stop on
//      the way to one. It is still `aria-disabled` rather than `disabled`
//      (law 6), so a THUMB may land on it and be told why; a keyboard reads
//      the same sentence out of its accessible name.
//
//  9 · NOTHING SCROLLS SIDEWAYS. No width, no `white-space`, no `overflow` is
//      set here; the field is a stack of sections and each section's wrap is a
//      plain block of buttons, which is a shape nu.css can wrap.
//
// 10 · THE ADDRESS DOES NOT MOVE WHEN THE WIDGET DOES. `data-sel` is the key;
//      `data-k` on the field is `spec.k` || "lz|" + key; a lozenge's `data-k`
//      is `key + "|" + value` and its `data-v` is the value — byte for byte
//      what `chips()` mints for a chip, so a gate that drives a chip strip
//      drives this without changing one string.
//
// LIT, LIGHT DOM, for the same reason src/menus does it: every gate on this
// page queries from the document root, and a shadow root would make the whole
// vocabulary invisible to all of them.

import { html, render, nothing } from "lit/html.js";
import { classMap } from "lit/directives/class-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
/* THE WORDS ARE THE CATALOGUE'S (TABLE.md §12b), and this file prints none of
   its own — see api.ts's header. `../copy/global.js`, never
   `../copy/index.js`: this is its own build entry, and importing the catalogue
   would bundle a second copy of every string on the page into ui/lozenge.js.
   ONE key is read, `menu.withWhy`, and only for an accessible NAME — the same
   join `optionText` makes in src/menus/index.ts. */
import { t } from "../copy/global.js";
import { HUES, HOLD_MS, SLOP } from "./api.js";
import type { LozSpec, LozOption, LozCluster } from "./api.js";
import { clustersFrom } from "./clusters.js";

/** A silent grey is the bug every widget on this page exists to prevent, so it
 *  is the same throw, in the same words, as src/menus/index.ts (ui/sheets.js:70). */
function refuseSilentGrey(spec: LozSpec): void {
  for (const o of spec.options || [])
    if ((o.disabled || o.quiet) && !(o.why && String(o.why).trim()))
      throw new Error('lozenge: "' + spec.key + '" / "' + String(o.value) +
        '" is ' + (o.disabled ? "disabled" : "quiet") + " with no `why`");
}

interface Bin { word: string; opts: LozOption[] }

/** THE CLUSTERS THIS FIELD ACTUALLY DRAWS. The caller's own `clusters` when it
 *  has one (the drummer hands `groupsFor(...)` straight through), else derived
 *  from each option's `cluster`, else ONE unheaded cluster holding everything.
 *  WHATEVER HAPPENS, EVERY OPTION IS IN EXACTLY ONE BIN — law 1 is not a
 *  best-effort. A word a caller's cluster list forgot, or names twice, ends up
 *  in a trailing UNHEADED bin rather than being dropped or drawn twice; an
 *  unheaded bin is the one heading this component is allowed to not print,
 *  because the alternative is inventing prose. */
function bins(spec: LozSpec): Bin[] {
  const opts = spec.options || [];
  const by = new Map<string, LozOption>();
  for (const o of opts) if (!by.has(String(o.value))) by.set(String(o.value), o);
  const declared: LozCluster[] = (spec.clusters && spec.clusters.length)
    ? spec.clusters
    : clustersFrom(opts.map((o) => ({ value: String(o.value), cluster: o.cluster })),
                   spec.other);
  const seen = new Set<string>();
  const out: Bin[] = [];
  for (const c of declared) {
    const list: LozOption[] = [];
    for (const v0 of c.vals || []) {
      const v = String(v0);
      const o = by.get(v);
      if (!o || seen.has(v)) continue;
      seen.add(v);
      list.push(o);
    }
    if (list.length) out.push({ word: c.word == null ? "" : String(c.word), opts: list });
  }
  const left: LozOption[] = [];
  for (const [v, o] of by) if (!seen.has(v)) left.push(o);
  if (left.length) out.push({ word: "", opts: left });
  return out;
}

/** which clusters are folded, per field address. Module-level for the reason
 *  `sheet.ts`'s `GROUPOPEN` is: the panel is rebuilt from scratch on write. */
const FOLDS = new Map<string, Set<number>>();
/** ...and which fields a HAND has folded, which is a different fact from which
 *  are folded. Past this set the field folds ITSELF to fit the phone (below);
 *  inside it, the hand's own answer stands and is never overruled. */
const TOUCHED = new Set<string>();

/* ===== NO CONTROL TALLER THAN THE PHONE (2026-09-06, TABLE.md §15) ======
   THE MEASUREMENT THAT ASKED FOR THIS. The Coach House walkthrough, on an
   844px phone: *"the variation popup is 1,378 px tall … three options to a
   line, some 38px wide; I mis-tapped `filled in` into `a beat later` and did
   not notice."* Walked again on 2026-09-06 across three records at 390 and
   320, the five tallest fields on the page measured 5,876px (the rules
   sheet's instrument, 121 words), 4,416px (a player's instrument, 147),
   2,231px (the scale, 64), 1,873px (the drummer's kit, 69) and 1,178px (the
   tune's own variation, 27) — eight distinct fields past the viewport, and on
   three of them the word the record was STANDING ON sat 1,448px, 1,450px and
   2,163px down a field you had to scroll INSIDE, over a table, inside a sheet.

   THE MECHANISM IS THE ONE THIS COMPONENT ALREADY HAS. Law 1 says the only
   thing that may hide an option is a FOLDED CLUSTER; this makes the fold
   answer the height. Three states, in order, and the first that fits wins:

     A · every cluster open — law 1 exactly as it was, and what a vocabulary
         that fits still gets;
     B · the cluster holding the standing answer open, the rest headings with
         their counts (so nothing has disappeared and every one is one tap);
     C · every cluster folded, the standing one MARKED (`aria-current`), and
         the answer itself read off the field's own head one row above.

   WHAT WAS REJECTED, AND WHY, both measured before this was written:
     · A BOUNDED SCROLL BOX with the value pinned in it. It is law 1's own
       forbidden shape ("nothing behind a wheel, a scroll box, or a 'more'")
       and it puts back exactly what the walkthrough complained of — a scroll
       inside a popup inside a sheet. §11c made the PANE the scrollport; a
       second scrollport inside it is the disease.
     · A TYPED FILTER ROW past N words. `src/menus/pick.ts` measured what a
       focused text input does on this page at 390: the soft keyboard takes
       320 of the 844 and *"the number of options a thumb could reach without
       scrolling was ONE, on nine of the thirteen menus driven"*. A filter that
       raises the keyboard to shorten a list is a shorter list nobody can see.
       The typed COMBO keeps that job on a fine pointer, where the keyboard is
       already there — which is `pick.ts` rule 4 and is unchanged.

   THE HEIGHT IS ESTIMATED BEFORE THE FIRST PAINT AND MEASURED AFTER IT.
   A field is built before it is in the document, so `getBoundingClientRect`
   is zero at build time and a measure-then-refold would paint 5,823px once
   and then shrink it. So the fold is decided by PACKING the words at the
   page's own width (`autoFolds` below), and one `requestAnimationFrame` after
   mount the REAL height is read and the field steps down a state if the
   estimate was generous — measured, never trusted, and only ever in the
   direction that makes the field smaller. */

/** a lozenge's width, packed. The constants are the rendered pill at `--t2`
 *  with its padding and its reserved bold width, read off the phone. */
const CH = 9.5, PILLPAD = 34, PILLGAP = 8, PILLROW = 50, HEADROW = 48, SAYROW = 30;

/** WHAT THE FIELD MAY BE. The viewport the page is actually in, less the one
 *  piece of fixed chrome on it (TABLE.md §13a.1: *"nothing is fixed but the
 *  bottom bar"*), and never less than a floor that could not hold one
 *  cluster. */
function budget(): number {
  let h = 844;
  try {
    const vv = (globalThis as unknown as { visualViewport?: { height: number } })
      .visualViewport;
    h = (vv && vv.height) || window.innerHeight || 844;
  } catch (e) { /* no window: the estimate falls back to the phone */ }
  let bar = 0;
  try { const el = document.querySelector(".nu-bar");
        if (el) bar = el.getBoundingClientRect().height; } catch (e) {}
  return Math.max(320, h - bar - 8);
}

/** the width one row of pills has to fill. The document's own, because the
 *  field is not in the tree yet; narrower than the truth is the SAFE error
 *  (more rows, more folding), which is why nothing here rounds up. */
function fieldWidth(): number {
  try { return Math.max(240, (document.documentElement.clientWidth || 390) - 40); }
  catch (e) { return 350; }
}

/** how tall a cluster draws, packed at `w`. A folded one is its heading. */
function clusterHeight(b: Bin, w: number, shut: boolean): number {
  const head = b.word ? HEADROW : 0;
  if (shut) return head;
  let rows = 1, x = 0;
  for (const o of b.opts) {
    const pw = Math.max(44, String(o.label || "").length * CH + PILLPAD) + PILLGAP;
    if (x > 0 && x + pw > w) { rows++; x = pw; } else x += pw;
  }
  return head + rows * PILLROW;
}

/** THE FOLD THIS FIELD OPENS WITH. `at` is the index of the cluster holding
 *  the standing answer (−1 for none), and the answer is state A, B or C as a
 *  set of folded indexes — the first of the three that packs inside the
 *  budget. */
function autoFolds(plan: Bin[], at: number): Set<number> {
  if (plan.length < 2) return new Set();
  const w = fieldWidth(), cap = budget();
  /* AN UNHEADED CLUSTER IS NEVER FOLDED. A fold is not a disappearance only
     because its heading says how many it holds AND is the button that opens
     it — so a bin with no word (the leftovers, and the absent detent that
     belongs to no family) has neither, and folding it would hide options with
     no door back. It is drawn open in every state and counted in the budget. */
  const shy = (i: number) => !plan[i]!.word;
  const open = (shutAll: boolean, keep: number) => {
    let h = SAYROW;
    for (let i = 0; i < plan.length; i++)
      h += clusterHeight(plan[i]!, w, shutAll && i !== keep && !shy(i));
    return h;
  };
  if (open(false, -1) <= cap) return new Set();                       // A
  const one = at >= 0 ? at : 0;
  const shut = new Set<number>();
  for (let i = 0; i < plan.length; i++) if (i !== one && !shy(i)) shut.add(i);
  if (open(true, one) <= cap) return shut;                            // B
  if (!shy(one)) shut.add(one);                                       // C
  return shut;
}

/** THE ONE DOOR. Returns the field element a caller appends; it owns its own
 *  standing value from then on and patches itself in place forever. */

export function lozengeField(spec: LozSpec): HTMLElement {
  refuseSilentGrey(spec);

  const key = String(spec.key);
  const plan = bins(spec);
  const multi = !!spec.multi;
  const ordered = !!spec.ordered;
  const off = (spec.why && String(spec.why).trim()) || "";
  const label = spec.label == null ? key : String(spec.label);

  const host = document.createElement("div");
  host.className = "nu-lzfield" + (off ? " is-off" : "");
  host.setAttribute("role", "group");
  host.setAttribute("aria-label",
    off ? t("menu.withWhy", { name: label, why: off }) : label);
  host.dataset.sel = key;
  host.dataset.k = spec.k ? String(spec.k) : "lz|" + key;
  if (off) { host.dataset.why = off; host.setAttribute("aria-disabled", "true"); }
  if (spec.ungated) host.dataset.ungated = "true";

  /* ---- the state this field owns ------------------------------------- */
  let cur: string = spec.value == null ? "" : String(spec.value);
  const chain: string[] = (spec.values || []).map(String)
    .filter((v, i, a) => a.indexOf(v) === i);
  /* THE FOLD SURVIVES A REBUILD, AND THAT IS `src/table/sheet.ts GROUPOPEN`'s
     own precedent said again here. Every write on the band table ends in
     `changed() -> push(); draw()`, which throws the panel away and builds it
     again — so a fold held in a local `Set` would spring open under the thumb
     that closed it, once per tap. The memory is keyed by the FIELD's address,
     which is what makes it the same field across two builds. */
  const folded = FOLDS.get(spec.key) || new Set<number>();
  FOLDS.set(spec.key, folded);
  /* ...AND UNTIL A HAND HAS FOLDED ANYTHING, THE FIELD FOLDS ITSELF TO FIT
     (2026-09-06, TABLE.md §15). A vocabulary that packs inside the viewport
     opens whole, which is law 1 unchanged; one that does not opens on the
     cluster holding the standing answer. The moment a hand presses a heading
     the field stops guessing and the hand's answer stands. */
  const standingAt = () => {
    const want = multi ? (chain[0] || "") : cur;
    if (want === "" && !multi) return -1;
    return plan.findIndex((b) => b.opts.some((o) => String(o.value) === want));
  };
  if (!TOUCHED.has(key)) {
    const want = autoFolds(plan, standingAt());
    folded.clear();
    for (const i of want) folded.add(i);
  }
  let said = "";                             // what the last long press said
  let focusK: string | null = null;          // the roving tab stop's own key

  const stands = (v: string) => multi ? chain.indexOf(v) >= 0 : v === cur;
  const paintV = () => { host.dataset.v = multi ? chain.join(",") : cur; };
  paintV();

  /* ---- the drawing ---------------------------------------------------- */
  /* `data-w` IS THE SAME WORD AGAIN, AND IT IS GEOMETRY AND NOT COPY. A hot
     lozenge is FILLED and its word goes to `--fw-label` (DESIGN.md §2/16: hue
     for the kind, weight for the state) — and bold is WIDER, so on the old
     drawing the pill a thumb had just pressed grew under it and every pill
     after it moved, which is Paul's *"it shouldn't move at all"* said in
     typography. nu.css reserves the bold width in every state off this
     attribute (`.nu-lzword::after`), so pressing a word changes its colour and
     its weight and NOT ONE BOX ON THE FIELD. */
  const lozenge = (o: LozOption, tabbable: boolean) => {
    const v = String(o.value);
    const hot = stands(v);
    const own = o.why ? String(o.why).trim() : "";
    const refused = !!off || !!o.disabled;
    const why = off || own || "";
    /* A CHAIN OF ONE HAS NO ORDER, so it prints no number — the "1" beside a
       single standing word is a position nobody can act on, and on the absent
       detent ("default", standing alone) it is a number on the answer that
       means "nothing said here". Two words and up, every one is numbered. */
    const n = ordered && multi && hot && chain.length > 1 ? chain.indexOf(v) + 1 : 0;
    return html`<button type="button"
      class=${classMap({ "nu-lz": true, "is-hot": hot, "is-quiet": !!o.quiet })}
      data-k=${key + "|" + v}
      data-v=${v}
      tabindex=${tabbable && !refused ? "0" : "-1"}
      aria-pressed=${String(hot)}
      aria-disabled=${ifDefined(refused ? "true" : undefined)}
      data-why=${ifDefined(why ? why : undefined)}
      aria-label=${why ? t("menu.withWhy", { name: o.label, why }) : o.label}
      ><span class="nu-lzword" data-w=${o.label}>${o.label}</span
      >${n ? html`<small class="nu-lzn">${n}</small>` : nothing
      }</button> `;
  };

  /** ONE TAB STOP PER CLUSTER (law 8): the word standing, else the first one a
   *  hand may say. A cluster of nothing but refusals has none, and that is
   *  correct — there is nothing in it to focus. */
  const stopOf = (b: Bin): string | null => {
    const live = b.opts.filter((o) => !off && !o.disabled);
    if (!live.length) return null;
    const mine = live.find((o) => focusK === key + "|" + String(o.value));
    if (mine) return String(mine.value);
    const hot = live.find((o) => stands(String(o.value)));
    return String((hot || live[0]!).value);
  };

  const draw = () => render(html`${plan.map((b, ci) => {
    const shut = folded.has(ci);
    const stop = stopOf(b);
    /* WHERE THE ANSWER IS, WHEN THE ANSWER IS BEHIND A FOLD (§15 state C).
       A heading that holds the standing word says so — `aria-current`, which
       is what a screen reader announces and what nu.css paints in `--hand` —
       so a folded field still points at the record's own answer, and the word
       itself is on the field's head one row above. */
    const holds = b.opts.some((o) => stands(String(o.value)));
    /* ...AND IT SAYS WHICH WORD (§15 state C). A folded field that only
       pointed at the cluster would be a field whose answer is one tap away
       from being read, and this component's oldest rule is that you can
       always see the word you are on. It is a READOUT and not a pill — a
       `<span>`, no `data-k`, no `data-v` — because a second element on one
       address is what `chipStrip`'s own pin law forbids. */
    const held = shut && holds
      ? b.opts.filter((o) => stands(String(o.value))).map((o) => o.label).join(", ")
      : "";
    return html`<section
      class=${classMap({ "nu-lzcluster": true, "is-folded": shut,
                         "is-standing": shut && holds })}
      data-cluster=${b.word}
      data-hue=${ci % HUES}
      >${b.word ? html`<button type="button" class="nu-lzhead"
          data-k=${key + "|cluster|" + b.word}
          aria-expanded=${String(!shut)}
          aria-current=${ifDefined(shut && holds ? "true" : undefined)}
          ><span class="nu-lzheadword">${b.word}</span
          ><small class="nu-lzcount">${b.opts.length}</small
          >${held ? html`<span class="nu-lzheld">${held}</span>` : nothing
          }</button>` : nothing
      }<div class="nu-lzwrap" ?hidden=${shut}
        >${b.opts.map((o) => lozenge(o, stop === String(o.value)))}</div
      ></section>`;
  })}${off ? html`<small class="nu-why">${off}</small>` : nothing
  }<p class="nu-lzsay" role="status" aria-live="polite"
      ?data-said=${!!said}>${said}</p>`, host);

  /* ---- the writes ----------------------------------------------------- */
  const write = (v: string) => {
    if (off) return;
    const o = plan.flatMap((b) => b.opts).find((x) => String(x.value) === v);
    if (!o || o.disabled) return;
    if (multi) {
      const i = chain.indexOf(v);
      const on = i < 0;
      if (on) chain.push(v); else chain.splice(i, 1);
      paintV(); draw();
      /* THE WHOLE NEW ORDER, EVERY TIME. A caller that reconstructs a chain
         from a value and a boolean is a second owner of the order, and the
         order IS the meaning here (law 5). */
      if (typeof spec.onToggle === "function") spec.onToggle(v, on, chain.slice());
    } else {
      // A RE-TAP ON THE WORD ALREADY STANDING WRITES NOTHING, which is what
      // `chips()` does with the same gesture: one owner per fact, and a write
      // that changes nothing still recompiles a record.
      if (v === cur) return;
      cur = v;
      paintV(); draw();
      if (typeof spec.onWrite === "function") spec.onWrite(cur);
    }
    host.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const speak = (el: HTMLElement) => {
    const v = String(el.dataset.v || "");
    const o = plan.flatMap((b) => b.opts).find((x) => String(x.value) === v);
    // ITS SENTENCE, ELSE ITS OWN WORD. Both come from the caller; this file
    // has no third thing to say and does not invent one.
    said = (o && o.why && String(o.why).trim()) || (o ? o.label : v);
    draw();
  };

  /* ---- the thumb (law 3), delegated once (law 4) ----------------------- */
  let timer: number | null = null;
  let from: { x: number; y: number; el: HTMLElement } | null = null;
  let swallow = false;
  const disarm = () => { if (timer != null) { clearTimeout(timer); timer = null; } };

  host.addEventListener("pointerdown", (e: PointerEvent) => {
    const el = (e.target as HTMLElement | null)?.closest?.(".nu-lz") as HTMLElement | null;
    if (!el || !host.contains(el)) return;
    disarm();
    swallow = false;
    from = { x: e.clientX, y: e.clientY, el };
    timer = window.setTimeout(() => {
      timer = null;
      if (!from) return;
      // THE PRESS SAYS AND DOES NOT WRITE. The `click` that follows the
      // release is swallowed below, so a hand that holds a word to read its
      // reason has not thereby chosen it.
      swallow = true;
      speak(from.el);
    }, HOLD_MS);
  });
  host.addEventListener("pointermove", (e: PointerEvent) => {
    if (!from) return;
    if (Math.abs(e.clientX - from.x) + Math.abs(e.clientY - from.y) <= SLOP) return;
    // A PRESS THAT MOVED IS NEITHER. It belongs to the page under it.
    disarm(); from = null; swallow = true;
  });
  const lift = () => { disarm(); from = null; };
  host.addEventListener("pointerup", lift);
  host.addEventListener("pointercancel", () => { disarm(); from = null; swallow = true; });

  host.addEventListener("click", (e: Event) => {
    const tgt = e.target as HTMLElement | null;
    const head = tgt?.closest?.(".nu-lzhead") as HTMLElement | null;
    if (head && host.contains(head)) {
      const sec = head.closest("section.nu-lzcluster") as HTMLElement | null;
      const ci = sec ? Array.from(host.children).indexOf(sec) : -1;
      if (ci >= 0) { TOUCHED.add(key);
        if (folded.has(ci)) folded.delete(ci); else folded.add(ci); draw(); }
      return;
    }
    const el = tgt?.closest?.(".nu-lz") as HTMLElement | null;
    if (!el || !host.contains(el)) return;
    if (swallow) { swallow = false; return; }
    // A TAP ON A REFUSED WORD SAYS WHY AND WRITES NOTHING (law 6). This is the
    // half `disabled` used to swallow: the button took no click, so the only
    // reader that ever got the sentence was a screen reader.
    if (el.getAttribute("aria-disabled") === "true") { speak(el); return; }
    write(String(el.dataset.v || ""));
  });

  /* ---- the keyboard (law 8) -------------------------------------------- */
  /** The lozenges a focus may land on, cluster by cluster: not refused, not
   *  inside a folded cluster. Read off the RENDERED page rather than off the
   *  plan, because the fold is a fact about the DOM. */
  const walk = (): HTMLButtonElement[][] =>
    Array.from(host.querySelectorAll("section.nu-lzcluster")).map((sec) => {
      const w = sec.querySelector(".nu-lzwrap") as HTMLElement | null;
      if (!w || w.hidden) return [];
      return Array.from(w.querySelectorAll<HTMLButtonElement>("button.nu-lz"))
        .filter((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true");
    });

  const land = (b: HTMLButtonElement | undefined) => {
    if (!b) return;
    focusK = b.dataset.k || null;
    /* THE ROVING STOP MOVES THROUGH `draw()` AND NOT BY HAND. An imperative
       sweep here was the first draft and it was wrong in a way only the
       rendered page shows: it left ONE tab stop in the whole field until the
       next redraw, so Tab walked heading-heading-heading and then one lozenge,
       and the answer a hand got depended on whether anything had redrawn since
       it last pressed an arrow. `draw()` owns the stops (`stopOf`, one per
       cluster) and it reads `focusK`, so there is one rule and it is the same
       one before and after a keypress. Lit patches in place, so `b` is the
       same element after the render and still takes the focus. */
    draw();
    b.focus();
  };

  host.addEventListener("keydown", (e: KeyboardEvent) => {
    const el = (e.target as HTMLElement | null)?.closest?.(".nu-lz") as HTMLButtonElement | null;
    if (!el || !host.contains(el)) return;
    const k = e.key;
    // A KEYBOARD WRITE IS NEVER A SWALLOWED ONE. A long press that never got
    // its `click` (a thumb that lifted off the glass) must not eat the next
    // Enter somebody types.
    if (k === "Enter" || k === " " || k === "Spacebar") { swallow = false; return; }
    const groups = walk();
    const flat = groups.flat();
    const at = flat.indexOf(el);
    if (at < 0) return;
    if (k === "ArrowRight" || k === "ArrowLeft") {
      e.preventDefault();
      land(flat[Math.min(flat.length - 1, Math.max(0, at + (k === "ArrowRight" ? 1 : -1)))]);
      return;
    }
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      const gi = groups.findIndex((g) => g.indexOf(el) >= 0);
      if (gi < 0) return;
      const pos = groups[gi]!.indexOf(el);
      const d = k === "ArrowDown" ? 1 : -1;
      for (let j = gi + d; j >= 0 && j < groups.length; j += d) {
        const g = groups[j]!;
        if (!g.length) continue;                  // a folded or all-refused cluster
        land(g[Math.min(g.length - 1, pos)]);
        return;
      }
      // NO CLUSTER THAT WAY: stay put rather than wrap. Home/End are the ends.
      return;
    }
    if (k === "Home") { e.preventDefault(); land(flat[0]); return; }
    if (k === "End")  { e.preventDefault(); land(flat[flat.length - 1]); return; }
  });
  host.addEventListener("focusin", (e: Event) => {
    const el = (e.target as HTMLElement | null)?.closest?.(".nu-lz") as HTMLElement | null;
    if (el && host.contains(el)) focusK = el.dataset.k || null;
  });

  draw();
  /* ...AND THE ESTIMATE IS CHECKED AGAINST THE RENDERED FIELD, ONCE (§15).
     `autoFolds` packs words it has not measured; this reads the box the
     browser actually drew and steps the field DOWN a state if it is still
     past the budget. One frame, one direction, and never against a hand. */
  try {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => {
      if (!host.isConnected || TOUCHED.has(key) || plan.length < 2) return;
      if (host.getBoundingClientRect().height <= budget()) return;
      const one = standingAt() >= 0 ? standingAt() : 0;
      const all = folded.size >= plan.length;
      if (all) return;                       // state C already: nothing below it
      const shy2 = (i: number) => !plan[i]!.word;
      if (folded.size) { if (!shy2(one)) folded.add(one); }   // B -> C
      else for (let i = 0; i < plan.length; i++)
        if (i !== one && !shy2(i)) folded.add(i);             // A -> B
      draw();
    });
  } catch (e) { /* no rAF: the estimate stands */ }
  return host;
}
