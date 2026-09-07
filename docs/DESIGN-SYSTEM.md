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

**The port is: one Lit element per component, ONE CSS BLOCK for all of them
(per the shipped decision), and every call site in the app using them — and
the call sites are STEP 4, UNSTARTED.** DESIGN.md stops describing components
and starts pointing at them.

*(This sentence read* **"one Lit element per component, one CSS file per
component, and every call site in the app using them"** *until 2026-09-07, and
it was wrong on two of its three halves the day the first elements shipped.
One CSS FILE PER COMPONENT was never built and was decided against: all element
CSS is one appended block in `nukernel/nu.css` — `THE ELEMENTS` — because that
is what keeps `nu.css` in charge of the look, which is §1a's whole
requirement. `nukernel/DESIGN.md` §2a states that decision as law and this
file's own STEP 1 AND STEP 3 note below records it as what shipped, so the
sentence above was the only place in the repo still asking for the other
thing. EVERY CALL SITE IN THE APP is not done and is not claimed: `grep -c`
for the seven `<nu-*>` tags across `nukernel/ui/eight.js`, `nukernel/src/table/**`
and `nukernel/index.html` returns 0, and `index.html` does not load
`ui/ui.js`. The elements are declared, gated on their own gallery, and not yet
wired to the app — §5 step 4 is the round that wires them.)*

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

## 1a · A SKIN IS A STYLESHEET (APPROVED 2026-09-07)

Paul: *"I really want us to be able to skin the app via css rather than
customizing objects."*

This is the acceptance test for every element in the system, and it outranks
convenience. Someone must be able to change the entire look — colour, weight,
density, radius, the lot — by replacing `tokens.css` and adding rules that
target the elements. No `.ts` edited. No attribute passed. No build run.

So an element carries STRUCTURE and STATE and never appearance:

- no `style=` written by a component, ever;
- no class computed to mean a colour or a size;
- no `css\`\`` block — the palette lives in CSS or it is not skinnable. **The
  OWNER of this one clause is `nukernel/DESIGN.md` §2a** (*"No `css``` block
  anywhere in `src/ui`"*, beside the light-DOM decision that gives it its
  reason); this is the fourth statement of it in the tree, so read it as a
  pointer and argue it there;
- no reading a token in JavaScript in order to draw with it (the one exception
  is a canvas instrument like the globe, which cannot be styled by a rule; it
  reads its tokens off `getComputedStyle` at paint and says so);
- a state is an attribute on the host — `[selected]`, `[open]`, `[refused]`,
  `[busy]` — and the stylesheet decides what that looks like.

**AND IT IS PROVEN BY A SECOND SKIN, NOT BY INTENTION — AND THAT PROOF IS NOT
BUILT YET (measured 2026-09-07).** The system is to ship an alternate skin in
one file that turns the deck into something visibly other — a light paper
panel, a different accent, a different density — loaded with no other change
to the app. If writing that file requires touching an element, the element is
wrong. The gate loads it and checks that nothing from the default palette
survives.

**Say it plainly: no such file and no such check exists today.** `ls
nukernel/*.css` is band, drums, fonts, hw, nu, tokens — there is no alternate
skin — and `grep -n skin test/design-system.js` returns nothing across the
gate's 464 lines. The five sub-rules above ARE measured and green (D2, D4a,
D4b, D4c, D12), but they are the five things a skinnable element must not do;
this is the one thing that would show a skin actually works. **Until it is
written the SKIN law is unproven as a whole**, and it is the outstanding
acceptance test of this document — not a decoration on the end of a law that
is otherwise finished. It is the right shape for a law precisely because it
names the test that can fail it, and a named test nobody has run is still a
debt.

The `[data-theme]` daylight block step 1 shipped is the weak form of this: a
second look inside the same file. The strong form is a separate stylesheet
that overrides nothing but tokens and element rules, and that is what "skin"
means here.

## 2 · THE ELEMENTS

Every component in DESIGN.md §2 becomes a `<nu-*>` custom element, defined
once, with its own states written down (the CSS is one block, not one file
each — see the amendment at the head of this document). **THIRTY ARE NAMED
BELOW AND SEVEN ARE BUILT** (`nukernel/src/ui/api.ts` declares `nu-button`,
`nu-icon-button`, `nu-lamp`, `nu-legend`, `nu-value`, `nu-rail`, `nu-spinner`;
this file's own shipped note calls them *"the first SEVEN"*). Read the count
off `api.ts`'s `SPEC`, which is where it is a fact rather than a paragraph.
The list is taken from the app as it stands rather than invented: button, icon
button, spinner,
segmented rail, lozenge, lozenge field, slider, number field, text field,
select, toggle, sheet row, sheet group, table cell, column head, row head,
label row, plate, menu row, tape, lamp, badge, say line, curve editor, XY pad,
level meter, fader, strip, disclosure, close.

**CAREFULLY DEFINED** means: a documented attribute surface, states for
rest / hover / focus / selected / open / refused / busy, keyboard behaviour,
an accessible name that comes from the copy catalogue, and a refusal that is
reachable by a thumb (§15's law). The refusal law's OWNER is
`nukernel/PROGRAM.md` §2.3's `why` clause — required whenever `disabled` or
`quiet` is set, with `sheets.js` throwing at build time without it, because a
silent grey is the bug this design exists to prevent — and this document does
not restate it.

**WHAT THIS DOCUMENT ADDS IS THE MEASUREMENT, AND IT IS NOT A DUPLICATE.**
`test/design-system.js` D3b/D3c/D3e assert, on the rendered gallery, that not
one refused example carries the native `disabled`, that every one prints its
reason on a tap in a say line a thumb can see, and that the reason is **≤ 12
words** (9 in the longest). A length gate is the one thing a build-time throw
cannot check: `why` being present is the owner's job, `why` being SHORT ENOUGH
TO READ is this one's.

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
off it. **THE RAMP IS PROVEN ON `nukernel/design.html`, WHICH IS NOT THE APP.**
`test/design-system.js` D5 drives the GALLERY and finds every one of 1,576
rendered spacing values on the ramp, 0 off; the app's own census, three
sections below in this file, finds **410 of 426** rendered declarations off it
at 320. Both numbers are true and they are about two different pages.

**So the ramp is a BUDGET the app overspends, and step 5 owns closing it** —
not a law the app is already keeping. The gallery proves the ramp is
expressible; the census prices what it costs to reach. Any claim that the app
is on the ramp must name `index.html` and a gate that walks it, and no such
gate exists today. The round MEASURES the waste before it changes anything:
every gap, padding and margin the app actually renders, counted, with the
outliers named.
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
ALL PASS, `oneopen` 11, `gutter` 52 (**the gate is named for a surface that no
longer exists — the gutter `#nu-tray` was deleted 2026-08-28 and
`test/shell.js` A6j asserts the absence of the whole apparatus. `test/gutter.js`
keeps the name on purpose, and says so in its own header: every check in it is
about the same SUBJECT — where a thumb finds the transport — and renaming the
file would lose eleven rounds of argument to a `git log --follow` nobody
runs**), `seed` 36, `atlas` 134 of 135 (G9 the
known standing red), `table.browser` 793, `copy` 10, `ui-build --check` green
over six entries, `tsc --noEmit` clean. Every browser gate was run TWICE — once
on the palette flip, and again on the finished tree — because the element and
gallery blocks were appended to nu.css after the first pass.

**HISTORY, AND IT CLOSED (written 2026-09-07 in flight; resolved 2026-09-07).**
`test/table.test.js` reported **36 of 40** while this round was landing, and
the four were NOT this round's: T2a, T2b, T2c and T4j compare every compiled
document, genre and event to the pin at `ac13270`, and `nukernel/compose.js`,
`nukernel/kernel.js` and `nukernel/precompose.js` were modified in the working
tree by the engine-audit round running beside this one (772 of 1500 documents
moved, on rows this round never opened). `node test/closure.js
test/table.test.js` named 41 files and not one of them was a file this round
touched — no `tokens.css`, no `nu.css`, no `design.html`, no `src/ui`. The pin
was that round's to re-take, **and it re-took it: `table.test` is 40/40
today.** The paragraph is kept because the ARGUMENT is the reusable part — a
red gate is read by asking whose closure the red file is in, not by whose diff
is on the screen — and the number is dated so nobody quotes it as a standing
state.
