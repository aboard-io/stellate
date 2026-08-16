# ABLETON-EXPORT — nukernel song → Live 12 project, stock devices only

The ask (Paul, 2026-08-16): export a nukernel song as an Ableton Live 12
project using stock instruments and effects. This is the spec; the exporter is
not built yet. It deliberately waits for the row-and-board round to land,
because that round's data model — per-part channels with automation + user
offsets, the three shared buses, the fields.js MASTER chain — is exactly the
structure the exporter reads. Build it after, read it from the same
registries, and there is no second opinion about the mix to maintain.

## The shape of the thing

An `.als` is gzipped XML, version-stamped, undocumented but stable. We do NOT
write it from a spec; we splice a DONOR set saved from Paul's own Live 12 —
clone its tracks, inject notes, set parameters. The donor pins the schema to
the exact Live build that will open the result, which converts "reverse
engineer Ableton" into "string-surgery on a file Ableton itself wrote."

Deliverable is a PROJECT FOLDER, zipped:

```
<Song> Project/
  <Song>.als                     ← gzipped XML, spliced from the donor
  Samples/Imported/…             ← the actual zone/one-shot WAVs the song voices
```

Entry point: `node tools/ableton/export-als.js <song.json|preset> [--out dir]`
— a Node CLI, zero deps (zlib + string XML are built in). A browser ⤓ button
can come later; the CLI is the iterating surface, and the verification loop
runs through Paul's machine anyway (only Live proves a set opens).

## The donor (the one thing Paul must do, once, ~10 min)

In Live 12, save a project named `donor` containing exactly:

1. MIDI track "SIMPLER" — Simpler (any sample loaded), then: EQ Eight,
   Saturator, Compressor (all default).
2. MIDI track "DRUMS" — Drum Rack with a few pads holding one-shot samples.
3. MIDI track "OPERATOR" — Operator, default patch.
4. MIDI track "DRIFT" — Drift, default patch.
5. Return A "REV" — Reverb (default). Return B "DEL" — Delay (default).
   Return C "ROOM" — Reverb (default).
6. On the Master: Saturator, Glue Compressor, Reverb, Utility, EQ Eight,
   Limiter (defaults, in that order).
7. One 1-bar MIDI clip with a few notes on SIMPLER, in Session slot 1, and
   the same clip in Arrangement at 1.1.1. One locator at bar 1.
8. Tempo 120, one scene named "SCENE".

Commit `tools/ableton/donor/donor.als` (it is source, ~100 KB of XML — the
media rule is about audio; the WAVs in the donor's Samples folder stay out).
Every splice pattern the exporter needs — a track, a device with parameters, a
clip with notes, a scene, a locator, a return, a sample reference — now has a
ground-truth example written by the target application itself.

## The mapping

**Boxes → Session scenes** (one scene per section, one clip per part — the
box × part grid IS session view), plus an Arrangement pass laid end to end
with a locator per section carrying the box's name/role. Both from one walk
of the same schedule the offline bounce renders.

**Notes.** The phrase vectors already resolve to concrete events. Velocity
maps direct; `acc` → velocity ceiling bump (the 303 accent); `sld` →
overlapping note lengths + Drift/Operator glide, which is how Live itself
does 303 lines. Swing/groove/nudge are BAKED into note offsets — real tick
offsets in the clip, not Live's groove pool, so what Live plays is what
nukernel played and there is no groove-pool state to get wrong.

**Instruments — Simpler wins over cleverness.** Sampled voices → Simpler (or
Sampler for multi-zone) loading OUR extracted zones, copied into
`Samples/Imported/`; drums → one Drum Rack per kit with the one-shots on
pads. That is fidelity by construction. Synth translation is a LATER,
optional tier: dx7 family → Operator (6-op→4-op, lossy, only where a preset
audit says the algorithm collapses well), tb303 → Drift with glide. Anything
not translated ships as Simpler over a one-note render of itself — never a
silent track.

**Effects — the stock mapping is nearly one-to-one:**

| nukernel | Live 12 stock |
|---|---|
| reverb bus | Return A · Reverb |
| echo bus | Return B · Delay (the merged Live 11+ device; edition-safe) |
| drum room | Return C · Reverb (short room settings) |
| master `drive` | Saturator |
| master `glue` | Glue Compressor (it is the same SSL bus comp the board is styled on) |
| master `tape` | no true stock twin: Saturator drive + slow subtle Auto-Pan, or omitted — decide by ear |
| master `space` | send-to-Return-A trim on the Master |
| master `width` | Utility (stereo width) |
| master `tilt` | EQ Eight (two shelves about the middle) |
| master `ceiling` | Limiter |
| per-part fx chips | per-track EQ Eight / Saturator / Compressor from the donor, params from fields.js values |

Absent-is-today applies here too: a song that never touched a master field
exports the donor's default device, not an invented setting.

**Mixer.** Track volume = the automated level × the user's stored offset,
exported BOTH ways: the static track volume set to the section's resolved
value, and (tier 3) real automation envelopes in the Arrangement for the
levels that move. Sends from the song's bus amounts; pan direct; M/S direct.
Edition note: assumes Standard/Suite (Glue Compressor is not in Intro). If a
device is missing on open, Live shows a placeholder and the set still loads —
acceptable failure.

## Verification

Live itself is the only true gate and it lives on Paul's machine, so the loop
is: exporter emits → structural gates pass → Paul double-clicks. The
structural gates (pure node, CI-safe, `test/unit/ableton-export.test.js`):

1. round-trip — gunzip our output, parse, re-find every injected clip/note/
   device against the song's schedule (the gate asks the song, not the XML).
2. donor conformance — every element type we emit exists in the donor with
   the same attribute shape; any Live update that changes the schema fails
   HERE, loudly, not in Live's error dialog.
3. sample audit — every `SampleRef` resolves to a file actually copied into
   the project folder; relative paths only.

## Phases

- **P0** donor committed + smallest openable set: one track, one clip, eight
  notes. Paul opens it. Everything else is incremental after this proof.
- **P1** full structure: all tracks/scenes/arrangement/locators/tempo.
- **P2** Simpler/Drum Rack + shipped samples.
- **P3** mixer, sends, returns, master chain, offsets; automation envelopes.
- **P4** optional: Operator/Drift synth translation, browser ⤓ button.

P0 is blocked on the donor file; P1+ are blocked on the row-and-board round
landing (the exporter reads its data model). Nothing else blocks.
