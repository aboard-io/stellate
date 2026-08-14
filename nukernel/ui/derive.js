// ui/derive.js — everything DERIVED from a box: which genre it renders with,
// which kit it plays, what events it produces. Pure over its arguments — a
// function here takes the section (and, where it needs them, the phrase bank
// or the tempo) and imports NOTHING from state, which is what lets the audio
// tier and the ui tier share one copy without a cycle.
//
// Layer graph: deps -> state -> THIS FILE -> audio -> ui views -> main.
import { GENRES, MODES, SCALES, RATES, SWINGS, KITOPS, OPS,
         render, drums, bass, word, envelope, edges, groove,
         blank, VOX } from "./deps.js";

export const isBlank = p => p.gate.every(g => !g);

/* ---------- box accessors ---------- */
// WHICH OPTIONS BELONG TO A LAYER, and which to the box. The split is the same
// rule stacking was built on: the authority owns everything that must be shared
// for the box to be one piece of music — the grid, the groove, the key centre,
// the section envelope — and everything else is per layer.
//
//   per layer   pattern ops, split/delete, spread, articulation, ramp limit
//               and mode, subject scale
//   per box     tempo, drums, bass, chord mode, fade, length, nudge
//
// A layer field left unset INHERITS the box's, so nothing diverges by accident
// — which is how the fugue ended up reading pentatonic against a quartal riff.
export const LAYER_OPTS = new Set(["op", "artic", "clamp", "cmode", "scale", "oct"]);
export const optOf = (sec, ent, k) => (ent && ent[k] != null ? ent[k] : sec[k]);
export const opsOf = (sec, ent) => (ent && ent.ops ? ent.ops : sec.ops);
// the synth knobs are an OBJECT of independent settings, so they inherit
// knob-by-knob rather than whole: setting the filter on a layer must not throw
// away the resonance it was inheriting from the box.
export const voxOf = (sec, ent, k) => (ent && ent.vox && ent.vox[k] != null
  ? ent.vox[k] : (sec.vox ? sec.vox[k] : null));
export const voxAll = (sec, ent) => {
  const out = {};
  for (const k of Object.keys(VOX)) { const v = voxOf(sec, ent, k); if (v != null) out[k] = v; }
  return Object.keys(out).length ? out : null;
};
export const octOf = (sec, ent) => +(optOf(sec, ent, "oct") || 0);

export const gid = sec => sec.stack[0].g;   // a box always has an authority
export const stackOf = sec => sec.stack || [];
export const focusOf = sec => Math.min(sec.focus || 0, stackOf(sec).length - 1);
export const focused = sec => stackOf(sec)[focusOf(sec)];
export const boxBars = b => b.len;
// HOW LONG A BOX ACTUALLY LASTS, in seconds at the given tempo: its bars, in
// this genre's own step units, at that step duration. A half-time genre's bar
// is twice as long in seconds as a normal one's, which is exactly the fact the
// bar count alone cannot tell you.
export const secsOf = (b, bpm) => {
  const g = genreOf(b);
  return boxBars(b) * (16 / g.rate) * (60 / bpm / 4);
};
export const mmss = t => Math.floor(t / 60) + ":" + String(Math.round(t % 60)).padStart(2, "0");
export const stackLabel = sec => stackOf(sec).map(e => GENRES[e.g].label).join(" + ");

// The genre a box actually renders with: its own definition, plus whatever the
// box overrides. Mode and tempo are not pattern operators and not envelopes —
// they are the third kind, a change to the GENRE the phrase is read through.
export const genreOf = (sec, ent) => {
  const key = (ent && ent.g) || gid(sec);
  const g = GENRES[key];
  const scale = optOf(sec, ent, "scale"), artic = optOf(sec, ent, "artic");
  const clamp = optOf(sec, ent, "clamp"), cmode = optOf(sec, ent, "cmode");
  const out = { ...g, ...(sec.mode ? { mode: MODES[sec.mode] } : {}),
                ...(scale ? { scale: SCALES[scale] } : {}),
                ...(sec.rate ? { rate: g.rate * RATES[sec.rate] } : {}) };
  if (sec.drumkit) out.drumkit = sec.drumkit;      // borrow another kit's SOUND
  if (sec.swing) out.swing = SWINGS[sec.swing];    // "straight" is 0, and means it
  if (sec.kit) {
    out.kit = KITOPS[sec.kit](g.kit || {}); out.fill = null;
    if (sec.kit === "nodrums") out.ghost = null;   // the ghost lane is not in the kit
  }
  if (clamp != null) out.incClamp = +clamp;
  if (cmode) out.incMode = cmode;
  if (artic) out.artic = artic;
  if (sec.bassop === "nobass") out.nobass = true;
  else if (sec.bassop === "reese" || sec.bassop === "wobble") out.nobass = false;
  else if (sec.bassop) { out.nobass = false; out.bassStyle = sec.bassop; }
  return out;
};

// WHICH SAMPLED KIT a box actually plays. The genre names one, the box may
// borrow another — and a genre that names NONE can still be given drums (four
// on the floor under a fugue), in which case it needs a real kit rather than the
// oscillator fallback, so it gets the plain acoustic one. A box with no drum
// lanes at all still gets null, because loading six wavs for a kit that will
// never fire is a fetch for nothing.
export const kitOf = sec => {
  if (sec.drumkit) return sec.drumkit;
  const g = GENRES[gid(sec)];
  if (g.drumkit) return g.drumkit;
  const k = sec.kit && KITOPS[sec.kit] ? KITOPS[sec.kit](g.kit || {}) : (g.kit || {});
  return Object.keys(k).length || g.ghost ? "acoustic" : null;
};

/* ---------- what a box contributes ---------- */
// MULTIPLE PHRASES combine by being dealt across the genre's own voices: voice v
// plays phrase v % n. Two phrases in a four-voice fugue is a double fugue; two
// phrases in acid is two 303s running different patterns, which is what acid
// records actually did. The voice count never changes — the phrases share it.
//
// one grouping pass instead of a filter per voice — sectionEvents used to be
// O(phrases × voices × events), which is the deep-composition cost centre
const byVoice = evs => {
  const m = new Map();
  for (const e of evs) { let a = m.get(e.v); if (!a) m.set(e.v, a = []); a.push(e); }
  return m;
};
export function sectionEvents(sec, slots) {
  const g = genreOf(sec);
  // NUDGE is an absolute bar offset, not a phase modulo the form. Nudging a
  // fugue past bar 4 starts it AFTER the exposition, which is a different piece
  // of music from nudging within the first four bars — so it must not wrap.
  const len = Math.max(1, sec.len || g.bars), nudge = Math.max(0, sec.nudge);
  const total = Math.ceil((nudge + len) / g.bars) * g.bars;
  const barSteps = 16 / g.rate, from = nudge * barSteps, to = (nudge + len) * barSteps;

  const phrasesFor = e => (e.slots.length ? e.slots : [null])
    .map(i => word(i == null ? blank() : slots[i], opsOf(sec, e).map(o => OPS[o])));
  const a0 = stackOf(sec)[0];
  const phrases = phrasesFor(a0);
  const nP = phrases.length, out = [];
  // REGISTER and the SYNTH KNOBS ride the events, not the genre. Both are
  // per-layer, and by the time the scheduler sees an event the only thing left
  // that says which layer it came from is the event itself — the authority's
  // notes carry no `layer` tag at all. Tagging here is what lets one box put a
  // dark 303 an octave down under a bright one on top.
  const aOct = 12 * octOf(sec, a0), aVox = voxAll(sec, a0);

  phrases.forEach((ph, pi) => {
    const byV = byVoice(render(ph, g, total));
    for (let v = pi; v < g.voices; v += nP) {
      let prev = null;
      for (const e of byV.get(v) || []) {
        out.push({ ...e, n: e.n + aOct, kind: "line", prev, lv: v,
                   vox: aVox, pad: g.realize(v) === "pad" });
        prev = e.n + aOct;
      }
    }
  });

  // Drums and bass follow the FIRST phrase — the kit is genre data anyway, and
  // the bass reads accents, which only one line can own.
  const lead = phrases[0];
  const dr = drums(lead, g, g.bars), loopSteps = g.bars * barSteps;
  for (let r = 0; r < total / g.bars; r++)
    for (const e of dr) out.push({ ...e, kind: "hit", t: e.t + r * loopSteps });
  for (const e of bass(lead, g, total))
    out.push({ ...e, kind: "bass", vox: voxAll(sec, null) });

  // LAYERS. Each extra genre contributes only its pitched voices, rendered
  // through the authority's harmony, rate and mode — its own kit, bass and
  // progression are dropped, because a box has one groove and one key. Voice
  // indices continue past the authority's so the lanes stay separate.
  let vBase = g.voices;
  for (const ent of stackOf(sec).slice(1)) {
    const extra = ent.g, L = GENRES[extra], lPh = phrasesFor(ent), lnP = lPh.length;
    // The layer inherits EVERY section-level override, not some of them. The
    // section's `scale` is the subject's alphabet, and leaving it out let the
    // authority read quartal while the layer read pentatonic — two alphabets
    // sounding at once, which is what "out of tune" was. `mode` was inherited
    // and `scale` was not, which is exactly the kind of near-miss that reads as
    // a tuning problem rather than a missing line of code.
    const lo = genreOf(sec, ent);
    const lg = { ...L, harmony: g.harmony, roots: g.roots, rate: g.rate,
                 swing: g.swing, mode: g.mode, scale: lo.scale, incClamp: lo.incClamp,
                 incMode: lo.incMode, artic: lo.artic, kit: {}, ghost: null,
                 nobass: true, reg: v => L.reg(v) + 1 };
    // the layer reads ITS OWN phrases, dealt across ITS voices
    const lOct = 12 * octOf(sec, ent), lVox = voxAll(sec, ent);
    lPh.forEach((ph, pi) => {
      const byV = byVoice(render(ph, lg, total));
      for (let v = pi; v < L.voices; v += lnP) {
        let prev = null;
        for (const e of byV.get(v) || []) {
          out.push({ ...e, n: e.n + lOct, kind: "line", prev, vox: lVox, lv: v,
                     pad: L.realize(v) === "pad", v: vBase + v, layer: extra });
          prev = e.n + lOct;
        }
      }
    });
    vBase += L.voices;
  }

  const win = out.filter(e => e.t >= from && e.t < to).map(e => ({ ...e, t: e.t - from }));
  // ORDER MATTERS, and this is the only order that makes sense. The envelope is
  // a curve over the whole section, so it must see the section as written; the
  // intro and outro REPLACE bars, so they must go last or the curve would fade
  // the fill it never knew about.
  const span = len * barSteps;
  // GROOVE LAST, so the drum fill grooves too. It is the only stage that moves
  // events in TIME rather than in pitch or level, and it has to see the final
  // stream — a fill written after the groove would be the one bar in the section
  // sitting flat on the grid, which is exactly what you notice.
  return { g, bars: len, vBase,
           ev: groove(edges(envelope(win, sec.env, span), sec.intro, sec.outro, span, barSteps),
                      sec.groove, barSteps, 1) };
}

/* ---------- the shared render ---------- */
// ONE render per change, not three. draw(), compile() and writeSrc() each used
// to call sectionEvents() themselves, so every chip click rendered the current
// box three times over. The cache is per box object, keyed on a signature of
// the box AND the phrases it references — a scrub mutates a phrase in place,
// so slot IDS alone would never invalidate.
const rcache = new WeakMap();               // box -> { sig, out }
export function sectionRender(sec, slots) {
  const ids = new Set();
  for (const e of stackOf(sec)) for (const i of e.slots) ids.add(i);
  const sig = JSON.stringify(sec) + "§" +
    [...ids].map(i => i + ":" + JSON.stringify(slots[i])).join("");
  const c = rcache.get(sec);
  if (c && c.sig === sig) return c.out;
  const out = sectionEvents(sec, slots);
  rcache.set(sec, { sig, out });
  return out;
}
