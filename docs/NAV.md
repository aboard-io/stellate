# TWO PLACES, NOT SEVEN (APPROVED 2026-09-06)

Paul, verbatim:

> "We have too many UX modalities I think. Let's make all the panels into their
> own views and move the view selector into a hamburger on the top right.
> Consolidate that with the existing bottom right hamburger (which goes away).
> Make a play status tape position indicator that incorporates the beat
> countdown on the bottom right. Put the name of the app at the top of the
> hamburger. Move the seed out of the bottom nav and into a 'set seed' in the
> hamburger. Organize the hamburger sensibly. You may need to put 'session' at
> the top as a nav item and that's the new name for the default view. So now
> bottom row is pure play controls and top right is compose arrange controls."

## The law

**THE TOP IS WHERE YOU GO. THE BOTTOM IS WHAT YOU HEAR.** Every navigation and
every arrangement control lives in one hamburger at the top right. Every
transport control lives in the bar at the bottom. Nothing else is chrome.

A modality is a place the box behaves differently. Today it has a tab strip, a
bottom-sheet menu, a floating panel per deck, a picker that takes the screen,
and a bottom bar that mixes transport with composition. That is five ways of
being somewhere, and a hand has to learn all five. After this round there are
two: **a view** (you are looking at one, chosen from the hamburger) and **a
sheet** (a row of the table opened in place, §13's law, unchanged).

## The views

Every panel becomes a view, and the view list is the hamburger's first block.

| view | what it is | note |
|---|---|---|
| **Session** | the table — the record you are composing | the default, renamed from Band |
| **Where** | the genre picker and its globe | |
| **Score** | the engraved record | |
| **Video** | the record watched | |
| **Screensaver** | the record left alone | |
| **Export** | the record taken away | |

`Session` is first and is where the box opens. The word replaces `Band`
everywhere a hand can read it; the addresses (`toptab-Band`, the tab's host id)
are the gates' business and move only where a gate is re-filed with it.

## The hamburger, top right

    ┌──────────────────────────┐
    │  STELLATE                │   the app's name, first
    ├──────────────────────────┤
    │  Session                 │   ← the views, current one marked
    │  Where                   │
    │  Score                   │
    │  Video                   │
    │  Screensaver             │
    │  Export                  │
    ├──────────────────────────┤
    │  Set seed…               │   ← the record's own dice, out of the bar
    │  Song options            │   (fill from genre · re-seed · transpose)
    ├──────────────────────────┤
    │  Log  6                  │   ← the count the ≡ used to wear
    └──────────────────────────┘

Three blocks, in the order a hand needs them: **where you are**, **what you are
making**, **what the box has done**. The bottom-right hamburger goes; there is
one, and it is here.

## The bottom bar, pure transport

    ┌──────────────────────────────────────────────────────────┐
    │  ▶ / ■        ◉ sung        ▓▓▓▓▓░░░░░░  3 · bar 12/88   │
    └──────────────────────────────────────────────────────────┘

Play, the sung toggle, and at the right the **tape**: a position indicator
across the record with the beat countdown inside it. It says three things a
player needs and nothing a composer needs — where the playhead is, how much
record is left, and what beat is next. It replaces the bare beat readout.

**The genre button leaves the bar and becomes the record's name at the top
left**, opposite the hamburger — the record's identity, and a tap on it opens
the Where view. That is a decision this document takes rather than one Paul
made: "pure play controls" removes it from the bottom, and the identity of what
you are hearing belongs beside the navigation that changes it, not beside the
play button.

## What must not change

The one-sheet law and §13's "nothing is fixed but the bottom bar" (the top
strip joins it as the second fixed thing, and only these two). Every address in
`test/table-inventory.json` still resolves, re-filed where a control moved. No
control loses its written refusal. Nothing here writes to the document except
`Set seed`, which spends exactly what the die spent.

---

## The outcome (2026-09-06, shipped uncommitted)

Built. The measurements, the deviations and the arithmetic are
`nukernel/TABLE.md` **§16 · Two places, not seven**; the two new components
(the top strip, the tape) and the two amended ones (the bar, the hamburger) are
`nukernel/DESIGN.md` §2.20/21 and §2.12/13.

**WHAT LANDED.** The view selector is one hamburger at the top right, holding
all six views with `Session` first, then `Set seed` (the seed row moved out of
the bar as a NODE), then the log with its count. The bottom-right hamburger is
gone; there is one. The record's name is the top left and opens Where. The bar
is the transport and the tape. The word `Band` is `Session` everywhere a hand
reads it; `toptab-Band`, `#pan-band` and `__eightTab("Band")` are unmoved,
because an address is not a name.

**THE THREE THINGS THIS DOCUMENT DID NOT DECIDE, decided.**

1. **`Song options` stays at the end of the record's line**, against the
   drawing above — because this document also says *"nothing here writes to the
   document except Set seed"* and all three of its ops rewrite the record;
   because its sheet is drawn as the record row's own next line and the grid's
   `<tbody>` is `hidden` when folded, so a menu row would open a sheet nobody
   could see; and because `re-seed` in the menu would be a second door to the
   die `Set seed` has just been given one owner of.
2. **`#playops` and its three children stay in the bar** — a mode, a take and
   the room are facts about the next press of ▶, which is what the bottom is
   for.
3. **The tape is two lines, not one** — measured: at 320 it has 185px, and a
   track sharing that with the words cannot show a bar of an 88-bar record
   moving.

**THE COST, PAID AND DECLARED.** A second fixed band is 44px of an 844px phone
and the grid had 5.7px of slack, so **the sheet shows nine whole sections at
rest where it showed ten**, at every width and on both beds. The three ways to
buy it back were measured and all three are refused inside this round (a
sub-44px strip breaks DESIGN §1; an overlaying strip breaks *"Dont let anything
go under it"*; folding the record row's face into the strip cuts the record's
NAME to a stub at 320 and deletes component 18). TABLE.md §16 carries the
arithmetic. If the row matters more than the strip, the trade to put to Paul is
the third one, as its own round.
