#!/usr/bin/env node
/* nukernel/vocabulary.js — THE VOCABULARY, EXTRACTED FROM THE RUNNING BOX.

   (Paul, 2026-08-23, settling both the names and the method: "Call it an
   attribute grammar and use vocabulary as the word for schema. Record and
   score both good." … "I don't want you to rewrite everything by hand
   though. Everything is data. CONVERT DATA BY CONVERTING DATA.")

   THE NAMES, used here and everywhere downstream:

     attribute grammar  the system: legal structures, attributes computed
                        over them, and a dependency relation between the
                        attributes — answers → derived fields (genre, lens,
                        bpm) → sections → events.
     vocabulary         WHAT CAN BE SAID. Not a schema: a schema validates a
                        document against a fixed shape, and this domain is
                        DEPENDENT everywhere — a chant's keyboard-job list is
                        [drone], one word, where a jazz date's is five. A
                        vocabulary carries the dependency.
     record             what was said — the document (band-kit's model).
     score              what gets played — the event list (toSong).
     effect graph       what each field WRITES and what READS it. A property
                        OF the vocabulary, not a fourth file.

   THE METHOD: EXTRACT, DO NOT TRANSCRIBE. There are 157 questions on one
   record and 8 of them are declared as data today (askable.js). Hand-typing
   the other 149 into a file would create a fourth source of truth that rots
   the first time somebody edits a kit file — the exact bug being removed. So
   this is a PROGRAM THAT READS THE RUNNING SYSTEM and emits the vocabulary
   as data. The box already knows all of this; it could not say it.

   HOW IT WORKS, in four passes:

     1  WALK      every record the catalog calls (30) × every seat × every
                  question, plus 30 dice-rolled records — where the arranger's
                  conditional rows actually exist, since the per-role calls a
                  form unlocks and the second theme's whole interview are not
                  on a record nobody has spoken to. Each model is walked twice:
                  `seatDecisions` for the row as declared, and `asked` for the
                  same row AFTER the pruner, which is the offer a person is
                  shown and the thing that has to be reproduced.
     2  WRITES    apply each option to the record and DIFF, as dotted paths.
                  Reuses the shape of the prior art rather than reinventing
                  it: `songRow`/`SONGSIG` in band-kit.js already derives which
                  signature a row can move by running the row's own applies
                  and diffing, and this is the same measurement taken over
                  the whole record instead of one signature. Ledger paths
                  (`*.answers.*`, `song.seeded.*`, `knobs.__said.*`) are
                  separated from SUBSTANTIVE ones, because a row whose only
                  write is its own ledger entry has said nothing about the
                  music.
     3  REACHES   the same diff at the SCORE level — toSong before and after
                  — collapsed over the section index. That is the read half
                  of the effect graph, and it is the half nothing in this
                  tree wrote down.
     4  CONDITION when the question exists at all, and when each option is
                  offered, fitted against features read off the record and
                  its genre. What reduces to a rule is reported as a rule;
                  what does not is reported as OPAQUE with the reason, which
                  is the most valuable thing in the file.
     5  VERIFY    every rule is then RUN — the offer for each seat is computed
                  from the emitted rows alone and held against the box's own,
                  word for word and flag for flag. A row that disagrees
                  anywhere is marked `regenerates: false` with the
                  disagreement recorded, so the file never claims a row it
                  cannot reproduce. And it is held twice: on the models the
                  rules were fitted to, and on twenty records drawn from a
                  different seed that the fit never saw — because a two-field
                  condition that happens to separate thirty records will
                  separate them again, and only the second pass can tell a law
                  from a coincidence.

   THE HONEST BOUNDARY. A groove is content, a tune is music, form and meter
   RE-DERIVE rather than assign. Rows like that are marked `opaque` or
   `computed` with the reason recorded. A vocabulary that lies about them is
   worse than one that names them.

   NODE ONLY, and deliberately so: this is a tool, not a module the page
   loads. It sits in nukernel/ because it is about nukernel, it is in no
   script tag in index.html and in no service-worker list, and nothing in the
   running box requires it. What ships beside the page is its OUTPUT,
   nukernel/vocabulary.json.

   Pure and re-runnable:  node nukernel/vocabulary.js [--out FILE] [--rolls N]
                                                      [--holdout N] [--no-reach]
   The proof lives in test/unit/vocabulary.test.js, which regenerates the
   offering from this file's output alone and holds it against the live box. */
"use strict";

const Band = require("./band-kit.js");
const { MODES } = require("./genres.js");
const Ask = require("./askable.js");

/* ---------- the models we walk ----------------------------------------- */
const on = () => ({ ...Band.blank(), on: true });
Band.toSong(on(), MODES);                       // band-kit remembers MODES
const RECORDS = Object.values(Band.GENRES).map((g) => g.w);
const called = (rec) => Band.answer(on(), "arranger", "genre", rec);
// seeded, so the thirty rolls are the same thirty every run — the same
// generator every-head.test.js uses, for the same reason
const roller = (s0) => { let s = s0 >>> 0;
  return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; }; };

/* ---------- dotted diff: THE WRITES ------------------------------------
   An array is a LEAF. A drum lane is sixteen numbers that mean one thing,
   and `drums.kit.h.7` is not a field anybody writes — it is a place inside
   a value. Functions are skipped: a genre carries `part`/`reg`/`realize` as
   closures and they compare unequal every time. */
const isLeaf = (v) => v === null || typeof v !== "object" || Array.isArray(v);
const J = (v) => { try { return JSON.stringify(v === undefined ? null : v); }
                   catch (e) { return "?"; } };
function diffInto(a, b, prefix, out, depth) {
  if (a === b) return;
  if (typeof a === "function" || typeof b === "function") return;
  if (isLeaf(a) || isLeaf(b) || depth <= 0) {
    if (J(a) !== J(b)) out.push(prefix);
    return;
  }
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})]))
    diffInto((a || {})[k], (b || {})[k], prefix ? prefix + "." + k : k, out, depth - 1);
}
const diffPaths = (a, b, depth) => { const out = []; diffInto(a, b, "", out, depth == null ? 6 : depth); return out.sort(); };

// the ledger: who said what, and that a hand said it. Not music.
const LEDGER = /(^|\.)answers(\.|$)|^song\.seeded(\.|$)|^song\.knobs\.__said(\.|$)/;
const isLedger = (p) => LEDGER.test(p);
// read a dotted path off a record
const at = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);

/* ---------- the score, as dotted paths ---------------------------------
   The section INDEX is collapsed to `§`, because "this row moves the box
   level of every section" is a fact about the row and "…of section 3" is a
   fact about one record. Depth 3 keeps it to the genre's own fields. */
function scorePaths(m) {
  let song;
  try { song = Band.toSong(m, MODES); } catch (e) { return null; }
  const out = new Map();
  const walk = (v, p, depth) => {
    if (typeof v === "function") return;
    if (isLeaf(v) || depth <= 0) { out.set(p, J(v)); return; }
    for (const k of Object.keys(v)) walk(v[k], p ? p + "." + k : k, depth - 1);
  };
  (song || []).forEach((sec) => walk(sec, "§", 4));
  return out;
}
function scoreDiff(a, b) {
  if (!a || !b) return null;
  const out = new Set();
  for (const k of new Set([...a.keys(), ...b.keys()]))
    if (a.get(k) !== b.get(k)) out.add(k);
  return [...out].sort();
}

/* ---------- the offer, as a person is shown it -------------------------
   Byte-for-byte the strings test/unit/offer-identity.test.js fingerprints,
   so "the extraction regenerates the offering" is a string comparison
   against the acceptance test's own definition of the offering. */
const optSig = (o) => [o.w, o.answered ? "a" : "", o.active ? "*" : "", o.dead ? "x" : ""].join("");
const askSig = (d) => d.id + "(" + d.opts.map(optSig).join("·") + ")";

/* ---------- WHERE A ROW IS DECLARED ------------------------------------
   Grepped, not tabulated: the file that contains this row's own id beside an
   `ask:` or a `field:` is the file it lives in, and a row the grep cannot
   place is reported as such rather than guessed. */
const fs = require("fs"), path = require("path");
const HERE = __dirname;
const SRC = fs.readdirSync(HERE).filter((f) => /\.js$/.test(f) && f !== "vocabulary.js")
  .map((f) => ({ f: "nukernel/" + f, t: fs.readFileSync(path.join(HERE, f), "utf8") }));
const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// THE ASK IS THE BEST KEY, and it is the one every row has: a question's
// words are a string literal in the file that asks it, while its id may be
// assembled (`FIELDS3` builds `when`/`where`/`venue` out of a pair table, and
// `pitchedChair` builds `instr`/`job`/`reg` out of a spec). So the text is
// tried first and the id second, and a row neither finds is reported as
// unplaced rather than guessed at.
const declaredIn = (id, ask) => {
  const tries = [];
  if (ask) tries.push(new RegExp('"' + esc(ask) + '"'));
  const bare = String(id).replace(/^knob:/, "").replace(/:.*$/, "");
  tries.push(new RegExp('(id|field):\\s*"' + esc(bare) + '"'));
  tries.push(new RegExp('"' + esc(bare) + '"'));
  for (const pat of tries) {
    const hit = SRC.filter((s) => pat.test(s.t)).map((s) => s.f);
    if (hit.length === 1) return hit[0];
    if (hit.length > 1) return hit.join(" + ");
  }
  return null;
};

/* ======================================================================
   PASS 1 - THE WALK: which models, and where a row lives
   ====================================================================== */
const SEATFILE = { arranger: "nukernel/band-kit.js", drums: "nukernel/drums-kit.js",
  bass: "nukernel/bass-kit.js", keys: "nukernel/keys-kit.js",
  guitar: "nukernel/guitar-kit.js", voice: "nukernel/vocal-kit.js",
  engineer: "nukernel/band-kit.js" };
// a row's home: its own seat's file when the row is written there, the shared
// chair engine when it is not (the three pitched chairs' instr/job/reg/panel
// /pedal rows are BUILT by chair.js pitchedChair out of the kit's spec, which
// is why keys-kit, guitar-kit and vocal-kit carry no `head:` of their own and
// are not missing one either -- they declare `heads:` on the spec instead).
function homeOf(id, seat, ask) {
  const all = declaredIn(id, ask);
  if (!all) return null;
  const mine = SEATFILE[seat];
  const hits = all.split(" + ");
  if (hits.includes(mine)) return mine;
  if (String(id).startsWith("knob:")) return "nukernel/askable.js";
  return hits.length === 1 ? hits[0] : "nukernel/chair.js";
}

function modelsOf(rolls, seed, tag) {
  const out = seed ? [] : RECORDS.map((rec) => ({ label: rec, kind: "called", m: called(rec) }));
  const rnd = roller(seed || 20260823);
  for (let i = 0; i < rolls; i++) {
    const m = Band.randomSong(rnd);
    out.push({ label: (tag || "rolled") + " #" + (i + 1) + " (" + (m.song.genre || "?") + ")",
               kind: "rolled", m });
  }
  return out;
}

/* ---------- COMPARING TWO VALUES OF A FIELD ----------------------------
   Strictly, and then the one way this box is genuinely loose: a field the
   record has NEVER WRITTEN reads back as undefined, and the word that means
   "nothing here" writes 0 or null. `touch` is the case that taught it -- a
   jazz date carries `drums.touch === null` and the word "on the grid" writes
   `touch: 0`, and the chair's own `is` says those are the same drummer. So a
   BLANK-TOLERANT comparison is offered beside the strict one, and which of
   the two a row uses is MEASURED against the flag the box itself sets, never
   assumed. A row neither reproduces is marked opaque. */
const strictEq = (a, b) => J(a) === J(b);
const blank = (v) => v == null || v === 0 || v === false || v === "";
const looseEq = (a, b) => strictEq(a, b) || (blank(a) && blank(b));
const EQ = { strict: strictEq, blank: looseEq, default: looseEq };

/* ...and the third reading, which is a fact about this box worth writing
   down: A RECORD THAT HAS SAID NOTHING IS STILL ON AN ANSWER. `song.arc` is
   absent until somebody moves it and the box lights "it stays where it is"
   anyway, because the DEFAULT is a word, not an empty field. So a row may
   declare `defaultWord`: the word that is lit while the row's own fields are
   unwritten. Fitted, never assumed -- and a row whose default is itself
   derived from the genre (how long is a solo? four bars here, eight there)
   has no single default word and stays opaque, which is the true answer. */
const litUnder = (how, o, m) => {
  const sets = o.sets || {};
  const ks = Object.keys(sets);
  if (!ks.length) return false;
  return ks.every((p) => EQ[how](at(m, p), sets[p]));
};
const isLit = (q, o, m) => litUnder(q.activeBy, o, m) ||
  (q.activeBy === "default" && q.defaultWord === o.w &&
   Object.keys(o.sets || {}).length > 0 &&
   Object.keys(o.sets).every((p) => at(m, p) == null));

/* ======================================================================
   PASS 2 - WRITES: apply the option, diff the record
   ====================================================================== */
function writesOf(m, seat, d, w) {
  const m2 = Band.answer(m, seat, d.id, w);
  const all = diffPaths(m, m2);
  return { m2, sub: all.filter((p) => !isLedger(p)), led: all.filter(isLedger) };
}

/* ======================================================================
   PASS 4 - THE CONDITION: features a rule may be made of
   Every feature is a fact the record already carries -- a genre field, a
   shape, a role, a chair's standing answer -- so a rule made of them is a
   rule the runtime could evaluate on the day it reads this file.
   ====================================================================== */
function featuresOf(m) {
  const f = {};
  const g = Band.genreOf(m) || {};
  f["record.named"] = !!m.song.genre;
  f["record.hasShape"] = !!(m.song.form || (m.song.secs && m.song.secs.length));
  f["record.themeB"] = !!(m.ideaB && m.ideaB.on);
  f["record.boxesEdited"] = !!Band.boxesEdited(m);
  f["record.minor"] = !!m.song.minor;
  f["record.meter"] = m.song.meter || "four";
  f["record.form"] = m.song.form || null;
  f["record.space"] = m.song.space || null;
  for (const r of ["verse", "chorus", "bridge", "solo", "head", "intro", "outro"]) {
    f["role." + r] = (Band.rolesIn(m) || []).includes(r);
    // ...and whether that role's changes were AUTHORED bar by bar, which is
    // what silences its length and its lean (band-kit `chgxOf`)
    f["authored." + r] = !!((m.song.chgx || {})[r]);
  }
  f["role.solo"] = f["role.solo"] || Band.secsOf(m).includes("solo");
  for (const s of Band.SEATS) if (m[s] && typeof m[s] === "object")
    f["seat." + s + ".on"] = !!m[s].on;
  for (const k of Object.keys(g)) {
    const v = g[k];
    if (typeof v === "function") continue;
    if (Array.isArray(v)) {
      f["genre." + k + ".n"] = v.length;
      // ...AND THE LIST ITSELF, when it is short enough to be an identity.
      // `genre.grooves` is not a number, it is WHICH GROOVES THIS RECORD
      // KNOWS, and a dependent domain keyed on its length is keyed on noise.
      const j = J(v);
      if (j.length <= 400) f["genre." + k] = j;
      continue;
    }
    if (v === null || typeof v !== "object") f["genre." + k] = v;
  }
  // the chairs' own standing answers and standing state, which is what a
  // dependent option list actually keys on: the drummer's FAMILY decides
  // which grooves are words at all
  for (const s of ["drums", "bass", "keys", "guitar", "voice"]) {
    for (const [k, v] of Object.entries(((m[s] || {}).answers) || {}))
      f["said." + s + "." + k] = v;
    for (const k of ["fam", "job", "instr", "reg", "style", "pedal", "drumkit"])
      if ((m[s] || {})[k] !== undefined) f["is." + s + "." + k] = (m[s] || {})[k];
  }
  return f;
}

/* fit: is there a single feature whose truth is exactly this set of models?
   Reported as a RULE when there is, and as `opaque` when there is not, with
   the models that break it -- because that list is the finding. */
function fitRule(present, feats, labels) {
  const n = labels.length;
  let all = true, none = true;
  for (let i = 0; i < n; i++) (present[i] ? none = false : all = false);
  if (all) return { rule: "always" };
  if (none) return { rule: "never" };
  const keys = new Set();
  feats.forEach((f) => Object.keys(f).forEach((k) => keys.add(k)));
  const cands = [];
  for (const k of keys) {
    let eq = true, neq = true;
    for (let i = 0; i < n; i++) {
      const v = !!feats[i][k];
      if (v !== present[i]) eq = false;
      if (v === present[i]) neq = false;
      if (!eq && !neq) break;
    }
    if (eq) cands.push({ rule: "when", is: k });
    else if (neq) cands.push({ rule: "when", not: k });
    const vals = new Set();
    for (let i = 0; i < n; i++) if (present[i]) vals.add(J(feats[i][k]));
    if (vals.size === 1 && [...vals][0] !== "null" && [...vals][0] !== "false") {
      let ok = true;
      for (let i = 0; i < n; i++)
        if ((J(feats[i][k]) === [...vals][0]) !== present[i]) { ok = false; break; }
      if (ok) cands.push({ rule: "when", eq: k, value: JSON.parse([...vals][0]) });
    }
  }
  if (cands.length) {
    // prefer a rule about the RECORD or its genre over one about a chair's
    // standing answer -- both are true, one explains
    const rank = (c) => { const k = c.is || c.not || c.eq;
      return k.startsWith("record.") ? 0 : k.startsWith("genre.") ? 1
        : k.startsWith("role.") ? 2 : k.startsWith("seat.") ? 3 : 4; };
    cands.sort((a, b) => rank(a) - rank(b));
    return { ...cands[0], alternatives: cands.length - 1 };
  }
  /* ...AND TWO FEATURES AT ONCE, because the real conditions in this box are
     two-place: a length is asked for a role the record HAS and whose changes
     nobody has authored bar by bar (band-kit `lenDecisions`: hasShape, then
     rolesIn, then `!chgxOf`). Only fields that vary are paired, and a pair is
     accepted only when no single field explains the row -- and the rule is
     then held against models it was not fitted on (`verify`), which is what
     keeps a coincidence from being written down as a law. */
  const varying = [...keys].filter((k) => {
    const vs = new Set();
    for (let i = 0; i < n; i++) vs.add(J(feats[i][k]));
    return vs.size > 1;
  });
  for (let x = 0; x < varying.length; x++)
    for (let y = x + 1; y < varying.length; y++)
      for (const sx of [true, false])
        for (const sy of [true, false]) {
          let ok = true;
          for (let i = 0; i < n && ok; i++) {
            const v = (!!feats[i][varying[x]] === sx) && (!!feats[i][varying[y]] === sy);
            if (v !== present[i]) ok = false;
          }
          if (ok) return { rule: "both",
            a: sx ? { is: varying[x] } : { not: varying[x] },
            b: sy ? { is: varying[y] } : { not: varying[y] } };
        }
  const onList = labels.filter((_, i) => present[i]);
  return { rule: "opaque", on: onList.length, of: n,
           examples: onList.slice(0, 4),
           missing: labels.filter((_, i) => !present[i]).slice(0, 4) };
}

/* fit a DEPENDENT DOMAIN: a word list that is a function of one feature.
   This is the thing a schema cannot say and a vocabulary must -- a chant's
   keyboard-job list is [drone], one word, where a jazz date's is five, and
   the difference is not noise, it is the genre saying which words exist. */
function fitDomain(shapes, feats, labels, present) {
  const keys = new Set();
  feats.forEach((f) => Object.keys(f).forEach((k) => keys.add(k)));
  let best = null;
  for (const k of keys) {
    const map = new Map();
    let ok = true;
    for (let i = 0; i < labels.length && ok; i++) {
      if (!present[i]) continue;
      const kv = J(feats[i][k]), wv = shapes[i];
      if (wv == null) continue;
      if (map.has(kv)) { if (map.get(kv) !== wv) ok = false; }
      else map.set(kv, wv);
    }
    if (!ok || map.size < 1) continue;
    if (!best || map.size < best.map.size) best = { k, map };
  }
  if (best) return { on: best.k,
           cases: Object.fromEntries([...best.map.entries()]
             .map(([kv, wv]) => [kv, JSON.parse(wv)])) };
  /* ...AND ON TWO FIELDS, because the interesting dependent domains are
     genuinely two-place: which grooves you may play is the record's own list
     AND the family you just chose, and either alone explains nothing. Only
     fields that VARY are paired, which is what keeps this from being a
     search over three hundred squared. */
  const varying = [...keys].filter((k) => {
    const vs = new Set();
    for (let i = 0; i < labels.length; i++) if (present[i]) vs.add(J(feats[i][k]));
    return vs.size > 1 && vs.size < labels.length;
  });
  let best2 = null;
  for (let x = 0; x < varying.length; x++)
    for (let y = x + 1; y < varying.length; y++) {
      const map = new Map();
      let ok = true;
      for (let i = 0; i < labels.length && ok; i++) {
        if (!present[i] || shapes[i] == null) continue;
        const kv = J([feats[i][varying[x]], feats[i][varying[y]]]);
        if (map.has(kv)) { if (map.get(kv) !== shapes[i]) ok = false; }
        else map.set(kv, shapes[i]);
      }
      if (ok && (!best2 || map.size < best2.map.size))
        best2 = { k: [varying[x], varying[y]], map };
    }
  if (!best2) return null;
  return { on: best2.k,
           cases: Object.fromEntries([...best2.map.entries()]
             .map(([kv, wv]) => [kv, JSON.parse(wv)])) };
}

/* ---------- THE ORDER OF A SEAT'S QUESTIONS ----------------------------
   NOT an index. A row's position in `seatDecisions` shifts with the rows
   that exist on THIS record -- the per-role calls a form unlocks push the
   tune's own questions down -- so an absolute index disagrees with itself
   across records and says nothing. What is stable is the RELATIVE order, and
   thirty records each give a total order over their own subset. Merge them:
   count every "a came before b" and topologically sort. A pair that
   disagrees is a real finding and is returned as a cycle rather than
   smoothed over. */
function rankOf(sequences) {
  const ids = [];
  const before = new Map();       // "a b" -> count
  for (const seq of sequences) {
    seq.forEach((a) => { if (!ids.includes(a)) ids.push(a); });
    for (let i = 0; i < seq.length; i++)
      for (let j = i + 1; j < seq.length; j++)
        before.set(seq[i] + " " + seq[j], (before.get(seq[i] + " " + seq[j]) || 0) + 1);
  }
  const conflicts = [];
  for (const key of before.keys()) {
    const [a, b] = key.split(" ");
    if (before.has(b + " " + a)) conflicts.push(a + " / " + b);
  }
  // Kahn, with first-seen order as the tie-break so the emitted list reads
  // the way the box reads
  const indeg = new Map(ids.map((x) => [x, 0]));
  const adj = new Map(ids.map((x) => [x, []]));
  for (const key of before.keys()) {
    const [a, b] = key.split(" ");
    if (before.has(b + " " + a)) continue;      // a conflicting pair binds nothing
    adj.get(a).push(b);
    indeg.set(b, indeg.get(b) + 1);
  }
  const out = [];
  const ready = ids.filter((x) => indeg.get(x) === 0);
  while (ready.length) {
    ready.sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
    const x = ready.shift();
    out.push(x);
    for (const y of adj.get(x)) { indeg.set(y, indeg.get(y) - 1); if (indeg.get(y) === 0) ready.push(y); }
  }
  for (const x of ids) if (!out.includes(x)) out.push(x);   // any cycle, at the end
  return { order: out, conflicts: [...new Set(conflicts)] };
}

/* ======================================================================
   THE EXTRACTION
   ====================================================================== */
function extract(opt) {
  opt = opt || {};
  const rolls = opt.rolls == null ? 30 : opt.rolls;
  const models = opt.models || modelsOf(rolls);
  const labels = models.map((x) => x.label);
  const feats = models.map((x) => featuresOf(x.m));
  const N = models.length;
  const rows = new Map();
  const seqs = {};                       // seat -> [ [id,...] per model ]
  Band.SEATS.forEach((s) => { seqs[s] = []; });

  models.forEach((mm, mi) => {
    for (const seat of Band.SEATS) {
      const ds = Band.seatDecisions(mm.m, seat);
      seqs[seat].push(ds.map((d) => d.id));
      ds.forEach((d) => {
        const key = seat + " " + d.id;
        let a = rows.get(key);
        if (!a) {
          a = { seat, id: d.id, heads: new Set(), asks: new Set(), flags: new Set(),
                present: new Array(N).fill(false),
                shapes: new Array(N).fill(null),
                ansObs: new Array(N).fill(null),
                optWrite: new Map(), optActive: new Map(), optVals: new Map(),
                paths: new Set(), ledger: new Set(),
                distinctOn: 0, seenOn: 0, reach: null };
          rows.set(key, a);
        }
        a.present[mi] = true;
        a.ansObs[mi] = d.answered != null ? d.answered : null;
        if (d.head) a.heads.add(d.head);
        a.asks.add(d.ask || d.who || d.id);
        for (const fl of ["three", "cheap", "multi", "color", "rack"]) if (d[fl]) a.flags.add(fl);
        a.shapes[mi] = J(d.opts.map((o) => o.w));

        const m2s = [], subs = [];
        for (const o of d.opts) {
          const r = writesOf(mm.m, seat, d, o.w);
          m2s.push(r.m2); subs.push(r.sub);
          r.sub.forEach((p) => a.paths.add(p));
          r.led.forEach((p) => a.ledger.add(p));
        }
        const union = [...new Set([].concat(...subs))].sort();
        const vmap = (mx) => { const o = {}; for (const p of union) o[p] = J(at(mx, p)); return o; };
        const vals = m2s.map(vmap);
        d.opts.forEach((o, i) => {
          if (!a.optWrite.has(o.w)) {
            a.optWrite.set(o.w, new Set()); a.optActive.set(o.w, []);
            a.optVals.set(o.w, new Map());
          }
          a.optWrite.get(o.w).add(J(vals[i]));
          a.optActive.get(o.w).push({ mi, active: !!o.active });
          // ...and PER PATH, so an exception can name the field that moves
          const pv = a.optVals.get(o.w);
          for (const [pp, vv] of Object.entries(vals[i])) {
            if (!pv.has(pp)) pv.set(pp, new Set());
            pv.get(pp).add(vv);
          }
        });
        a.seenOn++;
        if (new Set(vals.map(J)).size === d.opts.length) a.distinctOn++;
      });
    }
  });

  /* ---------- PASS 3, sampled: WHAT READS IT --------------------------
     The score diff is a whole render per option, so it is measured on ONE
     record per row (the first that has it) rather than on all of them -- and
     the sample is recorded beside the answer so nobody reads it as a sweep. */
  if (!opt.noReach) {
    for (const a of rows.values()) {
      const mi = a.present.findIndex(Boolean);
      if (mi < 0) continue;
      const m = models[mi].m;
      const d = Band.seatDecisions(m, a.seat).find((x) => x.id === a.id);
      if (!d) continue;
      const base = scorePaths(m);
      const hit = new Set();
      for (const o of d.opts.slice(0, opt.reachOpts || 6)) {
        const dd = scoreDiff(base, scorePaths(Band.answer(m, a.seat, a.id, o.w)));
        (dd || []).forEach((p) => hit.add(p));
      }
      a.reach = { on: labels[mi], paths: [...hit].sort() };
    }
  }

  /* ---------- fold each accumulator into a vocabulary row -------------- */
  const ranks = {};
  Band.SEATS.forEach((s) => { ranks[s] = rankOf(seqs[s]); });
  const out = [];
  for (const a of rows.values()) {
    const words = [...a.optWrite.keys()];
    const one = (s) => (s.size === 1 ? [...s][0] : null);
    const shapes = [...new Set(a.shapes.filter(Boolean))];
    const exists = fitRule(a.present, feats, labels);

    /* WHERE THE STANDING ANSWER LIVES, fitted rather than assumed. Four
       chairs keep it in four places -- a chair's own `answers` ledger, the
       song's, the desk's `eng.<id>`, the knobs' `__said` -- and the honest
       way to say which is to look for the path that holds the word this row
       reported as answered, on every record it was seen on. */
    let answeredAt = null;
    for (const p of [...a.ledger, ...a.paths]) {
      let ok = true;
      for (let i = 0; i < N && ok; i++)
        if (a.present[i] && J(at(models[i].m, p)) !== J(a.ansObs[i])) ok = false;
      if (ok) { answeredAt = p; break; }
    }

    const options = words.map((w) => {
      const wm = a.optWrite.get(w);
      const sets = wm.size === 1 ? Object.fromEntries(Object.entries(JSON.parse([...wm][0]))
        .map(([p, v]) => [p, tryParse(v)])) : null;
      return { w, sets, constant: wm.size === 1, shapes: wm.size };
    });
    const constantWrites = options.every((o) => o.constant);
    // WHICH FIELD IS THE ONE THAT MOVES. A row is opaque because of specific
    // paths, and naming them is the difference between "not declarative" and
    // a finding somebody can act on.
    const varies = [...new Set([].concat(...words.map((w) =>
      [...a.optVals.get(w).entries()].filter(([, vs]) => vs.size > 1).map(([pp]) => pp))))].sort();

    /* WHICH WORD IS LIT, and by which comparison. Measured against the flag
       the box sets: the strict reading first, then the blank-tolerant one. */
    let activeBy = null, defaultWord = null;
    if (constantWrites) {
      const tryWith = (how, dw) => {
        const probe = { activeBy: how, defaultWord: dw };
        for (const o of options)
          for (const obs of a.optActive.get(o.w))
            if (isLit(probe, o, models[obs.mi].m) !== obs.active) return false;
        return true;
      };
      for (const how of ["strict", "blank"])
        if (tryWith(how, null)) { activeBy = how; break; }
      if (!activeBy)
        for (const o of options)
          if (tryWith("default", o.w)) { activeBy = "default"; defaultWord = o.w; break; }
    }

    const domain = shapes.length === 1
      ? { kind: "fixed", words: JSON.parse(shapes[0]) }
      : (() => {
          const fit = fitDomain(a.shapes, feats, labels, a.present);
          const base = { kind: "dependent", shapes: shapes.length,
                         words: [...new Set([].concat(...shapes.map(JSON.parse)))] };
          /* A DEPENDENT DOMAIN'S KEY IS A MEASURED CORRELATE, NOT A PROOF OF
             CAUSE. `keys/instr` keyed on `genre.keys` is the record's own
             list of keyboards and is plainly the reason; a key with nearly
             one case per record is closer to a memo than a rule, and the only
             thing standing behind either is that the fit is held against
             twenty records it never saw (`verify`, the held-out pass). The
             ratio is printed so a reader can tell which kind they are looking
             at rather than having to trust the word "rule". */
          return fit ? { ...base, on: fit.on, cases: fit.cases,
            fit: { cases: Object.keys(fit.cases).length,
                   ofModels: a.present.filter(Boolean).length,
                   note: "a measured correlate held against unseen records, " +
                         "not a proof of cause; the closer cases is to " +
                         "ofModels the more this is a lookup" } } : base;
        })();

    out.push({
      id: a.id, seat: a.seat,
      head: one(a.heads) || (a.heads.size ? [...a.heads] : null),
      ask: one(a.asks) || [...a.asks][0],
      declaredIn: homeOf(a.id, a.seat, one(a.asks)),
      flags: [...a.flags],
      rank: ranks[a.seat].order.indexOf(a.id),
      exists, answeredAt, activeBy, defaultWord,
      seen: { on: a.present.filter(Boolean).length, of: N },
      domain,
      writes: [...a.paths].sort(),
      ledger: [...a.ledger].sort(),
      reaches: a.reach ? a.reach.paths : null,
      reachSampledOn: a.reach ? a.reach.on : null,
      options, constantWrites, varies,
      distinctWrites: a.distinctOn === a.seenOn ? "always"
        : a.distinctOn === 0 ? "never" : a.distinctOn + "/" + a.seenOn,
    });
  }
  const seatRank = (s) => Band.SEATS.indexOf(s);
  out.sort((x, y) => (seatRank(x.seat) - seatRank(y.seat)) || (x.rank - y.rank));
  return { models: labels, questions: out,
           orderConflicts: Object.fromEntries(Band.SEATS
             .filter((s) => ranks[s].conflicts.length)
             .map((s) => [s, ranks[s].conflicts])) };
}
const tryParse = (s) => { try { return JSON.parse(s); } catch (e) { return s; } };

/* the facts a SECTION question's condition may be made of: the record's, plus
   the section's own -- and the section's own are READ OFF `partOf`, which is
   the DERIVED section (what was said, over what the record assumes), not the
   raw `m.per[i]`. That is not a cheat, it is the middle layer of the
   attribute grammar showing itself: a called record has already decided who
   takes the tune in section 0, nobody said it, and the box asks "how does it
   come back?" because of that decision and not because of a field. The
   vocabulary names the derived attribute it depends on rather than pretending
   the dependency is on the document. */
const sectionOf = (m, i) => { try { return Band.partOf(m, i) || {}; } catch (e) { return {}; } };
const sectionFeaturesOf = (m, i, role) => {
  const per = sectionOf(m, i);
  const f = { ...featuresOf(m),
    "section.role": role == null ? null : role,
    "section.at": i, "section.first": i === 0,
    "section.hasIdea": !!(per.idea && per.idea !== "no") };
  for (const k of ["idea", "back", "theme", "drums", "keys", "guitar", "voice",
                   "bass", "pipe", "mix", "move", "out"])
    f["section." + k] = per[k] == null ? null : per[k];
  return f;
};

/* ======================================================================
   THE SECTION VOCABULARY
   A section question is not a seat question: it has no `head` and no `ask`,
   it has a `who` (the label the box prints), its answers are KEYS into a
   table rather than words with applies, and it is answered through
   `setSection` onto `m.per[i]`. Same passes, different door.
   ====================================================================== */
function extractSections(opt) {
  opt = opt || {};
  const recs = opt.records || RECORDS;
  const rows = new Map();
  const labels = [], feats = [], seen = [];
  recs.forEach((rec) => {
    const m = called(rec);
    let song = [];
    try { song = Band.toSong(m, MODES) || []; } catch (e) { song = []; }
    song.forEach((sec, i) => {
      labels.push(rec + " section " + i + " (" + (sec.role || "?") + ")");
      feats.push(sectionFeaturesOf(m, i, sec.role || null));
      seen.push({ m, i });
    });
  });
  const N = labels.length;
  const seqs = [];
  seen.forEach((s, si) => {
    let raw = [];
    try { raw = Band.sectionAsks(s.m, s.i, true) || []; } catch (e) { raw = []; }
    seqs.push(raw.map((a) => a.id));
    raw.forEach((a) => {
      let acc = rows.get(a.id);
      if (!acc) {
        acc = { id: a.id, whos: new Set(), present: new Array(N).fill(false),
                shapes: new Array(N).fill(null), optWrite: new Map(),
                keys: new Map(), paths: new Set(), defaults: new Set(),
                optAns: new Map(),
                distinctOn: 0, seenOn: 0, reach: null };
        rows.set(a.id, acc);
      }
      acc.present[si] = true;
      acc.whos.add(a.who);
      acc.shapes[si] = J(a.opts.map((o) => o.w));
      // WHICH KEY A SECTION IS ON WHEN NOBODY HAS SAID ANYTHING. Every one
      // of these rows lights a word on an untouched section ("same as
      // before", "none", "no"), and that default is a fact of the row, not
      // of the section -- so it is read off the rows where the section has
      // said nothing, and a row whose default disagrees with itself says so.
      const said = sectionOf(s.m, s.i)[a.id];
      if (said == null) { const d = a.opts.find((o) => o.answered);
                          if (d) acc.defaults.add(d.key); }
      a.opts.forEach((o) => {
        if (!acc.optAns.has(o.w)) acc.optAns.set(o.w, []);
        acc.optAns.get(o.w).push({ si, answered: !!o.answered });
      });
      const union = new Set();
      const m2s = a.opts.map((o) => {
        acc.keys.set(o.w, o.key);
        const m2 = Band.setSection(s.m, s.i, a.id, o.key);
        diffPaths(s.m, m2).forEach((p) => { if (!isLedger(p)) { acc.paths.add(p); union.add(p); } });
        return m2;
      });
      const U = [...union].sort();
      const vmap = (mx) => { const o = {}; for (const p of U) o[p] = J(at(mx, p)); return o; };
      const vals = m2s.map(vmap);
      a.opts.forEach((o, j) => {
        if (!acc.optWrite.has(o.w)) acc.optWrite.set(o.w, new Set());
        acc.optWrite.get(o.w).add(J(vals[j]));
      });
      acc.seenOn++;
      if (new Set(vals.map(J)).size === a.opts.length) acc.distinctOn++;
    });
  });
  const rank = rankOf(seqs);
  const out = [];
  for (const acc of rows.values()) {
    const words = [...acc.optWrite.keys()];
    const shapes = [...new Set(acc.shapes.filter(Boolean))];
    /* WHICH WORD IS ALREADY TRUE OF THIS SECTION, fitted per word rather than
       assumed. Most rows read their own field (`per.drums === "half"`), the
       default word reads it being unset, and "everybody" reads two fields
       that are not the row's at all (`per.lift`, `per.follow`) -- which is
       exactly the kind of thing a hand-written table gets wrong and a
       measurement does not. */
    const dflt = acc.defaults.size === 1 ? [...acc.defaults][0] : null;
    const perKeys = [...new Set([].concat(...seen.map((s) => Object.keys(sectionOf(s.m, s.i)))))];
    const fitLit = (w, key) => {
      const obs = acc.optAns.get(w) || [];
      const test = (fn) => obs.every((o) => {
        const per = sectionOf(seen[o.si].m, seen[o.si].i);
        return !!fn(per) === o.answered;
      });
      const tries = [
        { on: acc.id, eq: key, orUnset: key === dflt,
          fn: (per) => per[acc.id] === key || (key === dflt && per[acc.id] == null) },
        { on: acc.id, eq: key, fn: (per) => per[acc.id] === key },
        ...perKeys.map((F) => ({ on: F, truthy: true, fn: (per) => !!per[F] })),
        ...perKeys.map((F) => ({ on: F, eq: key, fn: (per) => per[F] === key })),
      ];
      for (const t of tries) if (test(t.fn)) { const { fn, ...r } = t; return r; }
      return null;
    };
    const options = words.map((w) => {
      const wm = acc.optWrite.get(w);
      const key = acc.keys.get(w);
      return { w, key, lit: fitLit(w, key), constant: wm.size === 1, shapes: wm.size,
               sets: wm.size === 1 ? Object.fromEntries(Object.entries(JSON.parse([...wm][0]))
                 .map(([p, v]) => [p, tryParse(v)])) : null };
    });
    out.push({
      id: acc.id, seat: "section", head: null, ask: [...acc.whos][0],
      whos: acc.whos.size > 1 ? [...acc.whos] : undefined,
      declaredIn: "nukernel/band-kit.js", flags: ["section"],
      rank: rank.order.indexOf(acc.id),
      exists: fitRule(acc.present, feats, labels),
      answeredAt: null, activeBy: null, answersBy: "key",
      defaultKey: acc.defaults.size === 1 ? [...acc.defaults][0] : null,
      defaultKeys: acc.defaults.size > 1 ? [...acc.defaults] : undefined,
      seen: { on: acc.present.filter(Boolean).length, of: N },
      domain: shapes.length === 1 ? { kind: "fixed", words: JSON.parse(shapes[0]) }
        : { kind: "dependent", shapes: shapes.length,
            words: [...new Set([].concat(...shapes.map(JSON.parse)))] },
      writes: [...acc.paths].sort(), ledger: [], reaches: null, reachSampledOn: null,
      options, constantWrites: options.every((o) => o.constant),
      distinctWrites: acc.distinctOn === acc.seenOn ? "always"
        : acc.distinctOn === 0 ? "never" : acc.distinctOn + "/" + acc.seenOn,
    });
  }
  out.sort((x, y) => x.rank - y.rank);
  return { models: labels, questions: out, orderConflicts: rank.conflicts };
}

/* ======================================================================
   THE REGENERATOR -- the offering, computed from the vocabulary ALONE
   This is the half that makes the extraction a claim rather than a dump. It
   reads nothing but the emitted rows and the record in front of it: which
   questions exist (`exists`), in what order (`rank`), with what words
   (`domain`), which word is lit (`answeredAt`, and the option's own values
   under `activeBy`), and which words survive the pruner (distinct-by-writes,
   the generalisation of the escape hatch already in band-kit: `if (d.three
   || d.cheap) return d.opts`).
   A row it cannot compute is never guessed -- it is returned as a HOLE, and
   the holes are the exceptions list.
   ====================================================================== */
// THE RULE LANGUAGE IS NOT DECLARED HERE ANY MORE. It was fifteen lines and
// four forms, and on 2026-08-24 the eight-axes page needed the same four forms
// to evaluate nukernel/gates.js at DRAW TIME — this file is a tool, node only,
// in no script tag, so the page could not have it. Copying it into avail.js
// would have made two owners of one language and they would have drifted the
// first time a fifth form was wanted. So it moved to nukernel/avail.js, which
// the page loads and node requires, and this file reads it from there. The
// behaviour is unchanged: the function below IS the one that was here.
const { evalRule } = require("./avail.js");
// why a row cannot be regenerated, or null if it can
function holeOf(q) {
  if (q.seat === "section") return "a section question: answered by key onto m.per, not by word";
  if (q.exists.rule === "opaque") return "when it is asked reduces to no rule";
  if (typeof q.rank !== "number" || q.rank < 0) return "no stable place in the seat's order";
  if (q.domain.kind !== "fixed" && !q.domain.cases) return "dependent domain, on no single field (" + q.domain.shapes + " shapes)";
  if (!q.constantWrites) return "what a word writes depends on the record it lands on";
  if (!q.answeredAt) return "no path on the record holds the standing answer";
  if (!q.activeBy) return "which word is lit does not follow from what the words write";
  if (q.regenerates === false) return q.regenerateWhy || "the offered words are not the distinct ones";
  return null;
}
function wordsFor(q, f) {
  if (q.domain.kind === "fixed") return q.domain.words;
  const on = q.domain.on;
  const key = Array.isArray(on) ? J(on.map((k) => f[k])) : J(f[on]);
  return q.domain.cases[key] || null;
}
// the offer for one seat, regenerated: { rows, holes }
function offerFrom(voc, m, seat, opt) {
  const loose = !(opt && opt.strict);
  const f = featuresOf(m);
  const rows = [], holes = [];
  for (const q of voc.questions) {
    if (q.seat !== seat) continue;
    const why = holeOf(q);
    if (why) { holes.push({ id: q.id, seat, why }); continue; }
    const there = evalRule(q.exists, f);
    if (there === null) { holes.push({ id: q.id, seat, why: "exists: unevaluable" }); continue; }
    if (!there) continue;
    const words = wordsFor(q, f);
    if (!words) { holes.push({ id: q.id, seat, why: "dependent domain has no case for this record" }); continue; }
    const said = at(m, q.answeredAt);
    const byWord = new Map(q.options.map((o) => [o.w, o]));
    const opts = words.map((w) => {
      const o = byWord.get(w) || { w, sets: {} };
      return { w, o, answered: said === w, active: isLit(q, o, m) };
    });
    // THE PRUNER, DECLARED. Two answers that write the same values are one
    // answer wearing two hats; an answer that writes what is already there
    // changes nothing. Both passes are band-kit's own, read off the values
    // instead of off a render.
    const paths = [...new Set([].concat(...opts.map((x) => Object.keys(x.o.sets || {}))))].sort();
    const vof = (x) => J(paths.map((p) => J((x.o.sets || {})[p])));
    const now = J(paths.map((p) => J(at(m, p))));
    const seen = new Map();
    for (const x of opts) if (x.answered || x.active) { const v = vof(x); if (v !== now) seen.set(v, x.w); }
    const kept = opts.filter((x) => {
      const v = vof(x);
      if (x.answered || x.active) return true;
      if (v === now || seen.has(v)) return false;
      seen.set(v, x.w); return true;
    });
    // ...and a question left with one answer is not asked (band-kit `asked`)
    const shown = kept.map((x) => ({ w: x.w, answered: x.answered, active: x.active }));
    if (shown.length < 2 && !opts.some((x) => x.answered)) continue;
    rows.push({ id: q.id, rank: q.rank, opts: shown,
                raw: opts.map((x) => ({ w: x.w, answered: x.answered, active: x.active })) });
  }
  rows.sort((a, b) => a.rank - b.rank);
  return { rows, holes };
}

/* THE SECTION'S OWN ROWS, REGENERATED -- the RAW ones (`sectionAsks(m, i,
   true)`): which questions this section is asked, in what order, with what
   words and which word is already true of it. Not the pruned menu: pruning a
   section question means composing the whole section once per option, which
   is a render and not a lookup, and the vocabulary says so rather than
   pretending. Even so, the raw rows are the shape of the section interview,
   and they come out of the data with nothing else read. */
function sectionOfferFrom(voc, m, i, role) {
  const f = sectionFeaturesOf(m, i, role);
  const per = sectionOf(m, i);
  const rows = [], holes = [];
  for (const q of voc.questions) {
    if (q.seat !== "section") continue;
    const there = evalRule(q.exists, f);
    if (there === null) { holes.push({ id: q.id, why: "exists: " + q.exists.rule }); continue; }
    if (!there) continue;
    const words = wordsFor(q, f);
    if (!words) { holes.push({ id: q.id, why: "dependent domain has no case here" }); continue; }
    const byWord = new Map(q.options.map((o) => [o.w, o]));
    let hole = null;
    const opts = words.map((w) => {
      const o = byWord.get(w) || {};
      if (!o.lit) { hole = "which word is already true of the section follows no rule"; return null; }
      const v = per[o.lit.on];
      const lit = o.lit.truthy ? !!v
        : (v === o.lit.eq || (o.lit.orUnset && v == null));
      return { w, answered: lit, active: false };
    });
    if (hole) { holes.push({ id: q.id, why: hole }); continue; }
    rows.push({ id: q.id, rank: q.rank, opts });
  }
  rows.sort((a, b) => a.rank - b.rank);
  return { rows, holes };
}

/* ---------- WHY A ROW IS NOT DECLARABLE, SAID PRECISELY ----------------
   `holeOf` says WHETHER the rules can produce the row; this says WHY, in
   the terms the box itself is written in, and it is the list that matters:
   an extraction that reproduces most of the offering is not "most done", it
   is a measurement of exactly which part of this box is not declarative. */
const BRANCH = (p) => String(p).split(".")[0];
function reasonFor(q) {
  const why = holeOf(q);
  if (!why) return null;
  const branches = [...new Set(q.writes.map(BRANCH))].sort();
  if (q.seat === "section")
    return { code: "section", why:
      "A SECTION QUESTION, and the split runs through the middle of it. Its " +
      "SHAPE is declarative and regenerates exactly -- which questions this " +
      "section is asked, in what order, with what words, and which word is " +
      "already true of it (test/unit/vocabulary.test.js holds 67 of 67 section " +
      "interviews). Its MENU is not: pruning here composes the whole section " +
      "once per option (band-kit `sectionAsks`), which is a render and not a " +
      "lookup. It is also answered by a KEY onto `m.per[i]` rather than by a " +
      "word onto a field, and two of its words read fields that are not the " +
      "row's own (`per.lift`, `per.follow`)." };
  if (q.exists.rule === "opaque")
    return { code: "exists-opaque", why:
      "WHEN IT IS ASKED reduces to no rule over the features measured: present on " +
      q.exists.on + " of " + q.exists.of + " models (e.g. " +
      (q.exists.examples || []).slice(0, 2).join("; ") + "), absent on others (e.g. " +
      (q.exists.missing || []).slice(0, 2).join("; ") + "). The condition is real, " +
      "it is just not a function of one field of the record." };
  if (q.domain.kind !== "fixed" && !q.domain.cases)
    return { code: "domain-computed", why:
      "A COMPUTED DOMAIN: " + q.domain.shapes + " different word lists over " +
      q.seen.of + " models and no field of the record decides which. " +
      (q.flags.includes("three")
        ? "This is the front door — the words offered are the ones some record " +
          "still standing has (`survivors`/`openOf`), which is a fixpoint over the " +
          "catalog, not a list."
        : "The list is computed, not declared.") };
  if (!q.constantWrites) {
    if (q.flags.includes("three"))
      return { code: "casts-a-record", why:
        "NOT A PARAMETER, A RECORD SELECTOR. Answering writes " + q.writes.length +
        " paths across " + branches.length + " branches of the record (" +
        branches.join(", ") + ") — it CALLS a record and re-seats the whole band. " +
        "What it writes therefore depends entirely on which record it lands on." };
    if (q.flags.includes("multi"))
      return { code: "toggle-set", why:
        "A TOGGLE SET (`multi`), not one-of-N: the word writes the LIT SET joined " +
        "in the menu's own order, so what it writes depends on what is already lit. " +
        "Varies at: " + q.varies.join(", ") + "." };
    if (branches.length > 2)
      return { code: "re-casts", why:
        "ANSWERING RE-DERIVES rather than assigns: " + q.writes.length + " paths " +
        "across " + branches.join(", ") + ", and " + q.varies.length +
        " of them differ from record to record (" + q.varies.slice(0, 4).join(", ") +
        (q.varies.length > 4 ? ", …" : "") + "). A meter re-seats every chair's bar; " +
        "a form re-reads the changes. These are not settings." };
    return { code: "content", why:
      "THE WORD CARRIES CONTENT, NOT A VALUE: it merges with what the chair is " +
      "already holding, so its write differs per record at " + q.varies.join(", ") +
      ". A groove, a figure, a fill and a tone are music somebody wrote — a " +
      "sixteen-step vector or an object folded onto the one already there — and " +
      "no amount of declaring makes them parameters." };
  }
  if (!q.answeredAt)
    return { code: "no-answer-field", why:
      "NO PATH ON THE RECORD HOLDS THE STANDING ANSWER: what this row reports as " +
      "answered is derived, not stored." };
  if (!q.activeBy)
    return { code: "lit-derived", why:
      "WHICH WORD IS LIT DOES NOT FOLLOW FROM WHAT THE WORDS WRITE. The record " +
      "has said nothing here and the box lights a word anyway — the default is " +
      "itself computed from the record (how long is a solo? four bars on one " +
      "record, eight on another), so there is no constant default word to declare." };
  if (q.regenerates === false)
    return { code: "prune-by-sound", why:
      "DISTINCT ON THE RECORD, IDENTICAL IN THE SCORE. Every word here writes a " +
      "different value, so no comparison of writes can predict the box's menu — " +
      "and the box composes the section once per option and drops the words that " +
      "make the SAME SECTION. Measured: " +
      (q.regenerateExample ? "on " + q.regenerateExample.on + " the box offers " +
        q.regenerateExample.box + " and the rules offer " + q.regenerateExample.mine
        : "") + ". This is the pruner being a musician, and it is the one part of " +
      "the offering that is a render and not a lookup." };
  return { code: "other", why: why };
}

/* ======================================================================
   THE PROOF, run as part of the extraction
   Every row's rules are held against the box itself, on every model, and a
   row that disagrees anywhere is marked `regenerates: false` WITH THE
   DISAGREEMENT RECORDED. The vocabulary therefore never claims a row it
   cannot reproduce -- an extraction that reproduces 90% is not 90% done, it
   is a discovery that 10% of this box is not declarative, and that list is
   the point of the exercise.
   ====================================================================== */
const sigOfRow = (r) => r.id + "(" + r.opts.map((o) =>
  [o.w, o.answered ? "a" : "", o.active ? "*" : ""].join("")).join("·") + ")";
function verify(voc, models, opt) {
  const byKey = new Map(voc.questions.map((q) => [q.seat + " " + q.id, q]));
  if (!(opt && opt.keep))
    for (const q of voc.questions) { q.regenerates = q.seat === "section" ? false : null; q.checked = 0; }
  let ok = 0, moved = 0;
  /* ...AND A CENSUS OF THE PRUNER WHILE WE ARE HERE, because it is the one
     number the tree already had an opinion about (offer-identity's header:
     "65 of the 83 rows can be derived that way"). A row that never loses a
     word to the pruner is a row a runtime could offer without composing
     anything; a row that does is the pruner being a musician. This counts it
     over every model rather than over one record. */
  const cut = new Set(), all = new Set();
  for (const mm of models) {
    for (const seat of Band.SEATS) {
      let live = [];
      try { live = Band.asked(mm.m, seat) || []; } catch (e) { live = []; }
      const kept = new Map(live.map((d) => [d.id, d.opts.length]));
      for (const d of Band.seatDecisions(mm.m, seat)) {
        all.add(seat + "/" + d.id);
        const n = kept.get(d.id);
        if (n === undefined || n < d.opts.length) cut.add(seat + "/" + d.id);
      }
      const liveSig = new Map(live.map((d) => [d.id, askSig(d)]));
      const got = offerFrom(voc, mm.m, seat);
      const gotIds = new Set(got.rows.map((r) => r.id));
      for (const r of got.rows) {
        const q = byKey.get(seat + " " + r.id);
        q.checked++;
        const mine = sigOfRow(r), theirs = liveSig.get(r.id);
        if (mine === theirs) { ok++; if (q.regenerates === null) q.regenerates = true; }
        else {
          moved++;
          if (q.regenerates !== false) {
            q.regenerates = false;
            q.regenerateWhy = theirs === undefined
              ? "regenerated a question the box does not offer"
              : "the offered words differ from the box's";
            q.regenerateExample = { on: mm.label, box: theirs || "(not offered)", mine };
          }
        }
      }
      // ...and a row the box offers that the vocabulary did not produce
      for (const d of live) {
        if (gotIds.has(d.id)) continue;
        const q = byKey.get(seat + " " + d.id);
        if (!q || holeOf(q)) continue;         // already a declared hole
        q.regenerates = false;
        q.regenerateWhy = q.regenerateWhy || "the box offers it and the rules do not";
        q.regenerateExample = q.regenerateExample ||
          { on: mm.label, box: askSig(d), mine: "(not produced)" };
      }
    }
  }
  return { rows: ok + moved, identical: ok, moved,
           pruner: { rows: all.size, everCut: cut.size, neverCut: all.size - cut.size,
                     cutRows: [...cut].sort() } };
}

/* ======================================================================
   THE WHOLE VOCABULARY, AND THE CLI
   ====================================================================== */
function classify(q) {
  if (q.seat === "section") return "section";
  if (!q.writes.length) return "computed";
  if (holeOf(q)) return "opaque";
  return "declarable";
}

function extractAll(opt) {
  opt = opt || {};
  const t0 = Date.now();
  const models = opt.models || modelsOf(opt.rolls == null ? 30 : opt.rolls);
  const seats = extract({ ...opt, models });
  const secs = extractSections(opt);
  const voc = { records: RECORDS, seats: Band.SEATS,
                models: seats.models, sectionModels: secs.models,
                questions: [...seats.questions, ...secs.questions] };
  /* THE HELD-OUT RECORDS. Every rule in this file was FITTED to the models
     above, so holding it against those same models proves nothing about a
     coincidence -- a two-field condition that happens to separate thirty
     records will separate them again. So the proof runs on the fitting set
     AND on records the fit never saw, drawn from a different seed, and both
     numbers are reported. A rule that survives the second is a rule. */
  const held = modelsOf(opt.holdout == null ? 20 : opt.holdout, 776699, "unseen");
  const proof = verify(voc, models);
  const proofHeld = verify(voc, held, { keep: true });
  voc.questions.forEach((q) => {
    q.kind = classify(q);
    const r = reasonFor(q);
    q.why = r ? r.why : null;
    q.whyCode = r ? r.code : null;
  });
  // THE EXCEPTIONS LIST, first class: the rows this box cannot say
  // declaratively, grouped by the reason, because that grouping IS the
  // finding.
  const GROUP = {
    "casts-a-record": "NOT PARAMETERS, RECORD SELECTORS. The front door: each " +
      "word calls a whole record and re-seats the band, and its own options are " +
      "the records still standing (`survivors`/`openOf`), a fixpoint over the " +
      "catalog rather than a list.",
    "re-casts": "ANSWERING RE-DERIVES RATHER THAN ASSIGNS. A genre and a meter " +
      "re-seat every chair; what they write depends on what was already there.",
    "content": "THE WORD CARRIES CONTENT, NOT A VALUE. A groove, a figure, a " +
      "fill, a tone, a chord list: music somebody wrote, folded onto what the " +
      "chair is already holding. Each row names the field it merges at.",
    "toggle-set": "TOGGLE SETS, not one-of-N. The word writes the LIT SET, so " +
      "what it writes depends on what is already lit.",
    "prune-by-sound": "DISTINCT ON THE RECORD, IDENTICAL IN THE SCORE. Every " +
      "word writes a different value and some of them make the SAME SECTION, so " +
      "the box composes to find out and no comparison of writes can predict it. " +
      "This is the one part of the offering that is a render and not a lookup.",
    "domain-computed": "A COMPUTED DOMAIN: the word list is computed, and no " +
      "field of the record decides it.",
    "exists-opaque": "WHEN IT IS ASKED REDUCES TO NO RULE over the features " +
      "measured. The condition is real; it is not a function of the record.",
    "lit-derived": "WHICH WORD IS LIT IS DERIVED, not stored, and its default " +
      "is itself computed from the record.",
    "no-answer-field": "NO PATH ON THE RECORD HOLDS THE STANDING ANSWER.",
    section: "SECTION QUESTIONS. Their SHAPE regenerates exactly; their MENU " +
      "does not — pruning a section composes the whole section once per option.",
    other: "not declarable, for a reason outside the measured kinds.",
  };
  const exceptions = {};
  voc.questions.filter((q) => q.whyCode).forEach((q) => {
    (exceptions[q.whyCode] = exceptions[q.whyCode] ||
      { why: GROUP[q.whyCode] || q.why, rows: [] }).rows.push(q.seat + "/" + q.id);
  });
  const count = (k) => voc.questions.filter((q) => q.kind === k).length;
  const all = voc.questions;
  return {
    what: "the vocabulary of this box, extracted from the running system",
    how: "nukernel/vocabulary.js -- see the header. Re-run with " +
         "`node nukernel/vocabulary.js`; the gate is test/unit/vocabulary.test.js.",
    names: {
      "attribute grammar": "the system: legal structures, attributes computed " +
        "over them, and a dependency relation between them",
      vocabulary: "what can be said (never `schema`: this domain is dependent)",
      record: "what was said -- the document",
      score: "what gets played -- the event list",
      "effect graph": "what each field writes (`writes`) and what reads it (`reaches`)",
    },
    measured: {
      records: RECORDS.length, models: models.length,
      sectionModels: secs.models.length,
      questions: all.length,
      seatQuestions: seats.questions.length,
      sectionQuestions: secs.questions.length,
      options: all.reduce((n, q) => n + q.options.length, 0),
      writePaths: new Set([].concat(...all.map((q) => q.writes))).size,
      scorePaths: new Set([].concat(...all.map((q) => q.reaches || []))).size,
      declarable: count("declarable"), opaque: count("opaque"),
      computed: count("computed"), section: count("section"),
      proof, proofHeld, heldOutModels: held.length, seconds: +((Date.now() - t0) / 1000).toFixed(1),
    },
    exceptions,
    orderConflicts: { ...seats.orderConflicts,
                      section: secs.orderConflicts.length ? secs.orderConflicts : undefined },
    ...voc,
  };
}

module.exports = { on, RECORDS, called, roller, modelsOf, diffPaths, isLedger, at,
                   scorePaths, scoreDiff, optSig, askSig, sigOfRow, declaredIn, homeOf, J,
                   featuresOf, fitRule, fitDomain, rankOf, evalRule, holeOf, wordsFor,
                   offerFrom, sectionOfferFrom, sectionFeaturesOf, sectionOf, verify, classify, reasonFor, extract, extractSections, extractAll,
                   EQ, Band, MODES, Ask };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
  const out = arg("--out", path.join(HERE, "vocabulary.json"));
  const v = extractAll({ rolls: +arg("--rolls", 30), holdout: +arg("--holdout", 20),
                         noReach: argv.includes("--no-reach") });
  fs.writeFileSync(out, JSON.stringify(v, null, 1) + "\n");
  const m = v.measured;
  console.log("the vocabulary, extracted from the running box");
  console.log("  " + m.questions + " questions (" + m.seatQuestions + " seat, " +
              m.sectionQuestions + " section) - " + m.options + " options");
  console.log("  " + m.writePaths + " record paths written - " + m.scorePaths +
              " score paths read");
  console.log("  declarable " + m.declarable + " - opaque " + m.opaque +
              " - computed " + m.computed + " - section " + m.section);
  console.log("  the proof: " + m.proof.identical + " of " + m.proof.rows +
              " regenerated rows identical to the box's own offer (" +
              m.proof.moved + " moved)");
  console.log("  on " + m.heldOutModels + " records the fit never saw: " +
              m.proofHeld.identical + " of " + m.proofHeld.rows + " (" +
              m.proofHeld.moved + " moved)");
  console.log("  over " + m.models + " records (called and rolled) and " +
              m.sectionModels + " sections, in " + m.seconds + "s");
  console.log("  wrote " + out);
}
