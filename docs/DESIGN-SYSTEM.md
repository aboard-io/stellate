# THE DESIGN SYSTEM (APPROVED 2026-09-07)

Paul, verbatim:

> "We ported to lit and typescript. Create a design system with all the elements
> we use. Port everything to that design system to create more accessible,
> simpler UX where we reuse elements over and over again. Styles should be in
> CSS and elements should be lit web components that are carefully defined. When
> done I should be able to see the design system. Apply the design system
> everywhere."
>
> "Selected boxes are oddly selected. The colors are y combinator colors. In
> general this should look like a mixing board/LED with musical aesthetics and
> green phosphor/vector vibes. Light retro circa 1998."
>
> "It's incredibly important we squeeze things as much as possible. There's
> weird spacing everywhere. Tighten things up."

## What exists today, and why this is a port and not a rewrite

`nukernel/DESIGN.md` is already the contract: tokens in `:root`, twenty-four
named components, interaction laws, a copy voice. What it is NOT is CODE.
The components are described in prose and implemented in three different
places — Lit templates under `nukernel/src/**`, hand-written DOM in
`nukernel/ui/eight.js` (nearly a megabyte of it), and CSS classes in
`nukernel/nu.css` (600 KB) that any of them may reach for. So "a button" is a
paragraph in DESIGN.md, a `mkBtn` in eight.js, an `icon()` beside it, a
`.nu-trimbtn` in the stylesheet and a `html\`<button>\`` in a Lit file.

**The port is: one Lit element per component, one CSS file per component, and
every call site in the app using them.** DESIGN.md stops describing components
and starts pointing at them.

## 0 · THE NORTH STAR: THE STELLATE, 1988

Paul: *"One way to think of yourself is as a legendary arranger keyboard from
1988 called the Stellate."*

Take it literally, because an arranger keyboard already answers questions this
box is still arguing about, and its answers are better than ours:

| the machine | what it means here |
|---|---|
| a STYLE button plays a whole band instantly | a genre row is a record that arrives playing — already true, and it is the product |
| VARIATION A/B/C/D, FILL, INTRO, ENDING | our sections and their roles. The machine has FOUR variations and two fills, and that is a fact about how much a hand can hold |
| a change lands at the NEXT BAR, never mid-bar | DESIGN §3's evolve law, which we already keep |
| a DATA wheel — one control, whatever is selected | our die is one; the wheel is the shape the rest of the numbers want |
| a two-line backlit LCD: what you are on, what it is | the top strip's identity and status, which v298 built without knowing it |
| PART buttons with a lamp each | the player columns and their sounding lamps |
| a TEMPO lamp blinking the beat, red | the tape, which v298 put in the strip |
| ONE TOUCH presets | our motifs, and the starting-point genres |
| legends printed on the panel in small caps, values on the screen | the label/value split the sheets already use |

**SO THE SYSTEM IS A PANEL AND A SCREEN, AND THEY LOOK DIFFERENT.** Legends
are printed: small caps, dim, fixed, never lit. Values live on the screen:
phosphor, bright, and the only things that change. A control that is doing
something has a LAMP; a lamp is small, round or bar-shaped, and it is the one
place saturated colour is allowed. That single rule settles the selection
problem Paul named — a selected thing is LIT, and nothing else in the system
lights.

**WHAT WE TAKE AND WHAT WE REFUSE.** Take: the panel/screen split, the lamp,
the legend, the data wheel, the instant style, the next-bar change, the
density (these machines put forty controls on a panel a foot wide and none of
them is confusing, because the legends are tiny and the grouping is absolute).
Refuse: skeuomorphic plastic, drop shadows pretending to be moulded edges,
brushed-metal gradients, and any wood. This is the machine's LOGIC in a
browser, not a photograph of one.

**THE DATE IS 1988 TO 1998 AND THE SPREAD IS THE POINT**: 1988 is the panel —
membrane buttons, printed legends, a backlit LCD in green or amber, a red
tempo LED. 1998 is the screen — more pixels, a vector look, a console's
metering. The box is the later machine wearing the earlier machine's panel.

## 1 · THE LOOK

**A MIXING BOARD, LIT.** Not a skeuomorphic desk and not a terminal emulator:
the feeling of a console in a small studio in 1998 — a dark deck, legends in
small caps, values in green phosphor, a fader that reads as a fader, a lamp
that reads as a lamp. Vector, not raster: hairlines, not bevels.

**THE PALETTE IS NAMED AND ARGUED IN `tokens.css`.** The current one is an
off-white paper with a warm orange accent, which is where the "y combinator"
reading comes from, and it goes. The new ground is a dark deck; the ink is a
warm off-white; the accent is phosphor green; a second accent is the amber a
console uses for "armed"; red is reserved for clipping and destruction and is
never decorative. Every colour is a token, every token is argued in one line,
and no component names a colour.

**LEGIBILITY IS THE LIMIT, NOT THE THEME.** Every pairing meets 4.5:1 for text
and 3:1 for a control's edge, measured, not assumed — the round reports the
matrix. Phosphor green on black is easy to make unreadable; where it fails, the
value wins and the theme bends.

**SELECTION IS THE THING PAUL NAMED FIRST.** "Selected boxes are oddly
selected": today a selected cell takes a ring, a hot lozenge takes a fill and a
bold word, an open row takes a tint, and a current view takes a different tint
again — four ideas for one state. There is ONE selection treatment in the
system, and one focus treatment, and they are different from each other and
from hover. A lit element is lit the way a channel is lit: the legend brightens
and the lamp comes on.

## 2 · THE ELEMENTS

Every component in DESIGN.md §2 becomes a `<nu-*>` custom element, defined
once, with its own CSS file and its own states written down. The list is taken
from the app as it stands rather than invented: button, icon button, spinner,
segmented rail, lozenge, lozenge field, slider, number field, text field,
select, toggle, sheet row, sheet group, table cell, column head, row head,
label row, plate, menu row, tape, lamp, badge, say line, curve editor, XY pad,
level meter, fader, strip, disclosure, close.

**CAREFULLY DEFINED** means: a documented attribute surface, states for
rest / hover / focus / selected / open / refused / busy, keyboard behaviour,
an accessible name that comes from the copy catalogue, and a refusal that is
reachable by a thumb (§15's law). A component that cannot say why it is
disabled is not finished.

**STYLES STAY IN CSS.** No `css\`\`` blocks inside components carrying the
palette; components carry structure, the stylesheet carries the look. Elements
render into the light DOM or use `::part`, whichever keeps `nu.css` in charge —
decide once, write down which and why.

## 3 · THE GALLERY

`/design` — a page in the app that renders every component in every state,
with its tokens, its attribute surface and a live example. It is built FROM the
component definitions, not written beside them, so it cannot drift. It is the
answer to "when done I should be able to see the design system", and it is also
the fastest gate we have: a screenshot of that page is the whole system.

## 4 · TIGHTEN

"Squeeze things as much as possible. There's weird spacing everywhere." The
spacing scale is a geometric ramp of five steps and nothing may use a value
off it. The round MEASURES the waste before it changes anything: every gap,
padding and margin the app actually renders, counted, with the outliers named.
Then it tightens — and the number that proves it is how much MORE of the record
is on the glass at 390×844 afterwards, on the same three records.

The 44px tap floor is not spacing and does not move.

## 5 · THE ORDER

1. Tokens and the palette, with the contrast matrix.
2. The elements, one at a time, each with its CSS and its states.
3. The gallery, built from the definitions.
4. The port: every call site, surface by surface, with the old class deleted as
   its last user goes. A component nobody uses is deleted, not kept.
5. The squeeze, measured before and after.

Every step lands gated and on staging. The existing gates are the safety net —
`test/table.browser.js` (793), `shell`, `oneopen`, `sheets`, `selects`,
`copy`, `table.test` — and a component round that turns one of them red has
broken something a person can see.

---

# STEP 1 AND STEP 3, SHIPPED (2026-09-07)

The tokens, and the gallery that shows them. Steps 2 (the elements, one at a
time) is landed for the first SEVEN; step 4 (the port) and step 5 (the squeeze)
are not begun, on purpose — §5's order is a list of rounds and a diff that did
the tokens AND rewired nine thousand lines of call sites would be the second of
them breaking a page a person is using.

## What was built

| file | what it is |
|---|---|
| `nukernel/tokens.css` | **every design token on this page, and nothing else** — 168 declarations, each argued on its own line. Linked between `fonts.css` and `nu.css` |
| `nukernel/nu.css` | keeps its rules; declares **no** `:root` custom property and types **no** literal colour. Grew two blocks: THE ELEMENTS and THE GALLERY |
| `nukernel/src/ui/**` | seven Lit elements, their declaration (`api.ts`), the light-DOM decision (`base.ts`), and the gallery builder (`gallery.ts`). The **fifth build entry**; `node tools/ui/build.js` writes `nukernel/ui/ui.js`, and `--check` is green |
| `nukernel/design.html` | the gallery — its own page, linking the same three sheets, loading `ui/copy.js` and `ui/ui.js`. `nukernel/index.html` does not load `ui/ui.js` and did not otherwise change |
| `nukernel/src/copy/ui.ts` | the `ui.*` catalogue page: what an element says, and the gallery's own headings |
| `test/design-system.js` | the new gate, registered in `test/all.js` as `design-system` (wave 3) |

## The palette: three lamps and one screen

The y-combinator paper is gone. The ground is a dark deck at three depths, the
ink is a warm off-white printed legend in three voices, and there are exactly
three saturated colours plus the screen's own phosphor:

    --lamp   #35D97B   ON: selected, focused, a value a hand set
    --armed  #F2A93B   armed: under the pointer, next, about to matter
    --clip   #FF5A47   the tempo LED, clipping, destruction. Never decoration
    --value  #6EE7A4   not a lamp: the ink the SCREEN prints a readout in

The app's four semantic paints land on those four exactly — `--hand` is the
lamp, `--clock` is the red one, `--meter` is the screen, `--flag` is the amber
— so the mapping is one line each rather than four new hexes, and every one of
nu.css's 9,600 lines goes on reading the token it always read.

**Selection is settled.** A selected control is FILLED in `--lamp` and nothing
else on this page fills; focus is a lamp RING outside the box; hover is the
amber edge and never a fill; open is a tint with a lamp hairline. Four ideas
for one state became one, and they are different from each other.

**The deck is committed and there is no `prefers-color-scheme` query.** A
machine looks the same in every room. `:root[data-theme="light"]` is a real
second design — the same panel under studio lights, the phosphor read as dark
green on grey the way an LCD is read in daylight — reached by a hand.

## The contrast matrix

Measured, in the browser, on the resolved values, and printed on the gallery
itself; the gate recomputes it and asserts the page's number equals the
measured one. Floors: 4.5:1 text, 3:1 a control's edge.

**Deck** (grounds `--deck` #16191A · `--panel` #20262A · `--well` #0C0F10)

| as text | deck | panel | well |
|---|---|---|---|
| `--legend` | 13.54 | 11.72 | 14.74 |
| `--legend-dim` | 5.98 | 5.18 | 6.51 |
| `--legend-faint` | 5.50 | 4.76 | 5.98 |
| `--value` | 11.47 | 9.93 | 12.49 |
| `--lamp` | 9.56 | 8.28 | 10.41 |
| `--armed` | 8.85 | 7.66 | 9.63 |
| `--clip` | 5.73 | 4.96 | 6.24 |
| `--v0 --v1 --v2 --v3 --vb --drum` | 5.69–8.52 | 4.93–7.38 | 6.20–9.28 |
| **as an edge** | | | |
| `--rule` | 3.49 | 3.02 | 3.80 |
| `--rule-strong` | 5.98 | 5.18 | 6.51 |

**Daylight** (grounds #D9D6CA · #E9E6DB · #C9CDC2): every ink 4.71–13.77,
every edge 3.13–8.10. Nothing under a floor in either theme.

**What was bent, and it is one thing.** `--legend-faint` means REFUSED, and on
a panel "quieter" means darker — which on a dark deck is a contrast floor
failed. So the refused register is a **hue** difference and not a value
difference: a cooler grey at nearly the same brightness as `--legend-dim`
(5.50 against 5.98 on the deck). It is legible because the refusal is carried
by the dashed edge and by the sentence, not by dimness — which is DESIGN.md
component 14's own design, said in a colour. The daylight theme plays the same
trick for the same reason.

Two values moved to clear a floor rather than to look better: `--rule` went
from a near-invisible #47504E to #6C7066 (2.13 → 3.49 on the deck), and the
grey ramp was renumbered so that `--grey3` is explicitly *the one grey that is
never an edge* and `--grey4` is the hairline that has to be seen.

## The spacing census — measured before anything moved

Walked on the rendered page (Kingston 1969, reading 1), every box with a
non-zero rect, every padding/margin/gap plus flex and grid gaps.

| width | boxes | distinct values | declarations | off the ramp |
|---|---|---|---|---|
| 320 | 824 | 21 | 426 | 17 values / **410** declarations |
| 390 | 824 | 21 | 426 | 17 values / **404** declarations |
| 1280 | 829 | 21 | 622 | 17 values / **600** declarations |

The ramp resolves against `<body>` at 3.2 · 5.6 · 8.8 · 12.8 · 22.4px.

**The finding, and it is one sentence: the ramp is in `em`, so five steps
render as twenty-one pixel values.** A step resolves against the font-size of
the box it lands in, and this page has a dozen font-sizes. The outliers are not
rogue literals — every one of them is a token:

| px | count | who | what it actually is |
|---|---|---|---|
| 2.3 | 196 | `.nu-cellword` | `--s1` at `--t1` (0.2 × 11.52px) |
| 2.0 | 58 | `.nu-colhead`, `.nu-srowh` | `--s1` in a 10px head |
| 1.0 | 28 | `.nu-colbtn`, `.nu-plusbtn` | `--s1` in a 5px context |
| 2.6 / 4.6 | 26 each | `.nu-rowjump` | `--s1` / `--s2` at 13px |
| 2.8 / 4.9 | 15 / 14 | `.nu-colbtn` | `--s1` / `--s2` at 14px |
| 7.7 | 10 | `#burger`, `#voicing` | `--s1` at `--t5` |
| 44 / 56 | 1 each | `<body>` | the two fixed bands — not rhythm |
| 130.6 | 1 | `.nu-vs-wide` | the fader's own length — not rhythm |

**Nothing was changed.** Moving the ramp to `rem` makes every one of those
196 cells WIDER, which is the opposite of what step 5 was called to do. The
census is the evidence step 5 spends, and the choice it has to make is named:
either the ramp goes to `rem` and the type sizes come down with it, or the
`em` behaviour is declared correct and the ramp is redefined as *a proportion
of the box's own type*. It is a squeeze decision, not a token decision.

## The gallery, `/design`

`nukernel/design.html`, and **its own page rather than a nineteenth row of the
hamburger**: v303 measured that plate at 891px of content in 785 of glass with
eighteen rows, and a gallery is not a VIEW of a record — it shows no song,
writes no document and belongs to whoever is building the box. It costs the app
nothing: `index.html` does not load `ui/ui.js`.

It draws, from the definitions and from the resolved stylesheet: the whole
palette as swatches with their rgb; the contrast matrix, measured live, with
anything under a floor marked in `--clip`; the six type steps, four weights,
four radii and five spacing steps as specimens; fourteen geometry tokens; and
then every element — its one-line what, where it comes from in DESIGN.md, its
states side by side, its full attribute table, and its keyboard / name /
refusal laws. A `Daylight` toggle switches themes and the matrix re-measures.

## Gates

`test/design-system.js` — **48 ok, 0 failed** — asserts, on the rendered page
at 320, 390 and 1280: the gallery draws with no console error and all seven
declared elements are defined; every declared state is on the glass (31 cells);
every refused example is `aria-disabled` and never `disabled`, prints its
reason on a tap in a say line a thumb can see, in ≤ 12 words; no element source
and no built bundle names a colour, nu.css declares nothing at `:root` and
re-declares none of tokens.css's 105 names, and every token is argued in the
file; all 1,576 rendered spacing values are on the five-step ramp resolved in
their own box's type; all 54 contrast pairings clear their floor in both themes
and the number the page prints equals the number measured; nothing scrolls
sideways, every control clears 44px, and the three sheets are in cascade order.

The existing suite did not move: `shell` PASS 459 ok, `sheets` 31, `selects`
ALL PASS, `oneopen` 11, `gutter` 52, `seed` 36, `atlas` 134 of 135 (G9 the
known standing red), `table.browser` 793, `copy` 10, `ui-build --check` green
over six entries, `tsc --noEmit` clean. Every browser gate was run TWICE — once
on the palette flip, and again on the finished tree — because the element and
gallery blocks were appended to nu.css after the first pass.

`test/table.test.js` reports **36 of 40**, and the four are NOT this round's:
T2a, T2b, T2c and T4j compare every compiled document, genre and event to the
pin at `ac13270`, and `nukernel/compose.js`, `nukernel/kernel.js` and
`nukernel/precompose.js` are modified in the working tree by the engine-audit
round running beside this one (772 of 1500 documents moved, on rows this round
never opened). `node test/closure.js test/table.test.js` names 41 files and not
one of them is a file this round touched — no `tokens.css`, no `nu.css`, no
`design.html`, no `src/ui`. The pin is that round's to re-take.
