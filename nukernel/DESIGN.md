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

1. **Cell** — a plain value at rest: its GLYPH first, the word only where no honest glyph exists, a number small beside its glyph, tabular. No border, no plate. First tap selects; second tap / Enter / F2 / a printable key edits; Delete clears to default; Escape restores; Tab commits and moves. Range by Shift or drag.
2. **Head** — a row or column header: glyph first and its word where the column has room for it whole (≥ 9ch; a head is never cut mid-word — the whole name, else its first word, else the glyph alone), sticky on its axis, the corner pinned both ways; carries its lamp on its own edge; its menu on long-press / right-click. Its `+` at the end of the axis is ONE `--tap` cell that ADDS on the tap (TABLE.md §13e) — a section at the row axis, and at the column axis the one kind the band has not got, in build-the-band's order — never a row of offers and never a sheet asking which. Its accessible name says what a tap will add.
3. **Special row** — TIME · RULES · MOTIFS above, MIX · PRODUCE · PERFORM below: a merged row, ONE LINE at rest and `--tap` tall (the word left, the sentence or the count right, ellipsised and never wrapped, a hairline under, no plate and no tint, no chips or lozenges inline, and a lamp inside that line or not at all); expanded = its sheet; keeps its open state across a recompile. It does NOT pin at rest — it scrolls out of the way — and pins only as the HEADER of its own open sheet, at the pane's top edge, carrying the × at its right end (TABLE.md §13a).
4. **Sheet** — a vector as rows (label · value · clear-back), full pane width, wrapping, in flow (never a modal), opened as the next `<tr>` under the row that owns it; its owner row is its header and is the pane's ONE pin while it is open (a cell sheet pins nothing at all — its header is component 5, in flow at its top).
5. **Cell sheet header** — the first line of the OPEN cell sheet: the address of the selection, then undo · redo · copy · paste. Present only while a cell sheet is open, in flow at its top, never fixed and never sticky. (It was the **formula bar**, a strip above the pane that became a bottom sheet on a phone — 105.8px of a 844px screen at rest, measured — until TABLE.md §13a.6 moved its head into the sheet and found its readout was the sheet's own first group all along. Undo and redo therefore live where the change was made.)
6. **Pop-up** — what a tap on a cell/field opens: a chip strip (≤ 8 words), a slider (a number), the envelope/curve editor (an envelope, an EQ, a lane), the native picker on a coarse pointer (> 8 words), the typed combo on a fine one. **Dismiss only on tap outside, Escape, or its own close — never on a value tap.** Sits where a keyboard cannot cover it.
7. **Chip** — a word: `--r2`, hairline, .5ch padding, 44px tall; pressed = written; a refused chip prints its reason under its word.
8. **Slider** — for every continuous number: a trough (`--sl-trough`), a line, a cap; the number printed and typeable beside it; `touch-action: none`; arrows/Home/End; a long-press or the clear-back resets (double-tap is not a gesture on touch).
9. **Curve editor** — one component, modes: ADSR · breakpoint lane · EQ bands · XY pad: a plate (`--r0`), 44px handles clamped inside it, a real curve, values printed beside handles in their units, drag by thumb, keyboard on a focused handle, reset by long-press/clear-back.
10. **Menu / picker** — one owner (`src/menus pickerFor`): chips ≤ 8 · native `<select>` on coarse > 8 · typed combo on fine; every address byte-identical across widgets.
11. **Lamp** — a child `<i>` painted `--clock` (scheduled) or `--meter` (measured); never both meanings in one colour.
12. **Bar** — fixed at the foot, `--bar-h`: genre plate · die + number (+ countdown) · opts fold · voicing · play. Icons with hidden labels and `data-say`; no visible words except the genre plate (Paul, 2026-09-05).
13. **Hamburger** — `#burger`, the LAST button of the bar, with the log's badge; its menu plate opens directly above it. A full-height in-flow sheet per viewer (Score · Video · Screensaver · Export), and the close is the **sheet header**'s: one line at the top of the open sheet, its name at the start and the × at the end. (It was a fixed plate at the top corner with the × beside it; TABLE.md §13a.1 deleted that strip — nothing is fixed but the bar.)
14. **Refusal** — never a missing control: the control drawn disabled with its sentence beside it (no silent grey).
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
    matters (the transformations); a cluster folds by its heading but starts
    open; a long-press on a lozenge prints its sentence, and so does a tap on a
    REFUSED one — a pill carries a word and never a sentence, at every width
    (Paul, 2026-09-05: *"you added sentences of text to some of them"*), so a
    refused lozenge is dashed and quiet with its word alone and the reason goes
    to the field's ONE say line; the whole field is
    scannable in one pass at 390 and never scrolls sideways. It replaces the
    native picker for these vocabularies on every pointer AND IS THE ONLY
    CONTROL ON ITS FACT — no native picker drawn beside it and none of the
    picker's ▾ over it; the native picker
    stays only where a vocabulary is long AND flat (a genre list).
17. **Label row** (TABLE.md §13e, Paul, 2026-09-05: *"Give the main composer
    interface its own header call it Sections"*) — a one-line heading over a
    block of the table, and the only row that is not a control: the word left
    in the special row's own style (uppercase, `--fw-block`), its count right,
    `--tap` tall, a hairline under, no plate — and no button, no address and
    nothing to open. It is also the one `<thead>` row that NEVER pins: the
    pane's single pin belongs to the column heads under it. SECTIONS, over the
    grid, is the only one.

## 3 · Interaction laws

- Tap-first; the desktop is the phone given room. No pointer-only control.
- One selection; one open pop-up; one owner per fact.
- A change lands at the next bar while playing (evolve); undo/redo at the document level, every op.
- Blank = default (inherited); bold = written; delete = back to default.
- Nothing dismisses under a finger that is changing a value.
- Nothing scrolls sideways at the page level; the pane is the scrollport.
- One scroll, one pin (TABLE.md §13): nothing is fixed but the bottom bar; inside the pane one band sticks at a time — the grid's heads while the grid is under the thumb, or the owner row of the open sheet as its header, and never anything in a `<tfoot>`. Special rows are one line at rest. Adders are one cell, not columns, and a tap on one ADDS rather than asking (§13e). A cell is its glyph first and its word where the column has room. Opening or closing a sheet leaves the pane's `scrollTop` identical.

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

Time (tempo · meter · key) → the form (sections) → the players → each
cell's motif, then its dynamics, then its treatment. In a chair's sheet:
the instrument, then its envelope, then its tone, then where it sits.
