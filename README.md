# Royal Road vaporwave — a worked example

A self-contained vaporwave sketch, and a small parable about not losing capabilities.

## What happened

We once rendered ten vaporwave tracks (`vaporwave1.wav … vaporwave10.wav`) at 4am
into a home directory that wasn't under version control. The renders survived; the
`.csd` that made them did not. We kept the **artifact** and lost the **generator** —
the exact failure mode this catalog exists to name: *generator output with no
reproducibility gate, `feedback_path` severed.* The artifacts were eventually deleted
because they were the only copies of nothing recoverable.

This folder is the fix. The source is committed; the audio is not.

## The rule

- **`royal-road.csd` is the capability.** It lives in git.
- **`*.wav` / `*.mp3` are derived and `.gitignore`d.** Regenerate them any time.

If `render.sh` turns the committed text back into sound, the capability is intact.
A WAV in git is a smell; a `.csd` in git is the thing itself. This mirrors how the
rest of the repo works — `verifiers.json` is source of truth, the `.db` and `.html`
are regenerated from it.

## Run it

```bash
./fetch-found-sound.sh   # download + prep the Internet Archive field recordings
./render.sh              # writes vaporwave.wav AND vaporwave.mp3
./render.sh mytake       # or a name of your choice -> mytake.wav / mytake.mp3
```

Requires `csound` (tested 6.18), `ffmpeg`, `curl`.

## Found sound (the part that makes it vaporwave)

The chords are a skeleton. The character comes from **found sound off the
Internet Archive** — radio aporee field recordings, currently the **Tokyo
Station** ambience (metro voices and announcements). It does not play dry:
`royal-road.csd` runs it through Csound's **`syncgrain`** (granular
time-stretch, pitched down a few semitones) and sends it to the hall reverb,
so the city is smeared into haze rather than sampled literally.

The arrangement uses it the vaporwave way — the band drops out and **the city
plays alone** at the intro, a mid-piece interlude, and the fade-out, with a
quiet found-sound bed under everything.

The recordings are **external, CC-licensed, and not committed** — see
[`SOURCES.md`](SOURCES.md) for items and attribution. `fetch-found-sound.sh`
makes them recoverable; that script is the committed recipe, the audio is not.

## The music

- **Harmony:** the Royal Road progression (王道進行, *ōdō shinkō*) —
  **IVΔ7 · V7 · iii7 · vi7**, i.e. **Fmaj7 · G7 · Em7 · Am7** in C major.
  It opens on IV (never home) and uses the deceptive iii→vi turn for the
  signature bittersweet float. It's the harmonic fingerprint of Japanese
  city pop, the genre vaporwave is built from.
- **Treatment:** ~70 BPM, three detuned saw pads (chorus/width), a slow
  tape-wow pitch wobble, a warm lowpass, and a big hall reverb. **The chords
  are the easy part — the genre lives in the slowed, drenched treatment.**
- **Voices:** pads (`instr 1`), a syncopated city-pop bass (`instr 2`), the
  granular found sound (`instr 3`), a wistful lead melody (`instr 4`), and a
  synthesized kit — kick (`10`), snare/rim (`11`), hats (`12`). Everything is
  summed on a master bus (`instr 100`) with a soft limiter, so stacking the
  full arrangement never hard-clips.

## The build (nothing starts at once)

It comes in layer by layer, the vaporwave way:

| beats | section | what's playing |
|---|---|---|
| 0–16 | intro | the city alone (Tokyo Station) |
| 16–48 | A | + pads |
| 48–80 | B | + bass |
| 80–112 | C | + kick pulse (drums creep in) |
| 112–144 | D | + full kit + melody — everything |
| 144–160 | interlude | band out, the city alone again |
| 160–192 | E | full reprise |
| 192–208 | outro | the city alone, fading |

The score expresses this with `PAD` / `BASS` / `DRUMKICK` / `DRUMS` / `MEL`
macros, each taking a start beat — so the arrangement reads as a stack of
labelled section calls, not hundreds of raw note rows.

The reprise (cyc E) is **not** a copy of cyc D — it uses variation macros:
`BASS2` (busier eighth-note walking bass), `MEL2` (higher, more ornamented
lead), and `DRUMS2` (ghost snares + open hats). `FILL` drops a 2-beat
snare-roll into each transition (into the full kit, and out of the
interlude). Tempo is **88 BPM** — slowed, but with a pulse.

## How you'd actually verify it (the loop)

There is no unit test for "is this vaporwave." Genre conformance is
irreducibly a matter of taste — see catalog **verifier 12.33**
(genre-conformance) and **17.43** (the no-formal-verifier marker). The real
gate is an **A/B against a reference** (Macintosh Plus — *Floral Shoppe*;
Mariya Takeuchi — *Plastic Love*): render, listen side by side, adjust the
detune / reverb / tempo, repeat. Generator → reference-similarity verifier →
feedback. A good loop.

## Catalog cross-reference

The harmonic knowledge here is also encoded as data in
[`../../gen_data/k_music.py`](../../gen_data/k_music.py) — the
`generate_symbolic_music` generator, whose `domain_notes` for `vaporwave`,
`city_pop`, and `genre_harmony` describe this exact progression and the
"production, not chords" caveat. This folder is that prose given an
**executable twin**.
