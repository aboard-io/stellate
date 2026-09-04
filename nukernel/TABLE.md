# TABLE — a song is a table of vectors

Paul, 2026-09-03: *"a song can be understood as a grid with sections as rows
and instruments as columns … A good way to 'build' a song is to add and remove
columns and rows using a table building interface … Each cell can be
understood as a vector … The producer becomes basically a vector manipulator
across the table … It's a next generation futuristic gig sheet for robots."*

Status: APPROVED 2026-09-03 (Paul: "When done, build the table according to the spec") with three amendments, marked ¶A below. ALL FOUR WAVES SHIPPED (2026-09-04); the Band tab is the table and Band and Structure are deleted. Replaces the Band and Structure panes with one Band
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
| sings as | `cast.voice` | ADDED 2026-09-04: whose throat sings this chair — one of the five `fields.js THROATS` publishes. A COLUMN field and no cell tier (a singer does not change throat in the bridge; the register is what moves). Absent means the row's `tone.mouth`, which is every record before that date; a genre states its chairs' throats as a `throat` closure by chair index (GENRES.md §3) and precompose spends it onto the chair. Drawn on chairs a person sings and absent everywhere else. |
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
| artic / oct / rate / scale / clamp | `voices[v].cells[sec].{artic,oct,rate,scale,clamp}` (wave 4) | per cell with the ROW as the default; `document.js toGenre` is their one owner and `boxesOf` writes none of them (§1d) |
| focus | `focus` (today a section index) | a cell flag: this section features this voice |
| mix automation | `cells[secId].mixauto` (wave 3) | a level / pan / send / cutoff OFFSET for this voice in this section, RELATIVE to the section's own lane (§4, ¶A). Words in `fields.js CELLAUTO`; a cell-only field with no column and no row default, because an offset whose absent state was anything but zero would be a second curve |
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

- ~~**`ui/derive.js` is blind to a register.**~~ **CORRECTED 2026-09-05, and
  the correction is the more useful measurement.** This said neither a cell's
  `reg` nor the COLUMN's own `cast.reg` moved `__eightEvents` by one byte. What
  was blind was the PROBE: `window.__eightEvents` carried an event's time, its
  level and a hit's lane and NOT its PITCH until wave 4 added `n` and `dur`, so
  a control whose whole job is to move a note by an octave could not appear in
  it. Re-asked with the fixed probe, on the page and in node against the real
  `ui/derive.js`: on Kingston 1969 / reading 1 / section 3, the stab's rendered
  pitches move 62 → 38 for a COLUMN `cast.reg` of −2 (two octaves, exactly),
  and a CELL `reg` of −2 on that one section moves the same stream by the same
  24 semitones while every other section stands. The path was never missing —
  `toGenre` hands `boxesOf` a `reg(v)` closure that IS §2's resolver,
  `sectionRender` renders against that box, and `kernel.js` computes
  `ctr = 60 + 12 * g.reg(v)`. Nothing was fixed; T6 now reads `__eightEvents`
  at both tiers and the `check(true, …)` that narrated the gap is gone. THE
  LESSON IS THE REPO'S OLDEST, from the other end: a gate reading the wrong
  object reports a working control as a defect, and the defect then gets
  written into the spec.
- **Two motifs can render the identical bar.** On Kingston 1969 at reading 1,
  `hook` and `answer` come out the same once the section's own development word
  has been applied — so T6 walks the vocabulary and asks whether SOME word
  moves the render, which is the honest form of "this control can reach the
  sound".

### 1c · What wave 3 measured, and the one bug it wrote and caught

Per-cell mix automation shipped 2026-09-04. Four things worth writing down:

- **The vocabulary is four lane kinds, not a curve** (`fields.js CELLAUTO`):
  level `−6/−3/0/+3/+6` dB, pan `l/c/r` at PANS' half positions, send
  `less/same/more` at half a step of SENDS on bus 1, cutoff
  `darker/same/brighter`. The neutral word of each resolves to 0, which IS
  absent, so `cellAutoClean` drops it and the strip does not draw a chip for
  it — §1b's register bug (a chip that writes and is silently pruned) written
  down in advance rather than shipped twice.
- **A cell's `cutoff` is a HIGH SHELF and the row's is a master sweep.** They
  are two stages, so there is nothing to sum and nothing to double. The row's
  lane writes one fx_bus `mcut` for the whole box (`audio/desk.js deskSweeps`
  says why a global parameter must be answered by every box); there is no
  per-voice cutoff at that stage to offset. The board's hi shelf IS per voice,
  is measured to reach modelled and sampled chairs alike (BOARD_EQ at 7200 Hz,
  desk-gate G8), and moves in BOTH directions — which a lowpass laid on a unit
  that has none does not. "Brighter" that brightened nothing would have been
  the declared-but-never-arriving bug drawn on purpose.
- **THERE IS ONE DESK SITE AND IT IS NOT `laneAt`.** `laneAt` evaluates a lane
  at a beat and holds no unit and no channel; the place the walk reads a lane
  FOR A UNIT is `deskUnits`' own loop, where the board's mix-offset layer
  already lands. So a cell's offset is appended to THAT list (last: most
  specific) and rides the five wires — `v.lvl`, the modelled-voice route trim,
  the `pan` sum, `v.rev`, `eqAll` — that three earlier rounds each measured
  separately as reaching a modelled chair as well as a sampled one. Measured
  on acid seed 1: `+6/r/more/darker` on one cell moves that unit +6.00 dB, pan
  +0.35, rev 0.550 → 0.730 before the route trim, hi shelf −2 → −5, and moves
  no other unit in that section and no unit of any other section.
- **The export applied the offset TWICE, and the wave's own gate caught it.**
  `als.js ride()` takes a `hold` (what a box that draws no lane takes) and a
  `map` (what a drawn lane's values become) — and `stitchEnvelope` puts the
  hold THROUGH the map, so the first cut of the pan/send lines, which added
  the offset to both, moved a +0.35 cell by +0.70 on exactly the boxes that
  automate nothing. ¶A's "no curve applied twice", broken by the wave that was
  writing the law down, and caught within the hour by als-gate X reading the
  finished XML. The offset lives in the `map` alone, which is where the volume
  ride has always put its multiplier.

The one lane kind that does not travel to Live is `cutoff`: a track's EQ there
is the static strip and the donor carries no per-band automation target, so it
is NAMED in the run's own notes rather than faked — the `rise` sweep's
precedent settled in the other direction.

And one thing the GATE got wrong before the code did, worth the line because
it is the same lesson from the other end: T6e's first cut sampled the engine's
unit table at ONE bar, computed from the boxes' own `len`, and read the offset
as dead — the page had not recompiled its bar list yet, so bar 8 was still the
old arrangement's bar 8. A gate that arithmetically decides which bar belongs
to which section is holding a second opinion about the compile. It walks every
bar now and asserts the SHAPE the artifact can answer: some bars move, by the
dB the chip says, on exactly one unit, and the rest of the record does not
move at all (measured: 24 of 200, one unit, +6.00 dB).

### 1d · What wave 4 measured, and the migration that was not needed

Per-cell `artic` / `oct` / `rate` / `scale` / `clamp` shipped 2026-09-04. Eight
things worth writing down:

- **THE SAVE DID NOT MOVE, AND THAT IS A MEASUREMENT.** §4 said this wave was
  "a document change with a migration (song.js VERSION bump)". It is not, and
  the reason is that §4 was reasoning about the BOX. Measured before the wave:
  `song.js skeleton` already seeds a key for all five on every box (it walks
  `fields.js FIELDS`, which carries a chip of each name), `validateSong`
  already checks all five against those tables, and `boxesOf` writes NOT ONE of
  them. So there was no shape to move: the row's and the cell's answers reach
  the sound through the per-section GENRE (`toGenre`), which is where wave 1
  put `entry` and `reg` for the same reason and with the same "no VERSION bump"
  note. VERSION stays 3; `test/document.test.js` G13 is green unchanged, which
  is the honest form of the promise — a bump nobody needed would have made
  every v:3 save unreadable to buy nothing.
- **AND THE BOX STILL CARRIES NONE OF THEM, ON PURPOSE.** `ui/derive.js
  genreOf` reads `sec.artic`, `sec.scale`, `sec.clamp`, `sec.oct` and
  `sec.rate` off a box; writing the row's resolved word there as well as onto
  the section genre would apply it TWICE — ¶A's "no curve applied twice", in
  the one shape it can take for a pitch and a duration. This is exactly the
  ruling wave 2a made for `key`/`mode`/`prog`. The palette's own box chips are
  untouched and reach the DAW's boxes as they always did.
- **A CELL'S `rate` IS A DENSITY, BECAUSE A CHAIR CANNOT MOVE THE BAR LINE.**
  At the record and the row a `rate` word is a CLOCK: it changes how long the
  box lasts and every player changes with it. One chair cannot change how long
  the box lasts — a band that disagreed about the bar line would not be a band
  — so at the cell the same multiplier lands on that chair's own READ.
  `dbl` compresses each of its bars into half the bar and plays it twice
  (bar-local on purpose, so both copies sound against the chord the bar
  actually has and the doubling cannot walk the harmony forward); `half`
  stretches the whole line by two and cuts whatever runs past the last bar.
  Measured on acid seed 1, one cell: 64 notes → 128, each half as long, the
  same 58.88 steps of total sounding length, in that section on that chair
  alone.
- **`clamp` REACHES NOTHING ON THE DOCUMENT PATH, and it is drawn as a
  sentence.** `document.js toPhrase` returns `inc: z(n), stk: z(n)` for every
  motif in every bank, so `kernel.js rampOf`'s raw ramp is zero and a limit has
  nothing to limit — 0 of the 6 phrases on acid seed 1 carry a ramp, and none
  can, by construction. It is a live control on the BOX path (the tracker's own
  ramp columns), which is why the field exists at all. So the cell sheet draws
  four strips and one MEASUREMENT, `focus`'s treatment and the bass's: the
  address is stored and resolved, T4m asserts the zero, and the day a ramp
  column lands in the hook editor that assertion fails and the gate names it.
- **THE FIRST CUT OF `oct` ADDED THE CELL TO THE ROW, AND T4n CAUGHT IT.**
  `chairShape` computed `12 * (rowOct + cellOct)`, so a chair told −1 in a
  section the row had put up an octave came back to where it started — a cell
  that "outranks" by cancelling. §2 says the first value found WINS, so the
  cell REPLACES the row's answer for that chair (`12 * (cell ?? row)`) and the
  chairs that said nothing keep the row's. Wave 3's own gate caught the
  double-applied pan the same way; this is the same law from the other side,
  and it is why T4n asserts −12 rather than merely "it moved".
- **A CHAIR THAT VOICES THE BAR'S CHORD READS NEITHER AN ARTICULATION NOR AN
  ALPHABET, and the sheet says so on that chair.** `kernel.js render` sends a
  `pad`, and any part whose PARTS row sets `chordLock` (today `stab` and
  nothing else), down the chord branch — which `continue`s BEFORE the
  articulation is read and builds its pitches out of the chord's own tones
  rather than out of the subject alphabet. Measured on reggae seed 1, section
  3: the `stab` has 201 rendered notes and answers an octave and a rate and
  answers NEITHER of the other two, while a `lead` on the same record answers
  all four. So those two rows are SENTENCES on those two chairs and strips
  everywhere else, and the octave and the time stay live for everybody because
  both are applied to the finished stream. (The related fact, which is why the
  gate walks the vocabulary instead of naming a word: a note carrying a written
  `hold` is exempt from the articulation's gap by design — "a written length is
  the whole length" — so `staccato` is inert on a sparse phrase where `tie` is
  not.)
- **THE PAGE'S OWN EVENT PROBE COULD NOT SEE A PITCH OR A LENGTH.**
  `window.__eightEvents` carried `{t, vel, kind, lv, d}` — the TIME of every
  event and its LEVEL and not its NOTE or its DURATION — so the browser gate
  read `artic`, `oct` and `scale` as dead on controls `test/table.test.js` T4m
  had already measured moving, in node, through the same `ui/derive.js` call.
  Three red checks over four working controls, and the gate was reading the
  wrong object, which is the oldest lesson in this repo. `n` and `dur` ride
  along now, on the `d` precedent (added 2026-09-03 so the drum editor's gate
  could ask which drum sounded) and for the same reason. **This also puts §1b's
  "ui/derive.js is blind to a register" back in question**: that finding was
  taken with this probe, and a register moves a PITCH — it is not re-measured
  by this wave, and it should be.
- **`scoreOf` WAS PLACING SECTIONS BY BAR COUNT, WHICH ONLY A ROW `rate` COULD
  EXPOSE.** It read `t0 = bar * barSteps` with THIS section's bar length —
  exact for as long as every section counts its bar the same way, which was
  true while `rate` was the record's alone. It accumulates the time each
  section actually takes now; identical to the bit on a record whose rows say
  nothing, and right on one whose rows do not.

The reach, measured on acid seed 1 with one cell written (T4m, on the
`ui/derive.js` path the ear is on — all four also reach `scoreOf`, because
four of the five are read inside `kernel.js render`):

| field | word | what moved |
|---|---|---|
| artic | staccato | 64 notes, 58.88 → 32.00 steps of sound |
| oct | +1 | every one of 64 notes exactly +12 semitones |
| rate | dbl | 64 → 128 notes, each half as long, the same 58.88 steps of sound |
| scale | whole tone | pitch classes {1 6 9} → {0 2 6 8 10} |
| clamp | off | nothing, and the gate says so |

In every case: that chair, that section, no other cell of the record, one key
in the document diff, and clearing restores the rendered bars byte for byte.

Two things this wave DID NOT do, named rather than left to be discovered:

- **The ROW has the address and the resolver and no control yet.** `putRow`
  writes all five, `toGenre` reads them, and T4n gates that a row word reaches
  every chair of its section and no other section — but `avail.js ROWFACTS`
  (the eleven `form.*` sheets wave 2b minted) does not name them, so the row
  sheet draws no strip. It is five lines there when somebody wants it; the
  reason it is not in this wave is that the five sheets are counted by
  `test/selects.js` and this wave's claim is about the CELL.
- **They are the pitched chairs' alone.** All five are read inside `kernel.js
  render`, which is what a LINE plays; the kit is `K.drums` and the bass is
  `K.bass`, and each has its own words for the same ideas (KITOPS
  `halftime`/`doubletime`, `bassArtic`, `bassReg`). The cell sheet says so on a
  drums or bass column rather than drawing five controls that write to the
  document and move no hit.

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

Per-cell artic / oct / rate / scale / clamp were per box. SHIPPED 2026-09-04
as wave 4 — and the migration this paragraph promised was NOT needed, which is
a measurement and not a shortcut: see §1d.

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
- **Wave 4's own two** (2026-09-04). `test/table.test.js` **T4m**: each of the
  five cell words moves ONE key in the document, moves that chair in that
  section on the RENDERED `ui/derive.js` path and no other cell of the record,
  makes the CLAIM its word names (staccato shortens; +1 is exactly twelve
  semitones on every note; whole tone moves the pitch classes; dbl is exactly
  twice the notes at half the length and the same total sounding time; the ramp
  limit moves nothing, with the zero-ramp census beside it), and clears back to
  the record byte for byte. **T4n**: a ROW word reaches every chair of its
  section and no other section, and a cell word outranks it for one chair —
  −12 and not 0 and not −24, which is §2's ladder read from both ends.
  `test/table.browser.js` **T6f–k**: on a chair that reads a subject, each of
  the four strips is drawn with no neutral chip, SOME word of it moves that
  section's rendered events (the vocabulary is walked, §1b's law — `tie` is the
  word that moves a lead whose notes carry written holds), the tap lands on the
  cell tier through `putCell`, another section does not move, and the
  clear-back leaves nothing behind; the ramp limit is a measurement rather than
  a live strip (T6j); and a chord-voicing chair is TOLD its articulation and
  its alphabet with the measurement while keeping its octave and its time as
  strips (T6k).
- **Wave 3's own three** (2026-09-04). `test/table.test.js` **T4k**: a cell's
  four offsets move that voice's numbers in `deskUnits`' RENDERED unit table by
  exactly what they say, in that section only, on that voice only, and clearing
  restores the record byte for byte; the document diff moves one key. **T4l**:
  a `pump` row and a `+6` cell compose — the row's curve stays on the notes
  (`deskAmp`) untouched and the cell's stays on the unit, one application each.
  `tools/ableton/als-gate.js` **gate X**: the writer is run twice with one cell
  offset between the runs, and the finished XML says the offset track's volume
  is the base's times the dB and its pan the base's plus the offset THROUGH
  THAT SECTION'S BEATS and nowhere else, while every other track is
  byte-identical — with run A proving it reproduces the shipped file first.
  `test/table.browser.js` **T6e**: the strip is drawn, has no zero chip, is
  tappable, and the tap lands on the cell tier AND on the box the desk reads.

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
   greyed field lights. **SHIPPED 2026-09-04** — see §1c.
4. **Per-cell artic/oct/rate/scale/clamp**, with the VERSION migration if the
   save moved. **SHIPPED 2026-09-04** — see §1d. It did not move, and the
   reason is the wave's own finding.

Each wave one agent at a time on the shared files, the parent rebuilds, gates,
commits, deploys to staging.

## 9 · The sonic spreadsheet, and the committed build (APPROVED 2026-09-05)

Paul, on the v270 table: *"Move all the nav into the table, I should be able
to add players without using the nav and sections too. I click band and all
further operations are buttons around the table. Cells and dropdowns have
lots of padding … Clicking '1 head' results in an enormous blank space …
spread things out to 100% of the screen width and make the buttons a tiny
bit bigger than the words themselves."* Then: *"In general dropdowns barely
work."* Then: *"I want the table to just re-use spreadsheet dynamics since
users know them. Think of song composition as 'sonic spreadsheet'."* And on
the build: *"Do the committed build. Minimize things where possible."*

### 9a · The dynamics (they are a spreadsheet's, not the box's)

- Tap a cell → it is SELECTED (one selection, its address shown), and its
  vector appears in the FORMULA BAR above the grid as editable chips. Double-
  tap or Enter edits in place; Escape cancels; Delete clears back to inherit.
- Arrow keys and Tab move the selection; Shift+arrows and drag select a
  range. Phone: swipe moves the selection; the formula bar is the bottom sheet.
- Blank = inherited (an empty cell), bold = written (§2 unchanged).
- Copy / paste move a cell's vector; fill right / fill down are §5's copy-to-
  row / copy-to-column. Insert, delete, duplicate, move a row or column from
  the header's menu (right-click / long-press) or its buttons; a `+` at the
  end of each axis adds a player or a section. NO OP LIVES IN THE NAV: the
  tray keeps the Band tab and, at most, jump links.
- Frozen headers; resizable columns; the pane uses 100% of its width at
  every size; a control is a little bigger than its word (44px tall, ~0.5ch
  side padding), never a box of air.
- UNDO / REDO at the document level, Cmd/Ctrl-Z, for every op — mandatory:
  spreadsheet users expect it and the page has only the producer's undo.
- Formulas are the metaphor's gift, not this wave's: "= B2" (same as that
  cell) is a reference; inherit is the default formula.

### 9b · The committed build (the extractor pattern, a seventh time)

Source: `nukernel/src/**/*.ts` (Lit + TypeScript). Build: ONE esbuild step,
`tools/ui/build.js`, bundling Lit INTO each component file so nothing is
vendored and nothing is fetched — output committed under `nukernel/ui/` as
plain ES modules the page loads with a `<script type=module>` as today.
`--check` rebuilds and diffs the committed output; `tsc --noEmit` is the type
gate. The served tree stays plain files; the deploy stays rsync; the two laws
(no build in front of the page; plays with the wire cut) hold. Minimal: two
devDependencies (esbuild, typescript), no bundler config beyond the script,
no framework beyond Lit. Dropdowns: the native picker on touch, the typed
combo on desktop with a keyboard, chips for a vocabulary of ≤ 8 words.

**SHIPPED 2026-09-05, and the four numbers a reader wants.** `package.json`
(esbuild 0.28.2 + typescript 5.9.3 as devDependencies, `lit` 3.3.3 as the one
runtime dependency, bundled in), `tsconfig.json` (strict, ES2022, DOM,
`noEmit`), `tools/ui/build.js`. An ENTRY IS A DIRECTORY —
`nukernel/src/<name>/index.ts` becomes `nukernel/ui/<name>.js` — so adding a
component is a directory and not an edit to the build script.

| | measured |
|---|---|
| `npm install` | 9 packages, 40 MB, 5 s. `/node_modules/` stays gitignored and the deploy already excludes it; the OUTPUT is what ships |
| `node tools/ui/build.js` | 1 entry in **120–150 ms** |
| `node tools/ui/build.js --check` | **168 ms** (rebuild to a temp dir, diff, exit 1 on the first differing line) |
| `npx tsc --noEmit` | **3.15 s** |
| `nukernel/ui/table.js` | **2,152 lines / 73,435 bytes** from 2,023 lines of TypeScript — of which **417 lines are lit-html and its four directives** (class-map, if-defined, repeat, style-map). The hand-written file it replaced was 52,644 bytes |

Registered in `test/all.js` as **`ui-build`**, a wave-1 `node` gate of two
steps (`--check`, then `tsc --noEmit`), beside `genres-build` and `wiki` and
for their reason. `skipExit: 2` is `wiki`'s own door: build.js exits 2 when
`node_modules` is absent — a fresh clone or a deploy worktree — which is a SKIP
and not a failure, because the committed output means a tree with no toolchain
still plays.

**MINIFY IS OFF AND THAT IS THE POINT.** A committed artifact nobody can read
is a committed artifact nobody reviews; the diff is the review. Bundling Lit
costs 417 lines once, and buys the two laws whole — no CDN, no vendored second
copy of somebody else's file, no `import` the browser has to resolve.

**IMPORT `lit/html.js`, NOT `lit`.** Measured: the package's own entry re-exports
LitElement and `@lit/reactive-element` came along with it — 83,336 bytes for a
file that renders into light DOM and defines no custom element. `lit/html.js` is
lit-html alone and is 72,450. (Light DOM is not a preference either: every gate
on this page queries from the document root through `#pan-band`, so a shadow
root would make the whole table invisible to all of them.)

### 9c · The strangler order

1. The grid: `nukernel/src/table/*.ts` → `nukernel/ui/table.js` replaced by
   the component, same doors (putCell/putRow/putPhrase/commit/push/evolve),
   same data-k addresses so T4–T8 keep reading; document-level undo/redo
   lands with it. Gate: the sheet-dynamics gate (select, edit, move, range,
   fill, undo, at 320/390/1280 by tap) beside T5–T8.
2. The sheets and menus (selects.js's combo → native/typed/chips).
3. Rules, Time, Motifs, Mix, Produce, Score panes, one at a time.
4. The shell and the tray last. eight.js shrinks with each step; nothing is
   hidden, nothing dead (T7's law for every pane).

### 9d · What step 1 landed, and the six things it measured

**SHIPPED 2026-09-05 (uncommitted).** `nukernel/ui/table.js` is GENERATED now,
from `nukernel/src/table/` — `api.ts` (the seam, typed), `model.ts` (the three
vectors and the op grammar, ported field for field), `sheet.ts` (the formula
bar's body and the one owner of which widget a vocabulary gets), `undo.ts` (the
document stack) and `grid.ts` (the spreadsheet). 2,023 lines of TypeScript;
`ui/eight.js` gained THREE doors and nothing else (`copyCellTo`, `snapshot`,
`evolve`) and lost none.

**WHAT OF §9a IS IN.** One selection with its address · the formula bar
(head + body) · edit in place, Escape, Delete = clear to inherit · arrows and
Tab and Shift-Tab · Shift-range, counted in the bar · copy and paste of a vector
· fill right and fill down (§5's copy-to-row and -column, in a spreadsheet's
words) · header menus on right-click and long-press · `+ player` and
`+ section` at the end of each axis · frozen headers · resizable columns ·
100% pane width · a control that is its word plus half a character ·
document-level undo/redo on Cmd/Ctrl-Z, Shift-Z and two buttons. NOT IN, and
named rather than left to be found: ~~the ops still have their tray branch~~
(**DONE 2026-09-05, §9e** — §9c step 1's "no op in the nav" was a change to
`ui/eight.js`'s tray that `test/shell.js` A6l and `test/gutter.js shorten()`
both drove by name, and all three moved in the same edit); and formulas, which
§9a itself defers.

**THE UNDO IS A STACK OF DOCUMENTS AND IT ADDS NO WRITE PATH.** `snapshot()` is
a read and putting one back is `CTX.evolve` — the door the seed strip and the
atlas have handed this page a whole new document through since the composer
round, which normalises, recompiles and lands at the next bar like every other
op. Snapshots and not inverses, because an inverse per op is a second
implementation of every op and this table has fourteen of them, half of which
end in a `normalize()` that prunes. Twenty-five deep. THE PRODUCER'S OWN UNDO
STAYS EXACTLY AS IT IS: it takes back one producer NOTE, wherever you are; this
one takes back the last thing the table did. A note taken back while the table
is open is simply the next document the table snapshots against.

**ONE OWNER FOR A DROPDOWN** (`sheet.ts pickerFor`), asked once per field:
the caller's own typed combo for the five MENUS keys and anything over
twenty-four words; CHIPS up to eight words; the NATIVE picker above eight on a
`(pointer: coarse)` screen; chips otherwise. The address never moves — T7 finds
`data-k` on whatever is drawn.

Six things the rendered page said that the plan did not:

- **A REBUILD MUST CLOSE THE SHEET, AND THE SELECTION MUST SURVIVE ONE.** The
  accordion has always come back closed because the component owned it, and
  three things are built on that: `tablePanel` lands an arrival by CLICKING the
  head it wants open, every door is a TOGGLE, and the transpose is reached by
  opening the corner. Keeping `OPEN` across a rebuild put fifteen checks red at
  once, all of them downstream of one un-restored transpose — the restoring tap
  closed a corner that had never shut. The selection is the other way round and
  that is §9a's own ask: a spreadsheet does not forget which cell you are on
  because you typed in it.
- **A SHEET IS BUILT ONCE PER OPEN, NOT ONCE PER DRAW.** Its rows carry the
  CALLER'S widgets — selects.js's combo, engineer.js's channel strip, VOICE.md's
  knobs, the samples crate — and each registers itself on the page when it is
  built. An arrow key is a draw; a second combo is a second control on one
  address, and test/selects.js's own guard said so within the minute.
- **THE COLUMN GRIP WROTE `WIDTH["tcol|stab"]` AND THE `<colgroup>` READ
  `WIDTH["stab"]`.** A control that writes and does not arrive, in the wave
  whose own gate was written to find it. T9r caught it because it measures the
  `<th>`'s rendered width and not the map.
- **A CORNER FROZEN ONLY TO THE TOP DECLARES STICKINESS AND SLIDES.**
  test/shell.js A8 takes the pane's FIRST `<th>`, asks whether it says `sticky`,
  then scrolls 200px and measures. A spreadsheet's corner has never scrolled in
  either direction. And the pin is at 3px, not 0: `.nu-trims` is
  `border-spacing: 3px`, so a head pinned at 0 SNAPS three pixels the moment it
  sticks (measured: "moved 4px over a 200px scroll", three widths). Before this
  wave A8 skipped at every width on every tab — a check that always skips is not
  being made; it reads the Band pane now.
- **A RULE THAT READS RIGHT AND MOVES NOTHING, TWICE.**
  `.nu-sheetgrid .nu-colhead{ position: relative }` (for the grip's anchor) came
  AFTER the freeze rule and beat it — T9s read the head back as `relative` the
  same minute it was told to stick, and a `sticky` box anchors an absolute child
  anyway. And `order: 2` on a child of a host that is not a flex container did
  nothing at all, so the phone's "bottom sheet" stayed at the top until the bar
  and the pane became the two children of one column flex.
- **A GREY UNDO BUTTON OWES A REASON LIKE ANY OTHER CONTROL.**
  `test/text-diet.test.js` T3 reads every disabled control on the page and
  demands a non-empty one; it named all four of the bar's the hour they landed
  ("naked: tundo, tredo, tcopy, tpaste"). The refused-control law is not only
  about the engine.

**GATES.** `test/table.browser.js` T4–T8 stayed green through the swap without
one address moving; **T9** is the sheet-dynamics gate (twenty checks: select,
address, the bar, the arrows, Tab, the range, a chip write on the CELL tier,
Delete, undo/redo by button and by Ctrl-Z, copy/paste, fill, the two axis
offers, a right-click menu, the grip, the freeze, and all of it at 320/390/1280)
— **132 ok, 0 failed**. Two structural counts in T5a and T4's transpose read
`tbody tr:not(.nu-addrow)` now, and that is the only edit either needed: the
`+ section` row is not a section, exactly as a `<tfoot>` row is not one. Also
green: `shell` (A8 asserting instead of skipping), `selects`, `sheets`,
`nav-tree`, `knobs`, `gutter`, `text-diet`.

### 9e · Step 1's three loose ends, closed (2026-09-05)

§9d named three things it left behind and said both gates that would have to
move with them. All three are done, and each measured something the plan did
not know.

**THE NAV REDUCTION — the tray's Band branch is two lists of JUMPS and nothing
else.** §9a's law is *"NO OP LIVES IN THE NAV: the tray keeps the Band tab and,
at most, jump links"*, and until today the branch still drew nine ops beside
the table that already offered every one of them: `addvoice`/`addbass`/
`adddrums` (the three hires), `addsec`, `secup`/`secdown`/`secdup`/`secdrop`
under whichever section was open, and `dropvoice` under whichever player was.
Deleted from `ui/eight.js` — `bandTrayItems`'s offer loop, `sectionTrayItems`'s
`addsec` row and its `kids`, and the two builders `secOpsTrayItems` and
`voiceTrayItems` whole, with a tombstone in their place. **NOT ONE `reach` IN
`test/table-inventory.json` MOVED**, which is the measurement that makes this a
deletion rather than a loss: T7 has filed all nine on the table since wave 2b
(`tcol-add|line|bass|drums`, `trow-add`, `trow-up|<id>`, `trow-down|<id>`,
`trow-dup|<id>`, `trow-del|<id>`, `tcol-del|<voice>`), so what went is a second
copy of nine controls. What the rows keep is the jump, and the jump is what
puts the ops under the thumb: tapping `tab<name>` runs `openVoice` and
tapping `secnav<id>` runs `openSection`, and `tablePanel` lands each arrival by
clicking `tcol|<name>` / `trow|<id>` — so the sheet holding the ops is open
before the second tap goes out. **`test/shell.js` A6l is now a claim about the
LAW instead of a count**: at all four widths, zero rows at depth 2, no
`aria-expanded` on a childless row, the row still wearing the state and the one
`<mark>`, AND the ops present on the table at their own addresses (`tcol-del`
+ three hires under a player; the four verbs + `trow-add` under a section) —
because a deletion nobody can undo by tapping is a lost control, so the gate
reads the table rather than trusting the inventory. `test/gutter.js shorten()`
shrinks the record through `trow-del|<id>` in the row sheet the jump opened,
which keeps the jump link itself under test — the only thing left on that
branch worth breaking. Four more gates hired their drummer through the stripe
and now hire through `tcol-add|drums`: `nudges`, `sheets`, `selects`, and
`shell`'s own kit-grid measurement (and `shell`'s "hire a line if the blank
state has none" through `tcol-add|line`).

**A HAND-CHANGED THROAT RE-SEATS THE WRITTEN REGISTER.** `precompose.js` §7d
writes every sung chair at the octave its throat actually sings, so the staff,
the piano roll and the notated `.mid` say what the box sounds instead of
leaving `audio/plan.js`'s fold to correct it behind them — and the page had one
door that undid it in a tap. The column sheet's `sings as` strip
(`ui/eight.js` `A.throat` → `putCast(vi, "voice", …)`) wrote the new throat and
left `cast.reg` where the OLD throat had put it. MEASURED on Kingston 1969 at
reading 1: the `vocal` chair is seated at reg 0 for its throat and folds by 0;
asking it to sing soprano wanted a fold of **+1** and bass wanted **−1**, and
neither reached the document. The fix is one owner and it is `precompose.js`:
the pass's walk and its arithmetic are `chairNotes` and `applySeat` now, one of
each, and **`reseatVoice(doc, vi)`** is the pass asked about one chair — it
needs the compass table, `throatVoiceOf`'s precedence and the played-bar walk,
all three of which live there and none of which `document.js` or the door has
any use for. `putCast` calls it when `f === "voice"` and lands at the next bar
through the same `after()` every write on that surface ends in. **IT IS
IDEMPOTENT AND THE TWO OWNER RULES AGREE, and that is one measurement**: the
pass reads which ROW owns a chair off `genreToDocument`'s own `nBase` /
`layerKeys`, the door has neither and reads it off the finished record — so
calling the door on every line chair of a freshly composed record must write
nothing. Over the whole catalogue: **1,437 records, 7,448 line chairs, 0
re-seated** (`test/table.test.js` T4p, sampled in FAST and complete on
`--full`), and the 1,437 composed records are byte-identical to the ones the
un-refactored file wrote. On the page, `table.browser` **T9u–T9x**: the write
moves `cast.reg` by exactly the fold the new throat asked for, the fold
`audio/plan.js` would then apply is **0** over 267 rendered notes, the SUNG
line (`pitch + 12 × fold`) is the same either way — the seat moves the notation
and never the sound — and a second write of the same word moves nothing.

**A ROW `clamp` MOVES NOTHING, AND THE ROW SAYS SO.** The row tier of §1's five
landed as five strips and four of them reach the sound. The fifth wrote
`section.clamp`, resolved through `document.js toGenre` onto the compiled
genre's `incClamp`, reached `kernel.js rampOf` — and moved no note, because
**`document.js` toPhrase writes `inc: z(), stk: z()` unconditionally
(document.js:581)**, so `rampOf`'s raw ramp is `(0 + 0) × loop` and a limit has
nothing to limit. Re-measured over the whole catalogue this round: **0 of
18,793 motif phrases across 479 anchors at three readings carries a ramp
column** — and `nukernel/gates.json`'s own census had already said it from the
other end, `form.clamp`, 165 rows, **0 alive, `blind: true`**. So `avail.js`
mints no `form.clamp` sheet at all (a sheet nothing draws is the dead half of
the same problem) and `src/table/model.ts rowSheet` draws `rowVecSay` — the
cell's own treatment one tier up, with `RAMPWHY` as the ONE spelling of the
sentence the two tiers print. The refused-control law rather than a silent
grey. `table.browser` **T9y/T9z**: the row's `ramp limit` is a sentence
carrying its measurement and no `.nu-wcell`, nothing on the page can write the
field (no `form.clamp` control, no chips, no sheet in `NuAvail.SHEETS`), and no
section of the record carries a `clamp` after the sheet has been opened. The
day a ramp column lands in the hook editor, `test/table.test.js` T4m goes red,
the `continue` in avail.js comes out, and the strip is back with its vocabulary
unchanged.

## 10 · One sheet: the whole box in the table (APPROVED 2026-09-05)

Paul, looking at the nav beside the v271 grid: *"we could integrate rules
into a special row, time + key into a special row, then do the same with
motifs, have the current table, and then do the same with the mix and
produce -- then have a hamburger menu for score, video, screensaver, and have
genre, dice, playstop along the bottom — a real mobile app now with
everything in the table and the nav space reclaimed."*

### 10a · The layout (phone first; the desktop is the phone given room)

    ┌────────────────────────────────────────────────┐  ≡ (score · video ·
    │ TIME      bpm · tempo map · key · meter        │     screensaver · export)
    │ RULES     the rule chips, expandable           │
    │ MOTIFS    the bank across, previews+provenance │
    ├──────────┬───────┬───────┬───────┬─────────────┤
    │          │ drums │ bass  │ lead  │ … + player  │  ← voice columns
    │ 1 intro  │  cell │  cell │  cell │             │  ← section rows
    │ 2 verse  │  …    │       │       │             │
    │ + section│       │       │       │             │
    ├──────────┼───────┼───────┼───────┼─────────────┤
    │ MIX      │ strip │ strip │ strip │  master     │  ← one strip per column
    │ PRODUCE  │ the producer's deals and notes      │  (merged, expandable)
    └────────────────────────────────────────────────┘
    [ genre ]            [ 🎲 47101 ]          [ ▶ / ■ ]   ← the bottom bar

- **Special rows** are rows of the same sheet: TIME, RULES, PRODUCE are
  record-level and MERGED across the columns, expandable, chips inside; MIX
  is ALIGNED — one channel strip per voice column and the master in the
  corner; MOTIFS is the bank across the top with previews and provenance,
  and tapping a motif points the SELECTED cell at it (the formula bar's own
  write). Sections keep their row overrides (key, swing, chain) as today.
- **The lamps move onto the headers**: the playing section's row head and
  the sounding players' column heads light (the score deck's join, v263's
  source of truth). The nav tree's levels, indent and colours are retired
  with the tray.
- **The bottom bar**: genre (opens WHERE, the globe, as a sheet — it is a
  picker), the die with its number (v263's seed control unchanged), play /
  stop. Nothing else.
- **The hamburger** (≡): Score, Video, Screensaver, Export — the viewers.
- **The tray is deleted** (T7's law: every control it offered lands
  somewhere above, proven on the rendered page at 320px). Rules, Time,
  Motifs, Mix, Produce, Where as PANES are deleted the same way, one at a
  time, as each becomes a row or a sheet.

### 10b · The order (steps 3–4 of §9c, restated)

1. TIME row (Tempo + Key's controls; pace stays on the section row).
2. RULES row (ui/rules.js's sheet as chips; a change evolves, as now).
3. MIX row (engineer.js's strips per column, the master in the corner, the
   genre bus's three slots in the master's sheet).
4. MOTIFS row (the bank, ui/preview.js previews, provenance words; the
   bench opens from a motif as its sheet).
5. PRODUCE row.
6. The hamburger and the bottom bar; WHERE as a sheet from the genre button.
7. The tray deleted; the lamps on the headers; shell/nav-tree/gutter gates
   rewritten to the sheet's laws; eight.js loses the tab/tray machinery.

Each step a Lit source directory (or a module under src/table), a committed
build, one gate per claim, shipped and deployed before the next (Paul,
2026-09-05: "Don't overtest for now. Just move stuff along.").

### 10c · What steps 1 and 2 landed, and the five things they measured

**SHIPPED 2026-09-06 (uncommitted).** `nukernel/src/table/special.ts` is the
new module and it is small on purpose — 200 lines, of which the TIME row's
sheet is fourteen `push`es and the RULES row's is one. `grid.ts` gained the
`<thead>` rows, the orphan-sheet branch, the keyboard's one exemption and
`stick()`; `api.ts` gained thirteen doors; `ui/eight.js` lost `timeAxis`,
`alphaAxis` and `check()` (323 + 17 lines) and gained five widget builders
(143) plus the doors. `index.html` lost `#pan-tempo` and `#rulesdeck`; `TABS`
lost two rows, `BUILD` two builders, `TABKIDS` two branches, and
`rulesAxisRows` went with the Rules branch.

**WHAT A SPECIAL ROW IS, IN THE MARKUP.** One `<tr class="nu-sprow">` in the
`<thead>`, above the column heads, holding ONE `<th colspan="<every column>">`
whose whole content is a button: the WORD (`TIME`, `RULES`) and, beside it, the
FACE — `79 a minute · four · D natural minor`, and `nothing written — the genre
as the atlas deals it`. The sheet opens where a column head's has always
opened, at the top of `<tbody>`, because a sheet inside a frozen head is a
sheet that covers the grid it is editing.

**FIVE THINGS THE RENDERED PAGE SAID THAT THE PLAN DID NOT.**

- **A HEAD OF THREE ROWS CANNOT BE PINNED AT ONE OFFSET.** `nu.css` pins every
  `thead th` at `inset-block-start: 0`, which is exactly right for a head of
  one row: TIME, RULES and the column heads all declared the same line and
  painted over each other. The offsets are MEASURED — `grid.ts stick()` walks
  `thead > tr` after every render and writes each row's own — because the
  heights are the faces' own (a long key name is a taller line at 320) and a
  hard-coded pair of pixels is the rule that reads right and moves nothing this
  table has already shipped twice (§9d).
- **A MERGED ROW IS THE PANE'S WIDTH, NOT THE TABLE'S.** A `<th>` that spans
  nine players is nine players wide — measured 857px at a 390px screen — so the
  face's last word was off the side of the phone with no ellipsis, because
  `text-overflow` had 857px of room to not need. The cell is frozen at the
  pane's left edge, so the honest width for the LINE inside it is what a hand
  can see: `--panew`, written by `stick()`, and the face ellipsises against it.
- **THE SPECIAL ROW'S OPEN STATE MUST SURVIVE A REBUILD, AND IT IS THE ONLY
  ONE THAT MAY.** §9d's law is that a rebuild closes the sheet, for three
  measured reasons — `tablePanel` lands an arrival by clicking a head, every
  door is a toggle, the transpose is reached through the corner — and not one
  of them is true of TIME or RULES. What IS true is the opposite: every control
  in these two rows recompiles (a tempo, a meter word, a rule), `changed()`
  throws the panel away, and a row that closed on a rebuild would shut under
  the thumb using it. So `OPEN` survives iff it begins `sp|`.
- **A SPREADSHEET'S TAB IS THE WRONG TAB INSIDE A MERGED ROW.** In the grid,
  Tab moves the SELECTION, which is what a spreadsheet's Tab does; inside a row
  of chips it is the one thing a hand expects Tab to do least. The keyboard
  lets a special row's own controls alone (`.nu-sprow`, and the open sheet
  while a special row owns it) and keeps Escape, which is how the row closes.
- **THE CIRCLE OF FIFTHS IS THE ONE CONTROL T7 COULD NOT MEASURE.** Its
  twenty-four radios are 1×1 by design — the LABEL is the target, which is what
  `test/shell.js` A3 measures at 24px — so filing `opt|alphabet.key|0` as a
  reach reported the whole circle as a short control. The reach is the widget's
  own `data-circ`, and T7 learned the third spelling in the same edit.

**WHAT `ui/rules.js` BECOMES: THE RULES ROW'S SHEET BUILDER.** Not a pane
builder, and not deleted. Its rows ARE this week's two-line row — *"the
sentence with its value, the control under it"* (Paul, 2026-09-03) — drawn by
`sentenceInto` out of `nukernel/rules.js`'s own `parts`, which no other
renderer on this page can build; re-typing nine hundred lines of it into
`Field[]` would be a second owner of thirty-eight sentences bought for a shape
it already has. `mountRules(host, ctx)` is called from exactly one place now —
`tableAPI().rulesNode()` — with the same `CTX`, so `apply()` still lands a
compose rule through `ctx.evolve` while the transport runs and a render rule
through `ctx.changed()`. `nukernel/rules.js` (the table, the tiers, the evolve
logic) did not move a line. What is deleted is the pane: the tab, the tray
branch, `#rulesdeck`, the `BUILD` entry and `rulesStop`.

**THE EIGHT AXIS JUMPS ARE THE ONE CONTROL RETIRED RATHER THAN MOVED**, and it
is filed with its reason: `rulax-<axis>` scrolled the Rules PANEL to one
`section.nu-rulax`, and there is no panel to scroll — the eight blocks are
inside the one row, one tap from the top of the sheet, and a jump link into a
row you have already opened does what the scroll you are already doing does.
`test/table-inventory.json` files it under `rules-row` all the same, because
T7's question is "can a thumb reach it", not "does it still have a button".

**GATES.** `test/table.browser.js` **T10** (twelve claims: the two rows are
merged rows of the sheet above the column heads at 320/390/1280, the head
freezes as a measured STACK, the face is the record's own line, the TIME row
holds all twenty-five control families the pane offered at 320 with none under
44px and no sideways page scroll, a meter chip writes the record and the face
re-reads it, the nine tempo marks move it, Enter opens and Escape closes, the
Time pane is gone and each fact has exactly one control page-wide, the RULES
sheet is the panel — axis blocks, name plate, two-line rows, palettes, a tier
per row — a rule written in the row reaches `doc.rules` and the row stays open
across the evolve, and the Rules pane is gone with the editor drawn once) —
**159 ok, 0 failed**, T4–T9 unmoved.
`test/table-inventory.json` grew twenty-four rows measured off the two panes
BEFORE the deletion (22 control families in `#pan-tempo`, 9 in `#rulesdeck`,
the two tab rows, the eight axis jumps). `test/tempo-key.browser.js` (23) and
`test/rules-view.browser.js` (42) are RE-POINTED, not retired: between them
they make sixty-five claims about what these controls DO, every one of which is
about the control and not the panel, so `__eightTab("Time")` became
`__eightRow("time")` — a new page door that opens Band and presses the row's
head, idempotent — and `#pan-tempo`/`#rulesdeck` became `#pan-band`. The same
one-line repair re-points `selects`, `sheets`, `knobs`, `gutter`, `atlas` and
`silence`; `shell` and `text-diet` lose two tab rows and three headings from
their quoted lists, with the amendment dated under Paul's own sentence.
Measured after the re-point: `tempo-key` **23 ok / 0 failed**, `shell` **PASS**
(A8 now reads the first `<th>` that is a COLUMN — a merged row's cell spans its
own containing block and has nowhere to stick, so the row pins its own LINE
instead), `rules.test` **22 / 0**, `text-diet` **PASS** (static prose 1,070 of a 1,170
ceiling — a row's face is inside its own button, so the diet does not count it),
`rules-view` **40 of 42**.

**THE TWO REDS ARE NOT THIS ROUND'S, AND THE PROOF IS ONE FLAG.**
`rules-view` R9's "every single-answer row is a sentence line plus a control
line" and R5a's "no silent grey" fail on `rate` (129px), `harmony` (176px),
`plan` (129px) and on two greyed palette offers — and all five are the CHIPS
widget that `src/menus/pick.ts` began handing to every vocabulary of eight
words or fewer in v272 (2026-09-06, the round before this one): a chip strip of
three long words is three lines where a combo was one, and a refused CHIP puts
its reason in `data-why`, `title` and its accessible name but does NOT append it
to the visible word the way `optionText` does for the native picker and the
combo. MEASURED: with `CHIPMAX` temporarily set to 0 and nothing else changed,
`rules-view` is **42 ok, 0 failed**. Neither claim touches where the panel is
drawn — `ui/rules.js` is not edited by this round at all — so both belong to the
menus round's own queue: either the chip appends its reason like its two
siblings, or R5a's `said` clause learns the third widget.

### 10d · What step 3 landed, and the four things it measured

**SHIPPED 2026-09-07 (uncommitted).** `nukernel/src/table/special.ts` grew the
MIX row's three builders (`mixFace`, `mixSheet`, `masterMixSheet` — 60 lines);
`grid.ts` gained `mixRow`, `mixCell` and a second lamp map and LOST the
`tfoot|master` row; `model.ts` lost `masterCells` and `masterSheet` and the
column sheet's `seat` field; `api.ts` gained `mixWord`, `mixWritten`,
`boardRack` and `showSeat` and lost `setMaster`; `ui/eight.js` lost the `Mix`
tab, its `BUILD` entry, its `TABKIDS` branch and `mixTrayItems` (35 lines) and
gained `openMixRow` + `window.__eightMix`; `ui/engineer.js` gained `seatWord`,
`seatWritten` and its own plate row back; `index.html` lost `#deck`.

**THE ROW, IN THE MARKUP.** Two `<tr>`s at the top of the `<tfoot>`. The first
is `nu-mixrow`: a `<th>` holding the word `mix`, then one `<td class=
"nu-mixcell">` per voice column carrying that seat's own word — `—`, `−3.0 dB`,
`left-ish`, `2 fx` — with that player's own lamp beside the button, and the
cell opens `ui/engineer.js voiceMix` for that player. The second is
`nu-masterrow`: one `<th colspan>` whose button is `tmix`, reading `MASTER
soft · worn · room · warm · open`, and it opens the whole board.

**FOUR THINGS THE RENDERED PAGE SAID THAT THE PLAN DID NOT.**

- **THE MASTER HAS NO CORNER TO SIT IN, AND IT TOOK TWO MEASUREMENTS TO SAY
  SO.** §10a draws it inside the mix row — `│ MIX │ strip │ strip │ master │` —
  and both readings of "the corner" were built and driven before either was
  believed. IN THE ROW HEAD it is unreadable: the head column of this table is
  narrow by construction, and with the master's button in it the `<th>` is 36px
  at 320 and 390 and 45px at 1280, the button 26 and 35, and the face `soft ·
  worn · room · warm · open` rendered at **seventeen pixels**. IN THE ADDER
  CELL it is off the screen: 547px wide and perfectly legible, at an x seven
  player columns to the right of a 255px pane, because the mix row's cells are
  inside the pane's own horizontal scroll — which is exactly right for a fact
  that belongs to a COLUMN and exactly wrong for one that belongs to the
  record. A record-level fact in this table is a MERGED ROW (§10a's own first
  sentence), so the master is one under the seats, its line pinned to the pane's
  left edge like TIME's and RULES', reading whole at 320.
- **TWO CONTROLS FOR THE MASTER'S SEVEN WORDS, AND THE ROUND THAT FOUND THEM
  HAD TO PICK ONE.** `tmaster|<key>` in the table's footer (wave 2b) and
  `master|<key>` on the board's main plate wrote the same seven values through
  the same `NuDeskDoc.writeMaster`; they were on two different tabs and the page
  never showed them together, so nothing had ever complained. Putting the board
  in the master's own sheet would have put them side by side. The board's is
  kept — it is where the one-touch bypass that reads those same seven values
  back lives — and `masterCells`, `masterSheet` and the `setMaster` door are
  DELETED rather than moved. That is §9b's "minimize things where possible"
  spending a control, and T10o asserts the absence (`tmaster|` is 0 page-wide).
- **A BOARD WHOSE PLATES CAN ONLY BE SWITCHED FROM A DELETED TAB IS FOUR
  PLATES LOST.** `#boardtabs` — the row of five stage buttons — was deleted on
  2026-09-02 as a dated MIRROR of the gutter's five rows, and its own fence
  named the condition. The gutter's five hung off the `Mix` tab, and this round
  deletes that tab. So the row is back inside `ui/engineer.js mount`, at the
  SAME five `boardtab|<kind>|<key>` addresses it has worn on both surfaces —
  an address that has now moved twice without moving — and it is the only
  owner again, which is what it was not in 2026-09-02.
- **ONE ACCORDION MEANS THE BOARD AND A STRIP ARE NEVER BOTH ON THE PAGE.**
  While the board was a pane its DOM survived any other tab being looked at, so
  a gate could read `#board` whenever it liked. `nukernel/desk-gate.js`'s
  BOARD-ROUTING pointer check answered `null` the hour the pane went, because
  the check before it had left a voice's strip open. That is not a regression
  in the page — it is the accordion doing what §9d says an accordion does — and
  it is a claim about every gate that reads two surfaces: each opener now says
  which surface it wants (`openMaster()`, `openVoice()`), rather than relying
  on where the check before it left the page.

**WHAT `ui/engineer.js` BECOMES: THE MIX ROW'S TWO SHEET BUILDERS.** Not a pane
builder, and not deleted. `voiceMix` is a seat's cell sheet and `mount` is the
master's, both seated through node doors, both drawing exactly what they drew
inside the pane — the same `#voicemix`, the same `#boardpanel`, the same
`#rack`, the same `b|…` / `ins|…` / `bus|…` / `master|…` / `t|…` addresses.
That is why 167 desk-gate checks followed the deletion through **five** edited
lines (the arrival, the two openers, the row's selector, and the mark's).
`voiceMix`'s other home is DELETED in the same edit: the column sheet's `seat`
field is gone and `tseat|<voice>` is the pointer that opens the cell.

**GATES.** `test/table.browser.js` **T10l–T10p** (the row is ALIGNED — one cell
per voice column at its own head's left edge, 44px, its lamp a SIBLING of the
button; the master is a merged row at the pane's width wearing the record's
master words; a cell opens that player's strip whole and the board is not on the
page beside it; the column sheet draws no strip at all and carries the pointer;
the master opens one `#boardpanel` with the five stages and the genre bus's
three slots; the main stage carries the seven master words and the record gain;
the Mix pane, its tab, its tray branch and the old `tfoot|master` row are gone;
and the seat stays OPEN across the recompile a mute causes). T7 learned a
SECOND TAP (`then`) in the same edit, because the master's sheet is a tabbed
surface and a walk that pressed only the row's head would report four plates'
worth of controls missing and be right. `test/table-inventory.json` grew twelve
rows measured off `#deck` BEFORE the deletion (10 control families over the
pane's six states, the five tray children, the tab row) and MOVED two — the
strip's `ins|<voice>|<n>` and `b|<voice>|<bus>` — from `column` to `mix-row`.
`nukernel/desk-gate.js` **167 checks, the same 2 pre-existing reds** (the genre
bus's three `fx` seats, red since v272's menus round). Also re-pointed, each in
one line, and each still making every claim it made: `test/mix-heads.browser.js`
(**9 ok, 0 failed** — the mute is driven through `tmix|<voice>`, the automation
plate is opened from the board's own stage row), `test/vol-reach.browser.js`
(**V3 green** — a fader is dragged in the mix cell and the sounding bar's unit
carries the offset), `test/sheets.js` (the seat census walks the MIX ROW's cell;
and the seat's own address is read BOTH WAYS, which repairs a red that has stood
since v272 — `seatSelect` went through `src/menus/` and started wearing
`data-sel="ins|<voice>|<n>"`, so the "(no data-sel: …)" spelling the count was
written for stopped being produced and the check failed on an empty list, saying
a strip was missing that was standing there). `test/shell.js` **PASS** and
`test/text-diet.test.js` lose one tab row each, with the amendment dated under
Paul's own sentence. `test/table.browser.js` **171 ok, 0 failed**. `test/text-diet.test.js`: "The
board" leaves the panel-headings list the way "The rules" and "Time" left it a
round ago — the `<h2>` is still drawn, still announced, still skipped by the
diet; what it stopped being is a PANEL's name.

**THE ROUND'S FIRST EDIT WAS SOMEBODY ELSE'S QUEUE, AND IT IS ONE LINE OF
`src/menus/`.** §10c left two `rules-view` reds with their diagnosis: a refused
CHIP put its reason in `data-why`, `title` and its accessible name and printed
nothing, unlike the two widgets beside it. It prints it now — a `<small
class="nu-why">` inside the chip, which is the `flex: 0 0 100%` second line
`.nu-chipprov` already is on that exact button, and nu.css's own ruling on where
a reason may live ("it costs its OWN chip's height and nothing else's") applied
to a flex row. `title` stays only where the reason is NOT on the glass. R9's
ceiling is honest about the same widget rather than raised: it counts the lines
the control ACTUALLY occupies (chips wrap) at 44px each plus the 52 that is the
sentence line and the row's padding, so `rate` is 129 against 140, `harmony`
176 against 184, `stress` 93 against 96 — and what the 96 was written for, a row
that grows a THIRD block, is still exactly what it catches. `rules-view`
**42 ok, 0 failed**.

### 10e · What steps 4 and 5 landed, and the five things they measured

**SHIPPED 2026-09-08 (uncommitted).** `nukernel/src/table/special.ts` grew the
MOTIFS row's two builders and the PRODUCE row's two (30 lines), and `SPECIALS`
grew a third member while PRODUCE was deliberately kept OUT of it (§10a's own
drawing puts it under the mix, and `SPECIALS` is the HEAD's list); `grid.ts`
gained `produceRow`, `spLamp`, the `ARM` state and the two doors the bank needs
back out (`pointMotif`, `armedMotif`); `api.ts` gained six; `ui/eight.js` lost
`materialAxis`, `drawMaterial`, `motifTrayItems` and `motifOpsTrayItems` (321
lines) and gained `motifsNode`, `motifBank`, `motifOpsLine`, `motifsFace`,
`produceFace` and the lamp registry (248); `index.html` lost `#pan-motif` and
`#produce`; `TABS` lost two rows, `BUILD` two builders, `TABKIDS` one branch.
`ui/produce.js` gained one export — `said(doc)`, the producer's last sentence
and the count, so the shut row and the open one cannot spell one stack two ways.

**THE ROW, IN THE MARKUP, AND IT HAS TWO STATES.** One
`<tr class="nu-sprow" data-special="motifs">` in the `<thead>` under RULES, its
head `tmotifs`, its face `10 in the bank · hook, answer, riff …` — or, when you
are standing inside one, `in hook · 10 in the bank`. Its sheet is THE BANK: one
`.nu-bankrow` per cell in `material.cells`' own order, carrying ui/preview.js's
picture at the row's full width, the NAME as a button (`motifpoint|<name>` —
the write), the provenance word, `readby|<motif>|<voice>` for every chair, and
`open` (`motifopen|<name>`). One tap in, the bank is replaced by that motif's
whole block — `← the bank`, `#staff`, the rename field, clear, play/loop, the
bench, `+`/`− measure`, the forks and the fourteen transforms as one line at
the foot. PRODUCE is two rows further down, in the `<tfoot>` under the master:
one `<th colspan>` at `tproduce` reading `3 of 10 · “make the sound dirtier”`,
or `nothing said — the record as the atlas dealt it`, opening `ui/produce.js
mount` unchanged.

**FIVE THINGS THE RENDERED PAGE SAID THAT THE PLAN DID NOT.**

- **A LAMP THAT APPEARS WHEN THE RECORD STARTS IS A LAYOUT CHANGE TWO ELEMENTS
  AWAY, AND IT BREAKS THE PAGE'S OLDEST LAW.** The MOTIFS row's lamp names the
  sounding motif under the row's own face, and it wore `:empty { display: none
  }` for an afternoon — which is exactly right for a lamp in a footer and
  exactly wrong for one in a `<thead>` whose offsets `grid.ts stick()` MEASURES
  after every render. Pressing play made the row 16px taller and moved
  `inset-block-start` on the column heads from **138px to 154.109px** — an
  inline style, outside `[data-live]`, written because the clock wrote, and
  `test/bench.test.js` B6 had it inside the hour. The line is reserved always,
  and it is `block-size` and not `min-block-size`: an empty inline box has no
  strut, so a `min` of 1.2em still measured **151.812 against 154.109**. The
  room is reserved before the thing arrives, which is `staffRoom`'s own
  discipline applied to a lamp.
- **A CELL OF TWO MEASURES DRAWS TWO BENCHES, AND "DRAWN ONCE" HAD TO LEARN
  IT.** T10v was written as `one bench, one #staff, one way back` — the shape
  that would catch a pane and a row both drawing the editor — and it went red
  on `bench: 2` for a motif that is 32 steps long. `hookGrid`'s own note has
  said so since 2026-08-28 (*"a cell of two measures draws two tables, stacked
  in order, and the count restarting at `1` IS the bar line"*). The claim is a
  bench PER MEASURE now, read off the open cell's own `deg.length`, and every
  other half of it — one `#staff`, one way back, one rename field, fourteen
  transforms — is unchanged, which is the half that would actually double.
- **THERE IS NO GESTURE ON THIS PAGE THAT UN-SELECTS A CELL, so the gate for
  the armed bank has to ARRIVE.** §10a's *"tapping a motif points the SELECTED
  cell at it"* leaves the hand that taps a name first, and the answer is that
  the button ARMS and the next cell tapped gets it. Driving Escape to reach
  "no cell selected" read as a PASS and was a lie: §9a gives Escape the open
  sheet, the open field and the range anchor and nothing else — a spreadsheet
  does not empty its selection once you have touched one, which is why the
  arming exists at all — so the tap WROTE to the cell still selected from the
  check before, and T10t measured a different section and found it unchanged.
  It reloads now, which is the state a person arrives in.
- **THE BANK'S PREVIEW IS THE CALLER'S BOX AND NOT THE PICTURE'S.**
  `ui/preview.js` writes an inline `inline-size: calc(--pv-base × bars)` on any
  cell longer than one bar — right for a chip in a 136px column, wrong for a
  full-width line, where a two-bar tune drew twice a one-bar tune and both were
  thumbnails against 250px of room. The bank writes `100%` on the same
  property, from the caller that owns the box: a stylesheet rule would lose to
  preview.js's own inline style and an `!important` to win it would be the
  second owner of one geometry. And the picture is asserted as a DIFFERENCE
  rather than a presence — measured on Kingston 1969, ten cells, ten distinct
  step arrays, **seven distinct pictures** (two tunes with the same rhythm
  inside one of eight levels draw the same 28px shape) — because a bank that
  drew one preview ten times would pass "every row has a picture".
- **TWO GATES WERE RED FOR ONE MISSING HALF OF A WALK, AND NEITHER RED WAS
  ABOUT ITS SUBJECT.** `test/selects.js` had five since v272 — *"every control
  Paul named is a combo box"* naming meter, swing, groove, mode, scale, harmony
  and the changes grid's quality — and the cause was that its census walks
  `__eightTabs()`, which stopped containing `Time` and `Rules` the round they
  became rows. The controls never moved; the walk did. It walks the four rows
  now (and so does the phone pass, which had found **0 addressed controls
  across 6 tabs**, and which now re-opens each menu's own surface before
  driving it, because a menu that is not on the screen is not a menu that
  failed to commit). `nukernel/desk-gate.js`'s two were the same shape one
  round further on: `bus|genre|fx1..3` were asserted MISSING by a query written
  as `#rack select[data-k]` and simultaneously reported as EXTRA by a walk that
  collects `data-sel` — one control, in one list and not the other, because
  v272 gave a seat to `src/menus/` and it started wearing the other address.
  `BUSSEAT` had been written at the top of that file waiting for it. **167 of
  167 now, and 71 of 71.**

**WHAT THE CHIP'S REASON IS ALLOWED TO LOOK LIKE, SETTLED.** §10c left the fork
open (*"either the chip appends its reason like its two siblings, or R5a's
`said` clause learns the third widget"*) and §10d took the first branch for
`rules-view`. Walking the rules row put the same question to `selects` check 5,
and the answer is that a chip has TWO honest places: its OWN why is the
`<small class="nu-why">` line inside the button, and a WHOLE-STRIP refusal is
printed once under the control by `menu()` — measured on the shipped chant,
`rule-add|Form` is a single chip refused whole with *"every rule this axis has
is already on the record"*. Demanding the strip's sentence inside each of four
chips would be demanding the same sentence four times on one line. The LAW is
asked of the text either way; the SPELLING (`", " + why`) is asked only of the
two widgets that have one.

**THE FOURTEEN TRANSFORMS ARE A DATED REVERSAL AND THE THIRD SURFACE FOR ONE
ADDRESS.** Paul, 2026-08-28: *"When I'm in a motif, the motif operations should
be the right nav elements on the view."* There is no nav to be an element of
(§10a deletes it) and the surface they rewrite has the pane's full width now,
so they are one line at the foot of the opened motif's sheet — where they stood
until 2026-08-28 and where the note that took them away said they belonged
(*"under the tune they rewrite"*). `motifop-<word>` and `motiftime-<word>` have
now been on three surfaces without moving, which is the journey
`boardtab|<kind>|<key>` made a round ago.

**GATES.** `test/table.browser.js` **T10q–T10w** (the bank is drawn at 320 and
390 — a row per cell in the record's own order, a picture, a 44px name, an
`open`, the two adders, no sideways page scroll; every row wears one of
document.js's three provenance words and the pictures are not one drawing
repeated; tapping a name points the SELECTED cell, measured in the document AND
in `__eightEvents`' rendered bar; with no cell selected it arms and the next
cell tapped is the one that gets it; the row's lamp is a `[data-live]` sibling
with no control in it and names a motif of this record's own bank while it
plays; the Motifs PANE is gone and the editor is drawn once, a bench per
measure; PRODUCE is a merged row of the footer under the master at the pane's
width, its face is the producer's own line, its sheet is the panel drawn once,
a subject chosen in it offers the producer's own adjectives, and the Produce
PANE is gone) — **187 ok, 0 failed**, T4–T9 and T10a–T10p unmoved except two
counts that are facts about this round (`tfoot tr` is four, `thead > tr` is
four) and T10b's stack, which is asserted as a WALK now so the next special row
does not need it edited. `test/table-inventory.json` grew **twenty-three rows**
measured off `#pan-motif` and `#produce` BEFORE the deletion (the nine control
families of the pane, the fourteen transforms, the `motiftab-<name>` rows, the
two tabs, the producer's four) under two new homes, `motifs-row` and
`motif-sheet` and `produce-row`; `tray-new`'s *"elsewhere: Motifs"* home came
back inside the table with it. T7 learned two substitutions measured off the
RECORD rather than named (`<motif>` is the cell the most chairs read, so
`fork|<cell>|<voice>` has a subject on any record; `<forker>` is its first
reader) and one exemption with its owner written down: the BENCH's step row is
52px and `test/bench.test.js` B3 owns that claim, so the three kind buttons and
two bars inside it carry a `floor` of 40 and 30 — the numbers they had in the
pane this walk inherited them from — rather than a second 44px demand
contradicting B3 about a geometry this round did not touch.
Re-pointed, each in a line or two, each still making every claim it made:
`test/bench.test.js` (**PASS** — one door, `openMotif`, is `__eightRow("motifs")`
then the bank row's own `open`; `+ drum pattern` is reached through `← the
bank`), `test/motif-frozen.js` (**PASS** — "standing on Motif" is the row and
one motif; `#staff` never moved), `test/shell.js` (**PASS** — `PAULS_TABS` is
six words, A6j walks the two branches the tree has left, A6k drives `Score` and
`Band`), `test/text-diet.test.js` (**PASS** — "Motifs" and "The producer" leave
the panel-headings list the way "The board" left it a round ago; both `<h2>`s
are still drawn, still announced, still skipped by the diet).
`test/selects.js` **71 of 71** and `nukernel/desk-gate.js` **167 of 167**, both
for the first time since v272.

**FIVE GATES OUTSIDE THE RELEASE PATH ARE RE-POINTED TOO, AND ONE RED IS LEFT
HONEST.** `test/gutter.js` (**47**, its typed tab list replaced by
`__eightTabs()` — which had already drifted, `Mix` having been gone a round —
and its "longest state" measured on the Band branch: 1234px of a 560px list at
390), `test/producer.browser.js` (**35**), `test/seed.js` (**36**),
`test/atlas.js` (**111**, its heading count MEASURED down from four to one:
Time and Harmony left with the TIME row and Motifs with this one, so the Band
panel answers `["The band"]`), `test/nav-tree.js` (**27 of 28**). Its N9 is the second
reading of this round's lamp, taken from the other end and by a different
hand: `#pan-band .nu-banklamp > i`, **one of ten lit** while the record plays,
each lit row carrying its own `readby|` strip, `--clock` red and dark again on
stop — which is the claim `lightMotifs` used to make on ten `motiftab-` rows of
the stripe, at the surface that replaced them. Two findings came out of that
walk and neither is this round's to fix:
  · **THE TREE IS EXACTLY TWO LEVELS DEEP NOW, EVERYWHERE.** `motifTrayItems`
    was the LAST depth-2 branch — the section ops left on 2026-09-05 (§9a) and
    the mix plates with step 3 — so N3's "a branch of actions" and N8's "three
    depths" both died with this round. N3 keeps its law at the transforms' new
    address; N8 counts the depths it finds rather than three named rows, so it
    reads a third the moment one exists.
  · **THE OUTSTANDING RED IS `N8 390 · the indent is not what clipped
    anything`, AND IT IS WAVE 2c's.** At 390 the gutter's word box is 67px
    against a 7px `--nu-indent`, and that one step of indent is what clips four
    SECTION labels (`groove 2`, `chorus 6`, `chorus 9`, `outro 13`) — and
    `notation` on the Score branch, which clips at 7px and fits at 6px, so it
    is not an artifact of which branch the gate now drives. The section rows
    entered the stripe in wave 2c and N8 never saw them because it always drove
    the Motifs branch. The fix is a decision about the 96px gutter's word box
    against the tap floor — the same arithmetic `gutter.js` T10b owns — and it
    is deliberately not made in a round that deletes the tray two steps later
    (§10b step 7). Green at 1280.

**AND ONE SELECTOR BROKE BECAUSE A PANE BECAME A `<td>`.**
`test/producer.browser.js` read `t.querySelectorAll("td button")` on the
producer's note table; a descendant selector is matched against the WHOLE
document and only then filtered to the root, so `td button` means "a button
with any `<td>` ancestor" — and the producer's sheet is inside a `<td>` of the
Band table now, which made `note|0` (in the row's own `<th>`, unmoved) start
matching. `:scope td button`. `ui/produce.js` is untouched, and this is the
shape to expect from every remaining pane deletion.

**THE PAGE DOORS THIS ROUND ADDED, AND THEY ARE ALL HANDS.** `__eightMotif(name)`
opens the row and then that motif (`null` goes back to the bank), idempotent
like `__eightRow` and `__eightMix`; `__eightBank()` is the bank's names in
order; `__eightMotifNow()` is which one is open. The share-link fragment kept
its meaning without keeping its slot: `subNow()` no longer answers `Motifs`,
and `applySub` under `Band` tries the voice names first and then the motif
names — a player and a motif cannot share a name (one is `voices[].name`, the
other a key of `material.cells`), so asking in order is unambiguous and a link
somebody sent from inside `psalm` still opens standing in `psalm`.

## 11 · The design system: ours, less chunky, with an envelope editor (RULED 2026-09-05)

Paul, after the AUX spike (GPL-3.0-or-later, 93 KB core + a fader at 171 KB,
no ADSR widget, double-tap reset dead on touch — scratchpad/aux-spike): *"Don't
do aux. keep our stuff but make it less chunky and more stylish. Make an Adsr
and envelope editor though and use that for samples etc."* Earlier: *"less
boxes inside the cells and more of the cells just being cells"* / *"Popping
things up to be tappable is good"*.

- OUR CONTROLS STAY: the detents with a hole (absence), the refusals with
  their sentence, the scheduled/measured colours, the chips, the die, play/
  stop, the insert slots, the menus. The RESTYLE is a pass over nu.css and
  the components: thinner rules (the border is a hairline, not a frame),
  smaller radii, a typographic hierarchy that carries the weight boxes used
  to, fewer plates, quiet inherited / bold written, the 44px tap height kept
  everywhere, controls a hair bigger than their words; measured before and
  after (glyph-to-box ratio, ink per control, rows per screen at 390).
- A CELL IS A CELL: plain text at rest, the control pops up in the cell on
  select or edit, the formula bar mirrors it (§11a the typed editor).
- THE ENVELOPE EDITOR, ours: `nukernel/src/envelope/` → `nukernel/ui/
  envelope.js`, a Lit component drawing an ADSR (and a general breakpoint
  envelope for the modulation lanes) as a plate with 44px handles, a real
  curve between them, drag by thumb (`touch-action: none`), arrows and
  Home/End on a focused handle, a long-press or a clear-back for reset, the
  values printed beside the handles in the field's own units. One owner for
  every envelope on the page: the chair sheets' attack/decay/sustain/release
  (knobs.js rows today), the SAMPLED chairs (the sampler lane gains an ADSR
  it applies per note — measured to arrive), the synth blocks' `fenv`, and
  the section/cell automation lanes as breakpoint curves.
- THE GRAPHICAL EDITORS, one family (Paul: *"Look for places where UX could
  help like eq editors too"*): the envelope editor is the first of a plate-
  handles-curve family that owns every control the page types as numbers
  today but a hand would rather draw — the audit before the round lists
  each: the per-voice EQ (lo/mid/hi shelves, the desk's FAM_EQ and the seat
  eq) and the master tilt as an EQ CURVE with draggable bands; cutoff and
  resonance as an XY pad; the tempo map and rubato as a curve over bars;
  the section and cell automation lanes as breakpoint curves; pan and width
  as a stereo field; the kit's velocity lanes stay a grid. Each replaces its
  number rows only where the drawing is the honest control (a shelf is a
  curve; a bar count is a number), and prints the numbers beside the curve.
- Order after §10: cells as cells at rest (~10 lines) → the envelope editor
  and its wiring (samples first) → the EQ curve and the XY pad → the in-cell
  typed editor + synonyms → the restyle pass over the rest.

### 11a · The in-cell editor: type, and the options filter semantically

Paul: *"I think what I want is to type into the cell and the options get
filtered for me in a smart semantic way."*

- Select a cell and TYPE (a spreadsheet's own gesture): the cell becomes a
  single-line editor; the CANDIDATES dock in the formula bar ABOVE the grid
  — never a listbox under the cell, which is where the v272 measurement
  found the keyboard covering it — ranked, the top match highlighted;
  Enter or a tap on it commits, Escape restores; Tab commits and moves.
- RANKING, from the vocabulary itself, nothing fetched: 1 prefix of the
  word · 2 substring · 3 a hit in the word's own sentence (fields.js
  descriptions and `why`, the kit ops' "what a drummer does", the genres'
  plates and aliases from wiki.js) · 4 a synonym table (`nukernel/src/
  menus/synonyms.ts`, one owner; e.g. dark → darker · minor · aeolian · the
  low shelf; slow → half pace · a longer release · ballad; bright → brighter
  · major · lydian) · 5 the rest in vocabulary order. Numbers (bpm, a
  register, a bar count) are typed as numbers and clamped by the field.
- A vocabulary of ≤ 8 words shows the whole list as candidates before any
  typing, so a tap alone still works; on a phone the editor is the same
  input and the candidates row is what a thumb reaches.
- One owner for the editor across the grid and the special rows'
  sheets: the menus module (§9c step 2) grows it; chips, the native picker
  and the typed combo remain what a control shows when it is not the
  selected cell.
