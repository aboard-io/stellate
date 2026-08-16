// targeting.js — the mix targeter and the glide engine. weightsAt() turns a point
// in the star map into a genre-weight blend; retarget() resolves that into an
// engine state (via K.mix) and either snaps (pre-LIVE) or queues a smooth glide
// (mid-performance). glideStep()/rebuildQueue() run the continuous morph + the
// discrete voice/section flips; travelStep() walks the drawn path leg by leg.
import { S, set, deep, K, V } from "../core/state.js";
import { POS, SNAP, CUTOFF, MODE_LOCKS, BARS_PER_SEG } from "../core/world.js";
import { faustHandle } from "./live.js";
import { legMetrics, paceSpeed } from "../core/share.js";   // constant-pace travel (distance/bar)

// ---------- weights / targeting ----------
export function weightsAt(pt){
  const ds=Object.entries(POS).map(([g,[x,y]])=>({g,d:Math.hypot(pt.x-x,pt.y-y)})).sort((a,b)=>a.d-b.d);
  const base=1/(CUTOFF*CUTOFF+80);
  let ws=ds.map(({g,d})=>({g,w:Math.max(0,1/(d*d+80)-base)})).filter(x=>x.w>0).slice(0,4);
  // VOID BLEND (was: hold the single NEAREST genre at 100% whenever fewer than two stars
  // clear the CUTOFF). Across a wide void that pinned ONE genre for the whole crossing — a
  // path drawn through empty space then played the SAME genre with no evolution for twenty
  // minutes at a stretch. Instead, when <2 stars are in range, keep at least the
  // nearest TWO (three) weighted by inverse-square with NO cutoff, so the APPROACHING star's
  // share grows continuously as you cross and the mix keeps shifting toward it. Only affects
  // sparse regions — a dense in-cloud path (the default loop) always has >=2 in range, so this
  // branch never fires there and its blend is unchanged.
  if(ws.length<2){
    ws=ds.slice(0,Math.min(3,ds.length)).map(({g,d})=>({g,w:1/(d*d+80)}));
  }
  const tot=ws.reduce((s,x)=>s+x.w,0)||1;
  ws=ws.map(x=>({g:x.g,w:x.w/tot}));
  if(!ws.length) ws=[{g:ds[0].g, w:1}];
  // CONTINUOUS snap-to-anchor, now GATED BY PROXIMITY: pull toward the nearest star by how
  // UNAMBIGUOUSLY nearest it is (the GAP to the 2nd over SNAP) — but only when you're actually
  // NEAR a star. On/near a star the gap is huge -> pure genre (unchanged); exactly between two
  // stars the gap -> 0 -> natural blend. The NEW `prox` term releases the pull out in a VOID:
  // across a wide empty region the gap is ALSO large, so the old gap-only snap pinned 100% for
  // the whole crossing (the static-for-hours bug). prox = 1 within CUTOFF of a star (near it,
  // behavior identical) fading to 0 by 2×CUTOFF (deep void -> the void-blend above governs and
  // keeps evolving). A dense in-cloud path stays within CUTOFF everywhere, so prox is 1 and the
  // snap is unchanged there. Weight sum stays 1 (the lerp is convex).
  const d0=ds[0].d, d1=ds[1]?ds[1].d:Infinity;
  const gap=Math.max(0,Math.min(1,(d1-d0)/SNAP));
  const prox=Math.max(0,Math.min(1,1-(d0-CUTOFF)/CUTOFF));
  const s=gap*prox;
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
export function retarget(pt, snap){
  return retargetWeights(weightsAt(pt), pt, snap);
}
// PURE state at a map point — the same blend K.mix retargetWeights builds (seed,
// key, ±bpm, mode lock) but WITHOUT touching the store. The offline whole-path
// exporter walks the loop and reads stateAt() per bar so "the whole mix" renders
// faithfully (the same per-bar walk the live conductors run) without playing it.
export function stateAt(pt){
  const weights=weightsAt(pt);
  const target=K.mix(weights.map(w=>({...w})),{seed:S.seed, keyOffset:keyFor(weights,S.seed)});
  if(S.bpmDelta) target.bpm=Math.max(40,Math.min(240,Math.round(target.bpm+S.bpmDelta)));
  if(MODE_LOCKS[S.modeLock]) target.progression=MODE_LOCKS[S.modeLock];
  return target;
}
// retarget from an EXPLICIT weight blend rather than a map point. The accessible
// text UI (access.html) drives the same glide engine this way — a listener who
// can't see the star map still gets byte-identical music for the same seed +
// blend. When `pt` is supplied the cursor is placed too (the map path); the
// accessible page omits it (there is no cursor to move). retarget() above is the
// map's caller and stays behavior-identical: weightsAt(pt) then this.
export function retargetWeights(weights, pt, snap){
  const target=K.mix(weights.map(w=>({...w})),{seed:S.seed, keyOffset:keyFor(weights,S.seed)});
  if(S.bpmDelta) target.bpm=Math.max(40,Math.min(240,Math.round(target.bpm+S.bpmDelta)));   // the ⚙ ±bpm delta rides every target
  if(MODE_LOCKS[S.modeLock]) target.progression=MODE_LOCKS[S.modeLock];
  const patch={weights,target};
  if(pt) patch.cursor=pt;
  // before LIVE (or after STOP) the cursor PLACES you — the playing state IS the
  // target. Only mid-performance do we glide instead of jump. EXCEPT `snap` (a
  // playhead SCRUB — move it and that is where things play) which jumps the
  // audio to the scrubbed spot immediately, so it doesn't slow-glide back.
  if(!S.playing||!S.live||snap){ patch.playing=deep(target); patch.queue=[]; }
  set(patch);
  // REBUILD ON WHAT THE QUEUE IS ABOUT, not on a proxy for it. This keyed the
  // rebuild on the WEIGHT BLEND quantized to 5% buckets — but K.mix draws a fresh
  // target every bar from the FULL-PRECISION weights, so it can re-pick a lead,
  // a kit or a form while the quantized blend sits still. When that happened the
  // queue was never rebuilt: it drained to empty, `S.queue.length` read 0, and
  // the app believed it had converged while the target wanted something else.
  // Traced on the default loop at seed 43: entering sequinfreight the target's
  // lead went brass_section -> fm at bar 311 with an EMPTY queue, and the playing
  // lead stayed brass_section for the next 17 bars until the blend finally moved
  // 5% — the whole of that segment's identity churn, and the reason
  // test/unit/simulate-path.test.js check 5a never converged.
  // The signature is the target's OWN discrete dims (exactly what rebuildQueue
  // diffs) plus the dominant genre, whose change resets appliedFlips. Same
  // coalescing intent, no blind spot: a target that re-picks anything the queue
  // can act on always enqueues it. Per-dim it is wantSig — DEBOUNCED for
  // applied dims (see REVISION DEBOUNCE at rebuildQueue) — so a 1-bar flap
  // never triggers a rebuild, and a re-pick that MATURES (kept disagreeing
  // with the applied value through its debounce window) still does.
  ageDimSigs(target);
  const sig=DISCRETE.map(([n,get])=>wantSig(n,get)).join("|")+"|"+
    ((weights[0]&&weights[0].g)||"")+"|"+S.modeLock;
  if(sig!==lastSig){ lastSig=sig; rebuildQueue(); }
  // 1.6: pre-voice the TARGET while the glide is still in flight — the engine
  // builds the destination's worklets through its airlock (stopped, stashed)
  // so arrival costs zero instantiation inside the render window. Best-effort
  // and coalescing (travelStep retargets every bar; the engine keeps only the
  // latest target).
  if(S.live&&faustHandle&&faustHandle.prepare){ try{ faustHandle.prepare(target); }catch(e){} }
}
// (There are no macros and no setMacro/resetMacros. The kernel's applyMacros
// machinery stays; no caller passes opts.macros, and absent macros resolve
// byte-identically.)

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
  // silently (a fugue->reggae flip measured NO DRUMS — 0/233 note() calls).
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
  // THE CRATE — and the INDEX INTO IT. `samplerLib` is the map forceSampled
  // resolves a voice through when the voice carries no state-level sampler of its
  // own (state-engine: lib[pickSampledId(role, model, seed, genre)]), and it was
  // in no flip at all. That did not show while every state was built under the
  // same soundfont, because the lib was always equivalent. Under the 32-bar font
  // ROTATION it is the whole difference: the target's lib holds the new font's
  // zones and the playing state kept the old one, so the set changed fonts and
  // the audio did not — measured, identical voiced units across fluidr3, sgm and
  // minimoog. The crate and the index into it belong to the same flip, so it
  // rides here, and the signature covers both.
  ["sample",c=>c.foundSources.map(s=>s.id).join()+"|"+Object.keys(c.samplerLib||{}).length+"|"+
    ((Object.values(c.samplerLib||{})[0]||{}).zones||[{}])[0].srcId,
    (c,t)=>{const prev=c.foundSources;
      c.foundSources=deep(t.foundSources);
      if(t.samplerLib) c.samplerLib=deep(t.samplerLib);
      // KEEP the sampler-zone wavs the CURRENT voices still reference: replacing
      // foundSources wholesale otherwise stripped the zones out from under a
      // just-introduced lead/pad/bass sampler, so ensureSamplerBufs found no
      // source, cached null forever, and the instrument went silent — the
      // guitar dropping out after half a measure. Carry any missing zone source
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
  ["form",c=>c.genreMeta.form,(c,t)=>{c.sections=deep(t.sections);Object.assign(c.genreMeta,{form:t.genreMeta.form,kit:t.genreMeta.kit});
    // the new shape DECLARES found parts (sections' found/hits/vox/vocal
    // sourceIds) but the crate rides the separate "sample" flip — and the
    // revision debounce can hold that flip at an older crate while form
    // chases, so the skew is a SETTLEABLE state now, not a transit blink
    // (seed 91, toastercore: queue empty with a declared bed the crate
    // lacked — buildEvents' srcById misses, zero found events, a musicality
    // hard fail the committed tree didn't have). Carry the sources this
    // form's sections reference, the way "drum kit" carries its zone wavs.
    const have=new Set((c.foundSources||[]).map(s=>s.id));
    for(const s of c.sections)
      for(const id of [s.found&&s.found.sourceId,s.hits&&s.hits.sourceId,s.vox&&s.vox.sourceId,s.vocal])
        if(id&&!have.has(id)){ const src=(t.foundSources||[]).find(x=>x.id===id);
          if(src){ c.foundSources.push(deep(src)); have.add(id); } }}],
];
// INSTRUMENT-INTRODUCTION HOLD: an instrument that gets introduced lasts for at
// least a few measures. A discrete flip that swaps a VOICE'S TIMBRE
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
// TRANSIT RE-TIER. Crossing into a genre whose instruments are loaded but never
// show up — you keep the flute you already had — happens because appliedFlips is
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
// REVISION DEBOUNCE (simulate-path check 5a, round two — the revision re-tier
// alone did not converge). In a LOW-DOMINANCE neighborhood (w0 creeping through
// 0.5–0.7, never the 0.85 arrival override) K.mix sits on a pick boundary and
// the target's discrete dims FLAP bar to bar — traced at seed 17 entering
// shibuyakei, the target's lead went distortion_guitar → glockenspiel →
// bell → … → glockenspiel → crunch_guitar while w0 slid 0.52→0.50, and the kit
// boombap → full → breaks. Every 1-bar flap became a tier-1 revision competing
// for the one-flip-per-2-bars slot ("form" flapped in and out of the diff and
// stole two apply slots), so playing trailed the flapping target 9 consecutive
// bars against the 8-bar allowance. The queue was CHASING noise: a re-pick the
// target abandons a bar later should never cost a flip slot.
// So a REVISION only becomes actionable once the target has DISAGREED with the
// applied value for REV_STABLE consecutive bars. The aging is on the
// DISAGREEMENT, not on the raw signature holding one value: a first cut that
// waited for the raw sig to sit still failed the other way (seed 99,
// velourregatta) — the drum-kit signature bundles the kit name with its
// sampler zone ids, and the ids kept moving while the kit name sat on a real
// re-pick, so "stable" never matured and a genuine kit revision waited 12 bars
// at the bottom tier. A target that flaps AWAY-and-back inside the window is
// never chased (playing holds the applied identity); a target that stays away
// — even flapping among alternatives — is chased at its instantaneous value
// after REV_STABLE bars. Never-applied dims read the raw signature with no
// delay — a genre ARRIVAL (dominant change clears appliedFlips) is
// debounce-free, so the arrival contract is untouched.
// Two debounce speeds, split by what the re-pick IS (measured, both directions
// wrong with one speed): a WANDER (seed 196, punk — the target's lead walked
// bell → glockenspiel → vibraphone → crunch through a 20-bar low-dominance
// creep) must be chased fast or playing trails the walk 11 bars; a FLAP
// (seed 17, shibuyakei — form oscillating A↔B every 2-3 bars while w0 sat
// flat at 0.685) must NOT be chased or every half-cycle burns an apply slot.
// The discriminator is where the re-pick points: BACK to the value applied
// immediately before the current one is a flap (REV_FLAP bars to act — longer
// than the observed 2-3-bar half-cycles, so an oscillation is chased at most
// once and then held); anywhere new is a wander (REV_STABLE bars).
const REV_STABLE=2, REV_FLAP=4;
let dimDiv=new Map();    // flip name -> consecutive bars the target has differed from the applied value
let prevApplied=new Map();   // flip name -> the applied value BEFORE the current one (flap-back detection)
let lastAgeBar=-1;
function ageDimSigs(target){
  const bar=S.barCount|0, bump=bar!==lastAgeBar; lastAgeBar=bar;
  for(const [n,get] of DISCRETE){
    const applied=appliedFlips.get(n);
    if(applied===undefined||flipSig(get,target)===applied) dimDiv.set(n,0);
    else if(bump||!dimDiv.get(n)) dimDiv.set(n,(dimDiv.get(n)||0)+1);
  }
}
// what the queue should aim a dim at: never-applied dims (arrival) take the
// target as it stands; applied dims chase a re-pick only once it has persisted
// its debounce window — until then the applied value stands and the dim reads
// as current
const wantSig=(n,get)=>{
  const applied=appliedFlips.get(n);
  if(applied===undefined) return flipSig(get,S.target);
  const raw=flipSig(get,S.target);
  const need=raw===prevApplied.get(n)?REV_FLAP:REV_STABLE;
  return (dimDiv.get(n)||0)>=need?raw:applied;
};
export function rebuildQueue(){
  if(!S.playing||!S.target)return;
  const dom=(S.weights&&S.weights[0]&&S.weights[0].g)||"";
  if(dom!==lastDominant){ lastDominant=dom; appliedFlips.clear(); prevApplied.clear(); }
  const diffs=DISCRETE.filter(([n,get])=>flipSig(get,S.playing)!==wantSig(n,get));
  // converged (against the RAW target, so a mid-flap moment can't fake it):
  // the next journey starts fresh
  if(!DISCRETE.some(([n,get])=>flipSig(get,S.playing)!==flipSig(get,S.target))){
    appliedFlips.clear(); prevApplied.clear();
  }
  const rank=n=>{let h=(S.seed>>>0)||1; for(const ch of n) h=(h*31+ch.charCodeAt(0))>>>0; return h;};
  // tiers: 0 never-applied identity dims, 1 identity dims that MISMATCH after
  // application — revised by the target OR clobbered by another flip's overlap
  // (seed 99, velourregatta: "form" bundles genreMeta.kit, so applying it
  // erased the drum-kit flip's work; the old applied-and-current tier 4 then
  // parked an audible kit mismatch behind six cosmetic flips for 11 bars — an
  // identity dim in the diffs is wrong OUT LOUD no matter whose fault the
  // drift is), 2 never-applied rest, 3 revised rest, 4 applied-and-current
  // rest (the target still wants what we applied; playing drifted via
  // overlap — re-apply last).
  const tier=([n,get])=>{
    if(LEAD_FLIPS.has(n)) return appliedFlips.has(n)?1:0;
    const revised=appliedFlips.has(n)&&appliedFlips.get(n)!==wantSig(n,get);
    return appliedFlips.has(n)?(revised?3:4):2;
  };
  set({queue:diffs.slice().sort((a,b)=>(tier(a)-tier(b))||(rank(a[0])-rank(b[0])))});
  // diagnosis tap, off unless a rider defines the array: the queue's tiers /
  // applied set / divergence ages are module-private, and both churn hunts
  // needed them per bar (tools/audit/simulate-path.js --rows sees only S.queue)
  if(typeof window!=="undefined"&&window.__GLIDE_TRACE)
    window.__GLIDE_TRACE.push({bar:S.barCount,dom,applied:[...appliedFlips.keys()],
      div:Object.fromEntries(dimDiv),queue:S.queue.map(f=>f[0]+":"+tier(f))});
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
  // re-applies changed dx7 params per bar — faust/stream-renderer.js feedBar,
  // "DX7 CARTRIDGE GLIDE"; the render lives in the worker, so that is the only
  // place the morph can land).
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
  // CADENCE: mid-transit a flip lands every OTHER bar (the listener hears a
  // band changing over, not a hard cut) — first-arrival pacing is untouched.
  // Two cases land EVERY bar instead: at a star (w0>=0.85, the same arrival
  // override that bypasses the timbre holds — the destination must sound
  // right, and during the sharpening approach the target legitimately
  // re-picks all three identity dims as w0 climbs 0.5→1.0: seed 99, punk,
  // form/kit/lead each re-picked twice, so the half-rate cadence alone was an
  // 11-bar convergence floor), and an identity REVISION at the queue's head
  // (the neighborhood already introduced itself and now plays the WRONG
  // identity — repair must not queue behind the half-rate pace it was
  // designed to be heard through).
  if(S.queue.length){
    // apply the FIRST flip we're allowed to run now: a timbre flip whose voice
    // is still inside its hold window is skipped (left queued for later) UNLESS
    // we've arrived at a star, when destinations must sound right. Structural
    // flips (harmony/form/sample/…) are never held, so they always flow.
    const arrived=arrivedNow();
    const idx=S.queue.findIndex(([name])=>!HELD_FLIPS.has(name)||arrived||(S.holdUntil[name]||0)<=S.barCount);
    const fast=arrived||(idx>=0&&LEAD_FLIPS.has(S.queue[idx][0])&&appliedFlips.has(S.queue[idx][0]));
    if(idx>=0&&(S.barCount%2===0||fast)){
      const [name,get,apply]=S.queue[idx];
      try{ apply(c,t);
        const before=appliedFlips.get(name);
        if(before!==undefined) prevApplied.set(name,before);   // flap-back memory (wantSig)
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
  const { n, legs }=legMetrics();
  if(n<2)return;
  let {seg,t}=S.travel; seg=((seg%n)+n)%n;
  // CONSTANT PACE: the playhead always moves at a constant pace, and the
  // distance between nodes doesn't matter. Advance a fixed DISTANCE —
  // paceSpeed() world-units (= PACE_REF/pace) — along the perimeter each bar, not
  // a fixed FRACTION of the leg, so long and short legs are crossed at the same
  // speed and a loop's duration tracks only its total length. Carry across leg
  // boundaries (a bar's step can span a whole short leg); the guard stops a
  // degenerate tiny-path/huge-speed case from spinning. The closing leg (n-1 -> 0)
  // is just another leg, so the loop stays seamless.
  let d=(legs[seg]>1e-6 ? t*legs[seg] : 0) + paceSpeed();
  let guard=0;
  while(d>=legs[seg] && guard++<n+2){ d-=legs[seg]; seg=(seg+1)%n; }
  t = legs[seg]>1e-6 ? Math.min(1, d/legs[seg]) : 0;
  const a=S.waypoints[seg], b=S.waypoints[(seg+1)%n];
  const pt={x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t};
  set({travel:{seg,t}});
  retarget(pt);
}

// force a fresh retarget of the current cursor, clearing the last-signature cache
// so the glide queue rebuilds — used after the DX7 bank lands (see main.js boot).
export function forceRetarget(){ lastSig=""; retarget(S.cursor); }
