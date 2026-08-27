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

**The page calls Material "Sheet music."** Paul, 2026-08-25: *"rename
'Material' to 'Sheet music'."* The AXIS keeps the name it has here, because
"material" is not only a word in this vocabulary — it is the document key
(`doc.material.cells`), the resolver (`document.js materialAt`), two sheet keys
(`material.cell`, `cast.material`), the rules in `gates.json` that are keyed by
them, and `#ax-material`. What changed is the HEADING a reader sees over the
axis on `ui/eight.js`, and it changed because the axis's contents changed
first: since the score of the whole band landed above the motifs, everything
under that heading is notation. One fact, one owner: the vocabulary says
Material, the page says Sheet music, and this paragraph is the join.

**The page says the producer last (2026-08-27).** The vocabulary's order is the
attribute grammar's dependency relation — eight axes readable in one pass, and
the producer after them because he is "the eight plus what was said" (below).
The PAGE now ends the same sentence twice over: FUTURE.md's reorder is
"producer last to say, score last to see", so the producer's section is the
last thing a hand can edit — under the board, in its own host (`#produce`,
made by `ui/eight.js redrawApp`), immediately above the score deck, which is
the last thing an eye sees. The producer moved OUT of `#app` to get there
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
