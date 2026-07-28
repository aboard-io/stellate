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
//
// A HORIZON, NOT A ROUTE. Warming the whole path meant a 40-waypoint journey
// downloaded its entire crate before the listener had heard the second genre —
// tens of MB spent on music they may never reach, and on a metered connection
// that is somebody's data. The warm now covers HORIZON_MIN minutes of PLAY ahead
// of the traveler and no further: the distance is derived from the pace
// (paceSpeed is distance-per-bar) and the current bar duration, so it tracks the
// tempo and the path length instead of assuming either. The horizon MOVES with
// the traveler, so a long journey still arrives warm — it just pays for the next
// ten minutes rather than for all of it up front.
import { S, K, E } from "../core/state.js";
import { weightsAt } from "./targeting.js";
import { legMetrics, paceSpeed } from "../core/share.js";

export function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  try{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }catch(e){}
}

const SITE=new URL("../../",import.meta.url).href;   // site root: found/ paths are relative to it, not to app/audio/ (two levels up from this module)
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
const RUN_FILES=MOBILE?60:160, RUN_BYTES=MOBILE?2e6:6e6;   // per-run fences (phones get the lighter pair)
const HORIZON_MIN=10;        // minutes of PLAY kept warm ahead of the traveler
// How far along the path ten minutes of music reaches. paceSpeed() is distance
// per BAR, so this needs the bar's duration: beats x 60 / bpm, read off the
// state that is actually sounding (meter-aware — a 3/4 bar is shorter than a
// 4/4 one at the same tempo). The fallbacks are the defaults buildEvents uses
// when a state carries neither, so a pre-play warm still gets a sane horizon.
function horizonDist(){
  const st=S.playing||{};
  const bpm=Math.max(20, st.bpm||120);
  const beats=(st.meter&&st.meter.beats)||4;
  const bars=(HORIZON_MIN*60)/Math.max(0.1, beats*60/bpm);
  return bars*paceSpeed();
}
const NOMINAL=160e3;   // assumed size when a response carries no content-length — the measured mean
const warmed=new Set();          // urls already fetched this session
const doneG=new Set();           // genres fully walked for the current route key
let warming=false, lastKey="", lastSeg=-1, routeDone=false;

export async function precacheRoute(){
  if(!("serviceWorker" in navigator)||!navigator.serviceWorker.controller) return;   // no SW yet: first load caches by playing
  // NEVER COMPETE WITH THE MUSIC OR THE BOOT ("it loads very slowly now"): the
  // warm waits until the engine is actually PLAYING and a few bars deep (its own
  // decodes done), or the page has sat idle 25s. On a phone link, a boot-time
  // 400-file warm was fighting the shell + the play warm-up.
  const quiet=(S.live&&S.barCount>=3)||(performance.now()>25000&&!S.live);
  if(!quiet){ precacheSoon(); return; }   // re-arm; the debounce keeps this cheap
  const wps=S.waypoints; if(!wps||wps.length<2||warming) return;
  // TWO keys, because the horizon moves. The PATH key (seed + waypoints) invalidates
  // what has been walked — a redrawn path is a different journey. The SEGMENT key
  // only un-latches `routeDone`, so when the traveler crosses into a new leg the
  // next ten minutes get warmed without re-walking the genres already done (their
  // files are in `warmed`, so re-walking would cost a buildSchedule per genre for
  // an empty fetch list).
  const key=S.seed+"|"+wps.map(w=>Math.round(w.x)+","+Math.round(w.y)).join(";");
  if(key!==lastKey){ lastKey=key; doneG.clear(); routeDone=false; }
  const seg=((S.travel.seg%wps.length)+wps.length)%wps.length;
  if(seg!==lastSeg){ lastSeg=seg; routeDone=false; }
  if(routeDone) return;   // horizon is warm; the sub fires on every store write, so stop cheap
  warming=true;
  try{
    // genres within the HORIZON: walk forward from the traveler's exact position
    // (seg + t, not the segment start) sampling every SAMPLE_STEP of distance, and
    // stop once ten minutes of play is covered. Sampling by DISTANCE rather than by
    // a fixed count per leg means a long leg is sampled more than a short one, so a
    // genre cannot be missed just because it sits in the middle of a long crossing.
    const genres=new Set();
    const n=wps.length;
    const { legs }=legMetrics();
    const budget=horizonDist();
    const SAMPLE_STEP=Math.max(1e-3, budget/24);   // 24 probes across the horizon
    let seg=((S.travel.seg%n)+n)%n, along=(S.travel.t||0)*(legs[seg]||0), spent=0;
    for(let guard=0; spent<=budget && guard<4096; guard++){
      const a=wps[seg], b=wps[(seg+1)%n], L=legs[seg]||0;
      const f=L>1e-6?Math.min(1,along/L):0;
      for(const w of weightsAt({x:a.x+(b.x-a.x)*f, y:a.y+(b.y-a.y)*f}).slice(0,2))
        if(w.w>0.15) genres.add(w.g);
      along+=SAMPLE_STEP; spent+=SAMPLE_STEP;
      while(along>=(legs[seg]||0)){ along-=(legs[seg]||0); seg=(seg+1)%n;
        if(!legs[seg]&&legs.every(l=>!l)) { guard=4096; break; } }   // degenerate zero-length path
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
    if(okN) console.log("[precache] "+HORIZON_MIN+"min horizon warmed: "+okN+" files / "+(nB/1e6).toFixed(1)+"MB across "+gN+" genres ("+left+" left)");
    if(left) precacheSoon(); else routeDone=true;   // fence hit mid-route: continue on the next tick
  }finally{ warming=false; }
}

// debounce: path edits arrive in bursts (drags); warm 2.5s after the last one
let t=0;
export function precacheSoon(){ clearTimeout(t); t=setTimeout(()=>{ precacheRoute(); },2500); }
