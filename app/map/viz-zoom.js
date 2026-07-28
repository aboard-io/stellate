// viz-zoom.js — the ⓘ "inside the sound" panel's OWN pinch/pan transform. It sits
// in app/map/ because it was written beside the map's gesture machine and is the
// other half of the same law (the two zooms are FULLY SEPARATE state), but it
// shares no code with them: it touches #inside, not #map, and imports nothing
// from the rest of the map. Loaded for its side effects (listeners + the store
// sub). Split out of starmap.js; the code below is unchanged.
import { S, subs } from "../core/state.js";

// ---------- VIZ zoom: the ⓘ "inside the sound" view's OWN transform ----------
// Zooming the viz must not touch the other modes' zoom state. The map's ZOOM (above)
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
