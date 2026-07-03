// verify-lib.js — shared plumbing for the verification tools (genre-verifier
// matrix, validate-genres.js, verify.sh): content-addressed result caching in
// scratch/.verify-cache/ plus child_process-fork sharding across CPU cores.
//
// Cache design: every cached artifact is keyed by the sha256 of the capability
// files that determine symbolic results (genre-kernel.js + csd-engine.js +
// genre-verifier.js, plus per-tool extras) — edit the kernel and every entry
// is dead on arrival (pruned on the next write). Two layers:
//
//   run-<tool>-<code>-<args>.json   whole printed report + exit code, replayed
//                            instantly with a "(cached)" marker on stderr so
//                            stdout stays byte-identical to a live run
//   feats-<code>.json        per-(genre,seed) symbolic feature vectors,
//                            SHARED by matrix and validate-genres so seed-
//                            count changes / cross-tool runs only pay for the
//                            missing keys
//
// Sharding: runShards() re-forks the calling script with --shard i/n; each
// worker computes a strided subset and reports one IPC message. Strategy
// flags (--serial/--no-cache/--jobs/--shard) never enter cache keys — they
// pick execution strategy, not results.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const util = require("util");
const crypto = require("crypto");
const { fork } = require("child_process");

const ROOT = __dirname;
const CACHE_DIR = path.join(ROOT, "scratch", ".verify-cache");
const CORE_FILES = ["genre-kernel.js", "csd-engine.js", "genre-verifier.js"];

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

const _codeHash = {};
function codeHash(extraFiles) {
  const files = CORE_FILES.concat(extraFiles || []);
  const ck = files.join("|");
  if (!_codeHash[ck]) {
    const h = crypto.createHash("sha256");
    for (const f of files) { h.update(f + "\0"); h.update(fs.readFileSync(path.join(ROOT, f))); h.update("\0"); }
    _codeHash[ck] = h.digest("hex").slice(0, 16);
  }
  return _codeHash[ck];
}

// args that pick execution strategy, not results — excluded from cache keys
// so a --serial run seeds the cache for a parallel one and vice versa
function normalizeArgs(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--serial" || args[i] === "--no-cache") continue;
    if (args[i] === "--jobs" || args[i] === "--shard") { i++; continue; }
    out.push(args[i]);
  }
  return out;
}

function atomicWrite(file, text) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = file + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// drop entries minted from other code hashes — the tree has one truth.
// prefix-scoped: run-<tool>- and feats- families are keyed by DIFFERENT
// hashes (per-tool extras vs core), so each family only prunes itself.
function prune(prefix, keepHash) {
  let names; try { names = fs.readdirSync(CACHE_DIR); } catch (e) { return; }
  for (const n of names)
    if (n.startsWith(prefix) && !n.includes(keepHash)) { try { fs.unlinkSync(path.join(CACHE_DIR, n)); } catch (e) {} }
}

// ---------------- whole-run report cache ----------------
function runFile(tool, args, extraFiles) {
  return path.join(CACHE_DIR,
    `run-${tool}-${codeHash(extraFiles)}-${sha(tool + "\0" + normalizeArgs(args).join("\0")).slice(0, 12)}.json`);
}
function loadRun(tool, args, extraFiles) {
  try { return JSON.parse(fs.readFileSync(runFile(tool, args, extraFiles), "utf8")); } catch (e) { return null; }
}
function saveRun(tool, args, extraFiles, report) {
  try { atomicWrite(runFile(tool, args, extraFiles), JSON.stringify(report)); prune("run-" + tool + "-", codeHash(extraFiles)); }
  catch (e) { /* cache is best-effort */ }
}
function replayRun(rep) {
  if (rep.out) process.stdout.write(rep.out);
  console.error("(cached)");
  process.exit(rep.code);
}

// ---------------- per-(genre,seed) feature-vector cache ----------------
// keyed by the CORE hash only: feature vectors depend on kernel+engine+verifier
function featFile() { return path.join(CACHE_DIR, `feats-${codeHash()}.json`); }
function loadFeats() {
  try { return JSON.parse(fs.readFileSync(featFile(), "utf8")); } catch (e) { return {}; }
}
function saveFeats(fresh) {
  if (!fresh || !Object.keys(fresh).length) return;
  try { atomicWrite(featFile(), JSON.stringify(Object.assign(loadFeats(), fresh))); prune("feats-", codeHash()); }
  catch (e) { /* cache is best-effort */ }
}

// ---------------- stdout tee: print live AND capture for the run cache ------
function tee() {
  const buf = [];
  const log = (...a) => { const s = util.format(...a); buf.push(s); console.log(s); };
  log.text = () => (buf.length ? buf.join("\n") + "\n" : "");
  return log;
}

// ---------------- fork sharding ----------------
function jobs(args, nItems) {
  const i = args.indexOf("--jobs");
  const n = i >= 0 ? parseInt(args[i + 1], 10) : 0;
  return Math.max(1, Math.min(n || os.cpus().length, nItems));
}
function shardOf(args) {
  const i = args.indexOf("--shard");
  if (i < 0) return null;
  const [a, b] = String(args[i + 1]).split("/").map(Number);
  return { i: a, n: b };
}
// fork the same script n times with --shard i/n; each child answers with one
// process.send() message. Resolves to the n messages (shard order).
function runShards(script, baseArgs, n) {
  return Promise.all(Array.from({ length: n }, (_, i) => new Promise((resolve, reject) => {
    const child = fork(script, baseArgs.concat(["--shard", `${i}/${n}`]),
      { stdio: ["ignore", "inherit", "inherit", "ipc"] });
    let msg = null;
    child.on("message", (m) => { msg = m; });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 && msg ? resolve(msg) : reject(new Error(`${path.basename(script)} shard ${i}/${n} exited ${code}`)));
  })));
}

module.exports = { CACHE_DIR, codeHash, normalizeArgs, loadRun, saveRun, replayRun,
  loadFeats, saveFeats, tee, jobs, shardOf, runShards };
