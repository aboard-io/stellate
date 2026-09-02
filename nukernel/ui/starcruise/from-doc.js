// nukernel/ui/starcruise/from-doc.js — THE NUKERNEL DOOR INTO THE STARCRUISE
// CREATURES. New file, 2026-09-02; everything beside it in this folder is a
// verbatim port of `f0f9d89:app/starcruise/*` and this is the only piece that
// had to be written, because the thing the old tree fed the creatures does not
// exist here.
//
// Paul, 2026-09-01, on the screensaver: *"screensaver is just a bunch of stars.
// It should be the little aliens dancing, not the infinite wandering."* And,
// on the plan that first said to redraw them in 2D: *"Why not three js? It's
// fine. Don't reinvent."* So the real aliens came back, unchanged, and this
// file is the adapter that keeps them unchanged.
//
// WHAT WAS MISSING. `traits.js:139 traitsFromGenre(K, V, genreOrWeights, seed)`
// wants `window.GenreKernel` + `window.GenreVerifier.features(state)` — a
// 23-float genre vector and a full engine state. Neither exists in nukernel
// (ui/deps.js reads `window.NuKernel` / `window.NuGenres` instead, and there is
// no verifier at all). Rather than fork traits.js — 729 lines of tuned mapping
// that IS the creative heart — this file builds the two things traits.js asks
// for out of the nukernel document + genre row and hands them in through the
// SAME K/V shape. traits.js is byte-identical to the commit it came from.
//
// THE OTHER MISSING HALF is `bridge.js:167 buildEventPlan` — per-bar loudness
// and per-voice note buckets. `ui/derive.js songBars` already returns per-bar
// `ev` buckets with a bar-local `off`; `planFromDoc` re-buckets those by BAND
// MEMBER and reduces the same weighted loudness bridge.js:226-240 did (1.4 for
// the kit, 1.0 for the bass, 0.8 for everything else — its comment: "weighted
// toward the rhythm section since that's what drives the room").
//
// ONE OWNER PER FACT: nothing here re-spells a word that a table already owns.
// The machine kits come from `fields.js DRUMKITS`, the instrument families from
// `instruments.js familyOf`, the parts from the document's own `cast.part`.

import { DRUMKITS, familyOf } from "../deps.js";
import { traitsFromGenre } from "./traits.js";

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const count1 = (a) => (Array.isArray(a) ? a.reduce((n, v) => n + (v ? 1 : 0), 0) : 0);

/* WHICH KITS ARE PLAYED AND WHICH ARE MACHINES. The words are `fields.js`
   DRUMKITS' own keys, read by reference at load; this table only says which
   SIDE each of them falls on, which is a fact no table in the tree states.
   Anything DRUMKITS names that is not listed here reads as played, so a new
   kit is acoustic until somebody says otherwise. */
const MACHINE_KIT = { electronic: 1, tr808: 1, tr909: 1, tr606: 1, cr78: 1 };
/* ...AND WHICH INSTRUMENT FAMILIES ARE PLAYED. The words are the keys of
   `instruments.js STRIPS`, reached through `familyOf`; again only the side is
   new. `dirty`, `lead` and `pad` are the three that read as a machine. */
const MACHINE_FAM = { dirty: 1, lead: 1, pad: 1 };

/* ---- THE 23-FLOAT VECTOR, READ OFF THE ROW AND THE DOCUMENT --------------
   Only the features the nukernel row HONESTLY states are emitted. traits.js's
   own `featuresFor` merges whatever it gets over its NEUTRAL vector, so an
   unstated axis stays neutral rather than being invented here — absent is the
   only spelling of a default. Units match the old catalog's (traits.js NR):
   drum densities are HITS PER BEAT off the sixteen-step kit rows, swing and
   humanize are the row's own 0..1 numbers, bpm is a bpm. */
export function featuresFromRow(row, doc) {
  row = row || {}; doc = doc || {};
  const f = {};
  const time = doc.time || {};
  f.bpm = +(time.bpm || row.bpm || 120);
  if (row.swing != null) f.swing = +row.swing;
  if (row.humanize != null) f.humanize = clamp01(+row.humanize);

  const kit = row.kit || {};
  const k = count1(kit.k), s = count1(kit.s), h = count1(kit.h);
  const other = Object.keys(kit).reduce(
    (n, key) => n + (key === "k" || key === "s" || key === "h" ? 0 : count1(kit[key])), 0);
  if (k + s + h + other > 0) {
    f.drumDensity = (k + s + h + other) / 4;   // four beats to the sixteen-step row
    f.hatDensity = h / 4;
    f.snareBalance = s / 4;
  } else if (row.silent || row.kit) { f.drumDensity = 0; f.hatDensity = 0; f.snareBalance = 0; }

  /* SEVENTH — the share of the progression that names a seventh. The row's own
     `prog` is the owner of the chord qualities; `q` is its word. */
  const prog = Array.isArray(row.prog) ? row.prog : [];
  if (prog.length) f.seventh = prog.filter((c) => /7|9|11|13/.test(String(c && c.q || ""))).length / prog.length;

  /* WASH — how much of the band is holding rather than playing: the `pad`
     share of the row's declared parts. */
  const part = Array.isArray(row.part) ? row.part : [];
  if (part.length) f.wash = 0.01 + 0.64 * (part.filter((p) => p === "pad").length / part.length);
  if (row.nobass) f.sub = 0.2;

  /* MOTION / VARIATION — the row's phrase-turnover and its stress. */
  if (row.phrase != null) f.variation = clamp01(+row.phrase * 2);
  if (row.stress != null) f.motion = clamp01(+row.stress * 1.6);
  if (row.stress != null) f.offgrid = clamp01(+row.stress) * 0.66;

  /* ACOUSTIC — is this record PLAYED or MACHINED. Read off three of the row's
     own statements: its drum machine (fields.js DRUMKITS), its instruments'
     families (instruments.js familyOf) and whether it declares a signature
     synth at all. Nothing here guesses from a label. */
  let acc = 0.5;
  const dk = String(row.drumkit || "");
  if (dk && Object.prototype.hasOwnProperty.call(DRUMKITS, dk))
    acc += MACHINE_KIT[dk] ? -0.28 : 0.22;
  const instr = Array.isArray(row.instr) ? row.instr : [];
  if (instr.length) {
    let played = 0;
    for (const id of instr) played += MACHINE_FAM[familyOf(id)] ? 0 : 1;
    acc += (played / instr.length - 0.5) * 0.5;
  }
  if (row.synth) acc -= 0.22;
  f.acoustic = clamp01(acc);

  const lines = (doc.voices || []).filter((v) => v && v.kind === "line").length;
  f.leadVoices = Math.max(1, lines || +row.voices || 1);
  return f;
}

/* ---- THE STATE traits.js's presentVoices() READS -------------------------
   It wants `{ sections: [{ drums, bass, melody, pads, ... }], perc }` and asks
   only which VOICES sound anywhere. The nukernel document says exactly that in
   `doc.voices` and it says it once for the whole record, so one section is the
   truthful answer. */
function stateFromDoc(doc, f) {
  const vs = (doc && doc.voices) || [];
  const has = (kind) => vs.some((v) => v && v.kind === kind);
  const pad = vs.some((v) => v && v.cast && v.cast.part === "pad");
  const drum = vs.find((v) => v && v.kind === "drums");
  const sec = {
    drums: drum && (!drum.cast || drum.cast.on !== false) ? "on" : "off",
    bass: has("bass") ? "on" : "off",
    melody: vs.some((v) => v && v.kind === "line" && (!v.cast || v.cast.part !== "pad")) ? "on" : "off",
    pads: pad,
  };
  return { sections: [sec], __features: f };
}

/* traitsFromDoc(doc, row, seed) -> the TRAITS object alien.js takes. The K/V
   pair is the shim: `K.track()` hands back the state built above and
   `V.features()` hands back the vector, which is precisely the two questions
   traits.js asks its arguments. */
export function traitsFromDoc(doc, row, seed) {
  const f = featuresFromRow(row, doc);
  const st = stateFromDoc(doc, f);
  const K = { track: () => st, mix: () => st };
  const V = { features: (s) => (s && s.__features) || f };
  const name = String((doc && doc.basis) || (row && row.label) || "record");
  return traitsFromGenre(K, V, name, (seed | 0) || 1);
}

/* ---- THE SCORE BRIDGE ---------------------------------------------------
   planFromDoc(doc, bars) — `bars` is exactly what `ui/derive.js songBars`
   returns, so this walk never renders anything itself. Out:
     { numBars, meanLoud, hasDrums,
       bars: [ { loud, byMember: [ {notes,[level],playing} | null ] } ] }
   `notes` are alien.js's contract shape: `{ t (0..1 in the bar), pitch, dur,
   vel }`.

   WHICH MEMBER OWNS AN EVENT. `derive.js sectionEvents` tags a pitched line
   with `lv` — the layer's voice index, the same number `audio/plan.js:243`
   reads to seat it — and drums/bass with their kind. So a `hit` is the drums
   member's, a `bass` is the bass member's, and a `line` belongs to the lv-th
   LINE member in document order. That is the same correspondence the board's
   columns make (desk-doc.js channelVoicesOf: lines, then bass, then drums). */
const VOICE_REF = { drums: 0.3, bass: 0.3, line: 0.3 };
export function planFromDoc(doc, bars) {
  const vs = (doc && doc.voices) || [];
  const lineIx = [];
  let bassIx = -1, drumIx = -1;
  vs.forEach((v, i) => {
    if (!v) return;
    if (v.kind === "drums") { if (drumIx < 0) drumIx = i; }
    else if (v.kind === "bass") { if (bassIx < 0) bassIx = i; }
    else lineIx.push(i);
  });
  const N = vs.length;
  const out = [];
  let loudSum = 0;
  for (const b of (bars || [])) {
    const steps = b.barSteps || b.steps || 16;
    const byMember = new Array(N).fill(null);
    const slot = (i) => {
      if (i < 0 || i >= N) return null;
      let s = byMember[i];
      if (!s) s = byMember[i] = { notes: [], maxAmp: 0, level: 0, playing: false };
      return s;
    };
    for (const e of (b.ev || [])) {
      let i = -1;
      if (e.kind === "hit") i = drumIx;
      else if (e.kind === "bass") i = bassIx;
      else if (e.kind === "line") i = lineIx.length
        ? lineIx[(e.lv == null ? (e.v || 0) : e.lv) % lineIx.length] : -1;
      const s = slot(i);
      if (!s) continue;
      const off = e.off != null ? e.off : (e.t || 0);
      const amp = e.vel != null ? Math.min(1, e.vel / 9) : 0.3;   // derive's vel is 0..9
      s.notes.push({ t: Math.max(0, Math.min(0.999, off / steps)),
                     pitch: e.n != null ? (e.n | 0) + 60 : 50,
                     dur: Math.max(0.02, (e.d || 1) / steps),
                     vel: +amp.toFixed(4) });
      if (amp > s.maxAmp) s.maxAmp = amp;
    }
    let sum = 0, cnt = 0;
    for (let i = 0; i < N; i++) {
      const s = byMember[i]; if (!s) continue;
      s.notes.sort((x, y) => x.t - y.t);
      const kind = (vs[i] || {}).kind || "line";
      s.level = clamp01(s.maxAmp / (VOICE_REF[kind] || 0.3));
      s.playing = s.notes.length > 0 && s.level > 0.05;
      const w = kind === "drums" ? 1.4 : kind === "bass" ? 1.0 : 0.8;
      sum += s.level * w; cnt += w;
    }
    const loud = cnt > 0 ? clamp01(sum / cnt) : 0;
    loudSum += loud;
    out.push({ loud, byMember });
  }
  return { numBars: out.length, bars: out,
           meanLoud: out.length ? loudSum / out.length : 0,
           hasDrums: drumIx >= 0 };
}

export default { traitsFromDoc, planFromDoc, featuresFromRow };
