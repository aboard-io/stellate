#!/usr/bin/env node
// font-coverage.test.js — gate for the soundfont coverage comparator
// (tools/audit/font-coverage.js): the STRUCTURAL audit must hold — every SAMPLERS id
// classifies to a sane family (the nylon_STRING_guitar class of bug), both
// synth fonts resolve every instrument to a complete voice, every referenced
// DX7 patch exists, and every file font's zone wavs exist on disk. The deep
// audio sweep (--dx7-rms) is the tool's manual mode, not this gate.
//   node test/unit/font-coverage.test.js
"use strict";
const { execFileSync } = require("child_process");
const path = require("path");
try {
  const out = execFileSync("node", [path.join(__dirname, "..", "..", "tools", "audit", "font-coverage.js")], { stdio: ["ignore", "pipe", "pipe"], timeout: 300000 }).toString();
  const tail = out.trim().split("\n").pop();
  console.log("PASS  font coverage structural audit — " + tail);
  process.exit(0);
} catch (e) {
  const out = ((e.stdout || "") + "").split("\n").filter(l => l.includes("!!")).slice(0, 8);
  console.log("FAIL  font coverage structural audit");
  for (const l of out) console.log(l);
  process.exit(1);
}
