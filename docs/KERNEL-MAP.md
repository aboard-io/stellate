# KERNEL-MAP — a line-number index of `engine/genre-kernel.js`

`engine/genre-kernel.js` is the one true monolith: **~8,700 lines**, and ~63%
of it is the inlined `GENRES` object literal (the 249 anchors). This map is the
clickable table of contents so you never scroll blind. Line numbers are current
as of 2026-07-11; the section headers are real `// ---------- … ----------`
banners in the source, so if a number drifts, `grep -n "^  // ----------"` re-derives
the whole table in one shot.

> Regenerate this index:
> ```bash
> grep -nE "^  // -{4,}|^  const (SOURCES|SOURCE_POOLS|SAMPLES|GENRE_CLIPS|DX7_PATCHES|SAMPLERS|FONTS|GENRES|MIND_OVERRIDES|FORMS|FORM_ENTRY) *=" engine/genre-kernel.js
> ```

## The map

| Line | Section | What lives here |
|---:|---|---|
| `1` | shebang / IIFE open | `#!/usr/bin/env node`; UMD wrapper (Node `module.exports` + browser `GenreKernel` global) |
| `29` / `30` | found-sound + sample registry | `SOURCES` — every found-sound/sample id → url/synthText (fetch recipes in the header) |
| `188` / `198` | SOURCE POOLS | `SOURCE_POOLS` — the repertoire law (which sources a role may draw) |
| `265` | SAMPLES | `SAMPLES` — the sampled-instrument / one-shot registry |
| `671` / `675` | genre → found-video clip affinity | `GENRE_CLIPS` — per-genre local `found/video/*.mp4` pools |
| `1194` / `1205` | DX7 patch registry | `DX7_PATCHES` — the genre-space thesis applied to FM instruments |
| `1215` | per-voice insert FX | the insert-effect axis (ringmod, granular, …) |
| `1245` / `1255` | SAMPLER instruments | `SAMPLERS` — real sampled instruments (the sax ask); GM ids |
| `1410` / `1418` | SOUNDFONT SWITCHER | `FONTS` registry (⚙ dropdown, 12 GM fonts) |
| `1424` | SYNTH FONTS | DX7 / MiniMoog font routing (the sampler lane → Faust synth voice) |
| `1514` | SAMPLED DRUM KITS | the sampled-kit registry |
| `1539` | SHARED GM PERCUSSION BANK | the wide GM percussion map beyond the kit backbone |
| `1563` | PER-GENRE PERCUSSION LANE | decorative per-genre perc lanes |
| `1663` / `1664` | **the anchors** | `GENRES` — the 249-anchor literal (runs to ~`6388`; ~63% of the file) |
| `6388` | MUSIC-MIND anchor axes | comment banner: the three optional organ axes |
| `6445` | `MIND_OVERRIDES` | per-anchor theory/pipes/rhythm overrides |
| `6489` | `deriveMind(name, g)` | attaches the three axes to one anchor (also called by `genre-tool` at create-time) |
| `6548` | transition micro-lick soloists | per-genre instrument pools for the transition lick |
| `6643` | **blending: N-way weighted mixing** | `resolveMulti` / `blend` / `mix` — the convex-combination core |
| `7156` / `7160` / `7208` | forms | `FORMS` graph (KERNEL-V4 §3.5); section walker |
| `7383` | `FORM_ENTRY` | each form's designed entry fraction per part (derived from the graphs) |
| `7786` | **MACROS** | eight global slider axes (`applyMacros`; ZERO rng — push resolved values only) |
| `7908` | **choice → engine state** | `toState` — the resolved-choice record → the `state` the engine consumes |
| `8295` | journeys | `playlist` / `journey` — paths along arbitrary weight sequences |
| `8441` | `api` | the exported surface (`GENRES`, `resolveMulti`, `track`, `blend`, `mix`, `journey`, `deriveMind`, …) |
| `8444` | CLI | `node engine/genre-kernel.js <anchors|track|blend|playlist|journey> …` |

## Reading order for a newcomer

1. **`api` (`:8441`)** — the whole public surface on one line; start here.
2. **`resolveMulti`/`blend` (`:6643`)** — how a weight vector becomes one state
   (convex lerp of scalars + seeded pool draws). This is the "genre as a point
   in space" claim made mechanical.
3. **`toState` (`:7908`)** — the resolved choice → the engine `state` object
   that `csd-engine.buildEvents` consumes.
4. **`deriveMind` (`:6489`)** — why every anchor gets theory/pipes/rhythm for
   free, and why an anchor injected after load (the `genre-tool` path) must be
   run through it.
5. **`GENRES` (`:1664`)** — only when you need to read/edit one anchor; use
   `grep -n "^    <name>:" engine/genre-kernel.js` to jump straight to it rather
   than scrolling.

## Related maps

- `docs/ARCHITECTURE.md` — where the kernel sits in the full render pipeline.
- `docs/GENRE-SPACE.md` — the conceptual model (genre = point in a typed space).
- `docs/ADDING-A-GENRE.md` — how `genre-tool.js` splices a new anchor into the
  `GENRES` literal (the marker mechanism it targets).
- `docs/INVARIANTS.md` — what is *proven* about `resolveMulti`'s output.
