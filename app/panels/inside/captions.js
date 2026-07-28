// captions.js — THE WORD LINES of the ⓘ readout: the authored facts neither the
// roll nor the radar can draw — the harmony cycle + the form arc this bar sits
// in, the mind's moves (voicing / pipes / reharm tables) and the micro-timing —
// each read off the RESOLVED state and stated in WORDS. Nothing here prints a
// number: this panel states its vectors on the radar and nowhere else (a signed
// millisecond count reads as debug output, not as feel — genre-viz.test.js J4b).
// Data reads first (structure/timing/mind, called by vizData), then the two small
// HTML blocks renderInside drops under the radar.
import { esc } from "../../core/state.js";
import { num1, titleCase } from "./describe.js";

// ---------- FORM: the arc this bar sits in --------------------------------
// The anchor authors a form NAME; the blend expands it into `state.sections` and
// then the evolution pass rewrites that arc (extra cycles, key shifts, a cold
// open). The sections array is therefore the sounding structure and the form
// name is only its provenance — so the strip is built from sections and the
// name rides as one word. `at` is the section the roll is currently drawing
// (barVoiceEvents falls back to sections[0] when nothing is playing, so the
// highlight and the roll can never disagree).
export function structureData(st, bar){
  const form=(st.genreMeta&&st.genreMeta.form)?String(st.genreMeta.form):"";
  const secs=(st.sections&&st.sections.length)?st.sections:null;
  if(!secs) return form?{form, sections:[], at:-1}:null;
  const names=secs.map(s=>String((s&&s.name)||"")).filter(Boolean);
  if(!names.length) return form?{form, sections:[], at:-1}:null;
  const cur=(bar&&bar.section)||"";
  const at=cur?names.indexOf(cur):0;
  return {form, sections:names, at};
}
// ---------- TIME FEEL: the micro-timing no other read can show -------------
// `timeFeel.pushPull` (beats) + `pushPullMs` (milliseconds) place individual
// lanes a few thousandths of a bar off the grid — a laid-back bass, hats on top.
// It is the most FELT thing in the state and the least visible: the roll's cell
// is a whole beat wide and the radar carries swing amount, not lane placement.
// Folded through the engine's own resolvePushPull so the two unit systems sum
// exactly once, at this state's bpm, the way buildEvents sums them.
// Words, not numbers — this panel states its vectors on the radar and nowhere
// else, and a signed millisecond count reads as debug output, not as feel.
const LANE_WORD={ hat:"hats", hihat:"hats", snare:"snare", kick:"kick", ride:"ride", rim:"rim",
  clap:"claps", tom:"toms", perc:"percussion", shaker:"shaker", cowbell:"cowbell",
  bass:"bass", melody:"lead", pad:"pad", solo:"counter", stab:"stabs" };
export function timingData(st){
  const E=window.CsdEngine, tf=st.timeFeel, out=[];
  if((st.swing||0)>0.01&&tf&&tf.grid){
    if(tf.grid==="16th") out.push("sixteenth-note swing");
    else if(tf.grid==="triplet") out.push("triplet swing");
  }
  if(tf&&E&&E.resolvePushPull){
    let pp=null; try{ pp=E.resolvePushPull(tf, st.bpm); }catch(e){}
    const late=[], early=[];
    for(const k in (pp||{})){
      const v=+pp[k]; if(!(Math.abs(v)>0.0005)) continue;
      (v>0?late:early).push(LANE_WORD[k]||titleCase(k).toLowerCase());
    }
    if(late.length) out.push(late.join(" & ")+" behind the beat");
    if(early.length) out.push(early.join(" & ")+" on top of the beat");
  }
  return out;
}
// ---------- MIND: the MUSIC-MIND axes the state actually carries ----------
// state.theory (adventure/color/voicing — the harmony brain), state.pipes (the
// event-stream transforms) and state.rhythm.complexity (docs/MUSIC-MIND.md).
// All optional per the absent-knob law: null when the state carries none, so the
// section simply doesn't render (progressive disclosure — mobile stays uncrowded).
const PIPE_CHAR={ harmonize:"harmonized thirds", echoCanon:"echo canon", strum:"strummed chords",
  ghost:"ghost notes", callResponse:"call & response", densityArc:"density arc", sweepArc:"filter arc",
  vibratoSwell:"vibrato swells", throwFx:"dub throws", octavePump:"octave pump",
  accentProfile:"accented groove" };   // every CsdPipes.REGISTRY id needs a phrase here or its raw id leaks into the readout
export function mindData(st){
  const th=st.theory||null, cx=st.rhythm?num1(st.rhythm.complexity):0;
  const pipes=[]; for(const p of (st.pipes||[])){ const n=PIPE_CHAR[p.id]||titleCase(p.id).toLowerCase(); if(!pipes.includes(n)) pipes.push(n); }
  if(!th&&!pipes.length&&cx<=0) return null;
  return { adventure:th?num1(th.adventure):0, color:th?num1(th.color):0, complexity:cx,
    voicing:th?String(th.voicing||""):"", pipes,
    // the TABLES LAW and the reharm walk are the biggest hidden switches in the
    // engine (201/274 genres ride corpus tables) — surface both.
    reharm:!!(th&&th.reharm), tables:th?String(th.tables||"hand"):"" };
}
// the mind's MOVES (voicing + active pipes) ride as one quiet text line under
// the radar — the adventure/color/motion NUMBERS are radar axes: no numeric
// readouts anywhere, one unified vector display.
export function movesHTML(d){
  const mv=[]; if(d.mind&&d.mind.voicing) mv.push(`voicing <b>${esc(d.mind.voicing)}</b>`);
  if(d.mind&&d.mind.pipes.length) mv.push(`moves <b>${d.mind.pipes.map(esc).join(" · ")}</b>`);
  // harmony provenance: the reharm walk + which tables it walks
  if(d.mind&&(d.mind.reharm||d.mind.tables)){ const hm=[];
    if(d.mind.reharm) hm.push("reharm");
    if(d.mind.tables) hm.push(esc(d.mind.tables)+" tables");
    mv.push(`harmony <b>${hm.join(" · ")}</b>`); }
  // the micro-timing the roll cannot draw (see timingData)
  if(d.timing&&d.timing.length) mv.push(`timing <b>${d.timing.map(esc).join(" · ")}</b>`);
  return mv.length?`<div class="vz-mmoves">${mv.join(" &nbsp; ")}</div>`:"";
}
// HARMONY + FORM: the two authored facts the readout used to hide. Chips in
// cycle order with the sounding one lit, so the panel says WHERE the bar sits
// both harmonically and structurally. Guarded like every other section.
// No new stylesheet classes: this reuses the blend legend's chip styling
// (.vz-leg/.vz-g), and the roll/ruler selectors the timeline gates count are
// deliberately untouched here.
export function harmonyFormHTML(d){
  let hfHtml=""; try{
    const chip=(txt,on,col)=>`<span class="vz-g" style="${on?`color:var(${col});opacity:1`:"opacity:.45"}">`+
      `<i style="background:var(${col});opacity:${on?1:.3}"></i>${esc(txt)}</span>`;
    const rows=[];
    if(d.harmony) rows.push(`<div class="vz-leg">${d.harmony.chords.map((c,i)=>chip(c,i===d.harmony.at,"--pink")).join("")}</div>`);
    if(d.structure&&d.structure.sections.length)
      rows.push(`<div class="vz-leg">${d.structure.sections.map((s,i)=>chip(s,i===d.structure.at,"--mint")).join("")}</div>`);
    if(rows.length){
      const cap=[];
      if(d.harmony&&d.harmony.skeleton) cap.push(d.harmony.reharm?("reharmonized from "+d.harmony.skeleton):d.harmony.skeleton);
      if(d.structure&&d.structure.form) cap.push(d.structure.form+" arc");
      // No .vz-lbl here on purpose: lit chips in cycle order read as what they are,
      // and the caption underneath already names the progression and the arc.
      hfHtml=`<div class="vz-sec">`+
        rows.join("")+(cap.length?`<div class="vz-info">${esc(cap.join(" · "))}</div>`:"")+`</div>`;
    }
  }catch(e){ try{console.warn("inside: harmony/form section skipped:",e);}catch(_){}}
  return hfHtml;
}
