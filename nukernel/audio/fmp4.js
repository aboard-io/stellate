// audio/fmp4.js — THE MUXER, BORROWED WHOLE. Nine lines of loader over
// engine/faust/codec/fmp4.js, and not one byte of muxing of its own.
//
// This file exists because of the law at the top of the lane and not because
// the parent's muxer needed anything: engine/faust/codec/fmp4.js already emits
// exactly the container this page needs — ftyp+moov once, then one moof+mdat
// per batch with an EXPLICIT tfdt in media timescale, monotonic by
// construction, plus the two iOS repairs (ADTS strip, AudioSpecificConfig
// synthesis) that a real iPhone forced into it (docs/WAV-FIRST.md v4.1). It has
// a node gate, it has device miles, and it has already been used from this
// folder once (audio/bounce.js's seamless tape). Rewriting it here would fork a
// device-corrected decision, which is the one thing the lane forbids.
//
// So what is actually here is the ENVIRONMENT SEAM, which is the only real
// difference between the two callers. The parent file is a UMD:
//
//   node       — the repo root says "type":"commonjs", so it is a CommonJS
//                module and `import()` hands its module.exports back as
//                `.default`. That is the path test/unit/nukernel.test.js walks.
//   browser    — `module` is undefined, so the factory writes `FaustFmp4` onto
//                the global and the module namespace is EMPTY. Reading the
//                namespace and stopping there is how a browser caller gets
//                `undefined` from a file that loaded perfectly.
//
// Both are checked, in that order, and a missing muxer throws rather than
// returning a half-built object — the carrier's whole ladder is written to
// degrade on a throw, and a silent null would degrade nothing.
//
// Layer graph: this file imports NOTHING from nukernel. audio/stream-carrier.js
// must be importable on its own (the probe does exactly that), so neither it
// nor this may reach sideways into the audio tier.

let cached = null;

// the muxer factory + its AAC helpers, whichever way this environment loads it.
// Cached: the parent module is idempotent but the dynamic import is not free,
// and the carrier asks for this on every attach.
export async function loadFmp4() {
  if (cached) return cached;
  const m = await import("../../engine/faust/codec/fmp4.js");
  const F =
    (m && m.default && m.default.makeFmp4Mux) ? m.default :            // node (CJS)
    (m && m.makeFmp4Mux) ? m :                                          // a future ESM parent
    (typeof globalThis !== "undefined" && globalThis.FaustFmp4) ? globalThis.FaustFmp4 : null;
  if (!F || typeof F.makeFmp4Mux !== "function")
    throw new Error("fmp4 muxer did not load");
  cached = F;
  return F;
}

// the same object, once loadFmp4() has resolved, for callers that already know
// it is there (readouts, gates). Null before the first load — never a stub.
export const fmp4 = () => cached;
