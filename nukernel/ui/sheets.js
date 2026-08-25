// nukernel/ui/sheets.js — A SHEET OF OPTIONS, LIT.
//
// (Paul, 2026-08-24: "the options for each instrument in a song section are now
// just one thing in a dropdown. That's not effective. sheets of organized
// options should light up. when an option makes another one unaccessible gray
// it out.")
//
// A closed <select> is nine words behind one tap, and it has no way to say that
// three of them would do nothing. A sheet is the whole vocabulary at once, the
// answer you are on lit, and the words this record cannot use greyed WITH THE
// REASON PRINTED. Sixteen menus became sixteen sheets.
//
// THE WIDGET, AND WHY IT IS THE NATIVE ONE.
//   · a radio group is ONE tab stop with arrow-key traversal; nine
//     <button aria-pressed> are nine tab stops and announce no group, no
//     position and no count. A screen reader says "the tune, group. radio
//     button, at the fifth, 4 of 21, not selected."
//   · `input:checked` paints the lit answer with ZERO JavaScript, so the page
//     cannot get out of sync with itself.
//   · `disabled` is a REAL refusal the browser enforces. A button that ignores
//     its own click is a lie. And one attribute on the <fieldset> disables
//     every control inside it — the native "this whole sheet is unavailable".
//   · with the stylesheet off it is a captioned box of radios with the reasons
//     as text, which still reads as the same document.
// It is the parent's own widget: band-kit's `optWidget` (ui/band.js:784) is a
// <label> over a hidden radio, and ui/band.js:1966 already had the instinct —
// "a word that needs a note first can GREY instead of vanishing". What changes
// here is the LAW: the parent's answer to unavailability was the pruner
// (band-kit.js:4042), which DELETES the option. Hiding destroys the shape of
// the possible, which is the thing a composer is reading a sheet for.
//
// ...AND FOR "PICK MORE THAN ONE", THE NATIVE ONE IS A DIFFERENT ELEMENT.
// (Paul, 2026-08-24: "Wherever we allow multiple selections use a standard
// multiselect form element please.")
//
// `multi: true` drew a row of checkboxes until that sentence. Checkboxes are a
// defensible widget and the argument for them is still true — see the paragraph
// this reverses in ui/selects.js's `shouldSelect` — but "standard" was asked for
// by name and the browser's own multiple-selection element is `<select
// multiple>`. So a multi sheet is now a <fieldset> with a <legend>, its
// whole-control refusal, and ONE `<select multiple>` inside it. Everything the
// sheet promised survives the swap, because the promises were never about the
// input type:
//   · `<option disabled>` is a REAL refusal the browser enforces, the same as
//     `<input disabled>` was.
//   · NO SILENT GREY holds DIFFERENTLY, exactly as it does in ui/selects.js: an
//     <option> may contain nothing but text, so the reason is APPENDED TO THE
//     OPTION'S OWN WORDS — "leslie, three chips is the limit on one track" —
//     and also stamped as `data-why` so a gate can tell the join from a label
//     that has a comma of its own.
//   · `<optgroup>` is the native heading `.nu-grp` was standing in for.
//   · one `disabled` on the <fieldset> still darkens the whole thing, and the
//     `<p class="nu-why">` still says why.
// WHAT IS LOST is the shape of the possible at a glance — a multiselect scrolls
// its own tail out of sight — which is why `size` below is floored at four rows
// and never at one. THE HONEST CAVEAT is measured in the note over `rowsFor`.
//
// THIS FILE DOES NOT KNOW WHAT A DOCUMENT IS. It is handed fully-resolved
// options by nukernel/avail.js and calls back. That is what makes it reusable
// for the mixing board, the world map and the producer without any of them
// importing the availability tier, and it is why there is no `import` above.
//
// WHAT THE STYLESHEET MUST HONOUR (nukernel/nu.css owns the inside of every
// class below — PROGRAM.md §2.4): `.nu-opt` is at least 44px high and shows a
// focus ring on `:has(input:focus-visible)`; `.nu-sheet` is the grid container
// and `.nu-grp` / `.nu-why` span all of its columns; `.nu-opt > input` is
// hidden BY CLIP and never by `display:none`, which would take it out of the
// accessibility tree and out of the tab order with it.

/** How many columns a sheet asks for. Read off the WORDS, so a sheet of
 *  one-syllable answers packs and a sheet of sentences does not — the
 *  stylesheet is free to ignore it at a narrow width, which is the point of
 *  its being an attribute rather than an inline style. */
function colsFor(options) {
  if (options.length <= 2) return 1;
  let longest = 0;
  for (const o of options) longest = Math.max(longest, String(o.label || o.value).length);
  return longest <= 10 ? 4 : longest <= 16 ? 3 : longest <= 26 ? 2 : 1;
}

/** How many rows a `<select multiple>` shows before it starts scrolling.
 *
 *  FOUR IS THE FLOOR AND IT IS THE BROWSER'S OWN HABIT — a multiselect left to
 *  size itself renders four rows, and a ONE-ROW multiselect is a trap: it looks
 *  exactly like a closed dropdown, so a reader taps it expecting a menu and
 *  instead drags a selection across a list they cannot see. Eight is the
 *  ceiling because this control sits inside a voice's own sheet, three of them
 *  down a phone screen, and twelve rows of chips would push the engineer's
 *  sends off the bottom of it.
 *
 *  THE HONEST CAVEAT, MEASURED — not guessed — AT 390x844 (an iPhone 12/13/14
 *  in CSS pixels) on the shipped chant, 2026-08-24, by drawing the widget this
 *  one replaces into the SAME page under the SAME stylesheet and reading both
 *  bounding boxes. It is written here rather than left to be discovered:
 *
 *    the engineer's character chips, 11 options
 *      as <select multiple size=8>   187px tall (the control itself 156px),
 *                                    348px wide, 8 of 11 options in view,
 *                                    ~19.5px per row
 *      as the .nu-opt checkbox grid  315px tall, 2 columns, 11 of 11 in view,
 *                                    44px per row
 *
 *  So it is 128px SHORTER and that is the only thing it is better at:
 *    · THREE OF ELEVEN ARE BELOW THE FOLD OF THE CONTROL. `crunch` is reached
 *      by dragging inside a box that scrolls, inside a page that also scrolls.
 *      The grid showed every word at once, which is the whole argument for a
 *      sheet.
 *    · THE ROW IS 19.5px, NOT 44px. PROGRAM.md §2.4's floor is 44 and
 *      test/shell.js A3 holds every checkbox and radio to 24 on both axes; the
 *      rows inside a <select> are not `input`s and neither gate sees them.
 *      This is the measurement that matters most on a phone.
 *    · DESELECTING IS CTRL-CLICK (cmd-click on a Mac) and nothing says so. A
 *      plain click on one of three selected chips collapses the selection to
 *      that one — legible as an accident, not as a gesture.
 *    · WITH A KEYBOARD, arrows MOVE the selection rather than extend it;
 *      extending is shift-arrow and toggling is ctrl-space, none of it
 *      announced. The checkboxes were tab-and-space and needed no instruction.
 *    · ON iOS SAFARI it renders as a stacked list with no ctrl key at all and
 *      a tap toggles — the one platform where it behaves like the checkboxes.
 *
 *  Paul asked for the standard element and the standard element is what this
 *  draws. Whether it is BETTER than the checkboxes on a phone is his call to
 *  make, and he can only make it if the measurement exists; it is above. */
const SIZE_MIN = 4, SIZE_MAX = 8;
const rowsFor = (n) => Math.min(Math.max(n, SIZE_MIN), SIZE_MAX);

const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};

/** One sheet. Returns the <fieldset>, already appended to `parent`.
 *
 *  spec = { key, label, options, value, set, multi?, max?, maxWhy?, why?,
 *           ungated? }
 *  option = { value, label?, group?, disabled?, quiet?, why? }
 *
 *  `multi` draws a `<select multiple>` and `set` receives the whole array —
 *  PROGRAM.md §2.3 unchanged in every part a caller can see. `max` is the only
 *  new word and it exists because a `<select multiple>` cannot refuse a fourth
 *  selection the way an unticked checkbox could; see THE CAP below. */
export function sheet(parent, spec) {
  const options = spec.options || [];
  // A SILENT GREY IS THE BUG THIS FILE EXISTS TO PREVENT, so it is not a
  // console warning, it is a throw. A greyed word with no reason is worse than
  // a dropdown: the dropdown at least let you tap it and find out.
  for (const o of options)
    if ((o.disabled || o.quiet) && !(o.why && String(o.why).trim()))
      throw new Error('sheets: "' + spec.key + '" / "' + o.value +
        '" is ' + (o.disabled ? "disabled" : "quiet") + " with no `why`");

  // TWO RADIO GROUPS SHARING A `name` FIGHT SILENTLY, and this page has shipped
  // that bug before in another form (ui/eight.js:339, one shared `hookCells`
  // array ate every earlier voice's playhead). The key is scope-qualified by
  // the caller — `dev.line|cantor|c3` — so a collision means two callers
  // genuinely disagree about who owns a fact, and it is said out loud.
  let key = String(spec.key);
  const doc = parent.ownerDocument || document;
  if (doc.querySelector('[data-sheet="' + esc(key) + '"]')) {
    console.error("sheets: duplicate sheet key " + key +
      " — two radio groups would share one name");
    let n = 2;
    while (doc.querySelector('[data-sheet="' + esc(key + "#" + n) + '"]')) n++;
    key = key + "#" + n;
  }

  const fs = el("fieldset", null, "nu-sheet");
  fs.dataset.sheet = key;
  fs.dataset.cols = String(colsFor(options));
  if (spec.ungated) fs.dataset.ungated = "true";
  // said on the element, because a gate has to be able to tell "exactly one
  // answer" from "any number of them" without asking the caller
  if (spec.multi) fs.dataset.multi = "true";
  fs.append(el("legend", spec.label == null ? key : String(spec.label)));

  // A WHOLE SHEET OFF, and its options STILL VISIBLE. One attribute does all of
  // the refusing; hiding the words would destroy the shape of the possible,
  // which is the thing the sheet is for. The reason comes first so it is read
  // before the grey is puzzled over.
  if (spec.why) {
    fs.classList.add("is-off");
    fs.disabled = true;
    fs.setAttribute("aria-disabled", "true");
    fs.append(el("p", String(spec.why), "nu-why"));
  }

  if (!options.length) {
    // NEVER AN EMPTY FIELDSET, which is a bug that looks like a design.
    fs.append(el("p", "nothing to choose here", "nu-why"));
    parent.append(fs);
    return fs;
  }

  const multi = !!spec.multi;
  if (multi) return multiSheet(parent, fs, spec, key, options, doc);

  const now = [String(spec.value)];
  const inputs = [];
  let group = null;
  for (const o of options) {
    const value = String(o.value);
    // CONSECUTIVE OPTIONS SHARING A GROUP SIT UNDER ONE HEADING, and the list
    // arrives PRE-SORTED — this file never reorders, because a reorder moves a
    // `data-k` under a live finger and focus is restored across the full
    // rebuild by exactly that key (ui/eight.js:1156).
    if (o.group && o.group !== group) { group = o.group;
                                        fs.append(el("p", String(o.group), "nu-grp")); }
    if (!o.group) group = null;
    const on = now.includes(value);
    const lab = el("label", null, "nu-opt" + (on ? " is-on" : "") +
      (o.disabled ? " is-off" : "") + (o.quiet ? " is-quiet" : ""));
    lab.dataset.v = value;
    const inp = doc.createElement("input");
    inp.type = "radio";
    inp.name = "sh:" + key;
    inp.value = value;
    inp.dataset.k = "opt|" + key + "|" + value;
    inp.checked = on;
    if (o.disabled) { inp.disabled = true; inp.setAttribute("aria-disabled", "true"); }
    lab.append(inp, el("span", o.label == null ? value : String(o.label), "nu-w"));
    // THE REASON IS PART OF THE OPTION, not a tooltip. A `title` is invisible
    // on a phone, which is the only place this page is really read.
    if (o.why) lab.append(el("small", String(o.why), "nu-why"));
    inputs.push(inp);
    fs.append(lab);
  }

  // ONE OWNER FOR RECOMPILE. `set` fires on `change` and this file never
  // redraws — ui/eight.js's `changed()` (`push(); draw();`) owns that, exactly
  // as it did for the <select> this replaces. A view that redraws itself is a
  // view that can disagree with the record.
  const fire = () => {
    if (typeof spec.set !== "function") return;
    const on2 = inputs.find((i) => i.checked);
    if (on2) spec.set(on2.value);
  };
  fs.addEventListener("change", fire);

  parent.append(fs);
  return fs;
}

/* ======================= PICK MORE THAN ONE ================================
   (Paul, 2026-08-24: "Wherever we allow multiple selections use a standard
   multiselect form element please.")

   ONE `<select multiple>` INSIDE THE SHEET, not instead of it. The <fieldset>,
   the <legend> and the whole-control `<p class="nu-why">` all stay where they
   were, because they are what carries the availability law at the level a
   collapsed control has nowhere to put it — the same division of labour
   ui/selects.js:129 arrived at from the other side.

   THE CAP, SAID HONESTLY. A checkbox refuses a fourth tick by being disabled
   and that is the whole mechanism; a `<select multiple>` has no such per-item
   stop that survives a ctrl-click, a shift-drag or a Ctrl+A. So the cap is
   enforced TWICE and neither half is silent:
     1. the CALLER greys the unreachable choices — ui/engineer.js:364 already
        marked every unselected chip `disabled` with "three chips is the limit
        on one track" once three were on, and a disabled <option> genuinely
        cannot be selected by pointer or by keyboard.
     2. `max` is the backstop for every way round that: if a change arrives
        carrying more than `max`, the selection is PUT BACK to the last set the
        record accepted, `set` is never called, and the refusal is printed in a
        `.nu-why` beside the control with `aria-live` so it is heard as well as
        seen. Silently keeping the first three would be exactly the lie this
        file's throw exists to prevent, one level up. */
function multiSheet(parent, fs, spec, key, options, doc) {
  // A SELECT IS ONE CELL WIDE WHATEVER THE WORDS ARE. `colsFor` reads the
  // labels to pack a grid of radios; there is no grid here, so the sheet asks
  // for one column and nu.css lays the control across it.
  fs.dataset.cols = "1";
  fs.classList.add("is-multi");

  const label = spec.label == null ? key : String(spec.label);
  const max = Number.isFinite(spec.max) ? Math.max(0, Math.floor(spec.max)) : null;
  const capWhy = (spec.maxWhy && String(spec.maxWhy).trim()) ||
    (max == null ? "" : "at most " + max + " at once here");

  const s = doc.createElement("select");
  s.multiple = true;
  s.setAttribute("multiple", "");   // written as an attribute too, so a gate reading the artifact sees it
  s.size = rowsFor(options.length);
  // THE SAME TWO KEYS THE OTHER TWO WIDGETS USE, both stemmed from `key`.
  // `data-sel` is what test/sheets.js check 1 looks for to tell a menu this
  // page drew from a hand-rolled <select> smuggled back in; `data-k` is how
  // focus is put back after ui/eight.js's full redraw (:1156), and it says
  // `sel|` because it names the CONTROL — the options carry `opt|` below, the
  // spelling every gate and every keep already uses to address one word.
  s.dataset.sel = key;
  s.dataset.k = "sel|" + key;
  // AND THE CAP IS PART OF THE CONTROL'S NAME, because a reader who cannot see
  // the greyed rows must still be told there is a ceiling before they hit it.
  s.setAttribute("aria-label",
    label + (spec.why ? ", " + String(spec.why) : "") +
    (max == null ? "" : ", at most " + max + " at once"));

  const now = (spec.value || []).map(String);
  let group = null, host = s;
  for (const o of options) {
    const value = String(o.value);
    // CONSECUTIVE OPTIONS SHARING A GROUP SIT UNDER ONE <optgroup> — the native
    // heading — and the list arrives PRE-SORTED. This file never reorders, for
    // the same reason it never did: a reorder moves a control under a live
    // finger.
    if (o.group && o.group !== group) { group = o.group;
      host = el("optgroup"); host.label = String(o.group); s.append(host); }
    if (!o.group) { group = null; host = s; }
    const opt = doc.createElement("option");
    opt.value = value;
    // THE REASON IS IN THE WORDS THE OPTION SAYS. An <option> holds text and
    // nothing else, so the `<small class="nu-why">` a lit row carried has
    // nowhere to live and the reason is joined on instead — ui/selects.js:83
    // `optionText` is the same four lines and they are NOT shared, because
    // sharing them would make this file import that one and this file imports
    // nothing (see the header). A comma and not a dash: eSpeak NG pauses on a
    // comma and says a dash out loud in some voices.
    opt.textContent = o.why && String(o.why).trim()
      ? (o.label == null ? value : String(o.label)) + ", " + String(o.why).trim()
      : (o.label == null ? value : String(o.label));
    opt.dataset.v = value;
    opt.dataset.k = "opt|" + key + "|" + value;
    if (o.disabled) { opt.disabled = true; opt.className = "is-off"; }
    if (o.quiet) opt.className = (opt.className ? opt.className + " " : "") + "is-quiet";
    // ...AND ALSO AS DATA, so NO SILENT GREY is mechanically checkable on the
    // rendered artifact: a label may have a comma of its own and a gate reading
    // the text alone cannot tell the join from the label.
    if (o.why) opt.dataset.why = String(o.why);
    opt.selected = now.includes(value);
    host.append(opt);
  }
  fs.append(s);

  // THE REFUSAL, PRINTED. Created only when it fires and removed when it
  // clears, so the page never holds an empty `.nu-why` — an empty reason is the
  // silent grey wearing a paragraph.
  let capNode = null;
  const say = (words) => {
    if (!capNode) { capNode = el("p", null, "nu-why");
                    capNode.dataset.cap = "true";
                    capNode.setAttribute("role", "status");
                    capNode.setAttribute("aria-live", "polite");
                    fs.append(capNode); }
    capNode.textContent = words;
  };
  const hush = () => { if (capNode) { capNode.remove(); capNode = null; } };

  // ONE OWNER FOR RECOMPILE, unchanged: `set` fires on `change` and this file
  // never redraws — ui/eight.js's `changed()` owns that.
  let last = [...s.options].filter((o) => o.selected).map((o) => o.value);
  s.addEventListener("change", () => {
    const picked = [...s.options].filter((o) => o.selected).map((o) => o.value);
    if (max != null && picked.length > max) {
      for (const o of s.options) o.selected = last.includes(o.value);
      say(capWhy);
      return;                     // the record never saw the fourth one
    }
    hush();
    last = picked.slice();
    if (typeof spec.set === "function") spec.set(picked);
  });

  parent.append(fs);
  return fs;
}

/** A row of sheets side by side under one heading. Returns the wrapper <div>.
 *  A <div>, NEVER a <fieldset>: `<fieldset disabled>` disables every control
 *  nested inside it, so one unavailable sheet in a fieldset wrapper would take
 *  its neighbours down with it. */
export function sheetRow(parent, heading, specs) {
  const wrap = el("div", null, "nu-sheets");
  if (heading) wrap.append(el("h3", String(heading)));
  for (const s of specs || []) sheet(wrap, s);
  parent.append(wrap);
  return wrap;
}

// CSS.escape is not in every engine this page has to survive (and never in a
// jsdom stub), and a sheet key carries dots and pipes, both of which are
// selector syntax. One escape, used by the duplicate check only.
function esc(s) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
}
