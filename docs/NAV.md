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
