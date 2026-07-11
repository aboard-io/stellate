// panels.js — the ⚙ panel (Paul 2026-07-10 redesign: seed + ⧉ share, pace,
// a live ±BPM delta, and the in-browser render downloads — NOTHING else: the
// transport lives on ▶, the views on the ONE view chip, and the old
// LIVE/STOP/MORE/VIDEO buttons, mode lock, DIMS detail sliders and
// preset/path/reset plumbing are gone) plus the chip↔view wiring.
import { S, set, subs, html, render } from "./state.js";
import { BARS_PER_SEG } from "./world.js";
import { goLive, stopLive, setMasterVol, setVapor } from "./live.js";
import { fontManifest, setSoundfont } from "./fonts.js";
import { renderInside } from "./inside.js";
import { bgSetVideo, bgVideoOn } from "./background.js";
import { drawMap, startPulse } from "./starmap.js";
import { EXPORT, downloadMidi, exportAudio, exportLoopAudio } from "./export.js";
import { recordVideo, stopVideo, VIDEO } from "./video-export.js";
// ⤓ audio: the WHOLE PATH when a loop is drawn (Paul: "export the entire path"),
// else the current song — mirrors downloadMidi's own whole-path routing.
const exportAudioSmart = (fmt) => (S.waypoints.length >= 2 ? exportLoopAudio(fmt) : exportAudio(fmt));
import { copyShareUrl, loopBars } from "./share.js";

// ---------- Preact panel ----------
// pace: INVERTED (left = 4096 bars/leg = slowest, right = 16 = fastest —
// "sliders should move slower to faster"), log2 steps.
const paceSlider=p=>16-Math.round(Math.log2(Math.max(16,Math.min(4096,+p||BARS_PER_SEG))));   // pace 4096->4 … 16->12? see map below
// slider v in [4..12]: pace = 2^(16-v)  (v=4 -> 4096 … v=12 -> 16)
// ±BPM DELTA (Paul: "an overall delta, so that I can subtract or add 64 BPM to
// whatever is currently playing"). The slider shifts playing+target NOW, and
// retargetWeights re-applies S.bpmDelta to every future target, so the offset
// survives travel/glides until moved back to 0.
function setBpmDelta(v){
  const d=Math.max(-64,Math.min(64,Math.round(+v||0)));
  const diff=d-(S.bpmDelta||0);
  S.bpmDelta=d;
  const cl=b=>Math.max(40,Math.min(240,Math.round(b)));
  if(S.playing) S.playing.bpm=cl(S.playing.bpm+diff);
  if(S.target)  S.target.bpm =cl(S.target.bpm+diff);
  set({});
}
function Panel(){
  if(!S.playing) return html`<div>…</div>`;
  return html`
    <div class="row"><label>seed</label>
      <input class="seedin" type="number" value=${S.seed}
        onchange=${e=>{set({seed:+e.target.value||1});}} />
      <button onclick=${()=>{set({seed:Math.floor(Math.random()*99999)});}}>🎲</button>
      <button title="copy a link to THIS mix — seed, path and the current measure ride the URL; anyone opening it drops in right here"
        onclick=${copyShareUrl}>⧉ share</button></div>
    <div class="row"><label>volume</label>
      <input type="range" min="0" max="150" step="1" value=${Math.round((S.masterVol!=null?S.masterVol:1)*100)}
        onInput=${e=>setMasterVol((+e.target.value||0)/100)} />
      <output>${Math.round((S.masterVol!=null?S.masterVol:1)*100)}%</output></div>
    <div class="row"><label title="global 'walking through a mall' EQ — rolls off the highs and adds reverb wash (live only)">vapor</label>
      <input type="range" min="0" max="100" step="1" value=${Math.round((S.vapor||0)*100)}
        onInput=${e=>setVapor((+e.target.value||0)/100)} />
      <output>${Math.round((S.vapor||0)*100)}%</output></div>
    <div class="row"><label>soundfont</label>
      <select class="sfsel" onChange=${e=>setSoundfont(e.target.value)}>
        ${fontManifest().map(f=>html`<option value=${f.key} selected=${(S.soundfont||"fluidr3")===f.key}>${f.label}</option>`)}
      </select></div>
    <div class="row"><label>pace</label>
      <input type="range" min="4" max="12" step="1" value=${16-Math.round(Math.log2(Math.max(16,Math.min(4096,+S.pace||BARS_PER_SEG))))}
        onInput=${e=>set({pace:Math.pow(2,16-Math.max(4,Math.min(12,+e.target.value||8)))})} />
      <output>~${S.waypoints.length>=2?loopBars():S.pace} bars/loop</output></div>
    <div class="row"><label>±bpm</label>
      <input type="range" min="-64" max="64" step="1" value=${S.bpmDelta||0}
        onInput=${e=>setBpmDelta(e.target.value)} />
      <output>${(S.bpmDelta||0)>0?"+":""}${S.bpmDelta||0}${S.playing?" → "+Math.round(S.playing.bpm):""}</output></div>
    <div class="btns">
      <button disabled=${!S.playing||EXPORT.busy}
        title=${!S.playing?"nothing playing yet — the buttons capture the current song":"Standard MIDI File of the current song, named from the chyron's band card — built right here in your browser"}
        onclick=${()=>downloadMidi()}>⤓ midi</button>
      <button disabled=${!S.playing||EXPORT.busy}
        title=${!S.playing?"nothing playing yet — the buttons capture the current song":(S.waypoints.length>=2?"render the ENTIRE PATH — every genre the loop crosses — to lossless WAV, right here in your browser (the whole mix; takes a while, progress in the status line)":"render the current song to lossless WAV — everything happens in your browser, takes a minute; progress shows in the status line")}
        onclick=${()=>exportAudioSmart("wav")}>${EXPORT.busy?"…rendering":"⤓ wav"}</button>
      <button disabled=${!S.playing||EXPORT.busy}
        title=${!S.playing?"nothing playing yet — the buttons capture the current song":(S.waypoints.length>=2?"render the ENTIRE PATH and encode MP3 (192kbps) — the whole journey, in your browser":"render the current song and encode MP3 (192kbps) — everything happens in your browser, takes a minute")}
        onclick=${()=>exportAudioSmart("mp3")}>⤓ mp3</button>
      <button disabled=${!S.playing}
        title=${!S.playing?"press ▶ LIVE first — video records the live visuals + audio":"record ~30s of the live visuals + audio to a .webm video (records in real time as the loop plays)"}
        onclick=${()=>VIDEO.recording?stopVideo():recordVideo({seconds:30})}>${VIDEO.recording?"⏹ stop":"⏺ video"}</button>
    </div>
    <p class="hint">dbl-tap the sky to add a waypoint · drag the pink playhead to scrub ·
    right-click a waypoint to erase · stop twice to rewind · the URL is the bookmark</p>`;
}
const panel=document.getElementById("panel");
subs.push(()=>{ render(Panel(),panel); drawMap(); startPulse(); });   // startPulse: resume the breath loop when travel (re)starts

// ---------- chips + modals: the sky stays clean until asked ----------
const MODALS={ panel:document.getElementById("panelWrap"), inside:document.getElementById("insideWrap"),
  about:document.getElementById("aboutWrap") };   // about = the ? layer (static content in index.html)
const CHIP_OF={ panel:"cfgChip", inside:"viewChip", about:"helpChip" };
function toggleModal(which,force){
  const el=MODALS[which];
  const open=force!=null?force:!el.classList.contains("open");
  el.classList.toggle("open",open);
  document.getElementById(CHIP_OF[which]).classList.toggle("on",open);
  if(which==="inside"){
    // the viz is a 100% VIEW now (Paul 2026-07-10: three exclusive views) —
    // S.vizView drives the body class + background suppression via applyBg;
    // the wrap keeps its "open" class so the ticker/gates read as before.
    set({vizView:open});
    if(open) renderInside();   // populate immediately on open (then subs keep it live)
  }
}
document.getElementById("cfgChip").onclick=()=>toggleModal("panel");
// THE VIEW CYCLE (one button, three 100% views): map -> viz -> video -> map.
// The chip's icon tracks the CURRENT view (background.js applyBg); switching
// to video arms the spinner until the layer is actually up.
document.getElementById("viewChip").onclick=()=>{
  const chip=document.getElementById("viewChip");
  if(S.vizView){                    // viz -> video (fall back to map if no footage)
    toggleModal("inside",false);
    if(bgSetVideo(true)) chip.classList.add("spin");
  } else if(bgVideoOn()){           // video -> map
    bgSetVideo(false); chip.classList.remove("spin");
  } else {                          // map -> viz
    toggleModal("inside",true);
  }
};
document.getElementById("helpChip").onclick=()=>toggleModal("about");
// keep the ⓘ readout live: re-render every frame it's open (cheap; the radar is a
// handful of SVG nodes). Closed = no work beyond the on-map glyph drawMap draws.
subs.push(()=>{ if(MODALS.inside.classList.contains("open")) renderInside(); });
for(const [k,el] of Object.entries(MODALS)){
  el.addEventListener("pointerdown",e=>{ if(e.target===el) toggleModal(k,false); });   // tap outside = dismiss
  // BELT: force-navigate links inside modals. On iOS a plain <a> tap inside the
  // about card sometimes never navigated (Paul 2026-07-10) — the exact
  // interceptor is Safari-side and unreproducible in chromium, so navigate
  // explicitly on click; harmless where native navigation already works
  // (location.assign to the same href is idempotent mid-navigation).
  el.addEventListener("click",e=>{ const a=e.target.closest&&e.target.closest("a[href]");
    if(a&&!/^https?:/.test(a.getAttribute("href"))){ e.preventDefault(); location.assign(a.href); } });
}
addEventListener("keydown",e=>{ if(e.key==="Escape") for(const k of Object.keys(MODALS)) toggleModal(k,false); });
// LIVE/STOP is ONE tap from the clean sky
const playChip=document.getElementById("playChip");
playChip.onclick=()=>{ S.live?stopLive():goLive(); };
subs.push(()=>{ playChip.textContent=S.live?"■":"▶"; playChip.classList.toggle("live",!!S.live); });
