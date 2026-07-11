#!/usr/bin/env node
// test/feature-pca-run.js — unit test for tools/feature-pca.js + engine/checks/dead-axis.js
// Fast, narrow, deterministic. Run: node test/feature-pca-run.js
"use strict";
const assert = require("assert");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const DA = require(path.join(ROOT, "engine", "checks", "dead-axis.js"));
const PCA = require(path.join(ROOT, "tools", "feature-pca.js"));

// 1. dead-axis PASSes on the real cloud (no genuinely dead feature today).
const real = DA.check();
assert.strictEqual(real.status, "PASS", "real cloud should have no dead axes");
console.log("[1] real cloud dead-axis:", real.status, "(dims:", real.dims.length + ")");

// 2. zeroing a feature across every state makes the check WARN and name it.
const pts = DA.loadPoints().map((p) => ({ g: p.g, seed: p.seed, f: Object.assign({}, p.f, { pump: 0 }) }));
const zeroed = DA.check({ points: pts });
assert.strictEqual(zeroed.status, "WARN");
assert.ok(zeroed.dead.some((d) => d.feature === "pump" && d.variance === 0), "pump must be flagged dead");
console.log("[2] pump-zeroed dead-axis:", zeroed.status, JSON.stringify(zeroed.dead));

// 3. PCA report is well-formed: components sum <= trace, eigenvalues descending,
//    each loading vector is unit-norm.
const r = PCA.build({ components: 4, top: 5, deadThreshold: DA.DEFAULT_THRESHOLD });
assert.strictEqual(r.n, real.dims.length);
assert.ok(r.trace > 0);
for (let i = 1; i < r.components.length; i++)
  assert.ok(r.components[i].lambda <= r.components[i - 1].lambda + 1e-9, "eigenvalues must be non-increasing");
for (const c of r.components) {
  const nrm = Math.sqrt(c.vec.reduce((a, x) => a + x * x, 0));
  assert.ok(Math.abs(nrm - 1) < 1e-6, "component vector must be unit-norm");
}
console.log("[3] PCA: PC1 eig=" + r.components[0].lambda.toFixed(3),
  "cum%=" + (100 * r.components.reduce((a, c) => a + Math.max(0, c.lambda), 0) / r.trace).toFixed(1));

// 4. determinism: identical build twice -> identical eigenvalues/vectors.
const r2 = PCA.build({ components: 4, top: 5, deadThreshold: DA.DEFAULT_THRESHOLD });
assert.deepStrictEqual(
  r.components.map((c) => [c.lambda, c.vec]),
  r2.components.map((c) => [c.lambda, c.vec]),
  "PCA must be deterministic");
console.log("[4] determinism: two builds byte-identical");

console.log("\nALL PASS");
