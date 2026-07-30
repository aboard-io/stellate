// state.js — the shared store + tiny cross-cutting helpers. Every feature module
// threads state through here (S / set / subs), instead of leaning on accidental
// globals. Also home to the preact/htm render helpers, the K/V/E engine aliases,
// esc/deep micro-helpers, and the URLSearchParams the ?query flags read from.
import { h, render } from "../../vendor/preact/preact.js";
import htm from "../../vendor/htm/htm.js";
export { render };
export const html = htm.bind(h);
export const K=GenreKernel, V=GenreVerifier, E=CsdEngine;
import { MAP_CENTER, BARS_PER_SEG } from "./world.js";

// user master volume persists across sessions (localStorage; 0..1.5, 1 = unity)
const _masterVol=(()=>{ try{ const v=parseFloat(localStorage.getItem("vaporwave-master-vol")); return (v>=0&&v<=1.5)?v:1; }catch(e){ return 1; } })();
const _vapor=(()=>{ try{ const v=parseFloat(localStorage.getItem("vaporwave-vapor")); return (v>=0&&v<=1)?v:0; }catch(e){ return 0; } })();   // VAPOR master-EQ amount (C.1)
// MASTER TOP — the global tone CEILING in Hz (20000 = off). Defaults to 12 kHz rather
// than off: 83% of the catalogue carries no master lowpass of its own (measured), so the
// bleeps in the field recordings and the highest pads have nothing above them at all.
// ?top=<hz> or ?top=off overrides for a session; the ⚙ slider persists a choice.
const _top=(()=>{
  try{
    const q=new URLSearchParams(location.search).get("top");
    if(q==="off") return 20000;
    if(q&&parseFloat(q)>0) return Math.max(1200,Math.min(20000,parseFloat(q)));
    const v=parseFloat(localStorage.getItem("vaporwave-top"));
    return (v>=1200&&v<=20000)?v:12000;
  }catch(e){ return 12000; }
})();
// the chosen soundfont (the switcher); "fluidr3" = the baked default. A shared
// URL's ?sf= wins over localStorage so a link restores its font.
const _soundfont=(()=>{ try{ return new URLSearchParams(location.search).get("sf") || localStorage.getItem("vaporwave-soundfont") || "fluidr3"; }catch(e){ return "fluidr3"; } })();

// ---------- store ----------
export const S={ cursor:{x:MAP_CENTER.x,y:MAP_CENTER.y}, waypoints:[], travel:{seg:0,t:0}, weights:[],
  target:null, playing:null, queue:[], holdUntil:{}, barCount:0, barInfo:null, live:false, masterVol:_masterVol, vapor:_vapor, top:_top, soundfont:_soundfont, fontPinned:false,
  seed:Math.floor(Math.random()*99999)+1, modeLock:"auto", pace:BARS_PER_SEG, durMult:1, more:false, load:1, eco:0, scores:[], best:"…", status:"ready — drag, dbl-click a path, then ▶ LIVE",
  pool:"", beatLine:"▶ press LIVE",
  // THE EXCLUSIVE VIEWS: star map / viz (+ the 3D star-cruise).
  // vizView=true shows the full-screen viz (map off; background suppressed via
  // background.js applyBg); else the map.
  vizView:false,
  // ±BPM DELTA: a global offset on whatever plays, re-applied
  // to every retarget target so it survives travel until dialed back to 0.
  bpmDelta:0 };
// (There are no MACRO axes. The kernel's applyMacros machinery survives unused;
// absent macros resolve byte-identically, so nothing musical rides on it.)
export const subs=[];
window.__S=S;   // debug/probe access (headless verification) — and the app side of the ONE sanctioned reach-through: app/starcruise.js reads the store off this global instead of importing this module (app/starcruise-load.js documents the seam)
let _raf=0;
export function set(patch){ Object.assign(S,patch);
  if(_raf)return; _raf=requestAnimationFrame(()=>{ _raf=0; subs.forEach(f=>f()); }); }
export const deep=o=>JSON.parse(JSON.stringify(o));

// the chyron: an MTV lower-third instead of a debug dump (namebank.js invents the
// band). esc lives here because both the inside-the-sound viz and the chyron
// readout escape user-facing strings into innerHTML.
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// every ?query flag reads from this one URLSearchParams (parsed once at load).
export const QSFLAGS=new URLSearchParams(location.search);
