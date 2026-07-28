# tools/genre/ — what is wired in, and what is not

Twenty-one tools live here. Five are **pipeline**: the project's docs and gates
invoke them, and changing one changes what ships. Sixteen are **hand-run
analysis**: nothing in the app, the engine, `verify.sh` or the deploy path calls
them, and most of them cite `docs/ROADMAP.md`, a document that was **deleted on
2026-07-27** (`bd94b1e`, "three docs that were actively misleading") for
asserting things that were no longer true. The ROADMAP section numbers in their
headers — §1.2.1, §1.3.4, §1.4.6 — now point at nothing.

This README exists because those sixteen read as first-class tooling and are
not. They landed in one commit (`ab8f3fe`, 2026-07-11, "Genre-intelligence
layer") — about 3,100 lines in a single afternoon — and have been essentially
untouched since. **They are not being retired.** They work, they are read-only,
and several are genuinely good. But before you rely on one, know that no gate is
watching it.

---

## Pipeline — invoked by docs, gates or other tools

| tool | who calls it |
| --- | --- |
| `genre-tool.js` | the documented way to author a genre from `genre-specs/*.json` (CLAUDE.md, `docs/ADDING-A-GENRE.md`, `docs/GENRE-SPEC-SCHEMA.md`) and **the `specs` job in `verify.sh`** runs `genre-tool.js export --all --dry-run` via `test/gates/genre-specs.test.js` |
| `invent-genres.js` | the automated genre-invention pipeline; `require`s `genre-tool.js`, and `engine/namebank.js` points at it. It is how the catalogue went 110 → 178 |
| `gen-genre-info.js` | regenerates all 274 `info` blurbs from their anchors (`--write`); the current source of the descriptions in `engine/genres-data.js` |
| `lerp-genre.js` | invents a genre by interpolating two anchors, writing a real `genre-specs/*.json` that `genre-tool.js` then consumes |
| `rm-genre.js` | the inverse of `genre-tool.js`: strips a genre's marked blocks out of `genres-data.js` + `genre-verifier.js` |

`lerp-genre.js` and `rm-genre.js` have no automated caller — they are pipeline
because they *write the committed kernel*, which is the highest-stakes thing a
tool here can do. Run them deliberately, and run the gates afterwards.

## Hand-run analysis — no caller, run by a human

Eight of these have a library-level probe under `test/` that `npm run
test:browser` picks up (it globs `test/*-run.js`). A probe is not the same as a
gate in `verify.sh`: it proves the module still loads and computes, not that
anything depends on the answer.

| tool | what it answers | probe |
| --- | --- | --- |
| `target-blend.js` | nearest reachable blend to a requested verifier-score profile (hill-climb on the weight simplex) | `test/unit/target-blend.test.js` |
| `genre-math.js` | genre arithmetic — `"house*0.7 + techno*0.3 - wash"` | `test/unit/genre-math.test.js` |
| `surprise.js` | the maximally-distinct blend: same material as `target-blend`, opposite objective | `test/unit/surprise.test.js` |
| `empty-space.js` | which regions of the blend cloud are unreachable, and what bounds them | `test/unit/empty-space.test.js` |
| `mutate.js` | clone an anchor, perturb ONE dimension, re-render, ask whether it is still music | `test/unit/mutate.test.js` |
| `feature-layout.js` | deterministic top-2 PCA of the measured centroids → a 2D "how it actually sounds" map | `test/unit/feature-layout.test.js` |
| `feature-pca.js` | dead axes / redundancy across the 23 symbolic features | `test/unit/feature-pca.test.js` |
| `target-lint.js` | verifier `TARGETS` boxes vs each genre's own measured spread | `test/unit/target-lint.test.js` |

The remaining eight have **no probe and no caller at all**:

| tool | what it answers |
| --- | --- |
| `coverage.js` | feature-space occupancy dashboard over the persisted per-(genre,seed) cache |
| `cross-metric-audit.js` | the catalogue's three notions of "close" (confusion / anchor-Jaccard / 2D layout) correlated, worst disagreements first — the places the map lies |
| `neighbors.js` | k-nearest genres in both coordinate systems |
| `genome-diff.js` | readable diff of two genres: declared choices, spec pools, measured feature deltas |
| `leak-attribution.js` | for a confused pair, *why* — which target-box features the impostor's score rides on |
| `lesson.js` | walks `K.blend(A,B,t)` on a fine grid and narrates which dimension flips at which `t` |
| `render-diff.sh` | byte-diff of symbolic renders between your working tree and a git ref, via a throwaway detached worktree. The most immediately useful thing in this folder |
| `render-diff-harness.js` | the node half of `render-diff.sh` — not a standalone tool |

Everything in this table is offline, read-only and deterministic: no
`Date.now()`, no `Math.random()`, no mutation of `K.GENRES`, and none of them
runs during a render. Several depend on the persisted verifier cache under
`scratch/.verify-cache/` — build it first with
`node engine/genre-verifier.js matrix` or they will tell you it is missing.

## Paths

Every tool here resolves the repo root as `path.join(__dirname, "..", "..")`
since the 2026-07-28 `tools/` split. `render-diff.sh` finds its harness as a
sibling (`$SCRIPT_DIR/render-diff-harness.js`) and the repo root two levels up.
