// nukernel/ideas-kit.js — THE IDEAS. A melody does not belong to a player: it
// belongs to the room. Somebody writes it, and then the keys double it, the
// guitar riffs on it and the singer sings it — one idea, three realizations,
// which is why it lives here and not in any chair's file.
//
// WHAT A MELODY IS, in three parts, because that is what makes one:
//   1. A RHYTHM with somewhere to breathe. Not sixteen places the way a kit
//      is — a melodic phrase is one, two or four BARS long and the RESTS are
//      the content. A tune that plays on every sixteenth is a scale.
//   2. A CONTOUR over the harmony, not a list of pitches. Real melodies are
//      shapes that land on chord tones on the strong beats and pass between
//      them elsewhere, so this writes DEGREES (kernel `deg`, resolved against
//      the bar's own chord) and lets the harmony decide the notes. That is
//      what makes every melody here harmonically correct by construction.
//   3. AN ANSWER. Say something, say it again ending differently, then go
//      somewhere else — the difference between a hook and a loop. The same
//      law the drummer's two-bar sentence follows, at phrase scale.
//
// What it deliberately is NOT: a note-by-note random walk (measured worse
// than uniform when this repo's parent mined it — tools/mine/mine-weave.js)
// and not an average of anything (the median of a thousand melodies is a
// monotone — tools/mine/mine-melody.js uses a MEDOID for exactly this reason).
//
// The interview walker, the vocabulary registrar and the step words are
// chair.js's (NuChair); the phrase generator — the one mechanism that is
// genuinely this file's own — stays here whole.
(function (root, factory) {
  const api = factory(typeof require !== "undefined" ? require("./chair.js") : root.NuChair);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NuIdeas = api;
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";

  const N = 16;
  const { z, stepWord } = C;
  const g16 = C.on;
  // A THEME COUNTS THE WAY THE RECORD DOES. `met` is the one field (chair.js
  // METS, absent = the sixteen places every theme ever written has had) and
  // `NOF` is the bar length every loop below reads instead of the constant.
  const { metOf, regrid, barOf } = C;
  const NOF = (m) => metOf(m).steps;

  /* ---------- 1. THE RHYTHM: where the notes fall, and where they don't ---- */
  const CELLS = {
    long:   { w: "long notes", g: g16(0, 8) },
    even:   { w: "even eighths", g: g16(0, 2, 4, 6, 8, 10, 12, 14) },
    three:  { w: "three notes and a rest", g: g16(0, 2, 4) },
    pickup: { w: "a pickup into the bar", g: g16(7, 8, 12) },
    push:   { w: "pushed, off the beat", g: g16(2, 6, 10, 14) },
    gallop: { w: "a gallop", g: g16(0, 3, 4, 8, 11, 12) },
    hang:   { w: "one long note, then a run", g: g16(0, 12, 13, 14, 15) },
    call:   { w: "a short call", g: g16(0, 3, 5) },
    walkup: { w: "a walk up to the beat", g: g16(4, 5, 6, 8) },
    riff:   { w: "an insistent figure", g: g16(0, 3, 6, 8, 11, 14) },
  };

  /* ---------- 2. THE CONTOUR: the shape, in scale degrees ----------------- */
  // Each returns the degree for onset k of n. They are SHAPES, not walks:
  // where a melody goes is a decision, and a decision has a direction.
  // STEPWISE FIRST. Measured, the first cut of this table was 18% stepwise
  // motion with seven leaps in twelve notes — which is not a melody, it is a
  // broken chord, and every one of Bach, Adele and Joy Division would say the
  // same thing about it. Real tunes move by SECONDS most of the time and
  // leap on purpose. These are scale DEGREES, so ±1 is a step, and the
  // shapes are written in steps.
  const CONTOURS = {
    rise:  { w: "rises", f: (k) => k },
    arch:  { w: "arches over", f: (k, n) => { const h = Math.floor((n - 1) / 2);
              return k <= h ? k : Math.max(0, 2 * h - k); } },
    fall:  { w: "falls away", f: (k, n) => (n - 1) - k },
    hover: { w: "hovers", f: (k) => [0, 1, 0, -1][k % 4] },
    drop:  { w: "drops, then climbs", f: (k, n) => { const h = Math.floor((n - 1) / 2);
              return k <= h ? -k : -h + (k - h); } },
    // measured at 21% stepwise with eighteen leaps when it was written as a
    // wide alternation — a zigzag is a step up, a step down and a reach, not
    // an interval machine
    zig:   { w: "turns back on itself", f: (k) => [0, 1, 0, 2, 1, 3, 2][k % 7] },
    insist:{ w: "says one note, then moves", f: (k) => [0, 0, 0, 1, 2, 1][k % 6] },
    hold:  { w: "sits on one note", f: () => 0 },
  };

  /* ---------- 3. WHERE IT LANDS ------------------------------------------ */
  // The last note of a phrase is the one anybody remembers, and which chord
  // tone it is IS the feeling: the root closes, the third warms, the fifth
  // opens, the seventh leans, the note under the root pulls.
  const LANDINGS = {
    root:    { w: "lands on the root", d: 0 },
    third:   { w: "lands on the third", d: 2 },
    fifth:   { w: "lands on the fifth", d: 4 },
    seventh: { w: "leans on the seventh", d: 6 },
    lead:    { w: "hangs under the root", d: -1 },
  };

  /* ---------- 2½. THE SENTENCE: a phrase speaks in measures -------------- */
  // PLAN.md THE THEME COMPOSER §3: a theme is 2–4 measures, EACH with its
  // own rhythm cell — statement, restatement, development, landing — never
  // one cell photocopied. Father John Misty's law: no two measures of a sung
  // line scan the same; a theme has a rhythmic PROFILE — the dense bar, the
  // sparse bar, the long note where it means it.
  //
  // The measures are DERIVED from the one cell the writer chose, not asked
  // for one by one: four rhythm questions per theme would be a form to fill
  // in, and the derivations are what a musician does to a cell anyway —
  // say it (state), say it again ending differently (restate), crowd it
  // (develop), leave one long note (land), or enter already holding (carry —
  // the tie made structural: dropping a bar's first onset makes the previous
  // bar's last note hold straight across the barline, because the kernel
  // holds every note to the NEXT onset and abc.js draws exactly that hold
  // as a tie. Legato is not a switch here; it is the resting state of the
  // engine, and the sentence only decides where the seams are).
  const ROLES = {
    // the cell as written
    state:   (c) => c.slice(),
    // the same thing said again, ending differently: the last note moves to
    // the nearest free place (later if the bar has room, earlier if not) —
    // guaranteed to differ, because a cell never fills all sixteen places
    restate: (c) => {
      const g = c.slice(), N = c.length;
      let last = -1; for (let i = 0; i < N; i++) if (g[i]) last = i;
      if (last < 0) return g;
      let to = -1;
      for (let i = last + 1; i < N; i++) if (!g[i]) { to = i; break; }
      if (to < 0) for (let i = last - 1; i >= 0; i--) if (!g[i]) { to = i; break; }
      if (to >= 0) { g[last] = 0; g[to] = 1; }
      return g;
    },
    // the dense bar: an echo one step after the first onset and the middle
    // one, where the bar has room — development crowds what was stated
    develop: (c) => {
      const g = c.slice(), N = c.length;
      const on2 = []; for (let i = 0; i < N; i++) if (g[i]) on2.push(i);
      for (const i of [on2[0], on2[Math.floor(on2.length / 2)]])
        if (i != null && i + 1 < N && !g[i + 1]) g[i + 1] = 1;
      return g;
    },
    // the sparse bar: one long note where the cell's first note was
    land: (c) => {
      const g = z(c.length); const at = c.findIndex(Boolean);
      g[at < 0 ? 0 : at] = 1; return g;
    },
    // enter held: the restatement minus its first onset, so the previous
    // bar's last note ties across the line and this bar picks up mid-breath
    carry: (c) => {
      const g = ROLES.restate(c);
      const at = g.findIndex(Boolean);
      if (at >= 0 && g.filter(Boolean).length > 1) g[at] = 0;
      return g;
    },
  };
  // The named sentence plans — data, like the comp feels the desk keeps.
  // `plain` is the old law (the cell restated verbatim) and stays the
  // default so every phrase ever written renders byte-identical; the other
  // three are profiles a working writer would name. Keyed by bar count
  // because a two-bar sentence and a four-bar one are different sentences,
  // not the same one cropped.
  //
  // AND A SENTENCE MAY RUN TO EIGHT (2026-08-22). Every plan carries a row
  // for every length a theme can be, because a plan with no row falls back
  // to the photocopy — and a word that quietly does nothing is exactly what
  // `sentFirst` below refuses to offer. An eight-bar row is not the four-bar
  // row said twice (that is the tiling this length exists to end): it is one
  // arc over eight measures, the second half going somewhere the first did
  // not.
  //
  // `aabb` is the shape all four repertoire studies asked for by name —
  // statement, statement, departure, return. It is the one plan that says a
  // measure TWICE on purpose, which is why it declares `same`: the rest obey
  // the sung-line law (no two adjacent measures scan alike) and a strophic
  // form is built on breaking it. The Depeche Mode study measured the cost of
  // not having it — a two-bar cell tiled over four bars comes out A B A B
  // where the record is A A B B, a ceiling of about half before a single
  // pitch is asked about.
  const SENTENCES = {
    plain: { w: "one cell, said again", rows: null },
    vary:  { w: "say it, then vary it",
             rows: { 2: ["state", "restate"],
                     4: ["state", "restate", "develop", "land"],
                     8: ["state", "restate", "develop", "land",
                         "restate", "develop", "carry", "land"] } },
    long:  { w: "a long note, then it moves",
             rows: { 2: ["land", "restate"],
                     4: ["land", "state", "restate", "develop"],
                     8: ["land", "state", "restate", "develop",
                         "land", "restate", "develop", "carry"] } },
    hold:  { w: "carry it over the barline",
             rows: { 2: ["state", "carry"],
                     4: ["state", "carry", "develop", "carry"],
                     8: ["state", "carry", "develop", "carry",
                         "restate", "carry", "develop", "land"] } },
    // A is one measure at four bars and TWO at eight — a letter is half of
    // the half, and a two-bar letter is itself "say it, say it again ending
    // differently", which is what a strophe is.
    aabb:  { w: "twice, then somewhere else twice", same: true,
             rows: { 4: ["state", "state", "develop", "develop"],
                     8: ["state", "restate", "state", "restate",
                         "develop", "land", "develop", "land"] } },
  };

  // HOW LONG A THEME IS, AND IT GOES TO EIGHT (2026-08-22). Four was the cap,
  // and a four-bar theme TILES over anything longer: an eight-bar verse heard
  // bars one to four twice instead of its own second half. That was the single
  // biggest fit limiter the repertoire panel measured, hit by all four studies
  // independently — Yesterday's seven-bar verse, Honesty's eight-bar verse and
  // a twelve-to-sixteen-bar hymn strophe all lost their divergent second
  // halves before a note was compared. Eight bars, with a written grid
  // reachable on every one of them (`wrote`, below), is what says the rest.
  const LENGTHS = { one: { w: "one bar", bars: 1 }, two: { w: "two bars", bars: 2 },
                    four: { w: "four bars", bars: 4 },
                    eight: { w: "eight bars", bars: 8 } };
  // the longest a theme can be, and therefore wroteOf's ceiling and the
  // number of words the bar-in-hand rail has
  const MAXB = 8;
  // OCTAVES OVER MIDDLE C, the kernel's own `reg`. A tune sits an octave
  // above the keys' comping by default — the register a voice sings in and a
  // lead line lives in, not the one the chords are in.
  // OCTAVES OVER MIDDLE C, the kernel's own `reg` — and the LEAD part adds
  // an octave of its own on top (PARTS.lead ctr:+12, "up top, sings,
  // breathes"), which is why "where it sits" is 0 here and not 1: writing
  // the octave in both places put every tune in the top of the piano.
  const REG = { low: { w: "down low", v: -1 }, mid: { w: "where it sits", v: 0 },
                high: { w: "up high", v: 1 } };

  const blank = () => ({ on: false, cell: "three", contour: "arch", land: "root",
                         len: "two", reg: "mid", answer: true, name: "the hook",
                         sent: "plain", grid: null, lift: null, answers: {} });
  // THE TUNE, NOTE BY NOTE. Every other chair can refine what it plays — the
  // drummer says a place in the bar, the bassist writes a figure a note at a
  // time — and the melody could only be described by its parameters. `grid`
  // is the rhythm once you have moved it (the named cell until then) and
  // `lift` is a scale step up or down on one place, so "that third note is
  // too high" is a thing you can say.
  //
  // THE GRID IS TRI-STATE now (PLAN.md THE THEME COMPOSER §4): 0 is a rest,
  // 1 is a note, and 2 is HOLD — the tie as a MARK. "Hold it" on a place
  // means the note before it sounds THROUGH that place: the run of 2s after
  // an onset compiles to an explicit per-note `hold` on the phrase, which
  // the kernel honors past the lead part's own four-step cap (maxHold makes
  // rests real ONLY where nobody said otherwise) and abc.js draws as the
  // tied note it is. A grid with no 2s in it compiles to a phrase with no
  // `hold` key at all — the mark is present-only, like `orn`, so every
  // theme written before the mark existed renders byte-identical.
  const gridOf = (m) => (m.grid ? C.refit(m.grid, metOf(m)).slice() : cellOf(m).g.slice());
  const liftOf = (m) => ({ ...(m.lift || {}) });

  // ...and the same cells re-seated into a bar that counts differently, plus
  // the ones only that bar has. The parent's own metrical melody cells are
  // the source (engine/csd-engine.js MM_CELLS_3 / MM_CELLS_6): even quarters,
  // the dotted lilt and the minuet long-short in three; running eighths, the
  // siciliana and the two big pulses in six.
  const c12 = (...ix) => { const v = new Array(12).fill(0); for (const i of ix) v[i] = 1; return v; };
  const CELLS3 = {
    quarters: { w: "one note a beat", g: c12(0, 4, 8) },
    lilt:     { w: "a dotted lilt", g: c12(0, 6, 8) },
    minuet:   { w: "long, then short", g: c12(0, 8) },
  };
  const CELLS6 = {
    running:  { w: "running eighths", g: c12(0, 2, 4, 6, 8, 10) },
    siciliana:{ w: "a siciliana", g: c12(0, 3, 4, 6, 9, 10) },
    twopulse: { w: "the two big beats", g: c12(0, 6) },
  };
  const extraCells = (m) => { const mt = metOf(m);
    return mt.steps === 16 ? null : (mt.pulse === 6 ? CELLS6 : CELLS3); };
  const cellOf = (m) => { const x = extraCells(m);
    if (x && x[m.cell]) return x[m.cell];
    const base = CELLS[m.cell] || CELLS.three;
    return x ? { w: base.w, g: regrid(base.g, metOf(m)) } : base; };
  const barsOf = (m) => (LENGTHS[m.len] || LENGTHS.two).bars;

  /* ---------- THE WRITTEN BAR (PLAN.md THE THROUGH-COMPOSED THEME) --------
     Three modes, one data shape. DERIVED is today: one authored cell, the
     sentence derives every bar. AUTHORED is `wrote[b]` for every bar — a
     tune of up to MAXB bars with every bar its own tri-state rhythm (the
     drum phrase's lane grid is the precedent). MIXED is the interesting one:
     some bars written, the rest derived AROUND them. THE HAND MOVES LAST,
     extended to bars — a bar you wrote survives any sentence-plan change,
     and a length shrink leaves the far bars DORMANT, revived if the length
     comes back (the same law as a lift surviving the note it sits on being
     the landing). Both fields are present-only: no `wrote`, no `hand` —
     every phrase ever compiled is byte-identical.

       wrote: { [b]: { grid: [N tri-state], lift: { [i]: -2..2 },
                       octs?: { [i]: -1..1 } } }
       hand:  0..MAXB-1  which bar the count grid is aimed at — a MODEL fact
                     (aim, not sound: it changes no phrase and stays out of
                     the cache key)

     EVERY BAR IS REACHABLE, all eight of them (2026-08-22). The ceiling was
     four, which was the length cap, and a written second half is exactly
     what the repertoire panel's item 2 is about — so the ceiling is MAXB and
     moves with it rather than being a number of its own.

     PARANOIA AT THE ACCESSOR, because the session rides localStorage whole:
     a bar entry whose grid is not N ints in 0..2 is dropped, lifts are
     clamped to ±2, octaves to ±1, keys outside the theme's own places or
     0..MAXB-1 are ignored — the same law gridOf/liftOf already imply. */
  const clampMap = (src, n, lo, hi) => {
    const out = {};
    for (const [i, v] of Object.entries(src || {})) {
      const ii = +i;
      if (Number.isInteger(ii) && ii >= 0 && ii < n && Number.isFinite(v) && v)
        out[ii] = Math.max(lo, Math.min(hi, Math.round(v)));
    }
    return out;
  };
  const wroteOf = (m) => {
    const out = {};
    if (!m.wrote) return out;
    for (const [k, v] of Object.entries(m.wrote)) {
      const b = +k;
      if (!Number.isInteger(b) || b < 0 || b >= MAXB || !v) continue;
      const g = Array.isArray(v.grid) && v.grid.length === NOF(m) &&
        v.grid.every((x) => x === 0 || x === 1 || x === 2) ? v.grid.slice() : null;
      if (!g) continue;
      const bar = { grid: g, lift: clampMap(v.lift, NOF(m), -2, 2) };
      // the octave map is PRESENT-ONLY, like `hold` and `orn`: a bar written
      // before the word existed carries no `octs` key and comes back without
      // one, so every saved theme is byte-identical through this accessor
      const octs = clampMap(v.octs, NOF(m), -1, 1);
      if (Object.keys(octs).length) bar.octs = octs;
      out[b] = bar;
    }
    return out;
  };
  /* ---------- THE OCTAVE (2026-08-22) -------------------------------------
     A lift is ±2 SCALE STEPS on one place, and every theme this box has ever
     written lived inside one tessitura. That was the repertoire panel's
     dominant "off" category, hit by all four studies: a line that traverses
     an octave and a half (Bach's invention), a cadence that drops an octave
     (Honesty), a climax phrase (the hymns) and a pedal-alternating riff
     (Enjoy the Silence) are all unreachable when the widest thing anybody
     can say is "up a step".

     ONE MECHANISM AT TWO SCALES, because the studies named two shapes and
     they are the same shape said about different amounts of music: `octs` is
     a per-PLACE map exactly parallel to `lift` — base keyed %N for the
     derived bars, its own inside a WRITTEN bar — and one word says it about
     the whole bar in hand at once, writing that same map. The riff that
     alternates inside the bar is the first; the cadence and the climax are
     the second.

     AND THE REGISTRATION STAYS HONEST WITHOUT A SECOND STAMP. The kernel's
     whole-line octave shift is a mean over DEGREE-pitches with the octave
     vector deliberately left out of it ("the mean is taken over the DEGREE
     pitches only, before the step's octave displacement is added" —
     kernel.js), and 12 × oct is added on top afterwards. So an octave word
     is OUTSIDE the mean by construction and cannot flip the whole line the
     way "up a step" once did — which is the same law the regDeg stamp
     enforces for the lifts and the transforms, reached by the mechanism the
     kernel already had rather than by a second one. The lifts' stamp is
     untouched. */
  const octsOf = (m) => ({ ...(m.octs || {}) });
  // the bar in hand — aim, clamped to a bar the theme actually has
  const handOf = (m) => {
    const h = m.hand || 0;
    return Number.isInteger(h) && h >= 0 && h < barsOf(m) ? h : 0;
  };
  // RECONSTRUCT one bar of the CURRENT phrase as a tri-state cell — what
  // writing a derived bar out starts from: the onsets you heard, and the
  // places an explicit hold sounds through. Never from silence.
  const barTriOf = (m, b) => {
    const ph = toPhrase(m), N = NOF(m);
    const g = z(N);
    for (let i = 0; i < N; i++) {
      const at = b * N + i;
      if (at < ph.gate.length && ph.gate[at]) g[i] = 1;
    }
    if (ph.hold) for (let at = 0; at < ph.gate.length; at++) {
      if (!ph.gate[at] || !ph.hold[at]) continue;
      for (let j = at + 1; j < at + ph.hold[at] && j < ph.gate.length; j++)
        if (Math.floor(j / N) === b && !g[j % N]) g[j % N] = 2;
    }
    return g;
  };
  // is the count grid editing a WRITTEN bar right now? Bar one with no
  // wrote[0] edits the base cell — today's path, byte for byte.
  const editsWrote = (m) => handOf(m) > 0 || !!wroteOf(m)[0];
  const handGrid = (m) => {
    if (!editsWrote(m)) return gridOf(m);
    const h = handOf(m), wr = wroteOf(m);
    return (wr[h] ? wr[h].grid : barTriOf(m, h)).slice();
  };
  const handLift = (m) => {
    if (!editsWrote(m)) return liftOf(m);
    const wb = wroteOf(m)[handOf(m)];
    return wb ? { ...wb.lift } : {};
  };
  const handOcts = (m) => {
    if (!editsWrote(m)) return octsOf(m);
    const wb = wroteOf(m)[handOf(m)];
    return wb ? { ...(wb.octs || {}) } : {};
  };
  // one edit to the bar in hand: seeded from what the sentence was deriving
  // the first time a hand touches a derived bar, so writing out starts from
  // what you heard
  const withHandBar = (m, fn) => {
    const h = handOf(m), wr = wroteOf(m);
    const bar = wr[h] || { grid: barTriOf(m, h), lift: {} };
    const nb = fn({ grid: bar.grid.slice(), lift: { ...bar.lift },
                    octs: { ...(bar.octs || {}) } });
    // present-only: a bar nobody moved an octave stores no `octs` key, so a
    // session written before the word existed round-trips byte for byte
    if (!Object.keys(nb.octs || {}).length) delete nb.octs;
    return { ...m, wrote: { ...wr, [h]: nb } };
  };

  /* ---------- THE PHRASE THE ENGINE PLAYS --------------------------------
     One vector per bar of the idea, joined: the rhythm cell restated, the
     contour sampled across ALL its onsets (so a two-bar idea is one shape,
     not the same bar twice), and the last note of each half moved to the
     landing — the answer's landing is the OTHER one, which is the whole
     question-and-answer of it. */
  // (THE BAR LINE. A motif restated over a moving root restarts wherever the
  // root put it, and an octave-folding pass to "connect" the bars measured as
  // a no-op on every progression tried — the restatement is already within a
  // fourth of where the last bar ended, and the one big drop in the phrase is
  // the QUESTION note falling into the answer, which is the phrase working.
  // So there is no smoothing pass here, deliberately.)
  // MEMOISED, because the dedup asks for phrases in squares. Deciding which
  // shapes are worth offering compares every contour against every earlier
  // one, and each comparison built two phrases — measured, answering a
  // single arranger question cost 9 ms of phrase-building nobody heard.
  // `toPhrase` is pure, so the answer to "what does this model sound like"
  // can be remembered by the values that make it.
  const PHCACHE = new Map();
  function toPhrase(m, roots) {
    const key = m.cell + "|" + m.contour + "|" + m.land + "|" + m.len + "|" +
                m.reg + "|" + (m.answer ? 1 : 0) + "|" + (m.sent || "plain") + "|" +
                (roots ? roots.length : 0) +
                "|" + (m.grid ? m.grid.join("") : "") + "|" + JSON.stringify(m.lift || {}) +
                // the written bars enter the key; `hand` does not — hand is
                // aim, and aim changes no phrase
                // ...AND THE METER, because a twelve-step bar and a sixteen-step
                // bar are different phrases from the same answers: without it
                // a meter switch hands back a stale sixteen-step phrase and
                // the failure reads as a scheduler bug rather than a cache one
                "|" + (m.wrote ? JSON.stringify(m.wrote) : "") +
                // ...and the base octave map, present-only like the rest: an
                // unmarked theme adds an empty pair of braces and nothing else
                "|" + (m.octs ? JSON.stringify(m.octs) : "") +
                "|" + NOF(m) + ":" + metOf(m).pulse;
    let hit = PHCACHE.get(key);
    if (hit) return hit;
    hit = phraseNow(m, roots);
    if (PHCACHE.size > 500) PHCACHE.clear();
    PHCACHE.set(key, hit);
    return hit;
  }
  function phraseNow(m, roots) {
    const N = NOF(m);
    const bars = barsOf(m), cell = gridOf(m), con = CONTOURS[m.contour] || CONTOURS.arch;
    const lift = liftOf(m), octs = octsOf(m);
    const land = (LANDINGS[m.land] || LANDINGS.root).d;
    const n = bars * N;
    const gate = z(n), deg = z(n), vel = new Array(n).fill(6), oct = z(n);
    // THE HAND'S TIES. The grid is tri-state — 1 a note, 2 "hold it" — so
    // the sentence machinery sees only the ONSET mask (a hold is not a
    // place to restate), and each onset remembers the run of 2s behind it.
    // A named cell is binary, so mask === cell there and nothing moves.
    const mask = cell.map((v) => (v === 1 ? 1 : 0));
    // how far an onset's tie reaches: to the FURTHEST "hold it" mark before
    // the next note — a rest between the note and the mark is sounded
    // through, because holding through a place is the whole ask
    const runAt = (i) => { let last = i;
      for (let j = i + 1; j < N && cell[j] !== 1; j++) if (cell[j] === 2) last = j;
      return last - i; };
    const hold = z(n); let anyHold = false;
    // ONE MOTIF, RESTATED — OR A SENTENCE. The shape is sampled over each
    // bar's own onsets and said again in the next bar — which is what a hook
    // IS. (Running the contour across the whole phrase instead made every
    // bar different from every other, so there was nothing to remember; the
    // kernel transposes each bar by its own chord anyway, so a restated
    // motif over moving changes is a SEQUENCE, which is the oldest good
    // idea in melody.) A sentence plan gives each bar its own DERIVED cell
    // (statement / restatement / development / landing / carry); `plain` —
    // and any length the plan has no row for — is the photocopy, and comes
    // out byte-identical to the phrase this file always made.
    const rows = (SENTENCES[m.sent] || SENTENCES.plain).rows;
    const rowOf = rows ? rows[bars] || null : null;
    // THE HAND MOVES LAST, PER BAR (PLAN.md THE THROUGH-COMPOSED THEME): a
    // bar somebody WROTE replaces the role-derived cell for that bar — its
    // own onsets from its 1s, its own ties from its 2s — while the sentence
    // keeps deriving the OTHER bars from the base cell exactly as today.
    // No `wrote` anywhere → wr is empty and every branch below is the old
    // code path, byte for byte.
    const wr = wroteOf(m);
    const onsets = [];
    for (let b = 0; b < bars; b++) {
      const wb = wr[b] || null;
      const bg = wb ? wb.grid.map((v) => (v === 1 ? 1 : 0))
        : rowOf ? ROLES[rowOf[b]] ? ROLES[rowOf[b]](mask) : mask : mask;
      // a written bar's tie run reads its OWN grid; a derived bar keeps the
      // base cell's (the tie belongs to the place it was written on)
      const runIn = wb ? ((i) => { let last = i;
        for (let j = i + 1; j < N && wb.grid[j] !== 1; j++)
          if (wb.grid[j] === 2) last = j;
        return last - i; }) : runAt;
      const inBar = [];
      for (let i = 0; i < N; i++) if (bg[i]) inBar.push(i);
      inBar.forEach((i, j) => {
        const at = b * N + i;
        gate[at] = 1; onsets.push(at);
        deg[at] = con.f(j, inBar.length);
        // the register is the GENRE's (`reg`), not the phrase's — writing it
        // in both places put every tune an octave higher than it was asked
        // for; the phrase leans on its first note and gives back going out
        vel[at] = j === 0 ? 8 : (j === inBar.length - 1 ? 5 : 6);
        // a hand-marked hold rides with the note it was written on — an
        // onset a role MOVED leaves its tie behind (the tie belongs to the
        // place, and a restated ending is a new ending)
        const r = (wb ? true : mask[i]) ? runIn(i) : 0;
        if (r) { hold[at] = 1 + r; anyHold = true; }
      });
    }
    if (onsets.length) {
      const last = onsets[onsets.length - 1];
      deg[last] = land;
      // THE ANSWER: the first half asks (it stops somewhere unresolved) and
      // the second half answers (it lands). A phrase that ends the same way
      // twice is one phrase said twice.
      if (m.answer && bars > 1) {
        const mid = onsets.filter((x) => x < (bars / 2) * N);
        if (mid.length) deg[mid[mid.length - 1]] = land === 0 ? 4 : 0;
      }
    }
    // A SENTENCE'S TIES CROSS THE BARLINE (PLAN.md THE THEME COMPOSER §4).
    // `carry` drops a bar's first onset so the note before the line reaches
    // into it, and `land` leaves one note with a bar to itself — but the
    // lead part's own cap (maxHold 4, the rest-making law) would cut both
    // at a beat and quietly turn the tie into a rest the staff still drew.
    // So any note a SENTENCE holds across a barline gets its full span as
    // an explicit `hold`, which the kernel honors past the cap: the tie is
    // real in the air, not only on the page. Notes held WITHIN a bar keep
    // the cap — the breath between phrases is the part's own law — and
    // `plain` emits no holds at all, byte for byte the phrase it always was.
    if (rowOf) for (let k = 0; k < onsets.length; k++) {
      const at = onsets[k], next = k + 1 < onsets.length ? onsets[k + 1] : n;
      if (Math.floor(at / N) !== Math.floor((next - 1) / N)) {
        // ...unless the seam lands in a WRITTEN bar: the hand's grid owns
        // that barline — a rest it wrote at the top of its bar is a breath,
        // and its leading 2s (below) are the tie
        if (wr[Math.floor(at / N) + 1]) continue;
        hold[at] = next - at; anyHold = true;
      }
    }
    // THE TIE INTO THE BAR: a written bar whose grid OPENS with "hold it"
    // marks reaches back — the previous bar's last onset extends across the
    // line to sound through the leading run (the sentence-barline law at
    // the seam, generalized to the hand; a rest between the line and the
    // furthest mark is sounded through, because holding through a place is
    // the whole ask). Present-only: no written bar, no pass.
    for (let b = 1; b < bars; b++) {
      const wb = wr[b];
      if (!wb) continue;
      const first1 = wb.grid.indexOf(1);
      let reach = -1;
      for (let j = 0; j < (first1 < 0 ? N : first1); j++)
        if (wb.grid[j] === 2) reach = j;
      if (reach < 0) continue;
      const prev = onsets.filter((a) => a < b * N).pop();
      if (prev == null) continue;
      const span = b * N + reach + 1 - prev;
      if ((hold[prev] || 0) < span) { hold[prev] = span; anyHold = true; }
    }
    // THE HAND MOVES LAST. A step you lifted by hand is lifted even if it is
    // the note the phrase lands on — otherwise "that one is too high" did
    // nothing to exactly the notes anybody would say it about.
    //
    // ...AND REGISTER THE PHRASE, NOT THE HAND. The kernel's whole-line
    // octave shift reads a degree mean (kernel.js render, the regDeg law),
    // and a hand-lift is deliberate movement exactly like the transform's
    // step: fold it into the mean and one lifted note near the rounding
    // boundary flips the WHOLE LINE an octave the other way. So a lifted
    // phrase stamps the degrees as written pre-lift; registration reads the
    // stamp and the lift rides on top. Present-only, like `hold` — an
    // unlifted phrase carries no stamp and is byte-identical.
    // ...and a WRITTEN bar's lifts are its own, keyed by its own places —
    // which is the per-at gap closed: the base lift stays %16 for derived
    // bars (byte-identity for every saved theme), and the climb's lifts
    // stop echoing into bar one
    const liftAt = (at) => {
      const wb = wr[Math.floor(at / N)];
      return wb ? wb.lift[at % N] || 0 : lift[at % N] || 0;
    };
    const lifted = onsets.some((at) => liftAt(at));
    const regDeg = lifted ? deg.slice() : null;
    for (const at of onsets) if (liftAt(at)) deg[at] += liftAt(at);
    // THE OCTAVE RIDES THE `oct` VECTOR, which is the kernel's own lane for
    // exactly this and the one thing its register mean is documented to
    // exclude — so no stamp is needed and none is taken. A written bar's
    // octaves are its own places; the base map is %N across the derived bars,
    // the same asymmetry the lifts have and for the same reason (byte
    // identity for every theme saved before either word existed).
    const octAt = (at) => {
      const wb = wr[Math.floor(at / N)];
      return wb ? (wb.octs || {})[at % N] || 0 : octs[at % N] || 0;
    };
    for (const at of onsets) if (octAt(at)) oct[at] = octAt(at);
    const out = { deg, oct, vel, inc: z(n), stk: z(n), gate, acc: z(n), sld: z(n) };
    if (anyHold) out.hold = hold;               // present-only, like `orn`
    if (regDeg) { out.regDeg = regDeg; out.regGate = gate.slice(); }
    return out;
  }

  /* ---------- RETURN WITH TRANSFORMATION ---------------------------------
     PLAN.md THE THEME COMPOSER §5: the same theme comes back the same, up a
     step, augmented, or fragmented — the seam where the composer meets the
     improvisation engine, because trading and solos ARE transformations
     applied live. These are pure functions on the RENDERED phrase, applied
     by the section that carries the return (band-kit), never written back
     onto the theme: the theme is the claim, the transformation is one
     section's way of making it. `same` returns the phrase object untouched,
     so a section that never says the word is byte-identical. */
  const TRANSFORMS = {
    same: { w: "as it was" },
    // one scale step up, every note — the sequence's own move, diatonic by
    // construction because deg is a DEGREE and the harmony spells it
    up:   { w: "up a step" },
    // augmentation: the head of the phrase at half speed, over the same
    // bars — each onset lands at twice its place, and what no longer fits
    // has already been said
    aug:  { w: "stretched out, twice as slow" },
    // fragmentation: just its head — the first bar's material, and the last
    // note of it holds, because the kernel holds every note to the next
    // onset and there isn't one
    frag: { w: "just its head" },
  };
  function transform(ph, kind, met) {
    if (!kind || kind === "same" || !TRANSFORMS[kind]) return ph;
    const n = ph.gate.length;
    // "just its head" means the FIRST BAR, and a bar is not always sixteen
    // steps: in a waltz the head is twelve, and cutting at sixteen would
    // hand a section a bar and a third of a tune.
    const head = ((met && met.steps) || N);
    const out = { deg: z(n), oct: z(n), vel: new Array(n).fill(6), inc: z(n),
                  stk: z(n), gate: z(n), acc: z(n), sld: z(n) };
    // a tie is part of the note, so it travels with it — present-only, the
    // same law as the phrase compiler's. Augmentation doubles a hold along
    // with everything else (half speed is half speed for the long note
    // too); the fragment keeps its head's ties; `up` moves no rhythm at all.
    const hh = ph.hold ? z(n) : null;
    const put = (to, from, stretch) => { out.gate[to] = 1; out.deg[to] = ph.deg[from];
      out.oct[to] = ph.oct[from]; out.vel[to] = ph.vel[from];
      if (hh && ph.hold[from]) hh[to] = ph.hold[from] * (stretch || 1); };
    for (let i = 0; i < n; i++) {
      if (!ph.gate[i]) continue;
      if (kind === "up") { put(i, i); out.deg[i] = ph.deg[i] + 1; }
      else if (kind === "aug") { if (i * 2 < n) put(i * 2, i, 2); }
      else if (kind === "frag") { if (i < head) put(i, i); }
    }
    if (hh) out.hold = hh;
    // THE RETURN IS REGISTERED AS THE THEME. The kernel's whole-line octave
    // shift is computed from a degree mean, and a transform is deliberate
    // movement the same way the ramp is: fold "+1 on every degree" into the
    // mean and near the rounding boundary the shift flips — measured, "up a
    // step" came back an octave DOWN. So the transform carries the phrase it
    // was made from (present-only, like `hold`), the kernel registers THAT,
    // and the transform's offset rides on top. `same` returns the phrase
    // object itself above, so an untransformed return stays byte-identical.
    out.regDeg = ph.regDeg || ph.deg.slice();
    out.regGate = ph.regGate || ph.gate.slice();
    return out;
  }

  // what it sounds like, said out loud — the chyron the page can print
  const describe = (m) => [cellOf(m).w, (CONTOURS[m.contour] || {}).w,
                           (LANDINGS[m.land] || {}).w].join(", ");

  /* ---------- the words ---------- */
  const { V, add } = C.vocab();
  // the bar-in-hand words, one per bar a theme can have (MAXB). The rail in
  // ui/band.js reads this list rather than keeping its own, so a theme that
  // grew to eight bars did not leave four of them unnameable.
  const BARWORD = ["bar one", "bar two", "bar three", "bar four",
                   "bar five", "bar six", "bar seven", "bar eight"];
  // the base (unwritten) octave map, edited and left PRESENT-ONLY: emptied,
  // the key goes away rather than sitting there as {}
  const withBaseOcts = (m, fn) => {
    const o = octsOf(m); fn(o);
    for (const k of Object.keys(o)) if (!o[k]) delete o[k];
    return { ...m, octs: Object.keys(o).length ? o : null };
  };

  add("start", "start", ["write something"], (m) => !m.on,
      (m) => ({ ...m, on: true }), () => "a phrase, two bars, arching over");

  // A WORD THAT MAKES THE SAME TUNE IS NOT A WORD. Three notes in a bar can
  // only be so many shapes — over a three-note cell, "arches over",
  // "hovers" and "turns back on itself" are the identical phrase — so a
  // shape is offered only when it would come out DIFFERENT. (The model
  // moving is not enough: this file's whole job is the phrase.)
  // ...and it is asked in SQUARES (the dedup below compares every shape
  // against every earlier one), so it is remembered against the PHRASE
  // rather than recomputed: `toPhrase` is memoised and hands back the same
  // object for the same answers, which makes that object the honest key.
  // Three `toPhrase` calls per ask became one, and the string is built once
  // per distinct phrase instead of once per comparison — measured as the
  // single biggest line in a chair-rail draw (9.9% of it).
  const SOUNDS = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  const sounds = (m) => {
    const p = toPhrase(m);
    if (SOUNDS && SOUNDS.has(p)) return SOUNDS.get(p);
    const out = JSON.stringify(p.deg) + JSON.stringify(p.gate) +
                JSON.stringify(p.hold || 0);
    if (SOUNDS) SOUNDS.set(p, out);
    return out;
  };
  // ...and no two of the offered ones may sound alike EITHER. Comparing each
  // only against the current phrase left two shapes that were different from
  // what is playing and identical to each other; the first one in the table
  // wins and the rest are not asked. Deterministic, because the table has an
  // order.
  const firstOf = (field, keys) => (m, k) => {
    if (m[field] === k) return true;
    const mine = sounds({ ...m, [field]: k });
    if (mine === sounds(m)) return false;
    for (const other of keys) {
      if (other === k) break;
      if (other !== m[field] && sounds({ ...m, [field]: other }) === mine) return false;
    }
    return true;
  };
  const conFirst = firstOf("contour", Object.keys(CONTOURS));
  const cellFirst = firstOf("cell", Object.keys(CELLS));
  const sentFirst = firstOf("sent", Object.keys(SENTENCES));
  for (const [k, c] of Object.entries(CELLS))
    add("cell:" + k, "the rhythm of it", [c.w],
        (m) => m.on && m.cell !== k && cellFirst(m, k),
        (m) => ({ ...m, cell: k }), () => c.w, (m) => m.cell === k);
  // ...and the cells that only exist in a bar that counts differently. Same
  // registrar, same shape; never offered under four, so the tray is the tray.
  for (const [k, c] of Object.entries({ ...CELLS3, ...CELLS6 }))
    add("cell:" + k, "the rhythm of it", [c.w],
        (m) => m.on && !!(extraCells(m) || {})[k] && m.cell !== k,
        (m) => ({ ...m, cell: k }), () => c.w, (m) => m.cell === k);
  for (const [k, c] of Object.entries(CONTOURS))
    add("con:" + k, "the shape", [c.w],
        (m) => m.on && m.contour !== k && conFirst(m, k),
        (m) => ({ ...m, contour: k }), () => "it " + c.w, (m) => m.contour === k);
  // the sentence — only when the phrase is longer than a bar (a one-bar
  // tune has no measures to differ), and only the plans that would come out
  // audibly different over the rhythm you actually wrote
  for (const [k, s] of Object.entries(SENTENCES))
    add("sent:" + k, "how it speaks", [s.w],
        (m) => m.on && barsOf(m) > 1 && (m.sent || "plain") !== k && sentFirst(m, k),
        (m) => ({ ...m, sent: k }), () => s.w, (m) => (m.sent || "plain") === k);
  for (const [k, l] of Object.entries(LANDINGS))
    add("land:" + k, "where it lands", [l.w], (m) => m.on && m.land !== k,
        (m) => ({ ...m, land: k }), () => l.w, (m) => m.land === k);
  for (const [k, l] of Object.entries(LENGTHS))
    add("len:" + k, "how long", [l.w], (m) => m.on && m.len !== k,
        (m) => ({ ...m, len: k }), () => l.w, (m) => m.len === k);
  for (const [k, r] of Object.entries(REG))
    add("reg:" + k, "the register", [r.w], (m) => m.on && m.reg !== k,
        (m) => ({ ...m, reg: k }), () => r.w, (m) => m.reg === k);
  // THE BAR, and the three things you can say about one place in it: a note,
  // a step up or down on it — and "hold it", the tie as a mark. A place is a
  // NOTE only at grid value 1: a 2 is the previous note still sounding, so
  // the note mark re-attacks it (a tie tapped back into a note) and the
  // lift marks pass it by (there is nothing there to move).
  // ...AND EVERY MARK LANDS ON THE BAR IN HAND (PLAN.md THE THROUGH-COMPOSED
  // THEME). With no bar in hand (hand 0, nothing written) these are today's
  // words on today's grid, byte for byte. With a WRITTEN bar in hand they
  // edit that bar's own tri-state and its own per-place lifts; the first
  // mark on a DERIVED bar in hand writes it out, seeded from what the
  // sentence was deriving (barTriOf — you start from what you heard, never
  // from silence).
  // (the registered `words` are the search index, written in four; the
  // SENTENCE a mark speaks is the theme's own count — identical in three,
  // "on the and of five" in a six.)
  const sw = (i, m) => stepWord(i, metOf(m));
  for (let i = 0; i < N; i++) {
    add("note:" + i, "the bar", [stepWord(i)], (m) => m.on && i < NOF(m),
        (m) => (editsWrote(m)
          ? withHandBar(m, (b) => { b.grid[i] = b.grid[i] === 1 ? 0 : 1; return b; })
          : (() => { const g = gridOf(m); g[i] = g[i] === 1 ? 0 : 1;
                     return { ...m, grid: g, cell: m.cell }; })()),
        (m) => (handGrid(m)[i] === 1 ? "no note " : "a note ") + sw(i, m),
        (m) => handGrid(m)[i] === 1);
    add("up:" + i, "higher", ["up a step " + stepWord(i)],
        (m) => m.on && handGrid(m)[i] === 1 && (handLift(m)[i] || 0) < 2,
        (m) => (editsWrote(m)
          ? withHandBar(m, (b) => { b.lift[i] = (b.lift[i] || 0) + 1; return b; })
          : { ...m, lift: { ...liftOf(m), [i]: (liftOf(m)[i] || 0) + 1 } }),
        (m) => "up a step " + sw(i, m));
    add("down:" + i, "lower", ["down a step " + stepWord(i)],
        (m) => m.on && handGrid(m)[i] === 1 && (handLift(m)[i] || 0) > -2,
        (m) => (editsWrote(m)
          ? withHandBar(m, (b) => { b.lift[i] = (b.lift[i] || 0) - 1; return b; })
          : { ...m, lift: { ...liftOf(m), [i]: (liftOf(m)[i] || 0) - 1 } }),
        (m) => "down a step " + sw(i, m));
    // THE OCTAVE, ON ONE PLACE. The same two words a step gets, an octave
    // wide — which is what a pedal-alternating riff is made of (the Depeche
    // Mode study's shape: the same figure with every other note down an
    // octave). Clamped to one octave either way: two is a different
    // instrument, and the record has to stay on a piano.
    add("oup:" + i, "octaves in the bar", ["an octave up " + stepWord(i)],
        (m) => m.on && handGrid(m)[i] === 1 && (handOcts(m)[i] || 0) < 1,
        (m) => (editsWrote(m)
          ? withHandBar(m, (b) => { b.octs[i] = (b.octs[i] || 0) + 1; return b; })
          : withBaseOcts(m, (o) => { o[i] = (o[i] || 0) + 1; })),
        (m) => "an octave up " + sw(i, m));
    add("odn:" + i, "octaves in the bar", ["an octave down " + stepWord(i)],
        (m) => m.on && handGrid(m)[i] === 1 && (handOcts(m)[i] || 0) > -1,
        (m) => (editsWrote(m)
          ? withHandBar(m, (b) => { b.octs[i] = (b.octs[i] || 0) - 1; return b; })
          : withBaseOcts(m, (o) => { o[i] = (o[i] || 0) - 1; })),
        (m) => "an octave down " + sw(i, m));
    // "hold it" — offered only where a note EARLIER in the bar exists to
    // hold from: a tie with nothing before it would be a mark on silence.
    // (In a written bar past the first, the note before the line counts —
    // the leading run IS the tie across the barline.)
    add("tie:" + i, "held", ["hold it " + stepWord(i)],
        (m) => m.on && i < NOF(m) && (handGrid(m).slice(0, i).some((v) => v === 1) ||
                        (editsWrote(m) && handOf(m) > 0)),
        (m) => (editsWrote(m)
          ? withHandBar(m, (b) => { b.grid[i] = b.grid[i] === 2 ? 0 : 2; return b; })
          : (() => { const g = gridOf(m); g[i] = g[i] === 2 ? 0 : 2;
                     return { ...m, grid: g, cell: m.cell }; })()),
        (m) => (handGrid(m)[i] === 2 ? "let go " : "held through ") + sw(i, m),
        (m) => handGrid(m)[i] === 2);
  }
  add("flatten", "the bar", ["straighten it out"],
      (m) => m.on && (m.grid || m.lift || m.octs || m.wrote),
      // "straighten it out" means all of it — the written bars included, and
      // every octave anybody moved
      (m) => ({ ...m, grid: null, lift: null, octs: null, wrote: null }),
      () => "back to the rhythm it was written with");
  // THE WHOLE BAR, AN OCTAVE. The cadence that drops one and the climax
  // phrase that takes one are BAR-scale facts, and saying them a place at a
  // time is not how anybody says one. Same storage as the per-place marks —
  // one mechanism, two scales — and on a derived bar past the first, the
  // first thing said writes that bar out, exactly as every other mark does.
  const barOctCan = (m, d) => m.on &&
    handGrid(m).some((v, i) => v === 1 &&
      Math.abs(((handOcts(m)[i] || 0) + d)) <= 1 && (handOcts(m)[i] || 0) + d !== (handOcts(m)[i] || 0));
  const barOct = (m, d) => {
    const g = handGrid(m), cur = handOcts(m), next = { ...cur };
    let moved = false;
    for (let i = 0; i < g.length; i++) {
      if (g[i] !== 1) continue;
      const v = Math.max(-1, Math.min(1, (cur[i] || 0) + d));
      if (v !== (cur[i] || 0)) moved = true;
      if (v) next[i] = v; else delete next[i];
    }
    if (!moved) return m;
    return editsWrote(m)
      ? withHandBar(m, (b) => { b.octs = next; return b; })
      : { ...m, octs: Object.keys(next).length ? next : null };
  };
  add("boct:up", "the bar", ["take the bar up an octave"],
      (m) => barOctCan(m, 1), (m) => barOct(m, 1),
      (m) => BARWORD[handOf(m)] + " goes up an octave");
  add("boct:down", "the bar", ["take the bar down an octave"],
      (m) => barOctCan(m, -1), (m) => barOct(m, -1),
      (m) => BARWORD[handOf(m)] + " goes down an octave");
  // THE BAR IN HAND — which measure the count grid is aimed at. Writing is
  // refinement, like the lifts: vocabulary, not interview (zero new
  // interview rows). Taking a bar in hand changes no phrase; the first mark
  // made on a derived bar writes it out.
  for (let b = 0; b < MAXB; b++)
    add("bar:" + b, "the bar in hand", [BARWORD[b]],
        (m) => m.on && barsOf(m) > 1 && b < barsOf(m) && handOf(m) !== b,
        (m) => ({ ...m, hand: b }),
        (m) => BARWORD[b] + (wroteOf(m)[b] ? ", written by hand, in hand"
                                           : ", in hand"),
        (m) => handOf(m) === b && barsOf(m) > 1);
  // ...and the way back: a written bar handed to the plan re-derives around
  // whatever its neighbours still hold — the words replace each other, whole
  add("back:hand", "the bar in hand", ["let the plan have it back"],
      (m) => m.on && !!wroteOf(m)[handOf(m)],
      (m) => { const wr = { ...(m.wrote || {}) }; delete wr[handOf(m)];
               return { ...m, wrote: Object.keys(wr).length ? wr : null }; },
      (m) => BARWORD[handOf(m)] + " goes back to the plan");

  add("answer", "the answer", ["answer itself"], (m) => m.on && barsOf(m) > 1,
      (m) => ({ ...m, answer: !m.answer }),
      (m) => (m.answer ? "both halves end the same way" : "the first half asks, the second answers"),
      (m) => !!m.answer);

  /* ---------- the interview ----------
     chair.js walks it; the one law that is this file's own rides on the
     options as `heard` — over the rhythm you chose, two shapes that come
     out identical are one answer, not two — and the walker filters by it
     when OFFERING while still accepting the answer by the raw table, which
     is how band-kit answers through the gap on the idea's behalf. */
  const DECISIONS = [
    { id: "len", ask: "how long is it?", opts: Object.entries(LENGTHS).map(([k, l]) => ({
        w: l.w, is: (m) => m.len === k, apply: (m) => ({ ...m, len: k }) })) },
    // the cells of the bar this record counts in: the ten, re-seated, plus
    // the three that only a twelve-step bar has
    { id: "cell", ask: "what's its rhythm?",
      opts: (m) => Object.entries({ ...CELLS, ...(extraCells(m) || {}) }).map(([k, c]) => ({
        w: (extraCells(m) && extraCells(m)[k] ? c.w : (CELLS[k] || c).w),
        is: (mm) => mm.cell === k, apply: (mm) => ({ ...mm, cell: k }) })) },
    // the sentence rides right behind the rhythm it derives from, and only
    // when there are measures to differ — a one-bar tune is not a sentence
    { id: "sent", ask: "how does it speak?", when: (m) => barsOf(m) > 1,
      opts: Object.entries(SENTENCES).map(([k, s]) => ({
        w: s.w, is: (m) => (m.sent || "plain") === k,
        apply: (m) => ({ ...m, sent: k }),
        heard: (m) => (m.sent || "plain") === k || sentFirst(m, k) })) },
    { id: "contour", ask: "what shape does it make?",
      opts: Object.entries(CONTOURS).map(([k, c]) => ({
        w: c.w, is: (m) => m.contour === k, apply: (m) => ({ ...m, contour: k }),
        heard: (m) => conFirst(m, k) })) },
    { id: "land", ask: "where does it land?", opts: Object.entries(LANDINGS).map(([k, l]) => ({
        w: l.w, is: (m) => m.land === k, apply: (m) => ({ ...m, land: k }) })) },
    { id: "reg", ask: "where does it sit?", opts: Object.entries(REG).map(([k, r]) => ({
        w: r.w, is: (m) => m.reg === k, apply: (m) => ({ ...m, reg: k }) })) },
  ];
  const { decisions, nextAsk, answer } = C.interview(DECISIONS, {});
  const catalog = C.catalogSlimOf(V);
  const say = C.sayOf(V), says = C.saysOf(V);

  const regOf = (m) => (REG[m.reg] || REG.mid).v;
  // THE COUNT ROW's marks for the tune: the note itself, a scale step either
  // way on one place — "that third note is too high" made tappable — and
  // "hold it", the tie: the note before this place sounds through it
  const BARMARKS = [
    { w: "the note",    id: (i) => "note:" + i },
    { w: "up a step",   id: (i) => "up:" + i },
    { w: "down a step", id: (i) => "down:" + i },
    { w: "hold it",     id: (i) => "tie:" + i },
    { w: "an octave up",   id: (i) => "oup:" + i },
    { w: "an octave down", id: (i) => "odn:" + i },
  ];
  return { N, NOF, CELLS, CELLS3, CELLS6, extraCells, cellOf,
           CONTOURS, LANDINGS, LENGTHS, REG, SENTENCES, ROLES, TRANSFORMS,
           regOf, gridOf, liftOf, octsOf, wroteOf, handOf, stepWord,
           blank, V, catalog, say, says, BARMARKS, BARWORD, MAXB,
           decisions, nextAsk, answer, toPhrase, transform, describe, barsOf, cellOf };
});
