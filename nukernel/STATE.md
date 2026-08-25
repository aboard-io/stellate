# STATE — where the box actually is, 2026-08-24

Nine deliverables were ordered and nine landed. **Two things do not work, and
they are the first two paragraphs of this file.**

**D1's own acceptance test fails.** `node test/soak-nukernel.js --mins 12
--load 2` exits non-zero on `starve.episodes === 0`. But read where the holes
are before you read the verdict: in a 12-minute run there were **2 episodes,
worst 255 ms, both inside the first 8.4 seconds and none in the remaining 11
minutes 52 seconds**. A confirming 3-minute run reproduced the same shape,
worse — **5 episodes, worst 961 ms, all inside the first 30.6 seconds, none
after** — and `keepUp` fell to 0.000 during that window while the producer ran
at 1.04× budget. So the thing you complained about, *"after a few minutes the
audio crackles like vinyl"*, is gone: steady state is clean, `keepUp` p05 is
1.000, the heap is flat over twelve minutes (13.8 MB → 12.8 MB), zero clicks,
zero anomalies, zero errors. What is left is a **start-up hole**: the ring
begins empty, the deep runway only helps once there is something in it, and for
the first half-minute of a playthrough the box can drop up to a second of
audio. The page says so out loud — the readout printed `stream · runway 3.5s ·
2 dropouts, worst 255 ms, last at 0 min` — which is the other half of D1
working exactly as designed. The fix is a prefill before the first frame is
released, and it was not in this round's brief.

**D3 and D5 never met.** The engineer wrote a per-voice desk, a bus block and a
master into the document shape, and precompose writes NONE of them — 0 of 122
precomposed records carry a `voice.desk`, a `sound.buses` or a `sound.fx`. So
the opened reverb return, which is the whole point of D3 and the second thing
on your ears list, reaches exactly ONE record: the shipped chant, because
`songs.js:203` carries `buses.rev.ret: "hall"` by hand. Click Kingston and you
get a record whose seven voices have no desk on them at all. Nothing is broken;
a surface was built and the writer that should fill it was written the same
afternoon in the next room.

Two smaller ones in the same family, measured over all 122 anchors:
`time.groove` is now written for the first time ever (`setGroove` had existed
and never been called) and it says **`funk` on 97 anchors and nothing on the
other 25** — `backbeat`, `pushed`, `laid back` and `dub` are in the table and
are never chosen, so a bossa and a boom-bap are handed the same groove word.
And `alphabet.scale`, the other new field, is genuinely various: 11 distinct
scales, 99 anchors declaring one, which is what was promised.

Everything else passes: twelve gates, 200-odd assertions, all green.

**And two things every gate passed while being true.** This is the "test the
artifact" law biting the round that invoked it, so both are written down plainly.

*The map is cropped on a phone, and you cannot swipe it.* `nu.css` gives
`.nu-map` a `min-width: 760px`, so at 390px the SVG is 760 px wide inside a
366 px box with 394 px of horizontal scroll — and `touch-action: pan-y` on the
`<svg>` (which is there so a vertical swipe belongs to the page, and does)
means a horizontal touch drag moves that box **0 px**, measured. Result: **28 of
the 62 places — the whole Old World, Berlin, Düsseldorf, Lagos, Johannesburg,
Florence, Glasgow — are drawn off the right edge and unreachable by thumb.** The
fallback listbox reaches every record, so the FEATURE works and G11 proves it;
the MAP half of *"a world map on top"* shows the Americas and stops. At 820 px
and up, nothing is off-screen.

*Twenty-three dropdowns survive, and they are all on the board.* D2's gate
asserts `#app select` is empty and it is — 0. But the mixing board is mounted in
`#deck`, not `#app`, and it carries **23 `<select>`s**: `place`, `→ reverb`,
`→ delay`, the EQ rows, per channel. Those are per-instrument options in
dropdowns, which is the exact thing you objected to. Three more live in the
atlas (`era`, `look at`, and the fallback listbox); those are navigation and the
deliberate accessible path, and they should stay. The gate is faithful to
PROGRAM.md §5, which says `#app`; the contract's scope is what missed this.


---

## Deliverable by deliverable

**D1 · The crackle — HALF DONE; ITS GATE FAILS.** The numbers are in the first
paragraph and in the gate block below. The half that works: the page tells you
which engine it got and whether it starved. On an isolated server `__nuEngine()`
answers `ring: true`, `isolated: true`, `clickMonAlive: true`, `clicks: 0`, and
the `<p id="engine">` readout prints its own sentence — `stream · runway 3.0s ·
no dropouts` two seconds in, rising past `runway 10.7s`, and after a hole it
says `2 dropouts, worst 255 ms, last at 0 min` rather than saying nothing, which
is the whole point of F2 and F6. `deepRunway` is on and the engine sees it. The
runway does not sit at 8 s, though; it sawtooths between about 2.7 s and 8.1 s
over the whole twelve minutes, so design 01's claim of *"runwaySec >= 7.5 from
the first minute"* did not reproduce here. The half that does not work is the
start-up window, described above. Also still open: `www.ftrain.com` serves the
page without COOP/COEP, so there it demotes to the other engine. That is
deferred item 1 and it is an ops line, not code.

**D2 · The sheets — WORKS.** `#app select` is empty; 56 sheets on the shipped
chant, 0 `<select>` left in the document body. Every greyed thing says why:
with the stylesheet OFF, all 21 `.nu-why` strings on the reggae record are
present in `body.innerText`. Twenty-three dropdowns do survive on the board, outside the gate's scope — see
above. Demonstrated by hand: set harmony to `modal` and
the whole `bar 1 · i` quality sheet goes dark with `modal harmony has no
changes` printed under the legend and its eight options still visible.

**D3 · The engineer and the board — WORKS ON THE SHIPPED RECORD ONLY.**
`desk-gate` passes all 49 checks, G6 included: the chant's `rev 0.78` now lands
in a return that is open. The board draws at the foot of the page, 8 channels,
and the sends read — bus 1 `plate hall chamber spring room air`, bus 2 `slap
echo tape`. The three homeless master controls (`width`, `tilt`, `ceiling`)
draw disabled with `this one round-trips and draws but reaches no sound` beside
them, which is the honest thing. See the first paragraph for the half that is
missing.

**D4 · The producer — WORKS.** 26 node checks, 27 browser checks. Three taps —
*make · the sound · punk* — on the Kingston record moved it 79 → 85 bpm and the
compiled `audio/plan.js` timeline 462.05 s → 429.43 s, and the note table
printed: *"opened up the kick (1 step), opened up the hat (2 steps), leaned
harder on the one, shortened everything, flattened the line out, took it up to
85."* `more` pushes 0.40 → 0.64, `less` puts it back exactly, `take it off`
restores the document byte-identical, and a `less the cantor` note writes
`{"line":{"fader":-2.8}}` into the mix-offset layer rather than into the Sound
axis.

**D5 · Precompose — WORKS, with the two gaps above.** 122 anchors × 3 seeds,
366 records, no throw and no silent section. Kingston 1969 comes out as 13
sections (`bass groove intro verse verse chorus verse verse chorus bridge solo
chorus outro`), 10 cells, 7 voices with per-section material maps, and
`period` sentences on five sections. 128 bass events and 96 kit hits in section
3, so the band plays. The `bass` chair carries no `instrument` on 104 of 122
records — that is correct, a `kind:"bass"` voice is written by the kernel's own
bass writer, but it reads as a hole in a document dump and is worth knowing.

**D6 · The atlas — WORKS.** 29 data checks, 21 browser checks. Scroll to 1969
and the sentence reads *"1969 — 2 records here, 32 in the decade around it: New
York, London, Düsseldorf, Kingston, Liverpool, San Francisco, … and 13 more."*
One tap on Kingston writes the reggae record and `#title` says `Kingston 1969`.
The same record picked twice is byte-identical; *another take* is a different
one. The keyboard listbox writes exactly `genreToDocument("reggae", 1)` — the
same door, not a second feature. The map itself is only two-thirds visible on a
phone; see the cropping note above.

**D7 · The nudges — WORKS.** 23 checks. `env:"arch"` moves the rendered
velocities; a flat 64-event stream comes out `3 4 4 5 5 5 5 4` under arch,
which is PROGRAM.md's own measured numbers; with no drummer the seven
drum-writing edges are disabled and nothing else is, and hiring a drummer
brings all seven alive.

**D8 · The shell — WORKS.** Every shell assertion holds (one skipped, named in
that gate's own output). Walked top to bottom at 390×844 and 1280×900:
`scrollWidth === clientWidth` at every scroll position, the `.nu-bar` pinned at
0 and 52px tall throughout, and a sticky `h2` in the 0–120 band at every stop.
One honest wrinkle: at 1280 there are two axis headings in that band at the
handoff between axes (y=13770 shows `4–7 · The band` and `8 · Performance`
together). The gate's three sampled scroll positions each show exactly one, so
the gate is not lying; the "exactly one" promise is true at the positions it
checks and not at every pixel. Also: the chant is **20,076px tall at 390px
wide**. That is the cost of 56 lit sheets and it is a design question, not a
bug.

**D9 · Ableton export — WORKS at P0.** The export writes `/tmp/n.als` and the
gate reads it back: well-formed, round-trip against the song rather than the
XML, donor conformance, and the sample audit passes with no authored absolute
paths. Gate 4 — whether a set actually OPENS — only Live can answer, and it is
the first question on your list below.

**The stylesheet off.** `document.styleSheets[0].disabled = true` on the
Kingston record: the page still reads as the same document top to bottom —
`Kingston 1969`, then `1 · Time`, `2 · Alphabet`, `3 · Material`, `4–7 · The
band`, `8 · Performance`, `9 · The producer`, `The board`, and every one of the
21 reasons still in the text. It overflows sideways with the CSS off (1195px in
a 390px window), because the horizontal scroll is a `.nu-pane` rule; that is
the stylesheet doing its job, not the document failing.

---

## THE GATES, AS THEY RAN

```
pass  document       0.5s  22 passed, 0 failed
pass  desk           0.4s  all 49 checks pass
pass  precompose    35.8s  17 passed, 0 failed
pass  gates        185.8s  OK  the shipped table is what the box says.
pass  ableton        2.9s  gate 3 — no new sample references · no authored absolute paths
pass  producer     620.2s  26 passed, 0 failed
pass  atlas-data     0.3s  PASSED all 29 checks
pass  shell         22.1s  PASS — every shell assertion holds (1 skipped)
pass  sheets         7.5s  ALL PASS (19 checks)
pass  nudges         7.7s  ALL PASS (23 checks)
pass  atlas         16.2s  ALL PASS (21 checks)
pass  producer-ui   11.9s  ALL PASS (27 checks)
```

And the soak, which is not in the runner on purpose — a twelve-minute gate
nobody waits for is a gate nobody runs:

```
node test/soak-nukernel.js --mins 12 --load 2        EXIT 1
  PASS  the streaming engine, cross-origin isolated  (isolated=true ring=true route=direct)
  FAIL  starve.episodes === 0  (episodes=2 worstMs=255.4 lastAtSec=8.4)
  PASS  keepUp p05 >= 0.92  (p05=1)
  PASS  clickMonAlive && clicks === 0 (F6)  (clickMonAlive=true clicks=0)
  PASS  anomalies === 0  (anomalies=0)
  PASS  end heap <= 1.25x minute-2 heap  (13.8MB -> 12.8MB)
  PASS  zero console errors, zero pageerrors  (console=0 pageerror=0)
  PASS  producer.peak <= 3.0  (peak=1.227)
  readout: "stream · runway 3.5s · 2 dropouts, worst 255 ms, last at 0 min"
  SOAK FAILED: starve.episodes === 0

node test/soak-nukernel.js --mins 3 --load 2         EXIT 1  (the confirming run)
  FAIL  starve.episodes === 0  (episodes=5 worstMs=960.7 lastAtSec=30.6)
  FAIL  keepUp p05 >= 0.92  (p05=0)
  …every other check PASS, and nothing after t=30.6s
```

`test/atlas.js` and `test/producer.browser.js` did not exist when this pass
started and were written by the verifier, which owns them (PROGRAM.md §2.5).
The first version of the atlas gate reported two failures that were the gate's
own bugs — it read `window.NuAtlasLand` where the module publishes
`NuAtlasLand.LAND`, and it clicked the FIRST button in Kingston's panel after
the autopick had already composed a different one of Kingston's four records,
then called the difference a determinism failure. Both are fixed and the
comment in the file says so, because the next person to read "5559 vs 5600
chars" deserves to know it was already once a false alarm.

---

## STILL DEFERRED

PROGRAM.md §4 had fifteen items. Nothing on it was done this round, and three
things were added to it.

**New, from this pass:**

16. **The start-up hole.** D1's gate fails on it: 2–5 dropouts inside the first
    8–31 seconds of a playthrough, worst measured 961 ms, none afterwards. The
    ring starts empty and the deep runway cannot help until there is something
    in it. Needs a prefill before the first frame is released. This is the
    highest-value item on this list.
17. **Precompose writes no desk, no buses and no fx** — 0 of 122. The document
    shape is there, the board reads it, the engineer's gate proves it reaches
    the sound; the writer is missing. This is the single largest gap in the
    round and it is why the reverb return you are asked to
    judge below can only be judged on the chant.
18. **`time.groove` says `funk` or says nothing** — 97 / 25 / 0 for the other
    four words. `setGroove` is finally called; it is called with one word.
19. **The map is cropped and unswipeable at 390px** — `min-width: 760px` plus
    `touch-action: pan-y` puts 28 of 62 places out of a thumb's reach. Either
    the min-width drops for the world view, or the wrap gets `pan-x pan-y` and
    the tap handler learns to tell a tap from a drag.
20. **23 `<select>`s remain, all on the board**, outside the `#app` subtree D2's
    gate looks at. Either the board's rows become sheets, or the contract says
    out loud that a channel strip is allowed dropdowns.
21. **Two sticky axis headings coexist at the handoff** at 1280px. Cosmetic,
    measured, unfixed.

**Carried, unchanged:** F1 the two nginx headers (the deployed host is still
un-isolated) · F4 the per-note channel strip · F5 `eight.js`'s own main thread
(still SUSPECTED only) · Ableton P1–P4 and the two asks · `tomHi`/`tom`/`tomLo`
all export as GM 47 · augmentation and diminution as Development words · the
`bassGrid` document slot · `orn` declared by zero of 122 genres · the theme
composer and the solo ladder · `fitReg` · bus 3 is not the ping-pong and the
three homeless master controls · a per-section desk is not expressible ·
`cast.part` collapses to line/pad · two catalogs of place and era · F7 the two
open WAV-route audit items.

---

## WHAT ONLY YOU CAN DECIDE

Eight questions. Each names the thing to listen for.

1. **The deep runway.** Change a genre, the tempo, or a section while it is
   playing: is the delay before you hear the change tolerable? It now buys a
   buffer that does not empty by spending up to ~5 s of heard lag on any
   walk-fed edit. If it is wrong, the retreat is **5 s, not 3 s**. Related and
   separate: **press play and listen to the first thirty seconds.** The gate
   says there are one to five holes in there, up to a second long. Is that what
   you are hearing, and is it worse than the lag you would pay to remove it?
2. **The reverb return, opened.** Play the shipped chant. Every genre in the
   catalog sends `tone.verb` and until today that send went into a muted bus,
   so this record will not sound the way it did yesterday. **Does it sound like
   a stone room?** (Judge it on the chant only — see the first paragraph.)
3. **`fx` back on a track.** This reverses your 2026-08-17 directive, *"get rid
   of inserts, reverb, and echo — let me send to bus 1, bus 2, and bus 3
   instead."* The argument is that the sends are wired to real returns now, so a
   chip on a track is only for what must be IN the path. Do you accept the
   reversal?
4. **`--cell: 36px`.** Open the step grid on your actual phone. Sixteen 36px
   cells show ten steps in a 390px window instead of eight; 36 clears WCAG AA
   but not Apple's 44. **Does your thumb hit the cell you meant?** If not the
   answer is one custom property and a second swipe per bar. Do not ask for a
   toggle.
5. **The `IDIOM` table.** Ten family rows and about twenty anchor overrides are
   a taste claim. The precompose gate prints which family row each anchor
   resolved to. **Does a punk hook sound like punk?**
6. **62 hand-typed coordinates.** The gate catches a city in the sea; it cannot
   catch one 200 km off. Open the world view and look at it once — **on a
   laptop, because on a phone you can only see the Americas** (see the cropping
   note above). **Is anything in the wrong place?**
7. **Gate 4 — Live.** `node tools/ableton/export-als.js --genre boombap --out
   /tmp/n.als`, then open `/tmp/n.als` in Live 12.4.3. **Does it open?** Only
   Live can answer; `verify.sh` has always missed this.
8. **One groove word for ninety-seven records.** Not on the original list, and
   it is the same kind of question. Play a bossa and play a boom-bap: they are
   both handed `groove: "funk"`. **Do they feel like the same pocket?** If they
   do not, item 18 above is the fix.
