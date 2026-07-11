# ADDING A GENRE — spec → anchor → matrix-safe wiring

A genre is added by writing a small JSON **spec**, then letting
`tools/genre-tool.js` measure it, derive its verifier target row, and splice it
into the kernel — never by hand-editing the `GENRES` literal. This keeps the two
hard laws intact: **byte-identical renders** (your anchor draws its rng LAST and
consumes none when absent) and the **matrix stays 249/249 diagonal-dominant**
(the tool auto-tightens the target row until no existing genre is knocked off
its own diagonal). Full field reference: `docs/GENRE-SPEC-SCHEMA.md`.

## Your first genre in ~5 commands

```bash
# 1. Copy the nearest existing spec as a starting point (102 live in genre-specs/).
cp genre-specs/aldente.json genre-specs/mygenre.json
$EDITOR genre-specs/mygenre.json        # set name, label, info, anchor dims, pos

# 2. Dry-run: measure + derive the target row + report neighbours, write NOTHING.
node tools/genre-tool.js create genre-specs/mygenre.json --dry-run

# 3. For real: splice anchor → genre-kernel.js, target row → genre-verifier.js,
#    clips → GENRE_CLIPS, star → app/world.js POS, then run the gates.
node tools/genre-tool.js create genre-specs/mygenre.json

# 4. Confirm the confusion matrix still holds (the tool runs this, but re-check):
node engine/genre-verifier.js matrix --no-cache        # → 249/249 (now 250/250)

# 5. Listen. Machines proved it's distinct; only Paul's ears say it's good.
node engine/genre-kernel.js track mygenre --seed 7 --render
```

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
   no-op on anything already derived. Explicit `theory`/`pipes`/`rhythm` in your
   spec, or a `MIND_OVERRIDES[name]` entry in the kernel, WIN over the heuristic
   derivation — use those to hand-tune adventure/voicing/pipes for a genre whose
   auto-derived mind is wrong.
3. **Measure → derive targets** — `measure()` renders the anchor over N seeds
   (default 6) and extracts the 23-feature vectors; `deriveTargets()` turns the
   measured per-feature spread into a `[lo, hi, weight]` target row, then
   **auto-tightens**: while any existing genre would score ≥ its own diagonal on
   the new row, it adds the feature that best separates the worst offenders.
   The dry-run prints the row, the self-score, nearest neighbours, and who you
   crowd — read this before committing.
4. **Splice (matrix-safe wiring)** — four idempotent, marker-delimited inserts:
   - anchor → `GENRES` literal in `engine/genre-kernel.js`
     (`/* genre-tool:<name>:genres */` markers, at the `TERM.genres` point).
   - target row → `TARGETS` in `engine/genre-verifier.js`.
   - clips (if any) → `GENRE_CLIPS` in the kernel.
   - star position → `POS` in `app/world.js` (see below).
   Re-running `create` replaces the prior tool insertion in place (idempotent),
   so iterating on a spec never duplicates or corrupts the block.
5. **Gates** — `matrix --no-cache` must stay diagonal-dominant; `./verify.sh`
   green; then fixtures re-baked if an *existing* render intentionally drifted
   (a new anchor alone should not drift existing fixtures — it draws last and is
   absent from every existing state).

## Re-baking `app/world.js` POS (the star map)

`POS` is a **baked cache** of `computeGenreLayout` (`app/world.js`). `spec.pos`
is `[x,y]` in the chart's logical px and is now **optional**:

- **Give `pos`** and the tool splices it directly (validated ≥55px from every
  existing star — crowded stars blur blends, the arabpop/triphop lesson) so boot
  stays on the fast path.
- **Omit `pos`** and boot derives a spot near the genre's musical family
  (`app/starmap.js` similarity-seeded relaxation). After a batch of additions,
  re-bake the cache: open the app, read `window.__X.POS`, and paste it back into
  `app/world.js`'s `POS` table (the batch re-bake pastes the full relaxed layout
  back). A genre missing from `POS` is *invisible-but-audible* — the hogcore/
  prelude lesson — so don't skip the re-bake.

## Guardrails
- **Never hand-edit the `GENRES` literal.** Use the tool; it owns the markers.
- **Never negative weights / inline specs at resolve time** — `resolveMulti`
  takes existing names only.
- **New optional dimensions draw LAST and consume ZERO rng when absent** — this
  is what keeps every existing fixture byte-identical when you add a genre.
- **The matrix is the referee.** If `create`'s report says you score higher as
  another genre than yourself, the anchor identity is too weak — sharpen a
  distinguishing dimension (tempo, swing, kit, sub, motion), don't fight the
  target row.
- **Taste is Paul's.** The gates prove distinct + well-formed; shipping is
  ear-gated (`tools/ship.sh`).
