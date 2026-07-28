# GENRE-SPEC-SCHEMA — the `genre-specs/*.json` field reference

A spec is both the human-authored input to `tools/genre/genre-tool.js create`
(see `docs/ADDING-A-GENRE.md`) and the **exported description** of a genre that
already ships. The folder is bidirectional: `genre-tool.js export --all` re-derives
every spec from the live kernel, and `test/gates/genre-specs.test.js` (verify.sh
`specs` row) fails unless the folder ALREADY matches, byte for byte. One spec per
genre, 274 files, no orphans.

A spec is not the anchor. `create` measures it, derives the verifier target row,
and splices a serialized anchor into `engine/genres-data.js`. This reference is
cross-checked against `validateSpec` / `specFor` / `serializeAnchor` /
`FIELD_ORDER` in `tools/genre/genre-tool.js` and against the 274 live specs.

> The schema is **derived, never hardcoded.** `validateSpec` builds its
> vocabulary by scraping the live engine registries and its dimension key-set
> from the keys existing anchors actually use, so this doc can drift from the
> code — when in doubt, `node tools/genre/genre-tool.js create <spec> --dry-run` is
> the authority (it prints every validation error).

## Top-level fields

| Field | Req? | Written by `export` | Read by `create` | Notes |
|---|---|---|---|---|
| `name` | **yes** | yes | yes | must match `^[a-z][a-z0-9]*$` (lower-case alnum, no separators); becomes the anchor key, and must equal the filename |
| `label` | **yes** | yes | yes | display name (the band-card genre name); defaults to `name` |
| `info` | **yes** | yes | yes | the genre-card prose (one paragraph); defaults to `""` |
| `anchor` | **yes** | yes | yes | the dimension bundle — see below |
| `pos` | no | yes (when the genre has a star) | yes | `[x,y]` star-map coordinate in logical px, validated ≥55px from every existing star. **Optional**: omit it and boot derives one, then re-bake `app/core/world.js` POS |
| `mind` | no | yes | **no** | the derived `theory`/`pipes`/`rhythm` axes, written for READING. `deriveMind` recomputes them at load; to override, put `theory`/`pipes`/`rhythm` inside `anchor` or add a `MIND_OVERRIDES[name]` entry in the kernel |
| `perc` | no | yes (52 genres) | **no** | `PERC_STYLES[genre]`, which the kernel keys by genre NAME rather than by anchor key. Descriptive only |
| `targets` | no | yes | **no** | the genre's `TARGETS` row from `genre-verifier.js`. `create` MEASURES this row from real renders; it never reads one from a spec |
| `verify` | no | **no** | yes | tuning knobs for that measurement (`seeds` / `features` / `widen`) — see "The verify block". No shipped spec carries one, and one left in a file fails the round-trip gate |

Four keys are **retired** and the gate rejects them outright: `clips` (the
found-video layer and `GENRE_CLIPS` are gone), `materials`, `invented`, `damp`.
Nothing reads them, so a spec carrying one describes machinery that does not
exist.

## The anchor object

Values follow three conventions, all resolved seeded by `resolveMulti`:

- **Scalar range** `[lo, hi]` — convex-lerped across the blend, then ONE value
  sampled inside `[lo, hi]`. A bare number (e.g. `chordEvery: 16`, `prob: 0.35`)
  is a fixed scalar.
- **Enum pool** `["a", "b", …]` — a *member* is drawn (seeded), not lerped.
  Every id must exist in the live registry or validation fails.
- **Nested block** — a voice/fx/found object grouping ranges + pools.

### The required core (present in all 274 anchors)
`validateSpec` treats a dimension as required when every existing anchor
declares it. Today that is: **`bpm`, `swing`, `humanize`, `progressions`,
`kits`, `fills`, `bass`, `lead`, `pads`, `drums`, `fx`, `found`, `hits`,
`stab`, `form`.**

| Key | Shape | Meaning |
|---|---|---|
| `bpm` | `[lo,hi]` | tempo range |
| `swing` | `[lo,hi]` | swing amount (0–~0.5) |
| `humanize` | `[lo,hi]` | timing/velocity jitter |
| `progressions` | pool | `PROGRESSIONS` ids (harmony skeleton; 36 tables) |
| `kits` | pool | `DRUM_PATTERNS` ids (22) |
| `fills` | pool | `TRANSITIONS` ids (incl. `"off"`) |
| `bass` / `lead` / `pads` | voice block | `{ patterns|prob, recipe:{…} }` — see below |
| `drums` | block | `{ kickModel, snareModel, hatModel (pools), kick, snare, hat, tune, send, dsend (ranges) }` |
| `fx` | block | `{ reverb, delayBeats, delayFb, delayCut, pump, crackle, lowcut, highcut, comp }` (all ranges) |
| `found` | block | `{ role, vol, pitch, stretch, cutoff, sources[] }` — found-sound layer |
| `hits` | block | `{ sources[], pattern, prob }` — one-shot punctuation |
| `stab` | pool | `STAB_PATTERNS` ids (offbeat stabs; `["off"]` to disable) |
| `form` | string | one of `K.FORM_NAMES`: `dj`, `drop`, `wave`, `ritual`, `anthem`, `transit`, `pop`, `aaba`, `vamp`, `storm`, `throughline`, `duet`, `suite` |

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

### Source pools (`found.sources`, `hits.sources`, `vox.sources`)
A sources list may name a raw `SOURCES`/`SAMPLES` id, or a **class token**
`"pool:<class>"` / `"pool:<class>*N"` — `expandPools` swaps the token for N
members of `SOURCE_POOLS[class]` (32 classes: `city`, `road`, `industry`,
`voices`, `nature`, `water`, `room`, `weather`, …) drawn on a dedicated
per-(seed, class) rng stream, so a genre without a token stays byte-identical.
228 of the 274 shipped specs carry such tokens.

> **Known gap, and it is a big one:** `validateSpec` checks source ids against
> `SOURCES` + `SAMPLES` only, so it rejects `pool:` tokens as unknown ids —
> `found.sources: "pool:industry*1" not in registry`. Export and the round-trip
> gate are happy; `create` is not. Re-running `create` on any of those 228
> exported specs fails validation even though the anchor it describes is exactly
> what ships, and `init --near <most genres>` scaffolds a spec that cannot be
> created. Until the tool's vocabulary learns the token form, replace pool
> tokens with raw source ids in a spec you intend to `create`.

### Optional dimensions
Everything else is optional and draws its rng LAST, consuming none when absent —
that is the byte-identity law that lets the space grow without regressing
fixtures. In use today, by anchor count:

`reverbColor` (95), `timeFeel` (60), `chordEvery` (51), `rubato` (48),
`sampleEvents` (41), `euclid` (29), `snarePP` (16), `vocSource` (14),
`masterComp` (13), `transforms` (8), `strum` (5), `counterpoint` (5),
`thunk` (4), `introMode` (3), `vox` (3), `autoTune` (3), `voxPoem` (2),
`meter` (2), `padDouble` (2), `blueNote` (2), `leadOctave` (1), `vocal` (1),
`vocalVol` (1).

A key no anchor uses is an **error**, not a warning — `validateSpec` treats it
as a typo. The accepted key-set is the union of the keys live anchors declare
and the anchor properties the kernel source reads (`GENRES[x].dim`, `g.dim`,
`A.dim`), so a declared-but-not-yet-used dimension is recognised. Two names that
survive in `FIELD_ORDER` — `voxClean` and `realHats` — belong to no anchor and
are rejected on sight.

> **`theory` / `pipes` / `rhythm` are NOT authored here.** The kernel's
> `deriveMind` attaches them to every anchor at load, and `export` writes them
> back out under the top-level `mind` key. Declare them inside `anchor` (or add
> a `MIND_OVERRIDES[name]` entry in the kernel) only to override the heuristic —
> otherwise omit them.

## The `verify` block
Controls `deriveTargets` (the auto-tightened confusion-matrix target row) when
you run `create`:

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
discriminators until no existing genre is knocked off its diagonal. `export`
does not emit `verify`, so re-export the spec once the genre is in — otherwise
the round-trip gate reports the file as drifted.

## Validation rules (`validateSpec`, enforced at `create`)
1. `name` matches `^[a-z][a-z0-9]*$`; `anchor` is an object.
2. **Unknown dimension key** (not used by any existing anchor, not read by the
   kernel source) → error (typo).
3. **Missing required dimension** (see the required core) → error.
4. **Registry membership** — every id in `progressions`, `kits`, `fills`,
   `bass/lead.patterns`, `recipe.model`, `samplerPool`, `patchPool`,
   `drums.*Model`, `found.role`/`found.sources`, `hits.sources`/`hits.pattern`,
   `vox.sources`, `voxPoem`, `vocSource`, `sampleEvents[].pool`, `stab` is
   checked against the live engine registries; a miss is a named error.
5. `form` not in `K.FORM_NAMES` → **error** (the message mentions the `pop`
   fallback, but the spec is rejected before anything is written).

Errors abort `create` before a byte is written; unknown TOP-level keys are
ignored by the validator and caught later by the spec-shape gate.

## See also
- `docs/ADDING-A-GENRE.md` — the create workflow and matrix-safe wiring.
- `docs/GENRE-SPACE.md` — the conceptual model.
- `engine/faust/VOICES.md` — how `recipe` params map to Faust voice params.
- `genre-specs/*.json` — 274 worked examples; `aldente.json` is a compact one.
