# genre-qa — the catalogue in a database, and the questions as queries

`nukernel/genres.js` is 26,000 lines and 421 rows, and half of every row is
closures and an argued comment. That is why it stays the **source of truth** and
why this is only a **mirror**: nothing in this directory edits a genre.

    node tools/genre-qa/build.js        # -> scratch/genres.db          (~4 min cold)
    node tools/genre-qa/report.js       # -> scratch/genre-qa/REPORT.md (~90 s)

`scratch/` is gitignored. The database is derived and regenerable; the builders
are committed. Delete `scratch/genre-qa` and run the one command again.

## Flags

| flag | what it does |
|---|---|
| `--no-corpus` | skip the MIDI pass; reuse `scratch/genre-qa/corpus.jsonl` if it is there |
| `--recorpus` | redo the MIDI pass even though it is cached |
| `--corpus-db PATH` | another `corpus.db` (default `/mnt/sources/relocated/stellate-midi-corpus/corpus.db`) |
| `--no-chordonomicon` | skip the 666k-progression load |
| `--chordonomicon PATH` | another Chordonomicon CSV |
| `report.js --no-kiwix` | do not read Wikipedia leads; the date half of `linked`/`earliest` goes blank and says so |
| `report.js --top N` | unused by the file (every row is listed); kept for a narrower console print |

## The off-repo inputs

Both live on the corpus drive, never in the tree — `found/` is rsynced to the
droplet, so a multi-gigabyte derived artifact must never land there.

    /mnt/sources/relocated/stellate-midi-corpus/corpus.db      120,652 parsed MIDI files
                                                               (built by tools/mine/corpus-db.js)
    /mnt/sources/relocated/chordonomicon/chordonomicon_v2.csv  666,000 chord progressions

Fetch the second with:

    mkdir -p /mnt/sources/relocated/chordonomicon
    curl -sL -o /mnt/sources/relocated/chordonomicon/chordonomicon_v2.csv \
      https://huggingface.co/datasets/ailsntua/Chordonomicon/resolve/main/chordonomicon_v2.csv

Wikipedia leads are read from the local kiwix ZIM at `localhost:8888`
(`KIWIX_HOST`/`KIWIX_PORT` override it), exactly as `nukernel/wiki-extract.js`
does. **A link is not a fetch and the page never makes one** — this is a
build-time tool.

## The files

| file | what it is |
|---|---|
| `build.js` | node, zero deps. Extracts the catalogue to JSON lines, then spawns the python3 steps. |
| `corpus.py` | matches each genre to MIDI files and measures them |
| `load.py` | the JSON lines into the seven tables |
| `chordonomicon.py` | the chord dataset + the label cross-walk |
| `q.py` | the one door between node and the DB (`--sql`, `--checks`) |
| `report.js` | runs the checks as SQL, writes `REPORT.md`, writes the `checks` table back |

`better-sqlite3` is not installed on this tree, so SQLite is reached through
python3's stdlib `sqlite3` in a child process. That is the whole reason for the
node/python split.

## The tables

    genres        one row per GENRES key: the data half as columns, the composed
                  record's summary at seed 1, the atlas facts, the wiki row, the
                  row's own comment, and row_json — EVERY field including the four
                  closures as their source text
    chairs        one row per seat in the composed record: instrument id, resolved
                  Faust dsp, and LANE (native / sampled / found / unknown)
    sections      the composed section roster: role, bars, period, level, envelope
    parents       declared parents with weights; `wants` as weightless rows
    rules         nukernel/rules.js say(gk) — one sentence per editable field
    corpus_files  the MIDI files matched to each genre and how they matched
    corpus_stats  what those files measure
    checks        written by report.js: gk, name, score, verdict, detail
    chordonomicon        one row per song (key estimated, roman numerals normalised)
    chordonomicon_genre  one row per (song, label) — the census is a GROUP BY
    genre_xwalk          label -> our key, with the method; unmapped labels keep
                         their row with gk NULL

## The lanes

A chair's instrument is one of three things, and the `instrumentation` check is
built on the distinction:

- **native** — `audio/to-engine.js patchForInstr()` names a Faust module for the
  id, or the row declares a `synth`, or the kit is one of the four classic
  machines. The engine *models* it.
- **sampled** — no patch table claims the id, so `recipeBase` hands it to the
  sampler library. It is a *recording*. (`instruments.js sampledId` is the
  page's own predicate for exactly this and is gated against `recipeFor`'s
  routing in `test/loop-words.test.js`.)
- **found** — a `found:` crate address: a bed, a one-shot, or a collage pool.

There is a fourth distinction the lanes do not draw, and it is the one that
started this round. A **modelled throat** (`voice_lead`, `voice_choir`,
`tract_voice`) is exactly as native as a Minimoog, so a chip genre can be 100%
native and still sound like people singing. `report.js` calls those chairs
**organic** and flags them on rows whose own sound is a machine.

## Not a gate

Nothing here is registered in `test/all.js`. This is analysis: it has opinions,
it uses estimates, and an opinion in a gate is how a gate stops being trusted.
Every estimate says so in the report's last section.
