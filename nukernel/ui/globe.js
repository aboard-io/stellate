// nukernel/ui/globe.js — THE EARTH: A CAMERA AND A COASTLINE, AND NOTHING ELSE.
//
// Paul, 2026-08-24: "I need the ability to zoom in and out on the map. Why
// don't you make the map 3d and zoomable like google earth but keep it black
// and white. lots of good open source libraries for that."
//
// THERE IS NO LIBRARY, AND THAT IS THE ANSWER TO THE SENTENCE RATHER THAN A
// DODGE OF IT. An orthographic projection of a sphere is nine lines of
// arithmetic; what "like Google Earth" actually asks for is the RANGE (whole
// earth to a city), the TURN (the land stays under your finger) and the READ
// (it looks like a planet, not a circle). All three are below. What a WebGL
// globe would have bought is a perspective camera; what it would have cost is
// 166 KB gzipped of three.js for about 8% use, a GPU context, a second
// projection for the no-WebGL case (a second source of truth about where a
// place is on screen), and a render loop beside a Faust audio worklet — which
// this repo has ALREADY PAID FOR ONCE: main:app/starcruise.js:118, "audible
// static/dropouts after visiting the 3d planet (measured: C_UNDER_CNT bursts
// exactly across cruise enter/exit, zero in a no-cruise control)". Filled land
// is also free in SVG and needs triangulation in WebGL, and the 10% wash is
// what makes the picture read as land and sea at a glance.
//
// THIS FILE IS PURE PROJECTION AND PAINT. No marks, no slider, no picking, no
// ctx, no records. It is the only file that knows what a sphere is; ui/atlas.js
// is the instrument built on it and owns no trigonometry at all. The place
// vectors themselves come from nukernel/atlas.js (`unit`, `UNITS`), because two
// files computing "where is Kingston on a sphere" is two files that can
// disagree, and the hit test and the picture must agree by construction.
//
// THE IDLE GUARANTEE IS NOT HERE. draw() paints exactly once per call and never
// schedules anything; ui/atlas.js owns the rAF, and the law is that it runs only
// while a pointer is down, a glide is spending or a flyTo is live.
import { NuAtlas, NuAtlasLand } from "./deps.js";

const { LAND } = NuAtlasLand;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

/* ARC IS THE ZOOM VARIABLE, AND R IS DERIVED FROM IT — not the other way round.
   `arc` is DEGREES OF GREAT-CIRCLE ARC ACROSS THE SHORTER SIDE OF THE BOX,
   which is a number a reader can be told ("you are looking at 55 km") and a
   gate can assert. R, the radius in viewBox units, runs 411 -> 47,040 at 390 px
   wide and is nobody's idea of a zoom level.

       R = (shorterSide / 2) / sin(arc / 2)

   180° is the whole visible hemisphere with the limb inscribed in the box; 0.5°
   is about 55 km across a 390 px phone — Kingston Harbour with the Palisadoes
   spit legible off the ±2° 1:10m patch tier. Both ends are HARD CLAMPS: you
   cannot zoom out past one earth, and you cannot zoom in past the edge of the
   data. `arc` is also what picks the coastline tier, which is the other reason
   it and not R is the variable. */
export const ARC_MAX = 180;
export const ARC_MIN = 0.5;

/* ---------------------------------------------------------------------------
   THE COASTLINE, TURNED INTO UNIT VECTORS ONCE AT LOAD.
   ---------------------------------------------------------------------------
   A frame is then 6 multiplies and 4 adds per point with NO trigonometry in the
   loop: only the camera's two angles need sin and cos. 8,219 world points x 4
   trig calls a frame was the thing to avoid.

   AND THE CAPS ARE COMPUTED HERE, NOT BAKED. One pass over ~16,000 points at
   module init costs a fraction of a millisecond, and a derived table in a
   committed file is a table that can drift from its source. (The bake script
   emits geography; this is the only place it becomes geometry.)

   Float32Array, not Float64: seven significant digits against R at most 47,040
   viewBox units is 0.005 units of error, and the coordinates are emitted as
   INTEGERS anyway. It halves the resident typed arrays from ~600 KB to ~300 KB.

   AND THE COST IS STATED RATHER THAN HIDDEN: `runs` and `rings` below hold the
   same 8,200 coordinates twice, once cut for culling and once joined for
   filling — about 200 KB of Float32 — on top of the ~380 KB of parsed JS arrays
   atlas-land.js itself keeps alive. That is the price of having both a tier that
   culls and a tier that fills, and it is paid once at load in a data tier that
   already carries 364 KB of genres.js and 457 KB of vocabulary.json. It could be
   avoided by drawing the joined ring as a walk over its runs, and it is not,
   because one array shape for both loops is what keeps the frame in one
   function that a person can read. */
function prep(rows) {
  const out = [];
  for (const r of rows) {
    const n = r.length / 2;
    if (n < 2) continue;
    const v = new Float32Array(n * 3);
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      const u = NuAtlas.unit(r[i * 2 + 1], r[i * 2]);
      v[i * 3] = u[0]; v[i * 3 + 1] = u[1]; v[i * 3 + 2] = u[2];
      cx += u[0]; cy += u[1]; cz += u[2];
    }
    // the bounding CAP: a centre direction and the angle to the furthest point.
    // Degenerate centre (a ring that wraps the whole sphere) falls back to a
    // cap that can never be rejected, which is correct rather than clever.
    const m = Math.hypot(cx, cy, cz);
    if (m < 1e-9) { out.push({ v, n, cx: 0, cy: 0, cz: 1, rad: Math.PI }); continue; }
    cx /= m; cy /= m; cz /= m;
    let rad = 0;
    for (let i = 0; i < n; i++) {
      const d = cx * v[i * 3] + cy * v[i * 3 + 1] + cz * v[i * 3 + 2];
      const a = Math.acos(d > 1 ? 1 : d < -1 ? -1 : d);
      if (a > rad) rad = a;
    }
    out.push({ v, n, cx, cy, cz, rad });
  }
  return out;
}

/* THE RINGS ARE REBUILT FROM RUNS + RSPAN, exactly as atlas-land.js's header
   says: consecutive runs of a ring share ONE point, so the ring is the
   concatenation of its RSPAN[k] runs with each run's first point dropped after
   the first. This is what stops the split being a 100 KB duplication of the
   same coordinates, and test/atlas.js G18 holds the result against a direct
   0.1° bake. */
function joinRings(runs, span) {
  const out = []; let i = 0;
  for (const k of span) {
    if (!runs[i]) break;
    const ring = runs[i].slice();
    for (let j = 1; j < k; j++) ring.push(...runs[i + j].slice(2));
    i += k;
    out.push(ring);
  }
  return out;
}

const TIER = {
  coarse: prep(LAND.COARSE || []),
  runs:   prep(LAND.RUNS || []),
  rings:  prep(joinRings(LAND.RUNS || [], LAND.RSPAN || [])),
  patch:  prep(LAND.PATCH || []),
};

const NS = "http://www.w3.org/2000/svg";
const S = (t, a) => { const n = document.createElementNS(NS, t);
  for (const k in a) n.setAttribute(k, a[k]); return n; };

export function makeGlobe(svg) {
  /* ---------- the scene graph, BUILT ONCE ------------------------------
     Per frame nothing is created or destroyed: node pools get a new `d` and
     the surplus gets `d=""`. A renderer that rebuilds its own DOM 60 times a
     second is a renderer that allocates 60 times a second, and this one has to
     sit beside an audio worklet. */
  const defs = S("defs", {});
  /* THE HORIZON IS A HARD CLIP, AND IT IS ONE NODE. Nothing may paint outside
     the disc — the earth ends there. It also makes the limb joins forgiving: an
     arc that overshoots by a few units is CLIPPED rather than drawn as a bulge
     in the sea, which is what the south-polar screenshot showed before it.
     LIMB DARKENING is one <radialGradient>, transparent to 30% CanvasText at
     the edge, and it is the single thing that makes this read as a SPHERE
     rather than as a circle with lines on it. Both are system colours, so the
     picture is black and white in both themes and in forced colours. */
  defs.appendChild(S("clipPath", { id: "atlasDisc" }));
  const discC = S("circle", { cx: 500, cy: 500, r: 410 });
  defs.firstChild.appendChild(discC);
  const grad = S("radialGradient", { id: "atlasLimbG" });
  for (const [o, c] of [[0.55, "0"], [0.88, "0.07"], [1, "0.30"]])
    grad.appendChild(S("stop", { offset: o, "stop-color": "CanvasText", "stop-opacity": c }));
  defs.appendChild(grad);

  const sea = S("circle", { id: "atlasSea", fill: "Canvas", stroke: "CanvasText",
                            "stroke-width": 1.5 });
  const gGrat = S("g", { id: "atlasGrat", "clip-path": "url(#atlasDisc)",
    "aria-hidden": "true", fill: "none", stroke: "CanvasText",
    "stroke-opacity": ".16", "stroke-width": 1 });
  /* TWO LAND GROUPS, NOT ONE, AND IT IS A BUG FIX RATHER THAN TIDINESS. SVG
     CLOSES AN OPEN SUBPATH IMPLICITLY IN ORDER TO FILL IT — so the open runs of
     the split and patch tiers, sitting in a group with a fill, drew pale
     diagonal wedges across Britain and Jamaica in the prototype. Whole rings
     FILL (the 10% wash is what says land from sea at a glance); open runs are
     `fill: none` and are a line, which is all a coastline is once you are
     inside it. */
  const gFill = S("g", { id: "atlasLandFill", "clip-path": "url(#atlasDisc)",
    fill: "CanvasText", "fill-opacity": ".10", stroke: "CanvasText",
    "stroke-opacity": ".45", "stroke-width": 1.2 });
  const gLine = S("g", { id: "atlasLandLine", "clip-path": "url(#atlasDisc)",
    fill: "none", stroke: "CanvasText", "stroke-opacity": ".55",
    "stroke-width": 1.2, "stroke-linejoin": "round" });
  const limb = S("circle", { id: "atlasLimb", fill: "url(#atlasLimbG)",
                             "pointer-events": "none" });
  svg.append(defs, sea, gGrat, gFill, gLine, limb);

  const pool = (g) => { const a = []; return (i) => {
    while (a.length <= i) { const p = S("path", { d: "" }); g.appendChild(p); a.push(p); }
    return a[i]; }; };
  const fillNode = pool(gFill), lineNode = pool(gLine), gratNode = pool(gGrat);
  const fillN = gFill.childNodes, lineN = gLine.childNodes, gratN = gGrat.childNodes;

  /* ---------- state: two angles and a zoom ---------------------------- */
  let lam0 = -30, phi0 = 15;   // degrees. phi0 = 15 puts all 62 places within
                               // 49.6° of the sub-point at their own longitude
                               // (Buenos Aires -34.6 .. Reykjavik +64.15), so
                               // longitude alone reaches every one of them.
  let arc = ARC_MAX;
  let VB = 1000, VH = 1000, R = 500, cx = 500, cy = 500, cssW = 390;

  const clampArc = (a) => (a < ARC_MIN ? ARC_MIN : a > ARC_MAX ? ARC_MAX : a);

  function fit(w, h) {
    cssW = w > 0 ? w : 390;
    VB = 1000; VH = Math.max(1, Math.round(1000 * (h > 0 ? h : w * 0.82) / cssW));
    cx = VB / 2; cy = VH / 2;
  }
  function geom() {
    const shorter = Math.min(VB, VH);
    R = (shorter / 2) / Math.sin(Math.min(90, arc / 2) * D2R);
  }

  function set(o) {
    if (o.lam0 != null) lam0 = ((o.lam0 + 180) % 360 + 360) % 360 - 180;
    // PHI IS CLAMPED TO ±85 AND NOT TO ±90: at exactly a pole the longitude of
    // the sub-point is undefined and the graticule's meridians all collide, so
    // the last five degrees buy nothing and cost a singularity.
    if (o.phi0 != null) phi0 = Math.max(-85, Math.min(85, o.phi0));
    if (o.arc != null) arc = clampArc(o.arc);
    geom();
  }
  const get = () => ({ lam0, phi0, arc, R, VB, VH, cx, cy,
                       // viewBox units per CSS pixel, so the instrument can
                       // state a tap box in the unit a thumb is measured in
                       u: VB / cssW });

  /* ---------- the projection, and its exact inverse -------------------- */
  const cam = () => ({ sl: Math.sin(lam0 * D2R), cl: Math.cos(lam0 * D2R),
                       sp: Math.sin(phi0 * D2R), cp: Math.cos(phi0 * D2R) });

  /* Forward: a unit vector to viewBox coordinates. `z` is the cosine of the
     angle from the sub-point — POSITIVE IS THE NEAR SIDE, and it is also the
     foreshortening, which is what dims a dot toward the limb. */
  function toScreen(v) {
    const { sl, cl, sp, cp } = cam();
    const u = v[0] * cl - v[1] * sl, w = v[1] * cl + v[0] * sl;
    const X = u, Y = cp * v[2] - sp * w, Z = sp * v[2] + cp * w;
    return { x: cx + R * X, y: cy - R * Y, z: Z };
  }

  /* THE EXACT INVERSE, AND IT IS SHORTER THAN THE APPROXIMATION IT REPLACES.
     The first version of the drag used a trackball GAIN — one viewBox unit of
     screen at the sub-point is 1/R radians of arc — which is this same
     arithmetic linearised at the centre of the disc and is increasingly wrong
     toward the limb, which is exactly where you grab when you want to spin the
     earth a long way. In an orthographic projection there is no ray and no
     quaternion, so the inverse collapses to: screen -> (X, Y) on the unit disc
     -> Z = sqrt(1 - X² - Y²) -> unrotate by phi0, then by lam0. Off the limb it
     returns NULL rather than a nearest point, because "you grabbed the sea
     beside the earth" is a real answer and clamping it invents a grab. */
  function fromScreen(px, py) {
    const X = (px - cx) / R, Y = (cy - py) / R;
    const q = X * X + Y * Y;
    if (q > 1) return null;
    const Z = Math.sqrt(1 - q);
    const { sl, cl, sp, cp } = cam();
    const w = cp * Z - sp * Y, z = sp * Z + cp * Y;
    const x = X * cl + w * sl, y = w * cl - X * sl;
    return { lat: Math.asin(z > 1 ? 1 : z < -1 ? -1 : z) * R2D,
             lon: Math.atan2(x, y) * R2D };
  }

  /* ---------- the graticule ------------------------------------------- */
  /* IT STEPS WITH ZOOM, so the grid is always a readable scale bar and the
     meridians always converge the right way — that convergence is the single
     strongest depth cue in a monochrome picture. */
  const gratStep = () => (arc > 90 ? 30 : arc > 30 ? 10 : arc > 10 ? 5
                        : arc > 3 ? 1 : arc > 1 ? 0.5 : 0.1);
  let gratCache = { key: "", set: null };
  /* AND IT IS GENERATED INSIDE THE VISIBLE CAP ONLY. MEASURED THE HARD WAY: the
     first version generated every line at the current step over the whole
     sphere, and at the tightest zoom (0.1° step) that is 3,600 meridians of
     1,801 points = 6.5 MILLION points. The tab hung and the headless run timed
     out at 120 s. A graticule you cannot see costs exactly as much as one you
     can. Capped at 14 lines each way, which is more than an eye counts. */
  function graticule(step, half) {
    const la0 = Math.max(-90, phi0 - half * R2D), la1 = Math.min(90, phi0 + half * R2D);
    const pad = Math.min(180, (half * R2D) /
      Math.max(0.15, Math.cos(Math.min(85, Math.abs(phi0)) * D2R)));
    const lo0 = lam0 - pad, lo1 = lam0 + pad;
    const key = step + "|" + Math.round(la0 / step) + "|" + Math.round(la1 / step)
              + "|" + Math.round(lo0 / step) + "|" + Math.round(lo1 / step);
    if (gratCache.key === key) return gratCache.set;
    const CAP = 14, rows = [];
    const subLa = Math.max(step / 4, (la1 - la0) / 22);
    let n = 0;
    for (let lo = Math.ceil(lo0 / step) * step; lo <= lo1 && n < CAP; lo += step, n++) {
      const pts = [];
      for (let la = la0; la <= la1; la += subLa) pts.push(lo, la);
      pts.push(lo, la1); rows.push(pts);
    }
    n = 0;
    const subLo = Math.max(step / 4, (lo1 - lo0) / 22);
    for (let la = Math.ceil(la0 / step) * step; la <= la1 && n < CAP; la += step, n++) {
      if (Math.abs(la) >= 90) continue;
      const pts = [];
      for (let lo = lo0; lo <= lo1; lo += subLo) pts.push(lo, la);
      pts.push(lo1, la); rows.push(pts);
    }
    gratCache = { key, set: prep(rows) };
    return gratCache.set;
  }

  /* ---------- WHICH COASTLINE. ONE TABLE, NO HEURISTICS. ---------------
     | moving && arc > 60 | COARSE  — 1,180 points, 12 KB, filled. Nothing finer
     |                    |          survives a moving limb.
     | arc > 6            | RINGS   — the whole 0.1° world, rebuilt from
     |                    |          RUNS + RSPAN at load, and FILLED
     | arc <= 6           | RUNS + PATCH — cap-culled, stroke only, 1:10m city
     |                    |          boxes on top
     The full-detail frame therefore happens ONCE, on settle, never in a loop.

     THE CROSSOVER IS 6°, AND IT MOVED FROM 30° BECAUSE OF A PICTURE. The round's
     plan put it at 30 and drew open runs below that, which is faster: the cap
     test can only reject anything once a ring is cut into 96-point runs, and
     that is what takes a 0.5°-arc frame from 3,840 points walked down to 432.
     But AN OPEN RUN HAS NO INSIDE. From 30° to 6° the earth was outline only,
     and the screenshot over the Great Lakes at 11° of arc was a tangle of lines
     with no way to tell a lake from a peninsula. The 10% wash is the only thing
     that says land from sea at a glance, and it is the reason this design is SVG
     and not WebGL at all — filled land is free here and needs triangulation
     there. So the fill runs down to 6°, where you are inside one region, a coast
     reads as a line, and the culling starts paying for itself. Measured cost at
     390x844 of moving the crossover: a settled frame at 11° of arc walks 8,265
     points instead of 1,451, and the drag loop's p50 went 25.5 ms -> 29.9 ms on
     a box carrying two other workflows. It is paid once, when the finger comes
     off, because a MOVING frame above 60° is still the 1,180-point coarse tier
     and a moving frame below it is what the 8px lock and the 25° glide budget
     keep short. */
  function tiers(moving) {
    if (moving && arc > 60) return { fill: TIER.coarse, line: null };
    if (arc > 6) return { fill: TIER.rings, line: null };
    return { fill: null, line: [TIER.runs, TIER.patch] };
  }

  /* ---------- the frame ------------------------------------------------ */
  let lastStats = { rings: 0, pts: 0, ms: 0 }, lastPose = "";

  function draw(moving) {
    const t0 = (performance && performance.now) ? performance.now() : 0;
    geom();
    svg.setAttribute("viewBox", "0 0 " + VB + " " + VH);
    /* THE SEA, THE LIMB AND THE CLIP ARE DRAWN AT A BOUNDED RADIUS, AND THAT IS
       A PERFORMANCE FIX WITH A MEASUREMENT BEHIND IT. R reaches 94,000 viewBox
       units at 0.5° of arc, and a <circle r="94000"> carrying a radial gradient
       plus a <clipPath> of the same size made the browser rasterise a disc a
       hundred times the size of the box: measured at 390x844, a drag frame at
       0.5° cost 25.2 ms against an idle control of 16.6, while drawing NINETY-SIX
       land points. Everything past three box-diagonals is off screen and cannot
       be seen, so the radius is capped there — the picture is identical and the
       limb darkening, which is a gradient over the last 12% of the disc, simply
       stops being on screen at all, which is already true at that zoom. */
    const rPaint = Math.min(R, 3 * Math.max(VB, VH));
    /* WHERE THE CAMERA IS, SAID OUT LOUD ON THE ELEMENT. Three data attributes,
       written only when they move. THE REASON THEY EXIST is that the clamp above
       made the picture stop being readable as state: a gate used to be able to
       recover the zoom from the sea circle's radius, and the moment `r` was
       capped at three box-diagonals every measurement past 15.7° of arc silently
       read 15.7°. A renderer whose only statement of its own pose is a side
       effect of how it paints is a renderer that lies to whoever measures it.
       These are also the honest way to prove the zoom range from outside —
       test/atlas.js reads them after a real wheel and a real `+` — and they cost
       three cached string writes a frame. */
    const st = arc.toFixed(3) + "|" + phi0.toFixed(3) + "|" + lam0.toFixed(3);
    if (st !== lastPose) {
      lastPose = st;
      svg.setAttribute("data-arc", arc.toFixed(3));
      svg.setAttribute("data-lat", phi0.toFixed(3));
      svg.setAttribute("data-lon", lam0.toFixed(3));
    }
    for (const n of [discC, sea, limb]) {
      n.setAttribute("cx", cx); n.setAttribute("cy", cy);
      n.setAttribute("r", rPaint.toFixed(1));
    }
    const { sl, cl, sp, cp } = cam();
    // the axis toward the camera, for the cap test
    const ax = cp * Math.sin(lam0 * D2R), ay = cp * Math.cos(lam0 * D2R), az = sp;
    // the angular radius of what the BOX can show (its corners, hence √2)
    const half = Math.min(Math.PI / 2,
      Math.asin(Math.min(1, (Math.min(VB, VH) / 2) * Math.SQRT2 / R)));

    let pts = 0, rings = 0;

    /* INTEGER COORDINATES, AND THE MEASUREMENT THAT FORCED THEM. toFixed(1) on
       two numbers per point, ~16,000 numbers a frame, was worth roughly a THIRD
       of the frame on its own. The viewBox is 1000 units wide inside a 390 CSS
       px column, so ONE viewBox unit is 0.39 CSS px and an integer is already
       sub-pixel. `| 0` truncates toward zero, which is one machine instruction
       and is fine for a coastline. */
    const emit = (set, closed, node) => {
      let k = 0;
      for (const r of set) {
        const dd = ax * r.cx + ay * r.cy + az * r.cz;
        if (Math.acos(dd > 1 ? 1 : dd < -1 ? -1 : dd) > r.rad + half + 0.03) continue;
        const v = r.v, n = r.n;
        let d = "", any = false, firstX = 0, firstY = 0, lastX = 0, lastY = 0;
        let ox = 0, oy = 0, oz = 0, oZ = 0, sweep = 0, exA = 0;
        const put = (X, Y, cmd) => { d += cmd + ((cx + R * X) | 0) + " " + ((cy - R * Y) | 0); };
        const cross = (x1, y1, z1, Z1, x2, y2, z2, Z2) => {
          const t = Z1 / (Z1 - Z2);
          let ix = x1 + (x2 - x1) * t, iy = y1 + (y2 - y1) * t, iz = z1 + (z2 - z1) * t;
          const m = Math.hypot(ix, iy, iz) || 1; ix /= m; iy /= m; iz /= m;
          const u = ix * cl - iy * sl, w = iy * cl + ix * sl;
          return [u, cp * iz - sp * w];
        };
        const total = closed ? n + 1 : n;
        for (let i = 0; i < total; i++) {
          const j = i % n, x = v[j * 3], y = v[j * 3 + 1], z = v[j * 3 + 2];
          const u = x * cl - y * sl, w = y * cl + x * sl;
          const X = u, Y = cp * z - sp * w, Z = sp * z + cp * w; pts++;
          if (i > 0) {
            if (oZ >= 0 && Z >= 0) { put(X, Y, "L"); lastX = X; lastY = Y; }
            else if (oZ >= 0 && Z < 0) {
              const [IX, IY] = cross(ox, oy, oz, oZ, x, y, z, Z); put(IX, IY, "L");
              /* WHICH WAY ROUND THE LIMB — AND THE SWEEP FLAG IS 1 FOR A
                 MATH-COUNTERCLOCKWISE TRAVERSAL, NOT 0, BECAUSE SVG'S Y-AXIS
                 POINTS DOWN. Get it backwards and you fill the ocean. It cannot
                 be a constant either: a ring that leaves the disc turning one
                 way and one that leaves turning the other need OPPOSITE arcs,
                 so the sign of (radial x tangent) at the exit point — the
                 ring's own rotational sense there, two multiplies — decides. */
              const tx = IX - lastX, ty = IY - lastY;
              sweep = (IX * ty - IY * tx) > 0 ? 1 : 0;
              exA = Math.atan2(IY, IX);
              lastX = IX; lastY = IY;
            } else if (oZ < 0 && Z >= 0) {
              const [IX, IY] = cross(x, y, z, Z, ox, oy, oz, oZ);
              if (any && closed) {
                /* AND THE LARGE-ARC FLAG IS COMPUTED, NOT HARD-CODED 0. With a
                   constant 0 the south-polar view drew a near-straight chord
                   with a grey lune above it: the hidden part of Africa-Eurasia
                   wraps MORE than half the limb from a polar camera, and "the
                   small arc" is then the wrong half of the circle. Two atan2
                   and a modulo. */
                const RI = R | 0, enA = Math.atan2(IY, IX);
                let dA = sweep === 1 ? (enA - exA) : (exA - enA);
                dA = ((dA % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                d += "A" + RI + " " + RI + " 0 " + (dA > Math.PI ? 1 : 0) + " " + sweep
                   + " " + ((cx + R * IX) | 0) + " " + ((cy - R * IY) | 0);
              } else { put(IX, IY, "M"); firstX = IX; firstY = IY; }
              put(X, Y, "L"); lastX = X; lastY = Y; any = true;
            }
          } else if (Z >= 0) { put(X, Y, "M"); firstX = X; firstY = Y; lastX = X; lastY = Y; any = true; }
          ox = x; oy = y; oz = z; oZ = Z;
        }
        if (!any) continue;
        /* THE LAST EXIT NEEDS AN ARC TOO — AND THIS WAS THE GREY LUNE. A ring
           whose FIRST point is on the far side begins its path at a limb
           crossing and ends at another one, and `Z` then closes it with a
           STRAIGHT CHORD ACROSS THE DISC, which the 10% fill paints as a wedge
           of invented land. The join on re-entry was already an arc; the join at
           the seam was not. Measured in the south-polar view: Africa-Eurasia
           drew a chord from limb to limb with a grey band above it. */
        if (closed && oZ < 0) {
          const RI = R | 0, enA = Math.atan2(firstY, firstX);
          let dA = sweep === 1 ? (enA - exA) : (exA - enA);
          dA = ((dA % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          d += "A" + RI + " " + RI + " 0 " + (dA > Math.PI ? 1 : 0) + " " + sweep
             + " " + ((cx + R * firstX) | 0) + " " + ((cy - R * firstY) | 0);
        }
        if (closed) d += "Z";
        node(k++).setAttribute("d", d); rings++;
      }
      return k;
    };

    const t = tiers(moving);
    const nFill = t.fill ? emit(t.fill, true, fillNode) : 0;
    let nLine = 0;
    if (t.line) for (const set of t.line) nLine += emit(set, false, (i) => lineNode(nLine + i));
    for (let i = nFill; i < fillN.length; i++) fillN[i].setAttribute("d", "");
    for (let i = nLine; i < lineN.length; i++) lineN[i].setAttribute("d", "");

    // the graticule, in its own pool; open polylines, so no limb arcs
    let gn = 0;
    for (const r of graticule(gratStep(), half)) {
      const dd = ax * r.cx + ay * r.cy + az * r.cz;
      if (Math.acos(dd > 1 ? 1 : dd < -1 ? -1 : dd) > r.rad + half + 0.05) continue;
      const v = r.v, n = r.n; let d = "", oZ = -1;
      for (let i = 0; i < n; i++) {
        const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
        const u = x * cl - y * sl, w = y * cl + x * sl;
        const X = u, Y = cp * z - sp * w, Z = sp * z + cp * w; pts++;
        if (Z >= 0) d += (oZ >= 0 ? "L" : "M") + ((cx + R * X) | 0) + " " + ((cy - R * Y) | 0);
        oZ = Z;
      }
      if (d) gratNode(gn++).setAttribute("d", d);
    }
    for (let i = gn; i < gratN.length; i++) gratN[i].setAttribute("d", "");

    lastStats = { rings, pts, ms: ((performance && performance.now) ? performance.now() : 0) - t0 };
    return lastStats;
  }

  return { fit, set, get, toScreen, fromScreen, draw, stats: () => lastStats };
}
