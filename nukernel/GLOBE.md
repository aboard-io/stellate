# The globe

_2026-08-24. Written by the verifier, for Paul. Everything here was measured on
the page in a browser, not read off the source._

---

## Read this first: the one thing that is wrong

**Pinching does not zoom toward your fingers.** It zooms toward the middle of
the box, wherever your fingers are. Measured at 390×844: Antwerp sitting 10 px
from the middle, one pinch (×1.8) moved it to 83 px below the middle, and a
second pinch put it outside the globe's box altogether. So the ordinary way a
person uses a map — put two fingers on the city and spread — loses the city.

The keyboard does the right thing (`+` recentres on whatever place has focus,
and it now works when the key is held; see below), and dragging works. It is
the pinch alone. It is about ten lines in `nukernel/ui/atlas.js` — the pinch
currently pans only by how far the CENTROID of your two fingers travels, and a
symmetric spread does not move the centroid at all, so it contributes no pan.
Anchoring the point under the fingers instead is the fix.

Everything else below is working.

---

## What it is

Where the records are, as a black-and-white earth you turn and zoom, with one
slider for when. Two controls and nothing else.

There is **no 3D library**. Nothing was vendored, nothing was downloaded, and
`vendor/` is exactly what it was this morning. An orthographic globe is nine
lines of arithmetic; three.js would have cost 166 KB gzipped, a GPU context, a
second answer to "where is Kingston on screen", and a render loop next to the
audio worklet — which this repo has already paid for once (`main:app/starcruise.js`,
"audible static/dropouts after visiting the 3d planet"). It is plain SVG.

The coastline is Natural Earth 1:50m and 1:10m, public domain, baked once into
`nukernel/atlas-land.js` by `scratch/atlas/bake-land.js` and committed as
numbers. Nothing is fetched at run time, ever. **Verified with the wire cut:**
45 requests on a full load, every one of them to localhost, and the globe still
draws and still zooms.

## How you turn it and zoom it

| | |
|---|---|
| **turn** | drag it. Start the drag sideways — the first 8 px of a touch decide whether the gesture belongs to the globe or to the page, and downward-first means the page scrolls. Once it is the globe's, it moves in both directions. |
| **zoom** | pinch, or scroll the wheel, or a trackpad pinch, or `+` and `−` on the keyboard. |
| **pick a record** | tap a place. The place plus the year on the slider is one record. |
| **hear it differently** | tap the same place again — the seed moves and the sentence says "reading 2" — or press **rewrite** in the transport bar. (It was **another take** under the globe until 2026-08-27, when Paul moved it beside play and named the two verbs apart: **rewrite** is a different record, **take** is the same record played again.) |
| **keyboard** | Tab reaches the globe, then every place the slider's year has lit. Enter on a place writes the record. `+`/`−` zoom, and zoom toward the place you are on. Arrows turn and tilt. |

**The range, measured on the rendered picture, not on a variable:** the whole
earth (180° of arc, about 20,000 km across) down to 0.5° of arc, about 55 km
across a 390 px phone. London and Paris are **7.97 CSS px** apart at the top of
the range and **1,833.24 px** apart at the bottom — 230×. Both ends are hard
stops: forty-five `+` presses and twenty trackpad pinches both land on exactly
1,833.24, and sixty `−` presses and eighty wheel notches both return to exactly
7.97.

**A vertical swipe still scrolls the page.** Measured on a real touch device
profile: swipe up, `window.scrollY` goes 0 → 340 and the globe turns 0 px. Drag
sideways, the globe turns 146.57 px and the page does not move at all. That is
`touch-action: pan-y` on the map plus the 8 px lock, and it is the thing that
was broken this morning (a horizontal drag moved 0 px and 28 places could not be
reached).

**Reaching all sixty-two places.** Every one of the sixty-two places that carries
a record comes round to the near side and into the box under sideways touch
drags alone — **62 of 62**, measured — and a tap on a mark composes that place's
record at the whole earth and at the deepest zoom alike. By keyboard, all 62 are
reached at six widths from 320 px to 1280 px. What I could **not** certify is the
thumb path *at zoom*: because of the pinch defect at the top of this file, a
thumb that pinches toward a city loses it off the box within two pinches, so
"drag near, pinch in, tap" cannot be driven to completion for the tight clusters.
Fix the pinch and that gap closes.

## What was deleted

Not hidden — deleted. `#atlasCtl`, `#atlasEra` (the era menu), `#atlasView`
(the "look at" menu), `#atlasList` (the fallback list of every genre),
`#atlasPlace` (the "nearby" panel) and `#atlasHome`. `nearby()` is gone from
`atlas.js` and left a tombstone saying what it did and why it does not come
back.

`document.querySelectorAll("select").length` **is 0 for the whole page** — not
just the atlas. There is no `<details>` and no `<summary>` anywhere, and nothing
renders the word "Details". That word was never a styling problem: the view's
`mount()` opened by emptying its parent, which ate the `<summary>` the HTML
shipped, and a `<details>` with no `<summary>` prints the browser's own default
label. `<section>` took the cause away and `mount()` no longer destroys markup
it did not write.

The list is gone but the accessible path is not. **The globe's own place marks
are the accessible path**: each is a real `<g role="button" tabindex
aria-label="Kingston 1969, reggae">`, focusable on either side of the earth, and
focusing one flies the camera to it. There is one code path now instead of a
visible one and a hidden twin. Proved byte-for-byte: Tab to Kingston and press
Enter, versus tap Kingston with a pointer, and the resulting page — the whole
record and the whole desk — hashes identically (`fa635cc8…` both ways). A screen
reader announces **"Kingston 1969, reggae, button"**. At 1969 Kingston is eight
Tabs from the slider, because the slider scopes the list to the nineteen places
that have something near that year rather than all sixty-two.

## The 2020s

"Now" was a lie and now it is not. The year axis ends at **2023**, the last
stop's era word is **now**, and the word is *derived* — `ERAS` grows a "now" row
only if the catalog actually reaches 2020 — so it cannot become the same lie in
2031.

Eight records now sit in the twenty-twenties, and all eight are reachable from
the last stop of the slider:

| | | |
|---|---|---|
| **amapiano** | Johannesburg | 2020 |
| **bedroompop** | Los Angeles | 2020 |
| **afrobeats** | Lagos | 2021 |
| **hyperpop** | London | 2021 |
| **mahraganat** | Cairo | 2021 |
| **bailefunk** | Rio de Janeiro | 2022 |
| **punjabipop** | Chandigarh | 2022 |
| **corridotumbado** | Guadalajara | 2023 |

Three of those cities are new to the map — Cairo, Chandigarh and Guadalajara —
which gives the atlas its first dot in North Africa, its first in South Asia and
its first in Mexico. Dragged to the end of the slider and picked one: **Cairo
2021, mahraganat, 10 sections, 7 voices.** It plays.

## What it cost

Nothing was added to `vendor/`. The coastline is 229 KB of committed source,
85 KB gzipped, in four tiers — a coarse one for the whole earth, a middle one
for continents, and a 1:10m patch around each of the 65 places for the last two
degrees of zoom.

**The globe idles at zero, measured.** Three seconds with the globe on screen
and nobody touching it: **0 animation frames, 0 attribute writes.** Three
seconds scrolled off screen: 0 and 0. Three seconds scrolled off screen *while a
flick was still gliding*: 0 and 0 — the motion is dropped, not parked.

**The audio did not degrade. `node test/soak-nukernel.js --mins 12 --load 2`,
with the globe on screen the whole time: SOAK PASSED, all eight checks.**

```
PASS  the streaming engine, cross-origin isolated  (isolated=true ring=true route=direct)
PASS  starve.episodes === 0        (episodes=0 worstMs=0 lastAtSec=0)
PASS  keepUp p05 >= 0.92           (p05=1)
PASS  clickMonAlive && clicks == 0 (clickMonAlive=true clicks=0)
PASS  anomalies === 0              (anomalies=0)
PASS  end heap <= 1.25x minute-2   (14.2MB -> 13.3MB)
PASS  zero console errors, zero pageerrors
PASS  producer.peak <= 3.0         (peak=0.602)
readout: "stream · runway 8.4s · no dropouts"
```

That is *better* than the run STATE.md records from before the globe existed
(two starvation episodes, worst 255 ms). Twelve minutes, four cores, two busy
children running the whole time, and not one dropout.

**Every gate: `node test/all.js` — 12 pass · 1 fail · 0 skip.** The one failure
is `nudges`, on `pipe:strum`, which is a guitar edge in the dependency graph and
has nothing to do with the atlas; it fails the same way with the globe deleted
and it already has a recipe waiting. `atlas` is ALL PASS (68 checks), `atlas-data`
32 of 32, `desk` all 76, `gates` green.

## Still open

1. **The pinch anchor**, above. The one real defect.
2. **A drag that starts diagonally is given to the page.** The first 8 px decide,
   and `dx > dy` is the test, so a 60° drag — an ordinary "move this up and to
   the left" — scrolls the page and turns the globe 0.0 px (measured: eight of
   them in a row). To tilt the earth you must start sideways and then curve. It
   is a defensible rule in a long scrolling document and it is worth Paul trying
   with a thumb before anyone changes it; one line would loosen it.
3. **At the deepest zoom the earth is an outline, not land and sea.** The wash
   that makes the picture readable stops below 6° of arc, because the 1:10m
   patch tier is open runs clipped to a box and an open run cannot be filled.
   At 0.5° over Kingston you get a thin grey line where you want a harbour.
4. **On a wide desktop the page opens zoomed in**, at 57° of arc over Europe
   rather than on the whole earth (measured at 1280×900; at 390 and 768 it opens
   on the whole earth). Zooming out works from either.
5. **There are no on-screen + and − buttons**, deliberately — a pair of buttons
   is UX for navigating. The gap that leaves is a one-handed phone user with no
   keyboard, who has only the pinch, which is the defect at the top of this file.
   Fixing the pinch closes this too.
6. **The slider's own colour is the browser's blue**, like every other slider in
   the building. The globe itself is black and white; the dots were blue this
   morning and are not any more.

---

## What the verifier changed

The round arrived working. Five things were found by measuring it and fixed:

* **A held `+` did not zoom.** With a place focused, forty `+` presses back to
  back took the camera from 180° of arc to 98.5°, because each press restarted a
  160 ms flight from a pose that had not moved yet, so forty presses computed the
  same destination forty times. A press in flight now compounds on the flight's
  destination. Forty presses now land on the floor, over Kingston, dead centre.
* **The dots were blue.** `LinkText` renders `rgb(0,0,238)`, and nineteen of them
  at 1969 made blue the loudest colour in a picture Paul asked to be black and
  white. They are `CanvasText` now; in-window against out-of-window was never
  carried by hue anyway (opacity 1 against 0.34, and a bigger dot).
* **Three comments described a decision that had already been reversed** — the
  slider's position in `ui/atlas.js` and `nu.css`, and "the mark on top wins" in
  `atlas.js`'s tombstone, which the round replaced with the tie rule in
  `nearest()`. Rewritten with the measurement that reversed them, not deleted.
* **`SOURCES.md` still counted 62 places**; the 1:10m patch tier is per-place and
  the 2020s anchors made it 65 / 308 runs / 7,615 points.
* **Two recipes applied**: the stale "opens the panel at its place" comment in
  `ui/eight.js`, and `desk-gate.js`'s assertion that the atlas still keeps three
  `<select>`s — now one stricter line, "the page has none at all", which is what
  the tree actually does.
