#!/usr/bin/env node
'use strict';
// genome-diff.js — ROADMAP §1.4.3
// Readable diff of two genres across BOTH declared dimensions (resolved choices +
// spec pool set-diff) AND measured feature deltas, annotated with which genre's
// V.TARGETS box constrains each feature.
//
// CLI:  node tools/genome-diff.js A B [seed]
//   diff(A,A) is empty (same seed -> byte-identical state); real pairs surface the
//   largest measured deltas and show they land on differently-constrained features.
//
// OFFLINE / READ-ONLY: only reads K.GENRES and calls K.track / V.features / V.TARGETS.
// DETERMINISTIC: fixed seed (default 1), no Date.now()/Math.random().

const K = require('/home/ford/stellate/engine/genre-kernel.js');
const V = require('/home/ford/stellate/engine/genre-verifier.js');

const DEFAULT_SEED = 1;

// ---- declared side: resolved choices (state.genreMeta) --------------------
// genreMeta is the resolved-choice record toState writes. Compare field-by-field;
// non-primitive values are canonicalized to a string for a stable compare/display.
function metaVal(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function declaredMetaDiff(metaA, metaB) {
  const keys = Array.from(new Set([...Object.keys(metaA), ...Object.keys(metaB)]));
  const rows = [];
  for (const k of keys) {
    const a = metaVal(metaA[k]);
    const b = metaVal(metaB[k]);
    if (a !== b) rows.push({ field: k, a, b });
  }
  return rows;
}

// ---- declared side: spec pool set-diff over K.GENRES[a] vs [b] -------------
// Walk the raw spec and collect every string leaf that lives inside an array
// (the "pools": progressions, kits, fills, bass.patterns, ...) as "path:value"
// tokens, then set-diff. This is the honest set difference of the material each
// anchor draws from, independent of what a single seed happened to resolve.
function collectPoolTokens(node, path, out) {
  if (Array.isArray(node)) {
    for (const el of node) {
      if (typeof el === 'string') out.add(path + ':' + el);
      else if (el && typeof el === 'object') collectPoolTokens(el, path, out);
    }
  } else if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      collectPoolTokens(node[key], path ? path + '.' + key : key, out);
    }
  }
}

function poolSetDiff(specA, specB) {
  const A = new Set(), B = new Set();
  collectPoolTokens(specA, '', A);
  collectPoolTokens(specB, '', B);
  // group by path -> { onlyA:[values], onlyB:[values] }
  const byPath = {};
  const touch = (p) => (byPath[p] = byPath[p] || { onlyA: [], onlyB: [] });
  for (const tok of A) if (!B.has(tok)) { const i = tok.indexOf(':'); touch(tok.slice(0, i)).onlyA.push(tok.slice(i + 1)); }
  for (const tok of B) if (!A.has(tok)) { const i = tok.indexOf(':'); touch(tok.slice(0, i)).onlyB.push(tok.slice(i + 1)); }
  const paths = Object.keys(byPath).sort();
  for (const p of paths) { byPath[p].onlyA.sort(); byPath[p].onlyB.sort(); }
  return { paths, byPath };
}

// ---- measured side: feature deltas ----------------------------------------
function whoConstrains(feat, a, b) {
  const inA = V.TARGETS[a] && Object.prototype.hasOwnProperty.call(V.TARGETS[a], feat);
  const inB = V.TARGETS[b] && Object.prototype.hasOwnProperty.call(V.TARGETS[b], feat);
  return (inA ? 'A' : '') + (inB ? 'B' : '') || '-';
}

function featureDiff(a, b, featsA, featsB) {
  const keys = Array.from(new Set([...Object.keys(featsA), ...Object.keys(featsB)]));
  const rows = keys.map((f) => {
    const va = Number(featsA[f]) || 0;
    const vb = Number(featsB[f]) || 0;
    return { feat: f, a: va, b: vb, delta: vb - va, constrains: whoConstrains(f, a, b) };
  });
  rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || (x.feat < y.feat ? -1 : 1));
  return rows;
}

// ---- top-level diff (also exported for programmatic use) ------------------
function diff(a, b, seed = DEFAULT_SEED) {
  if (!K.GENRES[a]) throw new Error('unknown genre: ' + a);
  if (!K.GENRES[b]) throw new Error('unknown genre: ' + b);
  const stA = K.track(a, { seed });
  const stB = K.track(b, { seed });
  const featsA = V.features(stA);
  const featsB = V.features(stB);
  return {
    a, b, seed,
    metaRows: declaredMetaDiff(stA.genreMeta, stB.genreMeta),
    pools: poolSetDiff(K.GENRES[a], K.GENRES[b]),
    featRows: featureDiff(a, b, featsA, featsB),
  };
}

// ---- rendering ------------------------------------------------------------
function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

function render(d) {
  const L = [];
  L.push('GENOME DIFF: ' + d.a + '  vs  ' + d.b + '   (seed ' + d.seed + ')');
  L.push('');

  L.push('DECLARED — resolved choices (state.genreMeta):');
  if (!d.metaRows.length) {
    L.push('  (identical)');
  } else {
    L.push('  ' + pad('field', 12) + pad('A', 34) + 'B');
    for (const r of d.metaRows) {
      L.push('  ' + pad(r.field, 12) + pad(r.a.slice(0, 32), 34) + r.b.slice(0, 60));
    }
  }
  L.push('');

  L.push('DECLARED — spec pool set-diff (K.GENRES material):');
  if (!d.pools.paths.length) {
    L.push('  (identical pools)');
  } else {
    for (const p of d.pools.paths) {
      const e = d.pools.byPath[p];
      const only = [];
      if (e.onlyA.length) only.push('A-only{' + e.onlyA.join(',') + '}');
      if (e.onlyB.length) only.push('B-only{' + e.onlyB.join(',') + '}');
      L.push('  ' + pad(p, 24) + only.join('  '));
    }
  }
  L.push('');

  L.push('MEASURED — feature deltas (B - A), sorted by |Δ|:');
  L.push('  ' + pad('feature', 14) + padL('A', 8) + padL('B', 8) + padL('Δ', 9) + '   constrains');
  let nz = 0, alignTop = 0, topN = 0;
  for (const r of d.featRows) {
    if (Math.abs(r.delta) > 1e-9) {
      nz++;
      if (topN < 5) { topN++; if (r.constrains !== '-') alignTop++; }
    }
    const sign = r.delta >= 0 ? '+' : '';
    L.push('  ' + pad(r.feat, 14) + padL(r.a.toFixed(3), 8) + padL(r.b.toFixed(3), 8) +
      padL(sign + r.delta.toFixed(3), 9) + '   ' +
      (r.constrains === '-' ? '-' : '[' + r.constrains.split('').join(' ') + ']'));
  }
  L.push('');
  L.push('  legend: [A]=constrained only by ' + d.a + '  [B]=only ' + d.b + '  [A B]=both  -=neither');
  if (nz === 0) {
    L.push('  Σ  no measured deltas — genomes are identical.');
  } else {
    L.push('  Σ  ' + nz + ' features differ; ' + alignTop + '/' + topN +
      ' of the largest deltas are on TARGETS-constrained features.');
  }
  return L.join('\n');
}

// ---- CLI ------------------------------------------------------------------
function main(argv) {
  const [a, b, seedArg] = argv;
  if (!a || !b) {
    console.error('usage: node tools/genome-diff.js A B [seed]');
    console.error('  A, B: genre anchor names from K.GENRES (249 anchors)');
    process.exit(2);
  }
  const seed = seedArg !== undefined ? Number(seedArg) : DEFAULT_SEED;
  let d;
  try {
    d = diff(a, b, seed);
  } catch (e) {
    console.error('error: ' + e.message);
    process.exit(1);
  }
  console.log(render(d));
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { diff, render, declaredMetaDiff, poolSetDiff, featureDiff };
