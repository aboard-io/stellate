// layers.js — THE STACK. One radar, seven concentric layers: genre at the centre,
// then the things a genre is made of, outward.
//
//     genre · chords · pad · drums · bass · melody · samples
//
// Zooming brings a layer forward; the others stay visible as rings so you never
// lose where you are. The genre ring is the sculptor (feel-core.js); every ring
// outside it is that voice's own dimension.
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
  { id: "genre", label: "genre", hue: 190,
    doc: "the shape of the music itself — drag here and the space picks the anchors nearest it",
    axes: (st) => feelAxes(st).filter((a) => feelDraggable(a.id)),
    write: null,                                     // handled by the sculptor, not a param write
  },
  { id: "chords", label: "chords", hue: 265,
    doc: "the harmony brain: how far the reharmoniser wanders and how often the chord turns over",
    axes: (st) => {
      const th = st.theory || {};
      return [
        { id: "adventure", label: "reach", v: c01(+th.adventure || 0),
          doc: "diatonic → borrowed → secondary dominants → chromatic mediants" },
        { id: "color", label: "color", v: c01(+th.color || 0), doc: "extension richness (7ths, 9ths, 13ths)" },
        { id: "rate", label: "rate", v: c01((8 - Math.max(2, st.chordEvery || 8)) / 6),
          doc: "harmonic rhythm — how many beats a chord holds (8 → 2)" },
      ];
    },
    write: (st, id, v) => {
      if (id === "rate") { st.chordEvery = Math.max(2, Math.round(8 - v * 6)); return; }
      // moving either harmony axis ARMS the reharmoniser: adventure with reharm
      // off is a knob wired to nothing, and a control that does nothing is worse
      // than no control (the same rule the feel indicators follow)
      st.theory = Object.assign({}, st.theory || {}, { reharm: true, [id]: +v.toFixed(3) });
    },
  },
  { id: "pad", label: "pad", hue: 280,
    doc: "the bed under everything",
    axes: (st) => [
      { id: "level", label: "level", v: knob("pad", "level", 0, 1.2).read(st), doc: "how present the pad is" },
      { id: "cutoff", label: "tone", v: cutN(inst(st, "pad").cutoff), doc: "filter cutoff" },
      { id: "send", label: "space", v: c01((inst(st, "pad").send || 0) / 0.6), doc: "reverb send" },
      { id: "attack", label: "swell", v: c01((inst(st, "pad").attack || 0) / 1.2), doc: "how slowly it arrives" },
    ],
    write: (st, id, v) => {
      const p = inst(st, "pad");
      if (id === "level") p.level = +(v * 1.2).toFixed(4);
      else if (id === "cutoff") p.cutoff = cutHz(v);
      else if (id === "send") p.send = +(v * 0.6).toFixed(4);
      else if (id === "attack") p.attack = +(v * 1.2).toFixed(4);
    },
  },
  { id: "drums", label: "drums", hue: 45,
    doc: "the kit's balance — the PATTERN lives in the refiner below",
    axes: (st) => [
      { id: "kick", label: "kick", v: knob("drums", "kick", 0, 2).read(st), doc: "kick level" },
      { id: "snare", label: "snare", v: knob("drums", "snare", 0, 2).read(st), doc: "snare/clap level" },
      { id: "hat", label: "hat", v: knob("drums", "hat", 0, 2).read(st), doc: "hat level" },
      { id: "tune", label: "tune", v: c01(((inst(st, "drums").tune || 1) - 0.7) / 0.8), doc: "kit pitch" },
      { id: "send", label: "space", v: c01((inst(st, "drums").send || 0) / 0.6), doc: "reverb send" },
    ],
    write: (st, id, v) => {
      const d = inst(st, "drums");
      if (id === "tune") d.tune = +(0.7 + v * 0.8).toFixed(4);
      else if (id === "send") d.send = +(v * 0.6).toFixed(4);
      else d[id] = +(v * 2).toFixed(4);
    },
  },
  { id: "bass", label: "bass", hue: 330,
    doc: "the low end, and how much the cell breathes",
    axes: (st) => [
      { id: "level", label: "level", v: knob("bass", "level", 0, 2).read(st), doc: "bass level" },
      { id: "cutoff", label: "tone", v: cutN(inst(st, "bass").cutoff), doc: "filter cutoff — the acid knob" },
      { id: "res", label: "bite", v: c01((inst(st, "bass").res || 0) / 1), doc: "filter resonance — squelch" },
      { id: "mutate", label: "mutate", v: c01(st.rhythm ? +st.rhythm.complexity || 0 : 0),
        doc: "per-cycle cell mutation on its own stream" },
    ],
    write: (st, id, v) => {
      const b = inst(st, "bass");
      if (id === "level") b.level = +(v * 2).toFixed(4);
      else if (id === "cutoff") b.cutoff = cutHz(v);
      else if (id === "res") b.res = +v.toFixed(4);
      else if (id === "mutate") st.rhythm = Object.assign({}, st.rhythm || {}, { complexity: +v.toFixed(3) });
    },
  },
  { id: "melody", label: "melody", hue: 200,
    doc: "the lead voice — the PHRASE lives in the refiner below",
    axes: (st) => [
      { id: "level", label: "level", v: knob("melody", "level", 0, 2).read(st), doc: "lead level" },
      { id: "cutoff", label: "tone", v: cutN(inst(st, "melody").cutoff), doc: "filter cutoff" },
      { id: "send", label: "space", v: c01((inst(st, "melody").send || 0) / 0.6), doc: "reverb send" },
      { id: "voices", label: "width", v: c01(((inst(st, "melody").voices || 1) - 1) / 7), doc: "unison voices" },
    ],
    write: (st, id, v) => {
      const m = inst(st, "melody");
      if (id === "level") m.level = +(v * 2).toFixed(4);
      else if (id === "cutoff") m.cutoff = cutHz(v);
      else if (id === "send") m.send = +(v * 0.6).toFixed(4);
      else if (id === "voices") m.voices = Math.max(1, Math.round(1 + v * 7));
    },
  },
  { id: "samples", label: "samples", hue: 120,
    doc: "the found layer — field recordings, breaks, chops, speech",
    axes: (st) => {
      const on = (st.foundSources || []).filter((s) => (s.vol || 0) > 0.001);
      const avg = on.length ? on.reduce((a, s) => a + (s.vol || 0), 0) / on.length : 0;
      return [
        { id: "level", label: "level", v: c01(avg / 0.6), doc: "how loud the found layer sits" },
        { id: "wet", label: "wash", v: on.length ? on.filter((s) => s.wet).length / on.length : 0, doc: "how many sources run wet" },
        { id: "glitch", label: "glitch", v: on.length ? on.filter((s) => s.glitch).length / on.length : 0, doc: "stutter/scramble" },
        { id: "crackle", label: "dust", v: c01((st.crackle || 0) / 0.8), doc: "record wear over the whole mix" },
      ];
    },
    write: (st, id, v) => {
      if (id === "crackle") { st.crackle = +(v * 0.8).toFixed(3); return; }
      const on = (st.foundSources || []).filter((s) => (s.vol || 0) > 0.001);
      if (!on.length) return;
      if (id === "level") { const cur = on.reduce((a, s) => a + (s.vol || 0), 0) / on.length || 0.001;
        const k = (v * 0.6) / cur; for (const s of on) s.vol = +Math.min(1, (s.vol || 0) * k).toFixed(4); return; }
      // wet/glitch are FLAGS per source: a fraction sets that fraction of them,
      // taken in the crate's own order so the choice is deterministic
      const n = Math.round(v * on.length);
      on.forEach((s, i) => { s[id === "wet" ? "wet" : "glitch"] = i < n; });
    },
  },
];

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
