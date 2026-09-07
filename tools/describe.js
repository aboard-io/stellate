// tools/describe.js — WHAT A ROW ACTUALLY IS, IN ENGLISH.
//
// Paul, 2026-09-07: "Write a routine that creates a descriptive English set of
// sentences describing a genre's instrumentation and arrangement structure.
// Feed the output of that to yourself in batches and evaluate the genres for
// period and genre accuracy."
//
// THE ONE LAW OF THIS FILE: IT NEVER READS THE ROW'S `note`. The note is the
// row's ARGUMENT for itself — it says what the row is trying to be — and an
// audit that reads it is an audit of the prose, not of the record. Everything
// below is read off (a) the compiled row in `nukernel/genres.js` and (b) the
// record `precompose.js genreToDocument` builds from it, plus (c) the score
// `document.js scoreOf` renders, which is the only witness to what SOUNDS.
// `note` is not even present in the compiled row — the build strips it — so
// this is a law the data already keeps; it is written down so nobody adds a
// require of `nukernel/genres/<key>.json` here to "get more detail".
//
// SECOND LAW: NOTHING IS RE-DERIVED. Roman numerals and cadences come from
// tools/theory.js, every display word comes from nukernel/fields.js (SWINGS,
// KITLABEL, BASSOPS, ROLES, FXLABEL, the master and bus labels), the drum lane
// names come from genres-tables.js DRUMNAME and the dynamic figure's own
// sentence comes from its FIGURES entry. What this file writes itself is the
// GRAMMAR — which facts become which sentence — and nothing else.
//
// UMD, zero dependencies, node and browser, like tools/theory.js.
//
//   node tools/describe.js techno            one description
//   node tools/describe.js --all --out DIR   all 500, one .txt per key
//   node tools/describe.js --batch 3         batch 3 of 25, numbered, for review
//   node tools/describe.js --batch 3 --size 25
//
(function (root) {
  "use strict";

  const NODE = (typeof module !== "undefined" && module.exports);
  const req = NODE ? require : null;
  const NG = NODE ? req("../nukernel/genres.js")       : root.NuGenres;
  const GT = NODE ? req("../nukernel/genres-tables.js"): root.NuGenreTables;
  const NF = NODE ? req("../nukernel/fields.js")       : root.NuFields;
  const NP = NODE ? req("../nukernel/precompose.js")   : root.NuPrecompose;
  const ND = NODE ? req("../nukernel/document.js")     : root.NuDocument;
  const NI = NODE ? req("../nukernel/instruments.js")  : root.NuInstruments;
  const NT = NODE ? req("./theory.js")                 : root.NuTheory;

  const GENRES = NG.GENRES;

  /* ====================================================================== *
   * 0 · SMALL WORDS                                                         *
   * ====================================================================== */

  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const list = (a, join) => {
    const x = a.filter(Boolean);
    if (!x.length) return "";
    if (x.length === 1) return x[0];
    return x.slice(0, -1).join(", ") + " " + (join || "and") + " " + x[x.length - 1];
  };
  const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven",
               "eight", "nine", "ten", "eleven", "twelve", "thirteen",
               "fourteen", "fifteen", "sixteen"];
  const num = (n) => (n >= 0 && n < NUM.length ? NUM[n] : String(n));
  const titleOf = (k) => (GENRES[k] && GENRES[k].label) || k;
  const instrWord = (id) => String(id || "")
    .replace(/^found:collage:/, "a sampled ").replace(/^found:/, "a found ")
    .replace(/_/g, " ");

  // A STEP OF A BAR, NAMED THE WAY A DRUMMER NAMES IT. `N` is the kit array's
  // own length, which is the bar in steps; the subdivision is 4 where the bar
  // divides by 4 (16 = 4/4 in sixteenths, 12 = 3/4) and 3 where it does not
  // (14 = 7/8 in eighths reads as sevens, and is listed rather than named).
  // A BAR THAT DIVIDES BY NEITHER FOUR NOR THREE is an ODD METER, and the
  // honest reading is in EIGHTHS: progmetal's 7/8 is fourteen sixteenths, so
  // two steps to the eighth and seven eighths to the bar. Saying "step 11"
  // was true and unreadable.
  const sayStep = (i, N) => {
    const sub = (N % 4 === 0) ? 4 : (N % 3 === 0 ? 3 : (N % 2 === 0 ? 2 : 0));
    if (!sub) return "step " + (i + 1);
    if (sub === 2) return (Math.floor(i / 2) + 1) + (i % 2 ? "&" : "");
    const beat = Math.floor(i / sub) + 1;
    const mark = (sub === 4 ? ["", "e", "&", "a"] : ["", "ti", "&"])[i % sub];
    return beat + mark;
  };
  // THE NEAREST WORD TO A NUMBER — `precompose.js nearestKey`'s question,
  // asked here of fields.js SWINGS so a row's ratio prints as a word.
  const nearWord = (table, v) => {
    let best = null, d = Infinity;
    for (const k of Object.keys(table)) {
      const gap = Math.abs(table[k] - v);
      if (gap < d) { d = gap; best = k; }
    }
    return best;
  };
  const onsets = (arr) => arr.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  // A GRID, NAMED IF IT HAS A NAME. Everything here is stated relative to the
  // bar's own length, so a 12-step waltz gets "on every beat" rather than the
  // 4/4 answer with three quarters of it missing.
  function gridWord(pos, N) {
    if (!pos.length) return null;
    const sub = (N % 4 === 0) ? 4 : (N % 3 === 0 ? 3 : 0);
    const every = (step, from) => {
      const want = []; for (let i = from; i < N; i += step) want.push(i);
      return same(pos, want);
    };
    if (pos.length === N) return "on every step";
    if (sub) {
      if (every(1, 0)) return "on every step";
      if (every(sub / 2 | 0, 0) && sub === 4) return "straight eighths";
      if (every(sub, 0)) return "on every beat";
      if (sub === 4 && every(2, 1)) return "on every offbeat sixteenth";
      if (sub === 4 && every(4, 2)) return "on the offbeat eighths — the upstroke";
      if (sub === 4 && same(pos, [0, 8]) && N === 16) return "on 1 and 3";
      if (sub === 4 && same(pos, [4, 12]) && N === 16) return "on 2 and 4 — the backbeat";
      if (sub === 4 && same(pos, [8]) && N === 16) return "on the 3 alone — the one drop";
      if (sub === 4 && same(pos, [0]) ) return "on the downbeat alone";
    }
    // A LANE WITH MORE THAN SIX ONSETS AND NO NAME is a wall, and listing
    // fourteen step names spends the budget saying "busy". Six and a count.
    if (pos.length > 6)
      return "on " + pos.slice(0, 5).map((i) => sayStep(i, N)).join(", ")
             + " and " + (pos.length - 5) + " more";
    return "on " + list(pos.map((i) => sayStep(i, N)));
  }

  /* ====================================================================== *
   * 1 · THE FACTS — everything the sentences are made of, as data.          *
   * ====================================================================== *
   * Exported on its own because `test/describe.test.js` asserts that a row
   * declaring X produces a description that SAYS X, and a gate that has to
   * regex the prose for a number it can read here is a gate that breaks on a
   * comma. The prose is built from this object and from nothing else.       */

  function factsOf(key, opts) {
    const o = opts || {};
    const G = GENRES[key];
    if (!G) return null;
    const seed = o.seed == null ? 2 : o.seed;
    const doc = NP.genreToDocument(key, seed);
    const fleet = o.fleet || [];
    let score = null;
    try { score = ND.scoreOf(doc, GENRES, fleet); } catch (e) { score = null; }

    const f = { key, label: G.label || key, family: G.family || null,
                plan: G.plan, near: G.near || null,
                parents: G.parents || null, doc };

    /* ---- time ---------------------------------------------------------- */
    f.bpm = G.bpm;
    f.docBpm = doc.time.bpm;
    f.rate = G.rate == null ? 1 : G.rate;
    f.meter = G.meter || null;
    f.meterWord = G.meter ? (NF.METERLABEL[G.meter] || String(G.meter))
                          : "four to the bar";
    // THE ROW'S SWING, NOT THE READING'S. `compose.js:2546` rolls a swing
    // word on a 30% chance for any row that declares none, so 377 of the 500
    // records carry a `time.swing` their genre never asked for; describing
    // that would put swung eighths on techno and on bossa and manufacture
    // three hundred false findings. `rolledSwing` keeps the reading's answer
    // for anyone who wants it (the audit does).
    f.swingRatio = typeof G.swing === "number" ? G.swing : null;
    f.swing = f.swingRatio == null ? null
      : nearWord(NF.SWINGS, f.swingRatio);
    f.rolledSwing = doc.time.swing || null;
    f.groove = doc.time.groove || null;
    f.bars = G.bars == null ? 4 : G.bars;
    f.paces = G.paces || null;

    /* ---- alphabet and harmony ------------------------------------------ */
    const A = doc.alphabet || {};
    f.keyPc = (((A.key || 0) % 12) + 12) % 12;
    f.keyName = NF.KEYNAMES[f.keyPc];
    f.mode = A.scale || A.mode || "ionian";
    f.modeWord = NG.MODELABEL[f.mode] || NG.SCALELABEL[f.mode] || f.mode;
    f.harmony = G.harmony;
    f.harmonyWord = (NG.HARMONYLABEL[G.harmony] || G.harmony).split(" — ")[1]
                    || G.harmony;
    f.diatonic = !!G.diatonic;
    f.prog = A.prog || null;
    f.progDeclared = !!(G.prog || G.roots);
    // THE 175 THAT THROW IT AWAY: kernel.js chordsOf, `if (!g.prog ||
    // g.harmony !== "cycle")` — a record whose harmony is not `cycle` gets a
    // bare mode triad on the melody's own degree, every bar, and the chord
    // list the document files is never asked for.
    f.progRead = G.harmony === "cycle";
    f.romans = f.progRead ? romansOf(f) : null;
    f.cadence = f.progRead ? cadenceWord(f) : null;

    /* ---- the cast ------------------------------------------------------ */
    f.chairs = (doc.voices || []).filter((v) => v.kind === "line").map((v) => {
      const c = v.cast || {};
      const vi = (doc.voices || []).filter((x) => x.kind === "line").indexOf(v);
      // WHOSE VOICE THIS CHAIR IS. The row's own `throat` closure outranks the
      // cast (instruments.js §THROAT precedence), and a chair on an instrument
      // nobody sings through answers null for both.
      // ...AND ONLY WHERE A PERSON IS SINGING. `throatKeyOf` answers null for
      // an id `PATCH_VOICE` does not claim, which is the test for "is this
      // chair a singer at all"; without the gate the row's own closure hands
      // an ALTO to gospelpop's clean guitar and a BASS to hymn's harpsichord.
      let th = null;
      try {
        th = NI.throatKeyOf(key, v.instrument);
        if (th && G.throat) th = G.throat(vi) || th;
      } catch (e) { th = null; }
      return { name: v.name, part: c.part || v.name, instr: v.instrument,
               reg: c.reg == null ? 0 : c.reg, entry: c.entry || 0,
               throat: th || null, desk: v.desk || null,
               outIn: Object.keys(v.development || {})
                        .filter((s) => v.development[s] === "out").length };
    });
    // WHAT EACH CHAIR IS TOLD TO DO. `words` is the row's own English for its
    // `word` closure — the licensed operators per voice — and it is the one
    // place the arrangement's actual gesture is stated (ska's "double skank",
    // dub's "the line, mostly dropped out"). Leaving it out described ska with
    // no skank, which is the genre.
    f.told = (G.words || []).filter(Boolean);
    f.voices = G.voices;
    f.artic = G.artic || "normal";
    f.maxHold = G.maxHold == null ? null : G.maxHold;
    f.instrumental = !!G.instrumental;
    f.guests = G.guests || null;
    f.throat = G.throat || null;
    f.orn = G.orn || null;

    /* ---- the kit ------------------------------------------------------- */
    f.drumkit = G.drumkit || null;
    f.drumkitWord = G.drumkit ? (NF.DRUMKITS[G.drumkit] || G.drumkit) : null;
    f.kit = G.kit || null;
    // A KEY THAT IS NOT A LANE LETTER IS A SIDECAR, and kernel.js:3196 says so
    // in as many words: `~` is a timing nudge, `?` a chance vector, `!` a
    // grace. Reading them as lanes prints blues with two kicks and two rides,
    // which is exactly the "declared but never arriving" error in reverse —
    // a thing described that is not there. They are named as what they are.
    f.kitLanes = []; f.sidecars = [];
    if (G.kit) for (const lane of Object.keys(G.kit)) {
      const arr = G.kit[lane];
      if (!Array.isArray(arr)) continue;
      const mark = /^[~?!]/.test(lane) ? lane[0] : "";
      const bare = lane.replace(/^[~?!]/, "");
      const nm = NG.DRUMNAME[bare] || bare;
      if (mark) {
        f.sidecars.push({ lane: bare, name: nm, mark,
          word: mark === "~" ? "a timing nudge on the " + nm
              : mark === "?" ? "the " + nm + " only sometimes"
              : "grace notes on the " + nm });
        continue;
      }
      const pos = onsets(arr);
      if (!pos.length) continue;
      f.kitLanes.push({ lane: bare, name: nm,
                        n: pos.length, word: gridWord(pos, arr.length),
                        steps: arr.length });
    }
    f.fill = G.fill ? [...new Set(Object.keys(G.fill)
      .filter((l) => !/^[~?!]/.test(l))
      .map((l) => NG.DRUMNAME[l] || l))] : null;
    f.ghost = !!G.ghost;

    /* ---- the bass ------------------------------------------------------ */
    const bv = (doc.voices || []).find((v) => v.kind === "bass");
    f.nobass = !!G.nobass;
    f.bassStyle = G.bassStyle || null;
    f.bassWord = G.bassStyle ? (NF.BASSOPS[G.bassStyle] || G.bassStyle) : null;
    f.bassInstr = G.bassInstr || (f.nobass ? null : NI.BASS_INSTR);
    f.bassMoves = bv ? [...new Set(Object.values(bv.development || {})
                        .filter(Boolean))].map((w) => NF.BASSOPS[w] || w) : [];

    /* ---- the form ------------------------------------------------------ */
    const secs = doc.form.sections || [];
    f.sections = secs.map((s) => ({ role: s.role, bars: s.bars,
      changes: ["lvl", "env", "mot", "intro", "outro", "period", "echo", "rev"]
                 .filter((k) => s[k]) }));
    f.totalBars = secs.reduce((a, s) => a + (s.bars || 0), 0);
    f.roles = [...new Set(secs.map((s) => s.role))];
    f.introWord = G.intro ? (NF.INLABEL[G.intro] || G.intro) : null;

    const kv = (doc.voices || []).find((v) => v.kind === "drums");
    f.kitMoves = kv ? [...new Set(Object.values(kv.development || {})
                        .filter(Boolean))].map((w) => NF.KITLABEL[w] || w) : [];

    /* ---- the per-note dynamic figure ------------------------------------ */
    f.dyn = G.dyn || "lean";
    f.dynWord = (GT.FIGURES[f.dyn] && GT.FIGURES[f.dyn].w) || f.dyn;
    f.dynStated = !!G.dyn;
    f.stress = G.stress; f.phrase = G.phrase;
    f.touch = G.touch || null;

    /* ---- sound and production ------------------------------------------- */
    /* ...AND HOW MUCH OF IT (2026-09-07, the auto-wah round). A chip the row
       has turned DOWN is a different production decision from the same chip at
       the shared default, and this line printed the two the same way — which is
       how `bleakprog` came to read "auto-wah across the record" while the chip
       was running at nine parts wet and costing the record 4.28 dB of RMS. The
       word is FXWETLABEL's, the one a hand reads on the board's own knob, so
       the prose and the surface cannot drift. A row that states nothing prints
       the bare label it always printed. */
    f.fx = (G.fx || []).map((x) => NF.FXLABEL[x] || x);
    // ...AND `fxSay` IS THE SAME LIST WITH THE AMOUNT ON IT. Two facts and not
    // one, because §B3 asks of the FACTS and not of the prose: `f.fx` must stay
    // the bare FXLABEL words it has always been (that gate's whole job is to
    // catch a table lookup that missed, and it cannot tell a decorated label
    // from a raw key), while the SENTENCE is free to say how much.
    f.fxSay = (G.fx || []).map((x) => {
      const label = NF.FXLABEL[x] || x;
      const a = G.fxAmt && G.fxAmt[x];
      const spec = typeof a === "string" ? { wet: a }
        : (a && typeof a === "object" && !Array.isArray(a) ? a : null);
      const w = spec && NF.FXWETLABEL[spec.wet];
      return w ? label + " (" + w + ")" : label;
    });
    f.tone = G.tone || {};
    f.synth = G.synth || null;
    const M = (doc.sound && doc.sound.master) || {};
    f.master = [M.glue && NF.GLUELABEL[M.glue], M.tape && NF.TAPELABEL[M.tape],
                M.space && NF.SPACELABEL[M.space], M.tilt && (NF.TILTLABEL[M.tilt] + " tilt"),
                M.ceiling && (NF.CEILINGLABEL[M.ceiling] + " ceiling")].filter(Boolean);
    const B = (doc.sound && doc.sound.buses) || {};
    f.buses = [];
    if (B.rev) f.buses.push("a " + (B.rev.color || "") + " reverb, "
      + (NF.RETURNLABEL[B.rev.ret] || B.rev.ret));
    if (B.echo) f.buses.push("a " + (NF.DTLABEL[B.echo.time] || B.echo.time) + " echo");

    /* ---- refusals -------------------------------------------------------- */
    f.cannot = (G.cannot || []).map(shortRefusal);
    f.copyist = G.copyist || null;

    /* ---- and what actually sounds ---------------------------------------- */
    f.render = null;
    if (score && score.events) {
      const c = { line: 0, bass: 0, hit: 0 };
      for (const e of score.events) if (c[e.kind] != null) c[e.kind]++;
      f.render = { bars: score.bars, ...c };
    }
    return f;
  }

  // A REFUSAL, SHORTENED TO ITS CLAIM. The row's `cannot` sentences run to
  // sixty words apiece and the description has a two-hundred-word budget; the
  // claim is always before the first em-dash, colon or comma, and the argument
  // is always after it.
  function shortRefusal(s) {
    const t = String(s || "").replace(/`/g, "");
    const cut = t.search(/ — |: |, /);
    const head = cut > 0 ? t.slice(0, cut) : t;
    return head.length > 78 ? head.slice(0, 75).replace(/\s\S*$/, "") + "…" : head;
  }

  /* ====================================================================== *
   * 2 · THE HARMONY, THROUGH tools/theory.js                                *
   * ====================================================================== *
   * The chord list the document files is {d, q} — a DEGREE of the row's mode
   * and a quality — and the kernel builds its pitch classes exactly as
   * `chordsOf` does (QSTEPS off the mode, QFIX absolute). theory.romanOf then
   * reads the simultaneity, so the numeral printed here is the numeral the
   * record's own pitches spell, not one this file guessed from the degree.  */

  function chordPcs(c, md) {
    const K = NODE ? req("../nukernel/kernel.js") : root.NuKernel;
    const d = c.d || 0, q = c.q || "triad";
    const root = K.mp(d, md) + (c.borrow || 0);
    if (K.QFIX[q]) return K.QFIX[q].map((x) => root + x);
    return (K.QSTEPS[q] || K.QSTEPS.triad).map((s) => K.mp(d + s, md) + (c.borrow || 0));
  }

  const modeArrOf = (f) => {
    const m = f.doc.alphabet.mode;
    if (Array.isArray(m)) return m;
    return NG.MODES[m] || NT.MODES[m] || NT.MODES.major;
  };

  function romansOf(f) {
    const md = modeArrOf(f), out = [];
    for (const slot of (f.prog || [])) {
      const bar = Array.isArray(slot) ? slot : [slot];
      const here = bar.map((c) => {
        // THE PITCHES ARE TONIC-RELATIVE — `kernel.mp(d, md)` counts from
        // degree 0 of the mode, not from the record's transposition — so the
        // key handed to theory.js is 0. Passing `f.keyPc` reads every numeral
        // a transposition sharp: bossa's I7 ii7 V7 came out bVI7 bvii7 bIII7.
        const r = NT.romanOf(chordPcs(c, md).map((n) => n + 60),
                             { key: 0, mode: md });
        return (r && r.roman) || ("deg " + (c.d || 0));
      });
      out.push(here.join("–"));
    }
    return out;
  }

  function cadenceWord(f) {
    const p = f.prog || [];
    if (p.length < 2) return null;
    const md = modeArrOf(f);
    const flat = (s) => (Array.isArray(s) ? s[s.length - 1] : s);
    const a = chordPcs(flat(p[p.length - 2]), md).map((n) => n + 60);
    const b = chordPcs(flat(p[p.length - 1]), md).map((n) => n + 60);
    return NT.cadenceOf(a, b, { key: 0, mode: md });
  }

  /* ====================================================================== *
   * 3 · THE SENTENCES                                                       *
   * ====================================================================== */

  function describe(key, opts) {
    const f = factsOf(key, opts);
    if (!f) return null;
    const S = [];

    /* --- who it is, when, and on what clock ----------------------------- */
    S.push(key.replace(/_/g, " ").toUpperCase() + " — \u201c" + f.label + "\u201d"
      + (f.family ? ", " + f.family + " family" : "") + ", " + f.plan + " plan"
      + (f.near ? ", near " + f.near : "") + "; " + f.bpm + " BPM, "
      + f.meterWord
      + (f.rate !== 1 ? " at " + (f.rate < 1 ? "half" : "double") + " rate" : "")
      + ", " + f.bars + "-bar loop, "
      + (f.swing && f.swing !== "straight"
          ? (NF.SWINGLABEL[f.swing] || f.swing) + " eighths" : "straight eighths")
      /* AND THE GROOVE WORD IS A KIT FACT NOW, SO IT IS SAID AS ONE
         (2026-09-07, the twelve questions, 3). This read `"<word> feel"`,
         which was fair while the word came off a swing ratio and a stress
         number; it is derived from `G.kit` today and printing "straight feel"
         next to "shuffle eighths" would read as a contradiction where there is
         none — the shuffle is the SWING and the word is what the DRUMS mark. */
      + (f.groove ? ", the kit " + (NF.GROOVELABEL[f.groove] || f.groove) : "") + ".");

    /* --- key, mode, and whether the changes are even read ---------------- */
    S.push(f.keyName + " " + f.modeWord + (f.diatonic ? ", diatonic" : "")
      + "; harmony is " + f.harmony + " \u2014 " + f.harmonyWord
      + (f.progRead
        ? ": " + (f.romans || []).join(" | ")
          + (f.cadence ? ", closing on " + cadWord(f.cadence) : "")
        : (f.harmony === "emergent"
            ? ", so no chord list is read at all"
            : ", so the progression the record files is never read and every "
              + "bar is the bare mode triad"))
      + ".");

    /* --- the cast, chair by chair --------------------------------------- */
    if (f.chairs.length) {
      S.push(cap(num(f.chairs.length)) + (f.chairs.length === 1 ? " chair: " : " chairs: ")
        + f.chairs.map((c) => (NF.PARTLABEL[c.part] || c.part) + " on "
            + instrWord(c.instr) + (c.throat ? " (" + c.throat + ")" : "")
            + regWord(c.reg)
            + (c.entry ? ", in at section " + c.entry : "")).join(", ") + "."
        + (f.artic !== "normal" ? " Played " + f.artic + "." : "")
        + (f.instrumental ? " Instrumental \u2014 no singer." : "")
        + (f.orn ? " Ornamented." : "")
        + (f.told.length ? " The parts are told: " + f.told.join("; ") + "." : ""));
    }

    /* --- the kit -------------------------------------------------------- */
    S.push(f.kitLanes.length
      ? "The " + (f.drumkitWord || "default") + " kit: "
        + f.kitLanes.map((l) => l.name + " " + l.word).join(", ") + "."
        + (f.sidecars.length ? " With " + list(f.sidecars.map((x) => x.word)) + "." : "")
        + (f.fill ? " Fills add " + list(f.fill) + "." : "")
        + (f.kitMoves.length ? " Over the form: "
            + f.kitMoves.slice(0, 3).join(", ") + "." : "")
      : "No kit \u2014 the row writes no drum pattern"
        + (f.drumkitWord ? ", though it names the " + f.drumkitWord + " kit" : "") + ".");

    /* --- the bass ------------------------------------------------------- */
    S.push(f.nobass
      ? "No bass at all."
      : "Bass: " + (f.bassWord ? "a " + f.bassWord + " figure" : "the unfigured default")
        + " on " + instrWord(f.bassInstr)
        + (f.bassMoves.length > 1 ? ", going to " + f.bassMoves.slice(0, 3).join("/")
            + " section by section" : "") + ".");

    /* --- the form ------------------------------------------------------- */
    S.push(cap(num(f.sections.length)) + " sections over " + f.totalBars + " bars: "
      + formWord(f) + ". " + cap(list(changeWords(f).slice(0, 3)))
      + " change between them"
      + (f.introWord ? "; it comes in on " + f.introWord : "") + ".");

    /* --- the per-note figure -------------------------------------------- */
    S.push("Dynamics: it " + f.dynWord.replace(/^every note the same$/, "plays every note the same")
      + (f.dynStated ? "" : " (nothing declared \u2014 the default)")
      + ".");

    /* --- production ----------------------------------------------------- */
    S.push("Sound: " + toneWord(f)
      + (f.fx.length ? "; " + list(f.fxSay) + " across the record" : "; no effect chips")
      + (f.master.length ? "; mastered " + f.master.slice(0, 2).join(", ") : "")
      + (f.buses.length ? "; sends are " + list(f.buses) : "") + ".");

    /* --- refusals ------------------------------------------------------- */
    if (f.cannot.length || f.copyist) {
      S.push("It refuses "
        + list(f.cannot.slice(0, 3).concat(f.copyist
            ? ["the part-writing pass (" + (f.copyist.refuse === "all" ? "all of it"
                : [].concat(f.copyist.refuse).join(", ")) + ")"] : [])) + ".");
    }

    /* --- and what actually sounds ---------------------------------------- */
    if (f.render) S.push("Renders " + f.render.line + " melodic notes, "
      + f.render.bass + " bass, " + f.render.hit + " hits over "
      + f.render.bars + " bars.");

    return S.join(" ");
  }

  // THE FORM, SUMMARISED BY ROLE rather than listed section by section: a
  // thirteen-section list is forty words of the two-hundred-word budget and
  // says less than "three verses of eight" does.
  function formWord(f) {
    const by = new Map();
    for (const s of f.sections) {
      const k = s.role, e = by.get(k) || { n: 0, bars: new Set() };
      e.n++; e.bars.add(s.bars); by.set(k, e);
    }
    return [...by.entries()].map(([role, e]) => {
      const b = [...e.bars].sort((x, y) => x - y).join("/");
      const w = NF.ROLES[role] || role;
      return (e.n > 1 ? e.n + " " : "") + w
             + (e.n > 1 ? (/s$/.test(w) ? "es" : "s") : "") + " " + b;
    }).join(", ");
  }

  const CAD = { PAC: "a perfect authentic cadence", IAC: "an imperfect authentic cadence",
                half: "a half cadence", plagal: "a plagal cadence",
                deceptive: "a deceptive cadence", phrygian: "a phrygian half cadence" };
  const cadWord = (c) => CAD[c] || c;

  const regWord = (r) => (!r ? "" : r > 0
    ? " " + (r === 1 ? "an octave" : num(r) + " octaves") + " up"
    : " " + (r === -1 ? "an octave" : num(-r) + " octaves") + " down");

  function changeWords(f) {
    const seen = {};
    for (const s of f.sections) for (const c of s.changes) seen[c] = 1;
    const W = { lvl: "level", env: "envelope", mot: "filter motion",
                intro: "the way it comes in", outro: "the way it goes out",
                period: "the period", echo: "the echo send", rev: "the reverb send" };
    const out = Object.keys(seen).map((k) => W[k] || k);
    return out.length ? out : ["nothing but the material"];
  }

  function toneWord(f) {
    const t = f.tone || {}, bits = [];
    // THE SIGNATURE SYNTH BY ITS OWN NAME. `root` is what the machine is
    // called (DX7); `dsp` is the module. Underscores are hyphenated because a
    // registry id in a sentence is the raw key the gate refuses.
    if (f.synth && (f.synth.root || f.synth.dsp))
      bits.push("a signature " + String(f.synth.root || f.synth.dsp).replace(/_/g, "-"));
    if (t.wave) bits.push("a " + t.wave + " wave");
    if (t.cut) bits.push("filtered at " + t.cut + " Hz");
    if (t.glide) bits.push("portamento " + t.glide + "s");
    if (t.slide) bits.push("a " + t.slide + "s slide on marked notes");
    if (t.verb) bits.push("reverb " + t.verb);
    return bits.length ? list(bits) : "the default voice";
  }

  /* ====================================================================== *
   * 4 · THE CLI                                                             *
   * ====================================================================== */

  const api = { describe, factsOf, gridWord, sayStep, keys: () => Object.keys(GENRES) };
  if (NODE) module.exports = api; else root.NuDescribe = api;

  if (NODE && require.main === module) {
    const argv = process.argv.slice(2);
    const flag = (n) => { const i = argv.indexOf(n); return i < 0 ? null : argv[i + 1]; };
    const keys = Object.keys(GENRES);
    if (argv.includes("--all")) {
      const dir = flag("--out") || "scratch/genre-qa/describe";
      const fs = require("fs"), path = require("path");
      fs.mkdirSync(dir, { recursive: true });
      let n = 0;
      for (const k of keys) {
        const d = describe(k);
        if (d) { fs.writeFileSync(path.join(dir, k + ".txt"), d + "\n"); n++; }
      }
      console.log("wrote " + n + " descriptions to " + dir);
    } else if (argv.includes("--batch")) {
      const size = +(flag("--size") || 25);
      const b = +(flag("--batch") || 1);
      const from = (b - 1) * size, to = Math.min(keys.length, from + size);
      console.log("BATCH " + b + " — rows " + (from + 1) + "–" + to
                  + " of " + keys.length + "\n");
      for (let i = from; i < to; i++) {
        console.log((i + 1) + ". " + keys[i].toUpperCase() + "\n" + describe(keys[i]) + "\n");
      }
    } else if (argv.length && GENRES[argv[0]]) {
      console.log(describe(argv[0]));
    } else {
      console.log("usage: node tools/describe.js <key> | --all --out DIR | --batch N [--size 25]");
      if (argv.length) console.log("no such genre: " + argv[0]);
      process.exitCode = argv.length ? 1 : 0;
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
