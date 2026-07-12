# NEXT — the live backlog (reconciled 2026-07-11)

*Short status board. **The forward plan lives in `docs/ROADMAP.md`** (six workstreams,
authored this session from a full-system analysis). Read that for what to build; read
`CLAUDE.md` for how the system works.*

**Ground truth:** **249 anchors** (`Object.keys(GENRES).length === 249`; matrix prints
`249/249`). Tree clean; `HEAD == main == origin/main`. Docs still saying 228/240 are stale
(see ROADMAP §4.1).

## What actually shipped (the old A–F queue was stale)
Committed + pushed to main since the last NEXT.md: A.1 scratch (f1c9a14/db5dba5),
A.2 granular repitch (f583c5b), B synth fonts DX7/MiniMoog (993e33b), C.1 Vapor slider
(45057a0), D.1 register-aware voicing (a13703e), D.2 applied-dominant chromaticism
(2d8dcdc), F.2 reedrush kick (5b672dc), F.3 async audio-export walk (19f44d1), plus the
realtime video-export v1 (6df19f8/53c5198) and the live-feedback wins (GM variety, +9
genres, found-at-90%, playhead-scrub). Several are **taste-gated on Paul's ears** and may
be held from prod by the auto-guard until his word: A.1, D.1, D.2, F.2.

## Shipped this session (2026-07-11, uncommitted in-tree, offline + byte-safe, verify.sh GREEN)
- **W1 — genre-intelligence layer (MARQUEE) — LANDED.** The whole offline read-only
  analysis+search layer is built over the verifier feature-space + confusion matrix:
  foundation (`engine/genre-geometry.js`, `engine/genre-sim.js`, persisted
  `matrix.json`); the 1.2 static checks WIRED into `validate-genres.js` as **advisory
  WARN gates 9–13** (near-duplicate, margin sentinel, resolveMulti determinism fuzz,
  feature-level blend monotonicity, dead-axis) via `gateAdvisory` — never hard-fail,
  SKIP-degrading; plus `tools/target-lint.js`, `tools/feature-pca.js`,
  `tools/leak-attribution.js`; and the 1.3/1.4 offline CLI tools (`target-blend`,
  `genre-math`, `surprise`, `empty-space`, `mutate`, `feature-layout`, `neighbors`,
  `genome-diff`, `lesson`, `coverage`, `cross-metric-audit`), each with a `test/*-run.js`.
  **Proof:** `verify.sh` GREEN (matrix+validate+engine+prove+matproof); matrix
  **249/249**; `fixtures.js` 3726 hashes byte-stable (zero drift); segment-parity ALL
  byte-equal. **Remaining:** commit the batch; the two app-UI halves (starmap layout
  toggle + explorer neighbors hover); `docs/GENRE-VECTORS.md`; taste review of WARNs.
  Also landed: W3 quick wins (`docs/KERNEL-MAP.md`, `tools/render-diff.sh`,
  `test/boot-smoke.js`), W4 docs (ARCHITECTURE / ADDING-A-GENRE / GENRE-SPEC-SCHEMA /
  VIDEO-EXPORT), and the 228/240→249 count-drift + stale-claim doc fixes. ROADMAP §1/§3/§4.

## What's genuinely open (pick from ROADMAP)
- **W1 residuals.** Commit the batch; wire the two 1.4 app-UI halves; write
  `docs/GENRE-VECTORS.md`; taste-review the surfaced WARN findings (Paul's ears). ROADMAP §1.
- **W2 — video export.** Fix the shipped path first (silent cross-origin canvas taint;
  false "immune to tab-throttling" claim; no iOS guard; container/extension mismatch;
  unbounded buffering; the CI probe skips assertions headless), then the offline
  ffmpeg.wasm build (item **E**, the largest — mind the COOP/COEP + GPL traps). ROADMAP §2.
- **W3 — modularization.** Quick wins mostly DONE (KERNEL-MAP, render-diff.sh, boot-smoke);
  still open: de-hardcode the absolute `NODE_PATH`, then split the 940KB `genre-kernel.js`
  (63% is the `GENRES` literal) into per-family fragments via byte-safe source-split +
  concat (never a runtime JSON load). ROADMAP §3.
- **W4 — docs.** 228/240→249 drift + stale claims + 4 new contributor docs DONE; only
  `docs/GENRE-VECTORS.md` (the W1 home doc) remains. ROADMAP §4.
- **W6 — remainder:** A.3 (dry granular insert), C.2 (settings visual pass), D.1-coverage
  + **D.3** (borrowed/chromatic-mediant + 9/11/13 extensions), F.1 (iOS device), LFB
  (intl genres, descriptions, node coloring, sample sourcing). ROADMAP §6.

## GATES / SHIP LAW
`tools/ship.sh` = verify.sh (matrix/validate/engine/prove/matproof) + theory/pipes/speech
→ git push → deploy-stellate.sh (rsync to droplet). Refuses a dirty tree. For app/engine
changes ALSO the browser battery (explorer-ui, genre-viz, share-url, simulate-path,
blend-arrival, sampler-inserts-live, wavout, segment-parity, **full-boot-run**;
`NODE_PATH=/home/ford/ftrain-2025/node_modules` — see ROADMAP §3.1 to de-hardcode this).
Recapture `node test/fixtures.js capture` after intentional recipe drift (name the cause).
- **POS COMPLETENESS (2026-07-11 outage law):** ADDING A GENRE requires updating
  `app/world.js` POS (see `docs/ADDING-A-GENRE.md`) — a genre in `GenreKernel.GENRES`
  but missing from POS drops app boot into `computeGenreLayout`'s relaxation and CRASHES
  the WebGL renderer (blank app, no 🛸). Two gates guard this class: `test/pos-coverage.js`
  (plain node, in verify.sh's `poscover` row — CI-safe, catches the exact bug symbolically)
  and `test/full-boot-run.js` (browser battery — loads the REAL index.html/app/main.js boot,
  asserts no crash + 🛸 present + starmap rendered; the star-cruise probes stub main.js so
  ONLY this gate catches a real-boot crash).
segment-parity BYTE-EQUAL. matrix diagonal-dominant (**249/249**). Machines verify
structure; **Paul's ears verify taste**.

## LAWS (still true — full list in ROADMAP §Guardrails)
- **LIVE-ONLY audio** rides the main-thread graph AFTER masterGain → never touches the
  worker-baked press mix → segment-parity/fixtures stay byte-identical.
- **Opt-in DSP flags** (n.granular, f.scratch, recipe fenv) are byte-identical when absent.
- **Whole-path exports MATERIALIZE bars** → cap + async-yield or they OOM/freeze.
- **Constant pace:** the LIVE playhead never materializes the loop; only the EXPORT walks
  it, so caps/async live in the export path.
- **New optional dimensions draw LAST in resolveMulti, ZERO rng when absent** — the reason
  the space grows without regressing fixtures.
