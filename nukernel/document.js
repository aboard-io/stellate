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
  const { METERS, stepsIn } = K;
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

  /* ---------- HOW MANY BARS A CELL IS (§2.1's invariant) -------------------
     The kernel reads a phrase's own length AS the bar (`kernel.js:1379`), and
     the meter says how many steps a bar has (`kernel.js:356 stepsIn`). So a
     32-step cell in four is two bars, and `sections[].bars` counts CELL bars.
     THE INVARIANT is that every line cell in one document is the same length:
     two lengths give two voices different bar arithmetic against one `total`
     (`ui/derive.js:420`), which is the failure mode and the reason it is a law.
     This function does NOT enforce it — a half-edited document must not make
     the page throw mid-keystroke — it takes the longest line cell so the bar
     count is never short. `test/precompose.test.js` is where the invariant is
     asserted, per design 05 §8 step 3. */
  function barsOf(doc) {
    const cells = doc.material.cells, names = cellNames(doc);
    let n = 0;
    for (const name of names) {
      const c = cells[name];
      if (!c || c.kind === "drum" || !c.deg) continue;
      if (c.deg.length > n) n = c.deg.length;
    }
    if (!n) return 1;
    const steps = stepsIn({ meter: METERS[(doc.time || {}).meter] });
    return Math.max(1, Math.round(n / steps));
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
  const opsOf = (name) => (WORDS[name] || []).map(
    (w) => (typeof w === "string" ? K.OPKEYS[w] : K[w[0]](...w.slice(1))));
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
  function toGenre(doc, si, GENRES, fleet) {
    const A = doc.alphabet, T = doc.time, P = doc.performance;
    const NATIVE = fleet || [];
    const mode = MODES[A.mode] || MODES.aeolian;
    const lines = LINES(doc), drums = DRUMV(doc), bass = BASSV(doc);
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
      ...GENRES[doc.basis],
      label: (GENRES[doc.basis] || {}).label || doc.basis,
      /* TIME */        bpm: T.bpm, swing: T.swing == null ? 0 : SWINGS[T.swing],
                        ...(T.rate ? { rate: T.rate } : {}),
                        ...(T.meter && METERS[T.meter] ? { meter: METERS[T.meter] } : {}),
      // THE SUBJECT'S ALPHABET IS ITS OWN. This said `scale: mode`, which meant
      // a document could not be pentatonic, blues, whole-tone or quartal — 99
      // of the 122 anchors declare a `scale` and every one of them was being
      // overwritten with the chord alphabet. Absent still means the mode, so
      // the shipped chant is byte-identical (it states no scale).
      /* ALPHABET */    key: KEYS[A.key] || 0, mode,
                        scale: (A.scale && (SCALES[A.scale] || MODES[A.scale])) || mode,
                        diatonic: !!A.diatonic, harmony: A.harmony,
                        prog: A.prog, roots: A.prog.map((c) => c.d),
      /* MATERIAL */    kit, ...(on ? {} : noKit),
      /* CAST */        voices: lines.length,
                        entry: (v) => lines[v].cast.entry,
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
                        reg: (v) => lines[v].cast.reg - K.partLean(lines[v].cast.part),
                        realize: (v) => lines[v].cast.part,
                        bassStyle: bass ? bass.cast.style : undefined,
                        nobass: !bass,
      /* DEVELOPMENT */ word: (v) => opsOf(wordAt(doc, lines[v], si)),
      /* SOUND */       ...(synth ? { synth } : {}),
                        instr: lines.map((c) => c.instrument === "synth"
                          ? ((GENRES[doc.basis] || {}).instr || ["polysynth"])[0]
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
                        chairs: lines.map((c) => {
                          const nat = nativeOf(c, NATIVE);
                          if (nat && doc.sound && doc.sound.level != null)
                            nat.level = +Math.min(1, nat.level * doc.sound.level).toFixed(3);
                          return { ...(nat ? { synth: nat }
                                     : c.instrument === "synth" ? {} : { instr: c.instrument }),
                                   ...(c.sound && Object.keys(c.sound).length
                                     ? { vox: c.sound } : {}) };
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
                             (GENRES[doc.basis] || {}).tone)
                          // clamped at 1: the engine caps a tone's gain there,
                          // so level 3 and level 4 measured the same RMS to the
                          // millivolt and the slider was lying above the cap
                          ? { tone: { ...GENRES[doc.basis].tone,
                              ...(doc.sound.level != null ? {
                                gain: +Math.min(1, GENRES[doc.basis].tone.gain *
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
                        ...takeOf(P.take, si, GENRES[doc.basis]),
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
    const met = METERS[((doc.time || {}).meter)] || null;
    return { deg: H.deg.slice(), oct: z(), vel: (H.vel || z()).slice(),
             inc: z(), stk: z(), gate, acc: (H.acc || z()).slice(), sld: z(),
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
    return secs.map((s2, i) => ({ ...NuSong.emptyBox(),
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
      intro: s2.intro || null, env: s2.env || null, outro: s2.outro || null,
      mot: s2.mot || null, lvl: s2.lvl || null, breath: s2.breath || null,
      pipe: s2.pipe || null, period: s2.period || null,
      // ...AND ITS PACE (2026-08-30, the per-section-pace round): the section
      // word that multiplies the record's one bpm under this section alone —
      // compose deals it (dealPaces), audio/plan.js PACE_RATE is what a word
      // is worth at the clock, the same words/numbers split lvl/LEVELS made.
      // `|| null` like every key above it: a record that says nothing writes
      // nothing.
      pace: s2.pace || null,
      nudge: s2.nudge | 0 }));
  }

  // EVERY VOICE HAS A WORD FOR EVERY SECTION, and the words are keyed by the
  // section's ID — so adding, removing or reordering sections cannot shift a
  // voice's part under it. Filled once, before anything draws.
  //
  // The page's copy also reset `cellSel`, the cell the hook maker is editing.
  // That is a VIEW fact — which cell has the cursor in it is not something the
  // record says — so it stayed in ui/eight.js and this function only touches
  // the document. Mutates in place and returns it, the way the page's did.
  function normalize(doc) {
    const ids = doc.form.sections.map((s2) => s2.id);
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
     kernel emits, so a caller multiplies by seconds-per-step once. */
  function scoreOf(doc, GENRES, fleet) {
    const secs = doc.form.sections, lines = LINES(doc), out = [];
    let bar = 0;
    secs.forEach((s2, i) => {
      const g = toGenre(doc, i, GENRES, fleet);
      const barSteps = stepsIn(g) / g.rate;
      const total = Math.max(1, s2.bars || g.bars);
      const t0 = bar * barSteps;
      const phrases = lines.map((c) => toPhrase(doc, materialAt(c, SECID(doc, i))));
      const nP = phrases.length;
      phrases.forEach((ph, pi) => {
        const evs = K.render(ph, g, total);
        for (let v = pi; v < g.voices; v += nP)
          for (const e of evs) if (e.v === v)
            out.push({ ...e, t: e.t + t0, kind: "line", lv: v, sec: i });
      });
      // Drums and bass follow the FIRST phrase — the kit is genre data anyway,
      // and the bass reads accents, which only one line can own.
      const lead = phrases[0] || NuSong.blank();
      const dr = K.drums(lead, g, g.bars), loopSteps = g.bars * barSteps;
      for (let r = 0; r < Math.ceil(total / g.bars); r++)
        for (const e of dr)
          out.push({ ...e, kind: "hit", t: e.t + r * loopSteps + t0, sec: i });
      for (const e of K.bass(lead, g, total))
        out.push({ ...e, kind: "bass", t: e.t + t0, sec: i });
      bar += total;
    });
    out.sort((a, b) => a.t - b.t);
    return { bars: bar, events: out };
  }

  return { toGenre, toPhrase, materialAt, barsOf, boxesOf, normalize, scoreOf };
});
