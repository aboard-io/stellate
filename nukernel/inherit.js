#!/usr/bin/env node
// inherit.js — GENRE INHERITANCE AS A COMPILE-TIME EXPANSION.
//
//   node nukernel/inherit.js beatles          # the three-way ledger for one child
//   node nukernel/inherit.js --all            # every child, one summary row each
//   node nukernel/inherit.js --check          # round-trip EVERY child, byte-exact
//   node nukernel/inherit.js --source beatles # the proposed `parents + delta` entry
//   node nukernel/inherit.js beatles --rule=dominance   # the naive pluck rule
//
// genealogy.js asks how much of a child its declared parents EXPLAIN, in a
// 27-feature numeric projection. This asks the harder, structural question one
// tier down: field by field, WHICH PARENT DID EACH THING COME FROM — and can
// the anchor be reconstructed, byte for byte, from `parents + delta`?
//
// Paul's three words are the output vocabulary:
//   COMBINED  numeric fields genuinely averaged across the parents by weight
//   PLUCKED   a NOUN taken wholesale from ONE parent (kit, mode, progression,
//             bass idiom, the word closures) — the house law is "numbers blend,
//             nouns don't", so these are copied, never interpolated
//   NEW       the delta: what this genre invented, which genealogy.js's fit
//             calls the residue
//
// WHAT THIS BORROWS FROM THE PARENT PROJECT (the check-the-parent-first law).
// engine/genre-kernel.js `resolveMulti` already decided, over 274 anchors,
// which fields interpolate and which are picked, and it is cited here field for
// field:
//   * numeric / [lo,hi] range fields LERP by weight — `wRange` (l.766) and the
//     numeric branch of `blendRecipe` (l.810-814), which also renormalizes over
//     the parents that DECLARE the key ("parents missing a key sit out",
//     l.797). Both laws are reproduced below.
//   * string pools and enums are PICKED from one parent, never averaged.
//   * structural dimensions are picked from the DOMINANT parent by weight with
//     ZERO rng: the "dominant-parent PURE-COPY dims" block (l.1127-1154,
//     reverbColor / transforms / sampleEvents / introMode) and the meter law
//     (l.1198-1215), whose comment is the whole argument in one line: "METERS
//     DON'T LERP: a bar holds an integer number of beats, and there is no music
//     halfway between 3/4 and 4/4 — a weighted average would land on no meter
//     at all."
//   * fields that must COHERE are drawn ONCE PER GROUP, not per field
//     (l.819-824: "Calling side() per field could check canawave's .vox then
//     read ambient's"). That law is why the pluck rules below are grouped: a
//     kit from motown with a fill from blues is the same bug.
// What is NOT borrowed: the rng. `side()` is a seeded weighted draw, right for
// a live blend at a point between stars and wrong for a source expansion, where
// the answer must be the same every time anyone runs it and must read as a
// diff. Every rule here is deterministic and weight-ordered.
//
// COMPILE-TIME, NOT RUNTIME. The expansion produces the same flat literals we
// commit today. Anchors stay ground truth; determinism, the fixtures and every
// gate are untouched; and a parent edit shows up as a REVIEWABLE DIFF in its
// children rather than as action at a distance. genres.js already does exactly
// this for four fields — `family` is stamped from the FAMILIES table and
// `stress`/`phrase`/`touch` from DYNAMICS/DYN_FAMILY, both at load, both with
// the comment "WRITTEN AS A TABLE AND STAMPED". This is that idea with a
// weighted-parent table instead of a flat one.
//
// HAND-RUN, and now also READ BY THE APP: lab.js is the LAB tab's bench and
// this file is its oracle, so the same bytes load in node (CommonJS) and in the
// browser (a <script type="module">, for the per-file scope a classic script
// would not give three analysis files at once — lab.js's own TIER note has the
// whole argument). The prologue is the only thing that knows which: node gets a
// require, the browser gets the globals genres.js already published.
"use strict";
const NODE = typeof require === "function" && typeof module !== "undefined";
const G = NODE ? require(require("path").join(__dirname, "genres.js"))
               : window.NuGenres;
const { GENRES, MODES, SCALES, PROGS } = G;

const FUNCTION_ANCHORS = new Set(["simple", "solo", "vocal", "backing", "riff", "pad"]);
const REAL = Object.keys(GENRES).filter(k => !FUNCTION_ANCHORS.has(k));
const CHILDREN = REAL.filter(k => Object.keys(GENRES[k].parents || {}).length);

// ---- THE FIELD LAW ---------------------------------------------------------
// Every field an anchor may carry has exactly one disposition. A field seen in
// the table and missing from here is an ERROR, not a default — the same "NO
// SILENT DEFAULT" rule genres.js applies to its own dynamics stamp.
//
//   IDENTITY   the genre's own name and its lineage declaration. Never
//              inherited, never predicted; excluded from the denominator.
//   DERIVED    already stamped at load from a table keyed on `family`. An
//              expander would stamp them after expansion exactly as today, so
//              they are not the inheritance's business either.
//   COMBINE    free scalars — weighted mean over the parents that declare it,
//              renormalized (blendRecipe l.797/810).
//   COMBINE_Q  scalars that are STRUCTURALLY INTEGER. Combined, then snapped.
//              This is the meter law's shape: `bars` is a form length and
//              `voices` is a headcount; there is no music with 2.4 voices.
//   COMBINE_LEAVES  an object whose NUMERIC leaves combine and whose STRING
//              leaves pluck (blendRecipe is per-key, and `tone` is exactly a
//              recipe: six numbers and a waveform noun).
//   PLUCK      a noun, copied whole from ONE parent. Grouped: every field in a
//              group comes from the SAME parent (the side()-per-group law).
const IDENTITY = ["label", "parents", "wants", "near"];
const DERIVED = ["family", "stress", "phrase", "touch"];
const COMBINE = ["rate", "swing", "maxHold", "incClamp", "humanize", "anchor"];
const COMBINE_Q = ["bars", "voices"];
const COMBINE_LEAVES = ["tone"];

// The pluck GROUPS. Names are the things a musician would name.
const GROUPS = {
  // the drummer: the kit and everything that plays it. A kit without its own
  // fill is the bug the group law exists to prevent.
  drums: ["drumkit", "kit", "kits", "fill", "kitVel", "kitProb", "ghost"],
  // the harmony: mode, alphabet, roots and the progression that voices them.
  // genres.js gates prog against roots bar for bar — they cannot come from
  // different parents and still pass.
  harm: ["harmony", "roots", "prog", "progFamily", "mode", "scale", "diatonic"],
  // the bass idiom: a walk and a fifths figure do not average into a walk in
  // fifths.
  bass: ["bassStyle", "bassGrid", "nobass"],
  // the timbre: which instruments play, and what is done to them. `tone.wave`
  // joins this group (see COMBINE_LEAVES) so the waveform follows the players.
  timbre: ["instr", "fx", "synth"],
  // the arrangement: who enters when, in what register, playing which
  // operators. These are CLOSURES; they are the least averageable thing in the
  // table and the most obviously plucked.
  arr: ["entry", "reg", "realize", "word", "words", "part", "period", "intro",
        "incMode", "artic", "pipes"],
};
const GROUP_OF = {};
for (const [g, fs] of Object.entries(GROUPS)) for (const f of fs) GROUP_OF[f] = g;
// tone.wave is plucked, and it belongs to the timbre group
const LEAF_GROUP = { "tone.wave": "timbre" };

const DISPOSITION = {};
for (const f of IDENTITY) DISPOSITION[f] = "identity";
for (const f of DERIVED) DISPOSITION[f] = "derived";
for (const f of COMBINE) DISPOSITION[f] = "combine";
for (const f of COMBINE_Q) DISPOSITION[f] = "combineq";
for (const f of COMBINE_LEAVES) DISPOSITION[f] = "leaves";
for (const f of Object.keys(GROUP_OF)) DISPOSITION[f] = "pluck";

function allFields() {
  const s = new Set();
  for (const k of REAL) for (const f of Object.keys(GENRES[k])) s.add(f);
  return [...s];
}
function unknownFields() { return allFields().filter(f => !DISPOSITION[f]); }

// ---- canonical serialization ----------------------------------------------
// The comparison currency. A function serializes to its own SOURCE TEXT (V8
// hands back the exact slice), which is what makes `entry: () => 0` on beatles
// byte-identical to `entry: () => 0` on jodeci — a closure really can be
// plucked. Objects sort their keys so a reconstructed object and a hand-written
// one compare on VALUE, not on the order the author happened to type.
function canon(v) {
  if (typeof v === "function") return v.toString();
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object")
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  if (typeof v === "number") return Object.is(v, -0) ? "-0" : String(v);
  return JSON.stringify(v);
}
const same = (a, b) => canon(a) === canon(b);

// ---- the numeric half: COMBINE --------------------------------------------
// blendRecipe's law verbatim: parents missing the key sit out, and the weights
// renormalize over the ones that have it. Rounded to 4 like the kernel's
// round(x,4), then snapped to an integer when it lands within 1e-9 of one.
function round4(x) {
  const r = Math.round(x * 1e4) / 1e4;
  return Math.abs(r - Math.round(r)) < 1e-9 ? Math.round(r) : r;
}
// UNANIMITY PASSES THROUGH UNROUNDED. Rounding to 4 is right for a genuine
// average and WRONG when every declaring parent says the same number: the mean
// of one value is that value, and rounding it is an artifact of the arithmetic
// rather than a decision about the music. The tool found this on itself —
// gospel's `swing: 1/3` (0.3333333333333333, a real triplet, inherited from its
// one parent blues) came back as 0.3333 and fell to the delta as an invention.
// It is the same shape as the kernel's RECIPE_PASSTHROUGH (l.791/805): when a
// value is being carried rather than computed, carry the literal.
function combineNum(parents, field) {
  let acc = 0, tw = 0; const vals = [];
  for (const [p, w] of Object.entries(parents)) {
    const v = GENRES[p] ? GENRES[p][field] : undefined;
    if (typeof v !== "number") continue;
    acc += v * w; tw += w; vals.push(v);
  }
  if (!tw) return { has: false };
  const raw = acc / tw;
  const unanimous = vals.every(v => v === vals[0]);
  return { has: true, raw, value: unanimous ? vals[0] : round4(raw),
           declaring: tw, unanimous };
}

// ---- the noun half: PLUCK --------------------------------------------------
// TWO RULES, and the difference between them is the finding.
//
//   "dominance"  — the naive expander, and the parent project's own law: the
//                  highest-weight parent that declares ANY field of the group
//                  supplies the WHOLE group. Zero information required from the
//                  child. This is what genre-kernel does at l.1148.
//   "attributed" — the ORACLE, and the default here. For each group, pick the
//                  parent whose values byte-match the most of the child's group
//                  fields; ties break by declared weight, then by parent order.
//                  It answers the question dominance cannot: was this noun taken
//                  from a parent AT ALL, or is it new? Its output IS the `from:`
//                  map the child would declare in source — you do not guess the
//                  per-field parent selection, you measure it and write it down.
//
// A child may override either rule per group OR per field via `from`.
const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const hasPath = (o, p) => {
  const ks = p.split("."); let x = o;
  for (let i = 0; i < ks.length; i++) {
    if (!x || !Object.prototype.hasOwnProperty.call(x, ks[i])) return false;
    x = x[ks[i]];
  }
  return true;
};
function pluckSource(child, group, rule, from) {
  const g = GENRES[child], parents = g.parents || {};
  const ordered = Object.keys(parents).sort((a, b) => parents[b] - parents[a]);
  if (from && from[group]) return { parent: from[group], why: "declared" };
  // score the group on ALL its fields, LEAVES INCLUDED. Without this the timbre
  // group is scored on `instr`/`fx`/`synth` alone — which nobody ever inherits —
  // so it falls to the dominant parent by default and drags `tone.wave` with it.
  // Measured on the pilot: beatles' timbre attributed to blues and its triangle
  // came back as an invention, with motown and countrypop both holding a
  // triangle in plain sight.
  const fields = GROUPS[group].filter(f => Object.prototype.hasOwnProperty.call(g, f))
    .concat(Object.keys(LEAF_GROUP).filter(p => LEAF_GROUP[p] === group && hasPath(g, p)));
  if (rule === "dominance") {
    const p = ordered.find(p2 => GENRES[p2] &&
      GROUPS[group].some(f => Object.prototype.hasOwnProperty.call(GENRES[p2], f)));
    return { parent: p || null, why: "dominance" };
  }
  let best = null, bestN = -1;
  for (const p of ordered) {
    if (!GENRES[p]) continue;
    let n = 0;
    for (const f of fields)
      if (hasPath(GENRES[p], f) && same(getPath(GENRES[p], f), getPath(g, f))) n++;
    if (n > bestN) { bestN = n; best = p; }
  }
  return { parent: best, why: "attributed", matched: bestN };
}

// ---- THE LEDGER ------------------------------------------------------------
// Per child: every field sorted into combined / plucked / new, with the parent
// named for each pluck, plus the two percentages — by field count and by the
// share of the anchor's canonical BYTES that inheritance produced (a kit is
// worth more of a genre than a `rate`, and the byte number says so).
function ledger(child, opts) {
  opts = opts || {};
  const rule = opts.rule || "attributed";
  const from = opts.from || {};
  const g = GENRES[child];
  const parents = g.parents || {};
  const out = { key: child, label: g.label, parents, rule,
                combined: [], plucked: [], neu: [], identity: [], derived: [],
                sources: {}, unknown: [] };
  if (!Object.keys(parents).length) { out.root = true; return out; }

  // which parent supplies each group
  for (const grp of Object.keys(GROUPS))
    out.sources[grp] = pluckSource(child, grp, rule, from);

  for (const f of Object.keys(g)) {
    const d = DISPOSITION[f];
    const actual = g[f];
    if (!d) { out.unknown.push(f); continue; }
    if (d === "identity") { out.identity.push({ field: f, value: actual }); continue; }
    if (d === "derived") { out.derived.push({ field: f, value: actual }); continue; }

    if (d === "combine" || d === "combineq") {
      const c = combineNum(parents, f);
      const pred = !c.has ? undefined : d === "combineq" ? Math.round(c.value) : c.value;
      if (c.has && same(pred, actual))
        out.combined.push({ field: f, value: actual, raw: c.raw, quantized: d === "combineq" });
      else
        out.neu.push({ field: f, value: actual, predicted: c.has ? pred : null,
                       kind: c.has ? "overrides-the-average" : "no-parent-declares-it",
                       raw: c.has ? c.raw : null });
      continue;
    }

    // `tone` is a RECIPE, and blendRecipe is per-key: each numeric leaf combines
    // on its own and the waveform noun plucks with the timbre group. Reported
    // leaf by leaf (`tone.cut`, `tone.wave`) so a genre that inherited its
    // reverb and invented its filter says so, instead of the whole object
    // falling to the delta on one miss.
    if (d === "leaves") {
      for (const [lk, lv] of Object.entries(actual)) {
        const name = f + "." + lk;
        if (typeof lv === "number") {
          const c = combineLeaf(parents, f, lk);
          if (c.has && same(c.value, lv))
            out.combined.push({ field: name, value: lv, raw: c.raw, leaf: [f, lk] });
          else
            out.neu.push({ field: name, value: lv, leaf: [f, lk],
                           predicted: c.has ? c.value : null, raw: c.has ? c.raw : null,
                           kind: c.has ? "overrides-the-average" : "no-parent-declares-it" });
        } else {
          const grp2 = LEAF_GROUP[name] || "timbre";
          const src2 = from[name] || (out.sources[grp2] && out.sources[grp2].parent);
          const sub = src2 && GENRES[src2] && GENRES[src2][f];
          if (sub && same(sub[lk], lv))
            out.plucked.push({ field: name, group: grp2, from: src2, value: lv, leaf: [f, lk] });
          else {
            const elsewhere = Object.keys(parents).filter(p =>
              GENRES[p] && GENRES[p][f] && same(GENRES[p][f][lk], lv));
            out.neu.push({ field: name, value: lv, group: grp2, leaf: [f, lk], elsewhere,
                           kind: elsewhere.length ? "held by " + elsewhere.join("/") +
                                   " but the " + grp2 + " group came from " + src2
                                 : "no parent has it" });
          }
        }
      }
      continue;
    }

    // PLUCK
    const grp = GROUP_OF[f];
    const decl = from[f] || (out.sources[grp] && out.sources[grp].parent);
    const src = from[f] ? from[f] : decl;
    const pv = src && GENRES[src] ? GENRES[src][f] : undefined;
    if (src && Object.prototype.hasOwnProperty.call(GENRES[src] || {}, f) && same(pv, actual))
      out.plucked.push({ field: f, group: grp, from: src, value: actual });
    else {
      // did ANY parent have it? (names the near-miss so the ledger is honest
      // about a group rule costing a field it could have had)
      const elsewhere = Object.keys(parents).filter(p =>
        GENRES[p] && Object.prototype.hasOwnProperty.call(GENRES[p], f) && same(GENRES[p][f], actual));
      out.neu.push({ field: f, group: grp, value: actual,
                     kind: elsewhere.length ? "held by " + elsewhere.join("/") +
                            " but the group came from " + src : "no parent has it",
                     elsewhere });
    }
  }

  const weigh = xs => xs.reduce((s, x) => s + canon(x.value).length, 0);
  const nOK = out.combined.length + out.plucked.length;
  const nAll = nOK + out.neu.length;
  const bOK = weigh(out.combined) + weigh(out.plucked);
  const bAll = bOK + weigh(out.neu);
  out.pctFields = nAll ? nOK / nAll : 0;
  out.pctBytes = bAll ? bOK / bAll : 0;
  out.nFields = nAll; out.nInherited = nOK; out.nNew = out.neu.length;
  return out;
}
// combineNum reads GENRES[p][field]; for a leaf we need GENRES[p][obj][leaf].
// Same two-line law (sit out, renormalize), one level down.
function combineLeaf(parents, obj, leaf) {
  let acc = 0, tw = 0; const vals = [];
  for (const [p, w] of Object.entries(parents)) {
    const sub = GENRES[p] && GENRES[p][obj];
    if (!sub || typeof sub[leaf] !== "number") continue;
    acc += sub[leaf] * w; tw += w; vals.push(sub[leaf]);
  }
  if (!tw) return { has: false };
  const unanimous = vals.every(v => v === vals[0]);
  return { has: true, raw: acc / tw, value: unanimous ? vals[0] : round4(acc / tw), unanimous };
}

// ---- EXPAND + the round-trip ----------------------------------------------
// expand() rebuilds the anchor from `parents + from + delta` alone. The delta
// it is handed is the ledger's `new` list, so the round-trip is LOSSLESS BY
// CONSTRUCTION — and that is the point, not a cheat: what the round-trip proves
// is that the expander is faithful (nothing is lost, reordered or re-rounded on
// the way through), which is the precondition for converting the catalog. What
// it does NOT prove is that the inheritance EXPLAINS anything; the honest
// number for that is pctFields / pctBytes, and it is reported separately.
function deltaOf(led) {
  const d = {};
  const put = n => {
    if (n.leaf) { (d[n.leaf[0]] = d[n.leaf[0]] || {})[n.leaf[1]] = n.value; }
    else d[n.field] = n.value;
  };
  for (const n of led.neu) put(n);
  for (const n of led.identity) put(n);
  return d;
}
function expand(child, opts) {
  opts = opts || {};
  const rule = opts.rule || "attributed";
  const g = GENRES[child];
  const parents = opts.parents || g.parents || {};
  const from = opts.from || {};
  const led = opts.ledger || ledger(child, { rule, from });
  const delta = opts.delta || deltaOf(led);
  const out = {};
  const sources = led.sources;
  // FIELD ORDER: the anchor's own, so the expansion is diffable against the
  // committed literal rather than merely equal to it.
  for (const f of Object.keys(g)) {
    const d = DISPOSITION[f];
    // a `leaves` field takes a PARTIAL delta: the combined/plucked leaves are
    // rebuilt and only the invented ones are overlaid, in the anchor's own leaf
    // order (so `tone` diffs against the committed literal key for key)
    if (d === "leaves") {
      const dl = delta[f] || {};
      const o = {};
      for (const [lk, lv] of Object.entries(g[f])) {
        if (Object.prototype.hasOwnProperty.call(dl, lk)) { o[lk] = dl[lk]; continue; }
        if (typeof lv === "number") { o[lk] = combineLeaf(parents, f, lk).value; continue; }
        const grp2 = LEAF_GROUP[f + "." + lk] || "timbre";
        const src2 = from[f + "." + lk] || sources[grp2].parent;
        o[lk] = GENRES[src2][f][lk];
      }
      out[f] = o; continue;
    }
    if (Object.prototype.hasOwnProperty.call(delta, f)) { out[f] = delta[f]; continue; }
    if (d === "derived") { out[f] = g[f]; continue; }        // stamped after, as today
    if (d === "combine") { out[f] = combineNum(parents, f).value; continue; }
    if (d === "combineq") { out[f] = Math.round(combineNum(parents, f).value); continue; }
    const grp = GROUP_OF[f];
    const src = from[f] || sources[grp].parent;
    out[f] = GENRES[src][f];
  }
  return out;
}
// byte-exact, field by field, against the committed anchor
function roundTrip(child, opts) {
  const g = GENRES[child];
  const got = expand(child, opts);
  const bad = [];
  const ka = Object.keys(g), kb = Object.keys(got);
  if (ka.join(",") !== kb.join(",")) bad.push("!field-order");
  for (const f of ka) if (canon(g[f]) !== canon(got[f])) bad.push(f);
  return { ok: !bad.length, bad, expanded: got };
}

// ---- source emission -------------------------------------------------------
// What the file entry would look like as `parents + delta`. MODES/SCALES/PROGS
// are re-aliased by identity where genres.js exports them, so the emitted text
// reads like the hand-written table rather than like a dump.
const ALIAS = new Map();
for (const [ns, obj] of [["MODES", MODES], ["SCALES", SCALES], ["PROGS", PROGS]])
  for (const k of Object.keys(obj)) ALIAS.set(obj[k], ns + "." + k);
function emit(v, ind) {
  ind = ind || "      ";
  if (ALIAS.has(v)) return ALIAS.get(v);
  if (typeof v === "function") return v.toString();
  if (Array.isArray(v)) {
    const parts = v.map(x => emit(x, ind + "  "));
    const oneline = "[" + parts.join(", ") + "]";
    return oneline.length <= 78 ? oneline : "[\n" + ind + "  " + parts.join(",\n" + ind + "  ") + "\n" + ind + "]";
  }
  if (v && typeof v === "object") {
    const parts = Object.keys(v).map(k => k + ": " + emit(v[k], ind + "  "));
    const oneline = "{ " + parts.join(", ") + " }";
    return oneline.length <= 78 ? oneline : "{\n" + ind + "  " + parts.join(",\n" + ind + "  ") + "\n" + ind + "}";
  }
  return JSON.stringify(v);
}
function sourceForm(child, opts) {
  const led = ledger(child, opts);
  const g = GENRES[child];
  const L = [];
  L.push("    " + child + ": inherit({");
  L.push("      // COMBINED — the weighted average of the parents, verbatim");
  L.push("      parents: { " + Object.entries(g.parents)
    .map(([p, w]) => p + ": " + w).join(", ") + " },");
  L.push("      // PLUCKED — which parent each group of nouns comes from whole");
  const froms = Object.entries(led.sources)
    .filter(([grp]) => GROUPS[grp].some(f => Object.prototype.hasOwnProperty.call(g, f)))
    .map(([grp, s]) => grp + ": " + JSON.stringify(s.parent));
  L.push("      from: { " + froms.join(", ") + " },");
  L.push("    }, {");
  L.push("      // NEW — what this genre invented (" + led.neu.length + " of " +
         led.nFields + " inheritable fields)");
  const delta = deltaOf(led);
  const why = {};
  for (const n of led.neu) if (!n.leaf && n.kind) why[n.field] = n.kind;
  // NOT EMITTABLE AS TEXT: a value built by CALLING an operator factory
  // (`period: [[], [], [], [drop(3)]]`) prints as the closure the factory
  // returned, complete with its captured free variables. The expander compares
  // by reference and round-trips it exactly; the SOURCE stays the hand-written
  // call. That costs nothing — the delta is hand-written by definition, and
  // only the inherited half is generated.
  for (const f of Object.keys(g)) {
    if (f === "parents") continue;              // already declared in the head
    if (!Object.prototype.hasOwnProperty.call(delta, f)) continue;
    L.push("      " + f + ": " + emit(delta[f]) + "," +
           (why[f] ? "   // " + why[f] : DISPOSITION[f] === "leaves" ? "   // only the invented leaves" : ""));
  }
  L.push("    }),");
  return L.join("\n");
}

// ---- reports ---------------------------------------------------------------
const pct = x => (x * 100).toFixed(1) + "%";
function printLedger(child, opts) {
  const led = ledger(child, opts);
  const L = [];
  if (led.root) { L.push(child + " — " + led.label + ": a ROOT (no parents)."); return L.join("\n"); }
  L.push("=".repeat(72));
  L.push(child.toUpperCase() + " — " + led.label + "   [pluck rule: " + led.rule + "]");
  L.push("parents: " + Object.entries(led.parents).map(([p, w]) => p + " " + w).join(", "));
  L.push("=".repeat(72));
  L.push("");
  L.push("COMBINED — numbers genuinely averaged across the parents (" + led.combined.length + ")");
  for (const c of led.combined)
    L.push("  " + c.field.padEnd(12) + " = " + trunc(emit(c.value)) +
      (c.raw != null && c.raw !== c.value ? "   (raw " + c.raw.toFixed(4) + (c.quantized ? ", snapped" : ", rounded") + ")" : "") +
      (c.leaves ? "   (leaf by leaf)" : ""));
  L.push("");
  L.push("PLUCKED — nouns taken wholesale from ONE parent (" + led.plucked.length + ")");
  const byGrp = {};
  for (const p of led.plucked) (byGrp[p.group] = byGrp[p.group] || []).push(p);
  for (const [grp, ps] of Object.entries(byGrp)) {
    L.push("  [" + grp + " <- " + ps[0].from + "]");
    for (const p of ps) L.push("    " + p.field.padEnd(10) + " = " + trunc(emit(p.value)));
  }
  L.push("");
  L.push("NEW TO THE ERA — the delta, what this genre invented (" + led.neu.length + ")");
  for (const n of led.neu)
    L.push("  " + n.field.padEnd(12) + " = " + trunc(emit(n.value)) + "\n" +
           "  " + " ".repeat(12) + "   ^ " + (n.kind || "") +
           (n.predicted != null ? "; parents predicted " + trunc(emit(n.predicted), 40) : ""));
  L.push("");
  if (led.identity.length)
    L.push("IDENTITY (never inherited): " + led.identity.map(i => i.field).join(", "));
  if (led.derived.length)
    L.push("DERIVED at load from `family` (stamped after expansion, as today): " +
           led.derived.map(i => i.field).join(", "));
  L.push("");
  L.push("EXPLAINED BY INHERITANCE: " + pct(led.pctFields) + " of fields (" +
         led.nInherited + "/" + led.nFields + "), " + pct(led.pctBytes) + " by canonical bytes.");
  const rt = roundTrip(child, opts);
  L.push("ROUND-TRIP expand(parents, from, delta): " +
         (rt.ok ? "BYTE-EXACT against the committed anchor." : "FAILED on " + rt.bad.join(", ")));
  return L.join("\n");
}
function trunc(s, n) { n = n || 56; s = String(s).replace(/\s+/g, " "); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function summary(opts) {
  const rows = CHILDREN.map(k => ledger(k, opts)).sort((a, b) => b.pctFields - a.pctFields);
  const L = [];
  L.push("| child | fields explained | by bytes | new | round-trip |");
  L.push("|---|---|---|---|---|");
  for (const r of rows) {
    const rt = roundTrip(r.key, opts);
    L.push("| " + r.key + " | " + pct(r.pctFields) + " (" + r.nInherited + "/" + r.nFields +
           ") | " + pct(r.pctBytes) + " | " + r.neu.map(n => n.field).join(" ") +
           " | " + (rt.ok ? "exact" : "FAIL " + rt.bad.join(",")) + " |");
  }
  const mean = rows.reduce((s, r) => s + r.pctFields, 0) / rows.length;
  const meanB = rows.reduce((s, r) => s + r.pctBytes, 0) / rows.length;
  L.push("");
  L.push("mean explained: " + pct(mean) + " of fields, " + pct(meanB) + " of bytes, over " +
         rows.length + " children.");
  return L.join("\n");
}

// ---- the near-miss report --------------------------------------------------
// The expander emits LITERALS, so a combined field counts only on an exact
// match — and every numeric near-miss lands in the delta. That is correct and
// it is also the most misleading number in the ledger, because "cut 2600 where
// the parents average 2240" is a 16% difference nobody would hear as a
// different genre, while "bars 8 where the parents average 6" is a different
// song. This measures the gap: per numeric field, how far the anchor sits from
// its parents' average, so the recommendation can distinguish a genre that
// genuinely refused its inheritance from one that was simply typed by hand.
function nearMiss(tol) {
  tol = tol == null ? 0.15 : tol;
  const rows = {};
  for (const k of CHILDREN) {
    for (const n of ledger(k).neu) {
      if (typeof n.value !== "number" || n.predicted == null) continue;
      const denom = Math.abs(n.value) || 1;
      const err = Math.abs(n.value - (n.raw != null ? n.raw : n.predicted)) / denom;
      (rows[n.field] = rows[n.field] || []).push({ key: k, err });
    }
  }
  const out = Object.entries(rows).map(([f, xs]) => ({
    field: f, n: xs.length,
    within: xs.filter(x => x.err <= tol).length,
    median: xs.map(x => x.err).sort((a, b) => a - b)[Math.floor(xs.length / 2)],
    worst: xs.slice().sort((a, b) => b.err - a.err)[0],
  })).sort((a, b) => b.within / b.n - a.within / a.n || b.n - a.n);
  return { tol, rows: out };
}

const api = { GROUPS, DISPOSITION, IDENTITY, DERIVED, COMBINE, COMBINE_Q,
              COMBINE_LEAVES, REAL, CHILDREN, canon, same, combineNum, combineLeaf,
              pluckSource, ledger, deltaOf, expand, roundTrip, sourceForm, emit,
              printLedger, summary, unknownFields, nearMiss };

if (NODE && require.main === module) {
  const argv = process.argv.slice(2);
  const ruleArg = argv.find(a => a.startsWith("--rule="));
  const opts = { rule: ruleArg ? ruleArg.split("=")[1] : "attributed" };
  const keys = argv.filter(a => !a.startsWith("--"));
  const un = unknownFields();
  if (un.length) console.error("WARNING — fields with no disposition: " + un.join(", "));
  if (argv.includes("--check")) {
    let bad = 0;
    for (const k of CHILDREN) {
      const rt = roundTrip(k, opts);
      if (!rt.ok) { bad++; console.log("FAIL " + k + ": " + rt.bad.join(", ")); }
    }
    console.log(bad ? bad + " of " + CHILDREN.length + " children failed the round-trip."
                    : "round-trip BYTE-EXACT for all " + CHILDREN.length + " children (rule=" + opts.rule + ").");
    process.exit(bad ? 1 : 0);
  } else if (argv.includes("--source")) {
    for (const k of (keys.length ? keys : ["beatles"])) console.log(sourceForm(k, opts));
  } else if (argv.includes("--lint")) {
    // THE IDLE-PARENT LINT — the most useful thing this file does. A declared
    // parent that supplies not one noun is a lineage CLAIM the anchor data does
    // not back: the child may still be its descendant in the record-shop sense,
    // but nothing you can point at came across. Either the claim is loose, or
    // the child is quietly holding a noun it should have inherited.
    const idle = [];
    for (const k of CHILDREN) {
      const l = ledger(k, opts);
      const used = new Set(l.plucked.map(p => p.from));
      for (const p of Object.keys(l.parents))
        if (!used.has(p)) idle.push({ child: k, parent: p, w: l.parents[p] });
    }
    idle.sort((a, b) => b.w - a.w);
    console.log("declared parents that supply the child NO NOUN (" + idle.length + "):");
    for (const i of idle)
      console.log("  " + i.child.padEnd(14) + " declares " + i.parent.padEnd(14) +
                  " at " + i.w + "  — nothing structural crosses over");
    const missed = [];
    for (const k of CHILDREN) for (const n of ledger(k, opts).neu)
      if (n.elsewhere && n.elsewhere.length)
        missed.push("  " + (k + "." + n.field).padEnd(24) + " is held by " +
                    n.elsewhere.join("/") + ", but the group rule took another parent");
    console.log("\nfields a parent HAD and the group law refused (" + missed.length + "):");
    console.log(missed.join("\n"));
  } else if (argv.some(a => a.startsWith("--near"))) {
    const t = argv.find(a => a.startsWith("--near="));
    const nm = nearMiss(t ? Number(t.split("=")[1]) : 0.15);
    console.log("numeric fields that fell to the delta, by how NEAR the parents' " +
                "average came (tolerance " + pct(nm.tol) + "):");
    console.log("| field | in delta | within tol | median error | worst |");
    console.log("|---|---|---|---|---|");
    for (const r of nm.rows)
      console.log("| " + r.field + " | " + r.n + " | " + r.within + " | " +
        pct(r.median) + " | " + r.worst.key + " " + pct(r.worst.err) + " |");
  } else if (argv.includes("--all")) {
    console.log(summary(opts));
  } else {
    for (const k of (keys.length ? keys : ["beatles"])) console.log(printLedger(k, opts) + "\n");
  }
} else if (NODE) module.exports = api;
else window.NuInherit = api;               // the browser tier: ui/deps.js loadLab()
