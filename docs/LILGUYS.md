# Stellate Lilguys, on the web

`nukernel/lilguys.html` — the FM-1 firmware's band (aboard-io/stellate-lilguys,
`STELLATE.md`) brought back to the browser, on this repo's own composer and
engine. Serve the repo with `./serve.sh` and open `/nukernel/lilguys.html`
(`#g=<genre>&s=<seed>` picks a record).

## What is on the page

**The band, and nothing else until you click one.** Four pixel characters,
ported pixel for pixel from `firmware/src/stellate_band.c`: the drummer round
behind its kick and cymbal, the bassist tall with its upright / bass guitar /
synth, the third chair boxy in glasses at a keyboard / guitar / horn / mic, the
lead a drop. They bob on the beat, open their mouths on their notes, sleep
through sections they sit out, watch a soloist, and float a quaver when they
play their motif as written. The word under each is its development word for
the section (`as written`, `walk`, `busy`, `lays out` …).

**Click one: its motifs, in a piano roll.** One tab per cell the member reads
across the song (a lead may read `topline` in the verses and `answer` in the
chorus). Pitched rows are the song's scale, named in its key; the drummer's are
lanes. Tap to place, drag to hold, drag to move, tap to remove, shift-tap to
accent. A cell another member also reads is copied before it is written
(the lead's hook stops being the keys' riff). The bass, which normally plays
the genre's line over the chords, gets a written `bassline` cell the first
time you put a note in it.

**I'll play this part.** Mutes the member (the desk's own mute: `voice.desk.mute`
→ `box.parts[chair].mute` → `audio/desk.js deskAmp`, which drops the notes
before the engine sees them) and scrolls its part — as actually played, after
the sections developed it — under a fixed playhead.

**The staff** is drawn in beats, proportionally (a beat is always the same
width), so the note under the line is the note sounding at any tempo. Clef by
range (treble, bass, grand for a wide keyboard part, a percussion staff for the
drums), key signature from the mode's relative major, accidentals against it,
ledger lines, open heads for halves and wholes, one stem per chord, flags, and
a pale bar for how long each note is held.

**Tempo** is the record's real tempo (40–220 BPM, the percentage of the genre's
own shown beside it). **Loop this section** loops the section that is sounding.
Rubato is switched off on this page: a tempo map is lovely to listen to and
hard to play along with.

## How it hangs together

| File | What |
| --- | --- |
| `nukernel/lilguys.html` | index.html's classic scripts, in its order; none of its UI |
| `nukernel/lilguys/app.js` | the document cut to four (`trimBand`), the compile (`push`, ui/eight.js's minus the producer), motifs ↔ cells, mute, tempo, the frame loop |
| `nukernel/lilguys/sprites.js` | the four characters (canvas, 60×64 logical, pixelated) |
| `nukernel/lilguys/roll.js` | a generic piano roll (rows × steps, never rebuilt by the clock) |
| `nukernel/lilguys/staff.js` | the scrolling staff |
| `nukernel/audio/live.js` `songBeatNow()` | the one addition to shared code: a read-only, where-is-the-ear-in-beats reader for the scroll |

The band of four: the document's tune (`export/move.js leadOf`), the line voice
that plays in the most sections (the harmony parts first on a tie), the bass and
the kit. The other line voices are let go, so every sound belongs to someone on
the stage.

The score comes from `export/score.js scoreOf` over `plan.timeline()` — the
notes the engine is handed, not a second opinion — with each section's lanes
offset by its `beat0` and mapped to members through `plan.seats()`.

## Known limits

- Edits, mutes and tempo changes land on the next bar the engine has not yet
  rendered: a few seconds, the runway `audio/live.js` keeps against dropouts.
  The staff stays in step through a tempo change because it is drawn in beats
  and the playhead rides each bar's own seconds-per-beat.
- Motif cells are monophonic (one line; a chord is a stack the band voices).
- No audition button yet: `audio/audition.js` needs the recorded samples under
  `/found`, which a fresh clone does not carry.
