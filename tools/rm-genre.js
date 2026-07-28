#!/usr/bin/env node
// tools/rm-genre.js — remove a genre-tool-authored genre by stripping its marked
// blocks from genres-data.js (anchor+clips) and genre-verifier.js (target row).
// Does NOT touch app/world.js POS or the coords/clusters — re-bake those after.
//   node tools/rm-genre.js <name> [<name>...]
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "engine");

function strip(file, tag) {
  const p = path.join(ROOT, file);
  let s = fs.readFileSync(p, "utf8");
  const re = new RegExp("\\n[ \\t]*/\\* genre-tool:" + tag + " \\*/[\\s\\S]*?/\\* /genre-tool:" + tag + " \\*/");
  if (re.test(s)) { s = s.replace(re, ""); fs.writeFileSync(p, s); return true; }
  return false;
}
for (const name of process.argv.slice(2)) {
  const g = strip("genres-data.js", name + ":genres");     // anchors moved out of the kernel in Stage E1
  const c = strip("genres-data.js", name + ":clips");
  const t = strip("genre-verifier.js", name + ":targets");
  console.log(`${name}: genres=${g} clips=${c} target=${t}`);
}
