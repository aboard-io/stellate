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

**Three pure-node starcruise probes cannot run at all.**
`test/unit/{traits,flight,planet}.test.mjs`. The root cause is not the tests: it
is that `app/starcruise/*.js` are ES modules living in a `type: commonjs`
package, so node loads them as CommonJS and throws on the first `export`. The
tests were also mixing `require` with `import`; that part is fixed, so the error
now names the real cause instead of hiding it behind a syntax error in the test.

Fixing it properly is a package-type decision, not a patch. Either the app
modules become `.mjs` — touching every importer and the HTML `<script
type=module>` tags, which is a live-site change — or `package.json` declares
`"type": "module"` and every CommonJS tool and gate in the repo converts with it.
Neither is small. The code these probes cover *is* exercised in a real browser by
the starcruise gates, so what is lost is a fast pure-node check, not coverage.

**Browser gates, last measured red:** `bg-handoff` (`h.__bgState is not a
function`), `live-resilience` (`STALL`), `transit-arrival` (dwell 0, peak w=0),
`starcruise-barcadence` (1 of 16 — worst boundary camera move 6.91× the local
median, frame 112).

**Unit gates red on an unfetched tree:** `all-sampled` and `segment-parity` need
fetched media and pass once `tools/fetch/` has run; `corpus-db` needs the
external MIDI drive. `mutate`, `near-duplicate`, `simulate-path`, `snare-law`,
`stem-parity` and `vocoder` fail identically on an older tree — genuinely
pre-existing, never diagnosed.

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
- **`resolveHarmony` duplicates `buildEvents`' reharm call** — same table, same
  `+40961` stream offset — so the ⓘ chord chips can silently drift from the audio
  if that call site changes. No gate binds them. The durable shape is for
  `buildEvents` to return its resolved chord list, which is an engine change.

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
