// nukernel/src/copy/api.ts — HOW A STRING IS ASKED FOR, AND NOTHING ELSE.
//
// TABLE.md §12b (Paul, 2026-09-05: *"look for ways to simplify copy strings
// assuming they will eventually be translated"*) and DESIGN.md §4 (the voice).
//
// THE LAW THIS FILE ENFORCES BY SHAPE. Every string the page prints is looked
// up by KEY. A sentence is never assembled from fragments in a caller — that
// is the produce.js refusal builder's bug ("it's as brighter as it's going to
// get"), and it is unfixable in a second language, where the fragments do not
// fall in that order. So:
//
//   · one key = one whole printed string;
//   · a name, a number or a unit arrives as a PLACEHOLDER — `{name}`, `{n}`,
//     `{unit}` — never by concatenation;
//   · a plural is a SECOND KEY (`section.one` / `section.other`), because
//     "one" and "other" are not the whole set of plural forms everywhere and
//     `n === 1 ? a : b` in a caller cannot be taught the rest;
//   · a number and its unit are formatted in ONE place, `fmt`.
//
// A SECOND LANGUAGE IS A SECOND TABLE, and nothing else moves.

/** What a string may be given: names, counts, units. Nothing else. */
export type Params = Record<string, string | number>;

/** The catalogue's shape: a flat map of key -> the whole printed string. */
export type Table = Record<string, string>;

/* WHAT WAS ASKED FOR AND NOT FOUND. A missing key prints as the key itself —
   loud, greppable, and never a silent empty control — and it is REMEMBERED, so
   the browser gate can assert the page asked for nothing the catalogue does
   not hold. */
const MISSING = new Set<string>();

/* WHAT THIS PAGE ACTUALLY PRINTED. `t` stamps every string it hands back, so
   the copy gate can diff the RENDERED page against what the catalogue
   produced — a placeholder makes an output that is in no table, and a gate
   that only knew the raw values would have to guess. ([[test-the-artifact]]) */
const PRODUCED = new Set<string>();

/** Fill `{name}` / `{n}` / `{unit}` from `p`. An unfilled placeholder is left
 *  standing rather than blanked, for the same reason a missing key is: a hole
 *  in a sentence must be visible to whoever reads the page. */
function fill(s: string, p?: Params): string {
  if (!p) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(p, k) ? String(p[k]) : m);
}

/** THE ONE READER. `t("cell.default")`, `t("head.player", { name })`. */
export function make(table: Table) {
  const t = (key: string, p?: Params): string => {
    const raw = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
    if (raw === undefined) { MISSING.add(key); return key; }
    const out = fill(raw, p);
    /* THE STAMP IS CAPPED. A full walk of every surface produces about 2,300
       distinct strings, so 20,000 is twenty times the page and cannot grow
       into a leak on a session left open for an afternoon — and a gate that
       hit the cap would be reading a page nobody has. */
    if (PRODUCED.size < 20000) PRODUCED.add(out);
    return out;
  };

  /** A COUNT PICKS A KEY, never an `if` in a caller: `tn("section", 3)` reads
   *  `section.other` with `{n}` filled. `.one` is used only at exactly 1. */
  const tn = (key: string, n: number, p?: Params): string =>
    t(key + (n === 1 ? ".one" : ".other"), { n, ...(p || {}) });

  /** Does the catalogue hold this key? (The gates ask; callers should not.) */
  const has = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(table, key);

  return { t, tn, has };
}

/* ===== NUMBERS AND UNITS, IN ONE PLACE ===================================
   Every quantity this page prints goes through `fmt`. The rounding is the
   unit's own — a tempo is not shown to three decimals, a dB is shown to one
   and keeps its sign, a level has no unit at all — and a translator changes
   the SEPARATOR here rather than in two hundred callers. */
const DECIMALS: Record<string, number> = {
  ms: 0, BPM: 1, dB: 1, s: 3, "%": 0, "×": 2, st: 0, bars: 0, beats: 2,
  steps: 0, Hz: 0, kHz: 1, bit: 0, kbps: 0,
};
/** Units that sit against the number with no space. */
const TIGHT = new Set(["%", "×", "°"]);
/** Units that print their sign even when positive. */
const SIGNED = new Set(["dB", "st", "¢"]);

/** `fmt(79, "BPM")` -> "79 BPM" · `fmt(-1.5, "dB")` -> "−1.5 dB" ·
 *  `fmt(0.5)` -> "0.5". Trailing zeros go; a minus is the real minus sign. */
export function fmt(n: number, unit?: string): string {
  if (!isFinite(n)) return "—";
  const u = unit || "";
  const d = Object.prototype.hasOwnProperty.call(DECIMALS, u) ? DECIMALS[u]! : 2;
  let s = n.toFixed(d);
  if (s.indexOf(".") >= 0) s = s.replace(/\.?0+$/, "");
  if (s === "-0") s = "0";
  if (SIGNED.has(u) && n > 0) s = "+" + s;
  s = s.replace(/^-/, "−");
  return u ? (TIGHT.has(u) ? s + u : s + " " + u) : s;
}

/** The keys the page asked for and the catalogue does not hold. Empty is the
 *  only passing answer; `test/copy.browser.js` reads it. */
export const missing = (): string[] => [...MISSING].sort();
/** Every string `t` has handed out on this page, for the same gate. */
export const produced = (): string[] => [...PRODUCED];
