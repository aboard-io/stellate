# INHERITANCE — what is combined, what is plucked, what is new

2026-08-16 — `nukernel/inherit.js` over the 38 children of the 44 real anchors
in `nukernel/genres.js`.

`genealogy.js` asks how much of a child its declared parents EXPLAIN, projecting
each anchor into 27 numeric features and fitting non-negative weights. It is a
statistical answer and a good one: Liverpool 1962 is 83.5% its parents.

This asks the structural question one tier down, and gets a much colder number.
Field by field, WHICH PARENT DID EACH THING COME FROM — and can the anchor be
reconstructed, byte for byte, from `parents + delta`?

Three words, Paul's, and they are the whole output vocabulary:

- **COMBINED** — numeric fields genuinely averaged across the parents by weight.
- **PLUCKED** — a noun taken wholesale from ONE parent. Kit patterns, instrument
  picks, progressions, bass idioms and the arrangement closures do not average:
  the house law is *numbers blend, nouns don't*.
- **NEW** — the delta. What this genre invented, which the genealogy fit calls
  the residue.

**The headline, up front: across the catalog, inheritance accounts for 32.0% of
an anchor's fields and 15.0% of its bytes.** 82 fields combined, 235 plucked,
679 new, out of 996. The recommendation at the bottom follows from that number
and it is *don't convert the catalog* — but the tool found four things on the
way that are worth more than the conversion would have been.

---

## 1. The architecture argument: compile-time, not runtime

The obvious way to do genre inheritance is at load: `GENRES.beatles` becomes a
getter that blends its parents when read. That is the wrong design here, for
three reasons and one precedent.

**Action at a distance.** A runtime blend means editing `motown` silently
changes `beatles`, `rnb`, `disco`, `eurythmics`, `steely`, `jodeci` and
everything downstream of *those*. Nobody reviewing the motown diff sees it. The
whole reason this repo's parent project keeps `engine/genres-data.js` byte-held
against HEAD in `test/gates/kernel-data-identity.test.js` is that every seeded
render is downstream of exact bytes; a change that does not appear in a diff is
a change nobody can gate. A **compile-time** expansion has the same expressive
power and the opposite property: you edit `motown`, re-run the expander, and the
consequences arrive as a reviewable diff in six children. The parent edit is
still one edit; it is just no longer invisible.

**Determinism and the gates stay untouched.** The expansion emits the same flat
literals we commit today, so the anchors remain ground truth. Nothing about the
kernel, the fixtures, the byte-identity gate or the seeded renders knows the
expander exists. That is the only version of this program with an honest cost of
zero: a runtime blend would put a new code path between every gate and the data
it gates.

**Readability is a feature of this file.** `genres.js` is 2,166 lines and most
of them are prose explaining why an anchor is what it is ("the ♭VII is the move,
it is why mixolydian and not major"). Anchors you can read straight through are
what let a musician argue with the table. A field whose value is `blend(parents)`
is a field you have to run a program to see.

**And the precedent is already in the file.** `genres.js` does exactly this for
four fields today: `family` is stamped from the `FAMILIES` table at load, and
`stress`/`phrase`/`touch` from `DYNAMICS`/`DYN_FAMILY`, under a comment that
reads *"WRITTEN AS A TABLE AND STAMPED, exactly like `family` two lines above,
and for the same reason: family membership and dynamic temperament are both
facts about a whole CLUSTER first and about the individual anchor second."* This
program is that idea with a weighted-parent table instead of a flat one. Those
four fields are classified `DERIVED` by the tool and sit outside the
inheritance entirely — they would be stamped after expansion exactly as today.

---

## 2. What this borrows from the parent project

The check-the-parent-first law. `engine/genre-kernel.js` `resolveMulti` already
decided, over 274 anchors, which fields interpolate and which are picked, and
the rules here are cited to it line by line:

| borrowed | from |
|---|---|
| numeric and `[lo,hi]` range fields LERP by weight | `wRange` (l.766), the numeric branch of `blendRecipe` (l.810–814) |
| parents missing a key SIT OUT; weights renormalize over the ones that have it | `blendRecipe` l.797 — reproduced verbatim in `combineNum` |
| string pools and enums are PICKED, never averaged | `side()` (l.763) and the whole model-pool branch |
| structural dimensions are copied WHOLE from the dominant parent by weight, zero rng | the "dominant-parent PURE-COPY dims" block, l.1127–1154 (`reverbColor`, `transforms`, `sampleEvents`, `introMode`) |
| fields that must COHERE are drawn ONCE PER GROUP, not per field | l.819–824: *"Calling `side()` per field could check canawave's `.vox` then read ambient's — a crash on any vox-genre × plain-genre blend."* |
| a recipe object blends PER KEY, so `tone`'s numbers and `tone`'s waveform get different treatment | `blendRecipe` is a per-key loop |
| quantized structure does not lerp at all | the meter law, l.1198–1215: *"METERS DON'T LERP: a bar holds an integer number of beats, and there is no music halfway between 3/4 and 4/4 — a weighted average would land on no meter at all."* |

**What is deliberately NOT borrowed: the rng.** `side()` is a seeded weighted
draw. That is right for a live blend at a point between stars, where the
crossover should be an event, and wrong for a source expansion, where the answer
must be the same every time anyone runs it and must read as a diff. Every rule
below is deterministic and weight-ordered.

---

## 3. The field law

Every field an anchor may carry has exactly one disposition. A field the tool
has never seen is an ERROR, not a default — the same "NO SILENT DEFAULT" rule
`genres.js` applies to its own dynamics stamp. `node nukernel/inherit.js`
prints a warning naming any unclassified field, which is how this stays honest
as the lanes add fields.

| class | fields | rule |
|---|---|---|
| IDENTITY | `label` `parents` `wants` `near` | the genre's own name and its lineage declaration. Never inherited, never predicted, excluded from the denominator |
| DERIVED | `family` `stress` `phrase` `touch` | already stamped at load from a table keyed on `family`; stamped after expansion exactly as today |
| COMBINE | `rate` `swing` `maxHold` `incClamp` `humanize` `anchor` | weighted mean over the parents that declare it, renormalized, rounded to 4 |
| COMBINE_Q | `bars` `voices` | combined, then **snapped to an integer**. This is the meter law's shape: `bars` is a form length and `voices` is a headcount; there is no music with 2.4 voices |
| COMBINE_LEAVES | `tone` | per key: the six numbers combine on their own, `tone.wave` plucks with the timbre group. Reported leaf by leaf (`tone.cut`, `tone.wave`) so a genre that inherited its reverb and invented its filter says so |
| PLUCK | everything else, in five groups | copied whole from ONE parent |

### The pluck groups

Grouped because of the `side()`-per-group law: a kit from motown with a fill
from blues is the same bug as a vox recipe from one parent and its source pool
from another.

- **drums** — `drumkit` `kit` `kits` `fill` `kitVel` `kitProb` `ghost`.
  A kit without its own fill is exactly what the group law exists to prevent.
- **harm** — `harmony` `roots` `prog` `progFamily` `mode` `scale` `diatonic`.
  `genres.js` gates `prog` against `roots` bar for bar; they *cannot* come from
  different parents and still pass.
- **bass** — `bassStyle` `bassGrid` `nobass`. A walk and a fifths figure do not
  average into a walk in fifths.
- **timbre** — `instr` `fx` `synth`, plus the leaf `tone.wave`.
- **arr** — `entry` `reg` `realize` `word` `words` `part` `period` `intro`
  `incMode` `artic` `pipes`. These are CLOSURES; the least averageable thing in
  the table and the most obviously plucked.

### Which parent supplies a group — two rules

**`dominance`** — the naive expander, and the parent project's own law: the
highest-weight parent that declares any field of the group supplies the whole
group. Requires nothing from the child.

**`attributed`** (the default) — the ORACLE. For each group, pick the parent
whose values byte-match the most of the child's group fields; ties break by
declared weight, then by declaration order. It answers the question dominance
cannot — *was this noun taken from a parent at all, or is it new?* — and its
output IS the `from:` map the child would declare in source. You do not guess
the per-field parent selection; you measure it and write it down.

Either rule can be overridden per group or per field by a `from` map on the
child. **The oracle disagrees with dominance on 41 of 183 groups** and is worth
5.4 points of explained fields (32.0% vs 26.6%) and 4.0 points of bytes. The
disagreements are not noise; they are the interesting cases:

```
rock       harm: oracle beatles  vs dominant blues
beatles    harm: oracle motown   vs dominant blues
beatles    arr:  oracle countrypop vs dominant blues
steely     harm: oracle motown   vs dominant rock
techno     arr:  oracle funk     vs dominant house
shoegaze   drums:oracle beatles  vs dominant punk
```

Every one of those says the same thing: the heaviest-weighted parent is the one
the *author* thought was most important, and it is routinely not the one the
*data* came from. That gap is the finding, not a defect in either rule.

---

## 4. The pilot: beatles, Liverpool 1962

Parents as declared: `blues .30, motown .25, countrypop .25, counterpoint .20`.
Fit under `genealogy.js`: 83.5%.

```
COMBINED — numbers genuinely averaged across the parents (2)
  rate         = 1
  voices       = 2

PLUCKED — nouns taken wholesale from ONE parent (7)
  [drums <- motown]
    drumkit    = "acoustic"
  [arr <- countrypop]
    entry      = () => 0
    reg        = v => v
    realize    = () => "line"
  [harm <- motown]
    harmony    = "cycle"
    diatonic   = true
  [timbre <- motown]
    tone.wave  = "triangle"

NEW TO THE ERA — the delta, what this genre invented (17)
  bars         = 8            ^ overrides-the-average; parents predicted 6
  instr        = ["steel_string_guitar", "ohh_voices"]      ^ no parent has it
  mode         = MODES.mixo                                 ^ no parent has it
  scale        = MODES.mixo                                 ^ no parent has it
  roots        = [0, 0, 6, 6, 3, 3, 0, 0]                   ^ no parent has it
  period       = [[], [], [], [drop(3)]]                    ^ no parent has it
  progFamily   = { verse: "beatlesV", chorus: "beatlesC" }  ^ no parent has it
  kit          = { k: […], s: […], h: […] }                 ^ no parent has it
  fill         = { s: […] }                                 ^ no parent has it
  tone.cut     = 2600         ^ overrides-the-average; parents predicted 2240
  tone.q       = 0.9          ^ overrides-the-average; parents predicted 1.66
  tone.atk     = 0.005        ^ overrides-the-average; parents predicted 0.0052
  tone.rel     = 0.7          ^ overrides-the-average; parents predicted 0.665
  tone.gain    = 0.28         ^ overrides-the-average; parents predicted 0.265
  tone.verb    = 0.26         ^ overrides-the-average; parents predicted 0.217
  words        = ["the tune", "the harmony, a third above, all the way"]
  word         = v => (v === 1 ? [transpose(2)] : [])       ^ no parent has it

IDENTITY (never inherited): label, parents, wants
DERIVED at load from `family`: family, stress, phrase, touch

EXPLAINED BY INHERITANCE: 34.6% of fields (9/26), 10.8% by canonical bytes.
ROUND-TRIP expand(parents, from, delta): BYTE-EXACT against the committed anchor.
```

**The most interesting single finding in the pilot: the Beatles' heaviest
declared parent hands them nothing you can point at.** `blues` at .30 supplies
not one noun — no kit, no mode, no progression, no closure, not even a
waveform. It survives only inside the two combined averages, where every parent
says the same number anyway (`rate: 1`, `voices: 2`), so it is doing no work
there either. And `counterpoint` at .20 — the parent that carries the founding
claim of the whole program, *"Beatles is counterpoint plus Bo Diddley plus
skiffle"* — supplies nothing either. Everything concrete that crossed over came
from Detroit (the acoustic kit, the cycle, the triangle) and Nashville (all
three arrangement closures: everyone in from bar 0, nobody transposed, every
voice a line).

That is not a claim that the lineage prose is wrong. Blues is genuinely in the
Beatles, and the anchor comment says exactly where — "rhythm & blues learned off
Chess imports". It is a claim that **the blues in this anchor is in the parts
the Beatles rewrote**, not in the parts they copied. The mixolydian ♭VII, the
eight-bar form, the two-guitar instrumentation, the thirds: seventeen fields,
89% of the anchor's bytes, and every one of them invented. The fit says 83.5%
inherited; the structure says 34.6%. **Both are true, and the gap between them
is the whole point: the parents predict where a genre SITS, and almost nothing
about what it is MADE OF.**

### The proposed source form

`node nukernel/inherit.js --source beatles`:

```js
    beatles: inherit({
      // COMBINED — the weighted average of the parents, verbatim
      parents: { blues: 0.3, motown: 0.25, countrypop: 0.25, counterpoint: 0.2 },
      // PLUCKED — which parent each group of nouns comes from whole
      from: { drums: "motown", harm: "motown", timbre: "motown", arr: "countrypop" },
    }, {
      // NEW — what this genre invented (17 of 26 inheritable fields)
      label: "Liverpool 1962",
      wants: ["skiffle", "bo diddley", "chuck berry", "doo-wop"],
      bars: 8,
      instr: ["steel_string_guitar", "ohh_voices"],
      mode: MODES.mixo, scale: MODES.mixo,
      roots: [0, 0, 6, 6, 3, 3, 0, 0],
      period: [[], [], [], [drop(3)]],
      progFamily: { verse: "beatlesV", chorus: "beatlesC" },
      kit:  { k: [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
              s: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
              h: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
      fill: { s: [0,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0] },
      tone: { cut: 2600, q: 0.9, atk: .005, rel: .7, gain: .28, verb: .26 },
      words: ["the tune", "the harmony, a third above, all the way"],
      word: v => (v === 1 ? [transpose(2)] : []),
    }),
```

Compare that to the committed literal and the honest verdict is right there: it
is not shorter, it is not clearer, and it moved four lines of value into two
lines of ceremony. What it gained is the `from:` line — which is genuinely new
information and is discussed in the recommendation.

**Round-trip.** `expand(parents, from, delta)` reproduces the committed anchor
byte-exactly, field for field and in the anchor's own field order, comparing by
canonical serialization (a function serializes to its own source text, which is
what makes `entry: () => 0` on beatles byte-identical to `entry: () => 0` on
jodeci — a closure really can be plucked). `node nukernel/inherit.js --check`
does this for **all 38 children and all 38 pass**.

**And an honest caveat about what that proves.** The delta handed to `expand()`
is the ledger's own `new` list, so the round-trip is lossless *by construction*.
That is the point and not a cheat: what it proves is that the expander is
FAITHFUL — nothing is lost, reordered, or re-rounded on the way through, which
is the precondition for ever converting anything. What it does **not** prove is
that the inheritance explains anything. The number for that is the 32.0% /
15.0%, reported separately and never mixed in.

---

## 5. Did it generalize?

The same ledger over all 38 children. It generalized in the sense that matters —
**beatles is not a lucky case, it is a median case** (34.6% against a 32.0%
mean) — and the shape of the result is remarkably consistent.

| child | fields explained | by bytes |
|---|---|---|
| eurythmics | 48.0% (12/25) | 12.7% |
| house | 44.4% (12/27) | 23.7% |
| synthpop | 44.4% (12/27) | 23.0% |
| rnb | 41.4% (12/29) | 19.0% |
| counterpoint | 40.9% (9/22) | 25.7% |
| garage | 40.0% (12/30) | 12.9% |
| … | | |
| **beatles** | **34.6% (9/26)** | **10.8%** |
| … | | |
| gospel | 17.9% (5/28) | 5.2% |
| ska | 17.9% (5/28) | 4.4% |
| funk | 14.3% (4/28) | 3.6% |
| **mean, 38 children** | **32.0%** | **15.0%** |

### The one real finding: inheritance carries the ARCHITECTURE, not the MATERIAL

Sorted by how often each field is inherited across the catalog, the table splits
almost perfectly in two:

| field | inherited | | field | inherited |
|---|---|---|---|---|
| `harmony` | 33/38 — 87% | | `kit` | 6/38 — 16% |
| `realize` | 32/38 — 84% | | `swing` | 1/11 — 9% |
| `diatonic` | 19/23 — 83% | | `word` | 3/38 — 8% |
| `part` | 7/9 — 78% | | `roots` | 2/29 — 7% |
| `rate` | 29/38 — 76% | | `fill` | 1/33 — 3% |
| `tone.wave` | 28/38 — 74% | | `instr` | 1/38 — 3% |
| `voices` | 25/38 — 66% | | `tone.cut` `.q` `.atk` `.rel` `.verb` | 0/38 |
| `drumkit` | 20/33 — 61% | | `words` | 0/38 |
| `entry` | 20/38 — 53% | | `prog` | 0/11 |
| `scale` | 14/28 — 50% | | `bassGrid` `kitVel` `synth` `pipes` `period` | 0 |

A genre inherits **how many voices there are, whether the harmony is a cycle or
emergent, which drum kit, what waveform, who enters when, whether the alphabet
is diatonic**. It invents **the actual pattern, the actual chords, the actual
instruments, the actual filter setting, the actual words**. That is exactly what
you would expect of a table where every anchor exists to be audibly DIFFERENT
from its neighbours — `genres.js` carries a `near:` field pointing at each
anchor's closest sibling and the prose beside it says things like *"the fields
that separate them are the TRAIN BEAT … and the FIFTHS bass"*. The table was
authored by difference. Inheritance measures similarity. They are measuring
opposite sides of the same decision, and the 15%-of-bytes number is what that
looks like from this side.

### Where the pluck rules produce nonsense — reported honestly

**The group law costs 18 fields catalog-wide.** These are fields a parent
genuinely held and the group rule refused, because the group went to a different
parent on the strength of its other members (`node nukernel/inherit.js --lint`):

```
  spem.mode        is held by gregorian, but the harm group went to counterpoint
  isley.mode/scale are held by funk,      but the harm group went to gospel
  jodeci.mode/scale  ditto
  disco.harmony/diatonic are held by motown/gospel, but harm went to funk
  citypop.fill     is held by steely,    but the drums group went to toto
  shoegaze.incMode is held by drone,     but arr went to punk
  synthpop.artic   is held by newwave,   but arr went to disco
```

Per-field attribution would recover all 18 and raise the mean by roughly two
points. **It should not.** `isley.mode` and `isley.scale` coming from funk while
its `roots` and `prog` come from gospel is a genre in two keys at once, and
`disco.harmony` from motown with `disco.roots` from funk is the exact bug
`genre-kernel.js` l.819 wrote its group law to prevent. The 18 fields are the
price of coherence and the price is correct. Reporting them is the compromise:
the lint names every one, so a human can look and decide.

**Quantization is a coin flip.** `funk` combines to 2.45 voices and snaps to 2,
which happens to be right. `citypop` combines to 2.70 and snaps to 3 where the
anchor says 2, and `spem` combines to a clean 2 where the anchor says 8 — 75%
off, on a field where being wrong means a different number of singers. `bars` is
worse: 23 children override the combined
`bars` and only 2 of those land within 15% of it. `gospel` inherits `bars: 12`
from blues' twelve-bar form and is a four-bar hymn — 200% off. There is no music
halfway between a twelve-bar blues and a four-bar hymn, and the kernel's meter
comment already said so; `bars` and `voices` belong on the *pick* side of the
line, not the *lerp* side, and the only reason they are combined here is to
measure how badly that goes. It goes badly.

**The numbers are close but never exact, which is fatal to an expander that
emits literals.** `node nukernel/inherit.js --near`:

| field | fell to the delta | within 15% of the average | median error |
|---|---|---|---|
| `tone.gain` | 31 | **27** | **3.8%** |
| `tone.cut` | 38 | 17 | 17.5% |
| `tone.q` | 38 | 11 | 30.0% |
| `tone.rel` | 38 | 11 | 20.0% |
| `tone.verb` | 38 | 8 | 37.1% |
| `tone.atk` | 38 | 6 | 40.0% |
| `bars` | 23 | 2 | 40.0% |
| `voices` | 13 | 0 | 33.3% |
| `rate` | 9 | 0 | 55.0% |

Exactly one field in the whole table genuinely wants to be inherited and is
being typed by hand instead: **`tone.gain`, median error 3.8%, 27 of 31 within
15%** — because it is a mix level and every genre lands near 0.27. Everything
else in `tone` is a real decision that departs from its parents by 20–40%, and
`tone.atk` on counterpoint misses by 1400%. An expander that emitted the
averages would quietly relevel `tone.gain` for the whole catalog and would
wreck everything else.

### Two bugs the tool found on itself

Worth recording, because both are the kind of thing that would have silently
degraded a conversion:

1. **The rounding law lost a triplet.** `gospel` inherits `swing: 1/3` from its
   single parent `blues` — a real triplet, `0.3333333333333333`. Rounding the
   weighted mean to 4 decimals (the kernel's `round(x,4)`) returned `0.3333`,
   which is not equal, so a field that was *literally copied* came back as an
   invention. Fixed with a UNANIMITY PASSTHROUGH: when every declaring parent
   says the same number, carry the literal unrounded. It is the same shape as
   the kernel's `RECIPE_PASSTHROUGH` (l.791/805) — when a value is being carried
   rather than computed, carry it.
2. **The timbre group was scored blind.** Attribution scored each group only on
   its top-level fields, and nobody in the catalog inherits `instr`/`fx`/`synth`
   — so `timbre` always scored zero for every parent and fell to the dominant
   one, dragging `tone.wave` with it. On the pilot that attributed beatles'
   timbre to `blues` and reported its `triangle` as an invention with motown and
   countrypop both holding a triangle in plain sight. Fixed by scoring groups on
   their leaf fields too. Worth +0.5 points of mean and one field on the pilot.

### The lint that turned out to be the most useful output

**27 declared parents supply their child no noun at all.** Not one kit, mode,
progression, bass idiom or closure crosses over:

```
  deathmetal  declares rock    at 0.45     motown   declares blues   at 0.40
  funk        declares gospel  at 0.45     steely   declares rock    at 0.35
  citypop     declares steely  at 0.35     boombap  declares funk    at 0.35
  beatles     declares blues   at 0.30     beatles  declares counterpoint at 0.20
  … 19 more
```

A declared parent that supplies nothing structural is a lineage CLAIM the anchor
data does not back. The child may still be its descendant in the record-shop
sense — `deathmetal` really is downstream of `rock` — but nothing you can point
at came across, and that is worth knowing about a table whose whole thesis is
that lineage is data. Two readings, and the lint does not choose between them:
either the claim is loose, or the child is quietly holding a noun it should have
inherited and the anchor should be edited to say so. `citypop declares steely at
0.35` is almost certainly the second kind — the lint says citypop's `fill` is
held by steely and was refused only by the group rule.

---

## 6. Recommendation

**Stop at the tool. Do not convert the catalog, and do not convert a subset.**

The case against conversion, in the order it matters:

1. **The payoff is 15% of the bytes.** Even the best-explained child
   (`eurythmics`, 48% of fields) is 12.7% by bytes. The delta would still carry
   the entire identity of every genre, so the file would not shrink, would not
   get clearer, and would gain a layer of indirection over the 85% that has to
   be read anyway. The pilot's proposed source form above is longer than the
   literal it replaces.
2. **The fields that DO inherit are the cheap ones.** `harmony: "cycle"`,
   `realize: () => "line"`, `diatonic: true`, `voices: 2`, `rate: 1`,
   `tone.wave`. Six short lines. Nobody's maintenance burden is six short lines,
   and nobody's parent edit propagates usefully through `harmony: "cycle"`.
3. **The action-at-a-distance argument cuts the other way at this size.** The
   whole justification for the machinery is "a parent edit shows as a reviewable
   diff in its children" — but at 15% of bytes, the diff a parent edit produces
   is `drumkit` and `tone.wave`. That is not worth a build step, a new failure
   mode, and a second way to read the table.
4. **A subset is worse than either extreme.** Half the anchors as literals and
   half as `inherit()` calls means every reader has to know which is which
   before they can trust what they are looking at. `genre-specs/` in the parent
   project rotted to 135 stale files precisely when the round-trip stopped being
   total.

**What to do instead — three things, in descending order of value:**

**(a) Keep `inherit.js` as a review instrument and run `--lint` when the lineage
annotations change.** The idle-parent lint is the real deliverable of this pass.
It turns `parents:` from an unfalsifiable annotation into a claim with a check
behind it, and it found 27 claims worth a second look, including both of the
Beatles' most-cited ancestors. This is the same generator-verifier posture the
parent project is built on: the thing that makes the claim and the thing that
checks it live side by side and argue.

**(b) Consider adding a `from:` line to the anchors as documentation, without
the expansion.** `from: { drums: "motown", harm: "motown", timbre: "motown", arr:
"countrypop" }` beside `parents:` and `wants:` says which parent handed over
which noun. It is measured rather than guessed (the oracle emits it), it costs
one line, it changes no behaviour at all, and it is exactly the kind of claim
`genealogy.js`'s numeric fit cannot make. It would also give the lint a
declaration to check *against* rather than re-deriving one each run. This is the
middle path and it is the one worth arguing about.

**(c) Use `--source` when AUTHORING a new genre, as a starting point rather than
a storage format.** The real value of a weighted-parent blend is on a blank
page: declare the parents, run `--source`, get a skeleton with the architecture
already filled in, and then spend all your attention on the 85% that is the new
genre. That is inheritance used as a compositional tool, which is what it is
good at, instead of as a compression scheme, which is what it is bad at.

### A gate, for the lane that owns `test/unit/nukernel.test.js`

Not added here — that file belongs to another workflow. Recommended, cheap, and
pure node:

```js
// §NN — inheritance round-trip: the expander is faithful
const I = require("../../nukernel/inherit.js");
assert(!I.unknownFields().length,
       "genres.js grew a field with no disposition in inherit.js: " +
       I.unknownFields().join(", "));
for (const k of I.CHILDREN) {
  const rt = I.roundTrip(k);
  assert(rt.ok, "inherit round-trip failed on " + k + ": " + rt.bad.join(", "));
}
```

The first assertion is the one that earns its place: it fires the moment an
anchor grows a field the inheritance model has never classified, which is the
only way this analysis can silently stop being true. The round-trip assertion is
nearly free (38 children, milliseconds) and pins the canonical serializer, the
unanimity passthrough and the group-attribution scoring against drift.

The idle-parent lint should **not** be a gate. 27 findings is a reading list,
not a failure, and turning a judgement call into a red build is how a useful
instrument becomes something people route around.

---

## Running it

```bash
node nukernel/inherit.js beatles            # the three-way ledger for one child
node nukernel/inherit.js --all              # every child, one summary row each
node nukernel/inherit.js --check            # round-trip EVERY child, byte-exact
node nukernel/inherit.js --lint             # idle parents + what the group law refused
node nukernel/inherit.js --near             # how close the numeric misses came
node nukernel/inherit.js --source beatles   # the proposed `parents + delta` entry
node nukernel/inherit.js beatles --rule=dominance   # the naive pluck rule, for contrast
```

Zero dependencies, pure node, require-able as a module. Nothing in the app, the
kernel or the gates depends on it. **Verification budget, per Paul's law: the
byte-exact round-trip IS the proof** — no gate runs, no renders, no browser,
because this pass changes no shipped behaviour. `nukernel/genres.js` is not
touched by this work.

### One limitation of source emission, recorded

A value built by CALLING an operator factory — `period: [[], [], [], [drop(3)]]`
— prints as the closure the factory returned, complete with its captured free
variables, so `--source` cannot round-trip it as *text*. The expander compares
by reference and round-trips it exactly; only the printed source is affected,
and the delta is hand-written by definition. It costs nothing today. It would
cost something the day anyone tried to generate an anchor file end to end, which
is one more reason not to.
