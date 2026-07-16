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
import { drawMap, startPulse } from "./starmap.js";
import { EXPORT, downloadMidi, exportAudio, exportLoopAudio } from "./export.js";
import { recordVideo, stopVideo, VIDEO } from "./video-export.js";
// ⤓ audio: the WHOLE PATH when a loop is drawn (Paul: "export the entire path"),
// else the current song — mirrors downloadMidi's own whole-path routing.
const exportAudioSmart = (fmt) => (S.waypoints.length >= 2 ? exportLoopAudio(fmt) : exportAudio(fmt));
// Paul 2026-07-13: show ONLY the MIDI download for now — hide wav/mp3/video.
// Flip to true to bring the audio + video render downloads back.
const SHOW_AV_DOWNLOADS = false;
import { copyShareUrl, loopBars, loopDuration, baseDuration, durMult, fmtDuration, fmtMult, MULT_MIN, MULT_MAX } from "./share.js";

// ---------- Preact panel ----------
// SPEED SLIDER (Paul 2026-07-16): a LOG MULTIPLE of the path's own distance-
// derived default duration — ×0.01 (100× faster, left) … ×1,000,000 (a million
// times longer, right), ×1 at the marked center. The slider is a 0..1000
// integer over the 8 decades; the ×1 detent sits at v=250. The base time is
// measured off the path (share.js baseDuration) and shown in the readout +
// the node-drag tooltip; playback = the default rate adjusted by the multiple.
const DUR_STEPS = 1000, MULT_DECADES = Math.log10(MULT_MAX / MULT_MIN);   // 8
const multToSlider = m => Math.round(DUR_STEPS * Math.log10(Math.max(MULT_MIN, Math.min(MULT_MAX, m)) / MULT_MIN) / MULT_DECADES);
const sliderToMult = v => {
  const raw = MULT_MIN * Math.pow(10, MULT_DECADES * Math.max(0, Math.min(DUR_STEPS, +v || 0)) / DUR_STEPS);
  return Math.abs(raw - 1) < 0.06 ? 1 : raw;   // soft ×1 detent at center
};
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
  const busy=EXPORT.busy||VIDEO.recording, pct=S.exportPct;
  const vol=Math.round((S.masterVol!=null?S.masterVol:1)*100), vap=Math.round((S.vapor||0)*100);
  const bpm=S.playing?Math.round(S.playing.bpm):0, dl=S.bpmDelta||0;
  return html`
    ${pct!=null ? html`<div class="exprog">
      <div class="exbar"><div class="exfill" style=${"width:"+Math.round(pct*100)+"%"}></div></div>
      <div class="exlabel">${S.exportLabel||"exporting"} · ${Math.round(pct*100)}%</div></div>` : ""}

    <div class="psec"><div class="ptitle">mix</div>
      <div class="row"><label>volume</label>
        <input type="range" min="0" max="150" step="1" value=${vol}
          onInput=${e=>setMasterVol((+e.target.value||0)/100)} />
        <output>${vol}%</output></div>
      <div class="row"><label title="the mix recedes into a huge empty mall — muffled, distant, drenched in reverb; eases in over a few bars">vapor</label>
        <input type="range" min="0" max="100" step="1" value=${vap}
          onInput=${e=>setVapor((+e.target.value||0)/100)} />
        <output>${vap}%</output></div>
      <div class="row"><label>soundfont</label>
        <select class="sfsel" onChange=${e=>setSoundfont(e.target.value)}>
          ${fontManifest().map(f=>html`<option value=${f.key} selected=${(S.soundfont||"fluidr3")===f.key}>${f.label}</option>`)}
        </select></div>
    </div>

    <div class="psec"><div class="ptitle">structure</div>
      <div class="row"><label>seed</label>
        <input class="seedin" type="number" value=${S.seed}
          onchange=${e=>{set({seed:+e.target.value||1});}} />
        <button class="mini" title="random seed" onclick=${()=>{set({seed:Math.floor(Math.random()*99999)});}}>🎲</button>
        <button class="mini" title="copy a link to THIS mix — seed, path and measure ride the URL"
          onclick=${copyShareUrl}>↗ share</button></div>
      <div class="row"><label title=${"faster ⇠ ×1 ⇢ slower — a log multiple of the path's own time (this path ≈ "+fmtDuration(baseDuration())+" at ×1); ×0.01 = 100× faster, ×1,000,000 = the Longplayer end"}>speed</label>
        <input type="range" min="0" max="1000" step="1" value=${multToSlider(durMult())}
          onInput=${e=>set({durMult:sliderToMult(+e.target.value)})} />
        <output>${fmtMult(durMult())} · ${fmtDuration(loopDuration())}</output></div>
      <div class="row"><label>±bpm</label>
        <input type="range" min="-64" max="64" step="1" value=${dl}
          onInput=${e=>setBpmDelta(e.target.value)} />
        <output>${bpm} bpm${dl?" ("+(dl>0?"+":"")+dl+")":""}</output></div>
    </div>

    <div class="psec"><div class="ptitle">export</div>
      <div class="btns">
        <button disabled=${!S.playing||busy} title="Standard MIDI File — the whole path if a loop is drawn, else the current song"
          onclick=${()=>downloadMidi()}>⤓ midi</button>
        ${SHOW_AV_DOWNLOADS ? html`
        <button disabled=${!S.playing||busy} title=${S.waypoints.length>=2?"render the ENTIRE PATH to lossless WAV (in your browser)":"render the current song to lossless WAV"}
          onclick=${()=>exportAudioSmart("wav")}>⤓ wav</button>
        <button disabled=${!S.playing||busy} title=${S.waypoints.length>=2?"render the ENTIRE PATH to MP3 192k":"render the current song to MP3 192k"}
          onclick=${()=>exportAudioSmart("mp3")}>⤓ mp3</button>
        <button disabled=${!S.playing||EXPORT.busy} class=${VIDEO.recording?"rec":""}
          title="record ~30s of the live visuals + audio to a .webm video"
          onclick=${()=>VIDEO.recording?stopVideo():recordVideo({seconds:30})}>${VIDEO.recording?"⏹ stop":"⤓ video"}</button>` : ""}
      </div>
    </div>
    <p class="hint">dbl-tap the sky to add a waypoint · drag the pink playhead to scrub · right-click a waypoint to erase · the URL is the bookmark</p>`;
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
// THE VIEW CYCLE (one button, FOUR 100% views): map -> viz -> video -> ALIENS -> map.
// The chip's icon tracks the CURRENT view (background.js applyBg). Aliens = the 3D
// star-cruise (window.__STARCRUISE), started/stopped like any other view — no separate
// chip, no ✕ EXIT button; the ✦ chip cycles right out of it.
document.getElementById("viewChip").onclick=()=>{
  const chip=document.getElementById("viewChip");
  const SC=window.__STARCRUISE;
  // THREE views only (Paul: "get rid of video mode"): map -> viz -> aliens -> map.
  if(SC&&SC.isRunning()){           // aliens -> map
    SC.stop(); chip.classList.remove("spin");
  } else if(S.vizView){             // viz -> ALIENS
    toggleModal("inside",false);
    if(SC){ chip.classList.add("spin"); Promise.resolve(SC.start()).then(()=>chip.classList.remove("spin")); }
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
