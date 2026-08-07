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
   → **`state.melodyCells`**, merged as `MEL_PHRASES[gen] || state.melodyCells[gen]`.
   The editor draws on a **ladder grid**: y-axis is voicing slots 0–3 + octave,
   never a chromatic keyboard. The grid is the abstraction.
2. **Weave organs** — `MINED_WEAVE` (`csd-engine.js:913`). `start[8]` +
   `slot[8][8]` (Markov transitions over the voicing ladder) + `ioiStart[8]` +
   `ioi[8][8]` (rhythm chain) + `legato` + `step`. Not a melody — the
   *distribution* a melody is drawn from.
   → **`state.melodyWeave`**, edited as a painted 8×8 heatmap. Brush toward the
   diagonal for stepwise motion, toward the corners for leaps.
3. **`wander`** — the fallback walk (`csd-engine.js:1204`): rhythm pool
   `[1,0.5,0.5,1,1,2]`, ±1 step over chord tones, 0.18 octave-leap probability.
   Four hardcoded constants.
   → **`state.melodyGen`**: rhythm pool, step distribution, leap probability,
   range clamp, rest density. Cheapest win on the list, and the one that feels
   most like an instrument.

**The fitter.** `tools/mine/mine-weave.js` is 151 lines and its fitting core is
transition-counting plus normalization — no real dependencies. Ported to the
browser it closes the loop: *draw a few phrases → fit a weave organ from them →
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

## Transport

`FaustLive.exploreLive` (3,530 lines) is a *continuous explorer* — glide, blend,
retarget. Single-song production needs play-from-bar-N, loop-a-range, per-voice
mute/solo, and stop meaning stop. Add a **`songMode` option to the existing
conductor** rather than forking it: it already takes `startBar`, and `makeWalk`
(`faust/live/live.js:145`) is where section/bar selection lives. A fork would
double the surface `test/browser/live*.test.js` has to cover.

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
5. **`state.melodyGen`** → **`state.melodyCells`** (draw phrases) →
   **`state.melodyWeave`** + the in-browser fitter.
6. **Bass op-table transcription** + its machine.
7. Note-fx rack UI over `state.pipes` — mostly a renderer over an existing
   registry.
8. Export cluster — WAV, MP3, MusicXML beside the shipped MIDI.

Steps 1–4 are already a usable instrument.

## Open

- Does `/screensaver` suppress chrome, or is it a plain alias to `/`? The nginx
  block in HOSTING.md currently assumes a plain alias.
- **The document does not yet carry `patch` in the URL.** `?g`/`?seed` round-trip,
  but a kit edit lives only in memory — so a tweaked kit is not shareable or
  reloadable. Needs a compact encoding (the patch is small JSON; the obvious move
  is base64 of the diff, the way the share URL already names a path).
- The two extensionless routes need their nginx blocks on the droplet; until then
  `/daw.html` serves and `/daw` 404s.
