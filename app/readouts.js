// readouts.js — the self-scheduling status readouts: the CPU meter (live-only,
// ~1Hz, reads the engine's own load EMA + worklet counts + eco level) and the
// playhead/chyron lower-third (an MTV-style band card via namebank.js). Both tick
// on their own timers, independent of the store's render subs.
import { S, esc } from "./state.js";
import { KEYS, PROG_MODE } from "./world.js";
import { faustHandle } from "./live.js";

// ---------- playhead ----------
function keyModeOf(st){
  const [off,mode]=PROG_MODE[st.progression]||[0,"major"];
  return KEYS[(off+(st.keyOffset||0))%12]+" "+mode;
}
// ---------- the chyron: an MTV lower-third instead of a debug dump ----------
// Each journey leg / 32-bar window is a "song": namebank.js invents a title,
// artist, album, year and label deterministically from seed+genre; the roster
// names the live instruments and their (fake) players. A player's name hashes
// the instrument MODEL, so a glide flip = a lineup change = "now joining: …".
let chyKey="", chyId=null, chyRoster=[], joinLine="", joinAt=0;
function chyron(){
  const g=(S.weights[0]||{g:"vaporwave"}).g;
  const win=S.live?Math.floor(S.barCount/32):0;      // new song every ~32 bars while live
  const key=[S.seed,g,S.travel.seg,win].join("|");
  if(key!==chyKey){ chyKey=key; chyId=NameBank.identity(g, NameBank.hash(S.seed,g,S.travel.seg,win)); }
  const roster=NameBank.instrumentNames(S.playing).map(i=>({...i, who:NameBank.musician(i.role,i.model,S.seed)}));
  for(const r of roster){ const old=chyRoster.find(o=>o.role===r.role);
    if(old&&old.who!==r.who&&S.live){ joinLine="now joining: "+r.who+" on "+r.name; joinAt=Date.now(); } }
  chyRoster=roster;
  return { id:chyId, roster, join:(Date.now()-joinAt<7000)?joinLine:"" };
}
// CPU meter: ~1Hz, live-only. Reads the engine's own load EMA (handle.loadRatio,
// mirrored into S.load), live worklet-node count, and eco level. Colour tracks
// the eco gate — mint >=.99, amber <.99, pink <.97 (the ~0.97 gate where Paul's
// underrun clicks live and eco shedding starts).
const cpuEl=document.getElementById("cpu");
export function cpuMeterTick(){
  const h=window.FaustLive&&FaustLive.lastHandle;
  const on=S.live&&faustHandle&&h;
  cpuEl.classList.toggle("live",!!on);
  if(on){
    let load=S.load, nodes=0, awake=0, cap=0, eco=S.eco||0, cost=0, ceil=0;
    try{ load=h.loadRatio(); nodes=h.nodeCount?h.nodeCount():0;
      awake=h.awakeCount?h.awakeCount():nodes;
      cap=h.maxWorklets?h.maxWorklets():0; eco=h.ecoLevel();
      cost=h.awakeCost?h.awakeCost():0; ceil=h.costCeiling?h.costCeiling():0; }catch(e){}
    const col=load>=0.99?"var(--mint)":load>=0.97?"var(--amber)":"var(--pink)";
    cpuEl.style.color=col; cpuEl.style.borderColor=load<0.97?"var(--pink)":"var(--line)";
    // ⚡ CPU: the DSP LOAD — sum of SE.COST over the AWAKE (computing) worklets
    // as a % of SE.BUDGET (40 cost units = the mobile-safety ceiling, "100% =
    // about to fall over"). This is the number that PREDICTS clicks: it's the
    // real audio-thread synthesis work, unlike node count (a dx7 costs ~6x an
    // organ). The steal ceiling (h.costCeiling, ~28 = ~70%) is where the engine
    // starts stealing voices instead of waking more. Colour: mint<60 amber<85 pink.
    const cpuPct=Math.round(cost/40*100);
    const cpuEl2=document.getElementById("cpuCpu");
    cpuEl2.textContent="⚡"+cpuPct+"%";
    cpuEl2.style.color=cpuPct<60?"var(--mint)":cpuPct<85?"var(--amber)":"var(--pink)";
    document.getElementById("cpuLoad").textContent=load.toFixed(2)+"×";
    // ⬡ computing:resident/budget — worklets actually rendering vs resident
    // (sleepers cost ~0) vs the LRU-harvest hard cap on residents
    document.getElementById("cpuNodes").textContent="⬡"+awake+":"+nodes+(cap?"/"+cap:"");
    // STEMS tag + worker-headroom (the meter's throughput component): the Stage 3
    // cache pins the audio-thread cost by shipping heavy voices to the worker, so
    // its headroom (x-realtime) and any deadline-ladder activity belong on the meter.
    let stemTag="";
    try{ const ss=h.stemStats&&h.stemStats();
      if(ss&&ss.active){ stemTag=ss.dead?"STEMS✕":"STEMS"+(ss.headroom?" "+ss.headroom.toFixed(1)+"×":""); } }catch(e){}
    document.getElementById("cpuStems").textContent=stemTag;
    document.getElementById("cpuEco").textContent=eco>0?"eco"+eco:"";
    // tooltip: output route + worklet truth always; sentinel/renderCapacity
    // readouts only when armed (?debugSentinel=1 — h.sentinel() is null off)
    let tip="⚡DSP "+cost+"/40 cost (steal@"+ceil+") · out:"+(h.outputRoute||"?");
    try{
      const wt=h.workletTruth&&h.workletTruth();
      if(wt) tip+=" · ⬡truth "+wt.alive+"a/"+wt.counted+"c ("+wt.created+"-"+wt.destroyed+")";
      const sn=h.sentinel&&h.sentinel();
      if(sn&&sn.latest) tip+=" · snt clk "+sn.latest.clicks+"|Σ"+sn.total.clicks+" gap "+sn.latest.gaps+"|Σ"+sn.total.gaps+" pk "+sn.latest.peak.toFixed(2);
      const rc=h.renderCapacity&&h.renderCapacity();
      if(rc&&rc.latest) tip+=" · "+(rc.api==="renderCapacity"?"rc "+Math.round(rc.latest.averageLoad*100)+"%/"+Math.round(rc.latest.peakLoad*100)+"%pk ":"ps ")+"urΣ"+rc.total.underrunSum.toFixed(3)+" ue"+(rc.total.underrunEvents||0);
      const ss=h.stemStats&&h.stemStats();
      if(ss&&ss.active) tip+=" · stems "+(ss.dead?"DEAD":"hr"+ss.headroom.toFixed(1)+"× q"+ss.queued+" miss"+ss.misses+" vamp"+ss.vamps+" fb"+ss.fallbacks+" rst"+ss.resets)+(ss.failed&&ss.failed.length?" live["+ss.failed.join(",")+"]":"");
    }catch(e){}
    cpuEl.title=tip;
  }
  setTimeout(cpuMeterTick,1000);
}
export async function playheadTick(){
  if(!document.getElementById("playhead")) return;   // now-playing modal removed — feature retired
  if(S.playing&&window.NameBank){
    let line1="▶ press LIVE — the band is warming up";
    if(S.live&&S.barInfo){
      let t=0; try{ t=faustHandle?faustHandle.ctx.currentTime:0; }catch(e){}
      const b=S.barInfo, cb=b.cbeats||8, beat=Math.max(0,Math.min(cb-0.01,(t-b.when)/b.spb+cb));
      line1=`▶ bar ${b.serial+1} · beat ${1+Math.floor(beat%cb)} · ${b.chord||"—"} (${b.ci+1}/${b.nch}) · ${b.section}`+
        (S.waypoints.length>=2?` · leg ${S.travel.seg+1}→${(S.travel.seg+1)%S.waypoints.length+1}`:"")+
        ` · engine ${S.load.toFixed(2)}x${S.load<0.97?" ⚠":""}`;
    }
    const c=chyron();
    const line2=`key ${keyModeOf(S.playing)} · ${S.playing.bpm}bpm · `+
      S.weights.map(w=>`${w.g} ${Math.round(w.w*100)}%`).join(" · ")+
      (S.live&&S.queue.length?` · ${S.queue.length} changes queued`:"")+
      ` · verifier hears: ${S.best}`;
    document.getElementById("playhead").innerHTML=
      `<div class="chy">`+
      `<div class="chy-title">${esc(c.id.title)}</div>`+
      `<div class="chy-artist">${esc(c.id.artist)}</div>`+
      `<div class="chy-album">from “${esc(c.id.album)}” · ${esc(c.id.label)} · ${c.id.year}</div>`+
      `<div class="chy-roster">${c.roster.map(r=>`<div><span class="chy-inst">${esc(r.name)}</span> — ${esc(r.who)}</div>`).join("")}</div>`+
      (c.join?`<div class="chy-join">★ ${esc(c.join)}</div>`:"")+
      `<div class="chy-tech">${esc(line1)}<br>${esc(line2)}</div>`+
      (S.status?`<div class="chy-status">${esc(S.status)}</div>`:"")+   // the ONE status line (was a separate panel div)
      `</div>`;
  }
  setTimeout(playheadTick,250);
}
