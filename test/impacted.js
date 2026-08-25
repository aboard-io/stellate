#!/usr/bin/env node
/* test/impacted.js — RUN WHAT THE CHANGE COULD HAVE BROKEN, AND SAY WHAT IT DID NOT.
 *
 * (Paul, 2026-08-25: "why do the tests take so long". Sometimes the answer is
 * that it ran two hundred producer stacks to find out whether a globe still
 * spins.)
 *
 *   node test/impacted.js            # == node test/all.js --impacted
 *   node test/impacted.js --complete # …at full breadth
 *
 * Every flag goes through to test/all.js, which does the work. This file exists
 * so the command has the name of the idea.
 *
 * HOW IT DECIDES, IN ONE SENTENCE: test/closure.js walks each gate's entry point
 * (and, for a browser gate, the page it drives) following imports, requires and
 * script tags, and a gate runs when any file in that closure appears in
 * `git diff --name-only` plus untracked files.
 *
 * AND IT PRINTS ITS OWN SELECTION, ALWAYS. A selective runner that hides what it
 * skipped is how people stop trusting it and go back to running everything —
 * which costs more than it ever saved. Every skipped gate is named with the
 * reason ("none of the 26 files it covers changed"), and every gate that runs is
 * named with the changed file that pulled it in.
 *
 * WHAT THIS IS NOT: a deploy gate. A selection is a claim about a diff, and a
 * diff is not the tree — a rebase, a merge, a stale artifact or a file this
 * walker could not see is enough to make it wrong. Before anything ships:
 *
 *     node test/all.js --complete
 */
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");
const r = spawnSync(process.execPath,
  [path.join(__dirname, "all.js"), "--impacted", ...process.argv.slice(2)],
  { stdio: "inherit" });
process.exit(r.status == null ? 1 : r.status);
