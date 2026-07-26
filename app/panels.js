// panels.js — the ⚙ panel (Paul 2026-07-10 redesign: seed + ⧉ share, pace and
// a live ±BPM delta — NOTHING else: the transport lives on ▶, the views on the
// ONE view chip, and the old LIVE/STOP/MORE/VIDEO buttons, mode lock, DIMS
// detail sliders and preset/path/reset plumbing are gone) plus the chip↔view
// wiring. The ⤓ download cluster went with them 2026-07-25 and ONE button came
// back 2026-07-26 (Paul: "I want midi back") — ⤓ midi only; wav/mp3/video stay
// on branch legacy-download-video.
import { S, set, subs, html, render } from "./state.js";
import { BARS_PER_SEG } from "./world.js";
import { goLive, stopLive, setMasterVol, setVapor } from "./live.js";
import { fontManifest, setSoundfont } from "./fonts.js";
import { renderInside } from "./inside.js";
import { drawMap, startPulse } from "./starmap.js";
import { copyShareUrl, buildShareUrl, loopBars, loopDuration, baseDuration, durMult, fmtDuration, fmtMult, MULT_MIN, MULT_MAX } from "./share.js";
import { downloadMidi, midiFileName } from "./export.js";   // ⤓ midi (restored 2026-07-26; MIDI only)

// ---------- EMBED: the paste-into-your-blog snippet -------------------------
// (2026-07-25) The ↗ share button hands out a LINK; this hands out the same mix
// as an <iframe>. It is built from buildShareUrl() — one URL grammar, so an
// embed carries whatever the map is showing right now: seed, path, measure,
// speed multiple, soundfont. Only the FILE changes (index → embed.html), which
// is why this reuses the share URL rather than assembling its own query.
//
// The attributes are the boring, correct ones and each is load-bearing:
//   title=        — the frame's accessible name (screen readers, a11y audits)
//   loading=lazy  — an embed far down a page costs the host nothing until seen
//   allow="autoplay; clipboard-write" — WE NEVER AUTOPLAY (embed.js gates on a
//                   real gesture), but without the autoplay permission Chrome
//                   blocks the AudioContext EVEN AFTER the user taps inside the
//                   frame; clipboard-write lets the framed ↗ share still copy
//   referrerpolicy — send the origin, not the host's full path
//   style="border:0"  — the modern spelling of frameborder=0
//   aspect-ratio + min-height — responsive without a resize script: the frame
//                   fills the host's column and keeps a sane shape on phones
export function embedUrl(){
  const share=buildShareUrl();                       // origin + path + ?seed…&m=…
  const q=share.indexOf("?")>=0?share.slice(share.indexOf("?")):"";
  return location.origin+location.pathname.replace(/[^/]*$/,"")+"embed.html"+q;
}
export function embedSnippet(){
  return '<iframe src="'+embedUrl().replace(/&/g,"&amp;")+'"\n'+
    '  title="STELLATE — draw a path through genre space"\n'+
    '  width="100%" height="480" loading="lazy"\n'+
    '  allow="autoplay; clipboard-write"\n'+
    '  referrerpolicy="strict-origin-when-cross-origin"\n'+
    '  style="border:0;width:100%;max-width:100%;height:480px;aspect-ratio:16/10;min-height:320px;border-radius:12px"></iframe>';
}
// same clipboard behaviour (and same legacy fallback) as share.js copyShareUrl.
function copyEmbed(){
  const t=embedSnippet();
  const ok=()=>set({status:"embed code copied — paste it into any page"});
  const fallback=()=>{ try{ const ta=document.querySelector("#panel .embedbox")||document.createElement("textarea");
    if(!ta.isConnected){ ta.value=t; document.body.appendChild(ta); }
    ta.select(); ta.setSelectionRange(0,ta.value.length); document.execCommand("copy");
    if(!ta.closest("#panel")) ta.remove(); ok();
  }catch(e){ set({status:"copy failed — select the embed code and copy it"}); } };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok,fallback);
  else fallback();
}

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
  const vol=Math.round((S.masterVol!=null?S.masterVol:1)*100), vap=Math.round((S.vapor||0)*100);
  const bpm=S.playing?Math.round(S.playing.bpm):0, dl=S.bpmDelta||0;
  return html`
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

    <div class="psec"><div class="ptitle">download</div>
      <div class="row"><label title="a Standard MIDI File of the song playing right now — pads, bass, melody and GM drums, at this tempo and key">midi</label>
        <button class="mini" disabled=${!S.playing}
          title=${"save “"+midiFileName()+"” — the same notes you are hearing, from this seed at this point on the path"}
          onclick=${()=>downloadMidi()}>⤓ midi</button></div>
    </div>

    <div class="psec"><div class="ptitle">embed</div>
      <textarea class="embedbox" readonly spellcheck="false" rows="5"
        aria-label="iframe embed code for this mix"
        onFocus=${e=>e.target.select()} value=${embedSnippet()}></textarea>
      <div class="row"><label title="a lightweight player — the map plus ▶, no settings — pointed at THIS seed, path and measure">iframe</label>
        <button class="mini" title="copy the &lt;iframe&gt; snippet for this exact mix"
          onclick=${copyEmbed}>⧉ copy embed</button>
        <a class="mini" href=${embedUrl()} target="_blank" rel="noopener"
          title="open the embed player in a new tab">preview ↗</a></div>
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
// THE VIEW CYCLE (one button, THREE 100% views): map -> viz -> ALIENS -> map.
// The chip's icon tracks the CURRENT view (background.js applyBg). Aliens = the 3D
// star-cruise (window.__STARCRUISE), started/stopped like any other view — no separate
// chip, no ✕ EXIT button; the ✦ chip cycles right out of it.
document.getElementById("viewChip").onclick=()=>{
  const chip=document.getElementById("viewChip");
  const SC=window.__STARCRUISE;
  // THREE views (Paul: "get rid of video mode"): map -> viz -> aliens -> map.
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
// ---------- HONEST FAILURE: when audio can't start at all -------------------
// goLive()'s catch sets status "live failed: …" and pulls the warm-up hairline
// straight back down — on the full page the chyron still carries the reason, but
// in a 400px embed (no chyron, no settings) the box just went quiet with no
// explanation. So re-raise the hairline in its FAIL colour with the real
// message. Deferred a tick because live.js's bootAbort() runs immediately AFTER
// the set() that publishes the status, and would otherwise clear this again.
// Lives here, not in live.js, so the live engine keeps one owner this session.
let lastFail="";
subs.push(()=>{
  const m=String(S.status||"");
  if(!/^live failed/i.test(m)){ if(lastFail){ lastFail=""; const b=document.getElementById("boot"); if(b) b.classList.remove("fail"); } return; }
  if(m===lastFail) return;
  lastFail=m;
  setTimeout(()=>{
    const b=document.getElementById("boot"); if(!b) return;
    const lbl=b.querySelector(".blabel"), fill=b.querySelector(".bfill");
    if(fill) fill.style.width="100%";
    if(lbl) lbl.textContent="audio couldn't start — "+m.replace(/^live failed:\s*/i,"");
    b.classList.add("on","fail"); b.classList.remove("ind");
  },0);
});
// LIVE/STOP is ONE tap from the clean sky
const playChip=document.getElementById("playChip");
playChip.onclick=()=>{ S.live?stopLive():goLive(); };
subs.push(()=>{ playChip.textContent=S.live?"■":"▶"; playChip.classList.toggle("live",!!S.live); });
