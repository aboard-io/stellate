# TABLE — a song is a table of vectors

Paul, 2026-09-03: *"a song can be understood as a grid with sections as rows
and instruments as columns … A good way to 'build' a song is to add and remove
columns and rows using a table building interface … Each cell can be
understood as a vector … The producer becomes basically a vector manipulator
across the table … It's a next generation futuristic gig sheet for robots."*

Status: APPROVED 2026-09-03 (Paul: "When done, build the table according to the spec") with three amendments, marked ¶A below. Replaces the Band and Structure panes with one Band
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
3. **Per-cell mix automation, relative to the row's** (¶A): desk + walk read
   row lane + cell offset; the Live export writes the sum per track once; the
   greyed field lights.
4. **Per-cell artic/oct/rate/scale/clamp** with the VERSION migration.

Each wave one agent at a time on the shared files, the parent rebuilds, gates,
commits, deploys to staging.
