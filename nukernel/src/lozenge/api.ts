// nukernel/src/lozenge/api.ts — WHAT A LOZENGE FIELD IS HANDED, TYPED.
//
// DESIGN.md §2 component 16, Paul 2026-09-05: *"a novel interface for when
// there are tons of options and some of them can be multiple… tight lozenges,
// organized by color and clustered semantically by the kind of things they
// present… visibility into all of the options"*.
//
// WHY THIS IS NOT `MenuSpec`. A menu is handed a vocabulary you have DECIDED
// on (src/menus/index.ts's own header says so: "sheets where you compare,
// menus where you have decided"). A lozenge field is handed a vocabulary you
// are SHOPPING in — sixty-eight kit words, forty-two chord qualities, sixty-
// three scales — and it therefore needs three facts a menu never carries:
//
//   · WHICH CLUSTER a word belongs to, because a wall of sixty-eight words is
//     unreadable and a wall of six headings with words under them is not. It
//     is `cluster` here and `group` on a `Word`: the same fact, and every
//     caller on this page already has it (avail.js's `famOpts` stamps
//     `group`, `src/table/model.ts groupsFor` returns exactly `LozCluster`).
//   · WHETHER MORE THAN ONE MAY STAND, because the transformations are a
//     chain and the kit words are a set, and a `<select>` cannot say that.
//   · WHETHER THE ORDER OF THAT CHAIN IS THE MEANING, because "transpose then
//     invert" is not "invert then transpose" and the field has to print 1, 2.
//
// EVERYTHING ELSE KEEPS THE NAME `MenuSpec` USES — `key`, `label`, `value`,
// `why`, `k`, `ungated`, `onWrite`, and `disabled`/`quiet`/`why` on an option
// — so a control moves between the two widgets by changing an import, and so
// the address law below cannot drift.
//
// THE ADDRESS LAW (src/menus/index.ts `address`, byte for byte):
//   · the field:    `data-sel` = key · `data-k` = `spec.k` || "lz|" + key
//   · one lozenge:  `data-k`  = key + "|" + value · `data-v` = value
// which is what `chips()` mints for a chip, so a gate that drives a chip strip
// drives a lozenge field without changing one string.
//
// NO STRING IN THIS DIRECTORY IS PRINTED PROSE. Every word this component puts
// on the glass — the question, an option's label, a cluster's heading, a
// refusal's sentence — arrives on the spec, already translated, from the
// caller's own data tables. The only two things it prints on its own account
// are NUMBERS (a cluster's count, a chain's position), which are data and not
// copy. The one catalogue key it reads is `menu.withWhy`, and it reads it for
// an ACCESSIBLE NAME, exactly as `optionText` does two directories over.

/** One word in a vocabulary. `value` is what the record answers to; `label` is
 *  what a reader sees; `why` is the reason it is refused or inert, and a word
 *  that is `disabled` or `quiet` MUST carry one — a silent grey is the bug
 *  this component, like all three menu widgets, exists to prevent. */
export interface LozOption {
  value: string;
  /** what a reader sees — the caller's own word, already translated. */
  label: string;
  /** the reason it is refused or inert. REQUIRED if `disabled` or `quiet`. */
  why?: string | null;
  /** REFUSED: drawn disabled, with its sentence printed inside it. */
  disabled?: boolean;
  /** INERT: sayable, but it changes nothing here, and it says why. */
  quiet?: boolean;
  /** which semantic cluster it belongs to — avail.js's `group`, by any name. */
  cluster?: string | null;
}

/** A heading and its members, in the order they are drawn. This is the shape
 *  `src/table/model.ts groupsFor` already returns for the drummer's six, which
 *  is why it is spelled `word`/`vals` and not something prettier. */
export interface LozCluster { word: string; vals: string[] }

export interface LozSpec {
  /** the address. `data-sel` is this, byte for byte. */
  key: string;
  /** the question, spoken, already translated. */
  label: string;
  /** the vocabulary, PRE-SORTED: this widget never reorders one, because a
   *  reorder moves a `data-k` under a live finger. */
  options: LozOption[];
  /** the headings and their members. Absent: derived from each option's own
   *  `cluster` in first-appearance order; no cluster information at all: ONE
   *  unheaded cluster. */
  clusters?: LozCluster[] | null;
  /** single-select: the word standing. */
  value?: string | null;
  /** multi-select: the words standing, IN ORDER. */
  values?: string[] | null;
  /** more than one may stand. */
  multi?: boolean;
  /** a chain: the order is the meaning, and the field PRINTS it (1, 2, 3…). */
  ordered?: boolean;
  /** the whole field is refused, and this is why. */
  why?: string | null;
  /** the word a clusterless option sits under, from the CALLER's own
   *  catalogue. Absent: the leftovers get an unheaded cluster rather than an
   *  invented heading — this component prints no prose of its own. */
  other?: string | null;
  /** THE CALLER'S OWN `data-k` for the field element (see the address law). */
  k?: string | null;
  /** single-select: the ONE writer. */
  onWrite?: ((v: string) => void) | null;
  /** multi-select: called with the word, whether it now stands, and the NEW
   *  order — the whole chain, so a caller never reconstructs it. */
  onToggle?: ((v: string, on: boolean, order: string[]) => void) | null;
  /** this control is outside the gate census (ui/eight.js's own flag). */
  ungated?: boolean;
}

/** How many hues the semantic palette holds. nu.css owns `--lz-h0 … --lz-h7`;
 *  this file owns only the sentence that there are eight of them and that a
 *  cluster's index modulo this is the one it wears. DESIGN.md §2/16: *"each
 *  cluster carrying ONE hue from a small semantic palette … hue means the
 *  kind, weight means the state"* — so the count is small on purpose, and the
 *  ninth cluster of a nine-cluster vocabulary sharing a hue with the first is
 *  the intended behaviour, not a wrap-around bug. */
export const HUES = 8;

/** How long a press must last before it says a sentence instead of writing.
 *  600 ms, the same number and for the same reason as `src/envelope/plate.ts
 *  HOLD_MS`: longer than the 300 ms the aux spike measured a double-tap gap
 *  at, short enough to find by accident once and then on purpose. */
export const HOLD_MS = 600;

/** How far a thumb may slide and still be a press. The plate's own drag
 *  threshold is 3px because a plate is a drag surface and a lozenge is not:
 *  a finger on a wrapping field is on a SCROLLING page, and 8px is the slop
 *  a scroll gesture starts with. Past it the gesture is neither a press nor a
 *  write — it belongs to the page. */
export const SLOP = 8;
