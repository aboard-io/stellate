# FUGUE — the counterpoint kernel at `/fugue`

**Decision (Paul, 2026-08-12):** *"Extract a totally new tiny version of this
system that makes fugues. As I scroll top to bottom it exhaustively documents my
options and I can see the effect of them in the interface element below."*

Two things at once: a **second tiny kernel** in the shape of `engine/ca.js`, and a
page whose **scrolling IS the documentation** — the opposite of `/ca`, on purpose.

## The kernel

```
subject   a short line, in ladder degrees
entries   [{ at, voice, transform, shift }]
```

`engine/fugue.js`, 200 lines. Everything else derives. It is the same shape the
CA kernel has — one datum plus a word in a small group of involutions — pointed
at melody instead of rhythm, which is why the two are siblings rather than rivals.

**The group is the whole vocabulary.** Retrograde and inversion are each their own
inverse and they commute, so `{1, R, I, RI}` is the Klein four-group: there are
exactly **four** ways to restate a subject by symmetry. Augmentation and
diminution are not involutions but a scaling whose product is the identity. Six
transforms, and that is genuinely all of them — every fugue in the literature uses
some subset. The gate proves the algebra rather than asserting it: each is its own
inverse, R and I commute, RI = R∘I, A∘D = 1, and the four symmetries are distinct
on an asymmetric subject.

**The ladder makes the classical rule an integer.** Degrees are 0..7 — the chord's
four lead-voicing tones, twice. The fifth of the voicing is slot 2, so *the answer
at the fifth is `+2`*. A subject written in degrees follows a moving harmony,
which is the one thing a fugue subject must do.

**No new interpreter.** Output is `state.melodyCells` (two upper voices an octave
apart inside one cell) plus a `counter` voice for the third, an octave below —
vocabulary csd-engine already speaks. A fugue is an ordinary state, so MIDI
export, the live walk and the mixer all treat it as one.

## IT DID NOT MAKE FUGUES. (2026-08-12)

**Paul: *"Those are serious bugs and I told you to make fugues."*** Both true, and
the second was the real charge. Every gate I had written tested the **plan**.
Nothing tested whether the line you drew survived to the rendered events — and it
did not. Three separate corruptions, all silent:

1. **The per-voice ladder offset clamped.** Voice 0 got `+4` slots to sit in the
   ladder's upper octave, so any subject reaching degree 4 ran off the top and was
   clamped — degrees 3 and 4 became **the same slot**. The first voice played a
   different tune from the one in the plan. The ladder is eight slots; it cannot
   hold three lines an octave apart, and pretending it can is how a fugue quietly
   stops being one.
2. **Transposition clamped per note.** `shiftDeg` clamped each note into range
   individually, which changes the *shape* — and the shape is the only thing that
   makes a restatement recognisable as the subject.
3. **THE ENGINE MUTATES EVERY PHRASE CELL.** `csd-engine`'s `note()` helper gives
   each cell note a 9% chance of being dropped, an 11% chance of moving half a
   beat, and a **9% chance of flipping octave**. That is right for a pop lick and
   fatal for imitative counterpoint. My "no new interpreter" boast cost the thing
   its identity: the fugue was getting a randomly mangled subject every time.

The fixes: voices are separated by a **real octave** (the `counter` voice's
`octave: -1`) and never by the ladder; transposition moves the **whole line by
whole octaves** or refuses; and `state.exactCells` renders a cell as written
(absent ⇒ the three draws happen exactly as before, byte-identical — `verify.sh`
13/13 confirms).

**Three voices is now the stated ceiling**, because three registers is what the
engine offers. A fourth would have to share and clamp.

### The gate that was missing

`test/unit/fugue.test.js` §5 reads the **rendered pitched events**, maps each
pitch back to its ladder degree through the chord's own lead voicing, and demands
every entry carry the transformed subject's degree sequence **exactly**. Measured
after the fix, the three-voice exposition:

```
  v0 @0  subject   0,1,2,1,3,2,4,2         shape: 1,1,-1,2,-1,2,-2
  v1 @4  answer    2,3,4,3,5,4,6,4         shape: 1,1,-1,2,-1,2,-2
  v2 @8  subject  -4,-3,-2,-3,-1,-2,0,-2   shape: 1,1,-1,2,-1,2,-2
```

The browser gate holds the same claim end to end. **Test the artefact, not the
plan** — every check I had written could pass while the thing failed at its one
job.

### Three more bugs, from the first build

- **The cell is one chord bar; the exposition is three.** A three-voice exposition
  spans three subject-lengths, so at the stock `chordEvery: 8` the third voice's
  entry landed past the end of the cell and **was dropped silently**. The chord bar
  is sized to the plan now, and the gate counts every planned note into a cell
  across all voice/overlap combinations.
- **`drums: "off"` does not mean drumless.** `state.thunk` puts a whisper-level tom
  under a fraction of lead notes, so a "drumless" fugue rendered **49 tom hits**.
  Off explicitly, because the base is an ordinary anchor and may carry anything.
- **`total` is where the last note stops, not where the last entry starts.** An
  augmented entry runs twice the subject's length; accumulating only the stepped
  gaps left it finishing *past the end of its own piece*, which drew an entry bar
  wider than its track and scrolled the page sideways. Fixed in the plan and
  clamped in the view.

## The page is the manual

Eight sections, top to bottom, one per option, and **the effect of each is
rendered in the element directly below its prose** — the gate asserts that
ordering, not just that both exist. Scrolling is reading the manual and playing
the instrument at the same time.

| section | option | its effect, below |
|---|---|---|
| the subject | draw it | an 8-row ladder grid, live |
| the answer | +0..+4 degrees | subject and answer, stacked |
| the voices | 2 / 3 / 4 | the entry map |
| stretto | 1 / ¾ / ½ / ¼ | the same map, compressing |
| the transforms | the six | one card each, drawing **its own** shape |
| the instrument | the anchor | — |
| the piece | all of it | the full roll, and ▶ |

**Every section plays its own configuration**, not the finished piece: the answer
section plays two voices, the transform section plays only what you added. Hearing
the whole fugue while being shown one option teaches nothing about the option.

**Scrolling here is the point**, which is the opposite of `/ca` and deliberate.
`/ca` is an instrument you play with a thumb and it must not scroll; this is an
explanation you read. Same engine, same kernel shape, different job.

## Gates

- `node test/unit/fugue.test.js` — 114 checks: the group algebra, the exposition's
  alternation, every planned note reaching a cell, a drumless render, real
  overlapping counterpoint (measured as overlap, not as an exact shared beat — the
  tape humanises every onset, so equality found three pairs and overlap found
  hundreds), and a spread of base anchors.
- `node test/browser/fugue.test.js` — 25 checks: eight sections in order, every
  option section carrying an effect panel **below** its prose, each control
  visibly moving its own view, five distinct transform shapes, five distinct play
  scopes, **it sounds** (peak 0.35), no percussion, the URL round-trip, a hostile
  link, and the standing laws — plus the shape claim end to end: every rendered
  entry carries the subject's exact interval shape, all eight notes, every voice.
