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

> **SUPERSEDED IN PART, FOUR HOURS LATER — see the last section of this file.**
> Paul read the strip this section shipped and deleted two of its three
> controls: the era chips and the resting count. What is written below about
> the FIELD, and about the globe not moving while you type, is unchanged and
> still the law; the chips and the count are history now, and the argument for
> deleting them is in *THE SAME DAY, FOUR HOURS LATER*.

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

---

# THE SAME DAY, FOUR HOURS LATER · PAUL READS THE STRIP

*(2026-09-06, second shift. C1 above shipped the search strip in v294; this is
what Paul said when he opened it, verbatim, and what was done about each line.
Everything below is measured on the RENDERED page under iPhone emulation —
playwright chromium, iPhone 14, DPR 3, `isMobile`, `hasTouch`, at 390×844 and
320×844, plus 1280 — served from a local tree. Screenshots are in
`scratchpad/design/picker-strip/`.)*

> 1. *"Get rid of 'where' and the line above and the output that goes '33000 BC
>    · 1 record within ten years · Hohle Fels'; leave the close icon. Use the
>    new space to move the globe up."*
> 2. *"Get rid of the buttons for eras like 'the old Stone Age' those all go."*
> 3. *"Get rid of 'All 479 records'."*
> 4. *"When I tap the button of the bottom left showing the genre close the
>    picker and take me back to the compose view."*

Three deletions and a toggle. Two of the three deleted things had shipped four
hours earlier in the wave above, which is the honest way to read this: the
strip was three controls answering one question, and one of them was enough.

## A · THE PICKER'S HEAD IS THE GLOBE

**Deleted.** The sheet header's visible name (`Where`, `sheetName` in
`ui/eight.js`), the hairline rule under it (`.nu-sheethead`'s
`border-block-end` and the gap under that — scoped to `#atlas`, since the four
viewers behind the ≡ keep both), and the live sentence over the map
(`sentence()` in `ui/atlas.js`, `atlas.yearSay`).

**Kept.** The ×, at 44×44, at the inline end (`.nu-sheethead` is
`space-between`, and with the name hidden that put the close at the START,
x=13, under a left thumb — `flex-end` is what "its close at the end" means when
there is no name). And `#atlasHead`, index.html's own visually-hidden
`<h2>Where & when</h2>`, which is what names the panel to a screen reader now
that no word is drawn.

**Measured, before → after:**

| | 390×844 | 320×844 | 1280×844 |
|---|---|---|---|
| sheet header | y=13, **45 px tall → 44** (the rule) | same | same |
| the deleted sentence | y=71, 19 px + 13 px of gap → gone | same | same |
| **globe top** | **y=103 → y=57** | **y=103 → y=57** | **y=103 → y=57** |
| globe size | 364×298 → **unchanged** | 294×241 → **unchanged** | 1254×523 → unchanged |
| the search strip | y=414, 118 px → **y=368, 44 px** | y=357 → y=311 | y=639 → y=593 |
| **the list's top** | **y=545 → y=424** | y=488 → y=367 | y=770 → y=649 |
| the list on the first screenful (to the bar at y=794) | 249 px → **370 px** | 306 → 427 | 24 → 145 |
| the × | 44×44 at x=333 → unchanged | 44×44 at x=263 | 44×44 |
| sideways page scroll | 0 px → 0 px | 0 → 0 | 0 → 0 |

**The globe gains 46 px of top — the whole of what the three deleted things
occupied** (1 px of rule + 13 px of the header's own gap + 19 px of sentence +
13 px of the gap under it) — and it is the first thing under the top edge at
every width.

**IT DOES NOT GROW, AND THAT IS A CHOICE WITH A NUMBER BEHIND IT.** The box is
`min(width × 0.82, 62vh)` and stayed there. Growing it was the other reading of
"use the new space", and the space is not the globe's to take: the chips going
freed 74 px more, so the LIST's own top rose 121 px, from y=545 to y=424: the
catalogue on the first screenful goes from **249 px to 370 px**, which at a
51.4 px row is **four rows to seven**. The list is the only way
to reach a genre now that the chips are deleted, and a bigger earth would have
been paid for out of it. The globe's tap boxes are unchanged, so G12 and G15
are the same measurements they were.

**WHAT SAYS THE YEAR: the earth itself.** The deleted sentence carried one fact
nothing else on the surface carried — WHICH YEAR the globe is drawing, which is
what decides how many marks are on it (at 33000 BC, one). So the year is
stamped INSIDE the drawing: `#atlasYearMark`, an SVG `<text>` in the globe's own
ink at 45% (`--ink`), 15 CSS px, in the start-bottom corner of the globe's own
box — outside the sphere at the whole earth, over it when you are zoomed in,
which is why it wears the same `paint-order: stroke` halo the place names wear.
Its size, position and stroke-width are written in CSS px through the
renderer's own units-per-pixel, like every other measurement in `ui/atlas.js`.

It is `aria-hidden`, and nothing is lost by that: the year is already spoken by
every mark (`atlas.mark.aria` — "Kingston 1969, reggae"), by every index row
(`atlas.row.aria`), and declared on `#atlasMap[data-year]`, which is what the
gates read. A fourth announcement on every scroll is exactly the live region
that was just deleted.

**#atlasSay IS NOT DELETED — IT MOVED AND WENT QUIET.** It is the atlas's one
status line and it says four things nothing else says: *"Writing Kingston
1969…"*, the record that was written (`atlas.wrote` / `.wroteSeed` — the line
`test/atlas.js` G9 joins against `#reading`), *"Cannot write X yet"*, and every
refusal a share link or a role can earn. It now stands **under** the globe, is
EMPTY at rest, and an empty one has no box at all (0 px, measured) — but it is
never `display: none` and never `hidden`, because a live region removed from the
accessibility tree and put back does not announce. `stampYear()` clears it when
the year moves, which is the same "the reader is browsing again" moment the old
sentence used to overwrite it on.

*What it costs while it stands*: a written record's line is two lines at 390
(38 px + 13 px of gap) and it pushes the field and the list down by that much.
That shift is not new and is smaller than it was — the line used to sit ABOVE
the globe, so the same wrap pushed the EARTH down — and it only ever happens on
a pick, which already flies the camera and re-scrolls the list to the record it
just landed on (`syncIndex`). One re-orientation, caused by one tap.

## B · THE ERA CHIPS GO

`#atlasJump`, its 26 chips, its delegated listener, its two CSS rules and the
keys `atlas.era.aria` / `atlas.era.chip` are **deleted**. `ERAS` is no longer
imported by `ui/atlas.js` (the file's own law: an unused import is a trap).

**The field already did the job, and does it better.** The era word is one of
the six things a row is matched on — measured: `the seventies` narrows the list
to **67 rows, 1970–1979**, `1991` to 9, `bristol 1991` to 1. The chips SCROLLED
you into a chronology and told you nothing on arrival; typing an era leaves you
holding exactly that era. `scrollToYear` is untouched — `syncIndex` is still its
caller, so opening the picker still lands you on the record you are holding.

## C · THE COUNT GOES

`#atlasCount` and the keys `atlas.find.all.one` / `.other` and
`atlas.find.some` are **deleted**. `All 479 records` was a row of chrome that
said "479" for every second except the ones a hand was typing.

**The one thing kept is the empty answer.** `atlas.find.none` — *"Nothing
matches {q}"* — survives, and it is drawn WHERE THE LIST WOULD BE: `#atlasNone`,
a `role="status"` line INSIDE `#atlasIndex`, the last child of the list's own
box — a filter that matches nothing leaves no row above it, so it is the only
thing in the box and stands at its top. Measured
at 390: a search for `qqzzxx` leaves 0 rows and prints `Nothing matches qqzzxx`
19 px tall at y=433, inside the list's box whose top is y=424; on a search with
results it is empty and **0 px tall**. It names what was searched for, because a
filter that says only "nothing" leaves a person wondering whether it heard them.
Gated: `test/atlas.js` G24c, both halves.

## D · THE GENRE BUTTON CLOSES THE PICKER

`whereBtn` in `ui/eight.js` called `showTab("Where")` unconditionally: pressing
the button that had just opened the picker did nothing, and the only way back
was the × at the far corner of the glass from the thumb that opened it. It is
`showTab(openTab === "Where" ? "Band" : "Where")` now — the same door the ×
presses, so "back to the compose view" is one behaviour with two ways in.

**The two states, read off the artifact:**

| | closed | open |
|---|---|---|
| `aria-expanded` | `false` | `true` |
| `aria-controls` | `atlas` | `atlas` |
| `aria-pressed` | `false` | `true` |
| accessible name | the genre — `Silence`, `Gregorian chant` | the same |
| `data-say` | `Place and year` | the same |

`aria-expanded` is what says **what the next press will do**; the NAME stays the
record's own word, because that is Paul's other sentence about this plate
(*"The name of the genre should be obvious"*) and because `paintIcon`'s own law
is that an accessible name is a name and not a name that grew a description.
`aria-pressed` says what the button IS (the open tab) and is also what draws the
`<mark>`; both are written by `nameRecord`, the one painter of this button.

**Closing writes nothing.** It is a `showTab` and nothing else: measured, the
document is byte-identical across open → close (`test/shell.js` A6m reads
`window.__eightDoc()` on both sides, at all five widths), and the LOG — where
every edit this box makes announces itself, `logPut` being the one door — does
not gain a line across the round trip, so nothing was logged, nothing was
undoable and no slot was spent. *(The one line the log does grow on a quiet
page is `held — plays offline`, which arrives a few seconds after boot with no
gesture at all — measured, at t=7.6 s on a page nobody touched. It is the
service worker, not the picker, and chasing it is how this measurement was
made honest.)*

**THE OTHER WAYS OUT, CHECKED:** the × still lands on `Band` with the table
drawn (unchanged, and `test/shell.js` A6j drives it for all four viewers).
There IS no backdrop — the picker is a full-viewport in-flow sheet, so there is
nothing behind it to tap. **Escape does not close it, and did not before this
round**: the page's only Escape listeners shut the LOG and the die's popover
(`ui/eight.js`). Left as found rather than added on the way past — it is a real
gap and it belongs to whoever writes the sheets' keyboard round, not to a
deletion brief.

## WHAT MOVED IN THE GATES

`test/atlas.js` keeps every claim that still holds and rewrites the four that
read a deleted surface:

* **G7** — the dead-id list grows `atlasJump` and `atlasCount`. Deleted, never
  hidden.
* **G11** — the reading order is now `.nu-sheethead · #atlasHead · #atlasWrap ·
  #atlasSay · #atlasFind · #atlasIndex` (the globe moved in front of the status
  line), plus a new check that the picker's header is the × ALONE: the name is
  not drawn, there is no rule under it, the `<h2>` still names the panel and the
  close is ≥ 44×44.
* **G22** — *"the earth and the sentence are the same fact"* becomes **the earth
  and the CATALOGUE are the same fact**: the drawn marks are held against
  `NuAtlas.atYear(Y).shown.size`, asked independently in the page, which is one
  step closer to the source than a string the page printed about itself. A
  second half asserts the earth says WHICH year, in its own ink, and that the
  stamp equals `#atlasMap[data-year]`.
* **G24** — a/b/e unchanged (including **"typing never moves the earth"**, which
  is now measured against `#atlasMap[data-year]` and the stamp rather than
  against the deleted sentence — a stronger witness, and asserted at three
  points of a search instead of one). c gains the second half (the line is
  silent and 0 px when there ARE results). f is a different claim about the same
  need: the two controls are gone from the DOM, and the field reaches the
  century instead.

`test/shell.js` gains **A6m**: the plate opens the picker, the same press
closes it back to the table, the record is byte-identical, and both states'
attributes are read off the button.

**Gate results, this shift:**

| gate | result |
|---|---|
| `test/atlas.js` | **ALL PASS (127 checks)** — 121 before; G7/G11/G22/G24 rewritten, three checks added |
| `test/shell.js` | **PASS — every shell assertion holds** (380 ok, 24 skipped), A6m new at all five widths |
| `test/sheets.js` | **ALL PASS (31 checks)** |
| `node test/table.test.js` | **40 passed, 0 failed** — T2 identity green, `BASE_SHA` untouched |
| `node test/copy.test.js` | **10 ok, 0 failed** (1058 keys, six deleted) |
| `node tools/ui/build.js --check` | **ui-build ok 5 entries** · `npx tsc --noEmit` clean |

### FILES TOUCHED

`nukernel/ui/atlas.js` (the picker), `nukernel/ui/eight.js` (the sheet header
and the bar's genre plate), `nukernel/nu.css`, `nukernel/src/copy/atlas.ts`
(→ `nukernel/ui/copy.js`, generated), `nukernel/DESIGN.md` §2 items 12 and 13,
one stale sentence in `nukernel/TABLE.md` §15a naming `#atlasJump`, and the two
gates. `nukernel/genres/*.json` and `genres.js` untouched, as the brief said.
