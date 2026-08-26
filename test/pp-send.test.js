// test/pp-send.test.js — THE PING-PONG SEND OF A VOICE THAT HAS A CHANNEL STRIP.
//
// THE DEFECT THIS EXISTS FOR, in its own words. Both renderers mix a unit two
// ways. A unit with no pedals and no board EQ goes DIRECT: its samples are
// multiplied into dry/rev/del/pp in one loop. A unit with either goes through a
// unit-local buffer — `ubuf` — so the pedals and the board can process it whole,
// and the sends are applied at the far end. Until 2026-08-25 that far end
// summed dry/wL/wR/rev/del and never `pp`: the per-event ping-pong send was
// read off the event, tracked as `curPP` at the "@pp" command, and then
// dropped. It was harmless the day it was written, when only an insert chip
// sent a unit down that path; the board-EQ round of 2026-08-24 made a unit with
// ANY strip take it too, which after FAM_EQ is very nearly every unit.
//
// AND IT WAS INVISIBLE, which is why this file is a gate and not a comment.
// nukernel/desk-gate.js G8b already renders a strip's audio through the shipped
// renderUnitWindow — and stayed green through the whole defect, because its
// fixture feeds `curPP: 0`. A bus that is never asked for is a bus that is
// never missed. So the fixture here turns the throw ON.
//
// WHAT IS ASSERTED, AND WHY THIS SHAPE.
//   1 · a unit with a strip AND a pp send reaches the pp bus at all;
//   2 · the pp bus it writes is IDENTICAL, sample for sample, to the one the
//       direct branch writes for the same source and the same send — the two
//       mix paths must not disagree about what a send is;
//   3 · the strip really engaged (the DRY bus differs), so 2 cannot pass
//       vacuously on a unit that quietly took the direct path after all;
//   4 · the LIVE renderer and the PRESS renderer agree — the two files must be
//       fixed together or press parity goes, and this is the assertion that
//       says so.
//
// PURE NODE, no faustwasm: both renderers reach their DSP through a `render`/
// `setParamValue` pair, so a stub proc handing back a deterministic source is
// the whole instrument. Same trick as desk-gate G8b, same reason.
"use strict";
const path = require("path");
const R = (p) => path.join(__dirname, "..", p);
const SP = require(R("engine/faust/voices/sampler.js"));
const RC = require(R("engine/faust/press/render-core.js"));
const SRE = require(R("engine/faust/live/stream-renderer.js"));

const SR = 44100, BS = 64, N = 1 << 14;
const PP = 0.6;                     // the throw, as state-engine stamps one (0.5..0.9)
const STRIP = { lo: -12, mid: 0, hi: 9 };

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? "\n       " + detail : "")); }
};
// deterministic source, the LCG desk-gate uses — no rng, no clock, no ears
const mkNoise = (seed) => { let x = seed >>> 0; const o = new Float32Array(N);
  for (let i = 0; i < N; i++) { x = (x * 1103515245 + 12345) >>> 0; o[i] = x / 2147483648 - 1; }
  return o; };
const NOISE = mkNoise(12345), NOISE_R = mkNoise(777);
const rms = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i];
                     return Math.sqrt(s / a.length); };
const firstDiff = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
                              return -1; };
const newBuses = () => ({ dry: new Float32Array(N), rev: new Float32Array(N),
                          del: new Float32Array(N), pp: new Float32Array(N),
                          wL: new Float32Array(N), wR: new Float32Array(N) });

/* ==== THE LIVE RENDERER — engine/faust/live/stream-renderer.js ============ */
const eng = SRE.makeStreamEngine({ E: null, SE: null, FP: null, SP,
  mergeIvals: RC.mergeIvals, mkProc: null, rootOf: null, SR, BS });

function live(u, pp) {
  const buses = newBuses();
  let pos = 0;
  const proc = { setParamValue() {},
    render(ins, len) { const a = NOISE.subarray(pos, pos + len),
                             b = NOISE_R.subarray(pos, pos + len);
                       pos += len; return u.stereo ? [a, b] : [a]; } };
  // `pending` is the command queue the ingest writes: "@pp" at s - BS is
  // exactly what stream-renderer.js:330 pushes for an event carrying one.
  const v = { proc, R: "/x/", pending: [[-BS, "@pp", pp]], ivals: [[0, N]],
              busyUntil: -1, lastOff: null, curOut: 1, curPP: 0, renderedEnd: 0 };
  eng.__test.renderUnitWindow({ u, procs: [v], chain: null, chainPrev: null },
                              buses, 0, N, 0.5, null);
  return buses;
}

/* ==== THE PRESS RENDERER — engine/faust/press/render-core.js ============== */
async function press(u, pp) {
  const buses = newBuses();
  let pos = 0;
  const proc = { setParamValue() {},
    render(ins, len) { const a = NOISE.subarray(pos, pos + len),
                             b = NOISE_R.subarray(pos, pos + len);
                       pos += len; return u.stereo ? [a, b] : [a]; } };
  // `hold` so the note sounds for the whole window: press shortens a `drum`
  // event to a 12 ms one-shot (render-core.js:180), which would leave 96% of
  // the buffer silent and make the parity check below a claim about nothing.
  const ev = [{ beat: 0, durB: N / SR / 0.5, sets: {}, amp: 1, hold: true, pp }];
  await RC.renderUnit({ ...u, pool: 1, tail: 0.001 }, ev,
    { mkProc: async () => proc, rootOf: () => "x", SR, BS, TOTAL: N, spb: 0.5,
      buses, speech: null, dx7Presets: {}, SP });
  return buses;
}

(async () => {
  console.log("\nPP · the ping-pong send of a voice that has a channel strip");

  /* ---- 1, 2, 3 · THE LIVE RENDERER, both paths, same send --------------- */
  const Ldirect = live({ lvl: 1, module: "tract_voice" }, PP);
  const Lstrip  = live({ lvl: 1, module: "tract_voice", strip: STRIP }, PP);

  ok(rms(Lstrip.pp) > 1e-4,
     "LIVE · a unit with a strip AND a pp send reaches the pp bus",
     "pp rms " + rms(Lstrip.pp).toExponential(3) + " — this is the assertion " +
     "that failed before 2026-08-25, at exactly 0");
  ok(firstDiff(Lstrip.pp, Ldirect.pp) < 0,
     "LIVE · …and it is the SAME pp bus the direct branch writes, sample for sample",
     "first differing sample " + firstDiff(Lstrip.pp, Ldirect.pp));
  ok(firstDiff(Lstrip.dry, Ldirect.dry) >= 0 && rms(Lstrip.dry) > 1e-4,
     "LIVE · …and the strip DID engage — the dry bus is not the direct one, so " +
     "the check above is not passing on a unit that took the direct path");

  // THE ARITHMETIC, STATED. `pp` is the voice's own output times its per-note
  // gains and nothing else (curOut is 1 here), so the bus is the source scaled.
  {
    let worst = 0;
    // `fround` because the bus is a Float32Array and the product is computed
    // in float64 — comparing the two without it measures the store, not the mix
    for (let i = 0; i < N; i++)
      worst = Math.max(worst, Math.abs(Lstrip.pp[i] - Math.fround(NOISE[i] * PP)));
    ok(worst === 0, "LIVE · the pp bus IS source × the send, exactly",
       "largest error " + worst.toExponential(3));
  }

  /* ---- the wide case: a stereo unit sends its MONO SUM ------------------ */
  {
    const W = live({ lvl: 1, module: "tract_voice", stereo: true, strip: STRIP }, PP);
    let worst = 0;
    for (let i = 0; i < N; i++)
      worst = Math.max(worst,
        Math.abs(W.pp[i] - Math.fround((NOISE[i] + NOISE_R[i]) * 0.5 * PP)));
    ok(worst === 0, "LIVE · a STEREO unit with a strip sends its mono sum, as the " +
       "direct stereo branch does", "largest error " + worst.toExponential(3));
  }

  /* ---- absent is today: no throw, no bus ------------------------------- */
  {
    const Z = live({ lvl: 1, module: "tract_voice", strip: STRIP }, 0);
    let z = true; for (let i = 0; i < N; i++) if (Z.pp[i] !== 0) { z = false; break; }
    ok(z, "LIVE · a unit with a strip and NO throw writes nothing to pp — the " +
       "fix allocates no buffer and changes no sample for every record measured " +
       "so far (0 non-zero pp events over 20 records and 22,145 drum hits)");
  }

  /* ---- 4 · PRESS, and the two renderers agree -------------------------- */
  const Pdirect = await press({ lvl: 1, module: "tract_voice" }, PP);
  const Pstrip  = await press({ lvl: 1, module: "tract_voice", strip: STRIP }, PP);

  ok(rms(Pstrip.pp) > 1e-4,
     "PRESS · a unit with a strip AND a pp send reaches the pp bus",
     "pp rms " + rms(Pstrip.pp).toExponential(3));
  ok(firstDiff(Pstrip.pp, Pdirect.pp) < 0,
     "PRESS · …and it is the SAME pp bus its own direct branch writes",
     "first differing sample " + firstDiff(Pstrip.pp, Pdirect.pp));
  ok(firstDiff(Pstrip.dry, Pdirect.dry) >= 0,
     "PRESS · …and the strip DID engage on this path too");

  // PARITY. The two renderers walk the song differently — the stream in fixed
  // BS windows, press in SPAN_MAX batches — so this compares the send they
  // computed over the samples both of them voiced, which is the claim that
  // matters: one number per sample, agreed.
  {
    let worst = 0, n = 0;
    for (let i = 0; i < N; i++) {
      if (Lstrip.pp[i] === 0 && Pstrip.pp[i] === 0) continue;
      worst = Math.max(worst, Math.abs(Lstrip.pp[i] - Pstrip.pp[i])); n++;
    }
    ok(n > N * 0.9 && worst === 0,
       "PARITY · live and press write the identical pp bus for the identical " +
       "unit — the two files move together or press parity goes",
       n + " voiced samples, largest disagreement " + worst.toExponential(3));
  }

  console.log("\n  " + pass + " checks pass, " + fail + " fail");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
