// access.js — the ACCESSIBLE entry point (access.html). A screen-reader- and
// keyboard-first alternate view of the SAME instrument the star map plays. It
// imports the real engine modules (state / world / targeting / live) and drives
// them by an explicit genre choice or an ordered journey list instead of by
// dragging a cursor — so a listener who cannot see the map still gets
// byte-identical music for the same seed + blend + journey. No SVG, no video, no
// canvas: everything the map shows visually, this narrates as text.
//
// WHY reuse, not fork: the glide engine, the instrument-introduction holds, the
// path traveler and the determinism are all gate-verified in targeting.js /
// live.js. Re-implementing them here would drift from the map and from the
// referees. Instead this file is a thin alternate CONTROLLER + a text READOUT.
//
// The map's DOM (SVG, panels, chips) is never built here; only the two elements
// the imported modules touch at load — #boot (live.js's warm-up hairline) and
// #bgChip (background.js's toggle, imported transitively by live.js) — exist as
// inert stubs in access.html so the imports don't throw.
import { S, K, V, set } from "./state.js";
import { POS, KEYS, PROG_MODE, BARS_PER_SEG } from "./world.js";
import { loopDuration, MIN_DURATION, MAX_DURATION } from "./share.js";
import { retargetWeights, rescore } from "./targeting.js";
import { goLive, stopLive, faustHandle } from "./live.js";

const $ = id => document.getElementById(id);
const GENRES = Object.keys(K.GENRES).sort((a,b)=>label(a).localeCompare(label(b)));
function label(g){ return (K.GENRES[g] && K.GENRES[g].label) || g; }
function info(g){ return (K.GENRES[g] && K.GENRES[g].info) || ""; }

// ---------- app state (the accessible view's own, small, choices) ----------
let mode = "hold";                 // "hold" (one place) | "journey" (a loop of stops)
let lastJourneyKey = "";           // resume law: the SAME journey resumes at the stop measure; a changed one starts fresh
let single = GENRES.includes("vaporwave") ? "vaporwave" : GENRES[0];
let journey = [];                  // ordered list of genre keys

// (the eight "shape" macro sliders lived here until 2026-07-10 — Paul: "get
// rid of all macros")

// ---------- populate the genre menus ----------
function optionsHTML(includeNone){
  return (includeNone?`<option value="">— none —</option>`:``) +
    GENRES.map(g=>`<option value="${g}">${label(g)}</option>`).join("");
}
// bookmarkable, here too (Paul: "the entire site"): ?seed=N&genre=g&blend=g2&amt=30
// restores the accessible page's choices; changes update the URL in place.
function accUrlRestore(){
  const q=new URLSearchParams(location.search);
  if(q.get("seed")){ const v=parseInt(q.get("seed"),10); if(v>=1&&v<=99999) S.seed=v; }
  if(q.get("genre")&&GENRES.includes(q.get("genre"))) single=q.get("genre");
  return { blend:q.get("blend"), amt:parseInt(q.get("amt"),10) };
}
function accUrlTick(){
  try{
    const q=new URLSearchParams();
    q.set("seed",String(S.seed)); q.set("genre",$("genreSel").value);
    const bg=$("blendSel").value; if(bg){ q.set("blend",bg); q.set("amt",$("blendAmt").value); }
    history.replaceState(null,"","?"+q.toString());
  }catch(e){}
}
function boot(){
  const urlBits=accUrlRestore();
  $("genreSel").innerHTML = optionsHTML(false);
  $("blendSel").innerHTML = optionsHTML(true);
  $("journeyAdd").innerHTML = optionsHTML(false);
  $("genreSel").value = single;
  if(urlBits.blend&&GENRES.includes(urlBits.blend)){
    $("blendSel").value=urlBits.blend; $("blendAmtRow").hidden=false;
    if(urlBits.amt>=0&&urlBits.amt<=100){ $("blendAmt").value=urlBits.amt; $("blendAmtOut").textContent=urlBits.amt+"%"; }
  }
  // seed + pace defaults reflected into the controls
  $("seedInp").value = S.seed;
  $("paceRange").value = paceToSlider(loopDuration());
  syncPaceOut();
  updateGenreInfo();
  renderJourney();
  applyHold();          // seed S.playing so "Now playing" reads and Play has a target
  wire();
  logEvent("Ready. Choose a genre or build a journey, then press Play.");
  tick();
  // offline-where-possible: the same service worker as the map (cache-first for
  // the immutable found/ sample class) — playing here warms the offline set too.
  try{ if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{}); }catch(e){}
}

// ---------- HOLD mode: one place in genre space (optionally a 2-genre blend) --
function applyHold(){
  const g = $("genreSel").value;
  const bg = $("blendSel").value;
  let ws;
  if(bg){
    const amt = (+$("blendAmt").value)/100;              // fraction that is the blend genre
    ws = [{g, w:1-amt},{g:bg, w:amt}].filter(w=>w.w>0.0001);
  } else {
    ws = [{g, w:1}];
  }
  single = g;
  retargetWeights(ws);                                    // same glide path the map uses
  accUrlTick();                                           // the URL carries the choice — bookmarkable
}

// ---------- JOURNEY mode: an ordered loop of stops ----------
function setJourneyWaypoints(){
  // the traveler walks POS coordinates — reuse the exact star positions so the
  // journey crosses the same genres, at the same blends, the map would.
  S.waypoints = journey.map(g=>({ x:POS[g][0], y:POS[g][1] }));
}
function renderJourney(){
  const ol=$("journeyList");
  if(!journey.length){ ol.innerHTML=`<li class="empty">No stops yet. Add at least two.</li>`; }
  else ol.innerHTML = journey.map((g,i)=>
    `<li>
       <span class="jname">${i+1}. ${label(g)}</span>
       <span class="jbtns">
         <button type="button" data-j="up"   data-i="${i}" aria-label="Move ${label(g)} earlier" ${i===0?"disabled":""}>▲</button>
         <button type="button" data-j="down" data-i="${i}" aria-label="Move ${label(g)} later"  ${i===journey.length-1?"disabled":""}>▼</button>
         <button type="button" data-j="rm"   data-i="${i}" aria-label="Remove ${label(g)}">✕</button>
       </span>
     </li>`).join("");
  const n=journey.length;
  $("journeyState").textContent = n<2
    ? `Add ${2-n} more stop${2-n===1?"":"s"} — a journey needs at least two.`
    : `${n} stops. It plays as a loop: …→${label(journey[n-1])}→${label(journey[0])}→…`;
}

// ---------- the readout tick: text, on a gentle timer ----------
function keyModeOf(st){
  const [off,mode]=PROG_MODE[st.progression]||[0,"major"];
  return KEYS[(off+(st.keyOffset||0))%12]+" "+mode;
}
function blendText(){
  const ws=(S.weights||[]).filter(w=>w&&w.w>0.005);
  if(!ws.length) return "—";
  return ws.map(w=>`${label(w.g)} ${Math.round(w.w*100)}%`).join(", ");
}
function nowSnapshot(){
  if(!S.playing) return "Nothing is playing yet.";
  const st=S.playing;
  const parts=[];
  parts.push("Genre: "+blendText());
  parts.push("Key "+keyModeOf(st)+", "+Math.round(st.bpm)+" beats per minute");
  if(S.live && S.barInfo){
    let t=0; try{ t=faustHandle?faustHandle.ctx.currentTime:0; }catch(e){}
    const b=S.barInfo, cb=b.cbeats||8, beat=Math.max(0,Math.min(cb-0.01,(t-b.when)/b.spb+cb));
    parts.push(`Bar ${b.serial+1}, beat ${1+Math.floor(beat%cb)}, chord ${b.chord||"—"}, section ${b.section}`);
    if(S.waypoints.length>=2)
      parts.push(`Journey leg ${S.travel.seg+1} of ${S.waypoints.length}`);
  }
  if(window.NameBank){
    const roster=NameBank.instrumentNames(st).map(i=>i.name);
    if(roster.length) parts.push("Instruments: "+roster.join(", "));
  }
  parts.push("The genre verifier hears this most as: "+(S.best||"…"));
  return parts.join(". ")+".";
}
function nowDetailHTML(){
  if(!S.playing) return `<p>Not playing. Choose a genre and press <b>Play</b>.</p>`;
  const st=S.playing;
  const rows=[
    ["Genre", blendText()],
    ["Key & tempo", keyModeOf(st)+" · "+Math.round(st.bpm)+" bpm"],
  ];
  if(S.live && S.barInfo){
    let t=0; try{ t=faustHandle?faustHandle.ctx.currentTime:0; }catch(e){}
    const b=S.barInfo, cb=b.cbeats||8, beat=Math.max(0,Math.min(cb-0.01,(t-b.when)/b.spb+cb));
    rows.push(["Position", `bar ${b.serial+1} · beat ${1+Math.floor(beat%cb)} · chord ${b.chord||"—"} (${b.ci+1}/${b.nch}) · ${b.section}`]);
    if(S.waypoints.length>=2) rows.push(["Journey", `leg ${S.travel.seg+1} of ${S.waypoints.length}`]);
  }
  if(window.NameBank){
    const roster=NameBank.instrumentNames(st).map(i=>i.name);
    if(roster.length) rows.push(["Instruments", roster.join(", ")]);
    const id=NameBank.identity((S.weights[0]||{g:single}).g, NameBank.hash(S.seed,(S.weights[0]||{g:single}).g,S.travel.seg,S.live?Math.floor(S.barCount/32):0));
    rows.push(["This 'song'", `“${id.title}” — ${id.artist}`]);
  }
  rows.push(["Verifier hears", S.best||"…"]);
  return `<dl>${rows.map(([k,v])=>`<dt>${k}</dt><dd>${escapeHTML(v)}</dd>`).join("")}</dl>`;
}
function escapeHTML(s){ return String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

let lastStatus="", lastLogAt=0;
function tick(){
  // update the (non-announced) detail panel
  $("nowDetail").innerHTML = nowDetailHTML();
  // reflect transport state
  const b=$("playBtn");
  b.textContent = S.live ? "■ Stop" : "▶ Play";
  b.setAttribute("aria-pressed", S.live?"true":"false");
  b.classList.toggle("live", !!S.live);
  // narrate meaningful status changes into the polite log (deduped + throttled)
  const s=S.status||"";
  if(s && s!==lastStatus){
    const now=Date.now();
    // always let play/stop and errors through immediately; throttle the chatty
    // per-flip band-shuffle narration so a screen reader isn't flooded
    const urgent=/stopped|failed|playing|error/i.test(s);
    if(urgent || now-lastLogAt>2600){ logEvent(s); lastLogAt=now; }
    lastStatus=s;
  }
  setTimeout(tick, 300);
}

// ---------- the events log (a polite, screen-reader-friendly running narration)
function logEvent(msg){
  const box=$("events");
  const p=document.createElement("p");
  p.textContent=msg;
  box.appendChild(p);
  while(box.children.length>40) box.removeChild(box.firstChild);
  box.scrollTop=box.scrollHeight;
}
// on-demand full announcement (assertive) — re-toggle so pressing twice re-reads
function announceNow(){
  const a=$("announce");
  a.textContent="";
  requestAnimationFrame(()=>{ a.textContent=nowSnapshot(); });
}

// ---------- duration slider: log scale 8 min .. 24 h (loop travel time) ----------
// (Was "pace" = bars per leg; now the same control dials the whole loop's DURATION,
// matching the main panel. The HTML id/label stay "pace" for markup stability.)
function fmtDur(s){ s=Math.round(s); if(s<3600) return Math.round(s/60)+" minutes";
  const h=s/3600; return (h<10?(Math.round(h*10)/10):Math.round(h))+" hours"; }
function paceToSlider(d){ return Math.round(100*Math.log(Math.max(MIN_DURATION,Math.min(MAX_DURATION,d))/MIN_DURATION)/Math.log(MAX_DURATION/MIN_DURATION)); }
function sliderToPace(v){ return Math.round(MIN_DURATION*Math.pow(MAX_DURATION/MIN_DURATION, v/100)); }
function syncPaceOut(){
  const d=sliderToPace(+$("paceRange").value);
  set({duration:d});
  $("paceOut").textContent = fmtDur(d);
  $("paceRange").setAttribute("aria-valuetext", fmtDur(d));
}

// ---------- genre info blurb ----------
function updateGenreInfo(){
  const g=$("genreSel").value;
  $("genreInfo").textContent = info(g) ? label(g)+" — "+info(g) : label(g);
}

// ---------- wiring ----------
function wire(){
  // transport
  $("playBtn").addEventListener("click", ()=>{
    if(S.live){ stopLive(); logEvent("Stopped at measure "+((S.startBar||0)+1)+" — Play resumes there, Restart rewinds."); return; }
    if(mode==="journey"){
      if(journey.length<2){ logEvent("Add at least two stops before starting a journey."); announceNow(); return; }
      const key=journey.join(">");
      if(key!==lastJourneyKey){ lastJourneyKey=key; S.startBar=0; }   // a CHANGED journey starts fresh; the same one resumes
      setJourneyWaypoints();
      logEvent((S.startBar>0?"Journey resumes at measure "+(S.startBar+1):"Journey started")+" through "+journey.map(label).join(" → ")+".");
    } else {
      S.waypoints=[];                      // hold in place — no travel
      applyHold();
      logEvent("Playing "+blendText()+(S.startBar>0?" from measure "+(S.startBar+1):"")+".");
    }
    goLive();
  });
  // ⏮ restart: the map's stop-twice rule, as its own button here (the play
  // button is a toggle, so a "second stop" needs a real control for SR users)
  $("restartBtn").addEventListener("click", ()=>{
    if(S.live) stopLive();
    stopLive();                            // stop-while-stopped = the rewind path (shared law with the map)
    logEvent("Rewound to the beginning. Play starts from measure 1.");
  });
  $("copyLinkBtn").addEventListener("click", ()=>{
    const u=location.href;
    const done=()=>logEvent("Link copied. Anyone opening it hears exactly this music.");
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done,()=>logEvent("Copy failed — the link is the address bar."));
    else logEvent("Copy failed — the link is the address bar.");
  });
  $("announceBtn").addEventListener("click", announceNow);

  // mode switch (radio group)
  document.querySelectorAll('input[name="mode"]').forEach(r=>{
    r.addEventListener("change",()=>{
      if(!r.checked) return;
      mode=r.value;
      $("holdPanel").hidden = mode!=="hold";
      $("journeyPanel").hidden = mode!=="journey";
      logEvent(mode==="journey" ? "Journey mode. Build a loop of stops." : "Hold mode. Sit on one genre.");
      if(mode==="hold" && !S.live) applyHold();
    });
  });

  // hold controls
  $("genreSel").addEventListener("change",()=>{ updateGenreInfo(); applyHold(); logEvent("Genre: "+label($("genreSel").value)); });
  $("blendSel").addEventListener("change",()=>{
    const on=!!$("blendSel").value;
    $("blendAmtRow").hidden=!on;
    applyHold();
  });
  $("blendAmt").addEventListener("input",()=>{
    const v=+$("blendAmt").value;
    $("blendAmt").setAttribute("aria-valuetext", v+"% "+label($("blendSel").value||""));
    $("blendAmtOut").textContent=v+"%";
    applyHold();
  });

  // journey controls
  $("journeyAddBtn").addEventListener("click",()=>{
    const g=$("journeyAdd").value;
    journey.push(g); renderJourney();
    logEvent("Added stop: "+label(g)+" (now "+journey.length+")");
    if(S.live && mode==="journey") { /* takes effect on next Play — keep the current loop stable */ }
  });
  $("journeyList").addEventListener("click",e=>{
    const btn=e.target.closest("button[data-j]"); if(!btn) return;
    const i=+btn.dataset.i, act=btn.dataset.j;
    if(act==="rm") journey.splice(i,1);
    else if(act==="up" && i>0){ [journey[i-1],journey[i]]=[journey[i],journey[i-1]]; }
    else if(act==="down" && i<journey.length-1){ [journey[i+1],journey[i]]=[journey[i],journey[i+1]]; }
    renderJourney();
  });
  $("paceRange").addEventListener("input", syncPaceOut);

  // seed + mode
  $("seedInp").addEventListener("change",()=>{
    const v=Math.max(1,Math.min(99999,parseInt($("seedInp").value,10)||1));
    $("seedInp").value=v; set({seed:v});
    if(mode==="hold") applyHold();
    logEvent("Seed set to "+v+" (the same seed always plays the same music).");
  });
  $("randSeed").addEventListener("click",()=>{
    const v=1+Math.floor(Math.random()*99999);
    $("seedInp").value=v; set({seed:v});
    if(mode==="hold") applyHold();
    logEvent("Seed randomized to "+v+".");
  });
  $("modeSel").addEventListener("change",()=>{
    set({modeLock:$("modeSel").value});
    if(mode==="hold") applyHold();
    logEvent("Musical mode: "+$("modeSel").value);
  });

  // keyboard: space toggles play from anywhere except when typing in a field
  document.addEventListener("keydown",e=>{
    if(e.code==="Space" && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(document.activeElement.tagName)){
      e.preventDefault(); $("playBtn").click();
    }
  });
}

// headless verification hook (mirrors index's window.__X/__S): the live engine
// handle (RMS/audit) + the accessible controller entry points. state.js already
// sets window.__S. Inert in normal use.
window.__ACCESS={ handle:()=>faustHandle, applyHold, setJourney:(gs)=>{journey=gs.slice(); renderJourney();},
  setMode:(m)=>{mode=m;}, snapshot:nowSnapshot, genres:()=>GENRES };

// same stylesheet-gated boot the map uses: measure nothing here, but wait for the
// engine globals to be present (the classic scripts run before this module).
if(window.GenreKernel && window.CsdEngine && window.FaustLive) boot();
else window.addEventListener("load", boot, {once:true});
