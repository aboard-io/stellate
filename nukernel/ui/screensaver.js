// nukernel/ui/screensaver.js — THE STAR MAP, BACK AS A SCREENSAVER.
//
// Paul, 2026-09-01: "Bring back the screensaver from stellate as a new view
// like the video view."
//
// WHAT CAME BACK, AND WHAT STAYED IN THE GRAVE. The source is the old
// explorer at `daw-first:screensaver.html` ("the daw is the front door; the
// star map becomes the screensaver", f4bc7bf) and its chart in
// `daw-first:app/map/draw.js`. What this file ports is the DRAWING — the dark
// #0c0a1a field, stars with soft region-colored halos, a dashed cyan
// constellation line over a #45e0ff under-glow, the pink breathing traveler,
// the watermark-faint territory label, genre names beside the bright stars.
// What it does NOT port is everything that made the explorer an app: the POS
// layout, ZOOM, gestures, waypoint editing, the demoscene backdrop, the 48 KB
// starcruise. A screensaver is a picture that moves; the record is the only
// input it takes.
//
// A VIEW READS THE POSITION, IT NEVER KEEPS A CLOCK (the video deck's law,
// ui/eight.js CTX.transport). The traveler's progress and the field's drift
// are arithmetic on `atStep`/`spb` — a bar advanced is a leg walked and a few
// pixels drifted — eased on screen because atStep announces in ~60ms jumps
// (video.js: "good for knowing which bar it is, visibly steppy for anything
// that moves every frame"). Only the twinkle and the breath run on the wall
// clock, and neither is a position: stopped means HELD — the field freezes
// where the record stopped and only shimmers, exactly as the old chart's
// pulse idled when the traveler parked (draw.js `traveling()`).
//
// LAZY IS LAW, AND LEAVING MEANS STOPPING. Nothing here runs until
// mountScreensaver is called — which ui/eight.js only does when the tab
// opens — and the rAF does not survive the tab closing: a MutationObserver
// watches the host's `data-off` (the attribute showTab writes) and parks the
// loop the frame the panel goes dark, then revives it when the tab reopens.
// That is one honest step past the video deck, whose loop idles by returning
// early; a screensaver that kept 60 rAF ticks under a shut panel would be the
// page paying for a picture nobody can see. test/screensaver-lazy.js measures
// both edges off `window.__saverFrames`.
//
// OFFLINE LAW: no fetch, no image, no font file — every star is arithmetic
// and fillText. GENRES comes from ./deps.js, which ui/eight.js already
// imported: zero new requests, ever.

import { GENRES } from "./deps.js";

/* the same FNV the video deck salts its cuts with — a different record is a
   different sky, and the same record is the same sky forever */
const ihash = (s) => { let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0; };
const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* the old map's paint, verbatim: layout.js's ten region colors, draw.js's
   star/halo/traveler/waypoint hexes, index.html's #0c0a1a theme-color */
const BG = "#0c0a1a";
const REGION = ["#6a5cff", "#22c1dc", "#34d17a", "#ffd23f", "#ff7233",
                "#ff5c8a", "#b06bff", "#9bd93a", "#ff9e3d", "#ff3d5a"];
const STAR = "#e6e0ff", HOT = "#ffd7ee", PINK = "#ff6ec7", RING = "#ff8fd6";
const LINE = "#8ef2ff", UNDER = "#45e0ff", WP = "#ffd86b";
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'; // nu.css --mono

export function mountScreensaver(host, CTX) {
  host.textContent = "";
  const doc = CTX && CTX.doc ? CTX.doc() : null;
  const basis = (doc && doc.basis) || "stellate";
  const row = GENRES[basis] || {};
  const label = row.label || String(basis);

  // the panel's hidden name, first — the deck-heads-itself law, see
  // video.js's block of the same date (buildTab clears the host, so the
  // builder owns the heading the way every axis does)
  const vh = document.createElement("h2");
  vh.className = "nu-vh"; vh.textContent = "The sky";
  host.appendChild(vh);
  const wrap = document.createElement("div");
  wrap.className = "nu-saver";
  host.appendChild(wrap);
  const stage = document.createElement("div");
  stage.className = "nu-saver-stage";
  const canvas = document.createElement("canvas");
  canvas.className = "nu-saver-canvas";
  stage.appendChild(canvas);
  wrap.appendChild(stage);

  /* the video deck's control bar, reused whole (class and all): same page,
     same buttons, same 44px floor from nu.css `button { min-height: --tap }` */
  const bar = document.createElement("div");
  bar.className = "nu-video-controls";
  const mk = (l, fn) => { const b = document.createElement("button");
    b.type = "button"; b.textContent = l; b.addEventListener("click", fn);
    bar.appendChild(b); return b; };
  /* FULL SCREEN, WITH THE WEBKIT SPELLINGS — video.js's goFull, minus the
     <video> fallback: there is no media element here and iOS will simply
     refuse a canvas, which is a refusal and not a bug to paper over. */
  mk("full screen", () => {
    const d = document;
    const on = d.fullscreenElement || d.webkitFullscreenElement;
    if (on) { (d.exitFullscreen || d.webkitExitFullscreen || (() => {})).call(d); return; }
    const req = stage.requestFullscreen || stage.webkitRequestFullscreen ||
                stage.webkitRequestFullScreen || stage.msRequestFullscreen;
    if (req) { try { req.call(stage); } catch {} }
  });
  wrap.appendChild(bar);
  /* A SCREENSAVER EXITS ON A TOUCH — that is the whole genre. In fullscreen
     the stage is the entire display and the bar (outside it) is unreachable,
     so a tap on the sky itself is the way back out; measured 2026-09-01 when
     the probe's second click found nothing but canvas to hit. */
  stage.addEventListener("click", () => {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement)
      (d.exitFullscreen || d.webkitExitFullscreen || (() => {})).call(d);
  });
  const cap = document.createElement("p");
  cap.className = "nu-video-cap";
  cap.textContent = "the sky over " + label;
  wrap.appendChild(cap);

  const ctx2 = canvas.getContext("2d");
  if (!ctx2) { cap.textContent = "no 2d canvas here"; return () => {}; }

  /* ==== THE SKY, DEALT ONCE FROM THE RECORD'S OWN HASH ==================
     Normalized coordinates in [0,1); the frame scales them to whatever box
     the stage has, so fullscreen is the same sky bigger, not a new deal. */
  const rnd = mulberry(ihash(JSON.stringify((doc && doc.basis) || basis)));
  const tint = REGION[(ihash(String(basis)) >>> 4) % REGION.length];
  /* three parallax layers — the old chart's galaxy-zoom feel, flattened into
     depth: far stars drift at 0.15x of the near field */
  const LAYERS = [
    { sp: 0.15, stars: [] }, { sp: 0.45, stars: [] }, { sp: 1.0, stars: [] },
  ];
  LAYERS.forEach((L, li) => {
    const n = [110, 60, 26][li];
    for (let i = 0; i < n; i++) L.stars.push({
      x: rnd(), y: rnd(),
      r: [0.9, 1.4, 2.2][li] * (0.6 + rnd()),
      halo: li === 2 || rnd() < 0.12,             // the old inactive halo, r 8
      c: REGION[(rnd() * REGION.length) | 0],
      tw: rnd() * Math.PI * 2,                     // twinkle phase
      rate: 0.6 + rnd() * 1.8,
    });
  });
  /* a few named stars: real vocabulary off the shelf, the way the chart drew
     every genre's LABEL and never its id. Section keys eight.js plants in
     GENRES have labels too, so filter to strings and dedupe. */
  const names = [...new Set(Object.values(GENRES)
    .map((g) => g && g.label).filter((l) => typeof l === "string"))];
  const near = LAYERS[2].stars;
  for (let i = 0; i < Math.min(14, near.length, names.length); i++)
    near[i].name = names[(rnd() * names.length) | 0];
  /* five planets on the near layer — soft-shaded discs in region colors, the
     one indulgence the flat chart never had and a screensaver wants */
  const planets = [];
  for (let i = 0; i < 5; i++) planets.push({
    x: rnd(), y: rnd(), r: 8 + rnd() * 16,
    c: REGION[(rnd() * REGION.length) | 0],
    moon: rnd() < 0.6, ph: rnd() * Math.PI * 2, sp: 0.2 + rnd() * 0.5,
  });
  /* the constellation: seven waypoints, closed loop (draw.js: "repeat
     waypoint[0] at the end so the line draws the closing leg") */
  const wps = [];
  for (let i = 0; i < 7; i++)
    wps.push({ x: 0.12 + rnd() * 0.76, y: 0.14 + rnd() * 0.72, flare: 0 });

  /* ==== THE CLOCK IT READS =============================================== */
  const readT = () => (CTX && CTX.transport ? CTX.transport()
                                            : { playing: false, atStep: -1, spb: 16 });
  let raf = 0, dead = false, parked = false;
  let drift = 0, walk = 0, lastBar = -1;   // eased screen positions
  if (typeof window.__saverFrames !== "number") window.__saverFrames = 0;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const fit = () => { const r = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } };
  const ro = new ResizeObserver(fit);
  ro.observe(stage);

  let lastNow = performance.now();
  const frame = () => {
    if (dead || parked) return;
    raf = requestAnimationFrame(frame);
    window.__saverFrames++;
    const now = performance.now(), dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    const W = canvas.width, H = canvas.height;
    if (!W || !H) return;
    const T = readT();
    const spb = T.spb || 16;
    const bars = T.atStep >= 0 ? T.atStep / spb : 0;   // the record's own ruler
    /* ease toward the record's position; hold it when stopped. The targets
       are pure functions of atStep, so a stopped transport is a fixed sky. */
    const ease = Math.min(1, dt * 4);
    drift += (bars * 26 - drift) * ease;               // px per bar, near layer
    window.__saverDrift = drift;   // headless probe: proves the transport ARRIVES at the field (declared-but-never-arriving is this box's characteristic bug)
    walk += (bars / 2 - walk) * ease;                  // one leg per two bars
    const absBar = Math.floor(bars);
    if (T.playing && absBar !== lastBar) {             // a barline: flare the waypoint just reached
      lastBar = absBar;
      wps[Math.floor(absBar / 2) % wps.length].flare = 1;
    }

    ctx2.fillStyle = BG; ctx2.fillRect(0, 0, W, H);
    const S = Math.min(W, H) / 700;                    // one scale for all geometry

    /* the territory watermark — the old region label, wearing this record's
       word ("watermark-faint ... never fights the UI") */
    ctx2.save();
    ctx2.font = "700 " + Math.max(24, 52 * S) + "px " + MONO;
    ctx2.fillStyle = tint; ctx2.globalAlpha = 0.09;
    ctx2.textAlign = "center";
    ctx2.fillText(label, W / 2, H * 0.5);
    ctx2.restore();

    for (const [li, L] of LAYERS.entries()) {
      const off = drift * L.sp * S;
      for (const st of L.stars) {
        const x = ((st.x * W - off) % W + W) % W;
        const y = st.y * H;
        const tw = 0.72 + 0.28 * Math.sin(now / 1000 * st.rate + st.tw);
        if (st.halo) { ctx2.globalAlpha = 0.10 * tw;
          ctx2.fillStyle = st.c;
          ctx2.beginPath(); ctx2.arc(x, y, 8 * S * (li === 2 ? 1 : 0.6), 0, 7); ctx2.fill(); }
        ctx2.globalAlpha = (li === 2 ? 0.95 : 0.75) * tw;
        ctx2.fillStyle = STAR;
        ctx2.beginPath(); ctx2.arc(x, y, st.r * S, 0, 7); ctx2.fill();
        if (st.name) { ctx2.globalAlpha = 0.5 * tw;
          ctx2.font = Math.max(9, 12 * S) + "px " + MONO;
          ctx2.textAlign = "left";
          ctx2.fillText(st.name, x + 9 * S, y + 4 * S); }
      }
    }
    ctx2.globalAlpha = 1;

    for (const p of planets) {
      const x = ((p.x * W - drift * 1.25 * S) % W + W) % W, y = p.y * H, r = p.r * S;
      const g = ctx2.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.25, p.c); g.addColorStop(1, "#0a0818");
      ctx2.globalAlpha = 0.12; ctx2.fillStyle = p.c;
      ctx2.beginPath(); ctx2.arc(x, y, r * 1.8, 0, 7); ctx2.fill();   // halo
      ctx2.globalAlpha = 0.9; ctx2.fillStyle = g;
      ctx2.beginPath(); ctx2.arc(x, y, r, 0, 7); ctx2.fill();
      if (p.moon) { const a = p.ph + now / 1000 * p.sp;
        ctx2.globalAlpha = 0.8; ctx2.fillStyle = STAR;
        ctx2.beginPath();
        ctx2.arc(x + Math.cos(a) * r * 2.3, y + Math.sin(a) * r * 0.7, Math.max(1.2, r * 0.14), 0, 7);
        ctx2.fill(); }
    }
    ctx2.globalAlpha = 1;

    /* the constellation, in the chart's two strokes: wide #45e0ff under-glow,
       thin dashed #8ef2ff over it */
    const P = wps.map((w) => [w.x * W, w.y * H]);
    const loop = P.concat([P[0]]);
    ctx2.lineJoin = "round";
    ctx2.strokeStyle = UNDER; ctx2.lineWidth = 4 * S; ctx2.globalAlpha = 0.18;
    ctx2.beginPath(); loop.forEach(([x, y], i) => i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y)); ctx2.stroke();
    ctx2.strokeStyle = LINE; ctx2.lineWidth = Math.max(1, 1.2 * S);
    ctx2.setLineDash([4 * S, 5 * S]); ctx2.globalAlpha = 0.85;
    ctx2.beginPath(); loop.forEach(([x, y], i) => i ? ctx2.lineTo(x, y) : ctx2.moveTo(x, y)); ctx2.stroke();
    ctx2.setLineDash([]);
    wps.forEach((w, i) => { const [x, y] = P[i];
      if (w.flare > 0.01) { ctx2.globalAlpha = 0.5 * w.flare; ctx2.fillStyle = WP;
        ctx2.beginPath(); ctx2.arc(x, y, (10 + 26 * (1 - w.flare)) * S, 0, 7); ctx2.fill();
        w.flare *= Math.pow(0.25, dt); }
      ctx2.globalAlpha = 0.9; ctx2.fillStyle = WP;
      ctx2.beginPath(); ctx2.arc(x, y, 3.5 * S, 0, 7); ctx2.fill(); });

    /* the traveler: reticle + core straight out of draw.js, gliding the loop;
       the breath only breathes while the record plays (its old rule) */
    const seg = Math.floor(walk) % wps.length, f = walk - Math.floor(walk);
    const a = P[seg], b = P[(seg + 1) % wps.length];
    const cx = a[0] + (b[0] - a[0]) * f, cy = a[1] + (b[1] - a[1]) * f;
    if (T.playing) { const ph = (Math.sin(now / 1000 * 2.2) + 1) / 2;  // the 1.4s breath
      ctx2.globalAlpha = 0.10 + ph * 0.13; ctx2.fillStyle = PINK;
      ctx2.beginPath(); ctx2.arc(cx, cy, (30 + ph * 10) * S, 0, 7); ctx2.fill(); }
    ctx2.globalAlpha = 0.5; ctx2.strokeStyle = PINK; ctx2.lineWidth = 1.4 * S;
    ctx2.beginPath(); ctx2.arc(cx, cy, 24 * S, 0, 7); ctx2.stroke();
    ctx2.globalAlpha = 1; ctx2.strokeStyle = RING; ctx2.lineWidth = 2.6 * S;
    ctx2.beginPath(); ctx2.arc(cx, cy, 16 * S, 0, 7); ctx2.stroke();
    ctx2.fillStyle = PINK;
    ctx2.beginPath(); ctx2.arc(cx, cy, 4.5 * S, 0, 7); ctx2.fill();
    ctx2.globalAlpha = 0.9; ctx2.fillStyle = HOT;
    ctx2.font = Math.max(10, 13 * S) + "px " + MONO; ctx2.textAlign = "left";
    ctx2.fillText(label, cx + 30 * S, cy + 4 * S);
    ctx2.globalAlpha = 1;
  };

  /* THE TAB CLOSING IS THE OFF SWITCH. showTab writes `data-off` on every
     panel but the open one; this observer is the only listener cheap enough
     to leave armed — it fires on that one attribute and nothing else. */
  const mo = new MutationObserver(() => {
    const off = host.hasAttribute("data-off");
    if (off && !parked) { parked = true; cancelAnimationFrame(raf); raf = 0; }
    else if (!off && parked && !dead) { parked = false; lastNow = performance.now();
      fit(); raf = requestAnimationFrame(frame); }
  });
  mo.observe(host, { attributes: true, attributeFilter: ["data-off"] });

  fit();
  raf = requestAnimationFrame(frame);
  return () => { dead = true; cancelAnimationFrame(raf); raf = 0;
                 mo.disconnect(); ro.disconnect(); };
}
