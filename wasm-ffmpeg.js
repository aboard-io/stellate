// mp3 export via lamejs — a pure-JS LAME encoder (~50KB) instead of ffmpeg.wasm
// (~30MB core + worker + COOP/COEP headaches). Same API: WasmFFmpeg.wavToMp3.
// Parses the rendered WAV (16-bit PCM, mono or stereo) and LAME-encodes it.

(function (root) {
  "use strict";
  const LAME_CDN = "https://cdn.jsdelivr.net/npm/@breezystack/lamejs@1.2.7/+esm";
  let _lame = null;

  async function loadLame(onStatus){
    if (_lame) return _lame;
    if (onStatus) onStatus("loading mp3 encoder…");
    const mod = await import(/* webpackIgnore: true */ LAME_CDN);
    _lame = mod.Mp3Encoder ? mod : (mod.default && mod.default.Mp3Encoder ? mod.default : mod);
    if (!_lame.Mp3Encoder) throw new Error("lamejs failed to load");
    return _lame;
  }

  // find the fmt + data chunks in a WAV; return {sampleRate, channels, samples(interleaved Int16)}
  function parseWav(bytes){
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let sampleRate = 44100, bits = 16, channels = 1, off = 12;
    while (off + 8 <= bytes.byteLength){
      const id = String.fromCharCode(bytes[off],bytes[off+1],bytes[off+2],bytes[off+3]);
      const sz = dv.getUint32(off+4, true);
      if (id === "fmt "){
        channels = dv.getUint16(off+10, true);
        sampleRate = dv.getUint32(off+12, true);
        bits = dv.getUint16(off+22, true);
      } else if (id === "data"){
        const start = off + 8;
        let samples;
        if (bits === 16){
          samples = new Int16Array(bytes.buffer, bytes.byteOffset + start, sz >> 1);
        } else { // 32-bit float fallback
          const f = new Float32Array(bytes.buffer, bytes.byteOffset + start, sz >> 2);
          samples = new Int16Array(f.length);
          for (let i=0;i<f.length;i++){ const s=Math.max(-1,Math.min(1,f[i])); samples[i] = s<0 ? s*0x8000 : s*0x7fff; }
        }
        return { sampleRate, channels, samples };
      }
      off += 8 + sz + (sz & 1);
    }
    throw new Error("WAV has no data chunk");
  }

  async function wavToMp3(wavBytes, kbps, onStatus){
    const lame = await loadLame(onStatus);
    const bytes = wavBytes instanceof Uint8Array ? wavBytes : new Uint8Array(wavBytes);
    const { sampleRate, channels, samples } = parseWav(bytes);
    if (onStatus) onStatus("encoding mp3…");
    const enc = new lame.Mp3Encoder(channels === 2 ? 2 : 1, sampleRate, kbps || 160);
    const out = [], block = 1152;
    if (channels === 2){
      const n = samples.length >> 1, L = new Int16Array(n), R = new Int16Array(n);
      for (let i=0;i<n;i++){ L[i]=samples[2*i]; R[i]=samples[2*i+1]; }
      for (let i=0;i<n;i+=block){
        const c = enc.encodeBuffer(L.subarray(i,i+block), R.subarray(i,i+block));
        if (c.length) out.push(c);
      }
    } else {
      for (let i=0;i<samples.length;i+=block){
        const c = enc.encodeBuffer(samples.subarray(i,i+block));
        if (c.length) out.push(c);
      }
    }
    const end = enc.flush();
    if (end.length) out.push(end);
    return new Blob(out, { type: "audio/mpeg" });
  }

  root.WasmFFmpeg = { wavToMp3, load: loadLame };
})(window);
