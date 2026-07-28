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
  if (!only.length) fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
  console.log("wrote", OUT, failed ? `(${failed} FAILED)` : "(all ok)");
  if (failed) process.exit(1);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
