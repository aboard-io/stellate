// inside.js — "INSIDE THE SOUND": the ⓘ readout. Three reads off the SAME live
// state the engine is voicing (blend / feel radar / voice timeline), off the same
// per-bar events audio/notefeed.js feeds DemoLayer.note(ev). All pure/read-only
// (no Math.random) so it's identical in the headless gate and to the audio.
//
// THIS FILE IS THE PANEL SHELL: it assembles the data (vizData) and the page
// (renderInside), and owns the AUDIT-TRUTH read. Each surface it draws lives in
// its own module beside it, and each is comprehensible on its own:
//   inside/describe.js  — the NAMING layer: every word the panel may say about a
//                         sound (the provenance law), the genre hue, clamp01/num1
//   inside/feel.js      — the FEEL radar: axes off the resolved state + the rose
//   inside/timeline.js  — the VOICE TIMELINE: lanes, piano roll, pages, playhead
//   inside/graph.js     — the EFFECTS surface: per-voice/master fx + the mixing
//                         node graph (effects are nodes, not captions)
//   inside/captions.js  — the WORD lines: harmony/form chips, the mind's moves,
//                         the micro-timing — authored facts, never numbers
// The per-bar event reconstruction is NOT here: it lives in audio/notefeed.js,
// shared with the DemoLayer note feed, so audio/ never imports this panel.
//
// ---------- WHICH SOURCE OF TRUTH — settled; do not re-litigate ------------
// The view exists to tell the truth about what is PLAYING. Two candidate
// sources disagree constantly, so the split is stated once, here:
//
//   THE RESOLVED STATE (state.progression / .sections / .timeFeel /
//   sec.found.role / genreMeta.*) is authored fact the ear cannot recover from
//   one bar of events. Read it wherever the view was otherwise guessing or
//   silent. Note it is the RESOLVED state, never `GENRES[g].anchor`: the anchor
//   holds POOLS (progressions[], kits[], fills[], found.sources[]) and the blend
//   already drew one member per pool at this seed. The pool is intent; the draw
//   is what sounds. Reading the pool would name three progressions where one is
//   playing.
//
//   THE RE-SIMULATED BAR (barVoiceEvents → buildEvents + mapEvents — it lives
//   in audio/notefeed.js, shared with the DemoLayer note feed) wins
//   wherever it is downstream of the state, because every generator between the
//   anchor and the speaker has already run: pipes transforms, the snare-law, the
//   reharm walk, euclid expansion, humanize. Where an authored field is a
//   GENERATOR whose whole output the roll draws at higher resolution, the roll
//   is strictly more informative and the field stays unread.
//
//   Field by field:
//     progressions → STATE. state.progression is the drawn skeleton; under
//       theory.reharm (most of the catalogue) CsdTheory rewalks it per bar, so
//       the sounding chords are resolved here the same way buildEvents does and
//       the skeleton rides along only as a caption (resolveHarmony, in notefeed).
//     found.role   → STATE (sec.found.role, falling back to genreMeta). Role
//       NAMES the layer; event shape still DRAWS it. bed-vs-chop was inferred
//       from event shape, which cannot separate a sliced drum break from a
//       sliced vocal loop from a spoken section — all three are chop events.
//     form         → STATE, but the RESOLVED `state.sections`, not the anchor's
//       form label: evolutions/key shifts/cold opens rewrite the arc after the
//       form template picks it. genreMeta.form rides as a caption word.
//     timeFeel.pushPull → STATE. Per-lane micro-timing of a few milliseconds is
//       far below the roll's cell resolution and has no radar axis; unread it is
//       simply invisible. Folded through the engine's own resolvePushPull so the
//       ms and beats lanes combine exactly once.
//     fills        → NEITHER, deliberately. A fill is a per-section event, not a
//       property of this bar; when one fires its notes are already in the roll.
//       (Known divergence: this module re-simulates the section at cycles:1, so
//       the roll shows the fill on every cycle where the live walk gates it to
//       the last. Fixing that needs the walk's cycle index in S.barInfo.)
//     hits.pattern, stab, euclid → NEITHER. Each is a table of beat offsets that
//       the roll already draws as literal onsets, at higher resolution and after
//       swing/humanize/pipes have moved them. Printing "E(3,8)" would also break
//       this panel's standing no-numeric-readouts rule.
import { S, K, esc } from "../core/state.js";
import { faustHandle } from "../audio/live.js";
import { barVoiceEvents } from "../audio/notefeed.js";   // the per-bar event reconstruction, shared with the demoscene note feed
import { titleCase, kitChar, foundChar, genreCol, voiceName } from "./inside/describe.js";
import { feelAxes, radarSVG } from "./inside/feel.js";
import { voiceFx, masterFx, graphData, graphSVG } from "./inside/graph.js";
import { VIEW, timelineLanes, timelineHTML, ensurePhTicker } from "./inside/timeline.js";
import { mindData, structureData, timingData, movesHTML, harmonyFormHTML } from "./inside/captions.js";

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
export function vizData(){
  const st=S.playing;
  const blend=(S.weights||[]).slice().sort((a,b)=>b.w-a.w).slice(0,4)
    .map(w=>({g:w.g, label:(K.GENRES[w.g]&&K.GENRES[w.g].label)||titleCase(w.g), pct:Math.round(w.w*100), w:w.w}));
  if(!st) return {blend, feel:[], roster:[], found:[], info:"", master:[], mind:null,
    harmony:null, structure:null, timing:[],
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
    if((s.vol||0)>0.02&&s.kind!=="hit"&&s.kind!=="speech"&&s.kind!=="vox"){ const c=foundChar(s); if(!found.includes(c)&&found.length<2) found.push(c); }   // the found lane names TEXTURES; hits/voices have their own lanes now
  const dom=blend[0], info=dom&&K.GENRES[dom.g]?K.GENRES[dom.g].info:"";
  const bar=barVoiceEvents(st, S.barInfo);
  // AUDIT-TRUTH: pull the measured expected-vs-actual audit for the bar currently heard
  // (keyed by serial) and reduce it to a role→{reason,missing} map for silent-lane paint.
  //
  // BOTH ROUTES measure this now (faust/live.js AUDIT-TRUTH). The WAV/media-element
  // route reads the renderer's per-voice RMS off the baked segment; the desktop
  // SharedArrayBuffer ring route gets the same measurement posted per bar by the
  // producer worker for the STREAM voices, plus a native-lane count (notes scheduled
  // vs notes dropped for an undecoded buffer) for the sampler/found voices the ring
  // route plays outside the stream. What hatching means is therefore precise: a lane
  // is painted only when a measurement for THAT bar says it made no sound.
  // The `auditFor &&` guard still matters — a handle with no audit (an older engine,
  // or a bar whose measurement never arrived) paints nothing rather than guessing.
  // Absence of hatching is "not flagged", never "verified audible".
  let auditSilent=null;
  try{
    if(faustHandle&&faustHandle.auditFor&&S.barInfo&&S.barInfo.serial!=null){
      const a=faustHandle.auditFor(S.barInfo.serial);
      // silentRoles is the engine's LANE rollup: a role appears only when every voice
      // in it that expected notes measured silent. Prefer it — a per-voice anomaly
      // list would paint the whole drum row for one dead kit piece. An engine that
      // provides it and reports NONE is a bar with nothing to paint, so do not fall
      // through to the anomaly list; that fallback is for a handle without the rollup.
      if(a&&a.silentRoles){
        const rs=Object.keys(a.silentRoles);
        if(rs.length){ auditSilent={};
          for(const r of rs) auditSilent[r]={reason:a.silentRoles[r].reason,missing:a.silentRoles[r].missing||[]}; }
      }else if(a&&a.anomalies&&a.anomalies.length){ auditSilent={};
        for(const an of a.anomalies) if(!auditSilent[an.role]) auditSilent[an.role]={reason:an.reason,missing:an.missing||[]}; }
    }
  }catch(e){}
  const timeline={cbeats:bar.cbeats, view:VIEW, pages:Math.max(1,Math.ceil(bar.cbeats/VIEW)),
    spb:bar.spb, bpm:bar.bpm, lanes:timelineLanes(st, roster, found, bar, auditSilent), audit:auditSilent};
  let graph=null; try{ graph=graphData(st, U, bar); }catch(e){}
  // meter badge: always shown — the timeline's
  // 8-cell fold visually erases a waltz grid, so the meter must say itself.
  const meter=st.meter?`${st.meter.beats}/${st.meter.unit}`:"4/4";
  return {blend, feel:feelAxes(st), roster, found, info, master:masterFx(st), timeline, graph,
    mind:mindData(st), meter, harmony:bar.harmony||null, structure:structureData(st,bar), timing:timingData(st)};
}
// headless gate: read the live viz content, and — for the chord-chip binding
// check — resolve ANY state's harmony through the panel's own path, so the gate
// compares what this panel would print against CsdEngine.resolveProgression
// rather than against a second copy of the walk.
window.__VIZ={ data:()=>vizData(),
  harmonyFor:(st)=>{ try{ return barVoiceEvents(st,{ci:0,serial:0,section:""}).harmony; }catch(e){ return null; } },
  // …and what the panel WOULD call any sampler in the library, so the gate can
  // sweep all of them rather than only the handful a live blend happens to voice.
  nameOf:(samplerId)=>{ try{ return voiceName("melody",{model:"sampler",sampler:{id:samplerId}},{}); }catch(e){ return null; } } };
export function renderInside(){
  const box=document.getElementById("inside"); if(!box) return;
  const d=vizData();
  const seg=d.blend.filter(b=>b.pct>0).map(b=>`<div style="width:${b.pct}%;background:${genreCol(b.g)}" title="${esc(b.label)} ${b.pct}%"></div>`).join("");
  const legend=d.blend.filter(b=>b.pct>0).map(b=>`<span class="vz-g"><i style="background:${genreCol(b.g)}"></i>${esc(b.label)} <b>${b.pct}%</b></span>`).join("");
  // the MASTER effects text line is replaced by the visual MIXING NODE GRAPH.
  // Guarded like the timeline — a graph hiccup must never blank the whole panel.
  let graphHtml=""; try{ if(d.graph){ const svg=graphSVG(d.graph);
    if(svg) graphHtml=`<div class="vz-sec"><div class="vz-lbl">signal flow — how effects are invoked</div>${svg}</div>`; } }
  catch(e){ try{console.warn("inside: graph render skipped:",e);}catch(_){}}
  // the mind's moves + the micro-timing, as one quiet text line under the radar
  const moves=movesHTML(d);
  // the harmony cycle + the form arc, as chips (self-guarded — see captions.js)
  const hfHtml=harmonyFormHTML(d);
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
    `<div class="vz-sec"><span class="vz-meter" title="meter — beats per bar / beat unit">${esc(d.meter||"4/4")}</span>${radarSVG(d.feel)}${moves}</div>`+
    hfHtml+
    `<div class="vz-sec">${tlHtml}</div>`+
    graphHtml;
  // arm the playhead ticker only when it has work (live + modal open); it stops itself.
  const wrap=document.getElementById("insideWrap");
  if(S.live&&wrap&&wrap.classList.contains("open")) ensurePhTicker();
}
