# KERNEL — the laws that decide what the box plays

**WRITTEN 2026-09-07, by the law audit, and it is a POINTER FILE.**

`DESIGN.md` and `TABLE.md` govern the GLASS. `GENRES.md` governs the DATA.
Nothing governed the ENGINE. A survey of 348 written laws found that the rules
which decide what this box actually plays — the hand on the drums, the shape of
the dice, what an era may not have, what a producer may not touch — verify TRUE,
carry real measurements, and **live exclusively in code comments, cited by no
document.** A reader could audit the interface in an afternoon and not the
engine. That is what this file fixes.

**IT DOES NOT COPY THE LAWS. THE CODE STAYS THEIR OWNER.** Every entry below is
a name, a one-sentence statement, the file that holds the argument, and the gate
that proves it. Copying an argument out of the source is how a fact comes to
have three wordings and no owner (`PROGRAM.md` §1.0), and every one of these
laws is better argued where it lives than it could be here. Read the code. This
file exists so you can find out that the code is there.

**HOW TO USE IT.** Before a round touches the engine, read the section that
covers what it is about to change. These are the rules a round would break
without knowing they existed — several of them were learned from a measurement
Paul made with his ears, and the sentence in the source says so.

---

## 1 · DETERMINISM

**THE DICE ARE A FUNCTION, NOT A STREAM.** — `kernel.js:2696`

Every random draw is a pure hash of WHERE it was asked: seed, bar, step, lane,
and a salt keeping the chance draw, the timing draw and the velocity draw from
being the same number three times. A sequential PRNG would make the chance
vectors order-dependent — adding a lane, or reordering a kit's keys, would shift
every later lane's draws — and **two renders of one state have to be identical.**

· *Verified:* `grep -c Math.random` in `kernel.js` and `compose.js` → **0** in
both. · *Gated:* `test/precompose.test.js`'s determinism check and the
frozen-fixture no-op; `test/table.test.js` T2's identity pin over the whole
catalogue. · *If you break it,* every gate that compares a render to a stored
one goes red at once, which is the good case; the bad case is a stream you add
somewhere that only moves the seventh voice of the fourth section.

**THE STREAM-POSITION LAW.** — `compose.js`, stated at each draw site

A device that may or may not fire still makes **one unconditional draw-set** per
section, on its own named stream, so that turning a feature off does not shift
every later draw in the record. This is the same law as the dice, one level up:
position in the stream is part of the address.

---

## 2 · THE HAND

**THE HAND LAW.** — `kernel.js:3158`, precedence at `:3243-3246`

Paul, 2026-08-19: *"humanize the drums more for non-digital genres… it feels
like an organic drum machine."* An acoustic kit is **played by a hand by
default**: a per-lane accent contour (downbeats lean, offbeats breathe, the
backbeat cracks) plus humanize jitter. Before it, a lane with no step levels and
no `kitVel` borrowed the MELODY's velocities, which is why every hat and rim on
an acoustic kit landed at one loudness.

**THE PRECEDENCE, which is the half a round will break:** the step level the
hand wrote (2..9) outranks `g.kitVel`, which outranks the hand contour, which
outranks the melody's own velocity. **A level of 1 is the old binary "on" and
defers**, so every kit ever written renders exactly as it did.

**MACHINE KITS ARE UNTOUCHED** — `tr808`, `tr909`, `cr78`, `electronic`. A
machine's exactness is its identity. An anchor opts out of the hand by name with
`hand: "exact"`.

· *Gated:* the MACHINE fingerprint gates; `test/dynfigure.test.js`.

**A DRUM MACHINE HAS NO ROOM.** — `precompose.js:2718`

The machines are the named exception to room/ambience treatment. The list is a
LIST and not a count: `DRUMKITS` (`fields.js:490`) holds ten kits and
`MACHINEKIT` must name every machine among them or a Roland box takes an
acoustic room. Add a kit, check both tables.

**NO FILTER ON THE KIT.** — `audio/desk.js:713`

Paul, listening: *"Funk rock drums are super low… the reason the funk drums are
low is the auto-wah is on them."* The 2026-08-27 dealing law puts a record's
character chip on EVERY chair including the drums; a filter or wah landing on a
kick is a level change nobody asked for. The kit is exempt.

---

## 3 · WHAT A RECORD MAY CONTAIN

**THE ERA LAW.** — `compose.js:1293`

Paul, 2026-08-18: *"Why would Chicago 1932 have enormous amounts of delay?"*
**An effect cannot arrive on a record cut before the effect existed.** Every
place-year anchor states its year in its own label; `FX_YEAR` is each effect's
arrival year, tuned no tighter than the shipped anchors' own claims (drone's
1964 filter sweep and the Isleys' 1973 modulation are real records). Applied as
a **draw-free filter at the end of `build()`**, so no stream moves — which is
the dice law being obeyed by the law that came after it.

**AND THE LABEL LEARNED "BC"** (2026-08-30). Eight anchors live before year one
— *"Ur 2500 BC"*, *"Rome 17 BC"* — and the year parser failed CLOSED on them
(null), which quietly excused antiquity from the era law: a wah pedal on the Ur
lyre was legal because the row had no year. `atlas.gate.js LABEL_RE` is the
label convention's one owner.

· *Gated:* the era-law sweep over every pre-1950 anchor × 3 seeds, 0 out-of-period
chips. · *Do not* type the anchor count into a sentence here; the gate prints it.

**THE SIXTEEN-BAR LAW.** — `compose.js:2746`

Paul, 2026-08-18: *"We shouldn't have 16-bar measures unless they evolve in
significant ways."* **A section keeps sixteen bars only by SPENDING them on a
long arc the ear can ride** — a period sentence (the notes evolve bar to bar), a
motion arc, or a filter automation (the mix evolves) — and nearly half the time
it draws a SECOND device of a different kind, because one sweep over sixteen
static bars is a gesture and not an evolution. A section that draws the short
straw **gives the length back**.

It runs AFTER the bends, because a bend can stretch a section past sixteen and a
law that ran inside `build()` missed exactly those.

**AND THE ERA LAW BINDS THE DEVICES TOO:** a motion arc and a cutoff automation
are FILTER moves, so a record from before 1964 evolves in its NOTES — the period
sentence — or gives the length back. *A 1570 motet with a filter sweep is the
1932 delay again.*

· *Verified:* 1,418 sections of ≥16 bars across the anchors × 3 seeds, **0
without an arc.**

**THE FOURTEEN FROZEN MACHINES.** — `genres-tables.js:1266`

Fourteen machine rows say `dyn` NOTHING, keep `lean`, and render byte-for-byte
what they rendered on 2026-09-05. **A flood may widen the catalogue but it may
not move a machine**, and `flat` is not byte-identical to `lean`. Held by
`test/dynfigure.test.js` §D.

---

## 4 · WHO MAY WRITE WHAT

**THE FIELD LAW.** — `producer.js:291`

One row per kernel field the producer may touch, saying HOW it moves. Anything
not in that table **is not the producer's business** — and ten things are named
as FORBIDDEN rather than merely absent, because they are the ones somebody would
reach for:

* `plan` / `meter` / `bars` / `voices` / `family` / `label` — the record's
  frame. *A producer does not re-count the bar.*
* `roots` / `prog` / `key` / mode-as-harmony — the ARRANGER's.
  *"Make the drums punk" must not rewrite your changes.*

Naming a forbidden field is worth more than leaving it out, because absence
reads as an oversight and a refusal reads as a decision.

**THE LIVE-CHANNEL LAW.** — `producer.js:935`, `:1190`, `:1642`

**The desk only has faders for what is playing.** A fader on a channel this
record does not build *"is not a quieter cymbal, it is a line on the sheet that
lied."* The live set is recomputed whenever an earlier note moved a lane or took
a chair out or brought one in.

**THE INHERIT LAW** is `TABLE.md` §2 and governs the document, not the kernel:
cell → column → row → record → the genre's row, and **a cell stores only what a
hand wrote there.** It is named here only so a kernel round knows where the
values it receives came from — and so it does not reach for a row's `parents`,
which composition never reads (`TABLE.md` §2's fence against genealogy).

**THE NAMESPACE IS THE COLLISION LAW.** — `song.js:638`

A session-invented genre's key is PREFIXED, so it cannot shadow a catalogue
anchor **by construction rather than by a check that has to be remembered** —
and the check is there anyway, because a hand-edited file is a file.

**EVERY VECTOR THE SAME LENGTH.** — `song.js:481`

A phrase's length is read off `deg` (there is no separate length field to
disagree with it) and every other vector is held to that count.

> **A KNOWN GAP, 2026-09-07.** `okPhrase` validates eight vectors plus the
> optional `hold`. The kernel has since grown five more present-only vectors —
> `orn`, `art`, `alt`, `regDeg`, `regGate` (`kernel.js:110-125`) — and `song.js`
> validates **none** of them, so a saved record with a wrong-length `art` loads
> unchecked. The law is right; its coverage is five vectors behind the kernel.
> `song.js` was not held by this round.

---

## 5 · SOUND

**A COLOUR MUST NOT ALSO SAY "LOUDER".** — `audio/desk.js:284`

Eight of the twelve family tone rows are net BOOSTS as written (brass +1.5,
reed/guitar/mallet +1, keys/bowed/strings/organ +0.5). That was harmless while
the number was computed and thrown away; the day the EQ round made it a real
stage, every voice in those eight families got quietly LOUDER as well as
differently coloured. **A three-band carve that changes colour should not change
loudness.** So each row is CENTRED — its own mean subtracted — rather than
retyped. `EQ.md` exists and does not state this.

**THE FOUR PRE-RENDER LAWS.** — `audio/live.js:649`

The idle pre-render keeps four laws and names them at the seam: no UI writes at
idle · **battery sanity** (ONE pre-render, at page idle only, nothing re-arms on
a timer; an edit invalidates the hold and does not re-arm) · one owner per fact
(staleness is exactly the events the playing engine already treats as *the
document changed*, with no second signature) · **the media-element law** (a
phone's output element must be born inside a user gesture, so the hold is
desktop-only and a phone spends no battery rendering at idle).

**THE KIT-ID LAW.** — `fields.js:487`

Six sample directories plus four `MACHINE_KIT` rows = exactly the ten ids in
`DRUMKITS`. **There is no third kind of kit.** An id added must be a directory
on disk or a row in that table, and the browser gate holds the two lists
together.

**A BORROWED VALUE MUST NOT DRIFT.** — `instruments.js:230`

Where a number is taken from a source outside this repo it is written once and
quoted at every reader. The erhu is the worked example: MIDI 62..105 is D4 to A7
— the ZIM's *"three and a half octaves, from D4 up to A7, before a stopping
finger reaches the part of the string in contact with the bow hair"* — and it is
the same pair of numbers `state-engine.js case "erhu"` writes as freqMin 293.66
/ freqMax 3520, **to the cent**. Nothing exists under the open string to be
stopped, so the floor is a real floor and not a taste.

---

## 6 · WHAT A CONTROL OWES THE RECORD

Two laws that live in the extractors and are about the engine's numbers, not the
glass's pixels:

**A SLIDER MUST BE ABLE TO SHOW THE RECORD'S OWN NUMBER.** —
`knobs-extract.js:541`

An `<input type=range>` snaps to `min + k*step`, so a step that does not divide
the distance from the floor to the derived value **draws a thumb at a number the
record does not say**. Measured before the fix: the chant's cantor says
`attack: 0.03` and the row drew 0.031. The ladder is NICE NUMBERS ONLY, then
CHECKED against the derived value and refined until it lands.

**A RULE THE PAGE CANNOT SAY OUT LOUD IS A RULE THE PAGE MUST NOT GREY WITH.** —
`gates-extract.js:538`

The refusal law (`PROGRAM.md` §2.3) says an unreachable option greys **with its
reason printed**. This is its enforcement at the data tier: a gate whose
sentence cannot be produced may not grey anything. `avail.js`'s `WHY` table owns
the words.

---

## 7 · THE ONE THAT IS ABOUT THE HARMONY, AND IT WAS BROKEN

**THE PROGS LAW.** — `genres-tables.js:926`

A genre carrying both `prog` and `roots` must have **the prog's first-chord
degrees equal the roots, bar for bar.** Two spellings of one fact, and the fact
is the changes.

It was marked *(gated)* and was not: the only assertion read twelve demo rows in
`tools/remix-out/` and never the catalogue, while `tools/remix.js:1282` enforced
it strictly on every mined row. **Eleven shipped anchors were in violation.**
Both were fixed on 2026-09-07 and the check now reads all 502 rows. The lesson is
`PROGRAM.md` §1.0's fourth convention: *if you write "(gated)", name the file,
and run it.*

---

## 8 · THE TWO TOMBSTONES TO KEEP VERBATIM

Not laws — the two best pieces of prose in the engine, and the strongest
argument for the tombstone convention being written down at all. Do not tidy
either one.

* `desk-gate.js:518` — a gate that *"did not merely miss the hole — it defended
  it, and it named the defence a law"*: 527 of 555 modelled chair-boxes had
  their tone computed and thrown away, and the check that should have caught it
  had been written to explain why that was correct.
* `src/table/grid.ts:1450` — the two-tap law retired in place with the
  measurement that killed it: *"I lost ~20 taps to this in the first ten
  minutes."*

---

## 9 · WHAT IS NOT HERE

* **The document's shape** — `TABLE.md` (the inherit law, the tiers, the ops).
* **The catalogue's shape** — `GENRES.md` (the row contract, the build, the
  parents, the copyist).
* **The glass** — `DESIGN.md`, `docs/NAV.md`, `docs/DESIGN-SYSTEM.md`.
* **The conventions all four are written under** — `PROGRAM.md` §1.0.
* **The theory pass** — `docs/THEORY.md`. Note its standing law, which is a
  kernel law in everything but address: *the pass may NOT change a written
  motif, a rhythm, or a degree a hand wrote — the melody is the composer's and
  this pass is the copyist* — and **it is off unless a caller asks.**
