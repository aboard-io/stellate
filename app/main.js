// main.js — the app entry. Loaded by index.html as <script type="module">, it
// runs AFTER the classic engine scripts (window.CsdEngine / GenreKernel /
// FaustStateEngine / FaustLive / VideoLayer / DemoLayer / NameBank) and the DOM
// are ready. Importing the feature modules wires their event listeners, store
// subs and window.__ debug hooks; this file assembles window.__X and runs the
// one-shot boot sequence (layout → default loop → centre → first score → tickers).
import { POS, MAP_CENTER, WORLD_W, WORLD_H } from "./world.js";
import { S, K, set } from "./state.js";
import { retarget, weightsAt, travelStep, rescore, forceRetarget } from "./targeting.js";
import { clampZoom, zoomAround, seedDefaultLoop, insertWaypoint, computeGenreLayout, centerView } from "./starmap.js";
import { renderInside } from "./inside.js";
import { goLive, stopLive, faustHandle } from "./live.js";
import { playheadTick } from "./readouts.js";
import "./background.js";   // side effects: video/demoscene chip + alternation + subs.push(applyBg)
import "./panels.js";       // side effects: control panel + chips/modals + store render subs
import { applyUrlState, buildShareUrl } from "./share.js";   // the bookmarkable mix (seed+path+measure in the query string)

window.__X={retarget:(...a)=>retarget(...a), goLive:(...a)=>goLive(...a), stopLive:(...a)=>stopLive(...a), weightsAt:(...a)=>weightsAt(...a),
  handle:()=>faustHandle,   // live handle (audit ring / probe access) — headless gates
  renderInside:()=>{ try{ renderInside(); }catch(e){} },
  clampZoom:()=>clampZoom(), zoomAround:(...a)=>zoomAround(...a), POS,
  // loop/spread introspection for the headless UI gate (additive):
  seedLoop:()=>seedDefaultLoop(), mapCenter:()=>({...MAP_CENTER}), world:()=>({w:WORLD_W,h:WORLD_H}),
  minPairDist:()=>window.__MINSEP, pathClosed:()=>S.waypoints.length>=2,
  travelStep:()=>travelStep(), insertWaypoint:(...a)=>insertWaypoint(...a),
  shareUrl:()=>buildShareUrl()};   // headless stop→path→LIVE + corner-reach probe + loop-wrap probe + mid-chain insert + the bookmarkable-URL probe

// ---------- boot ----------
function boot(){
  // URL FIRST: a shared link restores seed/path/pace/mode/measure before the
  // default loop would overwrite them; a restored path skips seedDefaultLoop.
  const fromUrl=applyUrlState();
  const urlBar=S.startBar||0;   // seedDefaultLoop clears startBar (fresh-loop law) — the URL's m survives boot
  computeGenreLayout(); if(!fromUrl) seedDefaultLoop(); centerView();
  S.startBar=urlBar;
  if(fromUrl && S.waypoints.length>=2){
    // place the traveler (and the mix) at the URL's measure along the path
    const n=S.waypoints.length, a=S.waypoints[S.travel.seg], b=S.waypoints[(S.travel.seg+1)%n];
    retarget({x:a.x+(b.x-a.x)*S.travel.t, y:a.y+(b.y-a.y)*S.travel.t});
  }
  rescore(); playheadTick();
  // the kernel's DX7 patch registry is empty in the browser unless the page
  // supplies the bank (genre-kernel snapshots window.DX7_PRESETS at load, which
  // no page sets) — so no explorer journey ever drew a dx7 voice. Populate the
  // exported registry in place and re-resolve the current target.
  fetch("engine/faust/dx7-presets.json").then(r=>r.json()).then(raw=>{
    for(const [name,p] of Object.entries(raw||{}))
      if(p&&p.params) K.DX7_PATCHES[name]={algorithm:p.alg, params:p.params};
    forceRetarget();
  }).catch(()=>{});
  if(window.VideoLayer)VideoLayer.init().then(()=>set({}));   // found-video background (genre-affine, follows the mix)
  if(window.DemoLayer)DemoLayer.init().then(()=>set({}));     // MicroW8 demoscene background (off until toggled)
}
// GATE BOOT ON THE STYLESHEET: computeGenreLayout measures the live viewport via
// svg.getBoundingClientRect() and relaxes the genre positions against it. When
// the CSS lived inline in <head> it applied synchronously before the script ran;
// now app/app.css is an external <link> that may NOT be applied when this module
// first executes, so #map can report the UA-default 300x150 and the layout blows
// up. Wait for the stylesheet to load (its .sheet becomes non-null) before boot,
// so the map is sized like it was pre-split. Falls back to boot() immediately if
// there's no link or it's already applied.
const cssLink=document.querySelector('link[rel="stylesheet"][href*="app.css"]');
if(cssLink && !cssLink.sheet) cssLink.addEventListener("load", boot, {once:true});
else boot();
