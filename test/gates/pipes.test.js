// pipes.test.js — pure-node contract tests for engine/pipes.js (CsdPipes).
//   node test/gates/pipes.test.js
//
// No audio, no child processes: pipes are pure seeded transforms on the
// buildEvents bundle, so everything here is structural. The laws under test:
// byte identity (no state.pipes -> the JSON does not move), determinism
// (same seed same bytes; different seed differs for stochastic pipes), the
// per-pipe taste contracts (harmonize <=1 added voice locked to the sounding
// pitch-class set; echoCanon stays in [0,totalBeats) with delay capped at the
// chord bar; densityArc never drops kick/snare; expression pipes annotate
// WITHOUT moving/adding/removing notes; strum offsets pads < 0.1 beat; ghosts
// quieter than parents; octavePump copies on weak beats an octave up),
// unknown-id skip, and 3-pipe chain determinism. Exit 1 on any failure.
"use strict";
const P = require("../../engine/pipes.js");

let fails = 0;
function t(name, ok, note) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(34)}${note ? " " + note : ""}`);
  if (!ok) fails++;
}
const J = (x) => JSON.stringify(x);
const parsePch = (s) => { const [o, ss] = String(s).split("."); return parseInt(o, 10) * 12 + parseInt(ss, 10); };

// ---------- synthetic bundle: 2 chord bars, bass line, 2-phrase melody, drum bars ----------
function bundle() {
  const pitched = [], drums = [];
  // two pad chords (Am, F triads), 8 beats each
  [["7.09", "8.00", "8.04"], ["7.05", "7.09", "8.00"]].forEach((c, ci) =>
    c.forEach((p) => pitched.push({ voice: "pad", beat: ci * 8, dur: 8, pch: p, amp: 0.2 })));
  // bass: mix of strong (0,4,8,12) and weak (1,3,6,9,11,14) beats
  [[0, "5.09"], [1, "5.09"], [3, "5.04"], [4, "5.09"], [6, "5.07"],
   [8, "5.05"], [9, "5.05"], [11, "5.00"], [12, "5.05"], [14, "5.07"]]
    .forEach(([b, p]) => pitched.push({ voice: "bass", beat: b, dur: 0.5, pch: p, amp: 0.22 }));
  // melody: phrase 1 spans beats 0..4 (end 4), phrase 2 starts at 6 — gap 2 >= 1 splits
  [[0, 1, "8.09"], [1, 0.5, "8.11"], [1.5, 0.5, "9.00"], [2, 2, "8.09"],
   [6, 1, "9.00"], [7, 0.5, "8.11"], [7.5, 0.5, "8.09"], [8, 2, "8.05"], [10, 1.75, "8.09"]]
    .forEach(([b, d, p]) => pitched.push({ voice: "melody", beat: b, dur: d, pch: p, amp: 0.14 }));
  // one drum bar tiled twice: kick 0/4, snare 2/6, hats every beat
  for (let bar = 0; bar < 2; bar++) {
    const b0 = bar * 8;
    [0, 4].forEach((o) => drums.push({ drum: "kick", beat: b0 + o, dur: 0.3, amp: 0.5 }));
    [2, 6].forEach((o) => drums.push({ drum: "snare", beat: b0 + o, dur: 0.3, amp: 0.4 }));
    for (let i = 0; i < 8; i++) drums.push({ drum: "hat", beat: b0 + i, dur: 0.1, amp: 0.18 });
  }
  return { bpm: 120, totalBeats: 16, pitched, drums, found: [], sfx: [] };
}
const run = (pipes, seed) => P.apply(bundle(), { seed, pipes });

// ---------- 0) identity law: no pipes -> same object, byte-identical ----------
{
  const b = bundle(), ref = J(bundle());
  const out = P.apply(b, { seed: 5 });
  t("identity_absent", out === b && J(out) === ref, "no state.pipes: same object, same bytes");
  const b2 = bundle();
  t("identity_empty", P.apply(b2, { seed: 5, pipes: [] }) === b2 && J(b2) === ref);
}

// ---------- 1) determinism: same seed same bytes; different seed differs ----------
{
  const STOCH = [
    { id: "harmonize", prob: 0.6 }, { id: "echoCanon", prob: 0.6 }, { id: "ghost", prob: 0.5 },
    { id: "densityArc" }, { id: "octavePump", prob: 0.5 }];
  for (const spec of STOCH) {
    const a = J(run([spec], 7)), b = J(run([spec], 7));
    // "differs" is probabilistic per seed pair — any of a few seeds differing proves the stream is live
    const diff = [8, 9, 10, 11].some((s) => J(run([spec], s)) !== a);
    t(`determinism_${spec.id}`, a === b && diff, "seed7==seed7, some other seed differs");
  }
}

// ---------- 2) harmonize: <=1 added voice per note, pcs from the sounding set, quieter ----------
{
  const before = bundle(), out = run([{ id: "harmonize", prob: 1 }], 7);
  const nMel = before.pitched.filter((e) => e.voice === "melody").length;
  const harms = out.pitched.filter((e) => e.harm);
  const pcsAt = (b) => P.soundingPcs(before.pitched, b);
  t("harmonize_adds", harms.length > 0 && harms.length <= nMel, `${harms.length} added for ${nMel} notes`);
  t("harmonize_one_per_note", harms.length === new Set(harms.map((h) => h.beat)).size, "distinct parent onsets");
  t("harmonize_pcs_locked", harms.every((h) => pcsAt(h.beat).has(((parsePch(h.pch) % 12) + 12) % 12)));
  t("harmonize_quieter", harms.every((h) => {
    const parent = before.pitched.find((e) => e.voice === "melody" && e.beat === h.beat);
    return parent && h.amp < parent.amp && h.amp > 0;
  }));
}

// ---------- 3) echoCanon: copies in [0,totalBeats), delay capped at the chord bar ----------
{
  const out = run([{ id: "echoCanon", prob: 1, delay: 20 }], 7);   // asks for 20, must cap at chordEvery||8
  const echoes = out.pitched.filter((e) => e.echo);
  const orig = bundle().pitched.filter((e) => e.voice === "melody");
  t("echo_exists", echoes.length > 0, `${echoes.length} copies`);
  t("echo_in_window", echoes.every((e) => e.beat >= 0 && e.beat < out.totalBeats));
  t("echo_delay_capped", echoes.every((e) => orig.some((m) => Math.abs(e.beat - m.beat - 8) < 1e-9)),
    "every copy sits exactly chordBar(8) after a source note");
}

// ---------- 4) strum: pad onsets offset by < 0.1 beat, count unchanged ----------
{
  const before = bundle(), out = run([{ id: "strum" }], 7);
  const bp = before.pitched.filter((e) => e.voice === "pad");
  const op = out.pitched.filter((e) => e.voice === "pad");
  const offs = op.map((e) => Math.min(...bp.map((o) => Math.abs(e.beat - o.beat))));
  t("strum_count", op.length === bp.length);
  t("strum_small_offsets", offs.every((o) => o < 0.1), `max offset ${Math.max(...offs).toFixed(3)}`);
  t("strum_rolled", new Set(op.map((e) => e.beat)).size > new Set(bp.map((e) => e.beat)).size,
    "chord voices no longer share one onset");
}

// ---------- 5) ghost: quieter than parents, before them, in-window ----------
{
  const out = run([{ id: "ghost", prob: 1 }], 7);
  const ghosts = out.pitched.filter((e) => e.ghost);
  const parents = bundle().pitched.filter((e) => e.voice === "bass");
  t("ghost_exists", ghosts.length > 0, `${ghosts.length} ghosts`);
  t("ghost_quieter", ghosts.every((g) => {
    const par = parents.find((b) => Math.abs(b.beat - 0.25 - g.beat) < 1e-9 || (b.beat === 0 && g.beat === 0));
    return par ? g.amp < par.amp : false;
  }));
  t("ghost_in_window", ghosts.every((g) => g.beat >= 0 && g.beat < out.totalBeats));
}

// ---------- 6) callResponse: phrase 1 untouched, phrase 2 flipped, counts fixed ----------
{
  const before = bundle(), out = run([{ id: "callResponse" }], 7);
  const bm = before.pitched.filter((e) => e.voice === "melody");
  const om = out.pitched.filter((e) => e.voice === "melody");
  const p1 = om.filter((e) => e.beat < 4), b1 = bm.filter((e) => e.beat < 4);
  const p2 = om.filter((e) => e.beat >= 6), b2 = bm.filter((e) => e.beat >= 6);
  t("cr_counts", om.length === bm.length);
  t("cr_call_untouched", J(p1) === J(b1));
  t("cr_response_flipped", p2.every((e, i) =>
    parsePch(e.pch) === parsePch(b2[i].pch) - 12 && e.pan != null && e.amp < b2[i].amp));
}

// ---------- 7) densityArc: kick/snare sacred, pitched/hats may thin, amps in (0,1] ----------
{
  const before = bundle(), out = run([{ id: "densityArc", floor: 0.3 }], 7);
  const count = (l, d) => l.filter((e) => e.drum === d).length;
  t("arc_kick_sacred", count(out.drums, "kick") === count(before.drums, "kick"));
  t("arc_snare_sacred", count(out.drums, "snare") === count(before.drums, "snare"));
  t("arc_thins", out.pitched.length + count(out.drums, "hat") <
    before.pitched.length + count(before.drums, "hat"), "something actually dropped at floor=0.3");
  t("arc_amps_legal", out.pitched.concat(out.drums).every((e) => e.amp > 0 && e.amp <= 1));
}

// ---------- 8) expression pipes: annotations only — no note moved/added/removed ----------
{
  const sig = (l) => J(l.map((e) => [e.voice || e.drum, e.beat, e.pch || null, e.amp, e.dur]));
  for (const spec of [{ id: "sweepArc" }, { id: "vibratoSwell" }, { id: "throwFx" }]) {
    const before = bundle(), out = run([spec], 7);
    t(`expr_neutral_${spec.id}`,
      sig(out.pitched) === sig(before.pitched) && sig(out.drums) === sig(before.drums),
      "beats/pch/amp/dur/counts all byte-stable");
  }
  const sw = run([{ id: "sweepArc" }], 7);
  const mel = sw.pitched.filter((e) => e.voice === "melody");
  t("sweep_writes", mel.every((e) => e.cutoffMul >= 0.25 && e.cutoffMul <= 4), "cutoffMul on every melody note, in 0.25–4");
  const vs = run([{ id: "vibratoSwell" }], 7);
  const long = vs.pitched.filter((e) => e.dur >= 1.5);
  t("vib_writes", long.length > 0 && long.every((e) => e.vib && e.vib.depth > 0 && e.vib.rate > 0));
  const tf = run([{ id: "throwFx" }], 7);
  const thrown = tf.pitched.filter((e) => e.rsendMul);
  t("throw_writes", thrown.length === 2 && thrown.every((e) => e.rsendMul > 1 && e.dsendMul > 1),
    "exactly the 2 phrase-final notes");
  t("throw_last_notes", thrown.every((e) => e.beat === 2 || e.beat === 10), "beats 2 and 10 end the phrases");
}

// ---------- 9) octavePump: copies on weak beats, an octave up, quieter ----------
{
  const out = run([{ id: "octavePump", prob: 1 }], 7);
  const pumps = out.pitched.filter((e) => e.pump);
  const parents = bundle().pitched.filter((e) => e.voice === "bass");
  t("pump_exists", pumps.length > 0, `${pumps.length} copies`);
  t("pump_weak_beats", pumps.every((e) => ((e.beat % 2) + 2) % 2 !== 0));
  t("pump_octave_up", pumps.every((e) => {
    const par = parents.find((b) => b.beat === e.beat);
    return par && parsePch(e.pch) === parsePch(par.pch) + 12 && e.amp < par.amp;
  }));
}

// ---------- 10) unknown id: skipped clean — bundle byte-identical ----------
{
  const b = bundle();
  t("unknown_id_skip", J(P.apply(b, { seed: 7, pipes: [{ id: "flanger9000" }] })) === J(bundle()));
}

// ---------- 11) chain composability: 3 pipes, still deterministic ----------
{
  const chain = [{ id: "harmonize", prob: 0.7 }, { id: "echoCanon", prob: 0.7 }, { id: "vibratoSwell" }];
  const a = J(run(chain, 11)), b = J(run(chain, 11));
  t("chain_deterministic", a === b);
  t("chain_differs_by_seed", J(run(chain, 12)) !== a);
  // unknown id inside a chain doesn't disturb its neighbors' streams
  const withDud = [chain[0], { id: "nope" }, chain[1]];
  const c1 = J(run(withDud, 11)), c2 = J(run(withDud, 11));
  t("chain_dud_stable", c1 === c2);
  const all = run(chain, 11);
  t("chain_amps_legal", all.pitched.concat(all.drums).every((e) => e.amp > 0 && e.amp <= 1));
}

console.log(fails ? `\n${fails} FAILURE${fails > 1 ? "S" : ""}` : "\nALL PASS");
process.exit(fails ? 1 : 0);
