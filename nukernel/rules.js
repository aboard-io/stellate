// nukernel/rules.js — THE GENRE AS SENTENCES A MUSICIAN CAN EDIT.
//
// Paul, 2026-09-01: "The genre data is expressed as logical sentences and
// rules derived from the data in the genre. They should be readable to a
// musician. You can edit them, add new rules from a palette, and set
// thresholds. It's a code-editing experience but it feels like simple
// sentences." And, in the same message, the fence: "The motifs don't need to
// be editable. Just the structural rules."
//
// WHAT THIS FILE IS. One row per STRUCTURAL field of a `genres.js` row, saying
// which of the eight axes it belongs to (AXES.md is the vocabulary and this
// file may not invent a ninth), HOW to say it in English, WHAT may be written
// into it, WHERE that write lands (row / render / compose — the three tiers
// the code already distinguishes) and, where a field is meaningless on this
// particular row, the MEASURED reason why. It is the same shape `askable.js`
// (:70) uses for the knob grammar and `avail.js SHEETS` uses for the document
// sheets — a third table in the same language rather than a third language.
//
// WHAT THIS FILE IS NOT. It is not a second copy of the catalogue's words.
// Paul, 2026-08-23: "I don't want you to rewrite everything by hand though.
// Everything is data. CONVERT DATA BY CONVERTING DATA." So every option list
// below is a REFERENCE — a function that returns the OWNING table at call
// time (`fields.js` RATES/SWINGS/ARTICS/DRUMKITS/BASSOPS/PARTCHOICES/
// INSTRCHOICES/INLABEL/ROLES/FX, `genres.js` MODES/SCALES/PROGS/HARMONYLABEL,
// `compose.js` PLANS/PACES, `ideas-kit.js` CONTOURS/LANDINGS/LENGTHS,
// `askable.js`'s own `orn` opts) — never a word copied into this file. A
// renamed option renames here by existing, and a table that loses a word
// loses it here in the same instant.
//
// AND IT IS NOT THE MOTIFS. `askable.js:16-22` owns that law and it is quoted
// rather than restated: "A drum groove, a bass figure, a melodic cell and a
// keys phrase are not knob VALUES, they are music — sixteen-step vectors
// somebody wrote." The seven vector fields (`kit kits kitVel kitProb fill
// bassGrid ghost`) get ONE read-only line each in `MOTIF` below, so the Rules
// view can say what they are and refuse to edit them WITH ITS REASON — no
// silent grey — and the tracker stays their one owner.
//
// THE CLOSURES ARE SAID AND REFUSED. `entry`, `reg`, `realize` and `word` are
// functions on all 396 rows; `song.js:484-491` already ruled on them ("JSON
// drops a function silently, so a saved candidate would come back as a genre
// with no behaviour at all"). They are printed as sentences and refused for
// editing with that reason. The editable substitutes already exist and are
// rows here: `part[]` overrides `realize` at `precompose.js:2500`, and the
// document's own `cast.reg` overrides `reg` per chair.
(function (root, factory) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const api = factory(
    isNode ? require("./genres.js")    : root.NuGenres,
    isNode ? require("./fields.js")    : root.NuFields,
    isNode ? require("./compose.js")   : root.NuCompose,
    isNode ? require("./ideas-kit.js") : root.NuIdeas,
    isNode ? require("./kernel.js")    : root.NuKernel,
    isNode ? require("./askable.js")   : root.NuAskable,
    // INSTRUMENTS, FOR THE ONE PREDICATE THIS FILE CANNOT DERIVE (2026-09-02).
    // `instruments.js sampledId` is the page's one owner of "is this id a
    // RECORDING", and its complement is "the engine models it" — see the
    // `instrOpts` note below for the measurement that says so. It is a UMD
    // file loaded at index.html:487, forty-three lines before this one, so
    // `root.NuInstruments` is there at factory time on the page and `require`
    // answers in node.
    isNode ? require("./instruments.js") : root.NuInstruments,
    // PRECOMPOSE IS REACHED LAZILY, AND THAT IS THE WHOLE REASON THIS IS A
    // FUNCTION. `precompose.js` requires THIS file (genreToDocument takes a
    // rules list and resolves it through `applyRules`), so a load-time require
    // in the other direction is a cycle. Everything this file wants from it —
    // `idiomOf`, which says what figure the record's own idiom row asks for —
    // is wanted at CALL time, long after both modules exist.
    isNode ? () => require("./precompose.js") : () => root.NuPrecompose);
  if (isNode) module.exports = api;
  else root.NuRules = api;
})(typeof self !== "undefined" ? self : this,
   function (NG, NF, NC, Id, K, NuAskable, NI, PRE) {
  "use strict";

  const { GENRES, MODES, SCALES, MODELABEL, SCALELABEL, PROGS, HARMONYLABEL } = NG;

  /* ======================================================================
     1 · SENTENCE PARTS
     ======================================================================
     A sentence is an ARRAY, not a string, because half of it is a control.
     Two kinds of part, and nothing else:
       { w }            a word — plain text the view prints
       { w, v, slot }   THE VALUE — `w` is how it reads, `v` is the machine
                        value, and `slot` is truthy so a view can find it
                        without parsing prose.
     A view that only wants the prose joins `parts.map(p => p.w)`; a view that
     wants controls walks the slots. One shape serves both, which is why the
     sentence is not a template string with a `{}` in it. */
  const w = (s) => ({ w: String(s) });
  const val = (word, v) => ({ w: String(word), v, slot: true });
  /* A CLAUSE THAT IS NOT PART OF THE SENTENCE (2026-09-02). Paul, on the genre
     editor: *"It can be a lot tighter though — it has text all over the place.
     Look at it from the point of view of a user just seeing it for the first
     time."* One row is one sentence and nothing else stands on it; a DERIVED
     tail — the eight section roles a plan reads out to — is an answer to a
     question a first-time reader has not asked. It is not deleted: a view puts
     it behind the hold (`data-say`), which is exactly what the motifs row
     already does with its seven read-only lines. `aside` is how a rule says
     "these words belong to the row but not to its line". */
  const aside = (s) => ({ w: String(s), aside: true });

  /* ---------- dotted paths (tone.verb is the only nested one today) ------- */
  const readAt = (g, path) => {
    let o = g;
    for (const k of path.split(".")) { if (o == null) return undefined; o = o[k]; }
    return o;
  };
  /* ABSENT IS THE ONLY SPELLING OF A DEFAULT, so a write of `null`/`undefined`
     DELETES rather than storing an empty. The path is cloned on the way down
     (never mutated in place) because `applyRules` hands this a SHALLOW copy of
     the genre row and `tone` on that copy is still the catalogue's own object. */
  const writeAt = (row, path, v) => {
    const seg = path.split(".");
    let o = row;
    for (let i = 0; i < seg.length - 1; i++) {
      const k = seg[i];
      o[k] = (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) ? { ...o[k] } : {};
      o = o[k];
    }
    const last = seg[seg.length - 1];
    if (v == null) delete o[last]; else o[last] = v;
  };

  /* ---------- the option-list shape, borrowed whole from avail.js --------
     `[{ value, label }]` is what `avail.js SHEETS[].values()` returns and what
     `ui/eight.js selectField` already draws. A fourth shape for the same idea
     would be a fourth thing to keep in step. */
  const opts = (table, label) => Object.keys(table)
    .map((k) => ({ value: k, label: (label && label[k]) || String(table[k]) }));

  /* ---------- WHAT A CHAIR MAY HOLD, NATIVE FIRST (2026-09-02) -----------
     Paul, wave 4 §10: *"When you define a genre you seem to only allow the
     sample instrument not the faust instrument like on high nrg… that's the
     opposite those should be chosen after native"*.

     He is right about the reading and the menu was right about the ids: every
     one of `hinrg`'s three (`solo_vox`, `polysynth`, `saw_wave`) IS a Faust
     voice — `polysynth` is the Juno-60, `saw_wave` is the supersaw, `solo_vox`
     is the modelled throat — and `NF.INSTRCHOICES` prints all 119 in one flat
     alphabet with nothing to say which. A menu that cannot tell a model from a
     recording is a menu that offers only recordings, because that is what 86
     of the 119 are and what the eye finds first.

     ONE OWNER FOR "IS THIS ID NATIVE", AND IT IS NOT A LIST TYPED HERE.
     `instruments.js sampledId` is the page's predicate for "this id is a
     recording the sampler plays", and its own header records the gate that
     pins it to the engine: "over every INSTRCHOICES id, sampledId(id) ===
     (recipeFor's source starts `sampler:`)". So NATIVE is its complement, and
     it cannot drift from `audio/to-engine.js` without that gate going red.
     MEASURED here 2026-09-02, over all 119 ids, `!sampledId(id)` against
     `recipeFor("line", {instr: id}, {}, un)` routing to a model with nothing
     unrouted: 33 native, 86 sampled, ZERO disagreements. Every id in both
     groups is an id `precompose.test.js` G11a already walks against the
     bridge, which is why the menu can be reordered without widening what it
     promises — nothing is added and nothing is taken away.

     THE FLEET'S OWN DSP NAMES ARE NOT IN HERE, and that is the same
     measurement from the other side. `to-engine.js SYNTH_NAMES()` lists 28
     models (`juno60`, `tb303`, `modeld` …), and as an `instr` value 27 of the
     28 come back `unrouted` from `recipeFor` — they are what a chair's
     `synth` block names, not what its `instr` names, and `document.js
     nativeOf` reaches them only when a caller passes the fleet. Offering one
     here would be offering a genre row a word that composes on the page and
     silences the chair anywhere else, which is this box's characteristic bug.
     (`erhu` is the single id that is spelled both ways; it is in INSTRCHOICES
     and arrives through the native half below like any other model.) */
  const instrOpts = () => {
    const ids = Object.keys(NF.INSTRCHOICES);
    const say = (g) => (id) => ({ value: id, label: NF.INSTRCHOICES[id], group: g });
    const sampled = (id) => !!(NI && NI.sampledId) && NI.sampledId(id);
    return [...ids.filter((id) => !sampled(id)).map(say("native")),
            ...ids.filter(sampled).map(say("sampled"))];
  };
  /* ...AND THE SAME QUESTION ASKED OF THE BASS RACK. One expression and not a
     second copy of the sort: the only difference is the TABLE, because the
     bass chair's vocabulary is eleven ids and not ninety (fields.js
     BASSCHOICES). `sampledId` is still the one owner of "is this a model". */
  const bassOpts = () => {
    const ids = Object.keys(NF.BASSCHOICES || {});
    const say = (g) => (id) => ({ value: id, label: NF.BASSCHOICES[id], group: g });
    const sampled = (id) => !!(NI && NI.sampledId) && NI.sampledId(id);
    return [...ids.filter((id) => !sampled(id)).map(say("native")),
            ...ids.filter(sampled).map(say("sampled"))];
  };
  /* a value's own word, read back out of the table that owns it */
  const wordIn = (table, label, v) => (label && label[v]) ||
    (table && table[v] != null ? String(table[v]) : String(v));
  /* name an ARRAY back to its table key — the genre row carries `mode` and
     `scale` as arrays (the kernel reads them; names are for people). Reverse-
     matched, never a copied name list; `ui/explain.js:118` does the same off
     the same tables and `precompose.js:871` throws on a miss. */
  const nameOf = (table, arr) => {
    if (!Array.isArray(arr)) return null;
    const s = JSON.stringify(arr);
    for (const k of Object.keys(table)) if (JSON.stringify(table[k]) === s) return k;
    return null;
  };
  /* the changes in the numerals the Key panel already speaks. `K.ROMAN` is
     kernel.js's own table and is READ, not copied — the same derivation
     `ui/explain.js:194` makes, said again here only because that file is an ES
     module in `ui/` and this one has to answer `require`. */
  const progWord = (prog) => {
    if (!Array.isArray(prog) || !prog.length) return null;
    return prog.map((slot) => {
      const c = Array.isArray(slot) ? slot[0] : slot;
      const r = (K.ROMAN && K.ROMAN[(((c.d || 0) % 7) + 7) % 7]) || String(c.d);
      return c.q && c.q !== "triad" ? r + " " + c.q : r;
    }).join(" – ");
  };
  const list = (a) => (Array.isArray(a) ? a : a == null ? [] : [a]);

  /* THE ROLES A ROW'S OWN PLAN OWNS — the fence `compose.js:562` states for
     `paces` ("keyed by the role words the anchor's own plan owns") and the same
     one `progFamily` sits behind. Read off `compose.js PLANS`, deduplicated in
     the plan's own order. */
  const planRoles = (g) => {
    const p = (NC.PLANS || {})[g && g.plan] || [];
    const seen = [];
    for (const r of p) if (!seen.includes(r)) seen.push(r);
    return seen;
  };

  /* the record's own figure, off precompose's IDIOM/IDIOM_ANCHOR pair. Lazy,
     for the load-cycle reason at the top of the file; null on a tree where
     precompose has not loaded (the browser's script order guarantees it has). */
  const idiomRow = (gk) => {
    const P = PRE && PRE();
    if (!P || !P.idiomOf || !GENRES[gk]) return null;
    try { return P.idiomOf(gk); } catch (e) { return null; }
  };

  /* ======================================================================
     2 · THE THREE RE-DERIVE TIERS
     ======================================================================
     Not a switch statement in a view: a COLUMN on the row, because the view
     has to say honestly which edits restart the record before a hand presses.

       "row"      changes nothing that plays (`label`, `words`, the annotations)
       "render"   `document.js toGenre` spreads the genre row under the
                  document's overrides, so the kernel reads the new value on
                  the NEXT frame: `CTX.changed()` and nothing else
       "compose"  the value is consumed while the record is being WRITTEN
                  (form, cast, alphabet, the desk), so the record is composed
                  again at the current seed and lands through `CTX.setDocument`

     The membership is `scratch/maps-2026-09-01/rules.md` §257's measurement,
     which read `toGenre` and asked of every field whether the document already
     overrides it. */
  const TIERS = {
    row:     "nothing moves — this is what the record is called",
    render:  "the band plays it from the next bar",
    compose: "the record is written again at this seed",
  };

  /* ======================================================================
     3 · RULES — one row per structural field
     ======================================================================
     { field     the dotted path on the genre row this rule owns
       axis      one of AXES.md's eight, and never a ninth
       head      the control label (two or three words)
       say       (g, gk) -> sentence parts; NEVER empty, on any anchor
       read      (g) -> the declared value, or undefined
       edit      null (said, not editable) or { kind, values?, min, max, step }
       write     (row, v) -> void, onto a row `applyRules` has already copied
       rederive  a TIERS key
       why       (g, gk) -> null, or the MEASURED reason this rule reaches
                 nothing on THIS row }

     `edit.kind` is one of:
       number  min/max/step            enum    values() -> [{value,label}]
       flag    a boolean, absent = off list    values(), per index
       map     keys(g,gk) + values()   changes the chord grid
       pair    two numbers (touch)     none    said only; `why` says why */
  const RULES = [
    /* ---------------------------- TIME --------------------------------- */
    { field: "bpm", axis: "Time", head: "tempo", rederive: "compose",
      say: (g) => [w("the tempo is "), val(g.bpm, g.bpm), w(" beats a minute")],
      read: (g) => g.bpm,
      /* THE FENCE IS fields.js's (2026-09-02) — one owner for "what is a
         tempo", read at CALL time so this row cannot be the copy that drifts.
         It read 70..160, the number compose.js threw on, while the page's own
         tempo slider and tap tempo allowed 40..220; both are 40..220 now. */
      /* ...AND SINCE 2026-09-05 IT IS THE CATALOGUE'S FENCE AND NOT THE
         HAND'S. A rule writes a GENRE row — compose.js throws on anything
         outside 40..220 and this is the surface that writes it, so it must
         not offer 400. The hand's own tempo (20..400, to a tenth) is the
         TIME row's slider, on the record rather than on the genre. */
      edit: { kind: "number", min: NF.BPM_ROW_LO, max: NF.BPM_ROW_HI, step: 1 },
      write: (r, v) => writeAt(r, "bpm",
        Math.max(NF.BPM_ROW_LO, Math.min(NF.BPM_ROW_HI, Math.round(v)))) },

    /* THE THRESHOLD ROW (2026-09-01). `scratch/maps-2026-09-01/rules.md` §255
       — "THE RANGE PROBLEM" — says the truth: a row states ONE tempo and
       `compose.js` jitters it ±4 on its own stream, so "the tempo stays
       between 120 and 130" was not expressible. It is now, as the honest
       sentence rather than a second bpm field: the tempo is 125, give or take
       N. ABSENT IS ±4 AND BYTE-IDENTICAL — `compose.js` reads `jitter ?? 4`
       and draws exactly one number from its stream either way, so all 395
       standing anchors compose the same bytes they did the day before this
       row existed (the determinism sweep G6a/G6g holds it). */
    { field: "jitter", axis: "Time", head: "tempo give", rederive: "compose",
      say: (g) => { const j = jitterOf(g);
        return [w("give or take "), val(j, g.jitter), w(j === 1 ? " beat" : " beats")]; },
      read: (g) => g.jitter,
      edit: { kind: "number", min: 0, max: 12, step: 1 },
      write: (r, v) => writeAt(r, "jitter", v == null ? null : Math.max(0, Math.min(12, Math.round(v)))) },

    { field: "rate", axis: "Time", head: "reading speed", rederive: "compose",
      say: (g) => { const n = g.rate == null ? 1 : g.rate;
        const k = Object.keys(NF.RATES).find((x) => NF.RATES[x] === n);
        return [w("it is read at "), val(k ? NF.RATELABEL[k] : "as written", n)]; },
      read: (g) => g.rate,
      /* THE STANDING ANSWER IS ALWAYS OFFERED (avail.js:15 — "you can always
         see the word you are on"). `fields.js RATES` names only the two
         departures the PAGE offers, half and double, and the catalogue holds a
         third: `drone` is written at 0.25. Measured 2026-09-01 — 363 anchors
         at 1, 32 at 0.5, ONE at 0.25 — and a menu that could not show that one
         its own value would be a control that silently rewrites the record the
         moment it is touched. So the row's own reading joins the menu when the
         table has no word for it, labelled with the ratio itself (verbatim
         data, never a paraphrase — ui/explain.js:129). The real fix is a
         `quarter` row in fields.js RATES, which is the page's menu and not
         this file's to grow; it is reported rather than taken. */
      edit: { kind: "enum", values: (g) => {
        const out = [{ value: 1, label: "as written" },
          ...Object.keys(NF.RATES).map((k) => ({ value: NF.RATES[k], label: NF.RATELABEL[k] }))];
        const own = g && g.rate;
        if (own != null && !out.some((o) => o.value === own))
          out.push({ value: own, label: own + "\u00d7" });
        return out; } },
      write: (r, v) => writeAt(r, "rate", v == null ? null : +v) },

    { field: "meter", axis: "Time", head: "count", rederive: "compose",
      say: (g) => [w("it counts "), val(g.meter
        ? (NF.METERLABEL[g.meter] || g.meter) : "in four", g.meter || null)],
      read: (g) => g.meter,
      edit: { kind: "enum", values: () => [{ value: null, label: "in four" },
        ...opts(NF.METERLABEL, NF.METERLABEL),
        // ...AND THE SIGNATURES (2026-09-05, the any-meter round): the same
        // four avail.js offers beside the two words, so a rule can say 7/8.
        ...["2/4", "5/4", "7/8", "12/8"].map((v) => ({ value: v, label: v }))] },
      // THE WORD OR THE SIGNATURE, NEVER THE NUMBERS — precompose.js:2172's
      // own law, validated by `K.okMeter`, which reads both and answers no to
      // four-four (the one spelling of that is null).
      write: (r, v) => writeAt(r, "meter", K.okMeter(v) ? String(v) : null) },

    { field: "swing", axis: "Time", head: "swing", rederive: "compose",
      say: (g) => { const k = g.swing == null ? null
          : Object.keys(NF.SWINGS).reduce((b, x) =>
              b == null || Math.abs(NF.SWINGS[x] - g.swing) < Math.abs(NF.SWINGS[b] - g.swing) ? x : b, null);
        return k && k !== "straight"
          ? [w("the eighths lean "), val(NF.SWINGLABEL[k], g.swing)]
          : [w("the eighths are "), val("straight", g.swing == null ? null : g.swing)]; },
      read: (g) => g.swing,
      /* A NUMBER WITH THE TABLE'S RUNGS AS DETENTS, not a five-word menu.
         `fields.js SWINGS` has five rungs and the catalogue declares SIXTEEN
         distinct ratios (measured 2026-09-01: 0.08, 0.1, 0.2, 0.28 … none of
         them a rung), because `swingOf` (:953) rounds to the NEAREST rung when
         it writes the document and the ROW keeps the ratio it was written
         with. A five-option menu could not show a hand the number it is on and
         would flatten sixty anchors the first time it was touched. So the
         control is the ratio, and the five words are where it clicks. */
      edit: { kind: "number", min: 0, max: 0.5, step: 0.01,
        detents: () => Object.keys(NF.SWINGS)
          .map((k) => ({ value: NF.SWINGS[k], label: NF.SWINGLABEL[k] })),
        /* WHAT THE ROW ALREADY SWINGS AT (2026-09-02) — see `start` in §5. 342
           of 421 anchors declare no ratio and `compose.js` deals a SWINGS key
           for a third of records anyway (`swingOf` :1060), so the record on
           the page can be shuffling while the row says nothing. Reading the
           document's own word back through the table is the only way this
           control opens on the number a hand can hear. */
        start: (g, gk, doc) => { const wd = doc && doc.time && doc.time.swing;
          return wd && NF.SWINGS[wd] != null ? NF.SWINGS[wd] : (g.swing || 0); } },
      write: (r, v) => writeAt(r, "swing", v == null ? null : Math.max(0, Math.min(0.5, +v))) },

    /* PER-SECTION, AND ONLY ONTO ROLES THE PLAN OWNS — compose.js:562's fence,
       read off `PLANS` rather than restated. A pace is the one field in this
       whole table with a real per-section band (`dealPaces` leans it ±1 rung,
       and only onto rungs the row already uses). */
    { field: "paces", axis: "Time", head: "section speed", rederive: "compose",
      say: (g) => { const p = g.paces || {};
        const ks = Object.keys(p);
        if (!ks.length) return [w("every section runs at "), val("the record's tempo", null)];
        const parts = [];
        ks.forEach((k, i) => { if (i) parts.push(w(", "));
          parts.push(w("the " + k + " runs "), val(p[k], p[k])); });
        return parts; },
      read: (g) => g.paces,
      edit: { kind: "map", keys: (g) => planRoles(g),
        values: () => NC.PACES.map((p) => ({ value: p, label: p })) },
      write: (r, v) => writeAt(r, "paces", v && Object.keys(v).length ? { ...v } : null) },

    /* -------------------------- ALPHABET ------------------------------- */
    { field: "mode", axis: "Alphabet", head: "mode", rederive: "compose",
      say: (g) => { const k = nameOf(MODES, g.mode) || "aeolian";
        return [w("the mode is "), val(MODELABEL[k] || k, k)]; },
      read: (g) => nameOf(MODES, g.mode),
      edit: { kind: "enum", values: () => opts(MODELABEL, MODELABEL) },
      write: (r, v) => writeAt(r, "mode", v && MODES[v] ? MODES[v].slice() : null) },

    /* `scaleName` accepts a SCALES key OR a MODES key (precompose.js:877), so
       the menu is the union — one owner each, neither list retyped. */
    { field: "scale", axis: "Alphabet", head: "the tune's notes", rederive: "compose",
      say: (g) => { const k = nameOf(SCALES, g.scale) || nameOf(MODES, g.scale);
        return k ? [w("the tune is made of "), val(SCALELABEL[k] || MODELABEL[k] || k, k)]
                 : [w("the tune is made of "), val("the mode's own notes", null)]; },
      read: (g) => nameOf(SCALES, g.scale) || nameOf(MODES, g.scale),
      edit: { kind: "enum", values: () => [{ value: null, label: "the mode's own notes" },
        ...opts(SCALELABEL, SCALELABEL), ...opts(MODELABEL, MODELABEL)] },
      write: (r, v) => writeAt(r, "scale",
        v ? ((SCALES[v] || MODES[v] || []).slice()) : null) },

    { field: "harmony", axis: "Alphabet", head: "harmony", rederive: "compose",
      say: (g) => [w("the harmony is "), val(HARMONYLABEL[g.harmony] || g.harmony, g.harmony)],
      read: (g) => g.harmony,
      edit: { kind: "enum", values: () => opts(HARMONYLABEL, HARMONYLABEL) },
      write: (r, v) => writeAt(r, "harmony", HARMONYLABEL[v] ? v : "cycle") },

    { field: "diatonic", axis: "Alphabet", head: "the line and the chords",
      rederive: "compose",
      say: (g) => [w("the line "), val(g.diatonic ? "stays in the key" : "follows the chords", !!g.diatonic)],
      read: (g) => g.diatonic,
      edit: { kind: "flag" },
      write: (r, v) => writeAt(r, "diatonic", v ? true : null) },

    { field: "prog", axis: "Alphabet", head: "the changes", rederive: "compose",
      say: (g) => { const p = g.prog ? progWord(g.prog)
          : g.roots ? progWord(g.roots.map((d) => ({ d, q: "triad" }))) : null;
        return [w("the changes go "), val(p || "I, and stay there", g.prog || null)]; },
      read: (g) => g.prog,
      edit: { kind: "changes" },
      write: (r, v) => writeAt(r, "prog", Array.isArray(v) && v.length ? v : null),
      // kernel.js:671 throws the changes away on a record that is not a cycle;
      // avail.js:11 quotes the same line. A refusal with its measurement.
      why: (g) => g.harmony === "cycle" ? null
        : "a " + g.harmony + " record has no cycle of changes to write (kernel.js:671)" },

    { field: "roots", axis: "Alphabet", head: "the roots", rederive: "compose",
      say: (g) => [w("the roots run "),
        val(g.roots ? progWord(g.roots.map((d) => ({ d, q: "triad" }))) : "on the tonic", g.roots || null)],
      read: (g) => g.roots,
      edit: { kind: "changes" },
      write: (r, v) => writeAt(r, "roots", Array.isArray(v) && v.length ? v.slice() : null),
      // progOf (:919) reads `prog` FIRST and only falls to `roots`.
      why: (g) => g.prog ? "the row writes its changes out in full, and those win (progOf)" : null },

    { field: "progFamily", axis: "Alphabet", head: "borrowed changes",
      rederive: "compose",
      say: (g) => { const p = g.progFamily || {};
        const ks = Object.keys(p);
        if (!ks.length) return [w("no section borrows "), val("another record's changes", null)];
        const parts = [];
        ks.forEach((k, i) => { if (i) parts.push(w(", "));
          parts.push(w("the " + k + " uses the "), val(p[k], p[k]), w(" changes")); });
        return parts; },
      read: (g) => g.progFamily,
      edit: { kind: "map", keys: (g) => planRoles(g),
        values: () => Object.keys(PROGS).map((k) => ({ value: k, label: k })) },
      write: (r, v) => writeAt(r, "progFamily", v && Object.keys(v).length ? { ...v } : null),
      why: (g) => g.harmony === "cycle" ? null
        : "a " + g.harmony + " record plays no cycle to borrow into (kernel.js:671)" },

    /* ---------------------------- FORM --------------------------------- */
    /* THE SENTENCE THAT FOLLOWS THIS ONE IS DERIVED, NOT STORED: the sections
       are `compose.js PLANS[plan]` read out. A plan is the genre's kind of
       record; the FORM is one reading of it. */
    { field: "plan", axis: "Form", head: "arrangement", rederive: "compose",
      say: (g) => [w("it is arranged as "),
        val(g.plan === "dance" ? "a dance record" : g.plan === "arc" ? "a single arc" : "a song", g.plan),
        aside(planRoles(g).join(", "))],
      read: (g) => g.plan,
      edit: { kind: "enum", values: () => Object.keys(NC.PLANS || {}).map((k) =>
        ({ value: k, label: k === "dance" ? "a dance record" : k === "arc" ? "a single arc" : "a song" })) },
      // plan is one of the two fields compose.js refuses to default
      // (genres.js:22484): a write that cleared it would throw by name.
      write: (r, v) => { if ((NC.PLANS || {})[v]) writeAt(r, "plan", v); } },

    { field: "intro", axis: "Form", head: "how it opens", rederive: "compose",
      say: (g) => [w("it opens "), val(g.intro ? NF.INLABEL[g.intro] || g.intro : "however the form falls", g.intro || null)],
      read: (g) => g.intro,
      edit: { kind: "enum", values: () => [{ value: null, label: "however the form falls" },
        ...opts(NF.INLABEL, NF.INLABEL)] },
      write: (r, v) => writeAt(r, "intro", v && NF.INLABEL[v] ? v : null) },

    /* THE TIER WAS A LIE, AND THE PROBE MEASURED IT (2026-09-02). This row
       said `rederive: "render"` — "the band plays it from the next bar" — on
       the theory that `toGenre` spreads `bars` out of the basis. The probe of
       the composer round found the other half: *"'the loop is N bars'
       (rules.js:390-395, rederive "render") reaches nothing: g.bars is only
       read at COMPOSE time (document.js:674 `Math.max(1, s2.bars || g.bars)`,
       :687). Measured: rules [{bars:16}] + a real recompose → sections still
       4,4,8,4,8,8,8,8,4."* Both readers are real — `ui/derive.js:477,515` reads
       `g.bars` at render AND `compose.js:679` builds every section length out
       of it — and when a field has both readers the honest tier is the
       STRONGER one, because a render-only edit leaves the composed half
       (`form.sections[].bars`, and the cell bar count under it) saying the old
       number while the kernel is handed the new one. Measured 2026-09-02 over
       twelve anchors: an edit here moves the composed document (gregorian,
       bars 8: nine section lengths change), so it is a compose. R6 asserts
       every tier in this table BY MEASUREMENT now, so this cannot drift back. */
    { field: "bars", axis: "Form", head: "the loop", rederive: "compose",
      say: (g) => { const b = g.bars == null ? 4 : g.bars;
        return [w("the loop is "), val(b, g.bars), w(b === 1 ? " bar" : " bars")]; },
      read: (g) => g.bars,
      edit: { kind: "number", min: 1, max: 16, step: 1 },
      write: (r, v) => writeAt(r, "bars", Math.max(1, Math.min(16, Math.round(v)))) },

    /* ---------------------------- CAST --------------------------------- */
    { field: "voices", axis: "Cast", head: "chairs", rederive: "compose",
      say: (g) => { const n = g.voices == null ? 2 : g.voices;
        return n === 0 ? [w("nobody is seated — "), val(0, g.voices), w(" chairs")]
          : [val(n, g.voices), w(n === 1 ? " chair plays it" : " chairs play it")]; },
      read: (g) => g.voices,
      edit: { kind: "number", min: 0, max: 8, step: 1 },
      write: (r, v) => writeAt(r, "voices", Math.max(0, Math.min(8, Math.round(v)))) },

    /* `part[]` IS THE EDITABLE HALF OF `realize` — precompose.js:2500 reads
       `(G.part && G.part[v]) || G.realize(v)`, so a written part wins over the
       closure without anybody having to edit a formula. */
    { field: "part", axis: "Cast", head: "what they play", rederive: "compose",
      say: (g) => { const p = list(g.part);
        return p.length ? [w("they play "), val(p.join(", "), p.slice())]
                        : [w("what each chair plays is "), val("whatever its formula says", null)]; },
      read: (g) => g.part,
      edit: { kind: "list", of: "enum", count: (g) => Math.max(1, g.voices || 1),
        values: () => opts(NF.PARTCHOICES, NF.PARTCHOICES) },
      write: (r, v) => writeAt(r, "part", Array.isArray(v) && v.length ? v.slice() : null),
      why: (g) => (g.voices || 0) > 0 ? null : "no chair is seated on this record" },

    { field: "instr", axis: "Cast", head: "what they hold", rederive: "compose",
      say: (g) => { const i = list(g.instr);
        return i.length
          ? [w("they hold "), val(i.map((x) => NF.INSTRCHOICES[x] || x).join(", "), i.slice())]
          : [w("they hold "), val("nothing — nobody is seated", null)]; },
      read: (g) => g.instr,
      // NATIVE FIRST, THEN THE RECORDINGS — `instrOpts` above carries the
      // sentence of Paul's that put them in that order and the measurement.
      edit: { kind: "list", of: "enum", count: (g) => Math.max(1, g.voices || 1),
        values: () => instrOpts() },
      // instruments.js:39 THROWS on a row with no instr, so the write never
      // empties it: it writes the array or leaves what stood.
      write: (r, v) => { if (Array.isArray(v) && v.length) writeAt(r, "instr", v.slice());
                         else if (typeof v === "string" && v) writeAt(r, "instr", v); } },

    { field: "instrumental", axis: "Cast", head: "singing", rederive: "compose",
      say: (g) => [val(g.instrumental ? "nobody sings on this record" : "the record may be sung",
        !!g.instrumental)],
      read: (g) => g.instrumental,
      edit: { kind: "flag" },
      write: (r, v) => writeAt(r, "instrumental", v ? true : null) },

    /* THE RECORDING IS THE INSTRUMENT (2026-09-02, the catalogue round). The
       QA report's `instrumentation` column scores a chair NATIVE when the
       engine models it, and twelve rows in the catalogue seat none — fugue's
       pipe organ, concerto's string band, guqin's qin, tapemusic's tape.
       Reading twelve rows one at a time said the same thing twelve times:
       there is no model of those instruments in the fleet and there should
       not be, so the recording is not a fallback, it is the sound. `organic`
       is that fact declared, and it is here — in the registry a hand edits
       and `NR.say` prints — rather than only in a comment, because a fact
       that only an offline report can read is a fact this box cannot show.
       ABSENT IS TODAY: nothing in the engine branches on it; it is a claim
       about the record, said in one sentence, the way `instrumental` is. */
    { field: "organic", axis: "Cast", head: "modelled or recorded",
      // "render": MEASURED, not claimed — nothing in compose() branches on
      // this, which is the whole design (see above). test/rules.test.js R6
      // walks every rule's tier against what changing it actually moves.
      rederive: "render",
      say: (g) => [val(g.organic
        ? "the recording IS the instrument — the engine models none of this"
        : "the engine models this record where it can", !!g.organic)],
      read: (g) => g.organic,
      edit: { kind: "flag" },
      write: (r, v) => writeAt(r, "organic", v ? true : null) },

    { field: "nobass", axis: "Cast", head: "bass", rederive: "compose",
      say: (g) => [val(g.nobass ? "there is no bass" : "a bass plays under it", !!g.nobass)],
      read: (g) => g.nobass,
      edit: { kind: "flag" },
      write: (r, v) => writeAt(r, "nobass", v ? true : null) },

    { field: "bassStyle", axis: "Cast", head: "the bass figure", rederive: "compose",
      say: (g) => [w("the bass plays "),
        val(NF.BASSOPS[g.bassStyle || "eighths"] || g.bassStyle || "eighths", g.bassStyle || null)],
      read: (g) => g.bassStyle,
      edit: { kind: "enum", values: () => opts(NF.BASSOPS, NF.BASSOPS) },
      write: (r, v) => writeAt(r, "bassStyle", v && NF.BASSOPS[v] ? v : null),
      // precompose.js:2786 seats no bass at all on a `nobass` row.
      why: (g) => g.nobass ? "this record has no bass to give a figure to" : null },

    /* WHO THE BASS IS (2026-09-02, the catalogue round). The row above says
       what the bass PLAYS and there was no row for what it plays it ON: the
       bass was the one chair a genre could not cast, so every anchor without a
       signature `synth` block seated the sampled recorded upright. precompose
       writes `bassInstr` onto the bass voice's `instrument` now and
       `audio/plan.js castOf` reads it through `document.js toGenre`; this is
       the sentence a hand edits it with.

       THE VOCABULARY IS `NF.BASSCHOICES` AND NOT `NF.INSTRCHOICES`, which is
       the whole reason fields.js keeps a second list — its header measures it:
       "a word that casts a glockenspiel into the bass chair is a word that
       lies". Eleven ids, the bass rack's own, in the rack's own order.

       NATIVE FIRST, like `instr` above and for Paul's same sentence, and asked
       of the same one owner (`instruments.js sampledId`) rather than a list
       typed here. Measured 2026-09-02 over the eleven: `bass_lead` is the one
       MODEL and the other ten are recordings — which is itself the finding
       that a machine genre wanting a modelled bottom end declares a signature
       `synth` (recipeBase asks it before the patch table, so it reaches the
       bass) rather than reaching for a synth-bass id that is a sample of one.
       The group label says which is which on the menu; nothing is added and
       nothing is taken away. */
    { field: "bassInstr", axis: "Cast", head: "the bass instrument",
      rederive: "compose",
      say: (g) => [w("the bass is "),
        val(NF.BASSCHOICES[g.bassInstr] || "the record's own — a double bass",
            g.bassInstr || null)],
      read: (g) => g.bassInstr,
      edit: { kind: "enum", values: () => bassOpts() },
      write: (r, v) => writeAt(r, "bassInstr",
        v && Object.prototype.hasOwnProperty.call(NF.BASSCHOICES, v) ? v : null),
      // precompose.js seats no bass at all on a `nobass` row.
      why: (g) => g.nobass ? "this record has no bass to give an instrument to" : null },

    /* THE TWO CLOSURES THAT ARE SAID AND NOT EDITED. song.js:484-491 is the
       owner of the reason and it is quoted, not restated. Each has an editable
       substitute that IS a row above: `part[]` for `realize`, and the
       document's own `cast.reg` for `reg`. */
    { field: "entry", axis: "Cast", head: "when they come in", rederive: "row",
      say: (g) => { const n = Math.max(1, g.voices || 1);
        const e = []; for (let v = 0; v < n; v++) { try { e.push(g.entry(v)); } catch (x) { e.push("?"); } }
        return e.every((x) => x === 0)
          ? [w("everybody starts "), val("at the top", null)]
          : [w("the chairs come in at bars "), val(e.join(", "), null)]; },
      read: (g) => g.entry,
      edit: null,
      why: () => "written as a formula, and a formula is not JSON — a saved " +
        "genre would come back with no behaviour at all (song.js:484)" },

    { field: "reg", axis: "Cast", head: "where they sit", rederive: "row",
      say: (g) => { const n = Math.max(1, g.voices || 1);
        const e = []; for (let v = 0; v < n; v++) { try { e.push(g.reg(v)); } catch (x) { e.push("?"); } }
        return e.every((x) => x === 0)
          ? [w("every chair sits "), val("where it sits", null)]
          : [w("the chairs sit at "), val(e.join(", "), null), w(" octaves off centre")]; },
      read: (g) => g.reg,
      edit: null,
      why: () => "written as a formula; the record's own chairs carry the " +
        "sounding register (cast.reg), and that is the row a hand edits" },

    { field: "parents", axis: "Cast", head: "what it comes from", rederive: "row",
      say: (g) => { const p = g.parents || {};
        const ks = Object.keys(p);
        return ks.length
          ? [w("it descends from "), val(ks.map((k) => k + " " + p[k]).join(", "), { ...p })]
          : [w("it descends from "), val("nothing the catalogue holds", null)]; },
      read: (g) => g.parents,
      edit: null,
      why: () => "a lineage is a claim about the catalogue, not a setting — " +
        "it is edited where a genre is invented (the session recipe, song.js:478)" },

    /* ------------------------- DEVELOPMENT ------------------------------ */
    /* COMPOSE, NOT RENDER (2026-09-02, the same measurement as `bars`).
       `capOf` (:571) reads the articulation while precompose is writing each
       cell's `play` row, so an edit here changes the DOCUMENT — measured on
       reggae, artic "staccato": one held step becomes a rest. A render tier
       would have handed the kernel the new word over cells still written with
       the old holds. */
    { field: "artic", axis: "Development", head: "articulation", rederive: "compose",
      say: (g) => [w("the notes are "), val(NF.ARTICS[g.artic || "normal"] || "normal", g.artic || null)],
      read: (g) => g.artic,
      edit: { kind: "enum", values: () => opts(NF.ARTICS, NF.ARTICS) },
      write: (r, v) => writeAt(r, "artic", v && NF.ARTICS[v] ? v : null),
      // capOf (:572) reads maxHold FIRST and only falls back to the articulation.
      why: (g) => g.maxHold == null ? null
        : "the row caps its holds at " + g.maxHold + " steps, and that cap wins (capOf)" },

    /* COMPOSE (2026-09-02). Same seam as `artic` and louder: `capOf` reads
       maxHold FIRST, so an edit here rewrites the `play` row of every cell —
       measured on reggae, maxHold 2: 182 steps of the document move. */
    { field: "maxHold", axis: "Development", head: "longest note", rederive: "compose",
      say: (g) => g.maxHold == null
        ? [w("the notes hold "), val("as long as the articulation lets them", null)]
        : [w("no note holds longer than "), val(g.maxHold, g.maxHold), w(" steps")],
      read: (g) => g.maxHold,
      edit: { kind: "number", min: 1, max: 12, step: 1,
        /* THE CAP THIS ROW ALREADY PLAYS UNDER (2026-09-02) — `precompose.js
           capOf` (:679), which is `HOLDCAP[artic]` when the row states no
           maxHold: 4 normal, 8 legato, 1 staccato, 12 tie. 45 anchors declare
           none, and the palette used to open all 45 at the RANGE'S FLOOR — a
           legato record whose notes hold eight steps offered "no note holds
           longer than 1 step" as its starting sentence, which is a control
           that rewrites the record the instant it is added. */
        start: (g) => { const P2 = PRE();
          return P2 && P2.capOf ? P2.capOf(g) : (g.maxHold == null ? 4 : g.maxHold); } },
      write: (r, v) => writeAt(r, "maxHold", v == null ? null : Math.max(1, Math.min(12, Math.round(v)))) },

    /* THE FIGURE ITSELF — precompose.js's IDIOM row for this anchor, said and
       refused. It is a real fact about the record ("the figure arches and
       lands on the root") and a musician should be able to READ it, but its
       owner is `precompose.js IDIOM`/`IDIOM_ANCHOR` and not the genre row, so
       there is nothing here for a write to land on. No silent grey: the
       refusal names the owner. */
    { field: "contour", axis: "Development", head: "the figure's shape", rederive: "row",
      say: (g, gk) => { const r = idiomRow(gk);
        const c = r && r.row.contour, C = c && Id.CONTOURS[c];
        return [w("the figure "), val(C ? C.w : "is not written down", c || null)]; },
      read: (g, gk) => { const r = idiomRow(gk); return r && r.row.contour; },
      edit: null,
      why: () => "the figure is written in precompose.js IDIOM, per family and " +
        "per anchor — not on the genre row" },

    { field: "len", axis: "Development", head: "the phrase length", rederive: "row",
      say: (g, gk) => { const r = idiomRow(gk);
        const l = r && r.row.len, L = l && Id.LENGTHS[l];
        return [w("the phrase is "), val(L ? L.w : "not written down", l || null)]; },
      read: (g, gk) => { const r = idiomRow(gk); return r && r.row.len; },
      edit: null,
      why: () => "the phrase length is precompose.js IDIOM's, and the cell-bar " +
        "ceiling halves it to divide the form (cellBarsOf)" },

    { field: "land", axis: "Development", head: "where it lands", rederive: "row",
      say: (g, gk) => { const r = idiomRow(gk);
        const l = r && r.row.land, L = l && Id.LANDINGS[l];
        return [w("the figure "), val(L ? L.w : "lands where it lands", l || null)]; },
      read: (g, gk) => { const r = idiomRow(gk); return r && r.row.land; },
      edit: null,
      why: () => "the landing is precompose.js IDIOM's, beside the contour it " +
        "belongs to" },

    /* ---------------------------- SOUND -------------------------------- */
    { field: "drumkit", axis: "Sound", head: "the kit", rederive: "compose",
      say: (g) => [w("the drums are a "),
        val((NF.DRUMKITS[g.drumkit || "acoustic"] || "acoustic") + " kit", g.drumkit || null)],
      read: (g) => g.drumkit,
      edit: { kind: "enum", values: () => opts(NF.DRUMKITS, NF.DRUMKITS) },
      write: (r, v) => writeAt(r, "drumkit", v && NF.DRUMKITS[v] ? v : null),
      // precompose.js:2794 seats a drummer only where the row has a grid.
      why: (g) => Object.keys(g.kit || {}).length ? null
        : "this record has no drum grid, so no drummer is seated to hold a kit" },

    { field: "tone.verb", axis: "Sound", head: "the room", rederive: "compose",
      say: (g) => { const v = (g.tone || {}).verb;
        return [w("the record is "), val(v == null ? "dry" : Math.round(v * 100) + "% wet", v)]; },
      read: (g) => (g.tone || {}).verb,
      edit: { kind: "number", min: 0, max: 1, step: 0.01 },
      write: (r, v) => writeAt(r, "tone.verb", v == null ? null : Math.max(0, Math.min(1, +v))) },

    /* PORTAMENTO (2026-09-03). Paul: "We are missing a big thing: Portamento.
       Everywhere, voices, synths, and so forth... we should have it as an
       option on synths." A chair's own `glide` slider is on its sheet (the
       module's knob, in the module's unit); THESE two are the RECORD's answer,
       in seconds, and they belong in the Sound axis beside the room for the
       same reason the room does — "how this record sounds" rather than "what
       it plays". `tone.verb`'s precedent is exact, dotted path and all.
         the whole line   every note slides into the next
         the slide        only the notes the phrase MARKS (`sld`) — the 303's
                          reading, and the kernel's `slide(...)` operator is
                          how a word marks them
       500 ms is the modules' own ceiling (state-engine GLIDE_MAP) and 0 is
       absent, which is what `writeAt(null)` writes. */
    { field: "tone.glide", axis: "Sound", head: "the whole line slides",
      // RENDER, not compose, and the gate MEASURED that: a glide changes no
      // note, no cell and no chair — it changes how the note ARRIVES, which is
      // the engine's business and nothing the document has to be rebuilt for.
      rederive: "render",
      say: (g) => { const v = (g.tone || {}).glide;
        return [w("every note "), val(v == null ? "lands square"
          : "slides in over " + Math.round(v * 1000) + " ms", v)]; },
      read: (g) => (g.tone || {}).glide,
      edit: { kind: "number", min: 0, max: 0.5, step: 0.005 },
      write: (r, v) => writeAt(r, "tone.glide",
        v == null || +v <= 0 ? null : Math.max(0, Math.min(0.5, +v))) },

    { field: "tone.slide", axis: "Sound", head: "the slide", rederive: "render",
      say: (g) => { const v = (g.tone || {}).slide;
        return [w("a marked note "), val(v == null ? "lands square"
          : "slides in over " + Math.round(v * 1000) + " ms", v)]; },
      read: (g) => (g.tone || {}).slide,
      edit: { kind: "number", min: 0, max: 0.5, step: 0.005 },
      write: (r, v) => writeAt(r, "tone.slide",
        v == null || +v <= 0 ? null : Math.max(0, Math.min(0.5, +v))) },

    /* COMPOSE (2026-09-02). `deskThe` deals the record's chips onto every
       CHAIR while the record is written (`voices[].desk.fx`), and the 2026-08-27
       fold at document.js normalize retired the record-wide key — so the chips
       live in the document, not in the basis spread, and an edit here has to be
       composed again. Measured on reggae, fx ["chorus"]: six chairs move. */
    { field: "fx", axis: "Sound", head: "the chips", rederive: "compose",
      say: (g) => { const f = list(g.fx);
        return f.length ? [val(f.map((k) => (NF.FX[k] || {}).label || k).join(", "), f.slice()),
                           w(" sits on it")]
                        : [w("nothing sits on it — "), val("no chips", null)]; },
      read: (g) => g.fx,
      edit: { kind: "list", of: "enum", max: NF.MAX_FX,
        values: () => Object.keys(NF.FX).map((k) => ({ value: k, label: NF.FX[k].label || k })) },
      write: (r, v) => writeAt(r, "fx", Array.isArray(v) && v.length
        ? v.filter((k) => NF.FX[k]).slice(0, NF.MAX_FX) : null) },

    /* ------------------------- PERFORMANCE ------------------------------
       The three questions below are ASKABLE's own, and their words are read
       out of `askable.js` rather than said twice: that file's `ask` IS the
       sentence a musician answers. */
    { field: "stress", axis: "Performance", head: "the beat", rederive: "compose",
      say: (g) => [w("the band leans on the beat "), val(numWord(g.stress), g.stress),
                   w(" — " + nearWord("stress", g.stress))],
      read: (g) => g.stress,
      edit: { kind: "number", min: 0, max: 1, step: 0.01, detents: () => askOpts("stress") },
      write: (r, v) => writeAt(r, "stress", v == null ? null : Math.max(0, Math.min(1, +v))) },

    /* RENDER, AND THAT IS A DEMOTION (2026-09-02). This claimed `compose` —
       "the record is written again at this seed" — beside `stress`, which
       earns it (`grooveOf` reads stress and can move `time.groove`). Nothing in
       precompose reads `phrase`: measured over twelve anchors x five values,
       not one byte of the composed document moves, and `toGenre` spreads it to
       the kernel's arch (kernel.js:1337-1348). So the honest sentence is the
       cheaper one, and a hand that moves the breath no longer restarts the
       band. */
    { field: "phrase", axis: "Performance", head: "the line's breath",
      rederive: "render",
      say: (g) => [w("the line breathes "), val(numWord(g.phrase), g.phrase),
                   w(" — " + nearWord("phrase", g.phrase))],
      read: (g) => g.phrase,
      edit: { kind: "number", min: 0, max: 1, step: 0.01, detents: () => askOpts("phrase") },
      write: (r, v) => writeAt(r, "phrase", v == null ? null : Math.max(0, Math.min(1, +v))) },

    { field: "touch", axis: "Performance", head: "the hand", rederive: "compose",
      say: (g) => { const t = g.touch || {};
        return t.t == null && t.v == null
          ? [w("the hand is "), val("a machine", null)]
          : [w("the hand is loose by "), val(t.t, t.t), w(" steps and "),
             val(t.v, t.v), w(" in level")]; },
      read: (g) => g.touch,
      edit: { kind: "pair", keys: ["t", "v"], min: 0, max: 1, step: 0.01 },
      write: (r, v) => writeAt(r, "touch", v && (v.t != null || v.v != null) ? { ...v } : null) },

    { field: "humanize", axis: "Performance", head: "the wobble",
      rederive: "compose",
      say: (g) => g.humanize
        ? [w("the timing wobbles by "), val(g.humanize, g.humanize)]
        : [w("the timing "), val("does not wobble", g.humanize)],
      read: (g) => g.humanize,
      edit: { kind: "number", min: 0, max: 0.12, step: 0.01 },
      write: (r, v) => writeAt(r, "humanize", v ? Math.max(0, Math.min(0.12, +v)) : null) },

    /* DECORATION IS FIVE NUMBERS, NOT FOUR PRESETS. `askable.js:79` asks "how
       much decoration?" and offers four answers, which is the right QUESTION
       and the wrong menu for this table: measured 2026-09-01, the catalogue
       declares 117 ornament policies and 113 of them are none of those four
       (`gregorian` is `{pass: .35}`, `blues` is `{pass: .3, grace: .45}`).
       Offering only the presets would mean a control that cannot show you the
       value you are on — the exact grey avail.js:15 forbids — and would
       silently flatten a hundred anchors the first time anybody touched it. So
       the rule is a MAP over the five kinds `kernel.js ORNSALT` salts a die
       for, each a chance 0..1, with askable's four answers riding along as
       PRESETS. The question is still askable's; the surface is the kernel's. */
    { field: "orn", axis: "Performance", head: "decoration", rederive: "render",
      say: (g) => [w("the line takes "), val(ornWord(g.orn), g.orn || null)],
      read: (g) => g.orn,
      edit: { kind: "map", keys: () => Object.keys(K.ORNSALT),
        min: 0, max: 1, step: 0.05, presets: () => askOpts("orn") },
      write: (r, v) => writeAt(r, "orn",
        v && typeof v === "object" && Object.keys(v).length ? { ...v } : null) },
  ];

  /* ---------- the two helpers the rows above lean on ---------------------- */
  // ABSENT IS ±4 (compose.js's own literal, moved onto the row). One owner:
  // compose.js reads this same shape through its own `jitter ?? 4`.
  const JITTER_DEFAULT = 4;
  const jitterOf = (g) => Number.isInteger(g && g.jitter) && g.jitter >= 0
    ? g.jitter : JITTER_DEFAULT;
  // askable.js's own opts, by reference — the three "how much does the band
  // lean on the beat" answers are that file's words and not a second set.
  const askRow = (f) => (NuAskable.ASKABLE || []).find((r) => r.field === f);
  const askOpts = (f) => { const r = askRow(f);
    return r ? r.opts.map(([label, value]) => ({ value, label })) : []; };
  /* A NUMBER IS PRINTED AS A NUMBER (ui/explain.js:129's law — "verbatim
     data, never a prose paraphrase"); the askable word rides beside it as the
     caption, so the slot a hand drags is the number and the sentence still
     reads. */
  const numWord = (n) => n == null ? "nothing" : String(Math.round(n * 100) / 100);
  const nearWord = (f, n) => { const o = askOpts(f);
    if (!o.length) return String(n);
    if (n == null) return o[0].label;
    let best = o[0];
    for (const x of o) if (Math.abs((x.value || 0) - n) < Math.abs((best.value || 0) - n)) best = x;
    return best.label; };
  const ornWord = (v) => { const o = askOpts("orn");
    const j = JSON.stringify(v == null ? null : v);
    const hit = o.find((x) => JSON.stringify(x.value == null ? null : x.value) === j);
    if (hit) return hit.label;
    if (v == null) return "nothing";
    // no preset matches (113 of the 117 policies in the catalogue): say the
    // KINDS it names, in kernel.js's own order, with the numbers beside them —
    // data verbatim, never a paraphrase (ui/explain.js:129)
    if (typeof v === "object") {
      const ks = Object.keys(K.ORNSALT).filter((k) => v[k] != null);
      if (ks.length) return ks.map((k) => k + " " + v[k]).join(", ");
    }
    return JSON.stringify(v);
  };

  /* ======================================================================
     4 · THE MOTIFS — read-only, with their reason
     ======================================================================
     `askable.js:16-22` is the owner of this law and is QUOTED: "A drum groove,
     a bass figure, a melodic cell and a keys phrase are not knob VALUES, they
     are music — sixteen-step vectors somebody wrote." Paul said the same thing
     from the other end on 2026-09-01: "The motifs don't need to be editable.
     Just the structural rules." So these are lines, not rules: one sentence
     each, no control, and the reason is on the row — the box's own no-silent-
     grey law. Two of them take their reason from `askable.js NOT_ASKED`
     verbatim, because that file already wrote it. */
  const VECTOR_WHY = "a sixteen-step vector, not a value: the beat is written " +
    "in the motifs, and the tracker is where it is edited";
  const MOTIF = [
    { field: "kit",      axis: "Material", head: "the drum grid",
      say: (g) => [w("the drums are written out over "),
        val(Object.keys(g.kit || {}).length + " lanes", null)],
      why: () => VECTOR_WHY },
    { field: "kits",     axis: "Material", head: "the section grids",
      say: (g) => [w("it changes grid "), val(list(g.kits).length + " times", null)],
      why: () => VECTOR_WHY },
    { field: "kitVel",   axis: "Material", head: "the grid's velocities",
      say: (g) => [w("the grid carries "),
        val(Object.keys(g.kitVel || {}).length + " velocity lanes", null)],
      why: () => VECTOR_WHY },
    { field: "kitProb",  axis: "Material", head: "the grid's chances",
      say: (g) => [w("the grid carries "),
        val(Object.keys(g.kitProb || {}).length + " chance lanes", null)],
      why: () => VECTOR_WHY },
    { field: "fill",     axis: "Material", head: "the fill",
      say: (g) => [w("the fill is written over "),
        val(Object.keys(g.fill || {}).length + " lanes", null)],
      why: () => VECTOR_WHY },
    { field: "bassGrid", axis: "Material", head: "the bass grid",
      say: (g) => [w("the bass figure is written out over "),
        val(list(g.bassGrid).length + " steps", null)],
      why: () => (NuAskable.NOT_ASKED || {}).bassGrid || VECTOR_WHY },
    { field: "ghost",    axis: "Material", head: "the ghost notes",
      say: (g) => [w("the ghosting is "), val(list(g.ghost).join(", ") || "not written", null)],
      why: () => (NuAskable.NOT_ASKED || {}).ghost || VECTOR_WHY },
  ];

  /* ======================================================================
     5 · THE API
     ====================================================================== */
  const byField = {};
  for (const r of RULES) byField[r.field] = r;
  const AXES = ["Time", "Alphabet", "Material", "Form",
                "Development", "Cast", "Sound", "Performance"];
  { // the ninth-axis guard: AXES.md is the vocabulary, and a row that invents
    // a grouping fails here at load rather than in a view.
    for (const r of RULES.concat(MOTIF))
      if (AXES.indexOf(r.axis) < 0)
        throw new Error("rules: \"" + r.field + "\" claims an axis AXES.md " +
                        "does not have: " + r.axis);
  }

  const rowOf = (gk) => GENRES[gk];
  const pair = (g, gk) => typeof g === "string"
    ? { g: GENRES[g], gk: g } : { g, gk: gk || (g && g.__key) };

  /* say(g, gk) — the WHOLE record as sentences, in RULES' own order. Each
     entry is the row plus what it says about THIS anchor: the parts, whether
     the row declares the field at all, which tier the edit lands in, and the
     refusal if the field reaches nothing here. The Rules view's read half is
     this call and nothing else. */
  function say(g, gk) {
    const { g: G, gk: K2 } = pair(g, gk);
    if (!G) throw new Error("rules: no anchor \"" + gk + "\"");
    return RULES.map((r) => ({
      field: r.field, axis: r.axis, head: r.head,
      parts: r.say(G, K2),
      value: r.read ? r.read(G, K2) : undefined,
      declared: r.read ? r.read(G, K2) !== undefined : false,
      edit: r.edit || null,
      rederive: r.rederive, tier: TIERS[r.rederive],
      why: r.why ? r.why(G, K2) : null,
    }));
  }

  /* the read-only lines, same shape, `edit: null` and a reason on every one */
  function motifs(g, gk) {
    const { g: G, gk: K2 } = pair(g, gk);
    if (!G) throw new Error("rules: no anchor \"" + gk + "\"");
    return MOTIF.filter((r) => G[r.field] != null).map((r) => ({
      field: r.field, axis: r.axis, head: r.head,
      parts: r.say(G, K2), edit: null, rederive: "row", tier: TIERS.row,
      why: r.why(G, K2),
    }));
  }

  /* applyRules(row, rules) -> A NEW ROW. `GENRES` is never mutated — purity
     (test/precompose.test.js G6a) and share links (ui/atlas.js:2358, "a link
     stays good when a genre's recipe is improved") both stand on that, so this
     copies FIRST and writes into the copy. The copy is SHALLOW on purpose: the
     four closures survive a spread and would not survive JSON, and `writeAt`
     clones any nested object it walks through before it writes. */
  function applyRules(row, rules) {
    if (!row) throw new Error("rules: applyRules got no row");
    if (!rules || !rules.length) return row;
    const out = { ...row };
    for (const e of rules) {
      const r = byField[e && e.f];
      // THROW BY NAME (precompose.js:2151's law). An unknown field here is a
      // caller bug; a document arriving from another build is cleaned at the
      // door instead (song.js validateRules), which is where a stranger's
      // spelling is supposed to be dropped.
      if (!r) throw new Error("rules: no rule named \"" + (e && e.f) + "\"");
      if (!r.write) throw new Error("rules: \"" + e.f + "\" is said, not written — " +
        (r.why ? r.why(row) : "no reason given"));
      r.write(out, e.v);
    }
    return out;
  }

  /* offerable(gk, g) — THE PALETTE. Derived, never typed: the editable rules
     this row does not declare, each carrying the MEASURED reason when its
     current values make it meaningless (`avail.js:15` — grey, do not hide;
     "Hiding destroys the shape of the possible"). */
  function offerable(gk, g) {
    const { g: G, gk: K2 } = pair(g || gk, gk);
    if (!G) throw new Error("rules: no anchor \"" + gk + "\"");
    return RULES.filter((r) => r.edit && (!r.read || r.read(G, K2) === undefined))
      .map((r) => ({ field: r.field, axis: r.axis, head: r.head,
                     edit: r.edit, rederive: r.rederive, tier: TIERS[r.rederive],
                     why: r.why ? r.why(G, K2) : null }));
  }

  /* the tier one field lands in, for a view that is holding a field and not a
     row — one owner for "does this restart the record" */
  const tierOf = (f) => (byField[f] || {}).rederive || null;

  return { RULES, MOTIF, AXES, TIERS, byField,
           say, motifs, applyRules, offerable, tierOf,
           JITTER_DEFAULT, jitterOf, planRoles, progWord, nameOf,
           // the sentence-part constructors, exported so a view builds parts
           // in the same two shapes rather than inventing a third
           w, val, rowOf };
});
