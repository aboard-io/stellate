// no-remote-sources.test.js — pure-node gate: the browser can never fetch found
// sound off-origin (no audio, no network, no browser).
//   node test/no-remote-sources.test.js
//
// WHY: a foundSource carries the archive.org URL it was fetched FROM, and the
// live decoder used to stream that URL with an escalating Range ladder whenever
// its local twin wasn't mapped. sw.js skips cross-origin, so nothing cached: 79
// of 143 archive-backed sources re-downloaded megabytes for every listener on
// every session, and a dead archive item meant dead audio in production. The
// decoder is now local-only, and this gate holds the line — every SOURCES row
// must resolve, through the very resolver the browser uses, to a file that is
// actually on disk under found/.
"use strict";
const fs = require("fs");
const path = require("path");
const K = require("../engine/genre-kernel.js");
const FP = require("../engine/faust/found-player.js");

const ROOT = path.join(__dirname, "..");
const MANIFEST = path.join(ROOT, "found", "found-manifest.json");

let fails = 0;
function gate(name, fn) {
  try { fn(); console.log("PASS  " + name); }
  catch (e) { fails++; console.log("FAIL  " + name + " — " + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const byUrl = (JSON.parse(fs.readFileSync(MANIFEST, "utf8")).byUrl) || {};
const SRC = K.SOURCES;
const ids = Object.keys(SRC);
const isAbs = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u);

// 1) every source resolves to a site-relative path under found/ — never a URL
gate("every_source_resolves_local", () => {
  assert(ids.length > 100, "SOURCES looks empty (" + ids.length + ")");
  const bad = [];
  for (const id of ids) {
    const url = SRC[id] && SRC[id].url;
    assert(url, id + " has no url");
    const p = FP._localPathFor(url, byUrl, SRC);
    if (!p || isAbs(p) || p.slice(0, 6) !== "found/") bad.push(id + " -> " + (p || "UNRESOLVED") + " (" + url + ")");
  }
  assert(!bad.length, bad.length + " source(s) do not resolve under found/:\n    " + bad.join("\n    "));
});

// 2) the resolved file is really there — an unresolvable path is a silent
//    dropout live now that there is no remote fallback to paper over it
gate("resolved_files_exist", () => {
  const missing = [];
  for (const id of ids) {
    const p = FP._localPathFor(SRC[id].url, byUrl, SRC);
    if (!p || !fs.existsSync(path.join(ROOT, p))) missing.push(id + " -> " + p);
  }
  assert(!missing.length, missing.length + " resolved file(s) missing on disk:\n    " + missing.join("\n    "));
});

// 3) the CONVENTION alone (no manifest) covers everything but the rows the
//    manifest exists to override — so a new SOURCES entry cannot regress
//    Resolution alone proves nothing — the convention SYNTHESIZES a path for
//    every id, so it can never return null. What matters is whether that path
//    is on disk; only ids that fail THAT need a manifest row to cover them.
gate("convention_covers_sources", () => {
  const onDisk = (p) => p && fs.existsSync(path.join(ROOT, p));
  const uncovered = ids.filter((id) => {
    if (onDisk(FP._localPathFor(SRC[id].url, null, SRC))) return false;   // convention serves it
    return !onDisk(byUrl[SRC[id].url]);                                   // else a live manifest row must
  });
  assert(!uncovered.length,
    "sources with neither a convention file on disk nor a manifest row: " + uncovered.join(", "));
});

// 4) manifest rows must point at files that exist and at urls SOURCES still uses
gate("manifest_rows_live", () => {
  const urls = new Set(ids.map((id) => SRC[id].url));
  const bad = [];
  for (const [u, p] of Object.entries(byUrl)) {
    if (!fs.existsSync(path.join(ROOT, p))) bad.push(p + " (missing file)");
    else if (!urls.has(u)) bad.push(u + " (no SOURCES row)");
  }
  assert(!bad.length, "stale manifest rows:\n    " + bad.join("\n    "));
});

// 5) the sample layer is same-origin by construction too (relative file paths)
gate("samples_are_relative", () => {
  const bad = Object.entries(K.SAMPLES).filter(([, s]) => isAbs(s.file || "")).map(([id]) => id);
  assert(!bad.length, "SAMPLES with absolute urls: " + bad.join(", "));
});

// 6) textual backstop: the decoder carries no cross-origin fetch machinery.
//    Resolution can be fixed in one place; a reintroduced Range ladder could
//    not, so gate the source itself.
gate("decoder_has_no_remote_path", () => {
  const src = fs.readFileSync(path.join(ROOT, "engine", "faust", "found-player.js"), "utf8");
  const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  for (const pat of [/mode:\s*["']cors["']/, /Range:\s*["']bytes=/, /fetch\([^)]*archive\.org/])
    assert(!pat.test(code), "cross-origin fetch machinery is back: " + pat);
});

console.log(fails ? "\nFAILURES" : "\nALL PASS");
process.exit(fails ? 1 : 0);
