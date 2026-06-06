# Found-sound sources & attribution

The found-sound layer is **field recordings from [radio aporee ::: maps](https://aporee.org/maps/)**,
mirrored on the **Internet Archive**. The audio files themselves are **not committed** —
`fetch-found-sound.sh` downloads them and `royal-road.csd` granular-processes them
through `syncgrain` (time-stretched, pitched down, sent to the reverb).

aporee field recordings are generally licensed **CC BY-NC-SA**. Respect that for any
distribution: attribute, non-commercial, share-alike. This sketch is a personal /
illustrative render, not a release.

## Recordings used

| local name | Internet Archive item | content | currently layered |
|---|---|---|---|
| `tokyo_station` | [`aporee_20938_24294`](https://archive.org/details/aporee_20938_24294) — `nov19tokyostation1934.ogg` | Tokyo Station — metro voices, announcements, platform ambience | ✅ |

## Recordings used historically (available to re-layer)

These appeared in earlier versions of the arrangement (as solo interludes /
transitions) and are wired as commented entries in `fetch-found-sound.sh`:

| local name | Internet Archive item |
|---|---|
| `tsukiji` | [`aporee_35166_40406`](https://archive.org/details/aporee_35166_40406) |
| `asakusa` | [`aporee_21091_24510`](https://archive.org/details/aporee_21091_24510) |
| a Paris market recording | (aporee) |

To re-introduce one: uncomment its line in `fetch-found-sound.sh` (fill in the
`.ogg` filename from the item's file list), add a matching `ftgen` + `instr 3`-style
voice in `royal-road.csd`, and re-render.
