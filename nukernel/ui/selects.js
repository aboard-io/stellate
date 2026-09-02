// nukernel/ui/selects.js — A SETTLED PARAMETER, IN A MENU.
// ...AND, FOR EXACTLY ONE OF THEM, IN A CIRCLE (2026-08-25, see keyCircle
// at the foot of this file). The title is not amended past that: fifty-two
// controls on the page are menus and one is a diagram.
//
// ...AND ON 2026-09-02 THE MENU STOPPED BEING A `<select>`. The line above is
// kept: fifty-two controls on the page are still menus, one is still a diagram,
// and what changed is the element a menu is made of. Paul, after using the
// composer on staging: *"The combo boxes just don't work and are confusing. I
// was expecting more of onfocus show custom dropdown then filter based on input
// — one line instead of two."* The whole of that reversal — what moved, what
// did not, and why every `data-sel` / `data-k` / `data-v` address is
// byte-identical across it — is at `buildCombo` below, and the law it amends
// is amended IN PLACE at `shouldSelect`. Everything in this header about what a
// closed control can and cannot say is unchanged and still true of the shut
// combo: the paragraphs below say `<select>` because that is the element they
// were written about, and the reasoning survives the swap intact.
//
// TWO INSTRUCTIONS, BOTH RIGHT, AND THIS FILE IS WHERE THEY MEET. They were
// said sixteen hours apart and neither one is a correction of the other:
//
//   2026-08-24, morning (Paul) — "the options for each instrument in a song
//   section are now just one thing in a dropdown. That's not effective. sheets
//   of organized options should light up. when an option makes another one
//   unaccessible gray it out."
//   2026-08-24, evening (Paul) — "We can return some things to select menus:
//   meter / reading speed / swing / key / mode / the changes / chord quality
//   can be selects inside the 'the changes' table … in the band 'form' section
//   -- return to dropdowns/select … in voices -- plays, material, instrument
//   -- dropdowns/selects … in general where there is ONE option a dropdown is
//   preferred."
//
// The morning sentence is about the DEVELOPMENT WORDS: a per-voice,
// per-section choice among twenty-one melodic operators or sixty-eight kit
// words, where you are SHOPPING — comparing many musical options at once, and
// where "you cannot say that here, because there is no drummer" is the most
// useful thing the page can tell you. Nothing in the evening list is that.
// Every control named there is a SETTLED PARAMETER: the meter, the key, the
// mode, what a voice plays, which cell it reads, which box it comes out of —
// ONE value, decided once, that you do not browse. A lit sheet of twelve keys
// is twelve tap targets and 500px of page spent saying a thing that fits in a
// word. So: sheets where you compare, selects where you have decided.
//   (THE KEY LEFT THIS LIST ON 2026-08-25 and the sentence above did not have to
//   change to let it go — Paul: "Maybe put the circle of fifths back in there
//   for key selection, it was nice." The key is still a settled parameter and a
//   lit grid of twelve is still the wrong widget for one; what the paragraph
//   above never considered is that a settled parameter can have a SHAPE, and
//   this one has the oldest shape in the trade. `keyCircle` at the foot of this
//   file draws it, in the same 300px a menu and its label were costing. The
//   MODE stays a menu right beside it, because its list is longer than major
//   and minor and seven rings would be a worse object than one.)
// ui/sheets.js is NOT deprecated by this file and must not be deleted; the two
// widgets take the same `spec` (PROGRAM.md §2.3) precisely so a control can
// move between them on a sentence like tonight's without its data tier moving.
//
// ...AND THE RULE THAT DECIDES THE REST OF THE PAGE FOR US: "in general where
// there is ONE OPTION a dropdown is preferred." Read plainly, that is a law
// about every sheet on the page, not a remark about the seven named above — a
// lit grid of one option is not a comparison, it is a label pretending to be a
// choice, and it costs a 44px target to say a thing nobody can change.
// `sheetRow()` below is a drop-in for ui/sheets.js's own: same name, same
// signature, and it routes each spec by counting its options. Every caller
// gets the law by changing the path in one `import`.
//
// WHAT A <select> CAN AND CANNOT DO, MEASURED AGAINST THE SHEET'S OWN LAWS.
//   · `<option disabled>` is a REAL refusal the browser enforces, the same way
//     `<input disabled>` is. The grey is not a lie.
//   · NO SILENT GREY still holds, and it holds DIFFERENTLY: an <option> may
//     contain nothing but text, so a `<small class="nu-why">` cannot ride
//     inside it. The reason is therefore APPENDED TO THE OPTION'S OWN TEXT —
//     "at the fifth, no drummer" — which is exactly the shape Paul's own note
//     used ("…, no drummer"). A comma and not a dash: eSpeak NG pauses on a
//     comma and says a dash out loud in some voices.
//   · the reason for a WHOLE control being unavailable cannot live in the
//     collapsed select at all, so it goes in a `<p class="nu-why">` beside it
//     and the select is `disabled` — the same two facts the sheet puts on its
//     <fieldset>.
//   · `<optgroup>` is the native heading, announced by name ("the subject,
//     group") where `.nu-grp` is only a paragraph a sheet places nearby.
//   · what is LOST is the shape of the possible: a closed select shows one
//     word and you cannot see the greyed nine behind it. That loss is the
//     whole argument for the sheets, and it is why the development words keep
//     theirs. What it is NOT, any more, is a reason to keep `multi` away from a
//     <select>: that argument was made here and half of it was overruled on the
//     evening of 2026-08-24 (see `shouldSelect` below).
//
// THIS FILE DOES NOT KNOW WHAT A DOCUMENT IS, the same as its sibling: it is
// handed fully-resolved options by nukernel/avail.js and calls back. It imports
// ui/sheets.js and NOTHING ELSE — not the record, not the gates, not the page —
// because `sheetRow` below has to be able to draw a real sheet for the specs it
// declines to convert, and a caller that had to hand the module in would be a
// caller whose diff was more than a path.
import { sheet as litSheet } from "./sheets.js";

// (A `const LONE = 1` stood here — the option-count threshold — with the note
// "ONE OPTION IS A SELECT AND TWO OPTIONS ARE STILL A SHEET." It was retired
// on 2026-08-25 when the threshold stopped being a count; the argument it was
// made of is kept in full over `shouldSelect`, which is where it lost.)

const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};

/** The words an <option> says, reason included.
 *  THE ONLY PLACE A REASON IS JOINED TO A LABEL, so the gate can look for
 *  exactly this shape and so the two callers below cannot drift apart. */
export function optionText(o) {
  const label = o.label == null ? String(o.value) : String(o.label);
  const why = o.why && String(o.why).trim();
  return why ? label + ", " + why : label;
}

/* ---------- THE COMBO BOX IS THE CONTROL (2026-09-02) ----------------------
   Paul, 2026-09-02, having used the composer on staging: *"The combo boxes
   just don't work and are confusing. I was expecting more of onfocus show
   custom dropdown then filter based on input — one line instead of two."*

   THE OLD SENTENCE, KEPT ABOVE THE NEW ONE, because it is the law this
   replaces and it was right for as long as it stood:

     "IT IS STILL A `<select>`, AND THAT IS THE LOAD-BEARING DECISION. The
      2026-08-25 law — A SINGLE-CHOICE CONTROL IS A `<select>`, full stop
      (`shouldSelect` below) — is untouched; `data-sel`, `data-k` and `data-v`
      are untouched, which is what puts focus back after every `draw()`; every
      gate that counts menus counts the same menus. What is added is a WRAPPER
      around the select, HERE and at no other call site, and three things it
      makes possible that a bare `<select>` cannot do: the page's own arrow
      (nu.css `.nu-combo::after` over `appearance: none`), the DETENT colours,
      and — for a list too long to be a menu — a filter."

   AND THE NEW ONE: A SINGLE-CHOICE CONTROL IS A COMBO BOX. Not a wrapper
   around a menu with a second box above it — ONE widget, one line: a text
   field showing the word this record is standing on, and, under it, the list.

   WHAT PAUL MEASURED AND WHAT IT COST. The wrapper round was two controls
   stacked in one box — an `<input type=search>` that filtered and a `<select>`
   that answered — which is exactly "two lines instead of one", and the probe of
   the same page found the other half of it: *"`.nu-combo-filter` has no
   placeholder and no label — on Produce two empty white boxes float over two
   'choose one' combos."* A placeholder was added to the filter and the shape
   was still two controls for one question. `comboFilter` is deleted here rather
   than fixed: the field IS the filter now, which is the whole of what a combo
   box has meant since 1993.

   WHAT DOES NOT MOVE, AND MUST NOT. `data-sel`, `data-k` (`sel|` + key) and
   `data-v` ride on the FIELD, which is the element that takes focus — so
   ui/eight.js's `restoreFocus` puts the thumb back on exactly the address it
   always did, and every gate that spells a control `[data-sel="alphabet.mode"]`
   still finds one element. The refusal law does not move either: a refused
   option is greyed WITH ITS REASON JOINED TO ITS WORDS (`optionText`, above)
   and stamped `data-why`, and a refused CONTROL is a disabled field carrying
   `data-why` with the sentence printed beside it.

   THE LIST IS IN THE FLOW AND IT IS ALWAYS IN THE DOM. Two decisions, one
   argument each:
     · IN FLOW. It is inserted directly after the field, inside the same box,
       so opening it GROWS THE PAGE. Nothing floats over anything and nothing
       scrolls inside itself — the page's own law ("menus never scroll inside
       themselves"), which a `position: fixed` popover with a `max-height`
       would break the first time an instrument list of 108 opened on a phone.
       A long list makes a long page, and a page is the one thing on this
       surface that is allowed to be long.
     · ALWAYS IN THE DOM, `hidden` until it opens. A `<select>` carried all
       108 of its `<option>`s in the document at all times; this carries the
       same 108 `<li>`s, so the DOM weight is what it was — and every gate that
       reads the shape of the possible off the rendered artifact (no silent
       grey, the option census, the greyed-with-a-reason walk) can still read
       it without opening forty controls. `hidden` keeps them out of the
       accessibility tree and out of the text diet, which is what a closed
       listbox is supposed to be.

   IT DOES NOT RE-OPEN ITSELF AFTER A REDRAW, and this is the same bug the
   `<select>` had and the same measurement that named it (ui/eight.js's
   `opensAPicker`: *"When I select something the box just pops up again"* —
   the page re-focused a brand-new control 272ms after the gesture and the
   platform re-presented its popup). A combo box opens on FOCUS, so it would
   have inherited the bug whole. `gestures` below is the discriminator and it
   is exact rather than a timeout: the module counts the user's own pointer and
   key gestures on the document, each field remembers the count it was BORN at,
   and a `focus` arriving with no new gesture since then is the page putting the
   thumb back — never a hand reaching for the control. Tab in and it opens (the
   Tab keydown is a gesture); be handed focus by `draw()` and it does not.

   TYPING IS A FILTER AND NEVER A VALUE. Unchanged from the wrapper round and
   for the same reason: you cannot type a word that is not in the table,
   because the table IS the vocabulary and inventing one is the thing a settled
   parameter must not allow. The field is `readonly` until it is focused, so a
   closed combo cannot be edited at all, and Escape or a blur puts the current
   word back whatever was typed over it.

   ---- THE DETENT, WHICH MOVES ONTO THE FIELD --------------------------------
   `.is-seated` — you are standing where the record put you — and `.is-said` —
   you moved it. It was written on the wrapper because the wrapper was the only
   element the page owned; the field is the page's own element now, so the
   colour goes on the thing that carries the word. A MENU WHOSE TABLE DECLARES
   NO DEFAULT WEARS NEITHER CLASS: silence rather than a claim, because "you
   set this" is a fact and a control that cannot know it may not assert it. */

/* HOW MANY GESTURES THIS DOCUMENT HAS SEEN. See the paragraph above: it is the
   whole of "a hand asked for this list" versus "the page put my thumb back".
   Capture phase, so it has counted before any field's own handler runs. */
let gestures = 0;
if (typeof document !== "undefined" && document.addEventListener)
  for (const ev of ["pointerdown", "touchstart", "keydown"])
    document.addEventListener(ev, () => { gestures++; },
      { capture: true, passive: true });

let comboN = 0;

/** The words an option is filtered ON — its label, and not the reason joined
 *  to it. You shop for "clarinet", never for "no drummer". */
const filterWord = (o) => String(o.label == null ? o.value : o.label);

/** ONE WIDGET, BUILT ONCE, USED BOTH WAYS. `selectEl` returns it bare (for a
 *  table cell, a slot row, a bus plate) and `selectField` puts it under a
 *  printed question; `compact` is the only difference and it is a class, so
 *  the two forms cannot drift apart in anything but their paint.
 *
 *  spec = { key, label, options, value, set, why?, ungated? } — PROGRAM.md §2.3 */
function buildCombo(spec, compact) {
  const options = spec.options || [];
  // A SILENT GREY IS THE BUG ALL THREE WIDGETS EXIST TO PREVENT, so it is the
  // same throw, in the same words, and not a console warning. ui/sheets.js:70.
  for (const o of options)
    if ((o.disabled || o.quiet) && !(o.why && String(o.why).trim()))
      throw new Error('selects: "' + spec.key + '" / "' + o.value +
        '" is ' + (o.disabled ? "disabled" : "quiet") + " with no `why`");

  const doc = document;
  // TWO CONTROLS SHARING A KEY DO NOT FIGHT OVER A `name` HERE, but they still
  // share a `data-k`, and `data-k` is how focus is put back after every redraw
  // (ui/eight.js:1156, `box.querySelector('[data-k=…]')`, which takes the
  // FIRST). So a duplicate key means your finger lands on the wrong control,
  // and it also means two callers genuinely disagree about who owns a fact.
  // Said out loud, and suffixed, exactly as ui/sheets.js:79 does it.
  let key = String(spec.key);
  if (doc.querySelector('[data-sel="' + esc(key) + '"]')) {
    console.error("selects: duplicate select key " + key +
      " — two controls would share one data-k");
    let n = 2;
    while (doc.querySelector('[data-sel="' + esc(key + "#" + n) + '"]')) n++;
    key = key + "#" + n;
  }

  const wrap = el("span", null, "nu-combo" + (compact ? " is-compact" : ""));
  wrap.dataset.combo = key;

  const f = doc.createElement("input");
  f.type = "text";
  f.className = "nu-combofield";
  f.setAttribute("role", "combobox");
  f.setAttribute("aria-autocomplete", "list");
  f.setAttribute("aria-expanded", "false");
  f.autocomplete = "off";
  f.spellcheck = false;
  // READONLY UNTIL FOCUS. A closed combo is a word, not a text entry: nothing
  // can be typed into it, no caret appears in it, and no phone offers a
  // keyboard for it until it is actually opened.
  f.readOnly = true;
  f.dataset.sel = key;
  // FOCUS SURVIVES THE REDRAW BY THIS KEY, unchanged since the <select>:
  // `sel|` and not `opt|`, because the sheet's key names an option and this
  // one names the control.
  f.dataset.k = "sel|" + key;
  if (spec.ungated) f.dataset.ungated = "true";

  const list = doc.createElement("ul");
  list.className = "nu-combolist";
  list.id = "nu-combolist-" + (++comboN);
  list.setAttribute("role", "listbox");
  list.hidden = true;
  f.setAttribute("aria-controls", list.id);

  const label = spec.label == null ? key : String(spec.label);
  list.setAttribute("aria-label", label);
  // A WHOLE CONTROL OFF, AND THE REASON RIDING ON THE CONTROL ITSELF — the
  // browser's own `disabled`, the reason in `data-why` where a gate can read it
  // back off the artifact, and the reason spoken as part of the control's name,
  // because a screen reader announcing "quality, dimmed" and nothing else is
  // the same silence. The VISIBLE copy is still the caller's to place:
  // `selectField` puts it under the label, and a table puts it once under the
  // table rather than eight times down a column.
  const off = spec.why && String(spec.why).trim();
  if (off) {
    f.disabled = true; f.setAttribute("aria-disabled", "true");
    f.dataset.why = off; wrap.classList.add("is-off");
  }
  f.setAttribute("aria-label", off ? label + ", " + off : label);

  if (!options.length) {
    // NEVER AN EMPTY CONTROL, which is a bug that looks like a design — the
    // same refusal ui/sheets.js:114 makes with its "nothing to choose here".
    const li = el("li", "nothing to choose here", "nu-comboopt is-quiet");
    li.setAttribute("role", "option");
    li.setAttribute("aria-disabled", "true");
    li.dataset.placeholder = "true";
    li.dataset.why = "nothing to choose here";
    list.append(li);
    f.value = "nothing to choose here";
    f.dataset.v = "";
    f.disabled = true;
    f.dataset.why = off || "nothing to choose here";
    wrap.classList.add("is-off");
    wrap.append(f, list);
    return wrap;
  }

  const now = String(spec.value == null ? "" : spec.value);
  const rows = [];
  let group = null, matched = null;
  for (const o of options) {
    const value = String(o.value);
    // CONSECUTIVE OPTIONS SHARING A GROUP SIT UNDER ONE HEADING — what
    // `<optgroup>` was — and the list arrives PRE-SORTED: this file never
    // reorders, exactly as ui/sheets.js never does, because a reorder moves a
    // control under a live finger.
    if (o.group && o.group !== group) {
      group = o.group;
      const h = el("li", String(o.group), "nu-combogrp");
      h.setAttribute("role", "presentation");
      h.dataset.grp = String(o.group);
      list.append(h);
    }
    if (!o.group) group = null;
    const li = el("li", optionText(o), "nu-comboopt");
    li.id = list.id + "-o" + rows.length;
    li.setAttribute("role", "option");
    li.dataset.v = value;
    if (o.disabled) { li.classList.add("is-off"); li.setAttribute("aria-disabled", "true"); }
    if (o.quiet) li.classList.add("is-quiet");
    // THE REASON, ALSO AS DATA. It is already in the words the option says —
    // that is the part a person hears — but `optionText` joins it with a comma
    // and some labels have commas of their own ("at the fifth, a beat later"),
    // so a gate reading the page back cannot tell the join from the label by
    // looking. `data-why` is what makes NO SILENT GREY mechanically checkable
    // on the rendered artifact.
    if (o.why) li.dataset.why = String(o.why);
    const on = value === now;
    li.setAttribute("aria-selected", on ? "true" : "false");
    if (on) li.classList.add("is-on");
    list.append(li);
    const r = { li, o, value, word: filterWord(o) };
    rows.push(r);
    if (on && !matched) matched = r;
  }

  // THE STANDING ANSWER IS ALWAYS OFFERED (band-kit.js:3956) and avail.js
  // guarantees it is in the list — but a document loaded from JSON can still
  // carry a value no table has, and a control that quietly showed its first
  // option would push that option into the record on the next unrelated
  // gesture. So the unknown value is SHOWN, said to be unknown, and left
  // standing. A page that quietly rewrites the record is the one failure a
  // settled parameter must not have.
  if (!matched) {
    // TWO DIFFERENT SILENCES, SAID DIFFERENTLY. `value: ""` on a control whose
    // table has no "" is the producer's own shape — "no verb has been said
    // yet". A value that is NOT empty and not in the table is a fault in the
    // record rather than a state of the page, so it says so.
    const word = now === "" ? "choose one" : now + ", not in this table";
    const li = el("li", word, "nu-comboopt is-quiet");
    li.id = list.id + "-onow";
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "true");
    li.classList.add("is-on");
    li.dataset.v = now;
    // NOT AN OPTION FOR COUNTING PURPOSES. The census is about how many
    // ANSWERS a control offers, and this is not one of them.
    li.dataset.placeholder = "true";
    list.insertBefore(li, list.firstChild);
    matched = { li, o: { value: now, label: word }, value: now, word };
    rows.unshift(matched);
  }

  /* THE BOX SHRINKS TO ITS WORDS, AS THE `<select>` DID — and this is the one
     thing the element swap silently took away. A `<select>`'s intrinsic width
     is its LONGEST OPTION, so a two-word menu was two words wide and nu.css's
     caps (30ch standing over a question, 22ch inside a Rules sentence, 13ch in
     a list row) only ever bit on the long ones. An `<input>`'s intrinsic width
     is its `size` attribute — twenty characters, whatever is in it — so on the
     day this file changed element every menu on the page drew AT ITS CAP.
     MEASURED on the rendered Rules panel at 390: every enum row 224px wide, the
     control wrapped onto its own line under its own sentence, `rate` / `mode` /
     `scale` / `harmony` 66px tall and `plan` 96px, which turned the "one row is
     one line" check red. `size` is the `<select>`'s own behaviour restated in
     the attribute this element sizes by, and it is the WORD and not the option
     text: the reason joined to a refused word ("at the fifth, no drummer") is
     read in the open list, never in the shut box.
     THE FLOOR IS 4 AND THE CEILING IS 30, both for the same reason a cap
     exists at all — a menu of one-letter words is still a thumb target, and a
     menu of instrument names is not allowed to be a phone and a half. The
     stylesheet's own caps then narrow it further wherever it is standing. */
  {
    let widest = 0;
    for (const r of rows) widest = Math.max(widest, r.word.length);
    f.size = Math.max(4, Math.min(30, widest));
  }

  wrap.append(f, list);

  /* ---- the state, and the gestures that move it ------------------------- */
  const bornAt = gestures;
  const detent = defaultDetent(options);
  const rowOf = (v) => rows.find((r) => r.value === String(v)) || matched;
  let cur = matched.value;
  // `typed` — WHETHER THE TEXT IN THE FIELD WAS PUT THERE BY A HAND. It is the
  // whole of what tells the two kinds of `change` apart at the listener below,
  // and it is a fact only the `input` event can establish: assigning `.value`
  // fires no `input`, so a value written into the control leaves this false.
  let open = false, active = -1, firing = false, typed = false;

  f.value = rowOf(cur).word;
  f.dataset.v = cur;
  paintDetent(f, cur, detent);

  // AND "NOTHING MATCHES" IS SAID, because an empty list under a field you are
  // typing into reads as a broken control. `.nu-why` so the text diet counts it
  // as the refusal it is.
  const none = el("li", "no word here matches", "nu-why nu-combonone");
  none.setAttribute("role", "presentation");
  none.hidden = true;
  list.append(none);

  /* A GROUP HEADING NEVER STANDS OVER NOTHING. The filter's own old rule. */
  const showGroups = () => {
    let head = null, any = false;
    for (const n of list.children) {
      if (n.classList.contains("nu-combogrp")) {
        if (head) head.hidden = !any;
        head = n; any = false;
      } else if (!n.hidden && n.getAttribute("role") === "option") any = true;
    }
    if (head) head.hidden = !any;
  };

  const visible = () => rows.filter((r) => !r.li.hidden && !(r.o && r.o.disabled));

  const setActive = (i) => {
    if (active >= 0 && rows[active]) rows[active].li.classList.remove("is-active");
    active = i;
    if (i >= 0 && rows[i]) {
      rows[i].li.classList.add("is-active");
      f.setAttribute("aria-activedescendant", rows[i].li.id);
      // `block: "nearest"` — the PAGE moves only if the word is off it, which
      // is what "the list is in the flow" buys: there is nothing to scroll
      // inside.
      try { rows[i].li.scrollIntoView({ block: "nearest" }); } catch (e) {}
    } else f.removeAttribute("aria-activedescendant");
  };

  const openList = (selectAll) => {
    if (f.disabled || open) return;
    open = true; typed = false;
    for (const r of rows) r.li.hidden = false;
    none.hidden = true;
    showGroups();
    list.hidden = false;
    f.setAttribute("aria-expanded", "true");
    wrap.classList.add("is-open");
    f.readOnly = false;
    setActive(rows.indexOf(rowOf(cur)));
    if (selectAll !== false) { try { f.select(); } catch (e) {} }
  };

  const closeList = (restore) => {
    open = false; typed = false;
    // EVERY OPTION GOES BACK ON THE PAGE WHEN THE LIST SHUTS. A filter that
    // outlived its own list would leave `hidden` words in the DOM, and the
    // shape of the possible is read off this DOM by every gate there is.
    for (const r of rows) r.li.hidden = false;
    none.hidden = true;
    showGroups();
    list.hidden = true;
    f.setAttribute("aria-expanded", "false");
    wrap.classList.remove("is-open");
    setActive(-1);
    f.readOnly = true;
    if (restore !== false) f.value = rowOf(cur).word;
  };

  const filter = (q0) => {
    const q = String(q0 == null ? "" : q0).trim().toLowerCase();
    for (const r of rows)
      r.li.hidden = !!q && r.word.toLowerCase().indexOf(q) < 0;
    showGroups();
    const vis = visible();
    setActive(vis.length ? rows.indexOf(vis[0]) : -1);
    none.hidden = vis.length > 0;
  };

  /* ONE OWNER FOR RECOMPILE. `set` is called from here and this file never
     redraws — ui/eight.js's `changed()` owns that, exactly as it did for the
     <select> this replaces. */
  const commit = (value) => {
    const r = rows.find((x) => x.value === String(value));
    if (!r || (r.o && r.o.disabled)) return false;
    if (r.value === cur) { closeList(true); return true; }   // a menu fires nothing here either
    cur = r.value;
    f.dataset.v = cur;
    f.value = r.word;
    for (const x of rows) {
      x.li.setAttribute("aria-selected", x === r ? "true" : "false");
      x.li.classList.toggle("is-on", x === r);
    }
    paintDetent(f, cur, detent);
    closeList(false);
    // THE CHANGE EVENT IS A NOTIFICATION AND NOT THE OWNER — it is fired so
    // anything watching the page hears what a <select> used to say, and the
    // record is written by the call under it.
    firing = true;
    try { f.dispatchEvent(new Event("change", { bubbles: true })); } finally { firing = false; }
    if (typeof spec.set === "function") spec.set(cur);
    return true;
  };

  f.addEventListener("pointerdown", (e) => {
    if (f.disabled) return;
    if (open) { closeList(true); f.blur(); return; }   // a second tap shuts it
    // the field takes focus BY THIS HANDLER, so the word stays selected and
    // the browser does not drop a caret into the middle of it
    e.preventDefault();
    f.focus();
  });
  f.addEventListener("focus", () => {
    if (f.disabled || open) return;
    // see `gestures`: no new gesture since this field was built means the page
    // put the thumb back after a redraw, and that is never a request to open.
    if (gestures <= bornAt) return;
    openList(true);
  });
  f.addEventListener("blur", () => { if (open) closeList(true); });
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
      let i = vis.indexOf(rows[active]);
      i = i < 0 ? (d > 0 ? 0 : vis.length - 1) : (i + d + vis.length) % vis.length;
      setActive(rows.indexOf(vis[i]));
      return;
    }
    if (k === "Enter") {
      if (!open) return;
      e.preventDefault();
      const vis = visible();
      const on = active >= 0 ? rows[active] : null;
      const r = on && vis.indexOf(on) >= 0 ? on : (vis.length === 1 ? vis[0] : null);
      if (r) commit(r.value);
      return;
    }
    if (k === "Tab") { if (open) closeList(true); return; }
    if (!open && k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) openList(true);
  });
  /* A SYNTHETIC `change` IS A COMMIT, THE WAY IT WAS ON THE `<select>`, and it
     is written down rather than left to be discovered. Anything driving this
     page that writes a value into the control and fires `change` is making the
     gesture it always made; the field answers to the option's VALUE first and
     to its word second. It applies only while the list is SHUT — a `change`
     fired while it is open is the browser's own end-of-edit event on text
     somebody typed, and typing is a filter and never a value, so that one puts
     the current word back. */
  f.addEventListener("change", () => {
    if (firing) return;
    // TYPED TEXT IS NOT A VALUE, AND THAT IS THE ONLY LINE THIS TURNS ON. The
    // browser fires `change` on a text field that lost focus after an edit, so
    // "aeo" left in the box and clicked away from would otherwise arrive here
    // looking exactly like a driver's assignment. `typed` is set by `input`
    // and `input` is not fired by `.value = …`, so the two are told apart by
    // which one a hand actually made. (It read `if (open)`, which was the same
    // rule guessed from the list's state — and wrong: a control still open
    // because a Tab put focus in it refused a perfectly good assignment, and
    // test/selects.js checks 7i and 9 went red on it, 2026-09-02.)
    if (typed) { f.value = rowOf(cur).word; return; }
    const want = String(f.value);
    const r = rows.find((x) => x.value === want) ||
              rows.find((x) => x.word === want) ||
              rows.find((x) => x.li.textContent === want);
    if (r && !(r.o && r.o.disabled)) commit(r.value);
    else f.value = rowOf(cur).word;
  });
  /* THE LIST TAKES THE TAP ON `pointerdown`, so the field's own blur cannot
     shut the list out from under the finger, and on `click` as well because a
     synthetic `li.click()` fires no pointer events. `commit` is a no-op on the
     word already standing, so the two paths cannot double-write. */
  const takeTap = (e) => {
    const li = e.target && e.target.closest && e.target.closest("li[role=option]");
    if (!li || !list.contains(li)) return;
    e.preventDefault(); e.stopPropagation();
    if (li.getAttribute("aria-disabled") === "true") return;
    const r = rows.find((x) => x.li === li);
    if (r) commit(r.value);
  };
  list.addEventListener("pointerdown", takeTap);
  list.addEventListener("click", takeTap);

  return wrap;
}

/** The bare widget, with no printed question — for a table cell, which is
 *  where Paul asked the chord quality to go ("chord quality can be selects
 *  inside the 'the changes' table"), for a slot row and for a bus plate. It is
 *  the SAME widget `selectField` wraps, in its compact form: one class, no
 *  second copy of the option-building loop, so the two cannot drift.
 *
 *  spec = { key, label, options, value, set, why?, ungated? } — PROGRAM.md §2.3 */
export function selectEl(spec) {
  return buildCombo(spec, true);
}

/* (`const LONG = 24` and `comboFilter()` stood here — the second box, an
   `<input type=search>` that hid non-matching `<option>`s once a list ran past
   twenty-four. Both are DELETED, by the sentence at the top of this block:
   *"one line instead of two."* The field filters now, at every length, because
   a control that behaves one way at 23 options and another way at 25 is two
   controls wearing one name. Its two rules — never leave a group heading
   standing over nothing, never let a filter outlive its list — survive in
   `showGroups()` and `closeList()` above. The third, "it never hides the
   selected option", is retired with it: the field IS the selected option now,
   so it cannot be filtered off its own control.) */

function defaultDetent(options) {
  for (const o of options || []) {
    const v = String(o.value == null ? "" : o.value);
    const w = String(o.label == null ? "" : o.label).trim();
    if (v === "" || v === "default" || w === "—" || w.toLowerCase() === "default")
      return v;
  }
  return null;
}

/** `.is-seated` / `.is-said` ON THE FIELD (2026-09-02; it was on the wrapper
 *  while the wrapper was the only element this page owned), from the value
 *  standing against the table's own default detent. Neither class when there
 *  is no detent. */
function paintDetent(field, value, detent) {
  if (detent == null) return;
  const said = String(value) !== String(detent);
  field.classList.toggle("is-said", said);
  field.classList.toggle("is-seated", !said);
}

/** One labelled control: `<p class="nu-sel"><label>…<span class="nu-combo">
 *  <input role=combobox><ul role=listbox></span></label></p>`, plus the reason
 *  when the whole thing is unavailable. Returns the <p>. */
export function selectField(parent, spec) {
  const p = el("p", null, "nu-sel");
  const lab = el("label");
  const label = spec.label == null ? String(spec.key) : String(spec.label);
  lab.append(el("span", label + " ", "nu-w"));
  lab.append(buildCombo(spec, false));
  p.append(lab);
  // ...AND THE VISIBLE COPY OF THE REASON. `buildCombo` has already refused and
  // said why to the accessibility tree; what a wrapper adds is the sentence a
  // sighted reader can see without opening anything. The list keeps its options
  // visible and greys them; a shut combo has nowhere to show them, so all it
  // can do is refuse and say why — which it must, both ways.
  if (spec.why) {
    p.classList.add("is-off");
    p.append(el("small", String(spec.why), "nu-why"));
  }
  parent.append(p);
  return p;
}
/* ---------- ...AND ONE SETTLED PARAMETER THAT IS A PICTURE ------------------
   (Paul, 2026-08-24: "Maybe put the circle of fifths back in there for key
   selection, it was nice.")

   THE SENTENCE AT THE TOP OF THIS FILE WAS RIGHT AND ITS EXAMPLE WAS WRONG, so
   the example is rewritten here rather than deleted. It read, and still reads:
   "A lit sheet of twelve keys is twelve tap targets and 500px of page spent
   saying a thing that fits in a word." Every clause of that is true. The key IS
   a settled parameter — ONE value, decided once, that you do not browse — and a
   twelve-row grid of it was 500px of shopping for something nobody shops for.
   What does not follow is that a MENU is the only other shape. A <select> is
   the right widget for a settled parameter with no shape of its own; the key
   has a shape, the oldest one in the trade, and drawn as that shape twelve
   values cost 300px and say something a list cannot: which keys are next door.
   So the key comes off the menu list and onto the circle, and the argument the
   selects round made — settled, not browsed, do not light a grid for it —
   is the argument for drawing it this way rather than against it.

   WHAT THIS FILE STILL DOES NOT KNOW. Same as its two siblings: it is handed
   fully-resolved options by nukernel/avail.js and it calls back. It does not
   know what a fifth is either — WHICH key sits at which hour, and which minor
   is relative to it, is arithmetic in nukernel/fields.js (FIFTHS, relMinorOf,
   RELMINNAME, minorish) and ui/eight.js hands the arrangement in. A widget
   that computed the ring would be a widget with a music theory in it.

   THE ROUNDNESS IS nu.css ALONE — absolute positions inside a square box, one
   rotate/translate/rotate per label, no library and no canvas — which is what
   makes the degradation honest: with the stylesheet off these are twenty-four
   plain radio-labels in a <fieldset> under a <legend>, in fifths order, and a
   screen reader hears exactly that either way. The DOM order IS fifths order,
   so the arrow keys walk round the circle rather than down a list.

   TWO RINGS, TWO RADIO GROUPS, AND THAT IS THE HONEST SHAPE. The outer ring is
   the key question: twelve values, exactly one of them true, always. The inner
   ring is a different question — "and read as its relative minor?" — which is
   why it is its own group and why nothing is checked on it when the record is
   major. Tapping an inner minor answers TWO questions in one gesture, the key
   of its relative major's sixth degree and then the mode, because A minor IS
   "in A, minor". The MODE ITSELF STAYS A <select> beside the circle — this
   round's decision (2026-08-25) and not a sentence of Paul's, so here is the
   argument rather than a quotation: the mode list is longer than major and
   minor — dorian, phrygian, mixolydian and the rest — and seven rings would be
   a worse object than the one musicians actually keep in their heads. Tap "Am"
   and you have A
   minor; push it to A dorian with the menu next to it and the ring stays lit,
   because `minorish` asks the interval table for a minor third rather than
   asking a list of names.

   spec = the same PROGRAM.md §2.3 spec `selectEl` takes.
   ring = { outer: [value x12], inner: [{ value, word, say, on, set } x12] } —
   hour 0 first, twelve hours clockwise, both rings in the same order. */
export function keyCircle(parent, spec, ring) {
  const doc = document;
  const options = spec.options || [];
  // THE SAME THROW, IN THE SAME WORDS, AS BOTH OTHER WIDGETS (ui/sheets.js:70,
  // `selectEl` above). A silent grey is the one bug all three exist to prevent
  // and a diagram is not an exemption from it.
  for (const o of options)
    if ((o.disabled || o.quiet) && !(o.why && String(o.why).trim()))
      throw new Error('selects: "' + spec.key + '" / "' + o.value +
        '" is ' + (o.disabled ? "disabled" : "quiet") + " with no `why`");

  const byValue = new Map(options.map((o) => [String(o.value), o]));
  const hours = (ring && ring.outer) || [];
  // A RING WITH A HOLE IN IT IS NOT A CIRCLE OF FIFTHS, it is eleven keys and a
  // gap, and a composer would read the gap as "that key is not available" —
  // which is a claim about the record this widget has no right to make. An hour
  // whose value is not in the offered table means the arrangement and the
  // options have drifted apart, so it is said out loud at the moment it
  // happens rather than drawn.
  const holes = hours.filter((v) => !byValue.has(String(v)));
  if (hours.length !== 12 || holes.length)
    throw new Error("selects: the circle of fifths needs twelve offered keys, " +
      "hour by hour — got " + hours.length + (holes.length ? ", missing " +
      JSON.stringify(holes) : ""));

  // ONE KEY PER CONTROL, SAID OUT LOUD WHEN TWO CONTROLS WANT IT. `selectEl`'s
  // own note applies unchanged: `data-k` is how focus is put back after every
  // redraw (ui/eight.js's draw()), so a duplicate means your thumb lands on the
  // wrong ring.
  let key = String(spec.key);
  if (doc.querySelector('[data-circ="' + esc(key) + '"]')) {
    console.error("selects: duplicate circle key " + key +
      " — two controls would share one data-k");
    let n = 2;
    while (doc.querySelector('[data-circ="' + esc(key + "#" + n) + '"]')) n++;
    key = key + "#" + n;
  }

  const fs = doc.createElement("fieldset");
  fs.className = "nu-circ";
  fs.dataset.circ = key;
  if (spec.ungated) fs.dataset.ungated = "true";
  const legend = doc.createElement("legend");
  legend.textContent = spec.label == null ? key : String(spec.label);
  fs.append(legend);
  // THE WHOLE CONTROL OFF, exactly as a sheet does it: the browser's own
  // `disabled` on the <fieldset> (which really does refuse all twenty-four
  // inputs), the reason as data where a gate can read it back off the
  // artifact, and the reason PRINTED, because a diagram that dims and says
  // nothing is the silent grey one level up. The options stay drawn — greyed
  // is not hidden, and the shape of the possible is the whole reason to draw a
  // circle instead of a list.
  const off = spec.why && String(spec.why).trim();
  if (off) {
    fs.disabled = true; fs.setAttribute("aria-disabled", "true");
    fs.dataset.why = off; fs.classList.add("is-off");
    fs.append(el("p", off, "nu-why"));
  }

  // THE SQUARE THE ROUNDNESS IS MEASURED IN. A <fieldset> cannot be the
  // positioning box itself — its <legend> is painted into its own border and
  // the two would fight over the top of the diagram — so the face is one
  // <div> inside it, and every label is absolute within THAT.
  const face = el("div", null, "nu-circ-face");
  const at = (n, hour) => { n.style.setProperty("--a", hour * 30 + "deg"); return n; };
  // ...AND A SPACE BETWEEN EVERY TWO POSITIONS, which is the whole degradation
  // in one text node. With the stylesheet on, twenty-four absolutely positioned
  // labels ignore the whitespace between them entirely — it is not in the flow.
  // With it OFF they are twenty-four inline labels in a row, and without this
  // the fieldset read "key CGDAEBF♯/G♭C♯/D♭…" as one word (measured 2026-08-25,
  // by test/selects.js reading `innerText` with `styleSheets[0].disabled`).
  // The old band-kit circle got this for free by putting each option in its own
  // <p>; here the option IS the page's own `<label class="nu-opt">` and a
  // wrapper would have been a second element per position to buy one space.
  const put = (node) => { face.append(node, doc.createTextNode(" ")); };

  // "C♯/D♭" -> ["C♯/", "D♭"]; anything with no slash is left alone
  const stackSlash = (t) => (t.indexOf("/") > 0 && t.indexOf("/") < t.length - 1
    ? [t.slice(0, t.indexOf("/") + 1), t.slice(t.indexOf("/") + 1)] : t);

  /* ---- the outer ring: the key itself, one of twelve, always exactly one ---- */
  hours.forEach((value, hour) => {
    const o = byValue.get(String(value));
    const on = String(spec.value) === String(o.value);
    put(at(optLabel({
      cls: "nu-ko", name: "circ:" + key, value: String(o.value),
      k: "opt|" + key + "|" + o.value,
      /* AN ENHARMONIC STACKS (2026-09-02) — see `optLabel`. Split AFTER the
         slash so the two lines still spell the label exactly, and only where
         there is a slash to split on: "F" is one line and stays one line. */
      word: stackSlash(o.label == null ? String(o.value) : String(o.label)),
      on, disabled: !!o.disabled, quiet: !!o.quiet, why: o.why,
      take: () => { if (typeof spec.set === "function") spec.set(String(o.value)); },
    }), hour));
  });

  /* ---- the inner ring: the same twelve keys, read as relative minors ---- */
  ((ring && ring.inner) || []).forEach((m, hour) => {
    // AN HOUR'S MINOR IS AN HOUR'S KEY, so it inherits that key's availability
    // and that key's reason. Deriving it rather than being told it is what
    // stops the two rings from ever disagreeing about whether a pitch is
    // sayable — there is one table and both rings read it.
    // ...WHICH ALSO MEANS `data-v` IS NOT UNIQUE INSIDE THIS CONTROL, and that
    // is correct rather than sloppy: `.nu-opt[data-v]` is the OPTION'S VALUE
    // everywhere on this page, Am's answer really is the key of A, and the
    // outer ring's A carries the same. What tells the two apart is the ring
    // class, so anything selecting a position writes `.nu-ki[data-v=…]` or
    // `.nu-ko[data-v=…]` and never the bare attribute (test/selects.js does).
    const o = byValue.get(String(m.value)) || {};
    put(at(optLabel({
      cls: "nu-ki", name: "circ:" + key + ":rel", value: String(m.value),
      k: "opt|" + key + ".rel|" + m.value,
      word: String(m.word), say: m.say == null ? null : String(m.say),
      on: !!m.on, disabled: !!o.disabled, quiet: !!o.quiet, why: o.why,
      take: () => { if (typeof m.set === "function") m.set(); },
    }), hour));
  });

  fs.append(face);
  parent.append(fs);
  return fs;
}

/** One position on the ring: the same `<label class="nu-opt">` over a clipped
 *  radio that ui/sheets.js emits for every option on the page, so `is-on`,
 *  the greying, the focus ring and the gates' `.nu-opt[data-v=…]` taps all land
 *  here unchanged. The only thing this one adds is `.nu-vh` — the both-ways
 *  spelling of a minor, which will not fit on the inner ring but must still be
 *  said. `.nu-vh` ADDS to what a screen reader hears; it never replaces it. */
function optLabel(o) {
  const lab = el("label", null, "nu-opt " + o.cls + (o.on ? " is-on" : "") +
    (o.disabled ? " is-off" : "") + (o.quiet ? " is-quiet" : ""));
  lab.dataset.v = o.value;
  const r = document.createElement("input");
  r.type = "radio"; r.name = o.name; r.value = o.value; r.checked = !!o.on;
  r.dataset.k = o.k;
  if (o.disabled) { r.disabled = true; r.setAttribute("aria-disabled", "true"); }
  if (o.why) r.dataset.why = String(o.why);
  // ONE OWNER FOR RECOMPILE, and it is not this file: `take` calls the caller's
  // `set`, and ui/eight.js's `changed()` redraws. Same as both siblings.
  r.addEventListener("change", () => { if (r.checked) o.take(); });
  /* THE WORD, AND IT MAY BE TWO LINES (2026-09-02). `.nu-circ .nu-opt .nu-w`
     is `white-space: nowrap` — a position on a ring must not wrap where the
     text happens to run out — so a label that is genuinely two spellings of
     one pitch ("C♯/D♭") drew as ONE long box, and the probe measured what
     that costs: *"the circle of fifths' relative-minor ring overlaps the
     major ring at both widths ('Am' over 'C'/'Dm'; 'C♯/D♭' over 'F♯/G♭')."*
     A `<br>` breaks under nowrap, which is exactly the lever: an enharmonic
     stacks its two spellings the way a printed wheel does and the box goes
     back to being one word wide. The TEXT is unchanged, character for
     character — the slash stays at the end of the first line — so the
     accessible name, `textContent` and every gate that reads the ring's words
     see what they saw before. */
  const w = el("span", null, "nu-w");
  const lines = Array.isArray(o.word) ? o.word : [o.word];
  /* AND THE TWO LINES SIT TIGHT. The stacking is this function's own
     invention, so the leading it needs is this function's to state: at 320 the
     stacked box came out 32.5px tall against a single line's 26 and the last
     1.3px of overlap survived the fix. Set to 1 it clears at both widths
     (measured 2026-09-02, 320 and 1280, rendered rects: zero overlapping
     pairs). It is written where the second line is made and nowhere else. */
  if (lines.length > 1) w.style.lineHeight = "1";
  lines.forEach((t, i) => { if (i) w.append(document.createElement("br"));
                            w.append(document.createTextNode(String(t))); });
  lab.append(r, w);
  // A SPACE BEFORE THE HIDDEN HALF, and it is not a nicety: adjacent inline
  // boxes with no whitespace between them are announced as one word, so the
  // ring said "F♯mF♯/G♭ minor" until this text node was put in.
  if (o.say) lab.append(document.createTextNode(" "), el("span", o.say, "nu-vh"));
  // THE REASON RIDES INSIDE THE OPTION, where ui/sheets.js puts it and where
  // test/sheets.js looks for it (`.nu-opt input:disabled` must have a `.nu-why`
  // in the same `.nu-opt`). It is the one thing on the ring that is allowed to
  // be wider than a word, and nu.css caps it rather than clipping it: a reason
  // that made the diagram ugly would still be a reason that was said, and a
  // reason that was hidden to keep the diagram pretty is the bug.
  if (o.why) lab.append(el("small", String(o.why), "nu-why"));
  return lab;
}

/** A row of labelled selects under one heading — the shape of ui/sheets.js's
 *  `sheetRow`, so a call site converts by changing the verb and nothing else.
 *  A <div>, never a <fieldset>: one unavailable control must not take its
 *  neighbours down with it (PROGRAM.md §2.3's own reason for the same choice). */
export function selectRow(parent, heading, specs) {
  const wrap = el("div", null, "nu-sels");
  if (heading) wrap.append(el("h3", String(heading)));
  for (const s of specs || []) selectField(wrap, s);
  parent.append(wrap);
  return wrap;
}

/* ---------- THE ONE-OPTION LAW, APPLIED TO EVERY OTHER SHEET ----------------
   (Paul, 2026-08-24: "in general where there is ONE option a dropdown is
   preferred.")

   `sheetRow` here has ui/sheets.js's name and ui/sheets.js's signature and
   defers to it for everything that is genuinely a comparison. What it will not
   do is draw a lit grid containing one word. A caller adopts the law by
   importing from this file instead of that one — which is why the name is the
   same: the diff at every call site is a path, so nobody has to decide
   sheet-by-sheet and nobody can forget one.

   `multi` NEVER CONVERTS HERE, and the reason has changed under it. It used to
   read, in full:

     “`multi` NEVER converts, whatever its length. A `<select multiple>` is the
     worst control in HTML — it hides its own scroll, loses every selection to a
     stray click, and on a phone it is a list box four rows tall. A sheet of
     checkboxes is the honest widget for ‘pick more than one’ (which is what
     Paul asked for the drum kit in the same message), so a multi sheet stays a
     sheet even when it is offering one box.”

   IT WAS RIGHT ABOUT THE WIDGET AND WRONG ABOUT THE RULE, and it is rewritten
   rather than deleted so the reversal stays legible. The complaints about
   `<select multiple>` are all true and all measured — the note over `rowsFor`
   in ui/sheets.js now carries them at 390x844 rather than as an aside here.
   What was not ours to decide is whether they outweigh being the standard
   element, and on 2026-08-24 Paul decided it: “Wherever we allow multiple
   selections use a standard multiselect form element please.”

   And the parenthesis about the drum kit was wrong twice over. Paul's question
   there was “can i pick more than one options for the drum kit?” — a QUESTION,
   which this comment read as a request. The measured answer is no: document.js
   :192 writes `drumkit` as a STRING, to-engine.js:1141 does
   `Object.assign(D, MACHINE_KIT[kit])`, and `drumVoice(kit, lane)` resolves
   every lane through that one kit. Multiple was never allowed there, so it is a
   plain single <select> now (ui/eight.js's `sound.drumkit` call site), and a
   multiselect offering one legal answer would have been a worse lie than the
   checkboxes were.

   So: this router still returns false for `multi`, but not because a multi
   spec must stay a grid of boxes — because ui/sheets.js is now the file that
   draws `<select multiple>`, and sending a multi spec to `selectField` would
   draw a one-of-N menu over a many-of-N fact. One widget, one owner. */
/* ---- ...AND THE OTHER HALF OF THE SAME SENTENCE, 2026-08-24 ----------------
   WHAT A VOICE IS PLAYED ON IS A MENU, WHICHEVER VOICE IT IS. Paul's evening
   list said "in voices -- plays, material, instrument -- dropdowns/selects",
   and `sound.drumkit` IS a drummer's instrument — avail.js:551 gets and sets
   `V(doc, s).instrument`, the same property `sound.instrument` reads for a
   line voice, under a second key only because the vocabulary of drum machines
   is not the vocabulary of throats. It stayed a lit sheet through the selects
   round on the strength of a misread question (see the rewritten note above),
   and it converts here rather than at its call site for this file's own stated
   reason: a caller adopts a law by importing from here, so nobody has to
   decide sheet-by-sheet and nobody can forget one.

   `sound.instrument` is on the list too, where it is already a menu by name at
   its call site. It is named anyway, so that the rule reads as a rule rather
   than as one exception wearing a regex.

   (The regex this note was written for — `/^sound\.(instrument|drumkit)(\||$)/`
   — is gone as of 2026-08-25. It was a named exception to a count, and there is
   no count any more; `sound.drumkit` is a menu now because EVERY single choice
   is. The note stays because it is the record of which sentence moved that one
   control, and of the misread question that had kept it a grid.) */

/* ---------- ...AND THEN HE SAID IT A THIRD TIME ----------------------------
   Paul, 2026-08-25: *"There are still many boxes that should be selects."*

   THIS IS A REVERSAL AND IT IS THE THIRD SENTENCE IN A ROW GOING THE SAME WAY,
   which is what makes it a rule rather than a preference. The first
   (2026-08-24 morning) asked for lit sheets. The second (the same evening)
   named seven controls to give back to menus and added the general clause
   "where there is ONE option a dropdown is preferred", which is what `LONE`
   and `SETTLED_SOUND` above were built for. Tonight's is not a third list of
   names — it is "STILL many", said after the second round shipped, about a
   page whose remaining boxes are all the same shape. So the rule the router
   applies is now the plain one:

       A SINGLE-CHOICE CONTROL IS A <select>.

   ...AND ON 2026-09-02 IT STOPPED BEING A `<select>` AND STAYED ONE CONTROL.
   The sentence above is kept where it stands because everything it decided is
   still decided — one widget for one answer, no lit grid of one, `multi` is
   somebody else's — and only its ELEMENT moved. Paul, after using the
   composer: *"The combo boxes just don't work and are confusing. I was
   expecting more of onfocus show custom dropdown then filter based on input —
   one line instead of two."* So the router's rule reads, unchanged in every
   clause but the noun:

       A SINGLE-CHOICE CONTROL IS A COMBO BOX.

   `shouldSelect` keeps its name and its one line: what it answers is "does
   this spec get the single-choice widget", which is the question it has always
   answered, and renaming a router because its widget changed element would put
   a rename through fifteen call sites to say nothing new. The widget itself is
   `buildCombo` at the top of this file and the reversal is argued in full
   there.

   WHAT THE OLD THRESHOLD SAID, KEPT BECAUSE IT WAS A GOOD ARGUMENT AND IT LOST
   ANYWAY: "ONE OPTION IS A SELECT AND TWO OPTIONS ARE STILL A SHEET. The
   threshold is the sentence, not a taste: 'where there is ONE option'. A
   two-option sheet is a comparison — the smallest one there is — and it still
   lights up." And, about the development words: "there you are SHOPPING: you
   want to see them all at once, and 'you cannot say that here, because there
   is no drummer' is the most useful thing this page can tell you." Both
   sentences are still TRUE about what a sheet is good for. What they were
   weighed against, and lost to, is a phone: measured at 390x844 on the
   shipped chant, one voice tab drew fourteen single-choice sheets holding 152
   lit options, five of them 26-option development grids, and the axis they sit
   in was over 5,000px tall. The shape of the possible is only visible if it
   fits on the screen, and it did not.

   NOTHING WAS LOST THAT THE SHEET WAS FOR, and that is the part that made this
   safe rather than merely obedient. The refusal is still real (`<option
   disabled>` is enforced by the browser), the reason is still said (appended
   to the option's own words — see `optionText`), the grouping is still there
   (`<optgroup>`, which is announced by name where `.nu-grp` was only a
   paragraph nearby), and the standing answer is still offered by avail.js
   before either widget sees the list. The one thing a closed menu cannot do is
   show you the greyed nine behind the chosen one — you have to open it. That
   is the whole of the cost, it is one tap, and it is the trade Paul has now
   asked for three times.

   WHAT IS STILL NOT A MENU, and none of the three is a single choice:
     · `multi` — a <select multiple> is a MANY-of-N fact and ui/sheets.js owns
       that widget (see the long note above). Unchanged.
     · the drum STEP GRID — sixteen independent steps, not a choice at all. It
       was never a sheet and does not pass through here.
     · a single boolean — ui/eight.js `check()`. A checkbox is already the
       standard element for on/off; a two-item menu saying yes and no is worse.
       It was never a sheet either.
   `LONE` and `SETTLED_SOUND` are GONE rather than left standing unused: every
   spec they used to catch is caught by the one line below, and a threshold
   nobody consults is a threshold that will be believed by the next reader.
   Their arguments are above, in full, which is where a reversal belongs. */
export function shouldSelect(spec) {
  if (!spec || spec.multi) return false;
  return true;
}

/** The one-control drop-in, for a caller that draws sheets one at a time.
 *  ui/produce.js is exactly that caller and it is exactly where the law bites:
 *  measured on the live page, three taps in — "add" -> "cantor" -> "add cantor
 *  — like what?" — `prod.bare` renders a lit grid containing ONE word. That is
 *  the label-pretending-to-be-a-choice this rule is about, and it is the only
 *  one the page can currently reach (see the sweep in the slice report: zero
 *  one-option sheets in 25,650 renders across all 130 genres, so in the eight
 *  axes this router is a guard rather than a change). */
export function sheet(parent, spec) {
  return shouldSelect(spec) ? selectField(parent, spec) : litSheet(parent, spec);
}

export function sheetRow(parent, heading, specs) {
  const list = specs || [];
  const lit = list.filter((s) => !shouldSelect(s));
  // NOT TWO CONTAINERS WHEN A ROW IS MIXED. `sheetRow` is asked for three
  // controls under one heading and it has to stay one row on the page whether
  // the middle one collapsed or not — so the wrapper is the sheets' own
  // `.nu-sheets` when anything in the row is still lit, and the selects go
  // inside it. `.nu-sels` is only for a row where nothing lit up.
  if (!lit.length) return selectRow(parent, heading, list);
  const wrap = el("div", null, "nu-sheets");
  if (heading) wrap.append(el("h3", String(heading)));
  for (const s of list) {
    if (shouldSelect(s)) selectField(wrap, s);
    else litSheet(wrap, s);
  }
  parent.append(wrap);
  return wrap;
}

// CSS.escape is not in every engine this page has to survive (and never in a
// jsdom stub), and a key carries dots and pipes, both of which are selector
// syntax. ui/sheets.js:180 carries the same six lines for the same reason; they
// are not shared because that would make one file import the other for a string
// helper, and the import that DOES exist here is for a widget.
function esc(s) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
}
