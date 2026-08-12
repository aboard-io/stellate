# CA — the automaton at `/ca`

**Decision (Paul, 2026-08-11):** *"There are so many options. Just look through
and think about what could be simpler … I don't want to manipulate sections; I
want to manipulate a rule system cellular automaton style and then it gets
interpreted by sectional rules about what makes a good chorus … Think of this as
a complex rules system using Riemannian transforms. What's the tiniest kernel?"*

The answer this program is: **24 bits.**

```
seed  16 bits    the row you tap in
rule   8 bits    one of the 256 elementary CA rules
```

Everything else — the drum kit, the bass cell, the melody cell, the chord
progression, and the **sections themselves** — is a pure function of those bits.
`engine/ca.js` is 375 lines; `test/unit/ca.test.js` holds it with 1072 checks. The
whole thing — kernel, page, both gates, CSS and HTML — is 2,059 lines.

## The diagnosis

`/daw` was not badly built; it was built five times. Measured on main the day
this started: **5,502 lines** of `app/daw` JS and 763 of CSS, ten editors, four
control primitives — because every layer had grown its own data type.

| layer | representation | its editor |
|---|---|---|
| drums | kit ops (`alt`/`cyc`/`last`/`pick`/`p`/`grid`) | pads + period chips |
| bass | 23 procedural cases + `bassCells` in degrees | table + cell grid |
| melody | phrase cells · an 8×8 weave matrix · `wander` knobs | three machines |
| harmony | 24 named `PROGRESSIONS` + the reharm walk | a picker |
| form | `sections[]` + `secover` per section per field | a five-row table × 8 |

And form was authored a section at a time. `secover` is careful, validated, and
still **a diff wearing a rule's clothes** — the exact thing docs/DAW.md's founding
constraint exists to forbid, arrived at from the other direction.

## The one idea

A sixteen-cell row and a triad are both acted on by **a small group of
involutions**, and a song is a **word** in that group.

```
on the row     rotate · reflect · complement      (dihedral, plus a flip)
on the triad   P · L · R                          (the neo-Riemannian group)
```

Same algebra, different clocks. That is what makes rhythm, harmony and form one
instrument instead of five panels.

## The automaton

Sixteen cells on a **ring**; the neighbourhood (left, self, right) indexes one bit
of the rule byte. Generation *n* is section *n*.

The state space is only 2¹⁶, so **every trajectory is a rho**: a *tail* of
transient rows, then a *cycle* it repeats forever. Computing it is microseconds,
and it is the whole structural fact about a song — the tail is the intro, the
cycle is the loop, `cycle` is the phrase length. Measured across all 256 rules
from one seed, the cycle lengths that actually occur are
`1 2 3 4 8 10 14 16 32 48 976 2688 6016`.

**Ring automaton, linear lenses.** The CA wraps because that is what makes it an
elementary CA. The lenses read the row *linearly* — cell −1 and cell 16 are dead —
because a musical bar has a downbeat and an end. A live cell 0 is therefore
always a run head, which is why the downbeat reads as a kick rather than as the
tail of a wrapped run. (A wrapping read also silences the bass on a full row: one
run with no rising edge, no notes.)

## The lenses

One row, read five ways. **No lens writes notes** — each emits vocabulary the
engine already interprets, so there is no new interpreter, no new rng stream, and
nothing here can desynchronise from `csd-engine`.

| lens | reads | emits |
|---|---|---|
| **drums** | position picks the lane — downbeats kick, backbeats snare, off-eighths tick — and anything inside a run is a hat | a `state.kits` entry in the shipped op grammar |
| **bass** | rising edges only; duration is the run length, degree alternates root/fifth and lifts an octave on a run of 2+ | a `state.bassCells` entry in chord degrees |
| **melody** | the running count of live cells to the left, folded into the voicing | a `state.melodyCells` entry in ladder indices |
| **harmony** | four nibbles → four popcounts mod 4 → a P·L·R word | a progression in the shape `voicing()` returns |
| **form** | the orbit's own statistics | `state.sections` |

Two of those deserve their reasoning stated:

**The melody read is a prefix sum, and that is the whole trick.** A per-cell pitch
read gives noise. A prefix sum is monotone, so folding it into the four-note
voicing gives a **contour** — an arch that climbs and folds. The gate measures it:
the first four notes are ladder 0,1,2,3 in order.

**A CA kit spends zero rng draws.** Every op is a static `hits` list — no `p`, no
`pick`, no `grid` — so the rack law holds for free and the kit is byte-stable.

**And the lens the page caught.** Both rhythm lenses originally keyed everything
on run structure alone: isolated = snare, run head = kick, run length = degree.
It reads well and it was broken, in a way nothing revealed until the page drew
the lanes under the row. "Isolated" is a *subset* of "run head" and was tested
first, so a lone cell could never be a kick — which means **four on the floor, the
most natural thing anyone taps, produced four snares and no kick at all**, over a
static root pedal. Position now carries the drum lane and the onset ordinal
carries the bass degree, and the gate asserts the specific case: four on the floor
is four kicks, straight eighths is a backbeat, single hits alternate root and
fifth. A lens that turns the most obvious input into nonsense is not minimal, it
is broken — and an abstraction you cannot see is an abstraction that hides that.

## The harmony: why neo-Riemannian

Each of P, L and R is an involution that moves exactly **one voice by the smallest
possible step**:

```
P  parallel        C ↔ Cm      the third moves a semitone
L  leading-tone    C ↔ Em      the root moves down a semitone
R  relative        C ↔ Am      the fifth moves up a tone
```

Three canonical closures fall out, and they are why the form layer can promise a
section that comes home:

```
(LP)³  = 1    hexatonic   — 6 triads, the "other world" that returns
(PR)⁴  = 1    octatonic   — 8 triads, the dark one
(RL)¹² = 1    the descending-fifths walk everyone already knows
```

`RL` on a major triad is a descending fifth (C → F), which is what makes the walk
recognisable rather than merely closed. All of this is gated, on all 24 triads.

**HONEST LIMIT.** PLR reaches only *parsimonious* moves. Root motion by a whole
step — F→G, the royal road this project is named after — is in the group but is a
~20-letter word. Word length **is** harmonic distance here, so the big functional
lifts are deliberately far away and stay the business of `theory.js`. What the CA
gives you is the smooth, chromatic, cinematic space.

Measured over the seed space: **77% of seeds give 3 or 4 distinct triads**, and
only 19 seeds in 9,363 collapse to a single chord. The read is not thin.

## The form is READ, never written

Each generation is classified from the row itself, and the role picks an
arrangement **mask** — which lenses are audible — not any notes.

```
rest    the automaton died here          pads only
intro   early, and below the median      pads only
verse   everything else                  pads + bass + drums
chorus  the seed, or a density peak      + melody      ← the melody entering IS the chorus
bridge  the row furthest from the seed   pads + melody ← the rhythm section drops out
outro   the last section                 pads + bass
```

Two thresholds were wrong in the first cut, and both failures are worth keeping
written down because they are the same mistake in two costumes — **a fact about
the ORBIT is not a fact about the SONG**:

- **A chorus must be scarce.** The 2/3 density quantile called **56%** of all
  generations a chorus. The peak quantile plus a strictly-above-median guard puts
  it near a sixth, and verse becomes the default at 46% — which is how a song
  works. (Chorus reads 30% in the final census because the reprise rule below
  adds one to most songs.)
- **An intro must be at the front.** The first cut said `g < orbit.tail`, and rule
  110 from a typical seed has a tail of **50**, so a twelve-section song was
  entirely intro. The tail is still what *makes* an intro possible (a transient
  row can never recur), but it is capped at the first quarter of the song.

Every threshold is a quantile of **this song's own** densities. A constant suits
one rule and no other; the 256 rules disagree wildly about how dense a row is.

### The reprise rule — the one opinion the form layer holds

A hook you hear once is not a hook. If the automaton never brings the seed back
inside the song, the sequence replays generation 0 as the **penultimate** section.

This is a **sequence** rule, not a diff: it names a generation the automaton
already produced, so it survives any change of seed or rule. It fires on 156 of
the 158 rules whose songs are long enough to need it.

And it does not fire when it is not needed. A **pure cycle** (no transient — the
seed is itself on the loop) plays one generation past the close, so the song ends
on the row it started on: the automaton supplies its own reprise. Getting there
exposed dead code — the original "does the seed recur?" check could never be true,
because with a tail the seed is transient and with none it sits at generation
`cycle`, one past the end.

## The one engine change

`getProgression` now accepts a resolved progression **object** as well as a
catalogue name — two lines and a guard. A string takes the identical path it
always did. `test/unit/ca.test.js` §7 holds every catalogue progression to
identity and a spread of real states to byte-identical events; `./verify.sh` is
13/13 with the matrix diagonal-dominant and the `kerneldata` row unmoved.

## The page

Three surfaces, no sliders, touch-first.

- **THE SEED** — sixteen cells. Pointer events only; a **drag paints** (pointerdown
  decides draw-or-erase from the cell you started on), so laying in a run of
  eighths is one motion rather than sixteen taps.
- **THE ORBIT** — one row per section, in playing order, tinted by role. Tap any
  row to **make it the seed** — the CA analogue of sampling a bar, and the way you
  follow a shape you liked instead of hunting for the seed that made it.
- **THE RULE** — all 256 rules as spacetime thumbnails, drawn **from your current
  seed**, so you are always browsing the futures of the row in front of you. This
  is the surface the design turns on: picking a rule by number is a lottery
  (110 and 111 have nothing to do with each other), but picking a *picture* is
  something a thumb can do in a second. It is also the honest answer to the
  design's real weakness — most rules ARE dead on a sixteen-cell ring, so a dead
  rule is a visibly blank tile and nothing is filtered out.
- **THE WALK** — the Tonnetz, where P, L and R are literally the three ways of
  flipping a triangle across an edge. "Em E Em E" tells you nothing; a path of
  edge-adjacent triangles says *this progression is smooth because it barely
  moves*.

The base genre is **not** part of the composition — it is the orchestra. Twelve
anchors ride as chips and `?g=` reaches all 274.

## Why the URL needs no sanitizer

`?s=<hex>&r=<0-255>&k=<0-11>&g=<anchor>`. Every field is a number or a key of the
committed genre table, so a stranger's link cannot name anything the project does
not already ship — the no-remote-sources law by construction. Compare `/daw`,
which needs `PATCH_KEYS`, three structural sanitizers and a hostile-URL trial
build. That is the quiet payoff of a 24-bit document, and `test/browser/ca.test.js`
proves it rather than asserting it: a hostile `?s=__proto__&r=99999&k=-4&g=../../etc/passwd`
resolves **byte-identical to a clean boot**.

## Gates

- `node test/unit/ca.test.js` — 1072 checks, pure node: the ring and its wrap, the
  row involutions, all 256 orbits closing into a rho, every lens against a known
  row, PLR as a group (involutions on all 24 triads + the three closures), the
  engine accepting the progression object, **the change being absent-byte-identical**,
  and the form — determinism, every section naming vocabulary that exists, the
  arrangement grammar, the reprise rule, and a 256-rule sweep where nothing throws.
- `node test/browser/ca.test.js` — 29 checks in real chromium: it boots clean, the
  **DOM agrees with the kernel row-for-row**, an edit reshapes, the rule grid picks
  the rule its tile draws, **it sounds** (`handle.rms` peak 0.38, 37/40 samples) and
  keeps sounding through a mid-playback edit, the playhead is a class and not a
  repaint, the URL round-trips, a hostile URL is inert, and the standing laws hold
  (zero `input[type=range]`, 44px floor, no sideways overflow at 390 or 1440).
  Plus the instrument half: the loop sounds and keeps sounding while you draw into
  it, the orbit does NOT collapse while auditioning, one drag is one undo, and
  asking for six sections draws six.
- `ca.html` is in `test/gates/social-meta.test.js`'s `PAGES`, so its head and its
  zero-inline-script are gated with every other page.

## Composing with it — what it took

Paul, on the shipped page: *"Right but how do I COMPOSE with this thing????"*

The honest answer at that point was **you don't — you fish.** Roll, listen for
three minutes, keep or reroll. That is a slot machine, and the reason was not
conceptual: **the gap between "tap a cell" and "hear what that did" was the length
of a song.** Every instrument ever built closes that gap; this one had not.

Four things closed it, none of them a new idea about music:

- **LOOP THE BAR** (`opts.audition`). One generation, alone, with every lens on.
  `live.js` already walks the form and wraps at the end, so a one-section state
  loops with no transport work, no loop points and no engine change. Tap a cell
  while it runs and the next bar is different. *This is the whole difference
  between an instrument and a generator.*
  The trap it hid: folding the audition into `resolved()` collapsed the plan to a
  single row and **the orbit view vanished with it**. The song you SEE and the
  state the engine PLAYS are two separate builds now (`playState`).
- **TEMPO.** There was none — bpm rode the base genre, so "faster" meant "pick a
  different orchestra". A tile beside the bar it counts. Stored as `null` when
  unset rather than the resolved number, so reverting and switching to `dub` lands
  on 75 instead of freezing at whatever acidhouse said.
- **UNDO.** Every edit here is GLOBAL — one cell rewrites the whole song — so an
  accidental tap is not recoverable by hand the way a wrong note is. The document
  is six numbers, so the stack is free.
  Coalesced **by gesture, not by clock**: the first cut merged edits inside 400ms,
  which is a guess about human speed that the machine gets to vote on — each edit
  repaints the orbit, the lanes and 256 thumbnails, so under load one drag became
  five undos. A drag knows when it starts and ends, so it says so.
- **HOW LONG THE SONG IS** (`bars`, `?n=`). The orbit can run for hundreds of
  generations; where to stop is a composer's decision, not the automaton's. And
  the cap is a COUNT: the reprise inserts a section, so "6 sections" handed back
  seven until `formGens` learned to drop the generation it displaces.

## Making a song in a GENRE

Paul: *"How do I make songs in a given genre? Let's say I wanted to do house
music and then city pop."*

Before this, you couldn't — beyond the timbres. The genre chip lent its
**orchestra** (instruments, mix, tempo) while the rhythm, the harmony and the
form all came from 24 genre-blind bits. So `citypop` gave you city pop
instruments playing an automaton, over a PLR walk that had never heard of the
1625.

A genre, in this system's terms, is four things. The chip supplied one.

| | before | now |
|---|---|---|
| orchestra | the chip | the chip |
| tempo | the chip (unchangeable) | the chip, or the tempo tile |
| groove | the automaton | **the anchor's own kit**, as a starting row |
| harmony | the automaton | **the anchor's own progression**, if you want it |

**`⌁ start from <genre>`** sets the last three in one gesture (one undo puts it
back), and everything it sets stays editable — it is a starting point, not a mode.

- **The row is DERIVED from the anchor's kit** (`seedFromKit`), not a hand-written
  table, so it covers all 274 and cannot drift from the kits. Kicks keep their
  actual cell; only snares move, to the nearest free snare cell.
- **`harmony: "genre"`** simply leaves the resolved anchor's progression alone.
  The automaton still writes the rhythm and the form; the kernel writes the chords.
  This is the honest answer to the PLR limit documented above — city pop is the
  1625, a ~20-letter PLR word, and no automaton is going to find it by accident.

Measured: house → 123 bpm, `lofi`, kick on 0/2/4/6 with a backbeat. City pop → 99
bpm, `pop_1625`, kick on 0/4 with its off-beat pickups intact.

### Two things this got wrong first

**Snapping every hit to its lane's nearest cell made every 4/4 genre the same
row.** City pop's kit kicks on 0/2.5/4/6.5 — the pickups *are* the point — and
rounding them onto the nearest downbeat turned it into four on the floor,
byte-identical to house. Kicks now land where they fall (a syncopated one reads as
a tick, which keeps the syncopation even though it loses the lane).

**Reading only static `hits` left 43 of the 274 anchors with no starter at all** —
not drumless genres, but kits keeping the kick in a `grid` and the snare in an
`alt`. The reader takes the first branch of a variation rule now. The 43 that
still come back empty are genuinely drumless (ambient, neoclassical, doomdrone),
and they return nothing **and mean it**: a drumless genre has no groove to lend,
and inventing a pulse for it would be the starter lying about the anchor.

**A row cannot say "kick and clap together"**, which several kits do. That is the
lens being sixteen bits, not a bug to engineer around. The starter is a skeleton
to edit, and the UI says so.

## Open

- **`/ca` needs its nginx block** on the droplet, as `/daw` still does; until then
  `/ca.html` serves and `/ca` 404s.
- **One progression per song.** The harmony lens reads the *seed*, so the whole
  song shares four chords. Per-section harmony would let a bridge take the
  hexatonic path and come home in six — the thing the closure math is *for* — but
  `state.progression` is global and making it per-section is a real engine change,
  not a lens.
- **A second ring.** A sixteen-cell, three-neighbour system is small; cycles are
  often short (2, 4, 8), which reads as loops and is musically good, but long-form
  variation may want a modulator ring at 1/8 the clock. Ship one ring first and
  see whether the form feels thin.
- **The row involutions are exported and unused.** `rot`/`ref`/`inv` are the
  rhythmic half of the group and nothing on the page offers them yet. A "reflect
  the seed" gesture is the obvious next control, and it is one call.
- Should this replace `/daw`, or sit beside it? They answer different questions —
  `/daw` is *open the machinery and tune it*, `/ca` is *what is the smallest thing
  that writes a song* — and until the second has been lived with, deleting the
  first would be guessing.
