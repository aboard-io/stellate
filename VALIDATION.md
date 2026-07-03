# VALIDATION — the differentiation guarantee

GENRE-SPACE.md claims a genre is a **point in a deterministic multidimensional
space** and a blend is a **path** between points. `validate-genres.js` is the
falsifiable version of that claim. It consumes `genre-kernel.js`,
`csd-engine.js`, and `genre-verifier.js` read-only, so every new anchor is
covered automatically the moment it lands.

## Run it

```bash
node validate-genres.js              # full: 5 seeds per genre
node validate-genres.js --quick      # 2 seeds — the pre-push smoke test
node validate-genres.js --seeds 10   # more statistical confidence
node validate-genres.js --json       # machine-readable report
node validate-genres.js --audio      # + empirical Discogs-EffNet probes
                                     #   (needs .venv-verify, models/, csound, ffmpeg;
                                     #    skips gracefully if absent)
```

Exit code 0/1. Only gates 1, 2, and 6 fail the run; the rest warn.

## What each gate proves

| # | gate | thesis claim it tests | threshold |
|---|------|----------------------|-----------|
| 1 | **determinism** | "same seed, same song." `track()` twice must produce identical states; `buildEvents()` must be pure. Without this there is no *space*, only noise. | any mismatch = **FAIL** |
| 2 | **diagonal dominance** (multi-seed) | every anchor scores highest *as itself* — not for one lucky seed (the old matrix) but across N seeded samples near the point. | win rate ≥80% per genre, else **FAIL** |
| 3 | **separation margin** | winning isn't enough; the self-score must clear the best rival by real distance. Reports the 5 weakest genres and the most-confused pairs. | mean margin ≥3 pts; 0–3 = WARN |
| 4 | **feature-space geometry** | anchors are *clusters*, not accidents: each genre-seed point (z-scored symbolic feature vector) must sit closer to its own centroid than to any other genre's. | ≥90% of points, else WARN |
| 5 | **blend monotonicity** | paths morph smoothly: along `blend(a,b,t)`, score(a) falls and score(b) rises, allowing one seed-noise reversal (>2 pts). This is the product's core interaction. | violations = WARN |
| 6 | **vocabulary integrity** | every anchor reference (progressions, kits, fills, patterns, synthesis models, stab/hit patterns, found sources, samples, vox/horn/ding/stations) resolves in the engine + registries. Catches typos in new anchors *before* they silently render as defaults. | any dangling ref = **FAIL** |
| 7 | **audio probe** (`--audio`) | the symbolic verifier isn't lying to itself: render 3 probes, run the Discogs-EffNet classifier on real audio. Opt-in because it is slow. | miss = WARN |

Valid model/pattern/form names are scraped from the engine and kernel *source*
at run time, so new vocabulary never requires touching the validator.

## How to read the report

- `[PASS]/[WARN]/[FAIL]` per gate, worst offenders named inline
  (`canawave: wins 60% of seeds (loses to disco)` means: fix canawave's
  targets or anchor, looking at what disco rewards).
- Gate 3's "most-confused" list is the tuning to-do list: `triphop -> lofi x5`
  means lofi is triphop's nearest rival on all 5 seeds.
- Gate 4's "drifts toward" lines name individual seeds whose feature vector
  landed nearer another genre's centroid — the seeds to render and listen to.
- `--json` emits the full structured result (all margins, all offender points,
  the blend score sequences) for dashboards or bisecting a regression.

## Policy

- **Run after every kernel/anchor/verifier change.** `--quick` minimum;
  full 5-seed before calling a tuning pass done.
- **Matrix diagonal-dominance is necessary but not sufficient.** A genre can
  top its own row by 1 point on one seed and still be indistinguishable in
  practice. The margins (gate 3) and cluster geometry (gate 4) are the real
  differentiation evidence; dominance is just the floor.
- Warn-level regressions are debt: a genre living at margin 0–3 will flip to
  a gate-2 failure the next time a neighbor moves.
- Gate 6 failures are never acceptable, even mid-experiment — a dangling
  reference renders silently as a default and fakes a passing score.
- `--audio` before shipping a *new* genre: symbolic self-consistency (gates
  2–4) plus one empirical check that rendered audio reads as the genre.
