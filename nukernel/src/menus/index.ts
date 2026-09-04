// nukernel/src/menus/index.ts — A SETTLED PARAMETER, IN A MENU. ONE OWNER, THREE WIDGETS.
//
// Paul, 2026-09-05: *"In general dropdowns barely work."*
//
// This module is `nukernel/ui/menus.js`, and it is the ONE place on this page
// that draws a menu. Which of the three widgets a vocabulary gets is
// `./pick.ts` — chips up to eight words, the native picker on a thumb, the
// typed combo on a keyboard — and the phone measurements that decided it are
// written down there rather than here, because they are the RULE's evidence
// and not the widget's.
//
// ===== THE HISTORY THIS FILE INHERITED, AND WHY IT IS KEPT WHOLE ========
// `ui/selects.js` drew every menu on this page from 2026-08-24 until today,
// and its header carried five dated reversals. They are moved here rather than
// deleted, because every one of them is still the reason a line below reads the
// way it does, and a rule whose argument has been thrown away is a rule the
// next reader will believe was arbitrary. `ui/selects.js` keeps the one control
// that is NOT a menu — `keyCircle`, the circle of fifths — and a tombstone
// pointing here.
//
//   TWO INSTRUCTIONS, BOTH RIGHT, AND THIS FILE IS WHERE THEY MEET. They were
//   said sixteen hours apart and neither is a correction of the other:
//
//     2026-08-24, morning (Paul) — "the options for each instrument in a song
//     section are now just one thing in a dropdown. That's not effective.
//     sheets of organized options should light up. when an option makes
//     another one unaccessible gray it out."
//     2026-08-24, evening (Paul) — "We can return some things to select menus:
//     meter / reading speed / swing / key / mode / the changes / chord quality
//     can be selects inside the 'the changes' table … in the band 'form'
//     section -- return to dropdowns/select … in voices -- plays, material,
//     instrument -- dropdowns/selects … in general where there is ONE option a
//     dropdown is preferred."
//
//   The morning sentence is about the DEVELOPMENT WORDS: a per-voice,
//   per-section choice among twenty-one melodic operators or sixty-eight kit
//   words, where you are SHOPPING — comparing many musical options at once, and
//   where "you cannot say that here, because there is no drummer" is the most
//   useful thing the page can tell you. Nothing in the evening list is that.
//   Every control named there is a SETTLED PARAMETER: the meter, the key, the
//   mode, what a voice plays, which cell it reads, which box it comes out of —
//   ONE value, decided once, that you do not browse. So: sheets where you
//   compare, menus where you have decided. (ui/sheets.js is NOT deprecated by
//   this file and must not be deleted; the two widgets take the same spec so a
//   control can move between them without its data tier moving.)
//
//   2026-08-25 (Paul): *"There are still many boxes that should be selects."*
//   The third sentence in a row going the same way, which is what makes it a
//   rule rather than a preference, and the rule the router applies became the
//   plain one: A SINGLE-CHOICE CONTROL IS A MENU. What it was weighed against,
//   and what lost, is a phone: measured at 390x844 on the shipped chant, one
//   voice tab drew fourteen single-choice sheets holding 152 lit options, five
//   of them 26-option development grids, and the axis they sat in was over
//   5,000px tall. The shape of the possible is only visible if it fits on the
//   screen, and it did not.
//
//   2026-09-02 (Paul, having used the composer on staging): *"The combo boxes
//   just don't work and are confusing. I was expecting more of onfocus show
//   custom dropdown then filter based on input — one line instead of two."*
//   The `<select>` inside a wrapper with a search box above it became ONE
//   widget: a field carrying the word this record is standing on, and, under
//   it, the list. That widget is `combo()` below, unchanged in every way a
//   gate can see.
//
//   2026-09-06 (this round): AND IT IS NOT THE ONLY WIDGET, because on a phone
//   it is the wrong one. See ./pick.ts for what the rendered page said.
//
// ===== WHAT IS TRUE OF ALL THREE ========================================
//   · THE ADDRESS DOES NOT MOVE WHEN THE WIDGET DOES. `data-sel` is the key,
//     byte for byte; `data-k` is `sel|<key>` (or the caller's own, see
//     `spec.k`); `data-v` is the value the record answers to. All three ride
//     the FOCUSABLE element — the chips' own strip, the `<select>`, the combo's
//     field — so ui/eight.js's `restoreFocus` puts the thumb back on exactly
//     the address it always did, and every gate that spells a control
//     `[data-sel="alphabet.mode"]` finds one element whichever widget is drawn.
//   · NO SILENT GREY. A word that is `disabled` or `quiet` with no `why` is a
//     THROW, in the same words ui/sheets.js:70 uses, and the reason is joined
//     to the word's own text (`optionText`) AND stamped as `data-why` so a gate
//     can read it back off the rendered artifact.
//   · A REFUSED CONTROL IS DISABLED AND SAYS WHY, and the reason is in its
//     accessible name as well as in `data-why`.
//   · THE STANDING ANSWER IS ALWAYS SHOWN. A value no table has is displayed,
//     said to be unknown, and left standing — a page that quietly rewrites the
//     record is the one failure a settled parameter must not have.
//   · TYPING IS A FILTER AND NEVER A VALUE. You cannot enter a word that is not
//     in the table, because the table IS the vocabulary.
//   · MENUS NEVER SCROLL INSIDE THEMSELVES (2026-08-16). No widget here has an
//     `overflow` or a `max-block-size`: a long list makes a long page, and a
//     page is the one thing on this surface that is allowed to be long.
//
// LIT, LIGHT DOM. Every gate on this page queries from the document root, so a
// shadow root would make every menu invisible to all of them. `render()` builds
// the structure; the combo's open/filter state is imperative on purpose, because
// re-rendering a field that has focus and a caret in it is how a filter loses
// both — measured on the widget this replaces and kept.

import { html, render, nothing } from "lit/html.js";
import { classMap } from "lit/directives/class-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import type { MenuSpec, Word, Picker } from "./api.js";
import { pickerFor, coarse, CHIPMAX, LONGSTRIP, forgetPointer } from "./pick.js";

export { pickerFor, coarse, CHIPMAX, LONGSTRIP, forgetPointer };
export type { MenuSpec, Word, Picker };

/** The words a choice says, reason included.
 *  THE ONLY PLACE A REASON IS JOINED TO A LABEL, so the gate can look for
 *  exactly this shape and so the three widgets below cannot drift apart. */
export function optionText(o: Word): string {
  const label = o.label == null ? String(o.value) : String(o.label);
  const why = o.why && String(o.why).trim();
  return why ? label + ", " + why : label;
}

/** The words a choice is FILTERED on — its label, and not the reason joined to
 *  it. You shop for "clarinet", never for "no drummer". */
const filterWord = (o: Word) => String(o.label == null ? o.value : o.label);

const valOf = (o: Word) => String(o.value == null ? "" : o.value);

/* HOW MANY GESTURES THIS DOCUMENT HAS SEEN. It is the whole of "a hand asked
   for this list" versus "the page put my thumb back" — see `combo()`'s focus
   handler. Capture phase, so it has counted before any field's own handler
   runs. */
let gestures = 0;
if (typeof document !== "undefined" && document.addEventListener)
  for (const ev of ["pointerdown", "touchstart", "keydown"])
    document.addEventListener(ev, () => { gestures++; },
      { capture: true, passive: true });

let listN = 0;

// CSS.escape is not in every engine this page has to survive (and never in a
// jsdom stub), and a key carries dots and pipes, both of which are selector
// syntax.
function esc(s: string): string {
  const C = (globalThis as { CSS?: { escape?: (x: string) => string } }).CSS;
  if (C && C.escape) return C.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
}

/** The default detent a table declares, or null when it declares none. */
function defaultDetent(words: Word[]): string | null {
  for (const o of words || []) {
    const v = valOf(o);
    const w = String(o.label == null ? "" : o.label).trim();
    if (v === "" || v === "default" || w === "—" || w.toLowerCase() === "default")
      return v;
  }
  return null;
}

/** `.is-seated` — you are standing where the record put you — and `.is-said` —
 *  you moved it. A MENU WHOSE TABLE DECLARES NO DEFAULT WEARS NEITHER: silence
 *  rather than a claim, because "you set this" is a fact and a control that
 *  cannot know it may not assert it. Painted on BOTH the box and the control,
 *  because nu.css has carried a rule for each spelling since 2026-09-02. */
function paintDetent(box: HTMLElement, ctl: HTMLElement,
                     value: string, detent: string | null): void {
  if (detent == null) return;
  const said = String(value) !== String(detent);
  for (const n of [box, ctl]) {
    n.classList.toggle("is-said", said);
    n.classList.toggle("is-seated", !said);
  }
}

/** A silent grey is the bug all three widgets exist to prevent, so it is the
 *  same throw, in the same words, and not a console warning. ui/sheets.js:70. */
function refuseSilentGrey(spec: MenuSpec): void {
  for (const o of spec.words || [])
    if ((o.disabled || o.quiet) && !(o.why && String(o.why).trim()))
      throw new Error('selects: "' + spec.key + '" / "' + valOf(o) +
        '" is ' + (o.disabled ? "disabled" : "quiet") + " with no `why`");
}

/** TWO CONTROLS SHARING A KEY DO NOT FIGHT OVER A `name`, but they still share
 *  a `data-k`, and `data-k` is how focus is put back after every redraw
 *  (ui/eight.js `restoreFocus`, which takes the FIRST). So a duplicate key
 *  means your finger lands on the wrong control, and it also means two callers
 *  genuinely disagree about who owns a fact. Said out loud, and suffixed. */
function uniqueKey(key0: string): string {
  const doc = document;
  let key = String(key0);
  if (doc.querySelector('[data-sel="' + esc(key) + '"]')) {
    console.error("selects: duplicate select key " + key +
      " — two controls would share one data-k");
    let n = 2;
    while (doc.querySelector('[data-sel="' + esc(key + "#" + n) + '"]')) n++;
    key = key + "#" + n;
  }
  return key;
}

/** The addresses, stamped on the one element a thumb and a gate both reach.
 *  This is the whole of the address law and it is four lines in one place. */
function address(ctl: HTMLElement, spec: MenuSpec, key: string,
                 widget: Picker, value: string): void {
  ctl.dataset.sel = key;
  ctl.dataset.k = spec.k ? String(spec.k) : "sel|" + key;
  ctl.dataset.v = value;
  ctl.dataset.widget = widget;
  if (spec.ungated) ctl.dataset.ungated = "true";
}

/** The rows a widget is actually drawn from: the vocabulary, plus — when the
 *  record is standing on a word no table has — that word, shown, said to be
 *  unknown, and left standing. Never counted as an answer on offer
 *  (`data-placeholder`), because the census is about how many ANSWERS a control
 *  has and this is a state of the page. */
interface Row { o: Word; value: string; word: string; placeholder?: boolean }
function rowsOf(spec: MenuSpec): { rows: Row[]; now: string; matched: Row } {
  const now = String(spec.value == null ? "" : spec.value);
  const rows: Row[] = (spec.words || []).map((o) =>
    ({ o, value: valOf(o), word: filterWord(o) }));
  let matched = rows.find((r) => r.value === now);
  if (!matched) {
    // TWO DIFFERENT SILENCES, SAID DIFFERENTLY. `value: ""` on a control whose
    // table has no "" is the producer's own shape — "no verb has been said
    // yet". A value that is NOT empty and not in the table is a fault in the
    // record rather than a state of the page, so it says so.
    const word = now === "" ? "choose one" : now + ", not in this table";
    matched = { o: { value: now, label: word, quiet: true, why: word },
                value: now, word, placeholder: true };
    rows.unshift(matched);
  }
  return { rows, now, matched };
}

/* ====================================================================== */
/* ---- 1 · CHIPS, up to eight words ------------------------------------ */
/* Chips are decisions, and this page has said so since 2026-08-16. The chip is
   `.nu-wchip` inside `.nu-wchips` — the SAME chip the grid's own strips wear
   (src/table/sheet.ts `chipStrip`), so there is one chip in the stylesheet and
   not two, and the same `data-k = "<field>|<value>"` a hand and a gate already
   know. What is added here is the ADDRESS on the strip itself, because a menu
   answers to one and a strip of buttons has no single element to put it on:
   the strip is `tabindex="0"` so `restoreFocus` can hand it back the thumb. */
function chips(spec: MenuSpec, key: string, box: HTMLElement): HTMLElement {
  const { rows, matched } = rowsOf(spec);
  const off = spec.why && String(spec.why).trim();
  const strip = document.createElement("div");
  strip.className = "nu-wchips nu-menu is-chips";
  strip.setAttribute("role", "group");
  strip.tabIndex = 0;
  const label = spec.label == null ? key : String(spec.label);
  strip.setAttribute("aria-label", off ? label + ", " + off : label);
  if (off) { strip.dataset.why = off; strip.classList.add("is-off");
             strip.setAttribute("aria-disabled", "true"); }
  address(strip, spec, key, "chips", matched.value);

  const detent = defaultDetent(spec.words || []);
  let cur = matched.value;
  const write = (v: string) => {
    const r = rows.find((x) => x.value === v);
    if (!r || off || r.o.disabled) return;
    if (v !== cur) {
      cur = v;
      strip.dataset.v = cur;
      paintDetent(box, strip, cur, detent);
      draw();
      strip.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof spec.onWrite === "function") spec.onWrite(cur);
    }
  };
  /* ...AND THE CHIP PRINTS ITS OWN REASON, WHICH IS THE THIRD WIDGET LEARNING
     A LAW THE OTHER TWO ALREADY KNEW (2026-09-07). The native picker joins the
     reason to the option's words (`optionText`) and so does the combo's `<li>`;
     the chip carried it in `data-why`, `title` and its accessible name and
     printed NOTHING, so a greyed word on a phone was a silent grey with a
     tooltip nobody on a phone can open. `test/rules-view.browser.js` R5a said
     so the hour the chips landed: two refused offers, `said: false`.
     THE REASON IS A LINE INSIDE THE CHIP, and that shape is not invented here:
     `.nu-chipprov` is already a `flex: 0 0 100%` second line inside this exact
     button (a motif's provenance), and nu.css:2692 states the sheet's own
     ruling on where a reason may live — *"it costs its OWN chip's height and
     nothing else's"*, with positioning and hoisting both rejected in writing.
     So the chip grows a line, its neighbours do not, and the strip's own
     `flex-wrap` does the rest.
     `title` STAYS ONLY WHERE THE REASON IS NOT PRINTED — the whole-strip
     refusal, whose sentence `menu()` prints once under the control. A tooltip
     repeating a sentence already on the glass is the noise the refused-control
     law is against. */
  const draw = () => render(html`${rows.map((r) => {
    const hard = !!off;
    const refused = hard || (!!r.o.disabled && r.value !== cur);
    const own = r.o.why ? String(r.o.why).trim() : "";
    const why = hard ? off : (own || null);
    const w = r.o.label == null ? r.value : String(r.o.label);
    return html`<button type="button"
      class=${classMap({ "nu-wchip": true, "is-quiet": !!r.o.quiet })}
      data-k=${key + "|" + r.value}
      data-v=${r.value}
      data-placeholder=${ifDefined(r.placeholder ? "true" : undefined)}
      aria-pressed=${String(r.value === cur)}
      ?disabled=${refused}
      aria-disabled=${ifDefined(refused ? "true" : undefined)}
      data-why=${ifDefined(why == null ? undefined : why)}
      title=${ifDefined(hard && off ? off : undefined)}
      aria-label=${why ? w + ", " + why : w}
      @click=${() => write(r.value)}><span class="nu-chipword">${w}</span
      >${own ? html`<small class="nu-why">${own}</small>` : nothing}</button> `;
  })}`, strip);
  draw();
  paintDetent(box, strip, cur, detent);
  return strip;
}

/* ---- 2 · THE NATIVE PICKER, above eight words on a thumb -------------- */
/* A phone's own wheel beats any list this page can draw: it cannot be covered
   by the keyboard (there is no keyboard), it cannot be scrolled off the screen
   by the pane under it, and it is the control every other app on the device
   uses for exactly this question. `<option disabled>` is a REAL refusal the
   browser enforces, and `<optgroup>` is the native heading announced by name.
   What it cannot do is carry a `<small class="nu-why">` inside an option, so
   the reason is APPENDED TO THE OPTION'S OWN WORDS — "at the fifth, no
   drummer" — which is the shape Paul's own note used. */
function native(spec: MenuSpec, key: string, box: HTMLElement): HTMLElement {
  const { rows, matched } = rowsOf(spec);
  const sel = document.createElement("select");
  // `.nu-combofield` is the plate, the 44px and the 16px iOS floor; the box's
  // own `.nu-combo > select` rule adds `appearance: none` and the page's ▾.
  sel.className = "nu-combofield nu-menu-native";
  const label = spec.label == null ? key : String(spec.label);
  const off = spec.why && String(spec.why).trim();
  sel.setAttribute("aria-label", off ? label + ", " + off : label);
  if (off) { sel.disabled = true; sel.setAttribute("aria-disabled", "true");
             sel.dataset.why = off; box.classList.add("is-off"); }
  address(sel, spec, key, "native", matched.value);

  let group: string | null = null;
  let bin: HTMLElement = sel;
  for (const r of rows) {
    if (r.o.group && r.o.group !== group) {
      group = String(r.o.group);
      const og = document.createElement("optgroup");
      og.label = group; sel.append(og); bin = og;
    } else if (!r.o.group) { group = null; bin = sel; }
    const op = document.createElement("option");
    op.value = r.value;
    op.textContent = optionText(r.o);
    if (r.o.disabled) op.disabled = true;
    if (r.o.why) op.dataset.why = String(r.o.why);
    if (r.placeholder) op.dataset.placeholder = "true";
    if (r === matched) op.selected = true;
    bin.append(op);
  }
  sel.value = matched.value;

  const detent = defaultDetent(spec.words || []);
  paintDetent(box, sel, matched.value, detent);
  let cur = matched.value;
  sel.addEventListener("change", () => {
    const v = String(sel.value);
    if (v === cur) return;
    cur = v;
    sel.dataset.v = cur;
    paintDetent(box, sel, cur, detent);
    if (typeof spec.onWrite === "function") spec.onWrite(cur);
  });
  return sel;
}

/* ---- 3 · THE TYPED COMBO, above eight words with a keyboard ----------- */
/* ONE widget, one line: a field showing the word this record is standing on,
   and, under it, the list. Ported from ui/selects.js `buildCombo` (2026-09-02)
   with its behaviour unchanged in every way a gate can see — focus opens,
   typing filters, Enter commits, Escape restores, the word is always in the
   field, the list is IN THE FLOW and always in the DOM (`hidden` until it
   opens), so every gate that reads the shape of the possible off the rendered
   artifact can still read it without opening forty controls.
   TWO THINGS ARE NEW, and both are repairs to something the phone measured:
     · IT COMES BACK OPEN AFTER A REDRAW IT DID NOT ASK FOR. `OPENKEY` is the
       key of the menu a HAND opened, cleared the moment a value commits or a
       hand closes it. Four of thirteen menus opened on `focusin` and were shut
       again inside the same gesture, because the page redrew under them and
       `restoreFocus` handed focus to a brand-new field that had seen no
       gesture since it was born. `gestures`/`bornAt` is still the guard that
       keeps the 2026-08 "the box just pops up again" bug dead — a COMMIT
       clears `OPENKEY`, so a menu never re-opens itself after answering.
     · IT IS NEVER DRAWN ON A COARSE POINTER. ./pick.ts, rule 2. */
let OPENKEY: string | null = null;

function combo(spec: MenuSpec, key: string, box: HTMLElement): HTMLElement {
  const doc = document;
  const { rows, matched } = rowsOf(spec);
  const label = spec.label == null ? key : String(spec.label);
  const off = spec.why && String(spec.why).trim();

  const f = doc.createElement("input");
  f.type = "text";
  f.className = "nu-combofield";
  f.setAttribute("role", "combobox");
  f.setAttribute("aria-autocomplete", "list");
  f.setAttribute("aria-expanded", "false");
  f.autocomplete = "off";
  f.spellcheck = false;
  // READONLY UNTIL FOCUS. A closed combo is a word, not a text entry.
  f.readOnly = true;
  address(f, spec, key, "combo", matched.value);

  const list = doc.createElement("ul");
  list.className = "nu-combolist";
  list.id = "nu-combolist-" + (++listN);
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", label);
  list.hidden = true;
  f.setAttribute("aria-controls", list.id);
  if (off) {
    f.disabled = true; f.setAttribute("aria-disabled", "true");
    f.dataset.why = off; box.classList.add("is-off");
  }
  f.setAttribute("aria-label", off ? label + ", " + off : label);

  interface Li extends Row { li: HTMLLIElement }
  const lis: Li[] = [];
  let group: string | null = null;
  for (const r of rows) {
    if (r.o.group && r.o.group !== group) {
      group = String(r.o.group);
      const h = doc.createElement("li");
      h.className = "nu-combogrp"; h.textContent = group;
      h.setAttribute("role", "presentation"); h.dataset.grp = group;
      list.append(h);
    }
    if (!r.o.group) group = null;
    const li = doc.createElement("li");
    li.className = "nu-comboopt" + (r.o.quiet ? " is-quiet" : "");
    li.textContent = optionText(r.o);
    li.id = list.id + "-o" + lis.length;
    li.setAttribute("role", "option");
    li.dataset.v = r.value;
    if (r.o.disabled) { li.classList.add("is-off"); li.setAttribute("aria-disabled", "true"); }
    if (r.o.why) li.dataset.why = String(r.o.why);
    if (r.placeholder) li.dataset.placeholder = "true";
    const on = r === matched;
    li.setAttribute("aria-selected", on ? "true" : "false");
    if (on) li.classList.add("is-on");
    list.append(li);
    lis.push({ ...r, li });
  }
  const none = doc.createElement("li");
  none.className = "nu-why nu-combonone";
  none.textContent = "no word here matches";
  none.setAttribute("role", "presentation");
  none.hidden = true;
  list.append(none);

  /* THE BOX SHRINKS TO ITS WORDS, AS THE `<select>` DID. An `<input>`'s
     intrinsic width is its `size` attribute, so without this every menu draws
     at nu.css's cap (measured 2026-09-02 on Rules at 390: every enum row 224px,
     the control on its own line, four rows 66px tall and one 96px). Floor 4,
     ceiling 30, and the stylesheet's caps narrow it further where it stands. */
  { let widest = 0;
    for (const r of lis) widest = Math.max(widest, r.word.length);
    f.size = Math.max(4, Math.min(30, widest)); }

  box.append(f, list);

  const bornAt = gestures;
  const detent = defaultDetent(spec.words || []);
  const rowOf = (v: string): Li => lis.find((r) => r.value === String(v)) || lis[0]!;
  let cur = matched.value;
  let open = false, active = -1, firing = false, typed = false;
  f.value = rowOf(cur).word;
  paintDetent(box, f, cur, detent);

  /* A GROUP HEADING NEVER STANDS OVER NOTHING. */
  const showGroups = () => {
    let head: Element | null = null, any = false;
    for (const n of Array.from(list.children)) {
      if (n.classList.contains("nu-combogrp")) {
        if (head) (head as HTMLElement).hidden = !any;
        head = n; any = false;
      } else if (!(n as HTMLElement).hidden &&
                 n.getAttribute("role") === "option") any = true;
    }
    if (head) (head as HTMLElement).hidden = !any;
  };
  const visible = () => lis.filter((r) => !r.li.hidden && !r.o.disabled);
  const setActive = (i: number) => {
    const was = active >= 0 ? lis[active] : null;
    if (was) was.li.classList.remove("is-active");
    active = i;
    const now = i >= 0 ? lis[i] : null;
    if (now) {
      now.li.classList.add("is-active");
      f.setAttribute("aria-activedescendant", now.li.id);
      // `block: "nearest"` — the PAGE moves only if the word is off it, which
      // is what "the list is in the flow" buys: nothing scrolls inside.
      try { now.li.scrollIntoView({ block: "nearest" }); } catch (e) {}
    } else f.removeAttribute("aria-activedescendant");
  };
  const openList = (selectAll?: boolean) => {
    if (f.disabled || open) return;
    open = true; typed = false; OPENKEY = key;
    for (const r of lis) r.li.hidden = false;
    none.hidden = true;
    showGroups();
    list.hidden = false;
    f.setAttribute("aria-expanded", "true");
    box.classList.add("is-open");
    f.readOnly = false;
    setActive(lis.indexOf(rowOf(cur)));
    if (selectAll !== false) { try { f.select(); } catch (e) {} }
  };
  const closeList = (restore?: boolean, byHand?: boolean) => {
    open = false; typed = false;
    if (byHand !== false) OPENKEY = null;
    // EVERY OPTION GOES BACK ON THE PAGE WHEN THE LIST SHUTS: a filter that
    // outlived its own list would leave `hidden` words in the DOM, and the
    // shape of the possible is read off this DOM by every gate there is.
    for (const r of lis) r.li.hidden = false;
    none.hidden = true;
    showGroups();
    list.hidden = true;
    f.setAttribute("aria-expanded", "false");
    box.classList.remove("is-open");
    setActive(-1);
    f.readOnly = true;
    if (restore !== false) f.value = rowOf(cur).word;
  };
  const filter = (q0: string) => {
    const q = String(q0 == null ? "" : q0).trim().toLowerCase();
    for (const r of lis)
      r.li.hidden = !!q && r.word.toLowerCase().indexOf(q) < 0;
    showGroups();
    const vis = visible();
    setActive(vis[0] ? lis.indexOf(vis[0]) : -1);
    none.hidden = vis.length > 0;
  };
  /* ONE OWNER FOR RECOMPILE. `onWrite` is called from here and this file never
     redraws — ui/eight.js's `changed()` owns that. */
  const commit = (value: string) => {
    const r = lis.find((x) => x.value === String(value));
    if (!r || r.o.disabled) return false;
    if (r.value === cur) { closeList(true); return true; }
    cur = r.value;
    f.dataset.v = cur;
    f.value = r.word;
    for (const x of lis) {
      x.li.setAttribute("aria-selected", x === r ? "true" : "false");
      x.li.classList.toggle("is-on", x === r);
    }
    paintDetent(box, f, cur, detent);
    closeList(false);
    // THE CHANGE EVENT IS A NOTIFICATION AND NOT THE OWNER.
    firing = true;
    try { f.dispatchEvent(new Event("change", { bubbles: true })); } finally { firing = false; }
    if (typeof spec.onWrite === "function") spec.onWrite(cur);
    return true;
  };

  f.addEventListener("pointerdown", (e) => {
    if (f.disabled) return;
    if (open) { closeList(true); f.blur(); return; }   // a second tap shuts it
    e.preventDefault();
    f.focus();
    // ...AND IF IT ALREADY HAD FOCUS, `focus` never fires and the handler below
    // never runs. Measured: a page that had just put the thumb back on this
    // very field swallowed the tap that came next.
    if (doc.activeElement === f && !open) openList(true);
  });
  f.addEventListener("focus", () => {
    if (f.disabled || open) return;
    // A HAND, OR THE PAGE PUTTING THE THUMB BACK? A gesture since this field
    // was built means a hand; no gesture means a redraw. And a field REBUILT
    // while its own menu was open comes back open, which is the other half.
    if (gestures <= bornAt && OPENKEY !== key) return;
    openList(true);
  });
  f.addEventListener("blur", () => { if (open) closeList(true, false); });
  f.addEventListener("input", () => {
    typed = true;
    if (!open) openList(false);
    typed = true;                       // openList clears it; a hand did this
    filter(f.value);
  });
  f.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "Escape") { if (open) { e.preventDefault(); closeList(true); } return; }
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      if (!open) { openList(true); return; }
      const vis = visible();
      if (!vis.length) return;
      const d = k === "ArrowDown" ? 1 : -1;
      const on0 = active >= 0 ? lis[active] : null;
      let i = on0 ? vis.indexOf(on0) : -1;
      i = i < 0 ? (d > 0 ? 0 : vis.length - 1) : (i + d + vis.length) % vis.length;
      const want = vis[i];
      if (want) setActive(lis.indexOf(want));
      return;
    }
    if (k === "Enter") {
      if (!open) return;
      e.preventDefault();
      const vis = visible();
      const on = active >= 0 ? lis[active] : null;
      const r = on && vis.indexOf(on) >= 0 ? on
              : (vis.length === 1 ? (vis[0] || null) : null);
      if (r) commit(r.value);
      return;
    }
    if (k === "Tab") { if (open) closeList(true); return; }
    if (!open && k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) openList(true);
  });
  /* A SYNTHETIC `change` IS A COMMIT, the way it was on the `<select>`: anything
     driving this page that writes a value into the control and fires `change` is
     making the gesture it always made. TYPED TEXT IS NOT A VALUE — the browser
     fires `change` on a text field that lost focus after an edit, and `typed` is
     set by `input`, which `.value = …` does not fire. */
  f.addEventListener("change", () => {
    if (firing) return;
    if (typed) { f.value = rowOf(cur).word; return; }
    const want = String(f.value);
    const r = lis.find((x) => x.value === want) ||
              lis.find((x) => x.word === want) ||
              lis.find((x) => optionText(x.o) === want);
    if (r) commit(r.value); else f.value = rowOf(cur).word;
  });
  const takeTap = (e: Event) => {
    const t = e.target as HTMLElement | null;
    const li = t && t.closest ? t.closest("li[role=option]") as HTMLLIElement | null : null;
    if (!li || !list.contains(li)) return;
    e.preventDefault(); e.stopPropagation();
    if (li.getAttribute("aria-disabled") === "true") return;
    const r = lis.find((x) => x.li === li);
    if (r) commit(r.value);
  };
  list.addEventListener("pointerdown", takeTap);
  list.addEventListener("click", takeTap);

  // and it comes back open if that is what it was
  if (OPENKEY === key) setTimeout(() => { if (OPENKEY === key && !open) {
    try { f.focus(); } catch (e) {} openList(true); } }, 0);
  return f;
}

/* ====================================================================== */
/** THE ONE DOOR. `menu(spec)` returns the box a caller appends — a
 *  `<span class="nu-combo">` in every case, because that is the chassis nu.css
 *  has dressed since 2026-09-02 (the plate, the ▾, the detent, the 30ch cap)
 *  and a menu may not read as a different species for being drawn a different
 *  way. Which widget it holds is ./pick.ts's answer and nobody else's. */
export function menu(spec: MenuSpec): HTMLElement {
  refuseSilentGrey(spec);
  const key = uniqueKey(spec.key);
  const box = document.createElement("span");
  box.className = "nu-combo" + (spec.compact ? " is-compact" : "");
  box.dataset.combo = key;

  const words = spec.words || [];
  if (!words.length) {
    // NEVER AN EMPTY CONTROL, which is a bug that looks like a design — the
    // same refusal ui/sheets.js:114 makes with its "nothing to choose here".
    const why = (spec.why && String(spec.why).trim()) || "nothing to choose here";
    box.dataset.widget = "native";
    const empty = native({ ...spec, why,
      words: [{ value: "", label: "nothing to choose here",
                quiet: true, why: "nothing to choose here" }],
      value: "" }, key, box);
    empty.dataset.widget = "native";
    box.classList.add("is-off");
    box.append(empty);
    return box;
  }

  const pick = pickerFor(words.length, { tight: !!spec.compact });
  box.dataset.widget = pick;
  if (pick === "chips") box.append(chips(spec, key, box));
  else if (pick === "native") box.append(native(spec, key, box));
  else combo(spec, key, box);           // appends its own field and list
  return box;
}

/** One labelled control: `<p class="nu-sel"><label><span class="nu-w">…</span>
 *  <span class="nu-combo">…</span></label></p>`, plus the visible copy of the
 *  reason when the whole thing is unavailable. Returns the `<p>`. */
export function menuField(parent: ParentNode, spec: MenuSpec): HTMLElement {
  const p = document.createElement("p");
  p.className = "nu-sel";
  const lab = document.createElement("label");
  const w = document.createElement("span");
  w.className = "nu-w";
  w.textContent = (spec.label == null ? String(spec.key) : String(spec.label)) + " ";
  lab.append(w, menu(spec));
  p.append(lab);
  // `menu` has already refused and said why to the accessibility tree; what a
  // wrapper adds is the sentence a sighted reader can see without opening
  // anything. The list greys its words; a shut control has nowhere to show
  // them, so all it can do is refuse and say why — which it must, both ways.
  if (spec.why) {
    p.classList.add("is-off");
    const s = document.createElement("small");
    s.className = "nu-why";
    s.textContent = String(spec.why);
    p.append(s);
  }
  parent.append(p);
  return p;
}

/** A row of labelled menus under one heading. A `<div>`, never a `<fieldset>`:
 *  one unavailable control must not take its neighbours down with it. */
export function menuRow(parent: ParentNode, heading: string | null,
                        specs: MenuSpec[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "nu-sels";
  if (heading) {
    const h = document.createElement("h3");
    h.textContent = String(heading);
    wrap.append(h);
  }
  for (const s of specs || []) menuField(wrap, s);
  parent.append(wrap);
  return wrap;
}

/** The bare widget with no printed question over it — a table cell, a slot row,
 *  a bus plate. Same widget, one class, so the two forms cannot drift. */
export function menuEl(spec: MenuSpec): HTMLElement {
  return menu({ ...spec, compact: true });
}
