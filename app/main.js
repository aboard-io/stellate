// main.js — the app entry. Loaded by index.html as <script type="module">, it
// runs AFTER the classic engine scripts (window.CsdEngine / GenreKernel /
// FaustStateEngine / FaustLive / DemoLayer / NameBank) and the DOM
// are ready. Importing the feature modules wires their event listeners, store
// subs and window.__ debug hooks; this file assembles window.__X and runs the
// one-shot boot sequence (layout → default loop → centre → first score → tickers).
import { POS, MAP_CENTER, WORLD_W, WORLD_H, MIN_SEP } from "./core/world.js";
import { S, K, set, subs } from "./core/state.js";
import { retarget, weightsAt, travelStep, rescore, forceRetarget } from "./audio/targeting.js";
import { clampZoom, zoomAround, seedDefaultLoop, insertWaypoint, computeGenreLayout, computeRegions, centerView } from "./map/starmap.js";
import { renderInside } from "./panels/inside.js";
import { goLive, stopLive, faustHandle } from "./audio/live.js";
import { initGlyphMap } from "./map/glyphs.js";   // floating alien-ident glyphs backfloating on the star map
import { playheadTick } from "./panels/readouts.js";
import "./panels/background.js";   // side effects: demoscene chip + cart rotation + subs.push(applyBg)
import "./panels/panels.js";       // side effects: control panel + chips/modals + store render subs
import { applyUrlState, buildShareUrl, paceSpeed, loopBars } from "./core/share.js";   // the bookmarkable mix (seed+path+measure in the query string) + constant-pace travel
import { loadFonts } from "./audio/fonts.js";   // the soundfont switcher: register + apply the saved font
import { registerSW, precacheSoon } from "./audio/precache.js";    // offline-where-possible + route-ahead sample warming

window.__X={retarget:(...a)=>retarget(...a), goLive:(...a)=>goLive(...a), stopLive:(...a)=>stopLive(...a), weightsAt:(...a)=>weightsAt(...a),
  handle:()=>faustHandle,   // live handle (audit ring / probe access) — headless gates
  renderInside:()=>{ try{ renderInside(); }catch(e){} },
  clampZoom:()=>clampZoom(), zoomAround:(...a)=>zoomAround(...a), POS,
  // loop/spread introspection for the headless UI gate (additive):
  seedLoop:()=>seedDefaultLoop(), mapCenter:()=>({...MAP_CENTER}), world:()=>({w:WORLD_W,h:WORLD_H}),
  minPairDist:()=>MIN_SEP, pathClosed:()=>S.waypoints.length>=2,   // live binding: recomputeWorld rewrites it after the layout relaxes
  travelStep:()=>travelStep(), insertWaypoint:(...a)=>insertWaypoint(...a),
  paceSpeed:()=>paceSpeed(), loopBars:()=>loopBars(),   // constant-pace travel probes (units/bar, bars/loop)
  shareUrl:()=>buildShareUrl()};   // headless stop→path→LIVE + corner-reach probe + loop-wrap probe + mid-chain insert + the bookmarkable-URL probe

// BOOTED — has the one-shot boot below run? entries/embed.js layers its own
// framing on top of this app and must not apply it before the layout, the
// default loop and the first score exist. A real export, not a window sniff.
export let booted=false;

// ---------- boot ----------
function boot(){
  // URL FIRST: a shared link restores seed/path/pace/mode/measure before the
  // default loop would overwrite them; a restored path skips seedDefaultLoop.
  const fromUrl=applyUrlState();
  const urlBar=S.startBar||0;   // seedDefaultLoop clears startBar (fresh-loop law) — the URL's m survives boot
  computeGenreLayout(); computeRegions(); if(!fromUrl) seedDefaultLoop(); centerView();
  loadFonts();   // register + apply the saved soundfont (async; default plays until an alt font's zones land)
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
  fetch("engine/faust/data/dx7-presets.json").then(r=>r.json()).then(raw=>{
    for(const [name,p] of Object.entries(raw||{}))
      if(p&&p.params) K.DX7_PATCHES[name]={algorithm:p.alg, params:p.params};
    forceRetarget();
  }).catch(()=>{});
  initGlyphMap();   // the floating glyph layer drifts behind the map for the whole session (ambient, seizure-safe)
  if(window.DemoLayer)DemoLayer.init().then(()=>set({}));     // MicroW8 demoscene background (off until toggled)
  registerSW(); precacheSoon();   // offline-where-possible: the SW caches by class; warm the route's samples ahead of the traveler
  // re-warm on path/seed changes (the sub fires on every store write; precacheSoon
  // debounces + keys on (seed, waypoints) so it only actually walks on a change)
  subs.push(()=>precacheSoon());
  booted=true;
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

// SPACEBAR TRANSPORT: space toggles play/stop (same as the ▶ playChip). Global, but
// yields to text/interactive targets (so it never eats a keypress in a field or a
// button's own activation), to an OPEN settings/about dialog, and to the 3D star-
// cruise (where space is the thrust-up flight control). preventDefault stops the
// page from scrolling on the tap.
addEventListener("keydown",e=>{
  if(e.code!=="Space" && e.key!==" ") return;
  if(e.repeat) return;                                  // hold = one toggle, not a strobe
  const t=e.target;
  if(t){
    const tag=(t.tagName||"").toLowerCase();
    if(tag==="input"||tag==="select"||tag==="textarea"||tag==="button"||t.isContentEditable) return;
  }
  // a true dialog is open (settings ⚙ / about ?) — let space belong to it, not transport.
  const panel=document.getElementById("panelWrap"), about=document.getElementById("aboutWrap");
  if((panel&&panel.classList.contains("open"))||(about&&about.classList.contains("open"))) return;
  // the 3D cruise owns space (thrust up) — its own handler runs; don't double-fire transport.
  if(document.body.classList.contains("view-starcruise")) return;
  e.preventDefault();
  S.live?stopLive():goLive();
});
