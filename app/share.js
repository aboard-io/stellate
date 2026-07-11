// share.js — THE BOOKMARKABLE MIX (Paul 2026-07-10: "make the positions of the
// nodes and the seed update in a query string so the entire site is bookmarkable.
// Update it with measure numbers so we can drop in on any part of the mix.")
//
// The URL is the whole session: seed + the path's waypoints + pace + mode + the
// CURRENT MEASURE. It updates in place (history.replaceState — no history spam)
// every bar while live, so copying the address bar (or the ⚙ panel's ⧉ share
// button) at any moment captures exactly this mix at exactly this measure.
// Loading such a URL restores the loop and DROPS IN at that measure: the walk
// starts its serial there (music is deterministic per (seed, serial), so measure
// N sounds identical to having played N bars to reach it), and the traveler is
// placed at the matching position along the path.
//
//   ?seed=42&path=1691.4502,1826.3140,1101.20620&pace=256&mode=auto&m=97
//
// path = x.y waypoint pairs (logical world coords, integers); m = 1-based measure.
import { S, set } from "./state.js";
import { BARS_PER_SEG } from "./world.js";

// ── CONSTANT-PACE TRAVEL (Paul 2026-07-11: "the playhead should always move at a
// constant pace; distance between nodes shouldn't matter"). The old model gave
// EVERY leg exactly `pace` bars, so the traveler raced across long legs and
// crawled short ones. Now the traveler moves at a constant SPEED — PACE_REF/pace
// world-units per bar — so a leg's bar-count is proportional to its LENGTH and a
// whole loop's duration depends only on the total path length, not the number or
// spacing of nodes. PACE_REF ≈ the default loop's average leg (497), so `pace`
// keeps its old feel for the default triangle (~764 bars vs the old 768).
export const PACE_REF = 500;
// per-waypoint closed-loop leg lengths + perimeter (the closing leg n-1 -> 0 too).
export function legMetrics(){
  const n=S.waypoints.length, legs=[]; let perim=0;
  for(let i=0;i<n;i++){ const a=S.waypoints[i], b=S.waypoints[(i+1)%n];
    const d=Math.hypot(b.x-a.x,b.y-a.y); legs.push(d); perim+=d; }
  return { n, legs, perim };
}
// world-units the traveler advances per bar (constant; bigger pace = slower).
export function paceSpeed(){ return PACE_REF/Math.max(8,Math.min(4096,+S.pace||BARS_PER_SEG)); }
// bars for one full loop at the current pace (perimeter / speed) — path-length only.
export function loopBars(){ const { perim }=legMetrics(); return Math.max(1, Math.round(perim/Math.max(1e-6, paceSpeed()))); }
// distance-along-perimeter -> {seg,t} (walk the legs; perim precomputed).
function segAtDistance(d, legs, perim, n){
  d=((d%perim)+perim)%perim;
  let seg=0;
  while(seg<n-1 && d>=legs[seg]){ d-=legs[seg]; seg++; }
  return { seg, t: legs[seg]>1e-6 ? Math.min(1, d/legs[seg]) : 0 };
}

export function buildShareUrl(){
  const q=new URLSearchParams();
  q.set("seed", String(S.seed));
  if(S.waypoints.length>=2)
    q.set("path", S.waypoints.map(w=>Math.round(w.x)+"."+Math.round(w.y)).join(","));
  if(+S.pace!==BARS_PER_SEG) q.set("pace", String(S.pace));
  if(S.modeLock!=="auto") q.set("mode", S.modeLock);
  const m=S.live&&S.barInfo?(S.barInfo.serial+1):((S.startBar||0)+1);   // 1-based measure; idle = the resume point
  if(m>1) q.set("m", String(m));
  return location.origin+location.pathname+"?"+q.toString();
}

// boot restore — call BEFORE the first retarget/seedDefaultLoop decision.
// Returns true when a path came from the URL (main.js then skips the default loop).
export function applyUrlState(){
  const q=new URLSearchParams(location.search);
  let restored=false;
  if(q.get("seed")){ const v=parseInt(q.get("seed"),10); if(v>=1&&v<=99999) S.seed=v; }
  if(q.get("pace")){ const p=parseInt(q.get("pace"),10); if(p>=8&&p<=4096) S.pace=p; }
  if(q.get("mode")) S.modeLock=q.get("mode");
  const path=q.get("path");
  if(path){
    const wps=path.split(",").map(s=>{ const [x,y]=s.split(".").map(Number); return {x,y}; })
      .filter(w=>isFinite(w.x)&&isFinite(w.y));
    if(wps.length>=2){ S.waypoints=wps; restored=true; }
  }
  const m=parseInt(q.get("m"),10);
  if(m>0){
    S.startBar=m-1;                                  // engine walk serial (0-based)
    S.barCount=m-1;
    if(S.waypoints.length>=2) S.travel=travelForBar(m-1);   // traveler position from the measure (constant pace)
  }
  return restored;
}

// measure -> travel position along the loop (shared by boot restore, goLive's
// drop-in, and the draggable playhead's inverse). CONSTANT PACE: the traveler
// is at distance bar×speed along the perimeter (speed = PACE_REF/pace), so leg
// spacing never changes how fast it moves.
export function travelForBar(bar){
  const { n, legs, perim }=legMetrics(); if(n<2) return {seg:0,t:0};
  return segAtDistance(bar*paceSpeed(), legs, perim, n);
}
export function pointOnPath(travel){
  const n=S.waypoints.length; if(n<2) return null;
  const a=S.waypoints[travel.seg%n], b=S.waypoints[(travel.seg+1)%n];
  return {x:a.x+(b.x-a.x)*travel.t, y:a.y+(b.y-a.y)*travel.t};
}

// per-bar address-bar refresh (live only; replaceState leaves history alone).
// Throttled to one write per bar — onBar already fires at bar granularity.
let lastUrl="";
export function urlTick(){
  try{
    const u=buildShareUrl();
    if(u!==lastUrl){ lastUrl=u; history.replaceState(null,"",u.slice(location.origin.length)); }
  }catch(e){}
}

// ⧉ share: copy the current URL (clipboard with a legacy fallback)
export function copyShareUrl(){
  const u=buildShareUrl();
  const ok=()=>set({status:"link copied — this exact mix at measure "+(new URLSearchParams(u.split("?")[1]).get("m")||"1")});
  const fallback=()=>{ try{ const ta=document.createElement("textarea"); ta.value=u; document.body.appendChild(ta);
    ta.select(); document.execCommand("copy"); ta.remove(); ok(); }catch(e){ set({status:"copy failed — the URL is in the address bar"}); } };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(ok,fallback);
  else fallback();
}
