#!/usr/bin/env node
// genre-tool.js — author a new genre anchor from a spec, MEASURE its verifier
// targets from real renders (never guess numbers), insert it into the kernel +
// verifier in the house style, and run the gates. Design: GENRE-SPACE.md +
// KERNEL-V4.md. Single-file, zero deps — reads the same capability files the
// rest of the suite does (genre-kernel.js / csd-engine.js / genre-verifier.js /
// faust/state-engine.js), so it always tracks the live schema.
//
//   node genre-tool.js create <spec.json> [--dry-run] [--seeds N] [--engine]
//   node genre-tool.js check  <name>      [--seeds N]
//
// create:  validate spec -> build anchor -> MEASURE features across N seeds ->
//          derive TARGET ranges from the measured spread (auto-tightening until
//          no existing genre is knocked off its own diagonal) -> splice anchor
//          into GENRES + GENRE_CLIPS (genre-kernel.js) and the TARGET row into
//          genre-verifier.js -> run gates (matrix + validate).
// check:   re-measure an existing genre: feature stats, self-score, nearest
//          neighbours, and whether its committed target row still fits. No writes.
//
// SPEC FORMAT (see genre-specs/*.json):
//   { "name":"hogcore", "label":"Hogcore", "info":"one-line pitch",
//     "clips":["kaleido",...],            // optional GENRE_CLIPS video pool
//     "anchor":{ ...kernel dimension bundle (bpm/swing/humanize/progressions/
//                kits/fills/bass/lead/pads/drums/fx/found/stab/hits/form + any
//                optional dimension: euclid, chordEvery, rubato, vox, stations…) },
//     "verify":{ "seeds":6,              // seeds to measure over (default 6)
//                "features":{ "bpm":3, "pump":2, ... } | ["bpm","pump",...],
//                "widen":0.15 } }        // extra fractional margin on ranges
// Every value in "anchor" is validated against the engine's live vocabulary
// (progressions, kits, patterns, synth models, sample ids) exactly like
// validate-genres gate 6 — a typo fails loudly here instead of silently
// rendering vaporwave defaults.

"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const ROOT = __dirname;
const K = require("./genre-kernel.js");
const V = require("./genre-verifier.js");
const E = require("./csd-engine.js");

// ---------- cli ----------
const argv = process.argv.slice(2);
const cmd = argv[0];
const posArgs = argv.slice(1).filter(a => !a.startsWith("--"));
const has = f => argv.includes("--" + f);
const opt = (f, d) => { const i = argv.indexOf("--" + f); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const die = m => { console.error("genre-tool: " + m); process.exit(1); };

// ---------- house-style JS serialisation ----------
// compact inline literal (valid JS: all keys are identifiers) — matches the way
// recipes appear on one line inside an anchor.
function inline(v) {
  if (v === null) return "null";
  if (typeof v === "number") return numStr(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return "[" + v.map(inline).join(",") + "]";
  return "{" + Object.entries(v).map(([k, x]) => k + ":" + inline(x)).join(", ") + "}";
}
function numStr(n) { return Object.is(n, -0) ? "0" : String(+n.toFixed(6)); }

// canonical dimension order (any extra keys append after `form`, before it if
// scalar-ish they still resolve — order is cosmetic only).
const FIELD_ORDER = ["bpm", "swing", "humanize", "progressions", "kits", "fills",
  "euclid", "chordEvery", "bass", "lead", "pads", "drums", "fx", "found",
  "rubato", "counterpoint", "thunk", "vox", "voxPoem", "voxClean",
  "sampleEvents", "snarePP", "vocal", "vocalVol", "vocSource",
  "realHats", "hits", "stab", "form"];

function serializeAnchor(name, a) {
  const keys = Object.keys(a).filter(k => k !== "label" && k !== "info");
  keys.sort((x, y) => {
    const ix = FIELD_ORDER.indexOf(x), iy = FIELD_ORDER.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  });
  const head = `    ${name}: { label:${JSON.stringify(a.label)}, info:${JSON.stringify(a.info)},`;
  const body = keys.map(k => `      ${k}:${inline(a[k])}`);
  return head + "\n" + body.join(",\n") + " },";
}
function serializeTarget(name, t) {
  const pad = name.length < 9 ? " ".repeat(9 - name.length) : "";
  return `    ${name}:${pad}{ ` + Object.entries(t).map(([k, r]) => `${k}:[${numStr(r[0])},${numStr(r[1])},${r[2]}]`).join(", ") + " },";
}

// ---------- vocabulary validation (mirrors validate-genres gate 6) ----------
function buildVocab() {
  const engineSrc = fs.readFileSync(path.join(ROOT, "csd-engine.js"), "utf8");
  const stateEngineSrc = fs.readFileSync(path.join(ROOT, "faust", "state-engine.js"), "utf8");
  const scrape = (src, re, seed) => { const s = new Set(seed || []); for (const m of src.matchAll(re)) s.add(m[1]); return s; };
  const models = scrape(stateEngineSrc, /case "([a-zA-Z0-9_]+)":/g, ["saw", "stack", "noise", "boom", "sine", "dx7"]);
  for (const m of stateEngineSrc.matchAll(/["']?([a-zA-Z0-9]+)["']?\s*:\s*"(?:kick|snare|hat)/g)) models.add(m[1]);
  const keysOf = nm => {
    const m = engineSrc.match(new RegExp("const " + nm + "=\\{([^}]*(?:\\}[^}]*)*?)\\};"))
      || engineSrc.match(new RegExp("const " + nm + "=\\{([\\s\\S]*?)\\n"));
    const s = new Set(["off"]); if (m) for (const k of m[1].matchAll(/(\w+):/g)) s.add(k[1]); return s;
  };
  const sampleIds = new Set(Object.keys(K.SAMPLES));
  const sourceIds = new Set([...Object.keys(K.SOURCES), ...sampleIds]);
  return {
    models,
    progressions: new Set(Object.keys(E.PROGRESSIONS)),
    kits: new Set(E.DRUM_PATTERNS),
    fills: new Set(E.TRANSITIONS),
    bassPat: new Set(E.BASS_PATTERNS),
    melPat: new Set(E.MELODY_PATTERNS),
    stabs: keysOf("STAB_PATTERNS"),
    hitPats: keysOf("HIT_PATTERNS"),
    roles: scrape(engineSrc, /role===?"([a-z]+)"/g, ["bed"]),
    // forms: d4b1671 replaced the `c.form===` if/else chain with the FORMS graph
    // table, so the old source-scrape saw only "pop" and false-rejected every
    // real form (wave/dj/drop/ritual/anthem/transit). Read the live registry
    // (K.FORM_NAMES = the FORMS keys) — real typos still warn (validateSpec).
    forms: new Set([...(K.FORM_NAMES || []), "pop"]),
    samplers: new Set(Object.keys(K.SAMPLERS)),
    patches: new Set(Object.keys(K.DX7_PATCHES)),
    sampleIds, sourceIds,
  };
}

// schema = the set of dimension keys the kernel's own anchors use, plus the set
// that appear in EVERY anchor (the required core). Derived, never hardcoded.
// KNOWN also unions the dimensions the kernel SOURCE reads off an anchor
// (`GENRES[x].dim`, `g.dim`, `A.dim`) so a declared-but-not-yet-used dimension
// — e.g. chordEvery, whose first user is prelude — is recognised, not a typo.
function deriveSchema() {
  const anchors = Object.values(K.GENRES);
  const all = new Set(), counts = {};
  for (const a of anchors) for (const k of Object.keys(a)) { all.add(k); counts[k] = (counts[k] || 0) + 1; }
  const src = fs.readFileSync(path.join(ROOT, "genre-kernel.js"), "utf8");
  for (const re of [/GENRES\[[^\]]+\]\.([a-zA-Z]\w*)/g, /\bg\.([a-zA-Z]\w*)/g, /\.g\)\.([a-zA-Z]\w*)/g, /\bA\.([a-zA-Z]\w*)/g])
    for (const m of src.matchAll(re)) all.add(m[1]);
  // label/info are supplied at spec top level, not inside spec.anchor
  const required = [...all].filter(k => counts[k] === anchors.length && k !== "label" && k !== "info");
  return { known: all, required };
}

function validateSpec(spec, vocab, schema) {
  const errs = [];
  if (!spec.name || !/^[a-z][a-z0-9]*$/.test(spec.name)) errs.push(`name "${spec.name}" must be lower-case alnum`);
  if (!spec.anchor || typeof spec.anchor !== "object") errs.push("spec.anchor missing");
  const a = spec.anchor || {};
  // schema: unknown dimension keys are almost always typos
  for (const k of Object.keys(a)) if (!schema.known.has(k) && k !== "label" && k !== "info")
    errs.push(`unknown dimension "${k}" (not used by any existing anchor — typo?)`);
  for (const r of schema.required) if (!(r in a)) errs.push(`missing required dimension "${r}"`);
  const chk = (cond, msg) => { if (!cond) errs.push(msg); };
  const inSet = (set, v, what) => { for (const x of [].concat(v || [])) if (x != null && !set.has(x)) errs.push(`${what}: "${x}" not in registry`); };
  if (a.progressions) inSet(vocab.progressions, a.progressions, "progressions");
  if (a.kits) inSet(vocab.kits, a.kits, "kits");
  if (a.fills) inSet(vocab.fills, a.fills, "fills");
  const voice = (nm, o) => {
    if (!o) return;
    if (o.patterns) inSet(nm === "bass" ? vocab.bassPat : vocab.melPat, o.patterns, nm + ".patterns");
    if (o.recipe && o.recipe.model) inSet(vocab.models, o.recipe.model, nm + ".recipe.model");
    if (o.patchPool) inSet(vocab.patches, o.patchPool, nm + ".patchPool");
    if (o.samplerPool) inSet(vocab.samplers, o.samplerPool, nm + ".samplerPool");
  };
  voice("bass", a.bass); voice("lead", a.lead); voice("pads", a.pads);
  if (a.drums) { inSet(vocab.models, a.drums.kickModel, "drums.kickModel"); inSet(vocab.models, a.drums.snareModel, "drums.snareModel"); inSet(vocab.models, a.drums.hatModel, "drums.hatModel"); }
  if (a.found) { inSet(vocab.roles, a.found.role, "found.role"); inSet(vocab.sourceIds, a.found.sources, "found.sources"); }
  if (a.hits) { inSet(vocab.sourceIds, a.hits.sources, "hits.sources"); if (a.hits.pattern) chk(vocab.hitPats.has(a.hits.pattern), `hits.pattern "${a.hits.pattern}" unknown`); }
  if (a.vox) inSet(vocab.sampleIds, a.vox.sources, "vox.sources");
  if (Array.isArray(a.sampleEvents)) a.sampleEvents.forEach((se, i) => inSet(vocab.sourceIds, se.pool, `sampleEvents[${i}].pool`));
  for (const f of ["voxPoem", "vocSource"]) if (a[f]) inSet(vocab.sampleIds, [a[f]], f);
  if (a.stab) inSet(vocab.stabs, a.stab, "stab");
  if (a.form && !vocab.forms.has(a.form)) errs.push(`form "${a.form}" unknown (falls back to pop)`);
  return errs;
}

// ---------- measurement ----------
const NUMERIC_FEATS = ["bpm", "offgrid", "snareBalance", "hatDensity", "drumDensity",
  "variation", "wash", "sub", "motion", "seventh", "breakUse", "chopUse", "bedUse",
  "crackle", "pump", "comp", "swing", "humanize", "acoustic", "rubato", "leadVoices", "softTop"];
// per-feature margin + domain clamp for turning a measured spread into a target range
const FEAT = {
  bpm: { pad: 6, lo: 20, hi: 260, r: 0 }, offgrid: { pad: .08, lo: 0, hi: 1 },
  snareBalance: { pad: .2, lo: 0, hi: 3 }, hatDensity: { pad: .4, lo: 0, hi: 6 },
  drumDensity: { pad: .4, lo: 0, hi: 8 }, variation: { pad: .12, lo: 0, hi: 1 },
  wash: { pad: .1, lo: 0, hi: 1 }, sub: { pad: .15, lo: 0, hi: 1 }, motion: { pad: .15, lo: 0, hi: 1 },
  seventh: { pad: .15, lo: 0, hi: 1 }, breakUse: { pad: .08, lo: 0, hi: 1 }, chopUse: { pad: .1, lo: 0, hi: 1 },
  bedUse: { pad: .12, lo: 0, hi: 1 }, crackle: { pad: .1, lo: 0, hi: 1 }, pump: { pad: .1, lo: 0, hi: 1 },
  comp: { pad: .12, lo: 0, hi: 1 }, swing: { pad: .05, lo: 0, hi: 1 }, humanize: { pad: .1, lo: 0, hi: 1 },
  acoustic: { pad: .12, lo: 0, hi: 1 }, rubato: { pad: .008, lo: 0, hi: .2 },
  leadVoices: { pad: 1, lo: 1, hi: 12, r: 0 }, softTop: { pad: 0, lo: 0, hi: 1 },
};
const round = (x, p) => Math.round(x * 10 ** p) / 10 ** p;

function measure(genre, seeds) {
  const vecs = seeds.map(seed => V.features(K.track(genre, { seed })));
  const stats = {};
  for (const f of NUMERIC_FEATS) {
    const vs = vecs.map(v => v[f]).filter(x => typeof x === "number");
    if (!vs.length) continue;
    const min = Math.min(...vs), max = Math.max(...vs), mean = vs.reduce((a, b) => a + b, 0) / vs.length;
    stats[f] = { min, max, mean: +mean.toFixed(3) };
  }
  return { vecs, stats };
}
function rangeFor(f, stats, widen) {
  const c = FEAT[f] || { pad: .1, lo: 0, hi: 1 };
  const s = stats[f]; if (!s) return null;
  const span = Math.max(s.max - s.min, 0);
  const pad = c.pad + span * (widen || 0);
  let lo = Math.max(c.lo, s.min - pad), hi = Math.min(c.hi, s.max + pad);
  if (c.r === 0) { lo = Math.floor(lo); hi = Math.ceil(hi); }
  else { lo = round(lo, 3); hi = round(hi, 3); }
  return [lo, hi];
}

// ---------- scoring helpers ----------
// scoreRow is the verifier's shared piecewise-linear primitive (raw 0..100),
// imported so the tool and the verifier never drift.
const scoreRow = V.scoreRow;
const meanScore = (vecs, targetRow) => Math.round(vecs.reduce((s, f) => s + scoreRow(f, targetRow), 0) / vecs.length);

// ---------- derive + auto-tighten target row ----------
function deriveTargets(name, spec, stats, ownVecs) {
  const widen = (spec.verify && spec.verify.widen) || 0;
  // chosen features + weights
  let featWeights;
  const vf = spec.verify && spec.verify.features;
  if (Array.isArray(vf)) featWeights = Object.fromEntries(vf.map(f => [f, f === "bpm" ? 3 : 2]));
  else if (vf && typeof vf === "object") featWeights = Object.assign({}, vf);
  else featWeights = { bpm: 3, drumDensity: 2, wash: 1, pump: 1, swing: 2, seventh: 1, acoustic: 2, crackle: 1, sub: 1, motion: 1, bedUse: 1 };
  const row = {};
  for (const [f, w] of Object.entries(featWeights)) {
    const r = rangeFor(f, stats, widen);
    if (r) row[f] = [r[0], r[1], w];
  }
  if (!Object.keys(row).length) die("no measurable features for target row");

  // reference: existing genres' own diagonal (seeds 1-3) so we can tell if the
  // new target row would steal a diagonal. Compute once.
  const SEP_SEEDS = [1, 2, 3];
  const others = Object.keys(V.TARGETS).filter(g => g !== name && K.GENRES[g]);
  const otherVecs = {}, otherSelf = {};
  for (const g of others) {
    otherVecs[g] = SEP_SEEDS.map(seed => V.features(K.track(g, { seed })));
    otherSelf[g] = meanScore(otherVecs[g], V.TARGETS[g]);
  }
  // auto-tighten: while some existing genre scores >= its own diagonal on our
  // row (would knock it off), ADD the feature that best separates the worst
  // offenders (a feature where their mean sits outside our measured spread).
  const added = [];
  for (let iter = 0; iter < 8; iter++) {
    const conflicts = others.map(g => ({ g, cross: meanScore(otherVecs[g], row), self: otherSelf[g] }))
      .filter(c => c.cross >= c.self).sort((a, b) => (b.cross - b.self) - (a.cross - a.self));
    if (!conflicts.length) break;
    // rank candidate features by total separation across the current conflicts
    const cand = NUMERIC_FEATS.filter(f => !row[f] && stats[f]);
    let best = null;
    for (const f of cand) {
      const r = rangeFor(f, stats, widen); if (!r) continue;
      const scale = (FEAT[f] || { pad: .1 }).pad || .1;
      let sep = 0;
      for (const c of conflicts) {
        const gm = otherVecs[c.g].reduce((s, v) => s + (v[f] || 0), 0) / otherVecs[c.g].length;
        const d = gm < r[0] ? r[0] - gm : gm > r[1] ? gm - r[1] : 0;
        sep += Math.min(2, d / scale) * (c.cross - c.self + 1);
      }
      if (!best || sep > best.sep) best = { f, r, sep };
    }
    if (!best || best.sep <= 0) break;               // can't separate further with features
    row[best.f] = [best.r[0], best.r[1], 3];         // discriminators carry weight 3
    added.push(best.f);
  }
  const remaining = others.map(g => ({ g, cross: meanScore(otherVecs[g], row), self: otherSelf[g] })).filter(c => c.cross >= c.self);
  return { row, added, otherVecs, otherSelf, remaining };
}

// ---------- source splicing ----------
// tag = `${name}:${slot}` — anchor and clips both live in genre-kernel.js, so
// the slot suffix keeps their markers distinct (else the clips splice would
// find the anchor's marker and overwrite it). Idempotent: a prior insertion
// with the same tag is replaced in place. Inserts on their own lines.
function spliceBlock(file, terminator, blockText, tag) {
  let src = fs.readFileSync(file, "utf8");
  const marked = `\n    /* genre-tool:${tag} */\n` + blockText + `\n    /* /genre-tool:${tag} */`;
  const region = new RegExp("\\n[ \\t]*/\\* genre-tool:" + tag + " \\*/[\\s\\S]*?/\\* /genre-tool:" + tag + " \\*/");
  if (region.test(src)) { src = src.replace(region, marked); }        // replace prior tool insertion (idempotent)
  else {
    const i = src.indexOf(terminator);
    if (i < 0) die("insertion point not found in " + path.basename(file) + " (looked for: " + terminator.slice(0, 40) + "…)");
    src = src.slice(0, i) + marked + src.slice(i);
  }
  fs.writeFileSync(file, src);
}
const TERM = {
  genres: "\n  };\n\n  // ---------- transition micro-lick soloists",
  clips: "\n  };\n\n  // ---------- DX7 patch registry",
  targets: "\n  };\n\n  // the piecewise-linear target-row scorer",
};

// star-chart position -> explorer.html's POS table, inside the shared
// /* genre-tool:positions */ block (added 2026-07-04 when hogcore/prelude
// turned out to exist, play, and verify — but have no star). spec.pos is
// REQUIRED: [x,y] in the chart's logical px. Validates spacing against every
// existing star (the arabpop/triphop lesson: crowded stars blur blends);
// idempotent per-genre line replace inside the block.
function splicePosition(name, pos) {
  if (!Array.isArray(pos) || pos.length !== 2 || !pos.every(v => Number.isFinite(v)))
    die(`spec.pos required: [x,y] star-chart coordinates (logical px). A genre without a star is invisible in the explorer — pick a spot near its musical family, >=55px from every neighbor (see explorer.html POS).`);
  const file = path.join(ROOT, "explorer.html");
  let src = fs.readFileSync(file, "utf8");
  const OPEN = "/* genre-tool:positions */", CLOSE = "/* /genre-tool:positions */";
  if (src.indexOf(OPEN) < 0 || src.indexOf(CLOSE) < 0) die("positions marker block not found in explorer.html");
  // spacing check against every star already in the file (POS pairs)
  const near = [];
  for (const m of src.matchAll(/(\w+):\[(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\]/g)) {
    if (m[1] === name) continue;
    const d = Math.hypot(pos[0] - +m[2], pos[1] - +m[3]);
    if (d < 55) near.push(`${m[1]} (${d.toFixed(0)}px)`);
  }
  if (near.length) die(`spec.pos [${pos}] is <55px from: ${near.join(", ")} — crowded stars blur blends (the arabpop/triphop lesson). Pick a roomier spot.`);
  const line = `  ${name}:[${pos[0]},${pos[1]}],`;
  const mine = new RegExp("\\n[ \\t]*" + name + ":\\[[^\\]]*\\],(?=[\\s\\S]*?" + CLOSE.replace(/[/*]/g, "\\$&") + ")");
  if (mine.test(src.slice(src.indexOf(OPEN), src.indexOf(CLOSE) + CLOSE.length)))
    src = src.slice(0, src.indexOf(OPEN)) + src.slice(src.indexOf(OPEN)).replace(mine, "\n" + line);
  else src = src.slice(0, src.indexOf(CLOSE)) + line + "\n  " + src.slice(src.indexOf(CLOSE));
  fs.writeFileSync(file, src);
}

// ---------- gate run ----------
function runNode(args, label, ms) {
  process.stdout.write(`  ${label} … `);
  try {
    const out = cp.execFileSync("node", args, { cwd: ROOT, encoding: "utf8", timeout: ms || 120000, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out };
  } catch (e) { return { ok: false, out: (e.stdout || "") + (e.stderr || ""), code: e.status }; }
}

// ============================================================ commands
function cmdCreate() {
  const specPath = posArgs[0]; if (!specPath) die("usage: genre-tool.js create <spec.json>");
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const name = spec.name;
  const vocab = buildVocab(), schema = deriveSchema();
  const errs = validateSpec(spec, vocab, schema);
  if (errs.length) { console.error(`✗ ${name}: spec invalid`); errs.forEach(e => console.error("  - " + e)); process.exit(1); }
  const exists = !!K.GENRES[name];
  const toolMarked = fs.readFileSync(path.join(ROOT, "genre-kernel.js"), "utf8").includes(`/* genre-tool:${name}:genres */`);
  if (exists && !toolMarked && !has("force")) die(`genre "${name}" already exists as a hand-written anchor — pass --force to overwrite (won't; refuse)`);

  const anchor = Object.assign({ label: spec.label || name, info: spec.info || "" }, spec.anchor);
  K.GENRES[name] = anchor;                              // inject in-memory for measurement

  const seeds = Array.from({ length: parseInt(opt("seeds", (spec.verify && spec.verify.seeds) || 6), 10) }, (_, i) => i + 1);
  console.log(`\n▶ create ${name} — measuring ${seeds.length} seeds`);
  let m;
  try { m = measure(name, seeds); }
  catch (e) { die("render failed while measuring (" + (e.message || e) + ")"); }

  const { row, added, otherVecs, otherSelf, remaining } = deriveTargets(name, spec, m.stats, m.vecs);
  V.TARGETS[name] = row;                                // inject provisional targets

  // ---- report: self score + nearest neighbours (row) + who we crowd (column)
  const self = meanScore(m.vecs, row);
  const cross = Object.keys(V.TARGETS).filter(g => g !== name)
    .map(g => ({ g, s: meanScore(m.vecs, V.TARGETS[g]) })).sort((a, b) => b.s - a.s);
  const crowd = Object.keys(otherSelf).map(g => ({ g, cross: meanScore(otherVecs[g], row), self: otherSelf[g] }))
    .sort((a, b) => (b.cross - b.self) - (a.cross - a.self)).slice(0, 4);

  console.log("  measured target row:");
  console.log("    " + Object.entries(row).map(([k, r]) => `${k}[${r[0]},${r[1]}]·${r[2]}`).join("  "));
  if (added.length) console.log("  auto-added discriminators: " + added.join(", "));
  console.log(`  self-score: ${self}/100  (own tracks vs own targets)`);
  console.log("  nearest neighbours (this genre scored vs their targets): " + cross.slice(0, 4).map(c => `${c.g}:${c.s}`).join("  "));
  console.log("  genres we crowd (their tracks vs our targets, vs their own diagonal): " + crowd.map(c => `${c.g} ${c.cross}/${c.self}`).join("  "));
  if (remaining.length) console.log("  ⚠ still knocking off: " + remaining.map(c => `${c.g}(${c.cross}≥${c.self})`).join(", "));
  if (cross.length && cross[0].s > self) console.log(`  ⚠ scores higher AS ${cross[0].g} (${cross[0].s}) than itself (${self}) — anchor identity too weak`);

  if (has("dry-run")) { console.log("\n(dry-run: no files written)"); return; }

  // ---- write: anchor -> GENRES, clips -> GENRE_CLIPS, targets -> verifier
  spliceBlock(path.join(ROOT, "genre-kernel.js"), TERM.genres, serializeAnchor(name, anchor), name + ":genres");
  if (spec.clips && spec.clips.length)
    spliceBlock(path.join(ROOT, "genre-kernel.js"), TERM.clips, `    ${name}:${inline(spec.clips)},`, name + ":clips");
  spliceBlock(path.join(ROOT, "genre-verifier.js"), TERM.targets, serializeTarget(name, row), name + ":targets");
  splicePosition(name, spec.pos);   // star-chart coordinates (the hogcore lesson: a genre without a star is invisible-but-audible)
  console.log(`\n✓ wrote ${name}: anchor -> genre-kernel.js, target row -> genre-verifier.js${spec.clips ? ", clips -> GENRE_CLIPS" : ""}, star -> explorer.html`);

  // ---- gates
  if (has("skip-gates")) { console.log("\n(--skip-gates: run ./verify.sh and `node genre-verifier.js matrix` yourself)"); return; }
  console.log("\n▶ gates");
  const gm = runNode(["genre-verifier.js", "matrix", "--no-cache"], "matrix", 180000);
  const mline = (gm.out.match(/diagonal dominant: \d+\/\d+/) || [])[0] || "(no matrix line)";
  const mfail = gm.out.split("\n").filter(l => /✗/.test(l));
  console.log((gm.ok ? "PASS " : "FAIL ") + mline);
  mfail.slice(0, 8).forEach(l => console.log("      " + l.trim()));
  const gv = runNode(["validate-genres.js", "--quick"], "validate", 180000);
  const vres = (gv.out.match(/result: [A-Z]+[^\n]*/) || [])[0] || "(no result line)";
  console.log((gv.ok ? "PASS " : "FAIL ") + vres);
  if (!gv.ok) gv.out.split("\n").filter(l => /\[FAIL\]|\bx /.test(l)).slice(0, 8).forEach(l => console.log("      " + l.trim()));
  if (has("engine")) {
    const ge = runNode(["engine.test.js", "--quick"], "engine", 300000);
    console.log((ge.ok ? "PASS " : "FAIL ") + "engine.test");
    if (!ge.ok) ge.out.split("\n").slice(-8).forEach(l => console.log("      " + l.trim()));
  }
  if (!gm.ok || !gv.ok) process.exitCode = 1;
}

function cmdCheck() {
  const name = posArgs[0]; if (!name) die("usage: genre-tool.js check <name>");
  if (!K.GENRES[name]) die(`no such genre "${name}"`);
  const seeds = Array.from({ length: parseInt(opt("seeds", 6), 10) }, (_, i) => i + 1);
  const { vecs, stats } = measure(name, seeds);
  console.log(`\n▶ check ${name} — ${seeds.length} seeds`);
  console.log("  feature spread (min…max, mean):");
  for (const f of NUMERIC_FEATS) if (stats[f]) console.log(`    ${f.padEnd(13)} ${String(stats[f].min).padStart(7)} … ${String(stats[f].max).padStart(7)}   (${stats[f].mean})`);
  const T = V.TARGETS[name];
  if (T) {
    const self = meanScore(vecs, T);
    console.log(`  committed target row present — self-score ${self}/100`);
    const miss = [];
    for (const [k, [lo, hi]] of Object.entries(T)) if (stats[k] && (stats[k].min < lo || stats[k].max > hi)) miss.push(`${k} spread [${stats[k].min},${stats[k].max}] leaks target [${lo},${hi}]`);
    miss.forEach(l => console.log("    ~ " + l));
  } else console.log("  (no committed target row — unscored)");
  const cross = Object.keys(V.TARGETS).filter(g => g !== name).map(g => ({ g, s: meanScore(vecs, V.TARGETS[g]) })).sort((a, b) => b.s - a.s).slice(0, 5);
  console.log("  nearest neighbours: " + cross.map(c => `${c.g}:${c.s}`).join("  "));
}

// ============================================================ main
if (cmd === "create") cmdCreate();
else if (cmd === "check") cmdCheck();
else { console.log("usage:\n  node genre-tool.js create <spec.json> [--dry-run] [--skip-gates] [--seeds N] [--engine] [--force]\n  node genre-tool.js check <name> [--seeds N]"); process.exit(cmd ? 1 : 0); }
