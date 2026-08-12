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

### Three bugs worth keeping written down

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

- `node test/unit/fugue.test.js` — 96 checks: the group algebra, the exposition's
  alternation, every planned note reaching a cell, a drumless render, real
  overlapping counterpoint (measured as overlap, not as an exact shared beat — the
  tape humanises every onset, so equality found three pairs and overlap found
  hundreds), and a spread of base anchors.
- `node test/browser/fugue.test.js` — 23 checks: eight sections in order, every
  option section carrying an effect panel **below** its prose, each control
  visibly moving its own view, five distinct transform shapes, five distinct play
  scopes, **it sounds** (peak 0.35), no percussion, the URL round-trip, a hostile
  link, and the standing laws.
