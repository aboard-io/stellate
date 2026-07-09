#!/usr/bin/env node
// prove.js — proof harness for the trimmed espeak-ng WASM artifact (node).
//
//   node vendor/espeak-ng/prove.js
//
// Proves: (1) English synthesis to raw Int16 PCM works from the trimmed
// data bundle, (2) determinism model — same-instance repeats are NOT
// byte-identical (espeak's wavegen consumes libc rand() for voicing noise
// and espeak_ng_SetRandSeed is not exported by this build), but a FRESH
// module instance with the same call sequence is byte-identical, so the
// organ re-inits per utterance, (3) timings for init and a ~5 s utterance.

import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import initEspeak from './espeak-ng.js';

const sha256 = (pcm) =>
  createHash('sha256').update(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)).digest('hex');

function synth(worker, text) {
  const chunks = [];
  worker.synthesize(text, (samples) => {
    if (samples && samples.length > 0) chunks.push(samples.slice());
    return false; // falsy = continue synthesis
  });
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const pcm = new Int16Array(total);
  let o = 0;
  for (const c of chunks) { pcm.set(c, o); o += c.length; }
  return pcm;
}

async function freshWorker() {
  const t0 = performance.now();
  const m = await initEspeak();
  const worker = new m.eSpeakNGWorker();
  const ms = performance.now() - t0;
  const rc = worker.set_voice('en-us', 'en', 0, 0);
  if (rc !== 0) throw new Error(`set_voice failed: ${rc}`);
  return { worker, ms };
}

let pass = true;
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) pass = false;
};

const A = 'Now arriving.';
const B = 'The midnight train departs from platform seven.';
const LONG =
  'Attention passengers. The nine forty five service to the coast is now boarding ' +
  'at platform three. Please have your tickets ready and mind the gap.'; // ~10 s speech

// --- instance 1: basic synthesis + timings ------------------------------
const one = await freshWorker();
console.log(`init ms: ${one.ms.toFixed(1)}`);
const rate = one.worker.get_samplerate();
console.log(`samplerate: ${rate}`);
check('samplerate is 22050', rate === 22050);

const a1 = synth(one.worker, A);
const b1 = synth(one.worker, B);
console.log(`A: ${a1.length} samples (${(a1.length / rate).toFixed(2)} s)  sha256 ${sha256(a1)}`);
console.log(`B: ${b1.length} samples (${(b1.length / rate).toFixed(2)} s)  sha256 ${sha256(b1)}`);
check('A synthesized non-empty', a1.length > rate / 4);
check('B synthesized non-empty', b1.length > rate / 2);
check('PCM is not silence', a1.some((s) => Math.abs(s) > 1000));

const t0 = performance.now();
const long1 = synth(one.worker, LONG);
const longMs = performance.now() - t0;
console.log(
  `LONG: ${long1.length} samples (${(long1.length / rate).toFixed(2)} s speech) synthesized in ${longMs.toFixed(1)} ms`
);
check('long-utterance synthesis under 2000 ms', longMs < 2000);

// same-instance repeat: expected NOT identical (documents why we re-init)
const a1again = synth(one.worker, A);
console.log(`A repeat on same instance: sha256 ${sha256(a1again)} (expected to differ)`);

// --- instances 2 and 3: fresh-instance determinism ----------------------
const two = await freshWorker();
console.log(`re-init ms: ${two.ms.toFixed(1)}`);
const a2 = synth(two.worker, A);
const b2 = synth(two.worker, B);

const three = await freshWorker();
const a3 = synth(three.worker, A);

check('fresh instance reproduces A byte-identically', sha256(a2) === sha256(a1));
check('fresh instance reproduces B after A byte-identically', sha256(b2) === sha256(b1));
check('third fresh instance also reproduces A', sha256(a3) === sha256(a1));

console.log(pass ? '\nALL GREEN' : '\nFAILURES PRESENT');
process.exit(pass ? 0 : 1);
