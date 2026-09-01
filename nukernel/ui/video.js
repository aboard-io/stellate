// nukernel/ui/video.js — THE VIDEO DECK. A film cut to the record's own form.
//
// Paul, 2026-09-01: "add a major icon and section: Video. Use the prior work we
// did on screensavers and archive.org video clips to automatically assemble
// video clips with rich effects using in-browser WebGL ... Show the video in
// the browsers with some song structure information under it as an alpha."
//
// THE PRIOR WORK WAS FOUND FIRST, as instructed, and it decided two things.
// SOURCES.md documents a whole retired system: `video-layer.js` streamed cue
// windows {item, file, in, out} out of archive.org against a committed
// stream-catalog, with `fetch-found-video.sh` baking the same windows to small
// silent MP4s in `found/video/` as the offline tier. That is where the 242
// local clips came from and it is why this file needs no fetcher.
//
// AND THE LEDGER DECIDED WHAT MAY BE SHOWN. It is blunt that most of the
// withdrawn material is tier-2/tier-3 — "none stated" licences on LaserDisc
// rips, "precisely the tier-3 case where no licence chain exists to comply
// with". So this deck plays the `av_` tier ONLY: the 1920s-30s abstract film
// the same ledger records as PD by age and CC Public Domain Mark 1.0 —
// Ruttmann's Opus I, Eggeling's Symphonie Diagonale, Moholy-Nagy, Ballet
// Mecanique. 97 clips. tools/video-manifest.js writes the list and takes no
// other prefix.
//
// WHY THAT MATERIAL IS ALSO THE RIGHT MATERIAL: those films are the first
// abstract animation there was — shapes moving in time against music that had
// not been written yet. Cutting them to a record composed a century later is
// the same idea running in the other direction, which is a better reason to
// use them than "they are the ones we may".
//
// THE CUT IS THE RECORD'S OWN FORM. One clip per SECTION, chosen by a hash of
// (record, seed, section index) so the same song always assembles the same
// film — the determinism law, applied to pictures. A section's ROLE picks the
// effect, so an intro looks like an intro and a chorus opens up.
//
// OFFLINE LAW: every byte is same-origin (found/video/…), the shader is inline,
// and nothing here fetches or imports off the page.

import { CLIPS, VIDEO_DIR } from "./video-clips.js";

/* ---------- the deterministic pick ---------- */
// FNV-1a, the same salt shape compose.js uses for its own seeded streams
const ihash = (s) => { let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0; };

/* ---------- what each role looks like ----------
   Six numbers a shader can read, and each is a WORD the arrangement already
   says rather than a taste I invented: how much the frame is mirrored, how
   much of the last frame bleeds into this one, saturation, contrast, a slow
   drift, and the posterise step. A drop is high contrast and no bleed; a
   chorus opens the mirror; an intro is soft and desaturated. */
const LOOK = {
  intro:      { mirror: 0, feedback: 0.34, sat: 0.55, contrast: 0.90, drift: 0.06, steps: 0 },
  verse:      { mirror: 0, feedback: 0.22, sat: 0.85, contrast: 1.00, drift: 0.03, steps: 0 },
  prechorus:  { mirror: 1, feedback: 0.30, sat: 0.95, contrast: 1.08, drift: 0.05, steps: 0 },
  build:      { mirror: 1, feedback: 0.38, sat: 1.00, contrast: 1.10, drift: 0.08, steps: 0 },
  chorus:     { mirror: 2, feedback: 0.28, sat: 1.25, contrast: 1.15, drift: 0.02, steps: 0 },
  drop:       { mirror: 2, feedback: 0.10, sat: 1.35, contrast: 1.40, drift: 0.00, steps: 6 },
  bridge:     { mirror: 1, feedback: 0.42, sat: 0.70, contrast: 0.95, drift: 0.09, steps: 0 },
  breakdown:  { mirror: 0, feedback: 0.50, sat: 0.45, contrast: 0.85, drift: 0.10, steps: 0 },
  solo:       { mirror: 1, feedback: 0.20, sat: 1.10, contrast: 1.05, drift: 0.04, steps: 0 },
  outro:      { mirror: 0, feedback: 0.46, sat: 0.50, contrast: 0.88, drift: 0.07, steps: 0 },
};
const lookOf = (role) => LOOK[role] || LOOK.verse;

const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

/* The whole picture is one pass over two textures: this frame's video and the
   last frame we drew. Feedback is what makes a 25-second silent film look like
   it belongs to a record — it smears motion into the tempo rather than sitting
   on top of it. */
const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D vid, prev;
uniform float mirror, feedback, sat, contrast, drift, steps, t, fade;
vec3 grade(vec3 c){
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, sat);
  c = (c - 0.5) * contrast + 0.5;
  if (steps > 0.5) c = floor(c * steps) / steps;
  return c;
}
void main(){
  vec2 q = uv;
  if (mirror > 0.5) q.x = 0.5 - abs(q.x - 0.5);      // fold left/right
  if (mirror > 1.5) q.y = 0.5 - abs(q.y - 0.5);      // ...and top/bottom
  vec3 c = texture2D(vid, q).rgb;
  // the previous frame, pulled very slightly toward the centre: a drift, not a zoom
  vec2 d = (uv - 0.5) * (1.0 - drift * 0.02) + 0.5;
  vec3 p = texture2D(prev, d).rgb;
  vec3 o = max(grade(c) * fade, p * feedback);
  gl_FragColor = vec4(o, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error("video shader: " + gl.getShaderInfoLog(s));
  return s;
}

/** The deck. Returns a stop() so a tab rebuild cannot leave a loop running. */
export function mountVideo(host, CTX) {
  host.textContent = "";
  const doc = CTX && CTX.doc ? CTX.doc() : null;
  const secs = (doc && doc.form && doc.form.sections) || [];
  const wrap = document.createElement("div");
  wrap.className = "nu-video";
  host.appendChild(wrap);

  if (!CLIPS.length || !secs.length) {
    const p = document.createElement("p");
    p.textContent = !CLIPS.length
      ? "No clips in the crate — run node tools/video-manifest.js."
      : "This record has no sections yet.";
    wrap.appendChild(p);
    return () => {};
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 480;
  canvas.className = "nu-video-canvas";
  wrap.appendChild(canvas);

  const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.loop = true;
  video.crossOrigin = "anonymous";
  video.style.display = "none";
  wrap.appendChild(video);

  /* THE STRUCTURE, UNDER THE PICTURE — "some song structure information under
     it", and the honest version of that is the form itself: every section in
     order, its role, its bars, and which one is on screen now. */
  const strip = document.createElement("ol");
  strip.className = "nu-video-form";
  const cells = secs.map((s, i) => {
    const li = document.createElement("li");
    li.className = "nu-video-sec";
    const nm = document.createElement("b");
    nm.textContent = s.role || "section";
    const bars = document.createElement("span");
    bars.textContent = (s.bars || 0) + " bars";
    li.append(nm, bars);
    strip.appendChild(li);
    return li;
  });
  wrap.appendChild(strip);

  const cap = document.createElement("p");
  cap.className = "nu-video-cap";
  wrap.appendChild(cap);

  // one clip per section, deterministic in (record, seed, index)
  const key = (doc && doc.basis && (doc.basis.genre || doc.basis.id)) || "record";
  const seed = (doc && doc.basis && doc.basis.seed) || 1;
  const forSec = secs.map((s, i) =>
    CLIPS[ihash(key + "/" + seed + "/vid/" + i) % CLIPS.length]);

  if (!gl) {
    cap.textContent = "WebGL is unavailable here, so the film cannot be graded.";
    return () => {};
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const mkTex = () => { const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t; };
  const vidTex = mkTex(), prevTex = mkTex();
  gl.bindTexture(gl.TEXTURE_2D, prevTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE,
                new Uint8Array([0, 0, 0]));
  const U = (n) => gl.getUniformLocation(prog, n);

  // the record's own clock: seconds per section, off its bars and tempo
  const bpm = (doc && doc.time && doc.time.bpm) || 100;
  const barSec = (60 / bpm) * 4;
  const spans = secs.map((s) => Math.max(1, (s.bars || 4) * barSec));
  const total = spans.reduce((a, b) => a + b, 0);

  let at = -1, t0 = performance.now(), raf = 0, dead = false;
  const show = (i) => {
    if (i === at) return;
    at = i;
    const c = forSec[i];
    video.src = VIDEO_DIR + c.f;
    video.play().catch(() => {});
    cells.forEach((li, k) => li.classList.toggle("on", k === i));
    cap.textContent = (secs[i].role || "section") + " · " + c.f.replace(/\.mp4$/, "") +
                      " · " + lookName(secs[i].role);
  };
  const lookName = (role) => {
    const L = lookOf(role);
    return (L.mirror === 2 ? "mirrored both ways" : L.mirror === 1 ? "mirrored" : "straight") +
           ", feedback " + L.feedback.toFixed(2) + ", sat " + L.sat.toFixed(2);
  };

  const frame = () => {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const el = ((performance.now() - t0) / 1000) % total;
    let acc = 0, i = 0;
    for (; i < spans.length; i++) { if (el < acc + spans[i]) break; acc += spans[i]; }
    show(Math.min(i, spans.length - 1));
    if (video.readyState < 2) return;
    const L = lookOf(secs[at].role);
    const into = Math.min(1, (el - acc) / 0.6);          // a short fade at each cut
    gl.bindTexture(gl.TEXTURE_2D, vidTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, vidTex);
    gl.uniform1i(U("vid"), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(U("prev"), 1);
    gl.uniform1f(U("mirror"), L.mirror);
    gl.uniform1f(U("feedback"), L.feedback);
    gl.uniform1f(U("sat"), L.sat);
    gl.uniform1f(U("contrast"), L.contrast);
    gl.uniform1f(U("drift"), L.drift);
    gl.uniform1f(U("steps"), L.steps);
    gl.uniform1f(U("t"), el);
    gl.uniform1f(U("fade"), into);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // this frame becomes next frame's `prev` — the feedback path
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGB, 0, 0, canvas.width, canvas.height, 0);
  };
  raf = requestAnimationFrame(frame);

  return () => { dead = true; cancelAnimationFrame(raf); video.pause(); video.src = ""; };
}
