// nukernel/ui/selects.js — THE DIAGRAM, AND THE ROUTER. THE MENU MOVED OUT.
//
// THIS FILE DREW EVERY MENU ON THIS PAGE FROM 2026-08-24 UNTIL 2026-09-06, and
// on that day the menu got ONE OWNER and three widgets. Paul, 2026-09-05: *"In
// general dropdowns barely work."* The widget, and the whole of this file's
// header history — the two instructions of 2026-08-24 that met here, the third
// sentence of 2026-08-25, the combo-box reversal of 2026-09-02, and every
// argument each of them made — is `nukernel/src/menus/index.ts`, built to
// `nukernel/ui/menus.js`. Which of the three a vocabulary gets is
// `nukernel/src/menus/pick.ts`, and the phone measurements that decided it are
// written down there.
//
// WHAT IS LEFT HERE IS EVERYTHING THAT IS NOT A MENU, and it is exactly two
// things — which is why the file keeps its name rather than being deleted or
// renamed through forty references in the docs and the gates:
//
//   · `keyCircle` — the one settled parameter that is a PICTURE. The old title
//     of this file said it: *"fifty-two controls on the page are menus and one
//     is a diagram."* Fifty-two moved; the diagram stayed.
//   · THE ROUTER — `shouldSelect` / `sheet` / `sheetRow`, which decide between
//     a MENU and a LIT SHEET. It lives here because it is the one place that
//     has to know both widgets, and because a caller adopts the law by
//     importing from this file instead of from ui/sheets.js: the diff at every
//     call site is a path, so nobody has to decide sheet-by-sheet and nobody
//     can forget one.
//
// THE FOUR OLD NAMES ARE KEPT AS ADAPTERS, not as a second implementation:
// `selectEl`, `selectField`, `selectRow` and `optionText` are `menus.js`'s
// `menuEl`, `menuField`, `menuRow` and `optionText` with PROGRAM.md §2.3's two
// field names translated (`options` -> `words`, `set` -> `onWrite`) and nothing
// else. Every `data-sel`, `data-k` and `data-v` is byte-identical across the
// move, which is the measurement that makes it a move rather than a rewrite.
//
// THIS FILE STILL DOES NOT KNOW WHAT A DOCUMENT IS: it is handed fully-resolved
// options by nukernel/avail.js and calls back.
import { sheet as litSheet } from "./sheets.js";
import { menu, menuEl, menuField, menuRow, optionText } from "./menus.js";

export { optionText };

const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};

/** PROGRAM.md §2.3's spec, in `menus.js`'s two words. The translation is here
 *  and nowhere else, so the day a caller is rewritten to speak the new names
 *  this function is what it stops going through. */
const asMenu = (spec) => ({
  key: spec.key, label: spec.label,
  words: spec.options || [],
  value: spec.value,
  onWrite: spec.set,
  why: spec.why, ungated: spec.ungated, k: spec.k,
});

/** The bare widget, with no printed question — for a table cell, a slot row and
 *  a bus plate. */
export function selectEl(spec) { return menuEl(asMenu(spec)); }

/** One labelled control under its question. Returns the `<p class="nu-sel">`. */
export function selectField(parent, spec) { return menuField(parent, asMenu(spec)); }

/** A row of labelled controls under one heading. */
export function selectRow(parent, heading, specs) {
  return menuRow(parent, heading, (specs || []).map(asMenu));
}

/** ...and the door for a caller that already speaks `menus.js`'s own words. */
export { menu };

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
