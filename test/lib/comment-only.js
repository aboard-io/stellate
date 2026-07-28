#!/usr/bin/env node
// comment-only.js — prove a diff touched COMMENTS ONLY.
//
// A comment strip is supposed to be behaviour-free, but "I only edited
// comments" is exactly the kind of claim that is easy to believe and hard to
// check by eye across a hundred files. This strips every comment and every
// string-literal-insensitive bit of whitespace from both revisions and compares
// what is left. If the code skeletons match, the change provably cannot alter
// behaviour; if they do not, it prints the first divergence.
//
//   node test/lib/comment-only.js <base-ref>     (default: HEAD)
//
// Not a gate in verify.sh — it is a tool for the person doing the strip, and it
// only means anything while the working tree holds the edit.
"use strict";
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const BASE = process.argv[2] || "HEAD";
const ROOT = path.join(__dirname, "..", "..");

// Strip comments without being fooled by // inside a string OR a regex literal.
// Walks the source once, tracking which construct we are inside.
//
// The regex case is not optional pedantry: a literal like /['"]/ or /it's/ puts
// a lone quote into the stream, and a walker that only knows about strings
// flips into "inside a string" there and silently stops stripping comments for
// the rest of the file — which then reports every later comment edit as a code
// change. Telling a regex from a division needs the previous significant token:
// after a value (identifier, ), ], literal) a slash divides; anywhere else it
// opens a regex.
const RE_OK_KEYWORD = /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;
function stripJs(src) {
  let out = "", i = 0, n = src.length;
  let inS = null, inBlock = false, inLine = false, inRe = false, inClass = false;
  let prev = "";                                   // last significant char emitted
  const setPrev = (ch) => { if (!/\s/.test(ch)) prev = ch; };
  const regexAllowed = () => {
    if (prev === "" ) return true;
    if (/[\w$)\]]/.test(prev)) {                   // after a value: division …
      return RE_OK_KEYWORD.test(out.replace(/\s+$/, ""));   // … unless it's a keyword
    }
    return true;
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (inLine) { if (c === "\n") { inLine = false; out += c; } i++; continue; }
    if (inBlock) { if (c === "*" && d === "/") { inBlock = false; i += 2; } else { if (c === "\n") out += c; i++; } continue; }
    if (inS) {
      out += c;
      if (c === "\\") { out += src[i + 1] || ""; i += 2; continue; }
      if (c === inS) { inS = null; setPrev(c); }
      i++; continue;
    }
    if (inRe) {
      out += c;
      if (c === "\\") { out += src[i + 1] || ""; i += 2; continue; }
      if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) { inRe = false; setPrev(c); }
      else if (c === "\n") inRe = false;            // unterminated: bail at EOL
      i++; continue;
    }
    if (c === "/" && d === "/") { inLine = true; i += 2; continue; }
    if (c === "/" && d === "*") { inBlock = true; i += 2; continue; }
    if (c === "/" && regexAllowed()) { inRe = true; inClass = false; out += c; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inS = c; out += c; i++; continue; }
    out += c; setPrev(c); i++;
  }
  return out;
}
const stripHash = (src) => src.split("\n").map((l) => {
  // shell: drop whole-line comments only. A trailing # can live inside a string
  // or a parameter expansion, and guessing wrong would corrupt the comparison.
  return /^\s*#/.test(l) ? "" : l;
}).join("\n");
const stripHtml = (src) => src.replace(/<!--[\s\S]*?-->/g, "");
const stripCss = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "");

function skeleton(file, src) {
  const e = path.extname(file);
  const s = e === ".js" ? stripJs(src)
    : e === ".sh" ? stripHash(src)
    : e === ".html" ? stripHtml(stripJs(src))
    : e === ".css" ? stripCss(src)
    : src;
  return s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

const changed = execFileSync("git", ["-C", ROOT, "diff", "--name-only", BASE], { encoding: "utf8" })
  .split("\n").filter((f) => /\.(js|sh|html|css)$/.test(f));

let bad = 0, ok = 0;
for (const f of changed) {
  let before;
  try { before = execFileSync("git", ["-C", ROOT, "show", `${BASE}:${f}`], { encoding: "utf8" }); }
  catch { continue; }                                     // new file: nothing to compare
  const after = fs.readFileSync(path.join(ROOT, f), "utf8");
  const a = skeleton(f, before), b = skeleton(f, after);
  if (a === b) { ok++; continue; }
  bad++;
  const la = a.split("\n"), lb = b.split("\n");
  const k = la.findIndex((l, i) => l !== lb[i]);
  console.log(`CODE CHANGED  ${f}`);
  console.log(`    before: ${JSON.stringify((la[k] || "").slice(0, 110))}`);
  console.log(`    after:  ${JSON.stringify((lb[k] || "").slice(0, 110))}`);
}
console.log(`\n${ok} file(s) comment-only, ${bad} with code changes`);
process.exit(bad ? 1 : 0);
