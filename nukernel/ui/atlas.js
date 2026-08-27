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
const { PLACES, WITHIN, WHEN, EXCLUDE, YEARS, UNITS,
        recordAt, arcFor, atYear, indexOf, eraOf, canon } = NuAtlas;

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
   Philadelphia, Harlem and Greenwich Village on top of each other. */
const LOD_X = 46, LOD_Y = 14;
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
  let seed = 1;               // the atlas's own; "another take" bumps it
  let onScreen = true, dirty = false, raf = 0;
  let dragging = false, glide = null, fly = null;

  /* ---------- the DOM, in reading order --------------------------------
     h2 (shipped by index.html) · the sentence · THE SLIDER · the globe · the
     one button. Built once and never rebuilt: a control destroyed and recreated
     under a screen reader's cursor is a control that loses its place.
     (This line read "the globe · THE SLIDER" while the code below appended them
     the other way round — a leftover from the plan that put the slider under the
     globe, reversed for the measurement written out at `when` below. The order
     here is the order the DOM is built in, verified: h2, #atlasSay, #atlasWhen,
     #atlasWrap, #atlasActs.) */
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

  /* THE SLIDER SITS ABOVE THE GLOBE, WHICH IS WHERE IT SHIPPED, AND THE ROUND'S
     PLAN MOVED IT UNDER — "the globe is the figure and the slider is its scale,
     and on a phone your hand rests at the bottom of the screen". That is a good
     argument about a thumb and it lost to a MEASURED one about a keyboard.
     With the slider under the globe, DOM order is reading order is tab order,
     so a reader met the earth and its nineteen places BEFORE the control that
     decides which nineteen: measured, Tab from the slider landed on "another
     take" and the places were all behind it, reachable only by Shift-Tab. The
     sentence names the year, then the slider sets it, then the globe shows what
     that year lit — which is also the order Paul described the thing in ("a
     slider for time and a world map on top"). The ergonomic point survives
     anyway: this section sits in a long scrolling document, so where the slider
     falls under your thumb is decided by the scroll and not by this line. */
  const when = el("div", { id: "atlasWhen" });
  /* THE LABEL AND THE READOUT SIT ABOVE THE TRACK, not beside it, so the INPUT
     ITSELF goes across the whole screen — "the 'when' slider which should go
     across the whole screen" is a sentence about the track, and a label and an
     output beside it were eating 38% of it (measured at 390px: the range was
     226 of 366 CSS px). The <output> stays inside the <label>, so tapping the
     year still focuses the slider and a screen reader still reads "when 1969". */
  const yLab = el("label", { htmlFor: "atlasYear", textContent: "when " });
  const year = el("input", { type: "range", id: "atlasYear",
    min: "0", max: String(YEARS.length - 1), step: "1", value: "0" });
  year.dataset.k = "atlas|year";
  year.setAttribute("list", "atlasTicks");
  year.setAttribute("aria-describedby", "atlasSay");
  const yOut = el("output", { id: "atlasYearOut", textContent: String(YEARS[0]) });
  yOut.setAttribute("for", "atlasYear");
  const ticks = el("datalist", { id: "atlasTicks" });
  /* THE TICKS SIT AT THEIR RANK POSITION, not at their year, because the scale
     IS rank (atlas.js §3): one stop per year the catalog actually has. Their
     bunching between 1970 and 1999 is the true story of this catalog told in
     the control itself — 22 records in the seventies, 1 in the whole 1400s. */
  for (let i = 0; i < YEARS.length; i++)
    ticks.append(el("option", { value: String(i), label: String(YEARS[i]) }));
  yLab.append(yOut);
  when.append(yLab, year, ticks);

  /* "ANOTHER TAKE" STAYS AND "BACK TO ROME 600" GOES, and the line between them
     is Paul's own sentence. "Back to Rome 600" moved the slider and the camera
     — that is NAVIGATING, and navigating is what he asked to be left with two
     controls for. "Another take" re-rolls the record you already have; it is the
     record's own control and it acts on nothing but the seed. */
  const again = el("button", { type: "button", id: "atlasAgain",
                               textContent: "another take" });
  again.dataset.k = "atlas|again";
  // `.nu-row` IS THE PAGE'S ONE NAME FOR A STRIP OF BUTTONS (nu.css,
  // 2026-08-26). It replaces `#atlasActs button { margin-inline-end: .4rem }`,
  // which was this section's private spelling of a spacing three other strips
  // spelled two other ways.
  const acts = el("p", { id: "atlasActs", className: "nu-row" });
  acts.append(again);

  parent.append(say, when, wrap, acts);

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
    lg.appendChild(t);
    g.append(ring, dot, hit);
    gNames.append(lg);
    gMarks.append(g);
    mark[name] = { g, dot, hit, ring, t, lg };
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
  const scope = () => { atNow = atYear(YEARS[yi]); shown = atNow.shown; };

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
    const { u, arc } = globe.get();
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
          m.ti = m.lab = m.cur = m.op = m.lk = null; m.ringOn = false;
          m.ring.setAttribute("opacity", "0");
          m.t.setAttribute("opacity", "0"); }
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
        + " " + r.year + ", " + r.gk;
      if (m.lab !== lab) { m.lab = lab; m.g.setAttribute("aria-label", lab); }
      const cur = here && r.gk === here ? "true" : "false";
      if (m.cur !== cur) { m.cur = cur; m.g.setAttribute("aria-current", cur); }
      // a mark behind the earth cannot be seen, so nothing about its INK is
      // written — but it is still named, still in the tab order, and still one
      // focus away from turning the earth to it.
      if (far) { if (m.ringOn) { m.ringOn = false; m.ring.setAttribute("opacity", "0"); } continue; }
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
      const ringOn = !!(here && r.gk === here);
      if (m.ringOn !== ringOn) { m.ringOn = ringOn; m.ring.setAttribute("opacity", ringOn ? "1" : "0"); }
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
      const lx = +dotR + (ringOn ? 13 : 4) * u, ly = 4 * u;
      const lk = lx.toFixed(1) + "|" + u.toFixed(3);
      if (m.lk !== lk) { m.lk = lk;
        m.t.setAttribute("x", lx.toFixed(1)); m.t.setAttribute("y", ly.toFixed(1));
        m.t.setAttribute("font-size", (LABEL_PX * u).toFixed(1));
        /* THE HALO IS A STROKE UNDER THE FILL (paint-order, nu.css), AND ITS
           WIDTH HAS TO BE SAID HERE and not there: a stroke-width in a
           stylesheet is in USER units, and this viewBox is 1000 units across
           whatever the column happens to be. See HALO_PX for the two measured
           numbers — 2.6 units renders 0.95 CSS px on the phone and 3.27 on the
           desktop, and through `u` it is 2.60 on both. */
        m.t.setAttribute("stroke-width", (HALO_PX * u).toFixed(2)); }
      cand.push({ name, x: p.x, y: p.y, dx: lx, dy: ly, z: p.z, ring: ringOn });
    }
    if (labelsStale) { labels(cand, u); labelsStale = false; }
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
    for (const name of NAMES) mark[name].t.setAttribute("opacity", "0");
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
      mark[c.name].t.setAttribute("opacity", (0.35 + 0.65 * c.z).toFixed(2));
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
    const moving = !!(fly || glide || dragging);
    paint(moving);
    if (moving) raf = requestAnimationFrame(tick);
  }
  const redraw = () => { labelsStale = true; need(); };

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
    fly = { t0: performance.now(), ms, l0: g.lam0, p0: g.phi0, dl, dp, a0: g.arc, a1 };
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
    say.textContent = Y + " · " + nR + " record" + (nR === 1 ? "" : "s")
      + " within ten years · " + six.join(", ")
      + (more > 0 ? ", +" + more + " more" : "");
  }

  /* ---------- the tap that composes ------------------------------------ */
  function pick(gk) {
    const w = WHEN[gk];
    const where = w ? w.place + " " + w.year : gk;
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
        // `take` is a field of the document and "another take" does not move
        // it — it moves the SEED, which is what makes a second reading of the
        // same anchor a different record.
        + (seed > 1 ? " · reading " + seed : "") + ".";
    }));
  }

  /* ONE TAP, ONE RECORD — consequence C, at the point of use. The place plus the
     slider's year is a record (atlas.js recordAt: nearest year, tie to the
     earlier). AND TAPPING THE MARK YOU ARE ALREADY ON BUMPS THE SEED: press it
     again to hear it again, without hunting for a control, and #atlasSay prints
     "· reading 2" so the effect is visible. */
  function choose(name) {
    /* THE YEAR'S OWN MAP, NOT recordAt() — one owner for what is here. A mark
       the year does not hold is `display: none`, so no pointer and no key can
       reach this with a name that is not in it; the guard is what keeps that a
       fact rather than an assumption. */
    const r = shown.get(name);
    if (!r) { say.textContent = name + " — no record here at " + YEARS[yi] + "."; return; }
    if (here === r.gk) seed++;
    flyTo(name, 300, null);
    pick(r.gk);
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
    year.value = String(yi);
    yOut.textContent = String(YEARS[yi]);
    /* SCOPE FIRST, THEN SAY IT, THEN DRAW IT — in that order, because all
       three are the same fact and the sentence must never be able to describe a
       set the next paint has not adopted yet. */
    scope();
    sentence();
    redraw();
  }
  year.addEventListener("input", () => setYear(+year.value));
  again.addEventListener("click", () => {
    // A DIFFERENT RECORD, SAME PLACE AND YEAR. genreToDocument is deterministic
    // in (gk, seed), so the only way to a second take is a second seed.
    if (here) { seed++; pick(here); }
    else say.textContent = "pick a place first, then this writes it again.";
  });

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
  setYear(indexOf(WHEN[TERMS.basis] ? WHEN[TERMS.basis].year : YEARS[0]));
  return { showing };
}
