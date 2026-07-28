#!/usr/bin/env node
// genre-tool.js — author a new genre anchor from a spec, MEASURE its verifier
// targets from real renders (never guess numbers), insert it into the kernel +
// verifier in the house style, and run the gates. Design: GENRE-SPACE.md +
// KERNEL-V4.md. Single-file, zero deps — reads the same capability files the
// rest of the suite does (genre-kernel.js / csd-engine.js / genre-verifier.js /
// faust/state-engine.js), so it always tracks the live schema.
//
//   node genre-tool.js init   <name> [--near <genre>] [--force]
//   node genre-tool.js create <spec.json> [--dry-run] [--seeds N] [--engine]
//   node genre-tool.js check  <name>      [--seeds N]
//
// init:    scaffold a starter genre-specs/<name>.json by cloning an existing
//          genre's spec (the --near genre, else the lexically-nearest one) —
//          anchor copied verbatim, label/info replaced with TODO placeholders,
//          so a newcomer edits a working anchor instead of a blank file. Pure,
//          offline, writes only the one new spec file.
//
// create:  validate spec -> build anchor -> MEASURE features across N seeds ->
//          derive TARGET ranges from the measured spread (auto-tightening until
//          no existing genre is knocked off its own diagonal) -> splice anchor
//          into GENRES (genre-kernel.js) and the TARGET row into
//          genre-verifier.js -> run gates (matrix + validate).
// check:   re-measure an existing genre: feature stats, self-score, nearest
//          neighbours, and whether its committed target row still fits. No writes.
//
// SPEC FORMAT (see genre-specs/*.json):
//   { "name":"hogcore", "label":"Hogcore", "info":"one-line pitch",
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
const ROOT = path.join(__dirname, "..", "engine");
const K = require("../engine/genre-kernel.js");
const V = require("../engine/genre-verifier.js");
const E = require("../engine/csd-engine.js");

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
  // label/info are supplied at spec top level, not inside spec.anchor.
  // theory/pipes/rhythm are AUTO-DERIVED at kernel load (deriveMind attaches
  // them to every anchor), so counts[k]===anchors.length lies about them being
  // author-required — a spec correctly omits them (MUSIC-MIND).
  const DERIVED = new Set(["theory", "pipes", "rhythm"]);
  const required = [...all].filter(k => counts[k] === anchors.length && k !== "label" && k !== "info" && !DERIVED.has(k));
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
// tag = `${name}:${slot}` — the slot suffix keeps markers for different slots
// in the same file distinct. Idempotent: a prior insertion with the same tag
// is replaced in place. Inserts on their own lines.
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
  // GENRES lives in engine/genres-data.js since Stage E1, so the terminator is
  // the data module's own footer rather than the kernel section that used to
  // follow the literal.
  genres: "\n  };\n  if (typeof module !== \"undefined\" && module.exports)",
  targets: "\n  };\n\n  // the piecewise-linear target-row scorer",
};

// star-chart position -> explorer.html's POS table, inside the shared
// /* genre-tool:positions */ block — without it a genre can exist, play and
// verify while having no star on the map (hogcore/prelude did). spec.pos is
// REQUIRED: [x,y] in the chart's logical px. Validates spacing against every
// existing star (the arabpop/triphop lesson: crowded stars blur blends);
// idempotent per-genre line replace inside the block.
function splicePosition(name, pos) {
  // POS lives in app/world.js (a BAKED cache of
  // computeGenreLayout — world.js:52-72). spec.pos is now OPTIONAL: a genre
  // missing from POS gets a derived spot at first boot (starmap.js fast-path
  // miss -> similarity-seeded relaxation) and the batch re-bake pastes
  // window.__X.POS back. With pos given, we splice it directly so boot stays
  // on the fast path.
  if (pos == null) { console.log(`  pos: none given — boot will derive a star near ${name}'s musical family; re-bake app/world.js POS after the batch`); return; }
  if (!Array.isArray(pos) || pos.length !== 2 || !pos.every(v => Number.isFinite(v)))
    die(`spec.pos must be [x,y] star-chart coordinates (logical px), or omitted to let boot derive one.`);
  const file = path.join(__dirname, "..", "app", "world.js");
  let src = fs.readFileSync(file, "utf8");
  const OPEN = "export const POS={", CLOSE = "\n};";
  if (src.indexOf(OPEN) < 0) die("POS table not found in app/world.js");
  // spacing check against every star already in the file (POS pairs)
  const near = [];
  for (const m of src.matchAll(/(\w+):\[(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\]/g)) {
    if (m[1] === name) continue;
    const d = Math.hypot(pos[0] - +m[2], pos[1] - +m[3]);
    if (d < 55) near.push(`${m[1]} (${d.toFixed(0)}px)`);
  }
  if (near.length) die(`spec.pos [${pos}] is <55px from: ${near.join(", ")} — crowded stars blur blends (the arabpop/triphop lesson). Pick a roomier spot.`);
  // idempotent per-genre replace inside the POS object; NEW entries insert
  // right AFTER the opening brace — always comma-valid (the table's last line
  // carries no trailing comma, so tail-insertion would be a syntax error).
  const blockEnd = src.indexOf(CLOSE, src.indexOf(OPEN));
  const block = src.slice(src.indexOf(OPEN), blockEnd);
  const mine = new RegExp("([,{\\n][ \\t]*)" + name + ":\\[[^\\]]*\\]");
  if (mine.test(block))
    src = src.slice(0, src.indexOf(OPEN)) + block.replace(mine, `$1${name}:[${pos[0]},${pos[1]}]`) + src.slice(blockEnd);
  else
    src = src.replace(OPEN, OPEN + `\n  ${name}:[${pos[0]},${pos[1]}],`);
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
  const toolMarked = fs.readFileSync(path.join(ROOT, "genres-data.js"), "utf8").includes(`/* genre-tool:${name}:genres */`);
  if (exists && !toolMarked && !has("force")) die(`genre "${name}" already exists as a hand-written anchor — pass --force to overwrite (won't; refuse)`);

  const anchor = Object.assign({ label: spec.label || name, info: spec.info || "" }, spec.anchor);
  K.GENRES[name] = anchor;                              // inject in-memory for measurement
  // MUSIC-MIND: the kernel attaches theory/pipes/rhythm to every
  // anchor at LOAD — an anchor injected after load must get the same pass or
  // resolveMulti crashes on g.theory.adventure. deriveMind is guarded
  // (if(!g.theory) etc.), so re-running it on a splice-marked anchor is a no-op.
  K.deriveMind(name, anchor);

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

  // ---- write: anchor -> GENRES, targets -> verifier
  spliceBlock(path.join(ROOT, "genres-data.js"), TERM.genres, serializeAnchor(name, anchor), name + ":genres");
  spliceBlock(path.join(ROOT, "genre-verifier.js"), TERM.targets, serializeTarget(name, row), name + ":targets");
  splicePosition(name, spec.pos);   // star-chart coordinates (the hogcore lesson: a genre without a star is invisible-but-audible)
  console.log(`\n✓ wrote ${name}: anchor -> genres-data.js, target row -> genre-verifier.js, star -> explorer.html`);

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

// ============================================================ init (scaffold)
// init <name> [--near <genre>]: write a starter genre-specs/<name>.json by
// CLONING an existing genre's spec as an editable template — anchor copied
// verbatim, label/info replaced with TODO placeholders. Pure/offline: reads
// K.GENRES (and the existing spec file if one exists), never
// touches the render path, never mutates global state. A newcomer edits a real
// working anchor instead of authoring 25 typed dimensions from a blank file
// (ROADMAP §3.1.5). The template is the --near genre, or — when omitted — the
// lexically-nearest existing genre name (deterministic; no feature cache
// needed, so init works on a fresh clone before matrix.json is built).
const SPECS_DIR = path.join(__dirname, "..", "genre-specs");
const clone = v => JSON.parse(JSON.stringify(v));    // specs are pure JSON — round-trip is a faithful deep copy
const DERIVED_KEYS = new Set(["label", "info", "theory", "pipes", "rhythm"]);

// Levenshtein edit distance for the name-nearest fallback (deterministic).
function editDist(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// nearest existing genre BY NAME (ties broken alphabetically for determinism).
function nearestByName(name) {
  let best = null;
  for (const g of Object.keys(K.GENRES).sort()) {
    const d = editDist(name, g);
    if (!best || d < best.d) best = { g, d };
  }
  return best;
}

// Build a template spec for `near`: prefer the hand-written genre-specs/<near>.json
// (keeps the author's verify block + recipe layout); otherwise reconstruct from
// the live kernel anchor + clip pool. Returns { source, spec }.
function loadTemplate(near) {
  const specFile = path.join(SPECS_DIR, near + ".json");
  if (fs.existsSync(specFile)) {
    let s; try { s = JSON.parse(fs.readFileSync(specFile, "utf8")); }
    catch (e) { die(`template spec genre-specs/${near}.json is not valid JSON (${e.message})`); }
    return { source: "spec-file", spec: s };
  }
  const a = K.GENRES[near];
  const anchor = {};
  for (const k of Object.keys(a)) if (!DERIVED_KEYS.has(k)) anchor[k] = clone(a[k]);
  const spec = { name: near, label: a.label || near, info: a.info || "", anchor };
  return { source: "kernel-anchor", spec };
}

// ============================================================ export
// A genre is SEVEN things — anchor, mind override, verifier target row, star
// position, percussion style, name/blurb, and how it was invented. The spec
// folder described one and a half of them, for half the catalogue, in one
// direction only: genre-tool wrote specs, every later edit happened by hand in
// the kernel, and nothing was ever written back. So 135 files covered 274
// genres, 115 had drifted from what ships, and all 135 labels were stale.
//
// export is the direction that was missing. It reads the LIVE anchor and emits
// the spec that would produce it, which makes the format bidirectional and the
// folder true. Four top-level keys are dropped on the way out because nothing
// reads them any more: clips (GENRE_CLIPS is gone), materials, invented, damp.
//
// Three keys are NEW, and they are the ones that close the authorability gap
// the plan measured (the kernel uses 289 anchor paths; specs could express 184):
//   mind     the derived theory/pipes/rhythm axes. Written for READING and for
//            overriding; deriveMind recomputes them at load, so a spec that
//            carries them is describing, not dictating.
//   perc     PERC_STYLES[genre] — keyed by genre NAME in the kernel, so it was
//            never an anchor key and never authorable.
//   targets  the verifier row. It lives in genre-verifier.js and is the single
//            biggest thing a spec could not say about its own genre.
function specFor(name) {
  const g = K.GENRES[name];
  if (!g) die(`unknown genre "${name}"`);
  const DERIVED = new Set(["theory", "pipes", "rhythm"]);   // deriveMind attaches these at load
  const anchor = {};
  for (const k of Object.keys(g)) {
    if (k === "label" || k === "info" || DERIVED.has(k)) continue;
    anchor[k] = g[k];
  }
  const ordered = {};
  for (const k of FIELD_ORDER) if (k in anchor) ordered[k] = anchor[k];
  for (const k of Object.keys(anchor)) if (!(k in ordered)) ordered[k] = anchor[k];   // anything FIELD_ORDER has not learned yet

  const out = { name, label: g.label || name, info: g.info || "" };
  const pos = POS_TABLE[name];
  if (pos) out.pos = pos;
  out.anchor = ordered;
  const mind = {};
  if (g.theory) mind.theory = g.theory;
  if (g.pipes) mind.pipes = g.pipes;
  if (g.rhythm != null) mind.rhythm = g.rhythm;
  if (Object.keys(mind).length) out.mind = mind;
  if (K.PERC_STYLES && K.PERC_STYLES[name]) out.perc = K.PERC_STYLES[name];
  const V = require(path.join(ROOT, "genre-verifier.js"));
  if (V.TARGETS && V.TARGETS[name]) out.targets = V.TARGETS[name];
  return out;
}

// The star positions live in app/world.js as a baked ES-module literal; parse
// rather than import so this stays a plain CJS tool.
const POS_TABLE = (() => {
  try {
    const src = fs.readFileSync(path.join(__dirname, "..", "app", "world.js"), "utf8");
    const b = src.match(/export const POS=\{([\s\S]*?)\n\};/);
    const out = {};
    if (b) for (const m of b[1].matchAll(/(\w+):\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g))
      out[m[1]] = [+m[2], +m[3]];
    return out;
  } catch (e) { return {}; }
})();

// Pretty-print with SHORT PRIMITIVE ARRAYS INLINE. Plain JSON.stringify(x,null,2)
// puts every element of [104,126] on its own line, which turns a 40-line spec
// into 400 and makes the folder unreadable — the opposite of the point. Ranges,
// pools and target rows stay on one line; objects and long arrays still break.
function pretty(v, indent = "") {
  const pad = indent + "  ";
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    const flat = v.every((x) => x === null || typeof x !== "object");
    if (flat) {
      const one = "[" + v.map((x) => JSON.stringify(x)).join(", ") + "]";
      if (one.length + indent.length <= 96) return one;
    }
    return "[\n" + v.map((x) => pad + pretty(x, pad)).join(",\n") + "\n" + indent + "]";
  }
  if (v && typeof v === "object") {
    const ks = Object.keys(v);
    if (!ks.length) return "{}";
    return "{\n" + ks.map((k) => pad + JSON.stringify(k) + ": " + pretty(v[k], pad)).join(",\n") + "\n" + indent + "}";
  }
  return JSON.stringify(v);
}

function cmdExport() {
  const all = has("all");
  const which = all ? Object.keys(K.GENRES) : posArgs;
  if (!which.length) die("usage: genre-tool.js export <genre> | --all [--dry-run]");
  let wrote = 0, same = 0;
  for (const name of which) {
    const spec = specFor(name);
    const file = path.join(SPECS_DIR, name + ".json");
    const text = pretty(spec) + "\n";
    const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (prev === text) { same++; continue; }
    if (!has("dry-run")) fs.writeFileSync(file, text);
    wrote++;
    if (!all) console.log(`${prev === null ? "created" : "updated"} genre-specs/${name}.json`);
  }
  console.log(`export: ${wrote} ${has("dry-run") ? "would change" : "written"}, ${same} already current (${which.length} genres)`);
}

function cmdInit() {
  const name = posArgs[0];
  if (!name) die("usage: genre-tool.js init <name> [--near <genre>]");
  if (!/^[a-z][a-z0-9]*$/.test(name)) die(`name "${name}" must be lower-case alphanumeric (start with a letter)`);
  const outFile = path.join(SPECS_DIR, name + ".json");
  if (fs.existsSync(outFile) && !has("force")) die(`genre-specs/${name}.json already exists — pass --force to overwrite`);

  // choose the template genre
  const nearOpt = opt("near", null);
  let near, reason;
  if (nearOpt != null) {
    if (!K.GENRES[nearOpt]) die(`--near "${nearOpt}" is not an existing genre (see K.GENRES / genre-verifier.js matrix)`);
    if (nearOpt === name) die(`--near cannot be the genre you are creating ("${name}")`);
    near = nearOpt; reason = "requested via --near";
  } else {
    const nb = nearestByName(name);
    near = nb.g; reason = `lexically-nearest existing genre (edit-distance ${nb.d}; pass --near to choose deliberately)`;
  }

  const tmpl = loadTemplate(near);
  const out = {
    name,
    label: `TODO: display label for ${name}`,
    info: `TODO: one-line pitch. Scaffolded from ${near} (${reason}) — edit the anchor below so this genre is musically distinct.`,
    anchor: clone(tmpl.spec.anchor),
  };
  if (tmpl.spec.verify) out.verify = clone(tmpl.spec.verify);

  // Re-key so serialized order reads well: name, label, info, anchor, verify.
  const ordered = { name: out.name, label: out.label, info: out.info };
  ordered.anchor = out.anchor;
  if (out.verify) ordered.verify = out.verify;

  fs.writeFileSync(outFile, JSON.stringify(ordered, null, 2) + "\n");
  console.log(`✓ scaffolded genre-specs/${name}.json`);
  console.log(`  template : ${near}  (${reason})`);
  console.log(`  source   : ${tmpl.source === "spec-file" ? "genre-specs/" + near + ".json" : "live kernel anchor"}`);
  console.log(`  anchor   : ${Object.keys(out.anchor).length} dimensions copied${out.verify ? ", verify block carried over" : ""}`);
  console.log(`  next     : edit label/info + the anchor, then  node tools/genre-tool.js create genre-specs/${name}.json --dry-run`);
}

// ============================================================ exports
// The measure -> derive -> serialize -> splice machinery is reused by
// tools/invent-genres.js (the gap-finding invention pipeline), so it requires
// this file as a library. Everything below the guard runs ONLY as a CLI.
module.exports = {
  inline, numStr, serializeAnchor, serializeTarget, spliceBlock, splicePosition, TERM,
  buildVocab, deriveSchema, validateSpec, measure, rangeFor, deriveTargets,
  meanScore, scoreRow, NUMERIC_FEATS, FEAT,
};

// ============================================================ main
if (require.main === module) {
  if (cmd === "create") cmdCreate();
  else if (cmd === "check") cmdCheck();
  else if (cmd === "init") cmdInit();
  else if (cmd === "export") cmdExport();
  else { console.log("usage:\n  node genre-tool.js init   <name> [--near <genre>] [--force]\n  node genre-tool.js create <spec.json> [--dry-run] [--skip-gates] [--seeds N] [--engine] [--force]\n  node genre-tool.js check  <name> [--seeds N]\n  node genre-tool.js export <genre> | --all [--dry-run]"); process.exit(cmd ? 1 : 0); }
}
