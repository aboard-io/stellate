// timeline.js — THE VOICE TIMELINE: the ⓘ readout's piano roll. Three stages,
// in order: assemble the LANES from the roster + this bar's events
// (timelineLanes), draw the roll as absolutely-positioned blocks in a beat grid
// (timelineHTML → lanePages → noteSegs), and sweep the shared measure playhead
// between full re-renders (ensurePhTicker → phFrame). VIEW — the constant 8-cell
// window — is the unit the whole panel pages by, so vizData reads it from here.
import { S, esc } from "../../core/state.js";
import { faustHandle } from "../../audio/live.js";
import { FOUND_ROLE_CHAR, FOUND_ROLE_LABEL } from "./describe.js";

// assemble timeline LANES: one per voice (pad/bass/lead/solo/drums/found), each
// carrying the roster's instrument NAME + fx chips and this bar's note events.
// A lane shows whenever the instrument is voiced (roster) OR it has notes this bar.
export function timelineLanes(st, roster, found, bar, audit){
  const by={}; roster.forEach(r=>by[r.role]=r);
  // ALL TRACKS: stabs/hits and spoken/vocal layers are their own lanes, not
  // folded into lead/found — every track that plays is a track you can see.
  const specs=[
    {key:"pad",    from:"pad",  label:"pad",     col:"--purple", roles:["pad"]},
    {key:"bass",   from:"bass", label:"bass",    col:"--cyan",   roles:["bass"]},
    {key:"melody", from:"lead", label:"lead",    col:"--pink",   roles:["melody"]},
    {key:"solo",   from:"lead", label:"counter", col:"--amber",  roles:["solo"]},
    {key:"drums",  from:"kit",  label:"drums",   col:"--mint",   roles:["drums"]},
    {key:"stabs",  from:null,   label:"stabs",   col:"--amber",  roles:["sfx"]},
    {key:"voices", from:null,   label:"voices",  col:"--pink",   roles:["voices"]},
    {key:"found",  from:null,   label:"found",   col:"--cyan",   roles:["found"]},
  ];
  const lanes=[];
  for(const sp of specs){
    const notes=bar.notes.filter(n=>sp.roles.indexOf(n.role)>=0);
    const r=sp.from?by[sp.from]:null;
    // the counter/stabs/voices lanes only EARN a row with actual notes this bar
    // (the counter shares the lead's roster entry, so it used to render empty).
    const has=(sp.key==="solo"||sp.key==="stabs"||sp.key==="voices")?notes.length
      :(r||notes.length||(sp.key==="found"&&found.length));
    if(!has) continue;
    // the found lane is NAMED by its state role (a break, a chop, a narration
    // and a bed are indistinguishable as events); a bed keeps the per-source
    // texture character, which says more than the word "bed".
    const name=r?r.name:
      sp.key==="found"?(FOUND_ROLE_CHAR[bar.foundRole]||found[0]||"tape atmosphere"):
      sp.key==="voices"?((notes[0]&&notes[0].kind==="speech")?"cut-up announcer voice":"vocal fragments"):
      sp.key==="stabs"?"synth stabs":sp.label;   // the sfx/stab lane is the SYNTH stab voice (stab.dsp); the SAMPLED one-shot stabs render in the found lane as FOUND_CHAR.hit ("sampled stabs")
    // AUDIT-TRUTH: this lane's role was EXPECTED-BUT-SILENT in the measured audit for
    // this bar (not just the score) → paint it red/hatched with the probable reason.
    let sil=null;
    if(audit) for(const rl of sp.roles){ if(audit[rl]){ sil=audit[rl]; break; } }
    const label=(sp.key==="found"&&FOUND_ROLE_LABEL[bar.foundRole])||sp.label;
    lanes.push({ key:sp.key, label, name, col:sp.col, fx:r?(r.fx||[]):[],
      notes, drumLane:sp.key==="drums"||sp.key==="found"||sp.key==="voices"||sp.key==="stabs",
      silent:!!sil, silReason:sil?sil.reason:null, silMissing:sil?(sil.missing||[]):[] });
  }
  return lanes;
}
// the VOICE TIMELINE as HTML: a lane per voice, note events drawn as absolutely
// positioned blocks in a beat-gridded roll. x = onset (beat/cbeats), width =
// duration; melodic lanes map PITCH to y (high notes ride high), drum/found lanes
// stack each hit type on its own row. Block opacity = velocity. All CSS/HTML (no
// SVG) so it stays crisp, responsive and cheap to rebuild every frame.
const DRUM_ROW={ crash:0.02, hat:0.10, ride:0.20, shaker:0.27, tom:0.34, clap:0.44, snare:0.52, rim:0.60, stick:0.60, perc:0.68, kick:0.76, cowbell:0.30, found:0.5, voices:0.5, stab:0.5, bed:0.18 };   // every sampled-kit piece gets its own row
// THE UNIT IS ALWAYS 8: the visible roll is a constant 8-cell
// window whatever the genre's harmonic rhythm. chordEvery=16/32 structures PAGE
// (stacked fold rows read as double bars for each lane — duplication, not
// continuation). ONE 8-cell row per lane; while live the
// window slides to the next 8 beats when the beat crosses a page edge. Idle
// shows page 1. A bed spanning the chord bar lands a clipped slice on EVERY page.
export const VIEW=8;
const MEAS_BEATS=1;   // the playhead lights ONE ruler cell at a time: each BAR lights as it progresses, not four bars at once
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
export function timelineHTML(tl){
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
    // EFFECTS ARE NODES: they are not listed under the piano rolls, they are
    // nodes in the graph. There is no per-lane fx caption; the mixing node graph
    // beneath the rolls (graphSVG) is the fx surface.
    // AUDIT-TRUTH silent-lane paint: red-hatched roll + a ✕ badge naming the reason.
    const silBadge=L.silent?`<span class="vz-silbadge" title="${esc(L.silReason==="missing"?("missing samples: "+(L.silMissing||[]).join(", ")):(L.silReason==="nan"?"render NaN (blown-up filter/strip)":"buffers present but silent — render-side mute"))}">✕ ${esc(L.silReason||"silent")}</span>`:"";
    // TITLE ABOVE THE ROLL: the lane's name+role is its own full-width header
    // ABOVE the piano-roll rather than a fixed column beside it,
    // so every roll spans the full width and the lanes breathe vertically. The tiny
    // fx caption still rides BENEATH the roll.
    // the roll: ONE 8-cell row per lane, always. Longer chord bars ride a pager
    // strip clipped behind the fixed grid; a page flip is a fast slide, not a scroll.
    const inner=lanePages(L,cb).map((h,p)=>`<div class="vz-page" style="width:${pw}%">${h}`+
      (p===pages-1&&deadW>0.5?`<div class="vz-dead" style="width:${deadW.toFixed(2)}%"></div>`:"")+`</div>`).join("");
    const roll=`<div class="vz-roll${L.silent?" vz-silent":""}" style="background-image:${grid}">`+
      `<div class="vz-pager" style="width:${pages*100}%;transform:translateX(${shift}%)">${inner}</div></div>`;
    return `<div class="vz-tlrow${L.silent?" vz-silent":""}">`+
      `<div class="vz-tlmain">`+
      `<div class="vz-tlhead">`+
      `<div class="vz-tlname"><i style="background:var(${L.col})"></i>${esc(L.name)}${silBadge}</div>`+
      `<div class="vz-tlrole">${esc(L.label)}</div></div>`+
      roll+`</div></div>`;
   }catch(e){ try{console.warn("inside: lane",L&&L.key,"skipped:",e);}catch(_){} return ""; }
  }).join("");
  // ONE shared playhead spanning every lane (they share the beat grid) —
  // rendered dormant when idle; the ~10Hz ticker lights it while live. It is a
  // MEASURE BLOCK, not a sweep line: the active measure
  // (MEAS_BEATS beats) lights up and STEPS to the next, so you read "we are in
  // measure 2 of this bar" at a glance. Clamped to the window edge mid-flip.
  const measW=Math.min(100,MEAS_BEATS/VIEW*100);
  const mIdx=beat==null?0:Math.floor(beat/MEAS_BEATS);
  const mLeft=beat==null?0:Math.max(0,Math.min(100-measW,(mIdx*MEAS_BEATS-page*VIEW)/VIEW*100));
  const ph=`<div class="vz-ph${beat==null?"":" on"}" data-page="${page}"${beat==null?"":` data-beat="${beat.toFixed(3)}"`}><i style="left:${mLeft.toFixed(2)}%;width:${measW.toFixed(2)}%"></i></div>`;
  return `<div class="vz-ruler" style="background-image:${grid}">${ruler}${pgind}</div>`+
    `<div class="vz-tl" data-pages="${pages}" data-page="${page}">${rows}${ph}</div>`;
}
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
export function ensurePhTicker(){ if(!phTimer) phTimer=setInterval(phFrame,100); }
