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
// ---------- listener-facing DESCRIPTIONS (Paul 2026-07: "stop naming the source").
// Roster text describes ROLE + CHARACTER — never provenance. No "sampler"/"DX7"/
// soundfont/library names, no raw source ids, no real-vs-synth tells: the listener
// gets "round upright bass", not "sampler: acoustic_bass (FluidR3)". Resolution
// still mirrors the engine exactly (same pickSampledId); only the FORMATTING here
// changed — the state fields are untouched.
const SIG_SYNTH={ tb303:"squelchy acid bass", acid:"rubbery acid bass", reese:"growling reese bass",
  wobble:"lurching wobble bass", synclead:"tearing sync lead", modeld:"fat mono lead", vocoder:"robot choir" };
const cleanLabel=s=>String(s||"").replace(/\s*\([^)]*\)/g,"").replace(/\s*—.*$/,"").replace(/\s*\+\d+dB.*$/,"").trim();
const titleCase=s=>String(s||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()).trim();
// character phrase for a resolved sampled-instrument label (first regex wins);
// fallback = the cleaned label lowercased (an instrument noun, never a catalog id).
const VOICE_CHAR=[
  [/fretless/,"singing fretless bass"],[/acoustic bass|upright/,"round upright bass"],
  [/finger/,"warm fingered bass"],[/slap/,"popping slap bass"],[/synth bass|bass & lead/,"punchy synth bass"],
  [/percussive organ|drawbar/,"dusty organ"],[/rock organ/,"growling organ"],[/church organ/,"cathedral organ"],
  [/reed organ/,"parlor reed organ"],[/felt piano/,"soft felt piano"],[/honky/,"barroom piano"],
  [/electric piano|legend ep|e\.? ?piano/,"glassy electric piano"],[/bright grand|grand piano|piano/,"bright grand piano"],
  [/harpsichord/,"courtly harpsichord"],[/clavinet/,"funky clavinet"],[/celesta/,"twinkling celesta"],
  [/music box/,"tiny music box"],[/glocken/,"glittering bells"],[/tubular|bell/,"tolling bells"],
  [/vibraphone/,"shimmering vibes"],[/marimba/,"woody marimba"],[/kalimba/,"plucked thumb keys"],
  [/xylo/,"bright xylophone"],[/steel drum/,"island steel pans"],
  [/jazz guitar/,"mellow jazz guitar"],[/nylon/,"soft nylon guitar"],[/steel string/,"bright steel-string guitar"],
  [/clean guitar/,"chiming clean guitar"],[/distortion|overdriv/,"snarling electric guitar"],
  [/guitar harmonics/,"chiming harmonics"],[/guitar/,"picked guitar"],
  [/muted trumpet/,"whispering muted trumpet"],[/trumpet/,"brassy trumpet"],[/trombone/,"sliding trombone"],
  [/tuba/,"deep parade brass"],[/french horn/,"warm horn section"],[/brass/,"punchy brass section"],
  [/alto sax/,"smoky alto sax"],[/tenor sax/,"breathy tenor sax"],[/baritone sax/,"husky baritone sax"],[/sax/,"smoky sax"],
  [/english horn/,"plaintive reed"],[/oboe/,"reedy oboe"],[/bassoon/,"dark bassoon"],[/clarinet/,"woody clarinet"],
  [/pan flute/,"breathy pan pipes"],[/flute|piccolo/,"airy flute"],[/ocarina/,"hollow clay whistle"],
  [/recorder|whistle/,"reedy whistle"],[/harmonica/,"wailing harmonica"],[/accordion|bandoneon/,"breathing bellows"],
  [/bagpipe/,"droning pipes"],[/pizzicato/,"plucked strings"],[/contrabass/,"bowed low strings"],
  [/cello/,"singing cello"],[/fiddle|violin/,"reeling fiddle"],[/strings|orchestra/,"sweeping strings"],
  [/harp/,"rippling harp"],[/choir|voice|ahh|ohh/,"hovering voices"],[/sitar/,"droning sitar"],
  [/koto/,"plucked koto"],[/shamisen|banjo/,"twanging strings"],[/dulcimer/,"hammered strings"],
  [/atmosphere|fantasia|halo|sweep|soundtrack|new age|warm pad|polysynth|bowed glass|crystal|echo drops|ice rain|goblin|metal pad|charang|chiffer|fifth|square|sawtooth/,"glowing synth pad"],
];
function charOf(label){
  const l=cleanLabel(label).toLowerCase();
  for(const [re,phrase] of VOICE_CHAR) if(re.test(l)) return phrase;
  return l.replace(/_/g," ")||"synth voice";
}
// FM patch names -> character (never say the hardware); default "glassy keys".
const DX7_CHAR=[
  [/piano|rhodes|\bep\b/,"glassy electric piano"],[/bell|tub|celest|glock|chime/,"glass bells"],
  [/shimmer/,"shimmering keys"],[/brass|horn/,"soft synth brass"],[/string|violin|cello/,"silky synth strings"],
  [/organ/,"breathing organ"],[/bass/,"punchy digital bass"],[/flute|wood|reed|clar|oboe|pipe/,"airy digital flute"],
  [/voice|choir|vox|aah/,"airy digital choir"],[/pluck|guitar|koto|harp|clav/,"plucked digital strings"],
  [/marimba|vibe|xylo|mallet/,"mallet keys"],[/pad|warm/,"warm digital pad"],
];
function dx7Char(name){
  const l=String(name||"").toLowerCase();
  for(const [re,phrase] of DX7_CHAR) if(re.test(l)) return phrase;
  return "glassy keys";
}
// pure-synth voice models -> character; fallback = a generic per-role phrase.
const MODEL_CHAR={ saw:"warm analog saw", stack:"stacked detuned synth", supersaw:"huge detuned saws",
  sine:"pure sine tone", fm:"glassy digital keys", pluck:"snappy synth pluck", kpluck:"metallic plucked string",
  fuzz:"fuzzy singing lead", guitar:"picked guitar", piano:"upright piano", bell:"glass bells",
  brass:"synth brass", organ:"breathing organ", strings:"silky string machine", choir:"hovering choir",
  rhodes:"glassy electric piano", juno60:"creamy analog polysynth", hammond:"greasy drawbar organ",
  vp330:"misty choir machine", solina:"silvery string ensemble", sub:"deep sub bass", square:"hollow square lead" };
const ROLE_GENERIC={ pad:"warm pad wash", bass:"round melodic bass", melody:"singing lead", solo:"answering lead" };
// drum kits -> character (kit ids are internal; the listener hears a feel).
const KIT_CHAR={ acoustic:"acoustic drum kit", brush:"brushed jazz drums", jazz:"loose jazz drums",
  room:"roomy live drums", power:"arena power drums", full:"full drum kit", open:"open drum groove",
  halftime:"heavy halftime drums", boombap:"dusty boom-bap drums", breaks:"dusty chopped breaks",
  jungle:"racing chopped breaks", techno:"driving machine drums", pulse:"pulsing machine drums",
  house:"four-on-the-floor machine", four:"four-on-the-floor machine" };
const kitChar=kit=>KIT_CHAR[kit]||(titleCase(kit).toLowerCase()+" drums");
// found sources -> texture character by KIND only (never the recording's name/id).
const FOUND_CHAR={ speech:"cut-up announcer voice", vox:"vocal fragments", break:"chopped drum breaks", hit:"sampled stabs" };
// bed CHARACTER by id-class (Paul 2026-07-10: "you use tape atmosphere all over
// the place" — it was the one fallback label for 48 different beds; name what
// KIND of air it is, still never the source — the J1/J2 provenance law holds).
const BED_CHAR=[
  [/station|shibuya|tokyo|plaza|tw_|metro/i, "city air"],
  [/highway|road|traffic|train/i,            "road hum"],
  [/factory|industr|machine|boiler|furnace/i,"machine room"],
  [/^vx_|voice|radio|conet|apollo|wwvh/i,    "voices on tape"],
  [/frog|cricket|bird|loon|chickadee|pigeon|nature|wind/i, "night air"],
  [/hydro|whale|water|ocean|sea|rain/i,      "deep water"],
  [/hum|hvac|drone|fan|thermo/i,             "room tone"],
];
const foundChar=s=>{ if(FOUND_CHAR[s&&s.kind]) return FOUND_CHAR[s.kind];
  const id=(s&&s.id)||""; for(const [re,c] of BED_CHAR) if(re.test(id)) return c;
  return "tape atmosphere"; };
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
  if(m.model==="sampler"&&m.sampler&&K.SAMPLERS[m.sampler.id]) return charOf(K.SAMPLERS[m.sampler.id].label);
  if(st.sampledOnly&&st.samplerLib&&window.FaustStateEngine&&FaustStateEngine.pickSampledId){
    try{ const id=FaustStateEngine.pickSampledId(role,m.model,st.seed);
      if(K.SAMPLERS[id]) return charOf(K.SAMPLERS[id].label); }catch(e){}
  }
  if(m.dx7) return dx7Char(m.dx7.name);
  return MODEL_CHAR[m.model]||ROLE_GENERIC[role]||titleCase(role).toLowerCase();
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
  // DUST: the record-wear axis (crackle + the master lowcut of the tape floor)
  const dust=clamp01((st.crackle||0)/0.8);
  // FEEL: how human the timing is (humanize; swing is its own axis)
  const feelAx=clamp01((st.humanize||0)/0.6);
  const axes=[["tempo",tempo],["swing",swing],["feel",feelAx],["bright",bright],["space",space],
    ["dust",dust],["drive",drive],["density",density]];
  // the MUSIC-MIND axes join the SAME radar (Paul 2026-07-10: "why are adventure
  // color motion different than the other vectors" — they aren't, anymore).
  // num1 handles the range-shaped fields exactly as mindData does.
  const th=st.theory||{};
  axes.push(["adventure",th.adventure!=null?num1(th.adventure):0]);
  axes.push(["color",th.color!=null?num1(th.color):0]);
  axes.push(["motion",st.rhythm?num1(st.rhythm.complexity):0]);
  return axes;
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
  let lo=ci*CBEATS, hi=lo+CBEATS; const notes=[];
  try{
    const ev=E.buildEvents(one), units=SE.voiceUnits(E,one);
    // bedAll: beds emit ONE event at section start (beat 0) and SUSTAIN across the
    // whole cycle — the plain [lo,hi) window drops them for every bar with ci>0,
    // which is exactly the "found audio plays but the viz shows nothing" bug (the
    // engine schedules the bed once at ci=0 for its full duration; see faust/
    // live.js scheduleNative). Ask for all beds, then CLIP each to this bar.
    let m=SE.mapEvents(E,one,ev,{lo,hi,units,bedAll:true});
    // MID-FLIP DIVERGENCE (Paul: "the viz just drops when a transition starts"):
    // live bars are scheduled a runway AHEAD of playback, so a glide flip that
    // rewrites progression/sections lands BETWEEN a bar's scheduling and its
    // sounding. The stale barInfo.ci — legal under the OLD harmony (say 8
    // chords) — can point past the new progression's chord count; [lo,hi) then
    // sits beyond every built event and the WHOLE timeline drew dead for that
    // bar (10+s of blank rolls at chordEvery 16, once per flip through the
    // storm). When an exact ci>0 window maps to NOTHING, re-window on the first
    // chord-bar: an honest picture of the state now sounding — the engine
    // re-syncs the meta on the next bar.
    if(ci>0&&!m.events.length&&!(m.found||[]).some(f=>f.type==="chop")){
      lo=0; hi=CBEATS;
      m=SE.mapEvents(E,one,ev,{lo,hi,units,bedAll:true});
    }
    for(const e of m.events){
      const freq=(e.sets&&e.sets.freq)||0;
      const vel=e.amp!=null?e.amp:(e.sets&&(e.sets.gain!=null?e.sets.gain:e.sets.level!=null?e.sets.level:0.5));
      notes.push({ role:noteRole(e.unit), unit:e.unit, beat:e.beat-lo, durB:Math.max(0.03,e.durB||0.1),
        midi:freqToMidi(freq), freq, vel:clamp01(vel), drum:!!e.drum });
    }
    for(const f of (m.found||[])){
      if(f.type==="chop"){   // chops are onsets — real hits, in-window already
        notes.push({ role:"found", unit:"found", beat:f.beat-lo, durB:Math.max(0.03,f.durB||0.12),
          midi:0, freq:0, vel:clamp01(f.amp!=null?f.amp:0.5), drum:true });
      }else{                 // BED: a sustained texture — draw the slice that overlaps THIS bar
        const s=Math.max(f.beat,lo), e2=Math.min(f.beat+(f.durB||0),hi);
        if(e2-s>0.01) notes.push({ role:"found", unit:"bed", beat:s-lo, durB:e2-s,
          midi:0, freq:0, vel:clamp01(f.amp!=null?f.amp:0.3), drum:true, bed:true });
      }
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
    const name=r?r.name:(sp.key==="found"?(found[0]||"tape atmosphere"):sp.label);
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
  if(!st) return {blend, feel:[], roster:[], found:[], info:"", master:[], mind:null,
    timeline:{cbeats:8,view:VIEW,pages:1,spb:0.5,bpm:110,lanes:[]}};
  const I=st.instruments||{}, roster=[];
  // build the voice units so we can read each instrument's resolved fx chain
  let U=null; try{ if(window.FaustStateEngine&&window.CsdEngine) U=FaustStateEngine.voiceUnits(CsdEngine,st); }catch(e){}
  if(I.pad) roster.push({role:"pad", name:voiceName("pad",I.pad,st), fx:voiceFx(U&&U.pad)});
  if(I.bass) roster.push({role:"bass", name:voiceName("bass",I.bass,st), fx:voiceFx(U&&U.bass)});
  if(I.melody) roster.push({role:"lead", name:voiceName("melody",I.melody,st), fx:voiceFx(U&&U.melody)});
  if(I.drums&&st.genreMeta&&st.genreMeta.kit&&st.genreMeta.kit!=="off"){
    const df=[]; for(const dk of ["kick","snare","hat"]) for(const x of voiceFx(U&&U[dk])) if(!df.includes(x)) df.push(x);
    roster.push({role:"kit", name:kitChar(st.genreMeta.kit), fx:df});
  }
  // found textures by CHARACTER (kind), deduped — never the recording's name/id
  const found=[]; for(const s of (st.foundSources||[]))
    if((s.vol||0)>0.02){ const c=foundChar(s); if(!found.includes(c)&&found.length<2) found.push(c); }
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
  const timeline={cbeats:bar.cbeats, view:VIEW, pages:Math.max(1,Math.ceil(bar.cbeats/VIEW)),
    spb:bar.spb, bpm:bar.bpm, lanes:timelineLanes(st, roster, found, bar, auditSilent), audit:auditSilent};
  return {blend, feel:feelAxes(st), roster, found, info, master:masterFx(st), timeline, mind:mindData(st)};
}
// ---------- MIND: the MUSIC-MIND axes the state actually carries ----------
// state.theory (adventure/color/voicing — the harmony brain), state.pipes (the
// event-stream transforms) and state.rhythm.complexity (docs/MUSIC-MIND.md).
// All optional per the absent-knob law: null when the state carries none, so the
// section simply doesn't render (progressive disclosure — mobile stays uncrowded).
const PIPE_CHAR={ harmonize:"harmonized thirds", echoCanon:"echo canon", strum:"strummed chords",
  ghost:"ghost notes", callResponse:"call & response", densityArc:"density arc", sweepArc:"filter arc",
  vibratoSwell:"vibrato swells", throwFx:"dub throws", octavePump:"octave pump" };
const num1=v=>Array.isArray(v)?clamp01(((+v[0]||0)+(+v[1]||0))/2):clamp01(+v||0);
function mindData(st){
  const th=st.theory||null, cx=st.rhythm?num1(st.rhythm.complexity):0;
  const pipes=[]; for(const p of (st.pipes||[])){ const n=PIPE_CHAR[p.id]||titleCase(p.id).toLowerCase(); if(!pipes.includes(n)) pipes.push(n); }
  if(!th&&!pipes.length&&cx<=0) return null;
  return { adventure:th?num1(th.adventure):0, color:th?num1(th.color):0, complexity:cx,
    voicing:th?String(th.voicing||""):"", pipes };
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
    if(n.bed) continue;                                 // beds are texture, not onsets — timeline-only
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
  const cx=110, cy=106, R=72, n=feel.length;   // a touch more label air for the 11-axis rose
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
  return `<svg viewBox="0 0 220 220" class="radar" preserveAspectRatio="xMidYMid meet">${grid}${poly}${dots}</svg>`;
}
// the VOICE TIMELINE as HTML: a lane per voice, note events drawn as absolutely
// positioned blocks in a beat-gridded roll. x = onset (beat/cbeats), width =
// duration; melodic lanes map PITCH to y (high notes ride high), drum/found lanes
// stack each hit type on its own row. Block opacity = velocity. All CSS/HTML (no
// SVG) so it stays crisp, responsive and cheap to rebuild every frame.
const DRUM_ROW={ hat:0.10, tom:0.34, snare:0.52, kick:0.76, found:0.5, bed:0.18 };
// THE UNIT IS ALWAYS 8 (Paul 2026-07): the visible roll is a constant 8-cell
// window whatever the genre's harmonic rhythm. chordEvery=16/32 structures PAGE
// (Paul 2026-07: the old stacked fold rows read as "double bars for each" —
// duplication, not continuation). ONE 8-cell row per lane; while live the
// window slides to the next 8 beats when the beat crosses a page edge. Idle
// shows page 1. A bed spanning the chord bar lands a clipped slice on EVERY page.
const VIEW=8;
const MEAS_BEATS=1;   // the playhead lights ONE ruler cell at a time (Paul 2026-07-10: "each BAR should light up as it progresses, not four bars at a time")
// split one note into its per-PAGE segments: {page, left%, w%} — left/w are
// percentages of the 8-beat page window, so a block draws identically whichever
// page carries it (and a long bed gets one slice per page it overlaps).
function noteSegs(n, cb){
  const pages=Math.max(1,Math.ceil(cb/VIEW)), out=[];
  const b0=Math.max(0,n.beat), b1=Math.min(cb, n.beat+Math.max(0.03,n.durB||0.1));
  for(let p=0;p<pages;p++){
    const lo=p*VIEW, s=Math.max(b0,lo), e=Math.min(b1,lo+VIEW);
    if(e-s<=0.001) continue;
    out.push({page:p, left:(s-lo)/VIEW*100, w:(e-s)/VIEW*100});
  }
  return out;
}
// per-page block HTML for a lane: returns an array of `pages` HTML strings.
function lanePages(L, cb){
  const col=`var(${L.col})`, nPages=Math.max(1,Math.ceil(cb/VIEW));
  const html=new Array(nPages).fill("");
  const ms=L.notes.filter(n=>n.midi>0).map(n=>n.midi);
  const plo=ms.length?Math.min.apply(null,ms):60, phi=ms.length?Math.max.apply(null,ms):72, span=Math.max(1,phi-plo);
  for(const n of L.notes){
    let top, cls="vz-blk", title;
    if(L.drumLane){
      top=((DRUM_ROW[n.unit]!=null?DRUM_ROW[n.unit]:0.5)*100).toFixed(1);
      if(n.bed) cls+=" vz-bed";                       // sustained texture ribbon, not a hit
      title=esc(n.bed?"sustained texture":n.unit);
    }else{
      const y=n.midi>0?(n.midi-plo)/span:0.5;
      top=((1-y)*70+12).toFixed(1);                   // 12..82% of the roll, high notes up top
      title=n.midi>0?"midi "+n.midi:"";
    }
    const op=(L.drumLane?0.45+0.55*n.vel:0.4+0.6*n.vel).toFixed(2);
    for(const g of noteSegs(n,cb)){
      const w=Math.max(n.bed?g.w:(L.drumLane?1.3:1.6), Math.min(100-g.left,g.w));
      html[g.page]+=`<div class="${cls}" style="left:${g.left.toFixed(2)}%;top:${top}%;width:${w.toFixed(2)}%;background:${col};opacity:${op}" title="${title}"></div>`;
    }
  }
  return html;
}
// the CURRENT live beat within the chord bar, off S.barInfo + the audio clock —
// the same arithmetic readouts.js playheadTick uses to place the chyron beat:
// (t - bar.when)/spb clamped to [0, cbeats). null when idle/not-live, so the
// timeline rests on page 1 and the playhead stays dark.
function liveBeat(){
  if(!S.live||!S.barInfo||!faustHandle) return null;
  let t=0; try{ t=faustHandle.ctx.currentTime; }catch(e){ return null; }
  const b=S.barInfo, cb=b.cbeats||8;
  if(!(b.spb>0)||!(b.when>=0)) return null;
  return Math.max(0,Math.min(cb-0.001,(t-b.when)/b.spb));
}
function timelineHTML(tl){
  if(!tl||!tl.lanes.length) return `<div class="vz-info">— no voices sounding —</div>`;
  const cb=tl.cbeats, bp=100/VIEW, pages=Math.max(1,Math.ceil(cb/VIEW));
  const grid=`repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px ${bp.toFixed(3)}%)`;
  // bake the CURRENT page + beat into every rebuild (the store re-renders the ⓘ
  // freely while live; snapping home to page 1 mid-bar would fight the ticker).
  const beat=liveBeat(), page=beat==null?0:Math.max(0,Math.min(pages-1,Math.floor(beat/VIEW)));
  // ruler numbers name the ABSOLUTE beats this page shows (9..16 on page 2 —
  // continuation, not duplication), plus a quiet ·1/2 page indicator when pages exist.
  let ruler=""; for(let b=0;b<VIEW;b++) ruler+=`<span style="left:${(b*bp).toFixed(2)}%">${page*VIEW+b+1}</span>`;
  // (a <b>, NOT a <span>: ruler spans are the beat numbers — the ticker relabels them)
  const pgind=pages>1?`<b class="vz-pgind">·${page+1}/${pages}</b>`:"";
  // hatched dead tail when cb isn't a multiple of VIEW (blended states) — it
  // lives INSIDE the last page, so it only shows when that page is the window.
  const deadW=(pages*VIEW-cb)/VIEW*100;
  const shift=(-page*100/pages).toFixed(4), pw=(100/pages).toFixed(4);
  // PER-LANE guard (transition hardening): one lane's formatter choking on a
  // mid-flip transitional shape must never blank the whole panel — render every
  // lane we can, skip (and console.warn) the one that throws.
  const rows=tl.lanes.map(L=>{
   try{
    // ALL effects as one TINY line UNDER the roll (Paul: pills stacked/clipped so only
    // one showed — untangle to compact text that shows the whole chain, tightened).
    const fx=(L.fx&&L.fx.length)?`<div class="vz-fxline">${L.fx.map(esc).join(" · ")}</div>`:"";
    // AUDIT-TRUTH silent-lane paint: red-hatched roll + a ✕ badge naming the reason.
    const silBadge=L.silent?`<span class="vz-silbadge" title="${esc(L.silReason==="missing"?("missing samples: "+(L.silMissing||[]).join(", ")):(L.silReason==="nan"?"render NaN (blown-up filter/strip)":"buffers present but silent — render-side mute"))}">✕ ${esc(L.silReason||"silent")}</span>`:"";
    // ROW = [header + roll] stacked ABOVE the fx line, so effects sit BENEATH the
    // piano-roll (not beside it, which squished the grid) and every roll aligns on
    // an even vertical rhythm regardless of how long a voice's fx chain is.
    // the roll: ONE 8-cell row per lane, always. Longer chord bars ride a pager
    // strip clipped behind the fixed grid; a page flip is a fast slide, not a scroll.
    const inner=lanePages(L,cb).map((h,p)=>`<div class="vz-page" style="width:${pw}%">${h}`+
      (p===pages-1&&deadW>0.5?`<div class="vz-dead" style="width:${deadW.toFixed(2)}%"></div>`:"")+`</div>`).join("");
    const roll=`<div class="vz-roll${L.silent?" vz-silent":""}" style="background-image:${grid}">`+
      `<div class="vz-pager" style="width:${pages*100}%;transform:translateX(${shift}%)">${inner}</div></div>`;
    return `<div class="vz-tlrow${L.silent?" vz-silent":""}">`+
      `<div class="vz-tlmain"><div class="vz-tlhead">`+
      `<div class="vz-tlname"><i style="background:var(${L.col})"></i>${esc(L.name)}${silBadge}</div>`+
      `<div class="vz-tlrole">${esc(L.label)}</div></div>`+
      roll+`</div>`+
      fx+`</div>`;
   }catch(e){ try{console.warn("inside: lane",L&&L.key,"skipped:",e);}catch(_){} return ""; }
  }).join("");
  // ONE shared playhead spanning every lane (they share the beat grid) —
  // rendered dormant when idle; the ~10Hz ticker lights it while live. It is a
  // MEASURE BLOCK, not a sweep line (Paul 2026-07-10): the active measure
  // (MEAS_BEATS beats) lights up and STEPS to the next, so you read "we are in
  // measure 2 of this bar" at a glance. Clamped to the window edge mid-flip.
  const measW=Math.min(100,MEAS_BEATS/VIEW*100);
  const mIdx=beat==null?0:Math.floor(beat/MEAS_BEATS);
  const mLeft=beat==null?0:Math.max(0,Math.min(100-measW,(mIdx*MEAS_BEATS-page*VIEW)/VIEW*100));
  const ph=`<div class="vz-ph${beat==null?"":" on"}" data-page="${page}"${beat==null?"":` data-beat="${beat.toFixed(3)}"`}><i style="left:${mLeft.toFixed(2)}%;width:${measW.toFixed(2)}%"></i></div>`;
  return `<div class="vz-ruler" style="background-image:${grid}">${ruler}${pgind}</div>`+
    `<div class="vz-tl" data-pages="${pages}" data-page="${page}">${rows}${ph}</div>`;
}
// (the MIND meter block lived here until 2026-07-10 — adventure/color/motion
// are radar axes now, the moves line rides under the radar in renderInside.)
// ---------- live playhead ticker: the beat cursor + the page flips ----------
// ~10Hz, ONLY while the ⓘ modal is open AND we're live; it cancels itself the
// first frame either stops being true (zero cost closed/idle). Between full
// re-renders it sweeps the ONE shared cursor and, when the beat crosses a
// multiple of 8, slides every lane's pager to the next window + relabels the
// ruler/indicator — the playhead DRIVES the paging (page = floor(beat/8)).
let phTimer=0;
function phFrame(){
  const wrap=document.getElementById("insideWrap");
  if(!wrap||!wrap.classList.contains("open")||!S.live){
    clearInterval(phTimer); phTimer=0;
    const ph=document.querySelector("#inside .vz-ph"); if(ph) ph.classList.remove("on");
    return;
  }
  const box=document.getElementById("inside");
  const tlEl=box.querySelector(".vz-tl"), ph=box.querySelector(".vz-ph");
  const beat=liveBeat();
  if(!tlEl||!ph||beat==null) return;
  const pages=+tlEl.dataset.pages||1;
  const page=Math.max(0,Math.min(pages-1,Math.floor(beat/VIEW)));
  if(page!==+tlEl.dataset.page){                 // page flip: fast slide + relabel
    tlEl.dataset.page=String(page);
    const shift=(-page*100/pages).toFixed(4)+"%";
    for(const pg of tlEl.querySelectorAll(".vz-pager")) pg.style.transform=`translateX(${shift})`;
    box.querySelectorAll(".vz-ruler span").forEach((s,i)=>{ s.textContent=String(page*VIEW+i+1); });
    const ind=box.querySelector(".vz-pgind"); if(ind) ind.textContent="·"+(page+1)+"/"+pages;
  }
  // MEASURE-BLOCK step (no sweep): light the measure the beat sits in, clamped
  // to the window edge mid-flip (barInfo.cbeats can outrun this DOM's pages).
  const line=ph.firstElementChild;
  if(line){
    const measW=Math.min(100,MEAS_BEATS/VIEW*100);
    const mIdx=Math.floor(beat/MEAS_BEATS);
    const left=Math.max(0,Math.min(100-measW,(mIdx*MEAS_BEATS-page*VIEW)/VIEW*100));
    line.style.left=left.toFixed(2)+"%"; line.style.width=measW.toFixed(2)+"%";
  }
  ph.dataset.page=String(page); ph.dataset.beat=beat.toFixed(3); ph.classList.add("on");
}
function ensurePhTicker(){ if(!phTimer) phTimer=setInterval(phFrame,100); }
export function renderInside(){
  const box=document.getElementById("inside"); if(!box) return;
  const d=vizData();
  const seg=d.blend.filter(b=>b.pct>0).map(b=>`<div style="width:${b.pct}%;background:${genreCol(b.g)}" title="${esc(b.label)} ${b.pct}%"></div>`).join("");
  const legend=d.blend.filter(b=>b.pct>0).map(b=>`<span class="vz-g"><i style="background:${genreCol(b.g)}"></i>${esc(b.label)} <b>${b.pct}%</b></span>`).join("");
  const masterLine=(d.master&&d.master.length)?`<div class="vz-in vz-master"><span class="vz-ir">master</span><div class="vz-fxline">${d.master.map(esc).join(" · ")}</div></div>`:"";
  // the mind's MOVES (voicing + active pipes) ride as one quiet text line under
  // the radar — the adventure/color/motion NUMBERS are radar axes now (Paul
  // 2026-07-10: no numeric readouts, one unified vector display).
  const mv=[]; if(d.mind&&d.mind.voicing) mv.push(`voicing <b>${esc(d.mind.voicing)}</b>`);
  if(d.mind&&d.mind.pipes.length) mv.push(`moves <b>${d.mind.pipes.map(esc).join(" · ")}</b>`);
  const moves=mv.length?`<div class="vz-mmoves">${mv.join(" &nbsp; ")}</div>`:"";
  // transition hardening: a timeline hiccup must never blank the whole panel —
  // blend/feel still render; the roll announces itself instead of dying.
  let tlHtml; try{ tlHtml=timelineHTML(d.timeline); }
  catch(e){ try{console.warn("inside: timeline render skipped:",e);}catch(_){}
    tlHtml=`<div class="vz-info">— timeline resyncing —</div>`; }
  box.innerHTML=
    `<h2>inside the sound</h2>`+
    `<div class="vz-sec"><div class="vz-lbl">blend — the genres in this mix</div>`+
      `<div class="vz-bar">${seg}</div><div class="vz-leg">${legend}</div>`+
      (d.info?`<div class="vz-info">${esc(d.info)}</div>`:"")+`</div>`+
    `<div class="vz-sec">${radarSVG(d.feel)}${moves}</div>`+
    `<div class="vz-sec">${tlHtml}${masterLine}</div>`;
  // arm the playhead ticker only when it has work (live + modal open); it stops itself.
  const wrap=document.getElementById("insideWrap");
  if(S.live&&wrap&&wrap.classList.contains("open")) ensurePhTicker();
}
