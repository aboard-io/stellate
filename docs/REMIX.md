# AUTO REMIX (APPROVED 2026-09-06)

Paul: *"Could you write an auto remix function that could take a midi file,
arrange it, extract motifs, and make it a new genre?"*

Yes, and four fifths of it is already in the tree. This document is the
contract; nothing here invents a second copy of anything.

## What already exists

| piece | where | what it does today |
|---|---|---|
| SMF parser, zero dependencies | `tools/mine/mine-midi.js` | parses a `.mid`, extracts tempo, meter, key, swing equivalent, off-grid, GM drum lanes, per-bar chord estimates — with its honesty caveats written at the top |
| melodic phrase mining | `tools/mine/mine-melody.js` | slices trusted melody lines into 8-beat windows and keeps the playable ones |
| groove and theory mining | `tools/mine/mine-groove.js`, `mine-theory.js` | |
| a corpus of 120,652 parsed files | `tools/mine/corpus-db.js` | the trove the ragtime anchor was derived from |
| genre row generation | `tools/genres/{extract,grammar,emit,build}.js` | the catalogue is JSON rows plus a generator |
| a figure vocabulary | `genres-tables.js FIGURES` | per-note dynamics, shipped v291 |
| how far a row is from its family | the fit tool (genealogy) | residue against declared parents |

So the work is a PIPELINE that joins them, not a new engine.

## The pipeline

`tools/remix.js <file.mid> [--name <key>] [--seed n]`, zero dependencies,
deterministic, printing every decision it makes:

1. **Read.** `mine-midi.js`'s parser. Tempo, meter, key, swing, and the
   caveats it already states — notation tempo is a convention, so the metric
   level is checked before a bpm is believed (the ragtime lesson, written in
   that file).
2. **Arrange.** Bars are compared to each other (a self-similarity pass over
   pitch-class and rhythm) and the repeats become the FORM: the first
   distinct block is the intro, the most repeated is the chorus, what returns
   between choruses is the verse, what appears once late is the bridge. The
   section names are guesses and the tool says they are guesses.
3. **Extract motifs.** Melody lines become the box's own cells (`deg`, `play`,
   `vel`, `acc`), drums become a kit grid, the bass becomes its own figure.
   One motif per distinct phrase, named by what it does, deduplicated by
   shape rather than by exact match.
4. **Extract the changes.** Per-bar chord estimates become a `prog` in
   DEGREES, never chord names, per the `PROGS` law.
5. **Make the row.** A `nukernel/genres/<key>.json` in the catalogue's own
   schema, plus a session document so the box can open the result. Its
   dynamic figure is measured from the file's own velocities and accents
   against `FIGURES`, not guessed.
6. **Say where it came from.** The row's `note` states the source file, what
   was measured, what was guessed and what was thrown away. A row derived
   from one recording is not a genre and must not pretend to be: no invented
   place, no invented year, `parents` set to the rows the fit tool says it is
   nearest, and the residue printed so the claim is checkable.

## The laws

**THE TOOL WRITES ROWS, NEVER genres.js.** The generator does that, and
`node tools/genres/build.js --check` must be green after.

**A GUESS IS LABELLED A GUESS.** Section names, chord estimates and the
melodic line's identity are inferences. Every one of them is printed with its
confidence, and the row's note keeps them.

**IT MUST PLAY.** The output compiles through `document.js scoreOf` and
renders notes, or the run fails. A row that does not sound is not a row.

**IDENTITY IS UNTOUCHED.** Adding rows changes no existing record:
`test/table.test.js` T2 stays green with no re-pin, the way the three starter
genres did.

## Not in this round

The door in the app — an "import a MIDI" control in a view — is the next
round, because the chrome is being rebuilt right now. The tool comes first and
the door calls it.

---

# THE OUTCOME (2026-09-06)

`tools/remix.js` is built, and this is what it measured. Everything below is a
number a run produced, not a claim about what it should produce.

## What was joined, and what was written

| piece | what happened to it |
|---|---|
| `tools/mine/mine-midi.js` | **exported** `bpmOf`, `median`, `pctl`, `interlock`, `CORE`; its `parseSmf` now keeps the program changes it was already reading to advance the cursor (`programs`, a new field nothing older reads). No formula moved. |
| `tools/mine/mine-melody.js` | the window slicer, the interval statistics, the medoid and the MEL_PHRASES mapping were **lifted out of `main()`** — cut and pasted, not retyped — and are exported as `windowsOf` / `winStats` / `medoid` / `melPhrase`. `main()` calls them and the CLI prints what it always printed. `win` became a parameter so a 3/4 bar is not sliced as two beats of four. |
| `tools/mine/mine-groove.js` | the same move: the velocity-lean accumulation is `accentProfile(notes)` now, with the ±30% clamp and the mean-1 law kept where they are documented. |
| the fit tool | **found in `scratchpad/dyn-flood/genealogy.js`, which is `.gitignored` — the one tool that measures a row against its parents was not in the repo at all.** It now lives at `tools/genealogy.js`. Three edits from the deleted original: the `featuresOf(k)` body became `featuresOfRow(g, bpm)` so a row that is not in the catalogue yet can be measured, plus new `nearest()` and `fitVec()` over that; and the CLI writes `GENEALOGY.md` only under an explicit `--write`. |
| `tools/remix.js` | new. It owns four things and nothing else: the self-similarity pass, the mapping of a mined window onto `deg`/`play`/`vel`/`acc`/`alt`, the measurement of a file's velocities against `FIGURES`, and the prose of the row's `note`. |
| `test/remix.test.js` | new — R0 the extraction moved nothing, R1 determinism, R2 the round trip, R3 it must play. **32 checks.** |

**The lift is PROVED, not asserted.** Neither miner CLI can be re-run here to
check it the other way — both open the corpus DB through `corpus-db.js
requireSqlite()` and `better-sqlite3` is not installed on this box — so
`test/remix.test.js` R0 freezes the four bodies **as they stood before the lift**
(the `terms-genre.freeze.js` idiom) and runs them against the exported functions
over a deterministic 400-line pseudo-corpus: 709 onset signatures, 724 windows,
every window's interval statistics, every signature's medoid at three `stepMed`
values, and a 6,735-note velocity lean. **All four identical.**

## The input

The corpus at `/mnt/sources/relocated/stellate-midi-corpus/` is on this box, so
**real MIDI was used**: `rips/ragtime`, `rips/dub`, `rips/folk`,
`rips/jazz`, `rips/classical_mfiles`, `rips/classical_guitar`. There is no
`found/midi/` directory here. Six more inputs were written by **the box's own
exporter** (`tools/ableton/score-node.mjs` → `nukernel/export/smf.js`) so that
half the round has ground truth: a song of four or five boxes naming two or
three alternating genres, which gives a known tempo, a known meter, a known bar
count, a known block count and a known kit.

## The recovery table

Twelve inputs. `sect` is sections found, `motif` is motifs kept / distinct
shapes seen, `resid` is the genealogy residue against the three nearest rows.

| input | notes | meter | bpm not→felt | key | scale / mode | sect | motif | kit | dyn | nearest | resid |
|---|---:|---|---|---|---|---:|---|---|---|---|---:|
| gt_rock (box) | 700 | 4/4 | 126→126 | C major | mixo / mixo | 4 | 1/1 | hks | flat | italodisco, bigroom | 11% |
| gt_waltz (box) | 609 | **3/4** | 126→126 | C major | ionian / ionian | 1 | 4/4 | — | flat | synthsoul, beatgroup | 18% |
| gt_reggae (box) | 474 | 4/4 | 126→126 | C minor | yupent / aeolian | 3 | 2/2 | **hkp** | flat | synthsoul, beatgroup | 14% |
| gt_jazz (box) | 1477 | 4/4 | 126→126 | C major | ionian / ionian | 6 | 4/4 | hkrs | flat | bleeptechno, bailefunk | 27% |
| gt_chant (box) | 338 | 4/4 | 126→126 | C minor | yupent / dorian | 1 | 4/4 | — | terraced | house, photoplay | 12% |
| gt_contrast (box) | 823 | 4/4 | 126→126 | C minor | yupent / dorian | 5 | 2/2 | **ko** | flat | techno, bleeptechno | 14% |
| Bach, WTC I prelude 1 | 549 | 4/4 | 92→92 | C major | ionian / ionian | 10 | 1/1 | — | backbeat | janglepop, shidaiqu | 26% |
| dub, *Ire Times* | 6611 | 4/4 | 145→145 | A minor | majpent / ionian | 12 | 2/2 | hkps | swell | footwork, bleeptechno | 14% |
| folk, `00tbatg` | 4960 | 4/4 | 120→120 | Eb major | ionian / ionian | 12 | 8/8 | krs | flat | italodisco, bigroom | 13% |
| Aguado, Study 27 | 855 | **2/4** | 65→**130** | E major | ionian / ionian | 8 | 8/8 | — | flat | bleeptechno, dnb | 52% |
| jazz, `059MuteTrumpet` | 17 | 4/4 | 120→120 | F minor | dorian / dorian | 1 | 2/2 | — | syncope | serial, parlor | 28% |
| ragtime, *Maple Leaf Rag* | 3522 | 4/4 | 103→103 | **Ab major** | ionian / ionian | 12 | 8/8 | — | flat | garage, jamband | 19% |

## Against ground truth, where there is ground truth

| input | what went in | bpm | bars | blocks | meter | kit | mode |
|---|---|---|---|---|---|---|---|
| gt_rock | guitarrock, pop, guitarrock, pop, dance | 126 → **126** | 20 → **20** | 5 → 4 | 4/4 → **4/4** | chkos → hks | ionian+aeolian → mixo |
| gt_waltz | waltz, waltz, musette, waltz | 126 → **126** | 32 → **32** | 4 → 1 | 3/4 → **3/4** | — → **—** | ionian+melodic → **ionian** |
| gt_reggae | reggae, dub, reggae, dub | 126 → **126** | 16 → **16** | 4 → 3 | 4/4 → **4/4** | hkp → **hkp** | aeolian → **aeolian** |
| gt_jazz | jazz, swing, jazz, swing | 126 → **126** | 32 → 33 | 4 → 6 | 4/4 → **4/4** | kshrf(prob) → hkrs | ionian+mixo → **ionian** |
| gt_chant | gregorian ×3 + organum | 126 → **126** | 16 → 33 | 4 → 1 | 4/4 → **4/4** | — → **—** | dorian → **dorian** |
| gt_contrast | gregorian, techno, gregorian, techno | 126 → **126** | 24 → 32 | 4 → 5 | 4/4 → **4/4** | ko → **ko** | dorian+aeolian → **dorian** |

**Tempo 6 of 6 exact. Meter 6 of 6 exact, 3/4 included. Mode 5 of 6 right.
Kit exact where the kit is one machine (2 of 2), a subset where three genres'
kits were unioned. Bars exact on 3 of 6. Blocks within ±2 on 4 of 6.**

## What it guesses well

- **Tempo.** Exact on every input, and the two overrules it makes are both
  argued: the 2/4 Aguado study doubles to 130 by `mine-midi.js`'s own stated
  caveat (a 2/4 stride or march reads half as fast as it feels — the ragtime
  lesson), and anything outside the catalogue's own 2nd–98th bpm percentile
  window is folded by octaves until it is inside. Nothing else moves a bpm.
- **Meter.** 4/4, 3/4, 6/8 and 2/4 all read correctly. The box only has words
  for three of those; a 5/8 file is told it is being counted in four.
- **Key, once the key signature is distrusted.** *Maple Leaf Rag* carries a
  `sf=0` signature and is in A♭. The first draft believed the signature and put
  the row in phrygian. The signature is now believed only where the detector
  agrees within `keycheck`'s own three categories (exact, relative, a fifth
  away); otherwise the detector wins and the row's note says which and why.
- **The kit.** The modal bar of a drum machine is the drum machine: `ko` and
  `hkp` came back exactly.
- **The chord cycle,** at least as a skeleton, and it reads it off the most
  repeated block rather than off bar 1, which is the difference between a
  record's changes and its introduction.

## What it guesses badly, measured

- **Section count on repetitive or through-composed music.** A waltz whose every
  bar is the same oom-pah collapses to one section; a chant does the same. A
  Bach prelude with no repeats at all comes back as ten sections, which is a
  list of bars wearing a form's clothes. The confidence is the honest part — the
  within/between similarity gap — and it reads 0.45–0.69 on exactly those files.
- **Telling two similar genres apart.** `pop` against `guitarrock` at the same
  tempo in the same key is one cluster to this pass, and the ABABC form came
  back as four blocks rather than five. `gregorian` against `techno` is five
  against four. The arranger sees *difference*, not *identity*.
- **The alphabet on a near tie.** gt_rock is ionian+aeolian material and came
  back mixolydian on a 0.006 lead, at confidence 0.05. The confidence is
  reporting the tie correctly; the answer is still one of two.
- **`dyn` is `flat` on most files, and that is a claim about MIDI, not a
  shrug.** Every one of the nine `FIGURES` is asked what it would have written
  over the file's own onsets and compared z-scored inside each bar; `flat`
  scores exactly 1.000 by construction because it predicts nothing, so a figure
  has to *beat the null* to be written. Seven of twelve files could not, because
  a transcription's velocities are the transcriber's. The five that could —
  `backbeat`, `swell`, `terraced`, `syncope` — beat it by 0.05 to 0.35.
- **A double-time transcription inside the tempo window stays double-time.**
  The dub plate reads 145 and `mine-midi.js`'s own note says dub is written
  double (corpus 134 = anchor 67). The tool folds only what is outside the
  catalogue's window, so it cannot catch this one, and it does not pretend to.
- **Bar count runs long on records that ring.** `totalBeats` counts a note's
  duration, so a chant whose last chord holds adds bars that nobody played:
  16 → 33 on gt_chant.
- **Two files were refused before this was fixed and the refusal is kept.** A
  file with no melodic window that survives slicing throws by name and writes
  nothing, rather than emitting a row with no motif in it.

## The honest limits — what a MIDI file cannot tell you

1. **Production.** Reverb, saturation, tape, room, width, compression, the desk.
   A `.mid` is silent about all of it, so the `tone` block every mined row
   carries is **declared, not measured** — it is there for `verb` alone, which
   G9a holds to a non-zero return on every record.
2. **Timbre.** A GM program number is the *transcriber's* choice of patch, and
   this trove is largely piano transcriptions. Only the **16 GM families** are
   read off the program changes, and a file with none gets the box's plainest
   pair with the note saying so.
3. **Whether the melody line is the melody.** "The highest part, weighted by how
   monophonic it is" is a heuristic. It is wrong for a tenor cantus firmus,
   wrong for a stride left hand, and wrong wherever the tune is in an inner
   voice. Confidence ran 0.11 to 0.88 across these twelve; on solo-piano files
   it is pinned at 0.25 with the caveat printed, because there the *skyline* is
   being taken for the tune.
4. **The octave.** `document.js toPhrase` zeroes a cell's `oct` vector, so a
   mined motif is folded into one octave. The contour survives; the register
   does not. Chromatic notes *do* survive, as the cell's present-only `alt`.
5. **Where and when.** A file names no place and no year. **So a mined row
   declares no `parents`,** and that is not a gap — `genres-build` G2 holds that
   a label is a "Place Year" *if and only if* a row declares parents, so
   inventing an address to satisfy the field would be this catalogue's first
   invented address. What the fit tool says the row is nearest to, and the
   residue against those neighbours, is printed and written into the note as a
   **measurement**. `--label "Kingston 1973"` is the door for a human who
   actually knows: given a real place and year, the row declares fitted parents
   on the catalogue's own 0.05 grid and the law is satisfied honestly — **and
   the candidate pool is cut to rows not later than that year first**, which is
   the catalogue's other parents law. Measured: `--label "Sedalia 1899"` on
   *Maple Leaf Rag* first proposed `garage`, `jamband` and `house`, none of
   which existed in 1899; inside the 59 rows that are not later than 1899 it
   proposes `operaseria 0.45, symphony 0.1, grandopera 0.05` with a 43% residue,
   which is a claim a person can now argue with instead of a law being broken.

## Where the demo rows are, and what is shippable

Twelve rows and twelve sessions are in **`tools/remix-out/`**, which is the
clearly-marked directory and is **not** the catalogue. Nothing was written into
`nukernel/genres/`, `_order.json` or `nukernel/genres.js`.

`--install` does the three motions GENRES.md §1 names (write the row, add the
key to `_order.json`, run the build) and it was **run once and reverted** to
prove the path: `build.js --check` green, `genres-build` 12/12, `dynfigure`
10/10 — and `nukernel/atlas.gate.js` **2 of 34 failing**, exactly as the tool's
own printed warning says it will. That is the one motion the tool refuses to
make: a row in the catalogue must be in `atlas.js` `WHEN` or `EXCLUDE`, and
where a record belongs on a map is a claim a person makes, not a thing a mined
row gets to assert about itself.

**What I would ship:** the tool, the miner exports, `tools/genealogy.js` (it
should not be living in a gitignored directory), the gate, and this document.
**What is only a demo:** the twelve rows in `tools/remix-out/`. They are honest
outputs and they all sound, but a row derived from one recording is not a genre,
and whether any of them earns a place in a 482-row catalogue of anchored records
is Paul's call and not a tool's.

## The gates

| gate | result |
|---|---|
| `node tools/genres/build.js --check` | **green** — 48,943 lines, nothing written into the catalogue |
| `node test/genres-build.test.js` | **PASS 12 ok, 0 failed** |
| `node test/dynfigure.test.js` | **10 passed, 0 failed** |
| `node test/document.test.js` | **47 passed, 0 failed** |
| `node test/copy.test.js` | **10 ok, 0 failed** |
| `node test/remix.test.js` | **32 passed, 0 failed** (new) |
| `node test/precompose.test.js` | 50 passed, **1 failed** — G1, and its nine problems are `dance`/`guitarrock`/`pop` × 3 seeds (`chord part chord`). **Pre-existing and not this round's:** those three rows were added by the starting-points round and this round wrote none of them. |
| `node test/table.test.js` | 38 passed, **2 failed** — T2a/T2b, 622 of 1,437 documents moved. **BASE_SHA was NOT re-pinned**, and T2's own header says why it did not need to be: *"T2 compares 479 of 482 anchors: 3 row(s) do not exist at 1c5e8db"*. The 622 that moved are existing anchors moved by the uncommitted `nukernel/precompose.js` edit in flight beside this round (the record-wide-fx narrowing, `softrock`'s lurch). Nothing in `nukernel/` requires anything in `tools/` — the only mentions are in comments — so this round's surface cannot reach T2. |
| `node nukernel/atlas.gate.js` | 33 of 34 — the one failure is `softrock: label says London 1974, WHEN says Lagos 1973`, the same in-flight round. No remix key appears anywhere in its output, because no remix key is in the catalogue. |

The corroboration for distrusting a key signature, from `mine-midi.js`'s own
`keycheck` over these six corpus files: **exact 20%, relative 20%, fifth-off
20%, other 40%.** Two files in five carry a signature that is not their key.

---

# THE PIPELINE RUNS IN A BROWSER (2026-09-07)

Paul: *"Make the changes to the pipeline to run in browser."*

`nukernel/TABLE.md` §20f measured five things standing between this pipeline
and a page, and named them as a SEAM rather than hanging a MIDI-upload control
on a door that could not open. This is the round that opened it. **The logic did
not change and the output did not move**, and that is not a claim — it is the
gate: `test/remix.test.js`'s 32 checks are green on the same inputs, and
`test/remix.browser.js` runs the pipeline in a real chromium and compares its
row, its session document, its store and its provenance against the node CLI's,
character for character.

## The five blockers, what each one actually was, and what was done

| §20f said | what it was, checked | what was done |
|---|---|---|
| top-level `require("fs"/"path")` in `remix.js`, `mine-midi.js`, `corpus-db.js` | true, and in `mine-midi.js` it was **only** the corpus scan and the CLI — `parseSmf`, `featuresOf`, `detectKey` and `chordsOf` never touch a filesystem | `mine-midi.js` and `remix.js` are UMD, `fs`/`path` are taken under a `NODE` guard, and every use of them is inside that guard or inside `main()`. `corpus-db.js` never crosses; it stays a node tool. |
| `read(file)` and `run(file, …)` take a PATH, not bytes | true | `readBytes(u8, name)` and `runBytes(u8, name, key, O)` ARE the pipeline; `read` and `run` are a two-line node shell over them. The CLI's flags, its printed lines and the files it writes are unchanged. `path.basename` became a five-token `baseName()` so a `File.name` and a path both work. |
| `mine-melody`/`mine-groove` pull in `corpus-db.js` | true, and the require was **dead at module level**: the four lifted functions are pure, and `corpus-db` was only ever reached from inside `main()`. `mine-melody.js` also imported `mine-midi.js` and then never named it once (measured: zero uses). | both requires moved into `main()`; the unused one is gone. Both files are UMD. |
| `sessionOf` requires app modules by ABSOLUTE filesystem path | true — `require(ROOT + "/nukernel/precompose.js")` | the `isNode ? require(…) : root.Nu…` idiom `precompose.js` itself opens with, plus an explicit `deps` argument for a caller that already holds them. The laziness is kept exactly where it was. |
| `resolveRow`/`deSrc` use `eval` | true, in three places | **gone from the browser path.** See below. |

## The `eval`, and why it did not survive the crossing

`emit()` writes a closure as SOURCE, and the only way back from source is
`eval`. But a template is DATA — nine little arithmetic sentences — so
`tools/genres/grammar.js` grew a third direction: **`compile(t)` builds the
closure by construction.** Measured over the whole catalogue, `compile(t)`
agrees with `eval("(" + emit(t) + ")")` on every voice index 0..8 for **1,518
closures with zero mismatches**; the 508 it refuses are `formula` (which IS
source text) and `$src` result slots naming the WORDS scope (`[drop(2)]`,
`{ ...MOUTHS.hymnal }`).

**Not one of the 508 is reachable from a mined row.** The catalogue's own rows
arrive at a page already compiled inside `nukernel/genres.js`; `resolveRow` only
ever sees a row this tool just made, and every one of those is `const 0` / `neg`
/ `cases` / `const []` — measured across all twelve rows in `tools/remix-out/`.
`deSrc`'s `$src` forms are the same story: `MODES.x`, `SCALES.x` and `[]`, all
three of which `grammar.js resolveSrc` reads without evaluating anything.

So **the eval survives on the NODE side only**, as a named fallback, so that a
human who hand-edits a mined row into a `formula` still gets a run out of the
CLI. On a page the same input **refuses by name** — naming the field and the
offending source — rather than dying in a CSP violation nobody can read. That is
§15's shape: a control that says what it cannot do.

The proof is not an argument. `test/remix.browser.js` serves the page under
`Content-Security-Policy: script-src 'self'` (no `'unsafe-eval'`, no
`'unsafe-inline'`) **and** COOP/COEP `require-corp` — §20f's "strict CSP and
cross-origin isolation", both at once — and probes `eval` at load time inside
the page's own realm, because a probe called through `page.evaluate` is answered
by the debugger's realm and would report a false pass. Chromium says
*"Evaluating a string as JavaScript violates the following Content Security
Policy directive … 'unsafe-eval' is not an allowed source of script"*, and the
pipeline produces the CLI's bytes anyway.

## The byte-identity proof

Three comparisons, all of the same payload: the row, the session document, the
store and the provenance, `JSON.stringify`d and compared as one string.

| what against what | inputs | result |
|---|---|---|
| the pipeline at `HEAD` vs the ported pipeline, both under node | 18 real corpus files (a stride through `/mnt/sources/…/rips`) plus the box's own `gt.mid` | **19 of 19 byte-identical** |
| the node CLI's printed lines, before and after | `gt.mid` | **identical**, all 26 lines (the only textual difference in a full non-dry run is `path.relative(ROOT, …)` naming the harness tree's own root) |
| the BROWSER vs the node CLI | `gt.mid`, dropped in as `Uint8Array` | **byte-identical, 21,274 characters**, and the 26 printed decisions match line for line |

## The seam the UI door must implement

**A door loads twenty-five classic `<script>` tags and makes one call.** The app
tier is `nukernel/index.html`'s own order — `engine/theory.js`, then `kernel`,
`genres`, `genres-tables`, `askable`, `fields`, `song`, `instruments`,
`compose`, `presets`, `songs`, `document`, `knobs`, `chair`, `ideas-kit`,
`rules`, `precompose` — and the pipeline tier is eight files that are all UMD as
of this round: `tools/theory.js`, `tools/genealogy.js`,
`tools/mine/mine-{midi,melody,groove}.js`, `tools/genres/{grammar,emit}.js` and
`tools/remix.js`, which publish `NuMineMidi`, `NuMineMelody`, `NuMineGroove`,
`NuGenreGrammar`, `NuGenreEmit` and `NuRemix`. On a `change` from an `<input
type="file" accept=".mid,.midi">` the door reads `await file.arrayBuffer()`,
wraps it in a `Uint8Array` and calls `NuRemix.runBytes(u8, file.name, key, {
seed, dry: true, parents: false })` — where `key` is the row's name, lowercased
and stripped to `[a-z0-9]`, defaulting to `"remix" + the file's stem`. **`dry`
is the browser's only legal mode**: there is no filesystem on a page, and a
non-dry call refuses by name rather than half-succeeding. What comes back is
`{ key, row, doc, store, R, A, M, prov, fig }`; `store` is exactly the shape
`ui/state.js` writes and `adoptSong` reads, so the door hands `store` to the
session and the box opens on the result. Every decision the tool made is on
`console.log` in the order the CLI prints it, so a door that wants to show its
work can capture that; a run that throws throws by name (`"parsed, but it has no
notes"`, `"no melodic window survived"`), and those names are what the door
should print. Nothing is written into the catalogue and nothing touches
`nukernel/genres/` — installing a mined row remains the CLI's `--install`, and
`atlas.js` remains a human's.

## The gates for this round

| gate | result |
|---|---|
| `node test/remix.test.js` | **32 passed, 0 failed** — unchanged, on unchanged inputs |
| `node test/remix.browser.js` | **10 passed, 0 failed** (new) |
| `node test/theory.test.js` | **all 48 checks pass** |
| `node test/describe.test.js` | **23 passed, 0 failed** |
| `node test/document.test.js` | **50 passed, 0 failed** |
| `node test/genres-build.test.js` | **PASS 12 ok, 0 failed** |
| `node tools/genres/build.js --check` | **green** — 53,351 lines, nothing written into the catalogue |
| the four miner/tool CLIs | `mine-midi.js file <f.mid>` still prints its JSON; `mine-melody.js`, `mine-groove.js` and `mine-midi.js` still print their usage. `tools/genealogy.js`'s CLI throws in `report()` on a missing anchor and `tools/genres/extract.js` cannot find `acorn` — **both fail identically at `HEAD`** and neither is this round's. |
