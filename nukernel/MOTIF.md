# THE MOTIF, TWICE — what happened to the page that moved while it played

Paul, 2026-08-24: *"When playing -- Don't change motifs visually or change the
editing interface. It's too confusing when it changes. Instead, show the fully
composed motif ABOVE the editable version of the motif."*

This is the verifier's report. Everything below was measured in a real browser
against the rendered page, with a harness written for this check and not the
one the builder used.

---

## FIRST, THE THING THAT STILL MOVES

**Change a note and the page still jumps.** Nudge a degree slider in the step
grid and the window scrolls **114px**, and the grid's sideways scroll snaps
back to step 1: measured at 390×844, the slider under your finger goes from
screen position **(206, 734) to (457, 848)** — off the right edge and below the
bottom. Your finger keeps working (focus survives; four nudges in a row all
landed, 1 → 5) but you cannot see what you are doing.

It is **not the clock**, and it is not new this round: the same edit, with the
record **stopped**, moves the page by exactly the same 114px and resets the same
grid. It is the page rebuilding itself because *you touched it*, which the
round's own law allows. But it is the same sentence from your side of the desk —
*the editing interface changed while I was writing on it* — and the first time
you edit a motif with the record running you will meet it. It is the one thing
worth doing next.

---

## WHAT WAS WRONG

Two lines, and they were the whole illness:

* `ui/eight.js:1446` — `on("pos", d => { … atSec = d.si; draw(); })`. **The
  whole page was torn down and rebuilt on every section change**, which on the
  shipped chant is every four to eight bars.
* `ui/eight.js:1478` — a second full `draw()` on `transport:state`, so play and
  stop rebuilt everything too.

And one more, upstream of both: `voicePhrase` (`:677`) began `if (!playing)
return ph`, so **the staff swapped its content on play** — stopped it engraved
the cell as written, playing it engraved the developed one — while the maker
grid under it (`:824`) went on editing the written cell. The picture changed
while you wrote on it.

Measured on the old behaviour, with nothing touched and one section boundary
going past: **the window moved 429px when you pressed play and another 114px at
the boundary**, the control you were holding was replaced by a different DOM
node, the step grid's sideways scroll was thrown away, and the slider ended off
the screen.

## WHAT IT DOES NOW

Every pitched voice gets **two staves**. The upper one is the fully composed
motif — the section's development word actually applied — with its own caption
saying which section it is showing and in what tense (*"as played in verse 3: in
retrograde — you are writing head 1"*). Under it, a constant label **"as
written"**, then the staff you are editing and its step grid, which never
change unless you change them. The composed staff is there whether the record
is running or not, so pressing play adds nothing and removes nothing.

The clock now writes in exactly two places, both inside the composed block: a
caption's words, and a composed measure's notes.

## THE PROOF

My own harness, both viewports, pressing play and crossing two **proved**
section boundaries (the sounding section was polled, not slept through — the
first boundary lands at ~23s, not the 16.5s the arithmetic predicts, because
the engine runs a runway).

| what | 390×844 | 1400×900 |
|---|---|---|
| the editable half, before vs during play | **byte-identical**, 135,291 chars | **byte-identical**, 135,329 chars |
| every control — value, size, position | **621 unmoved**, 0 changed | **621 unmoved**, 0 changed |
| after stop · after play→stop→play | identical · identical | identical · identical |
| the composed half | captions moved, 4 → 6 engravings | same |
| editing controls inside a live block | **0** of 40 live elements | **0** |

**Nothing touched, one boundary going past** — the honest version of the
complaint: the *same DOM node* is still there afterwards, focus held, the step
grid's sideways scroll held at 250px, and the slider stayed at screen position
(207, 790) **before and after**. The boundary moved the window **0px**.

**The main thread.** 60 seconds of playback, two boundaries, long tasks ≥100ms:

|  | before | after |
|---|---|---|
| 390px | 302ms on the press, **163ms and 227ms at the two boundaries** | 213ms on the press, **nothing at either boundary** |
| 1280px | 434ms on the press, **240ms and 247ms** | 281ms on the press, **nothing** |

Total blocked time after the first three seconds: 390ms → **0ms** at 390px,
616ms → **0ms** at 1280px. The press itself still costs one task — that is the
audio engine starting, and it is your gesture. *(PROGRAM.md §4 item 3 quotes a
1516ms freeze at 1400px. I could not reproduce that number; with the two
handlers put back to `draw()` I measured 240–247ms per boundary. The shape of
the finding is confirmed, the worst-case figure is not.)*

**The composed staff is really composed**, not a copy:

* *head 1*, word `as written` — the two engravings are identical, path for path.
* *verse 3*, word `in retrograde` — composed reads **45 41 37 37 37 41**,
  written reads **41 37 37 33 37 45**: it starts on the written phrase's last
  note and ends on its first.
* *verse 4*, word `the head only` — composed is the first two pitches looped,
  eight notes; written is six.
* the schola in *head 1*, word `out` — a bar of rest, captioned *"the schola is
  out in head 1"*, and the bar still takes exactly the room the written bar
  takes.

**The playhead never touches the staff you are writing on.** Over 45 seconds of
playback, 263 lit noteheads, **every one of them in the composed block, zero on
a written staff**; stop clears them all.

**The page does not change height as the record plays.** All five sections of
the chant at 390px: the two live blocks stay 112px and 130px throughout, and
everything under the staves stays put.

Pictures — `/home/ford/.claude/jobs/c1b341cb/tmp/shots/`:
`motif-stopped-390.png` / `motif-playing-c3-390.png` and
`motif-stopped-1280.png` / `motif-playing-c3-1280.png`. Hold the stopped and
playing pair side by side: the bottom half — labels, staff, radios, sliders,
buttons — is the same picture twice. Only the top staff and its one line of
caption differ.

**Would a person editing a motif while the record plays find the page calm?**
Yes, as long as they are only *looking*. Nothing moves, nothing is rebuilt, the
red note walks along the upper staff and the lower one sits still. The moment
they *change* a note, the page jumps — see the top of this file.

## STILL NOT COVERED

1. **The edit jump**, above. 114px and a grid that snaps back to step 1.
2. **The engine readout shoves the page down twice.** `<p id="engine">` sits
   above `#app` and is empty until you press play; on the press it becomes one
   line and the whole editable page drops **34px**. That much was known, and a
   recipe was written for `nu.css` (`#engine { min-block-size: 1lh }`) and has
   not been applied. What was not known: at 390px the sentence it prints after
   a dropout — *"stream · runway 3.1s · 1 dropout, worst 168 ms, last at 0
   min"* — **wraps to two lines**, and a dropout happens in the first half
   minute of every playthrough (STATE.md item 16). Measured: at **t+35s**, with
   nobody touching anything, `#engine` went 18px → 36px and the whole page
   dropped another **18px**. That is the clock moving the editing interface,
   and a one-line reserve does not cover it. At 1280px it does not wrap.
3. **A composed measure that needs more room than its written twin** would grow
   the page once. None of the chant's words does; the reserve is `min-height`
   on purpose, so such a bar would be readable rather than clipped.

## THE GATES

`node test/all.js` — **10 pass · 3 fail**. **`motif-frozen` passes (123.3s).**
None of the three failures is in this round's files, and all three are in files
another workflow was rewriting *while the suite ran* (`gates.js` and
`gates.json` were rewritten at 16:45, `ui/atlas.js` at 17:01, mid-run):

* **`gates`** — failed against a table that was being regenerated underneath it.
  Re-run afterwards: **`OK the shipped table is what the box says.`** Transient.
* **`nudges`** — 2 of 23, both `pipe:strum`. A new rule `strum: when
  cast.hasPad` appeared in `gates.js` at 16:45; `test/nudges.js` (untouched
  since 08:11) still expects exactly seven drum edges to grey. Still failing.
* **`desk`** — 1 of 77: *"the atlas keeps its three — era, look at, and the
  fallback listbox"* found **zero** selects. `ui/atlas.js` turned them into
  something else; the desk gate's expectation has not caught up. Still failing.

Passing: document 22 · precompose 29 · ableton gate 3 · producer 26 ·
atlas-data 32 · shell (1 skipped) · sheets 19 · atlas 65 · producer-ui 27 ·
motif-frozen.

## ONE CAUTION ABOUT THE GATE ITSELF

`test/motif-frozen.js` proves the frozen half is byte-identical. I put the two
old `draw()` calls back and ran the same comparison: **it was still
byte-identical** — a full rebuild produces the same HTML. Byte-identity is
necessary and not sufficient. What actually separates the two builds is the
three things this report leans on: *the same DOM node is still there*, *the
sideways scroll survives*, and *no long task lands at a boundary*. If this file
is ever revisited, those are the assertions to keep.

---

## THE BENCH (2026-08-27) — the rows themselves changed, the laws did not

Paul, 2026-08-27: *"The original button structure with sliders was more novel
and comprehensible"* — then, later the same day: *"Tighten it up. play/hold/
rest, pitch offset −12 to 12, velocity 0 to 7, tightened to one line, and
factor in different scales, and accidentals vs locking in scale degrees."*
The design is `nukernel/ideal/composer.html` (the Bench) and this wave built
it into `ui/eight.js`.

**What changed.** The motif maker's three radios + two range sliders per step
became ONE 52px line: `[count] [play/hold/rest as one segmented button]
[a bipolar pitch bar] [a weight bar]`. The kit's checkboxes became velocity
cells — one button per step whose fill's width is its level, number at the
edge, tap cycling rest → ghost → hit → accent → rest, sideways drag writing
any of the eight (`touch-action: pan-y` — sideways is the value, vertical is
still the page). Every drag surface takes `setPointerCapture` and declares
`touch-action` on the control only; the native `<input type=range>` stays
inside each bar as the keyboard channel.

**The data-model mappings (extraction, one owner each):**

* KIND is the document's own `play[]` — `"n"/"h"/"r"` — unchanged; the
  segmented button presses the same codes the radios pressed, same `data-k`.
* PITCH is a VIEW over `deg` (scale degrees, −7..7). The bar displays
  semitones −12..+12 through `toGenre(DOC, editSec()).scale` (document.js's
  own resolution) and `K.pitch(deg, scale)` (the kernel's own arithmetic).
  The ink ticks ARE the lattice; a drag lands only on them. LOCKED MODE ONLY
  this wave — the accidentals toggle is drawn REFUSED with its reason (needs
  the chromatic/cents alphabet, Phase 4).
* VELOCITY: the document stays 0..9 (kernel's clamp; lanes' "ghost is a 2,
  accent is a 9"); the view is Paul's 0..7. ONE mapping, stated once at
  `V7/V9` in eight.js: `view = round(doc·7/9)`, `doc = round(view·9/7)` —
  identity on the round trip, ghost 1↔1, hit 4↔5 (the kernel's mezzo),
  accent 7↔9. Lanes add one clause: doc 1 (the old binary "on", defers to
  the hand) reads as view 4 and is never written by this surface; doc 2 (the
  kit's ghost) ↔ view 1. Old saves load unchanged.

**What did NOT change — the laws this file exists for.** The count cells are
still the playhead's only registry (`countCell`/`mark()`, untouched); nothing
inside `[data-live]` is a control; `sync()` is still the one owner of every
stated fact; `edited()` is still the only commit; the written staff and its
reserved heights are untouched; playback rebuilds nothing. Re-proved after
the cut: `test/motif-frozen.js` all green at 390 and 1400 (A3 byte-identical
across two boundaries, A7 zero long tasks).

**The new gate is `test/bench.test.js`** and it measures the RENDER: a drag
lands only on lattice values and the badge prints the document's own
semitone; the tap cycle hits 1/4/7 and never 0; the sixteen rows keep exact
geometry across kind changes (52px each); a CDP TOUCH drag writes the value
and scrolls the page zero pixels; the kit cycle writes doc 2/5/9/0 and never
the deferring 1; five seconds of playback leaves the frozen half
byte-identical.

**The knob reaches the sound, measured on rendered audio** (AnalyserNode
before `destination`, first-section window, edits made through the rendered
bars): all-accent vs all-ghost = RMS 0.165 vs 0.047 (3.5×); the pitch+vel
edit moved the averaged spectrum 2.2 dB/bin from the shipped record.

**The wisdom rail** ships with what the page already computes: step, count
word, degree name from the record's own scale, the pitch class held against
the MODE, the velocity word. **Deferred:** role-under-the-chord — the prog is
read cyclically per SONG bar, so per-step chord windows are not a fact this
page computes yet; when `chordsOf`'s windows are surfaced, the rail gains
that sentence. Also deferred: the development landing markers per row
(composer.html ann. 6) and the kit's swing-displacement display (no swing
display existed here; none was invented).
