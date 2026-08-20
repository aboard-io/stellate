// nukernel/chair.js — THE CHAIR: the one interview engine every musician
// sits in. Pure: no DOM, no audio, no state — the same law as the kits it
// serves, because it IS the kits' shared half.
//
// WHY THIS FILE EXISTS. Six chair files each carried a verbatim copy of the
// same mechanism — the vocabulary registrar, the decisions walker, the
// answer recorder, the step-word tables, the 16-step vector builders —
// and keys-kit vs guitar-kit measured as the same file with the nouns
// swapped (38 changed lines out of ~110 in the mechanism region). Six
// copies of a walker is six places for the next walker bug to live, so the
// mechanism moved here ONCE and the kits kept what is genuinely theirs:
// tables, grooves, figures, phrase banks, tone defaults, and the nouns.
// A chair file is CONTENT now — what this player knows — and this file is
// HOW any player is talked to.
//
// The shape of the thing (the same shape every kit already had):
//   a MODEL     one immutable object per musician; every word returns a new
//               one, which is what makes memoisation-by-identity legal
//               upstairs in band-kit
//   a VOCAB     id -> { group, words, when, apply, says, is } — the words
//               beyond the interview, each one a function from model to
//               model, offered only when it would change something
//   an INTERVIEW  an ordered table of decisions, each with options; asking,
//               answering and remembering are the engine's job, and the
//               three ways the kits genuinely diverged are DECLARED on the
//               rows instead of re-implemented around them:
//                 when(m)            a row asked only in some states (the
//                                    drummer's "which one?" needs a family)
//                 opts as a FUNCTION a row whose options depend on the model
//                                    (the grooves of the family just chosen)
//                 invalidates: []    answers that stop being answers when
//                                    this one changes (a new family reopens
//                                    the groove question)
//                 heard(m) per opt   an option offered only when it would
//                                    sound different (the melody's shapes)
//
// A DECISION IS RECORDED, NOT INFERRED. Reading the answers back off the
// model looked clever and behaved badly (choosing a job changed the hats,
// so the groove question re-opened itself) — so `answers` is its own ledger
// on the model, and `active` ("is this true right now?") is shown beside
// `answered` ("is this what they said?") exactly because the two can
// disagree. That law was learned once, in drums-kit; it lives here so no
// chair can unlearn it.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuChair = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- the bar, as vectors --------------------------------------
     Sixteen places, and four ways every kit builds a row of them: empty,
     these places, every nth place, these degrees. `z` takes an optional
     length because a melodic phrase is one, two or four bars joined. */
  const N = 16;
  const z = (n) => new Array(n || N).fill(0);
  const on = (...ix) => { const v = z(); for (const i of ix) v[i] = 1; return v; };
  const every = (n, from) => { const v = z(); for (let i = from || 0; i < N; i += n) v[i] = 1; return v; };
  const deg = (...d) => { const v = z(); d.forEach((x, i) => { v[i] = x; }); return v; };

  /* ---------- the count ------------------------------------------------
     Nobody at an instrument thinks "step ten". They count — one e and a,
     two e and a — so every sixteenth has a name and every kit says the
     same one. */
  const COUNT = ["one", "two", "three", "four"], SUB = ["", "e", "and", "a"];
  const stepWord = (i) => (i % 4 === 0) ? "on " + COUNT[i >> 2]
    : "on the " + SUB[i % 4] + " of " + COUNT[i >> 2];

  /* ---------- the vocabulary ------------------------------------------- */
  // One registrar, one entry shape. `is` defaults to never-true because most
  // words are actions, not states; a word that IS a state says so itself.
  const vocab = () => {
    const V = {};
    const add = (id, group, words, when, apply, says, is) =>
      { V[id] = { id, group, words, when, apply, says, is: is || (() => false) }; };
    return { V, add };
  };

  // is it true of this model? — never allowed to throw the tray down
  const tryIs = (o, m) => { try { return !!o.is(m); } catch (e) { return false; } };

  // the standard option mapper: what was said, and what is true, per option.
  // (band-kit uses this too — its arranger maps options against the SONG.)
  const mapOpts = (opts, said, ctx) => opts.map((o) => ({ ...o,
    answered: said === o.w, active: tryIs(o, ctx) }));

  /* ---------- the surfaces over a vocabulary ---------------------------
     Two catalog dialects survived the merge because their CONSUMERS differ:
     the pitched chairs hand the page a slim readout (id/group/words plus
     whether saying it would change anything — apply is actually run and
     diffed, because "changes" there means "makes a different model"), while
     the drummer and the bassist hand back the whole instrument row with
     changes = when alone (their `when` guards already ARE the exactness
     law, and the page reaches for .apply on the row). Collapsing them would
     have changed what a gate sees, so both are here, named for what they
     carry. */
  const catalogSlimOf = (V) => (m) => Object.values(V).map((i) => {
    let changes = false, active = false;
    try { changes = !!i.when(m) && JSON.stringify(i.apply(m)) !== JSON.stringify(m); } catch (e) {}
    try { active = !!i.is(m); } catch (e) {}
    return { id: i.id, group: i.group, words: i.words, changes, active };
  });
  const catalogFullOf = (V) => (m) => Object.values(V).map((i) => {
    let active = false, changes = false;
    try { active = !!i.is(m); } catch (e) {}
    try { changes = !!i.when(m); } catch (e) {}
    return { ...i, active, changes };
  });
  const sayOf = (V) => (m, id) => (V[id] && V[id].when(m) ? V[id].apply(m) : m);
  // says: the pitched chairs write `says` as a function always; the drummer
  // and bassist allow a plain string, so the loose reader checks
  const saysOf = (V) => (m, id) => (V[id] ? V[id].says(m) : "");
  const saysLooseOf = (V) => (m, id) => { const i = V[id]; if (!i) return "";
    return typeof i.says === "function" ? i.says(m) : i.says; };

  /* ---------- the interview --------------------------------------------
     `rows` is the kit's own table — content, in the kit's own order,
     because the order IS the musician (a bassist asks the key first; a
     drummer never asks it at all). The engine renders it against a model,
     finds the next thing worth asking, and records an answer.

     `live: true` makes answer() look the row up through decisions(m)
     rather than the raw table — which matters exactly when a row has a
     `when` guard (an unasked question cannot be answered) or function
     options (the answer must exist in the options the model was offered).
     The pitched chairs look up the RAW table on purpose: the melody's
     heard-filter hides an option from the list without making it a wrong
     answer, and band-kit answers through that gap. */
  const interview = (rows, cfg) => {
    const live = !!(cfg && cfg.live);
    const optsNow = (d, m) => (typeof d.opts === "function" ? d.opts(m) : d.opts);
    // `invalidates` is walker bookkeeping, not part of the OFFER — the
    // rendered row stays exactly what a page or a gate always saw
    const decisions = (m) => rows.map((d) => {
      const { invalidates, ...pub } = d;
      return { ...pub, answered: (m.answers || {})[d.id] || null,
        opts: optsNow(d, m).filter((o) => !o.heard || o.heard(m))
          .map((o) => ({ ...o, answered: (m.answers || {})[d.id] === o.w,
            active: tryIs(o, m) })) };
    }).filter((d) => !d.when || d.when(m));
    const nextAsk = (m) => decisions(m).find((d) => !d.answered) || null;
    const answer = (m, id, w) => {
      const d = (live ? decisions(m) : rows).find((x) => x.id === id);
      const o = d && (live ? d.opts : optsNow(d, m)).find((x) => x.w === w);
      if (!o) return m;
      const out = o.apply(m);
      const answers = { ...(out.answers || m.answers || {}), [id]: w };
      // a changed answer takes its dependents with it: a new family means
      // the groove under it must be chosen again
      const row = rows.find((x) => x.id === id);
      if (row && row.invalidates && (m.answers || {})[id] !== w)
        for (const dep of row.invalidates) delete answers[dep];
      return { ...out, answers };
    };
    return { decisions, nextAsk, answer };
  };

  /* ---------- a pitched chair, whole ------------------------------------
     The keys player, the guitarist and the singer are the SAME MUSICIAN
     shape: jobs that are kernel PARTS with a phrase each, an instrument
     list the pool can cast, a register, a panel of tone words, a bar of
     named places — and an interview over all of it. What differs is the
     nouns, so the nouns are the spec:

       jobs / instruments / reg / panel   the tables (content)
       model   { job, instr, reg }        where a blank one starts
       start   { words, says }            the word that turns the chair on
       groups  { job, instr, panel }      what the tray calls each family
       asks    { instr, job, reg }        how the interview asks
       instrSays                          "on a Rhodes" vs just "one singer"
       hit     { on, off }                "a chord " / "no chord " at a step
       vel     (job) => 2..9              how hard this chair plays

     toGenre stays in the kit: what a chair IS to the engine — parts as
     functions or fields, which register fallback, which tone defaults — is
     content, and the three kits genuinely differ there. */
  function pitchedChair(spec) {
    const JOBS = spec.jobs, INSTRUMENTS = spec.instruments,
          REG = spec.reg, PANEL = spec.panel;
    const blank = () => ({ on: false, job: spec.model.job, instr: spec.model.instr,
                           reg: spec.model.reg, tone: null, gate: null, answers: {} });
    const jobOf = (m) => JOBS[m.job] || JOBS[spec.model.job];
    const gateOf = (m) => (m.gate ? m.gate.slice() : jobOf(m).gate.slice());
    const toneOf = (m) => m.tone || {};
    // A PAD DOES NOT HEAR THE BAR. The kernel holds a pad to the next CHORD
    // on purpose — extra hits inside the bar read as a stutter, not a pad —
    // so the bar's places are offered to the jobs that can play them and to
    // nobody else. A word the instrument cannot hear is not a word.
    const rhythmic = (m) => { const p = jobOf(m).part; return !!p && p !== "pad" && p !== "drone"; };

    /* the words, beyond the interview — registered in the one canonical
       order (start, jobs, instruments, register, panel, the bar), because
       Object.values(V) is the tray and the tray's order is a contract */
    const { V, add } = vocab();
    add("start", "start", spec.start.words, (m) => !m.on,
        (m) => ({ ...m, on: true }), () => spec.start.says);
    for (const [k, j] of Object.entries(JOBS))
      add("job:" + k, spec.groups.job, [j.w],
          (m) => m.on && (m.job !== k || !!m.gate),
          (m) => ({ ...m, job: k, gate: null }), () => j.says,
          (m) => m.job === k && !m.gate);
    for (const [k, w] of Object.entries(INSTRUMENTS))
      add("instr:" + k, spec.groups.instr, [w], (m) => m.on && m.instr !== k,
          (m) => ({ ...m, instr: k }), () => spec.instrSays(w), (m) => m.instr === k);
    for (const [k, r] of Object.entries(REG))
      add("reg:" + k, "the register", [r.w], (m) => m.on && m.reg !== k,
          (m) => ({ ...m, reg: k }), () => r.w, (m) => m.reg === k);
    for (const p of PANEL)
      for (const o of p.opts)
        add("mach:" + p.id + ":" + o.w, spec.groups.panel, [o.w],
            (m) => m.on && toneOf(m)[p.key] !== o.v,
            (m) => ({ ...m, tone: { ...toneOf(m), [p.key]: o.v } }),
            () => p.ask.replace("?", ": ") + o.w,
            (m) => toneOf(m)[p.key] === o.v);
    // THE BAR — where the hands fall, one place at a time, the same sixteen
    // places the drummer and the bassist count.
    for (let i = 0; i < N; i++)
      add("hit:" + i, "the bar", [stepWord(i)], (m) => m.on && rhythmic(m),
          (m) => { const g = gateOf(m); g[i] = g[i] ? 0 : 1; return { ...m, gate: g }; },
          (m) => (gateOf(m)[i] ? spec.hit.off : spec.hit.on) + stepWord(i),
          (m) => !!gateOf(m)[i]);

    /* the interview: what you play, what your job is, where you sit, then
       the panel — the order every pitched chair asks in */
    const DECISIONS = [
      { id: "instr", ask: spec.asks.instr, opts:
        Object.entries(INSTRUMENTS).map(([k, w]) => ({
          w, is: (m) => m.instr === k, apply: (m) => ({ ...m, instr: k }) })) },
      { id: "job", ask: spec.asks.job, opts:
        Object.entries(JOBS).map(([k, j]) => ({
          w: j.w, is: (m) => m.job === k, apply: (m) => ({ ...m, job: k, gate: null }) })) },
      { id: "reg", ask: spec.asks.reg, opts:
        Object.entries(REG).map(([k, r]) => ({
          w: r.w, is: (m) => m.reg === k, apply: (m) => ({ ...m, reg: k }) })) },
      ...PANEL.map((p) => ({ id: p.id, ask: p.ask, opts: p.opts.map((o) => ({
        w: o.w, is: (m) => toneOf(m)[p.key] === o.v,
        apply: (m) => ({ ...m, tone: { ...toneOf(m), [p.key]: o.v } }) })) })),
    ];
    const { decisions, nextAsk, answer } = interview(DECISIONS, {});

    const catalog = catalogSlimOf(V);
    const offered = (m) => catalog(m).filter((i) => i.changes);
    const say = sayOf(V), says = saysOf(V);

    /* the PHRASE the engine is handed: the job's own degrees over the gate
       you can edit, at the weight this chair plays at */
    function toPattern(m) {
      const j = jobOf(m), g = gateOf(m);
      return { deg: (j.dg || z()).slice(), oct: z(),
               vel: new Array(N).fill(spec.vel(j)),
               inc: z(), stk: z(), gate: g, acc: z(), sld: z() };
    }

    return { N, JOBS, INSTRUMENTS, REG, PANEL, rhythmic, blank, V, catalog,
             offered, say, says, decisions, nextAsk, answer, toPattern,
             jobOf, gateOf, toneOf, stepWord, DECISIONS };
  }

  return { N, COUNT, SUB, stepWord, z, on, every, deg,
           vocab, tryIs, mapOpts,
           catalogSlimOf, catalogFullOf, sayOf, saysOf, saysLooseOf,
           interview, pitchedChair };
});
