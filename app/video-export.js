// video-export.js — E (whole-loop VIDEO), v1: realtime MediaRecorder capture.
//
// Records the LIVE demoscene visuals + the live master audio to a video file, with
// NO 30MB ffmpeg.wasm dependency — the browser's built-in MediaRecorder muxes a
// canvas.captureStream() video track with the engine's msDest audio track
// (faustHandle.audioStream()). Realtime: it records for `seconds` of the journey
// as it plays (the loop travels through its genres on its own).
//
// CANVAS-TAINT HONESTY (2026-07-11): the found-video layer streams cross-origin
// archive.org clips WITHOUT `crossOrigin` (the CDN 302 drops CORS headers — see
// video-layer.js). `cx.drawImage(remoteVideo,…)` then SILENTLY TAINTS the capture
// canvas — it does NOT throw, so the old try/catch here never fired, and
// captureStream went on to emit a broken/near-static file. We now composite the
// video layer ONLY when `VideoLayer._frontKind()==="local"` (same-origin
// found/video/*.mp4), and additionally PROBE for taint with a 1×1 getImageData on a
// throwaway canvas before the first real draw; on any taint we drop the video layer
// and the take degrades to a clean DEMO-ONLY file (never a poisoned blob).
//
// PLATFORM HONESTY: MediaRecorder + canvas.captureStream + requestFrame are
// desktop-Chromium-shaped. This path is feature-detected and DISABLED where they are
// absent/partial (iOS Safari, the mobile <audio> route with no live graph). It is a
// live PERFORMANCE, not a reproducible render — the reproducible whole-loop path is
// the (still-unbuilt) offline node render. Container is whatever the browser gives
// (webm on Chromium, mp4 on Safari); the download extension is derived from it.
//
// BACKGROUND-TAB HONESTY: a hidden tab clamps setInterval to >=1s AND DemoLayer
// pauses its RAF on visibilitychange, so backgrounding mid-take freezes the video to
// ~1fps. We REFUSE to start while hidden and STOP the take if the tab is hidden mid-
// recording, with an explicit "keep this tab foreground" warning. (A full
// OffscreenCanvas-in-worker compositor that would survive backgrounding is out of
// scope for v1 — tracked in ROADMAP §2.4.)
import { S, set } from "./state.js";
import { faustHandle } from "./live.js";
import { exportProg } from "./export.js";

export const VIDEO = { recording: false };
let _rec = null, _raf = 0, _canvas = null, _stopTimer = 0, _restoreDemo = null, _progIv = 0, _visHandler = null;

function pickMime() {
  const cands = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return "";   // let the browser choose
}

// derive the file extension + a normalized container type from a MediaRecorder
// mimeType (e.g. "video/webm;codecs=vp9,opus" -> {ext:"webm",type:"video/webm"};
// "video/mp4" -> {ext:"mp4",type:"video/mp4"}). Safari records mp4, Chromium webm —
// the old hard-coded ".webm" produced an mp4 blob with the wrong extension.
function containerOf(mimeType) {
  const mt = String(mimeType || "").toLowerCase();
  if (mt.indexOf("mp4") >= 0) return { ext: "mp4", type: "video/mp4" };
  if (mt.indexOf("webm") >= 0) return { ext: "webm", type: "video/webm" };
  return { ext: "webm", type: "video/webm" };   // default when the UA gives us nothing
}

// canvas.captureStream is the load-bearing API this whole path rides on; iOS Safari
// (and any UA without it) cannot record. Feature-detect BEFORE we go through the
// motions so we can disable ⏺ with a clear message instead of emitting a broken blob.
export function canRecord() {
  if (typeof MediaRecorder === "undefined") return false;
  if (typeof HTMLCanvasElement === "undefined") return false;
  if (typeof HTMLCanvasElement.prototype.captureStream !== "function") return false;
  return true;
}

// recordVideo({seconds}) -> Promise<Blob|null>. One take at a time (VIDEO.recording).
export async function recordVideo(opts) {
  opts = opts || {};
  if (VIDEO.recording) return null;
  if (!faustHandle || !S.playing) { set({ status: "video: press ▶ LIVE first" }); return null; }
  if (typeof MediaRecorder === "undefined") { set({ status: "video: this browser has no MediaRecorder" }); return null; }
  // iOS/mobile guard: no canvas.captureStream -> no record path at all.
  if (typeof HTMLCanvasElement === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
    set({ status: "video: recording needs a desktop browser (no canvas capture here)" }); return null;
  }
  // background-tab guard: a hidden tab throttles the compositor to ~1fps.
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    set({ status: "video: keep this tab in the foreground to record" }); return null;
  }

  // audio track: the live master (msDest); fall back to the media element's stream.
  let aStream = null;
  try { aStream = faustHandle.audioStream && faustHandle.audioStream(); } catch (e) {}
  if (!aStream) { const el = faustHandle.mediaEl; try { if (el && el.captureStream) aStream = el.captureStream(); } catch (e) {} }
  // require a WORKING audio track — a silent video is a broken export (the mobile
  // <audio> route has no live-graph tap, so audioStream()/captureStream() are empty).
  const aTracks = (aStream && aStream.getAudioTracks) ? aStream.getAudioTracks() : [];
  if (!aTracks.length) { set({ status: "video: no capturable audio on this device (desktop LIVE only)" }); return null; }

  // force the visual layers on for the take (restore prior state after). The found
  // VIDEO clips composite ONLY when local (same-origin); the demoscene screen-blends
  // on top — the same look as live.
  const DL = window.DemoLayer, VL = window.VideoLayer;
  if (!((DL && DL._canvas) || (VL && VL._frontEl))) { set({ status: "video: no visual layer available" }); return null; }
  const wasDemo = DL && DL.enabled && DL.enabled();
  const wasVid = VL && VL.enabled && VL.enabled();
  if (DL && DL.setEnabled && !wasDemo) DL.setEnabled(true);
  if (VL && VL.setEnabled && VL.available && VL.available() && !wasVid) VL.setEnabled(true);
  _restoreDemo = () => {
    if (DL && DL.setEnabled && !wasDemo) try { DL.setEnabled(false); } catch (e) {}
    if (VL && VL.setEnabled && !wasVid) try { VL.setEnabled(false); } catch (e) {}
  };
  // WAIT for the demoscene to actually be RENDERING before we roll (a blank/loading
  // demo was why an earlier take was a static frame). Poll up to ~3s.
  for (let i = 0; i < 30 && !(DL && DL.available && DL.available()); i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 500));   // let a video clip load + the demo spin up

  // output canvas + a compositor: LOCAL video clip (cover-fit) under the demoscene
  // (screen blend). ATTACHED to the DOM (off-DOM captureStream is unreliable) and
  // driven at a steady 30 fps via requestFrame — a static off-DOM canvas is what
  // gave the one-frame / hour-long / VLC-crash file. A moving corner tick guarantees
  // the frame always CHANGES so no encoder de-dupes to a single keyframe.
  _canvas = document.createElement("canvas");
  _canvas.width = 960; _canvas.height = 540;
  _canvas.style.cssText = "position:fixed;left:-4px;top:-4px;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1";
  document.body.appendChild(_canvas);
  const cx = _canvas.getContext("2d", { alpha: false });
  const cover = (w, h) => { const sc = Math.max(960 / w, 540 / h); return [w * sc, h * sc]; };

  // Would compositing this <video> taint the capture canvas? Probe on a throwaway
  // 1×1 canvas so the ANSWER never poisons the real one: a tainted source makes
  // getImageData throw (drawImage itself never does). Belt-and-suspenders behind the
  // _frontKind()==="local" gate below — a mislabeled/redirected local source is
  // caught here rather than silently producing a broken blob.
  function videoTaints(vel) {
    try {
      const t = document.createElement("canvas"); t.width = 1; t.height = 1;
      const tc = t.getContext("2d"); tc.drawImage(vel, 0, 0, 1, 1); tc.getImageData(0, 0, 1, 1);
      return false;
    } catch (e) { return true; }
  }

  let _videoOk = true, _probed = false;
  VIDEO.videoComposited = false;
  const draw = () => {
    cx.globalCompositeOperation = "source-over";
    cx.fillStyle = "#0a0410"; cx.fillRect(0, 0, 960, 540);
    // VIDEO layer: LOCAL (same-origin) clips ONLY — a remote archive.org clip has no
    // crossOrigin and would silently taint the canvas -> a broken/near-static blob.
    if (_videoOk) {
      const kind = VL && VL._frontKind && VL._frontKind();
      const vel = VL && VL._frontEl && VL._frontEl();
      const usable = kind === "local" && vel && vel.readyState >= 2 && vel.videoWidth;
      if (usable && !_probed) { _probed = true; if (videoTaints(vel)) _videoOk = false; }
      if (_videoOk && usable) { try {
        const [dw, dh] = cover(vel.videoWidth, vel.videoHeight);
        cx.drawImage(vel, (960 - dw) / 2, (540 - dh) / 2, dw, dh);
        VIDEO.videoComposited = true;
      } catch (e) { _videoOk = false; } }
    }
    // DEMOSCENE: a same-origin <canvas> — never taints; screen-blended on top.
    const src = DL && DL._canvas && DL._canvas();
    if (src) { try {
      cx.globalCompositeOperation = "screen";
      const [dw, dh] = cover(src.width || 320, src.height || 240);
      cx.drawImage(src, (960 - dw) / 2, (540 - dh) / 2, dw, dh);
    } catch (e) {} }
    cx.globalCompositeOperation = "source-over";
    _tick = (_tick + 1) % 960; cx.fillStyle = "rgba(255,120,200,.9)"; cx.fillRect(_tick, 538, 3, 2);   // moving tick: never a static frame
  };
  let _tick = 0;
  draw();   // first frame before capture starts

  // captureStream(0) → we push exactly one frame per 33 ms via requestFrame while the
  // tab is FOREGROUND. (A hidden tab throttles this — see the visibilitychange guard
  // below, which stops the take rather than record ~1fps.) Wrapped in try/catch so a
  // captureStream/MediaRecorder failure fully cleans up (no stranded canvas + no
  // force-enabled layers + no orphan audio tap).
  let rec = null;
  try {
    const vStream = _canvas.captureStream(0);
    const vtrack = vStream.getVideoTracks()[0];
    const canReq = vtrack && typeof vtrack.requestFrame === "function";
    const vStream2 = canReq ? vStream : _canvas.captureStream(30);   // fallback: auto 30 fps
    VIDEO.frames = 0;
    _raf = setInterval(() => { try { draw(); if (canReq) vtrack.requestFrame(); VIDEO.frames++; } catch (e) {} }, 33);
    VIDEO.hadAudio = !!aTracks.length;
    const tracks = [...vStream2.getVideoTracks(), ...aTracks];
    const stream = new MediaStream(tracks);
    const mime = pickMime();
    rec = mime != null ? new MediaRecorder(stream, mime ? { mimeType: mime } : undefined) : null;
  } catch (e) { rec = null; }
  if (!rec) { cleanup(); set({ status: "video: recorder init failed" }); return null; }
  _rec = rec;
  VIDEO.recording = true; set({});

  // stop the take if the tab goes to the background mid-record (else it freezes to
  // ~1fps). Explicit warning; a full off-thread compositor is out of v1 scope.
  _visHandler = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      set({ status: "video: recording stopped — keep this tab in the foreground" });
      stopVideo();
    }
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", _visHandler);

  const chunks = [];
  const done = new Promise((resolve) => {
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      // container/type from the recorder's OWN mimeType (authoritative), falling back
      // to the first chunk's type — never a hard-coded webm that mislabels Safari mp4.
      const cont = containerOf(rec.mimeType || (chunks[0] && chunks[0].type));
      VIDEO.mime = rec.mimeType || (chunks[0] && chunks[0].type) || cont.type;
      VIDEO.ext = cont.ext;
      const blob = chunks.length ? new Blob(chunks, { type: VIDEO.mime || cont.type }) : null;
      cleanup();
      resolve(blob);
    };
  });
  rec.start(1000);   // 1s timeslices so we get data even on a long take
  set({ status: "video: recording…" });

  const seconds = Math.max(2, Math.min(600, +opts.seconds || 30));
  const t0 = (typeof performance !== "undefined" ? performance.now() : 0);
  exportProg(0, "recording video");
  _progIv = setInterval(() => { try { exportProg(Math.min(0.99, ((performance.now() - t0) / 1000) / seconds), "recording video"); } catch (e) {} }, 250);
  _stopTimer = setTimeout(() => { try { rec.state !== "inactive" && rec.stop(); } catch (e) {} }, seconds * 1000);

  const blob = await done;
  if (blob && !opts.noDownload) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stem = (window.__EXPORT && window.__EXPORT.fileStem && window.__EXPORT.fileStem()) || "stellate";
      a.href = url; a.download = stem + "." + (VIDEO.ext || "webm"); document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
    } catch (e) {}
  }
  set({ status: blob ? "video: saved " + Math.round(blob.size / 1024) + " KB" : "video: nothing captured" });
  return blob;
}

export function stopVideo() {
  if (_stopTimer) { clearTimeout(_stopTimer); _stopTimer = 0; }
  try { if (_rec && _rec.state !== "inactive") _rec.stop(); } catch (e) {}
}

function cleanup() {
  if (_raf) { clearInterval(_raf); _raf = 0; }   // _raf is a setInterval handle now
  if (_stopTimer) { clearTimeout(_stopTimer); _stopTimer = 0; }
  if (_progIv) { clearInterval(_progIv); _progIv = 0; } exportProg(null);
  if (_visHandler) { try { if (typeof document !== "undefined") document.removeEventListener("visibilitychange", _visHandler); } catch (e) {} _visHandler = null; }
  if (_restoreDemo) { try { _restoreDemo(); } catch (e) {} _restoreDemo = null; }
  // release the desktop audio capture tap so userGain isn't left fanned into an
  // orphan MediaStreamDestination (no-op on the mobile msDest route).
  try { if (faustHandle && faustHandle.releaseAudioStream) faustHandle.releaseAudioStream(); } catch (e) {}
  try { if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas); } catch (e) {}
  _rec = null; _canvas = null; VIDEO.recording = false; set({});
}

if (typeof window !== "undefined") window.__VIDEO = { recordVideo, stopVideo, canRecord, VIDEO };
