# THE DYNAMICS FLOOD (APPROVED 2026-09-06: *"Yeah we have to do all that"*)

Paul asked, 2026-09-05: *"are our genres using our capability to have accents
and other dynamics in motif as well as our enhanced chord arrangements"*. The
census answered with numbers (`scratchpad/census-dynamics-chords/REPORT.md`,
479 rows, scripts beside it): **no**. This is the program that closes it.

## What the census found

| | measured |
|---|---|
| rows with a performance layer (stress · phrase · touch) | 464 of 479 |
| rows with articulation / max hold | 437 / 434 |
| **rows writing ANY per-note mark** (`vel` `acc` `sld` `orn` `art` `alt` `hold` `inc` `stk`) | **0** |
| the whole dynamic alphabet of 3,991 composed line cells | **{5, 6, 8}** — one line, `ideas-kit.js:652` |
| accents, of 2,672 | 2,651 downbeat-only — one line, `precompose.js:1499` |
| rows writing a progression | 84 of 479 |
| rows whose `harmony` throws the progression away | 171 |
| quality words ever used, of 42 | **8** (`7` 179 · `dom7` 144 · `maj7` 26 · `m7` 25) |
| inversion / split bar / borrowed chord | 3 / 3 / 2 rows |
| slash bass / held chord (shipped 2026-09-05) | **0 / 0** |
| dead data | 15 rows write `roots` under a harmony that never reads it; `mbube`'s `inv` is unreachable (the pad voices a pitch-class set) |

Nothing here is broken. Everything is verified to reach the notes when it is
used — funk renders 161 of 168 notes off-grid where techno renders none, jazz
65 ornaments where minimalism has 0, and every per-note mark changes the
stream when synthesised onto the seed. **The engine grew in a week and the
catalogue did not follow.** What distinguishes funk from chant today is the
performance layer laid OVER an identical figure, never the figure.

## The law of this program

**A FLOOD IS DATA, NOT A DEFAULT.** Every gap below is closed by writing the
catalogue's own rows, generated from each row's own evidence (its anchors, its
family, the corpus), never by a new fallback in the engine that makes all 479
sound alike in a second way. Where the engine must grow, it grows a
VOCABULARY the data quotes by name — the `PROGS` law, said again.

**AND THE PROOF IS THE RENDER, TWICE.** A shift lands only with: the render
CHANGED (a fingerprint per row, before and after), it STAYED IN FAMILY (the
fit tool's residue against the row's declared parents — `genre-genealogy`),
and the gates are green. `test/table.test.js` BASE_SHA moves by definition
here; each shift re-pins it in one commit with the reason written at the pin.

## The shifts

**1 · THE MOTIF'S OWN DYNAMICS.** A vocabulary of per-note dynamic FIGURES
(the shapes a phrase actually takes: leaning first note, agogic close,
backbeat weight, terraced repeat, swell, anacrusis push, syncopated
displacement, flat by conviction) declared per family and per row, applied by
the generator in place of `ideas-kit.js`'s single 8/5/6 line and
`precompose.js`'s downbeat accent. The nulls stay null: a 303 does not
breathe, and six rows say so already.

**2 · THE CHORD VOCABULARY.** The 224 `cycle` rows still on bare triads get a
progression and a quality vocabulary from their own anchors and the corpus
mirror; the 34 unused quality words earn their rows where the music has them
(ninths in bossa, elevenths in fusion, altered dominants in bop, add9 in
eighties pop, diminished passing chords in ragtime and jazz). Split bars,
slash bass and held chords land where the anchor plays them.

**3 · THE DEAD DATA.** 15 rows write `roots` no harmony reads: either the
harmony is wrong or the roots are. `mbube`'s inversion is unreachable — the
pad voices a pitch-class set, so either the pad learns inversions or the row
stops claiming one. Both are one-line answers to a question the census asked.

Each shift is one agent, gated, committed on its own, deployed to staging.
