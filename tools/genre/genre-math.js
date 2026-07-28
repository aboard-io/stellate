#!/usr/bin/env node
// genre-math.js — genre arithmetic (ROADMAP §1.3.2).
//
// Parse an expression of genre names and named feature axes, e.g.
//   "jazz - swing + fouronfloor"     (a genre, minus one axis, plus another)
//   "house*0.7 + techno*0.3 - wash"  (weighted genres, minus an axis)
// Compute the requested TARGET point in the verifier's z-scored centroid space
// (via engine/genre-geometry.js — the ONE shared geometry lib; we never re-derive
// z-scoring here), convert it back to raw features, and hand it to
// tools/genre/target-blend.js `solve` to get the NEAREST-REACHABLE weight vector. Report
// V.analyze top scores AND the residual.
//
// HONESTY LAW (ROADMAP §1 design principles): genre arithmetic is *not* free vector
// algebra in a space you can teleport around. Blends are forward-only picks over the
// catalog's own material, so the requested point is generally UNREACHABLE. This tool
// therefore reports "nearest reachable point + residual", never "the point you asked
// for". Negative weights and hull-extrapolation are impossible by construction: the
// arithmetic only moves the TARGET; the actual answer is produced by target-blend's
// projected simplex descent, whose weights are clamped >=0 and renormalised to sum 1.
// An out-of-hull expression (e.g. a genre pushed many sd's along an axis, or a large
// negative genre term) surfaces as a LARGE residual + an "out-of-hull" label — it is
// never silently snapped onto the hull and passed off as a hit.
//
// OFFLINE + READ-ONLY + DETERMINISTIC: reads K.GENRES / V.features / the shared
// z-space only; mutates nothing; must never run during a real render. All math is a
// fixed function of the expression + seed (target-blend's descent is rng-free), so
// same expression + same seed => identical output.
//
// API:  const { evaluate, parse, buildTarget } = require('./tools/genre/genre-math.js');
//       evaluate("jazz - swing + swing", { seed:1 })
//
// CLI:  node tools/genre/genre-math.js "jazz - swing + fouronfloor" [--seed N] [--k 12]
//       node tools/genre/genre-math.js "house + techno - wash" --seed 2 [--axis-sd 1]
//       node tools/genre/genre-math.js --list-axes         (print the 23 feature axes + aliases)

(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const K = isNode ? require("../../engine/genre-kernel.js") : root.GenreKernel;
  const V = isNode ? require("../../engine/genre-verifier.js") : root.GenreVerifier;
  const G = isNode ? require("../../engine/genre-geometry.js") : root.GenreGeometry;
  const TB = isNode ? require("./target-blend.js") : root.TargetBlend;

  // A per-unit feature-axis term nudges the target this many z-standard-deviations
  // along that axis. Identity ("A - x + x") cancels regardless of scale, so this is
  // just the visible magnitude of a bare "+axis" term. Overridable via --axis-sd.
  const DEFAULT_AXIS_SD = 1;
  // Residual (z-space Euclidean distance to the requested target) above this is
  // flagged "out-of-hull / needs new vocabulary" rather than a reachable point.
  // Heuristic: inter-centroid distances in this 23-D space run a few units, so a
  // residual of ~1.5+ means the request sits well off the reachable material.
  const HULL_TOL = 1.5;

  // Friendly aliases for feature axes so musician-facing terms parse. These are pure
  // coordinate synonyms (they name a z-axis direction to push +along); they do NOT
  // encode a sign flip — "+fouronfloor" pushes the offgrid axis UP just like the raw
  // axis would, so use "-fouronfloor" if you mean a steadier grid.
  const ALIASES = {
    fouronfloor: "offgrid",
    groove: "swing",
    busy: "drumDensity",
    reverb: "wash",
    bass: "sub",
    live: "acoustic",
    loose: "humanize",
  };

  function axisNames() {
    // the 23 numeric feature keys, in the shared dims order.
    return Object.keys(G.zstats());
  }

  // ---- parser -------------------------------------------------------------
  // Split into signed, optionally-weighted terms. A term is "name", "name*coef",
  // or "coef*name". Leading term defaults to +.
  function parse(expr) {
    if (typeof expr !== "string" || !expr.trim()) throw new Error("empty expression");
    // tokenize while carrying sign: normalise so every term is prefixed by + or -.
    const norm = expr.replace(/\s+/g, "");
    const terms = [];
    let i = 0, sign = 1, buf = "";
    const flush = () => {
      if (!buf) return;
      terms.push(parseTerm(buf, sign));
      buf = "";
    };
    // leading sign
    while (i < norm.length) {
      const ch = norm[i];
      if ((ch === "+" || ch === "-") && buf === "" && terms.length === 0 && i === 0) {
        sign = ch === "-" ? -1 : 1; i++; continue;
      }
      if (ch === "+" || ch === "-") {
        flush();
        sign = ch === "-" ? -1 : 1;
        i++; continue;
      }
      buf += ch; i++;
    }
    flush();
    if (!terms.length) throw new Error("no terms parsed from: " + expr);
    return terms;
  }

  function parseTerm(tok, sign) {
    let name = tok, coef = 1;
    if (tok.indexOf("*") >= 0) {
      const parts = tok.split("*");
      if (parts.length !== 2) throw new Error("bad term (one '*' allowed): " + tok);
      const [a, b] = parts;
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && isNaN(nb)) { coef = na; name = b; }
      else if (isNaN(na) && !isNaN(nb)) { coef = nb; name = a; }
      else throw new Error("bad term (need name*coef or coef*name): " + tok);
    }
    if (isNaN(parseFloat(name)) === false && K.GENRES[name] == null) {
      // a bare number with no name is meaningless as a target term
      throw new Error("term has no genre/axis name: " + tok);
    }
    // classify
    const axes = axisNames();
    let kind, axis = null;
    if (K.GENRES[name]) kind = "genre";
    else {
      const resolved = axes.indexOf(name) >= 0 ? name : ALIASES[name];
      if (resolved && axes.indexOf(resolved) >= 0) { kind = "axis"; axis = resolved; }
      else {
        throw new Error(
          "unknown term '" + name + "' — not a genre and not a feature axis.\n" +
          "  axes: " + axes.join(", ") + "\n" +
          "  aliases: " + Object.keys(ALIASES).join(", ")
        );
      }
    }
    return { raw: tok, name, coef, sign, kind, axis };
  }

  // ---- target construction ------------------------------------------------
  // Sum the signed terms in z-scored centroid space -> a z-vector over the shared
  // dims, then convert back to raw features (raw = z*sd + mean) for target-blend.
  function buildTarget(terms, opts) {
    opts = opts || {};
    const axisSd = opts.axisSd == null ? DEFAULT_AXIS_SD : opts.axisSd;
    const zs = G.zstats();
    const dims = Object.keys(zs);
    const cents = G.centroids();
    const z = new Array(dims.length).fill(0);
    const genresNamed = [];

    for (const t of terms) {
      if (t.kind === "genre") {
        const c = cents[t.name];
        if (!c) throw new Error("no centroid for genre (not in feature cache?): " + t.name);
        for (let i = 0; i < dims.length; i++) z[i] += t.sign * t.coef * c[i];
        if (genresNamed.indexOf(t.name) < 0) genresNamed.push(t.name);
      } else {
        const idx = dims.indexOf(t.axis);
        z[idx] += t.sign * t.coef * axisSd; // one z-sd per unit coefficient
      }
    }

    const rawFeatures = {};
    const zTarget = {};
    for (let i = 0; i < dims.length; i++) {
      const d = dims[i];
      rawFeatures[d] = z[i] * zs[d].sd + zs[d].mean;
      zTarget[d] = +z[i].toFixed(4);
    }
    return { dims, z, zTarget, rawFeatures, genresNamed };
  }

  // ---- evaluate ------------------------------------------------------------
  function evaluate(expr, opts) {
    opts = opts || {};
    const seed = opts.seed == null ? 1 : opts.seed;
    const k = opts.k == null ? 12 : opts.k;
    const terms = parse(expr);
    const target = buildTarget(terms, opts);

    // hand the raw-feature target to the nearest-reachable blend solver.
    const blend = TB.solve({ features: target.rawFeatures }, { seed, k });

    const residual = blend.residual;
    const reachable = residual <= HULL_TOL;

    return {
      expression: expr,
      seed,
      terms: terms.map((t) => ({
        name: t.name, coef: t.coef, sign: t.sign > 0 ? "+" : "-", kind: t.kind,
        axis: t.axis || undefined,
      })),
      genresNamed: target.genresNamed,
      zTarget: target.zTarget,
      weights: blend.weights,
      best: blend.best,
      topScores: blend.topScores,
      residual: residual,
      reachable: reachable,
      hullTol: HULL_TOL,
      label: reachable
        ? "reachable (nearest point within the blend hull)"
        : "OUT-OF-HULL — large residual; this target needs new vocabulary, not a blend",
      note: "nearest-reachable point + residual; the residual is the un-closed z-space "
        + "distance to the requested arithmetic target, NOT a claim it was hit. "
        + "Weights are >=0 and sum to 1 (no negatives, no extrapolation).",
    };
  }

  const api = { evaluate, parse, parseTerm, buildTarget, axisNames, ALIASES, HULL_TOL };
  if (isNode) module.exports = api; else root.GenreMath = api;

  // ---- CLI ----------------------------------------------------------------
  if (isNode && require.main === module) {
    const argv = process.argv.slice(2);
    const opt = { seed: 1, k: 12 };
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--seed") opt.seed = parseInt(argv[++i], 10);
      else if (argv[i] === "--k") opt.k = parseInt(argv[++i], 10);
      else if (argv[i] === "--axis-sd") opt.axisSd = parseFloat(argv[++i]);
      else if (argv[i] === "--list-axes") {
        console.log("feature axes: " + axisNames().join(", "));
        console.log("aliases: " + Object.entries(ALIASES).map(([a, b]) => a + "->" + b).join(", "));
        process.exit(0);
      } else positional.push(argv[i]);
    }
    const expr = positional.join(" ").trim();
    if (!expr) {
      console.log("usage:");
      console.log('  genre-math.js "jazz - swing + fouronfloor" [--seed N] [--k 12] [--axis-sd 1]');
      console.log("  genre-math.js --list-axes");
      process.exit(0);
    }
    try {
      console.log(JSON.stringify(evaluate(expr, opt), null, 2));
    } catch (e) {
      console.error("error: " + e.message);
      process.exit(1);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
