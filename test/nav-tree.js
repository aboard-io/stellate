/* ===== THE NAV TREE — RETIRED 2026-09-09, WITH ITS NINE CLAIMS ==========
 *
 * TABLE.md §10b step 7: THE TRAY IS DELETED. Paul, 2026-09-05: *"…then have a
 * hamburger menu for score, video, screensaver, and have genre, dice, playstop
 * along the bottom — a real mobile app now with everything in the table and the
 * nav space reclaimed."*
 *
 * WHY THIS FILE EXISTED AND WHY IT DOES NOT. Its own opening paragraph said it
 * plainly: *"shell sweeps the whole page at five widths and asks the stripe one
 * question per tab; what a TREE can newly get wrong is a shape you have to
 * BUILD — two branches open at once, a child four rows below its parent, a mark
 * that stayed on an ancestor, a lamp that never goes out. Every one of those
 * needs a page driven into a state on purpose."* There is no tree. There are no
 * branches, no depths, no path and no `↑`. Seven of the nine claims below have
 * no subject left at all, and a gate that keeps asking a question about a
 * deleted object is the thing this repo calls a check that always skips: it is
 * not being made.
 *
 * THE TWO THAT WERE NEVER ABOUT THE TREE MOVED, AND THEY MOVED TO THE SURFACE
 * THAT REPLACED THEM. That is the only honest home for a claim about a lamp.
 *
 * WHERE EVERY CLAIM WENT:
 *   N1  no ↑ anywhere, at any depth, on any tab — it is ABSENT, not disabled.
 *       SURVIVES, AND IS STRONGER: test/shell.js A6j asserts the absence of the
 *       whole apparatus at four widths — no `[data-k="trayup"]`, no `#nu-tray`
 *       / `.nu-tray` / `.nu-traylist` / `.nu-trayfoot` / `.nu-traycut`, and
 *       nothing wearing `[data-depth]`. A deletion that left one of the five
 *       behind would be a second navigation standing beside the first.
 *   N2  ONE PATH: opening Band folds Score — one `aria-expanded="true"`
 *       ancestor, only its children on the stripe, exactly ONE <mark>.
 *       RETIRED. It is a claim about a forest of branches. What it protected —
 *       you are never shown two navigations at once — is shell A6j's count of
 *       exactly ONE `.nu-pan[data-sheet]` on the page, which is the same
 *       sentence about the surface that replaced it.
 *   N3  a set of ACTIONS marks nothing — the fourteen motif transforms carry no
 *       `aria-pressed` at all (fourteen `aria-pressed="false"` buttons would
 *       tell a screen reader there is a state to be in).
 *       RETIRED WITH ITS OWN TOMBSTONE ALREADY WRITTEN. It had already lost its
 *       subject on 2026-09-08, when the transforms became a line at the foot of
 *       the opened motif's sheet; `test/table.browser.js` T10v counts the
 *       fourteen at their own addresses on that surface, and a `<button>` in a
 *       sheet has never carried `aria-pressed` on this page.
 *   N4  every mark in the gutter is a thumb (44px) and the stripe is ONE column
 *       that never scrolls sideways, at 320 / 375 / 430 / 1280.
 *       SURVIVES, TURNED NINETY DEGREES: shell A2 is the 44px floor page-wide
 *       and shell A6b is "the bar is ONE ROW and never scrolls sideways",
 *       counted as distinct button TOPS the way this counted distinct lefts.
 *   N5  the foot reads where · seed · ? · log · opts · play, and #play is the
 *       LAST child of the foot in every state the tree can be in.
 *       SURVIVES IN test/gutter.js, whose subject has always been the
 *       transport: #play is the last control in `#nu-bar`, on the screen in
 *       every state (the table, and each of the five sheets).
 *   N6  a band member LIGHTS UP while it sounds and goes dark when the record
 *       stops — a class on the button, never a <mark>, and it is the playhead's
 *       red and not the meter's green.
 *       MOVED, WHOLE, to `test/table.browser.js` T10x. It is the one claim here
 *       that was never about the tree, and TABLE.md §10a is where it belongs
 *       now: *"the sounding players' column heads light"*. What changed in the
 *       spelling is forced and is written at the check: the gutter was outside
 *       `#app`, where the clock may write a class; a table head is not, and
 *       `__eightFrozen` keeps a live element's ATTRIBUTES, so the lamp is an
 *       `<i>` inside a `[data-live]` sibling and never a class or an
 *       `aria-current`. Every other half is unchanged — it lights, it is not a
 *       <mark>, it is `--clock` red and not `--meter` green, and it goes out.
 *   N7  the list is the ONE thing that shrinks: with Band expanded the stripe
 *       overflows, `.nu-traylist` clips it, and the last row stands clear of
 *       the foot.
 *       RETIRED. There is no list, no foot and no clip. The bar is one row of
 *       fixed height and shell A6i asserts that nothing on the page is under
 *       it, measured at the END of the scroll, which is where a foot bar's
 *       version of that claim is decidable.
 *   N8  A LEVEL LOOKS LIKE ONE: the depths wear an ink and a ground apiece,
 *       each clearing 4.5:1, and the indent is depth × a step of ≥ 0.7ch.
 *       RETIRED WITH THE DEPTHS. AND SO IS ITS OUTSTANDING RED, which is worth
 *       recording because it was a real defect and it is not being swept up:
 *       *"N8 390 · the indent is not what clipped anything"* — at 390 the
 *       gutter's word box was 67px against a 7px `--nu-indent`, and that one
 *       step of indent clipped four SECTION labels (`groove 2`, `chorus 6`,
 *       `chorus 9`, `outro 13`) and `notation` on the Score branch. It was
 *       filed on 2026-09-08 as *"a decision about the 96px gutter's word box
 *       against the tap floor … deliberately not made in a round that deletes
 *       the tray two steps later"*. The tray is deleted; there is no 96px word
 *       box, no indent and no clipped label, so the decision is not deferred
 *       again — it is answered by the deletion.
 *   N9  the MOTIF that is sounding lights up while the record plays and goes
 *       dark on stop — a join and not a floodlight.
 *       ALREADY LIVED ON THE TABLE: it read `#pan-band .nu-banklamp > i` from
 *       2026-09-08, and `test/table.browser.js` T10u makes the same claim from
 *       the row's own side (the lamp is a `[data-live]` sibling with no control
 *       in it, and while the record plays it names a motif of this record's own
 *       bank). One reading, in the file that owns the surface.
 *
 * THE FILE IS KEPT AS THIS TOMBSTONE AND NOT DELETED, because nine claims and
 * the reasons they were made are the expensive half of a gate and the next
 * person to build a navigation on this page should meet them before they build
 * it. It is unregistered in test/all.js.
 */
"use strict";
console.log("nav-tree · RETIRED 2026-09-09 with the gutter (TABLE.md §10b step 7).");
console.log("  N1 → shell A6j · N4 → shell A2/A6b · N5 → gutter · N6 → table.browser T10x");
console.log("  N9 → table.browser T10u · N2/N3/N7/N8 retired with their subject.");
console.log("PASS — nothing to assert; see the header for where each claim went.");
process.exit(0);
