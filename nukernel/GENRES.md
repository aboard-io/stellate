# GENRES — the catalogue is data now

**2026-09-02.** Paul: *"Are you sure we shouldn't move everything including the
closures into sqlite and go the other direction — manage the data as data and
then export it as JSON or even JS for operation and distribution? That feels
like it might allow the most flexibility."*

So it went the other direction.

| | before | after |
|---|---|---|
| source of truth | `nukernel/genres.js`, 27,377 hand-written lines | `nukernel/genres/<key>.json`, 421 files, one per genre |
| shared tables | the top and the foot of the same file | `nukernel/genres-tables.js` (hand-written) |
| the shipped script | hand-edited | **generated** by `tools/genres/build.js` |
| a row's prose | a comment | the row's `note` field |
| a row's four closures | JavaScript functions | templates in a nine-kind grammar, with a formula escape |

`nukernel/genres.js` is still committed, still one self-contained file, still
loaded by a plain `<script>` tag with no build step in front of it. Nothing in
`index.html` moved, no new load order exists, and every consumer that did
`require("./genres.js").GENRES` still does. What changed is who writes it.

---

## 1 · The law

**`nukernel/genres.js` is GENERATED. An edit made there is an edit the next
build throws away.** Its header says so and `test/genres-build.test.js` G1 holds
the committed bytes to being byte-for-byte what a fresh build produces.

This is the `gates.js` / `wiki.js` arrangement, for the same two reasons: the
artifact is committed so the browser needs no toolchain, and a gate holds the
committed artifact honest so nobody can hand-patch it and have the patch stick.

**A row edit is three motions, not one:**

```
$ $EDITOR nukernel/genres/dubstep.json
$ node tools/genres/build.js
$ git add nukernel/genres/dubstep.json nukernel/genres.js
```

**Check without writing:**

```
$ node tools/genres/build.js --check       # exit 1 and the first differing line
$ node test/genres-build.test.js           # G1..G4, the whole contract
```

`genres-build` is registered in `test/all.js` as a **wave 1 node** gate, beside
`rules` and `document`, because it is the data tier and nothing else.

**The two alias doors do not move.** The 2026-09-01 genre-only rename kept old
keys opening at the door through `document.js OLDKEYS` and `song.js migrate()`.
Neither is touched by this and neither should be: the rows are the third copy of
nothing. A renamed row is still a renamed *file* plus an entry in those two
doors, exactly as before.

---

## 2 · What is in a row file

`nukernel/genres/<key>.json` is a JSON object. Its keys are the row's fields
**in the order the row declares them**, and that order is what the emitter
writes back out — so field order is a real, editable fact, not an accident of a
serializer.

```json
{
  "note": "Transform-heavy, staggered entries, no drums. …",
  "organic": true,
  "label": "Leipzig 1725",
  "voices": 4,
  "nobass": true,
  "plan": "arc",
  "bpm": 108,
  "parents": { "counterpoint": 0.55, "chorale": 0.25, "gregorian": 0.2 },
  "instr": "church_organ",
  "entry":   { "kind": "id" },
  "reg":     { "kind": "from", "n": 1 },
  "realize": { "kind": "const", "n": "line" },
  "word":    { "kind": "formula", "src": "(v, s) => [ … ][v]" }
}
```

### `note` — the record of why

Every one of the 421 rows has one. It is the row's whole argued comment block:
the prose above the row **and** the prose written between its fields, joined in
source order, line breaks and indentation kept, comment markers off. The build
re-emits it as the `//` block above the row, so `nukernel/genres.js` reads the
way it always read.

**The one thing the migration lost, said plainly:** a comment that sat *beside a
field* no longer knows which field it sat beside. `note` is one string and the
blocks are concatenated in order. In practice this costs little, because the
catalogue's house style already names the field in the prose (`NOBASS,
2026-08-31…`, `A FUGUE IS PIPES.`, `` `intro` is the anchor's OPENING
STATEMENT``) — but it is a loss, and it is written down here rather than
discovered later.

### `parents` — a share of the child, and the residue is the invention

```json
  "parents": { "counterpoint": 0.55, "chorale": 0.25, "gregorian": 0.2 }
```

A weight is **the share of THIS record that the named ancestor explains** — not
a vote, not a distance, and not a partition the row is obliged to fill. Three
facts follow, and G2 holds the third:

- **The shares need not sum to 1.** What a row does not attribute it invented.
  That residue is the whole point of the genealogy program (2026-08-16: *genres
  declare weighted parents, the fit tool measures the residue, "the
  invention"*), and a row that says `{ ottoman: 0.45 }` and stops is making a
  real claim: fifty-five per cent of this music is not in the table above it.
  Measured 2026-09-03: **195 of 373 rows sum to exactly 1** and the rest sum to
  between 0.2 and 0.95.
- **The shares must not sum to more than 1.** A row cannot be more than all of
  itself, so a sum above 1 is not a weak claim, it is not a claim. **35 rows
  were above it** on 2026-09-03 — `shoegaze` at 1.50, `deathmetal` 1.45,
  `ambient` and `berlinschool` 1.40 — every one of them the same accident:
  a parent was PAID over the years and the weight was added without any of the
  old ones being reduced. All 35 were rescaled onto the catalogue's own 0.05
  grid with **every ratio the row asserted left exactly as it was**; only the
  total moved. Rescaling to 1 rather than to something smaller is deliberate
  and conservative — it credits each row with the *smallest* invention
  consistent with what it already said, so no residue is asserted that nobody
  argued for. Each of the 35 records the move in its own `note`.
- **No parent is LATER than its child**, which is not the same as "earlier".
  Nine edges in the catalogue join two rows of the same year and every one of
  them is legal — a music and the music it immediately answered can share a
  date, and the table's year is the year of a named record rather than of a
  scene. The law is written as *not later* on purpose, and G2 tests it that
  way.

`wants` is the other half of the same field: an ancestor **in its own name**,
as a plain lowercase string, where the table has no row for it. A want is paid
by a row only when the row is *the thing the want names* — not the thing the
want is made of. (`deltablues`'s "the songster's ballad stock" is the `ballad`
repertory and was paid 2026-09-03; `operetta`'s "the ballad opera" is a stage
form built on that repertory and was refused the same day, with the reason in
the row.)

### Data fields — verbatim

Numbers, strings, booleans, arrays and objects are stored as themselves. Two
things the JSON does *not* try to be clever about:

- **A string broken across source lines is one string.** `cannot: ["…" + "…"]`
  was a *layout* fact; the row said one sentence and the file wrapped it. The
  JSON holds the sentence; `tools/genres/emit.js` re-breaks it at spaces to the
  96-column budget on the way out. Break points are a function of the string, so
  a rebuild lands them in the same places.
- **A reference to a shared table stays a reference.** `scale: MODES.dorian` is
  not a copy of seven numbers, it is a row *naming* an alphabet, and copying it
  would make 291 owners of one fact. Those are written as the **source escape**:

```json
  "scale": { "$src": "MODES.dorian" },
  "mode":  { "$src": "MODES.ionian" },
  "prog":  { "$src": "PROGS.soul2" },
  "swing": { "$src": "2 / 3" },
  "tone":  { "wave": "sine", "verb": 0.2, "mouth": { "$src": "MOUTHS.melisma" } }
```

`{"$src": "…"}` means **emit this text verbatim**. It is the general escape for
anything that is JavaScript rather than JSON, and it nests anywhere a value goes
— 1,524 of them across the catalogue, almost all of them a table reference. The
five rows whose `period` is an operator list or a function use it too.

An object with an integer-like key would be re-ordered by JSON, so the extractor
refuses to split one and writes the whole object as `$src` instead. (No row hits
this today; the guard is there so none can arrive silently.)

---

## 3 · The closure grammar

`entry`, `reg`, `realize` and `word` are functions on every row, and a function
does not survive JSON. The genre-QA closure census asked whether they *had* to
be functions and answered no: 421 rows carried **12 distinct shapes** of `entry`,
19 of `reg`, 5 of `realize`. They are not programs. They are a handful of tiny
arithmetic sentences said over and over.

`tools/genres/grammar.js` is those sentences written down. It reads both ways —
`match()` turns an acorn node into a template, `emit()` turns a template back
into the same source text.

### The kinds

A **result** (what a value slot holds) is a JSON number or string, or
`{"$v": true}` for "the voice index itself", or `{"$src": "…"}` for source text
— which is how a `word` returns `[drop(2), transpose(-12)]`.

| kind | shape | emits |
|---|---|---|
| `id` | — | `v => v` |
| `const` | `n` = result | `() => 0` · `() => "line"` · `() => []` |
| `scale` | `n` | `v => v * 2` |
| `plus` | `n` | `v => v + 1` |
| `minus` | `n` | `v => v - 2` |
| `neg` | — | `v => -v` |
| `from` | `n` | `v => 1 - v` |
| `table` | `t` = numbers | `v => [0, 2, 1, 3][v]` |
| `cases` | `cases` = `[{at, then}…]`, `else` | `v => (v === 0 ? 2 : v === 1 ? 0 : 1)` |
| `formula` | `src` | the source text, verbatim |

A case's `at` may be an **array** — `{"at": [0, 3], "then": 2}` emits
`v === 0 \|\| v === 3 ? 2`. An `else` (or a `then`) of `{"$v": true}` emits `v`,
which is how `v => (v === 2 ? 0 : v)` is said.

`word`'s cases carry operator lists in their slots:

```json
  "word": { "kind": "cases",
            "cases": [{ "at": 0, "then": { "$src": "[rotate(2), drop(3)]" } }],
            "else": { "$src": "[]" } }
```

### `formula` — the escape hatch, and it is not a failure

198 of the 1,684 closures stay as source text, and 189 of those are `word` —
which is right, because **`word` is the music.** A row whose word is
`(v, s) => [[[], [rotate(0)], [invert(4)]][s % 3], …][v]` is saying something a
template kind would only obscure. The escape is there so the grammar never has
to lie about a row to hold it.

### What each field actually is

| field | templated | as `formula` | the shapes |
|---|---:|---:|---|
| `entry` | 418 | 3 | `id` 164, `cases` 104, `const` 89, `scale` 50, `table` 11 |
| `reg` | 417 | 4 | `cases` 214, `minus` 64, `table` 49, `const` 41, `neg` 21, `id` 17, `from` 10, `plus` 1 |
| `realize` | 419 | 2 | `const` 233, `cases` 186 |
| `word` | 232 | 189 | `cases` 214, `const` 18 |
| **all four** | **1,486** | **198** | `cases` 718, `const` 381, `id` 181, `minus` 64, `table` 60, `scale` 50, `neg` 21, `from` 10, `plus` 1 |

The nine formula rows outside `word` are the ones the census already named:
`entry` — `sizhu`, `isorhythm`, `skapunk`; `reg` — `polychoral`, `house`,
`techno`, `francoflemish`; `realize` — `filmi`, `fantasyscore`.

---

## 4 · `nukernel/genres-tables.js` — hand-written, spliced

A genre row says what is true of **one record**. The tables say what is true of
**the table**: `MODES`, `SCALES`, `MOUTHS`, `PROGS`, `DRUMNAME`,
`HARMONYLABEL`, the seed phrase `DEFAULT`, and the four stamp passes
(`DEFAULTS`, `FAMILIES`, `DYNAMICS`, `ORNAMENT`) that write a default, a family,
a dynamics row and an ornament onto rows that did not state one. None of it is a
fact about a genre — `DEFAULTS` exists precisely so a row states only what makes
it *different* — so none of it went into a row file.

**It is spliced, not imported.** `tools/genres/build.js` copies three marked
regions into the generated file verbatim:

- `DOC` — the file header `genres.js` has carried since it was written
- `HEAD` — every table the rows read, in the order they need them
- `FOOT` — the tables read *after* the rows exist, and the four stamp passes

The argument for splicing over `require`: the shipped `genres.js` stays **one
self-contained script**. A second file would mean a second `<script>` tag in
`index.html` and in every ideal/ page, a load-order fact that can be got wrong,
and a browser failure mode that no node gate would see. Splicing costs one
`indexOf` in the builder and buys the artifact staying exactly the shape every
consumer already expects.

`genres-tables.js` is *also* a working module — `require()` it and you get the
tables plus `stamp(GENRES)` — which is how a tool reads them without parsing
anything. `test/genres-build.test.js` G4 holds both properties.

**The build owns one thing and it is deliberately the smallest possible thing:**
the module envelope — the generated banner, the IIFE, the `const K` line, the
`api` object and the export. Adding an export is therefore a `build.js` edit, on
purpose: the export list is a fact about the module, not about the catalogue.

---

## 5 · `_order.json` — the order is a fact about the table

`nukernel/genres/_order.json` is a flat array of keys in catalogue order. A
directory listing is alphabetical and would have shuffled 421 records; a row does
not get to say where it sits, because where it sits is a claim about its
neighbours. The build **throws** if `_order.json` and the directory disagree in
either direction — a new row file that nobody listed, or a listed row with no
file — so a genre cannot be added and silently not appear, and cannot vanish
silently either.

Adding a genre: write `nukernel/genres/<key>.json`, add the key to
`_order.json` where it belongs, run the build.

---

## 6 · The gate

`node test/genres-build.test.js` — wave 1, node, no DOM, no audio, no render.

- **G1** the shipped `nukernel/genres.js` equals a fresh build, byte for byte.
- **G2** every row validates the grammar:
  - `plan` and `bpm` present on every row. **These two throw-by-name laws move
    here.** `compose.js` has always refused to default them and thrown by name
    at the moment somebody pressed play; now the same law is caught before a
    build. `compose.js` keeps its throw — it is the runtime's own backstop, and
    a record can arrive from a saved session as well as from this table.
  - a row's `label` is a `Place Year` **if and only if** it declares `parents`.
    That is not a list of exceptions, it is the law itself: the six function
    roles and the blank state are exactly the rows with no history. (*"a role
    has a job, not a history"*, `atlas.js`.)
  - every named parent is a key that exists, and **no parent is later than its
    child** — *not later*, not *earlier*: nine same-year edges are legal and
    stay. Measured over the whole catalogue the day this landed: 0 violations.
  - every declared weight is a share in `(0, 1]` and **a row's weights sum to
    at most 1** — the residue is the row's own invention (§2, `parents`).
    Measured 2026-09-03: 373 rows carry parents, 195 sum to exactly 1, none
    sum to more.
  - every closure is one of the nine template kinds, or a formula with a `src`.
  - a `note` is a string with no `*/` in it, so it survives the trip out.
- **G3** the closure round trip: every template `emit()`ed, `eval`ed back into a
  function, and called over **v = 0..8 × s = 0..7** against the closure the
  shipped file actually loaded — **121,248 calls**. A `word`'s returned
  operators are *applied to the seed phrase* and the results compared, never
  counted: two different operators are both `"function"`, and a shallow compare
  would have called them the same. (`test/document.test.js`'s `portrait()`
  learned this first.)
- **G4** the tables file still has its three regions and still loads as a module.

---

## 7 · The migration, and how to repeat it

`tools/genres/extract.js` is the one-shot that did it. It parses the
pre-inversion `genres.js` with acorn and **copies source text** — the conversion
is done by EXTRACTION, never by hand; not one value, number or sentence of prose
was retyped.

```
$ git show <the migration commit>^:nukernel/genres.js > /tmp/old.js
$ GENRES_SRC=/tmp/old.js node tools/genres/extract.js
$ GENRES_SRC=/tmp/old.js node tools/genres/extract.js --prove
prove     421 rows, 121248 closure calls, 0 mismatches — BEHAVIOURALLY IDENTICAL
```

`--prove` loads the old file and the freshly built one side by side and compares
them the only way that means anything: every declared field deep-equal in the
same order, and every closure **called** over the same grid with its operators
applied. It refuses to run against a file that is already generated.

**The first build was behaviourally identical.** 421 rows, 421 fields sets, zero
data mismatches, 121,248 closure calls, zero closure mismatches.

---

## 8 · Who else reads the rows

`tools/genre-qa/build.js` used to walk the 27,000 lines of `genres.js` counting
brackets to find each row's comment. It reads `note` out of the row file now,
which deleted the scraper and both of its failure modes (a row it could not
find, a comment it gave to the wrong row). Its `src_line` column held `null` for
every row after the inversion and was **dropped from the schema 2026-09-03**: a
row's address is its **file**, a line number into a generated artifact is a
number about the emitter's layout rather than about the catalogue, and a column
that can only ever be null is a question the mirror has stopped asking.

`test/grain-reach.test.js` greps the shipped `genres.js` for the ten
`grain: … — WITHDRAWN AS A DEFAULT` castings. Those live in row notes and are
re-emitted verbatim; the count is unchanged at ten.

Everything else — `precompose.js`, `compose.js`, `rules.js`, `document.js`,
`atlas.js`, `instruments.js`, `avail.js`, `ui/derive.js` and the rest —
`require`s `genres.js` and sees the object it always saw.

---

## 9 · Why this is worth the three motions

Paul's word was *flexibility*, and this is what it bought:

- **A row is addressable.** `nukernel/genres/dubstep.json` is a file a script, a
  tool, an agent or a person can read and write without parsing 27,000 lines of
  JavaScript, and without the risk that a bracket-counting scraper gets it
  wrong.
- **A diff is a row.** Editing one genre used to touch a file every other slice
  of the tree was also editing. Now it touches one 4 KB file — plus the
  regenerated artifact, which is noise a reviewer can skip.
- **The prose is a field.** The record of *why* is queryable rather than
  scrapeable, which is what `tools/genre-qa` wanted all along.
- **The closures stopped being opaque.** 1,486 of 1,684 are now nine kinds of
  small declared sentence, which means the box can be asked *"how many rows put
  voice 0 an octave down"* and answer from the data rather than from a regex
  over source text.
- **Another export is cheap.** SQLite, a CSV, a shipped `.json` bundle for a
  page that does not want the whole script — all of them are now a reader over
  `nukernel/genres/`, not a parser over JavaScript.

What it did **not** do: change one note the box plays. That was the point.
