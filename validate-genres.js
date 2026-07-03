#!/usr/bin/env node
// validate-genres.js — the differentiation guarantee for the genre kernel.
//
// GENRE-SPACE.md claims a genre is a POINT in a deterministic multidimensional
// space. This framework turns that claim into gates (policy: VALIDATION.md):
//
//   1 determinism   same seed -> byte-identical state + events        (FAIL)
//   2 dominance     every genre scores highest as itself, multi-seed  (FAIL <80%)
//   3 margin        self-score minus best rival, per genre            (WARN <3)
//   4 geometry      within-genre distance < nearest-other centroid    (WARN <90%)
//   5 blend paths   scores morph monotonically along blend(a,b,t)     (WARN)
//   6 vocabulary    every anchor reference resolves in the engine     (FAIL)
//   7 --audio       optional empirical probe via audio-verifier.py    (WARN/skip)
//
//   node validate-genres.js [--seeds N] [--quick] [--json] [--audio]
//
// Zero dependencies; consumes genre-kernel.js / csd-engine.js / genre-verifier.js
// read-only, so it automatically covers new anchors as they land.

"use strict";
const fs = require("fs");
const path = require("path");
const K = require("./genre-kernel.js");
const E = require("./csd-engine.js");
const V = require("./genre-verifier.js");

// ---------- CLI ----------
const args = process.argv.slice(2);
const has = (f) => args.includes("--" + f);
const flag = (f, d) => { const i = args.indexOf("--" + f); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const QUICK = has("quick");
const N_SEEDS = Math.max(2, Math.min(25, parseInt(flag("seeds", QUICK ? 2 : 5), 10) || (QUICK ? 2 : 5)));
const JSON_OUT = has("json");
const AUDIO = has("audio");
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => i + 1);

const allGenres = Object.keys(K.GENRES);
const scoredGenres = allGenres.filter((g) => V.TARGETS[g]);   // gates 2-5 need target ranges
const result = { meta: { date: new Date().toISOString(), seeds: SEEDS, quick: QUICK,
  genres: allGenres.length, scored: scoredGenres.length }, gates: {} };

const log = (...a) => { if (!JSON_OUT) console.log(...a); };
const pct = (x) => Math.round(x * 100) + "%";
const fmt = (x, p) => (Math.round(x * 10 ** (p == null ? 1 : p)) / 10 ** (p == null ? 1 : p)).toFixed(p == null ? 1 : p);

// deep-compare helper: section ids come from a module-global counter and are
// cosmetic, so strip every "id"/"label" key before comparing.
const canon = (o) => JSON.stringify(o, (k, v) => (k === "id" || k === "label" ? undefined : v));

// cache: one track state + feature vector per (genre, seed) — shared by gates 2/3/4
const stateCache = {}, featCache = {}, trackErrors = [];
function trackOf(g, seed) {
  const key = g + ":" + seed;
  if (!(key in stateCache)) {
    try { stateCache[key] = K.track(g, { seed }); }
    catch (e) { stateCache[key] = null; trackErrors.push({ genre: g, seed, error: String(e.message || e) }); }
  }
  return stateCache[key];
}
function featOf(g, seed) {
  const key = g + ":" + seed;
  if (!(key in featCache)) {
    const st = trackOf(g, seed);
    try { featCache[key] = st ? V.features(st) : null; }
    catch (e) { featCache[key] = null; trackErrors.push({ genre: g, seed, error: "features: " + String(e.message || e) }); }
  }
  return featCache[key];
}

// ============================================================ gate 1: determinism
function gateDeterminism() {
  const failures = [];
  const detSeeds = QUICK ? [1] : [1, SEEDS[SEEDS.length - 1]];
  for (const g of allGenres) {
    for (const seed of detSeeds) {
      let s1, s2;
      try { s1 = K.track(g, { seed }); s2 = K.track(g, { seed }); }
      catch (e) { failures.push({ genre: g, seed, what: "track threw: " + String(e.message || e) }); continue; }
      if (canon(s1) !== canon(s2)) { failures.push({ genre: g, seed, what: "track state differs across identical calls" }); continue; }
      try {
        const e1 = JSON.stringify(E.buildEvents(s1));
        const e2 = JSON.stringify(E.buildEvents(s1));     // same state twice: buildEvents must be pure
        const e3 = JSON.stringify(E.buildEvents(s2));     // regenerated state: whole pipeline
        if (e1 !== e2) failures.push({ genre: g, seed, what: "buildEvents not pure (differs on same state)" });
        else if (e1 !== e3) failures.push({ genre: g, seed, what: "events differ across regenerated states" });
      } catch (e) { failures.push({ genre: g, seed, what: "buildEvents threw: " + String(e.message || e) }); }
    }
  }
  // blends must be deterministic too — the explorer's whole path depends on it
  const bp = scoredGenres.length >= 2 ? [[scoredGenres[0], scoredGenres[scoredGenres.length - 1]]] : [];
  for (const [a, b] of bp) {
    try {
      const b1 = K.blend(a, b, 0.5, { seed: 3 }), b2 = K.blend(a, b, 0.5, { seed: 3 });
      if (canon(b1) !== canon(b2)) failures.push({ genre: a + "+" + b, seed: 3, what: "blend state differs across identical calls" });
    } catch (e) { failures.push({ genre: a + "+" + b, seed: 3, what: "blend threw: " + String(e.message || e) }); }
  }
  const status = failures.length ? "FAIL" : "PASS";
  result.gates.determinism = { status, checked: allGenres.length * detSeeds.length, failures };
  log(`[${status}] 1 determinism — ${allGenres.length} genres x ${detSeeds.length} seeds, state+events byte-stable`);
  failures.slice(0, 8).forEach((f) => log(`       x ${f.genre} seed=${f.seed}: ${f.what}`));
  return status;
}

// ============================================================ gates 2+3: dominance + margin
function gateDominanceAndMargin() {
  const perGenre = {};   // g -> {wins, margins[], rivals:{r:count}}
  for (const g of scoredGenres) {
    const rec = { wins: 0, n: 0, margins: [], rivals: {} };
    for (const seed of SEEDS) {
      const f = featOf(g, seed); if (!f) continue;
      let self = null, bestOther = -1, rival = null;
      for (const tgt of scoredGenres) {
        const s = V.scoreAgainst(f, tgt).score;
        if (tgt === g) self = s;
        else if (s > bestOther) { bestOther = s; rival = tgt; }
      }
      rec.n++;
      if (self >= bestOther) rec.wins++;                      // tie counts as a win, matching genre-verifier matrix
      rec.margins.push(self - bestOther);
      rec.rivals[rival] = (rec.rivals[rival] || 0) + 1;
    }
    perGenre[g] = rec;
  }
  // --- gate 2: win rate ---
  const winRate = {}, g2fail = [];
  for (const g of scoredGenres) {
    const r = perGenre[g];
    winRate[g] = r.n ? r.wins / r.n : 0;
    if (winRate[g] < 0.8) g2fail.push({ genre: g, winRate: winRate[g],
      topRival: Object.entries(r.rivals).sort((a, b) => b[1] - a[1])[0][0] });
  }
  const s2 = g2fail.length ? "FAIL" : "PASS";
  result.gates.dominance = { status: s2, seeds: N_SEEDS, winRate, failures: g2fail };
  log(`[${s2}] 2 diagonal dominance — every genre wins as itself across ${N_SEEDS} seeds (gate: >=80%)`);
  g2fail.forEach((f) => log(`       x ${f.genre}: wins ${pct(f.winRate)} of seeds (loses to ${f.topRival})`));

  // --- gate 3: separation margin ---
  const margins = {}, weak = [], confusion = {};
  for (const g of scoredGenres) {
    const r = perGenre[g];
    const mean = r.margins.length ? r.margins.reduce((a, b) => a + b, 0) / r.margins.length : 0;
    margins[g] = +fmt(mean, 2);
    if (mean < 3) weak.push({ genre: g, margin: margins[g] });
    for (const [rv, c] of Object.entries(r.rivals)) {
      const key = g + " -> " + rv;
      confusion[key] = (confusion[key] || 0) + c;
    }
  }
  const weakest = Object.entries(margins).sort((a, b) => a[1] - b[1]).slice(0, 5)
    .map(([g, m]) => ({ genre: g, margin: m, topRival: Object.entries(perGenre[g].rivals).sort((a, b) => b[1] - a[1])[0][0] }));
  const confused = Object.entries(confusion).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([pair, count]) => ({ pair, count }));
  const s3 = weak.length ? "WARN" : "PASS";
  result.gates.margin = { status: s3, margins, weakest, mostConfused: confused, below3: weak };
  log(`[${s3}] 3 separation margin — mean self-minus-best-rival per genre (gate: >=3 pts, warn 0-3)`);
  log(`       weakest: ` + weakest.map((w) => `${w.genre} ${w.margin >= 0 ? "+" : ""}${w.margin} (vs ${w.topRival})`).join(", "));
  log(`       most-confused: ` + confused.map((c) => `${c.pair} x${c.count}`).join(", "));
  return { s2, s3 };
}

// ============================================================ gate 4: feature-space geometry
function gateGeometry() {
  // points = the verifier's symbolic feature vector per (genre, seed), z-scored per dimension
  const pts = [];
  for (const g of scoredGenres) for (const seed of SEEDS) {
    const f = featOf(g, seed); if (f) pts.push({ g, seed, f });
  }
  if (!pts.length) { result.gates.geometry = { status: "WARN", note: "no points" }; return "WARN"; }
  const dims = Object.keys(pts[0].f).filter((k) => typeof pts[0].f[k] === "number");
  const mean = {}, sd = {};
  for (const d of dims) {
    const vs = pts.map((p) => p.f[d]);
    mean[d] = vs.reduce((a, b) => a + b, 0) / vs.length;
    sd[d] = Math.sqrt(vs.reduce((a, v) => a + (v - mean[d]) ** 2, 0) / vs.length) || 1;
  }
  const vec = (f) => dims.map((d) => (f[d] - mean[d]) / sd[d]);
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  pts.forEach((p) => { p.v = vec(p.f); });
  const centroids = {};
  for (const g of scoredGenres) {
    const mine = pts.filter((p) => p.g === g); if (!mine.length) continue;
    centroids[g] = dims.map((_, i) => mine.reduce((s, p) => s + p.v[i], 0) / mine.length);
  }
  let ok = 0; const offenders = [], perGenre = {};
  for (const p of pts) {
    const within = dist(p.v, centroids[p.g]);
    let nearest = Infinity, who = null;
    for (const [g, c] of Object.entries(centroids)) {
      if (g === p.g) continue;
      const d = dist(p.v, c); if (d < nearest) { nearest = d; who = g; }
    }
    const good = within < nearest;
    if (good) ok++; else offenders.push({ genre: p.g, seed: p.seed, within: +fmt(within, 2), nearestOther: +fmt(nearest, 2), confusedWith: who });
    const r = (perGenre[p.g] = perGenre[p.g] || { within: 0, sep: 0, n: 0 });
    r.within += within; r.sep += nearest; r.n++;
  }
  const frac = ok / pts.length;
  const genreStats = Object.fromEntries(Object.entries(perGenre).map(([g, r]) =>
    [g, { meanWithin: +fmt(r.within / r.n, 2), meanNearestOther: +fmt(r.sep / r.n, 2) }]));
  const worst = Object.entries(genreStats).sort((a, b) =>
    (a[1].meanNearestOther - a[1].meanWithin) - (b[1].meanNearestOther - b[1].meanWithin)).slice(0, 5);
  const status = frac >= 0.9 ? "PASS" : "WARN";
  result.gates.geometry = { status, points: pts.length, fracWithinCloser: +fmt(frac, 3), offenders, perGenre: genreStats };
  log(`[${status}] 4 feature-space geometry — ${pct(frac)} of ${pts.length} genre-seed points sit closer to their own centroid than any other (gate: >=90%)`);
  log(`       tightest margins: ` + worst.map(([g, s]) => `${g} (within ${s.meanWithin} vs other ${s.meanNearestOther})`).join(", "));
  offenders.slice(0, 6).forEach((o) => log(`       ~ ${o.genre} seed=${o.seed} drifts toward ${o.confusedWith} (${o.within} vs ${o.nearestOther})`));
  return status;
}

// ============================================================ gate 5: blend monotonicity
function gateBlend() {
  const CANDIDATES = [["techno", "vaporwave"], ["jungle", "ambient"], ["house", "lofi"],
    ["synthwave", "triphop"], ["edm", "neoclassical"], ["dubstep", "downtempo"],
    ["trance", "blues"], ["disco", "doomdrone"], ["jazz", "chiptune"]];
  const pairs = CANDIDATES.filter(([a, b]) => V.TARGETS[a] && V.TARGETS[b] && K.GENRES[a] && K.GENRES[b]).slice(0, 6);
  const ts = [0, 0.25, 0.5, 0.75, 1];
  const seeds = SEEDS.slice(0, Math.min(3, N_SEEDS));
  const TOL = 2;   // score points an adjacent step may move the "wrong" way before it counts as a reversal
  const violations = [], tested = [];
  for (const [a, b] of pairs) {
    for (const seed of seeds) {
      let sa = [], sb = [], broken = false;
      for (const t of ts) {
        try {
          const sc = V.analyze(K.blend(a, b, t, { seed })).scores;
          sa.push(sc[a]); sb.push(sc[b]);
        } catch (e) { violations.push({ pair: a + "->" + b, seed, what: "blend/analyze threw: " + String(e.message || e) }); broken = true; break; }
      }
      if (broken) continue;
      const rev = (seq, dir) => seq.slice(1).filter((v, i) => dir * (v - seq[i]) > TOL).length;
      const ra = rev(sa, +1);   // a-score should be non-increasing as t grows
      const rb = rev(sb, -1);   // b-score should be non-decreasing
      tested.push({ pair: a + "->" + b, seed, a: sa, b: sb, reversalsA: ra, reversalsB: rb });
      if (ra > 1) violations.push({ pair: a + "->" + b, seed, what: `score[${a}] rises ${ra}x along t (${sa.join(",")})` });
      if (rb > 1) violations.push({ pair: a + "->" + b, seed, what: `score[${b}] falls ${rb}x along t (${sb.join(",")})` });
    }
  }
  const status = violations.length ? "WARN" : "PASS";
  result.gates.blend = { status, pairs: pairs.map((p) => p.join("->")), seeds, tolerance: { points: TOL, reversalsAllowed: 1 }, tested, violations };
  log(`[${status}] 5 blend monotonicity — ${pairs.length} pairs x ${seeds.length} seeds x t=0..1: paths through the space morph, not jump (allow 1 noisy reversal)`);
  violations.slice(0, 8).forEach((v) => log(`       ~ ${v.pair} seed=${v.seed}: ${v.what}`));
  return status;
}

// ============================================================ gate 6: vocabulary integrity
function gateVocabulary() {
  const errors = [], warnings = [];
  // valid names scraped from the SOURCE of the engine/kernel so new vocabulary
  // (models, stab/hit patterns, forms) is picked up without editing this file.
  const engineSrc = fs.readFileSync(require.resolve("./csd-engine.js"), "utf8");
  const kernelSrc = fs.readFileSync(require.resolve("./genre-kernel.js"), "utf8");
  // synthesis-model vocabulary now lives in the Faust engine's state mapping
  // (faust/state-engine.js pitchedUnit switch + the drum module maps); the
  // csound codegen this used to scrape is on branch legacy-csound.
  const stateEngineSrc = fs.readFileSync(require.resolve("./faust/state-engine.js"), "utf8");
  const scrape = (src, re, seedSet) => {
    const s = new Set(seedSet || []);
    for (const m of src.matchAll(re)) s.add(m[1]);
    return s;
  };
  const models = scrape(stateEngineSrc, /case "([a-zA-Z0-9_]+)":/g,
    ["saw", "stack", "noise", "boom", "sine", "dx7"]);   // defaults + the dx7-blob contract
  for (const m of stateEngineSrc.matchAll(/["']?([a-zA-Z0-9]+)["']?\s*:\s*"(?:kick|snare|hat)/g)) models.add(m[1]);
  const keysOf = (name) => {
    const m = engineSrc.match(new RegExp("const " + name + "=\\{([^}]*(?:\\}[^}]*)*?)\\};"))
      || engineSrc.match(new RegExp("const " + name + "=\\{([\\s\\S]*?)\\n"));
    const s = new Set(["off"]);
    if (m) for (const k of m[1].matchAll(/(\w+):/g)) s.add(k[1]);
    return s;
  };
  const stabs = keysOf("STAB_PATTERNS");
  const hitPats = keysOf("HIT_PATTERNS");
  const roles = scrape(engineSrc, /role===?"([a-z]+)"/g, ["bed"]);
  const forms = scrape(kernelSrc, /c\.form===?"([a-z]+)"/g, ["pop"]);
  const sampleIds = new Set(Object.keys(K.SAMPLES));
  const sourceIds = new Set([...Object.keys(K.SOURCES), ...sampleIds]);
  const inSet = (set) => (v) => set.has(v);

  const check = (g, field, list, valid, describe) => {
    for (const v of [].concat(list || [])) {
      if (v != null && !valid(v)) errors.push({ genre: g, field, value: v, note: describe });
    }
  };
  for (const [g, A] of Object.entries(K.GENRES)) {
    check(g, "progressions", A.progressions, (v) => !!E.PROGRESSIONS[v], "not in E.PROGRESSIONS");
    check(g, "kits", A.kits, inSet(new Set(E.DRUM_PATTERNS)), "not in E.DRUM_PATTERNS");
    check(g, "fills", A.fills, inSet(new Set(E.TRANSITIONS)), "not in E.TRANSITIONS");
    check(g, "bass.patterns", A.bass && A.bass.patterns, inSet(new Set(E.BASS_PATTERNS)), "not in E.BASS_PATTERNS");
    check(g, "lead.patterns", A.lead && A.lead.patterns, inSet(new Set(E.MELODY_PATTERNS)), "not in E.MELODY_PATTERNS");
    check(g, "bass.recipe.model", A.bass && A.bass.recipe && A.bass.recipe.model, inSet(models), "no such synthesis model in csd-engine");
    check(g, "lead.recipe.model", A.lead && A.lead.recipe && A.lead.recipe.model, inSet(models), "no such synthesis model in csd-engine");
    check(g, "pads.recipe.model", A.pads && A.pads.recipe && A.pads.recipe.model, inSet(models), "no such synthesis model in csd-engine");
    if (A.drums) {
      check(g, "drums.kickModel", A.drums.kickModel, inSet(models), "no such kick model");
      check(g, "drums.snareModel", A.drums.snareModel, inSet(models), "no such snare model");
      check(g, "drums.hatModel", A.drums.hatModel, inSet(models), "no such hat model");
    }
    if (A.found) {
      check(g, "found.role", A.found.role, inSet(roles), "unknown found role");
      check(g, "found.sources", A.found.sources, inSet(sourceIds), "not in SOURCES/SAMPLES registry");
    }
    if (A.hits) {
      // 2026-07-03: toState resolves hits from SAMPLES or SOURCES (remote
      // material as stabs, e.g. Radio Moscow) — validate against the union.
      check(g, "hits.sources", A.hits.sources, inSet(sourceIds), "not in SAMPLES/SOURCES registry");
      check(g, "hits.pattern", A.hits.pattern, inSet(hitPats), "unknown HIT_PATTERNS key");
    }
    if (A.vox) check(g, "vox.sources", A.vox.sources, inSet(sampleIds), "not in SAMPLES registry");
    check(g, "voxPoem", A.voxPoem, inSet(sampleIds), "not in SAMPLES registry");
    check(g, "hornSource", A.hornSource, inSet(sampleIds), "not in SAMPLES registry");
    check(g, "dingSource", A.dingSource, inSet(sampleIds), "not in SAMPLES registry");
    check(g, "stations", A.stations, inSet(sampleIds), "not in SAMPLES registry");
    check(g, "stab", A.stab, inSet(stabs), "unknown STAB_PATTERNS key");
    if (A.form && !forms.has(A.form)) warnings.push({ genre: g, field: "form", value: A.form, note: "unknown form — silently falls back to pop" });
    if (!V.TARGETS[g]) warnings.push({ genre: g, field: "TARGETS", note: "anchor has no genre-verifier target ranges — unverifiable, excluded from gates 2-5" });
    if (!K.GENRE_CLIPS[g]) warnings.push({ genre: g, field: "GENRE_CLIPS", note: "no video clip pool — journeys fall back" });
  }
  for (const t of Object.keys(V.TARGETS)) if (!K.GENRES[t]) warnings.push({ genre: t, field: "GENRES", note: "verifier target with no kernel anchor" });
  // sample files on disk are fetched, not committed: missing = warn, not fail
  const seenFiles = new Set();
  for (const [id, s] of Object.entries(K.SAMPLES)) {
    const p = path.join(__dirname, "found", "samples", s.file);
    if (!seenFiles.has(p) && !fs.existsSync(p)) warnings.push({ genre: "-", field: "SAMPLES." + id, note: "file missing on disk (run fetch scripts): " + s.file });
    seenFiles.add(p);
  }
  const status = errors.length ? "FAIL" : "PASS";
  result.gates.vocabulary = { status, anchors: Object.keys(K.GENRES).length, errors, warnings };
  log(`[${status}] 6 vocabulary integrity — ${Object.keys(K.GENRES).length} anchors, every reference resolves (${errors.length} dangling, ${warnings.length} warnings)`);
  errors.slice(0, 10).forEach((e) => log(`       x ${e.genre}.${e.field} = "${e.value}" — ${e.note}`));
  warnings.slice(0, 6).forEach((w) => log(`       ~ ${w.genre}.${w.field}${w.value ? ' = "' + w.value + '"' : ""} — ${w.note}`));
  if (warnings.length > 6) log(`       ~ (+${warnings.length - 6} more warnings — see --json)`);
  return status;
}

// ============================================================ gate 7: --audio (optional, empirical)
function gateAudio() {
  if (!AUDIO) { result.gates.audio = { status: "SKIP", note: "run with --audio to enable" }; return "SKIP"; }
  const { execFileSync } = require("child_process");
  const py = path.join(__dirname, ".venv-verify", "bin", "python");
  const model = path.join(__dirname, "models", "genre_discogs400-discogs-effnet-1.pb");
  const which = (bin) => { try { execFileSync("which", [bin], { stdio: "ignore" }); return true; } catch (e) { return false; } };
  if (!fs.existsSync(py) || !fs.existsSync(model) || !which("ffmpeg")) {
    result.gates.audio = { status: "SKIP", note: "needs .venv-verify, models/, ffmpeg (see CLAUDE.md)" };
    log(`[SKIP] 7 audio probe — missing .venv-verify/models/ffmpeg`);
    return "SKIP";
  }
  const probes = ["techno", "vaporwave", "jungle"].filter((g) => K.GENRES[g]).slice(0, 3);
  const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "genre-audio-"));
  const results = [];
  for (const g of probes) {
    try {
      const state = K.track(g, { seed: 1, targetSec: 60 });
      state.foundSources = state.foundSources.filter((s) => s.id !== "tw_vocal");   // render-time vocal: skip
      state.sections.forEach((s) => { if (s.vocal) delete s.vocal; });
      let missing = false;
      for (const s of state.foundSources) {
        s.fsPath = s.samplePath ? path.join(__dirname, s.samplePath) : path.join(__dirname, "found", s.id + ".wav");
        if (!fs.existsSync(s.fsPath)) missing = true;
      }
      if (missing) { results.push({ genre: g, status: "skip", note: "found-sound files not fetched" }); continue; }
      const wav = path.join(tmp, g + ".wav"), mp3 = path.join(tmp, g + ".mp3"), sjP = path.join(tmp, g + ".state.json");
      fs.writeFileSync(sjP, JSON.stringify(state));
      execFileSync("node", [path.join(__dirname, "faust", "press.js"), sjP, wav], { stdio: "ignore" });
      // classifier probe: the middle ~45s, where the full arrangement plays
      execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "30", "-t", "45", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "160k", mp3]);
      try {
        const out = execFileSync(py, [path.join(__dirname, "audio-verifier.py"), mp3, "--expect", g], { encoding: "utf8" });
        results.push({ genre: g, status: "pass", output: out.trim().split("\n").slice(-3).join(" | ") });
      } catch (e) {
        results.push({ genre: g, status: "miss", note: "expected genre not in classifier top ranks",
          output: String((e.stdout || "")).trim().split("\n").slice(-3).join(" | ") });
      }
    } catch (e) { results.push({ genre: g, status: "error", note: String(e.message || e).slice(0, 200) }); }
  }
  const misses = results.filter((r) => r.status === "miss" || r.status === "error");
  const status = misses.length ? "WARN" : "PASS";
  result.gates.audio = { status, probes: results };
  log(`[${status}] 7 audio probe — Discogs-EffNet on ${probes.length} rendered probes`);
  results.forEach((r) => log(`       ${r.status === "pass" ? "-" : "~"} ${r.genre}: ${r.status}${r.note ? " (" + r.note + ")" : ""}${r.output ? " " + r.output : ""}`));
  return status;
}

// ============================================================ run
log(`validate-genres — ${allGenres.length} anchors, ${scoredGenres.length} scored, seeds=[${SEEDS.join(",")}]${QUICK ? " (quick)" : ""}`);
log("");
const s1 = gateDeterminism();
const { s2, s3 } = gateDominanceAndMargin();
const s4 = gateGeometry();
const s5 = gateBlend();
const s6 = gateVocabulary();
const s7 = gateAudio();
if (trackErrors.length) result.meta.trackErrors = trackErrors;

const hardFail = s1 === "FAIL" || s2 === "FAIL" || s6 === "FAIL";
result.exitCode = hardFail ? 1 : 0;
log("");
const statuses = { determinism: s1, dominance: s2, margin: s3, geometry: s4, blend: s5, vocabulary: s6, audio: s7 };
const counts = Object.values(statuses).reduce((c, s) => ((c[s] = (c[s] || 0) + 1), c), {});
log(`result: ${hardFail ? "FAIL" : "PASS"} — ${counts.PASS || 0} pass, ${counts.WARN || 0} warn, ${counts.FAIL || 0} fail${counts.SKIP ? ", " + counts.SKIP + " skipped" : ""}`);
log(`(hard gates: 1 determinism, 2 dominance, 6 vocabulary; the rest warn)`);
if (JSON_OUT) console.log(JSON.stringify(result, null, 2));
process.exit(result.exitCode);
