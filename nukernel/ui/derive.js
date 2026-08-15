// ui/derive.js — everything DERIVED from a box: which genre it renders with,
// which kit it plays, what events it produces. Pure over its arguments — a
// function here takes the section (and, where it needs them, the phrase bank
// or the tempo) and imports NOTHING from state, which is what lets the audio
// tier and the ui tier share one copy without a cycle.
//
// Layer graph: deps -> state -> THIS FILE -> audio -> ui views -> main.
import { GENRES, MODES, SCALES, RATES, SWINGS, KITOPS, OPS,
         render, drums, bass, word, envelope, edges, groove,
         blank, VOX, PROGS, PERIODS, BREATHS, PIPESETS, withCadence } from "./deps.js";

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
export const LAYER_OPTS = new Set(["op", "artic", "clamp", "cmode", "scale", "oct", "part"]);
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
// WHICH LAYER OWNS EACH VOICE, as a flat list in voice order. It is the SAME
// walk audio/mixer.js voiceRoster makes — stackOf in order, g.voices apiece,
// an unknown genre skipped — so the two arrays are joinable BY INDEX: entry i
// of the roster is the chair, entry i here is the genre that put it there.
// The mixer only needs the chair; the mix table also needs the genre, because
// a genre carrying a signature `synth` plays that instead of its sampled
// `instr`, and a desk that labels a 303 "clean guitar" is lying about the
// thing you are about to fade.
export const voiceOwners = sec => {
  const out = [];
  for (const ent of stackOf(sec)) {
    const g = GENRES[ent.g];
    if (!g) continue;
    for (let v = 0; v < g.voices; v++) out.push(ent.g);
  }
  return out;
};
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
    // the operator reaches the kit SCHEDULE too — drums() prefers g.kits over
    // kit, so mapping the kit alone made every kit chip a no-op on a kits
    // genre (dnb's breakdown kept the full break under "no drums")
    if (g.kits) out.kits = sec.kit === "nodrums" ? null
      : g.kits.map(k2 => KITOPS[sec.kit](k2));
    if (sec.kit === "nodrums") out.ghost = null;   // the ghost lane is not in the kit
  }
  if (clamp != null) out.incClamp = +clamp;
  if (cmode) out.incMode = cmode;
  if (artic) out.artic = artic;
  if (sec.bassop === "nobass") out.nobass = true;
  else if (sec.bassop === "reese" || sec.bassop === "wobble") out.nobass = false;
  else if (sec.bassop) { out.nobass = false; out.bassStyle = sec.bassop; }
  // ---- the composition-depth surface (P4): the box speaks the same words
  // the genre table does, into the same kernel fields. Every branch below is
  // guarded on the field being SET, so a null field is byte-identical to an
  // absent one (the §33 unit gate mirrors this function and holds it).
  if (sec.key != null) out.key = +sec.key;         // semitones, post-registration
  if (sec.breath != null) out.maxHold = BREATHS[sec.breath];  // "none" = explicit 0
  if (sec.pipe) out.pipes = sec.pipe === "off" ? null : PIPESETS[sec.pipe];
  const pt = optOf(sec, ent, "part");              // per-layer, like scale
  if (pt && pt !== "auto") out.part = [pt];        // every voice of this render
  // PROG + CADENCE: a named progression overrides the genre's; "off" strips
  // it back to the degenerate triads. A cadence lands on the last bar of the
  // box's RENDERED WINDOW (nudge+len) — landing it on the form's last bar
  // put it outside every half-length section (a composed prechorus renders
  // bars [0, bars/2)) and the lift never sounded. For a default box (no len,
  // no nudge) the window IS the form, byte for byte. The prog is synthesized
  // from the roots when the genre never declared one, which is how the
  // composer's prechorus borrows the dominant's door on a triad genre.
  // (§31/§33 of the unit gate run this function for real.)
  if (sec.prog || sec.cadence) {
    const named = (sec.prog && sec.prog !== "off" && PROGS[sec.prog]) || null;
    const prog = named ||
      (sec.prog === "off" ? null
        : out.prog || (out.harmony === "cycle" && out.roots
                       ? out.roots.map(d => ({ d })) : null));
    // a NAMED progression makes the harmony a cycle: chordsOf ignores g.prog
    // under modal/emergent, so without this the chip validated, lit, and
    // changed nothing on every modal genre. Safe because the prog path never
    // reads g.roots, and harm() only runs on the no-prog branch.
    if (named && out.harmony !== "cycle") out.harmony = "cycle";
    const end = Math.max(0, sec.nudge | 0) + Math.max(1, sec.len || out.bars);
    out.prog = sec.cadence && prog ? withCadence(prog, end, sec.cadence) : prog;
  }
  // PERIOD: a sentence preset resolved to the kernel's bar schedule. "1bar"
  // is the explicit flat — it STRIPS a genre's own sentence, which null must
  // never do.
  if (sec.period) out.period = sec.period === "1bar" ? null
    : PERIODS[sec.period].map(w => w.map(k => OPS[k]));
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
  // THE AUTHORITY READS ITS OWN LAYER'S FIELDS. Layer-scope chips (artic,
  // scale, clamp, cmode, part…) write to the FOCUSED stack entry, and for a
  // single-layer box that entry is stack[0] — which genreOf(sec) alone never
  // saw, so a chip could light up and change nothing. Passing stack[0] makes
  // the render read what the palette wrote; with no entry-level values set
  // (every composed song, every shipped preset) it is byte-identical.
  const a0 = stackOf(sec)[0];
  const g = genreOf(sec, a0);
  // NUDGE is an absolute bar offset, not a phase modulo the form. Nudging a
  // fugue past bar 4 starts it AFTER the exposition, which is a different piece
  // of music from nudging within the first four bars — so it must not wrap.
  const len = Math.max(1, sec.len || g.bars), nudge = Math.max(0, sec.nudge);
  const total = Math.ceil((nudge + len) / g.bars) * g.bars;
  const barSteps = 16 / g.rate, from = nudge * barSteps, to = (nudge + len) * barSteps;

  const phrasesFor = e => (e.slots.length ? e.slots : [null])
    .map(i => word(i == null ? blank() : slots[i], opsOf(sec, e).map(o => OPS[o])));
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
    // A LAYER RIDES THE BOX'S KEY the way it rides its harmony — half the
    // band modulating is not a modulation, it is a mistake (§31's law). Its
    // part/pipes/breath come through genreOf like scale does, so a per-layer
    // `part` chip lands here; prog and period stay the authority's alone —
    // said EXPLICITLY, because {...L} carries them: a prog-carrying layer
    // (blues stacked on house) voice-led its own chords against the box's,
    // and a layered beatles kept its own four-bar sentence. prog is the
    // authority's (so the layer voice-leads the box's actual changes, and a
    // prog chip on the box reaches it); period is dropped outright.
    const lg = { ...L, harmony: g.harmony, roots: g.roots, rate: g.rate,
                 swing: g.swing, mode: g.mode, scale: lo.scale, incClamp: lo.incClamp,
                 incMode: lo.incMode, artic: lo.artic, kit: {}, ghost: null,
                 nobass: true, reg: v => L.reg(v) + 1,
                 key: g.key | 0, part: lo.part, pipes: lo.pipes,
                 maxHold: lo.maxHold, prog: g.prog || null, period: null };
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
