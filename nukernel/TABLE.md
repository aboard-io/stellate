# TABLE — a song is a table of vectors

Paul, 2026-09-03: *"a song can be understood as a grid with sections as rows
and instruments as columns … A good way to 'build' a song is to add and remove
columns and rows using a table building interface … Each cell can be
understood as a vector … The producer becomes basically a vector manipulator
across the table … It's a next generation futuristic gig sheet for robots."*

Status: APPROVED 2026-09-03 (Paul: "When done, build the table according to the spec") with three amendments, marked ¶A below. Waves 1, 2a, 2b and 2c SHIPPED (2026-09-04); the Band tab is the table and Band and Structure are deleted. Replaces the Band and Structure panes with one Band
table. Rules stays. Tempo and Key fold into one Time structure. Motif becomes
Motifs and stays. Pace leaves Time and joins the section vector. Nothing else
moves. This document is the contract the waves are built and gated against;
COMPOSER.md §2 remains the law for everything it does not contradict.

## 1 · What the box already stores, and where each fact belongs

Measured against `song.js emptyBox`, `precompose.js genreToDocument` and
`document.js`, a saved record already holds every fact below. The work is not
inventing fields; it is putting each one in the tier where a hand meets it.

### SECTION (a row)

| field | today | note |
|---|---|---|
| type | `role` | intro · verse · chorus · bridge · solo · drums · groove · outro |
| bars | `len` | |
| level | `lvl` | hush · back · norm · fwd |
| shape | `env` | in · soft · cresc · lift · arch · big · dim · out … |
| intro / outro | `intro` `outro` | the way the section arrives and leaves |
| mot | `mot` | the motion (pump · open · close · rise …), compiles to automation |
| period | `period` | 2bar · 4bar · an operator list |
| breath | `breath` | |
| pipe | `pipe` | |
| **pace** | `paces` (per box, dealt by compose.js dealPaces) | MOVES here from Time, Paul 2026-09-03 |
| key / mode / prog | `key` `mode` `prog` `cmode` | the section's harmony; a bridge modulates, so key is a row override of Time's key |
| swing / groove | `swing` `groove` | |
| bassop | `bassop` | walk · eighths · octaves · pedal · nobass |
| fx / rev / verb / echo / dtime | the section's chain and room | |
| pan | `pan` | |
| nudge | `nudge` | |
| auto | `auto[]` | the compiled lanes — READ-ONLY on the row; written by mot and by cells (§4) |

`stack` and `slots` are not fields of the row. They are what the row's cells
point at (§3).

### VOICE (a column)

| field | today | note |
|---|---|---|
| part | `cast.part` | riff · lead · counter · pad · stab · drone · line |
| instrument | `instrument` (+ signature `synth` / the sampler id / `found:` id) | and its parameters through the chair's sheet (knobs.js) |
| kit | `drumkit` + the kit grid | the drums column; kit params through the same sheet |
| seat | `desk` (PARTMIX) | where it sits in the mix: level, pan, sends, the three inserts |
| register | `cast.reg` | the column DEFAULT; a cell may override (§2) |
| enters at bar | `cast.entry` | the column DEFAULT; measured 2026-09-03: entry is applied PER SECTION (precompose ~3048), so the honest home is the cell with the column as its default |
| reads / does | `material` `development` | the column DEFAULTS for every cell in it |

### CELL (a section × a voice)

| field | today | note |
|---|---|---|
| motifs | `stack[].slots` via `cellAt(voice, si)` | which motif(s) this voice plays here — an ARRAY: a drums cell holds a lane set, a pitched cell usually one |
| reads | `material.cell` (voice × section) | an ARRAY where the vocabulary allows a list |
| does | `development` (voice × section) | an ARRAY: for drums the 68 KITOPS are "things a drummer does" and a cell may do several; for pitched voices a `word` is already an operator list |
| enters at bar | override of the column default | |
| register | override of the column default | |
| artic / oct / rate / scale / clamp | today per box, applied to every voice | become per cell with the row as default |
| focus | `focus` (today a section index) | a cell flag: this section features this voice |
| mix automation | NEW | a level / pan / send / cutoff lane for this voice in this section, RELATIVE to the section's own lane (§4, ¶A) |
| provenance | NEW | of each motif: own genre · a named guest genre · hand (§3) |

### RECORD (the table itself)

Time (bpm, the tempo map, the record's key and meter; pace left), the seed,
the basis genre, Rules, the master (drive · glue · tape · space · width ·
tilt · ceiling), the Motifs bank. The master is drawn as the table's footer
row; Rules and Time keep their own panes.

### 1a · Measured tiers (wave 1, 2026-09-04) — the spec corrected by the tree

`document.js TIERS` is the table as data, and `test/table.test.js` T1 prints
every field's tier and note. Where §1 guessed and the tree disagreed:

- **`focus` is not a section index.** `box.focus` indexes the section's stack,
  every document box has a one-entry stack, and `focusOf`/`focused` have no
  importer in the tree. It is stored and resolved as a cell flag that reaches
  nothing; T2e pins that it moves no event, so the day a reader lands the gate
  names it.
- **`swing`, `groove`, `key`, `mode`, `prog` were RECORD fields; the row
  overrides them now (wave 2a, 2026-09-04).** The document still stores one of
  each on the record and `document.js` resolves `row → record` through the
  wave-1 resolver, so absent on a row is the record's, byte for byte. The
  modulations precompose was dropping are carried: at seed 1 compose gives
  every bridge it writes a MODE of its own (398 sections on 398 records), moves
  the KEY on 275 sections of 228 records (the relative-minor bridge and the
  truck-driver last chorus) and names a PROG on 12. `swing` and `groove` the
  composer deals none of per section, so they are override-only. `toGenre` is
  the one owner of all five — `boxesOf` writes key/mode/prog onto no box,
  because `ui/derive.js genreOf` reads them off one and would apply the same
  modulation twice — while swing and groove DO ride on the box, because
  derive takes the song's own as arguments and would stomp the row's.
- **`bassop` and `kit` are COLUMN fields** — read off the bass's and the
  drummer's `development` word, not off the section.
- **`fx`, `rev`, `echo`, `dtime`, `pan` and the room have an address now
  (wave 2a).** They had none: `emptyBox` defaulted them and `boxesOf` wrote
  none, while compose was dealing an fx CHAIN on 1,441 of 4,859 sections (272
  records), a reverb send on 1,835 (479 records) and an echo send on 552 (331
  records) — all thrown away by the same projection that threw away `lvl` and
  `env`. All three are carried; `dtime` and `pan` are addresses a hand fills.
  §1's `verb` is NOT one of them: that box field was retired 2026-08-28 and
  its live successor is `room`, the kit-ambience send, so the row that carries
  an address is `room` and giving `verb` one as well would be two names for
  one send. `auto` stays READ-ONLY on the row (compiled from `mot`) and is
  wave 3's. `breath`, `pipe`, `nudge` are still addresses with no writer, and
  are reachable through the resolver now.
- **`intro`, `outro`, `mot` were dealt and then DROPPED; wave 2a carries
  them.** Over 4,859 composed sections at seed 1 compose deals `outro` on
  1,718, `mot` on 1,042 and `intro` on 580, and `genreToDocument`'s projection
  copied none — the box's characteristic bug, live. Carried 2026-09-04 as
  wave 2a's first, separately gated step: the document now holds 579 intros,
  1,714 outros and 1,038 mots, **478 of 479 anchors render different bars**
  (19,790 events removed and 108 added at seed 1 — an intro and an outro
  REPLACE the first and last bars of their section), and 501 of the 1,038 mot
  sections move a rendered desk lane. The other 537 are `rise`, which compiles
  to a HIGHPASS sweep the parent's master stage has no floor for — audio/desk.js
  names that gap itself ("rendered by nothing") and it is the parent's, not
  this wave's.

- **The gate for a sound-moving wave cannot be `document.scoreOf`.** It is
  "deliberately the SMALL half" and has zero references to `intro`, `outro` or
  `mot`, so it is structurally blind to the carry. T4 stands the data tier up
  on a stub window and imports the real `ui/derive.js`, `audio/desk.js` and
  `audio/plan.js` — the desk-gate recipe — and reads the rendered bars, the
  compiled lanes, the composed channel and the paced clock. T2's baseline
  moved from v263 to v264 in the same edit, and the identity gates compare
  with this wave's row fields stripped back off: an unintended change is still
  caught against v264 for everything the wave does not deliberately carry.
- **The hand is derived, not stamped.** `putPhrase` is called once per voice
  per section on every recompile, so a stamp there would mark every motif
  the hand's on first draw. `hand` = a cell absent from the provenance map or
  whose fingerprint moved. `handWrote()` is the explicit door for wave 2.
- **The undated role rows are vocal, backing, simple, pad, riff, solo.**
  `drone` (New York 1964) and `counterpoint` (Vienna 1725) are dated genres
  and are the two commonest guests. Guest census at seed 1: 17 of 4,344
  motifs on 17 of 479 records, all on the `counter` kind.

### 1b · What wave 2b measured, and where §6 was wrong

The table shipped 2026-09-04 (`nukernel/ui/table.js`, drawn with
`ui/wordgrid.js`'s accordion grown a SHEET body and a FOOTER). Five things the
spec did not know, each found by driving the rendered page:

- **A register is −4..3, not semitones.** `document.js normalize` is the one
  owner of the range and the first draft of the cell sheet offered −24…24 —
  every chip outside the range was written and silently PRUNED on the next
  recompile, so the cell tier read back empty. A control that writes and does
  not arrive, drawn by the wave that is supposed to gate against it.
- **A sheet field has a WORD and a VALUE and both have to travel.** The word is
  what the row prints (the inherited one, quiet); the value is what the record
  stores and what the strip presses. The first draft carried only the word, so
  every strip pressed the absent chip.
- **`.nu-sheet` was taken.** ui/selects.js's multi-choice fieldset has worn it
  since the sheets shipped; the table's is `.nu-vsheet` (the VECTOR sheet), and
  test/selects.js found the collision within the hour.
- **Four vocabularies stay MENUS.** `cast.part`, `sound.instrument`,
  `sound.bassinstrument` and `sound.drumkit` are on test/selects.js's own
  `MENUS` list (Paul, 2026-09-02) and an instrument list is 108 words, which is
  a page and not a strip. `ui/table.js COMBOKEYS` names them; anything over
  twenty-four words joins them by measurement. Everything shorter is chips.
- **§6's "the board owns a seat" was wrong.** The board has bus strips and the
  automation grid and NO per-voice channel — Paul took the voices off it on
  2026-08-28 — so the fader, the pan, the three sends and the three insert
  slots had exactly one home, the Band pane's `mix` facet. `voiceMix` is drawn
  in the column's own sheet. test/sheets.js counted zero insert seats on the
  whole page and said so.

And two gaps NAMED rather than fixed, because both predate the table and are
the same for the controls the two old panes shipped:

- **`ui/derive.js` is blind to a register.** Neither a cell's `reg` nor the
  COLUMN's own `cast.reg` moves `__eightEvents` by one byte; `sectionRender`
  renders a slot against a box and the register is not in that path at either
  tier. `document.scoreOf` answers for it, and that is what T6 reads.
- **Two motifs can render the identical bar.** On Kingston 1969 at reading 1,
  `hook` and `answer` come out the same once the section's own development word
  has been applied — so T6 walks the vocabulary and asks whether SOME word
  moves the render, which is the honest form of "this control can reach the
  sound".

## 2 · The inherit law

A cell's vector starts EMPTY. Every field resolves in this order and the first
value found wins:

    cell → column (the voice) → row (the section) → record → the genre's row

A cell stores only what a hand wrote there. The table draws only deviations:
an inherited value is drawn quiet, a written one is drawn bold, and deleting a
written value returns the cell to what it inherits. Ten sections by eight
voices is eighty cells and almost all of them say nothing; that is the point.

Which tier a field defaults from is fixed by §1 (a register defaults from the
column, a level from the row). A field with no default anywhere is drawn as the
genre's word for it, which is what plays today.

This law is about the table. It has nothing to do with genre parents: a row's
`parents` are shares for the fit tool and the QA report (GENRES.md §2) and
composition never reads them. Nothing arrives in a cell from an ancestor.

## 3 · Motifs, and where they came from

The Motifs bank is the record's material: the phrases compose dealt for the
basis genre, the phrases of any layer it hired, and anything a hand wrote or
cleared. A cell POINTS at motifs; it does not own them, so one motif read by
three voices is one motif.

Every motif carries its PROVENANCE, drawn wherever the motif is drawn:

- **own** — dealt for the record's basis genre;
- **guest: `<genre>`** — dealt from another row. Measured 2026-09-03 at seed 1
  over eight records: every record's stack hires the box's six role rows
  (vocal, backing, solo, pad, drone, counterpoint) — those are the record's
  own band and are drawn as members, provenance "own"; a guest from a genre
  proper is rare (boombap ← acid was the one in eight) and today is NOT
  labelled anywhere, which is the gap this field closes. Compose hires guests
  by family lean and era (a guest may not postdate the host — compose.js
  eraOK), never by parents;
- **hand** — written or edited on the bench; a hand's edit of a dealt motif
  makes it the hand's.

Provenance is a label, never a lock: any cell may point at any motif, any
motif may be edited, cleared, copied or moved. The era law binds the
composer's own hiring only; a hand overriding it is recorded, not refused.

## 4 · What the engine cannot yet do, said before the UI promises it

¶A (Paul, 2026-09-03): *"we still want per-section mix automation, with
per-cell relative to that."* So the section keeps its lanes (`mot` → `auto[]`,
the row's own automation, editable on the row) and a cell's lane is an OFFSET
on top of the row's: a cell that says nothing rides the section's curve
exactly; a cell that says +3 dB rides it 3 dB up. Resolution: cell offset +
row lane + the seat's static level. Neither the Live export nor the desk may
apply a curve twice (the P3 double-count law).

Per-cell MIX AUTOMATION. Today automation is per section (`auto[]`, compiled
from `mot`) and the desk's shade is per seat per section (desk.js shade). A
level / pan / send / cutoff lane per voice per section is new. The shape
exists at the far end — the Live export already writes per-track envelopes
from the section lanes (export/live-devices.js) — so the work is the desk
reading a cell lane and the walk applying it at the bar line. This is wave 3
and the table draws the field greyed with its reason until then (the refused
control law: no silent grey).

Per-cell artic / oct / rate / scale / clamp are per box today. Moving them to
the cell is a document change with a migration (song.js VERSION bump — and
G13's law: every past version must migrate and validate).

## 5 · The op grammar (the producer as a vector manipulator)

Rows: add (a section of a type, dealt by compose from the record's own
rules), move, duplicate, delete, repeat ×N, deal-again (re-deal this row's
cells from the genre with the seed). Columns: add a voice (build-the-band's
own offers), remove, reorder, swap instrument, "make X Y" (the composer
program's transform, now a column op), deal-again. Cells: point at a motif,
set any field, clear back to inherit, copy a cell to its row or its column.
Table: fill from a genre (the current "start a record"), re-seed, transpose
the view (voices as rows on a phone).

Every op is one document write through the existing doors (`putPhrase` /
`commit` / `push`) and lands at the next bar while playing (the wave-4 law;
Rules learned it 2026-09-03 through `CTX.evolve`). No op adds a second write
path.

## 6 · The UX

¶A (Paul, 2026-09-03): *"mobile editing is truly critical."* The phone is the
first layout, not the fallback: every op in §5 and every field of §1 is
reachable by tap at 320px with 44px targets, the shell gate's laws hold, and
the desktop is the phone's layout given room. A control that only works with a
pointer is a refused control.

¶A (Paul, 2026-09-03): *"get rid of everything it replaces. Move things around
as needed. Don't lose unreplaced options. Find places for things and keep
discoverability high."* Band and Structure are DELETED, not hidden. Before
wave 2 lands, an inventory (test T7) lists every control the two panes offer
today and names where each one lives in the table — a row field, a column
field, a cell field, a row/column op, the footer, or Rules/Time/Motifs — and
the gate fails on any control with no home. Nothing survives as a dead menu.

Tap-first. The table is the pane; a cell is a 44px tap target that opens ITS
VECTOR AS A SHEET: one cell-row per field in §1's order, each value tapped
through its vocabulary (the board's sticky-sheet language; NUKERNEL design
language memory), inherited values quiet, written values bold, a clear-back
on every written row. No drag anywhere except the row reorder handle.

Motif previews: the sheet's motifs row draws each candidate motif with its
preview (ui/preview.js) and its provenance; tapping a preview points the cell
at it and it lands at the next bar.

Drums: the does-array sheet groups the 68 ops by what they act on — kick,
snare, hats, toms and fills, dynamics, feel — one group open at a time, the
active ops pinned at the top. The same grouping applies to the kit lanes (the
full lane names, 2026-09-03).

Phone: sections as rows, voices as columns, the column strip swipeable; or
the transpose. Header row = the voices' names and instruments; header column
= the sections' types and bars; footer row = the master. The stripe keeps its
one-column law and the nav tree gains the table's rows and columns as
children (indented and coloured by level, 2026-09-03).

## 7 · Gates (the contract)

- **T1 shape**: a saved record round-trips through the table model and back
  byte-identically; every field of §1 is reachable from exactly one tier.
- **T2 inherit**: for every cell of every anchor at seeds 1–3, the resolved
  vector equals what the record plays today (`document.toGenre` per section
  per voice) — the table changes nothing until a hand does.
- **T3 provenance**: every motif in every bank carries one of the three
  provenances; a guest's genre exists and is not younger than the host.
- **T4 ops**: each op in §5 is one document write, lands at the next bar
  while playing (transport untouched, seed kept, bar counter monotone), and
  changes only the fields it owns (diff the document).
- **T5 the artifact**: the rendered table at 320/375/430/820/1280 — no
  sideways scroll, 44px targets, inherited-vs-written drawn distinctly, a
  tapped cell's sheet lists §1's fields in order, drums grouped.
- **T7 nothing lost**: the inventory of every Band and Structure control at
  HEAD before wave 2, each mapped to its home in the table; the gate reads
  the rendered page and finds each one reachable by tap at 320px.
- **T6 the sound**: a cell edit reaches the mix (the declared-but-never-
  arriving law): change a cell's motif, register and level and read each off
  the rendered output.

## 8 · Waves

1. **The model**: provenance on motifs; entry/register/focus as cell fields
   with column defaults; the resolver of §2; T1–T3 green; no UI change.
2. **The table**: the Band table replaces Band and Structure; row/column/cell
   ops of §5 through the existing doors; the cell sheet; motif previews;
   drums grouping; pace on the row; Time = tempo + key; T4–T6 green.
   **2a SHIPPED** (the carry + the row's own fields). **2b SHIPPED
   2026-09-04**: the PANE — `ui/table.js`, the three sheets, the footer, the
   op grammar, the inventory (`test/table-inventory.json`, 76 controls) and
   T4/T5/T6/T7 green on the rendered page (`test/table.browser.js`, 54 checks).
   **2c SHIPPED 2026-09-04**: the DELETION. `bandBlock` (439 lines),
   `rosterBlock` (85), `motifTray` (135), `structurePanel` (34),
   `structureGrids` (159), `sectionDetail` (181), `formTable` + `secNumber` +
   `barsCell` + `bassReadsWhy` (314 together), `performanceTab` (51),
   `soloButton`/`paintSolos` (106), `readsOf` (15), `GRIDDED`/`restKeys` (45)
   and the pace strip (63) are gone — 1,627 lines out of ui/eight.js, plus 89
   of nu.css. Two of the four page states went with them (`voiceFacet` and
   `bandCrate`, and `SONGTABS`, `FORMGLYPH`, `PERFGLYPH`, `FACETS`,
   `settledFacet` with them); `tab` and `formSec` STAY, because they are which
   player and which section is open and the table opens that sheet on arrival
   (`openVoice`/`openSection` are one door each and write the other's fact to
   null). `crateBlock` stays and changes address: the samples crate is an
   unreplaced option and it is a row of the COLUMN SHEET now, under the
   instrument it swaps, drawn only where the chair has files.
   With it: Tempo + Key -> `Time` (one panel, `timeAxis` then `alphaAxis`;
   `#pan-key` deleted), `Motif` -> `Motifs`, `Structure` deleted as a tab, and
   the tray's Band branch is the table's two lists — the voices (its columns)
   then the sections (its rows), each with its ops as children.
   THREE CONTROLS WERE RESTORED RATHER THAN LOST, and each is a hole the
   inventory could not see because the probe walked one record: the chair's
   own KNOBS (`knobsBlock`, VOICE.md's throat editor — Kingston 1969 seats no
   modelled voice, so the probe never drew one), the drummer's ON/OFF
   (`cast.on`, a bare checkbox with no address family to roll up, which
   avail.js `voice.on` greys all sixty-eight kit words from), and the bass's
   REFUSAL (the Structure grid drew its `reads` cell refused with the
   measurement; the cell sheet was offering it as a live control that moves
   nothing). A fourth is new: `trow-here|<section>`, "put the ear here", which
   the grids' row heads carried and a sheet door could not.
   `test/band.browser.js` and `test/structure.browser.js` are deleted with
   their subjects; what neither T4 nor T6 already said is folded into
   `test/table.browser.js` as T8a–T8g (say which: hiring lands on the new
   player's column sheet; the bass's instrument is askable and the engine
   answers; a `does` word moves the rendered events; `form.pace` has exactly
   one control page-wide and it is the row's; the column heads are the band in
   the record's order with slot and lamp; the bass is told rather than asked;
   a row still puts the ear on its section).
3. **Per-cell mix automation, relative to the row's** (¶A): desk + walk read
   row lane + cell offset; the Live export writes the sum per track once; the
   greyed field lights.
4. **Per-cell artic/oct/rate/scale/clamp** with the VERSION migration.

Each wave one agent at a time on the shared files, the parent rebuilds, gates,
commits, deploys to staging.
