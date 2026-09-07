# SORTED BY SCOPE (APPROVED 2026-09-06: *"Can you redesign based on the feedback you provided and address what's missing?"*)

The review that asked for this is the Coach House walkthrough — a fourteen-section
trip-hop record built in the box on a phone, with every friction logged
(`scratchpad/pm-walkthrough/NOTES.md`, the record in
`keeps/triphop-pm-walkthrough/`). Its verdict, in one line:

> **The page is sorted by age, not by scope.**

A song here has FOUR SCOPES and every control belongs to exactly one:

| scope | what it owns | where it lives today |
|---|---|---|
| **record** | rules, time, chords, motifs, master, produce, performance | four rows above the grid AND four below it |
| **section** | a row: form, key, feel, chain, and its mix | the grid's rows |
| **player** | a column: instrument, envelope, tone, mix strip | the column heads and the MIX row |
| **cell** | one player in one section | inside the grid |

Walking the sheet, the scope changes NINE TIMES, and the record talks at both
ends of the page — `Master` and `Time` are eight screens apart and are the same
kind of thing. The grid, the only surface that shows the whole song, gets what
is left over. That is the disease. Everything below is the cure, in the order
the walkthrough measured the cost.

## Wave A · THE SHEET IS THE GRID

1. **The record collapses to ONE PLACE, and that place is the hamburger.**
   RULES · TIME · CHORDS · MOTIFS · MASTER · PRODUCE · PERFORMANCE become ONE
   line at the top — `THE RECORD`, with the face saying what a glance needs
   (tempo · meter · key) — which opens into the seven as a scope panel. The
   foot of the page empties; MIX keeps its strips because a fader is the
   player's, not the record's.

   **THE ONE LINE IS RETIRED, THE SAME DAY IT WAS BUILT (2026-09-06).** The
   header read *"The record collapses to one row"* and the clause read
   *"become ONE line at the top — `THE RECORD`"*. It was built and deleted
   inside a single day; `nukernel/src/table/grid.ts` carries the tombstone
   (*"`recordRow` STOOD HERE, 2026-09-06 to 2026-09-06"*) and
   `test/table.browser.js` T14c reads it off the artifact — the `<tfoot>`
   holds no record row. Paul: *"All that stuff at the top? I expected that to
   live in the hamburger and for the hamburger to be nicely organized."*
   **The argument above is not reversed, it is PAID:** the record does
   collapse to one place, the scope panel does exist, and the foot did empty.
   What changed is WHICH place. The eight surfaces — the seven above plus
   SONG — are the hamburger's FIRST block; read `docs/NAV.md` §20 and
   `nukernel/TABLE.md` §18d for the shape and the argument, and
   `table.browser` T14b for the proof that all eight addresses resolve from
   the hamburger.
2. **The phone gets its words back.** With seven players every cell drew one
   identical dot (140 of them on Coach House), so the densest surface in the
   app was the least readable, while the desktop showed every name. A cell says
   a word at every width — two lines if it must, fewer columns with a swipe if
   it must, never a grid of dots.
3. **One tap means one thing.** A cell took two taps, a row one, a column two,
   and the first tap on a cell only drew a ring. One grammar: a tap opens what
   you tapped, at its own scope.

## Wave B · THE EDITOR FITS THE SCREEN

4. **No control taller than the phone.** The variation picker measured 1,378 px
   on an 844 px screen, which is how the walkthrough typed *a beat later* where
   it meant *filled in*. An editor is a scope-locked panel that fits, with the
   current value pinned in view and the vocabulary grouped.
5. **Refusals are said out loud** — the law's OWNER is `nukernel/PROGRAM.md`
   §2.3's `why` clause (`sheets.js` throws at build time without one, because a
   silent grey is the bug this design exists to prevent). This is a wave, not
   a second copy: every disabled control already carries a written reason —
   the best writing in the product, shown to nobody. Show it.
6. **A variation is a chain** (the queued round folds in here): pick several,
   in order, for a line and for the drums.

## Wave C · THE RECORD YOU CAN KEEP

7. **The genre index is searchable.** 19,306 px of scrolling to reach trip-hop
   is the first impression for anyone who knows what they want. A field, and a
   jump by century.
8. **A section has a name.** Types only today, so a form that plainly has a
   pre-chorus cannot say so.
9. **A link carries the song**, and never merges destructively over an existing
   one. Import lands you in the table looking at what you imported, and it
   survives a reload.

## Wave D · THE BASS HOLDS A LINE

10. **The bass READS a motif — the kernel was the half that moved.** Both
    compilers handed `K.bass` the first line's compiled phrase, so a bass cell
    that named a motif named it into nothing — the sheet said so honestly,
    which was the right refusal for a wrong architecture. Either the kernel
    lets a bass read its own material, or the column says where the choice
    would be. This is an engine round and it is its own wave.

    **THE ALTERNATIVE IS SPENT AND THE WAVE IS PAID (2026-09-07, commit
    `b12da62`).** The clause read *"Either the kernel lets a bass read its own
    material, or the column says where the choice would be"* — a fork, written
    because this document could not know which half was affordable. The first
    half was bought: `kernel.js` now declares `function bass(subj, g, bars,
    own)` and takes the bass's own compiled cell as a fourth argument, read as
    a figure over the record's own harmony. `document.js` carries the law
    under the heading *"...AND THE BASS READS ITS OWN (WAVE D, 2026-09-07)"*,
    including its three refusals (a bass that names nothing, a name not in the
    bank, and a drum cell each answer null) and why the pin does not move for
    it. The second half — *"the column says where the choice would be"* — was
    never needed and is not owed.

## The laws this program inherits

Measure the RENDERED artifact, never the intention. Any phone claim is measured
under iPhone emulation. One owner per fact; move code, never copy it. **Two
fixed CHROME bands and only these two** — the OWNER of that law is
`nukernel/TABLE.md` §16 (*"§13a.1 IS AMENDED TO TWO, IN WRITING"*), which
carries the four-row comparison of the band that was deleted against the band
that came back; read it there and do not restate it here. Every wave lands
gated, on staging, on its own.

*(This line read* **"Nothing is fixed but the bottom bar (§13)"** *until
2026-09-07. It was FALSE from the day the top strip landed: `test/shell.js`
A6/A7b measure two fixed bands at every width — the bar at 50.39px and the
strip at 44px — and §16 wrote the amendment properly on 2026-09-06 without it
travelling here. It was the SIXTH copy of a law amended in one place, which is
why this one is a pointer and not a wording.)*
