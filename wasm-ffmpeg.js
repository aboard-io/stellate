// wasm-ffmpeg.js — browser-side MP3 export via ffmpeg.wasm (@ffmpeg/ffmpeg 0.12).
// Uses the SINGLE-THREAD core, which does NOT require SharedArrayBuffer or
// COOP/COEP cross-origin-isolation headers — so it runs from a plain
// `python3 -m http.server` on localhost. The core wasm is ~30MB and is fetched
// (and cached by the browser) on first use.
//
// wavToMp3(wavBytes, bitrateK, onStatus) -> Blob(audio/mpeg)

(function (root) {
  "use strict";

  const FFMPEG_ESM = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/+esm";
  const UTIL_ESM   = "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/+esm";
  const CORE_BASE  = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
  const WORKER_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js";

  let _ff = null, _loading = null;

  async function load(onStatus) {
    if (_ff) return _ff;
    if (_loading) return _loading;
    _loading = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import(/* webpackIgnore: true */ FFMPEG_ESM),
        import(/* webpackIgnore: true */ UTIL_ESM),
      ]);
      const ff = new FFmpeg();
      if (onStatus) ff.on("progress", ({ progress }) =>
        onStatus("encoding mp3… " + Math.min(100, Math.round((progress || 0) * 100)) + "%"));
      if (onStatus) onStatus("loading ffmpeg core (~30MB first time)…");
      // Blob-URL everything so the worker/core load same-origin (CDN-safe).
      await ff.load({
        classWorkerURL: await toBlobURL(WORKER_URL, "text/javascript"),
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      _ff = ff;
      return ff;
    })();
    try { return await _loading; }
    catch (e) { _loading = null; throw e; }
  }

  async function wavToMp3(wavBytes, bitrateK, onStatus) {
    const ff = await load(onStatus);
    const bytes = wavBytes instanceof Uint8Array ? wavBytes : new Uint8Array(wavBytes);
    await ff.writeFile("in.wav", bytes);
    if (onStatus) onStatus("encoding mp3…");
    await ff.exec(["-i", "in.wav", "-codec:a", "libmp3lame", "-b:a", (bitrateK || 160) + "k", "out.mp3"]);
    const data = await ff.readFile("out.mp3");
    return new Blob([data.buffer || data], { type: "audio/mpeg" });
  }

  root.WasmFFmpeg = { load, wavToMp3 };
})(window);
