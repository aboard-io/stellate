// audio/desk.js — THE DESK, as a MODEL. It answers what every control on the
// board is worth; it does not build a single audio node.
//
// This is what is left of audio/mixer.js after the one-engine round. That file
// was 1,184 lines and its own header opened by citing the parent's bus
// structure — "engine/faust/press/render-core.js: every unit renders into FOUR
// shared buses { dry, rev, del, pp }" — and then built a second one in WebAudio
// underneath it: a channel strip per box, a sub-bus per part, a gate per kit
// lane, a rack per effect. All of that was the graph, and it is gone. The parent renders the buses; this file says where each of nukernel's
// controls lands on them.
//
// THE MAPPING, control by control, because "keep the surface" is only honest if
// the surface is named all the way down (deskUnits below is the code):
//
//   box fader / level enum   -> unit `lvl`     the parent's own per-voice gain
//   box pan                  -> unit `pan`
//   part fader / level       -> unit `lvl`     (multiplied in: one gain, not two)
//   part mute / a solo elsewhere -> unit `lvl` = 0 — a mute that CUTS, which is
//                                what it always had to be, and now it is the
//                                same zero the parent's own mute is
//   part / section EQ, family tone, seat shading
//                            -> unit `sampler.strip` bands (the parent's
//                               per-voice STRIP stage — its EQ, not a copy)
//   reverb send  (box `rev`) -> unit `rev`     the shared reverb bus send
//   echo send    (box `echo`)-> unit `del`     the shared delay bus send
//   room send    (box `room`)-> the drum units' `rev` (the ambience the kit
//                               lanes already feed IS the parent's rev bus)
//   verb name    (box `verb`)-> state `reverb` amount + the parent's own
//                               reverbColor choice for the stream
//   the MASTER strip (fields.js MASTER)
//                            -> state fields the parent's own fx_bus resolves:
//                               drive->grit, glue->comp, tape->wob+tsat,
//                               space->mrev (masterState at the foot of this
//                               file, with the three that have no home named)
//   the motion filter / a `cutoff` lane
//                            -> the parent's OWN master sweep (state-engine reads
//                               an ev.sfx entry carrying `sweep`; the renderer
//                               walks fx_bus mcut through it exponentially), one
//                               piece per bar
//   a `level` lane (incl. `pump`)
//                            -> folded into every NOTE's amp at the note's own
//                               beat, because a sidechain is faster than a bar
//                               and a per-bar value cannot say it
//   `pan` / `send.rev` / `send.echo` lanes
//                            -> per-BAR values on the unit, which a fed bar
//                               re-applies and the DSP smooths (feedBar's own
//                               law). A ramp armed on an AudioParam has no home
//                               here and does not need one: a bar is short.
//
//   character chips (fields.js FX)
//                            -> per-voice INSERTS on the units of the part that
//                               asked, and on every seated voice when the SECTION
//                               asks — FINISHED through the parent's own
//                               state-engine insertChain on the way (insertsFor
//                               below), which clamps a chip's knobs to the
//                               module's declared sliders and stamps `barSec` on
//                               the two tempo-synced ones. The parent
//                               has no page-wide effect bus, so the tails are per
//                               voice rather than pooled — a real difference in
//                               the sound of a long reverb chip, and the one
//                               place the surface is served by a different
//                               mechanism underneath. A STEREO voice takes no
//                               chips at all: the renderer's insert path is mono
//                               (widthKept below).
//
// WHAT HAS NO HOME, said out loud rather than faked:
//   * `hpf` — the mot "rise" compiles to a HIGHPASS sweep, and the parent's
//     master stage has a lowpass ceiling and no floor. Sweeping the lowpass
//     instead would sound like the opposite gesture, so it is named here and
//     rendered by nothing (deskSweeps says the same thing at the code).
//   * per-part PAN beyond the parent's own placement pass: the parent carves
//     stereo per voice (SE.MASTER_PAN + collisionCarve) and a part pan now
//     rides ON that rather than replacing it.
//
// Nothing here imports an AudioContext, so the whole model is readable by a
// pure-node gate — which is how the board's numbers get checked without ears.
import { GENRES, FX, MAX_FX, fxChain, SENDS, LEVELS, PANS, RATES, instrOf, BASSSYNTH,
         partOf, chairKeys, resolvePartMix, faderDb, EQ_BANDS,
         eqDb, familyOf } from "../ui/deps.js";
import { NuFields } from "../ui/deps.js";
// bpm rides along for insertsFor: the parent resolves a chip's `rateBars` to Hz
// off the state's tempo, so a chip that asks for a bar-locked wobble has to be
// normalised against the song's own clock and not a default one.
import { POOL, bpm, MIXER } from "../ui/state.js";
import { gid, stackOf, genreOf, kitOf, poolInstrOf } from "../ui/derive.js";

const sendOf = (sec, k, dflt) => (sec[k] != null ? SENDS[sec[k]] : dflt);

function compileAuto(sec, g) {
  const rate = g.rate * (sec.rate ? RATES[sec.rate] : 1);
  const beats = Math.max(1, Math.round((sec.len || g.bars) * 4 / rate));
  const out = [];
  if (sec.mot === "open")
    out.push({ param: "cutoff", curve: "exp", points: [[0, 320], [beats, 16000]] });
  else if (sec.mot === "close")
    out.push({ param: "cutoff", curve: "exp", points: [[0, 16000], [beats, 320]] });
  else if (sec.mot === "rise")
    out.push({ param: "hpf", curve: "exp", points: [[0, 20], [beats, 1400]] });
  else if (sec.mot === "pump") {
    const pts = [];
    for (let b = 0; b < beats; b++) pts.push([b, 0.32], [b + 0.85, 1]);
    out.push({ param: "level", curve: "exp", points: pts });
  }
  // the box's own list: real entries only (a bare param string is the
  // registry's inert placeholder shape and arms nothing)
  for (const a of (sec.auto || []))
    if (a && typeof a === "object" && a.param && Array.isArray(a.points) && a.points.length)
      out.push({ param: a.param, curve: a.curve === "exp" ? "exp" : "lin",
                 points: a.points });
  return out;
}
// WHO IS PLAYING IN THIS BOX, voice by voice — the same walk derive.js does to
// deal voices across the stack (authority first, each layer's voices continuing
// past it), reduced to the two facts the MIX needs: which sampled instrument
// sits in that chair, and whether the genre calls the chair a pad.
//
// This is what lets the desk place its voices and hear a COLLISION before a
// note is played: vaporwave puts `strings` on both its voices five semitones
// apart, shoegaze puts one overdrive guitar on top of another, and two voices
// on the same instrument in the same register are the definition of soup (the
// parent's mastering stage calls it a same-timbre collision and carves it —
// SE.collisionCarve, which the translation runs over the real table). Post rock has the same collision on paper — two clean guitars
// — and does not sound like soup, because its two guitars sit fourteen
// semitones apart. Register separation is the cure; where the genre does not
// provide it, placement and a mud dip are what the mixer can do instead.
// It also carries the chair's ROLE and its ADDRESS, which is what makes the
// per-part mix possible at all: `part` is the kernel's own assignment for that
// voice (read off the DERIVED genre, so a per-layer part chip counts — the
// same genreOf(sec, ent) derive.js renders through), and `key` is that role
// plus an ordinal when the box has several of one (fields.js chairKeys). The
// numbering runs across the WHOLE BOX, layers included, because the desk's
// track list is the box's, not each genre's.
export function voiceRoster(sec) {
  const out = [];
  let base = 0;
  for (const ent of stackOf(sec)) {
    const g = GENRES[ent.g];
    if (!g) continue;
    const dg = genreOf(sec, ent);
    for (let v = 0; v < g.voices; v++) {
      // the SONG POOL's pick is the chair's honest name — the same resolution
      // the scheduler makes (derive.js instrIdOf: pool first, genre second).
      // `over` rides along so the board can mirror the synth-mute law without
      // a second resolver.
      const over = poolInstrOf(sec, ent.g, v, POOL);
      out.push({ v: base + v, id: over || instrOf(ent.g, v), over,
                 pad: g.realize(v) === "pad",
                 part: partOf(dg, v) });
    }
    base += g.voices;
  }
  const keys = chairKeys(out.map(r => r.part));
  out.forEach((r, i) => { r.key = keys[i]; });
  return out;
}
// EVERY ADDRESS THIS BOX HAS — the chairs plus the two parts that are not
// voices. The bass is one line per box (not one per genre voice) and the kit
// is one instrument, so neither has a chair in the roster; both are tracks on
// the desk all the same, and a box with no bass or no kit must not offer an
// address that can never sound.
export function partKeysOf(sec, roster) {
  const keys = (roster || voiceRoster(sec)).map(r => r.key);
  if (!genreOf(sec).nobass) keys.push("bass");
  if (kitOf(sec)) keys.push("drums");
  // (a third such address, `sing`, was pushed here on the same terms whenever
 // the box had a singer. The espeak organ came out on 2026-08-17 — the
  // tombstone is in kernel-daw.html — so the desk is the band's again.)
  return keys;
}
/* ---------- THE DERIVED TONE: the song seats its own desk ------------------ */
// "All the EQ settings and all the faders are always the same and never move…
// but never inside a song" (Paul, on the shipped board, 2026-08-16). He was
// right, and the reason was structural: nothing in the model ever SAID a
// per-part level or a per-part tone — resolvePartMix answered (1, flat) for
// every unmixed chair, so every cap sat at the same height and every knob at
// noon, forever, while only the effects chips differed. The board was not
// lying; the model was silent. This block is the model speaking.
//
// WHERE THE DERIVED VALUES COME FROM, and why each source is applied HERE and
// nowhere else (the double-application audit, in writing):
//   * ROLE SEATING (SEAT_DB + the chair ordinal): a pad sits behind a lead,
//     the second guitar under the first. Nothing downstream applies this —
//     the per-note strip trims (STRIPS[fam].trim) are timbre make-up gains
//     inside sampler.js's note chain and are deliberately NOT re-read here.
//   * SECTION WORDS (shade): sec.lvl / sec.env are the composed arc's own
//     vocabulary, and the shading is DIFFERENTIAL — lead up means pad down —
//     because the WHOLE-section level is already the section chain's job
//     (the section level, sectionOf below) and the whole-section velocity curve is already the
//     kernel envelope's. The desk adds the one thing neither can say: the
//     BALANCE between parts changing as the song moves. This is what makes a
//     hush section's strips sit differently from a chorus's.
//   * FAMILY TONE (FAM_EQ): the direction of the instrument strip's carve
//     (instruments.js STRIPS — the dirty scoop, the vox mud dip, the bass
//     warmth), said at the DESK's three fixed frequencies (120/1000/7200)
//     at ≤2 dB. The per-note strip keeps its own stage at its own
//     frequencies; this is the board-level seating tone, built ONCE on the
//     part bus — the resolved chain contains each tone stage exactly once.
//   * GENRE CHARACTER (derivedSecEq): tone.cut / tone.verb, where they are
//     EQ-shaped, seed the SECTION strip only — disjoint from the part strips
//     by construction, so the genre's darkness is never said twice.
// A USER VALUE IS AN ABSOLUTE OVERRIDE, never a sum: a set band replaces the
// derived band (mergeEq), lvl/fader multiply exactly as they always did, and
// clearing back to absent returns the derived answer — the dim-vs-lit law.
const SEAT_DB = { lead: 0, line: 0, riff: -0.5, counter: -1, stab: -0.5,
                  pad: -1.5, drone: -2, bass: 0, drums: 0 };
const FAM_EQ = {
  bass:    { lo: 1.5, hi: -1.5 },
  pad:     { mid: -1.5, hi: 1 },
  dirty:   { mid: -2, hi: 1 },
  vox:     { mid: -1.5, hi: 1 },
  brass:   { mid: 1.5 },
  reed:    { mid: 1 },
  guitar:  { mid: 1 },
  keys:    { mid: 0.5 },
  mallet:  { hi: 1 },
  bowed:   { hi: 0.5 },
  strings: { hi: 0.5 },
  organ:   { mid: 0.5 },
  // `lead` (the no-family fallback) and `drums` are deliberately absent: an
  // id in no family has no tonal character to derive (the flat-when-no-source
  // law, visible), and the kit's truth already lives on the lane strips
  // (DRUMMIX) — repeating it here would be the double the audit forbids.
};
// the composed arc, as per-part DIFFERENTIAL shading. Sums ≈ 0 across a
// typical roster on purpose: the section's overall level belongs to the
// section chain; the desk only redistributes it.
function shade(sec, base) {
  let db = 0; const eq = {};
  const melodic = base === "lead" || base === "line" || base === "riff";
  const w = sec.lvl;
  if (w === "hush") {
    if (base === "drums") { db -= 2; eq.hi = -1; }
    else if (melodic) db -= 1;
    else if (base === "pad") db += 0.5;
  } else if (w === "fwd") {
    if (melodic) { db += 1; eq.mid = 0.8; }
    else if (base === "pad") db -= 1;
  } else if (w === "back") { if (melodic) db -= 0.5; }
  const e = sec.env;
  if (e === "in") { if (melodic) db -= 1.5; else if (base === "pad") db += 0.5; }
  else if (e === "out" || e === "dim") {
    db -= 0.5; if (base !== "drums") eq.hi = (eq.hi || 0) - 1.5;
  } else if (e === "soft") {
    if (base === "drums") { db -= 1.5; eq.hi = (eq.hi || 0) - 0.5; }
    else if (base === "bass") db += 0.5;
  } else if (e === "big") {
    if (melodic) { db += 1; eq.mid = (eq.mid || 0) + 0.5; }
    else if (base === "pad") db -= 1;
    else if (base === "drums") db += 0.5;
  } else if (e === "lift" || e === "cresc") {
    if (base === "drums") db += 0.5; else if (base === "pad") db -= 0.5;
  } else if (e === "arch") { if (melodic) db += 0.5; }
  return { db, eq };
}
// ONE PART'S DERIVED (gain, tone), the model-level truth the board parks on
// and deskUnits writes onto the parent's units. Deterministic over (sec, key) — same walk, same
// numbers — which is what lets the offline bounce carry it by construction.
export function derivedPartTone(sec, key, roster) {
  const m = /^([a-z]+?)(\d+)?$/.exec(String(key || "")) || [];
  const base = m[1] || "line", ord = m[2] ? +m[2] : 1;
  let db = (SEAT_DB[base] != null ? SEAT_DB[base] : 0) - Math.min(2, ord - 1);
  const eq = { lo: 0, mid: 0, hi: 0 };
  let fam = null;
  if (key === "bass") fam = "bass";
  else if (key !== "drums") {
    const r = (roster || voiceRoster(sec)).find(x => x.key === key);
    if (r) fam = familyOf(r.id, r.pad);
  }
  const add = src => { if (src) for (const b of ["lo", "mid", "hi"])
    if (src[b]) eq[b] += src[b]; };
  add(FAM_EQ[fam]);
  const sh = shade(sec, base);
  db += sh.db; add(sh.eq);
  for (const b of ["lo", "mid", "hi"]) eq[b] = eqDb(eq[b]);
  const flat = !eq.lo && !eq.mid && !eq.hi;
  return { db: Math.round(db * 10) / 10, eq: flat ? null : eq };
}
// THE SECTION STRIP'S DERIVED TONE — the genre's character where it is
// EQ-shaped, and only here (see the audit above): a dark genre (tone.cut low)
// keeps its top rolled and its low warm, a bright one lifts air, a washy one
// (tone.verb high) carves the mud its own reverb makes.
export function derivedSecEq(sec) {
  const g = GENRES[gid(sec)], t = g && g.tone;
  if (!t) return null;
  const eq = { lo: 0, mid: 0, hi: 0 };
  if (t.cut != null && t.cut <= 1100) { eq.hi = -2; eq.lo = 1; }
  else if (t.cut != null && t.cut >= 2700) eq.hi = 1.5;
  if (t.verb != null && t.verb >= 0.6) eq.mid -= 1.5;
  for (const b of ["lo", "mid", "hi"]) eq[b] = eqDb(eq[b]);
  return (eq.lo || eq.mid || eq.hi) ? eq : null;
}
// DERIVED UNDER, USER OVER — per band, absolute, never a sum. A user band
// that is stored (non-zero — writeEqBand deletes zeros) replaces the derived
// band outright; an absent band keeps the derived answer. Returns the same
// full-band shape resolveEq returns, or null when everything is flat.
export function mergeEq(drv, user) {
  const u = user && typeof user === "object" ? user : null;
  const out = {};
  let any = false;
  for (const b of EQ_BANDS) {
    const uv = u ? eqDb(u[b.key]) : 0;
    const v = uv !== 0 ? uv : eqDb(drv ? drv[b.key] : 0);
    out[b.key] = v; if (v) any = true;
  }
  return any ? out : null;
}
// THE RESOLVED STATIC TRUTH for one part — derived × user, the exact numbers
// deskUnits writes onto the parent's own voices. One function, two readers (the
// board's cap rest position and the mapping below), so what is displayed and
// what is heard cannot drift apart.
export function resolvedPart(sec, key, roster) {
  const m = resolvePartMix(sec.parts && sec.parts[key]);
  const t = derivedPartTone(sec, key, roster);
  return { gain: +(m.lvl * Math.pow(10, (m.fader + t.db) / 20)).toFixed(4),
           eq: mergeEq(t.eq, sec.parts && sec.parts[key] && sec.parts[key].eq),
           tdb: t.db };
}
// THE CHANNEL'S COMPOSED BASE, for the mixer surface: the "real" mix the
// offsets ride on, one function for the drawn number and the built one.
export function deskChannelBase(sec, key) {
  if (!sec) return { gain: 1, pan: 0, rev: 0, del: 0, eq: null, mute: false };
  const S = sectionOf(sec);
  const m = resolvePartMix(sec.parts && sec.parts[key]);
  const r = resolvedPart(sec, key);
  return {
    gain: +(r.gain * S.lvl).toFixed(4),
    pan: (S.pan || 0) + (m.pan || 0),
    rev: Math.min(1, (m.rev || 0) + (m.room || 0) + S.rev + (key === "drums" ? S.room : 0)),
    del: Math.min(1, (m.del || 0) + S.del),
    eq: r.eq, mute: m.mute };
}

/* ================== THE DESK, ON THE PARENT'S BUSES ======================= */
// Everything above is the model the board draws. What follows is the only place
// it touches sound, and it touches it by writing numbers onto the parent's own
// unit table — no node, no bus, no graph.

// evaluate one automation lane at a beat inside the box. Lanes are written in
// BOX beats (the grid), which is why the caller converts: under the tempo map a
// bar's real length and its nominal length differ, and a lane must span the box
// the ear is hearing.
function laneAt(lane, beat) {
  const p = lane.points;
  if (!p.length) return null;
  if (beat <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (beat > p[i][0]) continue;
    const [b0, v0] = p[i - 1], [b1, v1] = p[i];
    const x = b1 > b0 ? (beat - b0) / (b1 - b0) : 1;
    if (lane.curve === "exp" && v0 > 0 && v1 > 0) return v0 * Math.pow(v1 / v0, x);
    return v0 + (v1 - v0) * x;
  }
  return p[p.length - 1][1];
}
const laneOf = (auto, param) => auto.find(a => a.param === param) || null;

// THE PART EVERY UNIT ANSWERS TO, resolved once per box. `addr` maps a parent
// unit key to a desk address (fields.js chairKeys — lead / pad2 / bass / drums);
// this turns that into the resolved numbers, solo included, because solo is the
// one control that reaches parts other than its own.
function partsOf(sec) {
  const roster = voiceRoster(sec);
  const P = sec.parts && typeof sec.parts === "object" ? sec.parts : null;
  const keys = partKeysOf(sec, roster);
  const solo = !!P && keys.some(k => P[k] && P[k].solo);
  const out = {};
  for (const k of keys) {
    const ent = P ? P[k] : null;
    const m = resolvePartMix(ent);
    const t = derivedPartTone(sec, k, roster);
    out[k] = { gain: m.mute || (solo && !m.solo) ? 0
                 : m.lvl * Math.pow(10, (m.fader + t.db) / 20),
               pan: m.pan, rev: m.rev, del: m.del, room: m.room, fx: m.fx,
               eq: mergeEq(t.eq, ent && ent.eq) };
  }
  return out;
}
// the SECTION strip's own numbers — the level enum × the board's fader offset,
// the pan chip, and the genre's derived character under the box's own bands
function sectionOf(sec) {
  const g = GENRES[gid(sec)] || {};
  return {
    lvl: (sec.lvl ? LEVELS[sec.lvl] : 1) * Math.pow(10, faderDb(sec.fader) / 20),
    pan: sec.pan ? PANS[sec.pan] : 0,
    // ABSENT MEANS "AS THE GENRE ASKS" — every genre already declares how wet it
    // wants to be (tone.verb), and that number used to be thrown away
    rev: sendOf(sec, "rev", g.tone && g.tone.verb != null ? g.tone.verb : 0.15),
    del: sendOf(sec, "echo", 0),
    room: sendOf(sec, "room", 0),
    eq: mergeEq(derivedSecEq(sec), sec.eq),
    fx: (sec.fx || []).filter(k => FX[k]).slice(0, MAX_FX),
    auto: compileAuto(sec, g),
  };
}

// THE EQ, AS THE PARENT SPELLS IT. nukernel's board says three bands in dB at
// 120 / 1000 / 7200; the parent's per-voice STRIP stage (state-engine
// STRIP_PROFILES, built inside sampler.js's note chain) says the same three in
// the same units. So the desk's tone is written onto the strip the voice already
// has rather than into a filter of its own — which is why a part EQ now reaches
// the tape: there is only one stage and both paths render it.
function stripWith(strip, eq) {
  if (!eq || (!eq.lo && !eq.mid && !eq.hi)) return strip || null;
  const s = strip ? { ...strip } : {};
  s.lo = (s.lo || 0) + (eq.lo || 0);
  s.mid = (s.mid || 0) + (eq.mid || 0);
  s.hi = (s.hi || 0) + (eq.hi || 0);
  return s;
}

/**
 * A CHIP NAMES ITS MODULE; THE PARENT'S CHAIN IS WHAT FINISHES IT.
 *
 * fields.js fxChain now stamps `module: "insert_" + type` on every chip, which
 * is what stopped the renderer interpolating `undefined` into a wasm URL and
 * 404ing on every box that carried an effect. That is the name. This is the
 * rest of the sentence, and it matters because a chip is written in the
 * parent's `{type, params}` RECIPE dialect — the INPUT to state-engine's
 * insertChain — and the recipe is not the resolved insert:
 *
 *   * insertChain CLAMPS every knob to the slider the module actually declares,
 *     which is the difference between a value the DSP reads and one it ignores;
 *   * it stamps `barSec` on the two tempo-synced inserts, and the renderer only
 *     writes a chain's bar length when it sees that flag (runChain) — so
 *     without it the tape echo and the bar-locked sweep run at whatever the
 *     module's default clock is, tempo or no tempo;
 *   * and it is the same function the units' OWN inserts already came through
 *     (pitchedUnit), so a chip and a default insert end up the same shape.
 *
 * ONE CHIP AT A TIME, because the two ends count differently. insertChain caps
 * a chain at two — the parent's DEFAULT policy for a chain it picked itself —
 * and the desk's count is the page's own law (fields.js MAX_FX, three per part
 * plus three per section). Asking for one chip per call gets the translation
 * without the cap, so a board with four chips still sounds four.
 *
 * AND THE SWEEP SPEAKS A DIFFERENT DIALECT, which only shows up here. Every
 * other chip's params are read by insertChain under the same names; filtersweep
 * alone reads `lo`/`hi` as OCTAVES either side of the voice's cutoff, while the
 * page (and the module itself) speak the Hz a sweep runs between. Anchoring the
 * parent's base at the chip's own low end and asking for the octaves up to its
 * high end is that translation, exactly: 400 -> 5200 comes back 400 -> 5200.
 *
 * A TYPE THE PARENT HAS NO CASE FOR KEEPS THE CHIP THE REGISTRY RESOLVED. The
 * chain's switch is silent on anything it does not know, and a chip that
 * vanishes is worse than one that is merely unclamped — so the registry's own
 * answer stands where the parent has none.
 */
function insertsFor(SE, u, chips) {
  if (!chips.length) return [];
  if (!SE || !SE.insertChain) return chips;
  const out = [];
  for (const c of chips) {
    let it = c, base = (u.params && u.params.cutoff) || u.cutoff || 2000;
    if (c.type === "filtersweep" && c.params && c.params.lo > 20 && c.params.hi > c.params.lo) {
      base = c.params.lo;
      it = { ...c, params: { ...c.params, lo: 0, hi: Math.log2(c.params.hi / c.params.lo) } };
    }
    const r = SE.insertChain({ inserts: [{ type: it.type, ...it.params }] },
                             base, null, { bpm });
    if (r.length) for (const x of r) out.push(x);
    else out.push(c);
  }
  return out;
}

/**
 * A UNIT THAT IS WIDE KEEPS ITS WIDTH, WHICH MEANS IT KEEPS NO INSERTS.
 *
 * gregorian resolves its section to voice_choir with `stereo: true`, pool 3,
 * spread 0.77, drift 0.715, width 0.725 — four detuned, staggered, separately
 * placed singers — and it arrived at the master reading an L/R correlation of
 * 0.998 with the drums muted, i.e. mono. The width was not lost on a bus: read
 * the renderer's per-unit walk (stream-renderer renderUnitWindow, and
 * render-core beside it) and the INSERT branch is tested first — a unit with a
 * chain renders into a unit-local MONO buffer and only channel 0 survives, so
 * `u.stereo`'s route onto the wide buses is never reached. render-core says so
 * in its own margin: "stereo voices are folded to channel 0 through the mono
 * insert chain — graceful; the wired stereo genres carry no inserts."
 *
 * nukernel's do, because the parent's default two-insert policy hands every pad
 * a chorus and a phaser, and the desk then adds the box's chips on top. So the
 * choice here is which of the two to keep, and it is not close: all three
 * stereo modules this catalogue can reach are instruments whose WIDTH IS THE
 * IDENTITY and whose built-in effect is the one being duplicated — a Juno's
 * chorus, a VP-330's ensemble, a room of singers spread across it. The parent
 * already states exactly this law for the one mono ensemble it owns (solina:
 * "Ensemble chorus is built in — NEVER stack an insert_chorus, so inserts are
 * dropped for this voice"). This is that sentence, applied to the units where
 * the stacking also costs the stereo field.
 */
function widthKept(units) {
  let out = null;
  for (const [key, u] of Object.entries(units)) {
    if (!u || !u.stereo || !(u.inserts && u.inserts.length)) continue;
    if (!out) out = { ...units };
    out[key] = { ...u, inserts: [] };
  }
  return out || units;
}

/**
 * THE BOX'S MIX, ON THE BOX'S UNITS. Returns a SHALLOW-COPIED unit table —
 * shallow because the parent keys its stream signature on unit modules only
 * (live.js sigOf), so a desk move changes level, pan, sends and tone and leaves
 * the topology alone: the bar glides in instead of crossfading.
 *
 *   units  the cast's table (audio/plan.js)
 *   addr   unit key -> desk address for THIS box
 *   sec    the box
 */
// the instrument-chan matchers: which units answer to "guitar", "piano"…
const INST_CHANS = [
  ["guitar", /guitar/], ["piano", /piano/], ["organ", /organ/],
  ["strings", /string|violin|cello|ensemble/], ["horns", /trumpet|brass|sax|horn|tuba|trombone/],
  ["bells", /bell|celesta|glocken|vibraphone|marimba|music_box/],
];

// OFFSET EQ: the mixer layer's bands ADD to the effective eq (offset
// semantics — unlike mergeEq's user-over-derived, an offset is a delta).
const addEq = (base, off) => {
  const out = {}; let any = false;
  for (const b of ["lo", "mid", "hi"]) {
    const v = eqDb((base ? base[b] || 0 : 0) + (off[b] || 0));
    out[b] = v; if (v) any = true;
  }
  return any ? out : null;
};
const c01 = v => Math.max(0, Math.min(1, v));

export function deskUnits(units, addr, sec, boxBeatOf, SE) {
  units = widthKept(units);
  if (!sec) return units;
  const S = sectionOf(sec), P = partsOf(sec);
  // the three lanes that move slower than a note and are read once per bar. A
  // pan or a send crossing a bar line is a gesture, not a groove, so the bar's
  // own opening position is the honest sample point — and the engine smooths the
  // step itself (stream-renderer feedBar glides changed unit params).
  const at = boxBeatOf ? boxBeatOf(0) : 0;
  const lane = (name, dflt) => {
    const L = laneOf(S.auto, name);
    if (!L) return dflt;
    const v = laneAt(L, at);
    return v == null ? dflt : v;
  };
  const autoPan = lane("pan", null);
  const autoRev = lane("send.rev", null), autoDel = lane("send.echo", null);
  const out = {};
  for (const [key, u] of Object.entries(units)) {
    if (!u || key.slice(0, 2) === "__") { out[key] = u; continue; }
    const p = P[addr[key] || (u.drum ? "drums" : "")] || null;
    const eq = p && p.eq ? p.eq : S.eq;
    // THE ROOM IS THE SAME BUS. The ambience nukernel's kit lanes fed IS the
    // parent's reverb bus, so a part asking for room and a box asking for it are
    // both asking for more of the one reverb everything already shares — the box's
    // room reaches the DRUMS (whose room it was), a part's reaches that part.
    const isDrum = !!u.drum || !!(u.__meta && u.__meta.drum);
    // THE MIX-OFFSET LAYER (ui/state.js MIXER): the mixer surface's own hand,
    // per CHANNEL (part key or "drums") for the whole song, applied last —
    // OVER the composed per-section values, never instead of them. null =
    // byte-identical.
    const chan = addr[key] || (isDrum ? "drums" : "");
    // THE BOARD'S THREE ADDRESS KINDS (RUBINESQUE speaks all three): the part
    // chan ("drums", "lead"), the UNIT chan ("unit:kick" — the couch says
    // MAKE THE KICK HUGE), and the INSTRUMENT chan ("inst:guitar", "vocals" —
    // whatever seat happens to hold that instrument). Offsets from every
    // matching address stack, most specific applied last.
    const chans = [];
    if (chan) chans.push(chan);
    chans.push("unit:" + key);
    const mid = (u.sampler && (u.sampler.id || u.sampler.instr)) || u.module || "";
    if (/voice_|vox|choir|voices/.test(mid)) chans.push("vocals");
    for (const [fam, re] of INST_CHANS) if (re.test(mid)) chans.push("inst:" + fam);
    const os = MIXER ? chans.map(c => MIXER[c]).filter(Boolean) : [];
    const sum = (k2) => os.reduce((a, x) => a + (x[k2] || 0), 0) || undefined;
    const o = os.length === 1 ? os[0] : os.length ? Object.assign({}, ...os,
      { fader: sum("fader"), rev: sum("rev"), del: sum("del"), pan: sum("pan"),
        fx: os.flatMap(x => x.fx || []) }) : null;
    const rev = (p ? (p.rev || 0) + (p.room || 0) : 0)
      + (autoRev != null ? autoRev : S.rev) + (isDrum ? S.room : 0);
    const del = (p && p.del ? p.del : 0) + (autoDel != null ? autoDel : S.del);
    const v = { ...u,
      lvl: (u.lvl != null ? u.lvl : 1) * S.lvl * (p ? p.gain : 1),
      rev: Math.min(1, rev), del: Math.min(1, del) };
    if (o) {
      if (o.mute) v.lvl = 0;
      else if (o.fader) v.lvl *= Math.pow(10, faderDb(o.fader) / 20);
      if (o.rev) v.rev = c01(v.rev + o.rev);
      if (o.del) v.del = c01(v.del + o.del);
    }
    // ...and the master channel: its fader is one trim over every seated
    // voice, and its rev/del are the whole record's wet — an offset on every
    // unit's send at once, which is the one true global reverb/echo the
    // engine has (the WebAudio bus rack went out with the one-engine round)
    const mo = MIXER && MIXER.master;
    if (mo && mo.fader && v.lvl) v.lvl *= Math.pow(10, faderDb(mo.fader) / 20);
    if (mo && mo.rev) v.rev = c01(v.rev + mo.rev);
    if (mo && mo.del) v.del = c01(v.del + mo.del);
    // A CHIP IS AN INSERT HERE. The page's own vocabulary calls it a send and had
    // one shared bus per effect; the parent has no page-wide effect bus and a
    // per-voice INSERT chain instead (state-engine insertChain -> sampler.js
    // buildInsertNodes), so a chip lands on the voices of the part that asked for
    // it and a SECTION chip lands on every voice of the box. The tails are per
    // voice rather than pooled — the one place the surface is served by a
    // different mechanism underneath, and the reason it is written down.
    // ...AND ONLY ON THE VOICES THIS BOX SEATS. The unit table is the SONG's cast
    // (audio/plan.js), so most of it is other boxes' players sitting silent — and
    // giving them a chain here would flip their insert signature at every box
    // change, which the engine answers by rebuilding the chain and draining the
    // old one (live.js samplerOf). A voice that is not playing gets nothing.
    const seated = !!addr[key] || isDrum;
    // ...and the board's own chips ("make guitar distorted"): the offset
    // layer may carry an fx list per chan, finished through the same
    // insertsFor door as every section chip
    const chips = seated && !u.stereo
      ? insertsFor(SE, u, fxChain([...(p ? p.fx : []), ...S.fx, ...((o && o.fx) || [])])) : [];
    if (chips.length) v.inserts = [...(u.inserts || []), ...chips];
    // the parent's placement pass already carved this voice's stereo seat; the
    // box's pan chip and a part's place RIDE ON it rather than replacing it
    const pan = (autoPan != null ? autoPan : S.pan) + (p ? p.pan : 0)
      + (o && o.pan ? o.pan : 0);
    if (pan) v.pan = Math.max(-1, Math.min(1, (u.pan || 0) + pan));
    const eqAll = o && o.eq ? addEq(eq, o.eq) : eq;
    if (u.sampler) v.sampler = { ...u.sampler, strip: stripWith(u.sampler.strip, eqAll) };
    out[key] = v;
  }
  return out;
}

/**
 * THE LEVEL AUTOMATION, PER NOTE. `pump` is a per-beat sidechain and a bar is
 * several beats, so a value fed once per bar cannot say it — but a note carries
 * its own amp, and the lane's value at the note's own beat is exact. So the one
 * automation lane that has to move faster than a bar rides in on the notes, and
 * a muted part is a note that is never emitted at all (the mute that CUTS).
 *
 * Returns (unitKey, beatInBar) -> gain; 0 means "do not play this note".
 */
export function deskAmp(sec, addr, boxBeatOf) {
  if (!sec) return () => 1;
  const S = sectionOf(sec), P = partsOf(sec);
  const lvl = laneOf(S.auto, "level");
  return (key, beat) => {
    // A KEY THIS BOX DOES NOT SEAT gets no part at all — never the drums' by
    // accident. A lead-in pickup is the NEXT box's voice sounding in this bar
    // (ui/derive.js leadIns), so its unit is a stranger here, and defaulting a
    // stranger to the kit's track would mute a horn because a drummer was muted.
    const a = addr[key];
    const p = a ? P[a] : null;
    if (p && p.gain === 0) return 0;
    if (!lvl) return 1;
    const v = laneAt(lvl, boxBeatOf(beat));
    return v == null ? 1 : Math.max(0, v);
  };
}

/**
 * THE FILTER MOTION, AS THE PARENT'S OWN SWEEP. nukernel's `mot` (open / close)
 * and any hand-drawn `cutoff` lane are a lowpass walking across the section —
 * which is exactly what the parent's sweep lane is (state-engine mapEvents reads
 * ev.sfx entries carrying `sweep` and the renderer walks fx_bus mcut through
 * them exponentially). One bar is one piece of that walk, so the curve is
 * piecewise-exact for the exponential shapes the palette writes.
 *
 * WHAT HAS NO HOME: `hpf`. The mot "rise" compiles to a highpass sweep and the
 * parent's master stage has a lowpass ceiling and no floor. It is reported here
 * rather than faked with a lowpass that would sound like the opposite gesture.
 */
const SWEEP_OPEN = 21000;               // the renderer's own mcut ceiling = no filter
export function deskSweeps(sec, barBeats, boxBeatOf) {
  if (!sec) return [];
  const S = sectionOf(sec);
  const lane = laneOf(S.auto, "cutoff");
  // A BOX WITH NO MOTION HAS TO SAY SO. The sweep is a MASTER parameter and the
  // renderer holds it wherever the last one left it — so a `close` box that ran
  // 16 kHz down to 320 would leave every box after it dark for the rest of the
  // song. The box that is not sweeping opens the filter back up, every bar, which
  // is both cheap (one event) and the only spelling of "no filter" the parameter
  // has. This is the shape of every bug in this file's history: a parameter that
  // is global and set by one box only.
  if (!lane) return [{ sweep: true, beat: 0, dur: barBeats, from: SWEEP_OPEN, to: SWEEP_OPEN }];
  const from = laneAt(lane, boxBeatOf(0)), to = laneAt(lane, boxBeatOf(barBeats));
  if (from == null || to == null)
    return [{ sweep: true, beat: 0, dur: barBeats, from: SWEEP_OPEN, to: SWEEP_OPEN }];
  return [{ sweep: true, beat: 0, dur: barBeats, from: Math.max(180, from), to: Math.max(180, to) }];
}
/**
 * THE LEVEL LANE AT A FRACTION THROUGH THE BOX — what the board's fill needs to
 * follow a `pump` or a composed swell without reading an audio node. `f` is
 * 0..1 across the box; the lane's own last breakpoint is its span, so this is
 * the same number deskAmp hands the engine for a note at that position.
 */
export function deskLevelAt(sec, f) {
  if (!sec) return 1;
  const lane = laneOf(compileAuto(sec, GENRES[gid(sec)] || {}), "level");
  if (!lane || !lane.points.length) return 1;
  const span = lane.points[lane.points.length - 1][0] || 1;
  const v = laneAt(lane, Math.max(0, Math.min(1, f)) * span);
  return v == null ? 1 : Math.max(0, v);
}

/* ================== THE MASTER STRIP, ON THE PARENT'S MASTER =============== */
// The board's master row (fields.js MASTER — drive / glue / tape / space /
// width / tilt / ceiling) was written against the parent's own bus and then
// built a second time in WebAudio. The table comments say so themselves: tape
// IS fx_bus's `wob` + `tsat`, space IS its `mrev`, drive IS its saturation.
// So the surface lands on the parent's master stage by writing STATE, and the
// parent's own fxParams resolves it — one master chain, not two.
//
// ABSENT IS THE ENGINE'S DEFAULT, never nukernel's: a song that says nothing
// about mastering gets exactly the mix engine/faust/ makes for everybody else.
//
// WHAT HAS NO HOME, and is named rather than approximated:
//   * `width` — a mid/side trim. fields.js already says this is "the one
//     control here with no parent to borrow from": the parent gets its width
//     from placement (MASTER_PAN) and from the tape's own decorrelation.
//   * `tilt` — a SHELF PAIR about 1 kHz. The parent's tone stage is a lowcut
//     and a highcut, which stop the ends rather than rocking them; writing a
//     tilt into a pair of cuts would be a different gesture wearing its name.
//   * `ceiling`'s `push` — a gain INTO the limiter. master_limit's threshold is
//     fixed in the DSP, so "louder" has nowhere to go that is not a lie about
//     where the loudness came from.
// All three still round-trip in the song and still draw on the board; they
// simply do not reach the sound, which is better than reaching it wrongly.
// the tables are the REGISTRY's — read through NuFields rather than copied, for
// the reason every table on this page is read rather than copied
const GLUE_COMP = { soft: 0.2, glue: 0.35, tight: 0.55, pump: 0.75, squash: 0.95 };
export function masterState(MASTER) {
  const m = MASTER && typeof MASTER === "object" ? MASTER : null;
  const out = {};
  const { DRIVES, TAPES, SPACES } = NuFields;
  if (m) {
    const d = DRIVES[m.drive];
    if (d != null) out.grit = d;                     // fx_bus `grit`, same 0..1 scale
    const g = GLUE_COMP[m.glue];
    if (g != null) out.comp = g;                     // fx_bus `comp` — the bus compressor's amount
    const t = TAPES[m.tape];
    if (t) { out.wob = t.wob; out.tsat = t.sat; }    // fx_bus `wob` + `tsat`, verbatim
    const s = SPACES[m.space];
    if (s) out.mrev = s.mix;                         // fx_bus `mrev`, the global dry bleed
  }
  // THE MIX-OFFSET LAYER's master channel: deltas over the resolved value —
  // or, when the song's master says nothing, over the DSP's own defaults
  // (state-engine fxParams: tsat 0.18, mrev 0.07, the rest 0). Absent = the
  // untouched branch: identical output.
  const o = MIXER && MIXER.master;
  if (o) {
    const over = (k, dflt, off, hi) => {
      if (!off) return;
      out[k] = Math.max(0, Math.min(hi, (out[k] != null ? out[k] : dflt) + off));
    };
    over("grit", 0, o.drive, 1);
    over("comp", 0, o.glue, 1);
    over("wob", 0, o.tape ? o.tape * 0.5 : 0, 1);    // tape moves both halves,
    over("tsat", 0.18, o.tape ? o.tape * 0.5 : 0, 1); // gently
    over("mrev", 0.07, o.space ? o.space * 0.5 : 0, 0.5);
  }
  return Object.keys(out).length ? out : null;
}
