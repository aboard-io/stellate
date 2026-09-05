// nukernel/ui/screensaver.js — THE LITTLE ALIENS, DANCING.
//
// Paul, 2026-09-01: *"screensaver is just a bunch of stars. It should be the
// little aliens dancing, not the infinite wandering."* And, later the same
// evening, on the plan that proposed redrawing them as 2D silhouettes on the
// existing canvas: *"Why not three js? It's fine. Don't reinvent."*
//
// SO THE REAL ALIENS CAME BACK. Not a picture of them: the creatures
// themselves, `f0f9d89:app/starcruise/alien.js` + `traits.js` + `geom.js`,
// ported into ./starcruise/ byte-for-byte (one import path in alien.js is the
// only edit, and ./starcruise/from-doc.js is the only new code). three.js r160
// is re-vendored at /vendor/three/ from the same commit.
//
// ---- WHAT THIS REVERSES, WRITTEN BESIDE WHAT IT REVERSED ------------------
//
// 2026-09-01 stood here and still stands as the reason the star chart existed:
//   "WHAT CAME BACK, AND WHAT STAYED IN THE GRAVE. The source is the old
//   explorer at `daw-first:screensaver.html` ... What it does NOT port is
//   everything that made the explorer an app: the POS layout, ZOOM, gestures,
//   waypoint editing, the demoscene backdrop, the 48 KB starcruise. A
//   screensaver is a picture that moves; the record is the only input it
//   takes."
// REVERSED IN PART, 2026-09-02, by the sentence at the top of this file. The
// half that stays true is the last one — the record is still the only input
// this view takes, and there is still no layout, no zoom, no gesture and no
// waypoint editing. What comes back is the CREATURES and nothing else around
// them: no ship, no flight, no camera rig, no planets, no post-fx chain, no
// backdrop city. 2026-08-20's "the band, alone" (4a4d730) said the star cruise
// was retired deliberately; Paul's word above is the word it said it needed.
//
// 2026-09-01 OFFLINE LAW stood here as: "no fetch, no image, no font file —
// every star is arithmetic and fillText ... zero new requests, ever." AMENDED
// 2026-09-02, not deleted: the law was always about THE WIRE. Nothing here
// reaches the network; three.js and the creature modules are files on the same
// disk the page was served from, `import()`ed lazily so a reader who never
// opens this tab never pays for them. test/screensaver-lazy.js S6 no longer
// filters for media — it counts EVERY request the tab makes and names those
// local modules as the sanctioned exception, so a genuinely foreign fetch
// (which the old media-only regex would have waved through) now fails it.
//
// ---- THE CONTRACT THIS FILE STILL KEEPS ----------------------------------
//
// A VIEW READS THE POSITION, IT NEVER KEEPS A CLOCK. `CTX.transport()` is the
// only position: `playing` and `atStep` decide whether and how far the troupe's
// musical clock advances, and `CTX.onPos` (the same feed, one announcement a
// beat) names WHICH BAR of the record is sounding so a member's alien can be
// handed its own notes. The wall clock does exactly one job, the sanctioned
// one: it interpolates BETWEEN those announcements (atStep arrives in ~60 ms
// jumps) and it drives the stars' twinkle. STOPPED MEANS HELD: with `playing`
// false the musical delta is zero, `alien.update(0, …)` freezes every creature
// mid-pose, and only the shimmer keeps moving.
//
// LAZY IS LAW, AND LEAVING MEANS STOPPING. `mountScreensaver` is SYNCHRONOUS
// and returns its stop() immediately (ui/eight.js:9454 calls the handle on the
// next rebuild, so a Promise here would throw). The rAF starts on that same
// tick and counts frames from the first one; the three.js import is fired off
// beside it and the rig is built a creature per frame as it lands, so the loop
// never blocks and never waits. stop() cancels a pending import, disposes the
// renderer and every geometry/material the troupe owns. The `data-off`
// MutationObserver parks the loop the frame the panel goes dark, exactly as
// before — parking stops the loop, it does not dispose the context, because
// coming back has to be instant.
//
// THE RECORD'S OWN HASH DEALS THE TROUPE: "a different record is a different
// sky, and the same record is the same sky forever" — the same FNV salt over
// `doc.basis` now seeds the star field AND every creature, so one record is one
// cast of aliens, forever.

import { GENRES } from "./deps.js";
/* the one catalogue of words (TABLE.md §12b). */
import { t } from "./copy.js";
import { songBars } from "./derive.js";
import { SONG, SLOTS, GROOVE, SWING, RUBATO } from "./state.js";

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

const BG = 0x0c0a1a;                       // the old chart's field, kept
/* CATEGORY COLOUR = WHICH PLAYER. Six hues, mirroring hw.css --v0..--v3 / --vb
   / --drum, which COMPOSER.md §2.10 lifts into nu.css as tokens in wave 1b.
   Read from the document element first so this file inherits that lift the day
   it lands; the literals below are the fallback until then, and they are
   hw.css:89-90's own numbers, not a second opinion. */
const VFALL = ["#1f8fd6", "#1f9d63", "#8b5cf0", "#d1478f"];
const BASSFALL = "#7a8188", DRUMFALL = "#6b7280";
function categoryPaint() {
  let cs = null;
  try { cs = getComputedStyle(document.documentElement); } catch (e) { cs = null; }
  const v = (k, fb) => { const s = cs ? (cs.getPropertyValue(k) || "").trim() : ""; return s || fb; };
  return { line: VFALL.map((fb, i) => v("--v" + i, fb)),
           bass: v("--vb", BASSFALL), drums: v("--drum", DRUMFALL) };
}
/* which of the six a member wears: its KIND first, then its index among the
   line voices — the same order desk-doc.js channelVoicesOf draws the board in */
function paintForVoice(P, voices, i) {
  const v = voices[i] || {};
  if (v.kind === "drums") return P.drums;
  if (v.kind === "bass") return P.bass;
  let li = 0;
  for (let j = 0; j < i; j++) { const k = (voices[j] || {}).kind;
    if (k !== "drums" && k !== "bass") li++; }
  return P.line[li % P.line.length];
}
/* WHICH STARCRUISE ROLE A DOCUMENT VOICE IS. alien.js switches on these seven
   words (its ROLE_VOICE table); the document's own `kind` and `cast.part` are
   the owners of the answer and nothing is invented here. */
function roleOfVoice(v) {
  if (!v) return "perc";
  if (v.kind === "drums") return "drum";
  if (v.kind === "bass") return "bass";
  return (v.cast && v.cast.part) === "pad" ? "pad" : "lead";
}

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
  vh.className = "nu-vh"; vh.textContent = t("saver.title");
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
  mk(t("video.fullScreen"), () => {
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
  /* THE CAPTION IS THE RECORD'S NAME. It used to read "the band of Kingston
     1969"; the name is the caption, and the four words in front of it were
     house voice rather than information. */
  cap.textContent = label;
  wrap.appendChild(cap);

  /* ==== THE PROBES, SET SYNCHRONOUSLY ==================================
     S1 of test/screensaver-lazy.js proves these do not exist before the tab
     is opened, and S2/S3 read them 1200 ms after it is — so they are written
     on the mount tick, never inside the import's `then`. */
  let raf = 0, dead = false, parked = false, killed = false;
  if (typeof window.__saverFrames !== "number") window.__saverFrames = 0;
  window.__saverDrift = 0;
  window.__saverTroupe = [];
  /* ...AND ONE MORE, WHICH IS A COST AND NOT A CONTRACT. `__saverReady` goes
     true when the rig stands and the last creature has walked on. It exists
     because `new WebGLRenderer()` is a synchronous call whose cost is the
     BROWSER'S, not this file's: measured 2026-09-02 on a real machine it is
     milliseconds, and in the headless chromium the gates run — no GPU, ANGLE
     falling back to swiftshader — it is TWELVE SECONDS of frozen main thread
     before it returns. Nothing here can make that faster, and a gate that
     sampled the frame counter across it would be measuring the CI box's
     rasteriser and calling it the screensaver. So the flag is published and
     test/screensaver-lazy.js waits on it before it starts counting. */
  window.__saverReady = false;

  /* ==== THE RECORD, READ ONCE ==========================================
     The bar list is the SAME walk audio/plan.js:524 makes — songBars over the
     live state, rubato and all — so the aliens and the engine are reading one
     score. It is re-derived when CTX.doc() stops being the object we planned
     from, which is what setDocument hands the page. */
  let plannedDoc = null, PLAN = null, TRAITS = null, dealtBasis = null;
  const rebuildPlan = (d) => {
    plannedDoc = d;
    let bars = [];
    try { bars = songBars(SONG, SLOTS, GROOVE, SWING, null, { rubato: RUBATO }) || []; }
    catch (e) { bars = []; }
    try { PLAN = FROMDOC ? FROMDOC.planFromDoc(d, bars) : null; } catch (e) { PLAN = null; }
  };

  /* ==== THE CLOCK IT READS ============================================== */
  const readT = () => (CTX && CTX.transport ? CTX.transport()
                                            : { playing: false, atStep: -1, spb: 16 });
  /* ...AND THE BAR IT IS ON. `atStep` counts inside the BOX (eight.js's
     `inBox`), so it cannot say which bar of the RECORD is sounding; the "pos"
     announcement can, and it is the same clock — `d.bar` IS `curBar.n`, the
     index audio/plan.js barPlan() takes. One announcement a beat is plenty for
     picking a bucket of notes; the smooth part still comes off atStep.
     There is no unsubscribe on CTX.onPos (eight.js:1093, "on() returns nothing
     today"), so the handler checks `dead` and returns — a stopped saver's
     closure costs one comparison a beat and writes nothing. */
  let posBar = 0, posBpm = 0;
  if (CTX && CTX.onPos) try {
    CTX.onPos((d) => { if (dead || !d) return;
      if (d.bar != null) posBar = d.bar | 0;
      if (d.bpm) posBpm = +d.bpm; });
  } catch (e) { /* a CTX without the feed still animates off transport() */ }

  /* declared BEFORE fit(), which reads RIG: a ResizeObserver callback is async
     so it could not have fired inside the temporal dead zone, but a reader
     should not have to know that to believe the file. */
  let THREE = null, FROMDOC = null, makeAlien = null, RIG = null;
  let queue = [], built = [];

  /* THE BOX IS STILL THE CSS'S. `setSize(w, h, false)` writes the drawing
     buffer and leaves the style alone, so nu.css's `inline-size:100%;
     aspect-ratio:16/9` (and the two fullscreen spellings) keep deciding how big
     the picture is, exactly as they did when this was a 2D canvas. */
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 1, H = 1;
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width || 320));
    H = Math.max(1, Math.round(r.height || W * 9 / 16));
    if (RIG) { RIG.renderer.setSize(W, H, false);
               RIG.camera.aspect = W / H; RIG.camera.updateProjectionMatrix();
               frameCamera(); } };
  const ro = new ResizeObserver(fit);
  ro.observe(stage);

  /* ==== THE LAZY IMPORT ================================================
     `starcruise-load.js`'s single-flight pattern: one import, a cancel flag,
     and a synchronous handle that has already been returned by the time this
     resolves. three.js is 670 KB of local file — a reader who never opens this
     tab never asks for it. */
  Promise.all([
    import("../../vendor/three/three.module.min.js"),
    import("./starcruise/from-doc.js"),
    import("./starcruise/alien.js"),
  ]).then(([three, fd, al]) => {
    if (dead) return;
    THREE = (three && three.WebGLRenderer) ? three : (three && three.default) || three;
    FROMDOC = fd; makeAlien = al.makeAlien;
    startRig();
  }).catch((e) => {
    if (dead) return;
    /* NO SILENT GREY: a refusal says so, in the caption the deck already has.
       The EXCEPTION goes to the console, where whoever can act on it is
       looking; a user is told the floor is unavailable, not handed a stack. */
    console.error("screensaver:", e);
    cap.textContent = t("saver.noFloor");
  });

  /* ==== THE RIG ========================================================
     The minimum stage the old dancer gate stood the creatures on
     (f0f9d89:test/starcruise/alien-dancer.test.js:45-56): an ambient light, one
     directional key, a perspective camera. No ship, no flight, no post-fx. */
  function startRig() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    } catch (e) { renderer = null; }
    if (!renderer || !renderer.getContext || !renderer.getContext()) {
      cap.textContent = t("saver.noFloor");
      return;
    }
    renderer.setPixelRatio(dpr);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.add(new THREE.AmbientLight(0x8899aa, 0.7));
    const key = new THREE.DirectionalLight(0xffeedd, 0.9);
    key.position.set(3, 6, 4); scene.add(key);
    const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 400);
    RIG = { renderer, scene, camera, key, owned: [] };
    fit();

    const rnd = mulberry(ihash(JSON.stringify(basis)));

    /* THE STARS STAY, FAINT, BEHIND — the one thing the old sky keeps. Points
       on a far shell, dealt from the record's own stream, so the same record
       still has the same sky. */
    const N = 420, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1), r = 120 + rnd() * 60;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.7 - 10;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const sm = new THREE.PointsMaterial({ color: 0xe6e0ff, size: 1.6,
      sizeAttenuation: false, transparent: true, opacity: 0.5 });
    const stars = new THREE.Points(sg, sm);
    scene.add(stars); RIG.stars = stars; RIG.owned.push(sg, sm);

    /* the floor, so a hop reads as a hop: one dark disc, no grid, no city */
    const fgeo = new THREE.CircleGeometry(14, 40);
    const fmat = new THREE.MeshStandardMaterial({ color: 0x161233, roughness: 0.95, metalness: 0 });
    const floor = new THREE.Mesh(fgeo, fmat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01;
    scene.add(floor); RIG.owned.push(fgeo, fmat);

    dealTroupe((CTX && CTX.doc) ? CTX.doc() : doc);
  }

  /* ==== THE TROUPE, DEALT FROM THE RECORD ==============================
     One alien per band member, in DOC.voices order, wearing that member's
     category colour; then 0..4 extras — the old traits.js:611-620 energy gate,
     capped at four, and refused outright by a record whose own bars measure
     silent. The hash is `doc.basis`'s, so the same record deals the same cast
     for ever and a different record deals a different one; that is the star
     chart's own contract, kept.

     THIS RUNS AGAIN WHEN THE RECORD CHANGES UNDER THE PANEL. It has to: a
     saver left open while a hand picks another genre would otherwise keep the
     old band standing there, holding instruments nobody hired, with `mi`
     indices pointing into a voices array that no longer has those seats. */
  function dealTroupe(d) {
    if (!RIG) return;
    dealtBasis = (d && d.basis) || basis;
    const brow = GENRES[dealtBasis] || row;
    rebuildPlan(d);
    try { TRAITS = FROMDOC.traitsFromDoc(d, brow, (ihash(String(dealtBasis)) & 0xffff) || 1); }
    catch (e) { TRAITS = null; }
    const voices = (d && d.voices) || [];
    const P = categoryPaint();
    const band = (TRAITS && TRAITS.band) || [];
    const instFor = (role) => {
      const hit = band.find((b) => b.role === role) || band.find((b) => b.role === "lead") || band[0];
      return hit ? hit.instrument : null;
    };
    queue = [];
    voices.forEach((v, i) => {
      const role = roleOfVoice(v);
      queue.push({ member: { role, voice: "m" + i,
                             instrument: instFor(role) || undefined },
                   seed: (ihash(String(dealtBasis) + "/" + i) & 0x7fffffff) || 1,
                   mi: i, extra: false, paint: paintForVoice(P, voices, i) });
    });
    const quiet = !PLAN || PLAN.meanLoud < 0.06;
    const nExtra = quiet ? 0 : Math.min(4, (TRAITS && TRAITS.dancers) || 0);
    for (let e = 0; e < nExtra; e++)
      queue.push({ member: { role: "dancer" },
                   seed: (ihash(String(dealtBasis) + "/x" + e) & 0x7fffffff) || 1,
                   mi: -1, extra: true, paint: null });
    /* the probe, and the answer the dancers gate reads: one entry per alien,
       members first in DOC.voices order, then the extras */
    window.__saverTroupe = queue.map((q) => ({
      role: q.member.role, extra: q.extra, mi: q.mi,
      voice: q.mi >= 0 ? ((voices[q.mi] || {}).name || null) : null,
      paint: q.paint }));
    cap.textContent = (brow && brow.label) || String(dealtBasis);
    /* the blank state (`silence`) has no voices and earns no extras, so nobody
       ever walks on and buildOne never runs: an empty floor is READY the
       moment the rig stands. */
    window.__saverReady = !queue.length;
  }

  /* everything the troupe owns leaves the scene with it — the dispose walk
     f0f9d89:app/starcruise/scene.js:955-961 made, used here and in stop() */
  function dropTroupe() {
    if (!RIG) { built = []; queue = []; return; }
    for (const b of built) {
      try { RIG.scene.remove(b.al.group);
            b.al.group.traverse((o) => {
              if (o.geometry) o.geometry.dispose();
              const m = o.material;
              if (Array.isArray(m)) m.forEach((x) => x && x.dispose && x.dispose());
              else if (m && m.dispose) m.dispose();
            }); } catch (e) { /* already gone */ }
    }
    built = []; queue = [];
  }

  /* ONE CREATURE A FRAME. makeAlien bakes a marching-cubes body core at build
     time — cheap enough once, too slow to do eight of in a single tick — so the
     troupe walks onto the floor one dancer per frame while the loop keeps
     running. The frame counter is already advancing by then, which is what S2
     measures. */
  function buildOne() {
    const q = queue.shift();
    if (!q) return;
    let al = null;
    try { al = makeAlien(THREE, TRAITS || {}, q.member, q.seed); } catch (e) { al = null; }
    if (!al) return;
    if (q.paint) {                       // the member's category colour, worn
      try {
        const c = new THREE.Color(q.paint);
        for (const m of (al.materials || [])) {
          if (!m || !m.color) continue;
          if (m === al.materials[1] || m === al.materials[3]) m.color.copy(c);
        }
      } catch (e) { /* a material that will not take a colour keeps its own */ }
    }
    RIG.scene.add(al.group);
    built.push({ al, mi: q.mi, extra: q.extra });
    layout();
    if (!queue.length) window.__saverReady = true;
  }

  /* THE FLOOR PLAN (f0f9d89:app/starcruise/scene.js:726-750, in spirit — a ring
     of dancers, not the ship's flight path). The band first, in DOC.voices
     order, then the extras behind them, in ROWS OF FOUR: a single line of
     eleven creatures is a frieze, and framing it puts every dancer at a
     twelfth of the picture. Rows step back and half a place sideways so nobody
     stands directly behind anybody.

     THE SPACING IS MEASURED, NOT GUESSED, and it is measured at 0.80 of the
     widest creature's BOX on purpose: a starcruise alien's bounding box is its
     tentacle and light-ball reach, wider than the body a viewer reads as the
     dancer, so a full-box gap leaves them standing in separate rooms. The
     first pass at this used the full box on ONE row and the floor came out as
     eleven ants across the middle of an empty picture (measured 2026-09-02:
     the troupe filled 49% of the width and 12% of the height). Re-run after
     every creature walks on, so the floor is legible at one dancer and at
     eleven. */
  /* ===== IT IS A RING NOW, WHICH IS WHAT THE PARAGRAPH ABOVE ALWAYS SAID
     (2026-09-02) ==========================================================
     The header of this block has read *"a ring of dancers, not the ship's
     flight path"* since the day it was written, and what stood under it was
     `PERROW = 4` and three rows stepped back. The probe of 2026-09-02 measured
     what that looks like: *"Screensaver: the 11 aliens stand on nearly one
     spot (a blob)."* Rows put two thirds of the troupe BEHIND the front three,
     the camera frames the whole box, and a dancer eleven twelfths of the way
     back is a dancer you cannot see — which is the same complaint Paul made
     about the stars ("it should be the little aliens dancing").

     A RING PUTS EVERY DANCER ON ONE CURVE and nobody behind anybody. The
     arithmetic is two numbers and no magic: neighbours stand `w` apart along
     the arc (the same measured spacing the rows used — 0.80 of the widest
     creature's box, and that 0.80 keeps its own paragraph above), and the arc
     is at most ARC radians so the ring never closes into a circle whose far
     side has its back to you. RADIUS FOLLOWS FROM THOSE TWO — `R = n·w / ARC`,
     floored at `w` so a solo dancer is not standing on a pinhead — which means
     a bigger band draws a bigger ring rather than a tighter one.
     THE CENTRE OF THE ARC IS AT THE ORIGIN AND THE ENDS CURVE AWAY from the
     camera (`z = R − R·cos θ`), so the middle of the troupe is nearest and the
     ends turn in: a stage, read from the front row of the stalls.
     EACH TURNS ALONG THE RADIUS by half its own angle — full rotation would
     show the ends in profile, none would make the ring look like a straight
     line with a bend in it.

     AND THE FLOOR IS PUBLISHED (`window.__saverFloor`), which is the only
     honest way to make a claim about geometry testable: three.js needs a real
     GL context and the machine this was written on has none (the canvas falls
     back to "no 3D here"), so the numbers go on the artifact where a machine
     that HAS one can read them back. It is the same discipline `__saverDrift`
     and `__saverFrames` already follow. */
  const ARC = Math.PI * 1.15;          // ~207° — a stage, never a closed circle
  function layout() {
    if (!RIG || !built.length) return;
    const box = new THREE.Box3(), size = new THREE.Vector3();
    const widthOf = (b) => { box.setFromObject(b.al.group); box.getSize(size);
                             return Math.max(0.5, size.x); };
    const order = built.filter((b) => !b.extra).concat(built.filter((b) => b.extra));
    const n = order.length;
    const w = Math.max.apply(null, order.map(widthOf)) * 0.80;
    const R = Math.max(w, (n * w) / ARC);
    const step = w / R;                          // the angle one place subtends
    const floor = [];
    order.forEach((b, i) => {
      const th = (i - (n - 1) / 2) * step;
      const x = R * Math.sin(th), z = R - R * Math.cos(th);
      b.al.group.position.set(x, 0, -z);
      b.al.group.rotation.y = -th * 0.5;
      floor.push({ x: +x.toFixed(3), z: +(-z).toFixed(3),
                   extra: !!b.extra });
    });
    window.__saverFloor = { n, w: +w.toFixed(3), r: +R.toFixed(3), at: floor };
    frameCamera();
  }

  /* THE CAMERA FRAMES WHATEVER IS ON THE FLOOR — no rig, no flight, no gesture,
     no auto-cut. It solves the distance BOTH ways: the vertical field is the
     camera's own fov, the horizontal one is that fov widened by the aspect, and
     the troupe has to fit inside both or a wide floor is cropped on a phone. */
  function frameCamera() {
    if (!RIG) return;
    if (!built.length) { RIG.camera.position.set(0, 1.6, 7); RIG.camera.lookAt(0, 1, 0); return; }
    const box = new THREE.Box3();
    for (const b of built) box.expandByObject(b.al.group);
    const size = new THREE.Vector3(), mid = new THREE.Vector3();
    box.getSize(size); box.getCenter(mid);
    const pad = 1.06;                                   // a hand's breadth of air
    const vFov = (RIG.camera.fov * Math.PI) / 180;
    const asp = Math.max(0.3, RIG.camera.aspect || 16 / 9);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * asp);
    const distV = (size.y * pad * 0.5) / Math.tan(vFov / 2);
    const distH = (size.x * pad * 0.5) / Math.tan(hFov / 2);
    /* KEEP IT CHARMING AND SMALL, BUT NOT DISTANT. The far clamp is the one
       compositional rule this view states: a dancer is about an eighth of the
       stage, so the camera never backs further off than eight creature-heights
       even if that crops the ends of a very wide floor. A screensaver of ants
       is not the little aliens dancing. */
    const dist = Math.min(Math.max(2.2, distV, distH), Math.max(6, size.y * 7)) + size.z * 0.5;
    /* a little above the heads, looking a little down: the rows behind the band
       are only visible from above the front row's shoulders. */
    RIG.camera.position.set(0, mid.y + size.y * 0.46, box.max.z + dist);
    RIG.camera.lookAt(0, mid.y * 0.88, mid.z);
  }

  /* ==== THE FRAME ======================================================= */
  let lastNow = performance.now();
  let lastBarsPos = null, phase = 0;
  const SHARED = 1.9;          // alien.js:2044's shared groove rate, verbatim
  const frame = () => {
    if (dead || parked) return;
    raf = requestAnimationFrame(frame);
    window.__saverFrames++;
    const now = performance.now();
    const dtWall = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;

    const T = readT();
    const spb = T.spb || 16;
    const playing = !!T.playing && T.atStep >= 0;
    const barsPos = T.atStep >= 0 ? T.atStep / spb : 0;   // bars INSIDE the box
    const bpm = posBpm || (plannedDoc && plannedDoc.time && plannedDoc.time.bpm) || 120;

    /* HOW FAR THE RECORD MOVED SINCE THE LAST FRAME, in bars. atStep restarts
       at every box, so a negative or absurd delta is a box boundary and not a
       rewind: on those frames the wall clock supplies the same bar's worth of
       time it would have supplied anyway (the sanctioned exception — this is
       interpolation between the transport's announcements, never a position of
       its own). With the transport stopped the delta is zero and every creature
       holds mid-pose. */
    let dBars = 0;
    if (playing) {
      const beatsPerBar = spb / 4;
      const nominal = dtWall * (bpm / 60) / Math.max(1, beatsPerBar);
      dBars = lastBarsPos == null ? nominal : barsPos - lastBarsPos;
      if (!(dBars >= 0) || dBars > 2) dBars = nominal;
    }
    lastBarsPos = playing ? barsPos : null;
    /* THE ARRIVAL PROOF. `__saverDrift` is the troupe's accumulated beat phase
       — the number alien.js's dancer branch calls `beat` when the floor is
       locked (clock × 1.9). It grows only while the transport says the record
       is moving, so a field that never hears the transport can never grow it.
       ("declared but never arriving" is this box's characteristic bug; this
        line is the only reason the value is published at all.) */
    const dtMus = dBars * (60 / Math.max(30, bpm)) * (spb / 4);
    phase += dtMus * SHARED;
    window.__saverDrift = phase;

    if (!RIG) return;                    // still importing: the loop counts on

    /* THE RECORD CAN BE SWAPPED UNDER THE PANEL — one identity check a frame.
       A new document with the same basis is an edit (a motif changed, a member
       joined): the bar plan is re-derived and the cast stands. A new BASIS is a
       different record, and a different record is a different band. */
    const nowDoc = (CTX && CTX.doc) ? CTX.doc() : plannedDoc;
    if (nowDoc !== plannedDoc) {
      if (nowDoc && nowDoc.basis !== dealtBasis) { dropTroupe(); dealTroupe(nowDoc); }
      else rebuildPlan(nowDoc);
    }

    if (queue.length && makeAlien) buildOne();

    /* SHIMMER — the one thing that keeps moving when the record is stopped.
       Not a position: a twinkle. */
    const shim = 0.5 + 0.14 * Math.sin(now / 1400);
    if (RIG.stars) RIG.stars.material.opacity = shim;
    RIG.key.intensity = 0.9 + 0.05 * Math.sin(now / 2100);

    /* WHICH BAR, AND WHERE IN IT. The bar is the record's (the "pos" feed);
       the phase inside it is atStep's, which advances four times a beat. */
    const nb = PLAN && PLAN.numBars ? PLAN.numBars : 1;
    const bi = ((posBar % nb) + nb) % nb;
    const bar = PLAN && PLAN.bars ? PLAN.bars[bi] : null;
    const barPhase = barsPos - Math.floor(barsPos);
    const loud = bar ? bar.loud : 0;

    for (const b of built) {
      const slot = bar && b.mi >= 0 ? bar.byMember[b.mi] : null;
      const ctx = b.extra
        /* an EXTRA is a dancer: no notes, the whole room's level. Quiet and it
           keeps its own phase; loud and it locks with the rest — alien.js:2038,
           unchanged. */
        ? { barPhase, playing, level: loud, notes: [], loudness: loud }
        /* a MEMBER plays ITS part: contact on its own onsets in this bar, and
           when its part is silent alien.js rests it — "it lowers the
           instrument, idles and sways, and does NOT fake-strike" (its header). */
        : { barPhase, playing: playing && !!(slot && slot.playing),
            level: slot ? slot.level : 0, notes: slot ? slot.notes : [],
            loudness: loud };
      try { b.al.update(dtMus, ctx); } catch (e) { /* one bad creature is not the floor */ }
    }

    try { RIG.renderer.render(RIG.scene, RIG.camera); } catch (e) { /* context lost */ }
  };

  /* THE TAB CLOSING IS THE OFF SWITCH. showTab writes `data-off` on every
     panel but the open one; this observer is the only listener cheap enough
     to leave armed — it fires on that one attribute and nothing else. Parking
     STOPS THE LOOP and nothing else: the renderer keeps its context so coming
     back is one frame, which is what S5 measures. Disposal is stop()'s job. */
  const mo = new MutationObserver(() => {
    const off = host.hasAttribute("data-off");
    if (off && !parked) { parked = true; cancelAnimationFrame(raf); raf = 0; }
    else if (!off && parked && !dead) { parked = false; lastNow = performance.now();
      lastBarsPos = null; fit(); raf = requestAnimationFrame(frame); }
  });
  mo.observe(host, { attributes: true, attributeFilter: ["data-off"] });

  fit();
  raf = requestAnimationFrame(frame);
  return () => {
    if (killed) return; killed = true;
    dead = true; cancelAnimationFrame(raf); raf = 0;
    window.__saverReady = false;
    mo.disconnect(); ro.disconnect();
    /* the troupe's geometries and materials go with it, or the GPU keeps them
       for the life of the page (dropTroupe, above); then the stars, the floor
       and the renderer itself. */
    dropTroupe();
    if (RIG) {
      for (const o of RIG.owned) { try { o.dispose(); } catch (e) {} }
      try { RIG.renderer.dispose(); } catch (e) {}
      RIG = null;
    }
  };
}
