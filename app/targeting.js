// targeting.js — the mix targeter and the glide engine. weightsAt() turns a point
// in the star map into a genre-weight blend; retarget() resolves that into an
// engine state (via K.mix) and either snaps (pre-LIVE) or queues a smooth glide
// (mid-performance). glideStep()/rebuildQueue() run the continuous morph + the
// discrete voice/section flips; travelStep() walks the drawn path leg by leg.
import { S, set, deep, K, V } from "./state.js";
import { POS, SNAP, CUTOFF, MODE_LOCKS, BARS_PER_SEG } from "./world.js";
import { faustHandle } from "./live.js";

// ---------- weights / targeting ----------
export function weightsAt(pt){
  const ds=Object.entries(POS).map(([g,[x,y]])=>({g,d:Math.hypot(pt.x-x,pt.y-y)})).sort((a,b)=>a.d-b.d);
  const base=1/(CUTOFF*CUTOFF+80);
  let ws=ds.map(({g,d})=>({g,w:Math.max(0,1/(d*d+80)-base)})).filter(x=>x.w>0).slice(0,4);
  const tot=ws.reduce((s,x)=>s+x.w,0)||1;
  ws=ws.map(x=>({g:x.g,w:x.w/tot}));
  // sparse-map safety: with the dynamic layout the star field can have voids wider
  // than CUTOFF (a leg crossing an empty region). If nothing is in range, hold the
  // single NEAREST genre at full weight so the mix never gets an empty weight list.
  if(!ws.length) ws=[{g:ds[0].g, w:1}];
  // CONTINUOUS snap-to-anchor: pull toward the nearest star by how UNAMBIGUOUSLY
  // nearest it is — the GAP to the 2nd-nearest star over SNAP. On a star the gap
  // is huge -> pure genre; exactly between two stars the gap -> 0 -> natural
  // blend. This is continuous everywhere, including where "nearest" changes
  // (there the two distances are equal, so the pull is ~0). The OLD hard
  // `if(d<SNAP) return 100%` snap had overlapping snap radii on close pairs
  // (arabpop[215,285]/triphop[240,255] are 39px<2*SNAP apart) — the target
  // swapped 100%->100% at the leg midpoint with NO blend zone, which read as a
  // jump. Weight sum stays 1 (the lerp is convex).
  const d0=ds[0].d, d1=ds[1]?ds[1].d:Infinity;
  const s=Math.max(0,Math.min(1,(d1-d0)/SNAP));
  if(s>0&&ws.length){ const near=ds[0].g;
    ws=ws.map(x=>({g:x.g,w:x.g===near?x.w+s*(1-x.w):x.w*(1-s)})); }
  return ws;
}
let lastSig="";
// each genre NEIGHBORHOOD gets its own key (stable per seed): the space was
// all C/Am before, so every pad landed on the same pitches — the "royal road
// pad" haunting even jungle. Crossing into a new dominant genre = a key change.
function keyFor(weights,seed){
  const g=(weights[0]||{g:"vaporwave"}).g;
  let h=seed>>>0; for(const c of g) h=(h*31+c.charCodeAt(0))>>>0;
  return h%12;
}
export function retarget(pt){
  return retargetWeights(weightsAt(pt), pt);
}
// retarget from an EXPLICIT weight blend rather than a map point. The accessible
// text UI (access.html) drives the same glide engine this way — a listener who
// can't see the star map still gets byte-identical music for the same seed +
// blend. When `pt` is supplied the cursor is placed too (the map path); the
// accessible page omits it (there is no cursor to move). retarget() above is the
// map's caller and stays behavior-identical: weightsAt(pt) then this.
export function retargetWeights(weights, pt){
  const target=K.mix(weights.map(w=>({...w})),{seed:S.seed, keyOffset:keyFor(weights,S.seed)});
  if(S.bpmDelta) target.bpm=Math.max(40,Math.min(240,Math.round(target.bpm+S.bpmDelta)));   // the ⚙ ±bpm delta rides every target
  if(MODE_LOCKS[S.modeLock]) target.progression=MODE_LOCKS[S.modeLock];
  const patch={weights,target};
  if(pt) patch.cursor=pt;
  // before LIVE (or after STOP) the cursor PLACES you — the playing state IS
  // the target. Only mid-performance do we glide instead of jump.
  if(!S.playing||!S.live){ patch.playing=deep(target); }
  set(patch);
  const sig=JSON.stringify(weights.map(w=>w.g+Math.round(w.w*20)))+S.modeLock;
  if(sig!==lastSig){ lastSig=sig; rebuildQueue(); }
  // 1.6: pre-voice the TARGET while the glide is still in flight — the engine
  // builds the destination's worklets through its airlock (stopped, stashed)
  // so arrival costs zero instantiation inside the render window. Best-effort
  // and coalescing (travelStep retargets every bar; the engine keeps only the
  // latest target).
  if(S.live&&faustHandle&&faustHandle.prepare){ try{ faustHandle.prepare(target); }catch(e){} }
}
// (setMacro/resetMacros lived here until 2026-07-10 — Paul: "get rid of all
// macros". The kernel's applyMacros machinery stays; no caller passes
// opts.macros now, and absent macros = byte-identical resolution.)

// ---------- glide ----------
const PATHS=["swing","humanize","reverb","pump","crackle","comp","delay.beats","delay.feedback","delay.cutoff",
  "tone.lowcut","tone.highcut","instruments.pad.cutoff","instruments.pad.level","instruments.pad.send","instruments.pad.detune",
  "instruments.bass.cutoff","instruments.bass.level","instruments.melody.cutoff","instruments.melody.level",
  "instruments.melody.send","instruments.melody.voices","instruments.melody.spread","instruments.drums.kick",
  "instruments.drums.snare","instruments.drums.hat","instruments.drums.send","instruments.drums.dsend"];
const getP=(o,p)=>p.split(".").reduce((a,k)=>a&&a[k],o);
const setP=(o,p,v)=>{const ks=p.split("."),l=ks.pop();ks.reduce((a,k)=>a[k]=a[k]||{},o)[l]=v;};
// a voice's timbre identity is model + dx7 patch + sampler zones: flipping
// .model alone left LIVE journeys playing a stale/absent dx7 or an empty
// sampler forever (the kernel emits instruments.<voice>.{dx7,sampler} and the
// Faust engine builds the unit from them — see state-engine pitchedUnit).
const timbreId=v=>c=>{const m=c.instruments[v];
  // dx7.name is deliberately EXCLUDED: a same-algorithm patch change (different
  // name, e.g. "A"->"A~B") is morphed continuously by the glideStep param lerp
  // below, so folding name in only queued a redundant one-bar discrete voice
  // flip on top of the lerp (probe measured ~22% of |B-A| snap). A real topology
  // change still flips — it changes dx7.algorithm.
  return [m.model, m.dx7&&m.dx7.algorithm, m.sampler&&m.sampler.id];};
const timbreFlip=v=>(c,t)=>{const cv=c.instruments[v], tv=t.instruments[v];
  cv.model=tv.model;
  if(tv.dx7) cv.dx7=deep(tv.dx7); else delete cv.dx7;
  if(tv.sampler){ cv.sampler=deep(tv.sampler);
    // zone wavs ride foundSources (vol 0) — carry any the zones reference so
    // the sampler isn't silent until the separate "sample" flip lands
    const have=new Set((c.foundSources||[]).map(s=>s.id));
    for(const z of (tv.sampler.zones||[])) if(z.srcId&&!have.has(z.srcId)){
      const src=(t.foundSources||[]).find(s=>s.id===z.srcId);
      if(src){ c.foundSources.push(deep(src)); have.add(z.srcId); } }
  } else delete cv.sampler;
};
const DISCRETE=[
  ["pad voice",timbreId("pad"),timbreFlip("pad")],
  ["bass voice",timbreId("bass"),timbreFlip("bass")],
  ["lead voice",timbreId("melody"),timbreFlip("melody")],
  ["kick",c=>c.instruments.drums.kickModel,(c,t)=>c.instruments.drums.kickModel=t.instruments.drums.kickModel],
  ["snare",c=>c.instruments.drums.snareModel,(c,t)=>c.instruments.drums.snareModel=t.instruments.drums.snareModel],
  ["hat",c=>c.instruments.drums.hatModel,(c,t)=>c.instruments.drums.hatModel=t.instruments.drums.hatModel],
  // the kit's identity is the pattern name AND the sampled one-shot overlays
  // (instruments.drums.{kick,snare,hat,tom,clap,rim,ride,crash,perc}Sampler).
  // Meta-only identity let the "form" flip (which copies genreMeta.kit) erase
  // this flip's diff while the PLAYING kit still held the old genre's samplers —
  // pointed at srcIds the crate no longer carried, so every drum note skipped
  // silently (Paul's fugue->reggae: NO DRUMS, 0/233 note() calls in the probe).
  ["drum kit",c=>{const D=c.instruments.drums||{};
    return [c.genreMeta.kit,...Object.keys(D).filter(k=>/Sampler$/.test(k)).sort().map(k=>D[k]&&D[k].id)];},
   (c,t)=>{c.genreMeta.kit=t.genreMeta.kit;
    // bring the NEW DRUMMER'S KIT, not just the setlist: copy the target's
    // sampled-kit overlays and carry their zone wavs into foundSources (vol 0),
    // mirroring timbreFlip — without the sources, ensureSamplerBufs finds
    // nothing and the kit is silent until the next "sample" flip (or forever).
    const cD=c.instruments.drums, tD=t.instruments.drums||{};
    const have=new Set((c.foundSources||[]).map(s=>s.id));
    for(const k of Object.keys(cD)) if(/Sampler$/.test(k)&&!tD[k]) delete cD[k];
    for(const k of Object.keys(tD)) if(/Sampler$/.test(k)){
      cD[k]=deep(tD[k]);
      for(const z of (tD[k].zones||[])) if(z.srcId&&!have.has(z.srcId)){
        const src=(t.foundSources||[]).find(s=>s.id===z.srcId);
        if(src){ c.foundSources.push(deep(src)); have.add(z.srcId); }}}
    // sections: rewrite live drum patterns to the target's kit. From an ALL-OFF
    // genre (fugue: every section drums:"off") the old rewrite matched nothing —
    // the flip was a NO-OP that erased its own diff, so drums never arrived
    // until the late "form" flip. When nothing is on but the target plays,
    // adopt the target's per-section drums so the kit can actually walk on.
    if(c.sections.some(s=>s.drums&&s.drums!=="off"))
      c.sections.forEach(s=>{if(s.drums&&s.drums!=="off"&&s.drums!=="kick")s.drums=t.genreMeta.kit;});
    else{ const tl=Math.max(1,t.sections.length);
      c.sections.forEach((s,i)=>{const ts=t.sections[i%tl]; if(ts&&ts.drums)s.drums=ts.drums;}); }}],
  ["bassline",c=>(c.sections.find(s=>s.bass&&s.bass!=="off")||{}).bass,
    (c,t)=>{const b=(t.sections.find(s=>s.bass&&s.bass!=="off")||{}).bass;
      if(b)c.sections.forEach(s=>{if(s.bass&&s.bass!=="off")s.bass=b;});}],
  ["lead line",c=>(c.sections.find(s=>s.melody&&s.melody!=="off")||{}).melody,
    (c,t)=>{const m=(t.sections.find(s=>s.melody&&s.melody!=="off")||{}).melody;
      if(m)c.sections.forEach(s=>{if(s.melody&&s.melody!=="off")s.melody=m;});}],
  ["harmony",c=>c.progression,(c,t)=>c.progression=t.progression],
  ["sample",c=>c.foundSources.map(s=>s.id).join(),
    (c,t)=>{const prev=c.foundSources;
      c.foundSources=deep(t.foundSources);
      // KEEP the sampler-zone wavs the CURRENT voices still reference: replacing
      // foundSources wholesale otherwise stripped the zones out from under a
      // just-introduced lead/pad/bass sampler, so ensureSamplerBufs found no
      // source, cached null forever, and the instrument went silent (Paul's
      // guitar dropping out after half a measure). Carry any missing zone source
      // over from the previous crate (or the target's).
      const have=new Set(c.foundSources.map(s=>s.id));
      const carry=(sp)=>{ if(!sp)return;
        for(const z of (sp.zones||[])) if(z.srcId&&!have.has(z.srcId)){
          const src=prev.find(s=>s.id===z.srcId)||(t.foundSources||[]).find(s=>s.id===z.srcId);
          if(src){c.foundSources.push(deep(src)); have.add(z.srcId);}}};
      for(const vk of ["pad","bass","melody"]) carry((c.instruments[vk]||{}).sampler);
      // …and the PLAYING KIT'S one-shots: the carry above covered only the
      // pitched voices, so the wholesale replace dropped the drum zone srcIds
      // (instruments.drums.*Sampler -> drum_<kit>_*) — the live engine then
      // pinned them null and every drum note skipped silently for the rest of
      // the set (the fugue->reggae total drum silence).
      const cD=c.instruments.drums||{};
      for(const k of Object.keys(cD)) if(/Sampler$/.test(k)&&cD[k]) carry(cD[k]);
      c.sections.forEach((s,i)=>{const ts=t.sections[i%t.sections.length];
        if(s.found&&ts&&ts.found)s.found=deep(ts.found);
        if(ts&&ts.hits)s.hits=deep(ts.hits); else delete s.hits;});}],
  ["form",c=>c.genreMeta.form,(c,t)=>{c.sections=deep(t.sections);Object.assign(c.genreMeta,{form:t.genreMeta.form,kit:t.genreMeta.kit});}],
];
// INSTRUMENT-INTRODUCTION HOLD (Paul: "if you introduce an instrument it lasts
// for a few measures at least"). A discrete flip that swaps a VOICE'S TIMBRE
// (its model / sampler / dx7 algorithm, or a drum piece's model) LOCKS that
// slot for HOLD_BARS measures before another discrete flip may replace it. Near
// two close stars the continuous blend weights used to re-pick the dominant
// genre every bar, re-queuing the same voice flip endlessly (rebuildQueue runs
// on every travel retarget) — so an instrument that had just walked on stage
// was yanked off a measure later (the "one half measure of guitar and no more"
// flicker). The hold is keyed by flip NAME in S.holdUntil, so it survives the
// per-bar queue rebuilds. A genre ARRIVAL (weights settling ~pure on a star)
// OVERRIDES every hold so a destination still sounds its real instruments.
const HOLD_BARS=4;
const HELD_FLIPS=new Set(["pad voice","bass voice","lead voice","kick","snare","hat"]);
const arrivedNow=()=>!!(S.weights[0]&&S.weights[0].w>=0.85);   // ~pure genre = a real arrival
// chyron-friendly lineup language for the glide flips ("journey: lead line"
// meant nothing to humans — narrate it like a band shuffling on stage)
const FLIP_PHRASES={
  "pad voice":"new hands on the pads",
  "bass voice":"bass player swaps rigs",
  "lead voice":"lead swaps axes",
  "kick":"fresh kick drum rolled in",
  "snare":"snare handoff",
  "hat":"hats change hands",
  "drum kit":"new drummer sits in",
  "bassline":"bass hands over",
  "lead line":"lead rewrites the hook",
  "harmony":"key change coming",
  "sample":"new crate on the decks",
  "form":"the set changes shape",
};
// FLIP-ORDER STABILITY (the fugue->reggae "form landed at bar 118 of 128" bug):
// travel retargets every bar, and every retarget rebuilt the queue with a NEW
// barCount-seeded shuffle — so the queue's head was a fresh random draw each
// bar and a dimension could starve for the whole journey ("form", the flip that
// revives an all-off genre's drum sections, landed in the last tenth of the
// trip; the listener parked at 99% reggae still heard harpsichord). Two rules
// replace the re-roll: (1) dimensions NEVER APPLIED this journey rank first, so
// each of the ~12 flips lands once before any dimension gets seconds; (2) the
// order within each rank is a stable per-seed hash — rebuilds stop reshuffling,
// so the queue's head survives the per-bar retarget churn. Pacing is untouched:
// still one flip per 2 bars (glideStep) — the fix is order, not speed.
let appliedFlips=new Map();   // flip name -> the TARGET's value signature when applied (revision detection)
// the flips a listener IDENTIFIES a genre by — first-timers among these lead
// the queue so a parked destination reads as itself within a few measures
const LEAD_FLIPS=new Set(["form","drum kit","lead voice"]);
// TRANSIT RE-TIER (Paul's "we hit dnb — it's loaded but the promised
// instruments don't show up; only the flute we had earlier"): appliedFlips is
// journey-scoped and a TRAVELING journey never converges, so ~24 bars in every
// dimension was tier 2 and the queue degenerated to one FIXED per-seed hash
// order. A crossed neighborhood's dwell (dnb: ~10 of 256 bars on the
// blues->industrial line) only ever executed the head few flips of that order —
// "lead voice"/"drum kit" ranked late NEVER fired again for the rest of the
// path, at ANY pace (dwell and approach scale together), so the first
// neighborhood's lead haunted every later genre. The applied-set is therefore
// per-DOMINANT-GENRE: when the nearest star changes, clear it — the new
// neighborhood's identity flips (form/kit/lead) re-enter tier 0 and land within
// ~6 bars of dominance, and flips scale with bars-in-neighborhood. Parked
// behavior is unchanged (dominant stable = the set accumulates exactly as
// before; holds still pace timbre swaps at boundaries).
// REVISION RE-TIER (the path simulator's "identity churn" finding): K.mix
// re-picks discrete identity dims (lead model etc.) as the blend weights
// sharpen mid-approach — the target's lead at w=0.5 isn't its lead at w=0.96.
// The revised dim used to re-queue at the BOTTOM tier behind the whole frozen
// already-applied set, waiting ~a full re-cycle (measured 12 mismatched bars,
// never re-converging, on the default loop's closing re-entry into disco). So
// appliedFlips now REMEMBERS the target's value it applied: a dim whose target
// CHANGED since application is a REVISION. A revised IDENTITY dim (LEAD_FLIPS
// — what a listener knows the genre by) re-enters right behind the
// never-applied identity dims: mid-approach the applied set was just cleared
// (new dominant), so the old bottom tier put a lead re-pick behind the ENTIRE
// never-applied queue (~8 dims x 2 bars). Revised non-identity dims rank
// after never-applied dims but above applied-and-current (stale re-applies
// last). The starvation guarantee holds: never-applied identity dims still
// go absolutely first (transit-arrival gate is the referee), and revision
// thrash is paced by the HELD_FLIPS hold window (4 bars per timbre slot),
// during which the queue's non-held dims keep flowing.
let lastDominant="";
const flipSig=(get,st)=>{try{return JSON.stringify(get(st));}catch(e){return "?";}};
export function rebuildQueue(){
  if(!S.playing||!S.target)return;
  const dom=(S.weights&&S.weights[0]&&S.weights[0].g)||"";
  if(dom!==lastDominant){ lastDominant=dom; appliedFlips.clear(); }
  const diffs=DISCRETE.filter(([n,get])=>flipSig(get,S.playing)!==flipSig(get,S.target));
  if(!diffs.length) appliedFlips.clear();   // converged: the next journey starts fresh
  const rank=n=>{let h=(S.seed>>>0)||1; for(const ch of n) h=(h*31+ch.charCodeAt(0))>>>0; return h;};
  // tiers: 0 never-applied identity dims, 1 REVISED identity dims (the target
  // re-picked what it already delivered), 2 never-applied rest, 3 revised
  // rest, 4 applied-and-current (the target still wants what we applied;
  // playing drifted via another flip's overlap — re-apply last).
  const tier=([n,get])=>{
    const revised=appliedFlips.has(n)&&appliedFlips.get(n)!==flipSig(get,S.target);
    if(LEAD_FLIPS.has(n)) return appliedFlips.has(n)?(revised?1:4):0;
    return appliedFlips.has(n)?(revised?3:4):2;
  };
  set({queue:diffs.slice().sort((a,b)=>(tier(a)-tier(b))||(rank(a[0])-rank(b[0])))});
}
export function glideStep(){
  const c=S.playing, t=S.target; if(!c||!t)return;
  const db=t.bpm-c.bpm;
  if(Math.abs(db)>0.5) c.bpm=Math.round((c.bpm+Math.sign(db)*Math.min(3,Math.abs(db)))*10)/10;
  c.keyOffset=t.keyOffset;
  for(const p of PATHS){
    const tv=getP(t,p); if(typeof tv!=="number")continue;
    let cv=getP(c,p); if(typeof cv!=="number")cv=tv;
    const nv=Math.abs(tv-cv)<1e-3?tv:cv+(tv-cv)*0.13;
    setP(c,p,p.endsWith("voices")?Math.round(nv):Math.round(nv*1e4)/1e4);
  }
  // CONTINUOUS patch morphing: when both ends carry the SAME FM topology on a
  // voice, lerp the ~144-dim dx7 param vector at the same ease — standing
  // mid-journey is a continuously morphing instrument (the live engine
  // re-applies changed dx7 params per bar; see faust/live.js applyDx7).
  // Different algorithm or one side missing stays a discrete "voice" flip.
  for(const vk of ["melody","pad","bass"]){
    const cd=(c.instruments[vk]||{}).dx7, td=(t.instruments[vk]||{}).dx7;
    if(!cd||!td||cd.algorithm!==td.algorithm||!cd.params||!td.params)continue;
    for(const k of Object.keys(td.params)){
      const tv=td.params[k]; if(typeof tv!=="number")continue;
      let cv=cd.params[k]; if(typeof cv!=="number")cv=tv;
      cd.params[k]=Math.abs(tv-cv)<1e-3?tv:Math.round((cv+(tv-cv)*0.13)*1e4)/1e4;
    }
  }
  c.foundSources.forEach((s,i)=>{const ts=t.foundSources[i]||t.foundSources[0];
    if(ts&&typeof ts.vol==="number") s.vol+=(ts.vol-s.vol)*0.13;});
  if(S.barCount%2===0&&S.queue.length){
    // apply the FIRST flip we're allowed to run now: a timbre flip whose voice
    // is still inside its hold window is skipped (left queued for later) UNLESS
    // we've arrived at a star, when destinations must sound right. Structural
    // flips (harmony/form/sample/…) are never held, so they always flow.
    const arrived=arrivedNow();
    const idx=S.queue.findIndex(([name])=>!HELD_FLIPS.has(name)||arrived||(S.holdUntil[name]||0)<=S.barCount);
    if(idx>=0){
      const [name,get,apply]=S.queue[idx];
      try{ apply(c,t);
        appliedFlips.set(name,flipSig(get,t));   // had its turn — remember WHAT the target wanted, so a later re-pick reads as a revision
        // a timbre just walked on stage — lock this slot for a few measures
        const hold=HELD_FLIPS.has(name)?{...S.holdUntil,[name]:S.barCount+HOLD_BARS}:S.holdUntil;
        set({queue:S.queue.filter((_,i)=>i!==idx),holdUntil:hold,status:FLIP_PHRASES[name]||("journey: "+name)}); }catch(e){}
    }
  }
  if(S.barCount%4===0) rescore();
  set({});   // re-render sliders/playhead
}
export function rescore(){
  if(!S.playing)return;
  const a=V.analyze(S.playing);
  set({scores:Object.entries(a.scores).sort((x,y)=>y[1]-x[1]).slice(0,5), best:a.best});
}

// ---------- path travel: the traveler IS the destination ----------
export function travelStep(){
  const n=S.waypoints.length;
  if(n<2)return;
  let {seg,t}=S.travel;
  // pace slider = bars per path leg (bigger = slower journey). Clamp hard so a
  // mangled input can never freeze the traveler (t must always advance).
  // Ceiling 4096 (2026-07-10): the blend-arrival fix made flips actually LAND,
  // so the old default read "way too fast" — default now 256 (world.js), and
  // the log-scale slider reaches 4096 bars/leg for hours-long journeys.
  const pace=Math.max(8,Math.min(4096,+S.pace||BARS_PER_SEG));
  t+=1/pace;
  // CLOSED LOOP (Paul: "the path should always close itself and be a loop"): the
  // path has n segments, seg n-1 being the CLOSING leg from waypoint[n-1] back to
  // waypoint[0]. seg wraps mod n, so on reaching the end the traveler continues
  // seamlessly into the closing leg and then back onto leg 0 — no stop, no jump,
  // BARS_PER_SEG pacing identical on every leg (the closing leg is just seg n-1).
  if(t>=1){ t=0; seg=(seg+1)%n; }
  if(seg>=n) seg=0;   // waypoints erased under us mid-step: clamp into range
  const a=S.waypoints[seg], b=S.waypoints[(seg+1)%n];
  const pt={x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t};
  set({travel:{seg,t}});
  retarget(pt);
}

// force a fresh retarget of the current cursor, clearing the last-signature cache
// so the glide queue rebuilds — used after the DX7 bank lands (see main.js boot).
export function forceRetarget(){ lastSig=""; retarget(S.cursor); }
