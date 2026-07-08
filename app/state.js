// state.js — the shared store + tiny cross-cutting helpers. Every feature module
// threads state through here (S / set / subs), instead of leaning on accidental
// globals. Also home to the preact/htm render helpers, the K/V/E engine aliases,
// esc/deep micro-helpers, and the URLSearchParams the ?query flags read from.
import { h, render } from "https://esm.sh/preact@10.19.3";
import htm from "https://esm.sh/htm@3.1.1";
export { render };
export const html = htm.bind(h);
export const K=GenreKernel, V=GenreVerifier, E=CsdEngine;
import { MAP_CENTER, BARS_PER_SEG } from "./world.js";

// ---------- store ----------
export const S={ cursor:{x:MAP_CENTER.x,y:MAP_CENTER.y}, waypoints:[], travel:{seg:0,t:0}, weights:[],
  target:null, playing:null, queue:[], holdUntil:{}, barCount:0, barInfo:null, live:false,
  seed:Math.floor(Math.random()*99999)+1, modeLock:"auto", pace:BARS_PER_SEG, more:false, load:1, eco:0, scores:[], best:"…", status:"ready — drag, dbl-click a path, then ▶ LIVE",
  pool:"", beatLine:"▶ press LIVE",
  // MACRO axes: eight global sliders in [-1,+1], 0 = neutral. Threaded into
  // every K.mix() as opts.macros (the keyOffset altitude — a post-resolution
  // transform); absent/all-zero = byte-identical to the un-macroed space.
  macros:{acoustic:0,density:0,dust:0,space:0,bright:0,feel:0,energy:0,vocal:0} };
export const macrosOn=m=>Object.values(m||{}).some(v=>v);
export const subs=[];
window.__S=S;   // debug/probe access (headless verification)
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
