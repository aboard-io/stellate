#!/usr/bin/env node
// neighbors.js — ROADMAP §1.4.2 "Genres-adjacent-to-X".
//
// For a genre, print its k nearest neighbours in BOTH coordinate systems the
// catalog already computes:
//
//   (1) DECLARED-VOCABULARY space — engine/genre-sim.js `genreSim`, the
//       weighted-Jaccard over what each anchor *says* it is made of
//       (progressions + synth/sampler material + kits + form + bpm). This is
//       the star-map's own similarity, so "declared" neighbours are the ones a
//       reader of the GENRES literal would call cousins.
//
//   (2) MEASURED feature space — engine/genre-geometry.js `nearest`, Euclidean
//       distance between z-scored 23-D verifier centroids. This is what the
//       anchors actually *render as* (V.features over K.track), independent of
//       how they were declared.
//
// The two lists agreeing means an anchor sounds like it reads; them disagreeing
// is a diagnostic (declared cousins that render apart, or measured twins that
// share no vocabulary). As a third column we surface the anchor's CONFUSION
// RIVAL — the genre its rendered tracks score highest AGAINST in the persisted
// confusion matrix (genre-geometry.matrix()) — because for a genuinely
// confusable genre the top MEASURED neighbour should be that same rival.
//
// READ-ONLY + OFFLINE + DETERMINISTIC: pure reads of genre-sim / genre-geometry
// (which read K.GENRES + the seeded feature cache). No mutation, no rng, no
// Date.now — same genre in -> byte-identical output.
//
//   neighbors(genre, k) -> { genre, k, declared:[{genre,sim}],
//                            measured:[{genre,dist}], rival:{genre,score}|null,
//                            rivalIsTopMeasured, overlap:[genre...] }
//   node tools/neighbors.js <genre> [k]

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const S = isNode ? require("../engine/genre-sim.js") : root.GenreSim;
  const G = isNode ? require("../engine/genre-geometry.js") : root.GenreGeometry;

  // The confusion rival: over the persisted matrix row for `genre`, the target
  // column (other than self) its rendered tracks score highest against. Returns
  // null when the matrix hasn't been built or the genre isn't a scored anchor.
  function rivalOf(genre) {
    const m = G.matrix();
    if (!m || !m.genres || !m.cells || !m.cells[genre]) return null;
    const row = m.cells[genre];
    let bestI = -1, bestS = -Infinity;
    for (let i = 0; i < m.genres.length; i++) {
      if (m.genres[i] === genre) continue;      // skip the self column
      if (row[i] > bestS) { bestS = row[i]; bestI = i; }
    }
    if (bestI < 0) return null;
    return { genre: m.genres[bestI], score: bestS };
  }

  function neighbors(genre, k) {
    k = k || 8;
    const declared = S.nearestSim(genre, k);      // throws on unknown genre
    const measured = G.nearest(genre, k);
    const rival = rivalOf(genre);
    const dSet = new Set(declared.map((r) => r.genre));
    const overlap = measured.filter((r) => dSet.has(r.genre)).map((r) => r.genre);
    const rivalIsTopMeasured = !!(rival && measured[0] && measured[0].genre === rival.genre);
    return { genre, k, declared, measured, rival, rivalIsTopMeasured, overlap };
  }

  const api = { neighbors, rivalOf };
  if (isNode) module.exports = api; else root.Neighbors = api;

  if (isNode && require.main === module) {
    const g = process.argv[2], k = parseInt(process.argv[3], 10) || 8;
    if (!g) { console.log("usage: neighbors.js <genre> [k]"); process.exit(0); }
    let r;
    try { r = neighbors(g, k); }
    catch (e) { console.error("error: " + e.message); process.exit(1); }
    console.log(`\nneighbours of ${g} (k=${k})`);
    console.log("");
    console.log("  DECLARED-vocabulary (genre-sim)     MEASURED feature-space (z-centroid)");
    console.log("  " + "-".repeat(34) + "  " + "-".repeat(34));
    for (let i = 0; i < k; i++) {
      const d = r.declared[i], me = r.measured[i];
      const L = d ? `${((i + 1) + ".").padEnd(3)}${d.genre.padEnd(20)} ${d.sim.toFixed(3)}` : "";
      const R = me ? `${((i + 1) + ".").padEnd(3)}${me.genre.padEnd(20)} ${me.dist.toFixed(3)}` : "";
      console.log("  " + L.padEnd(36) + R);
    }
    console.log("");
    if (r.rival)
      console.log(`  confusion rival (matrix): ${r.rival.genre} (scores ${r.rival.score} against it)` +
        (r.rivalIsTopMeasured ? "  <- IS the top measured neighbour" : ""));
    else
      console.log("  confusion rival: (matrix not built)");
    console.log(`  shared by both lists: ${r.overlap.length ? r.overlap.join(", ") : "(none)"}`);
    console.log("");
  }
})(typeof window !== "undefined" ? window : globalThis);
