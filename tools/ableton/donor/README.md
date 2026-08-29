# The donors — `Generic.als` and `Ableton2.als`

Paul, 2026-08-24: *"you promised to make Ableton export work if I gave you a
generic Ableton file; there's one at ~/Ableton.zip"*. Paul, 2026-08-28:
*"I added a new Ableton sample file at ~/Ableton2 Project.zip for you to work
with"*. Both are here, committed unchanged.

They are committed as **source**, not as media. `main:docs/ABLETON-EXPORT.md`
said why a week before the first one arrived: *"An `.als` is gzipped XML,
version-stamped, undocumented but stable. We do NOT write it from a spec; we
splice a DONOR set saved from Paul's own Live 12 … which converts 'reverse
engineer Ableton' into 'string-surgery on a file Ableton itself wrote.'"* The
exporter emits nothing these files do not already contain, and
`tools/ableton/als-gate.js` Gate 2 enforces that mechanically.

**`Generic.als` is the splice base.** `Ableton2.als` is a **grammar reference**:
nothing splices from it yet, and Gate 2's conformance corpus is still Generic
alone. It is here so that P2 has ground truth for samples instead of a guess.

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

## What is still missing, from BOTH donors

| absent | count in Generic | count in Ableton2 | what it blocks |
|---|---|---|---|
| `<Locator>` | 0 | **0** (`<Locators><Locators /></Locators>`) | locator export. **Gate 2 refuses it, on purpose,** and still does. |
| a clip in `<ArrangerAutomation><Events>` | 0 | **0** — 16 `ArrangerAutomation`, every one `<Events />` | the arrangement clip's `CurrentStart` convention is still inferred, not observed |
| `Saturator` / `GlueCompressor` / `Limiter` | 0 | **0**; both `MainTrack`s have **no devices at all** | the P3 master chain (`main:docs/ABLETON-EXPORT.md` maps master `drive`/`glue`/`ceiling` onto exactly those three) |
| `UserSample` | 0 | 0 | nothing — `SampleRef` covers what P2 needs |
| `Simpler` / `OriginalSimpler` | 0 | 0 | nothing — `MultiSampler` is the modern spelling and is now present |

Ableton2 added a Session clip on a track, which is what closed P0. It did **not**
add an Arrangement clip, and it did **not** add a locator. Those two are the only
things still blocking locator export.

## Ask — 30 seconds, and it is the last one before P3

*(This replaces the old Ask #1, which Ableton2 answered in part, and retires the
old Ask #2, which Ableton2 answered in full.)*

> In Live 12, open `Ableton2`, and:
> 1. drag the clip out of **`3-Drift`'s first Session slot into the Arrangement at bar 1**;
> 2. drop **one locator** at bar 1 (Create → Add Locator);
> 3. on the **Main** track, add **Saturator**, then **Glue Compressor**, then
>    **Limiter**, defaults are fine — don't tweak anything;
> 4. **Save**, and send the `.als` back.

Three unknowns, one save. (1) gives ground truth for
`<ArrangerAutomation><Events>` and an arrangement clip's `CurrentStart`;
(2) turns Gate 2's locator refusal green the moment it lands, without anybody
having to decide anything; (3) gives P3 the master chain it is already specified
against. Nothing needs to be musical — the existing 16-note probe is fine.

---

*Reversal log. 2026-08-28: the `GrooveId` premise above was reversed against
ground truth, and the P0 groove-clip unknown was closed. Both claims are
rewritten in place with the evidence, and neither original sentence was deleted.*
