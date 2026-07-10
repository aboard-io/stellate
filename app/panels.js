// panels.js — the modal controls (a Preact-rendered ⚙ panel: transport, seed,
// pace, the eight macro sliders, the DIMS detail sliders, preset/path import-
// export) plus the chip↔modal plumbing (⚙ panel, ⓘ inside, ▶ play) that keeps
// the sky clean until a chip is tapped. Registers the store render subs.
import { S, set, subs, html, render, macrosOn } from "./state.js";
import { MODE_LOCKS, BARS_PER_SEG } from "./world.js";
import { goLive, stopLive } from "./live.js";
import { retarget, setMacro, resetMacros, weightsAt } from "./targeting.js";
import { renderInside } from "./inside.js";
import { bgVideoToggle, bgVideoOn } from "./background.js";
import { seedDefaultLoop, drawMap, startPulse } from "./starmap.js";
import { EXPORT, downloadMidi, exportAudio } from "./export.js";

const MACRO_AXES=[["acoustic","acoustic","synth"],["density","simple","layered"],["dust","dusty","clean"],
  ["space","dry","drenched"],["bright","dark","bright"],["feel","tight","loose"],["energy","calm","intense"],["vocal","instr","vocal"]];

// ---------- Preact panel ----------
const DIMS=[
  ["bpm",st=>st.bpm,(st,v)=>{st.bpm=Math.round(v);S.target&&(S.target.bpm=Math.round(v));},50,180,1],
  ["swing",st=>st.swing,(st,v)=>{st.swing=v;S.target&&(S.target.swing=v);},0,.45,.01],
  ["humanize",st=>st.humanize,(st,v)=>{st.humanize=v;S.target&&(S.target.humanize=v);},0,.7,.01],
  ["reverb",st=>st.reverb,(st,v)=>{st.reverb=v;S.target&&(S.target.reverb=v);},.3,.95,.01],
  ["pump",st=>st.pump||0,(st,v)=>{st.pump=v;S.target&&(S.target.pump=v);},0,.8,.01],
  ["crackle",st=>st.crackle||0,(st,v)=>{st.crackle=v;S.target&&(S.target.crackle=v);},0,.9,.01],
  ["compress",st=>st.comp||0,(st,v)=>{st.comp=v;S.target&&(S.target.comp=v);},0,.9,.01],
  ["grit",st=>st.grit||0,(st,v)=>{st.grit=v;S.target&&(S.target.grit=v);},0,.8,.01],
  ["snare",st=>st.instruments.drums.snare,(st,v)=>{st.instruments.drums.snare=v;S.target&&(S.target.instruments.drums.snare=v);},.3,1.4,.01],
  ["voices",st=>st.instruments.melody.voices,(st,v)=>{st.instruments.melody.voices=Math.round(v);S.target&&(S.target.instruments.melody.voices=Math.round(v));},1,8,1],
  ["found",st=>st.foundSources[0].vol,(st,v)=>{st.foundSources[0].vol=v;S.target&&(S.target.foundSources[0].vol=v);},0,.4,.01],
];
function Panel(){
  if(!S.playing) return html`<div>…</div>`;
  return html`
    <div class="btns" style="margin-top:0">
      <button class="go" onclick=${goLive}>▶ LIVE</button>
      <button onclick=${stopLive}>■ STOP</button>
      <button onclick=${()=>set({more:!S.more})}>${S.more?"× less":"⚙ more"}</button>
      <button title="background video on/off (alternates with demoscene; default off)"
        onclick=${()=>{if(!bgVideoToggle())set({status:"video layer still loading (or no clips) — try again in a moment"});}}>${bgVideoOn()?"▣ video":"▢ video"}</button>
    </div>
    <div class="row"><label>seed</label>
      <input class="seedin" type="number" value=${S.seed}
        onchange=${e=>{set({seed:+e.target.value||1});retarget(S.cursor);}} />
      <button onclick=${()=>{set({seed:Math.floor(Math.random()*99999)});retarget(S.cursor);}}>🎲</button></div>
    <div class="row"><label>pace (bars/leg)</label>
      <input type="range" min="4" max="12" step="1" value=${Math.round(Math.log2(Math.max(16,Math.min(4096,+S.pace||BARS_PER_SEG))))}
        onInput=${e=>set({pace:Math.pow(2,Math.max(4,Math.min(12,+e.target.value||8)))})} />
      <output>${S.pace}</output></div>
    <div class="mac">
      <div class="mac-h"><span>macros — bend every genre at once</span>
        <button class="mac-rst" title="reset all axes to neutral"
          onclick=${resetMacros} disabled=${!macrosOn(S.macros)}>reset</button></div>
      ${MACRO_AXES.map(([k,lo,hi])=>html`
        <div class="mrow ${S.macros[k]?"act":""}">
          <span class="ml">${lo}</span>
          <input type="range" min="-1" max="1" step="0.05" value=${S.macros[k]}
            onInput=${e=>setMacro(k,+e.target.value)} />
          <span class="mr">${hi}</span></div>`)}
    </div>
    ${S.more?html`
    <div class="row"><label>mode/scale</label>
      <select value=${S.modeLock} onchange=${e=>{set({modeLock:e.target.value});retarget(S.cursor);}}>
        ${Object.keys(MODE_LOCKS).map(m=>html`<option value=${m}>${m}</option>`)}
      </select></div>
    ${DIMS.map(([name,get,setv,min,max,step])=>html`
      <div class="row"><label>${name}</label>
        <input type="range" min=${min} max=${max} step=${step} value=${get(S.playing)}
          onInput=${e=>{setv(S.playing,+e.target.value);set({});}} />
        <output>${(+get(S.playing)).toFixed(step>=1?0:2)}</output></div>`)}
    <div class="btns">
      <button onclick=${()=>{
        const a=document.createElement("a");
        a.href=URL.createObjectURL(new Blob([JSON.stringify(S.playing,null,2)],{type:"application/json"}));
        a.download="stellate-preset.json";a.click();}}>⤓ preset</button>
      <button onclick=${()=>{
        // export the drawn path (or the cursor point) as journey waypoints:
        //   node genre-kernel.js journey stellate-path.json --hours 4 --render --video
        const pts=S.waypoints.length?S.waypoints:[S.cursor];
        const pathJson={kind:"genre-space-path",version:1,seed:S.seed,modeLock:S.modeLock,
          waypoints:pts.map(p=>({x:Math.round(p.x),y:Math.round(p.y),
            weights:weightsAt(p).map(w=>({g:w.g,w:+w.w.toFixed(3)}))}))};
        const a=document.createElement("a");
        a.href=URL.createObjectURL(new Blob([JSON.stringify(pathJson,null,2)],{type:"application/json"}));
        a.download="stellate-path.json";a.click();
        set({status:"path exported — render it: node genre-kernel.js journey stellate-path.json --hours 4 --render --video"});}}>⤓ path</button>
      <button onclick=${()=>{
        // import a journey saved by ⤓ path
        const inp=document.createElement("input");
        inp.type="file"; inp.accept="application/json";
        inp.onchange=()=>{ const f=inp.files[0]; if(!f) return;
          f.text().then(txt=>{
            const p=JSON.parse(txt);
            if(!Array.isArray(p.waypoints)||!p.waypoints.length||
               !p.waypoints.every(w=>isFinite(+w.x)&&isFinite(+w.y))) throw new Error("no waypoints");
            const wps=p.waypoints.map(w=>({x:+w.x,y:+w.y}));
            set({waypoints:wps,travel:{seg:0,t:0},
              seed:p.seed!=null?p.seed:S.seed,modeLock:p.modeLock||S.modeLock,
              status:"path loaded — "+wps.length+" waypoints"});
            retarget(wps[0]);
          }).catch(e=>set({status:"bad path file — "+e.message}));};
        inp.click();}}>⤒ path</button>
      <button onclick=${()=>seedDefaultLoop()}>↺ reset loop</button>
      <button disabled=${!S.playing||EXPORT.busy}
        title=${!S.playing?"nothing playing yet — the buttons capture the current song":"Standard MIDI File of the current song (pads/bass/melody + GM drums), named from the chyron's band card"}
        onclick=${()=>downloadMidi()}>⤓ midi</button>
      <button disabled=${!S.playing||EXPORT.busy}
        title=${!S.playing?"nothing playing yet — the buttons capture the current song":"offline-press the current song to lossless WAV (44.1k/16 stereo, the full mix) — takes a minute; progress shows in the status line"}
        onclick=${()=>exportAudio("wav")}>${EXPORT.busy?"…pressing":"⤓ wav"}</button>
      <button disabled=${!S.playing||EXPORT.busy}
        title=${!S.playing?"nothing playing yet — the buttons capture the current song":"offline-press the current song, then encode MP3 (192kbps) — takes a minute; progress shows in the status line"}
        onclick=${()=>exportAudio("mp3")}>⤓ mp3</button>
    </div>
    <p class="hint">the path is a closed 3-step loop (waypoint 1 = centre) · dbl-click the sky to add a waypoint ·
    right-click a waypoint to erase (erase to nothing re-seeds the loop) · ↺ reset loop restores it ·
    pinch / ctrl+scroll zooms the spread ·
    ⤓/⤒ path saves and reloads a journey · render it: node genre-kernel.js journey ${"<path.json>"} --render --video</p>`:""}`;
}
const panel=document.getElementById("panel");
subs.push(()=>{ render(Panel(),panel); drawMap(); startPulse(); });   // startPulse: resume the breath loop when travel (re)starts

// ---------- chips + modals: the sky stays clean until asked ----------
const MODALS={ panel:document.getElementById("panelWrap"), inside:document.getElementById("insideWrap"),
  about:document.getElementById("aboutWrap") };   // about = the ? layer (static content in index.html)
const CHIP_OF={ panel:"cfgChip", inside:"insideChip", about:"helpChip" };
function toggleModal(which,force){
  const el=MODALS[which];
  const open=force!=null?force:!el.classList.contains("open");
  el.classList.toggle("open",open);
  document.getElementById(CHIP_OF[which]).classList.toggle("on",open);
  if(which==="inside"&&open) renderInside();   // populate immediately on open (then subs keep it live)
}
document.getElementById("cfgChip").onclick=()=>toggleModal("panel");
document.getElementById("insideChip").onclick=()=>toggleModal("inside");
document.getElementById("helpChip").onclick=()=>toggleModal("about");
// keep the ⓘ readout live: re-render every frame it's open (cheap; the radar is a
// handful of SVG nodes). Closed = no work beyond the on-map glyph drawMap draws.
subs.push(()=>{ if(MODALS.inside.classList.contains("open")) renderInside(); });
for(const [k,el] of Object.entries(MODALS))
  el.addEventListener("pointerdown",e=>{ if(e.target===el) toggleModal(k,false); });   // tap outside = dismiss
addEventListener("keydown",e=>{ if(e.key==="Escape") for(const k of Object.keys(MODALS)) toggleModal(k,false); });
// LIVE/STOP is ONE tap from the clean sky
const playChip=document.getElementById("playChip");
playChip.onclick=()=>{ S.live?stopLive():goLive(); };
subs.push(()=>{ playChip.textContent=S.live?"■":"▶"; playChip.classList.toggle("live",!!S.live); });
