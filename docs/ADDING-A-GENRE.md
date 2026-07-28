# ADDING A GENRE — spec → anchor → matrix-safe wiring

A genre is added by writing a small JSON **spec**, then letting
`tools/genre/genre-tool.js` measure it, derive its verifier target row, and splice it
into the kernel — never by hand-editing the `GENRES` literal. This keeps the two
hard laws intact: **byte-identical renders** (your anchor draws its rng LAST and
consumes none when absent) and the **matrix stays 274/274 diagonal-dominant**
(the tool auto-tightens the target row until no existing genre is knocked off
its own diagonal). Full field reference: `docs/GENRE-SPEC-SCHEMA.md`.

## Your first genre in ~6 commands

```bash
# 1. Scaffold from the nearest existing genre (anchor copied verbatim, label/info
#    replaced with TODO placeholders). --near picks the template deliberately.
node tools/genre/genre-tool.js init mygenre --near aldente
$EDITOR genre-specs/mygenre.json        # set label, info, the anchor dims, optional pos

# 2. Dry-run: measure + derive the target row + report neighbours, write NOTHING.
node tools/genre/genre-tool.js create genre-specs/mygenre.json --dry-run

# 3. For real: splice anchor → engine/genres-data.js, target row → genre-verifier.js,
#    star → app/core/world.js POS, then run the matrix + validate gates.
node tools/genre/genre-tool.js create genre-specs/mygenre.json

# 4. Regenerate the star-cruise data (a genre with no planet and no star system
#    is invisible to the 🛸 flight view — and the coordscover gate fails).
node tools/build/feature-layout3d.js && node tools/build/cluster-genres.js

# 5. Re-export the spec so the folder round-trips byte-for-byte (create does not
#    write the spec back; export adds pos/mind/perc/targets and drops `verify`).
node tools/genre/genre-tool.js export mygenre

# 6. Gates, then ears. Machines prove it's distinct; only Paul's ears say it's good.
./verify.sh
node tools/kernel-cli.js track mygenre --seed 7 --render
```

**Read this before step 2.** `init` clones the template's anchor verbatim, and
228 of the 274 shipped specs carry `pool:<class>` source tokens in
`found.sources` / `hits.sources` — which `create` REJECTS, because
`validateSpec` only knows raw `SOURCES`/`SAMPLES` ids
(`found.sources: "pool:industry*1" not in registry`). Whatever you scaffold
from, expect to replace those tokens with raw source ids before `create` will
run (see GENRE-SPEC-SCHEMA "Source pools").

## What `create` actually does

1. **Validate** (`validateSpec`) — the spec is checked against a *derived*
   vocabulary + schema (never a hardcoded list): every `kits`/`progressions`/
   `fills`/`bass.patterns`/`recipe.model`/`samplerPool`/`patchPool`/source id is
   confirmed to exist in the live engine registries, and every anchor dimension
   key is confirmed to be one an existing anchor already uses (an unknown key is
   almost certainly a typo). Errors abort before anything is written.
2. **Inject + `deriveMind`** — the anchor is spliced into the in-memory
   `K.GENRES[name]`, then `K.deriveMind(name, anchor)` attaches the three
   MUSIC-MIND axes (`theory`/`pipes`/`rhythm`). This is mandatory: the kernel
   attaches those axes to every anchor at LOAD, so an anchor injected *after*
   load must get the same pass or `resolveMulti` crashes on
   `g.theory.adventure`. `deriveMind` is guarded (`if(!g.theory)…`), so it is a
   no-op on anything already derived. Explicit `theory`/`pipes`/`rhythm` inside
   your spec's `anchor`, or a `MIND_OVERRIDES[name]` entry in the kernel, WIN
   over the heuristic derivation — use those to hand-tune adventure/voicing/
   pipes for a genre whose auto-derived mind is wrong. (The top-level `mind`
   block an exported spec carries is descriptive; `create` does not read it.)
3. **Measure → derive targets** — `measure()` renders the anchor over N seeds
   (default 6, or `verify.seeds`) and extracts the feature vectors;
   `deriveTargets()` turns the measured per-feature spread into a
   `[lo, hi, weight]` target row, then **auto-tightens**: while any existing
   genre would score ≥ its own diagonal on the new row, it adds the feature that
   best separates the worst offenders. The dry-run prints the row, the
   auto-added discriminators, the self-score, nearest neighbours, and who you
   crowd — read this before committing. A `⚠ still knocking off` line means the
   anchor is not yet distinct.
4. **Splice (matrix-safe wiring)** — idempotent, marker-delimited inserts:
   - anchor → `GENRES` literal in `engine/genres-data.js`
     (`/* genre-tool:<name>:genres */` markers).
   - target row → `TARGETS` in `engine/genre-verifier.js`.
   - star position → `POS` in `app/core/world.js`, only when the spec gives
     `pos` (see below).
   Re-running `create` replaces the prior tool insertion in place (idempotent),
   so iterating on a spec never duplicates or corrupts the block.
5. **Gates** — the tool itself runs `genre-verifier.js matrix --no-cache` and
   `validate-genres.js --quick` (skip with `--skip-gates`, add the faust press
   smoke with `--engine`) and exits nonzero if either fails.

What `create` does NOT do: write the spec file back, place the 3D planet/cluster,
or re-bake POS for a spec without `pos`. Those are steps 4 and 5 above.

## The gates a new genre must pass

| gate | verify.sh row | what it wants from you |
|---|---|---|
| `engine/genre-verifier.js matrix --no-cache` | (run by `create`) | a `diagonal dominant:` line covering the whole catalogue, one row longer than before |
| `test/gates/prove-matrix.test.js` | `matproof` | your anchor's declared ranges inside the proven hull (the offline prover cross-checks `engine/invariants.js`) |
| `test/gates/pos-coverage.test.js` | `poscover` | a `POS` entry in `app/core/world.js` — no exceptions |
| `test/gates/coords-coverage.test.js` | `coordscover` | a `GENRE_COORDS` planet **and** a `CLUSTER_OF` star (step 4) |
| `test/gates/genre-specs.test.js` | `specs` | `genre-specs/<name>.json` matching `export` byte-for-byte (step 5) |
| `test/gates/doc-counts.test.js` | `doccounts` | every doc that states the catalog size states the new one |
| `test/gates/kernel-data-identity.test.js` | `kerneldata` | nothing — it compares the working tree against HEAD, so it goes red on any genre-data edit and self-heals on commit |

## `POS` — the star map

`POS` in `app/core/world.js` is a **baked cache** of `computeGenreLayout`.
`spec.pos` is `[x,y]` in the chart's logical px and is **optional**:

- **Give `pos`** and the tool splices it directly (validated ≥55px from every
  existing star — crowded stars blur blends, the arabpop/triphop lesson) so boot
  stays on the fast path and `poscover` is green immediately.
- **Omit `pos`** and boot derives a spot near the genre's musical family
  (`app/map/starmap.js` similarity-seeded relaxation), but the cache is now
  incomplete: `poscover` FAILS until you re-bake. After a batch of additions,
  open the app, read `window.__X.POS`, and paste the full relaxed layout back
  into `app/core/world.js`. (`node tools/build/relayout-map.js --write` repacks
  the WHOLE catalogue so every label has room; it moves existing stars, which
  moves the music under old `?path=` share links, so it is a deliberate
  catalogue-wide operation, not a per-genre step.)

A genre missing from `POS` is worse than *invisible-but-audible*: under the real
app boot the missing-genre relaxation collapses the layout and CRASHES the WebGL
renderer — a blank app, no 🛸. `test/browser/full-boot.test.js` asserts the real
boot comes up; run it after adding.

## Guardrails
- **Never hand-edit the `GENRES` literal** in `engine/genres-data.js`. Use the
  tool; it owns the markers.
- **Never negative weights / inline specs at resolve time** — `resolveMulti`
  takes existing names only.
- **New optional dimensions draw LAST and consume ZERO rng when absent** — this
  is what keeps every existing fixture byte-identical when you add a genre.
- **The matrix is the referee.** If `create`'s report says you score higher as
  another genre than yourself, the anchor identity is too weak — sharpen a
  distinguishing dimension (tempo, swing, kit, sub, motion), don't fight the
  target row.
- **Taste is Paul's.** The gates prove distinct + well-formed; shipping is
  ear-gated (`tools/deploy/ship.sh`).
