// layers.js — THE PARAM TABLE. One number per axis, applied to the resolved state.
//
// SLIMMED for THE GRID (docs/DAW.md "THE GRID"): the radar/spokes machinery is
// gone — the axes() readers that packaged every variable as a spoke were the
// "pile of points" the redesign replaces. What survives is the part that was
// always true:
//
//   * applyLayers — URL BACK-COMPAT. patch.layers is {layerId:{axisId:v01}} and
//     every layer id / axis id an old shared link can carry still writes exactly
//     the same resolved fields. Deleting a writer would silently strand old URLs.
//   * the per-voice param READ/WRITE table — the sheet's TILES are one axis each,
//     and they read/format through this table (real units, not 0..1).
//   * NEW: the `master` writer {bpm 60..190, swing 0..0.45, humanize 0..0.6} —
//     time feel lives in the MASTER sheet now, not on the chords ring.
//
// PURE — no song.js import, so song.js can apply these while BUILDING a state
// without a cycle (the feel-core.js pattern). The document stores ONE NUMBER PER
// AXIS (`patch.layers`), never resolved params: writing `instruments.pad.level`
// into the patch would pin the whole instruments block, blow the URL budget and
// freeze instrument choices so re-shaping the genre could not change them
// (the bug documented in feel-core.js).
import { applyFeel } from "./machines/feel-core.js";

const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const L = Math.log2;
const cutN = (hz) => c01((L(Math.max(200, hz || 400)) - L(400)) / (L(10000) - L(400)));
const cutHz = (n) => Math.round(Math.pow(2, L(400) + c01(n) * (L(10000) - L(400))));
const inst = (st, v) => ((st.instruments || (st.instruments = {}))[v] || (st.instruments[v] = {}));
const pct = (v) => Math.round(v * 100) + "%";
const kHz = (hz) => (hz >= 1000 ? (hz / 1000).toFixed(1) + " kHz" : Math.round(hz) + " Hz");

// ---------- WRITERS (URL back-compat law: these signatures/mappings are frozen) ----------
// Each is (st, axisId, v01) and mutates the resolved state in place, exactly as
// the old radar wrote. applyLayers dispatches to them; the tiles write the same
// numbers through song.js editLayer.

function writeVoice(st, v, id, val, lvlMax) {
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

export const WRITERS = {
  // the kernel ring writes nothing — its shape drives the BLEND (kernelcard.js)
  genre: null,
  chords: (st, id, v) => {
    if (id === "rate") { st.chordEvery = Math.max(2, Math.round(8 - v * 6)); return; }
    if (id === "key") { st.keyOffset = Math.round(v * 11); return; }
    if (id === "swing") { st.swing = +(v * 0.45).toFixed(3); return; }        // legacy URLs; master owns it now
    if (id === "humanize") { st.humanize = +(v * 0.6).toFixed(3); return; }   // legacy URLs; master owns it now
    // moving either harmony axis ARMS the reharmoniser: adventure with reharm
    // off is a knob wired to nothing (the old rule, kept verbatim)
    st.theory = Object.assign({}, st.theory || {}, { reharm: true, [id]: +v.toFixed(3) });
  },
  pad: (st, id, v) => writeVoice(st, "pad", id, v, 1.2),
  drums: (st, id, v) => {
    const d = inst(st, "drums");
    if (id.indexOf("op:") === 0) {
      // legacy per-op probability writes from old URLs. The new UI writes ops
      // through machines/drums.js (patch.kits), but an old link's layer entry
      // must keep landing on the same op.
      const i = +id.slice(3);
      let kitName = null;
      for (const sec of st.sections || []) if (sec.drums && sec.drums !== "off") { kitName = sec.drums; break; }
      if (!kitName || !window.CsdEngine) return;
      const kits = Object.assign({}, st.kits || {});
      if (!kits[kitName]) kits[kitName] = JSON.parse(JSON.stringify(window.CsdEngine.KITS[kitName] || { ops: [] }));
      const op = kits[kitName].ops[i];
      if (!op) return;
      // "always" is the ABSENCE of p, never p:1 (kit-machine.test.js law)
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
  bass: (st, id, v) => {
    if (id === "mutate") { st.rhythm = Object.assign({}, st.rhythm || {}, { complexity: +v.toFixed(3) }); return; }
    writeVoice(st, "bass", id, v, 2);
  },
  melody: (st, id, v) => {
    if (id.indexOf("w_") === 0) {
      const g = Object.assign({}, st.melodyGen || {});
      if (id === "w_step") g.step = Math.max(1, Math.round(1 + v * 3));
      else if (id === "w_leap") g.leap = +v.toFixed(3);
      else if (id === "w_rest") g.rest = +(v * 0.6).toFixed(3);
      else if (id === "w_legato") g.legato = +(0.2 + v * 0.8).toFixed(3);
      st.melodyGen = g;
      return;
    }
    writeVoice(st, "melody", id, v, 2);
  },
  samples: (st, id, v) => {
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
  // per-source sample writes for the NEW samples sheet: axis id "src:<id>:<field>"
  // rides the same layer so it round-trips URLs with zero new patch keys.
  // field ∈ vol|pitch|stretch|cutoff and flag fields wet|glitch|distant (v>=0.5).
  notefx: (st, id, v) => {
    const list = (st.pipes || []).map((p) => Object.assign({}, p));
    const i = list.findIndex((p) => p.id === id);
    if (v <= 0.001) { if (i >= 0) list.splice(i, 1); }        // to zero = out of the chain
    else if (i >= 0) list[i].prob = +v.toFixed(3);
    else list.push({ id, prob: +v.toFixed(3) });               // up from zero = added, at the end
    st.pipes = list;
  },
  // NEW — the master writer. Time feel + tempo, real ranges.
  master: (st, id, v) => {
    if (id === "bpm") st.bpm = Math.round(60 + v * 130);                 // 60..190
    else if (id === "swing") st.swing = +(v * 0.45).toFixed(3);          // 0..0.45
    else if (id === "humanize") st.humanize = +(v * 0.6).toFixed(3);     // 0..0.6
  },
};

// per-source sample writes (samples sheet): "src:<srcIdx>:<field>". Index, not
// id, keeps the axis id short and the URL small; the crate order is
// deterministic (the same resolved state every build).
const SRC_RX = /^src:(\d+):(vol|pitch|stretch|cutoff|wet|glitch|distant)$/;
const samplesBase = WRITERS.samples;
WRITERS.samples = (st, id, v) => {
  const m = SRC_RX.exec(id);
  if (!m) return samplesBase(st, id, v);
  const s = (st.foundSources || [])[+m[1]];
  if (!s) return;
  const f = m[2];
  if (f === "vol") s.vol = +(v * 0.6).toFixed(4);
  else if (f === "pitch") s.pitch = +(v * 1.6).toFixed(3);
  else if (f === "stretch") s.stretch = +v.toFixed(3);
  else if (f === "cutoff") s.cutoff = cutHz(v);
  else s[f] = v >= 0.5;                       // wet / glitch / distant flags
};

// ---------- READERS + FORMATTERS (what the tiles show) ----------
// readLayer(st, layer, axis) -> v01 of the RESOLVED state (the tile's fill when
// nothing is set); fmtLayer(layer, axis, v01) -> the live value in real units.
const lvlMaxOf = { pad: 1.2, melody: 2, bass: 2 };
function readVoice(st, v, id) {
  const I = inst(st, v), lvlMax = lvlMaxOf[v] || 2;
  switch (id) {
    case "level": return c01((I.level || 0) / lvlMax);
    case "cutoff": return cutN(I.cutoff);
    case "res": return c01(I.res || 0);
    case "attack": return c01((I.attack || 0) / 1.2);
    case "detune": return c01((I.detune || 0) / 0.05);
    case "send": return c01((I.send || 0) / 0.6);
    case "dsend": return c01((I.dsend || 0) / 0.6);
    case "voices": return c01(((I.voices || 1) - 1) / 7);
  }
  return 0;
}
export function readLayer(st, layer, id) {
  if (layer === "pad" || layer === "melody" || layer === "bass") {
    if (layer === "bass" && id === "mutate") return c01(st.rhythm ? +st.rhythm.complexity || 0 : 0);
    if (layer === "melody" && id.indexOf("w_") === 0) {
      const g = st.melodyGen || {};
      if (id === "w_step") return c01((((g.step != null ? g.step : 1)) - 1) / 3);
      if (id === "w_leap") return c01(g.leap != null ? g.leap : 0.18);
      if (id === "w_rest") return c01((g.rest != null ? g.rest : 0) / 0.6);
      if (id === "w_legato") return c01(((g.legato != null ? g.legato : 0.92) - 0.2) / 0.8);
    }
    return readVoice(st, layer, id);
  }
  if (layer === "drums") {
    const d = inst(st, "drums");
    if (id === "tune") return c01(((d.tune || 1) - 0.7) / 0.8);
    if (id === "send") return c01((d.send || 0) / 0.6);
    if (id === "dsend") return c01((d.dsend || 0) / 0.6);
    return c01((d[id] || 0) / 2);                              // kick/snare/hat/tom
  }
  if (layer === "chords") {
    const th = st.theory || {};
    if (id === "adventure") return c01(+th.adventure || 0);
    if (id === "color") return c01(+th.color || 0);
    if (id === "rate") return c01((8 - Math.max(2, st.chordEvery || 8)) / 6);
    if (id === "key") return c01((((st.keyOffset | 0) % 12) + 12) % 12 / 11);
  }
  if (layer === "samples") {
    const m = SRC_RX.exec(id);
    if (m) {
      const s = (st.foundSources || [])[+m[1]];
      if (!s) return 0;
      const f = m[2];
      if (f === "vol") return c01((s.vol || 0) / 0.6);
      if (f === "pitch") return c01((s.pitch != null ? s.pitch : 0.78) / 1.6);
      if (f === "stretch") return c01(s.stretch != null ? +s.stretch : 0.45);
      if (f === "cutoff") return cutN(s.cutoff || 2600);
      return s[f] ? 1 : 0;
    }
    if (id === "crackle") return c01((st.crackle || 0) / 0.8);
  }
  if (layer === "master") {
    if (id === "bpm") return c01(((st.bpm || 110) - 60) / 130);
    if (id === "swing") return c01((st.swing || 0) / 0.45);
    if (id === "humanize") return c01((st.humanize || 0) / 0.6);
  }
  return 0;
}
// real units for the tile's bottom-right value
export function fmtLayer(layer, id, v01) {
  const v = c01(+v01 || 0);
  if (id === "cutoff" || SRC_RX.test(id) && id.endsWith(":cutoff")) return kHz(cutHz(v));
  if (id === "voices") return String(Math.max(1, Math.round(1 + v * 7))) + " voice" + (Math.round(1 + v * 7) > 1 ? "s" : "");
  if (id === "attack") return (v * 1.2).toFixed(2) + " s";
  if (id === "tune") return (0.7 + v * 0.8).toFixed(2) + "x";
  if (layer === "master") {
    if (id === "bpm") return Math.round(60 + v * 130) + " bpm";
    if (id === "swing") return (v * 0.45).toFixed(2);
    if (id === "humanize") return (v * 0.6).toFixed(2);
  }
  if (layer === "chords") {
    if (id === "rate") return Math.max(2, Math.round(8 - v * 6)) + " beats";
    if (id === "key") return ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][Math.round(v * 11)];
  }
  if (layer === "melody" && id === "w_step") return "±" + Math.max(1, Math.round(1 + v * 3));
  if (id === "pitch" || /:pitch$/.test(id)) return (v * 1.6).toFixed(2) + "x";
  return pct(v);
}

// the mixer-tile sets per sheet (the SOUND tab + master; editors read these)
export const TILE_SETS = {
  voice: [   // melody / bass / pad SOUND tab
    { id: "level", label: "level" }, { id: "cutoff", label: "tone" },
    { id: "res", label: "bite" }, { id: "attack", label: "attack" },
    { id: "voices", label: "width" }, { id: "send", label: "space" },
    { id: "dsend", label: "echo" },
  ],
  drums: [   // drums SOUND tab
    { id: "kick", label: "kick" }, { id: "snare", label: "snare" },
    { id: "hat", label: "hat" }, { id: "tom", label: "tom" },
    { id: "tune", label: "tune" }, { id: "send", label: "space" },
    { id: "dsend", label: "echo" },
  ],
  master: [
    { id: "bpm", label: "tempo" }, { id: "swing", label: "swing" },
    { id: "humanize", label: "human" },
  ],
  chords: [
    { id: "adventure", label: "reach" }, { id: "color", label: "color" },
  ],
};

export const layerOfVoice = (voice) => voice;   // layer ids ARE the voice ids for the four voices

// Apply {layerId: {axisId: v}} to a resolved state, in place. Genre is skipped —
// its shape drives the BLEND, not a param write. UNCHANGED semantics: every
// layer/axis an old URL carries writes the same fields it always did.
export function applyLayers(st, layers) {
  if (!layers) return st;
  for (const layerId of Object.keys(layers)) {
    const w = WRITERS[layerId];
    const set = layers[layerId];
    if (!w || !set || typeof set !== "object") continue;
    for (const id of Object.keys(set)) {
      const v = +set[id];
      if (v >= 0 && v <= 1) w(st, id, v);
    }
  }
  return st;
}
export { applyFeel };
