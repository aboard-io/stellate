# TODO — the running queue

Short, durable list of asked-for-but-not-yet-built work. The queue this file
carried through Stages A–F is finished, and the history of it is in git rather
than here. What follows is only what is still open, with the measurements that
make each item decidable.

`verify.sh` is 13/13. `node engine/genre-verifier.js matrix --no-cache` prints
`diagonal dominant: 274/274`.

---

## Open: gates that do not pass

Known-red, and none of them regressions — each fails identically on an older
tree. Listed so nobody rediscovers them as surprises.

**Browser gates, last measured red:** `bg-handoff` (`h.__bgState is not a
function`), `live-resilience` (`STALL`), `transit-arrival` (dwell 0, peak w=0),
`starcruise-barcadence` (1 of 16 — worst boundary camera move 6.91× the local
median, frame 112).

**Unit gates red on an unfetched tree:** `all-sampled` and `segment-parity` need
fetched media and pass once `tools/fetch/` has run; `corpus-db` needs the
external MIDI drive. `mutate`, `near-duplicate`, `simulate-path`, `snare-law`,
`stem-parity` and `vocoder` fail identically on an older tree — genuinely
pre-existing, never diagnosed.

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

## Open: the media budget

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
whole journey, only **ten minutes of play ahead of the traveler**, the horizon
moving as you travel. On a long path that is the larger saving, and it bounds the
bed cost by what is actually listened to.

Still worth deciding: whether 2.75 beds/track is the right resting point, or
whether the bed pools should cap lower now that precache is bounded.

---

## Open: small and specific

- **42 of the 62 ident genres have no per-genre NameBank bank.** The speech ident
  tier works; those 42 fall back to label-led frames. Pure data work.
- **`pool:voices` is bed-role only.** The utterance governor's family-substitution
  fix (`VOICE_FAMILIES`) is correct and costs nothing, but it moves no number
  until a curated reading reaches a hits/vox pool, because bed events never reach
  the governor. Candidates for the next declared cast, with drop counts over
  1,370 tracks: `sp_system` 346, `sp_pressure` 328, `vox_d` 274, `sp_herenow`
  199, `sp_rhythm` 197, `sp_rewind` 187. Curation call.
- **5.9% of hits-layer-carrying tracks fire zero hits.** A layer that draws
  nothing is indistinguishable from no layer. If that reads badly by ear, the fix
  is a floor of one kept slot per section rather than a lower skip probability.
  That one is a taste call and needs a listen, not another number.

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
- **The ⓘ chord chips cannot drift from the audio any more.** `csd-engine.js`
  exports `resolveProgression(state)` — the skeleton→reharm walk, one copy —
  and `buildEvents` and `notefeed.js resolveHarmony` both call it. The event
  bundle's shape is unchanged (so no fixture hash moved), and
  `test/browser/genre-viz.test.js` check M binds them: over every reharm genre in
  its sample the panel's chip list must equal the engine's resolved chord names
  (29 genres, 29 genuinely reharmonized, 0 mismatches).
