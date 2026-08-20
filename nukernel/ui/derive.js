// ui/derive.js — everything DERIVED from a box: which genre it renders with,
// which kit it plays, what events it produces. Pure over its arguments — a
// function here takes the section (and, where it needs them, the phrase bank
// or the tempo) and imports NOTHING from state, which is what lets the audio
// tier and the ui tier share one copy without a cycle.
//
// Layer graph: deps -> state -> THIS FILE -> audio -> ui views -> main.
import { GENRES, MODES, SCALES, RATES, SWINGS, KITOPS, OPS,
         render, drums, bass, word, envelope, edges, groove,
         blank, VOX, PROGS, PERIODS, BREATHS, PIPESETS, withCadence,
         instrOf, partOf, PARTNAMES,
         chordsOf, MODE, harmonizeStage,
         tempoWarp, seatNote, prng, TOMS } from "./deps.js";

export const isBlank = p => p.gate.every(g => !g);

/* ---------- the phrase contour, as one SVG path ---------- */
// THE PICTURE OF A PHRASE, and there is exactly one of it. It was local to
// ui/editor.js while the slot rail was its only reader; the song row draws the
// same contour as a chip per phrase now, and two copies of a drawing routine
// is how the pad and the chip end up disagreeing about what a phrase looks
// like. It lives here because it is what this file is for: pure over its
// argument, imported by views, importing nothing.
//
// Gated steps become line segments and rests become gaps: M starts a run, L
// continues it. deg −7..+7 maps top-to-bottom into a 64×26 viewBox — the pad's
// units, which the chip simply scales down.
export function contourPath(p) {
  const runs = [];
  let run = null;
  for (let k = 0; k < 16; k++) {
    if (!p.gate[k]) { run = null; continue; }
    const x = k * 4 + 2, y = (23 - ((p.deg[k] + 7) / 14) * 20).toFixed(1);
    if (!run) runs.push(run = []);
    run.push(x + " " + y);
  }
  // a lone gate still needs ink: a zero-length segment renders as a dot
  // under the round linecap, but only if there IS a segment
  return runs.map(r => "M" + r.join(" L") + (r.length === 1 ? " L" + r[0] : "")).join(" ");
}

/* ---------- box accessors ---------- */
// WHICH OPTIONS BELONG TO A LAYER, and which to the box. The split is the same
// rule stacking was built on: the authority owns everything that must be shared
// for the box to be one piece of music — the grid, the key centre, the section
// envelope — and everything else is per layer. (The groove sits a level higher
// still: it is the SONG's, and arrives as sectionEvents' own argument.)
//
//   per layer   pattern ops, split/delete, spread, articulation, ramp limit
//               and mode, subject scale
//   per box     tempo, drums, bass, chord mode, fade, length, nudge
//
// A layer field left unset INHERITS the box's, so nothing diverges by accident
// — which is how the fugue ended up reading pentatonic against a quartal riff.
export const LAYER_OPTS = new Set(["op", "artic", "clamp", "cmode", "scale", "oct",
                                   "part"]);
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

// WHICH CHAIR A VOICE SITS IN, as the base role name the song's INSTRUMENT
// POOL is keyed on. It is the scheduler/mixer's own assignment, read the same
// three-step way the mixer's roster reads it: the layer's `part` chip first
// (genreOf puts it on every voice of that render), else the box's, else the
// genre's own scheme (kernel partOf — the realize() shim answering `line` or
// `pad` for the genres without one); anything the role table does not name
// answers to `line`, chairKeys' law. NOTE this is the BASE chair — the desk's
// addresses add an ordinal (`line2`), the pool deliberately does not: the
// band has one lead player however many lead chairs a section seats.
export const chairOf = (sec, ent, v) => {
  const pt = optOf(sec, ent, "part");
  const g = GENRES[(ent && ent.g) || gid(sec)];
  const p = pt && pt !== "auto" ? pt : partOf(g, v);
  return PARTNAMES[p] ? p : "line";
};
// THE INSTRUMENT A CHAIR ACTUALLY PLAYS, as one answer with one fallback:
// the SONG's pool pick for the voice's chair ("the band is hired for the
// record" — one instrument per chair, for every section at once), else the
// genre's `instr` per voice (instruments.js instrOf). The pool arrives as an
// argument (ui/state.js POOL) because this file is pure over what it is given
// — it is a song fact the way the groove is, and the groove arrives the same
// way. By the time the scheduler sees an event the only thing that says which
// layer it came from is the event's `layer` tag (absent = the authority), so
// the lookup is by genre key — safe because toggle() never lets one genre
// appear twice in a stack. Read by the live scheduler, the register home, the
// asset list and the mix desk, so a cast chair is one fact everywhere at once.
export const poolInstrOf = (sec, owner, v, pool) => {
  if (!pool) return null;
  const ent = stackOf(sec).find(x => x.g === owner) || null;
  return pool[chairOf(sec, ent, v)] || null;
};
// A GUEST BRINGS ITS LINE, NOT ITS INSTRUMENT — and this is the measured law of
// this project rather than a taste. the inheritance study put numbers on what
// crossing two genres actually predicts: ARCHITECTURE travels (harmony 87%,
// realize 84%, rate 76%) and MATERIAL does not (kit 16%, roots 7%, instr 3%).
// The composer layers the FUNCTION genres — solo/vocal/backing/riff/pad — onto
// a record to add a topline, a pad, a counter-line; that is architecture, and it
// is the whole reason they exist. But each of them also declares a literal
// `instr`, and that instrument is what played: measured on a composed Chicago
// 1986 house song, ten boxes of `house` carried four of `vocal` (solo_vox), two
// of `pad` (warm_pad) and one of `drone` (slow_strings). Paul heard the result
// exactly: "All piano, vox, and nothing vaguely acidlike."
//
// So a function layer is seated at the HOST's instrument for the same chair —
// the authority is stack[0], the genre whose record this is. A house record's
// topline is played by what house plays; a hymn's is played by what the hymn
// plays. The layer still contributes everything it was added FOR (its line, its
// rhythm, its register, its part), which is the 84% that travels.
//
// A guest that is a REAL genre (counterpoint on a pop single, the string
// quartet the studio families deal) is deliberately left alone here: bringing
// its own colour is the point of that gesture. Its material problem is a
// different one, and it is smaller — a handful of sections, not every record.
const FUNCTION_GENRES = ["solo", "vocal", "backing", "riff", "pad"];
export const hostInstrOf = (sec, owner, v) => {
  if (FUNCTION_GENRES.indexOf(owner) < 0) return null;
  const host = stackOf(sec)[0];
  if (!host || !host.g || host.g === owner || !GENRES[host.g]) return null;
  // the host's own chair for this voice: clamp into its instr list the way
  // instruments.js does, so a two-voice host lending to a one-voice guest
  // answers with something rather than undefined
  try { return instrOf(host.g, v); } catch (e) { return null; }
};
export const instrIdOf = (sec, owner, v, pool) =>
  poolInstrOf(sec, owner, v, pool) || hostInstrOf(sec, owner, v) || instrOf(owner, v);
export const stackOf = sec => sec.stack || [];
export const focusOf = sec => Math.min(sec.focus || 0, stackOf(sec).length - 1);
export const focused = sec => stackOf(sec)[focusOf(sec)];
// WHICH LAYER OWNS EACH VOICE, as a flat list in voice order. It is the SAME
// walk audio/desk.js voiceRoster makes — stackOf in order, g.voices apiece,
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
// NAMES THE KEY IT CANNOT FIND rather than throwing on it. Every other reader
// here indexes a genre it has already established is there; this one is called
// from labels and chyrons that repaint on their own clock, and there is exactly
// one window in which the table can be missing a key a box still names — the
// LAB's audition genre, which is installed for as long as the candidate sounds
// and deleted the instant it stops (ui/lab.js §5). A repaint landing inside
// that window should print the key, not take the page down.
export const stackLabel = sec =>
  stackOf(sec).map(e => (GENRES[e.g] || { label: e.g }).label).join(" + ");

// The genre a box actually renders with: its own definition, plus whatever the
// box overrides. Mode and tempo are not pattern operators and not envelopes —
// they are the third kind, a change to the GENRE the phrase is read through.
//
// ONE LOOKUP PATH, AND IT IS THIS ONE. A genre invented in the LAB and kept
// into the song is INSTALLED IN `GENRES` under its own namespaced key
// (`lab.<slug>` — song.js SESSION_NS, ui/state.js installs them before the song
// publishes), so it is resolved right here, by the same index, on the same
// line, as a genre that has been in the catalog for two years. That is
// deliberate and it is the whole design: a session genre is not a special case
// carried through the scheduler, the mixer, the pool and the bounce — it is a
// genre. Nothing below this line knows the difference, and nothing should.
export const genreOf = (sec, ent) => {
  const key = (ent && ent.g) || gid(sec);
  const g = GENRES[key];
  const scale = optOf(sec, ent, "scale"), artic = optOf(sec, ent, "artic");
  const clamp = optOf(sec, ent, "clamp"), cmode = optOf(sec, ent, "cmode");
  const out = { ...g, ...(sec.mode ? { mode: MODES[sec.mode] } : {}),
                ...(scale ? { scale: SCALES[scale] } : {}),
                ...(sec.rate ? { rate: g.rate * RATES[sec.rate] } : {}) };
  // A BOX THAT NAMES A BASS PATTERN HAS A BASS. `nobass` is the GENRE's
  // statement about itself (a pad plays no bass), and a section that asks for
  // a walking bass is overruling exactly that — which is what lets the couch
  // hire one onto a record that never had one (ui/rubin.js "hire"). The
  // explicit "nobass" op still means silence, and a box that says nothing is
  // byte-identical.
  if (sec.bassop && sec.bassop !== "nobass") out.nobass = false;
  if (sec.drumkit) out.drumkit = sec.drumkit;      // borrow another kit's SOUND
  // (no sec.swing branch: the swing is the SONG's now, like the groove — it
  // arrives as sectionEvents' own argument and lands on the genre there)
  if (sec.kit) {
    // A KIT WORD ON A KITLESS GENRE IMPLIES A FOUR UNDERNEATH. The operators
    // are kit->kit, so on a genre that never had lanes every word but `four`
    // and `offbeat` returned nothing — which meant the couch could give a pad
    // record drums and then lose them again by asking for a shuffle. Asking
    // for a shuffled kit on a record with no kit means a shuffled four.
    const base = Object.keys(g.kit || {}).length ? (g.kit || {})
      : (sec.kit === "nodrums" ? {} : KITOPS.four({}));
    out.kit = KITOPS[sec.kit](base); out.fill = null;
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
  // the same base law genreOf applies: a kit word on a kitless genre implies
  // a four underneath, so asking a hired kit to shuffle does not delete it
  const base = Object.keys(g.kit || {}).length ? (g.kit || {})
    : (sec.kit && sec.kit !== "nodrums" ? KITOPS.four({}) : {});
  const k = sec.kit && KITOPS[sec.kit] ? KITOPS[sec.kit](base) : base;
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
// THE MASTER CONTEXT — the box's ONE harmonic authority, as data: the
// authority genre's chord timeline expressed in the box's key, plus the
// governing scale, plus the law of who answers to it. This is the design
// Paul approved in one sentence ("when we add patterns and sub voices to
// sections, that is when a tonality happens — there should be a master
// harmonization engine"), and the SONG half of it is already structural:
// compose.js writes one genre's sections, the layer law hands every stacked
// genre the authority's harmony/prog/mode/key, and a modulation is a section
// `key` the authority itself carries — so expressing the timeline in the
// authority's key IS expressing it in the song's. Exported on its own so the
// unit gate (§48) measures through the SAME reading the engine corrects by —
// a measurement and an engine that compute the context separately is how
// they drift apart.
//
// `conform` is the whole don't-lose-what-we-have law in one predicate: only
// layer-tagged line events answer. The authority (every phrase of it, plus
// drums and bass) IS the tonality and never moves; a layer PAD voices the
// authority's own chords by construction (lg.prog is g.prog below) so it is
// the harmony already, not a voice speaking over it.
export function masterCtx(sec, slots) {
  const a0 = stackOf(sec)[0];
  const g = genreOf(sec, a0);
  const slot = a0.slots.length ? slots[a0.slots[0]] : blank();
  const subj = word(slot, opsOf(sec, a0).map(o => OPS[o]));
  const key = g.key | 0, md = g.mode || MODE;
  const pcK = n => (((n + key) % 12) + 12) % 12;
  const scalePcs = new Set(md.map(pcK));
  // chords come back KEYED, exactly as kernel render keys them for its pipes:
  // every event pitch already carries g.key, so the timeline must too
  const chords = bar => chordsOf(subj, g, bar).map(c => ({ ...c,
    pcs: c.pcs.map(n => n + key), pcSet: new Set(c.pcs.map(pcK)) }));
  return { chords, scalePcs, stepsPerBar: subj.deg.length, rate: g.rate,
           conform: e => !!e.layer && e.kind === "line" && e.n != null &&
                         !e.pad && e.part !== "pad" };
}

// `songGroove` / `songSwing` are the SONG's (ui/state.js GROOVE / SWING),
// handed in as arguments because this file is pure over what it is given —
// they are song facts the way the tempo is, and the tempo arrives the same
// way (secsOf).
export function sectionEvents(sec, slots, songGroove, songSwing) {
  // THE AUTHORITY READS ITS OWN LAYER'S FIELDS. Layer-scope chips (artic,
  // scale, clamp, cmode, part…) write to the FOCUSED stack entry, and for a
  // single-layer box that entry is stack[0] — which genreOf(sec) alone never
  // saw, so a chip could light up and change nothing. Passing stack[0] makes
  // the render read what the palette wrote; with no entry-level values set
  // (every composed song, every shipped preset) it is byte-identical.
  const a0 = stackOf(sec)[0];
  // AN UNREGISTERED GENRE RENDERS AS SILENCE, NOT A CRASH — the law
  // voiceOwners already writes ("an unknown genre skipped"), applied here
  // too. The window is real and measured: the dice replaces GENRES' lab.*
  // entries and the SONG's boxes in separate steps, and a compile landing
  // between them (the gate's timing; the live transport's recompile-on-
  // commit if you roll while playing) walked a stack whose genre had just
  // been swept — GENRES held the new roll's six sections while SONG still
  // held the old record's one box, and reading .voices off the vanished
  // authority killed the schedule. A transient frame without its genre
  // renders empty; the roll's final push recompiles and the section comes
  // back whole.
  if (!GENRES[(a0 && a0.g) || gid(sec)]) return [];
  const g = genreOf(sec, a0);
  // THE SONG'S SWING lands on the authority's genre, first thing: the kernel
  // reads g.swing per note, the layers copy it (lg below), and the drums and
  // bass render through this same g — one assignment, everything leans
  // together. "straight" is 0, and means it — the override a null never is;
  // null leaves the genre's own lean standing, because swing is identity there.
  if (songSwing) g.swing = SWINGS[songSwing];
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
    out.push({ ...e, kind: "bass", n: e.n + 12 * (+(sec.boct || 0)),
               vox: voxAll(sec, null) });

  // LAYERS. Each extra genre contributes only its pitched voices, rendered
  // through the authority's harmony, rate and mode — its own kit, bass and
  // progression are dropped, because a box has one groove and one key. Voice
  // indices continue past the authority's so the lanes stay separate.
  let vBase = g.voices;
  for (const ent of stackOf(sec).slice(1)) {
    const extra = ent.g, L = GENRES[extra], lPh = phrasesFor(ent), lnP = lPh.length;
    if (!L) continue;                 // a layer mid-swap: skipped, same law as above
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

  // THE HARMONIZE STAGE (kernel.js harmonizeStage): the box has one tonality
  // — the authority's — and every added voice speaks it. Chord tones seat the
  // beats, out-of-key notes fold into the governing scale, and no layer holds
  // a minor second or a stacked unison against another voice. Runs on the
  // whole stream BEFORE the window/envelope/edges/groove (pitch before time)
  // and upstream of the transport's register fold; a single-layer box takes
  // the else-branch and renders byte-identical, which §48 of the unit gate
  // holds across all genres × 3 seeds against pre-change hashes.
  //
  // THE EMERGENT RULING, genre by genre (the "does a drone opt out" question):
  // the three `harmony: "emergent"` anchors — fugue, spem, counterpoint — are
  // all the COUNTERPOINT family, and none opts out. Their identity lives in
  // the authority voices, which this stage never touches; their harm() walk
  // IS a per-bar timeline (nobody wrote the chords down, but the voices did),
  // and a layer agreeing with what the counterpoint sounds at that bar is the
  // continuo's job description. The drones the question worried about are not
  // emergent at all: drone is `modal` (a one-chord timeline is exactly the
  // vamp a layer should sit inside) and sludge/ambient are `cycle` (they
  // WROTE their timelines down) — and in every case the drone itself is an
  // authority voice, so nothing here can stop it droning.
  const evAll = vBase > g.voices ? harmonizeStage(out, masterCtx(sec, slots)) : out;

  const win = evAll.filter(e => e.t >= from && e.t < to).map(e => ({ ...e, t: e.t - from }));
  // ORDER MATTERS, and this is the only order that makes sense. The envelope is
  // a curve over the whole section, so it must see the section as written; the
  // intro and outro REPLACE bars, so they must go last or the curve would fade
  // the fill it never knew about.
  //
  // The envelope takes the BAR as well as the span now, for the one shape that
  // is a hole rather than a curve: `drop` cuts the section's last eighth, and
  // a hole is measured in bars, not in eighths of however long this section
  // happens to be (kernel.js says why). Every other shape ignores the argument.
  const span = len * barSteps;
  // GROOVE LAST, so the drum fill grooves too. It is the only stage that moves
  // events in TIME rather than in pitch or level, and it has to see the final
  // stream — a fill written after the groove would be the one bar in the section
  // sitting flat on the grid, which is exactly what you notice. The groove is
  // the SONG's (one drummer for the record), applied here because this is
  // where the section's final stream exists.
  const ev = groove(edges(envelope(win, sec.env, span, barSteps), sec.intro, sec.outro, span, barSteps),
                    songGroove, barSteps, 1);
  // (a singEvents pass appended `sing` events here — a syllable and a voice
  // index rather than a note and a chair — after the groove, so the words
  // followed the tune off the grid. It left with the espeak organ on
 // 2026-08-17; kernel-daw.html holds the tombstone. The stream is the band's
  // again, and every event in it is a note, a hit or a bass note.)
  return { g, bars: len, vBase, ev };
}

/* ---------- a stable seed from a string ---------- */
// djb2, because a seed has to be stable across reloads and machines: the same
// song must deal the same lead-in and the same bar seeds on every device.
const strSeed = s => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
};
// (singEvents and its pcsAtOf chord reader stood here — the plan half of the
// espeak singer, which asked which chord was sounding under a step so a
// syllable could land on a chord tone. Both went with the organ on
// 2026-08-17.)

/* ---------- the shared render ---------- */
// ONE render per change, not three. draw(), compile() and writeSrc() each used
// to call sectionEvents() themselves, so every chip click rendered the current
// box three times over. The cache is per box object, keyed on a signature of
// the box AND the phrases it references — a scrub mutates a phrase in place,
// so slot IDS alone would never invalidate.
const rcache = new WeakMap();               // box -> { sig, out }
export function sectionRender(sec, slots, songGroove, songSwing) {
  const ids = new Set();
  for (const e of stackOf(sec)) for (const i of e.slots) ids.add(i);
  // the song groove AND swing are IN the signature: neither is a key of `sec`
  // any more, and a cache that ignored them would keep serving the old feel
  // after a change
  // ...AND THE GENRE'S OWN VERSION. A session genre can be REWRITTEN IN
  // PLACE under an unchanged key (the drum machine at nukernel/drums.html
  // does it on every word), and a signature that read only the box served
  // the old render forever — "I tap groove and nothing happens to the
  // sound". A writer that mutates a genre bumps its `__v`; a genre that
  // never moves has none and this term is the empty string it always was.
  const gv = stackOf(sec).map(e => e.g + ":" + ((GENRES[e.g] || {}).__v || 0)).join(",");
  const sig = JSON.stringify(sec) + "§g:" + (songGroove || "") +
    "§s:" + (songSwing || "") + "§gv:" + gv + "§" +
    [...ids].map(i => i + ":" + JSON.stringify(slots[i])).join("");
  const c = rcache.get(sec);
  if (c && c.sig === sig) return c.out;
  const out = sectionEvents(sec, slots, songGroove, songSwing);
  rcache.set(sec, { sig, out });
  return out;
}

/* ---------- the song as a bar list ---------- */
// THE ONE WALK from boxes to bars, and the two facts a bar list knows that no
// single section can: what happens at a SEAM (the voice about to enter may
// start before the bar line) and how long a bar actually LASTS (the tempo
// moves). It lived inside the transport's own timeline builder, so both of those
// could only ever be proved in a browser. They are SCORE facts and they are
// derived here with everything else; the transport keeps exactly the half that
// needs the audio tier — the register home, which has to ask the sampler how
// wide an instrument's window is — and the offline bounce walks the transport's
// result, so there is still ONE bar list and one clock under both.

/* ---------- 1. the tempo map ---------- */
// "Tempo changes never happen. But music slows down and speeds up." So nothing
// here is a tempo EVENT and no section carries a metronome mark: there is one
// continuous rate curve over the whole song, and kernel.js tempoWarp integrates
// it into bar durations. The curve is derived from the ARRANGEMENT by default,
// because a listener should hear the music breathe without setting anything.
//
// Three things shape it, in this order:
//   BASE   a section SITS at a tempo — a breakdown a little under it, a drop a
//          little over. Never as a step: the node AT a seam is the average of
//          the two sections' rates, so the band arrives at the new feel instead
//          of being told about it.
//   SEAM   one gesture per section end, chosen by what the music is doing: a
//          ritard into a breakdown or an outro, a small lean into a chorus, an
//          accelerando where a build runs at its drop, and the big final ritard
//          at the end of the song. The gesture lands on the closing bar's
//          second half and the next bar recovers over its first — which is a
//          musician, not an automation lane.
//   DRIFT  the whole thing breathes underneath: the parent's own rubato law
//          (engine/csd-engine.js — tempo(b)/tempo0 = 1 + depth·cos(2πb/P + φ)),
//          read at every node, at well under a percent.
//
// Every input is the song's own content — roles, box order, genre keys, bar
// counts — so two compiles of one song give one clock, and an edit that changes
// the arrangement changes the breathing with it. There is no per-section tempo
// control and there will not be one: the tempo is a fact about the SONG.
const TEMPOROLE = {
  intro: 0.988, verse: 1, prechorus: 1.004, build: 1.006, chorus: 1.008,
  drop: 1.012, breakdown: 0.976, bridge: 0.994, solo: 1.004, outro: 0.978,
  drums: 1, bass: 1, groove: 1,          // the beds keep the song's own tempo
};
// compose.js's own rule (its PLANCUE table): only two cues name a plan role,
// because the loader stores a prechorus as a verse and a build as a breakdown
// and keeps the honest name in `cue`. Reading `role` alone would put a build's
// accelerando under a breakdown's ritard.
const PLANCUE = { prechorus: 1, build: 1 };
const roleOf = s => (s && (PLANCUE[s.cue] ? s.cue : s.role)) || null;
const LIFT = { chorus: 1, drop: 1, solo: 1 };            // a section arrived AT
const PUSH = { build: 1, prechorus: 1, breakdown: 1 };   // ...and one that runs at it
const DRIFT = 0.006;                                     // the human wobble, ±0.6%

// TWO NODES PER BAR PLUS ONE, and every bar SHARES its ends with its
// neighbours. That shared array IS the continuity law: no gesture below can put
// a step into the tempo even by accident, because there is only one number at
// each seam and both bars read it.
function tempoNodes(bars, song, seed) {
  const n = bars.length, rnd = prng(seed);
  const base = bars.map(b => TEMPOROLE[roleOf(song[b.si])] || 1);
  const N = new Array(2 * n + 1);
  for (let k = 0; k <= 2 * n; k++)
    N[k] = k % 2 ? base[k >> 1]
      : (k === 0 ? base[0] : k === 2 * n ? base[n - 1]
         : (base[k / 2 - 1] + base[k / 2]) / 2);
  const many = new Set(bars.map(b => b.si)).size > 1;
  for (let i = 0; i < n; i++) {
    const nxt = i === n - 1 ? null : bars[i + 1];
    if (nxt && nxt.si === bars[i].si) continue;          // mid-section: no gesture
    const ra = roleOf(song[bars[i].si]), rb = nxt ? roleOf(song[nxt.si]) : null;
    const r = rnd();
    let g;
    if (!nxt) {
      // THE FINAL RITARD, and only when there is a song to end. One box on
      // loop that slowed down every pass would be a hiccup, not an ending.
      if (!many) continue;
      g = -(0.09 + 0.05 * r);
    } else if (PUSH[ra] && LIFT[rb]) g = 0.020 + 0.020 * r;   // the build runs at it
    else if (rb === "breakdown" || rb === "outro") g = -(0.035 + 0.025 * r);
    else if (LIFT[rb]) g = -(0.012 + 0.012 * r);              // the chorus is leaned into
    else g = -(0.008 + 0.014 * r);                            // every seam breathes a little
    N[2 * i + 2] *= 1 + g;
    N[2 * i + 1] *= 1 + g * 0.35;
  }
  const P = 5 + (seed % 5), ph = ((seed >>> 5) % 1000) / 1000 * 2 * Math.PI;
  for (let k = 0; k <= 2 * n; k++)
    N[k] *= 1 + DRIFT * Math.cos(2 * Math.PI * (k / 2) / P + ph);
  return N;
}
function warpBars(bars, song) {
  if (!bars.length) return;
  const seed = strSeed(bars.map(b => b.si + ":" + roleOf(song[b.si]) + ":" +
                                     gid(song[b.si]) + ":" + b.barSteps).join("|"));
  const N = tempoNodes(bars, song, seed);
  const W = tempoWarp(bars.map((b, i) =>
    ({ steps: b.barSteps, rs: [N[2 * i], N[2 * i + 1], N[2 * i + 2]] })));
  bars.forEach((b, i) => {
    const w = W[i];
    // barSteps STOPS BEING THE GRID AND BECOMES THE CLOCK. It is what every
    // reader multiplies by the step duration — the transport's tick, the
    // bounce's chunk plan, the singer's bar length — so warping it here is what
    // makes the live graph and the rendered carrier honour one tempo map
    // without either of them knowing there is one. `steps` keeps the musical
    // grid for anyone who needs to ask what a bar is made of.
    b.steps = w.steps; b.barSteps = w.dur; b.tempo = [w.r0, w.r1];
    // WRITTEN IN PLACE, on purpose. Every event in a bar is already a fresh
    // copy this walk made (the bucketing above, and the pickups' own objects) —
    // nothing outside the bar list holds one, and the section cache holds the
    // originals — so a second full copy here would only be a copy. compile()
    // runs on every editor scrub while playing, and this pass touches every
    // event in the song.
    for (const e of b.ev) {
      const off = w.at(e.off);
      if (e.dur > 0) e.dur = Math.max(1e-4, w.at(e.off + e.dur) - off);
      e.off = off;
    }
  });
}

/* ---------- 2. the lead-ins ---------- */
// "Solos have a bar or a few notes of lead-in, as do drum phrases and so
// forth." A voice about to ENTER may start before the bar line it enters on: a
// horn pickup before the solo, a bass run into the change, a fill under the
// last two beats before the drums arrive. What makes this derivable rather than
// another chip is that the arrangement already says who enters when — a lane
// that plays in the next box's first bar and NOWHERE in this box is an
// entrance, and nothing else is.
//
// THE LAWS, in the order they matter:
//   LANDS   the pickup's last note ends ON the bar line it leads to, exactly.
//           It never plays the arrival; the entering voice does that.
//   BORROWS it takes the closing bar's last beat — or half bar, or a whole bar
//           when the lane it announces was silent for the entire box — and
//           THINS what was there: the outgoing box's own lines of that kind
//           stop at the borrow, sustains are trimmed to it, and a drum quote
//           adds no hit where the kit already has one. (engine/csd-engine.js's
//           kit fill is the same idea: QUOTE the section's own pattern and
//           crescendo it, with one pickup hit into the downbeat, rather than
//           pasting generic toms over what is playing.)
//   SPEAKS  every pitch is seated on the chord it is arriving INTO — through
//           kernel.seatNote, the same law the harmonize stage seats layers with
//           — and folded to within an octave of the note it leads to, so the
//           register home the transport decides for that chair carries the
//           pickup with it and a pickup can never be an octave from its own
//           arrival.
// A pickup is tagged `pu` and carries `puSi`, the box it belongs to, because it
// SOUNDS in the outgoing box's bar but BELONGS to the incoming box's voice —
// the transport reads puSi for the register home, and a drum pickup carries its
// own `kit` for the same reason: the drums entering next box must arrive on
// next box's kit even though the bar is this box's.
const laneKey = e => e.kind === "hit" ? "drums" : e.kind === "bass" ? "bass"
  : (e.kind === "line" && !e.pad
     ? "line:" + (e.layer || "") + ":" + (e.lv == null ? e.v : e.lv) : null);
// SEMITONES RELATIVE TO THE NOTE BEING LED TO — the parent's lick vocabulary
// (engine/csd-engine.js lickEvents RUNS: pentatonic climb, chromatic approach,
// enclosure turn, fall from the fifth) at nukernel's scale. They are written
// chromatically and seated afterwards, which is exactly how the parent gets a
// blues approach out of a diatonic table.
const PICKUPS = {
  approach: [-2, -1],                    // two notes, in from below
  scoop:    [-5, -3, -1],
  climb:    [-12, -7, -5, -3, -1],
  turn:     [-3, 2, 1],                  // the enclosure: under, over, in
  fall:     [7, 4, 2],                   // down from the fifth
};
const PICKKEYS = Object.keys(PICKUPS);

// the chord the pickup is arriving INTO: the incoming box's own harmony at the
// first bar it renders (masterCtx keys the timeline in the box's key, and a
// nudged box starts partway through its progression — so the bar is absolute)
// what the seating law counts as legal at that arrival: the chord's own colour
// plus the governing scale — kernel.js seatNote's `legalWith` set, read from
// outside so the pickup's own tie-breaks cannot smuggle a note past it
const legalPc = (n, arr) => {
  const pc = ((n % 12) + 12) % 12;
  return arr.c.pcSet.has(pc) || arr.scalePcs.has(pc);
};
function arrivalChord(sec, slots) {
  const ctx = masterCtx(sec, slots);
  const cs = ctx.chords(Math.max(0, sec.nudge | 0));
  const c = cs.find(x => x.start === 0) || cs[0];
  return c ? { c, scalePcs: ctx.scalePcs } : null;
}
// the pitched pickup — one line, or the bass, announced by a run that lands on
// the bar line. Everything of the same KIND inside the borrowed window makes
// room for it (that is the thinning law); pads and drums play on underneath,
// because the harmony the pickup is leaning against has to stay audible.
function pitchedLeadIn(bar, tBase, secB, slots, e0, siB, rnd) {
  const arr = arrivalChord(secB, slots);
  if (!arr || e0.n == null) return;
  const bs = bar.barSteps, u = bs / 16, beat = bs / 4;
  const run = PICKUPS[PICKKEYS[Math.floor(rnd() * PICKKEYS.length)]];
  const gap = [2, 3, 4][Math.floor(rnd() * 3)] * u;     // 8th, dotted 8th, quarter
  // HALF A BAR IS THE CEILING for a pitched pickup: past that it stops being a
  // lead-in and starts being a part the outgoing box did not write. Trim from
  // the FRONT — it is the end of the figure that does the leading.
  const k = Math.max(2, Math.min(run.length, Math.floor((bs / 2) / gap)));
  if (k * gap > bs / 2 + 1e-9 || k < 2) return;
  const notes = run.slice(run.length - k), L = k * gap, w0 = bs - L;
  const tgt = e0.n, add = [];
  let prev = null;
  notes.forEach((semi, i) => {
    const off = bs - (k - i) * gap, r = Math.round(off);
    const onBeat = Math.abs(off - r) < 0.45 && r % beat === 0;
    // which way this rung of the figure is travelling — the enclosure turns
    // around in the middle, so it is the FIGURE's own step, not the run's
    const step = i === 0 ? (semi < 0 ? 1 : -1)
      : (semi > notes[i - 1] ? 1 : semi < notes[i - 1] ? -1 : (semi < 0 ? 1 : -1));
    let n = seatNote(tgt + semi, arr.c, arr.scalePcs, onBeat, semi < 0 ? 1 : -1);
    while (n > tgt + 12) n -= 12;                       // the range fold, per note:
    while (n < tgt - 12) n += 12;                       // a pickup stays in its own octave
    // A RUN THAT REPEATS A NOTE IS NOT A RUN, and a pickup NEVER PLAYS ITS OWN
    // ARRIVAL. Seating can pull two rungs of a chromatic figure onto one chord
    // tone (a bare root-and-fifth does it every time) and it can pull the last
    // rung onto the very note the entering voice is about to play — a monotone
    // and a stutter, both out of the same cause. So the rung moves on: the next
    // LEGAL pitch (the seating law's own legal set — this may not smuggle in a
    // note the harmonize stage would have folded) in the direction the figure
    // was travelling, inside the octave the fold just put it in, and the other
    // way if that direction runs out of room.
    const bad = m => m === prev || (i === k - 1 && m === tgt);
    if (bad(n)) {
      let alt = null;
      for (const dirn of [step, -step]) {
        for (let d = 1; d <= 12 && alt == null; d++) {
          const c = n + dirn * d;
          if (c >= tgt - 12 && c <= tgt + 12 && !bad(c) && legalPc(c, arr)) alt = c;
        }
        if (alt != null) break;
      }
      if (alt != null) n = alt;
    }
    // THE PICKUP IS PLAYED BY THE VOICE IT ANNOUNCES, so it names that voice's
    // GENRE even when the entering line is its own box's authority (which
    // carries no layer tag at all). The scheduler reads `e.layer || gid(the
    // sounding box)`, and the sounding box is the outgoing one — so an
    // unstamped pickup would arrive on the OLD band's instrument, which is the
    // one instrument it must not be.
    add.push({ ...e0, ...(e0.kind === "line" ? { layer: e0.layer || gid(secB) } : {}),
               t: tBase + off, off, n, prev, acc: 0, sld: 0,
               dur: gap * (i === k - 1 ? 1 : 0.94),     // the last one ends ON the line
               vel: 4 + Math.round(3 * i / Math.max(1, k - 1)), pu: 1, puSi: siB });
    prev = n;
  });
  const mine = e => e.kind === e0.kind && !e.pad;
  bar.ev = bar.ev
    .filter(e => !(mine(e) && e.off >= w0 - 1e-9))      // the borrow
    .map(e => (mine(e) && e.dur > 0 && e.off < w0 && e.off + e.dur > w0
      ? { ...e, dur: Math.max(1e-4, w0 - e.off) } : e)) // ...and the trim
    .concat(add);
}
// the drum lead-in, case one: the kit was SILENT all box and arrives next box.
// Nothing to collide with, so this writes real material — and it is the one
// pickup allowed a whole bar, which is the "a bar early" case.
function drumLeadIn(bar, tBase, inBar, kit, siB, rnd) {
  const bs = bar.barSteps, u = bs / 16;
  const lanes = new Set(inBar.ev.filter(e => e.kind === "hit").map(e => e.d));
  if (!lanes.size) return;
  const voice = ["s", "p", "c", "t", "m", "l"].find(d => lanes.has(d)) || [...lanes][0];
  const toms = TOMS.filter(t => lanes.has(t));
  const L = rnd() < 0.35 ? bs : bs / 2, w0 = bs - L;
  const shapes = toms.length ? ["roll", "toms", "build"] : ["roll", "build"];
  const shape = shapes[Math.floor(rnd() * shapes.length)];
  const pos = [];
  if (shape === "build") {                              // the accelerating build
    let g = 4 * u, t = w0;
    while (t < bs - 1e-9) { pos.push(t); t += g; if (t > bs - L * 0.4) g = Math.max(u, g / 2); }
  } else for (let t = w0; t < bs - 1e-9; t += 2 * u) pos.push(t);
  const add = pos.map((t, i) => {
    const p = L > 0 ? (t - w0) / L : 0;
    const d = shape === "toms"
      ? toms[Math.min(toms.length - 1, Math.floor(p * toms.length))] : voice;
    return { kind: "hit", t: tBase + t, off: t, d, acc: i === pos.length - 1,
             vel: Math.min(9, 3 + Math.round(5 * p)), pu: 1, puSi: siB, kit };
  });
  // THE KICK LOOKS DOWN BEFORE IT LANDS. "Nothing to collide with" up there is
  // a claim about the BAR, and it says nothing about this function's own two
  // strokes. The accelerating build halves its gap as it runs, so over a whole
  // bar it walks 0 · 4 · 8 · 12 · 14 · 15 — and step 15 is exactly where the
  // kick goes. Usually they are different lanes and it reads as a kick under a
  // roll, which is the point; but `voice` falls through to the kick itself
  // when the entering kit is bare enough to have nothing else in it (a box of
  // k and h and no snare), and then the lead-in flams its own last note. Same
  // rule quoteFill states one function down, for the same reason — a fill may
  // never flam a hit that is already there. `rnd()` is still drawn whenever
  // the kit has a kick, so the seeded walk is unchanged and every other song
  // compiles the bar it compiled before.
  const busy = (d, t) => bar.ev.concat(add).some(e =>
    e.kind === "hit" && e.d === d && Math.abs(e.off - t) < 0.5 * u);
  if (lanes.has("k") && rnd() < 0.7 && !busy("k", bs - u))
    add.push({ kind: "hit", t: tBase + bs - u, off: bs - u, d: "k", acc: false,
               vel: 7, pu: 1, puSi: siB, kit });
  bar.ev = bar.ev.concat(add);
}
// the drum lead-in, case two: the kit plays through and the next box is a lift.
// The parent's kit fill exactly — QUOTE what is already playing, crescendo it,
// double some of its hits — with the collision check the parent left implicit
// made explicit: a double that lands where the kit already hits is dropped, so
// a fill can never flam its own pattern.
function quoteFill(bar, rnd) {
  const bs = bar.barSteps, u = bs / 16, w0 = bs / 2;
  const win = bar.ev.filter(e => e.kind === "hit" && e.off >= w0 - 1e-9);
  if (!win.length) return;
  const add = [];
  const busy = (d, t) =>
    bar.ev.some(e => e.kind === "hit" && e.d === d && Math.abs(e.off - t) < 0.5 * u) ||
    add.some(e => e.d === d && Math.abs(e.off - t) < 0.5 * u);
  for (const h of win) {
    if (rnd() >= 0.55) continue;
    const t = h.off + u;
    if (t >= bs - 1e-9 || busy(h.d, t)) continue;
    add.push({ ...h, t: h.t + u, off: t, acc: false, pu: 1, quote: 1,
               vel: Math.max(1, Math.round((h.vel == null ? 5 : h.vel) * 0.6)) });
  }
  bar.ev = bar.ev.map(e => {                            // the crescendo, on the quote
    if (e.kind !== "hit" || e.off < w0 - 1e-9) return e;
    const p = (e.off - w0) / (bs - w0);
    return { ...e, vel: Math.min(9, Math.round((e.vel == null ? 5 : e.vel) * (1 + 0.30 * p))) };
  }).concat(add);
}
function leadIns(bars, song, slots) {
  // the contiguous run of bars each box owns. A box is one run by construction
  // (songBars walks the boxes in order), and the seam walk only asks about
  // neighbours — which is the whole reason this pass lives at bar level.
  const runs = [];
  for (let i = 0; i < bars.length; i++) {
    const cur = runs[runs.length - 1];
    if (cur && cur.si === bars[i].si) cur.to = i;
    else runs.push({ si: bars[i].si, from: i, to: i });
  }
  for (let r = 0; r + 1 < runs.length; r++) {
    const A = runs[r], B = runs[r + 1];
    const bar = bars[A.to], inBar = bars[B.from];
    const secA = song[A.si], secB = song[B.si];
    const had = new Set();
    for (let i = A.from; i <= A.to; i++)
      for (const e of bars[i].ev) { const k = laneKey(e); if (k) had.add(k); }
    const enters = new Map();
    for (const e of [...inBar.ev].sort((x, y) => x.off - y.off)) {
      const k = laneKey(e);
      if (k && !had.has(k) && !enters.has(k)) enters.set(k, e);
    }
    // ONE SEED PER SEAM, from the two boxes it joins: the same song makes the
    // same pickups on every compile, and moving a box changes only the seams it
    // touches rather than re-rolling the whole record.
    const rnd = prng(strSeed("leadin|" + A.si + "|" + B.si + "|" +
                             gid(secA) + "|" + gid(secB) + "|" + roleOf(secB)));
    const tBase = (A.to - A.from) * bar.barSteps;
    // AT MOST ONE PERCUSSIVE AND ONE PITCHED PICKUP PER SEAM. Two horns and a
    // bass all announcing the same downbeat is not an arrangement, it is a
    // pile-up — and the ear only hears the one that lands anyway.
    if (enters.has("drums")) drumLeadIn(bar, tBase, inBar, kitOf(secB), B.si, rnd);
    else if (had.has("drums") && LIFT[roleOf(secB)] &&
             roleOf(secA) !== roleOf(secB) && rnd() < 0.7) quoteFill(bar, rnd);
    const lines = [...enters.keys()].filter(k => k.startsWith("line:")).sort();
    if (lines.length) {
      // the voice that sings the pickup is the one entering on top — a lead
      // announces itself, a pad underneath it does not (laneKey already
      // excluded pads, so this is choosing between real lines)
      let best = lines[0];
      for (const k of lines) if (enters.get(k).n > enters.get(best).n) best = k;
      pitchedLeadIn(bar, tBase, secB, slots, enters.get(best), B.si, rnd);
    } else if (enters.has("bass"))
      pitchedLeadIn(bar, tBase, secB, slots, enters.get("bass"), B.si, rnd);
    bar.ev.sort((x, y) => x.off - y.off);
  }
}

// THE BAR LIST — pure over its arguments, like everything else in this file.
// `opts.pickups` and `opts.rubato` default ON: both are derived from the
// arrangement and both are meant to be heard without anyone asking for them.
// Turning them off is not a musical setting, it is the way the gate reads the
// unbreathed timeline (and ui/state.js RUBATO, the device escape hatch for
// somebody who needs a grid) — with both off this returns exactly the bar list
// the transport built before either existed.
export function songBars(song, slots, songGroove, songSwing, loopOnly, opts) {
  const o = opts || {};
  const out = [];
  const list = loopOnly == null
    ? song.map((s, i) => [s, i]) : [[song[loopOnly], loopOnly]];
  for (const [sec, si] of list) {
    const { g, bars, ev } = sectionRender(sec, slots, songGroove, songSwing);
    // A BOX THAT PRODUCES NOTHING TAKES NO TIME. Since Simple became the
    // default there is no "empty" box any more, so a fresh page was four boxes
    // of which three had no phrase — one bar of music followed by three bars of
    // silence, for ever. A box with no events is skipped the way an empty one
    // used to be.
    if (!ev.length) continue;
    const barSteps = 16 / g.rate;
    // ONE PASS into per-bar buckets. The old per-bar filter over the whole event
    // list was O(bars × events) per box — ~6M comparisons per compile on a
    // twenty-box song, and compile runs on every editor scrub while playing.
    //
    // GROOVE CAN PUSH THE LAST SIXTEENTH PAST THE BAR LINE, by design — that is
    // what a late note IS. Clamping the BUCKET rather than the time keeps the
    // event in the last bar with an offset a hair over a bar, and since bars are
    // scheduled in sequence with lookahead that lands it at exactly the right
    // moment instead of dropping it on the floor.
    const buckets = Array.from({ length: bars }, () => []);
    for (const e of ev) {
      const b = Math.min(bars - 1, Math.floor(e.t / barSteps));
      buckets[b].push({ ...e, off: e.t - b * barSteps });
    }
    for (let b = 0; b < bars; b++)
      out.push({ si, g, barSteps, steps: barSteps, first: b === 0, ev: buckets[b] });
  }
  if (o.pickups !== false) leadIns(out, song, slots);
  if (o.rubato !== false) warpBars(out, song);
  stampBoxSpan(out);
  return out;
}
// HOW LONG THE BOX REALLY IS, written on every bar of it. Before the tempo map
// a box lasted `bars × barSteps` and any reader could do that multiplication;
// now every bar of a box is a different length and the multiplication is a lie.
// Measured on a composed Liverpool song it is worth up to 0.73 of a beat by the
// outro (0.94 on Lagos, 1.39 across a whole song) — which is a fill bar and a
// position LCD that wrap before or after the music does, and a mix automation
// lane that ends somewhere other than the box it belongs to. So the ONE walk
// that knows the durations writes the sum down and the readers read it:
//   boxSteps  the box in TIME steps — what a scheduler multiplies by stepDur
//   boxNom    the same box on the GRID, so a reader can stretch a per-beat
//             lane onto the warped box with one ratio
//   barIn/boxBars  which bar of the box this is, and how many there are
// With rubato off boxSteps === boxNom and this is exactly the multiplication it
// replaces, to the byte.
function stampBoxSpan(bars) {
  for (let i = 0; i < bars.length;) {
    let j = i, sum = 0, nom = 0;
    while (j < bars.length && bars[j].si === bars[i].si && (j === i || !bars[j].first)) {
      sum += bars[j].barSteps; nom += bars[j].steps; j++;
    }
    for (let k = i; k < j; k++) {
      bars[k].boxSteps = sum; bars[k].boxNom = nom;
      bars[k].barIn = k - i; bars[k].boxBars = j - i;
    }
    i = j;
  }
}
