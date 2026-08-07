// export.js — the /daw export cluster: WAV, MP3, MIDI, MusicXML.
//
// Almost none of this is new machinery. The pieces were already on main and only
// the iOS background producer was using them:
//   WAV  faust/live/stream-worker.js renderWav — an offline, dur-capped whole-song
//        render through the same press-parity makeStreamEngine node uses, with
//        wavprog progress posts. It takes `buffers` (decoded found/sampler PCM) for
//        a FULL MIX; without them you get the faust mix only, which is what the
//        live path hears.
//   MP3  faust/codec/mp3-stream.js makeMp3Stream over the vendored lamejs — the
//        same encoder the WAV-FIRST mobile path streams through, driven here as a
//        single push instead of a stream.
//   MIDI engine/midi-export.js, already shipped for the app's ⤓ button.
//   MusicXML the one genuinely new writer — see musicxml.js for why a library
//        was not used.
import { SONG, state, events } from "./song.js";

const FAUST = "engine/faust/";
const slug = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 48);

export function songName() {
  const K = window.GenreKernel;
  const w = SONG.weights && SONG.weights.length ? SONG.weights[0].g : SONG.genre;
  const label = (K.GENRES[w] && K.GENRES[w].label) || w;
  return "stellate-" + (slug(label) || "song") + "-seed" + (SONG.seed | 0);
}

function save(blob, name) {
  EXPORT.lastName = name; EXPORT.lastSize = blob.size;
  if (EXPORT.noDownload) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 30000);
}

// ---------- THE BUFFERS ----------
// renderWav without `buffers` renders the FAUST mix only — and this project is
// SAMPLED BY DEFAULT, so every pitched voice is a sampler and the result is
// near-silence. (The export gate caught exactly that: a real RIFF/WAVE header,
// 44.1k stereo, correct length, peak 0.0015.) So the caller has to ship the PCM,
// the same way press.js decodeInputs does in node: the used set is every found
// event's srcId PLUS every sampler zone's srcId — instrument zones ride
// foundSources at vol 0 — and each is decoded from its own path.
//
// Fetched in parallel with a modest cap; a failed source is skipped rather than
// fatal, exactly as press warns-and-continues, because one missing zone should
// cost you an instrument and not the whole render.
async function collectBuffers(st, onProgress) {
  const E = window.CsdEngine, SE = window.FaustStateEngine;
  if (!E || !SE) return {};
  const ev = E.buildEvents(st);
  // voiceUnits returns an OBJECT keyed by unit name, not an array — press.js
  // walks it with Object.values and so does this
  const units = SE.voiceUnits(E, st) || {};
  const used = new Set((ev.found || []).map((f) => f.srcId));
  for (const u of Object.values(units))
    if (u && u.sampler && Array.isArray(u.sampler.zones))
      for (const z of u.sampler.zones) used.add(z.srcId);
  const srcs = (st.foundSources || []).filter((s) => used.has(s.id) && !s.synthText);
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 128, 44100);
  const out = {};
  let done = 0;
  const CAP = 8;
  async function one(s) {
    const url = s.samplePath || s.fsPath || ("found/" + s.id + ".mp3");
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status + " " + url);
      const buf = await ctx.decodeAudioData(await r.arrayBuffer());
      out[s.id] = Float32Array.from(buf.getChannelData(0));
    } catch (e) { /* a missing zone costs an instrument, not the render */ }
    done++;
    onProgress && onProgress(done / Math.max(1, srcs.length));
  }
  for (let i = 0; i < srcs.length; i += CAP)
    await Promise.all(srcs.slice(i, i + CAP).map(one));
  return out;
}

// ---------- the render, shared by WAV and MP3 ----------
// A DEDICATED stream-worker, exactly as live.js spawns one for the background
// producer: it owns no ring, so it can render flat-out without touching audio.
let worker = null;
function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(FAUST + "live/stream-worker.js", { type: "module" });
  return worker;
}
export async function renderSong(durSec, onProgress) {
  const st = JSON.parse(JSON.stringify(state()));
  // decode first (half the progress bar), then render (the other half)
  const buffers = await collectBuffers(st, (p) => onProgress && onProgress(p * 0.35));
  return new Promise((resolve, reject) => {
    const w = ensureWorker();
    const gen = (Date.now() & 0xffff);
    const onMsg = (e) => {
      const m = e.data || {};
      if (m.type === "ready") {
        const transfer = [];
        const send = {};
        for (const k of Object.keys(buffers)) { const c = buffers[k].slice(); send[k] = c; transfer.push(c.buffer); }
        w.postMessage({ type: "renderWav", gen, durSec, state: st, buffers: send }, transfer);
      } else if (m.type === "wavprog") {
        onProgress && onProgress(0.35 + 0.65 * (m.nChunks ? m.chunk / m.nChunks : 0));
      } else if (m.type === "wav") {
        w.removeEventListener("message", onMsg); resolve(m.wav);
      } else if (m.type === "initfail" || m.type === "openfail" || m.type === "wavcancel") {
        w.removeEventListener("message", onMsg); reject(new Error(m.error || m.type));
      }
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ type: "init" });
  });
}

// WAV bytes come back already RIFF-wrapped by the worker's own encoder.
export async function downloadWav(durSec, onProgress) {
  const wav = await renderSong(durSec || 90, onProgress);
  save(new Blob([wav], { type: "audio/wav" }), songName() + ".wav");
  return wav;
}

// MP3: decode the worker's WAV back to planar float and push it through lamejs in
// one go. Reusing the shipped encoder rather than a second one keeps the bitstream
// identical to what the mobile path produces.
export async function downloadMp3(durSec, onProgress) {
  const wav = await renderSong(durSec || 90, onProgress);
  const dv = new DataView(wav);
  const n = (dv.byteLength - 44) / 4;                    // 16-bit stereo after the 44-byte header
  const L = new Int16Array(n), R = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = dv.getInt16(44 + i * 4, true);
    R[i] = dv.getInt16(46 + i * 4, true);
  }
  await loadLame();
  const lame = window.lamejs;
  if (!lame || !lame.Mp3Encoder) throw new Error("lamejs unavailable");
  const enc = new lame.Mp3Encoder(2, 44100, 192);
  const out = [];
  const BLK = 1152;
  for (let i = 0; i < n; i += BLK) {
    const b = enc.encodeBuffer(L.subarray(i, i + BLK), R.subarray(i, i + BLK));
    if (b.length) out.push(new Uint8Array(b));
    if (onProgress && (i % (BLK * 64) === 0)) onProgress(0.5 + 0.5 * (i / n));
  }
  const tail = enc.flush();
  if (tail.length) out.push(new Uint8Array(tail));
  save(new Blob(out, { type: "audio/mpeg" }), songName() + ".mp3");
  return out;
}

// lamejs is a UMD classic script that publishes window.lamejs — NOT an ES module,
// so it is loaded with a <script src> rather than import(). Same-origin src is
// fine under the production CSP (which only forbids INLINE script), and it stays
// unfetched until someone actually asks for an mp3.
let lamePromise = null;
function loadLame() {
  if (window.lamejs) return Promise.resolve();
  if (lamePromise) return lamePromise;
  lamePromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = FAUST + "vendor/lamejs.min.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("lamejs failed to load"));
    document.head.appendChild(s);
  });
  return lamePromise;
}

// ---------- notes ----------
export function downloadMidi() {
  const bytes = window.MidiExport.buildMidi(JSON.parse(JSON.stringify(state())));
  EXPORT.lastMidi = bytes;
  save(new Blob([bytes], { type: "audio/midi" }), songName() + ".mid");
  return bytes;
}
export async function downloadMusicXml() {
  const { buildMusicXml } = await import("./musicxml.js");
  const xml = buildMusicXml(state(), events(), songName());
  EXPORT.lastXml = xml;
  save(new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" }), songName() + ".musicxml");
  return xml;
}

export const EXPORT = { noDownload: false, lastName: null, lastSize: 0, lastMidi: null, lastXml: null,
  downloadWav, downloadMp3, downloadMidi, downloadMusicXml, renderSong, songName };
window.__DAWEXPORT = EXPORT;
