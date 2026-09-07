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
