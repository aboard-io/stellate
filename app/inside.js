// inside.js — "INSIDE THE SOUND": the ⓘ readout. Three reads off the SAME live
// state the engine is voicing (blend / feel radar / voice timeline), plus the
// note feed that fires DemoLayer.note(ev) at each note onset. All pure/read-only
// (no Math.random) so it's identical in the headless gate and to the audio.
import { S, K, esc } from "./state.js";
import { faustHandle } from "./live.js";

// ---------- INSIDE THE SOUND: live "what's in this mix" readout ----------
// Three reads off the SAME live state the engine is voicing, recomputed cheaply
// every frame (pure, read-only, no Math.random — identical in the headless gate):
//   1. BLEND — the genres the traveler's point is a mixture of (S.weights), each
//      with its genre-kernel label (K.GENRES[g].label) + the dominant's blurb.
//   2. FEEL — six perceptual axes normalised 0..1 from S.playing's resolved
//      numeric feel-params, drawn as a morphing radar.
//   3. ROSTER — the instruments ACTUALLY voiced: pitched voices resolved through
//      the SAME sampled-by-default mapping the engine uses (FaustStateEngine
//      .pickSampledId → K.SAMPLERS[id].label), signature synths named as
//      themselves, plus the drum kit.
const SIG_SYNTH={ tb303:"303 acid bass", acid:"acid bass", reese:"Reese bass",
  wobble:"wobble bass", synclead:"sync lead", modeld:"Minimoog lead", vocoder:"vocoder / robot choir" };
const cleanLabel=s=>String(s||"").replace(/\s*\((?:FluidR3|NOAA|PD|CC|US-gov|\+\d)[^)]*\)/gi,"").replace(/\s*—.*$/,"").replace(/\s*\+\d+dB.*$/,"").trim();
const titleCase=s=>String(s||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()).trim();
const clamp01=v=>v<0?0:v>1?1:v;
// a stable neon hue per genre name (FNV hash → 0..360): a genre reads the same
// colour in the blend bar, the radar accents and the on-map glyph.
function genreHue(g){ let h=2166136261>>>0; const s=String(g);
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0)%360; }
const genreCol=(g,l)=>`hsl(${genreHue(g)} 78% ${l==null?62:l}%)`;
// resolved display name for a pitched voice — mirrors state-engine forceSampled:
// signature synths stay named as synths; everything else resolves to the SF2
// sampled instrument the engine will actually build for this (role,model,seed).
function voiceName(role,m,st){
  m=m||{};
  if(m.model&&SIG_SYNTH[m.model]) return SIG_SYNTH[m.model];
  if(m.model==="sampler"&&m.sampler&&K.SAMPLERS[m.sampler.id]) return cleanLabel(K.SAMPLERS[m.sampler.id].label);
  if(st.sampledOnly&&st.samplerLib&&window.FaustStateEngine&&FaustStateEngine.pickSampledId){
    try{ const id=FaustStateEngine.pickSampledId(role,m.model,st.seed);
      if(K.SAMPLERS[id]) return cleanLabel(K.SAMPLERS[id].label); }catch(e){}
  }
  if(m.dx7) return "DX7 "+(m.dx7.name?m.dx7.name.trim():"patch");
  return titleCase(m.model||role);
}
// six perceptual FEEL axes, each normalised 0..1 from S.playing. Ranges track the
// panel's own DIMS sliders where one exists; brightness/density are documented
// proxies (no single kernel param carries them):
function feelAxes(st){
  const I=st.instruments||{}, mel=I.melody||{}, pad=I.pad||{}, D=I.drums||{}, L=Math.log2;
  const tempo=clamp01(((st.bpm||110)-50)/130);                 // DIMS bpm 50..180
  const swing=clamp01((st.swing||0)/0.45);                     // DIMS swing 0..0.45
  // BRIGHTNESS proxy: no "brightness" param, so log-blend the resolved lead+pad
  // lowpass cutoffs (the timbral tilt the ear reads as bright) with the master
  // high-shelf; each mapped log2 400Hz(dark)→10kHz(bright), weighted to the lead.
  const cutN=hz=>clamp01((L(Math.max(200,hz||400))-L(400))/(L(10000)-L(400)));
  const hc=(st.tone&&st.tone.highcut); const hcHz=hc?hc:12000;   // highcut 0 = no roll-off = full bright
  const bright=clamp01(0.55*cutN(mel.cutoff)+0.25*cutN(pad.cutoff)+0.20*cutN(hcHz));
  const space=clamp01(0.75*(((st.reverb||0.3)-0.3)/0.65)+0.25*clamp01((mel.send||0)/0.5));  // DIMS reverb .3..0.95 + lead send
  // DRIVE: how squashed/dirty — sidechain pump + buss glue comp + saturation grit.
  const drive=clamp01((clamp01((st.pump||0)/0.8)+clamp01((st.comp||0)/0.9)+clamp01((st.grit||0)/0.8))/3);
  // DENSITY proxy: drum activity (kick+snare+hat level, 0 if the kit is off) +
  // melodic polyphony (voices) + how many engine layers are actually voiced.
  const kitOn=!!(st.genreMeta&&st.genreMeta.kit&&st.genreMeta.kit!=="off");
  const drumAmt=kitOn?clamp01(((D.kick||0)+(D.snare||0)+(D.hat||0))/3.5):0;
  const voiceAmt=clamp01((mel.voices||1)/8);
  let layers=0; if((pad.level||0)>0.05)layers++; if(I.bass)layers++; if(I.melody)layers++;
  if(kitOn)layers++; if((st.foundSources||[]).some(s=>(s.vol||0)>0.02))layers++;
  const density=clamp01(0.45*drumAmt+0.25*voiceAmt+0.30*(layers/5));
  return [["tempo",tempo],["swing",swing],["bright",bright],["space",space],["drive",drive],["density",density]];
}
// per-voice EFFECTS for a roster line, read off the built voice unit: prefer the
// audio layer's descriptor (unit.fxLabels — short strings like "HPF 250"/"plate
// 20%"), fall back to the insert-chain types (distort/phaser/chorus/…), else none.
function voiceFx(unit){
  if(!unit) return [];
  if(Array.isArray(unit.fxLabels)&&unit.fxLabels.length) return unit.fxLabels.slice(0,6).map(String);
  if(Array.isArray(unit.inserts)&&unit.inserts.length) return unit.inserts.map(i=>i.type);
  return [];
}
// GLOBAL / master-bus effects. Prefer SE.fxLabels(state) or SE.fxParams(state)
// .fxLabels when the audio layer exposes them; else summarise the bus fx off the
// resolved state (reverb type+amount, saturation grit, master comp, pump, crackle).
function masterFx(st){
  try{ const SE=window.FaustStateEngine;
    if(SE){
      if(typeof SE.fxLabels==="function"){ const l=SE.fxLabels(st); if(Array.isArray(l)&&l.length) return l.map(String); }
      const fp=SE.fxParams&&SE.fxParams(st); if(fp&&Array.isArray(fp.fxLabels)&&fp.fxLabels.length) return fp.fxLabels.map(String);
    } }catch(e){}
  const out=[], pc=v=>Math.round(v*100);
  out.push((st.reverbColor?st.reverbColor+" ":"")+"reverb "+pc(st.reverb!=null?st.reverb:0)+"%");
  if((st.comp||0)>0.02) out.push("comp "+pc(st.comp));
  if((st.grit||0)>0.02) out.push("saturation "+pc(st.grit));
  if((st.pump||0)>0.02) out.push("pump "+pc(st.pump));
  if((st.crackle||0)>0.02) out.push("crackle "+pc(st.crackle));
  const d=st.delay; if(d&&(d.beats||d.feedback)) out.push("delay");
  return out;
}
// ---------- VOICE TIMELINE: the per-bar piano-roll of what each voice plays ----
// Reconstruct ONE chord-bar of engine events for state `st`, mirroring faust/
// live.js stepWalk so the timeline + the DemoLayer note feed read the SAME
// events the engine voices: single active section, the per-bar seed
// (seed + serial*7919), window [ci*cb, ci*cb+cb). Pure/deterministic — no
// Math.random — so it's stable in the headless gate and identical to the audio.
const freqToMidi=hz=>hz>0?Math.round(69+12*Math.log2(hz/440)):0;
// unit key (mapEvents) -> a coarse voice ROLE for lanes + the DemoLayer contract.
function noteRole(unit){
  if(unit==="melody") return "melody";
  if(unit.indexOf("solo:")===0) return "solo";
  if(unit==="pad"||unit==="bass") return unit;
  if(unit==="kick"||unit==="snare"||unit==="hat"||unit==="tom") return "drums";
  if(unit==="stab"||unit==="sfx") return "sfx";
  return unit;
}
let _barMemo={st:null,ci:-1,serial:-1,sec:"",val:null};
function barVoiceEvents(st, bar){
  const E=window.CsdEngine, SE=window.FaustStateEngine;
  const CBEATS=Math.max(2,Math.round((st&&st.chordEvery)||8));
  const spb=60/((st&&st.bpm)||110);
  if(!E||!SE||!st) return {cbeats:CBEATS, spb, bpm:(st&&st.bpm)||110, notes:[]};
  const ci=(bar&&bar.ci!=null)?bar.ci:0, serial=(bar&&bar.serial!=null)?bar.serial:0;
  const secName=(bar&&bar.section)||"";
  if(_barMemo.st===st&&_barMemo.ci===ci&&_barMemo.serial===serial&&_barMemo.sec===secName) return _barMemo.val;
  const one=Object.assign({},st,{ seed:((st.seed||1)+serial*7919)>>>0,
    instrumentSeed: st.instrumentSeed!=null?st.instrumentSeed:(st.seed||1) });   // mirror live.js makeWalk: instrument identity = song seed
  const secs=(st.sections&&st.sections.length)?st.sections:null;
  if(secs){ const sec=(secName&&secs.find(s=>s.name===secName))||secs[0];
    one.sections=[Object.assign({},sec,{cycles:1})]; }
  const lo=ci*CBEATS, hi=lo+CBEATS, notes=[];
  try{
    const ev=E.buildEvents(one), units=SE.voiceUnits(E,one);
    const m=SE.mapEvents(E,one,ev,{lo,hi,units});
    for(const e of m.events){
      const freq=(e.sets&&e.sets.freq)||0;
      const vel=e.amp!=null?e.amp:(e.sets&&(e.sets.gain!=null?e.sets.gain:e.sets.level!=null?e.sets.level:0.5));
      notes.push({ role:noteRole(e.unit), unit:e.unit, beat:e.beat-lo, durB:Math.max(0.03,e.durB||0.1),
        midi:freqToMidi(freq), freq, vel:clamp01(vel), drum:!!e.drum });
    }
    for(const f of (m.found||[])){   // found CHOPS are onsets; beds are texture (skipped from the note feed)
      if(f.type!=="chop") continue;
      notes.push({ role:"found", unit:"found", beat:f.beat-lo, durB:Math.max(0.03,f.durB||0.12),
        midi:0, freq:0, vel:clamp01(f.amp!=null?f.amp:0.5), drum:true });
    }
  }catch(e){}
  const val={cbeats:CBEATS, spb, bpm:one.bpm, notes};
  _barMemo={st, ci, serial, sec:secName, val};
  return val;
}
// assemble timeline LANES: one per voice (pad/bass/lead/solo/drums/found), each
// carrying the roster's instrument NAME + fx chips and this bar's note events.
// A lane shows whenever the instrument is voiced (roster) OR it has notes this bar.
function timelineLanes(st, roster, found, bar, audit){
  const by={}; roster.forEach(r=>by[r.role]=r);
  const specs=[
    {key:"pad",    from:"pad",  label:"pad",     col:"--purple", roles:["pad"]},
    {key:"bass",   from:"bass", label:"bass",    col:"--cyan",   roles:["bass"]},
    {key:"melody", from:"lead", label:"lead",    col:"--pink",   roles:["melody","sfx"]},
    {key:"solo",   from:"lead", label:"counter", col:"--amber",  roles:["solo"]},
    {key:"drums",  from:"kit",  label:"drums",   col:"--mint",   roles:["drums"]},
    {key:"found",  from:null,   label:"found",   col:"--cyan",   roles:["found"]},
  ];
  const lanes=[];
  for(const sp of specs){
    const notes=bar.notes.filter(n=>sp.roles.indexOf(n.role)>=0);
    const r=sp.from?by[sp.from]:null;
    const has=r||notes.length||(sp.key==="found"&&found.length);
    if(!has) continue;
    const name=r?r.name:(sp.key==="found"?(found[0]||"field texture"):sp.label);
    // AUDIT-TRUTH: this lane's role was EXPECTED-BUT-SILENT in the measured audit for
    // this bar (not just the score) → paint it red/hatched with the probable reason.
    let sil=null;
    if(audit) for(const rl of sp.roles){ if(audit[rl]){ sil=audit[rl]; break; } }
    lanes.push({ key:sp.key, label:sp.label, name, col:sp.col, fx:r?(r.fx||[]):[],
      notes, drumLane:sp.key==="drums"||sp.key==="found",
      silent:!!sil, silReason:sil?sil.reason:null, silMissing:sil?(sil.missing||[]):[] });
  }
  return lanes;
}
export function vizData(){
  const st=S.playing;
  const blend=(S.weights||[]).slice().sort((a,b)=>b.w-a.w).slice(0,4)
    .map(w=>({g:w.g, label:(K.GENRES[w.g]&&K.GENRES[w.g].label)||titleCase(w.g), pct:Math.round(w.w*100), w:w.w}));
  if(!st) return {blend, feel:[], roster:[], found:[], info:"", master:[], timeline:{cbeats:8,spb:0.5,bpm:110,lanes:[]}};
  const I=st.instruments||{}, roster=[];
  // build the voice units so we can read each instrument's resolved fx chain
  let U=null; try{ if(window.FaustStateEngine&&window.CsdEngine) U=FaustStateEngine.voiceUnits(CsdEngine,st); }catch(e){}
  if(I.pad) roster.push({role:"pad", name:voiceName("pad",I.pad,st), fx:voiceFx(U&&U.pad)});
  if(I.bass) roster.push({role:"bass", name:voiceName("bass",I.bass,st), fx:voiceFx(U&&U.bass)});
  if(I.melody) roster.push({role:"lead", name:voiceName("melody",I.melody,st), fx:voiceFx(U&&U.melody)});
  if(I.drums&&st.genreMeta&&st.genreMeta.kit&&st.genreMeta.kit!=="off"){
    const df=[]; for(const dk of ["kick","snare","hat"]) for(const x of voiceFx(U&&U[dk])) if(!df.includes(x)) df.push(x);
    roster.push({role:"kit", name:titleCase(st.genreMeta.kit)+" kit", fx:df});
  }
  const found=(st.foundSources||[]).filter(s=>(s.vol||0)>0.02).map(s=>cleanLabel(s.label)||s.id).slice(0,2);
  const dom=blend[0], info=dom&&K.GENRES[dom.g]?K.GENRES[dom.g].info:"";
  const bar=barVoiceEvents(st, S.barInfo);
  // AUDIT-TRUTH: pull the measured expected-vs-actual audit for the bar currently heard
  // (keyed by serial) and reduce it to a role→{reason,missing} map for silent-lane paint.
  let auditSilent=null;
  try{
    if(faustHandle&&faustHandle.auditFor&&S.barInfo&&S.barInfo.serial!=null){
      const a=faustHandle.auditFor(S.barInfo.serial);
      if(a&&a.anomalies&&a.anomalies.length){ auditSilent={};
        for(const an of a.anomalies) if(!auditSilent[an.role]) auditSilent[an.role]={reason:an.reason,missing:an.missing||[]}; }
    }
  }catch(e){}
  const timeline={cbeats:bar.cbeats, spb:bar.spb, bpm:bar.bpm, lanes:timelineLanes(st, roster, found, bar, auditSilent), audit:auditSilent};
  return {blend, feel:feelAxes(st), roster, found, info, master:masterFx(st), timeline};
}
window.__VIZ={ data:()=>vizData() };   // headless gate: read the live viz content
// ---------- note feed → the demoscene layer ----------
// While LIVE, fire DemoLayer.note(ev) at each note's wall-clock ONSET so the wasm
// demos react to the music. Same per-bar events the timeline draws, scheduled off
// the bar's audio-clock downbeat (info.when + beat*spb). Guarded: a silent no-op
// unless the demoscene layer is present AND enabled — no wasted work when it's off.
let noteTimers=[];
export function clearNoteTimers(){ for(const t of noteTimers) clearTimeout(t); noteTimers=[]; }
export function scheduleBarNotes(info){
  if(!(window.DemoLayer&&DemoLayer.enabled&&DemoLayer.enabled()&&DemoLayer.note)) return;
  if(!S.live||!info||!faustHandle) return;
  let now=0; try{ now=faustHandle.ctx.currentTime; }catch(e){ return; }
  const spb=info.spb||(60/((S.playing&&S.playing.bpm)||110));
  const bar=barVoiceEvents(S.playing, info);
  for(const n of bar.notes){
    const delayMs=((info.when+n.beat*spb)-now)*1000;   // ms until this note's onset
    if(delayMs<-30) continue;                           // already passed this bar
    const ev={ role:n.role, midi:n.midi, freq:n.freq, vel:n.vel, durSec:n.durB*spb, section:info.section };
    noteTimers.push(setTimeout(()=>{ try{ if(S.live&&DemoLayer.enabled&&DemoLayer.enabled()&&DemoLayer.note) DemoLayer.note(ev); }catch(e){} }, Math.max(0,delayMs)));
  }
  if(noteTimers.length>2000) noteTimers=noteTimers.slice(-1000);   // bound the pending list on a long ride
}
// the FEEL radar as an SVG string — grid rings, spokes, axis labels, morphing
// neon value polygon. Small element count; rebuilt only while the modal is open.
function radarSVG(feel){
  if(!feel.length) return "";
  const cx=104, cy=100, R=74, n=feel.length;
  const ang=i=>-Math.PI/2+i*2*Math.PI/n, pt=(i,r)=>[cx+Math.cos(ang(i))*R*r, cy+Math.sin(ang(i))*R*r];
  const ring=r=>feel.map((_,i)=>pt(i,r).map(v=>v.toFixed(1)).join(",")).join(" ");
  let grid="";
  for(const r of [0.33,0.66,1]) grid+=`<polygon points="${ring(r)}" fill="none" stroke="var(--line2)" stroke-width="1" opacity="${r===1?0.55:0.26}"/>`;
  feel.forEach(([name],i)=>{ const [ex,ey]=pt(i,1), [lx,ly]=pt(i,1.26);
    grid+=`<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="var(--line2)" stroke-width="1" opacity="0.3"/>`;
    grid+=`<text x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" text-anchor="middle" class="rax">${name}</text>`; });
  const vpts=feel.map(([,v],i)=>pt(i,Math.max(0.02,v)).map(x=>x.toFixed(1)).join(",")).join(" ");
  const dots=feel.map(([,v],i)=>{ const [vx,vy]=pt(i,Math.max(0.02,v)); return `<circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="2.2" fill="var(--cyan)"/>`; }).join("");
  const poly=`<polygon points="${vpts}" fill="rgba(255,110,199,.18)" stroke="var(--pink)" stroke-width="1.7"/>`;
  return `<svg viewBox="0 0 208 212" class="radar" preserveAspectRatio="xMidYMid meet">${grid}${poly}${dots}</svg>`;
}
// the VOICE TIMELINE as HTML: a lane per voice, note events drawn as absolutely
// positioned blocks in a beat-gridded roll. x = onset (beat/cbeats), width =
// duration; melodic lanes map PITCH to y (high notes ride high), drum/found lanes
// stack each hit type on its own row. Block opacity = velocity. All CSS/HTML (no
// SVG) so it stays crisp, responsive and cheap to rebuild every frame.
const DRUM_ROW={ hat:0.10, tom:0.34, snare:0.52, kick:0.76, found:0.5 };
function laneBlocks(L, cb){
  const col=`var(${L.col})`;
  if(L.drumLane){
    return L.notes.map(n=>{
      const top=((DRUM_ROW[n.unit]!=null?DRUM_ROW[n.unit]:0.5)*100).toFixed(1);
      const left=Math.max(0,n.beat/cb*100);
      const w=Math.max(1.3, Math.min(100-left, n.durB/cb*100));
      return `<div class="vz-blk" style="left:${left.toFixed(2)}%;top:${top}%;width:${w.toFixed(2)}%;background:${col};opacity:${(0.45+0.55*n.vel).toFixed(2)}" title="${esc(n.unit)}"></div>`;
    }).join("");
  }
  const ms=L.notes.filter(n=>n.midi>0).map(n=>n.midi);
  const lo=ms.length?Math.min.apply(null,ms):60, hi=ms.length?Math.max.apply(null,ms):72, span=Math.max(1,hi-lo);
  return L.notes.map(n=>{
    const y=n.midi>0?(n.midi-lo)/span:0.5;
    const top=((1-y)*70+12).toFixed(1);       // 12..82% of the roll, high notes up top
    const left=Math.max(0,n.beat/cb*100);
    const w=Math.max(1.6, Math.min(100-left, n.durB/cb*100));
    return `<div class="vz-blk" style="left:${left.toFixed(2)}%;top:${top}%;width:${w.toFixed(2)}%;background:${col};opacity:${(0.4+0.6*n.vel).toFixed(2)}" title="${n.midi>0?'midi '+n.midi:''}"></div>`;
  }).join("");
}
function timelineHTML(tl){
  if(!tl||!tl.lanes.length) return `<div class="vz-info">— no voices sounding —</div>`;
  const cb=tl.cbeats, bp=100/cb;
  const grid=`repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px ${bp.toFixed(3)}%)`;
  let ruler=""; for(let b=0;b<cb;b++) ruler+=`<span style="left:${(b*bp).toFixed(2)}%">${b+1}</span>`;
  const rows=tl.lanes.map(L=>{
    // ALL effects as one TINY line UNDER the roll (Paul: pills stacked/clipped so only
    // one showed — untangle to compact text that shows the whole chain, tightened).
    const fx=(L.fx&&L.fx.length)?`<div class="vz-fxline">${L.fx.map(esc).join(" · ")}</div>`:"";
    // AUDIT-TRUTH silent-lane paint: red-hatched roll + a ✕ badge naming the reason.
    const silBadge=L.silent?`<span class="vz-silbadge" title="${esc(L.silReason==="missing"?("missing samples: "+(L.silMissing||[]).join(", ")):(L.silReason==="nan"?"render NaN (blown-up filter/strip)":"buffers present but silent — render-side mute"))}">✕ ${esc(L.silReason||"silent")}</span>`:"";
    // ROW = [header + roll] stacked ABOVE the fx line, so effects sit BENEATH the
    // piano-roll (not beside it, which squished the grid) and every roll aligns on
    // an even vertical rhythm regardless of how long a voice's fx chain is.
    return `<div class="vz-tlrow${L.silent?" vz-silent":""}">`+
      `<div class="vz-tlmain"><div class="vz-tlhead">`+
      `<div class="vz-tlname"><i style="background:var(${L.col})"></i>${esc(L.name)}${silBadge}</div>`+
      `<div class="vz-tlrole">${esc(L.label)}</div></div>`+
      `<div class="vz-roll${L.silent?" vz-silent":""}" style="background-image:${grid}">${laneBlocks(L,cb)}</div></div>`+
      fx+`</div>`;
  }).join("");
  return `<div class="vz-ruler" style="background-image:${grid}">${ruler}</div><div class="vz-tl">${rows}</div>`;
}
export function renderInside(){
  const box=document.getElementById("inside"); if(!box) return;
  const d=vizData();
  const seg=d.blend.filter(b=>b.pct>0).map(b=>`<div style="width:${b.pct}%;background:${genreCol(b.g)}" title="${esc(b.label)} ${b.pct}%"></div>`).join("");
  const legend=d.blend.filter(b=>b.pct>0).map(b=>`<span class="vz-g"><i style="background:${genreCol(b.g)}"></i>${esc(b.label)} <b>${b.pct}%</b></span>`).join("");
  const feelNums=d.feel.map(([n,v])=>`<b>${n}</b> ${Math.round(v*100)}`).join(" · ");
  const masterLine=(d.master&&d.master.length)?`<div class="vz-in vz-master"><span class="vz-ir">master</span><div class="vz-fxline">${d.master.map(esc).join(" · ")}</div></div>`:"";
  box.innerHTML=
    `<h2>inside the sound</h2>`+
    `<div class="vz-sec"><div class="vz-lbl">blend — the genres in this mix</div>`+
      `<div class="vz-bar">${seg}</div><div class="vz-leg">${legend}</div>`+
      (d.info?`<div class="vz-info">${esc(d.info)}</div>`:"")+`</div>`+
    `<div class="vz-sec"><div class="vz-lbl">feel — the texture</div>${radarSVG(d.feel)}`+
      `<div class="vz-feelnums">${feelNums}</div></div>`+
    `<div class="vz-sec"><div class="vz-lbl">timeline — what each voice plays this bar</div>`+
      `${timelineHTML(d.timeline)}${masterLine}</div>`;
}
