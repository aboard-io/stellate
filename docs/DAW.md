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
