# SPEC — the generated sheet at `/spec`

**Decision (Paul, 2026-08-12):** *"Do this for other genres using our kernel but
no LLM in the loop. It shows how the song is built using this format. The
language will be robotic or nonexistent. That's fine. An automated interface. Do
vaporwave next."*

`engine/explain.js` reads a resolved state and returns a spec sheet: eleven
sections, every line from a **table keyed on an engine value** — a bracket of a
number, a kit id, a pattern name — never a string written about a particular
genre. Same law `tools/genre/gen-genre-info.js` holds for the 274 card blurbs,
for the same reason: hand-written prose beside live data rots first. Change the
anchor and the sheet follows. **Total over all 274, zero broken sheets**, gated.

The register is flat on purpose. It is a readout, not an essay.

## It shows how the song is built

`buildStates()` returns cumulative layer-limited states — drums, then +bass, then
+pads, then +melody — so the page's four ▶ buttons let you hear the song assemble.
These are four real states, not one state with faders down: muting a voice changes
how many random numbers the remaining generators draw, so the drum count shifts a
little between steps. That is the engine being seeded per voice, and it is honest.

## Two findings

**`foundSources.length` is not the number of found sounds.** Every sampler zone
rides that array at volume 0 (the kernel's pitched→sampler rewrite), so vaporwave
reported **651 "sources"**, none of them field recordings. The sheet counts what
is actually *placed*: 4.

**FOUND IS NOT A SEPARABLE LAYER, and that took four probes to establish.** On a
`sampledOnly` anchor the drum kit is itself a sampler whose sources ride
`foundSources`, and the found player is what plays them — so muting the found bed
silences the drums. Measured on vaporwave with every pitched voice off:

| | rms |
|---|---|
| bed intact | **0.166** |
| `found.sourceId` nulled | 0.0009 |
| `found` spec deleted | 0.0009 |

Keeping the key was not enough; the bed has to be real. The event stream was
correct and loud throughout — 304 drum hits, kick at 0.99 — so nothing offline
could see it.

**Every mutation in isolation was fine.** A bisect over single changes found
nothing, because it never tried the combination. Rather than ship a button that
silences the thing it claims not to touch, `LAYERS` is the four voices that *are*
separable and the anchor's found layer is left exactly as it was in every step.
The page says so.

Measured after: vaporwave 0.147 / 0.145 / 0.249 across drums → +bass → everything.

## Gates

`node test/unit/explain.test.js` — 49 checks: the module names no genre, the
sheet is total over 274 with no `undefined`/`NaN`, found counts placements rather
than the zone array, `found` is not offered as a layer, the anchor's found layer
is byte-identical in every build step, drums sound when the anchor has them,
nothing after the current layer leaks in, and the final layer restores every voice.

## KNOBS (2026-08-12)

**Paul: *"Could we do this as a bundle of knobs? Like 60 knobs or something?"***

Counted against `song = D · S · (N ∘ τ)`: **27 knobs, not 60** — 12 headline and
15 trim. That is the whole of D and τ, and every one of them interpolates cleanly
across the catalogue. What is left out is left out for a reason:

- **N** is a picture, not a parameter set. You draw it.
- **the word** is an ordering. A knob cannot hold one.
- **S** is one-hot out of ~140. See below.

This also settles which side of the no-slider law the genre operator falls on.
That law is right and it is a law about **N** — a probability pad beats a range
input, and editing notes with sliders is what `/daw` rejected. It was never a law
about **G**, which genuinely is a bundle of continuous numbers. (These are tiles,
not `input[type=range]`; the count on the page is still zero.)

### SUBMERGE — one knob over four fields

Measured at seed 7, the vapor family moves as one dimension:

```
citypop    99 bpm   reverb .36   highcut open   crackle .07
vaporwave  76 bpm   reverb .88   highcut 11.6k  crackle .19
mallsoft   50 bpm   reverb .90   highcut  6.4k  crackle .23
```

So they are one gesture with four projections, and a panel offering four sliders
offers three ways to make the fourth one wrong. It is defined as a **relative
move** rather than a curve through those points, so it works on any anchor: 0
changes nothing, +1 is the mallsoft end. Its constants are read off the table
above, not chosen. Fully submerging city pop lands on mallsoft within 6 bpm, .06
reverb, 900 Hz and .04 crackle — gated.

### The instrument dial, derived

S was the coin flip: a 25/75 acidhouse/tango blend gives `tb303`, 50/50 gives
`bandoneon`, 75/25 gives `tb303` again. Averaging a discrete coordinate is not a
midpoint.

The fix needed an ORDER on ~140 instruments, and **the catalogue had already
voted**: the mean `cutoff` the 274 anchors assign when they use an instrument is
a brightness reading. Sorting each family by it gives

```
lead    sub · reese · tb303 · acid · atmosphere · modeld
string  cello · slow_strings · strings · fiddle · violin · viola
brass   tuba · french_horns · brass_section · … · muted_trumpet
mallet  marimba · music_box · celesta · kalimba · steel_drums · vibraphone
```

dark to bright, low to high, in every family. So a voice becomes two dials —
family, then position — and no new measurement was needed. The gate holds the
musical readings, not just that the array is sorted.

### The bug the gate caught

**Zero means open, not zero.** The engine spells "no top cut" as
`tone.highcut: 0`, so a knob reading the raw number showed **800 Hz** — the
darkest possible setting — for every genre with an open top, and the submerge
sweep read as going *up*. Off now reads as the maximum and writing the maximum
writes 0 back, keeping the engine's idiom. It surfaced as a monotonicity failure,
which is the only reason it was visible at all.

### Gates

`node test/unit/knobs.test.js` — 50 checks: every knob reads inside its range on
all 274 and round-trips, no two knobs share a path, **each one moves its own field
and nothing else**, submerge is byte-identical at 0 and monotone in all four
projections, every anchor survives being fully submerged and still renders, and
the instrument dial is ordered and covers every instrument in use.
`node test/browser/spec.test.js` — 16 checks: the knobs sit under the rows they
drive, a submerge drag moves tempo *and* space together, a turned knob is marked
and revertible, it still sounds, and the standing laws hold.
