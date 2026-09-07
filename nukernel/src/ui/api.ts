// nukernel/src/ui/api.ts — THE DECLARATION. What an element IS, in data.
//
// docs/DESIGN-SYSTEM.md §2: *"CAREFULLY DEFINED means: a documented attribute
// surface, states for rest / hover / focus / selected / open / refused / busy,
// keyboard behaviour, an accessible name that comes from the copy catalogue,
// and a refusal that is reachable by a thumb. A component that cannot say why
// it is disabled is not finished."*
//
// THIS FILE IS THAT SENTENCE MADE MACHINE-READABLE. Every element in this
// directory declares itself here — its attributes, their types, the states it
// can wear, its keyboard, where its name comes from, and how it refuses. Three
// readers consume the declaration and none of them may hold a second copy:
//
//   · THE GALLERY (`./gallery.ts` -> nukernel/design.html) draws every element
//     in every state FROM this table, so the page cannot drift from the code.
//     §3: *"It is built FROM the component definitions, not written beside
//     them."*
//   · THE GATE (`test/design-system.js`) walks this table through the rendered
//     page and asserts that every declared state exists on the glass, that
//     every refusal reaches a thumb, and that nothing names a colour.
//   · THE ELEMENT ITSELF reads its own row for the list of attributes it
//     observes, so a declared attribute that the component ignores is
//     impossible rather than merely discouraged.
//
// A COMPONENT NOT IN THIS TABLE IS NOT IN THE SYSTEM.

/** The states DESIGN.md §2 says a component may wear — SEVEN THERE, EIGHT
 *  HERE, AND THE EIGHTH IS ARGUED RATHER THAN ASSUMED.
 *
 *  `current` IS NOT `selected` AND THE DIFFERENCE IS NOT COSMETIC. `selected`
 *  is a thing a hand chose and can un-choose: it writes `aria-pressed`, and a
 *  screen reader says "pressed". `current` is WHERE YOU ARE — the column the
 *  standing answer is in, the row of the index the record is on, the menu row
 *  naming the view already open — and ARIA has a separate word for it,
 *  `aria-current`, precisely because "you are here" is not "you pressed
 *  this". Three elements in this table genuinely wear it (`nu-colhead`,
 *  `nu-rowhead`, `nu-menu-row`) and one wears it as its ONLY answer state
 *  (`nu-index`: the atlas list has `aria-current="true"` on exactly one row,
 *  no `aria-selected` anywhere, and it is not a listbox). Spelling it
 *  `selected` would have made every one of them announce a press that never
 *  happened, and would have put the gallery's own state grid in the position
 *  of demonstrating a lie.
 *
 *  THE GLOBE BROUGHT THREE MORE, AND THEY ARE WHAT IT CAN BE DOING rather
 *  than what has been done to it. An instrument's states are its verbs:
 *  `sweeping` (a year is being held, and the marks that year does not have go
 *  off the sphere), `marked` (one place is the record playing — a full-opacity
 *  ring and `aria-current`), and `empty` (a year holding one mark or none,
 *  which is real, reachable, and the state in which the year stamp is the
 *  whole picture). `<nu-index>` wears `empty` too, for the same fact said
 *  about a list: a query that matched nothing. NONE of the three is
 *  `refused` — nothing is being withheld — and none is `busy`, because
 *  neither element is ever working on anything: both paint once and schedule
 *  nothing. Lying about that with `busy` would have been the easy way out and
 *  would have taught the gallery's reader the opposite of the law the globe
 *  is actually under.
 *
 *  A DERIVED STATE IS REFLECTED BY THE ELEMENT, NOT PASSED TO IT. `empty` is
 *  the answer to a filter and `marked` the answer to a lookup, so the element
 *  that runs them writes the attribute in `updated()` — which is why the
 *  gallery's `demoStates` sets the INPUT (a year, a query) and lets the
 *  element reach the state on its own. A state a demo could only fake is a
 *  state the gallery would be asserting rather than showing.
 *
 *  IT COSTS NO SECOND LIST. `ALL_STATES` is the one order the gallery draws
 *  in and the one vocabulary the gate walks; the gallery sets a state by
 *  setting the ATTRIBUTE OF THAT NAME on the host, so an element declaring
 *  `current` gets `[current]`, the stylesheet gets one selector, and nothing
 *  anywhere holds a second copy of the enumeration.
 *
 *  TWO OF THEM ARE NOT ATTRIBUTES AND THAT IS A FACT ABOUT BROWSERS, not a
 *  hole in the system: `hover` and `focus` are the user agent's own
 *  pseudo-classes and no markup can assert them. The gallery forces them with
 *  `data-demo`, which nu.css styles beside the real pseudo-class in the same
 *  rule — so what the gallery shows is drawn by the same declaration that
 *  draws the live page, and a divergence is a syntax error rather than a
 *  difference nobody notices. */
export type ElState =
  "rest" | "hover" | "focus" | "selected" | "current" | "open"
  | "sweeping" | "marked" | "empty" | "refused" | "busy";

export const ALL_STATES: ElState[] =
  ["rest", "hover", "focus", "selected", "current", "open",
   "sweeping", "marked", "empty", "refused", "busy"];

/** The states a hand cannot assert — see ElState. */
export const PSEUDO_STATES: ElState[] = ["hover", "focus"];

export type AttrType = "string" | "boolean" | "enum" | "number" | "list";

export interface AttrSpec {
  /** the attribute as it is written on the tag */
  name: string;
  type: AttrType;
  /** for `enum`: the whole vocabulary, first is the default */
  values?: string[];
  /** ONE LINE. What it does, in this repo's voice. */
  note: string;
}

export interface ElSpec {
  /** the custom element name; every one of them starts `nu-` */
  tag: string;
  /** the component's name in DESIGN.md §2, and its number there */
  title: string;
  from: string;
  /** ONE LINE: what this thing IS, said the way a musician would say it */
  what: string;
  attrs: AttrSpec[];
  /** which of the seven this element can actually wear */
  states: ElState[];
  /** ONE LINE: every key that does something */
  keys: string;
  /** ONE LINE: where the accessible name comes from */
  named: string;
  /** ONE LINE: how it refuses out loud, per DESIGN.md component 14 */
  refuses: string;
  /** the gallery's live example: attributes to set, per state */
  demo: Record<string, string>;
  /** THE CHILDREN A CONTAINER NEEDS IN ORDER TO BE ITSELF.
   *
   *  A `<nu-table>` with no columns in it draws a scroll box around nothing,
   *  and a gallery cell showing nothing is a gallery that cannot be read. The
   *  wrong fix is an `if (spec.tag === "nu-table")` in `gallery.ts` — the page
   *  is built FROM this table (§3) and a special case is the first line of the
   *  drift the whole arrangement exists to prevent. So the DECLARATION grows a
   *  field, every container that needs one fills it in, and `example()` builds
   *  them generically for any element that declares one and for no element
   *  that does not. */
  demoChildren?: DemoKid[];
  /** THE INPUT A STATE NEEDS WHEN ITS OWN NAME IS NOT ENOUGH.
   *
   *  Most states are a boolean on the host and the gallery sets the attribute
   *  of that name. Some are not: an index is `empty` because of a QUERY that
   *  matched nothing, a globe is `sweeping` because of a YEAR, `marked`
   *  because of a place. Those are DERIVED — the element reflects them once it
   *  has run its own filter — so what the gallery must supply is the input,
   *  and it is declared here per state. Where a state names a row of this
   *  table, the gallery uses it INSTEAD of setting `[state]` blind: a demo
   *  that both forced the attribute and supplied the cause would be showing a
   *  state the element had not actually reached. */
  demoStates?: Partial<Record<ElState, Record<string, string>>>;
}

/** One child of a demo, and its own children. `attrs` are literal — a demo
 *  word is the RECORD's word, which is what `label` is for — with ONE thing
 *  filled in by the gallery: a kid marked `refused` and given no `why` gets
 *  `ui.gal.demo.why`, so a refusal sentence on this page has one owner and it
 *  is the copy catalogue. */
export interface DemoKid {
  tag: string;
  attrs?: Record<string, string>;
  kids?: DemoKid[];
}

/* ---- THE ONE PLACE THE LIST LIVES ------------------------------------- */

const SELECTED: AttrSpec = { name: "selected", type: "boolean",
  note: "the lamp is on — this is the standing answer; writes aria-pressed" };
const OPEN: AttrSpec = { name: "open", type: "boolean",
  note: "this control has something standing under it; writes aria-expanded" };
const REFUSED: AttrSpec = { name: "refused", type: "boolean",
  note: "aria-disabled and NEVER disabled, so a thumb still reaches the reason" };
const WHY: AttrSpec = { name: "why", type: "string",
  note: "the reason, <= 12 words; a press prints it in this widget's one say line" };
const BUSY: AttrSpec = { name: "busy", type: "boolean",
  note: "the box is working on it: aria-busy, still pressable, and a press says so" };
const KEY: AttrSpec = { name: "key", type: "string",
  note: "a catalogue key — the accessible name is t(key), never a literal in a caller" };
const LABEL: AttrSpec = { name: "label", type: "string",
  note: "the word, when it is the record's own and not the catalogue's" };
const MARK: AttrSpec = { name: "mark", type: "string",
  note: "one Unicode mark drawn in --sym; never an emoji, and never the only name" };
const CURRENT: AttrSpec = { name: "current", type: "boolean",
  note: "you are HERE — writes aria-current, never aria-pressed: a place is not a press" };
const COUNT: AttrSpec = { name: "count", type: "number",
  note: "how many are inside; a heading that can name a count must, or the fold hides a number" };
const HELD: AttrSpec = { name: "held", type: "string",
  note: "the standing word this group holds — a readout, drawn quiet and aria-hidden" };

export const SPEC: ElSpec[] = [
  {
    tag: "nu-button",
    title: "Button",
    from: "DESIGN.md §2 — the whole vocabulary's first entry",
    what: "a word you press: one thing happens, and the word says which",
    attrs: [
      KEY, LABEL, MARK,
      { name: "tone", type: "enum", values: ["plain", "lamp", "clip"],
        note: "plain is the panel's own; lamp is the one that is ON; clip is destruction and nothing else" },
      { name: "size", type: "enum", values: ["tap", "tight"],
        note: "tap is the 44px floor and the default; tight is a control seated inside another one" },
      SELECTED, OPEN, REFUSED, WHY, BUSY,
    ],
    states: ALL_STATES,
    keys: "Enter and Space press it; Tab reaches it, refused or not",
    named: "t(key), else label; a mark is decoration and is never the name",
    refuses: "a press prints why in the button's own say line and writes nothing",
    demo: { label: "Add player", mark: "⊕" },
  },
  {
    tag: "nu-icon-button",
    title: "Icon button",
    from: "DESIGN.md §2 (button) + §2/15 (glyph): every icon carries its word",
    what: "a mark you press, with its word said out loud and drawn nowhere",
    attrs: [
      MARK, KEY, LABEL,
      { name: "tone", type: "enum", values: ["plain", "lamp", "clip"],
        note: "as the button's, and for the same reason" },
      SELECTED, OPEN, REFUSED, WHY, BUSY,
    ],
    states: ALL_STATES,
    keys: "Enter and Space press it; Tab reaches it, refused or not",
    named: "t(key), else label — a mark with no word is a control with no name",
    refuses: "a press prints why in the button's own say line and writes nothing",
    demo: { mark: "≡", label: "Menu" },
  },
  {
    tag: "nu-lamp",
    title: "Lamp",
    from: "DESIGN.md §2 component 11",
    what: "the one place saturated colour is allowed: a thing that is doing something is LIT",
    attrs: [
      { name: "on", type: "boolean", note: "lit or dark; a lamp has no third position" },
      { name: "means", type: "enum", values: ["hand", "clock", "meter", "flag"],
        note: "which lamp: you set it / scheduled / measured / armed — never two meanings in one colour" },
      { name: "shape", type: "enum", values: ["dot", "bar"],
        note: "a dot beside a name, or a bar down the edge of the thing it belongs to" },
      LABEL, KEY,
      { name: "says", type: "boolean",
        note: "off by default: a lamp beside a named thing is decoration and is aria-hidden, because a light that follows the beat may not be announced all record long" },
    ],
    states: ["rest", "selected"],
    keys: "none — a lamp is a readout and takes no focus",
    named: "aria-hidden unless says is set, and then t(key) or label",
    refuses: "nothing to refuse: a lamp is never pressed",
    demo: { means: "clock", shape: "dot" },
  },
  {
    tag: "nu-legend",
    title: "Legend",
    from: "DESIGN.md §0 — legends printed on the panel, values on the screen",
    what: "a printed label: small caps, dim, fixed, and it never lights",
    attrs: [
      KEY, LABEL, MARK,
      { name: "for", type: "string",
        note: "the id of the control it names; with it this is a <label>, without it a <span>" },
    ],
    states: ["rest"],
    keys: "none of its own; a legend with for= passes a click to its control",
    named: "it IS the name — t(key), else label",
    refuses: "nothing: a legend has no state, which is the whole point of it",
    demo: { label: "Tempo" },
  },
  {
    tag: "nu-value",
    title: "Value",
    from: "DESIGN.md §0 — values live on the screen: phosphor, bright, and the only things that change",
    what: "a readout: what the machine currently says, in tabular numerals",
    attrs: [
      { name: "value", type: "string", note: "what it says; blank prints the placeholder" },
      { name: "unit", type: "string", note: "the unit, after the number, in the quiet register" },
      { name: "placeholder", type: "string", note: "what stands in when nothing is written" },
      { name: "derived", type: "boolean",
        note: "nobody set this — it was inherited or dealt, so it reads quiet; bold is a hand" },
      { name: "means", type: "enum", values: ["value", "meter", "clock", "flag"],
        note: "which register: the screen's own phosphor, or one of the three lamps when the number IS a state" },
      LABEL, KEY,
    ],
    states: ["rest", "selected"],
    keys: "none — a value is read, not pressed; the control beside it is what a hand touches",
    named: "t(key) or label names the quantity; the value itself is its content",
    refuses: "nothing: a value that cannot be set is drawn derived, not refused",
    demo: { value: "96", unit: "bpm" },
  },
  {
    tag: "nu-rail",
    title: "Exclusive rail",
    from: "DESIGN.md §2 component 24 (shipped v302 as .nu-wchips.is-exclusive)",
    what: "one of a set, drawn as one of a set: joined segments, one hairline between, the standing word filled",
    attrs: [
      LABEL, KEY,
      { name: "options", type: "list",
        note: "value:word, separated by |; the word is what a hand reads, the value is what the record stores" },
      { name: "value", type: "string", note: "the standing answer; the segment wearing it is filled" },
      { name: "exclusive", type: "boolean",
        note: "on by default and drawn as data-exclusive, so a gate reads what a hand sees; off is a chain and the segments come apart" },
      REFUSED, WHY, BUSY,
    ],
    states: ["rest", "hover", "focus", "selected", "refused", "busy"],
    keys: "Left/Right step between segments and pick, Home/End take the ends; Enter and Space press one",
    named: "the group is t(key) or label; each segment is its own word",
    refuses: "a refused rail says its reason and does not move; a refused segment is stepped OVER, never into",
    demo: { label: "Feel", options: "straight:straight|swung:swung|loose:loose", value: "swung" },
  },
  {
    tag: "nu-spinner",
    title: "Spinner",
    from: "DESIGN.md §2 component 23 (shipped v302 as .nu-spin)",
    what: "a state of at most five positions: ONE button, and a press rotates it",
    attrs: [
      LABEL, KEY,
      { name: "options", type: "list", note: "value:word, separated by | — at most five, or it is a list you shop in" },
      { name: "value", type: "string", note: "the position it is standing on" },
      { name: "position", type: "boolean",
        note: "on by default: a control showing one of five has to say there are five" },
      REFUSED, WHY, BUSY,
    ],
    states: ["rest", "hover", "focus", "selected", "refused", "busy"],
    keys: "a press rotates forward and wraps; Right and Up step forward, Left and Down back, Home and End take the ends",
    named: "t(key) or label, said with the word and the position — ui.spin.now, on the one button",
    refuses: "a refused spinner says its reason and does not move; it steps OVER a refused word and never into one",
    demo: { label: "Attack", options: "hard:straight in|soft:soft|slow:slow|swell:swelling", value: "soft" },
  },
  {
    tag: "nu-table",
    title: "Table",
    from: "DESIGN.md §2 (table cell, column head, row head) — the shape .nu-lztrack already ships",
    what: "a sideways track of columns: the track scrolls, the page does not",
    attrs: [
      KEY, LABEL,
      { name: "flow", type: "enum", values: ["across", "down"],
        note: "across is columns side by side and the default; down is groups on the side and rows running out" },
      REFUSED, WHY, BUSY,
    ],
    states: ["rest", "focus", "refused", "busy"],
    keys: "Tab reaches the track; the arrows and the wheel scroll it, and its columns take their own presses",
    named: "t(key) or label, on the track — a scroll region with no name is a room with no door",
    refuses: "a refused table takes every press inside it and prints one reason in its own say line",
    demo: { label: "Instruments" },
    demoChildren: [
      { tag: "nu-colhead", attrs: { label: "Strings", count: "4", open: "", current: "" },
        kids: [
          { tag: "nu-cell", attrs: { label: "Violin", value: "violin", selected: "" } },
          { tag: "nu-cell", attrs: { label: "Viola", value: "viola" } },
          { tag: "nu-cell", attrs: { label: "Cello", value: "cello", mark: "\u25C6" } },
          { tag: "nu-cell", attrs: { label: "Double bass", value: "contrabass", refused: "" } },
        ] },
      { tag: "nu-colhead", attrs: { label: "Reeds", count: "3", open: "", held: "clarinet" },
        kids: [
          { tag: "nu-cell", attrs: { label: "Clarinet", value: "clarinet", order: "1" } },
          { tag: "nu-cell", attrs: { label: "Oboe", value: "oboe", order: "2" } },
          { tag: "nu-cell", attrs: { label: "Bassoon", value: "bassoon", quiet: "" } },
        ] },
      { tag: "nu-colhead", attrs: { label: "Reeds", continued: "", open: "" },
        kids: [
          { tag: "nu-cell", attrs: { label: "Cor anglais", value: "corAnglais" } },
          { tag: "nu-cell", attrs: { label: "Contrabassoon", value: "contrabassoon" } },
        ] },
    ],
  },
  {
    tag: "nu-colhead",
    title: "Column head",
    from: "DESIGN.md §2 component 16 (column head) + .nu-lzhead / .nu-lzcont",
    what: "a column: its name, how many are in it, what it is holding, and whether it is folded",
    attrs: [
      KEY, LABEL, COUNT, HELD, CURRENT,
      { name: "open", type: "boolean",
        note: "unfolded — its cells are on the glass; writes aria-expanded, and the fold is one CSS rule" },
      { name: "continued", type: "boolean",
        note: "this column carries on the one before it, so it is a READOUT: aria-hidden, no count, no fold, no press" },
    ],
    states: ["rest", "hover", "focus", "current", "open"],
    keys: "Enter and Space fold and unfold it; a continuation takes no key, because it is not a control",
    named: "t(key) or label, said with its count and its held word — the two are drawn aria-hidden",
    refuses: "it does not: a heading that cannot fold is drawn continued, which is a readout and not a refusal",
    demo: { label: "Strings", count: "4", held: "violin" },
    demoChildren: [
      { tag: "nu-cell", attrs: { label: "Violin", value: "violin", selected: "" } },
      { tag: "nu-cell", attrs: { label: "Viola", value: "viola" } },
      { tag: "nu-cell", attrs: { label: "Cello", value: "cello" } },
    ],
  },
  {
    tag: "nu-rowhead",
    title: "Row head",
    from: "DESIGN.md §2 component 17 (row head)",
    what: "the same group with the axis turned: the name down the side, its cells running out across",
    attrs: [KEY, LABEL, COUNT, HELD, CURRENT],
    states: ["rest", "hover", "focus", "current"],
    keys: "Enter and Space press it; there is no fold, because a folded row collapses its own handle",
    named: "t(key) or label, said with its count and its held word",
    refuses: "it does not: a row head names a group and never withholds one",
    demo: { label: "Drums", count: "3" },
    demoChildren: [
      { tag: "nu-cell", attrs: { label: "Kick", value: "kick", selected: "" } },
      { tag: "nu-cell", attrs: { label: "Snare", value: "snare" } },
      { tag: "nu-cell", attrs: { label: "Hat", value: "hat" } },
    ],
  },
  {
    tag: "nu-cell",
    title: "Table cell",
    from: "DESIGN.md §2 component 15 (table cell) — Paul: \u201Cjust list the items as cells\u201D",
    what: "one option, drawn as a line and not a pill: full width, word at the start edge",
    attrs: [
      KEY, LABEL, MARK,
      { name: "value", type: "string", note: "what the record stores; the word is what a hand reads" },
      SELECTED,
      { name: "order", type: "number",
        note: "its place in a chain, printed only when a chain has more than one member" },
      { name: "quiet", type: "boolean",
        note: "INERT, which is NOT refused: no press was ever offered, so no button, no dash, no aria-disabled" },
      REFUSED, WHY, BUSY,
    ],
    states: ["rest", "hover", "focus", "selected", "refused", "busy"],
    keys: "Enter and Space press it; Tab reaches it, refused or not, because a reason a keyboard cannot reach is silent",
    named: "t(key) or label; with a printed order the name says the position too",
    refuses: "a press prints why in the TABLE's one say line, at the foot of the track where a thumb already is",
    demo: { label: "Cello", value: "cello" },
  },
  {
    tag: "nu-plate",
    title: "Plate",
    from: "DESIGN.md \u00a72 component 18 (plate) \u2014 the app's #nu-menu, given a tag",
    what: "the panel that arrives: a column of rows, capped, scrolling inside itself",
    attrs: [
      KEY, LABEL,
      { name: "anchor", type: "enum", values: ["start", "end"],
        note: "which edge of the screen it hangs from; start, because the hamburger is on the left" },
      OPEN,
    ],
    states: ["open"],
    keys: "Tab walks its rows; Escape is the page's to close it, not the plate's",
    named: "t(key) or label, on the panel itself \u2014 a plate with no name is a room with no door",
    refuses: "it does not; a row inside it refuses, and says so in its own say line",
    demo: { label: "Menu", open: "" },
    demoChildren: [
      { tag: "nu-menu-row", attrs: { label: "Master", mark: "\u21C5", current: "" } },
      { tag: "nu-menu-row", attrs: { label: "Sections", mark: "\u2317", count: "4" } },
      { tag: "nu-menu-row", attrs: { label: "Players", mark: "\u2299", count: "12" } },
      { tag: "nu-menu-row", attrs: { label: "Motifs", mark: "\u00A7" } },
      { tag: "nu-menu-row", attrs: { label: "Rules", mark: "\u2261" } },
      { tag: "nu-menu-row", attrs: { label: "Where", mark: "\u25C9" } },
      { tag: "nu-menu-row", attrs: { label: "Export", mark: "\u2913", refused: "" } },
    ],
  },
  {
    tag: "nu-menu-row",
    title: "Menu row",
    from: "DESIGN.md \u00a72 component 19 (menu row) \u2014 Paul: \u201Cicons should all have same width\u201D",
    what: "one line of a plate: a mark in a fixed advance, a name, and at most a count",
    attrs: [
      KEY, LABEL, MARK, COUNT, CURRENT, SELECTED, REFUSED, WHY, BUSY,
    ],
    states: ["rest", "hover", "focus", "selected", "current", "refused", "busy"],
    keys: "Enter and Space press it; Tab reaches it, refused or not",
    named: "t(key) or label; the mark is decoration and the count is drawn aria-hidden",
    refuses: "a press prints why in the row's own say line and goes nowhere",
    demo: { label: "Sections", mark: "\u2317", count: "4" },
  },
  {
    tag: "nu-index",
    title: "Index",
    from: "DESIGN.md \u00a72 (sheet row / label row) \u2014 the atlas's own #atlasIndex, 502 rows",
    what: "a searchable list of records: a year, a name, a place, and one row you are on",
    attrs: [
      KEY, LABEL,
      { name: "rows", type: "list",
        note: "year|name|place|key, rows separated by ; \u2014 a name may hold a comma and never a pipe" },
      { name: "query", type: "string",
        note: "the standing search; folded NFD and matched as AND-tokens over name, key, place and year" },
      { name: "current", type: "string",
        note: "the key of the row you are ON \u2014 aria-current on exactly one row, and never aria-selected" },
    ],
    states: ["rest", "hover", "focus", "current", "empty"],
    keys: "type in the field to filter; Tab walks the rows; Enter and Space open one",
    named: "t(key) or label names the list; each row says its name, its place and its year",
    refuses: "no row refuses; a query that matches nothing is answered by a sentence naming it",
    demo: { label: "Records",
      rows: "1888|Ragtime|Sedalia|ragtime; 1917|Stride|Harlem|stride; " +
            "1948|Mambo|Havana|mambo; 1962|Bossa nova|Rio|bossa; " +
            "1969|Reggae|Kingston|reggae; 1973|Dub|Kingston|dub; " +
            "1977|No wave|New York|nowave; 1982|Electro|Detroit|electro; " +
            "1988|Acid house|Chicago|acid; 1991|Trip hop|Bristol|triphop; " +
            "1994|Jungle|London|jungle; 2003|Grime|London|grime" },
    demoStates: {
      current: { current: "dub" },
      empty: { query: "zzzz" },
    },
  },
  {
    tag: "nu-globe",
    title: "Globe",
    from: "DESIGN.md \u00a72 (the atlas map) \u2014 the app's #atlasMap, SVG and never canvas",
    what: "an orthographic sphere with a mark on every place a record was made",
    attrs: [
      KEY, LABEL,
      { name: "marks", type: "list",
        note: "name|year|lat|lon|key, marks separated by ; \u2014 the projection is arithmetic, the paint is CSS" },
      { name: "year", type: "string",
        note: "the year being swept: marks it does not hold leave the sphere, and the year is stamped on it" },
      { name: "at", type: "string",
        note: "the key of the mark that is playing \u2014 it wears the ring and aria-current" },
    ],
    states: ["rest", "focus", "sweeping", "marked", "empty"],
    keys: "Tab reaches the sphere and then each mark it is showing; Enter and Space open one",
    named: "t(key) or label on the sphere; each mark says its place, its year and its record",
    refuses: "nothing to refuse: a year holding no mark is empty, which is an answer and not a refusal",
    demo: { label: "Where the records are",
      marks: "Kingston|1973|18.0|-76.8|dub; Bristol|1991|51.5|-2.6|triphop; " +
             "New York|1977|40.7|-74.0|nowave; Sedalia|1888|38.7|-93.2|ragtime" },
    demoStates: {
      sweeping: { year: "1973" },
      marked: { year: "1973", at: "dub" },
      empty: { year: "1888" },
    },
  },
];

/** Every attribute name an element observes, read off its own row. */
export function attrsOf(tag: string): string[] {
  const s = SPEC.find((x) => x.tag === tag);
  return s ? s.attrs.map((a) => a.name) : [];
}
