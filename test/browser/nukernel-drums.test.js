#!/usr/bin/env node
// test/browser/nukernel-drums.test.js — THE KIT, THE ROOM AND THE REGISTER.
//
//   node test/browser/nukernel-drums.test.js
//
// nukernel-audio.test.js asks whether the page makes a sound out of real
// instruments. This one asks what happens to the sound after that, in the three
// places the mix was measurably wrong:
//
//   (A) THE KIT ARRIVES FROM ONE POINT. Twelve lanes were played at one level,
//       dead centre, into one dry bus, so a tom fill was a mono thump beside
//       the snare. Now every lane has a strip — instruments.js DRUMMIX — and a
//       strip is nodes, so it can be read back off the graph rather than
//       believed.
//   (B) THE DRUMS ARE DRY. There was no ambience anywhere on the page except
//       the section's own reverb chip, which is a musical choice about the
//       whole box, not the room a kit was recorded in. audio/graph.js
//       buildRoomBus is that room; ?dryroom builds the page without it, which
//       is what makes this measurable instead of arguable.
//   (D) EVERY VOICE GOES THROUGH THE SAME EFFECTS. fx/rev/echo/lvl/pan lived on
//       the BOX, so one insert chain treated the whole section: crunch on the
//       guitar was crunch on the pad, the bass and the kit. A box now carries
//       `parts` — a strip per chair (audio/mixer.js partSpecs/buildChannel) —
//       and the claim to check is precisely the one a level meter cannot make:
//       a treatment on ONE part bends that part's spectrum and leaves another
//       part's ALONE. Measured offline, with the parts soloed apart.
//   (C) A NOTE OUTSIDE ITS INSTRUMENT'S RANGE PLAYS AS A STRETCHED SAMPLE.
//       Measured on the shipped registry before the fix: sludge asked its
//       overdrive guitar for MIDI 12 against a bottom zone root of 40 — a
//       guitar played two and a half octaves down — and ska asked its trumpet
//       for 98. Both played. The witness here is the artifact and nothing else:
//       every AudioBufferSourceNode's playbackRate is captured at start(), and
//       a rate is exactly how far from its own root a zone is being stretched.
//   (G) VELOCITY IS A FADER. "There is no organic difference in the sound of
//       the notes… extremely synthesized and robotic." The event tier writes
//       real dynamics now and the audio tier threw them at a gain, so the same
//       note hard and soft was one timbre at two levels. The claim a level
//       meter cannot make: at velocity 2 and velocity 9 the SPECTRAL SHAPE
//       differs, and it differs because of the treatment rather than because of
//       the level — proved against the same instrument in the one role that
//       deliberately has no dynamic response.
//   (M) THE MACHINES ARE KITS. tr808/tr909/tr606/cr78 are DRUMKITS entries with
//       no recordings to fetch: they are voiced by the parent engine's own drum
//       modules, one row per box in audio/to-engine.js MACHINE_KIT, read by the
//       page and the tape alike. The score-level claims (genre→kit,
//       lane coverage, byte-deterministic synthesis, the schedule not moving
//       a millisecond under a kit swap) live in test/unit/nukernel.test.js
//       §44 — pure node. Here, only what WebAudio can witness: every machine
//       voice renders non-silent and unclipped through the real chain, on its
//       own MACHINEMIX strip row, and two cold bounce renders of a machine
//       song are the identical take.
//   (H) THE SINGER IS IN TUNE. nukernel/sing.js plans a syllable onto a note
//       and nukernel/audio/sing.js has to actually land it there — synthesize
//       the line, MEASURE the median F0 of the slice that came back
//       (engine/faust/voices/found-player.js f0Profile, the deterministic
//       clip-snap) and bend playbackRate so the heard pitch is the note. The
//       claim a level meter cannot make, and the one an intent check cannot
//       make either: render one sung note offline and detect the pitch of the
//       ARTIFACT. Plus the two-voice claim (the harmony is above the tune by
//       the interval the chart chose), the byte-determinism of one seed, and
//       the per-note node cost, counted rather than promised.
//
// WHY A SECOND FILE. nukernel-audio.test.js sweeps 45 genres and takes the
// better part of ten minutes; these three claims need three page loads of two
// composed songs and nothing else. Splitting them keeps this one runnable
// while working on the mixer, which is the only way a gate gets run at all.
//
// WHERE THE HARD READINGS ARE. Two of the four measurements here are taken
// OFFLINE, on an OfflineAudioContext built by the page's own builders — the
// room's impulse response, and one real snare rendered with and without the
// room. That is not a shortcut around "test the artifact": those renders use
// buildRoomBus, buildChannel and playDrum, the same three functions the live
// page and the background bounce use, and they are the only way to get a
// reading that does not move. The live wet-against-dry A/B is taken too and
// PRINTED, with its four measured values in the comment beside it, because it
// swings from 0.927 to 0.984 depending on the genre and where the window lands
// against the loop — evidence, not a bar.
"use strict";
const { serve, launchChromium, capturePageErrors } = require("../lib/probe-harness.js");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
let PORT = 8973;
// The genre under the microscope. Rock is the right subject for a drum gate: a
// power kit playing the widest set of lanes on the page (kick/snare/hat, plus
// the tom fill and the crash the twelve-lane kit added), and a section reverb
// of only 0.1 — so what is being measured wet-against-dry is the DRUM room and
// not the genre's own wash.
const GENRE = "rock";
// ...and the genre that proves the register home, in a second short pass.
// Sludge writes its overdrive guitar at MIDI 12..25 against a bottom zone root
// of 40: the most stretched line in the catalogue, and the one the home exists
// for. Measured statically over all 45 genres, ten chairs move and this is the
// furthest (three octaves).
const HOME_GENRE = "sludge";
const SPEC_SEC = 8;                        // spectrum averaging window per pass

const I = require("../../nukernel/instruments.js");
const REGISTRY = require("../../engine/registry-data.js");

const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
let checks = 0; const ok = (m) => { checks++; console.log("  ok:", m); };

// Taps installed before any page script: the analyser on the destination (the
// audio gate's own shape) plus a playbackRate capture on every buffer source.
function taps() {
  window.__rates = [];                    // {rate} at start(), every buffer source
  const AC = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = function (...a) {
    const c = new AC(...a);
    const an = c.createAnalyser(); an.fftSize = 2048;
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest === c.destination) { try { orig.call(this, an); } catch (e) {} }
      return orig.call(this, dest, ...rest);
    };
    const cbs = c.createBufferSource.bind(c);
    c.createBufferSource = () => {
      const s = cbs();
      const st = s.start.bind(s);
      s.start = (...x) => {
        try { window.__rates.push(s.playbackRate.value); } catch (e) {}
        return st(...x);
      };
      return s;
    };
    window.__spec = () => {
      const n = an.frequencyBinCount, d = new Float32Array(n);
      an.getFloatFrequencyData(d);
      return Array.from(d.slice(0, 512), (db) => Math.pow(10, db / 20));
    };
    window.__rms = () => {
      const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
      let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length);
    };
    return c;
  };
}
// …and the OFFLINE spectrum, installed the same way. An AnalyserNode cannot tap
// an OfflineAudioContext — there is no "now" to read a bin at — so every offline
// probe here bands its own rendered PCM, and there are two of them ((D) and (F)).
// One copy, in the init script, because two twenty-line radix-2 FFTs in one file
// is how the two probes start measuring subtly different things. Same 512-band
// linear-magnitude shape `__spec` returns, so `corr` below applies to both.
function offlineFft() {
  const N = 16384;
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  window.__bands = (mono, from) => {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++)
      re[i] = (mono[from + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
    fft(re, im);
    const out = new Array(512).fill(0), per = (N / 2) / 512;
    for (let b = 0; b < 512; b++) {
      let s = 0;
      for (let i = 0; i < per; i++) s += Math.hypot(re[b * per + i], im[b * per + i]);
      out[b] = s / per;
    }
    return out;
  };
  // EVERY AudioNode THIS CONTEXT BUILDS, COUNTED. (F) asserts a per-note node
  // budget, and the only honest way to read one is to count the factory calls
  // on the context the note is actually built on. Opt-in per context so nothing
  // else on the page pays for it; the walk climbs the prototype chain because
  // create* lives on BaseAudioContext.prototype, two links up from an
  // OfflineAudioContext instance.
  window.__countNodes = (c) => {
    const seen = new Set(), n = { n: 0 };
    for (let p = Object.getPrototypeOf(c); p; p = Object.getPrototypeOf(p))
      for (const k of Object.getOwnPropertyNames(p))
        if (/^create/.test(k) && !seen.has(k) && typeof c[k] === "function") {
          seen.add(k);
          const f = c[k].bind(c);
          c[k] = (...a) => { n.n++; return f(...a); };
        }
    return n;
  };
}

// linear-magnitude spectral shape correlation — the nukernel-audio (E)
// discipline: two passes of the SAME sound correlate ~0.995, any real treatment
// bends the shape to ~0.94, so 0.98 sits between with margin on both sides
const corr = (a, b) => {
  const ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y;
  }
  return n / Math.sqrt(da * db);
};
// share of the energy above 120 Hz. The room bus high-passes at 220 and returns
// early reflections plus a short damped tail, so what it adds lands entirely
// above this line — which makes the direction of the change checkable, not just
// its size.
const above120 = (sp) => {
  const binHz = 44100 / 2 / 1024;
  let hi = 0, tot = 0;
  for (let i = 1; i < sp.length; i++) { const p = sp[i] * sp[i]; tot += p; if (i * binHz >= 120) hi += p; }
  return tot > 0 ? hi / tot : 0;
};

// THE KIT ITSELF, RENDERED TWICE — the strongest form of the room claim, and
// the one the live A/B cannot make. The SAME real snare, fired by the SAME
// playDrum through a channel built by the SAME buildChannel, into an offline
// context: once with a room in the env and once without. Nothing else differs
// and nothing is timing dependent, so the tail after the sample has finished
// IS the room. The per-lane placement is measured the same way, as sound — the
// hat is written right of centre and the low tom left, so if the panners are
// real the rendered channels say so.
//
// RUN ON THE WET PAGE, before the ?dryroom pass navigates: the query flag is
// read once at module scope, so on the dry page buildChannel refuses the room
// for both halves of the A/B and the difference measures 1.00x — which is what
// it did while this was being written, and it looked exactly like a broken room.
async function offlineKit(page) {
  return page.evaluate(async () => {
    const [gm, mx, vx, as] = await Promise.all([
      import("/nukernel/audio/graph.js"), import("/nukernel/audio/mixer.js"),
      import("/nukernel/audio/voices.js"), import("/nukernel/audio/assets.js")]);
    // whichever kit the song just decoded — its buffers are context-free
    // (graph.js's own note: an AudioBuffer belongs to no context), which is
    // what lets a live decode render offline
    const kitName = [...as.drumBufs.keys()].map(k => k.split("|")[0])[0];
    if (!kitName) return { err: "no decoded kit" };
    const SR = 44100, AT = 0.05;
    const render = async (withRoom, lane) => {
      const octx = new OfflineAudioContext(2, SR, SR);
      const master = gm.buildMasterChain(octx);
      const env = { master: master.input, verb: () => master.input, echoIn: master.input,
                    room: withRoom ? gm.buildRoomBus(octx, master.input) : null };
      const chan = mx.buildChannel(octx, { roster: [], fx: [], rev: 0, del: 0,
        verb: "room", lvl: 1, pan: 0, mot: null, auto: [] }, env);
      vx.playDrum(kitName, lane, AT, 1, 9, chan);
      const out = await octx.startRendering();
      const L = out.getChannelData(0), R = out.getChannelData(1);
      const e = (a, from, to) => { let s = 0;
        for (let i = Math.floor(from * SR); i < Math.floor(to * SR) && i < a.length; i++) s += a[i] * a[i];
        return s; };
      return { hit: e(L, AT, AT + 0.05) + e(R, AT, AT + 0.05),
               tail: e(L, AT + 0.25, AT + 0.6) + e(R, AT + 0.25, AT + 0.6),
               left: e(L, AT, AT + 0.6), right: e(R, AT, AT + 0.6) };
    };
    const wetS = await render(true, "s"), dryS = await render(false, "s");
    const hat = await render(true, "h"), tom = await render(true, "l");
    return { kitName, wetS, dryS, hat, tom };
  });
}
// ---- (D) THE DESK: one part treated, another untouched --------------------
// THE HARDEST HALF OF "not every track should go through the effects" is the
// second half. That an insert is audible somewhere is easy; that it is audible
// on the guitar and INAUDIBLE on the pad beside it is the whole feature, and
// nothing short of two spectra can say it.
//
// Four renders of the same chairs through the same buildChannel, on an offline
// context, differing only in the box's `parts` map:
//   1  A alone (soloed), untreated       3  B alone, untreated
//   2  A alone, crunch on A              4  B alone, crunch on A
// (1 vs 2) must move — that is the insert doing its job on A. (3 vs 4) must
// NOT — that is A's insert staying off B. Solo is what isolates them, so the
// same passes exercise the mute law rather than needing a fifth mechanism.
//
// OFFLINE, for the reason offlineKit above is offline: it is deterministic.
// No loop phase, no compressor riding a different bar, no headless audio clock.
// And it is not a shortcut around "test the artifact" — chanSpec, buildChannel,
// playSampled and playDrum are the four functions the live page and the
// background bounce both walk. What IS stubbed is the un-armed automation
// (spec.auto/mot come off): armAutomation writes those AudioParams at every
// section start on the live path, and an un-armed cutoff node would sit at the
// BiquadFilter default of 350 Hz and lowpass all four renders equally.
//
// The FFT is here rather than an AnalyserNode because an analyser cannot tap
// an OfflineAudioContext — there is no "now" to read a bin at. Same 512-band
// linear-magnitude shape the live A/B correlates, so the same bar applies.
async function partProbe(page) {
  return page.evaluate(async () => {
    const [gm, mx, vx, as, dp, stm] = await Promise.all([
      import("/nukernel/audio/graph.js"), import("/nukernel/audio/mixer.js"),
      import("/nukernel/audio/voices.js"), import("/nukernel/audio/assets.js"),
      import("/nukernel/ui/deps.js"), import("/nukernel/ui/state.js")]);
    const sec = stm.SONG.find(s => mx.voiceRoster(s).length >= 2);
    if (!sec) return { err: "no box in the composed song carries two pitched chairs" };
    const roster = mx.voiceRoster(sec);
    const keys = mx.partKeysOf(sec);
    const kit = [...as.drumBufs.keys()].map(k => k.split("|")[0])[0] || null;
    const SR = 44100, AT = 0.05;
    // the 512-band radix-2 FFT is the init script's (offlineFft) — one copy for
    // the two offline probes in this file, and the alternative to banding here
    // at all is shipping a megabyte of PCM back over CDP fourteen times
    const bands = window.__bands;
    // one render of the box's chairs, with a given `parts` map on the box.
    // `aux` picks WHICH WAY the part's effect is spent: the private insert rack
    // (the offline default, and what a chain or a sweep still gets) or the
    // page's shared send bus, which is what the live page now builds for a
    // single blend chip. Both are run, because the isolation claim has to hold
    // for the topology that actually ships — a bus every part can reach is
    // exactly the shape in which one part's crunch COULD leak onto another.
    const render = async (parts, aux) => {
      sec.parts = parts;
      const spec = { ...mx.chanSpec(sec), auto: [], mot: null };
      const octx = new OfflineAudioContext(2, SR, SR);
      const master = gm.buildMasterChain(octx);
      const buses = new Map();
      const env = { master: master.input, verb: () => master.input,
                    echoIn: master.input, room: null };
      if (aux) env.send = (k) => {
        if (!buses.has(k)) buses.set(k, gm.buildSendBus(octx, k, master.input, 2));
        return buses.get(k);
      };
      const chan = mx.buildChannel(octx, spec, env);
      let played = 0;
      // a note per chair, a fifth apart so the two spectra are distinguishable
      for (const r of roster)
        if (vx.playSampled(r.id, 55 + 7 * r.v, AT, 0.5, 9, 1, chan,
                           dp.stripFor(r.id, r.pad), r.v)) played++;
      if (vx.playSampled(dp.BASS_INSTR, 36, AT, 0.5, 9, 1.25, chan,
                         dp.STRIPS.bass, null, "bass")) played++;
      if (kit) vx.playDrum(kit, "s", AT, 1, 9, chan);
      const out = await octx.startRendering();
      const L = out.getChannelData(0), R = out.getChannelData(1);
      const mono = new Float32Array(L.length);
      let e = 0;
      for (let i = 0; i < L.length; i++) { mono[i] = (L[i] + R[i]) / 2; e += mono[i] * mono[i]; }
      return { spec: bands(mono, Math.floor((AT + 0.01) * SR)), energy: e, played,
               built: [...chan.parts.keys()], mono };
    };

    const A = roster[0].key, B = roster[1].key;
    const clean = await render({ [A]: { solo: true } });
    const treat = await render({ [A]: { solo: true, fx: ["crunch"] } });
    const bClean = await render({ [B]: { solo: true } });
    const bWhileA = await render({ [B]: { solo: true }, [A]: { fx: ["crunch"] } });
    const allMute = await render(Object.fromEntries(keys.map(k => [k, { mute: true }])));
    const none = await render(null);
    // ...and the same four questions again, with the effect spent as a SEND on
    // a bus both parts can reach. This is the topology the live page builds
    // now, and it is the one where a leak would be structural rather than a
    // typo: if B's signal ever reached the crunch bus, sAB would move.
    const sClean = await render({ [A]: { solo: true } }, true);
    const sTreat = await render({ [A]: { solo: true, fx: ["crunch"] } }, true);
    const sB = await render({ [B]: { solo: true } }, true);
    const sAB = await render({ [B]: { solo: true }, [A]: { fx: ["crunch"] } }, true);
    // the strongest form of "untouched": not a correlation, a sample count
    let maxd = 0, smaxd = 0;
    for (let i = 0; i < bClean.mono.length; i++)
      maxd = Math.max(maxd, Math.abs(bClean.mono[i] - bWhileA.mono[i]));
    for (let i = 0; i < sB.mono.length; i++)
      smaxd = Math.max(smaxd, Math.abs(sB.mono[i] - sAB.mono[i]));
    sec.parts = null;                          // leave the box as it was found
    // what the MODEL derives for each address on this (unmixed) box — the
    // reference the (D1) assertion holds the built strips against
    const derived = Object.fromEntries(keys.map(k => {
      const t = mx.derivedPartTone(sec, k, roster);
      return [k, { tdb: t.db, eq: !!t.eq }];
    }));
    const strip = o => ({ spec: o.spec, energy: o.energy, played: o.played, built: o.built });
    return { A, B, keys, kit, maxd, smaxd, derived,
             roster: roster.map(r => ({ v: r.v, part: r.part, key: r.key })),
             clean: strip(clean), treat: strip(treat), bClean: strip(bClean),
             bWhileA: strip(bWhileA), allMute: strip(allMute), none: strip(none),
             sClean: strip(sClean), sTreat: strip(sTreat), sB: strip(sB), sAB: strip(sAB) };
  });
}
// ---- (D6) THE STRIP EQ, AS SOUND AND AS NODES -----------------------------
// The unit gate (§37d) proves the registry, the resolvers and the loader; what
// only a render can prove is the two ends of the audio claim: a +12 dB low
// shelf on the BASS part actually changes the rendered bytes, and a flat spec
// — null, all-zero, either home — builds ZERO extra nodes and renders
// byte-identical to the pre-change graph. Same offline discipline as
// partProbe: the shipping chanSpec/buildChannel, one bass note (MIDI 36, whose
// fundamental sits square under the 120 Hz shelf), deterministic, and the node
// count is the channel's own ledger (chan.nodes — the list retireChannel will
// one day disconnect), not a model of it.
async function eqProbe(page) {
  return page.evaluate(async () => {
    const [gm, mx, vx, dp, stm] = await Promise.all([
      import("/nukernel/audio/graph.js"), import("/nukernel/audio/mixer.js"),
      import("/nukernel/audio/voices.js"), import("/nukernel/ui/deps.js"),
      import("/nukernel/ui/state.js")]);
    const sec = stm.SONG.find(s => mx.partKeysOf(s).includes("bass"));
    if (!sec) return { err: "no box in the composed song carries a bass address" };
    const SR = 44100, AT = 0.05;
    const render = async (eq, parts) => {
      const keep = { eq: sec.eq, parts: sec.parts };
      sec.eq = eq; sec.parts = parts;
      const spec = { ...mx.chanSpec(sec), auto: [], mot: null };
      sec.eq = keep.eq; sec.parts = keep.parts;     // leave the box as found
      const octx = new OfflineAudioContext(2, SR, SR);
      const master = gm.buildMasterChain(octx);
      const env = { master: master.input, verb: () => master.input,
                    echoIn: master.input, room: null };
      const chan = mx.buildChannel(octx, spec, env);
      const played = vx.playSampled(dp.BASS_INSTR, 36, AT, 0.6, 9, 1.25, chan,
                                    dp.STRIPS.bass, null, "bass") ? 1 : 0;
      const out = await octx.startRendering();
      const L = out.getChannelData(0), R = out.getChannelData(1);
      const mono = new Float32Array(L.length);
      let e = 0;
      for (let i = 0; i < L.length; i++) { mono[i] = (L[i] + R[i]) / 2; e += mono[i] * mono[i]; }
      return { mono, energy: e, played, nodes: chan.nodes.length,
               secEq: chan.eq ? Object.keys(chan.eq).length : 0,
               parts: [...chan.parts.keys()] };
    };
    const base = await render(null, null);
    if (!base.played) return { err: "the bass did not render" };
    // THE CONTROL: THE SAME SPEC, RENDERED TWICE. This asked for an exact zero
    // between base and flat, and an exact zero is a claim about the RENDERER
    // that this renderer does not make. Measured here, ten renders of one
    // unchanged spec back to back come back in two states 4.38e-5 apart —
    // some pairs identical to the byte, some not — so "flat changed the
    // render" was being reported whenever the flip happened to fall between
    // those two particular calls, which is why it read 8.95e-7 one run and
    // 3.39e-5 the next for the same code. The EQ was innocent both times: on a
    // run where the flip fell elsewhere, base-vs-flat measured exactly 0.
    //
    // So the noise floor is MEASURED rather than assumed, and flat must not
    // exceed it. The law loses nothing: an EQ that actually did something
    // lands four orders of magnitude above this (the +12 dB shelf below
    // measures 5.60e-1), and the node-count half of the claim — flat builds
    // ZERO filters — is still asserted exactly, node for node.
    const base2 = await render(null, null);
    // every flat spelling at once: an all-zero section eq AND an all-zero part
    // eq must be the base graph, node for node and byte for byte
    const flat = await render({ lo: 0, mid: 0, hi: 0 }, { bass: { eq: { lo: 0 } } });
    const lofted = await render(null, { bass: { eq: { lo: 12 } } });
    const secEq = await render({ hi: -12 }, null);
    let flatd = 0, bassd = 0, ctl = 0;
    for (let i = 0; i < base.mono.length; i++) {
      flatd = Math.max(flatd, Math.abs(base.mono[i] - flat.mono[i]));
      bassd = Math.max(bassd, Math.abs(base.mono[i] - lofted.mono[i]));
      ctl = Math.max(ctl, Math.abs(base.mono[i] - base2.mono[i]));
    }
    const strip = o => ({ energy: o.energy, nodes: o.nodes, secEq: o.secEq, parts: o.parts });
    return { flatd, bassd, ctl, base: strip(base), flat: strip(flat),
             lofted: strip(lofted), secEq: strip(secEq) };
  });
}
// ...AND THE LIVE CHANNEL BUILDS THE SAME DESK. The offline half proves the
// treatment; this proves the graph the ear is actually on carries it, because
// the two are the same builder only as long as nothing between the box and
// buildChannel drops the map on the floor. __nuMix reports the built nodes.
// PRESS A ROW WHERE THE ROW IS, not wherever its centre happens to be.
// A song section is one compact line of cells now (2026-08-15) and some of
// them are controls that stop the click — the phrase chips, and the + / pin /
// ✕ keys. Playwright presses an element's geometric CENTRE, so `.box` alone
// can land on a chip and select a phrase instead of looping the section. The
// GENRE cell is the row's name, is never a control at any width, and the
// dblclick bubbles to the row from there.
const rowOf = (page, n) => page.locator(".box").nth(n).locator(".bgenre");

async function partsLive(page, keys) {
  await page.evaluate((ks) => {
    return import("/nukernel/ui/state.js").then((stm) => {
      const set = { mute: true };
      for (const s of stm.SONG)
        s.parts = { [ks.a]: { fx: ["crunch"], lvl: "hush", rev: "wet" },
                    [ks.b]: set, drums: { pan: "l" } };
      stm.emit("box", {});
    });
  }, keys);
  await rowOf(page, 0).dblclick();                             // loops it AND starts it
  const t0 = Date.now();
  let m = null, peak = 0;
  while (Date.now() - t0 < 25000) {
    await page.waitForTimeout(250);
    m = await page.evaluate(() => (window.__nuMix ? window.__nuMix() : null));
    peak = Math.max(peak, await page.evaluate(() => window.__rms()));
    if (m && m.channels.some(c => c.parts && c.parts.length)) break;
  }
  await page.waitForTimeout(2500);
  peak = Math.max(peak, await page.evaluate(() => window.__rms()));
  const mix = await page.evaluate(() => window.__nuMix());
  await page.evaluate(() => import("/nukernel/ui/state.js").then((stm) => {
    for (const s of stm.SONG) s.parts = null;
    stm.emit("box", {});
  }));
  await page.click("#play");                                   // stop
  return { mix, peak };
}
// ---- (G) THE SECOND KIND OF DYNAMICS --------------------------------------
// "There is no organic difference in the sound of the notes… extremely
// synthesized and robotic" (the artist, 2026-08-15). The EVENT tier answered
// that first — kernel.js writes metrical stress, a phrase arch and a per-bar
// touch into velocity, and the unit gate proves the range and the shape are
// there. It did not fix the complaint, because downstream of it velocity still
// only moved LOUDNESS: a note played harder was the same note turned up, which
// is not what any struck, plucked or blown instrument does.
//
// THE PARENT'S ANSWER IS A VELOCITY LAYER and it cannot fire here.
// engine/faust/voices/sampler.js zoneFor(zones, midi, vel) picks a
// differently-RECORDED sample for a soft note; measured on the shipped
// registry, 123 samplers and 629 zones carry no vlo/vhi at all — one layer per
// instrument. So the difference is synthesized (instruments.js DYN, a per-note
// high shelf tilted by velocity plus a faster front edge), and the thing to
// prove is precisely the thing a level meter cannot see.
//
// THE CONTROL IS THE SAME INSTRUMENT WITH THE TREATMENT OFF, not a second
// sound. `pad` is one of the two families that deliberately has NO dynamic
// response, and `pad` is a fact about the ROLE — so the identical instrument,
// at the identical two velocities, with the identical level difference between
// them, can be rendered both ways. If the treated pair's shape correlation is
// far below the pad pair's, the difference is timbre and not level, and no
// argument about the master limiter or the compressor can be made to explain
// it: both pairs went through the same ones.
//
// OFFLINE, for the reason partProbe above is offline — it is deterministic, and
// it walks buildChannel/playSampled, the functions the live page and the
// background bounce both use.
async function velProbe(page) {
  return page.evaluate(async () => {
    const [gm, mx, vx, dp, stm] = await Promise.all([
      import("/nukernel/audio/graph.js"), import("/nukernel/audio/mixer.js"),
      import("/nukernel/audio/voices.js"), import("/nukernel/ui/deps.js"),
      import("/nukernel/ui/state.js")]);
    const sec = stm.SONG[0];
    const roster = mx.voiceRoster(sec);
    // a chair whose family HAS a response — a song written entirely for organs
    // and pads would otherwise fail this gate for doing the right thing
    const r = roster.find(x => dp.dynFor(x.id, x.pad)) || roster[0];
    if (!r || !dp.dynFor(r.id, r.pad)) return { err: "no chair in this song has a dynamic response" };
    const SR = 44100, AT = 0.05, bands = window.__bands;
    // ONE note, one chair, one velocity — everything else held still.
    // `pad` forces the role that has no response; `gainMul` is the pure LEVEL
    // knob, which is how the second control below is taken.
    const render = async (vel, pad, gainMul) => {
      const octx = new OfflineAudioContext(2, SR, SR);
      const count = window.__countNodes(octx);
      const master = gm.buildMasterChain(octx);
      const env = { master: master.input, verb: () => master.input,
                    echoIn: master.input, room: null };
      const chan = mx.buildChannel(octx, { ...mx.chanSpec(sec), auto: [], mot: null }, env);
      const before = count.n;
      const played = vx.playSampled(r.id, 60, AT, 0.6, vel, gainMul || 1, chan,
                                    dp.stripFor(r.id, pad), r.v);
      const perNote = count.n - before;
      const out = await octx.startRendering();
      const L = out.getChannelData(0), R = out.getChannelData(1);
      const mono = new Float32Array(L.length);
      let e = 0;
      for (let i = 0; i < L.length; i++) { mono[i] = (L[i] + R[i]) / 2; e += mono[i] * mono[i]; }
      return { spec: bands(mono, Math.floor((AT + 0.005) * SR)), perNote, played,
               rms: Math.sqrt(e / L.length) };
    };
    // the family name is for the console line only, and it is read off the
    // classic global instruments.js publishes rather than through deps — a
    // re-export added to the app so a gate can print a word is a reshape
    return { id: r.id, fam: window.NuInstruments.familyOf(r.id, r.pad),
             soft: await render(2, false), hard: await render(9, false),
             mid: await render(5, false), midAgain: await render(5, false),
             quiet: await render(9, false, 0.3),
             padSoft: await render(2, true), padHard: await render(9, true),
             padMid: await render(5, true),
             dyn: window.__nuDyn() };
  });
}
// ---- (M) THE MACHINES ------------------------------------------------------
// The classic drum machines are DRUMKITS entries with no directory under
// found/samples/drums/ — and as of the one-drum-system round they are not this
// page's own synthesis either. tr808/tr909/tr606/cr78 are voiced by the PARENT
// ENGINE's drum modules (audio/to-engine.js MACHINE_KIT names the models,
// drumVoice resolves the lane), which is the same table the pressed tape is cut
// from. EVERYTHING A SCORE CAN ANSWER LIVES IN THE UNIT GATE (§44: the genre→kit
// table, every lane resolving to a real module, the model names held against
// state-engine's own maps, the schedule not moving under a kit swap). What is
// left for a browser is what only WebAudio can witness:
//   - each machine lane SOUNDS through the real chain (playDrum → the kit desk
//     → the master), non-silent and unclipped, riding its own MACHINEMIX strip;
//   - two BOUNCE renders of the same machine song are identical — the carrier
//     a phone hears must be the take the desk heard, byte for byte.
//
// LIVE, not offline, and that is a change this round forced rather than chose:
// a Faust worklet cannot be built inside an OfflineAudioContext (it is
// scheduled and rendered in one synchronous pass — audio/voices.js says so at
// the stand-in pool), so the machines are heard on the live context through the
// analyser tap, one lane at a time, and the pressed tape is measured where it
// is actually made (the bounce, below).
async function machinesProbe(page) {
  return page.evaluate(async () => {
    const [gm, mx, vx, dp, te] = await Promise.all([
      import("/nukernel/audio/graph.js"), import("/nukernel/audio/mixer.js"),
      import("/nukernel/audio/voices.js"), import("/nukernel/ui/deps.js"),
      import("/nukernel/audio/to-engine.js")]);
    if (!gm.ctx) return { err: "no live AudioContext — a machine can only be heard on one" };
    const nap = (ms) => new Promise(r => setTimeout(r, ms));
    const lanes = Object.keys(dp.DRUMFILE);
    // the vocabulary and the routing table, held together: every DRUMKITS id
    // that is not a sampled directory must be a machine the table knows
    const machines = Object.keys(dp.DRUMKITS).filter(k => te.isMachine(k));
    const out = { machines, lanes, kits: {}, strip: null, modules: {}, ready: {} };
    const env = { master: gm.masterIn, verb: () => gm.masterIn, echoIn: gm.masterIn,
                  room: gm.buildRoomBus(gm.ctx, gm.masterIn) };
    const chan = mx.buildChannel(gm.ctx, { roster: [], fx: [], rev: 0, del: 0,
      verb: "room", lvl: 1, pan: 0, mot: null, auto: [] }, env);
    for (const kit of machines) {
      await vx.warmKit(kit);                       // build the worklets, not decode wavs
      out.ready[kit] = vx.kitReady(kit);
      out.modules[kit] = lanes.map(d => (te.drumVoice(kit, d) || {}).module || null);
      const row = {};
      for (const lane of lanes) {
        const played = vx.playDrum(kit, lane, gm.ctx.currentTime + 0.04, 1, 9, chan);
        let peak = 0;
        for (let i = 0; i < 7; i++) { await nap(30); peak = Math.max(peak, window.__rms()); }
        row[lane] = { played, peak: +peak.toFixed(5) };
        await nap(60);
      }
      out.kits[kit] = row;
    }
    // a machine lane earns its own strip carrying its own row — read off the
    // node, never the table (the (A) discipline)
    const Lm = chan.lanes.get("tr808|h");
    out.strip = { built: !!Lm, room: Lm && Lm.room ? +Lm.room.gain.value.toFixed(3) : null,
                  want: dp.mixFor("tr808", "h").room, base: dp.DRUMMIX.h.room };
    return out;
  });
}
// ...and the BOUNCE, twice. The tape is the audible path on a phone, so a
// machine kick that renders differently per take is a different song per
// pocket. Two COLD renders (the window cache dropped, so the second really
// re-renders) of the page's own song with box 0 borrowing the 909 — compared
// on __nuRenderNow's own fingerprint: 64 RMS windows at 7 decimals plus the
// peak, the same artifact the bounce gate trusts.
async function bounceTwice(page) {
  return page.evaluate(async () => {
    const [as, stm] = await Promise.all([
      import("/nukernel/audio/assets.js"), import("/nukernel/ui/state.js")]);
    await as.loadKit("tr909");
    const sec = stm.SONG[0];
    if (!sec) return { err: "no song on the page" };
    const was = Object.prototype.hasOwnProperty.call(sec, "drumkit") ? sec.drumkit : null;
    sec.drumkit = "tr909";
    try {
      const a = await window.__nuRenderNow(4, { cold: true });
      const b = await window.__nuRenderNow(4, { cold: true });
      if (!a || !b) return { err: "__nuRenderNow refused (a render already in flight?)" };
      return { durSec: a.durSec, rmsA: a.rms, rmsB: b.rms, peakA: a.peak, peakB: b.peak };
    } finally { sec.drumkit = was; }
  });
}

// ---- (H) THE SINGER --------------------------------------------------------
// "You did a lot of this in the upper level app, but we never really got to the
// point where it could sing or two voices could sing" (the artist, 2026-08-15).
//
// THE ARTIFACT IS THE ONLY WITNESS THAT COUNTS HERE. Every step of the chain
// has an honest-looking intermediate that can be right while the sound is
// wrong: the plan can name the correct note, the rung can be chosen correctly,
// the playbackRate can be computed correctly, and the syllable can still come
// out a fourth flat because the slice boundaries were off and the detector
// measured a consonant. So this probe renders ONE SUNG NOTE, alone, through
// the page's own buildChannel and playSyllable, into an OfflineAudioContext —
// and then runs the found layer's own F0 detector over the rendered PCM and
// asks what pitch actually came out.
//
// WHAT IT DELIBERATELY DOES NOT ASSERT: the pitch of a slice the detector
// could not measure in the first place. MEASURED over all 996 (bank line ×
// rung × voice) syllables, 5.9% return no F0 — they are 40-60 ms of mostly
// consonant — and audio/sing.js handles those by falling back to the rung's
// own measured ladder value. Asserting a detected pitch on a clip the detector
// has already said it cannot read would be asserting the detector's noise, so
// the probe reports its own reliability alongside the numbers.
async function singProbe(page) {
  return page.evaluate(async () => {
    const [gm, mx, sg, dp, stm, dv] = await Promise.all([
      import("/nukernel/audio/graph.js"), import("/nukernel/audio/mixer.js"),
      import("/nukernel/audio/sing.js"), import("/nukernel/ui/deps.js"),
      import("/nukernel/ui/state.js"), import("/nukernel/ui/derive.js")]);
    if (!dp.CS) return { err: "window.CsdSpeech is not on the page" };
    if (!dp.FP) return { err: "window.FoundPlayer is not on the page" };
    const SR = 44100, AT = 0.05;
    const midiOf = (hz) => 69 + 12 * Math.log2(hz / 440);

    // THE REAL PLAN, off the real derive path: set a box to `duet` and take
    // what ui/derive.js emits. A hand-built plan would prove the renderer and
    // nothing about the wiring.
    const pick = (chip) => {
      for (let i = 0; i < stm.SONG.length; i++) {
        const sec = JSON.parse(JSON.stringify(stm.SONG[i]));
        sec.sing = chip;
        const ev = dv.sectionEvents(sec, stm.SLOTS).ev.filter(e => e.kind === "sing");
        if (ev.length >= 4) return { sec, ev, i };
      }
      return null;
    };
    const duet = pick("duet");
    if (!duet) return { err: "no box in this song sings — nothing to measure" };
    const t0 = performance.now();
    // EVERY DISTINCT LINE, not just the first — the page's own warm path
    // (transport.js singWork -> sing.warm) groups the plan by text and warms
    // each. A multi-line box warmed for line one alone leaves every later
    // syllable sliceless, which reads as "half the plan never played" and is a
    // fact about the PROBE, not the page — and #compose rolls a random seed
    // per click, so whether this gate draws a one-line or a three-line box is
    // a coin toss per run.
    const byText = new Map();
    for (const e of duet.ev) {
      let w = byText.get(e.text);
      if (!w) byText.set(e.text, w = []);
      w.push(e);
    }
    let warmed = false;
    for (const [text, plan] of byText) warmed = (await sg.warm(plan, text)) || warmed;
    const warmMs = Math.round(performance.now() - t0);
    if (!warmed) return { err: "warm() produced no slices" };

    // one syllable, alone, rendered through the page's own channel builder
    const render = async (ev, colour, durSec) => {
      const octx = new OfflineAudioContext(2, Math.ceil((AT + durSec + 0.6) * SR), SR);
      const count = window.__countNodes(octx);
      const master = gm.buildMasterChain(octx);
      const env = { master: master.input, verb: () => master.input,
                    echoIn: master.input, room: null };
      // level/pan/sends neutral: a reverb tail would smear the F0 estimate
      const chan = mx.buildChannel(octx, { ...mx.chanSpec(duet.sec), fx: [], rev: null,
                                           echo: null, auto: [], mot: null }, env);
      const before = count.n;
      const played = sg.playSyllable(ev, ev.text, AT, durSec, chan, colour, 2);
      const perNote = count.n - before;
      const out = await octx.startRendering();
      const L = out.getChannelData(0), R = out.getChannelData(1);
      const mono = new Float32Array(L.length);
      let e = 0;
      for (let i = 0; i < L.length; i++) { mono[i] = (L[i] + R[i]) / 2; e += mono[i] * mono[i]; }
      // measure only the sounding span; the tail is master-chain ring-out
      const from = Math.floor(AT * SR), to = Math.min(mono.length, from + Math.ceil(durSec * SR));
      const prof = dp.FP.f0Profile(mono.slice(from, to), SR);
      return { played, perNote, rms: Math.sqrt(e / L.length), hz: prof.hz,
               voiced: prof.voiced, n: prof.n,
               midi: prof.hz > 0 ? midiOf(prof.hz) : null };
    };

    // (1) PITCH TRACKING: every planned lead syllable, sung and measured
    const DUR = 0.5;
    const rows = [];
    for (const ev of duet.ev) {
      const probe = window.__nuSingProbe(ev, ev.text);
      if (!probe) { rows.push({ vi: ev.vi, err: "no slice" }); continue; }
      const got = await render(ev, "natural", DUR);
      rows.push({ vi: ev.vi, si: ev.si, syl: ev.syl, want: probe.foldedMidi,
                  measurable: probe.measured, realBend: probe.realBend,
                  rate: probe.rate, natSec: probe.natSec,
                  got: got.midi, err: got.midi == null ? null : got.midi - probe.foldedMidi,
                  played: got.played, perNote: got.perNote, rms: got.rms,
                  voiced: got.voiced });
      if (rows.length >= 24) break;
    }

    // (2) TWO VOICES, on the SAME syllable index: the interval the chart chose
    const pairs = [];
    for (const a of duet.ev.filter(e => e.vi === 0)) {
      const b = duet.ev.find(e => e.vi === 1 && e.si === a.si);
      if (!b) continue;
      const ra = rows.find(r => r.vi === 0 && r.si === a.si);
      const rb = rows.find(r => r.vi === 1 && r.si === b.si);
      if (!ra || !rb || ra.got == null || rb.got == null) continue;
      // A PAIR IS ONLY EVIDENCE WHEN BOTH HALVES WERE READ. `read` means the
      // slice had a detectable F0 before the bend AND the render came back
      // within a semitone of its own target — i.e. the detector managed this
      // clip. It is the same rule the pitch check applies for the same reason:
      // an autocorrelation estimate on a 60 ms resampled syllable sometimes
      // locks an octave out, and asserting the harmony interval on top of that
      // reading is asserting the detector's noise. Unread pairs are PRINTED,
      // never silently dropped.
      const read = (r) => r.measurable && r.voiced > 0.3 && Math.abs(r.err) <= 1;
      pairs.push({ si: a.si, planned: b.n - a.n, wantHeard: rb.want - ra.want,
                   gotHeard: rb.got - ra.got, read: read(ra) && read(rb) });
      if (pairs.length >= 8) break;
    }

    // (3) THE VOCODER COLOUR: no bend at all, and a carrier an octave below
    // the note (robot_choir.dsp's own intelligibility law), so the detected
    // pitch should be the note or its octave-down and never something between.
    const vocRows = [];
    for (const ev of duet.ev.filter(e => e.vi === 0).slice(0, 4)) {
      const probe = window.__nuSingProbe(ev, ev.text);
      const got = await render(ev, "vocoder", DUR);
      if (probe && got.midi != null)
        vocRows.push({ want: probe.vocMidi, got: got.midi, rms: got.rms,
                       played: got.played, perNote: got.perNote });
    }

    // (4) DETERMINISM: the same note rendered twice is the same samples. The
    // espeak law is a fresh instance per utterance, and everything after it
    // (the cut, the F0, the bend, the stretch) is arithmetic — so this is the
    // end-to-end version of that claim, on the audio and not on the PCM.
    const d1 = await render(duet.ev[0], "natural", DUR);
    const d2 = await render(duet.ev[0], "natural", DUR);

    // (5) A HELD NOTE REALLY SUSTAINS. The stretch is the difference between
    // singing and a speech chip on a sequencer, and it is invisible to a pitch
    // check: measure the RMS of the LAST quarter of a long note against a
    // short one's — a blip that stopped would be silence there.
    let hold = null;
    {
      const ev = duet.ev.find(e => e.vi === 0);
      const long = await (async () => {
        const octx = new OfflineAudioContext(2, Math.ceil((AT + 1.2 + 0.6) * SR), SR);
        const master = gm.buildMasterChain(octx);
        const env = { master: master.input, verb: () => master.input,
                      echoIn: master.input, room: null };
        const chan = mx.buildChannel(octx, { ...mx.chanSpec(duet.sec), fx: [], rev: null,
                                             echo: null, auto: [], mot: null }, env);
        sg.playSyllable({ ...ev, hold: true }, ev.text, AT, 1.0, chan, "natural", 2);
        const out = await octx.startRendering();
        const d = out.getChannelData(0);
        const seg = (a, b) => { let e = 0, n = 0;
          for (let i = Math.floor(a * SR); i < Math.floor(b * SR) && i < d.length; i++) { e += d[i] * d[i]; n++; }
          return Math.sqrt(e / Math.max(1, n)); };
        return { head: seg(AT + 0.02, AT + 0.12), tail: seg(AT + 0.75, AT + 0.95) };
      })();
      hold = long;
    }

    return { box: duet.i, text: duet.ev[0].text, planned: duet.ev.length,
             warmMs, rows, pairs, vocRows, hold,
             same: d1.rms === d2.rms && d1.hz === d2.hz,
             stats: window.__nuSing() };
  });
}

// ...AND THE DESK HAS A SURFACE. Everything above proves the graph carries a
// per-part mix; this proves a PERSON can make one. It drives the mix table
// (ui/mixtbl.js) through the DOM — click a cell, click a chip — and then asks
// the AUDIO tier what it resolved, because a UI gate that stops at "the button
// changed colour" is the failure this project keeps rediscovering (the memory
// note is "test the artifact"). Cheap on purpose: no playback, no render, one
// already-loaded page — chanSpec() is the exact structure buildChannel builds
// from, so resolving it is the honest end of the chain.
async function deskUI(page) {
  // the table draws the SELECTED box; box 0 is where the page opens
  await page.evaluate(() => import("/nukernel/ui/state.js")
    .then((s) => { s.setViewSec(0); s.commit("selection"); }));
  await page.waitForTimeout(150);
  const rows = await page.locator(".mrow").count();
  const parts = await page.locator(".mrow:not(.msec)").count();
  const row = page.locator(".mrow:not(.msec)").first();
  // THE STRIP IS A FOLD NOW (lane A2, 2026-08-17: the board is tracks / buses
  // / main, and a channel is ONE bar until you tap it). Its value cells still
  // carry the same .mval[data-field] hooks and write the same fields; they are
  // simply behind the bar, so the gate opens the channel first — the same tap
  // a person makes. The SECTION strip is never folded, so the msec locators
  // below are untouched.
  await row.locator(".mbar.mstrip").click();
  await page.waitForTimeout(120);
  const partKey = await row.locator(".mval").first().getAttribute("data-part");
  // THE ROUTING ITSELF, READ OFF THE OPEN STRIP (lane J1, 2026-08-17: "get rid
  // of inserts… let me send to bus 1, bus 2, and bus 3 instead"). Every value
  // bar a strip draws carries its own data-field, so what a track's routing
  // IS is exactly the list of fields its own cells name — not a claim about
  // fields.js, a read of the DOM the field removal was supposed to change.
  const trackFields = await row.locator(".mval").evaluateAll(els =>
    els.map(e => e.dataset.field));
  const secFields = await page.locator(".mrow.msec .mval").evaluateAll(els =>
    els.map(e => e.dataset.field));
  // A SEND on ONE part: the reverb-send cell, then a chip. Per-track INSERTS
  // are off the desk (fields.js PARTMIX: a track's routing is three bus sends
  // and nothing else), so what a person can put on one part from this surface
  // is a send — and that is what this drives.
  await row.locator('.mval[data-field="rev"]').click();
  await page.locator(".mchip", { hasText: /^wet$/ }).click();
  // ...a level on the same part: a one-of-these cell closes on the choice
  await row.locator('.mval[data-field="lvl"]').click();
  await page.locator(".mchip", { hasText: /^hush$/ }).click();
  // ...and the two keys that are not cells
  await row.locator(".mk-solo").click();
  // the SECTION row writes the BOX's own field — the same one the palette's
  // effects tab has always written, which is what keeps a saved song whole
  await page.locator('.mrow.msec .mval[data-field="rev"]').click();
  await page.locator(".mchip", { hasText: /^drown$/ }).click();
  await page.waitForTimeout(150);
  const out = await page.evaluate(() => Promise.all([
    import("/nukernel/ui/state.js"), import("/nukernel/audio/mixer.js"),
  ]).then(([s, m]) => {
    const sec = s.SONG[0];
    return { stored: sec.parts, rev: sec.rev, spec: m.chanSpec(sec).parts,
             keys: m.partKeysOf(sec) };
  }));
  // the surface must agree with the store: one mix, two views of it. The
  // palette's fx tab is gone ("the row and the board"), so the second view is
  // the SECTION row's own rev cell — bright (.set) and reading "drown".
  const revCell = page.locator('.mrow.msec .mval[data-field="rev"]');
  out.paletteLit = String(/drown/.test((await revCell.textContent()) || "") &&
                          (await revCell.getAttribute("class")).includes("set"));
  // and clearing the part's level again must leave NO trace — absent is the
  // only spelling of a default, which is what makes the mixer's
  // absent-is-today law reachable from the surface
  await row.locator('.mval[data-field="lvl"]').click();
  await page.locator(".mchip.on", { hasText: /^hush$/ }).click();
  await row.locator('.mval[data-field="rev"]').click();
  await page.locator(".mchip.on", { hasText: /^wet$/ }).click();
  await row.locator(".mk-solo").click();
  await page.waitForTimeout(150);
  out.emptied = await page.evaluate(() => import("/nukernel/ui/state.js")
    .then((s) => s.SONG[0].parts));
  out.rows = rows; out.parts = parts; out.partKey = partKey;
  out.trackFields = trackFields; out.secFields = secFields;
  // ---- THE TONE KNOBS (the strip-EQ round). Same discipline as everything
  // above: every claim is read off the STORE after a real gesture, and the
  // knob count is read against the registry's own arithmetic — three bands
  // per channel strip, the lo/hi pair per fixed bus strip.
  out.eqCounts = {
    strip: await row.locator(".eqk").count(),
    sec: await page.locator(".mrow.msec .eqk").count(),
    bus: await page.locator(".bstrip:not(.mstr):not(.send) .eqk").count(),
  };
  // a DRAG writes the field: 40px up at 0.15 dB/px is exactly +6 dB
  const lo = row.locator('.eqk[data-band="lo"]');
  {
    const bb = await lo.boundingBox();
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 40, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(150);
  out.eqStored = await page.evaluate((k) => import("/nukernel/ui/state.js")
    .then((s) => { const p = s.SONG[0].parts;
                   return p && p[k] && p[k].eq ? p[k].eq.lo : null; }), partKey);
  // a TAP opens the pop-up fader on the same band
  await lo.click();
  out.eqPop = await page.locator("#popfader:not([hidden])").count() === 1;
  await page.keyboard.press("Escape");
  // HOME is flat, and flat is ABSENT — the whole entry normalizes away
  await lo.press("Home");
  await page.waitForTimeout(150);
  out.eqCleared = await page.evaluate(() => import("/nukernel/ui/state.js")
    .then((s) => s.SONG[0].parts));
  // …and a BUS knob writes the song's `buses` map the same way
  //
  // SCROLL IT UNDER THE MOUSE FIRST. `page.mouse` moves to VIEWPORT
  // coordinates and clicks whatever is painted there; it does no scrolling of
  // its own. The part knob above escapes that because its own row has been
  // clicked half a dozen times by the time we reach it, and every one of those
  // clicks auto-scrolled it into view. The bus strips sit at the FOOT of the
  // board — measured, the reverb return's LO bar rests at y≈3003 in a
  // 1000px-tall page — so the same drag was landing on empty space a full two
  // screens below the fold, and the store said `null` because nothing had been
  // touched. Scrolled in, the identical gesture stores +6 dB. A gate that
  // misses its own target is not a product failure.
  const busLo = page.locator('.eqk[data-bus="rev"][data-band="lo"]');
  {
    // …and the bus is a fold too: its return bar is the strip, the effect and
    // the tone are inside it
    await page.locator("#b-rev-ret").click();
    await page.waitForTimeout(120);
    await busLo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const bb = await busLo.boundingBox();
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - 40, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(150);
  out.busEq = await page.evaluate(() => import("/nukernel/ui/state.js")
    .then((s) => s.BUSES && s.BUSES.rev && s.BUSES.rev.eq ? s.BUSES.rev.eq.lo : null));
  await busLo.press("Home");
  await page.waitForTimeout(150);
  out.busCleared = await page.evaluate(() => import("/nukernel/ui/state.js")
    .then((s) => s.BUSES));
  return out;
}

// ---- (E) THE NODE BUDGET, on a whole composed song ------------------------
// "It is glitching — maybe we need a few effects buses feeding into one master
// effects bus instead of everything having its own effects" (the artist,
// 2026-08-15). Measured before the rebuild, on a composed eleven-section
// Beatles song: 375 persistent mixer nodes, 337 of them inside the channels,
// eighteen of every channel's ~31 being a private copy of the SAME twelve-lane
// drum desk. audio/mixer.js BUDGET states the ceiling that replaced it; this is
// the thing that makes the ceiling real rather than aspirational.
//
// IT BUILDS THE CHANNELS RATHER THAN PLAYING THEM, deliberately. Playing an
// eleven-section song end to end is ninety seconds of gate for a number that
// does not move — and channelFor / laneIn / voiceBus are exactly the three
// calls the transport makes at each section start, so this walks the shipping
// builders (the same discipline offlineKit and partProbe keep) rather than a
// model of them. The lanes armed are the six a kit actually plays.
//
// TWO PASSES: the song as composed, and the same song with a chorus chip on
// every box. The second is the claim the whole round rests on — eleven boxes
// asking for a chorus must build ONE chorus.
async function budgetProbe(page, genre) {
  await page.selectOption("#composeg", genre);
  await page.click("#compose");
  await page.waitForTimeout(500);
  return page.evaluate(async () => {
    const [mx, stm] = await Promise.all([
      import("/nukernel/audio/mixer.js"), import("/nukernel/ui/state.js")]);
    const build = () => {
      for (const sec of stm.SONG) {
        const ch = mx.channelFor(sec);
        for (const d of ["k", "s", "h", "o", "c", "r"]) ch.laneIn(d);
        for (const r of (ch.spec.roster || [])) ch.voiceBus(r.v);
      }
      return window.__nuMix();
    };
    const plain = build();
    for (const sec of stm.SONG) sec.fx = ["chorus"];
    stm.emit("box", {});
    const chorused = build();
    for (const sec of stm.SONG) sec.fx = [];
    stm.emit("box", {});
    const pick = m => ({ nodes: m.nodes, sends: m.sends,
                         via: m.channels.map(c => c.via),
                         kit: m.channels.map(c => c.kit),
                         worklets: m.worklets, convolvers: m.convolvers });
    return { sections: stm.SONG.length, plain: pick(plain), chorused: pick(chorused) };
  });
}
// phrase 1 into box 1 when it is out. The .slot bank lives on the COMPOSE
// PAGE now ("compose, arrange, mix") — reached through a PATTERN thumbnail
// on the row, which NAVIGATES there — and only when the toggle is actually
// needed (a fresh default song ships it ON, so this usually never fires;
// at this desk viewport every page is visible, so there is nothing to close).
async function slotOn(page) {
  const slot0 = page.locator(".slot").nth(0);
  if ((await slot0.getAttribute("aria-pressed")) === "true") return;
  await page.locator(".box").first().locator(".bch").first().click();
  await page.waitForFunction(() =>
    document.getElementById("chassis").dataset.page === "compose",
    null, { timeout: 10000 });
  await slot0.click();
  // ...and back. Every caller's next move is a .box dblclick on Arrange, and
  // Compose is the only page on screen until this hops away from it.
  await page.click('.pkey[data-page="song"]');
  await page.waitForFunction(() =>
    document.getElementById("chassis").dataset.page === "song",
    null, { timeout: 10000 });
}
// compose a genre, loop its verse, play briefly — enough for the transport to
// compile a timeline and decide its register homes
async function homePass(page, url, genre) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#play", { timeout: 30000 });
  await page.waitForTimeout(1200);
  await slotOn(page);
  await page.selectOption("#composeg", genre);
  await page.click("#compose");
  await page.waitForTimeout(400);
  await rowOf(page, 0).dblclick();
  await page.waitForTimeout(9000);
  const home = await page.evaluate(() => (window.__nuHome ? window.__nuHome() : null));
  const rates = await page.evaluate(() => window.__rates.slice());
  await page.click("#play");
  return { home, rates };
}
// one pass: load, compose GENRE, loop one verse, average the spectrum
async function pass(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#play", { timeout: 30000 });
  await page.waitForTimeout(1200);
  await slotOn(page);
  await page.selectOption("#composeg", GENRE);
  await page.click("#compose");
  await page.waitForTimeout(400);
  // LOOP ONE VERSE, both passes. A composed song opens on a half-length intro
  // at a reduced level and closes on a filtered outro; comparing two passes
  // that happen to sit in different sections measures the arrangement and
  // calls it the room. A verse is the plain case — full kit, no motion chip.
  const roles = await page.locator(".box .role").allTextContents();
  const vi = Math.max(0, roles.findIndex(r => /verse/.test(r)));
  await rowOf(page, vi).dblclick();                            // loops it AND starts it
  await page.waitForTimeout(9000);                             // past the load + first bars
  let acc = null, n = 0, peak = 0;
  for (let i = 0; i < SPEC_SEC * 5; i++) {
    await page.waitForTimeout(200);
    const v = await page.evaluate(() => window.__spec());
    const r = await page.evaluate(() => window.__rms());
    if (r > peak) peak = r;
    acc = acc ? acc.map((x, j) => x + v[j]) : v; n++;
  }
  const mix = await page.evaluate(() => window.__nuMix());
  const rates = await page.evaluate(() => window.__rates.slice());
  const home = await page.evaluate(() => (window.__nuHome ? window.__nuHome() : null));
  const fb = await page.evaluate(() => window.__nuFallback);
  const dropped = await page.evaluate(() => window.__nuDropped);
  await page.click("#play");                                   // stop
  return { spec: acc.map(x => x / n), mix, rates, home, fb, dropped, peak };
}

(async () => {
  // ---- (0) THE TABLES AGREE, before a browser is even started -------------
  // A lane the kernel can write and the mix cannot place is a drum with no
  // level, no pan and no room — silently, at whatever the defaults were. The
  // sound-source map is the reference (instruments.js DRUMFILE, itself held
  // against kernel.js LANES by the unit gate), so this closes the chain.
  {
    const lanes = Object.keys(I.DRUMFILE);
    const missing = lanes.filter(d => !I.DRUMMIX[d]);
    const extra = Object.keys(I.DRUMMIX).filter(d => !I.DRUMFILE[d]);
    if (missing.length) fail(`DRUMMIX has no strip for lane(s) ${missing.join(",")} — ` +
      `they play at the default level, dead centre, with no room`);
    else if (extra.length) fail(`DRUMMIX places lane(s) ${extra.join(",")} that no kit file names`);
    else ok(`every one of the ${lanes.length} kit lanes has a mix entry`);
    const flat = lanes.every(d => I.DRUMMIX[d].pan === I.DRUMMIX[lanes[0]].pan);
    if (flat) fail("every lane has the same pan — the kit is a point source again");
    else ok(`the kit is spread: hats ${I.DRUMMIX.h.pan}, ride ${I.DRUMMIX.r.pan}, ` +
            `toms ${I.DRUMMIX.t.pan}/${I.DRUMMIX.m.pan}/${I.DRUMMIX.l.pan}, kick ${I.DRUMMIX.k.pan}`);
    // and the range table names instruments that exist
    const bad = Object.keys(I.RANGES).filter(id => !REGISTRY.SAMPLERS[id]);
    if (bad.length) fail(`RANGES names ${bad.join(",")}, which no sampler in the registry has`);
    else ok(`all ${Object.keys(I.RANGES).length} instrument ranges name a real sampler`);
    const narrow = Object.entries(I.RANGES).filter(([, r]) => r[1] - r[0] < 12);
    if (narrow.length) fail(`range(s) narrower than an octave: ${narrow.map(x => x[0]).join(",")} — ` +
      `a fold into one would start refusing notes that are in key`);
    else ok("every range is at least an octave wide");
  }

  const srv = await serve(ROOT, PORT); PORT = srv.port;
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = capturePageErrors(page);
  // THE SINGLE-LAYOUT SHELL: deskUI drives the board (.mrow/.mval/.mchip/
  // .bstrip), which lives on the Mix page now and is display:none anywhere
  // else — the same goPage the audio and survival gates already carry.
  const goPage = async (p) => {
    await page.click(`.pkey[data-page="${p}"]`);
    await page.waitForFunction(
      (n) => document.getElementById("chassis").dataset.page === n, p,
      { timeout: 10000 });
  };
  await page.addInitScript(taps);
  await page.addInitScript(offlineFft);   // the offline probes' shared banding + node counter
  // ?nobounce ON BOTH PASSES. The background bounce renders the whole song
  // into an OfflineAudioContext while the graph plays, and an offline render
  // competing for the machine is CPU the live spectrum feels — the two passes
  // have to differ by the room and by nothing else. (It also stops a
  // half-finished render from holding the next navigation, which is what timed
  // this measurement out while it was being written.)
  const base = `http://localhost:${PORT}/nukernel/kernel-daw.html?nobounce`;

  const wet = await pass(page, base);
  const kit = await offlineKit(page);       // on the WET page — see offlineKit
  // the desk, also on the wet page: it needs this song's instruments decoded,
  // and it must run before the dryroom navigation throws the song away
  const desk = await partProbe(page);
  // the strip EQ, on the same decoded song, before anything renavigates
  const eqp = await eqProbe(page);
  // the dynamics, on the same decoded song and before partsLive touches
  // `sec.parts` — it renders the chairs as the composer left them
  const vel = await velProbe(page);
  // the machines, offline on the same page — needs nothing this song decoded
  // (a machine kit synthesizes its own buffers), touches nothing it leaves
  const mach = await machinesProbe(page);
  // ...and the bounce, twice, on the same composed song with the 909 borrowed
  const btw = await bounceTwice(page);
  // …AND A PERSON CAN SWITCH IT ON. Everything in (H) below drives the store
  // directly, which proves the engine and nothing about the surface — and the
  // surface is where the last three chips that "shipped" turned out to be
  // unreachable. One tab, one chip, then ask the STORE what it holds.
  const singChip = await (async () => {
    // the sing chips live in a row's VOICE cell popup ("the row and the board")
    await page.locator(".box").first().locator('.bcell[data-cell="voice"]').click();
    await page.waitForSelector("#rowpop:not([hidden])", { timeout: 10000 });
    const chip = page.locator('.pchip[data-kind="sing"][data-value="duet"]').first();
    if (!(await chip.count())) return { err: "no sing chip in the VOICE popup" };
    await chip.click();
    await page.waitForTimeout(250);
    const on = await chip.evaluate(el => el.classList.contains("on"));
    const held = await page.evaluate(() => import("/nukernel/ui/state.js")
      .then(s => s.curSection().sing));
    await chip.click();                    // put it back: (H) picks its own box
    await page.waitForTimeout(250);
    const off = await page.evaluate(() => import("/nukernel/ui/state.js")
      .then(s => s.curSection().sing));
    await page.keyboard.press("Escape");   // the popup's scrim would cover the page
    await page.waitForSelector("#rowpop", { state: "hidden" });
    return { on, held, off };
  })();
  // the singer, on the same page and the same composed song. It is the only
  // probe here that pays for a wasm boot (~210 ms per espeak instance), so it
  // runs once and every claim in (H) reads its result.
  const sing = await singProbe(page);
  const live = desk.err ? null
    : await partsLive(page, { a: desk.A, b: desk.B });
  // the budget, still on the WET page — it has to count the drum room and the
  // kit desk's room sends, and ?dryroom is precisely the page that has neither.
  // It composes a new song over the top of the rock one, which is why it comes
  // after every measurement that needed rock and before the navigation that
  // throws it away. Beatles because it is the longest thing the composer writes
  // (eleven sections) and the song the census that started this round was on.
  const budget = await budgetProbe(page, "beatles");
  const dry = await pass(page, base + "&dryroom");
  // the surface, last and on whatever song is loaded: it needs no audio, and
  // running it here costs one page's worth of clicks rather than a third load
  await goPage("mix");                     // the board deskUI drives is its own page now
  const ui = await deskUI(page);

  // ---- (A) THE LANE STRIPS ARE NODES --------------------------------------
  {
    const chans = wet.mix.channels.filter(c => c.drums && c.drums.length);
    if (!chans.length) fail("no channel reports a single drum lane — __nuMix cannot see the kit");
    else {
      const all = new Map();
      for (const c of chans) for (const d of c.drums) all.set(d.lane, d);
      const lanes = [...all.keys()].sort().join("");
      if (all.size < 3) fail(`only ${all.size} lane(s) sounded (${lanes}) — too few to prove a kit`);
      else ok(`${all.size} lanes built a strip and sounded: ${lanes}`);
      // the numbers on the nodes ARE the table's, per lane
      const wrong = [...all.values()].filter(d =>
        Math.abs(d.level - I.DRUMMIX[d.lane].lvl) > 1e-3 ||
        Math.abs(d.pan - I.DRUMMIX[d.lane].pan) > 1e-3);
      if (wrong.length) fail(`lane strip(s) ${wrong.map(d => d.lane).join(",")} carry values the ` +
        `table does not declare (e.g. ${JSON.stringify(wrong[0])}) — the mix was built from ` +
        `something other than DRUMMIX`);
      else ok(`every lane's gain and panner carry its DRUMMIX numbers ` +
              `(${[...all.values()].map(d => d.lane + "@" + d.pan).join(" ")})`);
      const pans = new Set([...all.values()].map(d => d.pan));
      if (pans.size < 2) fail(`every sounding lane is at pan ${[...pans][0]} — the kit is mono again`);
      else ok(`the sounding lanes occupy ${pans.size} different places in the field`);
    }
  }

  // ---- (B) THE DRUM ROOM ---------------------------------------------------
  {
    if (!wet.mix.room) fail("__nuMix.room is false — the drum room bus was never built");
    else ok("the drum room bus exists");
    const sends = wet.mix.channels.filter(c => c.drums && c.drums.length).map(c => c.droom);
    if (sends.some(x => !(x > 0)))
      fail(`a channel with drums has no room send (${JSON.stringify(sends)})`);
    else ok(`every drum-carrying channel sends to the room (${sends.join(", ")})`);
    // per-lane wetness is the RATIO that makes it a room rather than a wash:
    // a kick barely goes, a snare goes plenty
    const l = new Map();
    for (const c of wet.mix.channels) for (const d of (c.drums || [])) l.set(d.lane, d.room);
    if (l.has("k") && l.has("s") && !(l.get("s") > l.get("k") * 2))
      fail(`the snare (${l.get("s")}) is not meaningfully wetter than the kick (${l.get("k")}) — ` +
           `a kit sent to a room at one level is a wash, not a room`);
    else ok(`the room is a ratio: kick ${l.get("k")}, snare ${l.get("s")}, hat ${l.get("h")}`);
    if (dry.mix.channels.some(c => c.droom))
      fail("?dryroom still built a room send — the two passes are not comparable");
    else ok("?dryroom builds the same song with no room send at all");

    // THE LIVE A/B IS EVIDENCE, NOT A GATE. Same music, same box, same loop,
    // the only difference being the room — and the shape correlation measured
    // 0.927, 0.943, 0.962 on boom bap and 0.984 on rock across four pairs of
    // passes on this machine. The spread is not noise in the measurement, it is
    // the mix: a genre whose kit carries the record moves a long way, a wall of
    // distorted guitar swamps it, and the master glue compressor trades back
    // whatever level the room adds. "Above 120 Hz", the obvious directional
    // claim (the room high-passes at 220, so it can only add up there), came
    // out 1.31x on one pair and 0.95x on the next for the same reason. Neither
    // number is stable enough to fail a build on, and both are worth seeing —
    // so they are printed, and the two claims that ARE asserted below are made
    // where nothing can drift: offline, on the room's own output.
    const r = corr(wet.spec, dry.spec);
    const aw = above120(wet.spec), ad = above120(dry.spec);
    console.log(`  live A/B (evidence)   : shape corr ${r.toFixed(4)}, ` +
                `above-120 Hz ${ad.toFixed(4)} dry -> ${aw.toFixed(4)} wet ` +
                `(peaks ${dry.peak.toFixed(3)} / ${wet.peak.toFixed(3)})`);

    // ...AND IT IS A SHORT STEREO ROOM. Render the room's own impulse response
    // offline, through the SAME builder the page and the bounce use: one
    // sample in, and what comes back is the room, in full, with nothing else
    // in it. Deterministic — no music, no compressor, no loop phase.
    const ir = await page.evaluate(async () => {
      const mod = await import("/nukernel/audio/graph.js");
      const SR = 44100;
      const octx = new OfflineAudioContext(2, SR, SR);          // 1 second
      const room = mod.buildRoomBus(octx, octx.destination);
      const b = octx.createBuffer(1, 2, SR);
      b.getChannelData(0)[0] = 1;                                // the click
      const s = octx.createBufferSource(); s.buffer = b;
      s.connect(room); s.start(0);
      const out = await octx.startRendering();
      const L = out.getChannelData(0), R = out.getChannelData(1);
      // energy per 10 ms window, summed across the pair
      const win = SR / 100, e = [];
      for (let w = 0; w * win < L.length; w++) {
        let s2 = 0;
        for (let i = w * win; i < (w + 1) * win && i < L.length; i++) s2 += L[i] * L[i] + R[i] * R[i];
        e.push(s2);
      }
      const peak = Math.max(...e);
      let last = 0;
      for (let i = 0; i < e.length; i++) if (e[i] > peak * 1e-3) last = i;   // -30 dB
      let diff = 0, tot = 0;
      for (let i = 0; i < L.length; i++) { diff += (L[i] - R[i]) * (L[i] - R[i]); tot += L[i] * L[i] + R[i] * R[i]; }
      let early = 0;
      for (let i = 3; i < 12 && i < e.length; i++) early += e[i];            // 30..120 ms
      return { rt30ms: last * 10, sides: tot > 0 ? diff / tot : 0,
               early: peak > 0 ? early / peak : 0 };
    });
    console.log(`  room impulse          : -30 dB at ${ir.rt30ms} ms, ` +
                `reflections 30-120 ms ${ir.early.toFixed(2)}x peak, ` +
                `L-R difference ${ir.sides.toFixed(3)}`);
    if (ir.rt30ms >= 120 && ir.rt30ms <= 700)
      ok(`the room is a SHORT room: -30 dB at ${ir.rt30ms} ms`);
    else fail(`the drum room decays to -30 dB at ${ir.rt30ms} ms — a kit ambience is ` +
              `a couple of hundred milliseconds, not a hall and not a click`);
    if (ir.early > 0.02)
      ok(`it has real reflections after the first 30 ms (${ir.early.toFixed(2)}x the peak window)`);
    else fail(`nothing comes back between 30 and 120 ms (${ir.early.toFixed(3)}x peak) — ` +
              `that is a delay, not a room`);
    if (ir.sides > 0.05) ok(`and it is stereo: L-R difference ${ir.sides.toFixed(3)} of the energy`);
    else fail(`the room returns the same signal to both channels (L-R ${ir.sides.toFixed(3)}) — ` +
              `a mono ambience puts the whole kit back on one point`);

    // ---- THE KIT ITSELF, RENDERED TWICE (offlineKit, above) ----------------
    if (kit.err) fail(`the offline kit render could not run: ${kit.err}`);
    else {
      const tailRatio = kit.wetS.tail / Math.max(1e-12, kit.dryS.tail);
      console.log(`  offline kit (${kit.kitName})`.padEnd(24) + `: snare tail 250-600 ms ` +
                  `dry ${kit.dryS.tail.toExponential(2)} -> wet ${kit.wetS.tail.toExponential(2)} ` +
                  `(${tailRatio.toFixed(1)}x), hit window ${(kit.wetS.hit / kit.dryS.hit).toFixed(2)}x`);
      if (tailRatio > 3)
        ok(`the room is audible on the kit itself: ${tailRatio.toFixed(1)}x the energy a quarter ` +
           `of a second after the snare, from the same sample through the same channel`);
      else fail(`with the room the snare's 250-600 ms tail carries ${tailRatio.toFixed(2)}x the ` +
                `energy it does without — that is not a room, that is a rounding difference`);
      // and the placement is in the rendered channels, not only in the params
      const bal = (x) => (x.right - x.left) / (x.right + x.left);
      console.log(`  lane placement        : hat R-L ${bal(kit.hat).toFixed(3)}, ` +
                  `low tom R-L ${bal(kit.tom).toFixed(3)}`);
      if (bal(kit.hat) > 0.05 && bal(kit.tom) < -0.05)
        ok(`the lanes render where the table places them: the hat is right of centre ` +
           `(${bal(kit.hat).toFixed(3)}) and the low tom left (${bal(kit.tom).toFixed(3)})`);
      else fail(`the hat rendered at R-L ${bal(kit.hat).toFixed(3)} and the low tom at ` +
                `${bal(kit.tom).toFixed(3)} — the lane panners are not reaching the output`);
    }
  }

  // ---- (C) THE REGISTER LAW ------------------------------------------------
  {
    // THE ARTIFACT, not the intention: a buffer source's playbackRate is
    // exactly how far its zone is being stretched (2^(st/12)), and the law says
    // no pitched note may be stretched further than the parent's own limits
    // (instruments.js STRETCH_UP/STRETCH_DOWN) plus the soft edge the per-note
    // fold tolerates. Drums fire at rate 1 and drop out of this by construction.
    const LIM_UP = I.STRETCH_UP + 6, LIM_DOWN = I.STRETCH_DOWN + 6;
    const st = (x) => 12 * Math.log2(x);
    const pitched = wet.rates.filter(x => Math.abs(x - 1) > 1e-6);
    if (pitched.length < 20) fail(`only ${pitched.length} pitched sample(s) played — ` +
      `not enough to say anything about their register`);
    else {
      const hi = Math.max(...pitched.map(st)), lo = Math.min(...pitched.map(st));
      const over = pitched.filter(x => st(x) > LIM_UP || st(x) < -LIM_DOWN);
      console.log(`  zone stretch          : ${pitched.length} pitched notes, ` +
                  `${lo.toFixed(1)}st .. +${hi.toFixed(1)}st from their own roots`);
      if (over.length) fail(`${over.length} note(s) played a zone stretched beyond ` +
        `[-${LIM_DOWN}, +${LIM_UP}] semitones (worst ${st(over.reduce((a, b) =>
          Math.abs(st(a)) > Math.abs(st(b)) ? a : b)).toFixed(1)}st) — that is not the ` +
        `instrument any more, and the register law is supposed to fold or drop it`);
      else ok(`no zone is stretched past the honest window ` +
              `(${lo.toFixed(1)}..+${hi.toFixed(1)} st, limit -${LIM_DOWN}..+${LIM_UP})`);
    }
    if (wet.home == null) fail("window.__nuHome is missing — the register home cannot be checked");
    else {
      console.log(`  register home         : ${JSON.stringify(wet.home)}`);
      const bad = wet.home.filter(h => Math.abs(h.oct) > 3);
      if (bad.length) fail(`a chair was moved ${bad[0].oct} octaves — the home is supposed to be ` +
        `the smallest move that fits, not a transposition`);
      else ok(`the register home moved ${wet.home.length} chair(s), none more than 3 octaves`);
    }
    // ...AND IT FIRES WHERE IT MUST. A home that never moves anything passes
    // every check above by doing nothing, so one genre is named: sludge's
    // guitar, the most stretched line on the page.
    const hp = await homePass(page, base, HOME_GENRE);
    console.log(`  ${HOME_GENRE} home${" ".repeat(Math.max(1, 16 - HOME_GENRE.length))}: ` +
                `${JSON.stringify(hp.home)}`);
    const up = (hp.home || []).filter(h => h.chair.startsWith(HOME_GENRE + "|") && h.oct > 0);
    if (!up.length)
      fail(`${HOME_GENRE} moved no chair up — its guitar is written two and a half octaves ` +
           `below its lowest zone root, so either the home stopped working or the genre changed`);
    else ok(`${HOME_GENRE} lifted ${up.length} chair(s) out of the mud ` +
            `(${up.map(h => h.chair + " +" + h.oct).join(", ")})`);
    const hpitched = hp.rates.filter(x => Math.abs(x - 1) > 1e-6).map(st);
    if (hpitched.length) {
      const lo2 = Math.min(...hpitched);
      if (lo2 < -LIM_DOWN)
        fail(`${HOME_GENRE} still plays a zone ${lo2.toFixed(1)} semitones down — the home ran ` +
             `but the note reached the sampler unfolded`);
      else ok(`${HOME_GENRE}'s lowest zone stretch is ${lo2.toFixed(1)} st (was −28 before the law)`);
    }
    // and the law's failure mode is SILENCE, COUNTED — never another instrument
    if (wet.fb) fail(`${wet.fb} stand-in voice(s) fired — a note the register law could not ` +
      `place came out of the stand-in instead of being dropped`);
    else ok("no fallback voice fired");
    console.log(`  notes dropped         : ${wet.dropped}`);
    if (wet.dropped > 40) fail(`${wet.dropped} notes were dropped in one pass — the drop law is ` +
      `silencing music rather than catching the unplayable`);
    else ok(`drops stayed rare (${wet.dropped})`);
  }

  // ---- (D) THE DESK: not every track goes through the effects --------------
  {
    if (desk.err) fail(`the per-part probe could not run: ${desk.err}`);
    else {
      console.log(`  desk addresses        : ${desk.keys.join(", ")}  ` +
                  `(chairs ${desk.roster.map(r => r.v + "=" + r.key).join(" ")})`);
      if (desk.clean.played < 2)
        fail(`only ${desk.clean.played} source(s) played into the offline desk — ` +
             `nothing to compare`);
      else ok(`${desk.clean.played} sources rendered through the desk`);

      // (D1) AN UNMIXED BOX BUILDS EXACTLY THE STRIPS THE SONG DERIVES — no
      // more, no fewer. The old law here ("no `parts` = no sub-bus at all")
      // was the flattering desk Paul reported 2026-08-16: every cap at one
      // height, every knob at noon. derivedPartTone now seats the desk from
      // the model, so the honest claim is that the built strips are the
      // derivation's own answer, address for address — a strip the model did
      // not ask for is still a bug, and one it asked for that is missing is
      // the old flatness back.
      {
        const want = desk.keys.filter(k => {
          const r = desk.derived && desk.derived[k];
          return r && (r.tdb || r.eq);
        }).sort().join(",");
        const got = desk.none.built.slice().sort().join(",");
        if (got !== want)
          fail(`an unmixed box built part bus(es) [${got}] but the model derives ` +
               `[${want}] — the graph and derivedPartTone disagree`);
        else ok(`an unmixed box builds exactly the derived strips [${got || "none"}]`);
      }

      // (D2) THE TREATED PART MOVES. Same 0.98 bar as the live A/B and the
      // insert witness in nukernel-audio (E): two passes of one sound correlate
      // ~0.995, a real treatment bends the shape to ~0.94.
      const rA = corr(desk.clean.spec, desk.treat.spec);
      const rB = corr(desk.bClean.spec, desk.bWhileA.spec);
      console.log(`  per-part insert       : ${desk.A} shape corr ${rA.toFixed(4)} with/without ` +
                  `crunch, ${desk.B} ${rB.toFixed(4)} while ${desk.A} is crunched ` +
                  `(worst sample delta ${desk.maxd.toExponential(2)})`);
      if (rA < 0.98)
        ok(`an insert on ${desk.A} bends ${desk.A}: shape corr ${rA.toFixed(4)}`);
      else fail(`crunch on part ${desk.A} moved its own spectrum by nothing ` +
                `(shape corr ${rA.toFixed(4)}, needs < 0.98) — the part bus is built ` +
                `but the signal is not going through it`);

      // (D3) …AND THE OTHER PART DOES NOT. This is the whole user complaint.
      if (rB > 0.98)
        ok(`and it leaves ${desk.B} alone: shape corr ${rB.toFixed(4)}, worst sample ` +
           `difference ${desk.maxd.toExponential(2)}`);
      else fail(`crunch on part ${desk.A} also changed part ${desk.B} ` +
                `(shape corr ${rB.toFixed(4)}) — the insert is not on a sub-bus, it is ` +
                `still treating the whole section`);
      // the two chairs really are two different sounds, or (D3) is measuring
      // one part against itself and passing for free
      const rAB = corr(desk.clean.spec, desk.bClean.spec);
      if (rAB < 0.98) ok(`the two parts are genuinely different signals (corr ${rAB.toFixed(4)}), ` +
                         `so the isolation above is a real comparison`);
      else fail(`soloing ${desk.A} and soloing ${desk.B} render the same spectrum ` +
                `(corr ${rAB.toFixed(4)}) — solo is not isolating anything`);

      // (D4) MUTE IS SILENCE, and solo is mute on everyone else — one law, so
      // muting every address must render nothing at all.
      if (desk.allMute.energy < 1e-9)
        ok(`muting every part renders silence (energy ${desk.allMute.energy.toExponential(2)})`);
      else fail(`with every part muted the channel still rendered ` +
                `${desk.allMute.energy.toExponential(2)} of energy — a mute that leaks`);
      if (desk.clean.built.includes(desk.B))
        ok(`soloing ${desk.A} built the muting busses (${desk.clean.built.join(",")})`);
      else fail(`soloing ${desk.A} built ${desk.clean.built.join(",") || "nothing"} — ` +
                `the parts it must silence have no gain to close`);

      // (D5) THE SAME TWO CLAIMS, WITH THE EFFECT ON A SHARED BUS. This is the
      // topology the live page builds for a single blend chip (fields.js "A
      // CHIP IS A SEND; A CHAIN IS AN INSERT"): one crunch for the page, every
      // part able to reach it. The insert version above proves the desk exists;
      // this proves that sharing the effect did not un-prove it.
      const sA = corr(desk.sClean.spec, desk.sTreat.spec);
      const sBc = corr(desk.sB.spec, desk.sAB.spec);
      console.log(`  per-part send         : ${desk.A} shape corr ${sA.toFixed(4)} with/without ` +
                  `the crunch BUS, ${desk.B} ${sBc.toFixed(4)} while ${desk.A} sends ` +
                  `(worst sample delta ${desk.smaxd.toExponential(2)})`);
      if (sA < 0.98)
        ok(`a send from ${desk.A} to the shared crunch bus bends ${desk.A}: ` +
           `shape corr ${sA.toFixed(4)}`);
      else fail(`the crunch SEND on part ${desk.A} moved nothing (shape corr ` +
                `${sA.toFixed(4)}) — the bus was built and the signal is not reaching it`);
      if (sBc > 0.98 && desk.smaxd < 1e-6)
        ok(`and the shared bus does not leak onto ${desk.B}: corr ${sBc.toFixed(4)}, ` +
           `worst sample difference ${desk.smaxd.toExponential(2)}`);
      else fail(`part ${desk.A}'s SEND changed part ${desk.B} (corr ${sBc.toFixed(4)}, ` +
                `worst sample delta ${desk.smaxd.toExponential(2)}) — a bus every part ` +
                `can reach has become a bus every part goes through`);
    }

    // ...AND THE LIVE CHANNEL BUILDS IT TOO
    if (!live) { /* the offline half already failed; nothing to join to */ }
    else {
      const withParts = live.mix.channels.filter(c => c.parts && c.parts.length);
      if (!withParts.length)
        fail(`no live channel reports a part strip — __nuMix.channels[].parts is ` +
             `${JSON.stringify(live.mix.channels.map(c => c.parts))}`);
      else {
        const c = withParts[0];
        console.log(`  live desk             : ${JSON.stringify(c.parts)}`);
        const A = c.parts.find(p => p.key === desk.A);
        if (!A || A.stages.join(",") !== "higain")
          fail(`the live ${desk.A} strip declared ${A ? JSON.stringify(A.fx) : "nothing"} and ` +
               `BUILT [${A ? A.stages : ""}] — a per-part chip lit up and passed dry`);
        else ok(`the live ${desk.A} strip built its insert chain: [${A.stages}]`);
        // the built level is hush (0.4) × the song's own derived seating
        // (tdb, reported beside it) — the user's chip rides ON the derivation,
        // which is the board law for the fader applied to the enum too
        const wantA = A ? 0.4 * Math.pow(10, (A.tdb || 0) / 20) : 0;
        if (A && Math.abs(A.level - wantA) < 2e-3 && A.rev > 0.5)
          ok(`its level and send are real params: level ${A.level} ` +
             `(hush × derived ${A.tdb} dB), reverb ${A.rev}`);
        else fail(`the ${desk.A} strip's chips did not reach its nodes ` +
                  `(${JSON.stringify(A)}, want level ${wantA.toFixed(4)})`);
        const B = c.parts.find(p => p.key === desk.B);
        if (B && B.muted) ok(`the muted ${desk.B} strip reports a closed gate`);
        else fail(`part ${desk.B} was muted and the live gate says ${JSON.stringify(B)}`);
        const D = c.parts.find(p => p.key === "drums");
        if (D && Math.abs(D.pan + 0.7) < 1e-3)
          ok(`the kit takes a place of its own on the desk (pan ${D.pan}), beside its ` +
             `own lane geometry`);
        else fail(`the drums strip did not take the pan chip (${JSON.stringify(D)})`);
      }
      // and the song still plays with a desk on it
      if (live.peak < 0.01)
        fail(`the song went silent under a per-part mix (peak RMS ${live.peak.toFixed(4)})`);
      else ok(`the song plays with the desk engaged: peak RMS ${live.peak.toFixed(4)}`);
      // the budgets the audio gate holds, re-read here because sub-busses are
      // exactly the kind of thing that quietly multiplies a pool
      if (live.mix.worklets > 12)
        fail(`${live.mix.worklets} Faust worklets with a per-part desk engaged — ` +
             `a sub-bus must be cheap nodes, never another voice`);
      else ok(`the desk cost no voices: ${live.mix.worklets} worklets, ` +
              `${live.mix.convolvers} convolvers`);
      if (live.mix.convolvers > 2)
        fail(`${live.mix.convolvers} convolvers — a part send must land on the ` +
             `section's own reverb, not build one of its own`);
    }
  }

  // ---- (D2) THE DESK HAS A SURFACE ----------------------------------------
  // The mix table is the only way a person reaches any of the above. Every
  // claim here is read off the AUDIO tier after a real click, never off the
  // button that was clicked.
  {
    if (!(ui.parts >= 1) || ui.rows !== ui.parts + 1)
      fail(`the mix table drew ${ui.rows} row(s) for ${ui.parts} part(s) — it must be ` +
           `one row per sound plus exactly one section row`);
    else ok(`the mix table draws ${ui.parts} sounds and one section row`);
    // ---- JOB ONE: A TRACK HAS THREE SENDS AND NO INSERT ---------------------
    if ((ui.trackFields || []).includes("fx"))
      fail(`the track strip still draws an fx bar (${ui.trackFields.join(",")}) — ` +
           `fields.js PARTMIX must not declare a per-track insert`);
    else ok(`the track strip's routing is ${(ui.trackFields || []).join(",")} — no insert`);
    for (const bus of ["rev", "echo", "room"])
      if (!(ui.trackFields || []).includes(bus))
        fail(`the track strip is missing its ${bus} send — a track's only ` +
             `outward routing is its three bus sends`);
    ok(`the three bus sends (rev, echo, room) are the whole of a track's routing`);
    // …and the group insert did NOT vanish with it: it moved to the section
    // strip, the box's own field, on purpose (fields.js PARTMIX's own note)
    if (!(ui.secFields || []).includes("fx"))
      fail(`the section strip lost its group insert too (${(ui.secFields || []).join(",")}) — ` +
           `it should have moved off tracks, not off the board`);
    else ok("the group insert survives on the section strip, the box's own field");
    if (!ui.stored || !ui.stored[ui.partKey])
      fail(`clicking the ${ui.partKey} row's chips stored ${JSON.stringify(ui.stored)}`);
    else {
      const e = ui.stored[ui.partKey];
      if (e.rev === "wet" && e.lvl === "hush" && e.solo === true)
        ok(`the table writes song.js's own spelling: ${ui.partKey} ${JSON.stringify(e)}`);
      else fail(`the ${ui.partKey} entry came out ${JSON.stringify(e)} — the table is writing ` +
                `a shape the loader does not validate`);
    }
    const s = (ui.spec || []).find(p => p.key === ui.partKey);
    if (!s) fail(`chanSpec built no bus for ${ui.partKey} after the table asked for one — ` +
                 `the surface and the mixer disagree about the address`);
    else if (Math.abs(s.rev - 0.55) < 1e-3 && Math.abs(s.lvl - 0.4) < 1e-3)
      ok(`the audio tier resolves what the table wrote: ${ui.partKey} -> ` +
         `rev ${s.rev} at ${s.lvl}`);
    else fail(`the ${ui.partKey} bus resolved to ${JSON.stringify(s)}`);
    // a solo on one part must silence the others, resolved across the box
    const others = (ui.spec || []).filter(p => p.key !== ui.partKey);
    if (ui.keys.length > 1 && !others.some(p => p.mute))
      fail(`a solo on ${ui.partKey} left ${JSON.stringify(others.map(p => p.key))} unmuted`);
    else ok(`the solo key reaches the other ${others.length} strip(s)`);
    // the section row is the box's own field, and the CELL shows what the
    // store holds — the two-views claim, both views on the mix table now
    if (ui.rev !== "drown")
      fail(`the section row wrote sec.rev = ${JSON.stringify(ui.rev)} — it must write the ` +
           `same box field every surface writes, or a saved song grows a second mix`);
    else if (ui.paletteLit !== "true")
      fail(`the section row's rev cell does not show the drown it wrote ` +
           `(lit+labelled = ${ui.paletteLit}) — the surface and the store have forked`);
    else ok("the section row IS the box field: the store holds drown and the cell says so");
    if (ui.emptied !== null)
      fail(`clearing every chip left ${JSON.stringify(ui.emptied)} behind — absent must be ` +
           `the only spelling of a default, or an untouched box builds sub-busses`);
    else ok("clearing the chips leaves the box exactly as unmixed as it started");
    // ---- the tone knobs (the strip-EQ round): present, writable, clearable
    const eqc = ui.eqCounts || {};
    if (eqc.strip !== 3 || eqc.sec !== 3 || eqc.bus !== 6)
      fail(`the tone knobs are not on the board: ${eqc.strip} on a channel strip ` +
           `(want 3), ${eqc.sec} on the section strip (want 3), ${eqc.bus} on the ` +
           `bus strips (want 6 — the lo/hi pair on each of the three returns)`);
    else ok("LO/MID/HI on every channel strip, LO/HI on the three returns");
    if (ui.eqStored !== 6)
      fail(`a 40px drag on the ${ui.partKey} LO knob stored ` +
           `${JSON.stringify(ui.eqStored)} — the gesture is not reaching the field ` +
           `(0.15 dB/px must land exactly +6)`);
    else ok(`a drag writes the field: ${ui.partKey} eq.lo = +6 dB`);
    if (!ui.eqPop) fail("a tap on a tone knob did not open the pop-up fader");
    else ok("a tap on a tone knob opens the pop-up fader");
    if (ui.eqCleared !== null)
      fail(`Home on the knob left ${JSON.stringify(ui.eqCleared)} behind — flat must ` +
           `normalize the entry away, or an untouched strip builds filters`);
    else ok("Home is flat, and flat is absent — the entry normalizes away");
    if (ui.busEq !== 6)
      fail(`the reverb return's LO knob stored ${JSON.stringify(ui.busEq)} — the bus ` +
           `pair is not reaching the song's buses map`);
    else if (ui.busCleared !== null)
      fail(`clearing the bus knob left ${JSON.stringify(ui.busCleared)} — busesIsDefault ` +
           `is not treating a flat return EQ as the default`);
    else ok("the bus pair writes buses.rev.eq and clears back to absent");
  }

  // ---- (D6) THE STRIP EQ, RENDERED -----------------------------------------
  // The one render comparison the round budgets for: +12 dB of low shelf on
  // the bass part moves the bytes, every flat spelling moves nothing — and the
  // node ledger says the flat graph IS the pre-change graph.
  {
    if (eqp.err) fail(`the EQ probe could not run: ${eqp.err}`);
    else {
      console.log(`  strip EQ              : flat worst-sample delta ${eqp.flatd.toExponential(2)} ` +
                  `against a same-spec control of ${eqp.ctl.toExponential(2)}, ` +
                  `+12 lo on bass ${eqp.bassd.toExponential(2)}; nodes base ${eqp.base.nodes} ` +
                  `flat ${eqp.flat.nodes} bass-eq ${eqp.lofted.nodes} sec-eq ${eqp.secEq.nodes}`);
      // THE FLOOR IS STATED, NOT SAMPLED. The control above is printed because
      // it is the evidence, but it cannot BE the threshold: the renderer's
      // wobble is intermittent — ten same-spec renders come back in two states
      // about 4.4e-5 apart, and any given pair may be one of the matching ones
      // (measured: a control of 7.33e-6 on the same run that read 4.44e-5
      // between base and flat, both of them the same spec-identical graph).
      // Gating on one sampled pair just moves the coin flip.
      //
      // So: 1e-3, which is twenty times the wobble and five hundred times
      // below what an EQ that did anything looks like (the +12 dB shelf
      // beside it measures 5.60e-1). Nothing a filter can do to this signal
      // fits under that. The EXACT half of the claim is the node ledger below
      // — flat adds no biquad, node for node — and that is where "flat is the
      // pre-EQ graph" is actually decided; this is the corroborating listen.
      const FLOOR = 1e-3;
      if (eqp.flatd > FLOOR)
        fail(`an all-zero EQ changed the render (worst sample ${eqp.flatd.toExponential(2)}, ` +
             `past the ${FLOOR.toExponential(0)} floor) — flat must be the graph of the ` +
             `day before the EQ existed`);
      else ok(`every flat spelling renders the pre-EQ graph ` +
              `(${eqp.flatd.toExponential(2)} under a ${FLOOR.toExponential(0)} floor, ` +
              `same-spec control ${eqp.ctl.toExponential(2)})`);
      // the base graph may already carry the song's DERIVED tone (the desk
      // seats itself now — audio/mixer.js derivedPartTone/derivedSecEq), so
      // "flat is zero nodes" becomes "an all-zero USER spec is the base graph,
      // node for node" — a stored zero must never add or remove a biquad
      if (eqp.flat.nodes !== eqp.base.nodes || eqp.flat.secEq !== eqp.base.secEq ||
          eqp.flat.parts.length !== eqp.base.parts.length)
        fail(`an all-zero user spec changed the graph: ${eqp.flat.nodes} vs ` +
             `${eqp.base.nodes} base nodes, secEq ${eqp.flat.secEq} vs ${eqp.base.secEq}, ` +
             `parts [${eqp.flat.parts}] vs [${eqp.base.parts}]`);
      else ok(`an all-zero user spec is the base graph, node for node ` +
              `(${eqp.base.nodes} = ${eqp.flat.nodes})`);
      if (!(eqp.bassd > 1e-3))
        fail(`+12 dB of low shelf on the bass moved the bytes by ` +
             `${eqp.bassd.toExponential(2)} — the filter is built but the bass is ` +
             `not going through it`);
      else if (!(eqp.lofted.energy > eqp.base.energy))
        fail(`+12 dB of low shelf LOWERED the energy (${eqp.lofted.energy.toFixed(4)} vs ` +
             `${eqp.base.energy.toFixed(4)}) — the gain is on the wrong band`);
      else ok(`+12 dB lo on the bass is audible in the bytes (worst sample ` +
              `${eqp.bassd.toExponential(2)}, energy ×` +
              `${(eqp.lofted.energy / eqp.base.energy).toFixed(2)})`);
      // three biquads for a section tone — unless the song already DERIVED a
      // section tone (base.secEq is 3), in which case the user band merges
      // onto the biquads that exist and the node count must not move
      if (eqp.base.secEq ? eqp.secEq.nodes !== eqp.base.nodes
                         : eqp.secEq.nodes !== eqp.base.nodes + 3)
        fail(`a section-strip EQ built ${eqp.secEq.nodes - eqp.base.nodes} node(s) ` +
             `over base (base secEq ${eqp.base.secEq}) — the tone stage must exist ` +
             `exactly once, three biquads, derived and user merged onto them`);
      else ok("a non-flat section strip carries exactly one three-biquad tone stage");
    }
  }

  // ---- (F) THE NODE BUDGET ------------------------------------------------
  // The ceiling audio/mixer.js BUDGET declares, asserted on the longest song
  // the composer writes. A budget nobody checks is a wish; this is the check.
  {
    const B = budget;
    if (B.sections < 9)
      fail(`the budget probe composed ${B.sections} sections — the ceiling has to be ` +
           `measured on a NINE-plus-section song or it is not measuring an arrangement`);
    else ok(`the budget is measured on a ${B.sections}-section composed song`);
    for (const [name, m] of [["as composed", B.plain], ["chorus on every box", B.chorused]]) {
      const n = m.nodes;
      if (!n || typeof n.total !== "number") { fail("__nuMix carries no `nodes` count"); continue; }
      console.log(`  node budget (${name.padEnd(19)}): ${n.total} total = ${n.shared} shared ` +
                  `+ ${n.channels} channels (${n.per.join("/")}), cap ${n.cap}  ` +
                  `[rack: master ${n.rack.master}, verbs ${n.rack.verbs}, echo ${n.rack.echo}, ` +
                  `room ${n.rack.room}, kit ${n.rack.kit}, sends ${n.rack.sends}]`);
      if (n.channels !== B.sections)
        fail(`${n.channels} channels for ${B.sections} sections — the probe did not build ` +
             `the whole song, so the number below is not the song's`);
      if (n.over)
        fail(`the mixer built ${n.total} persistent nodes on a ${B.sections}-section song, ` +
             `over the ${n.cap} ceiling (${n.budget.shared} shared + ${n.budget.chan}/channel ` +
             `+ ${n.budget.part}/part) — see audio/mixer.js BUDGET`);
      else ok(`${name}: ${n.total} nodes against a ceiling of ${n.cap}`);
      // and the shared rack must not grow with the SONG — that is the whole claim
      if (n.shared > n.budget.shared)
        fail(`the shared rack is ${n.shared} nodes, over its own ${n.budget.shared} ceiling — ` +
             `something per-song has leaked into the page-wide bus rack`);
    }
    // ELEVEN BOXES ASKING FOR A CHORUS BUILD ONE CHORUS. The sentence this
    // whole round exists to be able to say, read off the graph — as a DELTA,
    // because the rack is page-lifetime and never shrinks: whatever earlier
    // passes in this file built (the crunch the desk probe asked for) is still
    // standing, which is itself the point.
    const s0 = B.plain.sends, s = B.chorused.sends;
    const added = s.filter(k => !s0.includes(k));
    if (!s.includes("chorus"))
      fail(`${B.sections} boxes carrying the chorus chip built send buses ` +
           `${JSON.stringify(s)} — no chorus bus among them`);
    else if (added.length > 1)
      fail(`chorusing ${B.sections} boxes added ${added.length} buses ` +
           `(${JSON.stringify(s0)} -> ${JSON.stringify(s)}) — a character effect is ` +
           `supposed to exist once for the whole page`);
    else if (B.chorused.nodes.shared - B.plain.nodes.shared > 20)
      fail(`chorusing ${B.sections} boxes grew the shared rack by ` +
           `${B.chorused.nodes.shared - B.plain.nodes.shared} nodes — more than one bus`);
    else ok(`${B.sections} boxes carrying a chorus chip added at most one bus ` +
            `(${JSON.stringify(s0)} -> ${JSON.stringify(s)}, rack ` +
            `${B.plain.nodes.shared} -> ${B.chorused.nodes.shared})`);
    // THE NUMBER THAT ACTUALLY MOVED. Before this round a channel on this song
    // averaged 30.6 nodes (337 across eleven) because each carried a private
    // twelve-lane drum desk; after, 11.3. Twenty is the bar between them: a
    // regression that put any per-section rack back would cross it long before
    // the structural per-channel ceiling of 24 noticed.
    const cn = B.chorused.nodes;
    const mean = (cn.total - cn.shared) / cn.channels;
    // the twenty-node bar, with the DERIVED DESK accounted: the song now seats
    // a strip per part (audio/mixer.js derivedPartTone), and those nodes ride
    // inside the channel count — so the allowance is 20 for the section chain
    // plus the part budget for the strips the model actually built. A private
    // drum desk (18 nodes over budget) still crosses it.
    const allow = 20 + (cn.parts * cn.budget.part) / cn.channels;
    if (mean > allow)
      fail(`a channel averages ${mean.toFixed(1)} nodes on this song against an ` +
           `allowance of ${allow.toFixed(1)} (20 + ${cn.parts} derived/mixed part ` +
           `strips × ${cn.budget.part}) — something per-section has grown a rack again`);
    else ok(`a channel averages ${mean.toFixed(1)} nodes ` +
            `(allowance ${allow.toFixed(1)} with ${cn.parts} part strips; ` +
            `30.6 before the shared-rack round)`);
    const via = B.chorused.via;
    if (via.some(v => v !== "send"))
      fail(`channels spent a single blend chip as ${JSON.stringify(via)} — a lone chip is ` +
           `a send (fields.js fxSendable); only a chain or a sweep may take a rack`);
    else ok(`every one of the ${via.length} channels spent its chip as a send`);
    // ...AND NOT ONE OF THEM BUILT A DRUM DESK OF ITS OWN. The regression this
    // round exists to prevent, stated as the one thing that would undo it:
    // `kit` is null only when a channel owns a private twelve-lane desk.
    const own = B.plain.kit.filter(k => k === null).length;
    if (own) fail(`${own} of ${B.sections} channels built a PRIVATE kit desk — the lane ` +
                  `strips are the page's (graph.js buildKitDesk), and eleven copies of one ` +
                  `constant table is the 337-node channel this round removed`);
    else ok(`all ${B.sections} channels share the page's one kit desk`);
    // ...and the chorus cost the page a handful of nodes, not eleven racks
    const grew = B.chorused.nodes.total - B.plain.nodes.total;
    console.log(`  one chorus for the page : +${grew} nodes for ${B.sections} chorused boxes ` +
                `(${(grew / B.sections).toFixed(1)} each)`);
    if (grew > 4 * B.sections)
      fail(`chorusing every box cost ${grew} nodes — more than four a box means somebody ` +
           `is still building a copy of the effect per channel`);
    else ok(`chorusing every box cost ${grew} nodes: one bus plus a send and a trim each`);
  }

  // ---- (G) VELOCITY IS TIMBRE, NOT JUST LEVEL ------------------------------
  // See velProbe above for the claim and for why the control is the SAME
  // instrument in the one role that has no dynamic response.
  {
    if (vel.err) fail(`the dynamics probe could not run: ${vel.err}`);
    else {
      const shaped = corr(vel.soft.spec, vel.hard.spec);
      const flat = corr(vel.padSoft.spec, vel.padHard.spec);
      const level = corr(vel.hard.spec, vel.quiet.spec);
      const det = corr(vel.mid.spec, vel.midAgain.spec);
      console.log(`  ${vel.id} (${vel.fam}): v2/v9 shape ${shaped.toFixed(4)} — ` +
        `same note as a pad (no response) ${flat.toFixed(4)}, pure level ${level.toFixed(4)}, ` +
        `two identical renders ${det.toFixed(4)}`);

      // (a) THE MEASUREMENT IS STILL DETERMINISTIC. Everything below is a
      // difference between two renders, and it means nothing at all until the
      // same render twice is the same number.
      if (!(det > 0.9999)) fail(`two identical offline renders correlate ${det.toFixed(5)} — ` +
        `the probe is not deterministic, so no difference it reports is evidence`);
      else ok(`two identical renders of the same note correlate ${det.toFixed(5)}`);

      // (b) THE CLAIM. The nukernel-audio (E) discipline: the same sound twice
      // is ~0.995, a real treatment bends the shape to ~0.94. Measured here on
      // rock's crunch guitar — the MILDEST family in the table, because an
      // overdriven amp compresses — 0.952.
      if (!(shaped < 0.98))
        fail(`velocity 2 and velocity 9 of the same note correlate ${shaped.toFixed(4)} in ` +
             `SHAPE — that is two renders of one timbre at two levels, which is exactly the ` +
             `"no organic difference in the sound of the notes" this round exists to answer`);
      else ok(`velocity bends the spectrum, not just the fader: v2 vs v9 shape ${shaped.toFixed(4)}`);

      // (c) AND IT IS THE TREATMENT, NOT THE LEVEL. Two controls, both of which
      // have to stay near 1: the same instrument as a pad (the family with no
      // response — same velocities, same gain difference, same master limiter),
      // and a pure 10 dB gain change on the treated note. If either of those
      // moved as far as (b) did, (b) would be measuring the mix bus.
      if (!(flat > 0.99))
        fail(`the SAME note as a pad — a family with no dynamic response — still changed ` +
             `shape between velocity 2 and 9 (${flat.toFixed(4)}). Either "absent" is not ` +
             `absent, or (b) is measuring something downstream of the note`);
      else ok(`the untreated control holds: the same note as a pad is ${flat.toFixed(4)}`);
      if (!(level > 0.98))
        fail(`a pure level change moved the shape to ${level.toFixed(4)} — the shape ` +
             `correlation is not level-blind here, so (b) proves nothing`);
      else ok(`a pure level change leaves the shape at ${level.toFixed(4)}`);
      if (!(shaped < flat - 0.02))
        fail(`the treated pair (${shaped.toFixed(4)}) is not meaningfully further from 1 than ` +
             `the untreated pair (${flat.toFixed(4)}) — whatever moved, it was not the timbre`);
      else ok(`the treated pair sits ${(flat - shaped).toFixed(4)} further from 1 than the ` +
              `untreated one — the difference is timbre`);

      // (d) IN THE RIGHT DIRECTION. Harder is BRIGHTER; a shelf wired backwards
      // would bend the shape by exactly as much and sound wrong.
      const cent = (sp) => {
        let s = 0, t = 0;
        for (let i = 1; i < sp.length; i++) { s += sp[i] * i * (22050 / 512); t += sp[i]; }
        return t > 0 ? s / t : 0;
      };
      const cs = cent(vel.soft.spec), cm = cent(vel.mid.spec), ch = cent(vel.hard.spec);
      if (!(cs < cm && cm < ch))
        fail(`the spectral centroid does not rise with velocity (v2 ${cs.toFixed(0)} Hz, ` +
             `v5 ${cm.toFixed(0)}, v9 ${ch.toFixed(0)}) — harder must be brighter`);
      else ok(`harder is brighter, monotonically: centroid ${cs.toFixed(0)} -> ` +
              `${cm.toFixed(0)} -> ${ch.toFixed(0)} Hz`);

      // (e) WHAT IT COSTS, PER NOTE, COUNTED. One BiquadFilter on a note that
      // asked for a treatment and NOTHING on a note that did not — which is
      // also the byte-identity claim, as an artifact rather than as a promise:
      // at the default velocity the player builds the graph it always built,
      // and a family with no response builds it at every velocity.
      const N = vel.mid.perNote;
      console.log(`  per-note nodes: ${N} at the default velocity, ${vel.hard.perNote} shaped, ` +
                  `${vel.padMid.perNote} on the untreated pad`);
      if (!(vel.soft.played && vel.hard.played && vel.mid.played))
        fail("a probe note did not play at all — the readings above are of silence");
      else if (vel.hard.perNote !== N + 1 || vel.soft.perNote !== N + 1)
        fail(`a shaped note costs ${vel.hard.perNote - N} extra node(s), not one ` +
             `(default ${N}, v2 ${vel.soft.perNote}, v9 ${vel.hard.perNote}) — the whole ` +
             `per-note budget of this feature is one shelf`);
      else ok(`a shaped note costs exactly one extra AudioNode (${N} -> ${N + 1})`);
      if (vel.padSoft.perNote !== vel.padMid.perNote ||
          vel.padHard.perNote !== vel.padMid.perNote)
        fail(`a family with NO dynamic response still built a node at velocity 2/9 ` +
             `(${vel.padSoft.perNote}/${vel.padMid.perNote}/${vel.padHard.perNote}) — ` +
             `absent must mean the old path exactly`);
      else ok(`a family with no response builds nothing extra at any velocity ` +
              `(${vel.padMid.perNote} nodes throughout)`);

      // (f) …and the live page really is on the treated path. The renders above
      // are offline; this is the counter the playing graph incremented while
      // pass() was looping a verse, and the flag that would have turned it off.
      if (vel.dyn.off) fail("?flatvel is on — this whole section measured the page with the " +
        "audio tier of dynamics disabled");
      else if (!(vel.dyn.shaped > 0))
        fail(`__nuDyn reports ${vel.dyn.shaped} shaped notes — nothing on the LIVE path took ` +
             `the treatment, whatever the offline renders say`);
      else ok(`the live pass shaped ${vel.dyn.shaped} notes and left ${vel.dyn.flat} at the ` +
              `default velocity alone`);
    }
  }

  // ---- (H) THE SINGER IS IN TUNE ------------------------------------------
  {
    if (singChip.err) fail(`the palette: ${singChip.err} — the whole feature is unreachable`);
    else if (singChip.held !== "duet")
      fail(`clicking the sing chip left the box holding ${JSON.stringify(singChip.held)}`);
    else if (!singChip.on) fail("the sing chip did not light when it was switched on");
    else if (singChip.off !== null)
      fail(`re-tapping the lit sing chip left ${JSON.stringify(singChip.off)}, not null`);
    else ok("the sing chip is on the voice tab, lights, writes the box and clears");

    if (sing.err) fail(`the sing probe could not run: ${sing.err}`);
    else {
      console.log(`  sings "${sing.text}" — box ${sing.box + 1}, ${sing.planned} planned ` +
                  `syllables, ${sing.stats.utterances} espeak utterances in ${sing.warmMs} ms`);

      // (a) EVERY PLANNED SYLLABLE ACTUALLY PLAYED. A warm that silently
      // produced nothing for half the line would still pass a pitch check on
      // the half it did produce.
      const played = sing.rows.filter(r => r.played).length;
      if (played !== sing.rows.length)
        fail(`only ${played} of ${sing.rows.length} planned syllables played — ` +
             `playSyllable found no warmed slice for the rest`);
      else ok(`all ${played} planned syllables played`);
      const silent = sing.rows.filter(r => r.played && r.rms < 1e-4).length;
      if (silent) fail(`${silent} syllables played but rendered silence`);
      else ok("every sung syllable is real audio");

      // (b) THE PITCH IS THE NOTE. Measured on the RENDERED audio, on the
      // slices whose F0 the detector could read in the first place.
      const good = sing.rows.filter(r => r.measurable && r.got != null && r.voiced > 0.3);
      const errs2 = good.map(r => Math.abs(r.err)).sort((a, b) => a - b);
      const q = (f) => errs2[Math.min(errs2.length - 1, Math.floor(errs2.length * f))];
      if (errs2.length < 4)
        fail(`only ${errs2.length} sung syllables were measurable — the pitch claim ` +
             `cannot be made on this song`);
      else {
        // THE WORST IS PRINTED AND NOT ASSERTED ON, and the reason is a
        // measurement fact rather than a tolerance: the detector occasionally
        // locks an octave out on a 60 ms resampled clip, which shows up as a
        // 12-to-16 semitone reading among a run of 0.06s. The MEDIAN and the
        // P75 are the statistics that cannot be moved by one bad estimate, so
        // those are the bars; the count past a semitone is the evidence of how
        // often the detector, not the singer, missed.
        const wild = errs2.filter(e => e > 1).length;
        console.log(`  pitch error over ${errs2.length} rendered syllables: ` +
                    `median ${q(0.5).toFixed(3)}, p75 ${q(0.75).toFixed(3)}, ` +
                    `worst ${errs2[errs2.length - 1].toFixed(3)} semitones` +
                    (wild ? `  (${wild} past a semitone — detector octave slips)` : ""));
        // THE TOLERANCE, and where it comes from: the same chain measured
        // numerically in node over 641 (line × rung × note) combinations gave
        // median 0.009 and p90 0.090 semitones. A quarter tone (0.5) is the
        // ear's own "is it in tune" line, and the median has to be far inside
        // it or the bend is not working; the p75 is what catches a systematic
        // offset that a median could ride out.
        if (q(0.5) > 0.5)
          fail(`the median sung syllable is ${q(0.5).toFixed(2)} semitones off its note — ` +
               `the clip-snap is not landing (check that cutSyllables is cutting on the ` +
               `phoneme nuclei and that the ladder in sing.js still matches the artifact)`);
        else ok(`the sung pitch tracks the melody: median ${q(0.5).toFixed(3)} semitones off`);
        if (q(0.75) > 1.0)
          fail(`a quarter of sung syllables are more than a semitone off ` +
               `(p75 ${q(0.75).toFixed(2)}) — a systematic bias, not noise`);
        else ok(`p75 pitch error ${q(0.75).toFixed(3)} semitones, inside a semitone`);
      }
      const unmeasurable = sing.rows.filter(r => !r.measurable).length;
      console.log(`  ..: ${unmeasurable}/${sing.rows.length} slices fell back to the ` +
                  `ladder (no detectable F0 in a 40-60 ms slice)`);

      // (c) TWO VOICES, AND THEY DIFFER BY THE INTENDED INTERVAL. The plan's
      // interval and the FOLDED interval are not the same number — each voice
      // folds into its own range — so what is asserted is the folded one,
      // which is what the ear hears.
      if (!sing.pairs.length) fail("no syllable was sung by both voices — duet is not a duet");
      else {
        console.log(`  duet intervals (heard/intended): ` +
                    sing.pairs.map(p => `${p.gotHeard.toFixed(1)}/${p.wantHeard.toFixed(1)}` +
                      (p.read ? "" : "*")).join(" ") +
                    (sing.pairs.some(p => !p.read) ? "   (* not read — see below)" : ""));
        const usable = sing.pairs.filter(p => p.read);
        const bad = usable.filter(p => Math.abs(p.gotHeard - p.wantHeard) > 1.0);
        if (usable.length < 2)
          fail(`only ${usable.length} of ${sing.pairs.length} duet pairs came back readable — ` +
               `the harmony claim cannot be made on this song, which is itself a finding: ` +
               `the syllables are too short for the detector`);
        else if (bad.length)
          fail(`${bad.length} of ${usable.length} readable duet intervals came out more than ` +
               `a semitone from the intended one — the two voices are not singing the ` +
               `harmony the chart chose`);
        else ok(`all ${usable.length} readable duet intervals land within a semitone of the ` +
                `intended one (${sing.pairs.length - usable.length} pair(s) unread)`);
        // ...and the two voices are genuinely two: identical output would give
        // a heard interval of exactly zero on every pair
        if (sing.pairs.filter(p => p.read).every(p => Math.abs(p.gotHeard) < 0.1))
          fail("both voices sang the same pitch on every note — the f3 variant is not " +
               "applying, so engine/speech.js's lang option is not reaching set_voice");
        else ok("the two voices are two");
      }

      // (d) THE VOCODER COLOUR: in tune by construction, and audible
      if (!sing.vocRows.length) fail("the vocoder colour rendered nothing");
      else {
        // NO OCTAVE SLACK. The carrier is built at a KNOWN midi (audio/sing.js
        // vocMidiOf, which is robot_choir's octave-down law re-floored so the
        // carrier stays inside the detector's 65..520 Hz window and inside a
        // phone speaker) and the probe reports it, so the comparison is exact.
        const off = sing.vocRows.map(v => Math.abs(v.got - v.want));
        console.log(`  vocoder: want ${sing.vocRows.map(v => v.want.toFixed(1)).join(" ")} ` +
                    `got ${sing.vocRows.map(v => v.got.toFixed(1)).join(" ")} ` +
                    `(octave-folded error ${off.map(o => o.toFixed(2)).join(" ")})`);
        if (sing.vocRows.some(v => v.rms < 1e-4)) fail("a vocoded syllable is silent");
        else ok(`the vocoder colour renders audio (${sing.vocRows.length} notes)`);
        // the carrier is BUILT at the target, so this one has no measurement
        // slack to spend: anything past a quarter tone means the carrier
        // frequency is wrong, not that the detector wobbled
        const worst = Math.max(...off);
        if (worst > 0.5)
          fail(`the vocoded pitch is ${worst.toFixed(2)} semitones off its note (folded to ` +
               `the nearest octave) — the carrier is not being built at the target`);
        else ok(`the vocoder is in tune by construction (worst ${worst.toFixed(3)} semitones)`);
      }

      // (e) A HELD NOTE SUSTAINS. The natural syllable is 0.10-0.12 s; a 1 s
      // note has to be singing at 0.85 s or the vowel loop is dead code and
      // the line is a stutter.
      if (!sing.hold) fail("the hold probe did not run");
      else {
        const ratio = sing.hold.tail / Math.max(1e-9, sing.hold.head);
        console.log(`  held note: head ${sing.hold.head.toFixed(4)} tail ` +
                    `${sing.hold.tail.toFixed(4)} (${(ratio * 100).toFixed(0)}%)`);
        if (!(sing.hold.tail > 0.02 * sing.hold.head))
          fail(`a 1 s sung note is silent three quarters of the way through — the vowel ` +
               `stretch is not firing and every long note is a 0.11 s blip`);
        else ok(`a held note sustains to its end (${(ratio * 100).toFixed(0)}% of its own head)`);
      }

      // (f) DETERMINISM, end to end
      if (!sing.same) fail("two renders of the same sung note differ — the chain is not " +
        "deterministic, so node press and the browser would not hear the same take");
      else ok("the same sung note renders identically twice");

      // (g) WHAT IT COSTS PER NOTE, COUNTED on the context the note is built
      // on. Two: one AudioBufferSourceNode and one GainNode. The sampled path
      // measured on this same page costs ~7.5.
      // THREE create* CALLS, TWO OF WHICH ARE NODES. __countNodes wraps every
      // create* on the context, and createBuffer is one of them — it allocates
      // Float32s and joins no graph. So the honest reading of 3 is: one buffer
      // allocation, one AudioBufferSourceNode, one GainNode. Counting it is
      // right (a per-note allocation is a real cost) and calling it a node
      // would not be; the number is asserted rather than the label.
      const pn = [...new Set(sing.rows.filter(r => r.played).map(r => r.perNote))];
      if (pn.length !== 1 || pn[0] !== 3)
        fail(`a sung note costs ${pn.join("/")} create* calls, not 3 — the whole per-note ` +
             `budget of this feature is one buffer, one source and one gain`);
      else ok("a sung note costs 1 buffer + 2 AudioNodes (source + envelope gain)");
      const vpn = [...new Set(sing.vocRows.map(v => v.perNote))];
      if (vpn.length && (vpn.length !== 1 || vpn[0] !== 3))
        fail(`a VOCODED note costs ${vpn.join("/")} create* calls — the vocoder is supposed ` +
             `to happen in the buffer domain and add no graph at all`);
      else ok("the vocoder adds no nodes: it is buffer-domain (same 3 as natural)");
      console.log(`  warm cost: ${sing.stats.utterances} utterances, ` +
                  `${sing.stats.slices} slices, ${sing.stats.failed} failed lines`);
      if (sing.stats.failed) fail(`${sing.stats.failed} utterance(s) came back with a ` +
        `syllable count the plan did not expect — every word after the divergence would ` +
        `land on the wrong note`);
      else ok("every utterance cut into exactly the syllables the plan laid out");
    }
  }

  // ---- (M) THE MACHINES ---------------------------------------------------
  // The score-level half (genre→kit, every lane resolving to a real parent
  // module, the model names held against state-engine's own maps, the schedule
  // not moving) is test/unit/nukernel.test.js §44. Here: only what WebAudio
  // can witness — that the module the table names actually SOUNDS, live.
  {
    if (mach.err) fail(`machines probe: ${mach.err}`);
    else {
      if (mach.machines.length < 4)
        fail(`DRUMKITS carries only ${mach.machines.length} machine kit(s) ` +
             `(${mach.machines.join(",")}) — tr808/tr909/tr606/cr78 expected`);
      else ok(`DRUMKITS carries the machines: ${mach.machines.join(", ")}`);
      // (a) EVERY MACHINE LANE SOUNDS through the real chain: the worklet
      // built, the hit accepted, and the analyser hearing it. Silence here is
      // the one failure this round exists to make impossible — a lane routed
      // to nothing used to fall back on a second drum engine.
      for (const kit of mach.machines) {
        const row = mach.kits[kit];
        if (!mach.ready[kit])
          fail(`${kit}: warmKit left a lane without its parent module — ` +
               `the first hits of the song would drop`);
        const silent = mach.lanes.filter(d => !row[d].played || !(row[d].peak > 2e-3));
        const clipped = mach.lanes.filter(d => row[d].peak > 1.02);
        if (silent.length)
          fail(`${kit}: lane(s) ${silent.join(",")} made no sound — a lane a genre ` +
               `can write and this machine cannot voice is a silent drum`);
        else if (clipped.length)
          fail(`${kit}: lane(s) ${clipped.join(",")} rang over full scale ` +
               `(worst ${Math.max(...clipped.map(d => row[d].peak))}) — clipping`);
        else {
          const min = Math.min(...mach.lanes.map(d => row[d].peak));
          const pk = Math.max(...mach.lanes.map(d => row[d].peak));
          ok(`${kit}: all ${mach.lanes.length} lanes sound through ` +
             `${[...new Set(mach.modules[kit])].join("/")} ` +
             `(quietest rms ${min.toFixed(4)}, loudest ${pk.toFixed(4)})`);
        }
      }
      // (b) THE MACHINE'S OWN MIX ROW, read off the node
      if (!mach.strip.built || mach.strip.room == null ||
          Math.abs(mach.strip.room - mach.strip.want) > 1e-3)
        fail(`the 808 hat has no strip of its own (${JSON.stringify(mach.strip)}) — ` +
             `MACHINEMIX never reached the desk`);
      else ok(`a machine lane rides its own row: 808 hat room ${mach.strip.room} ` +
              `against the sampled kit's ${mach.strip.base}`);
    }
    // (c) TWO BOUNCE RENDERS OF THE SAME MACHINE SONG ARE THE SAME TAKE.
    // "Same" is held to a FLOAT-NOISE fence, not the last bit, and the fence
    // is measured rather than wished: the machine's voices are the parent's
    // precompiled modules, driven from one table (unit §44) — but a whole
    // windowed tape
    // through chromium's offline pipeline measured a worst window ΔRMS of
    // 3.8e-6 (one window of 64, peaks byte-identical) across two cold
    // renders, which is −108 dB of arithmetic and not a take. A REAL
    // difference — one moved hit, one late note — moves a 4 s window's RMS at
    // the 1e-2 scale, three orders past the fence.
    if (btw.err) fail(`bounce determinism: ${btw.err}`);
    else {
      let worst = 0;
      for (let i = 0; i < Math.min(btw.rmsA.length, btw.rmsB.length); i++)
        worst = Math.max(worst, Math.abs(btw.rmsA[i] - btw.rmsB[i]));
      const same = btw.rmsA.length === btw.rmsB.length &&
        worst <= 1e-5 && btw.peakA === btw.peakB;
      if (!same)
        fail(`two cold bounce renders of the 909 song differ (worst window ` +
             `ΔRMS ${worst.toExponential(2)}, peaks ${btw.peakA}/${btw.peakB}) — ` +
             `the carrier is not the take the desk heard`);
      else ok(`two cold bounce renders are the same take: ${btw.rmsA.length} RMS ` +
              `windows within ${worst.toExponential(1)} and one peak (${btw.peakA}) ` +
              `over ${btw.durSec.toFixed(1)} s`);
    }
  }

  // ---- (E) NOTHING ELSE MOVED ---------------------------------------------
  {
    // the shape the OTHER gate reads. Both files walk the same __nuMix; keeping
    // the old keys is a contract, and adding to them is the only allowed change.
    const c = wet.mix.channels[0];
    const need = ["fx", "stages", "motion", "rev", "del", "level", "pan", "verb", "key", "auto"];
    const gone = need.filter(k => !(k in c));
    if (gone.length) fail(`__nuMix channels lost key(s) ${gone.join(",")} — ` +
      `nukernel-audio.test.js reads every one of them`);
    else ok("__nuMix still carries the keys the audio gate reads");
    // …and the desk is an ADDED key, always present, empty until mixed
    if (!Array.isArray(c.parts))
      fail(`__nuMix channels have no \`parts\` array (${JSON.stringify(c.parts)})`);
    else ok(`__nuMix carries the desk as an added key (${c.parts.length} strips on an ` +
            `unmixed box)`);
    if (wet.peak < 0.01) fail(`the song is silent (peak RMS ${wet.peak.toFixed(4)})`);
    else ok(`the song plays with the treatment on: peak RMS ${wet.peak.toFixed(4)}`);
    if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(" | ")}`);
    else ok("no page errors");
  }

  await browser.close(); await srv.close();
  console.log(`\nnukernel-drums: ${checks} checks` +
              (process.exitCode ? " — FAILURES ABOVE" : " pass"));
})().catch((e) => { console.error("FAIL:", e && e.stack || e); process.exit(1); });
