// machines/feel.js — THE FEEL VECTOR, made editable.
//
// app/panels/inside/feel.js turns a state into 12 perceptual axes and draws them
// as a radar. It is READ-ONLY there, and that is not an oversight — the projection
// is LOSSY, so "editable radar" is not a UI problem, it is an inverse problem:
//
//     bright = 0.55·cutN(mel.cutoff) + 0.25·cutN(pad.cutoff) + 0.20·cutN(highcut)
//
// Drag that spoke to 0.8 and the reading does not say which of the three cutoffs
// to move. Every composite axis has the same shape. So each axis here declares a
// WRITER as well as a reader, and the writers fall into three honest kinds:
//
//   DIRECT     one param, one axis, exactly invertible (tempo→bpm, dust→crackle)
//   DISTRIBUTED several params, moved together in their CURRENT ratio so the
//              balance you already have is preserved while the sum hits the target
//   INDICATOR  cannot be written without inventing musical decisions, so it is
//              drawn and never dragged. `density` counts whether a bass part
//              EXISTS; a drag cannot conjure one, and pretending otherwise would
//              make the display lie.
//
// The split is visible in the UI (indicator spokes are dimmed and refuse the
// drag) because a control that silently does nothing is worse than no control.
import { SONG, edit, state } from "../song.js";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const L = Math.log2;
const cutN = (hz) => clamp01((L(Math.max(200, hz || 400)) - L(400)) / (L(10000) - L(400)));
const cutHz = (n) => Math.round(Math.pow(2, L(400) + clamp01(n) * (L(10000) - L(400))));

// Read the axis values off the RESOLVED state (patch already applied), so the
// radar always shows what is actually playing rather than what was typed.
export function axes() {
  const st = state();
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
    { id: "tempo",  label: "tempo",  kind: "direct",
      v: clamp01(((st.bpm || 110) - 50) / 130),
      doc: "50–180 bpm" },
    { id: "swing",  label: "swing",  kind: "direct",
      v: clamp01((st.swing || 0) / 0.45), doc: "the 8th-note lean" },
    { id: "feel",   label: "human",  kind: "direct",
      v: clamp01((st.humanize || 0) / 0.6), doc: "timing looseness" },
    { id: "bright", label: "bright", kind: "spread",
      v: clamp01(0.55 * cutN(mel.cutoff) + 0.25 * cutN(pad.cutoff) + 0.20 * cutN(hc)),
      doc: "lead + pad cutoff and the master high-shelf, moved together" },
    { id: "space",  label: "space",  kind: "spread",
      v: clamp01(0.75 * (((st.reverb || 0.3) - 0.3) / 0.65) + 0.25 * clamp01((mel.send || 0) / 0.5)),
      doc: "reverb and the lead's send" },
    { id: "dust",   label: "dust",   kind: "direct",
      v: clamp01((st.crackle || 0) / 0.8), doc: "record wear" },
    { id: "drive",  label: "drive",  kind: "spread",
      v: clamp01((clamp01((st.pump || 0) / 0.8) + clamp01((st.comp || 0) / 0.9) + clamp01((st.grit || 0) / 0.8)) / 3),
      doc: "pump, glue comp and saturation together" },
    { id: "adventure", label: "harmony", kind: "direct",
      v: clamp01(+th.adventure || 0), doc: "how far the reharmoniser wanders" },
    { id: "motion", label: "motion", kind: "direct",
      v: clamp01(st.rhythm ? +st.rhythm.complexity || 0 : 0), doc: "rhythmic mutation" },
    // ---- INDICATORS: read, never written ----
    { id: "density", label: "density", kind: "indicator",
      v: clamp01(0.45 * drumAmt + 0.25 * clamp01((mel.voices || 1) / 8) + 0.30 * (layers / 5)),
      doc: "how many layers are voiced — a drag cannot invent a bass part, so this one only reports" },
  ];
}

// ---------- the writers ----------
// Each returns the fields to merge into SONG.patch. DISTRIBUTED writers preserve
// the current ratio between their params: if your pad is already darker than your
// lead, dragging `bright` keeps it darker.
const WRITERS = {
  tempo: (v) => ({ bpm: Math.round(50 + clamp01(v) * 130) }),
  swing: (v) => ({ swing: +(clamp01(v) * 0.45).toFixed(3) }),
  feel: (v) => ({ humanize: +(clamp01(v) * 0.6).toFixed(3) }),
  dust: (v) => ({ crackle: +(clamp01(v) * 0.8).toFixed(3) }),
  adventure: (v, st) => ({ theory: Object.assign({}, st.theory || {}, { adventure: +clamp01(v).toFixed(3) }) }),
  motion: (v, st) => ({ rhythm: Object.assign({}, st.rhythm || {}, { complexity: +clamp01(v).toFixed(3) }) }),

  bright: (v, st) => {
    // solve for a common shift in normalised-cutoff space, then push each param
    // back through the same log map, so the WEIGHTED SUM lands on the target
    const I = st.instruments || {}, mel = I.melody || {}, pad = I.pad || {};
    const hc = (st.tone && st.tone.highcut) || 12000;
    const cur = 0.55 * cutN(mel.cutoff) + 0.25 * cutN(pad.cutoff) + 0.20 * cutN(hc);
    const d = clamp01(v) - cur;
    const inst = JSON.parse(JSON.stringify(st.instruments || {}));
    inst.melody = Object.assign({}, inst.melody || {}, { cutoff: cutHz(cutN(mel.cutoff) + d) });
    inst.pad = Object.assign({}, inst.pad || {}, { cutoff: cutHz(cutN(pad.cutoff) + d) });
    return { instruments: inst, tone: Object.assign({}, st.tone || {}, { highcut: cutHz(cutN(hc) + d) }) };
  },
  space: (v, st) => {
    const I = st.instruments || {}, mel = I.melody || {};
    const inst = JSON.parse(JSON.stringify(st.instruments || {}));
    inst.melody = Object.assign({}, inst.melody || {}, { send: +(clamp01(v) * 0.5).toFixed(3) });
    return { reverb: +(0.3 + clamp01(v) * 0.65).toFixed(3), instruments: inst };
  },
  drive: (v) => ({ pump: +(clamp01(v) * 0.8).toFixed(3), comp: +(clamp01(v) * 0.9).toFixed(3), grit: +(clamp01(v) * 0.8).toFixed(3) }),
};

export const isDraggable = (id) => !!WRITERS[id];

export function setAxis(id, v) {
  const w = WRITERS[id];
  if (!w) return false;
  const st = state();
  edit({ patch: Object.assign({}, SONG.patch, w(clamp01(v), st)) });
  return true;
}

// which patch keys the feel editor may write — mirrored into song.js PATCH_KEYS so
// a sculpted feel survives a reload (a machine whose key is missing appears to
// work and loses its edit, the failure mode the whitelist comment warns about)
export const FEEL_KEYS = ["bpm", "swing", "humanize", "crackle", "theory", "rhythm",
                          "instruments", "tone", "reverb", "pump", "comp", "grit"];

export const isEdited = () => FEEL_KEYS.some((k) => SONG.patch[k] != null);
export function revert() {
  const p = Object.assign({}, SONG.patch);
  for (const k of FEEL_KEYS) delete p[k];
  edit({ patch: p });
}
