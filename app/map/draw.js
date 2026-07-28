// draw.js — DRAWING THE STAR CHART. drawMap() rebuilds the whole #map SVG
// imperatively on every store write (regions wash → constellation line → stars +
// the label level-of-detail pass → waypoints → the traveler reticle), and the
// standalone rAF that breathes the traveler's glow lives beside it. Reads the
// transform from viewport.js and the territories from layout.js; owns no
// pointer input. Split out of starmap.js; the code below is unchanged.
import { S, set, K } from "../core/state.js";
import { alienize } from "./glyphs.js";
import { POS, WORLD_W, WORLD_H } from "../core/world.js";
import { svg, ZOOM, centerView } from "./viewport.js";
import { REGIONS, REGION_OF } from "./layout.js";

const NS="http://www.w3.org/2000/svg";
const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
// the traveler's live screen pos+scale, published by drawMap for cursorPulse.
// A standalone rAF animates ONLY the #curPulse glow radius/opacity, so the
// breath is smooth 60Hz and never resets when the imperative drawMap rebuilds
// the SVG (SMIL on a rebuilt node would restart+jitter every bar).
export const curPos={x:0,y:0,s:1};   // read by gestures.js (the playhead hit-test)
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
      t.textContent=alienize(rg.label); svg.appendChild(t);
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
  // THE MAP SPEAKS THE FICTION — no old-school genre ids like chiptune or idm
  // on the surface: every star draws its kernel LABEL, never the id, and the
  // culling measures the label too.
  // labels wear the alien alphabet (app/map/glyphs.js alienize): 1-2 letters per
  // name swapped for a homoglyph, re-rolled once per session. Memoized there,
  // so the width the LOD cull measures below is stable within a load.
  const glabel=g=>alienize((K.GENRES[g]&&K.GENRES[g].label)||g);
  const ent=Object.entries(POS).map(([g,[x,y]])=>({g,label:glabel(g),w:wmap[g]||0,cx:X(x),cy:Y(y)}));
  const lbox=e=>{ lctx.font=fpx(e)+"px VT323, monospace"; const tw=lctx.measureText(e.label).width, lx=e.cx+9*fs;
    return {l:lx-3, r:lx+tw+3, t:e.cy+4*fs-fpx(e)*0.92, b:e.cy+4*fs+fpx(e)*0.28}; };
  // placement priority: active genres first (always shown), then the rest stable
  const order=[...ent].sort((a,b)=>((b.w>0.01)-(a.w>0.01))||(b.w-a.w));
  const placed=[], show={}, ldy={};
  const hits=bx=>placed.some(p=>bx.l<p.r&&bx.r>p.l&&bx.t<p.b&&bx.b>p.t);
  const shift=(bx,dy)=>({l:bx.l,r:bx.r,t:bx.t+dy,b:bx.b+dy});
  for(const e of order){ const bx=lbox(e);
    if(e.w>0.01){
      // ACTIVE genres are never culled — you must be able to read what you are
      // hearing. But a blend IS a neighbourhood: two active stars sit close
      // together by definition, and their names are 130-230px wide, so the
      // natural slot often lands on one already taken (the boot blend drew
      // "Servo Elegy" straight through "Non Euclidean Court"). So slide this
      // name vertically — one line down, then up, then two — until it clears;
      // if nothing clears, draw it anyway. A covered name is a bug; a hidden
      // active genre is a worse one. (Inactive names below still just cull.)
      const h=(bx.b-bx.t)*1.05; let dy=0;
      for(const d of [0,h,-h,2*h,-2*h]) if(!hits(shift(bx,d))){ dy=d; break; }
      show[e.g]=true; ldy[e.g]=dy; placed.push(shift(bx,dy)); continue; }
    if(!hits(bx)){ show[e.g]=true; placed.push(bx); } }
  for(const e of ent){
    const {g,w,cx,cy}=e;
    const rc=(REGION_OF[g]!=null&&REGIONS[REGION_OF[g]])?REGIONS[REGION_OF[g]].color:"#a06bff";   // inactive halo wears its region color
    svg.appendChild(el("circle",{cx,cy,r:(8+(w>0.01?w*26:0))*gs,fill:w>0.01?"#ff6ec7":rc,opacity:.10+w*.28}));  // halo (gs-scaled: shrinks at galaxy zoom)
    svg.appendChild(el("circle",{cx,cy,r:(w>0.01?3.2:2.2)*gs,fill:w>0.01?"#ffd7ee":"#e6e0ff",opacity:.95}));           // the star
    if(!show[g]) continue;   // name culled at this zoom — the star still shows; zoom in to read it
    const dy=ldy[g]||0;      // an active name that had to slide clear of another (see the placement pass)
    const t=el("text",{x:cx+9*fs,y:cy+4*fs+dy,"class":w>0.01?"anchor hot":"anchor"});
    t.style.fontSize=fpx(e)+"px"; t.textContent=e.label; svg.appendChild(t);
    if(w>0.01){const wl=el("text",{x:cx+9*fs,y:cy+17*fs+dy,"class":"wlabel"});
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
