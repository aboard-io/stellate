// nukernel/avail.js — WHAT CAN BE SAID HERE, AND WHAT SAYING IT WOULD DO.
//
// (Paul, 2026-08-24: "the options for each instrument in a song section are now
// just one thing in a dropdown. That's not effective. sheets of organized
// options should light up. when an option makes another one unaccessible gray
// it out.")
//
// The page had no concept of an unavailable option. It offered `at the fifth`
// to a pad — measured: the transposition changes not one event, because
// kernel.js:1388 voices the sounding chord and never reads `deg` — and it
// offered a chord-quality menu on a modal record, where kernel.js:671
// (`if (!g.prog || g.harmony !== "cycle")`) throws the whole progression away.
// Nine words, nine taps, and three of them do nothing.
//
// THE CHANGE OF LAW THIS FILE MAKES. The parent's answer to unavailability was
// the PRUNER (`band-kit.js:4042 asked`), which DELETES the option. We grey it.
// Hiding destroys the shape of the possible, which is the thing a composer is
// reading a sheet for. One exception survives verbatim from the parent and it
// is load-bearing — `band-kit.js:3956`, "THE STANDING ANSWER IS ALWAYS OFFERED
// — you can always see the word you are on": `optionsFor` clears `disabled`
// when the option IS the current value, or a document loaded from JSON is
// un-editable at exactly the moment it matters.
//
// THREE TIERS, AND ONLY ONE OF THEM IS HAND-WRITTEN.
//   SHEETS   what can be said (this file) — one row per sheet key, whose
//            `values` and `set` are the SAME rows the page draws and the
//            extractor measures. There is no second list of options anywhere.
//   gates.js what saying it does (GENERATED, `gates-extract.js`) — never typed.
//            A dependency somebody types is a dependency that drifts the first
//            time a kernel operator changes; this one is measured.
//   WHY      English for ~20 FACTS, not for dependencies. Naming a fact is
//            prose; naming which fact blocks which word is the thing that must
//            be measured, and it is not in this file.
//
// UMD, no DOM, no state, no audio — the same shape askable.js and chair.js
// take, so node requires it and the page loads it as a classic <script>. Every
// caller passes its own `env`; nothing here reads a global of its own. (`fleet`
// is in `env` for the reason document.js states about itself: audio/to-engine's
// SYNTH table is the only thing that knows which instruments are modelled Faust
// voices, it is an ES module, and a UMD file that requires it stops being
// node-requirable. The page hands it `SYNTH_NAMES()`; a caller that says
// nothing means the empty fleet, which is honest.)
(function (root, factory) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const api = factory(
    isNode ? require("./kernel.js")   : root.NuKernel,
    isNode ? require("./genres.js")   : root.NuGenres,
    isNode ? require("./fields.js")   : root.NuFields,
    isNode ? require("./songs.js")    : root.NuSongs,
    isNode ? require("./instruments.js") : root.NuInstruments,
    isNode ? require("./document.js") : root.NuDocument);
  if (isNode) module.exports = api;
  else root.NuAvail = api;
})(typeof self !== "undefined" ? self : this, function (K, NG, NF, NuSongs, NI, ND) {
  "use strict";

  // SCALES/SCALELABEL joined this line 2026-09-02 with the `alphabet.scale`
  // sheet below — the subject's alphabet, which the document has always carried
  const { GENRES, MODES, MODELABEL, SCALES, SCALELABEL } = NG;
  const { KEYS, KEYLABEL, METERLABEL, RATES, RATELABEL, SWINGLABEL, GROOVELABEL,
          ROLES, BASSOPS, KITLABEL, DRUMKITS, INSTRCHOICES,
          // BASSCHOICES joined this line 2026-09-02 with `sound.bassinstrument`
          // below — the narrower list the bass chair may be handed.
          BASSCHOICES } = NF;
  const { WORDS, WORDGROUP } = NuSongs;
  const J = (v) => { try { return JSON.stringify(v === undefined ? null : v); }
                     catch (e) { return "?"; } };

  /* ====================================================================
     THE RULE LANGUAGE — MOVED HERE FROM vocabulary.js:844, VERBATIM.
     Four forms, fifteen lines, no eval. It already describes 115 questions
     and 943 options in vocabulary.json, so it suffices for sixteen sheets.
     It lives here rather than there because vocabulary.js is a TOOL (node
     only, in no script tag) and this file is loaded by the page: the page
     has to evaluate rules at draw time. vocabulary.js now requires it from
     here and keeps no copy — one owner for the rule language, or the two
     drift the first time a fifth form is needed.
     ==================================================================== */
  function evalRule(ex, f) {
    if (!ex) return null;
    if (ex.rule === "always") return true;
    if (ex.rule === "never") return false;
    if (ex.rule === "when") {
      if (ex.is) return !!f[ex.is];
      if (ex.not) return !f[ex.not];
      if (ex.eq) return J(f[ex.eq]) === J(ex.value);
    }
    if (ex.rule === "both") {
      const one = (t) => (t.is ? !!f[t.is] : !f[t.not]);
      return one(ex.a) && one(ex.b);
    }
    // THE FIFTH FORM, ADDED 2026-08-24, AND WHAT FORCED IT. `both` is an AND
    // and the real conditions in this box are not all ANDs: measured, `at the
    // fifth` is dead on a pad — the chord is voiced and `deg` is never read —
    // EXCEPT under `emergent` harmony, where the chord is derived from the line
    // and transposing the line moves it. So the option is available UNLESS
    // (pad AND not emergent), a negated conjunction, and with only four forms
    // the fitter could see that condition perfectly and had no way to write it
    // down: it came back `opaque` and the page greyed nothing. One form, and
    // the fitter finds it by fitting the COMPLEMENT with the same code.
    if (ex.rule === "unless") {
      const one = (t) => (t.is ? !!f[t.is] : !f[t.not]);
      return !(one(ex.a) && one(ex.b));
    }
    return null;
  }

  /* ====================================================================
     WHY — the one hand-authored table in this file, and it is legitimate
     because it names FACTS, never dependencies. ~20 rows of English for 20
     facts a document carries. Which fact blocks which word is measured by
     gates-extract.js and appears nowhere in here.

     `no` is the reason when the fact is FALSE and the rule wanted it true;
     `yes` when it is true and the rule wanted it false; `eq` names the reason
     per value for an `eq` rule that did not match.
     ==================================================================== */
  const WHY = {
    "cast.drumsOn":     { no: "no drummer", yes: "the drummer is playing" },
    "cast.hasDrums":    { no: "there is no drums voice on this record" },
    "cast.hasBass":     { no: "no bass in the band" },
    "cast.hasChord":    { no: "nobody is voicing a chord — every voice plays a line" },
    "cast.hasPad":      { no: "nobody is voicing a chord — every voice plays a line" },
    "alphabet.diatonic": { no: "the line is not held to the key" },
    // `via` means EXPLAIN BY ANOTHER FEATURE'S CURRENT VALUE. "the harmony is
    // not a cycle" is true and useless; what a person needs to read is which
    // harmony it IS, and that sentence is already written one row down.
    "alphabet.harmony.cycle":    { via: "alphabet.harmony" },
    "alphabet.harmony.modal":    { via: "alphabet.harmony" },
    "alphabet.harmony.emergent": { via: "alphabet.harmony" },
    "voice.part.pad":   { yes: "a pad voices the chord, it does not follow a line" },
    "voice.part.drone": { yes: "a drone holds one note" },
    "voice.part.stab":  { yes: "a stab is a chord, struck" },
    "alphabet.harmony": { eq: { modal: "modal harmony has no changes",
                                emergent: "the changes come from the voices",
                                cycle: "the changes are a cycle here" } },
    "voice.rhythmic":   { no: "a pad voices the chord, it does not follow a line" },
    "voice.native":     { no: "a recording has no synth panel" },
    "voice.on":         { no: "this voice is switched off" },
    "material.hasDrumCell": { no: "no drum grid to operate on" },
    "time.swing":       { no: "the record is straight" },
    "time.meter":       { eq: { four: "the record counts in four",
                                three: "the record counts in three",
                                six: "the record counts in six-eight" } },
    "section.role":     { },
    "basis.nobass":     { yes: "the anchor has no bass at all" },
  };
  // AN UGLY STRING ON THE PAGE IS HOW A MISSING ROW GETS FIXED. A rule with no
  // English falls back to the raw feature name VISIBLY rather than to silence
  // — a silent grey is the bug this whole slice exists to prevent, and an
  // unreadable grey is one report away from being a readable one.
  const bare = (name, sense) => sense + " " + name;
  function reasonFor(term, feats) {
    let w = WHY[term.name] || {};
    if (w.via) {
      const now = feats ? feats[w.via] : undefined;
      const v = WHY[w.via] || {};
      if (v.eq && v.eq[String(now)]) return v.eq[String(now)];
      w = v;
    }
    if (term.kind === "eq") {
      const now = feats ? feats[term.name] : undefined;
      if (w.eq && w.eq[String(now)]) return w.eq[String(now)];
      if (w.eq && term.value != null && w.eq[String(term.value)])
        return "it wants " + w.eq[String(term.value)];
      return bare(term.name, "not");
    }
    if (term.kind === "is") return w.no || bare(term.name, "no");
    return w.yes || bare(term.name, "");
  }
  /* whyOf composes the reason for a rule that did NOT hold. Given the features
     it picks the conjunct that actually failed, which is what makes a `both`
     rule read as one sentence a person wrote rather than two the fitter did. */
  function whyOf(rule, feats) {
    if (!rule) return null;
    if (rule.rule === "never") return "nothing here can be said";
    if (rule.rule === "when") {
      if (rule.why) return rule.why;
      if (rule.is) return reasonFor({ kind: "is", name: rule.is }, feats);
      if (rule.not) return reasonFor({ kind: "not", name: rule.not }, feats);
      if (rule.eq) return reasonFor({ kind: "eq", name: rule.eq, value: rule.value }, feats);
    }
    if (rule.rule === "unless") {
      if (rule.why) return rule.why;
      // an `unless` blocks when BOTH halves are true, so both halves are the
      // reason and the sense of each is the opposite of `both`'s
      const said = [];
      for (const t of [rule.a, rule.b]) {
        const term = t.is ? { kind: "not", name: t.is } : { kind: "is", name: t.not };
        said.push(reasonFor(term, feats));
      }
      return [...new Set(said)].join(", and ");
    }
    if (rule.rule === "both") {
      if (rule.why) return rule.why;
      const said = [];
      for (const t of [rule.a, rule.b]) {
        const term = t.is ? { kind: "is", name: t.is } : { kind: "not", name: t.not };
        const held = t.is ? !!(feats || {})[t.is] : !(feats || {})[t.not];
        if (feats && held) continue;                 // this half is fine
        said.push(reasonFor(term, feats));
      }
      return said.length ? said.join(", and ") : "the record does not allow it here";
    }
    return null;
  }

  /* ====================================================================
     THE DOCUMENT'S OWN FEATURES — vocabulary.js:271 featuresOf's idea and
     its naming discipline, over an eight-axes document instead of a band-kit
     model. Every one is a fact the record already carries, so a rule made of
     them is a rule the page can evaluate on the day it reads the table.

     `scope` is AXES.md's open question answered — "Each axis has to say its
     own scope": a sheet about the cantor's third section resolves against
     features computed FOR the cantor IN that section.
     ==================================================================== */
  const CHORDPART = { pad: 1, stab: 1, drone: 1 };
  const lineCells = (doc) => Object.keys(doc.material.cells)
    .filter((n) => doc.material.cells[n].kind !== "drum");
  /* ...AND THE OTHER HALF OF THE SAME LIST (Paul, 2026-08-25: *"then let me
     choose motifs for things like drums and bass too, as well as existing
     patterns."*)

     WHICH CELLS A VOICE OF THIS KIND MAY READ, and it is a question about the
     DATA and not about permission. A drum cell is `lanes` and a line cell is
     `deg`/`play`, and the two are read by two different things: `document.js`
     :133 takes `.lanes` off the drummer's cell, and `toPhrase` refuses a drum
     cell outright ("a grid is not a line", document.js:230) so a pitched voice
     handed one would compile sixteen zeros and play silence. Offering either
     kind to the wrong voice is therefore not a liberty, it is a menu entry that
     cannot work — which is the one thing the whole availability tier exists to
     prevent.

     THE BASS IS NOT HERE AND THAT IS THE POINT. It is a `line`-shaped voice by
     data, but nothing in either compiler lets it NAME a cell: `K.bass` is handed
     `phrases[0]`, the FIRST LINE's phrase, in both of them (`document.js`
     scoreOf:355 and `ui/derive.js`:433, both captioned "the bass reads accents,
     which only one line can own"). So `cellsFor` answers for the two kinds that
     can act on the answer, and `ui/eight.js` says out loud, on the bass's own
     tab, which cell it is actually reading and why it cannot choose. An honest
     refusal beats a menu that changes nothing. */
  const drumCells = (doc) => Object.keys(doc.material.cells)
    .filter((n) => doc.material.cells[n].kind === "drum");
  const cellsFor = (doc, kind) =>
    (kind === "drums" ? drumCells(doc) : lineCells(doc));
  const voiceNamed = (doc, name) => doc.voices.find((v) => v.name === name);
  const kindOf = (doc, s) => { const v = voiceNamed(doc, (s || {}).voice);
    return v ? v.kind : "line"; };

  /* A ONE-OF-N FACT, SPREAD INTO N BOOLEANS. The rule language's two-place
     form reads `!!f[k]` (vocabulary.js's `both`), so a string column can never
     appear in a two-place rule and can only ever be tested for EQUALITY in a
     one-place one — which cannot say "any part except a pad". That is the exact
     shape of the measured pad gate, so the enumerated facts are published in
     both spellings. It is the parent's own habit: vocabulary.js:281 writes
     `role.verse`, `role.chorus`… as booleans beside `record.form` for the same
     reason. Only the SHORT enumerations get it — parts, kinds, meters,
     harmonies, roles — because a boolean per instrument would be eighty
     columns of coincidence for the fit to trip over. */
  const spread = (f, name, value, all) => {
    for (const v of all) f[name + "." + v] = value === v;
  };

  function docFeatures(doc, scope, env) {
    const f = {}, S = scope || {}, E = env || {};
    const T = doc.time || {}, A = doc.alphabet || {}, M = doc.material || { cells: {} };
    const secs = (doc.form || {}).sections || [], vs = doc.voices || [];
    f["time.meter"]      = T.meter || "four";
    f["time.swing"]      = T.swing || null;
    f["time.rate"]       = T.rate == null ? null : T.rate;
    f["time.bpm"]        = T.bpm;
    f["alphabet.key"]    = A.key;
    f["alphabet.mode"]   = A.mode;
    f["alphabet.diatonic"] = !!A.diatonic;
    f["alphabet.harmony"]  = A.harmony;
    f["alphabet.bars"]     = (A.prog || []).length;
    spread(f, "alphabet.harmony", A.harmony, HARMONIES());
    spread(f, "time.meter", T.meter || "four", ["four", ...Object.keys(K.METERS)]);
    f["material.cells"]       = Object.keys(M.cells || {}).length;
    f["material.hasDrumCell"] = Object.values(M.cells || {})
      .some((c) => c && c.kind === "drum");
    f["form.n"]     = secs.length;
    f["form.roles"] = J(secs.map((s) => s.role));
    const lines = vs.filter((v) => v.kind === "line");
    const bass  = vs.find((v) => v.kind === "bass");
    const drums = vs.find((v) => v.kind === "drums");
    f["cast.lines"]     = lines.length;
    f["cast.hasBass"]   = !!bass && (bass.cast || {}).style !== "nobass";
    f["cast.hasDrums"]  = !!drums;
    f["cast.drumsOn"]   = !!(drums && (drums.cast || {}).on);
    f["cast.bassStyle"] = bass ? ((bass.cast || {}).style || null) : null;
    // WHETHER ANYBODY IS VOICING A CHORD, which is the other half of why the
    // quality menu is dead on the shipped chant: `harmony: "cycle"` alone does
    // not make a quality audible — measured, a record of pure lines renders
    // byte-identically under every quality, because only a pad/stab/drone
    // chair asks the harmony what the chord is (kernel.js:1388).
    f["cast.hasChord"]  = lines.some((v) => CHORDPART[(v.cast || {}).part]);
    // ...AND THE PAD ALONE, because the measurement says the three chord
    // chairs are not one fact here: a `pad` voices the sounding chord and a
    // `stab` and a `drone` do not — set a quality on a record whose only chord
    // chair is a stab and not one event moves. `cast.hasChord` is what the
    // vocabulary says; `cast.hasPad` is what the kernel does, and the fit is
    // offered both so the table can be right about which one it is.
    f["cast.hasPad"]    = lines.some((v) => (v.cast || {}).part === "pad");
    f["cast.parts"]     = J(lines.map((v) => (v.cast || {}).part));
    // THE ANCHOR'S OWN SCALARS, the same walk vocabulary.js:292-302 takes over
    // a genre: a scalar by value, an array by its length, an object skipped.
    const g = GENRES[doc.basis] || {};
    for (const k of Object.keys(g)) {
      const v = g[k];
      if (typeof v === "function") continue;
      if (Array.isArray(v)) { f["basis." + k + ".n"] = v.length; continue; }
      if (v === null || typeof v !== "object") f["basis." + k] = v;
    }
    if (S.voice != null) {
      const v = voiceNamed(doc, S.voice) || {};
      const cast = v.cast || {};
      const cell = ND.materialAt(v, S.section) ;
      const c = (M.cells || {})[cell] || {};
      f["voice.kind"]   = v.kind || null;
      f["voice.part"]   = cast.part || null;
      f["voice.instrument"] = v.instrument || null;
      f["voice.cell"]     = typeof cell === "string" ? cell : null;
      f["voice.cellKind"] = c.kind || null;
      /* THROUGH THE TABLE'S RESOLVER (TABLE.md §2), because this facet knows
         BOTH coordinates: a voice and a section is a CELL, and `entry` and
         `reg` are cell fields with the column as their default since wave 1.
         Asking `cast` directly would have made this the one surface that told
         a hand its register was 0 while the cell it is looking at plays -2.
         With no section named, or no override written, the resolver answers
         off `cast` exactly as these two lines did.

         ABSENT IS TODAY, EXACTLY. Only the two tiers this facet is entitled
         to speak for are taken — the cell and its column — because the
         resolver's LAST tier is the anchor's own closure, and a bass or drums
         scope (no `cast.reg` at all) would start reporting a register off the
         genre where it has always reported 0. `resolveFrom`'s `from` is what
         makes that distinction sayable rather than guessed at. */
      const vix = vs.indexOf(v), six = secs.findIndex((x) => x.id === S.section);
      const cellv = (fld) => {
        if (vix < 0 || six < 0) return cast[fld] | 0;
        const r = ND.resolveFrom(doc, six, vix, fld);
        return (r.from === "cell" || r.from === "column") ? (r.v | 0) : (cast[fld] | 0);
      };
      f["voice.entry"]  = cellv("entry");
      f["voice.reg"]    = cellv("reg");
      f["voice.on"]     = v.kind === "drums" ? !!cast.on : true;
      // chair.js:326's law, verbatim and from the other end: "A PAD DOES NOT
      // HEAR THE BAR." A word the instrument cannot hear is not a word.
      f["voice.rhythmic"] = v.kind === "line"
        ? !!cast.part && cast.part !== "pad" && cast.part !== "drone"
        : true;
      f["voice.native"] = (E.fleet || []).includes(v.instrument);
      spread(f, "voice.part", cast.part || null, PARTS());
      spread(f, "voice.kind", v.kind || null, ["line", "bass", "drums"]);
    }
    if (S.section != null) {
      const ix = secs.findIndex((s) => s.id === S.section), s = secs[ix] || {};
      f["section.role"] = s.role || null;
      f["section.bars"] = s.bars | 0;
      f["section.ix"]   = ix;
      f["section.last"] = ix === secs.length - 1;
      spread(f, "section.role", s.role || null, Object.keys(ROLES));
    }
    if (S.bar != null) {
      const c = (A.prog || [])[S.bar] || {};
      f["bar.ix"]      = S.bar;
      f["bar.degree"]  = c.d;
      f["bar.quality"] = c.q;
      f["bar.inv"]     = c.inv | 0;
    }
    return f;
  }

  /* ====================================================================
     THE PAGE'S VOCABULARY — one row per sheet key. What can be said there,
     what is said there now, and what saying it does. THE PAGE AND THE
     EXTRACTOR READ THESE SAME ROWS, which is the whole point: a menu the
     page draws from one list and the extractor measures from another is two
     lists, and the second one is the one that is wrong.

     A row is { label, scope, kind?, values, get, set }.
       scope   "song" | "song.bar" | "section" | "voice" | "voice.section"
       chair   WHICH KIND OF VOICE the sheet belongs to, for a voice-scoped
               sheet — "line" | "bass" | "drums". The page already branches on
               a voice's kind to decide what to draw; this says the same thing
               once, where the extractor can read it too.
       sheetGate
               MAY THIS SHEET GO DARK AS A WHOLE. A sheet is greyed entire only
               when the thing it operates on is not there — `kind` says what
               that thing is, and the composer can act on its absence (hire a
               drummer). "Nothing you can say here moves the record" is NOT
               enough on its own, and the case that settled it is
               `alphabet.harmony`: measured, no harmony word moves a record of
               pure lines, so the fit greyed the sheet — and a greyed harmony
               sheet is a record that can never grow a chord, because the way
               out IS that sheet. A trap. Sheets with neither `kind` nor
               `sheetGate` grey per OPTION only, where the sibling that is
               still lit shows the way out.
       absent  the value that means THE SHEET SAYS NOTHING. Used by the
               extractor to ask what the record does with this sheet's answer
               taken away, which is a different question from what any one
               answer does.
       kind    WHAT THE SHEET OPERATES ON, as an event kind — "hit", "bass",
               "line" — or absent. This is the sheet's own identity, not a
               dependency: it says what the sheet is ABOUT, and the extractor
               turns it into the measurement "does that thing make any sound
               here at all". A sheet whose subject is silent is a sheet with
               nothing to say, and that is the honest reading of Paul's
               sentence: unticking the drummer greys the kit words because
               there is no kit, not because a diff came out empty.
     ==================================================================== */
  const opts = (list, labels, group) => list.map((v) => ({ value: v,
    label: labels ? (labels[v] == null ? v : labels[v]) : v,
    ...(group ? { group } : {}) }));

  // THE SEVEN CHAIRS COME FROM THE KERNEL, not from a list in a view.
  // ui/eight.js:39 kept its own `PARTS` array — the same seven words in a
  // different order — and a second list of the parts is a second list that can
  // be wrong about them. kernel.js PARTS is what `realize` is read against.
  const PARTS = () => Object.keys(K.PARTS);
  // THE THREE HARMONY WORDS, EXTRACTED FROM THE CATALOG. genres.js declares
  // `harmony` on every one of its 122 anchors and the distinct values are
  // exactly {modal, cycle, emergent} — so the vocabulary is read off the table
  // that uses it rather than typed beside it. (PROGRAM.md §2.6 gives genres.js
  // a HARMONYLABEL row this round, applied by the precompose slice; when it
  // lands it is preferred for the LABELS. The KEYS stay derived either way,
  // because a label is prose and a vocabulary is data.)
  const HARMONIES = () => [...new Set(Object.values(GENRES)
    .map((g) => g.harmony).filter((h) => typeof h === "string"))].sort();
  const HARMONYWORD = { modal: "one mode, no changes",
                        cycle: "a cycle of changes",
                        emergent: "the changes come from the voices" };
  const harmonyLabel = (h) => (NG.HARMONYLABEL && NG.HARMONYLABEL[h]) ||
    h + " — " + (HARMONYWORD[h] || h);
  // THE QUALITIES, GROUPED BY WHICH TABLE THEY COME FROM. kernel.js keeps two:
  // QSTEPS builds the chord out of scale steps (so it bends with the mode) and
  // QFIX pins the intervals in semitones. That is a real distinction a composer
  // can hear, and it is the grouping the sheet uses.
  const QUALITIES = () => [
    ...opts(Object.keys(K.QSTEPS), null, "out of the scale"),
    ...opts(Object.keys(K.QFIX), null, "fixed intervals")];
  /* WHO IS IN THE BASS CHAIR, SAID IN ONE PLACE (2026-09-02). `ui/derive.js
     bassInstrOf` is the one owner of the ANSWER — `(pool && pool.bass) ||
     BASS_INSTR` — and it is an ES module this UMD file cannot require, so the
     expression is read off `env.pool` here in the same three tokens and named
     as the borrowing rather than left to look like a second policy. If the two
     ever disagree the bass menu will say one instrument and the engine will
     play another, which is what `test/table.browser.js` T8b measures (it was band.browser.js B6, folded there when that gate retired with its subject on 2026-09-04). */
  const bassChairName = (env) => {
    const id = ((env || {}).pool || {}).bass || NI.BASS_INSTR;
    return BASSCHOICES[id] || INSTRCHOICES[id] || String(id);
  };

  // INSTRUMENTS, GROUPED BY FAMILY (instruments.js familyOf). Pre-sorted, and
  // stable per key: sheets.js never reorders, because reordering moves a
  // data-k under a live finger and the focus restore is keyed on it.
  const instrOptions = (doc, env) => {
    const fleet = (env || {}).fleet || [];
    const syn = (doc.sound && doc.sound.synth) || (GENRES[doc.basis] || {}).synth || null;
    const out = [];
    // NATIVE means synthesised here and now, by a Faust model in
    // engine/faust/dsp — as against every other entry, which is a recording of
    // an instrument being played. The wording is ui/eight.js's own.
    if (syn) out.push({ value: "synth", group: "native",
                        label: "native " + syn.dsp + " (the record's)" });
    for (const n of fleet) out.push({ value: n, group: "native", label: "native " + n });
    const fam = new Map();
    for (const n of Object.keys(INSTRCHOICES)) {
      const k = NI.familyOf(n) || "other";
      if (!fam.has(k)) fam.set(k, []);
      fam.get(k).push({ value: n, label: INSTRCHOICES[n], group: k });
    }
    for (const k of [...fam.keys()].sort()) out.push(...fam.get(k));
    return out;
  };
  // fields.js RATES names only the two departures (half, double); "as written"
  // is rate 1 and has no key there, so the sheet carries it — ui/eight.js's own
  // comment, and its own three-way mapping, moved here whole.
  /* `""` IS THE SAME OPTION AS ui/eight.js TEMPOS' LAST BUTTON — `time.rate`
     absent — drawn twice on one page, and eight.js's own comment has said so
     since it was written ("this button is the same fourth answer"). It read
     "the genre's own" here and "the record's own speed" there. Paul, 2026-08-26:
     *"'the record's own' -- make that 'default'."* One owner per fact is also
     one WORD per fact when two controls answer one field, so both say `default`
     now — this is the one place the rename went past the literal phrase, and
     that is why. */
  const RATEOPTS = () => [{ value: "", label: "default" },
                          { value: "1", label: "as written" },
                          ...Object.keys(RATES).map((k) => ({ value: k, label: RATELABEL[k] }))];
  const rateNow = (doc) => doc.time.rate == null ? ""
    : doc.time.rate === 1 ? "1"
    : (Object.keys(RATES).find((k) => RATES[k] === doc.time.rate) || "");

  // THE WORDS, GATHERED UNDER THEIR FAMILIES. sheets.js never reorders — a
  // reorder moves a `data-k` under a live finger and the focus restore across
  // the full rebuild is keyed on it (ui/eight.js:1156) — so the ONE sort that
  // happens happens here, and it is stable by construction: the group order is
  // the order the groups first appear in songs.js WORDGROUP, and within a group
  // the words keep WORDS' own order. Sorting here rather than reordering
  // WORDS keeps the vocabulary's order (which is the order it was WRITTEN in,
  // and a record of how the counterpoint words arrived) untouched.
  const devWords = () => {
    const order = [], seen = new Set();
    for (const w of Object.keys(WORDGROUP || {})) {
      const g = WORDGROUP[w];
      if (!seen.has(g)) { seen.add(g); order.push(g); }
    }
    const rank = (w) => { const i = order.indexOf((WORDGROUP || {})[w]);
      return i < 0 ? order.length : i; };
    return Object.keys(WORDS)
      .map((w, i) => ({ w, i }))
      .sort((a, b) => (rank(a.w) - rank(b.w)) || (a.i - b.i))
      .map(({ w }) => ({ value: w, label: w, group: (WORDGROUP || {})[w] }));
  };

  const V = (doc, scope) => voiceNamed(doc, (scope || {}).voice) || {};
  const SEC = (doc, scope) => ((doc.form || {}).sections || [])
    .find((s) => s.id === (scope || {}).section) || {};

  /* ================= HOW THIS PAGE SPELLS "NOTHING SAID HERE" =============
     A `""` option means ABSENT — this control says nothing, so whatever stands
     above it stands. Paul, 2026-08-26: *"'the record's own' -- make that
     'default'."* That phrase is gone from every user-facing string on the page
     (here, ui/eight.js TEMPOS and its knobs table, fields.js's three
     performance nudges), and this is the INVENTORY of what is left, because the
     idea is still spelled four ways and nobody can see that from one row:

       "default"          time.rate, dev.bass, cast.bassStyle, and fields.js
                          stress / phrase / orn — the ones renamed, plus the
                          rate button in ui/eight.js that is the same option
       "—" (was "the voice's own")  material.cell — this SECTION says nothing, so the
                          voice's own standing cell is read
       "as written"       dev.line, dev.kit, and `time.rate`'s value 1 — and
                          NOTE THAT IT MEANS TWO DIFFERENT THINGS: on dev.line
                          and dev.kit it is the absent option, and on time.rate
                          it is a REAL value (rate exactly 1) sitting one row
                          under `default`, which is the absent one

     THE RECOMMENDATION, NOT TAKEN HERE BECAUSE IT WAS NOT ASKED FOR: `default`
     for all four absent options, and `as written` kept ONLY for time.rate's
     value 1, where it is a real answer and not an absence. That would leave one
     word for "say nothing" and no word doing two jobs. It is three more string
     edits and a line in test/knobs.js; it is not made without an instruction,
     because dev.line's "as written" is a MUSICIAN'S word for playing the motif
     as the composer set it down, and losing it may be a real loss rather than a
     tidy-up — that is a judgement about the vocabulary and not about the code. */
  const SHEETS = {
    /* ---- 1 TIME (song) ---- */
    "time.meter": { label: "meter", scope: "song",
      values: () => [{ value: "", label: "four" }, ...opts(Object.keys(METERLABEL), METERLABEL)],
      get: (doc) => doc.time.meter || "",
      set: (doc, s, v) => { doc.time.meter = v || null; } },
    "time.rate": { label: "reading speed", scope: "song",
      values: () => RATEOPTS(),
      get: (doc) => rateNow(doc),
      set: (doc, s, v) => { doc.time.rate = v === "" ? null : v === "1" ? 1 : RATES[v]; } },
    "time.swing": { label: "swing", scope: "song",
      values: () => [{ value: "", label: "straight" }, ...opts(Object.keys(SWINGLABEL), SWINGLABEL)],
      get: (doc) => doc.time.swing || "",
      set: (doc, s, v) => { doc.time.swing = v || null; } },
    /* THE GROOVE, WHICH REACHED THE SOUND BEFORE IT HAD A SHEET (2026-09-02).
       Paul, B7: *"The tempo editor does not reflect the richness of our tempo
       options."* Every wire for this fact was already live — precompose deals
       `time.groove` on every record it composes, ui/eight.js calls
       `setGroove(DOC.time.groove)`, ui/state.js normalises it against
       GROOVELABEL and ui/derive.js hands it to the kernel as an argument — and
       there was no row here, so no control on the page could say it. The
       fourth line of THE DECLARED-BUT-NEVER-ARRIVING bug, read from the UI
       end: the fact arrived, and no hand could move it.
       "the grid" IS ui/state.js's OWN WORD for null and not a new one: "any-
       thing GROOVELABEL does not name is the grid, spelled null". It is the
       absent option and therefore the default detent, which is what makes the
       combo say whether the record's groove is the composer's or yours. */
    "time.groove": { label: "groove", scope: "song",
      values: () => [{ value: "", label: "the grid" },
                     ...opts(Object.keys(GROOVELABEL), GROOVELABEL)],
      get: (doc) => doc.time.groove || "",
      set: (doc, s, v) => { doc.time.groove = v || null; } },

    /* ---- 2 ALPHABET (song, and one bar of the cycle) ---- */
    "alphabet.key": { label: "key", scope: "song",
      values: () => opts(Object.keys(KEYS), KEYLABEL),
      get: (doc) => doc.alphabet.key,
      set: (doc, s, v) => { doc.alphabet.key = +v; } },
    "alphabet.mode": { label: "mode", scope: "song",
      values: () => opts(Object.keys(MODES), MODELABEL),
      get: (doc) => doc.alphabet.mode,
      set: (doc, s, v) => { doc.alphabet.mode = v; } },
    /* THE SUBJECT'S OWN ALPHABET (2026-09-02). `alphabet.scale` has been in
       the document since PROGRAM.md §2.1 named it, precompose writes it on 99
       of the anchors, and document.js:172 resolves it — `SCALES[A.scale] ||
       MODES[A.scale] || mode` — so it decides the chromatic width of every
       phrase the record sings. It had no row here and no control anywhere.
       THE LIST IS TWO TABLES BECAUSE THE FACT IS RESOLVED AGAINST TWO, and
       that resolution is document.js's, not a convenience invented here: the
       shipped chant says `scale: "aeolian"`, which is a MODES key, and a menu
       that offered only SCALES would have shown a composer an unknown value
       for a word the record legally holds. Two `<optgroup>`s, in the order
       document.js tries them.
       ABSENT IS THE MODE. `null` means "the subject sings the mode itself",
       which is exactly what document.js's third fallback does, so the option
       says that rather than "default" — the word for saying nothing is the
       thing that then happens (the `four` / `straight` idiom two rows up).
       AND IT IS TWO WORDS, NOT FOUR (2026-09-02). The probe of the composer
       round read the closed combo at 390px: *"the scale combo's default option
       is a sentence and clips ('the mode itself, it would sound th')."* Half of
       that length was the reason bolted on after the label (`optText` joins
       them, and a `<option>` can hold nothing but text — see the tautology fix
       at the standing-answer clause below); this is the other half. "the mode"
       is the whole of what the fallback does and it is what `document.js:172`
       calls it. */
    "alphabet.scale": { label: "scale", scope: "song",
      values: () => [{ value: "", label: "the mode" },
                     ...opts(Object.keys(SCALES), SCALELABEL, "alphabets"),
                     ...opts(Object.keys(MODES), MODELABEL, "modes")],
      get: (doc) => doc.alphabet.scale || "",
      set: (doc, s, v) => { doc.alphabet.scale = v || null; } },
    // "harmony", 2026-08-27 — FUTURE.md §5: "the changes" headed TWO controls
    // (this select and the chord table); the table alone keeps the name, and
    // the style select takes the axis's own word. The KEY stays
    // `alphabet.harmony` — vocabulary keys never move.
    "alphabet.harmony": { label: "harmony", scope: "song",
      values: () => HARMONIES().map((h) => ({ value: h, label: harmonyLabel(h) })),
      get: (doc) => doc.alphabet.harmony,
      set: (doc, s, v) => { doc.alphabet.harmony = v; } },
    // THE ONE SHEET THAT MAY GO DARK WITHOUT AN EVENT KIND TO POINT AT. Its
    // subject is the progression, and the record reads the progression only
    // under `cycle` (kernel.js:671) — so "nothing you can say here does
    // anything" is, for once, a fact a composer can act on, and the way out is
    // named in the reason. See the sheetGate note above the table.
    "alphabet.quality": { label: "quality", scope: "song.bar", sheetGate: true,
      values: () => QUALITIES(),
      get: (doc, s) => ((doc.alphabet.prog || [])[s.bar] || {}).q,
      set: (doc, s, v) => { const c = (doc.alphabet.prog || [])[s.bar]; if (c) c.q = v; } },

    /* ---- 4 FORM (one section) ---- */
    "form.role": { label: "role", scope: "section",
      values: () => opts(Object.keys(ROLES), ROLES),
      get: (doc, s) => SEC(doc, s).role,
      set: (doc, s, v) => { const x = SEC(doc, s); if (x.id) x.role = v; } },

    /* ---- 6 CAST (one voice) ---- */
    "cast.part": { label: "plays", scope: "voice", chair: "line",
      values: () => opts(PARTS()),
      get: (doc, s) => (V(doc, s).cast || {}).part,
      set: (doc, s, v) => { V(doc, s).cast.part = v; } },
    /* THE VOICE'S MATERIAL IS ITS DEFAULT CELL — what it reads in every
       section that does not say otherwise. §2.1 lets `voice.material` be a
       string OR `{ "<secId>": "<cell>", "": "<default>" }`, and the object form
       arrives the moment a fork or a per-section choice lands, so `get` must
       never hand a select an object to match against and `set` must never flatten
       the sections back to one cell by writing a bare string over the map. Both
       go through the `""` key, which document.js materialAt already falls back
       to — one owner of "what does this voice read here", read from both ends. */
    // `chair: "line"` IS NOT A LIE AND IT IS NOT THE WHOLE TRUTH. A drummer is
    // shown this sheet too since 2026-08-25 (see `cellsFor`), but `chair` is not
    // a permission — it is the kind of voice gates-extract.js:324 SCOPES its
    // probes to (`doc.voices.filter(v => v.kind === row.chair)`), and a value
    // that names two kinds would match none and silently extract no rule at all.
    // The page decides who is shown a sheet; this says who the table was
    // measured against.
    "cast.material": { label: "material", scope: "voice", chair: "line",
      // `local`: THE VALUES ARE NAMES THIS RECORD INVENTED, not a vocabulary
      // every record shares, so gates-extract.js fits no per-option rule on
      // them — see the note at its `if (row.local)`. The sheet-level rule
      // still applies; only a table keyed by the option's own text is refused.
      local: true,
      // BY THE VOICE'S OWN KIND since 2026-08-25 (see `cellsFor`). A drummer
      // asked which material it reads is asked among the DRUM cells; this said
      // `lineCells(doc)` for everybody, which is right for the only kind of
      // voice that was ever shown this sheet and wrong for the two that are
      // shown it now.
      values: (doc, s) => opts(cellsFor(doc, kindOf(doc, s))),
      get: (doc, s) => { const m = V(doc, s).material;
        return (m && typeof m === "object") ? m[""] : m; },
      set: (doc, s, v) => { const x = V(doc, s);
        if (x.material && typeof x.material === "object") x.material[""] = v;
        else x.material = v; } },
    /* ...AND WHICH CELL IT READS IN ONE SECTION (Paul, 2026-08-24: "'the band'
       is where I thought voices would be established, interpreting the
       progression, structure, and motif"). The motifs themselves are the BANK
       in the Material axis — one editor per cell, universal, which is what they
       always were — and this is the other half of the sentence: the band tab is
       where a player says WHICH of the record's tunes it takes, section by
       section. `""` is absent-is-today: the voice's default, above.

       The `""` key in the promotion is load-bearing. Turning the string into
       `{ "<secId>": v }` alone would leave every OTHER section with no entry
       and no default, and materialAt would return undefined for all of them. */
    "material.cell": { label: "reads", scope: "voice.section", chair: "line",
      absent: "", local: true,          // cell names, not a vocabulary — see above
      /* "—", NOT "the voice's own", 2026-08-28 (Paul: *"Replace 'the voice's
         own' with '—' everywhere"*). This is the per-SECTION material cell's
         empty detent: absent means the section says nothing and the voice's
         own cell stands. The old label narrated that inheritance in four
         words on a row that already prints what actually sounds; the dash is
         the same fact at a glance, and it is the shape a table wants — a
         column of dashes with the exceptions visible in it. The RECORD-wide
         empty detent is still the word "default" (FUTURE.md §5): that one
         answers "what did you choose", this one answers "did this section
         override", and they are different questions. */
      values: (doc, s) => [{ value: "", label: "—" },
                           ...opts(cellsFor(doc, kindOf(doc, s)))],
      get: (doc, s) => { const m = V(doc, s).material;
        return (m && typeof m === "object" && m[SEC(doc, s).id] != null)
          ? m[SEC(doc, s).id] : ""; },
      set: (doc, s, v) => { const x = V(doc, s), id = SEC(doc, s).id;
        if (!id) return;
        if (typeof x.material !== "object" || x.material === null)
          x.material = { "": x.material };
        if (v) x.material[id] = v; else delete x.material[id]; } },
    /* THE CONTROL THAT SETS WHAT `dev.bass`'S `default` INHERITS, and it is
       labelled with the same word for that reason: the cast says `default:
       walking` and each section then says `default` or a departure from it. It
       read "the record's own" — Paul, 2026-08-26: *"'the record's own' -- make
       that 'default'."* Two controls pointing at one fact have to point with
       one word or neither of them is readable. */
    "cast.bassStyle": { label: "default", scope: "voice", chair: "bass", kind: "bass",
      values: () => [{ value: "", label: "no bass" }, ...opts(Object.keys(BASSOPS), BASSOPS)],
      get: (doc, s) => (V(doc, s).cast || {}).style || "",
      set: (doc, s, v) => { V(doc, s).cast.style = v || null; } },

    /* ---- 7 SOUND (one voice) ---- */
    /* ===== THE BASS NAMES ITS OWN INSTRUMENT, 2026-09-02 (slice 2c) ======
       Paul, 2026-08-28: *"I've lost all ability to select or customize the
       bass."* A TOMBSTONE STOOD HERE and it was right about everything except
       how long it would last, so it is kept verbatim above its own answer:

         "THERE IS NO `sound.bassinstrument` ROW HERE, AND THAT IS THE BASS'S
          WHOLE PROBLEM… Every sheet in this table reads and writes the
          DOCUMENT. A line voice carries `instrument` and so does a drummer,
          and document.js hands both to the compiler — a line through the
          `chairs` seam, a kit through `drumkit`. The BASS VOICE CARRIES NO
          `instrument` AT ALL: precompose.js builds it as `{ name, kind:
          "bass", cast: { style }, development }`, and audio/plan.js seats a
          bass event at `(POOL && POOL.bass) || BASS_INSTR` — the song's
          INSTRUMENT POOL, which is not in the document and so is not
          addressable from this file. So a row added here would be the box's
          characteristic bug: a control that is declared, drawn, costed and
          reaches no sound… the row belongs here the day the bass voice carries
          its own `instrument` and document.js carries it across — three lines,
          named in the round notes."

       THE THREE LINES ARE WRITTEN. `document.js toGenre` spreads the bass
       voice's `instrument` as `bassInstr`; `audio/plan.js castOf` seats the
       bass at `bRow.bassInstr || (POOL && POOL.bass) || BASS_INSTR`; and this
       is the row. The wire is measured rather than assumed — test/band.browser.js
       B6 sets this menu and reads the unit the engine was handed back off
       `window.__nuMix()`.

       `BASSCHOICES` AND NOT `INSTRCHOICES`, because the bass chair's list is
       narrower and fields.js already owns the narrowing (`poolTakes` refuses a
       glockenspiel in the bass chair, and has since 2026-08-28). One table,
       read from both ends — a menu that offered 108 throats to a bass would be
       offering 97 of them a refusal.

       THE POOL IS NOT RETIRED AND IS NOT A SECOND OWNER. `hirePoolChair("bass",
       id)` still exists, still works and is still what test/pool.browser.js
       drives; what changed is the ORDER — the document wins where it speaks —
       and there is exactly ONE control on the page, this one. Absent is today:
       a record whose bass says nothing reaches `POOL.bass` exactly as before.

       `""` IS THE EMPTY DETENT and it was spelled "default", which is this
       page's word for a record-wide "the record's own" (2026-08-26, Paul:
       *"'the record's own' -- make that 'default'"*) — the same word
       `cast.bassStyle` two rows up already wears.

       REVERSED 2026-09-02, ON THIS ROW ONLY, and the sentence above is kept
       because it is right about every OTHER empty detent on the page. The
       probe of the composer round: *"Nothing ever says what the bass is
       playing: tabbass has no sub; sel|sound.bassinstrument|bass sits on "" =
       'default' with no word. Seat the hired chair's name as the default
       detent and the nav sub."* "default" is the right word where the thing
       it defers to is ALSO on the page and named — a bus, a section, the
       record's own tone. The bass's default defers to a fact that is NOT in
       the document at all (the session's instrument pool, ui/state.js POOL)
       and has no other readout, so "default" here is a control refusing to
       say what is sounding. So this detent wears the CHAIR'S OWN NAME, which
       is `ui/derive.js bassInstrOf`'s answer said in `BASSCHOICES`'s words —
       the same derivation `ui/eight.js playsWhat` prints in the gutter, and
       `audio/plan.js seats()` plays. Two readouts, one derivation, and the
       word for saying nothing is again the thing that then happens (`four` /
       `straight` / `steady`).

       THE POOL ARRIVES IN `env`, the way the fleet does for `sound.instrument`
       eight lines down; a caller that hands none gets `BASS_INSTR`, which is
       what `bassInstrOf(null)` returns and what the engine seats. */
    "sound.bassinstrument": { label: "instrument", scope: "voice", chair: "bass",
      absent: "",
      values: (doc, s, env) => [{ value: "", label: bassChairName(env) },
                     ...opts(Object.keys(BASSCHOICES), BASSCHOICES)],
      get: (doc, s) => V(doc, s).instrument || "",
      set: (doc, s, v) => { const x = V(doc, s);
        if (v) x.instrument = v; else delete x.instrument; } },
    "sound.instrument": { label: "instrument", scope: "voice", chair: "line",
      values: (doc, s, env) => instrOptions(doc, env),
      get: (doc, s) => V(doc, s).instrument,
      set: (doc, s, v) => { V(doc, s).instrument = v; } },
    "sound.drumkit": { label: "machine", scope: "voice", chair: "drums", kind: "hit",
      values: () => opts(Object.keys(DRUMKITS), DRUMKITS),
      get: (doc, s) => V(doc, s).instrument,
      set: (doc, s, v) => { V(doc, s).instrument = v; } },
    /* ---- 7 SOUND: THE THREE A RECORDING CAN ANSWER (2026-08-28) ----------
       Paul: *"I expect SOME control of the native sampled voices, envelopes,
       perhaps voice doubling, normal sampler options. Right now they are
       monolithic."*

       THEY ARE ON THE VOICE AND NOT ON THE BOX, and that is the same
       distinction `sound.instrument` above already draws: what this player IS,
       said once and then left alone. An envelope is a fact about the voice, so
       it is stored beside the instrument (`voice.sound`), carried by
       document.js `toGenre` onto the chair's own seat and read by
       audio/plan.js — the `chairs[v]` seam that already carries a chair's
       instrument, its native model and its tone.

       WHAT EACH WORD DOES is fields.js VOX (atk/rel/dbl) and what it REACHES
       is audio/to-engine.js `samplerVox`, which was written against
       engine/faust/voices/sampler.js rather than guessed: the gain envelope's
       attack ramp and its `swell` shape, the release ramp, and one insert slot
       spent on the doubling chorus. Nothing else a sampler normally offers has
       a port on this engine, so nothing else is drawn.

       THEY ARE NOT chair="line" ONLY BECAUSE OF THE SAMPLER. A modelled voice
       and a declared synth read `attack`/`release` too (state-engine's own
       base params), so the menu is never dead — which is the law this table's
       `sound.bassinstrument` tombstone twelve lines up states from the other
       side.

       `""` IS ABSENT-IS-TODAY and it is spelled "—", the page's word for an
       empty detent (see `material.cell` above): the genre's own tone block
       decides, exactly as it did before these rows existed. */
    ...(function () {
      const row = (key, label) => ({
        label, scope: "voice", chair: "line", absent: "",
        values: () => [{ value: "", label: "—" },
                       ...opts(Object.keys(NF.VOX[key].t), NF.VOX[key].labels)],
        get: (doc, s) => (V(doc, s).sound || {})[key] || "",
        set: (doc, s, v) => { const x = V(doc, s), o = { ...(x.sound || {}) };
          if (v) o[key] = v; else delete o[key];
          if (Object.keys(o).length) x.sound = o; else delete x.sound; } });
      return { "sound.attack": row("atk", "attack"),
               "sound.release": row("rel", "release"),
               "sound.double": row("dbl", "doubling") };
    })(),
    /* ---- 7 SOUND: THE LOOP, on the chairs that have one (2026-08-30) ------
       Paul: "bring over sampling from the old version … add loop points and
       make them editable." The PINNED CONTRACT (fields.js VOX `looping`'s own
       header) names the engine params — loopa / loopb / loopon — and these
       three sheets are the words' side of it: they read and write
       `voice.sound.loopin` / `.loopout` / `.looping` beside atk/rel/dbl,
       document.js's chairs seam carries the whole `sound` object as `vox`,
       and audio/to-engine.js samplerVox is the one dispatch.

       TWO OF THE THREE ARE NUMBERS. A loop point is a 0..1 fraction of the
       zone and its real editor is the voice panel's loop STRIP (ui/eight.js),
       which writes the exact number a finger lands on; the sheet surface
       quantizes to eighths because a sheet is a finite offer, and get()
       returns the stored number so a strip-written 0.37 is never rounded by
       being LOOKED AT. Stored as NUMBERS, never strings — samplerVox passes
       `typeof w === "number"` through and drops a string it has no word for.
       `set` clamps to [0,1]; the in-before-out ordering is enforced where the
       two values meet ONCE (the engine's own resolveLoop swap/clamp, and the
       strip's handles cannot cross), not duplicated here.

       ABSENT IS TODAY, and 0 is not absent: loopin 0 forces the loop to the
       zone's start, which on a zone whose own loopStart sits mid-file is an
       audible edit — so the empty detent is "" and only "" deletes.

       These rows reach ONLY a sampled chair (a synth has no zone), unlike
       their three siblings above — which is why ui/eight.js draws the strip
       behind `sampledVoice` below and draws nothing on a synth chair rather
       than a dead editor. */
    ...(function () {
      const EIGHTHS = () => [{ value: "", label: "—" },
        ...[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
          .map((f) => ({ value: String(f), label: f === 0 ? "the zone's start"
                          : f === 1 ? "the zone's end" : String(f) }))];
      const num = (key, label) => ({
        label, scope: "voice", chair: "line", absent: "",
        values: EIGHTHS,
        get: (doc, s) => { const v = (V(doc, s).sound || {})[key];
          return typeof v === "number" ? String(v) : ""; },
        set: (doc, s, v) => { const x = V(doc, s), o = { ...(x.sound || {}) };
          const n = v === "" || v == null ? NaN : +v;
          if (isFinite(n)) o[key] = Math.min(1, Math.max(0, n));
          else delete o[key];
          if (Object.keys(o).length) x.sound = o; else delete x.sound; } });
      return {
        "sound.loopin":  num("loopin", "loop in"),
        "sound.loopout": num("loopout", "loop out"),
        "sound.looping": { label: "looping", scope: "voice", chair: "line", absent: "",
          values: () => [{ value: "", label: "—" },
                         ...opts(Object.keys(NF.VOX.looping.t), NF.VOX.looping.labels)],
          get: (doc, s) => (V(doc, s).sound || {}).looping || "",
          set: (doc, s, v) => { const x = V(doc, s), o = { ...(x.sound || {}) };
            if (v) o.looping = v; else delete o.looping;
            if (Object.keys(o).length) x.sound = o; else delete x.sound; } },
      };
    })(),

    /* ---- 5 DEVELOPMENT (one voice, one section) ----
       Three sheets, not one, because the three vocabularies are three
       different things: a pitched chair takes a melodic WORD (songs.js WORDS,
       operators over the material), the bass takes a PATTERN and the kit takes
       an OPERATOR. ui/eight.js:424 `menuFor(kind)` chose between them with a
       ternary; the kind picks the sheet KEY now, so gates.js can say something
       different about each — which it does. */
    "dev.line": { label: "the tune", scope: "voice.section", chair: "line", kind: "line", absent: "as written",
      values: () => devWords(),
      get: (doc, s) => (V(doc, s).development || {})[s.section] || "",
      set: (doc, s, v) => { V(doc, s).development[s.section] = v; } },
    /* THE WORD FOR "NOTHING SAID HERE" IS `default`, AND IT IS PAUL'S OWN,
       2026-08-26: *"'the record's own' -- make that 'default'."* This is the
       option he was looking at — the `""` row of a per-section bass menu, which
       means "this section says nothing about the bass, so the voice's standing
       answer stands". Every other spelling of that idea on the page is listed
       in the header note above `SHEETS`; only the ones that are LITERALLY this
       option, drawn twice, were changed with it. */
    "dev.bass": { label: "the bass", scope: "voice.section", chair: "bass", kind: "bass", absent: "",
      values: () => [{ value: "", label: "default" },
                     ...opts(Object.keys(BASSOPS), BASSOPS)],
      get: (doc, s) => (V(doc, s).development || {})[s.section] || "",
      set: (doc, s, v) => { V(doc, s).development[s.section] = v; } },
    "dev.kit": { label: "the kit", scope: "voice.section", chair: "drums", kind: "hit", absent: "",
      values: () => [{ value: "", label: "as written" },
                     ...opts(Object.keys(KITLABEL), KITLABEL)],
      get: (doc, s) => (V(doc, s).development || {})[s.section] || "",
      set: (doc, s, v) => { V(doc, s).development[s.section] = v; } },
  };

  /* ---- 4 FORM, 5 DEVELOPMENT and 8 PERFORMANCE: THE NUDGES (D7) ----------
     (Paul, 2026-08-24: "we had lots of fun nudges to the music and motifs —
     like arching.")

     GENERATED FROM THE REGISTRY, NEVER TYPED. fields.js FIELDS rows carry an
     `axis` and an `ask` now, and `nudgesFor(axis)` is the only list: a row that
     grows an `axis` there appears on the page with no edit here and none in the
     view (interview.js's law, "every question knows what heading it lives
     under", one layer down). A hand-written table of nine keys beside a
     registry that already knows all nine is the second source of truth this
     file's own header refuses.

     `nudge` is skipped: it is an INT (how many bars into the tune the section
     starts, ui/derive.js:396) and a slider is not a sheet.

     The performance rows are SONG-scoped and their values are a number or a
     whole ornament policy, so the option value is the WORD and fields.js
     `nudgeValue` / `nudgeWord` map it both ways against askable.js's own
     `valueOf` — a radio's value is a string and `{grace: 0.4, …}` is not one. */
  for (const axis of ["form", "development"])
    for (const r of NF.nudgesFor(axis)) {
      if (!r.options) continue;
      const key = r.key;
      SHEETS[axis + "." + key] = { label: r.ask, scope: "section", nudge: key,
        values: () => r.options,
        get: (doc, s) => SEC(doc, s)[key] || "",
        set: (doc, s, v) => { const x = SEC(doc, s); if (x.id) x[key] = v || null; } };
    }
  /* ===== THE ROW'S OWN FACTS, MINTED THE SAME WAY (2026-09-04) ==========
     TABLE.md wave 2a gave a SECTION a document address for its harmony, its
     feel, its chain and its room — `key mode prog swing groove fx rev echo
     dtime room pan` — and wave 2b draws them, which means each one needs a
     VOCABULARY with an owner. It has one already: `fields.js FIELD[<key>]` is
     the box registry's row, with the same `table` and `labels` the box, the
     desk and the export have always read. So these are minted off that row
     rather than typed out again, exactly as the axis loop above mints the
     nudges — a second list of five reverb words is the thing this file's own
     header refuses.

     WHY THEY ARE NOT IN THE AXIS LOOP. That loop mints from `f.axis`, which is
     what puts a question in Structure's "the rest" grid and in the interview;
     giving these eleven an axis would have moved eleven controls onto a
     surface being deleted this wave and changed `restKeys()` under two gates.
     One list, here, named for what it is.

     `fx` IS A LIST AND IS OFFERED AS ONE WORD. The box field is `type: "list"`
     (a chain of up to MAX_FX), and a sheet says one word — so the words on
     offer are "no chain" plus each single effect, and choosing one REPLACES
     the chain. A section the composer dealt two effects on prints both, joined,
     with neither chip pressed: you can see what is true and you can say one
     thing, which is the honest half of what a strip of words can do here. The
     rest of the chain is the rack's, and the rack is on Mix.

     `swing` and `groove` HAVE NO BOX ROW at all — they are the record's, and
     wave 2a made the section able to override them — so their tables are named
     here off fields.js's own SWINGLABEL / GROOVELABEL, which is still the one
     owner of those words. */
  const ROWFACTS = [
    ["key",   "what key is this section in?",     "the record's key"],
    ["mode",  "and what mode?",                   "the record's mode"],
    ["prog",  "what changes does it run?",        "the record's own"],
    ["swing", "how does this section swing?",     "the record's swing"],
    ["groove","and how does it sit?",             "the record's groove"],
    ["fx",    "what is in its chain?",            "no chain"],
    ["rev",   "how much reverb?",                 "the genre's own"],
    ["echo",  "how much echo?",                   "the genre's own"],
    ["dtime", "how long is the echo?",            "the record's delay"],
    ["room",  "how much room on the kit?",        "the genre's own"],
    ["pan",   "where does it sit across?",        "centre"],
  ];
  const ROWTABLE = { swing: NF.SWINGLABEL, groove: NF.GROOVELABEL };
  for (const [key, ask, none] of ROWFACTS) {
    const f = NF.FIELD[key];
    const labels = ROWTABLE[key] || (f && (f.labels || f.table));
    if (!labels) continue;
    const list = key === "fx"
      ? Object.keys(labels).map((k) => [k, (NF.FXLABEL || labels)[k] || k])
      : Object.keys(labels).map((k) => [k, labels[k]]);
    SHEETS["form." + key] = { label: ask, scope: "section", rowfact: key,
      values: () => [{ value: "", label: none },
                     ...list.map(([v, w]) => ({ value: v, label: String(w) }))],
      /* THE LIST FIELD READS BACK AS ONE WORD OR AS THE JOIN. A chain of one
         is the word (and its chip is pressed); a chain of two prints both and
         matches no chip, which is exactly what "you can see what is true" and
         "you can say one thing" look like together. */
      get: (doc, s) => { const x = SEC(doc, s);
        const v = x[key];
        if (key === "fx") return Array.isArray(v) ? (v.length === 1 ? v[0] : "") : (v || "");
        return v == null ? "" : String(v); },
      say: (doc, s) => { const x = SEC(doc, s);
        if (key !== "fx") return null;
        const v = x.fx;
        return Array.isArray(v) && v.length > 1 ? v.join(" + ") : null; },
      set: (doc, s, v) => { const x = SEC(doc, s); if (!x.id) return;
        if (key === "fx") { x.fx = v ? [v] : []; return; }
        x[key] = v || null; } };
  }

  /* ===== ...AND THE FIVE THE CELL ALREADY ASKS, ASKED OF THE ROW =========
     (2026-09-05, TABLE.md §1 SECTION: *"artic / oct / rate / scale / clamp —
     the section's own word for the five, and the DEFAULT a cell overrides."*)

     Wave 4 gave `artic`/`oct`/`rate`/`scale`/`clamp` a CELL control and a ROW
     tier in the resolver (`document.js CELLFIELD`, `row: (s) => s && s.artic`
     and its four siblings) and drew nothing at the row: the default a cell was
     offered "the row's" as a fallback for could not be SET. A tier a hand can
     inherit from and cannot write is half a control, and TABLE.md wave 4's own
     T4n has been gating the model half of it since the day it landed ("a row
     word reaches every chair of its section, and a cell outranks it").

     MINTED OFF `fields.js CELLVEC`, WHICH IS THE ONE OWNER of the five
     vocabularies — the same table the cell strip reads, so the row and the
     cell can only ever offer the same words, in the same spelling, with the
     same neutral dropped at the door. Typing a second list of articulations
     here is what this file's own header refuses.
     THE NEUTRAL WORD IS NOT OFFERED, for the reason ui/table.js gives three
     times over: `oct: "0"` is an octave shift of no octaves, `cellVecClean`
     drops it, and a chip that writes and vanishes on the next recompile is
     §1b's register bug shipped again.
     WRITTEN THROUGH `document.js putRow`, which is the row's one writer and
     the door T4n diffs — never `x[key] = v`, because these five have a
     vocabulary and a value outside it must be refused at the door rather than
     carried as a lie the kernel would play. */
  for (const f of (NF.CELLVEC || [])) {
    /* ...FOUR OF THE FIVE, AND `clamp` IS NOT ONE OF THEM (2026-09-05).
       Minting it here would put a live strip on the row sheet that writes
       `section.clamp`, resolves through `document.js toGenre` onto the
       compiled genre's `incClamp`, reaches `kernel.js rampOf` — and moves no
       note, because `document.js toPhrase` writes `inc` and `stk` all-zero on
       every phrase this box can hold (0 of 18,793 motifs across 479 anchors at
       three readings carries a ramp column; `nukernel/gates.json`'s own census
       reads `form.clamp` as 165 rows and 0 alive, and said so before this line
       existed). A control that writes and does not arrive is the one bug this
       tree keeps, so the ROW SHEET SAYS THE MEASUREMENT INSTEAD — the cell's
       own treatment one tier up (`src/table/model.ts rowVecSay`, whose
       `RAMPWHY` is the one spelling of the sentence). A sheet nothing draws
       would be the dead half of the same problem, so none is minted: the day a
       ramp column lands in the hook editor, `test/table.test.js` T4m goes red,
       this `continue` comes out, and the strip is back with its vocabulary
       unchanged. */
    if (f.key === "clamp") continue;
    SHEETS["form." + f.key] = { label: f.ask, scope: "section", rowvec: f.key,
      values: () => [{ value: "", label: "as the genre asks" },
                     ...Object.keys(f.table)
                       .filter((k) => k !== f.neutral)
                       .map((k) => ({ value: k,
                                      label: String((f.labels || {})[k] || k) }))],
      get: (doc, s) => { const x = SEC(doc, s);
        return x[f.key] == null ? "" : String(x[f.key]); },
      set: (doc, s, v) => { const x = SEC(doc, s); if (!x.id) return;
        const si = ((doc.form || {}).sections || []).indexOf(x);
        if (si < 0) return;
        ND.putRow(doc, si, f.key, NF.cellVecClean(f.key, v)); } };
  }

  for (const r of NF.nudgesFor("performance")) {
    const key = r.key;
    SHEETS["performance." + key] = { label: r.ask, scope: "song",
      values: () => r.options,
      get: (doc) => NF.nudgeWord(key, (doc.performance || {})[key]),
      set: (doc, s, v) => { doc.performance[key] = NF.nudgeValue(key, v); } };
  }

  // WHICH SHEET A VOICE'S DEVELOPMENT COLUMN IS. One place, so the page, the
  // extractor and any future surface agree about it.
  const devSheetFor = (kind) => kind === "bass" ? "dev.bass"
    : kind === "drums" ? "dev.kit" : "dev.line";

  /* ====================================================================
     THE ONE CALL THE PAGE MAKES.
     ==================================================================== */
  function optionsFor(doc, scope, key, table, env) {
    const row = SHEETS[key];
    if (!row) throw new Error("avail: no sheet named " + key);
    const S = scope || {}, E = env || {};
    const feats = docFeatures(doc, S, E);
    const vals = row.values(doc, S, E) || [];
    const cur = row.get(doc, S, E);
    const g = (table && table.sheets && table.sheets[key]) || null;
    // FAIL OPEN, TWICE OVER (design 02 §6.2 and §6.3). A key the table has
    // never heard of is a new sheet against a stale table; `regenerates:false`
    // is the extractor saying it could not reproduce itself on the holdout.
    // Both grey NOTHING and say `ungated` so a gate can count them, because
    // greying a live option is worse than showing a dead one.
    const ungated = !g || g.regenerates === false;
    let why = null;
    if (!ungated && g.rule && evalRule(g.rule, feats) === false)
      why = whyOf(g.rule, feats) || "the record does not allow it here";
    const options = vals.map((o) => {
      const value = String(o.value);
      const out = { value, label: o.label == null ? value : String(o.label) };
      if (o.group) out.group = o.group;
      const og = (!ungated && g.options && g.options[value]) || null;
      if (og) {
        if (og.rule && evalRule(og.rule, feats) === false) {
          out.disabled = true;
          out.why = whyOf(og.rule, feats) || "the record does not allow it here";
        } else if (og.inert && evalRule(og.inert, feats) === true) {
          out.quiet = true;
          out.why = (og.inert.why || whyOf(og.inert, feats) ||
                     "it would sound the same here");
        }
      }
      // ...AND THE NUDGES, WHICH CANNOT BE MEASURED (D7). gates.js is extracted
      // by DIFFING renders, and what blocks `outro: "drum fill"` on a record
      // with no drummer is not that it changes nothing — it writes five snare
      // hits and a crash (kernel.js:2861), which is a change, and a wrong one.
      // So the requirement is declared beside the word in fields.js NUDGEGATE,
      // in THIS file's rule language against THIS file's docFeatures, and this
      // is its one call site. Inside the map on purpose: the standing-answer
      // rule immediately below still gets to clear a refusal on the word the
      // record is currently saying.
      if (row.nudge) NF.nudgeGate(row.nudge, value, feats, out, { evalRule, whyOf });
      // THE STANDING ANSWER IS ALWAYS OFFERED (band-kit.js:3956 — "you can
      // always see the word you are on"). A document loaded from JSON, or an
      // axis moved after the fact, strands an answer; without this the page is
      // un-editable at exactly the moment it matters. The reason SURVIVES —
      // the word is still a strange thing to be saying here and the page keeps
      // saying so — it just stops being a refusal.
      //
      // EXCEPT WHEN THE REASON IS THE TAUTOLOGY (2026-09-02, the fix round).
      // "The reason SURVIVES" is right about a REFUSAL — a disabled option
      // says something a composer can act on — and wrong about an INERT one on
      // the very value the record is currently saying: "it would sound the
      // same here" is true of that option because it IS what is sounding, and
      // the extractor marks it inert for exactly that reason (it diffs
      // renders, and the answer you are on renders identically to itself). So
      // the option read "the mode, it would sound the same here, and it is
      // what the record says" — 76 characters in a 270px combo, measured on
      // the rendered page at 390 — where the last clause is the whole of the
      // information. The refusal half keeps its reason; the tautology drops.
      if (String(cur) === value && (out.disabled || out.quiet)) {
        const tauto = out.quiet && !out.disabled;
        out.disabled = false; out.quiet = false;
        out.why = tauto ? "it is what the record says"
          : (out.why || "") + ", and it is what the record says";
      }
      return out;
    });
    return { options, why, ungated, value: cur };
  }

  /* WHICH CHAIR GETS THE LOOP STRIP (2026-08-30). One answer, owned here
     because "what can be said on this chair" is this file's whole subject: a
     line chair whose instrument the SAMPLER plays. The pieces are their own
     owners' — `sampledId` is instruments.js's complement of the patch tables
     (measured against recipeFor's routing, see its header), the fleet is the
     caller's env exactly as instrOptions takes it (a native Faust voice is
     not a recording), and "synth" is the signature sentinel sampledId already
     refuses. ui/eight.js draws the strip on a yes and NOTHING on a no — a
     synth chair gets no dead loop editor, which is the no-silent-grey law's
     other half: absence of a control that cannot exist is not a greying. */
  const sampledVoice = (doc, s, env) => {
    const v = V(doc, s);
    if (!v || v.kind !== "line") return false;
    const id = v.instrument;
    if (!id || ((env || {}).fleet || []).includes(id)) return false;
    return NI.sampledId(id);
  };

  return { docFeatures, evalRule, whyOf, reasonFor, WHY, SHEETS, optionsFor,
           devSheetFor, HARMONIES, PARTS, lineCells, drumCells, cellsFor,
           sampledVoice };
});
