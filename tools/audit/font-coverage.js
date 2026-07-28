#!/usr/bin/env node
// font-coverage.js — FULL-COVERAGE audit of the soundfont system by comparing
// data structures. sf=minimoog once dropped bass+guitar entirely; comparing the
// structures is what proves full coverage.
//
//   node tools/audit/font-coverage.js            # structural audit (fast, no audio)
//   node tools/audit/font-coverage.js --dx7-rms  # + render every DX7 patch, flag silent
//
// What it compares:
//   A. instrFamily: every SAMPLERS id -> family, checked against a rule table
//      (a guitar must be pluck, bassoon reed, …) — the class of bug where
//      "nylon_STRING_guitar" routed to the string family and vanished.
//   B. synth fonts: every id resolves to a voice (minimoog modeld/juno60
//      params complete; dx7 patch EXISTS in DX7_PATCHES — a typo'd patch name
//      silently falls back, a missing one is a hole).
//   C. file fonts (engine/faust/data/fonts.json): per font, which SAMPLERS ids the
//      font covers vs falls back on, and whether every covered zone's wav
//      actually EXISTS on disk (a missing file = a live decode "missing"
//      dropout under that font).
//   D. --dx7-rms: press one 8s melody-only state per DX7 patch and measure —
//      a patch under -60 dBFS RMS is a DROPOUT waiting for its instrument
//      (the "present-but-silent" audit reason, reproduced offline).
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..", "..");
const K = require(path.join(ROOT, "engine", "genre-kernel.js"));
const E = require(path.join(ROOT, "engine", "csd-engine.js"));

let fails = 0;
const bad = (msg) => { console.log("  !! " + msg); fails++; };

// ---- A. instrFamily rules ----
// (instrFamily isn't exported; recover each id's family through the minimoog
// voiceFor result — bass family is the only modeld voice with glide 16, etc.
// Simpler: re-derive by asking the kernel for the sampledOnly spec per id.)
const familyOf = K.instrFamily;   // the kernel's OWN classifier — no hand-synced copy to drift
const RULES = [
  [/guitar/, "pluck"], [/^bassoon$/, "reed"], [/_bass$|^bass_|acoustic_bass|fretless|contrabass/, (f) => f === "bass" || f === "string"],
  [/sax$|clarinet|oboe/, "reed"], [/piano|grand/, (f) => f === "key" || f === "pluck"], [/organ/, "organ"],
];
function auditFamilies() {
  console.log("== A. instrFamily over " + Object.keys(K.SAMPLERS).length + " instruments ==");
  const byFam = {};
  for (const id of Object.keys(K.SAMPLERS)) {
    const f = familyOf(id);
    (byFam[f] = byFam[f] || []).push(id);
    for (const [re, want] of RULES) {
      if (!re.test(id)) continue;
      const ok = typeof want === "function" ? want(f) : f === want;
      if (!ok) bad(`family rule: ${id} -> ${f} (wanted ${typeof want === "function" ? "bass/string/key-ish" : want})`);
    }
  }
  for (const f of Object.keys(byFam).sort()) console.log(`  ${f.padEnd(7)} ${byFam[f].join(" ")}`);
}

// ---- B. synth-font resolution for every id ----
function auditSynthFonts() {
  console.log("== B. synth fonts resolve every instrument ==");
  for (const font of ["minimoog", "dx7"]) {
    K.setFont(font);
    const st = K.track("vaporwave", { seed: 1 });   // any state — applySampledOnly fills samplerLib
    const lib = st.samplerLib || {};
    let synth = 0, holes = 0;
    for (const id of Object.keys(K.SAMPLERS)) {
      const s = lib[id];
      if (!s) { bad(`${font}: samplerLib missing ${id}`); holes++; continue; }
      if (!s.synth) { bad(`${font}: ${id} resolved to zones, not a synth voice`); holes++; continue; }
      synth++;
      if (s.synth === "dx7" && !s.dx7) bad(`${font}: ${id} dx7 voice without a patch`);
      if (s.synth === "modeld" && (!s.params || s.params.cutoff == null)) bad(`${font}: ${id} modeld voice without params`);
    }
    console.log(`  ${font}: ${synth}/${Object.keys(K.SAMPLERS).length} ids -> synth voices, ${holes} holes`);
  }
  K.setFont("fluidr3");
  // every DX7_ID_PATCH / family patch name must exist in the ROM bank
  const src = fs.readFileSync(path.join(ROOT, "engine", "genre-kernel.js"), "utf8");
  const names = new Set(Object.keys(K.DX7_PATCHES || {}));
  const refs = [...src.matchAll(/DX7_(?:ID|FAMILY)_PATCH\s*=\s*\{([^}]*)\}/g)].flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
  for (const r of refs) if (!names.has(r)) bad(`dx7 patch name referenced but not in DX7_PATCHES: "${r}"`);
  console.log(`  dx7 patch refs checked: ${refs.length} against ${names.size} ROM patches`);
}

// ---- C. file fonts: coverage + on-disk zones ----
function auditFileFonts() {
  console.log("== C. file fonts (fonts.json) ==");
  let manifest = [];
  try { manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "engine", "faust", "data", "fonts.json"), "utf8")); } catch (e) { console.log("  (no fonts.json)"); return; }
  for (const f of manifest) {
    if (f.key === "fluidr3" || f.synth) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(ROOT, "engine", "faust", "data", "font-" + f.key + ".json"), "utf8")); }
    catch (e) { bad(`font-${f.key}.json unreadable — the switcher will refuse it (ok) but the manifest advertises it`); continue; }
    const base = data.base || ("instruments-" + f.key);
    const ids = Object.keys(data.instr || {});
    let missingFiles = 0, zoneCount = 0;
    for (const id of ids) {
      for (const z of (data.instr[id].zones || [])) {
        zoneCount++;
        const p = path.join(ROOT, "found", "samples", base, id, z.file);
        if (!fs.existsSync(p)) { if (missingFiles < 3) bad(`${f.key}: missing zone wav ${path.relative(ROOT, p)}`); missingFiles++; }
      }
    }
    const covered = ids.filter(id => K.SAMPLERS[id]).length;
    const fallback = Object.keys(K.SAMPLERS).length - covered;
    console.log(`  ${f.key.padEnd(12)} covers ${covered} ids (${fallback} fall back to fluidr3), ${zoneCount} zones, ${missingFiles} missing wavs`);
    if (missingFiles > 3) bad(`${f.key}: ${missingFiles} missing zone wavs total`);
  }
}

// ---- D. dx7 patch RMS sweep ----
function dx7Sweep() {
  console.log("== D. DX7 patch audibility sweep ==");
  const SCRATCH = fs.mkdtempSync("/tmp/dx7-sweep-");
  const names = Object.keys(K.DX7_PATCHES || {});
  const silent = [];
  for (const name of names) {
    const st = E.defaultState();
    st.seed = 3; st.foundSources = []; st.transforms = { pool: ["rest"], rate: 0 };
    st.targetSec = 8;
    st.instruments.melody = { ...st.instruments.melody, model: "dx7", dx7: K.DX7_PATCHES[name], level: 0.6, send: 0.1, dsend: 0 };
    st.sections = [{ id: "m1", name: "verse", cycles: 2, pads: false, bass: "off", drums: "off", melody: "updown", found: { sourceId: null, role: "bed" }, fill: "off" }];
    const sj = path.join(SCRATCH, "s.json"), wav = path.join(SCRATCH, "p.wav");
    fs.writeFileSync(sj, JSON.stringify(st));
    let db = null;
    try {
      execFileSync("node", [path.join(ROOT, "engine", "faust", "press", "press.js"), sj, wav], { stdio: ["ignore", "ignore", "pipe"], timeout: 120000 });
      const out = execFileSync("sh", ["-c", `ffmpeg -i ${wav} -af astats -f null - 2>&1 | grep "RMS level" | tail -1`]).toString();
      const m = out.match(/(-?[\d.]+|-inf)\s*$/);
      db = m ? parseFloat(m[1]) : null;
    } catch (e) { db = null; }
    const isSilent = db == null || !isFinite(db) || db < -60;
    if (isSilent) { silent.push(name); bad(`dx7 patch "${name}" renders SILENT (${db} dBFS)`); }
  }
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  console.log(`  ${names.length} patches swept, ${silent.length} silent${silent.length ? ": " + silent.join(", ") : ""}`);
}

auditFamilies();
auditSynthFonts();
auditFileFonts();
if (process.argv.includes("--dx7-rms")) dx7Sweep();
console.log(fails ? `\n${fails} coverage problem(s)` : "\nfull coverage — no holes");
process.exit(fails ? 1 : 0);
