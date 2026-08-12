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
