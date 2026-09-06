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
