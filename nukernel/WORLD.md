# WORLD — making this box play the world's music

Paul, 2026-08-25: **"I want a system that can create realistic music in all
major historical world genres."**

Companion to `PROGRAM.md`. That file ordered a round of nine designers against
nine deliverables; this one orders a *program* against four walls, and the walls
are older than any round. Six designers took a wall each on 2026-08-25 and their
notes are the argument — `/home/ford/.claude/jobs/c1b341cb/tmp/world/`, numbered
`01-time` … `06-catalog` plus `00-noh`. **Read your slice note before you build
the slice.** This file is for what the six could not settle alone: the order, the
decision Paul made, and what this program refuses to pretend it can do.

The standing laws apply to every line below. **Check the parent first**
(`git show main:<path>`). **The conversion is done by EXTRACTION, never by
hand.** **Test the artifact** — gates read the RENDERED output. **Absent is
today.** **Keep like with like.**

---

## 1 · THE DECISION, RECORDED PROPERLY

### The old law, and it was earned

`AXES.md:48-53`, written 2026-08-23:

> **Time is not in a section.** "Nothing in a section tells time"
> (2026-08-16, `state.js`): a record swings or it does not, counts in three or
> it does not, has one drummer or it is two records. Tempo, meter, groove and
> swing are song facts. A per-section swing is the drummer changing hands
> mid-song, and the tell was that `compose.js` stamped the same value on every
> box.

The tell was literally one line, and commit `83db1eb` removed it:

```diff
-    // ONE GROOVE FOR THE WHOLE SONG — it used to be decided once and STAMPED
-    // on every box, which was the tell that it was never a box fact at all.
-    b.swing = S.swing;
```

A per-section field whose value was a function of the song's single draw. It
cost storage, a migration, a chip and a recompile trigger, and it never once
varied. **That failure mode is not repealed below. It is the thing every gate
in §6 exists to catch.**

### What the law excluded, measured

An aria in Chinese opera moves *manban → yuanban → kuaiban → sanban* — slow,
metred, fast, free. That sequence, *banshi*, IS the dramatic structure; it is
not a tempo marking on top of one. Gagaku's *jo-ha-kyū* and pansori's
*chajinmori*-to-*hwimori* are the same shape. Under the old law a record either
counts one way or "it is two records", so a large slice of the world's dramatic
music was unsayable — not badly said, unsayable.

### Paul's reversal, 2026-08-25

Shown that, he said: **"No that's correct, we should allow for it."**

That is a decision, not a topic. **Time becomes expressible per section.** Do
not re-open it; the design work is how to do it without losing what the old law
protected.

### The law, rewritten — not deleted

> **Time is not in a section — except the count.** A record's *groove* and
> *swing* are song facts, and the 2026-08-16 incident is why: `compose.js`
> stamped one draw on every box, and a field that is copied everywhere is a lie
> that costs a migration. Groove and swing are the drummer's HANDS, and a
> drummer changing hands mid-song is two records.
>
> Tempo and meter are the COUNT, and a band changing count mid-piece is most of
> the world's dramatic music — *banshi*, *jo-ha-kyū*, the alap-jor-jhala. Since
> 2026-08-25 a section may declare its own `meter` and its own `pace`, where
> `pace` is a RATIO against the record's tempo and never a bpm. Absent means the
> song's own, byte for byte.
>
> The old law was never quite true of the code: `rate` has been box-scoped the
> whole time (`fields.js:1455`, `{key:"rate", scope:"box"}`, `RATES =
> {half:0.5, dbl:2}` at `fields.js:241`), it survived `83db1eb` untouched, and
> `ui/derive.js:219` applies it per box. A per-section tempo change at 2:1 has
> been shipping under a name nobody read as time.
>
> The gate is the writer, not the schema. A per-section time field that every
> section carries identically must not be carried at all, and the sweep must
> REPORT how many records actually vary it. Zero means it is decorative — which
> is exactly what `b.swing = S.swing` was.

### RECIPE — the implementer applies this to `AXES.md`

Do not paste this file into `AXES.md`. Do this:

1. In the table at `AXES.md:19`, the **Time** row's "scope today" cell becomes
   `**song-level**, except meter and pace — see below`.
2. Replace the paragraph at `AXES.md:48-53` with the rewritten law above,
   keeping **both** quotes and **both** dates visible, and keeping the
   `b.swing = S.swing` sentence — it is still the failure mode to design
   against.
3. In "THE SEQUENCE IS AN EVALUATION ORDER" (`AXES.md:76`), extend **Time comes
   before Material**: the meter decides how many steps a bar has, so a
   per-section meter makes cell length a per-section question, and the cell
   invariant restates as *every line cell read in ONE SECTION has the same
   length, a whole multiple of THAT SECTION's `stepsIn`.*
4. In "Two more things the eight do not settle" (`AXES.md:107`), strike Time
   from the open-scope list: it now says its own scope.

---

## 2 · THE FOUR WALLS, IN THE ORDER THEY SHOULD FALL

The measurement that reorders everything is `04-measurement.md` §4. Deviation
of each tradition's scale degrees from the nearest 12-TET semitone:

```
Arab rast / bayati / saba        max 50c   ← the note that NAMES the maqam
Javanese slendro / pelog         max 40c   mean 24c
Turkish uşşak / rast (53-TET)    max 19c   mean 6c
Carnatic just major              max 16c   mean 7c
Hindustani bhairav shruti        max 14c   mean 7c
Chinese sanfen sunyi             max 10c   mean 5c
```

Melodic-interval JND is ~10-20 cents. **12-TET is a hard wall for exactly two
families — quarter-tone maqam and gamelan.** For raga, for jingju, for Chinese
scale material generally, 12-TET sits inside or beside the JND, and the gap is
gamak, timbre and the framework nature of the tune. That single table demotes
tuning from first wall to third, and it is the clearest argument in the program
for why measurement comes before building (§3).

The second reordering measurement: recomputed over the benchmark's 386 notes,
**exact pitch fits at 37.8% and ONSET RECALL is 95.1%, precision 90.0%**
(`04` §3). The box puts notes where the tune puts them and then puts the wrong
note there. For West African bell patterns, gamelan colotomy, banshi, tala —
where cycle and form ARE the identity — the box is already at 90+.

### The order, and the yield that justifies it

| # | wall | cost (designer's own) | unlocks |
|---|---|---|---|
| **1** | **Metre** — three entries in `kernel.js:349`, one fact in five tables | Tier 0+1 **1.5 wk**; Tier 2 (/eight page) **+2 wk**; catalog **+1 wk** | aksak (ruchenitsa, kopanitsa, daichovo, paidushko), Turkish usul, 12/8 for blues/gospel/doowop, barcarolle's owed 6/8, the counting half of tala and gagaku |
| **2** | **Time per section** — the wall Paul just reversed | `pace` **1 wk, zero engine files**; per-section meter **+1.5 wk** | jingju banshi, gagaku jo-ha-kyū, pansori, alap→jor→jhala, tarab's arc |
| **3** | **12-TET** — every scale an integer semitone | `pcw` quantize **0.5 day**; transport + named cents scales **3-4 days**; notation **1.5 wk**; temperament **3 days** — **3-3.5 wk total** | Arab maqam, Persian dastgah, Turkish makam (pitch yes, notation no), historical temperament, real blue notes |
| **4** | **Instruments** — 123 in the registry, 82 castable | batch 0 **1 day**; percussion kits **1.5 wk**; the `wavs→zones` tool **0.4 wk**; Case B batches **~8.5 wk** | sitar/shamisen/koto/shakuhachi/taiko/steel_drums immediately; then tabla, darbuka, djembe, jingju gong set; then China, maqam, Anatolia, West Africa, gagaku, gamelan |

**Why metre first.** Highest yield per week, and the only wall with a defect
shipping today. `bulgarian` — "Sofia 1975", whose entire identity is aksak —
declares no meter and plays in 4/4; its own comment (`genres.js:712-714`) calls
the limp *"a kick on 1, 8 and 15 divides sixteen steps as 7+7+2"*, which is not a
Bulgarian metre at all but a syncopation inside four. The kernel already renders
any bar length (`drums()` reads `N = subj.deg.length`, `kernel.js:2289`; `timeOf`
is `(b*N+i+swing)/rate`, `kernel.js:366` — probed at 5, 7, 11, 12 steps) and the
chairs already speak twelve (`chair.js:82-165`). The wall is five copies of one
table plus a document page that generates into none of them.

**Why time second.** The engine already carries it: `engine/faust/live/live.js:259`
fixes `spb = 60/st.bpm` once per record and then asks the caller for each bar's
length in beats as an arbitrary float (`:267 opts.barBeats`) — and nukernel
already answers 4.061 down to 3.940 beats across a five-section song. Zero engine
files. It is second rather than first only because a per-section meter is worth
little while the metre table has three entries.

**Why tuning third.** The table above — and because the audio path is *already
continuous*. 63% of the shipped font's 861 zone roots are fractional and the
median playable note is already stretched 8.18 semitones from its root, so a
50-cent addition is 6% of a distance the engine pays on every note. The 12-TET
quantiser is two roundings in the wire format: `pchOf`
(`audio/to-engine.js:47`) and `cpspch` (`engine/faust/voices/state-engine.js:28`).
What is expensive is the *notation*, and the six places that reason about pitch
as an integer.

**Why instruments fourth — with one day of it stolen for Phase 1.** An erhu
playing 12-TET in 4/4 at one tempo is a Chinese-sounding timbre on a Western
record; volume behind the language, not in front of it. But `INSTRCHOICES`
(`fields.js:1355`) is built as the union of every genre's `instr`, so **41
extracted, licensed, on-disk instruments are uncastable because no anchor says
their name** — including sitar, shamisen, koto, shakuhachi, taiko_drum and
steel_drums. Six lines plus a `RANGES` row each. That is the highest yield per
hour anywhere in this document and it rides in Phase 1.

### What each tradition Paul named is waiting on

| tradition | waiting on | verdict |
|---|---|---|
| **Bollywood / filmi** | Wall 4 only — tabla, dholak, bansuri, sarangi. Shruti is 14c max, inside the JND; the metre is mostly 4/4 or a 6/8 keherwa. `shenai`(6 zones) and `reed_organ`(= harmonium, `genres.js:5961`) already cast. | **Closest. A percussion-kit job, ~1.5 weeks of Case C, no kernel work.** |
| **Chinese opera (jingju)** | Wall 2 (banshi is the form), then Wall 4 (jinghu, guban, daluo/xiaoluo — *China is entirely empty*, no guzheng, pipa, erhu, dizi, suona). **Not Wall 3** — Chinese scale material is 10c max. | Needs the decision Paul just made, plus an acquisition batch. The gong's fall is the `bend` field, not a Faust model (`05` §7). |
| **Gamelan** | Wall 3 **plus a non-2:1 period** (which `02` explicitly defers: `degPitch` hardcodes `12*floor(d/len)`, `foldInto` steps by 12), plus inharmonic timbre, plus Wall 4 with nothing on disk. | **Deepest, and the only one that is not measurable as correctness** — there is no canonical slendro, only per-ensemble *embat*. Last, and shipped only against ONE named ensemble's measured set. |
| **Maqam (Arab / Turkish / Persian)** | Wall 3 hard — 50c on the characteristic degree — plus Wall 1 (usul) plus Wall 4, where it is **the emptiest slot on the map**: no oud, ney, qanun, riq, darbuka, and GM has no entry for any of them. | Three walls. Tuning is the one that decides whether the name is a lie. |
| **West African ensemble** | **None of the four.** It is cycle and interlock, which is the axis the box already scores 90-95% on. Waiting on kora, djembe, talking drum, balafon — Wall 4 only. | **It should be the FIRST tradition to pass the new benchmark. If it does not, the metric is wrong, not the box** (`04` §9). |
| **Noh** (Paul: *"consider noh too"*) | All four, and two more that no wall names — see §5. | Carry as the honest limit case, not as a target. |

---

## 3 · MEASUREMENT FIRST, AND WHY THE ARGUMENT IS ALREADY WON

"Realistic" is the load-bearing word in Paul's sentence and it is unmeasured for
everything outside four centuries of Western practice. The standing view was
that the benchmark extension should precede the catalog expansion. **It should
precede the walls too, and it has already paid for itself before Phase 1
starts** — the two measurements in §2 that reordered the walls both came out of
the measuring stick, not out of anyone's intuition about world music.

Three findings make this non-negotiable:

**The stick cannot currently reproduce itself.** Re-running the frozen final
hymn sessions, the renders land exactly one octave low (`dox` 52-62 against a rip
of 64-74), so `score()` reads **0.0% exact for a tune that is 40-53% correct**;
best shift is +1 for all three. A TEST-THE-ARTIFACT failure *in the instrument*.

**Contour is not the escape hatch.** Sign-of-interval agreement is 47-54%,
interval-exact 26-31%. Any plan assuming a shape-based metric rescues the 38% is
building on a false premise.

**The corpus everyone assumes exists does not.** The 120,652-file MIDI trove
holds zero gamelan, maqam, taqsim, gagaku or tabla; the apparent hits are
*Ragazzo solo*, Schumann's *Arabeske* and the Nutcracker's *Chinese Dance*. Any
plan that re-mines the existing corpus is planning against an empty set.

**And the offline law does not block the fix.** It binds the shipped page, not
the build; `SOURCES.md`'s media policy is committed fetch recipes pulling into
gitignored directories. Derived statistics get committed, verbatim melodies do
not — the rule the trove already follows.

The metric splits into **five reported numbers, never one percentage**: onset
recall/precision · pitch as band membership at a declared cents tier ·
skeleton-tone recall · ornament density by kind · **variation spread across five
seeds**. That last one is the most diagnostic thing in the program: a tune
tradition should score high, a framework tradition must score middling, and *a
box that scores 100% on a raga has failed.*

Tolerance is a property of the tradition, published with the score: **±15c**
fixed-pitch (against one named ensemble, never an idealised table), **±25c**
theory-fixed (makam, Carnatic, 24-TET maqam), and **band membership rather than
a distance** for expressively mobile degrees like the Arab *sikah* and the
Turkish *uşşak* second, because scoring those to a number measures the wrong
thing.

The sentence this buys: *"our Cairo hits 62% skeleton-tone recall and 91% onset
recall against a named Longa, scored at the ±25c tier, intonation nuance not
measured."* A sceptic can check that. **"Our Cairo is 62% realistic" is not that
sentence and must never be written.**

Three traditions first, chosen to span failure modes rather than the map:
**Turkish makam** (SymbTr is the only legally clean symbolic corpus that is
natively microtonal — it is where a cents metric gets validated before the
alphabet is touched), **one West African bell tradition** (the one that should
pass), **jingju** (the one Paul asked about, and its section-time ratio check
needs no corpus at all).

---

## 4 · THE CATALOG FRAME

Today: **124 place-year anchors** (130 `GENRES` keys minus the 6 roles
`atlas.js EXCLUDE` declares are not places), 65 coordinates, 69 year stops.
**107 of 124 (86.3%) are Western Europe or North America**; the USA and UK hold
88 (71%). All seventeen pre-1900 anchors are European art or church music; the
earliest non-Euro-American anchor is tango, Buenos Aires 1935, and sixteen of
the seventeen non-Euro-American anchors are 20th/21st-century recorded pop.
**The catalog knows one deep tradition and knows the rest of the world only
through the record industry.**

### The grid, not the list

"All major historical world genres" cannot be a list you finish; it can be a
**grid you fill**: **nine Garland regions × the functions each region's music
performs** — liturgy/devotion, court/classical/art, theatre/drama, social dance,
narrative song/lament, work-ritual-life-cycle, popular/recorded. Function rather
than era, because era outside Europe is either a codification date or a
recording date wearing the same clothes, and a region×era grid would generate a
row demanding "Java 1600" and then enforce the fiction through the label law.

**Target ~215 anchors: +91, none in Europe or North America.** Africa 5→24
(double floor — Garland's own volume subdivides into five music worlds), Latin
America/Caribbean 8→16, East Asia 2→16, South Asia 1→16, Middle East & Central
Asia 1→16, Southeast Asia 0→12, Australia & Pacific 0→8. Euro-American share
86% → 51% — not parity, and it should not be, because the box's Western depth is
earned knowledge and not padding. **The stopping rule is the grid, not the
number:** a cell is filled or **declared empty with a reason**, exactly as
`atlas.js EXCLUDE` declares the six roles that are not places.

#### THE SCORECARD, TAKEN 2026-08-30 (the ledger round)

Nobody had ever run §4's own numbers back against the catalog, so the targets
above sat unaudited through nine rounds. Measured off `genres.js` and
`atlas.js` themselves — never off a comment — with "Today" above meaning
2026-08-24 and "now" meaning today:

| region | then | target | now | verdict |
|---|---:|---:|---:|---|
| Africa | 5 | 24 | **25** | met, +1 |
| Latin America & Caribbean | 8 | 16 | **35** | met, +19 |
| Middle East & Central Asia | 1 | 16 | **23** | met, +7 — but 22 of the 23 are Middle East and **Central Asia holds one dot, Kabul** |
| East Asia | 2 | 16 | **15** | short 1 |
| Southeast Asia | 0 | 12 | **7** | short 5 |
| South Asia | 1 | 16 | **7** | short 9 |
| Australia & Pacific | 0 | 8 | **1** | short 7 — `exotica`, Honolulu 1957, landed the day the coastline was re-baked |

Totals: **367 place-year anchors** (target ~209 after the six roles — passed by
76%), **173 coordinates** (was 65), **156 year stops** (was 69), and **68
pre-1900 anchors** where there were 17. The sentence *"all seventeen pre-1900
anchors are European art or church music"* is **defeated**: 16 of the 68 are
not, and the oldest three on the map (Hohle Fels −33000, Jiahu −6000, Ur −2500)
are a bone flute, a crane-bone flute and a lyre.

**The Euro-American share is 69.2% (254/367), against the 51% target** — the
one headline number still short, and it is short because the numerator grew
too: Europe took 139 rows and North America 115 while the four Asian and
Pacific regions took 30 between them. **The next hundred rows cannot come from
Europe or North America if this line is ever to be paid.**

#### THE GENEALOGY PREDICTION WAS WRONG, AND THE SHAPE OF THE ERROR MATTERS

§4 predicted *"at ~215 expect 6-9 components — roughly one per region for
pre-contact traditions, plus one large and genuinely real Atlantic component —
and declared roots going to 25-40"*. Measured at 373: **27 components and 54
declared roots**, and the sizes are **344, 2, 2, 2, and twenty-three
singletons** — of which six are the kernel roles (`simple`, `solo`, `vocal`,
`backing`, `riff`, `pad`), which have no genealogy on purpose, leaving
**seventeen real anchors alone in the graph**.

That is not the predicted shape. The Atlantic component did not sit beside
regional ones — it **absorbed** them, at 92% of the catalog — and what
"fragmented" is not a family per region but a scatter of rows with no parent
and no child at all: `gamelan`, `jingju`, `carnatic`, `sizhu`, `guqin`,
`mbuti`, `georgian`, `huayno`, `mariachi`, `forro`, `kizomba`, `lukthung`,
`balkanbrass`, `tarantella`, `zema`, `hohlefels`, `jiahu`. The three pairs are
`irishtrad`–`seannos`, `urlyre`–`hurrian`, `klezmer`–`chazzanut`.

THE CONSEQUENCE, which is §4's own: *"the fit tool's residue = the invention
metric is only meaningful WITHIN a component"*. For seventeen anchors there is
no within — the metric has nothing to measure, and those rows are precisely the
non-Western ones. **A world anchor with no edges is a dot, not a genealogy**,
and closing that is a catalog job (each of these has ancestors the table could
hold) rather than a gate job.

**The map is the alarm, not the specification**, and here is the proof: bringing
all forty of the world's largest urban areas within 2,000 km of an anchor takes
**six new dots** — Beijing, Jakarta, Bangkok, Chennai, Kinshasa, Lima. Six dots
is precisely the costume failure. A dot has no depth; the map can show you a
hole but never tell you it needs eleven anchors rather than one. Keep a gate
that prints the largest inhabited region more than N km from any anchor every
run. It must never be the thing that says "done".

### What happens to the genealogy graph

It fragments, and **that should be legislated, not discovered as a gate
failure** — because the pressure of a failing gate is to invent parents, which
is how we got here. Today the graph is 2 components (123 + `tango` alone) with 5
declared roots. At ~215 expect **6-9 components** — roughly one per region for
pre-contact traditions, plus one large and genuinely real Atlantic component —
and declared roots going to **25-40**.

Two consequences:

- **The fit tool's "residue = the invention" metric is only meaningful WITHIN a
  component.** Measuring jingju's residue against Euro-American ancestry
  measures the distance between traditions, not an invention.
- **The correct response to a missing ancestor is `parents: {}` plus a `wants`
  entry**, which is what `bulgarian` already does: *"Gregorian is chant, but the
  wrong church: claiming it would be tidier than it is true"* (`genres.js:722`).
  That comment is the model.

### The caricature mechanism, caught running

It is not hypothetical. Three parent edges are stand-ins:

```
punjabipop     (S Asia)  <- worldfolk (Africa)  w = 0.40
corridotumbado (Mexico)  <- worldfolk (Africa)  w = 0.30
mahraganat     (Egypt)   <- bulgarian (Europe)  w = 0.30
```

`worldfolk` is Johannesburg 1986. It has two children and **neither is
African**. Nobody typed that as a lie: the genealogy law demanded a parent, the
true parent was absent, and the nearest anchor was conscripted. **Every law in
this building that REQUIRES a field will do this when the honest value is
missing.** A cross-basin parent gate run today flags 14 edges, passes 12 on
comments already written, and fails exactly those known lies. A gate that finds
the two known lies on its first run is a good gate.

Three protections, adopted:

1. **A `cannot` field — the negative twin of `wants`.** `wants` names a missing
   *ancestor*; `cannot` names a missing *word in the language*. `mahraganat`'s
   comment already says phrygian was *"the nearest one the box can SAY"*. Turn
   the prose into data, because prose drifts from the data it labels — that is
   `vocabulary.js`'s own argument.
2. **The primary-fact rule.** A human names ONCE, per tradition, the single fact
   without which the name is false — jingju: banshi. Hindustani: a drone and a
   rāga that is not a scale. Gamelan: slendro/pelog, not fixed between
   ensembles. Aksak: the uneven bar. **If that fact is in the anchor's `cannot`,
   the anchor does not ship under that tradition's name.**
3. **Ship the admission on the page**, in the record's own sentence.

**Two open items for Paul, said out loud rather than defaulted into by cost:**
`band-kit.js:814` holds a SECOND genre table of 30 entries carrying ~45
hand-written English strings each — the interview vocabulary, the one surface
that does not scale by extraction. Reaching 215 through it is ~4,000 English
strings. The recommendation is that the interview stays a *curated* surface and
**the globe is declared the catalog's front door**. And the year should be
documented as source provenance, not asserted as a measured property: nothing in
this box distinguishes 1975 Sofia from 2015 Sofia.

---

## 5 · WHAT THIS PROGRAM WILL NOT DO

Ranked by how often it will come up. Every one of these gets a `cannot` line in
the anchor, written in the voice `songs.js:161` already uses for the chant:

> *"Chant is unmetered and this box counts in sixteenths; half speed and long
> holds is as close as an honest grid gets."*

That is the register. Not an apology, not a promise — a statement of what the
grid can and cannot say, on the page, beside the record.

1. **Free / unmeasured rhythm.** *sanban*, alap, taqsim, organum purum, the
   Gregorian melisma, noh's *ma*. No entry in any metre table can say "no bar".
   **Compromise: half speed and long holds**, exactly as the chant already
   admits. `pull` (a named accelerando/rallentando shape) is designed in `01`
   §6.1 and explicitly deferred: it is the only piece with no mechanism
   underneath, and a free-time section with nothing measuring it is precisely
   the knob-that-lies the gate exists to catch.
2. **Independent tempi.** `audio/live.js:217` states the invariant — *"spb is
   constant for the whole record (the rubato lives in fractional barBeats, not
   in the second-per-beat)"* — and the beat counter, the countdown and the
   position LCD all ride on it. Per-section `pace` is a ratio for exactly this
   reason. **Compromise: one clock, and the players differ in density, not in
   speed.** Noh's hayashi floating against the singer is out of reach.
3. **Continuous pitch gesture** — gamak, meend, a sarangi's slide, the
   berimbau's coin. `sld` is BINARY and edge-valued, and `ORN` (`kernel.js:894`)
   has seven ATTACK shapes and not one pitch trajectory. **Compromise: grace
   notes and a slide flag.** The per-note `{bendFrom, bendMs}` channel exists,
   is tested, renders identically live and press, and nukernel emits none of it
   (`to-engine.js:1194` sends `slide` and stops) — that field is the one partial
   escape and it is a note-onset gesture, not an intra-note one. Reporting
   ornament density as **0% for raga is correct output**, and it is the evidence
   that funds the work.
4. **Non-2:1 periods** — real slendro, real pelog, stretched octaves.
   REVERSED 2026-08-30 (the pitch wall; Paul: "I think we need to deal with
   those in the engine"). This entry said: *"`degPitch` carries
   `12*Math.floor(d/a.length)`, `foldInto` steps by 12, `staffPos` divides by
   12. Cents buy unequal steps INSIDE an octave and nothing more. Compromise:
   say gamelan is out of reach, out loud, rather than claim it."* Now:
   `degPitch` reads `(a.period || 12)` — a scale row carries float semitone
   values and an optional `period` (genres.js `tuned(steps, period)`), the
   kernel's register fold and octave word move by that period, the bridge
   carries the sub-semitone remainder as integer `cents` beside the 12-TET
   `pch` spelling, and `mapEvents` lands it on every voice's Hz. Proven on
   rendered samples (`test/pitch-wall.test.js`): a +50c note's FFT peak at
   452.89 Hz (+0.03c), an 11.8-semitone period closing at 1180.0c, slendro's
   240c step at 240.0c. What stays 12: the pch/staff/`.mid` SPELLINGS
   (nearest chromatic, honestly, cents in the data), the chord machinery
   (period scales should say `harmony: modal`), and the engine's
   register-safety folds. `staffPos` (ui/abc.js) still divides by 12 and
   still needs its nearest-chromatic intake — the page half is open.
5. **Timbre as the genre.** pansori's rasp, jingju's role registers, tsuyogin's
   near-pitchless declamation, throat singing, the drummers' *kakegoe* (an
   instrument that shouts is not in the registry's model). **Compromise: a
   structural checklist — right number of role registers, right sung/spoken
   alternation, right drum-to-voice ratio — plus a named expert listening, with
   the checklist published so the unmeasured part is visible.**
6. **Deliberate mistuning between players.** The noh *nohkan*'s `nodo` breaks the
   octave on purpose so the flute floats against the voice. A cents table is a
   tuning; this is an *anti*-tuning. **No compromise. State it.**
7. **Text-setting and prosody.** Syllable-to-note mapping is the composition in
   chant, jingju, qawwali and pansori alike. **Compromise: melisma density as a
   crude proxy, described as crude.**
8. **Micro-timing inside an aksak.** Real Balkan playing stretches the 3-group;
   `groups` is integers. **Compromise: `touch`/`humanize` approximates; the
   notation cannot say "the long one is 1.15× long."**
9. **The groove profile under any non-16 metre.** `kernel.js:415` stands the
   profile down when `steps !== 16`, and **104 of 130 precomposed documents
   carry a song groove** — all of them lose it the moment a metre is declared.
   **Compromise: the drummer's authored per-metre tables carry the feel**
   (`GROOVES3`/`GROOVES6` already do), and the metre table's comment says so.
   **Set this expectation before shipping, not after Paul hears a 7/8 record
   that is stiffer than its 4/4 twin.**
10. **Per-section swing and groove.** Kept forbidden. The 2026-08-16 law is
    correct about the drummer's hands. The section sheet should **not offer**
    them — the absence stated by omission, in the one place a user would look.
11. **`QFIX` chord qualities on a cents alphabet.** `kernel.js:662`
    `{maj7:[0,4,7,11], …}` is absolute semitones — the one genuinely
    12-TET-bound piece of harmony. **Refuse it rather than invent microtonal
    sevenths.** And `export/als.js:156` rounds into a KeyTrack with one integer
    pitch per track: **warn or refuse, never retune silently.**
12. **"Historical" as a measured property.** Nothing here distinguishes 1975
    Sofia from 2015 Sofia. **Compromise: the year documents the SOURCE.**

---

## 6 · PHASE 1 — SPECIFIED TO THE POINT OF EXECUTION

**Somebody could run this tomorrow.** One round, three owners, disjoint files.
Its theme: *the box counts wrong, and the stick cannot measure it.*

It is deliberately small and deliberately audible. `bulgarian` is the smallest
possible proof that any of this works — a record shipping wrong today, whose fix
touches one anchor and demonstrates the `deg` law at the same time, because its
`word: v => (v===0 ? [] : [transpose(1)])` — the second above — **does not move
at all** when the bar changes, since Material is alphabet-free and metre-free.

### Owner A — THE METRE ALGEBRA (kernel)

**Files (exclusive):** `nukernel/kernel.js`, `nukernel/ui/chair.js`.

1. **First commit, alone:** quantize `pcw` (`kernel.js:212`) to
   `Math.round((((n%12)+12)%12)*1e4)/1e4`. Bit-identical on integers; without
   it a real cents table makes float `%` miss 37% of octave-transposed scale
   tones and in-alphabet notes fall 93% → 57%. It is a correctness fix that
   costs nothing and is the prerequisite for all of Wall 3. Ship it by itself.
2. Add `groups` to the meter object — step counts summing to `steps`,
   **present-only, deriving as uniform when absent** so every existing reader
   stays byte-identical. **The grouping is the identity**: 9/8 as 2+2+2+3 and 9/8
   as three dotted beats are the same 18 steps and different music —
   `kernel.js:335-341`'s own 3/4-vs-6/8 argument, extended.
3. **A step stays a sixteenth** (`plan.js:260 stepDur = 60/bpm/4`), so x/4 is 4x
   steps and **7/8 is fourteen steps, not seven** — or `stepDur`, `DTIMES` and
   `desk.js:981` break. Ten metres per `03` §2: `three six twelve five seven
   paidushko ruchenitsa daichovo kopanitsa ten`.
5. `stressAt` (`kernel.js:1272-1278`) becomes a per-metre weight **vector**
   computed once, **returning null on uniform metres so the old three-line body
   survives verbatim** and the float-identity tripwire (`kernel.js:362`) never
   fires. Two callers: `:1309`, `:1341`.
6. `chair.js`: `METS` derived from `METERS`; `barOf` and `regrid` read prefix
   sums of `groups`; the count row becomes the GROUP — `"1 2 · 1 2 · 1 2 3"`,
   not a running 1..7 — derived once here so `ui/eight.js:201`'s literal can be
   deleted by Owner B.

### Owner B — ONE TABLE, THE BULGARIAN DEFECT, AND BATCH 0

**Files (exclusive):** `nukernel/fields.js`, `nukernel/avail.js`,
`nukernel/band-kit.js`, `nukernel/drums-kit.js`, `nukernel/bass-kit.js`,
`nukernel/ideas-kit.js`, `nukernel/genres.js`, `nukernel/instruments.js`.

1. **Collapse five tables to one.** `fields.js:282 METERLABEL` becomes
   `mapValues(K.METERS, m => m.w)`; `avail.js:138`'s `eq` map and
   `band-kit.js:2234`'s ARR options derive from it. Today `avail.js:247`
   enumerates `Object.keys(K.METERS)` for the availability sweep while
   `avail.js:453` builds the actual `<select>` from `METERLABEL` — a metre added
   in one place is **countable-but-unpickable**, a TEST-THE-ARTIFACT trap
   pre-loaded.
2. `drums-kit.js`: `setFor` (`:227-233`) becomes a key-indexed table instead of
   a 3-way sniff on `steps===12 && pulse===6`, plus **authored groove tables for
   the new metres**. This is the real musical writing in the round.
3. **`bulgarian` → ruchenitsa.** `meter: METERS.ruchenitsa` (14 steps, [4,4,6],
   `(2+2+3)/8`), **`bpm: 132`, not 96** — bpm is always the quarter, so 96 gives
   192 eighths/min against a real ruchenitsa's 260-300; the same trap
   `band-kit.js:1088-1093` already documents for 6/8. Kick on the heads of
   groups 1 and 3; the ison held. Add **`kopanitsa` as a second Bulgarian
   anchor** rather than a replacement, so "how does it count?" has more than one
   Balkan door. Rewrite the `7+7+2` comment — it described a syncopation inside
   four, and it was the tell.
4. **Instruments batch 0.** Add the 41 unreachable ids to `INSTRCHOICES`
   (`fields.js:1355`) — **and land a `RANGES` row for each in the same commit**,
   or it is a regression, not a feature: `SAMPLERS.shakuhachi` is ONE recording
   rooted at MIDI 72 declaring `lo:0 hi:127`, honest only from 60 to 78. Fix the
   two family misfilings while there: `shenai` is a double reed sitting in
   `lead`, `harp` is sitting in `guitar` (`instruments.js:1095`). **Write in the
   genre notes that this unlocks JAPANESE instruments and not Chinese ones** —
   a koto is not a guzheng, and `instruments.js:559-566` already rejects a
   clarinet standing in for a tenor sax.

### Owner C — THE STICK

**Files (exclusive):** `keeps/repertoire-benchmark/**` (outside the repo tree —
zero conflict with A and B).

1. **Octave-align-and-report in `score()`**, or score pitch-class and report
   octave displacement separately. Right now the frozen artifacts read 0.0%
   exact for tunes that are 40-53% correct.
2. Publish **component counts**, not the weighted `s` — `s` is a search
   objective, not a result.
3. Make the grid read a **meter** instead of hard-coding `bar*16 + pos`.
4. **Re-run the 386 and confirm 37.8% exact / 54.7% within a whole tone / 95.1%
   onset recall / 90.0% precision reproduces from the frozen artifacts.**
5. Do **not** touch `derivedSearch`'s answer space. Its integrity is that it
   only produces things a user could have said in the box, and that property
   must survive every change in this program.

### Sequencing hazards, named

- `test/precompose.test.js` is being edited by another agent as this is
  written. Owner A and B must not touch it; the G2 rewrite belongs to Phase 3.
- `fields.js` is Owner B's alone. Owner A wants nothing in it.
- `engine/faust/**` is touched by **nobody** in Phase 1.

### Gates

| gate | command | passes when |
|---|---|---|
| **byte identity** | the 130-anchor sweep | every anchor without a declared metre renders byte-for-byte what it did before. Absent-is-today, and the sweep is the tripwire (`kernel.js:344-347`) |
| **existing** | `node test/precompose.test.js` · `node nukernel/atlas.gate.js` | green, unchanged |
| **countable = pickable** (NEW, artifact) | `node test/meter-artifact.js` | every key of `K.METERS` appears as an option in the RENDERED `#app` select, and no option appears that `K.METERS` lacks. Reads the DOM, not the table |
| **the metred bar** (NEW) | a probe rendering `bulgarian` | the rendered bar is **14 steps**, kick onsets fall on the group heads, and no lane vector is silently truncated by `at()`'s wrap |
| **the stick** (NEW) | `node keeps/repertoire-benchmark/verify.js` | reproduces 386 targets, 37.8% exact, 95.1% onset recall from the frozen sessions |
| **the pool** (NEW) | the instrument gate | every id in `INSTRCHOICES` has a `RANGES` row and a `D.SAMPLERS` row; no one-zone instrument declares a range wider than root ±6/−12 |

### Acceptance test — one sentence Paul can check

**Play "Sofia 1975" and try to count it in four. If you can, Phase 1 failed.**

---

## 7 · THE PHASES

| # | phase | weeks | done when |
|---|---|---|---|
| **1** | **The count, and the stick.** Metre algebra (Tier 0) · one table (Tier 1) · `bulgarian` → ruchenitsa + kopanitsa · instruments batch 0 · `pcw` quantize · the benchmark reproduces itself | **2** | §6's acceptance test, all six gates |
| **2** | **Time per section — `pace`.** `document.js:150 toGenre`'s TIME row merges `doc.form.sections[si].time` (it already takes `si`, and `boxesOf` at `:268` already gives every section its own genre object) · `ui/derive.js:219 genreOf` · section sheet rows in `avail.js` · migrate `sec.rate` → `sec.time.pace` · keep `pace` OUTSIDE `kernel.js:461`'s RATE_MIN/MAX rubato clamp. **Land the section-time ratio check the same week** — it needs no corpus and it is the proof Paul's decision worked | **1 + 1 day** | G2b (a record whose sections all carry the same non-null time must not carry one) · G2c (**report** the count of records varying section time across 366; fail at 0) · G2d (strip every section time, compile, byte-identical) · G2e (`plan.barBeatsAt()` differs 4:1 across a `pace` 0.5→2 seam) |
| **3** | **Metre on the /eight page, and meter per section.** `song.js:346 okDrumPhrase` reads `stepsIn` not `16` · `precompose.js` born-in-seven · `avail.js` refits cells on set (today it writes `doc.time.meter` and leaves 16-step cells, so `16 % 12 = 4` and the phrase loses its tail) · `ui/eight.js`'s twelve literal sixteens · `document.js barsOf → barsAt` · **G2 rewritten to iterate sections** · `audio/desk.js:981`'s echo bus stays SONG-level with a comment saying why | **2.5** | G2 per-section; the metred document renders every onset it declares; the tempo-synced delay does not change length at a seam |
| **4** | **Cents.** Transport (`to-engine.js:47 centsOf`, one guarded multiply at `state-engine.js:2607` — a PARENT change needing the parent's gate and a `VOICES.md` paragraph) · named cents rows in `genres.js` · integer-equality tolerances at `kernel.js:285-292`, `:830`, `fields.js:647` · the engraving (`ui/abc.js`: `^/` and `_/`, the residual caption, the refusal past 25c, and **feed `staffPos` the spelled letter — `DIA[pcw(63.5)]` is `undefined` is a NaN and it CRASHES**) · temperament, gated on a cents probe · **fetch SymbTr and validate the cents metric first** | **3.5** | a maqam record plays in tune AND the staff does not print a spurious natural over a half-flat (today `audition.js:142` plays 63.5 correctly while `ui/abc.js` engraves `=E`); the staff refuses, in words, what it cannot draw |
| **5** | **The instruments.** Percussion kits first — 12 WAVs + a `kit.json` + ONE line in `fields.js:343`, zero code change, and `punjabipop`'s dhol-across-two-lanes (`genres.js:5978`) is the proof · the `bend` field (meend, the talking drum, the berimbau, the jingju gong's fall, and the blues scoop nukernel throws away) · the `wavs→zones.json` tool, which does not exist · then Case B batches. **Tier 1 or tier 2-BY only — `found/` is rsynced to the public web** | **1.5 + 0.4 + ~8.5** | each batch opens with a provenance check allowed to answer "no"; the fallback is tier-2-BY or nothing, never a tier-3 sample CD |
| **6** | **The catalog.** ~31 anchors writable against today's kernel (much of Africa, most of Latin America, the recorded-pop function everywhere); ~60 blocked behind Phases 2-5. The `cannot` field, the primary-fact rule, the cross-basin parent gate, the genealogy fragmentation legislated | **3-4 + 8-12 trailing** | every grid cell filled or declared empty with a reason; no anchor ships whose primary fact is in its own `cannot` |

**The tranche order is set by what is UNBLOCKED, not by what is empty on the
map.** Writing the blocked sixty anyway is exactly how the caricature ships.
