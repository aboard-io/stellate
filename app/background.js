// background.js — the background layer program: the genre-affine laserdisc video
// (clip pool follows the mix, no-repeat shuffle bag) and the ▢→▣→▦ chip that
// cycles off → video+demos → demoscene. Mode 1 alternates video ↔ a fresh
// MicroW8 demo cart every 8 bars (musical clock) with a wall-clock backstop.
import { S, set, K, subs, QSFLAGS } from "./state.js";

// ---------- genre-affine video: the background footage follows the mix ----------
// pool = union of the current weights' clip pools (dominant genre first).
// Clip advance is driven by the BAR CLOCK: a new clip every 8 measures (the new
// direction — clips stream from archive.org and want room to breathe). A section
// change forces an off-cycle switch ONLY when the genre POOL changed (travel to
// a new genre), not on every section boundary. The effect stack eases to the
// dominant genre. Draws come from a SHUFFLED BAG (no repeats until drained).
// Math.random is deliberate: the determinism law guards rendered audio/video
// artifacts (press/journey), NOT this live presentational layer — so every
// play session shows a different clip order. goLive() resets the bag per session.
const BARS_PER_CLIP=8;
let vidGenre="", vidBars=0, vidPending=null, vidStarted=false;
// the no-repeat shuffle bag is VideoLayer's shared mechanism (same shuffle +
// draw-with-refill + avoid-current as its idle cycler) — created lazily once the
// layer is loaded, fed the genre-affine pool per 8-bar advance.
let vidBag=null;
const vidBagObj=()=>(vidBag||(window.VideoLayer&&VideoLayer.makeBag&&(vidBag=VideoLayer.makeBag())));
export function vidReset(){ vidGenre=""; vidBars=0; vidPending=null; vidStarted=false; vidAllShuffled=null; const b=vidBagObj(); if(b)b.reset(); }
// clip pool: the union of clips from genres carrying real weight (trivial
// neighbors dropped), sorted for a STABLE bag key so a mere weight-reorder as
// the cursor drifts doesn't thrash the bag. Selection is shuffled anyway.
// session-stable shuffled copy of the WHOLE catalog — the variety top-up source.
// Stable within a play session so vidPool stays deterministic per genre (the
// no-repeat bag keys off pool identity); reshuffled per session in vidReset.
let vidAllShuffled=null;
function vidAllPool(){
  if(vidAllShuffled) return vidAllShuffled;
  const all=(window.VideoLayer&&VideoLayer.allNames)?VideoLayer.allNames().slice():[];
  for(let i=all.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;const t=all[i];all[i]=all[j];all[j]=t;}
  vidAllShuffled=all; return all;
}
function vidPool(ordered){
  const pool=[];
  // union of BOTH clip sources per weighted genre: the kernel's GENRE_CLIPS
  // (legacy/local names) and the stream catalog's own tags (the sourced
  // avant-garde/3D windows live ONLY there — without this they were loaded,
  // indexed, and unreachable; found 2026-07-06 when Paul saw nothing new).
  const per=(g)=>[...(K.GENRE_CLIPS[g]||[]),
                  ...((window.VideoLayer&&VideoLayer.namesForTag)?VideoLayer.namesForTag(g):[])];
  ordered.forEach(w=>{ if(w.w>=0.06) per(w.g).forEach(c=>{if(!pool.includes(c))pool.push(c);}); });
  if(!pool.length) ordered.forEach(w=>per(w.g).forEach(c=>{if(!pool.includes(c))pool.push(c);}));
  // VARIETY (2026-07-07): a per-genre affine pool is only ~8-12 clips, so the
  // no-repeat bag recycled the same handful every 8 bars while ~220 cached clips
  // were never seen ("they play over and over"). Top up from the full 231-clip
  // catalog to a minimum so clips actually vary — genre-affine clips stay in
  // (preferred), the genre LOOK is carried by setGenre's grade, not the clip set.
  const MIN=48, all=vidAllPool();
  for(const c of all){ if(pool.length>=MIN) break; if(pool.indexOf(c)<0) pool.push(c); }
  return pool.sort();
}
function vidDraw(pool){ const b=vidBagObj(); return b?b.draw(pool):null; }
window.__vidTest={ pool:()=>vidPool(S.weights.slice().sort((a,b)=>b.w-a.w)), draw:(p)=>vidDraw(p) };   // headless variety check
export function genreVideo(info){
  if(!(window.VideoLayer&&VideoLayer.enabled()))return;
  const ordered=S.weights.slice().sort((a,b)=>b.w-a.w);
  const dom=(ordered[0]||{}).g||"";
  // TRAVEL = the DOMINANT genre changed (order-insensitive; the drifting cursor
  // no longer forces a switch every bar). It eases the effect stack AND forces
  // an off-cycle clip switch; otherwise clips advance once per 8 measures.
  const traveled=dom!==vidGenre;
  if(traveled){ vidGenre=dom; VideoLayer.setGenre&&VideoLayer.setGenre(dom); }
  const pool=vidPool(ordered);
  if(!pool.length)return;
  vidBars++;
  const boundary = !vidStarted || traveled || vidBars>=BARS_PER_CLIP;
  if(!boundary){
    // keep the next clip buffering on the back element during this window so the
    // remote stream is ready to crossfade at the boundary (never onto black)
    if(vidPending==null){ vidPending=vidDraw(pool); if(vidPending!=null&&VideoLayer.prefetch) VideoLayer.prefetch(vidPending+".mp4"); }
    return;
  }
  if(traveled) vidPending=null;   // a prefetch drawn from the old genre's pool is stale
  const first=!vidStarted;
  const showNow = vidPending!=null?vidPending:vidDraw(pool);
  vidPending=null; vidStarted=true; vidBars=0;
  if(showNow!=null){ console.log("[vid] switch bar",info.serial,"->",showNow,first?"(first)":traveled?"(travel)":"(8-bar)"); VideoLayer.showFile(showNow+".mp4"); }
  // draw + prefetch the FOLLOWING clip so it buffers through the next 8 measures
  vidPending=vidDraw(pool);
  if(vidPending!=null&&VideoLayer.prefetch) VideoLayer.prefetch(vidPending+".mp4");
}

// ---------- background chip: off → video+demos → demoscene ----------
// BACKGROUND — one chip cycles off → video → demoscene (Paul: "combine the video
// and demoscene options into one thing"). Each mode enables its layer + disables the
// other; unavailable layers are skipped in the cycle. Default off. While in demoscene
// mode, a double-tap advances to the next cart.
const bgChip=document.getElementById("bgChip");
let bgMode=0;   // 0 off · 1 video (ALTERNATES with demos while live) · 2 demoscene only
const BG_GLYPH=["▢","▣","▦"], BG_LABEL=["off","video+demos","demoscene"];
// Mode 1 is a PROGRAM, not a single layer (Paul: "alternate between different
// MicroW8 demos and cached video every eight bars when video is on"): while LIVE
// it cuts video ↔ a fresh demo cart every BG_ALT_BARS chord-bars; idle = ambient
// video. Mode 2 stays demos-only. bgWant() is the single source of desired layer
// states so applyBg (which runs every render) can't fight the alternator.
const BG_ALT_BARS=8;
const BG_ALT_MS=+(QSFLAGS.get("bgAltMs"))||16000;   // idle wall-clock backstop period (test override)
const bgAlt={side:"video", bars:0, lastFlip:0};
function bgWant(){
  // mode 1 = the alternating program: honour the current side whether LIVE or IDLE
  // (idle used to force video, which silently defeated the wall-clock alternation).
  if(bgMode===1) return { v: bgAlt.side==="video", d: bgAlt.side==="demo" };
  return { v:false, d:bgMode===2 };
}
function applyBg(){
  const V=window.VideoLayer, D=window.DemoLayer, w=bgWant();
  if(V&&V.enabled()!==w.v){ V.setEnabled(w.v); if(!w.v&&bgMode!==1) vidReset(); }   // keep the clip bag during alternation
  if(D&&D.enabled()!==w.d) D.setEnabled(w.d);
  bgChip.textContent=BG_GLYPH[bgMode]; bgChip.classList.toggle("live",bgMode!==0);
}
// FLIP the background side: video <-> demo (fresh cart each demo turn), announce it.
function bgFlip(){
  if(bgMode!==1) return;
  bgAlt.bars=0; bgAlt.lastFlip=Date.now(); bgAlt.side=bgAlt.side==="video"?"demo":"video";
  if(bgAlt.side==="demo"&&window.DemoLayer&&DemoLayer.next) DemoLayer.next();   // a DIFFERENT cart each demo turn
  applyBg();
  set({status: bgAlt.side==="video" ? "background → video" :
    ("background → demo: "+(window.DemoLayer&&DemoLayer.currentName?DemoLayer.currentName():"microw8"))});
}
// MUSICAL driver: flip every BG_ALT_BARS bars while LIVE (called from onBar).
export function bgBarTick(){
  if(bgMode!==1||!S.live) return;
  if(++bgAlt.bars>=BG_ALT_BARS) bgFlip();
}
// RELIABILITY driver: a wall-clock backstop so "video on" ALWAYS visibly cycles —
// covers idle (not playing) and any route where onBar is sparse. ~16s ≈ 8 bars at a
// typical tempo; when live, onBar usually flips first (resetting the timer via bars=0),
// so this only fires if the musical clock has stalled or we're idle.
let bgAltTimer=0;
function bgAltClock(){
  if(bgMode===1 && (Date.now()-bgAlt.lastFlip)>=BG_ALT_MS) { bgFlip(); }
}
function startBgAltClock(){ if(!bgAltTimer) bgAltTimer=setInterval(()=>{ if(bgMode===1) bgAltClock(); },1000); }
window.__BGALT={ state:()=>({mode:bgMode,side:bgAlt.side,bars:bgAlt.bars}), tick:bgBarTick, flip:bgFlip };   // headless gate hook
bgChip.onclick=()=>{
  const V=window.VideoLayer, D=window.DemoLayer;
  for(let i=0;i<3;i++){ bgMode=(bgMode+1)%3;                       // advance to the next AVAILABLE mode
    if(bgMode===0) break;
    if(bgMode===1 && V && V.available()) break;
    if(bgMode===2 && D && D.available()) break;
  }
  bgAlt.side="video"; bgAlt.bars=0; bgAlt.lastFlip=Date.now();     // a fresh program starts on footage
  applyBg(); startBgAltClock(); set({status:"background: "+BG_LABEL[bgMode]});
};
bgChip.ondblclick=()=>{ if(bgMode!==0 && window.DemoLayer&&DemoLayer.next){ DemoLayer.next(); set({status:"demo: "+(DemoLayer.currentName?DemoLayer.currentName():"next")}); } };
subs.push(applyBg); applyBg(); startBgAltClock();
