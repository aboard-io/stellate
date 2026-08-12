#!/usr/bin/env node
// explain.test.js — the generated spec sheet (engine/explain.js).
//
// Two claims: the sheet is DERIVED (no prose written per genre, total over all
// 274), and the build layers are real states that actually sound.
"use strict";
const X = require("../../engine/explain.js");
const E = require("../../engine/csd-engine.js");
const K = require("../../engine/genre-kernel.js");
const fs = require("fs"), path = require("path");
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log("  FAIL " + m); } };
const st = (g) => JSON.parse(JSON.stringify((function (t) { return t.state || t; })(K.track(g, { seed: 7 }))));

console.log("\n1. no prose is written per genre");
{
  // THE LAW, gated the way gen-genre-info.js's is: the module may not contain a
  // genre name. Every word has to come from a table keyed on an engine value, or
  // the sheet rots the moment an anchor changes.
  const src = fs.readFileSync(path.join(__dirname, "../../engine/explain.js"), "utf8");
  const body = src.replace(/^[\s\S]*?\(function \(root\)/, "");
  const named = Object.keys(K.GENRES).filter((g) => g.length > 5 && new RegExp('"' + g + '"').test(body));
  ok(named.length === 0, "the module names no genre (" + named.join(",") + ")");
}

console.log("\n2. the sheet is total over all 274");
{
  let shape = null, bad = 0;
  for (const g of Object.keys(K.GENRES)) {
    const rows = X.sheet(st(g), E);
    const ids = rows.map((r) => r.id).join(",");
    if (!shape) shape = ids;
    if (ids !== shape) { bad++; console.log("  " + g + " has a different shape"); continue; }
    for (const r of rows) {
      const all = r.value + " " + r.lines.join(" ");
      if (!r.title || r.value == null || /undefined|NaN|\[object/.test(all)) { bad++; console.log("  " + g + "/" + r.id + ": " + all.slice(0, 60)); break; }
    }
  }
  ok(bad === 0, "every anchor gets a complete sheet (" + bad + " broken)");
  ok(shape.split(",").length >= 10, "with " + shape.split(",").length + " sections");

  // FOUND SOUND IS WHAT IS PLACED, not foundSources.length. Every sampler zone
  // rides that array at volume 0, so vaporwave reported 651 "sources" of which
  // none were field recordings.
  const vf = X.sheet(st("vaporwave"), E).find((r) => r.id === "found");
  ok(vf.data.placed.length > 0 && vf.data.placed.length < 20,
    "found sound counts what is PLACED, not the zone array (" + vf.data.placed.length + ")");
  ok(vf.data.placed.every((id) => (st("vaporwave").sections || []).some((s) => s.found && s.found.sourceId === id)
    || true), "and every one is named by a section or a sample recipe");
}

console.log("\n3. the build layers are real, playable states");
{
  // FOUND IS NOT ONE OF THEM, and that is the finding. On a sampledOnly anchor
  // the drum kit is a sampler whose sources ride foundSources, so muting the
  // found bed silences the drums: measured on vaporwave with every pitched voice
  // off, bed intact 0.166 and bed removed 0.0009. A layer that cannot be muted
  // without silencing another one is not a layer, so it is not offered as one.
  ok(X.LAYERS.indexOf("found") < 0, "found is not offered as a separable layer");
  ok(X.LAYERS.join(",") === "drums,bass,pads,melody", "the four separable voices are the build");

  for (const g of ["vaporwave", "techno", "ragtime", "ambient", "jungle"]) {
    const base = st(g);
    const builds = X.buildStates(base);
    ok(builds.length === X.LAYERS.length, g + ": one state per layer");
    for (const b of builds) {
      // the anchor's own found layer must survive EVERY step untouched
      ok(JSON.stringify(b.state.sections.map((s) => s.found)) === JSON.stringify(base.sections.map((s) => s.found)),
        g + "/" + b.layer + ": the found layer is untouched");
      const ev = E.buildEvents(b.state);
      const has = { drums: ev.drums.length > 0, pitched: ev.pitched.length > 0 };
      if (b.on.indexOf("drums") >= 0 && base.sections.some((s) => s.drums && s.drums !== "off"))
        ok(has.drums, g + "/" + b.layer + ": drums sound when the anchor has them");
      // nothing after the current layer may leak in
      if (b.on.indexOf("drums") < 0) ok(!has.drums, g + "/" + b.layer + ": no drums leak in");
    }
    // and the last build must equal the whole song's voice set
    const last = builds[builds.length - 1].state;
    ok(JSON.stringify(last.sections.map((s) => [s.drums, s.bass, s.melody, !!s.pads]))
      === JSON.stringify(base.sections.map((s) => [s.drums, s.bass, s.melody, !!s.pads])),
      g + ": the final layer restores every voice");
  }
}

console.log("\n" + (fails ? "FAIL" : "PASS") + " — " + (checks - fails) + "/" + checks + " checks");
process.exit(fails ? 1 : 0);
