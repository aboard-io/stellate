#!/usr/bin/env node
// lab.js — THE GENRE LAB'S BENCH: parents in, architecture out, the material
// left for a person.
//
//   node nukernel/lab.js house techno              # the whole bench for one candidate
//   node nukernel/lab.js motown:.6 kraftwerk:.4 --seed 12
//   node nukernel/lab.js jazz doowop --manifest    # just the field ledger
//   node nukernel/lab.js house techno --raw        # synthesis only, nothing rolled
//   node nukernel/lab.js --self-test               # the pure-node proof
//
// WHY THIS FILE REFUSES TO WRITE THE MUSIC.
//
// nukernel/INHERITANCE.md measured what actually crosses from parents to child
// over the whole catalog, field by field, and the answer split an anchor
// cleanly in two:
//
//   INHERITED — the ARCHITECTURE.  harmony 87% · realize 84% · diatonic 83% ·
//               part 78% · rate 76% · tone.wave 74% · voices 66% · drumkit 61%
//   INVENTED  — the MATERIAL.      kit 16% · word 8% · roots 7% · fill 3% ·
//               instr 3% · words / prog / bassGrid / kitVel / period / pipes 0%
//
// A machine that offers to write a genre from its parents is therefore lying
// about exactly the half you would listen to. This one fills the architecture,
// which is the half the measurement says is real, and hands back an INVENTION
// LIST: the material fields, explicitly empty and named, for a person.
//
// `roll()` sits beside every one of them because a blank field is not an
// invitation, it is a wall. The dice draft something PLAUSIBLE FOR THIS
// ARCHITECTURE — a kit whose densities are the parents' own and whose metal
// lane fits the `drumkit`, a progression in the candidate's mode that obeys its
// `diatonic` law, instruments drawn from the families the parents actually
// play, a fill that is busier than bar 1 because the gate says so — and the ear
// does the rest. A roll is a starting point with a seed on it, never an answer.
//
// WHAT IT REUSES, AND WHERE THAT IS WRITTEN DOWN.
//   * nukernel/inherit.js — the field law (IDENTITY / DERIVED / COMBINE /
//     COMBINE_Q / COMBINE_LEAVES / the five PLUCK groups), `combineNum` /
//     `combineLeaf` (the parent project's blendRecipe law: parents missing a
//     key SIT OUT and the weights renormalize) and `pluckSource`, the ORACLE.
//     None of it is reimplemented here; where this file needed the oracle to
//     answer a question about a genre that does not exist yet, it hands the
//     oracle a candidate instead of a child (see `sourceFor`).
//   * nukernel/genealogy.js — `featuresOf`, the 27-feature projection. It is
//     the roll's TARGET (blended kick/backbeat/hat/perc densities, chord-change
//     rate, seventh-ness, bass motion, word load) and the novelty metric's
//     space. Two organs, one feature table, so a rolled kit is measured in the
//     same coordinates the lineage fit uses.
//   * engine/checks/near-duplicate.js — PRIOR ART for §3. Its first signal is
//     Euclidean distance between z-scored centroids, WARNing under a tuned
//     threshold; this file z-scores over the nukernel table and takes its
//     thresholds from the distribution of the real anchors' OWN nearest-
//     neighbour distances, so the bands re-derive as the roster grows and no
//     genre count is written down anywhere.
//   * tools/genre/gen-genre-info.js — PRIOR ART for the prose in `words`. Every
//     phrase comes from a TABLE keyed on the operator the closure actually
//     applies, never from a per-candidate string, so the line beside a voice
//     cannot promise a move the `word` closure does not make. Same dice build
//     both.
//
// TIER. This is an ANALYSIS-tier file, CommonJS like its two neighbours
// inherit.js and genealogy.js, and NOT the UMD the app tier uses — it requires
// both of them and neither publishes itself on `window`. Zero dependencies,
// pure node, require-able. Nothing in the app, the kernel or the gates reads
// it; it writes no file and mutates no anchor.
"use strict";
const path = require("path");
const K = require(path.join(__dirname, "kernel.js"));
const NG = require(path.join(__dirname, "genres.js"));
const I = require(path.join(__dirname, "inherit.js"));
const GEN = require(path.join(__dirname, "genealogy.js"));
const INSTR = require(path.join(__dirname, "instruments.js"));
const { BPM } = require(path.join(__dirname, "compose.js"));
const { GENRES, DEFAULT } = NG;

const REAL = I.REAL;                       // the place-year anchors; no count is stored
const canon = I.canon;

// ---------------------------------------------------------------------------
// §0. THE MATERIAL LAW
// ---------------------------------------------------------------------------
// Which fields the machine will not fill, and it is INHERITANCE.md's own table
// read as an instruction rather than as a finding. The test is not "is this
// field a noun" — `drumkit` and `harmony` are nouns and they cross over 61% and
// 87% of the time. The test is the one the measurement actually drew: a field
// that NAMES a behaviour is architecture (`drumkit: "tr909"`, `bassStyle:
// "walk"`, `harmony: "cycle"`, `realize`), and a field that SPELLS OUT the
// notes is material (`kit`'s twelve sixteen-step vectors, `roots`, `prog`,
// `instr`, `bassGrid`, `kitVel`, `word`). One says which instrument; the other
// says what it plays. The catalog inherits the first and invents the second,
// and so does this bench.
//
// The group each material field belongs to is inherit.js's, unchanged, because
// a material field that gets invented still has to cohere with the plucked
// nouns around it: a rolled kit must fit the plucked `drumkit`, a rolled prog
// must obey the plucked `mode` and `diatonic`.
const MATERIAL = {
  kit: "drums", kits: "drums", kitVel: "drums", kitProb: "drums",
  ghost: "drums", fill: "drums",
  roots: "harm", prog: "harm", progFamily: "harm",
  instr: "timbre", synth: "timbre",
  bassGrid: "bass",
  words: "arr", word: "arr", period: "arr", pipes: "arr",
};
// Of those, the ones the bench PUTS ON THE LIST — the fields a candidate is
// not a genre without. The rest (kits, kitProb, ghost, progFamily, synth,
// period, pipes) are colour: most anchors carry none of them, so an absent one
// is normal rather than missing, and the lab offers them only if asked. Which
// of these are required is a question about the ARCHITECTURE and is answered
// per candidate in `inventionList` — a genre with no drums needs no kit, a
// modal genre needs no roots.
const CORE_MATERIAL = ["kit", "fill", "kitVel", "roots", "prog", "instr",
                       "bassGrid", "words", "word"];

// The field order a candidate is built in — the anchors' own reading order, so
// a printed candidate diffs against genres.js rather than merely equalling it.
const ORDER = ["label", "rate", "bars", "voices", "swing", "bpm", "parents",
  "instr", "drumkit", "mode", "scale", "diatonic", "entry", "reg", "realize",
  "part", "harmony", "bassStyle", "bassGrid", "nobass", "roots", "prog",
  "maxHold", "incClamp", "incMode", "anchor", "artic", "intro", "humanize",
  "fx", "kit", "kitVel", "fill", "tone", "words", "word",
  "family", "stress", "phrase", "touch"];

// ---------------------------------------------------------------------------
// §1. SYNTHESIS
// ---------------------------------------------------------------------------

// THE ORACLE, ASKED ABOUT A GENRE THAT DOES NOT EXIST YET.
//
// inherit.js's `pluckSource` scores each parent by how many of THE CHILD's
// group fields it byte-matches — which needs a child. A candidate has no key in
// GENRES and, at synthesis, no material to match on. Rather than reimplement
// the rule (and drift from it), the candidate is seated in the table under a
// reserved key for the length of one synchronous call and removed in a
// `finally`. Node is single-threaded and nothing awaits inside, so no reader
// can observe the table holding it.
//
// What comes back is worth stating plainly: with no material to score, every
// parent ties at zero matches and the oracle falls through to its own
// tie-break — declared weight, then declaration order. That IS the dominance
// rule (genre-kernel.js l.1148, "dominant-parent PURE-COPY dims"), reached
// through the oracle rather than around it. Hand the same function a candidate
// whose material has already been rolled or written and it starts genuinely
// ATTRIBUTING, which is what makes a second pass worth running: once a person
// has invented something, "which parent did that actually come from?" has an
// answer again.
//
// SO THERE ARE THREE RULES HERE, one more than inherit.js has, and the extra
// one is the lab's default:
//
//   "draw"       — a SEEDED WEIGHTED DRAW per group, which is genre-kernel.js's
//                  own `side()` (l.763) and its once-per-group law (l.819-824).
//                  inherit.js explicitly refuses that rng, and is right to:
//                  a source expansion "must be the same every time anyone runs
//                  it and must read as a diff". A LAB CANDIDATE IS THE OTHER
//                  CASE — it is a live blend at a point between stars, where
//                  the kernel says "the crossover should be an event" — and it
//                  carries a seed, so the draw is still repeatable and
//                  shareable. Without it a 60/40 blend hands every noun to the
//                  60: measured over 459 pairs, dominance put 368 of them
//                  inside the "X wearing a hat" band, because the candidate WAS
//                  the dominant parent's architecture with new material on top.
//   "attributed" — inherit.js's ORACLE, verbatim. Meaningful on a re-pass, when
//                  `opts.child` carries material to attribute.
//   "dominance"  — inherit.js's naive rule, for contrast.
const STUB = "__lab_candidate__";
function withStub(stub, fn) {
  if (Object.prototype.hasOwnProperty.call(GENRES, STUB))
    throw new Error("lab: the bench is already occupied (re-entrant synthesize)");
  GENRES[STUB] = stub;
  try { return fn(STUB); } finally { delete GENRES[STUB]; }
}

// WHICH PARENTS ARE ELIGIBLE TO SUPPLY A GROUP. The catalog's group law says
// the whole group comes from one parent; it does not say that a parent with
// NOTHING to give may still win the draw. An empty `kit` is not a kit choice,
// it is the absence of drums, and letting the undrummed parent take the drums
// group would silence a child whose other parent is a drum machine — a bug in
// the lab, not a finding about the table. So a group is drawn from the parents
// that actually declare it, and only falls back to all of them when none does.
// (This is a LAB rule, on a blank page, and deliberately not fed back into
// inherit.js's measurement of the committed catalog.)
const DECLARES = {
  drums: p => Object.keys((GENRES[p] && GENRES[p].kit) || {}).length > 0,
  harm: p => !!(GENRES[p] && GENRES[p].harmony),
  bass: p => {
    const g = GENRES[p] || {};
    return !!(g.bassStyle || g.bassGrid || g.nobass);
  },
  timbre: p => !!(GENRES[p] && GENRES[p].tone),
  arr: p => !!(GENRES[p] && GENRES[p].realize),
};
function eligible(parents, group) {
  const ks = Object.keys(parents).filter(DECLARES[group]);
  if (!ks.length || ks.length === Object.keys(parents).length) return parents;
  const out = {};
  for (const k of ks) out[k] = parents[k];
  return out;
}

// THE DRAW — genre-kernel.js `side()`, seeded on the group so each group is its
// own event and on the parent map so two different blends never share a run of
// dice. Weight-ordered before the walk, which is what makes it deterministic
// across engines: Object.keys order is an implementation detail and a draw that
// depends on it is a draw that moves.
function drawSource(parents, group, seed) {
  const ks = Object.keys(parents).sort((a, b) => parents[b] - parents[a] || (a < b ? -1 : 1));
  const rnd = K.prng(hash("group:" + group, canon(parents), String(seed | 0)));
  let r = rnd() * ks.reduce((s, k) => s + parents[k], 0);
  for (const k of ks) { r -= parents[k]; if (r <= 0) return k; }
  return ks[ks.length - 1];
}

// blendRecipe's law over a table the ANCHOR DOES NOT CARRY. compose.js keeps
// tempo in its own BPM map rather than on the genre, so `combineNum` (which
// reads GENRES[p][field]) cannot see it. Same two lines, same law — parents
// missing the key sit out, the weights renormalize over the ones that have it —
// applied to a value that lives one file over.
function combineBpm(parents) {
  let acc = 0, tw = 0;
  for (const [p, w] of Object.entries(parents)) {
    if (typeof BPM[p] !== "number") continue;
    acc += BPM[p] * w; tw += w;
  }
  return tw ? Math.round(acc / tw) : null;
}

// A COMBINED INTEGER IS A COIN FLIP, so it is snapped to a parent's own value
// rather than to the nearest whole number. INHERITANCE.md §5 measured the naive
// version: `bars` overridden by 23 of 38 children with only 2 landing within
// 15%, gospel inheriting a twelve-bar blues form as a four-bar hymn (200% off),
// `voices` a median 33% off. The meter law's comment is the reason and it
// generalizes — "there is no music halfway between 3/4 and 4/4" is equally true
// of a form: the mean of a twelve-bar blues and a four-bar hymn is an eight-bar
// form neither parent knows how to end. So the average CHOOSES between the
// parents' declared values instead of landing between them, which is the pick
// side of the line where these two fields have always belonged.
function snapToParent(parents, field) {
  const c = I.combineNum(parents, field);
  if (!c.has) return { has: false };
  let best = null, bestD = Infinity;
  for (const p of Object.keys(parents).sort((a, b) => parents[b] - parents[a])) {
    const v = GENRES[p] && GENRES[p][field];
    if (typeof v !== "number") continue;
    const d = Math.abs(v - c.raw);
    if (d < bestD - 1e-9) { bestD = d; best = v; }
  }
  return { has: true, value: best, raw: c.raw, exact: best === c.value };
}

// normalize + order the parent declaration. Weights are a claim about SHARE and
// sum to 1 like every `parents:` line in genres.js; a caller may hand in bare
// counts and get them normalized, but may not hand in a name the table does not
// hold — a lab that silently drops an unknown parent is a lab that quietly
// makes a different genre than the one you asked for.
function readParents(spec) {
  const entries = Array.isArray(spec)
    ? spec.map(k => [k, 1])
    : Object.entries(spec || {});
  if (!entries.length) throw new Error("lab: a candidate needs at least one parent");
  const out = {};
  let tw = 0;
  for (const [k, w0] of entries) {
    if (!GENRES[k]) throw new Error("lab: no such genre \"" + k + "\"");
    if (!REAL.includes(k))
      throw new Error("lab: \"" + k + "\" is a FUNCTION genre (a part, not a style) " +
                      "and has no history to inherit");
    const w = typeof w0 === "number" ? w0 : 1;
    if (!(w > 0)) throw new Error("lab: parent \"" + k + "\" has no weight");
    out[k] = w; tw += w;
  }
  for (const k of Object.keys(out)) out[k] = Math.round((out[k] / tw) * 1e4) / 1e4;
  return out;
}

// THE INVENTION LIST — which material this architecture actually needs. Every
// entry says WHY, because "invent a bassGrid" is an instruction and "the bass
// group came from boombap, which plays a written grid rather than a named
// idiom" is a brief.
function inventionList(cand, parents, sources) {
  const has = f => Object.keys(parents).some(p =>
    Object.prototype.hasOwnProperty.call(GENRES[p], f));
  const list = [];
  const add = (field, why) => list.push({ field, group: MATERIAL[field], why });
  // "does this genre have drums" is a question about the DRUMS PARENT, not
  // about the candidate: `kit` is material, so the candidate has none yet by
  // construction, and asking the candidate would answer "no drums" for every
  // genre the bench ever makes.
  const drummed = Object.keys((GENRES[sources.drums] || {}).kit || {}).length > 0;
  if (drummed) {
    add("kit", "the drums came from " + sources.drums + ", which plays; the pattern is yours");
    if (has("fill")) add("fill", "every drummed parent here ends a form with a fill");
    if (has("kitVel")) add("kitVel", "a parent writes the hand into the kit's velocities");
  }
  if (cand.harmony === "cycle") {
    add("roots", "a cycle is a progression, and the progression is the genre");
    if (has("prog")) add("prog", "a parent voices its cycle as chords, not bare roots — " +
                                 "the prog's degrees must match `roots` bar for bar");
  }
  add("instr", "who is in the band");
  if (!cand.nobass && !cand.bassStyle && has("bassGrid"))
    add("bassGrid", "the bass came from " + sources.bass +
                    ", which plays a written grid rather than a named idiom");
  add("words", "what each voice is doing, said in words");
  add("word", "…and the operators that make it true");
  return list;
}

// synthesize(parents, opts) -> { candidate, manifest, invention, sources, ... }
//
// `manifest` is the whole point of the return value: per field, whether the
// machine COMBINED it (and from what raw average), SNAPPED it to a parent's own
// value, PLUCKED it (and from which parent), DERIVED it, or is AWAITING
// INVENTION. Nothing about the candidate is unattributed.
function synthesize(parentSpec, opts) {
  opts = opts || {};
  const parents = readParents(parentSpec);
  const order = Object.keys(parents).sort((a, b) => parents[b] - parents[a]);
  const dominant = order[0];
  const rule = opts.rule || "draw";
  const from = opts.from || {};
  const seed = opts.seed | 0;

  // 1. which parent supplies each pluck group — the draw by default, the oracle
  // on request. Either way the answer is per GROUP and never per field, which
  // is the law both rules inherit: "a kit from motown with a fill from blues is
  // the same bug" the once-per-group draw exists to prevent.
  const sources = {};
  for (const grp of Object.keys(I.GROUPS)) {
    const pool = eligible(parents, grp);
    if (from[grp]) { sources[grp] = from[grp]; continue; }
    sources[grp] = rule === "draw" ? drawSource(pool, grp, seed)
      : withStub({ ...(opts.child || {}), parents: pool },
                 key => I.pluckSource(key, grp, rule, from)).parent;
  }

  const cand = {}, manifest = [];
  const put = (field, cls, value, extra) => {
    cand[field] = value;
    manifest.push(Object.assign({ field, class: cls, value }, extra || {}));
  };

  // 2. IDENTITY. The label is not synthesized — see §4, which OFFERS names and
  // never picks one. `parents` is the declaration itself and is true by
  // construction: the candidate's DNA is literally what was chosen.
  put("parents", "identity", parents,
      { note: "true by construction — these are the genres you picked" });

  // 3. COMBINE — the free scalars, by inherit.js's own combineNum
  for (const f of I.COMBINE) {
    const c = I.combineNum(parents, f);
    if (!c.has) continue;
    const n = Object.keys(parents).filter(p => typeof GENRES[p][f] === "number");
    put(f, "combined", c.value,
        { raw: c.raw, note: !c.unanimous ? null
            : n.length === 1 ? "only " + n[0] + " declares it — carried, not averaged"
            : "all " + n.length + " declaring parents say this" });
  }
  const bpm = combineBpm(parents);
  if (bpm != null) put("bpm", "combined", bpm,
    { note: "tempo lives in compose.js BPM, not on the anchor — combined by the same law" });

  // 4. COMBINE_Q — snapped to a parent's value, not to a whole number
  for (const f of I.COMBINE_Q) {
    const s = snapToParent(parents, f);
    if (!s.has) continue;
    put(f, "snapped", s.value,
        { raw: s.raw, note: "the average was " + s.raw.toFixed(2) + "; a " +
          (f === "bars" ? "form length" : "headcount") +
          " is picked, not averaged (INHERITANCE.md §5)" });
  }

  // 5. PLUCK — every group noun that is not material, from the group's parent
  for (const [grp, fields] of Object.entries(I.GROUPS)) {
    const src = sources[grp];
    for (const f of fields) {
      if (MATERIAL[f]) continue;                       // §0: the material is not the machine's
      const g = GENRES[src];
      if (!g || !Object.prototype.hasOwnProperty.call(g, f)) continue;
      const elsewhere = order.filter(p => p !== src &&
        Object.prototype.hasOwnProperty.call(GENRES[p], f));
      put(f, "plucked", g[f], { from: src, group: grp,
        note: elsewhere.length ? "also declared by " + elsewhere.join("/") +
              " — the group law takes all of " + grp + " from one parent" : null });
    }
  }

  // 6. COMBINE_LEAVES — `tone` is a recipe: six numbers that combine and a
  // waveform that plucks with the timbre group. Only `tone.gain` is measured as
  // genuinely inheritable (median error 3.8%, 27 of 31 within 15%); the other
  // five depart from their parents by 20–40% across the catalog, so they are
  // combined as a HONEST STARTING POINT and the note says so rather than
  // pretending the average is the answer.
  {
    const tone = {}, waveSrc = GENRES[sources.timbre];
    for (const lk of ["wave", "cut", "q", "atk", "rel", "gain", "verb"]) {
      if (lk === "wave") { tone.wave = waveSrc && waveSrc.tone && waveSrc.tone.wave; continue; }
      const c = I.combineLeaf(parents, "tone", lk);
      if (c.has) tone[lk] = c.value;
    }
    put("tone", "combined", tone, { from: sources.timbre,
      note: "tone.wave plucked with the timbre group; the numbers combined — only " +
            "tone.gain is measured reliable, the rest is a starting point" });
  }

  // 7. DERIVED — `family` and the dynamics triple. genres.js stamps these at
  // load from FAMILIES / DYNAMICS / DYN_FAMILY, both keyed on the genre's own
  // name, and a genre that does not exist yet is in neither table. So they come
  // from the dominant parent's ALREADY-RESOLVED values rather than from a fresh
  // table lookup, for the reason DYN_FAMILY states out loud: there is
  // deliberately no `club` row, so resolving a club candidate through the family
  // table would land on nothing and "render flat forever, which is the failure
  // this table exists to prevent". A parent that is a machine (DYNAMICS `null`)
  // hands down no triple at all, and the candidate is a machine too — which is
  // the right inheritance for a 909 and is undone by naming a hand.
  put("family", "derived", GENRES[dominant].family,
      { from: dominant, note: "the dominant parent's cluster" });
  for (const f of ["stress", "phrase", "touch"]) {
    const v = GENRES[dominant][f];
    if (v === undefined) continue;
    put(f, "derived", v, { from: dominant,
      note: "resolved on " + dominant + " already — never re-looked-up, because " +
            "DYN_FAMILY has no `club` row on purpose" });
  }
  if (GENRES[dominant].stress === undefined)
    manifest.push({ field: "stress/phrase/touch", class: "derived", value: null,
      from: dominant, note: dominant + " is a machine (DYNAMICS null) — so is this" });

  // 8. THE MATERIAL — explicitly empty, and enumerated
  const invention = inventionList(cand, parents, sources);
  for (const inv of invention)
    put(inv.field, "invent", null, { group: inv.group, note: inv.why });

  // reorder into the anchors' own reading order
  const ordered = {};
  for (const f of ORDER) if (Object.prototype.hasOwnProperty.call(cand, f)) ordered[f] = cand[f];
  for (const f of Object.keys(cand)) if (!(f in ordered)) ordered[f] = cand[f];

  return { candidate: ordered, manifest, invention, sources, parents, order,
           dominant, rule };
}

// ---------------------------------------------------------------------------
// §2. ROLL — the dice draft the material
// ---------------------------------------------------------------------------

// DETERMINISTIC PER (candidate, field, seed), and the candidate half of that
// triple is its ARCHITECTURE ALONE. Hashing the whole candidate would mean
// rolling the kit changed what `fill` and `roots` would have rolled — every
// draft would depend on the order you pressed the buttons, and a seed would not
// be shareable. Hashing the architecture makes each material field an
// independent, repeatable draw: same parents, same seed, same field, same
// answer, whatever else has been filled in or hand-written since.
function architectureOf(cand) {
  const a = {};
  for (const f of Object.keys(cand))
    if (!MATERIAL[f] && f !== "label") a[f] = cand[f];
  return a;
}
// FNV-1a over the canonical serialization — inherit.js's `canon` is the
// currency here too, so a closure hashes as its own source text and two
// candidates that differ only in key order hash the same.
function hash(...parts) {
  let h = 0x811c9dc5;
  for (const s of parts) {
    const str = String(s);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}
// the kernel's own mulberry32 (K.prng), not a second one: two organs, one die
const dice = (cand, field, seed) =>
  K.prng(hash(canon(architectureOf(cand)), field, String(seed | 0)));
const pick = (rnd, xs) => xs[Math.floor(rnd() * xs.length) % xs.length];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// THE ROLL'S TARGETS come from genealogy.js's projection of the PARENTS,
// blended by weight — the same 27 features the lineage fit is measured in. A
// rolled kit is not "some drums", it is drums whose kick/backbeat/hat/perc
// densities are the weighted densities of the parents, with the placement
// invented. That is the division of labour again, one tier down: the machine
// knows how BUSY, a person knows WHERE.
function targets(parents) {
  const idx = {};
  GEN.FEATURES.forEach((f, i) => { idx[f] = i; });
  const acc = {};
  let tw = 0;
  for (const [p, w] of Object.entries(parents)) {
    const v = GEN.featuresOf(p);
    for (const f of GEN.FEATURES) acc[f] = (acc[f] || 0) + v[idx[f]] * w;
    tw += w;
  }
  for (const f of GEN.FEATURES) acc[f] /= (tw || 1);
  return acc;
}

// how much each parent uses a given kit lane, by weight — used to decide
// whether the candidate's time is kept on a hat or a ride, and which limb the
// percussion lane belongs to
function laneWeight(parents, lane) {
  let n = 0;
  for (const [p, w] of Object.entries(parents)) {
    const kit = GENRES[p].kit || {};
    if (kit[lane] && kit[lane].some(Boolean)) n += w;
  }
  return n;
}

// METRICAL WEIGHT — where a hit wants to be when nothing else decides. The bar
// head outranks the half, which outranks the beats, which outrank the
// eighths, which outrank the sixteenths. It is the oldest table in music and
// it is here so a rolled kit lands on the grid a listener already has.
const METRE = [9, 1, 3, 1, 6, 1, 3, 1, 8, 1, 3, 1, 6, 1, 3, 2];
// place `n` hits on a 16-step lane, strongest positions first, seeded jitter
// breaking ties so two rolls of the same density are not the same pattern
function place(rnd, n, opts) {
  opts = opts || {};
  const forced = opts.forced || [];
  const banned = new Set(opts.banned || []);
  const lane = new Array(16).fill(0);
  for (const f of forced) lane[f] = 1;
  const want = clamp(n, forced.length, 16 - banned.size);
  const ranked = [];
  for (let i = 0; i < 16; i++) {
    if (lane[i] || banned.has(i)) continue;
    ranked.push([i, METRE[i] * (opts.off ? 0.35 : 1) *
                    (opts.off && i % 2 === 1 ? 3 : 1) + rnd() * 2.5]);
  }
  ranked.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (let j = 0; j < want - forced.length && j < ranked.length; j++) lane[ranked[j][0]] = 1;
  return lane;
}

// A KIT THAT FITS THE DRUMKIT. The metal lane is the one place the sampled kit
// name genuinely constrains the pattern: a jazz or brush kit keeps time on the
// RIDE with the left foot closing the hat (blues' own comment, "that pairing is
// most of what 'sounds like a blues band' means"), a drum machine keeps it on
// the hat and answers the snare with a clap. So `drumkit` picks the letters and
// the parents' densities pick the amount.
const METAL_BY_KIT = { jazz: "r", brush: "r" };
const MACHINES = new Set(["tr808", "tr909", "cr78", "electronic"]);
function rollKit(cand, parents, seed) {
  const rnd = dice(cand, "kit", seed), t = targets(parents);
  const kit = {};
  const drumkit = cand.drumkit;
  // the kick: always the downbeat, then the parents' own density
  kit.k = place(rnd, Math.max(1, Math.round(t.kick * 16)), { forced: [0] });
  // the backbeat, on 2 and 4 — the one placement in the table that is a fact
  // about the genre rather than a choice, when the density asks for it at all
  const bb = Math.round(t.backbeat * 16);
  if (bb >= 2) {
    const snareLane = MACHINES.has(drumkit) && laneWeight(parents, "c") >
                      laneWeight(parents, "s") ? "c" : "s";
    kit[snareLane] = place(rnd, bb, { forced: [4, 12], off: bb > 4 });
  } else if (bb === 1) {
    kit.s = place(rnd, 1, { forced: [8] });
  }
  // the metal: the grid nearest the parents' hat density, on the letter the
  // kit implies (ride for the jazz kits, a ride if the parents already ride)
  if (t.hats >= 0.08) {
    const metal = METAL_BY_KIT[drumkit] ||
      (laneWeight(parents, "r") > laneWeight(parents, "h") ? "r" : "h");
    const grids = [[4, 0.25], [2, 0.5], [1, 1]];
    let best = grids[1];
    for (const g of grids)
      if (Math.abs(g[1] - t.hats) < Math.abs(best[1] - t.hats)) best = g;
    kit[metal] = Array.from({ length: 16 }, (_, i) => (i % best[0] === 0 ? 1 : 0));
    // …and the left foot, which is what a ride needs to still be a groove
    if (metal === "r") kit.f = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
    // an open hat on the offbeat is the machine's own answer to the ride
    if (MACHINES.has(drumkit) && t.hats > 0.5 && rnd() < 0.5)
      kit.o = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  }
  // the percussion lane, if the parents carry one
  if (t.perc >= 0.05) {
    const lanes = ["p", "c", "t", "m", "l"].filter(l => laneWeight(parents, l) > 0);
    const l = lanes.length ? lanes.reduce((a, b) =>
      laneWeight(parents, b) > laneWeight(parents, a) ? b : a) : "p";
    if (!kit[l]) kit[l] = place(rnd, Math.max(1, Math.round(t.perc * 16)), { off: true });
  }
  return kit;
}

// A FILL IS A DIFFERENT BAR, NOT A LOUDER ONE — and the gate says so in exactly
// those terms (test/unit/nukernel.test.js §12: "the fill bar is not busier than
// bar 1"). drums() merges `fill` over the base kit on the LAST bar and a fill
// lane REPLACES the base lane wholesale, so the roll unions the base in before
// it adds anything: a fill that forgot the backbeat would be a quieter bar
// wearing the name.
const hits = v => (v || []).reduce((s, x) => s + (x ? 1 : 0), 0);
function rollFill(cand, parents, seed) {
  const rnd = dice(cand, "fill", seed);
  const kit = cand.kit || {};
  const hand = kit.s ? "s" : kit.c ? "c"
    : Object.keys(kit).find(l => l !== "k" && K.LANES[l]) || "s";
  // WHAT THE FILL ADDS, lane by lane: a run in the back half of the bar on the
  // hand that carries the backbeat, and the turn into whatever comes next —
  // a tom drop on a kit with toms, a crash on a machine that has none. Same
  // gesture, each kit's own vocabulary.
  const add = { [hand]: place(rnd, 4, { banned: [0, 1, 2, 3, 4, 5, 6, 7], off: true }) };
  for (let i = 10; i < 16; i += 2) add[hand][i] = 1;
  if (MACHINES.has(cand.drumkit)) {
    add.x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8];
  } else {
    add.m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
    add.l = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0];
  }
  // A FILL LANE REPLACES THE BASE LANE OUTRIGHT — drums() merges `{...base,
  // ...g.fill}` on the last bar — so every lane the fill touches has to carry
  // the base's own hits forward or the fill SUBTRACTS. Measured: a candidate
  // whose kit kept time on the low tom lost seven hits to a two-note tom drop
  // and the fill bar came out QUIETER than bar 1. The base's level wins where
  // both speak, because a 2..9 on the step is an exact level somebody meant.
  const fill = {};
  for (const [lane, vec] of Object.entries(add)) {
    const base = kit[lane] || [];
    fill[lane] = Array.from({ length: 16 },
      (_, i) => (base.length ? base[i % base.length] : 0) || vec[i] || 0);
  }
  // …and the guarantee, checked rather than assumed: if every addition landed
  // on a hit the kit already had, the fill bar is the same bar and the gate
  // would say so. Borrow a lane the kit is not using and drop two hits into
  // the turn — bounded, deterministic, and only ever reached by a kit that is
  // already playing everywhere.
  const added = Object.keys(fill).reduce(
    (s, l) => s + hits(fill[l]) - hits(kit[l]), 0);
  if (added <= 0) {
    const free = ["t", "m", "l", "p", "x"].find(l => !kit[l]);
    if (free) fill[free] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0];
  }
  return fill;
}

// THE HAND ON THE TIME LANE. kitVel is per-16th velocity, and the only shape
// that reads as a player rather than as a sequencer is loud on the beat, soft
// between, with the gap between them widening the harder the genre leans
// (`stress`, which the candidate inherited). A machine that inherited no
// `stress` gets a flat profile, which is what a machine is.
function rollKitVel(cand, parents, seed) {
  const rnd = dice(cand, "kitVel", seed);
  const kit = cand.kit || {};
  const lane = ["h", "r", "o", "s"].find(l => kit[l] && kit[l].some(Boolean));
  if (!lane) return null;
  const lean = cand.stress == null ? 0.15 : clamp(cand.stress, 0.05, 0.7);
  const hi = Math.round(5 + 5 * lean), lo = Math.round(5 - 4 * lean);
  return { [lane]: Array.from({ length: 16 }, (_, i) => {
    const strong = i % 4 === 0, half = i % 2 === 0;
    const v = strong ? hi : half ? Math.round((hi + lo) / 2) : lo;
    return clamp(v + (rnd() < 0.25 ? 1 : 0), 1, 9);
  }) };
}

// ROOTS IN THE CANDIDATE'S OWN MODE, AT THE PARENTS' OWN CHORD RATE. The pool
// is chosen by the `diatonic` law the candidate already inherited: a genre that
// follows the chord by DEGREES has the whole seven to move through, and one
// that follows it by semitones through a pentatonic subject gets the four
// degrees that pool actually spells — i, iv, v, ♭VII, the modal-rock cadence
// natural minor already contains (rock's own comment). Bar 1 is home and the
// last bar leads back to it, because a cycle that does not close is a list.
function rollRoots(cand, parents, seed) {
  const rnd = dice(cand, "roots", seed), t = targets(parents);
  const md = cand.mode || K.MODE || [0, 2, 3, 5, 7, 8, 10];
  const wide = !!cand.diatonic;
  const pool = wide ? [3, 4, 5, 1, 2, 6] : [3, 4, 6];
  const bars = cand.bars || 4;
  // chord-change rate: the parents' own harmrate, read as bars per chord
  const per = clamp(Math.round(1 / Math.max(t.harmrate, 1 / bars)), 1, Math.max(1, bars / 2));
  const roots = new Array(bars).fill(0);
  let d = 0;
  for (let b = 0; b < bars; b++) {
    if (b % per === 0 && b > 0) d = b >= bars - per ? pick(rnd, wide ? [4, 3] : [4, 3]) : pick(rnd, pool);
    if (b === 0) d = 0;
    roots[b] = clamp(d, 0, md.length - 1);
  }
  if (bars > 2) roots[Math.floor(bars / 2)] = 0;      // the form's own half-way home
  return roots;
}

// A PROG IS THE ROOTS SAID OUT LOUD, and genres.js gates it bar for bar: "the
// prog's first-chord degrees must equal the roots bar for bar". So it is rolled
// FROM the roots, never beside them. What the dice choose is the QUALITY, from
// the parents' own seventh-ness — and which spelling of the seventh, which is a
// real decision: the diatonic "7" takes whatever seventh the mode owns and can
// never leave the key, "dom7" is the absolute stack that natural minor cannot
// spell and every blues wants (kernel.js QSTEPS/QFIX).
function rollProg(cand, parents, seed) {
  const rnd = dice(cand, "prog", seed), t = targets(parents);
  const roots = cand.roots;
  if (!Array.isArray(roots)) return null;
  const sevenths = t.seventh > 0.45;
  const q = !sevenths ? null : cand.diatonic ? "7" : "dom7";
  return roots.map((d, i) => {
    if (!q) return { d };
    // the last chord of a cycle takes the seventh even when the rest do not —
    // that is what makes it a turnaround rather than a stop
    const on = i === roots.length - 1 || rnd() < 0.75;
    return on ? { d, q } : { d };
  });
}

// THE BAND IS HIRED FROM THE FAMILIES THE PARENTS PLAY IN. Every id here is a
// SAMPLERS id some shipping anchor already voices, so a rolled instrument can
// never name a sound the page cannot fetch (fields.js INSTRCHOICES is that same
// union, and instruments.js instrOf THROWS on a genre with no `instr` — the old
// silent piano fallback is exactly how a rotted entry stayed hidden). Voice 0
// gets the dominant parent's own lead, because the first thing you hear should
// be recognisably from somewhere.
function familyPool(parents) {
  const fams = new Set(Object.keys(parents).map(p => GENRES[p].family));
  const ids = [];
  for (const k of REAL) {
    if (!fams.has(GENRES[k].family)) continue;
    const e = GENRES[k].instr;
    for (const id of (Array.isArray(e) ? e : [e])) if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
function rollInstr(cand, parents, seed) {
  const rnd = dice(cand, "instr", seed);
  const order = Object.keys(parents).sort((a, b) => parents[b] - parents[a]);
  const pool = familyPool(parents);
  const out = [];
  const lead = GENRES[order[0]].instr;
  out.push(Array.isArray(lead) ? lead[0] : lead);
  const rest = pool.filter(id => id !== out[0]);
  for (let v = 1; v < (cand.voices || 1); v++) {
    if (!rest.length) break;
    const id = pick(rnd, rest);
    rest.splice(rest.indexOf(id), 1);
    out.push(id);
  }
  return out.length === 1 ? out[0] : out;
}

// THE BASS GRID at the parents' own motion. bassmotion is genealogy's blend of
// the named idioms and the written grids; the downbeat is never optional,
// because a bass that can miss the bar line is a different instrument.
function rollBassGrid(cand, parents, seed) {
  const rnd = dice(cand, "bassGrid", seed), t = targets(parents);
  const n = clamp(Math.round(1 + t.bassmotion * 6), 1, 8);
  return place(rnd, n, { forced: [0] });
}

// ---- the word, and the words that describe it ------------------------------
// ONE TABLE, TWO OUTPUTS. `word` is the closure the renderer calls and `words`
// is the line the panel prints, and they are rolled from the same dice in the
// same pass so the sentence cannot drift from the operators — the naming law
// tools/genre/gen-genre-info.js enforces in the parent project ("a card cannot
// promise an instrument the recipe cannot play"), applied to operators instead
// of instruments. Every phrase below comes from this table keyed on the op that
// was actually chosen; there are no per-candidate strings, on purpose.
const DEGWORD = ["unison", "a second", "a third", "a fourth", "a fifth",
                 "a sixth", "a seventh", "an octave"];
const ORD = { 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth", 8: "eighth" };
const PALETTE = [
  { id: "rotate", args: [2, 4, 6, 8, 12], op: n => K.rotate(n),
    say: n => "rotated " + n },
  { id: "reverse", args: [0], op: () => K.reverse(),
    say: () => "backwards" },
  { id: "transpose", args: [-4, -3, 2, 3, 4], op: n => K.transpose(n),
    say: n => (n > 0 ? DEGWORD[n] + " above" : DEGWORD[-n] + " below") },
  { id: "invert", args: [2, 4, 5], op: n => K.invert(n),
    say: () => "turned upside down" },
  { id: "drop", args: [2, 3, 4], op: n => K.drop(n),
    say: n => "every " + ORD[n] + " note gone" },
  { id: "fill", args: [2, 3], op: n => K.fill(n),
    say: n => "filled to " + (n === 2 ? "eighths" : "triplets of the grid") },
  { id: "onlygate", args: [4, 8], op: n => K.only("gate", K.rotate(n)),
    say: n => "only the rhythm, rotated " + n },
];
// the rolled table: TABLE[v][s] = [{id, arg}], built once so the closure that
// reads it holds no dice of its own. A `word` that called a prng at render time
// would be a different genre on the second bar, and validate()'s determinism
// check exists to catch exactly that.
function wordTable(cand, parents, seed) {
  const rnd = dice(cand, "word", seed), t = targets(parents);
  const load = clamp(Math.round(t.wordload * 3), 0, 2);
  const V = cand.voices || 1;
  const table = [];
  for (let v = 0; v < V; v++) {
    const rows = [];
    for (let s = 0; s < 4; s++) {
      // VOICE 0 IS THE SUBJECT. Something in the texture has to be the thing
      // the others are answering, or there is nothing to recognise.
      //
      // …and the FLOOR under the top voice: several genres carry a word load
      // that rounds to nothing, because what separates their voices is
      // `realize` and `part` rather than any operator. That is faithful to the
      // parent and it is a dull draft — a form whose second half is its first
      // half again is a loop, not a form — so the highest voice always gets one
      // move in the back half. It is the smallest thing that makes the roll
      // worth hearing, and it is the first thing a person will overwrite.
      const top = v === V - 1 && V > 1 && s >= 2;
      const n = v === 0 ? Math.max(0, load - 1)
        : Math.max(load + (s === 3 ? 1 : 0), top ? 1 : 0);
      const ops = [];
      const used = new Set();
      for (let i = 0; i < n; i++) {
        const p = pick(rnd, PALETTE.filter(x => !used.has(x.id)));
        if (!p) break;
        used.add(p.id);
        ops.push({ id: p.id, arg: pick(rnd, p.args) });
      }
      rows.push(ops);
    }
    table.push(rows);
  }
  return table;
}
const opOf = spec => PALETTE.find(p => p.id === spec.id).op(spec.arg);
const sayOf = spec => PALETTE.find(p => p.id === spec.id).say(spec.arg);
function rollWord(cand, parents, seed) {
  const table = wordTable(cand, parents, seed);
  const built = table.map(rows => rows.map(ops => ops.map(opOf)));
  // total in both arguments, like every `word` in genres.js: a voice past the
  // roster or a section past the fourth gets an empty word rather than a throw
  const word = (v, s) => ((built[v] || [])[s] || (built[v] || [])[0] || []);
  word.__labTable = table;                 // so `words` can describe THIS closure
  return word;
}
function rollWords(cand, parents, seed) {
  const table = (cand.word && cand.word.__labTable) || wordTable(cand, parents, seed);
  const part = v => (cand.part ? cand.part[v % cand.part.length]
                               : (cand.realize && cand.realize(v)) || "line");
  return table.map((rows, v) => {
    const ops = rows[0];
    const head = v === 0 ? "the subject" : "the " + part(v);
    const line = ops.length ? head + " — " + ops.map(sayOf).join(", ")
                            : head + ", as written";
    // …and if the back half does something the first section does not, the line
    // has to say so. A description that stops at section 0 is a description of
    // a different closure than the one the renderer calls.
    const late = rows[rows.length - 1];
    return canon(late) === canon(ops) ? line
      : line + "; then " + (late.length ? late.map(sayOf).join(", ") : "as written");
  });
}

const ROLLERS = { kit: rollKit, fill: rollFill, kitVel: rollKitVel,
                  roots: rollRoots, prog: rollProg, instr: rollInstr,
                  bassGrid: rollBassGrid, word: rollWord, words: rollWords };

// roll(candidate, field, seed) -> a draft value, or null when the architecture
// does not want that field. THROWS on a field the bench does not roll, because
// a silent null for "kti" is the same class of bug as the piano fallback.
function roll(cand, field, seed, parents) {
  const r = ROLLERS[field];
  if (!r) throw new Error("lab: nothing rolls \"" + field + "\" (material: " +
                          Object.keys(ROLLERS).join(", ") + ")");
  return r(cand, parents || cand.parents, seed | 0);
}
// rollAll — fills the invention list in DEPENDENCY ORDER: the fill reads the
// kit, the prog reads the roots, the words read the word. Returns a NEW
// candidate; the one handed in is not mutated, so a UI can offer "roll again"
// without losing what a person has already written.
const ROLL_ORDER = ["kit", "kitVel", "fill", "roots", "prog", "instr",
                    "bassGrid", "word", "words"];
function rollAll(syn, seed, opts) {
  opts = opts || {};
  const keep = new Set(opts.keep || []);       // fields a person has taken over
  const out = { ...syn.candidate };
  const want = new Set(syn.invention.map(i => i.field));
  for (const f of ROLL_ORDER) {
    if (!want.has(f) || keep.has(f)) continue;
    const v = roll(out, f, seed, syn.parents);
    if (v == null) { delete out[f]; continue; }
    out[f] = v;
  }
  const ordered = {};
  for (const f of ORDER) if (Object.prototype.hasOwnProperty.call(out, f)) ordered[f] = out[f];
  for (const f of Object.keys(out)) if (!(f in ordered)) ordered[f] = out[f];
  return ordered;
}

// ---------------------------------------------------------------------------
// §3. NOVELTY — is this a new genre, or an old one wearing a hat?
// ---------------------------------------------------------------------------
// PRIOR ART: engine/checks/near-duplicate.js, whose first signal is exactly
// this — "Euclidean distance between z-scored centroids… WARN under
// distThreshold" — surfacing pairs that sit so close they are one authoring
// wobble from a confusion-matrix tie. Two differences, both forced by where
// this runs:
//
//   * the space is genealogy.js's 27 features, not the parent project's
//     geometry module, because that is the space this table is already measured
//     in and a second projection would be a second truth.
//   * the threshold is NOT a tuned constant. It is read off the distribution of
//     the REAL ANCHORS' OWN nearest-neighbour distances: if a candidate sits
//     closer to its neighbour than the closest tenth of the table's own sibling
//     pairs do, it is inside the noise the table already tolerates, and calling
//     it a genre is calling `near:` a genre. That re-derives every time an
//     anchor lands, so no count and no cutoff is written down here.
let _space = null;
function space() {
  if (_space) return _space;
  const rows = REAL.map(k => GEN.featuresOf(k));
  const n = GEN.FEATURES.length;
  const mean = [], sd = [];
  for (let i = 0; i < n; i++) {
    const col = rows.map(r => r[i]);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    const v = col.reduce((a, b) => a + (b - m) * (b - m), 0) / col.length;
    mean.push(m); sd.push(Math.sqrt(v) || 1);
  }
  const z = rows.map(r => r.map((x, i) => (x - mean[i]) / sd[i]));
  const dist = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) * (x - b[i]), 0));
  // the table's own nearest-neighbour distances — what "close" already means
  const nn = z.map((r, i) => {
    let best = Infinity;
    z.forEach((o, j) => { if (i !== j) best = Math.min(best, dist(r, o)); });
    return best;
  }).sort((a, b) => a - b);
  const q = p => nn[clamp(Math.floor(p * nn.length), 0, nn.length - 1)];
  _space = { mean, sd, z, dist, nn, p10: q(0.1), median: q(0.5), p90: q(0.9) };
  return _space;
}
// features for a candidate: seated on the bench (§1's stub law) so
// genealogy.js's own featuresOf reads it, with two honest corrections.
function featuresOfCandidate(cand) {
  // the closures featuresOf calls must exist even before the material is
  // rolled, so an UNROLLED candidate can still be judged on its architecture
  const playable = {
    word: () => [], kit: {}, instr: [], realize: () => "line", entry: () => 0,
    reg: v => -v, ...cand };
  for (const f of Object.keys(playable)) if (playable[f] == null) delete playable[f];
  if (!playable.word) playable.word = () => [];
  if (!playable.kit) playable.kit = {};
  const v = withStub(playable, key => GEN.featuresOf(key));
  // BPM lives in compose.js keyed by genre name, and a candidate has no name
  // there, so featuresOf takes its documented 112 fallback. The candidate DOES
  // know its combined tempo, so the one feature that fallback governs is
  // rewritten here rather than left as a stand-in — the same formula,
  // genealogy.js l.87, with the number it should have had.
  if (typeof cand.bpm === "number")
    v[GEN.FEATURES.indexOf("tempo")] = clamp((cand.bpm - 70) / 90, 0, 1);
  return v;
}
function novelty(cand) {
  const S = space();
  const raw = featuresOfCandidate(cand);
  const z = raw.map((x, i) => (x - S.mean[i]) / S.sd[i]);
  const ranked = REAL.map((k, i) => ({ key: k, label: GENRES[k].label,
                                       dist: S.dist(z, S.z[i]) }))
    .sort((a, b) => a.dist - b.dist);
  const near = ranked[0];
  const rolled = !!(cand.kit && Object.keys(cand.kit).length) || !!cand.instr;
  // WHERE THE CANDIDATE SITS IN THE TABLE'S OWN TOLERANCE, said as a share
  // rather than as a distance: "3.4" means nothing to a reader and "closer than
  // 88% of the anchors are to their own nearest neighbour" is the whole verdict
  // in one clause. This is the number the band is cut from.
  const closer = S.nn.filter(d => d > near.dist).length / S.nn.length;
  let band, verdict;
  if (near.dist <= S.p10) {
    band = "derivative";
    verdict = "this is " + near.key + " wearing a hat";
  } else if (near.dist <= S.median) {
    band = "cousin";
    verdict = "a close cousin of " + near.key + " (" + near.label + ") — real, but " +
              "it will be filed next to it";
  } else if (near.dist <= S.p90) {
    band = "new";
    verdict = "genuinely new — further from " + near.key + " than most anchors are " +
              "from their own nearest neighbour";
  } else {
    band = "outlier";
    verdict = "out past the edge of the table — nothing here is close, which is " +
              "either the point or a mistake in the architecture";
  }
  verdict += " — closer to it than " + Math.round(closer * 100) +
             "% of the anchors are to their own nearest neighbour";
  return { nearest: near.key, label: near.label, dist: near.dist, band, verdict,
           closer, ranked: ranked.slice(0, 5),
           thresholds: { p10: S.p10, median: S.median, p90: S.p90 },
           measured: rolled ? "architecture + material" : "architecture only",
           note: rolled ? null
             : "nothing has been rolled yet, so this is the architecture's own " +
               "position — the material is what moves it" };
}

// ---------------------------------------------------------------------------
// §4. NAMING — place-year, and never only one
// ---------------------------------------------------------------------------
// Every real anchor is a PLACE and a YEAR, and the lab's names are made the way
// the table's are: the place comes from the parents (their labels carry the
// cities), the year is extrapolated past both of them, because a child that
// predates its parents is a claim nobody can defend. Speculative futures are
// allowed and so are speculative places — an invented genre gets a place-year
// it COINS. What it may not do is coin a label the table already holds, so
// every offer is checked against the live labels.
const YEARED = /^(.+?)\s+(\d{3,4})$/;
function placeYear(k) {
  const m = YEARED.exec(GENRES[k].label || "");
  return m ? { place: m[1], year: Number(m[2]) } : null;
}
// CITIES THE TABLE DOES NOT HOLD. A short list, on purpose: it exists so a
// coined name can leave the parents' geography without colliding with an
// anchor, and every entry is a real place with a real music scene, so the name
// reads as a record that could have existed rather than as a random noun.
const ELSEWHERE = ["Sheffield", "Lagos", "Marseille", "Belo Horizonte", "Osaka",
  "Gothenburg", "Medellín", "Leeds", "Durban", "Bristol", "Rotterdam",
  "Guadalajara", "Tbilisi", "Christchurch", "Hull", "Baltimore", "Naples",
  "Seoul", "Turin", "Halifax"];
function names(syn, seed) {
  const parents = syn.parents;
  const rnd = dice(syn.candidate, "label", seed || 0);
  const pys = Object.keys(parents).map(placeYear).filter(Boolean);
  const years = pys.map(p => p.year);
  const taken = new Set(REAL.map(k => GENRES[k].label));
  const out = [];
  if (!pys.length) return out;
  const lo = Math.min(...years), hi = Math.max(...years), span = hi - lo;
  // THE HEIR'S YEAR. A child lands AFTER BOTH parents — a record cannot be made
  // out of records that do not exist yet — and how long after is a quarter of
  // the gap between them: parents a generation apart make a child a few years
  // later, parents from the same year make a child the next one.
  //
  // CAPPED AT A WORKING LIFE, which is not a fudge. Plainchant and dub are
  // thirteen centuries apart, and a quarter of that is a date in the far
  // future dressed up as arithmetic; what actually makes a genre out of two
  // sources is people who heard both, so the lag a real lineage can carry is
  // bounded by how long one of them can be heard, not by how far apart they
  // were made.
  const LAG = 25;
  const heir = hi + clamp(Math.round(span / 4), 1, LAG);
  const ordered = Object.keys(parents).sort((a, b) => parents[b] - parents[a])
    .map(placeYear).filter(Boolean);
  const offer = (place, year, why) => {
    const label = place + " " + year;
    if (taken.has(label) || out.some(o => o.label === label)) return;
    out.push({ label, place, year, why });
  };
  offer(ordered[0].place, heir, "the heir — the dominant parent's city, a span later");
  if (ordered[1]) offer(ordered[1].place, heir, "the sibling — same year, the other city");
  const away = pick(rnd, ELSEWHERE);
  offer(away, heir, "the emigrant — the same record made somewhere it did not happen");
  offer(pick(rnd, ELSEWHERE.filter(c => c !== away)), heir + 10 + Math.floor(rnd() * 30),
        "the future — speculative, and allowed to be");
  // THE COUNTERFACTUAL, offered only when there is room between the parents AND
  // the two of them are within one memory of each other: the record that would
  // have had to exist for the later parent to make sense. Two parents thirteen
  // centuries apart have no missing link, they have a library.
  if (span >= 4 && span <= 2 * LAG)
    offer(pick(rnd, ELSEWHERE), lo + Math.max(1, Math.floor(span / 2)),
          "the counterfactual — the missing link, dated between the parents");
  return out;
}

// ---------------------------------------------------------------------------
// §5. VALIDATE — a candidate is held to the same laws a hand-written anchor is
// ---------------------------------------------------------------------------
// Typed problems, never a boolean, so the UI can refuse to KEEP a broken genre
// and say which law it broke. `level: "error"` is a refusal; `"warn"` is a
// second look. The laws are not invented here — each one is a rule the table
// already enforces on itself, cited in its own message.
const P = new Set(Object.keys(K.PARTS));
function problem(level, code, field, msg) { return { level, code, field, msg }; }
function validate(cand, opts) {
  opts = opts || {};
  const out = [];
  const err = (c, f, m) => out.push(problem("error", c, f, m));
  const warn = (c, f, m) => out.push(problem("warn", c, f, m));

  // --- the architecture must be there and be the right shape
  for (const [f, t] of [["rate", "number"], ["bars", "number"], ["voices", "number"],
                        ["harmony", "string"], ["entry", "function"],
                        ["reg", "function"], ["realize", "function"],
                        ["tone", "object"]])
    if (typeof cand[f] !== t) err("missing", f, f + " must be a " + t + " (every anchor declares one)");
  if (typeof cand.bars === "number" && (cand.bars < 1 || cand.bars % 1))
    err("type", "bars", "a form is a whole number of bars");
  if (typeof cand.voices === "number" && (cand.voices < 1 || cand.voices % 1))
    err("type", "voices", "there is no music with " + cand.voices + " voices");
  if (cand.harmony && !["modal", "emergent", "cycle"].includes(cand.harmony))
    err("type", "harmony", "harmony is modal | emergent | cycle");
  if (cand.tone && typeof cand.tone === "object")
    for (const lk of ["wave", "cut", "q", "atk", "rel", "gain", "verb"])
      if (cand.tone[lk] == null) warn("missing", "tone." + lk, "tone." + lk + " is unset");
  if (!cand.label) warn("missing", "label", "unnamed — §4 offers place-years, it does not pick one");

  // --- the material must not still be empty
  for (const f of CORE_MATERIAL) {
    if (!Object.prototype.hasOwnProperty.call(cand, f)) continue;
    const v = cand[f];
    if (v == null || (Array.isArray(v) && !v.length) ||
        (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length))
      err("empty-material", f, f + " is still empty — the machine does not fill this one " +
          "(INHERITANCE.md: " + f + " is invented, not inherited)");
  }

  // --- the kit: real lanes, real numbers, no silent lane
  if (cand.kit && typeof cand.kit === "object") {
    for (const [lane, vec] of Object.entries(cand.kit)) {
      if (/^[?~!]/.test(lane)) continue;                     // sidecars ride with their lane
      if (!K.LANES[lane]) { err("lane", "kit." + lane, "\"" + lane + "\" is not a kit lane " +
        "(kernel.js LANES: " + Object.keys(K.LANES).join(" ") + ")"); continue; }
      if (!Array.isArray(vec) || !vec.length) {
        err("lane", "kit." + lane, "lane " + lane + " is not a vector"); continue;
      }
      if (vec.some(x => typeof x !== "number" || x < 0 || x > 9))
        err("lane", "kit." + lane, "a kit step is 0..9 (0 silent, 1 defer, 2..9 an exact level)");
      if (!vec.some(Boolean))
        warn("lane", "kit." + lane, "lane " + lane + " never sounds — a silent drum is a " +
             "lane the mixer will still build");
    }
  }

  // --- the instruments must resolve to something the page can fetch
  if (cand.instr != null) {
    const ids = Array.isArray(cand.instr) ? cand.instr : [cand.instr];
    const known = new Set();
    for (const k of REAL) {
      const e = GENRES[k].instr;
      for (const id of (Array.isArray(e) ? e : [e])) if (id) known.add(id);
    }
    for (const id of ids)
      if (!known.has(id))
        err("instr", "instr", "\"" + id + "\" is not a SAMPLERS id any anchor voices " +
            "(instruments.js instrOf throws rather than falling back to a piano)");
    // …and asked of the real resolver, not of a copy of its rules: instrOf is
    // what the player calls, and a candidate whose per-voice reading throws
    // there is a genre that cannot be seated however good its id list looks
    try {
      withStub(cand, key => {
        for (let v = 0; v < (cand.voices || 1); v++) INSTR.instrOf(key, v);
      });
    } catch (e) { err("instr", "instr", "instruments.instrOf refuses it: " + e.message); }
    if (Array.isArray(cand.instr) && cand.instr.length > (cand.voices || 1))
      warn("instr", "instr", "more instruments than voices — the tail is never heard");
  }

  // --- the harmony's own gate: prog against roots, bar for bar
  if (cand.harmony === "cycle") {
    if (!Array.isArray(cand.roots) || !cand.roots.length)
      err("missing", "roots", "a cycle with no roots has nowhere to go");
    else if (cand.bars && cand.roots.length !== cand.bars)
      warn("roots", "roots", "roots is " + cand.roots.length + " bars against a " +
           cand.bars + "-bar form — it will wrap");
    if (cand.prog) {
      if (!Array.isArray(cand.prog)) err("type", "prog", "prog is an array of bars");
      else if (Array.isArray(cand.roots)) {
        if (cand.prog.length !== cand.roots.length)
          err("prog-roots", "prog", "prog is " + cand.prog.length + " bars and roots is " +
              cand.roots.length);
        cand.prog.forEach((slot, i) => {
          const c0 = Array.isArray(slot) ? slot[0] : slot;
          const d = (c0 && c0.d) || 0;
          if (cand.roots[i] !== undefined && d !== cand.roots[i])
            err("prog-roots", "prog[" + i + "]", "the prog's first-chord degree (" + d +
                ") must equal roots[" + i + "] (" + cand.roots[i] + ") — genres.js gates this");
        });
      }
    }
  } else if (cand.roots) {
    warn("roots", "roots", "roots on a " + cand.harmony + " genre is inert — harm() only " +
         "reads them under `cycle`");
  }

  // --- the words say what the word does
  if (Array.isArray(cand.words) && cand.voices && cand.words.length !== cand.voices)
    warn("words", "words", cand.words.length + " lines for " + cand.voices + " voices");
  if (cand.part) for (let v = 0; v < (cand.voices || 0); v++) {
    const p = K.partOf(cand, v);
    if (!P.has(p)) warn("part", "part", "\"" + p + "\" is not a kernel part (" +
                        [...P].join(" ") + ") — chairKeys will read it as `line`");
  }

  // --- and now the laws that can only be answered by RENDERING it. Everything
  // above is a shape check; these three are the gate's own questions, asked of
  // the schedule the candidate actually produces. (test/unit/nukernel.test.js
  // §12 the fill law, §12b the bass law, §4 determinism.)
  if (out.some(p => p.level === "error") && !opts.force) {
    out.push(problem("warn", "unrendered", null,
      "the render checks were skipped — fix the errors above and validate again"));
    return out;
  }
  const subj = opts.subject || DEFAULT;
  let ev1, dr1, ba1;
  try {
    ev1 = K.render(subj, cand, cand.bars);
    dr1 = K.drums(subj, cand, cand.bars);
    ba1 = K.bass(subj, cand, cand.bars);
  } catch (e) {
    err("render", null, "the schedule threw: " + e.message);
    return out;
  }
  if (!ev1.length) err("silent", null, "the pitched voices produced no events at all");
  if (cand.fill) {
    const bs = subj.deg.length / cand.rate;
    const per = Array.from({ length: cand.bars }, (_, b) =>
      dr1.filter(e => Math.floor(e.t / bs) === b).length);
    if (!(per[cand.bars - 1] > per[0]))
      err("fill-law", "fill", "the fill bar is not busier than bar 1 (" +
          per[cand.bars - 1] + " vs " + per[0] + ") — a fill is a different bar, not a louder one");
    if (!dr1.some(e => e.fill))
      err("fill-law", "fill", "no event is flagged as a fill — drums() only flags a lane " +
          "the fill itself declares");
  }
  if (!cand.nobass && !ba1.length)
    err("bass-silent", "bass", "no bass events — a bass part must not depend on the tune " +
        "being emphatic (§12b)");
  // DETERMINISM. Two renders of one state are byte-identical — the law kernel.js
  // states beside its prng ("reproducibility, not cryptography"). The realistic
  // way to break it from the lab is a rolled `word` closure that keeps dice of
  // its own, so this is not ceremony.
  //
  // ASK THE CLOSURE DIRECTLY, because two renders CANNOT SEE A FLIP-FLOP. The
  // render comparison below aliases: `word` is asked a fixed number of times
  // per render (measured, six for a two-voice candidate — once per voice per
  // section of the walk, not once per voice), so a closure alternating on a
  // period that divides that count hands render two the very same sequence it
  // handed render one, and the two agree while the dice are entirely live.
  // That is not a corner case, it is the exact shape of the failure this check
  // names. So purity is tested where it lives: the same arguments, twice, must
  // give the same answer. `canon` serializes a function by its source, so a
  // list of operators compares as readily as a list of numbers.
  if (typeof cand.word === "function") {
    let impure = false;
    for (let v = 0; v < (cand.voices || 1) && !impure; v++)
      for (let b = 0; b < (cand.bars || 1) && !impure; b++) {
        let a, c;
        try { a = cand.word(v, b); c = cand.word(v, b); } catch (e) { break; }
        if (canon(a) !== canon(c)) impure = true;
      }
    if (impure)
      err("nondeterministic", "word", "the `word` closure answers differently to the " +
          "same question — it holds live dice");
  }
  const twice = canon([K.render(subj, cand, cand.bars), K.drums(subj, cand, cand.bars),
                       K.bass(subj, cand, cand.bars)]);
  if (twice !== canon([ev1, dr1, ba1]))
    err("nondeterministic", null, "two renders of this candidate differ — something in it " +
        "holds live dice");
  return out;
}
const ok = problems => !problems.some(p => p.level === "error");

// ---------------------------------------------------------------------------
// §6. THE BENCH — the whole pass, which is what a UI tab would call
// ---------------------------------------------------------------------------
function bench(parentSpec, opts) {
  opts = opts || {};
  const seed = opts.seed | 0;
  const syn = synthesize(parentSpec, opts);
  const candidate = opts.raw ? syn.candidate : rollAll(syn, seed, opts);
  if (opts.label) candidate.label = opts.label;
  return { ...syn, seed, candidate,
           novelty: novelty(candidate), names: names(syn, seed),
           problems: validate(candidate), rolled: !opts.raw };
}

// ---- reports ---------------------------------------------------------------
const trunc = (s, n) => {
  s = String(s).replace(/\s+/g, " ");
  return s.length > (n || 62) ? s.slice(0, (n || 62) - 1) + "…" : s;
};
function printBench(b) {
  const L = [];
  const say = s => L.push(s);
  say("=".repeat(74));
  say("THE BENCH — " + Object.entries(b.parents).map(([p, w]) => p + " " + w).join(" + ") +
      "   [seed " + b.seed + "]");
  say("=".repeat(74));
  say("");
  say("ARCHITECTURE — what the parents actually carry (INHERITANCE.md: 87% harmony, " +
      "84% realize, 76% rate, 61% drumkit)");
  for (const m of b.manifest) {
    if (m.class === "invent") continue;
    const tag = m.class === "plucked" ? "plucked <- " + m.from
      : m.class === "combined" ? "combined"
      : m.class === "snapped" ? "snapped" : m.class;
    say("  " + m.field.padEnd(11) + " = " + trunc(I.emit(m.value), 42).padEnd(43) +
        " " + tag);
  }
  say("");
  say("THE INVENTION LIST — the material, which is yours (" + b.invention.length + ")");
  for (const i of b.invention)
    say("  " + i.field.padEnd(11) + "   " + i.why);
  say("");
  if (b.rolled) {
    say("ROLLED — a draft at seed " + b.seed + ", repeatable and shareable");
    for (const i of b.invention) {
      const v = b.candidate[i.field];
      if (v === undefined) continue;
      // `word` prints as the TABLE it was rolled from, not as the closure it
      // returned: the closure's source text says how it reads a table and
      // nothing about what is in it, which is the one thing worth seeing.
      const shown = i.field === "word" && v && v.__labTable
        ? "[" + v.__labTable.map(rows =>
            rows.map(ops => (ops.length ? ops.map(sayOf).join(" + ") : "—")).join(" | ")).join("]  [") + "]"
        : I.emit(v);
      say("  " + i.field.padEnd(11) + " = " + trunc(shown, 56));
    }
    say("");
  }
  say("NOVELTY — " + b.novelty.verdict);
  say("  nearest " + b.novelty.nearest + " (" + b.novelty.label + ") at " +
      b.novelty.dist.toFixed(3) + "; the table's own neighbours sit at p10 " +
      b.novelty.thresholds.p10.toFixed(3) + " / median " +
      b.novelty.thresholds.median.toFixed(3));
  say("  next: " + b.novelty.ranked.slice(1).map(r => r.key + " " + r.dist.toFixed(2)).join(", "));
  say("");
  say("NAMES — pick one, or none of them");
  for (const n of b.names) say("  " + n.label.padEnd(22) + n.why);
  say("");
  const errs = b.problems.filter(p => p.level === "error");
  const warns = b.problems.filter(p => p.level === "warn");
  say("VALIDATE — " + (errs.length ? errs.length + " ERROR(S); this cannot be kept"
                                   : "passes every law a hand-written anchor passes") +
      (warns.length ? ", " + warns.length + " warning(s)" : ""));
  for (const p of b.problems)
    say("  [" + p.level + " " + p.code + "] " + (p.field ? p.field + ": " : "") + p.msg);
  return L.join("\n");
}
function printManifest(b) {
  const L = ["| field | class | from | value | note |", "|---|---|---|---|---|"];
  for (const m of b.manifest)
    L.push("| " + m.field + " | " + m.class + " | " + (m.from || "") + " | " +
           trunc(I.emit(m.value), 34) + " | " + (m.note || "") + " |");
  return L.join("\n");
}

// ---- THE PROOF -------------------------------------------------------------
// Pure node, no gate, no render, no browser — the verification budget's own
// shape, and the same posture as inherit.js's `--check`: the tool proves itself
// rather than asking the release suite to do it. Four claims:
//   1. several real parent sets synthesize, roll and VALIDATE clean — including
//      one drawn entirely from the ancestors seated in 777202d, which is the
//      newest data in the table;
//   2. a roll is deterministic — the same (candidate, field, seed) twice is
//      byte-identical, and a different seed is not;
//   3. novelty and naming answer for every one of them;
//   4. validate() REFUSES a deliberately broken candidate, by name.
const PROOF_SETS = [
  { name: "house + techno", parents: { house: 0.6, techno: 0.4 }, seed: 3 },
  { name: "motown + kraftwerk", parents: { motown: 0.55, kraftwerk: 0.45 }, seed: 7 },
  // …entirely from the ancestors that took their seats in 777202d
  { name: "jazz + doowop + skiffle (the new ancestors)",
    parents: { jazz: 0.5, doowop: 0.3, skiffle: 0.2 }, seed: 11 },
  { name: "bodiddley + electro", parents: { bodiddley: 0.5, electro: 0.5 }, seed: 5 },
  { name: "gregorian + dub (nothing in common)",
    parents: { gregorian: 0.5, dub: 0.5 }, seed: 2 },
  { name: "blues alone (one parent)", parents: { blues: 1 }, seed: 9 },
];
function selfTest() {
  const L = []; let bad = 0;
  const claim = (c, m) => { if (!c) { bad++; L.push("  FAIL " + m); } else L.push("  ok   " + m); };
  for (const set of PROOF_SETS) {
    L.push(set.name + "  [seed " + set.seed + "]");
    const b = bench(set.parents, { seed: set.seed });
    const errs = b.problems.filter(p => p.level === "error");
    claim(!errs.length, "validates clean" +
      (errs.length ? " — " + errs.map(e => e.code + " " + e.msg).join("; ") : ""));
    claim(b.invention.length > 0, "the invention list is not empty (" +
      b.invention.map(i => i.field).join(" ") + ")");
    // the machine must NOT have filled the material by pluck
    const plucked = b.manifest.filter(m => m.class === "plucked" && MATERIAL[m.field]);
    claim(!plucked.length, "no material field was plucked from a parent");
    // determinism, twice, per field
    let stable = true, moved = false;
    for (const i of b.invention) {
      const a = roll(b.candidate, i.field, set.seed, b.parents);
      const c = roll(b.candidate, i.field, set.seed, b.parents);
      if (canon(a) !== canon(c)) stable = false;
      if (canon(roll(b.candidate, i.field, set.seed + 1, b.parents)) !== canon(a)) moved = true;
    }
    claim(stable, "every roll is byte-identical at the same seed");
    claim(moved, "a different seed rolls something different");
    claim(!!b.novelty.verdict && b.novelty.dist > 0, "novelty answers: " + b.novelty.verdict);
    claim(b.names.length >= 2, "offers " + b.names.length + " names, never one: " +
      b.names.map(n => n.label).join(", "));
    // the whole candidate is byte-stable end to end
    const again = bench(set.parents, { seed: set.seed });
    claim(canon(b.candidate) === canon(again.candidate), "the whole bench is deterministic");
  }
  // 4. the refusals
  L.push("a deliberately broken candidate");
  const base = bench({ house: 0.6, techno: 0.4 }, { seed: 3 }).candidate;
  const cases = [
    ["empty-material", { ...base, kit: null }, "an empty kit"],
    ["lane", { ...base, kit: { ...base.kit, z: [1, 0, 0, 0] } }, "a lane letter that is not a lane"],
    ["instr", { ...base, instr: "theremin_of_the_mind" }, "an instrument no anchor voices"],
    ["fill-law", { ...base, fill: { s: new Array(16).fill(0) } }, "a fill quieter than bar 1"],
    ["prog-roots", { ...base, prog: (base.prog || base.roots.map(d => ({ d })))
        .map((c, i) => (i === 1 ? { d: (base.roots[1] + 1) % 7 } : c)) },
      "a prog that disagrees with its roots"],
    ["type", { ...base, voices: 2.4 }, "2.4 voices"],
    // a closure that MOVES — and it has to move monotonically, not alternate:
    // a two-state flip called an even number of times per render comes back to
    // the same parity and two renders agree by accident, which is a fact about
    // the test and not about the checker
    ["nondeterministic", { ...base, word: (() => { let n = 0; return () => [K.transpose(n++)]; })() },
      "a word closure holding live dice"],
  ];
  for (const [code, broken, what] of cases) {
    const ps = validate(broken, { force: true });
    claim(ps.some(p => p.level === "error" && p.code === code),
      "refuses " + what + " with " + code +
      (ps.some(p => p.level === "error" && p.code === code) ? ""
        : " — got [" + ps.filter(p => p.level === "error").map(p => p.code).join(",") + "]"));
  }
  claim(ok(validate(base)), "…and still keeps the good one");
  L.push("");
  L.push(bad ? bad + " FAILED" : "all claims hold.");
  return { text: L.join("\n"), bad };
}

const api = { MATERIAL, CORE_MATERIAL, ORDER, ELSEWHERE, PALETTE,
              synthesize, inventionList, roll, rollAll, ROLLERS, targets,
              novelty, space, featuresOfCandidate, names, placeYear,
              validate, ok, bench, printBench, printManifest, selfTest };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = n => argv.find(a => a.startsWith("--" + n + "="));
  const num = (n, d) => (flag(n) ? Number(flag(n).split("=")[1]) : d);
  if (argv.includes("--self-test")) {
    const r = selfTest();
    console.log(r.text);
    process.exit(r.bad ? 1 : 0);
  }
  const spec = {};
  for (const a of argv.filter(x => !x.startsWith("--"))) {
    const [k, w] = a.split(":");
    spec[k] = w === undefined ? 1 : Number(w);
  }
  if (!Object.keys(spec).length) {
    console.log("usage: node nukernel/lab.js <genre>[:weight] …  [--seed=N] " +
                "[--label=\"Sheffield 1984\"] [--manifest] [--raw] [--json]");
    console.log("       node nukernel/lab.js --self-test");
    process.exit(2);
  }
  const b = bench(spec, { seed: num("seed", 1),
                          label: flag("label") ? flag("label").split("=").slice(1).join("=") : null,
                          raw: argv.includes("--raw") });
  if (argv.includes("--json")) {
    // values go out as their CANONICAL serialization, not as JSON: half the
    // architecture is closures, and JSON.stringify silently drops a function —
    // a manifest that loses `realize` is a manifest that lies about it
    console.log(JSON.stringify({
      manifest: b.manifest.map(m => ({ ...m, value: canon(m.value) })),
      invention: b.invention, novelty: b.novelty, names: b.names,
      problems: b.problems }, null, 2));
  } else if (argv.includes("--manifest")) {
    console.log(printManifest(b));
  } else {
    console.log(printBench(b));
  }
} else module.exports = api;
