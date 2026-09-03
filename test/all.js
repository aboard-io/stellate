#!/usr/bin/env node
/* test/all.js — ONE RUNNER FOR EVERY GATE BUT THE SOAK, CONCURRENTLY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FAST PATH AND THE COMPLETE PATH, AND THE DIFFERENCE BETWEEN THEM
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node test/all.js              FAST      — every gate, concurrently, with the
 *                                             producer SAMPLED and the option
 *                                             table's derivation CACHED.
 *   node test/all.js --complete   COMPLETE  — every gate, concurrently, every
 *                                             stack, every derivation, nothing
 *                                             cached. THIS IS THE ONE THAT GATES
 *                                             A DEPLOY.
 *   node test/all.js --impacted   only the gates whose dependency closure
 *                                 intersects `git diff` + untracked files.
 *                                 It PRINTS what it skipped and why.
 *   node test/all.js --impacted --changed nukernel/ui/atlas.js
 *                                 …the same, over a diff you name rather than
 *                                 the one on disk. Preview a selection, or take
 *                                 a number for a one-file change.
 *
 * Every run says which mode it was in, on the first line and the last, because
 * the one thing this file must never do is let a sampled pass be mistaken for a
 * complete one. FAST and COMPLETE run the same fifteen gates and assert the
 * same things; what changes is BREADTH (the producer's G3 walks every offered
 * sentence at a ROTATING rung instead of at all five, and draws 20 of its 200
 * random stacks) and whether a derivation whose inputs are byte-identical is
 * re-run. Nothing is skipped, nothing is loosened, no threshold moves.
 *
 * Other flags: `--serial` (one at a time — how the before-numbers below were
 * taken, and the way to read a clean log), `-j N`, `--only NAME`, `--list`,
 * `--page URL` (point at a server you already have instead of standing one up).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE CHANGED, 2026-08-25
 * ─────────────────────────────────────────────────────────────────────────────
 * Paul, told the suite takes fifteen minutes: "why do the tests take so long".
 * Measured on this branch the same night — the whole suite, serially, the way
 * it ran before this file changed (848.5 s wall, 14/14 green, load 1.3 -> 1.9):
 *
 *   producer     392.2s   gates        139.7s   motif-frozen 120.3s
 *   atlas        108.5s   precompose    24.2s   shell         19.7s
 *   selects       13.7s   producer-ui    9.3s   nudges         6.9s
 *   sheets         6.5s   desk           5.0s   ableton        1.7s
 *   atlas-data     0.3s   document       0.3s
 *
 * — and the box has four cores, three of which were idle the whole time. This
 * repo's own law, from main:test/run.js: "a full pass took the better part of an
 * hour, which means in practice nobody runs it and regressions are found by
 * deploying. Nothing here was redundant; it was just queued."
 *
 * WHAT IT COSTS NOW, measured the same night on the same box (which had a
 * neighbouring project's playwright suite on it the whole time — every number
 * here is a CONTENDED number, and the load average is printed on every run for
 * exactly that reason):
 *
 *   before, serial, complete        848.5s     load 1.3 at the start
 *   --complete, concurrent          810.8s     load 7.0
 *   default (FAST), concurrent      456.4s / 520.1s     load 4.6 / 6.7
 *   --impacted, one view file       238.8s / 238.8s     7 of 14 gates run
 *
 * (Those four rows were taken over FOURTEEN gates. `sheets-tier` is the
 * fifteenth, added 2026-08-25 and costing ~5s, so the wall clocks below are
 * comparable and the gate counts in them are not. Fresh numbers are in the
 * gate-keeper round's report for that date.)
 *
 * The honest reading of those four rows: the FAST path is the one that got
 * twice as quick, and most of that is the producer's sample and the option
 * table's cache rather than the forking. `--complete` gains little here,
 * because on a four-core box with 8 GB the two biggest gates cannot overlap
 * without swapping (see the heavy-node note by the scheduler below) — the win
 * that is left is real but it is one gate wide.
 *
 * AND ONE NUMBER IS MISSING ON PURPOSE. The heavy-node rule below was measured
 * INTO existence (688s/310s when the producer and gates-extract shared the box,
 * against 392s/144s alone) but its effect on the `--complete` wall clock was
 * never measured clean: the working tree went red under the measurement at
 * 02:27 that night — an unrelated round converting the page's sheets to menus —
 * and a run whose gates are failing is not a run whose clock means anything.
 * The premise is measured; the payoff is predicted. Re-take it on a green tree
 * before quoting it.
 *
 * NOTHING WAS MADE WEAKER TO GET THE NUMBER DOWN. This repo has a standing law —
 * TEST THE ARTIFACT — earned by three features that shipped broken while every
 * check passed. Speed here comes from four honest places and no others:
 * concurrency, selection, a seeded sample with the full breadth one flag away,
 * and a content-keyed cache over a derivation that cannot have changed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT MAKES CONCURRENCY SAFE HERE, AND IT IS TWO THINGS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. THE SERVER IS THIS RUNNER'S, ON A PORT IT DISCOVERS. Every browser gate
 *    used to default to `http://localhost:8777/nukernel/index.html` and the
 *    runner only checked that SOMETHING was answering there. ./serve.sh sits on
 *    8777 all day, which made the whole suite depend on a process nobody
 *    started deliberately — and a dead server makes playwright report a blank
 *    document, which passes some assertions and fails others in a pattern that
 *    reads exactly like a real regression. So this file stands up its own
 *    static server on port 0, reads back the port the OS gave it, and hands
 *    every gate the URL. Same COOP/COEP headers as serve.sh, because the page
 *    needs cross-origin isolation for the ring engine's SharedArrayBuffer.
 *    `--page` still takes an outside server for the rare time you want one.
 *
 * 2. THE CAP IS CPU-DERIVED AND DELIBERATELY MEAN, and main:test/run.js says
 *    why in words worth repeating: every browser gate drives a real chromium,
 *    some render WebGL through SwiftShader, some boot the audio engine under a
 *    wall-clock watchdog, and "oversubscribe and gates start failing for want
 *    of CPU rather than for cause — which is exactly how a green suite turns
 *    red and teaches everyone to ignore it." On this four-core box that means a
 *    weighted budget: a browser gate costs 2, a node gate costs 1, the budget
 *    is the core count. Two chromiums, never three.
 *
 *    ...AND ONE GATE RUNS ALONE. test/motif-frozen.js presses play, waits for
 *    two real section boundaries against a bar-clock budget, and asserts that
 *    NO long task over 100 ms lands after the first three seconds. Every one of
 *    those is a claim about time, and time is exactly what a busy box takes
 *    away. It is held back and run by itself at the end. It is the only one:
 *    every other gate was read for wall-clock arithmetic and has none —
 *    test/atlas.js's idle check asserts EXACTLY ZERO rAF calls in two seconds,
 *    which a busy box cannot turn into one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SOAK IS DELIBERATELY NOT HERE
 * ─────────────────────────────────────────────────────────────────────────────
 * (Paul, 2026-08-25: "Don't do the soak.") test/soak-nukernel.js is twelve
 * minutes with two busy cores spawned against it — three times this whole
 * suite's fast path — and it is a different question: not "is the page right"
 * but "does it survive an afternoon". It is in no default set of any runner,
 * including --complete, and it stays its own command:
 *
 *     node test/soak-nukernel.js --mins 12 --load 2
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO THINGS THIS FILE KNOWS THAT A SHELL SCRIPT WOULD NOT (unchanged)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. THE BROWSER GATES NEED THE BORROWED PLAYWRIGHT. There is no node_modules
 *    in this repo and none may be added (THE OFFLINE LAW), so every browser gate
 *    is spawned with NODE_PATH=/home/ford/ftrain-2025/node_modules. Running
 *    `node test/shell.js` bare fails with MODULE_NOT_FOUND and looks like a
 *    broken gate; it is a missing environment variable.
 * 2. A GATE THAT HAS NOT BEEN BUILT YET IS NOT A FAILURE. Missing files print
 *    `skip` and the summary names them. Anything that RUNS and exits non-zero
 *    is a failure and takes the runner down with it.
 */
"use strict";
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const { closureFor, changedFiles } = require("./closure.js");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ONLY = arg("--only", null);
const LIST = argv.includes("--list");
const COMPLETE = argv.includes("--complete");
const IMPACTED = argv.includes("--impacted");
const SERIAL = argv.includes("--serial");
const PW = "/home/ford/ftrain-2025/node_modules";
const PAGE_ARG = arg("--page", null);
/* PRETEND EXACTLY THESE FILES CHANGED. `--changed nukernel/ui/atlas.js` answers
   "what would a one-file change run?" without staging anything, which is how
   the numbers in this header were taken and how you check the selection before
   trusting it. It is also the CI shape: `--changed "$(git diff --name-only
   origin/main | tr '\n' ,)"`. With no flag the real working tree is read. */
const CHANGED_ARG = arg("--changed", null);
const DUR = path.join(__dirname, ".cache", "durations.json");

/* A BROWSER GATE COSTS TWO AND A NODE GATE COSTS ONE, out of the core count.
   Two chromiums on four cores; see the header. `-j` overrides the budget. */
const CORES = Math.max(2, os.cpus().length);
const BUDGET = SERIAL ? 1 : Math.max(2, +arg("-j", CORES) || CORES);

/* THE GATES. `covers` is the ENTRY POINT of the dependency closure, not a list
   of files — test/closure.js derives the list by reading it. A browser gate
   covers its own source AND the page it drives, because what test/atlas.js
   actually exercises is whatever nukernel/index.html loads. */
const GATES = [
  { name: "document",   wave: 1, kind: "node",
    argv: ["test/document.test.js"],
    need: ["test/document.test.js"], covers: ["test/document.test.js"] },
  /* WHO IS IN THE ROOM (2026-08-30, "make sure that voices are there, not
     misplaced, and appropriate to region and era, and that vocals aren't
     there when they're supposed to be instrumentals"). Five laws over every
     anchor x seeds 1..3, all derived from tables the tree already owns —
     the day it landed it convicted a lead singer on a Paleolithic bone
     flute and 582 chairs captioned "voice" while holding a guitar. */
  /* THE GENRE AS SENTENCES (2026-09-01). Paul: "The genre data is expressed
     as logical sentences and rules derived from the data in the genre. They
     should be readable to a musician." Wave 1 and `kind: "node"` because it is
     the data tier and nothing else: 38 rules x 396 anchors, every sentence
     non-empty, every option word walked back to the table that owns it, and
     the two properties every edit stands on — it re-derives deterministically
     and `GENRES` is byte-unchanged after. `covers` names the three files an
     edit to any of them has to re-run this on. */
  { name: "rules", wave: 1, kind: "node",
    argv: ["test/rules.test.js"],
    need: ["test/rules.test.js"],
    covers: ["test/rules.test.js", "nukernel/rules.js", "nukernel/precompose.js",
             "nukernel/genres.js"] },
  /* THE INVERSION (2026-09-02). Paul: "Are you sure we shouldn't move
     everything including the closures into sqlite and go the other direction —
     manage the data as data and then export it as JSON or even JS for operation
     and distribution?" nukernel/genres.js is now GENERATED from 421 row files
     under nukernel/genres/ plus nukernel/genres-tables.js. Wave 1 and
     `kind: "node"` for the same reason `rules` is: it is the data tier and
     nothing else. It holds the shipped bytes to a fresh build (the gates.js /
     wiki.js precedent), validates every row against the grammar, and calls
     every closure template over v 0..8 x s 0..7 against the closure the box
     actually loaded — 121,248 calls, with `word`'s operators APPLIED rather
     than counted. `covers` names everything an edit has to re-run this on. */
  { name: "genres-build", wave: 1, kind: "node",
    argv: ["test/genres-build.test.js"],
    need: ["test/genres-build.test.js", "tools/genres/build.js",
           "tools/genres/emit.js", "tools/genres/grammar.js"],
    covers: ["test/genres-build.test.js", "tools/genres/build.js",
             "tools/genres/emit.js", "tools/genres/grammar.js",
             "nukernel/genres-tables.js", "nukernel/genres.js",
             "nukernel/GENRES.md"] },
  { name: "instrumentation", wave: 1, kind: "node",
    argv: ["test/instrumentation.test.js"],
    need: ["test/instrumentation.test.js"], covers: ["test/instrumentation.test.js"] },
  { name: "desk",       wave: 2, kind: "node",
    argv: ["nukernel/desk-gate.js"],
    need: ["nukernel/desk-gate.js"], covers: ["nukernel/desk-gate.js"] },
  { name: "precompose", wave: 2, kind: "node",
    argv: ["test/precompose.test.js"],
    need: ["test/precompose.test.js"], covers: ["test/precompose.test.js"] },
  /* THE GENRE'S OWN BASS RHYTHM (2026-09-01). Twenty-two anchors write their
     bass line out step by step — the habanera under `tango`, the off-beat
     under `reggae`, the clave under `hambone` — and `kernel.js` ranked
     `bassGrid` LAST of four, under a density word and under the MELODY's
     accents, so nineteen of them reached no note. Registered because this is
     the third time a field has been found declared-and-never-arriving here
     (`inv`, the hand, this) and the gate reads the NOTES, not the
     precedence. */
  { name: "bass-grid", wave: 2, kind: "node",
    argv: ["test/bass-grid.test.js"],
    need: ["test/bass-grid.test.js"], covers: ["test/bass-grid.test.js"] },
  /* NO TWO RECORDS SHARE A SOLO BY DEFAULT (2026-09-01, "Art rock has the
     same solo as iranian pop on seed 19"): the climb slot's triple pin gave
     390 records 32 solos; the widen gave them 212. This gate keeps the space
     from quietly re-collapsing. */
  { name: "solo-space", wave: 2, kind: "node",
    argv: ["test/solo-space.test.js"],
    need: ["test/solo-space.test.js"], covers: ["test/solo-space.test.js"] },
  /* NOT ONE BYTE OF FILM UNTIL THE TAB IS OPENED (2026-09-01). Paul: "Don't
     download video until I go to the video tab." Measured, the page already
     did — so this gate converts an accident into a law: the clips are
     0.4-3.7 MB each and nothing anywhere STATED that they must not be
     preloaded, precached or warmed onto the offline hold. */
  { name: "video-lazy", wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/video-lazy.js"], need: ["test/video-lazy.js"],
    covers: ["test/video-lazy.js", "nukernel/ui/video.js",
             "nukernel/ui/video-clips.js"] },
  /* THE SAME LAW FOR THE SKY (2026-09-01, "Bring back the screensaver"):
     zero rAF and zero bytes until the Screensaver tab opens; the counter
     freezes when you leave and revives when you return. Currency is FRAMES
     where video-lazy's is requests, because the saver owns no media.

     2026-09-02 — AND THE SAVER OWNS 860 KB OF MODULE NOW. Paul: "It should be
     the little aliens dancing, not the infinite wandering", and "Why not three
     js? It's fine. Don't reinvent." The star field became the starcruise
     creatures, so the currency is frames AND requests: the gate counts every
     request the tab makes and sanctions only the local module files. The
     `covers` list grows with them, because test/impacted.js selects by this
     closure and a creature module that is not named here would change with
     nobody watching. */
  { name: "screensaver-lazy", wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/screensaver-lazy.js"], need: ["test/screensaver-lazy.js"],
    covers: ["test/screensaver-lazy.js", "nukernel/ui/screensaver.js",
             "nukernel/ui/starcruise/alien.js", "nukernel/ui/starcruise/traits.js",
             "nukernel/ui/starcruise/geom.js", "nukernel/ui/starcruise/from-doc.js",
             "vendor/three/three.module.min.js", "vendor/three/MarchingCubes.js"] },
  /* THE HAND PROBE (2026-08-30, "shouldn't more genres be humanized"): who is
     humanized, who is exempt, proven at the rendered events. Holds genres.js
     §39 (every anchor resolves a DYNAMICS row or a dated null), the machine
     exemption by byte-comparison, the precedence order, and that the hand
     ARRIVES on the document path — the round found it declared and never
     arriving there (precompose.js:2417's `|| 0`). */
  /* EVERY KNOB NAMED VOLUME, DRAGGED FOR REAL (2026-08-30, the census after
     Paul's "The volume slider no longer works at all"). V1-V7 drag each level
     control with CDP touches and assert at the ANALYSER — including V7, an
     iPhone-shaped run (element.volume stubbed read-only-1, media route) that
     holds the v200 baked-mvol fix. Registered because a gate nobody runs is
     not a gate, and this one exists precisely because "writes the store" wore
     a green checkmark for a month while a phone played at full level. */
  { name: "vol-reach", wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/vol-reach.browser.js"], need: ["test/vol-reach.browser.js"],
    covers: ["test/vol-reach.browser.js", "nukernel/audio/live.js",
             "nukernel/audio/desk.js"] },
  { name: "hand", wave: 2, kind: "node",
    argv: ["test/hand.test.js"],
    need: ["test/hand.test.js"], covers: ["test/hand.test.js"] },
  /* THE PITCH WALL (2026-08-30, "deal with those in the engine"): cents and
     non-2:1 scale periods, proven on rendered samples — a +50c note's FFT
     peak at 452.89 Hz, an 11.8-semitone period closing at 1180c not 1200c,
     and the absent-is-today no-cents-key claim for every integer record. */
  { name: "pitch-wall", wave: 2, kind: "node",
    argv: ["test/pitch-wall.test.js"],
    need: ["test/pitch-wall.test.js"], covers: ["test/pitch-wall.test.js"] },
  /* THE EXPORTED TEMPO MAP (2026-08-30, the five-walls follow-up): a paced
     record's .mid carries set-tempo metas at the section doors and a metered
     record says 3/4 or 6/8 outright; the .als writes the same map into the
     donor's OWN tempo-envelope shape. Parsed back off the bytes; unpaced
     records proven untouched (the byte pin vs v199 ran at land time). */
  { name: "smf-tempo", wave: 2, kind: "node",
    argv: ["test/smf-tempo.test.js"],
    need: ["test/smf-tempo.test.js"], covers: ["test/smf-tempo.test.js"] },
  /* THE DYNAMICS ON THE PAPER (2026-08-30, "crescendos and decrescendos and
     ppp to fff markings in the score"): the dealt lvl/env words drawn as
     dynamic marks and hairpins on the engraved score, and the lvl half —
     which the velocities never carried — as CC11 in the .mid. Read off the
     ABC string AND the rendered SVG (abcjs drops unknown decorations
     silently), with the strip-the-ink byte-equivalence claim on a worded
     record and the no-words-no-marks claim on the shipped chant. */
  { name: "dynamics", wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/dynamics.test.js"],
    need: ["test/dynamics.test.js"], covers: ["test/dynamics.test.js"] },
  /* THE BAND HIRED FOR THE RECORD (2026-08-28, "Fix the pool thing too"). Two
     gates and not one, because the pool's two failures are two KINDS of
     failure: what a chair may be handed and what a save carries are
     arithmetic, and whether a band follows you to the next record — and
     whether the bass reaches the engine at all — are facts about the running
     page that no node assertion can reach. The browser half also carries the
     harness lie that faked this bug report once (a same-document `goto` to a
     `#at=` fragment reloads nothing), written down in its header. */
  { name: "pool",       wave: 2, kind: "node",
    argv: ["test/pool.test.js"],
    need: ["test/pool.test.js"], covers: ["test/pool.test.js"] },
  { name: "pool-ui",    wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/pool.browser.js"], need: ["test/pool.browser.js"],
    covers: ["test/pool.browser.js"] },
  /* DOES PRESSING REWRITE CHANGE THE TUNE? (2026-08-27). Paul, on staging:
     "No matter how many times I hit REWRITE the hook is the same on Iranian
     pop." Measured, it was the whole catalog: 0 of 191 anchors changed their
     hook's rhythm or its degrees at any seed, because the seed died in the
     arranger and `cellOf` never took one. This gate is the ear's question in
     numbers and it reads the DOCUMENT's own `play` and `deg` rows — ten
     rewrites of iranpop, the catalog fractions, the determinism law on the
     serialized record, the IDIOM_ANCHOR pins, and a saved record that must
     not move. Next to `precompose` because they share the file. ~4 s, pure
     node. */
  { name: "hook",       wave: 2, kind: "node",
    argv: ["test/hook.test.js"],
    need: ["test/hook.test.js"], covers: ["test/hook.test.js"] },
  /* THE SEND A CHANNEL STRIP USED TO SWALLOW. Next to `desk` on purpose: G8b
     renders a strip's audio through the same shipped renderUnitWindow and
     stayed green for the whole life of the pp defect, because its fixture feeds
     `curPP: 0`. This one turns the throw on, and it holds BOTH renderers to the
     same answer — the two files must be fixed together or press parity goes.
     ~0.3 s, pure node, no faustwasm (stub procs, the desk-gate trick). */
  { name: "pp-send",    wave: 2, kind: "node",
    argv: ["test/pp-send.test.js"],
    need: ["test/pp-send.test.js"], covers: ["test/pp-send.test.js"] },
  /* THE THREE REACH FIXES OF PHASE 0, RENDERED (2026-08-27). The per-channel
     fader/mute/solo on a MODELLED voice measured as RMS through the shipped
     renderUnitWindow/mixPCM (it moved 0.00 dB before the fix); the echo bus
     `ret` knob through the REAL fx_bus WASM (absent byte-identical to the old
     literal dgain 1); levelOf() against its four historical scalings. ~2 s,
     node + faustwasm offline. */
  { name: "tape-reach", wave: 2, kind: "node",
    argv: ["test/tape-reach.test.js"],
    need: ["test/tape-reach.test.js"], covers: ["test/tape-reach.test.js"] },
  /* THE BREATH AFTER THE VOWEL (2026-08-27). Paul, on staging: "All the songs
     in Asia and so forth have really heavy breathing in 1971 ... just two heavy
     breaths dominating every measure." voice_tract.lib's aspirate rode the gate
     SHUTTING as well as opening, so every note-off turned its release into a
     full-level exhale. The gate is the module invariant — a note's release must
     not be brighter above 4 kHz than the note — measured on the shipped WASM at
     the params sixteen singing anchors actually send. ~7 s, node + faustwasm. */
  { name: "breath",     wave: 2, kind: "node",
    argv: ["test/breath.test.js"],
    need: ["test/breath.test.js"], covers: ["test/breath.test.js"] },
  /* THE CLICK, THE OVERLAP AND THE SIBILANCE (2026-09-02). Paul, on the
     deployed composer: "There's a lot of click when they 'talk' though and
     overlap and we should smooth that. It's okay to have a continuous tone
     instead of sibilance … I wouldn't mind the voice having a tiny bit more
     grit and vocal resonance starting with his." Four defects, measured
     before and after and held down here: `voxEnv` was `en.asr`, which zeroes
     itself on a rising gate and so deleted 9.2 dB of a sounding note every
     time one retriggered; the `singer` unit carried the role pool, so two
     overlapping vocal notes were two throats; the tract devoiced outright on
     its fricatives; and `voxGrit` is the grit and the formant resonance he
     asked for. V1/V2 are module invariants on the shipped WASM, V3-V6 render
     two records' vocal chairs alone through the real path. ~9 s.
     `covers` names the four engine files whose numbers this gate holds. */
  { name: "voice-smooth", wave: 2, kind: "node",
    argv: ["test/voice-smooth.test.js"],
    need: ["test/voice-smooth.test.js"],
    covers: ["test/voice-smooth.test.js", "engine/faust/dsp/voice_tract.lib",
             "engine/faust/dsp/tract_voice.dsp", "engine/faust/dsp/voice_lead.dsp",
             "engine/faust/dsp/tract.lib"] },
  /* THE OPTION TABLE, THROUGH THE CACHE. test/gates-cache.js runs
     `nukernel/gates-extract.js --check` unless every file the derivation reads
     is byte-identical to the tree that last passed it — content-keyed, never
     mtime — and --complete passes --force so the complete pass never trusts it.
     The argument in full is that file's header. */
  /* THE WIKI TABLE, RE-DERIVED. `nukernel/wiki-extract.js --check` asks the
     local ZIM every one of the 191 titles again and diffs nukernel/wiki.js and
     nukernel/WIKI.md against what came back — the same shape as `gates`, one
     widget over: derive it, commit the derivation, and fail when the two
     disagree. IT EXITS 2 WHEN KIWIX IS NOT ON THE BOX (see `skipExit` in the
     runner below), which is not a failure. */
  { name: "wiki",       wave: 1, kind: "node",
    argv: ["nukernel/wiki-extract.js", "--check"], skipExit: 2,
    need: ["nukernel/wiki-extract.js", "nukernel/wiki.js"],
    covers: ["nukernel/wiki-extract.js", "nukernel/wiki.js", "nukernel/WIKI.md"] },
  { name: "gates",      wave: 2, kind: "node",
    argv: ["test/gates-cache.js"], complete: ["test/gates-cache.js", "--force"],
    need: ["nukernel/gates-extract.js", "nukernel/gates.js", "test/gates-cache.js"],
    covers: ["nukernel/gates-extract.js", "nukernel/gates.js", "nukernel/gates.json",
             "test/gates-cache.js"] },
  // ABLETON IS TWO COMMANDS AND ONE GATE. The export writes the .als the gate
  // then reads; if the export fails there is nothing to check, so they are one
  // row and the first non-zero exit is the row's verdict.
  // ...and the .als goes to a per-run path now, because two runners in the same
  // minute writing /tmp/n.als was one gate reading the other's export.
  /* THE .als BUTTON, IN THE PAGE (2026-08-29). Paul: "Make it in page" and
     then "Why is any of it on the server just make it all browser" — so the
     donor is EMBEDDED (nukernel/export/donor.js, derived from the committed
     .als by donor-extract.js) and the export fetches nothing. This gate drives
     the real card, un-gzips what the browser handed over, and diffs the
     DECOMPRESSED XML byte-for-byte against the CLI's for the same record; it
     also deletes window.CompressionStream and re-clicks, so the refusal path
     is measured rather than read. Registered here because a gate nobody runs
     is not a gate — the browser tier is where it belongs, beside pool-ui. */
  { name: "als-page",   wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/als-page.browser.js"], need: ["test/als-page.browser.js"],
    covers: ["test/als-page.browser.js", "nukernel/export/als-page.js",
             "nukernel/export/als.js", "nukernel/export/donor.js",
             "nukernel/export/donor-extract.js", "nukernel/export/score.js"] },
  { name: "ableton",    wave: 2, kind: "node", steps: [
      ["tools/ableton/export-als.js", "--genre", "boombap", "--out", "@TMP@/n.als"],
      ["tools/ableton/als-gate.js", "@TMP@/n.als", "--genre", "boombap"]],
    need: ["tools/ableton/export-als.js", "tools/ableton/als-gate.js"],
    covers: ["tools/ableton/export-als.js", "tools/ableton/als-gate.js"] },
  /* THE PRODUCER, SAMPLED BY DEFAULT AND WHOLE ON --complete, and it is G3 and
     only G3 that samples. Measured inside the gate: 60% of its 392 s was the
     full cross product of every offered sentence against all five rungs of the
     ladder, on two big records. Fast mode rotates — sentence i at rung i % 5,
     so every sentence is still said and every rung still climbed — and draws
     20 of the 200 random stacks. --complete walks the whole product. The gate
     prints which it did on its own verdict line, every time; see its note over
     G3 for the argument in full. */
  { name: "producer",   wave: 3, kind: "node",
    argv: ["test/producer-eight.test.js"],
    complete: ["test/producer-eight.test.js", "--full"],
    need: ["test/producer-eight.test.js"], covers: ["test/producer-eight.test.js"] },
  { name: "atlas-data", wave: 3, kind: "node",
    argv: ["nukernel/atlas.gate.js"],
    need: ["nukernel/atlas.gate.js"], covers: ["nukernel/atlas.gate.js"] },

  { name: "shell",      wave: 2, kind: "browser", url: { env: "SHELL_URL" },
    argv: ["test/shell.js"],  need: ["test/shell.js"], covers: ["test/shell.js"] },
  { name: "sheets",     wave: 2, kind: "browser", url: { flag: "--page" },
    argv: ["test/sheets.js"], need: ["test/sheets.js"], covers: ["test/sheets.js"] },
  /* THE SAME FILE, AIMED AT THE SHEETS TIER'S OWN PAGE, AND IT IS NEW TODAY
     BECAUSE THE SHIPPED PAGE STOPPED ANSWERING SOME OF ITS QUESTIONS.
     `test/sheets.js` holds two kinds of claim: what ui/sheets.js DRAWS (a
     legend, a roving-tabindex radio group where ArrowDown moves the value and
     the focus key, no silent grey) and what nukernel/index.html CHOOSES to
     draw with it. Paul, 2026-08-25: *"There are still many boxes that should be
     selects"* — and after that conversion the shipped page's only remaining
     `.nu-sheet` is the engineer's `<select multiple>` fx chips. There is no
     radio-group sheet left on it at all, so run against index.html alone the
     traversal assertion had nothing to stand on and would have skipped for
     ever, which is a claim nobody is making.

     test/fixtures/sheets-harness.html imports ui/sheets.js directly over the
     same avail.js and the same shipped record and draws thirty of them, so the
     tier keeps being gated on its own page while index.html is gated on its
     own choices. The file already knew the difference — `const REAL` at
     sheets.js:33 — and every claim in it is now marked with which page owns
     it. Measured 2026-08-25: 28 checks on index.html, 29 on the harness,
     ~6s each. */
  { name: "sheets-tier", wave: 2, kind: "browser",
    url: { flag: "--page", path: "test/fixtures/sheets-harness.html" },
    argv: ["test/sheets.js"],
    need: ["test/sheets.js", "test/fixtures/sheets-harness.html"],
    // BOTH entry points: the fixture page (so a change to the harness selects
    // this gate and not the other one) and the gate's own source (so an edit
    // to test/sheets.js selects BOTH, which is the only way the pair stays
    // honest — a claim moved from the shipped page to the tier is one edit in
    // one file that changes what two runs assert).
    covers: ["test/fixtures/sheets-harness.html", "test/sheets.js"] },
  // THE OTHER HALF OF `sheets`, AND THEY ONLY MEAN ANYTHING TOGETHER. Paul
  // asked for some controls back as menus on the evening of 2026-08-24 ("We can
  // return some things to select menus … in general where there is ONE option a
  // dropdown is preferred"), which makes the page two widgets and this runner's
  // question two questions: is a settled parameter a menu, and is a development
  // word still a lit sheet. Next to `sheets` on purpose — a slice that converts
  // one control too many turns one of the pair red either way.
  /* THE VOICE'S OWN KNOBS, THE TAKE AND THE TEMPO ROW (VOICE.md §10). One gate
     for three features because all three share one predicate — a control on
     this page moves something the engine reads — and because they share a
     browser: standing up a second chromium to press a tempo icon costs more
     than the whole gate does. Half of it is pure node (the table against the
     engine, `--check`, the vowel round-trip through the swapped formant rows)
     and half drives the rendered page at 390 and at 1280. */
  { name: "knobs",      wave: 2, kind: "browser", url: { flag: "--page" },
    argv: ["test/knobs.js"],
    need: ["test/knobs.js", "nukernel/knobs.js", "nukernel/knobs-extract.js"],
    covers: ["test/knobs.js", "nukernel/knobs.js", "nukernel/knobs-extract.js"] },
  { name: "selects",    wave: 2, kind: "browser", url: { flag: "--page" },
    argv: ["test/selects.js"], need: ["test/selects.js"], covers: ["test/selects.js"] },
  /* THE TEMPO AND KEY EDITORS (2026-09-02, the composer round, slice 2a).
     Paul, B7: "Tap tempo, the tempo editor appears, same for key. The tempo
     editor does not reflect the richness of our tempo options. Key may not
     either." Five facts that reached the sound and had no control — the
     groove, the per-section pace, the length of the chord cycle, a tap tempo
     that did not exist anywhere in the tree, and a circle of fifths that
     silently retuned a microtonal record — driven on the rendered page.
     `covers` names the three files the round changed to land them, so
     test/impacted.js selects this gate when any of them moves: the panels
     (ui/eight.js), the two new sheets (avail.js) and the `form.pace` registry
     row that generates the third (fields.js). It stands up its own COOP/COEP
     server and also honours an injected --page. */
  { name: "tempo-key",  wave: 2, kind: "browser", url: { flag: "--page" },
    argv: ["test/tempo-key.browser.js"], need: ["test/tempo-key.browser.js"],
    covers: ["test/tempo-key.browser.js", "nukernel/ui/eight.js",
             "nukernel/avail.js", "nukernel/fields.js"] },
  { name: "nudges",     wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/nudges.js"], need: ["test/nudges.js"], covers: ["test/nudges.js"] },
  { name: "atlas",      wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/atlas.js"],  need: ["test/atlas.js"], covers: ["test/atlas.js"] },
  /* THE PER-VOICE METER AND THE SOUNDING FEED (2026-09-01, the composer
     round). Paul, of the Mix deck: "Light up which instrument is playing,
     make a little volume meter INSIDE the heading." The page had REFUSED that
     meter in writing (engineer.js METER_WHY, "a green bar here would be a
     fake measurement") because no per-voice signal existed; this round gave
     samplerOf a per-unit AnalyserNode and the transport two pure readers
     (soundingChans / voiceLevels) joined through plan.js addrOf. Both halves
     are WebAudio under a running transport, so no node assertion can reach
     them — this reads the two __nu* probes off the live page with the record
     actually sounding. It stands up its own COOP/COEP server and also honours
     an injected --page. */
  { name: "meter-reach", wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/meter-reach.browser.js"], need: ["test/meter-reach.browser.js"],
    covers: ["test/meter-reach.browser.js", "engine/faust/live/live.js",
             "nukernel/audio/live.js", "nukernel/audio/plan.js"] },

  /* ===== THE FOURTEEN THAT WERE NEVER REGISTERED (2026-08-30) ==============
     Audited after a day that added ~25 commits: fourteen gate files existed
     in test/ and NOT ONE was in this table — deck (the press's own
     byte-determinism), erhu, gutter, mp3, chorus, loop-reach, loop-words,
     pace-meter, sfx-shelf, series-bus, bench, text-diet, loopstrip and
     grain-reach. Several were written TODAY by rounds that reported "green"
     and moved on; a gate nobody runs is not a gate, and the runner is what
     "runs" means on this tree. They are registered by hand ONCE, here, and
     the closure walker (test/closure.js) picks up their coverage from now on.
     WAVE AND KIND: the browser-shaped ones stand up their own COOP/COEP
     server (gutter.js's header documents the pattern) and ignore an injected
     --page, so they are declared `browser` for the BUDGET — a browser gate
     costs 2 slots against a node gate's 1, and calling a chromium-spawning
     gate `node` is how four cores get oversubscribed — and given no `url`,
     which the runner already treats as "this gate finds its own page".
     ===================================================================== */
  { name: "deck",       wave: 3, kind: "browser",
    argv: ["test/deck.test.js"], need: ["test/deck.test.js"],
    covers: ["test/deck.test.js", "nukernel/export/wav.js",
             "nukernel/export/score.js", "engine/faust/live/stream-renderer.js"] },
  { name: "gutter",     wave: 3, kind: "browser",
    argv: ["test/gutter.js"], need: ["test/gutter.js"],
    /* (`nukernel/ui/explain.js` STOOD IN THIS LIST until 2026-09-02. Paul,
       wave 4: *"Get rid of explain — that's the genre editor's work now."* The
       file is deleted, and a `covers` naming a path that does not exist makes
       `test/impacted.js` select nothing when the gutter's own code moves.) */
    covers: ["test/gutter.js"] },
  { name: "chorus",     wave: 3, kind: "browser",
    argv: ["test/chorus.js"], need: ["test/chorus.js"],
    covers: ["test/chorus.js", "nukernel/instruments.js"] },
  { name: "mp3",        wave: 3, kind: "browser",
    argv: ["test/mp3.test.js"], need: ["test/mp3.test.js"],
    covers: ["test/mp3.test.js", "nukernel/export/mp3.js",
             "nukernel/export/mp3-encode-worker.js"] },
  { name: "loopstrip",  wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/loopstrip.browser.js"], need: ["test/loopstrip.browser.js"],
    covers: ["test/loopstrip.browser.js"] },
  { name: "erhu",       wave: 2, kind: "node",
    argv: ["test/erhu.test.js"], need: ["test/erhu.test.js"],
    covers: ["test/erhu.test.js", "engine/faust/dsp/erhu.dsp"] },
  // the overdrive guitar's own route — audio/to-engine.js ID_ROUTE and the
  // desk arm that adds its send. `covers` names both owners, so an edit to
  // either selects this gate in an impacted run.
  { name: "od-route",   wave: 2, kind: "node",
    argv: ["test/od-route.test.js"], need: ["test/od-route.test.js"],
    covers: ["test/od-route.test.js", "nukernel/audio/to-engine.js",
             "nukernel/audio/desk.js"] },
  { name: "sfx-shelf",  wave: 2, kind: "node",
    argv: ["test/sfx-shelf.test.js"], need: ["test/sfx-shelf.test.js"],
    covers: ["test/sfx-shelf.test.js", "engine/registry-data.js"] },
  { name: "loop-reach", wave: 2, kind: "node",
    argv: ["test/loop-reach.test.js"], need: ["test/loop-reach.test.js"],
    covers: ["test/loop-reach.test.js", "engine/faust/voices/sampler.js"] },
  { name: "loop-words", wave: 2, kind: "node",
    argv: ["test/loop-words.test.js"], need: ["test/loop-words.test.js"],
    covers: ["test/loop-words.test.js"] },
  { name: "pace-meter", wave: 2, kind: "node",
    argv: ["test/pace-meter.test.js"], need: ["test/pace-meter.test.js"],
    covers: ["test/pace-meter.test.js"] },
  /* ...AND THE FIFTEENTH, REGISTERED 2026-09-02. The block above names
     `grain-reach` in its own list of the fourteen and then does not carry a
     row for it — so the one gate that proves vinyl crackle reaches the sound
     ("Does anything have found audio, samples, and vinyl crackle? Nothing
     seems to. Portishead sure should.") has been unrun since the day it was
     written, which is the very failure that block exists to have fixed. It
     renders the shipped fx_bus WASM, so `covers` names that module's source
     beside the gate. ~1 s. */
  { name: "grain-reach", wave: 2, kind: "node",
    argv: ["test/grain-reach.test.js"], need: ["test/grain-reach.test.js"],
    covers: ["test/grain-reach.test.js", "engine/faust/dsp/fx_bus.dsp"] },
  { name: "series-bus", wave: 2, kind: "node",
    argv: ["test/series-bus.test.js"], need: ["test/series-bus.test.js"],
    covers: ["test/series-bus.test.js"] },
  /* TWO ROWS THAT SAID `node` AND SPAWN CHROMIUM (fixed 2026-09-02). Both were
     registered by hand with the batch above and both were mis-declared: they
     `chromium.launch()` like every browser gate, and neither was given a `url`,
     so on a bare `--only bench` / `--only text-diet` the runner stood up no
     server and the gate walked into whatever happened to be on :8777 — the dev
     server if `./serve.sh` was up, nothing at all if it was not. Two costs,
     both real: a browser gate charges 2 slots against a node gate's 1, so
     calling one `node` is how four cores get oversubscribed (the comment on the
     batch above says exactly this); and a gate aimed at a page nobody served is
     a gate that reports on somebody else's tree.
     `bench` reads `MOTIF_URL` and `text-diet` reads `PAGE`, so each takes the
     `url: { env }` shape `shell` already uses rather than the `--page` flag the
     others take. COMPOSER.md §4 assigns this fix to wave 1a; it is done here
     because this round had to run both gates and could not run them honestly
     otherwise. Said out loud so 1a finds it done rather than doing it twice. */
  { name: "bench",      wave: 2, kind: "browser", url: { env: "MOTIF_URL" },
    argv: ["test/bench.test.js"], need: ["test/bench.test.js"],
    covers: ["test/bench.test.js"] },
  { name: "text-diet",  wave: 2, kind: "browser", url: { env: "PAGE" },
    argv: ["test/text-diet.test.js"], need: ["test/text-diet.test.js"],
    covers: ["test/text-diet.test.js"] },
  /* ===== THREE NEW GATES, 2026-09-02 (the composer round, wave 1a) ========
     The gutter became a TREE, the boot draws a SEED, and the catalogue gained
     a BLANK STATE. Each of those is a claim about the rendered page that no
     existing gate could make, and each is the artifact-proof of one of Paul's
     sentences — so each gets a gate rather than a clause bolted onto one that
     is about something else. All three stand up their own COOP/COEP server
     (test/gutter.js's header documents the pattern) and also honour an
     injected `--page`, so they run under the runner and by hand. */
  { name: "nav-tree",   wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/nav-tree.js"], need: ["test/nav-tree.js"],
    covers: ["test/nav-tree.js", "nukernel/ui/glyph.js"] },
  { name: "seed",       wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/seed.js"], need: ["test/seed.js"],
    covers: ["test/seed.js", "nukernel/ui/atlas.js"] },
  { name: "silence",    wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/silence.js"], need: ["test/silence.js"],
    covers: ["test/silence.js", "nukernel/genres.js", "nukernel/precompose.js"] },
  { name: "producer-ui", wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/producer.browser.js"], need: ["test/producer.browser.js"],
    covers: ["test/producer.browser.js"] },
  /* THE GENRE EDITOR, DRIVEN (2026-09-02, the composer round, slice 2b).
     Paul, B6: "The genre data is expressed as logical sentences and rules
     derived from the data in the genre… You can edit them, add new rules from
     a palette, and set thresholds." The `rules` gate above holds the DATA half
     — thirty-eight rules over every anchor — and cannot reach the half Paul
     asked for: a hand moving a sentence on a rendered page and the record
     changing under it. This drives the panel through the three tiers (a
     compose-tier threshold recomposes at the address's reading, a render-tier
     rule reaches the COMPILED genre with no new record, a reset puts the
     anchor back), the palette and its greying, and re-reads the whole
     catalogue afterwards to prove `applyRules` copied.
     `covers` names the four files an edit to any of them has to re-run this
     on: the view, the data table, the page that mounts it, and the read half
     the name plate's lineage comes out of. */
  { name: "rules-view", wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/rules-view.browser.js"], need: ["test/rules-view.browser.js"],
    covers: ["test/rules-view.browser.js", "nukernel/ui/rules.js",
             "nukernel/rules.js", "nukernel/ui/eight.js", "nukernel/ui/xtab.js"] },
  /* BUILD THE BAND, DRIVEN (2026-09-02, the composer round, slice 2c).
     Paul, B10: "List all the band members as separate boxes. I need an obvious
     way to assign multiple motifs to band members. Maybe a tray of motifs that
     pops up, but it should also give me the option to make a new motif and jump
     back the motif editor." Nothing existing could reach any of it: `sheets`
     and `selects` survey the CONTROLS a voice's facets draw, `bench` drives the
     motif editor, and none of them presses a chip, hires a player from the
     panel, renames a cell or asks what the ENGINE was handed for the bass.
     This drives the whole gesture — roster → hire → assign → mint → rename →
     the bass's instrument — and reads the answer back off the document, off
     the stripe and off `__nuMix()`.
     `covers` names the four files an edit to any of them has to re-run this on:
     the page, the offer table (the tray writes through `cast.material` and
     `material.cell`), the record's own rename door and its `toGenre` bass wire,
     and the plan that seats the bass. */
  { name: "band",       wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/band.browser.js"], need: ["test/band.browser.js"],
    covers: ["test/band.browser.js", "nukernel/ui/eight.js",
             "nukernel/avail.js", "nukernel/document.js",
             "nukernel/ui/preview.js", "nukernel/audio/plan.js"] },
  /* THE SAMPLE CRATE, DRIVEN (2026-09-03). Paul, 2026-09-01: "I can't really
     access or organize samples used in, say, San Francisco 1996. They aren't
     accessible to the app in any way." Nothing existing could reach any of it:
     `band` drives the roster and the motif tray, `loopstrip` drags the two
     handles on ONE chair's zone, and neither of them asks what FILES a record
     is made of — which is the whole question. This drives San Francisco 1996
     (the crate-heaviest room in the catalogue: an electric piano, a string
     section, a twelve-break collage chair, an upright and a sampled kit) and
     holds the list against three artifacts rather than against a module:
     `__nuMix()` for what the engine was handed, a real fetch for every file,
     and a COUNT of AudioBufferSourceNodes for the audition.
     `covers` names the six files an edit to any of them has to re-run this
     on: the reader and the view, the page that mounts them, the sheets the
     swap writes through, the registry every path is extracted from, and the
     routing this list is held against (a patch table gaining an id moves a
     chair from "recording" to "model" and takes its files off this page —
     which is exactly the red this gate caught the day it was written). */
  { name: "samples",    wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/samples.browser.js"], need: ["test/samples.browser.js"],
    covers: ["test/samples.browser.js", "nukernel/ui/samples.js",
             "nukernel/ui/eight.js", "nukernel/avail.js",
             "nukernel/instruments.js", "nukernel/audio/to-engine.js",
             "engine/registry-data.js"] },
  /* THE SECTION AUTOMATION GRIDS (2026-09-02, slice 2d). Paul, B9: "Make a
     section automation interface for the manipulation of the motifs and put it
     under structure/sections … Every section I can tweak every instrument."
     It covers `avail.js` and `fields.js` as well as the view, because the grid
     draws whatever `nudgesFor` names and whatever `SHEETS` offers — a row added
     to either is a column added here with no edit in eight.js. */
  { name: "structure",  wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/structure.browser.js"], need: ["test/structure.browser.js"],
    covers: ["test/structure.browser.js", "nukernel/ui/eight.js",
             "nukernel/avail.js", "nukernel/fields.js"] },
  /* THE MIX PLATE'S HEADS (2026-09-02, slice 2e). Paul, B11: "the columns
     should list the instrument and when I click on the column head let me edit
     the instrument! Light up which instrument is playing, make a little volume
     meter INSIDE the heading. … I need to be able to jump to a section
     somehow, by clicking on them when in automation."
     It presses PLAY, because three of its six checks are about what happens
     while the record sounds — a lit head, a measured bar, a queued jump that
     lands. `covers` names the two files that can break it without touching
     the view: the board (`engineer.js`, which draws the heads and paints them)
     and the transport (`audio/live.js`, which owns `voiceLevels`,
     `soundingChans` and the jump's own countdown). nukernel/desk-gate.js holds
     the STRUCTURE of the same plate and test/meter-reach.browser.js holds the
     NUMBER; this one holds the join. */
  { name: "mix-heads", wave: 3, kind: "browser", url: { flag: "--page" },
    argv: ["test/mix-heads.browser.js"], need: ["test/mix-heads.browser.js"],
    covers: ["test/mix-heads.browser.js", "nukernel/ui/engineer.js",
             "nukernel/audio/live.js"] },
  // THE SLOWEST GATE IN THE HOUSE, AND IT HAS TO BE. It presses play and waits
  // for two real section boundaries at two viewports, because a boundary is
  // the thing that used to rebuild the page and a fixed sleep would be a coin
  // toss: measured 2026-08-24, the first one landed at ~22s against an
  // arithmetic prediction of 16.5s, because the engine runs a runway.
  // ...AND IT RUNS ALONE (`solo`). Two and a half minutes of assertions about
  // TIME — a bar-clock budget and a 100 ms long-task ceiling — is the one thing
  // in this suite that a neighbour can make wrong without a defect.
  { name: "motif-frozen", wave: 3, kind: "browser", solo: true, url: { env: "MOTIF_URL" },
    argv: ["test/motif-frozen.js"], need: ["test/motif-frozen.js"],
    covers: ["test/motif-frozen.js"] },
  /* THE HOLD AND THE COMMUTE, 2026-08-27. Paul, from a train: "Please cache
     everything you need to play one song it keeps cutting out while I'm going
     into tunnels." Two gates, not one, and the pair is the lesson: `hold`
     asserts the ledger for a record PICKED off the atlas and passed 22/22
     straight through the defect, because it chose a mark first and was
     structurally blind to the record you LAND on — which is the only one Paul
     ever had open. `commute` cuts the wire mid-song on the boot record and
     measures the hole in the sound.

     COMMUTE RUNS ALONE for motif-frozen's own reason, one layer down: its
     assertion is "no gap in rendered audio over 250 ms", and a neighbouring
     job on a four-core box is exactly the thing that makes such a gap without
     a defect. It also runs each case in a COLD CONTEXT — measured: in a
     shared one, the flicker case passed green off cache the two tunnel cases
     had pulled, while its own ledger said `modules: 0`. */
  { name: "hold", wave: 3, kind: "browser", url: { env: "HOLD_URL" },
    argv: ["test/hold.test.js"], need: ["test/hold.test.js"],
    covers: ["test/hold.test.js"] },
  { name: "commute", wave: 3, kind: "browser", solo: true, url: { env: "COMMUTE_URL" },
    argv: ["test/commute.test.js"], need: ["test/commute.test.js"],
    covers: ["test/commute.test.js"] },
];
/* WHAT A BROWSER GATE REALLY COVERS. Every one of them drives this page, so a
   change to anything the page loads is inside all of their closures. That is
   the truth about nukernel/index.html and not a defect in the selection — see
   test/closure.js's header, which says so at length. */
const BROWSER_PAGE = "nukernel/index.html";

const has = (rel) => fs.existsSync(path.join(ROOT, rel));
const dur = (ms) => (ms / 1000).toFixed(1) + "s";
const MODE = COMPLETE ? "COMPLETE" : "FAST";

/* ---------- the runner's own static server, on a port it discovers ----------
   serve.sh's handler exactly — COOP: same-origin, COEP: require-corp, so the
   page is cross-origin isolated and the ring engine gets its SharedArrayBuffer
   — with two differences: it binds port 0 and prints back what the OS gave it,
   and it serves ROOT explicitly rather than the cwd. */
const SERVER_PY = `
import sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=sys.argv[1]))
print(srv.server_address[1], flush=True)
srv.serve_forever()
`;
function standUpServer() {
  const p = spawn("python3", ["-c", SERVER_PY, ROOT],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    p.stdout.on("data", (d) => {
      buf += d;
      const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc: p, port: +m[1] }); }
    });
    p.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

/* ---------- selection ---------- */
function impactedSet() {
  const changed = CHANGED_ARG
    ? CHANGED_ARG.split(",").map((x) => x.trim()).filter(Boolean)
    : changedFiles();
  const rows = [];
  for (const g of GATES) {
    const cl = closureFor(g.covers.concat(g.kind === "browser" ? [BROWSER_PAGE] : []));
    const hit = changed.filter((f) => cl.has(f));
    rows.push({ g, hit, size: cl.size });
  }
  return { changed, rows };
}

async function main() {
  let picked = GATES.filter((g) => !ONLY || g.name.includes(ONLY));
  let selection = null;

  if (IMPACTED) {
    const { changed, rows } = impactedSet();
    selection = { changed, rows };
    if (!changed.length) {
      console.log("test/all --impacted: the tree is clean — nothing changed, " +
        "so nothing could have broken. (`node test/all.js` runs everything.)");
      process.exit(0);
    }
    const names = new Set(rows.filter((r) => r.hit.length).map((r) => r.g.name));
    picked = picked.filter((g) => names.has(g.name));
  }

  if (LIST) {
    for (const g of picked)
      console.log((has(g.need[0]) ? "  " : "  (missing) ") +
        g.name + "  w" + g.wave + "  " + g.kind + (g.solo ? "  [alone]" : ""));
    process.exit(0);
  }

  /* ---- the header, which is also the mode ---- */
  const la = fs.readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" ");
  console.log("test/all — " + MODE + " · " + picked.length + " gate" +
    (picked.length === 1 ? "" : "s") + " · " +
    (SERIAL ? "one at a time" : "budget " + BUDGET + " on " + CORES + " cores " +
      "(a browser gate costs 2, a node gate 1)") + " · load " + la);
  console.log(COMPLETE
    ? "  COMPLETE: every stack, every derivation, nothing cached. This is the " +
      "pass that gates a deploy."
    : "  FAST: the producer's G3 walks every sentence at a rotating rung " +
      "rather than at all five, and the\n  option table's derivation is skipped " +
      "when its inputs are byte-identical. Same gates, same\n  assertions. " +
      "`--complete` for the whole breadth.");
  console.log("  (the soak is deliberately not in here — Paul, 2026-08-25: " +
    "\"Don't do the soak.\")");

  /* ---- and what selection left out, said out loud ---- */
  if (selection) {
    const { changed, rows } = selection;
    console.log("\n  changed (" + changed.length +
      (CHANGED_ARG ? ", GIVEN on --changed, not read off the tree" : "") + "): " +
      changed.slice(0, 8).join(" ") + (changed.length > 8 ? " …" : ""));
    const out = rows.filter((r) => !r.hit.length);
    console.log("  running " + (rows.length - out.length) + ", SKIPPING " + out.length + ":");
    for (const r of out)
      console.log("    skip  " + r.g.name.padEnd(12) +
        " none of the " + r.size + " files it covers changed");
    for (const r of rows.filter((x) => x.hit.length))
      console.log("    run   " + r.g.name.padEnd(12) + " covers " +
        r.hit.slice(0, 3).join(" ") + (r.hit.length > 3 ? " +" + (r.hit.length - 3) : ""));
    console.log("");
  }

  /* ---- the server ---- */
  const needBrowser = picked.some((g) => g.kind === "browser" && g.need.every(has));
  let server = null, PAGE = PAGE_ARG;
  if (needBrowser && !PAGE) {
    server = await standUpServer().catch((e) => { console.error("!! " + e.message); return null; });
    if (!server) { console.error("!! could not stand up a static server"); process.exit(2); }
    PAGE = "http://127.0.0.1:" + server.port + "/" + BROWSER_PAGE;
    /* AND IT DIES WITH THE RUNNER, however the runner dies. A ^C in the middle
       of a fifteen-gate pass used to leave nothing behind; a server that
       outlived it would be a stray port and, worse, a stale tree served to the
       next run. */
    const bury = () => { try { server.proc.kill(); } catch (e) {} };
    process.on("exit", bury);
    for (const sig of ["SIGINT", "SIGTERM"])
      process.on(sig, () => { bury(); process.exit(130); });
    console.log("  serving " + ROOT + " on :" + server.port +
      " (cross-origin isolated, port discovered not named)\n");
  } else if (needBrowser) {
    console.log("  using the server you gave me: " + PAGE + "\n");
  }

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "nuall-"));
  /* WHAT EACH GATE COST BEFORE: { name: { last, max } }. `last` orders the
     queue (longest first, so the long poles start first); `max` decides which
     gates are too big to sit beside each other. An older flat {name: seconds}
     file is read as both, so an existing cache does not have to be thrown
     away. */
  const prev = (() => {
    let raw = {};
    try { raw = JSON.parse(fs.readFileSync(DUR, "utf8")); } catch (e) { return {}; }
    const out = {};
    for (const [k, v] of Object.entries(raw))
      out[k] = typeof v === "number" ? { last: v, max: v }
                                     : { last: +v.last || 0, max: +v.max || 0 };
    return out;
  })();

  const results = [];
  const runnable = [], skipped = [];
  for (const g of picked) {
    const missing = g.need.filter((f) => !has(f));
    if (missing.length) {
      skipped.push({ g, why: "not built yet: " + missing.join(", ") });
      console.log("skip  " + g.name.padEnd(12) + "  " + missing.join(", "));
    } else runnable.push(g);
  }

  /* LONGEST FIRST, FROM WHAT THEY TOOK LAST TIME. A measured hint, not a typed
     table: whatever a gate cost on the previous run is written to
     test/.cache/durations.json and read back to start the long poles first.
     With no cache file the declaration order stands, and the answer is the
     same either way — only the wall clock moves. */
  const cost = (g) => (prev[g.name] || {}).last || 60;
  const parallel = runnable.filter((g) => !g.solo).sort((a, b) => cost(b) - cost(a));
  const solo = runnable.filter((g) => g.solo);

  const weight = (g) => (g.kind === "browser" ? 2 : 1);
  /* ...AND NO TWO HEAVY NODE GATES AT ONCE, WHICH IS ABOUT MEMORY AND NOT CPU.
     Measured 2026-08-25 on `--complete`, with the CPU budget alone in force:
     `producer` and `gates` ran side by side and BOTH roughly doubled — 392s ->
     688s and 144s -> 310s — while `atlas`, a chromium sharing the same box,
     went 108s -> 129s. That is not the shape of CPU contention, it is the shape
     of swap: this is a four-core box with 8 GB, a couple of GB of it already
     spoken for, and the two big node gates hold hundreds of megabytes of JS
     heap each (gates-extract compiles 13,321 records; the producer keeps three
     whole documents and re-projects them per sentence). Two of them together
     push the machine into swap and the wall clock goes superlinear.
     So they take turns. A heavy gate is one that took more than 90 s the last
     time it ran — measured, out of test/.cache/durations.json, never typed —
     and a browser gate may still overlap a heavy node gate, because that is the
     pair the measurement says is cheap. */
  const HEAVY_S = 90;
  /* …AND HEAVINESS IS THE WORST THIS GATE HAS EVER BEEN, not the last thing it
     did. Measured the hard way on 2026-08-25: the rule was keyed on the last
     duration, the last duration of `gates` was a FAST run where the cache
     answered in 0.4 s, so on the next `--complete` it did not count as heavy,
     ran beside the producer anyway, and the pair went 688 s / 284 s again. A
     gate that is heavy in one mode is a memory hog in that mode forever, so the
     record keeps `max` as well as `last` and the rule reads `max`. Ordering
     still reads `last`, which is the number that predicts THIS run. */
  const heavyNode = (g) => g.kind !== "browser" && (prev[g.name] || {}).max > HEAVY_S;
  const started = Date.now();

  function launch(list, cap) {
    return new Promise((done) => {
      const queue = list.slice();
      let load = 0, live = 0, bigNode = 0;
      /* SKIP PAST A BLOCKED GATE, DO NOT STOP AT IT. The queue is longest-first,
         so the head is usually the heavy one; a scheduler that stalled the whole
         lane whenever the head could not start would have left three cores idle
         behind the producer. Anything further down that fits goes now. */
      const fits = (g) => (live === 0) ||
        (load + weight(g) <= cap && !(heavyNode(g) && bigNode > 0));
      const pump = () => {
        for (;;) {
          const i = queue.findIndex(fits);
          if (i < 0) break;
          const g = queue.splice(i, 1)[0];
          load += weight(g); live++; if (heavyNode(g)) bigNode++;
          run(g).then((r) => {
            results.push(r);
            console.log((r.code === 0 ? "pass  " : "FAIL  ") + g.name.padEnd(12) + "  " +
              dur(r.ms).padStart(6) + "  " + r.last.slice(0, 104));
            if (r.code !== 0)
              console.log(r.out.trim().split("\n").slice(-25)
                .map((l) => "        " + l).join("\n"));
            load -= weight(g); live--; if (heavyNode(g)) bigNode--;
            if (!queue.length && live === 0) done();
            else pump();
          });
        }
        if (!queue.length && !live) done();
      };
      pump();
    });
  }

  function run(g) {
    const env = Object.assign({}, process.env);
    if (g.kind === "browser") env.NODE_PATH = PW;
    let steps = (g.steps || [COMPLETE && g.complete ? g.complete : g.argv])
      .map((s) => s.map((x) => String(x).replace(/@TMP@/g, TMP)));
    if (g.kind === "browser" && g.url) {
      /* A GATE MAY NAME ITS OWN PAGE. Every browser gate but one is pointed at
         `BROWSER_PAGE`; `sheets-tier` above is pointed at a fixture, and that
         is the whole reason this branch exists. Built through `new URL` off
         the ORIGIN rather than by trimming segments off the end of the string:
         `--page` may hand this any URL at all, and a two-segment trim would
         quietly produce `…/index.html/test/fixtures/…` for a page served from
         the root. */
      const page = g.url.path
        ? (() => { const u = new URL(PAGE); u.pathname = "/" + g.url.path;
                   u.search = ""; u.hash = ""; return u.href; })()
        : PAGE;
      if (g.url.env) env[g.url.env] = page;
      else steps = steps.map((s) => s.concat([g.url.flag, page]));
    }
    const t0 = Date.now();
    return new Promise((res) => {
      let out = "", i = 0;
      const step = () => {
        const p = spawn(process.execPath, steps[i], { cwd: ROOT, env });
        p.stdout.on("data", (d) => { out += d; });
        p.stderr.on("data", (d) => { out += d; });
        p.on("close", (code) => {
          if (code === 0 && ++i < steps.length) return step();
          // THE VERDICT LINE IS THE GATE'S OWN LAST WORD, not this file's
          // summary of it. Every gate ends with one — "22 passed, 0 failed",
          // "all 49 checks pass", "ALL PASS (18 checks)" — and reprinting it is
          // how the runner stays out of the business of interpreting somebody
          // else's result. …and the LAST line is not always it: precompose ends
          // with a printed IDIOM table whose final line is a question. Walk back
          // from the end to the first line that reads like a count.
          /* A GATE MAY DECLARE ONE EXIT CODE THAT MEANS "NOT ON THIS BOX".
             `wiki` is the only one today: nukernel/wiki-extract.js --check asks
             a local 100GB ZIM every one of its 191 titles again, and that ZIM
             is on exactly one machine here. It exits 2 when kiwix-serve is not
             answering, which is not a failure and must not turn this runner red
             on a laptop. 0 pass · 1 drift · 2 skip. The code is folded to 0 and
             the SENTENCE is left in the output, so a skip is visible rather
             than silent — a gate that quietly passes because it did not run is
             the thing this file exists to prevent. */
          if (g.skipExit != null && code === g.skipExit) {
            out += "\nSKIPPED — exit " + code + ": this gate needs a tool that " +
                   "is not on this box.\n";
            code = 0;
          }
          const lines = out.trim().split("\n").filter((l) => l.trim());
          const last = ([...lines].reverse().find((l) =>
            /\b(passed|pass|PASS|failed|FAIL|OK|checks|cached)\b/.test(l)) ||
            lines[lines.length - 1] || "(no output)").trim();
          res({ g, code: code == null ? 1 : code, out, last, ms: Date.now() - t0 });
        });
      };
      step();
    });
  }

  await launch(parallel, BUDGET);
  if (solo.length) {
    console.log("  — and one alone, because everything it asserts is about time —");
    await launch(solo, 1);
  }

  if (server) server.proc.kill();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}

  /* …AND A GATE THAT FAILED DOES NOT GET TO SET THE RECORD. A gate that threw
     in six seconds is not a six-second gate; writing that down would make the
     next run schedule it as a trivial one and, worse, forget that it is heavy. */
  const book = Object.assign({}, prev);
  for (const r of results) {
    if (r.code !== 0) continue;
    const secs = Math.round(r.ms / 1000);
    const was = book[r.g.name] || { last: 0, max: 0 };
    book[r.g.name] = { last: secs, max: Math.max(was.max || 0, secs) };
  }
  fs.mkdirSync(path.dirname(DUR), { recursive: true });
  fs.writeFileSync(DUR, JSON.stringify(book, null, 1) + "\n");

  const pass = results.filter((r) => r.code === 0).length;
  const bad = results.filter((r) => r.code !== 0);
  const wall = Date.now() - started;
  const queued = results.reduce((a, r) => a + r.ms, 0);
  console.log("\n" + pass + " pass · " + bad.length + " fail · " + skipped.length + " skip" +
    (skipped.length ? "  (" + skipped.map((r) => r.g.name).join(", ") + ")" : ""));
  console.log(MODE + " · " + dur(wall) + " wall" +
    (SERIAL ? "" : " (serial would have been " + dur(queued) + " — " +
      (queued / Math.max(1, wall)).toFixed(1) + "x)") +
    " · load now " +
    fs.readFileSync("/proc/loadavg", "utf8").trim().split(" ").slice(0, 3).join(" "));
  if (!COMPLETE) console.log(
    "THIS WAS THE FAST PATH: the producer sampled G3's cross product and the " +
    "option table may have been\ncached. It is not a deploy gate. " +
    "`node test/all.js --complete` is.");
  if (IMPACTED) console.log(
    "THIS WAS A SELECTION over `git diff` — see the skip list above for what " +
    "did not run and why.");
  console.log("(the soak is not in here: `node test/soak-nukernel.js --mins 12 --load 2`)");
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
