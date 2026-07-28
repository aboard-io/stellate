#!/usr/bin/env node
// tools/genre/render-diff-harness.js — the tiny node harness behind render-diff.sh.
//
// Renders the SYMBOLIC events (engine/csd-engine.js buildEvents) for one state
// and prints a deterministic, pretty JSON serialization to stdout — and NOTHING
// else on stdout (diagnostics go to stderr) so the caller can byte-compare two
// runs cleanly.
//
// The engine is loaded from --root <dir>, so the SAME harness file can render
// against the working tree OR against a git worktree checked out at some ref
// (render-diff.sh does exactly that). All engine requires are relative to their
// own file, so pointing --root at a self-consistent checkout is safe.
//
// Usage:
//   render-diff-harness.js --root <repoDir> [--state <file.json>]
//                          [--genre <name>] [--seed <n>] [--drift]
//   • --state  : a state JSON (as produced by K.track / the app). Rendered as-is.
//   • --genre  : anchor name; state built via K.track(genre,{seed}).
//   • --seed   : integer seed for --genre (default 1).
//   • --drift  : DEMO ONLY — perturb the render (seed+1 / tag the state) so the
//                two sides differ, exercising render-diff.sh's drift path.
'use strict';

const fs = require('fs');
const path = require('path');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}

const root = arg('root', process.cwd());
const stateFile = arg('state', null);
const genre = arg('genre', null);
let seed = parseInt(arg('seed', '1'), 10);
const drift = arg('drift', false) === true;

if (drift) seed = seed + 1; // demo drift: different seed => different events

function req(rel) {
  return require(path.resolve(String(root), rel));
}

let K, E;
try {
  E = req('engine/csd-engine.js');
  if (!stateFile) K = req('engine/genre-kernel.js');
} catch (e) {
  process.stderr.write('harness: failed to load engine from root=' + root + '\n' + e.stack + '\n');
  process.exit(2);
}

let state;
try {
  if (stateFile) {
    state = JSON.parse(fs.readFileSync(String(stateFile), 'utf8'));
    if (drift) state.__driftTag = 1; // demo drift for the --state path
  } else if (genre) {
    if (!K.GENRES || !K.GENRES[String(genre)]) {
      process.stderr.write('harness: unknown genre "' + genre + '"\n');
      process.exit(3);
    }
    state = K.track(String(genre), { seed });
  } else {
    process.stderr.write('harness: need --state <file> or --genre <name>\n');
    process.exit(1);
  }
} catch (e) {
  process.stderr.write('harness: failed to build state\n' + e.stack + '\n');
  process.exit(4);
}

let events;
try {
  events = E.buildEvents(state);
} catch (e) {
  process.stderr.write('harness: buildEvents threw\n' + e.stack + '\n');
  process.exit(5);
}

// Pretty, natural-key-order JSON: a key-order change IS drift and must surface,
// so we deliberately do NOT sort keys. Same code + same state => byte-identical.
process.stdout.write(JSON.stringify(events, null, 1));
