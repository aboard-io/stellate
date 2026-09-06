# COACH HOUSE — a trip-hop song made in nukernel

Made 2026-09-05/06 on **https://test.stellate.app/nukernel/index.html** (HEAD `v289`;
the deployed `index.html` was last modified Sat 05 Sep 2026 20:17 GMT — staging serves a
self-unregistering `sw.js`, so there is no VERSION string to read from it).

Composed entirely through the UI under **iPhone 14 emulation, 390×844, DPR 3, touch** —
the way Paul uses it. Nothing was written into the repo by hand.

Genre row: **`triphop` — Bristol 1991**, anchored on Massive Attack's *Blue Lines*
(`nukernel/genres/triphop.json`). Parents: dub 0.35, electro 0.25, blockparty 0.2,
quietstorm 0.15.

---

## THE SONG

**84 BPM · 4/4 · G♯/A♭ natural minor · swing `light` · groove `laid back` · seed 74
· 88 bars · 14 sections · 10 players · 27 motifs · master surface (crackle) 0.55**

Form — `intro · verse · verse · build · chorus · verse · build · chorus · bridge ·
breakdown · build · chorus · chorus · outro`.

Six motifs written by hand in the step editor (the genre's own motifs are rhythm
skeletons pinned at degree 0; every pitch below is mine):

| motif | as written (scale degrees) | what makes it interesting |
|---|---|---|
| `hook` | 0(long) · **4** · 3 ‖ 2 · **♯1** · 2 · 0(long) | long tones, one accented leap of a fifth, a semitone turn B–A♯–B |
| `answer` | 7 · 6 · 4 · 3 ‖ 2 · 4 · 2 · 1 · 2 | falls from the octave and ends unresolved on 2 |
| `bassfig` | 0 · 0 · ♭7 · 5 ‖ 0 · 2 · 4 · ♭7-below | a dub walk — deliberately not the genre's root pedal |
| `skyline` | 7 · 5 · 6 ‖ 7 · 5 · 4 · 5 | the upper counter-line, every entry off the beat |
| `pad` | 0 · 2 · 4 · 3 (a half-bar each) | the chord figure, bent from the box's own `pad` |
| `tail` | (a bar of rest) ‖ ♭6 · ♭7 · ♮7 · 0 | the turnaround, a chromatic lead-back |

plus `riff`, `climb`, `sparse`, `counter`, `topline`, `verseline`, `beat` — invented by
the box and used as found — and 12 derived variants it made itself.

Cast: `vocal` (solo vox) reads the hook · `voice` (solo vox) the answer · `piano`
(**Rhodes**) the pad · `pad` (strings) the riff · `pad2` (warm pad) skyline · `drone`
(slow strings) sparse · `line 7` (**fretless bass**) the bass figure · `line 8`
(**`found:collage:vocal_stab`** sample) the tail · `bass` (acoustic bass) the pedal ·
`kit` (electronic).

The full variation plan per section, the chord charts, and the note-by-note readback are
in **`coach-house.score.txt`**.

## HOW TO OPEN IT

1. Go to **https://test.stellate.app/nukernel/index.html** (phone or desktop).
2. Tap **≡ menu** (bottom right) → **Export**.
3. In the **JSON · the record** card, press **Choose File** and pick
   **`coach-house.song.json`** from this folder.
4. A grey line appears under the cards: *"opened coach-house.song.json — 10 players,
   14 sections"*. **That is the only confirmation.**
5. Close the sheet with the **×** at the top-right of the EXPORT panel — on the phone
   you have to **scroll the sheet up** to reach it. (Pressing the Export tab again does
   not close it.)
6. Press **▶ play**.

**Caveats, both verified:**

* **The share link does not carry the song.** The URL the Export panel offers
  (`…index.html#at=Bristol&y=1991&s=74&t=band`) restores only place, year and seed. Opened
  in a clean browser it gives the *untouched* genre — 81 BPM, 24 motifs, 8 players.
  Opened in a browser that already holds a song it *merges* with it and produces a third
  song that never existed. **Send the JSON, not the link.**
* **The import does not survive a reload.** After opening the record, a plain page reload
  lands back on `Silence`. Touch any control once and it is written to
  `localStorage["nukernel.song.v1"]` and will come back. (Note: the key is
  `nukernel.song.v1` — *not* `nu.band.session`, which the memory file still names.)

## WHAT IS IN THIS FOLDER

| file | |
|---|---|
| `coach-house.song.json` | the record, straight out of **Export → Save the record**. This is the song. 48 KB. |
| `coach-house.mid` | **Export → Download .mid**. MIDI type 1, 480 ppq, 84 BPM, one track per player, 2,537 notes. |
| `coach-house.score.txt` | the form, the variation plan per section, the chord charts, the six motifs, and every player's pitches section by section — read back out of the .mid, not typed from memory. |
| `coach-house.mp3` | 4:12, 192 kbps. The app's own **Download .wav** (44 MB) converted with ffmpeg. Peak −3.6 dBFS, RMS −18.2 dBFS. |

## PROOF THAT IT SOUNDS

Playing on the phone path, the page holds a live `<audio src="blob:…">`, `paused:false`,
`volume 0.8`, `currentTime` advancing 3.8 → 11.9 → 19.9 s. No `AudioBufferSourceNode` or
`OscillatorNode` ever starts — it is an AudioWorklet rendering to a rolling WAV blob.
Tapped with a `createMediaElementSource` analyser: **41 of 41 windows non-silent, peak
0.081, mean RMS 0.040 ≈ −28 dBFS.**

## PROOF THAT THE VARIATIONS ARRIVED

Read out of `coach-house.mid`, the lead voice:

```
verse 2   (as written)     G#4 D#5 C#5 B4 A#4 B4 G#4     <- the leap, then the semitone turn
verse 6   (inverted)       D#5 G#4 A#4 B4 C#5 B4 D#5
build 4   (in wider steps) G#5 E5 A#4 F#4 D#4 A#4 D#4 B3
build 11  (the head only)  G#4 x15
breakdown 10               2 notes, −6 dB
```

and the density of the whole band per section shows the breakdown thinning and the last
chorus filling: warm pad 50 notes in the bridge → **2** in the breakdown → 41 in chorus 13;
drums 96 → **49** → 108; the sampled stab silent everywhere but the four choruses.

---

The field notes from making it — every intention, where I looked, how many taps, what got
in the way, and the three capabilities that most impressed me — are in
`scratchpad/pm-walkthrough/NOTES.md` with screenshots beside it.
