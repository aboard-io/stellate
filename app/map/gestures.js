// gestures.js — THE POINTER GESTURE MACHINE over the star chart: the exclusive
// gestureMode state (drag / waypoint / playhead-scrub / pan / pinch), the
// authoritative screen-space hit-tests (hitWp / hitTraveler), waypoint editing
// (insert on double-tap, delete on double-tap or right-click), the playhead
// scrub, the wheel/pinch zoom entry points, the "interacting" label hold, the
// node-drag duration tooltip, and the page-level pinch containment. Drives
// viewport.js's ZOOM and the store; draws nothing itself. Split out of
// starmap.js; the code below is unchanged.
import { S, set } from "../core/state.js";
import { WORLD_W, WORLD_H } from "../core/world.js";
import { retarget } from "../audio/targeting.js";
import { urlTick, legMetrics, paceSpeed, baseDuration, durMult, loopDuration, fmtDuration, fmtMult } from "../core/share.js";   // scrubbing the playhead: rewrite the bookmark's measure using the SAME constant-pace distance math as travelForBar/goLive; the dur* family feeds the node-drag duration tooltip
import { svg, ZOOM, clampZoom, zoomAround, toXY } from "./viewport.js";
import { curPos } from "./draw.js";               // the traveler's drawn screen pos — the playhead hit-test
import { seedDefaultLoop } from "./layout.js";    // erasing a path down to nothing re-seeds the default loop

// ---------- node-drag DURATION TOOLTIP ----------
// While a waypoint is dragged, a small floating readout follows the pointer with
// the loop's distance-derived time at ×1 (share.js baseDuration — live, since
// the drag is changing the perimeter under it), plus the dialed multiple's
// effective time when the speed slider is off ×1. Created lazily, hidden on
// pointer release; pure DOM, never touches the SVG hot path.
let durTipEl=null;
function durTipShow(e){
  if(!durTipEl){ durTipEl=document.createElement("div"); durTipEl.id="durTip"; document.body.appendChild(durTipEl); }
  const m=durMult();
  durTipEl.textContent = "loop ≈ "+fmtDuration(baseDuration())
    + (Math.abs(m-1)>1e-9 ? "  ·  "+fmtMult(m)+" → "+fmtDuration(loopDuration()) : "");
  durTipEl.style.left=(e.clientX+16)+"px";
  durTipEl.style.top=(e.clientY-14)+"px";
  durTipEl.style.display="block";
}
function durTipHide(){ if(durTipEl) durTipEl.style.display="none"; }

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
// THE DRAGGABLE PLAYHEAD: the playhead drags along the mix line.
// With a path, the traveler IS the playhead — grabbing it and
// sliding projects the pointer onto the nearest leg, sets S.travel there, and
// retargets the mix (a glide while live, a place while stopped). While stopped
// it also sets S.startBar so ▶ resumes — and the shared URL bookmarks — that
// exact measure. Screen-space hit-test like hitWp, sized to the reticle.
function hitTraveler(e){
  if(S.waypoints.length<2) return false;
  const r=svg.getBoundingClientRect();
  const cX=e.clientX!=null?e.clientX:(e.touches&&e.touches[0]?e.touches[0].clientX:0);
  const cY=e.clientY!=null?e.clientY:(e.touches&&e.touches[0]?e.touches[0].clientY:0);
  const fs=Math.min(3,Math.max(1,Math.pow(ZOOM.k,0.85)));
  return Math.hypot(cX-r.left-curPos.x, cY-r.top-curPos.y)<=26*fs+8;
}
function projectOnPath(pt){
  const n=S.waypoints.length; let best={seg:0,t:0,d:Infinity,x:pt.x,y:pt.y};
  for(let i=0;i<n;i++){
    const a=S.waypoints[i], b=S.waypoints[(i+1)%n];
    const dx=b.x-a.x, dy=b.y-a.y, len2=dx*dx+dy*dy||1;
    const u=Math.max(0,Math.min(1,((pt.x-a.x)*dx+(pt.y-a.y)*dy)/len2));
    const px=a.x+dx*u, py=a.y+dy*u, d=Math.hypot(pt.x-px,pt.y-py);
    if(d<best.d) best={seg:i,t:u,d,x:px,y:py};
  }
  return best;
}
function dragPlayhead(e){
  const p=projectOnPath(toXY(e));
  // CONSTANT PACE: the measure at a scrubbed point is its DISTANCE along the
  // perimeter ÷ the constant speed — the exact inverse of travelForBar — NOT
  // (seg+t)*pace. Under that other formula the scrubbed measure and goLive's
  // distance-based drop-in disagree, so ▶ jumps back to where it was.
  const { legs }=legMetrics();
  let d=0; for(let i=0;i<p.seg;i++) d+=legs[i]||0; d+=p.t*(legs[p.seg]||0);
  const bar=Math.round(d/Math.max(1e-6,paceSpeed()));
  set({travel:{seg:p.seg,t:p.t}, barCount:bar});   // reseat the traveler bar counter too (URL/bookmark follows)
  if(!S.live) S.startBar=bar;
  retarget({x:p.x,y:p.y});   // glide-preview during the drag; the SNAP happens on release (endPtr) so it's not choppy
  urlTick();   // the address bar's ?m= follows the scrubbed measure (stopped or live) so the bookmark is always current
  set({status:"playhead → measure "+(bar+1)+" (leg "+(p.seg+1)+")"});
}

// ITEM 6: delete a waypoint (double-tap it, or right-click). Splice + renumber,
// then reroute the leg through the survivors. If we removed the leg the traveler
// is walking (or its endpoint), clamp the travel segment into range and snap the
// TARGET to a surviving waypoint via retarget — which GLIDES when live (no audio
// stop, no exception) and PLACES when stopped. Below 2 points the traveler just
// holds the last target (travelStep no-ops), so the music never drops.
function deleteWaypoint(i){
  if(i<0||i>=S.waypoints.length) return;
  S.startBar=0;   // the path changed — the old bookmark/resume measure no longer maps to it
  const w=[...S.waypoints]; w.splice(i,1);
  const len=w.length;
  // erased down toward nothing: re-seed the default centred loop. There is
  // ALWAYS a loop — below 2 points a path can't be one, so re-seed sensibly.
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
// ADD a waypoint by double-tap: INSERT it into the nearest leg — splice
// between the two adjacent waypoints whose connecting segment is closest to the
// tap, never append to the end of the chain. The loop stays closed (drawMap
// repeats waypoint[0]; travelStep wraps seg mod n). Returns the insert index.
export function insertWaypoint(pt){
  S.startBar=0;   // the path changed — the old bookmark/resume measure no longer maps to it
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
let gestureMode="none", dragWpI=-1, lastTap={t:0,sx:0,sy:0};
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
    gestureMode="pinch"; dragWpI=-1; panMoved=false; panStart=null; lastTap={t:0,sx:0,sy:0};
    document.body.classList.remove("dragging");
    return;
  }
  const pt=toXY(e), now=performance.now();
  const wpi=hitWp(e);   // authoritative — a waypoint always beats the traveler (ITEM 5)
  // DOUBLE-TAP proximity is measured in SCREEN PIXELS, not logical world units. The map
  // now spans ~25000 logical units tall, so at default zoom the old `<16 logical` window was
  // ~0.4 SCREEN px — no finger (or mouse) could land two taps that close, so double-tap-to-add
  // silently stopped working ("we've lost the ability to add nodes"). 28 screen px is a normal
  // double-tap slop; window widened 380->440ms for touch.
  if(now-lastTap.t<440 && Math.hypot(e.clientX-lastTap.sx, e.clientY-lastTap.sy)<28){
    lastTap={t:0,sx:0,sy:0};
    // DOUBLE-TAP grammar: on a waypoint = DELETE it (ITEM 6); on empty sky =
    // extend the path (unchanged). Waypoints are hit-tested FIRST.
    if(wpi>=0){ deleteWaypoint(wpi); return; }
    // INSERT into the nearest leg (not append): splice between the two adjacent
    // waypoints whose segment is closest to the tap. insertWaypoint handles the
    // stopped-vs-live playhead rule (snap to start stopped; keep the glide live).
    insertWaypoint(pt);
    return;
  }
  lastTap={t:now,sx:e.clientX,sy:e.clientY};
  // right-click delete is handled once, in the contextmenu listener below
  if(e.button!==0) return;
  if(wpi>=0){ gestureMode="wp"; dragWpI=wpi; }   // grab the waypoint even when the traveler sits on it (ITEM 5)
  else if(hitTraveler(e)){ gestureMode="travel"; }   // grab the PLAYHEAD: slide it along the mix line
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
  else { set({status:"loop active — drag the pink playhead to scrub the mix, drag a waypoint to reshape, dbl-tap the sky to add one"}); return; }
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
  if(gestureMode==="wp"){ markItx(); const pt=toXY(e); S.waypoints[dragWpI]=pt; set({}); durTipShow(e); }
  else if(gestureMode==="travel"){ e.preventDefault(); markItx(); dragPlayhead(e); }
  else if(gestureMode==="drag"){ e.preventDefault(); markItx(); retarget(toXY(e)); }
});
const endPtr=e=>{ ptrs.delete(e.pointerId); if(ptrs.size<2) pinch=null;
  if(gestureMode==="pan"){ // a zoomed single-finger gesture: pan already applied; a no-move
    // tap falls through to the normal place/select (only when free to drag —
    // with a path the traveler owns the cursor, so a tap stays inert as before)
    if(!panMoved && S.waypoints.length<2 && panStart) retarget(panStart.pt);
    panMoved=false; panStart=null; }
  // PLAYHEAD SCRUB release: SNAP the audio to where you dropped it — move it and
  // that is where things play — so it doesn't slow-glide back to the old spot.
  else if(gestureMode==="travel" && S.live) retarget({x:S.cursor.x,y:S.cursor.y}, true);
  gestureMode="none"; dragWpI=-1; document.body.classList.remove("dragging"); durTipHide(); };
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
// iOS PINCH CONTAINMENT. On iOS, hitting max zoom-out and pinching further is
// how you reach the browser tabs. Once the app's own pinch (map or
// viz) bottoms out at k===1, Safari lets the leftover pinch fall THROUGH to the
// page — native page-zoom / the tab-overview gesture. The app must own the pinch
// entirely: kill the default on ANY multi-touch move, everywhere. Paired with the
// gesture* preventDefault above, touch-action on the gesture surfaces (CSS), and
// the viewport meta's user-scalable=no, this closes the fall-through. Single-
// finger pan/scroll is untouched (touches.length===1 passes straight through), so
// legit one-finger panning and modal scrolling still work. (headless chromium
// can't fire Safari's gesture/multi-touch pinch — verify on a real iOS device.)
addEventListener("touchmove",e=>{ if(e.touches&&e.touches.length>1) e.preventDefault(); },{passive:false});
svg.addEventListener("dblclick",e=>e.preventDefault());   // handled via double-tap above
svg.addEventListener("contextmenu",e=>{
  const wpi=hitWp(e);   // same authoritative hit-test; sole right-click delete path
  if(wpi>=0){ e.preventDefault(); deleteWaypoint(wpi); }
});
