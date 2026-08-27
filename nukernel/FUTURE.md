# FUTURE — the plan from the review round of 2026-08-26

Paul, 2026-08-26: *"muse and plan and sketch."* This is the plan; the sketches
are beside it in `nukernel/ideal/` (`design-system.html`,
`one-board.html`, `score-deck.html`, `composer.html`, `kernel-lang.html`,
screenshots in `scratch/ideal-2026-08/shots/`, uncommitted), and the three expert reviews it draws on — a
super-senior audio engineer, a musicologist, a product designer, each reading
the deployed page and the code independently — are quoted with their evidence
throughout §1 and §2, which is where they live. No file in the product moved
this round, on purpose. The standing laws bind every line below:
determinism, offline, EXTRACTION never by hand, one owner per fact, no knob
that cannot reach the sound, and TEST THE ARTIFACT — gates read the RENDERED
output, because the reviews just caught two defects that source-reading gates
had blessed.

---

## 1 · THE STATE OF IT

Three experts read the same shipped page and agreed on the diagnosis without
having read each other: **the model is better than the surface, and the tape is
worse than both.**

The audio engineer measured the deployed page, not the tree: **7.1 seconds from
pressing play to first sound**, and three ring underruns totalling 2.1 s in the
first minute of the shipped default record — while `test/soak-nukernel.js`
exits 0 locally, which is the exact failure TEST-THE-ARTIFACT was written
against. The cause is already named in our own contract: PROGRAM §4 F4, the
per-note channel strip (`sampler.js:1180` — 164 compressors on the lightest
record). Worse, two knobs do not reach the sound: the board's fader, mute and
solo are silent on every **modelled** voice (`audio/desk.js:759-787` says so in
its own comment — only the master fader got routed), and `tone.gain` reaches
the engine through **four different scalings** in `audio/to-engine.js`
(:326/:615/:742/:816). Both passed their gates, because desk-gate reads the
unit table, not the render. He counted **twelve multiplicative owners of one
voice's loudness across ten surfaces** — Paul's "spread everywhere," counted.

The UX reviewer measured the words: 3,688 chars of static prose against 2,813
of control labels, **74% of the prose in The board** — a routing essay that
cites `fx_bus.dsp:221` to end users. Gain wears four names on four surfaces
(volume/level/level/fader); "the changes" heads two different controls; the
producer is not last; the score sits mid-page, static, with no playhead and no
export row despite a working `.als` exporter; 109 controls sit under our own
44 px law on mobile; and the page's look is "an academic worksheet, not cool
new audio software." The page's best writing is its refusals — those survive.

The musicologist brought good news dressed as a wall: the engine is **not**
hard-walled at 12-TET — `to-engine.js:43-48` already carries sub-semitone pitch
as `bend`, honoured on the sampler lane. So Paul's repertoire list splits
cleanly: whole tone / serialism / Cage / thrash / bone flutes are **table
rows** (the kernel already owns reverse/invert/transpose, seeded pipes, and an
unclaimed `SCALES.whole`); quarter tones are a **kernel** change riding an
existing engine fact; and only three things are real structural work — metre
that changes inside a song, a continuous-pitch-contour channel, a tempo curve —
each already confessed in the genre table's own Tier-2 ledger
(`genres.js:7050-7200`). Free time (Noh's *ma*, alap) stays in `cannot`,
honestly: this is a barred sequencer to its bones.

One sentence of state: the eight-axes document is sound, the vocabulary is
sound, the gates are aimed at the wrong layer in two places, the surface has
too many owners and too many words, and the engine owes us five seconds.

---

## 2 · THE DECISIONS THIS PLAN PROPOSES

**One design system, bold primaries, chunky — Lampblack lasted a day and the
page was right to kill it.** REWRITTEN 2026-08-27. This paragraph originally
crowned Lampblack (soot neutrals, cream serif, thin rules, three muted
lights); Paul saw it and said *"I'd like the design to be bolder and use more
primary colors and chunkier. It looks like a funeral program."* He is right —
restraint read as mourning. What SURVIVES the reversal is the argument, which
was never about the hexes: ONE system, all sketches lose their palettes to it
(five palettes was the same accident as the four button looks §2.4 killed);
exactly three semantic lights — **the hand** (selection, set values), **the
clock** (playhead, `[data-live]`), **the meter** (measured engine output) —
now cast as loud flat primaries instead of embers; mono for the machine's
values. What dies with Lampblack: the serif (no serif anywhere), the thin
rules (borders are 3–4 px), the hush. The redesigned `design-system.html` is
the one owner of the tokens; board, bench, deck, songbook and libretto pages
consume them verbatim. Still one deliberate theme, not a dark/light pair —
two themes is two of everything (Q1 stands).

**Two new laws from the same sentence, 2026-08-27.** *"Vertical space is
cheap. Don't use knobs. Have simple vertical sliders stacked and labeled"* —
so: **no rotary knobs anywhere**; every continuous control is a vertical
slider, stacked and labeled, and a page may be tall but never wide. And
*"Rotate the piano roll interfaces back … I hate horizontal scrolling. Top to
bottom is always better than left to right. Obviously a musical score is
different"* — so: **time runs downward** in every grid, roll and lane; the
engraved score is the ONE lawful horizontal scroller on the product. These
outrank any layout in the sketches; the Bench and the piano roll rotate
accordingly (their paragraphs below are amended in place).

**The text diet is a law with a number.** Paul: *"get rid of all extra
text."* Three kinds of words may exist outside `[data-live]`: control labels,
refusals-with-reasons (one line, em-dash, measured — "40 is as slow as this box
counts" is the house voice and it stays), and value captions. The board's
1,629-char routing essay moves to `docs/`; signal flow is drawn as arrows, not
narrated; the producer's 285-char philosophy paragraph is deleted (the note
stack demonstrates what it explained). Target measured on the rendered page:
static prose from 3,688 chars to under ~900. No tooltips, ever — a finger
cannot hover.

**The renames land as one batch with the design system** (§5 table). One case
rule, no ordinal prefixes — "4–8 · The band" and "9 · The producer" of eight
axes are the numbering admitting failure (UX). The vocabulary keys do NOT
move: page heading changes are joins documented in AXES.md, exactly the
Material→"Sheet music" precedent.

**One board, and it is the only place a hand touches the sound.** The
engineer counted ten surfaces; the board sketch (`one-board.html` §III)
absorbs all of them: the engineer's per-voice pots (sheets keep a read-only
mirror that links to the board), the two foot tables merged into one console
scroll (channels → buses → master, down a strip = signal order), Time's stray
`sound.level` slider onto the master strip, and the desk's hidden per-section
shading onto the face. One gain lane per strip: the `lvl` enum retires into
the fader (old saves resolve on read); dim is derived, bright is set. The
delay return gets the `ret` fader the reverb already has (`fields.js:1177` —
the literal 1). `tone.gain` collapses to one exported `levelOf()`, behind a
frozen fixture proving the consolidation moved nothing. This reverses the
2026-08-24 D3 board being *a* surface among several; it becomes *the* surface.

**Effects go the way everyone else does them — per-voice inserts return,
and the buses run in series.** REWRITTEN 2026-08-27, and this is the largest
reversal in the file, made on Paul's own word: *"I think we need to do what
everyone else does with effects. Add per voice effects, up to three. Each has
a wet dry mix and its own settings. Have one bus for genre specific effects,
into a delay bus, into reverb, into main. Each instrument can send post
effects mix to all of the four buses."* That reverses his 2026-08-24 "Don't
let me add effects to instruments" and with it this paragraph's previous
decision (character dealt to bus chains, the record-wide embed dying, inserts
only as refused-with-reason exceptions). The architecture now:

* **Per-voice inserts, up to three,** each with a wet/dry mix and its own
  settings (vertical sliders, per the no-knobs law). The engine is READY for
  this half: the per-voice insert modules exist and ship
  (`engine/faust/dist/insert_*`, mono, most carrying a `mix` param), and
  MAX_FX = 3 is already the cap in `fields.js:53`. What changes is surface
  and ownership, not engine.
* **Buses in SERIES: genre-FX bus → delay bus → reverb bus → main.** The
  genre bus is where a genre's own character arrives by extraction — visible,
  editable, no longer stamped invisibly onto voices. The engine HALF-does
  this already: `fx_bus.dsp` bleeds delay into reverb at a fixed 0.2 constant
  — the serial chain generalizes that literal into a parameter and adds one
  new stage (the genre bus) ahead of it. That is the engine edit this
  decision buys, in place of the pooled character return the previous text
  proposed.
* **Four post-insert sends per instrument** (genre · delay · reverb · main).
  Today's per-unit `u.rev`/`u.del` grow two siblings; the settle round's
  facts still hold and still help — the send buffers are finished mono
  arrays with an applier (`chainBlocks`) already sitting at the seam
  (`stream-renderer.js:1029-1031`), and the idle ping-pong accumulator is a
  free third engine bus if the delay stage wants a stereo tail.

What survives from the reversed text, because it was measurement and not
taste: the stereo-voice trap (`desk.js:620` widthKept silently deletes insert
chains on stereo voices — under the new architecture that silence becomes a
refusal-with-reason on the third-party slot, never a silent strip); the
send-equivalence proof (`fields.js:404-446`) which now argues the DEFAULTS —
a genre chip lands on the genre bus unless the record explicitly asks for an
insert; and the cost law (an insert costs a multiple, a bus costs a constant)
which is why the genre bus, not the inserts, is where extraction puts a
genre's character by default.

**Per-section automation is a table, not a curve — the document shape is
materialAt's, the surface is the grid-and-lanes.** Paul: *"some voices raise
and some fall."* The code says per-section desk is inexpressible on purpose
(`eight.js:378-387`) "until somebody wants a chorus louder than a verse" —
somebody does. The engine side needs nothing: `partsOf(sec)` already reads
per box; only the writer shares one object by reference. So: `voice.desk`
becomes an entry OR `{"": entry, "<secId>": entry}`, resolved by
`deskAt(voice, secId)` — byte-identical when absent, exactly the §2.1
absent-is-today law. On the face, the board sketch's §II: a **grid you set**
(one cell per voice × section, cycling a six-word vocabulary — out · hush ·
back · as-mixed · fwd · lift, words from fields.js, never free floats) and
**lanes it reads**, drawn from the same table, playhead walking the sounding
column. Ramps stay the composer's (`sec.env`); the board's lane is discrete
detents, because this codebase is tables and a table is what a hand can trust.
This amends the engineer's dB-cells variant: words, not numbers, in the cells —
the fields.js law outranks the console convention. (Contested; Q3.)

**The page reorders: producer last to say, score last to see.** Sticky
transport → Where & when → Time → Harmony → Motifs → Form → The band → The
board → The producer (six verb chips + the note stack, zero preamble) → **The
score** at the foot: full-width, steady-speed scrolling (constant px/s, the
red ink is the only "now," sounding point a third in from the left),
notation | piano roll toggle sharing one clock, and one export row. Motif
labels on the staff are **extracted, never typed**: a thin bracket per span
wearing the motif's own tab name in small caps, the section word's operator
appended in the caption voice ("PSALM, in retrograde") — Wolzogen's names plus
Schoenberg's brackets, one owner. Uppercase letters stay Form's alone;
mixing the two alphabets is the classic student error (musicologist).

**The composing surface is the Bench — a lane that knows its harmony,
replacing the cell-row.** Paul: *"what UX can let us really compose wisely and
with knowledge of what we are doing? What UX can simplify and be modern and
simple?"* The shipped surface is measured in `composer.html`'s "Today" panel:
a bar is sixteen table rows read top-to-bottom (beat 4 below a phone's fold),
zero harmonic facts in view, the composed staff a second copy compared by
eye-travel, five controls per step. The Bench replaces it inside Motifs: time runs DOWNWARD (amended
2026-08-27 — "top to bottom is always better than left to right"; degree
columns run across the top, steps run down, note pills are vertical with
height = duration); the degree rows ARE the Alphabet (snapping
is the editor, not a validator); **chord windows are painted, not narrated** —
`chordsOf()` already returns start/len/deg/quality per window, so chord-tone
rows tint inside each window and the leading-tone row lights under V. That is
"with knowledge of what we are doing," done as a table read, no model. The
composed version is a ghost overlay over the same lane — extracted from the
section word's operator, never a second copy; velocity is depth on the pill and
accent is a ring (kernel.js keeps them distinct, so does the eye); one gesture
grammar serves lane and kit (tap, drag → for length, drag ↑↓ for pitch or
depth, long-press for the sheet), so the tie and dot radios retire into pill
length — one owner. The kit is the same bench, not a second app: tap cycles
rest → ghost → hit → accent ("a ghost is a 2 and an accent is a 9",
drums-kit.js), swing is displayed displacement, and the fill is a **place** —
bar 4 of the phrase strip, hatched — not a mode. The playhead lives in its own
`[data-live]` layer and may move nothing else, so MOTIF.md's 114 px jump
becomes structurally impossible. The staff engraving stays above as the
printed form. This amends the 2026-08-15 cell-row decision a second time — not
back to a tracker, but to a lane; the 2026-08-27 rotation brings back the
tracker's ORIENTATION (time down the page) without its cell-per-value text
grid. What survives every version is the popup (now the long-press sheet) and
the law that sound never rebuilds the DOM under a finger.

**Four exports, one module, four encoders — each button wears its true
state.** All four read the SCORE (attribute-grammar law), so this is one
extraction with four writers, in cost order: **WAV** (the press path exists,
`engine/faust/press/press.js`, byte-deterministic — a button); **MP3** (lamejs
already vendored, encode the press buffer in a worker); **MIDI** (no `.mid`
writer exists anywhere — ~200 dependency-free SMF lines over `loadScore`'s
note list, AFTER fixing tomHi/tom/tomLo all mapping to GM 47,
`to-engine.js:1211`); **Ableton P1** (built, blocked on Paul's 30-second donor
save — the button prints the ask). Nothing greys silently, nothing pretends.

**The tape gets honest before the surface gets pretty is a false choice — but
the tape is not optional.** Play-to-first-sound goes under 2 s (a 1-bar first
chunk, producer pre-rendering at page idle, not at the gesture); F4 stops
being deferred (per-note strip hoisted to per-voice — the whole measured
crackle); the modelled-voice fader/mute/solo route the way the master already
does (one trim across dry/rev/del); and the soak gate re-aims at the
**deployed URL**, because the local soak has now lied twice. This reverses
F4's deferral and reverses trusting any gate that reads a table where a
render exists. Rendered-RMS probes per voice class (sampled / drum /
modelled) become the desk's gate, and one master meter lands on the strip fed
from the tap the crackle monitor already reads — the page's first honest
signal light.

**The microlanguage is Libretto, and it may say exactly what the kernel
already performs.** Paul: *"kernel rules as a microlanguage."* The kernel
already calls an operator list a word and a bar schedule "a sentence you can
print, diff, serialize and hold a gate to" (`kernel.js:1160-1176`); Libretto
(`kernel-lang.html`) is that sentence given a spelling — `voice 2 in odd :
rotate 4·S · flip acc` is the acid answer verbatim. The law of the language:
**a rule the kernel cannot already perform is a parse error, not a feature
request.** It may say Development and its two named seams (pipes, MOTION). It
may NOT say Time ("nothing in a section tells time," quoted in the error) or
Sound (the error points at the board) — the error messages are how users learn
the axes. No dice: counters (S·B·V) and named seeds only. One table in
kernel.js emits chips, keys and verbs (today the alphabet lives twice,
`fields.js:61` / `kernel.js:1176`, held equal by one test — Libretto would be
the third copy unless the build inverts ownership, which `kernel.js:1170`
already asks for). Lines live at `song.libretto`, shadowing the genre's
closures per voice — the take law's shape. Its gate is the extraction gate:
print every catalog closure as lines, recompile, **byte-diff the scores**.

**Repertoire splits three ways: table, kernel, engine — and the ledger keeps
its honesty.** Per the musicologist, with the engine facts checked:
*Table only, ship first:* `debussy` (SCALES.whole has waited unclaimed since
the table was written), `secondviennese` (a 12-deg row over chromatic; P/I/R/RI
are shipped ops; the staff captions label row forms for free), `chance`
(seeded shuffle — a seeded table IS a chance operation, exactly as Cage's
precomputed I Ching tables were Cage's), `thrash` + `nwobhm` (the rungs
`deathmetal.wants` already orders; no bpm clamp exists; bluesx exists),
`bone flute` (a 4-note SCALES row; "the scale IS the instrument" is already
vocabulary.js doctrine), `hindewhu` approximated (one-pitch alphabet,
complementary gates by hand — shipped with the confession that the
complementarity is retyped). *Kernel changes, bounded, each already confessed
in Tier-2:* cents-valued alphabets with a declared `period` (rast = [0, 200,
350, 500, 700, 900, 1050]; `degPitch`/`foldInto` read the period instead of
literal 12 — maqam/dastgah/makam unlock as rows); additive metre as data
(`{steps, groups:[2,2,3]}`); a metre SCHEDULE at section granularity (Q4 — it
amends a law); a song-level tempo SHAPE (`rate: {from, to, shape}`) applied
where plan.js already applies rubato — un-cannots qawwali, Noh's jo-ha-kyū,
and every accelerating tarantella; `sld` promoted from bit to contour channel
riding stk_guitar's existing `glide` — the erhu's portamento gets its channel;
`against(v)` — the cross-voice hocket op that upgrades arsnova and unlocks
sikuri. *Engine, small and single-owner:* extend the bend contract from the
sampler lane to the Faust voices (a 2^(bend/1200) freq multiply at note-on) —
ship maqam on sampler-backed instruments FIRST, where bend already works; a
bowed-string id for the erhu (check the parent first — waveguide prior art).
*Never, stated:* free time. `cannot` is the right place for *ma*, forever or
until a very different round. Noh itself waits for tempo curves and ships as
`hayashi` first, per the primary-fact rule (`genres.js:7108-7115`). Dissonant
noise thrash needs one structural piece eventually — a `found` chair whose
alphabet is unpitched sources — and it waits behind everything above.

---

## 3 · THE PHASES

Between phases the integrator + verifier run as in PROGRAM §3. Phase 0 runs
alone (it owns `engine/` and `audio/`, and everything after it is judged by
ear through the audio — WAVE 0's own argument). Phases 1→5 land in order;
4 and 5 are independent of each other and may interleave.

### PHASE 0 — THE TAPE (alone)
**Ships:** first sound < 2 s (1-bar first chunk + idle pre-render); F4
per-voice strip hoist; per-channel fader/mute/solo routed to dry/rev/del on
modelled voices; `levelOf()` consolidation; echo-bus `ret` field.
**Files:** `engine/faust/live/sampler.js`, `engine/faust/live/stream-renderer.js`,
`audio/desk.js`, `audio/to-engine.js`, `fields.js` (BUSROWS ret),
`test/` (soak re-aimed).
**Gates (rendered):** soak run against **test.stellate.app** with `--load 2`,
0 starves in 12 min; playwright probe: press play → engine RMS > 0 within
2,000 ms; rendered-RMS per voice class proves fader×0.25 moves each class ≥
the dB it claims; frozen `levelOf` fixture across the catalog, byte-equal.
**Depends on:** nothing. Everything depends on it.

### PHASE 1 — LAMPBLACK + THE RENAMES + THE TEXT DIET
**Ships:** the token set and control gallery from `design-system.html` into
`nu.css` (one owner); the §5 rename batch; the page reorder (producer last;
score section stub at the foot); the prose purge; routing essay → `docs/`;
44 px hit areas on the ring; the two silent-grey fixes; AXES.md joins for
every heading rename.
**Files:** `nu.css`, `ui/eight.js`, `fields.js` (labels), `AXES.md`,
`docs/BOARD-ROUTING.md` (new), `test/shell.js`, `test/text-diet.js` (new).
**Gates (rendered):** computed-styles audit re-run at 1280/390 — looks per
element kind ≤ the §2.4 counts; static prose chars < 900 measured on the
rendered page excluding style/script/svg; zero controls under 44 px; no
descendant of `#app` scrolls horizontally except designated rails; heading
list equals the §5 table; every `disabled` control has a non-empty `.nu-why`.
**Depends on:** Phase 0 (the reorder moves live regions; measure over honest audio).

### PHASE 2 — THE ONE BOARD
**Ships:** the merged console (`one-board.html` re-tokened): strips → buses →
master; engineer pots fold in, sheets keep read-only mirrors; `lvl` enum
retires into the fader; Time's level slider → master strip as record gain;
character stage (a): bus chain slots + stereo-refusal inserts, `sound.fx`
deleted, genre fx dealt by extraction at compose; section automation —
`voice.desk` per-section shape, `deskAt()`, the grid-and-lanes; master meter.
**Files:** `ui/engineer.js` (becomes the board), `ui/eight.js` (mounts),
`audio/desk.js`, `document.js`, `fields.js`, `desk-doc.js`, `desk-gate.js`,
`songs.js`/`genres.js` (fx dealt).
**Gates (rendered):** ONE-OWNER gate — the rendered page carries exactly one
writable control per gain/send/eq fact (a DOM census keyed by `data-k`);
desk-gate rewritten to rendered-RMS (per class, per send, mute/solo); the
absent-is-today fixture — a document with no `desk` keys renders byte-identical
audio; section-lane probe — set chorus `lift` on one voice, RMS in the chorus
rises and the verse does not; old-save load test (lvl→fader resolution).
**Depends on:** Phase 0 (routing fix — a board over silent faders is a lie),
Phase 1 (tokens, renames).

### PHASE 3 — THE BENCH, THE SCORE DECK + EXPORTS
**Ships:** the Bench (`composer.html`) into Motifs — pitch lane + kit, the
gesture grammar, chord-window paint, ghost overlay; the cell-row and step grid
retire. And the foot of the page from `score-deck.html`: steady-scroll
notation with red sounding ink, motif brackets extracted from cell names,
operator captions, piano roll toggle (same clock, per-voice color, section
edges), export row: .wav (press path) · .mp3 (vendored lame, worker) · .mid
(new SMF writer; tom mapping fixed first) · .als (P1 behind the donor ask,
button prints its state).
**Files:** `ui/bench.js` (new), `ui/deck.js` (new), `ui/eight.js` (mounts;
cell-row retired), `export/smf.js` (new),
`export/press-ui.js` (new), `audio/to-engine.js` (toms), `tools/ableton/*`,
`engine/faust/vendor/lamejs` (already present).
**Gates (rendered):** bench overlay-extraction gate — the ghost pills'
positions equal the section operator applied to the cell, recomputed and
diffed (disagreement fails the gate, not the eye); chord-window gate — every
tinted row is a member of `chordsOf()`'s window tones on the rendered lane;
scroll-containment probe — a drag inside the lane leaves `scrollY` unchanged
(the 114 px jump, retired and measured); during playback DOM mutations occur
only inside `[data-live]`; playhead-ink probe — the lamp-colored note advances
monotonically over 8 bars of playback at both viewports; motif-label gate —
every bracket text equals a `material.cells` key (extracted, zero typed
strings); WAV byte-determinism (press parity, exists); MP3 decodes and
duration matches ±1 frame; MID parsed back — note count and tick positions
equal `scoreOf(doc)`, toms distinct; als-gate as shipped.
**Depends on:** Phase 1 (the foot exists, tokens), Phase 0 (a scrolling score
over a starving ring indicts the wrong suspect).

### PHASE 4 — THE REPERTOIRE
**Ships:** wave A (table only): debussy, secondviennese (+ OPKEYS widened to
arbitrary T_n/I_n chips, `only("vel",…)` chip), chance, thrash, nwobhm,
bone flute, hindewhu; wave B (kernel): cents alphabets + period, additive
metre groups, tempo shape, sld contour, `against(v)`; wave C (engine, small):
bend on Faust voices, maqam anchors on sampler instruments first; metre
SCHEDULE lands only if Q4 is answered yes.
**Files:** `genres.js`, `kernel.js`, `audio/to-engine.js`, `audio/plan.js`,
`engine/faust/` (bend patch only), `gates-extract.js` fixtures.
**Gates (rendered/score):** FFT probe on the rendered maqam record — the
third sits at 350 ±10 cents (the note that NAMES the maqam, measured, not
trusted); frozen-catalog fixture — every pre-existing anchor's score
byte-identical (period defaults to 1200); aksak probe — beat onsets group
2+2+3 in the rendered onset times; tempo-shape probe — bar durations follow
the declared curve; each new anchor passes precompose × 3 seeds, no silent
section; every `cannot` claim that became sayable is deleted from the ledger
in the same commit (one owner of the confession).
**Depends on:** Phase 0 (bend probe needs honest audio); independent of 2–3.

### PHASE 5 — LIBRETTO
**Ships:** the parser (`kernel-lang.html` grammar), the one op table in
kernel.js emitting chips/keys/verbs, `song.libretto`, the pane under
Development (textarea + syntax color + inline errors that quote the laws),
the compiled toggle.
**Files:** `kernel.js`, `fields.js` (pointed at the one table), `song.js`,
`ui/libretto.js` (new), `ui/eight.js` (mount), `test/libretto.js` (new).
**Gates (rendered/score):** the extraction gate — for every catalog genre
with word/period/ghost/pipes, print its libretto, recompile, render both
scores, **diff bytes** (the printer is the proof the language covers the
catalog); error-law gate — a Time word in a line surfaces the quoted law in
the rendered pane; a red line is a skipped line and the record still plays;
solo-shape.test extended: chips, keys, verbs from one table.
**Depends on:** Phase 4's kernel additions if new verbs (`row`, `hocket`,
`sweep`) are to be sayable at launch; otherwise only Phase 1.

---

## 4 · THE OPEN QUESTIONS FOR PAUL

**Q1 — One theme, committed dark.** We recommend Lampblack as the single
deliberate theme, no light variant: two themes is two of everything, and the
palette is argued, not picked. The alternative is dark-first with a derived
light theme by token swap (UX's version). Say "one theme" or "keep a light."

**Q2 — The Ableton donor save.** Unchanged from PROGRAM §4.4: P1 (full
session/arrangement export) is blocked on ~30 seconds of your time saving the
donor set. The .als button ships either way and prints its state.

**Q3 — Automation cells: words or dB?** We recommend the six-word vocabulary
(out · hush · back · as-mixed · fwd · lift) — deterministic, diffable,
thumb-sized, consistent with fields.js everywhere else. The engineer's
version puts raw dB in the cells; it is more precise and less like the rest
of the box. One word from you settles it.

**Q4 — May metre change inside a song?** Your law (2026-08-16): "nothing in a
section tells time." Jingju banshi and jo-ha-kyū are traditions whose FORM is
the metre change — the law was written against accidental drift, not against
them. We recommend a declared amendment: a song-level metre SCHEDULE keyed by
section (the fact stays owned by the song), and the law's text gains the
exception in place. Without your yes, the Chinese-opera cluster ships without
banshi and says so in `cannot`.

**Q5 — Does the producer survive as a section, or move onto the board?** We
recommend: stays its own section, last, six chips + the stack, and its
offsets display on the board strips as the delta they already print ("riding
−2.0 dB seated") — a layer you can see but only the producer writes. The
alternative (producer verbs as board controls) blurs the one thing the noun
translation has going for it: one translator (`producer.js`).

---

## 5 · THE RENAME TABLE

Merged from the three reviews; page words only — vocabulary keys never move,
and every heading change gets its AXES.md join (the Material precedent).

| from (shipped) | to | source · why |
|---|---|---|
| `1 · Time` … `9 · The producer` | drop all ordinals | UX — "4–8" and "9 of eight" prove the scheme broke; scroll order carries the sequence |
| `2 · Alphabet` (heading) | `Harmony` | UX — key/mode/changes is harmony to a musician; key `alphabet` stays |
| `3 · Sheet music` (mid-page) | `Motifs` mid-page + `The score` at the foot | UX — the section is two things; the score moves per the brief |
| `where and when` | `Where & when` | UX — keep the name, fix the case |
| `level` (in Time) | `record gain`, on the master strip | engineer + UX — a Sound fact filed under Time; clearest "spread everywhere" exhibit |
| `volume` (transport) | `room` | UX — the master already teaches "the room, not the record" |
| PARTMIX `lvl` row beside `fader` | retired into the fader | engineer — no console has two gain rows; old saves resolve on read |
| `place` (board row) | `pan` | engineer + UX agree — the one universal word; "place" collides with room |
| `cut` / `alone` | `mute` / `solo` | UX — "cut" collides with EQ cut three rows up |
| `goes to` | `out`, value drawn as `→ main` | UX — routing as a glyph, deletes the narration |
| `its own gear` | `bus FX` | UX — three cute words that don't say what the row is |
| `character` (master multiselect) | bus chain slots on the board; the multiselect dies | engineer + Paul — dealt, not embedded; tap chips delete the ⌘-instruction |
| `sound.fx` (record-wide chain) | gone | engineer — send-equivalence proven in fields.js:404-446 |
| `→ room` (section strip) | `kit room` (section scope only) | engineer — desk.js:391 scopes it to drums; the surface must say so |
| `what do you want to say?` | `notes` | UX — six verb chips + a stack; the heading is the noun |
| `a group — aim it` | `group — pick an out` | UX — "aim" is cute |
| `1 — you are writing this` | `take 1 · yours` | UX — the fact, not a sentence on a button |
| `80% — the room, not the record — not saved…` | `room only — not saved` | UX — refusal kept, halved |
| `unity — fixed at unity by the engine` | `fixed by the engine` | UX — same |
| `600 — the six-hundreds — 1 place on the globe…` | `600 · 1 record within ten years · Rome` | UX — keep the data, drop the tour guide |
| `the changes` (harmony-style select) | `harmony`; the table alone keeps `the changes` | UX — two controls, one heading |
| `reading speed` select | deleted — the 1×/half/double buttons own the fact | UX — one fact, one control |
| tie/dot radios + per-step sliders (cell-row) | pill length (drag →) + pill depth | composer.html — five controls per step become one gesture; one owner per fact |
| MODELABEL `harmonic` | `harmonic minor` | musicologist — its sibling already reads "melodic minor" |
| `sld` "slide into this step (binary)" | the contour channel (glide amount) | musicologist — the bit becomes the degenerate case once portamento lands |
| `▦ form` tab inside The band | `Form`, its own section before The band | UX — an axis is not a band member |

---

*Drafted 2026-08-26 against the deployed page and the tree at `0eaaf67`
(the reviews measured `b68066d` plus the play-button and empty-detent
commits); sketches cited in place. Nothing here edits a product file — that
is the next round's job, and this is its contract-to-be.*
