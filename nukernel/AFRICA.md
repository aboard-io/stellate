# Africa in the catalog

Paul, 2026-08-25: *"Fix the afrobeat parents and add the missing African history."*

Nine anchors were added and ten lineages repaired. This is the verifier's
report on what actually landed. It leads with what is still wrong, because
three of those things are wrong in a way that a reader of `genres.js` would
not guess from the comments.

---

## What is still wrong

**1. Marabi's inversion never reaches a record.** The `marabi` anchor calls its
`inv: 2` "THE HIGHEST STRUCTURAL VALUE ON THIS PAGE" and "the FIRST use of
`inv` anywhere in the catalog" — the six-four chord that makes the cycle lean
into its V. It is inert. `precompose.js:469` builds the document's chords with
`return { d: c.d || 0, q: c.q || "triad" }`, so `inv` is dropped on the way in,
and `document.js:160` then rebuilds the roots from what survived. Measured: the
composed marabi record's `alphabet.prog` is
`[{d:0,q:triad},{d:3,q:triad},{d:0,q:triad},{d:4,q:triad}]` — no `inv` — and
deleting `inv: 2` from the anchor produces a **byte-identical** bass line.
Put the `inv` back into the document by hand and 4 of 32 bass notes change
(bar 3 goes from MIDI 40/41 to 47/48 — the fifth in the bass, which is the
whole point). The kernel honours the field (`kernel.js:688`,
`bassPc: pcs[(c.inv||0) % pcs.length]`); it is the projection into a document
that loses it. `mbube` inherits the same dead field. **One line in
`precompose.js` fixes both.** It is the only dead field this round produced —
the other suspect, Congo rumba's two-bar clave, was checked and does play.

**2. The Aksum 540 record hires a Roman choir and a church organ.** The `zema`
comment is emphatic that this is "NOT a child of Rome 600 and must never be
written as one." Then the arranger writes it into the cast. On seed 1 the
composed record has a voice literally named `gregorian` singing the chorus and
a `church_organ` playing the bridge; seed 2 has the `gregorian` voice again;
seed 3 has the organ. This is not the new anchor's doing — `compose.js:1296`
hard-codes `vox: ["gregorian", "counterpoint", "fugue", "drone", "vocal",
"vocal"]` as the guest pool any choir record draws from, and it was written
when every choir in the table was European. `mbube` gets the same treatment: a
harpsichord on all three seeds and a `gregorian` guest on seed 2. Either the
`vox` guest pool needs to be per-anchor, or these two anchors need to opt out.

**3. Raï's declared parents explain 5% of it.** Run the fit
(`nukernel/genealogy.js`, from `main`): `rai` comes out **95% invention** —
the highest residue of any anchor in the slate, and near the top of the table.
The anchor itself declares `{ synthpop: 0.5, disco: 0.5 }` "UNDER PROTEST" and
says the protest is that these are "the AUDIBLE half and not the whole." The
measurement says they are not even that. `ethiojazz` (69% invention) and
`mahraganat` (66%) are in the same position. These are honest declarations of
a hole, but a reader looking at the published residues will read them as
"Oran 1985 was 95% original," which is not what they mean.

**4. Gospel still descends from a record twenty years its junior.** This round
fixed `hymn` (Boston 1831) descending from `gospel` (Chicago 1932) — a
101-year inversion — and correctly called it out. It edited `gospel` in the
same pass and left `blues` (Chicago **1952**) as gospel's (Chicago **1932**)
dominant parent at weight 0.75. That is the same error, twenty years wide, in
the anchor the fix touched. There are **19 parent-after-child pairs left in
the table** (`spem`←`counterpoint`, `beatles`←`motown`, `jazz`←`blues`,
`crooner`←`doowop`, `clubpop`←`house`, `screamo`←`emo` and thirteen more).
Some are defensible as proxies for an unbuilt ancestor; none says so. This
wants one sweep with a rule, not another anchor-at-a-time pass.

**5. `latinpop` still descends from `afrobeat`.** Flagged and not fixed, which
the anchor's own comment admits: Lagos 1971 is standing in for Cuba and
Colombia because Cuba and Colombia are not in the catalog. The fit is
unchanged before and after (76% explained, `afrobeat` fitted at 0.21).

**6. A number in a comment does not match the measurement.** The AFRICA block
says afrobeat's "published 44% residue was inflated." The published figure in
`main:nukernel/GENEALOGY.md` is **40.0%**, and re-measuring the pre-change
table gives 40% too. The repair is real and the direction is right; the
number quoted is not the one on file.

---

## The map, before and after

|                          | before | after |
|--------------------------|--------|-------|
| anchors on the continent | 5      | **14** |
| cities                   | 3      | **9**  |
| earliest year            | 1971   | **540** |
| Afro-diaspora anchors    | 6      | 6      |

Before, the continent had fewer anchors than its own diaspora and nothing
older than Fela. After, it has more than twice the diaspora and holds the
oldest record in the catalog — Aksum 540, sixty years before Rome 600, on a
1483-year span.

    540  Aksum         zema
   1935  Johannesburg  marabi
   1939  Johannesburg  mbube
   1957  Accra         highlife
   1960  Kinshasa      congorumba
   1969  Addis Ababa   ethiojazz
   1970  Bamako        mandeguitar
   1971  Lagos         afrobeat
   1985  Oran          rai
   1986  Johannesburg  worldfolk
   1994  Johannesburg  kwaito
   2020  Johannesburg  amapiano
   2021  Lagos         afrobeats
   2021  Cairo         mahraganat

All six new coordinates land **on land**, checked against the baked coastline
(point-in-polygon over 56 rings, 8219 points) rather than by eye: Accra 53 km
from the sea, Oran 26, Aksum 159, Kinshasa 301, Addis Ababa 498, Bamako 690.
No new place is wet.

---

## The nine anchors, one line each

| anchor | label | the claim |
|---|---|---|
| `zema` | Aksum 540 | Ethiopian Orthodox chant: unaccompanied, **pentatonic**, two half-choirs answering. A genuine root — not Rome's child. |
| `highlife` | Accra 1957 | West African dance band: horns in parallel, guitar in thirds, a clave timeline, and **changes** — I–IV–V–I at 120, where afrobeat is one chord at 108. The catalog's first African root. |
| `marabi` | Johannesburg 1935 | The shebeen pedal organ over one four-bar cycle that never ends. The music is 1920s; the label names the 1935 recording. |
| `mbube` | Johannesburg 1939 | Solomon Linda: the bass singers *are* the bass (`nobass: true` is load-bearing). Runs marabi's cycle, four years later, one suburb over. |
| `ethiojazz` | Addis Ababa 1969 | Mulatu's vibraphone and organ: bebop's instruments over a **modal pentatonic vamp**, not over bebop's changes. |
| `congorumba` | Kinshasa 1960 | Two guitars as one instrument with four hands — the rhythm part masked to the complement of the mi-solo's own gate. Clave across **two** bars, where Accra spends one. |
| `kwaito` | Johannesburg 1994 | House with the tempo taken out: **105 bpm, the slowest four-on-the-floor kick in the entire catalog**, 17 under house. Carries marabi's cycle read minor. |
| `mandeguitar` | Bamako 1970 | Named for the band on tape, not the tradition — because oral transmission leaves the Sound axis unknown, not merely undocumented. Second guitar rotates by six, so it interlocks rather than doubles. |
| `rai` | Oran 1985 | Pop-raï: accordion, synth, a cheap drum machine. Claims the 12-TET half of the repertory and says so. |

---

## Every stand-in, named

A stand-in is an instrument the box has standing where the record had
something else. Each is a real loss and each is written into the anchor.

| anchor | stands in | for | what is lost |
|---|---|---|---|
| `marabi` | `recorder` | pennywhistle | the shrill overblown top, the bent notes — most of what a kwela player does |
| `marabi` | closed hats | a tin of pebbles | it is a hat, not a rattle |
| `highlife` | closed hats + `kitVel` | maracas | the hand; the same compromise as `bodiddley` and `amapiano` |
| `ethiojazz` | `percussive_organ` | Hammond / Farfisa | `drawbarorgan` is one sample stretched 3½ octaves; this is six zones with the percussion stop |
| `ethiojazz` | tom lanes | congas | tuned drum heads, not hand drums |
| `rai` | `k`/`s`/`p` on a cr78 | derbouka | the goblet drum's pitch drop between dum and tak, and the finger rolls |
| `rai` | `phrygian` | hijaz | the augmented second; and sika/saba are not 12-TET at all |
| `afrobeat` | *(nothing)* | dùndún | not built: the talking drum bends pitch and `melodic_tom` cannot. Stays on `wants` |

**Not** stand-ins, and worth saying: highlife's handclaps are handclaps.
Marabi's `reed_organ` is a real pedal organ. Ethio-jazz's vibraphone is
Mulatu's own instrument. Raï's accordion is a raï instrument. Congo rumba's
clave stands in for a *Cuban* clave, which is what those players were playing.

---

## Does it sound like itself, or like the default in a costume?

Measured, not asserted. Distance in `genealogy.js`'s own 27-number feature
vector; the table's **median nearest-neighbour distance is 0.703**.

    d(highlife,   rock)      1.253      d(marabi,      gospel)     1.651
    d(ethiojazz,  jazz)      2.075      d(mbube,       hymn)       1.134
    d(zema,       gregorian) 0.380      d(kwaito,      house)      1.381
    d(highlife,   afrobeat)  1.421      d(mandeguitar, congorumba) 1.518
    d(congorumba, highlife)  0.769      d(rai,         synthpop)   1.800

Nine of these ten pairs are further apart than the median. **The exception is
`zema` and `gregorian`, at 0.380.**

Measured the other way — each new anchor's nearest neighbour anywhere in the
table — five of nine sit below the median, but four of those five land on a
plausible relative rather than on the catalog's default: `mandeguitar`↔
`afrobeat` 0.477, `kwaito`↔`gothicpop` 0.542, `marabi`↔`yachtrock` 0.585,
`congorumba`↔`worldfolk` 0.666. **`zema` is the one to worry about**: at 0.380
from Rome 600 it is the 8th-tightest anchor in a table of 133, against a
tightest pair anywhere of 0.311 (`yachtrock`↔`coastrock`).

It is still not a costume, and the rendered record says why: zema comes out
**5 distinct pitch classes** (A♭ major pentatonic — `tizita`) on all three
seeds, against gregorian's **7** (D dorian); 72–76 bpm against 76–80; and
zema's second half-choir enters a bar late (`entry: v => v*2`) where Rome's
two voices start together. That is a pentatonic chant against a diatonic one,
which is audible. But the feature vector cannot see it — the only coordinate
that moves is `width` — and the *cast* actively works against it (see item 2).
Zema is the anchor to listen to first.

The other two, in the rendered numbers:

- **highlife vs rock** — 123 vs 132 bpm; `funk` groove vs `push`; ionian and
  diatonic vs aeolian and not; I–IV–V–I vs i–i–VI–VI–IV–IV–i–i. Kit: five
  lanes against three. Highlife fires 782 timeline hits on `p` and 272 claps
  on `c`; rock fires **zero of either**. Highlife runs 2176 sixteenth hats
  against rock's 563 eighths.
- **ethiojazz vs jazz** — 96 vs 144 bpm; no swing vs `swing`; **one modal
  chord vs an eight-chord ii–V cycle of sevenths**; 5 pitch classes vs 12.
  Its kit puts 473 conga hits on the toms; the jazz kit puts 414 on the ride
  and only 48 on the snare. This is the furthest-apart pair measured (2.075).

One claim was suspected and cleared. Congo rumba says its clave is a **two-bar**
figure and that this is its clearest separation from Accra. The composed
document holds only one 16-step drum cell, which looked like the same loss as
marabi's — but `document.js:161` leaves `kits` alone while the drummer is on,
so `kernel.js:2300` still reads it per bar. Rendered: bar 0 fires `p` at steps
0/3/6 (the three-side), bar 1 at 4/10 (the two-side), alternating. It plays.

---

## The graph, after the repair

    afrobeat  before  { funk 0.70, jazz 0.30 }            60% explained · 40% invention
              after   { highlife 0.45, funk 0.35, jazz 0.20 }   69% · 31%

Fela's residue drops nine points, because a real ancestor now absorbs what the
funk weight was over-claiming. The fit's own weights land at highlife 0.37 /
funk 0.63 / **jazz 0.00** — the fit does not support the jazz edge from the
anchor data alone, though the historical argument for it is sound.

Two more where the fit disagrees with the declaration, in the direction that
argues *for* this round:

- `afrobeats` declares `afrobeat 0.35, highlife 0.20` and **fits highlife at
  0.51 against afrobeat's 0.06**.
- `kwaito` declares `house 0.65, marabi 0.35` and **fits marabi at 0.82
  against house's 0.18**. The African root the catalog did not hold explains
  the child better than the Chicago one it did.

Graph health, checked directly: **0 cycles**, **0 dangling parent refs**,
**every declared weight set sums to 1**. The `hymn`/`gospel` edit was the pair
that would have made the table's first cycle and does not.

---

## What is still missing, and why

**The metres.** `kernel.js:349` defines `six: { steps: 12 }`, but every
phrase, cell and kit vector in `genres.js` is written on **sixteen** places,
and `drums()` takes its bar length from the subject (`kernel.js:2289`). A
12-slot bell under a 16-step seed does not become 12/8 — it *phases*, and
takes three bars to come round. So the 12-pulse standard bell is not
expressible today: Ewe agbadza, the mbira's 48-pulse cycle, gnawa's lila, the
sabar rhythms of mbalax. No instrument work changes this. Every anchor above
is in four, and every one of them genuinely is — the records that define
dance-band highlife, Congolese rumba, marabi, mbube, ethio-jazz, kwaito and
pop-raï are 4/4 records. The queue behind this: **chimurenga (Harare 1977)**
is metre-blocked and nothing else, and is the first thing to build the day a
twelve-step seed exists.

**The samples.** Twelve drum lanes, twelve WAVs (`kernel.js:1776`), and among
them no bell, no shaker and no hand drum. `engine/registry-data.js` PERCBANK
holds 24 real percussion hits and nukernel reads **none of them** (grepped:
zero references). That is why maracas ride the hat lane and congas ride the
toms. Wiring PERCBANK into nukernel is the single highest-value piece of work
behind this round and it is not African-specific.
And no kora: `harp` is family-right and timbre-wrong (a soft orchestral pedal
harp with no attack), `koto` would be a Japanese zither wearing a Malian name.
So jeliya waits for a sample, and Mali reaches the map through the Rail Band.

**The tunings.** Everything above is 12-TET **on the records themselves** —
Mulatu played a vibraphone and a Hammond, the Rail Band played electric
guitars — which is why these anchors and not the mbira, the masenqo or the
older gasba raï. Ethiopian `qenet` was checked rather than assumed: `tizita`
is an anhemitonic major pentatonic (1 2 3 5 6) and is `SCALES.majpent`
exactly, no invented scale row. Raï's `sika` and `saba` have neutral intervals
and are not 12-TET at all; the anchor claims the 12-TET half and no more.

**Tone-language melody.** This one is permanent, not queued. Melody that
follows the lexical tone of its text cannot be said here, because `deg` is
"SIGNED and alphabet-free… never an absolute pitch" (`kernel.js:8`) — and
that is precisely the property that stops a text from constraining it. Any
repertory where the words choose the tune is out of reach by design.

**Deferred by name**, so nobody re-derives the argument: jeliya (no honest
kora), jùjú (the dùndún bends pitch and `melodic_tom` cannot), taarab
(three arguable stand-ins in one cast is a costume even when each defends
itself), gnawa and mbalax (two blockers each).

---

## Gates

    node test/precompose.test.js   139 anchors × 3 seeds = 417 records
                                   29 passed, 0 failed
                                   417 records · 4304 sections · 3408 line cells
                                   1,290,822 sounding events

    node nukernel/atlas.gate.js    PASSED all 34 checks
                                   73 stops (540..2023) · 133 records · 71 places
                                   0 orphans · 18 ERAS rows · 0 empty stops

    node nukernel/gates-extract.js --check
                                   OK  the shipped table is what the box says.
                                   (re-derived, not from cache)

    node test/all.js               8 pass · 6 fail

The six failures — `desk`, `shell`, `sheets`, `selects`, `producer-ui`,
`nudges` — are another agent's in-flight UI work and not this round's. Every
one of them fails on DOM structure a genre table cannot reach (`no <select> on
the board`, `NO development word became a menu`, `the nudge sheets are drawn —
0 found`), and `nudges` says so itself: *"the D7 recipe has not been applied
to the integration files."* `nukernel/ui/eight.js` and `nukernel/ui/state.js`
were being written while these gates ran.

**Note for the record:** the Africa work is no longer uncommitted. It was
swept into commit `3fa9ee9` ("the engineer, the producer and a globe you can
turn") together with a large unrelated UI change. The only thing left in the
working tree from this round is a comment edit in `genres.js`.
