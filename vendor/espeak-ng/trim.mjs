#!/usr/bin/env node
// trim.mjs — rebuild the trimmed espeak-ng WASM artifact from the upstream npm package.
//
// Usage:
//   npm pack @echogarden/espeak-ng-emscripten@0.3.5 && tar xf echogarden-espeak-ng-emscripten-0.3.5.tgz
//   node trim.mjs <path-to-upstream-package-dir> <output-dir>
//   e.g. node trim.mjs ./package .
//
// What it does: the upstream espeak-ng.data is an emscripten file_packager
// preload bundle (plain concatenation of files; the {filename,start,end}
// manifest is embedded as a JS object literal in espeak-ng.js). This script
// keeps only the English-language data set, rewrites the offsets, and patches
// the manifest + remote_package_size in the glue. 24 MB -> ~0.9 MB. No emsdk
// needed; output is byte-compatible with the original loader.

import fs from 'node:fs';
import path from 'node:path';

const [, , srcDir, outDir] = process.argv;
if (!srcDir || !outDir) {
  console.error('usage: node trim.mjs <upstream-package-dir> <output-dir>');
  process.exit(1);
}

const PREFIX = '/usr/share/espeak-ng-data/';

// The en-only set: compiled phoneme tables (shared engine data), the English
// dictionary, English voice/language definitions, intonation curves, and the
// !v voice-variant files (tiny, keep them all for timbre variety).
function keep(filename) {
  const n = filename.replace(PREFIX, '');
  return (
    ['phontab', 'phonindex', 'phondata', 'intonations', 'en_dict'].includes(n) ||
    n.startsWith('lang/gmw/en') ||
    n.startsWith('voices/!v/')
  );
}

const glue = fs.readFileSync(path.join(srcDir, 'espeak-ng.js'), 'utf8');
const data = fs.readFileSync(path.join(srcDir, 'espeak-ng.data'));

const m = glue.match(/loadPackage\(\{files:(\[.*?\]),remote_package_size:(\d+)\}\)/s);
if (!m) throw new Error('could not find file_packager manifest in espeak-ng.js');

const files = JSON.parse(m[1].replace(/([{,])(filename|start|end|audio):/g, '$1"$2":'));
if (Number(m[2]) !== data.length) {
  throw new Error(`manifest size ${m[2]} != espeak-ng.data size ${data.length}`);
}

const parts = [];
const newFiles = [];
let offset = 0;
for (const f of files) {
  if (!keep(f.filename)) continue;
  const size = f.end - f.start;
  parts.push(data.subarray(f.start, f.end));
  newFiles.push({ filename: f.filename, start: offset, end: offset + size });
  offset += size;
}

const newData = Buffer.concat(parts);
const newManifest =
  '{files:[' +
  newFiles.map(f => `{filename:${JSON.stringify(f.filename)},start:${f.start},end:${f.end}}`).join(',') +
  `],remote_package_size:${newData.length}}`;

const newGlue = glue.replace(m[0], `loadPackage(${newManifest})`);

fs.writeFileSync(path.join(outDir, 'espeak-ng.data'), newData);
fs.writeFileSync(path.join(outDir, 'espeak-ng.js'), newGlue);

console.log(`kept ${newFiles.length}/${files.length} files`);
console.log(`espeak-ng.data: ${data.length} -> ${newData.length} bytes`);
