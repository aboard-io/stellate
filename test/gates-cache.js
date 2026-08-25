#!/usr/bin/env node
/* test/gates-cache.js — THE OPTION-TABLE CHECK, WITHOUT REDERIVING IT WHEN
 * NOTHING IT READS HAS MOVED.
 *
 * (Paul, 2026-08-25: "why do the tests take so long" — measured on this branch,
 * `nukernel/gates-extract.js --check` is 143.2 s of a 15-minute suite, second
 * only to the producer. It compiles 13,321 records through the page's own
 * compiler to re-derive a table that is already committed, and then says the
 * committed one is right.)
 *
 * WHAT THIS IS AND IS NOT. It is NOT a second, cheaper check — there is no such
 * thing, and a cheaper check that agreed most of the time would be worse than
 * none. It is the SAME check, run or not run, and the only question this file
 * answers is whether running it could possibly say anything new.
 *
 * THE ARGUMENT, WHICH IS THE WHOLE FILE.
 *
 *   `gates-extract.js --check` is a pure function. Its inputs are (1) the
 *   bytes of every file it loads, (2) the bytes of the shipped table it
 *   compares against, (3) the flags it was given, and (4) the node it ran on.
 *   It draws no wall clock into the comparison (`built` is explicitly excluded
 *   — gates-extract.js:797) and every die in it is seeded from the record it is
 *   measuring, which its own header says is exactly so that "a table that
 *   changes when nothing changed" cannot happen. So if all four inputs are
 *   byte-for-byte what they were the last time the check PASSED, the check
 *   passes again. Not probably: necessarily.
 *
 * THE KEY IS CONTENT, NEVER mtime. A `touch` must not invalidate and a revert
 * must not validate; sha256 of every input file's bytes does both. The input
 * LIST is derived by test/closure.js from gates-extract.js itself rather than
 * typed, for the reason that file's header gives — a typed list of inputs that
 * silently misses one is a cache that returns a stale PASS, which is the worst
 * outcome any of this could produce. The two shipped artifacts (gates.js and
 * gates.json) are added by name because they are read at runtime by --check
 * rather than imported, and a change to gates.json is precisely what this gate
 * is FOR.
 *
 * AND THERE IS ALWAYS A WAY TO THE REAL THING:
 *
 *   node test/gates-cache.js            # skip if the inputs are unchanged
 *   node test/gates-cache.js --force    # derive it, always — 143 s
 *
 * `test/all.js --complete` passes --force. The complete pass never trusts this
 * file; that is what makes it complete.
 */
"use strict";
const fs = require("fs"), path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const { ROOT, closureFor } = require("./closure.js");

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const PASS = argv.filter((a) => a !== "--force");

const ENTRY = "nukernel/gates-extract.js";
/* read at runtime by --check, not imported — so the walker cannot see them */
const ARTIFACTS = ["nukernel/gates.js", "nukernel/gates.json"];
const CACHE = path.join(__dirname, ".cache", "gates-check.json");

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

function key() {
  const files = [...new Set([...closureFor([ENTRY]), ...ARTIFACTS])].sort();
  const h = crypto.createHash("sha256");
  h.update("gates-extract --check v1\n");
  h.update("node " + process.version + "\n");
  h.update("flags " + JSON.stringify(PASS) + "\n");
  const missing = [];
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { missing.push(f); continue; }
    h.update(f + " " + sha(fs.readFileSync(p)) + "\n");
  }
  return { hash: h.digest("hex"), files: files.length, missing };
}

function run() {
  const r = spawnSync(process.execPath, [ENTRY, "--check", ...PASS],
    { cwd: ROOT, stdio: "inherit" });
  return r.status == null ? 1 : r.status;
}

const k = key();
if (k.missing.length) {
  console.error("gates-cache: cannot key on " + k.missing.join(", ") + " — running in full");
  process.exit(run());
}

if (!FORCE) {
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch (e) {}
  if (prev && prev.hash === k.hash) {
    console.log("the option gates, NOT rederived — every one of the " + k.files +
      " files the derivation reads is byte-identical to the tree that last");
    console.log("  passed this check (" + prev.at + "). Content-keyed, not mtime; " +
      "`--force` derives it anyway.");
    console.log("  OK  the shipped table is what the box says. (cached)");
    process.exit(0);
  }
  if (prev) console.log("gates-cache: the inputs moved since " + prev.at +
    " — deriving the table in full");
  else console.log("gates-cache: no recorded pass for these inputs — " +
    "deriving the table in full");
}

const code = run();
if (code === 0) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(
    { hash: k.hash, files: k.files, at: new Date().toISOString(), node: process.version },
    null, 1) + "\n");
}
process.exit(code);
