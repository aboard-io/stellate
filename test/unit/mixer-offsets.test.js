// test/unit/mixer-offsets.test.js — THE MIX-OFFSET LAYER, gated at the model.
//
// The mixer page (ui/mixer.js) writes OFFSETS (ui/state.js MIXER, song key
// `mix`) that ride OVER the composed per-section mix; audio/desk.js applies
// them at the unit choke point. The laws:
//   (a) ABSENT IS TODAY — no offsets, byte-identical desk output; set-then-
//       clear returns to byte-identical.
//   (b) A fader offset multiplies the channel's lvl by its dB gain; other
//       channels do not move.
//   (c) mute CUTS (lvl 0); sends add and clamp to [0,1]; pan adds and clamps
//       to [-1,1]; an eq offset reaches the sampler strip.
//   (d) THE NO-REVERT LAW: one offset moves EVERY section's desk, because the
//       layer is the song's, not the box's.
//   (e) master offsets land on masterState over the resolved value — or over
//       the DSP's own defaults (tsat .18, mrev .07, rest 0) when the song's
//       master says nothing; master.fader trims every unit.
//   (f) song.js round-trips `mix`: clamps, drops unknowns, normalizes empty
//       to null.
//   (g) WRITE (reason "composer") keeps your offsets; a loaded file states
//       its own (absent = none).
// Pure node: no browser, no audio.
"use strict";
let pass = 0, fails = 0;
const ok = (b, msg) => { if (b) pass++; else { fails++; console.log("  ✗ " + msg); } };

(async () => {
  // the UMD data tier onto a stub window (the ui/deps.js shape), then the
  // ES-module tier — the same recipe nukernel.test.js uses
  globalThis.window = globalThis;
  globalThis.addEventListener = globalThis.addEventListener || (() => {});
  globalThis.document = globalThis.document ||
    { visibilityState: "visible", addEventListener: () => {} };
  globalThis.localStorage = globalThis.localStorage ||
    { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  window.NuKernel = require("../../nukernel/kernel.js");
  window.NuGenres = require("../../nukernel/genres.js");
  window.NuFields = require("../../nukernel/fields.js");
  window.NuSong = require("../../nukernel/song.js");
  window.NuInstruments = require("../../nukernel/instruments.js");
  window.NuCompose = require("../../nukernel/compose.js");
  window.PRESETS = require("../../nukernel/presets.js").PRESETS;
  window.__REGISTRY = require("../../engine/registry-data.js");
  const MX = await import("../../nukernel/audio/desk.js");
  const ST = await import("../../nukernel/ui/state.js");
  const C = require("../../nukernel/compose.js");
  const NuSong = require("../../nukernel/song.js");

  // a composed record: real sections, real parts, a real master
  const raw = C.compose("acid", 5);
  ok(ST.adoptSong(JSON.parse(JSON.stringify(raw)), "file"),
     "the composed song did not load" + (ST.loadError ? " — " + ST.loadError.path : ""));
  const secs = ST.SONG.filter(b => (b.stack || []).some(e => e.slots && e.slots.length));
  ok(secs.length >= 2, "need two playing sections to prove the no-revert law (got " + secs.length + ")");
  // strip section/part character fx so the desk needs no live engine handle
  for (const s of ST.SONG) { s.fx = []; if (s.parts)
    for (const p of Object.values(s.parts)) delete p.fx; }

  // a synthetic unit table addressed at the roster, plus an unaddressed drum
  const deskOf = (sec, chanKeys) => {
    const units = { kick: { drum: true, lvl: 1 } }, addr = {};
    for (const k of chanKeys) {
      units["u_" + k] = { lvl: 1, sampler: { sr: 44100, strip: null } };
      addr["u_" + k] = k;
    }
    return MX.deskUnits(units, addr, sec, b => b, null);
  };
  const roster = MX.voiceRoster(secs[0]);
  const keys = MX.partKeysOf(secs[0], roster).filter(k => k !== "drums");
  const lead = keys[0];
  ok(!!lead, "no addressable part in the composed section");

  /* (a) ABSENT IS TODAY */
  ok(ST.MIXER === null, "a loaded file without `mix` did not normalize MIXER to null");
  const before = JSON.stringify(deskOf(secs[0], keys));
  ok(before === JSON.stringify(deskOf(secs[0], keys)),
     "(a) the desk is not deterministic without offsets");

  /* (b) the fader offset, on one channel only */
  ST.setMixOffset(lead, "fader", -6);
  const after = deskOf(secs[0], keys);
  const base = JSON.parse(before);
  const g = after["u_" + lead].lvl / base["u_" + lead].lvl;
  ok(Math.abs(g - Math.pow(10, -6 / 20)) < 1e-6,
     "(b) -6 dB moved lvl by ×" + g.toFixed(4) + ", want ×0.5012");
  for (const k of keys.slice(1))
    ok(after["u_" + k].lvl === base["u_" + k].lvl, "(b) untouched channel " + k + " moved");
  ok(after.kick.lvl === base.kick.lvl, "(b) the drums moved on a " + lead + " fader");

  /* (d) THE NO-REVERT LAW: the same offset lands in every section */
  const o2 = deskOf(secs[1], keys), b2raw = ST.MIXER; // offsets still armed
  ok(b2raw && b2raw[lead] && b2raw[lead].fader === -6, "(d) the offset store lost the value");
  ST.setMixOffset(lead, "fader", null);
  const b2 = deskOf(secs[1], keys);
  const g2 = o2["u_" + lead].lvl / b2["u_" + lead].lvl;
  ok(Math.abs(g2 - Math.pow(10, -6 / 20)) < 1e-6,
     "(d) section 2's desk did not carry the offset (×" + g2.toFixed(4) + ")");

  /* (a2) set-then-clear returns byte-identical */
  ok(ST.MIXER === null, "(a) clearing the one offset did not normalize MIXER to null");
  ok(JSON.stringify(deskOf(secs[0], keys)) === before,
     "(a) set-then-clear is not byte-identical");

  /* (c) mute cuts; sends add + clamp; pan clamps; eq reaches the strip */
  ST.setMixOffset(lead, "mute", true);
  ok(deskOf(secs[0], keys)["u_" + lead].lvl === 0, "(c) mute did not CUT");
  ST.setMixOffset(lead, "mute", null);
  ST.setMixOffset(lead, "rev", 1);
  ok(deskOf(secs[0], keys)["u_" + lead].rev === 1, "(c) +1 reverb did not clamp to 1");
  ST.setMixOffset(lead, "rev", -1);
  ok(deskOf(secs[0], keys)["u_" + lead].rev === 0, "(c) -1 reverb did not clamp to 0");
  ST.setMixOffset(lead, "rev", null);
  ST.setMixOffset(lead, "pan", 2);   // the surface clamps to ±1; the desk must too
  ok(Math.abs(deskOf(secs[0], keys)["u_" + lead].pan) <= 1, "(c) pan escaped [-1,1]");
  ST.setMixOffset(lead, "pan", null);
  ST.setMixOffset(lead, "eq", { hi: 6 });
  const eqd = deskOf(secs[0], keys)["u_" + lead].sampler.strip;
  ok(!!eqd && JSON.stringify(eqd) !== JSON.stringify(base["u_" + lead].sampler.strip),
     "(c) a +6 dB high band never reached the sampler strip");
  ST.setMixOffset(lead, "eq", null);
  ok(ST.MIXER === null, "(c) the emptied channel did not normalize away");

  /* (e) the master channel */
  ok(MX.masterState(null) === null, "(e) masterState(null) with no offsets is not null");
  ST.setMixOffset("master", "drive", 0.2);
  let ms = MX.masterState(null);
  ok(ms && Math.abs(ms.grit - 0.2) < 1e-9, "(e) drive offset did not land on grit over 0");
  ST.setMixOffset("master", "tape", 0.2);
  ms = MX.masterState(null);
  ok(Math.abs(ms.wob - 0.1) < 1e-9 && Math.abs(ms.tsat - 0.28) < 1e-9,
     "(e) tape offset did not ride the DSP defaults (wob " + ms.wob + ", tsat " + ms.tsat + ")");
  ST.setMixOffset("master", "space", 0.2);
  ms = MX.masterState(null);
  ok(Math.abs(ms.mrev - 0.17) < 1e-9, "(e) space offset did not ride mrev's 0.07 default");
  // over a resolved song master, the offset ADDS
  const withM = MX.masterState({ drive: "warm" });
  const baseGrit = window.NuFields.DRIVES ? window.NuFields.DRIVES.warm : null;
  if (baseGrit != null && withM)
    ok(Math.abs(withM.grit - Math.min(1, baseGrit + 0.2)) < 1e-9,
       "(e) drive offset did not add onto the resolved master (got " + withM.grit + ")");
  ST.setMixOffset("master", "drive", null);
  ST.setMixOffset("master", "tape", null);
  ST.setMixOffset("master", "space", null);
  ST.setMixOffset("master", "fader", -6);
  const mf = deskOf(secs[0], keys);
  ok(Math.abs(mf["u_" + lead].lvl / base["u_" + lead].lvl - Math.pow(10, -6 / 20)) < 1e-6
     && Math.abs(mf.kick.lvl / base.kick.lvl - Math.pow(10, -6 / 20)) < 1e-6,
     "(e) master fader is not one trim over every voice");
  ST.setMixOffset("master", "fader", null);
  // ...and the master's rev/del: the whole record's wet, an offset on every
  // unit's send at once (the one true global reverb/echo since the WebAudio
  // bus rack went out with the one-engine round)
  ST.setMixOffset("master", "rev", 0.3);
  const mw = deskOf(secs[0], keys);
  ok(mw["u_" + lead].rev >= base["u_" + lead].rev + 0.29 - 1e-9
     && mw.kick.rev >= base.kick.rev + 0.29 - 1e-9,
     "(e) master rev is not the whole record's wet");
  ST.setMixOffset("master", "rev", null);
  ok(ST.MIXER === null, "(e) the emptied master did not normalize away");

  /* (f) song.js round-trips and disciplines `mix` */
  const raw2 = JSON.parse(JSON.stringify(raw));
  raw2.mix = { [lead]: { fader: -6.234, pan: 3, junk: 9, eq: { hi: 40, nope: 1 } },
               ghost: {}, master: { drive: 0.5, glue: "x" } };
  const res = NuSong.load(raw2);
  ok(res.ok, "(f) a song carrying mix offsets failed to load");
  const m = res.ok && res.song.mix;
  ok(m && m[lead] && m[lead].fader === -6.23, "(f) fader not clamped/rounded: " + (m && m[lead] && m[lead].fader));
  ok(m && m[lead].pan === 1, "(f) pan 3 did not clamp to 1");
  ok(m && m[lead].junk === undefined, "(f) an unknown field survived");
  ok(m && m[lead].eq && m[lead].eq.hi === 12 && m[lead].eq.nope === undefined,
     "(f) eq bands not clamped/filtered");
  ok(m && m.ghost === undefined, "(f) an empty channel survived");
  ok(m && m.master && m.master.drive === 0.5 && m.master.glue === undefined,
     "(f) master offsets not disciplined");
  const raw3 = JSON.parse(JSON.stringify(raw));
  raw3.mix = { ghost: {} };
  const res3 = NuSong.load(raw3);
  ok(res3.ok && res3.song.mix === null, "(f) an emptied mix did not normalize to null");

  /* (g) WRITE keeps your hands on the board; a file states its own */
  ST.setMixOffset(lead, "fader", -3);
  ok(ST.adoptSong(C.compose("acid", 7), "composer"), "(g) recompose failed to load");
  ok(ST.MIXER && ST.MIXER[lead] && ST.MIXER[lead].fader === -3,
     "(g) WRITE dropped the board's offsets");
  ok(ST.adoptSong(JSON.parse(JSON.stringify(raw)), "file"), "(g) file load failed");
  ok(ST.MIXER === null, "(g) a file without `mix` did not clear the board");

  console.log(fails ? "\nmixer-offsets: FAIL — " + fails + " of " + (pass + fails)
    : "mixer-offsets: PASS — " + pass + " checks (offset layer: absent-is-today, "
      + "one hand over every section, clamps, master, round-trip, WRITE keeps your trims)");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error("mixer-offsets: CRASH — " + (e && e.stack || e)); process.exit(1); });
