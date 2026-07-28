# GENRE-SPEC-SCHEMA — the `genre-specs/*.json` field reference

A spec is the human-authored input to `tools/genre/genre-tool.js create` (see
`docs/ADDING-A-GENRE.md`). It is NOT the anchor itself — the tool measures it,
derives the verifier target row, and splices a serialized anchor into the
kernel. This reference is cross-checked against `tools/genre/genre-tool.js`
(`validateSpec` / `serializeAnchor` / `FIELD_ORDER`) and the 135 live specs.

> The schema is **derived, never hardcoded.** `validateSpec` builds its
> vocabulary by scraping the live engine registries and its dimension key-set
> from the keys existing anchors actually use, so this doc can drift from the
> code — when in doubt, `node tools/genre/genre-tool.js create <spec> --dry-run` is
> the authority (it prints every validation error).

## Top-level fields

| Field | Req? | Type | Notes |
|---|---|---|---|
| `name` | **yes** | string | must match `^[a-z][a-z0-9]*$` (lower-case alnum, no separators); becomes the anchor key |
| `label` | rec. | string | display name (the band-card genre name); defaults to `name` |
| `info` | rec. | string | the genre card prose (one paragraph); defaults to `""` |
| `anchor` | **yes** | object | the dimension bundle — see below |
| `clips` | no | string[] | ignored since 2026-07-25 (the found-video layer + `GENRE_CLIPS` were removed; legacy specs may still carry it) |
| `pos` | no | `[x,y]` | star-map coordinate (logical px); validated ≥55px from every existing star. Omit to let boot derive one, then re-bake `app/core/world.js` POS |
| `verify` | no | object | controls target-row derivation — see "The verify block" |
| `materials` | no | string | provenance note for sourcing (MATERIALS-style); **informational only**, not consumed by the kernel |
| `damp` | no | (rare) | seen in 4 specs; a niche production hint |

## The anchor object

Values follow three conventions, all resolved seeded by `resolveMulti`:

- **Scalar range** `[lo, hi]` — convex-lerped across the blend, then ONE value
  sampled inside `[lo, hi]`. A bare number (e.g. `chordEvery: 16`, `prob: 0.35`)
  is a fixed scalar.
- **Enum pool** `["a", "b", …]` — a *member* is drawn (seeded), not lerped.
  Every id must exist in the live registry or validation fails.
- **Nested block** — a voice/fx/found object grouping ranges + pools.

### The required core (present in all 135 specs)
`validateSpec` treats a dimension as required when every existing anchor
declares it. Today that is: **`bpm`, `swing`, `humanize`, `progressions`,
`kits`, `fills`, `bass`, `lead`, `pads`, `drums`, `fx`, `found`, `hits`,
`stab`, `form`.**

| Key | Shape | Meaning |
|---|---|---|
| `bpm` | `[lo,hi]` | tempo range |
| `swing` | `[lo,hi]` | swing amount (0–~0.5) |
| `humanize` | `[lo,hi]` | timing/velocity jitter |
| `progressions` | pool | `PROGRESSIONS` ids (harmony skeleton) |
| `kits` | pool | `DRUM_PATTERNS` ids |
| `fills` | pool | `TRANSITIONS` ids (incl. `"off"`) |
| `bass` / `lead` / `pads` | voice block | `{ patterns|prob, recipe:{…} }` — see below |
| `drums` | block | `{ kickModel, snareModel, hatModel (pools), kick, snare, hat, tune, send, dsend (ranges) }` |
| `fx` | block | `{ reverb, delayBeats, delayFb, delayCut, pump, crackle, lowcut, highcut, comp }` (all ranges) |
| `found` | block | `{ role, vol, pitch, stretch, cutoff, sources[] }` — found-sound layer |
| `hits` | block | `{ sources[], pattern, prob }` — one-shot punctuation |
| `stab` | pool | `STAB_PATTERNS` ids (offbeat stabs; `["off"]` to disable) |
| `form` | string | one of `K.FORM_NAMES` (`pop`, `wave`, `dj`, `drop`, `ritual`, `anthem`, `transit`, …); unknown → warns, falls back to `pop` |

### Voice blocks (`bass` / `lead` / `pads`)
```jsonc
"lead": {
  "patterns": ["off", "double"],   // MELODY_PATTERNS (lead) / BASS_PATTERNS (bass) ids
  "prob": 0.35,                     // pads use prob instead of patterns
  "recipe": {
    "model":  ["pluck", "organ"],  // synth/sampler model pool (validated vs state-engine models)
    "wave":   "square",            // waveform enum
    "voices": [1, 1],              // unison voices (range)
    "cutoff": [1400, 2200],        // filter cutoff Hz (range)
    "res":    [0.18, 0.3],         // resonance
    "detune": [0.004, 0.01],       // pad detune
    "attack": [2, 4],              // envelope attack (s)
    "level":  [0.28, 0.4],         // mix level
    "send":   [0.2, 0.35],         // reverb send
    "dsend":  [0.15, 0.3]          // delay send
  },
  "samplerPool": ["…"],            // optional: SAMPLERS ids (route the lane to a sampled instrument)
  "patchPool":   ["…"]             // optional: DX7_PATCHES ids
}
```

### Optional dimensions (seen across specs)
`chordEvery` (harmonic-rhythm bars), `euclid` (`{hat:[k,n], …}` euclidean lanes),
`rubato` (expressive timing range), `counterpoint`, `thunk`, `sampleEvents`
(`[{pool[], placement, sections, treatment:{cutoff, vol}}]`), `reverbColor`,
`timeFeel`, `masterComp`, `meter`, `blueNote`, and the vocal family (`vox`,
`voxPoem`, `voxClean`, `vocal`, `vocalVol`, `vocSource`, `snarePP`, `realHats`).
All optional dimensions **draw their rng LAST and consume none when absent** —
that is the byte-identity law that lets the space grow without regressing
fixtures.

> **`theory` / `pipes` / `rhythm` are NOT authored here.** The kernel's
> `deriveMind` attaches them to every anchor at load. Declare them in the spec
> (or add a `MIND_OVERRIDES[name]` entry in the kernel) only to override the
> heuristic — otherwise omit them.

## The `verify` block
Controls `deriveTargets` (the auto-tightened confusion-matrix target row):

```jsonc
"verify": {
  "seeds": 6,          // how many seeds to render when measuring (default 6)
  "widen": 0.1,        // extra fraction of the measured spread added as padding
  "features": {        // feature → weight for the target row (array form = weight 2, bpm 3)
    "bpm": 3, "motion": 3, "pump": 3, "snareBalance": 2,
    "swing": 2, "chopUse": 2, "bedUse": 1
  }
}
```
If omitted, the tool uses a default feature set and still auto-adds
discriminators until no existing genre is knocked off its diagonal.

## Validation rules (`validateSpec`, enforced at `create`)
1. `name` matches `^[a-z][a-z0-9]*$`; `anchor` is an object.
2. **Unknown dimension key** (not used by any existing anchor) → error (typo).
3. **Missing required dimension** (see the required core) → error.
4. **Registry membership** — every id in `progressions`, `kits`, `fills`,
   `bass/lead.patterns`, `recipe.model`, `samplerPool`, `patchPool`,
   `drums.*Model`, `found.role`/`found.sources`, `hits.sources`/`hits.pattern`,
   `vox.sources`, `sampleEvents[].pool`, `stab` is checked against the live
   engine registries; a miss is a named error.
5. `form` not in `K.FORM_NAMES` → warning (falls back to `pop`).

## See also
- `docs/ADDING-A-GENRE.md` — the create workflow and matrix-safe wiring.
- `docs/GENRE-SPACE.md` — the conceptual model.
- `engine/faust/VOICES.md` — how `recipe` params map to Faust voice params.
- `genre-specs/*.json` — 135 worked examples (127 flat + 8 under `invented/`); `aldente.json` is a compact one.
