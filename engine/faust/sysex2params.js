#!/usr/bin/env node
// sysex2params.js — DX7 cartridge -> dx7.lib parameter maps.
//
// THE FINDING: dx7.lib (David Braun 2025, Dexed-derived, bundled in current
// faustlibraries) exposes EVERY voice parameter as a UI element, so no
// "sysex -> faust source" converter toolchain is needed at all: a preset is a
// plain JS decode of the 128-byte packed voice (Dexed Documentation/
// sysex-format.txt, "Bulk Dump Packed Format") into ~150 setParamValue calls
// against the addresses found in dist/dx7-meta.json. Any of the thousands of
// period cartridge banks (e.g. bwhitman/learnfm's 31k-patch compact.bin, or
// any 4104-byte .syx bank) loads at RUNTIME — no recompile per patch.
//
// Usage:
//   node sysex2params.js <bank.(syx|bin)> <patchIndex|/NAME/> [...more picks]
//     -> writes/updates dx7-presets.json  { name: {address: value, ...}, ... }
// Accepts: 4104-byte DX7 32-voice bank sysex (skips 6-byte header),
//          or raw concatenated 128-byte packed voices (learnfm compact.bin).
"use strict";
const fs = require("fs");
const path = require("path");

// Any dx7_algN meta works as the address template: the UI tree is identical
// across algorithms except the root group name, which we strip — engine code
// prepends the actual node's root at apply time.
const metaPath = path.join(__dirname, "dist", "dx7_alg5-meta.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const stripRoot = (a) => a.replace(/^\/[^/]+/, "");

// ---- walk the dx7.lib UI tree: collect address by (groupPath, label) ------
const addr = {}; // key: "op<N>|<label>" or "global|<label>"
(function walk(items, groups) {
  for (const it of items || []) {
    if (it.items) { walk(it.items, groups.concat(it.label)); continue; }
    const label = it.label.replace(/^\[\d+\]\s*/, "");
    const opG = groups.find(g => /Operator (\d)/.exec(g));
    const key = opG ? `op${/Operator (\d)/.exec(opG)[1]}|${label}` : `global|${label}`;
    addr[key] = stripRoot(it.address);
  }
})(meta.ui, []);

// ---- packed voice (128 bytes) -> {key: value} ------------------------------
function decode(v) {
  const p = {};
  const put = (k, val) => { const a = addr[k]; if (!a) throw new Error("no addr for " + k); p[a] = val; };
  for (let k = 0; k < 6; k++) {           // chunk 0 = OP6 ... chunk 5 = OP1
    const o = k * 17, op = 6 - k, b = (i) => v[o + i];
    put(`op${op}|R1`, b(0)); put(`op${op}|R2`, b(1)); put(`op${op}|R3`, b(2)); put(`op${op}|R4`, b(3));
    put(`op${op}|L1`, b(4)); put(`op${op}|L2`, b(5)); put(`op${op}|L3`, b(6)); put(`op${op}|L4`, b(7));
    put(`op${op}|Breakpoint`, b(8)); put(`op${op}|L Depth`, b(9)); put(`op${op}|R Depth`, b(10));
    put(`op${op}|L Curve`, b(11) & 3); put(`op${op}|R Curve`, (b(11) >> 2) & 3);
    put(`op${op}|Rate Scaling`, b(12) & 7); put(`op${op}|Tune`, ((b(12) >> 3) & 15) - 7);
    put(`op${op}|A Mod Sens`, b(13) & 3); put(`op${op}|Key Vel`, (b(13) >> 2) & 7);
    put(`op${op}|Level`, b(14));
    put(`op${op}|Freq Mode`, b(15) & 1); put(`op${op}|Coarse`, (b(15) >> 1) & 31);
    put(`op${op}|Fine`, b(16));
  }
  const g = (i) => v[102 + i];
  put("global|R1", g(0)); put("global|R2", g(1)); put("global|R3", g(2)); put("global|R4", g(3));
  put("global|L1", g(4)); put("global|L2", g(5)); put("global|L3", g(6)); put("global|L4", g(7));
  const alg = (g(8) & 31) + 1;  // no UI addr in single-algorithm builds: selects WHICH dx7_algN artifact to load
  put("global|Feedback", g(9) & 7); put("global|Osc Key Sync", (g(9) >> 3) & 1);
  put("global|Speed", g(10)); put("global|Delay", g(11)); put("global|PMD", g(12)); put("global|AMD", g(13));
  put("global|Sync", g(14) & 1); put("global|Wave", (g(14) >> 1) & 7);
  put("global|P Mod Sens", (g(14) >> 4) & 7);
  put("global|Transpose", Math.max(-24, Math.min(24, g(15) - 24)));
  const name = Buffer.from(v.slice(118, 128)).toString("ascii").replace(/[^ -~]/g, " ").trim();
  return { name, alg, params: p };
}

function loadBank(file) {
  let buf = fs.readFileSync(file);
  if (buf.length === 4104 && buf[0] === 0xf0) buf = buf.slice(6, 6 + 4096); // std 32-voice bank
  const n = Math.floor(buf.length / 128);
  return { buf, n, voice: (i) => buf.slice(i * 128, i * 128 + 128) };
}

if (require.main === module) {
  const [file, ...picks] = process.argv.slice(2);
  if (!file) { console.error("usage: sysex2params.js <bank> <index|/NAME/> ..."); process.exit(1); }
  const bank = loadBank(file);
  const outPath = path.join(__dirname, "dx7-presets.json");
  const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
  for (const pick of picks) {
    let idx = -1;
    if (/^\d+$/.test(pick)) idx = +pick;
    else { // /NAME/ substring scan
      const want = pick.replace(/^\/|\/$/g, "").toUpperCase();
      for (let i = 0; i < bank.n; i++) if (decodeNameOnly(bank.voice(i)).includes(want)) { idx = i; break; }
    }
    if (idx < 0 || idx >= bank.n) { console.error("not found:", pick); continue; }
    const { name, alg, params } = decode(bank.voice(idx));
    out[name || `patch${idx}`] = { alg, params };
    console.log(`decoded [${idx}] "${name}" (${Object.keys(params).length} params)`);
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log("wrote", outPath);
}
function decodeNameOnly(v) { return Buffer.from(v.slice(118, 128)).toString("ascii").toUpperCase(); }

module.exports = { decode, loadBank };
