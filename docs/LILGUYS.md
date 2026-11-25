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

**The arrangement (2026-11-02).** A ruler of the sections (click one to go
there), then a track a member: on the left the lilguy, its instrument, a
volume fader and M / S (the part strip's own `fader`, `mute`, `solo` on
`voice.desk`); across, the song as a clip a section, each drawing the notes
that section plays and labelled with its phrase (main / chorus) and its
development word. One playhead runs through all of it. Click a clip to open its
phrase in the roll below. None of these controls stop the band: a change is
pushed like a motif edit and lands at the next bar the engine has not rendered
(its runway, a few seconds), where the page used to stop and restart.

**The phrase, zoomed.** A clip clicked opens its phrase in a modal over the
arrangement (Esc or the backdrop closes it): whose and which phrase in the
title, where it is heard under it, a tab for every source phrase in the song,
the tool, and the member's sections. The tool is a pencil (tap a note in, drag
to draw a line of notes, tap a note out, drag a note or its right edge) and
scissors (a held note broken into steps; alt-tap with the pencil does the
same). A melodic phrase is MONO — a note moved or stretched over another takes
its place — because a cell holds one note a step; the kit's lanes stack. Under
the roll, a column a section: lit where it reads this phrase, an icon (Lucide,
`lilguys/icons.js`) for each transformation it applies, each a toggle, and +
for the development menu. A line tells you when the change will be heard (the
runway, then the next section that plays it) and offers to go there.

**Key, mode, scale** sit in the bar (avail.js `alphabet.key / .mode / .scale`);
every phrase is in steps, so the band moves with them. The link keeps them,
and each section's transformations, beside everything else.

**Rows are intervals.** The roll's rows are steps over the chord (`1` its root,
`♭3`, `5` …, `'` an octave up), because the kernel moves a line onto each
chord's root and reads a written bass degree over the chord. **The bass opens
on its own line**: what it plays in the first verse, spelled the same way, and
it starts reading that cell only at the first edit.

**Two phrases a member, at most.** The composer hands a member up to five
separate cells (funk's keys: counter, pad, hook, answer, climb), none tied to
another. On load (`app.js twoPhrases`, before the edits' baseline is taken, so
a link still replays) each member keeps a **main** phrase — what it plays in
the first verse (counting sections instead crowned 4-note `sparse` fills) —
and, if the first chorus (a dance form's drop) read something else, that as
its **chorus** phrase. Every
other section reads one of the two, and the section's development word (busy,
walk, backwards …) is the variation.

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

**The staff is the band score's engraving.** The part is folded into the
phrase shape `ui/abc.js toScore` reads (the same fold as `ui/eight.js`
`recordParts`/`scoreParts`), and the vendored abcjs draws it: real spelling,
beams, ties, rests and an octave decided once per staff (`ottavaFor`). It also
gets a clef by who is playing (treble, bass, a grand staff for a wide keyboard
part, the percussion staff with `SCOREHEAD` noteheads for drums), a thin double
bar at each section's end, and the section's name and chord symbols inked on
(`inkChords`).

The whole song is one engraving, moved the way the band score moves it (Paul,
2026-08-26: "scroll at a steady speed BUT highlight notes in red. Get rid of
the playhead"). The speed is steady within each section, and the sounding
notehead is painted red; there is no line. The clef and key stay pinned at the
left, and "now" sits a fifth of the way past them, so a held note's red head
stays in sight. The helpers this needed (`SCOREHEAD`, `chordName`,
`inkChords`, `paperGeom`, `indexVoices`, `loadStaffLib`) moved out of
`ui/eight.js` into `ui/paper.js`, byte for byte, and both pages import them.
The band score was checked identical before and after the move (1,593
noteheads, 57 chord symbols on Kingston 1969).

**Tempo** is the record's real tempo (40–220 BPM, the percentage of the genre's
own shown beside it). **Loop this section** loops the section that is sounding.
Rubato is switched off on this page: a tempo map is lovely to listen to and
hard to play along with.

## Saving and sharing

The song is its genre and seed (`genreToDocument` is a pure function of the
two), plus what you changed. Only the changes are kept:
- motifs you edited, and new ones a member reads (a written bass line, a
  motif copied so it could be edited)
- which motif each member reads, where that moved
- the instrument each member plays, where you changed it (the menu in a
  member's panel is the main app's own: avail.js `sound.drumkit`,
  `sound.bassinstrument`, `sound.instrument`, greyed options and all)
- the tempo, if it isn't the genre's
- whose part is yours

That is small enough for the address. Every change rewrites the link as
`#g=<genre>&s=<seed>&e=<edits>`, where the edits are deflated JSON in base64url
(plain base64url JSON where a browser has no `CompressionStream`). A reload
comes back to the song, and **share** copies the link (on a phone, the share
sheet). A typical edited song is about 200 characters. The last song is also
kept in `localStorage` (`lilguys.song.v1`) for a visit with no link.

A link is someone else's data, so everything read from one is checked first:
- an unknown genre is refused, and the page opens the last song instead
- a motif that isn't the shape of a cell is dropped, and its numbers are
  clamped
- a member may only read a motif that exists
- the tempo is held to 40–220
- names like `__proto__` are refused
- a link whose edits cannot be read opens the song without them, and says so

The fuzzer checks both directions:
- `song-keeps`: what is saved, regenerated and re-edited, is the song that is
  playing, motif for motif.
- `link-keeps`: packing and unpacking the link changes nothing.

A planted restore bug (edited motifs ignored) was caught by `song-keeps`,
shrunk to three operations.

Running it for this round turned up two older faults, both fixed:
- **Notes were given to the wrong member.** The score was attributed by
  instrument, but one unit can play two voices: in ragtime one honky-tonk piano
  is the lead in the intro and the riff in the verse. The lead's notes were
  drawn on the keys' staff and sung by the keys' character. The page now
  attributes through the section's own address (`plan.addrOf(si)`) and the
  desk's chair-to-voice map (`NuDeskDoc.channelVoicesOf`), the same road the
  mute takes. Found by `mute-cuts`.
- **A muted part's pickup still sounded.** `audio/desk.js deskAmp` gave a
  voice not seated in a section no part at all, so a bass pickup played from
  the intro into the verse even with the bass muted: 2 of funk's 428 bass
  notes, on every page. A stranger now obeys its own chair's mute, and nothing
  else of that chair's. Across ten genres, every member's mute now cuts
  exactly its own chair, and the score assigns every note it holds.

## Read: sight reading, on a phone held sideways

**read along** (or `R`) gives the whole screen to the staff. Built for an
iPhone in landscape: the band shrinks to a strip along the top, a rail of
thumb-sized buttons runs down the notch side (done, play, slower / faster in
fives with the BPM and its percentage of the genre's, whose part, new piece,
options), and the staff takes the rest, scaled to the room. The line sits at
16% of the width, so most of the screen is music still to come.

- **Look ahead: 1, 2 or 4 bars.** That many bars fit between "now" and the
  right edge on any screen: it sets the width abcjs is asked to engrave at,
  never tighter than the notes can stand. Fewer bars means bigger spacing and
  less to read ahead. More bars is the harder exercise. Turning the phone
  round re-engraves for the new room.
- **New piece** keeps the genre and the part and rolls a new seed: music you
  have not seen, which is the point of sight reading.
- **Tapping a character** reads that member's part instead.
- **Options:** note names beside the heads (training wheels), chord symbols
  over the bars (from `document.js chordsIn`, spelled for the key), and
  whether the part is muted (you play it) or heard (you learn it). There's
  also the line-vs-sound nudge.
- **The clock** is the engine's, less the output latency the AudioContext
  reports, less the nudge. Bluetooth headphones are 150–250 ms behind what the
  engine thinks it is playing, and the phone's media route is late by its own
  poll. Without the correction the note under the line is a note already gone.
  Options are kept in `localStorage` (`lilguys.read.v1`).
- **The screen stays awake** while reading (Screen Wake Lock, iOS 16.4+). A
  phone held upright gets a "turn your phone sideways" card, which can be
  dismissed. Added to the home screen, the page runs without Safari's bars
  (`apple-mobile-web-app-capable`), which in landscape take a third of the
  height.

## Changes land now, a count-in, and listening to what you play

**A tempo or a mute, while playing, restarts the band from the bar that is
sounding.** `audio/live.js` `startAt` now takes a `bar`, present-only; every
existing caller is unchanged. Measured: from 99 to 60 BPM, the band is back
in 1.4 s (a 0.35 s debounce for quick taps, then about a second of silence),
from the bar that was playing, at 60. Before, the old tempo ran on for the
engine's runway, several seconds. Motif edits keep the runway, because a
restart per tapped note would be a stutter.

**The count-in** is `kernel.js`'s own: `intro: "count"`, four rim clicks, the
last accented (three in 3/4), played by the engine on its own clock.
- It is a one-bar section at the **end** of the song, and play starts on it,
  then wraps into bar 1.
- At the front it moved every bar one along, and the engine's dice are keyed
  on bar position. Measured, 1–3 drum bars per song came out different, so you
  would have been practising another song. At the end, every bar's events are
  identical across six genres.
- When the song comes round, you are counted back in.
- Every pitched voice sits it out, so nobody leads in to it.
- It is there when a part is yours (muted) and "count me in" is on (the
  default), and it is added or removed only while stopped.
- A section loop gets no count.
- During it the staff shows bar 1 waiting just past "now", with "count-in: 1 2
  3 4".

**Listening** (`lilguys/listen.js`): "listen to my keyboard" takes a MIDI
keyboard's notes (Web MIDI, Chrome or Edge; iOS Safari has none, and the page
says so) and judges each against the part, on the eye's own latency-corrected
clock.
- A hit is the right pitch class within ±120 ms, octave-free because the
  staff may be written an octave from where you play. For drums, any key on
  time is a stroke.
- A note that passes unplayed is a miss. A note that matches nothing is an
  extra.
- Hits turn green and misses orange (red stays "sounding"). A chord is green
  only if every tone was hit.
- The tally reads "48 right · 12 missed · 0 extra (80%)", or "80% · 48/60" in
  the rail.
- The judge rewinds when the clock goes back (a loop, a restart) and is made
  again with the part.

Measured with a simulated player on jazz piano:
- A perfect player scores 71/71.
- A player a semitone off scores 14 right. Jazz voicings hold adjacent tones
  (D and C♯ in Dmaj7), so a wrong note can be another chord tone.
- A player 300 ms late misses most notes.

`Judge` is pure and imports in node (`nukernel/lilguys/package.json` is the
module marker, as in `ui/`).

The fuzzer also turns listening on and plays random MIDI notes. The page's
`check()` holds the tally to the part (hits + misses + open = notes) and the
count-in to its rule (at the end, only when wanted, never mid-song).

## The fuzzer

`nukernel/lilguys/fuzz.js` is the firmware's fuzzer (`web/emu/stellate_fuzz.mjs`
in stellate-lilguys) brought into the page. The page is a graph:

- **The state** is what a hand would say it is doing: `PLAY`/`STOP`, plus
  `BAND`/`EDIT-drums`/`EDIT-pitched`/`READ`, plus `MINE`, plus `LOOP`.
- **The operations** are what a hand can do from that state, and only those.
  The fuzzer never clicks a control the layout hides.
- **A walk** takes operations at random, half the time one not yet taken from
  where it stands, so it is coverage-guided.
- **After every step** it asks `check()`, the page's own invariants (the
  firmware's `web_st_check`): the band is at most four and each member is the
  right kind; every cell is well formed; every voice reads a cell that exists;
  at most one member is muted, and it is the one the page says; the engine's
  tempo, the record's and the slider agree; the loop box and the loop agree;
  bars and notes are in order; the open roll shows exactly the cell it edits;
  the drawer, staff and rail are shown when and only when they should be; and
  a stopped page has a stopped clock.
- **Now and then it runs a property**, an experiment with a known answer (nine of them):
  - `roll-twice`: a step tapped twice leaves the cell as it was.
  - `mute-cuts`: muting cuts exactly one chair in the events the engine is
    handed, and unmuting restores them.
  - `stop-stops`: stopping stops the clock.
  - `plays-on`: play makes sound within 20 s, and the beat then moves.
  - `read-keeps`: entering and leaving Read changes no motif.
  - `genre-clean`: a new genre is a clean start.
  - `staff-shows`: the engraving holds the part it is titled with, one
    notehead group per onset per staff, at the look-ahead asked.
  - `song-keeps` and `link-keeps`: see Saving and sharing, above.
- **A failure** is shrunk by delta debugging to the fewest operations that
  fail the same way, and printed as a replay. Each walk starts from the page's
  own fresh state (`reset`), and the page's `Math.random` is drawn from the
  walk's seed, so a replay needs no reload and rolls the same genres.

That is what lets it run on a real phone, where no harness reaches. Open
`lilguys.html#fuzz&walks=6&ops=60&seed=1` and a report appears in the corner,
with any replay selectable to copy.

`test/lilguys-fuzz.browser.js` runs the same walks headless on two devices: a
laptop, and an iPhone (touch, 3x) that is turned round mid-walk (the one
operation a page cannot do to itself). It counts console errors, writes the
graph as JSON and DOT, and replays:

```
node test/lilguys-fuzz.browser.js 8 70 11 --device both
node test/lilguys-fuzz.browser.js replay '[{"op":"member","m":1}, ...]' --seed 3 --device iphone
node test/all.js --only lilguys-fuzz        # the gate: 4 walks of 50 per device
```

What it found while it was being written:

- `setPointerCapture` throws when the pointer is already gone, which took a
  tap down with it. The roll hears moves on `window` anyway.
- The keyboard shortcuts assumed every key event has an element target.

A larger run (six walks of sixty per device) reported three things in the
shared engine, open:
- The Faust library's audio-worklet node rethrows processor errors
  (`faustwasm` `onprocessorerror = (e) => { throw e; }`), seen twice under
  start/stop churn.
- The clock can hold at a bar's downbeat. The engine announces bars ahead of
  the sound; `plays-on` now waits that out, up to 4 s.
- The clock has gone backwards three times with no loop or seek (the third
  on the emulated iPhone, after "slower" was pressed before the first
  sound): classical 28 →
  18.69 mid-song, and opera seria 72 → 0.44 just after play. The first reading
  was an exact downbeat both times. It never reproduces in a fresh page, even
  replaying the same steps, so it depends on engines started and stopped
  earlier in the page. The likeliest cause is the one `audio/live.js` names: a
  stale engine whose stop did not take, still calling `onBar` against another
  engine's clock. A run with every `onBar` tagged by engine did not
  reproduce it, so this is unconfirmed.

A bug planted to test the fuzzer (unmuting not unmuting) was caught two ways:
by `mute-cuts`, shrunk to one operation, and by the invariant "2 members
muted".

## How it hangs together

| File | What |
| --- | --- |
| `nukernel/lilguys.html` | index.html's classic scripts, in its order; none of its UI |
| `nukernel/lilguys/app.js` | the document cut to four (`trimBand`), the compile (`push`, ui/eight.js's minus the producer), motifs ↔ cells, mute, tempo, the frame loop |
| `nukernel/lilguys/sprites.js` | the four characters (canvas, 60×64 logical, pixelated) |
| `nukernel/lilguys/roll.js` | a generic piano roll (rows × steps, never rebuilt by the clock) |
| `nukernel/lilguys/staff.js` | the part folded for `toScore`, engraved by abcjs, moved at a steady speed per section, red where it sounds |
| `nukernel/ui/paper.js` | the band score's engraving helpers, moved out of `ui/eight.js` and shared |
| `nukernel/lilguys/fuzz.js` | the fuzzer: walks, invariants' caller, properties, shrinking, the in-page report |
| `nukernel/lilguys/listen.js` | the judge (pure) and the Web MIDI listener |
| `test/lilguys-fuzz.browser.js` | the fuzzer headless on a laptop and a turning iPhone; the `lilguys-fuzz` gate |
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
