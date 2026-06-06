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
./render.sh              # writes vaporwave.wav next to the script
./render.sh out.wav      # or to a path you choose
```

Requires `csound` (tested with 6.18).

## The music

- **Harmony:** the Royal Road progression (王道進行, *ōdō shinkō*) —
  **IVΔ7 · V7 · iii7 · vi7**, i.e. **Fmaj7 · G7 · Em7 · Am7** in C major.
  It opens on IV (never home) and uses the deceptive iii→vi turn for the
  signature bittersweet float. It's the harmonic fingerprint of Japanese
  city pop, the genre vaporwave is built from.
- **Treatment:** ~70 BPM, three detuned saw pads (chorus/width), a slow
  tape-wow pitch wobble, a warm lowpass, and a big hall reverb. **The chords
  are the easy part — the genre lives in the slowed, drenched treatment.**

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
