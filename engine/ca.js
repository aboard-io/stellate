// ca.js — THE AUTOMATON: a whole song in 24 bits.
//
//     seed : 16 bits   the row you tap in
//     rule :  8 bits   one of the 256 elementary CA rules
//
// That is the document. Everything else — the drum kit, the bass cell, the
// melody cell, the chord progression, and THE SECTIONS THEMSELVES — is derived
// by pure functions of those 24 bits, so a song is deterministic, byte-stable,
// and fits in a URL with room to spare.
//
// WHY THIS EXISTS. /daw grew five separate vocabularies (kit ops, bass degrees,
// melody ladder cells, named progressions, per-section overrides) and therefore
// five editors, and form was authored section by section — `secover` is a diff
// wearing a rule's clothes. This file is the other end of that: ONE datum, ONE
// evolution rule, and a LENS per track. You manipulate the rule system; the
// sections are interpretations, never edits.
//
// THE ONE IDEA. A 16-cell row and a triad are both acted on by a small group of
// INVOLUTIONS, and a song is a WORD in that group:
//
//   on the row     rotate · reflect · complement       (dihedral, plus a flip)
//   on the triad   P · L · R                           (the neo-Riemannian group)
//
// Same algebra, different clocks. That is what lets rhythm, harmony and form be
// one instrument instead of five panels. This file ships the harmony half (PLR)
// and the CA half; the row involutions are `rot`/`ref`/`inv` below, offered as
// vocabulary for the surfaces that want them.
//
// WHAT IT DOES NOT DO. It writes no notes. Every lens emits vocabulary the
// engine ALREADY interprets — a `state.kits` entry in the shipped op grammar, a
// `state.bassCells` entry in chord degrees, a `state.melodyCells` entry in
// ladder indices, a progression in the shape `voicing()` returns. So there is no
// new interpreter, no new rng stream, and nothing here can desynchronise from
// csd-engine: if the engine changes how a kit sounds, a CA song changes with it.
//
// THE ONE ENGINE CHANGE this needed is two lines in `getProgression`, which now
// accepts a resolved progression OBJECT as well as a catalogue name. Strings
// behave exactly as before, so every shipped state is byte-identical.
//
// LINEAR LENSES, RING AUTOMATON. The automaton wraps (cell 15's right neighbour
// is cell 0) because that is what makes it an elementary CA. The lenses read the
// row LINEARLY — cell −1 and cell 16 are dead — because a musical bar has a
// downbeat and an end. A live cell 0 is therefore always a run head, which is
// why the downbeat reads as a kick rather than as the tail of a wrapped run.

(function (root) {
  "use strict";

  // csd-engine, loaded the UMD way the rest of the engine uses: node gets a
  // require, the browser gets the global its <script> tag set BEFORE this file.
  // Only `voicing()` is needed, and only when building a progression.
  const engineRef = () => (typeof module !== "undefined" && module.exports)
    ? require("./csd-engine.js") : root.CsdEngine;

  const N = 16;                 // cells in the ring
  const MASK = 0xffff;
  const STEP = 0.5;             // beats per cell — 16 eighths across an 8-beat chord bar
  const CELL_BEATS = N * STEP;  // 8

  // ---------------------------------------------------------------- the ring
  // Ring read (the automaton's own neighbourhood) and linear read (the lenses').
  const at = (row, i) => (row >>> (((i % N) + N) % N)) & 1;
  const lin = (row, i) => (i < 0 || i >= N ? 0 : (row >>> i) & 1);
  function pop(row) { let n = 0; row &= MASK; while (row) { row &= row - 1; n++; } return n; }
  const ham = (a, b) => pop((a ^ b) & MASK);
  const cells = (row) => { const a = []; for (let i = 0; i < N; i++) a.push(at(row, i)); return a; };
  const fromCells = (a) => { let r = 0; for (let i = 0; i < N && i < a.length; i++) if (a[i]) r |= 1 << i; return r >>> 0; };

  // THE ROW INVOLUTIONS — the rhythmic half of the group. `rot` is the only one
  // that is not self-inverse; it is here because a rotation is what a "shifted
  // feel" actually is, and rot(n) ∘ rot(−n) = identity all the same.
  const rot = (row, n) => { n = ((n % N) + N) % N; return (((row << n) | (row >>> (N - n))) & MASK) >>> 0; };
  const ref = (row) => { let o = 0; for (let i = 0; i < N; i++) if (at(row, i)) o |= 1 << (N - 1 - i); return o >>> 0; };
  const inv = (row) => (~row & MASK) >>> 0;

  // -------------------------------------------------------------- the automaton
  // Elementary CA: the neighbourhood (left, self, right) indexes one of eight
  // bits of the rule byte. 256 rules, all of them browsable as pictures.
  function step(row, rule) {
    let out = 0;
    for (let i = 0; i < N; i++) {
      const nb = (at(row, i - 1) << 2) | (at(row, i) << 1) | at(row, i + 1);
      if ((rule >>> nb) & 1) out |= 1 << i;
    }
    return out >>> 0;
  }

  // THE ORBIT IS THE FORM. The state space is only 2^16, so every trajectory is
  // a rho: a TAIL of transient rows, then a CYCLE it repeats forever. Computing
  // it is microseconds, and it is the whole structural fact about a song —
  // the tail is the intro, the cycle is the loop, `cycle` is the phrase length.
  // `cycle === 0` means it had not closed within `max`; callers treat the rows
  // they got as a straight line rather than a loop.
  function orbit(seed, rule, max) {
    max = max || 256;
    seed = (seed >>> 0) & MASK; rule = (rule | 0) & 255;
    const rows = [], seen = new Map();
    let s = seed;
    while (rows.length < max) {
      if (seen.has(s)) { const t = seen.get(s); return { seed, rule, rows, tail: t, cycle: rows.length - t }; }
      seen.set(s, rows.length); rows.push(s); s = step(s, rule);
    }
    return { seed, rule, rows, tail: rows.length, cycle: 0 };
  }
  // Generation n, following the cycle past the end of the computed rows.
  function gen(orb, n) {
    const rows = orb.rows;
    if (n < 0) n = 0;
    if (n < rows.length) return rows[n];
    if (!orb.cycle) return rows[rows.length - 1];
    return rows[orb.tail + ((n - orb.tail) % orb.cycle)];
  }

  // ------------------------------------------------------------- neo-Riemannian
  // The PLR group on the 24 consonant triads (the dihedral group of order 24).
  // Each generator is an involution moving exactly ONE voice by the smallest
  // possible step, which is why PLR words sound smooth rather than functional:
  //   P  parallel        C  ↔ Cm     the third moves a semitone
  //   L  leading-tone    C  ↔ Em     the root moves down a semitone
  //   R  relative        C  ↔ Am     the fifth moves up a tone
  // Three canonical closures fall out, and they are the reason the form table
  // below can promise a section that COMES HOME:
  //   (LP)^3 = 1   hexatonic  — 6 triads, the "other world" that returns
  //   (PR)^4 = 1   octatonic  — 8 triads, the dark one
  //   (RL)^12 = 1  the descending-fifths walk everyone already knows
  // HONEST LIMIT: PLR reaches only PARSIMONIOUS moves. Root motion by a whole
  // step (F→G — the royal road this project is named after) is in the group but
  // is a ~20-letter word. Word length IS harmonic distance here; big functional
  // lifts are deliberately far away, and stay the business of theory.js.
  const PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const LETTER = ["·", "P", "L", "R"];        // 0 = hold
  function plr(t, op) {
    if (op === 1) return { pc: t.pc, min: !t.min };
    if (op === 2) return t.min ? { pc: (t.pc + 8) % 12, min: false } : { pc: (t.pc + 4) % 12, min: true };
    if (op === 3) return t.min ? { pc: (t.pc + 3) % 12, min: false } : { pc: (t.pc + 9) % 12, min: true };
    return { pc: t.pc, min: t.min };
  }
  // A ROW READS AS A PLR WORD: four groups of four cells, each group's popcount
  // mod 4 naming a letter. So the seed carries the song's harmony as well as its
  // rhythm — one datum, both dimensions.
  function word(row) {
    const w = [];
    for (let g = 0; g < 4; g++) { let n = 0; for (let i = 0; i < 4; i++) n += at(row, g * 4 + i); w.push(n % 4); }
    return w;
  }
  const triads = (row, keyPc) => {
    let t = { pc: (((keyPc | 0) % 12) + 12) % 12, min: false };
    return word(row).map((op) => (t = plr(t, op)));
  };
  const triadName = (t) => PC[t.pc] + (t.min ? "m" : "");

  // A progression in the exact shape csd-engine's own `voicing()` returns, so
  // every downstream pass (pads, bass degrees, the lead ladder, MIDI export)
  // treats it as an ordinary catalogue entry.
  function progression(row, keyPc, E) {
    E = E || engineRef();
    const ts = triads(row, keyPc), w = word(row);
    return {
      label: "CA · " + w.map((o) => LETTER[o]).join(" "),
      chords: ts.map((t) => E.voicing(PC[t.pc], t.min ? "min" : "maj")),
      caWord: w.slice(), caTriads: ts.map(triadName),
    };
  }

  // -------------------------------------------------------------------- lenses
  // One row, read five ways. Each returns vocabulary the engine already speaks.

  // DRUMS — WHERE a hit lands picks the drum; the run structure picks whether it
  // is an impact or a roll.
  //
  // THE FIRST CUT USED RUN STRUCTURE ALONE — isolated = snare, run head = kick,
  // interior = hat — and it was wrong in a way only visible once the page drew
  // the lanes. "Isolated" is a SUBSET of "run head" and it was tested first, so a
  // lone cell could never be a kick: the most natural thing anyone taps, evenly
  // spaced single hits, produced five snares and no kick at all. A lens that
  // turns the most obvious input into nonsense is not minimal, it is broken.
  //
  // So POSITION carries the lane, which is what a bar is for: the downbeats of
  // each measure (cells 0/4/8/12 — beats 1, 3, 5, 7) are kick, the backbeats
  // (2/6/10/14 — beats 2, 4, 6, 8) are snare, the off-eighths between them are
  // ticks, and anything INSIDE a run is a hat. Draw four on the floor, get four
  // kicks; draw straight eighths, get a backbeat; draw a run and its head speaks
  // while its tail becomes hats. Still a pure function of the row, still zero rng
  // draws — `hits` ops are static, so a CA kit costs the engine nothing.
  function lensDrums(row) {
    const kick = [], snare = [], hat = [];
    for (let i = 0; i < N; i++) {
      if (!lin(row, i)) continue;
      const l = lin(row, i - 1), r = lin(row, i + 1), t = i * STEP;
      if (l) hat.push([t, r ? 0.16 : 0.11]);         // inside a run: the roll
      else if (i % 4 === 0) kick.push([t, 0.62]);    // run head on a downbeat
      else if (i % 4 === 2) snare.push([t, 0.46]);   // run head on a backbeat
      else hat.push([t, 0.13]);                      // run head off the eighth: a tick
    }
    const ops = [];
    if (kick.length) ops.push({ d: "kick", hits: kick });
    if (snare.length) ops.push({ d: "snare", hits: snare });
    if (hat.length) ops.push({ d: "hat", hits: hat });
    return { turn: false, ops };                      // turn:false — no end-of-cycle snare fill
  }

  // BASS — onsets at RISING EDGES only, so a run is one held note rather than a
  // machine-gun. Run length picks the chord degree, which is why the line moves
  // when the rhythm moves. Degrees, not pitches: the bar follows the harmony.
  // DURATION carries the run length, so the DEGREE is free to carry motion: short
  // notes alternate root and fifth by onset ordinal — the most ordinary bass move
  // there is — and any run of two or more lifts to the octave. Mapping the degree
  // to run length alone (the first cut) gave a static root pedal on exactly the
  // rows people draw first, for the same reason the drum lens did.
  function lensBass(row) {
    const out = [];
    let k = 0;
    for (let i = 0; i < N; i++) {
      if (!lin(row, i) || lin(row, i - 1)) continue;
      let len = 1; while (i + len < N && lin(row, i + len)) len++;
      out.push([i * STEP, Math.min(len * STEP, 4), len >= 2 ? "r6" : (k % 2 ? "f6" : "r5")]);
      k++;
    }
    return out;
  }

  // MELODY — the ladder slot is the RUNNING COUNT of live cells to its left,
  // folded into the four-note voicing and an octave. A prefix sum is monotone,
  // so what comes out is a CONTOUR — an arch that climbs and folds — rather than
  // the noise a per-cell pitch read would give. Durations run to the next onset.
  function lensMelody(row) {
    const on = []; for (let i = 0; i < N; i++) if (lin(row, i)) on.push(i);
    return on.map((i, k) => {
      const next = k + 1 < on.length ? on[k + 1] : N;
      return [i * STEP, Math.min((next - i) * STEP, 2), k % 4, Math.floor(k / 4) % 2];
    });
  }

  // ------------------------------------------------------------------- the form
  // ROLES ARE READ, NEVER WRITTEN. Each generation is classified from the row
  // itself, and the role picks an arrangement MASK — which lenses are audible —
  // not any notes. This is the whole point: you edit the automaton, and what a
  // chorus is stays a rule about what makes a chorus.
  const ROLES = {
    //        pads   bass   drums  melody
    rest:   { pads: true, bass: 0, drums: 0, melody: 0 },
    intro:  { pads: true, bass: 0, drums: 0, melody: 0 },
    verse:  { pads: true, bass: 1, drums: 1, melody: 0 },
    chorus: { pads: true, bass: 1, drums: 1, melody: 1 },   // the melody entering IS the chorus
    bridge: { pads: true, bass: 0, drums: 0, melody: 1 },   // the exposed moment: rhythm drops out
    outro:  { pads: true, bass: 1, drums: 0, melody: 0 },
  };

  // How many generations the song uses: the tail plus one full turn of the
  // cycle, floored at 4 sections and capped so a long cycle cannot hand you a
  // forty-minute song by accident.
  function formLength(orb, cap) {
    cap = cap || 12;
    let n = orb.cycle ? orb.tail + orb.cycle : orb.rows.length;
    // A PURE CYCLE (no transient — the seed is itself on the loop) comes home by
    // itself: play ONE generation past the close and the song ends on the row it
    // started on. The automaton supplies its own reprise, so the form rule below
    // has nothing to add. Without this the last generation was the one BEFORE the
    // return, and every looping rule got a bolted-on hook it did not need.
    if (orb.cycle && orb.tail === 0 && n + 1 <= cap) n += 1;
    const turn = orb.cycle || n;
    while (n < 4 && turn > 0) n += turn;
    return Math.max(1, Math.min(n, cap));
  }

  // THE GENERATION SEQUENCE — which rows the song plays, in order. Normally the
  // orbit straight through, and then ONE rule on top of it:
  //
  //   THE REPRISE RULE. A hook you hear once is not a hook. If the automaton
  //   never brings the seed back inside the song — and for a long-tailed rule
  //   it usually does not; rule 110 from a typical seed has a tail of 50 — the
  //   form replays generation 0 as the penultimate section.
  //
  // This is the layer the whole design is for: an opinion about what makes a
  // chorus, asserted over the automaton, without editing a single section. It is
  // a SEQUENCE rule, not a diff — it names a generation the automaton already
  // produced, so it survives any change of seed or rule.
  function formGens(orb, cap) {
    const n = formLength(orb, cap);
    const gens = []; for (let i = 0; i < n; i++) gens.push(i);
    if (n >= 6) {
      let recurs = false;
      for (let i = 1; i < n; i++) if (gen(orb, i) === orb.seed) { recurs = true; break; }
      if (!recurs) gens.splice(n - 1, 0, 0);        // reprise, then land on the outro
    }
    return gens;
  }

  // The classifier. Deterministic, integer-only, and every threshold is a
  // quantile of THIS SONG's own densities rather than a constant — a constant
  // suits one rule and no other, and the 256 rules disagree wildly about how
  // dense a row is.
  //
  // A CHORUS MUST BE SCARCE or the word means nothing. The first cut used the
  // 2/3 quantile and called 56% of all generations a chorus; the peak quantile
  // plus a strictly-above-median guard puts it near a sixth, with verse as the
  // default the way a song actually works.
  //
  // AND AN INTRO MUST BE AT THE FRONT. The first cut said "g < orb.tail", which
  // is a fact about the ORBIT, not the song: rule 110 from a typical seed has a
  // tail of 50 generations, so a 12-section song was entirely "intro". The tail
  // is still what makes an intro possible — a transient row can never recur —
  // but it is capped at the first quarter of the song.
  // `gens` is the sequence from formGens (a plain count is accepted too, and
  // means "the orbit straight through"). Roles are per POSITION in the song, not
  // per generation — the reprise makes those two different things.
  function roles(orb, gens) {
    if (typeof gens === "number") { const a = []; for (let i = 0; i < gens; i++) a.push(i); gens = a; }
    const n = gens.length;
    const rows = gens.map((g) => gen(orb, g));
    const dens = rows.map(pop);
    const sorted = dens.slice().sort((a, b) => a - b);
    const q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
    const med = q(0.5), peak = q(5 / 6);
    const introEnd = Math.min(orb.tail, Math.ceil(n / 4));
    // the bridge is the single row furthest from the seed — ties to the earliest,
    // and never position 0 (which IS the seed, and is the chorus by definition)
    let bridge = -1, best = -1;
    for (let g = 1; g < n; g++) { const d = ham(rows[g], orb.seed); if (d > best) { best = d; bridge = g; } }
    const out = [];
    for (let g = 0; g < n; g++) {
      const row = rows[g], d = dens[g];
      let r;
      if (d === 0) r = "rest";                                   // the automaton died here
      else if (row === orb.seed) r = "chorus";                   // every return to the seed is the hook
      else if (g === bridge && best > 0 && n > 3) r = "bridge";
      else if (gens[g] < introEnd && d <= med) r = "intro";
      else if (d >= peak && d > med) r = "chorus";
      else r = "verse";
      out.push(r);
    }
    if (n > 3 && out[n - 1] !== "bridge") out[n - 1] = "outro";  // land the plane
    return out;
  }

  // --------------------------------------------------------------------- apply
  // The whole thing: 24 bits + a base state -> a state buildEvents can render.
  // The base is an ordinary kernel state (K.track("acidhouse") and friends), so
  // a CA song inherits real instruments, a real mix and a real found layer, and
  // the automaton supplies only the composition.
  function apply(base, opts) {
    opts = opts || {};
    const E = opts.engine || engineRef();
    const seed = ((opts.seed >>> 0) & MASK) >>> 0;
    const rule = (opts.rule | 0) & 255;
    const keyPc = ((((opts.key | 0) % 12) + 12) % 12);
    const s = base;
    const orb = orbit(seed, rule);
    const gens = formGens(orb, opts.bars || 12);
    const rl = roles(orb, gens);

    // Vocabulary is named by GENERATION and sections are identified by POSITION,
    // because the reprise rule makes those two different: two sections can play
    // the same row, and they share its kit rather than carrying a copy each.
    const kits = {}, bassCells = {}, melodyCells = {}, sections = [], plan = [];
    for (let p = 0; p < gens.length; p++) {
      const g = gens[p], row = gen(orb, g), role = rl[p], m = ROLES[role] || ROLES.rest;
      const kn = "ca_k" + g, bn = "ca_b" + g, mn = "ca_m" + g;
      const kit = lensDrums(row), bc = lensBass(row), mc = lensMelody(row);
      if (m.drums && kit.ops.length) kits[kn] = kit;
      if (m.bass && bc.length) bassCells[bn] = bc;
      if (m.melody && mc.length) melodyCells[mn] = mc;
      const sec = {
        id: "ca" + p, name: role + " " + (p + 1), cycles: 1, pads: !!m.pads,
        bass: bassCells[bn] ? bn : "off",
        drums: kits[kn] ? kn : "off",
        melody: melodyCells[mn] ? mn : "off",
        found: { sourceId: null, role: "bed" }, fill: "off",
      };
      sections.push(sec);
      plan.push({ pos: p, gen: g, row, role, density: pop(row), dist: ham(row, seed), section: sec });
    }

    s.kits = Object.assign({}, s.kits, kits);
    s.bassCells = Object.assign({}, s.bassCells, bassCells);
    s.melodyCells = Object.assign({}, s.melodyCells, melodyCells);
    s.progression = progression(seed, keyPc, E);
    s.sections = sections;
    // THE RACK LAW (csd-engine VOICE_STREAM): per-voice rng isolation, so the
    // drum lens and the melody lens cannot move each other's draws.
    s.voiceStreams = true;
    // Nothing in a CA song is reharmonised: the progression IS the PLR walk, and
    // running theory.js over it would answer a question the automaton already
    // answered. (A state that arrives with reharm on would silently overwrite it.)
    if (s.theory) s.theory = Object.assign({}, s.theory, { reharm: false });
    return { state: s, orbit: orb, roles: rl, plan, word: word(seed), triads: triads(seed, keyPc).map(triadName) };
  }

  const api = { N, STEP, CELL_BEATS, MASK,
    at, lin, pop, ham, cells, fromCells, rot, ref, inv,
    step, orbit, gen, formLength, formGens,
    plr, word, triads, triadName, progression, PC, LETTER,
    lensDrums, lensBass, lensMelody, roles, ROLES, apply };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CsdCA = api;
})(typeof window !== "undefined" ? window : globalThis);
