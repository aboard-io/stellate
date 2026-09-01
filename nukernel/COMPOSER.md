# COMPOSER — the round of 2026-09-01

> Paul's brief, in one sentence: *"this isn't a genre player. This is a
> composition environment that 'knows' an enormous amount about song structure
> and helps composers think in whole songs."* Everything below serves that
> sentence. The experience is BUILD THE BAND: pick a genre as a starting point,
> then add and take away players and motifs and hear the song evolve.
>
> **How to read this file.** §1 is the brief, quoted where a quote settles
> something. §2 is the design — the decisions, with every reversal of a
> standing law named and dated. §3 is the build order (workflows, one agent at
> a time on `ui/eight.js`). §4 is the gate contract. §5 is what comes after.
> The thirteen subsystem maps this plan was written from are in
> `scratch/maps-2026-09-01/*.md` (nav, seed, tempokey, motif, band, mix,
> produce, saver, rules, playing, css, gates, genrelist) — every file:line seam
> and every gate that will go red is listed there; **read your slice's map
> before you build.** The standing laws still apply: check the parent first,
> the conversion is done by EXTRACTION never by hand, keep like with like, one
> owner per fact, no silent grey, test the artifact, one run of the relevant
> gates is enough, and never render to test unless the render is the subject.

---

## 1 · THE BRIEF

Paul, 2026-09-01, quoted:

| # | deliverable | the sentence |
|---|---|---|
| **B1** | new seed every session; seed slider | *"Boot up every new session with a new seed unless there's a seed in the URL. When I click seed pop up a vertical slider from zero to 2^16."* |
| **B2** | transport to the bottom | *"Move the play/stop button to the bottom, along with opts and where."* |
| **B3** | the blank state | *"Add a 'silence' genre at the top of the genre list. This is a blank state."* |
| **B4** | the design system | *"The design system is not consistent. It uses very little color, and things are uneven based on how text wraps. Things like select boxes are very plain and could be combo boxes. Lots of niceties have been skipped."* … *"Many inner sections lack any padding and just smash into the nav."* |
| **B5** | the nav is the spine | *"The left nav is very good. I think it should be bigger with bigger type and we should really work hard on nesting options inside the left nav … keeping everything vertically scrollable and usable. We should never need the 'up' icon because we can expand multiple levels of interface option."* … *"We should focus on the simplest UX and keep like with like."* |
| **B6** | Rules | *"I click the genre, it starts to play, and there's a new view: A genre editor appears. This is the 'Rules' section; it'll need a new icon in the left nav. The genre data is expressed as logical sentences and rules derived from the data in the genre. They should be readable to a musician. You can edit them, add new rules from a palette, and set thresholds. It's a code-editing experience but it feels like simple sentences. The motifs don't need to be editable. Just the structural rules. The name of the genre should be obvious."* |
| **B7** | Tempo and Key | *"Tap tempo, the tempo editor appears, same for key. The tempo editor does not reflect the richness of our tempo options. Key may not either. … The left nav elements for tweaking tempo should be brought inside tempo."* |
| **B8** | Motifs | *"Motifs are editable using our existing interface, but note that the 'ghosted' sections are doubling UX elements. It should be easy to make new motifs, and you'll need an icon strategy … the motif editor should show me previews of the instruments using the motif."* |
| **B9** | Structure | *"Sections/Structure has the same challenges. Things should fly out under the nav item for each structure element. It should be top level, not buried under band, and below band. Bring performance into structure."* … *"Make a section automation interface for the manipulation of the motifs and put it under structure/sections … Every section I can tweak every instrument. … for each question you add per section, you could have a WHOLE section automation grid."* |
| **B10** | Band | *"On the nav I need to know what they're playing as instruments. I need you to light them up when playing them actively in the nav. List all the band members as separate boxes. I need an obvious way to assign multiple motifs to band members. Maybe a tray of motifs that pops up, but it should also give me the option to make a new motif and jump back the motif editor."* … *"I want to BUILD THE BAND … I can hear the song evolve as I add and take things away."* |
| **B11** | Mix | *"Instead of having four icons on top and section automation that should have been five subicons under the 'Mix' icon. One of them is section automation. … the columns should list the instrument and when I click on the column head let me edit the instrument! Light up which instrument is playing, make a little volume meter INSIDE the heading. … I need to be able to jump to a section somehow, by clicking on them when in automation."* |
| **B12** | Produce | *"The only verb is 'make' from now on. Make X Y. The implementation is good but the design is confusing and feels unconsidered. Design a good producer interface."* |
| **B13** | Screensaver | *"screensaver is just a bunch of stars. It should be the little aliens dancing, not the infinite wandering."* |
| **B14** | the aesthetic | *"classic-era System 8/9 MacOS — lots of previews, small widgets, dynamic nav/menus, and flyouts. Perhaps we should experiment with strips that fly out to give us access to all options, like MacOS system settings used to."* |
| **B15** | later, same session | *"I can't really access or organize samples used in, say, San Francisco 1996. They aren't accessible to the app in any way."* and a list of ~45 representative artists for new genres, *"Make heavy use of our MIDI archive for these, don't just imagine"* … *"you should also search the MIDI library for many more genres while you're in there."* → §5. |

And the standing permission: *"All genres can be edited, everything is on the
table. There is no released version here. You can do absolutely anything to
achieve the dream."*

---

## 2 · THE DESIGN

### 2.1 The nav is a tree, and it is the spine

The gutter (`#nu-tray`, built by `trayRow`/`paintTray` in `ui/eight.js`)
becomes ONE TREE. This reverses three dated laws, each named here so the
reversal is on the record:

- **2026-08-28 "one vertical stripe max with an 'up' icon"** → REVERSED by B5:
  there is no ↑ anywhere, ever. Several branches may stand open at once.
- **2026-09-01 (morning) "only two levels but pop up a second shaded
  under-level"** → SUPERSEDED the same day by B5: depth is unbounded, and the
  shaded splice (`sub: true`, `.nu-sub`) is replaced by real tree rows with a
  `depth`. Paul's own words for why: *"the 'ghosted' sections are doubling UX
  elements."*
- **2026-08-30 `--tray-w` 56px / `.nu-vh` .55rem** → REVERSED by B5 "bigger
  with bigger type".

**The model.** A node is `{ key, glyph, word, sub?, say, on?, exp?, why?, act?,
node?, live?, kids?() }`. `kids()` returns child nodes (lazily, at paint time,
so a level with nothing in it is not a level — the existing rule). Page state
is `openTab` (unchanged) plus `expanded: Set<key>`. `trayNow()` becomes a tree
walk that returns a FLAT row list, each row carrying `depth`. `TRAYSUB`,
`TRAYUP`, `TRAYTAB`, `trayLevel` and `__eightUp` are DELETED (a
compatibility `__eightUp` collapses everything and returns `"root"`, so the
nine gate callers keep working until rewritten). The list signature includes
`key:depth` for every row, so a repaint in place can never paint the wrong
rows. `data-k` keys keep their current spellings (`toptab-*`, `tab<voice>`,
`facet-*`, `secnav<id>`, `motiftab-*`, `boardtab|…`) — an address does not
move when a row moves.

**Marks.** Exactly one `<mark>` / `aria-pressed="true"` in the stripe: the
deepest OPEN thing (shell A6c stands). Every expanded ancestor wears
`aria-expanded="true"`. A level of actions still declares `acts` per branch
(no mark, no aria-pressed). A SOUNDING member wears the class `is-sounding`
on its button (never `<mark>`): a red (`--clock`) edge bar, the paint the
playhead already wears everywhere. The stripe is outside `#app`, so the
frozen-page law is satisfied structurally; the sounding paint is written only
from `lightStep` and cleared on stop. `paintIcon`'s face signature grows a
`sub` (second-line) field so the instrument line repaints in place.

**Tapping a node** opens its panel (its `act`) AND toggles its expansion. Tap
a tab → its panel opens and its children unfold under it. Tap it again → it
folds. Other branches are left as they were. Nothing ever scrolls sideways;
the list is the only scroller (already so).

**Geometry.** `--tray-w: clamp(72px, 24vw, 136px)`. Under 96px the mark is a
column (glyph over word, as today, word at `--t1`); from 96px it is a ROW:
glyph at left, then two text lines — the word, and a dim `sub` line (a member's
instrument, a motif's readers, a section's bars). Depth is an edge bar whose
inline-start padding grows `--s3` per level (the 2026-09-01 "no indent"
refusal was about a 47px column; at ≥72px the arithmetic is different, and
the re-measurement goes in nu.css beside the old one). 44px tap floor stands.
`body{padding-inline}` follows the token, as do `.nu-log`/`.nu-explain`/
`.nu-say` — one edit.

**The root.** Order, top to bottom: **Rules · Tempo · Key · Motif · Band ·
Structure · Mix · Produce · Score · Video · Screensaver · Export.** `Where`
leaves the list for the foot (B2). Paul's 2026-08-27 tab sentence stays the
quotation in the gates; the two new words and the move are appended to it as
dated sentences (B6 "new icon in the left nav", B9 "top level … below band",
B2 "along with opts and where"), never edited into the old one.

**The foot** (pinned bottom, never repainted, order top→bottom):
1. `Where` — a permanent GENRE NAME PLATE: glyph ⊕, word = the genre's
   human name (wiki title if any, else the key), sub = "Kingston 1969". Tap →
   the Where panel. This is where "the name of the genre should be obvious"
   is answered — one plate, on screen at every level, redrawn by `showing`.
2. `seed` — glyph ⚄, word "seed", sub = the number (`#reading` stays this
   readout; `#rewrite` stays the id on this button). Tap → the seed flyout
   (§2.2).
3. `?` (explainer) · 4. `¶` log — unchanged.
5. `opts` (`#playops`, now with a glyph ⚙ — the acknowledged debt) — tap →
   the play options unfold as rows ABOVE it inside the foot (mode, take,
   voicing, the vertical room fader), pushing the list up; `aria-expanded`
   still tells the truth.
6. `▶`/`■` (`#play`) — the very bottom, thumb reach.
The countdown `.nu-count` stays at the top of the foot. The foot is a
`flex:0 0 auto` box that is LAST; the list above it is the one scroller.

**Children per root node** (each row's panel = the tab's panel scrolled to
that thing; children are what today's levels already build):
- Rules → the eight axes (jump chips into the Rules panel).
- Tempo → (no children — the eight tempo ops move INTO the panel, B7).
- Key → none.
- Motif → one row per cell (`motiftab-*`, glyph ♪/◉, sub = "N bars · read by
  cantor, schola"), `+ motif`, `+ drum pattern`. A cell row expands to its
  fourteen transforms (`acts`), as the `motifops` level does today.
- Band → one row per MEMBER (`tab<name>`, glyph = kind, sub = the
  INSTRUMENT name, `is-sounding` while it sounds), `+ line`, `+ bass`,
  `+ drums`. A member expands to: `instrument`, `plays` (the motif tray),
  `mix`, `remove` (acts). The `sec` facet leaves the band (it lives in
  Structure, §2.6).
- Structure → one row per section (`secnav<id>`, word `verse 2`, sub =
  "8 bars · pace", `is-sounding` while it sounds), `+ section`,
  `performance`. A section expands to `up · down · duplicate · remove`
  (acts).
- Mix → `genre fx · delay · reverb · main · section automation` (keys
  `boardtab|bus|<k>` and `boardtab|auto|auto`) — the five sub-icons (B11).
- Produce / Score / Video / Screensaver / Export → Score keeps its two views;
  the rest have none.

### 2.2 The seed

The seed's one owner stays `ui/atlas.js`. Changes:
- At boot the atlas draws a random integer in **1..65535** (`crypto` if
  present, else `Math.random`) unless the URL fragment carries `s=`. A URL
  with `s=` but no place is honoured too (the basis is the box's own). The
  clamp becomes 0..65536.
- **The boot composes nothing and writes no address.** The blank state
  (§2.3) is what stands at boot; the seed is shown in the foot; the first
  genre tap composes at that seed and starts playing. A reload of a
  never-touched box therefore draws a new seed; a reload after a pick keeps
  the address's seed (a seed in the URL). `writeLink()` runs only after a
  hand has moved something (pick, roll, slider, tab).
- The seed flyout (a `.nu-strip-out`, §2.10) holds: a vertical slider 0..65536
  (`vchassis`, step 1, with the number typed above it in a `<input
  type=number>` so a specific seed can be entered), **roll** (random; this is
  `#rewrite`'s job and keeps `rewriteNow` as the one reseed path), and
  **next** (+1). Any move recomposes the current basis at the new seed
  through `ATLAS.setReading(n, done)` — the new setter — and, if the record
  was playing, starts it again. Album mode rolls.
- `precompose`'s "seed ≤ 1 is the idiom as written" stands; 0 and 1 sound the
  same and the flyout says so under the slider ("0 and 1: as written").
- Reversal named: **2026-08-27 "reading 1 is today, the atlas opens every
  anchor at seed 1"** → a hand-landed record is at the SHOWN seed. Gates that
  tapped Kingston and expected seed 1 now set `s=1` in the URL first.

### 2.3 The blank state: `silence`

A real row in `genres.js`, keyed `silence`, label `"Silence"`, `silent: true`,
`plan: "song"`, `bpm: 100`, `voices: 0`, `instr: []`, `kit: {}`, `nobass: true`,
`harmony: "modal"`, `family: "kernel"`, the three closures, and `words:
["nothing yet — build the band"]`. `genreToDocument` on a `silent` row returns
ONE section (`head`, 8 bars), ZERO voices, ONE line cell of sixteen rests
named `motif`, `time` at the row's bpm, and the row's alphabet. This needs
three explicit, named exemptions (the `STEADY` opt-out shape): `precompose.js`
skips the guest stack and the "a record with no kinds is given a hook" repair
for `silent` rows; `test/precompose.test.js` G1-onset, G3-shapes, G4-silent
and G0's count (395 → 396, the literal stays a literal) exempt `silent` rows
by name; `test/instrumentation.test.js` skips rows with no chairs. The atlas
declares it in `EXCLUDE` with the reason "the blank state has no place" — the
"six roles" assertion becomes "six roles and the blank state" (7). `wiki-extract`
gets a NOLINK row. The genre list pins the row ABOVE `ALL` (a third loop before
the year loop), with no `data-place`/`data-year` so the sweep skips it; its
plate reads "Silence" and plays (the blank state IS playable — it is a bar of
rests looping, the transport works, the band can be built into it). The boot
basis (`songs.js TERMS.basis`) becomes `silence`; the shipped chant fixture
stays the document gates' subject by loading it explicitly.

### 2.4 Rules — the genre as sentences

A new data-tier module `nukernel/rules.js` (UMD, like `askable.js`) and a
view `ui/rules.js`; a new tab `Rules` (host `#rulesdeck`, glyph `§`, h2
"The rules"). The map `scratch/maps-2026-09-01/rules.md` §8 and SEAMS carries
the grounded grammar; the summary:

- **RULES is a table, one row per STRUCTURAL genre field**, shaped
  `{ field, axis, say(g) → [parts], edit: {kind, table|min|max|step}, write(g, v),
  rederive: "compose"|"render"|"row", why?(g) }`. Every option list is a
  REFERENCE to the owning table (`fields.js`, `genres.js` MODES/SCALES/PROGS,
  `compose.js` PLANS/PACES, `ideas-kit.js`), never a copied word list. The
  thirty sentences in rules.md cover 96% of the declared surface; the motif
  vectors (`kit kits kitVel kitProb fill bassGrid ghost`) and the document's
  cells are NOT rules (askable.js's own scope law) and are shown as one
  read-only line each ("the beat is written in the motifs").
- **Thresholds.** `bpm` gains an optional companion `jitter` (absent = ±4,
  byte-identical) read at compose.js's one bpm line, so "the tempo is 125,
  give or take 4" is a sentence with two editable numbers. `swing`, `stress`,
  `phrase`, `touch` are single numbers with the table's rungs as detents.
  `paces[role]` is per-section and editable per role the plan owns.
- **Closures** (`entry reg realize word`) are printed as sentences and refused
  for editing with the reason "written as a formula"; `part[]` and `cast.reg`
  already override `realize`/`reg` and are the editable rows.
- **Where an edit lands.** The document carries `doc.rules = [{f, v}]`
  (validated in `song.js`, survives normalize, saved, shared). Composition
  becomes `genreToDocument(gk, seed, rules)`: the row is resolved
  (`applyRules(GENRES[gk], rules)` → a COPY; `GENRES` is never mutated, so
  purity and share links stand). `rederive:"compose"` rules re-run
  `genreToDocument` at the current seed and land through `CTX.setDocument`
  (restarting playback if it was playing); `"render"` rules go through
  `changed()`; `"row"` rules change nothing that plays. The view says which,
  on the row, before you press.
- **The view** is built the way `ui/explain.js` builds its tables (`row`/
  `pair`/`tableOf`/`nameOf`/`progWord`/`lineage` are REUSED, not restated):
  a name plate at the top (the genre's name, place+year, the lineage line),
  then the eight axes as blocks, each sentence a row whose slots are controls
  (a `.nu-combo` for enums, a range for numbers, a chip list for arrays), a
  "reset" per row that the genre still says, and at the foot of each axis a
  **palette**: `+ add a rule` listing the rules this row does not declare,
  greyed with the measured reason when meaningless (rules.md SEAMS "a palette
  of addable rules"). Every word is a control label, a value, or a refusal —
  the text diet's three kinds — so the panel costs the diet nothing it cannot
  earn.
- **Arrival.** Tapping a genre in the list (and a mark on the globe) composes,
  starts playing (already true), and `showTab("Rules")`. A genre chosen from
  the blank state therefore lands on its rules with the band already playing.

### 2.5 Tempo and Key

**Tempo** (`timeAxis`): tempo readout big at the top (`--t5`), bpm range,
**tap tempo** (a 44px button; the median of the last four intervals writes
`time.bpm` through the same key), the eight `TEMPOS` operations as a wrapped
row of buttons IN THE PANEL (the `tempo` tray level and `TRAYSUB.Tempo` are
deleted; `tempoTrayItems` becomes the panel row — the 2026-08-28 "move the
tempo nav to the right nav" is REVERSED by B7 and the tombstone at
`eight.js:7348` says where it went), then meter · swing · **groove** (new
`time.groove` sheet in `avail.js` over `GROOVELABEL`; the derived word stays
the default detent) · rate (owned by the four rate ops, no select), a
**rubato** switch (`setRubato`), and a **pace strip**: one row per section,
its pace word as a combo (`form.pace`, a new `fields.js` FIELDS row with
`scope:"box"` so `nudgesFor` and the sheets loop carry it; the engineer's
"pace is display only" sentence is reversed in place). The gain pointer stays
last.

**Key** (`alphaAxis`, heading "Harmony"): the circle of fifths (unchanged, and
tapping a relative minor no longer clobbers a non-12-TET mode — it sets
`aeolian` only if the mode is 12-TET), the mode combo listing all TWELVE with
a caption for non-12-TET rows ("shur · 1.5 = a quarter-tone", "slendro ·
period 12.08"), a **scale** combo (new `alphabet.scale` sheet over
`SCALES`/`SCALELABEL`), harmony, diatonic, and the changes grid with
`+ bar` / `− bar` and a degree slider whose rungs come from the mode's own
length (the slendro duplicate-rung bug is closed).

### 2.6 Structure — top level, with grids

New tab `Structure` (host `#pan-structure`, glyph ▦, h2 "The structure"),
between Band and Mix. It owns what `tabform`/`tabperformance` owned:
`sectionTrayItems`/`secOpsTrayItems` become its children (§2.1),
`openSection` lands here, `SONGTABS` shrinks to `[]` and `tab` becomes a
voice name only. The panel, top to bottom:

1. **The form** — the editable section list (role combo, bars, the number
   button). The number button is the JUMP: `CTX.playFrom(si)` (a new CTX
   hook wrapping `startAt(si)`; the queued jump lands on the box's first bar
   and the pending countdown already says when). Tapping it also opens the
   section's questions (the existing two-state rule).
2. **The grids** — one `.nu-trims`-shaped grid PER QUESTION, sections down,
   MEMBERS across, column heads = member name + instrument (tap → that
   member's instrument facet), the sounding row/column marked; each grid is
   its own `.nu-pane`. The questions, in order: **reads** (`material.cell`
   per member per section — the motif assignment; the bass cell says why it
   cannot), **does** (`dev.line`/`dev.bass`/`dev.kit`), **level**
   (`form.lvl`), **shape** (`form.env`), **pace** (`form.pace`), and the
   per-section nudges as one grid of sections × question (`intro outro mot
   period breath pipe nudge`). Cells are the SAME keys `formTable`'s picks
   variant emitted (`key|voice|section`), and that variant is DELETED so no
   key is drawn twice. Dim is derived, bright is set.
3. **Performance** — `performanceTab`'s controls, folded in as the last
   block (B9).

### 2.7 Band — build the band

The band panel shows ONE member at a time (the open one) or, with none open,
the ROSTER: every member as a box (name, instrument glyph and name, the motifs
it reads, a small gate-block thumbnail of its default cell, a play-alone
button = solo audition) plus the three add buttons. The member's facets:

- **instrument** — the instrument combo grouped by family (`familyOf`), the
  attack/release/double rows, the loop strip on sampled chairs, the knobs
  block. The bass gets an `instrument` at last (the `avail.js:641` tombstone
  names the three-line fix: `toGenre` carries `bass.instrument`, a
  `sound.bassinstrument` sheet, `hirePoolChair` retired).
- **plays** — THE MOTIF TRAY (B10): the member's part/register/entry rows,
  then a chip per motif in the bank (thumbnail + name, pressed if this member
  reads it anywhere, tap → assign as the default cell), a per-section strip
  (one combo per section for this member: `material.cell|v|s` — the SAME
  control the Structure "reads" grid draws, so the two must not be on the
  page at once: the band panel builds its strip only while its tab is open
  and tears it down on leaving, and the Structure grid likewise; `buildTab`
  already rebuilds stale panels — mark both stale on tab switch), and
  `+ new motif` which mints a cell, assigns it here, and jumps to the Motif
  editor with it open.
- **mix** — the channel strip (unchanged), now with a REAL meter (§2.8).
- **remove** — an act with its refusal.

Adding a member (`+ line/+ bass/+ drums`) opens its instrument facet
immediately with the audition primed, so the gesture is: add → hear it →
choose its sound → give it a motif.

### 2.8 Mix — five children, honest meters, a jump

`#boardtabs` (the in-panel row) is DELETED; the five stand in the nav (§2.1)
and `engineer.js` exports `showBoard(kind, key)` + `boardTabNow()` so the nav
drives `showPanel` without rebuilding the deck. Section automation becomes
`PLATES.auto` (a fifth plate). Its grid:
- column heads = a button naming the INSTRUMENT (voice name beneath, dim),
  tap → `CTX.openVoice(name, "inst")`; the head wears `is-sounding` while
  that voice has events in the sounding beat; inside the head a tiny
  horizontal `.nu-meterwell` (`data-live="meter"`) fed by a REAL per-voice
  measurement;
- row heads = the section's NAME (`secName`), a button, tap →
  `CTX.playFrom(si)`.

**The per-voice meter.** The refusal `METER_WHY` is retired the way the BLEED
refusal was, with the new measurement named. Two feeds, both real: (a) in
`engine/faust/live/live.js` `samplerOf`, every unit key gets its own gain →
`AnalyserNode` → `foundDests` (the chained branch is the template), and the
handle exposes `voiceRms(key)`; (b) Faust-lane units use the bar audit's
`rms` (`auditFor(serial)`), refreshed at bar rate and captioned "per bar".
`nukernel/audio/live.js` exports `voiceLevels()` → `{chanKey: rms}` joined
through a new `plan.js addrOf(si)`; `soundingChans()` answers "who has an
event in this beat" from `barPlan(curBar.n)` (automation and mutes already
folded in). The voice strip's refused well becomes the same measured well.
desk-gate's "exactly one `.nu-meterbar`" is rewritten to "one per column head
plus the master, each measured".

### 2.9 Produce — make X Y

`producer.js` keeps every mechanism; the GRAMMAR collapses to one verb.
`VERBS` = `[{id:"make", w:"make", d:"need"}]`; the five lost behaviours
become QUALITIES (ADJ rows with new mechanism hooks): `louder`/`quieter`
(the ±7 dB fader path), `gone` (silence), `back` (bringIn), `alone` (the
complementary scope — applyAdj gains a `scope:"others"` hook), and lane
creation rides `add`'s target list folded into `make`'s ("make the drums a
crash" = the bare/ADDPAT path). Old saved notes fold through ONE alias door
(`{v:"more"} → {v:"make", d:"louder"}` etc.) at `addNote`'s read, beside the
genre-only rename precedent. The page:

1. a name plate ("the producer · N of 10 said");
2. **the cast** as a wrapped row of chips — record, each drum lane, bass,
   each member, mix — pressed = the subject you are speaking about;
3. **the targets** for that subject as two sheets side by side on wide
   screens, stacked on phones: **qualities** (the adjectives, greyed with
   their reasons) and **records** (the chronological anchors this would
   move, with the hidden count); one tap says the sentence;
4. **the stack** — the notes table, each row "make X Y · 64% · what it did",
   with push/pull/drop and undo/forget (keys unchanged).
The sentence you are about to say is previewed live in the plate ("make the
drums busier") as you press the cast chip — a preview, not a ghost.

### 2.10 The design system — Enamel, made consistent

`nu.css` is still the one stylesheet; `PROGRAM.md §2.4` is updated in the
same commit. What lands:

- **Type/weight/radius scales** written like the spacing scale: `--t0 .6rem
  (nav label at the narrowest width only) · --t1 .72 · --t2 .82 · --t3 1 ·
  --t4 1.15 · --t5 1.5rem`; `--fw-body 500 · --fw-label 700 · --fw-block 800
  · --fw-display 900`; `--r0 0 · --r1 6px · --r2 3px · --r-pill 999px`. Every
  literal in the file is folded into a token or listed in the exemption
  paragraph. `<select>` never under 16px (iOS).
- **Two colour families that state a new kind of fact** (the four paints
  stand, "semantic never decorative" is extended in prose at `nu.css:10`):
  **CATEGORY = which player** (`--v0..--v3`, `--vb`, `--drum`, lifted from
  the unlinked `hw.css`, assigned by `voicePaint` order) — worn by the member
  boxes in the nav, the score's motif caps, the roll legend, the grid column
  heads and the strips, so one player reads as one colour on every surface;
  **LEVEL = how much** (`--q1..--q4`) for the step grids and weight bars.
  Both fall to neutral under `prefers-contrast: more`/`forced-colors`. The
  meter green finally does its job: every fader that reaches sound gets a
  green measured bar beside it (§2.8).
- **Padding.** `.nu-pan { padding: var(--s4) var(--s4) 0 }` — the one rule
  that ends the smash. `--gl` stays 0 (the outside stays edge to edge; the
  INSIDE gets air — Paul's 2026-08-30 sentence was about the outside of the
  views, and B4 is about the inside). `.nu-ax`/`#atlas` re-pay the panel's
  inset, not `--gl`. The step grids' 3.2px of slack at 320px is re-measured
  and, if it fails, the grids alone opt out of the inline inset.
- **Even rows.** `.nu-field` defined as the one even-row primitive (fixed
  `--tap` multiples, question on line one, control on line two, ellipsis not
  wrap, the `.nu-ixli` recipe), applied to `.nu-sel > label`; `.nu-sheet` gets
  `grid-auto-rows` and the reason sits under the grid, not inside the chip
  (still visible, still `.nu-why`, still read back by the gates).
- **Combo boxes.** `selectField` wraps its `<select>` in `<span
  class="nu-combo">`: `appearance:none`, the `::after` triangle, `.is-seated`
  (dim, at the default detent) / `.is-said` (hand). The control stays a
  `<select>` (the 2026-08-25 single-choice law stands and every gate that
  counts menus still counts them). Long lists (> 24 options: instruments,
  records) get a `.nu-combo-filter` — a small text field before the select
  that hides non-matching `<option>`s (via `hidden`), which is what "combo
  box" means to a hand.
- **`.nu-strip-out`** — the one flyout chassis factored from `.nu-log`,
  `.nu-explain`, `.nu-say`: fixed, anchored at `--tray-w`, panel plate, `--bw`
  ink, `--shadow`, own scroll, `[hidden]`. Used by the seed flyout and any
  future strip (B14). Nothing may overhang the gutter (shell A6i).
- **`.nu-preview`** — the small picture-of-the-thing tile: a 16-step gate
  block thumbnail (`<svg>`, one rect per step, velocity as height) used for
  motif chips in the tray, the roster, and the Motif nav sub-line.
- **`.nu-namebar`** — the ink plate name (from `.nu-busname`) used by the
  Rules, Band-roster, Structure and Produce name plates.
- Panel ordinals for `#videodeck`/`#saverdeck`/`#rulesdeck`/
  `#pan-structure`; the video/saver block brought onto the scales; the two
  `input[type=range]` skins reconciled to one.

### 2.11 Motifs

- The ghosting is gone with the tree (§2.1). The editor's faded rest rows stay
  (they are a refusal with its `data-why`, not a doubling).
- **New motif** everywhere it is wanted: the nav `+ motif`/`+ drum pattern`
  now DESCEND into the new cell (reversal of the 2026-08-28 "adding one does
  not descend", recorded in place); a `+ motif` button in the panel beside
  `+ measure`; `+ new motif` in the band's tray (§2.7). `NEWMOTIF` mints at
  the bank's own bar length and carries `acc`.
- **Rename**: a name field on the motif's name line; the write walks every
  `voice.material` string and map value (the `forkRow` walk) at ONE door in
  `document.js` (`renameCell(doc, from, to)`).
- **Previews of the instruments using the motif**: the "read by" line becomes
  a strip of member chips (category colour, glyph, name, instrument, and
  which sections in small), tap → that member's plays facet. Outside `#staff`.
- **Icon strategy**: a motif's mark is its KIND glyph (♪/◉) + ordinal in the
  nav, and its `.nu-preview` thumbnail wherever there is room (chips, roster,
  the Motif panel's own name line). No new pictures are invented; the shape
  IS the icon.

### 2.12 Screensaver — the aliens dance

> **REVERSED 2026-09-01, later the same evening, BEFORE any dancer was built.**
> The paragraph below first said "drawn on the same 2D canvas — no three.js".
> Paul, on reading it: *"Why not three js? It's fine. Don't reinvent."* So:
> **the real aliens come back.** THIS PARAGRAPH OVERRIDES ANY AGENT PROMPT
> THAT STILL SAYS 2D. The creatures are `app/starcruise/alien.js` (2465
> lines), `traits.js`, `geom.js`, `scene.js`'s dancer ring and `bridge.js`'s
> loudness/onset plan at commit **`f0f9d89`** (`git show f0f9d89:app/starcruise/alien.js`
> etc. — deleted by `4a4d730`), with `vendor/three/three.module.min.js` +
> `MarchingCubes.js` + LICENSE re-vendored from the same commit (NOTICE gets
> its three.js row back). Port, do not rewrite: put the creature files under
> `nukernel/ui/starcruise/` unchanged where possible, `import()` three.js
> and the creature module lazily INSIDE `mountScreensaver` (never at module
> scope; the mount stays synchronous and returns a stop() that cancels a
> pending import — the `starcruise-load.js` single-flight pattern), and
> replace `traitsFromGenre`'s missing `GenreVerifier.features()` with a
> `traitsFromDoc(doc, GENRES[doc.basis])` shim that fills the TRAITS shape
> (`groove:{bounce,sway,headbob,energy}` is all the dancer branch reads) from
> the genre row's kit/bpm/stress/swing/touch. The screensaver-lazy gate's S6
> offline regex is widened so a `.js` import is COUNTED and then the three
> module files are named as the sanctioned exception (they are local files,
> not foreign requests — the offline law is about the wire, and `vendor/`
> is on the disk); S7 launches chromium with the swiftshader flags the old
> `alien-dancer.test.js` used. The rest of the contract below stands.

`ui/screensaver.js` keeps its contract (synchronous mount → `stop()`, the
`.nu-saver-canvas` (now a WebGL canvas), `__saverFrames`, `__saverDrift` as a
growing number, park-on-`data-off` incl. disposing the renderer/geometries,
same-record-same-troupe) and replaces the wander with the starcruise DANCE
FLOOR. The troupe is dealt from `ihash(doc.basis)`: one alien per band
member (category colour where the creature's material allows), plus 0..4
extras by energy (the old `traits.js:611-620` gate). Each frame reads
`CTX.transport()` for the beat (position, never a clock) and a per-bar
loudness + per-member onset table derived ONCE per document from `songBars`
(the old `bridge.js:167 buildEventPlan`, re-derived over `ev` by kind).
Quiet = each on its own phase; loud = the troupe locks (the `alien.js:2038`
groove block, verbatim). A member's alien hops on ITS onsets and sways
otherwise; the stars may stay, faint, behind. Stopped = held, shimmering.

### 2.13 Genre list, name, and arrival

- The list pins `silence` first (§2.3). The chosen row plays and opens Rules
  (§2.4). `document.title` stays the label.
- `GLYPH.tab` gains `Rules §`, `Structure ▦`, `Video ▣` (closing the "•"
  debt), and `GLYPH.act` gains `opts ⚙`, `seed ⚄`, `tap ⏱`.

---

## 3 · THE BUILD ORDER

Two agents run at a time on this box (4 cores). `ui/eight.js` and `nu.css`
are each ONE file, so every wave that touches them runs ONE agent at a time;
data-tier work runs beside it. Agents do not commit; the parent commits at
the end of each wave with the gates named in §4 green. Every agent reads
`scratch/maps-2026-09-01/<slice>.md` first, and this file.

| wave | slot A (UI, sequential) | slot B (data / engine, parallel) |
|---|---|---|
| **0** | — | **0a** `rules.js` + `genreToDocument(gk, seed, rules)` + `jitter` + the `silence` row + its gate exemptions (§2.3, §2.4 data half) · **0b** per-voice meter in the engine + `voiceLevels`/`soundingChans`/`addrOf`/`barPlanNow` (§2.8 feeds) · **0c** producer collapse to `make` + alias door + producer gates (§2.9 data half) · **0d** the screensaver dancers (§2.12) |
| **1** | **1a** the nav tree, the foot, the width and type, the tabs `Rules`/`Structure` (hosts, glyphs, h2s, empty builders), Mix's five children driving `showBoard`, the seed flyout + `setReading` + boot-without-composing + `silence` at boot and pinned in the list; every nav/transport/tab gate rewritten (§2.1–2.3, 2.13) | **1b** the design tokens, `.nu-pan` padding, `.nu-field`, `.nu-combo` (+ `selectField` wrapper), `.nu-strip-out`, `.nu-preview`, `.nu-namebar`, category/level colour, the video/saver block, range-skin reconciliation, PROGRAM.md §2.4 (§2.10) — **in a worktree**, merged by the parent after 1a (nu.css conflicts are the parent's to resolve) |
| **2** | **2a** Tempo + Key (§2.5) → **2b** Rules view (§2.4 UI half) → **2c** Band roster/facets/motif tray + member lighting + motif previews/rename/new (§2.7, §2.11) → **2d** Structure tab + grids + performance (§2.6) → **2e** Mix plate `auto`, column heads, jump (§2.8 UI half) → **2f** Produce page (§2.9 UI half) | — (slot B idle or running §5 data work) |
| **3** | **3a** a PROBE agent drives the deployed staging page as a user through the whole story (blank state → seed → pick a genre → Rules → build a band → structure grid → mix → produce → screensaver), forbidden to fix, reports defects with evidence | — |
| **3** | **3b** the fix round from 3a's report; deploy | — |

Deploy = bump `sw.js VERSION`, then from a clean worktree of HEAD:
`rsync -a --exclude '.git' --exclude 'node_modules' --exclude '*.wav'
--exclude '*.mp3' nukernel engine sw.js root@stellate.app:/srv/stellate-test/`
(no `--delete`; the tree is pruned). A `tools/deploy/deploy-nukernel-staging.sh`
carrying exactly that lands in wave 1a so it stops being an incantation.

---

## 4 · THE GATE CONTRACT

- Every wave runs `node test/all.js --impacted` ONCE and the named gates for
  its slice ONCE; a red is fixed or its assertion rewritten IN PLACE with the
  old sentence kept above the new one and Paul's 2026-09-01 sentence cited.
  Never loosened, never deleted.
- Three gates are RED ON HEAD before this round and are not this round's:
  `test/gutter.js` T2 (`tabs === 9`) and T5 (reads `a.nu-ixw`), and the two
  misdeclared `kind:"node"` rows for `bench`/`text-diet` in `test/all.js`.
  Wave 1a fixes all three as part of its rewrite.
- The typed quotations (`PAULS_TABS` in shell.js, `TABS`/`HEADINGS` in
  text-diet, `EXCLUDE is the six roles`, G0's 395) move ONLY with Paul's
  sentences from §1 quoted beside them.
- New gates this round must add: a nav-tree gate (expand two branches, one
  mark, no ↑, every row ≥44px, no sideways scroll at 320/375/430/1280, the
  foot order, `#play` at the bottom at every state); a seed gate (boot draws
  ≠ 1 with no fragment, `s=` alone is honoured, the flyout writes through the
  atlas, `0` and `1` compose identically); a silence gate (the row is first,
  composes to one section and zero voices, plays); a rules gate (every RULES
  row's `say(g)` is non-empty on every anchor, every option word exists in
  its table, an edit re-derives deterministically and `GENRES` is unchanged
  after); a structure-grid gate (one control per `key|voice|section` on the
  page, never two); a meter gate (a per-voice RMS > 0 while that voice sounds
  and 0 while it is muted); a produce gate (only `make`, old notes fold);
  and a dancers gate (`__saverDrift` grows, N aliens = members + extras).
  Registered in `test/all.js` with `covers` so `--impacted` selects them.
- The text diet's ceiling is re-earned, not raised: a Rules panel is
  controls, values and refusals; if T1 goes red the fix is fewer words.

---

## 5 · AFTER THIS ROUND (queued, in order)

1. **The sample crate** (B15a): a `Samples` child under Band (and a facet
   on sampled members) listing every sample the record reaches — kit files,
   one-zone units, found/ beds — with audition, the loop strip, and a way to
   swap one for another from the same class; the `SAMPLES`/`SOURCES`
   registries are the owner, classified by the sample-CD pipeline's fields.
2. **The MIDI corpus round** (B15b): mine `/mnt/sources/relocated/
   stellate-midi-corpus/corpus.db` for the ~45 named artists AND for every
   cluster the corpus holds that the catalogue does not, using
   `tools/mine-midi.js` + `tools/corpus-db.js`; each new anchor is argued as
   a named record+place+year, parents/wants both ways, wiki ASK/NOLINK, atlas
   bake, and its structural rules are READ OFF THE CORPUS (bpm, meter, swing,
   prog, form), never imagined. James Taylor is revisited.
3. Score and Video: "fine for now".
