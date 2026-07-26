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
import { BARS_PER_SEG, POS } from "./world.js";

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
// TARGET LOOP DURATION (Paul): the traveler's speed is dialed as a TIME — how long the
// WHOLE loop should take (8 min .. 24 h, log slider, default 30 min) — not an abstract
// bars-per-leg "pace". Speed = perimeter × NOMINAL_SPB / duration, so the loop lasts
// ~`duration` regardless of the path's SIZE (a big path just moves faster; a small one
// slower). NOMINAL_SPB is a reference seconds-per-bar (~120 bpm × an 8-beat bar); the real
// wall-clock scales with the song's actual tempo, so the dialed time is approximate by design.
export const NOMINAL_SPB = 4;          // reference seconds per bar for the duration→speed map
export const MIN_DURATION = 480;       // (legacy-URL conversion only)
export const MAX_DURATION = 86400;     // (legacy-URL conversion only)
export const DEFAULT_DURATION = 1800;  // 30 minutes — the ×1 reference (see BASE_SPW)
// ── DISTANCE-DERIVED DURATION × A LOG MULTIPLE (Paul 2026-07-16: "change the
// duration slider to a logarithmic duration multiple, faster to slower, 100×
// speed to a million times longer; measure the full distance as nodes are
// added and come up with a reasonable default; play at the default rate
// adjusted by the multiple"). The path's own length now sets the BASE time —
// BASE_SPW seconds per world-unit, tuned so the seeded default triangle
// (~1500 wu perimeter) plays its historical ~30 minutes at ×1 — and the dial
// is a pure MULTIPLE of that: ×0.01 (100× faster) … ×1,000,000 (the
// Longplayer end). Bigger paths simply take proportionally longer at ×1.
export const BASE_SPW = DEFAULT_DURATION / 1500;   // 1.2 s per world-unit at ×1
export const MULT_MIN = 0.01, MULT_MAX = 1e6;
export function durMult(){
  const m = +S.durMult > 0 ? +S.durMult : 1;
  return Math.max(MULT_MIN, Math.min(MULT_MAX, m));
}
// the "reasonable default" — what the loop takes at ×1, measured off the path
export function baseDuration(){
  const { perim } = legMetrics();
  return perim > 1e-6 ? Math.max(30, perim * BASE_SPW) : DEFAULT_DURATION;
}
export function loopDuration(){ return Math.max(10, baseDuration() * durMult()); }
// one duration formatter for the panel + the node-drag tooltip (seconds → the
// natural unit; the ×1e6 end reads in years, so the ladder goes all the way)
export function fmtDuration(s){
  s = Math.max(0, +s || 0);
  if (s < 90) return Math.round(s) + " s";
  if (s < 5400) return Math.round(s / 60) + " min";
  if (s < 172800) { const h = s / 3600; return (h < 10 ? Math.round(h * 10) / 10 : Math.round(h)) + " hr"; }
  if (s < 63072000) { const d = s / 86400; return (d < 10 ? Math.round(d * 10) / 10 : Math.round(d)) + " days"; }
  const y = s / 31536000; return (y < 10 ? Math.round(y * 10) / 10 : Math.round(y)) + " years";
}
export function fmtMult(m){
  if (m >= 0.95 && m < 1.05) return "×1";
  if (m >= 1) return "×" + (m >= 100 ? Math.round(m).toLocaleString("en-US") : (Math.round(m * 10) / 10));
  return "×" + (Math.round(m * 1000) / 1000);
}
// world-units the traveler advances per bar. Derived from the target loop DURATION + the
// path perimeter, so the whole loop takes ~loopDuration() seconds. No path yet -> a benign
// default (the traveler isn't moving anyway).
export function paceSpeed(){
  const { perim } = legMetrics();
  if (perim > 1e-6) return Math.max(1e-3, perim * NOMINAL_SPB / loopDuration());
  return PACE_REF / BARS_PER_SEG;
}
// LOOP-LENGTH SAFETY CAP (2026-07-11 crash fix, kept after the 2026-07-25
// export removal): a constant-pace loop over a large-coordinate path can be
// tens of thousands of bars (perim/speed) — anything that MATERIALIZES the
// loop bar-by-bar would OOM (the old whole-path walk did, Paul's ?m=787 URL,
// perim ~63k → ~32k bars). The live playhead is UNAFFECTED (travelStep steps
// one bar at a time and travelForBar wraps at the perimeter); loopBars() is
// the bounded loop-length everything else reads.
export const MAX_LOOP_BARS = 2048;
// bars for one full loop at the current pace (perimeter / speed) — path-length only,
// clamped to MAX_LOOP_BARS so a giant path can't blow up loop-length consumers.
export function loopBars(){ const { perim }=legMetrics();
  return Math.max(1, Math.min(MAX_LOOP_BARS, Math.round(perim/Math.max(1e-6, paceSpeed())))); }
// distance-along-perimeter -> {seg,t} (walk the legs; perim precomputed).
function segAtDistance(d, legs, perim, n){
  d=((d%perim)+perim)%perim;
  let seg=0;
  while(seg<n-1 && d>=legs[seg]){ d-=legs[seg]; seg++; }
  return { seg, t: legs[seg]>1e-6 ? Math.min(1, d/legs[seg]) : 0 };
}

// travel position -> measure: the CONSTANT-PACE INVERSE of travelForBar (distance
// along the perimeter / speed). THE PLAYHEAD IS THE SOURCE OF TRUTH for the
// measure: dragging the traveler while LIVE moves the playhead without moving the
// engine's bar serial, so anything that reports "where are we" must read the
// traveler. Lives here beside travelForBar (its forward direction) and is used by
// both buildShareUrl below and live.js stopLive's resume measure — one inverse,
// one answer, so a copied link and a stop-then-play land on the same spot.
export function barForTravel(travel){
  const { legs }=legMetrics();
  let d=0; for(let i=0;i<travel.seg;i++) d+=legs[i]||0;
  d+=travel.t*(legs[travel.seg]||0);
  return Math.max(0, Math.round(d/Math.max(1e-6, paceSpeed())));
}

// THE MEASURE (1-based) — where "here" is, for anything that has to name this
// moment: the share URL's ?m, and the ⤓ midi filename (app/export.js), so a
// copied link and a downloaded file agree about which measure they are.
// LIVE = wherever the PLAYHEAD is (barForTravel), not the engine's bar serial:
// a mid-live playhead drag moves the traveler and leaves the serial running, so
// the serial-based answer used to name a measure the user is no longer at.
// Reading the traveler makes the copied link agree with the visible playhead
// AND with stopLive's resume measure (same inverse). It also means the measure
// wraps with the loop, exactly as a stop→play does. No path (a single point)
// has no traveler, so it falls back to the serial; idle = the resume point.
export function currentMeasure(){
  return S.live?(S.waypoints.length>=2?barForTravel(S.travel)+1:(S.barInfo?S.barInfo.serial+1:1))
               :((S.startBar||0)+1);
}

export function buildShareUrl(){
  const q=new URLSearchParams();
  q.set("seed", String(S.seed));
  if(S.waypoints.length>=2)
    q.set("path", S.waypoints.map(w=>Math.round(w.x)+"."+Math.round(w.y)).join(","));
  if(Math.abs(durMult()-1)>1e-9) q.set("xdur", String(durMult()));   // the duration MULTIPLE rides the URL (×1 omitted)
  if(S.modeLock!=="auto") q.set("mode", S.modeLock);
  if(S.soundfont && S.soundfont!=="fluidr3") q.set("sf", S.soundfont);   // the chosen soundfont rides the URL (Paul)
  const m=currentMeasure();   // 1-based; the one law, above
  if(m>1) q.set("m", String(m));
  return location.origin+location.pathname+"?"+q.toString();
}

// boot restore — call BEFORE the first retarget/seedDefaultLoop decision.
// Returns true when a path came from the URL (main.js then skips the default loop).
export function applyUrlState(){
  const q=new URLSearchParams(location.search);
  let restored=false;
  if(q.get("seed")){ const v=parseInt(q.get("seed"),10); if(v>=1&&v<=99999) S.seed=v; }
  if(q.get("mode")) S.modeLock=q.get("mode");
  // ?genre=<id> — the guessable entry point (access.html and embed.html
  // already honour it, and every release-feed link carries it as its readable
  // half). A tight triangle ON the star: radius 22 world-units keeps every
  // point unambiguously nearest this anchor (closest star pair in the baked
  // layout is ~107 apart; targeting.js snaps once the gap clears SNAP=64), so
  // the loop plays the pure genre while the traveler still moves. An explicit
  // ?path= always wins — it is the more specific instruction.
  const gid=q.get("genre");
  if(gid && !q.get("path") && POS[gid]){
    const [gx,gy]=POS[gid], R=22;
    S.waypoints=[0,2.0944,4.1888].map(a=>({x:Math.round(gx+R*Math.cos(a-Math.PI/2)),
                                           y:Math.round(gy+R*Math.sin(a-Math.PI/2))}));
    restored=true;
  }
  const path=q.get("path");
  if(path){
    const wps=path.split(",").map(s=>{ const [x,y]=s.split(".").map(Number); return {x,y}; })
      .filter(w=>isFinite(w.x)&&isFinite(w.y));
    if(wps.length>=2){ S.waypoints=wps; restored=true; }
  }
  // DURATION. New links carry `xdur` (the multiple). LEGACY links carried `dur`
  // (absolute seconds) or `pace` (bars/leg) — both convert to the multiple that
  // plays THIS path at the same speed the old link meant. (Done AFTER waypoints
  // so baseDuration()'s perimeter is known.)
  if(q.get("xdur")){ const m=parseFloat(q.get("xdur"));
    if(m>0) S.durMult=Math.max(MULT_MIN, Math.min(MULT_MAX, m)); }
  else if(q.get("dur")){ const d=parseInt(q.get("dur"),10);
    if(d>=1){ const legacy=Math.max(MIN_DURATION, Math.min(MAX_DURATION, d));
      S.durMult=Math.max(MULT_MIN, Math.min(MULT_MAX, legacy/baseDuration())); } }
  else if(q.get("pace")){ const p=parseInt(q.get("pace"),10);
    if(p>=8&&p<=4096){ const { perim }=legMetrics();
      const legacy = perim>1e-6
        ? Math.max(MIN_DURATION, Math.min(MAX_DURATION, perim*p/PACE_REF*NOMINAL_SPB))
        : DEFAULT_DURATION;
      S.durMult=Math.max(MULT_MIN, Math.min(MULT_MAX, legacy/baseDuration())); } }
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
