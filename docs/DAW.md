# DAW — the generator workstation at `/daw`

**Decision (Paul, 2026-08-07):** a second front end for the same kernel, aimed at
**one song** rather than a continuous journey through genre space. `/` stays the
star map; `/screensaver` becomes an alias to it; `/daw` is the new page.

*The question this program answers: what does it look like to compose WITH the
kernel — to open the machinery that writes the music, tweak it, and watch what it
writes — without the thing degrading into an ordinary note editor?*

The answer is a **rack of per-track generator machines**, each with its piano roll
beside it, and four export formats. Everything below sits behind the two standing
laws: **determinism** (same seed → byte-identical events; absent knob →
byte-identical output) and the **matrix** (274/274 diagonal-dominant after every
change).

## The founding constraint: rules, not diffs

The first design put a writable piano roll over `buildEvents` and stored hand-
edits as frozen clips — a literal note list that replaces the generated events
for a `(section, voice)` pair. **Rejected.** A frozen clip breaks the contract the
whole project rests on: that a seed regenerates everything. Change the tempo, the
form, or the progression and a frozen clip is stranded — it was written against a
world that no longer exists.

What replaces it: **you author the generator, never the notes.** Every editable
surface in the DAW is a rule — a phrase cell in chord-tone indices, a Markov
transition matrix, a probability gate, a cycle-position alternation. A rule
survives a seed change and a form change. A diff doesn't.

This is not a new idea in this repo; it is the idea the repo already had. The
engine's three melody representations are all rules, and the drum kits stopped
being procedural code and became a variation *grammar* (below). The DAW makes
that machinery editable rather than inventing a parallel one.

Consequence: a user-authored generator is **just more vocabulary** — the same
kind of thing as the mined `folkline` cell or the `jazzweave` organ already
shipping. It merges beside the built-in tables, so absent ⇒ zero rng draws ⇒
byte-identical, and every fixture, `kerneldata` row and matrix cell is untouched.

## What already exists (the leverage)

Most of this program is wiring, not invention. Measured on main, 2026-08-07:

- **Whole-song offline render, in the browser.** `faust/live/stream-worker.js:120`
  `renderWav(msg)` renders a state to a WAV `ArrayBuffer` via the same
  press-parity `makeStreamEngine` path node uses, with `wavprog` progress posts.
  It accepts `msg.buffers` — decoded found/sampler PCM — for a **full mix**, and
  `faust/live/live.js:2475` already assembles exactly that map. Today only the
  iOS background-WAV producer calls it.
- **MP3 encoding.** `faust/vendor/lamejs.min.js` + `codec/mp3-stream.js` +
  `codec/mp3-worker.js`, stream-shaped for WAV-FIRST; a one-shot encode is a thin
  call over `makeMp3Stream`.
- **MIDI export.** `engine/midi-export.js` + `app/audio/export.js`, gated by
  `test/browser/midi-export.test.js`.
- **A correct piano roll.** `app/panels/inside/timeline.js` draws voice lanes and
  a roll from `app/audio/notefeed.js barVoiceEvents()`, which re-simulates one
  chord-bar exactly as `faust/live/live.js stepWalk` does. Read-only and per-bar;
  the DAW needs writable and whole-song.
- **Per-voice and master fx as a node graph.** `app/panels/inside/graph.js`
  (`voiceFx`/`masterFx`), and the naming layer in `inside/describe.js`.
- **The note-fx rack.** `engine/pipes.js` `REGISTRY` — `harmonize`, `echoCanon`,
  `strum`, `ghost`, `callResponse`, `densityArc` — an **ordered** list in
  `state.pipes`, each entry drawing from its own stream (`seed+71000+i*97`,
  `pipes.js:296`), each carrying its own `doc` string. That is already a rack:
  ordered, insertable, parameterized, stream-isolated, self-documenting. The UI
  renders from the registry; the tooltips are written.

So the DAW is substantially a **re-layout of readouts that already exist, made
writable**.

## The track strip

```
[ generator machine ] → [ note-fx rack (pipes) ] → [ instrument ] → [ fx chain ] → mix
                                                                          │
                                          piano roll for THIS track ──────┘
```

Three of the four stages already have a data model *and* a renderer. The
generator machine is the new one.

**The roll is cheap.** `buildEvents(state).pitched.filter(e => e.voice === slot)`
is the same call the live walk makes every bar — milliseconds. Live preview on
every knob turn needs no caching layer. It is a *filtered view of the full build*,
not an isolated render, which is what you want: the melody roll shows the line
against the real harmony and the real time-feel.

## THE PREREQUISITE: `state.voiceStreams` — SHIPPED 2026-08-07

`csd-engine.js:2040/2063/2077` hand `bassEvents`, `drumEvents` and
`melodyEvents` **the same `rng`**, inside the same section loop. Draws interleave.
So on today's engine:

> You open the melody machine, nudge one knob, and the hi-hats change.

That is fatal for a rack. A machine you tweak must be the only thing that moves,
and once probability gates (`p:X`, `sp`) are user-editable, every twitch of a
slider changes the draw count and reorders every subsequent voice.

The fix is idiomatic — pipes already do it: a **dedicated stream per voice**
(`seed + <voice offset>`), and per-drum-lane sub-streams so kick probability
doesn't move the hats. Opt-in via `state.voiceStreams`, so absent ⇒
byte-identical, exactly as `state.meter`, `state.rhythm` and `state.sampleEvents`
are absent-identical. Small change; everything else depends on it. **Do it first.**

Visible payoff: once streams are isolated, tweaking one machine leaves the
neighbouring rolls pixel-identical. That is the rack proving it is honest.

### Where isolation stops — the boundary implementation found

Building it turned up something the design had not said out loud, and it is the
most useful thing in this document. Isolation is a property of **the generators**
(the kit op interpreter, the bass cells, the melody cells) and of **the tape**
(`applyGroove`'s per-event humanize, which had to be re-cut per lane — it draws
1–2 numbers PER EVENT across the whole timeline, so it re-coupled every voice the
generator streams had just separated).

Everything **downstream** of those reads across voices ON PURPOSE, and must:

| Pass | Why it is cross-voice by design |
|---|---|
| bar transforms `ply`/`stutter`/`rot`/`degrade` | "double-hit one beat of the kit" MEANS the extra hats too |
| the snare-law | measures the finished snare+hat timeline to guarantee no bar repeats three times; lane-blind, it stops working |
| `miniFillEvents` | a kit fill QUOTES the kit — more hats must mean more hat echoes (its echo draw is now lane-tagged, so it quotes each lane independently) |
| `CsdPipes` | `harmonize` snaps the melody to the pad/bass notes SOUNDING under it; `octavePump` reads bass |
| `state.thunk` | pushes a whisper-level tom off a fraction of LEAD notes |

**That layer is the master bus, not a track strip.** In DAW terms it is exactly
right: a track's generator is yours alone; the effects downstream of it react to
what the whole arrangement is doing.

The consequence for the rack design is concrete: **a cross-track machine cannot be
a generator — it has to be a pipe.** "Bass follows the kick" reads the drums, so it
belongs in the note-fx rack (which already sees the whole bundle at the choke
point), not in the bass track's generator slot. Isolation is what makes that
distinction load-bearing rather than stylistic.

`test/unit/voice-streams.test.js` gates BOTH sides: 3A/4A switch the cross-voice
layer off and demand exact generator isolation; 3B/4B switch it back on and demand
the coupling **returns**. A boundary nobody asserts is a boundary that quietly
moves.

## The machines

### Melody — three generator kinds, all already in the engine

1. **Phrase cells** — `MEL_PHRASES` (`csd-engine.js:868`).
   `[beatOffset, dur, leadIndex, octShift]`, where `leadIndex` indexes the
   *chord's lead voicing*, not a pitch. A cell follows the harmony and survives
   reharmonization. A cell with a `<name>2` sibling alternates per chord
   (`csd-engine.js:1201`) — A/B phrasing for free.
   → **`state.melodyCells`** — **SHIPPED 2026-08-07.** A song's own cells shadow
   the shipped table BY NAME (the same copy-on-write / badge / revert model as
   `state.kits`), so drawing needs no change to the form. The editor is a **ladder
   grid**: y is the chord's own voicing — root / 3rd / 5th / top, and the same
   again an octave up — never a chromatic keyboard, and x is a 16th grid across
   the chord bar. One note per column, because a cell is a LINE. Durations are
   DERIVED on commit (each note holds until the next onset, capped at 2 beats),
   which is what makes a drawn line legato instead of a row of staccato 16ths.
   `test/unit/melody-cells-daw.test.js` measures the founding constraint rather
   than asserting it: the same ladder slot resolves to **4 distinct pitch classes**
   across one progression, and the phrase transposes whole under a key change — a
   frozen clip could do neither.
2. **Weave organs** — `MINED_WEAVE` (`csd-engine.js:913`). `start[8]` +
   `slot[8][8]` (Markov transitions over the voicing ladder) + `ioiStart[8]` +
   `ioi[8][8]` (rhythm chain) + `legato` + `step`. Not a melody — the
   *distribution* a melody is drawn from.
   → **`state.melodyWeave`** — **SHIPPED 2026-08-07.** Edited as a painted 8×8
   matrix over the ladder (click strengthens a transition, shift-click weakens it,
   the row renormalises). `test/unit/melody-weave-daw.test.js` proves the painting
   is not decorative by measuring it: a diagonal-heavy table yields a smaller mean
   interval than a corner-heavy one on every seed tried, and one table still gives
   a different tune per seed — a distribution, not a recording.
3. **`wander`** — the fallback walk: rhythm pool `[1,0.5,0.5,1,1,2]`, ±1 step
   over chord tones, 0.18 octave-leap probability, 0..3 slot clamp, 0.92 legato.
   → **`state.melodyGen`** — **SHIPPED 2026-08-07.** Every one of those literals
   is now a knob whose DEFAULT is the literal, so absent draws the identical
   numbers in the identical order. Six knobs: gait (the rhythm pool, offered as
   named characters — walking / even 8ths / quarters / long-short / gallop /
   sparse), step, octave leap, rest, legato, range. `rest` is the only one that
   can ADD an rng draw, so it is guarded: at 0 it draws nothing and the whole
   catalogue is byte-identical. `test/unit/melody-gen.test.js` also holds the
   panel's DEFAULTS against the engine's literals — otherwise "revert to stock"
   would be a lie and every knob would carry a hidden offset.

**The fitter — SHIPPED 2026-08-07.** `tools/mine/mine-weave.js`'s fitting core is
transition-counting plus Laplace smoothing, and in the browser it is *simpler*
than in the corpus: mine-weave has to recover ladder slots from raw MIDI
(normalise each window's pitch range, drop polyphonic skylines, gate on
`mel_conf`), whereas a drawn cell is ALREADY in ladder slots — that is what the
phrase editor's y-axis is. So the fit is counting, smoothing, normalising, and
nothing else.

One honest difference is noted in the code rather than hidden: mine-weave measures
`step` as the fraction of 1–2 **semitone** intervals in raw corpus lines; a ladder
has no semitones, so the browser fitter uses the fraction of **adjacent-slot**
moves. Same role (it gates the passing-tone connectors), genuinely a different
measurement.

The weave panel carries its own **scratch phrase grid**, because a weave-driven
form has no phrase of its own to fit from — the gate caught the button appearing
to work while writing nothing. The scratch cell is stored under a reserved name
that no section can ever play, so it is inert as vocabulary and exists only to be
fitted from. It closes the loop: *draw a few phrases → fit a weave organ from them →
the generator writes the song → adjust the phrases or paint the matrix.*
`mine-melody`/`mine-weave` as a live instrument, fitted on your phrases instead of
a MIDI corpus. Carry over `mine-melody.js`'s medoid rule: from a handful of
examples take the most typical *real* phrase, never the per-slot average — the
median of several melodies is a monotone.

**Drawing phrases is the input; MIDI drop is deferred** (Paul, 2026-08-07). The
corpus DB already parses SMF, so drag-a-MIDI-file-in becomes nearly free once the
fitter is portable — but it is not the first path.

### Drums — the variation grammar already exists

The kits are data, not code (`csd-engine.js:463-486`), and the op vocabulary *is*
a variation language:

```
hits:[...]      static hits
alt:[A,B]       ci odd ? A : B                — cycle-position variation
cyc:[...]       picked by ci % length         — longer periods
last:[A,B]      last chord of the cycle ? A : B — form-aware
pick:[A,B]      ONE rng draw chooses A or B
p:X             whole-op gate: one draw, emit only if r<X
grid:{n,step,from,amps,opens,open,sp}          — lane grid; sp gates each step
ride:{n,amps,skipAmp}                          — the shuffle pair-loop
skip:true       every offset adds the triplet skip
```

Variation authored as a **rule over cycle position and probability** — the
founding constraint, already implemented.

**Decision (Paul, 2026-08-07): drums and bass each get SEVERAL machines**, the way
melody does — not one machine with a deep parameter set. Drums:

1. **Kit machine** — **SHIPPED 2026-08-07.** A rack panel over the op vocabulary
   above: per-lane, `alt`/`cyc`/`last` as a period selector, `p`/`grid.sp` as
   probability sliders. User kits ride in **`state.kits`**, which `drumEvents`
   consults before the stock table — a user kit is ordinary vocabulary, not a
   special case, which is the whole payoff of the kits having become data.
   Copy-on-write: a song carries an override only for kits actually touched, and
   every override is badged + revertible. "Always" is stored as the ABSENCE of
   `p`, never as `p:1` — an op carrying `p:1` spends a draw deciding something
   never in doubt, and draw counts are the currency the rack law spends
   (`test/unit/kit-machine.test.js` gates exactly that).
2. **Euclid machine** — `E(k,n,rot)` per lane. Already lane *notation* that
   replaces a matching kit lane inside the same interpreter (`csd-engine.js:625`),
   not an overlay fighting it. A genuinely different paradigm: onsets distributed
   geometrically rather than authored.
3. **Accent machine** — the per-16th velocity profile `mine-groove.js` mined and
   `pipes.js accentProfile` already consumes. A *modulator* over a grid rather than
   an onset generator, so it composes with 1 and 2. (Honest note from the mining:
   only dub carried real signal; jazz/folk velocities measured flat.)
4. **Kit weave** — a Markov table over per-lane hit patterns, the drum analogue of
   `MINED_WEAVE`. **This one does not exist yet** — it is new invention, not a UI
   over shipped machinery, and should be costed as such.

### Bass — the asymmetric one

Bass has real variation today: **`state.rhythm.complexity`**
(`csd-engine.js:1798`) on its own dedicated stream (`seed+52100`) — per-note
octave-flips gated at `0.10 + 0.20*rcx`, three mutation kinds. But that is one
mutation type behind one slider, because `bassEvents` (`csd-engine.js:382`) is
still a `switch` over 23 procedural cases.

Giving bass a `BASS_CELLS` op table is the **same transcription the kits already
went through** — hit-for-hit, draw-for-draw, byte-identity pinned by
`test/lib/fixtures.js`. A known operation with a proven method, and the largest
single piece of engine work here. Sequence it *after* the drum machine ships, so
the op-grammar UI is proven before building the thing that needs it.

Bass gets its several machines on the far side of that transcription:

1. **Cell machine** — the `BASS_CELLS` op table, once the 23 procedural cases are
   data. Same panel shape as the drum kit machine.
2. **Walker** — a parametric chord-tone walk generalizing the existing `walking`
   and `melodic` cases (`csd-engine.js:409`, `:399`): step size, approach-note
   probability, target-on-downbeat, register clamp. The `wander` analogue.
3. **Mutation machine** — `state.rhythm.complexity` promoted from a slider to a
   panel (drop / anticipate / octave-flip, per-note gate, cap per cycle), layered
   *over* whichever of 1–2 is loaded rather than replacing it.

**Not a bass machine: "follow the kick."** It reads another track, so by the
boundary above it is a **pipe**, not a generator. Same for anything that shadows
the melody. Putting it in the generator slot would break the isolation the rack
is built on.

Interim, before the transcription: expose `rhythm.complexity` as a knob, plus the
per-section variation surfaces that already work for both rhythm tracks — `fill` /
`autoFill` / `sweep` / the 24 transitions, and the `densityArc` pipe for density
over song time.

### Master

Not a track: `theory` (the harmony brain + its `adventure` knob), `timeFeel`
(swing/humanize/rubato as one resolved dimension), the fx bus, `chordEvery`,
`keyOffset`, `meter`, `bpm`, `seed`.

## Transport — SHIPPED 2026-08-07

No `songMode` flag was needed after all, and no engine change: `exploreLive`
already takes a getState **callback** and re-reads it every chord bar. Hand it the
DAW's own state and that IS the workstation contract — an edit lands at the next
bar while the music keeps playing (gated: a probability slider moved mid-playback,
music uninterrupted). The star map's glide/blend/retarget machinery is simply not
used here; the DAW plays one song and stays there. Changing genre or seed **stops**
rather than pretending to glide, because it is a new song.

**The playhead is not a canvas repaint.** The rolls are expensive enough that
redrawing them 60×/sec to move a line would make every knob feel slow, so each
roll carries one absolutely-positioned element that a single rAF moves by
transform; the canvases repaint only when the MUSIC changes. The gate asserts both
halves — the head advances, and the drums canvas is byte-identical across the same
window.

`test/browser/daw-transport.test.js` measures **actual audio** through the engine's
own analyser (`handle.rms()`), not just that a button toggled: 35/39 samples
nonzero, peak 0.45. A transport gate that skips this passes happily over a silent
graph.

## The document

A song is a **diff against the deterministic kernel**, not a copy of it:

```
{ base: <genre or blend + seed>, patch: <edited state fields>,
  melodyGen|melodyCells|melodyWeave|kits: <authored generators> }
```

Small JSON — shareable in a URL, savable to localStorage. The fat
`instruments`/`samplerLib` are re-derived from the kernel on load, never stored. A
machine choice plus its parameters is a savable **preset**.

## Export

| Format | Cost | How |
|---|---|---|
| **WAV** | small | wire `renderWav` + the existing `buffers` map to a download; progress via `wavprog` |
| **MP3** | small | same PCM → `makeMp3Stream` (lamejs, vendored) |
| **MIDI** | ~zero | `MidiExport.buildMidi(state)`, shipped |
| **MusicXML** | ~180 lines, no dependency | new `engine/musicxml-export.js` |

**On MusicXML** (searched 2026-08-07): the JS ecosystem is renderers and parsers,
not writers. OpenSheetMusicDisplay renders; `@stringsync/musicxml` can serialize
but is a heavy TypeScript schema wrapper needing a build step and a vendor drop;
`vexflow-musicxml` parses. Adapting any of them to this event walk is *more* code
than a sibling to `midi-export.js` — same `buildEvents` walk, same duration
quantizer, emitting `score-partwise`. Caveat to state in the UI: notation needs
quantization and enharmonic spelling decisions MIDI doesn't, so swung and
humanized material reads approximately.

## Gates this must clear

- New page ⇒ `test/gates/social-meta.test.js:69` PAGES list, and **no inline
  `<script>`** (production CSP has no `script-src 'unsafe-inline'`).
- New engine globals in a new load order ⇒ `test/gates/boot-smoke.test.js`.
- Every new state dimension ⇒ prove **absent-is-byte-identical** against the
  fixtures and the `kerneldata` row; confirm `engine/genre-verifier.js matrix`
  still prints `diagonal dominant: 274/274`.
- New browser gates under `test/browser/daw-*.test.js` (globbed by
  `npm run test:browser`).
- Note: `validate-genres.js:346` gate 6 checks `lead.patterns` against
  `E.MELODY_PATTERNS` for **anchors only** — DAW-local generator names don't trip
  it. A generator you want to keep *graduates* into anchor vocabulary via the
  existing `tools/genre/genre-tool.js` splice.

## Order of work

1. ~~**`state.voiceStreams`** — per-voice and per-lane rng isolation.~~
   **SHIPPED 2026-08-07.** Per-voice streams (bass/drums/melody/counter/lick) +
   per-drum-lane sub-streams + a per-lane tape in `applyGroove`. Gated by
   `test/unit/voice-streams.test.js` (147 checks, both directions).
   Verified absent-identical against HEAD over 30 builds (10 genres x 3 seeds);
   `./verify.sh` 13/13 and `npm run test:unit` 34/34.
2. `/daw` shell + track strips with per-track rolls — **SHIPPED 2026-08-07**
   (the `songMode` transport is still to come; the rack draws, it does not yet play).
3. ~~Machine panels read-only~~ **SHIPPED 2026-08-07** — the strip is a button;
   opening a track shows its machine. Pitched tracks show a read-only summary
   until their machines land.
4. ~~**Drum machine** — UI over the existing op grammar + `state.kits`.~~
   **SHIPPED 2026-08-07.** `test/browser/daw-rack.test.js` proves the rack law
   ON SCREEN: moving a kit probability repaints the drums roll and leaves every
   other roll **pixel-identical** (canvas hash per row, before and after).
5. **`state.melodyGen`**, **`state.melodyCells`** and **`state.melodyWeave`** +
   the in-browser fitter — all **SHIPPED 2026-08-07**. The melody rack is done:
   knobs on the walk, a ladder grid to draw phrases, a matrix to paint the
   distribution, and FIT to turn drawn phrases into that matrix.
6. **Bass op-table transcription** + its machine.
7. Note-fx rack UI over `state.pipes` — mostly a renderer over an existing
   registry.
8. Export cluster — WAV, MP3, MusicXML beside the shipped MIDI.

Steps 1–5 and the transport are shipped: the rack plays, and every machine edit
lands live. Remaining: the bass op-table transcription, the note-fx rack UI, and
the export cluster.

## The feel vector — an editable vector display (2026-08-07)

**Decision (Paul):** the editors should not be columns of sliders; they should be
the vector display, made editable. Same for the genre picker — "let me sculpt a
genre". And it has to work on a phone.

**The finding that shapes the whole thing: the radar is a LOSSY projection, so
"editable radar" is an inverse problem, not a UI problem.**

```
bright = 0.55·cutN(mel.cutoff) + 0.25·cutN(pad.cutoff) + 0.20·cutN(highcut)
```

Drag that spoke to 0.8 and the reading does not say which of the three cutoffs to
move. Every composite axis has this shape. So each axis declares a **writer** as
well as a reader, in one of three honest kinds:

| kind | meaning |
|---|---|
| **direct** | one param, exactly invertible — tempo→bpm, dust→crackle, human→humanize |
| **spread** | several params moved together **in their current ratio**, so a pad already darker than the lead stays darker |
| **indicator** | cannot be written without inventing musical decisions, so it is drawn and **refuses the drag** |

`density` is the indicator: it counts whether a bass part *exists*, and a drag
cannot conjure one. It is dimmed, labelled "reports only", and rejects the
pointer — a control that silently does nothing is worse than no control.

**NO SLIDERS ANYWHERE** (Paul, 2026-08-07). Not in the shape panel, not in the kit
machine, not on the wander walk — `input[type=range]` count on `/daw` is zero, and
the gate asserts it. The earlier design paired each radar with a column of range
inputs as the keyboard/AT path; that was the wrong solution to a real problem. The
radar now carries the accessibility itself: every handle is focusable, exposes
`role="slider"` with `aria-valuenow`/`aria-valuetext`, and moves on arrow keys
(shift = coarse, Home/End = ends). One control, reachable two ways.

**IT DOES NOT SNAP BACK.** The first cut repainted every handle from the RESOLVED
state after each drag, so shaping a genre made the spokes jump to whatever the new
blend measured — you could not set anything, only nudge it and watch it leave.
What you set is now authoritative: a spoke shows YOUR value when you have set one
(`patch.feel`) and the resolved value when you have not. The engine's actual shape
is still visible as the **ghost** behind yours, and the legend prints `got 62`
beside any axis where the two differ by more than 4% — the gap is information, not
an error to hide.

**Mobile is a design constraint here, not a media query.** `touch-action: none` on
the surface is the single line that makes a vertical drag *edit* instead of
scrolling the page. The hit target is the whole 44px wedge, not an 8px handle, and
the drag maps to RADIUS from the centre so the gesture matches what you see at any
rotation. Pointer events only — one path for touch, pen and mouse — with
`setPointerCapture` so a drag survives the finger leaving the small SVG. On a
phone the rack strip stacks ABOVE its roll (190px of strip on a 360px screen
leaves no roll at all) and the form ruler hides rather than becoming unreadable.

`test/browser/daw-feel.test.js` drives it at 390×844 with a real
`pointerType:"touch"` drag and fails on: a non-`none` touch-action, sideways
overflow, a strip that has not stacked, any enabled control under 40px, a drag
that writes an axis it was not on, a spread writer that inverts a ratio, and an
indicator that moves. It caught two of my own bugs — 28px sliders I had called
thumb-sized, and a stale whitelist assertion.

## The shape IS the picker — SHIPPED 2026-08-07

**Decision (Paul):** "no dropdown — you shape the genre and that fills in the
tracks." So there is no genre list on `/daw` at all. You drag the shape; the
kernel finds the anchors nearest it and blends them through **`K.mix`**, the same
call the star map makes for a point between stars. A sculpted song and an explored
one are the same kind of object.

- **The index** is a feel vector per anchor, and a feel vector needs a RESOLVED
  state. Measured: 274 anchors in ~1.75 s in node, so it builds in **idle slices**
  with the sculptor usable throughout — matching against whatever is indexed so
  far. A partial index gives a worse match, never a wrong one, and the readout says
  "learning the space… n/274" while it fills.
- **Matching uses the draggable axes only.** `density` is an indicator you cannot
  set, so including it would match on a coordinate you have no way to steer.
- **Three anchors, weighted ∝ 1/distance**, so a shape between genres gives you all
  three in proportion instead of snapping to the closest. Ten would be mud.
- **The ghost.** The dashed outline is the shape you asked for; the solid one is
  what the space gave you. They differ because you are navigating real genres
  rather than setting parameters, and showing both is the honest way to say so.
- **Two jobs, cleanly split:** the radar shapes the genre; the slider rows tune
  params on top of whatever blend resolved.

### The bug that shaped the storage

The first cut had the spread writers put their RESULT into the patch — which meant
copying the whole resolved `instruments` object (sampler zone maps included) into
the document. Two failures, one silent and one worse:

1. it blew the 6000-char URL budget, so `encodePatch` returned `""` and the song
   silently stopped persisting (the gate caught this as "the blend does not ride
   the URL");
2. it **pinned every instrument choice**, so re-shaping the genre could no longer
   change what played it — which defeats the whole feature.

So the document stores **one number per axis** in `patch.feel`, and those numbers
are re-applied to each freshly resolved state (`machines/feel-core.js`, a pure
module with no `song.js` dependency so `song.js` can call it without a cycle).
Shape the genre and the instruments change; your brightness rides on top of
whatever the new blend picked. The gate now asserts the patch stays under 400
chars, so this cannot regress quietly.

## The last four — SHIPPED 2026-08-07

**Match weighting.** Uniform distance made tempo count as much as record-crackle,
so dragging tempo to the top could hand back something that was not faster. The
axes are now weighted by how much each DEFINES a genre (tempo 2.6, swing 1.8,
harmonic adventure 1.4 … dust 0.7, human 0.6). The gate holds the CONSEQUENCE, not
the numbers: shaping tempo low then high must return a faster song — measured
**66 → 177 bpm**, landing on different anchors.

**The note-fx rack** (`state.pipes`). An ordered chain you can add to, remove
from and reorder, with each pipe's numeric params on their own small radar. Every
word in the UI — including the tooltips — comes from `CsdPipes.REGISTRY`, which
already carried a `doc` per entry. **Order is audible**, not a cosmetic sort: each
pipe draws from a stream keyed on its INDEX, and a pipe that adds notes changes
what the next one sees.

**The export cluster.** WAV and MP3 through the machinery that was already on main
(`renderWav` in a dedicated worker; the vendored lamejs), MIDI through the shipped
`midi-export.js`, and MusicXML through a new ~150-line sibling.

> **The bug the export gate caught.** `renderWav` without `buffers` renders the
> FAUST mix only — and this project is **sampled by default**, so every pitched
> voice is a sampler and the result was near-silence: a real RIFF/WAVE header,
> 44.1k stereo, correct length, **peak 0.0015**. The fix is what `press.js`
> `decodeInputs` does in node — the used set is every found event's `srcId` plus
> every sampler zone's `srcId` (instrument zones ride `foundSources` at vol 0) —
> decoded here with `fetch` + `decodeAudioData` and shipped to the worker. Peak is
> now 0.092 and the gate fails a silent render.

MusicXML uses no library, and the reason is recorded in the file: the JS ecosystem
is renderers and parsers, not writers. It also states the two honest
approximations — onsets quantise to 16ths (the tape's jitter and swing are
performance, not spelling, so a swung part reads straight) and enharmonic spelling
is sharps-unless-flat-key, since the engine stores pitch classes and has no answer
to "A♯ or B♭". The gate checks **every measure sums to a full bar**, which is how a
MusicXML file opens as garbage in MuseScore while looking fine as text.

**The bass machines.** `state.bassCells` — authored cells in chord DEGREES
(root / octave / fifth, plus an optional semitone shift), shadowing the running
pattern by name exactly as `state.kits` and `state.melodyCells` do. Degrees rather
than pitches for the same reason the melody grid is a ladder: an authored bar
follows the harmony and survives a reharmonisation (gated — the root degree spans
6 pitch classes across one progression). Plus the mutation machine
(`rhythm.complexity`).

**On the 23 procedural cases:** they are still procedural, deliberately.
Transcribing them is the move the kits survived and it remains worth doing, but
its only payoff is tidiness — the OVERRIDE is what actually lets a song author a
bass part, and it is absent-byte-identical by construction. A handful of the
static cases are mirrored app-side purely as editing STARTING POINTS, never used
to play anything, so a drift there costs you a starting shape and not a render.
The walker (a parametric generalisation of `walking`/`melodic`) is the one machine
of the three still unbuilt.

## THE DECK — each radar under its own roll (2026-08-08)

**Decision (Paul):** break the single radar up and put each element **under its
piano roll**; tempo and structure ride atop the kernel; one download dropdown;
the playhead bottom-right like the screensaver; scroll up and down to tweak; thin
lines, big labels.

The zoomable orbit is gone, and it deserved to go. It answered "where am I in the
stack" but made you zoom *past* the thing you were trying to hear — a roll and the
knobs that shape it were never on screen together. Under-the-roll puts a cause
next to its effect: turn a spoke, watch **that** roll redraw. The gate asserts
exactly that, and that no other strip moves.

**Like with like, top to bottom:**

```
kernel (tempo tract · structure tract · radar)
chords · melody · bass · pad · drums · samples · note fx
```

The whole song first, then the harmony, then the four voices, then the samples,
then the transforms that run over all of it. Reading down is still reading the
pipeline; **scrolling replaced zooming**, so the pinch gesture is gone with the
orbit — there is no longer a gesture for it to drive.

- **Tempo and structure are tracts**, drawn above the kernel radar, because they
  describe the whole song rather than any one voice.
- **Chords and samples get lanes too** — chord blocks per bar, found placements
  over time — so every layer that has something to show in time shows it.
- **The playhead readout sits bottom-right**, the corner the star map keeps its
  chips in, so the two front ends put the same information in the same place. Bar
  and beat come off the same interpolated clock the playhead lines ride, so the
  number and the lines cannot disagree.
- **One download dropdown** (`details`/`summary`, not a `select` — a select that
  performs an action is a lie about what it is) replacing four buttons.
- **Thin lines, big labels**: every rule is a hairline, the strip name is 26px,
  the axis labels are 12px semibold in the UI face rather than a monospace
  whisper. While scrolling, the label is what you read and the ink is what you
  glance at.

## THE GRID (2026-08-10)

**Decision (Paul):** *"We have a kernel that generates things. Then we have song
structure. Then we have tracks that are generated by the kernel operations.
Maybe instead of a bunch of random tracks we have a grid of tracks and piano
roll materials. When I tap I get an interface that is optimal and novel — not
just radar, definitely not sliders, and VERY touch friendly … Right now we end
up with piles of points in one radar and a radar with one point."*

That last sentence is the diagnosis, and it is exact. The deck had made the
radar a UNIVERSAL editor: `layers.js` said "EVERY NUMERIC VARIABLE IS A SPOKE"
out loud, so the drums ring carried seven mixer axes plus one spoke per kit op
(the pile of points), and the bass panel built a whole radar around ONE
mutation value (the radar with one point). A radar is only right where the axes
form a comparable SHAPE — the genre feel vector, and nowhere else. Meanwhile
the kernel→structure→tracks hierarchy, which the engine has always had, was
invisible on screen: structure was a 26px canvas strip, the tracks one endless
scroll of unlike strips, and a whole-song roll at 84px × full width shows
nothing on a phone.

### KERNEL → SONG → GRID → SHEET

The deck's vertical stack of strips is gone. One screen now shows the actual
hierarchy, top to bottom: the **KERNEL card** (collapsed to ◇ thumbnail ·
blend label · seed chip · bpm tile; tap → the full sculptor radar, `vector.js`
+ `sculpt.js` unchanged, no-snap rule and ghost intact), the **SONG bar** (one
chip per section, width proportional to its TRUE beat share, cycles count
printed on the chip), **THE GRID** (rows = tracks with sticky-left headers,
columns = `state.sections` at EQUAL width — the bar tells the truth about time
so the grid's columns can be legible), and a **MASTER row**. Every cell canvas
paints the actual `buildEvents` output windowed to that section's beat span
(`roll.js` grew `{beatFrom, beatTo}`): mini piano rolls auto-ranged PER ROW so
contours compare across sections, lane dots for drums, chord-name blocks of one
cycle, placement marks for samples, a dimmed ∅ where a section turns a voice
off.

Tap anything — cell, row header, section chip, master row — and **THE SHEET**
slides up (~85vh with a grab handle on mobile; a right-side panel at ≥1100px).
Music keeps playing; edits land at the next bar (the transport contract,
unchanged). Pinned at the sheet's top is a live mini-roll of the tapped cell
that repaints on every edit — cause next to effect, which was the deck's one
good idea, kept. The editors live one-per-file in `app/daw/editors/`
(drums/melody/bass/chords/pad/samples/master + the shared `sound.js` tab), all
reading the UNCHANGED data layer in `machines/`. **The rack law is the demo:**
edit one track's generator and that row alone repaints — canvases are per cell
precisely so the gate can hash rows and prove every other row pixel-identical.
The playhead is still not a repaint: one absolutely-positioned line, moved by
the transport rAF through a piecewise beat → (column, fraction) map.

### The control vocabulary — pad, tile, chips

Three primitives, built ONCE in `controls.js`, used everywhere; pointer events
only, `touch-action:none`, ≥44px, `role="slider"` + arrow keys on every one
(the vector.js handle contract), and `input[type=range]` still counts zero on
the whole page.

- **PAD** — a probability pad: fill height IS the probability. Tap toggles
  off ↔ last value; a vertical drag sets it, committed on release. No numbers
  on the pad — the sheet header echoes "snare · 40%" while you drag. "Always"
  is stored as the ABSENCE of `p`, never `p:1` (the kit-machine law — commit
  hands back `null` or a number, the caller decides how 1 is stored). And the
  engine's op semantics are untouched: `sp`/`p` are per-op, so a grid op
  renders ONE wide pad with the grid shape as ghost ticks — no per-step
  probability storage was invented.
- **TILE** — one continuous param as a Control-Center fill tile, not a slider
  track with a thumb: label top-left, live value bottom-right in REAL units
  ("tone · 2.6 kHz"). Drag anywhere, RELATIVE — starting at the edge doesn't
  jump the value there; slow drag is fine adjustment. Double-tap reverts to
  stock by DROPPING the patch entry (a dot marks "yours" vs "stock").
- **CHIP row** — segmented buttons for discrete choices: period, gait, kit,
  key, chord rate (8/6/4/2 — chips, not a tile, because a choice is not an
  amount).

Every pad and tile registers itself in a live registry
(`window.__DAW.controls`), so the gates enumerate real controls instead of
scraping selectors. The ladder grid and the weave matrix + FIT survive
verbatim, restyled to sheet scale.

### The two new patch keys and their validation law

The patch rides a URL a stranger can write, so both new keys enter through
`PATCH_KEYS` and a structural sanitizer that is shared by the URL door
(`decodePatch`) and the apply choke point — anything invalid drops silently,
because a hostile URL deserves no diagnostics.

- **`secover`** — `{ [sectionId]: {cycles?, melody?, bass?, drums?, pads?} }`,
  the section sheet's output and what makes the grid's columns editable:
  deterministic rules per section, never diffs. Applied BY ID after resolve —
  the state's `sections` array is never replaced, extended or reordered from a
  URL. A section id is always `"<index>:<name>"`, which both rejects junk and
  makes `__proto__` unrepresentable; an id naming no resolved section is inert.
  Every field validates against the ENGINE's own vocabulary, never a hand-kept
  list: cycles int 1..16, melody/bass a pattern name the engine exports (plus
  the patch's OWN drawn cells — except the scratch phrase, inert by law),
  drums a kit in `E.KITS` ∪ the patch's kits, pads boolean.
- **`sound`** — `{ [melody|bass|pad]: {instrument: <id>} }`, the sound tab's
  two-level family→instrument pick over `K.SAMPLERS` (123 GM ids). The id must
  be a key of the COMMITTED registry, so a URL can only ever name audio the
  project already ships — the no-remote-sources law by construction. Applied
  at resolve by mirroring the kernel's own pitched→sampler rewrite (sampler
  spec merged over the existing recipe so level/sends survive; every zone
  pushed into `foundSources` at vol 0), so state-engine builds a native
  sampler unit with zones and no new engine field exists. "Genre's own" is the
  first chip and means the key is ABSENT.

### What got deleted

`deck.js` and `panel.js` are gone — the stack of strips and the
radar-per-track panels they drew are exactly the pile/one-point failure above
(the panel editors' logic migrated into `editors/*`). `layers.js` is SLIMMED:
the `axes()`/spokes machinery is deleted; what survives is what was always
true — `applyLayers` (URL back-compat: every layer/axis id an old shared link
carries still writes the same resolved fields), the per-voice param
read/write table the tiles now read in real units, and a new `master` writer
(bpm 60–190, swing, humanize — time feel lives in the master sheet now, not
on the chords ring). The engine and `machines/*` took zero diffs; the only
state-surface additions are the two patch keys, both patch-side.

### Gates

Updated in place (same filenames, grid selectors): `daw-rack` proves the rack
law on the grid by row-hash; `daw-feel` drives the sculptor at 390×844 touch
and counts range inputs on the whole page with a sheet open; `daw-transport`
still measures real audio through `handle.rms()` and holds canvases
byte-identical while the head advances; `daw-export` unchanged in behavior.
New: **`daw-grid`** (rows × resolved sections, sheet routing by real click,
secover dims exactly one cell and drops exactly those events, secover+sound
URL round-trip, and a hostile `?p` — foundSources smuggling, fake section ids,
a non-SAMPLERS instrument — boots clean and resolves BYTE-IDENTICAL to a
patchless boot); **`daw-controls`** (a real touch drag on a pad lands the
drag's geometry in `patch.kits`, tile relative-drag + double-tap revert, zero
sliders, 44px floor, the keyboard path commits through the same edit path);
**`daw-sound`** (the pick changes the resolved sampler id, repaints only that
row, survives the URL, and state-engine still maps the voice to a native
sampler unit whose injected zone sources are all local, vol 0). The gates ride
`window.__DAW.{grid,sheet,controls}` hooks — never racing a click where a hook
will do.

## Open

- Does `/screensaver` suppress chrome, or is it a plain alias to `/`? The nginx
  block in HOSTING.md currently assumes a plain alias.
- ~~The document does not yet carry `patch` in the URL.~~ **DONE 2026-08-07** —
  `?p` is base64url JSON of the diff, capped at 6000 chars, and the ↗ link button
  copies it. Decoding is **whitelisted** (`song.js PATCH_KEYS`), because a patch
  arrives from a URL a stranger can write and is assigned into a state that drives
  the engine: `foundSources` alone would let a link point the found layer at a
  remote host, the exact thing `no-remote-sources.test.js` exists to prevent.
  **Every new machine must add its key to that set** — a machine whose key is
  missing appears to work and silently loses its edit on reload.
- The two extensionless routes need their nginx blocks on the droplet; until then
  `/daw.html` serves and `/daw` 404s.

## TABLES, RAIL, CONTROLLER (2026-08-11)

**Paul:** *"Tidy up the pickers — it's a bunch of lozenges and hard to scan.
Organize it into tables. Move the radars into the flyout too. Make it DAW on the
left and manipulation on the right or in the popup. Give me volume control and
make the play head and beat counter into one unified tiny controller. Figure out
how to make it work on a phone."*

### What the shipped page measured

Counted off the screenshots at 1440×900 and 390×844, because "hard to scan" is a
number:

- **176 lozenges in one scroll.** The drums PART tab repeated the *entire* kit
  vocabulary — 22 chips — once **per section**, and the form has eight of them.
  The section sheet did the same trick three more times over (~20 melody patterns
  + ~20 bass patterns + 22 kits, per section). Wrapped ragged, centred text, no
  columns: nothing to run your eye down, and the value in force was a highlighted
  pill you had to hunt for.
- **The 11 + 100 gate.** sound SOUND was eleven family pills that merely *unlocked*
  a hundred-odd instrument pills — two lozenge fields stacked, where the question
  ("which instrument?") has exactly one answer.
- **The kernel card ate the top** of both viewports — half the desktop screen
  before a single track — and it was too narrow for its own radar, which printed
  the axes as **"ve"** and **"br"** instead of *drive* and *bright*.
- **Three header rows on a phone**: seed/⟳/link/play, then download, then ← star
  map, before any music was visible at all.
- **The transport was split across two corners** — ▶ in the header, bar·beat·bpm in
  a box bottom-right — and there was **no volume control anywhere on the page**.

### The rail: DAW left, manipulation right

At **≥1000px** the page is a two-column, viewport-height layout that does not
scroll: `#dwShell` is a flex row, the DAW column (`#dwMain` — song bar, grid,
footer) scrolls inside itself, and `#dwSheet` is a permanent **420px rail** on
the right. Below 1000px the same two elements are the old shape: full-width grid,
bottom sheet with its grab handle — 82vh, and its FLOOR is the controller's
ceiling rather than the viewport's, because a fixed bar floating over a scrollport
hides rows permanently and no amount of bottom padding fixes that. **That
difference is CSS ONLY** — `sheet.js` never asks which one it is; all it does is add/remove
`body.dw-sheet-open`, which is a STATE, not a layout.

What made that possible is that the flyout became a **VIEW STACK** rather than a
panel: `push(view)` / `back()` / `root()`, where a view is
`{id, title, hue, render(host, ctx)}`. The **kernel is the root** — the rail is
never empty — `open(target)` still resets the stack to a track/master/section
view exactly as before, and the head carries a `←` that is hidden only at the
root. Drilling in is the whole point: a picker is a PLACE YOU GO, not a field you
scroll past.

### Tables, not lozenge fields

`controls.js` grew a fourth primitive beside pad/tile/chips: **`makeTable`**. A
real `<table>` (so the columns are columns) carrying listbox semantics
(`role="listbox"`, rows `role="option"` + `aria-selected`, ROVING tabindex,
arrows to move, Enter/Space to pick), 44px rows, a 28px leading marker column for
the ✓, sticky group headers, one hairline per row and no zebra. Above 24 rows it
grows a filter — an `<input type="search">`, the vocabulary's one text control,
and explicitly not the thing the no-slider law is about. `sheet.js` wraps it as
`pickerView(...)`, which pushes a table view and pops on pick.

The rule for which surfaces convert: **≤6 short options stay chips** (a 12-key
row reads as a keyboard); anything longer becomes a table. Applied straight
through:

| surface | was | is |
|---|---|---|
| sound INSTRUMENT | 11 family pills gating 100+ instrument pills | ONE filterable table grouped by family, first row "genre's own", scrolled to what is loaded |
| drums KIT per section | 22 pills × 8 sections | a section table (section · kit now · yours), each row drilling into ONE kit picker |
| the section sheet | three pattern walls per section | a five-row rules table (cycles · melody · bass · drums · pads) over [rule, now, yours], each row a picker |
| master ADD | ten "+ pipe" pills | a table, name against what the pipe does (the registry's own `doc`) |
| kernel BASE GENRE | never offered | 274 anchors, one filterable table grouped by form |
| gait, key, chord rate, on/off | chips | **still chips** |

The vocabulary in every one of those tables is read from the ENGINE
(`E.KITS`, `E.MELODY_PATTERNS`, `E.BASS_PATTERNS`, `K.SAMPLERS`, the pipe
registry) plus whatever cells and kits THIS patch carries — the same set
`song.js` sanitizes on the way in, so nothing a picker offers can drop silently
on reload.

### The radars moved into the flyout

`kernelcard.js` → **`kernelview.js`**: the sculptor radar, the tempo tile, the
seed + ⟳ and a base-genre picker (all 274 anchors as ONE filterable table grouped
by form) now live in the rail's kernel view. The card is gone from the page and
`#dwKernel` left the DOM. In its place the grid grew a **kernel ROW** at the top —
blend label, seed, bpm and a tiny non-interactive ◇ glyph — mirroring the master
row at the bottom, so reading the grid top to bottom is still reading the
pipeline: kernel → chords → voices → samples → master.

The clipped axis labels ("ve", "br") were the card's width, and the fix is in
`vector.js`: labels now ride an ELLIPSE (1.06R sideways, 1.3R vertically, because
a word grows sideways) inside a viewBox widened by an optional `labelPad` gutter.
Default 0 = byte-identical for any other caller; the handle also exposes `geom()`
so probes can drag by angle and radius without inferring the scale.

### One tiny controller, with volume

`controller.js` replaces BOTH the header's ▶ and the bottom-right `#dwHead`
readout — they were one instrument split across two corners — and adds the volume
control the page never had. 56px tall, every target ≥44px, bottom-right of the
DAW column on desktop and a full-width bar above the safe area on a phone.
▶/■ is a real click listener (the AudioContext unlock rides the gesture); bar·beat
and bpm are painted from `transport.onHead()`, literally the same call that moves
the playhead lines, so the number and the lines cannot disagree. **Volume is the
tile gesture laid sideways** — relative drag, double-tap for 100%, `role="slider"`
with arrow keys — writing through `TRANSPORT.setVolume` → `handle.setMasterVol`
(both live paths), applied at start too and remembered in `localStorage` as
`dw.vol`. Still zero `input[type=range]` on the page.

With seed/⟳ in the kernel view and ▶ in the controller, the header slims to ONE
row on a phone: brand · ↗ link · ⤓ download · ← star map.

### What the stylesheet had to learn

`app/daw.css` is still the whole contract — editors style nothing — and the
conversion added five rules worth naming, because each one is a class of mistake
rather than a one-off:

- **A table with no `max-height` is not a scroller, and must not pretend to be
  one.** `.dw-tablescroll` was always `overflow-y: auto`; in a picker view (`max:
  0`) it never overflows, so `position: sticky` anchored to a box that never moves
  while the SHEET scrolled underneath — the column heads and family headers rode
  out of view in exactly the 124-row picker that needs them. `makeTable` now says
  `.grows` when it has no max, and the wrap becomes `overflow: clip` (clips to the
  radius, creates no scroll container) so `top: 0` resolves against
  `.dw-sheetbody`, the thing actually scrolling.
- **A drill-in table has nothing to mark.** `.nomark` (set whenever the table
  carries no `value`) collapses the 28px ✓ gutter, so the section table, the
  section rules and the master's ADD list stop indenting every name for a tick
  that can never appear.
- **The hanging indent.** `.dw-edrow` is a wrapping flex row, so the moment its
  controls wrapped — a tile then three flag chips, a pad then four period chips —
  line 2 snapped back to x=0 and sat under the LABEL. The row now carries a
  `--dw-labgap` left gutter and `.dw-edlab` hangs back out of it by exactly that
  much, so every line starts on the same rule.
- **OFF and SILENT are two different sentences.** `roll.js` writes "— silent —"
  into an empty canvas and the CSS `∅` marks a section that turned the voice off;
  both are centred, so every off cell in the grid read "— silen∅ —". A cell the
  form silenced now hides its canvas and says `∅` alone.
- **The song bar scrolls rather than shrinking.** Eight proportional chips across
  390px gave each 45px and truncated every name to three letters; the chips keep a
  96px floor and the bar scrolls sideways, as the grid under it already did.
- **Nothing on a permanent rail may claim to close it.** The ✕ was hidden at
  ≥1000px on that reasoning, and `.dw-sheethandle { display: none }` was written
  in the same block to match — but `.dw-sheethandle` re-declares `display: grid`
  a few lines further down the file, and at equal specificity the later rule
  wins. So the desk rail carried a 419×34 button labelled "close the sheet"
  across its top, and it worked: `close()` resets the stack, so the one thing
  that looked like a grab handle silently threw you back to the kernel. The rule
  is now `#dwSheet .dw-sheethandle`, out of the cascade's reach, and `daw-grid`
  measures both controls' computed `display` at 1440 so it cannot come back.

Measured after: zero page errors and zero horizontal page overflow on every
surface at 320 / 390 / 1024 / 1440, the phone header is one 44px row, and the grid
is the tallest thing on the screen at all four.

### Gates (updated in place — same filenames)

The five gates that touch the reworked surfaces were extended, never relaxed;
every contract they already held (the hostile `?p` trial build, the
`secover`/`sound` round-trip, the rack law's row hashing, no-snap-back on the
radar, the export formats) is still asserted verbatim.

- **`daw-grid`** — the kernel ROW exists as grid FURNITURE (it is not a track: the
  six-row accounting every hash in the suite depends on is checked out loud) and
  both halves of it open the kernel VIEW at the root of the stack. Then the shell,
  in pixels, because `sheet.js` deliberately does not know which one it is: at
  1440 the flyout is a rail BESIDE the DAW column (not over it), showing the
  kernel, with no page scroll and no way to "close" it; at 390 the same element
  is parked off-screen until a cell tap raises it, stops at the controller's
  ceiling, carries its grab handle, and parks again when that handle is tapped.
  Finally the stack: a section row drills in (depth 2, ← appears), ← pops back to
  the sheet you came from, and ← again bottoms out on the kernel.
- **`daw-sound`** — picking is a TABLE row in a pushed picker view, and the gate
  now also holds the thing that makes a 124-row table a table: scrolled a screen
  down, the column head and the family header are still pinned to the top of the
  sheet body, and the last row sits above the transport rather than behind it.
- **`daw-feel`** — the sculptor is opened from the grid's kernel row on a phone
  and its labels must print unclipped; at 1440 it is the rail's ROOT, fully on
  screen at zero taps, which is what moving the card off the page bought.
- **`daw-rack`** — the readout is read off the unified controller, and two new
  facts: the edit does not tear the flyout down under the gesture (the very pad
  you dragged is still the pad, the view is still where you were), and a kit edit
  leaves the kernel and master rows reading exactly as they did.
- **`daw-export`** — A–D still drive `__DAWEXPORT` straight, which proves the
  formats and nothing about reaching them; section E opens the header's ⤓ menu
  the way a hand does at 1280 and 390, and a real click on ⤓ MIDI writes the file
  and closes the menu behind itself.
