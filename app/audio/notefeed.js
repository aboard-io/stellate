// notefeed.js — the per-bar EVENT RECONSTRUCTION and the note feed that drives
// the demoscene layer. Lifted out of the ⓘ readout (panels/inside.js) because
// live.js needs exactly this and nothing else from that panel: with the feed
// here, audio/ no longer imports panels/inside.js and the app's one remaining
// import cycle (targeting ↔ live) is contained inside this folder.
//
// TWO EXPORTS, ONE JOB EACH:
//   barVoiceEvents(state, barInfo) — reconstruct ONE chord-bar of engine events,
//     mirroring faust/live.js stepWalk, so the ⓘ voice timeline and the note feed
//     read the SAME events the engine voices. Pure/deterministic (no Math.random),
//     memoised on (state, ci, serial, section).
//   scheduleBarNotes(barInfo, ctxNow) / clearNoteTimers() — fire DemoLayer.note(ev)
//     at each note's wall-clock onset.
// The caller passes the audio-clock time: this module reads the score, never the
// engine handle, so it takes no dependency back on live.js.
import { S } from "../core/state.js";

const clamp01=v=>v<0?0:v>1?1:v;
// a found-role token that is not one of the four is dropped, never printed — the
// found SOURCE id is never a legal readout (the provenance law).
const FOUND_ROLES={bed:1,break:1,chops:1,narration:1};
const roleOf=t=>FOUND_ROLES[t]?t:"";
// ---------- VOICE TIMELINE: the per-bar piano-roll of what each voice plays ----
// Reconstruct ONE chord-bar of engine events for state `st`, mirroring faust/
// live.js stepWalk so the timeline + the DemoLayer note feed read the SAME
// events the engine voices: single active section, the per-bar seed
// (seed + serial*7919), window [ci*cb, ci*cb+cb). Pure/deterministic — no
// Math.random — so it's stable in the headless gate and identical to the audio.
const freqToMidi=hz=>hz>0?Math.round(69+12*Math.log2(hz/440)):0;
// unit key (mapEvents) -> a coarse voice ROLE for lanes + the DemoLayer contract.
function noteRole(unit, isDrum){
  if(unit==="melody") return "melody";
  if(unit.indexOf("solo:")===0) return "solo";
  if(unit==="pad"||unit==="bass") return unit;
  if(unit==="stab"||unit==="sfx") return "sfx";
  // EVERY drum-flagged unit is the drums lane. Without this the sampled kits'
  // clap/rim/ride/crash/perc pieces fall through the map and match no lane, so
  // half of every sampled kit goes missing from the viz.
  if(isDrum||unit==="kick"||unit==="snare"||unit==="hat"||unit==="tom") return "drums";
  return unit;
}
// ---------- HARMONY: the chord cycle actually sounding under this bar --------
// `state.progression` names the skeleton the blend drew from the anchor's
// progressions pool. For a genre carrying `theory.reharm` that skeleton is ONLY
// a seed: buildEvents hands it to CsdTheory.reharmonize on the +40961 stream,
// keyed off the per-bar seed, so the chords change bar to bar and the named
// progression is not what is sounding. Resolve it here exactly as buildEvents
// does — same table, same reharm call, same stream offset, off the SAME per-bar
// `one` state the roll was built from — and keep the skeleton as a caption.
// Never throws: a view that dies on an odd state is worse than a missing line.
function resolveHarmony(one, chordIdx){
  const E=window.CsdEngine;
  if(!E||!E.PROGRESSIONS||!one||!one.progression) return null;
  // ONE resolver, shared with the audio. This used to re-implement the reharm
  // walk here — same table, same +40961 stream offset — so the chips agreed with
  // the sounding chords only for as long as two copies stayed in step, and no
  // gate bound them. csd-engine's resolveProgression is now the single call
  // buildEvents makes too. (Guarded: an older cached engine without it falls back
  // to the skeleton rather than throwing — a missing chip beats a dead panel.)
  let prg=null, reharm=false;
  const th=one.theory;
  if(E.resolveProgression){ try{ prg=E.resolveProgression(one); reharm=!!(th&&th.reharm); }catch(e){ prg=null; } }
  if(!prg) prg=E.PROGRESSIONS[one.progression];
  if(!prg||!prg.chords||!prg.chords.length) return null;
  const chords=(prg.chords||[]).map(c=>String((c&&c.name)||"")).filter(Boolean);
  if(!chords.length) return null;
  // the progression labels carry an em-dash gloss naming the genres they came
  // from ("… — city pop / vaporwave"); that gloss can contradict the blend on
  // screen, so only the harmonic half is shown.
  const skeleton=String(prg.label||one.progression||"").replace(/\s*—.*$/,"").trim();
  const n=chords.length, at=((Math.round(chordIdx||0)%n)+n)%n;
  return { skeleton, reharm, chords, at };
}
let _barMemo={st:null,ci:-1,serial:-1,sec:"",val:null};
export function barVoiceEvents(st, bar){
  const E=window.CsdEngine, SE=window.FaustStateEngine;
  const CBEATS=Math.max(2,Math.round((st&&st.chordEvery)||8));
  const spb=60/((st&&st.bpm)||110);
  if(!E||!SE||!st) return {cbeats:CBEATS, spb, bpm:(st&&st.bpm)||110, notes:[], foundRole:"", harmony:null, section:""};
  const ci=(bar&&bar.ci!=null)?bar.ci:0, serial=(bar&&bar.serial!=null)?bar.serial:0;
  const secName=(bar&&bar.section)||"";
  if(_barMemo.st===st&&_barMemo.ci===ci&&_barMemo.serial===serial&&_barMemo.sec===secName) return _barMemo.val;
  const one=Object.assign({},st,{ seed:((st.seed||1)+serial*7919)>>>0,
    instrumentSeed: st.instrumentSeed!=null?st.instrumentSeed:(st.seed||1),   // mirror live.js makeWalk: instrument identity = song seed
    _seamWin:true });   // …and its SEAM LAW: window on the drawless beat0, so the readout owns the same events the conductor plays
  const secs=(st.sections&&st.sections.length)?st.sections:null;
  let activeSec=null;
  if(secs){
    // SECTION RESOLUTION — by NAME, then by INDEX, and never by "give up and take
    // the first one". The live walk selects its section by INDEX (faust/live.js
    // stepWalk: secs[secIdx]); the name is a label. A bar is scheduled a runway
    // ahead of sounding, so a glide across a genre boundary can replace
    // st.sections with a differently-named form in between — the fired bar then
    // names a section this state does not contain. Falling back to sections[0]
    // meant the readout drew the SPARSE OPENER (often pad alone) while a full
    // arrangement played: "every track is playing but only two show notes".
    // barInfo.secIdx is the walk's own cursor, so index-resolving reproduces the
    // walk's choice against the new form (wrapped exactly as the walk wraps it).
    // Three resolutions, most-faithful first: the state's own section of that
    // name; else the SECTION OBJECT the walk actually rendered (barInfo.sec — the
    // exact form of the bar being heard, which is the honest answer when the
    // state has moved on); else the walk's index into whatever form the state
    // carries now.
    activeSec=(secName&&secs.find(s=>s.name===secName))||null;
    if(!activeSec&&bar&&bar.sec&&bar.sec.name) activeSec=bar.sec;
    if(!activeSec&&bar&&bar.secIdx!=null&&bar.secIdx>=0)
      activeSec=secs[((Math.round(bar.secIdx)%secs.length)+secs.length)%secs.length];
    if(!activeSec) activeSec=secs[0];
    one.sections=[Object.assign({},activeSec,{cycles:1})]; }
  // FOUND ROLE off the state: the SECTION's own role first (a form may hand one
  // section a bed where the track's role is chops), then the track-level role
  // the blend resolved (genreMeta.found = "<sourceId>/<role>" — only the role
  // token is ever read, the source id never reaches the screen).
  const foundRole=roleOf(activeSec&&activeSec.found&&activeSec.found.role)
    || roleOf(String((st.genreMeta&&st.genreMeta.found)||"").split("/").pop());
  let lo=ci*CBEATS, hi=lo+CBEATS, winCi=ci; const notes=[];
  try{
    const ev=E.buildEvents(one), units=SE.voiceUnits(E,one);
    // bedAll: beds emit ONE event at section start (beat 0) and SUSTAIN across the
    // whole cycle — the plain [lo,hi) window drops them for every bar with ci>0,
    // which is exactly the "found audio plays but the viz shows nothing" bug (the
    // engine schedules the bed once at ci=0 for its full duration; see faust/
    // live.js scheduleNative). Ask for all beds, then CLIP each to this bar.
    let m=SE.mapEvents(E,one,ev,{lo,hi,units,bedAll:true});
    // MID-FLIP DIVERGENCE — why the viz drops when a transition starts:
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
      lo=0; hi=CBEATS; winCi=0;   // the harmony readout follows the window, not the stale meta
      m=SE.mapEvents(E,one,ev,{lo,hi,units,bedAll:true});
    }
    for(const e of m.events){
      const freq=(e.sets&&e.sets.freq)||0;
      const vel=e.amp!=null?e.amp:(e.sets&&(e.sets.gain!=null?e.sets.gain:e.sets.level!=null?e.sets.level:0.5));
      notes.push({ role:noteRole(e.unit, !!e.drum), unit:e.unit, beat:e.beat-lo, durB:Math.max(0.03,e.durB||0.1),
        midi:freqToMidi(freq), freq, vel:clamp01(vel), drum:!!e.drum });
    }
    // kind map: srcId -> the source's KIND, so spoken/vocal chops get their
    // own track rather than disappearing into another lane.
    const kindOf={}; for(const src of (one.foundSources||[])) if(src&&src.id) kindOf[src.id]=src.kind||"";
    for(const f of (m.found||[])){
      if(f.type==="chop"){   // chops are onsets — real hits, in-window already
        const k=kindOf[f.srcId]||"";
        const role=(k==="speech"||k==="vox")?"voices":"found";
        notes.push({ role, unit:role, beat:f.beat-lo, durB:Math.max(0.03,f.durB||0.12),
          midi:0, freq:0, vel:clamp01(f.amp!=null?f.amp:0.5), drum:true, kind:k });
      }else{                 // BED: a sustained texture — draw the slice that overlaps THIS bar
        const s=Math.max(f.beat,lo), e2=Math.min(f.beat+(f.durB||0),hi);
        if(e2-s>0.01) notes.push({ role:"found", unit:"bed", beat:s-lo, durB:e2-s,
          midi:0, freq:0, vel:clamp01(f.amp!=null?f.amp:0.3), drum:true, bed:true });
      }
    }
  }catch(e){}
  let harmony=null; try{ harmony=resolveHarmony(one, winCi); }catch(e){}
  const val={cbeats:CBEATS, spb, bpm:one.bpm, notes, foundRole, harmony,
    section:(activeSec&&activeSec.name)||secName||""};
  _barMemo={st, ci, serial, sec:secName, val};
  return val;
}
// ---------- note feed → the demoscene layer ----------
// While LIVE, fire DemoLayer.note(ev) at each note's wall-clock ONSET so the wasm
// demos react to the music. Same per-bar events the timeline draws, scheduled off
// the bar's audio-clock downbeat (info.when + beat*spb). Guarded: a silent no-op
// unless the demoscene layer is present AND enabled — no wasted work when it's off.
// ctxNow is the LIVE ENGINE'S clock (faustHandle.ctx.currentTime), handed in by
// the caller — info.when is on that clock, so a wall clock would smear the feed.
// Null/absent means there is no engine yet: schedule nothing.
let noteTimers=[];
export function clearNoteTimers(){ for(const t of noteTimers) clearTimeout(t); noteTimers=[]; }
export function scheduleBarNotes(info, ctxNow){
  if(!(window.DemoLayer&&DemoLayer.enabled&&DemoLayer.enabled()&&DemoLayer.note)) return;
  if(!S.live||!info||ctxNow==null) return;
  const now=ctxNow;
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
