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
//                            -> the unit's STRIP bands (the parent's own
//                               per-voice strip stage — its EQ, not a copy),
//                               at `sampler.strip` on a sampled voice and at
//                               `strip` on a modelled one: two carriers because
//                               the engine renders the two in two places, ONE
//                               fact because both run the same makeStrip
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
         eqDb, familyOf,
         // HOW LONG A BAR IS, IN BEATS — the rack's echo needs it. fields.js
         // DTIMES is a fraction of a BAR and state.delay.beats is BEATS, so a
         // dotted eighth is 0.1875 of a bar either way and 0.75 beats only in
         // four. Under `three` a bar is 3 beats (kernel.js METERS, steps/4) and
         // the same word has to come out 0.5625 or the delay is in a different
         // metre from the band.
         METERS, stepsIn } from "../ui/deps.js";
import { NuFields } from "../ui/deps.js";
// bpm rides along for insertsFor: the parent resolves a chip's `rateBars` to Hz
// off the state's tempo, so a chip that asks for a bar-locked wobble has to be
// normalised against the song's own clock and not a default one.
// `BUSES` joined this list on 2026-08-26, and it is a live binding on purpose —
// the same door `MIXER` already comes through. A GROUP'S DESTINATION IS A SONG
// FACT and both the composed channel base and the unit table have to fold on
// the same answer, so neither may take it as an argument that one caller
// remembers to pass and the other does not. (ui/state.js setBuses normalizes it
// to null when it says nothing, which is what makes absent-is-today free here.)
import { POOL, bpm, MIXER, METER, BUSES } from "../ui/state.js";
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
// A COLOUR MUST NOT ALSO SAY "LOUDER" (2026-08-25).
//
// Eight of the twelve rows above are net BOOSTS as written — brass +1.5,
// reed/guitar/mallet +1, keys/bowed/strings/organ +0.5 — and that was harmless
// for as long as the number was computed and thrown away (audio/desk.js wrote
// the strip only `if (u.sampler)`, and `rbjCoefs` knew no shelf, so a family
// tone moved 0.00 dB on any voice). The 2026-08-24 EQ round made it a real
// stage, and the day it reached the tape every voice in those eight families
// got quietly LOUDER as well as differently coloured. That is the wrong sign of
// change for a tone control: a three-band carve that changes colour should not
// change loudness.
//
// So each row is CENTRED here rather than retyped above: the row's own mean is
// subtracted from all three bands, which leaves the shape exactly as the table
// says it and takes the level out of it. `bass` (+1.5 / -1.5) already summed to
// zero and does not move by a byte; `brass` {mid:+1.5} becomes
// {lo:-0.5, mid:+1, hi:-0.5}, which is the same carve without the lift.
//
// IT IS AN APPROXIMATION AND IT SAYS SO: a 120 Hz low shelf, a 1 kHz peak and a
// 7.2 kHz high shelf do not carry equal loudness weight, so "zero mean dB" is
// not "zero LUFS". It is the honest cheap version of the right idea, and the
// measurement that matters is in the round's report, not here.
const centredEq = (row) => {
  if (!row) return row;
  const bands = ["lo", "mid", "hi"];
  const mean = bands.reduce((a, k) => a + (row[k] || 0), 0) / 3;
  if (!mean) return row;
  const out = {};
  for (const k of bands) out[k] = Math.round(((row[k] || 0) - mean) * 10) / 10;
  return out;
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
  add(centredEq(FAM_EQ[fam]));
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
/* ---------- WHERE THE TWO GROUPS LAND, AND IT IS THE ONE ANSWER -----------
 * (Paul, 2026-08-26: "let me have up to four buses and a way to direct them to
 * each other.")
 *
 * THE FOLD WAS ALWAYS A ROUTE; IT JUST HAD NOBODY'S HAND ON IT. This line read
 *     rev: … + (m.room || 0) + …
 * in deskChannelBase and again in deskUnits, and the comment beside it said
 * "THE ROOM IS THE SAME BUS". True — but the SAMENESS was this file's choice,
 * not the engine's. render-core.js gives a unit two send gains, `u.rev` and
 * `u.del`, and nothing in the parent says which of them a group's sends have to
 * be added to. fields.js busRoute now answers that from the record, and this is
 * the one function that asks — so the board's meter, the composed base and the
 * unit table cannot disagree about a wire. A drift between those three is
 * exactly the failure `deskBusFeed`'s own note warns about ("the strip's meter
 * and the tape agree").
 *
 * ABSENT IS TODAY, EXACTLY: `busRoute(null)` sends both groups to bus 1, which
 * is the fold this file has always done, so a record that never touched a `to`
 * knob writes byte-identical sends. desk-gate G1 and G14 hold it.
 *
 * `S.room` ON THE DRUMS FOLLOWS THE SAME ROUTE, because it is the same bus 3 —
 * the box's kit-ambience send and a part's are two writers of one group, and
 * routing one and not the other would put the kit in a different room from the
 * chair beside it. */
// THE TWO BOX SENDS ARE SCOPED DIFFERENTLY AND THAT IS NOT AN OVERSIGHT.
// `sec.room` reaches the DRUMS ONLY, because it is the kit-ambience lane
// nukernel has always had and widening it would put every record's whole band
// into a room only the kit was ever in. `sec.aux` is new and has no such
// history, so it reaches every seated voice exactly the way `sec.rev` and
// `sec.del` do — which is what a general group send is. Absent is 0 on both.
// ...AND THE ROUTE IS RESOLVED ONCE PER CALLER, NOT ONCE PER CHANNEL. deskUnits
// walks every unit in the song's cast and calls this for each; busRoute walks
// four rows and follows their edges, which is cheap but not free, and this file
// runs inside the bar budget (the realtime margin is thin — see the COST table
// in the masterState block). `route` defaults to a fresh resolve so the two
// callers that ask about ONE channel stay one-liners.
function feedSplit(m, S, isDrums, route) {
  const R = route || NuFields.busRoute(BUSES);
  const box = { room: isDrums ? S.room || 0 : 0, aux: S.aux || 0 };
  const add = { rev: 0, del: 0 };
  for (const g of ["room", "aux"]) {
    // a cycle resolves to the shipped fold (fields.js busRoute), never to
    // nowhere — a refused route must not silently drop signal
    const lands = R[g].engine === "del" ? "del" : "rev";
    add[lands] += (m[g] || 0) + box[g];
  }
  return add;
}
// THE CHANNEL'S COMPOSED BASE, for the mixer surface: the "real" mix the
// offsets ride on, one function for the drawn number and the built one.
export function deskChannelBase(sec, key) {
  if (!sec) return { gain: 1, pan: 0, rev: 0, del: 0, eq: null, mute: false };
  const S = sectionOf(sec);
  const m = resolvePartMix(sec.parts && sec.parts[key]);
  const r = resolvedPart(sec, key);
  const g = feedSplit(m, S, key === "drums");
  return {
    gain: +(r.gain * S.lvl).toFixed(4),
    pan: (S.pan || 0) + (m.pan || 0),
    rev: Math.min(1, (m.rev || 0) + S.rev + g.rev),
    del: Math.min(1, (m.del || 0) + S.del + g.del),
    // the genre-bus send (series-bus round) — per-part only: no section lane,
    // no group folds into it, so the composed base IS the strip's own word
    genre: Math.min(1, m.genre || 0),
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
               // both groups carried, so feedSplit above has all four sends
               pan: m.pan, rev: m.rev, del: m.del, room: m.room, aux: m.aux,
               genre: m.genre, fx: m.fx,
               // THE SLOTS' FINISHED CHAIN (2026-08-27 — Paul: "Add per voice
               // effects, up to three. Each has a wet dry mix and its own
               // settings"). fields.js fxChainFor resolves the entry's three
               // seats plus their wet (`fxw<n>` -> the chip's own mix param)
               // and face knobs (`fxa/fxb<n>`) into the parent's {type,
               // module, params} recipe dialect; deskUnits hands it through
               // insertsFor -> state-engine insertChain, which clamps every
               // knob to the slider the module declares. `fx` above stays the
               // raw key list for the readers that only ask WHICH chips.
               fxc: NuFields.fxChainFor(ent),
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
    aux: sendOf(sec, "aux", 0),
    eq: mergeEq(derivedSecEq(sec), sec.eq),
    // THE SECTION'S OWN CHIP STAYS, AND IT IS NOT CHARACTER (2026-08-27).
    // Two different facts shared this carrier and only one of them went.
    //
    //   · `sound.fx`, the RECORD-wide Character chain, was written onto every
    //     box by ui/eight.js push() (`b.fx = boxFxOf(DOC)`) and reached every
    //     seated voice. Paul: *"We can get rid of Character right? We don't
    //     really use it any more do we?"* — that writer is gone, the chip is
    //     dealt to each chair's own `desk.fx`, and it arrives below as `p.fxc`
    //     through the same insertsFor door, in the same chain position, on the
    //     same voices. desk-doc.js carries the tombstone.
    //   · `box.fx` is the BAND page's section treatment — band-kit.js SECMIX
    //     `dub: { echo: "wet", rev: "wet", fx: ["echo"] }`, "dub it out",
    //     beside `lvl`, `rev` and `echo` on the same box, and compose.js:1364
    //     era-filters it. That is a hand on one SECTION of one record, it has
    //     its own owner and its own control, and deleting this line would have
    //     silently taken the echo off "dub it out". (Measured before the line
    //     was nearly deleted: `b.fx` has one live writer left, and it is that
    //     table.)
    fx: (sec.fx || []).filter(k => FX[k]).slice(0, MAX_FX),
    auto: compileAuto(sec, g),
  };
}

/**
 * THE EQ, AS THE PARENT SPELLS IT — and this paragraph used to be a lie, which
 * is why the correction is written here rather than swept up.
 *
 * WHAT IT SAID: "the parent's per-voice STRIP stage says the same three in the
 * same units ... there is only one stage and both paths render it."
 *
 * WHAT WAS TRUE ON 2026-08-24: nobody rendered it. `lo`/`mid`/`hi` were a
 * FOURTH spelling of tone with no reader anywhere in engine/ — sampler.js's
 * makeStrip read `hpf/lpf/eq/eq2/sat/comp/chorus/phase/leslie/delay/flanger/
 * trim`, and rbjCoefs knew hp, lp and peak with no shelf at all. Measured
 * through the parent's own strip on white noise, `{lo:-12, mid:+12, hi:+12}`
 * came out BIT-IDENTICAL to a flat strip, while the parent's own dialect
 * `{eq:{f:1000,gain:-12}}` moved 1 kHz by 11.8 dB. So the board's three knobs
 * reached no sound on ANY voice, sampled or modelled — and the gate that was
 * supposed to prove otherwise (desk-gate G8) asserted a FIELD IN AN OBJECT and
 * was green throughout. That is the test-the-artifact law, failed.
 *
 * WHAT IS TRUE NOW: the sentence was made true instead of deleted. sampler.js
 * rbjCoefs grew the two RBJ shelf cases, makeStrip grew three stages at the
 * board's own frequencies (its BOARD_EQ — the same 120 / 1000 / 7200 that
 * fields.js EQ_BANDS silkscreens, gated against each other in desk-gate G8),
 * and they run LAST in the chain, downstream of the instrument's own carve.
 * There is now exactly one stage and both paths render it.
 *
 * ANNOUNCED, NOT SLIPPED IN: 222 sampled chair-boxes across the catalog already
 * carried a non-flat lo/mid/hi that did nothing (median 1.5 dB, max 2.0 dB —
 * the FAM_EQ family tone and the derived section shading). Those records now
 * sound the way the desk always said they did. The unit TABLE is byte-identical
 * for every one of them; what changed is that the renderer stopped ignoring it.
 */
function stripWith(strip, eq) {
  if (!eq || (!eq.lo && !eq.mid && !eq.hi)) return strip || null;
  const s = strip ? { ...strip } : {};
  s.lo = (s.lo || 0) + (eq.lo || 0);
  s.mid = (s.mid || 0) + (eq.mid || 0);
  s.hi = (s.hi || 0) + (eq.hi || 0);
  return s;
}
// the absent-is-today law lives in the first line of stripWith — a flat EQ
// returns the strip it was handed, so nothing is written and no key appears.
// desk-gate G8 asserts it there rather than inferring it from a unit table.
export const __test = { stripWith };

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
  // ...and two families the band's own chairs actually hold: an electric
  // piano is not a `piano` by name and a pad is not `strings`, so the desk
  // had no address for either — which meant the engineer could shape the
  // kit and the bass and nothing else. (`keys` deliberately includes the
  // pianos too: one chair, one address.)
  ["keys", /rhodes|_ep|electric_piano|clavinet|piano|organ|harpsichord/],
  ["pads", /pad|polysynth|synth_strings|slow_strings|saw_wave|square_lead|fifth_/],
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
  // one answer to "where does each group land", for the whole unit walk
  const ROUTE = NuFields.busRoute(BUSES);
  const out = {};
  for (const [key, u] of Object.entries(units)) {
    if (!u || key.slice(0, 2) === "__") { out[key] = u; continue; }
    const p = P[addr[key] || (u.drum ? "drums" : "")] || null;
    const eq = p && p.eq ? p.eq : S.eq;
    // THE ROOM WAS THE SAME BUS BECAUSE THIS FILE SAID SO, and now the record
    // says so instead. The paragraph here read: "THE ROOM IS THE SAME BUS. The
    // ambience nukernel's kit lanes fed IS the parent's reverb bus, so a part
    // asking for room and a box asking for it are both asking for more of the
    // one reverb everything already shares — the box's room reaches the DRUMS
    // (whose room it was), a part's reaches that part." The second half stands
    // verbatim and is still how `S.room` is scoped; the first half was a
    // hard-coded destination wearing an engine's clothes. `feedSplit` above has
    // the whole argument and busRoute(null) reproduces this exact fold.
    const isDrum = !!u.drum || !!(u.__meta && u.__meta.drum);
    // THE MIX-OFFSET LAYER (ui/state.js MIXER): the mixer surface's own hand,
    // per CHANNEL (part key or "drums") for the whole song, applied last —
    // OVER the composed per-section values, never instead of them. null =
    // byte-identical. The band page's engineer writes this layer too, and
    // since 2026-08-21 one channel's offset can be SEVERAL treatments summed
    // (band-kit mixOf: room + slapback + darker on one guitar — rev, del and
    // eq are independent lanes, pre-clamped there at this desk's own ranges);
    // this side needs nothing special for that — a summed offset is just an
    // offset, and c01/faderDb/eqDb below hold every lane on the rails as
    // they always did.
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
    const grp = feedSplit(p || {}, S, isDrum, ROUTE);
    const rev = (p ? p.rev || 0 : 0)
      + (autoRev != null ? autoRev : S.rev) + grp.rev;
    const del = (p && p.del ? p.del : 0)
      + (autoDel != null ? autoDel : S.del) + grp.del;
    const v = { ...u,
      lvl: (u.lvl != null ? u.lvl : 1) * S.lvl * (p ? p.gain : 1),
      rev: Math.min(1, rev), del: Math.min(1, del) };
    // THE GENRE SEND (series-bus round, 2026-08-27): the strip's fourth send,
    // per-part only (no section lane, no group folds into it — feedSplit's
    // groups land on rev/del as ever). WRITTEN ONLY WHEN NON-ZERO, so a
    // record with no hand on the word produces the byte-identical unit table
    // it always did (the offer-identity law); every trim below that moves
    // rev/del moves it too, because a fader is one trim over the whole route.
    if (p && p.genre) v.genre = Math.min(1, p.genre);
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
    // THE PAGE'S ROUTE TRIM (to-engine PAGE_TRIM/trimRoute): a modelled voice's
    // raw output sits well under the sampled band's, and its dry tap already
    // carries the measured makeup. The sends this desk just composed multiply
    // the same RAW output, so without the same gain the lifted voice would sing
    // level but bone dry — its reverb 18 dB under the room everyone else is in.
    // Applied after the clamps on purpose: the rails bound what a hand may ask
    // for, and the trim is not a hand, it is the route. Absent (=== every
    // sampled voice, every unit the parent built), byte-identical.
    if (u.pageTrim && u.pageTrim !== 1) { v.rev *= u.pageTrim; v.del *= u.pageTrim; if (v.genre) v.genre *= u.pageTrim; }
    // ...AND THE MASTER FADER REACHES A MODELLED VOICE, which it never did.
    // ("I need a volume slider on the top very badly" — Paul, 2026-08-23.)
    // The line above composes the master trim into `lvl`, and `lvl` is read by
    // the SAMPLED voices (sampler.js note gain) and by the DRUM units
    // (state-engine mapEvents `sets.level = u.lvl * amp`) and BY NOTHING ELSE:
    // a modelled pitched voice had its level baked into `params.level` and
    // `gmul` at cast time (state-engine pitchedUnit) and the desk moves
    // neither, so the master volume moved the band and left every synth, every
    // modelled electric and the singer exactly where they were. Measured on the
    // rendered artifact before this line existed: lvl x 0.25 on a modelled
    // chair = 0.00 dB (test/probes/live-mid-play.probe.js).
    //
    // IT LANDS ON THE ROUTE, not on `level` — the law to-engine.js trimRoute
    // already states for PAGE_TRIM, and for its reasons plus two more: `level`
    // is clamped to [0.001, 1] by pitchedUnit, so a boost above unity would
    // vanish into the clamp, and `gmul` is the SHAPER'S INPUT (dirt), so
    // turning a record down through it would also clean it up. Scaling the
    // three sends by one number is a fader: the voice's whole contribution,
    // dry and wet together, at the same gain. All three, never one — clamping
    // the wet while the dry moved would change the balance a fader must not.
    //
    // NOT the per-channel faders, deliberately: the BAND writes those itself
    // (band-kit mixOf writes `bass`, `vocals`, `unit:kick`, `unit:hat` faders
    // on 24 of the 30 records), so routing them here would re-balance records
    // nobody has touched — measured at -3.50..+3.00 dB over 25% of modelled
    // unit rows. `master.fader` is written by NO record, so this is exactly
    // 1.0 until a hand moves it, and the catalog is byte-identical.
    if (mo && mo.fader && !u.sampler && !isDrum) {
      const mf = Math.pow(10, faderDb(mo.fader) / 20);
      v.dry = (v.dry != null ? v.dry : 1) * mf;
      v.rev = (v.rev || 0) * mf;
      v.del = (v.del || 0) * mf;
      if (v.genre) v.genre *= mf;    // all the sends, never some (series-bus round)
    }
    // ...AND SO DOES THE CHANNEL'S OWN FADER/MUTE/SOLO (2026-08-27, FUTURE.md
    // Phase 0). The block above fixed the MASTER fader for modelled voices and
    // left the PART strip broken by the same mechanism: `p.gain` — the strip's
    // fader x level x mute/solo x the derived seat balance, partsOf above — is
    // composed into `v.lvl`, and `lvl` is read by sampled voices and drums AND
    // BY NOTHING ELSE (the whole argument three paragraphs up). Measured on the
    // rendered path before this block existed (test/tape-reach.test.js): a
    // -12.0 dB fader on a modelled chair moved its rendered RMS 0.00 dB while
    // the sampled chair beside it moved the full -12.04 dB. Same law, same
    // route: ONE trim over dry/rev/del together — all three, never one,
    // because clamping the wet while the dry moved would change the balance a
    // fader must not. `v.lvl` still carries p.gain for the table's other
    // readers; nothing modelled reads lvl, so nothing is applied twice.
    //
    // ANNOUNCED, NOT SLIPPED IN: p.gain is not only the hand's fader — it
    // carries derivedPartTone's seat dB (SEAT_DB, shade), so modelled chairs
    // whose derived balance was computed and thrown away now sit where the
    // desk always SAID they sat (the board's cap has drawn p.gain since the
    // day it existed — resolvedPart is the one truth for both). Measured
    // 2026-08-27 over all 199 catalog anchors (precompose genreToDocument):
    // 13,188 non-drum part rows, derived p.gain non-unity on 10,288 of them,
    // spanning -6.60..+2.61 dB. The unit TABLE's lvl column is untouched;
    // what changed is that the route stopped ignoring the strip.
    if (p && p.gain !== 1 && !u.sampler && !isDrum) {
      v.dry = (v.dry != null ? v.dry : 1) * p.gain;
      v.rev = (v.rev || 0) * p.gain;
      v.del = (v.del || 0) * p.gain;
      if (v.genre) v.genre *= p.gain;   // all the sends, never some (series-bus round)
    }
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
    // THE PART'S CHIPS ARRIVE FINISHED (p.fxc — partsOf above, 2026-08-27),
    // wet and face knobs already on them; the SECTION's and the offset
    // layer's chips still come through fxChain at their declared defaults,
    // because neither carries slot knobs. Same door (insertsFor) for all
    // three, so a chip and a default insert end up the same shape.
    // WHAT LEFT THIS LINE ON 2026-08-27 IS NOT A LIST, IT IS A WRITER: `S.fx`
    // still carries the band page's section treatment and no longer carries
    // the record's Character chain, because nothing writes that onto a box any
    // more — see sectionOf above.
    const chips = seated && !u.stereo
      ? insertsFor(SE, u, [...(p ? p.fxc : []),
                           ...fxChain([...S.fx, ...((o && o.fx) || [])])]) : [];
    if (chips.length) v.inserts = [...(u.inserts || []), ...chips];
    // the parent's placement pass already carved this voice's stereo seat; the
    // box's pan chip and a part's place RIDE ON it rather than replacing it
    const pan = (autoPan != null ? autoPan : S.pan) + (p ? p.pan : 0)
      + (o && o.pan ? o.pan : 0);
    if (pan) v.pan = Math.max(-1, Math.min(1, (u.pan || 0) + pan));
    // THE TONE DECISION, ON EVERY VOICE — the part EQ, the section EQ, the family
    // tone and the seat shading, merged once above into `eqAll` and then carried.
    // ("The modeled voice needs to go through the EQ as do all the faust
    // instruments." — Paul, 2026-08-24.)
    //
    // It used to be `if (u.sampler)` and nothing else, so a MODELLED voice —
    // which has `module` and no `sampler` — had the number computed and thrown
    // away. That was not a corner: 555 of 856 chair-boxes in the catalog are
    // modelled, 527 of them had a non-flat eqAll dropped, and on the shipped
    // chant the CANTOR (tract_voice) is modelled while the SCHOLA (ahh_choir) is
    // sampled — the two voices at the front of the record were the A/B of the
    // bug. A hand could ask for the board's full ±12 dB on a modelled channel
    // and get 0.
    //
    // TWO CARRIERS, ONE FACT. A sampled voice's strip runs inside the sampler's
    // per-note PCM mixer and is addressed through `sampler.strip`; a modelled
    // voice never enters that mixer, so its strip is a stage the RENDERER owns
    // and is addressed as `strip` (stream-renderer.js renderUnitWindow, and its
    // twin in press/render-core.js). Same spec dialect, same makeStrip, same
    // merge — the fork is in where the engine reads it, never in what it says.
    //
    // DRUMS INCLUDED, deliberately: a machine kit (tr909/tr808/cr78 — 15 anchors)
    // is modelled and a sampled kit is not, and the whole complaint is that those
    // two answered a board move differently. This is the BOARD's EQ, not
    // STRIP_PROFILES.drum's transient-preserving carve, which is untouched.
    //
    // ABSENT IS TODAY: stripWith returns its input when every band is 0, so a
    // record whose voices carry no EQ writes no `strip` key and the unit table is
    // byte-identical to the one this function produced before the branch existed.
    const eqAll = o && o.eq ? addEq(eq, o.eq) : eq;
    if (u.sampler) v.sampler = { ...u.sampler, strip: stripWith(u.sampler.strip, eqAll) };
    else { const st = stripWith(u.strip, eqAll); if (st) v.strip = st; }
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

/* ---------------- THE HONEST MASTER (2026-08-21) -------------------------
 * Paul: "when you turn on glue and other effects for a song in combination it
 * basically turns to sludge". Measured, and he is right, and the reason is not
 * taste — it is that THREE OF THE FOUR WORDS RAISE THE LEVEL and nothing gives
 * it back, so louder reads as better and you keep stacking. One record
 * (compose("rock", 3), 60 s, 74 bars, a real kit + bass + two guitars + a sung
 * lead), every on/off combination of the four words at their second setting:
 *
 *   word          ΔLUFS   Δcrest   Δkick attack   Δ vocal-band dip at kicks
 *   drive warm    +1.47    -1.69      -1.20 dB          -0.70 dB
 *   glue  glue    +0.87    -0.79      -0.13 dB          -0.43 dB
 *   tape  tape    -0.28    -0.13      -0.21 dB          -0.16 dB
 *   space room     0.00     0.00       0.00 dB           0.00 dB   <-- DEAD
 *   drive+glue    +2.20    -2.14      -1.19 dB          -0.91 dB
 *
 * Two separate deceptions in that table:
 *
 *  (a) +2.2 dB for drive+glue, and the whole of it is bought with transient.
 *      Every one of these controls chooses CHARACTER; none of them is a volume
 *      knob, and none of them said so. Fixed by TRIMMING EACH STAGE BY WHAT IT
 *      MEASURED — the knots below are ΔLUFS per setting, straight off that run.
 *
 *  (b) `space` did LITERALLY NOTHING — byte-identical output at every setting
 *      from "a touch" to "cavern". audio/plan.js hands the engine `reverb: 0`
 *      (a deliberate choice: the desk composes per-box sends and did not want
 *      toEngine's own default room on top), and fx_bus's return is
 *      `rin * rgain` with `rgain = state.reverb * 3.2` — so rgain was 0, which
 *      mutes the whole return: `mrev`, and every per-box `rev` send the desk
 *      composes with it. A room control that is wired to a muted return is the
 *      purest form of the same lie. `space` now OPENS the return (below), which
 *      is the only thing that makes the sends it feeds audible at all.
 *
 * The trims land on fx_bus params that default to the identity, so a song with
 * no master says nothing, writes nothing, and sounds exactly as before.
 *
 * AND NO, THIS BOX IS NOT GETTING GROUP BUSES, and here is the cost that says
 * so, because the next person to hear a kick duck a vocal will ask. The engine
 * sums EVERY unit's dry into ONE bus set (stream-renderer renderUnitWindow,
 * press assemble), so the master compressor's detector genuinely does hear kick
 * and voice as one signal. Drums / music / voice buses would fix that, and the
 * mechanism even exists already — stem-worker.js allocates one lazy
 * {dry,rev,del,pp,wL,wR} set per layer and is parity-gated against render-core,
 * and nothing calls it. What kills it is the DSP you would hang on each group:
 *   * one fx_bus instance = 7.9% of realtime measured (2.57x pad_saw, against a
 *     committed COST table that says 2.32 — the table is honest). Three of them
 *     is +25 points against the 17 points of headroom wavout-seam's render gate
 *     actually has (15.4% used of a 33% budget). It is not close.
 *   * three LIGHT group stages (master_limit is 0.52%, a bare stereo comp would
 *     be ~0.8%) WOULD fit: +1.5 to 2.4 points, and the extra bus adds cost
 *     nothing measurable (renderUnitWindow writes into whatever bus set it is
 *     handed; the group->master fold is 4-12 float adds a sample, 0.05-0.14% of
 *     realtime). The blockers there are not CPU: press allocates whole-song
 *     buses, so three sets is +359 MB on a 170 s song, and segment-parity holds
 *     the live and press summation orders byte-equal, so both paths would have
 *     to move together and exactly.
 * And the prize is small. Measured, the pumping this would fix is 1.2 dB of
 * extra kick-synchronous ducking (-0.51 dB bypassed, -1.74 dB with everything
 * on), and MOST OF IT IS NOT THE COMPRESSOR — drive alone walks the dip to
 * -1.73 dB while glue alone only reaches -1.20, i.e. it is the grit
 * waveshaper's instantaneous intermodulation, which no detector and no group
 * bus can touch. The cheap stand-in (a high-passed sidechain) was built and
 * measured and moved it 0.04 dB; see the note in fx_bus.dsp. What actually
 * moved it was the push budget below and the compressor's dry path.
 */
// ΔLUFS each stage ADDS at a given setting, measured with nothing compensating.
const DRIVE_LU = [[0, 0], [0.12, 0.61], [0.28, 1.47], [0.50, 2.05], [0.80, 2.32]];
const GLUE_LU  = [[0, 0], [0.20, 0.45], [0.35, 0.60], [0.55, 0.57], [0.75, 0.27], [0.95, -0.29]];
const TAPE_LU  = [[0.18, 0], [0.30, -0.28], [0.45, -0.69], [0.60, -1.08]];   // keyed on tsat
const SPACE_LU = [[0, 0], [0.07, 0.07], [0.13, 0.15], [0.20, 0.30], [0.30, 0.58]];  // keyed on mrev
// A trim UPSTREAM OF THE SOFT CLIP does not deliver its whole dB — the clipper
// was working harder and gives some back. Measured by trimming and re-reading:
// 0.81 of it for the grit and glue trims, 1.00 for the tape trim (it is past
// the compressor and the clip barely moves), 0.70 for the dry trim (the wet it
// is trading against is deliberately NOT trimmed).
const PRECLIP_EFF = 0.81, TAPE_EFF = 1.0, DRY_EFF = 0.70;
const lerpTbl = (tbl, x) => {
  if (x <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) {
    if (x <= tbl[i][0]) {
      const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i];
      return y0 + (y1 - y0) * (x - x0) / Math.max(1e-9, x1 - x0);
    }
  }
  return tbl[tbl.length - 1][1];
};
const trimFor = (tbl, x, eff) =>
  Math.max(0.05, Math.min(2, Math.pow(10, -lerpTbl(tbl, x) / eff / 20)));

/**
 * THE MASTER STRIP AND THE RACK, ON THE PARENT'S OWN STATE.
 *
 * `BUSES` joined the signature on 2026-08-24 and it is the whole of D3's
 * headline fix. A bus row is not a second chain — it is three state fields the
 * parent's own fxParams/reverbColor already resolve, which is the same deal the
 * master strip took above. Before it existed nothing on this page could write
 * `state.reverb`: audio/plan.js hands toEngine `reverb: 0` on purpose (so
 * toEngine's own default room does not land under a desk that composes its own
 * sends), fxParams reads `rgain = clamp(state.reverb*3.2, 0, 2)`, and the only
 * writer was `space`'s global bleed. Measured on the shipped chant: every unit
 * carried `rev: 0.78` — gregorian's `tone.verb` (genres.js:682), defaulted in by
 * sectionOf — into a bus whose gain was zero. 78% wet and bone dry.
 */
// `SEV` (optional, 2026-08-27 series-bus round) is state-engine, for finishing
// the genre bus's chain chips through insertChain — the same clamp door every
// section chip takes (insertsFor). Callers without it still get the chain in
// the raw fields.js fxChain dialect, which mkChain builds fine; only the
// rateBars->Hz resolution and param clamps are lost, so pass it where you have it.
export function masterState(MASTER, BUSES, SEV) {
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
  // THE RACK. Every knob fields.js BUSROWS still declares lands here, and the
  // test for whether a knob may exist at all is whether it can: `room` carries
  // no knob because bus 3 is the reverb bus (a part's `room` folds into its
  // `rev`, deskChannelBase above) and the parent's `pp` is stamped on DRUM
  // events only.
  const B = BUSES ? NuFields.resolveBuses(BUSES) : null;
  if (B && B.rev) {
    if (B.rev.ret != null) out.reverb = B.rev.ret;
    if (B.rev.color) out.reverbColor = B.rev.color;
  }
  if (B && B.echo) {
    // a bar, in beats — see the METERS/stepsIn import note at the top
    const beats = stepsIn({ meter: METERS[METER] }) / 4;
    const d = {};
    // THE DELAY'S RETURN, 2026-08-27 (FUTURE.md Phase 0). Bus 1's `ret` has
    // reached `state.reverb` -> rgain since the rack was built; bus 2's return
    // was fx_bus's `dgain`, which fxParams emitted as the literal 1 — the one
    // rack fact no knob could move. `echo.ret` is dgain's own units
    // (fields.js ERETURNS, 0..2, room = 1 = today) and rides `state.delay.gain`
    // -> fxParams `dgain`. Absent = no `gain` key = fxParams' 1, byte-identical.
    if (B.echo.ret  != null) d.gain = B.echo.ret;
    if (B.echo.time != null) d.beats = B.echo.time * beats;
    if (B.echo.fb   != null) d.feedback = B.echo.fb;
    if (B.echo.tone != null) d.cutoff = B.echo.tone;
    // the engine's own three stand where the rack is silent (to-engine.js:1172
    // falls back to { beats: .75, feedback: .25 } and fxParams to cutoff 2600),
    // so a rack that names one knob does not blank the other two
    if (Object.keys(d).length)
      out.delay = { beats: 0.75, feedback: 0.25, cutoff: 2600, ...d };
    // THE BLEED, 2026-08-27 (series-bus round). Bus 2 pours into bus 1 at
    // fx_bus's `bleed` slider — the literal `d*0.2` until this round — and
    // `echo.bleed` (fields.js EBLEEDS, `stock` = 0.2 = the literal) is the
    // hand on it, riding `state.bleed` -> fxParams. Absent = no key = the
    // fxParams default 0.2, byte-identical.
    if (B.echo.bleed != null) out.bleed = B.echo.bleed;
  }
  // THE GENRE BUS (series-bus round, 2026-08-27): the rack's one genuinely new
  // stage, resolved off the record like every other bus fact. Its chain is the
  // box FX vocabulary (fields.js GXCHIPS -> fxChain, the same twelve chips a
  // voice slot takes), finished through state-engine insertChain when the
  // caller hands `SEV` (the same insertsFor door every section chip goes
  // through, so a chip and a bus chip end up the same clamped shape); its
  // `level` is the gain on the summed return as it lands on the delay bus.
  // The engine reads `state.genreBus` in BOTH renderers (stream-renderer /
  // press) — chain over the genre accumulator, times level, SUMMED INTO DEL
  // before fx_bus: genre -> delay -> reverb -> main, the series. Absent = no
  // key = the stage never runs = byte-identical.
  if (B && B.genre) {
    const chips = [B.genre.fx1, B.genre.fx2, B.genre.fx3].filter(Boolean);
    const gb = {};
    if (B.genre.level != null) gb.level = B.genre.level;
    if (chips.length) gb.chain = insertsFor(SEV, {}, fxChain(chips));
    if (Object.keys(gb).length) out.genreBus = gb;
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
  if (!Object.keys(out).length) return null;         // absent: the engine's own master
  return honest(out);
}

/* ONE PUSH BUDGET, and then everybody pays for their own level.
 *
 * THE BUDGET. drive is a waveshaper, glue is a compressor and tape is a SECOND
 * waveshaper, and all three squeeze the same mids. Stacked at full they are not
 * three characters, they are one mush — measured, drive+glue+tape at their top
 * settings costs 1.3 dB of crest and 1.6 dB of kick attack against bypass while
 * ending up QUIETER than bypass, which is the signature of a chain fighting
 * itself. So they share one budget: each claims a fraction of it (drive of its
 * own range, glue of its own, tape of the saturation it adds over the default
 * head), and when the claims exceed 1 the FOLLOWERS give back — never drive,
 * because drive is the one you asked for by name, and never below 55%, because
 * THE FREEDOM TO RUIN A MIX IS NOT THE BUG. The bug was that ruining it read as
 * an improvement. At the natural "on" settings the claims total 1.004 and the
 * followers give back 0.4% — this does not touch the sane middle of the board.
 *
 * PARALLEL GLUE. The compressor keeps a dry path underneath (fx_bus `cpar`),
 * scaled with how hard it is squeezing. Measured at matched loudness it buys
 * no crest and no attack — the compressor was never the transient thief here —
 * but it does take 0.39 dB off the kick-synchronous ducking of the vocal band
 * at squash, and 0.10 dB at glue, which is the only lever a single shared bus
 * has against the pumping at all.
 *
 * THE TRIMS. Each stage then trims its own output by what it measured, so
 * turning a word on changes the sound and not the loudness. Verified: every
 * single control, and every combination of them, within ±0.5 LUFS of bypass.
 */
function honest(st) {
  const grit = st.grit || 0;
  const comp0 = st.comp || 0;
  const tsat0 = st.tsat != null ? st.tsat : 0.18;
  // the claims: each word as a fraction of its own range
  const cd = Math.min(1, grit / 0.80);
  const cg = Math.min(1, comp0 / 0.95);
  const ct = Math.min(1, Math.max(0, tsat0 - 0.18) / 0.42);
  const over = Math.max(0, cd + cg + ct - 1);
  const follow = Math.max(0.55, 1 - 0.45 * over / 2);
  const comp = comp0 * follow;
  const tsat = 0.18 + (tsat0 - 0.18) * follow;
  if (comp !== comp0) st.comp = round3(comp);
  if (tsat !== tsat0) st.tsat = round3(tsat);
  // parallel glue: 20% of the dry underneath at the gentlest, 50% at squash
  if (comp > 0) st.cpar = Math.round((0.20 + 0.30 * Math.min(1, comp / 0.95)) * 100) / 100;
  // SPACE OPENS THE RETURN. rgain = reverb*3.2 in fxParams, and the four
  // measured settings (a touch / room / hall / cavern) want rgain .25/.45/.70/1.0
  // against a mix that is 23/18/14.5/11.3 dB under the dry — one relation fits
  // all four, and it is very nearly rgain = mrev*3.35.
  const mrev = st.mrev != null ? st.mrev : 0.07;
  // ...UNLESS THE RACK ALREADY SAID SO. `space` opened the return because it was
  // the only word that could; now `buses.rev.ret` is the return and `space` is
  // the global dry bleed it always was. One owner for state.reverb, and it is
  // the rack — otherwise choosing "a hall" on bus 1 and "cavern" on the master
  // would be two spellings of one number, and the second one written would win.
  if (st.mrev != null && st.reverb == null) st.reverb = Math.round(mrev * 1.05 * 1000) / 1000;
  // THE STACK TERM. Each stage's trim is measured ALONE and lands within
  // 0.06 LUFS alone — but two stages in series leave about 0.09 dB on the
  // table and three leave three times that (measured: drive+glue +0.14,
  // glue+tape +0.12, drive+tape +0.07, all three +0.27, and +0.52 with all
  // three at their top settings). It is the soft clip: a stage that is no
  // longer slamming it hands the next stage a signal the clipper shapes
  // differently. One term per PAIR, scaled by how hard the stack is pushing,
  // split evenly between the stages that are in it.
  const claims = [cd, cg, ct].filter((c) => c > 0);
  const n = claims.length;
  const pairs = (n * (n - 1)) / 2;
  const stackDb = n > 1
    ? 0.09 * pairs * (1 + claims.reduce((a, b) => a + b, 0) / n) : 0;
  const shareDb = n ? stackDb / n : 0;
  const share = Math.pow(10, -shareDb / 20);
  // and now the bill for each of them
  if (grit > 0) st.gtrim = round3(trimFor(DRIVE_LU, grit, PRECLIP_EFF) * share);
  if (comp > 0) st.ctrim = round3(trimFor(GLUE_LU, comp, PRECLIP_EFF) * share);
  if (tsat !== 0.18) st.ttrim = round3(trimFor(TAPE_LU, tsat, TAPE_EFF) * share);
  if (st.mrev != null && mrev !== 0.07) st.dtrim = round3(trimFor(SPACE_LU, mrev, DRY_EFF));
  return st;
}
const round3 = (x) => Math.round(x * 1000) / 1000;

/* ================== A BUS IS A CHANNEL. WHAT REACHES ITS FADER, AND WHERE
   ITS FADER REACHES. ========================================================
 *
 * (Paul, 2026-08-25: "master and the buses should also be arranged like the
 * mixing board no?" … "I should be able to use the board to send signal to the
 * buses and then from the buses to the master mix too.")
 *
 * THE SECOND HALF OF THAT SENTENCE IS THE ONE WITH AN ANSWER IN IT, and the
 * answer is different for each of the three buses. So it is computed here,
 * once, in the file whose header already promises to name what has no home
 * rather than fake it — and the REASONS are strings on this object rather than
 * sentences in the view, because a board that types its own excuse can drift
 * from the engine that owes it. desk-gate G12 asserts the page prints these
 * exact words.
 *
 * VOICE -> BUS, all four, WIRED — and only two of them are engine buses.
 * deskUnits writes `u.rev` and `u.del` on every unit and the parent's renderers
 * sum them into the shared { dry, rev, del, pp } buses (render-core.js:19).
 * Bus 3 and bus 4 are GROUPS: their sends are real and they arrive at whichever
 * of those two numbers `feedSplit` aims them at. This paragraph said "`room` is
 * not a fourth number: deskChannelBase folds a part's `room` into its `rev`, so
 * bus 3's feed arrives at bus 1" — still true when the group is aimed where it
 * has always been aimed, and now it is a value in the record rather than a
 * constant in this file.
 *
 * BUS -> MASTER, one of four, and only one:
 *   BUS 1 IS WIRED AND IS THE ONLY ONE. `buses.rev.ret` -> masterState `reverb`
 *     -> state-engine fxParams `rgain = clamp(reverb*3.2, 0, 2) * reverbScale`.
 *     That IS a bus-to-master send, it has been one since the rack round, and
 *     it is what the board's bus-1 fader moves.
 *   BUS 2 IS NOT. fx_bus really does carry `dgain` — a 0..2 slider, init 1,
 *     compiled into the wasm (dist/fx_bus-meta.json) and pushed by both
 *     renderers (stream-renderer.js:652, press.js:380). But fxParams emits it
 *     as the LITERAL `dgain: 1` (state-engine.js:2400) and reads no state field
 *     on the way, so there is no word this page can write that moves it. A
 *     delay-return fader here would be a knob that lies; it is drawn refused
 *     with this sentence instead. The fix is one line in the parent plus its
 *     parity gates, which is not this page's to take.
 *   BUS 3 AND BUS 4 ARE NOT RETURNS AT ALL, and PROGRAM.md §4.11 already
 *     records why for the first of them: the parent's own third bus is `pp`,
 *     state-engine:2808 stamps `pp` on DRUM events only, and state-engine's own
 *     note adds that it is not sent on SAMPLED drums either ("the sampler mix
 *     has no pp bus") — which is nearly every kit in this catalog. So there is
 *     a fourth engine bus and no word on this page can put a signal into it.
 *     Bus 3 and bus 4 are therefore groups, and a group's honest answer is not
 *     a return of its own but a DESTINATION: `to`, resolved by busRoute, drawn
 *     as a control because it is one, and printed in the `goes to` row.
 *
 * BUS -> BUS, AND THE ANSWER IS DIFFERENT FOR EACH KIND (2026-08-26). The
 * paragraph here read: "BUS -> BUS does not exist and is not drawn. fields.js
 * took the two cross-sends off on 2026-08-24 with the measurement: `x<bus>` was
 * written against the WebAudio rack the one-engine round deleted, and
 * busSendPlan — the cycle refusal that made an edge safe — has had no caller
 * since." That was right about `x<bus>` and it asked the question one level too
 * high. Read engine/faust/dsp/fx_bus.dsp:221 and there are FOUR bus-to-bus
 * terms already in the signal, and they are not all the same kind of thing:
 *
 *     rin = (rev + d*0.2 + (ppl + ppr)*0.12 + (dl + dr)*0.5*mrev) * rgain;
 *
 *   BUS 2 -> BUS 1 is `d*0.2` and the 0.2 IS A LITERAL IN THE DSP. Delay into
 *     the plate is running on every record this page has ever made, at a fixed
 *     20%, and no word here moves it. Making it a knob is a `.dsp` edit plus a
 *     recompile plus the byte-parity gates, and it changes a shipped sound.
 *     Refused with this sentence rather than drawn.
 *   pp -> BUS 1 is `(ppl+ppr)*0.12`, the same literal, on a bus nothing on this
 *     page can feed anyway (see BUS 4 below).
 *   THE MAIN'S DRY -> BUS 1 is `(dl + dr)*0.5*mrev`, AND `mrev` IS A SLIDER —
 *     compiled into fx_bus.wasm (dist/fx_bus-meta.json: init 0.07, range
 *     0..0.5), emitted by state-engine fxParams off `state.mrev`, and WRITTEN
 *     BY THIS FILE ALREADY: masterState turns the master's `space` chip into
 *     it. So the page has had exactly one live bus-to-bus send the whole time
 *     and nothing on the board said it was one. The board's routing row says it
 *     now, and it POINTS AT `space` rather than drawing a second control — one
 *     owner per fact, and `space` is the owner.
 *
 * ...AND THE ROUTE THE DESK OWNS OUTRIGHT, which is what "a way to direct them
 * to each other" actually buys. Bus 3 and bus 4 have no engine accumulator
 * (fields.js BUSROWS `engine: null`), so where their feed lands is a decision
 * THIS FILE makes while composing `u.rev` and `u.del` — hard-coded to bus 1 in
 * two places until now, and `feedSplit` reading fields.js busRoute since. A
 * group aimed at bus 2 moves every unit's `del` in `__nuMix()`: a real wire,
 * costing the parent nothing, and the difference between four buses and three
 * buses and a label. busSendPlan's cycle refusal comes back as busRoute /
 * busToOk, with a caller.
 *
 * `feed` is the sum of what the channels are sending, not an average: two
 * voices at `some` put more into the plate than one does, which is what a bus
 * meter on a desk shows. It is the SAME number deskUnits hands the engine
 * (deskChannelBase, per channel), so the strip's meter and the tape agree.
 */
// `short` IS THE MARKER IN THE CELL AND `why` IS THE SENTENCE UNDER THE TABLE,
// and the split is a measurement rather than a taste: a bus column is 124px and
// the `why` below wraps to ten lines in one, which made the board's fader row
// 200px tall and pushed every other strip's fader off a phone screen. It is the
// precedent ui/selects.js:238 already states for a menu in a <td> — "the VISIBLE
// copy is still the caller's to place … a table puts it once under the table
// rather than eight times down a column". Both strings are on the page, the
// short one beside the control and the long one once beneath it, so "do not
// draw a control that reaches nothing without saying so" is kept twice over.
//
// `to` CAME OFF THIS OBJECT FOR THE TWO GROUPS, 2026-08-26, and the reason is
// the one-owner law rather than tidiness: a group's destination is now a value
// in the record (`buses.<bus>.to`), so a constant here would be a second answer
// to a question busRoute already answers, and the two would part company the
// first time a knob moved. deskBusFeed reads the route for a group and this
// table for a bus that has one — `to: null` here means "ask busRoute".
export const BUS_REACH = {
  rev: { to: "main", short: null, why: null },
  // BUS 2's RETURN IS MOVABLE NOW, 2026-08-27 (FUTURE.md Phase 0), and this
  // entry used to be the refusal: `short: "fixed at unity by the engine",
  // why: "bus 2's return is fixed at unity in the engine — state-engine.js
  // fxParams emits \`dgain: 1\` and reads no state, so nothing this page can
  // write moves it"`. Every word was true, and the fix was the one line the
  // recipe `bus-2-return-needs-one-line-in-the-parent.md` had already scoped:
  // fxParams reads `state.delay.gain` now (absent = the literal 1 it always
  // emitted), fields.js BUSROWS gives echo a `ret` knob in dgain's own units
  // (ERETURNS, 0..2, room = 1 = today), and masterState maps it on. Measured
  // rendered (test/tape-reach.test.js): dgain 1 vs 0 on a fed del bus moves
  // the fx_bus output; absent renders byte-identical.
  echo: { to: "main", short: null, why: null },
  // THE GROUPS' SENTENCE IS THE SAME SENTENCE TWICE because it is the same
  // fact twice: neither has an engine bus, and the parent's spare one cannot be
  // fed from here. The old bus-3 wording is kept inside it — it was the finding
  // that made the group honest — and what is added is the half that is now a
  // control rather than a constant.
  room: { to: null, short: "a group — aim it", group: true,
    why: "bus 3 is a group, not a return: the engine has two send buses (rev " +
    "and del) and its third is `pp`, which state-engine stamps on modelled " +
    "drum events only and never on a sampled kit. So bus 3's feed is summed " +
    "into whichever bus it is aimed at — bus 1 unless you say otherwise, " +
    "which is the fold deskChannelBase always did" },
  aux: { to: null, short: "a group — aim it", group: true,
    why: "bus 4 is a group, not a return: the engine has two send buses (rev " +
    "and del) and its third is `pp`, which state-engine stamps on modelled " +
    "drum events only and never on a sampled kit. So bus 4's feed is summed " +
    "into whichever bus it is aimed at — bus 1 unless you say otherwise" },
  // THE GENRE BUS (series-bus round, 2026-08-27): a REAL fifth accumulator in
  // both renderers, and its destination is the series itself — its chained
  // return sums into the DELAY bus at the rack's `level`, so `to` is bus 2 by
  // construction and no aim knob exists to disagree with it.
  genre: { to: "bus 2", short: null, why: null },
};
// THE ONE BUS-TO-BUS SEND THAT REACHES THE ENGINE, and it already has an owner.
// fx_bus.dsp:221 mixes the main's dry into bus 1 at `0.5*mrev`, and `mrev` is
// the master's `space` chip (masterState above). Printed on the routing row so
// the edge is visible, and NOT drawn as a control there, because drawing it
// twice is how "touch" comes to mean 0.12 in one place and 0.15 in the other.
export const MAIN_TO_BUS1 = {
  from: "main", to: "bus 1", knob: "space",
  why: "the main's dry feeds bus 1 at `0.5 * mrev` (fx_bus.dsp:221) and `mrev` " +
  "IS the master's `space` — it is the one bus-to-bus send on this desk that " +
  "reaches the engine, and its control is in the main strip above, not here",
};
// ...AND THE TWO INSIDE THE DSP THAT NOTHING CAN MOVE.
export const FIXED_EDGES = [
  // REWRITTEN 2026-08-27 (series-bus round): this entry used to read "bus 2
  // already feeds bus 1 at a fixed 20% — `d*0.2` in fx_bus.dsp:221 is a
  // literal in the DSP, not a slider, so it is running on every record and no
  // word on this page moves it". The literal became the `bleed` slider that
  // round (default 0.2 — byte-identical at the default), and the word that
  // moves it is the delay plate's `bleed` knob (buses.echo.bleed -> masterState
  // -> state.bleed -> fxParams). The edge stays on this list because it is
  // still an EDGE the routing row must draw; only "no word moves it" died.
  { from: "bus 2", to: "bus 1", amount: 0.2,
    why: "bus 2 feeds bus 1 at the delay plate's `bleed` knob — shipped at " +
    "20% (`d*bleed` in fx_bus.dsp, default 0.2, the old literal), 0 severs " +
    "the feed, 1 pours the whole delay into the room" },
  { from: "the engine's pp bus", to: "bus 1", amount: 0.12,
    why: "the parent's ping-pong bus feeds bus 1 at a fixed 12% " +
    "(`(ppl+ppr)*0.12`, fx_bus.dsp:221) — also a literal, and nothing on this " +
    "page can put a signal into that bus in the first place" },
];
export function deskBusFeed(sec, MASTERV, BUSESV) {
  const st = masterState(MASTERV, BUSESV) || {};
  // THE ROUTE IS READ OFF THE STORE AND NOT OFF `BUSESV`, DELIBERATELY, and it
  // is the one place in this file where an argument is ignored. `feedSplit`
  // CANNOT take a buses argument — deskUnits is called by audio/plan.js, which
  // has no bus value to hand it — so it reads the live binding. If this meter
  // routed off a value a caller passed instead, a caller who passed a different
  // one would draw a meter for a route the tape does not have, which is exactly
  // the drift the header of this section warns about ("the strip's meter and
  // the tape agree"). One source for a route. `BUSESV` still owns the RETURNS,
  // because those go through masterState, which is an argument-taking function
  // by the same design that makes the engineer pass it the store.
  const R = NuFields.busRoute(BUSES);
  // ONE ENTRY PER BUS, WALKED OFF THE REGISTRY, so a fifth bus meters itself by
  // existing — the law fields.js states for the `name` knob, one tier up.
  const feed = {}; for (const b of NuFields.BUSES) feed[b.bus] = 0;
  if (sec) {
    const S = sectionOf(sec);
    for (const k of partKeysOf(sec, voiceRoster(sec))) {
      const b = deskChannelBase(sec, k);
      const m = resolvePartMix(sec.parts && sec.parts[k]);
      feed.rev += b.rev;                     // the groups are already folded in
      feed.echo += b.del;
      feed.genre += b.genre || 0;            // the strips' genre sends (series-bus round)
      // A GROUP METERS WHAT IT IS GIVEN, not what leaves it, which is why these
      // two are read off the part and the section rather than off the channel
      // base: the base has ALREADY routed them into rev or del, and reading
      // them there would count the same signal twice.
      feed.room += (m.room || 0) + (k === "drums" ? S.room : 0);
      feed.aux += (m.aux || 0) + S.aux;
    }
  }
  // THE RETURN EACH BUS IS WORTH RIGHT NOW. bus 1's is the record's own word;
  // bus 2's is the record's own word too since 2026-08-27 (it read "the
  // engine's literal" here, and `echo: 1` was hard-coded — true while fxParams
  // emitted `dgain: 1` and read no state; the rack reaches it now, see
  // BUS_REACH.echo above); bus 3 has none because it is not a return.
  // ABSENT IS SHUT on bus 1 and that is not this file's opinion — audio/plan.js
  // hands toEngine `reverb: 0` on purpose, so a record that never opened the
  // rack sends into a bus whose gain is zero. ABSENT IS UNITY on bus 2 for the
  // mirrored reason: fxParams' own default is the 1 it always was.
  const ret = { rev: st.reverb != null ? st.reverb : 0,
                echo: st.delay && st.delay.gain != null ? st.delay.gain : 1,
                room: null, aux: null,
                // the genre bus's return is the rack's `level -> delay`;
                // ABSENT IS UNITY, the engine's own default (series-bus round)
                genre: st.genreBus && st.genreBus.level != null ? st.genreBus.level : 1 };
  const out = {};
  for (const b of NuFields.BUSES) {
    const bus = b.bus, r = ret[bus], reach = BUS_REACH[bus];
    // WHAT LEAVES THE STRIP, which is what a fader's meter shows on a desk.
    // A GROUP'S RETURN IS null AND ITS OUTPUT IS ITS FEED UNCHANGED, because
    // that is literally what happens: feedSplit adds a group's sends to another
    // bus's number at unity, so it passes what it is given straight on. A null
    // there would have drawn an empty meter on a bus that is carrying signal.
    // (This read `bus 3` and named deskChannelBase; the arithmetic is the same
    // and there are two of them now.)
    const route = R[bus];
    out[bus] = { feed: +feed[bus].toFixed(4), ret: r,
                 out: +((r == null ? feed[bus] : feed[bus] * r)).toFixed(4),
                 // `to` for a group is the ROUTE's answer and not a constant —
                 // printed as the board's own column word ("bus 2"), which is
                 // what BUSTO holds, so the row and the head agree.
                 to: reach.to || NuFields.BUSTO[route.chain[1]] ||
                     NuFields.BUSTO[NuFields.BUSDEFAULT],
                 why: reach.why, short: reach.short,
                 group: !!reach.group,
                 // the whole walk, for the row that prints where a group's
                 // signal finally arrives: bus 4 -> bus 3 -> bus 2 is a chain a
                 // reader has to be able to follow without doing it in their head
                 chain: route.chain.map((x) => NuFields.BUSTO[x]),
                 cycle: route.cycle,
                 movable: reach.why == null };
  }
  return out;
}
