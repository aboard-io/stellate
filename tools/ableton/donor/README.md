# The donor — `Generic.als`

Paul, 2026-08-24: *"you promised to make Ableton export work if I gave you a
generic Ableton file; there's one at ~/Ableton.zip"*. This is that file,
committed unchanged: `Ableton.zip` → `Generic Project/Generic.als`.

It is committed as **source**, not as media. `main:docs/ABLETON-EXPORT.md` said
why a week before it arrived: *"An `.als` is gzipped XML, version-stamped,
undocumented but stable. We do NOT write it from a spec; we splice a DONOR set
saved from Paul's own Live 12 … which converts 'reverse engineer Ableton' into
'string-surgery on a file Ableton itself wrote.'"* The exporter emits nothing
this file does not already contain, and `tools/ableton/als-gate.js` Gate 2
enforces that mechanically.

55,010 bytes gzipped · 772,471 bytes of XML · 23,011 lines.
`<Ableton MajorVersion="5" MinorVersion="12.0_12402" SchemaChangeCount="5"
Creator="Ableton Live 12.4.3">`

*Every number below was read out of the file, not remembered.*

## What is in it

| Track | XML `Id` | Instrument / devices |
|---|---|---|
| `1-MIDI` | MidiTrack 12 | **no instrument** — AutoFilter2, **MxDeviceAudioEffect (Max for Live)**, Eq8, Roar, StereoGain, Vocoder |
| `2-Drift` | MidiTrack 18 | Drift, default patch |
| `3-Sampler` | MidiTrack 13 | MultiSampler + SimplerFilter — **zero zones** |
| `4-Operator` | MidiTrack 15 | Operator, default patch |
| `5-Meld` | MidiTrack 16 | InstrumentMeld |
| `6-Tension` | MidiTrack 17 | StringStudio |
| `A-Reverb` | ReturnTrack 2 | Reverb |
| `B-Delay` | ReturnTrack 3 | Delay |
| `Main` | MainTrack | **no devices** |
| `0-Main` | PreHearTrack | — |

`0-Main` is **not a track**: it is Live's cue/PreHear bus, which happens to be
named that. There are six MIDI tracks, `1-` through `6-`.

- **Tempo 120**, at `LiveSet/MainTrack/DeviceChain/Mixer/Tempo/Manual`. Exactly
  **one** `<Tempo>` element in the document — a clean anchor. (`<Tempo Value=…/>`
  also appears inside each `<Scene>`; that is a different, self-closing tag.)
- **8 scenes**, every one `<Name Value="" />`.
- **16 Session clip slots per MIDI track**, every one empty
  (`<ClipSlot><Value /></ClipSlot>`). 8 scenes against 16 slots is why the
  exporter refuses a song with more than 8 boxes rather than cloning a scene.
- **Arrangement empty** on every track:
  `<ClipTimeable><ArrangerAutomation><Events />`.
- **Two sends per track** (16 `TrackSendHolder`, Id 0/1 → returns A/B), all at
  `Manual 0.0003162277571` = −inf.
- `NextPointeeId` **24322**; 2,646 distinct pointee ids reaching 24,321.

## What it LACKS — and what each absence costs

| absent | count | what it blocks |
|---|---|---|
| a clip on a **track** | 0 | the one unknown P0 cannot close from here — see below |
| `<Locator>` | 0 (`<Locators><Locators /></Locators>`) | locator export. **Gate 2 refuses it, on purpose.** |
| a clip in `<ArrangerAutomation><Events>` | 0 | the arrangement clip's `CurrentStart` convention is inferred, not observed |
| `SampleRef` / `UserSample` / `MultiSamplePart` / `OriginalSimpler` | 0 | all of P2. The MultiSampler on `3-Sampler` **makes no sound**, which is why `DONOR_TRACK` never selects it. |
| `DrumGroupDevice` | 0 | a real Drum Rack. The drum track is cloned from Drift and named `DRUMS — load a Drum Rack`, because an Operator playing GM drum numbers is worse than an honest label. |
| Saturator / Glue Compressor / Limiter | 0 | the P3 master chain (`main:docs/ABLETON-EXPORT.md` maps master `drive`/`glue`/`ceiling` onto exactly those three) |

### The one clip in the file, and why it is enough for P0

`grep MidiClip` finds **one**, and it is not on a track. It is the GroovePool's
groove template, `Swing 16ths 66`:

```
GroovePool > Grooves > Groove Id=4 > Clip > Value > MidiClip Id="0" Time="0"
```

It is nonetheless a complete, ordinary `MidiClip` written by Live 12.4.3,
carrying every field a Session or Arrangement clip carries —
`CurrentStart`/`CurrentEnd`, `Loop`, `Name`, `TimeSignature`, `Envelopes`,
`GrooveSettings`, `FollowAction`, `Grid`, `ScaleInformation` — and a full note
block:

```xml
<Notes><KeyTracks><KeyTrack Id="31">
  <Notes><MidiNoteEvent Time="0" Duration="0.0625" Velocity="127"
                        OffVelocity="64" NoteId="1" /> …16 of them… </Notes>
  <MidiKey Value="36" />
</KeyTrack></KeyTracks> … </Notes>
```

**Pitch lives on the `KeyTrack` (`MidiKey`), time and velocity on the event.**
That is the whole grammar, written by the target application, and
`nukernel/export/als.js` reuses it verbatim. What is still a guess is that Live
accepts a copy of a groove clip as a track clip. **Only Live can answer that** —
Gate 4, the last line the CLI prints.

One thing the exporter changes in the copy: `<GrooveId Value="4" />` becomes
`-1`. A groove-pool clip names its own groove, and a copy on a track would put
Live's swing on top of the swing nukernel has already baked into the note
offsets — the same groove counted twice.

## Two hazards that travel with every export

Both are the donor's, not the exporter's, and `als-gate.js` Gate 3 prints them
on every run rather than filing them here where nobody would read them again:

```
/Users/ford/Music/Ableton/Factory Packs/Convolution Reverb/…/Convolution Reverb.amxd
/Users/nsh/Library/Application Support/Ableton/Live 11 Core Library/…/Dotted Eighth Note.adv
```

The first is the Max for Live device on `1-MIDI`; the second is a Simple Delay
preset saved by a different user account entirely. Both are absolute macOS
paths, so both are a missing device on any machine but the one that saved them.
P1 can drop the `1-MIDI` track outright and lose nothing.

## Ask #1 — 30 seconds, and it closes three unknowns at once

Only if P0 fails to open, or when locators are wanted:

> In Live 12.4.3, put an 8-note MIDI clip in **Session slot 1 of `2-Drift`**,
> drag a copy into the **Arrangement at bar 1**, drop **one locator** at bar 1,
> and save over `Generic.als`.

That yields ground truth for a *track* clip (versus a groove clip), for
`<ArrangerAutomation><Events>`, and for `<Locator>` — and Gate 2 turns green on
locator export the moment it lands, without anybody having to decide anything.

## Ask #2 — P2 only, do not ask yet

A Drum Rack with four pads and a Simpler with one sample, saved as a project, so
`SampleRef` / `MultiSamplePart` / `Samples/Imported/` have a real example.
Nothing before P2 needs it.
