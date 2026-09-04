# The eight pieces of a song

(Paul, 2026-08-23: "that's how we are going to talk about nukernel.")

This is the vocabulary for talking about what a record IS. It sits beside the
other names already settled — *attribute grammar* (the system), *vocabulary*
(what can be said, `vocabulary.js`), *record* (what was said, band-kit's
model), *score* (what gets played, `toSong`), *effect graph* (what writes what)
— and it names the axes those things range over.

A song is determined by eight pieces. Not five, and **genre is not one of
them**.

| piece | what it fixes | where it lives | scope today |
|---|---|---|---|
| **Material** | the motifs — pitched cells, drum grids | phrase vectors (`kernel.js:7`); the kit files | per phrase bank |
| **Alphabet** | scale/mode **and the changes** — roots, chord quality, harmonic rhythm | `g.scale/mode/harmony/prog/roots`, `chordsOf` | genre + arranger |
| **Time** | tempo, meter, groove, swing, rubato | `state.js` GROOVE/SWING/METER, `g.rate` | **song-level** |
| **Development** | what happens to the material bar by bar | `g.word(v,s)`, `periodOps`, the operators | genre |
| **Form** | sections, roles, lengths, order, edges | `SONG` boxes, `sectionAsks`, `intro`/`outro` | song |
| **Cast** | who plays, in what register, entering when, who takes the tune | `voices/entry/reg/part`, `POOL`, `TAKERS` | song + genre |
| **Sound** | voices, treatment, balance | `instr/tone/kit`, the desk, `MIXER` | genre + engineer |
| **Performance** | the seeded human layer — timing, velocity, hand, ornament | `perform`, `humanize`/`touch`, `song.take` | song |

**NINE TABS, 2026-08-27, AND THIS FILE IS WHERE THE NAMES ARE JOINED.** Paul:
*"Why don't we make tabs at the top level and let go of the idea of scrolling
everything? The tabs are: Where / Tempo / Key / Motif / Band / Mix / Produce /
Score / Export."* The page is nine panels, one on screen at a time, and the tab
row is the only visible name each panel has — the `<h2>`s below it are still in
the document and are `.nu-vh` (nu.css, THE SECOND BAND IS THE TAB ROW), because
one owner per fact. So there are now three columns to keep straight and each of
the paragraphs below is one row of the join:

| tab (Paul) | heading (vocabulary) | axis | host |
|---|---|---|---|
| Where | Where & when | — (the atlas) | `#atlas` |
| Time | Time · Harmony | **Time + Alphabet** | `#pan-tempo` |
| Motifs | Motifs | **Material** | `#pan-motif` |
| Band | The band | **Form · Cast · Development · Sound · Performance** | `#pan-band` |
| Mix | The board | (Sound, landed) | `#deck` |
| Produce | The producer | — (a session fact) | `#produce` |
| Score | The score | (the eight, engraved) | `#scoredeck` |
| Export | Export | — (the record, leaving) | `#exportdeck` |

**None of the eight moved.** `doc.time`, `doc.alphabet`, `doc.material` and the
rest are exactly the keys they were; what Paul named is where a hand goes to
edit them. Nine tabs and nine top-level document keys is a coincidence and not a
correspondence — `basis` and `produce` are two of the nine keys and neither is a
tab, and Where, Mix, Score and Export are four tabs and none is a key.

**The page calls Material "Motif" — REWRITTEN TWICE, 2026-08-27.** This paragraph
said "Sheet music" (Paul, 2026-08-25: *"rename 'Material' to 'Sheet music'"*),
and the reason it gave for that heading — "since the score of the whole band
landed above the motifs, everything under that heading is notation" — is the
reason it changed again: the score moved whole to the deck at the foot of the
page, and FUTURE.md §5 split the name with it ("the section is two things;
the score moves per the brief" — `Motifs` mid-page, `The score` at the foot).
It says **Motif**, singular, on the tab, because that is the word Paul typed in
the tab list; the panel's own hidden heading still says `Motifs`, which is what
the panel holds. Neither is the axis.
The AXIS keeps the name it has here, exactly as before, because "material" is
not only a word in this vocabulary — it is the document key
(`doc.material.cells`), the resolver (`document.js materialAt`), two sheet keys
(`material.cell`, `cast.material`), the rules in `gates.json` that are keyed by
them, and `#ax-material`. One fact, one owner: the vocabulary says Material,
the page says Motifs, and this paragraph is the join.

**The page calls Alphabet "Key" on the tab and "Harmony" in the heading
(2026-08-27, both the same day).** FUTURE.md §5, the UX review's row:
*"key/mode/changes is harmony to a musician; key `alphabet` stays."* Then
Paul's tab list, hours later: *"Key"*. Both are his and neither withdraws the
other — `Harmony` is what the panel IS (key, mode, the changes) and `Key` is
what you go there for, which is the difference between a heading and a
signpost. The tab is the visible one. The AXIS keeps its name here for the same reason Material does:
"alphabet" is the document key (`doc.alphabet.*`), the avail.js rows
(`alphabet.key/mode/harmony/quality`), `#ax-alphabet`, and kernel.js's own
doctrine that a phrase's `deg` is alphabet-free. And one of its FIELDS is
literally named `harmony` — the heading borrows the axis's most musician-legible
word without moving any key under it. The vocabulary says Alphabet, the page
says Harmony, and this paragraph is the join.

**The headings stopped counting themselves, and then stopped being visible
(2026-08-27, twice in one day).** The page's axis headings carried ordinals —
`1 · Time` through `9 · The producer` — and FUTURE.md §5 dropped them all:
*"'4–8' and '9 of eight' prove the scheme broke; scroll order carries the
sequence."* Hours later the scroll went too, and with it the reason to print a
heading at all: the tab row names all nine places at once and is on the screen
at all times, so a visible `<h2>` under a marked tab was a second copy of a name
the tab already owned. The heading is `.nu-vh` now — in the DOM, announced,
printed with the stylesheet off, invisible with it on.

**"Scroll order carries the sequence" is the clause that had to be rewritten.**
It was true for one day. THE SEQUENCE is untouched and is still this file's
(THE SEQUENCE IS AN EVALUATION ORDER, below); what carries it on the page is
the TAB ROW's order, which is Paul's list and not the evaluation order — see
that section for why the two are allowed to differ and what would break if
somebody made them agree. Nothing keyed on any of it: the anchors were always
`#ax-time`, `#ax-alphabet`, `#ax-material`, `#ax-band`, `#ax-produce`.

**The page says the producer last but one (2026-08-27, rewritten the same
day).** The vocabulary's order is the attribute grammar's dependency relation —
eight axes readable in one pass, and the producer after them because he is "the
eight plus what was said" (below). The PAGE said the same sentence twice over
for an afternoon: FUTURE.md's reorder was "producer last to say, score last to
see", so the producer's section was the last thing a hand could edit — under the
board, immediately above the score deck, which was the last thing an eye saw.
Paul's tab list keeps that reading and adds one place after it: **Produce ·
Score · Export**. The producer is still the last thing SAID; the score is still
what you see after saying it; and Export, which is not a thing said about the
record at all, is what the record leaves by. `#produce` is shipped in
`nukernel/index.html` now rather than made by `ui/eight.js redrawApp` — a tab's
host has to exist before any panel is drawn, because the shell shuts eight of
them on the first frame. The producer moved OUT of `#app` to get there
(it sat between the band and the board from W3 to 2026-08-27); nothing about
his standing changed — still not a ninth axis, still the only translator of
nouns into vectors — only where he stands. The vocabulary says the producer
comes after the eight, the page says he comes after everything but the score,
and this paragraph is the join.

## GENRE IS A CORRELATION, NOT AN AXIS

122 genres, 51 distinct fields between them: `scale mode harmony prog roots`
(alphabet), `bpm swing rate period` (time), `voices entry reg part instr
realize` (cast), `word words pipes phrase` (development), `kit tone fx synth
drumkit` (sound), `humanize touch stress kitVel` (performance). A genre reaches
into every axis at once — it is a named POINT in the product space of the
eight, not a ninth dimension of it. That is why the genre-as-calculation matrix
found 222 of 274 genres survive losing their palette: the noun is a convenient
handle on a correlation, and most of the correlation is carried by numbers that
blend. Nouns don't blend.

Consequence for how we talk: "make it more X" is always a statement about which
of the eight axes moves, and by how much. `producer.js` is the only thing in the
building allowed to translate the noun into the vector.

## THREE THINGS THAT ARE EASY TO GET WRONG

**Motifs are optional.** A groove record has none — the kit, the bass figure
and the comping generate from the alphabet and the changes (`nobass`, no melody
layer, no taker). Melody is a LAYER, not a prerequisite. A model that requires
a motif cannot express half the catalog.

**Time is not in a section.** "Nothing in a section tells time" (2026-08-16,
`state.js`): a record swings or it does not, counts in three or it does not,
has one drummer or it is two records. Tempo, meter, groove and swing are song
facts. A per-section swing is the drummer changing hands mid-song, and the tell
was that `compose.js` stamped the same value on every box.

**Voices and effects are one axis from the song's side.** "Which instrument"
and "what is on it" are the same question — the timbre. They are two things in
the ENGINE, because one is a synth graph and one is a chain over it, and they
stay two things in the rack. Balance (gain, pan, space) is the part of Sound
that genuinely behaves differently, because it is per-channel and per-song
rather than per-instrument, which is why the desk is its own surface.

## WHY DEVELOPMENT IS ON THE LIST

It is the axis a five-part model always drops, and the demonstration is
`scratch/chant.js`: one eight-step cell, nine operator words, a whole
Gregorian psalm tone in mode II. Material and Form say WHERE the material goes.
Only Development says what happens to it when it gets there — and it is the
difference between a loop and a composition.

## THE SEQUENCE IS AN EVALUATION ORDER

Written in the right order, the eight can be read in ONE PASS with no forward
references — which is what makes them a document format and not just a list of
topics. That order is the attribute grammar's own dependency relation, and it
puts two of them in a different place than the conversation first had them:

    Time · Alphabet · Material · Form · Development · Cast · Sound · Performance

**AND THE PAGE'S ORDER IS NOT THIS ORDER, ON PURPOSE (2026-08-27).** Paul's tab
row is *Where · Tempo · Key · Motif · Band · Mix · Produce · Score · Export*.
Line them up and the first four agree — Tempo/Time, Key/Alphabet, Motif/Material
— and then the page folds Form, Development, Cast, Sound and Performance into
one tab called Band and puts the atlas in front of everything. That is not a
disagreement about the sequence: **the evaluation order is a claim about what a
READER of the document needs to have seen already, and the tab order is a claim
about where a HAND goes.** A person choosing a key does not need to have read
the form; a compiler reading `g.word(v, s)` does need the sections to exist.

This paragraph exists because the two used to be the same list, and the page was
what made them look like one fact: the axes ran down one scroll in evaluation
order, so "the third thing you scroll past" and "the third thing to evaluate"
were the same sentence. They never were. If a future round wants the tab row to
match the evaluation order it must move Where (which is not an axis at all) and
split Band into five (which Paul folded on 2026-08-25: *"Why don't you move
performance in as a tab too"*), and it will have bought agreement between a
menu and a compiler by making the menu worse.

**Time comes before Material.** The meter decides how many steps a bar has —
the kernel reads a phrase's own length AS the bar, and `seatMeter` re-seats
every chair the moment the meter word changes. You cannot write the material
until you know how it counts.

**Form comes before Development.** The word schedule is indexed by section
(`g.word(v, s)`), so the sections have to exist before the transformations that
are hung on them.

**Material does NOT depend on Alphabet**, and that is a designed property worth
stating out loud: `deg` is signed and alphabet-free — "never an absolute pitch,
so the same phrase survives being read in any genre or any scale"
(`kernel.js:8`). The same cell is legal under every mode. That independence is
what let one eight-step cell become a chant.

Proved rather than asserted: `scratch/chant.song.json` is a song in exactly
these eight keys, `scratch/play-song.js` assembles the genre object from them,
and the score it renders is byte-identical to the hand-written version.

## EIGHT KEYS ARE A SHAPE, NOT A SCHEMA

`vocabulary.js` already says why: the domain is DEPENDENT everywhere — a
chant's keyboard-job list is [drone], one word, where a jazz date's is five.
The eight give you the document's shape. What is LEGAL in each slot given the
others is `vocabulary.json`'s job, and it always will be. A JSON Schema over
the eight would accept documents that cannot be played and reject ones that
can.

Two more things the eight do not settle, and both are open:

**Scope.** Some axes are song-level (Time, Performance), some are per-section
(Development, Cast entries), some per-layer (Material). Each axis has to say
its own scope — a song default and a section override. The chant needed none of
this because it is one voice and one cell.

**A song document is not a session document.** The eight determine the SCORE.
They carry no provenance — who said what, "named" versus "chose" — and both the
take law and the producer's `held` set depend on it. The eight plus the
interview is the session; the eight alone is the song.

**2026-09-04 (nukernel/TABLE.md §8), the join table amended:** `Tempo` and
`Key` fold into one tab, `Time`, whose host holds BOTH axis sections — so that
row names two headings and two axes and `#pan-key` is deleted. `Motif` is
`Motifs`, the word its heading always used. `Structure` is deleted with its
pane: the sections are the Band table's ROWS and performance is its FOOTER, so
Form and Performance are read where they always were, under `Band`.
