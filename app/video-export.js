// video-export.js — E (whole-loop VIDEO), v1: realtime MediaRecorder capture.
//
// Records the LIVE demoscene visuals + the live master audio to a .webm, with
// NO 30MB ffmpeg.wasm dependency — the browser's built-in MediaRecorder muxes a
// canvas.captureStream() video track with the engine's msDest audio track
// (faustHandle.audioStream()). Realtime: it records for `seconds` of the journey
// as it plays (the loop travels through its genres on its own).
//
// CORS-SAFE: the found-video clips are now all LOCAL (found/video/*.mp4, same-
// origin — 243 committed), so the front clip composites into the capture canvas
// without tainting it, with the demoscene screen-blended on top (the live look).
// Both layers are force-enabled for the take so the frame is never black; a rare
// remote-fallback clip that would taint is caught and skipped (demo-only frame).
//
// v1 scope + honesty: MediaRecorder is a real-browser API (flaky/absent headless),
// so this is verified on a real browser like the iOS-pinch fix. webm output.
import { S, set } from "./state.js";
import { faustHandle } from "./live.js";
import { exportProg } from "./export.js";

export const VIDEO = { recording: false };
let _rec = null, _raf = 0, _canvas = null, _stopTimer = 0, _restoreDemo = null, _progIv = 0;

function pickMime() {
  const cands = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return "";   // let the browser choose
}

// recordVideo({seconds}) -> Promise<Blob|null>. One take at a time (VIDEO.recording).
export async function recordVideo(opts) {
  opts = opts || {};
  if (VIDEO.recording) return null;
  if (!faustHandle || !S.playing) { set({ status: "video: press ▶ LIVE first" }); return null; }
  if (typeof MediaRecorder === "undefined") { set({ status: "video: this browser has no MediaRecorder" }); return null; }

  // audio track: the live master (msDest); fall back to the media element's stream.
  let aStream = null;
  try { aStream = faustHandle.audioStream && faustHandle.audioStream(); } catch (e) {}
  if (!aStream) { const el = faustHandle.mediaEl; try { if (el && el.captureStream) aStream = el.captureStream(); } catch (e) {} }

  // force the visual layers on for the take (restore prior state after). The found
  // VIDEO clips are LOCAL (found/video/*.mp4, same-origin) so they composite without
  // tainting; the demoscene screen-blends on top — the same look as live.
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
  // demo was why the earlier take was a static frame). Poll up to ~3s.
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
  let _tick = 0;
  const draw = () => {
    cx.globalCompositeOperation = "source-over";
    cx.fillStyle = "#0a0410"; cx.fillRect(0, 0, 960, 540);
    const vel = VL && VL._frontEl && VL._frontEl();
    if (vel && vel.readyState >= 2 && vel.videoWidth) { try {
      const [dw, dh] = cover(vel.videoWidth, vel.videoHeight);
      cx.drawImage(vel, (960 - dw) / 2, (540 - dh) / 2, dw, dh);
    } catch (e) {} }
    const src = DL && DL._canvas && DL._canvas();
    if (src) { try {
      cx.globalCompositeOperation = "screen";
      const [dw, dh] = cover(src.width || 320, src.height || 240);
      cx.drawImage(src, (960 - dw) / 2, (540 - dh) / 2, dw, dh);
    } catch (e) {} }
    cx.globalCompositeOperation = "source-over";
    _tick = (_tick + 1) % 960; cx.fillStyle = "rgba(255,120,200,.9)"; cx.fillRect(_tick, 538, 3, 2);   // moving tick: never a static frame
  };
  draw();   // first frame before capture starts

  // captureStream(0) → we push exactly one frame per 33 ms via requestFrame, so the
  // pace is steady regardless of RAF throttling (a background tab won't stall it).
  const vStream = _canvas.captureStream(0);
  const vtrack = vStream.getVideoTracks()[0];
  const canReq = vtrack && typeof vtrack.requestFrame === "function";
  const vStream2 = canReq ? vStream : _canvas.captureStream(30);   // fallback: auto 30 fps
  VIDEO.frames = 0;
  _raf = setInterval(() => { try { draw(); if (canReq) vtrack.requestFrame(); VIDEO.frames++; } catch (e) {} }, 33);
  VIDEO.hadAudio = !!(aStream && aStream.getAudioTracks && aStream.getAudioTracks().length);
  const tracks = [...vStream2.getVideoTracks(), ...(aStream ? aStream.getAudioTracks() : [])];
  const stream = new MediaStream(tracks);
  const mime = pickMime();
  let rec; try { rec = mime != null ? new MediaRecorder(stream, mime ? { mimeType: mime } : undefined) : null; }
  catch (e) { rec = null; }
  if (!rec) { cleanup(); set({ status: "video: recorder init failed" }); return null; }
  _rec = rec;
  VIDEO.recording = true; set({});

  const chunks = [];
  const done = new Promise((resolve) => {
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = chunks.length ? new Blob(chunks, { type: chunks[0].type || "video/webm" }) : null;
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
      a.href = url; a.download = stem + ".webm"; document.body.appendChild(a); a.click();
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
  if (_restoreDemo) { try { _restoreDemo(); } catch (e) {} _restoreDemo = null; }
  try { if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas); } catch (e) {}
  _rec = null; _canvas = null; VIDEO.recording = false; set({});
}

if (typeof window !== "undefined") window.__VIDEO = { recordVideo, stopVideo, VIDEO };
