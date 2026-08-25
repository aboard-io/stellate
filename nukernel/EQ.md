# EQ — the board's three knobs, and whether they reach the tape

*Written by the verifier of the 2026-08-24 EQ round, from measurements taken
through the shipped page. Not a plan and not a promise: every number below came
off an AnalyserNode tapping the real output of
`http://localhost:8777/nukernel/index.html` while the shipped chant played.*

**It works.** Paul's sentence — *"The modeled voice needs to go through the EQ
as do all the faust instruments"* — is answered, and the proof is a spectrum
rather than a field in an object. Pushing the cantor's board EQ to
`lo −6 / hi +6` now moves the tape **−5.7 dB at 50 Hz and +4.7 dB at 15 kHz,
while 250 Hz to 2 kHz stays inside ±0.3 dB**. On this morning's code the same
gesture moved the same voice by **−0.8 dB and −1.2 dB** — noise, in the wrong
direction, at levels 80 dB down.

There is one thing for you to know that is bigger than the brief, one thing to
decide, and one hazard nobody has tripped yet. All three are below.

---

## 1 · What was wrong — two holes, not one

**The named one.** `nukernel/audio/desk.js` worked out the whole tone decision
for a voice — the part EQ, the section EQ, the family tone and the seat shading,
merged into one number — and then wrote it down only `if (u.sampler)`. A
Faust-modelled voice has a `module` and no `sampler`, so for every modelled
chair the number was computed and dropped on the floor. Measured across the
catalog: **555 of 856 chair-boxes are modelled and 527 of them had a non-flat
tone decision thrown away.** On the shipped chant the cantor (the vocal tract)
is modelled and the schola (the sampled choir) is not — the two voices at the
front of the record were the A/B of the bug.

**The one the brief did not name, and it was the bigger of the two.** The words
`lo`, `mid` and `hi` had **no reader anywhere in `engine/`**. The parent's
biquad builder knew a high-pass, a low-pass and a peak, and no shelf at all — so
the board's low and high bands had no filter to become. Fixing only the first
hole would have routed the number to a second place that also ignored it.

That is why the sampled voice, which everyone assumed already worked, measures
**−0.2 dB flat across the entire spectrum** for a ±6 dB board move on this
morning's code. Nothing was EQ'd. Not the modelled voices, not the sampled ones.
Three knobs on every channel of the board reached no sound whatsoever.

---

## 2 · The route taken

The channel strip used to live *inside the sampler's own per-note mixer*, which
is why only a sampled voice could have one. It is now a stage the **renderers**
own: a modelled voice carries `strip`, a sampled voice still carries
`sampler.strip`, and both are run through the same builder and the same stepper.
One tone decision, two carriers, never two spellings. The parent's own biquad
builder grew the two missing shelf cases, and three board bands
(**120 Hz low shelf · 1 kHz peak · 7.2 kHz high shelf**) were appended **last**
in the chain — after the instrument's own carve, saturator and compressor,
because the board is the mixer's strip and those are the player's. Put the board
before the saturator and a hand on the `hi` knob changes how hard the voice
distorts.

The frequencies the board silkscreens and the frequencies the filter is built
from are now checked against each other by a gate, so they cannot drift apart.

---

## 3 · The measured before and after

Two runs of the shipped chant per row, 45 s of averaged spectrum each, all other
channels cut on the board, ring engine, **zero dropouts and zero errors in all
eight runs**. "BEFORE" is this morning's code, served on its own port from a
copy of this tree with exactly this round's two changes undone and nothing else.

Δ dB, condition B minus condition A:

|                                                |    50 |    80 |   120 |   250 |   500 |    1k |    2k |    4k |    8k |   15k |
|------------------------------------------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| **MODELLED** cantor, TODAY — flat → lo−6/hi+6  |  −5.7 |  −4.8 |  −3.0 |  −0.2 |  +0.1 |  −0.3 |  +0.0 |  +0.5 |  +2.8 |  +4.7 |
| **MODELLED** cantor, BEFORE — flat → lo−6/hi+6 |  −0.8 |  +0.1 |  +0.6 |  −0.6 |  −0.3 |  −0.2 |  +0.0 |  +0.0 |  +0.0 |  −1.2 |
| **SAMPLED** schola, TODAY — flat → lo−6/hi+6   |  −5.6 |  −4.3 |  −1.8 |  +0.4 |  −0.1 |  +0.5 |  +0.0 |  +0.5 |  +3.1 |  +5.1 |
| **SAMPLED** schola, BEFORE — flat → lo−6/hi+6  |  −0.2 |  −0.2 |  −0.5 |  −0.4 |  −0.2 |  −0.3 |  −0.2 |  −0.3 |  −0.2 |  −0.2 |

Three things in that table are worth saying out loud.

**The shape is a shelf pair, not a level change.** The 250 Hz – 2 kHz columns are
the error bar: the two takes of the same deterministic record differ there by
**±0.3 dB**, which is how much of the reading is material and clock rather than
filter. Everything outside that is the filter. If the runs had merely got
louder or quieter, every column would have moved together.

**The corners land where the silkscreen says.** A shelf is at *half* its nominal
gain at its own corner frequency, and that is exactly what the 120 Hz column
reads (−3.0 of a −6 ask) and the 8 kHz column reads (+2.8 of +6 asked at
7.2 kHz). This is not a broken filter; it is what a shelf looks like.

**The two carriers agree.** The modelled row and the sampled row are the same
curve within about half a dB. That is the whole point of the round: there is one
tone stage now, and both kinds of voice run it.

The high shelf reaches **+4.7 to +5.1** rather than +6 at 15 kHz. That band sits
80 dB below the loudest part of the record, where the analyser's own floor and
the master chain's tape stage both eat into it. The gate that measures the
filter in isolation reads **+11.78 dB for a +12 ask**, so the filter is exact;
what the table shows is the filter *as heard through the rest of the record*,
which is the honest number for a listener.

---

## 4 · The catalog-wide sound change — the thing for you to decide

This is the announced consequence, and it is measured rather than estimated.
**222 sampled chair-boxes across the catalog already carried a non-flat
`lo`/`mid`/`hi` that did nothing** — the family tone and the derived section
shading, median 1.5 dB, max 2.0 dB. Their stored numbers have not changed by a
byte. What changed is that the renderer stopped ignoring them.

On the shipped chant both voices carry `mid −1.5, hi +1` from the family tone,
and here is what that is worth on the tape with the board sitting flat:

|                                                |    50 |    80 |   120 |   250 |   500 |    1k |    2k |    4k |    8k |   15k |
|------------------------------------------------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| MODELLED cantor, board FLAT: BEFORE → TODAY    |  +0.7 |  +0.9 |  +0.8 |  +0.2 |  −0.6 |  **−1.3** |  −0.4 |  +0.0 |  +0.7 |  **+1.3** |
| SAMPLED schola, board FLAT: BEFORE → TODAY     |  −0.1 |  −0.5 |  −0.8 |  −1.2 |  −0.6 |  **−1.9** |  −0.5 |  −0.3 |  +0.5 |  **+0.9** |

A −1.5 dB dip at 1 kHz and a +1 dB lift on top, arriving on both voices, which
is precisely what the desk always said it was doing. **Every record in the
catalog now sounds the way its own mix sheet has always described it.** That is
the right change and it is why the round was worth doing — but it is a
catalog-wide sound change and it belongs in the commit message, not in a
footnote. It is also the reason the round cannot be judged by "does anything
sound different"; things *should* sound different, by about a dB and a half.

The `dirty` mid-scoop on all 129 modelled electric-guitar chairs is in the same
bucket and is the largest single population of it.

---

## 5 · What it costs

The three-band strip measures **5–16 ms of CPU per 8 seconds of audio**, which
is **0.01–0.03 of one voice-cost unit** on the scale where the saw pad is 1.0.
Twenty-five modelled voices each carrying one comes to less than a single saw
pad, against a budget of 40 and a practical ceiling around 28. It is not the
shape of the old per-note-node problem: this is one stepping state per *unit*,
allocated once when the stream opens, not a filter per note. A silent voice
still pays its 0.01 — deliberately, so the filter's own ring-out is not clipped
and so the pressed file and the live stream stay sample-identical.

Across all eight measured playthroughs the engine reported **zero starve
episodes and zero console errors**, so the stage is not audible as load.

---

## 6 · The board reads honestly now

At **1280×900** and at **390×844** all six EQ cells draw **enabled, with no
refusal text**. Driving the cantor's high band writes `{"eq":{"hi":12}}` onto the
document and the slider holds it. The refusal that used to sit in those cells —
*"a modelled voice has no sampler strip for an EQ to land on"* — is gone rather
than reworded, which is correct: it was true when it was written and it stopped
being true.

The per-voice engineer sheet is the honest half. On the cantor it reads
`lo 0.0 — flat`, `mid 0.0 — riding −1.5`, `hi +12.0 — riding +1.0`: your offset
in the control, what the record is already doing beside it. Those two derived
numbers are exactly what §4 measures on the tape.

*One wrinkle, small and not a defect of this round.* The board grid's own
caption says *"the slider is your offset, the bar is what the record is already
doing"* — and the **fader** row does draw that bar, but the three **EQ** rows do
not. So on the board a cantor already riding −1.5 dB of midrange shows three
centred sliders and no sign of it. The truth is one tab away in the engineer
sheet. Either the EQ rows get the same bar the fader has, or the caption should
stop promising it for them.

Screenshots: `shots/eq-board-1280x900.png`, `shots/eq-board-390x844.png`,
`shots/eq-board-driven-*.png`, `shots/eq-engineer-*.png`.

---

## 7 · What is still not covered

**Stereo voices — covered, and worth knowing why it mattered.** The insert-chip
path in both renderers folds a voice to one channel, which is why a chip is
refused on a wide voice at all. A tone stage is not an insert — it has no
cross-channel state — so a wide voice gets two of them and keeps its width. This
is not hypothetical: the chant's own schola is one of the four wide voices, so a
mono shortcut would have collapsed the voice sitting directly beside the one
Paul complained about.

**Drums — wired, and only two-thirds measured. Say so.** A machine kit is
modelled and a sampled kit is not, and that difference is the complaint; both
now answer the board. What I can show: the board draws a `kit` channel with its
own three bands (`b|eqlo|kit`, `b|eqmid|kit`, `b|eqhi|kit`) on every record that
has a kit; on the shipped chant the live engine reports all six modelled drum
units carrying the merged tone at `strip`, where this morning they carried
nothing; and on a Los Angeles 1982 record the modelled `kick_boom` unit's strip
reads the board's `hi +1.5` merged underneath the kit's own carve, with that
carve intact. What I could **not** get is the drum equivalent of the table in §3
— a measured spectrum of a kit on the tape, flat versus driven. The chant has no
kit, and the two ways in to a record that does were both shut while I was
working: a frozen copy of the tree could not open its engine (a missing asset,
404), and on the live server the atlas listbox that loads such a record had just
been removed by the round rewriting the map. So the drums are proved the way
everything was proved before this round — by reading the numbers — plus the
gate's isolated audio, and not yet by the tape. It is the one measurement this
report is missing, and it is a twenty-minute job once the map settles.

**A bus EQ — does not exist, and is not in this round.** The three knobs are
per channel. There is no tone control on the reverb return, on the delay
return, or on the master. The master's `width`, `tilt` and `ceiling` still draw
disabled and still say *"this one round-trips and draws but reaches no sound"*,
which remains the honest thing for them to say.

**A per-section EQ — still not expressible.** A voice's tone is one decision for
the whole record.

**One latent hazard, found while verifying and not tripped by anything today.**
Both renderers route a voice into the buffered path when it has an insert chip
*or* — new this round — a board tone. That buffered path writes the dry, wide,
reverb and delay sends and **does not write the ping-pong send**. Before this
round only a voice with a chip took that path; now any voice with a tone does,
which is very nearly all of them. I looked for the damage and found none:
**across 20 precomposed records and 22,145 drum hits, not one event carries a
non-zero ping-pong send**, so nothing in the catalog currently feeds that bus.
It is a trap set rather than a trap sprung — but if anyone ever turns the snare
throw on, it will vanish silently and the gates as written will stay green,
because the gate's own fixture feeds a zero there. Worth a line in the renderer
saying so, and worth fixing when the throw is next wanted.

---

## 8 · How to reproduce any number here

The probe and the eight measurement files live outside the repo, in this job's
scratch directory:

```
eqv/spectrum.js   boots the page, taps AudioContext.destination with an
                  AnalyserNode, cuts every channel but one on the real board,
                  drives the real EQ control, plays, and averages
                  getFloatFrequencyData in the POWER domain for 45 s
eqv/fine.js       folds two of those into third-octave bands and prints the delta
eqv/tab.js        the two tables above
eqv/ppprobe.js    the ping-pong census of §7
eqv/run-all.sh    the eight runs, in order
```

The "before" tree is a copy of this working tree with this round's two changes
undone — the desk's `else` branch and the engine's three shelf stages — and
nothing else, served on its own port so the two can be played side by side. It
is not a checkout of an earlier commit, because eight other deliverables landed
in this tree the same day and comparing against them would have measured the
wrong thing.

---

## 9 · One thing that will confuse you if you run the gates today

`node nukernel/desk-gate.js` passed **all 77 checks** at 16:21 on 2026-08-24,
including the ten new ones that render audio and measure a spectrum. Five
minutes later the same gate reported **FAILED 1 of 77**, and the failing line is
`the page raised no console error while the board was driven —
pageerror: LAND is not iterable`.

That is not this round. Between the two runs a **different** round wrote
`nukernel/atlas-land.js` (16:22:34), changing its `LAND` export from an array to
an object, while its reader `nukernel/ui/atlas.js` still says
`for (const ring of LAND)`. Three more of that round's files moved in the next
six minutes. The board's own twenty-six checks are green in both runs; what is
red is the whole-page "no console error" assertion, and it is red because the
map is mid-surgery.

`node test/all.js` at the same time reported **11 pass · 2 fail**, and the two
failures are the same event: `desk` (the one atlas-adjacent line above, 76 of 77
green) and `atlas` (a crash inside `test/atlas.js`). Everything else — document,
precompose, gates, ableton, producer, atlas-data, shell, sheets, nudges,
producer-ui, motif-frozen — is green. Twenty-five minutes later the gate's red
line had **moved** to a different atlas assertion, `the atlas keeps its three`,
because the same round had by then rewritten `ui/atlas.js` and `ui/globe.js`.
The board's own twenty-six checks were green in every one of those runs.

**All eight audio measurements in this file finished at 16:20:04, before the
first of those edits landed at 16:22:34**, and every audio-path file is
byte-identical between the two trees that were compared apart from the two
files this round deliberately changed. The numbers stand. Re-run the gate once
the atlas round is finished.
