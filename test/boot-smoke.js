#!/usr/bin/env node
// boot-smoke.js — the engine load-order gate.
//
// index.html loads the engine as an ORDERED list of classic <script> tags
// (index.html:63-80): theory/pipes BEFORE csd-engine (it reads window.CsdTheory
// /CsdPipes at load), every engine global BEFORE app/main.js. The engine stays
// classic-global/UMD — NOT ES modules. This test proves that contract holds
// without a browser: it parses index.html for the ordered classic script list,
// runs each script IN ORDER inside one browser-like `vm` sandbox (so the UMD
// BROWSER branch — `root.X = …`, not the node `module.exports` branch — runs,
// exactly as the page does), and asserts each script's expected global is
// defined afterward. A load-order regression (e.g. csd-engine before theory)
// or a script that quietly stops publishing its global fails here, fast.
//
// It also enforces the REGISTRY below stays complete: any classic engine
// <script> index.html adds that isn't mapped to a global fails the test, so a
// new engine file can't slip in without declaring the window symbol it owns.
//
// Run: node test/boot-smoke.js   (exit 0 = pass, exit 1 = fail)

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");

// The contract: each classic engine <script src> -> the window global it must
// publish once loaded. Keep in sync with index.html's <script> block; the test
// fails if index.html loads a classic engine script missing from this map.
const EXPECTED = {
  "engine/theory.js": "CsdTheory",
  "engine/pipes.js": "CsdPipes",
  "engine/csd-engine.js": "CsdEngine",
  // the genre data (Stage E1), generated classic scripts that MUST load before
  // the kernel: it reads these globals synchronously at load, so an order slip
  // here is a blank app, not a warning.
  "engine/genres-data.js": "__GENRES",
  "engine/registry-data.js": "__REGISTRY",
  "engine/genre-kernel.js": "GenreKernel",
  "engine/genre-verifier.js": "GenreVerifier",
  "engine/namebank.js": "NameBank",
  // the SMF writer: a node-side gate dependency AND the browser's ⤓ midi
  // download — it reads window.CsdEngine at load.
  "engine/midi-export.js": "MidiExport",
  "engine/speech.js": "CsdSpeech",
  "engine/demo-layer.js": "DemoLayer",
  "engine/faust/state-engine.js": "FaustStateEngine",
  "engine/faust/found-player.js": "FoundPlayer",
  "engine/faust/sampler.js": "FaustSampler",
  "engine/faust/live.js": "FaustLive",
  // analytics: the settings shim publishes window.goatcounter.
  // (The vendored counter itself is async — excluded from the ordered walk.)
  "app/analytics.js": "goatcounter",
};

// --- parse index.html for the ORDERED classic script srcs (skip type=module) -
function parseScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\btype\s*=\s*["']module["']/i.test(attrs)) continue; // app/ ES modules
    if (/\basync\b/i.test(attrs)) continue; // async scripts have no load-order contract (the goatcounter counter)
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (src) out.push(src[1]);
  }
  return out;
}

// --- a minimal, side-effect-free browser sandbox --------------------------
// Enough surface for the DOM layers (demo/live) to DEFINE their module
// at load without a real browser. Timers/RAF are no-ops so nothing schedules a
// background loop (the scripts only publish their global at load; loops start
// on later init() calls we never make).
function makeSandbox() {
  const noop = () => {};
  const el = () => ({
    style: {}, appendChild: noop, removeChild: noop, remove: noop,
    setAttribute: noop, addEventListener: noop, removeEventListener: noop,
    getContext: () => null, appendData: noop, classList: { add: noop, remove: noop },
  });
  const documentStub = {
    currentScript: null, // set per-script before each run (live.js reads .src)
    visibilityState: "visible",
    body: el(),
    head: el(),
    createElement: el, createElementNS: el,
    getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop,
  };
  const sandbox = {
    console,
    document: documentStub,
    location: { origin: "http://localhost:8777", href: "http://localhost:8777/", protocol: "http:" },
    navigator: { userAgent: "boot-smoke", platform: "", vendor: "", maxTouchPoints: 0 },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    URL, TextEncoder, TextDecoder,
    AudioContext: function () { return {}; },
    webkitAudioContext: function () { return {}; },
    Audio: function () { return el(); },
    MediaMetadata: function () { return {}; },
    Worker: function () { return { postMessage: noop, terminate: noop, addEventListener: noop }; },
    fetch: () => Promise.reject(new Error("no network in boot-smoke")),
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  // NOTE: intentionally NO `module`/`exports`/`require` — their absence forces
  // every UMD wrapper down its BROWSER branch (root.X = …), which is what the
  // page actually executes.
  return sandbox;
}

// --- the documented load-order LAWS, checked against index.html directly ----
// (index.html:59-80 comments). The sandbox proves each global publishes; these
// prove the ORDER the page loads them in, which the sandbox can't (csd-engine
// captures CsdTheory lazily, so it still publishes if misordered — but its
// theory would be dead. The order law is what actually keeps that from happening.)
function checkOrder(html, classicScripts) {
  const problems = [];
  const idx = (s) => classicScripts.indexOf(s);
  // theory & pipes BEFORE csd-engine (csd-engine reads window.CsdTheory/CsdPipes at load).
  for (const dep of ["engine/theory.js", "engine/pipes.js"]) {
    if (idx(dep) === -1 || idx("engine/csd-engine.js") === -1) continue;
    if (idx(dep) > idx("engine/csd-engine.js")) {
      problems.push(`${dep} must load BEFORE engine/csd-engine.js`);
    }
  }
  // csd-engine BEFORE midi-export.js (it captures CsdEngine at load — misordered,
  // its Eng is null and every ⤓ midi download throws).
  if (idx("engine/midi-export.js") !== -1 && idx("engine/csd-engine.js") !== -1 &&
      idx("engine/midi-export.js") < idx("engine/csd-engine.js")) {
    problems.push("engine/midi-export.js must load AFTER engine/csd-engine.js");
  }
  // EVERY classic engine script BEFORE app/main.js (the type=module app entry).
  // module scripts always defer, so measure by position in the raw html.
  const mainPos = html.search(/<script\b[^>]*\bsrc\s*=\s*["'][^"']*app\/main\.js["'][^>]*>/i);
  if (mainPos === -1) {
    problems.push("app/main.js <script> not found in index.html");
  } else {
    for (const s of classicScripts) {
      const p = html.search(new RegExp("<script\\b[^>]*\\bsrc\\s*=\\s*[\"']\\.?/?" + s.replace(/[.\/]/g, "\\$&") + "[\"']"));
      if (p !== -1 && p > mainPos) problems.push(`${s} must load BEFORE app/main.js`);
    }
  }
  return problems;
}

function main() {
  const html = fs.readFileSync(INDEX, "utf8");
  const scripts = parseScripts(html);
  if (!scripts.length) { console.error("FAIL: no classic <script src> found in index.html"); process.exit(1); }
  const scriptsRel = scripts.map((s) => s.replace(/^\.?\//, ""));

  const sandbox = makeSandbox();
  const ctx = vm.createContext(sandbox);
  const results = [];
  let failed = 0;

  for (const src of scripts) {
    const rel = src.replace(/^\.?\//, "");
    const abs = path.join(ROOT, rel);
    const expected = EXPECTED[rel];

    if (!expected) {
      results.push({ src: rel, status: "UNMAPPED", note: "classic engine script not in EXPECTED registry — declare its window global" });
      failed++;
      continue;
    }
    if (!fs.existsSync(abs)) {
      results.push({ src: rel, status: "MISSING-FILE", global: expected });
      failed++;
      continue;
    }

    // live.js derives BASE/SITE from document.currentScript.src.
    sandbox.document.currentScript = { src: sandbox.location.origin + "/" + rel };
    const before = typeof sandbox[expected] !== "undefined";
    try {
      const code = fs.readFileSync(abs, "utf8");
      vm.runInContext(code, ctx, { filename: rel });
    } catch (e) {
      results.push({ src: rel, status: "LOAD-THREW", global: expected, note: String(e && e.message).split("\n")[0] });
      failed++;
      continue;
    }
    sandbox.document.currentScript = null;

    const now = typeof sandbox[expected] !== "undefined";
    if (!now) {
      results.push({ src: rel, status: "GLOBAL-UNDEFINED", global: expected });
      failed++;
    } else {
      results.push({ src: rel, status: before ? "OK(pre-existed)" : "OK", global: expected });
    }
  }

  // Report.
  const pad = Math.max(...scripts.map((s) => s.replace(/^\.?\//, "").length));
  for (const r of results) {
    const ok = r.status.startsWith("OK");
    const line = `  ${ok ? "✓" : "✗"} ${r.src.padEnd(pad)}  ${(r.global || "-").padEnd(16)} ${r.status}${r.note ? "  (" + r.note + ")" : ""}`;
    console.log(line);
  }
  // Load-order laws.
  const orderProblems = checkOrder(html, scriptsRel);
  console.log("");
  if (orderProblems.length) {
    for (const p of orderProblems) console.log(`  ✗ ORDER: ${p}`);
    failed += orderProblems.length;
  } else {
    console.log("  ✓ ORDER: theory/pipes before csd-engine; csd-engine before midi-export; all engine globals before app/main.js");
  }

  console.log("");
  const total = results.length;
  if (failed) {
    console.log(`boot-smoke: FAIL — ${total - failed}/${total} scripts published their global in load order`);
    process.exit(1);
  }
  console.log(`boot-smoke: PASS — ${total}/${total} engine scripts loaded in order and published their window global`);
  process.exit(0);
}

main();
