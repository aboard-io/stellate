// audio/machines.js — the CLASSIC DRUM MACHINES, synthesized. Four DRUMKITS
// entries (fields.js) that are not directories under found/samples/drums/:
// tr808, tr909, tr606 and cr78 are RENDERED, once, into the same AudioBuffers
// a decoded kit lands in (assets.js drumBufs "kit|lane"), so downstream of
// loadKit a machine IS a kit — same playDrum, same lane strips, same room
// sends, same transient shaping, same swing. No player learns a second path.
//
// WHY BUFFERS AND NOT LIVE OSCILLATORS. A per-hit oscillator patch is the
// "sine and some noise" fallback this page already has and the audio gate
// already fails on; a pre-rendered hit is (1) one AudioBufferSourceNode per
// hit, exactly what a sampled kit costs, (2) CONTEXT-FREE — the same trick
// graph.js pulls with the reverb impulses: one buffer serves the live graph
// and every OfflineAudioContext the bounce opens, so the carrier strikes the
// identical kick — and (3) deterministic by construction, because the whole
// synthesis runs once, off the render path, from a SEEDED noise source. No
// Math.random per trigger; two loads of the same machine are byte-equal
// (test/browser/nukernel-drums.test.js (M) holds laneSamples to it).
//
// EVERY LANE VOICES ON EVERY MACHINE — the house law ("any lane a genre can
// write and this map cannot name is a silent drum"). Where the hardware had no
// such voice, the nearest one stands in and says so beside its recipe: ride
// and crash on the 808 are its cymbal bank rung long, the 606's clap is a
// thinned snare-noise clap, the CR-78's toms are its bongo/conga family.
//
// Layer graph: deps -> state -> derive -> THIS FILE -> graph -> assets ->
// voices. Imports only deps (for DRUMMIX, whose rows MACHINEMIX rides);
// everything else here is arithmetic over Float32Arrays.
import { DRUMMIX } from "../ui/deps.js";

// Rendered at the page's own pinned rate (graph.js initAudio: 44100, the
// precondition the offline bounce shares), so no resample path ever runs.
const SR = 44100;

/* ---------- deterministic noise ---------- */
// FNV-1a over "kit|lane" -> mulberry32. Each lane's noise differs (a clap and
// a snare must not share a take) and every load is the same take — the espeak
// fresh-instance law, applied to a noise generator.
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/* ---------- primitives ---------- */
const env = (t, tau) => Math.exp(-t / tau);
const alloc = sec => new Float32Array(Math.ceil(sec * SR));

// A SINE WITH A PITCH DROP is most of what an analog drum voice is: the
// bridged-T oscillator kicked above its resting pitch and falling back. f0 ->
// f1 on `ptau`, amplitude on `tau`, an optional second harmonic for skin/wood
// and an optional tanh stage for the transistor.
function drop(out, o) {
  const { f0, f1, ptau, tau, gain = 1, atk = 0.0006, harm2 = 0, drive = 0 } = o;
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / ptau);
    ph += 2 * Math.PI * f / SR;
    let v = Math.sin(ph);
    if (harm2) v += harm2 * Math.sin(2 * ph) * env(t, tau * 0.5);
    v *= gain * env(t, tau) * Math.min(1, t / atk);
    out[i] += drive ? Math.tanh(v * (1 + drive)) / Math.tanh(1 + drive) : v;
  }
}
// seeded noise under an exponential envelope, offset into the buffer — the
// offset is what a clap is (several bursts a few ms apart)
function burst(rand, out, o) {
  const { at = 0, tau, len, gain = 1, atk = 0.0004 } = o;
  const i0 = Math.floor(at * SR);
  const n = Math.min(out.length, i0 + Math.ceil((len || tau * 7) * SR));
  for (let i = i0; i < n; i++) {
    const t = (i - i0) / SR;
    out[i] += rand() * gain * env(t, tau) * Math.min(1, t / atk);
  }
}
// THE METALLIC BANK — six square waves at the 808 cymbal circuit's own
// frequencies, summed and (by the caller) high-passed hard. The naive squares
// alias at this rate on purpose: the fold-back products are inharmonic
// partials, which is what a cymbal is made of.
function bankOsc(out, o) {
  const { freqs, tau, gain = 1, detune = 1, atk = 0.0004 } = o;
  const w = freqs.map(f => 2 * Math.PI * f * detune / SR);
  const ph = new Float64Array(w.length);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < w.length; k++) { ph[k] += w[k]; v += Math.sin(ph[k]) > 0 ? 1 : -1; }
    out[i] += (v / w.length) * gain * env(t, tau) * Math.min(1, t / atk);
  }
}
const BANK808 = [205.3, 304.4, 369.6, 522.7, 540, 800];
const BANK606 = [325, 415, 507, 645, 795, 1047];

// in-place RBJ biquad — the one filter shape everything here needs, run over
// the finished component rather than per sample of the mix
function filt(buf, type, f0, Q, dbGain = 0) {
  const A = Math.pow(10, dbGain / 40), w0 = 2 * Math.PI * f0 / SR;
  const cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lp") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === "hp") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === "bp") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else { /* peak */ b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y;
  }
}
// component into the mix: synthesize into a scratch, filter it, add it
function add(out, sec, build, filters) {
  const tmp = alloc(Math.min(sec, out.length / SR));
  build(tmp);
  if (filters) for (const f of filters) filt(tmp, ...f);
  for (let i = 0; i < tmp.length; i++) out[i] += tmp[i];
}

/* ---------- the machines ---------- */
// One builder per lane per machine: (out, rand) over a buffer whose length is
// the recipe's own. Levels inside a recipe are the INTERNAL balance of its
// components; the finished lane is peak-normalized like the sampled one-shots
// it sits beside, and the machine's place in the mix is MACHINEMIX below —
// the same division of labour the sampled kits have with DRUMMIX.
const R = {
  tr808: {
    // the famous boom: a long sine falling 160 -> 52, warm tanh, and the
    // trigger click that is the only attack an 808 kick has
    k: [1.0, (out, rand) => {
      drop(out, { f0: 160, f1: 52, ptau: 0.035, tau: 0.30, gain: 1, drive: 0.6 });
      add(out, 0.012, t => burst(rand, t, { tau: 0.003, gain: 0.30 }), [["hp", 1400, 0.8]]);
    }],
    // papery: two tuned tones under a soft bandpassed noise
    s: [0.30, (out, rand) => {
      drop(out, { f0: 176, f1: 176, ptau: 1, tau: 0.045, gain: 0.55 });
      drop(out, { f0: 236, f1: 236, ptau: 1, tau: 0.040, gain: 0.40 });
      add(out, 0.30, t => burst(rand, t, { tau: 0.085, gain: 0.85 }),
          [["hp", 700, 0.7], ["lp", 6800, 0.7]]);
    }],
    c: [0.45, (out, rand) => {
      add(out, 0.45, t => {
        for (const at of [0, 0.011, 0.022, 0.031]) burst(rand, t, { at, tau: 0.008, gain: 0.9 });
        burst(rand, t, { at: 0.026, tau: 0.09, gain: 0.55 });
      }, [["bp", 1100, 1.2], ["hp", 500, 0.7]]);
    }],
    // the 808 rimshot's bridged-T pair: a click at 1.7k over a knock at 445
    p: [0.07, (out) => {
      drop(out, { f0: 1750, f1: 1750, ptau: 1, tau: 0.006, gain: 0.9 });
      drop(out, { f0: 445, f1: 445, ptau: 1, tau: 0.009, gain: 0.6 });
      filt(out, "hp", 300, 0.7);
    }],
    h: [0.14, out => { bankOsc(out, { freqs: BANK808, tau: 0.028, gain: 1 });
                       filt(out, "hp", 7000, 0.7); filt(out, "hp", 7000, 0.7); }],
    o: [0.55, out => { bankOsc(out, { freqs: BANK808, tau: 0.14, gain: 1 });
                       filt(out, "hp", 6800, 0.7); filt(out, "hp", 6800, 0.7); }],
    f: [0.09, out => { bankOsc(out, { freqs: BANK808, tau: 0.018, gain: 0.8 });
                       filt(out, "hp", 7200, 0.7); filt(out, "hp", 7200, 0.7); }],
    // NO RIDE ON THE HARDWARE — the cymbal bank rung long is the nearest
    // voice, and it is the honest one: an 808 "ride" on record IS this
    r: [1.4, (out, rand) => {
      bankOsc(out, { freqs: BANK808, tau: 0.45, gain: 0.8 });
      add(out, 1.4, t => burst(rand, t, { tau: 0.5, gain: 0.25 }), [["hp", 6000, 0.7]]);
      filt(out, "hp", 5500, 0.7);
    }],
    x: [1.9, (out, rand) => {
      bankOsc(out, { freqs: BANK808, tau: 0.65, gain: 0.8, detune: 1.24 });
      add(out, 1.9, t => burst(rand, t, { tau: 0.7, gain: 0.45 }), [["hp", 4200, 0.7]]);
      filt(out, "hp", 3800, 0.7);
    }],
    // the conga/tom family: pure drops with a breath of skin noise
    t: [0.38, (out, rand) => { drop(out, { f0: 200, f1: 148, ptau: 0.06, tau: 0.12, gain: 1 });
      add(out, 0.03, tb => burst(rand, tb, { tau: 0.012, gain: 0.18 }), [["lp", 2200, 0.7]]); }],
    m: [0.45, (out, rand) => { drop(out, { f0: 138, f1: 100, ptau: 0.06, tau: 0.16, gain: 1 });
      add(out, 0.03, tb => burst(rand, tb, { tau: 0.012, gain: 0.16 }), [["lp", 1800, 0.7]]); }],
    l: [0.55, (out, rand) => { drop(out, { f0: 95, f1: 68, ptau: 0.07, tau: 0.20, gain: 1 });
      add(out, 0.03, tb => burst(rand, tb, { tau: 0.014, gain: 0.14 }), [["lp", 1500, 0.7]]); }],
  },

  tr909: {
    // harder everything: a fast 280 -> 51 sweep into real saturation, with a
    // noise click on the front — the kick that cuts through a warehouse
    k: [0.6, (out, rand) => {
      drop(out, { f0: 280, f1: 51, ptau: 0.020, tau: 0.15, gain: 1, drive: 1.4 });
      add(out, 0.008, t => burst(rand, t, { tau: 0.0025, gain: 0.5 }), [["hp", 1500, 0.8]]);
    }],
    // snappy: the noise leads, bright, with a 5k lift; the tones are shorter
    // than the 808's and sit under it
    s: [0.34, (out, rand) => {
      drop(out, { f0: 185, f1: 185, ptau: 1, tau: 0.042, gain: 0.5 });
      drop(out, { f0: 330, f1: 330, ptau: 1, tau: 0.035, gain: 0.3 });
      add(out, 0.34, t => burst(rand, t, { tau: 0.115, gain: 1.15 }),
          [["hp", 900, 0.7], ["peak", 5000, 0.9, 3]]);
    }],
    c: [0.42, (out, rand) => {
      add(out, 0.42, t => {
        for (const at of [0, 0.010, 0.020, 0.029]) burst(rand, t, { at, tau: 0.0065, gain: 0.95 });
        burst(rand, t, { at: 0.024, tau: 0.075, gain: 0.6 });
      }, [["bp", 1400, 1.1], ["hp", 600, 0.7]]);
    }],
    p: [0.06, (out, rand) => {
      drop(out, { f0: 510, f1: 510, ptau: 1, tau: 0.005, gain: 0.9 });
      add(out, 0.01, t => burst(rand, t, { tau: 0.002, gain: 0.5 }), [["hp", 2000, 0.8]]);
      filt(out, "hp", 400, 0.7);
    }],
    // 909 hats are noisier than the 808's ringing bank: bank + a noise layer
    h: [0.12, (out, rand) => {
      bankOsc(out, { freqs: BANK808, tau: 0.022, gain: 0.8, detune: 1.18 });
      add(out, 0.12, t => burst(rand, t, { tau: 0.02, gain: 0.5 }), [["hp", 8000, 0.7]]);
      filt(out, "hp", 7800, 0.7);
    }],
    o: [0.6, (out, rand) => {
      bankOsc(out, { freqs: BANK808, tau: 0.16, gain: 0.8, detune: 1.18 });
      add(out, 0.6, t => burst(rand, t, { tau: 0.18, gain: 0.5 }), [["hp", 7500, 0.7]]);
      filt(out, "hp", 7200, 0.7);
    }],
    f: [0.08, (out, rand) => {
      bankOsc(out, { freqs: BANK808, tau: 0.015, gain: 0.7, detune: 1.18 });
      add(out, 0.08, t => burst(rand, t, { tau: 0.014, gain: 0.4 }), [["hp", 8200, 0.7]]);
      filt(out, "hp", 8000, 0.7);
    }],
    // the 909's cymbals were samples; shimmer noise plus a stick ping is the
    // synthesized reading of the same idea
    r: [1.6, (out, rand) => {
      add(out, 1.6, t => burst(rand, t, { tau: 0.55, gain: 0.5 }), [["hp", 5200, 0.7]]);
      bankOsc(out, { freqs: BANK808, tau: 0.5, gain: 0.4, detune: 1.31 });
      drop(out, { f0: 1250, f1: 1250, ptau: 1, tau: 0.25, gain: 0.22 });
      filt(out, "hp", 3000, 0.7);
    }],
    x: [2.0, (out, rand) => {
      add(out, 2.0, t => burst(rand, t, { tau: 0.8, gain: 0.7 }), [["hp", 3600, 0.7]]);
      bankOsc(out, { freqs: BANK808, tau: 0.7, gain: 0.5, detune: 1.31 });
      filt(out, "hp", 3000, 0.7);
    }],
    t: [0.34, (out, rand) => { drop(out, { f0: 220, f1: 158, ptau: 0.045, tau: 0.11, gain: 1, drive: 0.5 });
      add(out, 0.02, tb => burst(rand, tb, { tau: 0.008, gain: 0.3 }), [["lp", 3000, 0.7]]); }],
    m: [0.40, (out, rand) => { drop(out, { f0: 150, f1: 108, ptau: 0.05, tau: 0.14, gain: 1, drive: 0.5 });
      add(out, 0.02, tb => burst(rand, tb, { tau: 0.008, gain: 0.26 }), [["lp", 2600, 0.7]]); }],
    l: [0.48, (out, rand) => { drop(out, { f0: 104, f1: 75, ptau: 0.055, tau: 0.17, gain: 1, drive: 0.5 });
      add(out, 0.02, tb => burst(rand, tb, { tau: 0.010, gain: 0.22 }), [["lp", 2200, 0.7]]); }],
  },

  tr606: {
    // thin and quick — the drumatix kick is mid-forward, no boom at all
    k: [0.32, (out, rand) => {
      drop(out, { f0: 165, f1: 58, ptau: 0.025, tau: 0.10, gain: 1, drive: 0.3 });
      add(out, 0.006, t => burst(rand, t, { tau: 0.002, gain: 0.2 }), [["hp", 1600, 0.8]]);
    }],
    s: [0.20, (out, rand) => {
      drop(out, { f0: 185, f1: 185, ptau: 1, tau: 0.030, gain: 0.4 });
      drop(out, { f0: 330, f1: 330, ptau: 1, tau: 0.026, gain: 0.28 });
      add(out, 0.20, t => burst(rand, t, { tau: 0.055, gain: 1.05 }),
          [["hp", 1200, 0.7], ["lp", 9000, 0.7]]);
    }],
    // NO CLAP ON THE HARDWARE — a thinned, brightened synth clap is the
    // nearest voice this machine can offer
    c: [0.32, (out, rand) => {
      add(out, 0.32, t => {
        for (const at of [0, 0.010, 0.021]) burst(rand, t, { at, tau: 0.006, gain: 0.85 });
        burst(rand, t, { at: 0.018, tau: 0.06, gain: 0.45 });
      }, [["bp", 1300, 1.3], ["hp", 700, 0.7]]);
    }],
    p: [0.05, out => {
      drop(out, { f0: 1000, f1: 1000, ptau: 1, tau: 0.004, gain: 0.9 });
      drop(out, { f0: 480, f1: 480, ptau: 1, tau: 0.006, gain: 0.5 });
      filt(out, "hp", 350, 0.7);
    }],
    // the famous ones: an edgier, higher bank than the 808's, sizzling
    h: [0.10, out => { bankOsc(out, { freqs: BANK606, tau: 0.018, gain: 1 });
                       filt(out, "hp", 8000, 0.7); filt(out, "hp", 8000, 0.7); }],
    o: [0.65, out => { bankOsc(out, { freqs: BANK606, tau: 0.22, gain: 1 });
                       filt(out, "hp", 7600, 0.7); filt(out, "hp", 7600, 0.7); }],
    f: [0.07, out => { bankOsc(out, { freqs: BANK606, tau: 0.013, gain: 0.8 });
                       filt(out, "hp", 8200, 0.7); filt(out, "hp", 8200, 0.7); }],
    // cymbal: the 606 did carry one — bank long with a noise sheen
    r: [1.2, (out, rand) => {
      bankOsc(out, { freqs: BANK606, tau: 0.35, gain: 0.8 });
      add(out, 1.2, t => burst(rand, t, { tau: 0.4, gain: 0.3 }), [["hp", 6000, 0.7]]);
      filt(out, "hp", 5600, 0.7);
    }],
    x: [1.6, (out, rand) => {
      bankOsc(out, { freqs: BANK606, tau: 0.55, gain: 0.8, detune: 1.19 });
      add(out, 1.6, t => burst(rand, t, { tau: 0.6, gain: 0.45 }), [["hp", 4600, 0.7]]);
      filt(out, "hp", 4200, 0.7);
    }],
    t: [0.30, out => drop(out, { f0: 190, f1: 142, ptau: 0.045, tau: 0.10, gain: 1 })],
    m: [0.36, out => drop(out, { f0: 140, f1: 105, ptau: 0.05, tau: 0.13, gain: 1 })],
    l: [0.42, out => drop(out, { f0: 100, f1: 75, ptau: 0.055, tau: 0.16, gain: 1 })],
  },

  cr78: {
    // softer, woodier, shorter everything: the CompuRhythm's kick is a
    // bongo-adjacent thump, not a boom — small drop, soft front, dark
    k: [0.28, out => {
      drop(out, { f0: 96, f1: 70, ptau: 0.05, tau: 0.085, gain: 1, atk: 0.002, harm2: 0.15 });
      filt(out, "lp", 1300, 0.7);
    }],
    s: [0.17, (out, rand) => {
      drop(out, { f0: 240, f1: 240, ptau: 1, tau: 0.040, gain: 0.45, atk: 0.001 });
      add(out, 0.17, t => burst(rand, t, { tau: 0.045, gain: 0.9, atk: 0.001 }),
          [["hp", 450, 0.7], ["lp", 4800, 0.7]]);
    }],
    // NO CLAP ON THE HARDWARE — the tambourine is its nearest hand
    c: [0.22, (out, rand) => {
      add(out, 0.22, t => {
        burst(rand, t, { at: 0, tau: 0.02, gain: 0.9 });
        burst(rand, t, { at: 0.016, tau: 0.035, gain: 0.6 });
      }, [["bp", 4500, 1.5], ["hp", 2500, 0.7]]);
    }],
    p: [0.05, out => {
      drop(out, { f0: 1100, f1: 1100, ptau: 1, tau: 0.005, gain: 0.8, harm2: 0.3 });
      drop(out, { f0: 560, f1: 560, ptau: 1, tau: 0.007, gain: 0.5 });
      filt(out, "lp", 4200, 0.7);
    }],
    // darker metal, short: the CR-78 hat barely opens
    h: [0.09, out => { bankOsc(out, { freqs: BANK808, tau: 0.020, gain: 0.9 });
                       filt(out, "hp", 6000, 0.7); filt(out, "lp", 9800, 0.7); }],
    o: [0.28, out => { bankOsc(out, { freqs: BANK808, tau: 0.09, gain: 0.9 });
                       filt(out, "hp", 5600, 0.7); filt(out, "lp", 9800, 0.7); }],
    f: [0.06, out => { bankOsc(out, { freqs: BANK808, tau: 0.013, gain: 0.7 });
                       filt(out, "hp", 6200, 0.7); filt(out, "lp", 9500, 0.7); }],
    // its cymbal: a quiet, dark wash — the ballad ride
    r: [0.9, (out, rand) => {
      add(out, 0.9, t => burst(rand, t, { tau: 0.30, gain: 0.55 }), [["hp", 5000, 0.7], ["lp", 9500, 0.7]]);
      bankOsc(out, { freqs: BANK808, tau: 0.25, gain: 0.3 });
      filt(out, "hp", 4200, 0.7);
    }],
    x: [1.3, (out, rand) => {
      add(out, 1.3, t => burst(rand, t, { tau: 0.5, gain: 0.6 }), [["hp", 3800, 0.7], ["lp", 9800, 0.7]]);
      bankOsc(out, { freqs: BANK808, tau: 0.4, gain: 0.35, detune: 1.22 });
      filt(out, "hp", 3400, 0.7);
    }],
    // the bongo/conga family IS the CR-78 tom voice
    t: [0.16, out => { drop(out, { f0: 230, f1: 205, ptau: 0.04, tau: 0.055, gain: 1, atk: 0.0015, harm2: 0.3 });
                       filt(out, "lp", 3200, 0.7); }],
    m: [0.20, out => { drop(out, { f0: 172, f1: 152, ptau: 0.04, tau: 0.070, gain: 1, atk: 0.0015, harm2: 0.3 });
                       filt(out, "lp", 2800, 0.7); }],
    l: [0.26, out => { drop(out, { f0: 118, f1: 102, ptau: 0.045, tau: 0.090, gain: 1, atk: 0.002, harm2: 0.25 });
                       filt(out, "lp", 2400, 0.7); }],
  },
};

/* ---------- THE MACHINES' OWN MIX ---------- */
// Per-machine rows over instruments.js DRUMMIX — same five numbers, same two
// readers (the kit desk's lane strips and playDrum's transient shaping), one
// merge (mixFor below). Only what genuinely differs from the sampled default
// is written; an absent lane rides DRUMMIX as-is.
//
// TWO PATTERNS RUN THROUGH EVERY ROW. `punch: 1` — the sampled kits need the
// transient designer because their one-shots were normalised flat; these hits
// were SYNTHESIZED with their transients, and boosting the first 12 ms of an
// 808 kick manufactures a click the machine is famous for not having. And
// `room` LOW — a drum machine is a line-out, not a kit in a room; the hats
// especially take far less of the ambience send than a recorded hat, or the
// machine stops sounding like a machine. (sus stays 1 the same way: shortening
// the boom is un-writing the recipe.)
export const MACHINEMIX = {
  tr808: {
    k: { punch: 1,    sus: 1, room: 0.04 },
    s: { punch: 1.1,  sus: 1, room: 0.28 },
    c: { punch: 1,    sus: 1, room: 0.30 },
    p: { punch: 1,    sus: 1, room: 0.20 },
    h: { punch: 1,    sus: 1, room: 0.06 },
    o: { punch: 1,    sus: 1, room: 0.10 },
    f: { punch: 1,    sus: 1, room: 0.05 },
    r: { punch: 1,    sus: 1, room: 0.12, lvl: 0.6 },
    x: { punch: 1,    sus: 1, room: 0.18, lvl: 0.7 },
    t: { punch: 1,    sus: 1, room: 0.20 },
    m: { punch: 1,    sus: 1, room: 0.20 },
    l: { punch: 1,    sus: 1, room: 0.22 },
  },
  tr909: {
    k: { punch: 1.1,  sus: 1, room: 0.06 },
    s: { punch: 1.15, sus: 1, room: 0.32 },
    c: { punch: 1,    sus: 1, room: 0.34 },
    p: { punch: 1,    sus: 1, room: 0.20 },
    h: { punch: 1,    sus: 1, room: 0.07 },
    o: { punch: 1,    sus: 1, room: 0.12 },
    f: { punch: 1,    sus: 1, room: 0.06 },
    r: { punch: 1,    sus: 1, room: 0.15, lvl: 0.62 },
    x: { punch: 1,    sus: 1, room: 0.20, lvl: 0.75 },
    t: { punch: 1.1,  sus: 1, room: 0.22 },
    m: { punch: 1.1,  sus: 1, room: 0.22 },
    l: { punch: 1.1,  sus: 1, room: 0.24 },
  },
  tr606: {
    k: { punch: 1.1,  sus: 1, room: 0.05 },
    s: { punch: 1.1,  sus: 1, room: 0.24 },
    c: { punch: 1,    sus: 1, room: 0.26, lvl: 0.8 },
    p: { punch: 1,    sus: 1, room: 0.18 },
    h: { punch: 1,    sus: 1, room: 0.06 },
    o: { punch: 1,    sus: 1, room: 0.10 },
    f: { punch: 1,    sus: 1, room: 0.05 },
    r: { punch: 1,    sus: 1, room: 0.12, lvl: 0.6 },
    x: { punch: 1,    sus: 1, room: 0.16, lvl: 0.7 },
    t: { punch: 1,    sus: 1, room: 0.18 },
    m: { punch: 1,    sus: 1, room: 0.18 },
    l: { punch: 1,    sus: 1, room: 0.20 },
  },
  // the CR-78 sits back in the mix as a whole — it was a preset box on top of
  // an organ, and every record that loved it mixed it politely
  cr78: {
    k: { punch: 1,    sus: 1, room: 0.08, lvl: 0.9 },
    s: { punch: 1,    sus: 1, room: 0.30, lvl: 0.85 },
    c: { punch: 1,    sus: 1, room: 0.28, lvl: 0.7 },
    p: { punch: 1,    sus: 1, room: 0.22, lvl: 0.45 },
    h: { punch: 1,    sus: 1, room: 0.08, lvl: 0.7 },
    o: { punch: 1,    sus: 1, room: 0.12, lvl: 0.65 },
    f: { punch: 1,    sus: 1, room: 0.06, lvl: 0.5 },
    r: { punch: 1,    sus: 1, room: 0.14, lvl: 0.5 },
    x: { punch: 1,    sus: 1, room: 0.18, lvl: 0.6 },
    t: { punch: 1,    sus: 1, room: 0.22, lvl: 0.8 },
    m: { punch: 1,    sus: 1, room: 0.22, lvl: 0.8 },
    l: { punch: 1,    sus: 1, room: 0.24, lvl: 0.82 },
  },
};

export const isMachine = kit => !!R[kit];
// THE ONE MERGE — the kit desk's strips and playDrum's per-hit shaping both
// read this, so the table and the sound cannot drift apart (the dynCurve law,
// applied to the kits). A sampled kit falls straight through to DRUMMIX.
export function mixFor(kit, lane) {
  const o = kit && MACHINEMIX[kit] && MACHINEMIX[kit][lane];
  const base = DRUMMIX[lane];
  return o ? { ...base, ...o } : base;
}
// which strip a hit lands on: sampled kits share one strip per lane (the
// original desk, node for node); a machine lane with its own row earns its own
export const laneKey = (kit, lane) =>
  (kit && MACHINEMIX[kit] && MACHINEMIX[kit][lane]) ? kit + "|" + lane : lane;

/* ---------- rendering ---------- */
// FRESH each call — the gate's determinism claim is two of these, byte-equal.
// Peak-normalized to the level a decoded one-shot arrives at, so DRUMMIX/
// MACHINEMIX trims mean the same thing on both kinds of kit.
export function laneSamples(kit, lane) {
  const m = R[kit];
  if (!m || !m[lane]) return null;
  const [sec, build] = m[lane];
  const out = alloc(sec);
  build(out, prng(hash(kit + "|" + lane)));
  let peak = 0;
  for (let i = 0; i < out.length; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
  if (peak > 0) { const g = 0.92 / peak; for (let i = 0; i < out.length; i++) out[i] *= g; }
  return out;
}
// …AND CACHED AS AudioBuffers, once per lane, context-free (the irBufs trick:
// an AudioBuffer belongs to no context, so the live graph and every offline
// bounce window strike the same bytes).
const bufs = new Map();                            // "kit|lane" -> AudioBuffer
export function machineBuffer(kit, lane, ctx) {
  const key = kit + "|" + lane;
  let b = bufs.get(key);
  if (b) return b;
  const d = laneSamples(kit, lane);
  if (!d) return null;
  try { b = new AudioBuffer({ numberOfChannels: 1, length: d.length, sampleRate: SR }); }
  catch (e) { b = ctx ? ctx.createBuffer(1, d.length, SR) : null; }
  if (!b) return null;
  b.getChannelData(0).set(d);
  bufs.set(key, b);
  return b;
}
