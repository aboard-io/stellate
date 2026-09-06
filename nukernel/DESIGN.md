# DESIGN — the system, before the features (2026-09-05)

Paul: *"Just think design system first."* Every round after this builds TO
this document; a control that is not one of these components, or a state
that is not one of these states, is a spec change first and code second.
The tokens are nu.css's own (they exist; this names the law each carries).
The tone is a composer's desk: what a hand reaches for first, in the words a
musician uses.

## 1 · Tokens (nu.css :root — the owners; nothing hard-coded elsewhere)

| family | tokens | law |
|---|---|---|
| ink | `--ink --dim --faint --paper --panel --ground --well --zebra` | one ink, one dim, one refused; paper under panel under well |
| meaning | `--hand --clock --meter --flag` (+ `-tint`) | **semantic, never decorative**: hand = you set it · clock = scheduled · meter = measured · flag = refused/warning; `--v0..3` = which player, `--q1..4` = how much |
| cluster | `--lz-h0 … --lz-h7` (the lozenge field's palette, and `--lz` is the one a cluster is wearing) | **hue means the KIND, weight means the STATE** — one ink per semantic cluster, outline when cold and fill when hot. Eight, and eight is a decision: past eight, hue stops being a category anyone can hold. Not the meaning four and not the voice six, because a cluster hue that collided with either would say something it does not mean; a ninth cluster reuses the first hue rather than inventing a colour |
| rule | `--bw` (1px) `--bw-hard --rule --rule-strong` | a rule is a HAIRLINE; a frame is a plate, and a plate is rare |
| radius | `--r0` 0 (a plate) `--r1` 6px (a control) `--r2` 3px (a chip) `--r-pill` (a lozenge, and only a lozenge) | small; nothing bubbles |
| space | `--s1` .2em hair · `--s2` .35em tight · `--s3` .55em gap · `--s4` .8em air · `--s5` 1.4em block | between controls that answer one question: s3; between questions: s4; between subjects: s5 |
| type | `--t0` .6rem … `--t5` 1.5rem; `--fw-body` 500 · `--fw-label` 700 · `--fw-block` 800 · `--fw-display` 900; `--sans --mono --num-fw` | body t3 = 1rem; a value is tabular; NOTHING under 16px on a phone that a hand edits; hierarchy by weight and size, not by boxes |
| tap | `--tap` 44px · `--bar-h` · `--head-h` | every control 44px tall; a control is a hair wider than its word (~.5ch each side); a slider's grab is `--sl-grab` |

## 2 · Components (the whole vocabulary; each with its states)

States every component may wear: **rest · derived (quiet, inherited/default) · written (bold, a hand set it) · selected (ring in --hand) · editing (the control popped up) · refused (dashed, with its sentence) · sounding (lamp in --clock) · measured (--meter)**. A state is a class the gates can read; a live state writes CHILDREN only.

1. **Cell** — a plain value at rest: its GLYPH and its WORD (or its WORDS: a cell's variation may be a CHAIN, and the cell reads the whole of it — `"inverted + the first half"`, TABLE.md §15), a number small beside its glyph, tabular. No border, no plate. **It says a word at every width** (TABLE.md §14): a player column is never narrower than a word (9ch in the cell's own type plus its padding, measured), the mark stacks over the word where the two will not share a line, and where a record has more players than a phone has room for the PANE scrolls sideways with the section column frozen — never a grid of identical dots. **ONE TAP OPENS IT**; a second tap on the same cell shuts it; Enter / F2 / a printable key opens from the keyboard; Delete clears to default; Escape restores; Tab commits and moves. Range by Shift or drag. (It read *"first tap selects; second tap edits"* until 2026-09-06 — right while the formula bar stood above the grid and the first tap filled it, and empty from the day §13a.6 deleted that bar.)
2. **Head** — a row or column header: glyph first and its NAME, which the column is now wide enough to hold because the cells under it are (TABLE.md §14; a head is still never cut mid-word — the whole name, else its first word, else the glyph alone), sticky on its axis, the corner pinned both ways; carries its lamp on its own edge; its menu on long-press / right-click. Its `+` at the end of the axis is ONE `--tap` cell that ADDS on the tap (TABLE.md §13e) — a section at the row axis, and at the column axis the one kind the band has not got, in build-the-band's order — never a row of offers and never a sheet asking which. Its accessible name says what a tap will add. **THE FROZEN COLUMN'S HEAD — the corner — SAYS HOW MANY AND FOLDS THE GRID** (TABLE.md §15a, 2026-09-06): its own word (SECTION, or PLAYER when the table is turned) with the COUNT under it in the quiet register, and its tap is the disclosure that hides the block it heads. The count goes under and not beside because the corner is 8ch and may not grow — at 390 a wider corner shows three players instead of four — and it costs the head band no height, the wrap fitting inside the button's own 44px floor. Folded, it is the row's only cell, the pane's full width, and the count is what the grid says.
3. **Special row** — the RECORD's seven (RULES · TIME · CHORDS · MOTIFS · MASTER · PRODUCE · PERFORMANCE), which are the sections of component 18 since 2026-09-06 (TABLE.md §14), and MIX, which is not one of them because a fader is the player's: a merged row, ONE LINE at rest and `--tap` tall (the word left, the sentence or the count right, ellipsised and never wrapped, a hairline under, no plate and no tint, no chips or lozenges inline, and a lamp inside that line or not at all); expanded = its sheet; keeps its open state across a recompile. It does NOT pin at rest — it scrolls out of the way — and pins only as the HEADER of its own open sheet, at the pane's top edge, carrying the × at its right end (TABLE.md §13a).
4. **Sheet** — a vector as rows (label · value · clear-back), full pane width, wrapping, in flow (never a modal), opened as the next `<tr>` under the row that owns it; its owner row is its header and is the pane's ONE pin while it is open (a cell sheet pins nothing at all — its header is component 5, in flow at its top).
5. **Cell sheet header** — the first line of the OPEN cell sheet: the address of the selection, then undo · redo · copy · paste. Present only while a cell sheet is open, in flow at its top, never fixed and never sticky. (It was the **formula bar**, a strip above the pane that became a bottom sheet on a phone — 105.8px of a 844px screen at rest, measured — until TABLE.md §13a.6 moved its head into the sheet and found its readout was the sheet's own first group all along. Undo and redo therefore live where the change was made.)
6. **Pop-up** — what a tap on a cell/field opens: a chip strip (≤ 8 words), a slider (a number), the envelope/curve editor (an envelope, an EQ, a lane), the native picker on a coarse pointer (> 8 words), the typed combo on a fine one. **Dismiss only on tap outside, Escape, or its own close — never on a value tap.** Sits where a keyboard cannot cover it.
7. **Chip** — a word: `--r2`, hairline, .5ch padding, 44px tall; pressed = written. A refused chip is **`aria-disabled` and never `disabled`** and **a tap on it prints its reason** — in the strip's own say line (`.nu-wsay`) on a sheet, under its word in a menu strip (TABLE.md §15). (It read *"a refused chip prints its reason under its word"* until 2026-09-06, which was true of `src/menus`' chip and false of the grid's: that one was `disabled`, so it took no click, and its sentence reached nobody with a thumb.)
8. **Slider** — for every continuous number: a trough (`--sl-trough`), a line, a cap; the number printed and typeable beside it; `touch-action: none`; arrows/Home/End; a long-press or the clear-back resets (double-tap is not a gesture on touch). It refuses out loud like everything else (component 14, TABLE.md §15): a refused slider says its reason and does not move, and a NUMBER typed outside the range says the range rather than snapping back with no word said.
9. **Curve editor** — one component, modes: ADSR · breakpoint lane · EQ bands · XY pad: a plate (`--r0`), 44px handles clamped inside it, a real curve, values printed beside handles in their units, drag by thumb, keyboard on a focused handle, reset by long-press/clear-back.
10. **Menu / picker** — one owner (`src/menus pickerFor`): chips ≤ 8 · native `<select>` on coarse > 8 · typed combo on fine; every address byte-identical across widgets.
11. **Lamp** — a child `<i>` painted `--clock` (scheduled) or `--meter` (measured); never both meanings in one colour. A lamp that says a SENTENCE rather than marking a thing — the MOTIFS row's — names what the current SECTION reads and is written at a section boundary, never per beat (TABLE.md §13f, Paul, 2026-09-05: *"The text in the motifs section is changing rapidly every beat it's too much."*); a lamp that is a dot beside a name may follow the beat. **Sounding row**: the playing section is lit WHOLE — the row head and its cells in a `--clock` ground, ≥ 3:1 against a resting row — by one class on the `<tr>`, toggled once per section by the same writer that marks the number, not a halo around it (Paul: *"Really light up the sections as you move through them — not just a tiny halo around the number."*). A class the clock writes is excluded from the frozen half BY THE PAGE, the way `[data-live]` children are.
12. **Bar** — fixed at the foot, `--bar-h`: genre plate · die + number (+ countdown) · opts fold · voicing · play. Icons with hidden labels and `data-say`; no visible words except the genre plate (Paul, 2026-09-05).
13. **Hamburger** — `#burger`, the LAST button of the bar, with the log's badge; its menu plate opens directly above it. A full-height in-flow sheet per viewer (Score · Video · Screensaver · Export), and the close is the **sheet header**'s: one line at the top of the open sheet, its name at the start and the × at the end. (It was a fixed plate at the top corner with the × beside it; TABLE.md §13a.1 deleted that strip — nothing is fixed but the bar.)
14. **Refusal** — never a missing control: the control drawn refused with its sentence, and **the sentence is REACHABLE BY A THUMB** (TABLE.md §15, off the Coach House walkthrough: *"`filled in` is disabled with a real and excellent reason … tapping it does nothing at all. I tapped it eight times"*). So: a refused control is **`aria-disabled` and never `disabled`** — a `disabled` button takes no click, and a reason only a screen reader can reach is the silent grey wearing an accessible name — and **a tap on it prints its reason and writes nothing**. ONE OWNER for the sentence (the `why` the field or option already carries; nothing derives a second) and ONE PLACE per widget: `.nu-lzsay` in a lozenge field, `.nu-wsay` beside a chip strip, an ops bar, a slider or a refused field head. THE ONE EXCEPTION is the native `<select>`, whose wheel the browser owns and whose `<option disabled>` is a refusal it enforces: there the reason rides IN THE OPTION'S OWN WORDS, through `menu.withWhy`.
15. **Glyph** — every icon from `ui/glyph.js`, each with its `.nu-vh` word and `data-say`; the sheet at 390 reads as a grid of marks.
16. **Lozenge field** (Paul, 2026-09-05: *"a novel interface for when there
    are tons of options and some of them can be multiple… tight lozenges,
    organized by color and clustered semantically by the kind of things
    they present… visibility into all of the options"*) — for any
    vocabulary past the chip limit (the 68 drum ops, 42 chord qualities, 63
    scales, 14+ transformations, the instruments): EVERY option visible at
    once as a tight lozenge (`--r-pill`, hairline, `--t2` type, AS TALL AS ITS
    WORD with `--tap` as the floor — a pill wraps to a second line only when
    its word cannot fit, and the row pitch is that height plus a gap: the 44px
    is a padding and a minimum and NEVER an overlap. It read *"~28px tall
    visually with a 44px hit area through its margins"* until 2026-09-05, when
    Paul photographed what that is on a phone — the border is on the button, so
    the drawn pill was the whole 44px inside a 34px pitch and every row crossed
    the outlines of the row above it), the field wrapping
    to the pane's width, the options CLUSTERED semantically with a small
    heading per cluster (drums: kick · snare · hats · toms & fills ·
    dynamics · feel; qualities: triads · sixths · sevenths · ninths ·
    elevenths · thirteenths · altered; scales: diatonic · melodic minor ·
    harmonic minor · pentatonic · hexatonic · octatonic · bebop · maqam ·
    thaat), each cluster carrying ONE hue from a small semantic palette
    (the cluster's ink on a tint of it, not rainbow noise — hue means the
    kind, weight means the state), the HOT ones (selected) filled in the
    cluster's ink, the rest outlined; single-select fields toggle one, multi-
    select fields toggle any number and keep an ordered chain where order
    matters (the transformations); a cluster folds by its heading, and **the
    field folds ITSELF TO FIT THE PHONE** (TABLE.md §15, 2026-09-06): three
    states, the first that fits winning — every cluster open (which is where
    this read *"but starts open"*, and is still what a vocabulary that fits
    gets), else the cluster holding the standing answer open and the rest
    headings with their counts, else every cluster folded with the standing one
    MARKED (`aria-current`, drawn in `--hand`) and printing the word it holds.
    NOTHING GOES BEHIND A SCROLL BOX OR A "MORE": the only thing that ever hides
    an option is a fold, its count is on its heading, and every word is one tap
    from the glass. The height is PACKED before the first paint and MEASURED one
    frame after the mount, stepping down only, and never against a hand — the
    moment a thumb presses a heading the field stops guessing. A chain of two or
    more prints its order (`.nu-lzn`, 1, 2, 3…); a chain of one does not, because
    a position nobody can act on is a number for nothing.
    A long-press on a lozenge prints its sentence, and so does a tap on a
    REFUSED one — a pill carries a word and never a sentence, at every width
    (Paul, 2026-09-05: *"you added sentences of text to some of them"*), so a
    refused lozenge is dashed and quiet with its word alone and the reason goes
    to the field's ONE say line; the whole field is
    scannable in one pass at 390 and never scrolls sideways. It replaces the
    native picker for these vocabularies on every pointer AND IS THE ONLY
    CONTROL ON ITS FACT — no native picker drawn beside it and none of the
    picker's ▾ over it; the native picker
    stays only where a vocabulary is long AND flat (a genre list).
17. **DELETED — the label row** (TABLE.md §15a, Paul, 2026-09-06: *"Get rid of
    the words 'the record' and the Section header entirely — we can make
    room."*). It was a one-line heading over a block of the table — SECTIONS
    over the grid, the only one there ever was — with its count on the right,
    and a disclosure since §13f. **A label over a column head that already
    prints its own name is a word charging a phone a whole line**, so the row
    is gone and its two jobs are the head's (component 2): the COUNT is drawn
    under that head's word in the quiet register, and the FOLD is that head's
    own tap. Everything the fold was is what it still is — `aria-expanded`,
    `aria-controls` naming the body it hides, the same block (the player heads,
    the grid's rows, the `+` row and the mix row aligned to them), a PAGE
    preference persisted per browser and NOT an op, no undo step, no document
    write, no share-link bit; it closes the block's own open sheet first, it
    leaves nothing pinned, and it never answers the `.nu-sphead` selector,
    because a fold is not a sheet. Folded, the head keeps its cell alone across
    the pane's full width and its count is the only thing the grid says — which
    is both the whole reason a hand folds it and the only way back. **No
    component replaces this one**: a heading whose block can name itself is not
    a component, it is a repetition.
18. **Record row** (TABLE.md §14, off the Coach House walkthrough: *"the page
    is sorted by age, not by scope"*) — the sheet's FIRST row and the one
    place the record talks: one `--tap` line at rest whose FACE IS THE LINE —
    **tempo · meter · key**, the TIME row's own face and not a second reading
    of it — read from the start at full ink, a hairline under, no plate. (It
    carried the word `THE RECORD` to its left until 2026-09-06, TABLE.md §15a,
    Paul: *"Get rid of the words 'the record' and the Section header entirely
    — we can make room."* A label over a line that already says what it is is
    a word for nothing; the accessible name, which says what a TAP does, is
    what it always was.) The table's own options ride the END of this line as a
    `--tap` square (`tcorner`: fill from the genre, re-seed, transpose), which
    is where they belong by scope and is where the SECTIONS count displaced
    them to — 8ch of frozen corner holds one 44px target, not two. A
    tap discloses its SEVEN SECTIONS — RULES · TIME · CHORDS · MOTIFS ·
    MASTER · PRODUCE · PERFORMANCE — each a special row (component 3) opening
    its own sheet, ONE at a time; every address is the one it had before the
    collapse. It wears the label row's box and not `.nu-sphead`'s class, for
    the disclosure's own measured reason (sharing it makes every "shut
    whatever is open" gesture fold the panel away). Unlike the SECTIONS fold
    it is NOT persisted: folding the grid is a standing preference, opening
    the record is a drill-down, and the sheet's resting state is one line. It
    replaces four rows above the grid and three below it; the `<tfoot>` then
    holds the MIX strips alone.
19. **Text field** (TABLE.md §14a, off the review's item 8: *"A section has a
    name. Types only today, so a form that plainly has a pre-chorus cannot say
    so."*) — the one control on a sheet that is a KEYBOARD and not a
    vocabulary, for a value nobody can offer: a single-line
    `<input type="text">` drawn as an ordinary sheet row (label · box), taking
    the row's slack, `--tap` tall, its type **≥ 16px** (`--t3`) because mobile
    Safari zooms the page in on a smaller focused input and does not zoom back
    out, wearing the same seated hairline every control in a sheet wears
    (`#pan-band .nu-vsheet`: no box, one `--rule` underline, `--r0`), and
    carrying the DOCUMENT's own cap as `maxlength` — read from the one owner of
    that number, never restated. **Blank is the default**: the box is empty
    when nothing is written, the value that stands in its place is its
    PLACEHOLDER in `--dim`, and clearing the box deletes the key. **It writes
    on commit, never on a keystroke** — blur, Enter, or a tap outside commits
    (once, and only if the value changed); Escape puts the written value back
    and gives up focus — so one edit is one document write and one undo step.
    A tap outside is heard on `window` capture, BEFORE the sheet's own
    close-on-outside listener on `document`, or the sheet takes the focused
    input off the page and the letters are lost with no `blur`.

## 3 · Interaction laws

- Tap-first; the desktop is the phone given room. No pointer-only control.
- **ONE TAP OPENS WHAT YOU TAPPED, AT ITS OWN SCOPE** (TABLE.md §14): a cell opens the cell's editor, a row head the section, a column head the player, a record row its sheet. The SELECTION follows the opening rather than preceding it — the ring lands on the thing whose sheet is now under it — and a second tap on the same target shuts it. A range is Shift-tap, which selects and opens nothing. (A cell took two taps from 2026-09-05 to 2026-09-06: the first filled the formula bar, and it went on costing a tap after §13a.6 deleted that bar.)
- **Sorted by scope, not by age** (TABLE.md §14): a song has four scopes — record · section · player · cell — and every control belongs to exactly one. The record is ONE row at the top of the sheet; the sections are the grid's rows; the players are its columns and their mix strips; a cell is one player in one section. Nothing that belongs to the record stands at the foot of the page.
- **NO CONTROL IS TALLER THAN THE PHONE** (TABLE.md §15): every editor a tap
  opens fits the viewport at 390 and at 320 as it opens, with the answer it is
  standing on visible without a scroll. A field too long for the screen FOLDS —
  by cluster, with the count on the heading, every word one tap away — and never
  goes behind a scroll box, a wheel or a "more". Measured on the rendered page,
  every time: 734 pickers, 80 over the viewport before and 0 after.
- **A REFUSAL IS SAID OUT LOUD** (TABLE.md §15): a refused control is
  `aria-disabled` and never `disabled`, and a TAP on it prints the reason it
  already carries. One owner for the sentence, one place per widget, and no
  reason that only a screen reader can reach.
- One selection; one open pop-up; one owner per fact.
- A change lands at the next bar while playing (evolve); undo/redo at the document level, every op.
- Blank = default (inherited); bold = written; delete = back to default.
- Nothing dismisses under a finger that is changing a value.
- Nothing scrolls sideways at the page level; the pane is the scrollport.
- One scroll, one pin (TABLE.md §13): nothing is fixed but the bottom bar; inside the pane one band sticks at a time — the grid's heads while the grid is under the thumb, or the owner row of the open sheet as its header, and never anything in a `<tfoot>`. Special rows are one line at rest. Adders are one cell, not columns, and a tap on one ADDS rather than asking (§13e). A cell says a WORD at every width — the column is sized to one and the pane scrolls sideways with the section column frozen, rather than the cells falling back to a grid of identical marks (§14). Opening or closing a sheet leaves the pane's `scrollTop` identical. **NOTHING RUBBER-BANDS** (TABLE.md §15a, 2026-09-06, Paul: *"I can drag it too far right and then the whole thing moves including the fixed parts… it all feels reel wobbly"*): every scroller a thumb drags SIDEWAYS is `overscroll-behavior: none` and not `contain` — `contain` stops the gesture CHAINING to the scroller behind and still lets the scroller bounce inside itself, and a bounce translates its `position: sticky` children with it. The document too, which also turns pull-to-refresh off so a flick cannot reload the box mid-edit.
- **A HEADING WHOSE BLOCK CAN NAME ITSELF IS NOT DRAWN** (TABLE.md §15a): no label row over a column that prints its own name, no word beside a face that already says what the row is. The accessible name carries what a control DOES; the glass carries the record's own words.

## 4 · Copy (the voice)

Plain, app-like, a musician's words. "Default" for an inherited or dealt
value. Verbs for actions ("Add player", "Delete section"), nouns for things
("Tempo", "Key", "Swing", "Attack"), units after numbers. No narrative, no
possessives of the box ("the record's own"), no dates, no code, no quotes.
A chip or a face: ≤ 6 words. A sentence beside a refused control: ≤ 12
words. What a composer calls it wins: motif, chord, key, tempo, meter,
part, player, section, take. (It read *phrase* until 2026-09-05 — Paul:
*"Call phrases motifs"*, TABLE.md §13e. *Phrasing* and *phrase structure* stay
where they mean the performance and the form.)

## 5 · The composer's order (what a sheet lists first)

The rules (what the genre says) → time (tempo · meter · key) → the chords
(the changes, then what the harmony does with them) → the form (sections) →
the players → each cell's motif, then its dynamics, then its treatment. In a
chair's sheet: the instrument, then its envelope, then its tone, then where
it sits.

(It read *"Time (tempo · meter · key) → the form …"* until 2026-09-05, when
Paul put the rules over the tempo they set and gave the changes a row of
their own: TABLE.md §13f. Key, mode and scale are the alphabet and stay in
TIME; the changes and the harmony are what a record DOES over them.)

...AND SINCE 2026-09-06 THE FIRST FOUR READ WITH THE LAST THREE OF THE
RECORD'S (TABLE.md §14). The order above is unchanged and is now the order of
the record row's own sections: rules → time → chords → motifs → master →
produce → performance, then the form (the grid), then the players and their
mix strips, then each cell. What moved is not the order but the END OF THE
PAGE the last three stood at: master, produce and performance are facts about
the whole record, so they read with the other four rather than eight screens
below them.
