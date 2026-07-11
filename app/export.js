// export.js — ⤓ download the CURRENT song. Two artifacts, both derived from the
// exact state the engine is playing (S.playing):
//   • MIDI: engine/midi-export.js builds a Standard MIDI File from the SAME
//     buildEvents() walk the audio uses (pads/bass/melody + GM drums).
//   • AUDIO: a true offline in-browser press. A DEDICATED stream-worker (never
//     the live ring/wavOut producers) runs the renderWav whole-song path — the
//     same press-parity open()+renderChunk() core faust/segment-parity-test.js
//     gates against node's faust/press.js — with the found/sampler/speech PCM
//     decoded HERE (mirroring the wavOut conductor's decode, faust/live.js
//     decFound/decSampler) and shipped in the open payload, so the pressed file
//     carries the full mix: found sound, SF2 sampler voices, vocoder carrier.
//     WAV is the lossless "high res" artifact (44.1k/16 stereo, the committed
//     press format); MP3 rides the existing encoder worker (lamejs, 192kbps).
// Files are named from the SAME deterministic NameBank identity the chyron
// shows ("The Signalmen — Standard Time.mid"), so the download matches the
// on-screen band card.
import { S, set, deep } from "./state.js";
import { buildLoopMidi, buildLoopPlan } from "./journey.js";   // whole-path MIDI + audio plan (the full loop, not just the current song)

const SR = 44100;

// ---------- the song's identity (the chyron's derivation, app/readouts.js) ----------
export function songIdentity() {
  const g = (S.weights[0] || { g: "vaporwave" }).g;
  const win = S.live ? Math.floor(S.barCount / 32) : 0;   // new song every ~32 bars while live
  return NameBank.identity(g, NameBank.hash(S.seed, g, S.travel.seg, win));
}
export function fileStem() {
  const id = songIdentity();
  return (id.artist + " — " + id.title).replace(/[\/\\:*?"<>|]/g, "_");
}

// ---------- shared download plumbing (the ⤓ preset/path pattern) ----------
function saveBlob(blob, name, skip) {
  EXPORT.lastName = name;                       // headless probe hook
  if (EXPORT.noDownload || skip) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 30000);
}

// ---------- ⤓ MIDI ----------
// ASYNC (2026-07-11 crash fix): the whole-path MIDI walk yields to the event loop
// (buildLoopMidi is chunked) so a long loop can't freeze the page — so downloadMidi
// awaits it and rides progress on the status line.
export async function downloadMidi() {
  if (!S.playing || !window.MidiExport) { set({ status: "MIDI export unavailable" }); return null; }
  // WHOLE PATH (Paul): with a drawn loop, export the entire journey — every genre
  // it crosses — not just the current song. Falls back to the current song when
  // there is no path (or the walk can't run).
  let bytes = null, whole = false;
  if (S.waypoints.length >= 2) {
    set({ status: "whole-path MIDI: walking the loop…" });
    try { bytes = await buildLoopMidi({ onProgress: (b, t) => set({ status: "whole-path MIDI: " + Math.round(100 * b / t) + "% of " + t + " bars" }) }); whole = !!bytes; }
    catch (e) { console.warn("whole-path MIDI failed:", e); }
  }
  if (!bytes) bytes = MidiExport.buildMidi(S.playing);
  EXPORT.lastMidi = bytes;                      // headless probe hook (SMF parse gate)
  const name = fileStem() + (whole ? " (full path)" : "") + ".mid";
  saveBlob(new Blob([bytes], { type: "audio/midi" }), name);
  set({ status: "MIDI saved — " + name + " (" + bytes.length + " bytes" + (whole ? ", whole path" : "") + ")" });
  return bytes;
}

// ---------- ⤓ audio: decode inputs (mirrors faust/live.js decFound/decSampler) ----------
let _ctx = null;
function decodeCtx() {
  if (_ctx) return _ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  try { _ctx = new AC({ sampleRate: SR }); } catch (e) { _ctx = new AC(); }
  return _ctx;
}
// tiny concurrency gate (desktop export posture: throttle, tolerate failures)
function makeGate(limit) {
  let active = 0; const q = [];
  const next = () => { if (active >= limit || !q.length) return; active++; const f = q.shift();
    f().finally(() => { active--; next(); }); };
  return (fn) => new Promise((res) => { q.push(() => fn().then(res, res)); next(); });
}
const urlOf = (s) => s && (s.url || (s.samplePath ? new URL(s.samplePath, document.baseURI).href : null));

// enumerate + decode every found/sampler source the schedule touches, plus the
// vocoder speech carrier tiled to TOTAL (press.js decodeInputs' contract).
async function decodeInputs(state, sched, TOTAL) {
  const FP = window.FoundPlayer, SP = window.FaustSampler;
  const ctx = decodeCtx();
  const byId = {}; for (const s of (state.foundSources || [])) byId[s.id] = s;
  const foundIds = new Set(), samplerIds = new Set();
  for (const f of sched.found) if (byId[f.srcId]) foundIds.add(f.srcId);
  for (const u of Object.values(sched.units)) if (u && u.sampler)
    for (const z of u.sampler.zones) if (byId[z.srcId]) samplerIds.add(z.srcId);
  const buffers = {}, failed = [];
  const gate = makeGate(4);
  const jobs = [];
  const monoOf = (b) => {
    if (!b || !b.length) return null;
    if (b.numberOfChannels <= 1) return Float32Array.from(b.getChannelData(0));
    const n = b.length, a = b.getChannelData(0), c = b.getChannelData(1), o = new Float32Array(n);
    for (let i = 0; i < n; i++) o[i] = (a[i] + c[i]) * 0.5;
    return o;
  };
  for (const id of foundIds) {
    const s = byId[id];
    jobs.push(gate(async () => {
      try {
        const b = s.synthText ? await FP.synthToBuffer(ctx, s.synthText)
                              : await FP.decodeUrlToBuffer(ctx, urlOf(s));
        if (b && b.length) buffers[id] = Float32Array.from(b.getChannelData(0));
        else failed.push(id);
      } catch (e) { failed.push(id); }
    }));
  }
  for (const id of samplerIds) {
    if (foundIds.has(id)) continue;   // already decoding via the found path
    const s = byId[id];
    jobs.push(gate(async () => {
      try { const p = monoOf(await SP.decodeUrlRaw(ctx, urlOf(s))); if (p) buffers[id] = p; else failed.push(id); }
      catch (e) { failed.push(id); }
    }));
  }
  // vocoder speech carrier (press.js decodeInputs: state.vocoderSourceId or sp_/vx_/vox_ prefix)
  let speech = null;
  const needVoc = Object.values(sched.units).some((u) => u && u.vocoder);
  if (needVoc) {
    const fs = state.foundSources || [];
    const vs = fs.find((s) => s.id === state.vocoderSourceId) || fs.find((s) => /^(sp_|vx_|vox_)/.test(s.id || ""));
    if (vs) jobs.push(gate(async () => {
      try {
        const b = vs.synthText ? await FP.synthToBuffer(ctx, vs.synthText)
                               : await FP.decodeUrlToBuffer(ctx, urlOf(vs));
        if (b && b.length) {
          const raw = b.getChannelData(0);
          speech = new Float32Array(TOTAL);
          for (let i = 0; i < TOTAL; i++) speech[i] = raw[i % raw.length];   // TOTAL-tiled, like press
        }
      } catch (e) { failed.push(vs.id + " (speech)"); }
    }));
  }
  await Promise.all(jobs);
  return { buffers, speech, failed };
}

// ---------- ⤓ audio: MP3 encode via the existing encoder worker (lamejs) ----------
async function encodeMp3(wavBuf) {
  const mw = new Worker("engine/faust/mp3-worker.js", { type: "module" });
  try {
    await new Promise((res, rej) => {
      mw.onmessage = (e) => { const m = e.data || {};
        if (m.type === "mp3ready") res(); else if (m.type === "mp3fail") rej(new Error(m.error)); };
      mw.postMessage({ type: "init" });
    });
    const chunks = [];
    const done = new Promise((res, rej) => {
      mw.onmessage = (e) => { const m = e.data || {};
        if (m.type === "mp3chunk") { if (m.bytes && m.bytes.byteLength) chunks.push(new Uint8Array(m.bytes)); if (m.final) res(); }
        else if (m.type === "mp3fail") rej(new Error(m.error)); };
    });
    mw.postMessage({ type: "mp3open", kbps: 192, overlapSec: 0.02, epoch: 1 });
    // feed the pressed PCM (canonical 44-byte RIFF header, int16 interleaved) in ~8s slabs.
    // boot/bridge false: one clean continuous timeline, no fades — this is a file, not a seam.
    const dv = new DataView(wavBuf), n = (wavBuf.byteLength - 44) >> 2, STEP = SR * 8;
    for (let s0 = 0; s0 < n; s0 += STEP) {
      const len = Math.min(STEP, n - s0);
      const L = new Float32Array(len), R = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const o = 44 + ((s0 + i) << 2);
        L[i] = dv.getInt16(o, true) / 32768; R[i] = dv.getInt16(o + 2, true) / 32768;
      }
      mw.postMessage({ type: "mp3pcm", gen: 1, L: L.buffer, R: R.buffer, n: len, boot: false, bridge: false, barMap: [] }, [L.buffer, R.buffer]);
    }
    mw.postMessage({ type: "mp3flush", gen: 1 });
    await done;
    let tot = 0; for (const c of chunks) tot += c.length;
    const out = new Uint8Array(tot); let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out.buffer;
  } finally { mw.terminate(); }
}

// ========================= ⤓ WHOLE-PATH audio (the loop) =====================
// Paul: "export the entire path, not just the current song. The whole mix." When
// a loop is drawn, ⤓ wav/mp3 render the ENTIRE journey — every genre it crosses —
// via app/journey.js buildLoopPlan (topology-stable runs) + the dedicated
// stream-worker renderLoop (bake each run, crossfade the seams, STREAM the PCM
// back). Memory-bounded: the worker never holds the whole loop, and here we
// assemble WAV from int16 body parts (a Blob of parts, no giant contiguous copy)
// or feed the mp3 worker block-by-block. Falls back to the single-song press when
// there is no path (exportAudio routes below).

// enumerate + decode every found/sampler/vocoder source the WHOLE loop touches
// (plan.byId holds the source records; srcIds are global so one table serves all
// runs). Speech carriers are the RAW decoded buffer (openLive loops them — NOT
// tiled to a TOTAL like the single-song press path).
async function decodeLoopInputs(plan) {
  const FP = window.FoundPlayer, SP = window.FaustSampler;
  const ctx = decodeCtx();
  const byId = plan.byId || {};
  const buffers = {}, speechById = {}, failed = [];
  const gate = makeGate(4);
  const monoOf = (b) => {
    if (!b || !b.length) return null;
    if (b.numberOfChannels <= 1) return Float32Array.from(b.getChannelData(0));
    const n = b.length, a = b.getChannelData(0), c = b.getChannelData(1), o = new Float32Array(n);
    for (let i = 0; i < n; i++) o[i] = (a[i] + c[i]) * 0.5; return o;
  };
  const foundSet = new Set(plan.foundIds), sampSet = new Set(plan.samplerIds);
  const jobs = [];
  const decMono = async (s) => (s.synthText ? await FP.synthToBuffer(ctx, s.synthText) : await FP.decodeUrlToBuffer(ctx, urlOf(s)));
  for (const id of foundSet) { const s = byId[id]; if (!s) { failed.push(id); continue; }
    jobs.push(gate(async () => { try { const b = await decMono(s);
      if (b && b.length) buffers[id] = Float32Array.from(b.getChannelData(0)); else failed.push(id); } catch (e) { failed.push(id); } })); }
  for (const id of sampSet) { if (foundSet.has(id)) continue; const s = byId[id]; if (!s) { failed.push(id); continue; }
    jobs.push(gate(async () => { try { const p = monoOf(await SP.decodeUrlRaw(ctx, urlOf(s))); if (p) buffers[id] = p; else failed.push(id); }
      catch (e) { failed.push(id); } })); }
  for (const id of (plan.speechIds || [])) { const s = byId[id]; if (!s) { failed.push(id + " (speech)"); continue; }
    jobs.push(gate(async () => { try { const b = await decMono(s);
      if (b && b.length) speechById[id] = Float32Array.from(b.getChannelData(0)); else failed.push(id + " (speech)"); }
      catch (e) { failed.push(id + " (speech)"); } })); }
  await Promise.all(jobs);
  return { buffers, speechById, failed };
}

// int16-interleave one streamed float block into a WAV data-body chunk (no header;
// truncate-toward-zero to match the worker's encodeWavPCM / wav.js "trunc" mode).
function pcmToInt16(L, R, n) {
  const buf = new ArrayBuffer(n * 4), dv = new DataView(buf);
  for (let i = 0; i < n; i++) {
    dv.setInt16(i * 4, Math.max(-1, Math.min(1, L[i])) * 32767 | 0, true);
    dv.setInt16(i * 4 + 2, Math.max(-1, Math.min(1, R[i])) * 32767 | 0, true);
  }
  return buf;
}
// the canonical 44-byte RIFF/WAVE header for `frames` stereo 16-bit samples.
function wavHeader(frames) {
  const dataLen = frames * 4, buf = new ArrayBuffer(44), dv = new DataView(buf); let o = 0;
  const w = (s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o++, s.charCodeAt(i)); };
  w("RIFF"); dv.setUint32(o, 36 + dataLen, true); o += 4; w("WAVE");
  w("fmt "); dv.setUint32(o, 16, true); o += 4; dv.setUint16(o, 1, true); o += 2; dv.setUint16(o, 2, true); o += 2;
  dv.setUint32(o, SR, true); o += 4; dv.setUint32(o, SR * 4, true); o += 4; dv.setUint16(o, 4, true); o += 2; dv.setUint16(o, 16, true); o += 2;
  w("data"); dv.setUint32(o, dataLen, true); o += 4;
  return buf;
}

// exportLoopAudio("wav"|"mp3", {bars, noDownload}) -> Promise<Blob|null>. One at a
// time (EXPORT.busy); progress rides S.status. opts.bars caps the walk (headless).
export async function exportLoopAudio(fmt, opts) {
  opts = opts || {};
  if (EXPORT.busy || !S.playing) return null;
  EXPORT.busy = true; set({});
  let w = null, mw = null;
  try {
    set({ status: "whole-path: planning the walk…" });
    const plan = await buildLoopPlan({ ...(opts.bars ? { bars: opts.bars } : {}),
      onProgress: (b, t) => set({ status: "whole-path: planning " + Math.round(100 * b / t) + "% of " + t + " bars" }) });
    if (!plan || !plan.runs.length) { set({ status: "whole-path export needs a drawn loop" }); return null; }
    set({ status: "whole-path: decoding " + (plan.foundIds.length + plan.samplerIds.length) + " sources…" });
    const { buffers, speechById, failed } = await decodeLoopInputs(plan);
    if (failed.length) console.warn("whole-path: sources skipped:", failed.join(", "));
    w = new Worker("engine/faust/stream-worker.js", { type: "module" });
    await new Promise((res, rej) => { w.onmessage = (e) => { const m = e.data || {};
      if (m.type === "ready") res(); else if (m.type === "initfail") rej(new Error(m.error)); }; w.postMessage({ type: "init" }); });

    const parts = []; let frames = 0, first = true;
    const mp3chunks = []; let mp3done = null;
    if (fmt === "mp3") {
      mw = new Worker("engine/faust/mp3-worker.js", { type: "module" });
      await new Promise((res, rej) => { mw.onmessage = (e) => { const m = e.data || {};
        if (m.type === "mp3ready") res(); else if (m.type === "mp3fail") rej(new Error(m.error)); }; mw.postMessage({ type: "init" }); });
      mp3done = new Promise((res, rej) => { mw.onmessage = (e) => { const m = e.data || {};
        if (m.type === "mp3chunk") { if (m.bytes && m.bytes.byteLength) mp3chunks.push(new Uint8Array(m.bytes)); if (m.final) res(); }
        else if (m.type === "mp3fail") rej(new Error(m.error)); }; });
      mw.postMessage({ type: "mp3open", kbps: 192, overlapSec: 0.02, epoch: 1 });
    }

    await new Promise((res, rej) => {
      w.onmessage = (e) => { const m = e.data || {};
        if (m.type === "looppcm") {
          const L = new Float32Array(m.L), R = new Float32Array(m.R), n = m.n | 0; frames += n;
          if (fmt === "mp3") mw.postMessage({ type: "mp3pcm", gen: 1, L: L.buffer, R: R.buffer, n, boot: first, bridge: false, barMap: [] }, [L.buffer, R.buffer]);
          else parts.push(pcmToInt16(L, R, n));
          first = false;
        } else if (m.type === "loopprog") set({ status: "whole-path: rendering " + Math.round(100 * m.done / Math.max(1, m.total)) + "% (" + Math.round(m.sec) + "s)…" });
        else if (m.type === "loopdone") res(m);
        else if (m.type === "loopfail" || m.type === "loopcancel") rej(new Error(m.error || m.type));
      };
      const transfer = [];
      for (const b of Object.values(buffers)) transfer.push(b.buffer);
      for (const b of Object.values(speechById)) transfer.push(b.buffer);
      w.postMessage({ type: "renderLoop", gen: 1, runs: plan.runs, buffers, speechById, crossfadeSec: 0.12 }, transfer);
    });

    let blob, ext;
    if (fmt === "mp3") {
      set({ status: "whole-path: encoding MP3…" });
      mw.postMessage({ type: "mp3flush", gen: 1 }); await mp3done;
      let tot = 0; for (const c of mp3chunks) tot += c.length; const u = new Uint8Array(tot); let o = 0; for (const c of mp3chunks) { u.set(c, o); o += c.length; }
      blob = new Blob([u.buffer], { type: "audio/mpeg" }); ext = ".mp3";
    } else {
      blob = new Blob([wavHeader(frames), ...parts], { type: "audio/wav" }); ext = ".wav";
    }
    EXPORT.lastLoopFrames = frames;
    const name = fileStem() + " (full path)" + ext;
    saveBlob(blob, name, opts.noDownload);
    set({ status: "saved " + name + " — " + (frames / SR).toFixed(0) + "s, " + (blob.size / 1048576).toFixed(1) + " MB" +
      (failed.length ? " (" + failed.length + " skipped)" : "") });
    return blob;
  } catch (e) {
    console.error("whole-path export failed:", e);
    set({ status: "whole-path export failed: " + ((e && e.message) || e) });
    return null;
  } finally { if (w) w.terminate(); if (mw) mw.terminate(); EXPORT.busy = false; set({}); }
}

// ---------- ⤓ audio: the offline press (the CURRENT song) ----------
// exportAudio("wav"|"mp3", {durSec, noDownload}) -> Promise<ArrayBuffer|null>.
// The current song only, returned as a raw WAV ArrayBuffer (or MP3). The ⤓ wav/mp3
// buttons route to exportLoopAudio for the WHOLE PATH when a loop is drawn
// (app/panels.js) — kept a distinct entry point because that render is streamed
// (a Blob, possibly very long), a different contract from this quick press.
export async function exportAudio(fmt, opts) {
  opts = opts || {};
  if (EXPORT.busy || !S.playing) return null;
  EXPORT.busy = true; set({});
  let w = null;
  try {
    const state = deep(S.playing);
    const E = window.CsdEngine, SE = window.FaustStateEngine;
    const sched = SE.buildSchedule(E, state);
    const fullSec = sched.totalBeats * sched.spb;
    const totalSec = opts.durSec ? Math.min(fullSec, opts.durSec) : fullSec;
    const TOTAL = Math.ceil(totalSec * SR);
    set({ status: "export: decoding sources…" });
    const { buffers, speech, failed } = await decodeInputs(state, sched, TOTAL);
    if (failed.length) console.warn("export: sources skipped (decode failed):", failed.join(", "));
    // a DEDICATED producer worker — the live ring/wavOut workers are never touched
    w = new Worker("engine/faust/stream-worker.js", { type: "module" });
    await new Promise((res, rej) => {
      w.onmessage = (e) => { const m = e.data || {};
        if (m.type === "ready") res(); else if (m.type === "initfail") rej(new Error(m.error)); };
      w.postMessage({ type: "init" });
    });
    set({ status: "export: pressing 0% of " + Math.round(totalSec) + "s…" });
    const wavBuf = await new Promise((res, rej) => {
      w.onmessage = (e) => { const m = e.data || {};
        if (m.type === "wavprog") set({ status: "export: pressing " + Math.round(100 * m.chunk / Math.max(1, m.nChunks)) + "% of " + Math.round(m.totalSec || totalSec) + "s…" });
        else if (m.type === "wav") res(m.wav);
        else if (m.type === "wavfail" || m.type === "wavcancel") rej(new Error(m.error || m.type)); };
      const transfer = [];
      for (const b of Object.values(buffers)) transfer.push(b.buffer);
      if (speech) transfer.push(speech.buffer);
      w.postMessage({ type: "renderWav", gen: 1, state,
        durSec: opts.durSec ? opts.durSec : Math.ceil(fullSec) + 1,
        buffers, speech }, transfer);
    });
    let out = wavBuf, mime = "audio/wav", ext = ".wav";
    if (fmt === "mp3") { set({ status: "export: encoding MP3…" }); out = await encodeMp3(wavBuf); mime = "audio/mpeg"; ext = ".mp3"; }
    const name = fileStem() + ext;
    saveBlob(new Blob([out], { type: mime }), name, opts.noDownload);
    set({ status: "saved " + name + " — " + totalSec.toFixed(0) + "s, " + (out.byteLength / 1048576).toFixed(1) + " MB" +
      (failed.length ? " (" + failed.length + " sources skipped)" : "") });
    return out;
  } catch (e) {
    console.error("export failed:", e);
    set({ status: "export failed: " + ((e && e.message) || e) });
    return null;
  } finally { if (w) w.terminate(); EXPORT.busy = false; set({}); }
}

// ---------- headless probe hooks (test/explorer-ui-test.js) ----------
export const EXPORT = { busy: false, noDownload: false, lastMidi: null, lastName: null, lastLoopFrames: 0,
  downloadMidi, exportAudio, exportLoopAudio, fileStem, songIdentity };
window.__EXPORT = EXPORT;
