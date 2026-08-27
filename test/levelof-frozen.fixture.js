#!/usr/bin/env node
// test/levelof-frozen.fixture.js — THE FROZEN CATALOG, FOR THE levelOf()
// CONSOLIDATION (FUTURE.md Phase 0, 2026-08-27).
//
//   node test/levelof-frozen.fixture.js [--te <path-to-to-engine.js>]
//
// tone.gain used to reach the engine through FOUR different scalings in
// audio/to-engine.js; they are one exported levelOf() now. This script proves
// the consolidation moved NO sound: it walks every catalog anchor genre and
// serializes the engine-facing recipe of every lane the scalings feed —
// recipeFor() over the genre's own chair (signature synth, tone block and all)
// and patchForInstr() over a spread of GM ids under the genre's own tone, both
// padish and not — and prints one sha256 over the whole thing. Run it against
// the pre-consolidation module and the post- one; the hashes must be equal.
// (The one-off comparison for the 2026-08-27 change is recorded in the levelOf
// comment in to-engine.js; this file stays so the NEXT hand that touches the
// lane table can prove the same thing.)
"use strict";
const path = require("path");
const crypto = require("crypto");
const R = (p) => path.join(__dirname, "..", p);
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const TE_PATH = path.resolve(arg("--te", R("nukernel/audio/to-engine.js")));

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { visibilityState: "visible", body: { append() {} },
  createElement: () => ({ style: {}, append() {}, click() {}, setAttribute() {} }) };
window.NuKernel = require(R("nukernel/kernel.js"));
window.NuGenres = require(R("nukernel/genres.js"));
window.NuFields = require(R("nukernel/fields.js"));
window.NuInstruments = require(R("nukernel/instruments.js"));
window.FaustStateEngine = require(R("engine/faust/voices/state-engine.js"));

(async () => {
  const TE = await import("file://" + TE_PATH);
  const { GENRES } = window.NuGenres;
  const anchors = Object.keys(GENRES)
    .filter((g) => GENRES[g] && GENRES[g].bars != null).sort();
  // GM ids that between them reach every lane of patchForInstr: the mouths
  // (54), the modelled electrics and struck bars, the synth photographs, and
  // plain sampled ids (which fall through to null here and to the sampler in
  // recipeBase)
  const IDS = [];
  for (let i = 0; i < 128; i += 3) IDS.push(i);
  const out = {};
  for (const g of anchors) {
    const G = GENRES[g];
    const un = [];
    const seat = { instr: G.instr, synth: G.synth, tone: G.tone };
    const row = {
      // lib {} = every instrument unrouted -> recipeBase's `{ ...tone }`
      // branch, which is toneRecipe (the old *2.2 site) verbatim
      chair: TE.recipeFor("line", seat, {}, un),
      bass: G.bass ? TE.recipeFor("bass", { instr: G.bass.instr || G.instr,
        synth: G.bass.synth, tone: G.tone }, {}, un) : null,
      patches: {},
    };
    for (const id of IDS) {
      const a = TE.patchForInstr(id, G.tone, false);
      const b = TE.patchForInstr(id, G.tone, true);
      if (a || b) row.patches[id] = [a, b];
    }
    out[g] = row;
  }
  const json = JSON.stringify(out);
  const hash = crypto.createHash("sha256").update(json).digest("hex");
  console.log("genres " + anchors.length + "  bytes " + json.length +
              "  sha256 " + hash);
})().catch((e) => { console.error(e); process.exit(1); });
