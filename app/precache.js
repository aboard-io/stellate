// precache.js — ROUTE-AWARE SAMPLE PRECACHE. Registers the service worker
// (sw.js: cache-first for the immutable /found/ class), then, whenever the path
// changes, walks the route AHEAD of the traveler, resolves which genres it
// crosses and which sample files those genres actually draw, and warms them with
// low-priority fetches — the SW files each one into the offline cache, so the
// journey keeps sounding through a dead connection and never stalls a decode on
// a slow one.
//
// THE DRAW SET, NOT THE CRATE. A resolved state's foundSources declares the whole
// crate a genre may reach for (~625 files / ~100MB) — warming that is a flood, not
// a warm-up. The set the engine actually demands is the one live.js decodes ahead
// per bar: the srcIds in the schedule's `found` events, union the zone srcIds of
// every scheduled event's voice unit. Measured over all 274 genres: p50 24 files /
// 3.8MB, max 138 / 13.8MB. buildSchedule is the same public mapping press and live
// use, so this can't drift from what gets played.
import { S, K, E } from "./state.js";
import { weightsAt } from "./targeting.js";

export function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  try{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }catch(e){}
}

const SITE=new URL("../",import.meta.url).href;   // site root: found/ paths are relative to it, not to app/
function genreFiles(g){
  // one representative mix per genre (the current seed) scheduled once: its actual draw set
  const urls=new Set();
  let st,sch; try{ st=K.mix([{g,w:1}],{seed:S.seed}); sch=FaustStateEngine.buildSchedule(E,st); }catch(e){ return urls; }
  const ids=new Set();
  for(const f of (sch.found||[])) if(f.srcId) ids.add(f.srcId);
  for(const ev of (sch.events||[])){ const u=sch.units[ev.unit];
    if(u&&u.sampler) for(const z of (u.sampler.zones||[])) if(z.srcId) ids.add(z.srcId); }
  // Resolve through the player's OWN resolver, never s.url: an archive-backed
  // source still carries its archive.org url, but the player no longer fetches
  // that — it maps the url to found/<id>.mp3. Warming s.url would prefetch a
  // cross-origin file the SW cannot cache and the player will never ask for.
  const local=window.FoundPlayer&&FoundPlayer._localPathFor;
  for(const s of (st.foundSources||[])){ if(!s||!ids.has(s.id)) continue;
    const p=s.samplePath||(local&&s.url?local(s.url,null,K.SOURCES):null);
    if(p) urls.add(new URL(p,SITE).href); }
  return urls;
}

const MOBILE=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const RUN_FILES=MOBILE?120:400, RUN_BYTES=MOBILE?4e6:12e6;   // per-run fences (phones get the lighter pair)
const NOMINAL=160e3;   // assumed size when a response carries no content-length — the measured mean
const warmed=new Set();          // urls already fetched this session
const doneG=new Set();           // genres fully walked for the current route key
let warming=false, lastKey="", routeDone=false;

export async function precacheRoute(){
  if(!("serviceWorker" in navigator)||!navigator.serviceWorker.controller) return;   // no SW yet: first load caches by playing
  // NEVER COMPETE WITH THE MUSIC OR THE BOOT ("it loads very slowly now"): the
  // warm waits until the engine is actually PLAYING and a few bars deep (its own
  // decodes done), or the page has sat idle 25s. On a phone link, a boot-time
  // 400-file warm was fighting the shell + the play warm-up.
  const quiet=(S.live&&S.barCount>=3)||(performance.now()>25000&&!S.live);
  if(!quiet){ precacheSoon(); return; }   // re-arm; the debounce keeps this cheap
  const wps=S.waypoints; if(!wps||wps.length<2||warming) return;
  const key=S.seed+"|"+wps.map(w=>Math.round(w.x)+","+Math.round(w.y)).join(";");
  if(key!==lastKey){ lastKey=key; doneG.clear(); routeDone=false; }
  else if(routeDone) return;   // this route is warm; the sub fires on every store write, so stop cheap
  warming=true;
  try{
    // genres along the route: waypoints + 3 midpoints per leg, top-2 weights each.
    // Legs are walked from the traveler's CURRENT segment, so the Set's insertion
    // order is route order ahead of it and a budgeted run warms the near future.
    const genres=new Set();
    const n=wps.length;
    for(let j=0;j<n;j++){
      const a=wps[(S.travel.seg+j)%n], b=wps[(S.travel.seg+j+1)%n];
      for(const t of [0,0.25,0.5,0.75]){
        for(const w of weightsAt({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}).slice(0,2))
          if(w.w>0.15) genres.add(w.g);
      }
    }
    const todo=[...genres].filter(g=>!doneG.has(g));
    if(!todo.length){ routeDone=true; return; }
    // A RESUMABLE CHUNK, NEVER A FLOOD: the old count-only cap was written against
    // a list that was always empty — at the real ~160KB mean, 400 files is ~60MB in
    // one burst. Each run stops on the first fence hit and re-arms, so a long route
    // warms over several passes instead of one transfer spike.
    let nF=0, nB=0, okN=0, gN=0;
    for(const g of todo){
      if(nF>=RUN_FILES||nB>=RUN_BYTES) break;
      await new Promise(r=>setTimeout(r,60));   // yield: buildSchedule is ~17ms and the live scheduler owns this thread
      const list=[...genreFiles(g)].filter(u=>!warmed.has(u));
      let i=0, cut=false;
      const worker=async()=>{ for(;;){ const u=list[i++]; if(!u) return;
        if(nF>=RUN_FILES||nB>=RUN_BYTES){ cut=true; return; }   // untaken: it isn't in `warmed`, so the next run offers it again
        warmed.add(u); nF++;
        try{ const r=await fetch(u,{priority:"low"});
          nB+=Number(r.headers.get("content-length"))||NOMINAL;
          if(r.ok) okN++; else warmed.delete(u);
        }catch(e){ warmed.delete(u); } } };
      await Promise.all([worker(),worker()]);   // 2 in flight
      if(cut) break;                            // half-warmed: leave the genre off doneG so the next run finishes it
      doneG.add(g); gN++;
    }
    const left=genres.size-doneG.size;
    if(okN) console.log("[precache] route warmed: "+okN+" files / "+(nB/1e6).toFixed(1)+"MB across "+gN+" genres ("+left+" left)");
    if(left) precacheSoon(); else routeDone=true;   // fence hit mid-route: continue on the next tick
  }finally{ warming=false; }
}

// debounce: path edits arrive in bursts (drags); warm 2.5s after the last one
let t=0;
export function precacheSoon(){ clearTimeout(t); t=setTimeout(()=>{ precacheRoute(); },2500); }
