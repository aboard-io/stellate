// nukernel/src/lozenge/clusters.ts — WHERE A CLUSTER'S WORD COMES FROM.
//
// IT IS NEVER FROM HERE. DESIGN.md §2/16 names the clusters a lozenge field
// draws — drums: kick · snare · hats · toms & fills · dynamics · feel;
// qualities: triads · sixths · sevenths · ninths · elevenths · thirteenths ·
// altered; scales: diatonic · melodic minor · harmonic minor · pentatonic ·
// hexatonic · octatonic · bebop · maqam · thaat — and EVERY ONE of those words
// is already declared, in data, by the kernel's own tables. So this file holds
// no vocabulary. It holds the derivation, and a reader over the tables that
// have the words, and the check that the derivation loses nobody.
//
// ===== WHERE EACH FAMILY WORD ACTUALLY LIVES ===========================
//
//   DRUMS — `src/table/model.ts` KITGROUPS / `groupOf` / `groupsFor`. The six
//   headings are KITOPS' own comment headings in kernel.js, written down there
//   in 2026-09 and gated by the table's tests. `groupsFor(options)` already
//   RETURNS `{word, vals}[]` — which is `LozCluster[]`, field for field — so
//   the drummer's caller passes `spec.clusters = groupsFor(...)` straight
//   through and nothing here is consulted at all. That is the point: a second
//   copy of KITGROUPS in this directory would be the second vocabulary this
//   file exists to refuse, and importing `../table/model.js` for six strings
//   would bundle the whole grid model into ui/lozenge.js.
//
//   CHORD QUALITIES — `kernel.js` QUALFAM, whose KEYS are the headings ("out
//   of the scale", triads, sixths, sevenths, ninths, elevenths, thirteenths,
//   "altered dominants") and whose values are the interval stacks. `avail.js`
//   `QUALITIES()` already stamps each option `group: fam`, so the caller hands
//   those options straight to `clustersFrom` below.
//
//   INSTRUMENTS — `instruments.js` `familyOf`, plus the literal "native" bin
//   for the Faust models. `avail.js` `instrOptions` stamps `group` from it.
//
//   SCALES AND MODES — `genres-tables.js` SCALEFAMILY / MODEFAMILY /
//   FAMILYLABEL (2026-09-05, "the family rides HERE, on the table, in ONE
//   declaration each"). FAMILYLABEL is BOTH the word and the ORDER, and
//   `avail.js famOpts` already walks it to stamp `group`. SO THERE IS NO
//   `SCALEFAM` TABLE IN THIS FILE — the brief allowed one only if the tables
//   declared none, and they declare all of it. What is here instead is
//   `scaleFamilyOf`, a READER, and `checkScaleFamilies`, the derived-check.
//
//   AND THE KERNEL'S TWELVE ARE NOT DESIGN.md's NINE, which is a fact worth
//   writing down rather than papering over. FAMILYLABEL holds: widths · seven
//   notes · blues · pentatonic · octatonic · bebop · diatonic modes · melodic
//   minor · harmonic minor · maqam & dastgah · thaat · gamelan. Eight of
//   DESIGN's nine are there under those spellings; the ninth, "hexatonic", is
//   not a family in the table — whole-tone and augmented are filed under
//   "widths", which is the kernel's own reading of what they are. The TABLE
//   wins, because the table is what `document.js` resolves a scale against and
//   a heading that disagrees with the resolution is a lie on the glass.

import type { LozCluster, LozOption } from "./api.js";

/** THE DERIVATION, AND THE WHOLE OF IT. First-appearance order — never sorted,
 *  because the caller's option list is pre-sorted and a reorder moves a
 *  `data-k` under a live finger (avail.js's own sentence, twice). No empty
 *  cluster is returned. Options carrying no cluster go LAST, under `other` —
 *  which is the CALLER's word, from the caller's catalogue; with none given
 *  they get the empty word, and an empty word draws no heading at all rather
 *  than a heading this component invented. */
export function clustersFrom(
  options: ReadonlyArray<{ value: string; cluster?: string | null }>,
  other?: string | null,
): LozCluster[] {
  const by = new Map<string, string[]>();
  const loose: string[] = [];
  for (const o of options || []) {
    const v = String(o.value == null ? "" : o.value);
    const w = o.cluster == null ? "" : String(o.cluster).trim();
    if (!w) { loose.push(v); continue; }
    if (!by.has(w)) by.set(w, []);
    by.get(w)!.push(v);
  }
  const out: LozCluster[] = [];
  for (const [word, vals] of by) if (vals.length) out.push({ word, vals });
  if (loose.length) out.push({ word: other == null ? "" : String(other), vals: loose });
  return out;
}

/** The same derivation over a full option list, for a caller that has one. */
export function clustersOf(options: ReadonlyArray<LozOption>,
                           other?: string | null): LozCluster[] {
  return clustersFrom(options, other);
}

/* ===== THE SCALE READER ================================================
   `NuGenres` is a classic script (index.html loads genres.js before any
   module), so a bundle reads it off the global exactly as `src/copy/global.ts`
   reads the catalogue off `COPY`. Typed narrowly here and nowhere else. */
interface GenresTables {
  SCALES?: Record<string, unknown>;
  MODES?: Record<string, unknown>;
  SCALEFAMILY?: Record<string, string>;
  MODEFAMILY?: Record<string, string>;
  FAMILYLABEL?: Record<string, string>;
}
const NG = (): GenresTables =>
  ((globalThis as unknown as { NuGenres?: GenresTables }).NuGenres) || {};

/** WHICH FAMILY WORD A SCALE OR MODE KEY WEARS, read off the tables that
 *  declare it. Returns `null` when the tables place it nowhere, so a caller
 *  decides what its own catch-all is called — this file names nothing. */
export function scaleFamilyOf(key: string): string | null {
  const g = NG();
  const fam = (g.SCALEFAMILY || {})[key] || (g.MODEFAMILY || {})[key];
  if (!fam) return null;
  const word = (g.FAMILYLABEL || {})[fam];
  return word == null ? null : String(word);
}

/** THE FAMILIES IN THE ORDER A PICKER OFFERS THEM. FAMILYLABEL's key order IS
 *  that order — "there is no second array anywhere stating an order" — so this
 *  is a read and not a sort. */
export function scaleFamilyWords(): string[] {
  return Object.values(NG().FAMILYLABEL || {}).map(String);
}

/** THE DERIVED-CHECK, in the file rather than only in a test, because the
 *  claim it makes is the one this whole directory rests on: a word in the
 *  table and missing from the field is exactly the declared-but-never-arriving
 *  bug, and a scale that falls out of the derivation must fall into a NAMED
 *  catch-all rather than vanish.
 *
 *  It reports rather than throws: `loose` is the keys the tables place in no
 *  family (which `avail.js famOpts` already sweeps into a trailing group, and
 *  which `test/pitch-wall.test.js` W5 asserts is empty), and `twice` is the
 *  keys SCALEFAMILY and MODEFAMILY disagree about — the only way a key could
 *  land in two families at once. `placed` plus `loose.length` is every key in
 *  both tables, which is the "exactly one family" claim stated as arithmetic:
 *
 *      const r = checkScaleFamilies();
 *      r.placed + r.loose.length === r.keys && r.twice.length === 0
 */
export function checkScaleFamilies(): {
  keys: number; placed: number; loose: string[]; twice: string[];
  families: string[];
} {
  const g = NG();
  const sf = g.SCALEFAMILY || {}, mf = g.MODEFAMILY || {};
  const all = new Set([...Object.keys(g.SCALES || {}), ...Object.keys(g.MODES || {})]);
  const loose: string[] = [], twice: string[] = [];
  let placed = 0;
  for (const k of all) {
    const a = sf[k], b = mf[k];
    if (a && b && a !== b) twice.push(k);
    if (scaleFamilyOf(k)) placed++; else loose.push(k);
  }
  return { keys: all.size, placed, loose, twice, families: scaleFamilyWords() };
}
