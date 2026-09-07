# THE THEORY LAYER (APPROVED 2026-09-06)

Paul: *"I want you to work that knowledge into our generation system where it
can make any genre more relevant and give me tools to 'manually' transform a
melody using the same methods as part of our motif manipulation tools"*, and
*"Feel free to work in other theory tests"*.

"That knowledge" is what the Augmented Fifth publication marks LLMs on
(`scratchpad/aug5th/NOTES.md`, all seven posts read): four-part writing,
figured bass, harmonic analysis, the classical transformations, set theory,
and finding faults in someone else's score. The Bach benchmark is already
answered — `tools/chorale-check.js` and a chorale that passes it,
`keeps/bach-benchmark/`. This is the rest, and it has three parts.

## 1 · ONE OWNER FOR THE THEORY

`tools/theory.js`, zero dependencies, node and browser alike, holding the
things this repo keeps re-deriving in different places:

| it answers | used by |
|---|---|
| the pitch-class set, its normal form, its interval-class vector | the transforms, the remix miner |
| transposition, inversion about an axis, retrograde, retrograde-inversion, augmentation, diminution, rotation | the motif tools and `songs.js` |
| what chord a simultaneity is, as a roman numeral in a key, with inversion | analysis, the changes grid, the remix miner |
| whether a note is a passing tone, a neighbour, a suspension or a chord tone | the voice-leading pass |
| every part-writing fault in a set of voices | the generation pass and the chorale checker |
| what cadence a pair of chords makes | analysis and the form reader |

`tools/chorale-check.js` keeps its command line and its rules MOVE here, so
the checker and the engine cannot drift apart. `tools/remix.js` stops
estimating chords its own way and asks this instead.

## 2 · THE GENERATION PASS — "MORE RELEVANT"

The box compiles each voice independently: a chair reads a motif through a
word, at its own register, with its own entry. Nothing looks at what the
other chairs are doing, so nothing prevents two lines moving in parallel
octaves for eight bars, a pad voicing that doubles the leading tone, or a
bass that lands on the seventh of a chord nobody voiced.

**THE PASS MEASURES FIRST.** Before anything changes, count the faults across
all 482 rows at three seeds: parallels between every pair of sounding voices,
notes outside their chair's range, doubled leading tones, chord tones missing
from a voiced harmony. That census is the deliverable even if nothing is
repaired, because it says which genres have the problem and how badly.

**THEN IT REPAIRS ONLY WHAT IS SAFE.** A repair may move a note by an octave,
choose a different inversion of a voiced chord, or change which chord tone a
doubling voice takes. It may NOT change a written motif, a rhythm, or a
degree a hand wrote: the melody is the composer's and this pass is the
copyist. Every repair is reported and countable, and a genre may refuse the
pass by name — a punk record does not want its parallel fifths corrected, and
neither does an organum, whose whole music IS parallel motion.

**AND IT IS MEASURED ON THE RENDER, TWICE**: faults down, and the fit tool's
residue against each row's parents unchanged, so "more relevant" does not
quietly mean "more like everything else".

## 3 · THE MANUAL TRANSFORMS

The motif tools gain the classical operations, by their real names, each one
tap and one undo step: transpose by interval or by degree, invert about an
axis you choose, retrograde, retrograde-inversion, augment, diminish, rotate,
sequence up or down by step, and fit-to-the-chord. The box already has some
of these as development words (`inverted`, `backwards`, `the first half`);
the difference is that these apply TO THE MOTIF ITSELF, in the editor, so a
hand can see what happened and keep it, rather than declaring a word that a
compile applies later. Both routes call `tools/theory.js`.

Beside them, the motif's own facts, read not typed: its interval-class
vector, its range, its contour, and what the box thinks its harmony is.

## 4 · THE OTHER TESTS

The publication's other benchmarks become gates over our own output, since
they are all mechanical: figured bass realised against its figures, roman
numerals matched to a known analysis, a planted-parallel score found in full,
and chord spelling that keeps its enharmonics honest. What the author scores
by hand — "inventive", "no human keyboardist would realize a figured bass in
this way" — stays unmeasured and is quoted rather than pretended at.

---

# WHAT SHIPPED (2026-09-06) — PARTS 1, 2 AND 4

Part 3, the manual transforms in the motif editor, is not in this round. The
operations it asks for are all here (`transpose`, `invert`, `retrograde`,
`retrogradeInversion`, `augment`, `diminish`, `rotate`, `sequence`); what is
missing is the editor's own tap-and-undo, which belongs to the round that owns
`nukernel/ui/`.

## The files

| file | what it is |
|---|---|
| `tools/theory.js` | §1's one owner. UMD, zero dependencies, node and browser. |
| `tools/chorale-check.js` | keeps its command line; its nine rules now come from there. |
| `tools/theory-census.js` | §2's measurement, over 482 rows at three seeds. |
| `docs/THEORY-CENSUS.md` | the census itself — a finding, committed like `GENEALOGY.md`. |
| `test/theory.test.js` | §4's gates. |
| `nukernel/document.js` | `planOf`, `chordsIn`, and the pass's one wiring point. |
| `nukernel/genres/*.json` | 35 rows declare a `copyist` refusal in their own data. |

## THE PASS IS OFF UNLESS A CALLER ASKS, AND THAT IS THE DECISION

`scoreOf(doc, GENRES, fleet, win, { copyist: { ranges } })` runs it; nothing
else does. `test/table.test.js` T2 holds every anchor's document, compiled
genre and rendered events to a PINNED COMMIT, and repairing by default would
move most of the catalogue's render — a change that has to be argued record by
record and pinned by the round that argues it. This round could not pin
anything: it commits nothing. Off, `scoreOf` returns the events it always has,
proven byte-for-byte over 363 renders against the pre-round file, and T2 is
green without its pin moving.

The refusals are declared anyway, and that is not wasted work: they are what a
later round needs in place BEFORE it can turn the pass on.

## FOUR THINGS THE MEASUREMENT SETTLED THAT THE PLAN DID NOT KNOW

1. **An octave move cannot undo a parallel.** A parallel is detected on the
   interval CLASS, which is what makes the detection octave-invariant, so the
   one repair that is always legal on a written line is the one repair that can
   never remove a fifth. What removes one is RE-VOICING a chord — moving a
   note of a voicing by an octave so the voices RE-RANK — and that only exists
   where a chair is voicing a chord. A parallel between two written lines is
   unrepairable, and the pass counts it rather than reaching for the melody.
2. **A repair may not pay for itself with a hole.** The first draft substituted
   chord tones to break parallels and spent the third of the chord to buy a
   fifth. The law now is that a note may only leave if its pitch class is still
   sounded, by its own chair and by the band. An unrepaired fault is an honest
   number; a traded one is not.
3. **The box's voicings are exactly spelled**, because `kernel.js voiceLead`
   realizes one voice per chord tone. So there is no spare note to re-choose,
   which is why a doubled leading tone is very nearly unrepairable here and why
   "a chord tone missing from a voiced harmony" is nearly zero. Both facts are
   findings about the generator, not gaps in the checker.
4. **The phrase "chord tones missing from a voiced harmony" carries two
   readings** and they answer very differently: whether the CHAIR voicing the
   chord spells it, and whether ANYBODY plays each tone. Both are counted
   (`missing`, `unsounded`); only the first is repairable.

## AND ONE THING §1 ASKS FOR THAT THIS ROUND DID NOT DO

*"`tools/remix.js` stops estimating chords its own way and asks this instead."*
It still asks `tools/mine/mine-midi.js`, whose estimator is a salience-weighted
root search over a bar of a performance — a different job from naming a
simultaneity in a known key, and one whose output decides what a mined row's
`prog` says. Rewiring it moves the miner's decisions, and `test/remix.test.js`
is a green gate this round has to keep. It wants its own round, with the mined
catalogue re-measured on both sides.
