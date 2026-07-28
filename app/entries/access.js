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
import { S, K, V, set } from "../core/state.js";
import { POS, KEYS, PROG_MODE, BARS_PER_SEG } from "../core/world.js";
import { loopDuration, baseDuration, durMult, fmtDuration, fmtMult, MULT_MIN, MULT_MAX } from "../core/share.js";
import { retargetWeights, rescore } from "../audio/targeting.js";
import { goLive, stopLive, faustHandle, setVapor } from "../audio/live.js";

const $ = id => document.getElementById(id);
const GENRES = Object.keys(K.GENRES).sort((a,b)=>label(a).localeCompare(label(b)));
function label(g){ return (K.GENRES[g] && K.GENRES[g].label) || g; }
function info(g){ return (K.GENRES[g] && K.GENRES[g].info) || ""; }

// ---------- app state (the accessible view's own, small, choices) ----------
let mode = "hold";                 // "hold" (one place) | "journey" (a loop of stops)
let lastJourneyKey = "";           // resume law: the SAME journey resumes at the stop measure; a changed one starts fresh
let single = GENRES.includes("vaporwave") ? "vaporwave" : GENRES[0];
let journey = [];                  // ordered list of genre keys

// (there are no "shape" macro sliders — the instrument has no macros)

// ---------- populate the genre menus ----------
// The three genre pickers are native type-to-filter comboboxes (<input list>
// + one shared <datalist>) instead of 273-row <select>s — you type a few
// letters and the browser filters. Each <option value=KEY label=Friendly>: the
// input's value is the genre KEY (so the rest of the controller is unchanged),
// while the dropdown shows the friendly label. Fully keyboard + screen-reader
// native (the browser owns the combobox role/expanded state); no external lib.
function escAttr(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
function datalistHTML(){
  return GENRES.map(g=>`<option value="${escAttr(g)}" label="${escAttr(label(g))}"></option>`).join("");
}
// free text -> a valid genre key (exact key, case-insensitive key, exact label,
// then a lenient prefix match), or "" if nothing matches. Lets a listener type
// "salsa", "Salsa", or "Montuno Brass Fire" and land on the same genre.
function resolveGenre(raw){
  const v=(raw||"").trim(); if(!v) return "";
  if(K.GENRES[v]) return v;
  const lc=v.toLowerCase();
  return GENRES.find(g=>g.toLowerCase()===lc)
    || GENRES.find(g=>label(g).toLowerCase()===lc)
    || GENRES.find(g=>g.toLowerCase().startsWith(lc)||label(g).toLowerCase().startsWith(lc))
    || "";
}
// bookmarkable, here too — the ENTIRE site: ?seed=N&genre=g&blend=g2&amt=30
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
    q.set("seed",String(S.seed)); q.set("genre",resolveGenre($("genreSel").value)||single);
    const bg=resolveGenre($("blendSel").value); if(bg){ q.set("blend",bg); q.set("amt",$("blendAmt").value); }
    history.replaceState(null,"","?"+q.toString());
  }catch(e){}
}
function boot(){
  const urlBits=accUrlRestore();
  $("genreList").innerHTML = datalistHTML();          // one shared list feeds all three comboboxes
  const gc=$("genreCount"); if(gc) gc.textContent=String(GENRES.length);
  $("genreSel").value = single;
  if(urlBits.blend&&GENRES.includes(urlBits.blend)){
    $("blendSel").value=urlBits.blend; $("blendAmtRow").hidden=false;
    if(urlBits.amt>=0&&urlBits.amt<=100){ $("blendAmt").value=urlBits.amt; $("blendAmtOut").textContent=urlBits.amt+"%"; }
  }
  // seed + pace defaults reflected into the controls
  $("seedInp").value = S.seed;
  $("paceRange").value = paceToSlider(durMult());
  syncPaceOut();
  // vapor (live-only master EQ) reflected from persisted state
  if($("vaporRange")){ $("vaporRange").value = Math.round((S.vapor||0)*100); syncVaporOut(); }
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
  const g = resolveGenre($("genreSel").value) || single;   // fall back to last valid while mid-type
  const bg = resolveGenre($("blendSel").value);
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
  // one-time PLAYING narration. Without it the log's last line stays "loading
  // engine…" through real playback — S.status only moves on boot/flips/errors,
  // so a screen reader never hears that the music started.
  if(S.live && !tick._saidPlaying){ tick._saidPlaying=true;
    const g=(S.playing&&S.playing.genreMeta&&S.playing.genreMeta.label)||"";
    logEvent(`playing${g?" — "+g:""} · narration follows the sections`); }
  if(!S.live) tick._saidPlaying=false;
  // journey ARRIVAL narration: when the traveler
  // crosses into a new dominant genre mid-journey, say so ASSERTIVELY — travel
  // should feel like travel, not a form. Majority (>50%) = the arrival moment;
  // dominance flips are minutes apart so the interrupt is earned, and the same
  // line lands in the polite log for history.
  const dom=(S.weights&&S.weights[0]&&S.weights[0].w>0.5)?S.weights[0].g:null;
  if(S.live && S.waypoints.length>=2 && dom && tick._dom && dom!==tick._dom){
    const msg=`Now crossing into ${label(dom)}.`;
    logEvent(msg);
    const a=$("announce"); a.textContent="";
    requestAnimationFrame(()=>{ a.textContent=msg; });
  }
  if(dom) tick._dom=dom;
  if(!S.live) tick._dom=null;
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
// (Was "pace" = bars per leg, then absolute duration; now the SPEED MULTIPLE,
// matching the main panel — ×0.01 (100× faster) … ×1,000,000 (a million times
// longer) on a log scale over the path's own distance-derived default time.
// The HTML id/label stay "pace" for markup stability.)
const MULT_DECADES=Math.log10(MULT_MAX/MULT_MIN);   // 8
function paceToSlider(m){ return Math.round(100*Math.log10(Math.max(MULT_MIN,Math.min(MULT_MAX,m))/MULT_MIN)/MULT_DECADES); }
function sliderToPace(v){ const raw=MULT_MIN*Math.pow(10,MULT_DECADES*v/100); return Math.abs(raw-1)<0.15?1:raw; }   // coarser ×1 detent: this slider is 0..100
function syncPaceOut(){
  const m=sliderToPace(+$("paceRange").value);
  set({durMult:m});
  $("paceOut").textContent = fmtMult(m)+" · "+fmtDuration(loopDuration());
  $("paceRange").setAttribute("aria-valuetext",
    fmtMult(m)+" speed — this loop about "+fmtDuration(loopDuration())+"; its own time at times one is "+fmtDuration(baseDuration()));
}

// ---------- vapor: the live-only "mall haze" master EQ (parity with the map) --
function syncVaporOut(){
  const v=+$("vaporRange").value;
  $("vaporOut").textContent = v+"%";
  $("vaporRange").setAttribute("aria-valuetext", v+"% mall haze");
  setVapor(v/100);                 // persists + applies to the live graph over time
}

// ---------- genre info blurb ----------
function updateGenreInfo(){
  const g=resolveGenre($("genreSel").value)||single;
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

  // hold controls (free-text comboboxes: resolve the typed text to a genre key)
  $("genreSel").addEventListener("change",()=>{
    const g=resolveGenre($("genreSel").value);
    if(!g){ $("genreSel").value=single; logEvent("Genre not found — type a name and pick from the list."); announceNow(); return; }
    $("genreSel").value=g;                       // normalize the box to the key
    updateGenreInfo(); applyHold(); logEvent("Genre: "+label(g));
  });
  $("blendSel").addEventListener("change",()=>{
    const raw=$("blendSel").value.trim();
    const bg=resolveGenre(raw);
    if(raw && !bg){ $("blendSel").value=""; logEvent("Second genre not found — cleared."); }
    else if(bg){ $("blendSel").value=bg; }
    $("blendAmtRow").hidden=!bg;
    applyHold();
  });
  $("blendAmt").addEventListener("input",()=>{
    const v=+$("blendAmt").value;
    $("blendAmt").setAttribute("aria-valuetext", v+"% "+label($("blendSel").value||""));
    $("blendAmtOut").textContent=v+"%";
    applyHold();
  });

  // journey controls
  const addStop=()=>{
    const g=resolveGenre($("journeyAdd").value);
    if(!g){ logEvent("Type a genre name, then Add stop."); return; }
    journey.push(g); renderJourney();
    $("journeyAdd").value="";                     // clear for the next add
    $("journeyAdd").focus();
    logEvent("Added stop: "+label(g)+" (now "+journey.length+")");
    if(S.live && mode==="journey") { /* takes effect on next Play — keep the current loop stable */ }
  };
  $("journeyAddBtn").addEventListener("click", addStop);
  $("journeyAdd").addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); addStop(); } });
  $("journeyList").addEventListener("click",e=>{
    const btn=e.target.closest("button[data-j]"); if(!btn) return;
    const i=+btn.dataset.i, act=btn.dataset.j;
    if(act==="rm") journey.splice(i,1);
    else if(act==="up" && i>0){ [journey[i-1],journey[i]]=[journey[i],journey[i-1]]; }
    else if(act==="down" && i<journey.length-1){ [journey[i+1],journey[i]]=[journey[i],journey[i+1]]; }
    renderJourney();
  });
  $("paceRange").addEventListener("input", syncPaceOut);
  if($("vaporRange")) $("vaporRange").addEventListener("input", syncVaporOut);

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
