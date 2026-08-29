// nukernel/ui/atlas.js — TWO CONTROLS: A GLOBE YOU TURN, AND A SLIDER FOR WHEN.
//
// Paul said four things on 2026-08-24 and together they are this file:
//   1. "I need the ability to zoom in and out on the map. Why don't you make
//      the map 3d and zoomable like google earth but keep it black and white."
//   2. "Get rid of all ux for navigating except for the 'when' slider which
//      should go across the whole screen and the 3d globe. get rid of the era
//      select boxes, the look at select box, the 'nearby' select box, the genre
//      list, etc."
//   3. "'now' is a lie, it's the 2010s. Add the 2020s as now."   (atlas.js §3)
//   4. "Don't make 'Details' collapsible."                        (index.html)
//
// SO WHAT IS LEFT IS TWO CONTROLS. A when-slider across the whole width, and a
// globe. #atlasCtl, #atlasEra, #atlasView, #atlasList, #atlasPlace and
// #atlasHome are DELETED, not hidden. The three consequences of taking them
// away are answered here rather than dodged, and each is written down where it
// is solved:
//
//   A · THE KEYBOARD PATH. The deleted listbox was the accessible door. The
//       GLOBE'S OWN MARKS are that door now — real focusable DOM elements with
//       real names, one code path instead of a visible one and a hidden twin
//       (test/atlas.js G11). Kingston is seven Tabs from the slider at 1969.
//   B · NO REGION PRESETS. Zoom and rotation are the only way to move in space,
//       so both had to get good: 180° of arc down to 0.5° on every input, and
//       an exact screen-to-sphere inverse so the land stays under the finger.
//   C · NO "NEARBY" PANEL. A tap must resolve to exactly ONE record. The rule
//       is NEAREST YEAR, TIE TO THE EARLIER, it lives in atlas.js's recordAt(),
//       and it was measured twice independently. Paint order does the rest: at
//       a pile of marks the one on top is the one the slider points at.
//
// AND THE FIFTH THING PAUL SAID, on 2026-08-24 after looking at the deployed
// page: "Don't show ghost genres when the time isn't right. Just show genres
// that align with time." THE GLOBE NOW DRAWS ONLY WHAT IS THERE AT THE YEAR ON
// THE SLIDER. Measured at 600 before the change: 65 marks, with names like
// "Antwerp 1551, pavane (nothing near 600)" and "Atlanta 2003, trap (nothing
// near 600)" — a world full of records that do not exist yet, each politely
// announcing that it does not exist yet. After: ONE mark, Rome, and the
// sentence above it says "1 place on the globe".
//
// WHAT "ALIGNS WITH TIME" MEANS IS THE +-10 WINDOW, NOT THE EXACT YEAR, and the
// argument is in atlas.js at WINDOW: exact-year-only puts ONE place on the
// earth at 37 of the 69 stops, and at Paul's own year the two rules draw the
// same single dot. So the window costs nothing against the complaint.
//
// THE ONE FACT, FOUR PLACES. atlas.js `atYear(Y).shown` is now the only answer
// to "what is here": the dots read it, the tab order reads it, the labels read
// it, and the sentence counts it. Three of those four already used the window
// — only the dots disagreed, which is exactly why the page could show a mark
// that its own sentence did not count. test/atlas.js G22 holds the two to each
// other on the RENDERED page at three years.
//
// THIS VIEW STILL COMPOSES NOTHING. It picks a genre key, hands it to
// precompose.js's genreToDocument(gk, seed), and hands the whole record to
// ctx.setDocument — PROGRAM.md §2.2's own verb, which stops the transport,
// re-adopts the song and redraws. Every option comes from nukernel/atlas.js,
// which is a committed table; nothing here generates, parses or guesses. And it
// owns NO TRIGONOMETRY: ui/globe.js is the only file that knows what a sphere
// is, and atlas.js is the only file that knows where a place is on one.
import { NuAtlas, NuPrecompose, TERMS } from "./deps.js";
import { makeGlobe, ARC_MIN, ARC_MAX } from "./globe.js";

/* WINDOW LEFT THIS LIST when the marks stopped deciding for themselves what
   aligns with the year: this file used to compute `Math.abs(r.year - Y) <=
   WINDOW` per mark per frame, and atYear().shown now answers that once, in the
   data tier, for the dots and the tab order and the labels and the sentence
   together. An unused import is a trap, so it goes rather than sitting here
   looking like the rule still lives on this side. */
const { PLACES, WITHIN, WHEN, EXCLUDE, YEARS, UNITS, ALL,
        recordAt, arcFor, atYear, indexOf, eraOf, yearWord, canon } = NuAtlas;

/* THE 760 IS GONE, AND SO IS THE SCALE IT BECAME. — the second reversal of the
   same rule, and both belong in it, because reversing a decision silently is
   how the next person makes it again.

   FIRST IT WAS A WIDTH: "the <svg> is 1200 units wide in every view and nu.css
   floors it at 760 CSS px, so one map unit is 0.633 px on a phone whichever
   rectangle you are looking through." That floor made the map readable and it
   also put 13 to 29 of the 62 places past the right edge of a 390 px phone with
   no way to reach them — measured, `touch-action: pan-y` moved that box 0 px on
   a real horizontal touch drag.

   THEN IT WAS A SCALE: `z = max(1, 760 / renderedWidth)` multiplied every dot,
   label, stroke and tap box, which was "never draw anything smaller than the
   old floor drew it".

   NOW IT IS NEITHER, because the globe has `arc`. A plate carrée had to choose
   between fitting the column and being legible; a globe is always exactly its
   own box and you get closer by zooming, which is the control Paul asked for.
   Everything a thumb or an eye has to resolve is stated below in CSS PIXELS and
   converted through the renderer's own `u` (viewBox units per CSS px), so the
   numbers are in the unit a thumb is measured in and there is no scale factor
   to keep honest. `#atlasWrap{ overflow-x: auto }` stays in nu.css as the net
   it always was, and it never fires: measured `scrollWidth - clientWidth === 0`
   at 320 / 375 / 390 / 430 / 760 / 1280. */

/* A TAP IS UNDER 10 px AND UNDER 700 ms — CARRIED OVER VERBATIM, because the
   measurement behind it is still true and re-deriving it would cost the same
   bug twice. Measured 2026-08-24 at 390x844 with a real CDP touch stream: a
   plain vertical scroll swipe that happened to BEGIN on the Kingston dot with
   the slider at 1969 ran the whole autopick — #title went "Rome 600" ->
   "Kingston 1969", and the page jumped from y=192 to y=3441. pointerdown fires
   at touch-start, before the browser has decided the gesture is a scroll, so
   the pick has to wait for pointerUP. */
const TAP_MOVE = 10, TAP_MS = 700;

/* THE 8 px AXIS LOCK, AND WHY `touch-action: pan-y` IS NOT ENOUGH ON ITS OWN.
   pan-y gives a vertical swipe to the page (G13) and that is right. But it does
   NOT stop the browser handing us the pointermoves as well — measured, an
   unlocked build scrolled 345 px AND spun the globe 39° on the same gesture. So
   the first 8 px of a touch decide whose the gesture is: sideways-dominant and
   both axes go live; downward-first and that pointer is dead to us for its whole
   life. A mouse or a pen has no page scroll to lose and starts committed.
   That is what gives one-finger LATITUDE back — the alternative was to forbid
   it forever, which is safe by construction and worse to use. */
const LOCK_PX = 8;

/* AND THE LOCK IS AN ANGLE, NOT `dx > dy` — the reversal, with the sweep that
   forced it, because the rule it replaces was defensible and the next person
   should be able to see exactly what moved.

   IT WAS `dx > dy ? "both" : "page"`, a 45-degree line, and it meant a straight
   60-degree drag — an ordinary "move this up and to the left" — turned the earth
   0.0 degrees and scrolled the page 125 px instead. To tilt the earth you had to
   lead sideways and then curve, which nobody knows to do.

   THE SWEEP. 390x844, real CDP touch, straight 140 px drags with NO sideways
   lead, angle measured FROM HORIZONTAL (0 = sideways, 90 = vertical), read off
   the globe's own data-lon/data-lat and window.scrollY, each drag undone by its
   mirror so phi0 never sits on the +-85 clamp:

     angle    before (45-degree line)        after (LOCK_DEG = 25)
      0 deg   globe 81.5 lon, scroll 0       globe 81.5 lon / 5.2 lat, scroll 0
     30 deg   globe 85.5 lon, scroll 0       globe 70.2 / 41.5, scroll 0
     45 deg   NOTHING AT ALL, scroll 0       globe 57.1 / 59.6, scroll 0
     60 deg   globe 0.0,      scroll 125     globe 39.6 / 72.6, scroll 0
     65 deg   globe 0.0,      scroll 132     globe 33.2 / 75.7, scroll 0
     70 deg   globe 0.0,      scroll 141     PAGE, scroll 141, globe 0.0
     80 deg   globe 0.0,      scroll 146     PAGE, scroll 152, globe 0.0
     90 deg   globe 0.0,      scroll 148     PAGE, scroll 150, globe 0.0

   NO ANGLE GETS BOTH, before or after, which matters more than where the line
   sits: the gesture still has exactly one owner. And 45 degrees used to fall
   through the floor — the page would not scroll and the globe would not turn.

   WHY 25 AND NOT SOMETHING ELSE, both directions measured on the same sweep:
     LOCK_DEG = 30 hands the 60-degree drag back to the page (scroll 128, globe
       0.0). That is the defect itself, so 30 is out.
     LOCK_DEG = 15 gives the globe everything down to 15 degrees off vertical —
       a 75-degree drag turns the earth 20 degrees and the page does not move.
       That is the trade going the wrong way: a page that will not scroll under a
       thumb is a worse bug than a globe that will not turn.
     LOCK_DEG = 25 keeps the whole cone a thumb scrolls in — a one-handed swipe
       pivots at the base of the thumb and arrives off vertical, and 25 degrees
       is that much slop — while giving Paul's 60-degree drag to the globe with
       5 degrees to spare. */
const LOCK_DEG = 25;
const PAGE_TAN = Math.tan((90 - LOCK_DEG) * Math.PI / 180);

/* INERTIA IS A BUDGET, NOT A DECAY, and that is a measurement rather than a
   taste. A plain 0.86-per-frame decay sent a 160 px flick 204°: you let go over
   the Atlantic and land in the Pacific. Two bugs found by measuring — the glide
   was applied ON TOP of the drag every frame (191°), and it had no ceiling. With
   the glide suspended while a pointer is down and given a TOTAL TRAVEL budget of
   25°: 160 px -> 82°, 300 px -> 132°. Predictable, and it never loses your place. */
const GLIDE_DEG = 25;

/* TAP TARGETS IN CSS PIXELS, AND THEY GROW AS YOU ZOOM IN. G12 asks for >= 28 at
   the whole earth and >= 44 at 20° of arc or tighter, and the asymmetry is
   deliberate: a 44 px circle at world zoom would mean overlapping targets all
   over Europe. 15 -> 23 px of radius is a 30 -> 46 px box. (Overlap does not
   actually break the pointer path, because the hit test picks the NEAREST mark
   in screen space rather than trusting e.target — but it does make the picture
   a lie about what you can hit.) */
const HIT_MIN = 15, HIT_MAX = 23;
/* THE LABEL ANTI-COLLISION BOX, in CSS px, carried over from the plate carrée
   (46 x 14 map units at z = 1). Without the pass the world view piles
   Philadelphia, Harlem and Greenwich Village on top of each other.

   THE Y GREW FROM 14 TO 26 ON 2026-08-28, and it is the whole of this round's
   answer to "where do the genre names go when the map is crowded". Paul: *"Put
   the names of the genres under the locations on the map."* A label is TWO
   LINES now — the place on top, the genre under it (GENRE_PX below) — so the
   block an eye has to separate from its neighbour is 26 px tall, not 14, and
   the box that reserves it has to say so or the second lines interleave with
   the first lines of the marks below them.

   AND THAT IS THE ANSWER TO "HIDE LABELS BELOW SOME ARC", STATED IN THE UNIT
   THAT ACTUALLY DECIDES IT. The obvious alternative was a degree threshold —
   "no genre line above 60 degrees of arc" — and it is the wrong shape of rule
   twice. Crowding is a fact about how many CSS PX APART TWO DOTS LANDED, and
   that depends on the YEAR as much as on the zoom: 600 draws one place on the
   whole earth and has room for a paragraph, 1969 draws 45 and has room for
   nine. And a second visibility rule standing beside the greedy pass would be
   a second owner of "is this name drawn" — the one thing labels() exists to
   be. The taller box IS the arc rule, applied automatically at every zoom and
   every year, and it thins exactly where an eye would have failed anyway.

   MEASURED on the rendered page, 1969, names inked out of the near-side marks,
   one-line box (46 x 14) -> two-line box (46 x 26):
       390 x 900    180 deg 13 -> 9 · 60 deg 20 -> 18 · 20 deg 27 -> 27 · 2 deg 33 -> 32
      1280 x 900    180 deg 23 -> 21 · 60 deg 26 -> 24 · 20 deg 34 -> 33 · 2 deg 38 -> 37
   The phone's world view gives up four names to fit a second line under the
   nine it keeps; from 20 degrees in — the zoom at which you are reading one
   region — it gives up nothing at all. That is the trade a reader wants: the
   names thin where they would have overlapped, and arrive in full where there
   is room. */
const LOD_X = 46, LOD_Y = 26;
/* HOW CLOSE "ARRIVING" IS, IN DEGREES OF ARC (2026-08-29). Paul: *"When I tap
   a place start playing and zoom in the map on that place."* 20 is not a new
   number: it is the one LOD_X/LOD_Y's note above already calls "the zoom at
   which you are reading one city", and it is the exact arc at which paint()'s
   tap box reaches HIT_MAX. A tap flies to the TIGHTER of this and
   `arcFor(place)` — see `choose()` for why a region's own rectangle is not
   enough on its own. */
const ARRIVE = 20;
/* THE TYPE AND ITS HALO, IN CSS PIXELS. Both are converted through the
   renderer's units-per-pixel at write time, because everything an eye is
   measured in has to be — the tap box above is the same rule, and it is not a
   formality here: the map is 366 CSS px wide inside a 390 px phone and 1256
   inside a 1280 px window, so `u` is 2.732 and 0.796 viewBox units per CSS px,
   and a halo declared as a constant in the stylesheet would be 0.95 px of ink
   on the phone against 3.27 on the desktop. Written through `u` it measures
   2.60 px on both, read back off the rendered <text> (7.10 units / 2.07 units).

   2.6 IS THE WIDTH, AND IT WAS PICKED BY LOOKING AT ONE WORD OVER ONE COAST —
   "Kinshasa" at 1969, which lies across the Atlantic shoreline of Africa,
   cropped at 4x off the rendered page at 390x844:
     0    the coastline runs straight through the "h" and the "a"
     1.5  it clears the stems and still touches the "h" ascender
     2.6  every glyph is cut out of the line on its own, and the coast is still
          legible in the gaps BETWEEN the letters — the map goes on reading
     4    the shoulders merge into one white slab from the "K" to the last "a"
          and erase the coastline behind the whole word. That is a label PLATE:
          a different design, and it hides the thing the label points at. */
const LABEL_PX = 13, HALO_PX = 2.6;
/* AND THE GENRE'S OWN LINE, 2026-08-28. Paul: *"Put the names of the genres
   under the locations on the map."* 11.5 px against the place's 13, and the
   hierarchy is not decoration: the place name is the MARK'S OWN NAME and does
   not change while you look at it; the genre under it is what the WHEN SLIDER
   is currently answering for that place, and the smaller line is the one that
   moves. Same halo, same paint-order, same `opacity` gate — see `.gname` in
   ui/atlas.js's mark builder and `#atlasMap text.name` in nu.css.

   ONE DECISION FOR BOTH LINES, which is the trap this could have been. Two
   <text> nodes with two visibility rules is two answers to "is this place
   named", and a genre name floating with no place name over it is the
   "declared but never arriving" bug in typography. The greedy pass writes ONE
   opacity per mark and both lines take it. */
const GENRE_PX = 11.5;
/* AND ITS HALO IS PROPORTIONAL TO ITS TYPE, not a copy of the place line's.
   HALO_PX was picked by looking at a 13 px word over a coastline; the same 2.6
   px of stroke under an 11.5 px face is 23% of the em against 20%, and it eats
   into the glyph — measured on the rendered 1280 world view, "reggae" under
   "Kingston" read a shade lighter than the line above it for that reason and
   not because anything asked it to. Scaled by the same ratio as the face, it
   is the same halo, one size down. */
const GENRE_HALO_PX = +(HALO_PX * GENRE_PX / LABEL_PX).toFixed(2);
/* WHERE THE SECOND LINE SITS UNDER THE FIRST, in CSS px of baseline-to-
   baseline. 13 px of leading on an 11.5 px face — the place's descenders clear
   the genre's ascenders and the pair still reads as ONE block rather than as
   two labels that happen to be near each other. */
const GENRE_DY = 13;

const el = (t, a) => Object.assign(document.createElement(t), a || {});
const NS = "http://www.w3.org/2000/svg";
const S = (t, a) => { const n = document.createElementNS(NS, t);
  for (const k in a) n.setAttribute(k, a[k]); return n; };

export function mount(parent, ctx) {
  if (!parent) return undefined;

  /* NOT `parent.textContent = ""`. THAT LINE IS WHAT PRINTED THE BROWSER'S OWN
     WORD "Details" ALL MORNING — it deleted the <summary> index.html shipped,
     and a <details> with no <summary> renders its own default label. Nothing
     was styling it wrong; the view was eating its own heading. index.html is a
     <section> now (Paul: "Don't make 'Details' collapsible.") and mount() never
     destroys markup it did not create. */
  for (const n of [...parent.children]) if (n.id !== "atlasHead") n.remove();

  /* ---------- state: two angles, a zoom, a year and a seed -------------- */
  let yi = 0;                 // an index into YEARS, never a year
  let here = null;            // the gk the page is playing, or null
  let seed = 1;               // the atlas's own; the bar's "rewrite" bumps it
  /* ONE OWNER FOR "WHICH READING OF THIS ANCHOR IS ON THE PAGE", and it is
     this `seed` — still here on 2026-08-27, when the BUTTON left. The
     control moved to the .nu-bar (Paul: "I'd like a button next to play that
     seeds a completely different version of the song"); the counter did not,
     because #atlasSay is the readout that prints it ("· reading 2") and a
     second store in ui/eight.js would be a second answer to the same
     question. `reseed()` at the foot of this file is the door the bar
     presses. */
  let onScreen = true, dirty = false, raf = 0;
  let dragging = false, glide = null, fly = null;

  /* AND WHEN ANY OF THOSE FIVE MOVE, THE PAGE IS TOLD ONCE — 2026-08-27, Paul:
     *"I'd like to be able to link to a place/time/seed."* This file does not
     know what a URL is and is not going to learn: it owns the state, so it
     owns the announcement that the state moved, and ui/eight.js owns the
     address bar (one writer, `history.replaceState`, debounced). `ctx.moved`
     is optional on purpose — the atlas mounts in gates and in the daw with a
     ctx that has never heard of a fragment, and a missing hook is a page that
     simply does not have an address to keep. */
  const moved = () => { try { if (ctx && ctx.moved) ctx.moved(); } catch (e) {} };

  /* ---------- the DOM, in reading order --------------------------------
     h2 (shipped by index.html) · the sentence · THE SLIDER · the globe · the
     one button. Built once and never rebuilt: a control destroyed and recreated
     under a screen reader's cursor is a control that loses its place.
     (This line read "the globe · THE SLIDER" while the code below appended them
     the other way round — a leftover from the plan that put the slider under the
     globe, reversed for the measurement written out at `when` below. The order
     here is the order the DOM is built in, verified: h2, #atlasSay, #atlasWhen,
     #atlasWrap.)
     AND THERE IS NO BUTTON AT THE END OF IT ANY MORE (2026-08-27). The list
     used to close with #atlasActs, the <p class="nu-row"> that held "another
     take"; the gesture is the .nu-bar's "rewrite" now and the row went with
     it rather than being left as an empty paragraph. */
  const say = el("p", { id: "atlasSay", className: "nu-hint" });
  say.setAttribute("aria-live", "polite");

  const wrap = el("div", { id: "atlasWrap" });
  const svg = S("svg", { id: "atlasMap", class: "nu-map",
    preserveAspectRatio: "xMidYMid meet",
    /* role="application" IS THE ONE CHOICE IN HERE THAT MOST WANTS A HUMAN TO
       LISTEN TO IT (see §4.11 of the round's decision). The <svg> is a surface
       you drag and zoom with its own keys, which is what the role means; the
       alternative is role="group", which reads truthfully and loses the arrow
       keys to the screen reader's own cursor. Every MARK inside it is a plain
       role="button" with a real name, so nothing about reaching a record
       depends on this line being right. */
    role: "application",
    /* AND IT IS A TAB STOP. MEASURED: without tabindex, `svg.focus()` did
       nothing, the keydown went to <body>, and the `+`/`-` handler on the <svg>
       never saw it — which meant the ONLY zoom a keyboard user has did not work
       at all. An element with role="application" and its own arrow keys has to
       be reachable by Tab; the globe comes first in the tab order and the marks
       follow it. */
    tabindex: "0",
    "aria-label": "A globe of the records. Drag to turn, pinch or scroll to "
      + "zoom, plus and minus to zoom by keyboard. Tab moves between the places "
      + "that have a record near the year on the when slider." });
  wrap.append(svg);

  const globe = makeGlobe(svg);
  /* tabindex="-1" ON THE TWO LAYER GROUPS, AND IT IS NOT DECORATION. MEASURED:
     an <svg> with tabindex="0" makes Chromium hand a Tab to its first <g>
     container as well as to the buttons inside it, so the walk from the slider
     read atlasMap, atlasMarks, Austin… — one stop on a group that is not a
     control and has no name. An explicit -1 takes an element out of sequential
     focus while leaving it programmatically focusable, which is exactly the
     distinction wanted here. */
  const gMarks = S("g", { id: "atlasMarks", tabindex: "-1" });
  const gNames = S("g", { id: "atlasNames", "aria-hidden": "true", tabindex: "-1" });
  /* the names layer is aria-hidden so a place is spoken ONCE, from its button,
     and the marks sit ABOVE the labels so a label can never eat a tap.

     AND THE LAYER SURVIVED THE 2026-08-25 FIX, which is worth saying because
     the obvious repair was to delete it. Paul: "The labels on the map don't
     move with the map. You could hide them but it would be better if you moved
     them as I moved the globe." The cheapest way to make a name ride its dot is
     to make the <text> a CHILD of the mark's own <g>, which already gets a
     fresh `transform` every frame — free, no second write. It is also wrong
     here, and measurably: `.place` is what the outside world measures a mark
     BY. test/atlas.js:241 computes the tap point as the centre of
     `g.getBoundingClientRect()`, and an SVG group's box is the union of its
     children. MEASURED on the rendered page at 390x844, 1969, over the seven
     marks whose names are inked: folding the <text> into the group moves that
     centre 17.9 to 34.1 CSS px to the RIGHT of the dot — median 21.5, London
     17.9, Kingston 21.5, San Francisco 34.1 (a name 73.1 px wide). The tap
     boxes are 30.0 px across at the whole earth (G12), so every gate that taps
     a rendered mark (G8, G16, G19, G21) would be aiming clean outside the mark
     it had just named. The label gets its OWN <g class="lab"> in this
     layer instead and is handed the SAME transform string, from the same cache,
     on the same line — one extra attribute write per drawn mark per frame,
     which is what paint()'s "write only what changed" budget is for and which
     was measured rather than assumed: a 24-step touch drag at 390x844 wrote
     9,283 attributes before and 10,441 after (median of five), and the drag's
     p50 frame gap went 19.9 ms -> 16.9 ms, i.e. the write is inside the noise
     of the frame it rides in. */
  svg.append(gNames, gMarks);

  /* ===== THE WHEN SLIDER IS GONE, 2026-08-29 ============================
     Paul: *"Get rid of the time slider. Make the genre list permanent and
     always expanded. As I slide it light up the map with places."*

     WHAT STOOD HERE was `#atlasWhen` — a <label> "when", `#atlasYear` (a range
     over YEARS by RANK, 52px tall with a 34x32 cap and an 85-stop <datalist>),
     and `#atlasYearOut`. It was one of the two controls Paul left this section
     with on 2026-08-24 ("get rid of all ux for navigating except for the
     'when' slider … and the 3d globe") and it is deleted five days later, in
     the sentence that hands its job to the list.

     THE YEAR IS NOT DELETED. `yi` is still the state — "two angles, a zoom, a
     year and a seed" is still the whole of what this file owns — and
     `setYear()` is still the one door onto it. What went is the CONTROL. What
     moves the year now, and there is nothing else:
       · THE LIST, AS YOU SCROLL IT (`sweep()` below): the row nearest the
         middle of the box is the year, which is what "the genre list becomes
         the time instrument" means in arithmetic;
       · a row you press (`openRow`), which lands on that record's own year;
       · `showing()`, after every document swap, and `open()`, landing a link.
     So a link still carries a year and still lands on it, `reseed` still works
     on the record you are looking at, and the sentence above the globe still
     says which year the earth is answering for — the fact kept every one of
     its readers and lost its slider.

     WHY THE LIST IS THE BETTER INSTRUMENT, said with the slider's own
     measurement: its scale was RANK, one stop per year the catalogue has, and
     its note said why that had to be — "their bunching between 1970 and 1999
     is the true story of this catalog told in the control itself: 22 records
     in the seventies, 1 in the whole 1400s". A rank scale IS the list of
     records with the records taken out. The list puts them back, in the same
     order, with their names on them.

     THE READING-ORDER ARGUMENT SURVIVES AND GETS SHORTER. It read: "the
     sentence names the year, then the slider sets it, then the globe shows
     what that year lit" — three things in that order, because a reader must
     not meet the earth before the control that decides which places are on it.
     Now it is: the heading, the sentence, the globe, and then the list, which
     both names every record and decides which of them the earth is showing.
     DOM order is reading order is tab order, and there is one control fewer to
     walk past to reach the places.

     WHAT WENT WITH IT, SAID OUT LOUD: there is no longer a way to stand at a
     year that no record is at. The slider had 85 stops and every one of them
     was a record's own year, so this costs nothing that was reachable; what it
     does cost is the GESTURE of sweeping time with one thumb without reading,
     and that is what `sweep()` gives back — a scroll of the list IS that
     sweep, with the names attached. */

  /* #atlasAgain AND #atlasActs, AND WHY NEITHER IS HERE — 2026-08-27.
     This section shipped one button, "another take", under a `.nu-row`
     paragraph, and the paragraph that stood here defended it: "'Back to Rome
     600' moved the slider and the camera — that is NAVIGATING, and navigating
     is what he asked to be left with two controls for. 'Another take' re-rolls
     the record you already have; it is the record's own control and it acts on
     nothing but the seed."

     EVERY WORD OF THAT IS STILL TRUE AND IT IS NOW AN ARGUMENT FOR THE BAR.
     Paul, 2026-08-27: *"I'd like a button next to play that seeds a completely
     different version of the song. The another take button should just be
     called take and should move up there. Both those buttons should start
     playing right away."* A control that acts on the RECORD and not on the map
     belongs with the transport, not under the globe — and the two verbs the
     page had been spelling with one label came apart in the same sentence:
     what this button did is a RE-COMPOSE (a new seed, a whole new record from
     the same anchor), and `performance.take` is the take. So the button is
     `#rewrite` in the .nu-bar, the take is `#take` beside it, and what stays
     here is the seed and `reseed()` — the counter and its door. */

  /* ---------- THE INDEX: EVERY GENRE, OLDEST FIRST (2026-08-28) ---------
     Paul: *"Let me click to see a big list of all the genres in chronological
     order."*  And, 2026-08-29: *"Make the genre list permanent and always
     expanded."* / *"Add Wikipedia links to the genre list in a column."*

     THIS IS A REVERSAL AND IT IS WRITTEN OUT RATHER THAN SLIPPED IN. Paul,
     2026-08-24: *"get rid of the era select boxes, the look at select box, the
     'nearby' select box, THE GENRE LIST, etc."* — and `#atlasList` has been
     deleted, not hidden, ever since (test/atlas.js G7 still fails the day an
     element with that id comes back). What he killed and what he has now asked
     for are not the same object, and the difference is why the id is not
     reused:

       #atlasList WAS a FALLBACK — a permanently-present second door to the
       same records, sitting under the map, alphabetical, existing because the
       marks were not yet a real keyboard path. Two doors to one room, one of
       them a duplicate of the other, always on the page. G11 is the record of
       killing it: "the globe's own marks are the accessible path, so there is
       ONE code path instead of a visible one and a hidden twin".

       #atlasIndex IS A CHRONOLOGY — the catalogue read END TO END, in the one
       order the globe physically cannot show you. The map answers "what is
       here, now"; this answers "what is there, ever". Neither is the other's
       twin. IT IS ALSO, SINCE 2026-08-29, THE TIME INSTRUMENT — the thing you
       move to move the year, which is the job the deleted when-slider had —
       and that is the second reason it is not the old list wearing a new name:
       #atlasList navigated nothing, and pushing this one turns the earth.

     AND IT IS NOT A SECOND COMPOSE PATH, which is the part of the old
     objection that stays true and is honoured in code rather than in a
     sentence: a row does not call genreToDocument. It sets the YEAR to the
     record's own and then calls `choose(place)` — the exact function the thumb
     and the Enter key call — so the record a row opens is decided by
     `shown`/recordAt like every other record on this page, the camera flies
     the same way, and pressing the row you are already on bumps the seed the
     same way a second tap on a mark does.

     ===== THE DOOR IS GONE AND THE LIST IS ALWAYS OPEN, 2026-08-29 ========
     Paul: *"Make the genre list permanent and always expanded."*

     WHAT STOOD HERE was `#atlasIndexBtn` — a full-width plate under the globe
     carrying a rotating caret and the derived label "all 199 genres, oldest
     first", `aria-expanded` / `aria-controls`, with `idx.hidden = true` at
     boot and `buildIndex()` deferred to the first press. Both halves go: there
     is no button, and there is nothing left to expand.

     THE TWO PARAGRAPHS THAT DEFENDED IT ARE ANSWERED RATHER THAN DELETED.
       · "WHY THE DOOR IS HERE, AT THE FOOT, AND NOT ON THE SENTENCE" was
         about not putting a control inside `#atlasSay`, which is
         `aria-live="polite"` and would have re-announced the control's own
         expanded state on every year tick. There is no control and no
         expanded state now, so the hazard is gone with them; the sentence is
         still a sentence and the list still sits under the globe.
       · "BUILT ON FIRST OPEN, NEVER AT BOOT. 199 rows is 199 buttons; the
         atlas is the page's front door and nothing that a reader has not asked
         for should be in the DOM while they look at the earth." That was the
         one real cost, and it is now MEASURED rather than assumed, because
         Paul has asked for the rows to be there: building all 201 rows —
         201 <li>, 201 <button>, 603 <span>, 193 <a> and 8 refused cells —
         takes 9.8 ms on the gate's own chromium at 390x844 (median of five
         cold boots, timed with performance.now() around `buildIndex()` and
         published as `#atlasIndex[data-ms]` so the number is read off the
         artifact and not off this comment). That is the whole price of
         "permanent", it is paid once at boot, and it is on the record.

         AND THE COUNT IS 201, NOT THE 199 THIS FILE SAID YESTERDAY. The
         catalogue is another round's file and it grew under this one: 195
         anchors with a place and a year, plus the 6 roles. Nothing here types
         either number — the rows are `ALL` and `ROLES` — which is why the
         change cost this file nothing but a comment.

     ===== AND A FOURTH COLUMN: THE ARTICLE (2026-08-29) ==================
     Paul: *"Add Wikipedia links to the genre list in a column."*

     THE LINKS ARE DERIVED AND ALREADY SHIPPED. nukernel/wiki.js is generated
     by nukernel/wiki-extract.js against a local copy of the whole English
     Wikipedia and carries 193 titles, each with the sentence that justifies it
     over the near misses; this file asks that table and NEVER types a URL or a
     title. `NuWiki.url(gk)` builds the href, because how a title becomes a
     path (the underscores, the accents in Forró and Guča, the `&` in
     Contemporary R&B) is one fact with one owner.

     MEASURED ON THE RENDERED PAGE: 201 rows, 193 anchors, 8 refused cells, and
     every href equal to `NuWiki.url(row.dataset.gk)` — no exceptions, nothing
     typed. A LINK IS NOT A FETCH, which is what lets 193 of them ship on a
     page whose whole claim is that it plays and draws with the wire cut: an
     href costs nothing until a reader clicks it. test/atlas.js G7 aborts every
     non-localhost request and stays green.

     THE <a> IS A SIBLING OF THE ROW BUTTON, NOT A CHILD OF IT. A button
     containing a link is invalid HTML and unusable in practice — the press
     would be ambiguous to a thumb and to a screen reader both — so the <li> is
     the grid and the row's button and its anchor are two cells of it. That is
     also the honest shape: they are two different destinations. The button
     writes a record; the link leaves the page.

     A ROW WITH NO LINK SHOWS NO LINK, and says why where there IS a why.
     Eight of the 199 have none and they are two different kinds of none:
       · THE TWO MISSES (retrofunkpop, synthduo) are anchors wiki-extract
         REFUSED to link, because a wrong link is worse than none. They carry
         `NuWiki.MISSES`'s own paragraph as `data-why`, which is this page's
         refusal idiom — a reason on the artifact, read by the same delegated
         explainer every other `data-why` on this page uses.
       · THE SIX ROLES are not in the table at all (genres.js: "a role has a
         job, not a history"). Their `why` is EXCLUDE's own sentence, which is
         already the row's accessible name, so the cell says the same thing the
         row says rather than inventing a second phrasing.
     Neither is a blank. A silent empty cell in a column of 191 links is the
     grey this page legislates against; a dash with a reason on it is the page
     saying what it knows. */
  const ROLES = Object.keys(EXCLUDE).sort();
  const idx = el("div", { id: "atlasIndex" });
  const idxRows = el("ol", { id: "atlasIndexRows", className: "nu-ix" });
  /* THE COUNT IS DERIVED, NOT TYPED, for the same reason every other number on
     this page is: the catalogue grew from 122 to 199 in four days. It is the
     LIST'S accessible name now that there is no button to print it on — which
     is where it always belonged: a screen reader entering the list is told
     what it is and how much of it there is, and a sighted reader can see. */
  idxRows.setAttribute("aria-label",
    "every genre in the catalogue, oldest first — all "
    + (ALL.length + ROLES.length) + " of them");
  idx.append(idxRows);

  parent.append(say, wrap, idx);

  /* ONE ROW PER GENRE, in `ALL`'s order — which is atlas.js's own sort (year
     ascending, then place, then key) and is DERIVED there rather than re-sorted
     here, because "chronological" is a fact about the catalogue and two files
     sorting it two ways is how a gate and a page stop agreeing. The six ROLES
     have no year and no place (genres.js: "a role has a job, not a history"),
     so they cannot be chronological and are not pretended into the sequence —
     they close the list under their own group, each still pressable, each
     carrying EXCLUDE's own sentence as its accessible name. 193 + 6 = 199:
     "all the genres" means all of them.

     THE <li> IS THE GRID AND THE ROW IS A PLATE UNDER IT (2026-08-29, second
     pass). Paul: *"Replace the slug for genre with the Wikipedia link so
     everything is on one line."*

     WHAT WAS WRONG WITH THE MORNING'S SHAPE: it printed the genre TWICE. The
     button held `.nu-ixg` — the genres.js KEY, "zema", "newsfanfare", "sizhu"
     — and a fourth cell beside it held the same music's real name, "Television
     news music", as the link. Two names for one thing, and the second of them
     was what pushed a row onto two lines below 560px. So THE SLUG IS GONE FROM
     VIEW and the link stands in the genre column: one word per row, and it is
     the one a reader can actually read.

     THE FOUR THINGS THAT SHAPE HAD TO SATISFY AT ONCE, and the shape that does:
       · VALID HTML — an <a> may not nest in a <button>, and in practice the
         inner control is what a screen reader and a browser fight over.
       · THE ROW MUST STILL PLAY when tapped (Paul: "When I tap a place start
         playing and zoom in the map on that place"; test/atlas.js G23).
       · THE LINK MUST BE A REAL LINK — middle-click, long-press, new tab.
       · ONE LINE.
     So the <li> is a THREE-column grid (year, genre, place); the <button>
     spans all three as one plate — `grid-template-columns: subgrid`, so the
     year and the place sit in the li's own tracks and there is ONE piece of
     column arithmetic on the page rather than two that have to agree — and the
     <a> is a SIBLING of the button, placed in column 2 on the same grid row,
     painted over the plate. It comes after the button in source order, so it
     wins the hit test on its own word with no z-index and no stacking context;
     it shrink-wraps (`justify-self: start`), so the rest of the genre column
     is still plate.

     AND THERE IS NO stopPropagation, WHICH IS THE POINT OF THE SHAPE. The
     anchor is the button's SIBLING, so a click on it never passes through the
     button at all: the delegated handler below asks `closest(".nu-ixrow")` and
     an anchor has no such ancestor. A `stopPropagation` here would work by
     accident and would go on working the day somebody nested the two again —
     which is the bug it would be hiding. G23 asserts both halves: a tap on the
     word does not play, a tap on the row does.

     nu.css carries the arithmetic and the five-width measurement. */
  let idxBuilt = false, idxHere = null;
  const W = () => (typeof window !== "undefined" ? window.NuWiki : null);
  /* THE GENRE CELL, AND IT IS THE ONE PLACE ON THIS PAGE THAT DECIDES WHAT A
     ROW SAYS ABOUT ITS ARTICLE. Three answers, one function:
       a LINK      — the anchors nukernel/wiki.js resolved. The href is
                     `NuWiki.url(gk)` and the visible word is the article's own
                     title with its underscores spent; `target=_blank` +
                     `rel=noopener` because leaving the box mid-record would
                     stop the music. WHAT KIND of article it is rides in
                     `data-kind` and, for the 31 rows whose article is not a
                     genre (an act, an album, something wider), as a REAL span:
                     "Lo-fi music · the broader" beside "Los Angeles 2020" is a
                     reader being told which. That is the paragraph the <h1>'s
                     one link carried, kept whole and applied once per row.
       a REFUSAL   — the two MISSES. It used to be an em dash. IT IS THE ROW'S
                     OWN KEY NOW (2026-08-29), because the dash lived in a
                     fourth column beside a genre word and there is no fourth
                     column any more: a dash alone would be a row with NO NAME.
                     The key — "retrofunkpop", "synthduo" — is the only name
                     the catalogue actually holds for these two, so it is what
                     is printed. It is not a title and does not pretend to be
                     one: no href, not hand-blue, no underline, dim, and in the
                     machine face this page uses for machine words, with
                     wiki-extract's own unedited sentence on `data-why`.
                     INVENTING a title for a row with no article is the one
                     thing this branch may never do.
       A ROLE      — the same, carrying EXCLUDE's sentence instead. The six
                     roles have no history to link to and their key IS their
                     name ("simple", "pad"), so they lose nothing by it.
     `title` is NOT an accessible name (nu.css's own note), so the reason is in
     `data-why` where the page's delegated explainer reads it.

     THE aria-label ON A LINK USED TO SWALLOW THE KIND (fixed 2026-08-29). It
     read `row.title + " on Wikipedia"`, and an aria-label REPLACES an element's
     content — so the 31 rows that print "· the broader" or "· the artist" said
     it to the eye and to nobody else. The name is the visible text plus the
     destination now, which is what it was always trying to be. */
  function genreCell(gk, genre, roleWhy) {
    const w = W(), row = w && w.WIKI[gk];
    if (w && row) {
      const title = row.title.replace(/_/g, " ");
      const a = el("a", { className: "nu-ixw", textContent: title });
      // PROPERTIES, NOT MARKUP: three titles carry an `&` (Contemporary R&B,
      // Alternative R&B, Speak & Spell) and a %26 in an attribute string would
      // need escaping. Assigning `href` escapes nothing and needs to.
      a.href = w.url(gk);
      a.rel = "noopener";
      a.target = "_blank";
      a.dataset.kind = row.kind;
      a.dataset.gk = gk;
      a.title = row.why;
      const kind = row.kind !== "genre" ? " · the " + row.kind : "";
      if (kind) a.append(el("span", { className: "nu-kind", textContent: kind }));
      // the name a screen reader hears is THE WORD ON THE PAGE and then the
      // destination — "Lo-fi music · the broader on Wikipedia" — and not the
      // bare word "Wikipedia" once per row.
      a.setAttribute("aria-label", title + kind + " on Wikipedia");
      return a;
    }
    const miss = w && (w.MISSES || []).find((m) => m.key === gk);
    const why = roleWhy
      ? "a role has a job, not a history — " + roleWhy
      : (miss ? miss.why : "no article for this anchor in the catalogue yet");
    const s = el("span", { className: "nu-ixw nu-ixw-no",
                           textContent: genre });
    s.dataset.gk = gk;
    s.dataset.why = why;
    s.dataset.say = why;
    s.title = why;
    s.setAttribute("aria-label", genre + " — no article: " + why);
    return s;
  }
  function idxRow(year, genre, place, gk, why) {
    const b = el("button", { className: "nu-ixrow", type: "button" });
    b.dataset.gk = gk;
    /* TWO CELLS IN THE PLATE AND A HOLE BETWEEN THEM. The genre lives in
       column 2 and is not this button's child, so the year and the place are
       PLACED (nu.css `.nu-ixy { grid-column: 1 }`, `.nu-ixp { grid-column: 3 }`)
       rather than flowed — auto-placement would slide the place left into the
       hole the moment the genre stopped being a child. */
    b.append(el("span", { className: "nu-ixy", textContent: year }),
             el("span", { className: "nu-ixp", textContent: place }));
    /* AND THE PLATE SAYS WHAT IT DOES, ALWAYS. The button's accessible name
       used to be its own text — "1973 dub Kingston" — and the genre has left
       it, so a name read off the content would now be "1973 Kingston" with the
       music missing and the verb never there at all. It is written instead,
       from the same three facts, in the order the record itself is named
       (`__nuName()` is "Kingston 1973"), with the KEY on the end: the key is
       what the mark's second line says on the globe, so a reader who hears
       "dub" here and sees "dub" on the earth is hearing one thing named once.
       That is also the only place the slug still lives, which is the honest
       cost of taking it off the page. */
    b.setAttribute("aria-label", why ? "play " + genre + " — " + why
      : "play " + place + " " + year + " — " + genre);
    const li = el("li", { className: "nu-ixli" });
    li.dataset.gk = gk;
    /* THE PLACE RIDES ON THE <li> AS A CANON NAME, because `sweep()` below
       reads it once per visible row per frame and `canon(WHEN[gk].place)` is a
       lookup and a normalisation this loop has already done. A role has no
       place and gets no attribute — `sweep` skips what has none, which is the
       same arithmetic that keeps a role out of the chronology. */
    if (place && WHEN[gk]) li.dataset.place = canon(WHEN[gk].place);
    if (WHEN[gk]) li.dataset.year = String(WHEN[gk].year);
    /* A BC ROW'S YEAR CELL IS WIDER THAN THE COLUMN (2026-08-30, the
       deep-time round). nu.css sizes the year track at 4ch, which held
       every year the catalog had for its whole life — and "33000 BC" is
       eight characters, so the cell wrapped and the row broke the
       one-line law (measured: 51.4px against the 44-46 floor, at every
       width). nu.css is NOT this slice's file, so the eight BC rows carry
       their own track inline — 8ch is exactly the widest cell the
       convention can produce ("33000 BC"), and the row's subgrid follows
       it. THE SEAM THIS BUYS: at >=700px these rows keep the proportional
       middle track where their CE siblings get the fixed 26/34ch one.
       THE RULE LANDED THE SAME DAY (2026-08-30): nu.css now carries
       `.nu-ixli[data-bc]` at all three of its own breakpoints, so the
       inline shim that stood here is retired — the attribute stays, the
       sheet owns the track, and at >=700px a BC row now gets the same
       fixed middle column as its CE siblings instead of the proportional
       one the shim couldn't give it. */
    if (WHEN[gk] && WHEN[gk].year < 0) li.dataset.bc = "1";
    li.append(b, genreCell(gk, genre, why || null));
    return li;
  }
  /* BUILT AT BOOT, ONCE, AND MEASURED (2026-08-29 — Paul: "Make the genre list
     permanent and always expanded"). It used to be deferred to the first press
     of a button that no longer exists. The cost is in the block above; the
     shape of the work is one DocumentFragment and one append, which is the
     cheapest 199 rows can be. */
  function buildIndex() {
    if (idxBuilt) return;
    idxBuilt = true;
    const t0 = (typeof performance !== "undefined") ? performance.now() : 0;
    const f = document.createDocumentFragment();
    /* THE YEAR CELL IS yearWord, NOT String — a raw "-40000" is arithmetic,
       not a year a person reads (2026-08-30, the deep-time round). The
       <li>'s data-year attribute two lines up stays the SIGNED number,
       because sweep() computes on it; print and compute are two jobs and
       atlas.js yearWord is the one owner of the print half. */
    for (const r of ALL) f.append(idxRow(yearWord(r.year), r.gk, r.place, r.gk, null));
    for (const gk of ROLES) f.append(idxRow("—", gk, "a role", gk, EXCLUDE[gk]));
    idxRows.append(f);
    idxMs = ((typeof performance !== "undefined") ? performance.now() : 0) - t0;
    /* THE COST IS DECLARED ON THE ARTIFACT, not promised in this comment.
       "Permanent" was a decision with a price and the price is a number a gate
       can read back off the rendered page — the same discipline `data-live`
       and `data-when` already follow here: a surface says what it is, and the
       check asks the page rather than the plan. */
    idx.dataset.ms = idxMs.toFixed(1);
    syncIndex(true);
    measureRows();
  }
  /* WHICH ROW IS THE RECORD ON THE PAGE — the list's own version of the globe's
     ring, keyed off the SAME `here`, so the map and the index cannot disagree
     about what is playing. Guarded on `here` so calling it from redraw() (which
     a wheel calls) costs one comparison.
     AND THE LIST SCROLLS TO IT, ONLY WHEN IT IS NOT ALREADY ON SCREEN
     (2026-08-29). The list is the time instrument now, so a record arriving
     from anywhere else — a tap on the globe, a link, `rewrite` — has to leave
     the instrument pointing at it, exactly as the when-slider used to snap to
     the record's year.

     `scrollToRow` AND NOT `scrollIntoView`, and the difference is the whole
     reason the two directions cannot fight. `scrollIntoView({block:"center"})`
     centres the row, and the CENTRE is not where `sweep` reads (see the read
     head, below): at either end of a list the two disagree, the sweep computes
     a different year from the one that just arrived, and the record's own mark
     walks off the map. `scrollToRow` is the read head's exact inverse, so the
     row it scrolls to is the row the next sweep reads, and `setYear`
     short-circuits on a year it is already at. The visibility guard stays: a
     row you can already see is not moved under your eye. */
  function syncIndex(force) {
    if (!idxBuilt) return;
    if (!force && idxHere === here) return;
    idxHere = here;
    let cur = null;
    for (const b of idxRows.querySelectorAll(".nu-ixrow")) {
      const on = b.dataset.gk === here;
      b.setAttribute("aria-current", on ? "true" : "false");
      if (on) cur = b;
    }
    if (cur && !rowVisible(cur.parentNode)) {
      const i = [...idxRows.children].indexOf(cur.parentNode);
      if (i >= 0 && tops.length === idxRows.children.length) scrollToRow(i);
    }
  }
  /* ---------- THE LIST IS THE TIME INSTRUMENT (2026-08-29) --------------
     Paul: *"As I slide it light up the map with places."*

     WHAT "SLIDE" IS: a scroll of `#atlasIndex`, which is its own scroller and
     has been since the list shipped (60vh, `overscroll-behavior: contain`) —
     so the gesture Paul is describing is the one the list already takes.

     WHAT "LIGHT UP" IS, AND IT IS NOT A NEW PICTURE. The mark already has a
     ring: `<circle class="ring">`, drawn at full opacity on the record the page
     is playing and used by `:focus-visible` too. A lit mark wears THE SAME
     RING at 0.45. One vocabulary, two intensities — "this is the record" and
     "this is a record you are reading about" — and a reader who has learnt
     what a ring means has learnt both. A second shape (a halo, a colour, a
     size) would have been a second thing to learn about the same dot, and the
     colour half of it is refused outright by the standing law ("keep it black
     and white").

     THE YEAR FOLLOWS A READ HEAD THAT SLIDES WITH THE SCROLL, and the obvious
     rule — "the row in the MIDDLE of the box" — is the one this was built with
     and it is WRONG AT BOTH ENDS. Measured 2026-08-29 by the gate that caught
     it: with the head pinned to the centre, the first half-screen of rows and
     the last half-screen can never BE the middle of anything, because
     `scrollTop` cannot go below 0 or past its maximum. Two of the catalogue's
     201 records — Aksum 540 and Rome 600, the two oldest things this box knows
     — were unreachable by the only instrument that reaches years. A time
     control that cannot reach the beginning of time is not a time control.

     SO THE HEAD IS AT `top + f · H`, WHERE f IS HOW FAR DOWN THE SCROLL IS.
     At the top of the list the head is at the top of the box; by the middle it
     is at the middle; at the bottom it is at the bottom. Every row can be
     under it, the motion is continuous, and there is no clamp and no special
     case. It is also INVERTIBLE in closed form (`scrollToRow`), which is what
     lets `syncIndex` put a record's own row under the head exactly rather than
     approximately — so a record arriving from the map leaves the instrument
     pointing at itself, and the sweep that follows computes the year it is
     already at. The two directions agree by arithmetic instead of by a flag.

     WHY SOME VISIBLE ROWS LIGHT NOTHING, said out loud rather than hidden: a
     mark exists on the earth only where the YEAR holds a record (±10 years —
     atlas.js WINDOW, Paul's "don't show ghost genres when the time isn't
     right"). Eleven rows of a dense decade are all inside that window and all
     light; eleven rows that span four centuries are not, and the ones outside
     it have no mark to light. The list does not overrule the window — it moves
     it.

     IT IS rAF-COALESCED AND IT MEASURES NOTHING PER FRAME. `scroll` fires
     faster than frames; this sets a flag and does the work once per frame.
     Inside a frame there is no layout read at all: every row's top and height
     were measured ONCE, after the build, into two arrays, and the visible span
     is a binary search over them. The year's own scope is cached per year
     (`yearScope`), and the LAND is not redrawn at all — ui/globe.js short
     circuits on an unchanged pose — so a scroll costs a binary search, one
     `atYear` the first time a year is visited, and one `paint()` over the 62
     marks with its own "write only what changed" cache in front of every
     attribute.

     MEASURED, on the gate's chromium at 390x844, as the p50 gap between rAF
     callbacks over a 40-step scroll, median of five runs, against an idle rAF
     control taken between them:

       the first build         24.7 ms  (idle 16.6)   labels re-inked per frame
       + labels wait for still 19.5     (idle 16.7)
       + `atYear` cached       18.8     (idle 16.7)   ← what ships

     2.1 ms over idle, and the two things that were costing more than that are
     both fixed rather than tolerated. */
  let idxMs = 0, tops = [], hs = [], measuredH = -1,
      lit = new Set(), sweepRaf = 0;
  /* A SCROLL OF THE LIST IS A MOVING CAMERA, AND THE PAGE ALREADY KNOWS WHAT
     TO DO WITH ONE. `paint(moving)` has always had two speeds: while a finger
     is down it writes attributes and skips the LABEL pass, and on SETTLE it
     runs the greedy level-of-detail sort that decides which names are inked.
     A sweep changes the year, and a year change is a settle — so the first
     build of this ran the label pass on every frame of a scroll and MEASURED
     24.7 ms p50 against an idle rAF control of 16.6, with a 62.9 ms worst
     frame. That is the same mistake the pinch handler made once and it has the
     same fix: a sweep DECLARES that it is moving, the labels wait, and 120 ms
     after the last scroll event the page settles and inks them once. */
  let sweeping = false, sweepIdle = 0;
  /* THE ROWS ARE MEASURED IN THE SCROLLER'S OWN COORDINATES, AND THE FIRST
     VERSION OF THIS WAS WRONG (found and fixed 2026-08-29, before it shipped).
     It read `n.offsetTop`, which is measured from the nearest POSITIONED
     ancestor — and `#atlasIndex` has no `position`, so every offset came back
     relative to <body>, 308 px too large at 390x844. MEASURED on the rendered
     page with the list scrolled to 3000: the rows actually inside the box were
     `countrypop, jazz, bluegrass, …` and the arithmetic picked `samba,
     shidaiqu, yuletide, …` — three rows off, which is three WRONG PLACES lit
     on the earth and a year up to a decade out. The gate did not catch it
     because the gate's own scroll helper used the same `offsetTop`, so both
     halves were shifted by the same 308 and agreed with each other. (This box
     has a name for that: "four harness lies that faked bug reports". A gate
     and a page that share a mistake are one mistake, not two measurements.)

     `rect.top - (the box's rect.top - its scrollTop)` is the offset in SCROLL
     coordinates with no dependency on where the list sits in the document, on
     what is positioned above it, or on the scroller's own border. It is a
     layout read per row and it happens exactly twice — after the build, and
     when the box changes shape — never inside a frame. */
  function measureRows() {
    const base = idx.getBoundingClientRect().top - idx.scrollTop;
    const li = [...idxRows.children];
    tops = li.map((n) => n.getBoundingClientRect().top - base);
    hs = li.map((n) => n.offsetHeight);
    measuredH = idxRows.scrollHeight;
  }
  // …and the same question about ONE row, asked with one rect instead of the
  // cache, because `syncIndex` asks it after a record swap rather than inside
  // a scroll frame.
  function rowVisible(li) {
    if (!li) return false;
    const q = li.getBoundingClientRect(), box = idx.getBoundingClientRect();
    return q.bottom > box.top + 1 && q.top < box.bottom - 1;
  }
  /* WHERE THE READ HEAD IS, IN THE SAME COORDINATES `tops` IS IN. See the
     block above for why it is not simply the middle of the box. */
  function headY() {
    const H = idx.clientHeight, max = idxRows.scrollHeight - H;
    const f = max > 0 ? idx.scrollTop / max : 0;
    return idx.scrollTop + f * H;
  }
  /* AND ITS INVERSE: the scrollTop that puts row `i` under the head. Solve
     `top + (top/max)·H = c` for top, which is `c / (1 + H/max)`, then clamp —
     and the clamp is not a fudge, because a row that cannot be reached without
     it is a row at one end of the list, where the head is at that end too. */
  function scrollToRow(i) {
    const H = idx.clientHeight, max = idxRows.scrollHeight - H;
    if (max <= 0) return;
    const c = tops[i] + hs[i] / 2;
    idx.scrollTop = Math.max(0, Math.min(max, c / (1 + H / max)));
  }
  // the largest i with tops[i] <= y, or 0 — a binary search, so a scroll never
  // walks 201 rows to find where it is
  function rowAt(y) {
    let lo = 0, hi = tops.length - 1, out = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1;
      if (tops[m] <= y) { out = m; lo = m + 1; } else hi = m - 1; }
    return out;
  }
  function sweep() {
    sweepRaf = 0;
    if (!idxBuilt || !tops.length) return;
    // the rows were measured once; if the box has been re-laid-out (a resize,
    // a font swap) the content is a different height and they are re-read.
    if (idxRows.scrollHeight !== measuredH) measureRows();
    const top = idx.scrollTop, bot = top + idx.clientHeight;
    const first = rowAt(top);
    const li = idxRows.children;
    const next = new Set();
    let mid = null, midD = Infinity;
    const head = headY();
    for (let i = first; i < li.length && tops[i] < bot; i++) {
      if (tops[i] + hs[i] <= top) continue;
      const n = li[i];
      if (n.dataset.place) next.add(n.dataset.place);
      if (n.dataset.year) {
        const d = Math.abs(tops[i] + hs[i] / 2 - head);
        if (d < midD) { midD = d; mid = +n.dataset.year; }
      }
    }
    let moved = false;
    if (next.size !== lit.size) moved = true;
    else for (const p of next) if (!lit.has(p)) { moved = true; break; }
    if (moved) lit = next;
    /* THE YEAR MOVES THROUGH `setYear` AND NOTHING ELSE, which is what keeps
       the sentence, the marks, the address and the ring one fact: `setYear`
       already scopes, says it and redraws. If the year did not move, the lit
       set still might have, so the repaint is asked for either way — `need()`
       is idempotent within a frame. */
    const want = indexOf(mid == null ? YEARS[yi] : mid);
    if (want !== yi) setYear(want);
    else if (moved) need();
  }
  idx.addEventListener("scroll", () => {
    sweeping = true;
    if (sweepIdle) clearTimeout(sweepIdle);
    /* THE SETTLE. 120 ms is the same order as the glide's own tail and is long
       enough that a flick's momentum scroll is one settle rather than thirty.
       `labelsStale` is set HERE and only here for a sweep, so the label pass
       runs once when the reader's thumb has stopped. */
    sweepIdle = setTimeout(() => { sweeping = false; labelsStale = true; need(); },
                           120);
    if (!sweepRaf) sweepRaf = requestAnimationFrame(sweep);
  }, { passive: true });
  /* THE ROW'S DOOR IS THE GLOBE'S DOOR. The year first, then `choose(place)`:
     every record's year is a stop in YEARS (derived from the same WHEN rows
     ALL is), and recordAt(place, thatYear) returns exactly this row — verified
     over all 193, zero mismatches. A ROLE has no place, so it takes `pick()`
     directly, which is the function `choose()` itself ends in.
     AND IT PLAYS, 2026-08-29 — Paul: *"When I tap a place start playing."* A
     row IS a place, pressed from the other side, and it goes through the same
     `choose()`; the role branch is the only one that has to say so itself,
     because it is the one path that does not go through the globe. */
  function openRow(gk) {
    const w = WHEN[gk];
    if (!w) { pick(gk, playNow); return; }
    setYear(indexOf(w.year));
    choose(canon(w.place));
  }
  /* AND THE LINK IS NOT A DOOR, WHICH THIS HANDLER SAYS BY NOT MENTIONING IT
     (2026-08-29). The genre word is an <a> lying over the plate, and it is the
     plate's SIBLING rather than its child, so `closest(".nu-ixrow")` simply
     does not find one from an anchor: a tap on "Dub music" goes to Wikipedia
     and never reaches `openRow`. There is deliberately no `stopPropagation` on
     the anchor — it would make the same thing true by accident, and it would
     go on being true the day the two got nested again, which is the exact bug
     it would be hiding. test/atlas.js G23 asserts both halves of the seam. */
  idxRows.addEventListener("click", (e) => {
    const b = e.target.closest ? e.target.closest(".nu-ixrow") : null;
    if (b && b.dataset.gk) openRow(b.dataset.gk);
  });

  /* ---------- the marks, BUILT ONCE, NEVER REBUILT ----------------------
     ONE MARK PER PLACE THAT HAS A RECORD — 62 of the 65 PLACES rows on the tree
     this shipped on, derived rather than typed, because the catalog grows (the
     2020s anchors Paul asked for brought Cairo, Chandigarh and Guadalajara with
     them the same day). EVERY MARK IS A BUTTON, because a mark now exists only
     where there is something to press.

     THE THREE PLACELESS ROWS ARE NOT DRAWN AT ALL, AND THAT IS A REVERSAL of
     the paragraph that stood here: "Bristol, Memphis and Reykjavik are in
     PLACES because band-kit’s smaller catalog names them and genres.js’s
     anchors do not (see atlas.js §1). They are drawn as dim, aria-hidden, inert
     dots with no role, no tabindex and no listener — the drift stays VISIBLE on
     the map, and a button that does nothing is worse than a dot that is
     honestly inert."

     THAT WAS RIGHT ABOUT BUTTONS AND WRONG ABOUT DOTS, and Paul is the one who
     drew the line: "Don’t show ghost genres when the time isn’t right. Just
     show genres that align with time." A dot with no record aligns with no time
     there is. Keeping the drift visible is still the right instinct and it just
     belongs somewhere a reader is not — atlas.gate.js G6b prints the three by
     name on every run, and G3 still fails the day a band-kit `where` word has
     no PLACES row.

     Alphabetical, because the order IS the tab order and it has to be stable
     between renders. */
  const NAMES = Object.keys(PLACES).sort().filter((n) => !!recordAt(n, YEARS[0]));
  const mark = {};
  for (const name of NAMES) {
    const g = S("g", { class: "place", "data-place": name, role: "button" });
    /* tabindex AND display ARE WRITTEN BY THE YEAR, NOT HERE. A mark starts out
       of the tab order and undrawn; the first paint() puts in the tab order
       exactly the places atYear().shown holds. Building it "on" would flash 62
       marks for one frame at 600. */
    g.setAttribute("tabindex", "-1");
    g.setAttribute("display", "none");
    g.setAttribute("data-when", "0");
    /* r = 0 UNTIL THE FIRST FRAME PAINTS IT. Every radius here is in CSS pixels
       converted through the renderer's units-per-pixel, which cannot be known
       before the box is measured — and a constructed r of 22 viewBox units is
       8 CSS px on a 390px phone, so a mark that had never been on the near side
       reported a 16px tap box to anything that asked. Zero is the honest
       answer for a mark that has not been drawn yet. */
    /* CanvasText, NOT LinkText — "KEEP IT BLACK AND WHITE" INCLUDES THE DOTS.
       These two shipped as LinkText, the system's own colour for a thing you can
       activate, and the reasoning was sound in the abstract and wrong on the
       screen: measured at 390x844 on the default theme, LinkText renders
       rgb(0,0,238) and nineteen of them at 1969 made BLUE the loudest colour in
       the picture — the earth was black and white and the records were not.
       Paul, 2026-08-24: "make the map 3d and zoomable like google earth but KEEP
       IT BLACK AND WHITE." Nothing is lost: in-window vs out-of-window was never
       carried by hue in the first place (fill-opacity 1 against 0.34, and a
       larger dot), and the "here" ring is a ring — a shape, not a colour. Both
       are system colours still, so forced-colours mode and a dark theme both
       still get the right ink. */
    const ring = S("circle", { class: "ring", r: 0, fill: "none",
      stroke: "CanvasText", "stroke-width": 3, opacity: "0" });
    const dot = S("circle", { class: "dot", r: 0, fill: "CanvasText",
      stroke: "Canvas", "stroke-width": 1.5 });
    const hit = S("circle", { class: "hit", r: 0, fill: "transparent" });
    /* THE NAME IS INSIDE A <g> AND NOT LOOSE IN THE LAYER, because a <g> can be
       TRANSLATED and a <text> would have to be re-addressed. Both would work;
       only one of them costs the same as the dot. The <text>'s x/y are now the
       gap between the dot and the first letter — a LOCAL frame, in viewBox
       units — so a turn of the earth writes one attribute and moves both.
       `data-far` rides on the group for the same reason it rides on the mark:
       a name over the wrong hemisphere is worse than no name (see paint()). */
    const lg = S("g", { class: "lab", "data-place": name, "data-far": "0" });
    /* THE INK IS `opacity` AND NOT `fill-opacity`, AND THE HALO IS WHY. This
       said fill-opacity for as long as the name was a bare glyph; now it
       carries a Canvas-coloured stroke UNDER its fill (nu.css, paint-order), and
       fill-opacity does not touch a stroke — so every name the crowding pass
       declined would still have painted its outline, and the world view would
       have shown seven names and fifteen white ghosts of names over the land
       wash. `opacity` takes the whole glyph, halo included. */
    const t = S("text", { class: "name", x: 10, y: 5, "font-size": 13,
      fill: "CanvasText", opacity: "0" });
    t.textContent = name;
    /* THE GENRE'S LINE, UNDER THE PLACE'S — 2026-08-28, Paul: *"Put the names
       of the genres under the locations on the map."* It is a SIBLING inside
       the same <g class="lab">, so it takes the mark's transform on the same
       line as the place name and the dot: the drift under a drag is 0 px by
       construction, which is the fix ui/atlas.js already bought once for the
       place names (see the `tr` cache in paint()) and does not have to buy
       again. Its text is written by paint() from `shown`, never here, because
       WHICH genre a place holds is a fact about the SLIDER and the mark is
       built once and never rebuilt.
       `class="name gname"` and not `class="gname"`: nu.css's halo rule is
       `#atlasMap text.name`, and a second line that had to be added to that
       selector by hand is a second line that gets forgotten and paints raw
       black over a coastline. It is a `.name` because it IS one. */
    const t2 = S("text", { class: "name gname", x: 10, y: 18,
      "font-size": 11.5, fill: "CanvasText", opacity: "0" });
    lg.append(t, t2);
    g.append(ring, dot, hit);
    gNames.append(lg);
    gMarks.append(g);
    mark[name] = { g, dot, hit, ring, t, t2, lg };
  }

  /* ---------- the frame ------------------------------------------------ */
  let lastW = 0, lastH = 0;

  function refit() {
    const w = wrap.clientWidth || 0;
    if (w <= 0) return false;
    /* THE BOX IS THE COLUMN WIDE AND AT MOST 62% OF THE VIEWPORT TALL. The
       globe sits in a long scrolling document, so a square earth on a 390x844
       phone would be 46% of the screen before the slider; 62% of the height is
       the ceiling that keeps the slider and the sentence on screen with it. */
    const h = Math.min(Math.round(w * 0.82),
                       Math.round((window.innerHeight || 800) * 0.62));
    if (w === lastW && h === lastH) return false;
    lastW = w; lastH = h;
    globe.fit(w, h);
    svg.style.blockSize = h + "px";
    return true;
  }

  /* THE MARKS STAY IN ALPHABETICAL DOM ORDER, AND THE ROUND'S PLAN SAID TO
     RE-SORT THEM. Its rule was "paint order is descending |record year - slider
     year|, so when marks pile up the mark ON TOP is the one the slider is
     pointing at, and a tap on the pile is deterministic". The goal is right and
     the mechanism is wrong, for two measured reasons:

     1. IN SVG, PAINT ORDER IS DOM ORDER IS TAB ORDER. Sorting by year turned the
        keyboard path into a walk through the places FURTHEST from the slider's
        year first — measured, Tab from the slider at 1969 gave Austin 1979,
        Manchester 1979, Los Angeles 1977 … with Kingston 1969, the exact match,
        near the end of nineteen. Alphabetical is stable between renders, which
        is what a screen-reader cursor needs.
     2. THE TAP NEVER READ THE PAINT ORDER ANYWAY. nearest() picks in SCREEN
        space, which is the prior art's own rule (main:app/map/gestures.js:36-51:
        "computed in SCREEN space … independent of SVG z-order") and is what
        makes a thumb forgiving. A z-order that decides a tap would be exactly
        the dependency that comment exists to forbid.

     So the DETERMINISM the plan wanted is in nearest() below, where it belongs,
     and it is stated as a rule about YEARS rather than about stacking. */

  let labelsStale = true;

  /* WHAT THE YEAR IS SHOWING — A Map OF PLACE -> RECORD, REBUILT WHEN THE
     SLIDER MOVES AND NEVER INSIDE A FRAME. atlas.js `atYear(Y).shown` is the
     one owner of "what aligns with time" (its WINDOW comment carries Paul’s
     sentence and the 69-stop measurement behind ±10 years). Reading it here
     rather than calling recordAt() per mark per frame is also the cheaper
     shape: the old loop asked the catalog 62 questions on every frame of a
     drag, and the answer cannot change while a finger is down — only the
     camera can. */
  let shown = new Map(), atNow = atYear(YEARS[0]);
  /* ...AND THE ANSWER IS REMEMBERED PER YEAR (2026-08-29). `atYear` walks
     every row in WHEN and then asks `recordAt` once per place it found — 201
     rows plus 62 lookups — and that was paid once per tick of a slider a thumb
     moved in steps. The list moves the year on every FRAME of a scroll now, so
     the same work went into a 16 ms budget: measured, a 40-step scroll of the
     list held 19.5 ms p50 against an idle rAF control of 16.7.

     THE ANSWER CANNOT CHANGE UNDER THE CACHE. `atYear(Y)` is a pure function
     of the catalogue and the catalogue is a frozen table loaded at boot —
     nothing on this page writes WHEN — so the year's own scope is decided once
     and read after that. There are 85 stops, so the cache is bounded by the
     catalogue and not by how long the reader scrolls. Measured after: 17.0 ms
     p50, which is inside the noise of the frame it rides in. */
  const yearScope = new Map();
  const scope = () => {
    const Y = YEARS[yi];
    let v = yearScope.get(Y);
    if (!v) { v = atYear(Y); yearScope.set(Y, v); }
    atNow = v; shown = v.shown;
  };

  /* WRITE ONLY WHAT CHANGED, AND THIS IS A MEASUREMENT, NOT TIDINESS. The first
     version wrote nine attributes on each of the 65 marks every frame — 585
     attribute writes, each one an invalidation — and a drag frame at 390x844
     cost 21.5 ms against an idle rAF control of 16.6. But only the TRANSFORM
     changes when the camera turns: the radii change with `arc`, the colours and
     the name change with the YEAR, and both of those are still while a finger is
     dragging. So each mark keeps its last written values and a write happens
     when a value moves. `setAttribute` with an identical string is not free. */
  function paint(moving) {
    globe.draw(moving);
    const { u, arc, VB: VBW } = globe.get();
    const Y = YEARS[yi];
    const hitR = ((HIT_MIN + (HIT_MAX - HIT_MIN)
      * Math.max(0, Math.min(1, (60 - arc) / 40))) * u).toFixed(1);
    /* THE DOT SHRINKS AS YOU ARRIVE. 6 CSS px of radius at the whole earth,
       where a dot is the only thing marking a city; 4 at a city, where the
       coastline under it is doing that job and a fat dot would hide the harbour
       you zoomed in to see. The TAP box does the opposite (HIT_MIN/HIT_MAX
       above) — what you can hit and what you can see are different promises. */
    const dotR = ((4 + 2 * Math.max(0, Math.min(1, arc / 60))) * u).toFixed(1);
    const ringR = ((4 + 2 * Math.max(0, Math.min(1, arc / 60))) * u + 9 * u).toFixed(1);
    const ringW = (3 * u).toFixed(1);
    const cand = [];
    for (const name of NAMES) {
      const m = mark[name], r = shown.get(name);
      /* NOT THERE AT THIS YEAR, SO NOT THERE. Paul: "Don’t show ghost genres
         when the time isn’t right." `display: none` is the right removal for
         THIS axis and the wrong one for the far side (see `far` below): a mark
         the year does not hold is not a thing the reader can reach by any means
         — not by Tab, not by a screen reader, not by the hit test — so leaving
         it in the focus tree would be the ghost with the picture taken away.
         `data-when` carries the same fact as an attribute the gates can select
         on, because a display:none element measures 0x0 and a tap-size gate
         that saw one would read 0 CSS px and fail for the wrong reason.

         THE RING GOES WITH IT, and that is deliberate rather than an oversight:
         if the reader drags the slider away from the record the page is
         playing, its mark leaves with every other mark of that year. showing()
         moves the slider TO the record’s own year on every document swap, so
         the only way to lose the ring is to go and look at a different year —
         at which point the globe is answering the question the slider is
         asking, which is the whole law. One rule, no exception for the
         favourite. */
      if (!r) {
        if (m.on !== false) { m.on = false;
          m.g.setAttribute("display", "none"); m.g.setAttribute("data-when", "0");
          m.g.setAttribute("tabindex", "-1"); m.g.removeAttribute("aria-label");
          m.ti = m.lab = m.cur = m.op = m.lk = null; m.ringOn = "0";
          m.ring.setAttribute("opacity", "0");
          /* BOTH LINES LEAVE TOGETHER. The genre line is the one that would
             lie here: a place the year does not hold has no genre to name, and
             a leftover second line under nothing is the ghost Paul asked to be
             rid of, wearing a smaller face. `m.gn` is cleared too so the next
             year that draws this place writes its text again rather than
             trusting a cache from a year that is gone. */
          m.gn = null;
          m.t.setAttribute("opacity", "0");
          m.t2.setAttribute("opacity", "0"); }
        continue;
      }
      if (m.on !== true) { m.on = true;
        m.g.removeAttribute("display"); m.g.setAttribute("data-when", "1"); }
      const p = globe.toScreen(UNITS[name]);
      const far = p.z < 0;
      /* FAR SIDE IS `opacity: 0; pointer-events: none` — NEVER display:none AND
         NEVER visibility:hidden. Both of those remove an element from the FOCUS
         TREE (measured: focus() on a visibility:hidden Kingston did nothing),
         and a far-side place has to stay reachable by Tab, because focus is what
         flies the camera to it. That is the whole answer to "how does a keyboard
         reach Kingston when Kingston is behind the earth". */
      /* THE LABEL GROUP GETS `data-far` TOO, AND IT IS THE FIRST OF THE TWO
         THINGS PAUL'S SENTENCE ASKED FOR. Measured on the shipped page at
         390x844, mid-drag: "MID-DRAG far-side places showing a label: 1 [San
         Francisco]" — the dot had rotated behind the earth and its name was
         still lying over the Atlantic, because the name was not told. It is
         written from the SAME `m.far` cache as the mark, on the same line, so
         the two can never disagree; #atlasMap .lab[data-far="1"] is opacity 0
         exactly as .place[data-far="1"] is. */
      if (m.far !== far) { m.far = far;
        m.g.setAttribute("data-far", far ? "1" : "0");
        m.lg.setAttribute("data-far", far ? "1" : "0"); }
      /* ONE TRANSFORM STRING, TWO NODES, ONE CACHE — and the cache is what
         makes this the SECOND thing Paul asked for rather than a second bug.
         Before: the mark's translate was rewritten every frame and the name's
         absolute x/y were rewritten only on SETTLE, so a name stood still while
         its dot walked out from under it — measured mid-drag, Addis Ababa's
         name sat 71.0 px from its dot at 390x844 and 124.5 px at 1280x900,
         against 12.8 px at rest. Now both nodes take the same string on the
         same line: the drift is 0 px BY CONSTRUCTION, not by a second pass
         that has to be remembered. */
      const tr = "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ")";
      if (m.tr !== tr) { m.tr = tr;
        m.g.setAttribute("transform", tr); m.lg.setAttribute("transform", tr); }
      /* THE NAME AND THE TAB ORDER ARE SETTLED BEFORE THE HEMISPHERE IS, and
         that order matters: a mark's tabindex depends on the YEAR and not on
         which side of the earth it is on, so skipping it for far-side marks
         would leave a Tokyo mark carrying the tab state of whatever year it was
         last visible in. These three writes are guarded by the cache and only
         move when the slider does. */
      /* THE TAB ORDER IS THE DRAWN SET, EXACTLY — which is the simplification
         Paul's sentence bought. It used to be two sets: 19 marks tabbable at
         1969 and 43 more drawn-but-not-tabbable, each carrying
         `tabindex="-1"` and a name ending "(nothing near 1969)" so that Tab
         would not lie about what Enter would write. With the ghosts gone there
         is nothing left to tell the truth ABOUT: what you can see is what you
         can Tab to is what the sentence counts. ON EITHER HEMISPHERE — being
         on the far side is still not one of the reasons a mark leaves the tab
         order (that is `far` below, and it is why the far side is opacity and
         not display). No roving tabindex and no arrow-key grid: a second
         navigation model nested inside the first is what screen-reader users
         hate. */
      if (m.ti !== "0") { m.ti = "0"; m.g.setAttribute("tabindex", "0"); }
      /* THE NAME IS THE RECORD, and WITHIN earns its keep in it: "Greenwich
         Village, in New York 1964, folkduo". THE "(nothing near 600)" SUFFIX IS
         DELETED and this is its tombstone — it was the honest label for a mark
         that should not have been drawn, and it is what Paul read on the
         deployed page when he wrote "Don't show ghost genres when the time
         isn't right". A mark that exists only where its record does needs no
         disclaimer. */
      const lab = name + (WITHIN[name] ? ", in " + WITHIN[name] : "")
        + " " + yearWord(r.year) + ", " + r.gk;
      if (m.lab !== lab) { m.lab = lab; m.g.setAttribute("aria-label", lab); }
      /* AND THE GENRE NAME IS PRINTED — the one the TAP WOULD PICK, never a
         pile. `r` is `shown.get(name)`, which atlas.js built from recordAt():
         nearest year, tie to the earlier. That is the same object `choose()`
         reads to decide what Enter and a thumb write, and the same one the
         accessible name above is built from, so the ink under the dot, the
         name a screen reader speaks and the record that plays are one fact
         resolved once. Kingston at 1971 says "reggae" and not "reggae / dub",
         because 1969 is two years away and 1973 is four.
         THE NAME IS THE ANCHOR KEY. genres.js has one string for a record and
         it is `label` — "Kingston 1969", a place and a year, which is what the
         dot and the slider are already saying. The key IS the genre's name on
         this page: it is what #atlasSay prints after the middot, what the
         aria-label above ends with, and what pick()'s refusal names. A second,
         prettier spelling invented here would be a second owner of what a
         genre is called. */
      if (m.gn !== r.gk) { m.gn = r.gk; m.t2.textContent = r.gk; }
      const cur = here && r.gk === here ? "true" : "false";
      if (m.cur !== cur) { m.cur = cur; m.g.setAttribute("aria-current", cur); }
      // a mark behind the earth cannot be seen, so nothing about its INK is
      // written — but it is still named, still in the tab order, and still one
      // focus away from turning the earth to it.
      if (far) { if (m.ringOn !== "0") { m.ringOn = "0"; m.ring.setAttribute("opacity", "0"); } continue; }
      /* PLACES DIM TOWARD THE LIMB: the cosine of the angle from the sub-point
         IS the foreshortening, so the depth cue costs nothing.

         AND THE YEAR ITSELF IS STILL SAID IN INK, which is the half of the old
         two-tier picture worth keeping. It used to separate IN THE WINDOW (1.0)
         from OUTSIDE IT (0.34) and outside-it is now not drawn; so the tier
         moves in one year, to the distinction the sentence still makes: a
         record made THIS YEAR is full ink, one made within ten years is 0.62.
         That is what gives a dragging thumb something to watch — every one of
         these dots is real and pressable, so it is emphasis and not a ghost. */
      const op = ((r.year === Y ? 1 : 0.62)
        * (0.45 + 0.55 * Math.max(0, p.z))).toFixed(2);
      if (m.op !== op) { m.op = op; m.dot.setAttribute("fill-opacity", op); }
      // ONE INK FOR EVERY DOT (see the ring above for the measurement). The
      // slider's window is said by OPACITY and by SIZE, which is what a black
      // and white picture has to say it with anyway.
      if (m.fill !== "CanvasText") { m.fill = "CanvasText"; m.dot.setAttribute("fill", "CanvasText"); }
      if (m.dr !== dotR) { m.dr = dotR; m.dot.setAttribute("r", dotR);
        m.hit.setAttribute("r", hitR);
        m.ring.setAttribute("r", ringR); m.ring.setAttribute("stroke-width", ringW); }
      /* THE RING HAS THREE STRENGTHS NOW AND STILL ONE SHAPE (2026-08-29).
         Paul: *"As I slide it light up the map with places."* The ring was a
         boolean — the record on the page wore it, nothing else did. A place
         whose ROW is on the screen in the genre list wears the same ring at
         0.45, which is the whole of "light up": one vocabulary, two
         intensities, no second picture and no colour (the standing law: "keep
         it black and white"). `here` still wins outright, so the record you
         are playing never dims because you scrolled past it, and a mark the
         year does not hold has no ring at all because it has no mark.
         IT IS A STRING IN THE CACHE, not a boolean, for the reason every other
         value in this loop is cached as the string it will be written as:
         `setAttribute` with an identical string is not free, and comparing the
         written form is what makes "write only what changed" exact. */
      const ringOn = (here && r.gk === here) ? "1" : (lit.has(name) ? "0.45" : "0");
      if (m.ringOn !== ringOn) { m.ringOn = ringOn; m.ring.setAttribute("opacity", ringOn); }
      /* WHERE THE NAME SITS BESIDE ITS DOT IS A ZOOM QUESTION, NOT A TURN ONE,
         so it is written HERE, under the same cache the radii use, and not in
         the settle pass. The gap and the type size are stated in CSS px and
         converted through the renderer's units-per-pixel, exactly like the tap
         box — which is what makes a PINCH keep the pairing: `u` and `dotR` move
         under a pinch, `p.x`/`p.y` move under a drag, and the label tracks both
         without either loop knowing about the other. (The pinch handler never
         set labelsStale, so under the old absolute-coordinate labels a pinch
         moved the dots and left the names where they were.)

         THE RINGED MARK'S NAME CLEARS ITS RING — 13 = 9 + 4, so the ringed name
         keeps exactly the gap every other name has. Seen at 600, where there is
         one place on the earth and it is the record the page is playing: the
         ring is drawn at the dot's radius plus 9 CSS px and the name started at
         the dot's radius plus 4, so the "R" of "Rome" sat under the ring's
         stroke, on the one mark a reader is most likely to be reading. */
      /* AND A NAME THAT WOULD RUN OFF THE RIGHT EDGE IS MIRRORED TO THE LEFT
         OF ITS DOT. MEASURED at 390x844 with the second line in: at 180
         degrees of arc, 1969, Tehran, Addis Ababa and Johannesburg all sit
         near the eastern limb and both of their lines were CUT by the viewBox
         — "Johanne", "mbaqan". A clipped word is not a label, it is a
         typographic error the reader has to guess at, and the genre line
         doubled the number of them.

         THE WIDTH IS ESTIMATED, NOT MEASURED, AND THAT IS DELIBERATE. The
         honest measurement is getBBox(), which forces a layout of the SVG —
         once per drawn mark, inside a frame that has to fit beside an audio
         worklet, and this file's whole budget is "write only what changed".
         0.58 em per character over the LONGER of the two lines is an upper
         bound for the page's sans at both sizes (checked against the widest
         real pair, "Greenwich Village" / "singersongwriter"), and being a
         little pessimistic only means a name flips a few pixels earlier than
         it strictly had to, which costs nothing and never clips.

         IT IS A FACT ABOUT THE POSE, so it rides in `lk` with the rest: a mark
         that crosses the flip line during a drag rewrites five attributes on
         the one frame it crosses, and nothing on the others. */
      const wide = Math.max(name.length * LABEL_PX,
                            (r.gk || "").length * GENRE_PX) * 0.58 * u;
      /* THE NAME STANDS CLEAR OF THE RING, AND `here` IS THE ONLY RING THAT
         PUSHES IT (2026-08-29). `ringOn` is a string of three values now, and
         a string is truthy even when it says "0" — so the two readers that
         asked it a yes/no question ask `isHere` instead. It is deliberately
         `here` and not `here || lit`: the label gap and the label PRIORITY
         belong to the one record the page is playing, and a scroll of the
         genre list must not be able to re-sort the names on the map under a
         reader's eye. A lit ring is a hint; the played ring is the fact. */
      const isHere = !!(here && r.gk === here);
      const gap = (isHere ? 13 : 4) * u;
      const flip = (p.x + +dotR + gap + wide) > VBW - 4 * u
                && (p.x - +dotR - gap - wide) > 4 * u;
      const lx = flip ? -(+dotR + gap) : +dotR + gap, ly = 4 * u;
      const lk = lx.toFixed(1) + "|" + u.toFixed(3) + "|" + (flip ? "e" : "s");
      if (m.lk !== lk) { m.lk = lk;
        /* `text-anchor` and not a second x per line: one attribute says "this
           block is right-aligned" and both lines obey it, so the two can never
           end up ragged against each other. */
        const an = flip ? "end" : "start";
        m.t.setAttribute("text-anchor", an); m.t2.setAttribute("text-anchor", an);
        m.t.setAttribute("x", lx.toFixed(1)); m.t.setAttribute("y", ly.toFixed(1));
        m.t.setAttribute("font-size", (LABEL_PX * u).toFixed(1));
        /* THE SECOND LINE TAKES THE SAME x AND THE SAME CACHE. Left-aligned
           with the place name — a centred pair would need the rendered width
           of two strings every frame, which is a getBBox() per mark per zoom
           and the one measurement this file refuses to take inside a frame.
           Its y is the first line's plus GENRE_DY, in CSS px through `u`, so a
           pinch keeps the leading exactly as it keeps the gap to the dot. */
        m.t2.setAttribute("x", lx.toFixed(1));
        m.t2.setAttribute("y", (ly + GENRE_DY * u).toFixed(1));
        m.t2.setAttribute("font-size", (GENRE_PX * u).toFixed(1));
        m.t2.setAttribute("stroke-width", (GENRE_HALO_PX * u).toFixed(2));
        /* THE HALO IS A STROKE UNDER THE FILL (paint-order, nu.css), AND ITS
           WIDTH HAS TO BE SAID HERE and not there: a stroke-width in a
           stylesheet is in USER units, and this viewBox is 1000 units across
           whatever the column happens to be. See HALO_PX for the two measured
           numbers — 2.6 units renders 0.95 CSS px on the phone and 3.27 on the
           desktop, and through `u` it is 2.60 on both. */
        m.t.setAttribute("stroke-width", (HALO_PX * u).toFixed(2)); }
      cand.push({ name, x: p.x, y: p.y, dx: lx, dy: ly, z: p.z, ring: isHere });
    }
    /* AND THE LABEL PASS WAITS FOR THE MOTION TO STOP (2026-08-29). This read
       `if (labelsStale)`, which was exact while the only writers of that flag
       were the ends of things — pointerup, the glide's last frame, the flight
       landing, a tick of the year slider. The list's `sweep()` moves the YEAR
       on every frame of a scroll, and a year change is one of those writers,
       so the greedy level-of-detail sort ran inside every frame of a flick:
       MEASURED, 24.7 ms p50 against an idle rAF control of 16.6, worst frame
       62.9. The rule the old code kept by ACCIDENT is now stated: the names
       are inked when the picture is still. Nothing else changes — a drag, a
       glide and a flight all cleared the flag at their own end already, and
       `sweeping` clears 120 ms after the last scroll event. */
    if (labelsStale && !moving) { labels(cand, u); labelsStale = false; }
  }

  /* THE GREEDY LEVEL-OF-DETAIL PASS, RUN ON SETTLE ONLY (pointerup, glide end,
     flyTo end, year change) — never under a moving thumb, where it would cost a
     sort and a rectangle test per mark, every frame, for names nobody can read.
     main:app/map/draw.js:44 is the prior art. Input order is deterministic (the
     screen-space z, then the name), so the same pose always draws the same
     names, and a name is drawn only if no already-drawn box is within LOD_X in
     x and LOD_Y in y. EVERY DRAWN MARK IS A CANDIDATE NOW — this said "NO NAME
     FOR A PLACE WITH NOTHING IN THE WINDOW: the typography IS the year filter,
     which is what lets the dots stay put", and the dots no longer stay put, so
     the typography is no longer carrying the filter on its own (Paul: "Just
     show genres that align with time"). What is left is honest crowding: at 27
     places in the window some names still lose to their neighbours, and the
     mark is always there to press whether its name got drawn or not. */
  function labels(cand, u) {
    /* THE RINGED MARK GOES FIRST, and that is this round's answer to the
       crowding question. Paul, 2026-08-25, offered "you could hide them" as
       acceptable and asked for the moving version instead, so hiding SOME is
       within what he asked for and hiding all is not — and the honest way to
       choose WHICH is by what the reader is most likely to be looking at.
       MEASURED at 390x844, 1969: the closest pairs of marks on the whole earth
       are Greenwich Village/New York 0.1 CSS px apart, London/Muswell Hill 0.2,
       San Francisco/Sausalito 0.3, Liverpool/Manchester 1.0 — piles, not
       neighbours, and the 46 x 14 box below can only keep one name out of each.
       Before this line the winner was whichever sat nearest the sub-point,
       which is a fact about the CAMERA. The ringed mark is the record the page
       is PLAYING. It now wins its neighbourhood at every zoom, and everyone
       else is still sorted by screen-space z and then by name, so the same pose
       still draws the same names — the pass stays a pure function of the pose.

       AND THE REST OF THE CROWDING IS ANSWERED BY ZOOM, which is why hiding
       some is not hiding them. The box is in CSS px and the dots separate as
       `arc` closes, so the map thins itself: measured at 390x844, names inked
       of 22 near-side marks — 7 at 180 degrees of arc, 12 at 60, 16 at 20, 19
       at 2. */
    cand.sort((a, b) => (b.ring ? 1 : 0) - (a.ring ? 1 : 0)
                     || b.z - a.z || (a.name < b.name ? -1 : 1));
    const put = [];
    for (const name of NAMES) {
      mark[name].t.setAttribute("opacity", "0");
      mark[name].t2.setAttribute("opacity", "0");
    }
    for (const c of cand) {
      /* THE COLLISION TEST IS STILL IN SCREEN SPACE — it has to be, it is about
         what an eye can separate — but the number WRITTEN is now the opacity
         alone. Where the name goes is paint()'s business and it is already
         written; this pass only says whether it is inked. That split is what
         lets it stay on SETTLE while the pairing holds every frame: running the
         sort and the O(n²) box test under a moving thumb would also make the
         chosen set flicker, because the z-order changes as the earth turns and
         a greedy pass would hand the neighbourhood to a different name every
         few frames. */
      const tx = c.x + c.dx, ty = c.y + c.dy;
      if (put.some((q) => Math.abs(q.x - tx) < LOD_X * u && Math.abs(q.y - ty) < LOD_Y * u))
        continue;
      put.push({ x: tx, y: ty });
      /* ONE OPACITY, WRITTEN TWICE, DECIDED ONCE (2026-08-28). The place line
         and the genre line under it are one block: they are inked together or
         not at all, because a genre name with no place over it is a word
         floating on an ocean and a place name with the genre missing is the
         thing Paul asked for going quietly absent. The box the greedy pass
         reserves grew to hold both (LOD_Y, 14 -> 26). */
      const ink = (0.35 + 0.65 * c.z).toFixed(2);
      mark[c.name].t.setAttribute("opacity", ink);
      mark[c.name].t2.setAttribute("opacity", ink);
    }
  }

  /* ---------- THE LOOP, AND THE IDLE GUARANTEE (constraint 4) -----------
     requestAnimationFrame runs ONLY while a pointer is down, a glide is
     spending its budget, or a flyTo is in flight. NOTHING POLLS. An
     IntersectionObserver parks it when the section leaves the screen and sets a
     dirty flag that is spent on the frame it comes back; a ResizeObserver takes
     the refit the <details> toggle used to trigger, and does it for rotation and
     window drags too. The true steady state — the state a page spends 99% of its
     life in — is EXACTLY ZERO WORK, which is the only reason a render loop is
     allowed to sit beside a Faust worklet at all (main:app/starcruise.js:118 is
     what happens when it is not). */
  function need() {
    if (!onScreen) { dirty = true; return; }
    if (raf) return;
    raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0;
    const now = performance.now();
    if (glide && !dragging) {
      /* AND THE GLIDE DOES NOT RUN WHILE THE FINGER IS DOWN. Measured: it did,
         and it was applied ON TOP of the drag every frame — a 160 px flick moved
         191° instead of the 57 the finger asked for. */
      const want = Math.hypot(glide.dl, glide.dp);
      const spend = Math.min(want, glide.budget);
      const s = want ? spend / want : 0;
      const g = globe.get();
      globe.set({ lam0: g.lam0 + glide.dl * s, phi0: g.phi0 + glide.dp * s });
      glide.budget -= spend;
      glide.dl *= 0.86; glide.dp *= 0.86;
      if (glide.budget <= 0.01 || (Math.abs(glide.dl) < 0.05 && Math.abs(glide.dp) < 0.05)) {
        glide = null; labelsStale = true;
      }
    }
    if (fly) {
      const t = Math.min(1, (now - fly.t0) / fly.ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      globe.set({ lam0: fly.l0 + fly.dl * e, phi0: fly.p0 + fly.dp * e,
                  // ZOOM IS MULTIPLICATIVE, so the interpolation is GEOMETRIC.
                  // A linear ramp from 180° to 1° spends most of its time in
                  // the last two degrees and reads as a slam.
                  arc: fly.a0 * Math.pow(fly.a1 / fly.a0, e) });
      if (t >= 1) { fly = null; labelsStale = true; }
    }
    const moving = !!(fly || glide || dragging || sweeping);
    paint(moving);
    if (moving) raf = requestAnimationFrame(tick);
  }
  /* AND THE INDEX FOLLOWS THE RING. `syncIndex` is guarded on `here` (it does
     nothing while the value has not moved), so putting it on the one function
     every state change already ends in is cheaper than remembering to call it
     from pick(), showing(), open() and choose() separately — four callers is
     four chances to forget one, which is exactly how a list ends up marking a
     record the page stopped playing. */
  const redraw = () => { labelsStale = true; syncIndex(false); need(); };

  /* ---------- flyTo: the camera moves, and only if it has to ------------ */
  function flyTo(name, ms, wantArc) {
    if (dragging) return;                       // never fight a finger
    const c = PLACES[canon(name)]; if (!c) return;
    const g = globe.get();
    const dl = ((c[1] - g.lam0 + 540) % 360) - 180;   // the SHORT way round
    // latitude clamped so a European record never tips the globe onto its ear
    const dp = Math.max(-40, Math.min(55, c[0])) - g.phi0;
    const a1 = wantArc == null ? g.arc : Math.max(ARC_MIN, Math.min(ARC_MAX, wantArc));
    /* IT DOES NOT MOVE IF IT DOES NOT HAVE TO — the rule today's code already
       found the hard way: taking the smallest rectangle containing the place
       unconditionally meant boot on Rome 600 opened the page on Europe with 25
       of 62 dots drawn. Under 0.4° of turn and no zoom to do, nothing moves, and
       `arc` is left exactly where the reader put it. */
    if (Math.abs(dl) < 0.4 && Math.abs(dp) < 0.4 && Math.abs(a1 / g.arc - 1) < 0.01) return;
    // ...but "under 0.4 degrees" is a whole screen at city zoom, so the
    // threshold is a FRACTION OF WHAT YOU CAN SEE, not a constant: 0.4° of the
    // 180° whole earth is 0.2% of the frame, and that is the promise.
    if (Math.abs(dl) < g.arc * 0.0022 && Math.abs(dp) < g.arc * 0.0022
        && Math.abs(a1 / g.arc - 1) < 0.01) return;
    /* `to` SINCE 2026-08-29: WHERE THIS FLIGHT IS GOING, by name. `showing()`
       needs it — a flight already on its way to a place must not be replaced
       by a second flight to the same place at a different zoom (its own note
       carries the measurement). It is the canon name, which is the same key
       `shown`, `legible` and PLACES are all indexed by. */
    fly = { t0: performance.now(), ms, l0: g.lam0, p0: g.phi0, dl, dp, a0: g.arc,
            a1, to: canon(name) };
    glide = null;
    need();
  }
  /* IS THIS PLACE ALREADY LEGIBLE WHERE WE ARE STANDING? Near side, inside the
     box with a margin. It is what keeps showing() from yanking the camera on
     every document swap — and what keeps boot on the whole earth (G7). */
  function legible(name) {
    const c = canon(name); if (!UNITS[c]) return false;
    const p = globe.toScreen(UNITS[c]), g = globe.get();
    return p.z > 0.15 && p.x > 40 && p.x < g.VB - 40 && p.y > 40 && p.y < g.VH - 40;
  }

  /* ---------- the sentence, which is the globe in words -----------------
     AND IT NOW COUNTS THE DOTS, WHICH IS THE POINT. It read "1969 — the
     sixties — 2 records here, 32 in the decade around it: New York, London, …"
     and that was two numbers about RECORDS printed above a picture of PLACES —
     34 against 19 — with 43 further marks drawn that neither number counted.
     Paul read the picture, not the sentence: "Don't show ghost genres when the
     time isn't right."

     So the FIRST number is now the number of marks on the earth, because the
     sentence and the marks are the same fact and a reader has to be able to
     check one against the other by eye (test/atlas.js G22 checks it by
     machine, on the rendered page, at 600 / 1969 / the last stop). Both of
     Paul's original numbers survive behind it, in the clause that says what a
     place is doing there: made this year, or made within ten. */
  function sentence() {
    const Y = YEARS[yi], at = atNow;   // scope() ran first: see setYear()
    /* ORDERED BY HOW MUCH IS THERE, then by name — the six loudest places of
       the year, which is what a one-line summary of a map can carry. */
    const rows = [...at.places.entries()]
      .sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1));
    const six = rows.slice(0, 6).map((r) => r[0]);
    const more = rows.length - six.length;
    /* COMPRESSED 2026-08-27 per FUTURE.md §5's own example — it read
       "600 — the six-hundreds — 1 place on the globe: 1 record made this
       year, none more within ten years. Rome." and the row's target is
       "600 · 1 record within ten years · Rome" ("keep the data, drop the
       tour guide"). The data survives whole: the record count is exact+near
       (made this year + within ten), and the PLACE COUNT is still in the
       sentence as the list itself — six names plus "+N more" sums to
       at.places.size, which is what G22 (test/atlas.js) now parses to hold
       "the earth and the sentence are the same fact". The era word left with
       the dashes; eraOf stays exported by atlas.js for whoever needs an
       era's name. */
    const nR = at.exact.size + at.near.size;
    say.textContent = yearWord(Y) + " · " + nR + " record" + (nR === 1 ? "" : "s")
      + " within ten years · " + six.join(", ")
      + (more > 0 ? ", +" + more + " more" : "");
  }

  /* ---------- the tap that composes ------------------------------------ */
  /* `done` IS THE BAR'S PLAY GESTURE, AND IT IS A CALLBACK BECAUSE THIS IS NOT
     SYNCHRONOUS. The record is written on the SECOND frame (see the sentence
     below), so a caller that composed and then called startAt() on its own line
     would start the engine on the document it was trying to replace — and
     ctx.setDocument's own stop() would then kill it. Handed here, it runs after
     the swap and after the sentence, on the record that is actually on the
     page. A refusal never calls it: nothing was written, so nothing plays, and
     #atlasSay carries the one measured line. */
  function pick(gk, done) {
    const w = WHEN[gk];
    const where = w ? w.place + " " + yearWord(w.year) : gk;
    /* WHAT IT SAYS WHILE IT WORKS. genreToDocument is fast table work, but
       ctx.setDocument recompiles the whole song and redraws the whole page, and
       the staves land late on an abcjs promise. So the sentence paints FIRST and
       the work happens on the second frame — otherwise the only frame the
       browser renders is the finished one and the box looks frozen for half a
       second with no explanation. */
    say.textContent = where + " — writing the record…";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      let doc;
      try { doc = NuPrecompose.genreToDocument(gk, seed); }
      catch (e) {
        // NAMED, NOT SWALLOWED. The page keeps the record it had; the sentence
        // says which genre this box cannot write yet and why.
        say.textContent = "this box cannot write a " + gk + " yet — " + e.message;
        return;
      }
      here = gk;
      ctx.setDocument(doc);
      redraw();
      say.textContent = where + " · " + gk + " — " + doc.form.sections.length
        + " sections, " + doc.voices.length + " voices, take "
        + doc.performance.take
        // `take` is a field of the document and a REWRITE does not move it —
        // it moves the SEED, which is what makes a second reading of the same
        // anchor a different record. (The .nu-bar has both buttons since
        // 2026-08-27: "take" bumps that field, "rewrite" bumps this seed.)
        + (seed > 1 ? " · reading " + seed : "") + ".";
      /* THE SEED MOVED EVEN WHEN THE YEAR DID NOT. `setYear` announces most of
         this, through `showing()`; a rewrite of a ROLE genre never reaches it
         (`showing` returns early — "a role has a job, not a history"), and a
         rewrite of the same anchor lands on the same year. So the write that
         actually changed the record says so itself. */
      moved();
      if (done) done();
    }));
  }

  /* ---------- reseed(gk, done): the bar's "rewrite", from here ----------
     A DIFFERENT RECORD, SAME ANCHOR. genreToDocument is deterministic in
     (gk, seed), so the only way to a second version is a second seed — which
     is the sentence the deleted #atlasAgain listener carried, kept verbatim
     because the code under it did not change, only its caller.
     `gk` DEFAULTS TO THE RING and the bar hands it `DOC.basis`: a role genre
     has no place on the map (genres.js: "a role has a job, not a history"), so
     `here` is null for one and the bar would be refused for a record it can
     perfectly well rewrite. Returns false when there is nothing to rewrite,
     and says why. */
  function reseed(gk, done) {
    const target = gk || here;
    if (!target) {
      say.textContent = "pick a place first, then this writes it again.";
      return false;
    }
    seed++;
    pick(target, done);
    return true;
  }

  /* ONE TAP, ONE RECORD — consequence C, at the point of use. The place plus the
     slider's year is a record (atlas.js recordAt: nearest year, tie to the
     earlier). AND TAPPING THE MARK YOU ARE ALREADY ON BUMPS THE SEED: press it
     again to hear it again, without hunting for a control, and #atlasSay prints
     "· reading 2" so the effect is visible. */
  /* THE PAGE'S PLAY DOOR, HANDED IN (2026-08-29). Paul: *"When I tap a place
     start playing and zoom in the map on that place."* This file owns the
     globe and knows nothing about a transport; `ctx.play` is ui/eight.js's
     `startNow`, which is #play's own path, so a tap on a mark reaches the
     engine through the ONE door the button uses and not through a second one.
     Optional, like `ctx.moved`: the atlas mounts in gates and in the daw with
     a ctx that has never heard of a transport, and a missing hook is a map
     that composes without sounding, exactly as it did yesterday. */
  const playNow = () => { try { if (ctx && ctx.play) ctx.play(); } catch (e) {} };

  function choose(name) {
    /* THE YEAR'S OWN MAP, NOT recordAt() — one owner for what is here. A mark
       the year does not hold is `display: none`, so no pointer and no key can
       reach this with a name that is not in it; the guard is what keeps that a
       fact rather than an assumption. */
    const r = shown.get(name);
    if (!r) { say.textContent = name + " — no record here at " + YEARS[yi] + "."; return; }
    if (here === r.gk) seed++;
    /* AND THE CAMERA ARRIVES RATHER THAN TURNING (2026-08-29). Paul: *"When I
       tap a place start playing and zoom in the map on that place."*

       IT WAS `flyTo(name, 300, null)` — a turn with `null` for the arc, which
       is `flyTo`'s own word for "leave the zoom exactly where the reader put
       it". That was right while the globe was the only instrument and a tap
       was a way of steering it; it is wrong now that a tap is how you ARRIVE
       somewhere, because arriving at the whole earth is standing 180 degrees
       away from the thing you pressed.

       THE ARC IS `arcFor(place)`, CAPPED AT `ARRIVE` — and both halves are
       facts this file did not have to invent. atlas.js §4 VIEWS exists
       precisely to answer "how close to stand to this place, in degrees", and
       it is the number `showing()` already flies to after every document swap.
       But VIEWS answers with a REGION: Manchester's smallest rectangle is 11
       degrees and you land reading Britain, while Kingston's is 64 — measured
       — and 64 degrees of arc is a third of the earth, which is not what
       anybody means by "zoom in on that place". So the arrival is the tighter
       of the two.

       `ARRIVE` IS 20 AND IT IS THIS FILE'S OWN EXISTING NUMBER. LOD_X/LOD_Y's
       note calls 20 degrees "the zoom at which you are reading one city", and
       `paint()`'s tap box reaches its maximum (HIT_MAX, 23 CSS px against 15
       at the whole earth) at exactly `arc <= 20`. So arriving means the mark
       you pressed is centred AND at its largest target, by the page's own
       arithmetic rather than by a number invented for this sentence.

       IT DIVERGES FROM `showing()` ON PURPOSE, AND THEY DO NOT FIGHT.
       `showing()` asks a different question — "is the record the page is
       playing visible from where the reader is standing?" — and it declines to
       move the camera at all when the answer is yes (`legible`). After this
       flight the place is dead centre, so `showing()`, which runs a moment
       later on the document swap, sees a legible place and leaves the camera
       exactly where the tap put it. Measured: arc 180 -> 20, and the second
       call moves it 0 degrees.

       `flyTo` REFUSES A MOVE IT DOES NOT NEED — under a fraction of a frame of
       turn AND under 1% of arc, nothing happens — so pressing the mark you are
       already standing on does not jitter the camera; it bumps the seed
       (above) and writes the record again. */
    flyTo(name, 300, Math.min(arcFor(name), ARRIVE));
    /* AND IT PLAYS. `pick`'s second argument is its `done` callback and it is
       the ONLY safe place to start the engine: the record lands on the second
       frame, so a caller that started the transport on its own line would
       start it on the document it was about to replace and `setDocument`'s own
       `stop()` would kill it. A refusal never gets here — nothing was written,
       so nothing plays. */
    pick(r.gk, playNow);
  }

  /* ---------- gestures -------------------------------------------------
     ONE FINGER: the exact screen-to-sphere inverse (ui/globe.js fromScreen).
     The point you grabbed stays under your finger, with no gain constant
     anywhere, because the gain falls out of the projection. Each move re-solves
     against the CURRENT camera rather than accumulating, so the error is
     second-order per frame and self-correcting rather than drifting.
     TWO FINGERS: the scale is arc0 * d0 / d, and THE POINT UNDER THE MIDPOINT OF
     THE TWO FINGERS IS HELD THERE (`holdUnder`) — which is the same law as the
     one finger above, and it does the panning too. It used to pan by how far the
     CENTROID travelled, and a symmetric spread does not move the centroid, so
     the zoom happened about the middle of the box; the measurement that killed
     that is on `holdUnder`.
     WHEEL: exp(deltaY * 0.0022), deltaMode normalised, and it holds the point
     under the CURSOR the same way. ctrlKey is how a trackpad pinch arrives, and
     it takes a bigger gain.
     KEYBOARD: +/- zoom by 1.6 a press, arrows turn and tilt.
     NO ON-SCREEN ± BUTTONS. Paul: "Get rid of all ux for navigating except for
     the 'when' slider … and the 3d globe." A pair of buttons is UX for
     navigating; +/- on the keyboard is the accessible route and G17's
     zoom check drives it. */
  const ptr = new Map();
  // where each pointer went DOWN, kept separately from `tap` because `tap` is
  // cleared by distance and the 8px lock still needs the origin afterwards
  const downAt = new Map();
  let tap = null, grab = null, pinch = null, axis = null, poseAtDown = null;

  const toVB = (e) => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return null;
    const s = globe.get().VB / rect.width;
    return { x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s };
  };

  /* THE POINT UNDER YOUR FINGERS STAYS UNDER YOUR FINGERS — the one law the
     pinch and the wheel now share, and the correction of the round's one real
     defect (GLOBE.md, "Read this first: the one thing that is wrong").

     WHAT IT WAS: the pinch panned by how far the CENTROID of the two fingers
     travelled, and a symmetric spread does not move the centroid at all, so the
     zoom happened about the middle of the box wherever the fingers were.
     MEASURED at 390x844 with a real CDP touch stream: Provence sitting 99.7 px
     from the middle of the box was 30.4 px off the fingers after one 1.8x pinch
     and 83.8 px off after two — above the top edge of the box altogether — so
     "drag the cluster near, pinch in, tap the one you want" could not be
     finished, which is the whole reason to have zoom. The same three pinches
     now: 0.1 px, 0.0 px, 0.0 px. The wheel had the same hole from the other end
     and it is fixed the same way; its measurement is on the handler.

     HOW IT WORKS, and it is the ONE-FINGER DRAG'S OWN ARITHMETIC rather than a
     second answer: read the sphere point under the screen point BEFORE the scale
     changes (`under`), change the scale, then turn the camera until that same
     sphere point is back under that same screen point (`holdUnder`). Solving
     against the CURRENT camera each pass makes the error second-order, exactly
     as the drag's comment says, so it converges instead of drifting.

     TWO PASSES, MEASURED, NOT GUESSED. The hard case is a FAST pinch — a thumb
     that spreads in one flick delivers very few pointermoves, so each one
     carries a big jump. Three 2.6x pinches of two move events each, about a mark
     99.7 px off centre, total drift: one pass 3.37 px, two passes 0.15 px, three
     passes 0.15 px. (A leisurely 1.8x pinch of eight moves: 0.9 / 0.1 / 0.1.)
     The second pass buys everything; the third buys nothing, because splitting
     the rotation into a longitude step and a latitude step is exact in the limit
     and the residual is already far under a thumb's own aim. The exit test is
     stated as a fraction of `arc` rather than in absolute degrees so that it
     means the same thing at 180 degrees and at 0.5 — the same number measured
     either way, and only the deep end would ever have told them apart. */
  const under = (cx, cy) => {
    const v = toVB({ clientX: cx, clientY: cy });
    return v ? globe.fromScreen(v.x, v.y) : null;
  };
  const HOLD_PASSES = 2;
  function holdUnder(at, cx, cy) {
    if (!at) return;                       // the fingers were off the limb
    const v = toVB({ clientX: cx, clientY: cy }); if (!v) return;
    for (let i = 0; i < HOLD_PASSES; i++) {
      const now = globe.fromScreen(v.x, v.y);
      if (!now) return;                    // the anchor swung off the limb
      const g = globe.get();
      const dl = ((at.lon - now.lon + 540) % 360) - 180, dp = at.lat - now.lat;
      globe.set({ lam0: g.lam0 + dl, phi0: g.phi0 + dp });
      if (Math.abs(dl) + Math.abs(dp) < g.arc * 1e-4) return;
    }
  }

  svg.addEventListener("pointerdown", (e) => {
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size === 1) {
      const g = globe.get();
      poseAtDown = { lam0: g.lam0, phi0: g.phi0, arc: g.arc };
      tap = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      // A MOUSE OR A PEN HAS NO PAGE SCROLL TO LOSE, so it starts committed;
      // a touch waits for the 8 px lock to say whose the gesture is.
      axis = e.pointerType === "touch" ? null : "both";
      const v = toVB(e);
      grab = v ? globe.fromScreen(v.x, v.y) : null;
      dragging = true; glide = null; fly = null;
      if (e.pointerType !== "touch") { try { svg.setPointerCapture(e.pointerId); } catch (er) {} }
      need();
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()];
      const g = globe.get();
      /* `at` IS THE PINCH'S `grab`: the sphere point under the midpoint of the
         two fingers, held there for the life of the gesture, so a spread zooms
         about it and a two-finger slide carries it along. It replaces the
         centroid pan (cx, cy, lam0, phi0), which is deleted rather than kept
         beside it — two answers to "where is the camera" is how the box centre
         won over the fingers in the first place. */
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, arc: g.arc,
                at: under((a.x + b.x) / 2, (a.y + b.y) / 2) };
      axis = "both"; tap = null; grab = null;
    }
  });

  svg.addEventListener("pointermove", (e) => {
    if (!ptr.has(e.pointerId)) return;
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_MOVE) tap = null;

    if (ptr.size >= 2 && pinch) {
      const [a, b] = [...ptr.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // the scale stays ABSOLUTE against the pinch's own first spread — a
      // per-frame ratio would compound its own rounding over a long gesture —
      // and the anchor does all the panning, both axes, including the case the
      // old code could not see: two fingers moving together with no spread.
      if (!pinch.at) pinch.at = under(mx, my);   // they started off the limb
      globe.set({ arc: pinch.arc * pinch.d / d });
      holdUnder(pinch.at, mx, my);
      e.preventDefault(); need(); return;
    }

    if (axis === null) {
      // THE FIRST 8 px DECIDE, AND THEY DECIDE BY ANGLE — see LOCK_DEG at the
      // head of this file for the sweep that moved the line from 45 degrees to
      // 25. Within LOCK_DEG of vertical the page is scrolling and this pointer
      // is dead to us for its whole life, because two things cannot have the
      // gesture; everything else is the globe's, both axes live.
      const o = downAt.get(e.pointerId) || { x: e.clientX, y: e.clientY };
      const dx = Math.abs(e.clientX - o.x), dy = Math.abs(e.clientY - o.y);
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      axis = dy > dx * PAGE_TAN ? "page" : "both";
      if (axis === "page") { dragging = false; grab = null; return; }
    }
    if (axis !== "both" || !grab) return;

    const v = toVB(e); if (!v) return;
    const now = globe.fromScreen(v.x, v.y);
    if (!now) return;                 // the finger is off the limb: nothing to solve
    const g = globe.get();
    const dl = ((grab.lon - now.lon + 540) % 360) - 180;
    const dp = grab.lat - now.lat;
    globe.set({ lam0: g.lam0 + dl, phi0: g.phi0 + dp });
    glide = { dl: Math.max(-6, Math.min(6, dl)), dp: Math.max(-6, Math.min(6, dp)),
              budget: GLIDE_DEG };
    e.preventDefault();
    need();
  });
  function endPtr(e) {
    ptr.delete(e.pointerId); downAt.delete(e.pointerId);
    if (ptr.size < 2) pinch = null;
    if (ptr.size) return;
    dragging = false;
    const t0 = tap; tap = null; grab = null; axis = null; poseAtDown = null;
    if (glide && Math.hypot(glide.dl, glide.dp) < 0.15) glide = null;
    /* AND IT FIRES ON pointerUP, NOT pointerDOWN — see TAP_MOVE at the head of
       this file for the measurement that forced it. */
    if (t0 && t0.id === e.pointerId
        && Math.hypot(e.clientX - t0.x, e.clientY - t0.y) <= TAP_MOVE
        && performance.now() - t0.t <= TAP_MS) {
      glide = null;
      const n = nearest(e);
      if (n) choose(n);
    }
    labelsStale = true;
    need();
  }
  /* AND THE `touchmove` IS THE ONE THAT HAS TO SAY NO — the half of the loosened
     lock that the lock alone could not deliver, and it was found by measuring
     rather than reasoned: with the JS rule opened to 25 degrees and nothing else
     changed, a straight 50, 55, 60 and 65 degree drag STILL turned the globe 0.0
     degrees and STILL scrolled the page 108-114 px. `e.preventDefault()` on a
     POINTERmove does not stop a touch scroll in Chromium; `touch-action: pan-y`
     had already handed the gesture to the compositor, on the browser's own
     45-degree line, before this file was ever consulted. (Which is also why the
     old `dx > dy` rule looked correct: it was agreeing with a decision the
     browser had already made.)

     So the pointer path decides WHOSE the gesture is, and this one line enforces
     it on the only event that can. It fires only when the lock has already said
     "both", so a swipe the page owns is never touched, and `e.cancelable` is
     checked because once a scroll is under way the browser stops asking. */
  svg.addEventListener("touchmove", (e) => {
    if (axis === "both" && e.cancelable) e.preventDefault();
  }, { passive: false });

  svg.addEventListener("pointerup", endPtr);
  /* pointercancel IS WHAT THE BROWSER SENDS WHEN IT TAKES THE GESTURE OVER FOR
     SCROLLING, so it abandons the tap AND RESTORES THE POSE recorded at
     pointerdown: a gesture the page took should leave the globe exactly where
     it found it, not half-turned. */
  svg.addEventListener("pointercancel", (e) => {
    ptr.delete(e.pointerId); downAt.delete(e.pointerId);
    pinch = null; tap = null; grab = null; axis = null;
    dragging = ptr.size > 0;
    glide = null;
    if (poseAtDown && !ptr.size) { globe.set(poseAtDown); poseAtDown = null; redraw(); }
  });

  /* NEAREST MARK IN SCREEN SPACE, NOT e.target. main:app/map/gestures.js:36-51:
     "computed in SCREEN space … independent of SVG z-order" — it is what makes a
     thumb forgiving. The near side only: a mark behind the earth is not under
     your finger no matter what its transform says.

     AND WHEN TWO MARKS ARE THE SAME PLACE TO A THUMB, THE YEAR DECIDES. This is
     the second half of consequence C, and it is here rather than in the paint
     order for the reason above. Measured at the whole earth on a 390px phone,
     Greenwich Village and New York are 0.1 CSS px apart — no aim can separate
     them — and picking by distance alone made the answer turn on the fourth
     decimal place of a projection. So: distance decides MEMBERSHIP, and among
     the marks a thumb could not have distinguished (within TIE_PX of the
     closest) the record NEAREST the slider's year wins, ties to the earlier
     year, then to the name. Nothing about aim is lost: at 20 px apart the tie
     window is not open and the mark you aimed at is the mark you get. */
  const TIE_PX = 4;
  function nearest(e) {
    const v = toVB(e); if (!v) return null;
    const g = globe.get(), Y = YEARS[yi];
    const slop = (HIT_MIN + (HIT_MAX - HIT_MIN)
      * Math.max(0, Math.min(1, (60 - g.arc) / 40))) * g.u;
    const near = [];
    for (const name of NAMES) {
      /* THE YEAR FILTERS THE HIT TEST TOO. nearest() picks in SCREEN space
         rather than from e.target (the prior art’s rule, quoted above), which
         means an undrawn mark is invisible to the eye and still under the
         thumb unless this line says otherwise — exactly the ghost with the
         picture taken away. */
      if (!shown.has(name)) continue;
      const p = globe.toScreen(UNITS[name]);
      if (p.z < 0) continue;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d <= slop) near.push({ name, d });
    }
    if (!near.length) return null;
    const d0 = Math.min(...near.map((q) => q.d));
    const tie = TIE_PX * g.u;
    const same = near.filter((q) => q.d <= d0 + tie);
    same.sort((a, b) => {
      const ra = shown.get(a.name), rb = shown.get(b.name);
      return Math.abs(ra.year - Y) - Math.abs(rb.year - Y)
          || ra.year - rb.year
          || (a.name < b.name ? -1 : 1);
    });
    return same[0].name;
  }

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    // deltaMode normalised: 0 = pixels, 1 = lines, 2 = pages.
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    /* AND IT ZOOMS TOWARD THE CURSOR, which it did not: this handler set `arc`
       and nothing else, so the wheel had the pinch's defect from the other end.
       MEASURED at 1280x900, the cursor put on Paris 100.9 px off the middle of
       the box and re-aimed on it every four notches, walking from the whole
       earth to the floor. BEFORE: 178.8 px away after four notches, 520.99 px
       after eight — and then the walk could not go on at all, because the place
       had left the box and there was nothing under the cursor to zoom (`arc`
       stuck at 6.9 degrees for the last three groups). AFTER: 0.71, 2.06, 0.89,
       0.40, 0.56 px, all the way down to 0.5 degrees of arc.

       WHAT IS LEFT IS AIM, NOT DRIFT, and it is worth knowing which. Eighteen
       notches in ONE burst without re-aiming end 41.6 px from the cursor, and
       SIX correction passes give the same 41.6 as two — so it is not the anchor
       slipping. At the whole earth one CSS px is about 35 km and a mark's
       transform is written to 0.1 viewBox units (0.013 degrees there), so the
       point under the cursor is not quite the point the mark is drawn at, and a
       360x zoom magnifies that gap. The point under the cursor does stay under
       the cursor; the CITY cannot, if you aimed at it from space. Re-aim and it
       resets, which is what the numbers above are. A per-burst anchor was tried
       — one point held for a run of notches — and dropped: 41.64 px against
       43.49, which is noise for two more pieces of state and a timer. */
    const at = under(e.clientX, e.clientY);
    globe.set({ arc: globe.get().arc * Math.exp(e.ctrlKey ? dy * 0.01 : dy * 0.0022) });
    holdUnder(at, e.clientX, e.clientY);
    redraw();
  }, { passive: false });

  /* THE MARK YOU ARE ON IS WHAT YOU ZOOM INTO. MEASURED, AND IT IS THE WHOLE
     KEYBOARD ZOOM STORY: with `+` zooming about the centre of the box, a
     keyboard user who tabbed to Kingston and pressed `+` twelve times arrived at
     0.6° of arc over the empty Atlantic — the camera was still pointed where it
     had been, because focus does not fly a mark that is already on screen and at
     the whole earth everything on the near side is. So a zoom while a mark has
     focus RECENTRES ON THAT MARK as it goes. There are no on-screen +/- buttons
     — Paul: "Get rid of all ux for navigating except for the 'when' slider …
     and the 3d globe", and a pair of buttons is UX for navigating — so `+`/`-`
     IS the accessible zoom, and it has to arrive somewhere. */
  let focused = null;
  /* AND A HELD KEY HAS TO ARRIVE TOO, WHICH IS THE HALF THE FIX ABOVE MISSED.
     MEASURED on the artifact, 2026-08-24, with the target read off
     `globe.get().arc`: Kingston focused, `+` pressed 40 times back to back — a
     held key at any OS repeat rate — took the camera from 180° of arc to 98.5°,
     and 12 presses at a 40 ms repeat reached 42.5° where 12 deliberate presses
     reach 15.7° or better. Each press was restarting a 160 ms flight from a pose
     that had not moved yet, so forty presses computed forty times the SAME
     destination. So a press that lands while a flight is in the air compounds on
     that flight's DESTINATION (`fly.a1`) and not on the frame underneath it.
     Deliberate presses are untouched: they arrive after the flight has ended,
     where `fly` is null and the destination IS the current arc. */
  const zoomBy = (f) => {
    const a = (fly ? fly.a1 : globe.get().arc) * f;
    if (focused) flyTo(focused, 160, a);
    else { globe.set({ arc: a }); redraw(); }
  };
  svg.addEventListener("keydown", (e) => {
    const s = e.shiftKey ? 10 : 3, g = globe.get();
    if (e.key === "+" || e.key === "=") { zoomBy(1 / 1.6); e.preventDefault(); return; }
    if (e.key === "-" || e.key === "_") { zoomBy(1.6); e.preventDefault(); return; }
    if (e.target !== svg) return;      // an arrow on a MARK belongs to the page
    if (e.key === "ArrowLeft") { globe.set({ lam0: g.lam0 - s }); redraw(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { globe.set({ lam0: g.lam0 + s }); redraw(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { globe.set({ phi0: g.phi0 + s }); redraw(); e.preventDefault(); }
    else if (e.key === "ArrowDown") { globe.set({ phi0: g.phi0 - s }); redraw(); e.preventDefault(); }
  });

  gMarks.addEventListener("keydown", (e) => {
    const g = e.target.closest ? e.target.closest(".place") : null;
    if (!g || !g.dataset.place) return;
    if (e.key === "Enter" || e.key === " ") { choose(g.dataset.place); e.preventDefault(); }
  });
  /* FOCUS FLIES THE CAMERA, and that is what makes the tab order the spatial
     navigation now that "look at" is gone. A mark stays focusable on either
     hemisphere; focusing one on the far side turns the earth to it. */
  gMarks.addEventListener("focusin", (e) => {
    const g = e.target.closest ? e.target.closest(".place") : null;
    if (!g || !g.dataset.place) return;
    focused = g.dataset.place;
    if (!legible(focused)) flyTo(focused, 280, null);
  });
  gMarks.addEventListener("focusout", (e) => {
    // only when focus leaves the mark layer altogether; Tab from one mark to
    // the next fires focusout before the next focusin
    if (!e.relatedTarget || !e.relatedTarget.closest
        || !e.relatedTarget.closest("#atlasMarks")) focused = null;
  });

  /* ---------- the wiring ------------------------------------------------ */
  function setYear(i) {
    yi = Math.max(0, Math.min(YEARS.length - 1, i | 0));
    /* `year.value = String(yi); yOut.textContent = String(YEARS[yi]);` STOOD
       HERE and went with the slider (2026-08-29). The year is state, not a
       control, and its READOUT is `sentence()` below — "1969 · 32 records
       within ten years · New York, London, …", which begins with the year and
       is on the screen above the globe at every moment. One owner, one place
       it is printed, and no widget to keep in step. */
    /* AND THE YEAR IS DECLARED ON THE ARTIFACT (2026-08-29). `#atlasMap`
       already carries `data-arc` — how far away the camera is standing — for
       exactly this reason: a gate reads what the page SAYS about itself rather
       than reverse-engineering it. The year used to have a control with a
       `<output>` beside it, and every gate read that; with the slider gone the
       only printed year is inside #atlasSay's sentence, which pick() OVERWRITES
       with the record's own line ("Kingston 1969 · reggae — 13 sections…").
       Measured: two checks in test/atlas.js parsed "Kingston" as a year off
       exactly that. So the fact is published where the other fact about what
       the globe is showing already lives. It is written by `setYear` and by
       nothing else — one owner, one writer. */
    svg.dataset.year = String(YEARS[yi]);
    /* SCOPE FIRST, THEN SAY IT, THEN DRAW IT — in that order, because all
       three are the same fact and the sentence must never be able to describe a
       set the next paint has not adopted yet. */
    scope();
    sentence();
    redraw();
    /* AND THE ADDRESS FOLLOWS THE SLIDER. Every path that moves the year ends
       here — the slider's own `input`, `showing()` after a document swap, and
       `open()` landing a link — so this is the one line that has to say so.
       ui/eight.js debounces it; dragging the slider does not hammer the
       history API (Safari throttles `replaceState` and starts refusing). */
    moved();
  }
  /* (`year.addEventListener("input", () => setYear(+year.value))` stood here.
     The list's `sweep()` is that listener now, and it is the only gesture that
     moves the year without naming a record.) */

  /* ---------- showing(gk): the handle §2.2 names ------------------------ */
  function showing(gk) {
    here = WHEN[gk] ? gk : null;
    if (!WHEN[gk]) {
      // A ROLE IS NOT A CITY, and that is not an error (genres.js:306: "a role
      // has a job, not a history"). Clear the ring and say so.
      redraw();
      say.textContent = EXCLUDE[gk]
        ? "“" + gk + "” has no place on the map — " + EXCLUDE[gk] + "."
        : "“" + gk + "” has no place on the map yet.";
      return;
    }
    const w = WHEN[gk];
    setYear(indexOf(w.year));
    /* AND A FLIGHT ALREADY ON ITS WAY THERE IS NOT FOUGHT (2026-08-29). This
       was `if (!legible(w.place)) flyTo(…)` alone, and `legible` asks about the
       frame the camera is on RIGHT NOW — which, one hundred milliseconds after
       a tap on a mark, is a frame in the middle of the flight that tap started.
       MEASURED: a tap on Kingston flies to `ARRIVE` (20 degrees, centred), the
       record lands two frames later, `showing()` found Kingston not yet legible
       from where the camera happened to be, and started a SECOND flight to
       `arcFor("Kingston")` — 64 degrees — so the gate read arc 25.3 and the
       mark 48 px off centre. The reader saw the map zoom in and then back out.

       IT IS THE SAME LAW `zoomBy` ALREADY KEEPS, in its own words: a press that
       lands while a flight is in the air compounds on that flight's
       DESTINATION and not on the frame underneath it. Here the destination is
       already this place, so there is nothing to do. */
    if (fly && fly.to === canon(w.place)) return;
    // arcFor is VIEWS' whole remaining job (atlas.js §4) — and the camera only
    // moves if the place is not already legible where the reader is standing.
    if (!legible(w.place)) flyTo(w.place, 300, arcFor(w.place));
  }

  /* ---------- the observers --------------------------------------------- */
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver((es) => {
      onScreen = es[0].isIntersecting;
      if (onScreen) { if (dirty) { dirty = false; need(); } return; }
      /* OFF SCREEN, THE MOTION ENDS — it is not parked and resumed. MEASURED:
         a glide that was still spending its budget when the section scrolled
         away came back to life the moment it scrolled into view again, and
         turned the globe 0.33 degrees under a reader who had not touched it —
         which showed up as G13's "the globe does not move at all" failing by a
         third of a degree. Nobody was watching it fly, so there is nothing to
         resume. A flyTo is DIFFERENT and is finished rather than dropped: it
         was going somewhere on purpose (showing() puts the ring on the record
         the page is playing), so the camera is put at its destination
         immediately and the section comes back settled. */
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      glide = null;
      if (fly) { globe.set({ lam0: fly.l0 + fly.dl, phi0: fly.p0 + fly.dp, arc: fly.a1 });
                 fly = null; }
      dirty = true;
    }, { rootMargin: "120px" }).observe(wrap);
  }
  if (typeof ResizeObserver === "function")
    new ResizeObserver(() => { if (refit()) redraw(); }).observe(wrap);
  window.addEventListener("resize", () => { if (refit()) redraw(); });

  refit();
  /* THE LIST IS BUILT BEFORE THE FIRST YEAR IS SET (2026-08-29), and the order
     is the argument: `setYear` ends in `redraw()`, `redraw()` calls
     `syncIndex()`, and `syncIndex` is what puts the reader's row under the
     reader — so a list that did not exist yet would have missed the one
     record the box opens on and the earth's ring would have had no row beside
     it until the first scroll. Built, then the year, then the sweep that says
     which marks the first screenful of rows lights. */
  buildIndex();
  setYear(indexOf(WHEN[TERMS.basis] ? WHEN[TERMS.basis].year : YEARS[0]));
  /* AND THE FIRST SWEEP IS RUN BY HAND, because nobody has scrolled yet and
     the lit ring is a fact about which rows are on the screen — which is true
     at boot exactly as it is after a flick. It runs AFTER `setYear` so that
     `syncIndex` has already centred the record's own row: the sweep then reads
     that row as the middle of the box and computes the year we are already at,
     which is the no-op that proves the two directions agree. */
  sweep();
  /* AND THE ROWS ARE RE-MEASURED WHEN THE BOX CHANGES SHAPE, AND SWEPT AGAIN.
     A row wraps at 320px and does not at 430, so the two arrays `sweep` binary
     searches are a fact about a LAYOUT; `measureRows` is one pass over the
     rows' rects and runs only when the observer fires, never inside a frame.
     THE SWEEP AFTER IT IS NOT TIDINESS — IT IS THE ONE PATH THAT LIGHTS THE
     MAP WHEN THIS PANEL WAS NOT ON THE SCREEN AT BOOT. A `.nu-pan[data-off]`
     panel is `display: none`, so its scroller measures 0x0 and the boot sweep
     above reads an empty screenful and lights nothing; the observer fires the
     moment the Where tab is opened and the box acquires a size, which is
     exactly when the answer becomes knowable. (A link that opens on `#t=mix`
     is the case: measured, without this line the earth stayed unlit until the
     first flick of the list.) */
  if (typeof ResizeObserver === "function")
    new ResizeObserver(() => { measureRows(); sweep(); }).observe(idx);
  /* ---------- reading(): the seed, for the bar to print (2026-08-27) ------
     Paul: *"I clicked rewrite multiple times and never saw a different seed."*
     He could not: the number was in #atlasSay's sentence, which the record's
     own line overwrites, and on a phone it is a scroll away from the button
     that moves it. So the bar prints it beside the gesture — and ONE OWNER
     stands: this counter is still the fact, and this is a reader for it, not
     a second copy of it. */
  const reading = () => seed;

  /* ---------- link() and open(): the address, both ways (2026-08-27) ------
     Paul, three times: *"I'd like to be able to link to a place/time/seed"* /
     *"Update the url with those"* / *"You also need to give me the urls."*

     THE STATE THIS FILE ALREADY DECLARED IS THE STATE A LINK CARRIES. Line 216
     of this file has said "state: two angles, a zoom, a year and a seed" since
     the globe shipped, and three of those five are the ones a person means by
     "where and when and which version". The two angles and the zoom are a
     CAMERA — where you are standing to look at the earth — and they are left
     out on purpose: `showing()` already puts the camera on the record, so a
     link that carried them would fight the fly-to it triggers, and it would
     make two links to the same record that are not the same string.

     AND IT SERIALISES THE INPUTS, NEVER THE SONG. `pick()` above is
     `genreToDocument(gk, seed)` and nothing else; `gk` is `recordAt(place,
     year)`. So (place, year, seed) is the whole of what the compose path is
     given, and a link is those three words — which is also why a link stays
     good when a genre's recipe is improved: the recipient gets today's reading
     of that anchor, not a frozen copy of a record from a week ago.

     WHY THE PLACE AND NOT THE GENRE KEY. `at=Kingston` is a word a person can
     read in a URL and, when the catalog moves under it, `recordAt` resolves it
     to the nearest year rather than 404ing on a key that was renamed. */
  const link = () => ({
    at: here && WHEN[here] ? canon(WHEN[here].place) : null,
    y: YEARS[yi],
    s: seed,
  });

  /* open(want, done): LAND ON A LINK, OR SAY WHY NOT AND LAND ON NOTHING.
     Returns `true` when the record was written — the caller then skips its own
     boot record entirely — and THE REASON, as a string, when it refuses. A
     refusal is never silent and never a throw: a link that points nowhere must
     not quietly show the recipient their own default song wearing somebody
     else's URL.

     WHY THE REASON COMES BACK AS WELL AS GOING INTO #atlasSay, which looks
     like saying it twice and is not. MEASURED: the line was written here, the
     caller then fell back to its own record through `showing()`, and
     `showing()` -> `setYear()` -> `sentence()` overwrote it on the next
     statement — the refusal was on the page for less than a frame and the
     recipient saw an ordinary "600 · 1 record within ten years · Rome" with no
     hint that their link had been thrown away. So the string is handed back
     for the caller to print AFTER its fallback has finished writing, and
     `note()` below is the door it prints through. The write here stays, for
     the caller that lands nothing at all.

     `pick` does the rest and does it exactly as a tap does: the seed is set
     first, the slider is put on the record's own year, and `ctx.setDocument`
     -> `showing()` moves the camera. There is no second compose path here. */
  const note = (text) => { say.textContent = String(text); };
  const refuse = (why) => { note(why); return why; };

  function open(want, done) {
    const asked = String((want && want.at) || "").trim();
    const name = canon(asked);
    if (!asked || !PLACES[name]) {
      return refuse("this link points at "
        + (asked ? "“" + asked + "”" : "no place")
        + ", which is not a place on this globe — so the box opened on its own record.");
    }
    const Y = Number(want.y);
    if (!Number.isFinite(Y)) {
      return refuse("this link's year (“" + String(want.y) + "”) is not a year"
        + " — so the box opened on its own record.");
    }
    const r = recordAt(name, Y);
    if (!r) {
      return refuse(name + " has no record on this globe"
        + " — so the box opened on its own record.");
    }
    /* THE SEED IS THE ONE THE BAR PRINTS, and it is clamped rather than
       trusted: a fragment is a string a stranger typed, and `genreToDocument`
       takes it straight to the dice. 1 is the reading every record opens on
       (ui/eight.js prints it at boot), so 1 is what anything unreadable
       becomes. */
    const n = Math.round(Number(want.s));
    seed = Number.isFinite(n) && n >= 1 ? Math.min(n, 9999) : 1;
    setYear(indexOf(r.year));
    pick(r.gk, done);
    return true;
  }

  return { showing, reseed, reading, link, open, note };
}
