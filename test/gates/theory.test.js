// theory.test.js — pure-node gates for the harmony brain (no audio, no deps).
//   node test/gates/theory.test.js
//
// Gates: determinism (same seed → deep-equal, different seed → different),
// the buildEvents shape contract (pads 4..6 / bass r5,r6,f6 / lead[4], all
// valid oct.pc pch strings), voice-leading quality (avg per-voice motion
// between adjacent voicings < 3 semitones at adventure .3), adventure
// monotonicity (non-diatonic pc occurrences non-decreasing across the gate
// levels, averaged over seeds), the handrail (first chord tonic-rooted),
// every MODE producing valid output, and reharmonize preserving chord count
// on real PROGRESSIONS entries (required from csd-engine).
"use strict";
const T = require("../../engine/theory.js");
const E = require("../../engine/csd-engine.js");

let fails = 0;
function gate(name, fn) {
  try { fn(); console.log("PASS  " + name); }
  catch (e) { fails++; console.log("FAIL  " + name + " — " + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// a valid pch: "o.pp" with pc 0..11, round-tripping through the theory math
function validPch(s) {
  if (!/^\d+\.\d\d$/.test(s)) return false;
  const pc = parseInt(String(s).split(".")[1], 10);
  return pc < 12 && T.toPch(T.parsePch(s)) === s;
}
// the exact shape buildEvents consumes
function checkShape(prg, wantN) {
  assert(Array.isArray(prg.chords) && prg.chords.length >= 1, "chords[] missing");
  if (wantN != null) assert(prg.chords.length === wantN, "chord count " + prg.chords.length + " !== " + wantN);
  for (const ch of prg.chords) {
    assert(typeof ch.name === "string" && ch.name.length, "chord name missing");
    assert(Array.isArray(ch.pads) && ch.pads.length >= 4 && ch.pads.length <= 6, "pads must be 4..6, got " + (ch.pads && ch.pads.length));
    ch.pads.forEach(p => assert(validPch(p), "bad pad pch " + p));
    assert(ch.bass && ["r5", "r6", "f6"].every(k => validPch(ch.bass[k])), "bad bass " + JSON.stringify(ch.bass));
    assert(Array.isArray(ch.lead) && ch.lead.length === 4, "lead must have exactly 4 entries");
    ch.lead.forEach(p => assert(validPch(p), "bad lead pch " + p));
  }
}
function avgMotion(chords) {   // mean per-voice semitone motion, adjacent voicings
  let tot = 0, n = 0;
  for (let i = 1; i < chords.length; i++) {
    const a = chords[i - 1].pads.map(T.parsePch), b = chords[i].pads.map(T.parsePch);
    for (let v = 0; v < Math.min(a.length, b.length); v++) { tot += Math.abs(a[v] - b[v]); n++; }
  }
  return n ? tot / n : 0;
}

// 1) determinism — the standing law
gate("determinism_same_seed", () => {
  const o = { mode: "dorian", root: 2, adventure: 0.6, color: 0.7, bars: 8, seed: 11, voicing: "drop2" };
  assert(JSON.stringify(T.progress(o)) === JSON.stringify(T.progress(o)), "same seed diverged");
  const r1 = T.reharmonize(E.PROGRESSIONS.royal_road, { adventure: 0.5, seed: 9 });
  const r2 = T.reharmonize(E.PROGRESSIONS.royal_road, { adventure: 0.5, seed: 9 });
  assert(JSON.stringify(r1) === JSON.stringify(r2), "reharmonize same seed diverged");
});
gate("determinism_different_seed", () => {
  const mk = s => JSON.stringify(T.progress({ mode: "aeolian", root: 0, adventure: 0.5, color: 0.5, bars: 8, seed: s }));
  assert(mk(1) !== mk(2), "seeds 1 and 2 produced identical progressions");
});

// 2) shape contract across knob settings and styles
gate("shape_contract", () => {
  for (const style of ["close", "open", "drop2", "quartal", "cluster"])
    for (const [adv, col] of [[0.1, 0], [0.4, 0.4], [0.65, 0.6], [0.95, 1]]) {
      const prg = T.toProgression(T.progress({ mode: "ionian", root: 7, adventure: adv, color: col, bars: 6, seed: 4, voicing: style }), "t");
      checkShape(prg, 6);
    }
});

// 3) voice-leading quality — minimal motion at modest adventure
gate("voice_leading_motion", () => {
  for (const mode of ["ionian", "aeolian"])
    for (let seed = 1; seed <= 8; seed++) {
      const ch = T.progress({ mode, root: 0, adventure: 0.3, color: 0.4, bars: 8, seed });
      const m = avgMotion(ch);
      assert(m < 3, mode + " seed " + seed + " avg motion " + m.toFixed(2) + " >= 3 semitones");
    }
});

// 4) adventure monotonicity — more adventure, never less chromaticism (avg over seeds)
gate("adventure_monotonic", () => {
  const dia = new Set(T.MODES.aeolian);
  const chroma = ch => ch.reduce((c, x) => c + x.pads.filter(p => !dia.has(T.parsePch(p) % 12)).length, 0);
  const levels = [0.1, 0.4, 0.65, 0.9], avg = [];
  for (const adv of levels) {
    let sum = 0;
    for (let seed = 1; seed <= 12; seed++) sum += chroma(T.progress({ mode: "aeolian", root: 0, adventure: adv, color: 0.5, bars: 8, seed }));
    avg.push(sum / 12);
  }
  for (let k = 1; k < avg.length; k++) assert(avg[k] >= avg[k - 1] - 1e-9, "avg chroma fell " + avg[k - 1].toFixed(2) + " -> " + avg[k].toFixed(2) + " at adventure " + levels[k]);
  assert(avg[3] > avg[0], "adventure 0.9 no more chromatic than 0.1");
});

// 5) the handrail — first chord is tonic-rooted, and the root actually sounds
gate("handrail_first_chord_tonic", () => {
  for (const mode of ["ionian", "aeolian", "dorian", "hijaz", "minPent"])
    for (let seed = 1; seed <= 6; seed++) {
      const prg = T.toProgression(T.progress({ mode, root: 7, adventure: 0.9, color: 0.8, bars: 8, seed }), "t");
      const c0 = prg.chords[0];
      assert(T.parsePch(c0.bass.r5) % 12 === 7, mode + " seed " + seed + " first bass not tonic");
      assert(c0.pads.some(p => T.parsePch(p) % 12 === 7), mode + " seed " + seed + " tonic missing from first pads");
    }
});

// 6) every mode produces valid output
gate("all_modes_valid", () => {
  for (const m of Object.keys(T.MODES)) {
    const prg = T.toProgression(T.progress({ mode: m, root: 5, adventure: 0.4, color: 0.6, bars: 4, seed: 3 }), m);
    checkShape(prg, 4);
  }
});

// 7) reharmonize preserves chord count on real PROGRESSIONS entries
gate("reharmonize_real_progressions", () => {
  for (const name of ["royal_road", "four_chords", "ii_v_i", "canon", "blues_12", "drone_min", "neosoul"]) {
    const src = E.PROGRESSIONS[name];
    const out = T.reharmonize(src, { adventure: 0.5, color: 0.5, seed: 6 });
    checkShape(out, src.chords.length);
  }
});

// 8) chordFromDegree spot checks — the scale-degree math itself
gate("chord_from_degree", () => {
  const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), m + ": " + JSON.stringify(a));
  eq(T.chordFromDegree("ionian", 0).ivs, [0, 4, 7], "I triad");
  const g7 = T.chordFromDegree("ionian", 4, { ext: "7" });
  eq(g7.ivs, [0, 4, 7, 10], "V7 intervals");   // dom7 stack on degree 5
  assert(g7.name === "G7", "V7 of C should be G7, got " + g7.name);
  eq(T.chordFromDegree("harmonicMinor", 0, { ext: "7" }).ivs, [0, 3, 7, 11], "harm-minor tonic mMaj7");
  assert(T.chordFromDegree("ionian", 0, { ext: "quartal" }).ivs.length === 4, "quartal is 4 tones");
  eq(T.chordFromDegree("ionian", 0, { ext: "sus4" }).ivs, [0, 5, 7], "sus4");
});

// 9) lead() honors styles, voice counts, and the pad register
gate("lead_styles_register", () => {
  for (const style of ["close", "open", "drop2", "quartal", "cluster"])
    for (const voices of [4, 5, 6]) {
      let prev = null;
      for (const pcs of [[0, 4, 11, 7], [9, 0, 7, 4], [5, 9, 4, 0], [7, 11, 5, 2]]) {
        prev = T.lead(prev, pcs, { style, voices });
        assert(prev.length === voices, style + " wanted " + voices + " voices, got " + prev.length);
        prev.forEach(p => { const a = T.parsePch(p);
          assert(validPch(p) && a >= 84 && a <= 105, style + " voice " + p + " out of pad register"); });
        assert(prev.some(p => T.parsePch(p) % 12 === pcs[0]), style + " lost the root");
      }
    }
});

console.log(fails ? "\nFAILURES" : "\nALL PASS");
process.exit(fails ? 1 : 0);
