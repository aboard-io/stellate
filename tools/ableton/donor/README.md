# The donors — `Generic.als`, `Ableton2.als`, `Answers.als` and `Answers2.als`

Paul, 2026-08-24: *"you promised to make Ableton export work if I gave you a
generic Ableton file; there's one at ~/Ableton.zip"*. Paul, 2026-08-28:
*"I added a new Ableton sample file at ~/Ableton2 Project.zip for you to work
with"*. Paul, 2026-09-03: *"I put it in ~/answers.zip and answered all your
questions."* Paul, 2026-09-03, hours later and with the Delay open on screen:
*"So the Ableton number for delay is 'delay time in 16th notes,' so it should be
2. I added a zip with all the missing effects and many more."* All four are
here, committed unchanged.

They are committed as **source**, not as media. `main:docs/ABLETON-EXPORT.md`
said why a week before the first one arrived: *"An `.als` is gzipped XML,
version-stamped, undocumented but stable. We do NOT write it from a spec; we
splice a DONOR set saved from Paul's own Live 12 … which converts 'reverse
engineer Ableton' into 'string-surgery on a file Ableton itself wrote.'"* The
exporter emits nothing these files do not already contain, and
`tools/ableton/als-gate.js` Gate 2 enforces that mechanically.

**`Generic.als` is the splice base.** ~~`Ableton2.als` is a **grammar
reference**: nothing splices from it yet, and Gate 2's conformance corpus is
still Generic alone.~~ **REVERSED 2026-08-31** — one track of it splices now.
Paul, of a working export: *"I gave you lots of instruments including a drum
rack and you're using only operator and drift."* The drums lane is spliced from
Ableton2's **`1-DS Drum Rack`**, extracted to `nukernel/export/drumrack.js`
(63,643 gzip bytes — the one subtree, not the 258 KB donor, because the module
graph carries it into the page), and Gate 2's corpus is now `Generic ∪
Ableton2`. The original sentence is kept struck through because this repo does
not delete a claim it reverses. It is still here for the samples too: P2's
ground truth is unchanged.

**The rack needed no note remapping, and that was measured rather than hoped.**
Its pads read, through `pitch = 128 - ReceivingNote`: 36 Kick, 37 FM, 38 Snare,
39 Clap, 40 Snare, 41/43/45 Tom, 42 HHC, 44 HHP, 46 HHO, 47/48 FM, 49 Cymbal,
50 Clang, 51 Cymbal. That is **General MIDI order**, which is what a factory
Live Drum Rack is, and our drum clips already write GM notes. **It is
Suite-only**: every pad is an `MxDeviceInstrument` under
`/Applications/Ableton Live 12 Suite.app/…`, ten absolute paths that travel
with every export and resolve on a Mac with Live Suite and nowhere else.

**AND A THIRD FILE SPLICES NOW TOO, 2026-09-03.** `Answers.als` is the save
Paul made to answer the two asks this file had left: the master chain (which
neither earlier donor had a single device of) and the two undecoded enums. Its
`MainTrack`'s **Saturator, GlueCompressor and Limiter** are extracted to
`nukernel/export/masterrack.js` (2,247 gzip bytes — the three subtrees, not the
102 KB donor, for the reason the drum rack gives), its `AutoFilter2` decodes
`Filter_Type`, and its `Delay` decodes the sync switches. Gate 2's corpus is
now `Generic ∪ Ableton2 ∪ Answers`. Same rule as before: a donor joins the
corpus when the exporter splices out of it, and not one round earlier.

**AND A FOURTH, THE SAME DAY.** `Answers2.als` is the file that settled the
sixteenth index — the one thing donor 3 left half open — and brought the two
devices two of the box's chips had been going without. Its `1-DS Drum Rack` is a
twenty-eight device chain; three of them travel, extracted to
`nukernel/export/fxrack2.js` (2,357 gzip bytes): **PhaserNew** for the `phaser`
chip, which had NO device at all in the first three donors, and **Amp +
Cabinet** for `crunch`, which had a Roar that could only say two of its nine
knobs. Gate 2's corpus is now `Generic ∪ Ableton2 ∪ Answers ∪ Answers2`, by the
same rule as the other three: a donor joins the moment the exporter splices out
of it.

*Every number in this file was read out of the file, not remembered.*

---

## Donor 1 — `Generic.als`

55,010 bytes gzipped · 772,471 bytes of XML · 23,011 lines.
`<Ableton MajorVersion="5" MinorVersion="12.0_12402" SchemaChangeCount="5"
Creator="Ableton Live 12.4.3">`

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
- **One clip in the whole file**, and it is not on a track: the GroovePool's
  groove template `Swing 16ths 66`, at
  `GroovePool > Grooves > Groove Id=4 > Clip > Value > MidiClip Id="0" Time="0"`.
  `nukernel/export/als.js` copies it verbatim as the clip template.

**Pitch lives on the `KeyTrack` (`MidiKey`), time and velocity on the event** —
`<Notes><KeyTracks><KeyTrack Id="31"><Notes><MidiNoteEvent Time Duration
Velocity OffVelocity NoteId/>…<MidiKey Value="36"/></KeyTrack>`. That is the
note grammar, written by the target application, and it is reused unchanged.

### Generic's two travelling hazards

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

---

## Donor 2 — `Ableton2.als`

258,378 bytes gzipped · 3,823,520 bytes of XML · 92,633 lines. Saved from
`~/Ableton2 Project.zip` (21,004,452 bytes, 46 zip entries, 3 of them
`__MACOSX`).

```
<Ableton MajorVersion="5" MinorVersion="12.0_12402" SchemaChangeCount="5"
         Creator="Ableton Live 12.4.5">
```

**The schema stamp is identical to Generic's** — same `MajorVersion`, same
`MinorVersion="12.0_12402"`, same `SchemaChangeCount="5"` — even though the
application moved 12.4.3 → 12.4.5. Two point releases did not move the format.
That is the strongest evidence yet for the splice strategy's core bet: the
`.als` schema is stable across Live patch versions.

### What is committed, and what is not

**Only `Ableton2.als` (258 KB) is in the tree.** The other 20.7 MB of the
project — 15 `.aif` cabasa samples, one 5.1 MB `.wav` drum loop, their `.asd`
analysis files, and a 5.9 MB `Convolution Reverb Pro.amxd` — is deliberately
left out. The working tree is the live web root and is rsynced to staging, so
every committed byte ships to a web server. **The export grammar we need lives
entirely inside the `.als`**: the XML names each sample by path, size and CRC,
and none of the P2 work requires the audio itself. Anyone who needs the audio
takes it from **`~/Ableton2 Project.zip`** on Paul's machine.

### What is in it

**Tempo 120.** Eight tracks. Track `Id`s are creation order, not display order.

| Track | XML `Id` | Instrument / devices |
|---|---|---|
| `1-DS Drum Rack` | MidiTrack 13 | **DrumGroupDevice**, 16 pads, each an InstrumentGroupDevice wrapping an **MxDeviceInstrument** (Drum Synth: DS Kick/FM/Clap/Snare/Tom/HHC/HHP/HHO/Cymbal/Clang) |
| `2-Cabasa` | MidiTrack 17 | **DrumGroupDevice**, 15 pads, each InstrumentGroupDevice → **MultiSampler + Eq8** — the sampled rack |
| `3-Drift` | MidiTrack 15 | Drift |
| `4-Operator` | MidiTrack 12 | Operator |
| `5-Wavetable` | MidiTrack 16 | InstrumentVector |
| `6-MIDI` | MidiTrack 18 | **no instrument** — a 12-device audio chain: Vocoder, StereoGain, Shifter, Reverb, Delay, Chorus2, AutoShift, AutoPan2, AutoFilter2, FilterDelay, FilterEQ3, Eq8 |
| `7-DrumLoop_1  Full_100` | AudioTrack 19 | no devices; **one AudioClip** in Session slot 0 |
| `A-Delay \| Convolution Reverb Pro` | ReturnTrack 2 | Delay + **MxDeviceAudioEffect** |

Plus `Main` (MainTrack, **no devices**) and `0-Main` (PreHearTrack).

- **8 scenes**, every one `<Name Value="" />` — same as Generic.
- **16 Session clip slots per track**, and **slot 0 is filled on all seven
  tracks** (six MidiClips, one AudioClip). Slots 1–15 are empty.
- **8 `TrackSendHolder`** in the document (there is one return track, `A`), all
  at `Manual 0.0003162277571` = −inf.
- `NextPointeeId` **29833**; 7,749 distinct pointee ids reaching 29,832, zero
  duplicated.
- One groove in the pool, `Swing 16ths 66`, same as Generic.

Element counts, all of which Generic had at **zero**:

| element | count |
|---|---|
| `SampleRef` | 61 (60 sampler zones + 1 audio clip) |
| `MultiSamplePart` | 60 (15 pads × 4 velocity layers) |
| `DrumGroupDevice` | 2 |
| `DrumBranch` | 31 (16 + 15) |
| `MultiSampler` | 15 |
| `MxDeviceInstrument` | 16 |
| `MidiClip` | 7 (6 on tracks + 1 in the GroovePool; Generic had only the pool one) |
| `AudioClip` | 1 |
| `Eq8` | 16 (15 inside Cabasa pads + 1 on `6-MIDI`) |
| `FileRef` / `<Path>` | 257 each, 32 distinct `Path` values — 31 real, 1 empty |

### The MIDI content is a probe, not a song

Say this out loud, because it decides what the donor is *for*:

| clip | notes |
|---|---|
| `1-DS Drum Rack` | 4 notes, all `MidiKey 36`, `Time` 0/1/2/3, `Duration 0.25`, `Velocity 100` |
| `2-Cabasa` | 4 notes, identical to the above |
| `3-Drift` | 16 notes, one per `KeyTrack`, rising 31→57, `Time` 0…3.75 in 0.25 steps |
| `4-Operator` | **empty clip, 0 notes** |
| `5-Wavetable` | **empty clip, 0 notes** |
| `6-MIDI` | 3 notes: 66 @0, 71 @1.25, 67 @2.75 |

Every clip is `CurrentStart 0`, `CurrentEnd 4` — one bar — and `<Name Value=""/>`.
This donor is for **device and sample grammar**, not for musical material.
Nothing about phrasing, form or harmony can be learned from it, and nothing
should be.

---

## Donor 3 — `Answers.als`

102,134 bytes gzipped · 1,261,468 bytes of XML · 32,964 lines.

```
<Ableton MajorVersion="5" MinorVersion="12.0_12402" SchemaChangeCount="5"
         Creator="Ableton Live 12.4.5">
```

**The stamp is identical to both others** — same `MajorVersion`, same
`MinorVersion="12.0_12402"`, same `SchemaChangeCount="5"` — across three saves
and two application versions. The splice strategy's core bet keeps holding.

It is `Ableton2` with the sampled rack and the twelve-device chain and the
audio track removed, four devices added, and every probe clip emptied:

| Track | XML `Id` | Instrument / devices | what is new |
|---|---|---|---|
| `1-DS Drum Rack` | MidiTrack 13 | **DrumGroupDevice** (16 pads), **AutoFilter2**, **Delay** | **both enum answers live here** |
| `2-Drift` | MidiTrack 15 | Drift | — |
| `3-Operator` | MidiTrack 12 | Operator | — |
| `4-Wavetable` | MidiTrack 16 | InstrumentVector | — |
| `A-Delay \| Convolution Reverb Pro` | ReturnTrack 2 | Delay + **MxDeviceAudioEffect** | the second, UNTOUCHED Delay — the control |
| `Main` | MainTrack | **Saturator, GlueCompressor, Limiter** | **the master chain, at factory values** |
| `0-Main` | PreHearTrack | — | — |

- **Tempo 120**, one `<Tempo>` element, `Manual 120` — unmoved.
- **8 scenes**, 16 Session clip slots per track, **5 `MidiClip`s**: one per MIDI
  track and the GroovePool's `Swing 16ths 66`. The four track clips are
  `CurrentStart 0`, `CurrentEnd 4` and **empty — 0 notes each**; only the pool
  clip has notes (the same 16 on MidiKey 36). This donor is for DEVICES, and
  nothing about material can be read out of it.
- **5 `TrackSendHolder`** (one return), `NextPointeeId` **24737**, 2,061
  pointee ids, none duplicated.
- **12 distinct `<Path>` values, one of them absolute**:
  `/Users/ford/Music/Ableton/Factory Packs/Convolution Reverb/…/Convolution Reverb Pro.amxd`
  — the same M4L hazard Ableton2 carries, on the same return track. **Nothing
  this exporter splices out of this file contains a `<Path>` at all**
  (measured: zero in the Saturator, the GlueCompressor and the Limiter), so the
  hazard stays where it is and does not travel.
- `<Gate Value="1" />` appears once and is **not a device**: it is the
  `ArpeggiateAlgorithm`'s own gate length in the set's MIDI-tool settings.
  Named here because an inventory by tag name reads it as one.

### What it splices — `nukernel/export/masterrack.js`

`nukernel/export/masterrack-extract.js` photographs the three MainTrack devices
— **Saturator, GlueCompressor, Limiter**, 26,155 bytes of XML, **2,247
gzipped**, sha256 `c631b16b…` — the same generator/`--check`/DO-NOT-EDIT
pattern as `donor.js`, `drumrack.js` and `fxrack.js`, and
`test/als-page.browser.js` runs all four checks now. The devices and not the
track, for the fx rack's reason: the MainTrack already exists in the splice
base, so the unit that travels is the `<Device>` subtree.

**Gate 2's corpus is now `Generic ∪ Ableton2 ∪ Answers`**, by the rule that let
each of the first two in: a donor joins the conformance corpus at the moment
the exporter splices out of it, never before. What that licenses is small and
measurable — Answers has no sampler, no `SampleRef` and no `AudioClip`, so the
shapes it adds are the three master devices' parameters and nothing else.

### The master chain, at factory values, and what the words land on

Every number below was read out of the file (`Manual`, then the device's own
`MidiControllerRange`), and every one of them is where Live put it — the ask
said *"defaults are fine — don't tweak anything"* and nothing was tweaked:

| device | knob | donor `Manual` | donor range | what nukernel writes there |
|---|---|---|---|---|
| Saturator | `BaseDrive` | 0 | −36 … 36 | `20·log10(1 + grit·2.6)` — the engine's own tanh drive in dB: hair **1.26**, warm **3.02**, dirt **5.26**, crush **8.34** |
| Saturator | `DryWet` | 1 | 0 … 1 | `min(1, grit·8)` — fx_bus's own blend: hair **0.48**, everything above it **1** |
| Saturator | `Type` | 0 | 0 … 7 | *not written* — an undecoded enum |
| GlueCompressor | `Threshold` | 0 | −40 … 0 | the word's `thr`: soft −18, glue −22, tight −26, pump −30, squash −34 |
| GlueCompressor | `Ratio` | 1 | 0 … 2 | three positions, **INFERRED** as the SSL ladder 2/4/10 ascending; the record's 1.6/2.2/3.2/6/12 lands on the nearest rung in log space |
| GlueCompressor | `Makeup` | 0 | 0 … 20 | `20·log10(makeup)`: soft 1.58, glue 2.92, tight 4.61, pump 5.58, squash 6.85 dB |
| GlueCompressor | `Attack` / `Release` | 3 / 3 | 0 … 6 | *not written* — seven positions each, no names printed: a wrong index moves the whole behaviour |
| Limiter | `Ceiling` | −0.2999997139 | −24 … 0 | the word's `thr`: open −1.5, safe −2.5, loud/louder −3 |
| Limiter | `Gain` | 0 | −24 … 24 | `20·log10(push)`: loud **+4.61**, louder **+8.30**, everything else 0 |
| Limiter | `Release` etc. | 99.99995 | … | *not written* — the record has no word for them |

The vocabulary's own numbers are `nukernel/fields.js` DRIVES / GLUES /
CEILINGS, copied into `nukernel/export/live-devices.js` (which is browser-safe
and cannot import the UMD tier) and held to the original by **`als-gate.js`
gate G**. Absent is the donor's own MainTrack: a record with no `master`, and a
word that says `none`, build no device at all — which at this end is exactly
right, because the donor's Main track is empty.

~~**And four master words still have no device anywhere**: `tape`, `space`,
`width` and `tilt`. `main:docs/ABLETON-EXPORT.md` suggests a Utility for
`width`, an EQ Eight tilt on the Main and a send-to-Return-A trim for `space`;
there is no Utility in any of the three donors, no Eq8 on any MainTrack, and no
master send. They come out on the CLI's receipt as unmapped, the same answer
the `phaser` chip gets.~~

**TWO OF THE FOUR WERE WRONG WHEN THIS WAS WRITTEN, 2026-09-03** — and the
correction took no new donor, only opening the devices instead of searching for
their names. Live's **Utility is the `<StereoGain>` tag** and all four donors
have one; the Eq8 the exporter already splices onto every track carries a low
shelf on band 0 and a high shelf on band 3. `width` and `tilt` ship. `tape` and
`space` are still homeless and still say why. The full argument, with the
ranges, is under **Donor 4 → The master words** below; this paragraph is kept
struck through because this repo does not delete a claim it reverses.


---

## Donor 4 — `Answers2.als`

133,454 bytes gzipped · 1,638,800 bytes of XML · 43,980 lines.

```
<Ableton MajorVersion="5" MinorVersion="12.0_12402" SchemaChangeCount="5"
         Creator="Ableton Live 12.4.5">
```

**The stamp is identical to all three others** — four saves, two application
versions, one schema. The splice strategy's core bet has now held four times.

It is `Answers` with the sixteenths button moved on the Delay and **twenty-four
more devices piled onto track 1**:

| Track | XML `Id` | Instrument / devices | what is new |
|---|---|---|---|
| `1-DS Drum Rack` | MidiTrack 13 | **DrumGroupDevice** (16 pads) then 27 audio devices — see the inventory below | **the whole answer** |
| `2-Drift` | MidiTrack 15 | Drift | — |
| `3-Operator` | MidiTrack 12 | Operator | — |
| `4-Wavetable` | MidiTrack 16 | InstrumentVector | — |
| `A-Delay \| Convolution Reverb Pro` | ReturnTrack 2 | Delay + **MxDeviceAudioEffect** | the second, UNTOUCHED Delay — the control |
| `Main` | MainTrack | Saturator, GlueCompressor, Limiter | unchanged from donor 3 |
| `0-Main` | PreHearTrack | — | — |

- **Tempo 120**, one `<Tempo>` element, unmoved. **8 scenes**, **5 `MidiClip`s**,
  the four track clips **empty — 0 notes each**. This donor is for DEVICES;
  nothing about material can be read out of it.
- **5 `TrackSendHolder`**, `NextPointeeId` **25615**. **0 `SampleRef`, 0
  `MultiSampler`, 0 `AudioClip`, 0 `<Locator>`, 10 `ArrangerAutomation` and
  every one of them `<Events />`.** So it answers none of steps 1, 2 or 4 of
  the ask below, exactly like donor 3.
- **18 distinct `<Path>` values, four of them absolute** and all four naming
  `/Users/ford/Music/Ableton/Factory Packs/…` — Convolution Reverb Pro, Color
  Limiter, Gated Delay, Surround Panner, i.e. **the four Max for Live devices**.
  Nothing this exporter splices out of this file names a user folder; see the
  path note under the extraction below.

### The inventory, verified by reading rather than by tag-grepping

Track 1's chain in order, with what it is:

```
DrumGroupDevice   PhaserNew*   AutoFilter2   Gate*   Erosion2*   Tube*
DrumBuss*   Compressor2*   MxDeviceAudioEffect   Cabinet*   AutoShift
AutoPan2   Delay   Amp*   Tube*   Echo*   Pedal*   Overdrive*
MultibandDynamics*   Redux2*   MxDeviceAudioEffect   MultibandDynamics*
Saturator   MxDeviceAudioEffect   Shifter   MxDeviceAudioEffect
StereoGain   Vinyl*   Vocoder
```

`*` = a tag that appears in **no earlier donor**: PhaserNew, Gate, Erosion2,
Tube ×2, DrumBuss, Compressor2, Cabinet, Amp, Echo, Pedal, Overdrive,
MultibandDynamics ×2, Redux2, Vinyl — fourteen distinct tags.

**Two corrections to an inventory-by-tag-name**, both found by opening the
elements:

- **`Gate` here IS a device** — Live's noise gate, with `Threshold`, `Attack`,
  `Hold`, `Release`, `Return`, `LookAhead` and a sidechain EQ. That is the
  opposite of donor 3, where `<Gate Value="1" />` was the arpeggiator's gate
  length and this file said so. Both readings were needed; both are recorded.
- **`Saturator`, `Shifter`, `AutoFilter2`, `AutoPan2`, `AutoShift`, `Delay`,
  `StereoGain` and `Vocoder` on this track are NOT new** — every one of them is
  already in the library out of Generic or Ableton2, and taking a second copy
  would be weight for nothing. The four `MxDeviceAudioEffect`s are Max for Live:
  a `<Path>` to an `.amxd` and no parameter this file could set.

### What it splices — `nukernel/export/fxrack2.js`

`nukernel/export/fxrack2-extract.js` photographs **three** of the fourteen —
**PhaserNew, Cabinet, Amp**, 26,850 bytes of XML, **2,357 gzipped**, sha256
`29087ec8…` — with the same generator / `--check` / DO-NOT-EDIT pattern as
`donor.js`, `drumrack.js`, `fxrack.js` and `masterrack.js`;
`test/als-page.browser.js` runs all **five** checks now. The other eleven are
refused device by device in that extractor's header, with the reason next to
each, because a device in `fxrack2.js` is bytes in every page load whether or
not a chip can reach it.

| device | what nukernel does with it |
|---|---|
| **PhaserNew** | the `phaser` chip. **It had no device at all** — "neither donor carries a Phaser" came out on every receipt from the day the chips landed. |
| **Amp** | the `crunch` chip, moved off Roar. |
| **Cabinet** | the fixed 4×12 in the same chip's DSP; spliced at Live's own patch with nothing written into it. |
| Echo | **nobody.** Paul's is the preset `Hiss Tape Mode`: noise ON at 0.797, wobble ON, a 0.39 reverb, a gate at −16.9 dB, feedback INVERTED, +6.35 dB of input gain. **No untouched Echo exists in any of the four donors**, so splicing `echo` out of this one would mean writing twenty parameters to turn a tape emulation OFF — inventing a factory patch nobody sent us. The `echo` chip stays on Delay, which says all four of its knobs and now says its time right. |
| DrumBuss | **nobody, and this one is about the box and not the file.** There is no drum-bus word anywhere in `fields.js`: the kit gets the section's chips and a mixer strip, and no drive / crunch / boom / transient vocabulary exists for a DrumBuss to say. |
| Vinyl | **nobody. Vinyl is not tape.** Its `CracleDensity`/`CracleVolume` are surface noise and its `Drive` is a fixed-curve tracing distortion; the master's `tape` word is `{wob, sat}` — wow-and-flutter and saturation — and Vinyl has neither half. |
| Overdrive / Pedal / Tube | **nobody.** Each is ONE stage of the five `insert_higain.dsp` has (a band-limited pedal with `MidFreq`/`BandWidth`; a three-knob stompbox; a valve stage with `PreDrive`/`PostDrive`/`Bias` and a single ±1 `Tone`). Amp is the device that has the three-band tone stack AND the presence. |
| Compressor2 / MultibandDynamics / Gate | **nobody.** No box word. The record's dynamics are the master's `glue` (already on GlueCompressor) and the desk's own faders; a compressor spliced from nothing would be a device at its default doing something the record never asked for. |
| Redux2 / Erosion2 | **nobody.** No bitcrush chip, no erosion word. |
| 4 × MxDeviceAudioEffect | **nobody.** Max for Live. |

**What travels with them, said out loud because gate 3 prints it every run:**
the PhaserNew carries **three `<Path>` elements**, all the same string —
`/Applications/Ableton Live 12 Suite.app/…/Audio Effects/Phaser-Flanger`, its
own `LastPresetRef`. That is the drum rack's hazard class, not the
`/Users/nsh/` one: a factory device **inside the application bundle**, and an
unresolved `LastPresetRef` costs a preset NAME in the title bar, never the
device. The Amp and the Cabinet carry two `<Path>` elements each and **both are
empty strings**. Gate 3 now prints a `note` line counting the Suite paths
alongside the `WARN` it already printed for the user-folder one.

### The two chips, knob by knob

Every range below is the donor's own `MidiControllerRange`; every box value is
`fields.js` `FX`, held to it by gate F; and every Faust range is
`engine/faust/dist/insert_*-meta.json`.

**`phaser` → PhaserNew.** `insert_phaser.dsp` is "a hand-rolled 4-stage
first-order allpass phaser … with feedback, LFO'd exponentially between 180 Hz
and 3.2 kHz".

| box | value | Live knob | donor range | what is written |
|---|---|---|---|---|
| `rate` | 0.35 | `Modulation_Frequency` | 0.01 … 40 Hz | 0.35 Hz, straight through — both are Hz |
| `depth` | 0.8 | `Modulation_Amount` | 0 … 1 | 0.8 |
| `mix` | 0.7 | `DryWet` | 0 … 1 | 0.7 |
| — | `seq(i, 4, ap)` | `Notches` | 1 … 42 | **2** — four first-order allpasses are two notches |
| — | `fb = 0.5` | `Feedback` | 0 … 0.99 | **0.5**, the DSP's own constant |
| — | `fmin 180`, `fmax 3200` | `CenterFrequency` | 70 … 18500 | **√(180×3200) = 759 Hz**, the geometric centre the DSP sweeps about |
| — | — | `Modulation_Sync` | switch | **false** — free-running Hz, so the 0…21 synced-rate enum stays undecoded and unused |
| — | — | `Modulation_EnvelopeEnabled` | switch | **false** — Paul's preset has the envelope follower on at amount 0; off is the honest resting state for a modulation the chip never asked for |
| — | — | `Mode` | 0 … 2 | **not written.** The donor's own byte is 0, and reading 0 as *Phaser* is an INFERENCE from the parameter order (`Mode`, `Notches`, `FlangerDelayTime`, `DoublerDelayTime` = Live's Phaser / Flanger / Doubler), the same shape of argument `Shifter/Global_ShifterMode` makes. |

**`crunch` → Amp + Cabinet.** `insert_higain.dsp` opens by saying what it is:
*"insert_distort is one waveshaper; this is the amp."* Five stages — a
tightness gate, a staged drive, a **three-band tone stack**, a **presence**
peak, a **fixed 4×12 cab**.

| box | value | Live knob | donor range | what is written |
|---|---|---|---|---|
| `drive` | 0.35 | `Gain` | 0 … 10 | 3.5 |
| `low` | 0.55 | `Bass` | 0 … 10 | 5.5 |
| `mid` | 0.4 | `Middle` | 0 … 10 | 4 |
| `high` | 0.5 | `Treble` | 0 … 10 | 5 |
| `presence` | 0.5 | `Presence` | 0 … 10 | 5 |
| `level` | 0.6 | `Volume` | 0 … 10 | 6 |
| `mix` | 0.55 | `DryWet` | 0 … 1 | 0.55 |
| — | step 4 of the DSP | a `Cabinet` behind it | — | nothing — a FIXED cab has no knob to translate |
| `gate` | 0.2 | — | — | **no Amp control.** At 0.2 the DSP's expander threshold is −60 dB, transparent for any real signal, so what is lost is nothing the record can hear. |
| `stages` | 1 | — | — | **no Amp control.** `stages` crossfades three loudness-normalised taps of ONE cascade — not Roar's three independent stages and not Live's `AmpType`. The chip always sends 1, the tap the DSP itself calls "crunch", so no morph is being asked for. |
| — | — | `AmpType` | 0 … 6 | **not written** — an enum with no names printed; the donor's own byte stands. |

**Why this is a bug fix and not a preference.** Roar took `drive` and `mix` and
nothing else: `low`, `mid`, `high`, `presence` and `level` — **five of the
chip's nine knobs — were declared, costed, documented and reaching no sound**,
which is this codebase's characteristic defect written down in
`declared-but-never-arriving`. And `stages` was going to `Stage2_On`/`Stage3_On`,
which is not what `stages` means. Amp says six of the nine on one scale.

### ANSWERED, 2026-09-03 — the sixteenth index, and it was a table all along

> Paul: *"So the Ableton number for delay is 'delay time in 16th notes,' so it
> should be 2."*

He set the button to **2** and saved. The file reads:

```
answers2.xml:22520   DelayLine_SyncedSixteenthL   <Manual Value="1" />   (range 0…7)
answers2.xml:22531   DelayLine_SyncedSixteenthR   <Manual Value="3" />
answers2.xml:22392   DelayLine_Link               <Manual Value="true" />
```

**Live's Delay has eight sixteenth buttons and they are not 1…8**: they are
**1, 2, 3, 4, 5, 6, 8, 16**, and `DelayLine_SyncedSixteenth` is the **POSITION
IN THAT LIST**. That is why its range is 0…7 while the times it can spell run
to sixteen. Paul's "2" is position **1**. ✓

**On the right side, which the screenshot and the file appear to disagree
about and do not.** The screenshot shows `2` lit on **both** halves; the file's
`SyncedSixteenthR` is **3**, the factory value it also carries in Ableton2 and
in Answers. `DelayLine_Link` is `true` on that device, and a linked Delay
**draws the left value on both halves while leaving the right parameter where
it was**. So the screen says 2 and 2, the file says 1 and 3, and both are
correct. (This exporter writes the same index into both sides and turns Link
on, so nothing downstream depends on which one Live reads.)

**Every witness in the four donors, and they all agree:**

| donor | device | index | button | how we know |
|---|---|---|---|---|
| `Answers2` | `1-DS Drum Rack`, Delay #1 | **1** | **2** | **Paul set it and said so** |
| `Answers2` | return A, Delay #2 | 2 | 3 | untouched — the control beside the one he moved |
| `Answers` | `1-DS Drum Rack`, Delay | **6** | **8** | **Paul clicked it** |
| `Ableton2` | `6-MIDI`, Delay | 2 | 3 | untouched, and its own free `DelayLine_TimeL` of **0.3749999404 s at 120 bpm = 3 sixteenths** |
| `Generic` | return B, Delay | 2 | 3 | untouched |

**`Answers`' index 6 is the one that settles it, and it was never a
discrepancy.** The struck-through section above called it *"a synced 1/8 that
came back at 6"* and filed it as an unresolved conflict between two readings.
What actually happened is that Paul clicked the **button labelled 8** —
position 6 — and the shipped arithmetic (`index = sixteenths − 1`) misread it
as 7/16. There was never a conflict; there was a wrong table. The two readings
agree on the first six buttons and part company only at the last two, which is
exactly why three donors could not tell them apart:

```
sixteenths     1  2  3  4  5  6   8   16
POSITION       0  1  2  3  4  5   6    7      <- the table, shipped
sixteenths-1   0  1  2  3  4  5   7   15      <- 15 is off the end of 0…7
```

**A third corroboration, needing no click at all.** `Answers2` also carries an
**Echo** — Live's modern delay — and its equivalent parameter prints its own
range:

```
answers2.xml   Echo/Delay_SyncedSixteenthL   <Manual Value="3" />
                 <MidiControllerRange><Min Value="1" /><Max Value="16" /></…>
```

**1…16.** The modern device stores the sixteenth **count** and needs sixteen
values to do it. The old Delay has **eight**. Eight values cannot be a count
that runs to sixteen, so the old one is a **position** — the file says so
without anybody having to look at a screen.

**What changed in the output: nothing, for every record that exists.** The
box's echo chip is `timeBars: 0.1875`, and 0.1875 bars × 16 = 3 sixteenths =
the button "3" at position 2 under **both** readings, which is the byte the
donor's own device already carries. The table only ever differs if somebody
asks for eight or sixteen sixteenths — and the arithmetic would have written 7
for the first (a half-bar delay arriving a whole bar long) and nothing at all
for the second. `als-gate.js` **gate S** now asserts the table against all five
donor Delays, both of Paul's switches, the 0.375 s arithmetic witness, the
Echo's 1…16 range and the refusals (7, 9…15 and 17 sixteenths have no button
and must go down the seconds path). **The `CONFIRM IN LIVE` clause that used to
end gate S is gone**, and the one-click ask that pointed at it is retired.

### The master words: two of the four found a home, and no donor was needed

`main:docs/ABLETON-EXPORT.md` named a **Utility** for `width` and an **EQ
Eight** tilt on the Main. Donor 3's section above answered *"there is no Utility
in any of the three donors, no Eq8 on any MainTrack"*. **Both halves of that
were wrong, and reading a parameter list rather than a tag name is what showed
it.**

- **`width` → Utility, which is the `<StereoGain>` tag.** "There is no Utility"
  was a search for a word that is not in the schema. All four donors carry one,
  and `Generic`'s has been in the splice library since August. Its
  `StereoWidth` prints **0 … 4 with the identity at 1**; `fields.js` `WIDTHS`
  are `{none: 1, mono: 0, narrow: 0.5, wide: 1.5, huge: 2.2}` — the **same
  unit** (a side-channel gain), the same identity point, every value inside the
  printed range. `fx_bus` calls its own stage `mswidth`, *"a mid/side trim …
  side ×0 is mono, ×2.2 is as wide as a two-voice box can be pushed"*. One
  parameter, no curve, no enum. The device's `Gain` stays exactly as refused
  before: unity in the donor, written by nothing, because the seat dB is
  already on Live's own mixer `Volume`.
- **`tilt` → EQ Eight.** *"No Eq8 on any MainTrack"* is true and is not the
  test: the law is that the exporter emits nothing a donor has not **written**,
  and `Generic`'s `1-MIDI` Eq8 is the same device `als.js` has spliced onto
  every authored track since 2026-08-31. Read off the file, its **band 0 is a
  LOW SHELF and its band 3 is a HIGH SHELF** (`Mode` 2 and 5, against `Mode` 3
  — bell — on the five bands between them). `fields.js` describes tilt as *"A
  SHELF PAIR … the low shelf takes −t and the high shelf +t, so one number rocks
  the spectrum about its middle"* and then ships a cheaper first-order split at
  1 kHz that *"rocks the same spectrum about the same middle"*. So the shelf
  pair is the word's own canonical description: **both shelves to 1000 Hz, band
  0 to −t dB, band 3 to +t dB, both `ParameterA` and `ParameterB`, and `Mode`
  never written** — the same refusal `setEqBands` has always made.

The Main chain is therefore `Saturator → Glue Compressor → Utility → EQ Eight →
Limiter`, which is `fields.js` `MASTER`'s own order with the two homeless words
left out.

**And two words still have no device, reported and never faked:**

| word | why | what would close it |
|---|---|---|
| `tape` | `{wob, sat}` — wow-and-flutter **and** saturation. Nothing in four donors modulates playback speed on a whole mix. Donor 4's **Vinyl** is the one that looks like an answer and is not (crackle + tracing distortion). The **Echo**'s `Wobble_Amount` wobbles the DELAY LINE, not the dry signal. Splicing a second Saturator for the `sat` half alone would ship `wow` sounding exactly like `warm` — half a word is a lie by omission. | a donor with a device that modulates playback speed on the Main |
| `space` | `{mix, size}` — a room the whole mix bleeds into. `Generic`'s Reverb is already spoken for (the desk's per-unit `rev` sends land on it) and a second one on the Main would be the same room said twice at two levels. And it is not that room: `fields.js` is explicit that the box's is *"live.js's vapor wash (pre-delay + three damped combs), NOT a convolver"*, and its `size` scales comb times, so 0.55/0.8/1.2/1.8 → a Live Reverb's `DecayTime` would be an invented curve. | a **master send**. No donor has one — `TrackSendHolder` exists on tracks, never on the MainTrack — so the honest shape (Main → Return A at `SPACES.mix`) cannot be written out of anything Live has given us. |

---

## What Donor 2 settles

### CLOSED — the P0 unknown: is a groove-pool clip shaped like a track clip?

`nukernel/export/als.js` copies the GroovePool's `MidiClip` and puts it on a
track, and until now nobody could say whether Live would accept that, because
Generic had no track clip to compare against. **Ableton2 has six.** Diffed
against the GroovePool clip in the same file:

- both open as `<MidiClip Id="0" Time="0">` — same attributes, same values;
- both have **exactly 42 direct children**;
- the children are the **same tags in the same order**, all 42:
  `LomId LomIdView CurrentStart CurrentEnd Loop Name Annotation Color LaunchMode
  LaunchQuantisation TimeSignature Envelopes ScrollerTimePreserver TimeSelection
  Legato Ram GrooveSettings Disabled VelocityAmount FollowAction Grid FreezeStart
  FreezeEnd IsWarped TakeId IsInKey ScaleInformation AutomationEnvelopesListWrapper
  Notes BankSelectCoarse BankSelectFine ProgramChange NoteEditorFoldInZoom
  NoteEditorFoldInScroll NoteEditorFoldOutZoom NoteEditorFoldOutScroll
  NoteEditorFoldScaleZoom NoteEditorFoldScaleScroll NoteSpellingPreference
  AccidentalSpellingPreference PreferFlatRootNote ExpressionGrid`;
- **nothing is on one and not the other**, in either direction. All seven clips
  in the file — six Session, one GroovePool — are byte-shape identical.

A groove-pool clip **is** an ordinary Session clip in this schema. There is no
structural difference to get wrong. Gate 4 still has to prove the whole set
opens, but this particular unknown is closed from ground truth.

### REVERSED, 2026-08-28 — which clip carries the `GrooveId`

The previous version of this README said, and `als.js` still said in a comment:
*"A groove-pool clip names its own groove"* — `<GrooveId Value="4" />` becoming
`-1` in the copy. **That premise is false, measured both ways:**

- in **Generic.als**, the only `GrooveId` value in the whole document is `-1`,
  and it is on the groove-pool clip. The exporter's rewrite was replacing `-1`
  with `-1`.
- in **Ableton2.als**, it is the other way round: the groove-pool clip carries
  `GrooveId -1`, and all six **track** clips carry `GrooveId 4`, pointing at the
  pool's `Swing 16ths 66`.

So a groove pool entry does **not** name itself; a *track* clip names the pool
groove it has been assigned. The old sentence is kept above as history because
this repo does not delete a claim it reverses.

**The exporter's behaviour was right for the wrong reason, and stays.** Forcing
`-1` on every exported clip is now *more* clearly correct, not less: Ableton2
proves a track clip is exactly where a live `GrooveId` lands, so an export that
left one in would put Live's swing on top of the swing nukernel already baked
into the note offsets — the same groove counted twice.

### CLOSED — Ask #2 in full: the sample grammar

See the next section. `SampleRef` / `MultiSamplePart` / `Samples/Imported/` now
have a real example, which is exactly what the old Ask #2 asked for.

---

## The sample grammar, for P2

Read out of `Ableton2.als`. This is documentation; **P2 is not implemented** and
implementing it is Paul's call.

### How it nests

The full ancestor chain from track to sample, verbatim:

```
MidiTrack
 └ DeviceChain
    └ DeviceChain
       └ Devices
          └ DrumGroupDevice                 ← the Drum Rack
             └ Branches
                └ DrumBranch                ← one pad
                   ├ Name/EffectiveName     ← the pad's label
                   ├ DeviceChain
                   │  └ MidiToAudioDeviceChain
                   │     └ Devices
                   │        └ InstrumentGroupDevice     ← nested Instrument Rack
                   │           └ Branches
                   │              └ InstrumentBranch
                   │                 └ DeviceChain
                   │                    └ MidiToAudioDeviceChain
                   │                       └ Devices
                   │                          ├ MultiSampler          ← the Sampler
                   │                          │  └ Player
                   │                          │     └ MultiSampleMap
                   │                          │        └ SampleParts
                   │                          │           └ MultiSamplePart  ← one zone
                   │                          │              └ SampleRef
                   │                          │                 └ FileRef    ← the identity
                   │                          └ Eq8
                   └ BranchInfo              ← which note plays this pad
```

Every one of the 31 `DrumBranch`es in this file has that nested
`InstrumentGroupDevice` layer. That is what the factory presets happen to
contain; a hand-built pad can hold a `MultiSampler` directly. Do not treat the
extra rack as required — treat it as *what this donor shows*, and splice the
whole branch rather than rebuilding the middle of it.

### Which note plays which pad

`DrumBranch > BranchInfo` is three fields and nothing else:

```xml
<BranchInfo>
  <ReceivingNote Value="92" />
  <SendingNote Value="60" />
  <ChokeGroup Value="0" />
</BranchInfo>
```

- **`ReceivingNote` runs backwards.** As pitch goes up, `ReceivingNote` goes
  *down*. The `1-DS Drum Rack` uses the contiguous set 77–92 (16 pads); `2-Cabasa`
  uses 78–92 (15 pads). Both racks start at the same value, 92.
- **The mapping is `pitch = 128 − ReceivingNote`.** That constant is inferred,
  not printed in the file, and it rests on two independent corroborations, both
  measured here: (a) it puts the 16-pad rack on exactly 36–51 = C1–D♯2, which is
  the canonical Live Drum Rack span; (b) both probe clips play pitch **36**, and
  under this constant 36 lands on `ReceivingNote 92` = the **first** pad of each
  rack — `DS Kick` and `Cabasa 1 Long`, precisely what a person testing a drum
  rack would play. Under `127 − ReceivingNote` the probe would land on `DS FM`
  and `Cabasa 1 Short` instead, and the rack would span B0–D2. **This is the one
  number in this document that is not read straight off the file** — anyone
  building P2 should confirm it in Live before trusting it.
- **`SendingNote` is 60 on all 31 branches.** A pad transposes whatever hits it
  to C3 before handing it to its chain. That is why every `MultiSamplePart`
  below has `RootKey 60` and `KeyRange 0–127`: the sampler never sees the drum
  pitch. **Do not transpose a drum sample by writing a different note.**
- `ChokeGroup` is 0 on the DS rack except the three hi-hats (`DS HHC`, `DS HHP`,
  `DS HHO`), which share group 1. On Cabasa it is 1–5, one group per cabasa
  variation, so Long/Short/FX of the same cabasa cut each other off.

### What a zone carries

One `MultiSamplePart`, trimmed to the fields that carry meaning (the full
element is 5,665 characters, most of it slicing and warp defaults):

```xml
<MultiSamplePart Id="0" …>
  <Name Value="Shake-Cabasa 1 Long" />
  <KeyRange>      <Min 0/>   <Max 127/> <CrossfadeMin 0/>  <CrossfadeMax 127/> </KeyRange>
  <VelocityRange> <Min 1/>   <Max 32/>  <CrossfadeMin 1/>  <CrossfadeMax 32/>  </VelocityRange>
  <SelectorRange> <Min 0/>   <Max 127/> …                                      </SelectorRange>
  <RootKey Value="60" /> <Detune Value="0" /> <TuneScale Value="100" />
  <Panorama Value="0" /> <Volume Value="0.7079457641" />
  <SampleStart Value="0" /> <SampleEnd Value="18046" />
  <SustainLoop> <Start 0/> <End 49/>    <Mode 0/> </SustainLoop>
  <ReleaseLoop> <Start 0/> <End 18046/> <Mode 3/> </ReleaseLoop>
  <SampleRef> … </SampleRef>
  <SampleWarpProperties> … <IsWarped Value="false" /> … </SampleWarpProperties>
</MultiSamplePart>
```

**Velocity layering is how these pads are built.** Each of the 15 Cabasa pads
holds **four** `MultiSamplePart`s covering velocity `1–32`, `33–64`, `65–95`,
`96–127` — and all four point at the **same** `.aif`. That is 15 × 4 = 60
`MultiSamplePart` and 60 `SampleRef` over only **16 distinct audio files** (15
cabasa `.aif` + 1 drum-loop `.wav`). A `SampleRef` is not a file; it is a
*reference*, and files are shared freely.

### The sample's identity

`SampleRef` is the same shape whether it is a sampler zone or an audio clip:

```xml
<SampleRef>
  <FileRef>
    <RelativePathType Value="3" />
    <RelativePath Value="Samples/Imported/Shake-Cabasa 1 Long.aif" />
    <Path Value="/Users/ford/Desktop/Ableton2 Project/Samples/Imported/Shake-Cabasa 1 Long.aif" />
    <Type Value="2" />
    <LivePackName Value="" />
    <LivePackId Value="" />
    <OriginalFileSize Value="476618" />
    <OriginalCrc Value="8844" />
    <SourceHint Value="" />
  </FileRef>
  <LastModDate Value="1787956435" />
  <SourceContext />
  <SampleUsageHint Value="0" />
  <DefaultDuration Value="79293" />
  <DefaultSampleRate Value="48000" />
  <SamplesToAutoWarp Value="0" />
</SampleRef>
```

`OriginalFileSize` and `OriginalCrc` are checked against `Samples/Imported/…`
on disk — 476,618 bytes is the real size of that `.aif` in the zip. They are how
Live decides a file it found is the file it wanted. **An exporter that writes a
sample must write these two honestly** or Live shows "Media files are missing"
even with the file sitting right there.

`DefaultDuration` is in **sample frames**, not beats: 79,293 frames at
`DefaultSampleRate` 48,000 = 1.65 s. The drum loop is 846,720 frames at 44,100 =
19.2 s.

### `Path` versus `RelativePath` — the portability rule

Every `FileRef` carries **both**, always, all 257 of them. `RelativePathType`
says which one Live trusts, and the five values in this file are:

| `RelativePathType` | count | `RelativePath` is relative to | example `Path` |
|---|---|---|---|
| `0` | 96 | nothing — both fields empty | `""` (a default-preset ref, no file) |
| `3` | 62 | **the project folder** | `/Users/ford/Desktop/Ableton2 Project/Samples/Imported/…` |
| `1` | 77 | an unresolved `../..` walk | `/../../../Users/ama/Desktop`, `/Volumes/data/tmp/trunk/Latin Percussion/…` |
| `7` | 16 | the **Live application bundle** | `/Applications/Ableton Live 12 Suite.app/…/Drum Synth/DS Kick/…/DS Kick.amxd` |
| `5` | 6 | a **Live Pack / library root** | `/Applications/…/Core Library/Racks/Drum Racks/Electronic/DS Drum Rack.adg`, `/Users/ford/Music/Ableton/Factory Packs/Latin Percussion/Drums/Instrument Kits/Cabasa.adg` |

**The rule for an export that must open on a machine that is not Paul's:**

1. **Write `RelativePathType 3` and a `RelativePath` under the project folder,
   for everything we author.** Type 3 is the only one that survives being moved,
   zipped, or handed to someone else, because it is resolved against the `.als`'s
   own directory.
2. **`Path` must still be written**, because Live writes it on every ref — but it
   is a *hint*, not the lookup. Point it at where the file will be
   (`<project>/Samples/Imported/<name>`) and never at a path on the exporting
   machine. Gate 3 already fails any authored absolute path; keep it that way.
3. **`OriginalFileSize` and `OriginalCrc` must match the bytes actually shipped.**
   Nothing else identifies the file.
4. **Ship the samples inside the project folder.** An `.als` alone is not a
   deliverable once it references audio; P2's unit is a *project directory*
   (`Foo Project/Foo.als` + `Foo Project/Samples/Imported/*`), or a zip of one.
5. **Types 1, 5 and 7 are hazards, not options.** All 99 of them in this donor
   name a machine:
   - `/Users/ford/Desktop/Ableton2 Project/…` — this machine only;
   - `/../../../Users/ama/Desktop` and
     `/Volumes/data/tmp/trunk/Latin Percussion/…` — a **different user account**
     and a **pack-builder's volume**, baked into the Latin Percussion pack's own
     Sampler presets and shipped to every customer; the Cabasa rack carries them;
   - `/Applications/Ableton Live 12 Suite.app/…` — resolves on any Mac with Live
     12 **Suite**, and on nothing else. The 16 Drum Synth pads of
     `1-DS Drum Rack` are Suite-only Max devices, so that rack is not a portable
     thing to splice.

   Same class as Generic's two, and the reason Gate 3 prints donor paths on
   every run.

### The one-line summary for whoever builds P2

Splice a whole `DrumBranch` per pad; set `BranchInfo/ReceivingNote` from the
pitch; leave `SendingNote 60` and `RootKey 60` alone; write one
`MultiSamplePart` per velocity band with `KeyRange 0–127`; and make every
`FileRef` `RelativePathType 3` with an honest size and CRC.

---

---

## What P3 takes out of these two files (2026-09-03)

Paul: *"the midi shifts aren't showing up in ableton, like the envelope
settings that would tweak the sound and filters and so forth … think about
adding in more effects too i added plenty in the donor file."*

He did, and this is the accounting of which of them travel. `Ableton2`'s
`6-MIDI` is a twelve-device chain; **six of the twelve already exist in
Generic**, which is the splice base and is already carried into the page, so
taking them twice would be weight for nothing:

| device | in Generic | in Ableton2 | who splices it, and from where |
|---|---|---|---|
| `AutoFilter2` | `1-MIDI` | `6-MIDI` | **Generic** — the `wah` / `sweep` / `fenv` chips, and the composed `cutoff` motion filter |
| `Roar` | `1-MIDI` | — | ~~**Generic** — the `crunch` chip~~ **nobody, since 2026-09-03.** `crunch` is the box's `higain` insert, which is an AMP with a tone stack and a cab; Roar could say two of its nine knobs. It moved to donor 4's Amp + Cabinet — see Donor 4 → The two chips. |
| `Delay` | return B | `6-MIDI` | **Ableton2** — the `echo` chip. Generic HAS one and we take the other one on purpose: Generic's is the return-B device carrying `/Users/nsh/…/Dotted Eighth Note.adv` in its `LastPresetRef`, and splicing the echo out of it would put a stranger's home directory on every track instead of on one return. Ableton2's has **zero** `<Path>` elements. |
| `Reverb` | return A | `6-MIDI` | **Generic** — the return the desk's `rev` send lands on |
| `Eq8` | `1-MIDI` | `6-MIDI` + 15 Cabasa pads | **Generic** — als.js `CHAIR_EQ`, since 2026-08-31 |
| `Vocoder` | `1-MIDI` | `6-MIDI` | nobody — needs a modulator ROUTED IN, which `CarrierSource` is (a routing id, not a knob) |
| `StereoGain` | `1-MIDI` | `6-MIDI` | ~~nobody — the gain is already on Live's own mixer Volume~~ **the master `width` word, since 2026-09-03.** The gain half is still refused for exactly that reason; `StereoGain` is Live's **Utility** and its `StereoWidth` (0…4, identity 1) is the same side-channel gain `fx_bus` calls `mswidth`. See Donor 4 → The master words. |
| `Chorus2` | — | `6-MIDI` | **Ableton2**, via `nukernel/export/fxrack.js` — the `chorus` chip, and `flanger` as the nearest honest device |
| `AutoPan2` | — | `6-MIDI` | **Ableton2** — `tremolo` (LFO phase 0) and `leslie` (phase 180) |
| `Shifter` | — | `6-MIDI` | **Ableton2** — the `ringmod` chip |
| `FilterDelay` | — | `6-MIDI` | nobody — three bands where `echo` is one |
| `FilterEQ3` | — | `6-MIDI` | nobody — see below |
| `AutoShift` | — | `6-MIDI` | nobody — no chip shifts pitch |

`nukernel/export/fxrack-extract.js` photographs the six Generic has not got —
Shifter, Chorus2, AutoShift, AutoPan2, FilterDelay, FilterEQ3 — **plus the
clean `Delay`** into `nukernel/export/fxrack.js`: 96,502 bytes of XML,
**6,017 gzipped**, the same generator/`--check` pattern as `donor.js` and
`drumrack.js`, and test/als-page.browser.js runs all three checks now instead
of one. Measured on a twelve-track export with an `echo` chip: 13 Delay devices
in the file and the `/Users/nsh/` path still appears exactly **twice**, which is
the donor's own return B and nothing else.

**`FilterEQ3` was measured before it was refused**, because the P3 brief asked
for it by name (*"the desk's EQ/shade/gain … → Eq8 or FilterEQ3 bands"*). The
desk's per-unit EQ is `u.strip.eq`; probed through `plan.barPlan(0)` on preset
2 (*Motown 45*), **all twenty units answered `eq: null`** — that EQ only exists
once a hand has moved the board's EQ row. A FilterEQ3 spliced from it would
carry three unity gains on every track. What would change it: a record saved
off the board with EQ words on it, read from `u.strip.eq` onto
`GainLo`/`GainMid`/`GainHi` (0.0003…1.995, a linear gain).

### The parameter grammar, and the two enums that are NOT decoded

Every Live parameter prints its own range:

```xml
<Filter_Frequency>
  <Manual Value="19999.9961" />
  <MidiControllerRange><Min Value="19.9999981" /><Max Value="19999.9961" /></MidiControllerRange>
  <AutomationTarget Id="22194"><LockEnvelope Value="0" /></AutomationTarget>
  <ModulationTarget Id="22195"><LockEnvelope Value="0" /></ModulationTarget>
</Filter_Frequency>
```

so `nukernel/export/live-devices.js` **reads** `MidiControllerRange` and clamps
to it rather than trusting a table. A SWITCH is the same element with
`<MidiCCOnOffThresholds><Min Value="64"/><Max Value="127"/></MidiCCOnOffThresholds>`
in place of the range and `true`/`false` in the Manual — measured, not assumed,
and it is why a switch can be automated.

Units differ per device and the file says so, which is why there are four
instrument tables and not one:

| device | filter frequency | envelope times | resonance |
|---|---|---|---|
| `Drift` | **Hz** 20 … 20000 | **seconds** 0 … 60 | 0 … 1.01 |
| `Operator` | **Hz** 30 … 18500 | **milliseconds** 0.1 … 20000 | 0 … 1.25 |
| `InstrumentMeld` | **Hz** 20 … 20480 | **seconds** 0 … 40 | macros only |
| `StringStudio` | **normalised 0 … 1** | normalised 0 … 1 | 0 … 1 |

**Three things in the whole round are inferred**, flagged here the way
`ReceivingNote`'s constant is, and all three are for Paul to confirm in Live:

1. **StringStudio's `FilterCutoffFrequency` is 0…1 with no printed unit.** A
   log map from 60 Hz–18 kHz onto 0…1 is the obvious reading and it is still a
   reading; it is floored at 0.4 so a wrong curve is "a little darker" and not
   a muted guitar.
2. **`Shifter/Global_ShifterMode = 2` for ring modulation.** The range is 0…2
   with no names, but the parameter groups are `Pitch_*`,
   `ModBasedShifting_FShift_*`, `ModBasedShifting_RingMod_*` in that order,
   which is Live's own Pitch / Frequency / Ring Mod order in the device UI.
3. **The step encoding in an automation envelope** — two `FloatEvent`s on the
   same `Time`, the outgoing value then the incoming one. Already flagged for
   the tempo map; the same spelling now carries every section boundary.

~~And **two enums are deliberately NOT decoded**, which is why two things the
box can say do not arrive: `AutoFilter2 / Filter_Type` (0…9), so `mot: "rise"`
is reported on every run that has one rather than written as a lowpass that
would sound like the opposite gesture; and `Delay / DelayLine_SyncedSixteenth`
(0…7), so the `echo` chip goes in as free-running **seconds** at the record's
own bpm — the cost named, that changing the tempo in Live leaves the echo
behind.~~

### ANSWERED, 2026-09-03 — `Answers.als`, and what each enum now says

Paul: *"I put it in ~/answers.zip and answered all your questions."* The
paragraph above is kept struck through because this repo does not delete a
claim it reverses. Here is what came back, read out of the file:

**`AutoFilter2 / Filter_Type` — CLOSED for what the box needs.**

```
Answers.xml:18533-18543    <Filter_Type><Manual Value="1" />
                             <MidiControllerRange><Min 0 /><Max 9 /></…>
Generic.xml:1012-1022      <Filter_Type><Manual Value="0" />   (untouched)
Ableton2.xml:86364-86374   <Filter_Type><Manual Value="0" />   (untouched)
```

One device moved and one value moved with it. **0 is lowpass** — what every
untouched AutoFilter2 in every donor carries, and what this exporter has been
writing all along — and **1 is highpass**. The other eight of the 0…9 stay
undecoded and unused, because no lane in the box asks for a notch or a morph.
(Paul's device also sits at `Filter_Frequency` 9,999.998 rather than the
donor's 19,999.996; nothing reads that, since the exporter sets the frequency
itself.)

So `mot: "rise"` is **written** now: `nukernel/export/als.js` splices a SECOND
`AutoFilter2` at `Filter_Type 1` beside the lowpass motion filter, resting at
the bottom of its own printed range (19.99 Hz — inaudible for a highpass, the
mirror of the lowpass one resting wide open), with the `hpf` lane as its
envelope. Two filters because they are two gestures, and because automating
the TYPE would be a step change in a filter and would sound like a fault. This
is the one place the exported file says MORE than the engine does —
`audio/desk.js` renders `rise` to nothing, *"the parent's master stage has a
lowpass ceiling and no floor"*.

**`Delay / DelayLine_Sync*` — the switch is closed, the index is HALF closed,
and the difference is said out loud.**

```
Answers.xml:19191-19212   DelayLine_SyncL / SyncR      <Manual Value="true" />
Answers.xml:19297-19318   DelayLine_SyncedSixteenthL   6      (range 0…7)
                          DelayLine_SyncedSixteenthR   3
Ableton2.xml:84744-84765  the same pair, UNTOUCHED:    2 and 3
Generic.xml:21245-21266   the same pair, UNTOUCHED:    2 and 2
```

*The switch is ground truth and it is the half that matters.* `SyncL`/`SyncR`
are ordinary Live switches — `MidiCCOnOffThresholds` 64…127, no range — and
Paul's are `true`. "Make the echo follow Live's tempo" needs no enum at all,
only those two booleans.

*The index is not.* ~~Two readings survive the file and **they disagree**:~~
**SUPERSEDED THE SAME DAY — see Donor 4 → ANSWERED: the sixteenth index.** The
paragraphs below are kept because this repo does not delete a claim it reverses,
and because the mistake in them is instructive: BOTH readings were wrong about
the shape of the enum. The eight values are neither 1…8 sixteenths nor a free
count; they are **positions in the button list [1, 2, 3, 4, 5, 6, 8, 16]**, and
Paul's index 6 is the button labelled **8**, not "a synced 1/8 that came back
wrong". There was never a disagreement between two readings of one file — there
was one wrong table, and one more click settled it.

- **(a) the arithmetic one, which is what shipped.** The name says SIXTEENTH,
  the range is 0…7 = eight values, and one sixteenth is the smallest thing a
  delay lets you say — so the eight are 1…8 sixteenths and `index = sixteenths
  − 1`. It is corroborated INSIDE the file: Ableton2's untouched Delay sits at
  index **2** *and* at a free-running `DelayLine_TimeL` of **0.3749999404
  seconds** (its own `MidiControllerRange` 0.001…5 prints the unit), and 0.375 s
  at that donor's own 120 bpm in 4/4 is exactly **3/16 of a bar = 3
  sixteenths = index 2**. Two parameters of one untouched device agreeing is
  evidence.
- **(b) Paul's own click.** He was asked for *"a synced 1/8"* and the file came
  back with index **6**, which reading (a) calls **7/16**. Under (a) a 1/8 is
  index 1. Only the LEFT value moved (the right is still the factory 3, and
  `DelayLine_Link` is `true`, so the right is not used).

~~Nothing in the file settles which is right, so the exporter does not pretend:
it implements (a), records (b) here, and `als-gate.js` **gate S** prints the
discrepancy with a CONFIRM IN LIVE on every run.~~ **The table shipped instead,
2026-09-03, and gate S's CONFIRM IN LIVE clause is gone.**

**Shipping (a) is safe anyway, and that was measured rather than hoped.** The
box's echo chip is `timeBars: 0.1875` (fields.js `FX`), and 0.1875 bars × 16 =
**3 sixteenths = index 2 — the value the donor's Delay already carries**. So
for every record this exporter can write today, the synced path flips two
booleans and writes back the byte Live itself wrote; the arithmetic only fires
if somebody gives an echo a different time. A wrong reading of (a) cannot reach
a record that exists.

**The rule, stated once:** an echo whose time is a whole number of sixteenths
*of the record's own bar* (1…8 of them — a 3/4 record's bar is twelve) goes in
SYNCED and follows Live's tempo; anything else keeps the seconds path, at the
record's own bpm, which is the same time and needs no enum. Both numbers are
written either way — the seconds into `DelayLine_Time`, the index into
`DelayLine_SyncedSixteenth` — so the device says the same delay in whichever
mode a hand later switches it to.

### ~~The one click that would close the index~~ — DONE, 2026-09-03

> ~~In Live 12, open `Answers`, look at the **Delay on `1-DS Drum Rack`** and say
> what its time control reads — **1/8** or **7/16**. (Or set it to a dotted
> eighth, save, and send it back: index 2 confirmed from the other end.)~~

Paul did better than answer it: *"So the Ableton number for delay is 'delay time
in 16th notes,' so it should be 2. I added a zip with all the missing effects and
many more."* `Answers2.als` is that click, and the answer is the button table.
**Donor 4 → ANSWERED: the sixteenth index** has it in full.

*(The ask this section replaces — "put an Auto Filter on any track and switch
its filter to highpass; put a Delay beside it and set its left and right times
to a synced 1/8" — is otherwise ANSWERED and retired.)*

---

## What is still missing, from ALL FOUR donors

| absent | Generic | Ableton2 | Answers | Answers2 | what it blocks |
|---|---|---|---|---|---|
| `<Locator>` | 0 | 0 | 0 | **0** (`<Locators><Locators /></Locators>`) | locator export. **Gate 2 refuses it, on purpose,** and still does. |
| a clip in `<ArrangerAutomation><Events>` | 0 | 0 | 0 | **0** — 10 `ArrangerAutomation`, every one `<Events />` | the arrangement clip's `CurrentStart` convention is still inferred, not observed |
| a tempo envelope with more than its sentinel | 1 event | 1 event | 1 event | **1 event** | the double-point STEP spelling in a paced record's tempo map is still inferred (`als-gate.js` gate T says CONFIRM IN LIVE) |
| a set-wide `TimeSignature Manual` that is not 201 | 201 | 201 | 201 | **201** | that enum stays undecoded; the exporter says the meter on each clip's `RemoteableTimeSignature` instead, which is explicit in every donor |
| ~~`Saturator` / `GlueCompressor` / `Limiter`~~ | 0 | 0 | **ALL THREE** | ALL THREE | **nothing any more.** Answered 2026-09-03: the master chain ships (`nukernel/export/masterrack.js`, `als.js spliceMaster`, gate B) |
| ~~a Utility / a MainTrack EQ~~ | **1 each** | 1 each | 1 each | 1 each | **nothing any more, and no donor was needed.** `<StereoGain>` IS the Utility and the Eq8 was always there; `width` and `tilt` ship (2026-09-03) |
| a **master send** | 0 | 0 | 0 | 0 | the master word `space` — `TrackSendHolder` exists on tracks, never on the MainTrack, so a Main → Return A bleed cannot be written out of anything Live has given us |
| a device that modulates playback SPEED | 0 | 0 | 0 | 0 | the master word `tape` (`{wob, sat}`). Donor 4's Vinyl is crackle and tracing distortion; the Echo's wobble is on the delay line, not the dry |
| ~~a Phaser~~ | 0 | 0 | 0 | **PhaserNew, on `1-DS Drum Rack`** | **nothing any more.** Answered 2026-09-03: the `phaser` chip ships (`nukernel/export/fxrack2.js`) |
| ~~an amp with a tone stack~~ | 0 | 0 | 0 | **Amp + Cabinet** | **nothing any more.** `crunch` moved off Roar, which could say two of its nine knobs |
| an untouched **Echo** | 0 | 0 | 0 | **0** — the one in donor 4 is the `Hiss Tape Mode` PRESET | nothing today. The `echo` chip is honest on Delay; an untouched Echo would let it say tempo-synced feedback, filter and modulation in one device |
| `UserSample` | 0 | 0 | 0 | 0 | nothing — `SampleRef` covers what P2 needs |
| `Simpler` / `OriginalSimpler` | 0 | 0 | 0 | 0 | nothing — `MultiSampler` is the modern spelling and is now present |

Ableton2 added a Session clip on a track, which is what closed P0. **Answers
added the master chain and both enum answers, and it added nothing else**: it
is Ableton2 with tracks removed, four devices added, and every probe clip
emptied. **Answers2 added twenty-four more devices and one moved button**, and
it added nothing else either. In particular NEITHER did steps 1, 2 or 4 of the
ask below — no Arrangement clip, no locator, no tempo automation, still 4/4 —
so those three remain exactly as open as they were, and the exporter still
refuses a locator and still flags the tempo step as inferred.

## Ask — 30 seconds, and step 3 of it is DONE

*(This replaces the old Ask #1, which Ableton2 answered in part, and retires the
old Ask #2, which Ableton2 answered in full. **Step 3 is struck through:
`Answers.als` did it on 2026-09-03 and the master chain now ships.** The fifth
ask — the one-click delay question — **is also done: `Answers2.als` settled it
the same afternoon.** Steps 1, 2 and 4 are untouched by both saves and are the
whole remaining ask.)*

> In Live 12, open `Ableton2`, and:
> 1. drag the clip out of **`3-Drift`'s first Session slot into the Arrangement at bar 1**;
> 2. drop **one locator** at bar 1 (Create → Add Locator);
> 3. ~~on the **Main** track, add **Saturator**, then **Glue Compressor**, then
>    **Limiter**, defaults are fine — don't tweak anything;~~ **DONE 2026-09-03**
> 4. *(added 2026-08-30, the tempo-map round)* **automate the main Tempo**:
>    in Arrangement view, show the Main track's Song Tempo envelope and draw a
>    hard step — 120 until bar 3, then 90 — two breakpoints, nothing musical;
>    and set the set's **time signature to 3/4** while you're there;
> 5. **Save**, and send the `.als` back.
>
> Why step 4 exists: a paced record (jingju's banshi, khyal's vilambit→drut)
> now exports its tempo map into the Main tempo envelope. The envelope itself
> is ground truth — both donors carry `AutomationEnvelope → PointeeId 8 →
> FloatEvent` on the MainTrack, written by Live — but every donor lane holds
> only the single initial event at Time −63072000, so TWO things are still
> inference, flagged the way ReceivingNote's constant is: (a) a hard STEP is
> written as two FloatEvents on the same Time (the double-point spelling);
> (b) the set-wide `TimeSignature Manual` enum (201 = 4/4 is the one observed
> pair, so the exporter does NOT write it and says 3/4 on each clip's
> `RemoteableTimeSignature` instead, whose Numerator/Denominator are explicit
> in the donor). One save answers both, and `als-gate.js` gate T's "CONFIRM IN
> LIVE" clause retires with it.

Three unknowns, one save. (1) gives ground truth for
`<ArrangerAutomation><Events>` and an arrangement clip's `CurrentStart`;
(2) turns Gate 2's locator refusal green the moment it lands, without anybody
having to decide anything; (3) gives P3 the master chain it is already specified
against. Nothing needs to be musical — the existing 16-note probe is fine.

---

*Reversal log. 2026-08-28: the `GrooveId` premise above was reversed against
ground truth, and the P0 groove-clip unknown was closed. Both claims are
rewritten in place with the evidence, and neither original sentence was deleted.*
