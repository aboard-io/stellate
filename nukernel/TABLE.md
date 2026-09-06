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
    │ RULES     the rule chips, expandable           │     screensaver · export)
    │ TIME      bpm · tempo map · key · meter        │
    │ CHORDS    the chain the record plays           │
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

- **Special rows** are rows of the same sheet: RULES, TIME, CHORDS, PRODUCE
  are
  record-level and MERGED across the columns, expandable, chips inside; MIX
  is ALIGNED — one channel strip per voice column and the master in the
  corner; MOTIFS is the bank across the top with previews and provenance,
  and tapping a motif points the SELECTED cell at it (the formula bar's own
  write). Sections keep their row overrides (key, swing, chain) as today.
  (The order above is §13f's, 2026-09-05: *"Put rules above time"* and
  *"Add chords below time and move chord stuff into it"*. It read TIME ·
  RULES · MOTIFS from 2026-09-06 to then.)
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
as the atlas deals it`. The sheet opened where a column head's has always
opened, at the top of `<tbody>` — **AND THAT WAS WRONG, MEASURED BY PAUL ON
v284: *"When I click time and rules they show up under phrases."*** It is
right for a column head, which has no row of its own; a special row HAS one,
three rows and a set of column heads above the body, so TIME's editor opened
four rows away from the word that opened it. **THE SHEET IS THAT ROW'S OWN
NEXT LINE** — a `<tr class="nu-wopen nu-spopen">` of the `<thead>`,
immediately after its own row (DESIGN.md §2.3 *"expanded = its sheet"*, §2.4
*"in flow, never a modal"*: nothing may stand between a row and its sheet).
The rows BELOW the tapped one move under the editor and `stick()` releases
their pins, which is §2.3's other clause — a row *"pins under the rows ABOVE
it"* — read the only way it can be read when the editor is 4,700px tall: the
tapped row and the rows above it stay frozen (that is how you close the row
you are inside), and the ones below ride the scroll, holding a `sticky`
declaration with an `auto` offset. Measured at 390 and 1280: the editor's top
edge is 8.6px under the bottom edge of TIME, RULES or PHRASES — the 3px of
`border-spacing` plus the sheet row's own `--s2` — which is T12m.

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

### 10f · What steps 6 and 7 landed, and the six things they measured

**SHIPPED 2026-09-09 (uncommitted).** THE TRAY IS DELETED. `ui/eight.js` lost
`expanded` / `chain` / `setChain` / `treePath` / `expand` (the one open path),
`TABKIDS` and `TABSUB`, the five level builders (`rootTrayItems`,
`bandTrayItems`, `sectionTrayItems`, `scoreTrayItems`, and `playTrayItems`,
which came back as `playOptItems`), `trayNow`'s walk, `trayRow` / `paintTray` /
`paintDepth` / `tapNode`, `trayList` / `trayFoot` / `traySig` / `trayBtn`,
`lightSections`, `glyphOf`, and the three probes `__eightTray` / `__eightTree`
/ `__eightExpand` — and gained `MENUROWS`, `setMenu`, `chromeRow`,
`paintChrome`, `__eightMenu` and `__eightMenuOpen`. **15,380 lines → 14,554, a
net 826 down on about 1,300 deleted**, because the chrome that replaced 1,300
lines of tree is about 350. `nu.css` lost **41 rules and 640 lines** — `.nu-tray`,
`.nu-traylist`, `.nu-trayfoot`, `.nu-traycut`, `.nu-trayopts`, `.nu-trayvol`,
the four `[data-depth]` rules and their `--nu-indent`, the two `#nu-tray
.nu-ic` grids, the `@media (min-width: 900px)` type step, `.nu-tray
.is-sounding`, and `--tray-w` itself. `index.html` swapped one empty `<nav>`
for another: `#nu-tray` → `#nu-chrome`.

**THE BAR, IN THE MARKUP.** `#nu-bar` is fixed at the foot, `inset-inline: 0`,
`block-size: var(--bar-h)`, an opaque `--panel` plate with one rule on top.
Four things stand in it and Paul named three: the GENRE (`toptab-Where`, the
name plate the gutter's foot carried, at the same address, opening WHERE as a
sheet), the DIE AND ITS NUMBER (`.nu-seedrow`, unmoved, now carrying BOTH
countdowns), and PLAY/STOP last under a right thumb — with the VOICING between
the options' door and `#play`, which is the neighbour v263 gave it in the
column. `.nu-top` is fixed at the top corner: `#sheetclose` (hidden on the
table) then `#burger`. `#nu-menu` hangs from the ≡ with Score · Video ·
Screensaver · Export, a rule, and the log.

**THE PLAY OPTIONS ARE IN THE BAR AND NOT IN THE HAMBURGER**, which is the one
fork §10b left open ("opts becomes part of the hamburger or the bar, say
which"). `#playops` unfolds ABOVE its own door, which is what it did in the
gutter; its three children are a mode, a take and the room, and all three are
facts about THE NEXT PRESS OF ▶. The hamburger holds things you look at; the
bar holds the transport.

**SIX THINGS THE RENDERED PAGE SAID THAT THE PLAN DID NOT.**

- **`.nu-menu` WAS ALREADY SOMEBODY'S CLASS, AND ONE GATE SAID SO IN A
  SENTENCE THAT NAMED NEITHER.** ui/menus.js has drawn its chip strips as
  `nu-wchips nu-menu is-chips` since v272, so the hamburger's first draft —
  `.nu-menu { position: fixed; inset-block-start: … }` — turned every chip
  strip on the page into a plate at the top corner. What reported it was
  `test/table.browser.js` T7, from four rounds away, as **`SHORT prod.name
  265x28`**: one control in the PRODUCE row's sheet, measured 28px against the
  44 floor. The menu is addressed `#nu-menu` now — it had an id already — and
  the law is the file's own: one surface, one name.
- **A FIXED SHEET IS A SHEET OVER THE GROUND.** "A full-screen sheet over the
  table" reads like `position: fixed; inset: 0` with its own scroll, and it was
  built that way and driven. Three things went with it: `window.scrollY`
  stopped moving on four of the six surfaces, so `tabScroll` — the anchor law's
  whole substance (*"Stop scrolling when I touch the page in any way!"*) —
  remembered 0 for every one of them and `shell` A6e skipped at all four widths
  with "fewer than two scrollable tabs"; `putPanes`'s sideways restore was
  measuring a box that no longer scrolled; and NOTHING WAS BEHIND IT ANYWAY,
  because `showTab` has put `data-off` on every panel but the open one since
  2026-08-27. `data-sheet` stays — it is what the stylesheet and three gates
  read to know a panel is a sheet rather than the page — and what it declares
  is the one thing a sheet owes: it fills the screen it opened over.
- **A FROZEN HEAD PINS INSIDE ITS PANE, NOT INSIDE THE VIEWPORT.** The obvious
  reading of a 44px plate at the top corner is that `grid.ts stick()` should
  start its stack under it. Built, driven, wrong: `.nu-pane` is `overflow-x:
  auto`, which computes `overflow-y` to `auto` as well, so the PANE is the
  scrollport those heads stick inside and the offset is measured from its own
  top edge. Starting at 55.19 pushed every head 55px DOWN its pane and left a
  white band above TIME at 320 and 390. The strip is reserved by `body`'s
  `padding-block-start: var(--top-h)` instead, which is where a fixed plate's
  room has always been paid on this page.
- **"NOTHING GOES UNDER IT" IS A DIFFERENT SENTENCE ABOUT A HORIZONTAL BAND.**
  shell A6i has swept every laid-out block against the gutter's rectangle since
  2026-08-28 and survived the gutter changing edges; turned ninety degrees it
  failed on `#app@55.2-1280.5` — a 1280px-tall column doing exactly what a
  scrolling page does. A vertical gutter is beside the page at every scroll; a
  foot bar is crossed by any page taller than the screen. What the law MEANS
  about a foot bar is that the page RESERVES the room, so the sweep runs at
  `scrollY = max` for the bar's band and at `scrollY = 0` for the top strip's,
  which is where each band's claim is decidable.
- **THE HEIGHT HAS TO BE THE TOKEN, NOT WHAT THE CONTENT COMES TO.** `body`'s
  `padding-block-end` is arithmetic on `--bar-h`, so a bar a pixel taller than
  its own token is a pixel of page under the bar that nothing would report.
  Measured, the row's tallest control renders **45.18px** against the 44 floor
  and the bar came to **51.38 against a token of 50.39**; `block-size` and not
  `min-block-size`, and the difference is spent inside the padding where a
  transparent button has nothing to clip.
- **A PANEL THAT IS THE FRONT DOOR CANNOT BE HIDDEN AT BOOT WITHOUT LOSING ITS
  YEAR.** WHERE is a sheet now, so for the first time the page can be standing
  somewhere else when a hand asks for the globe. The genre list IS the time
  instrument (Paul, 2026-08-29: *"Make the genre list permanent and always
  expanded. As I slide it light up the map with places"*), so the year is read
  off the list's own `scrollTop` — and a `display: none` scroller comes back at
  0. `#atlasIndex`'s ResizeObserver fires the moment the panel acquires a size
  and sweeps, BY DESIGN (ui/atlas.js says so at the observer); on a list at its
  top it answered the first row. Driven on `#at=Kingston&y=1969`, the sentence
  came back ***"600 · 1 record within ten years · Rome"*** over a record that is
  Kingston 1969, with every mark outside that decade `display: none` —
  including the one `test/seed.js` S6d then tried to tap. `showTab` tells the
  atlas it is back on the page (`ATLAS.showing(DOC.basis)`), the Score deck's
  own idiom — AND IT IS SAID AFTER THE OBSERVER, not before it: called inline
  it was overwritten by the sweep that followed and answered "600 · Rome" a
  second time, so it is two `requestAnimationFrame`s out, on the far side of
  the frame the panel acquires its size in.

**THE LAMPS ARE ON THE HEADERS, AND `setSounding` IS THE ONE WRITER.** §10a:
*"the playing section's row head and the sounding players' column heads
light"*. The column heads' lamp is `lampFor`'s `<i>` inside a `[data-live]`
sibling of the button and always was (wave 2b); what changed is that
`setSounding` — which wrote a CLASS and an `aria-current` on a gutter button —
is now the one writer of every lamp on the page, and it writes CHILDREN only.
That is a law and not a taste: `__eightFrozen` parks a live element's CHILDREN
and keeps its ATTRIBUTES, so a class or an `aria-current` written on the live
span would land in the frozen snapshot and test/motif-frozen.js would have it
inside the hour. `lightSections` is DELETED — its only targets were the
stripe's `secnav<id>` rows, and §10a's *"the playing section's row head"* is
`markForm`, which has lit that head's own `[data-live="count"]` span with a
`<mark>` off the same `d.si` since wave 2b. A second lamp there would be a
second owner of one fact.

**THE ADDRESSES DID NOT MOVE, AGAIN.** `toptab-Where` is the bar's plate,
`toptab-Score` / `-Video` / `-Screensaver` / `-Export` are the hamburger's
rows, `logger` is its last, and `deck.view.not` / `deck.view.roll` are back
inside the Score sheet's own row — the third address on this page to travel
without changing, after `boardtab|<kind>|<key>` and `motifop-<word>`.
`__eightTabs()` still answers the six SURFACES (a gate walks them to visit a
pane, and `test/table.browser.js` asks it four times whether a deleted tab is
gone), and `__eightMenu()` is the new reading for what the hamburger LISTS —
the two are different questions and it is the second that this round added.
`__eightUp()` is a shim for the third time: it was the ↑ pressed to the root,
then "fold everything", and it is "close the sheet and shut the menu" now,
still answering `"root"` to its nine callers.

**GATES.** `test/gutter.js` **51 of 51** — T1 keeps the `<h1>` half and hands
the bar's shape to T3; T2 walks `#play` over all six surfaces and is STRONGER
than it was (permanence is a geometry claim now, and `__eightTray`/`__eightTree`
/`__eightExpand` are asserted `undefined` so no retired check can go green
against a shim); T3 replaces "five controls and no sixth" with the bar's real
inventory, asserted exactly, and reads `--bar-h` where it read `--tray-w`; T4's
touch law is driven in `.nu-baropts`; T5/T6/T7 open WHERE by clicking the bar's
own genre plate; T9 is the die in the bar with the fold having lost it; T10 asks
the label law of `#nu-chrome` and the floor in BOTH axes; T10b is retired with a
tombstone carrying the 96px column's arithmetic, and nav-tree's outstanding N8
red with it; T11 unchanged, and `shorten()` deletes its section through
`trow|<id>` instead of the stripe's jump. `test/shell.js` **PASS, 378 ok, 0 failed** at 320/375/430/820. A6 is the bar
swept down every surface's whole height (fixed at the foot, full width, x=0, at
eleven stops); A6b is "ONE ROW, never scrolls sideways", counted as distinct
button TOPS the way the stripe counted lefts; A6c is amended by one word and
the amendment is the point — **AT MOST one `<mark>`**, because the table is not
a place you opened and standing on it is the state in which nothing is marked;
A6d/A6g read the hamburger's four in `TABS`' own order and the genre plate in
the BAR; A6i is the two-pass sweep above; A6j is the absence of the whole
apparatus PLUS a driven round trip through each of the four viewers; A6k is
RETIRED with its reason (it asserted one open PATH in a tree, and what it
protected is A6j's count of exactly one `[data-sheet]`); A6l survives whole and
is driven from the table's own heads. A7 is `--bar-h` again, which is the name
it had before the gutter took it. `test/seed.js` **ALL PASS (36)**.
`test/table.browser.js` **192 ok, 0 failed** and grew **T10x** — nav-tree's N6, moved: every column head
carries a `[data-live]` lamp as a sibling of its button, a player's head lights
within 25 s of `#play`, the chrome's `<mark>` count is unmoved by it, the
sounding section's row head wears `markForm`'s one `<mark>`, and every lamp
goes out on stop — and T7 grew **`INV.chrome`, eighteen rows** under two homes
outside the table, `bar` and `hamburger`, which is T7's nothing-lost law asked
of the gutter itself — **163 controls checked at 320px**, of which eighteen are
the deleted gutter's. **`test/nav-tree.js` IS RETIRED INTO A TOMBSTONE** that
says where each of its nine claims went and is unregistered in `test/all.js`;
its one outstanding red — *"N8 390 · the indent is not what clipped anything"*,
a 96px word box against a 7px `--nu-indent`, deferred on 2026-09-08 *"in a
round that deletes the tray two steps later"* — is answered by the deletion.
Eleven more gates were re-pointed in a line or two each (`selects`, `sheets`,
`knobs`, `samples.browser`, `loopstrip.browser`, `mix-heads.browser`,
`vol-reach.browser`, `silence`, `text-diet`, `gutter`, `table.browser`), every
one of them because a stripe selector had no subject.

**AND THREE MORE THINGS THE GATES MEASURED AFTER THE FACT, EACH A REAL
DEFECT.** (1) `#nu-tray button, #boardtabs button, .nu-decktabs > button {
min-inline-size: var(--tap) }` was ONE RULE FOR THREE SURFACES and its first
selector went with the stripe — so the four marks Paul named ("genre, dice,
playstop along the bottom") kept their 44px HEIGHT and lost their 44px WIDTH:
measured **29.3 to 33.7 CSS px** at 320, 390 and 430, by `test/gutter.js` T10,
which asks the floor in both axes. `.nu-bar button` declares it now, and the
room was there — the six visible marks total 299.3px in a 304px row at 320.
(2) `expand()` WAS CALLED FROM TWO PLACES THAT WERE NOT THE TREE and would have
thrown `ReferenceError` on the reachable one: `panel-addcell` (the bank's "+
motif") opened the stripe on the cell it had just made, and `openSection` opened
it on the row. Both are one line of tombstone now; `motifTab` and `formSec` are
what the two surfaces actually read. (3) `prod.name` — the producer's own `<h3
class="nu-namebar">`, a READOUT with a `data-k` so T7 can find it — went SHORT
the moment the gutter left, and the measurement is the joke: at 320px the
content column was `320 − 96 = 224`, which WRAPPED the plate onto two lines
(185.2 × 48.5 against HEAD's stylesheet); with the column at its full 320 the
same plate is one line, **264.6 × 27.8**, and a heading failed a TAP floor by
having stopped being squeezed. It carries a `floor` and its reason in the
inventory, which is the discipline `test/bench.test.js` B3 got when it was named
the owner of the bench row's geometry.

**AND TWO FILES OUTSIDE THE TEST TREE FOLLOWED THE CHROME.** `ui/glyph.js`
`place()` — the hold-and-hover explainer — clamped its popover to the gutter's
inner rule and *"no longer knows which edge that is"*; it has a BLOCK axis now
as well as an inline one, because a popover explaining `#play` would otherwise
sit on the bar and cover the marks either side of the one it is about, which is
the identical failure one axis over. `audio/offline.js` seats the "a new
version is ready" line after the page's navigation and asks for it by id: this
line has followed the chrome through three shapes (`.nu-bar`, `#nu-tray`,
`#nu-chrome`) and remembers none of them.

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
- ICONS (Paul, 2026-09-05: *"No labels right now. When you redesign use
  more icons. Ideally the table is a large set of icons."*): the bar's marks
  stay icons with hidden labels and their explainers; a cell at rest shows
  its GLYPH first (ui/glyph.js, extended per vocabulary: parts, instrument
  families, kits, provenance, levels, the special rows' faces), the word
  only where no honest glyph exists, a number small beside its glyph;
  written/inherited as the glyph's weight or ink; every glyph keeps its
  `.nu-vh` word and `data-say`. The sheet at 390 reads as a grid of marks.
- DATA ENTRY (Paul, 2026-09-05: *"think sliders and other UI for data
  entry"*): a continuous number pops up as a SLIDER or the envelope's
  handles with the number printed and typeable beside it; chips stay for
  words; the typed editor (§11a) for long vocabularies.
- DISMISSAL (Paul: *"Don't dismiss things when I tap them to change values;
  dismiss them when I tap outside of them"*): every popped-up control — the
  in-cell picker, a chip strip, a slider, the envelope editor, a sheet —
  stays open across value taps and closes only on a tap outside it, Escape,
  or its own close; Enter commits without closing unless the control is
  single-valued and the spreadsheet law moves on. Gated.
- THINK LIKE A COMPOSER (Paul): the redesign's order of controls, its
  defaults and its words are a composer's — what a hand reaches for first
  at a desk, not what the data model lists first.
- THE FUNCTIONAL TEXT PASS (Paul: *"There's all this copy like 'the
  sections own' and so forth. Just call things 'default.' Rewrite it all to
  be familiar and app like. It's very random and claudeish right now."*):
  its own round after the envelope editor — every UI string (faces, chips,
  explainers, refusal sentences, sheet labels, the formula bar, the log)
  audited and rewritten in plain app language: "default" for an inherited
  or dealt value, verbs for actions, nouns for things, no narrative, no
  "the record's own", no "as the atlas dealt it"; a `test/copy.test.js`
  that reads every string the page prints and fails on the banned phrases
  and on any string over a length budget.
- Order after §10: cells as cells at rest (~10 lines) → the envelope editor
  and its wiring (samples first) → the EQ curve and the XY pad → the in-cell
  typed editor + synonyms → the restyle pass over the rest.

### 11a · The in-cell editor — DROPPED (Paul, 2026-09-05: *"Don't bother with
8, typed in cell. Instead just nicely structure each expanded interface as
proper software that's easy to scan and nicely grouped."*). The typed
semantic editor and the synonym table are not built. What replaces it:

### 11c · Every expanded interface is proper software

Each sheet, pop-up and special row's open face is STRUCTURED: fields in
GROUPS with a short heading (a composer's order, DESIGN.md §5 — for a
chair: Instrument · Envelope · Tone · Mix; for a section: Form · Time · Key
· Feel · Chain; for a cell: Phrase · Variation · Dynamics · Placement),
one row per field (label left, control right, the value printed, the
clear-back at the end), the groups separated by `--s5`, consistent widths,
nothing narrative, scannable in one pass at 390 and at 1280. The picker
for a long vocabulary stays the native/typed one from §9c step 2. The
restyle round (§11 order, last) does this pass over every surface.

### 11d · The lozenge field (DESIGN.md component 16)

For the long vocabularies — the drum ops, the qualities, the scales, the
transformations, the instruments — every option visible as a tight lozenge,
clustered semantically under small headings, one hue per cluster, the hot
ones filled, multi-select where the field allows it with the chain's order
kept. Built in the restyle round; the drums' does-sheet and the chord
quality picker are its first two surfaces.

### (former 11a, kept for the record)

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


### 11b · What the cells-as-cells round and the envelope editor landed, and the nine things they measured (2026-09-05)

**SHIPPED (uncommitted).** Two rounds and five rulings taken during them:
cells as cells at rest, the envelope editor and its wiring, the marks, the
sliders, the tap-outside law, the sticky heads, and DESIGN.md's own vocabulary
applied to every one of them. `nukernel/src/envelope/` →
`nukernel/ui/envelope.js` is the fourth committed-build entry
(`api.ts · plate.ts · adsr.ts · curve.ts · editor.ts · index.ts`).

**A CELL IS A CELL, AND THE NUMBERS.** Measured on Kingston 1969 at reading 1,
at 390 and at 1280, before and after (`scratchpad/cells/measure.cjs`, kept):

| | before | after |
|---|---|---|
| rule drawn by the 91 body cells | **18,200 px²** (200 px² a cell, around 580 px² of average ink) | **0** |
| a cell's own ground | `#FFFFFF` on every one | transparent on every one |
| WRITTEN | weight 500 | **700 = `--fw-label`** |
| inherited | weight 400, opacity .78 | unchanged — the quiet was already right |
| rows on screen at 390 | 9 of 13, mean row 64.7px | **unchanged** |
| taps to change one value | 1 (which also unfolded a 15-row accordion) | **1 to stand on it, 2 to edit** |
| cells / heads / seats wearing a MARK | 0 / 0 / 0 | **91 of 91 · 20 of 20 · 7 of 7**, each with its `.nu-vh` word and its `data-say` (91 of 91) |

The row height did not move and that is the point: the round buys INK, not
rows. `--tap` is the one thing a restyle may not spend, so 44 stays 44 and what
the frame carried is carried by weight instead.

**THE FIRST TAP OPENS NOTHING BUT THE RING.** Before it, one tap selected AND
unfolded the whole eighteen-field accordion — 15 sheet rows for a hand that
only wanted to see where it was standing. Now: tap once for the ring and the
formula bar's address; tap the SAME cell again, or press Enter, F2 or any
printable key, to edit; Escape restores and keeps the ring; Enter again commits
and stays; Tab and the arrows commit and MOVE, closing the editor rather than
dragging it along. (T9b · T9b2 · T9b3 · T9b4.)

**THE ENVELOPE EDITOR, AND WHAT A SAMPLED NOTE'S ENVELOPE WAS.** The sampled
lane was **A-H-R**: a note came in over `atk` (default 12 ms, floored at 3),
sat at full gain for its whole duration, and let go over `rel` (default 90 ms,
floored at 20) — `engine/faust/voices/sampler.js`, both play paths. Half of
what an envelope editor draws had nowhere to land, so the lane gained a DECAY
and a SUSTAIN: `envAt(i, hold)` in `mixPCM` (one envelope, called by all three
of its read loops — mellotron, granular, plain) and its AudioParam twin in
`SamplerLive.note`. Absent is today bit for bit: `shaped` is false unless a
decay AND a sustain under 1 are both present, and with it false `envAt` returns
exactly what the two lines it replaced returned. `state-engine.js samplerUnit`
stamps `dcy`/`sus` only where the recipe carries them; `live.js` and
`stream-renderer.js` carry them to both renderers; `audio/to-engine.js` grew
`toneRecipe.decay`/`.sustain` and taught `samplerVox` to read **a number as
well as a word** for `atk`/`rel` — the door the loop points have taken since
the sampling round, and no longer the only one.

**WHAT IT REPLACED.** `avail.js sound.attack` and `sound.release` — four words
each, on the same `voice.sound.atk`/`.rel` the handles now write in seconds —
are gone from the chair's sheet, and the four amp-envelope rows of
`nukernel/knobs.js` (`attack · decay · sustain · release`) are skipped in
`knobsBlock` on any chair whose curve took them. Two controls on one address is
the shape `test/selects.js`'s own guard fails a page for. Nothing is lost: the
number prints beside its handle in the field's own units, and
`test/table-inventory.json` re-points both rows to `env|<voice>|attack` and
`env|<voice>|release` so T7 walks them at 320px.

**ONE COMPONENT, FOUR MODES** (DESIGN.md component 9): `curveEditor(host,
spec)` with `mode` = `adsr` · `lane` · `eq` · `xy`. Only ADSR is wired this
round; the lane is built and gated on a fixture; `eq` and `xy` are declared and
draw the lane until something writes through them. The shared half is
`plate.ts`: the plate's arithmetic, the 44px handle clamped inside it in BOTH
axes, the pointer capture, the keyboard (arrows · Home · End · Backspace), the
600 ms long-press reset, and `say()` — the printed value in the field's own
unit.

**THE MARKS** (Paul: *"Ideally the table is a large set of icons"*).
`ui/glyph.js` grew `GLYPH.cell` — `part` (nine), `prov` (three), `level` (six)
and `none` — and one resolver, `cellMark(kind, value)`, which answers NULL
where there is no honest glyph so the caller prints the word. `ui/eight.js`
holds the four doors that know which question a box of the table is asking
(`cellMark` · `colMark` · `rowMark` · `mixMark`); `src/table/grid.ts` draws
`ui/glyph.js`'s own three-part face by hand (the glyph `aria-hidden`, the
number, the `.nu-vh` word) with `data-say` on the button, because this table is
drawn by lit and `paintIcon` builds DOM. A motif keeps its NAME — it is a
proper noun and no picture says it — and wears its provenance as the mark.

**THE TAP-OUTSIDE LAW, AND WHAT IT COST TO GET WRONG.** Paul: *"Don't dismiss
things when I tap them to change values; dismiss them when I tap outside of
them."* The mechanism was the page's own: every write ends in `changed()` →
`push(); draw()`, which throws the table's panel away and builds it again, and
only the merged rows survived that — so a cell sheet SHUT UNDER THE THUMB, once
per chip, and a strip of words could be tapped exactly once. `STICKY` is now
every door but the CORNER (which must forget, because the transpose is reached
by opening it and a restoring tap would close it — §9d's fifteen red checks),
`sheet.ts`'s `write()` no longer closes the strip it was tapped in, and
`armOutside` closes on a press that lands on nothing pressable: not a button,
not a menu, not the sheet. Escape and the door's own head still close it.
(T9b5 · T9b6.)

**A NUMBER IS A SLIDER.** Paul: *"When you redesign think sliders and other UI
for data entry."* `numField` and `cellNum` — every quantity on this surface: a
register, a bar count, the bar a player comes in at, the take, the humanising —
declare `num { min, max, step, unit }`, and `sheet.ts pickerFor` answers
`slider`: the page's own `input[type=range]` (`--sl-trough`, `--sl-grab`, the
hand's fill) with a TYPEABLE number box beside it, both 44px, the box quiet
while nothing is written. Measured on the register: range 44px + box 44px,
`-4..3`, **0 chips** where there were eight. Words keep the chips. (T9b7 · T9b8.)

**THE STICKY HEADS, MEASURED (Paul: *"we should have sticky headers for
instruments and sections"*).** At 320, 390 and 1280, with the pane scrolled:

| | measured |
|---|---|
| SECTION heads (the row heads), 220px of horizontal pane scroll | **moved 1px** — sticky, and the 1 is `border-spacing` |
| the CORNER, same scroll | **moved 1px** once it was asked by name. `thead th:first-child` is TIME's merged row, not the corner, and reported "the corner slid 217px" about a `<th colspan>` that had not moved at all |
| the special rows' stack | **72 · 121 · 170**, column heads at **235** at 320/390 (127 · 176 · 225 / 290 at 1280) — three pinned lines, none sharing one |
| INSTRUMENT heads (the column heads), vertical | declared `sticky` and **the pane has 0px of vertical scroll to give** |

THE VERTICAL AXIS WAS A DECISION, NOT A BUG, AND IT WAS OPEN. `.nu-pane` sized
to its content and THE PAGE was the vertical scrollport, so the column heads'
own `position: sticky` had nothing to stick against going down: scroll the page
and the instruments left with it. Making them stick means making the pane the
vertical scrollport too — a height cap — and that puts an OPEN SHEET inside a
box that scrolls, which this page has a standing law against (*"menus never
scroll inside themselves … vertical space is cheap and abundant"*). One of the
two laws has to give and it is not a choice that round should make quietly.

### 11c · THE PANE IS THE SCROLLPORT (2026-09-05, and the law that gave)

**SHIPPED (uncommitted).** The decision above was taken: the pane scrolls on
both axes and the heads stick to it. WHICH LAW GAVE, and why it was the right
one — the standing law is about a MENU with its own little scrollbar, opened
over a page that could have shown it whole. A sheet on this table is a `<tr>`
IN FLOW inside the grid; it scrolls with the grid it belongs to, exactly as a
spreadsheet's expanded row does. What a hand must never do is scroll a box
inside a box, and here there is one box and it is the whole instrument.
DESIGN.md §2 component 2 (*"sticky on its axis at every width, the corner
pinned both ways"*) and §3 (*"the pane is the scrollport; heads stick"*) are
the spec this satisfies.

**THE CAP IS THE WRAP'S, NOT THE PANE'S**, and that is arithmetic. The brief
said "100dvh minus `--top-h` minus `--bar-h`"; the pane is not the only thing
between them. Measured at 320: the strip ends at 55.2 (`body`'s
`padding-block-start`), `.nu-pan` pays `--s4` above the wrap, `body` reserves
`calc(var(--bar-h) + var(--s3))` below for the foot bar, and the FORMULA BAR is
106px inside the wrap at phone width. Cap the pane alone and the formula bar
hands 106px of page scroll straight back. So `.nu-sheetwrap` takes the band,
the formula bar keeps its natural size inside it, and the pane is the flex
child (`min-block-size: 0` — without it a flex item's `auto` minimum is its
content and the cap does nothing at all) that takes what is left and scrolls.

**AND `stick()` WAS SUMMING HEIGHTS, WHICH IS NOT WHERE A ROW IS.** It read
`y += tr.height` — every row's height and none of the space between them, and
`.nu-trims` is `border-spacing: 3px`. It cost nothing while the pane had no
vertical scroll; the moment it did, measured at 390 on Kingston 1969: the head
rows stand at **4 · 53 · 102 · 167.1** in their own table and the sum said
**0 · 46 · 92 · 154.1**, so every head SNAPPED 13px up the first time a thumb
scrolled down. It measures now, with the pins RELEASED first (a stuck row
reports the pin, not its place, so reading them while held feeds the loop its
own last answer) — all inside one frame, nothing paints in between.

**MEASURED AFTER**, at 320 · 390 · 1280 on Kingston 1969, the pane scrolled 400
down and 220 across (T9s2–T9s5, and shell A4's exemption):

| | measured |
|---|---|
| the pane's vertical scroll | **1053 · 1053 · 1002 px** (it was 0) |
| INSTRUMENT heads over 400px down | **moved 0px**; the corner 0 |
| SECTION heads over 220px across | **moved 1px**; the corner 1 (`border-spacing`) |
| the special rows' stack | 72 · 121 · 170, column heads at 235 (127 · 176 · 225 / 290 at 1280) |
| the PAGE's own scroll on the Band sheet | **none, either way** — `scrollHeight === clientHeight` at all three |

**AND A LANDING STOPPED STEALING** (the same round, and it is T9b5's whole
red). `tab` and `formSec` are page STATE — which player you are on — and
`tablePanel` read them as an INSTRUCTION, so every rebuild re-issued the
arrival. §9d stopped it CLOSING the door it wanted; it went on STEALING every
other one. Measured: open a cell, open its strip of words, tap a chip, and the
reading came back `{"strips":0,"open":["tcol|line 6"],"rows":["cast.material|
line 6",…]}` — not a strip that closed, a sheet that was TAKEN. `landedOn`
remembers the door this panel last landed on; `openVoice` and `openSection`
re-arm it, so asking for the same player twice still opens their sheet.

**A LANDING ONLY LANDS.** `tablePanel` ends every rebuild by CLICKING the head
it wants open — the arrival door for the gutter, the atlas and a link — and
every door on this table is a TOGGLE. That was safe while a rebuild closed
everything; the moment a sheet survives its own write, the landing click CLOSED
it, once per write. Measured as "the sheet is open and its strip of words is
not", because `toggle` clears the open field on its way past. It only clicks
now when the door is not already open, which is §9d's sentence about the corner
said one scope wider.

**GATES.** `test/envelope.browser.js` is new and registered in `test/all.js`
as **`envelope`**, a wave-3 browser gate beside `loopstrip`, covering the
component's source, the two engine files the tail measurement is about, and the
bridge between them — **28 ok, 0 failed** at 390 and 320: the plate and its four
named handles, a real curve, every handle 44px and `role=slider` and INSIDE the
plate, the value printed in its own unit, a real CDP touch drag that writes a
number and does not move the page under the finger, the keyboard, both resets,
the modelled chair and the knob rows it took, no sideways scroll, the rendered
tail, and zero page errors. `test/table.browser.js` carries the round's other
claims — T5e (a resting cell has no box; written is `--fw-label`), T9b/T9b2
(the first tap opens nothing but the ring; the second edits), T9b3/T9b4
(Escape · Enter · a printable key · Tab), T9b5/T9b6 (a value tap does not
dismiss; a tap outside does), T9b7/T9b8 (a number is a slider that writes), and
T9s2–T9s4 (the sticky heads, measured on a scrolled pane at three widths) —
and `node tools/ui/build.js --check` and `npx tsc --noEmit` are green.

**AND EIGHT THINGS THE RENDERED PAGE SAID THAT THE PLAN DID NOT:**

- **`.nu-vh` IS ABSOLUTELY POSITIONED, AND IN A SCROLLING PANE IT TOOK THE
  WHOLE PAGE SIDEWAYS.** The hidden word is `position: absolute` with no
  offsets, so it lands at its static position inside the nearest POSITIONED
  ancestor — and an absolutely positioned box is not clipped by an ancestor
  that is merely `overflow: auto`. Everywhere this face was used before, that
  ancestor was near and nothing scrolled; put one in a cell nine columns to the
  right of a 294px pane and the hidden word sits at x≈900 against the initial
  containing block. MEASURED: `document.documentElement.scrollWidth` 320 → 547
  at a 320px viewport, on a table whose pane was clipping perfectly, with every
  visible thing inside it. Four gates went red at once and every one of them
  reported "the page scrolls sideways", which was true and said nothing about
  where. The fix is one word: `.nu-ic { position: relative }`.
- **A HANDLE INSET BY 0.6 OF ITS RADIUS OVERHANGS ITS PLATE.** The plate was
  inset by a full radius sideways and by 0.6 up and down, so the attack handle
  — which rides the peak — sat 8.8px above the plate's own box. The AUX spike
  measured exactly this on somebody else's chart; the gate reads every handle's
  rect against the plate's and said `false` on all four. A handle's centre
  lives in `[R, W−R] × [R, H−R]`.
- **A DRAG THAT RE-RENDERS DESTROYS THE ELEMENT IT IS DRAGGING.** lit builds a
  new `<button>` for every handle on every render, so the first `pointermove`
  replaced the very node holding the pointer capture, the browser released the
  capture with it, and the `pointerup` that ends the drag — the ONE document
  write in the whole gesture — landed on nothing. Measured: the handle followed
  the thumb to 1.95 s and the document still said nothing. The frames of a drag
  PATCH the DOM that is already there (`paintLive`: three attributes and one
  `d`); `draw()` is kept for the events that END one.
- **THE PRESS READS THE SONG, NOT THE DOCUMENT.** A gate that assigned
  `voice.sound.rel` and pressed got the same bytes twice — `ui/state.js`'s SONG
  is what `audio/plan.js compile()` reads, and the document becomes the song at
  `push()`. Written that way the measurement would have reported the engine
  dead on a wire that works. Every value the tail measurement uses now travels
  the way a thumb sends it: focus the chair's own release handle and press Home
  or End, which is one write through `spec.set` → `changed()` → `push()`.
- **A RESOLVER THAT ANSWERS NULL IS RIGHT; A CALLER THAT ASKS THE WRONG
  QUESTION IS THE BUG.** `cellMark(kind, value)` looks a value up inside a
  NAMED TABLE, and the empty cell's mark was written as a row rather than a
  table — so `cellMark("cell", "none")` asked for `GLYPH.cell.cell`, got
  undefined, and four cells rendered EMPTY: the em dash had been replaced by a
  glyph that resolved to null and a word the caller had already suppressed.
  One table per kind.
- **PROVENANCE IS A RECORD, NOT A WORD.** `material.prov[<motif>]` is
  `{ p, fp }` — the fingerprint is what makes `hand` derivable rather than
  stamped — and read whole it stringified to `[object Object]`, matched
  nothing, and left all 65 line cells with no mark while the 26 bass and drum
  cells drew theirs. The measurement said 26 of 91 and that is how it was
  found; it says 91 of 91 now.
- **A GATE THAT SCROLLS AND MEASURES IN ONE `evaluate` MEASURES A RECT IT HAS
  INVALIDATED** — and under the new tap-outside law that reads as a dead
  control. `scrollTo(0, 120)` left the release handle at y = 1427 on a 900px
  page (a chair's sheet is a long way down a record with a band in it), the CDP
  touch was dispatched a thousand pixels below the viewport, landed on nothing,
  and the sheet closed exactly as it is supposed to. The handle is scrolled
  into view in its own round trip now, and the page still has 2,186px of scroll
  under it so "it did not move under the finger" is still a claim about a page
  that could have moved.

### 11e · THE DESIGN PASS: what it measured, and what moved (2026-09-05)

**SHIPPED (uncommitted).** The last round of §11 — the restyle (§11 ¶2), the
structured sheets (§11c), the lozenge field (§11d), and the composer's order
audited over every one of them. Paul's five sentences are the whole brief:
*"keep our stuff but make it less chunky and more stylish"* · *"use more
icons. Ideally the table is a large set of icons"* · *"think sliders and other
UI for data entry"* · *"just nicely structure each expanded interface as proper
software that's easy to scan and nicely grouped"* · *"tight lozenges, organized
by color and clustered semantically … visibility into all of the options."*

**MEASURED FIRST, ON THE RENDERED PAGE**, at 320 · 390 · 1280 on Kingston 1969
at reading 1, per surface, before and after (`scratchpad/design/measure.cjs`
and `census.cjs`, kept). A PLATE is counted as a box with a border on all four
sides AND a ground of its own — DESIGN.md §2 names exactly two on this page
(the curve editor and the bar), so the rest were frames the type could have
carried. Border ink is `w·h − inner`, summed over every control of the surface.

| at 390 | before | after |
|---|---|---|
| the sheet at rest | 5,780 px² of border over 139 controls (**41.6 each**), **76 plates**, **9** rules over 1px | **1,958 px²** (**14.1 each**), **1 plate**, **0** thick rules |
| a cell sheet | **259.6 px²** a control, 47 plates, 15 rows in **0 groups** | **130.6**, 1 plate, 15 rows in **4 groups** (4 · 2 · 4 · 4) |
| a column sheet | **205.5**, 75 plates, 11 rows in 0 groups | **166.3**, 1 plate, 11 rows in **4 groups** (3 · 3 · 1 · 3) |
| a row sheet | **196.4**, 54 plates, 36 rows in 0 groups | **99.8**, 1 plate, 36 rows in **5 groups** (8 · 7 · 5 · 6 · 9) |
| the TIME row | 55 plates | **3** |
| the RULES row | 44 plates | **4** |
| the MOTIFS row | 44 plates | **9** (its read chips wear the player's hue) |
| the PRODUCE row | 47 plates | **1** |
| the MIX row | 45 plates | **14** — the desk's own strip, its detents and its fader cap, which are not this document's components |
| the hamburger | 76 plates | **2** |
| the drums' does sheet | **1 of 69 words on the glass** | **69 of 69** |
| the scale picker | **1 of 63** | **64 lozenges in 13 clusters** |
| the instrument picker | **1 of 147** | **147 in 13 clusters** |
| the bar | 10 marks, 7 with a glyph, 50.4px | unchanged — DESIGN.md §2.12 names it a plate |

The row height did not move and neither did `--tap`: 44 is still 44, which is
§11b's own sentence about what a restyle may not spend.

**WHAT THE CENSUS NAMED, WHICH IS WHY THE RESTYLE IS TWENTY RULES AND NOT
TWO HUNDRED.** The plates had five authors and the stylesheet says so beside
each: `th,td{ border: 1px solid var(--rule) }` (28 little frames at rest, plus
the table's own ground), the Enamel button face (`background: var(--panel)` +
an ink border + a 2px hard shadow), `select`, `.nu-colbtn.nu-vpaint` (seven
filled hue plates across the top), and `.nu-vsheet`'s own frame. The thick
rules had exactly one: `thead th{ border-block-end: var(--bw-hard) }`, nine
edges. Everything else on this surface was already a hairline.

**THE RESTYLE IS SCOPED TO `#pan-band` AND THE TWO PIECES OF CHROME DESIGN.md
NAMES**, and that is a reading of the document rather than caution: the atlas,
the globe, the screensaver and the deck are not DESIGN.md's components and are
not restyled by a document that does not describe them. Three fills survive
inside the scope because they are SEMANTIC and not decorative — `aria-pressed`
(the hand), the `.w-*` word paints on the mix row, and `--vpaint` (which
player) — and each is re-stated at the restyle's own specificity, because
`#pan-band .nu-opbtn` outranks `button[aria-pressed]` and a pressed chip that
lost its cobalt would be the state that matters most, deleted by a restyle.

**§11c · WHAT MOVED, AND WHY.** Every address is the one it had on v281; T7
walks the same inventory. What changed is the ORDER and the HEADINGS:

- **a cell — Phrase · Variation · Dynamics · Placement.** The four note words
  (articulation · octave · scale, and the time shift) came UP out of the tail
  to stand with the phrase, because they are what the notes ARE; a hand asking
  "what does this cell play" was reading four fields of mix automation first.
  `ramp limit` went to the variation it limits. The four mix lanes SPLIT —
  level, send and tone are dynamics, place is placement — which is the cut
  DESIGN.md §5 already makes for a chair ("its tone, then where it sits").
  `entry` and `register` came DOWN out of the third slot into placement,
  beside the pan and the time shift: when a part comes in and where it sits
  are one question asked four ways.
- **a section — Form · Time · Key · Feel · Chain.** `intro` and `outro` came
  up beside the repeat marks (they are form). The seven time words are one
  group now instead of three runs separated by the key and the chain. `level`
  and `dynamics` came down into Feel, because they are how it is PLAYED and
  not what it IS. `scale` went to Key and the rest of the row-tier note words
  to Feel. The lanes and the drawn lane stand at the end of Chain, under the
  six effects they automate.
- **a chair — Instrument · Envelope · Tone · Mix.** DESIGN.md §5 spells this
  one out and the order was already close; `register` and `entry` moved into
  Mix (where it sits), and the throat stands with the knob table it belongs to.
- **the TIME row — Tempo · Meter · Key · Chords.** Nothing moved but the board
  pointer, which stands last.

`--s5` between groups (measured 22px), one row per field, the label column in
the body weight and the value in the label weight — the reverse of a 700-weight
label beside a 500-weight value, which was the sheet telling you the question
was more important than the answer.

**AND THE FORMULA BAR MIRRORS THE CELL'S FIRST GROUP** (DESIGN.md §2.5: *"the
selected cell's vector as chips/values"*). §11c gives "vector" a shape at last:
a cell's vector is four groups and the first of them is what a spreadsheet's
bar holds — what this cell PLAYS. It is a READOUT and not a second control,
because every one of those fields already has exactly one, in the sheet under
the cell, at the address T7 walks.

**§11d · THE LOZENGE FIELD.** `nukernel/src/lozenge/` → `nukernel/ui/
lozenge.js` is the fifth committed-build entry (`api.ts · clusters.ts ·
field.ts · index.ts`). Every option visible at once as a `--r-pill` lozenge,
AS TALL AS ITS WORD WITH 44px AS THE FLOOR — padding and a minimum, and no
negative margin anywhere: it read *"~28px of glass in 44px of thumb (padding
out, negative margin back, so the row PITCH is 34)"* until Paul photographed
that on a phone (2026-09-05, *"the lozenges all overlap"*), where a 44px drawn
pill in a 34px pitch is ten pixels of every row crossing the row above it —
wrapping to the pane, clustered semantically under a heading with a count, ONE hue per
cluster from an eight-step palette that is its own (`--lz-h0..7`, and neither
the semantic four nor the voice six, because a cluster hue that collided with
either would say something it does not mean), the hot ones filled, multi-select
keeping an ordered chain, a 600 ms press printing the sentence — and a TAP on a
refused word printing it too, in the field's one say line, because a pill
carries a word and never a sentence (2026-09-05: *"you added sentences of text
to some of them"*) — a cluster
folding by its heading and the fold surviving the rebuild. It is the only
control on its fact: no native picker beside it and none of the combo chassis's
▾ over it. T12n in test/table.browser.js drives all four surfaces under iPhone
emulation at 390 and 320, which is where every one of those defects was: the
same field at 390 in a desktop page drew none of them.

**IT IS CHOSEN BY THE DATA AND NOT BY A LIST.** `src/menus/pick.ts` grew one
clause — a vocabulary whose words declare a `group` gets the field that draws
kinds — and the five vocabularies §11d names are exactly the five that already
carried one: the kernel's chord families (`avail.js QUALITIES`), `instruments.js
familyOf` (`instrOptions`), `genres-tables.js SCALEFAMILY`/`MODEFAMILY`
(`famOpts`), `model.ts groupsFor` (the drummer's six) and — measured, and not
predicted — the DEVELOPMENT words, whose seven families ("the subject" · "a
piece of it" · "moved in pitch" · "turned around" · "counterpoint" · "silence" ·
"one vector at a time") have been in avail.js the whole time with nothing on the
page drawing them.

**ONE BYTE OF DATA WAS BEING DROPPED, AND IT IS WHY NONE OF THIS WAS POSSIBLE
BEFORE.** `ui/eight.js wCell` maps avail.js's option records into the table's
own `Choice` and listed five keys — `v · w · off · why · quiet` — and not
`group`. So a forty-two-word quality picker arrived on this surface as a flat
list, and the rule "a long vocabulary gets the phone's own wheel" was the only
rule that could apply to it. One key added to one mapping.

**THE PICKER'S FOURTH ANSWER, AND THE ONE SURFACE THAT KEEPS THE THIRD.** The
chord quality INSIDE THE CHANGES GRID stays the native picker, and that is
`pick.ts`'s `tight` rule standing where it was measured: `alphabet.quality|bar0`
sits in a bar column **63 pixels wide**, and a lozenge field in 63px is the same
wall the eight stacked chips were. Everywhere a quality, a scale, a mode, an
instrument or a variation is asked as a SHEET FIELD — which is everywhere else —
it is a lozenge.

**FOUR GATES LEARNED THE FOURTH WIDGET, AND THREE OF THEM WERE ALREADY LYING
ABOUT IT.** `test/lib-combo.js` is the one driver every browser gate shares and
it knew three widgets; a gate that queried `.nu-wchip` on a field that had
become a lozenge returned an EMPTY LIST, which reads as "the control does
nothing" and is not the same claim as "the gate looked in the wrong place" —
the silent no-op that file's own header was written about. Measured: T8c said
*"none of 0 moved it"* about a `does` vocabulary every word of which was on the
glass; `test/sheets.js` said *"a pad greys 0 development words"*; `test/
selects.js` threw on `ul.nu-combolist` being null. All four read the address
and the `data-widget` now, never the tag.

**AND `ui/glyph.js` GREW `GLYPH.group`** (Paul: *"use more icons"*). The grid
was already 118 marks over 139 controls; a SHEET was none, and its group
headings are the thirteen things a hand scans. Sixteen marks, keyed by the
group's KEY and never by its printed word — which is the lesson that file's own
nine-tab table records the hard way — reaching the bundles through
`globalThis.NuGlyph` for `ui/copy.js`'s exact reason: the marks ship once.

**THE NEW GATE IS T12** in `test/table.browser.js`, ten checks at 320 · 390 ·
1280, every one read off the rendered box: every rule a hairline, a plate only
where DESIGN.md names one, the three group sets in the composer's order with
`--s5` between them and a mark on every heading, the scale picker drawn as a
lozenge field with all of its words on the glass in clustered hues, every
lozenge 44px in a pill, a tap that writes the document and dismisses nothing,
and no sideways scroll.

**TWO THINGS THE RENDERED PAGE SAID THAT THE PLAN DID NOT.**

- **A STICKY HEAD IS NOT OPAQUE BY ITSELF, AND IT WAS NEVER ABOVE THE SHEET.**
  The table carried `background: var(--panel)` and every `<th>` inherited an
  opaque ground by accident; the restyle took the table's plate off and the row
  sheet scrolled straight THROUGH the column heads — measured at 1280, "second
  ending / coda / to coda" printed over "stab lead vocal drone". A ground fixed
  half of it. The other half was older than this round: `.nu-vsheet` is
  `position: sticky` too (it rides the pane's horizontal scroll), two sticky
  boxes with no z-index paint in document order, and the sheet comes later — so
  it won, on v281 as well, and the accidental ground was all that had been
  hiding it. The heads are 2 and 5; the sheet is 0.
- **A GATE THAT QUERIES A CLASS IS ASSERTING ABOUT WHERE IT LOOKED.** Four
  gates drove `.nu-wchip` and reported an empty list as a dead control the day
  a field became a lozenge: T8c said *"none of 0 moved it"*, `test/sheets.js`
  said *"a pad greys 0 development words"*, `test/selects.js` threw on a null
  `ul.nu-combolist` and then set `.value` on a `<div>`. Each is the silent
  no-op `test/lib-combo.js`'s own header was written about, and the repair is
  that file's own: one driver, reading the ADDRESS and `data-widget`, never the
  tag. It knows four widgets now.

### 11f · THE EQ CURVE AND THE XY PAD (2026-09-05, the same round)

**SHIPPED (uncommitted).** §11's *"THE GRAPHICAL EDITORS, one family"* — the
two modes `src/envelope/api.ts` declared and left undrawn, *"named so the next
round is a wiring rather than a second component."* This is that round.
`nukernel/src/envelope/bands.ts` is new; nothing else about the component
moved.

**THE EQ CURVE.** The channel strip's three vertical `lo · mid · hi` sliders
are one plate with three shelf handles, pinned in x at the frequencies
`fields.js EQ_BANDS` actually builds (a 120 Hz low shelf, a 1 kHz peak at
q .9, a 7.2 kHz high shelf) and moving only in gain over ±12 dB at 0.5 — which
is `EQ_RANGE`, read off the control it replaced rather than invented, so the
plate cannot offer a gain the loader would trim. The curve drawn between them
is the RBJ magnitude of those biquads and not a picture of a filter.
**THE ADDRESSES DID NOT MOVE**: each handle wears `b|eqlo|<voice>`,
`b|eqmid|<voice>`, `b|eqhi|<voice>`, byte for byte.

**THE XY PAD.** Cutoff × resonance, one handle, on the ELEVEN modelled chairs
a census of `knobs.js` says carry both (`modeld tb303 supersaw pad_saw juno60
lead_fuzz oberheim ppg synclead bell bass_wobble` — ten spell it `res` and
tb303 spells it `resonance`, and the brackets differ per chair, so the pad
reads each row's own). X is logarithmic and the keyboard steps 1% of the
PLATE rather than one field-step, because `res` at 0.001 over 0–0.95 is 950
presses end to end and that is a pointer-only control. It draws NO response
curve: nothing on this page knows the chair's own filter law, and a curve off
an invented Q would be physics nobody measured.

**AND IT REACHES THE SOUND**, which is the half that matters on a branch whose
characteristic bug is a parameter that is declared, costed and arrives
nowhere. Every number below was written by driving the HANDLE — focus, then a
key — so it travelled `spec.set` → `changed()` → `push()` the way a thumb sends
it, and was read off the RENDERED path:

| claim | measured |
|---|---|
| a voice's EQ | `__nuMix().units.v0.strip` `{lo:0, mid:0, hi:12}` → `{lo:12, …}` → clear-back → `{lo:0, …}` |
| a chair's cutoff | 0.001265 RMS at 60 Hz → **0.063911 at 12 kHz (×50.5)** |
| a chair's resonance | cutoff held at 12 kHz: res 0 → 0.063911 · res 0.95 → 0.043606 |

**NOTHING WAS LOST AND NO INVENTORY MOVED**, and that is measured rather than
assumed: `b|eq*`, `cutoff#` and `res#` appear nowhere in
`test/table-inventory.json` (the probe walked Kingston 1969, whose chairs are
all sampled), so §11b's re-pointing had nothing to re-point. What replaces it
is stronger — a CENSUS check: the knob table, the ADSR curve and the pad
together are `modeld`'s whole twelve rows, 7 · 3 · 2, with nothing missing.

**THE MASTER TILT IS NOT A CURVE, AND THE REASON IS NOT ARRIVAL.** `tilt`
reaches the sound (`masterState` → the fx bus's `mtilt`). It fails §11's own
test — *"Each replaces its number rows only where the drawing is the honest
control"* — because it is not a number row: it is five words over `TILTS`
(`none · dark · warm · clear · bright`), which DESIGN.md component 10 gives to
the one menu owner. A plate with a draggable handle over a fact stored as five
words would click to positions it cannot name and print a number no save
contains. The argument, and the two lines that would change it (make `tilt` a
number in `fields.js` with the five words as detents — a spec change first,
with a migration for 139 shipped records), stand as a tombstone above
`PLATES.main` in `ui/engineer.js`.

**AND `test/envelope.browser.js` WAS ALREADY RED AT HEAD, 5 of 26**, for a
reason this round did not cause and did repair: the instrument picker moved
from a seated menu to a sheet cell whose control exists only after a tap, and
the gate reported *"the menu offers no modelled chair"* about a menu offering
eleven. It is 88 ok at 320 · 390 · 1280 now.

**GATES RUN** (against the working tree, `--page` at 127.0.0.1:8777):
`node tools/ui/build.js --check` ok 5 entries · `npx tsc --noEmit` clean ·
`table.browser` **PASSED, 237 ok** (T12 included) · `selects` **ALL PASS**
(71 checks) · `sheets` 1 of 31, and that one is IDENTICAL on v281 — measured,
by standing the baseline up on its own port and running the same gate against
it (`git archive HEAD` on :8778) · `copy` (node) 10 ok 0 failed · `copy.browser`
5 ok 1 failed, and its three residual strings are the SAME three v281 prints
(the rules row's native picker aria, and the deck's key line twice) ·
`shell` PASS, every assertion · `envelope` **PASSED, 88 ok** at three widths ·
`desk-gate` **167 of 167**, identical to its pre-change baseline · `knobs`
**ALL PASS, 100 checks**.

## 12 · The composer's asks (2026-09-05) — the music before the chrome

Paul: *"Don't we need the chord editor to handle duration of chords? It
must."* · *"The number of tempos is very low and quite confusing I should
be able to set any tempo at all like 21/17 you should let me choose
anything."* · *"I want to be able to do multiple operations in a motif at
once. Raise it a fifth and widen it. Now I can do but one."* · *"The number
of chords is very low where are my maj7 and my min11 and so forth?"* ·
*"Same with scales we have all kinds of tonalities in this system aren't we
missing a lot."* · *"Before you do the design pass review this as a genius
musicologist and beat the crap out of it. How can I compose with it?"* ·
*"How would Bach use it to write a fugue or someone write a new gamelan
piece or how would Schoenberg use it."*

In flight, two rounds: (a) chord DURATIONS (`prog: [{d, q, len}]`, len in
beats, absent = the bar), a full QUALITY vocabulary (triads, sixths,
sevenths, extensions to 13, added, altered, slash bass — one table in
genres-tables.js, the words derived), the SCALES the rows reach for (the
melodic- and harmonic-minor modes, pentatonics East and West, hexatonics,
octatonics, bebop, the maqam/dastgah families with their cents, the thaats);
(b) ANY TEMPO (a slider and a typed number, 20–400) and ANY METER
(numerator/denominator, 7/8, 21/17 — the kernel's step law for a
denominator that is not a power of two, the exports writing the signature),
and CHAINED motif operations (a chain of ops as one write, undone in one).
And the REVIEW: a musicologist drives the page through seven attempts (an
AABA standard, a house track, a string quartet, a piece of their own, a
Bach fugue, a new gamelan piece, a Schoenberg row) and names every wall;
its ten ranked items reorder what comes next, before the design pass.

### 12a · The review's verdict and the queue it sets (scratchpad/REVIEW.md, 2026-09-05)

*"It is the best arranger I have driven and it is not yet a composing
instrument — and the gap is almost entirely vocabulary, not engine."*
Note entry already exists and is good (16 steps a measure, note/hold/rest,
degree, velocity, any length); per-note dynamics exist. The ten, ranked:

1. A chord that is not a bar long — `beats` is dealt and dropped on purpose
   at precompose.js:1556; carry it; "split this bar". (in flight)
2. A chart as long as the form and per section — the 8-bar cap
   (eight.js:2038) → 32; a row's changes open the same grid. (in flight)
3. Chained development words — `does` holds one of 26 phrases; make it an
   ordered list; the kernel already folds lists. (in flight)
4. Sub-bar entry — `enters at bar` is Number.isInteger (document.js:1791):
   no pickup, no stretto, no answer on beat 3. NEXT.
5. Any tempo, any meter — 137.5 became 138; meter is three words; `metOf`
   already takes {steps, pulse}. (in flight)
6. Accent and articulation per note — the `acc` and `orn` step vectors
   exist and nobody writes them. NEXT.
7. A chromatic channel — the accidentals toggle was deleted, not built
   (eight.js:6995); a ±1 semitone flag per step. NEXT.
8. Independent phrase lengths per voice — document.js:110–117 forces one
   length on every line cell.
9. A form grammar — repeat, second ending, coda, upbeat.
10. A lane you can draw — a start and an end, not one offset (the curve
    editor's breakpoint mode).

Bugs found: "at the fifth" is transpose(4 degrees) — a tritone on the
diatonic, a minor seventh on the fugue row's pentatonic (in flight);
"inverted" truncates to eight notes (in flight); the gamelan kotekan's
complement is taken against the phrase as written, not against the other
chair; `harmony: emergent` renders byte-identically to modal (in flight).

Protect: the table as an address space; the record arriving full; the
seed; the genealogy; slendro as a real 1208-cent octave; the refusal
sentences ("the most honest interface I have reviewed").

The words (for the text pass): reads → plays · does → variation · motif →
phrase · word operator → transformation · chair → part · "the atlas dealt
it" → the generator picked it · period → phrase structure · pace → feel ·
shape → dynamics · motion → automation · breath → note-length limit ·
alphabet → scale · harmony: emergent → a sentence.

### 12b · Every item of the review, and copy that can be translated (2026-09-05)

Paul: *"Address every suggestion by the musicologist. Also look for ways to
simplify copy strings assuming they will eventually be translated."*

The review's ten and its bugs are all scheduled, in this order after the
in-flight rounds: (4) entries in BEATS — `cast.entry` and the cell's entry
take a beat fraction, precompose clamps by section length in beats, the
pickup and the stretto exist; (6) ACCENT and ARTICULATION per note — the
bench writes the `acc` step vector (a chip per step, or a long-press) and
an `orn`/articulation mark (staccato · tenuto · accent · slide) the kernel
already reads; (7) a CHROMATIC channel — a ±1 semitone flag per step on the
bench, printed as an accidental in the score; (8) INDEPENDENT phrase
lengths per voice (document.js:110–117); (9) a FORM grammar — repeat with
count, a second ending, a coda, an upbeat, said on the section row and
honoured by the walk, the score and the exports; (10) DRAWABLE lanes — the
curve editor's breakpoint mode on the cell's four mix lanes; the kotekan
complement taken against the OTHER chair's phrase (a `complementOf(chair)`
operator); `harmony: emergent` given a meaning or retired.

COPY THAT CAN BE TRANSLATED (the text pass grows one law): every string the
page prints lives in ONE catalogue, `nukernel/src/copy/strings.ts` → the
committed `nukernel/ui/copy.js`, keyed (`cell.default`, `op.transposeUp`,
`refuse.noArticle`…), read by `t(key, {n, unit, name})`; no sentence is
assembled from fragments in code (the produce.js refusal builder is the
case); placeholders for names, numbers and units, never concatenation;
plurals as separate keys; numbers and units formatted by one function;
no idiom, no puns, no possessives of the box; a chip ≤ 6 words, a
sentence ≤ 12; the glyph's `data-say` from the same catalogue. The gate
(`test/copy.test.js`) reads the rendered page and fails on any printed
string not in the catalogue, on the banned patterns, and on the budgets. A
second language is then a second file, nothing else.

### 12c · What items 8, 9 and 10 landed, and the seven things they measured (2026-09-05)

The review's last three, plus its three leftovers. Every claim below is a
gate in the tree, and every one of them is read off the RENDERED path —
`document.js scoreOf`, `ui/derive.js sectionEvents`/`songBars`,
`audio/desk.js deskUnits`, `ui/abc.js toScore` — never off the model alone.

**8 · INDEPENDENT PHRASE LENGTHS PER VOICE.** The invariant that every line
cell in one document is the same length is LIFTED (document.js `barsOf`'s
own paragraph). Each cell keeps its own length; the walk loops each on its
own period and the section's end cuts it. What the old law was protecting
was HARMONY, not time — `render` indexes the chord schedule by its loop
counter, so a 2-bar chair would take a chord twice as often as a 4-bar one
— and that is fixed at the one kernel site: `toGenre` stamps `cellBars`
(the longest cell, in bars) ONLY where the cells disagree, and `render`
divides its counter by it. **T4t:** two chairs on 2- and 4-bar phrases in a
4-bar section render 24 notes as two statements and 4 as one, both cut at
bar 4; a one-bar phrase alone walks [62,67,57,59] and beside a 4-bar chair
holds [62,62,62,62]. **Absent = byte-identical:** T2a/b/c green against
04d06e4 (479 anchors × 3 seeds; documents, compiled genres and events).
`test/precompose.test.js` G2 now says "the COMPOSER dealt N lengths" rather
than "the document has one".

**9 · A FORM GRAMMAR.** Four words on the section row — `repeat` (2..8),
`ending` (this section is the second ending of the one above), `coda` (the
last section, played once), `tocoda` (the jump) — and ONE walk,
`document.js formWalk`, that says what the record plays. **ONE BOX PER
SECTION, IN WRITTEN ORDER:** a repeat is a COUNT the walk plays
(`ui/derive.js songBars` pushes the box's own bars again), not a copy of
the section, because a dozen readers index SONG by section. The score stays
AS WRITTEN and prints the marks (`ui/abc.js opts.form`: `|:` `:|` `[1` `[2`
`!coda!` "To Coda", "x3"); the exports unroll honestly by construction
(`audio/plan.js:539` is `songBars`). **THE UPBEAT is the lead-in channel the
last round wrote a tombstone for:** a negative `entry` (to one bar,
`kernel.js ENTRY_LEAD`) starts the chair's loop a statement early,
`sectionEvents` hands back what falls before the section's zero as `lead`,
and `songBars` puts it in the previous box's last bar — or, on the first
box, in a lead-in bar the record grows. **T4u:** 4 bars ×2 = 7 played + a
1-bar second ending whose bar differs from the first ending's; the coda
plays last and the jump skips three sections; a lead-in bar with 2 notes at
step 12.03 of 16 and the record's first note at −3.97 steps, before beat 1.
**T10y** (browser): the row sheet offers all four, the repeat is a 48px
slider, and `repeat: 2` is one section in the document.

**10 · DRAWABLE LANES.** A cell's mix lane is a WORD or a CURVE
(`{points: [[bar, value]…]}`, fields.js `cellAutoClean`/`cellAutoLanes`),
and a SECTION may draw its own (`section.auto`, `{param, points, in:
"bars"}` — `audio/desk.js compileAuto` has appended `sec.auto` since it was
written and nothing wrote one). One component draws both: `src/envelope`'s
breakpoint mode, wired at last (`ui/eight.js cellLaneNode` / `rowLaneNode`),
44px handles, one write per settled gesture through `putCell` / `putRow`.
The desk evaluates the cell's curve through its OWN `laneAt` at the bar it
is standing in and ADDS it to the static word (¶A: cell + row + seat, each
once); the Live export carries it in the same `map` the static offset rode
in, so the file still holds row + cell in ONE breakpoint list —
`laneEvents` hands the map its time now, and a box whose cell draws a lane
and whose row draws none is given breakpoints at the drawn points' times.
**T4x:** a −6 → +6 dB line over four bars renders −6.00 → −3.00 → 0.00 →
+3.00 dB bar by bar (3.00 dB a bar) on ONE chair in ONE section, every other
chair and section unmoved, and the exported envelope ramps 0.501 → 1.995.

**THE KOTEKAN, AGAINST THE OTHER CHAIR.** `complementOf(chair)` is a
chair-aware MARKER the render loop resolves — it builds the other chair's
phrase for THIS BAR (its own word, its own period, its own entry offset)
and complements the gate against that, not against the phrase as written.
gamelan's second chair says `complementOf(0)`. **T4v:** shared onsets by bar
`[], [], [], []` against the review's `[], [1,7,10], [1,5,7,13,15],
[1,5,7,10,13,15]`.

**`harmony: "emergent"` — MEASURED AND KEPT.** 13 rows declare it; 11 render
byte-identically to `modal` as shipped, exactly as the review measured. It
is NOT retired, because the word has no CONSUMER on those rows rather than
no meaning: add one chair that voices chords and 8 of the 11 move at once
(fugue polychoral counterpoint serial isorhythm winchester francoflemish
georgian). The three that stay still (cologneschool contenanceangloise
tapemusic) do so because their own words never transpose. What it gets is
the sentence the review's copy table asked for, on the control
(`harmony.emergent.why`: "No part voices chords, so this sounds like
Modal. Add a pad."). **T4w** holds both halves.

**THE DYNAMICS REDS WERE THE GATE'S, NOT THE PAGE'S.** C0/C1 drove
`button[data-k^="form.env|"]`, which since the row sheets landed matches the
CELL (`form.env|s5`) *and every chip in the strip it opens*
(`form.env|s5|big`) — so the walk clicked chips as cells, and a chip click
WRITES: the record came out of the loop with `env: "big"` on all eight
sections, the opposite of what C0 arranges. A cell's key has one pipe, a
chip's has two. 24/24 green.

**Gates run:** `ui-build --check` · `tsc` · table.test 40/40 (T2 against
04d06e4) · table.browser 220 ok · bench · precompose · document 31/31 ·
dynamics 24/24 · smf-tempo 24/24 · als-page 23/23 · hook · genres-build
12/12. `test/table.test.js` grew `--only=<name>`, which runs one gate's body
in seconds while still standing the baseline worktree up.

### 12d · The two leftovers, closed (2026-09-05)

**`scoreOf` WINDOWS A SECTION NOW — and the first half of that is a bug
fix, not a feature.** The statement's events were cut only when a second
ending cut the statement short (`!w.cut || …`), so a record with no `ending`
in it — every record in the catalogue — was never cut at all; and the kit is
rendered over the GENRE's loop (`K.drums(lead, g, g.bars)`), so a section
shorter than that loop put the rest of the loop into the bars belonging to
the sections after it. **Measured on `reggae` seed 1: 2364 of 4915 events
(48%) sounded past the end of the section that emitted them, in all thirteen
sections** — si 0 is two bars and its drums ran to step 126 of a 32-step
section. `ui/derive.js sectionEvents` has always cut at the same place
(`evAll.filter(e => e.t >= from && e.t < to)`): the page windowed, the pure
compiler did not, and that was the whole of the difference. After: 2551
events, none past its own end.

**THE CUT LAW, IN ONE SENTENCE:** a statement ends at its own last bar and
never begins at its first — everything past its end is cut, a pickup before
its zero always rides with it, and in between only a bar the caller's window
leaves out is dropped. The two ends differ because past the end is always a
LOOP the kernel was asked for and the section is too short to hold (the kit
over the genre's bars; `K.render(ph, g, total)` counting `total` PHRASE
statements, which on a 2-bar cell is twice the section), while nothing loops
backwards, so a negative time is an anacrusis a hand wrote. The first draft
cut both ends and `test/table.test.js` caught it in three places — T4q and
T4u ("the pickup must sound BEFORE the section's own zero"), and T2d, whose
fixture was the real fault: `entry` counts CELLS and reggae's cell is two
bars, so its `entry: 2` on a four-bar section means "enters at bar four of
four", i.e. never. **Asked of the page, which is the only thing that answers
for the sound: `ui/derive.js sectionEvents` renders 0 notes for that chair at
`entry: 2` and 10 notes delayed by 32 steps at `entry: 1`** — so the check
had been reading the spill, and it now asks for one cell. Of the 2364 spilled
events, 1798 were line, 152 bass and 414 kit.

The window is the mechanism: `scoreOf(doc, GENRES, fleet, win)` takes
`{ from, to }` in PLAYED bars, `{ section: <index | id> }`, or the bare
index/id; absent is the whole record and is what every caller that has ever
called it gets, to the event. It renders only the statements the window
touches — one section of a thirteen-section reggae costs 10.5 ms against
131.7 ms for the record — and returns `{ bars, events, from, to, t0 }` with
the times still ABSOLUTE, so **the union over all sections is the whole
song, event for event** (`test/document.test.js` G8c–G8g). A repeated
section is several statements at one address and the window is all of them,
the short last one included. **T2c's baseline moves with this**, as the note
below said it would.

**THERE WAS NO SCORE VIEW TO WIRE IT TO, and that is worth writing down.**
`document.js scoreOf` has zero callers on the page: the Score deck engraves
through `ui/eight.js recordParts` → `scoreParts(si, 0, scoreLen(si))` →
`ui/abc.js toScore`, which is already per-section and already windows
(`sectionRender`'s own filter). The window is for the pure compiler's
callers — the gates, the CLI, an export — and the score deck needed nothing.

**A DRAWN LANE SNAPS TO THE METER, NOT TO THE SECTION'S LENGTH.** The note
below blamed `cellStepsOf`; it was wrong, and `ui/eight.js barBeats` says so
in its own comment ("the STEP does not move with it"). The real grid was
`src/envelope/curve.ts`'s `quantise(…, spec.span / 64)` — a sixty-fourth of
THE SECTION, so the quantum moved with how long the section was. **Measured:
on `reggae` (four-four, sixteen steps a bar) that is half a step in its
2-bar sections, one step in its 4-bar ones and TWO steps in its 8-bar ones —
three grids in one song, nine of thirteen sections wrong; on `nationalism`
(six-eight, twelve steps a bar) it is 0.38, 0.75 and 0.94 of a step, which
is no grid at all, in all eight.** `CurveSpec.grid` is the caller's own
answer and `ui/eight.js laneGrid` is `1 / K.metOf(DOC.time).steps` — one
step of the signature, in bars, the same number in every section (one meter
per record is band-kit's law). The span was already right (`sec.bars`).
`curve.ts` also stopped snapping x through `plate.ts quantise`, whose
`ceil(-log10(step)) + 1` decimal places store a point dropped on bar 2.5625
as 2.563 — off the grid it was just snapped to.

**L1/L2** in `test/envelope.browser.js` drive a real CDP touch on a seeded
middle handle of the section's own lane and read the x out of the DOCUMENT.
Five drags, each a different fraction of a step, on an 8-bar section and a
2-bar one. **Before:** 8 bars → `[4, 4.13, 4.13, 4.13, 4.25]` (three values
off any grid at all — `quantise`'s own rounding of 4.125 — and a smallest
move of 2.08 steps); 2 bars → `[1.031, 1.063, 1.125, 1.156, 1.188]`, half-
step grid. **After:** 8 bars → `[4.0625, 4.0625, 4.125, 4.125, 4.1875]` and
2 bars → `[1.0625, 1.0625, 1.125, 1.125, 1.1875]` — every x a whole meter
step, smallest move exactly one step, the same grid at both lengths. Two
things the gate had to learn and are written into it: `__eightDraw()` does
NOT rebuild an open row sheet's plate (the first probe dragged the pinned
end of a still-two-point lane), and a settled gesture rebuilds the surface,
so a second touch in the same run lands on a node being replaced and the
tap-outside law shuts the sheet — one drag per measurement, from a fresh
sheet.

**Also measured, and it changes what item 8 is worth today:** NO genre in
the catalogue has line cells of differing lengths — 0 of 479. Independent
phrase lengths are a freedom the record can take and no shipped row takes,
so "a lane over a section with mixed phrase lengths" is a hand-made case,
not a catalogue one.

### 12e · ANY METER, ANY TEMPO, THROUGH THE WHOLE PATH (2026-09-05)

Paul: *"it should all be possible."* A signature is two positive integers and
a tempo is a positive number, and the round before this one had made the
KERNEL count any of them while five stages downstream still refused, clamped,
or handed back a bar of the wrong length. Measured on twelve signatures —
4/4 · 3/4 · 7/8 · 5/4 · 11/16 · 13/12 · 21/17 · 3/2 · 15/9 · 1/1 · 9/8 ·
2/32 — against five tempos — 1 · 33.3 · 76 · 240 · 999 — and every stage was
asked for the same one number:

> **A bar of n/d at `bpm` lasts n × (240/d) seconds ÷ bpm. Exactly. Everywhere.**

**THE STEP LAW, IN ONE SENTENCE** (now the first line of `kernel.js`'s own
comment): *a step is the beat the denominator names — 1/d of a whole note —
halved as many times as fits inside a sixteenth, so a bar is always a WHOLE
number of steps, n × sub, whatever d is.*

| stage | before | after |
|---|---|---|
| kernel `meterRow` | any n/d, but two digits each and a silent clamp at 99: `101/113` came back as **four-four** | three digits, `K.METER_HI` = 999, the same wall the tempo wears; 101/113 is 101/113 |
| tempo fence (`fields.js`) | 20..400 — a musical opinion in the one place a hand cannot get past | **1..999**, a tenth at a time; the music's own 40..220 survives as `BPM_ROW_LO/HI` and the eight detents |
| the typed meter (`eight.js meterNode`) | slider AND typed field both 1..32: typing 33 silently returned 32 | the slider is a reach (1..32), the typed number is the wall (1..`K.METER_HI`) |
| the drum words (`chair.js`) | `stepWord` threw *"Cannot read properties of undefined"* on **every** metered record — the shipped waltzes included — because precompose stamps the KERNEL's row and only chair's two hand-written rows had `count`/`names` | both derive: the numerator IS the count, so one number lasts steps/num and the names are the numbers. 4/4, 3/4 and 6/8 come out byte-identical |
| the timeline | already right (`derive.js boxesOf`, units/steps) — and `kernel.js` credited it to `audio/plan.js meterTL`, **a function that does not exist** | the comment names the real owner |
| the staff (`ui/abc.js`) | `L:1/16` hard-coded: a 21/17 bar of 21 steps was written as 21 sixteenths and summed to **1.3125** whole notes where the signature says 1.2353 | `L:` is ONE STEP — 1/(d × spb/n) — which is 1/16 for every power-of-two denominator (byte-identical) and 1/17, 1/12, 1/9, 1/32 for the rest; a `%` line says the noteheads are the nearest drawn ones. `Q:` keeps its tenth (33.3 was rounded to 33) |
| the .mid (`export/smf.js`) | `stepsPerBar` was ROUNDED, and every page caller passes the bar's quarters: a 7/8 record's last note landed at **33.85 s** where the record puts it at 38.68 s (12.5% early, and 7/8 is not an exotic meter). 1 BPM implied **38.7 s** bars where it means 240 — 0x51 holds three bytes of microseconds and a 60 s quarter is not a number it has | the steps are not rounded; the written signature takes the NEAREST power of two and is halved (then the numerator doubled) until the tempo fits, with the tick length and the tempo scaled by the same factor — so 21/17 at 76 is written 21/16 at 80.75, 4/4 at 1 is written 4/1 at 4, and the bar a DAW draws lasts what the record says. A `0x01` text meta states the true signature and the true tempo |
| the .als (`export/als.js`) | the denominator was the nearest power of two AT OR BELOW: 13/12 was drawn as 13/8, half again too long | `pow2Near`, one owner shared with the .mid; the clip's own beats already carried the bar truth, and the clip NAME now states the true signature |

**AND THE SOUND, WHICH IS THE ONLY THING THAT ANSWERS FOR ANY OF IT.**
`test/meter.test.js` G1 feeds one bar through the real stream renderer with
the real WASM procs (pace-meter's own harness) and counts frames: a 21/17 bar
at 76 BPM renders **3.9010 s** where the signature says 3.9009 s, beside 4/4's
3.1579 and 7/8's 2.7632.

**THE GATE** is `test/meter.test.js` — 23 checks over the matrix, seven
stages, six seconds, registered in `test/all.js` as `meter` (wave 2).
Everything it asserts it reads off the artifact: the emitted ABC parsed by the
vendored abcjs, the emitted `.mid` parsed back out of its bytes, the emitted
`.als` scanned as XML, the PCM counted in frames.

**WHAT STAYS REFUSED, AND HONESTLY.** abcjs has no notehead for a
seventeenth (it warns `Duration not representable` and draws the nearest head
it has) and parses only single-digit tuplet numbers, so `(17:16:21` is not a
door; the durations are exact and the ABC says so in a comment. A bar-synced
DELAY is still clamped to the delay line's 1.9 s (`audio/desk.js`), so at 1
BPM a "one bar" delay is not a bar — an engine buffer, not a bar length, and
left alone. And a .mid numerator past 255 that cannot be halved into the byte
(999/1) draws short bar lines: the notes still land at the second the record
puts them, and the text meta says which of the two it kept rather than
claiming both.

## 13 · ONE SCROLL, ONE PIN (APPROVED 2026-09-05: *"The proposal is fine for now"*)

**THE COMPLAINT, VERBATIM**, with the iPhone screenshot of the Silence record
beside it: *"Please look at this mess and I can't really get to anything —
things don't scroll out of the way for me to focus it's all jammed up.
Propose an elegant redesign that keeps the verticality and the scrolling
interface."*

**WHAT THE SCREENSHOT MEASURED.** Not one bug: a budget. On an 844pt phone the
things that did not move were TIME, RULES and PHRASES as plates, a stray
MOTIF lamp under them, the column heads, the mix row, MASTER, PRODUCE, the
perform strip, the formula bar with its readout, four undo/redo/copy/paste
buttons, the floating ≡ and the bottom bar. The grid got what was left, about
200pt, and the section row inside it was three overlapping cells. Sideways,
three adders (`+ line · + bass · + drums`) took more width than the three
players they were offering to join, so the first player's head was cut to
"…he ntl" and every cell in the row piled onto the next. §11c made the pane
the scrollport and was right to; it then let everything around the pane stay
pinned, and pinning is the disease.

### 13a · The law

**Nothing is fixed but the bottom bar. A thing pins only while you are inside
it.** In full:

1. **One pin at a time.** The `.nu-bar` is the only `position: fixed` chrome
   on the sheet (the ≡ plate joins it as its last button; `.nu-top` goes, the
   × that closes a sheet is the sheet header's own). Inside the pane exactly
   one band may be stuck at any moment: the grid's column heads while a
   section row is under them and no sheet is open, OR the owner row of the
   open sheet. Never both. `stick()` already releases rows at and after
   `.nu-spopen`; it now releases the column heads for a CELL sheet too, and
   pins nothing in `<tfoot>` ever.
2. **Every special row is ONE LINE at rest** — TIME, RULES, MOTIFS, MIX,
   MASTER, PRODUCE, PERFORM (the row was PHRASES for a day; §13e): `var(--tap)`
   tall, the word left, the sentence or
   the count right, a hairline under. No plate, no tint, no chips or lozenges
   inline, no lamp on a second line (the MOTIF lamp draws inside the MOTIFS
   row's own line or not at all). The sentence is the one the row already
   says (`TIME  79 BPM · 4/4 · D natural minor`; `MOTIFS  3 motifs`;
   `PERFORM  push · phrasing · ornament`); it is truncated with an ellipsis,
   never wrapped.
3. **Tap a row and it pins as the HEADER of its own sheet.** The row sticks to
   the pane's top edge, the sheet opens in the next `<tr>` (§10c's placement,
   unchanged) and scrolls under it; the header carries the × at its right
   end. Tap the header, the ×, or outside the sheet to close (DESIGN §3: never
   under a finger that is changing a value), and the row drops back into the
   flow at its own place — the pane's scrollTop does not change on open or
   close (v287's T12n law, now for the row).
4. **The column heads pin only within the grid.** They stick while the grid
   is under the thumb and no sheet is open. The section column sticks left
   while players scroll sideways, as now (§11c's horizontal law stands:
   nothing scrolls sideways at the page level).
5. **Adders are a sheet, not columns.** The head row ends in ONE `+` cell,
   `var(--tap)` wide, and the grid ends in ONE `+` row, one line tall. Either
   opens the ADD sheet, whose body is the same `playerOffers`/`sectionOffer`
   lists the addbars render today (one owner, moved, not copied), as lozenges
   in the Cast's clusters (instruments.js `familyOf`). The three column widths
   the adders took go back to the players.
   **THE SHEET IS SUPERSEDED, THE SAME DAY (2026-09-05, §13e).** Paul used it:
   *"Don't pop up an interface when I add a section or a voice. Just add it."*
   The two `+` cells and their `var(--tap)` are exactly as this clause left
   them; what is deleted is the sheet behind them. Each `+` now CARRIES the
   address of the offer it fires and writes the record on the tap — read §13e
   for which offer, and why the bare `+` can pick one player kind without
   asking.
6. **The formula bar goes.** `.nu-formula` is deleted from `.nu-sheetwrap`.
   Its head — the ADDRESS of the selection, undo, redo, copy, paste — becomes
   the first line of the open CELL sheet (present only while a sheet is
   open); its READOUT was the sheet's own body all along. Undo and redo
   therefore live where the change was made. The `undoStack` and every write
   door are untouched: this moves a header, not a path. A long press on a cell
   offers copy/paste the way iOS does, through the same two ops.
7. **Cells are glyphs first, words when there is room.** A player column is
   never narrower than its glyph plus `--s2` each side, and never wider than
   the pane divided among the players present; the word (`.nu-cellword`)
   shows when the column measures ≥ 9ch and hides otherwise. Cells therefore
   never overlap at any width and the head is never cut mid-word: a head too
   long for its column shows the glyph and its first word.

### 13b · The budget this buys (the gate's own numbers)

At 390 × 844 under iPhone emulation (test-the-artifact law: `devices['iPhone
14']`, DPR 3, `isMobile`, `hasTouch`), on Kingston 1969 and on the Silence
record, T13 measures:

| | before (v287) | after (must hold) |
|---|---|---|
| fixed chrome, at rest | ≡ plate + formula bar + bar | **the bar alone**, ≤ 72pt + safe area |
| pinned bands inside the pane, at rest, grid under the thumb | 3 special rows + heads | **the heads alone** (≤ 1 × `--tap` + 3px) |
| pinned bands, a special sheet open | the whole stack | **the owner row alone** |
| pinned bands, a cell sheet open | the stack + formula bar | **none** (the sheet's own header line is in flow at its top) |
| pane height at rest | ~200pt | **≥ 844 − bar − safe area − 8** |
| overlapping cell pairs, Silence, section row | 3 of 3 | **0** |
| head text cut mid-word | "…he ntl" | **0 heads** |
| `scrollTop` across open/close of TIME, RULES, a cell | moved | **identical** |
| adders in the head row | 3 buttons, 22ch | **1 cell, `--tap`** |
| `<tfoot>` rows sticky | yes | **none** |

Plus T7's law re-proved on the rendered page: every control the formula bar,
the addbars and `.nu-top` offered is reachable in ≤ 2 taps from rest at 320
(`test/shell.js` is told where each moved; nothing is lost). The desktop is
the phone given room: at 1280 the same laws hold, the heads pin the same way,
and nothing that was one line at 390 becomes a plate again.

### 13c · What is kept, and what is not

KEPT: the vertical table; the row order (§10a); the special rows as rows;
one sheet at a time and §10c's placement; dismiss-outside; the pane as the
scrollport and the sticky section column; every write door, the undo stack,
the lozenge field and its clusters; the bottom bar's genre · die · play.

GONE: `.nu-top` (the ≡ moves into the bar), `.nu-formula`, the plates and
inline chips on special rows, the three addbars, every `<tfoot>` pin. NOT
DONE HERE: §12's music items, the phase-0 tape, the lozenge's remaining
residue (the say line growing at 320).

### 13d · What landed, and what it measured

**SHIPPED (uncommitted), 2026-09-05.** Six files carry it: `src/table/grid.ts`
(the pin law, the `+`s, the ADD sheet, the cell sheet's first line, the PERFORM
row), `src/table/sheet.ts` (`offerLozenge`, the one door to the lozenge
component), `src/copy/sheets.ts` and `src/copy/glyph.ts` (the ADD sheet's five
words and the `+`'s), `ui/glyph.js` (`GLYPH.act.add`), `ui/eight.js` (the ≡ into
the bar, the × into the sheet's own header) and `nu.css`. `node tools/ui/build.js
--check` says **ui-build ok 5 entries** and `npx tsc --noEmit` is clean.

**§13b'S TABLE, MEASURED** — `devices["iPhone 14"]`, DPR 3, `isMobile`,
`hasTouch`, 390 x 844 on Kingston 1969 at reading 1, before off a `git archive`
of v287 served beside the working tree (`scratchpad/design/onepin/probe.cjs`,
kept, with its four screenshots):

| | before (v287) | after |
|---|---|---|
| fixed chrome, at rest | `.nu-top` 55.8 x **55.2** + `.nu-bar` 390 x **50.4**, and a sticky `.nu-formula` 364.4 x **105.8** that never scrolled either | **the bar alone, 50.4pt** (≤ 72 + safe area); `.nu-top` and `.nu-formula` are deleted |
| pinned bands inside the pane, at rest | **4** — TIME at 3, RULES at 51, PHRASES at 99, the heads at 163.1 | **1**, the column heads, at **0**, **45px** (≤ `--tap` + 3) |
| pinned bands, a special sheet open | the stack above the tapped row | **the owner row alone**, at 0 |
| pinned bands, a cell sheet open | the whole stack (4) + the formula bar | **none** — the sheet's own first line is in flow at its top |
| pane height at rest | **611px** | **788px**, against a floor of 785.6 (844 − 50.4 − 0 − 8) |
| overlapping cell pairs, first section row | **6 of 7 cells** at 390 (and 6 at 320) | **0**, and **0** overlapping column-head pairs |
| head text cut mid-word | the heads drew at 35.6px around a 56px button | **0 of 7** heads clipped |
| `scrollTop` across open/close of TIME, RULES, a cell | 120 · 120 · 120 (already held) | **120 · 120 · 120** — unmoved, now for the row as well as the cell |
| adders in the head row | **3 buttons in a 22ch (224px) column**, the head cell 57.3px tall | **one `+` cell, 44.1 x 45**, and one `+` row at the grid's foot |
| `<tfoot>` rows pinned down the page | none, and the walk had no rule about it | **none, by law** — `stick()` writes `thead > tr` only and T13j reads `<tfoot>` |
| the special rows, at rest | TIME 45 · RULES 45 · **PHRASES 61.1** · MIX 51 · MASTER 46 · PRODUCE 46 · **PERFORM 53 (92 on Silence)** | **45 · 45 · 45 · 49 · 46 · 46 · 46** |

**SIX THINGS THE RENDERED PAGE SAID THAT THE PROPOSAL DID NOT.**

- **THE OVERLAP WAS A COLUMN NARROWER THAN THE THING INSIDE IT, AND IT HAD TWO
  AUTHORS.** `--colw: 3.5ch` gave a player 35.6px at 390 and `.nu-cellword`
  declared `min-inline-size: 56px`, so every cell was 20px wider than its own
  column and the row piled onto itself — six pairs, measured. `.nu-colbtn`
  carried the same 56px one row higher. §13a.7's two ends are stated in the
  stylesheet now (`--cellmin` is the glyph and two `--s2`s; `--colshare` is the
  pane less the head column, the `+` and the border-spacing, divided by the
  players) and the button takes exactly what its column gives it.
- **THE BORDER-SPACING IS 30px AND IT IS NOT IN `inline-size`.** `.nu-trims` is
  `border-spacing: 3px`, so a table of nine columns carries ten gaps. The first
  drawing of the share left them out and pushed the `+` off the right edge of a
  390px phone by exactly that much. `--gaps` is `3px * (--cols + 2)`.
- **`table-layout: fixed` HANDS SURPLUS OUT IN PROPORTION, WHICH IS NOT WHERE
  IT WAS WANTED.** With the table declared `max(100%, sum)` the `+` column drew
  **124.7px** on the Silence record at 390 and **57.4** on Kingston, against a
  44px token — a `--tap` cell that is only `--tap` when the sum happens to fill
  the pane. The table is EXACTLY the sum now and the head column is told to be
  everything the others are not, which is where a section name that ellipsised
  wanted the room anyway.
- **`calc(x / 0)` IS INVALID, AND THE BLANK STATE IS A RECORD WITH NO PLAYERS.**
  `--cols - 1` is 0 on Silence, which took `--colw`, `--headw` and the table's
  own width down with it: measured, the head column collapsed to its content
  and the `+` stood at x = 18.8 in a 364px pane. The divisor is
  `max(1, --cols - 1)`. A record you have not built a band into yet is exactly
  the record this table has to be readable on.
- **THE LAMP WAS THE SECOND LINE.** PHRASES measured 61.1px against TIME's 45
  and the extra 16.1 was `.nu-motlamp`, a sticky BLOCK under the button. The
  `--panew` pin belongs to the row's LINE (`.nu-spline`), not to the button, so
  the lamp is a flex item at the end of that line — still a `[data-live]`
  SIBLING of the button, still outside it (T10u), and its reserved line now
  costs nothing, which is a stronger form of B6's law than the one it replaces.
  The column head's `.nu-scollamp` and the mix cell's took the same repair for
  the same 4px: both ride their own box's bottom edge and the band came from
  49 to 45.
- **SEVEN 44px MARKS AND SIX GAPS DO NOT FIT IN 320.** The ≡ joining the bar
  made the row want 334.4px of a 320px screen. The tap floor is not negotiable
  and the air is: below 380 the three gaps are 1px, measured at **314 in a 320
  row**, and every mark keeps its 44 in both axes.

**WHAT WAS REFUSED, AND WHY.**

- **THE PLAYER OFFERS ARE NOT CLUSTERED BY `familyOf`.** §13a.5 asks for the
  ADD sheet's body *"as lozenges in the Cast's clusters (instruments.js
  `familyOf`)"*. `NuInstruments.familyOf` matches INSTRUMENT ids against
  eleven regexes (`/guitar|banjo|sitar/` → guitar, `/organ/` → organ …) and the
  three offers are voice KINDS: `familyOf("line")`, `familyOf("bass")` and
  `familyOf("drums")` all fall through to `"lead"`, so clustering by it would
  draw one heading over three words and call it semantic. The clusters the
  sheet HAS are the two §11c gives every sheet — **Players** and **Sections**,
  one group heading each — and the three offers are one lozenge field at
  `tcol-add`, whose own `data-k` law (`<field>|<value>`) is what keeps
  `tcol-add|line`, `tcol-add|bass` and `tcol-add|drums` the addresses eleven
  gates already drive. The section offer keeps `trow-add` in the sheet's op row.
- **THE `<tfoot>`'S FOUR SIDEWAYS PINS STAY.** §13b's table says
  "`<tfoot>` rows sticky: yes → none". Measured, no `<tfoot>` cell was EVER
  pinned in the block direction — `stick()` walks `thead > tr` and nothing
  else — and the four that report `position: sticky` there are pinned on the
  INLINE axis: the mix row's section-column head, and the master's and
  produce's `--panew` lines. §13a.4 keeps that axis by name (*"The section
  column sticks left while players scroll sideways, as now"*), and §10a's own
  measurement is what put the master's line there (in the row head it rendered
  at 17px; in the adder cell it stood seven columns right of a 255px pane). So
  T13j asserts the block direction, which is what "a pinned band" means, and
  the horizontal law is untouched.
- **A CELL AT 390 IS A GLYPH AND NOT A WORD, ON A RECORD WITH SEVEN PLAYERS.**
  §13a.7 is doing exactly what it says — the share is 30.4px and the word shows
  at 9ch — so Kingston 1969 at 390 draws a grid of marks with no words in it,
  which is §11e's own *"ideally the table is a large set of icons"* and is also
  a real loss of what each cell SAYS. It is recorded here rather than softened:
  the accessible name and the `.nu-vh` word carry it, the cell's own sheet
  prints it, and a record with three players at 390 (the Silence record with a
  band built into it) is over 9ch and draws its words.

**WHAT MOVED, IN ADDRESSES** (`test/shell.js` is told each, and
`test/table-inventory.json` files them):

| control | was | is |
|---|---|---|
| `taddr` `tundo` `tredo` `tcopy` `tpaste` | `.nu-formula`, above the pane / a bottom sheet at ≤480 | the OPEN cell sheet's first line (`.nu-cellhead`) — two taps: select, then edit |
| `tcol-add|line` `|bass` `|drums` | three `.nu-addbtn`s in a 22ch head cell | the ADD sheet's lozenge field at `tcol-add` — one tap on either `+` |
| `trow-add` | a `.nu-addbtn` under the last section | the ADD sheet's op row |
| `tadd|head` `tadd|foot` | — | NEW: the two `+`s, one `--tap` cell each |
| `menu` (the ≡) | `.nu-top`, fixed at the top corner | the LAST button of `.nu-bar`; `#nu-menu` opens above it |
| `sheet-close` (the ×) | `.nu-top`, beside the ≡ | `.nu-sheethead`, the first line of the open viewer sheet, with the sheet's name |
| `tfoot|perf` | a row head beside a three-line strip of word plates | a merged one-line row; its sheet is `perfCells` + `perfSheet`, which is more than the row held (`footCell` set `OPENFIELD` to an address the sheet it opened did not contain) |

**WHAT IS DELETED.** `.nu-top` and its five rules; `.nu-formula`, `.nu-fvec`
and `firstGroup` (the readout was the sheet's own first group);
`.nu-addbar`/`.nu-addbtn`/`.nu-addhead` and `addBtn`; `--addw`;
`.nu-footcells`/`.nu-footcell` with `footRow` and `footCell`; the ≤480 bottom
sheet; `body`'s `--top-h` reservation.

**GATES.** `test/table.browser.js` grew **T13** — thirteen claims (a…l, §13b's
own table row by row) run in SIX fresh contexts: `devices["iPhone 14"]` at 390
and at 320 with DPR 3, `isMobile` and `hasTouch`, plus 1280 for *"the desktop is
the phone given room"*, on Kingston 1969 and on the Silence record (which the
gate BUILDS a band into through the ADD sheet's own three offers, because the
blank state has no players and the overlap claim is about a record with a band).
**379 ok, 0 failed** — T4–T12n unmoved. `test/shell.js` **PASS** (24 skipped),
`test/gutter.js` **ALL PASS (51)**, `node test/copy.test.js` **10 ok, 0 failed**,
`test/selects.js` **ALL PASS**, `test/sheets.js` **ALL PASS (31)**.
`test/nudges.js` **21 of 24**, and its three reds are v287's own: measured
against a `git archive HEAD` of v287 served beside the working tree, the same
three fail there (`songs.js WORDS carries the five new rows`, `the development
sheet offers "the rhythm, moved"`, `an op-KEY word re-times the rendered
stream`) — none of them about the chrome, and the hire this round re-pointed
(`+` then `tcol-add|drums`) passes on both.

**AND SEVEN GATES WERE TOLD WHERE A CONTROL WENT**, which is the other half of
T7's law: `test/shell.js` A6l (the three hires are behind the `+`, two taps from
rest), `test/gutter.js` T3/T9 (the bar's fourth child is the ≡, and its sweep
reaches `.nu-sheethead button` so the × is still measured), `test/selects.js`,
`test/sheets.js` and `test/nudges.js` (the drummer is hired through the `+`),
and `test/table-inventory.json`, where the five formula-bar addresses take
`"open": "tcell|<voice>|<section>"`, the four offers take `"open": "tadd|foot"`,
the three PERFORM controls take `"open": "tfoot|perf"`, and the two `+`s are
filed as new. Six of T13's own claims failed on their first run and every one of
them was the GATE and not the page — a descendant `querySelector("th")` that
found the chord chart's head inside an open sheet, a `display: contents` `<nav>`
skipped by a walk that wanted a rect, a `<th>` measured where a button was
meant, two blind taps on a cell that was already selected, and a 47px budget
asked of a 1280px head that is allowed its two lines.

**AND THREE THINGS THE SWEEP FOUND WHILE MOVING THEM.** `test/shell.js` BANDS
read `top.getBoundingClientRect()` off a `.nu-top` that is gone (it reported
`topH` and nothing read it); the bar at 320 on the BLANK STATE overflowed its
own box by 3px, because a five-digit seed is 9px wider than Kingston's one (the
number keeps its 44px floor and gives up its side padding below 380); and a
column head's SECOND line — `.nu-colinstr`, what the player is playing — had no
first-word fallback and printed "acoustic ba…" on the Silence record at 390 with
a band in it. A head that cannot show its instrument whole drops it now
(`is-noinstr`); the accessible name and the title still carry it.

### 13e · Sections header, motifs, direct add (2026-09-05)

**THREE LINES, VERBATIM**, after an hour with v288 on the phone:

> *"Give the main composer interface its own header call it Sections"*
>
> *"Call phrases motifs"*
>
> *"Don't pop up an interface when I add a section or a voice. Just add it."*

**A · THE GRID HAS ITS OWN HEADER.** TIME, RULES and MOTIFS each name what
their line is about; the grid under them — the thing the page is for — named
nothing, and a reader arriving at the column heads had to infer that the rows
below were the song's sections. So the grid gets one line of its own, directly
above the column heads, in the special row's furniture: the word SECTIONS
left, the count right (`13 sections · 76 bars`), `var(--tap)` tall, a hairline
under, no plate. It is a LABEL and not a row with a sheet — no button, no
`data-k`, no `aria-expanded`, nothing to open — and it is **the one `<thead>`
row that does not pin**: §13a.1 gives the pane one pin and `stick()` spends it
on the column heads directly below. Measured at 390 and 320 on both records:
**45.0px**, at **y 147** at rest, and at **y −53** after a 200px scroll of the
pane while the column heads held **y −5** — a label in the flow, under one
pinned band. `position` is `static` in the stylesheet rather than left to
`stick()`'s inline `auto`, so what the law says and what the box computes are
the same sentence. Its count is the record's and not the view's: sections and
bars are document facts, so the line reads the same when §5's transpose turns
the grid.

**B · PHRASES ARE MOTIFS.** The review's glossary (§12a) renamed the bank's
thing `motif → phrase`; the box has addressed it `motif` all along
(`motifpoint|…`, `A.motifLamp`, the row's own `data-special="motifs"`,
`glyph.tab.motifs`), so the printed word went back to the address rather than
the other way round. **Twenty-three strings**, no keys: `special.phrases.word`
is `motifs`, its aria is `Motifs — every tune and beat in this song`, the eight
`bank.*` strings say motif, `group.phrase` is `Motif`, `noun.phrase` is
`motif`, `count.phrase.one/other` are `{n} motif(s)`, `glyph.tab.motifs` is
`Motifs`, three `glyph.cell.prov.*.say` say `Motif from …`, and the two rules
sentences point at *the motif editor*. **What keeps `phrase`:** `phrasing` in
the PERFORMANCE row (an articulation), `field.phraseStructure` (*phrase
structure*, the Development axis's own term, which §12a chose over *period*)
and `rule.headPhraseLength` (*Phrase length*, its neighbour on that axis). A
phrase length and a phrase structure are the FORM's terms; a motif is the
thing in the bank. `test/copy.test.js`'s glossary net is inverted to match —
it banned `motif`, it bans `phrase` now, and it exempts those two by name.

**C · A `+` ADDS. IT DOES NOT ASK.** The ADD sheet §13a.5 shipped this morning
is deleted — `ADDHEAD`/`ADDFOOT`, `addSheet`, `offerField`, `sheet.ts
offerLozenge`, and the three copy keys `group.band` / `add.players` /
`add.sections`. Each `+` **is** its offer: its `data-k` is the address of the
op it fires, its accessible name says what a tap will add, and the tap writes
the record through the same `op()` wrapper (the undo stack's door) every other
control uses.

- **The `+` at the end of the ROW axis** fires `sectionOffer` — one offer,
  nothing to choose. `data-k="trow-add"`, name *"Add section at the end"*.
- **The `+` at the end of the COLUMN axis** fires `nextPlayerOffer`, which is
  new beside `playerOffers` and picks OUT of it rather than being a second
  list. **Which player, and why one can be picked at all:** there are three
  kinds and a `+` that adds cannot ask, so it takes **the band's own order —
  drums if there is no kit, else bass if there is no bass, else a line** —
  which is build-the-band's order, the order this box has hired in since the
  nav had a Band branch. It is never a refused offer (`bass` and `drums` refuse
  only when the record HAS one, the same test that skips them), and the name
  says which before a thumb commits: `Add drums` on the Silence record,
  `Add line` on Kingston 1969, measured. The other two kinds are not lost —
  a second tap offers the next one, and every column head's own sheet holds all
  three (`colOps`), which is the door `test/table-inventory.json` files.
- §5's transpose swaps which edge is which and the two offers swap with it,
  because the axis is what a `+` is at the end of.

**AND AN ADD OPENS NOTHING, WHICH IS THE HALF THE SHEET WAS HIDING.** Measured
on v288: a hire also opened the new player's COLUMN sheet and an add opened the
new section's ROW sheet — `tablePanel` lands an arrival on the door `tab` /
`formSec` names, which is T8a's *"add → hear it → choose its sound"*
(2026-09-04). That is an interface popping up when you add a voice, so it goes
too: `tableAPI`'s `addVoice` and `addSection` now `spend()` the arrival — one
line, marking `landedOn` consumed before the redraw — and the new column or row
stands on the table with nothing over it, its sheet one tap away on its own
head. `openVoice` / `openSection`, which mean *"take me to it"*, are untouched.
**T8a is inverted rather than deleted**, so the claim stays measured.

**THE NUMBERS** (`scratchpad/design/direct-add/probe.cjs`, `devices["iPhone
14"]`, DPR 3, `isMobile`, `hasTouch`, 390 and 320, on Kingston 1969 and the
Silence record; before off a `git archive HEAD` of v288 served beside the
working tree):

| | before (v288) | after |
|---|---|---|
| the grid's own header | **none** | **SECTIONS**, 45.0px, `position: static`, `13 sections · 76 bars` (Kingston) · `1 section · 8 bars` (Silence) |
| head rows in `<thead>` | 4 (TIME · RULES · PHRASES · heads) | **5** — the label between them, and still **one pinned band**, the heads at 0 |
| the label under a 200px scroll | — | **y 147 → −53**, the heads **−5** (in the flow, under the one pin) |
| the MOTIFS row's word | `phrases` | **`motifs`**, the row still 45px |
| the head `+` | `data-k="tadd|head"`, aria *"Add a player or a section"*, `aria-expanded="false"` | **`tcol-add|drums`** (Silence) / **`tcol-add|line`** (Kingston), aria *"Add drums"* / *"Add line"*, no disclosure, 44 × 44 |
| the foot `+` | `data-k="tadd|foot"`, same generic name | **`trow-add`**, aria *"Add section at the end"*, 44 × 44 |
| a tap on the foot `+` | sections **13 → 13**, `.nu-addopen` **1** | sections **13 → 14**, `.nu-addopen` **0** |
| a tap on the head `+` | voices **7 → 7**, `.nu-addopen` **1** | voices **7 → 8**, `.nu-addopen` **0** |
| sheets open after either tap | **1** (the ADD sheet; then, one tap deeper, the arrival's own) | **0** — `.nu-wopen` unchanged across both taps |
| the pane's `scrollTop` across an add | 90 → 90 | **90 → 90** |

**GATES.** `test/table.browser.js` T13 grew **m** (the header: present, one
`--tap` line, above the heads, no control in it, no pin on it, the count right)
and **n** (either `+` adds, draws no sheet and moves no scroll); T9n/T9o read
the `+` as its own offer, T8a is inverted, T12e and `CELLGROUPS` say `Motif`,
and `CELL_ORDER`'s first field is `motifs`. `test/copy.test.js` GLOSSARY is
inverted with its two exemptions. Four gates that hired through the ADD sheet
(`shell.js`, `sheets.js`, `selects.js`, `nudges.js`) tap the `+` itself.
`test/rules-view.browser.js` R9a reads *the motif editor*.
`test/table-inventory.json` re-files the four offers (`open: tcol|<voice>` for
the three kinds, `null` for the section) and deletes the two `tadd|` rows v288
minted, with the reason in its own `renamed` note: the button is the offer's,
so it is filed under the offer it fires.

### 13f · Rules above time; the CHORDS row (2026-09-05)

**TWO LINES, VERBATIM:**

> *"Put rules above time"*
>
> *"Add chords below time and move chord stuff into it"*

**A · THE ORDER IS RULES · TIME · CHORDS · MOTIFS.** The head of the table read
TIME · RULES · MOTIFS from §10b step 4. The rules are what the record IS before
a hand touches a number — the genre's thirty-eight sentences set the tempo the
TIME row then shows — so they stand over it rather than under it. And the
changes are their own subject: they read after the meter and the key they are
counted in, not inside them. `SPECIALS` in `src/table/special.ts` is the ONE
place that order is stated; `grid.ts specialRows` walks the array, `stick()`
finds the open row by class (`.nu-spopen`) and the column heads by being LAST,
so not one offset moved. DESIGN.md §5 and §10a's diagram carry the same order.

**B · WHAT MOVED, AND WHAT DID NOT.** One owner throughout: the same
`A.changesNode()`, the same seated `alphabet.harmony`, the same `setDiatonic`
door, at the same addresses. Nothing is drawn twice on the page (T10h counts
each fact's controls with each row open in turn).

| field | address | was | is | why |
|---|---|---|---|---|
| the changes grid | `prog<n>d` · `prog<n>i` · `sel|alphabet.quality|bar<n>` | TIME, group CHORDS | **CHORDS, group `chords`** | the chart IS the chords |
| `+ bar` / `− bar` | `prog-add` · `prog-cut` | TIME | **CHORDS** | they are the chart's length |
| harmony | `sel|alphabet.harmony` | TIME, group KEY | **CHORDS, group `harmony`** | `kernel.js chordsOf` reads `g.prog` only under `cycle` — the word decides whether the CHANGES are played at all, which is a fact about them and not about the alphabet |
| the melody flag | `diatonic` | TIME, group KEY | **CHORDS, group `harmony`** | *"follows the chords"* is a sentence about the chords |
| key (circle of fifths) | `opt|alphabet.key|<n>` | TIME, group KEY | **TIME, unmoved** | the alphabet a record counts WITH |
| mode | `sel|alphabet.mode` | TIME | **TIME, unmoved** | same |
| scale | `sel|alphabet.scale` | TIME | **TIME, unmoved** | same |
| record gain | `goto.board` | TIME, last under CHORDS | **TIME, last under KEY** | back matter. Its own comment always said it never belonged to the chords; the chords left, so it stands under the last group there IS rather than in a group of one — the same refusal that put it there in 2026-08-29 |

**`alphabet.quality` WAS LOOKED FOR AND IS NOT SEATED ANYWHERE.** It is not a
field of the TIME sheet and it is not a rule: `avail.js` scopes it `song.bar`
and the only control on it is a per-bar menu INSIDE `chordGrid`
(`sel|alphabet.quality|bar<n>`), so it moved the moment the grid did, at the
address eleven gates already drive. `gates.js` names it in a refusal rule
(`when alphabet.harmony.cycle`) and that rule is about the kernel, not about a
row; it did not move either.

**C · THE FACE IS THE CHAIN THAT PLAYS.** `ui/eight.js chordsFace` is its one
owner and it says what SOUNDS rather than what is stored. On a record whose
`alphabet.harmony` is `cycle` it is the roman numerals `chordSymbol` prints in
the grid's own bar rows, joined with `·`; past eight chords it is the chart's
size and what the harmony does with it (`chords.face.long`, "8 bars · cycle"),
because half a progression with a dot after it reads as a chain that ends where
it does not. On a modal or emergent record — where `chordsOf` throws `g.prog`
away and takes one triad off the mode per bar — it is the harmony's own word,
because printing the stored numerals there would describe music the box is not
playing. **It never answers "default"**: a record composed straight off its
anchor has a chart the kernel plays, and saying what that is is what the row is
for. `chordName` was a closure inside `chordGrid` and is `chordSymbol` at
module scope now — two readers, one spelling of figured bass.

**AND THE ROW HAS NO LAMP, WHICH IS A REFUSAL WITH A MEASUREMENT UNDER IT.**
§13a.2 allows one in the line and MOTIFS has one. CHORDS does not, for two
reasons that are the same reason twice: the sounding chord is a fact about the
CHART only on a `cycle` record, so a lamp reading it would light a numeral the
box is not playing on every modal record; and the registry that does know —
`chordCell` / `chordRow` / `chordLabel` — is filled by `chordGrid` while the
grid is DRAWN, which is exactly when the row is open and a lamp is not wanted.
Lighting it honestly means a second reader of the kernel's harmony inside the
clock loop; MOTIFS' lamp costs one node that is already registered.

**D · WHAT ELSE THE MOVE TOUCHED.** Four copy keys moved with their control —
`time.harmony` · `time.melody.chords` · `time.melody.key` · `time.changes`
became `chords.*` (a key is an address, C1's own law) — and `group.harmony` is
new, with no `GLYPH.group` mark, so its heading prints its word alone, which is
that table's own rule for a group it has no honest picture for. `ui/glyph.js`
was NOT edited (the round was told not to), which is why the second group has
no mark; the first keeps `chords`' own `⌗`. `changesNode`'s box was
`.nu-timechanges` and is `.nu-changes`: a class named after the row it used to
live in is a name that lies, and `nu.css` carries the one rule that styles it.

**THE NUMBERS** (`scratchpad/design/chords-row/probe.cjs`, `devices["iPhone
14"]`, DPR 3, `isMobile`, `hasTouch`, 390 and 320, on Kingston 1969 and the
Silence record; before off a `git archive HEAD` of v257 served on its own port
beside the working tree):

| | before (HEAD) | after |
|---|---|---|
| the special rows, in order | `time · rules · motifs` | **`rules · time · chords · motifs`** |
| their heights at rest, both records, 390 and 320 | 45 · 45 · 45 | **45 · 45 · 45 · 45** |
| the TIME sheet | **14 fields**, groups `tempo · meter · key · chords` | **11 fields**, groups **`tempo · meter · key`** |
| …its changes grid / harmony / melody flag / `prog-add` / quality menus | 1 · 1 · 1 · 1 · 4 (Kingston) | **0 · 0 · 0 · 0 · 0** |
| …its bpm / circle / scale / record gain | 1 · 1 · 1 · 1 | **1 · 1 · 1 · 1** — unmoved |
| the CHORDS sheet | — | **3 fields**, groups **`chords · harmony`**; changes 1, harmony 1, melody flag 1, `prog-add` 1, quality menus **4** (Kingston) / **1** (Silence) |
| the CHORDS face, Kingston 1969 | — | **“i · i · iv · v”** |
| the CHORDS face, the Silence record | — | **“Modal — one mode, no chords”** — the harmony's own word, because that record's chart is not read |
| the TIME face | `79 BPM · 4/4 · D natural minor` | **unchanged** — it never said the chords |
| pinned bands with each row open | the owner alone, at 0 | **the owner alone, at 0**, for all four rows |
| `scrollTop` across open/close, Kingston | 120 · 120 · 120 (three rows) | **120 · 120 · 120** (four rows, CHORDS included) |
| page errors | none | **none** |

**E · SECTIONS COLLAPSES.** Paul, the same day: *"Sections should collapse when
I touch it."* §13e made the grid's own header a LABEL and said in three places
that it had nothing to open; it has something to DO. The line is a disclosure
now — one button the width of the row (`data-k="tsections"`, `aria-expanded`,
`aria-controls="nu-gridbody"`), and a tap hides the column heads, the whole
`<tbody>` (every section row, the orphan sheet and the `+` row) and the MIX
row, which is the one `<tfoot>` row that is ALIGNED to the columns and is a
strip of unlabelled faders without them. MASTER, PRODUCE and PERFORMANCE stay,
because they are merged facts about the record and reaching them is why a hand
folds the grid. The four special rows above are untouched, and so is the COUNT:
folded, `13 sections · 76 bars` is the only thing the grid says.

IT IS A PAGE PREFERENCE AND NOT A DOCUMENT FACT — `rubato`'s own distinction.
No `op()`, so the undo stack does not grow (driven: Ctrl-Z after a fold leaves
it folded and takes back the previous real op instead); no `changed()`, so
nothing recompiles; nothing in the share link. It is stored at
`nu.band.grid.v1`, beside `nu.band.session`, so a phone that folded the grid to
reach PRODUCE finds it folded on reload. A fold closes the grid's OWN open
sheet first — a cell's, a section's, a column's — through `toggle`, the same
door the × is, because a sheet living in a `<tbody>` that is about to be hidden
cannot stay open.

**AND THREE THINGS THE RENDERED PAGE SAID THAT THE PROPOSAL DID NOT.**

- **A HIDDEN ROW WAS STILL REPORTING ITSELF PINNED.** `nu.css` pins every
  `thead th` at `inset-block-start: 0` and `stick()`'s job is to say which row
  keeps it — by writing `auto` on the others. It wrote only on the rows it
  walked, so the folded column-head row kept the stylesheet's 0 and came back
  `position: sticky, inset-block-start: 0px` with zero client rects: a pin on a
  row that is not on the glass, which is §13a.1 broken by an omission. The walk
  filters the hidden rows out of the MEASUREMENT and writes every row.
- **THE DISCLOSURE MUST NOT WEAR `.nu-sphead`.** It was given the special row's
  class for its box, and `[aria-expanded="true"].nu-sphead` is the selector the
  page's own "shut whatever is open" gesture and three gates use — so every
  `shutAll()` FOLDED THE GRID and eleven checks about the mix row, the section
  column and the frozen stack went red on a table that was not on the glass.
  One box, two classes (`.nu-sphead, .nu-labelbtn`), and the two generic
  `[aria-expanded="true"]` readers in `test/table.browser.js` and
  `test/sheets.js` say `:not(.nu-labelbtn)`. A fold is not a sheet.
- **A FOLD MAY MOVE THE SCROLL, AND ONLY BECAUSE THERE IS LESS TO SCROLL.**
  §13a.3's law is about a sheet: opening one adds content and closing it takes
  it away, and the pane must not jump either way. A fold REMOVES the grid, so a
  pane parked 90px down a table that is now three lines tall has nowhere to be
  but the top. Measured: 90 → 0 with `scrollHeight - clientHeight` = **0** —
  the browser clamping, not the page jumping — and 0 → 0 → 0 from rest.

**F · THE MOTIFS LINE HOLDS STILL.** Paul: *"The text in the motifs section is
changing rapidly every beat it's too much."* `lightMotifs` built the head
lamp's sentence from the set of players the engine reported SOUNDING at the
event it had just fired, so a bass resting for two beats took its motif's name
out of the line and put it back, several times a bar. The head says what the
CURRENT SECTION READS now — every voice not sitting out, through the same
`cellAt(src, si)` the instantaneous half uses, memoed on `si` — so it is
written at a section boundary, at a document write, and at nothing else.
Measured over sixteen seconds of Kingston 1969: **0 writes across 2 section
boundaries** on the run where the sentence happened to be the same either side,
and 1 and 2 writes across 1 and 2 boundaries on the runs where it was not;
never between them. THE BANK ROWS' `<i>` LAMPS ARE UNTOUCHED and stay
instantaneous: those are dots beside a name, the mark a column head wears, and
a dot that follows the beat is what a lamp is for.

**G · NO GRID ICON BESIDE THE SECTION NUMBER.** Paul: *"You don't need to put
the little grid icon to the left of each section number."* `secRowHead` drew
`A.rowMark(i)` — the ▦ — on every row of the grid, which is the one place a
mark says nothing a reader did not already know: the rows of this table ARE the
sections and the SECTIONS line one row up says so, so thirteen copies of one
picture stood down the narrowest column on the page. The number, the name and
the bar count stay; so does the accessible name (`12 chorus, 8 bars`), which
never came off the mark. Its `.nu-vh` word and its `data-say` go with the
picture they belonged to — a hidden word for an absent icon is a word about
nothing. THE MARK ITSELF IS NOT DELETED: `A.rowMark` still draws the section in
the cell sheet's header and in the provenance words. Measured at 390 on
Kingston: **13 heads, 0 `.nu-g`, 0 `.nu-vh`, 13 accessible names, the bar count
whole on every one and no one-word name cut**; the one head that ellipsises is
a hand-typed two-word name (`drums & bass`, 72/90px), as it did before the mark
came off and with one character more room now.

**H · THE PLAYING SECTION LIGHTS WHOLE.** Paul: *"Really light up the sections
as you move through them — not just a tiny halo around the number."* §10a's
*"the playing section's row head lights"* was a `<mark>` round the section's
NUMBER — twelve pixels of ring in the narrowest column on a 390px phone, which
is the halo. The row head AND every cell of the sounding section take a ground
in `--clock` now (DESIGN.md §1's token for *"scheduled"*; the round's brief
said `--flag-tint`, and `--flag` is REFUSED on this page, so the semantic-colour
law wins over the parenthesis), `color-mix(in srgb, var(--clock) 85%,
var(--panel))`, measured at **3.15:1** against a resting row — a ratio, not an
impression. It rides the SAME one writer: `markForm`, which is called from the
"pos" handler and from stop, toggles one class on one `<tr>` and memoes it, so
it is written once per SECTION and never per beat. Measured: `null → s0 → s1 →
s2` with **exactly one `tr.is-playing`** at every sample. The `<mark>` round the
number stays — the same fact at a finger's reading distance.

**AND TWO THINGS THAT ROUND MEASURED TOO.** The ground was first written as
`.nu-sheetgrid tbody tr.is-playing > th` — higher specificity than the
`--paper` rule it was aimed at and LOWER than
`#pan-band .nu-wordgrid tbody th.nu-srowh`, which is id-scoped — so the class
went on, the memo said it had, and the row drew `rgb(240, 237, 228)`, the
resting cream, at every width: declared and never arriving, in the round that is
about being able to SEE the playhead. The light is stated where the ground is
now, and the 3px `--ground` ring that closes the seam round a row head is
painted in the light too. And `__eightFrozen` takes the class off for its clone
— the exclusion is the page's, in the page, exactly as the parked `[data-live]`
children are — restoring the row's className BYTE FOR BYTE from a WeakMap,
because lit renders the row as `class="  "` and `classList.add` then `remove`
leaves `class=""`, which failed test/motif-frozen A3 by exactly those two
characters. A3 is green: **byte-identical across 2 boundaries** at 390 and 1400.

**GATES.** `test/table.browser.js` grew **T13o** — four claims (the order and
the four one-line heights; the face is the chain and never "default"; CHORDS
opens as its own pinned header with the grid, the harmony and the flag in two
groups; the TIME sheet holds none of them and is TEMPO · METER · KEY with the
pointer last) in all SIX T13 contexts — and T13c/T13h now walk four rows
instead of two. T10a asserts the new order, T10d's WANT list drops the five
chord families to T13o, T10h counts the changes with CHORDS open, and six
checks that read the head by INDEX (`rows[0]` for TIME, `rows[1]` for RULES)
read it by `data-special` now, so the next reordering moves nothing in that
file. **421 ok, 0 failed.** `test/shell.js` **PASS** (24 skipped, 376 ok) with a
seventh amendment recording the two moves. `test/sheets.js` **ALL PASS (31)**,
`test/selects.js` **ALL PASS** (its `ROWS` walk is five rows now; check 5b
opens CHORDS for the harmony and puts TIME back for the circle),
`test/rules-view.browser.js` **42 ok, 0 failed**, `test/knobs.js` **ALL PASS
(100)** with gate 8 still counting the nine tempo marks in TIME,
`node test/copy.test.js` **10 ok, 0 failed** (C4 takes two new same-text pairs,
`rule.headHarmony`/`group.harmony` and `field.chords`/`special.chords.word`,
each two meanings the way `rule.headMeter`/`group.meter` are).
`test/tempo-key.browser.js` — not on the round's list but the gate that drives
the changes hardest — is **22 ok, 1 failed**, and that one red is HEAD's:
measured against a `git archive HEAD` served beside the working tree, *"the
slider and the big readout say the same number"* fails there with the identical
payload (`{"doc":120,"state":120,"slider":120,"big":"","count":"4 taps"}`). Its
T4 block opens CHORDS, T5 opens TIME, and T5c — which read a CHORDS control and
a TIME caption in one `evaluate` — asks each row where it stands.
`test/table-inventory.json` files the five moved controls under `chords-row`
with `open: tchords` (time-row 17 → 12), and its new `moved` note says which and
why.

**AND THE GATES FOR E–H.** `test/table.browser.js` grew **T13p** (five claims,
all six T13 contexts: what folds and what does not; the grid's own sheet closed
with it and nothing left pinned; the fold is not an op — the document unchanged
and Ctrl-Z not taking it back — and it is in `localStorage`; a reload finds it
folded; a second tap puts it all back with the heads the one pin again) and
**T10z** (three claims on one sixteen-second playback of Kingston 1969: no row
head draws a `.nu-g` and the bar count and every one-word name are whole; the
head lamp is written at most once per section boundary and exactly one
`tr.is-playing` stands at a time; the playing row's ground is ≥ 3:1 against a
resting row). **T13m** is rewritten from *"a label with no control in it"* to
the disclosure it is. `test/table.browser.js` **454 ok, 0 failed**;
`test/sheets.js` **ALL PASS (31)**, `test/shell.js` **PASS (376 ok, 24
skipped)**, `test/selects.js` **ALL PASS**, `test/knobs.js` **ALL PASS (100)**,
`test/rules-view.browser.js` **42 ok, 0 failed**, `test/gutter.js` **ALL PASS
(51)**, `node test/copy.test.js` **10 ok, 0 failed**, `node test/table.test.js`
**40 passed, 0 failed** (T2's identity untouched).
`test/motif-frozen.js` **A3 green at both widths** — *"byte-identical across 2
boundaries"*, which is the claim H could plausibly have broken — with **A7
flaky under load and reported as such**: two runs on this tree failed it at
different widths (1400: 172/106/133 ms at +23s; then 390: 123 ms at +11.9s,
1400 clean at 95 ms), which is a long-task budget measured on a machine running
browser gates, not a deterministic red. The screenshots are in
`scratchpad/design/chords-row/` (`playing-row@390.png` is H).

### 14 · Sorted by scope — wave A (APPROVED 2026-09-06: *"Can you redesign based on the feedback you provided and address what's missing?"*)

**THE CONTRACT IS `docs/REDESIGN-SCOPE.md`** and its thesis is one line:

> **The page is sorted by age, not by scope.**

The review that asked for it is the Coach House walkthrough
(`scratchpad/pm-walkthrough/NOTES.md`) — a fourteen-section trip-hop record
built in the box on a phone, with every friction logged and the record kept at
`keeps/triphop-pm-walkthrough/`. A song has four scopes — **record · section ·
player · cell** — and every control belongs to exactly one. Walking the sheet
at v290 the scope changed **nine times**, and the record talked at both ends of
the page: RULES · TIME · CHORDS · MOTIFS above the grid, MASTER · PRODUCE ·
PERFORMANCE below it, with `Master` and `Time` eight screens apart and the same
kind of thing. Wave A is the three items that fix the SHEET.

**EVERYTHING BELOW IS MEASURED** under `devices["iPhone 14"]`, DPR 3,
`isMobile`, `hasTouch`, at 390 × 844 and 320 × 844, plus 1280 for the desktop,
on **Kingston 1969** (7 players, 13 sections) AND on **Coach House**
(10 players, 14 sections), which is loaded the way the app loads a record —
the Export sheet's own `<input type="file">`. The probe is
`scratchpad/design/wave-a/probe.cjs` (with `geo.cjs` and `shots.cjs` beside
it), the before side served off a `git archive HEAD` of v290 on its own port.

#### A1 · THE RECORD COLLAPSES TO ONE ROW

The seven record-scope surfaces are **one line at the top** — `THE RECORD`,
one `--tap` line at rest per §13a.2, its face **tempo · meter · key**. A tap
opens a SCOPE PANEL whose sections are the seven, each opening its existing
sheet, one at a time.

**THE FACE IS `timeFace` AND IS NOT RE-DERIVED.** Asked what a glance needs off
a record, the walkthrough answered tempo, meter and key — the sentence the TIME
row has printed since §10b, off the sheets that own those three words.
`RECORD.face` **is** `timeFace`: one function, two callers, so a re-worded
meter re-words the record's line by existing.

**NOTHING WAS REBUILT AND NO ADDRESS MOVED.** The seven keep their `data-k`
(`trules` · `ttime` · `tchords` · `tmotifs` · `tmix` · `tproduce` ·
`tfoot|perf`), their open keys (`sp|rules` · `sp|time` · `sp|chords` ·
`sp|motifs` · `mix|master` · `sp|produce` · `foot|perf`), their faces and their
sheet builders (`SPECIALS`, `PRODUCE`, `masterMixSheet`, `perfCells` +
`perfSheet`). `grid.ts scopes()` is the one place the seven are listed;
`specialRows`, `produceRow` and `perfRow` are deleted into it.

**AND THEIR ROWS ARE ALWAYS IN THE DOM, `hidden` WHEN THE PANEL IS SHUT** —
which is a decision with a seam under it. `ui/eight.js` reaches these rows BY
NAME (`__eightRow("time")` presses `ttime`, `__eightMix("master")` presses
`tmix`), and that file is another agent's this round. A row that was not
rendered would have made those doors a second implementation of the accordion.
Rendered-and-`hidden`, the press lands on the button a thumb would press and
**`RECORD_KEY(OPEN)` opens the panel under it**, one statement at the top of
the draw. **`ui/eight.js` needs no change for wave A.**

**MIX KEEPS ITS STRIPS.** A fader is the player's, so the aligned per-column
row stays in the `<tfoot>` under its own heads, and `tmix|<voice>` is still one
door. What left the foot is the three merged rows that are the record's.

| | before (v290) | after |
|---|---|---|
| head rows at rest, both records, 390 and 320 | **6** — rules · time · chords · motifs · label · heads | **3** — **record** · label · heads |
| `<tfoot>` rows at rest | **4** — mix · master · produce · perf | **1** — mix |
| the record's face | — | `84 BPM · 4/4 · G♯/A♭ n…` (Coach House), `79 BPM · 4/4 · D natural minor` (Kingston) |
| where the grid STARTS inside the pane | **291px** | **155.3px** — the grid begins **136px higher** |
| sections on the glass at rest, 390 and 320 | **7** of 14 | **9** of 14 |
| the seven addresses, driven one at a time | 7 resolve | **7 resolve**, each opening its own sheet, one open at a time |
| pinned band with a scope open | the owner row alone | **the owner row alone** (measured: `time`) |
| pane height at rest | 788px | **788px** — unmoved |
| `scrollTop` across open and close | identical | **identical** |
| page errors, console errors | 0 | **0** |

**WHAT IT COSTS, SAID PLAINLY.** A record-scope control is **two doors** from
rest where it was one, and the board's five plates are **three** where they
were two. `test/table-inventory.json` files the cost rather than hiding it:
fifty-nine rows changed `open` to `trecord` and took their old door as the
first entry of `then`, which is a LIST now for exactly this reason. Nothing is
lost — T7 drives all fifty-nine — and the trade is the table above: the head
goes from five lines to two, the foot from four to one, and the grid, the one
surface that shows the whole song, gets 136px of a phone back.

#### A2 · THE PHONE GETS ITS WORDS BACK

**WHAT WAS MEASURED.** On Coach House at 390 and at 320, v290: **0 of 140
cells** printed a word and **0 of 10** column heads printed a name — 140
identical dots — while the SAME table at 1280 printed every one of them.
§13a.7's rule (word at ≥ 9ch, glyph below) is the cause, and §13d recorded the
loss and left it.

**THE ARITHMETIC THAT DECIDES IT.** At 390 the pane is 364.4px. The frozen
section column (8ch), the `+` (44px) and the eleven 3px gaps take 163 of it, so
ten players share **217px — 21.7px each**, three characters of the cell's
11.52px mono. A word does not fit across a phone ten times, on one line or on
two. Measured, on Coach House at 390, with the column floor forced to each
value and the word measured against its own box:

| column floor | cells printing a WHOLE word (of 140) | players fully on screen, 390 | 320 |
|---|---|---|---|
| 29.6px (v290's glyph floor) | **0** — the word is not drawn at all | 8 | 6 |
| 44px, one line | 13 | 5 | 4 |
| 44px, stacked | 63 | 5 | 4 |
| 52px, stacked | 99 | 5 | 3 |
| 60px, stacked | 138 | 4 | 3 |
| **67px, stacked — SHIPPED** | **140** | **4** | **3** |
| 68px, one line | 99 | 3 | 2 |
| 68px, stacked | 139 | 3 | 2 |
| 80px, one line | 138 | 3 | 2 |
| 92px, one line | 140 | 2 | 2 |

(The trial floors are typed px; the shipped one is not a number in a
stylesheet — it is `--wordw`, measured on the rendered page, and it came out
at **67px** on both records at both phone widths.)

**THE DECISION: (ii) — FEWER PLAYER COLUMNS ON SCREEN, WITH A SWIPE, THE
SECTION COLUMN FROZEN.** The column floor is a WORD (`--wordw`: 9ch in the
cell's own type plus the cell's own side padding, **measured by `stick()` and
written onto the table**, because only the DOM knows what a character of that
font is), the pane scrolls sideways as it always has (§11c), and the section
column is frozen at its left edge as it always has been. Shipped: **67px**
per player, **4 players on a 390 screen and 3 on a 320**, and every cell says
a word.

**THE TWO THAT WERE REJECTED, WITH THE NUMBER THAT REJECTED THEM.**

- **(i) TWO-LINE CELLS WITH THE ROW TALLER, ALL TEN PLAYERS STILL ON SCREEN.**
  Refused by the arithmetic above: ten players on a 390 screen is 21.7px each,
  which is three characters whether the word has one line or two. It also buys
  a taller row, and the row is the thing there is least of — 7 sections were on
  the glass at v290 and the fix has to give sections back, not take more.
  **WHAT IS KEPT FROM IT** is the cell's internal layout, because it costs
  nothing: the mark stacks over the word where the two will not share a line
  (`.is-stack`, decided by the same `stick()` measurement), which buys the word
  **20px of every column** — the difference between 99 and 138 cells printing
  whole at a 60px floor — and **no height at all**, since the mark's line and
  the word's line together are 30px inside a 44px floor. Measured: the row is
  **44px in both states**, at 390 and at 320.
- **(iii) A PER-RECORD COLUMN BUDGET — the widest N players show words, the
  rest are glyph-only with the word in their head.** It buys exactly the same
  first screen as (ii) — **4 speaking players at 390 and 3 at 320**, measured —
  and then stops: the other six or seven columns of Coach House are a wall of
  dots for ever, because a budget is not a swipe. It is the complaint with a
  smaller number on it, and the cells it leaves mute are chosen by an accident
  of where a player stands in the band rather than by what a hand is reading.

**AND ONE BUG THE GATES CAUGHT, WHICH IS WORTH WRITING DOWN BECAUSE IT IS THIS
REPO'S CHARACTERISTIC ONE.** `RECOPEN` — is the panel showing — was set at the
top of `bandTable`, which is the component's constructor and runs on a REBUILD.
`toggle()` ends in `draw()`, which is an internal re-render and does not.
Measured by `test/rules-view.browser.js` within the hour: `__eightRow("rules")`
pressed `trules` by name, `OPEN` became `sp|rules`, the head came back
`aria-expanded="true"` — and the row was still `hidden`, so the rules deck was
never drawn. Twelve checks red, all of them downstream of a state that said it
was open and did not arrive ([[declared-but-never-arriving]]). The line is in
`toggle()` now, which is the one place every open goes through.

**AND THE PANEL'S INDENT IS A HAIRLINE AND NOT A PADDING, which the gate
found and is the second measurement of the same shape.** The scope rows were
given `padding-inline-start: var(--s2)` to say they belong to the panel. A
`.nu-spline` is `--panew` wide with `box-sizing: border-box`, so that padding
does not move the LINE — it takes 3.47px off the BUTTON inside it, and the
button is what T10m measures against the pane. MEASURED at 1280 on Kingston:
the line 1242 either way, the button **1242.1 without it and 1238.6 with it**,
against a check that allows 12px of a 1254px pane. The tolerance was widened to
16 for an afternoon on the reading that the gap was natural; it is back at 12
and the padding is gone, because a hairline down the rows' inside edge says the
same thing for nothing and a tolerance widened to admit a regression is a gate
that has stopped being one.

**AND THE SNAP IS REFUSED, WITH THE MEASUREMENT UNDER IT.** A table a phone
reads a few players at a time wants its swipe to land a whole column, so the
first drawing carried `scroll-snap-type: x proximity` on the pane and
`scroll-snap-align: start` with `scroll-margin-inline-start: var(--headw)` on
the column heads. MEASURED on Coach House at 390, at rest, before a hand had
touched it: the pane opened at **`scrollLeft: 40`** — a browser re-snaps a
snapport when its content is re-laid-out, and `stick()`'s own `--wordw` write
IS that re-layout — so the first player was half off the left edge of a table
nobody had scrolled. With the snap off the same measurement reads
**`scrollLeft: 0`**. A table that opens on a column it has hidden is worse
than a swipe that stops between two.

| | before (v290) | after |
|---|---|---|
| cells printing a word, Coach House @ 390 and @ 320 | **0 of 140** | **140 of 140** |
| cells printing a word, Kingston @ 390 and @ 320 | 0 of 91 | **87 of 91** (the other four have no value to print) |
| column heads printing a name, Coach House @ 390 / 320 | **0 of 10** | **10 of 10** |
| a player column | 29.6px | **67px** |
| a grid row | 44px | **44px** — unmoved |
| players fully on a 390 screen (Coach House) | 8, all mute | **4, all speaking** |
| players fully on a 320 screen | 6, all mute | **3, all speaking** |
| overlapping cell pairs, every section row, every record, 390 · 320 · 1280 | 0 | **0** |
| the pinned band (the column heads) on a phone | 45px — a MARK, one line | **53.3px** — the same TWO-LINE head the desktop always drew (the name over what they are playing). §13b's own budget was 47 (`--tap` + the 3px of `border-spacing`) and it was a budget for a head with no words in it; T13b's phone ceiling is 56 and the claim it makes — exactly ONE band is pinned, and it is the heads — is unchanged |
| the page's own sideways scroll, 390 / 320 | 390 / 320 (none) | **390 / 320 (none)** — the PANE scrolls |
| 1280 | 108.3px columns, every word | **unchanged** |

#### A3 · ONE TAP MEANS ONE THING

**WHAT WAS MEASURED**, on v290, both records, 390 and 320: a **cell** took
**2** taps to open, a **section row head** 1, a **column head** 1, a **special
row** 1. (The walkthrough logged the column head at two; on v290 it is one, and
this is the rendered page's number, not the note's.) Three targets, two counts,
nothing on the glass saying which — *"I lost ~20 taps to this in the first ten
minutes."*

**THE OLD DECISION, AND WHY IT EXPIRED.** `grid.ts bodyCell` carried it in
prose: *"tap once to stand on it (the formula bar names it), tap the SAME cell
again … to edit."* That was right for a page that HAD a formula bar — the first
tap paid for itself by filling a readout above the grid. §13a.6 deleted the
formula bar and moved its head INTO the cell sheet, and from that day the first
tap bought nothing but an outline. The comment is replaced, in place, with the
new law and this paragraph.

**THE GRAMMAR, IN ONE SENTENCE: a tap opens what you tapped, at its own
scope.** Cell → the cell's editor. Row head → the section. Column head → the
player. A special row → its sheet. THE SELECTION FOLLOWS THE OPENING rather
than preceding it: `toggle` writes `SEL` off the key on its way in, so the ring
lands on the cell whose sheet is now under it.

**NO DISTINCT "SELECT WITHOUT OPENING" GESTURE IS NEEDED, and that is a
finding rather than an omission.** The two things the first tap used to be for
are already elsewhere: **copy and paste** are on the open sheet's own op row
since §13a.6 (`tcell-copy|…`, `tcell-paste|…`), so the gesture that reaches
them IS the tap that opens it; and a **range** is SHIFT-tap, which sets the
anchor and opens nothing. The long press keeps what §13a.6 gave it — it opens
the cell's sheet and does not toggle it shut — which is now the same
destination as a tap, and is left alone rather than re-pointed at a state the
page no longer has a use for. The keyboard is untouched: arrows move the ring,
Enter/F2/a printable key opens, Escape closes, Delete clears a range.

| | before (v290) | after |
|---|---|---|
| taps to open a CELL | **2** | **1** |
| taps to open a SECTION (row head) | 1 | **1** |
| taps to open a PLAYER (column head) | 1 | **1** |
| taps to open a record scope (its own head) | 1 | **1** (the panel is one tap above it) |
| what the first tap on a cell draws | a ring, and nothing else | **the ring and the cell's sheet** |

#### THE GATES, AND WHAT WAS TOLD WHERE A CONTROL WENT

`test/table.browser.js` grew **T14** — five claims (a…e), run in NINE fresh
contexts: `devices["iPhone 14"]` at 390 and at 320 with DPR 3, `isMobile` and
`hasTouch`, plus 1280, on Kingston 1969, on the Silence record AND on **Coach
House**, a third bed added this round because §14 item 2's constraint is
stated on ten players by name and neither of the other two beds has ten of
anything. It is imported through the Export sheet's own file input, which is
the door a person uses.

  a  THE RECORD is the sheet's first row, one `--tap` line at rest with its
     face beside its word, one disclosure button (not a `.nu-sphead`) naming
     its seven sections — and its face IS the TIME row's
  b  all seven addresses resolve inside the panel, one sheet at a time, each
     under its own row, with the pane's `scrollTop` unmoved
  c  the `<tfoot>` holds no record row: the grid ends at the `+` row and MIX,
     whose strips are still one per player
  d  every cell with a value SAYS it, every head is named, no cell overlaps,
     the row is one line and the PAGE does not scroll sideways
  e  ONE TAP opens each of the four scopes — cell, section row, player column,
     record scope

**AND SIX GATES WERE TOLD WHERE A CONTROL WENT**, which is the other half of
T7's law. `test/table-inventory.json` re-files 67 rows behind `trecord` (59
that had a record-scope `open`, and 8 whose `reach` IS a scope head) and turns
`then` into a LIST, because a control inside the board is three doors deep now.
`test/table.browser.js`'s own `tap()` opens the record panel before pressing
one of the seven — the same gesture the page asks of a thumb — and T5a, T9a,
T9b, T9b2, T10a, T10l/m, T10w, T12m, T13b, T13d, T13k, T13o and T13p were told
what moved. `test/copy.test.js` exempts one same-text pair (`exportTab.json.what`
is a file's contents, `special.record.word` is a heading over a panel).
**`ui/eight.js`, `song.js`, `document.js` and `fields.js` were not touched and
need no change**: `__eightRow`, `__eightMix` and `__eightMotif` press these
heads BY NAME, the rows stand in the DOM `hidden` rather than absent, and
`toggle()` opens the panel under the press.

#### WHAT WAVE A DID NOT DO

The record panel's own header is a disclosure and NOT a sheet, so it does not
answer `[aria-expanded="true"].nu-sphead` — the SECTIONS label's own argument,
and for the same measured reason (sharing the class makes every "shut whatever
is open" gesture fold the panel away). It is **not persisted**, unlike the
SECTIONS fold: folding the grid is a standing preference about a page, opening
the record is a drill-down, and the sheet's resting state is one line.

Waves B, C and D are untouched: the 1,378px variation picker, the silent
refusals, the searchable genre index, the named section, the link that carries
the song, and the bass that can read a motif.

### 14a · The section's name, and wave C's seams

*(`docs/REDESIGN-SCOPE.md` item 8, 2026-09-06: **"A section has a name. Types
only today, so a form that plainly has a pre-chorus cannot say so."** The
engine and data half is `docs/WAVE-C.md` — `document.js` TIERS, `fields.js
secNameOf`, `avail.js form.name`, `ui/eight.js secName`/`secWord`, and the two
exporters. What follows is the half that lives in the table's TypeScript and
in the copy catalogue, which that round could not touch.)*

**THE TIER IS THE ROW.** `form.sections[si].name` is a SECTION-tier field —
`document.js` `TIERS.name`, `{ tier: "row", at: "form.sections[si].name" }` —
with four nulls under it: no cell tier (a cell may not rename the section it
sits in), no record tier and no genre tier (there is no default to inherit and
no anchor may invent one). **Absent means the type's word**, which is why the
sheet's box is EMPTY on an unnamed section and prints the type as its
placeholder rather than as its value: a field showing `verse` when nothing has
been written would make every unnamed section look named, and the first edit
would be a deletion of a word the composer never wrote.

**IT IS A FIFTH FIELD KIND** (`src/table/api.ts` `TextField`, `kind: "text"`)
and not a `StripField` with no options, because a strip with no options is
already a READOUT on this surface — `sheet.ts` draws one as `.nu-sheetsay`,
which is how a refusal is drawn, and a name a hand types is the opposite of a
refusal. Which of the two a row is comes off `avail.js`: exactly one row of
that table declares `text: true`, `ui/eight.js shSpec`/`wCell` carry the flag
through, and `model.ts textField()` refuses to draw a free-text box for a row
that has not declared it. **The model decides, never the renderer.**

**THE WRITE LAW: COMMIT ON BLUR OR ENTER, NEVER ON A KEYSTROKE.** Every `set`
on this page is a document write that normalises, RECOMPILES and lands at the
next bar, and `grid.ts wrapOps` puts each one on the undo stack — so a write
per letter would be eleven recompiles and eleven Ctrl-Zs for `pre-chorus`. The
box holds the letters and the document hears one sentence:

| gesture | what happens |
|---|---|
| typing | **nothing is written.** The document is byte-identical after ten keystrokes (measured). |
| **Enter** | blurs, which commits — one committer, not two racing on one keypress. |
| **blur** | commits, unless the value equals what is already there (trimmed both sides, because `fields.js secNameOf` trims at the door). |
| **a tap outside** | commits, and is heard FIRST — see below. |
| **Escape** | puts the written name back in the box and gives up focus; nothing is written. |
| **blank** | deletes the key. `document.js normalize` removes an empty one, and the head goes back to the type. |

**A TAP OUTSIDE IS A COMMIT AND IT HAS TO BE HEARD BEFORE THE SHEET CLOSES.**
`grid.ts armOutside` closes an open sheet on a `pointerdown` outside it, in the
CAPTURE phase on `document`, and closing the sheet removes the input from the
page — and Chromium fires no `blur` for a focused element that is removed. So a
name typed and then dismissed by tapping the background would have been
silently dropped: [[declared-but-never-arriving]] on the one control where what
is lost is a person's own words. The commit is armed on **`window`** instead —
capture on the window runs before capture on the document — so the letters are
in the record before the sheet that held them goes away. One listener for the
page, added the first time such a box is focused, reading `document.activeElement`.

**WHERE IT STANDS AND WHAT IT LOOKS LIKE.** First in the section sheet's **Form**
group, above the type (`model.ts rowSheet`): a section's type is a vocabulary
the record already answered, and its name is the one thing on that sheet nobody
but a composer can write. The type does not move and is not replaced — it is
still what the walk, the tempo shaping and the exporter reason about.

**THE ROW HEAD SAYS THE NAME.** `grid.ts` drew `A.roleWord(s.role)` on both
section plates — the row head (`secRowHead`, `.nu-srowname`) and the same plate
with the table turned (`secHead`) — and a string cannot know whether the
section it came out of has a name. Both ask `A.secWord(i)` now, which answers
the type's word where nothing is written, **so an unnamed record draws byte for
byte what it drew before**. Those are the only two sites: everything else on
this surface already asked `A.secName(i)`, which is the same fact with the
ordinal for PROSE (an accessible name, a sentence, a grip's label).

**MEASURED** on the rendered page under `devices["iPhone 14"]`, DPR 3,
`isMobile`, `hasTouch`, at **390 × 844 and 320 × 844**, on **Coach House**
loaded through the Export sheet's own `<input type="file">`
(`scratchpad/design/wave-c-seams/`):

| | 390 | 320 |
|---|---|---|
| the field | `<input type="text" class="nu-textbox">`, first row of Form | same |
| height | **44.0 px** (`--tap`) | **44.0 px** |
| width | 272.5 px | 202.5 px |
| type size | **16 px** (`--t3`) | 16 px |
| `maxlength` | **40** — `fields.js SECNAME_MAX`, read off `globalThis` and never copied | 40 |
| placeholder | the section's type (`intro`) at `--dim` | same |
| the pane's `scrollTop` while typing | **0 → 0** | 0 → 0 |
| under a keyboard (the viewport cut to 844 − 336) | field at **408–452**, the bar's top at 457.6 — **clear** | — |
| one edit | **one** document write, **one** Ctrl-Z back to byte-identical | same |

**THE TYPE IS 16px ON PURPOSE.** Mobile Safari zooms the whole page in on a
focused `<input>` whose text is under 16px and does not zoom back out — the
pane's width thrown away for the rest of the session. It is the one
measurement that decides a text field's size on a phone.

**THE THREE SURFACES A NAME REACHES**, on Coach House with its second verse
renamed `pre-chorus`:

| surface | unnamed | named |
|---|---|---|
| the row head | `verse` | `pre-chorus` |
| `export/score.js` | `Verse 1 · Verse 2 · Build 1` | `Verse 1 · pre-chorus · Build 1` |
| `export/als.js` clip | `verse bass 2` | `pre-chorus bass 2` |

and `boxesOf` on an unnamed record is byte-identical, which is why
`test/table.test.js` T2 is green **without re-pinning `BASE_SHA`**.

**GATED** by `test/table.browser.js` **T14f** — the field's shape, that typing
writes nothing, that commit writes once and reaches the row head, that one
Ctrl-Z is the whole edit, and that blank returns the head to the type — at 390,
320 and 1280, on all three beds; plus `test/document.test.js` G14–G14d and
`test/copy.test.js` for the field's own label.

**WAVE C'S NINE WORDS**, added to the catalogue in the same round: the Export
tab's eight (`exportTab.link.copied` · `.link.hand.say` · `.link.packing` ·
`.link.carries` · `.link.tooBig.say` · `exportTab.record.back` · `.gone.say` ·
`.backSaid`) and `row.name`. And one REWRITE: `exportTab.link.sub` said *"Place,
year, seed and current view"*, which was a true sentence about a RECIPE and a
false one the moment the fragment started carrying the document. It says **"The
whole record, in a URL"**; the status line under it says which of the two it is
carrying this minute. The eight `atlas.*` search keys wave A left PROVISIONAL
are final as written — the reading that settles them is that the FIELD filters
and the CHIPS jump, so one is named for what it matches on and the other for
its verb.

### 15 · Wave B — the editor fits, the refusal speaks, the variation chains

**APPROVED 2026-09-06** (docs/REDESIGN-SCOPE.md, wave B: items 4, 5 and 6),
off the Coach House walkthrough — a fourteen-section trip-hop record built in
the box on a phone (`scratchpad/pm-walkthrough/NOTES.md`, the record in
`keeps/triphop-pm-walkthrough/`). Three of its ten frictions are one round:

> 6. **The variation popup is 1,378 px tall on an 844 px phone**, three options
>    to a line, some 38 px wide; I mis-tapped `filled in` into `a beat later`
>    and did not notice.
> 7. **Refusals are silent.** `filled in` on a pad is disabled with the sentence
>    *"a pad voices the chord, it does not follow a line"* — shown to no one. I
>    tapped it eight times.

…and Paul, on the same box: *"I still can't pick more than one variation for a
motif"* and *"And the same with the drums."*

#### B4 · NO CONTROL TALLER THAN THE PHONE

**WHAT WAS MEASURED FIRST** (`scratchpad/design/wave-b/probe.cjs`, iPhone 14
emulation, DPR 3, `isMobile`, `hasTouch`, at 390×844 and 320×844, walking every
sheet — the record's seven, the section rows, the column heads and one cell per
player — on **Kingston 1969**, the **Silence** record and **Coach House**,
imported through the Export sheet's own file input): **734 pickers, 80 of them
taller than the viewport, 8 distinct fields past it.** The five tallest:

| field | words | drawn | the standing answer sat |
|---|---|---|---|
| `rule.instr.0` (RULES · instrument) | 121 | **5,876 px** | 5,807 px down |
| `sound.instrument\|<voice>` (a player's) | 147 | **4,416 px** | 1,448 px down |
| `alphabet.scale` (TIME) | 64 | **2,231 px** | 2,163 px down |
| `dev.kit\|kit\|s0` (the drummer's cell) | 69 | **1,873 px** | 1,450 px down |
| `dev.line\|<voice>\|s0` (a line's cell) | 27 | **1,178 px** | 954 px down |

The walkthrough's own 1,378 px is the last row, measured again after v287's
lozenge landed. Two clusters, one of them holding 87 of 120 words, is what an
instrument field is; a scale field is thirteen clusters and none of them large.

**THE MECHANISM: THE FIELD FOLDS ITSELF TO FIT.** DESIGN.md §2/16 law 1 already
names the ONE thing that may hide an option — a folded cluster, with its count
on its heading so a fold is never a disappearance. This makes the fold answer
the height. Three states, measured in order, the first that fits winning:

- **A · every cluster open** — law 1 exactly as it was, and what any vocabulary
  that fits still gets.
- **B · the cluster holding the standing answer open**, the rest headings with
  their counts. Every other word is ONE TAP away and the count says how many.
- **C · every cluster folded**, the one holding the standing answer MARKED
  (`aria-current`, drawn in `--hand`) and **printing the word it holds**
  (`.nu-lzheld`, a readout and not a pill — no `data-k`, so no second element
  on one address). The answer is also on the field's own head one row above.

The height is **estimated before the first paint and measured after it**: a
field is built before it is in the document, so `getBoundingClientRect` is zero
at build time and a measure-then-refold would paint 5,823 px once and shrink
it. `src/lozenge/field.ts` packs the words at the page's own width, and ONE
`requestAnimationFrame` after the mount reads the real box and steps the field
down a state if the estimate was generous — never up, and never against a hand:
the moment a thumb presses a heading the field stops guessing (`TOUCHED`).

**WHAT WAS REJECTED, WITH THE MEASUREMENT THAT REJECTED IT.**

- **A bounded scroll box with the value pinned in it.** It is law 1's own
  forbidden shape (*"nothing behind a wheel, a scroll box, or a 'more'"*) and it
  puts back exactly what the walkthrough complained of — *"you scroll inside a
  popup, over a table, inside a sheet. Three nested scrolls."* §11c made the
  PANE the scrollport; a second scrollport inside it is the disease.
- **A typed filter row past N words.** `src/menus/pick.ts` measured what a
  focused text input does on this page at 390: the soft keyboard takes 320 of
  the 844 and *"the number of options a thumb could reach without scrolling was
  ONE, on nine of the thirteen menus driven"*. A filter that raises the keyboard
  to shorten a list is a shorter list nobody can see. The typed COMBO keeps that
  job on a fine pointer, where the keyboard is already there (pick.ts rule 4).
- **Sending the flat vocabularies back to the native picker** (DESIGN §2/16's
  own exception: *"the native picker stays only where a vocabulary is long AND
  flat"*). It would have worked — 120 instruments in two headings is flat — and
  it was not needed: the fold answers 120 words in 707 px, and a picker-choice
  change would have moved `rule.instr` and `sound.instrument` off the widget
  that shows the shape of the possible, which is what they are shopping in.

**AND A SHEET IS NOT A PICKER.** The same walk measures the open SHEETS too:
101 of 120 are taller than 844px, the tallest being Coach House's MOTIFS at
5,352px (twenty-four motifs with their contours and their readers). That is not
a control taller than the phone — a sheet is a SECTION OF THE PANE, and the
pane is this page's one scrollport (§11c), so a long sheet is one scroll and
never a scroll inside a scroll. What §15 forbids is the second scrollport, and
the count that matters is the one below.

**AFTER, THE SAME 734 PICKER MEASUREMENTS: 0 over 844.** The five tallest are now
`sound.instrument` **707 px** (147 words, state C), `alphabet.scale` **702 px**
(64 words, state B — the standing word's cluster open at 634px into the field),
`dev.kit` **636 px** (69 words, state B), `bus|genre|name` **616 px** (13 words,
state A — it always fitted) and `dev.line` **588 px** (27 words, state B). `test/table.browser.js` T15a walks
the tall half of that census on all three records at 390, 320 and 1280 and
fails on ONE picker past the viewport, or on one that does not show the answer
it is standing on — the HOT WORD where a cluster is open, else the MARKED
HEADING of the cluster holding it, else the field's own head one row above.

**AND ONE THING A FOLD CANNOT POINT AT**, found by that walk and worth writing
down rather than papering over: a record can be standing on a word its own
vocabulary does not hold — the Silence record's fresh `line 1` names `synth`,
and `avail.js instrOptions` offers that word only where the record or its basis
declares a native model. `src/menus rowsOf` has a shape for this (a placeholder
row, `menu.unknown`); the lozenge field does not. So a folded field has nothing
of its own to mark, the head above it still prints the word, and T15a REPORTS
that case rather than failing on it: it is a fact about the record, not about
the fold, and it is the same one whether the field is folded or open.

#### B5 · A REFUSAL IS SAID OUT LOUD

The law `src/lozenge/field.ts` law 6 has stated since v287, now for **every
widget a sheet can draw**: a refused control is **`aria-disabled` and never
`disabled`** — a `disabled` button takes no click, so its reason is reachable
only through a screen reader, which is the silent grey wearing an accessible
name — and **a tap on it prints its reason and writes nothing**.

ONE OWNER FOR THE SENTENCE: the `why` the field or the option already carries
(avail.js / gates.js measured it; nothing derives a second one). ONE PLACE PER
WIDGET: `.nu-lzsay` inside a lozenge field, `.nu-wsay` everywhere else, keyed by
the field's own address and held across the redraw every write causes. Where it
landed, and what was silent before:

| widget | before | now |
|---|---|---|
| lozenge field | said (v287) | unchanged |
| chip strip (`chipStrip`) | `disabled`, reason in `data-why`/`title` only | `aria-disabled`, a tap prints it in `.nu-wsay` |
| the grid's native `<select>` | **no reason at all**, on the element or in the text | the reason rides IN THE OPTION'S WORDS, through `menu.withWhy` — the same key and the same join `src/menus/index.ts optionText` makes |
| ops bar (`.nu-opbtn`) | `disabled`, silent | `aria-disabled`, a tap prints it; the bar has one say line |
| a refused field HEAD | said nothing at all | prints its reason **and still opens** |
| the slider | `why` was not drawn at all | refused: says and does not move; a number outside the range says the range (`sheet.slider.range`) |

**AND A REFUSAL NEVER HIDES A VOCABULARY.** The refused head said-and-refused-
to-open for one afternoon and `test/sheets.js` caught what that costs:
avail.js's founding law is *"hiding destroys the shape of the possible"* — a
refused control greys its words, it does not take them off the screen — and a
head that will not open is a vocabulary nobody can see. The tap does both.

The native `<select>` is the ONE widget that cannot take the tap — the browser
owns that wheel and `<option disabled>` is a refusal it enforces — so it answers
the law the way the menus module already answers it, with the sentence in the
wheel itself. `test/selects.js` 5a drives the artifact: every refused option
drawn on the page is TAPPED and the sentence has to arrive on the glass, and a
second check asserts that not one of them is `disabled`, which would swallow the
tap that asks.

#### B6 · A VARIATION IS A CHAIN

**THE DOCUMENT KEEPS ONE STRING.** A chain is the words joined with `" + "` — a
space each side — in picked order: `"inverted + the first half"`. A single word
is the bare word, **byte for byte**, so every saved record, every one of the 358
catalogue anchors and `test/table.test.js` T2's `BASE_SHA` identity are
untouched (T2 stayed green with no re-pin; `test/document.test.js` G15 asserts
a one-word chain is the one operator it always was).

**ONE SPLITTER, IN THE VOCABULARY'S OWNER.** `songs.js` exports `CHAINSEP`,
`chainOf(s) → string[]` and `chainWord(words) → string`. `document.js opsOf`,
`ui/derive.js kitFold`/`kitSays`, `avail.js optionsFor` and
`src/table/model.ts` all read those; there is no second `.split(" + ")` on the
page, and G15c asserts no key of `WORDS` and no key of `KITLABEL` contains the
separator (a word holding one would be two words the moment it was written).

**BOTH COMPILERS CHAIN IDENTICALLY.** The tune's words reach the kernel through
`document.js opsOf`, which both compilers share (`scoreOf` calls it directly;
the derive path renders the per-section genre `toGenre` built, whose `word(v)`
IS that call), so the chain is folded in ONE place. The kit's word is applied by
`ui/derive.js` at its three sites, and all three now go through `kitFold` — a
`reduce` over `KITOPS`, which is legal because a kit operator is kit→kit and
TOTAL (kernel.js's own sentence beside `KITOPS`), so the operators compose.

**WHICH SHEETS ARE A CHAIN.** `dev.line` (the tune, 27 words) and `dev.kit` (the
drums, 69) declare `multi: true, ordered: true` in `avail.js`. **`dev.bass` is
deliberately not one**: it is a PATTERN choice — walking, octaves, pedal, reese
— and two patterns at once is not a chain of operators, it is two answers to
"what does the bass play". Paul asked for the motifs and the drums.

**THE ABSENT WORD STANDS ALONE.** `avail.js`'s own `absent` — `""` for the kit,
`"as written"` for the tune — is the answer meaning "this cell says nothing".
Picking it CLEARS the chain; picking any other word while it stands REPLACES it,
which falls out of filtering it from the order rather than being a second rule.

**THE ORDER IS THE MEANING AND THE FIELD PRINTS IT** (`.nu-lzn`, 1, 2, 3…), from
two words up: a chain of one has no order, so the "1" beside a single standing
word — and beside "default" — is a number nobody can act on, and it is not
drawn. G15 measures the music on the reference phrase `portrait()` freezes the
whole catalogue with: `"inverted + the first half"` compiles to exactly two
operators and equals `K.excerpt(0,8)(K.invert(4)(REF))` applied by hand — degrees
`[4,3,2,1,0,-1,-2,-3]` twice over (`excerpt` loops the eight it kept), which is
the INVERTED phrase's first eight notes and not the inversion of the whole.
`invert` and `excerpt` COMMUTE (one is pointwise on the degrees, the other picks
positions), which is a fact worth writing down rather than asserting past; the
order claim is made on a POSITIONAL pair, `"the first half + a beat later"`
(`[4,5,6,7,0,1,2,3]…`) against `"a beat later + the first half"`
(`[2,1,0,1,0,1,2,3]…`). G15b makes the same claim for the kit: over
`four + backbeat`, `"ghosts + accents"` is `accents` over the ghosted kit —
snare `[0,0,0,3,9,0,0,3,…]` against `ghosts` alone `[0,0,0,2,1,0,0,2,…]` — and
is neither of its words nor the other order.

**UNDO IS ONE TAP, AND THE GATE HAD TO SAY SO BEFORE IT WAS.** One tap is one
`w.set`, which is one document write through `avail.js`'s own door, which is one
undo step — and `src/table/grid.ts wrapOps` wraps `set` and `clear` and knew
nothing about `setChain`, so the first draft of this round shipped a chain that
reached the SOUND and not the STACK. Measured on the rendered phone by T15c
before the line existed: two picks on a drums cell, then Ctrl-Z, and the
document did not move at all. This is the branch's characteristic bug —
declared, costed, and not arriving — caught by driving the artifact rather than
by reading the code. The fix is one clause beside `set`'s own. `test/table.browser.js`
T15c drives it on the rendered phone: two picks write `"a + b"`, the CELL in the
grid reads the whole chain, one Ctrl-Z takes the second word off and leaves the
first standing, `default` clears, and the pane's `scrollTop` never moves.

### 15a · The two labels go

*(2026-09-06. Paul, verbatim: **"Get rid of the words 'the record' and the
Section header entirely—we can make room."** And, the same afternoon:
**"In the song section area I can drag it too far right and then the whole
thing moves including the fixed parts. So it all feels reel wobbly."**)*

Two rows at the top of the sheet cost two full lines of a phone and both said
what the thing under them already was. `THE RECORD` sat to the left of a line
that reads `84 BPM · 4/4 · G♯ natural minor`; `SECTIONS` sat over a column head
that prints SECTION. **The words go, every function stays, and the grid gets
the room.** Measured under `devices["iPhone 14"]`, DPR 3, `isMobile`,
`hasTouch`, at 390 × 844 and 320 × 844 plus 1280, on **Kingston 1969**, the
**Silence record** and **Coach House** (10 players, 14 sections, imported
through the Export sheet's own `<input type="file">`). The probe is
`scratchpad/design/no-labels/probe.cjs`, before and after on the same tree.

#### THE RECORD ROW IS ITS OWN FACE

`special.record.word` is deleted — from the row, from `special.ts RECORD`'s
shape, and from the copy catalogue. The face is the line now: it reads from the
START, at the body's own ink rather than a face's `--dim`, because it is no
longer a value hung off the end of a heading. Nothing else moved: the row is
still the sheet's first, still one `--tap` line, still `.nu-labelbtn` and not
`.nu-sphead`, still `aria-controls`-ing its seven, and the accessible name is
the disclosure's own two sentences — *"Show the record settings"* /
*"Hide the record settings"* — which is what a screen reader was told before
the word went and is what it is told now.

#### THE SECTIONS LABEL ROW IS DELETED INTO THE HEAD IT LABELLED

`gridLabel`, `.nu-gridlabel`, `.nu-labelcell` and `grid.sections.word` are
gone. Its two jobs are the frozen column's head:

- **the count** is drawn under that head's word, in the register the label's
  face wore (`--dim`, no uppercase, no tracking) — `13 sections · 76 bars`;
- **the fold** is that head's own tap. `data-k="tsections"` moved onto the
  button (an address does not move when a control does), with `aria-expanded`,
  `aria-controls="nu-gridbody"`, the `nu.band.grid.v1` preference, no `op()`,
  no `changed()` and no undo step — unchanged, all of it.

**WHERE THE COUNT SITS WHEN THE GRID IS FOLDED: exactly where it sits when it
is open, on a line that is then the pane's full width.** Folded, the head row
draws its CORNER and nothing else — the player heads and the `+` are not
rendered, the `<tbody>` and the mix row are `hidden` — so the head is a
344 × 44 line at 390 reading `SECTION   14 sections · 88 bars`, which is the
old label row's own layout. It has to stay: it is the button that folded the
grid and the only way back.

**AND THE COUNT IS UNDER THE WORD BECAUSE OF ARITHMETIC, NOT TASTE.** The
corner is `--headbase` — 8ch, **measured 81.4px** on both phone widths, 73.4
inside the cell's padding and **66.7 inside the button's** — and it may not
grow: at 390 the players are 70px apart and 364.4 − 81.4 is *exactly* four of
them, so a corner one pixel wider shows three and §14's own number regresses.
`14 sections · 88 bars` is 121.3px on one line and wraps to two inside 66.7.
Three lines of 12.48px is **37.4px, inside the button's own 44px floor: the
count costs the head band nothing** (53.3px before and after, against §13b's
phone ceiling of 56).

**A NO-BREAK SPACE BEFORE THE `·` WAS TRIED AND MEASURED OUT.** The plain
string wraps as `14 sections` / `· 88 bars`, with the separator leading the
second line. Binding it to the word before it needs **68.6px** against the
button's 66.7, so the nbsp broke the line one word EARLIER and gave three lines
(`14` / `sections ·` / `88 bars`). Two lines with a hanging separator beat
three; the 1.9px could have come out of the button's padding, and a line that
fits by 0.8px on one record is a line that wraps on the next.

#### WHAT IT COST, SAID PLAINLY: `tcorner` LEFT THE CORNER

The corner already held a control — `tcorner`, *"Song options"*: fill from the
genre, re-seed, transpose. **81.4px does not hold two 44px targets** (the word
is 40.4 plus 6.7 of padding, and a `--tap` sibling is 44: 91.1 against 73.4),
and **stacking them costs 34.7px of head band, which is the 45px the label row
just gave back** — measured, that puts the grid back at nine sections. So the
head holds one control and it is the fold, which is what Paul asked for.

`tcorner` is at the END OF THE RECORD'S LINE now, a `--tap` square (measured
44 × 44) wearing `ui/glyph.js`'s own gear, in the shape `.nu-spclose` already
is at the other end of an open row. **Its address, its open key, its fields,
`STICKY`'s exception for it and `openCorner()` are all untouched** — only where
the button stands changed, and with it where its SHEET is drawn: it was an
orphan at the top of the `<tbody>` (which is where a column head's sheet lands,
because a column has no row) and it is the record row's own next line now,
§13a.3's law. **That is not tidiness: the `<tbody>` is `hidden` while the grid
is folded, and the gear is the record's control and not the grid's — so left
where it was, a tap on it with the sections folded would have opened a sheet
nobody could see**, which is this branch's own characteristic bug. Measured in
all four states: at rest, gear open (`ttab-fill` and `ttab-transpose` on the
glass, one `.nu-spopen` in the head), folded, and folded WITH the gear open —
the sheet is on the glass in both of the last two — so `test/table-inventory.json` needs no re-filing: `tcorner`
is on the glass at rest with a 44px box, and `ttab-fill` · `ttab-seed` ·
`ttab-transpose` still open behind one tap on it. Scope-wise it is where it
belongs: two of its three ops rewrite the whole record and the third turns the
whole table, which is the argument §14 used to pull MASTER, PRODUCE and
PERFORMANCE up out of the foot.

#### AND A FOLDED TABLE IS ONE COLUMN, WHICH THE FIRST DRAWING GOT WRONG

`nCols` returns **1** while the grid is folded, and that is a fact about the
rendered table rather than a convenience. Under `table-layout: fixed` the FIRST
row decides the grid, and the record's merged `<th colspan="12">` cut a 358px
pane into twelve: **measured, the corner came out 18.5px wide with its own
count wrapping 187px down the screen.** With `nCols` honest, the folded table
declares one `<col>`, takes `--panew` for its width (`.is-folded`) and has
nothing to scroll sideways — `scrollWidth 364 = clientWidth 364` at 390.

#### THE NUMBERS

| | before (v295) | after |
|---|---|---|
| head rows at rest, all three records | **3** — record · SECTIONS label · heads | **2** — record · heads |
| where the grid STARTS inside the pane, Kingston / Coach, 390 · 320 · 1280 | **155.3px** | **107.3px** — 48px higher |
| …the Silence record | 147px | **99px** |
| **sections whole on the glass at rest, Kingston 1969** (13), 390 · 320 · 1280 | **9** | **10** |
| **sections whole on the glass at rest, Coach House** (14), 390 · 320 · 1280 | **9** | **10** |
| the Silence record (1 section) | 1 | **1** |
| the pinned band (the column heads) at 390 / 320 | 53.3px | **53.3px** — unmoved, count and all |
| the corner head | 81.4 × 53.3, `SECTION` | **81.4 × 53.3**, `SECTION` over `14 sections · 88 bars`, its button 73.4 × 44 |
| players whole on a 390 screen (Coach House) | 4 of 10 | **4 of 10** |
| …on a 320 screen | 3 of 10 | **3 of 10** |
| cells printing a word, Coach House / Kingston | 140/140 · 87/91 | **140/140 · 87/91** |
| overlapping cell pairs, every record, every width | 0 | **0** |
| the folded head at 390 | the label row, full width, with the count | **the corner, 344 × 44, with the count** |
| the folded table's sideways slack at 390 | — | **0** (`scrollWidth 364 = clientWidth 364`) |
| page errors, console errors | 0 | **0** |

#### NOTHING RUBBER-BANDS

> *"In the song section area I can drag it too far right and then the whole
> thing moves including the fixed parts. So it all feels reel wobbly."*

**MEASURED FIRST, at 390 on Kingston 1969 (v295):** the pane is
`clientWidth 364 / scrollWidth 625`, `scrollLeft` clamps at **261**, there is
**no dead space** to the right of the table, and the frozen section column's
left edge is **16px at rest and 16px at maximum scroll**. The page itself does
not scroll sideways (`documentElement.scrollWidth 390 = clientWidth 390`). So
there is no layout fault under the complaint.

**CHAINING IS NOT BOUNCING, and that distinction is the whole fix.**
`.nu-pane` carried `overscroll-behavior-x: contain`, which stops the gesture
CHAINING to the scroller behind it — and still lets the pane rubber-band inside
ITSELF at its own end. A rubber-band translates the whole scroller, `position:
sticky` children included, which is exactly *"the whole thing moves including
the fixed parts"*. `html` was at `auto`, so the document could bounce too, and
on iOS Safari a document bounce visibly shifts `position: fixed` chrome — our
bottom bar. **`overscroll-behavior: none`** on `.nu-pane` (both axes; the pane
scrolls both), on `.nu-sheetwrap`'s table pane, on `#atlasJump` (the other
strip a thumb drags sideways — that strip is deleted on 2026-09-06, Paul: *"Get
rid of the buttons for eras like 'the old Stone Age' those all go"*, and the
rule went with it; nothing else in the picker scrolls sideways) and on
`html, body`. The vertical-only scrollers
— the sheet wrap's own boxes, `#nu-menu`, `.nu-strip-out` — keep `contain`:
they were not what a hand drags sideways and nothing measured says they bounce.

**AND THE DOCUMENT'S `none` HAS A SECOND GAIN worth saying out loud rather
than hiding as a side effect**: `overscroll-behavior-y: none` on the page turns
OFF pull-to-refresh, so a downward flick at the top of the sheet can no longer
reload the box in the middle of an edit.

**WHAT THE GATE CAN AND CANNOT MEASURE, said in its own comment.** A headless
engine does not rubber-band, so **T13q reproduces no feel**. It holds the
DECLARATIONS (`overscroll-behavior-x` and `-y` are `none` on the pane and on
the document element) and the three facts that say there is nothing else under
the complaint: the pane's `scrollLeft` clamps to `scrollWidth − clientWidth`
(measured 261 · 331 · 471 · 541 and got exactly that), the frozen column's left
edge is identical at rest and at that maximum (15.8 both), and the page's
`scrollWidth` still equals its `clientWidth` at both widths.

#### THE GATES

`test/table.browser.js` **T13m** is rewritten off the label row and onto the
head that took its jobs: the label row is gone, the corner prints its own word
with the count UNDER it in a different ink, it is ONE button at `tsections`
with `aria-expanded` and `aria-controls`, it is 44px and the band is still
inside §13b's ceiling, and the grid starts at ≤ 116px — the measured budget for
a tenth section row (67.5px apart in a 788px pane). **T13p** asks the fold of
the same head: what goes is the body, the PLAYER heads and the mix row, and
what stays is the record's line, the head itself and its count, with the store,
the undo stack, the scrollTop and the reload claims unchanged. **T13q** is new
and is the wobble's. **T14a** drops `/^the record$/i` for the opposite claim —
no `.nu-spword` on that line at all, the face starting at the line's leading
edge in the body's ink — and asserts the second button by name, box and
position. `test/table.browser.js` **T10a**'s row ORDER drops `"label"` — the sheet's
head is `record · rules · time · chords · motifs · master · produce · perf ·
heads`, nine rows where it was ten. `test/copy.test.js`'s two same-text
exemptions
(`glyph.sec.list`/`grid.sections.word`, `exportTab.json.what`/
`special.record.word`) are deleted with the keys they exempted: an exemption
for a key that does not exist is the same orphan the key would have been.

**`test/table-inventory.json` IS NOT TOUCHED**, and that is the point of moving
the button rather than the door: `tcorner` is still a `data-k` on the glass at
rest with a 44px box, and the three `ttab-*` rows still name it as their
`open`.

**AND THREE GATE SELECTORS LEARNED THAT A FOLD IS NOT A SHEET, FOR THE THIRD
TIME.** `.nu-labelbtn` exists because a disclosure must not answer
`[aria-expanded="true"].nu-sphead` — every "shut whatever is open" gesture uses
that shape. The corner has worn `.nu-rowjump` (the row head's class) since the
table was drawn, which was free while its `aria-expanded` was FALSE at rest;
it is TRUE at rest now. **MEASURED the hour it landed: T9m and T9n went red
with every height at 0, because `shutAll()` had folded the whole grid away
before them.** So the fold takes `.nu-rowjump`'s BOX and not its class
(`.nu-corner` is named beside it in the stylesheet), and the two selectors that
exclude `.nu-labelbtn` by name — `test/sheets.js`'s "is a sheet already open"
and `test/table.browser.js`'s two shut gestures — exclude `.nu-corner` too.
