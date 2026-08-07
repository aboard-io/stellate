// feel-core.js — the feel axes and their WRITERS, as pure functions over a state.
//
// Split from feel.js (which knows about SONG) for two reasons, one structural and
// one that was a real bug:
//
//   1. song.js has to apply feel tweaks while BUILDING a state, and feel.js
//      imports song.js — a cycle. This module imports nothing.
//   2. THE BUG. The first cut had the spread writers put their result straight
//      into SONG.patch, which meant copying the whole resolved `instruments`
//      object (sampler zone maps and all) into the document. That blew the 6000-
//      char URL budget so the patch silently stopped encoding — and, far worse,
//      it PINNED every instrument choice, so re-shaping the genre could no longer
//      change what played it.
//
// So the document stores only what you SET — one number per axis, in
// `patch.feel` — and those numbers are re-applied to each freshly resolved state.
// Shape the genre and the instruments change; your brightness rides on top of
// whatever the new blend picked, instead of freezing the old one.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const L = Math.log2;
const cutN = (hz) => clamp01((L(Math.max(200, hz || 400)) - L(400)) / (L(10000) - L(400)));
const cutHz = (n) => Math.round(Math.pow(2, L(400) + clamp01(n) * (L(10000) - L(400))));

export function axesOf(st) {
  const I = st.instruments || {}, mel = I.melody || {}, pad = I.pad || {}, D = I.drums || {};
  const hc = (st.tone && st.tone.highcut) || 12000;
  const th = st.theory || {};
  const kitOn = !!(st.genreMeta && st.genreMeta.kit && st.genreMeta.kit !== "off");
  const drumAmt = kitOn ? clamp01(((D.kick || 0) + (D.snare || 0) + (D.hat || 0)) / 3.5) : 0;
  let layers = 0;
  if ((pad.level || 0) > 0.05) layers++;
  if (I.bass) layers++; if (I.melody) layers++; if (kitOn) layers++;
  if ((st.foundSources || []).some((s) => (s.vol || 0) > 0.02)) layers++;

  return [
    { id: "tempo", label: "tempo", kind: "direct", v: clamp01(((st.bpm || 110) - 50) / 130), doc: "50–180 bpm" },
    { id: "swing", label: "swing", kind: "direct", v: clamp01((st.swing || 0) / 0.45), doc: "the 8th-note lean" },
    { id: "feel", label: "human", kind: "direct", v: clamp01((st.humanize || 0) / 0.6), doc: "timing looseness" },
    { id: "bright", label: "bright", kind: "spread",
      v: clamp01(0.55 * cutN(mel.cutoff) + 0.25 * cutN(pad.cutoff) + 0.20 * cutN(hc)),
      doc: "lead + pad cutoff and the master high-shelf, moved together" },
    { id: "space", label: "space", kind: "spread",
      v: clamp01(0.75 * (((st.reverb || 0.3) - 0.3) / 0.65) + 0.25 * clamp01((mel.send || 0) / 0.5)),
      doc: "reverb and the lead's send" },
    { id: "dust", label: "dust", kind: "direct", v: clamp01((st.crackle || 0) / 0.8), doc: "record wear" },
    { id: "drive", label: "drive", kind: "spread",
      v: clamp01((clamp01((st.pump || 0) / 0.8) + clamp01((st.comp || 0) / 0.9) + clamp01((st.grit || 0) / 0.8)) / 3),
      doc: "pump, glue comp and saturation together" },
    { id: "adventure", label: "harmony", kind: "direct", v: clamp01(+th.adventure || 0), doc: "how far the reharmoniser wanders" },
    { id: "motion", label: "motion", kind: "direct", v: clamp01(st.rhythm ? +st.rhythm.complexity || 0 : 0), doc: "rhythmic mutation" },
    { id: "density", label: "density", kind: "indicator",
      v: clamp01(0.45 * drumAmt + 0.25 * clamp01((mel.voices || 1) / 8) + 0.30 * (layers / 5)),
      doc: "how many layers are voiced — a drag cannot invent a bass part, so this one only reports" },
  ];
}

// Each writer MUTATES the resolved state in place. Spread writers solve for a
// common shift and push every contributing param through the same map, so the
// weighted sum lands on the target while the params keep their current ratio: a
// pad already darker than the lead stays darker.
const WRITERS = {
  tempo: (st, v) => { st.bpm = Math.round(50 + v * 130); },
  swing: (st, v) => { st.swing = +(v * 0.45).toFixed(3); },
  feel: (st, v) => { st.humanize = +(v * 0.6).toFixed(3); },
  dust: (st, v) => { st.crackle = +(v * 0.8).toFixed(3); },
  adventure: (st, v) => { st.theory = Object.assign({}, st.theory || {}, { adventure: +v.toFixed(3) }); },
  motion: (st, v) => { st.rhythm = Object.assign({}, st.rhythm || {}, { complexity: +v.toFixed(3) }); },
  bright: (st, v) => {
    const I = st.instruments || (st.instruments = {});
    const mel = I.melody || (I.melody = {}), pad = I.pad || (I.pad = {});
    const hc = (st.tone && st.tone.highcut) || 12000;
    const cur = 0.55 * cutN(mel.cutoff) + 0.25 * cutN(pad.cutoff) + 0.20 * cutN(hc);
    const d = v - cur;
    mel.cutoff = cutHz(cutN(mel.cutoff) + d);
    pad.cutoff = cutHz(cutN(pad.cutoff) + d);
    st.tone = Object.assign({}, st.tone || {}, { highcut: cutHz(cutN(hc) + d) });
  },
  space: (st, v) => {
    const I = st.instruments || (st.instruments = {});
    const mel = I.melody || (I.melody = {});
    mel.send = +(v * 0.5).toFixed(3);
    st.reverb = +(0.3 + v * 0.65).toFixed(3);
  },
  drive: (st, v) => {
    st.pump = +(v * 0.8).toFixed(3); st.comp = +(v * 0.9).toFixed(3); st.grit = +(v * 0.8).toFixed(3);
  },
};

export const isDraggable = (id) => !!WRITERS[id];
export const AXIS_IDS = Object.keys(WRITERS);

// Apply a {axis: value} map to a resolved state, in place. Unknown ids are
// ignored, so an old link with a retired axis degrades instead of throwing.
export function applyFeel(st, feel) {
  if (!feel) return st;
  for (const id of Object.keys(feel)) {
    const w = WRITERS[id];
    const v = +feel[id];
    if (w && v >= 0 && v <= 1) w(st, v);
  }
  return st;
}
