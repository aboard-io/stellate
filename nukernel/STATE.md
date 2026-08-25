# STATE — where the box actually is, 2026-08-25

## What this is, in one paragraph

nukernel is a song box. A record is **one value with eight axes** — Time,
Alphabet, Material, Development, Form, Cast, Sound, Performance (`AXES.md`) —
and everything else is a view of that value. You pick a place and a year off a
globe and the box writes a whole record there; you read it as a page of
questions and answers, edit any of them, and the band plays. There are **139
anchors** in the catalog across **71 places and 73 years, 540 to 2023**. One
engine plays it (the parent's FaustLive), one mixing board sits at the foot of
the page, one producer speaks in sentences, and one exporter writes an Ableton
set. `PROGRAM.md` is the order the 2026-08-24 round was built in; this file is
what actually works, dated today.

---

## FIVE THINGS THAT DO NOT WORK

**The oldest record in the box hires a church organ.** `zema` is Aksum 540,
Ethiopian chant, and its own comment in `genres.js` says out loud that it is
"NOT a child of Rome 600 and must never be written as one." Then the arranger
writes it into the cast. Measured today, all three seeds:

    zema seed 1   voice/ahh_choir  voice2/ahh_choir  vocal/solo_vox
                  fugue/CHURCH_ORGAN  GREGORIAN/ahh_choir
    zema seed 2   … counterpoint/HARPSICHORD  GREGORIAN/ahh_choir
    zema seed 3   … fugue/CHURCH_ORGAN  drone/slow_strings

Every seed brings a European keyboard instrument to sixth-century Aksum and two
of three bring a voice **literally named `gregorian`**. `mbube` (Johannesburg
1939) gets a harpsichord on all three. It is not the anchor's fault:
`compose.js:1296` hard-codes `vox: ["gregorian","counterpoint","fugue","drone",
"vocal","vocal"]` as the guest pool ANY choir record draws from, and it was
written when every choir in the table was European. `AFRICA.md` named this at
04:02 and it is unfixed. Either the pool becomes per-anchor or these two opt out.

**Marabi's inversion is a dead field.** The `marabi` anchor calls its `inv: 2`
"THE HIGHEST STRUCTURAL VALUE ON THIS PAGE" — I‑IV‑I6/4‑V is not a detail of
the style, it *is* the style. Measured today, the composed record's progression
is `[{d:0,q:triad},{d:3,q:triad},{d:0,q:triad},{d:4,q:triad}]`: **no `inv`.**
`precompose.js:469` builds chords as `{d: c.d||0, q: c.q||"triad"}` and drops it
on the way into the document; the kernel honours the field the moment it
arrives (`kernel.js:688`), and putting it back by hand moves 4 of 32 bass notes.
`mbube` inherits the same dead field. **One line.** (`AFRICA.md` §"What is
still wrong" 1.)

**The greying on the page is derived from a corpus of one record.**
`gates.json` decides which option is unreachable and what reason it prints, and
it is EXTRACTED, which is right. But `gates-extract.js:281-284` builds its
anchor corpus as `const d = base(); d.basis = gk` — every anchor measured as
**the shipped chant with its label swapped**. The shipped `gates.json` says so
in its own header: `{records: 55, anchors: 12, rolls: 24, holdout: 33}` —
**twelve of a hundred and thirty-nine anchors, and all twelve seen as the same
two-voice plainchant.** Swapping `basis` cannot change the shape, because every
interesting rule reads `cast.drumsOn` / `cast.hasBass` / `cast.hasPad`, which
are facts about the BAND. `INTERVIEW.md` §3.3 measured the consequence: that
corpus produces **one question shape for all 139 anchors** where the real
precomposed documents produce **six** (119 / 259 / 365 live questions, 6
distinct live-sheet sets). This is not only a world-programme concern — it is
what greys options on the page you are looking at today. The fix is one
expression: the anchor corpus becomes `precompose.genreToDocument(gk, seed)`.

**The board's EQ rows promise a bar and do not draw one.** `#boardtbl`'s caption
reads *"one column per channel · the slider is your offset, **the bar is what
the record is already doing**."* Only the `fader` row builds a `<meter>`
(`ui/engineer.js`, the fader block). The three EQ rows above it build a slider
and nothing else — so on the grid you cannot see the derived shading you are
offsetting. The engineer's own per-voice sheet does print it ("riding −1.3 dB");
the grid, which is the thing the caption is about, does not.

**And no fresh claim is made about audio health, on purpose.** Paul, today:
*"Don't do the soak."* The soak is the only thing that can measure starvation,
dropouts, heap and keep-up, so this file makes **no** claim about them. The last
numbers stand with their date: `GLOBE.md`, 2026-08-24 evening, twelve minutes
with the globe on screen — **SOAK PASSED, all eight checks, `episodes=0`,
`keepUp p05 = 1`, readout `runway 8.4s · no dropouts`.** That run predates the
master-chain surgery of 05:48 today, which changed the master bus but not the
ring. Nobody has re-measured since; if you want the claim, the soak is the way.

---

## WHAT WORKS, DELIVERABLE BY DELIVERABLE

### The nine of `PROGRAM.md`

**D1 · The crackle — the start-up hole is closed in code, unmeasured today.**
The ring **prefills before the first frame is released** (`audio/live.js:565`
asks `prefillSec: 8`; the engine's bounds are at `engine/faust/live/live.js`
"THE PREFILL"), `deepRunway` is on, and the page still says out loud which
engine it got and whether it starved. The A/B recorded in the code, one minute
each at `--load 2`: **first heard sample 7.50 s with one 853 ms dropout, versus
9.78 s with none** — 2.3 s more silence, no hole, and the wait itself measured
3.48 s. A prefill can never become a silence: it is clamped to what the pump
will feed and capped at `PREFILL_MAX_MS = 12000`. **The silence is the part you
feel, and it is question 1 below.**

**D2 · The sheets — WORKS, and half of them are selects again, deliberately.**
The rule settled after you said it twice (*"There are still many boxes that
should be selects"*): **a single-choice control is a `<select>`; a sheet is what
is left** — the one `<select multiple>` (the engineer's fx chips), the drum step
grid, and single booleans. `test/selects.js` and `test/sheets.js` now assert that
RULE off the page rather than an allowlist of one afternoon's controls: no
single-choice `.nu-sheet` survives in `#app`, the only radio groups are the
circle of fifths and the step grid, every development word is a menu (20 of
them, 5 `dev.line` × 26 options and 5 `dev.kit` × 69 per voice), and **no key is
ever drawn as a sheet AND a menu at once** — the hole a half-finished conversion
falls into, which neither the old assertion nor its opposite would have caught.
The greying-with-a-reason law is untouched and still gated: 0 words greyed
before the tap, **8 after, every one printing its own reason**, `out` never
among them. And the stylesheet-off promise still holds — `test/selects.js`
disables every sheet in `document.styleSheets` and the page still reads as the
same document with every reason still in the text.

**D3 · The engineer and the board — WORKS, and it reaches modelled voices.**
The reverb return is open, the desk EQ is a real stage, and — this is the part
that was missing when the last STATE.md was written — **a modelled Faust voice
wears the same tone decision a sampled one does**, because the strip is a stage
the RENDERER owns now. Measured on the tape by the verifier: pushing the
cantor's board EQ to `lo −6 / hi +6` moves the output **−5.7 dB at 50 Hz and
+4.7 dB at 15 kHz with 250 Hz–2 kHz inside ±0.3 dB**; the same gesture that
morning moved −0.8 / −1.2 dB, noise in the wrong direction. `EQ.md` is the
account, including the catalog-wide consequence: **222 sampled chair-boxes were
already carrying a non-flat `lo`/`mid`/`hi` that did nothing**, and now they do
something (about 1.5 dB). Nothing in the stored numbers changed; the renderer
stopped ignoring them. `desk-gate` passes all **85** checks.

**D4 · The producer — WORKS.** 26 node checks, 28 browser checks. Three taps
move the record and the note table says what it moved; `more` pushes, `less`
puts it back exactly, *"take it off"* restores the document byte-identical, and
a `less the cantor` note lands in the mix-offset layer rather than in the Sound
axis. The browser gate now drives the verbs through the `<select>` **the way a
person does** (finds the option by `data-v` and uses ITS `.value`), which is
what the old `opt|prod.verb|make` tap key stopped being able to do.

**D5 · Precompose — WORKS, and the two gaps the last file named are closed.**
139 anchors × 3 seeds = **417 records, 4,304 sections, 3,408 line cells,
1,290,822 sounding events**, no throw and no silent section. Measured today:
**139 of 139 records carry `sound.buses`**, 23 carry `sound.fx`, and **583 of
981 voices carry a `desk`**. `time.groove` is no longer one word for everybody —
**backbeat 55 · push 28 · none 28 · funk 14 · laidback 9 · dub 5.** 10 distinct
scales. Two residues worth knowing rather than fixing blind: **398 voices carry
no desk** (242 line, all 118 bass, 38 drums), which is absent-is-today doing its
job where nothing was decided, and **all 118 bass voices carry no `instrument`**,
which is correct — a `kind:"bass"` voice is written by the kernel's own bass
writer — but reads as a hole in a document dump.

**D6 · The atlas — WORKS, and it is a globe.** Two controls: a when-slider and a
**hand-rolled SVG earth you turn and zoom** (the WebGL twin was deleted; it
drained the audio runway to zero in forty-five seconds). `atlas.gate` passes all
34 checks — 139 anchors = 133 placed + 6 excluded, 73 stops 540..2023, **71
places, 0 orphans, 0 empty stops**, 18 `ERAS` rows and "now" present *because
the catalog reaches 2023*, derived rather than typed, so it cannot become the
same lie in 2031. `test/atlas.js` passes 91 browser checks. The cropped,
unswipeable flat map is gone with the map. **Both defects `GLOBE.md` opened are
fixed in code:** the pinch now holds the point under the midpoint of your
fingers (`holdUnder`) instead of panning by a centroid that a symmetric spread
never moves, and the drag lock moved from a 45° `dx > dy` test to `LOCK_DEG =
25`, so an ordinary diagonal thumb-drag belongs to the globe.

**D7 · The nudges — WORKS.** 24 checks. `env:"arch"` moves the rendered
velocities (a flat 64-event stream comes out `3 4 4 5 5 5 5 4`); with no drummer
all seven drum-writing edges are disabled and nothing else is; hiring a drummer
brings all seven alive. The gate had been counting nudges on the boot page and
bailing at "0 found" — boot lands on the form **list** now and a section's
questions are one tap further in, so it opens section 2's detail first: **boot 0
· section 2 → 8 · performance tab → 3**, all seven drum edges in one detail, no
silent greys.

**D8 · The shell — WORKS, and its one stale rule was reversed on the record.**
Eight assertions, all measured off the rendered page at **320 / 375 / 430 /
820** with a drummer hired first so the widest grid the page can draw actually
exists: the page never scrolls sideways · no `button`, `select` or
`input[type=number]` under 44px tall · every checkbox and radio has a 24px tap
target on both axes (WCAG 2.2 AA) · no pane is a two-axis scroller · **no table
overflows the box it is in** · at scrollY 600/1400/2400 the bar is at 0 and
exactly one axis heading is pinned, and it is the axis you are inside · the bar
is exactly `--bar-h` tall · a sticky first column survives a sideways scroll.
PASS at all four widths, 3 skips the gate names itself. The pane rule is the
reversal — see the gate note below.

**D9 · Ableton export — WORKS at P0, and one deferred item closed itself.**
The `.als` round-trips against the SONG, conforms to the donor, and the sample
audit finds no authored absolute paths. **`tomHi`/`tom`/`tomLo` no longer all
export as GM 47**: `export/als.js` `GM_DRUM` gives `t`→50, `m`→47, `l`→43,
because P0/P1 read `plan.timeline()` with the lane letter still on the event
rather than the `barPlan` path that drops `L.tom`. The comment names the exact
condition under which the collapse returns. Gate 4 — whether a set **opens** —
only Live can answer, and it is still question 8 below.

### Everything since the nine

**The grids rotate.** Paul: *"Rotate the drum kits and motif editors to be
vertical. They'll fit on a phone screen that way."* Steps run DOWN now. The
motif grid is **292.8px** and the widest kit the catalog can build is **272px**,
both inside the **296px** column a 320px phone leaves — so they do not scroll
sideways, and the horizontal scroll container they used to live in is gone. That
container was not neutral: it is what caused the snapping you reported. The
shell gate's A5 was rewritten to assert the new truth (see the gate note below).

**The form is rows, and Performance is a tab.** Boot lands on the form LIST —
five section names as rows; tap a number and its questions open. Performance has
its own tab with its three nudges.

**The live score — the whole band, two bars at a time, above the tune you are
writing.** Paul: *"add a section ABOVE motifs which is the current playing
music, two measures at a time, but ALL."* A stave per voice, bracketed, barlines
running through, the playhead walking down. It reads `sectionRender(...).ev` —
the same stream the transport and the bounce are handed — **not** `voicePhrase`,
which exists only for LINE voices and would have shown 2 of 8 staves on a
precomposed record. The consequence is written into the file rather than
discovered: **the score and the composed staff below it CAN differ**, because
the stream has been through entry, envelope, intro/outro, harmonize and groove.
That is the difference between a conductor's score and a player's part, and
where they disagree **the score is the report**. The window advances by TWO,
never one; a window change is held 200 ms before it is painted (the bar feed was
measured reporting 0 → 2 → 0 inside 100 ms at a pass boundary, so a contradicted
window never reaches paper); silent voices keep their staves as rests, four of
eight on the yachtrock record; percussion gets `K:none`. The block is the same
height stopped or playing, because a section that appears on play is the
interface changing. Window turns went **110–251 ms → a longest task of 79 ms**.

**The motifs became tabs, and the transforms became pictures.** The page went
**8,357 → 6,277px at 390 (−25%)**, and playing height equals stopped height at
both widths. The editor moved out of `#staff` so that name means what it says;
the ORDER Paul asked for — *"The motifs should stay with their editors!!!"* —
is unchanged, staff then the grid that writes it, adjacent. The seven transform
icons are generated from one shared contour so they are visibly the same tune
transformed. That narrowly reverses PLAN.md's *"No icons anywhere"*, on the
record: the old law was about actions with no visual form, and these are
geometric operations on a shape you are looking at. The words stay in the DOM as
the accessible names.

**The page stopped moving under the hand while it plays.** The editable half of
a motif is byte-identical across a section boundary, the same DOM node under a
finger, the window moved 0px. Gated by `test/motif-frozen.js`. The measurement
that found it is worth keeping: every long task ≥100 ms on the shipped chant was
a `draw()` — 409/436 ms at 390px, 419/1516 ms at 1400px — and the per-beat
`lightStep` sweeps produced **none**. The suspect in `PROGRAM.md` F5 was wrong;
the demand for a measurement before a guess was right.

**Africa has a history, and the graph stopped lying about who begat whom.** Five
African anchors in three cities became **fourteen in nine**, and the oldest
record in the box is now Aksum 540 — sixty years before Rome 600, with the
comment saying out loud that the date is a traditional attribution to St Yared
*and* that Rome 600 is the same kind of claim on the same evidence. Then the
genealogy, where the real damage was: `parents` is not decoration, because the
fit tool measures "the invention" as the residue after ancestors, so a wrong
parent is a wrong measurement. **Fourteen inversions** were repaired — bossa
declared 100% New York, bailefunk descending from bebop through bossa, worldfolk
descending from afrobeat (Lagos and Johannesburg are not a lineage), `hymn`
descending from `gospel`, a hundred and one years backwards. And a conservative
half that matters as much: a list of anchors that are NOT wrong and must not be
touched, with reasons. `AFRICA.md` is the account.

**The master chain.** *"Almost everything is once again loud and distorted and
there's no way to bring it down."* Three suspects were named and all three were
measured OFF and exonerated (whole desk tone withheld: 0.32 dB QUIETER; FAM_EQ
alone: 0.33; reverb return shut: 0.11; precompose desk removed: 0.00). It was a
threshold crossed, not a line changed — the box now plays 139 precomposed
full-band anchors where yesterday it played dice rolls, and the master chain was
built for material that was quiet. Three fixes, all in the parent:

* **The fader was the last node**, after the bus comp, the make-up, the
  compressor and the limiter. Swept on Tampa 1990 it moved the level at every
  position and **never once moved the crest** — 8.2 / 8.2 / 8.1 / 8.1 / 7.7 dB.
  That is "no way to bring it down", literally. It now sits at the master bus
  INPUT, and the crest recovers as you go down: **7.76 / 9.37 / 10.14.**
* **The +8.3 dB make-up was a constant written for material that no longer
  exists** (its own comment: *"the sampled voices play dry and quiet"*). A
  precomposed band record arrives at −9.4 dBFS, so the brickwall sat in
  permanent gain reduction. It is now a target riding toward −14 dBFS, **capped
  at the old constant** so nothing comes out louder than it did and quiet
  material still gets exactly its old +8.3 dB, read **pre-fader** so turning
  down can never make it push back up.
* **The ceiling was not the last thing the signal touched.** Two RBJ lowpasses
  parked at 20 kHz sat AFTER the limiter, at 0.907× Nyquist where the
  bilinear-warped biquad has a passband peak. **227 clipped samples across eight
  records → 0.** The quiet ones are unchanged (chant −14.63 → −14.66); the hot
  ones came back and got their transients back (toto 3.2 dB quieter, +2.4 dB of
  crest).

Also: **`FAM_EQ`'s rows are centred to zero mean dB in code.** Eight of twelve
were net boosts as typed — harmless while the number was computed and thrown
away, wrong the day it became a real stage, because a colour must not also say
"louder". The table keeps the shape its author typed; only the level comes out.

**The test runner.** `node test/all.js` is concurrent (a browser gate costs 2, a
node gate 1, budget = cores), selective by dependency closure
(`--impacted --changed <files>`), and content-caches the option table's
derivation. `--complete` restores full breadth and says so in its own output.
Measured today, box otherwise idle: **15 gates, 0 fail, 415.9 s wall against
721.4 s serial (1.7×)**, and the cached `gates` gate at **0.4 s** against
**173.3 s** when it re-derives.

---

## THE GATES, AS THEY RAN TODAY

`node test/all.js` (default FAST), 2026-08-25, this box, 4 cores, nothing else
running, 14:07 → 14:14. **Load at start 1.11 2.71 3.88 · load at end 3.00 3.74
4.01** — the runner prints the load on every run for exactly this reason, and a
wall clock taken on a contended box is not this suite's cost.

```
pass  precompose     37.1s  29 passed, 0 failed
pass  desk            6.4s  all 85 checks pass
pass  ableton         2.2s  gate 3 — no new sample references · no authored absolute paths
pass  document        0.4s  22 passed, 0 failed
pass  atlas-data      0.5s  PASSED all 34 checks
pass  atlas         119.9s  ALL PASS (91 checks)
pass  sheets         32.0s  ALL PASS (28 checks)
pass  producer-ui    29.8s  ALL PASS (28 checks)
pass  nudges         29.2s  ALL PASS (24 checks)
pass  shell          23.9s  PASS — every shell assertion holds (3 skipped)
pass  selects        18.4s  ALL PASS
pass  sheets-tier     5.5s  ALL PASS (29 checks)  test/fixtures/sheets-harness.html
pass  producer      291.0s  26 passed, 0 failed · G3 SAMPLE, 20 of 200 random stacks
pass  gates           0.4s  OK  the shipped table is what the box says. (cached)
  — and one alone, because everything it asserts is about time —
pass  motif-frozen  124.6s  all checks pass

15 pass · 0 fail · 0 skip     FAST · 415.9s wall (serial 721.4s — 1.7x)
```

**FAST is not the deploy gate and says so itself** — the producer samples G3's
cross product (20 of 200 random stacks) and the option table's derivation is
skipped when its inputs are byte-identical. `node test/all.js --complete` is the
deploy gate, and it also ran today, on a contended box: **15 pass · 0 fail · 0
skip, 836.0 s**, with the producer printing *"G3 COMPLETE — every sentence at
every rung, all 200 random stacks"* and `gates` re-deriving in **173.3 s**
instead of reading its cache. Same gates, same assertions, more breadth.

**One caveat on the tree this measures.** The FAST run above finished at
14:14:49, and at **14:17:44** `nukernel/nu.css` and `nukernel/ui/atlas.js` were
both written by somebody else — three minutes after the last gate exited. So the
table is a true reading of the tree **as of 14:14** and does not cover those two
files. Re-run before you trust it as the tree you are looking at.

**Nothing is red.** That sentence is only worth anything because of what was
done to get there, so it is written down: **eleven assertions across five gates
were red this morning, and every one of them was rewritten to assert the new
truth with the reason attached — none was deleted and none was relaxed.** The
reversals, in short:

* `shell.js` **A5** asserted *every `<table>` sits inside a `.nu-pane`
  horizontal-scroll container*. The rotation made that false by design. It now
  asserts **no table overflows the box it is in** (measured geometry:
  `scrollWidth` vs `clientWidth+1`), plus a new **A5c: no `.nu-pane` around a
  rotated step grid** — which pins the exact unnecessary scroll container that
  caused the snap. `PROGRAM.md` §5's gate table still prints the old sentence;
  that file has not caught up.
* `shell.js` **A8** (sticky lane `th` survives a sideways scroll) had been
  scoped to a pane that no longer exists, so it SKIPPED at all four widths and
  asserted nothing. It now runs against **every pane that actually scrolls and
  declares a sticky first cell**, and runs for real at 320px: `nu-board`
  overflows by 36px and holds to 0.5px.
* `selects.js` **check 3** was an allowlist — "exactly this list of menus and no
  more" — a transcript of one afternoon, and it named 48 correct controls red.
  It now asserts the RULE off the page, which covers controls the file has never
  heard of.
* `sheets.js` **gate 6** asserted *a pad's "at the fifth" is disabled*. Stale,
  because `gates.json` is EXTRACTED and the extractor fits no rule to that word
  any more (transposing a pad up a fifth is still audible). It failed on both
  pages and the page was right on both. It now asserts the LAW — 0 greyed
  before, 8 after, each printing its own reason, `out` never among them.
* `sheets.js` **gate 8** asserted ArrowDown traversal on a radio-group sheet.
  There is no such sheet on the shipped page. On `index.html` it now asserts
  **that fact**; the traversal claim is preserved by running the same file
  against `test/fixtures/sheets-harness.html` as the new **`sheets-tier`** gate
  — because a claim that only ever skips is a claim nobody is making.
* `desk-gate` **G11** asserted *no `<select>` on the board or in the atlas*. 15
  master/bus menus are back. It now asserts the two claims that were ever the
  point — **not one dropdown on the channel strip** (measured: 15 selects, all
  in `#board`, **0 in `#boardtbl`**, atlas 0) and every other `<select>` outside
  `#app` is one of the rack's own.

**Three gates were broken rather than stale, and a broken gate asserts nothing:**
`test/sheets.js` **crashed** at `readDev` on a null key, taking every assertion
after it and the three before it; `test/producer.browser.js` crashed the same
way at `hot.prod.notes[0].w`, after three taps that had silently reached nothing;
and `test/sheets.js` was **surveying an empty room** — `#app` boots on a list of
five section names, so gates 1/2/3 took one snapshot of a page with 0 sheets,
which made "0 sheets drawn" a real failure and "NO DEVELOPMENT WORD IS A MENU
[]" a **vacuous pass from the same snapshot**. All three are guarded or walked
across every tab now, and the union exposed three further failures the empty
page had been hiding.

The soak is **not** in the runner and was **not** run: *"Don't do the soak."*

---

## STILL DEFERRED

`PROGRAM.md` §4 had fifteen; the last STATE.md added six. All twenty-one walked.

### Closed, with what closed it

* **16 · the start-up hole** — the prefill landed (commit `3fa9ee9`). Closed in
  code; see the first section for why no fresh number is quoted.
* **17 · precompose writes no desk, no buses, no fx** — 0 of 122 became **139 of
  139 with buses, 583 of 981 voices with a desk, 23 records with fx.**
* **18 · `time.groove` says `funk` or nothing** — 97/25 became six words:
  backbeat 55 · push 28 · none 28 · funk 14 · laidback 9 · dub 5.
* **19 · the map is cropped and unswipeable at 390px** — the flat map is gone.
  The globe replaced it, and both of `GLOBE.md`'s own defects (pinch anchor,
  diagonal drag) are fixed in code.
* **20 · 23 `<select>`s remain, all on the board** — the channel strip has **0**;
  the 15 master/bus menus that remain are single choices at the master end,
  drawn once each, which is the rule, and `desk-gate` G11 asserts it.
* **5 · `tomHi`/`tom`/`tomLo` all export as GM 47** — 50 / 47 / 43, with the
  condition for the collapse's return written down.
* **F5 · `eight.js`'s own main thread** — measured, and the suspect was wrong.
  The whole-page rebuild it found is gone and `test/motif-frozen.js` holds it.
  Kept in `PROGRAM.md` as a law about measuring before guessing, not as work.

### Still open, re-measured today

The number in brackets is its id in `PROGRAM.md` §4, so nothing is renamed out
of sight.

1. **[§4·1] F1 — the two nginx headers.** Checked at 14:12 today: `www.ftrain.com`
   serves the page with **neither COOP nor COEP**, so `SharedArrayBuffer` is
   undefined and the page demotes to a different engine with no conceal and no
   counters. `test.stellate.app` **is** isolated (`cross-origin-opener-policy:
   same-origin`, `cross-origin-embedder-policy: require-corp`). An ops line
   outside the repo.
2. **[§4·2] F4 — the per-note channel strip.** `engine/faust/voices/sampler.js` builds a
   whole strip PER NOTE. Untouched. Behind ears, because it is the one item that
   can change how a record sounds and `mixPCM` must not move.
3. **[§4·4] Ableton P1–P4.** P0 needs nothing. P1 and locators need **Ask #1** (one
   30-second Live save with an 8-note clip in a slot, a copy in the Arrangement,
   one locator); P2 needs **Ask #2**. Gate 2 is written to REFUSE `<Locator>`
   because the donor has none, so the failure is the trigger.
4. **[§4·6] Augmentation and diminution as Development words.** Implemented in
   `ideas-kit.js:618,644` over a RENDERED phrase, therefore unnameable in
   `WORDS`. **No kernel operator maps step *i* to step *2i*.** Do not fake it.
5. **[§4·7] `bassGrid` has no document slot** — now **18** anchors declare one (was 15)
   and precompose loses every one.
6. **[§4·8] `orn` is declared by zero of 139 genres.** Re-measured today: 0 records
   carry `performance.orn`. `kernel.js:1029` is a complete ninth type with its
   words written; deciding which music decorates is a catalog table nobody has.
7. **[§4·9] The theme composer and the solo ladder.** `ideas-kit.js` is a second
   material model beside the hand-written grid; D5 uses it to WRITE cells,
   wiring it as an editable surface is a slice of its own.
8. **[§4·10] `fitReg`.** Re-checked: `precompose.js:1026` still writes `G.reg(v)` raw and
   `band-kit.js:1379 fitReg` is called nowhere in the precompose path. Measured
   19% → 7% of seats out of compass. Ten lines against `instruments.js RANGES`.
9. **[§4·11] Bus 3 is not the ping-pong**, and master `width`/`tilt`/`ceiling` still
   draw disabled saying *"this one round-trips and draws but reaches no sound"*.
   Now compounded — see the `pp` item below.
10. **[§4·12] A per-section desk is not expressible**, and after the EQ round **a
    per-section EQ is not either**: a voice's tone is one decision for the whole
    record. Right for the Sound axis today; wrong the first time somebody wants
    a chorus louder than a verse.
11. **[§4·13] `cast.part` collapses to line/pad.** `ui/eight.js` hands the kernel
    `realize` and never `part`, so a voice the document calls a `counter` is
    ADDRESSED `line2`. The board prints the address under the name so the two
    are never confused, which is honest, not fixed. Fixing the name **moves the
    music** (`kernel.js:1387`).
12. **[§4·14] Two catalogs of place and era.** G5b now passes with `ERAS` a proper
    superset of band-kit's `DECADES`, but the 30-record `when/where/venue` table
    at `band-kit.js:887` still says **"Rio"** where `genres.js` says **"Rio de
    Janeiro"**. The merge is its own job.
13. **[§4·15] F7 — the two open WAV-route audit items.** They only matter if F1 slips.
14. **[STATE 21] Two sticky axis headings coexist at the handoff** at 1280px.
    **Not re-measured** — the page is tabs and rows now and the axis structure
    it described has changed shape, so I cannot say whether it survived. The
    gate's "exactly one pinned `h2`" passes at the positions it samples, at all
    four widths, which is what it always claimed.

### New today

15. **The anchor corpus is one record**, above. `gates.json` `anchors: 12`, all
    twelve the shipped chant. One expression in `gates-extract.js`, ~25 min of
    offline derivation behind the content-hash skip. **This is the highest-value
    item on the list**, because it is the only one that changes what the page
    says to you today.
16. **`inv` is dropped on the way into a document** — `precompose.js:469`.
    One line; two anchors (`marabi`, `mbube`) currently carry a dead field.
17. **The `vox` guest pool is European** — `compose.js:1296`, above.
18. **Nineteen parent-after-child pairs remain in the genealogy.** This round
    fixed `hymn` ← `gospel` (101 years) and left `gospel` ← `blues` (Chicago
    1932 ← Chicago 1952) in the anchor it was editing. Also `spem` ←
    `counterpoint`, `beatles` ← `motown`, `jazz` ← `blues`, `crooner` ←
    `doowop`, `clubpop` ← `house`, `screamo` ← `emo` and twelve more. Some are
    defensible as proxies for an unbuilt ancestor; **none says so.** One sweep
    with a rule, not another anchor at a time. (`AFRICA.md` 4.)
19. **`rai` measures 95% invention, `ethiojazz` 69%, `mahraganat` 66%.** These
    are honest declarations of a hole — the true ancestors are not in the
    catalog — but a reader of the published residues will read them as
    originality. They need a word for "unexplained because absent".
20. **The `pp` send vanishes in the buffered tail.** Both renderers route a
    voice into the buffered path when it has an insert chip **or, new this
    round, a board tone** — which after `FAM_EQ` is very nearly every voice —
    and **that tail does not write `buses.pp`** while the direct branch does. A
    trap set, not sprung: measured across 20 precomposed records and 22,145 drum
    hits, **zero events carry a non-zero `pp`**. `desk-gate` G8b will stay green
    through it, because its own fixture feeds `curPP: 0`. The margin notes are
    written in both renderers; no fix. Fix it or write down a decision **before
    the snare throw is next wanted**.
21. **No drum-kit spectrum on the tape.** `EQ.md` §7 says it plainly: the kit is
    proved by reading the numbers and by the gate's isolated audio, not by a
    measured spectrum, because the chant has no kit and both routes to a record
    that does were shut while the verifier worked. A twenty-minute job now that
    the map has settled, and the one measurement that report is missing.
22. **No bus EQ and no master EQ.** The three knobs are per channel. Nothing on
    the reverb return, the delay return, or the master.
23. **`PERCBANK`'s 24 real percussion hits are unread by nukernel** — grepped,
    zero references — so maracas ride the hat lane and congas ride the toms.
    `AFRICA.md` calls this "the single highest-value piece of work behind this
    round, and it is not African-specific."
24. **The twelve-pulse metre does not exist.** `kernel.js:349` defines
    `six: {steps: 12}` but every phrase, cell and kit vector is written on
    **sixteen**, so a 12-slot bell under a 16-step seed **phases** rather than
    becoming 12/8. Ewe agbadza, the mbira's 48-pulse cycle, gnawa, mbalax are
    all unsayable; **chimurenga (Harare 1977) is metre-blocked and nothing
    else**, and is the first thing to build the day a twelve-step seed exists.
25. **`MOTIF.md`'s two, unfixed.** Nudge a degree slider and the page still
    jumps **114px** and the grid snaps back to step 1 — and it does the same
    with the record STOPPED, so it is the page rebuilding because you touched
    it, not the clock. And `<p id="engine">` shoves the page down **34px** on
    the press and another **18px** when its sentence wraps to two lines at
    390px; the `#engine { min-block-size: 1lh }` recipe was written and never
    applied, and one line does not cover a two-line sentence.
26. **`GLOBE.md`'s three cosmetic ones, unrechecked** since the 03:30 commit: at
    the deepest zoom the earth is an outline rather than land and sea (an open
    run cannot be filled); the page may still open zoomed to 57° on a wide
    desktop; the slider is the browser's blue.

---

## WHAT ONLY YOU CAN DECIDE

Each is one question naming the thing to listen for or look at.

1. **The silence before the first note.** Press play and count. The ring now
   fills before it releases a frame, which is what closed the start-up
   crackling; the price, measured at `--load 2`, is **first heard sample at
   9.78 s instead of 7.50 s — 2.3 seconds more silence, and no hole.** Is that
   trade right? If it is not, the retreat is a **smaller prefill, not none**: 5 s
   still covers the measured deficit.
2. **The deep runway.** Change a genre, the tempo, or a section *while it is
   playing*. Is the delay before you hear the change tolerable? It buys a buffer
   that does not empty by spending up to ~5 s of heard lag. If it is wrong the
   retreat is **5 s, not 3 s.**
3. **The master make-up is no longer a constant.** It now rides toward −14 dBFS
   instead of sitting at +8.3 dB, capped so nothing comes out louder than it did
   yesterday. Play a loud record and a quiet one back to back — **does the box
   sound like it is levelling them, and do you mind?** A rider is a decision
   about whether the box has an opinion about loudness.
4. **Is the solo voice still too breathy?** `FAM_EQ` was centred to zero mean
   dB, which fixed eight families that were quietly getting louder — but the
   `vox` row is `{mid: −1.5, hi: +1}`, whose mean is negative, so centring
   moves it to `{lo: +0.2, mid: −1.3, hi: +1.2}` and **nudges its air UP by
   0.2 dB.** This one specifically may not be solved. Play the chant and listen
   to the top of the cantor.
5. **The reverb return, opened.** Play the shipped chant. Every genre sends
   `tone.verb` and until this round that send went into a muted bus. **Does it
   sound like a stone room?**
6. **`fx` back on a track.** This reverses your 2026-08-17 directive (*"get rid
   of inserts, reverb, and echo — let me send to bus 1, bus 2, and bus 3
   instead"*). The argument is that the sends are wired to real returns now, so
   a chip is only for what must be IN the path. Do you accept the reversal?
7. **`--cell: 36px` on a real phone.** Sixteen 36px cells; 36 clears WCAG AA but
   not Apple's 44. Since the rotation the cost of going to 44 is a taller block
   rather than a second swipe per bar. **Does your thumb hit the cell you
   meant?** Do not ask for a toggle.
8. **Gate 4 — Live.** `node tools/ableton/export-als.js --genre boombap --out
   /tmp/n.als`, then open it in Live 12.4.3. **Does it open?** Only Live can
   answer; `verify.sh` has always missed this.
9. **The eight 2020s anchors, as taste claims.** amapiano · bedroompop ·
   afrobeats · hyperpop · mahraganat · bailefunk · punjabipop · corridotumbado.
   Drag the slider to the end and play three of them. **Does "now" sound like
   now?**
10. **The ten new African anchors, as taste claims.** Nine of ten named pairs sit
    further apart than the median pair in the genealogy's own feature space, and
    highlife fires 782 timeline hits and 272 claps where rock fires neither — so
    they are *distinct*. Distinct is not *right*. **Does highlife sound like
    highlife, or like the default in a costume?** (`AFRICA.md` §"Does it sound
    like itself".)
11. **`zema` specifically.** It is the weakest new anchor — **0.380 from
    `gregorian`** in the genealogy's feature space, the closest of the new ten to
    an existing one, and flagged by its own author rather than found later. It is
    also the record with the church organ in it, above. **Should it be in the
    catalog at all?**
12. **The `IDIOM` table.** Ten family rows and about twenty anchor overrides are
    a taste claim. The precompose gate prints which family row each anchor
    resolved to. **Does a punk hook sound like punk?**
13. **71 hand-typed coordinates.** Every new one was checked on land by
    point-in-polygon against the baked coastline. The gate catches a city in the
    sea; it cannot catch one 200 km off. Turn the globe once. **Is anything in
    the wrong place?**

---

*The deep reports, and how far each one can be trusted:*

* `PROGRAM.md` — the order the 2026-08-24 round was built in, and the contract.
  **Its §5 gate table still prints the pane rule the shell gate reversed**, and
  it does not describe the work after D9.
* `AXES.md` — the eight, and why genre is a correlation and not a ninth.
* `EQ.md` — the board's three knobs and the tape. Current. Its §9 warns you
  that a gate red at the time was another round's atlas surgery mid-flight; it
  is not, today.
* `MOTIF.md` — the page that moved while it played. Its findings are current;
  **its gate table is not** — it recorded 10 pass · 3 fail against a tree three
  other rounds were rewriting underneath it.
* `GLOBE.md` — the earth. Written 19:39 on 2026-08-24, so **its "Still open"
  list predates the 03:30 commit that fixed its top two items.**
* `AFRICA.md` — the fourteen anchors and the genealogy repair, and the best
  "what is still wrong" list in the building. Current.
* `WORLD.md`, `INTERVIEW.md` — what comes next. **Not built.**
