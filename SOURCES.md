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

# Found-video sources & attribution

The background video layer (`video-layer.js`) crossfades between short clips cut
from **LaserDisc rips on the Internet Archive**. The clips are **not committed** —
`fetch-found-video.sh` is the committed recipe (it range-seeks each disc over
HTTP and re-encodes ~30s excerpts to small, silent 640px MP4s in `found/video/`).
Timestamps were hand-curated by sampling frames across each disc (2026-06).

| Internet Archive item | disc | clips | license |
|---|---|---|---|
| [`laser-vision-demonstration-1986`](https://archive.org/details/laser-vision-demonstration-1986) | LaserVision Demonstration (1986) | disc-as-sunset, bamboo forest, blue studio dinner | none stated |
| [`pioneer-laser-optics-ii-laserdisc`](https://archive.org/details/pioneer-laser-optics-ii-laserdisc) | Pioneer Laser Optics II demo (1989) | riders across a giant sun, chrome type over a skyline, Symbolics CGI | none stated |
| [`video-drug-2-phuture-laser-disc-1990`](https://archive.org/details/video-drug-2-phuture-laser-disc-1990) | Video Drug 2: Phuture (1990, JP ambient video) | kaleidoscope, red lattice, rainbow rings, green nebula | none stated |
| [`video-drug-1-deep-laser-disc-1990`](https://archive.org/details/video-drug-1-deep-laser-disc-1990) | Video Drug 1: Deep (1990) | monochrome face collage | none stated |
| [`ss098-0001`](https://archive.org/details/ss098-0001) | NASA SpaceDisc Vol. 1 (1984) | Earth from orbit, STS spacewalk | NASA footage — public domain |

The NASA material is public domain. The demo discs and Video Drug volumes carry
no explicit license; they're used here as brief, transformed, muted excerpts in
a non-commercial art context. Don't redistribute the clips as media — point
people at the recipe and the Archive items instead.
