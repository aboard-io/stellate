# INTERVIEW — the shape is generated, the wording is shared

Paul, 2026-08-25: **"Third way is good."**

Companion to `PROGRAM.md` and `WORLD.md`. `WORLD.md §4` ends on two open items
for Paul; this closes the first, and does not repeat the catalog argument, the
grid, the caricature mechanism or the `cannot` field — read `WORLD.md §4` for
those. `PROGRAM.md §2` fixes the eight-axes document and this writes against it
unchanged except where §3.5 says otherwise, out loud. Two designers took the
slice on 2026-08-25 and their notes are the argument, at
`/home/ford/.claude/jobs/c1b341cb/tmp/interview/`, `01-what-exists.md` and
`02-shape.md` — **read your note before you build your slice.**

Every number below was re-measured on 2026-08-25; where one differs from the
notes it is because the catalog moved under us — `precompose.anchors()` returned
130 when they ran and returns **139** now, which is itself the argument: the
mute count grows every time somebody adds a record. The standing laws apply.
**Check the parent first** — and it was: `git show main:` has none of
`askable.js`, `interview.js`, `avail.js`, `gates.json`, `precompose.js` or
`band-kit.js`, so this whole surface is branch-only with no prior art upstream
to reuse or contradict. **EXTRACTION, never by hand.** **Test the artifact.**
**Absent is today.** **One owner per fact.**

## 1 · THE DECISION

`WORLD.md:341-345` posed it: `band-kit.js:814` holds a SECOND genre table of 30
entries carrying "~45 hand-written English strings each — the interview
vocabulary, the one surface that does not scale by extraction. Reaching 215
through it is ~4,000 English strings." Three answers were offered; Paul took the
third, quoted in full because every section below is an application of it:

> Separate the SHAPE of the conversation from its WORDING. The extraction
> already knows which options are live for a given record — that is what
> `gates.json` measures. So the interview is **generated in shape** (which
> questions are worth asking about THIS record) while the English stays a small
> shared vocabulary. **The idiom lives in the ANSWERS OFFERED, not in bespoke
> sentences**: nobody writes a highlife question, but the highlife record's kit
> sheet offers the lanes highlife actually uses, and "who takes the tune" offers
> the instruments highlife actually seats. And the curated thirty stay as a
> LAYER ON TOP: where a hand-written question exists it wins; where it does not,
> the generated one appears.

### Rejected — "the globe is the front door, the interview stays curated"

This was `WORLD.md:344`'s own recommendation and it is a two-tier catalog with
the tiers renamed. Measured today: `precompose.anchors()` = **139**;
`band-kit.js:814 GENRES` = **30**, of which only **18 name an anchor**;
**121 anchors have no interview at all.** A record with no kit row is not merely
unadorned — `band-kit.js:2130` builds the "what are we playing?" options as
`Object.entries(GENRES)`, so an anchor outside the thirty **cannot be said**,
`genreOf` (`band-kit.js:1207`) returns null, and `anotherTake` reads `if (!gk)
return out;` (`band-kit.js:2434`): another take on 121 of 139 records moves the
take number and nothing else. Measured on a blank model, **81 seat questions,
480 options, `who` null on every one.** That is what the box hands somebody who
taps Accra.

And the thirty are not the thirty you would defend. Fifteen anchors are dated
2010 or later and **none** has a kit row; sixteen are labelled outside Europe
and North America and **fourteen are mute**, only `reggae` and `bossa`
surviving; and twelve `GENRES` keys (`hiphop jungle kraut slow chamber chant
trobar monody vienna salon waltz pianobar`) are not anchors at all, so the
curated table is not even a subset of the catalog it curates. Declaring the
interview curated freezes that map — the caricature of `WORLD.md:308`, one layer
up.

### Rejected — "grow the curated table to 215"

**The 4,000 figure is wrong, and that is not why this loses.** Measured over
`band-kit.js:814`: 30 entries, **1,163 English string leaves, 251 distinct, 101
unique to a single record**, and the marginal cost of the last ten records in
file order is **2.8 new strings each** (44 17 15 13 4 22 5 6 21 8 7 10 7 9 8 11
2 6 2 6 5 3 2 2 1 3 1 6 2 3). The vocabulary saturates: 185 more anchors costs
roughly 520 strings, not 4,000, because 90% of the table is references into
closed enums that already exist.

It loses for the reason that survives the correction. **Writing a real highlife
question requires knowing what a highlife arranger decides.** The curated row is
not forty-five strings; it is one claim per string about what a tradition's
musicians choose between, and no gate in this building can check one. Getting it
wrong once is a bad sentence — getting it wrong 185 times, at speed, is the box
putting words in a tradition's mouth in the confident voice it uses for house.
`WORLD.md:315` documents the failure three times over: `punjabipop` and
`corridotumbado` descend from `worldfolk`, Johannesburg 1986, because "the
genealogy law demanded a parent, the true parent was absent, and the nearest
anchor was conscripted." **Every law here that REQUIRES a field will do this
when the honest value is missing**, and a per-genre question table requires
forty-five of them. The third way removes the requirement: nobody is asked to
know what a highlife arranger decides, and the box asks a question it can defend
in general while offering the answers the record measurably reaches.

## 2 · THE CONTRAST, MEASURED

Two question surfaces exist and neither is the third way. They share no key, no
scope language and no head: `interview.js:100 interviewOf` runs on a band-kit
chair model, `avail.js:623 optionsFor` on an eight-axes document.

| | curated (`interview.js` over `band-kit`) | generated (`avail.js` over the document) |
|---|---|---|
| anchors reached | **18 of 139** | **139 of 139** |
| questions, one record | 99 (82 seat + 17 section) | 259 median · 119 min · 365 max |
| options, one record | 477 seat | 4,073 mean |
| **heads** | **21 named** (the record · the feel · the fills · the board · the glue …) | **0 — `SHEETS` has no `head` field** |
| asks phrased as questions | 99 of 99 | **11 of 28 sheet rows; 17 are bare nouns** |
| provenance ledger | `who` on every row: `{null:21, named:55, chose:23}` — **79 of 99 answered on arrival** | **none — the document has no `seeded`/`said`/`who` key at all** |
| idiom in the answers | 14 of 92 question ids narrow to the record | **25 of 28 `values()` take no document argument** |

The seventeen noun labels, verbatim from `avail.js SHEETS`: `meter · reading
speed · swing · key · mode · the changes · quality · role · plays · material ·
reads · the record's own · instrument · machine · the tune · the bass · the
kit`. Tap Accra and the box asks "mode" and "reads".

**The most load-bearing number here is 25 of 28.** Twenty-five `SHEETS` rows
declare `values: () => …` — a function taking no document, which therefore
*cannot know which record it is on*. That is the mechanical reason a chant is
offered the same 66 instruments, 9 drum machines and 6 bass styles as an
amapiano record: "the idiom lives in the answers offered" is not a mechanism to
invent, it is a signature change on twenty-five rows.

And the data is there: `doc.basis` equals the anchor name on **139 of 139**
precomposed documents (`precompose.js:1093`), every field the curated narrowing
reads has an extracted counterpart on the `genres.js` anchor row (`instr`
139/139, 66 distinct; `family` 139/139, 10; `plan` 3; `harmony` 3; `drumkit`
111/139, 9; `bassStyle` 89/139, 6), and `label` parses as `<place> <year>` on
**133 of 139**, naming **68 places** against the curated table's 25.

## 3 · THE DERIVATION

### 3.1 The rule

A question is live when the record can still say something different by
answering it. Three tests per (sheet, scope), reading only existing tables:

```
liveness(doc, sheet, scope):
    r = Avail.optionsFor(doc, scope, sheet, NuGates, env)

  (a) DARK       r.why != null              → not asked
  (b) STATEMENT  count(o where !o.disabled && !o.quiet) <= 1   → not a question
  (c) LIVE       otherwise                   → asked
```

**(a) must stay conservative, and `avail.js:337` says why.** A fit once greyed
`alphabet.harmony` because no harmony word moved a record of pure lines — and a
greyed harmony sheet is a record that can never grow a chord, when the way out
IS that sheet. So a sheet goes dark only when it declares a `kind` the record
makes no sound of, or declares `sheetGate: true` by hand with the reason beside
it. **One hand-written bit per sheet across exactly 28 sheets: it scales with
the vocabulary and never with the catalog** — the whole design in one line.

**(b) is a conversion the page already has a rule for.** Paul, 2026-08-24, at
`ui/eight.js:137`, `nu.css:508`, `ui/selects.js:17` and `ui/engineer.js:78`:
*"in general where there is ONE option a dropdown is preferred."* Same law as
`band-kit.js:4042`'s "a question left with one answer dropped whole", except
this page **shows** the answer instead of hiding it — `avail.js:15`'s reversal
of the parent, which DELETED an unavailable option, "because hiding destroys the
shape of the possible." **And `quiet` counts against liveness alongside
`disabled`**: measured over the 139 anchors, **14,790 disabled and 21,003
quiet** of 566,194 options, and a question whose only non-quiet answer is the
one already chosen is a wall with two doors into the same room —
`band-kit.js:3966`'s own phrase.

### 3.2 What it costs, and where it is cached

Per anchor, measured over all 139: `genreToDocument` **2.3 ms**, the liveness
walk of ~253 questions **26.8 ms** — against `interviewOf` at 134 ms and
`band-kit.js:4042 asked()`, the render-every-option pruner this replaces, at
1,168 ms. **It is cached nowhere.** Twenty-nine milliseconds is cheap enough to
compute at draw time, and a per-record precomputed shape file would be a fourth
source of truth about a question the page answers in 27 ms. The expensive half —
deciding which options are unreachable — was paid offline when `gates.js` was
built. It is 40× cheaper than the pruner *because* the measurement is a table.

### 3.3 The corpus is the bug, and it is one expression

`gates-extract.js:281-284` builds its anchor corpus as `const d = base();
d.basis = gk;`, where `base() = clone(NuSongs.TERMS)` — every anchor measured as
the shipped chant with its `basis` swapped. The liveness derivation over exactly
those documents, and over the real ones:

```
TERMS + basis swap, 139 anchors:   80 live questions EACH — one number
                                   distinct live-sheet SETS: 1
precomposed documents, 139 anchors: 119 / 259 / 365 live
                                   distinct live-sheet SETS: 6
```

Swapping `basis` cannot change the shape. The rule language reads `docFeatures`
(`avail.js:230`) and a genre row contributes only `basis.*` scalars; every
interesting feature the shipped rules test — `cast.drumsOn`, `cast.hasBass`,
`cast.hasPad` — is a fact about the BAND, and the band on `TERMS` is a cantor
and a schola. `gates.json`'s corpus line says the rest: `{records: 55, anchors:
12, rolls: 24, holdout: 33, compiles: 37221}` — **the gate has seen 12 of 139
anchors and saw all twelve as the same chant.**

**THE CHANGE: the anchor corpus is `precompose.genreToDocument(gk, seed)`.** One
expression, in the file whose whole job is measuring — *test the artifact*
applied to the extractor itself, since the record a person taps is a precomposed
document and today the table greys options on a record nobody plays. Cost is an
estimated ~25 min offline behind `test/gates-cache.js`'s content-hash skip: an
estimate from two real numbers, not a measurement. Measure before committing.

### 3.4 Ordering, and heads

`interview.js:78` states the constraint: the order "is the order a person is
asked in", fingerprinted byte for byte. The generated order is four derived
parts, none a table in the view — **(1)** the sheet's axis, in AXES.md
evaluation order, already written twice (`ui/eight.js:5`): Time · Alphabet ·
Material · Form · Development · Cast · Sound · Performance; **(2)** its position
in `avail.js SHEETS`, which is source order; **(3)** the record's own scope
order — `form.sections`, `doc.voices`, `alphabet.prog`; **(4)** the sheet's own
`values()` order, contractual at `avail.js:429` ("sheets.js never reorders,
because reordering moves a data-k under a live finger").

**Do not derive the axis by splitting the sheet key.** Development is spelled two
ways (`dev.line`/`dev.bass`/`dev.kit` and
`development.period`/`.breath`/`.pipe`) and `material.cell` is a Material key on
a `voice.section` scope. `axis` goes
**on the sheet row**: one word, 28 rows.

**And so does `head` — not an exception to `interview.js`'s law but the law.**
`interview.js:26-34`: "The HEAD of a question is declared on the question's own
row (`head`), in the file where the question is defined … This module does not
decide it and MUST NOT." A generated question is defined on its `avail.js
SHEETS` row, so that row is where its head is declared. The precedent is
shipped: `askable.js:71` grew a `head` on every row for this reason and
`fields.js:1620` carries it through verbatim (`ask: r.ask, group: r.head`). The
axis alone is not enough — `alphabet.key`/`mode`/`harmony` are one head but
`alphabet.quality` reads under "the changes", and `time.meter`/`swing` are "the
time" while `time.rate` is about the tune. The curated interview draws **21
distinct heads over 99 questions**, the resolution a person reads at, which
eight axis names would collapse. `head` and `axis` are two fields.

### 3.5 The ledger — the one genuinely new structure

Measured: `JSON.stringify(genreToDocument("house", 7))` contains no `seeded`,
`said`, `who`, `named` or `chose` key — no provenance on the document at all,
and without it the take law does not exist for the generated side.
`band-kit.js:2515-2523` records why that matters: "another take" rolls what the
record **named** and keeps what it **chose**, and when the dice re-rolled the
four decision tables too, the critic's median fell from the 60th percentile to
the 51st and D-grades went 3 → 14. So:

**`doc.said` — a flat map `"sheet-key@scope" → "named" | "chose"`, written by
`precompose.js` at the moment it composes**, that being the only place that
knows whether a value was a decision out of a table or the word for a state the
document was already in. Absent means a hand said it, or nobody has — exactly
what `band-kit.js:2489 saidBy` means by returning `"hand"` when the ledger has
no mark. **Fix in passing:** `interview.js:20` glosses `who` as *"'named' if a
hand said it, 'chose' if the record did"*, which is not what the ledger stores —
**both** words are the record's and a hand's answer is null. The structure is
right, the sentence above it wrong.

## 4 · THE VOCABULARY, AND ITS CEILING

### What `askable.js` already covers

149 lines. `ASKABLE` (askable.js:71) is **8 rows / 26 options**, keyed to KERNEL
FIELDS rather than to genres, plus `SCALES` (5), `NOT_ASKED` (7) and `WRITTEN`
(4). Measured coverage of the `house` tree: **8 of 99 questions (8.1%)** — it
does not solve the wording problem and does not claim to (`askable.js:15-20`:
content stays in the kits; it covers "the kernel's SCALAR and ENUM surface").

It is the right seed on two measured grounds. Its 8 questions and 26 words are
**byte-identical on all 30 records** — the only fully genre-independent part of
the interview. And its wording has **already crossed to the document surface
unedited**: three of `avail.js`'s 28 labels are `askable.js` asks verbatim
(`performance.stress` askable.js:72, `.phrase` :74, `.orn` :78), three of the
only eleven sheets phrased as questions at all. `index.html:160` loads
`askable.js` and neither `band-kit.js` nor `interview.js` — the shared
vocabulary crossing the two surfaces is not a hypothesis, it is the only reason
any of the generated surface reads as English.

### What has to be added

Nothing keyed to a genre. Counted exactly:

```
17  sheet asks — the 17 noun labels of §2, rephrased as questions
 4  new heads (28 sheets drawn from the 21 heads already in use)
 5  scope phrases, one per scope kind — measured: song 9 sheets · song.bar 1
    · section 9 · voice 5 · voice.section 4
12  sheet-gate reasons (avail.js WHY already holds 21)
 1  the statement widget's phrasing                              --  39
```

### THE CEILING: forty strings, and it does not move when the catalog does

**This design may add at most 40 English strings, total, forever.** The number is
defensible because it is a function of two counts that are not the catalog — 28
sheets and 5 scopes. Adding the 76th anchor adds zero; the 215th adds zero. The
structural half is the part a gate can hold: **no English string on the
generated interview path may be keyed by an anchor name.** Grep its string
tables for the 139 anchor keys; the answer must be zero. The 40 is the budget,
the zero is the invariant.

For scale: the entire English of all thirty curated records is **101 asks + 21
heads + 640 option words = 762 strings**, over 92 question ids and 848
(question, option) pairs, **and not one is keyed to a genre.** A highlife record
does not need a highlife question. It needs to say which of the twelve keyboard
jobs highlife keyboards do — pointers into a table that already exists.

## 5 · THE MERGE — curated over generated

### 5.1 The join key is not the id, and it is not the write-path either

Measured: the curated ids (`vocabulary.json`, 115) and the generated keys
(`avail.js SHEETS`, 28) are different namespaces, as are the write-paths they
declare — **179 curated paths (`bass.fig.deg`, `drums.kit.k`) against 47
generated ones (`alphabet.key`, `voice.part`), intersection EMPTY.** The curated
questions write into band-kit's model, the generated ones into the document, and
`index.html` loads neither: **the curated interview is not on the shipped page
today.** Joining 179 paths to 47 by hand is the hand-authorship this round
rejects. So: **the curated layer is a table of WORDING OVERRIDES keyed by anchor
and sheet key, EXTRACTED from `band-kit.js` + `vocabulary.json`, never typed.**

```jsonc
// nukernel/curated.json — extracted, never edited
{ "house": { "cast.part": { "ask": "who takes the tune?", "head": "the tune",
    "labels": { "lead": "out front" }, "from": "band-kit.js:2234" } },
  "afrobeats": {} }
```

Three properties, each load-bearing:

- **An override supplies WORDING ONLY — `ask`, `head`, per-value `labels`, never
  an option list.** The list is a claim about what the record can reach, and that
  claim is what `gates.js` measures. The decision's own split, made structural.
- **The unit of contribution is one row** — "anyone can improve an anchor by
  writing ONE good question", literally. Not forty-five strings, and not a claim
  about anything the contributor cannot hear.
- **At most 28 overrides per anchor exist**, there being 28 sheets — a hard
  ceiling by construction.

### 5.2 The merge

```
MERGE(doc): for each (sheet,scope) LIVE or STATEMENT by §3.1, in §3.4 order:
  C = curated[doc.basis][sheet]
  emit { ask:  C?.ask  ?? SHEETS[sheet].ask,
         head: C?.head ?? SHEETS[sheet].head,
         options: <measured>, relabelled by C?.labels,
         who: doc.said[sheet+"@"+scopeKey],
         source: C ? "curated" : "derived" }
```

Curated wins on wording, id by id, every time. Nothing is suppressed because
nothing is duplicated: one question per (sheet, scope), and the override changes
what it says, not whether it exists.

### 5.3 The drift case

An override written when the anchor had a drummer, on a record whose drummer has
been switched off. Three rules, all already law:

- **The generated gate wins over the curated options, always.** An option the
  table refuses is `disabled` with its reason — not deleted, `avail.js:15`
  forbidding that. If fewer than two reachable answers remain the question
  becomes a STATEMENT by §3.1(b), **keeping its curated wording**. The
  alternative is offering a word the kernel throws away, `avail.js:12`'s
  founding defect: "Nine words, nine taps, and three of them do nothing."
- **A `labels` entry for a value the sheet no longer offers is dropped and the
  extractor REPORTS it**, rather than the page swallowing it.
- **An override for a DARK sheet is not rendered.** It stays in the file and
  comes back when the drummer does.

Two standing exceptions must survive. **The standing answer is always offered**
(`band-kit.js:3956`, restated `avail.js:653`) — the word the record is currently
saying is never refused, or a loaded session is un-editable at the moment it
matters. And **fail open** (`avail.js:636`) — a sheet the table has never heard
of, or whose fit came back `regenerates: false`, greys NOTHING, because greying
a live option is worse than showing a dead one.

**`source` stays in the data and off the page.** A gate counts it and a
contributor page can list "the forty anchors with the fewest curated questions",
but a badge on 30 records and not on 109 builds in the UI the two-tier catalog
this decision exists to prevent, dressing a cosmetic fact (who typed the
sentence) as a musical one. Render both kinds identically.

## 6 · THE FILES AND OWNERS

Three agents are live elsewhere — `test/`, `nukernel/genres.js`, and
`nukernel/ui/*` + `nukernel/avail.js`; **Owner A does not start until the live
`avail.js` agent has committed.** Owners are disjoint by file: nobody edits a
file not on their row.

| # | owner | files, exclusively | what they do |
|---|---|---|---|
| **0** | **Z — the fixture** | `test/fixtures/interview-30.json` (new) | Freeze `interviewOf` for all 30 curated records from the unmodified tree, in the commit that adds it. **Nothing else may start first.** |
| **1** | **C — the corpus** | `nukernel/gates-extract.js`, `nukernel/gates.json` | §3.3. Anchor corpus becomes `genreToDocument`. Offline, long, independent of everyone. |
| **2** | **D — the idiom map** | `nukernel/idiom.js` (new) | The map from `genres.js` anchor words to sheet option values — 9 drumkit, 6 bassStyle, 66 instrument, 3 artic. Note 01 flagged this as the one unowned mapping. Extracted where possible; where a hand must write a pair, one line and a reason. |
| **3** | **A — the sheets** | `nukernel/avail.js` | Add `head:` and `axis:` to all 28 `SHEETS` rows. Rephrase the 17 noun labels as asks. Change the 25 `values: () => …` to `values: (doc, s, env) => …` reading `doc.basis` through D's map. |
| **4** | **B — the shape** | `nukernel/shape.js` (new) | §3.1 liveness, §3.4 ordering, §5.2 merge. Pure: document in, question tree out; no DOM, no engine, no table of its own. |
| **5** | **E — the ledger** | `nukernel/precompose.js` | §3.5 `doc.said`. `named` vs `chose` at the point of composition. |
| **6** | **F — the curated layer** | `nukernel/curated.json`, `tools/extract-curated.js` (new) | Extract §5.1 from `band-kit.js` + `vocabulary.json`. Report every unmatched curated question rather than dropping it. |
| **7** | **G — the heads** | `nukernel/interview.js`, `nukernel/band-kit.js` | Put `head` on the 72 headless `sectionAsks` rows (`band-kit.js:5122`). Fix the `who` gloss at `interview.js:20`. |
| **8** | **H — the gate** | `test/interview-gate.js` (new) | §7. Lands last; reads Z's fixture. |

**Order:** `0` alone, first. Then `1`, `2`, `7` in parallel — none touches a file
another needs. Then `3` (needs 2, and the live `avail.js` agent done). Then `4`
and `5` in parallel, then `6`, then `8`. **`nukernel/index.html` is touched by
nobody this round** — wiring the merged interview into the page is a separate
slice, after `8` is green.

## 7 · THE GATES

One node script, `test/interview-gate.js`, six assertions, no rendering, reading
the artifact and not the intention. **Under 30 seconds**, because it compiles
nothing — `gates.js` already paid for that.

```
G1  ABSENT IS TODAY.  Prove this first and alone. For each of the 30 curated
    records, JSON.stringify(interviewOf(m, MODES)) is BYTE-IDENTICAL to
    test/fixtures/interview-30.json, frozen from the unmodified tree in the
    commit that adds the gate, never regenerated silently. Baseline measured
    now, house: 7 seats · 21 heads · 82 seat + 17 section questions · 477 seat
    options · who {null:21, named:55, chose:23}.
    PROVES: Owner 0, and everyone after, did not move the thirty.

G2  EVERY ANCHOR SPEAKS.  For each of the 139, liveness(genreToDocument(gk,7))
    yields >= 8 LIVE questions. Measured floor today 119; assert well under it
    so the gate fails on a mute record, not a quiet one.
    PROVES: the mute-121 defect of §1 is gone and cannot return.

G3  NO ANCHOR IS ONLY GENERIC.  Every anchor has >= 1 live question at a voice
    or section scope, not only song-scoped axis questions (today 139/139),
    AND >= 6 distinct live-sheet SETS across the catalog.
    PROVES: §3.3 landed. Under the TERMS-swap corpus all 139 anchors have
    IDENTICAL shape — 80 live questions, ONE set — and one shape for a whole
    catalog is the same defect as an empty one. Only this clause catches it.

G4  NO QUESTION IS DEAD.  For every (anchor, sheet, scope) classified LIVE,
    count(!disabled && !quiet) >= 2; nothing DARK is rendered. Definitionally
    true of §3.1, so what it gates is the DERIVATION not drifting — it fails
    the day somebody adds a class or forgets `quiet`.

G5  THE LEDGER IS INTACT.  Every merged question carries a `who` of "named",
    "chose" or null; `doc.said` is non-empty on all 139; anotherTake(doc)
    MOVES something on all 139 (today: nothing on 121, band-kit.js:2434); and
    neither word is 0% or 100% of any anchor's marks.
    PROVES: the take law exists catalog-wide and §3.5 did not stamp everything
    one word — the regression measured once at band-kit.js:2515.

G6  THE CEILING HOLDS.  Count every English string reachable on the generated
    interview path; assert <= (today's count + 40), and that NONE of the 139
    anchor keys appears as a key in any of its string tables.
    PROVES: §4, permanently. It fails the first time somebody writes a
    highlife sentence into a table.
```

**G1 is the only one provable before any work lands. G2–G6 run on day zero
anyway and their numbers get recorded**, so the change is visible when it
arrives rather than asserted. Two tests `interview.js`'s header cites —
`test/unit/every-head.test.js` and `test/unit/offer-identity.test.js` — **do not
exist anywhere on disk.** Owner G writes them or removes the citation; a header
naming a gate that is not there is worse than no header. And the null-head count
`every-head` must drive to zero is
**72**, not 0 — measured on `Band.opening()`, 93 seat questions carry 0 null
heads and all 72 section questions carry one, because `band-kit.js:5122
sectionAsks` rows carry `who` and no `head`.

## 8 · WHAT THIS WILL NOT DO

In the register `WORLD.md §5` established and `songs.js:161` set — not an
apology, not a promise, a statement of what the grid can and cannot say.
**The generated question cannot have the idiom's own voice.** A highlife record
will be asked "who takes the tune?" and offered the instruments highlife seats.
It will not be asked what a highlife arranger is actually deciding when they
decide it, because the box does not know, and §1 is the argument that pretending
otherwise at scale is worse than a flat question. The generated interview is
correct and general; it is not intimate. Somebody who knows highlife will find
it slightly beside the point, and they will be right.

**Three more, honestly.** The option lists are only as good as the corpus, and
even after §3.3 `gates.json` measures what changes the *rendered score* — a
question can matter musically while moving no note the signature counts (the
four `blind` sheets, `sound.instrument` among them, are probably this, not dead
questions). `doc.said` is written by `precompose.js`, so a record built by hand
from blank arrives with an empty ledger and no take law until somebody answers.
And `curated.json` will be smaller than thirty rows, because a curated question
whose write-path has no document counterpart has nowhere to land; Owner F
reports those rather than losing them, and somebody must read the report.

**How a person improves an anchor.** One row in `curated.json`: the anchor, the
sheet key, a better sentence, optionally better words for the values it offers.
No option list, no claim about what the tradition can reach, no forty-five
strings. Reviewable by anybody who can read the sentence, checkable by G6 — and
the record is never mute while it waits.
