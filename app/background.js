// background.js — the background layer program: the genre-affine laserdisc video
// (clip pool follows the mix, no-repeat shuffle bag) and the ▢→▣→▦ chip that
// cycles off → video+demos → demoscene. Mode 1 alternates video ↔ a fresh
// MicroW8 demo cart every 8 MEASURES, cut on the beat by the musical clock
// (onBar), with a wall-clock backstop that only runs when the music isn't.
import { S, set, K, subs, QSFLAGS } from "./state.js";

// ---------- genre-affine video: the background footage follows the mix ----------
// pool = union of the current weights' clip pools (dominant genre first).
// Clip advance is driven by the MUSICAL CLOCK: a new clip every 8 MEASURES,
// switched on a chord-bar boundary (= on the beat). onBar fires per CHORD-BAR
// (info.cbeats beats each, default 8 = two 4/4 measures), so we accumulate
// BEATS, not bar ticks — 8 chord-bars used to mean 16 measures. A section
// change forces an off-cycle switch ONLY when the genre POOL changed (travel to
// a new genre), not on every section boundary. The effect stack eases to the
// dominant genre. Draws come from a SHUFFLED BAG (no repeats until drained).
// Math.random is deliberate: the determinism law guards rendered audio/video
// artifacts (press/journey), NOT this live presentational layer — so every
// play session shows a different clip order. goLive() resets the bag per session.
const BEATS_PER_MEASURE=4, MEASURES_PER_CLIP=8;
const CLIP_BEATS=BEATS_PER_MEASURE*MEASURES_PER_CLIP;   // 32 beats = 8 measures of 4/4
let vidGenre="", vidBeats=0, vidPending=null, vidStarted=false;
// force the NEXT onBar to advance the clip (still beat-aligned): the alternator
// calls this when the program flips back to the video side so footage returns fresh.
export function vidNextClip(){ vidBeats=1e9; }
// the no-repeat shuffle bag is VideoLayer's shared mechanism (same shuffle +
// draw-with-refill + avoid-current as its idle cycler) — created lazily once the
// layer is loaded, fed the genre-affine pool per 8-bar advance.
let vidBag=null;
const vidBagObj=()=>(vidBag||(window.VideoLayer&&VideoLayer.makeBag&&(vidBag=VideoLayer.makeBag())));
export function vidReset(){ vidGenre=""; vidBeats=0; vidPending=null; vidStarted=false; vidAllShuffled=null; const b=vidBagObj(); if(b)b.reset(); }
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
  vidBeats+=(info&&info.cbeats)||8;
  const boundary = !vidStarted || traveled || vidBeats>=CLIP_BEATS;
  if(!boundary){
    // keep the next clip buffering on the back element during this window so the
    // remote stream is ready to crossfade at the boundary (never onto black)
    if(vidPending==null){ vidPending=vidDraw(pool); if(vidPending!=null&&VideoLayer.prefetch) VideoLayer.prefetch(vidPending+".mp4"); }
    return;
  }
  if(traveled) vidPending=null;   // a prefetch drawn from the old genre's pool is stale
  const first=!vidStarted;
  const showNow = vidPending!=null?vidPending:vidDraw(pool);
  vidPending=null; vidStarted=true; vidBeats=0;
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
// bgMode is the ONE persisted background preference (the layers no longer remember
// their own on/off — their localStorage self-restore used to re-enable them at init
// behind the mode program's back, stacking video + demos). Restored per load,
// applied by applyBg once the layers come up (setEnabled pre-ready is recorded and
// materialized by each layer's init).
const BG_LS="vaporwave-bg-mode";
let bgMode=0;   // 0 off · 1 video (ALTERNATES with demos while live) · 2 demoscene only
try{ const m=parseInt(localStorage.getItem(BG_LS)||"0",10); if(m===1||m===2) bgMode=m; }catch(e){}
const bgSave=()=>{ try{ localStorage.setItem(BG_LS,String(bgMode)); }catch(e){} };
const BG_GLYPH=["▢","▣","▦"], BG_LABEL=["off","video+demos","demoscene"];
// Mode 1 is a PROGRAM, not a single layer (Paul: "alternate between different
// MicroW8 demos and cached video every eight bars when video is on"): while LIVE
// it cuts video ↔ a fresh demo cart every 8 MEASURES, flipped inside onBar so the
// cut lands ON THE BEAT (a chord-bar boundary). onBar ticks per chord-bar
// (info.cbeats beats, default 8 = two 4/4 measures) so we count BEATS, not ticks.
// Idle = the wall-clock backstop cycles it. Mode 2 stays demos-only. bgWant() is
// the single source of desired layer states so applyBg (which runs every render)
// can't fight the alternator.
const BG_ALT_BEATS=32;   // 8 measures × 4 beats
const BG_ALT_MS=+(QSFLAGS.get("bgAltMs"))||16000;   // idle wall-clock backstop period (test override)
const bgAlt={side:"video", beats:0, lastFlip:0, lastBar:0};
function bgWant(){
  // mode 1 = the alternating program: honour the current side whether LIVE or IDLE
  // (idle used to force video, which silently defeated the wall-clock alternation).
  if(bgMode===1) return { v: bgAlt.side==="video", d: bgAlt.side==="demo" };
  return { v:false, d:bgMode===2 };
}
// STRICT EXCLUSIVITY (Paul 2026-07-09: "sometimes they are on top of each other"):
// applyBg IMPOSES bgWant() on both layers, unconditionally, on every render —
// setEnabled is idempotent in the layers, so this is free when nothing changed,
// and it steamrolls any rogue enable (a direct setEnabled call, a stale restore)
// at the next paint. Order is HIDE-then-SHOW: the loser goes display:none BEFORE
// the winner appears, so not even a same-tick frame ever composites both. The
// cut is hard (display, no fade) — on the beat, that's the aesthetic.
let bgHadV=null;   // previous imposed video state, so vidReset fires on the OFF transition only
function applyBg(){
  const V=window.VideoLayer, D=window.DemoLayer, w=bgWant();
  if(V&&!w.v){ V.setEnabled(false); if(bgHadV!==false&&bgMode!==1) vidReset(); }   // keep the clip bag during alternation
  if(D&&!w.d) D.setEnabled(false);
  if(V&&w.v) V.setEnabled(true);
  if(D&&w.d) D.setEnabled(true);
  if(V) bgHadV=w.v;
  if(bgChip.textContent!==BG_GLYPH[bgMode]) bgChip.textContent=BG_GLYPH[bgMode];   // applyBg also runs on the 1Hz reconciler — skip no-op DOM writes
  bgChip.classList.toggle("live",bgMode!==0);
}
// FLIP the background side: video <-> demo (fresh cart each demo turn), announce it.
function bgFlip(){
  if(bgMode!==1) return;
  bgAlt.beats=0; bgAlt.lastFlip=Date.now(); bgAlt.side=bgAlt.side==="video"?"demo":"video";
  if(bgAlt.side==="demo"&&window.DemoLayer&&DemoLayer.next) DemoLayer.next();   // a DIFFERENT cart each demo turn
  else if(bgAlt.side==="video") vidNextClip();   // footage returns FRESH — next bar advances the clip
  applyBg();
  set({status: bgAlt.side==="video" ? "background → video" :
    ("background → demo: "+(window.DemoLayer&&DemoLayer.currentName?DemoLayer.currentName():"microw8"))});
}
// MUSICAL driver: flip every BG_ALT_BEATS beats (8 measures) while LIVE — called
// from onBar at the bar's PLAYBACK instant, so the cut is beat-aligned.
export function bgBarTick(info){
  if(bgMode!==1||!S.live) return;
  bgAlt.lastBar=Date.now();   // the musical clock is flowing — backstop stands down
  bgAlt.beats+=(info&&info.cbeats)||8;
  if(bgAlt.beats>=BG_ALT_BEATS) bgFlip();
}
// RELIABILITY driver: a wall-clock backstop so "video on" ALWAYS visibly cycles —
// covers idle (not playing) and any route where onBar has stalled. While the
// musical clock is flowing it stands down entirely (it used to race the beat at
// slow tempos: 8 measures at 80bpm is 24s, and the 16s backstop cut mid-bar).
let bgAltTimer=0;
function bgAltClock(){
  if(bgMode!==1) return;
  if(S.live && (Date.now()-bgAlt.lastBar)<8000) return;   // live + bars flowing: the beat owns the cut
  if((Date.now()-bgAlt.lastFlip)>=BG_ALT_MS) bgFlip();
}
// the 1s tick doubles as a RECONCILER: applyBg is idempotent (the layers bail on
// no-change), so re-imposing bgWant every second means even a rogue direct
// setEnabled call from outside the program (console, stray future code) can
// stack the layers for at most ~1s before the XOR law is restored.
function startBgAltClock(){ if(!bgAltTimer) bgAltTimer=setInterval(()=>{ if(bgMode===1) bgAltClock(); applyBg(); },1000); }
window.__BGALT={ state:()=>({mode:bgMode,side:bgAlt.side,beats:bgAlt.beats}), tick:bgBarTick, flip:bgFlip };   // headless gate hook
bgChip.onclick=()=>{
  const V=window.VideoLayer, D=window.DemoLayer;
  for(let i=0;i<3;i++){ bgMode=(bgMode+1)%3;                       // advance to the next AVAILABLE mode
    if(bgMode===0) break;
    if(bgMode===1 && V && V.available()) break;
    if(bgMode===2 && D && D.available()) break;
  }
  bgAlt.side="video"; bgAlt.beats=0; bgAlt.lastFlip=Date.now();    // a fresh program starts on footage
  bgSave(); applyBg(); startBgAltClock(); set({status:"background: "+BG_LABEL[bgMode]});
};
// The ⚙-panel "video" button routes HERE (it used to call VideoLayer.setEnabled
// directly — the rogue path that could stack video over an active demo side and
// then lose a fight with applyBg one frame later). Semantics: toggle the
// video+demos program (mode 1) on/off. Returns false when video isn't available.
export function bgVideoToggle(){
  const V=window.VideoLayer;
  if(!(V&&V.available())) return false;
  bgMode = bgMode===1 ? 0 : 1;
  bgAlt.side="video"; bgAlt.beats=0; bgAlt.lastFlip=Date.now();    // a fresh program starts on footage
  bgSave(); applyBg(); startBgAltClock(); set({status:"background: "+BG_LABEL[bgMode]});
  return true;
}
export const bgVideoOn=()=>bgMode===1;
bgChip.ondblclick=()=>{ if(bgMode!==0 && window.DemoLayer&&DemoLayer.next){ DemoLayer.next(); set({status:"demo: "+(DemoLayer.currentName?DemoLayer.currentName():"next")}); } };
subs.push(applyBg); applyBg(); startBgAltClock();
