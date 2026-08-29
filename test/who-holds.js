#!/usr/bin/env node
// test/who-holds.js — WHO IS HOLDING THIS? A retainer walk over a V8 heap snapshot.
//
//   node test/leak-procs.js --snap --tag run      # writes /tmp/leak-run.heapsnapshot
//   node test/who-holds.js /tmp/leak-run.heapsnapshot 4 '^ensureWorker$'
//
// Written for the 2026-08-28 ring leak, where "something in the window is
// holding the ring buffers" was true and useless. The path is the answer:
//   AudioWorkletNode --fOutputHandler--> closure --context--> the conductor scope
// and one level on from that,
//   closure --context--> V8EventHandlerNonNull --> AudioContext --> AudioWorkletNode
// which is `ctx.onstatechange`, kept alive by Blink's "Pending activities" list
// long after ctx.close(). Neither was guessable; both were one BFS away.
//
// args: <snapshot> [howMany=6] [nameRegex=^AudioContext$] [--census]
// Weak edges and WeakRef/FinalizationRegistry retainers are skipped, or every
// path comes back through whatever probe is holding WeakRefs for counting.
"use strict";
const fs = require("fs");
const snap = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const meta = snap.snapshot.meta;
const NF = meta.node_fields, EF = meta.edge_fields;
const NT = meta.node_types[0], ET = meta.edge_types[0];
const nodes = snap.nodes, edges = snap.edges, strings = snap.strings;
const nfc = NF.length, efc = EF.length;
const iType = NF.indexOf("type"), iName = NF.indexOf("name"), iId = NF.indexOf("id"),
      iSelf = NF.indexOf("self_size"), iEc = NF.indexOf("edge_count");
const eType = EF.indexOf("type"), eName = EF.indexOf("name_or_index"), eTo = EF.indexOf("to_node");
const N = nodes.length / nfc;
const nodeName = (i) => strings[nodes[i * nfc + iName]];
const nodeType = (i) => NT[nodes[i * nfc + iType]];
const nodeSize = (i) => nodes[i * nfc + iSelf];

// edge start offset per node
const firstEdge = new Uint32Array(N + 1);
let acc = 0;
for (let i = 0; i < N; i++) { firstEdge[i] = acc; acc += nodes[i * nfc + iEc]; }
firstEdge[N] = acc;

// retainers
const retCount = new Uint32Array(N);
for (let e = 0; e < edges.length / efc; e++) retCount[edges[e * efc + eTo] / nfc]++;
const retStart = new Uint32Array(N + 1);
let a2 = 0;
for (let i = 0; i < N; i++) { retStart[i] = a2; a2 += retCount[i]; }
retStart[N] = a2;
const fill = new Uint32Array(N);
const retNode = new Uint32Array(a2), retEdge = new Uint32Array(a2);
for (let i = 0; i < N; i++)
  for (let e = firstEdge[i]; e < firstEdge[i + 1]; e++) {
    const to = edges[e * efc + eTo] / nfc;
    const p = retStart[to] + fill[to]++;
    retNode[p] = i; retEdge[p] = e;
  }
const edgeLabel = (e) => {
  const t = ET[edges[e * efc + eType]];
  const n = edges[e * efc + eName];
  return (t === "element" || t === "hidden") ? "[" + n + "]" : strings[n];
};

// targets: whatever the caller names
const WANT = new RegExp(process.argv[4] || "^AudioContext$");
const targets = [];
for (let i = 0; i < N; i++) if (WANT.test(nodeName(i)) && nodeType(i) !== "synthetic") targets.push(i);
console.log("nodes matching " + WANT + ": " + targets.length);
if (process.argv[5] === "--census") {
  const by = new Map();
  for (let i = 0; i < N; i++) { const k = nodeType(i) + " " + nodeName(i); by.set(k, (by.get(k) || 0) + 1); }
  console.log([...by].filter(([k, v]) => /AudioContext|AudioWorklet|Worker|MediaStream|exploreLive|conductor/i.test(k))
    .sort((a, b) => b[1] - a[1]).slice(0, 30));
}

const seen = new Uint8Array(N);
function pathToRoot(start) {
  const q = [start]; seen.fill(0); seen[start] = 1;
  const from = new Int32Array(N).fill(-1), via = new Int32Array(N).fill(-1);
  while (q.length) {
    const cur = q.shift();
    if (nodeType(cur) === "synthetic" || nodeName(cur) === "Window" || /GC roots|global/.test(nodeName(cur))) {
      const path = []; let c = cur;
      while (c !== start) { path.push(nodeName(c) + " (" + nodeType(c) + ") --" + edgeLabel(via[c]) + "-->"); c = from[c]; }
      return path.reverse().join("\n    ");
    }
    for (let p = retStart[cur]; p < retStart[cur + 1]; p++) {
      const r = retNode[p];
      const et = ET[edges[retEdge[p] * efc + eType]];
      if (et === "weak") continue;                       // a WeakRef is not a retainer
      if (nodeName(r) === "WeakRef" || nodeName(r) === "FinalizationRegistry") continue;
      if (nodeType(r) === "synthetic" && /Read-only/.test(nodeName(r))) continue;
      if (seen[r]) continue;
      seen[r] = 1; from[r] = cur; via[r] = retEdge[p]; q.push(r);
    }
  }
  return "(no root path found)";
}
const show = Math.min(targets.length, +(process.argv[3] || 6));
for (let k = 0; k < show; k++) {
  const t = targets[k];
  console.log("\n--- SAB #" + k + " id=" + nodes[t * nfc + iId] + " self=" + nodeSize(t));
  console.log("    " + pathToRoot(t));
}
