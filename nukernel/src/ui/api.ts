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

/** The seven states DESIGN.md §2 says every component may wear.
 *
 *  TWO OF THEM ARE NOT ATTRIBUTES AND THAT IS A FACT ABOUT BROWSERS, not a
 *  hole in the system: `hover` and `focus` are the user agent's own
 *  pseudo-classes and no markup can assert them. The gallery forces them with
 *  `data-demo`, which nu.css styles beside the real pseudo-class in the same
 *  rule — so what the gallery shows is drawn by the same declaration that
 *  draws the live page, and a divergence is a syntax error rather than a
 *  difference nobody notices. */
export type ElState =
  "rest" | "hover" | "focus" | "selected" | "open" | "refused" | "busy";

export const ALL_STATES: ElState[] =
  ["rest", "hover", "focus", "selected", "open", "refused", "busy"];

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
  note: "the box is working on it; writes aria-busy and takes no press" };
const KEY: AttrSpec = { name: "key", type: "string",
  note: "a catalogue key — the accessible name is t(key), never a literal in a caller" };
const LABEL: AttrSpec = { name: "label", type: "string",
  note: "the word, when it is the record's own and not the catalogue's" };
const MARK: AttrSpec = { name: "mark", type: "string",
  note: "one Unicode mark drawn in --sym; never an emoji, and never the only name" };

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
    what: "a state of at most five positions: one control saying where you are, a step each side",
    attrs: [
      LABEL, KEY,
      { name: "options", type: "list", note: "value:word, separated by | — at most five, or it is a list you shop in" },
      { name: "value", type: "string", note: "the position it is standing on" },
      { name: "position", type: "boolean",
        note: "on by default: a control showing one of five has to say there are five" },
      REFUSED, WHY, BUSY,
    ],
    states: ["rest", "hover", "focus", "selected", "refused", "busy"],
    keys: "Right and Up step forward, Left and Down step back, Home and End take the ends; a press on the word steps forward",
    named: "t(key) or label; the steps say forward and back with the name in them",
    refuses: "a refused spinner says its reason and does not move; it steps OVER a refused word and never into one",
    demo: { label: "Attack", options: "hard:straight in|soft:soft|slow:slow|swell:swelling", value: "soft" },
  },
];

/** Every attribute name an element observes, read off its own row. */
export function attrsOf(tag: string): string[] {
  const s = SPEC.find((x) => x.tag === tag);
  return s ? s.attrs.map((a) => a.name) : [];
}
