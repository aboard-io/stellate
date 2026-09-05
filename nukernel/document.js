// nukernel/document.js — HOW A DOCUMENT BECOMES A SCORE, and nothing else.
//
// This file exists because the compiler that turns the eight axes into a genre
// object lived in a VIEW (`ui/eight.js:75 genreFor`) and had already been
// copied once (`scratch/play-song.js:26`, stale by months). Two owners of one
// fact, and three slices of the 2026-08-24 round need to call it from node
// where there is no page at all. So the arithmetic came out and the drawing
// stayed behind. PROGRAM.md §3 WAVE 1 fixes the seven names below; designs 02
// and 05 each proposed the same extraction under a different filename
// (`score.js`, `document.js`) and this is the one file.
//
// THE MOVE MOVED NOTHING. `toGenre`, `toPhrase`, `boxesOf` and `normalize` are
// the pre-move source text with `DOC` renamed to the `doc` argument — the
// comments came across with the code because they are the record of what went
// wrong before, and rewriting them would throw that away. The proof is
// `test/fixtures/terms-genre.json`, a capture of `genreFor(i)` taken off the
// pre-edit file before a line here was written, and `test/document.test.js`
// asserts this file reproduces it at every section index.
//
// NO DOM, NO GLOBALS OF ITS OWN. UMD, the pattern songs.js and interview.js
// already use: node `require`s it, the page loads it as a classic <script>
// before ui/eight.js's module tier runs, and ui/deps.js — "the SOLE reader of
// window.*" — is what hands it to a view. Nothing in here reads a page.
(function (root, factory) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const api = factory(
    isNode ? require("./kernel.js") : root.NuKernel,
    isNode ? require("./genres.js") : root.NuGenres,
    isNode ? require("./fields.js") : root.NuFields,
    isNode ? require("./song.js")   : root.NuSong,
    isNode ? require("./songs.js")  : root.NuSongs);
  if (isNode) module.exports = api;
  else root.NuDocument = api;
})(typeof self !== "undefined" ? self : this, function (K, NG, NF, NuSong, NuSongs) {
  "use strict";

  const { MODES, SCALES } = NG;
  const { KEYS, SWINGS } = NF;
  /* A STORED WORD -> THE NUMBER IT NAMES, or null (TABLE.md wave 4). The two
     numeric cell vocabularies — `OCTAVES` and `CLAMPS` — are keyed on the
     number written as a string, which is how every enum in `fields.js` is
     keyed and is what makes "-1" and -1 one spelling in a record rather than
     two. Checked against the table first, so a number this build has no chip
     for never reaches the kernel; `0` is a legal answer and is why every
     caller tests `!= null` rather than truthiness. */
  const numWord = (w, table) =>
    (w != null && Object.prototype.hasOwnProperty.call(table, String(w)))
      ? +w : null;
  // THE CATALOGUE, for the resolver's LAST tier (§2: cell -> column -> row ->
  // record -> the genre's row). `toGenre` still takes its table as an argument
  // — the page registers `lab.eight.N` rows into it and a node caller must not
  // collide with them — so every entry point below takes the same optional
  // argument and falls back to the catalogue this file already imports.
  const CATALOG = NG.GENRES;
  const { stepsIn } = K;
  /* THE RECORD'S DECLARED METER, RESOLVED (2026-09-05, the any-meter round).
     Three readers below said `METERS[doc.time.meter]`, which knew exactly two
     words. A signature is two numbers now — "7/8", "21/17" — and `metOf` is
     the one resolver for a word and a fraction alike (kernel.js meterRow).
     NULL WHERE NOTHING IS DECLARED, and null for a word nobody knows, because
     every reader below is present-only: an absent meter must stamp no key at
     all, which is what keeps every record written before today byte-identical. */
  const metRow = (t) => { const m = t && t.meter; if (!m) return null;
    const r = K.metOf({ meter: m }); return r === K.MET4 ? null : r; };
  /* ---- AN ENTRY IS BARS, AND ITS FRACTION IS BEATS (2026-09-05) -----------
     The review's item 4: *"`enters at bar` is validated `Number.isInteger` …
     a pickup, a stretto, an answer on beat 3 cannot exist."* One number, in
     BARS, whose fraction is a whole number of the bar's OWN steps —
     `kernel.js entryBar` / `entryStep` are the readers and this is the
     validator. `0.75` in four-four is three beats; `0.5` is two.
     ONE FACT, ONE ADDRESS: not `{bar, beat}`, because `entry` is read as one
     number by TIERS, the resolver, precompose's cast, the genre closures and
     `g.entry(v)`, and two fields would have meant two validators and two ways
     to spell the same place.
     A NUMBER OFF THE GRID IS SNAPPED, NOT DROPPED — the control that writes
     it is a slider, and refusing a rounding error would delete the value a
     hand just set. An INTEGER passes through untouched, which is every record
     ever written and is what keeps `normalize` a byte-identical no-op. */
  /* THE GRID AN ENTRY SNAPS TO IS THE CELL'S, NOT THE BAR'S — and they are
     the same number for every one-bar cell, which is nearly every record.
     `kernel.js render` counts its loop in PHRASE LENGTHS (`N =
     subj.deg.length`, `b * N` is the time), and `sections[].bars` counts CELL
     bars (`barsOf`'s own law two screens up), so an integer `entry` has
     always meant "this many cells later". A fraction of it is therefore a
     fraction of a CELL, whose finest honest grid is one of its own steps —
     which is what `kernel.js entryStep(e, N)` divides by at the other end.
     A document with no line cell at all falls back to the meter's bar. */
  const cellStepsOf = (doc) => {
    let n = 0;
    const cells = (doc.material && doc.material.cells) || {};
    for (const name of Object.keys(cells)) {
      const c = cells[name];
      if (!c || c.kind === "drum" || !c.deg) continue;
      if (c.deg.length > n) n = c.deg.length;
    }
    return n || Math.max(1, K.stepsIn({ meter: metRow(doc.time) }));
  };
  /* ...AND A PICKUP IS A NEGATIVE ONE, DOWN TO A BAR (2026-09-05, item 9).
     `entry: -0.25` is "a beat before the section", which the lead-in channel
     (ui/derive.js `lead` -> songBars) now carries; `kernel.js ENTRY_LEAD` is
     the same one-bar ceiling read from the other end. Anything earlier than a
     bar is a chair in the previous section and is refused at the door. */
  const entryOK = (x) => typeof x === "number" && isFinite(x) && x >= -1;
  const entrySnap = (x, steps) => Math.round(x * steps) / steps;
  const { WORDS } = NuSongs;

  /* ---------- reading the document ----------------------------------------
     One object per voice, `kind` instead of special cases, words keyed by
     section id. Everything below asks through these and nothing else reaches
     into the shape by hand. They take `doc` where the page's own copies close
     over its `DOC`; that is the whole of the difference. */
  // THE RECORD'S OWN SYNTH. `basis` may declare one (synthduo's juno60) and a
  // record may name its own instead — a fugue on a sampled organ is a fugue
  // through a microphone, and the Faust pipe organ is right there.
  const synthOf = (doc, GENRES) => (doc.sound && doc.sound.synth) ||
    (GENRES[doc.basis] || {}).synth || null;
  // THE FAUST FLEET IS NOT REACHABLE FROM HERE, and that is the one seam this
  // move could not close. `audio/to-engine.js SYNTH` is the only table that
  // knows which instrument names are modelled voices, and it is an ES module —
  // a UMD file that `require`s it stops being node-requirable, which is the
  // whole point of this file. So the caller passes the list: `ui/eight.js`
  // hands it `SYNTH_NAMES()`, the gate imports the same function. The default
  // is the empty fleet, which is honest — a caller that does not say means
  // "nothing here is modelled" and every voice reaches the chairs seam as a
  // sampled `instr`, exactly as a non-native instrument does today.
  const nativeOf = (v, fleet) => (v && fleet.includes(v.instrument))
    ? { dsp: v.instrument, level: v.level == null ? 1 : v.level, set: v.set || {} }
    : null;
  const LINES  = (doc) => doc.voices.filter((v) => v.kind === "line");
  // ...AND WHERE EACH OF THEM SITS IN `doc.voices` (TABLE.md §1: a COLUMN is a
  // voice). The kernel counts lines and the table counts columns; this is the
  // one place the two indexes are joined, so the resolver never has to know
  // that a line list exists.
  const LINEIX = (doc) => doc.voices.reduce(
    (a, v, i) => { if (v.kind === "line") a.push(i); return a; }, []);
  const BASSV  = (doc) => doc.voices.find((v) => v.kind === "bass");
  const DRUMV  = (doc) => doc.voices.find((v) => v.kind === "drums");
  const SECID  = (doc, i) => (doc.form.sections[i] || {}).id;
  const wordAt = (doc, voice, i) => (voice && voice.development[SECID(doc, i)]) || "";
  const cellNames = (doc) => Object.keys(doc.material.cells);
  const cellOf = (doc, name) =>
    doc.material.cells[name] || doc.material.cells[cellNames(doc)[0]];

  /* ---------- WHERE A VOICE READS ITS MATERIAL (D5, design 05 §2.1) --------
     `voice.material` was a string, so a voice played one cell for the whole
     record and 100% of a composer's per-section slot assignment was thrown
     away — every precomposed record would have been structurally identical in
     material. It may now also be `{ "<secId>": "<cell>", …, "": "<default>" }`.
     THE STRING FORM IS THE OLD FORM, BYTE FOR BYTE: it is returned untouched,
     which is why wiring this in `push()` changed nothing about the shipped
     chant and the frozen fixture still matches. */
  const materialAt = (voice, secId) => {
    const m = voice && voice.material;
    if (m == null || typeof m === "string") return m;
    return m[secId] != null ? m[secId] : m[""];
  };

  /* ---------- HOW MANY BARS A CELL IS — AND EACH CELL KEEPS ITS OWN LENGTH
     (2026-09-05, the review's item 8) ---------------------------------------
     The kernel reads a phrase's own length AS the bar (`kernel.js render`,
     `N = subj.deg.length`), and the meter says how many steps a bar has
     (`kernel.js stepsIn`). So a 32-step cell in four is two bars.

     THE INVARIANT THAT STOOD HERE — *"every LINE cell in one document is the
     same length"* — IS LIFTED. The musicologist's review: *"All four lines
     must be the same length. document.js:110–117 requires every line cell in
     one document to carry the same number of steps. A three-bar ostinato under
     a four-bar tune is not writable."* It is writable now: a cell is a phrase
     and a phrase has its own length, the walk loops each one on its OWN period
     inside the section, and the section's end cuts whatever is still running.
     A 2-bar phrase under a 4-bar section states itself twice; a 3-bar phrase
     against a 4-bar section drifts, which is a composer's tool and not a bug.

     WHAT THE OLD LAW WAS ACTUALLY PROTECTING, said plainly, because it was
     protecting something real: HARMONY. `render` indexes the chord schedule by
     its own loop counter, so a two-bar phrase takes one chord every two bars.
     With one length that is one answer for the whole band; with two lengths it
     would be two — the 2-bar chair on chord 2 while the 4-bar chair is still
     on chord 1. That is fixed where it belongs (`toGenre` stamps `cellBars`,
     `kernel.js render` divides its loop counter by it) rather than by forbidding
     the music. TIME is not the same question and needs no fixing: each phrase
     already renders at `b * N`, its own length, which is why lengths could
     always differ in the kernel and only the document forbade it.

     `barsOf` is THE REFERENCE LENGTH — the longest line cell, in bars. It is
     what `sections[].bars` is counted against, what the entry slider counts a
     cell in (`ui/eight.js barBeats`) and what the harmony above is aligned to.
     Taking the longest (not the first, not an average) keeps the bar count from
     ever being short, which is the reading it has always had. */
  function barsOf(doc) {
    const cells = doc.material.cells, names = cellNames(doc);
    let n = 0;
    for (const name of names) {
      const c = cells[name];
      if (!c || c.kind === "drum" || !c.deg) continue;
      if (c.deg.length > n) n = c.deg.length;
    }
    if (!n) return 1;
    const steps = stepsIn({ meter: metRow(doc.time) });
    return Math.max(1, Math.round(n / steps));
  }
  /* ...AND WHETHER THE RECORD ACTUALLY USES THE FREEDOM. PRESENT-ONLY is the
     law every field of the last three rounds keeps (`art`, `alt`, `meter`): a
     document whose line cells are all one length must compile to the genre it
     always compiled to, byte for byte, closures and all — so `toGenre` stamps
     `cellBars` ONLY when there is more than one length to align. Every record
     in the catalogue and every genre closure ever written takes the absent
     branch. */
  function mixedLengths(doc) {
    const cells = (doc.material && doc.material.cells) || {};
    let n = 0;
    for (const name of Object.keys(cells)) {
      const c = cells[name];
      if (!c || c.kind === "drum" || !c.deg) continue;
      if (!n) n = c.deg.length;
      else if (c.deg.length !== n) return true;
    }
    return false;
  }

  /* ---------- THE FORM WALK: repeats, endings and the coda -----------------
     (2026-09-05, the review's item 9.) The document holds the sections ONCE,
     in the order they are written. This is the one function that says what the
     RECORD PLAYS, and every reader of the form asks it: `boxesOf` stamps its
     answer on the boxes, `ui/derive.js songBars` repeats the bars with it,
     `scoreOf` walks it, the score prints its marks and the exports unroll it.

     ONE BOX PER SECTION, IN WRITTEN ORDER, and that is deliberate: the page
     indexes SONG by section index in a dozen places (`ui/engineer.js` rows,
     `scoreParts`, `scoreLen`, the caption's reserve), and a walk that
     duplicated or reordered boxes would silently re-address all of them. So a
     repeat is a COUNT the walk plays, not a copy of the section.

     WHAT EACH WORD IS WORTH, in one place:
       · `plays`   how many times the section's bars are played (1 unless it
                   repeats).
       · `cut`     how many bars come off the LAST statement, which is the
                   second ending's own length: statements 1..N-1 play the
                   section whole (its own last bar IS the first ending) and the
                   last one stops short so the alternative can take its place.
       · `skip`    a section the form jumps over on its way to the coda.
     A record that says none of the four gets `plays: 1, cut: 0` on every
     section — the walk the page has always taken, bar for bar. */
  const REPEAT_MAX = 8;
  const repOf = (s) => {
    const n = s && s.repeat;
    return Number.isInteger(n) && n >= 2 && n <= REPEAT_MAX ? n : 1;
  };
  function formWalk(doc) {
    const secs = (doc.form && doc.form.sections) || [];
    const out = secs.map((s2, i) => ({ si: i, id: s2.id,
      bars: Math.max(1, s2.bars | 0), plays: 1, cut: 0 }));
    const codaIx = secs.findIndex((s2) => s2 && s2.coda);
    for (let i = 0; i < secs.length; i++) {
      const s2 = secs[i], e = out[i];
      if (!s2) continue;
      // AN ENDING BELONGS TO THE SECTION ABOVE IT and is played once, in its
      // own place, which is where the walk already is when the last statement
      // stops short. Nothing to do here but refuse to repeat it.
      if (s2.ending) continue;
      e.plays = repOf(s2);
      const nxt = secs[i + 1];
      if (nxt && nxt.ending && e.plays > 1)
        e.cut = Math.min(e.bars - 1, Math.max(1, nxt.bars | 0));
      // ...AND THE JUMP. `tocoda` on a section whose coda lies AFTER it means
      // the walk leaves at the end of that section's last statement.
      if (s2.tocoda && codaIx > i) {
        // ...AND THE SECOND ENDING IS PART OF THE LAST STATEMENT, not part of
        // what the jump skips: the walk leaves AFTER it.
        const from = (nxt && nxt.ending) ? i + 2 : i + 1;
        for (let k = from; k < codaIx; k++) out[k].skip = true;
        break;
      }
    }
    if (codaIx >= 0) { out[codaIx].plays = 1; out[codaIx].cut = 0;
                       out[codaIx].coda = true; out[codaIx].skip = false; }
    return out;
  }

  /* ---------- the document becomes a genre, per section ---------- */
  // The ANCHOR supplies every field no axis states — which is the whole claim of
  // AXES.md made operational: a genre is a correlated point, the axes are the
  // dimensions, and stating an axis moves the record off the anchor along it.
  // AN ENTRY MAY BE AN OP KEY AS WELL AS A CALL, which is kernel.js:1190
  // `asOps`'s own rule ("an op is a function or one of the keys above") applied
  // one layer up. The five words added 2026-08-24 — "the rhythm, moved",
  // "the notes, moved", "filled in", "split in two", "accents flipped" — are
  // written as `["gat4"]`, `["pit4"]`, `["dens3"]`, `["rep2"]`, `["accflip"]`,
  // the same keys fields.js OPS and the palette speak, so a word cannot drift
  // away from the chip that means the same thing. Before this line existed the
  // destructure read `["gat4"]` as op `"g"` with args `"a","t","4"`.
  /* ...AND TWO SPELLINGS THIS VOCABULARY OWNS THAT ARE NOT KERNEL OP NAMES
     (2026-09-05, the musicologist's review). `["interval", n]` is n SEMITONES
     and `["octaves", n]` is n periods of the alphabet; both become a
     `transpose` in DEGREES here, because here is the one place a word becomes
     operators AND the section's scale is known. songs.js says why an interval
     spelled as a degree count is a tritone on the wrong degree and a minor
     seventh on a pentatonic. They are answered BEFORE `K[...]`, so neither
     name can be mistaken for an operator, and a scale-less caller falls to
     the kernel's own default alphabet rather than throwing. */
  const opsOf = (name, sc) => (WORDS[name] || []).map((w) => {
    if (typeof w === "string") return K.OPKEYS[w];
    if (w[0] === "interval") return K.transpose(K.degreesFor(sc, w[1]));
    if (w[0] === "octaves")
      return K.transpose(K.octaveDegrees(sc) * (w[1] | 0));
    return K[w[0]](...w.slice(1));
  });
  let ver = 0;
  /* WHAT A TAKE IS, in the two places it can be spent: the kernel's own dice
     (`kitSeed`) and the seeds the pipe operators carry (kernel.js:608 —
     `prng(((op.seed || 0) + 1) * 0x9E3779B9 + i + 1)`), which were handed none
     and so fell in the same places every reading. The two constants are
     band-kit.js's own; a second pair would be a second answer to "what is take
     three". */
  function takeOf(take, si, anchor) {
    const t = take | 0;
    if (t <= 1) return {};                  // absent, 0 and 1 are all take one
    const ks = (t * 0x9E3779B1 + si * 0x85EBCA77) | 0;
    const pipes = anchor && Array.isArray(anchor.pipes) && anchor.pipes.length
      ? { pipes: anchor.pipes.map((op, k) => ({ ...op, seed: ks + k })) } : {};
    return { kitSeed: ks, ...pipes };
  }
  /* THE RULES REACH THE KERNEL TOO (2026-09-01, the Rules round) ------------
     The spread below starts at `GENRES[doc.basis]`, and for every field the
     document itself states — bpm, mode, prog, the cast — the document wins, so
     a COMPOSE-tier rule is already in the record by the time this runs. The
     RENDER tier is the half that is not: `artic maxHold bars fx tone orn
     period anchor incMode incClamp` have no document slot at all (that is
     exactly what makes them render-tier — they reach the kernel through this
     spread on the next frame), so a hand that shortened the longest note would
     have watched it re-lengthen the moment the record was drawn. MEASURED
     before this line existed, on `reggae` with `maxHold: 2`: the composed
     cells honoured it and `toGenre` handed the kernel the catalogue's 6.

     So the basis is RESOLVED here, through the same one door precompose uses
     — `rules.js applyRules`, which copies the row and never touches `GENRES`.
     A record with no rules takes the catalogue's own object BY IDENTITY, so
     the shipped chant compiles to the frozen genre byte for byte (G7a).

     RULES IS REACHED LAZILY for the load-order reason song.js:209 gives for
     OLDKEYS, upside down: index.html loads this file at :467 and rules.js
     after ideas-kit, because rules.js reads compose.js and ideas-kit.js. The
     lookup happens when a record is drawn, by which time both exist. */
  const RULESMOD = () => {
    if (typeof module !== "undefined" && module.exports) {
      try { return require("./rules.js"); } catch (e) { return null; }
    }
    const g = typeof self !== "undefined" ? self : globalThis;
    return g.NuRules || null;
  };
  function basisRow(doc, GENRES) {
    const row = GENRES[doc.basis];
    if (!row || !doc.rules || !doc.rules.length) return row;
    const R = RULESMOD();
    if (!R || !R.applyRules) return row;
    try { return R.applyRules(row, doc.rules); } catch (e) { return row; }
  }

  function toGenre(doc, si, GENRES, fleet) {
    const A = doc.alphabet, T = doc.time, P = doc.performance;
    const BASIS = basisRow(doc, GENRES);
    const NATIVE = fleet || [];
    /* THE ROW MAY MODULATE, AND THE RESOLVER IS HOW (TABLE.md wave 2a, §2).
       Five facts the record used to own alone — its key, its mode, its
       progression, its swing and its groove — now resolve `row -> record`,
       and this is the ONE place they are read, for both paths: `boxesOf`
       registers this genre per section, so a bridge that modulates lands its
       key in the box the walk plays AND in the score `scoreOf` renders. With
       no row override every one of them answers off `doc.alphabet` /
       `doc.time` exactly as the four lines below read them before this
       existed, which is what makes the two the composer never deals
       (swing, groove) byte-identical on all 479 anchors. */
    const rrow = (f) => resolveRow(doc, si, f, GENRES);
    const mode = MODES[rrow("mode")] || MODES.aeolian;
    /* THE FIVE §1 MOVED TO THE CELL (TABLE.md wave 4, 2026-09-04), AND THIS IS
       THEIR ONE OWNER. Two questions, deliberately asked separately:

         · `rrow` — what the SECTION says (row -> record). It lands on the
           compiled genre's own fields, where the kernel already has a reader
           for four of the five, so a row's word reaches every voice of the box
           the way `time.rate` and `alphabet.scale` always have.
         · `rcell` — what THIS CHAIR says, and ONLY this chair: `resolveFrom`'s
           `from` is the tier that answered, so a value inherited from the row
           is not handed back here. That is what stops a row word being applied
           twice — once on the genre and once again per voice — which is ¶A's
           law in the one shape it can take for a pitch and a duration.

       The kernel reads the per-voice half through ONE closure, `g.cell(v)`,
       beside `entry(v)` and `reg(v)` and for the same reason: a cell override
       reaches the sound by construction rather than by somebody remembering to
       wire it. It answers `null` for a chair with nothing written, which is
       every chair of every record until a hand writes — so `render` takes the
       identical branch it took before this existed (T2). */
    const rcell = (vi, f) => {
      const r = resolveFrom(doc, si, vi, f, GENRES);
      return r.from === "cell" ? r.v : undefined;
    };
    const R_artic = NF.ARTICS[rrow("artic")] ? rrow("artic") : null;
    const R_oct = numWord(rrow("oct"), NF.OCTAVES);
    const R_clamp = numWord(rrow("clamp"), NF.CLAMPS);
    const R_scale = rrow("scale");
    /* THE SECTION'S ALPHABET, NAMED ONCE (2026-09-05). It was computed inline
       on the `scale:` line below and is READ TWICE now — once as the genre's
       alphabet, once by `opsOf` so `"at the fifth"` can be a fifth IN IT
       (songs.js says why a degree count cannot be). Same expression, same
       array, one name. */
    const scArr = (R_scale && (SCALES[R_scale] || MODES[R_scale])) || mode;
    const R_rate = NF.RATES[rrow("rate")] || null;
    const CELLMEMO = new Map();
    const prog = rrow("prog") || A.prog;
    const swing = rrow("swing");
    const lines = LINES(doc), drums = DRUMV(doc), bass = BASSV(doc);
    // THE TABLE'S RESOLVER IS THE ONE OWNER of `entry` and `reg` from here on
    // (TABLE.md §2). `LIX` turns the kernel's line index into the column index
    // the resolver addresses; with no cell override the answer is `cast.entry`
    // and `cast.reg` exactly as the two closures below read them before this
    // line existed, which is why every anchor renders byte-identically (T2).
    const LIX = LINEIX(doc);
    const on = drums && drums.cast.on;
    const kit = on ? (cellOf(doc, materialAt(drums, SECID(doc, si))).lanes || {}) : {};
    // NO DRUMMER MEANS NO DRUM SURFACE AT ALL. Emptying `kit` is not enough:
    // the basis is a whole genre and it carries the rest of the kit's facts
    // too — `fill` above all, which the kernel plays at every section edge
    // whether or not there are lanes. A record with no drums voice was still
    // dropping seven open-hat hits into the last bar of every section.
    //
    // The general shape of this: the basis supplies defaults FIELD BY FIELD,
    // but the axes govern CONCERN BY CONCERN. When a concern is absent, every
    // field of it has to go, not just the headline one.
    const noKit = { kits: null, fill: null, ghost: null, kitProb: null,
                    kitVel: null, drumkit: undefined };
    const synth = synthOf(doc, GENRES);
    return {
      ...BASIS,
      label: (BASIS || {}).label || doc.basis,
      /* TIME */        bpm: T.bpm, swing: swing == null ? 0 : SWINGS[swing],
                        /* ...AND THE ROW MAY HALVE OR DOUBLE IT (wave 4). The
                           record's `time.rate` is ABSOLUTE and the row's word
                           is a MULTIPLIER on whatever rate the record and the
                           basis settled on — `ui/derive.js genreOf`'s own
                           arithmetic (`g.rate * RATES[sec.rate]`), moved to
                           the tier that owns the fact so it reaches the score
                           as well as the walk. With no row word this is
                           `T.rate * 1` and with neither there is no key at
                           all, so every record renders the bytes it did. */
                        ...(T.rate || R_rate
                          ? { rate: (T.rate || (BASIS || {}).rate || 1) *
                                    (R_rate || 1) } : {}),
                        ...(metRow(T) ? { meter: metRow(T) } : {}),
      // THE SUBJECT'S ALPHABET IS ITS OWN. This said `scale: mode`, which meant
      // a document could not be pentatonic, blues, whole-tone or quartal — 99
      // of the 122 anchors declare a `scale` and every one of them was being
      // overwritten with the chord alphabet. Absent still means the mode, so
      // the shipped chant is byte-identical (it states no scale).
      /* ALPHABET */    key: KEYS[rrow("key")] || 0, mode,
                        /* ...AND THE ROW MAY NAME ANOTHER ALPHABET (wave 4),
                           resolved row -> record by §2's one owner. `A.scale`
                           was read directly here; the resolver's record reader
                           IS that read, so a record whose rows say nothing
                           resolves the identical name and the identical
                           array. */
                        scale: scArr,
                        diatonic: !!A.diatonic, harmony: A.harmony,
                        /* THE BAR'S FIRST CHORD IS ITS ROOT (2026-09-05).
                           A bar of `prog` may be a LIST of chords since the
                           kernel learned `beats` — a half-bar ii–V is two
                           chords in one bar — and `roots` is the bar-for-bar
                           skeleton the layers and the emergent machinery
                           read, one degree per bar. genres-tables.js states
                           the law it has to keep ("the prog's first-chord
                           degrees must equal the roots bar for bar"), so the
                           list answers with its first. A single-chord bar is
                           `c.d` exactly as before. */
                        prog, roots: prog.map((c) =>
                          (Array.isArray(c) ? c[0] : c).d),
      /* MATERIAL */    kit, ...(on ? {} : noKit),
                        /* ...AND THE REFERENCE PHRASE LENGTH, WHERE THE CHAIRS
                           DISAGREE (2026-09-05, the review's item 8). Two
                           chairs may read phrases of different lengths now.
                           Time takes care of itself — each phrase renders at
                           its own `b * N` — but the CHORD SCHEDULE is indexed
                           by the loop counter, so without this the 2-bar chair
                           would be a chord ahead of the 4-bar one. `cellBars`
                           is `barsOf`'s reference (the longest cell, in bars)
                           and `kernel.js render` divides its counter by it, so
                           every chair takes the same chord in the same bar.
                           PRESENT-ONLY: absent wherever the cells agree, which
                           is every record in the catalogue, so the compiled
                           genre — closures and all — is byte-identical. */
                        ...(mixedLengths(doc) ? { cellBars: barsOf(doc) } : {}),
      /* CAST */        voices: lines.length,
                        // ...AND IT IS RESOLVED PER SECTION, WHICH IS WHERE IT
                        // WAS ALREADY BEING APPLIED. Measured 2026-09-03:
                        // `entry` is bars into EVERY section (precompose ~3048
                        // clamps it to the shortest one for exactly that
                        // reason), so the honest home is the cell with the
                        // column as its default — TABLE.md §1, and this
                        // closure is where a cell override reaches the kernel
                        // (kernel.js:1523 `for (let b = g.entry(v); …)`).
                        entry: (v) => resolve(doc, si, LIX[v], "entry", GENRES),
                        // THE CHAIR'S OWN PART REACHES THE KERNEL (2026-08-28).
                        // This handed over `realize` and nothing else, so the
                        // kernel fell back to its two-value shim ("pad" or
                        // "line") on the 104 anchors with no `part` scheme and
                        // read the ANCHOR's array — wrapped, and blind to every
                        // edit made since — on the other 95. A document that
                        // says a chair is the counter-line got a chair playing
                        // whatever `part[v % part.length]` happened to name:
                        // 421 of 1081 seated chairs were cast in a role the
                        // kernel did not play. `cast.part` is the one owner of
                        // that fact and this is the wire.
                        part: (v) => lines[v].cast.part,
                        // ...AND ITS REGISTER IS ALREADY FINAL. `cast.reg` is
                        // what the chair SHOWS, and precompose seated it with
                        // the part's octave lean already spent (§7b writes the
                        // sounding centre, not a base). The kernel's contract
                        // is base-plus-lean, so hand it the base this number
                        // implies: K.partLean is the same table K.regOf will
                        // add back, which makes the round trip exact by
                        // construction and leaves ONE number — the one on the
                        // chair — saying where the chair sits.
                        // (…and through the same resolver, so a cell may sit
                        // one chair an octave down in the bridge and nowhere
                        // else. The `- partLean` fold is unchanged: the tiers
                        // all answer in SOUNDING register and the kernel is
                        // handed the base it implies.)
                        reg: (v) => resolve(doc, si, LIX[v], "reg", GENRES) -
                                    K.partLean(lines[v].cast.part),
                        realize: (v) => lines[v].cast.part,
                        bassStyle: bass ? bass.cast.style : undefined,
                        nobass: !bass,
                        /* ...AND THE BASS NAMES ITS OWN INSTRUMENT AT LAST
                           (2026-09-02, slice 2c). Paul, 2026-08-28: *"I've
                           lost all ability to select or customize the bass."*
                           The tombstone at avail.js's `sound.bassinstrument`
                           named the fix in three lines and this is the middle
                           one: the bass VOICE carries an `instrument` like any
                           other chair, and it reaches audio/plan.js `castOf`,
                           which seated every bass in the catalogue at `(POOL &&
                           POOL.bass) || BASS_INSTR` and had nothing else to
                           read. A SPREAD and not an assignment, so a record
                           whose bass says nothing hands the kernel the object
                           it handed it yesterday, byte for byte — absent is
                           today, and every one of the 358 anchors composes
                           unchanged (precompose writes no bass instrument). */
                        ...(bass && bass.instrument
                          ? { bassInstr: bass.instrument } : {}),
      /* DEVELOPMENT */ word: (v) => opsOf(wordAt(doc, lines[v], si), scArr),
      /* ...AND THE SECTION'S OWN ARTICULATION, RAMP LIMIT AND OCTAVE (wave 4).
         Present-only spreads, every one of them, so a row that says nothing
         hands the kernel the object it handed it yesterday: `artic` falls
         through to the anchor's own and then to the part policy, `incClamp` to
         the kernel's floor of seven, and `oct` is a field the kernel reads
         only when it is there. */
                        ...(R_artic ? { artic: R_artic } : {}),
                        ...(R_clamp != null ? { incClamp: R_clamp } : {}),
                        ...(R_oct ? { oct: R_oct } : {}),
      /* ...AND WHAT EACH CHAIR SAYS ON TOP OF IT, PER SECTION (TABLE.md §1
         CELL, wave 4). One closure, `null` for a chair with nothing written —
         which is every chair until a hand writes, and is what makes `render`
         take its old branch to the byte. The words become the kernel's own
         units HERE and nowhere else: an ARTICS name, whole semitones, a SCALES
         array, a ramp integer, a RATES multiplier. */
                        cell: (v) => {
                          if (CELLMEMO.has(v)) return CELLMEMO.get(v);
                          const ci = LIX[v];
                          const ar = rcell(ci, "artic"), oc = rcell(ci, "oct");
                          const rt = rcell(ci, "rate"), sk = rcell(ci, "scale");
                          const cl = rcell(ci, "clamp");
                          const o = {};
                          if (NF.ARTICS[ar]) o.artic = ar;
                          const on = numWord(oc, NF.OCTAVES); if (on) o.oct = on;
                          if (NF.RATES[rt]) o.rate = rt;
                          const sc = sk && (SCALES[sk] || MODES[sk]);
                          if (sc) o.scale = sc;
                          const cn = numWord(cl, NF.CLAMPS);
                          if (cn != null) o.clamp = cn;
                          const out = Object.keys(o).length ? o : null;
                          /* MEMOIZED PER GENRE, because `kernel.js render`
                             asks twice per voice (once where the note is
                             decided and once in `chairShape`) and the answer
                             is five resolver walks. A genre object is rebuilt
                             on every compile — `ui/eight.js push()` and every
                             gate call `toGenre` fresh — so there is no stale
                             answer to have: the cache lives exactly as long as
                             the compile that made it. */
                          CELLMEMO.set(v, out);
                          return out;
                        },
      /* SOUND */       ...(synth ? { synth } : {}),
                        instr: lines.map((c) => c.instrument === "synth"
                          ? ((BASIS || {}).instr || ["polysynth"])[0]
                          : c.instrument),
                        // A VOICE MAY ALWAYS CHANGE ITS INSTRUMENT (Paul: "let
                        // me change the instrument always"). The `chairs` seam
                        // is what makes it per VOICE rather than per role —
                        // ui/derive.js poolInstrOf reads it first, and an
                        // instrument named there outranks the record's
                        // signature synth for that voice and nobody else. An
                        // empty entry names nothing, so the synth keeps the
                        // part: `{}` is "the record's own".
                        // A VOICE NAMES ITS OWN THROAT. The chairs seam is per
                        // VOICE, and it carries three kinds of answer now: a
                        // NATIVE model (a Faust voice — audio/plan.js reads
                        // `chairs[v].synth` before the record's own), a SAMPLED
                        // instrument (`instr`, which outranks any synth for that
                        // voice), or nothing, which leaves the record's
                        // signature in place. A cantor and a schola are two
                        // different throats and this is what lets them be.
                        // ...AND WHAT THE SAMPLER WAS TOLD (2026-08-28, the
                        // sampler-control round). `voice.sound` is the three
                        // words a recording can answer — attack, release,
                        // doubling (fields.js VOX, avail.js `sound.attack`
                        // and its two siblings) — and this is their whole
                        // wire: the chairs seam already carries a chair's
                        // instrument, its native model and its tone, and
                        // audio/plan.js reads `chairs[v].vox` onto the seat
                        // beside the layer's own chips. A voice that says
                        // nothing adds no key, so every record written before
                        // this line compiles byte-identically.
                        // ...PLUS THE LOOP (2026-08-30, the sampling round).
                        // `voice.sound` now also carries `loopin`/`loopout`
                        // (NUMBERS, 0..1 fractions of the zone — the loop
                        // strip's own writes) and `looping` (a word,
                        // fields.js VOX.looping). Same spread, same seam, no
                        // new wire: audio/to-engine.js samplerVox turns them
                        // into the pinned per-unit params loopa/loopb/loopon.
                        // Absent is still today, byte for byte — proven per
                        // anchor per seed by test/loop-words.test.js.
                        /* ...AND THE RECORD GAIN REACHES A NATIVE CHAIR TOO
                           (2026-08-30, the volume census). nativeOf hands back
                           the voice's own declared level and synthRecipe lets
                           it WIN, so a chair like the shipped chant's cantor
                           (songs.js level 0.15) bypassed tone.gain x
                           doc.sound.level entirely — measured: record gain
                           x0.5 moved the schola exactly x0.5 and the cantor
                           0.00 dB. The knob now multiplies into the declared
                           level, clamped at 1, absent-is-today by the same
                           null guard the sound block below already uses. */
                        /* ...AND WHOSE THROAT SINGS IT (2026-09-04, the
                           per-chair singer round). `throat` is one of the five
                           words `fields.js THROATS` publishes, resolved through
                           §2's one owner like every other chair fact, and
                           `audio/plan.js` writes it onto the seat's mouth via
                           `instruments.js throatTone` — the one place that
                           knows a chair outranks its row. It is on THIS seam
                           and not beside the tone for the reason the seam
                           exists: a cantor and a schola are two throats on one
                           record, and `G.tone` is one block for the whole row.
                           A chair that says nothing adds no key, so every
                           record written before this line compiles byte for
                           byte as it did. */
                        chairs: lines.map((c, li) => {
                          const nat = nativeOf(c, NATIVE);
                          if (nat && doc.sound && doc.sound.level != null)
                            nat.level = +Math.min(1, nat.level * doc.sound.level).toFixed(3);
                          const thr = resolve(doc, si, LIX[li], "voice", GENRES);
                          return { ...(nat ? { synth: nat }
                                     : c.instrument === "synth" ? {} : { instr: c.instrument }),
                                   ...(c.sound && Object.keys(c.sound).length
                                     ? { vox: c.sound } : {}),
                                   ...(thr ? { throat: thr } : {}) };
                        }),
                        ...(on ? { drumkit: drums.instrument } : {}),
      /* SOUND, THE RECORD'S BALANCE — and, since 2026-08-31, ITS SURFACE.
         `level` scales the basis tone's gain; `grain` REPLACES the basis
         tone's grain outright, because the two facts are different shapes: a
         gain is a proportion of what the row asked for, and surface noise is
         an absolute amount of dust on the record — halving a row's declared
         0.62 and setting 0.31 are the same sentence, so the dial says the
         number. Both fold into ONE tone spread so a record that moves both
         does not get two tone objects, and either alone leaves the other at
         the basis exactly as before. Absent-is-today survives at the writer:
         ui/engineer.js deletes the key when the dial returns to the basis
         value, so this branch is not even entered by an untouched record. */
                        ...((doc.sound &&
                             (doc.sound.level != null || doc.sound.grain != null) &&
                             (BASIS || {}).tone)
                          // clamped at 1: the engine caps a tone's gain there,
                          // so level 3 and level 4 measured the same RMS to the
                          // millivolt and the slider was lying above the cap
                          ? { tone: { ...BASIS.tone,
                              ...(doc.sound.level != null ? {
                                gain: +Math.min(1, BASIS.tone.gain *
                                                   doc.sound.level).toFixed(3) } : {}),
                              ...(doc.sound.grain != null ? {
                                grain: +Math.max(0, Math.min(1, doc.sound.grain)).toFixed(3) } : {}) } }
                          : {}),
      // THE SEEDED HUMAN LAYER, WHICH THIS PAGE HAS NEVER OFFERED. All four are
      // spreads and not assignments, because absent must be the byte-identical
      // old behaviour and not a default written somewhere else: `stress` and
      // `phrase` are read as `+g.stress || 0` (kernel.js:1332), `touch` through
      // `humanOf`, `orn` not at all without a policy — so a document that says
      // nothing hands the kernel exactly the object it handed it yesterday.
      // `phrase` IS the arch Paul named: the phrase tent plus the agogic peak,
      // kernel.js:1337-1348, "two notes have no arch to hear, so the tent
      // starts at three".
      /* PERFORMANCE */ humanize: P.humanize, padRoom: true,
      /* …AND THE TAKE, WHICH WAS A SLIDER THAT MOVED NOTHING.
         Paul, 2026-08-26: "I can't seem to change seed and do a different
         take." Measured before this line existed: `performance.take` was in
         every document, `songs.js` set it, `ui/eight.js` drew a slider for it
         and `ui/atlas.js` PRINTED it — and no compiler read it. The only thing
         on the page that re-rolled anything was the atlas's "another take",
         which re-writes the whole record from the genre.

         THE LAW IS NOT INVENTED HERE. main:nukernel/band-kit.js:4635 already
         says what a take is on this box: "`kitSeed` is the kernel's own
         per-take dice (kernel.js rollAt): it decides which chance hits
         actually land, the HAND — seeded micro-timing in ninths of a step —
         the per-hit velocity humanisation, and the ornament rolls." Same
         constants, same section-index salt so one figure is not humanised
         identically in every section, same `pipes` seeding so a canon does not
         fall in the same places every time.

         IT REACHES THE ENGINE AND NOT THE MODEL, which is what makes the law
         hold by construction: a take cannot move a DECISION, because no
         decision is downstream of it. Absent — or 0, or 1 — is take one and
         every record before this renders byte-identical. */
                        ...takeOf(P.take, si, BASIS),
                        ...(P.stress != null ? { stress: P.stress } : {}),
                        ...(P.phrase != null ? { phrase: P.phrase } : {}),
                        ...(P.touch ? { touch: P.touch } : {}),
                        ...(P.orn ? { orn: P.orn } : {}),
      __v: ++ver,
    };
  }

  /* THE HOOK, COMPILED. The document says one of three things per step; the
     kernel wants two vectors. `gate` is the onsets. `hold` is how long each
     onset may sound, in steps, and it is written ONLY where a rest cuts a note
     short — a note running into the next onset needs no cap, and a phrase with
     no rests carries no `hold` key at all, which is byte-identical to every
     hook this page has played so far (kernel.js: "a phrase with no `hold` key
     takes exactly the old branch, byte for byte"). */
  function toPhrase(doc, cellName) {
    const H = cellOf(doc, cellName);
    if (!H || H.kind === "drum") return NuSong.blank();     // a grid is not a line
    // THE CELL'S OWN LENGTH, not sixteen. This said `const n = 16`, so a
    // two-measure cell compiled its first bar and dropped the second — and the
    // vectors it returned were a 16-step blank with 32-step deg/vel/acc spread
    // over it, which is a phrase whose parallel vectors disagree.
    const n = H.deg.length, z = () => new Array(n).fill(0);
    const play = H.play || H.deg.map(() => "n");
    const gate = play.map((p) => (p === "n" ? 1 : 0));
    const hold = z();
    let written = false;
    for (let i = 0; i < n; i++) {
      if (play[i] !== "n") continue;
      let k = 1;
      while (k < n && play[(i + k) % n] === "h") k++;       // how far it is held
      const next = play[(i + k) % n];
      // A HELD NOTE IS A WRITTEN LENGTH, and that is the only thing that beats
      // the cap (kernel.js:1678 — "an explicit hold outranks the cap… a written
      // length is the whole length"). There are TWO caps and only one was
      // allowed for: a genre may declare `maxHold`, and kernel PARTS gives each
      // part its own — four steps for a lead, three for a counter — whatever
      // the genre says. That second cap is why nothing longer than a quarter
      // note would sound: a note held across eight steps came out clipped at
      // four, silently. Any note the hand extended now carries its length.
      if (k > 1 || next === "r") { hold[i] = k; written = true; }
    }
    // THE PHRASE KNOWS ITS OWN BAR (2026-08-30, the triple-meter round).
    // kernel.js keep() reads authored 16-grid positions, and a twelve-step
    // phrase read modulo sixteen mis-keeps its second bar — so under a
    // declared meter the phrase carries the two numbers keep needs to
    // re-seat them (`bar`/`pulse`, kernel.js seat16). Present-only: a
    // document with no meter stamps nothing and every phrase ever compiled
    // is byte-identical.
    const met = metRow(doc.time);
    /* ---- THE MARKS A HAND WRITES ON A STEP (2026-09-05, review items 6+7)
       Three of the cell's vectors reach the phrase here and only here:
         · `acc` — the accent, already compiled and already read by the
           kernel (ACCENT_LIFT x1.15) and by the exports (velOfWritten). It
           was the one vector NOBODY WROTE; the bench writes it now.
         · `sld` — the slide INTO a step. `z()` stood here, so a slide written
           on a cell was thrown away before the kernel could see it; the
           vector itself is not new (the `slides` operator has always made
           one) and this is the door the hand's own slide walks through.
         · `art` — the new articulation mark (0 none, 1 staccato, 2 tenuto,
           3 slur), PRESENT-ONLY the way `hold` is: a cell with no marks
           compiles the same eight keys it always did, so every phrase in the
           catalogue is byte-identical and nothing needed migrating.
         · `alt` — the accidental, a signed semitone, present-only for the
           same reason.
       A CELL WITH AN ALL-ZERO VECTOR STAMPS NO KEY, which keeps ONE spelling
       of "nothing is marked" — the same law `hold`'s own `written` flag
       keeps two lines up, and the reason a mark cleared back to none leaves
       no residue in the document. */
    const marked = (a) => Array.isArray(a) && a.length === n && a.some(Boolean);
    return { deg: H.deg.slice(), oct: z(), vel: (H.vel || z()).slice(),
             inc: z(), stk: z(), gate, acc: (H.acc || z()).slice(),
             sld: (H.sld || z()).slice(),
             ...(marked(H.art) ? { art: H.art.slice() } : {}),
             ...(marked(H.alt) ? { alt: H.alt.slice() } : {}),
             ...(written ? { hold } : {}),
             ...(met ? { bar: met.steps, pulse: met.pulse } : {}) };
  }

  /* THE BOX CARRIES WHAT THE SECTION SAYS ABOUT THE BASS AND THE KIT — both
     are fields the daw's boxes have always had (ui/derive.js reads `bassop`
     and `kit`), so a per-section bass needed no machinery, only somewhere to
     say it.
     `gk` is the genre-key PREFIX the caller registered its per-section genres
     under; it is an argument rather than a constant because a node caller
     scoring a document must not collide with the page's own "lab.eight." rows
     in the shared GENRES table. */
  function boxesOf(doc, gk) {
    const secs = doc.form.sections, NS = secs.length, lines = LINES(doc);
    const bass = BASSV(doc), drums = DRUMV(doc), pre = gk == null ? "lab.eight." : gk;
    // THE ROW, THROUGH §2's ONE OWNER. The three fields whose answer this box
    // carries and the section genre cannot (swing, groove) plus the six the
    // box has always had a slot for (fx, rev, echo, dtime, room, pan) all ask
    // here; `key`, `mode` and `prog` deliberately do NOT, because `toGenre`
    // already resolved them onto the per-section genre this box points at and
    // ui/derive.js `genreOf` would apply them a second time (¶A).
    const rrow = (i, f) => resolveRow(doc, i, f);
    /* ...AND FOR THE TWO WITH A RECORD TIER, ONLY WHAT THE ROW ITSELF SAID —
       which is avail.js's idiom, verbatim and for the same reason ("only the
       two tiers this facet is entitled to speak for are taken … resolveFrom's
       `from` is what makes that distinction sayable rather than guessed at").
       `swing` and `groove` resolve `row -> record`, and the RECORD's answer
       already reaches ui/derive.js by its own road: ui/eight.js calls
       `setSwing`/`setGroove` off `DOC.time` and derive takes both as
       arguments. Writing the resolved answer onto the box would put the
       record's own word on EVERY box and let it outrank the song's — the
       transport's groove control fighting a value baked at compile time,
       which is the "I tap groove and nothing happens" bug from the other end.
       MEASURED before this line existed, by nukernel/gates-extract.js: the
       `time.groove` sheet went from `alive: 0` to `alive: 40` — 40 records
       whose sound moved for a reason this wave never claimed. So the box
       carries the ROW's own word and nothing else, and a record whose rows
       say nothing produces the byte-identical box it always did. */
    const rowOnly = (i, f) => {
      const r = resolveFrom(doc, i, 0, f);
      return r.from === "row" ? r.v : undefined;
    };
    /* THE FORM, ONTO THE BOXES (2026-09-05, the review's item 9). One walk
       (`formWalk` above) answers for the whole record and this is where its
       answer is written down, PRESENT-ONLY: a record that repeats nothing,
       ends nothing twice and has no coda stamps not one of these keys and the
       boxes are the objects they always were, byte for byte. */
    const WALK = formWalk(doc);
    return secs.map((s2, i) => { const sw = rowOnly(i, "swing"), gv = rowOnly(i, "groove");
      const w = WALK[i] || { plays: 1, cut: 0 };
      return ({ ...NuSong.emptyBox(),
      ...(w.plays > 1 ? { plays: w.plays } : {}),
      ...(w.cut ? { cut: w.cut } : {}),
      ...(w.skip ? { skip: true } : {}),
      ...(w.coda ? { coda: true } : {}),
      ...(s2.ending ? { ending: true } : {}),
      // …AND THE LANES THE ROW ITSELF DRAWS (2026-09-05, item 10). Present-only:
      // `audio/desk.js compileAuto` appends `sec.auto` after the `mot` shapes
      // and has done since it was written; what was missing was a writer.
      ...(Array.isArray(s2.auto) && s2.auto.length ? { auto: s2.auto } : {}),
      stack: [{ g: pre + i, slots: lines.map((c, v) => v * NS + i) }],
      len: s2.bars, role: s2.role, cue: s2.role,
      bassop: wordAt(doc, bass, i) || null,
      // A CONCERN THAT IS OFF CONTRIBUTES NOTHING — the law `toGenre`'s `noKit`
      // already states four lines up ("when a concern is absent, every field of
      // it has to go, not just the headline one"), applied to the box as well
      // as to the genre. Measured 2026-08-24 by nukernel/gates-extract.js: with
      // the drummer switched OFF, 65 of 68 KITLABEL words still moved the
      // score, because the box carried the section's kit word anyway and
      // ui/derive.js:236 reads "a kit word on a kitless genre implies a four
      // underneath" and BUILDS A KIT OUT OF NOTHING. A record with no drummer
      // grew a four-on-the-floor the moment somebody said "half time" in a
      // section, and nothing on the page said so.
      kit: (drums && drums.cast.on) ? (wordAt(doc, drums, i) || null) : null,
      // THE SECTION'S OWN SHAPE AND ITS EDGES (D7, 2026-08-24 — Paul: "we had
      // lots of fun nudges to the music and motifs — like arching"). Every one
      // of these keys was already read off the box by ui/derive.js and
      // audio/desk.js and already defaulted to null by song.js:172 skeleton();
      // the only thing missing was somebody writing them down. `|| null` on
      // each, so a document that says nothing produces the identical box it
      // produced before this line existed — which is what D7's gate measures
      // first (velocity spread 0 with nothing set).
      // (the four with a resolver row ask through it, for the reason `rrow`
      // gives above: the row is a TIER of §2's law, not a field somebody
      // reaches into. `env` and `lvl` keep the direct read — TIERS names them
      // `shape` and `level` and a second spelling of a field's name inside the
      // resolver is exactly the drift the 2026-09-01 rename law forbids.)
      intro: rrow(i, "intro") || null, env: s2.env || null,
      outro: rrow(i, "outro") || null,
      mot: rrow(i, "mot") || null, lvl: s2.lvl || null,
      breath: rrow(i, "breath") || null,
      pipe: rrow(i, "pipe") || null, period: rrow(i, "period") || null,
      // ...AND ITS PACE (2026-08-30, the per-section-pace round): the section
      // word that multiplies the record's one bpm under this section alone —
      // compose deals it (dealPaces), audio/plan.js PACE_RATE is what a word
      // is worth at the clock, the same words/numbers split lvl/LEVELS made.
      // `|| null` like every key above it: a record that says nothing writes
      // nothing.
      pace: rrow(i, "pace") || null,
      nudge: s2.nudge | 0,
      /* ---- THE SECTION'S CHAIN, ITS SENDS, ITS ROOM AND ITS PLACE
         (TABLE.md wave 2a, 2026-09-04). Every key below is one `emptyBox`
         already defaults and `song.js validateSong` already filters, and the
         only thing missing was — again — somebody writing them down: compose
         deals an fx chain on 1,441 of 4,859 sections, a reverb send on 1,835
         and an echo send on 552, and the projection dropped all three. Read
         through the RESOLVER rather than off `s2` directly, so the row is one
         tier of §2's law and not a special case with its own reader; with
         nothing said the resolver returns undefined and each key lands on the
         identical default `...emptyBox()` put there two lines up. `dtime`,
         `pan` and `room` have no dealer at all and are the hand's. */
      fx: rrow(i, "fx") || [],
      rev: rrow(i, "rev") || null,
      echo: rrow(i, "echo") || null,
      dtime: rrow(i, "dtime") || null,
      room: rrow(i, "room") || null,
      pan: rrow(i, "pan") || null,
      /* ...AND THE TWO THE SECTION GENRE CANNOT CARRY. `swing` and `groove`
         reach the kernel as ARGUMENTS to ui/derive.js `sectionEvents`, not as
         genre fields — the song's drummer, handed in once for the whole
         record — so the resolved row answer has to ride on the BOX for derive
         to prefer it over the song's. Present-only (a conditional spread and
         not a `|| null`), because neither is an `emptyBox` key: a record whose
         rows say nothing produces the byte-identical box it produced before
         this line, which is what document.test.js G6 measures. */
      ...(sw ? { swing: sw } : {}),
      ...(gv ? { groove: gv } : {}) }); });
  }

  // EVERY VOICE HAS A WORD FOR EVERY SECTION, and the words are keyed by the
  // section's ID — so adding, removing or reordering sections cannot shift a
  // voice's part under it. Filled once, before anything draws.
  //
  // The page's copy also reset `cellSel`, the cell the hook maker is editing.
  // That is a VIEW fact — which cell has the cursor in it is not something the
  // record says — so it stayed in ui/eight.js and this function only touches
  // the document. Mutates in place and returns it, the way the page's did.
  /* ---- THE GREAT RENAME'S DOOR (2026-09-01) ---------------------------
     Paul: "Rename everything to a genre. No more band names or album name
     or people names. ONLY genre." 68 anchor keys changed in genres.js on
     that ruling — and every record ALREADY SAVED under an old key (a
     session in localStorage, a keep, a share link) would otherwise load as
     `GENRES[doc.basis] || {}` = an EMPTY genre: no error, wrong sound, the
     exact silent degrade this box legislates against. So the old keys are
     FOLDED HERE, AT THE DOOR, ONCE — the sound.fx precedent below, same
     law, one owner. ABSENT IS TODAY: a basis this map does not name takes
     no branch and comes out byte-identical. */
  const OLDKEYS = {
    spem: "polychoral", eurythmics: "synthsoul", isley: "psychsoul",
    toto: "aor", jodeci: "newjackswing2", beatles: "beatgroup",
    steely: "jazzrock", motown: "detroitsoul", bodiddley: "hambone",
    chuckberry: "rocknroll", kraftwerk: "dusseldorfschool",
    waxtrax: "industrialdance", hendrix: "acidrock", moroder: "eurodisco",
    beachboys: "baroquepop", velvets: "protopunk", winstons: "amenbreak",
    sabbath: "heavymetal", ymo: "technopop", pfunk: "psychfunk",
    galaxie500: "slowcore", slowdive: "ambientpop", younggalaxy: "balearic",
    radiohead: "artrock", stoneroses: "baggy", wings: "softrock",
    skinnypuppy: "electroindustrial", ministrysynth: "electropop",
    katebush: "artpop", petergabriel: "worldbeat", fairuz: "beiruttarab",
    bronskibeat: "hinrg", omd: "newpop", sisters: "leedsgoth",
    seinfeld: "sitcomsting", miamivice: "copshowsynth",
    korngold: "goldenagescore", herrmann: "suspensescore",
    morricone: "spaghettiwestern", barry: "spyscore",
    carpenter: "horrorsynth", hammerhorror: "horrorscore",
    kruderdorfmeister: "viennadownbeat", portishead: "noirhop",
    tricky: "knowlewest", morcheeba: "chillout", lamb: "torchbreaks",
    djshadow: "instrumentalhiphop", thieverycorporation: "downtempo",
    air: "versailles", massiveattack: "bristolsound", stgermain: "nujazz",
    royksopp: "tromso", skokiaan: "tsabatsaba", seikilos: "skolion",
    mawsili: "abbasid", kassia: "sticheron", hildegard: "antiphon",
    dunstaple: "contenanceangloise", dufay: "isorhythm",
    josquin: "francoflemish", monteverdi: "secondapratica",
    schutz: "sacredconcerto", satie: "furnituremusic",
    stockhausen: "cologneschool", ziryab: "andalusi", cemilbey: "ottoman",
    brill: "girlgroup",
    /* THE HIP-HOP SOUL SWAP'S RETIRED HALF (2026-09-04). Paul: "Do the
       swap." `hiphopsoul2` (New York 1992, Mary J. Blige) took the bare
       `hiphopsoul` key and the Hip-hop soul article outright, so the
       numbered key is RETIRED and belongs here with the other sixty-nine:
       nothing answers to it any more, and a save naming it means exactly
       one row. Its old partner is the other half and it is NOT here —
       see MOVEDKEYS. */
    hiphopsoul2: "hiphopsoul",
  };
  /* ===== MOVEDKEYS — A KEY THAT WAS REUSED, NOT RETIRED (2026-09-04) =====
     Paul: "Do the swap." The two Uptown rows exchanged keys: the Jodeci
     record (Charlotte 1991) became `newjackswing2`, and the Mary J. Blige
     record (New York 1992) took the bare `hiphopsoul` off it. So for the
     first time in this table's history a key did not RETIRE, it MOVED —
     `hiphopsoul` names a real, live, different row today — and that is a
     different fact from every entry in OLDKEYS above.

     IT COULD NOT GO IN OLDKEYS, and the reason is one line of arithmetic:
     `normalize()` applies OLDKEYS to EVERY document that reaches it,
     including one `precompose.genreToDocument("hiphopsoul", …)` composed a
     millisecond ago, and there is nothing in a document that says how old
     it is. A live key sitting in that map would therefore fold every NEW
     Blige record into the Jodeci row, forever, silently — the exact class
     of degrade the OLDKEYS block above exists to prevent, pointed the
     other way. Measured before this block was written: with
     `hiphopsoul: "newjackswing2"` in OLDKEYS, a fresh Blige document comes
     back out of `normalize()` as `newjackswing2`.

     SO IT IS THE SAVE'S DOOR THAT READS IT, because a save is the one
     thing that carries a version: `song.js migrate()` folds these ONLY for
     a save written before `NuSong.VERSION` 3, which is the version this
     swap bumped and the only clock the box has. Documents do not fold —
     nothing persists a `doc.basis` (the store holds phrases, boxes and
     session genres; a share link carries a PLACE and a YEAR, and Charlotte
     1991 still resolves, now to `newjackswing2`), so there is no old
     document to fold and no live one to break.

     STILL ONE MAP PER FACT AND ONE OWNER — the 2026-09-01 law's actual
     sentence is "never a third copy of the map", and this is not a copy of
     OLDKEYS, it is the other kind of rename with its own door and its own
     precondition. Gate: test/document.test.js G10b. */
  const MOVEDKEYS = {
    hiphopsoul: "newjackswing2",
  };
  /* ===== A MOTIF'S NAME IS THE COMPOSER'S, AND RENAMING IT IS ONE DOOR ====
     (2026-09-02, slice 2c. Paul, B8: *"Motifs are editable using our existing
     interface … It should be easy to make new motifs"*, and the map's own
     finding: *"names are auto (`motif`, `motif2`, `beat`); there is NO rename
     control for a cell anywhere in the tree."*)

     A CELL'S NAME IS AN ADDRESS THAT FOUR THINGS POINT AT: the bank's own key,
     every `voice.material` that is a STRING, every VALUE in a `voice.material`
     map, and (on the page, not in the record) `motifTab` / `cellSel`. Renaming
     is therefore a WALK, not an assignment — and the 2026-09-01 genre-only
     rename law says a walk like this gets ONE door and never a second copy of
     the map. This is that door; the page moves its own two page-facts beside
     the call and stores nothing.

     IT REFUSES RATHER THAN MERGES. A name the bank already holds would make
     `cellOf` answer for whichever came first and would silently overwrite a
     tune (the same sentence `addCell` makes about minting), so the answer is
     `false` and the caller says why. An empty name, an unchanged name and a
     name for a cell that is not in the bank are the same refusal.

     THE BANK KEEPS ITS ORDER, which is why this rebuilds the object rather
     than doing `cells[to] = cells[from]; delete cells[from]`. `Object.keys`
     order IS the bank's order — the motif marks' ordinals are read off it and
     `cellNames()[0]` is what `cellOf` falls through to — so a rename that
     moved a cell to the end of the list would renumber every mark in the
     gutter for a change of spelling. */
  function renameCell(doc, from, to) {
    const cells = doc && doc.material && doc.material.cells;
    if (!cells || !Object.prototype.hasOwnProperty.call(cells, from)) return false;
    const name = String(to == null ? "" : to).trim();
    if (!name || name === from) return false;
    if (Object.prototype.hasOwnProperty.call(cells, name)) return false;
    const next = {};
    for (const k of Object.keys(cells)) next[k === from ? name : k] = cells[k];
    doc.material.cells = next;
    /* THE PROVENANCE MAP IS A FIFTH THING THAT POINTS AT THE NAME (§3), and
       the 2026-09-01 rename law is that a walk like this gets ONE door — so it
       is walked HERE and not in a second copy. Order is kept for the same
       reason the bank's is. A record with no map (every save older than the
       table) takes no branch. */
    if (doc.material.prov) {
      const pn = {};
      for (const k of Object.keys(doc.material.prov))
        pn[k === from ? name : k] = doc.material.prov[k];
      doc.material.prov = pn;
    }
    for (const v of (doc.voices || [])) {
      if (v.material === from) { v.material = name; continue; }
      if (v.material && typeof v.material === "object")
        for (const k of Object.keys(v.material))
          if (v.material[k] === from) v.material[k] = name;
    }
    return true;
  }
  /* ======================================================================
     THE TABLE — three vectors, one inherit law, one owner (TABLE.md §1-§3)
     ======================================================================
     Paul, 2026-09-03: "a song can be understood as a grid with sections as
     rows and instruments as columns … Each cell can be understood as a
     vector." Wave 1 is the MODEL and nothing else: no control moves, no
     record changes, and the gate that says so (test/table.test.js T2) renders
     every anchor at seeds 1-3 against a worktree of v263 and demands the
     events be byte-identical.

     WHAT IS ACTUALLY HERE. Three things, and they are small on purpose:
       · TIERS   — §1's field/tier table AS DATA, so the gate reads the claim
                   instead of restating it. It is also where this file records
                   the places §1 turned out to be WRONG about the shipped
                   document (each one marked `note`), because the spec is
                   corrected by measurement and not the other way round.
       · resolve — the ONE owner of `cell -> column -> row -> record -> genre`.
                   Every reader that used to reach into `cast.entry` /
                   `cast.reg` for a voice IN A SECTION now asks here, so a cell
                   override reaches the sound by construction rather than by
                   somebody remembering to wire it (the declared-but-never-
                   arriving law — six params in one week were declared, costed
                   and silent).
       · provOf  — a motif's provenance: own · guest:<genre> · hand (§3).

     WHY `voice.cells[secId]` AND NOT A GRID. A cell override is stored on the
     COLUMN, keyed by the SECTION'S ID — which is exactly where `development`
     and `desk.trim` already live, for the reason `development`'s own comment
     gives: "keyed by the section's ID — so adding, removing or reordering
     sections cannot shift a voice's part under it". A second addressing
     scheme for the same grid would be a second answer to "which cell is
     this", and normalize() would need a second pruner. It is SPARSE (§2: "a
     cell stores only what a hand wrote there"): eighty cells and almost all
     of them say nothing, so almost all of them do not exist. */

  /* ---- §1 AS DATA ------------------------------------------------------
     One row per field §1 names, with the tier it is STORED at (`tier`), the
     address it is stored at (`at`, evaluated by `addressOf` below), and — for
     the three fields this wave moves — the tier that may OVERRIDE it
     (`over`). A field with no address today carries the WAVE that will give
     it one instead, which is the refused-control law (§4: "no silent grey")
     written down where a gate can read it: a field may be declared and not
     yet reachable, but it may not be silently either. */
  const TIERS = {
    /* SECTION (a row) — `doc.form.sections[si]`, and `boxesOf` copies each of
       these onto the box the engine reads. */
    type:   { tier: "row", at: "form.sections[si].role" },
    bars:   { tier: "row", at: "form.sections[si].bars" },
    level:  { tier: "row", at: "form.sections[si].lvl" },
    shape:  { tier: "row", at: "form.sections[si].env" },
    /* THESE THREE WERE DEALT AND THEN DROPPED, AND ARE CARRIED NOW (wave 2a,
       2026-09-04 — the first step of the wave, gated on its own). MEASURED
       2026-09-03 over 479 anchors x seed 1 = 4,859 composed sections:
       `compose()` deals `outro` on 1,718 of them, `mot` on 1,042 and `intro`
       on 580 — and `genreToDocument`'s section projection copied none of the
       three, so `boxesOf` wrote `intro/outro/mot: null` on every precomposed
       record and the section's arrival, its departure and its motion never
       reached a box. It was the SAME bug precompose's own comment records
       having fixed for `lvl` and `env` on 2026-08-28 ("compose.js deals `env`
       on nearly every section … and this map dropped both on the floor"),
       two fields further along the same line. precompose now carries all
       three by the same present-only extraction; the document holds 579
       intros, 1,714 outros and 1,038 mots at seed 1, and 478 of 479 anchors'
       RENDERED bars moved (T4c; T4a for the lanes). `breath`, `pipe` and `nudge` are dealt by
       nobody at all — hand fields with an address and no writer. */
    intro:  { tier: "row", at: "form.sections[si].intro",
              note: "carried 2026-09-04; 579 of 4,859 sections, 458 records" },
    outro:  { tier: "row", at: "form.sections[si].outro",
              note: "carried 2026-09-04; 1,714 of 4,859 sections, 472 records" },
    mot:    { tier: "row", at: "form.sections[si].mot",
              note: "carried 2026-09-04; 1,038 sections -> auto[] lanes, 280 records" },
    period: { tier: "row", at: "form.sections[si].period" },
    breath: { tier: "row", at: "form.sections[si].breath",
              note: "an address with no writer: nothing deals a breath" },
    pipe:   { tier: "row", at: "form.sections[si].pipe",
              note: "an address with no writer: nothing deals a pipe" },
    pace:   { tier: "row", at: "form.sections[si].pace" },
    nudge:  { tier: "row", at: "form.sections[si].nudge",
              note: "an address with no writer; boxesOf defaults it to 0" },
    /* MEASURED 2026-09-03, and §1 is corrected here rather than obeyed.
       `bassop` and `kit` are drawn on the row and the row does not own them:
       `boxesOf` reads each off a VOICE's `development` map — the bass voice's
       word and the drummer's word for that section — which is the column
       tier answering a row-shaped question. That is not a bug (a bass line is
       a thing the bass plays), it is a tier correction: they resolve from the
       column, per section, exactly like every other `development` word. */
    bassop: { tier: "column", at: "voices[bass].development[secId]",
              note: "§1 files this on the row; boxesOf reads it off the bass VOICE" },
    kit:    { tier: "column", at: "voices[drums].development[secId]",
              note: "§1 files this on the row; boxesOf reads it off the drums VOICE" },
    /* ...AND THESE FIVE ARE STORED ON THE RECORD AND OVERRIDDEN BY THE ROW
       (wave 2a, 2026-09-04). §1 files key, mode, prog, swing and groove on the
       section ("a bridge modulates, so key is a row override of Time's key")
       and the shipped document carried exactly ONE of each, on the RECORD:
       `alphabet.key/mode/prog` and `time.swing/groove`. precompose said so out
       loud — "the document carries ONE key: precompose drops compose()'s
       per-section modulations" — and that drop was measurable: at seed 1
       compose modulates the MODE on 399 sections (every bridge it writes: a
       dorian/phrygian/harmonic/mixolydian middle eight), the KEY on 275
       sections of 228 records (the relative-minor bridge and the truck-driver
       last chorus) and names a PROG on 12. All three are carried now, and the
       row may say any of the five where the composer said nothing.

       THE TIER IS STILL THE RECORD, which is what `tier` means here — where
       the fact is STORED when nobody overrode it — and `over: "row"` is the
       tier that may. Absent on the row is the record's, byte for byte, which
       is what makes 479 anchors x 3 seeds render identically for the two
       fields (swing, groove) the composer deals no per-section value for.

       ONE OWNER: `toGenre` resolves all five, and `boxesOf` writes key, mode
       and prog onto the box for NOBODY — ui/derive.js `genreOf` reads
       `sec.key`/`sec.mode`/`sec.prog` off a box, and writing them there as
       well as resolving them here would apply the same modulation twice
       (¶A's "no curve applied twice"). `swing` and `groove` ARE written on
       the box, and for the opposite reason: they are the two the section
       genre cannot carry — derive.js takes the song's swing and groove as
       ARGUMENTS and would stomp the row's answer, so the box carries the flag
       that says the row spoke. */
    key:    { tier: "record", at: "alphabet.key", over: "row",
              note: "the row modulates: 275 of 4,859 sections at seed 1" },
    mode:   { tier: "record", at: "alphabet.mode", over: "row",
              note: "the row modulates: 399 sections, every composed bridge" },
    prog:   { tier: "record", at: "alphabet.prog", over: "row",
              note: "the row names a PROGS key; both tiers answer in chord arrays" },
    swing:  { tier: "record", at: "time.swing", over: "row",
              note: "the composer deals none per section; the row may say one" },
    groove: { tier: "record", at: "time.groove", over: "row", note: "as swing" },
    /* ...AND THE SECTION'S CHAIN AND ROOM HAVE AN ADDRESS NOW (wave 2a,
       2026-09-04). This block used to read "no document address at all":
       `fx rev verb echo dtime pan` were BOX fields that `song.js emptyBox`
       defaulted and `boxesOf` never wrote, so a document could not say any of
       them per section — while compose was dealing an fx CHAIN on 1,441 of
       4,859 sections (272 records), a reverb send on 1,835 (479 records) and
       an echo send on 552 (331 records), all of them thrown away by the same
       projection that threw away lvl and env. They are row fields now, dealt
       where the composer deals them and a hand's otherwise, and `boxesOf`
       writes each onto the box at exactly the key `emptyBox` already
       defaults — so a section that says nothing produces the identical box.

       `verb` IS NOT ONE OF THEM, and this row is its tombstone read
       correctly: §1 lists `verb` beside `rev`, but the box field of that name
       was RETIRED on 2026-08-28 and its live successor is `room` — the KIT's
       own ambience send (audio/desk.js: "`sec.room` reaches the DRUMS ONLY,
       because it is the kit-ambience lane nukernel has always had"). So the
       row that carries an address is `room`, and giving `verb` one as well
       would be two names for one send, which is the thing the 2026-09-01
       rename law forbids. `song.js migrate` folds an old save's `verb` onto
       `room` and that is the only place the word survives.

       `auto[]` is still READ-ONLY on the row by §1's own line (compiled from
       `mot`, which the row now says) and is wave 3's field. */
    fx:     { tier: "row", at: "form.sections[si].fx",
              note: "carried 2026-09-04; compose deals a chain on 1,441 sections" },
    rev:    { tier: "row", at: "form.sections[si].rev",
              note: "carried 2026-09-04; compose deals it on 1,835 sections" },
    room:   { tier: "row", at: "form.sections[si].room",
              note: "§1 calls this `verb`; that box field was retired 2026-08-28 " +
                    "and `room` is the kit-ambience send it became" },
    echo:   { tier: "row", at: "form.sections[si].echo",
              note: "carried 2026-09-04; compose deals it on 552 sections" },
    dtime:  { tier: "row", at: "form.sections[si].dtime",
              note: "an address with no writer: nothing deals a delay time" },
    pan:    { tier: "row", at: "form.sections[si].pan",
              note: "an address with no writer: nothing deals a section pan" },
    auto:   { tier: "row", wave: 3, note: "compiled from mot; READ-ONLY on the row (§1)" },

    /* VOICE (a column) — `doc.voices[vi]`. */
    part:       { tier: "column", at: "voices[vi].cast.part" },
    /* ...AND WHOSE THROAT SINGS IT (2026-09-04, the per-chair singer round).
       A COLUMN FIELD AND NOT A ROW ONE, and the case that decides it is a
       choir: `chorale` seats four voices across three octaves and every one of
       them resolved to the same `MOUTHS.hymnal` alto, because a throat was a
       fact about the ROW and a row can say ONE. SATB needs four throats. So a
       chair may name its own, out of the five the engine models
       (`fields.js THROATS`, the extraction of state-engine's VOICE_TYPE), and
       `instruments.js throatTone` is the one owner of the precedence: the
       chair's word, then the row's `tone.mouth`, then the cast throat, then
       the patch's default singer.

       NO CELL TIER, said as a rule rather than an omission: a singer does not
       change throat in the bridge. What moves per section is the REGISTER, and
       `reg` two rows down is the field for it.
       NO GENRE TIER EITHER, and this one is a fact about GUESTS. A row states
       its chairs' throats as a `throat` closure by chair index (GENRES.md §3),
       and precompose asks it AT SEAT TIME, where it knows which row owns each
       chair — a guest sings with its own genre's throat, and the resolver's
       genre tier can only ever see `doc.basis`. So the closure is spent onto
       `cast.voice` once, by the one caller that knows the owner, and every
       reader downstream asks the chair.

       AND A HAND'S THROAT DOES NOT RE-SEAT THE WRITTEN LINE, said plainly
       because it is a real edge and not an oversight: `precompose` §7d writes a
       sung chair's octave into `cast.reg` as it COMPOSES the record, and a hand
       changing this word later is not a recompose. So a chair moved from an
       alto to a bass by hand keeps the register it was seated at, and the
       octave fold in `kernel.js homeFor` — the net that has always been under
       the seat — carries it to a reachable octave at the sound. The written
       line is then an octave out again, which is exactly the state every
       record was in before §7d and is why that fold still exists. Re-seating
       on a hand edit would mean re-rendering the record from the table, which
       is a recompile with a different name; the honest fix, when somebody
       wants it, is to re-deal the chair. */
    voice:      { tier: "column", at: "voices[vi].cast.voice",
                  note: "the row's `throat` closure is spent onto the chair by " +
                        "precompose (a guest sings with its own row); absent " +
                        "means the row's mouth, which is every record before 2026-09-04" },
    instrument: { tier: "column", at: "voices[vi].instrument" },
    drumkit:    { tier: "column", at: "voices[drums].instrument" },
    seat:       { tier: "column", at: "voices[vi].desk" },
    sound:      { tier: "column", at: "voices[vi].sound" },
    material:   { tier: "column", at: "voices[vi].material", over: "cell",
                  note: "the map form IS the cell tier: material[secId]" },
    development:{ tier: "column", at: "voices[vi].development", over: "cell",
                  note: "the map form IS the cell tier: development[secId]" },
    /* THE TWO §1 MOVED THIS WAVE. Both were measured on 2026-09-03 as being
       applied PER SECTION already (precompose ~3048: "entry is bars into every
       section here, not into the record"), which is what makes the column the
       DEFAULT and the cell the honest home. */
    entry:  { tier: "column", at: "voices[vi].cast.entry", over: "cell" },
    reg:    { tier: "column", at: "voices[vi].cast.reg",   over: "cell" },

    /* CELL (a section x a voice) — `doc.voices[vi].cells[secId]`. */
    focus:  { tier: "cell", at: "voices[vi].cells[secId].focus", reader: 2,
              /* §1 calls this "today a section index". MEASURED: `box.focus`
                 is a STACK index — which layer of a box's genre stack the
                 palette writes to (ui/derive.js focusOf clamps it to
                 `stack.length - 1`) — and on the document path `boxesOf`
                 builds a ONE-entry stack, so it is always 0 and reaches
                 nothing. `focusOf`/`focused` have no importer anywhere in the
                 tree. So there was no per-section index to migrate: this is a
                 NEW cell flag with no reader until the table draws it. */
              note: "box.focus is a STACK index, not a section index; " +
                    "stored and resolved here, drawn in wave 2" },
    prov:   { tier: "record", at: "material.prov",
              note: "a motif's provenance is a fact about the MOTIF (§3), " +
                    "and the bank is the record's — a cell POINTS at a motif" },
    /* THE CELL'S OWN LANE (TABLE.md wave 3, 2026-09-04). ¶A: "a cell lane is
       an OFFSET on the row's" — so this is a CELL-ONLY field with no column
       and no row reader below it, which is not an omission but the law: a cell
       that says nothing must ride the section's curve EXACTLY, and a default
       arriving from anywhere would be a second curve. The value is a small map
       of lane kind -> word (fields.js CELLAUTO), and `cellAutoOffset` is the
       one owner of what a word is worth. */
    mixauto:{ tier: "cell", at: "voices[vi].cells[secId].mixauto",
              note: "¶A: a cell lane is an OFFSET on the row's (§4); " +
                    "words in fields.js CELLAUTO, resolved by cellAutoOffset" },
    /* THE FIVE §1 MOVED IN WAVE 4 (2026-09-04). §1 CELL: *"artic / oct / rate
       / scale / clamp — today per box, applied to every voice; become per cell
       with the row as default."* Measured before the wave: all five were BOX
       fields (`song.js skeleton` seeds one per `fields.js FIELDS` row and
       `ui/derive.js optOf` reads `sec[k]`) and `boxesOf` wrote NOT ONE of them
       — so on the document path a section could not say any of the five and a
       CHAIR could not say them at all. Both tiers are addressed now: the row
       at `form.sections[si].<field>`, the cell at
       `voices[vi].cells[secId].<field>`, resolved cell -> row -> record by the
       one resolver and applied by ONE owner, `toGenre`.

       AND THE BOX STILL CARRIES NONE OF THEM, for the reason wave 2a gives for
       key/mode/prog: `ui/derive.js genreOf` reads `sec.artic`/`sec.scale`/
       `sec.clamp`/`sec.oct`/`sec.rate` off a box and would apply the row's
       word a SECOND time on top of the per-section genre this file already
       resolved it onto (¶A's "no curve applied twice", which is a pitch and a
       duration here rather than a fader). The palette's own box chips are
       untouched and reach the DAW's boxes exactly as they did.

       THE ONE FIELD WHOSE TIERS ANSWER IN DIFFERENT DIALECTS is `rate`, and it
       is said out loud rather than papered over. `time.rate` is the RECORD's
       ABSOLUTE step rate (songs.js: the chant sets 1 over gregorian's 0.5); a
       row's and a cell's `rate` is a `fields.js RATES` WORD — a multiplier, as
       every box chip of that name has always been. So the record is NOT a tier
       under this field (the resolver would hand back a number where the two
       upper tiers hand back a word), and `toGenre` multiplies the row's word
       into whatever absolute rate the record and the basis settled on. The
       same distinction `gain` and `level` already carry: two facts, two tiers,
       two names. */
    artic:  { tier: "row", at: "form.sections[si].artic", over: "cell",
              note: "wave 4: the row's word, a cell may override it per chair" },
    oct:    { tier: "row", at: "form.sections[si].oct", over: "cell",
              note: "wave 4: whole octaves, applied to the rendered note like " +
                    "ui/derive.js's own box `oct` (12 semitones, not `per`)" },
    rate:   { tier: "row", at: "form.sections[si].rate", over: "cell",
              note: "wave 4: a RATES word. `time.rate` is the RECORD's " +
                    "ABSOLUTE rate and is a different fact in different units" },
    scale:  { tier: "record", at: "alphabet.scale", over: "cell",
              note: "wave 4: the row and the cell may name another alphabet; " +
                    "all three tiers answer with a SCALES key" },
    clamp:  { tier: "row", at: "form.sections[si].clamp", over: "cell",
              note: "wave 4: the ramp limit. The kernel's floor is 7, so " +
                    "`0` (off) is a statement and not a neutral word" },

    /* RECORD (the table itself). */
    bpm:    { tier: "record", at: "time.bpm" },
    meter:  { tier: "record", at: "time.meter" },
    basis:  { tier: "record", at: "basis" },
    rules:  { tier: "record", at: "rules" },
    master: { tier: "record", at: "sound.master" },
    buses:  { tier: "record", at: "sound.buses" },
    gain:   { tier: "record", at: "sound.level",
              note: "the RECORD's balance. §1 spells the section's `lvl` " +
                    "\"level\" too; two fields, two tiers, so they are two names" },
    motifs: { tier: "record", at: "material.cells" },
    take:   { tier: "record", at: "performance.take" },
    humanize:{ tier: "record", at: "performance.humanize" },
    seed:   { tier: "record", wave: 2,
              note: "the reading is an ARGUMENT to genreToDocument, not a field" },
  };

  /* THE ADDRESS, EVALUATED. `at` is a path with three holes in it — `si` the
     section, `vi` the voice, `secId` the section's id — plus the two named
     voices the document addresses by KIND rather than by index. The gate walks
     it to prove a declared field is REACHABLE on a live record; nothing on the
     hot path reads it. Returns `undefined` for a field with no address, which
     is the same answer as a field whose address holds nothing — the caller
     tells them apart by asking TIERS. */
  function addressOf(doc, si, vi, field) {
    const T = TIERS[field];
    if (!T || !T.at) return undefined;
    const secId = SECID(doc, si);
    let node = doc;
    for (const step of T.at.split(".")) {
      if (node == null) return undefined;
      const m = /^([A-Za-z]+)((?:\[[^\]]+\])*)$/.exec(step);
      if (!m) return undefined;
      node = node[m[1]];
      for (const k of (m[2].match(/\[[^\]]+\]/g) || [])) {
        if (node == null) return undefined;
        const key = k.slice(1, -1);
        node = key === "si" ? node[si]
             : key === "vi" ? node[vi]
             : key === "secId" ? node[secId]
             : key === "bass" ? node.find((v) => v.kind === "bass")
             : key === "drums" ? node.find((v) => v.kind === "drums")
             : node[key];
      }
    }
    return node;
  }

  /* ---- THE CELL'S OWN VECTOR, SPARSE ----------------------------------- */
  // What a hand wrote in this one cell, or null. Never created by a reader:
  // `resolve` must not grow eighty objects on a record nobody has edited.
  const cellVec = (doc, si, vi) => {
    const v = doc.voices && doc.voices[vi];
    const id = SECID(doc, si);
    return (v && v.cells && id != null && v.cells[id]) || null;
  };
  /* THE ONE WRITER, and it is the one that keeps §2's sparse law true: a value
     equal to nothing (null/undefined) DELETES the override and the emptied
     shells delete themselves, so "inherited" has exactly one spelling in the
     record — the same rule normalize() applies to `desk.trim` and the same one
     ui/state.js setMixOffset applies to the board. Returns whether the
     document moved, so a caller can skip a recompile. */
  function putCell(doc, si, vi, field, value) {
    const v = doc.voices && doc.voices[vi], id = SECID(doc, si);
    // ...AND ONLY A FIELD THE CELL TIER ANSWERS FOR. `CELLFIELD` grew the
    // row's own fields in wave 2a and a key written in a cell would be a
    // second home for a control the table draws on the row — refused here and
    // dropped at the door, one rule, one derivation (`CELLWRITE`).
    if (!v || id == null || !CELLWRITE(field)) return false;
    const had = (v.cells && v.cells[id] && v.cells[id][field]);
    if (value == null || value === "") {
      if (!v.cells || !v.cells[id] || !(field in v.cells[id])) return false;
      delete v.cells[id][field];
      if (!Object.keys(v.cells[id]).length) delete v.cells[id];
      if (!Object.keys(v.cells).length) delete v.cells;
      return true;
    }
    /* ...AND A LANE MAP IS CLEANED AT THE DOOR (wave 3). `mixauto` is the one
       cell field whose value is an OBJECT, so "is this writable" is not the
       whole question a hand can get wrong: a word this build does not know,
       and the NEUTRAL word of a lane (which means "as mixed" and is therefore
       absent), both have to be dropped HERE or the record grows a second
       spelling of nothing. fields.js `cellAutoClean` is the one reader, shared
       with `normalize` below — never a second copy of the table. */
    if (field === "mixauto") {
      const clean = NF.cellAutoClean(value);
      if (!clean) return putCell(doc, si, vi, field, null);
      if (JSON.stringify(had) === JSON.stringify(clean)) return false;
      v.cells = v.cells || {};
      v.cells[id] = v.cells[id] || {};
      v.cells[id][field] = clean;
      return true;
    }
    /* ...AND THE FIVE WITH A VOCABULARY ARE CLEANED AT THE SAME DOOR (wave 4).
       `artic`/`oct`/`rate`/`scale`/`clamp` are stored as the TABLE'S OWN KEY —
       a string — so `-1` and `"-1"` are not two spellings of one octave, a
       word this build cannot play never lands, and the NEUTRAL word (`oct` 0:
       an octave shift of no octaves) is dropped for the same reason a neutral
       mix lane is. `fields.js cellVecClean` is the one reader, shared with
       `normalize` — never a second copy of the five tables. */
    if (NF.CELLVECBY && NF.CELLVECBY[field]) {
      const w = NF.cellVecClean(field, value);
      if (w == null) return putCell(doc, si, vi, field, null);
      if (had === w) return false;
      v.cells = v.cells || {};
      v.cells[id] = v.cells[id] || {};
      v.cells[id][field] = w;
      return true;
    }
    /* ...AND AN ENTRY IS JUDGED AND SNAPPED AT THE DOOR, not only at
       `normalize` (2026-09-05). It is the one remaining cell field with a
       RANGE rather than a vocabulary — a bar count from −1 (a pickup, item 9)
       upwards, on the cell's own step grid — and the door refusing what the
       door downstream would drop is what keeps a slider from writing a number
       the next recompile deletes (§1b's register bug, twice shipped).
       `entryOK` / `entrySnap` are the same two readers `normalize` uses. */
    if (field === "entry") {
      if (!entryOK(value)) return false;
      const snapped = entrySnap(value, cellStepsOf(doc));
      if (had === snapped) return false;
      v.cells = v.cells || {};
      v.cells[id] = v.cells[id] || {};
      v.cells[id][field] = snapped;
      return true;
    }
    if (had === value) return false;
    v.cells = v.cells || {};
    v.cells[id] = v.cells[id] || {};
    v.cells[id][field] = value;
    return true;
  }

  /* ---- THE INHERIT LAW (§2), AND ITS ONE OWNER ------------------------- */
  /* Every field resolves `cell -> column -> row -> record -> the genre's row`
     and THE FIRST VALUE FOUND WINS. A tier ANSWERS when its stored value is
     neither null nor undefined — which is what makes "absent is today" hold
     through this function too: on a record where no hand has written a cell,
     `entry` and `reg` come back off `cast` exactly as `toGenre` read them
     before this existed, so the record is byte-identical (T2).

     The rows below are per FIELD, one reader per tier, and a `null` reader is
     a tier that has nothing to say about that field — a register does not
     default from the section, a level does not default from the voice. Which
     tier a field defaults from is §1's, not this function's. */
  const CELLFIELD = {
    entry: {
      cell:   (c) => c && c.entry,
      column: (v) => v && v.cast && v.cast.entry,
      row:    null,
      record: null,
      // THE GENRE'S OWN ENTRY SCHEDULE, which is what a chair with no cast at
      // all would play: kernel.js:1523 reads `g.entry(v)` per voice, and the
      // anchor's closure is the last thing under the document.
      genre:  (G, vi) => (G && typeof G.entry === "function") ? G.entry(vi) : undefined,
    },
    reg: {
      cell:   (c) => c && c.reg,
      column: (v) => v && v.cast && v.cast.reg,
      row:    null,
      record: null,
      /* THE SOUNDING REGISTER, in the units the chair shows. precompose §7b:
         "`cast.reg` is now the SOUNDING register … and document.js toGenre
         hands the kernel back the base it implies (K.partLean)". The genre
         tier answers in the same units — the anchor's base plus the part's
         lean — so the four tiers cannot disagree about what a 0 means. */
      genre:  (G, vi, part) => (G && typeof G.reg === "function")
        ? G.reg(vi) + K.partLean(part) : undefined,
    },
    /* THE CHAIR'S OWN THROAT (2026-09-04). One reader, at the column, and
       four nulls: a cell may not say it (a singer does not change throat in
       the bridge), a row and a record are not people, and the GENRE tier
       cannot answer because the row that owns a chair may not be `doc.basis`
       — a guest sings with its own row's throat, which only precompose knows
       at seat time. Absent is the row's mouth, resolved where the seat is
       built (`instruments.js throatTone`), which is every record written
       before this field existed. */
    voice: {
      cell:   null,
      column: (v) => v && v.cast && v.cast.voice,
      row:    null, record: null,
      genre:  () => undefined,
    },
    focus: {
      cell:   (c) => c && c.focus,
      column: null, row: null, record: null,
      genre:  () => undefined,       // nothing under the table features a voice
    },
    /* THE CELL'S MIX LANE (wave 3). Four nulls under it on purpose — ¶A's
       "relative to that" is only true if ABSENT means "add nothing", and a
       tier that answered here would be adding something. The row's own lanes
       are not this field: they are `mot` -> `auto[]`, compiled one tier down
       by audio/desk.js, and the desk SUMS the two. */
    mixauto: {
      cell:   (c) => c && c.mixauto,
      column: null, row: null, record: null,
      genre:  () => undefined,       // no anchor rides a cell
    },
    /* ---- THE FIVE THAT WERE PER BOX (wave 4, 2026-09-04) ---------------
       §1 CELL, and §2's law with the COLUMN tier empty: an articulation is not
       a fact about a chair for the whole record — it is a fact about what that
       chair does HERE — so a cell answers first and the SECTION is the
       default, which is what "with the row as default" means. `fields.js
       CELLVEC` is the one owner of the five vocabularies and of what a legal
       word is (`cellVecClean`), shared with `putCell` and `normalize`, so the
       resolver and the two doors cannot disagree.

       EVERY TIER ANSWERS IN THE TABLE'S OWN KEY — a STRING — and `toGenre` is
       the one place a word becomes a value (an ARTICS name, a semitone count,
       a SCALES array, a ramp integer, a rate multiplier). That is the `prog`
       rule from wave 2a read the other way round: there, both tiers answered
       in chord arrays because the kernel wanted an array; here both tiers
       answer in words because the CELL SHEET wants a word, and exactly one
       function turns them into what the kernel wants.

       NO GENRE TIER on any of the five, and it is the same argument `key`
       makes: the kernel already has a floor for each (`g.artic || pol.artic ||
       "normal"`, `g.scale || PENT`, `g.incClamp == null ? 7`, no octave shift,
       the genre's own rate), those floors are in the KERNEL'S units, and
       answering here with the anchor's raw field would put a second, differently
       spelled default under a control whose absent state already sounds. */
    artic: { cell: (c) => c && c.artic, column: null,
             row: (s) => s && s.artic, record: null, genre: () => undefined },
    oct:   { cell: (c) => c && c.oct, column: null,
             row: (s) => s && s.oct, record: null, genre: () => undefined },
    /* ...AND `rate` HAS NO RECORD TIER, which the TIERS note above argues in
       full: `time.rate` is an ABSOLUTE rate and these two tiers speak in
       multipliers. A row that says nothing means the record's own clock. */
    rate:  { cell: (c) => c && c.rate, column: null,
             row: (s) => s && s.rate, record: null, genre: () => undefined },
    /* ...AND `scale` HAS ONE, because `alphabet.scale` is already a SCALES key
       — the same unit the row and the cell store — and `toGenre` has read it
       off the record since the extraction. Resolving it here is what makes the
       record's own alphabet the floor the row overrides. */
    scale: { cell: (c) => c && c.scale, column: null,
             row: (s) => s && s.scale,
             record: (d) => d.alphabet && d.alphabet.scale,
             genre: () => undefined },
    clamp: { cell: (c) => c && c.clamp, column: null,
             row: (s) => s && s.clamp, record: null, genre: () => undefined },
    /* ---- THE ROW'S OWN FIELDS (wave 2a, 2026-09-04) --------------------
       Every field below answers from the SECTION first and the RECORD (or
       nothing) second, which is §2's law with the two upper tiers empty: a
       key is not a fact about one chair, and a section's reverb send is the
       whole box's. They live in this table rather than beside it because §2
       has ONE owner and a second walk over the same five tiers is how the two
       drift apart — `resolveFrom` is the only function that knows the order.

       WHAT A `cell` READER MEANS HERE, and it is load-bearing: a field with
       one is a field `putCell` may write and `normalize` will keep on
       `voice.cells[secId]`. The rows below have none, so a cell that claims a
       key is dropped at the door — the table draws a key on the ROW, and a
       control with two homes is a control that disagrees with itself.

       AND THE TIERS ANSWER IN THE SAME UNITS, per field, which is the rule
       `reg` already set ("the four tiers cannot disagree about what a 0
       is"): `prog` is a chord ARRAY on both tiers (the row names a
       genres.js PROGS key and this reader resolves it), `key` is a
       fields.js KEYS value on both, `mode` a MODES name on both. A caller
       gets one kind of answer whichever tier won. */
    key: {
      cell: null, column: null,
      row:    (s) => s && s.key,
      record: (d) => d.alphabet && d.alphabet.key,
      // NO GENRE TIER, and that is `toGenre`'s own arithmetic protected: it
      // reads `KEYS[A.key] || 0`, so a record with no key at all plays C, and
      // falling through to the anchor's `g.key` here would hand it a number
      // in a different unit than the one this tier answers in.
      genre:  () => undefined,
    },
    mode: {
      cell: null, column: null,
      row:    (s) => s && s.mode,
      record: (d) => d.alphabet && d.alphabet.mode,
      genre:  () => undefined,       // toGenre's own aeolian default is the floor
    },
    prog: {
      cell: null, column: null,
      // THE ROW NAMES A PROGRESSION, THE RECORD CARRIES ONE. fields.js
      // PROGCHOICES is the row's vocabulary (the same twelve words the box's
      // `prog` chip offers) and genres.js PROGS is what each one IS; the
      // record stores the resolved array already, so this reader resolves the
      // name and both tiers hand back the same shape.
      // ...OR CARRIES ONE OUTRIGHT (2026-09-05). The section's changes grid
      // writes an ARRAY of chord objects on the row — a chart the row owns,
      // not a name it borrows — and both tiers still hand back the same shape,
      // which is the whole rule this field is written to.
      row:    (s) => (s && s.prog && s.prog !== "off")
                ? (Array.isArray(s.prog) ? s.prog : NG.PROGS[s.prog]) : undefined,
      record: (d) => d.alphabet && d.alphabet.prog,
      genre:  () => undefined,       // as key: `toGenre` reads A.prog and no lower
    },
    swing: {
      cell: null, column: null,
      row:    (s) => s && s.swing,
      record: (d) => d.time && d.time.swing,
      genre:  () => undefined,       // a genre's lean is inside its own rate
    },
    groove: {
      cell: null, column: null,
      row:    (s) => s && s.groove,
      record: (d) => d.time && d.time.groove,
      genre:  () => undefined,
    },
    /* THE SECTION'S TEMPO WORD. Already a row field with an address (dealt by
       compose.js dealPaces, carried since 2026-08-30, PACE_RATE at the clock)
       and the resolver is what makes it reachable the way every other row
       field is: there is no record-wide pace — the record's tempo is
       `time.bpm` and a pace is a multiplier ON it — so the row is the only
       tier that answers, and absent means the record's own clock. */
    pace: { cell: null, column: null, row: (s) => s && s.pace,
            record: null, genre: () => undefined },
    /* ...AND THE SECTION'S CHAIN, ITS TWO SENDS, ITS ROOM AND ITS PLACE.
       None of these has a record tier at all: `emptyBox`'s default IS the
       floor (an empty chain, no send, centre) and that is what "absent is
       today" means for them — the genre's own `tone.verb` is applied one
       level down, by audio/desk.js `sectionOf`, exactly as it is today for a
       box that says nothing. */
    fx:    { cell: null, column: null, row: (s) => (s && s.fx && s.fx.length) ? s.fx : undefined,
             record: null, genre: () => undefined },
    rev:   { cell: null, column: null, row: (s) => s && s.rev,   record: null, genre: () => undefined },
    room:  { cell: null, column: null, row: (s) => s && s.room,  record: null, genre: () => undefined },
    echo:  { cell: null, column: null, row: (s) => s && s.echo,  record: null, genre: () => undefined },
    dtime: { cell: null, column: null, row: (s) => s && s.dtime, record: null, genre: () => undefined },
    pan:   { cell: null, column: null, row: (s) => s && s.pan,   record: null, genre: () => undefined },
    /* ...AND THE SECTION'S ARRIVAL, DEPARTURE, MOTION AND SENTENCE — the
       three step 1 carries plus the one that was always carried. No record
       tier: a song does not have an intro figure, a SECTION does, and
       `emptyBox`'s null is the floor. */
    intro:  { cell: null, column: null, row: (s) => s && s.intro,  record: null, genre: () => undefined },
    outro:  { cell: null, column: null, row: (s) => s && s.outro,  record: null, genre: () => undefined },
    mot:    { cell: null, column: null, row: (s) => s && s.mot,    record: null, genre: () => undefined },
    period: { cell: null, column: null, row: (s) => s && s.period, record: null, genre: () => undefined },
    /* ...AND THE THREE THE ROW HAS ALWAYS ADDRESSED AND NOBODY DEALS.
       `boxesOf` has copied all three onto the box since 2026-08-24; what they
       lacked was a resolver call site, which is what a table cell asks
       through. Reachable, and still dealt by no composer. */
    breath:{ cell: null, column: null, row: (s) => s && s.breath, record: null, genre: () => undefined },
    pipe:  { cell: null, column: null, row: (s) => s && s.pipe,   record: null, genre: () => undefined },
    nudge: { cell: null, column: null, row: (s) => s && s.nudge,  record: null, genre: () => undefined },
    /* ---- THE ROW'S OWN DRAWN LANES (2026-09-05, the review's item 10) ----
       *"The section's own `automation` row is greyed: compiled from the motion
       above."* It is compiled from `mot` AND from this, which is what
       `audio/desk.js compileAuto` has always said — *"the box's own list: real
       entries only"* — with nobody able to write one. This is the writer.
       A lane is `{ param, points: [[bar, value], …], curve?, in: "bars" }`.
       `in: "bars"` is not decoration: a lane compose deals is in BEATS
       (compose.js autoShape) and a hand draws over the section's BARS, so the
       ruler travels with the numbers and `compileAuto` scales the ones that
       say so. Absent means beats, which is every lane ever written. */
    auto:  { cell: null, column: null,
             row: (s) => (s && Array.isArray(s.auto) && s.auto.length) ? s.auto : undefined,
             record: null, genre: () => undefined },
    /* ---- THE FORM GRAMMAR (2026-09-05, the review's item 9) -------------
       *"Fifteen section roles and no way to say 'play it twice with a
       different last bar'."* Four words on the row, no tier above it — a
       repeat is a fact about ONE section the way its length is:

         repeat  how many times the section is played. The WALK plays it
                 (ui/derive.js songBars repeats the box's bars); the document
                 keeps ONE section, which is the whole point — a duplicated
                 section is two sections to edit.
         ending  this section is the SECOND ENDING of the section above it: on
                 the last repeat of that section its own last bars are dropped
                 and these are played instead. It is a section, so it already
                 has its own cells, its own chairs and its own chart — which is
                 what a second ending is.
         coda    played once, after the form's last repeat.
         tocoda  the point the form jumps to the coda from: after this
                 section's last repeat the walk goes straight to the coda and
                 the sections between are not played.

       They are ROW-ONLY on purpose. A cell reader would let one chair repeat
       and another not, which is not a form, it is a mistake; `CELLWRITE` is
       derived from the `cell` reader, so leaving it null is the refusal. */
    repeat: { cell: null, column: null, row: (s) => s && s.repeat, record: null, genre: () => undefined },
    ending: { cell: null, column: null, row: (s) => s && s.ending, record: null, genre: () => undefined },
    coda:   { cell: null, column: null, row: (s) => s && s.coda,   record: null, genre: () => undefined },
    tocoda: { cell: null, column: null, row: (s) => s && s.tocoda, record: null, genre: () => undefined },
  };
  // WHICH OF THEM A HAND MAY WRITE IN A CELL (§2: "a cell stores only what a
  // hand wrote there") — the fields with a `cell` reader, and no others. One
  // derivation, two readers: `putCell` refuses the rest and `normalize` drops
  // them at the door, so a cell can never grow a field the table draws on the
  // row. `ROWWRITE` is the same question for the section.
  const CELLWRITE = (f) => !!(CELLFIELD[f] && CELLFIELD[f].cell);
  const ROWWRITE  = (f) => !!(CELLFIELD[f] && CELLFIELD[f].row);
  const TIERORDER = ["cell", "column", "row", "record", "genre"];
  /* `vi` INDEXES `doc.voices`, not the kernel's line list. A column IS a
     voice — that is the whole of §1's second table — and the kernel's index is
     a projection of it (`LINES`), so the projection is done at the call site
     that needs it (`toGenre`) and never inside the resolver. */
  function vectorOf(doc, si, vi, GENRES) {
    const out = {};
    for (const f of Object.keys(CELLFIELD)) out[f] = resolveFrom(doc, si, vi, f, GENRES);
    return out;
  }
  /* THE ROW'S WRITER (wave 2a), and it keeps the same sparse law `putCell`
     keeps: a value equal to nothing DELETES the override, so "the record's"
     has exactly one spelling on a section too. `vi` is not an argument
     because a row field is not a fact about a chair — the resolver is asked
     at voice 0 and its cell and column readers are null, so the answer is the
     row's or the record's and nothing else can reach it. Returns whether the
     document moved, like `putCell`, so a caller can skip a recompile. */
  function putRow(doc, si, field, value) {
    const sec = doc.form.sections && doc.form.sections[si];
    if (!sec || !ROWWRITE(field)) return false;
    if (value == null || value === "" ||
        (Array.isArray(value) && !value.length)) {
      if (!(field in sec)) return false;
      delete sec[field];
      return true;
    }
    if (JSON.stringify(sec[field]) === JSON.stringify(value)) return false;
    sec[field] = value;
    return true;
  }
  /* A ROW FIELD, RESOLVED — the same walk, asked without a chair. `toGenre`
     and `boxesOf` are its two callers and neither has a voice in hand.

     ...AND IT STARTS AT THE ROW, WHICH IS A FIX WITH A DATE ON IT (wave 4,
     2026-09-04). This asked at voice 0 and relied on the cell and column
     readers being null for every field it was ever handed — true of wave 2a's
     eleven, and FALSE the moment `artic`/`oct`/`rate`/`scale`/`clamp` grew a
     cell reader: the row's answer would then have been voice 0's cell
     override, and a chair's private articulation would have been printed as
     the section's and compiled onto the whole box. `from` is the first tier to
     consult, so the caller says which question it is asking rather than
     depending on which readers happen to be null. */
  const resolveRow = (doc, si, field, GENRES) =>
    resolveFrom(doc, si, 0, field, GENRES, "row").v;
  function resolveFrom(doc, si, vi, field, GENRES, from) {
    const R = CELLFIELD[field];
    if (!R) return { v: undefined, from: null };
    const v = doc.voices && doc.voices[vi];
    // an INDEX and not a `slice`: `resolve` is called per voice per section on
    // every compile, and a fresh five-element array per call is a cost this
    // walk has never had
    let start = from ? TIERORDER.indexOf(from) : 0;
    if (start < 0) start = 0;
    for (let ti = start; ti < TIERORDER.length; ti++) {
      const tier = TIERORDER[ti], rd = R[tier];
      if (!rd) continue;
      const got = tier === "cell"   ? rd(cellVec(doc, si, vi))
                : tier === "column" ? rd(v)
                : tier === "row"    ? rd(doc.form.sections[si], doc)
                : tier === "record" ? rd(doc)
                : rd((GENRES || CATALOG)[doc.basis], vi,
                     (v && v.cast && v.cast.part) || "line");
      if (got != null) return { v: got, from: tier };
    }
    return { v: undefined, from: null };
  }
  const resolve = (doc, si, vi, field, GENRES) =>
    resolveFrom(doc, si, vi, field, GENRES).v;

  /* ---- §3 · WHERE A MOTIF CAME FROM ------------------------------------
     Every motif in the bank carries one of three provenances, and the bank is
     the RECORD's (a cell points at a motif; one motif read by three voices is
     one motif), so the map lives beside the cells:

         doc.material.prov = { "<cell>": { p: "own" | "guest" | "hand",
                                           g?: "<genre>", fp?: "<print>" } }

     ABSENT IS OWN. A document with no `prov` at all — every record written
     before this line, `songs.js TERMS`, a hand-authored fixture — is entirely
     the record's own material, which is true of every one of them, and it is
     why `normalize()` stays a byte-identical no-op on the shipped chant (G7).

     A MOTIF THE MAP DOES NOT NAME, ON A RECORD THAT HAS A MAP, IS THE HAND'S.
     That is not a convention, it is the measurement: the four places a cell is
     minted on the bench (`+ motif`, `+ drum pattern`, the fork button, the
     drum-cell repair) all write `DOC.material.cells[<new name>]` and none of
     them deals anything, so a name the composer never dealt is a name a hand
     made up.

     ...AND SO IS AN EDITED ONE (§3: "a hand's edit of a dealt motif makes it
     the hand's"). `fp` is the fingerprint of the cell AS DEALT; when the cell
     no longer prints the same, a hand has been in it. This is derived rather
     than stamped ON PURPOSE — the alternative is a flag somebody has to
     remember to set at each of the ~fourteen writers in ui/eight.js, which is
     this repo's characteristic bug written down in advance. Measured, not
     declared. */
  const PROV_OWN = { p: "own" };
  const PROVKINDS = { own: 1, guest: 1, hand: 1 };
  // FNV-1a over the cell's own vectors in a FIXED key order — the order is the
  // point, because `JSON.stringify` follows insertion order and a hand that
  // adds `play` to a cell that had none would otherwise print differently for
  // a reason that is not an edit. 32-bit, base36: eight characters in a save.
  const FPKEYS = ["kind", "deg", "play", "vel", "acc", "oct", "lanes", "swing"];
  function fingerprint(cell) {
    if (!cell) return "";
    let s = "";
    for (const k of FPKEYS) if (cell[k] != null) s += k + ":" + JSON.stringify(cell[k]) + ";";
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }
  const provMap = (doc) => (doc && doc.material && doc.material.prov) || null;
  function provOf(doc, name) {
    const M = provMap(doc);
    if (!M) return PROV_OWN;                       // absent is own — every old save
    const e = M[name];
    if (!e) return { p: "hand" };                  // minted on the bench
    if (e.p === "hand") return { p: "hand" };
    if (e.fp && e.fp !== fingerprint((doc.material.cells || {})[name]))
      return { p: "hand" };                        // dealt, then edited
    return e.g ? { p: e.p, g: e.g } : { p: e.p };
  }
  // THE WORD THE TABLE DRAWS, one owner so the bench, the sheet and the gate
  // cannot spell it three ways.
  const provWord = (pr) => pr.p === "guest" ? "guest: " + pr.g : pr.p;
  /* THE STAMP, called ONCE by the composer as it hands the record over
     (`precompose.genreToDocument`). It takes `{ <cell>: { p, g } }` — who
     DEALT what, which only the composer knows — and fingerprints the cells
     here, which is the half only this file should own. Cells the caller does
     not name are stamped `own`: the composer deals for the basis genre unless
     it says otherwise, which is §3's own default. */
  function stampProv(doc, who) {
    const cells = (doc.material && doc.material.cells) || {};
    const M = {};
    for (const n of Object.keys(cells)) {
      const e = (who && who[n]) || PROV_OWN;
      M[n] = { p: e.p, ...(e.g ? { g: e.g } : {}), fp: fingerprint(cells[n]) };
    }
    doc.material.prov = M;
    return doc;
  }
  /* THE HAND'S OWN DOOR, for a writer that KNOWS it is a hand — a rename, a
     paste, an op applied from the tray. The fingerprint derivation above
     catches an edit whether or not anybody calls this; this is for the case
     where the bytes happen not to move (a hand that rewrites a cell to what it
     already was still owns it) and for the table's "make this mine". A record
     with no prov map is left alone: it is already all own, and giving it a map
     would make every OTHER cell in it read as the hand's. */
  function handWrote(doc, name) {
    const M = provMap(doc);
    if (!M || !name) return false;
    M[name] = { p: "hand" };
    return true;
  }

  function normalize(doc) {
    if (doc && doc.basis && OLDKEYS[doc.basis]) doc.basis = OLDKEYS[doc.basis];
    /* ---- THE SENTENCES THIS READING WAS COMPOSED WITH (2026-09-01) --------
       Paul: "You can edit them, add new rules from a palette, and set
       thresholds." `doc.rules` is the list of those edits — `[{f, v}]`,
       `precompose.genreToDocument`'s third input — and it has to SURVIVE this
       door or a saved session and a share link would reopen as the anchor as
       written while claiming to be the record somebody built.

       ONE OWNER FOR WHAT A RULE MAY BE: `song.js validateRules`, beside every
       other shape this page refuses at the door. Absent stays absent — a
       record composed straight off its anchor states nothing, which is the
       only spelling of that default — and a list that validates to nothing
       deletes itself rather than sitting there as an empty array meaning the
       same thing twice. */
    if (doc && "rules" in doc) {
      const v = NuSong.validateRules(doc.rules);
      if (v.rules) doc.rules = v.rules; else delete doc.rules;
    }
    const ids = doc.form.sections.map((s2) => s2.id);
    /* ---- THE ROW'S OWN WORDS, AT THE DOOR (TABLE.md wave 2a) -------------
       The same paranoid half song.js applies to every enum, applied at last
       to the section: "an unknown level means the file is from a build this
       one cannot honestly play". Until 2026-09-04 nothing checked a section
       field at all, because nothing WROTE one — the projection dropped every
       word the composer dealt and a hand had no control. Both halves changed
       in the same round, so the door lands with them.

       ONE OWNER FOR EACH VOCABULARY, and it is the registry the BOX already
       validates against (`song.js validateSong` walks the same FIELDS rows for
       the same words), so the row and the box can never mean different things
       by `hush`. `swing` and `groove` are the two the box has no field for —
       they are song facts there — and their tables are the ones ui/state.js
       `setSwing`/`setGroove` normalize against, which is the same answer read
       from the other end.

       DROP, NEVER ERROR: a word this build does not know is an obsolete chip
       (song.js's FILTER rule), and the row falls back to the record's, which
       is a record that still plays. MEASURED over 479 anchors x seeds 1-3:
       not one composed word is dropped here. */
    const ROWTABLE = (f) => {
      if (f === "swing") return NF.SWINGLABEL;
      if (f === "groove") return NF.GROOVELABEL;
      if (f === "prog") return NF.PROGCHOICES;
      const row = NF.FIELDS.find((x) => x.key === f);
      return (row && row.table) || null;
    };
    /* ---- THE FORM GRAMMAR AT THE DOOR (2026-09-05, the review's item 9).
       Four words, and each one is refused where it would be a claim about a
       form this build cannot play honestly — the same FILTER rule the enums
       below keep, said for a structure instead of a vocabulary:
         · `repeat` is a whole count 2..8. One is not a repeat and is dropped
           back to absent, so "plays once" keeps ONE spelling.
         · `ending` needs a section above it to be the ending OF, and that
           section has to repeat — a second ending under no repeat is a bar
           nothing ever plays instead of.
         · `coda` is the LAST section. A coda in the middle of the form is a
           sign pointing at music the walk would play in place anyway, and the
           walk's promise ("played once, after the form's last repeat") would
           be false.
         · `tocoda` needs a coda after it to jump to. */
    {
      const S = doc.form.sections, last = S.length - 1;
      const codaIx = S.findIndex((x) => x && x.coda);
      S.forEach((s2, i) => {
        if (s2.repeat != null &&
            !(Number.isInteger(s2.repeat) && s2.repeat >= 2 && s2.repeat <= REPEAT_MAX))
          delete s2.repeat;
        if (s2.coda != null && (s2.coda !== true || i !== last)) delete s2.coda;
        if (s2.ending != null &&
            (s2.ending !== true || i === 0 || repOf(S[i - 1]) < 2)) delete s2.ending;
        if (s2.tocoda != null &&
            (s2.tocoda !== true || codaIx < 0 || codaIx <= i)) delete s2.tocoda;
      });
    }
    for (const s2 of doc.form.sections) {
      for (const f of Object.keys(s2)) {
        if (!ROWWRITE(f) || f === "nudge") continue;   // nudge is a count, not a word
        // the four form words are counts and flags, not vocabularies: they are
        // judged in the block above and the word table has no opinion on them
        if (f === "repeat" || f === "ending" || f === "coda" || f === "tocoda") continue;
        /* A DRAWN LANE IS A SHAPE, NOT A WORD (2026-09-05, item 10) — the
           same paranoia `prog`'s array takes two blocks down: a list of
           `{param, points}` whose param this build knows and whose points are
           finite pairs, or the whole field goes. A lane with fewer than two
           points is a number with extra syntax and is dropped. */
        if (f === "auto") {
          const okPts = (a) => a && typeof a === "object" && !Array.isArray(a) &&
            Object.prototype.hasOwnProperty.call(NF.AUTOPARAMS, a.param) &&
            Array.isArray(a.points) && a.points.length >= 2 &&
            a.points.every((p) => Array.isArray(p) && p.length === 2 &&
                                  p.every(Number.isFinite));
          const keep = (Array.isArray(s2.auto) ? s2.auto : []).filter(okPts)
            .map((a) => ({ param: a.param, points: a.points.map((p) => [+p[0], +p[1]]),
                           ...(a.curve === "exp" ? { curve: "exp" } : {}),
                           ...(a.in === "bars" ? { in: "bars" } : {}) }));
          if (keep.length) s2.auto = keep; else delete s2.auto;
          continue;
        }
        if (f === "fx") {
          const keep = (Array.isArray(s2.fx) ? s2.fx : [])
            .filter((k) => Object.prototype.hasOwnProperty.call(NF.FX, k))
            .slice(0, NF.MAX_FX);
          if (keep.length) s2.fx = keep; else delete s2.fx;
          continue;
        }
        // ...AND THE ROW'S `prog` VOCABULARY IS PROGCHOICES MINUS ONE WORD.
        // The box's chip offers `off` — "strip the progression back to the
        // degenerate triads" (ui/derive.js genreOf) — and the row cannot say
        // it, because the row's `prog` is resolved to a CHORD ARRAY so that
        // both tiers answer in the same units, and there is no array that
        // spells "no array". A row that wants no progression is a record
        // that wants none; the word stays a box control and is dropped here
        // rather than kept as a value the resolver would read as silence.
        if (f === "prog" && s2.prog === "off") { delete s2.prog; continue; }
        /* ...AND A ROW'S OWN CHART IS NOT A WORD (2026-09-05), so the word
           table has no opinion about it. What IS checked is the shape: a list
           of chord objects, one to eight-and-twenty bars, each bar an object
           or a list of them — anything else is a file this build cannot
           honestly play and is dropped back to the record's changes, which is
           the FILTER rule this loop already applies to every enum. */
        if (f === "prog" && Array.isArray(s2.prog)) {
          const chord = (c) => c && typeof c === "object" && !Array.isArray(c);
          const okBar = (b) => (Array.isArray(b) ? b.length && b.every(chord)
                                                 : chord(b));
          if (!s2.prog.length || !s2.prog.every(okBar)) delete s2.prog;
          continue;
        }
        const t = ROWTABLE(f);
        if (t && !Object.prototype.hasOwnProperty.call(t, String(s2[f])))
          delete s2[f];
      }
      if (s2.nudge != null && !Number.isFinite(s2.nudge)) delete s2.nudge;
    }
    /* ---- THE RETIRED RECORD-WIDE CHIP, RESOLVED ON READ (2026-08-27) -------
       Paul: *"We can get rid of Character right? We don't really use it any
       more do we?"* — and FUTURE.md §5 had ruled the same way already:
       `sound.fx` gone, the chip "dealt, not embedded". `nukernel/
       precompose.js deskThe` writes it on the CHAIR now and this key is not
       written anywhere any more; what is left is every record ALREADY SAVED
       with one — a session in localStorage, a keep, a share link — and a
       retired key that still reached the sound with no control on the page
       would be exactly the hidden fact this box legislates against.

       SO IT IS FOLDED HERE, AT THE DOOR, ONCE. The chips go onto every voice's
       own `desk.fx`, APPENDED after whatever that voice already carries,
       because that is the order audio/desk.js built the chain in
       (`[...p.fxc, ...fxChain([...S.fx, ...o.fx])]` — the part's slots first,
       the record's chip after), and then the key is deleted, so the fold
       cannot happen twice and `deskIsDefault` answers about one owner.
       Capped at fields.js MAX_FX, the same cap both ends already keep.

       ABSENT IS TODAY: a document with no `sound.fx` — which is every record
       this build writes and every record songs.js ships — takes no branch and
       comes out byte-identical. */
    const legacy = doc.sound && Array.isArray(doc.sound.fx) ? doc.sound.fx : null;
    if (legacy) {
      const keep = legacy.filter((k) =>
        Object.prototype.hasOwnProperty.call(NF.FX, k));
      for (const v of doc.voices) {
        const had = (v.desk && Array.isArray(v.desk.fx)) ? v.desk.fx : [];
        const next = [...had, ...keep].slice(0, NF.MAX_FX);
        if (next.length) { v.desk = v.desk || {}; v.desk.fx = next; }
      }
      delete doc.sound.fx;
    }
    for (const v of doc.voices) {
      /* ---- AND THE CHAIR'S OWN THROAT, AT THE DOOR (2026-09-04) ----------
         The same paranoid half every enum in this tree gets: "an unknown level
         means the file is from a build this one cannot honestly play". A
         `cast.voice` this build has no formant table for would be a singer
         nobody can be — `voiceForInstr` would fall back to the patch's tenor
         and the score would have been written for a throat that never sang —
         so it is DROPPED and the chair falls back to its row's mouth, which is
         a record that still plays. `fields.js THROATS` is the one owner of the
         five words and it is the EXTRACTION of the engine's own table, so this
         door and the bridge can never disagree about what a throat is.
         Absent stays absent: a chair with no word writes no key. */
      if (v.cast && v.cast.voice != null && !NF.isThroat(v.cast.voice))
        delete v.cast.voice;
      /* ...AND THE COLUMN DEFAULT IS THE SAME FACT WITH THE SAME SHAPE
         (2026-09-05). `cast.entry` had no validator here at all — the cell
         tier was checked and the column it inherits from was not — so a saved
         record could carry a negative or a NaN entry into `g.entry(v)`. It
         takes the cell's own law: a non-negative number on the bar's grid, an
         integer untouched, anything else dropped back to the genre's. */
      if (v.cast && v.cast.entry != null) {
        if (!entryOK(v.cast.entry)) delete v.cast.entry;
        else v.cast.entry = entrySnap(v.cast.entry, cellStepsOf(doc));
      }
      const dflt = v.kind === "line" ? "as written" : "";
      v.development = v.development || {};
      for (const id of ids) if (v.development[id] == null) v.development[id] = dflt;
      for (const id of Object.keys(v.development))
        if (!ids.includes(id)) delete v.development[id];
      if (v.material && typeof v.material === "string" &&
          !doc.material.cells[v.material])
        v.material = cellNames(doc)[0];
      // THE GRID'S WORDS FOLLOW development's OWN LAW (2026-08-27, the
      // one-board round — Paul: "some voices raise and some fall"): keyed by
      // section id so reordering sections cannot shift a trim under a voice,
      // pruned when the id dies, and the VALUE must be a fields.js TRIMS key —
      // the paranoid half song.js applies to every enum ("an unknown level
      // means the file is from a build this one cannot honestly play"), so a
      // word from a build with a different vocabulary is dropped rather than
      // carried as a lie the desk would silently ignore. Absent is today: a
      // voice with no trims writes nothing, an emptied map deletes itself, and
      // an emptied desk deletes itself — one spelling of the default, the
      // desk-doc.js writeDesk law.
      /* ---- THE CELL OVERRIDES FOLLOW development's OWN LAW (TABLE.md §2).
         Keyed by section id so reordering sections cannot shift an override
         under a voice, pruned when the id dies, and the VALUE checked against
         the field's own shape — the paranoid half song.js applies to every
         enum, because a register from a build with a different range is a lie
         the kernel would play. `entry` is bars and cannot be negative;
         `reg` is the chair's own -4..3 (precompose regAt's clamp, the one
         owner of that range); `focus` is a flag. Absent is today: a voice with
         no overrides writes nothing, an emptied cell deletes itself and an
         emptied map deletes itself, so "inherited" keeps ONE spelling. */
      if (v.cells != null) {
        if (typeof v.cells !== "object" || Array.isArray(v.cells)) delete v.cells;
        else {
          for (const id of Object.keys(v.cells)) {
            const c = v.cells[id];
            if (!ids.includes(id) || !c || typeof c !== "object" || Array.isArray(c)) {
              delete v.cells[id]; continue;
            }
            for (const f of Object.keys(c)) {
              /* `mixauto` is the one cell field with a STRUCTURE, so it is
                 filtered rather than tested (wave 3): fields.js
                 `cellAutoClean` keeps the words this build can play and drops
                 the rest, and a map with nothing left deletes itself — the
                 same law `desk.trim` two blocks down already keeps. */
              if (f === "mixauto") {
                const clean = NF.cellAutoClean(c[f]);
                if (clean) c[f] = clean; else delete c[f];
                continue;
              }
              /* ...AND THE FIVE §1 MOVED HERE IN WAVE 4 are filtered against
                 their own tables by the same one reader `putCell` uses: a word
                 this build cannot play, a neutral word, or a number where a key
                 belongs is dropped rather than carried as a lie the kernel
                 would play (a `scale` this catalogue does not hold would seat
                 the chair on PENT and nothing would say so). */
              if (NF.CELLVECBY && NF.CELLVECBY[f]) {
                const w = NF.cellVecClean(f, c[f]);
                if (w == null) delete c[f]; else c[f] = w;
                continue;
              }
              /* AN ENTRY IS SNAPPED TO THE BAR'S OWN STEP BEFORE IT IS
                 JUDGED (2026-09-05, the review's item 4). It used to be
                 `Number.isInteger`, which is what made a pickup and a stretto
                 unsayable; it is now any non-negative number on the meter's
                 grid, and one off the grid is moved onto the nearest step
                 rather than deleted. An integer is its own snap, so this is a
                 no-op on every record written before today. */
              if (f === "entry" && entryOK(c[f])) {
                const snapped = entrySnap(c[f], cellStepsOf(doc));
                if (snapped !== c[f]) c[f] = snapped;
              }
              const bad = !CELLWRITE(f) ||
                (f === "entry" && !entryOK(c[f])) ||
                (f === "reg" && !(Number.isInteger(c[f]) && c[f] >= -4 && c[f] <= 3)) ||
                (f === "focus" && typeof c[f] !== "boolean");
              if (bad) delete c[f];
            }
            if (!Object.keys(c).length) delete v.cells[id];
          }
          if (!Object.keys(v.cells).length) delete v.cells;
        }
      }
      if (v.desk && v.desk.trim != null) {
        const t = v.desk.trim;
        if (typeof t !== "object" || Array.isArray(t)) delete v.desk.trim;
        else {
          for (const id of Object.keys(t))
            if (!ids.includes(id) ||
                !Object.prototype.hasOwnProperty.call(NF.TRIMS, String(t[id])))
              delete t[id];
          if (!Object.keys(t).length) delete v.desk.trim;
        }
        if (v.desk && !Object.keys(v.desk).length) delete v.desk;
      }
    }
    /* ---- AND THE PROVENANCE MAP IS PRUNED TO THE BANK (§3). A motif is a
       fact about a cell that exists; an entry for a cell somebody cleared is a
       claim about nothing. The other direction is NOT filled in — a cell in
       the bank with no entry is the hand's by measurement (provOf), which is
       the whole reason the map is allowed to be short. Absent stays absent, so
       normalize is still a byte-identical no-op on the shipped chant (G7). */
    if (doc.material && doc.material.prov) {
      const M = doc.material.prov, bank = doc.material.cells || {};
      if (typeof M !== "object" || Array.isArray(M)) delete doc.material.prov;
      else {
        for (const n of Object.keys(M)) {
          const e = M[n];
          if (!Object.prototype.hasOwnProperty.call(bank, n) ||
              !e || typeof e !== "object" || !PROVKINDS[e.p] ||
              (e.p === "guest" && !e.g)) delete M[n];
        }
        if (!Object.keys(M).length) delete doc.material.prov;
      }
    }
    return doc;
  }

  /* ---------- THE WHOLE RECORD, AS EVENTS ---------------------------------
     genres + phrases + boxes -> the event list, via NuKernel and nothing else.
     This is the pure half of what the page does through ui/state.js and
     ui/derive.js `sectionEvents`, and it is deliberately the SMALL half: no
     layers, no nudge, no lead-ins, no tempo warp, no swing override, because a
     document has one stack per box and states none of those. What it does copy
     exactly is derive.js's two load-bearing decisions — the bar is measured off
     the GENRE (`stepsIn(g) / g.rate`, derive.js:405, "never off the phrase, a
     32-step phrase spanning two 16-step bars is deliberate") and the drums and
     bass follow the FIRST phrase (derive.js:432, "the bass reads accents, which
     only one line can own").

     Times are in STEP UNITS from the top of the record, the same units the
     kernel emits, so a caller multiplies by seconds-per-step once. THEY STAY
     ABSOLUTE when a window is asked for (below), so the union of every
     section's window is the whole record's event list and nothing has to be
     re-based to compare the two.

     THE WINDOW (2026-09-05, TABLE.md §12c's first leftover: *"`document.js
     scoreOf` does not window a section, so a multi-bar cell's events run past
     the section's own end"*). Two things were missing and they are one thing:

       · A STATEMENT'S EVENTS STOP AT ITS OWN LAST BAR. `keep` used to cut only
         when a second ending cut the statement short (`!w.cut || …`), so with
         no `ending` in the record nothing was cut at all — and the kit is
         rendered over the GENRE's loop (`K.drums(lead, g, g.bars)`) while the
         section may be shorter than it, so a 2-bar section of an 8-bar genre
         put six bars of drums into the bars belonging to the sections after
         it. Measured on `reggae` seed 1 before this line: 2364 of 4915 events
         (48%) sounded past the end of the section that emitted them, every
         section of the thirteen. `ui/derive.js sectionEvents` has always cut
         at the same place (`evAll.filter(e => e.t >= from && e.t < to)`) — the
         page windows, this did not, and that is the whole of the difference.
       · AND A CALLER MAY ASK FOR ONE SECTION. `win` is `{ from, to }` in
         PLAYED bars (`to` exclusive), or `{ section: <index | id> }`, or the
         bare index/id; absent is the whole record, which is what every caller
         that has ever called this gets, to the event. A window renders only
         the statements it touches, so asking for one section of a
         thirteen-section record does a thirteenth of the kernel work.

     Returns `{ bars, events, from, to, t0 }`: `bars` is the window's own bar
     count (the whole record's, by default, exactly as before), `from`/`to` are
     its bounds in played bars and `t0` is where it starts in steps, for a
     caller that wants to re-base. */
  function scoreOf(doc, GENRES, fleet, win = null) {
    const secs = doc.form.sections, lines = LINES(doc), out = [];
    /* THE FORM IS WALKED, NOT THE SECTION LIST (2026-09-05, the review's item
       9). `formWalk` says what the record PLAYS — how many times each section
       is stated, how many bars come off the last statement for a second
       ending, which sections the coda jump goes over. A record that says none
       of it walks `plays: 1, cut: 0, skip: false` on every section, which is
       `secs.forEach` to the bit and is every record in the catalogue. */
    /* PASS ONE — WHERE EVERY STATEMENT LANDS, and nothing else. The bar
       arithmetic needs the genre (a section with no `bars` of its own takes
       the genre's), so the genre is resolved here and handed to pass two
       rather than resolved twice; the KERNEL work — render, drums, bass — is
       what pass two does and what a window skips.

       THE OFFSET IS A TIME, NOT A BAR COUNT (TABLE.md wave 4, 2026-09-04).
       This read `t0 = bar * barSteps` with THIS section's `barSteps` — which is
       exact for as long as every section counts its bar the same way, and that
       was true while `rate` was the RECORD's alone. A row may halve or double
       its own section now, so the sections after it would have been placed with
       the wrong bar length. Accumulating the time each section actually takes
       is the same number for a record whose rows say nothing (uniform
       `barSteps` makes the sum `bar * barSteps` again, to the bit) and the
       right one for a record whose rows do. */
    const plan = [];
    let bar = 0, t0 = 0;
    for (const w of formWalk(doc)) {
      if (w.skip) continue;
      const i = w.si, s2 = secs[i];
      const g = toGenre(doc, i, GENRES, fleet);
      const barSteps = stepsIn(g) / g.rate;
      const total = Math.max(1, s2.bars || g.bars);
      const stmts = [];
      for (let r = 0, n = Math.max(1, w.plays | 0); r < n; r++) {
        // the LAST statement stops short by the second ending's own length;
        // every other one plays the section whole
        const played = (r === n - 1) ? Math.max(1, total - (w.cut | 0)) : total;
        stmts.push({ bar0: bar, played, t0 });
        bar += played; t0 += played * barSteps;
      }
      plan.push({ si: i, id: s2.id, g, barSteps, total,
                  bar0: stmts[0].bar0, bar1: bar, t0: stmts[0].t0, stmts });
    }
    /* THE WINDOW, RESOLVED AGAINST THE WALK'S OWN NUMBERS — never against
       `secs[i].bars`, because a repeated section is several statements and a
       skipped one is none, and a caller naming a section means the bars the
       record actually plays it in. A section the form skips, or a name no row
       answers to, is an EMPTY window rather than a throw: the caller asked for
       bars that are not played, and none is the honest answer. */
    const W = (() => {
      if (win == null) return { from: 0, to: bar };
      const q = (typeof win === "object") ? win : { section: win };
      if (q.section != null) {
        const p = plan.find((p2) => p2.si === q.section || p2.id === q.section);
        return p ? { from: p.bar0, to: p.bar1 } : { from: 0, to: 0 };
      }
      const from = Math.max(0, Math.min(bar, Math.floor(q.from == null ? 0 : q.from)));
      const to = Math.max(from, Math.min(bar, Math.ceil(q.to == null ? bar : q.to)));
      return { from, to };
    })();
    /* PASS TWO — the music, for the statements the window touches. */
    for (const p of plan) {
      if (p.bar1 <= W.from || p.bar0 >= W.to) continue;
      const i = p.si, g = p.g, barSteps = p.barSteps, total = p.total;
      const phrases = lines.map((c) => toPhrase(doc, materialAt(c, SECID(doc, i))));
      const nP = phrases.length;
      const lead = phrases[0] || NuSong.blank();
      const dr = K.drums(lead, g, g.bars), loopSteps = g.bars * barSteps;
      const bassEv = K.bass(lead, g, total);
      const lineEv = [];
      phrases.forEach((ph, pi) => {
        const evs = K.render(ph, g, total);
        for (let v = pi; v < g.voices; v += nP)
          for (const e of evs) if (e.v === v)
            lineEv.push({ ...e, kind: "line", lv: v, sec: i });
      });
      for (const st of p.stmts) {
        if (st.bar0 + st.played <= W.from || st.bar0 >= W.to) continue;
        // A STEP TIME, AS A BAR OF THE RECORD: the statement's own bar plus how
        // far into it the event falls. One predicate then says both things —
        // the statement ends at its own last bar (the fix) and the window ends
        // where it was asked to.
        const keep = (t) => {
          const b = st.bar0 + t / barSteps;
          return t < st.played * barSteps && b >= W.from && b < W.to;
        };
        for (const e of lineEv) if (keep(e.t)) out.push({ ...e, t: e.t + st.t0 });
        // Drums and bass follow the FIRST phrase — the kit is genre data
        // anyway, and the bass reads accents, which only one line can own.
        for (let k = 0; k < Math.ceil(total / g.bars); k++)
          for (const e of dr) {
            const t = e.t + k * loopSteps;
            if (keep(t)) out.push({ ...e, kind: "hit", t: t + st.t0, sec: i });
          }
        for (const e of bassEv) if (keep(e.t))
          out.push({ ...e, kind: "bass", t: e.t + st.t0, sec: i });
      }
    }
    out.sort((a, b) => a.t - b.t);
    /* WHERE THE WINDOW STARTS IN STEPS, for a caller that wants to re-base.
       It is the first statement the window touches, offset by the bars of it
       the window leaves out — the same arithmetic `keep` does, said once. */
    const head = plan.find((p) => p.bar1 > W.from && p.bar0 < W.to);
    const wt0 = head ? head.t0 + (W.from - head.bar0) * head.barSteps : 0;
    return { bars: W.to - W.from, events: out,
             from: W.from, to: W.to, t0: wt0 };
  }

  return { toGenre, toPhrase, materialAt, barsOf, boxesOf, normalize, scoreOf,
           /* THE FORM WALK (2026-09-05, item 9): what the record PLAYS —
              repeats, the second ending's cut, the coda and the jump. One
              owner; the score, the walk and the gates all ask it. */
           formWalk, REPEAT_MAX,
           /* ---- THE TABLE (TABLE.md wave 1) ---------------------------
              `TIERS` is §1 as data — the gate reads the claim rather than
              restating it — and `resolve` is §2's ONE owner: every reader
              that used to reach into `cast.entry`/`cast.reg` for a voice in a
              section asks here, so a cell override reaches the sound by
              construction. `LINEIX` is exported with them because a caller
              holding a KERNEL voice index needs the column index to ask. */
           TIERS, addressOf, resolve, resolveFrom, resolveRow, vectorOf,
           putCell, putRow, cellVec,
           CELLFIELD, TIERORDER, LINES, LINEIX,
           // ...and §3, a motif's provenance: own · guest:<genre> · hand.
           provOf, provWord, stampProv, handWrote, fingerprint,
           // THE ONE RENAME DOOR (2026-09-02, slice 2c) — see its own block.
           renameCell,
           // THE RENAME'S ALIAS MAP, EXPORTED (2026-09-01): song.js migrate()
           // folds saved catalog keys through the same one map at ITS door —
           // two doors, one owner. See the OLDKEYS block above for the law.
           // ...AND THE REUSED-KEY MAP BESIDE IT (2026-09-04), which ONLY the
           // save door may read, and only for a save older than song.js
           // VERSION 3 — the MOVEDKEYS block above says why normalize() must
           // not touch it.
           OLDKEYS, MOVEDKEYS };
});
