// starmap.js — the star chart: the imperative SVG map (drawMap), the breathing
// traveler pulse, zoom (pinch / ctrl+wheel / plain wheel, MAP ONLY) + pan, the
// pointer-gesture state machine, waypoint editing (add/insert/delete), and the
// deterministic genre LAYOUT (computeGenreLayout / seedDefaultLoop / autoPath).
import { S, set, K } from "./state.js";
import { POS, WORLD_W, WORLD_H, MAP_CENTER, WORLD_MARGIN, recomputeWorld } from "./world.js";
import { retarget } from "./targeting.js";

// ---------- map (imperative SVG: 60Hz drags stay cheap) ----------
const svg=document.getElementById("map"), NS="http://www.w3.org/2000/svg";
const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
// the traveler's live screen pos+scale, published by drawMap for cursorPulse.
// A standalone rAF animates ONLY the #curPulse glow radius/opacity, so the
// breath is smooth 60Hz and never resets when the imperative drawMap rebuilds
// the SVG (SMIL on a rebuilt node would restart+jitter every bar).
const curPos={x:0,y:0,s:1};
// the pulse only breathes while the traveler is ACTUALLY MOVING (live, or
// gliding toward a drawn target): parked at boot / after ■ there is nothing to
// animate, so the rAF stops entirely (no per-frame churn). drawMap publishes the
// freshly-built glow node into curPulseEl so the loop caches it instead of a
// getElementById every frame; startPulse() (fired after each redraw) resumes the
// loop cleanly the moment travel begins again.
let curPulseEl=null, pulseRaf=0;
window.__pulseFrames=0;   // headless probe: counts animated frames (idle when stopped)
// the traveler is "travelling" (breath worth animating) while the engine is
// live. stopLive/boot leave S.playing+S.target set (so the offline 1.4s glide
// preview keeps re-drawing the reticle), but the pulsing GLOW is the play
// indicator — idle it whenever we're not live.
const traveling=()=> !!S.live;
function cursorPulse(){
  pulseRaf=0;
  if(!traveling()) return;   // idle: leave the rAF stopped until startPulse() revives it
  const p=curPulseEl;
  if(p){ const ph=(Math.sin(performance.now()/1000*2.2)+1)/2;   // 0..1, ~1.4s breath
    p.setAttribute("r",(curPos.s*(30+ph*10)).toFixed(1));
    p.setAttribute("opacity",(0.10+ph*0.13).toFixed(3)); }
  window.__pulseFrames++;
  pulseRaf=requestAnimationFrame(cursorPulse);
}
export function startPulse(){ if(!pulseRaf && traveling()) pulseRaf=requestAnimationFrame(cursorPulse); }
startPulse();

export function drawMap(){
  // a star chart drawn straight over the video: each genre is a star with a
  // soft halo; the drawn path is a constellation line; the traveler glows.
  // Logical space is WORLD_W×WORLD_H (computed from the POS extents; see the
  // constants block up top). We scale COORDS to screen pixels here so stars/text
  // render round and unstretched at any aspect ratio; at ZOOM.k===1 the whole
  // spread fits the viewport.
  svg.innerHTML="";
  const rb=svg.getBoundingClientRect(), X=x=>(x*rb.width/WORLD_W)*ZOOM.k+ZOOM.ox, Y=y=>(y*rb.height/WORLD_H)*ZOOM.k+ZOOM.oy;
  // pinch zoom grows the TYPE too (sub-linear, capped 3x): zooming in is asking
  // to read the chart. fs===1 at 1x, so the un-zoomed chart is untouched.
  const fs=Math.min(3,Math.max(1,Math.pow(ZOOM.k,0.85)));
  if(S.waypoints.length>1){
    // CLOSED LOOP: repeat waypoint[0] at the end so the constellation line draws
    // the closing leg (waypoint[n-1] → waypoint[0]) the traveler actually walks.
    const pts=S.waypoints.concat([S.waypoints[0]]).map(w=>X(w.x)+","+Y(w.y)).join(" ");
    svg.appendChild(el("polyline",{points:pts,fill:"none",stroke:"#45e0ff","stroke-width":4,opacity:.18}));   // under-glow
    svg.appendChild(el("polyline",{points:pts,fill:"none",stroke:"#8ef2ff","stroke-width":1.2,"stroke-dasharray":"4 5",opacity:.85}));
  }
  const wmap=Object.fromEntries(S.weights.map(w=>[w.g,w.w]));
  for(const [g,[x,y]] of Object.entries(POS)){
    const w=wmap[g]||0, cx=X(x), cy=Y(y);
    svg.appendChild(el("circle",{cx,cy,r:8+(w>0.01?w*26:0),fill:w>0.01?"#ff6ec7":"#a06bff",opacity:.10+w*.28}));  // halo
    svg.appendChild(el("circle",{cx,cy,r:w>0.01?3.2:2.2,fill:w>0.01?"#ffd7ee":"#e6e0ff",opacity:.95}));           // the star
    const t=el("text",{x:cx+9*fs,y:cy+4*fs,"class":w>0.01?"anchor hot":"anchor"});
    t.style.fontSize=((w>0.01?12:11)*fs)+"px"; t.textContent=g; svg.appendChild(t);
    if(w>0.01){const wl=el("text",{x:cx+9*fs,y:cy+17*fs,"class":"wlabel"});
      wl.style.fontSize=(11*fs)+"px"; wl.textContent=Math.round(w*100)+"%"; svg.appendChild(wl);}
  }
  S.waypoints.forEach((w,i)=>{
    const cx=X(w.x), cy=Y(w.y);
    // path points at 2x: the leg number was too small to read (radius 14/9 -> 28/18,
    // number font 11 -> 22, baseline offset scales to match). The waypoints sit in
    // the GAPS between genres now (autoPath places them at midpoints), so these
    // numbered dots land in inter-genre space — the number never covers a star.
    svg.appendChild(el("circle",{cx,cy,r:28*fs,fill:"#ffd86b",opacity:.22}));
    const c=el("circle",{cx,cy,r:18*fs,fill:"#ffd86b",stroke:"#0c0a1a","stroke-width":1.6,cursor:"grab"});
    c.dataset.wp=i; svg.appendChild(c);
    const n=el("text",{x:cx,y:cy+7*fs,"text-anchor":"middle","class":"wpn"});
    n.style.fontSize=(22*fs)+"px"; n.textContent=i+1;
    svg.appendChild(n);
  });
  // the TRAVELER: the focal MOVING element — reads at least as prominently as
  // the waypoint dots it glides between (30dded3 doubled those: halo 28·fs, dot
  // 18·fs). Pink targeting reticle + soft breathing glow (animated by
  // cursorPulse). Now scales with fs like everything else (it didn't before).
  const ccx=X(S.cursor.x), ccy=Y(S.cursor.y);
  curPos.x=ccx; curPos.y=ccy; curPos.s=fs;
  curPulseEl=el("circle",{id:"curPulse","class":"cur",cx:ccx,cy:ccy,r:32*fs,fill:"#ff6ec7",opacity:.14});
  svg.appendChild(curPulseEl);       // breathing glow (cached for cursorPulse)
  svg.appendChild(el("circle",{"class":"cur",cx:ccx,cy:ccy,r:24*fs,fill:"none",stroke:"#ff6ec7","stroke-width":1.4*fs,opacity:.5}));  // outer reticle
  svg.appendChild(el("circle",{"class":"cur",cx:ccx,cy:ccy,r:16*fs,fill:"none",stroke:"#ff8fd6","stroke-width":2.6*fs}));             // bright ring
  svg.appendChild(el("circle",{"class":"cur",cx:ccx,cy:ccy,r:4.5*fs,fill:"#ff6ec7"}));                                               // core
}
addEventListener("resize",()=>{ centerView(); set({}); });
// ---------- zoom: pinch (2 pointers) or ctrl+wheel, MAP ONLY ----------
// screen = logical*base*k + o; toXY inverts, so waypoints/drags stay correct
// at any zoom. k clamped 1..4; at 1x the offsets snap home.
// DEFAULT_ZOOM > 1 so the spread-out star field OVERFLOWS the screen and the
// genres read as widely separated on load (Paul: "spread out a lot… fine if they
// exceed the screen"). At k=1 the whole world fits the viewport (the zoom-out
// floor / fit-to-extents); the default starts zoomed in and centered, pannable.
const DEFAULT_ZOOM=2.8;
const ZOOM={k:DEFAULT_ZOOM,ox:0,oy:0};
window.__ZOOM=ZOOM;   // debug/probe access
// center the map at the current zoom (MAP_CENTER → screen center). Called at boot
// and on resize so the overflowing world is framed on its middle, not its corner.
function centerView(){ const r=svg.getBoundingClientRect(); if(!r.width) return;
  ZOOM.ox=r.width*(1-ZOOM.k)/2; ZOOM.oy=r.height*(1-ZOOM.k)/2; clampZoom(); }
// pan padding = how far, in SCREEN space, the world may overscroll past each
// viewport edge. THE BUG (Paul: "edges impossible to reach when zoomed in"):
// the old 0.18 let an edge star sit at most 18% of the viewport in from the
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
export function clampZoom(){
  const r=svg.getBoundingClientRect();
  ZOOM.k=Math.max(1,Math.min(6,ZOOM.k));
  if(ZOOM.k===1){ ZOOM.ox=0; ZOOM.oy=0; return; }
  const padX=r.width*PAN_PAD, padY=r.height*PAN_PAD;
  ZOOM.ox=Math.max(r.width*(1-ZOOM.k)-padX,Math.min(padX,ZOOM.ox));
  ZOOM.oy=Math.max(r.height*(1-ZOOM.k)-padY,Math.min(padY,ZOOM.oy));
}
export function zoomAround(cx,cy,k2){ // keep the screen point (cx,cy) fixed while scaling
  const r=svg.getBoundingClientRect(), sx=cx-r.left, sy=cy-r.top;
  const k1=ZOOM.k; k2=Math.max(1,Math.min(6,k2));
  ZOOM.ox=sx-(sx-ZOOM.ox)*(k2/k1); ZOOM.oy=sy-(sy-ZOOM.oy)*(k2/k1); ZOOM.k=k2;
  clampZoom(); set({});
}
const toXY=ev=>{const r=svg.getBoundingClientRect();const p=ev.touches?ev.touches[0]:ev;
  return {x:Math.max(0,Math.min(WORLD_W,((p.clientX-r.left-ZOOM.ox)/ZOOM.k)*WORLD_W/r.width)),
          y:Math.max(0,Math.min(WORLD_H,((p.clientY-r.top-ZOOM.oy)/ZOOM.k)*WORLD_H/r.height))};};
// AUTHORITATIVE waypoint hit-test (ITEM 5: "when the cursor is on a number I
// can't move it"). Nearest waypoint whose drawn dot the pointer is inside,
// computed in SCREEN space from the same coord mapping drawMap uses — so it is
// independent of SVG z-order / e.target. The traveler is drawn on top and is
// now BIG, but it's pointer-events:none AND absent from this list, so a
// waypoint under it always wins the grab. Radius = drawn dot (18·fs) + touch pad.
function hitWp(e){
  const r=svg.getBoundingClientRect();
  const cX=e.clientX!=null?e.clientX:(e.touches&&e.touches[0]?e.touches[0].clientX:0);
  const cY=e.clientY!=null?e.clientY:(e.touches&&e.touches[0]?e.touches[0].clientY:0);
  const px=cX-r.left, py=cY-r.top;
  const fs=Math.min(3,Math.max(1,Math.pow(ZOOM.k,0.85)));
  let best=-1, bd=18*fs+10;
  S.waypoints.forEach((w,i)=>{
    const cx=(w.x*r.width/WORLD_W)*ZOOM.k+ZOOM.ox, cy=(w.y*r.height/WORLD_H)*ZOOM.k+ZOOM.oy;
    const d=Math.hypot(px-cx,py-cy); if(d<=bd){ bd=d; best=i; }
  });
  return best;
}
// ITEM 6: delete a waypoint (double-tap it, or right-click). Splice + renumber,
// then reroute the leg through the survivors. If we removed the leg the traveler
// is walking (or its endpoint), clamp the travel segment into range and snap the
// TARGET to a surviving waypoint via retarget — which GLIDES when live (no audio
// stop, no exception) and PLACES when stopped. Below 2 points the traveler just
// holds the last target (travelStep no-ops), so the music never drops.
function deleteWaypoint(i){
  if(i<0||i>=S.waypoints.length) return;
  const w=[...S.waypoints]; w.splice(i,1);
  const len=w.length;
  // erased down toward nothing: re-seed the default centred loop (Paul: "always
  // a loop"; "re-seed sensibly" below 2 points — a 1-point path can't loop).
  if(len<2){ seedDefaultLoop(); return; }
  // closed loop has `len` segments (seg n-1 is the closing leg), so a live seg
  // can validly index up to len-1 now — clamp there, not len-2.
  const seg=Math.min(S.travel.seg, len-1);
  set({waypoints:w, travel:{seg,t:0}, queue:[],
    status:"waypoint "+(i+1)+" removed — "+len+" points, loop rerouted"});
  retarget({x:w[seg].x, y:w[seg].y});
}
// perpendicular distance from a point to a line SEGMENT (clamped to the endpoints)
function distToSeg(p,a,b){ const vx=b.x-a.x, vy=b.y-a.y, wx=p.x-a.x, wy=p.y-a.y;
  const L=vx*vx+vy*vy; let t=L?(wx*vx+wy*vy)/L:0; t=t<0?0:t>1?1:t;
  return Math.hypot(p.x-(a.x+t*vx), p.y-(a.y+t*vy)); }
// which SEGMENT of the closed loop is nearest `pt` — returns the splice index
// (insert AFTER waypoint i, i.e. between i and i+1). The closing leg (n-1 → 0) is
// a segment too, so a tap near it inserts just before the loop wraps home.
function nearestSeg(pt,wps){ const n=wps.length; if(n<2) return n;
  let best=0, bd=Infinity;
  for(let i=0;i<n;i++){ const d=distToSeg(pt,wps[i],wps[(i+1)%n]); if(d<bd){bd=d;best=i;} }
  return best+1; }
// ADD a waypoint by double-tap: INSERT it into the nearest leg (Paul: splice
// between the two adjacent waypoints whose connecting segment is closest to the
// tap — never append to the end of the chain). The loop stays closed (drawMap
// repeats waypoint[0]; travelStep wraps seg mod n). Returns the insert index.
export function insertWaypoint(pt){
  if(S.waypoints.length<2){   // no real path yet: the path BEGINS where the music is
    const base=S.waypoints.length?S.waypoints:[{x:S.cursor.x,y:S.cursor.y}];
    const wps=[...base,pt];
    set({waypoints:wps,status:"path extended — the traveler walks from the playhead"});
    if(!S.live){ set({travel:{seg:0,t:0}, queue:[]}); retarget(wps[0]); }
    return wps.length-1;
  }
  const wps=[...S.waypoints], ins=nearestSeg(pt,wps); wps.splice(ins,0,pt);
  // keep a LIVE traveler on the same logical leg: an insert at/ before its segment
  // shifts every later index up by one.
  let seg=S.travel.seg; if(S.live && ins<=seg) seg=seg+1;
  set({waypoints:wps, status:"waypoint inserted into the nearest leg — "+wps.length+" points, loop rerouted"});
  if(!S.live){ set({travel:{seg:0,t:0}, queue:[]}); retarget(wps[0]); }
  else set({travel:{seg,t:S.travel.t}});
  return ins;
}
// gestureMode — ONE exclusive gesture at a time (replaces the old parallel
// dragging/dragWp/panning/pinch booleans, which only ever had one active and
// were kept mutually exclusive by hand). Modes:
//   "none"  — idle
//   "drag"  — free traveler-drag (unzoomed AND path-less: the cursor IS the mix)
//   "wp"    — dragging a path waypoint (dragWpI = its index)
//   "pan"   — single-finger pan of the star field when zoomed in (ZOOM.k>1 over
//             empty sky): arms on finger-down, pans once it clears the 4px
//             deadzone (panMoved), else falls through to a tap on release.
//   "pinch" — two-finger zoom (the `pinch` object below carries the anchor math)
let gestureMode="none", dragWpI=-1, lastTap={t:0,x:0,y:0};
let panMoved=false, panStart=null;
// "font should be white when interacting": any live pointer work on the map
// (drag, waypoint drag, pinch, wheel-zoom) lights the anchor labels via the
// #map.itx CSS rule; they now HOLD white for 10s after the LAST interaction so
// you have time to read where you are, then ease back to dim. The single timer
// is cleared+reset on every interaction, so rapid taps just restart the 10s
// cleanly (no leaked timers). Class toggle only — no set({})/redraw, so the
// fill TRANSITIONS on the way out.
const ITX_HOLD_MS=10000;
let itxT=0;
function markItx(){ svg.classList.add("itx");
  clearTimeout(itxT); itxT=setTimeout(()=>svg.classList.remove("itx"),ITX_HOLD_MS); }
const ptrs=new Map();   // active pointers on the map (pinch bookkeeping)
let pinch=null;         // {d0,k0,cx,cy}
svg.addEventListener("pointerdown",e=>{
  // NOTE: no preventDefault here — it would suppress dblclick. Selection is
  // handled by CSS user-select; double-add is detected manually (mouse+touch).
  markItx();
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){
    // second finger = ZOOM ONLY: cancel any drag, arm the pinch, no waypoints
    const [a,b]=[...ptrs.values()];
    pinch={d0:Math.max(12,Math.hypot(a.x-b.x,a.y-b.y)),k0:ZOOM.k,
           cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,ox0:ZOOM.ox,oy0:ZOOM.oy};
    gestureMode="pinch"; dragWpI=-1; panMoved=false; panStart=null; lastTap={t:0,x:0,y:0};
    document.body.classList.remove("dragging");
    return;
  }
  const pt=toXY(e), now=performance.now();
  const wpi=hitWp(e);   // authoritative — a waypoint always beats the traveler (ITEM 5)
  if(now-lastTap.t<380 && Math.hypot(pt.x-lastTap.x,pt.y-lastTap.y)<16){
    lastTap={t:0,x:0,y:0};
    // DOUBLE-TAP grammar: on a waypoint = DELETE it (ITEM 6); on empty sky =
    // extend the path (unchanged). Waypoints are hit-tested FIRST.
    if(wpi>=0){ deleteWaypoint(wpi); return; }
    // INSERT into the nearest leg (not append): splice between the two adjacent
    // waypoints whose segment is closest to the tap. insertWaypoint handles the
    // stopped-vs-live playhead rule (snap to start stopped; keep the glide live).
    insertWaypoint(pt);
    return;
  }
  lastTap={t:now,x:pt.x,y:pt.y};
  // right-click delete is handled once, in the contextmenu listener below
  if(e.button!==0) return;
  if(wpi>=0){ gestureMode="wp"; dragWpI=wpi; }   // grab the waypoint even when the traveler sits on it (ITEM 5)
  else if(ZOOM.k>1){
    // ZOOMED IN (names are the primary UI): a single-finger drag PANS the space.
    // We arm here and decide on move: a real drag pans; a tap with no movement
    // falls through on release to the normal place/select (see endPtr). This is
    // gated purely on zoom level — path DRAWING is double-tap + waypoint-drag
    // (handled above), never a bare single-finger drag, so panning can't eat it.
    gestureMode="pan"; panMoved=false;
    panStart={sx:e.clientX,sy:e.clientY,ox0:ZOOM.ox,oy0:ZOOM.oy,pt};
    document.body.classList.add("dragging");
    try{ svg.setPointerCapture(e.pointerId); }catch(err){}
    return;
  }
  else if(S.waypoints.length<2) gestureMode="drag";   // with a path, the traveler owns the cursor
  else { set({status:"loop active — the traveler walks it; drag a waypoint to reshape, dbl-tap the sky to add one"}); return; }
  document.body.classList.add("dragging");
  try{ svg.setPointerCapture(e.pointerId); }catch(err){} // synthetic pointers can't capture
  if(gestureMode==="drag") retarget(pt);
});
svg.addEventListener("pointermove",e=>{
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(gestureMode==="pinch"&&ptrs.size===2){
    e.preventDefault(); markItx();
    const [a,b]=[...ptrs.values()];
    const d=Math.max(12,Math.hypot(a.x-b.x,a.y-b.y));
    const cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
    const k2=Math.max(1,Math.min(6,pinch.k0*d/pinch.d0));
    // scale about the gesture's original center; pan follows the current
    // center (the logical point that started under the fingers stays there)
    const r=svg.getBoundingClientRect();
    ZOOM.k=k2;
    ZOOM.ox=(cx-r.left)-((pinch.cx-r.left)-pinch.ox0)*(k2/pinch.k0);
    ZOOM.oy=(cy-r.top)-((pinch.cy-r.top)-pinch.oy0)*(k2/pinch.k0);
    clampZoom(); set({});
    return;
  }
  if(gestureMode==="pan"){ markItx();
    const dx=e.clientX-panStart.sx, dy=e.clientY-panStart.sy;
    if(!panMoved && Math.hypot(dx,dy)>4) panMoved=true;   // deadzone: a jitter stays a tap
    if(panMoved){ e.preventDefault();
      ZOOM.ox=panStart.ox0+dx; ZOOM.oy=panStart.oy0+dy; clampZoom(); set({}); }
    return;
  }
  if(gestureMode==="wp"){ markItx(); const pt=toXY(e); S.waypoints[dragWpI]=pt; set({}); }
  else if(gestureMode==="drag"){ e.preventDefault(); markItx(); retarget(toXY(e)); }
});
const endPtr=e=>{ ptrs.delete(e.pointerId); if(ptrs.size<2) pinch=null;
  if(gestureMode==="pan"){ // a zoomed single-finger gesture: pan already applied; a no-move
    // tap falls through to the normal place/select (only when free to drag —
    // with a path the traveler owns the cursor, so a tap stays inert as before)
    if(!panMoved && S.waypoints.length<2 && panStart) retarget(panStart.pt);
    panMoved=false; panStart=null; }
  gestureMode="none"; dragWpI=-1; document.body.classList.remove("dragging"); };
addEventListener("pointerup",endPtr);
addEventListener("pointercancel",endPtr);
svg.addEventListener("wheel",e=>{
  // desktop: PLAIN mouse wheel zooms the map toward the cursor (ctrl+wheel/pinch
  // still work). Normalise deltaMode so line-mode mice move as much as pixel-mode.
  e.preventDefault(); markItx();
  const dy = e.deltaMode===1 ? e.deltaY*16 : e.deltaMode===2 ? e.deltaY*(svg.getBoundingClientRect().height||600) : e.deltaY;
  zoomAround(e.clientX,e.clientY,ZOOM.k*Math.exp(-dy*0.0015));
},{passive:false});
// LAW: pinch/ctrl+wheel must NEVER resize the video or the nav chrome — the
// map's own gesture math above is the ONLY zoom on this page. Belt+braces:
// viewport meta pins mobile scale; body touch-action blocks touch pinch of the
// page; these two kill desktop ctrl+wheel page-zoom that starts over chips/
// modals/brand, and Safari's proprietary trackpad gesture events.
addEventListener("wheel",e=>{ if(e.ctrlKey) e.preventDefault(); },{passive:false});
for(const t of ["gesturestart","gesturechange","gestureend"])
  addEventListener(t,e=>e.preventDefault(),{passive:false});
svg.addEventListener("dblclick",e=>e.preventDefault());   // handled via double-tap above
svg.addEventListener("contextmenu",e=>{
  const wpi=hitWp(e);   // same authoritative hit-test; sole right-click delete path
  if(wpi>=0){ e.preventDefault(); deleteWaypoint(wpi); }
});

// ---------- boot: the auto grand tour + default loop + dynamic layout ----------
// (found buffers decode on demand in found-player.js — no csound prewarm pool)
// The page opens with a GRAND TOUR already drawn: 8 waypoints placed in the
// GAPS BETWEEN 9 near-neighbour genre anchors (each waypoint = the midpoint of
// two anchors), so every leg runs through inter-genre BLEND space and the
// journey starts between multiple genres — never sitting on top of one star.
// Every leg is a SHORT hop (<= TOUR_MAXLEG px). The music lives inside a genre→genre
// transition, so a walk of many short edges keeps the mix in one aesthetic
// neighbourhood at a time and drifts slowly across 2-3 of them — the opposite
// of the old 3-star cross-chart jump. It IS a normal path in S.waypoints:
// drag/delete/add a waypoint and clear it (✕ path) exactly as a hand-drawn one.
// Presentational only (Math.random), so every load draws a fresh tour; nothing
// persists, so a cleared/redrawn path is never re-imposed. window.__TOUR reports
// the max leg length + genre names for the headless gate.
// 2026-07-06 (Paul): 8 waypoints (down from 10-16), and each hop reaches half
// as far (MAXLEG 90->45) — a tighter, more local grand tour of shorter steps.
const TOUR_MINLEG=12;   // half the old 24; still >= the closest star pair, so no degenerate near-duplicate hop
const TOUR_MAXLEG=45;   // half the old 90 — each step reaches half as far across the chart
// ENERGY: a 0..1 "how danceable" score per genre, derived straight from the
// kernel's own vocabulary rather than a hand-curated genre list (dance-balance
// census, 2026-07-06: the unweighted tour landed ~1/3 of its stops on wash/
// low-energy anchors — the 2026-07 fictional-genre expansion piled 29 new
// stars into the low-energy half of the map). Two signals, both already on
// every K.GENRES anchor:
//   - bpm: the anchor's [lo,hi] tempo range, midpoint normalized 50-190bpm
//   - kits: fraction of the anchor's kit pool that ISN'T "off" (no drums) —
//     the sharpest single tell for a wash anchor: mallsoft/sourdough/
//     atlantidrone/crtwave/termswave/holdmusic/airtrafficdrone all carry
//     kits:["off",...], which catches e.g. thermostatwave (90bpm, danceable
//     on tempo alone) as still barely a beat.
// Weighted 60/40 toward bpm. Verified against the task's curated dancey list
// (acidhouse/house/deephouse/techno/italo/disco/trance/edm/dancepop/garage/
// gabber/breakcore/jungle/synthwave/darksynth/ebm/chiptune/hogcore/miamibass/
// phonk/newjack/bigbeat/electro/dubstep) — every one of those scores >=0.62,
// and the 0.6 cutoff below splits the 92-star catalog 59/33, matching the
// census's reported "~1/3 land on wash" almost exactly.
const ENERGY={};
for(const g of Object.keys(POS)){
  const a=K.GENRES[g];
  if(!a){ ENERGY[g]=0.3; continue; }   // shouldn't happen; neutral fallback
  const [lo,hi]=a.bpm, bpmScore=Math.max(0,Math.min(1,((lo+hi)/2-50)/140));   // 50bpm->0, 190bpm->1
  const kits=a.kits||[], kitScore=kits.length?kits.filter(k=>k!=="off").length/kits.length:1;
  ENERGY[g]=0.6*bpmScore+0.4*kitScore;
}
const GROOVE_ANCHOR=0.6;   // ENERGY at/above this = "groove anchor" (dance-floor tier)
const GROOVE_EVERY=3;      // force a reachable groove anchor at least this often, for contrast without monotony
function autoPath(){
  const gs=Object.keys(POS);
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  // Greedy nearest-unvisited walk with a max leg length, ENERGY-weighted among
  // the nearest few for VARIETY between visits AND a bias toward dancier
  // stars (the fix for "we seem to be exclusively super downtempo"). A
  // groove-anchor floor guarantees the tour doesn't drift into an all-wash
  // stretch even on an unlucky weighted draw; wash stars keep nonzero weight
  // so the tour still moves between energy levels rather than turning into
  // wall-to-wall bangers. Retry from fresh random starts and keep the longest
  // walk that reaches 8 (the tighter MAXLEG means a corner start dead-ends
  // more readily, so the 60-try keep-longest fallback matters more now).
  function walkFrom(){
    const target=9;   // 9 GENRES -> 8 midpoint waypoints (the path runs BETWEEN genres, so 8 steps needs 9 anchors)
    const start=gs[Math.floor(Math.random()*gs.length)];
    const vis=new Set([start]), walk=[start];
    let sinceGroove=ENERGY[start]>=GROOVE_ANCHOR?0:1;
    while(walk.length<target){
      const cur=POS[walk[walk.length-1]];
      const cands=gs.filter(g=>!vis.has(g)&&dist(POS[g],cur)>=TOUR_MINLEG&&dist(POS[g],cur)<=TOUR_MAXLEG);
      if(!cands.length) break;                       // dead-ended in a sparse corner
      cands.sort((a,b)=>dist(POS[a],cur)-dist(POS[b],cur));
      let pool=cands.slice(0,Math.min(cands.length,5));   // nearby few (widened from 3 to give ENERGY room to work)
      if(sinceGroove>=GROOVE_EVERY){                        // groove floor: force one in if any nearby star qualifies
        const groovy=pool.filter(g=>ENERGY[g]>=GROOVE_ANCHOR);
        if(groovy.length) pool=groovy;
      }
      const weights=pool.map(g=>0.15+Math.pow(ENERGY[g],1.5));   // dancey stars pull harder; wash never hits zero
      let r=Math.random()*weights.reduce((a,b)=>a+b,0), pick=pool[pool.length-1];
      for(let i=0;i<pool.length;i++){ r-=weights[i]; if(r<=0){ pick=pool[i]; break; } }
      vis.add(pick); walk.push(pick);
      sinceGroove=ENERGY[pick]>=GROOVE_ANCHOR?0:sinceGroove+1;
    }
    return {walk, target};
  }
  let best=[];
  for(let att=0;att<60;att++){
    const {walk,target}=walkFrom();
    if(walk.length>best.length) best=walk;
    if(best.length>=9&&walk.length>=target) break;
  }
  // the GENRE anchors the path threads between (energy-weighted short-hop walk)
  const names=best.slice(0,9);
  const gp=names.map(g=>POS[g]);
  // WAYPOINTS = midpoints between consecutive anchors, so every waypoint (and
  // the numbered dot on it) sits in the GAP between two genres, and every leg
  // runs through inter-genre BLEND space — never on top of a star (Paul: "I
  // wanted the LINES to pass between genres... start in between multiple
  // genres"). weightsAt() at a midpoint blends the 2-3 nearest anchors, so the
  // traveler is always mixing several genres, starting between the first pair.
  // (Triangle inequality: each midpoint→midpoint leg is <= the anchor hop cap,
  // so legs stay short — see TOUR_MAXLEG.)
  const pts=[];
  for(let i=0;i<gp.length-1;i++) pts.push({x:(gp[i][0]+gp[i+1][0])/2, y:(gp[i][1]+gp[i+1][1])/2});
  window.__TOUR={names, between:true, maxleg:TOUR_MAXLEG,
    legs:pts.slice(1).map((p,i)=>Math.hypot(p.x-pts[i].x,p.y-pts[i].y)),
    energy:names.map(g=>+ENERGY[g].toFixed(3)),
    groovy:names.filter(g=>ENERGY[g]>=GROOVE_ANCHOR).length};
  set({waypoints:pts, travel:{seg:0,t:0},
    status:"tonight's grand tour: "+pts.length+" steps between "+names.slice(0,3).join(" → ")+
      "… — ▶ LIVE to travel (✕ path to roam free)"});
  retarget(pts[0]);
}
// DEFAULT CLOSED LOOP (Paul 2026-07-08: "four steps default; step 1 always
// centred; always a loop"). Seeds exactly 4 waypoints: waypoint[0] pinned to the
// MAP CENTRE, plus 3 real genre stars spread ~120° around it at a comfortable
// radius, so the constellation line is an immediate closed quad through inter-
// genre blend space. Deterministic (no Math.random) so "default" is stable: the
// three outer stars are the nearest genre to each of three evenly-spaced compass
// directions at ~0.34·(min half-span). This IS a normal S.waypoints loop — drag/
// add/erase it like any hand-drawn path; the loop closes itself (travelStep wraps
// seg mod n, drawMap repeats waypoint[0]) no matter how you edit it. window.__LOOP
// reports the seed shape for the headless gate.
// ---------- DYNAMIC genre layout (deterministic, run at load) ----------
// Replaces the old hand-tuned POS with a computed layout so genre NAME LABELS
// never overlap and read cleanly at the default zoom. Seeds from POS where a
// genre has a coordinate; derives one for any K.GENRES genre missing from the
// seed (fugue, afrobeat) near its most-SIMILAR seeded neighbour; then relaxes.
// Deterministic: the only entropy is a per-name hash (NO Math.random), so the
// star chart is byte-identical every load. Mutates POS in place + recomputes the
// world. See the big note by the POS/WORLD block up top.
function _genreSim(){
  const G=K.GENRES, NAMES=Object.keys(G);
  const jac=(a,b)=>{ if(!a.size&&!b.size) return 0; let i=0; for(const x of a) if(b.has(x)) i++;
    return i/(a.size+b.size-i); };
  const poolsOf=g=>{ const o=G[g], s=new Set();
    for(const part of ["lead","bass","pads"]){ const p=o[part]; if(!p) continue;
      (p.samplerPool||[]).forEach(x=>s.add("s:"+x));
      const rec=p.recipe||{}; (Array.isArray(rec.model)?rec.model:[rec.model]).forEach(x=>x&&s.add("m:"+x)); }
    return s; };
  const F={};
  for(const g of NAMES) F[g]={ prog:new Set(G[g].progressions||[]), pool:poolsOf(g),
    kits:new Set(G[g].kits||[]), form:G[g].form||"", bpm:G[g].bpm?(G[g].bpm[0]+G[g].bpm[1])/2:110 };
  return (a,b)=>{ const fa=F[a], fb=F[b];
    return 2.2*jac(fa.prog,fb.prog)+2.0*jac(fa.pool,fb.pool)+0.8*jac(fa.kits,fb.kits)
      +0.6*(fa.form===fb.form?1:0)+0.8*(1-Math.min(1,Math.abs(fa.bpm-fb.bpm)/80)); };
}
const _hash=s=>{ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; };
export function computeGenreLayout(){
  const NAMES=Object.keys(K.GENRES);
  const sim=_genreSim();
  const seeded=NAMES.filter(g=>POS[g]);   // genres that carry a seed coordinate
  // 1. positions: seed where present; derive missing near most-similar seeded genre.
  const P={};
  for(const g of NAMES) if(POS[g]) P[g]=[POS[g][0],POS[g][1]];
  for(const g of NAMES){ if(P[g]) continue;
    let best=null,bs=-1; for(const h of seeded){ const s=sim(g,h); if(s>bs){bs=s;best=h;} }
    const hh=_hash(g), ang=(hh%360)*Math.PI/180, off=40+(hh>>>9)%30;
    P[g]=[POS[best][0]+off*Math.cos(ang), POS[best][1]+off*Math.sin(ang)]; }
  // 2. label box widths in real px at the default-zoom font (measure once). Labels
  // render to the RIGHT of the dot at font (12·fs)px in VT323 (monospace fallback).
  const fsD=Math.min(3,Math.max(1,Math.pow(DEFAULT_ZOOM,0.85)));
  const fontPx=12*fsD, ctx=document.createElement("canvas").getContext("2d");
  // MEASURE MONOSPACE, not VT323: the layout must be byte-identical every load
  // (see the determinism note by the POS/WORLD block). VT323 is a webfont, so
  // whether measureText sees it depends on a network race with boot — and the
  // relaxation is metric-sensitive enough that VT323's metrics send it unstable.
  // The label CSS lists `VT323, monospace`; before the split, boot beat the font
  // load and this measured the monospace fallback deterministically. Pin it here
  // so the split's extra module-fetch latency can't let the font win the race.
  ctx.font=fontPx+"px monospace";
  const labW={}; for(const g of NAMES) labW[g]=ctx.measureText(g).width;
  // SEP = a breathing moat (screen px per side) padded around every label box so
  // the relaxation spreads nodes well apart, not just barely non-overlapping. The
  // whole field then overflows the default zoom more — but there's room and it
  // pans, so an uncrowded map beats a tight fit. Scales a touch with type size.
  const SEP=5+2*fsD;
  const box=(g,px,py)=>({ l:px-4*fsD-SEP, r:px+9*fsD+labW[g]+3*fsD+SEP, t:py-fontPx/2-3*fsD-SEP, b:py+fontPx/2+3*fsD+SEP });
  // top-3 similar per genre for a WEAK grouping spring (decays to 0 mid-run).
  const topSim={}; for(const g of NAMES) topSim[g]=NAMES.filter(h=>h!==g)
    .map(h=>({h,s:sim(g,h)})).sort((a,b)=>b.s-a.s).slice(0,3);
  const bounds=()=>{ let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
    for(const g of NAMES){ const p=P[g]; if(p[0]<mnx)mnx=p[0]; if(p[0]>mxx)mxx=p[0]; if(p[1]<mny)mny=p[1]; if(p[1]>mxy)mxy=p[1]; }
    return {mnx,mny,mxx,mxy}; };
  const rb=svg.getBoundingClientRect();
  const viewW=rb.width||1200, viewH=rb.height||850;
  const MIN_DOT=72;                 // hard min dot separation, px at default zoom
  // iteration budget scales with node count: the self-normalizing bounds make
  // the relaxation converge asymptotically, so a dense map (178+ genres) needs
  // more passes to fully clear label overlaps than the ~110-genre seed did.
  const ITERS=Math.max(2200, NAMES.length*40);
  for(let it=0;it<ITERS;it++){
    const bb=bounds();
    const W=(bb.mxx-bb.mnx)+2*WORLD_MARGIN||1, H=(bb.mxy-bb.mny)+2*WORLD_MARGIN||1;
    const sx=viewW/W*DEFAULT_ZOOM, sy=viewH/H*DEFAULT_ZOOM;   // px per logical unit at default zoom
    const springK=0.014*Math.max(0,1-it/(ITERS*0.85));
    const fx={},fy={}; for(const g of NAMES){ fx[g]=0; fy[g]=0; }
    for(let i=0;i<NAMES.length;i++) for(let j=i+1;j<NAMES.length;j++){
      const a=NAMES[i],b=NAMES[j];
      const pax=(P[a][0]-bb.mnx)*sx, pay=(P[a][1]-bb.mny)*sy;
      const pbx=(P[b][0]-bb.mnx)*sx, pby=(P[b][1]-bb.mny)*sy;
      const A=box(a,pax,pay), B=box(b,pbx,pby);
      const ox=Math.min(A.r,B.r)-Math.max(A.l,B.l), oy=Math.min(A.b,B.b)-Math.max(A.t,B.t);
      if(ox>0&&oy>0){   // labels overlap: separate on the least-penetration axis (vertical-biased: labels are wide+short)
        const acx=(A.l+A.r)/2,bcx=(B.l+B.r)/2,acy=(A.t+A.b)/2,bcy=(B.t+B.b)/2;
        if(ox*1.7<oy){ const dir=acx<=bcx?-1:1, push=(ox+3)*0.5*dir; fx[a]+=push/sx; fx[b]-=push/sx; }
        else{ const dir=acy<=bcy?-1:1, push=(oy+3)*0.5*dir; fy[a]+=push/sy; fy[b]-=push/sy; }
      }
      const ddx=pbx-pax, ddy=pby-pay, dd=Math.hypot(ddx,ddy)||0.01;   // dot floor
      if(dd<MIN_DOT){ const push=(MIN_DOT-dd)*0.5, ux=ddx/dd, uy=ddy/dd;
        fx[a]-=push*ux/sx; fy[a]-=push*uy/sy; fx[b]+=push*ux/sx; fy[b]+=push*uy/sy; }
    }
    if(springK>0) for(const g of NAMES){ let tx=0,ty=0,tw=0;
      for(const {h,s} of topSim[g]){ tx+=P[h][0]*s; ty+=P[h][1]*s; tw+=s; }
      if(tw>0){ fx[g]+=(tx/tw-P[g][0])*springK; fy[g]+=(ty/tw-P[g][1])*springK; } }
    for(const g of NAMES){ P[g][0]+=fx[g]; P[g][1]+=fy[g]; }
  }
  // 3. normalize scale so the median nearest-neighbour distance matches the SEED —
  // keeps SNAP/CUTOFF blend semantics (they key off local spacing), then shift so
  // the min corner sits at WORLD_MARGIN. Screen gaps are scale-invariant, so this
  // preserves the overlap-free layout exactly.
  const medNN=pts=>{ const ds=[]; for(let i=0;i<pts.length;i++){ let mn=1e9;
      for(let j=0;j<pts.length;j++){ if(i===j) continue; const d=Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]); if(d<mn)mn=d; }
      ds.push(mn); } ds.sort((a,b)=>a-b); return ds[ds.length>>1]; };
  const seedMed=medNN(seeded.map(g=>POS[g])), newMed=medNN(NAMES.map(g=>P[g]))||1;
  const scale=seedMed/newMed, bb=bounds();
  // 4. write back into POS (in place — same object reference the app closes over).
  for(const k of Object.keys(POS)) if(!K.GENRES[k]) delete POS[k];   // drop any stale genre
  for(const g of NAMES) POS[g]=[(P[g][0]-bb.mnx)*scale+WORLD_MARGIN, (P[g][1]-bb.mny)*scale+WORLD_MARGIN];
  recomputeWorld();
  S.cursor={x:MAP_CENTER.x, y:MAP_CENTER.y};
}
export function seedDefaultLoop(){
  const c={x:MAP_CENTER.x,y:MAP_CENTER.y};
  const rad=0.34*Math.min(WORLD_W,WORLD_H)/2;
  const gs=Object.keys(POS);
  const used=new Set(), outer=[];
  for(const ang of [-Math.PI/2, -Math.PI/2+2*Math.PI/3, -Math.PI/2+4*Math.PI/3]){   // top, lower-right, lower-left
    const tx=c.x+rad*Math.cos(ang), ty=c.y+rad*Math.sin(ang);
    let best=null, bd=Infinity;
    for(const g of gs){ if(used.has(g))continue;
      const d=Math.hypot(POS[g][0]-tx,POS[g][1]-ty); if(d<bd){bd=d;best=g;} }
    if(best){ used.add(best); outer.push({g:best,x:POS[best][0],y:POS[best][1]}); }
  }
  const wps=[{x:c.x,y:c.y}, ...outer.map(o=>({x:o.x,y:o.y}))];
  window.__LOOP={center:{...c}, genres:outer.map(o=>o.g), count:wps.length, closed:true};
  set({waypoints:wps, travel:{seg:0,t:0}, queue:[],
    status:"default loop: centre → "+outer.map(o=>o.g).join(" → ")+" → centre — ▶ LIVE to travel the loop"});
  retarget(wps[0]);
}
export { centerView, autoPath };
