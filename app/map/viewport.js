// viewport.js — the star chart's SCREEN TRANSFORM. The #map <svg> handle plus the
// map's own ZOOM state (k + pan offsets), its clamps, the zoom-about-a-point
// helper, and the screen→world inverse (toXY). This is the LEAF of the map
// modules: draw.js, gestures.js and layout.js all sit on top of it and nothing
// here imports them, so the evaluation order of the split is fixed and acyclic.
import { set } from "../core/state.js";
import { WORLD_W, WORLD_H } from "../core/world.js";

// the imperative SVG surface (drawMap rebuilds its children; 60Hz drags stay cheap)
export const svg=document.getElementById("map");
// ---------- zoom: pinch (2 pointers) or ctrl+wheel, MAP ONLY ----------
// screen = logical*base*k + o; toXY inverts, so waypoints/drags stay correct
// at any zoom. k clamped 1..4; at 1x the offsets snap home.
// DEFAULT_ZOOM > 1 so the spread-out star field OVERFLOWS the screen and the
// genres read as widely separated on load — spread out a lot, and it is fine
// for them to exceed the screen. At k=1 the whole world fits the viewport (the zoom-out
// floor / fit-to-extents); the default starts zoomed in and centered, pannable.
export const DEFAULT_ZOOM=2.8;
export const ZOOM={k:DEFAULT_ZOOM,ox:0,oy:0};   // exported: entries/embed.js frames its little box with it
window.__ZOOM=ZOOM;   // debug/probe access (the headless gates read the live object)
// center the map at the current zoom (MAP_CENTER → screen center). Called at boot
// and on resize so the overflowing world is framed on its middle, not its corner.
export function centerView(){ const r=svg.getBoundingClientRect(); if(!r.width) return;
  ZOOM.ox=r.width*(1-ZOOM.k)/2; ZOOM.oy=r.height*(1-ZOOM.k)/2; clampZoom(); }
// pan padding = how far, in SCREEN space, the world may overscroll past each
// viewport edge. Get this wrong and the edges are impossible to reach when
// zoomed in: a pad of 0.18 lets an edge star sit at most 18% of the viewport in from the
// rim — nowhere near the thumb-friendly CENTER — so corner genres (desertblues,
// breakcore, darksynth…) stayed pinned to the edge at every zoom. The reach is
// governed purely by the pad's SIZE, not k: after maximal pan, the left/top
// world edge lands at screen = +padX (= PAN_PAD·width) and the right/bottom
// edge at width−padX. To let ANY edge star reach the exact viewport center at
// ANY zoom, the pad must be >= HALF the viewport (0.5). We use 0.55 so center
// sits comfortably INSIDE the pan range (the edge can travel a touch past
// center) rather than exactly at the clamp limit. Screen-space and k-invariant
// on purpose: 0.55·width brings the edge to center whether k is 1.5 or 4. Only
// bites when zoomed (at k===1 offsets snap 0).
const PAN_PAD=0.55;
// GALAXY FLOOR: you can zoom way out until the genres are small, like a galaxy,
// without the top being cut off. k may go BELOW the
// fit point: at k<=1 the world is centered with symmetric screen margins on all
// sides (which also fixes the top clip — at exact fit the tall ribbon's first
// stars sat ~0.4% from the viewport top and their labels drew off-screen).
// At k===1 the centering formula yields ox=oy=0, byte-identical to the old snap.
const MIN_ZOOM=0.3;
export function clampZoom(){
  const r=svg.getBoundingClientRect();
  ZOOM.k=Math.max(MIN_ZOOM,Math.min(6,ZOOM.k));
  if(ZOOM.k<=1){ ZOOM.ox=r.width*(1-ZOOM.k)/2; ZOOM.oy=r.height*(1-ZOOM.k)/2; return; }
  const padX=r.width*PAN_PAD, padY=r.height*PAN_PAD;
  ZOOM.ox=Math.max(r.width*(1-ZOOM.k)-padX,Math.min(padX,ZOOM.ox));
  ZOOM.oy=Math.max(r.height*(1-ZOOM.k)-padY,Math.min(padY,ZOOM.oy));
}
// OPEN FULLY ZOOMED OUT. The first view has one job: show the whole journey, and
// the only way to be certain of that is to show the whole world. Framing the
// waypoints was tried and is worse — fitting a path zooms IN (measured k 2.4 on a
// shared link, 3.7 on the default loop), so everything outside the path leaves the
// screen and a drag in any direction immediately loses it. k=1 is the exact fit
// point where the world maps to the viewport, and clampZoom centres it there with
// symmetric margins, so the whole path is on screen by construction whatever its
// shape. (centerView() alone did NOT do this: it centres at whatever k is, and k
// booted at DEFAULT_ZOOM 2.8.)
export function zoomToFitAll(){
  const r=svg.getBoundingClientRect(); if(!r.width) return false;
  ZOOM.k=1; clampZoom(); return true;
}
export function zoomAround(cx,cy,k2){ // keep the screen point (cx,cy) fixed while scaling
  const r=svg.getBoundingClientRect(), sx=cx-r.left, sy=cy-r.top;
  const k1=ZOOM.k; k2=Math.max(MIN_ZOOM,Math.min(6,k2));
  ZOOM.ox=sx-(sx-ZOOM.ox)*(k2/k1); ZOOM.oy=sy-(sy-ZOOM.oy)*(k2/k1); ZOOM.k=k2;
  clampZoom(); set({});
}
export const toXY=ev=>{const r=svg.getBoundingClientRect();const p=ev.touches?ev.touches[0]:ev;
  return {x:Math.max(0,Math.min(WORLD_W,((p.clientX-r.left-ZOOM.ox)/ZOOM.k)*WORLD_W/r.width)),
          y:Math.max(0,Math.min(WORLD_H,((p.clientY-r.top-ZOOM.oy)/ZOOM.k)*WORLD_H/r.height))};};
