// fugue.js — THE SMALLEST THING THAT MAKES A FUGUE.
//
// A fugue is not a form you fill in. It is ONE IDEA and a list of the ways it
// comes back. So the whole document is:
//
//     subject   a short line, 4-16 notes, in ladder degrees
//     entries   [{ at, voice, transform, shift }]
//
// and everything else is derived. That is the same shape engine/ca.js has —
// one datum plus a word in a small group of involutions — pointed at melody
// instead of at rhythm, which is why the two pages are siblings rather than
// rivals.
//
// THE GROUP. Retrograde and inversion are each their own inverse, and they
// commute, so {1, R, I, RI} is the Klein four-group: there are exactly FOUR
// ways to restate a subject by symmetry, and every fugue in the literature uses
// some of those four. Augmentation and diminution are not involutions — they are
// a scaling, and A·D = 1 — so the full vocabulary is a Klein group crossed with a
// time scale. Six transforms, and that is genuinely all of them.
//
// THE LADDER. Degrees are 0..7: the four notes of the chord's own lead voicing,
// twice, an octave apart. A subject written in ladder degrees FOLLOWS THE
// HARMONY and survives a change of progression, which is the same reason
// csd-engine's phrase cells are written that way. It also makes the classical
// "answer at the fifth" fall out as +2 degrees, because the voicing's third slot
// IS the fifth — the tonal answer is one integer.
//
// NO NEW INTERPRETER. The output is `state.melodyCells` (two upper voices, an
// octave apart inside one cell) plus a `counter` voice carrying the third an
// octave below. Both are vocabulary csd-engine already speaks, so a fugue is an
// ordinary state and every downstream pass — MIDI export, the live walk, the
// mixer — treats it as one.

(function (root) {
  "use strict";

  const LADDER = 8;                    // 4 chord tones x 2 octaves
  const clampDeg = (d) => Math.max(0, Math.min(LADDER - 1, Math.round(d)));

  // ------------------------------------------------------------- the subject
  // A note is [beat, dur, degree]. The default is a turning stepwise line that
  // leaves the tonic and comes back to it — the shape most real subjects have,
  // because a subject has to be recognisable when it returns underneath
  // something else.
  const DEFAULT_SUBJECT = [
    [0, 0.5, 0], [0.5, 0.5, 1], [1, 0.5, 2], [1.5, 0.5, 1],
    [2, 0.5, 3], [2.5, 0.5, 2], [3, 0.5, 4], [3.5, 0.5, 2],
  ];
  const spanOf = (s) => s.reduce((m, n) => Math.max(m, n[0] + n[1]), 0);

  // ------------------------------------------------------------- the transforms
  // Six, and that is all of them: the Klein four-group {1,R,I,RI} on pitch and
  // time, crossed with a scaling {A, D} whose product is the identity.
  const TRANSFORMS = ["subject", "inversion", "retrograde", "retro-inversion", "augmentation", "diminution"];

  // I — mirror the line about its OWN axis (the midpoint of its range) rather
  // than about a fixed degree, so an inverted subject stays inside the ladder and
  // keeps its size. Inverting about 7 would shove a low subject off the top.
  function invert(s) {
    if (!s.length) return s;
    let lo = 99, hi = -1;
    for (const n of s) { lo = Math.min(lo, n[2]); hi = Math.max(hi, n[2]); }
    const axis = lo + hi;
    return s.map(([b, d, g]) => [b, d, clampDeg(axis - g)]);
  }
  // R — the line backwards IN TIME. Each note's new onset is measured from the
  // end, so the last note starts the restatement and durations are preserved.
  function retrograde(s) {
    const span = spanOf(s);
    return s.map(([b, d, g]) => [+(span - b - d).toFixed(4), d, g])
      .sort((a, b) => a[0] - b[0]);
  }
  const scale = (s, k) => s.map(([b, d, g]) => [+(b * k).toFixed(4), +(d * k).toFixed(4), g]);

  // TRANSPOSITION MOVES THE WHOLE LINE OR NOTHING. Clamping each note into the
  // ladder — which is what this did — silently changes the SHAPE, and the shape
  // is the only thing that makes a restatement recognisable as the subject. With
  // the stock subject, +2 was fine but the voice offset turned degrees 3 and 4
  // into the same slot, so the "subject" the first voice played was a different
  // tune from the one you drew, and nothing said so.
  //
  // So: shift by whole octaves (4 ladder slots) until the line fits, and if no
  // placement fits, refuse and return it untransposed. A transposition that does
  // not fit is a fact about the subject being too wide, not a licence to bend it.
  function shiftDeg(s, n) {
    if (!n || !s.length) return s.map((x) => x.slice());
    let lo = 99, hi = -1;
    for (const g of s.map((x) => x[2])) { lo = Math.min(lo, g); hi = Math.max(hi, g); }
    let k = n;
    while (hi + k > LADDER - 1 && lo + k - 4 >= 0) k -= 4;
    if (hi + k > LADDER - 1 || lo + k < 0) return s.map((x) => x.slice());
    return s.map(([b, d, g]) => [b, d, g + k]);
  }
  // does a transposition survive intact? the page prints this rather than
  // pretending every interval is available
  const shiftFits = (s, n) => shiftDeg(s, n).some((x, i) => x[2] !== s[i][2]) || !n;

  function transform(s, name) {
    switch (name) {
      case "inversion": return invert(s);
      case "retrograde": return retrograde(s);
      case "retro-inversion": return retrograde(invert(s));
      case "augmentation": return scale(s, 2);
      case "diminution": return scale(s, 0.5);
      default: return s.map((n) => n.slice());
    }
  }

  // ------------------------------------------------------------------ the plan
  // THE EXPOSITION IS A RULE, NOT A LIST. Each voice enters one subject-length
  // after the one before (or sooner, under stretto), alternating SUBJECT and
  // ANSWER — the answer being the subject up a fifth, which on the ladder is
  // exactly +2 degrees. That alternation is the only thing that makes an
  // exposition an exposition.
  //
  // `overlap` is stretto as a fraction: 1 = each voice waits for the last to
  // finish, 0.5 = it comes in halfway through, which is the device every fugue
  // saves for the end.
  function plan(opts) {
    opts = opts || {};
    const subject = opts.subject || DEFAULT_SUBJECT;
    // THREE IS THE CEILING and it is a fact about the registers available, not a
    // taste: melody + counter is two, and the answer's transposition makes the
    // third. A fourth voice would need a fourth register and would have to clamp.
    const voices = Math.max(2, Math.min(3, opts.voices || 3));
    const overlap = opts.overlap == null ? 1 : Math.max(0.25, Math.min(1, opts.overlap));
    const answer = opts.answer == null ? 2 : opts.answer | 0;
    const span = spanOf(subject);
    const gap = span * overlap;
    const later = opts.later || [];        // transforms for the entries AFTER the exposition
    const out = [];
    for (let v = 0; v < voices; v++) {
      out.push({ at: +(v * gap).toFixed(4), voice: v,
        transform: "subject", shift: v % 2 ? answer : 0, role: v % 2 ? "answer" : "subject" });
    }
    // the later entries: one per named transform, stacked after the exposition,
    // rotating through the voices so the idea keeps changing register
    let t = voices * gap, end = (voices - 1) * gap + span;
    later.forEach((name, i) => {
      const s = transform(subject, name);
      out.push({ at: +t.toFixed(4), voice: (voices - 1 - (i % voices)), transform: name, shift: 0, role: name });
      end = Math.max(end, t + spanOf(s));      // an AUGMENTED entry is twice as long as
      t += spanOf(s) * overlap;                // the step that follows it
    });
    // `total` is where the last note STOPS, not where the last entry starts. An
    // augmented entry runs twice the subject's length, so accumulating only the
    // stepped gaps left it finishing past the end of its own piece — the entry
    // map then drew a bar wider than its track and the page scrolled sideways.
    return { subject, voices, overlap, answer, span, entries: out, total: +Math.max(t, end).toFixed(4) };
  }

  // --------------------------------------------------------------- the cells
  // VOICES ARE SEPARATED BY A REAL OCTAVE, NEVER BY THE LADDER. The first cut
  // gave voice 0 a +4 slot offset to put it in the ladder's upper octave — and
  // any subject reaching degree 4 or above then clamped, which turned two
  // different degrees into the same slot and destroyed the subject. The ladder is
  // eight slots; it cannot hold three lines an octave apart, and pretending it
  // can is how a fugue quietly stops being one.
  //
  // So voices 0 and 1 share the melody cell IN THE SAME REGISTER — which is
  // exactly what a two-part invention is, and the answer's transposition is what
  // tells them apart — and voice 2 rides the `counter` voice, whose `octave: -1`
  // is a genuine octave outside the ladder. Three voices, three intact lines.
  // That is the ceiling, and it is stated rather than clamped: a fourth voice
  // would need a fourth register the engine does not offer here.
  //
  // A cell is [beat, dur, leadIndex, octShift] — the shipped phrase-cell format —
  // so nothing here needs a new interpreter, and a fugue is an ordinary state.
  function cells(p, cb) {
    cb = cb || 8;
    const upper = [], lower = [], dropped = [];
    for (const e of p.entries) {
      const notes = shiftDeg(transform(p.subject, e.transform), e.shift);
      const dest = e.voice <= 1 ? upper : lower;
      for (const [b, d, g] of notes) {
        const at = e.at + b;
        // A NOTE PAST THE END OF THE CELL IS A BUG, NOT A TRIM. It used to be
        // dropped in silence, which is how a three-voice exposition rendered as
        // two. The chord bar is sized to the plan now, so this can only fire if a
        // caller overrode chordEvery — and then it is counted and reported.
        if (at >= cb) { dropped.push(at); continue; }
        dest.push([+at.toFixed(4), Math.min(d, cb - at), g % 4, g >= 4 ? 1 : 0]);
      }
    }
    const bySort = (a, b) => a[0] - b[0] || a[2] - b[2];
    return { upper: upper.sort(bySort), lower: lower.sort(bySort), dropped };
  }

  // ----------------------------------------------------------------- the state
  // One section per ENTRY GROUP is wrong for a fugue — the piece is continuous.
  // So it is one long section repeated: the cell spans a chord bar and the
  // progression walks under it, which is exactly how a real fugue works (the
  // subject is fixed, the harmony moves beneath it).
  function build(base, opts) {
    opts = opts || {};
    const E = opts.engine || (typeof module !== "undefined" && module.exports
      ? require("./csd-engine.js") : root.CsdEngine);
    const p = plan(opts);
    // THE CHORD BAR IS THE EXPOSITION, not the default eight beats. A cell spans
    // one chord bar, and a three-voice exposition spans three subject-lengths —
    // so with the stock cb=8 the third voice's entry landed past the end of the
    // cell and was dropped silently. The bar is sized to the plan (and rounded to
    // an even number of beats so the harmony still turns over on a downbeat).
    const want = opts.chordEvery || Math.ceil(p.total / 2) * 2;
    const cb = Math.max(4, Math.min(64, Math.round(want)));
    const c = cells(p, cb);
    const s = base;
    s.chordEvery = cb;
    s.melodyCells = Object.assign({}, s.melodyCells, { fug_upper: c.upper, fug_lower: c.lower });
    s.voiceStreams = true;
    const cycles = Math.max(1, Math.min(8, opts.cycles || 2));
    s.sections = [{
      id: "fug", name: "fugue", cycles, pads: !!opts.pads,
      bass: opts.pedal ? "pedal" : "off",
      drums: "off",                                   // a fugue has no drum kit
      melody: "fug_upper",
      counter: c.lower.length ? { pattern: "fug_lower", octave: -1 } : null,
      found: { sourceId: null, role: "bed" }, fill: "off",
    }];
    if (s.theory) s.theory = Object.assign({}, s.theory, { reharm: false });
    // A FUGUE HAS NO PERCUSSION, and `drums: "off"` is not enough to say so:
    // `state.thunk` puts a whisper-level tom under a fraction of LEAD notes, so a
    // drumless section still rendered 49 tom hits. Off here, explicitly, because
    // the base is an ordinary anchor and may carry anything.
    s.thunk = null;
    s.perc = null;
    // RENDER THE CELLS AS WRITTEN. csd-engine's note() mutates every phrase cell
    // for humanity — 9% drop, 11% half-beat push, 9% octave flip — which is right
    // for a lick and destroys a fugue subject. Imitation only works if the thing
    // imitated arrives intact. (The tape's microtiming still applies; that is
    // performance, not identity.)
    s.exactCells = true;
    return { state: s, plan: p, cells: c, engine: E };
  }

  const api = { LADDER, DEFAULT_SUBJECT, TRANSFORMS, spanOf,
    invert, retrograde, scale, shiftDeg, shiftFits, transform, plan, cells, build };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CsdFugue = api;
})(typeof window !== "undefined" ? window : globalThis);
