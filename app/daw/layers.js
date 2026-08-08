// layers.js — THE STACK. Everything fans out from the KERNEL.
//
//   kernel · chords · pad · drums · bass · melody · samples · note fx
//
// The centre is the kernel itself — the genre shape the whole song is resolved
// from. Each ring outward is something the kernel FANS OUT INTO: the harmony it
// picks, the voices it dresses, the samples it draws on, and finally the note
// transforms that run over the whole bundle. Reading outward is reading the
// pipeline; zooming is moving along it.
//
// EVERY NUMERIC VARIABLE IS A SPOKE. Not a curated handful — the full surface
// each layer actually carries, including the per-op drum probabilities and the
// wander walk's knobs that used to live only in the refiner. What stays OUT of
// the radar is what a radius cannot honestly express: a choice (which kit, which
// progression), a contour in time (a phrase), or a matrix (a weave). Those are
// the refiner, and they are the only things left there.
//
// PURE — no song.js import, so song.js can apply these while BUILDING a state
// without a cycle, exactly as feel-core.js does. And for the same reason as
// feel-core: the document stores ONE NUMBER PER AXIS (`patch.layers`), never the
// resolved params. Writing `instruments.pad.level` into the patch would pin the
// whole instruments block, which both blows the URL budget and freezes the
// instrument choices so re-shaping the genre could not change them. That bug is
// documented in feel-core.js; this module was built to avoid repeating it.
import { axesOf as feelAxes, applyFeel, isDraggable as feelDraggable } from "./machines/feel-core.js";

const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const L = Math.log2;
const cutN = (hz) => c01((L(Math.max(200, hz || 400)) - L(400)) / (L(10000) - L(400)));
const cutHz = (n) => Math.round(Math.pow(2, L(400) + c01(n) * (L(10000) - L(400))));
const inst = (st, v) => ((st.instruments || (st.instruments = {}))[v] || (st.instruments[v] = {}));

// a plain numeric axis on one instrument field, normalised by an explicit range
const knob = (voice, field, lo, hi, id, label, doc) => ({
  id, label, doc,
  read: (st) => c01((((inst(st, voice))[field] || lo) - lo) / (hi - lo)),
  write: (st, v) => { inst(st, voice)[field] = +(lo + v * (hi - lo)).toFixed(4); },
});
// the same, on a log-mapped cutoff, which is how filters are actually heard
const cut = (voice, id, label) => ({
  id, label, doc: "filter cutoff (log-mapped, 400 Hz – 10 kHz)",
  read: (st) => cutN(inst(st, voice).cutoff),
  write: (st, v) => { inst(st, voice).cutoff = cutHz(v); },
});

export const LAYERS = [
  { id: "genre", label: "kernel", hue: 190,
    doc: "the shape of the music itself — drag here and the space picks the anchors nearest it",
    axes: (st) => feelAxes(st).filter((a) => feelDraggable(a.id)),
    write: null,                                     // handled by the sculptor, not a param write
  },
  { id: "chords", label: "chords", hue: 265,
    doc: "the harmony brain: how far the reharmoniser wanders, how rich the chords, how often they turn over",
    axes: (st) => {
      const th = st.theory || {};
      return [
        { id: "adventure", label: "reach", v: c01(+th.adventure || 0),
          doc: "diatonic → borrowed → secondary dominants → chromatic mediants" },
        { id: "color", label: "color", v: c01(+th.color || 0), doc: "extension richness (7ths, 9ths, 13ths)" },
        { id: "rate", label: "rate", v: c01((8 - Math.max(2, st.chordEvery || 8)) / 6),
          doc: "harmonic rhythm — how many beats a chord holds (8 → 2)" },
        { id: "key", label: "key", v: c01((((st.keyOffset | 0) % 12) + 12) % 12 / 11), doc: "transposition in semitones" },
        { id: "swing", label: "swing", v: c01((st.swing || 0) / 0.45), doc: "the 8th-note lean" },
        { id: "humanize", label: "human", v: c01((st.humanize || 0) / 0.6), doc: "timing looseness" },
      ];
    },
    write: (st, id, v) => {
      if (id === "rate") { st.chordEvery = Math.max(2, Math.round(8 - v * 6)); return; }
      if (id === "key") { st.keyOffset = Math.round(v * 11); return; }
      if (id === "swing") { st.swing = +(v * 0.45).toFixed(3); return; }
      if (id === "humanize") { st.humanize = +(v * 0.6).toFixed(3); return; }
      // moving either harmony axis ARMS the reharmoniser: adventure with reharm
      // off is a knob wired to nothing, and a control that does nothing is worse
      // than no control (the same rule the feel indicators follow)
      st.theory = Object.assign({}, st.theory || {}, { reharm: true, [id]: +v.toFixed(3) });
    },
  },
  { id: "pad", label: "pad", hue: 280,
    doc: "the bed under everything",
    axes: (st) => voiceAxes(st, "pad", 1.2),
    write: (st, id, v) => voiceWrite(st, "pad", id, v, 1.2),
  },
  { id: "drums", label: "drums", hue: 45,
    doc: "the kit's balance — the PATTERN lives in the refiner below",
    axes: (st) => {
      const d = inst(st, "drums");
      const out = [
        { id: "kick", label: "kick", v: c01((d.kick || 0) / 2), doc: "kick level" },
        { id: "snare", label: "snare", v: c01((d.snare || 0) / 2), doc: "snare/clap level" },
        { id: "hat", label: "hat", v: c01((d.hat || 0) / 2), doc: "hat level" },
        { id: "tom", label: "tom", v: c01((d.tom || 0) / 2), doc: "tom level" },
        { id: "tune", label: "tune", v: c01(((d.tune || 1) - 0.7) / 0.8), doc: "kit pitch" },
        { id: "send", label: "space", v: c01((d.send || 0) / 0.6), doc: "reverb send" },
        { id: "dsend", label: "echo", v: c01((d.dsend || 0) / 0.6), doc: "delay send" },
      ];
      // THE PER-OP PROBABILITIES, straight onto the ring. These used to be a
      // separate radar in the refiner; they are variables, so they belong here.
      const kitName = firstKit(st);
      const kit = kitName && ((st.kits && st.kits[kitName]) || (window.CsdEngine && window.CsdEngine.KITS[kitName]));
      if (kit && kit.ops) kit.ops.forEach((op, i) => {
        if (op.ride) return;
        const p = op.grid ? (op.grid.sp != null ? op.grid.sp : 1) : (op.p != null ? op.p : 1);
        out.push({ id: "op:" + i, label: (op.d || "op") + " ?", v: c01(p),
                   doc: "chance this " + (op.d || "") + " op fires (op " + i + ")" });
      });
      return out;
    },
    write: (st, id, v) => {
      const d = inst(st, "drums");
      if (id.indexOf("op:") === 0) {
        const i = +id.slice(3);
        const kitName = firstKit(st);
        if (!kitName || !window.CsdEngine) return;
        const kits = Object.assign({}, st.kits || {});
        if (!kits[kitName]) kits[kitName] = JSON.parse(JSON.stringify(window.CsdEngine.KITS[kitName] || { ops: [] }));
        const op = kits[kitName].ops[i];
        if (!op) return;
        // "always" is the ABSENCE of p, never p:1 — an op carrying p:1 spends an
        // rng draw deciding something never in doubt (kit-machine.test.js)
        if (op.grid) { if (v >= 0.999) delete op.grid.sp; else op.grid.sp = +v.toFixed(2); }
        else { if (v >= 0.999) delete op.p; else op.p = +v.toFixed(2); }
        st.kits = kits;
        return;
      }
      if (id === "tune") d.tune = +(0.7 + v * 0.8).toFixed(4);
      else if (id === "send") d.send = +(v * 0.6).toFixed(4);
      else if (id === "dsend") d.dsend = +(v * 0.6).toFixed(4);
      else d[id] = +(v * 2).toFixed(4);
    },
  },
  { id: "bass", label: "bass", hue: 330,
    doc: "the low end, and how much the cell breathes",
    axes: (st) => voiceAxes(st, "bass", 2).concat([
      { id: "mutate", label: "mutate", v: c01(st.rhythm ? +st.rhythm.complexity || 0 : 0),
        doc: "per-cycle cell mutation, on its own rng stream" },
    ]),
    write: (st, id, v) => {
      if (id === "mutate") { st.rhythm = Object.assign({}, st.rhythm || {}, { complexity: +v.toFixed(3) }); return; }
      voiceWrite(st, "bass", id, v, 2);
    },
  },
  { id: "melody", label: "melody", hue: 200,
    doc: "the lead voice — the PHRASE lives in the refiner below",
    // the WANDER knobs ride this ring too — they were the last radar hiding in the
    // refiner, and "every variable in the radar" means exactly that
    axes: (st) => {
      const g = st.melodyGen || {};
      return voiceAxes(st, "melody", 2).concat([
        { id: "w_step", label: "step", v: c01((((g.step != null ? g.step : 1)) - 1) / 3), doc: "how far the walk may move per note" },
        { id: "w_leap", label: "leap", v: c01(g.leap != null ? g.leap : 0.18), doc: "chance of an octave jump" },
        { id: "w_rest", label: "rest", v: c01((g.rest != null ? g.rest : 0) / 0.6), doc: "chance a step is silence" },
        { id: "w_legato", label: "legato", v: c01(((g.legato != null ? g.legato : 0.92) - 0.2) / 0.8), doc: "how much of the gap a note holds" },
      ]);
    },
    write: (st, id, v) => {
      if (id.indexOf("w_") === 0) {
        const g = Object.assign({}, st.melodyGen || {});
        if (id === "w_step") g.step = Math.max(1, Math.round(1 + v * 3));
        else if (id === "w_leap") g.leap = +v.toFixed(3);
        else if (id === "w_rest") g.rest = +(v * 0.6).toFixed(3);
        else if (id === "w_legato") g.legato = +(0.2 + v * 0.8).toFixed(3);
        st.melodyGen = g;
        return;
      }
      voiceWrite(st, "melody", id, v, 2);
    },
  },
  { id: "samples", label: "samples", hue: 120,
    doc: "the found layer — field recordings, breaks, chops, speech",
    axes: (st) => {
      const on = (st.foundSources || []).filter((s) => (s.vol || 0) > 0.001);
      const avg = on.length ? on.reduce((a, s) => a + (s.vol || 0), 0) / on.length : 0;
      const mean = (f, d) => (on.length ? on.reduce((a, s) => a + (s[f] != null ? +s[f] : d), 0) / on.length : d);
      return [
        { id: "level", label: "level", v: c01(avg / 0.6), doc: "how loud the found layer sits" },
        { id: "wet", label: "wash", v: on.length ? on.filter((s) => s.wet).length / on.length : 0, doc: "how many sources run wet" },
        { id: "glitch", label: "glitch", v: on.length ? on.filter((s) => s.glitch).length / on.length : 0, doc: "stutter/scramble" },
        { id: "distant", label: "far", v: on.length ? on.filter((s) => s.distant).length / on.length : 0, doc: "pushed back in the room" },
        { id: "pitch", label: "pitch", v: c01(mean("pitch", 0.78) / 1.6), doc: "playback rate of the found layer" },
        { id: "stretch", label: "stretch", v: c01(mean("stretch", 0.45)), doc: "granular smear" },
        { id: "cutoff", label: "tone", v: cutN(mean("cutoff", 2600)), doc: "found-layer filter" },
        { id: "crackle", label: "dust", v: c01((st.crackle || 0) / 0.8), doc: "record wear over the whole mix" },
      ];
    },
    write: (st, id, v) => {
      if (id === "crackle") { st.crackle = +(v * 0.8).toFixed(3); return; }
      const on = (st.foundSources || []).filter((s) => (s.vol || 0) > 0.001);
      if (!on.length) return;
      if (id === "pitch") { for (const s of on) s.pitch = +(v * 1.6).toFixed(3); return; }
      if (id === "stretch") { for (const s of on) s.stretch = +v.toFixed(3); return; }
      if (id === "cutoff") { for (const s of on) s.cutoff = cutHz(v); return; }
      if (id === "distant") { const n2 = Math.round(v * on.length); on.forEach((s, i) => { s.distant = i < n2; }); return; }
      if (id === "level") { const cur = on.reduce((a, s) => a + (s.vol || 0), 0) / on.length || 0.001;
        const k = (v * 0.6) / cur; for (const s of on) s.vol = +Math.min(1, (s.vol || 0) * k).toFixed(4); return; }
      // wet/glitch are FLAGS per source: a fraction sets that fraction of them,
      // taken in the crate's own order so the choice is deterministic
      const n = Math.round(v * on.length);
      on.forEach((s, i) => { s[id === "wet" ? "wet" : "glitch"] = i < n; });
    },
  },
  { id: "notefx", label: "note fx", hue: 300,
    doc: "the transforms that run over the whole finished bundle — the last thing the kernel fans out into",
    axes: (st) => {
      const R = (window.CsdPipes && window.CsdPipes.REGISTRY) || {};
      const on = st.pipes || [];
      // one spoke per REGISTERED transform: its chance if it is in the chain, zero
      // if it is not. So the ring shows the whole vocabulary and turning a spoke up
      // from zero ADDS the pipe — which is what "every variable in the radar" has
      // to mean for a list you can add to.
      return Object.keys(R).map((id) => {
        const spec = on.find((p) => p.id === id);
        return { id, label: id.replace(/([A-Z])/g, " $1").toLowerCase().slice(0, 9),
                 v: spec ? c01(spec.prob != null ? +spec.prob : 0.5) : 0,
                 doc: (R[id] && R[id].doc) || id };
      });
    },
    write: (st, id, v) => {
      const list = (st.pipes || []).map((p) => Object.assign({}, p));
      const i = list.findIndex((p) => p.id === id);
      if (v <= 0.001) { if (i >= 0) list.splice(i, 1); }        // to zero = out of the chain
      else if (i >= 0) list[i].prob = +v.toFixed(3);
      else list.push({ id, prob: +v.toFixed(3) });               // up from zero = added, at the end
      st.pipes = list;
    },
  },
];

// the kit this song's form actually plays — the ops on the drums ring are its ops
function firstKit(st) {
  for (const sec of st.sections || []) if (sec.drums && sec.drums !== "off") return sec.drums;
  return null;
}

// one voice's full synth surface, so a ring is the whole instrument and not a
// selection from it
function voiceAxes(st, v, lvlMax) {
  const I = inst(st, v);
  return [
    { id: "level", label: "level", v: c01((I.level || 0) / lvlMax), doc: "voice level" },
    { id: "cutoff", label: "tone", v: cutN(I.cutoff), doc: "filter cutoff" },
    { id: "res", label: "bite", v: c01(I.res || 0), doc: "filter resonance" },
    { id: "attack", label: "attack", v: c01((I.attack || 0) / 1.2), doc: "how slowly it arrives" },
    { id: "detune", label: "detune", v: c01((I.detune || 0) / 0.05), doc: "voice spread" },
    { id: "send", label: "space", v: c01((I.send || 0) / 0.6), doc: "reverb send" },
    { id: "dsend", label: "echo", v: c01((I.dsend || 0) / 0.6), doc: "delay send" },
    { id: "voices", label: "width", v: c01(((I.voices || 1) - 1) / 7), doc: "unison voices" },
  ];
}
function voiceWrite(st, v, id, val, lvlMax) {
  const I = inst(st, v);
  if (id === "level") I.level = +(val * lvlMax).toFixed(4);
  else if (id === "cutoff") I.cutoff = cutHz(val);
  else if (id === "res") I.res = +val.toFixed(4);
  else if (id === "attack") I.attack = +(val * 1.2).toFixed(4);
  else if (id === "detune") I.detune = +(val * 0.05).toFixed(5);
  else if (id === "send") I.send = +(val * 0.6).toFixed(4);
  else if (id === "dsend") I.dsend = +(val * 0.6).toFixed(4);
  else if (id === "voices") I.voices = Math.max(1, Math.round(1 + val * 7));
}

export const layerById = (id) => LAYERS.find((l) => l.id === id);

// Apply {layerId: {axisId: v}} to a resolved state, in place. Genre is skipped —
// its shape drives the BLEND, not a param write.
export function applyLayers(st, layers) {
  if (!layers) return st;
  for (const l of LAYERS) {
    const set = layers[l.id];
    if (!set || !l.write) continue;
    for (const id of Object.keys(set)) {
      const v = +set[id];
      if (v >= 0 && v <= 1) l.write(st, id, v);
    }
  }
  return st;
}
export { applyFeel };
