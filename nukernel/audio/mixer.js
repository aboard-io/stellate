// audio/mixer.js — a section's mixer channel: level, pan, the motion filter,
// the AUX SENDS (reverb, echo, and one bus per character effect — all of them
// shared by the whole page, see the send law below), and window.__nuMix — the
// machine-readable truth about what the mixer actually BUILT versus what the
// chips declared, the node budget included (the project's "test the artifact"
// rule, in code; the browser gate reads every number in it).
//
// Layer graph: deps -> state -> derive -> graph -> assets -> voices ->
// THIS FILE -> transport. Subscribes to "song" (a new song is a new mix — keep
// no old channels) and "box" (prune the chains nothing asks for any more).
//
// THE MIXING IS THE BIG ENGINE'S MIXING, and none of it is a reimplementation:
//   channel strips  STRIP_PROFILES (instruments.js) handed to SamplerLive
//   the effects     SP.buildInsertNodes — literally the function live.js calls
//                   — once per effect for the page, on a bus (see below)
//   the master bus  audio/graph.js, live.js's numbers
// What is NOT borrowed is the topology: the big engine mixes per VOICE because
// a genre is one continuous thing. A song box is a SECTION, and a section is
// the unit you want to reverb, echo, filter, place and AUTOMATE — so the
// channel is per BOX (see CHAN below for why the spec-shared cache came off).
//
// AND UNDER THE SECTION, A DESK. One strip per box meant one insert chain for
// every voice in it: crunch on the guitar was crunch on the pad, the bass and
// the kit, and the only way to treat one thing was to give it a box of its own.
// A box now carries `parts` — a map of PART key (lead/pad/bass/drums…, the
// kernel's own roles, plus an ordinal where a genre has several of one) to the
// same small strip: two sends, level, place, mute and solo. Each one is a
// sub-bus feeding this channel's input, so the section chain is still the
// section-wide treatment and the desk sits in front of it. See partSpecs (what
// gets built) and buildChannel (how). The law both keep is now the DERIVED
// form of absent-is-today: a part whose resolved (gain, tone) is the identity
// builds not one extra node — but the song itself seats the desk
// (derivedPartTone), so most chairs carry a derived strip even before a
// finger touches them. The desk shows the song's truth, not a row of units.
//
// ================ AND THEN IT WAS ALL SENDS ================================
// "It is glitching — maybe we need a few effects buses feeding into one master
// effects bus instead of everything having its own effects" (the artist,
// 2026-08-15). Measured before believing him: a composed eleven-section
// Beatles song built 375 persistent mixer nodes, 337 of them inside the
// channels, and the graph had inflated across four rounds each defensible on
// its own — channels went per-box, drums grew a lane strip apiece, every part
// gained a private rack, the master grew to forty.
//
// HE IS DESCRIBING WHAT THE BIG ENGINE ALREADY DOES, and this file's own
// header has always said the mixing is the big engine's mixing. It is:
//   engine/faust/press/render-core.js  every unit renders into FOUR shared
//     buses — `{ dry, rev, del, pp }` (line 19) — with one gain apiece.
//   engine/faust/live/live.js          the whole found layer gets ONE submix
//     and one native reverb (`foundDests`, line 636), not a rack per voice.
//   engine/faust/voices/state-engine.js  per-voice CHARACTER is STRIP_PROFILES
//     inside the note chain, not an effects rack on the channel.
// So the three things that used to be private are now shared and sent to:
//   the character effects  fields.js "A CHIP IS A SEND; A CHAIN IS AN INSERT"
//                          + graph.js buildSendBus/sendFor — one bus per
//                          effect for the whole page, built on first use
//   the kit's own desk     graph.js buildKitDesk/kitFor — one set of lane
//                          strips for the page, reached through one gate per
//                          channel, the way voices.js routes the synth pool
//   the rooms and the echo unchanged: they were shared from the first day
// WHAT STAYS PRIVATE PER THING is level, pan, mute/solo and the send amounts —
// a gain and a panner, nothing else — plus the one budgeted exception below.
import { GENRES, FX, MAX_FX, fxChain, fxMix, fxSendable, SENDS, LEVELS, PANS,
         RATES, SP, DRUMFILE, DRUMMIX, DRUMBUS, instrOf, BASSSYNTH,
         partOf, chairKeys, resolvePartMix, faderDb, EQ_BANDS,
         eqDb, familyOf } from "../ui/deps.js";
import { SONG, POOL, on } from "../ui/state.js";
import { gid, stackOf, genreOf, kitOf, poolInstrOf } from "../ui/derive.js";
import { ctx, masterIn, delBus, roomBus, verbFor, sendFor, kitFor, buildKitDesk,
         barSec, REV, SENDBUS, VERBSPEC, masterReport, sharedReport,
         busReport, buildEq } from "./graph.js";
import { synthNodes, synthOut, clearRoutes, dropRoute, pruneSynths } from "./voices.js";

// the twelve lanes, for the __nuMix vocabulary line. The strips themselves are
// the page's now (graph.js buildKitDesk), and their numbers are still
// instruments.js DRUMMIX — a lane's pan is the KIT's internal geometry and
// nothing else, which is why they are small (±0.28) where the section's own
// pan chip is not (±0.7).
const LANEIDS = Object.keys(DRUMFILE);

/* ---------- THE NODE BUDGET, and why these are the numbers ---------------- */
// A budget nobody can check is a wish, so window.__nuMix carries the count and
// test/browser/nukernel-drums.test.js asserts this ceiling on a composed
// nine-plus-section song.
//
// PER CHANNEL, 27, and every term is a countable fact about the vocabulary. A
// section's own strip is nine nodes — input, pan, level, dry trim, reverb send,
// echo send, kit gate, room gate, room trim — plus at most three strip-EQ
// biquads (fields.js EQ_BANDS, built only when the box's `eq` is non-flat),
// at most three automation nodes (cutoff/hpf/level are the only three the
// compiler builds), at most MAX_FX=3 character sends, and one panner per
// pitched chair with eight the deepest stack the page can deal. That is 26;
// the extra is the collision carve. MEASURED on the composed eleven-section
// Beatles song: 8 to 13.
// PER PART, 11: pan, level, mute gate, dry trim, two sends, up to three
// character sends and up to three EQ biquads. Six or seven in practice, and a
// part only exists at all once somebody has mixed it.
// THE SHARED RACK, 230: the master chain (30 fully dressed) + three convolution
// reverbs (4 each) + the echo (9 — the rack's return gain is the ninth, the
// one shared node the board round added) + the drum room (26) + the kit desk (40 with
// all twelve lanes armed) + one bus per character effect, eleven of them at
// 8–18 nodes apiece — plus at most TEN return-EQ biquads (a lo/hi pair per
// verb, echo and room, built only when the song's `buses` asks). Nothing else
// in the song can make it grow — that is the claim the whole round rests on,
// and it is why the ceiling is flat rather than per-section. Measured on the
// same song: 95.
export const BUDGET = { chan: 27, part: 11, shared: 230 };

/* ---------- a section's mixer channel ---------- */
// KEYED BY THE BOX'S IDENTITY, not by its spec. Channels were shared by
// JSON.stringify(chanSpec) — correct while a channel was a static chain, and
// exactly what automation breaks: a point list makes every section's chain
// its own anyway (recon R11), so the sharing stopped paying and started
// constraining. What stays cheap is everything that matters: the synth pool
// is still keyed (dsp, voice) and routed through per-channel gates (the
// worklet-budget gate depends on it), reverbs are still built once per NAME,
// and a box whose spec changes rebuilds ITS channel in place — ahead of the
// bar, via the tick's prebuild — instead of stranding a shared one.
export const CHAN = new Map();               // box object -> channel
let chanSeq = 0;
const boxId = new WeakMap();                 // box object -> stable id for the key
const sendOf = (sec, k, dflt) => (sec[k] != null ? SENDS[sec[k]] : dflt);

// THE MOT FIELD IS AUTOMATION NOW — one code path. The legacy single-enum
// transition compiles to the same {param, points[[beat,value]…], curve} shape
// the box's `auto` list carries, with the exact ramp numbers armMotion used
// to hardcode. `hpf` is the one internal-only param (the riser is a highpass
// sweep, which the public cutoff — a lowpass — cannot say).
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
// This is what lets the channel place its voices and hear a COLLISION before a
// note is played: vaporwave puts `strings` on both its voices five semitones
// apart, shoegaze puts one overdrive guitar on top of another, and two voices
// on the same instrument in the same register are the definition of soup (the
// parent's mastering stage calls it a same-timbre collision and carves it; see
// buildChannel). Post rock has the same collision on paper — two clean guitars
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
//     (chanSpec lvl) and the whole-section velocity curve is already the
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
// and buildChannel bakes. Deterministic over (sec, key) — same walk, same
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
// partSpecs bakes into the built nodes. One function, three readers (the
// board's cap rest position, the node gate, partSpecs below), so the display,
// the test and the graph cannot drift apart.
export function resolvedPart(sec, key, roster) {
  const m = resolvePartMix(sec.parts && sec.parts[key]);
  const t = derivedPartTone(sec, key, roster);
  return { gain: +(m.lvl * Math.pow(10, (m.fader + t.db) / 20)).toFixed(4),
           eq: mergeEq(t.eq, sec.parts && sec.parts[key] && sec.parts[key].eq),
           tdb: t.db };
}
// THE BOX'S ADDRESSES -> THE SUB-BUSSES THAT NEED BUILDING.
//
// A part gets a bus when it asks for something OR when the song derives
// something for it (derivedPartTone above). The old law — "a box with no
// `parts` builds not one extra node" — was the flattering desk: it also meant
// a box with no `parts` had no per-part truth at all. What survives of it is
// the honest core: a part whose resolved (gain, tone) is the identity still
// builds nothing, so a genre with no tonal character keeps its old graph.
//
// SOLO IS THE ONE CONTROL THAT REACHES OTHER PARTS, so it is resolved here,
// where the box's whole address list is known: any solo anywhere in the box
// mutes every part that is not soloed, and a muted part needs a bus precisely
// so there is a gain to close.
function partSpecs(sec, roster) {
  const P = sec.parts && typeof sec.parts === "object" ? sec.parts : null;
  const keys = partKeysOf(sec, roster);
  const solo = !!P && keys.some(k => P[k] && P[k].solo);
  const out = [];
  for (const k of keys) {
    const ent = P ? P[k] : null;
    const m = resolvePartMix(ent);
    const t = derivedPartTone(sec, k, roster);
    const eq = mergeEq(t.eq, ent && ent.eq);
    const mute = m.mute || (solo && !m.solo);
    if (!mute && !m.fx.length && !m.rev && !m.del && m.lvl === 1 && m.pan === 0 &&
        m.fader === 0 && !eq && !t.db) continue;
    out.push({ key: k, fx: m.fx, rev: m.rev, del: m.del, lvl: m.lvl, pan: m.pan,
               fader: m.fader, tdb: t.db, eq, mute });
  }
  return out;
}
// which dsps are a BASS rather than a voice — the synth pool is keyed
// (dsp, voice index) and a synth bass is always written at voice 0, so the
// node key alone cannot tell a reese from a lead sitting in chair 0. The dsp
// can (see synthIn).
const BASSDSP = new Set(Object.values(BASSSYNTH).map(s => s.dsp));
export function chanSpec(sec) {
  const g = GENRES[gid(sec)];    // never null: a box always has an authority
  const roster = voiceRoster(sec);
  return {
    // the roster rides IN the spec, so a stack edit rebuilds the channel that
    // places it (the key is the stringified spec) instead of leaving yesterday's
    // placement on today's instruments
    roster,
    fx: (sec.fx || []).filter(k => FX[k]).slice(0, MAX_FX),
    // ABSENT MEANS "AS THE GENRE ASKS". Every genre already declares how wet it
    // wants to be (tone.verb — vaporwave .55, acid .06), and that number was
    // being thrown away: every voice went out on a flat 0.14 send. Reading it as
    // the default send makes the genre table mean what it says.
    rev: sendOf(sec, "rev", g.tone && g.tone.verb != null ? g.tone.verb : 0.15),
    del: sendOf(sec, "echo", 0),   // the box field is `echo` since v:2; the
                                   // channel key stays `del` — it names the bus
    verb: sec.verb || (g.tone && g.tone.verb > 0.4 ? "hall" : "room"),
    // the fader OFFSET multiplies the resolved level — the enum, the
    // composer's arc and any level automation keep meaning what they meant,
    // and the board's touch rides on top (fields.js `fader`, the board law)
    lvl: +((sec.lvl ? LEVELS[sec.lvl] : 1) *
           Math.pow(10, faderDb(sec.fader) / 20)).toFixed(4),
    pan: sec.pan ? PANS[sec.pan] : 0,
    // the section strip's EQ: the genre's derived character under the box's
    // own bands (mergeEq — a set band overrides, a cleared one returns to the
    // derived answer). null (flat) is still buildChannel's instruction to
    // build zero filter nodes, which a characterless genre still earns.
    eq: mergeEq(derivedSecEq(sec), sec.eq),
    mot: sec.mot || null,
    auto: compileAuto(sec, g),
    // the desk under the section strip. It rides IN the spec like the roster
    // does, so a mix move on one part is a changed key and the channel
    // rebuilds — ahead of the bar, through the tick's prebuild.
    parts: partSpecs(sec, roster),
  };
}
// BUILD ON THE GIVEN CONTEXT. `env` names the busses the channel hangs off —
// { master, verb(name) -> return node, echoIn } — because the offline bounce
// builds this exact chain against its own OfflineAudioContext busses. The
// live channelFor below is just this plus the cache and the live env.
export function buildChannel(c, spec, env) {
  const input = c.createGain();
  let node = input;
  const nodes = [input];
  const chain = n => { node.connect(n); node = n; nodes.push(n); };
  // THE STRIP EQ FIRST — the desk's own order: the tone block sits at the top
  // of an SSL strip, so the inserts, the sends and the automation all hear the
  // corrected signal. Built ONLY when the spec is non-flat (graph.buildEq, the
  // registry's own bands): a box that never touched an EQ knob builds these
  // zero nodes and the chain below is byte-identical to the day before the EQ
  // existed. Absolute, not automated — a knob move is a spec change and the
  // channel rebuilds; the board's drag eases the live gain params directly.
  let secEq = null;
  if (spec.eq) {
    secEq = buildEq(c, EQ_BANDS, spec.eq);
    node.connect(secEq.input); node = secEq.output; nodes.push(...secEq.nodes);
  }
  // AUTOMATION NODES first, so a filter sweep works the section BEFORE its
  // effects rather than after them — closing down onto a reverb tail is a
  // fade, closing down into one is a door shutting. Only the nodes the
  // compiled list actually touches are built (same types, same Q, same
  // position the old single mot node had); pan and the two sends automate
  // the nodes the channel already owns, below.
  const autos = spec.auto || [];
  const needs = new Set(autos.map(a => a.param));
  const A = {};
  if (needs.has("cutoff")) {
    A.cutoff = c.createBiquadFilter(); A.cutoff.type = "lowpass";
    A.cutoff.Q.value = 2.2; chain(A.cutoff);
  }
  if (needs.has("hpf")) {
    A.hpf = c.createBiquadFilter(); A.hpf.type = "highpass";
    A.hpf.Q.value = 1.6; chain(A.hpf);
  }
  if (needs.has("level")) { A.level = c.createGain(); chain(A.level); }
  // ONE LEDGER OF LFOs FOR THE WHOLE CHANNEL, parts included — retireChannel
  // stops everything in it, and an oscillator that outlives its channel is the
  // zombie ZERO-STATIC R1 is about. It is `const` and pushed to, never
  // reassigned: the section chain used to overwrite it, which with a desk under
  // it would have quietly orphaned every part's tremolo.
  const oscs = [];
  let stages = [];
  // ---- HOW A CHAIN OF CHIPS IS SPENT, section and part alike ----
  // fields.js states the law (`fxSendable`); this is the one place that acts on
  // it, so a box and a part can never disagree about what a chip means.
  // Returns { sends:[{key,amt,bus}], dry, rack } — `rack` non-null only when
  // the chain could not be said in sends, and `dry` is the trim that makes the
  // sum identical to the insert it replaces.
  const spend = (keys) => {
    const out = { sends: [], dry: 1, rack: null, stages: [] };
    if (!keys || !keys.length) return out;
    if (env.send && fxSendable(keys)) {
      const bus = env.send(keys[0]);
      if (bus) {
        const m = fxMix(keys[0]);
        out.sends.push({ key: keys[0], amt: m, bus });
        out.dry = 1 - m;
        out.stages = [FX[keys[0]].type || keys[0]];
        return out;
      }
    }
    // THE BUDGETED PRIVATE INSERT. A chain (ordering, which a parallel bank
    // cannot say), a `sweep` (serial by construction — no mix param), or a bus
    // that would not build. One rack, in the signal path, exactly as before.
    if (SP && SP.buildInsertNodes) {
      try {
        const ch = SP.buildInsertNodes(c, fxChain(keys), barSec());
        out.rack = ch; out.stages = ch.stages || [];
        oscs.push(...(ch.oscs || []));
      } catch (e) { /* an insert that will not build must not take the section with it */ }
    }
    return out;
  };
  // ---- THE PART SUB-BUSSES, one small desk channel each ----
  // "Not every track should go through the effects." Everything below this
  // point is the SECTION strip — pan, level, two sends — and until now every
  // voice in the box arrived at `input` and took all of it. A part bus is the
  // same strip, smaller, in front of that:
  //
  //   sources of one part -> pan -> level -> mute gate -> dry trim -> input
  //                                              |-> rev send  -> the section's verb
  //                                              |-> echo send -> the echo bus
  //                                              \-> fx send   -> the page's chorus/crunch/…
  //
  // So the section keeps its job (the treatment on the whole box) and gains a
  // desk under it. The rev/echo sends land on the SAME two returns the section
  // uses — a part chooses how much it goes, the section still chooses which
  // room — and every send taps POST the mute gate, because a muted part whose
  // reverb keeps ringing is not muted.
  //
  // WHERE THE FX SEND IS AUDIBLY DIFFERENT, and it is the one place in this
  // rebuild that is: a part's character send returns at the MASTER, not at this
  // channel's input, so the section's own strip does not treat it. The part's
  // own level and pan do (the tap is post-mute, which is post-both), but a
  // section-wide `pump` will not duck that part's chorus and a hard-left
  // section will not carry its wet across. That is the price of one chorus for
  // the page instead of one per part, and it is paid where it shows least.
  //
  // AND THEY ARE CHEAP NODES, NOT VOICES. A sub-bus is gains and a panner; the
  // synth pool is still keyed (dsp, voice) and still routed through per-channel
  // gates, and a part send reaches verbFor with the SECTION's verb name, so
  // neither the worklet nor the convolver budget moves.
  const parts = new Map();                    // part key -> the strip
  for (const p of (spec.parts || [])) {
    // THE PANNER IS THE INPUT. A strip used to open with a unity Gain purely to
    // give the part a stable address — a node a bus, for nothing, since a
    // StereoPanner sums its inputs perfectly well. With a private rack the
    // rack's own input gain takes the job instead (buildInsertNodes builds one
    // either way), so neither case pays for a second summing node.
    const ppan = c.createStereoPanner(); ppan.pan.value = p.pan;
    const pnodes = [ppan];
    let pn = ppan;
    const pchain = x => { pn.connect(x); pn = x; pnodes.push(x); };
    const px = spend(p.fx);
    let pin = ppan;
    if (px.rack) { px.rack.output.connect(ppan); pin = px.rack.input; pnodes.push(...(px.rack.nodes || [])); }
    // the part's STRIP EQ, at the very front for the section strip's reason:
    // everything on the strip — rack, pan, level, every send — hears the tone
    // block. Zero nodes when flat, the same law.
    let peq = null;
    if (p.eq) {
      peq = buildEq(c, EQ_BANDS, p.eq);
      peq.output.connect(pin); pin = peq.input; pnodes.push(...peq.nodes);
    }
    const plvl = c.createGain();
    // the part's level is three multiplicands, each meaning what it always
    // meant: the enum (lvl), the user's dB trim (fader), and the song's own
    // derived seating (tdb — derivedPartTone, the composed arc's balance)
    plvl.gain.value = +(p.lvl * Math.pow(10, ((p.fader || 0) + (p.tdb || 0)) / 20))
      .toFixed(4);
    pchain(plvl);
    const pmute = c.createGain(); pmute.gain.value = p.mute ? 0 : 1; pchain(pmute);
    if (px.dry !== 1) {
      const pdry = c.createGain(); pdry.gain.value = px.dry;
      pmute.connect(pdry); pdry.connect(input); pnodes.push(pdry);
    } else pmute.connect(input);
    const prs = c.createGain(); prs.gain.value = p.rev;
    pmute.connect(prs); prs.connect(env.verb(spec.verb));
    const pds = c.createGain(); pds.gain.value = p.del;
    pmute.connect(pds); pds.connect(env.echoIn);
    pnodes.push(prs, pds);
    const pfs = [];
    for (const s of px.sends) {
      const g = c.createGain(); g.gain.value = s.amt;
      pmute.connect(g); g.connect(s.bus.input);
      pnodes.push(g); pfs.push({ key: s.key, gain: g });
    }
    nodes.push(...pnodes);
    parts.set(p.key, { in: pin, pan: ppan, lvl: plvl, gate: pmute, rs: prs, ds: pds,
                       fs: pfs, rack: !!px.rack, stages: px.stages, spec: p,
                       eq: peq ? peq.by : null });
  }
  // WHERE A SOURCE LANDS: its part's bus if that part has one, the section
  // input if it does not. Every player, route and fallback on the page asks
  // through one of these three, so there is exactly one answer to "which
  // strip is this note on" and no caller has to know whether a bus exists.
  const partIn = k => { const P = k != null && parts.get(k); return P ? P.in : input; };
  // BAKED AT BUILD TIME: the tempo-synced inserts (the echo's timeBars, a
  // sweep's rateBars) resolve against the bpm as it is NOW, and a later tempo
  // drag does not re-time them until the chain rebuilds. Same contract the big
  // engine states for its own insert chains — a perceptual-twin class of
  // difference, and re-instantiating every effect on a slider drag is worse.
  const sx = spend(spec.fx);
  if (sx.rack) {
    node.connect(sx.rack.input); node = sx.rack.output;
    nodes.push(...(sx.rack.nodes || []));
  }
  stages = sx.stages;
  const pan = c.createStereoPanner(); pan.pan.value = spec.pan; chain(pan);
  const lvl = c.createGain(); lvl.gain.value = spec.lvl; chain(lvl);
  // THE DRY TRIM is what makes a send arithmetically identical to the insert it
  // replaces: the bus runs at mix 1, this carries (1-mix), and the sum at the
  // master is the crossfade buildInsertNodes used to do in the signal path.
  // Absent when nothing is sent, so a box with no effects builds the graph it
  // always built, node for node.
  let dryTrim = null;
  if (sx.dry !== 1) {
    dryTrim = c.createGain(); dryTrim.gain.value = sx.dry;
    lvl.connect(dryTrim); dryTrim.connect(env.master); nodes.push(dryTrim);
  } else lvl.connect(env.master);
  const rs = c.createGain(); rs.gain.value = spec.rev; lvl.connect(rs);
  rs.connect(env.verb(spec.verb));
  const ds = c.createGain(); ds.gain.value = spec.del; lvl.connect(ds); ds.connect(env.echoIn);
  nodes.push(rs, ds);
  // ...and the character sends, tapping the same place rev and echo tap: POST
  // pan and level, so a hard-left hushed section is hard-left and hushed on the
  // chorus bus too. What the reverb does NOT hear is the bus's wet — an insert
  // chorus went into the reverb send, a chorus BUS returns beside it. A
  // chorused pad's reverb is now a reverb on the pad rather than on the chorus.
  const fs = [];
  for (const s of sx.sends) {
    const g = c.createGain(); g.gain.value = s.amt;
    lvl.connect(g); g.connect(s.bus.input);
    nodes.push(g); fs.push({ key: s.key, gain: g });
  }
  // ---- THE KIT: one desk for the page, one gate per section ----
  // graph.js buildKitDesk owns the twelve lane strips, the transient-preserving
  // drum bus (the parent's STRIP_PROFILES.drum) and the per-lane room sends,
  // because every one of those numbers is the same in every section — there is
  // no per-section drum-lane control in the vocabulary at all. What is left per
  // channel is the routing: a gate onto THIS section's drums strip, and a trim
  // on the room. `env.kit` is the page's desk; without one (an offline probe
  // that builds a single channel and nothing else) the channel makes its own,
  // which is exactly the graph this file built before the desk was hoisted.
  const desk = env.kit ? env.kit() : buildKitDesk(c, env.room);
  const ownDesk = !env.kit;
  // OPEN WHEN THE DESK IS PRIVATE, SHUT WHEN IT IS SHARED. A private desk has
  // exactly one channel and nothing to focus; a shared one is heard through
  // whichever gate focusKit has opened, the same law voices.js keeps for the
  // shared synth pool ("the pool stays global and the ROUTE moves instead").
  const kitGate = c.createGain(); kitGate.gain.value = ownDesk ? 1 : 0;
  desk.out.connect(kitGate); kitGate.connect(partIn("drums"));
  nodes.push(kitGate);
  // ---- the drum ROOM trim, per channel ----
  // The room hangs off the LANES rather than off the kit's output, so the ratio
  // between a dry kick and a wet snare survives — that ratio IS the room — and
  // it deliberately does not pass through the section's level/pan/inserts: the
  // room is a property of the kit, not of the mix move being made on the box.
  //
  // …WHICH IS WHY THE DRUMS PART'S FADER REACHES IT HERE. Nothing upstream of
  // this point knows about the box, so a `drums` mute would otherwise leave the
  // ambience ringing under a silent kit. The part's level and mute fold into
  // this one trim: pull the drums down and their room comes down with them.
  let droom = null, roomGate = null;
  if (desk.roomSum && env.room) {
    const dP = parts.get("drums");
    const dTrim = dP ? (dP.spec.mute ? 0
      : dP.spec.lvl * Math.pow(10, ((dP.spec.fader || 0) + (dP.spec.tdb || 0)) / 20)) : 1;
    roomGate = c.createGain(); roomGate.gain.value = ownDesk ? 1 : 0;
    droom = c.createGain(); droom.gain.value = DRUMBUS.room * dTrim;
    desk.roomSum.connect(roomGate); roomGate.connect(droom); droom.connect(env.room);
    nodes.push(roomGate, droom);
  }
  // WHICH LANES THIS SECTION ACTUALLY PLAYED. The strips are the page's, so
  // attribution is bookkeeping rather than nodes — but __nuMix still answers
  // "which of the twelve lanes did this section play", and it still answers it
  // off the real strip's real AudioParams.
  const lanes = desk.lanes;
  const played = new Set();
  // `kit` rides through to the desk (machine lanes have strips of their own —
  // graph.js laneIn); `played` records the RESOLVED strip key, so the __nuMix
  // drums report walks sampled and machine strips with one filter
  const laneIn = (d, kit) => {
    played.add(desk.laneKey ? desk.laneKey(kit, d) : d);
    return desk.laneIn(d, kit);
  };
  // ---- the VOICE BUSES: one placement per pitched voice ----
  // The parent's mastering stage places voices at the UNIT level (MASTER_PAN:
  // lead a touch right, pad counterweighting left, solos alternating) because a
  // stack of voices arriving at exactly one point is a mono mix however good
  // each voice sounds. nukernel mixes per SECTION, so the placement lives here,
  // one small bus per voice: [carve] -> pan -> the channel's own chain.
  //
  // Each voice also gets its OWN SamplerLive player, whose dry/rev/del all tap
  // that bus — same law as the single player it replaces (every tap lands on
  // one place and the section's sends decide the rest), just per chair. A
  // player is a closure over three destinations; the expensive nodes are still
  // per note.
  const roster = spec.roster || [];
  // SAME-TIMBRE COLLISION, decided from the ROSTER and not from who happens to
  // play first. Two chairs on one instrument read as one thick chair; the
  // parent dips the mud band on every voice in the collision but the first, and
  // "the first" has to mean the first CHAIR — deciding it lazily, at the first
  // note, would hand the exemption to whichever voice the scheduler reached
  // first, which is a fact about the phrase rather than about the band.
  //
  // The parent's other half — a 300 Hz high-pass on the accompaniment — is NOT
  // ported: it knows a voice's role and register and this mixer does not, so
  // high-passing what might be the LOW voice (vaporwave's second `strings`
  // averages MIDI 42, whose fundamental is 185 Hz) would delete the part rather
  // than separate it. The dip is register-safe; the placement below does the rest.
  const carved = new Set();
  {
    const seen = new Set(), dup = new Set();
    for (const r of roster) { if (seen.has(r.id)) dup.add(r.id); seen.add(r.id); }
    const first = new Set();
    for (const r of roster) {
      if (!dup.has(r.id)) continue;
      if (first.has(r.id)) carved.add(r.v); else first.add(r.id);
    }
  }
  // how wide the band sits: two voices stay close to centre, eight spread to
  // the edges of the parent's own placement range
  const spread = Math.min(0.34, 0.08 + 0.06 * roster.length);
  const voices = new Map();                   // voice index -> { in, pan, player, carve }
  const voiceBus = (v) => {
    let V = voices.get(v);
    if (V) return V;
    const r = roster.find(x => x.v === v) || { v, id: "", pad: false };
    // Chair 0 sits nearly centre and every chair after it takes a side,
    // alternating and widening — the parent's MASTER_PAN shape (melody +0.10,
    // pad counterweighting left, solos alternating ±0.14) generalised to
    // however many chairs the stack has.
    const step = Math.ceil((v + 1) / 2) - 1;
    const dir = v % 2 ? 1 : -1;
    let pan = dir * Math.min(spread, 0.12 + 0.08 * step);
    if (v === 0) pan = r.pad ? -0.08 : 0.04;
    // TWO NODES, AND ONLY WHEN THE SECOND IS EARNED. This used to open with a
    // unity Gain purely to give the chair a stable input, with the panner
    // behind it — a node per chair for nothing, since a StereoPanner is a
    // perfectly good summing input. The carve, when a same-timbre collision
    // asks for one, becomes the input instead.
    const p = c.createStereoPanner(); p.pan.value = pan;
    let carve = null, vin = p;
    if (carved.has(v)) {
      carve = c.createBiquadFilter(); carve.type = "peaking";
      carve.frequency.value = 450; carve.gain.value = -3.5; carve.Q.value = 0.9;
      carve.connect(p); vin = carve; nodes.push(carve);
    }
    // …and out onto its PART's strip. This is the pitched half of the desk:
    // the placement above is still the band's internal geometry, and the part
    // bus (if the chair asked for one) is where the send and the fader for THAT
    // chair live. No part, no bus, straight to `input`.
    p.connect(partIn(r.key));
    nodes.push(p);
    let pl = null;
    if (SP && SP.SamplerLive) {
      try { pl = SP.SamplerLive(c, { dry: vin, rev: vin, del: vin }); } catch (e) { pl = null; }
    }
    voices.set(v, V = { in: vin, pan: p, player: pl, carve: !!carve, id: r.id,
                        part: r.part || null, key: r.key || null });
    return V;
  };
  let player = null;
  if (SP && SP.SamplerLive) {
    // the CHANNEL-WIDE player, still here: the bass line has no chair in the
    // voice roster (it is one part per box, not one per genre voice) and neither
    // does anything that reaches the mixer without a voice index.
    try { player = SP.SamplerLive(c, { dry: input, rev: input, del: input }); }
    catch (e) { player = null; }
  }
  // …and one per PART bus, for the sources that have no chair: the bass line,
  // and anything else that reaches the mixer naming a part rather than a voice
  // index. Lazy because a SamplerLive is a closure over three destinations,
  // not nodes — the expensive things are still per note (see voiceBus) — so
  // there is nothing here worth building inside the render window's budget.
  const partPlayers = new Map();
  const partPlayer = (k) => {
    const P = k != null && parts.get(k);
    if (!P) return null;
    if (partPlayers.has(k)) return partPlayers.get(k);
    let pl = null;
    if (SP && SP.SamplerLive) {
      try { pl = SP.SamplerLive(c, { dry: P.in, rev: P.in, del: P.in }); } catch (e) { pl = null; }
    }
    partPlayers.set(k, pl);
    return pl;
  };
  // A VOICE INDEX -> ITS PART'S INPUT. The one thing outside this file that
  // knows about voice indices is the scheduler, and it should not also have to
  // know the roster's chair names.
  const voiceIn = (v) => {
    const r = roster.find(x => x.v === v);
    return partIn(r && r.key);
  };
  // A SYNTH NODE KEY -> ITS PART'S INPUT. The pool is keyed "dsp#voice" and
  // shared across every channel (voices.js: keying it per channel is what
  // multiplied the worklet budget), so the route's destination is the only
  // per-channel thing about it — and the dsp name is what separates a synth
  // bass, always written at voice 0, from whatever sits in chair 0.
  const synthIn = (nodeKey) => {
    const i = String(nodeKey).lastIndexOf("#");
    const dsp = i < 0 ? String(nodeKey) : String(nodeKey).slice(0, i);
    if (BASSDSP.has(dsp)) return partIn("bass");
    return voiceIn(i < 0 ? 0 : (+String(nodeKey).slice(i + 1) || 0));
  };
  // where each automatable param lives on THIS channel — armAutomation asks
  // by name, so the walk never needs to know which nodes were built
  const autoParam = name =>
    name === "cutoff" ? (A.cutoff && A.cutoff.frequency)
    : name === "hpf" ? (A.hpf && A.hpf.frequency)
    : name === "level" ? (A.level && A.level.gain)
    : name === "pan" ? pan.pan
    : name === "send.rev" ? rs.gain
    : name === "send.echo" ? ds.gain : null;
  const self = { key: null, input, drumIn: desk.dry, laneIn, lanes, played,
           voiceBus, voices, droom, kitGate, roomGate, desk, ownDesk,
           player, autos, autoParam, fs, dryTrim, rack: !!sx.rack,
           parts, partIn, voiceIn, synthIn, partPlayer,
           eq: secEq ? secEq.by : null,
           motKind: spec.mot, oscs, nodes, spec, stages, rs, ds, lvl };
  // the desk holds the gate ledger, so focusKit needs no second registry and a
  // retired channel's gates stop being written to (an open gate on a dead
  // channel is the zombie ZERO-STATIC R1 is about, one level up)
  if (!ownDesk) desk.gates.set(self, { kit: kitGate, room: roomGate });
  return self;
}
// THIS SECTION'S KIT, AND NOBODY ELSE'S — the exact shape voices.js focusSynths
// keeps for the shared synth pool, applied to the shared kit desk. Called at
// every section start (transport.js, and the offline walk in bounce.js), with a
// 4 ms ramp: long enough not to click, short enough that the first hit of the
// section is not clipped. Silent for a channel on a private desk, which has
// nothing to focus.
export function focusKit(chan, when) {
  if (!chan || chan.ownDesk || !chan.desk) return;
  // OPEN 20 ms EARLY. A setTargetAtTime ramp is still near zero AT the
  // timestamp it is given, and unlike a synth note — whose own envelope has an
  // attack — a kick's first sample IS the sound. Starting the ramp a hair
  // before the downbeat costs a 20 ms crossfade between two sections that are
  // never both being struck, and buys the transient back whole.
  // …on the CHANNEL'S OWN CLOCK. The offline bounce walks this same function
  // against an OfflineAudioContext whose currentTime has nothing to do with
  // the live one's, and clamping an offline bar time to the live clock would
  // open every gate at once, at the top of the render.
  const now = (chan.input && chan.input.context) ? chan.input.context.currentTime : 0;
  const t = Math.max(now, (when != null ? when : now) - 0.02);
  for (const [ch, g] of chan.desk.gates) {
    const open = ch === chan ? 1 : 0;
    try { if (g.kit) g.kit.gain.setTargetAtTime(open, t, 0.004); } catch (e) {}
    try { if (g.room) g.room.gain.setTargetAtTime(open, t, 0.004); } catch (e) {}
  }
}
export function channelFor(sec, retireAt) {
  const spec = chanSpec(sec);
  let id = boxId.get(sec);
  if (id == null) boxId.set(sec, id = ++chanSeq);
  // the key is UNIQUE PER BOX (the synth route gates and the prune both hang
  // off it) and carries the spec, so a changed chip is a changed key and the
  // channel rebuilds in place — ahead of the bar, because the tick prebuilds
  // the next section's channel outside the render window.
  // `retireAt` is WHEN the old channel may start dying: the transport passes
  // nextBarTime, the moment the first bar scheduled into the NEW channel
  // sounds. Fading the old one at ctx.currentTime instead cut everything
  // already scheduled through it — the rest of the sounding bar plus the
  // whole lookahead window died in a 30 ms fade on every live mix edit of
  // the playing section, an audible hole of up to a bar.
  const key = "#" + id + "|" + JSON.stringify(spec);
  const got = CHAN.get(sec);
  if (got && got.key === key) return got;
  if (got) { retireChannel(got, retireAt); dropRoute(got.key, retireAt); }
  const c = buildChannel(ctx, spec, { master: masterIn, verb: verbFor, echoIn: delBus,
                                      room: roomBus, send: sendFor, kit: kitFor });
  c.key = key;
  CHAN.set(sec, c);
  return c;
}
// WHAT THE MIXER ACTUALLY BUILT, for test/browser/nukernel-audio.test.js. The
// declared chain and the built chain are two different things — buildInsertNodes
// reports what it could not build in `skipped`, and an effect that silently
// passed dry is exactly the failure a screenshot cannot see.
// a strip's built EQ, read off the biquads themselves — null is FLAT, which is
// also the claim that no filter node exists at all (the zero-nodes law, visible)
const eqRead = by => (by ? Object.fromEntries(Object.entries(by)
  .map(([k, f]) => [k, +f.gain.value.toFixed(1)])) : null);
window.__nuMix = () => ({
  // THE MASTER BUS. This key used to be the bare boolean `!!masterIn` — "is
  // there a master at all" — and it still answers that question, because
  // masterReport() is null until initAudio builds the chain and an object
  // after. What it GAINED is content: the stages that were actually wired and
  // the AudioParam values they landed on, read off the nodes rather than off
  // the spec that asked for them. That is the desk's own law (see `stages` and
  // `level` on the channels below) applied one level up: a global that lit up
  // in the session bank and never reached a param is visible from outside.
  master: masterReport(),
  // THE RACK'S RETURNS, the same law one shelf down: what the reverb/echo/room
  // return gains actually sit at (graph.js busReport, read off the nodes) and
  // what the song asked for — an ADDED key, so every existing reader holds.
  buses: busReport(),
  verbs: Object.keys(VERBSPEC),
  // THE DRUM ROOM EXISTS, as a node rather than as an intention. Reported at
  // the top because it is one bus for the whole page (graph.js), and a channel
  // whose kit sends to nothing is the failure this key makes visible.
  room: !!roomBus,
  lanes: LANEIDS,
  // THE COST, in the two currencies that actually bite. A Faust worklet runs
  // every block whether or not it is sounding, so `worklets` is a CPU budget;
  // `convolvers` is the same story for the most expensive single node here.
  worklets: synthNodes.size,
  convolvers: REV ? Object.keys(REV).length : 0,
  routes: [...synthOut.values()].reduce((n, m) => n + m.size, 0),
  // THE NODE BUDGET, COUNTED — not asserted in a comment. Every number here is
  // a length of a real array of real nodes: the shared rack counts itself as it
  // builds (graph.js sharedReport) and each channel carries the list it will
  // one day disconnect. `over` is the whole point: the ceiling travels with the
  // count, so a gate — and a person reading the console — can see the mixer
  // approaching it rather than discovering it in the ears. See BUDGET above for
  // where the three numbers come from.
  nodes: (() => {
    const chans = [...CHAN.values()];
    const shared = sharedReport();
    const total = shared.total + chans.reduce((n, c) => n + c.nodes.length, 0);
    const nparts = chans.reduce((n, c) => n + c.parts.size, 0);
    const cap = BUDGET.shared + chans.length * BUDGET.chan + nparts * BUDGET.part;
    return { total, shared: shared.total, channels: chans.length, parts: nparts,
             per: chans.map(c => c.nodes.length), rack: shared, cap,
             over: total > cap, budget: BUDGET };
  })(),
  // WHICH CHARACTER BUSES THE PAGE HAS BUILT. One per effect, ever, however
  // many boxes and parts send to it — the claim this whole round rests on, so
  // it is readable from outside rather than argued in a comment.
  sends: SENDBUS ? Object.keys(SENDBUS).filter(k => SENDBUS[k]) : [],
  // total ARMED automation entries across the built channels (mot compiles
  // into the same list, so a legacy transition counts as the automation it is)
  automation: [...CHAN.values()].reduce((n, c) => n + (c.autos ? c.autos.length : 0), 0),
  channels: [...CHAN.values()].map(c => ({
    fx: c.spec.fx, stages: c.stages, motion: c.motKind,
    rev: +c.rs.gain.value.toFixed(3), del: +c.ds.gain.value.toFixed(3),
    // the BUILT value, like rev/del beside it — reporting c.spec.lvl echoed
    // the declaration, and a buildChannel that left the gain at 1 kept every
    // gate green while the composed arc went flat
    level: +c.lvl.gain.value.toFixed(3), pan: c.spec.pan, verb: c.spec.verb,
    eq: eqRead(c.eq),                  // ADDED key: the section strip's tone
    key: c.key, auto: c.autos ? c.autos.length : 0,
    // ADDED KEYS, never a reshape: the drum lanes and the pitched chairs that
    // have actually SOUNDED on this channel, read off the nodes themselves.
    // A lane strip is built on its first hit, so this doubles as "which of the
    // twelve lanes did this section really play" — and every number below is
    // the AudioParam's value, not the table's, because a table that never
    // reached a node is exactly the failure the mixer keeps rediscovering.
    droom: c.droom ? +c.droom.gain.value.toFixed(3) : null,
    // the strips are the PAGE's now (graph.js buildKitDesk) and only the
    // attribution is per channel, so this walks the shared desk and keeps the
    // lanes this section actually struck. Every number is still the shared
    // strip's own AudioParam.
    drums: [...c.lanes.entries()].filter(([d]) => c.played.has(d)).map(([d, L]) => ({ lane: d,
      level: +L.gain.gain.value.toFixed(3), pan: +L.pan.pan.value.toFixed(3),
      room: L.room ? +L.room.gain.value.toFixed(3) : null })),
    // HOW THE SECTION'S EFFECTS WERE SPENT — `via: "send"` is a share of one
    // page-wide bus, `via: "insert"` is the budgeted private rack (a chain, or
    // a sweep). `dry` is the trim that keeps the two arithmetically the same.
    via: c.rack ? "insert" : (c.fs.length ? "send" : null),
    sends: c.fs.map(s => ({ key: s.key, amt: +s.gain.gain.value.toFixed(3) })),
    dry: c.dryTrim ? +c.dryTrim.gain.value.toFixed(3) : 1,
    // the kit gate: which section the one shared desk is currently heard
    // through. Null on a private desk (an offline probe of a single channel).
    kit: c.ownDesk ? null : +c.kitGate.gain.value.toFixed(3),
    voices: [...c.voices.entries()].map(([v, V]) => ({ v, id: V.id,
      pan: +V.pan.pan.value.toFixed(3), carve: V.carve, player: !!V.player,
      // which chair this voice is, so a reader can join a sounding voice to
      // the part strip it goes through
      part: V.part, key: V.key })),
    // THE DESK, read off the nodes. Every number is the AudioParam's value and
    // `stages` is what buildInsertNodes actually BUILT, for the same reason the
    // section's are: a part chip that lit up and passed the signal dry is the
    // failure this file keeps rediscovering, one level down. A strip appears
    // when the user mixed it OR when the song derived a seat for it
    // (derivedPartTone — `tdb` is the derived dB, an ADDED key, so a reader
    // can separate the song's seating from the user's trim in `level`).
    parts: [...c.parts.entries()].map(([key, P]) => ({ key,
      fx: P.spec.fx, stages: P.stages,
      via: P.rack ? "insert" : (P.fs.length ? "send" : null),
      sends: P.fs.map(s => ({ key: s.key, amt: +s.gain.gain.value.toFixed(3) })),
      rev: +P.rs.gain.value.toFixed(3), echo: +P.ds.gain.value.toFixed(3),
      level: +P.lvl.gain.value.toFixed(3), pan: +P.pan.pan.value.toFixed(3),
      eq: eqRead(P.eq), tdb: P.spec.tdb || 0,
      muted: P.gate.gain.value < 0.5 })),
  })),
});
// AUTOMATION IS ARMED WHEN ITS SECTION STARTS, and re-armed on every pass —
// which is what makes a transition a transition rather than a setting. One
// walker for everything: the legacy mot (compiled to points in chanSpec) and
// the box's own auto list take the same road — setValueAtTime on the first
// point, ramps to the rest, points in BEATS clipped to the section. Silent
// when the channel has nothing armed, so the scheduler calls it
// unconditionally. (The pump's re-duck is now a 0.15-beat ramp rather than
// the old instantaneous jump — the same gesture, without the step.)
// `fromSec` — HOW FAR INTO THE BOX THIS RENDER ALREADY IS. Zero (the live
// path, and every chunk that opens on a box) is the original behaviour to the
// byte. It is non-zero for exactly one caller: audio/bounce.js renders the tape
// in windows now, and a window that opens in the MIDDLE of a box still has to
// put that box's motion where the ear expects it. Arming from the box start
// would restart the sweep at the seam; skipping it would leave the param at its
// built default. So the passed-over points are collapsed into ONE
// setValueAtTime carrying the value the curve really holds at `fromSec` —
// INTERPOLATED, not the last point's value, or a ramp that straddles the seam
// would step. This lives here rather than in the caller because a second
// implementation of the same walk is how the carrier drifts out of tune with
// the graph (this file's law, and the bounce header's).
export function armAutomation(chan, when, durSec, spb, fromSec) {
  if (!chan || !chan.autos || !chan.autos.length) return;
  const from = fromSec > 0 ? fromSec : 0;
  for (const a of chan.autos) {
    const p = chan.autoParam && chan.autoParam(a.param);
    if (!p) continue;
    try {
      p.cancelScheduledValues(when);
      let started = false;
      // the value the curve holds at the seam, and the last point behind it
      let seam = null, prev = null;
      for (const [beat, val] of a.points) {
        const rel = Math.min(durSec, Math.max(0, beat * spb));
        // exponential ramps refuse zero and sign changes; the floor keeps the
        // curve request honest instead of throwing mid-bar
        const v = a.curve === "exp" ? Math.max(0.0001, val) : val;
        if (from && rel <= from) {
          // still behind the seam: remember it and keep walking
          if (prev && a.curve === "exp" && prev[0] < rel) seam = v; else seam = v;
          prev = [rel, v];
          continue;
        }
        if (from && !started) {
          // the first point AHEAD of the seam. Emit the interpolated value at
          // the seam first, so the ramp into this point starts from where the
          // curve actually was rather than from the previous point's value.
          if (prev) {
            const span = rel - prev[0];
            const frac = span > 0 ? (from - prev[0]) / span : 0;
            const at = a.curve === "exp"
              ? prev[1] * Math.pow(v / prev[1], frac)
              : prev[1] + (v - prev[1]) * frac;
            p.setValueAtTime(a.curve === "exp" ? Math.max(0.0001, at) : at, when);
          } else if (seam != null) p.setValueAtTime(seam, when);
          started = true;
          // …then the point itself, as a ramp over what is LEFT of the span
          if (a.curve === "exp") p.exponentialRampToValueAtTime(v, when + rel - from);
          else p.linearRampToValueAtTime(v, when + rel - from);
          continue;
        }
        const t = when + rel - from;
        if (!started) { p.setValueAtTime(v, t); started = true; }
        else if (a.curve === "exp") p.exponentialRampToValueAtTime(v, t);
        else p.linearRampToValueAtTime(v, t);
      }
      // every point is behind the seam: the curve is done, hold its last value
      if (from && !started && seam != null) p.setValueAtTime(seam, when);
    } catch (e) {}
  }
}
// RETIRE, DON'T CUT. pruneChannels runs while the transport runs, and a note
// still ringing through a retired channel — up to two seconds of hidden
// lookahead plus its own release plus the reverb send tail — used to be cut
// mid-sample. ZERO-STATIC Stage 1.1 is this exact case: fade the channel out
// (~30 ms), THEN, well clear of the ramp, stop the LFOs and disconnect. The
// map forgets the channel immediately, so nothing new routes into a dying one.
// `at` (audio-clock seconds, default now) is when the fade may START — a
// channel replaced mid-bar rings out until its successor's first bar lands.
// prune/dropChannels keep the immediate default: their channel's box is gone.
function retireChannel(c, at) {
  let wait = 0;
  try {
    const t = ctx.currentTime, t0 = Math.max(t, at || t);
    wait = (t0 - t) * 1000;
    c.lvl.gain.cancelScheduledValues(t0);
    c.lvl.gain.setTargetAtTime(0, t0, 0.01);
  } catch (e) {}
  // OFF THE DESK'S LEDGER IMMEDIATELY, whatever the fade does: focusKit walks
  // that map every section start, and writing a ramp onto a gate whose channel
  // is being torn down is the zombie ZERO-STATIC R1 warns about.
  try { if (c.desk && c.desk.gates) c.desk.gates.delete(c); } catch (e) {}
  setTimeout(() => {
    for (const o of c.oscs) { try { o.stop(); } catch (e) {} }
    for (const n of c.nodes) { try { n.disconnect(); } catch (e) {} }
    // `drumIn` is the SHARED kit desk's summing node and is deliberately NOT
    // disconnected here — it belongs to the page, not to this channel, and one
    // retiring section must not take the kit away from the rest of the song.
    // The channel's own end of that wire (kitGate) is in `nodes` above.
    try { c.input.disconnect(); } catch (e) {}
  }, wait + 700);
}
export function dropChannels() {
  for (const c of CHAN.values()) retireChannel(c);
  CHAN.clear();
  clearRoutes();
  pruneSynths();
}
// CHANNELS ARE CHEAP BUT NOT FREE — an insert chain is real nodes and a synth
// voice is a WASM instance. Keyed by the box, the question is simply "does
// this box still exist": a deleted box's channel retires (gracefully — the
// fade in retireChannel), and an A/B between two chips rebuilds one channel
// in place via channelFor rather than accumulating strays, so there is no
// count threshold any more.
export function pruneChannels() {
  if (!ctx) return;
  const live = new Set(SONG);
  for (const [box, c] of [...CHAN]) {
    if (live.has(box)) continue;
    retireChannel(c);
    CHAN.delete(box);
    dropRoute(c.key);
  }
}
// WHAT THE DESK SAYS, THE BAND DOES — the join, re-made on an edit.
//
// channelFor is lazy on purpose: a box's channel is re-derived when the
// transport next REACHES that box, and until then the map keeps the channel
// that box had on an earlier pass, holding the params it had THEN. The
// sounding box is fine — the tick re-derives it under the playhead — and
// every other cached channel is a ghost: a per-part mix that resolves
// perfectly in chanSpec, and nodes that never heard about it. That is
// invisible from the ear (a ghost is scheduled nothing) and plainly visible
// to anything that READS the graph, __nuMix and the desk surface included,
// which is exactly how a mix can be right in the model and wrong on the desk.
//
// So re-derive every cached channel whose box still exists. channelFor
// no-ops on the ones whose spec did not move, so an edit costs precisely the
// channels it changed; `at` is the ease law's clock passed straight through
// (the transport's next bar time), so a replaced channel still rings out
// until its successor's first bar sounds. Returns how many actually rebuilt,
// so the caller can skip the follow-up an unchanged graph does not need.
export function refreshChannels(at) {
  if (!ctx) return 0;
  const live = new Set(SONG);
  let n = 0;
  for (const box of [...CHAN.keys()]) {
    const c = CHAN.get(box);
    if (!c || !live.has(box)) continue;          // pruneChannels owns those
    if (channelFor(box, at).key !== c.key) n++;
  }
  return n;
}

// a new song is a new mix; a changed box may strand a chain
on("song", () => { if (ctx) dropChannels(); });
on("box", () => pruneChannels());
