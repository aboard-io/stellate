# DESIGN — the system, before the features (2026-09-05)

Paul: *"Just think design system first."* Every round after this builds TO
this document; a control that is not one of these components, or a state
that is not one of these states, is a spec change first and code second.
The tokens are nu.css's own (they exist; this names the law each carries).
The tone is a composer's desk: what a hand reaches for first, in the words a
musician uses.

**A LAW STATES ITS OWN MEASUREMENT, AND A REVERSAL IS REWRITTEN RATHER THAN
DELETED.** The laws in this document that hold are the ones carrying a number
and where it was taken — 44.0 measured, 891 in 785, 9 and 9 over eight bars,
404 of 426 — and the ones that drift are the ones that carry an adverb instead
(*never*, *only*, *nothing else*). So every law below either names its
measurement and the gate that takes it, or says out loud that it is a budget
rather than a description. And when one is reversed it keeps a parenthesis
quoting what it READ, the DATE it changed and WHY, which is `PROGRAM.md` §1.0's first convention's
rule — *"a contract you can no longer read as it was written is a contract
nobody can check a reversal against"* — and the reason a reader can audit this
document at all. **A HEADER IS A LAW TOO**: a reversal written into a paragraph
under an ALL-CAPS sentence that still says the old thing is a document arguing
against itself in its loudest voice, and the header is corrected FIRST.

## 1 · Tokens — and `nukernel/tokens.css` is the owner

**THE TOKENS MOVED OUT OF nu.css ON 2026-09-07** (docs/DESIGN-SYSTEM.md step
1). They are declared in `nukernel/tokens.css`, alone in a file, linked between
`fonts.css` and `nu.css`, with **every token argued on its own line** — which
is why this section points at that file instead of restating it. A table here
and a declaration there is two owners of one value, which is the drift the move
was made to end. `nu.css` declares nothing at `:root` and types no literal
colour in a rule; `test/design-system.js` D4 measures both.

What this section still owns is the LAW each family carries, because a law is
about how the page uses a token and is not a value:

| family | law |
|---|---|
| the deck | three depths of ground and no fourth: `--deck` the chassis, `--panel` a plate bolted to it, `--well` a cut into the plate. Everything else is a hairline |
| the legend | printed on the panel: small caps, dim, fixed, **never lit**. Three voices — `--legend`, `--legend-dim` (units and counts), `--legend-faint` (refused, and only refused) |
| the lamps | **three lamps and one screen, and that is the whole colour system.** `--lamp` green = on / selected / a hand set it · `--armed` amber = about to matter · `--clip` red = the tempo LED, clipping, destruction. `--value` is the phosphor the SCREEN prints a readout in and is not a lamp. **A lamp is the one place saturated colour is allowed**, which is what settles "selected boxes are oddly selected": a selected thing is LIT, and nothing else in the system lights |
| meaning | `--hand --clock --meter --flag` (+ `-tint`) are **semantic, never decorative**, and they are the four the panel already has: hand = the lamp · clock = the red one · meter = the screen · flag = the amber. `--v0..3`/`--vb`/`--drum` = which player, `--q1..4` = how much |
| cluster | `--lz-h0 … --lz-h7` — **hue means the KIND, weight means the STATE**. Eight, and eight is a decision: past eight, hue stops being a category anyone can hold, and a ninth cluster reuses the first rather than inventing a colour. Kept clear of the three lamps, so a cluster never reads as a state |
| rule | `--bw` (1px) a control's frame · `--bw-hard` (2px) an emphasis edge and a focus ring. A rule is a HAIRLINE; a frame is a plate, and a plate is rare |
| radius | `--r0` a plate · `--r1` a control · `--r2` a chip · `--r-pill` a lozenge, and only a lozenge. Small; nothing bubbles |
| space | **five steps and no sixth — AND ON THIS PAGE THAT IS A BUDGET, NOT A DESCRIPTION**: `--s1` hair · `--s2` tight · `--s3` gap · `--s4` air · `--s5` block. Between controls that answer one question: s3; between questions: s4; between subjects: s5. **The steps are `em`, and the census of 2026-09-07 measured what that costs**: five steps render as twenty-one distinct pixel values at 390, **404 of 426 declarations off the ramp**, 196 of them from one rule. So the ramp is PROVEN where it is met and DECLARED where it is not: `test/design-system.js` measures 1,576 rendered spacing values with none off it on `nukernel/design.html`, the gallery — and the app's own census is the 404 above. Changing the unit makes the page BIGGER, so the ramp is unmoved, the census is the evidence step 5 of `docs/DESIGN-SYSTEM.md` (the squeeze) spends, and **step 5 owns closing the gap** — either the ramp goes to `rem` and the type comes down with it, or `em` is declared correct and the ramp is redefined as a proportion. (This read as a flat *"five steps and no sixth"* until 2026-09-07, with the census beside it: a sentence describing a tree that measurably was not that, in a table of laws. The law is unchanged; what changed is that it now says which of the two pages it is true of.) |
| type | `--t0` … `--t5`; `--fw-body` 500 · `--fw-label` 700 · `--fw-block` 800 · `--fw-display` 900; `--sans --mono --sym --num-fw`. Body t3 = 1rem; a value is tabular; NOTHING under 16px on a phone that a hand edits; hierarchy by weight and size, not by boxes. **THE FAMILY IS IBM PLEX** and `nukernel/fonts.css` holds every `@font-face` and nothing else, self-hosted at `vendor/plex` and never a CDN, because this page boots with the wire cut under COEP `require-corp`. `--sym` is the ONE face token deliberately not Plex and is a glyph stack, not a type choice: the page draws its marks as characters (▾ ↕ ↑ ▫ ▪) no Latin block of Plex contains, and *a serif ↕ next to a sans ↑ is two different arrows* |
| tap | `--tap` 44px · `--bar-h` · `--top-h`. Every control 44px tall; a control is a hair wider than its word (~.5ch each side); a slider's grab is `--sl-grab`. **The tap floor is not spacing and does not move when the page is squeezed** |

**THE DECK IS THE COMMITTED LOOK AND THERE IS NO `prefers-color-scheme` QUERY.**
A machine looks the same in every room — nu.css made that argument itself when
it retired the old system-colour dark mode, and it holds the other way round
too. A second theme exists and is a real design rather than an inversion:
`:root[data-theme="light"]`, the same panel under studio lights, with the
phosphor read as dark green on grey the way an LCD is read in daylight. It is
reached by a hand, not by a system setting.

## 2 · Components (the whole vocabulary; each with its states)

**THE STATES ARE THREE LAYERS, AND THIS IS THE FIRST OF THEM.** THE TABLE's
states — the classes the grid writes on a cell or a row — are: **rest · derived
(quiet, inherited/default) · written (bold, a hand set it) · selected (ring in
--hand) · editing (the control popped up) · refused (dashed, with its sentence)
· sounding (lamp in --clock) · measured (--meter)**. A state is a class the
gates can read (`nu.css:5809-5813` draws `.is-derived` / `.is-refused`); a live
state writes CHILDREN only.

The other two layers are real, live, and are not this one — the code follows all
three, at three tiers, and until 2026-09-07 no document said so, which read as
one system declaring two state vocabularies and calling both "the states every
component may wear":

| layer | who writes it | the vocabulary | where it is declared |
|---|---|---|---|
| **the table** | the grid, as CLASSES on a cell or a row | the eight above | this section, and it is the owner of the framing |
| **the elements** | a host attribute on one of the seven tags | `[selected] [open] [refused] [busy]`, rest their absence, plus the browser's own `hover` and `focus` | §2a, one selector in nu.css and one query in the gate per state |
| **the page** | the older page-wide class vocabulary, still live | `.is-on` · `.is-off` · `.is-quiet` · `<mark>`/`.is-now` | `PROGRAM.md` §2.4's FOUR STATES, still drawn by `nu.css` and `ui/sheets.js` |

They overlap in three words (`rest`, `selected`, `refused`) and mean the same
thing in all three. A state that is not in the layer you are writing at is a
spec change first and code second, the same as a component is.

1. **Cell** — a plain value at rest: its GLYPH and its WORD (or its WORDS: a cell's variation may be a CHAIN, and the cell reads the whole of it — `"inverted + the first half"`, TABLE.md §15), a number small beside its glyph, tabular. No border, no plate. **It says a word at every width** (TABLE.md §14): a player column is never narrower than a word (9ch in the cell's own type plus its padding, measured), the mark stacks over the word where the two will not share a line, and where a record has more players than a phone has room for the PANE scrolls sideways with the section column frozen — never a grid of identical dots. **THE 9ch FLOOR IS WHAT MAKES THAT TRUE**, and it is a sizing rule, not a preference: the grid is `inline-size: max(100%, calc(13ch + var(--cols,1) * 9ch))` (`nu.css:5474`), so the ≥ 9ch test a column has to pass to print its word always passes and the pane takes the overflow. TABLE.md §13a.7's `has-words` toggle is still in the tree underneath — `grid.ts:611` measures the column and `nu.css:8333` hides `.nu-w` without it — as the SAFETY NET under the floor and not as a second law; §13a.7 read *"cells are glyphs first, words when there is room"* and was the law until TABLE.md §14 replaced it, and what survives of it is the measurement, not the preference. A round that finds `has-words` and takes it for the live rule has the two backwards. **THE CELL'S OPENING IS §3's LAW — ONE TAP, AT ITS OWN SCOPE — AND IS STATED THERE, ONCE** (it stood here as well, in the same words, until 2026-09-07: two copies in one document). What is this component's own is the KEYBOARD grammar §3 does not carry: Enter / F2 / a printable key opens, Delete clears to default, Escape restores, Tab commits and moves. Range by Shift or drag. (It read *"first tap selects; second tap edits"* until 2026-09-06 — right while the formula bar stood above the grid and the first tap filled it, and empty from the day §13a.6 deleted that bar.)
2. **Head** — a row or column header: glyph first and its NAME, which the column is now wide enough to hold because the cells under it are (TABLE.md §14; a head is still never cut mid-word — the whole name, else its first word, else the glyph alone), sticky on its axis, the corner pinned both ways; carries its lamp on its own edge; its menu on long-press / right-click. Its `+` at the end of the axis is ONE `--tap` cell that ADDS on the tap (TABLE.md §13e) — a section at the row axis, and at the column axis the one kind the band has not got, in build-the-band's order — never a row of offers and never a sheet asking which. Its accessible name says what a tap will add. **THE FROZEN COLUMN'S HEAD — the corner — SAYS HOW MANY AND FOLDS THE GRID** (TABLE.md §15a, 2026-09-06): its own word (SECTION, or PLAYER when the table is turned) with the COUNT under it in the quiet register, and its tap is the disclosure that hides the block it heads. The count goes under and not beside because the corner is 8ch and may not grow — at 390 a wider corner shows three players instead of four — and it costs the head band no height, the wrap fitting inside the button's own 44px floor. Folded, it is the row's only cell, the pane's full width, and the count is what the grid says. **A STICKY HEAD MUST BE OPAQUE, AND ABOVE THE SHEET** (written down here 2026-09-07; both halves were measured into `nu.css` and stated in no document): sticking is not enough, because a `<th>` with no ground of its own lets the sheet's rows scroll straight THROUGH it — the restyle took the table's `background` off, which is right, and took the heads' ground with it (`nu.css:8998`, measured at 1280 on the row sheet) — and a ground stops what is UNDER a head without stopping what paints OVER it, since `.nu-vsheet` is `position: sticky` too and two sticky boxes with no `z-index` paint in document order, the later one winning (`nu.css:9070`). So a head owes a ground AND a stacking order, every time. Two more of the same shape: **the symbol may not eat the tap** — a mark inside a control is `pointer-events: none` (`nu.css:2825`), the half-hour the globe round lost to a decorative stroke swallowing every press — and a sticky `<tr>` does nothing at all: rows cannot stick, cells can (`nu.css:82-84`, `PROGRAM.md` §5's three failure modes), which is why every sticky rule on this page is on a `th` or a `td`.
3. **Special row** — the RECORD's seven SPECIAL ROWS (RULES · TIME · CHORDS · MOTIFS · MASTER · PRODUCE · PERFORMANCE), which are the sections of component 18 since 2026-09-06 (TABLE.md §14) and which are seven of the record's EIGHT SURFACES — component 18 owns that count and says what the eighth is — and MIX, which is not one of them because a fader is the player's: a merged row, ONE LINE at rest and `--tap` tall (the word left, the sentence or the count right, ellipsised and never wrapped, a hairline under, no plate and no tint, no chips or lozenges inline, and a lamp inside that line or not at all); expanded = its sheet; keeps its open state across a recompile. It does NOT pin at rest — it scrolls out of the way — and pins only as the HEADER of its own open sheet, at the pane's top edge, carrying the × at its right end (TABLE.md §13a).
4. **Sheet** — a vector as rows (label · value · clear-back), full pane width, wrapping, in flow (never a modal), opened as the next `<tr>` under the row that owns it; its owner row is its header and is the pane's ONE pin while it is open (a cell sheet pins nothing at all — its header is component 5, in flow at its top).
5. **Cell sheet header** — the first line of the OPEN cell sheet: the address of the selection, then undo · redo · copy · paste. Present only while a cell sheet is open, in flow at its top, never fixed and never sticky. (It was the **formula bar**, a strip above the pane that became a bottom sheet on a phone — 105.8px of a 844px screen at rest, measured — until TABLE.md §13a.6 moved its head into the sheet and found its readout was the sheet's own first group all along. Undo and redo therefore live where the change was made.)
6. **Pop-up** — what a tap on a cell/field opens: a chip strip (≤ 8 words), a slider (a number), the envelope/curve editor (an envelope, an EQ, a lane), the native picker on a coarse pointer (> 8 words), the typed combo on a fine one. **Dismiss only on tap outside, Escape, or its own close — never on a value tap.** Sits where a keyboard cannot cover it.
7. **Chip** — a word: `--r2`, hairline, .5ch padding, 44px tall; pressed = written. **A refused chip refuses out loud by §3's refusal law** (whose owner is `PROGRAM.md` §2.3's `why` clause) — this component does not restate it; what is the CHIP's own is WHERE the sentence goes: the strip's own say line (`.nu-wsay`) on a sheet, under its word in a menu strip (TABLE.md §15). (It read *"a refused chip prints its reason under its word"* until 2026-09-06, which was true of `src/menus`' chip and false of the grid's: that one was `disabled`, so it took no click, and its sentence reached nobody with a thumb.)
8. **Slider** — for every continuous number: a trough (`--sl-trough`), a line, a cap; the number printed and typeable beside it; `touch-action: none`; arrows/Home/End; a long-press or the clear-back resets (double-tap is not a gesture on touch). **It refuses out loud by §3's refusal law** (TABLE.md §15), which this component does not restate: a refused slider does not move, and — the SLIDER's own clause, because no other widget takes a typed number under a range — a NUMBER typed outside the range says the range rather than snapping back with no word said.
9. **Curve editor** — one component, modes: ADSR · breakpoint lane · EQ bands · XY pad: a plate (`--r0`), 44px handles clamped inside it, a real curve, values printed beside handles in their units, drag by thumb, keyboard on a focused handle, reset by long-press/clear-back. **A REFUSED HANDLE REFUSES OUT LOUD** — §3's refusal law, reaching its last widget (TABLE.md §17, 2026-09-06); this component does not restate the law, and what is the PLATE's own is that the handle does not move and that **the reason prints in the plate's own say line** (`.nu-wsay`, one per plate, its room reserved so a sentence arriving under a thumb moves nothing) as well as in the hold-to-learn popover (`data-say`). It bound no listener at all until 2026-09-06 — the sentence was in `title` and in the accessible name and a thumb on it did nothing, which is the silent grey this system's §3 law names. The case that found it: a sampled player's **sustain**, on a recording with no loop zone.
10. **Menu / picker** — one owner (`src/menus pickerFor`): chips ≤ 8 · native `<select>` on coarse > 8 · typed combo on fine; every address byte-identical across widgets.
11. **Lamp** — a child `<i>` painted `--clock` (scheduled) or `--meter` (measured); never both meanings in one colour. A lamp that says a SENTENCE rather than marking a thing — the MOTIFS row's — names what the current SECTION reads and is written at a section boundary, never per beat (TABLE.md §13f, Paul, 2026-09-05: *"The text in the motifs section is changing rapidly every beat it's too much."*); a lamp that is a dot beside a name may follow the beat. **Sounding row**: the playing section is lit WHOLE — the row head and its cells in a `--clock` ground, ≥ 3:1 against a resting row — by one class on the `<tr>`, toggled once per section by the same writer that marks the number, not a halo around it (Paul: *"Really light up the sections as you move through them — not just a tiny halo around the number."*). A class the clock writes is excluded from the frozen half BY THE PAGE, the way `[data-live]` children are.
12. **Bar** — fixed at the foot, `--bar-h`, and **THE TRANSPORT AND NOTHING ELSE SINCE 2026-09-06** (TABLE.md §16, Paul: *"So now bottom row is pure play controls and top right is compose arrange controls"*): **the voicing · play · the die · the room**, in that order, and **NO POP-UP AT ALL** (TABLE.md §20, 2026-09-07, Paul: *"Bottom bar: get rid of gear and move those functions into the menu"*). The ⚙ and its fold are deleted and the two controls behind them — the play mode and the take — are rows of the hamburger's HOW IT PLAYS block, the same nodes, one tap from the open plate where they were two from rest; the seed's NUMBER is deleted with them (*"Get rid of seed number too"*), so the die stands alone and **the die's own face IS the countdown** while a reseed waits (*"replace the die icon with the countdown"* — one node fewer, `data-live="pending"` on the mark, the same feed and the same arithmetic). **THE ROOM IS ONE WIDTH AT EVERY GLASS** — 112px, argued from the 320px budget (312 of content, less two 44px marks and the die and three seams, leaves 176, which is half a phone for a number between 0 and 100) — where it was the row's flexible child and measured 1,036px at 1280. **NO BORDER AND NO SHADOW ON ITS CONTROLS: A `--rule` HAIRLINE BETWEEN THEM** (*"Get rid of icon borders and shadows just put a light line between"*), drawn on the second child onwards at both levels the bar nests. **The `--tap` floor is untouched in both axes** — a control losing its border is not a control losing its size, and the 1px is a border on the box, not a bite out of it. (It read *"the opts fold · the voicing · play, then the TAPE taking the row's give at the end"*.) Icons with hidden labels and `data-say`; no visible words at all now that the genre plate has left it. (It read *"genre plate · die + number (+ countdown) · opts fold · voicing · play"*, and each of those three departures is filed: the genre plate is the TOP STRIP's, component 20; the die and its number are a row of the hamburger, component 13; the general countdown is inside the tape. What stayed is what a press of ▶ is about.) **The genre plate was a DOOR AND THEREFORE A TOGGLE** (2026-09-06, Paul: *"When I tap the button of the bottom left showing the genre close the picker and take me back to the compose view"*): it opens the picker and the same press closes it back to the table, so it wears `aria-expanded` + `aria-controls` beside the `aria-pressed` that marks it as the open tab. Its accessible NAME stays the genre's own word — the state says what the tap will do; the name says what the record is. Closing writes nothing: it is a `showTab`, and the record, the slots and the undo stack do not move.
13. **Hamburger** — `#burger`, the LAST button of the **top strip** (component 20); its menu plate opens **at the top of the screen, in front of the strip**, and stops at the bar's top edge (TABLE.md §20, 2026-09-07, Paul: *"The hamburger menu should open higher and the menu icon should be a dismiss button"*; measured, the plate's top edge went 47.2 → 3.2 and it no longer covers 40px of the transport, which leaves a full-width band of "outside" for the first of §3's three ways out). **WHILE THE PLATE IS OPEN THE ≡ IS THE DISMISS**: it wears × and its accessible name is `close`, and pressing it shuts the plate — `#play`'s own law (*"the word on it is the NEXT tap"*) said on the other fixed band. This is not what §13a.1 refused: **the ≡ never opened a sheet**, so a sheet's × is still the sheet's, and the plate is the one surface the ≡ opens and therefore the one it may honestly close. The strip rises with it and gives up everything else for the duration (`data-menu="open"`: no ground, no rule, its other two children hidden, `pointer-events: none` on the band) — a `z-index` on the button alone cannot work, because a child competes only inside its parent's stacking context. **EVERY ROW OF THE PLATE IS ONE FORMAT: a UNICODE MARK (never an emoji — the property is `Emoji_Presentation`, not `Extended_Pictographic`, or ▶ and ⚙ would be refused) then a TITLE-CASE NAME, and nothing else on the glass.** Title case is `text-transform: capitalize` on the plate's own words and never a second copy of them in the catalogue. **The LOG'S count is the one trailing number in the plate.** The blocks read THE RECORD (its eight surfaces — the seven special rows and the record row's own face, counted and named in component 18) · WHERE YOU ARE (the six views) · HOW IT PLAYS (the play mode and the take) · Set Seed · Log — the record first, because a hand opens this plate to work on the record far more often than to leave the page it is on. **IT IS THE VIEW SELECTOR AND IT HAS THREE BLOCKS** (TABLE.md §16, 2026-09-06, Paul: *"move the view selector into a hamburger on the top right. Consolidate that with the existing bottom right hamburger (which goes away)… Put the name of the app at the top of the hamburger… Organize the hamburger sensibly"*): the app's NAME as a heading, then **where you are** — all six views, `Session` first, the current one wearing `aria-current="page"` and never `aria-pressed` — then **what you are making** — `Set seed`, which is `.nu-seedrow` moved in whole, the same die and the same number with their own listeners — then **what the box has done**, the log with its count. There is ONE hamburger on the page; a second one at another corner is the modality this component was rewritten to delete. A full-height in-flow sheet per viewer (Score · Video · Screensaver · Export), and the close is the **sheet header**'s: one line at the top of the open sheet, its name at the start and the × at the end. (It was a fixed plate at the top corner with the × beside it; TABLE.md §13a.1 deleted that strip under the law AS IT THEN READ — *"nothing is fixed but the bottom bar"*, the 2026-09-05 wording, quoted here only to say what the plate was deleted under. **That is not the law now**: it was amended on 2026-09-06 to *"nothing is fixed but the bottom bar and the top strip, and only these two"*, and the owner of the amendment is TABLE.md §16's *"§13a.1 IS AMENDED TO TWO, IN WRITING"* (TABLE.md:4123). The strip this component sits in is the second of the two.) **THE PICKER'S HEADER IS THE × ALONE** (2026-09-06, Paul: *"Get rid of 'where' and the line above … leave the close icon. Use the new space to move the globe up."*): a sheet opened from a MENU of five has to say which of the five it is, and a sheet opened by pressing the one thing it holds does not — so `#atlas` hides the name and the rule under it and the globe is the first thing under the top edge (46px higher at 390×844). The four viewers keep both. A sheet that drops its visible name keeps a visually-hidden `<h2>`: a panel with no accessible name is not a component in this system.
14. **Refusal** — never a missing control: the control drawn refused with its sentence, and **the sentence is REACHABLE BY A THUMB** (TABLE.md §15, off the Coach House walkthrough: *"`filled in` is disabled with a real and excellent reason … tapping it does nothing at all. I tapped it eight times"*). **The LAW is §3's refusal bullet, whose owner is `PROGRAM.md` §2.3's `why` clause; this component is where it is DRAWN, not where it is stated.** What is drawn here: ONE OWNER for the sentence (the `why` the field or option already carries; nothing derives a second) and ONE PLACE per widget: `.nu-lzsay` in a lozenge field, `.nu-wsay` beside a chip strip, an ops bar, a slider, a refused field head, or **under a curve editor's plate** (component 9, added 2026-09-06 — the one widget this list did not reach, and the one whose refused control bound no listener at all). THE ONE EXCEPTION is the native `<select>`, whose wheel the browser owns and whose `<option disabled>` is a refusal it enforces: there the reason rides IN THE OPTION'S OWN WORDS, through `menu.withWhy`.
15. **Glyph** — every icon from `ui/glyph.js`, each with its `.nu-vh` word and `data-say`; the sheet at 390 reads as a grid of marks.
16. **Lozenge field** (Paul, 2026-09-05: *"a novel interface for when there
    are tons of options and some of them can be multiple… tight lozenges,
    organized by color and clustered semantically by the kind of things
    they present… visibility into all of the options"*) —
    **ITS CLAUSES ARE NUMBERED, AND THE NUMBERS ARE THE ONES THE CODE CITES**
    (2026-09-07): `src/lozenge/field.ts` cites these clauses BY NUMBER at
    seventeen places in its own comments — *"law 1"* six times, *"law 6"*
    twice, *"law 9"*, and the rest — and until now this list was unnumbered, so
    every one of those cross-references pointed at a paragraph rather than at a
    clause. A cross-reference to an unnumbered list is a cross-reference to
    nothing. The list, in
    `field.ts`'s own order: **1** every option is in the DOM at once · **2** the
    button is the pill is the hit target, and nothing overlaps · **3** a long
    press says, a short press writes · **4** a value tap never dismisses
    anything (§3) · **5** a chain keeps its order · **6** no silent grey, and a
    pill carries a word, never a sentence · **7** a whole-field refusal is the
    same law one tier up · **8** it is arrowable · **9** nothing scrolls
    sideways · **11** a vocabulary too tall for the phone is a table that
    scrolls sideways (which is component 22, and the reason there is no 10).
    Each is marked below where THIS section states it; 4 (§3's own), 7 and 8
    are stated in `field.ts` alone, which is where a reader of a citation
    should land. For any
    vocabulary past the chip limit (the 68 drum ops, 42 chord qualities, 63
    scales, 14+ transformations, the instruments): **(law 1)** EVERY option
    visible at once as a tight lozenge (`--r-pill`, hairline, `--t2` type, **(law 2)** AS TALL AS ITS
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
    select fields toggle any number and **(law 5)** keep an ordered chain where
    order matters (the transformations); a cluster folds by its heading, and **the
    field folds ITSELF TO FIT THE PHONE** (TABLE.md §15, 2026-09-06): three
    states, the first that fits winning — every cluster open (which is where
    this read *"but starts open"*, and is still what a vocabulary that fits
    gets), else the cluster holding the standing answer open and the rest
    headings with their counts, else every cluster folded with the standing one
    MARKED (`aria-current`, drawn in `--hand`) and printing the word it holds.
    **(law 1 again — it is the clause the fold answers to)** NOTHING GOES BEHIND
    A SCROLL BOX OR A "MORE": the only thing that ever hides
    an option is a fold, its count is on its heading, and every word is one tap
    from the glass. The height is PACKED before the first paint and MEASURED one
    frame after the mount, stepping down only, and never against a hand — the
    moment a thumb presses a heading the field stops guessing. **(law 5)** A chain of two or
    more prints its order (`.nu-lzn`, 1, 2, 3…); a chain of one does not, because
    a position nobody can act on is a number for nothing.
    **(law 3)** A long-press on a lozenge prints its sentence, and **(law 6)** so
    does a tap on a REFUSED one — a pill carries a word and never a sentence, at every width
    (Paul, 2026-09-05: *"you added sentences of text to some of them"*), so a
    refused lozenge is dashed and quiet with its word alone and the reason goes
    to the field's ONE say line; the whole field is
    scannable in one pass at 390 and **(law 9)** never scrolls sideways —
    **EXCEPT AS THE TRACK OF COMPONENT 22, WHICH IS THIS FIELD TURNED NINETY
    DEGREES** (2026-09-07). This read *"never scrolls sideways"* flat until
    §19 built `.nu-lztrack` inside this very field (`field.ts:590`;
    `nu.css:8829`), which makes the unqualified sentence false of the component
    that states it. The law it was always about is the PAGE's inline axis (§3),
    and the WRAPPED STACK this component draws by default still never scrolls
    at all; the track is law 1 stronger rather than weaker, because in it
    nothing is hidden — not even behind a fold.
    It replaces the
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
    collapse. **SEVEN SECTIONS UNDER AN EIGHTH SURFACE, AND THE EIGHTH IS THIS
    ROW'S OWN FACE** — the tempo · meter · key line above, whose address is
    `tcorner`, the song's own options at the end of it, and which is the eighth
    scope §18 gave the record. **This component owns that count**: component 3
    lists the seven special rows, and the hamburger's first block (component 13)
    says EIGHT because the face is one of them. Gated on the rendered page:
    `test/table.browser` T14b walks all eight addresses from the plate —
    `trules · ttime · tchords · tmotifs · tmix · tproduce · tfoot|perf ·
    tcorner` — and asserts one sheet at a time, each under its own row, the
    pane unmoved. (Seven, seven and eight stood in this one document for the
    same block until 2026-09-07, which is a count with three readers and no
    owner.) It wears the label row's box and not `.nu-sphead`'s class, for
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

20. **Top strip** (TABLE.md §16, 2026-09-06) — the page's SECOND and last fixed
    **CHROME** band, `--top-h` (`--tap` plus the notch, and no padding of its own): the
    RECORD'S NAME at the start, taking the row's give with `min-inline-size: 0`
    and an ellipsis, and the ONE hamburger at the end. **THE TOP IS WHERE YOU
    GO** — the name is the record's identity and a tap on it opens the picker
    (it is the same toggle component 12 described, moved), and the ≡ is every
    other place the box can be. It is an opaque band with a hairline under it,
    and <body> takes its height out of the page (`padding-block-start:
    var(--top-h)`), which is the whole of *"Dont let anything go under it"* said
    at the head as well as at the foot. **IT IS NOT `.nu-top`, WHICH STAYS
    DELETED**: that was a floating plate at one corner over a page that
    reserved nothing for it, holding a × for a sheet that has its own close.
    What it costs is written down rather than hidden — 44px, which is one
    section row of the grid at rest (TABLE.md §16 carries the arithmetic and
    the three buy-backs it refused). **THE WORD "CHROME" IS LOAD-BEARING AND
    WAS RESTORED HERE ON 2026-09-07**: this read *"the page's SECOND and last
    fixed band"*, which is true of the chrome and false of `position: fixed` by
    three — nu.css fixes the strip family (`.nu-strip-out`, `.nu-log`,
    `.nu-explain`, `.nu-say`: 932, 4674) and the menu plate (`#nu-menu`, 7583)
    as well as `.nu-topstrip` (7403) and `.nu-bar` (7747), so a two-second grep
    disproves the sentence as it stood. **A POP-UP AND THE PLATE ARE FIXED AND
    ARE NOT CHROME**: chrome stands in every state and the page reserves room
    for it (`body { padding-block-start: var(--top-h) }`); a pop-up stands only
    while one thing is open and the page reserves nothing. §13a.1's original
    said *"the only `position: fixed` CHROME"* and was precise; §3's copy had
    dropped the word.
21. **Tape** (TABLE.md §16, 2026-09-06, Paul: *"Make a play status tape
    position indicator that incorporates the beat countdown on the bottom
    right"*) — **the TOP STRIP's middle child** (`ui/eight.js:14502`,
    `stripEl.append(whereBtn, tapeNode(), menuBtn)`) and the only READOUT in the
    chrome. *(This read "the bar's last child" until 2026-09-07. It was born
    there on 2026-09-06 and moved to the strip the same round, under §3's own
    law — the strip is identity and STATUS, the bar is controls and only
    controls, and a readout is a status. `docs/NAV.md` recorded the move and
    this sentence did not; `ui/eight.js:14498` says it in the code —* "IT IS
    THE SAME COMPONENT, MOVED." *`docs/NAV.md` owns where the tape lives; this
    component owns what it says.)* No tap
    floor, no ground, no border, and its accessible name is the whole sentence.
    It says the three things a player needs and nothing a composer needs —
    **where the playhead is** (the fill), **how much record is left** (the
    track behind it), and **what beat is next** (`.nu-count`, the bare beat
    readout the bar wore beside the seed, the same node with the same one
    writer, enclosed rather than replaced). Two lines inside the bar's 44px:
    the words right-aligned and tabular over a 4px track filled in `--clock`,
    because side by side at 320 the track cannot show one bar of an 88-bar
    record moving. At rest it says how long the record is and draws nothing.
    **ONE PLAYHEAD READER** — it is painted from `markForm`, the call the
    section lamps already ride, and installs no subscription of its own — and
    **A DECLARED REPAINT BUDGET**: §13f's *"changing rapidly every beat it's
    too much"* is a law about WORDS, so the word repaints at most once a BAR
    and the fill at most once a beat, each memoised on what it draws (the
    string; the integer percent). Measured over eight bars: 9 and 9.
22. **Table field / table sheet** (TABLE.md §19, 2026-09-07, Paul: *"For the
    instrument selector make it a horizontal table wider than the screen with
    the instruments in tables one per line per column"*, and, of a chair's
    playing options, *"Give them the same treatment as the instrument voice
    selector … we need to make it smaller and it can also go horizontally
    wider than the screen"*) — **one shape, at two tiers**. A vocabulary too
    tall to wrap becomes a TRACK of columns: one column per cluster, ONE WORD
    PER LINE inside it, the columns running off the side of the screen where
    there is no bottom to fall off; a family longer than a column CONTINUES
    into the next column, under the same word drawn as a readout (no second
    address). A sheet of three subjects or more takes the same shape one tier
    up: one column per group, one setting per line, the column a thumb is
    working in widening to the sheet so a picker never opens inside a
    scrollport. **THE TRACK SCROLLS SIDEWAYS AND THE PAGE DOES NOT** —
    `overflow-x` on the track, `overscroll-behavior-inline: contain` on it, and
    the PAGE's own inline axis untouched (§11c). §3's horizontal-scroll law
    OWNS the sentence and the list of scrollports; this component is one of the
    four on it. (It read *"THE TRACK IS THE ONLY THING THAT SCROLLS SIDEWAYS"*
    until 2026-09-07: wrong by three — `.nu-pane`, `#atlasWrap` and the
    lozenge track were all `overflow-x: auto` when it was written — and the
    exclusive claim it meant to make belongs to the page, which is where it now
    lives.) It REPLACES the fold as the
    answer to height (component 16's law 1 is stronger here, not weaker:
    nothing is hidden at all, so the count on a heading counts what you can
    see), and the fold stays for the vocabularies that still fit as a stack.
    The standing word's column is marked in `--hand` and the track is scrolled
    to it ONCE, on the mount, never again — a scroll on a write would move the
    track under the thumb that is writing.
23. **Spinner** (TABLE.md §19, 2026-09-07, Paul: *"turn them into spinners for
    the status changes"*) — for a row that is a STATE of at most five
    positions, not a list you shop in: ONE control saying the word the row is
    in, a step each side, and the position printed (`2/5`) because a control
    showing one of five has to say there are five. A tap on the word steps
    FORWARD, `>` forward, `<` back — the second control and not a long press,
    because a long press already means SAY WHY everywhere on this page
    (component 14) and **ONE GESTURE MAY NOT MEAN TWO THINGS** — which is §3's
    law and has been stated there since 2026-09-07, because it is general and
    was buried in this paragraph, where the next round to want a long press for
    something would never have found it. It steps OVER a
    refused word and never into one; a refused spinner says its reason and does
    not move (component 14). **THE ADDRESS DOES NOT MOVE WHEN THE WIDGET
    DOES**: the field's own `data-k` is on the word, and the steps take
    `prev|<key>` / `next|<key>`, the shape `clear|<key>` and `num|<key>` take.
    WHICH ROWS ARE STATES is declared by `src/table/model.ts` and the SHAPE
    rule by `src/menus/pick.ts` — the same division component 16 is under.
24. **Exclusive rail · compound mark** (TABLE.md §19, 2026-09-07, Paul: *"Each
    exclusive of each other"* and *"if things have multiple settings to make
    that really clear and shading or a little bit of a fill behind them"*) —
    two marks that say what KIND of control a hand is holding, before it taps
    anything. **EXCLUSIVE**: a single-select strip is JOINED — no gap, one
    hairline between segments, rounded at the two ends only, the standing word
    filled — and a chain is separate pills each wearing its own tick box. The
    fact is the field's own `multi`, drawn as `data-exclusive` so a gate reads
    what a hand sees. **COMPOUND**: a row carrying more than one value — a
    chain of two words or more, or a seated widget that is itself several
    controls (the envelope's handles, the knob table, the crate's files) — is
    drawn on a filled ground with a `--hand` rail at its start and its COUNT
    printed at the end of its label. The count is MEASURED off the widget
    (`[data-k]`, which every control on this page wears) rather than declared
    beside it, so it cannot go stale; a count of one is not compound, because a
    badge saying "1" is a number nobody can act on.

## 2a · The elements that exist in code (2026-09-07)

§2 is the whole VOCABULARY, in prose. This section is the part of it that is a
TAG — seven custom elements under `nukernel/src/ui/`, built by
`node tools/ui/build.js` into the committed `nukernel/ui/ui.js` (a build
entry — the BUILDER counts them, off the tree at `tools/ui/build.js:78-79`,
and a number written in prose goes stale the next time a directory is added;
this read *"the fifth build entry"* until 2026-09-07, when `--check` said
`ui-build ok 6 entries`), drawn in every state on `nukernel/design.html`, and gated by
`test/design-system.js`. Everything else in §2 is still drawn by
`ui/eight.js`, `src/table`, `src/menus` and `src/lozenge`; step 4 of
docs/DESIGN-SYSTEM.md is what moves the call sites, one surface at a time.

| tag | §2 | what it is |
|---|---|---|
| `<nu-button>` | 1 | a word you press: one thing happens, and the word says which |
| `<nu-icon-button>` | 1 + 15 | a mark you press, with its word said out loud and drawn nowhere |
| `<nu-lamp>` | 11 | a thing that is doing something is LIT (§1's lamps row owns the colour law and this row does not restate it) |
| `<nu-legend>` | §0 | a printed label — small caps, dim, fixed, and it never lights |
| `<nu-value>` | §0 | a readout: what the machine currently says, in tabular numerals |
| `<nu-rail>` | 24 | one of a set drawn as one of a set: joined segments, one hairline between, the standing word filled |
| `<nu-spinner>` | 23 | a state of at most five positions: one control saying where you are, a step each side |

**THE DECLARATION IS THE CONTRACT.** `src/ui/api.ts` holds one row per element
— its attributes, their types and a one-line note each, the states it can wear,
its keyboard, where its accessible name comes from, and how it refuses. Three
readers consume that one table and none may keep a second copy: the element
itself, the gallery that draws it, and the gate that walks it. **A component
not in that table is not in the system**, and `src/ui/index.ts` throws at boot
if the tag table and the declaration disagree.

**THEY RENDER INTO THE LIGHT DOM, AND `nu.css` IS IN CHARGE.** Decided once and
written down in `src/ui/base.ts`: a shadow root is a wall the page's own
stylesheet cannot reach through, `::part` would be a second surface to keep in
step, the page measures itself and eleven gates walk its DOM (and every walk
stops at a shadow boundary), and it is what `src/table`, `src/menus` and
`src/lozenge` already do. What it costs is encapsulation, and the answer is the
prefix: an element's inner parts are `nu-el*`, so a selector can always say
whether it is inside a component or beside one. **No `css``` block anywhere in
`src/ui`** — nu.css's THE ELEMENTS block carries the whole look.

**THE ELEMENTS' SEVEN STATES, AND WHICH FIVE A HAND CAN ASSERT — the SECOND
of the three layers §2 names, and not a second declaration of §2's eight.**
These are attributes on a HOST; §2's are classes the GRID writes; the
`.is-on`/`.is-off`/`.is-quiet`/`<mark>` set is the page-wide vocabulary at
`PROGRAM.md` §2.4's FOUR STATES; all three are live and the code follows all three.
`[selected] [open] [refused] [busy]` are attributes on the host and rest is
their absence, so each is one selector in nu.css and one query in the gate. `hover` and `focus` are the
browser's own pseudo-classes and no markup can assert them, so nu.css pairs each
with `[data-demo]` **in the same rule** — the gallery forces the demo spelling,
and what it shows is drawn by the declaration that draws the live page.

**ONE SELECTION TREATMENT, ONE FOCUS TREATMENT, AND THEY ARE DIFFERENT**
(§1, Paul: *"Selected boxes are oddly selected"*). Selected = the control is
FILLED in `--lamp` with its word in `--on-fill`, and **nothing else on this page
fills IN `--lamp`**. (It read *"nothing else on this page fills"* until
2026-09-07, when component 24 declared two more fills two days after this
sentence was written — a compound row's ground and the exclusive rail's
standing segment — and both are `--hand`. The law was always about the LAMP:
selection is the one thing that LIGHTS, and a `--hand` ground says what KIND of
control you are holding, which is a different sentence.) Focus = a `--bw-hard` lamp RING outside the box, offset, so a control can
be focused and selected at once and read as both. Hover = the amber EDGE, a
border colour and never a fill. Open = a `--hand-tint` ground with a `--lamp`
hairline. Refused = dashed, quiet, `aria-disabled` and never `disabled`, and a
press prints the reason in that widget's one say line — which is §3's refusal
law DRAWN at the element layer, not a second statement of it. Busy = an amber hairline
along the foot, static, because a page that animates a wait animates it under
`prefers-reduced-motion` too.

**EVERY NAME COMES FROM THE CATALOGUE.** `key` is a key into
`src/copy/**` (the `ui.*` page); `label` is the escape hatch for a word that is
the RECORD's own — a genre, a section's name, a player's — and therefore in no
catalogue at all. A mark is never a name.

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
  **THE NAMED EXEMPTIONS ARE TWO, AND THE FIRST IS THE HAMBURGER** (TABLE.md
  §18, 2026-09-06): this law is about A FIELD'S OPTIONS, where a hand is choosing one VALUE out of many
  and folding by cluster is how it keeps its place. A NAVIGATION list of
  seventeen destinations, each its own subject, folds into two taps per
  destination instead of one — the exact cost §18 was called to remove — so the
  plate SCROLLS INSIDE ITSELF when a screen cannot hold it, and each group's
  heading sticks while its own rows are under the thumb. Measured 2026-09-06:
  785px of content in 786.8 of glass, no scroll at all. **Measured again
  2026-09-07 (TABLE.md §20): 891 in 785, so it DOES scroll by 106** — the plate holds
  eighteen destinations now (the gear's two joined it) and eighteen at the 44px
  floor is 792px before a heading is drawn. The exemption is what it always
  was; the arithmetic is what makes it necessary rather than convenient.
  **AND THE SECOND EXEMPTION IS THE STRIP FAMILY** (`.nu-strip-out`, `.nu-log`,
  `.nu-explain`, `.nu-say`): each scrolls inside itself under a DECLARED
  ceiling — `overflow-y: auto` with `max-block-size: min(70vh, 560px)`
  (nu.css:941, 4678) — and `PROGRAM.md` §2.4.1's `.nu-strip-out` row names it in the sentence that
  carries this law's own name: *"MENUS NEVER SCROLL INSIDE THEMSELVES is the
  law; a strip is the standing exception"*, owing three things at each strip —
  a block anchor, a width in the `min(<n>ch, calc(100vw - …))` shape, and that
  ceiling, argued where the strip is. **THIS BULLET IS THE OWNER OF "MENUS
  NEVER SCROLL INSIDE THEMSELVES", AND THE EXEMPTIONS ARE TWO.** (It read
  *"THE ONE NAMED EXEMPTION IS THE HAMBURGER"* until 2026-09-07: two documents
  each named a different SOLE exception — this one the plate, `PROGRAM.md` the
  strip — and the tree has both, so the count was wrong and neither exemption
  was. Eight other copies of the flat sentence stand in nu.css, `ui/wordgrid.js`,
  `src/menus/index.ts` and TABLE.md; they are readers, and this is the copy with
  the measurements.) What is NOT exempt is what the law is about: A FIELD'S
  OPTIONS. A vocabulary too tall folds by cluster (component 16) or turns
  ninety degrees into a track (component 22), and never goes behind a wheel, a
  scroll box or a "more".
  (This bullet closed *"Nothing else on this page may scroll inside itself"*
  until 2026-09-07 — an over-reach, and false when it was written: `.nu-pane`
  scrolls (nu.css:1444), the strip family scrolls (941, 4678), `#atlasWrap`
  scrolls (3325) and both tracks scroll (8500, 8829). Six rules broke a sentence
  whose own two sentences above say it is about a field's options. Deleted
  rather than qualified, because the qualification is the law itself.)
- **A REFUSAL IS SAID OUT LOUD, AND THE OWNER OF THIS LAW IS `PROGRAM.md` §5's
  `why` CLAUSE** (*"`why`, **required** whenever `disabled` or
  `quiet` is set: `sheets.js` THROWS without it, because a silent grey is the
  bug this design exists to prevent"*) — the oldest statement of it, the
  best-argued, the only one enforced at BUILD TIME rather than argued on the
  glass, and the one nobody cited. On the glass it reads: a refused control is
  `aria-disabled` and never `disabled`, a TAP on it prints the reason it
  already carries, one owner for the sentence, one place per widget, and no
  reason that only a screen reader can reach (TABLE.md §15). Components 7, 8, 9
  and 14 DRAW it and none of them restates it. (It stood in five wordings in
  this document alone until 2026-09-07 — components 7, 8, 9, 14 and here — and
  in eleven sites across the tree in ten wordings. A law with no owner is a
  wish, and this one was broken at its twelfth site while every copy of it
  read true.)
- **ONE THING IS OPEN AT A TIME, IN THE WHOLE APP, AND THE OWNER IS NAMED**
  (TABLE.md §18, 2026-09-06, Paul on four surfaces standing at once: *"It's easy
  to get into a state like that and hard to get out of it."*). This line read
  *"one selection; one open pop-up; one owner per fact"* and was true of
  nothing: each surface owned its own openness, so four could stand at once and
  no line of code was wrong. It is testable now, and the test is
  `test/oneopen.js`: `globalThis.NuOpen` is the ONE owner — every surface
  registers a closer under a name, says `opened` when it opens and `closed`
  when it shuts, and opening ANY surface closes whatever else was standing. For
  all ordered pairs of the surfaces, opening the second closes the first —
  twelve pairs of four until 2026-09-07 and **six of three since** (TABLE.md
  §20: the play fold is deleted with the gear that opened it, so the bar has no
  pop-up at all; the three are the hamburger, the log and a table sheet). A SHEET keeps
  §13a's law — it is in flow, not a pop-up — and the two directions are still
  closed: a pop-up opening shuts an open sheet and a sheet opening shuts an open
  pop-up. One selection; one owner per fact; and the owner is asked, never
  assumed (`window.__nuOpen()` must name what a DOM walk finds).
- **ALWAYS A WAY OUT, AND THERE ARE THREE OF THEM** (TABLE.md §18): every
  pop-up closes on a TAP OUTSIDE it, on ESCAPE, and on its own close — the
  opener pressed again, or a × where the opener is behind another door (the
  log's is a row of the hamburger, and opening the hamburger closes the log).
  Measured on the rendered page: 6 of 12 before this law, 12 of 12 after, and 9
  of 9 since the fold went. Two listeners on `document` do all of it, because
  four surfaces with four listeners are four different ideas of "outside".
  **AND "OUTSIDE" HAS TO EXIST** (TABLE.md §20, 2026-09-07): the hamburger's
  plate is capped at the bar's top edge so that a full-width band of glass is
  never the plate at any width. A surface that fills the screen has quietly
  taken one of the three ways out away — measured, the gate that tapped "the
  strip's own air" was tapping the plate. A VIEW is not a pop-up and
  does not join this law — it has no outside inside the pane, and the way out
  of one is the door you came in by — but Escape with nothing open does what a
  view's own × does and takes you back to the table. A field keeps its own
  Escape.
- A change lands at the next bar while playing (evolve); undo/redo at the document level, every op.
- Blank = default (inherited); bold = written; delete = back to default.
- Nothing dismisses under a finger that is changing a value.
- **ONE GESTURE MAY NOT MEAN TWO THINGS** (promoted to a law here 2026-09-07;
  it was stated once, inside component 23's paragraph about the spinner, where
  it read as an argument about that one widget). A LONG PRESS MEANS SAY WHY,
  everywhere on this page (component 14) — so a spinner steps with a second
  control and not with a hold, a lozenge's long press prints its sentence and
  writes nothing, and an envelope handle's does the same at 600 ms and 8px. A
  gesture that means two things is a gesture a hand has to guess at, and the
  page has one hand.
- **THE PAGE'S OWN INLINE AXIS NEVER SCROLLS, AND THE SCROLLPORTS THAT DO ARE
  NAMED HERE** (§11c). Gated on the rendered page: `test/bench.test.js` B12
  measures `document.documentElement.scrollWidth - window.innerWidth` at 390
  and asserts a widened kit does not move it (bench.test.js:903, 918, 1069 take
  the same measurement at three more points). Four elements scroll sideways and
  this is the whole list: **`.nu-pane`**, the table's scrollport (nu.css:1444)
  · **`#atlasWrap`** (3325) · **the sheet track** (8500) · **`.nu-lztrack`**,
  the lozenge field turned ninety degrees (8829). Component 22 and TABLE.md
  §19b are READERS of this line, not second owners of it. (It read *"Nothing
  scrolls sideways at the page level; the pane is the scrollport"* until
  2026-09-07: true of the page, and three scrollports short — and its
  exemptions were written in two other documents, so a round reading only this
  line would not learn that the tracks exist and would take one out.)
- **AND THE FIX FOR A SIDEWAYS SCROLL IS AT THE ELEMENT, NEVER AT THE BODY:
  NEVER WRITE `overflow-x: hidden` ON `body` OR `#app`.** The law is
  `PROGRAM.md` §5's three failure modes's and is gated there — `test/shell.js` A0 asserts body
  and `#app` keep `overflow-x: visible` on every view; nu.css:79 states it as
  the first of that file's three named failure modes. A `position: sticky`
  element inside an `overflow` ancestor stops sticking, silently, so that one
  declaration kills every sticky head on this page while every gate that
  measures a scroll still passes. It is written HERE, beside the law it
  protects, because this is the line a round would "fix" it under (2026-09-07;
  it appeared nowhere in this section before).
- **THE TOP STRIP IS IDENTITY, STATUS AND NAVIGATION; THE BOTTOM BAR IS
  CONTROLS, AND ONLY CONTROLS** (TABLE.md §18, 2026-09-06, Paul: *"You could
  put the playback bar to the right of the genre on top top if you want"*).
  This sharpens the law below rather than replacing it: *"the bottom is what
  you hear"* was written about CONTROLS, and the tape is the one thing in the
  bar a thumb never presses. So the READOUT goes up — the record's name, the
  tape, the ≡ — and the controls the bar was too narrow for come down: the
  room, which is set in the bar itself and needs nothing opened, and the die.
  (This bullet closed *"The bar keeps exactly ONE pop-up, for the two facts a
  312px line cannot hold (the mode and the take)"* until 2026-09-07. **The bar
  has NO POP-UP AT ALL**: component 12 says so, the one-open bullet above says
  so, and `ui/eight.js:16523` is the `#playops` tombstone. The mode and the
  take are rows of the hamburger's HOW IT PLAYS block. The sentence stood
  eleven lines from its own contradiction, in this section.)
- **THE TOP IS WHERE YOU GO, THE BOTTOM IS WHAT YOU HEAR** (TABLE.md §16, 2026-09-06): every navigation and every arrangement control is behind ONE hamburger at the top right; every transport control is in the bar at the foot; nothing else is chrome. The box has exactly two modalities — a VIEW (chosen from that list) and a SHEET (a row of the table opened in place) — where it had five.
- One scroll, one pin (TABLE.md §13): **nothing is fixed but the bottom bar and the top strip — two fixed CHROME bands, and only these two.** The OWNER of that sentence is TABLE.md §16's *"§13a.1 IS AMENDED TO TWO, IN WRITING"* (TABLE.md:4123), which carries the amendment's four-row comparison table and the 44.0 measured; this line is its reader and not a second copy. The word CHROME is load-bearing: pop-ups and the menu plate are `position: fixed` and are NOT chrome — component 20 has the grep and the reason. (This line has carried the 2026-09-06 amendment since it was made; four other copies of the sentence did not, so it is now a pointer rather than a fifth wording.) Inside the pane one band sticks at a time — the grid's heads while the grid is under the thumb, or the owner row of the open sheet as its header, and never anything in a `<tfoot>`. Special rows are one line at rest. Adders are one cell, not columns, and a tap on one ADDS rather than asking (§13e). A cell says a WORD at every width — the column is sized to one and the pane scrolls sideways with the section column frozen, rather than the cells falling back to a grid of identical marks (§14). Opening or closing a sheet leaves the pane's `scrollTop` identical. **NOTHING RUBBER-BANDS** (TABLE.md §15a, 2026-09-06, Paul: *"I can drag it too far right and then the whole thing moves including the fixed parts… it all feels reel wobbly"*): every scroller a thumb drags SIDEWAYS is `overscroll-behavior: none` and not `contain` — `contain` stops the gesture CHAINING to the scroller behind and still lets the scroller bounce inside itself, and a bounce translates its `position: sticky` children with it. The document too, which also turns pull-to-refresh off so a flick cannot reload the box mid-edit. **OPEN, AND ASSIGNED** (2026-09-07): the two newest sideways scrollers are `overscroll-behavior-inline: contain` — the sheet track (nu.css:8501) and `.nu-lztrack` (nu.css:8830) — which is the value this law names as the wrong one, by name, with its reason. Whether the tracks are exempt from the bounce reasoning or the tracks are wrong is the LIVE design-system round's question and is not settled in this document; the law stands as written until that round answers it.
- **A HEADING WHOSE BLOCK CAN NAME ITSELF IS NOT DRAWN** (TABLE.md §15a): no label row over a column that prints its own name, no word beside a face that already says what the row is. The accessible name carries what a control DOES; the glass carries the record's own words.

## 4 · Copy (the voice) — ON THE GLASS

**THIS SECTION IS ABOUT THE GLASS, AND THE DOCUMENTS ARE NOT THE GLASS**
(said out loud 2026-09-07; it was always the scope and nothing wrote it down).
Every rule below governs a word a hand can read on the page — `src/copy/**`,
the one catalogue — and none of them governs this file, which quotes Paul,
carries a date in most sentences, and argues in paragraphs, all of which the
law below forbids. A reader who applies it here concludes either that the
prose is illegal or, worse, that the voice law is dead because the document
that states it breaks it on every line. On the glass:

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
