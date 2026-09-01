// nukernel/ui/video.js — THE VIDEO DECK. A film cut to the record's own bars.
//
// Paul, 2026-09-01, in one message: "Every video clip is the same in every
// genre, it should be very random based on feed. You should do something new
// every measure with video. You fade in new clips after the measure starts but
// it should fade in before and get to 100% on beat one. I need video controls
// for full screen etc. You should be doing wild stuff with effects rotating
// things matting them compositing two sources putting them on spheres just
// going full early 90s digital extravaganza." And: "A lot of video is upside
// down and backwards."
//
// EVERY ONE OF THOSE WAS A REAL DEFECT AND TWO WERE ONE-LINERS:
//
//   UPSIDE DOWN — a <video> uploaded to a GL texture arrives with its origin at
//   the TOP LEFT while GL samples from the BOTTOM LEFT. Without
//   UNPACK_FLIP_Y_WEBGL every frame is vertically mirrored. It is the most
//   ordinary WebGL mistake there is and I shipped it.
//
//   BACKWARDS — my mirror was `q.x = 0.5 - abs(q.x - 0.5)`, which folds the
//   RIGHT half onto the left and then samples the left half REVERSED. A kaleido
//   fold should map both halves outward from the seam, not turn the picture
//   over. Both halves now read outward from centre.
//
//   THE SAME CLIP EVERYWHERE — the salt was `doc.basis.genre || doc.basis.id`,
//   and when neither key exists that is `undefined` for every record in the
//   catalogue, so every song hashed identically and drew the same film. It is
//   now salted with the whole basis object AND the bar number, so a different
//   record is a different film and no two bars are the same.
//
// THE CUT IS PER MEASURE. It was per section — 8 to 12 bars of one clip, which
// is a slideshow. Every bar takes a new source, a new in-point and a new
// effect, and the fade STARTS BEFORE THE BARLINE and reaches 1.0 exactly on
// beat one, which is his instruction and is also just how a cut on a downbeat
// has to work: arriving at full only after the beat reads as late.
//
// TWO SOURCES, ALWAYS. A and B alternate, so while one plays the other is
// already loading and seeking — that is what makes a per-bar cut possible at
// all — and the shader has both, so a bar can COMPOSITE rather than just
// switch: matte one through the other's luma, difference them, or split them
// down the middle.
//
// OFFLINE LAW: same-origin clips, inline shader, nothing imported at runtime.

import { CLIPS, VIDEO_DIR } from "./video-clips.js";

const ihash = (s) => { let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0; };

/* THE LOOKS — nine of them, and the early-90s brief is taken literally: this is
   the vocabulary of a Quantel Paintbox and a Video Toaster, which is what "full
   early 90s digital extravaganza" means. Each is a MODE the shader branches on,
   plus how hard it is pushed. A bar draws one. */
const MODES = ["straight", "kaleido", "spin", "sphere", "matte", "difference",
               "split", "posterize", "rgbsplit"];

const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D texA, texB, prev;
uniform float mode, amt, t, fade, feedback, sat, spin, xfade;
uniform sampler2D texN;   // the INCOMING clip, rising before the barline
const float PI = 3.14159265;

vec2 rot(vec2 q, float a){
  q -= 0.5; float c = cos(a), s = sin(a);
  return vec2(q.x * c - q.y * s, q.x * s + q.y * c) + 0.5;
}
// a hemisphere: the picture wrapped onto a ball, the single most 1993 gesture
vec2 sphere(vec2 q){
  vec2 d = q - 0.5; float r = length(d) * 2.0;
  if (r > 1.0) return q;
  float z = sqrt(1.0 - r * r);
  return 0.5 + d * (1.0 / (0.55 + z * 0.75));
}
vec3 grade(vec3 c, float s){
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(vec3(l), c, s);
}
void main(){
  vec2 q = uv;
  vec3 a, b, o;
  // the spin is global and slow — every mode rides it, which is what keeps the
  // picture moving even on the plain ones
  if (spin > 0.001) q = rot(q, spin);

  if (mode < 0.5) {                    // straight
    o = texture2D(texA, q).rgb;
  } else if (mode < 1.5) {             // kaleido — BOTH halves outward, not folded over
    vec2 k = q; k.x = 0.5 + abs(k.x - 0.5) * (1.0 + amt);
    k.y = 0.5 + abs(k.y - 0.5) * (1.0 + amt);
    o = texture2D(texA, fract(k)).rgb;
  } else if (mode < 2.5) {             // spin — a harder rotation on top of the global one
    o = texture2D(texA, rot(q, t * amt)).rgb;
  } else if (mode < 3.5) {             // sphere
    o = texture2D(texA, sphere(q)).rgb;
  } else if (mode < 4.5) {             // matte — B keyed through A's luma
    a = texture2D(texA, q).rgb; b = texture2D(texB, q).rgb;
    float l = dot(a, vec3(0.299, 0.587, 0.114));
    o = mix(b, a, smoothstep(0.35 - amt * 0.3, 0.65 + amt * 0.3, l));
  } else if (mode < 5.5) {             // difference — the Toaster's own trick
    a = texture2D(texA, q).rgb; b = texture2D(texB, rot(q, 0.15)).rgb;
    o = abs(a - b);
  } else if (mode < 6.5) {             // split — A left, B right, hard seam
    o = (q.x < 0.5 ? texture2D(texA, q) : texture2D(texB, q)).rgb;
  } else if (mode < 7.5) {             // posterize
    float st = 3.0 + floor(amt * 5.0);
    o = floor(texture2D(texA, q).rgb * st) / st;
  } else {                             // rgbsplit — chroma pulled apart
    float d = 0.004 + amt * 0.02;
    o = vec3(texture2D(texA, q + vec2(d, 0.0)).r,
             texture2D(texA, q).g,
             texture2D(texA, q - vec2(d, 0.0)).b);
  }
  /* THE CROSSFADE FINISHES ON THE DOWNBEAT. Paul: "You fade in new clips after
     the measure starts but it should fade in before and get to 100% on beat
     one." So xfade runs 0 to 1 across the last third of a second BEFORE the
     barline and is exactly 1 when the bar turns over. Arriving at full after
     the beat is what reads as late, which is what he saw.
     (No backticks in here: this is inside a template literal, and the pair I
     first wrote around the uniform name closed the string. Caught by the
     syntax check before it shipped.) */
  if (xfade > 0.001) o = mix(o, texture2D(texN, q).rgb, xfade);
  o = grade(o, sat);
  vec3 p = texture2D(prev, (uv - 0.5) * 0.998 + 0.5).rgb;
  gl_FragColor = vec4(max(o * fade, p * feedback), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error("video shader: " + gl.getShaderInfoLog(s));
  return s;
}

export function mountVideo(host, CTX) {
  host.textContent = "";
  const doc = CTX && CTX.doc ? CTX.doc() : null;
  const secs = (doc && doc.form && doc.form.sections) || [];
  const wrap = document.createElement("div");
  wrap.className = "nu-video";
  host.appendChild(wrap);
  if (!CLIPS.length || !secs.length) {
    const p = document.createElement("p");
    p.textContent = CLIPS.length ? "This record has no sections yet."
                                 : "No clips — run node tools/video-manifest.js.";
    wrap.appendChild(p); return () => {};
  }

  const stage = document.createElement("div");
  stage.className = "nu-video-stage";
  const canvas = document.createElement("canvas");
  canvas.width = 720; canvas.height = 540;
  canvas.className = "nu-video-canvas";
  stage.appendChild(canvas);
  wrap.appendChild(stage);

  /* CONTROLS — his "I need video controls for full screen etc". Fullscreen on
     the STAGE and not the canvas, so the controls stay reachable inside it. */
  const bar = document.createElement("div");
  bar.className = "nu-video-controls";
  const mk = (label, fn) => { const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.addEventListener("click", fn);
    bar.appendChild(b); return b; };
  let paused = false;
  const bPause = mk("pause", () => { paused = !paused; bPause.textContent = paused ? "play" : "pause"; });
  mk("cut", () => { cur = pick((Math.random() * 1e6) | 0); loadInto(vids[slot], cur); });
  /* FULL SCREEN, WITH THE WEBKIT SPELLINGS (2026-09-01). Paul: "Full screen
     does nothing." Measured in Chromium it worked — requestFullscreen resolved
     and document.fullscreenElement was set — which is exactly why the report
     mattered: SAFARI does not implement the unprefixed call on a plain element
     and needs `webkitRequestFullscreen`, so the button was a no-op there and
     fine everywhere I was testing. Both spellings, both directions, and a
     `<video>` fallback for iOS, which refuses fullscreen on anything but a
     media element. */
  const goFull = () => {
    const d = document;
    const on = d.fullscreenElement || d.webkitFullscreenElement;
    if (on) { (d.exitFullscreen || d.webkitExitFullscreen || (() => {})).call(d); return; }
    const req = stage.requestFullscreen || stage.webkitRequestFullscreen ||
                stage.webkitRequestFullScreen || stage.msRequestFullscreen;
    if (req) { try { req.call(stage); return; } catch {} }
    // iOS: only a media element may go fullscreen at all
    const v = vids[slot];
    if (v && v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch {} }
  };
  mk("full screen", goFull);
  wrap.appendChild(bar);

  const vids = [0, 1].map(() => { const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.loop = true; v.preload = "auto";
    v.style.display = "none"; wrap.appendChild(v); return v; });

  const strip = document.createElement("ol");
  strip.className = "nu-video-form";
  const cells = secs.map((s) => { const li = document.createElement("li");
    li.className = "nu-video-sec";
    const nm = document.createElement("b"); nm.textContent = s.role || "section";
    const bs = document.createElement("span"); bs.textContent = (s.bars || 0) + " bars";
    li.append(nm, bs); strip.appendChild(li); return li; });
  wrap.appendChild(strip);
  const cap = document.createElement("p");
  cap.className = "nu-video-cap"; wrap.appendChild(cap);

  const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
  if (!gl) { cap.textContent = "WebGL is unavailable here."; return () => {}; }
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
  // THE ONE LINE THAT WAS MISSING. Without it every frame is upside down.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const mkTex = () => { const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 0]));
    return t; };
  const texA = mkTex(), texB = mkTex(), prevTex = mkTex();
  const U = (n) => gl.getUniformLocation(prog, n);

  // the record's own clock
  const bpm = (doc && doc.time && doc.time.bpm) || 100;
  const barSec = (60 / bpm) * 4;
  const salt = ihash(JSON.stringify((doc && doc.basis) || {}) + "/" + secs.length +
                     "/" + bpm) >>> 0;
  const bars = [];                       // bar index -> section index
  secs.forEach((s, i) => { for (let b = 0; b < Math.max(1, s.bars || 4); b++) bars.push(i); });
  const totalBars = bars.length, total = totalBars * barSec;
  /* FOUR MEASURES A CLIP, TWO MEASURES OF FADE (2026-09-01). Paul, revising
     his own earlier "something new every measure": "Video should change every
     four measures. The video should fade far more slowly in it should take two
     measures to fade in."
     A bar-per-clip at 103bpm is a cut every 2.3 seconds, which is a strobe
     rather than a film; four bars is a phrase, and it is also the length of
     the shortest section this box makes. The fade then occupies HALF the
     block: the incoming clip starts rising two bars before the change and is
     at full exactly on the downbeat of the new block — the same "100% on beat
     one" rule as before, just over eight beats instead of a third of a second,
     so the two pictures genuinely live together for a while. */
  const BLOCK = 4;                       // bars per clip
  const FADE_BARS = 2;                   // ...and how many of them the fade takes

  /* ONE EFFECT PER SONG (2026-09-01). Paul: "Pick one effect per song." Then,
     of the per-bar cutting he had asked for an hour earlier: "I was wrong
     about how jittery it needs to be."
     So the LOOK is a property of the record — drawn once from the same salt as
     everything else, so a given song always gets the same treatment and two
     songs get different ones — and only the CLIP changes, every four bars. A
     film that switches technique every few seconds is a demo reel; one that
     holds a technique and changes its subject is a film. The nine modes are
     still all reachable, just one per record rather than nine per minute. */
  const songMode = MODES[(salt >>> 8) % MODES.length];
  const songAmt = ((salt >>> 16) & 255) / 255;
  const pick = (block) => {
    const h = ihash(salt + "/" + block);
    return { clip: CLIPS[h % CLIPS.length],
             mode: songMode,
             amt: songAmt,
             inAt: (((h >>> 20) & 1023) / 1023) };
  };

  /* THE RECORD'S CLOCK, NOT THE WALL'S (2026-09-01). Paul: "Video shouldn't
     play unless music is playing I think there's a lot to check when it comes
     to sync." Both halves were true. This loop ran on performance.now(), so it
     cut bars with the transport stopped and its bar number was its own
     invention. It now reads CTX.transport() — `atStep`, the absolute step the
     clock last announced, and `playing` — which is the feed the board's meters
     already use and the rule this file was breaking: a view reads the
     position, it never keeps a clock.
     STOPPED MEANS HELD, not black: the last frame stays up and the <video>
     elements are paused, so the deck looks like a paused film rather than a
     broken one. */
  const readT = () => (CTX && CTX.transport ? CTX.transport()
                                            : { playing: false, atStep: -1, spb: 16 });
  let nextBar = -1, cur = pick(0), incoming = null, slot = 0, raf = 0, dead = false;
  let wasPlaying = false;

  const loadInto = (v, choice) => {
    v.src = VIDEO_DIR + choice.clip.f;
    const go = () => { const d = v.duration || choice.clip.d || 10;
      try { v.currentTime = Math.min(d - 0.1, choice.inAt * Math.max(0, d - 1)); } catch {}
      v.play().catch(() => {}); };
    if (v.readyState >= 1) go(); else v.addEventListener("loadedmetadata", go, { once: true });
  };
  loadInto(vids[0], cur);

  const frame = () => {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const T = readT();
    const rolling = T.playing && T.atStep >= 0 && !paused;
    if (!rolling) {
      // hold: pause the sources once, leave the last frame on the canvas
      if (wasPlaying) { vids.forEach((v) => v.pause()); wasPlaying = false; }
      cap.textContent = T.playing ? "paused" : "stopped — press play";
      return;
    }
    if (!wasPlaying) { vids.forEach((v) => v.play().catch(() => {})); wasPlaying = true; }
    // THE BAR IS THE RECORD'S. atStep counts steps from the top of the song;
    // spb is this record's own steps-per-bar (a waltz is not sixteen).
    const spb = T.spb || 16;
    const absBar = Math.floor(T.atStep / spb);
    const bar = ((absBar % totalBars) + totalBars) % totalBars;
    const into = ((T.atStep % spb) / spb) * barSec;     // seconds into this bar
    const el = absBar * barSec + into;
    // the BLOCK is what a clip lasts; the bar is only how we count toward it
    const block = Math.floor(absBar / BLOCK);
    const barsIntoBlock = (absBar % BLOCK) + into / barSec;
    const barsToNext = BLOCK - barsIntoBlock;

    // ARM THE NEXT BLOCK two bars early, so the fade has somewhere to run from
    if (barsToNext <= FADE_BARS && nextBar !== block + 1) {
      nextBar = block + 1;
      incoming = pick(nextBar);
      loadInto(vids[1 - slot], incoming);
    }
    if (nextBar === block && incoming) { cur = incoming; incoming = null; slot = 1 - slot; }
    if (nextBar === -1) { nextBar = block; cur = pick(block); loadInto(vids[slot], cur); }

    // 0 -> 1 across the last two bars of the block; exactly 1 on the downbeat
    const xfade = barsToNext <= FADE_BARS ? 1 - (barsToNext / FADE_BARS) : 0;

    const A = vids[slot], B = vids[1 - slot];
    if (A.readyState >= 2) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, A);
      gl.uniform1i(U("texA"), 0);
    }
    if (B.readyState >= 2) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, B);
      gl.uniform1i(U("texB"), 1);
    }
    // the incoming clip is the OTHER slot, which has been loading since PRE
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.uniform1i(U("texN"), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(U("prev"), 2);
    gl.uniform1f(U("mode"), MODES.indexOf(cur.mode));
    gl.uniform1f(U("amt"), cur.amt);
    gl.uniform1f(U("t"), el);
    gl.uniform1f(U("fade"), 1);
    gl.uniform1f(U("xfade"), xfade);
    gl.uniform1f(U("feedback"), 0.18 + cur.amt * 0.3);
    gl.uniform1f(U("sat"), 0.7 + cur.amt * 0.7);
    gl.uniform1f(U("spin"), (cur.mode === "spin" ? 0 : cur.amt * 0.25) * Math.sin(el * 0.11));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGB, 0, 0, canvas.width, canvas.height, 0);

    const si = bars[bar % totalBars];
    cells.forEach((li, k) => li.classList.toggle("on", k === si));
    cap.textContent = "bar " + (bar + 1) + "/" + totalBars + " · " +
      (secs[si].role || "section") + " · " + cur.mode +
      (xfade > 0 ? " → " + Math.round(xfade * 100) + "%" : "") + " · " +
      cur.clip.f.replace(/\.mp4$/, "");
  };
  raf = requestAnimationFrame(frame);
  return () => { dead = true; cancelAnimationFrame(raf);
                 vids.forEach((v) => { v.pause(); v.src = ""; }); };
}
