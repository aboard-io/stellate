# Move

A Stellate song becomes an Ableton Move Set: 8 scenes of clips on Move's four tracks, with
core-library instruments, tempo, key, scale and time signature, plus the running order for
Schwung's Song Mode. There are two halves and they are separable on purpose.

    nukernel/export/move.js     the writer. Pure, no I/O, the tier passed in — the als.js rule
    tools/move/
      donor/Song.abl            the Set Move itself saved, which the writer rewrites
      export-move.js            the CLI
      move-gate.js              the gates, including one that asks the device
      probe.sh                  "will Move load this file", answered in five seconds
      minimize.py ddnotes.py    narrow a refused Set to the clips, then to the notes
      deploy.sh diagnose.sh rescue.sh install-set.sh
      schwung/                  the tool that runs ON the Move, and its build

    node tools/move/export-move.js --genre "acid house" --out /tmp/sets
    node tools/move/move-gate.js /tmp/sets/*/Song.abl --genre acid
    node tools/move/move-gate.js --sweep                 # every genre, no device needed

## What a Move Set is

`/data/UserData/UserLibrary/Sets/<uuid>/<display name>/Song.abl` — JSON, schema-stamped
(1.8.2 in the donor, 1.8.3 in what Move writes now), undocumented. Four tracks, eight clip
slots each, eight scenes. Move reads the list at boot; each Set's position in it is an
**xattr on the uuid folder**, not anything inside the file:

    user.song-index            the position. A BOUNDED POOL — Move's own errors are "No free
                               song index available" and "Cannot import song, no free song
                               index available", and there are 32 slots. Take the LOWEST FREE
                               one; counting up from the highest walks off the end after a few
                               make-and-delete rounds, and a Set past the end is invisible.
                               Nothing enforces uniqueness, and Move hands out slots too, so
                               read the whole list before claiming one.
    user.last-modified-time    ISO 8601, UTC
    user.local-cloud-state     notSynced
    user.song-color            an int
    user.was-externally-modified  false

Song Mode's running order is Schwung's, not Move's:
`/data/UserData/schwung/set_state/<uuid>/song_mode.json`.

## The two rules Move will not tell you

Move validates a Set on load and refuses the whole file with `Document invariant violation`.
It says that per device, with no line number and no field name, and the UI only says "Unable
to load". Both rules below were found by bisecting a refused Set against the donor — one clip
at a time with `minimize.py`, then one note at a time with `ddnotes.py` — and both are now
gates.

**A clip may not sound one pitch twice at once.** Two notes of the same pitch may not overlap.
They may not even MEET: one ending exactly where the next begins is refused too, and so is the
sliver left behind when you trim an overlap so that it touches. The composer emits both shapes
— a long chord tone rings into a later note of its own pitch, and humanising lands two hits on
one drum pad a few thousandths of a beat apart. **475 of 509 genres produced at least one such
clip**, so before this was known every Set was refused, at every seed, for every genre, with
no clue which of 2,000 notes was at fault. `noOverlaps` keeps the louder of two onsets closer
than 1/32 of a beat and cuts every note to fall silent 1/192 before its own pitch returns;
gate N is what keeps it that way.

**noteNumber must be a whole number.** `cannot convert to i: noteNumber`. Four genres
(dastgah, tasnif, tarab, gamelan) compose in quarter tones, which Move cannot hold at all;
they land on the nearest key, and gamelan becomes a different piece of music for it.

And one rule Move does **not** enforce: `scale`. A Set claiming `"scale": "Nonsense Scale"`
loads perfectly happily, so a wrong name costs the player Move's pad highlighting silently
rather than erroring. The 26 names Move knows are in `MOVE_SCALES`, read out of
`/opt/move/MoveOriginal` with `strings`, and gate S asserts against them because nothing else
will. Stellate's `mixo` is one of thirteen modes mapped onto them; it used to miss a lookup
table that only had `mixolydian`, and 41 genres silently carried the donor's scale instead.

Suspects that turned out innocent, all confirmed fine: swapped-in devices do carry
`lockId`/`lockSeal` (they arrive with the preset), integer velocities, scale names beyond
Major and Minor, clips up to 32 bars, `color: null` on scenes, and schema 1.8.2 in a Set on a
Move that writes 1.8.3.

## Gate 4 — the app answers for itself

`als-gate.js` has to finish at "Gate 4 Live. Paul's machine. Printed by the CLI, never by a
machine here", and it is right to. Move is the one export target where that gate can be
automated. Its `SongRenderer`, over D-Bus, loads a Set before rendering any audio and logs
either `Start rendering song …` or `Couldn't render song: <reason>` — the real loader, a
verdict in about five seconds, no UI, nothing installed, and no way to disturb the Set list:

    tools/move/probe.sh "/path/to/Song.abl"          # -> OK / FAIL <reason>

Two things that bite. `render()` returns a **job id** and `abort(<that id>)` is what frees the
renderer — pass anything else and the next probe times out behind a render that never stopped.
And render to `/data`, never `/tmp`: the rootfs has about 15 MB free and a render is ~19 MB.

`move-gate.js` runs gates 0…D offline and gate 4 against real hardware when a Move answers at
`$MOVE_HOST` (default `ableton@move.local`). With no device it **skips** — never fails, or
`test/all.js` could not carry the row — and prints the skip as a skip, because a Set that
passes every structural gate here was still refused by the device for a reason no structural
gate knew to look for. That is the whole lesson of this slice.

## The tool on the device

`tools/move/schwung/` is a Schwung module: `ui.js` under QuickJS, two `sh` scripts, and the
bundle `build.js` makes with the repo's own esbuild. Pick a genre, pick a seed, press the jog
wheel; Back quits to Move. Nothing restarts — `Browser.refreshCache()` over D-Bus makes Move
re-read its Set list immediately, so the Set is there to turn to. `touch <module>/restart_on_make`
brings back setting `currentSongIndex` and restarting into the song, which costs you Schwung.

Four traps, each of which cost a debugging session:

- **Schwung caches `stellate.mjs`.** It re-reads `ui.js` every time you open a tool, but the
  bundle is an ES import held in the running `shadow_ui` context. Deploying without a restart
  leaves the OLD bundle loaded against the NEW ui.js — which looked like a genre menu where
  every row read `undefined` while songs still got made correctly. `deploy.sh` prints the
  reminder. Checking that the file on disk is right proves nothing; compare `shadow_ui`'s
  start time to the file's mtime.
- **`host_system_cmd` runs as ableton OR as root, depending on the restart.** Move itself is
  root and does not care, but anything a root run leaves behind is unwritable by a later
  ableton run. A root-owned `out/` stops `ui.js` creating its stage directory and every make
  fails with nothing in the Set list to show for it. `make-set.sh` hands the Set, its Song
  Mode state and the module's own scratch back to `ableton:users` whenever it is root.
- **Do not `rm -rf` the module before extracting over it.** That scratch can be root-owned, so
  the `rm` fails as ableton and `&&` aborts the deploy with the module half deleted.
- **Never call `clearAllLEDs()`.** It forces all 128 pad and all 128 button LEDs black and
  Move does not repaint them on exit, so the Set list comes back unlit — still working, but
  showing you nothing. Stellate is jog and knobs only and lights nothing, so it has nothing
  to clean up. The tools that DO light pads (`song-mode`) snapshot first with
  `shadow_get_pad_led_snapshot()`.

If a Set ever does make Move unhappy: `tools/move/rescue.sh` quarantines the Sets this tool
made (their names end ` #<seed>`) and resets `currentSongIndex`, deleting nothing.

## What is measured

- `move-gate.js --sweep --every 1 --seeds 7,42` — **1018 Sets, gates 0…D, no failures.** Takes
  about 16 minutes, which is why `test/all.js` carries a subset and this is the by-hand run.
- **351 Sets accepted by a real Move and none refused**, across genres, seeds and instrument
  choices, through `probe.sh`. Before the two rules above were known, most were refused.
- About **84%** of composed notes survive into the Set. The missing ~9% is not a defect here:
  they are second notes of the same pitch landing within 1/32 of a beat, which Move cannot
  represent, plus the quarter tones. An earlier 93% counted notes that made the Set unloadable.
- 7 of 509 genres are not in 4/4 — 3/4 (waltz), 6/8 (nationalism), 7/8 (bulgarian and two
  more), 7/4 (studioprog). Move takes all of them.

One deliberate asymmetry, so nobody "fixes" it: the Set carries its own time signature, but
**Schwung's Song Mode counts a bar as 4 beats whatever the Set says**
(`barDurationMs = (60000 / tempo) * 4` in its `ui.js`), so `customBars` in `song_mode.json`
stays in 4-beat bars even when the Set is in 3/4. The two bar notions are different on purpose.
