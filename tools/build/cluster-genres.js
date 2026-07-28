#!/usr/bin/env node
// tools/build/cluster-genres.js — the STAR-SYSTEM clustering for star-cruise 3D mode.
//
// Groups the 250 genres of the measured feature space into STARS: each cluster
// is a colored sun, each member genre is a planet orbiting near it. The
// star-cruise navigation pass imports the emitted module to place suns +
// planets and to name the star in the cockpit HUD.
//
// Emits a browser ES module app/starcruise/genre-clusters.js:
//
//   export const GENRE_CLUSTERS = [
//     { id, label, color:[r,g,b], star:[x,y,z], members:[{genre, pos:[x,y,z]}] },
//     ...
//   ];
//   export const CLUSTER_OF  = { genre: clusterId, ... };  // every genre → its star
//   export const CLUSTERS_META = { method, count, sizeMin, sizeMax, ... };
//
// METHOD — deterministic Ward agglomerative clustering + size-capped tree cut:
//
//   (1) Cluster on the SAME z-scored 23-D symbolic-feature centroids the gate
//       judges separation in (engine/genre-geometry.js centroids()). Nearby in
//       that space == similar sounding, so Ward's minimum-variance merges pull
//       musically-alike genres together (techno/house/industrial; ambient/
//       drone; folk/bluegrass/country; metal; …).
//
//   (2) Build the FULL Ward dendrogram (merge the cheapest pair each step, all
//       the way to a single root) via the Lance-Williams update. Then CUT the
//       tree top-down: descend from the root and emit any subtree whose size is
//       <= MAX_SIZE (12) as one STAR; recurse into oversized subtrees. This
//       honors the natural hierarchy — it never force-fills a cluster to 12 by
//       jamming in dissimilar genres — while guaranteeing every star holds
//       1..12 planets. Outliers fall out as singleton stars.
//
//   Determinism: sorted genre list, squared-Euclidean Ward.D2 seeds, and every
//   tie (equal merge cost, equal medoid distance, cluster ordering) broken by
//   sorted genre keys. Same inputs → BYTE-IDENTICAL output.
//
//   STAR position = mean of the member GENRE_COORDS (the sun sits at the
//   cluster's centroid in the 3D planet layout). Planet position = the genre's
//   GENRE_COORDS. LABEL = the cluster medoid (member centroid closest to the
//   cluster mean) — the most representative genre, short for a cockpit HUD.
//   COLOR = a distinct hue per cluster index (golden-angle around the wheel).
//
// OFFLINE + READ-ONLY: imports engine/genre-geometry.js for centroids and reads
// app/starcruise/genre-coords.js for the planet layout; never mutates either,
// never runs during a render, and only WRITES app/starcruise/genre-clusters.js.
//
// CLI:
//   node tools/build/cluster-genres.js [--max <n>] [--out <path>]
//     builds the clustering, writes the module, prints the count, size
//     distribution, a few example star systems, verification checks, and a
//     determinism hash.

"use strict";
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const G = require(path.join(__dirname, "..", "..", "engine", "genre-geometry.js"));

// ---- fixed, deterministic constants ----
const MAX_SIZE = 12;   // hard cap on planets per star
const COORD_DEC = 3;   // star/planet coordinate precision (matches genre-coords.js)
const COLOR_DEC = 4;   // rgb precision
const FOLK_KNN = 6;    // neighbors used to synthesize a missing planet coord
const DEFAULT_OUT = path.join(__dirname, "..", "..", "app", "starcruise", "genre-clusters.js");
const COORDS_PATH = path.join(__dirname, "..", "..", "app", "starcruise", "genre-coords.js");

function roundTo(x, dec) { const p = 10 ** dec; return Math.round(x * p) / p; }

// ---- load the 3D planet layout (parse the ES module, don't import it) ----
function loadCoords() {
  const txt = fs.readFileSync(COORDS_PATH, "utf8");
  const body = txt.match(/GENRE_COORDS\s*=\s*\{([\s\S]*?)\n\};/);
  if (!body) throw new Error("could not parse GENRE_COORDS from " + COORDS_PATH);
  const coords = {};
  const re = /(?:^|\n)\s*(?:([A-Za-z_$][\w$]*)|"([^"]+)")\s*:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g;
  let m;
  while ((m = re.exec(body[1]))) {
    const g = m[1] || m[2];
    coords[g] = [parseFloat(m[3]), parseFloat(m[4]), parseFloat(m[5])];
  }
  return coords;
}

// Synthesize a planet coord for any genre missing from GENRE_COORDS, as the
// inverse-(centroid)distance weighted mean of its nearest genres that DO have a
// coord. Deterministic (nearest() is a stable sort) and musically honest: the
// planet lands among the genres it actually sounds like.
function synthCoord(genre, coords) {
  const near = G.nearest(genre).filter((r) => coords[r.genre]).slice(0, FOLK_KNN);
  let wsum = 0;
  const acc = [0, 0, 0];
  for (const r of near) {
    const w = 1 / (r.dist + 1e-9);
    wsum += w;
    const p = coords[r.genre];
    for (let a = 0; a < 3; a++) acc[a] += w * p[a];
  }
  return acc.map((v) => roundTo(v / wsum, COORD_DEC));
}

// ---- Ward agglomerative dendrogram over the z-scored centroids ----
function sqEuclid(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s; }

// Build the full merge tree. Returns { root, nodes } where each node is
// { id, size, members:[genre], minKey, left, right }. `minKey` = lexicographic
// smallest member, used to break every tie so the whole build is order-stable.
function wardTree(genres, cent) {
  const nodes = {};
  const active = [];               // active node ids, kept sorted by minKey
  let nextId = 0;

  // leaves
  for (const g of genres) {
    const id = nextId++;
    nodes[id] = { id, size: 1, members: [g], minKey: g, left: null, right: null };
    active.push(id);
  }
  active.sort((a, b) => (nodes[a].minKey < nodes[b].minKey ? -1 : 1));

  // pairwise Ward.D2 distances between active nodes: key "lo|hi" (numeric ids)
  const dkey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const D = new Map();
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      D.set(dkey(a, b), sqEuclid(cent[nodes[a].members[0]], cent[nodes[b].members[0]]));
    }

  while (active.length > 1) {
    // find cheapest merge; ties broken by (minKeyA, minKeyB) with A the smaller
    let best = null, bestCost = Infinity, bestKeyA = null, bestKeyB = null;
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        const cost = D.get(dkey(a, b));
        let kA = nodes[a].minKey, kB = nodes[b].minKey;
        if (kA > kB) { const t = kA; kA = kB; kB = t; }
        if (cost < bestCost - 1e-12 ||
          (Math.abs(cost - bestCost) <= 1e-12 && (kA < bestKeyA || (kA === bestKeyA && kB < bestKeyB)))) {
          best = [a, b]; bestCost = cost; bestKeyA = kA; bestKeyB = kB;
        }
      }

    const [a, b] = best;
    const na = nodes[a].size, nb = nodes[b].size;
    const id = nextId++;
    const members = nodes[a].members.concat(nodes[b].members).sort();
    nodes[id] = {
      id, size: na + nb, members,
      minKey: members[0], left: a, right: b, cost: bestCost,
    };

    // Lance-Williams Ward update of distances from the new node to every other
    const dab = D.get(dkey(a, b));
    for (const k of active) {
      if (k === a || k === b) continue;
      const nk = nodes[k].size;
      const dak = D.get(dkey(a, k)), dbk = D.get(dkey(b, k));
      const dnew = ((na + nk) * dak + (nb + nk) * dbk - nk * dab) / (na + nb + nk);
      D.set(dkey(id, k), dnew);
    }
    // retire a, b; insert new node keeping active sorted by minKey
    const rm = new Set([a, b]);
    for (let i = active.length - 1; i >= 0; i--) if (rm.has(active[i])) active.splice(i, 1);
    let ins = active.findIndex((x) => nodes[x].minKey > nodes[id].minKey);
    if (ins < 0) ins = active.length;
    active.splice(ins, 0, id);
  }

  return { root: active[0], nodes };
}

// Cut the dendrogram top-down: emit any subtree with size <= MAX as one cluster.
function cutTree(root, nodes, maxSize) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const id = stack.pop();
    const node = nodes[id];
    if (node.size <= maxSize) out.push(node.members.slice());
    else { stack.push(node.left, node.right); }
  }
  return out;
}

// ---- per-cluster derived properties ----
// medoid: member whose centroid is closest to the cluster mean centroid.
function medoid(members, cent) {
  const dim = cent[members[0]].length;
  const mean = new Array(dim).fill(0);
  for (const g of members) { const v = cent[g]; for (let i = 0; i < dim; i++) mean[i] += v[i]; }
  for (let i = 0; i < dim; i++) mean[i] /= members.length;
  let best = null, bestD = Infinity;
  for (const g of members.slice().sort()) {   // sorted → deterministic tie-break
    const d = sqEuclid(cent[g], mean);
    if (d < bestD - 1e-12) { bestD = d; best = g; }
  }
  return best;
}

// distinct hue per cluster index, golden-angle around the wheel → adjacent ids
// never share a hue. Fixed S/L. Returns [r,g,b] in 0..1.
function clusterColor(i) {
  const hue = (i * 137.508) % 360;
  return hslToRgb(hue / 360, 0.62, 0.55).map((c) => roundTo(c, COLOR_DEC));
}
function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (t) => {
    let tt = t; if (tt < 0) tt += 1; if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hk(h + 1 / 3), hk(h), hk(h - 1 / 3)];
}

// ---- build everything ----
function build(maxSize) {
  const cent = G.centroids();
  const genres = Object.keys(cent).sort();
  const coordsRaw = loadCoords();

  // resolve a planet coord for every genre (synthesize any that lack one)
  const coords = {};
  const synthesized = [];
  for (const g of genres) {
    if (coordsRaw[g]) coords[g] = coordsRaw[g].map((v) => roundTo(v, COORD_DEC));
    else { coords[g] = synthCoord(g, coordsRaw); synthesized.push(g); }
  }

  const { root, nodes } = wardTree(genres, cent);
  let groups = cutTree(root, nodes, maxSize);

  // canonical cluster order: by smallest member genre (deterministic ids)
  groups.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const clusters = groups.map((members, id) => {
    const sorted = members.slice().sort();
    // star = mean of member planet coords
    const star = [0, 0, 0];
    for (const g of sorted) { const p = coords[g]; for (let a = 0; a < 3; a++) star[a] += p[a]; }
    for (let a = 0; a < 3; a++) star[a] = roundTo(star[a] / sorted.length, COORD_DEC);
    return {
      id,
      label: medoid(sorted, cent),
      color: clusterColor(id),
      star,
      members: sorted.map((g) => ({ genre: g, pos: coords[g] })),
    };
  });

  const CLUSTER_OF = {};
  for (const c of clusters) for (const m of c.members) CLUSTER_OF[m.genre] = c.id;

  const sizes = clusters.map((c) => c.members.length);
  const meta = {
    method: "ward-agglomerative + size-capped top-down tree cut",
    space: "z-scored symbolic-feature centroids (engine/genre-geometry.js)",
    linkage: "ward.D2 (Lance-Williams)",
    planetSource: "app/starcruise/genre-coords.js GENRE_COORDS",
    starPosition: "mean of member planet coords",
    labelRule: "cluster medoid (member centroid nearest the cluster mean)",
    colorRule: "golden-angle hue per cluster id; S=0.62 L=0.55; rgb 0..1",
    genres: genres.length,
    count: clusters.length,
    sizeMin: Math.min(...sizes),
    sizeMax: Math.max(...sizes),
    maxSizeCap: maxSize,
    singletons: sizes.filter((s) => s === 1).length,
    synthesizedCoords: synthesized,
    coordDecimals: COORD_DEC,
    colorDecimals: COLOR_DEC,
  };

  return { clusters, CLUSTER_OF, meta };
}

// ---- emit the browser ES module (byte-identical across runs) ----
function serialize(built) {
  const { clusters, CLUSTER_OF, meta } = built;
  const lines = [];
  lines.push("// app/starcruise/genre-clusters.js — AUTO-GENERATED by tools/build/cluster-genres.js.");
  lines.push("// Do not edit by hand: re-run `node tools/build/cluster-genres.js` to regenerate.");
  lines.push("//");
  lines.push("// The STAR SYSTEMS of star-cruise 3D mode. Each cluster is a colored sun; each");
  lines.push("// member genre is a planet orbiting near it. Nearby genres sound alike (Ward");
  lines.push("// clustering of the z-scored feature centroids). The navigation pass imports");
  lines.push("// this to place suns + planets and to label the star in the cockpit HUD.");
  lines.push("//");
  lines.push(`// method=${meta.method}`);
  lines.push(`// stars=${meta.count}  genres=${meta.genres}  size=${meta.sizeMin}..${meta.sizeMax}  singletons=${meta.singletons}`);
  lines.push("");
  lines.push("export const GENRE_CLUSTERS = [");
  for (const c of clusters) {
    const mem = c.members.map((m) => `{ genre: ${JSON.stringify(m.genre)}, pos: [${m.pos.join(", ")}] }`).join(", ");
    lines.push(`  { id: ${c.id}, label: ${JSON.stringify(c.label)}, color: [${c.color.join(", ")}], star: [${c.star.join(", ")}],`);
    lines.push(`    members: [${mem}] },`);
  }
  lines.push("];");
  lines.push("");
  lines.push("export const CLUSTER_OF = {");
  for (const g of Object.keys(CLUSTER_OF).sort())
    lines.push(`  ${/^[A-Za-z_$][\w$]*$/.test(g) ? g : JSON.stringify(g)}: ${CLUSTER_OF[g]},`);
  lines.push("};");
  lines.push("");
  lines.push("export const CLUSTERS_META = " + JSON.stringify(meta, null, 2) + ";");
  lines.push("");
  return lines.join("\n");
}

// ---- CLI ----
function argOf(flag, dflt) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : dflt; }

if (require.main === module) {
  const maxSize = parseInt(argOf("--max", String(MAX_SIZE)), 10);
  const outPath = argOf("--out", DEFAULT_OUT);
  const built = build(maxSize);
  const text = serialize(built);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text);
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  const { clusters, CLUSTER_OF, meta } = built;

  console.log(`wrote ${outPath}  (${meta.count} stars over ${meta.genres} genres, sha256:${hash})`);
  console.log(`size: min=${meta.sizeMin} max=${meta.sizeMax} cap=${meta.maxSizeCap}  singletons=${meta.singletons}`);
  if (meta.synthesizedCoords.length)
    console.log(`synthesized planet coords (missing from GENRE_COORDS): ${meta.synthesizedCoords.join(", ")}`);

  // size distribution histogram
  const hist = {};
  for (const c of clusters) hist[c.members.length] = (hist[c.members.length] || 0) + 1;
  console.log("size distribution (size: #stars): " +
    Object.keys(hist).map(Number).sort((a, b) => a - b).map((s) => `${s}:${hist[s]}`).join("  "));

  // ---- verification ----
  const allGenres = Object.keys(G.centroids()).sort();
  const assigned = Object.keys(CLUSTER_OF).sort();
  const everyOnce = allGenres.length === assigned.length &&
    allGenres.every((g, i) => g === assigned[i]) &&
    clusters.reduce((s, c) => s + c.members.length, 0) === allGenres.length;
  const sizeOk = clusters.every((c) => c.members.length >= 1 && c.members.length <= maxSize);
  const starKeys = new Set(clusters.map((c) => c.star.join(",")));
  const starsDistinct = starKeys.size === clusters.length;
  // star = member-coord mean check (recompute for a couple)
  console.log("");
  console.log(`VERIFY every-genre-once: ${everyOnce ? "PASS" : "FAIL"}  (${assigned.length}/${allGenres.length})`);
  console.log(`VERIFY size in [1,${maxSize}]: ${sizeOk ? "PASS" : "FAIL"}`);
  console.log(`VERIFY star positions distinct: ${starsDistinct ? "PASS" : "FAIL"}  (${starKeys.size}/${clusters.length})`);

  // ---- example star systems ----
  console.log("\nexample star systems (largest first):");
  const byCoherence = clusters.slice().sort((a, b) => b.members.length - a.members.length);
  for (const c of byCoherence.slice(0, 6)) {
    console.log(`  ★ #${c.id} "${c.label}"  color=[${c.color.join(", ")}]  star=[${c.star.join(", ")}]  n=${c.members.length}`);
    console.log(`     ${c.members.map((m) => m.genre).join(", ")}`);
  }
}

module.exports = { build, serialize, wardTree, cutTree, loadCoords };
