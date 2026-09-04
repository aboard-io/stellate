#!/usr/bin/env node
/* ---------------------------------------------------------------------------
 * tools/ui/build.js — THE COMMITTED BUILD, the extractor pattern a seventh time
 *
 * Paul, 2026-09-05: *"Do the committed build. Minimize things where possible."*
 * The contract is nukernel/TABLE.md 9b.
 *
 * WHAT IT DOES. Every `nukernel/src/<name>/index.ts` is bundled by esbuild into
 * `nukernel/ui/<name>.js` — one ES module, Lit bundled INTO it, minify OFF,
 * no sourcemap — and that output is COMMITTED. The page loads it with the same
 * plain `<script type=module>` it has always used.
 *
 * WHY IT IS COMMITTED, AND WHY THAT IS NOT A COMPROMISE. Two laws hold this
 * tree together and neither is negotiable:
 *
 *   1 · NO BUILD IN FRONT OF THE PAGE. `nukernel/index.html` loads plain files.
 *       A browser needs no toolchain, a clone needs no `npm install` to play,
 *       and the deploy stays an rsync of the served tree
 *       (tools/deploy/deploy-nukernel-staging.sh rsyncs `nukernel/`, so the
 *       committed output ships and node_modules never does).
 *   2 · IT PLAYS WITH THE WIRE CUT. Nothing is fetched from a CDN, and Lit is
 *       not VENDORED as a second copy of somebody else's file either — it is
 *       bundled into the one artifact that uses it.
 *
 * A committed artifact can be hand-patched, and a hand patch that sticks is how
 * a generated file stops being generated. So `--check` rebuilds to a temp dir
 * and diffs, exit 1 on the first differing line, and it is registered in
 * test/all.js as the `ui-build` gate. This is exactly the arrangement
 * `nukernel/genres.js` (tools/genres/build.js), `nukernel/wiki.js`
 * (wiki-extract.js), `nukernel/gates.js` and `nukernel/export/donor.js` are
 * already under — GENRES.md 1 states it as the law.
 *
 * USE
 *     node tools/ui/build.js            write the committed output
 *     node tools/ui/build.js --check    say whether the shipped files are what
 *                                       the source says; exit 1 if not
 *     npx tsc --noEmit                  the type gate (tsconfig.json)
 *
 * AN ENTRY IS A DIRECTORY. `nukernel/src/table/index.ts` is the entry and
 * `nukernel/ui/table.js` is its output; everything else under `src/table/` is
 * that bundle's own modules. One rule, discovered by reading the tree, so
 * adding a component is a directory and not an edit to this file.
 * ------------------------------------------------------------------------- */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..", "..");
const SRC = path.join(ROOT, "nukernel", "src");
const OUTDIR = path.join(ROOT, "nukernel", "ui");

let esbuild;
try { esbuild = require("esbuild"); }
catch (e) {
  console.error("tools/ui/build.js needs esbuild. Run: npm install\n" +
                "(node_modules is gitignored and is never deployed — the OUTPUT is what ships.)");
  process.exit(2);
}

/* THE BANNER IS THE FILE SAYING WHAT IT IS. genres.js and wiki.js carry the
   same sentence for the same reason: the next reader to open this file in an
   editor has to be told, in the file, that their edit will not survive. */
function banner(name) {
  return "// nukernel/ui/" + name + ".js — GENERATED. DO NOT EDIT.\n" +
    "//\n" +
    "// Built from nukernel/src/" + name + "/ by `node tools/ui/build.js`.\n" +
    "// An edit made here is an edit the next build throws away, and\n" +
    "// `node tools/ui/build.js --check` (test/all.js gate `ui-build`) fails\n" +
    "// until it is gone. Edit the TypeScript source and rebuild.\n" +
    "//\n" +
    "// Lit is BUNDLED IN on purpose (TABLE.md 9b): the served tree stays plain\n" +
    "// files, nothing is vendored and nothing is fetched, and the page plays\n" +
    "// with the wire cut. Minify is OFF so this stays a reviewable diff.\n";
}

/** The entries, read off the tree: every `nukernel/src/<name>/index.ts`. */
function entries() {
  if (!fs.existsSync(SRC)) return [];
  return fs.readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() &&
                   fs.existsSync(path.join(SRC, d.name, "index.ts")))
    .map((d) => ({ name: d.name,
                   entry: path.join(SRC, d.name, "index.ts"),
                   out: path.join(OUTDIR, d.name + ".js") }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Bundle one entry and return its text. Deterministic for a given esbuild
 *  version and source, which is what makes `--check` a gate rather than a
 *  coin toss. */
function bundle(e) {
  const r = esbuild.buildSync({
    entryPoints: [e.entry],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    platform: "browser",
    minify: false,
    sourcemap: false,
    legalComments: "none",
    charset: "utf8",
    logLevel: "warning",
    absWorkingDir: ROOT,
  });
  return banner(e.name) + "\n" + r.outputFiles[0].text;
}

function main() {
  const check = process.argv.includes("--check");
  const list = entries();
  if (!list.length) {
    console.log("tools/ui/build.js: no entries under nukernel/src/*/index.ts — nothing to do");
    return 0;
  }
  let bad = 0;
  const t0 = Date.now();
  const built = list.map((e) => ({ e, text: bundle(e) }));
  const ms = Date.now() - t0;

  if (check) {
    /* REBUILD TO A TEMP DIR AND DIFF. The committed file is never touched on
       this path, so a red gate leaves the tree exactly as it found it. */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nu-ui-check-"));
    try {
      for (const { e, text } of built) {
        fs.writeFileSync(path.join(tmp, e.name + ".js"), text);
        const have = fs.existsSync(e.out) ? fs.readFileSync(e.out, "utf8") : "";
        if (have === text) {
          console.log("ok   nukernel/ui/" + e.name + ".js is what src/" + e.name +
                      "/ says (" + text.split("\n").length + " lines, " +
                      text.length + " bytes)");
          continue;
        }
        bad++;
        const a = have.split("\n"), b = text.split("\n");
        let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
        console.error("FAIL nukernel/ui/" + e.name + ".js is NOT what src/" + e.name +
          "/ says — first difference at line " + (i + 1) +
          "\n  shipped: " + JSON.stringify(a[i] === undefined ? null : a[i]) +
          "\n  built:   " + JSON.stringify(b[i] === undefined ? null : b[i]) +
          "\n  (" + a.length + " lines shipped, " + b.length + " built)" +
          "\nrun: node tools/ui/build.js");
      }
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    console.log((bad ? "ui-build RED " : "ui-build ok ") + built.length +
                " entr" + (built.length === 1 ? "y" : "ies") + " in " + ms + " ms");
    return bad ? 1 : 0;
  }

  for (const { e, text } of built) {
    fs.mkdirSync(path.dirname(e.out), { recursive: true });
    fs.writeFileSync(e.out, text);
    console.log("nukernel/ui/" + e.name + ".js written — " +
                text.split("\n").length + " lines, " + text.length + " bytes");
  }
  console.log(built.length + " entr" + (built.length === 1 ? "y" : "ies") +
              " in " + ms + " ms");
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { entries, bundle, banner };
