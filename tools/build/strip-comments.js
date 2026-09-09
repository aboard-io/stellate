#!/usr/bin/env node
/* strip-comments.js — THE COMMENTS STAY IN THE SOURCE AND STOP BEING THE PAGE.
 * Rewrites every .html, .css and .js file under a directory IN PLACE, removing
 * comments and nothing else.
 * ==========================================================================
 * Paul, on the live site: *"The HTML page is FULL Of claude-generated nonsense
 * comments!!!!"*
 *
 * HE IS RIGHT ABOUT WHAT HE IS LOOKING AT AND THE FIX IS NOT TO STOP WRITING
 * THEM. This codebase argues its decisions where the decision lives — that is
 * the whole method, it is why a reader can find out why the tape moved bands or
 * why `refit` stopped using a ratio, and index.html carries its share. But a
 * comment is for whoever opens the FILE, and "view source" on a public page is
 * not that: it is 34 KB of argument in front of somebody who wanted to see the
 * markup. The source is on GitHub, where it can be read properly. The site is
 * the instrument.
 *
 * IT RUNS AT DEPLOY TIME, on the detached worktree the deploy is taken from —
 * never on the working tree. Nothing in the repo changes; what ships is thinner
 * than what is committed, the same way the feeds are generated on the way out.
 *
 * WHAT IT WILL NOT TOUCH, and each of these is a way a naive regex breaks a
 * page:
 *   · anything inside <script> or <style>. `<!--` is legal JavaScript (the old
 *     HTML-comment-in-script hack is still in the spec) and a string containing
 *     "-->" is ordinary; stripping there would silently delete code.
 *   · the doctype, which is not a comment.
 *   · conditional comments (`<!--[if …]>`), kept whole — nothing here uses them,
 *     and a stripper that eats one turns a page into a different page on the
 *     browser it was written for.
 *   · a comment with no terminator: left exactly as found rather than eating
 *     the rest of the document.
 *
 * AND IT LEAVES THE WHITESPACE ALONE apart from the blank line a removed
 * comment leaves behind. This is not a minifier and must not become one: the
 * bytes it removes are ones nobody can act on, and every other byte is
 * somebody's layout.
 *
 * CSS AND JS GO THROUGH A PARSER, NOT A REGEX (2026-09-09). Paul, after the
 * launch: *"It's time to get rid of the markdown, the comments, and tidy things
 * up for future dev."* The comments are 80% of nu.css and 76% of ui/eight.js —
 * 1.4 MB of argument that every visitor downloads and no visitor can act on —
 * and this is where they stop being shipped. esbuild TRANSFORMS each file (it
 * is already this repo's bundler, `tools/ui/build.js`) with `legalComments:
 * "none"` and no minification: a real parse, so a `//` inside a string, a `/*`
 * inside a regex literal and a backtick inside a comment are all handled by
 * something that knows what they are. A regex could not, and this file has
 * broken a template literal twice by trying.
 * MEASURED: nu.css 719 -> 152 KB, ui/eight.js 1081 -> 321 KB.
 * IT NEVER RUNS ON THE REPO. Both deploy scripts call it on the detached
 * worktree they are about to rsync, so what ships is thin and what is committed
 * still argues for itself — which is the half of "tidy for future dev" that a
 * future developer actually needs.
 *
 *   node tools/build/strip-comments.js <dir> [--dry]
 */
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const ROOT = args.find((a) => a !== "--dry");
if (!ROOT) { console.error("usage: strip-html-comments.js <dir> [--dry]"); process.exit(2); }

/* SPLIT ON THE RAW-TEXT ELEMENTS FIRST. Inside <script> and <style> the parser
   is in a different state and `<!--` means nothing to it, so those spans are
   copied through untouched and the stripping happens only between them. */
const RAW = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

function strip(html) {
  const out = [];
  let last = 0, m;
  RAW.lastIndex = 0;
  while ((m = RAW.exec(html))) {
    out.push(stripSpan(html.slice(last, m.index)));
    out.push(m[0]);
    last = m.index + m[0].length;
  }
  out.push(stripSpan(html.slice(last)));
  return out.join("");
}

function stripSpan(s) {
  let out = "", i = 0;
  for (;;) {
    const a = s.indexOf("<!--", i);
    if (a < 0) { out += s.slice(i); break; }
    // a conditional comment is markup, not prose
    if (/^<!--\s*\[if\b/i.test(s.slice(a, a + 24))) {
      const end = s.indexOf("-->", a + 4);
      if (end < 0) { out += s.slice(i); break; }
      out += s.slice(i, end + 3); i = end + 3; continue;
    }
    const b = s.indexOf("-->", a + 4);
    if (b < 0) { out += s.slice(i); break; }   // unterminated: leave it whole
    out += s.slice(i, a);
    /* THE LINE THE COMMENT SAT ON GOES WITH IT when it sat alone on its own
       lines — otherwise every removed block leaves a blank line behind and the
       file reads as if something is missing. A comment that shared a line with
       markup leaves the markup exactly where it was. */
    const before = out.slice(out.lastIndexOf("\n") + 1);
    const afterNl = s.slice(b + 3).match(/^[ \t]*\n/);
    if (/^[ \t]*$/.test(before) && afterNl) {
      out = out.slice(0, out.lastIndexOf("\n") + 1);
      i = b + 3 + afterNl[0].length;
    } else {
      i = b + 3;
    }
  }
  return out;
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== ".git" && e.name !== "node_modules") walk(p); }
    else if (/\.(html|css|js)$/i.test(e.name)) files.push(p);
  }
})(ROOT);

let saved = 0, touched = 0;
let esbuild = null;
try { esbuild = require("esbuild"); }
catch (e) { console.error("strip-comments: esbuild not found — .css/.js left whole"); }

for (const f of files) {
  const was = fs.readFileSync(f, "utf8");
  let now;
  if (/\.html$/i.test(f)) now = strip(was);
  else if (!esbuild) continue;
  else {
    /* A FILE THAT WILL NOT PARSE IS LEFT EXACTLY AS IT IS. The deploy must not
       be the thing that discovers a syntax error, and a stripper that "fixed"
       one would be worse: the bytes that ship would stop being the bytes that
       were tested. */
    try {
      now = esbuild.transformSync(was, {
        loader: /\.css$/i.test(f) ? "css" : "js",
        legalComments: "none", minify: false, target: "esnext",
      }).code;
    } catch (err) {
      console.error("strip-comments: " + f + " left whole (" +
                    String(err.message || err).split("\n")[0] + ")");
      continue;
    }
  }
  if (now === was) continue;
  touched++; saved += was.length - now.length;
  if (!DRY) fs.writeFileSync(f, now);
}
console.log("strip-html-comments: " + touched + " of " + files.length + " file(s), " +
            (saved / 1024).toFixed(1) + " KB removed" + (DRY ? " (dry run)" : ""));
