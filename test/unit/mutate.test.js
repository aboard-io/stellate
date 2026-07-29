#!/usr/bin/env node
// Narrow test for tools/genre/mutate.js — the mutation/breeder + cleanup contract.
const assert = require('assert');
const K = require('../../engine/genre-kernel.js');
const { mutate } = require('../../tools/genre/mutate.js');

let pass = 0;
const ok = (c, m) => { assert.ok(c, m); console.log('  ok  ' + m); pass++; };

// snapshot the catalog before ANY tool run
const keys0 = Object.keys(K.GENRES);

// 1) zero-perturbation determinism guard: byte-identical track
const z = mutate('techno', { dim: 'bpm', delta: 0, mode: 'add', seed: 3 });
ok(z.byteIdentical === true, 'zero perturbation (bpm +0) -> byte-identical track');
ok(z.restore.ok === true, 'zero perturbation -> restore CLEAN');

// 2) restore proof: the catalog is unchanged AFTER running — same length, same
// order. The count is READ FROM THE KERNEL, never spelled here: this line said
// 249 and had been failing since the catalog passed it, which is the same rot
// test/gates/doc-counts.test.js polices in the prose and nothing policed in the
// gates. What is under test is that mutate() puts the catalog back, not how big
// the catalog is.
const keys1 = Object.keys(K.GENRES);
ok(keys1.length === keys0.length, `catalog size unchanged across a mutate run (${keys0.length} -> ${keys1.length})`);
ok(keys1.length === keys0.length && keys0.every((k, i) => k === keys1[i]),
  'Object.keys(K.GENRES) unchanged (same length + same order) after run');
ok(z.restore.referenceOk && z.restore.orderOk && z.restore.roundTripByteEqual,
  'restore report: reference identical, order preserved, base re-render byte-equal');

// 3) a REAL perturbation is rendered + audited + margin-checked
const m = mutate('techno', { dim: 'bpm', delta: 40, mode: 'add', seed: 3 });
ok(m.byteIdentical === false, 'bpm +40 -> track actually changes (not byte-identical)');
ok(m.change.after[0] === 164 && m.change.after[1] === 180, 'range shifted [124,140] -> [164,180]');
ok(['OK', 'WARN', 'FAIL'].includes(m.music.verdict), 'music verdict present: ' + m.music.verdict);
ok(typeof m.identity.mutantMargin === 'number', 'margin computed: base ' + m.identity.baseMargin + ' -> mutant ' + m.identity.mutantMargin);
ok(m.restore.ok === true, 'real perturbation -> restore CLEAN');

// 4) nested dotted-path dimension works, and still restores clean
const n = mutate('jungle', { dim: 'swing', delta: 0.3, mode: 'add', seed: 2 });
ok(Array.isArray(n.change.after), 'nested/range dim swing perturbed: ' + JSON.stringify(n.change.after));
ok(n.restore.ok === true, 'swing perturbation -> restore CLEAN');

// 5) non-perturbable dimension is rejected honestly (no state leak)
let threw = false;
try { mutate('techno', { dim: 'kits', delta: 1 }); } catch (e) { threw = /only perturbs a scalar|not declared/.test(e.message); }
ok(threw, 'non-numeric dimension (kits) rejected with an honest error');
ok(Object.keys(K.GENRES).length === keys0.length,
  `catalog intact after the rejected perturbation (${keys0.length})`);

console.log(`\nPASS ${pass}/${pass}`);
