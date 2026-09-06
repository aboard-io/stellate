# WAVE C · THE RECORD YOU CAN KEEP

*(`docs/REDESIGN-SCOPE.md` items 7–9, executed 2026-09-06. Written here rather
than into `nukernel/TABLE.md` because a second hand was in that file the whole
time this one ran; fold it in.)*

The three items are one sentence between them: **a record you made should be
findable, nameable and keepable.** The genre index gets a search field, a
section gets a name, and a link carries the song and does not eat the one you
already had.

Every number below is measured on the RENDERED page under iPhone emulation
(playwright chromium, 390×844 and 320×844, DPR 3, `isMobile`, `hasTouch`),
served from a local tree. Screenshots are in `scratchpad/design/wave-c/`.

---

## C1 · THE GENRE INDEX IS SEARCHABLE

**Before** (this tree, 2026-09-06, 390×844): the WHERE picker is a sentence, a
globe and 479 rows in one chronological column — **25,288 px of list**, with
the `triphop` row **19,593 px** down it. No field, no jump, no count. (The
walkthrough measured 19,306 px at 358 rows; the catalogue grew, the distance
with it.)

**After**: `#atlasFind` — one line at the head of the list, in flow, floating
over nothing:

| control | what it does |
|---|---|
| `#atlasQ` | a search field. Filters as you type, on the row's **name** (the word actually printed, `NuWiki.name`), its **key**, its **place**, its **year** as printed, its **era word** and its **family**. Every token must match, so `club bristol` and `bristol 1991` both narrow. |
| `#atlasJump` | 26 era chips — `atlas.js ERAS`, the old stone age to now, centuries and decades. One line, scrolls sideways. It **jumps**; it does not filter. |
| `#atlasCount` | how much of the catalogue is showing. `role="status"`. |

Measured after:

* `trip` puts the trip-hop row **1 px** into the list (from 19,593), 1 row
  showing. **2.3 ms** to filter all 479 rows, published on
  `#atlasFind[data-ms]` and read back by the gate.
* accent-insensitive: `cordoba` finds Córdoba (2 rows).
* family + place: `club bristol` → 4 rows. Year: `1991` → 9. Era: `the
  seventies` → 67.
* nothing matched says so in a sentence, not a `0`.
* the strip is **118 px** at 390 and 320 (field + count on one line, the chips
  under them), its top at y=452 with the panel open. No sideways page scroll at
  either width.
* an era chip moves the list 598 px → 12,163 px and the year follows it.

**THE GLOBE DOES NOT MOVE WHILE YOU TYPE.** The list is the time instrument
(`sweep()`), so hiding rows would otherwise drag the year — and with it every
mark, the ring, the camera and the sentence — under the finger on the keyboard.
`sweep()` refuses to run while a filter is up, and the ONE scroll a cleared
search writes (putting you back where you were standing) is swallowed too, so
the sentence over the globe is the same string before, during and after a
search. Pressing a row still flies the camera: `openRow` is untouched.

**THE JUMP IS CHIPS AND NOT A MENU** — twice-argued. Paul, 2026-08-24, of this
exact surface: *"get rid of the era select boxes…"*, and `test/atlas.js` G7 has
failed on `#atlasEra` and on any `<select>` under `#atlas` ever since. And
Paul, 2026-09-02: *"make those tables of dropdowns full of tappable grids."*
The dead id is not reused: this is `#atlasJump`, and it answers a different
question (it MOVES you; the killed one FILTERED).

**WHERE IT STANDS.** The brief said "the top of the picker". The top of the
picker is a sentence and a globe; a field above them would have put ~300 px of
earth between what you type and what it matches on an 844 px screen. It is the
LIST's head instead — under the globe, above the first row — which is where a
table's filter belongs and where the results appear directly beneath it.

Files: `nukernel/ui/atlas.js`, a four-rule append at the end of `nukernel/nu.css`.

---

## C2 · A SECTION HAS A NAME

`form.sections[si].name` — a ROW field, optional, **absent means the type's
word**.

* **`nukernel/document.js`** — `TIERS.name` (`{ tier: "row", at:
  "form.sections[si].name" }`) and a `CELLFIELD.name` reader with four nulls
  under it: no cell tier (a cell may not rename the section it sits in), no
  record tier and no genre tier (there is no default to inherit and no anchor
  may invent one). `normalize()` folds it through one owner and deletes an
  empty one. `boxesOf` stamps it on the box as `secname`, **present-only**.
* **`nukernel/fields.js`** — `secNameOf()` and `SECNAME_MAX` (40): one line,
  trimmed, capped, truncated rather than refused, a non-string is absent. The
  door, the sheet and the page all ask this one function.
* **`nukernel/ui/eight.js`** — `secName(i)` returns the name when there is one
  and `role + ordinal` when there is not. It was already the ONE owner of "what
  is this section called", which is why the field reaches fourteen surfaces in
  one line: the board's automation grid, the deck's "you are writing …", the
  motif bank's *played in* chips, every table row-head and cell-sheet
  accessible name, the section grips. A new `secWord(i)` is the same fact for a
  surface that draws it in a CELL (no ordinal — the row head prints the index
  itself).
* **exports** — `ui/derive.js songBars` carries `secname` onto every bar;
  `export/score.js` prefers it over the type's title-cased word while keeping
  the role's own count (`Verse 1 / pre-chorus / Verse 2`); `export/als.js`
  `clipNameOf` puts it first in a clip name. `.mid` track names are lane names
  and were never section words, so nothing there moves.
* **`nukernel/avail.js`** — `"form.name"`, `scope: "section"`, `text: true`,
  `values: []`. The one row in that table that is a FIELD and not a
  vocabulary; it says so rather than shipping an empty menu.

It rides copy/move/duplicate for free: `dupSection` is a deep clone of the row
and `moveSection` swaps the objects, so the name travels with the section and
not with the index. It survives save/load because the save IS the document.

**Gated** by `test/document.test.js` G14 / G14b / G14c / G14d, and
`node test/table.test.js` T2 is green **without re-pinning `BASE_SHA`** — an
unnamed record's boxes and rendered events are byte-identical.

### THE TWO SEAMS I DO NOT OWN

The section sheet's TypeScript and the table's row-head plate are the other
hand's files. Both are one line:

1. `nukernel/src/table/model.ts` (~461, the Form group) — add the field beside
   `form.role`:
   `form.push(textField(A, "form.name", { section: sid }, t("row.name")));`
   `avail.js` supplies the spec (`A.sh("form.name", { section: sid })`) and
   `wCell` already carries `text: true` through; what is missing is a
   `textField` helper and a `text` branch in `sheet.ts` that draws an
   `<input type="text">` instead of a chip row.
2. `nukernel/src/table/grid.ts:1072` (and `:881` when facing voices) — the row
   head's visible plate reads `${A.roleWord(s.role)}`, which is holding a
   string and cannot know whether that section has a name. Change it to
   `${A.secWord(i)}` (already on the API, already returns the type's word when
   there is no name). The TYPE stays visible in the section's own sheet, and
   every accessible name on that head already says the section's name today.

---

## C3 · A LINK CARRIES THE SONG, AND IMPORT LANDS YOU IN THE TABLE

### what the link carried, and what it carries now

**Before**: `#at=Bristol&y=1991&s=74&t=band` — a RECIPE. `recordAt(place, year)`
→ a genre key, then `genreToDocument(gk, seed, rules)`. It could not carry a
hired member, a renamed motif or a duplicated section, because none of those is
an input to the compose path. The walkthrough's verdict: opened clean it
restored *"the untouched genre … NONE of four hours of work."*

**After**: the fragment carries both, and the recording wins.

```
#at=Bristol&y=1991&s=74&t=band&d=<the whole document, deflate-raw, base64url>
```

The recipe stays, first, ~40 characters — it is what an older build reads and
what a person can read, and it is what lands if `d=` is unreadable or refused.
A build that understands `d=` never composes from the recipe at all (the boot
skips `ATLAS.open` when `d` is present — it was a wasted compose and a race).

**Sizes, measured 2026-09-06 on `keeps/triphop-pm-walkthrough/coach-house.song.json`
(14 sections, 10 players, 27 motifs — the biggest hand-built record this box has):**

| | bytes |
|---|---|
| the document, pretty-printed as the `.song.json` card writes it | 48,009 |
| the same document, compact | 20,069 |
| `deflate-raw` | 3,017 |
| …as base64url, which is what the fragment carries | **4,023** |
| the whole URL | 4,153 |

Over the WHOLE catalogue at seed 1 — 479 anchors, freshly composed — the packed
mean is **1,918** characters and the worst (`dusseldorfschool`) is **2,335**.

**The ceiling is `LINK_MAX = 12000` characters** — three Coach Houses, far
inside every browser's fragment limit. A record that does not fit gets **no
`d=`** and the share card says so and names the other door (the `.song.json`
card, which has no ceiling). The card also says what the link IS carrying when
it fits, and the copy button WAITS for the pack rather than copying a recipe
that arrived a frame early. `window.__eightLink()` publishes
`{doc, wire, fresh, over, max}` so the gate reads the cost off the artifact.

Compression is `CompressionStream("deflate-raw")` — the platform's own, no
library, nothing vendored, nothing fetched. It is a promise, so `linkFrag()`
stays synchronous and reads a cache keyed by the document's own text; `packLink()`
fills it on the same 250 ms debounce `markLink` already had and asks for one
more `writeLink()`. Measured time from an import to a `d=` in the address: **9
ms** on a quiet page, up to ~4 s straight after an import (the pack rides
behind a whole-page redraw), which is why the gate polls the fact instead of
sleeping.

### opening a link never merges

**Decision: a shared record OPENS AS THE SESSION, and the session it displaced
is kept and offered back by name.** Asking was refused: a link is opened by
somebody who has just been sent one and wants to hear it, and a modal taxes the
common case to protect the rare one. Keeping the displaced record protects it
better than a question does, because a question is answered wrong at speed.

* `landRecord()` in `ui/eight.js` is the whole precedence, last in the boot:
  **1** a link carrying a record (`d=`) — somebody sent this, it wins;
  **2** a link carrying only a recipe — already landed by `ATLAS.open`, and it
  displaces the session without writing one (a visit is not a session);
  **3** the session; **4** nothing, which is the blank state at a new random
  seed, exactly as before.
* The displaced record goes to `prev` in the same slot. The Export tab's record
  card grows **"bring back the last record"** — absent, not greyed, when there
  is nothing to bring back — and pressing it is an ordinary `setDocument` and
  spends the slot.
* Nothing merges by construction: `setDocument` replaces `DOC` whole and
  `push()` rebuilds every slot, box and store from it.
* Reloading your OWN page is not a displacement: `displaced()` compares the
  arriving record against the stored one and only stashes when they differ, so
  a refresh cannot spend `prev` on a copy of the present.

### import lands you in the table, and a reload keeps it

* After a file import, `showTab("Band")`. The deck's own status line survives
  the move (`expSay` writes the line that is on the page). The walkthrough's
  tenth friction was that the app *"leaves you on the Export sheet, scrolled
  past its own ×"* and the reader wrote "the restore is broken" in their notes
  and was wrong for half an hour.
* **THE SESSION HAD NO WRITER AT ALL, WHICH IS THE ACTUAL FINDING.** The
  nukernel page WRITES `nukernel.song.v1` on every edit (through `adoptSong`)
  and READS IT BACK NEVER — `readStore()` has no caller on that page — and what
  it wrote was the compiled BOXES, not the record. So the box booted on
  `silence` every time. (`nu.band.session` is the `/band` page's model, a
  different document in a different file; the memory note is out of date and
  the walkthrough already corrected it.)
* **ONE WRITER, ONE KEY.** `ui/state.js writeStore` — the page's only
  `localStorage` writer — grows two present-only fields, `doc` and `prev`,
  beside the keys it already writes. No second key and no second writer. The
  gate asserts the key list.
* `DOCNOW`/`DOCPREV` are **seeded from the slot at module load**, which is not
  an optimisation: `writeStore` rewrites the whole slot and the boot writes it
  early and unconditionally, so with both starting null the first write of
  every page load erased the session it was about to restore. Measured
  (`share.test.js` S4 read `prev: none`).
* The write is under the same `booted` switch `markLink` uses, plus `arriving`
  for the restore itself: a box nobody has touched still writes nothing, so
  Paul's *"boot up every new session with a new seed unless there's a seed in
  the URL"* survives.

**Consequence to know about**: a reload now genuinely restores the record, so a
browser gate that reloads mid-run no longer gets a virgin box. `test/atlas.js`
`fresh()` is the only helper this affects in practice and it clears the
fragment already; every other browser gate opens a fresh context.

Files: `nukernel/ui/eight.js`, `nukernel/ui/state.js`.

---

## ONE THING FIXED ON THE WAY, BECAUSE C1 MADE IT VISIBLE

**The picker's two halves could disagree about what year it is.** `syncIndex`
puts the list's read head on the record the page is playing — that is what
makes a globe tap, a link and a rewrite leave the chronology pointing at what
arrived — and it has one precondition it cannot meet on its own now that the
box boots on the TABLE: `scrollToRow` needs a box with a height, and a shut
panel is `display: none`, so the scroll is silently declined and never retried.

Measured: open the picker on a restored record and the sentence said *"1969 ·
120 records"* over a list standing at year 600. Invisible until the first
scroll resolved it in the list's favour — and a search was the thing that
resolved it, so clearing a search appeared to turn the earth.

The panel becoming visible IS the retry, and `ui/atlas.js`'s
`IntersectionObserver` is where the page already learns that. `syncIndex(true)`
there. Opening the picker now lands you on the record you are holding — 11,811
px into the chronology on a 1969 record, instead of wherever the list happened
to be.

---

## THE COPY THE OTHER HAND OWES THIS WAVE

`nukernel/src/copy/**` belongs to the hand working in the table. The atlas keys
below **have already landed there** (`atlas.ts`); the rest are still missing and
print as their own key on the page (`test/copy.browser.js` B1/B4 name them).

| key | English | note |
|---|---|---|
| `atlas.find.aria` | Find a genre by name or place | ✅ landed |
| `atlas.find.hint` | Find a genre | ✅ landed (placeholder) |
| `atlas.find.all.one` / `.other` | All {n} record / All {n} records | ✅ landed |
| `atlas.find.some` | {n} of {of} | ✅ landed |
| `atlas.find.none` | Nothing matches {q} | ✅ landed |
| `atlas.era.aria` | Jump to a century | ✅ landed (the chip group) |
| `atlas.era.chip` | {era}, from {year} | ✅ landed (one chip's name) |
| `exportTab.link.copied` | Copied {url} | **missing** |
| `exportTab.link.hand.say` | The link is selected — press Ctrl-C to copy it | **missing** (replaces a runtime-composed apology) |
| `exportTab.link.packing` | Packing the record… | **missing** |
| `exportTab.link.carries` | Carries the whole record, {kb} KB | **missing** |
| `exportTab.link.tooBig.say` | This record is too big for a link — use the JSON below | **missing** |
| `exportTab.record.back` | Bring back the last record | **missing** |
| `exportTab.record.gone.say` | That record is no longer here | **missing** |
| `exportTab.record.backSaid` | Back — {players} players, {sections} sections | **missing** |
| `row.name` | name | **missing** (the section sheet's field label, `avail.js form.name`) |

**And one REWRITE**: `exportTab.link.sub` says *"Place, year, seed and current
view"*. That is no longer true — it should say something like **"The whole
record, in a URL"**. The card beneath it now says which of the two it is
actually carrying, every time.

---

## GATES

| gate | result |
|---|---|
| `node test/document.test.js` | **41 passed, 0 failed** (37 before; G14/G14b/G14c/G14d are new) |
| `node test/table.test.js` | **40 passed, 0 failed** — T2 identity green, `BASE_SHA` untouched |
| `node test/copy.test.js` | **10 ok, 0 failed** |
| `test/atlas.js` (the where/globe gate) | **ALL PASS (121 checks)** — G24a–f new, G11 repaired |
| `test/shell.js` | **PASS — every shell assertion holds** (24 skipped) |
| `test/sheets.js` | **ALL PASS (31 checks)** |
| `test/share.test.js` (new) | **13 passed, 0 failed** |
| `test/copy.browser.js` | **4 ok, 2 failed** — B1 and B4, both only `exportTab.link.carries`, the missing key above, plus **6 offenders that are red on HEAD too** (`let it ring`, `doubling`, `looping`, `the instrument`, and the deck's key line twice; measured against a `git archive HEAD` tree) |

### FILES TOUCHED

Mine by the brief: `nukernel/ui/eight.js`, `nukernel/song.js` *(not needed —
see below)*, `nukernel/document.js`, `nukernel/fields.js`, `nukernel/avail.js`.

Taken beyond that brief, and why — none of them is the other hand's:

* **`nukernel/ui/atlas.js`** — C1 is impossible without it. The brief said "the
  globe and the index in `ui/eight.js`"; the index has lived in `ui/atlas.js`
  since 2026-08-28 (`eight.js` only mounts it). Unclaimed by the concurrent
  hand.
* **`nukernel/ui/state.js`** — the page's ONE `localStorage` writer. The
  alternative was a second key and a second writer in `eight.js`, which the
  brief forbade in the same sentence that asked for persistence.
* **`nukernel/ui/derive.js`, `nukernel/export/score.js`,
  `nukernel/export/als.js`** — C2's "use the name where the type is used".
  Three present-only additions.
* **`nukernel/nu.css`** — one appended block at the very end, marked WAVE C,
  five rules, no existing selector rewritten. *(It was swept into the other
  hand's `v292` commit while this wave was still running — that is their
  commit, not one made here; nothing in this wave touched git state.)*
* **gates**: `test/atlas.js` (G24 + G11), `test/document.test.js` (G14),
  `test/copy.browser.js` (the atlas's own names are data),
  `test/share.test.js` (new).

`nukernel/song.js` is **untouched**. It owns the BOX-tier save; a section name
is a DOCUMENT fact and `document.js normalize` is its door, so there was
nothing there to change. Saying so rather than editing it to look busy.

---

`test/atlas.js` **G11 was already RED on HEAD** — measured on a `git archive
HEAD` tree: the sheet chrome that arrived with the §10b round
(`DIV.nu-sheethead`) has no id, so the check mapped it to a bare `DIV#` and
could not name the element it was failing on. It now names an id-less child by
its class and asserts the head, and wave C's `P#atlasFind` is in the expected
order with the argument for why it may stand there (it decides nothing about
which places are on the earth — that is exactly what `sweep()`'s filter guard
guarantees).
