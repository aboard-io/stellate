// precache.js — ROUTE-AWARE SAMPLE PRECACHE (Paul 2026-07-10: "precache samples
// for instruments along a route"). Registers the service worker (sw.js:
// cache-first for the immutable /found/ class), then, whenever the path
// changes, walks the route AHEAD of the traveler, resolves which genres it
// crosses and which sample files those genres' instruments actually draw, and
// warms them with low-priority fetches — the SW files each one into the
// offline cache, so the journey keeps sounding through a dead connection and
// never stalls a decode on a slow one.
//
// Resolution mirrors the engine's own: K.mix at sampled points along each leg
// -> the state's foundSources (local found/ urls) + every voice's sampler id
// -> K.SAMPLERS[id].dir/zones (found/samples/instruments|drums files). Capped
// per run and throttled (2 in flight) — a warm-up, never a flood.
import { S, K } from "./state.js";
import { weightsAt } from "./targeting.js";

export function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  try{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }catch(e){}
}

const SAMPLE_ROOT="found/samples/";
function genreFiles(g){
  // one representative mix per genre (the current seed): its actual draw set
  const urls=new Set();
  let st; try{ st=K.mix([{g,w:1}],{seed:S.seed}); }catch(e){ return urls; }
  for(const s of (st.foundSources||[])){
    if(s&&s.url&&/^found\//.test(s.url)) urls.add(s.url);
    else if(s&&s.file) urls.add(SAMPLE_ROOT+s.file);
  }
  const addSampler=(sp)=>{ if(!sp||!sp.id) return;
    const S2=K.SAMPLERS&&K.SAMPLERS[sp.id]; if(!S2||!S2.dir) return;
    const base=SAMPLE_ROOT+(S2.kit?"drums/":"instruments/")+S2.dir+"/";
    for(const z of (S2.zones||[])) if(z.file) urls.add(base+z.file);
  };
  const I=st.instruments||{};
  for(const vk of ["pad","bass","melody"]) addSampler(I[vk]&&I[vk].sampler);
  const D=I.drums||{};
  for(const k of Object.keys(D)) if(/Sampler$/.test(k)) addSampler(D[k]);
  return urls;
}

let warming=false, lastKey="";
export async function precacheRoute(){
  if(!("serviceWorker" in navigator)||!navigator.serviceWorker.controller) return;   // no SW yet: first load caches by playing
  const wps=S.waypoints; if(!wps||wps.length<2) return;
  const key=S.seed+"|"+wps.map(w=>Math.round(w.x)+","+Math.round(w.y)).join(";");
  if(key===lastKey||warming) return;
  lastKey=key; warming=true;
  try{
    // genres along the route: waypoints + 3 midpoints per leg, top-2 weights each
    const genres=new Set();
    const n=wps.length;
    for(let i=0;i<n;i++){
      const a=wps[i], b=wps[(i+1)%n];
      for(const t of [0,0.25,0.5,0.75]){
        for(const w of weightsAt({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}).slice(0,2))
          if(w.w>0.15) genres.add(w.g);
      }
    }
    const urls=new Set();
    for(const g of genres) for(const u of genreFiles(g)) urls.add(u);
    const list=[...urls].slice(0,400);                         // cap per run — a warm-up, not a flood
    let i=0, okN=0;
    const worker=async()=>{ for(;;){ const u=list[i++]; if(!u) return;
      try{ const r=await fetch(u,{priority:"low"}); if(r.ok) okN++; }catch(e){} } };
    await Promise.all([worker(),worker()]);                    // 2 in flight
    if(okN) console.log("[precache] route warmed: "+okN+"/"+list.length+" files across "+genres.size+" genres");
  }finally{ warming=false; }
}

// debounce: path edits arrive in bursts (drags); warm 2.5s after the last one
let t=0;
export function precacheSoon(){ clearTimeout(t); t=setTimeout(()=>{ precacheRoute(); },2500); }
