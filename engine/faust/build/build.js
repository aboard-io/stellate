#!/usr/bin/env node
// build.js — precompile faust/dsp/*.dsp to static WASM+JSON artifacts in
// faust/dist/ so the web page (engine.js) and the offline renderer load them
// WITHOUT shipping libfaust (~13MB) to the client.
//
// GOTCHA (faustwasm 0.16.5): `require("@grame/faustwasm")` / bare ESM import
// resolves to dist/cjs/index.js, an IIFE bundle that exports NOTHING (package
// has no "exports" map and "main" mispoints). You must deep-import
// dist/esm/index.js. Same in engine.js on the browser side.
"use strict";
const fs = require("fs");
const path = require("path");

const FW = path.join(__dirname, "..", "node_modules/@grame/faustwasm");
const OUT = path.join(__dirname, "..", "dist");

async function main() {
  const { instantiateFaustModuleFromFile, LibFaust, FaustCompiler, FaustMonoDspGenerator } =
    await import(path.join(FW, "dist/esm/index.js"));

  const mod = await instantiateFaustModuleFromFile(path.join(FW, "libfaust-wasm/libfaust-wasm.js"));
  const compiler = new FaustCompiler(new LibFaust(mod));
  console.log("faust compiler:", compiler.version());

  fs.mkdirSync(OUT, { recursive: true });
  // LOCAL LIBRARIES FIRST. A .dsp is compiled from a STRING, so libfaust has no
  // directory to resolve `import("voice_tract.lib")` against — only its own
  // virtual filesystem, which is where the standard library lives. Writing
  // every dsp/*.lib into it before the first compile is what lets two modules
  // share one piece of synthesis instead of carrying two copies of it: the lead
  // singer and the choir are the same vocal tract, and a duplicated tract is
  // exactly how they would stop being the same voice.
  const libDir = path.join(__dirname, "..", "dsp");
  for (const f of fs.readdirSync(libDir).filter((x) => x.endsWith(".lib")).sort()) {
    compiler.fs().writeFile(f, fs.readFileSync(path.join(libDir, f), "utf8"));
    console.log("lib:", f);
  }
  const only = process.argv.slice(2);           // build.js [name ...] = subset rebuild
  const dsps = fs.readdirSync(path.join(__dirname, "..", "dsp")).filter(f => f.endsWith(".dsp")).sort()
    .filter(f => !only.length || only.includes(f.replace(/\.dsp$/, "")));
  const manifest = {};
  let failed = 0;
  for (const f of dsps) {
    const name = f.replace(/\.dsp$/, "");
    const code = fs.readFileSync(path.join(__dirname, "..", "dsp", f), "utf8");
    const gen = new FaustMonoDspGenerator();
    const t0 = Date.now();
    // -ftz 2: flush-to-zero (denormal armor), same flag faust2wasm.js appends
    let dsp;
    try { dsp = await gen.compile(compiler, name, code, "-ftz 2"); }
    catch (e) { console.error(`COMPILE FAILED ${f}: ${(e.message || e).slice(0, 500)}`); failed++; continue; }
    if (!dsp || !dsp.factory) { console.error(`COMPILE FAILED ${f} (no factory)`); failed++; continue; }
    fs.writeFileSync(path.join(OUT, `${name}-module.wasm`), dsp.factory.code);
    fs.writeFileSync(path.join(OUT, `${name}-meta.json`), dsp.factory.json);
    const meta = JSON.parse(dsp.factory.json);
    // manifest: the Phase-2 engine loads this to know every module's IO + params
    const params = [];
    (function walk(items) { for (const it of items || []) it.items ? walk(it.items) : params.push(it.address); })(meta.ui);
    manifest[name] = { inputs: meta.inputs, outputs: meta.outputs, params };
    console.log(`${name}: ${dsp.factory.code.length}B wasm, ins=${meta.inputs} outs=${meta.outputs}, ${Date.now() - t0}ms`);
  }
  // THE MANIFEST IS MERGED, NOT REWRITTEN, and a subset build updates it too.
  // It used to be written only on a FULL build, which sounds harmless and is
  // not: a full build re-emits all 88 artifacts with a fresh compile nonce in
  // every `code` field, so adding one module churned 141 committed binaries
  // that were functionally identical to the ones already there. Merging keeps
  // the diff to the module that actually changed, and a subset build stops
  // leaving the manifest stale — which is how a new module could ship with no
  // entry at all and nothing notice, since nothing reads this file at runtime.
  const mpath = path.join(OUT, "manifest.json");
  let merged = manifest;
  if (only.length && fs.existsSync(mpath)) {
    const prev = JSON.parse(fs.readFileSync(mpath, "utf8"));
    merged = {};
    for (const k of Object.keys({ ...prev, ...manifest }).sort()) merged[k] = manifest[k] || prev[k];
  }
  fs.writeFileSync(mpath, JSON.stringify(merged, null, 1));
  console.log("wrote", OUT, failed ? `(${failed} FAILED)` : "(all ok)");
  if (failed) process.exit(1);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
