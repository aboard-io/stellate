# TODO — the running queue

Short, durable list of asked-for-but-not-yet-built work, plus the findings behind
the decisions already taken — the measurements are kept so nobody re-derives them
and nobody re-litigates a settled call. The queue this file carried through
Stages A–F is finished, and the history of it is in git rather than here.

**Nothing is open.** The soundfont ROTATION shipped 2026-07-29 (below); every gate
in the repository passes, the instrument palette
is widened and the last 15 real instruments are registered and wired, and the
media budget has a pinned, reproducible definition (`tools/audit/bed-budget.js`).
What follows is the record of how each was decided, kept so nobody re-derives the
measurements and nobody re-litigates a settled call.

`verify.sh` is 13/13. `node engine/genre-verifier.js matrix --no-cache` prints
`diagonal dominant: 274/274`. **Every gate in the repository passes** — the
release suite, the browser cohort, the starcruise cohort and `test/unit/`,
including `corpus-db` where the external MIDI drive is mounted.

---

## The gates: green, and why they were not

This section was a list of known-red gates. It is now the record of what they
turned out to be, kept because the pattern will recur.

**All green as of 2026-07-29.** `starcruise-barcadence` was the only one of the
nine that turned out to be a REAL defect rather than a stale gate, and it is worth
recording what it was: the descent is built to arrive at `SURFACE_POSE` at
essentially zero velocity (measured 0.0036 units on the last transit frame), and
the landed camera's establish ease then ran a first-order follow
(`k = 1 - exp(-dt/0.32)`) toward the establishing wide — 27% of the whole
pull-back on its first frame, a 5.36-unit jump. You settled gently onto the band
and were immediately yanked back to the wide shot. `runEstablish` now smoothsteps
from a latched start pose, which has zero velocity at BOTH ends, over the same
ESTAB_DUR; the boundary frame went from 6.91× the local median to 0.76×.

**Diagnosed and fixed, 2026-07-29 — the reds were the GATES, not the engine.**
All nine were the same failure mode in different clothes: a gate that spelled out
a fact the engine owns, and went red when the engine moved. None of them found a
bug. Recorded because the pattern will recur:

| gate | was asserting | now |
|---|---|---|
| `all-sampled`, `segment-parity`, `vocoder` | `found/<id>.mp3` | `test/lib/found-path.js` — the engine names fetched media `found/<id>.64.mp3`, and a `synthText` source has no file at all |
| `mutate`, `near-duplicate` | "the catalog has 249 anchors" | read the count from the kernel |
| `stem-parity` | four named states that had worker-cached units | discovers states by cached stem SHAPE (only 36 of 822 still have one) |
| `snare-law` | bucketed on post-envelope `amp` | buckets on the composed accent `amp0`, as the engine and `invariants.js` both do — all 9 "violations" were fade shapes, not repeated rhythm |
| `bg-handoff` | mobile UA reaches the ring path | `?wavOut=0` — WAV-FIRST routes every mobile UA away from the mechanism under test |
| `live-resilience` | `electro`/seed 1 runs a vocoder | discovers a state that voices a vocoder with a FETCHED carrier |
| `transit-arrival` | `S.pace = 64` | `S.durMult`, calibrated off `loopBars()` — `S.pace` is a dead field |

The lesson worth keeping: **a gate should ask the engine, not repeat it.** Every
one of these would have stayed green through the change that broke it if it had
read the value instead of restating it.

`corpus-db` needs the external MIDI drive and is skipped without it; with the
drive mounted it passes. Its melody-ID gate had rotted the same way as the rest —
it named folk seed 3 as "a 43-note wisp" that must come back UNTRUSTED, and that
state has since grown a real 128-note lead at confidence 0.891. It now states the
RELATIONSHIP with no magic note count: rank the exports by how much melody they
carry, require the thinnest to come back untrusted and anything carrying several
times its line to come back trusted.

**`simulate-path` check 5a was the one other real bug in the set**, and it took
changing the measurement to see it. The gate counted TOTAL mismatched bars across
a segment, which accumulates every later re-pick over the whole dwell — sitting in
a genre for 100 bars scored worse than sitting in an identical one for 20. On the
LONGEST UNBROKEN run instead, the picture separated: most segments 1-3 bars, but
`sequinfreight` genuinely spent 17 consecutive bars playing something its target
did not want, with an EMPTY flip queue.

The cause: `retargetWeights` rebuilt the queue only when the weight blend changed,
quantized to 5% buckets — but `K.mix` draws a fresh target every bar from the
full-precision weights, so it can re-pick a lead, a kit or a form while the
quantized blend sits still. Traced at seed 43: entering sequinfreight the target's
lead went `brass_section` → `fm` at bar 311 with `queue.length === 0`, and the
playing lead stayed put for 17 bars until the blend finally moved 5%. The
signature is now the target's OWN discrete dims — exactly what `rebuildQueue`
diffs — plus the dominant genre. Sequinfreight's longest run went 17 → 1.

What remains is the anti-flicker hold doing its job, and the gate now says so:
`HOLD_BARS` 4 locks a timbre that just walked on stage, flips apply every other
bar, and up to three identity dims (form / drum kit / lead voice) queue to walk on
one at a time — so a run of a few bars is correct. The allowance is the ARRIVAL
contract itself (8), on the principle that a revision should land in the same
window an arrival must; measured worst is 7.

`simulate-path` has been narrowed since: everything it gates passes except check
5a, post-arrival identity churn. On the old centre-anchored loop the worst
segment churned 57 bars against an allowance of 6; the citypop loop's worst is
21. Same failure, less of it — the re-tier in `targeting.js rebuildQueue` still
does not converge for some arrivals, and that is the thing to diagnose.

---

## Fixed from the field — the two reports that started this round

Kept because both were invisible to `verify.sh`, and the reason each was
invisible is the useful part.

**"All the tracks are playing but only two show notes in the ⓘ."**
(`?seed=196&path=1236.12625,1107.11381,2335.13068&m=55`) The live walk picks its
section BY INDEX (`secs[secIdx]`); the name is a label. A bar is scheduled a
runway ahead of sounding, so a glide across a genre boundary could replace
`S.playing.sections` with a differently-named form in between — and the readout,
which looked the section up BY NAME, found nothing and fell back to
`sections[0]`, the sparse opener. Reproduced exactly: at bar 61 the panel drew
pad + one found ribbon while the audio played a full outro. `barInfo` now carries
`secIdx`/`nsec` and the section object the walk actually rendered, and
`notefeed.js` resolves name → that object → index, never "take the first one".

**"crunch guitar says it is missing."**
(`?seed=91681&path=1923.12003,1177.9207,2042.7423&m=314`) Two real defects, one
of them not the reported one:

- The ring (desktop) route kicked a sampler zone's decode on the first bar that
  SOUNDED it. The transit form's metal solo is the catalogue's worst case —
  crunch_guitar is 8 zones / ~4.7 MB that nothing touches until the "solo"
  section, ~29 bars in — so it got a one-bar runway and lost it on any slow link.
  Now one not-yet-needed zone of the state's declared instruments is warmed per
  bar. The rate was measured, not guessed: warming ALL of them at bar 1 fixed the
  solo and cost the opening (anomalies 1 → 2, the station-voice decode losing the
  race); one per bar starts at bar 6, has all eight queued by ~13, and leaves the
  opening's anomaly count exactly where it was.
- `kickSamplerBuf`/`kickBuffer` marked in-flight decodes by writing `undefined`,
  which is the same value their "never asked" guard reads — so every later bar
  re-requested a file already being fetched. Measured 16 requests for 8 zones,
  i.e. a 4.7 MB instrument pulled twice while the next bars waited. Both now
  track in-flight ids in a set, as the WAV-FIRST route always did.

Neither could be caught by the release suite, which does not ride the live path
under a slow link. The audit summary (`handle.auditSummary()`) is the instrument
that found both; it deserves a gate that rides a throttled session and asserts an
anomaly ceiling.

---

## The soundfont rotation — shipped 2026-07-29

The set changes instruments every **32 bars** and keeps coming home to the analog
one: `fluidr3 → Pure Analog → SGM Pro 15 → Pure Analog → Seattle Glass Factory →
Pure Analog → Pure FM → Pure Analog`, a full tour every 256 bars with analog on
four of the eight steps. `app/audio/fonts.js` `FONT_CYCLE`.

**The blocker was that zone ids were not font-qualified.** Every font reused the
same `ins_<instr>_<n>` id pointing at a different file — measured on one citypop
state, 591 ids shared between fluidr3 and sgm and **522 of them resolving to
different audio**. The engine caches decoded PCM by that id, so two fonts could
never be in memory at once, which is why the font picker had to `stopLive()` →
rebuild → `goLive()`: a hard cut. `zoneSrcId` now qualifies the id by the file it
came from, keyed on the resolved BASE so a font that doesn't cover an instrument
keeps the default id and the same bytes are never cached twice. The default font
keeps the bare form, so every determinism gate is byte-identical.

**The gentle part needed nothing new.** Set the font, re-target, and the flip queue
walks the voices over one at a time — one flip per two bars, `HOLD_BARS` apart,
identity dims first. Measured: the analog voices land ~4 bars after the boundary,
the SGM samples ~4 bars after theirs. `sigOf()` ignores sampler units, so
sampled→sampled never reopens the stream at all; the two synth fonts do move the
topology and take the engine's designed crossfade.

**One thing was genuinely missing: `state.samplerLib` was in no flip.** It is the
map `forceSampled` resolves a voice through when the voice carries no sampler of
its own, and while every state was built under one font it never mattered. Under
the rotation it is the entire difference — the first working version changed the
font key and voiced *identical samples throughout*. It now rides with the crate in
the "sample" flip, where it belongs.

A hand-picked font from the ⚙ panel **pins** it (the rotation stops); `?sf=` and
`?fonts=off` pin it too. The cycle is a pure function of the bar, so a shared link
still reproduces the instruments as well as the notes.

`test/browser/font-rotation.test.js` gates it. Note what that gate does NOT use:
`handle.rms()` is an instantaneous meter, and the quietest bar of four identical
rides came out 0.0025, 0.1617, 0.0264 and 0.1047 — no threshold over it is
anything but a coin flip. It asserts on `handle.auditSummary()` instead, which
measures voices that were expected to sound and did not, and it asserts about the
BOUNDARIES specifically, since a live ride throws the odd present-but-silent bar
with the rotation off too.

---

## The instrument palette — measured and widened 2026-07-29

Three questions, answered by walking every genre × 10 seeds through the app's own
resolver (`K.mix`) and then through `SE.voiceUnits`, which is where
sampled-by-default actually applies. **Measure at voiceUnits, not at the state.**
`state.instruments[role].model` says "saw"/"fm"/"strings" for most voices and
reads as 30% sampled; the engine then resolves those through `forceSampled`, and
what plays is **91.8% sampler-backed**. The state-level number is not wrong, it is
a different question, and quoting it would badly understate the sampled layer.

**Coverage — we are NOT using the full library, at two removes.**

| stage | count |
|---|---|
| extracted to `found/samples/instruments/` | 134 |
| registered in `SAMPLERS` | 108 |
| reached by some state (274 × 10 seeds) | **102** |

- 26 extracted instruments were never registered: `agogo`, `applause`,
  `bird_tweet`, `bottle_chiff`, `breath_noise`, `brightness`, `calliope_lead`,
  `drawbarorgan`, `fret_noise`, `gun_shot`, `halo_pad`, `helicopter`,
  `melodic_tom`, `metal_pad`, `polysynth`, `reverse_cymbal`, `shakuhachi`,
  `soundtrack`, `sweep_pad`, `taiko_drum`, `telephone`, `tenor_sax`,
  `warm_pad`, `whistle`, `woodblock` (+ the extractor's summary json). Several
  are GM's sound-effects bank and belong nowhere; `shakuhachi`, `warm_pad`,
  `halo_pad`, `metal_pad`, `polysynth`, `soundtrack`, `taiko_drum` and
  `woodblock` are real instruments the catalogue simply never asks for.
- 6 registered samplers are never drawn: `goblin`, `ocarina`, `sea_shore`,
  `shamisen`, `synth_drum`, `timpani`.

**Variety — good on top, narrow at the bottom.** Effective instrument count
(2^entropy of the draw distribution — how many EQUALLY likely instruments the
spread is worth) over all sampled voices: **62.1**, against 102 actually used.
The top 10 instruments are 35.5% of every sampled voice, which is a healthy tail.
Per role:

| role | distinct | effective | most common |
|---|---|---|---|
| melody | 81 | **54.5** | overdrive_guitar 5%, steel_string_guitar 4% |
| solo | 54 | 42.0 | french_horns 8%, trumpet 5% |
| pad | 45 | 21.9 | strings 11%, slow_strings 9%, french_horns 9% |
| bass | **21** | **10.4** | acoustic_bass 22%, contrabass 14%, finger_bass 11% |

The lead is richly varied; **the bass is the bottleneck** — 21 instruments,
effectively ten, with one upright on nearly a quarter of all tracks. That is the
first place to widen if the catalogue is ever going to sound less same-y from the
bottom up, and it is a bigger lever than registering the 26 extras.

**Widened, 2026-07-29.** The lever is `pickSampledId`'s three lists in
`faust/voices/state-engine.js`, and it is free: that function runs in
`forceSampled`, not `buildEvents`, so the SCORE is untouched — matrix, fixtures
and segment-parity are byte-identical and only what you hear changes.

**The bass chair is no longer restricted to basses.** Nine ids cannot carry 274
genres, and all nine were literally basses, so every genre's bottom came off the
same small shelf. The list is now "what can HOLD DOWN THE BOTTOM": a tuba is the
bass of a brass band, a bari sax the bass of a ska horn line, a cello and a
bassoon are bass instruments with other names, an organ's pedals ARE its bass, a
left hand on a piano or clav is a bass part, and a distorted guitar doubling the
root is how half of metal does it. Two existing passes make this safe at any
register — csd-engine's REGISTER HOME moves the whole line by octaves to fit the
sampler's own zone roots (contour intact), and mapEvents' per-note
`INSTRUMENT_RANGE` fold is the net under that. Anything that cannot reach the
bass register at all is deliberately absent: koto was tried and cut when it
measured a mean played midi of 56.

| | before | after |
|---|---|---|
| bass distinct / effective | 21 / **10.4** | 41 / **25.4** |
| pad distinct / effective | 45 / 21.9 | 54 / 35.3 |
| library reached | 102 of 108 | **106 of 108** |
| overall effective instruments | 62.1 | **79.1** |
| top 10 share of sampled voices | 35.5% | **25.1%** |

The most common bass went from `acoustic_bass` at 22% of every sampled bass in
the catalogue to `finger_bass` at 9%. Only `ocarina` and `synth_drum` are now
unreached.

**And the genre now rides the pick key, which is where most of the real gain is.**
`pickFrom` hashed `(role, model, seed)`, so every genre sharing a bass model drew
the SAME instrument in a given session — and the anchors share models heavily. The
catalogue-wide entropy above looked healthy only because it averages over seeds,
and nobody listens across seeds: a JOURNEY is ONE seed crossing many genres, and
that is the number that has to be large. It wasn't.

| within ONE session, across all 274 genres | before | after |
|---|---|---|
| seed 1 — distinct bass / effective | 22 / **8.1** | 40 / **30.8** |
| seed 1 — most common | yamaha_grand_piano 31%, shamisen 28% | acoustic_bass 12% |
| seed 7 — distinct bass / effective | 20 / **6.0** | 39 / **29.4** |
| seed 7 — most common | picked_bass 40%, bassoon 30% | acoustic_bass 11% |

Keyed on the genre as well, crossing into a new neighbourhood can change the
instrument even where the underlying model is identical — which is what a listener
calls a new band. Still per-SONG stable (genre and instrumentSeed both hold for a
song), so the instrument-identity law is intact, and identity churn did not move. Verified: matrix 274/274, `all-sampled` / `segment-parity` /
`stem-parity` / `musicality` / `snare-law` all pass, and identity churn did not
move (the widened pools do not make the flip queue work harder).

Two naming defects surfaced with it, both in the ⓘ. General MIDI numbers its
variants — "Synth Bass 2", "Synth Strings 1" — and an index is the one part of a
program name that is not what a musician would call it; and GM programs 97-104 /
122-127 are FX and sound-effect SLOTS ("Goblins", "Seashore", "Echoes"), which
the widened shelves made reachable. Both now take the character-phrase path the
naming layer already had answers for.

**And the missing 15 are registered and wired.** Of the 26 extracted-but-unregistered
presets, 15 are INSTRUMENTS and are now in `SAMPLERS` with their extractor zone
metadata, and named in the pools that should have had them: the pad shelf gains
GM's actual pad bank (`warm_pad`, `halo_pad`, `metal_pad`, `polysynth`,
`soundtrack`, `brightness`), the bass chair gains two more tuned drums
(`taiko_drum`, `melodic_tom`) beside the timpani, and the lead families gain
`shakuhachi`, `whistle`, `bottle_chiff`, `calliope_lead`, `drawbarorgan`,
`woodblock` and `agogo`. The remaining 11 are GM's SOUND-EFFECTS bank —
applause, gun shot, helicopter, telephone, bird tweet, fret/breath noise,
reverse cymbal — which are not instruments and stay unregistered on purpose,
plus a GM `tenor_sax` the FreePats one already beats.

| | at the start of the day | now |
|---|---|---|
| registered in `SAMPLERS` | 108 | **123** |
| reached by some state | 102 | **122** (only `synth_drum`, an unpitched GM drum patch, is unused) |
| overall effective instruments | 62.1 | **95.0** |
| bass distinct / effective | 21 / 10.4 | **43 / 35.9** |
| pad distinct / effective | 45 / 21.9 | **60 / 43.6** |
| melody distinct / effective | 81 / 54.5 | **98 / 69.6** |

Checked: 825,424 pitched sampler notes across the catalogue, every one resolving
to a real zone; every registered zone file present on disk; matrix 274/274. The
state drift is purely additive — zero removals, `samplerLib` gains exactly the 15,
and the rest of every resolved state is byte-identical.

**Nothing is left open here.**

---

## The media budget — settled 2026-07-29

The found-layer widening roughly doubled how much audio a session pulls:
**distinct remote beds decoded per track went 1.34 → 2.75** (max 5 → 7). That was
a deliberate trade for reach — BBC beds now touch 35.3% of tracks instead of
17.1%, and 21 of 36 beds are reachable instead of 12 — but it was not paid for.

Both levers meant to pay for it were measured and **declined**. The numbers are
kept so nobody re-derives them:

- **Loop-region capping** saves 10.51% at a 1.0 s cap (10.44 MB across 103
  zones), not the 11.6% once estimated. It is not free: a blind cut moves the
  median loop seam from 0.031 to 1.079 — a step the size of the signal, once per
  second, forever. Period-aligned cutting still leaves 92 of 102 zones worse. The
  genuinely free subset is 10 zones / 2.75% / ~0.21 MB, which does not pay for a
  second metadata path plus a media re-cut plus a deploy rename.
- **Re-encoding the beds** hit its own stop condition twice: 154 of 192 have no
  local original, and the lever was already pulled — they are 64 kbps today, not
  the 92 kbps once assumed.

What landed instead is on the demand side: the route precache no longer warms the
whole journey, only the next stretch of play ahead of the traveler, the horizon
moving as you travel. On a long path that is the larger saving, and it bounds the
bed cost by what is actually listened to.

**Decided.** The bed count stays where it is — the reach it buys is the point, and
both levers that would pay for it cost more than they save. The horizon is the
lever that was actually cheap, so it is **halved: `HORIZON_MIN` 10 → 5**
(`app/audio/precache.js`). Everything downstream is derived from it — the distance
comes from `paceSpeed()` and the sounding bar's duration — so the per-run fences,
the moving horizon and the resume behaviour are unchanged; a session simply pays
for five minutes ahead instead of ten.

**The definition is pinned: `tools/audit/bed-budget.js`.** The 2.75 above was not
reproducible from the tree — counting section-level bed `sourceId`s gave 3.44,
counting every fetched found source gave 5.56, and neither matched. A budget
number nobody can re-derive becomes a false regression the first time someone
measures it differently, so that tool IS the definition now, and it reports all
three counts side by side instead of picking one:

```
bed budget — 1370 states (274 genres x seeds 1,3,5,7,9)
  BEDS        3.44 per track (max 6), 1.31 MB   BBC reach 38.5%
  FOUND       3.98 per track, 1.51 MB   (beds + breaks + chops + hits + vox)
  INSTRUMENT  23 zones per track, 3.21 MB   (what the song can VOICE)
  a track's fetched media: 4.72 MB
```

The INSTRUMENT line matters most and was never counted before. A state's
`foundSources` carries the WHOLE candidate sampler library — measured 629 zone
rows, ~105 MB — because the sampled-by-default pass injects it so any pick is
playable. What a song can actually voice is `buildSchedule`'s units: 23 zones,
3.21 MB. Counting the injected list would overstate a track's cost 33×, and
**something already was**: the warm-ahead trickle added this round walked
`foundSources` directly, so on a long ride it would have slowly fetched the entire
instrument library. It is now scoped to the schedule, and warms from the
whole-form state rather than the collapsed per-bar one so a late-arriving
instrument still gets its runway (the transit metal solo: first requested bar 10,
needed at bar 29).

---

## Settled — recorded so it is not re-litigated

- **`genre-verifier.js` cannot be lazy-loaded off the boot path.**
  `app/core/state.js` binds `export const V = GenreVerifier` at module top level
  and `rescore()` runs at boot and every four bars. Structural, not an oversight.
- **`dx7-presets.json` needs no code change.** The cold load makes 3 requests, not
  4, and two were already bodiless 304s — the prize was two round trips, not
  ~224 KB. One nginx directive took it to 1 request. The remaining prize for
  threading it through the workers is 2 × 8.4 ms of `JSON.parse`, not worth a hand
  in the live audio init path.
- **The top-level HTML URLs stay where they are.** `oembed.json` hardcodes
  `stellate.app/embed.html` inside iframe HTML already published and cached by
  third parties; `.well-known/security.txt` publishes `colophon.html` as its RFC
  9116 Acknowledgments URI; `404.html` is wired to an nginx `error_page`;
  `manifest.webmanifest` shortcuts are baked into installed launchers; and
  `feed-archive.xml` holds hundreds of published `colophon.html` links.
- **`SOURCES.md`'s tier-3 rows for the removed video layer are retained
  deliberately.** The layer is gone; the ledger is the record that obligations are
  held on the material. Do not delete them.
- **The pure-node starcruise probes needed a package-type MARKER, not a
  package-type decision.** `test/unit/{traits,flight,planet}.test.mjs` could not
  run because node resolves module type from the NEAREST `package.json` and the
  only one above them said `type: commonjs`. Three four-line marker files —
  `app/`, `vendor/simplex-noise/`, `vendor/three/`, matching the one
  `vendor/espeak-ng/` already had — scope ESM to the directories that are ESM,
  with no renames, no importer edits and no root-package conversion. All three
  probes pass. (Two of them then failed on their own harnesses, not on the code
  under test: `flight` parked for 4.0s against 3.0s of choreography plus a spring
  lag, and its fake world handed the machine a filler weight larger than the genre
  it was aiming at, so "approaching" read as receding. Both fixed in the test.)
- **The hits layer's zero-hit tracks are ACCEPTED.** Re-measured at 5.6% (106 of
  1,905 hits-carrying track states over 274 genres × 10 seeds; it concentrates in
  the sparse genres — `bogironwallow` 5 seeds of 10, `lofi` 4, `downtempo` 4).
  `HIT_SLOT_SKIP` stays at 0.75 and no per-section floor is added: the variation
  reads fine, and a floor would push the mean one-shot count back up, which is
  the thing the thinner exists to hold down.
- **Every ident genre now has a NameBank bank — 45 written, 65 of 65 covered.**
  A bankless genre fell back to GENERIC (*Cassette*, *Analog*, *Half Light*),
  which is too thin to be a station, so `derivedSpeaker` restricted those genres
  to the two LABEL-led ident frames. All 62 ident-speaking genres now reach the
  ARTIST-led frames as well: 372 ident utterances across seeds 1–13, 282 distinct
  lines, zero doubled stops and zero shouted names. Two defects fixed on the way:
  a band name may not also be a title or album inside its own bank (72 of those
  in the new banks, plus 19 title==album pairs — the pre-existing 48 banks have
  none, so that is the house rule), and the LABELS pool's first imprint was
  `"ROYAL ROAD"` in caps — the one shouted string in a tier that is read aloud by
  a speech synthesiser. `test/gates/speech.test.js` now gates all of this.
  (Known cosmetic nit, deliberately left alone: 7 of the original 48 banks reuse
  a band name as a title — `canawave`, `dinosynth`, `synthwave`, `vaporwave`,
  `triphop`. Those are hand-written names and not mine to rewrite.)
- **`pool:voices` / VOICE_FAMILIES: the flat shelves are now cast, and the
  remaining drops are structural, not a curation gap.** Every family-less voice id
  is declared: `apollo` (the six Apollo slices), `timesignal`, `otr_drama`,
  `pd_poem`, `war_radio`, and the synthesized announcer lines split FOUR ways by
  what the line is doing (`sp_hype`/`sp_machine`/`sp_retail`/`sp_calm`) — one `sp`
  family would have licensed "rewind. selecta" standing in for "you are here now",
  which one genre's pool really does put side by side.
  Measured over 1,370 track states: substitutions 852 → 918, drops 3,431 → 3,413.
  That is small, and the reason is worth recording so nobody re-opens this as a
  curation problem. **A family can only rotate among members the state actually
  resolved, and the pools draw one member per slot** — 102 genres draw
  `pool:vocal_stab*1`, 11 draw `*2`, and across all 1,370 states exactly ZERO ever
  hold two Apollo sources, so the largest cast can never fire. Where siblings do
  co-occur the mechanism works well (`sp_auction_1/2/3`: ~100 substitutions).
  Moving the number further means changing pool DRAW COUNTS, which buys variety
  with fetched media — the opposite of the direction the budget was just set in.
- **The ⓘ chord chips cannot drift from the audio any more.** `csd-engine.js`
  exports `resolveProgression(state)` — the skeleton→reharm walk, one copy —
  and `buildEvents` and `notefeed.js resolveHarmony` both call it. The event
  bundle's shape is unchanged (so no fixture hash moved), and
  `test/browser/genre-viz.test.js` check M binds them: over every reharm genre in
  its sample the panel's chip list must equal the engine's resolved chord names
  (29 genres, 29 genuinely reharmonized, 0 mismatches).
