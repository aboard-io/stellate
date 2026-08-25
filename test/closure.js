#!/usr/bin/env node
/* test/closure.js — WHICH SOURCE FILES A GATE ACTUALLY COVERS, DERIVED.
 *
 * (Paul, 2026-08-25, after being told the suite takes fifteen minutes: "why do
 * the tests take so long" / "Update the testing.")
 *
 * SELECTION IS ONLY HONEST IF THE MAP IS DERIVED. A hand-typed table of
 * "gate X covers files Y" is a fourth source of truth and it rots the first
 * time somebody adds an import — and a stale selection table does not fail
 * loudly, it just quietly stops running the gate that would have caught you.
 * That is worse than no selection at all. So nothing here is typed: this file
 * reads the entry point and follows what it says.
 *
 *   node test/closure.js test/atlas.js          # print one closure
 *   node test/closure.js --changed              # print the changed files
 *
 * WHAT IT FOLLOWS, AND WHY IT IS THREE THINGS RATHER THAN ONE.
 *
 * 1. ESM. `import x from "./y.js"`, `export * from "./y.js"`, `import("./y.js")`.
 *    The view tier (nukernel/ui/*.js, nukernel/audio/*.js) is ESM and static
 *    imports are all literals, so this half is exact.
 *
 * 2. UMD ON `require`. The data tier publishes onto `window` and node requires
 *    it — `require("./kernel.js")` — which is the same walk.
 *
 * 3. …AND THE COMPUTED REQUIRE, WHICH IS WHY THIS IS NOT A TWO-LINE REGEX.
 *    Measured on this tree: test/producer-eight.test.js does not contain one
 *    literal specifier for the tier it tests. It defines
 *    `const R = (p) => require(path.join(ROOT, "nukernel", p))` and then calls
 *    `R("kernel.js")` twenty times, and test/document.test.js writes
 *    `require(R + "/nukernel/kernel.js")`. A walker that only understood
 *    `require("…")` would have said the producer gate depends on nothing but
 *    `assert` — and would then have skipped it on a kernel change, which is
 *    exactly the failure that makes people stop trusting a selective runner.
 *
 *    So EVERY string literal that looks like a file is resolved, three ways,
 *    in order: relative to the file, relative to the repo root, and — last —
 *    as a unique suffix of a repo path (`"kernel.js"` -> nukernel/kernel.js).
 *    When the suffix is NOT unique every match is included. The bias is
 *    deliberate and it is always the same bias: this file over-includes rather
 *    than under-includes, because an extra gate costs seconds and a missing one
 *    costs a regression.
 *
 * 4. AND A BROWSER GATE'S REAL DEPENDENCY IS ITS PAGE. test/atlas.js requires
 *    playwright and almost nothing else; what it actually covers is whatever
 *    nukernel/index.html loads. So an .html entry is walked too — every
 *    `<script src>`, every `<link rel=stylesheet>`, and the ESM imports inside
 *    an inline `<script type="module">`. CSS is a leaf and is included by name,
 *    because test/shell.js measures rendered geometry and nu.css can break it.
 *
 * CONSEQUENCE, STATED PLAINLY SO NOBODY IS SURPRISED BY IT: nukernel/index.html
 * loads ui/eight.js, which imports most of nukernel/ui/. So a change to any
 * view file is inside EVERY browser gate's closure and all of them run. That is
 * not a defect in this file, it is the truth about that page — and the win is
 * still large, because the pure-node gates (the producer's 421 s among them)
 * drop out.
 */
"use strict";
const fs = require("fs"), path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

/* ---------- the repo's own file list, from git ----------
   `git ls-files` rather than a directory walk: it is the list git will diff
   against, it excludes .git and anything ignored, and it does not wander into
   .claude/worktrees, where a second copy of nukernel/kernel.js lives and would
   have made every suffix ambiguous. Untracked-but-not-ignored files are added
   because a brand-new module is exactly the file somebody wants selected. */
function repoFiles() {
  const git = (args) => {
    try {
      return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" })
        .split("\n").filter(Boolean);
    } catch (e) { return []; }
  };
  const all = new Set([...git(["ls-files"]),
                       ...git(["ls-files", "--others", "--exclude-standard"])]);
  return [...all].filter((f) => fs.existsSync(path.join(ROOT, f)));
}
const FILES = repoFiles();
/* basename -> every repo path that ends with it, for strategy 3 */
const BY_SUFFIX = new Map();
for (const f of FILES) {
  const b = f.split("/").pop();
  if (!BY_SUFFIX.has(b)) BY_SUFFIX.set(b, []);
  BY_SUFFIX.get(b).push(f);
}

const CODE = /\.(js|mjs|cjs|json|html|css)$/i;
/* A specifier only counts if it names a file. Bare package names (playwright,
   assert, path) resolve to nothing here and are dropped, which is right: a
   change to node's `path` is not a change to this repo. */
function resolveOne(spec, fromDir) {
  if (typeof spec !== "string" || !spec || spec.length > 200) return [];
  if (/^(https?:)?\/\//.test(spec) || spec.startsWith("data:")) return [];
  const tries = [];
  if (spec.startsWith("/")) tries.push(path.join(ROOT, spec.slice(1)));
  else { tries.push(path.resolve(fromDir, spec)); tries.push(path.join(ROOT, spec)); }
  for (const t of tries) {
    for (const cand of [t, t + ".js", path.join(t, "index.js")]) {
      if (!cand.startsWith(ROOT)) continue;
      if (fs.existsSync(cand) && fs.statSync(cand).isFile() && CODE.test(cand))
        return [rel(cand)];
    }
  }
  // strategy 3: a unique (or, failing that, every) repo path ending in it
  if (!CODE.test(spec)) return [];
  const base = spec.split("/").pop();
  const hits = (BY_SUFFIX.get(base) || []).filter((f) => f.endsWith(spec.replace(/^\.\//, "")));
  return hits;
}

/* ---------- what a file points at ---------- */
const RE_FROM   = /\b(?:import|export)\s[\s\S]{0,400}?\bfrom\s*["'`]([^"'`]+)["'`]/g;
const RE_BARE   = /\bimport\s*["'`]([^"'`]+)["'`]/g;
const RE_DYN    = /\b(?:import|require)\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
/* "there is a require/import here whose argument this file cannot read" */
const RE_COMPUTED = /\b(?:require|import)\s*\(\s*[^"'`)\s]/;
const RE_PATHISH = /^[^\s]{2,120}\.(?:js|mjs|cjs|json|html|css)$/;

/* ---------- every REAL string literal, comments excluded ----------
   The blunt pass of note 3 needs the file's string literals and nothing else,
   and "nothing else" turned out to be load-bearing twice on 2026-08-25:

     nukernel/avail.js         names `gates-extract.js` in a backtick IN A
                               COMMENT, which dragged the whole extraction tier
                               into every closure that touched avail.js.
     terms-genre.freeze.js:6   names `ui/eight.js` the same way, which put the
                               entire view tier inside the precompose gate — so
                               a change to ui/atlas.js re-ran a data-tier gate
                               that cannot see it.

   A selective runner that selects everything is a serial runner with extra
   steps, so this is a real (small) scanner rather than a regex: it walks the
   source once, skips `//`, skips block comments, and hands back what was
   actually between the quotes. It is used ONLY for files that contain a
   require/import whose argument is computed; the rest are read exactly by the
   three specifier patterns above. */
function stringLiterals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let j = i + 1, buf = "";
      while (j < n) {
        if (src[j] === "\\") { buf += src[j + 1] || ""; j += 2; continue; }
        if (src[j] === q) break;
        if (q !== "`" && src[j] === "\n") break;   // an unterminated quote: give up on it
        buf += src[j]; j++;
      }
      if (buf.length >= 2 && buf.length <= 200) out.push(buf);
      i = j + 1; continue;
    }
    i++;
  }
  return out;
}
const RE_SRC    = /<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
const RE_LINK   = /<link[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
const RE_MODULE = /<script[^>]*\btype\s*=\s*["']module["'][^>]*>([\s\S]*?)<\/script>/gi;

function pointsAt(file) {
  const abs = path.join(ROOT, file);
  let src = "";
  try { src = fs.readFileSync(abs, "utf8"); } catch (e) { return []; }
  const dir = path.dirname(abs);
  const out = new Set();
  const eat = (re, text, group) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) for (const r of resolveOne(m[group || 1], dir)) out.add(r);
  };
  if (/\.html?$/i.test(file)) {
    eat(RE_SRC, src);
    eat(RE_LINK, src);
    RE_MODULE.lastIndex = 0;
    let m;
    while ((m = RE_MODULE.exec(src))) {
      eat(RE_FROM, m[1]); eat(RE_BARE, m[1]); eat(RE_DYN, m[1]);
    }
    return [...out];
  }
  if (/\.json$/i.test(file)) return [];        // data, not code: a leaf
  if (/\.css$/i.test(file)) return [];         // a leaf, by the header's note
  eat(RE_FROM, src); eat(RE_BARE, src); eat(RE_DYN, src);
  if (RE_COMPUTED.test(src))
    for (const lit of stringLiterals(src))
      if (RE_PATHISH.test(lit)) for (const r of resolveOne(lit, dir)) out.add(r);
  return [...out];
}

const memo = new Map();
/** Every repo file an entry point can reach, transitively, including itself. */
function closureFor(entries) {
  const seen = new Set();
  const stack = [].concat(entries);
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    seen.add(f);
    if (!memo.has(f)) memo.set(f, pointsAt(f));
    for (const n of memo.get(f)) if (!seen.has(n)) stack.push(n);
  }
  return seen;
}

/* ---------- what changed ----------
   The working tree against HEAD, plus untracked files. Staged and unstaged
   both, because a gate does not care which index a change is sitting in. */
function changedFiles() {
  const git = (args) => {
    try {
      return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" })
        .split("\n").filter(Boolean);
    } catch (e) { return []; }
  };
  return [...new Set([
    ...git(["diff", "--name-only"]),
    ...git(["diff", "--name-only", "--cached"]),
    ...git(["ls-files", "--others", "--exclude-standard"]),
  ])];
}

module.exports = { ROOT, closureFor, changedFiles, repoFiles: () => FILES };

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes("--changed")) {
    for (const f of changedFiles()) console.log(f);
  } else if (argv.length) {
    const c = [...closureFor(argv.map((a) => rel(path.resolve(a))))].sort();
    console.log(c.join("\n"));
    console.error("\n" + c.length + " files");
  } else {
    console.error("usage: node test/closure.js <entry> [entry…]  |  --changed");
    process.exit(2);
  }
}
