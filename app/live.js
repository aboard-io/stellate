// live.js — the live playback machinery. Owns the Faust engine handle
// (faustHandle) and the goLive()/stopLive() lifecycle, plus the honest boot
// progress hairline, the ?wavDebug overlay, the ?clicktest bed, and the mobile
// lock-screen Media Session. The per-voice Faust engine is THE engine
// (FAUST-PORT.md phase 3; the csound WASM path lives on branch legacy-csound).
import { S, set, K, E, QSFLAGS } from "./state.js";
import { retarget, rebuildQueue, travelStep, glideStep } from "./targeting.js";
import { bgBarTick } from "./background.js";
import { scheduleBarNotes, clearNoteTimers } from "./inside.js";
import { urlTick, travelForBar, pointOnPath, legMetrics, paceSpeed } from "./share.js";   // the bookmarkable measure: per-bar URL refresh + measure<->path math (legMetrics/paceSpeed: the constant-pace inverse for the resume measure)

// ---------- live engine ----------
export let faustHandle=null;
// THE PLAYHEAD IS THE SOURCE OF TRUTH for the resume measure. The constant-pace
// inverse of share.js travelForBar: the traveler's {seg,t} -> its measure
// (distance along the perimeter / speed). Same distance math starmap.js
// dragPlayhead uses to label a scrubbed measure, so a stop resumes exactly at
// the visible playhead — including after a LIVE playhead drag (the engine's bar
// serial doesn't move when you drag, but the traveler does).
function barForTravel(travel){
  const { legs }=legMetrics();
  let d=0; for(let i=0;i<travel.seg;i++) d+=legs[i]||0;
  d+=travel.t*(legs[travel.seg]||0);
  return Math.max(0, Math.round(d/Math.max(1e-6, paceSpeed())));
}
// USER MASTER VOLUME — persisted; applied live to whichever engine handle is up.
export function setMasterVol(v){
  const g=Math.max(0,Math.min(1.5,+v||0));
  S.masterVol=g;
  try{ localStorage.setItem("vaporwave-master-vol",String(g)); }catch(e){}
  try{ if(faustHandle&&faustHandle.setMasterVol) faustHandle.setMasterVol(g); }catch(e){}
}
// VAPOR (C.1) — live-only master EQ ("walking through a mall"), 0..1; persisted,
// applied live to the classic engine handle (the WAV path has no live graph).
export function setVapor(v){
  const g=Math.max(0,Math.min(1,+v||0));
  S.vapor=g;
  try{ localStorage.setItem("vaporwave-vapor",String(g)); }catch(e){}
  try{ if(faustHandle&&faustHandle.setVapor) faustHandle.setVapor(g); }catch(e){}
}
// ---------- boot progress: honest warm-up meter (play tap -> first audio) ----
// The live boot has real, observable phases (faust/live.js emits them via
// onStatus, plus onBar for the first scheduled bar): "loading Faust modules…"
// (the big ESM+wasm fetch), then "live (faust)…" once the master graph is up,
// then the first onBar (first bar scheduled), then audio. We drive the bar off
// THOSE events only — never a timer faking progress. If a phase stalls, the bar
// holds its honest width and shimmers (indeterminate) instead of creeping to
// 99%. It completes only on the first real RMS (sound is actually out), then
// fades. Same path serves the journey/path start: play always routes through
// goLive() (the path just pre-seeds waypoints), so this covers both.
const bootEl=document.getElementById("boot"),
      bootFill=bootEl.querySelector(".bfill"), bootLabel=bootEl.querySelector(".blabel");
let bootStageV=0, bootActive=false, bootStallT=0, bootRmsT=0;
function bootTo(frac,label){
  if(frac<bootStageV) return;                       // monotonic: never walk backward
  bootStageV=frac; bootEl.classList.remove("ind");
  bootFill.style.width=Math.round(frac*100)+"%";
  if(label) bootLabel.textContent=label;
  clearTimeout(bootStallT);
  if(frac<1) bootStallT=setTimeout(()=>{ if(bootActive) bootEl.classList.add("ind"); },1400);
}
function bootStart(){
  bootActive=true; bootStageV=0;
  bootEl.classList.add("on"); bootEl.classList.remove("ind");
  bootFill.style.transition="none"; bootFill.style.width="0%";
  void bootFill.offsetWidth; bootFill.style.transition="";   // reflow so the fill restarts from 0
  bootTo(0.08,"waking the engine…");
}
function bootStatus(m){
  if(!bootActive) return;
  if(/loading faust modules/i.test(m)) bootTo(0.24,"loading synth modules…");
  else if(/^live|tap again if silent/i.test(m)) bootTo(0.62,"building the voices…");
}
function bootBar(){
  if(!bootActive) return;
  bootTo(0.86,"scheduling the first bar…");
  if(!bootRmsT) bootRmsT=setInterval(()=>{               // wait for REAL sound, not a guess
    let r=0; try{ r=faustHandle?faustHandle.rms():0; }catch(e){}
    if(r>0.0008) bootDone();
  },80);
}
function bootDone(){
  if(!bootActive) return;
  bootActive=false; clearInterval(bootRmsT); bootRmsT=0; clearTimeout(bootStallT);
  bootEl.classList.remove("ind");
  bootTo(1,"playing"); bootFill.style.width="100%";
  setTimeout(()=>{ if(!bootActive) bootEl.classList.remove("on"); },500);
}
function bootAbort(){   // stop pressed mid-warmup, or boot failed: pull it down
  bootActive=false; clearInterval(bootRmsT); bootRmsT=0; clearTimeout(bootStallT);
  bootEl.classList.remove("on","ind");
}
window.__BOOT={ stage:()=>bootStageV, active:()=>bootActive, on:()=>bootEl.classList.contains("on"),
  ind:()=>bootEl.classList.contains("ind"), width:()=>bootFill.style.width };   // headless probe
// ?forceClassicOut=1 — bypass the mobile media-element output route and drive
// ctx.destination directly even on a mobile UA (the R8 escape hatch; pairs
// with the engine's opt-in element recycle, faust/live.js 1.7).
const FORCE_CLASSIC=QSFLAGS.get("forceClassicOut")==="1";
// ?forceMediaEl=1 — force the <audio>/MediaStream output route (the background-
// survival path) even on desktop; escape hatch if Safari auto-detection misses.
const FORCE_MEDIAEL=QSFLAGS.get("forceMediaEl")==="1";
// ?wavOut=1 force the WAV-FIRST mobile audible path anywhere (desktop test hatch);
// ?wavOut=0 escape back to the ring/worklet path; unset = auto (on when isMobile).
const WAVOUT=QSFLAGS.has("wavOut")?(QSFLAGS.get("wavOut")!=="0"):undefined;
// ?segAB=1 — v3: force the v2 A/B <audio> element pair instead of the default
// continuous-MP3 (Managed)MediaSource append stream (the WAV-FIRST fallback tier).
const SEGAB=QSFLAGS.has("segAB")?(QSFLAGS.get("segAB")!=="0"):undefined;
// ?codec=mp3|opus|aac — v4: force the append route's encoder/codec tier. Default walks
// the ladder mms-aac → mse-aac → mse-opus → mms-mp3/mse-mp3 → segAB by feature support.
const CODEC=QSFLAGS.has("codec")?QSFLAGS.get("codec"):undefined;
// ?allSampled=1 — EXPERIMENT (default OFF): render the ENTIRE mix from the SF2-
// derived sample library (found/samples/instruments + drums), no Faust synthesis.
// Applied as a transform at the getState boundary (below) so it survives genre
// retargets/glides — every state the live engine sees is enriched by
// GenreKernel.applySampledOnly (idempotent). See genre-kernel + state-engine.
const ALLSAMPLED=QSFLAGS.get("allSampled")==="1";
// ?wavDebug=1 — on-device diagnostic overlay for the wavOut routes: route, boot-stage
// timings, buffer depth, starve count, straight off the live handle at 2 Hz. Real
// MMS behavior exists only on the device; this is how the device reports back.
const WAVDEBUG=QSFLAGS.get("wavDebug")==="1";
let wavDbgTimer=0;
function startWavDebug(){
  if(!WAVDEBUG||wavDbgTimer) return;
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;left:8px;bottom:8px;z-index:9999;background:rgba(0,0,20,.92);color:#8ef;font:10px/1.5 monospace;padding:6px 8px;border:1px solid #345;border-radius:4px;max-width:92vw;width:340px";
  const stats=document.createElement("div"); stats.style.cssText="white-space:pre-wrap;overflow:hidden;margin-bottom:4px";
  // the shareable EVENT LOG (Paul: "log events in a text field + a copy button so I
  // can share analytics from safari iOS"): status changes, new errors, decode
  // failures, route/demotion changes, and a 5s telemetry snapshot — timestamped.
  const ta=document.createElement("textarea");
  ta.readOnly=true; ta.spellcheck=false;
  ta.style.cssText="display:block;width:100%;height:110px;background:#021;color:#9fc;font:9px/1.4 monospace;border:1px solid #234;border-radius:3px;padding:4px;resize:none;-webkit-user-select:text;user-select:text";
  const btn=document.createElement("button");
  btn.textContent="copy log";
  btn.style.cssText="margin-top:4px;background:#134;color:#9ef;border:1px solid #467;border-radius:3px;font:10px monospace;padding:3px 10px";
  // AUDIT-TRUTH: download the full per-bar expected-vs-actual audit ring as JSON.
  const dbtn=document.createElement("button");
  dbtn.textContent="download audit";
  dbtn.style.cssText="margin:4px 0 0 6px;background:#312;color:#fbb;border:1px solid #745;border-radius:3px;font:10px monospace;padding:3px 10px";
  wrap.appendChild(stats); wrap.appendChild(ta); wrap.appendChild(btn); wrap.appendChild(dbtn);
  document.body.appendChild(wrap);
  const t0=Date.now(), lines=[];
  const ts=()=>"[+"+((Date.now()-t0)/1000).toFixed(1)+"s]";
  const log=(m)=>{ lines.push(ts()+" "+m); if(lines.length>500)lines.splice(0,100);
    ta.value=lines.join("\n"); ta.scrollTop=ta.scrollHeight; };
  log("ua: "+navigator.userAgent);
  log("url: "+location.pathname+location.search);
  btn.addEventListener("click",()=>{
    // append the compact AUDIT summary — iOS downloads are awkward; clipboard is proven.
    let sum="";
    try{ const h=faustHandle; if(h&&h.auditSummary) sum="\n"+h.auditSummary(); }catch(e){}
    const text=lines.join("\n")+sum;
    const ok=()=>{ btn.textContent="copied ✓"; setTimeout(()=>btn.textContent="copy log",1500); };
    const fallback=()=>{ try{ ta.focus(); ta.select(); ta.setSelectionRange(0,ta.value.length); document.execCommand("copy"); ok(); }catch(e){ btn.textContent="select+copy manually"; } };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok,fallback);
    else fallback();
  });
  dbtn.addEventListener("click",()=>{
    let ring=[],stats=null;
    try{ const h=faustHandle; if(h&&h.audit) ring=h.audit(); if(h&&h.auditStats) stats=h.auditStats(); }catch(e){}
    const blob=new Blob([JSON.stringify({ ua:navigator.userAgent, url:location.pathname+location.search,
      when:new Date().toISOString(), stats, summary:(faustHandle&&faustHandle.auditSummary?faustHandle.auditSummary():""),
      bars:ring },null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="audit-"+Date.now()+".json"; document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{URL.revokeObjectURL(a.href);}catch(e){} a.remove(); },1000);
    dbtn.textContent="saved ✓ ("+ring.length+" bars)"; setTimeout(()=>dbtn.textContent="download audit",1800);
  });
  let lastStatus=null,lastErrN=0,lastFailN=0,lastRoute=null,lastDemoted=false,lastSnap=0;
  wavDbgTimer=setInterval(()=>{
    if(S.status!==lastStatus){ lastStatus=S.status; log("status: "+S.status); }
    const h=faustHandle; if(!h){ stats.textContent="no handle"; return; }
    let s={};
    try{
      const w=h.__wavState?h.__wavState():null;
      const route=(typeof h.outputRoute==="function"?h.outputRoute():h.outputRoute);
      s={ route, aheadSec:h.runwaySec?+h.runwaySec().toFixed(1):null,
        starves:h.underruns?h.underruns():null, rms:+h.rms().toFixed(3),
        ct:h.mediaEl?+(h.mediaEl.currentTime||0).toFixed(1):null,
        drift:w&&w.stitchDriftSec!=null?w.stitchDriftSec:null,
        aud:w&&w.auditAnoms!=null?(w.auditAnoms+"/"+(w.auditBars||0)):null,
        dbl:w&&w.doublePlayAnoms!=null?(w.audibleElements+"el x"+w.doublePlayAnoms):null,
        dec:w&&w.decode?("f"+w.decode.found.ok+"/"+w.decode.found.fail+" s"+w.decode.sampler.ok+"/"+w.decode.sampler.fail):null };
      if(route!==lastRoute){ lastRoute=route; log("route: "+route); }
      if(w&&w.demoted&&!lastDemoted){ lastDemoted=true; log("DEMOTED: "+(w.demoteReason||"?")); }
      if(h.errors&&h.errors.length>lastErrN){ for(let i=lastErrN;i<h.errors.length;i++) log("error: "+h.errors[i]); lastErrN=h.errors.length; }
      const fails=(w&&w.decode&&w.decode.fails)||[];
      if(fails.length>lastFailN){ for(let i=lastFailN;i<fails.length;i++) log("decode-fail: "+fails[i]); lastFailN=fails.length; }
      if(Date.now()-lastSnap>5000){ lastSnap=Date.now();
        log("snap route="+s.route+" ahead="+s.aheadSec+"s drift="+s.drift+" starves="+s.starves+" ct="+s.ct+" rms="+s.rms+" audit="+s.aud+" dbl="+s.dbl+" dec="+s.dec+(h.bootStats?" boot="+JSON.stringify(h.bootStats()):""));
        try{ if(h.auditSummary){ const as=h.auditSummary(); if(/anomalies/.test(as)&&!/: 0 anomalies/.test(as)) log(as); } }catch(e){} }
    }catch(e){ s={err:String(e&&e.message||e)}; }
    stats.textContent=JSON.stringify(s).replace(/[{}"]/g,"");
  },500);
}
// ---- CLICK TEST BED (?clicktest=N) — a SILENT diagnostic "genre" -------------
// Paul's idea for hunting the sub-0.5 clicks the clickmon tripwire misses: strip
// the mix down to ONE soft, STEADY pad and silence everything else, then let the
// engine churn around it. There is no musical content to mask a glitch, so any
// tick you hear IS a seam/switch artifact (butt-splice, crossfade, or reset).
// Slow bpm + short reverb keep the bar seams far apart and un-smeared. Modes:
//   1 = STATIONARY pad, identical every bar (tests the continuous butt-splice
//       seam — the path the "kill the clicks" commit left as a zero-fade splice)
//   2 = same pad, MODEL cycles every bar (tests the ~20ms voice/color-swap xfade)
//   3 = same pad, SECTION identity flips every bar (tests the stem-reset xfade)
// Inert unless ?clicktest=N is set — safe in the production tree.
const CLICKTEST=+(QSFLAGS.get("clicktest")||0);
const CT_MODELS=["saw","organ","fm","pluck","stack"];
const CT_BASE=E.defaultState();
let ctN=0;
function clickTestState(){
  const s=JSON.parse(JSON.stringify(CT_BASE)); const n=ctN++;
  s.bpm=60; s.progression="drone_min"; s.reverb=0.2; s.seed=1;
  s.delay={beats:0.75,feedback:0,cutoff:2000};
  const soft={level:0.2,send:0.05,dsend:0,attack:2.0,cutoff:900,res:0.1,detune:0.004,wave:"saw"};
  const model=CLICKTEST>=2?CT_MODELS[n%CT_MODELS.length]:"saw";
  s.instruments={
    pad:{...soft,model},
    bass:{level:0,send:0,dsend:0},
    melody:{level:0,send:0,dsend:0,voices:1},
    drums:{kick:0,snare:0,hat:0,tom:0,send:0,dsend:0,kickModel:"boom",snareModel:"noise",hatModel:"noise"}
  };
  s.foundSources=[];
  const secId=CLICKTEST>=3?("ct"+(n%2)):"ct";
  s.sections=[{id:secId,name:secId,cycles:1,pads:true,bass:"off",drums:"off",melody:"off",found:{sourceId:null,role:"bed"},fill:"off"}];
  return s;
}
export async function goLive(){
  bootStart();
  try{
    // a drawn path starts FRESH: reset the traveler to the path start and
    // SNAP the playing state to that target (retarget while !S.live replaces
    // playing wholesale) — no glide from the previous run's genre, and the
    // stale glide queue from that run is cleared.
    if(CLICKTEST){ ctN=0; set({playing:clickTestState(), target:clickTestState()}); }   // seed a valid base so UI reads never hit null
    else if(S.waypoints.length>=2){
      // DROP-IN (the bookmarkable measure): S.startBar>0 — set by a shared URL,
      // a playhead drag while stopped, or the last stop — starts the traveler at
      // that measure's position on the loop instead of the path start; the walk
      // below starts its serial there too, so measure N sounds exactly as if N
      // bars had played. startBar 0 keeps the original fresh-start behavior.
      const sb=S.startBar||0;
      const tv=sb>0?travelForBar(sb):{seg:0,t:0};
      set({travel:tv, queue:[], barCount:sb});
      retarget(sb>0?pointOnPath(tv):{x:S.waypoints[0].x, y:S.waypoints[0].y});
    }
    set({live:true,barCount:S.startBar||0,holdUntil:{}}); rebuildQueue();   // fresh instrument-hold timers per session; barCount continues from the drop-in measure
    if(CLICKTEST) ctN=0;   // first PLAYED bar is n=0 (the seed calls above advanced it)
    let getState=CLICKTEST?(()=>clickTestState()):(()=>S.playing);
    // EXPERIMENT: ?allSampled=1 — enrich every state the engine polls (survives
    // retargets/glides since it wraps the getState boundary, not a one-time set).
    if(ALLSAMPLED){ const raw=getState; getState=()=>{ const st=raw(); return st?K.applySampledOnly(st):st; }; }
    faustHandle=await FaustLive.exploreLive(getState, m=>{set({status:m}); bootStatus(m);}, { forceClassicOut:FORCE_CLASSIC, forceMediaEl:FORCE_MEDIAEL, wavOut:WAVOUT, segAB:SEGAB, codec:CODEC, startBar:S.startBar||0, masterVol:S.masterVol, vapor:S.vapor, onLoad:(r,e)=>{S.load=r; S.eco=e||0;}, onBar:(info)=>{
      bootBar();   // first bar scheduled -> advance the warm-up bar, then it waits on real RMS
      set({barInfo:info,barCount:S.barCount+1});
      urlTick();   // the address bar carries the measure — copying it bookmarks THIS moment
      scheduleBarNotes(info);   // fire DemoLayer.note(ev) at each note onset (no-op unless the demoscene layer is on)
      if(S.waypoints.length>=2) travelStep();
      glideStep();
      bgBarTick(info);   // demoscene 8-measure cart rotation (live only), cut on the beat
      if(window.DemoLayer&&DemoLayer.pulse)DemoLayer.pulse(info);      // demoscene: surge the effect's clock on the bar
      updateMediaSession();   // reflect the current genre/blend on the lock screen (updates across a swap)
    }});
    if(MSESSION){ try{ MSESSION.playbackState="playing"; }catch(e){} updateMediaSession(true); }
    startWavDebug();   // ?wavDebug=1 overlay (inert otherwise)
  }catch(e){ set({live:false,status:"live failed: "+e.message}); bootAbort(); console.error(e); }
}
export function stopLive(){
  // STOP TWICE = REWIND (Paul 2026-07-10: "When I hit stop and start keep
  // playing at the playhead. If I click stop TWICE, then reset to the
  // beginning."): a stop while already stopped clears the resume measure and
  // parks the traveler back at the path start — ▶ then opens from measure 1.
  if(!S.live){
    S.startBar=0;
    set({barCount:0, travel:{seg:0,t:0}, queue:[], barInfo:null});
    if(S.waypoints.length>=2) retarget({x:S.waypoints[0].x, y:S.waypoints[0].y});
    urlTick();   // the URL drops its m — the bookmark is the top again
    set({status:"⏮ rewound to the top — ▶ starts from measure 1"});
    return;
  }
  // remember WHERE we stopped: the next play (and the shareable URL) resumes at
  // this measure instead of rewinding to the path start. Derive it from the
  // TRAVELER'S current position (S.travel), NOT the engine's bar serial — a live
  // playhead DRAG moves the traveler but never the engine serial, so the old
  // `barInfo.serial+1` silently reverted a drag→stop→play back to the pre-drag
  // spot (Paul's "move the playhead and then play, it just reverts"). For a
  // normal undragged ride travel-measure == serial+1 exactly (travelStep and the
  // engine advance in lockstep from the same startBar), so this is behaviour-
  // identical there and only fixes the dragged case. No path (free-roam) has no
  // traveler, so fall back to the engine serial.
  if(S.waypoints.length>=2) S.startBar=barForTravel(S.travel);
  else if(S.barInfo) S.startBar=S.barInfo.serial+1;
  set({live:false, queue:[]});   // queue cleared: the next run must not inherit this run's glide flips
  clearNoteTimers();   // drop any pending demoscene note onsets so none fire after ■
  bootAbort();   // stopped before sound? clear the warm-up bar
  if(faustHandle){ try{faustHandle.stop();}catch(e){} faustHandle=null; }
  if(MSESSION){ try{ MSESSION.playbackState="paused"; }catch(e){} }
  try{ document.title=ORIG_TITLE; }catch(e){}   // restore the tab title when idle
  urlTick();   // the address bar's ?m= now reflects the true resume measure (idle buildShareUrl reads startBar) so a refresh keeps the dragged spot
  set({status:"stopped"}); }
setInterval(()=>{ if(!S.live&&S.playing&&S.target){ set({barCount:S.barCount+1}); glideStep(); } },1400);

// ---------- Media Session: lock-screen metadata + transport (mobile) --------
// Pairs with faust/live.js's media-element output route: the element makes the
// OS treat the page as media playback (survives screen lock), and this makes
// the lock screen / notification shade show WHAT is playing and wire its
// play/pause buttons to the real engine. Feature-detected — a silent no-op on
// desktop / older browsers, so behavior there is unchanged. Artwork skipped:
// the star chart is live SVG (no canvas), so a snapshot would mean an offscreen
// re-render for marginal payoff.
const MSESSION = (typeof navigator!=="undefined" && "mediaSession" in navigator) ? navigator.mediaSession : null;
const ORIG_TITLE = (typeof document!=="undefined" && document.title) || "STELLATE";
const msLbl=g=>(K.GENRES[g]&&K.GENRES[g].label)||g;   // the lock screen speaks the fiction too
// ALBUM = the PARENT genre you're anchored to (the dominant weight in the blend).
function msParentGenre(){
  const ws=(S.weights||[]).filter(w=>w&&w.w>0.001);
  return ws.length ? msLbl(ws[0].g) : "the genre space";
}
// SONG = the CURRENT CLOSEST genre — what the verifier hears this moment as most
// (S.best), which drifts as you travel/blend; falls back to the parent when idle.
// S.best may be a key (-> its label) or already human text (returned as-is).
function msClosestGenre(){
  const b=S.best;
  return (b && b!=="…") ? msLbl(b) : msParentGenre();
}
let msLastTitle="", msLastAlbum="";
function updateMediaSession(force){
  const title=msClosestGenre(), album=msParentGenre();
  if(!force && title===msLastTitle && album===msLastAlbum) return;
  msLastTitle=title; msLastAlbum=album;
  // Drive the document title too, so a streaming/lock-screen display that falls
  // back to the page title (or the bare hostname) never shows "aboardresearch".
  try{ document.title = (S.live ? title+" · STELLATE" : ORIG_TITLE); }catch(e){}
  if(!MSESSION || typeof MediaMetadata==="undefined") return;
  // artist = the project; album = parent genre; song/title = current closest genre.
  try{ MSESSION.metadata=new MediaMetadata({ title, artist:"stellate.app", album }); }catch(e){}
}
if(MSESSION){ try{
  MSESSION.setActionHandler("play", ()=>{ if(!S.live) goLive(); });
  MSESSION.setActionHandler("pause", ()=>{ if(S.live) stopLive(); });   // pause == stop: the engine has no freeze, a clean stop is honest
  MSESSION.setActionHandler("stop", ()=>{ stopLive(); });   // unguarded: a second stop from the lock screen rewinds to the top (the stop-twice rule)
}catch(e){} }
