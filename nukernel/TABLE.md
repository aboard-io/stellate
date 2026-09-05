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
2. **Every special row is ONE LINE at rest** — TIME, RULES, PHRASES, MIX,
   MASTER, PRODUCE, PERFORM: `var(--tap)` tall, the word left, the sentence or
   the count right, a hairline under. No plate, no tint, no chips or lozenges
   inline, no lamp on a second line (the MOTIF lamp draws inside the PHRASES
   row's own line or not at all). The sentence is the one the row already
   says (`TIME  79 BPM · 4/4 · D natural minor`; `PHRASES  3 motifs`;
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
