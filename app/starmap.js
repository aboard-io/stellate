// starmap.js — the star chart: the imperative SVG map (drawMap), the breathing
// traveler pulse, zoom (pinch / ctrl+wheel / plain wheel, MAP ONLY) + pan, the
// pointer-gesture state machine, waypoint editing (add/insert/delete), and the
// deterministic genre LAYOUT (computeGenreLayout / seedDefaultLoop / autoPath).
import { S, set, K, subs } from "./state.js";
import { POS, WORLD_W, WORLD_H, MAP_CENTER, WORLD_MARGIN, recomputeWorld } from "./world.js";
import { retarget } from "./targeting.js";
import { urlTick, legMetrics, paceSpeed, baseDuration, durMult, loopDuration, fmtDuration, fmtMult } from "./share.js";   // scrubbing the playhead: rewrite the bookmark's measure using the SAME constant-pace distance math as travelForBar/goLive; the dur* family feeds the node-drag duration tooltip

// ---------- node-drag DURATION TOOLTIP (Paul 2026-07-16: "put that duration up
// as a tooltip when people move nodes") ----------
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
  // Below the fit point (galaxy zoom) type and star geometry SHRINK with k so
  // the field reads as a galaxy of small stars; at k>=1 the old floors hold.
  const fs=Math.min(3,Math.max(ZOOM.k<1?0.55:1,Math.pow(ZOOM.k,0.85)));
  const gs=Math.min(1,Math.max(0.35,ZOOM.k));   // geometry scale: 1 at fit+, shrinks toward the galaxy floor
  // REGIONS behind everything: a soft color wash + a big goofy label at each
  // territory's centroid. Drawn first so stars/lines/traveler sit on top; the
  // labels are watermark-faint (see .region CSS) so they never fight the UI.
  if(REGIONS.length){
    const rfs=Math.min(2.2,Math.max(1,Math.pow(ZOOM.k,0.6)));   // gentler zoom growth than stars — these read as "continental"
    for(const rg of REGIONS){
      const cx=X(rg.cx), cy=Y(rg.cy);
      const rad=Math.max(60, rg.spread*rb.width/WORLD_W*ZOOM.k*0.9);
      svg.appendChild(el("circle",{cx,cy,r:rad.toFixed(1),fill:rg.color,opacity:.055}));   // soft territory wash
      const t=el("text",{x:cx,y:cy,"text-anchor":"middle","class":"region"});
      t.style.fontSize=(30*rfs).toFixed(1)+"px"; t.style.fill=rg.color;
      t.textContent=rg.label; svg.appendChild(t);
    }
  }
  if(S.waypoints.length>1){
    // CLOSED LOOP: repeat waypoint[0] at the end so the constellation line draws
    // the closing leg (waypoint[n-1] → waypoint[0]) the traveler actually walks.
    const pts=S.waypoints.concat([S.waypoints[0]]).map(w=>X(w.x)+","+Y(w.y)).join(" ");
    svg.appendChild(el("polyline",{points:pts,fill:"none",stroke:"#45e0ff","stroke-width":4,opacity:.18}));   // under-glow
    svg.appendChild(el("polyline",{points:pts,fill:"none",stroke:"#8ef2ff","stroke-width":1.2,"stroke-dasharray":"4 5",opacity:.85}));
  }
  const wmap=Object.fromEntries(S.weights.map(w=>[w.g,w.w]));
  // LABEL LEVEL-OF-DETAIL. 178 genres cannot all show a non-overlapping name on a
  // narrow screen or when zoomed out (a phone is ~430px wide — physically too few
  // pixels for 178 labels at readable size). So we draw EVERY star, but a name
  // only if its box clears the names already placed at THIS zoom. Active
  // (weighted) genres always win a slot; the rest fill greedily in a stable order.
  // Zoom in → the boxes spread on screen → more names appear. Pan doesn't change
  // which overlap (it just translates), only zoom does. On a wide desktop at the
  // default zoom the baked layout already clears all 178, so nothing is culled.
  const lctx=(drawMap._lc||(drawMap._lc=document.createElement("canvas").getContext("2d")));
  const fpx=e=>(e.w>0.01?12:11)*fs;
  // THE MAP SPEAKS THE FICTION (Paul 2026-07-10: "still a lot of old school
  // genre names like chiptune and idm all over the place"): every star draws
  // its kernel LABEL, never the id — culling measures the label too.
  const glabel=g=>(K.GENRES[g]&&K.GENRES[g].label)||g;
  const ent=Object.entries(POS).map(([g,[x,y]])=>({g,label:glabel(g),w:wmap[g]||0,cx:X(x),cy:Y(y)}));
  const lbox=e=>{ lctx.font=fpx(e)+"px VT323, monospace"; const tw=lctx.measureText(e.label).width, lx=e.cx+9*fs;
    return {l:lx-3, r:lx+tw+3, t:e.cy+4*fs-fpx(e)*0.92, b:e.cy+4*fs+fpx(e)*0.28}; };
  // placement priority: active genres first (always shown), then the rest stable
  const order=[...ent].sort((a,b)=>((b.w>0.01)-(a.w>0.01))||(b.w-a.w));
  const placed=[], show={};
  for(const e of order){ const bx=lbox(e);
    if(e.w>0.01){ show[e.g]=true; placed.push(bx); continue; }
    let hit=false; for(const p of placed){ if(bx.l<p.r&&bx.r>p.l&&bx.t<p.b&&bx.b>p.t){hit=true;break;} }
    if(!hit){ show[e.g]=true; placed.push(bx); } }
  for(const e of ent){
    const {g,w,cx,cy}=e;
    const rc=(REGION_OF[g]!=null&&REGIONS[REGION_OF[g]])?REGIONS[REGION_OF[g]].color:"#a06bff";   // inactive halo wears its region color
    svg.appendChild(el("circle",{cx,cy,r:(8+(w>0.01?w*26:0))*gs,fill:w>0.01?"#ff6ec7":rc,opacity:.10+w*.28}));  // halo (gs-scaled: shrinks at galaxy zoom)
    svg.appendChild(el("circle",{cx,cy,r:(w>0.01?3.2:2.2)*gs,fill:w>0.01?"#ffd7ee":"#e6e0ff",opacity:.95}));           // the star
    if(!show[g]) continue;   // name culled at this zoom — the star still shows; zoom in to read it
    const t=el("text",{x:cx+9*fs,y:cy+4*fs,"class":w>0.01?"anchor hot":"anchor"});
    t.style.fontSize=fpx(e)+"px"; t.textContent=e.label; svg.appendChild(t);
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
// GALAXY FLOOR (Paul 2026-07-25: "zoomed out and the top is cut off… let me zoom
// way out so that the genres are small like a galaxy"). k may now go BELOW the
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
export function zoomAround(cx,cy,k2){ // keep the screen point (cx,cy) fixed while scaling
  const r=svg.getBoundingClientRect(), sx=cx-r.left, sy=cy-r.top;
  const k1=ZOOM.k; k2=Math.max(MIN_ZOOM,Math.min(6,k2));
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
// THE DRAGGABLE PLAYHEAD (Paul 2026-07-10: "let me drag the playhead along the
// mix line"). With a path, the traveler IS the playhead — grabbing it and
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
  // CONSTANT PACE (2026-07-11 fix): the measure at a scrubbed point is its DISTANCE
  // along the perimeter ÷ the constant speed — the exact inverse of travelForBar —
  // NOT (seg+t)*pace. With the old formula the scrubbed measure and goLive's
  // distance-based drop-in disagreed, so hitting ▶ jumped back to where it was (Paul).
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
  // PLAYHEAD SCRUB release: SNAP the audio to where you dropped it (Paul: "move it
  // and that's where things play"), so it doesn't slow-glide back toward the old spot.
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
// iOS PINCH CONTAINMENT (Paul 2026-07-11: "when I hit max zoom-out and keep going
// in iOS that's how I get to my browser tabs"). Once the app's own pinch (map or
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

// ---------- VIZ zoom: the ⓘ "inside the sound" view's OWN transform ----------
// Paul 2026-07-11: "Let me zoom in on the viz but don't let it affect the other
// modes' zoom state — otherwise I can really zoom out." The map's ZOOM (above)
// and this VIZ state are FULLY SEPARATE objects: pinching/scrolling the viz never
// touches ZOOM and vice-versa, so zooming one can't strand the other zoomed-out.
// Each view keeps its own transform across view switches (both objects live in
// module scope). The viz is a scaled CSS transform on the #inside content, with
// its own clamp; at k===1 the transform is cleared so the native bottom-sheet /
// full-view CSS (and native scroll of a tall readout) resume untouched.
const inside=document.getElementById("inside"), insideWrap=document.getElementById("insideWrap");
const VIZ={k:1,ox:0,oy:0};
window.__VIZZOOM=VIZ;   // debug/probe access — independent of __ZOOM
function vizRect(){ return insideWrap?insideWrap.getBoundingClientRect():{left:0,top:0,width:innerWidth,height:innerHeight}; }
function clampViz(){
  VIZ.k=Math.max(1,Math.min(6,VIZ.k));
  if(VIZ.k===1){ VIZ.ox=0; VIZ.oy=0; return; }
  // scaled about origin (0,0): keep the scaled content covering the viewport so a
  // pan can't strand the readout off-screen. Content natural size = #inside's own
  // box (it fills the wrap width; scrollHeight is its full readout height).
  const r=vizRect();
  const cw=(inside&&inside.offsetWidth)||r.width, ch=(inside&&inside.scrollHeight)||r.height;
  const minX=Math.min(0, r.width - cw*VIZ.k), minY=Math.min(0, r.height - ch*VIZ.k);
  VIZ.ox=Math.max(minX,Math.min(0,VIZ.ox));
  VIZ.oy=Math.max(minY,Math.min(0,VIZ.oy));
}
let _vizCss="";
function applyVizZoom(){
  if(!inside) return;
  // only ever drive the inline transform in the viz view; at k===1 hand it back to
  // CSS (view-viz = none, the bottom-sheet fallback = translateX(-50%)). Cached so
  // the per-frame subscriber below is a no-op when nothing moved.
  const css=(S.vizView&&VIZ.k!==1)?`translate(${VIZ.ox.toFixed(1)}px,${VIZ.oy.toFixed(1)}px) scale(${VIZ.k.toFixed(3)})`:"";
  if(css===_vizCss) return;
  _vizCss=css;
  document.body.classList.toggle("viz-zoomed", !!css);
  inside.style.transformOrigin=css?"0 0":"";
  inside.style.transform=css;
}
function vizZoomAround(cx,cy,k2){   // keep the screen point (cx,cy) fixed while scaling
  const r=vizRect(), sx=cx-r.left, sy=cy-r.top, k1=VIZ.k;
  k2=Math.max(1,Math.min(6,k2));
  VIZ.ox=sx-(sx-VIZ.ox)*(k2/k1); VIZ.oy=sy-(sy-VIZ.oy)*(k2/k1); VIZ.k=k2;
  clampViz(); applyVizZoom();
}
if(inside){
  const vptrs=new Map(); let vpinch=null, vpan=null;
  inside.addEventListener("pointerdown",e=>{
    if(!S.vizView) return;
    vptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(vptrs.size===2){   // two fingers = pinch-zoom the viz ONLY
      const [a,b]=[...vptrs.values()];
      vpinch={d0:Math.max(12,Math.hypot(a.x-b.x,a.y-b.y)),k0:VIZ.k,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,ox0:VIZ.ox,oy0:VIZ.oy};
      vpan=null; return;
    }
    if(VIZ.k>1){   // zoomed: a single finger PANS (native scroll is off while zoomed — see .viz-zoomed CSS)
      vpan={sx:e.clientX,sy:e.clientY,ox0:VIZ.ox,oy0:VIZ.oy};
      try{ inside.setPointerCapture(e.pointerId); }catch(err){}
    }
  });
  inside.addEventListener("pointermove",e=>{
    if(!S.vizView) return;
    if(vptrs.has(e.pointerId)) vptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(vpinch&&vptrs.size===2){
      e.preventDefault();
      const [a,b]=[...vptrs.values()];
      const d=Math.max(12,Math.hypot(a.x-b.x,a.y-b.y)), cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
      const k2=Math.max(1,Math.min(6,vpinch.k0*d/vpinch.d0)), r=vizRect();
      VIZ.k=k2;
      VIZ.ox=(cx-r.left)-((vpinch.cx-r.left)-vpinch.ox0)*(k2/vpinch.k0);
      VIZ.oy=(cy-r.top)-((vpinch.cy-r.top)-vpinch.oy0)*(k2/vpinch.k0);
      clampViz(); applyVizZoom(); return;
    }
    if(vpan){ e.preventDefault();
      VIZ.ox=vpan.ox0+(e.clientX-vpan.sx); VIZ.oy=vpan.oy0+(e.clientY-vpan.sy);
      clampViz(); applyVizZoom();
    }
  },{passive:false});
  const vizEnd=e=>{ vptrs.delete(e.pointerId); if(vptrs.size<2) vpinch=null; if(vptrs.size===0) vpan=null; };
  inside.addEventListener("pointerup",vizEnd);
  inside.addEventListener("pointercancel",vizEnd);
  // desktop: ctrl+wheel / trackpad-pinch zooms the viz (plain wheel keeps scrolling
  // the readout, so a tall panel still reads normally). Mirrors the map's factor.
  inside.addEventListener("wheel",e=>{
    if(!S.vizView||!e.ctrlKey) return;
    e.preventDefault();
    const dy=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*(vizRect().height||600):e.deltaY;
    vizZoomAround(e.clientX,e.clientY,VIZ.k*Math.exp(-dy*0.0015));
  },{passive:false});
  // re-apply on every render so a VIEW SWITCH restores this view's own transform
  // (entering viz stamps VIZ back on #inside; leaving clears it). Cached = cheap.
  subs.push(applyVizZoom); applyVizZoom();
}

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

// ---------- REGIONS: the map divided into colored, goofily-named territories ----------
// Paul 2026-07-10: "the starmap is now so large that we should be dividing it
// into regions by color with big textual labels." The layout already clusters
// similar genres (computeGenreLayout's similarity springs), so a deterministic
// k-means over the FINAL POS carves the field into spatially- AND musically-
// coherent territories. Each region is named + colored by its ENERGY rank
// (wash → dance), so the colors read as a cool→warm gradient and the goofy names
// land on a fitting vibe. Deterministic (farthest-point seeding, NO Math.random)
// so the regions are byte-stable every load, exactly like the star positions.
const REGION_K=10;
// energy-ordered (mellow wash .. hardest banger); rank r gets NAMES[r]. Goofy in
// the house style ("Food Court Eternity", "Kerosene Twelve") — evocative, invented.
const REGION_NAMES=["Fathom Parish","The Drone Pastures","Vapor Sanatorium","Cardigan Hollow",
  "Dust Cul-de-sac","The Escalator Riviera","Sequin Junction","The Boogie Reservoir",
  "Piston Prairie","The Kickdrum Quarry"];
const REGION_COLORS=["#6a5cff","#22c1dc","#34d17a","#9bd93a","#ffd23f",
  "#ff9e3d","#ff7233","#ff5c8a","#b06bff","#ff3d5a"];
export let REGIONS=[];          // energy-sorted: [{label,color,cx,cy,members:[g],spread}]
export const REGION_OF={};      // genre -> index into REGIONS
export function computeRegions(){
  const gs=Object.keys(POS); if(!gs.length) return;
  const K2=Math.min(REGION_K, gs.length);
  const P=gs.map(g=>POS[g]);
  // deterministic farthest-point seeding: start at the min-(x+y) star, then each
  // next centroid is the star farthest from all chosen so far.
  const d2=(a,b)=>{const dx=a[0]-b[0],dy=a[1]-b[1];return dx*dx+dy*dy;};
  let s0=0; for(let i=1;i<P.length;i++) if(P[i][0]+P[i][1]<P[s0][0]+P[s0][1]) s0=i;
  const cen=[[...P[s0]]];
  while(cen.length<K2){
    let bi=0,bd=-1;
    for(let i=0;i<P.length;i++){ let mn=Infinity; for(const c of cen){const d=d2(P[i],c); if(d<mn)mn=d;} if(mn>bd){bd=mn;bi=i;} }
    cen.push([...P[bi]]);
  }
  // Lloyd iterations
  let asg=new Array(gs.length).fill(0);
  for(let it=0; it<40; it++){
    let moved=false;
    for(let i=0;i<P.length;i++){ let bj=0,bd=Infinity; for(let j=0;j<cen.length;j++){const d=d2(P[i],cen[j]); if(d<bd){bd=d;bj=j;}} if(asg[i]!==bj){asg[i]=bj;moved=true;} }
    const sx=new Array(K2).fill(0),sy=new Array(K2).fill(0),n=new Array(K2).fill(0);
    for(let i=0;i<P.length;i++){ sx[asg[i]]+=P[i][0]; sy[asg[i]]+=P[i][1]; n[asg[i]]++; }
    for(let j=0;j<K2;j++) if(n[j]){ cen[j]=[sx[j]/n[j], sy[j]/n[j]]; }
    if(!moved && it>2) break;
  }
  // gather clusters, compute mean ENERGY + centroid + spread
  const raw=[]; for(let j=0;j<K2;j++) raw.push({members:[],ex:0,cx:0,cy:0});
  gs.forEach((g,i)=>{ const c=raw[asg[i]]; c.members.push(g); c.ex+=(ENERGY[g]||0.3); c.cx+=P[i][0]; c.cy+=P[i][1]; });
  for(const c of raw){ const m=Math.max(1,c.members.length); c.energy=c.ex/m; c.cx/=m; c.cy/=m;
    c.spread=Math.sqrt(c.members.reduce((s,g)=>s+d2(POS[g],[c.cx,c.cy]),0)/m); }
  // name + color by ENERGY rank (mellow -> banger)
  const ranked=raw.filter(c=>c.members.length).sort((a,b)=>a.energy-b.energy);
  REGIONS=ranked.map((c,r)=>({ label:REGION_NAMES[r%REGION_NAMES.length], color:REGION_COLORS[r%REGION_COLORS.length],
    cx:c.cx, cy:c.cy, spread:c.spread, energy:+c.energy.toFixed(3), members:c.members }));
  for(const k in REGION_OF) delete REGION_OF[k];
  REGIONS.forEach((rg,idx)=>rg.members.forEach(g=>{REGION_OF[g]=idx;}));
  window.__REGIONS={count:REGIONS.length, regions:REGIONS.map(r=>({label:r.label,color:r.color,n:r.members.length,energy:r.energy,
    sample:r.members.map(g=>(K.GENRES[g]&&K.GENRES[g].label)||g).slice(0,6)}))};
}
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
// DEFAULT CLOSED LOOP (Paul 2026-07-08: "step 1 always centred; always a
// loop"; 2026-07-10: THREE waypoints — the default is a triangle). Seeds
// exactly 3 waypoints: waypoint[0] pinned to the MAP CENTRE (which sits in
// disco's neighborhood — the blend snap makes the centre read ~pure disco),
// plus 2 real genre stars, so the constellation line is an immediate closed
// triangle through inter-genre blend space. Deterministic (no Math.random) so
// "default" is stable: the outer stars are the nearest genre to each of two
// compass directions (up, lower-right) at ~0.34·(min half-span) — currently
// lasertemple (108-116bpm ritual pulse) then doomdrone (48-62bpm doom wash,
// drums mostly off). The third node is doomdrone ON PURPOSE: against the
// centre's disco four-on-the-floor and lasertemple's temple pulse it is the
// maximal musical contrast in reach (form pop→ritual→wave, tempo ~116→~112→
// ~55), so the default triangle rides a real energy arc instead of three
// flavors of the same beat. This IS a normal S.waypoints loop — drag/add/erase
// it like any hand-drawn path; the loop closes itself (travelStep wraps seg
// mod n, drawMap repeats waypoint[0]) no matter how you edit it. window.__LOOP
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
  // BAKED fast path (the common boot): POS already carries the exact relaxed
  // layout for every genre — it's a deterministic cache of the relaxation below
  // (see world.js). Nothing to solve, and re-running the relaxation would even
  // MIS-scale it (the normalize keys off the seed's median spacing, which is
  // denser once every genre is seeded). So just rebuild bounds + park the cursor.
  // The O(N²)·N*40 relaxation runs ONLY when a genre is missing (dev added one).
  if(seeded.length===NAMES.length){ recomputeWorld(); S.cursor={x:MAP_CENTER.x, y:MAP_CENTER.y}; return; }
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
  // full relaxation budget — reached only when a genre is missing from the baked
  // POS (the fast path above handles the common complete-POS boot). Scales with
  // node count: the self-normalizing bounds converge asymptotically.
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
  S.startBar=0;   // a fresh loop starts fresh — no inherited resume measure
  const c={x:MAP_CENTER.x,y:MAP_CENTER.y};
  const rad=0.34*Math.min(WORLD_W,WORLD_H)/2;
  const gs=Object.keys(POS);
  const used=new Set(), outer=[];
  for(const ang of [-Math.PI/2, -Math.PI/2+2*Math.PI/3]){   // top, lower-right (centre itself is node 1 — a 3-point triangle)
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
