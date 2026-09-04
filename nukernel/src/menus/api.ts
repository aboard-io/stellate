// nukernel/src/menus/api.ts — WHAT A MENU IS HANDED, TYPED.
//
// The shape is PROGRAM.md §2.3's spec renamed at exactly two fields and at no
// others: `options` is `words` and `set` is `onWrite`, because a menu is handed
// a VOCABULARY and calls back when a hand says one of it. Everything else keeps
// the name every caller on this page already types, so a call site converts by
// changing an import and two keys rather than by being rewritten.

/** One word in a vocabulary. `value` is what the record answers to; `label` is
 *  what a reader sees; `why` is the reason it is refused or inert, and a word
 *  that is `disabled` or `quiet` MUST carry one — a silent grey is the bug all
 *  three widgets exist to prevent. */
export interface Word {
  value: string | number;
  label?: string | null;
  why?: string | null;
  /** REFUSED: the browser enforces it and the reason rides the word. */
  disabled?: boolean;
  /** INERT: sayable, but it changes nothing here, and it says why. */
  quiet?: boolean;
  /** consecutive words sharing a group sit under one heading. */
  group?: string | null;
}

export interface MenuSpec {
  /** the address. `data-sel` is this, byte for byte, on whatever is drawn. */
  key: string;
  /** the vocabulary, PRE-SORTED: no widget here ever reorders one, because a
   *  reorder moves a control under a live finger. */
  words: Word[];
  /** the word the record is standing on. */
  value?: string | number | null;
  /** the ONE writer. Called with a value from `words` and never with anything
   *  else — you cannot type a word that is not in the table. */
  onWrite?: ((v: string) => void) | null;
  /** the question, spoken. Defaults to `key`. */
  label?: string | null;
  /** the whole control is unavailable, and this is why. */
  why?: string | null;
  /** this control is outside the gate census (ui/eight.js's own flag). */
  ungated?: boolean;
  /** the bare form — a table cell, a slot row, a bus plate — with no printed
   *  question over it. One class, so the two forms cannot drift apart. */
  compact?: boolean;
  /** THE CALLER'S OWN `data-k`, for a control that had an address before this
   *  module existed. `ui/engineer.js`'s insert seats are keyed `ins|<voice>|<n>`
   *  and are driven by nukernel/desk-gate.js at exactly that string; the law is
   *  that an address does not move when a widget does, so the caller keeps it.
   *  Everything else gets `sel|<key>`, which is what `restoreFocus` looks for. */
  k?: string | null;
}

/** Which of the three a vocabulary gets. `combo` is the typed one. */
export type Picker = "chips" | "native" | "combo";
