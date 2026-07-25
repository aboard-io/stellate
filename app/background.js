// background.js — the background layer program: the MicroW8 demoscene layer and
// the ▢→▦ chip that toggles it off → demoscene. (The laserdisc video layer and
// the 8-bar video↔demo alternation were removed 2026-07-25 — preserved on
// branch legacy-download-video.) While the demoscene is on, the cart ROTATES:
// every 8 MEASURES on the musical clock while live (cut on the beat by onBar),
// with a wall-clock backstop that only runs when the music isn't.
import { S, set, subs, QSFLAGS } from "./state.js";

// ---------- background chip: off → demoscene ----------
// bgMode is the ONE persisted background preference (the layer no longer remembers
// its own on/off — a localStorage self-restore used to re-enable it at init behind
// the mode program's back). Restored per load, applied by applyBg once the layer
// comes up (setEnabled pre-ready is recorded and materialized by DemoLayer.init).
// Mode numbers keep their historical values (0 off · 2 demoscene) so saved prefs
// and the bg-cart gate stay valid; a legacy saved 1 (the retired video+demos
// program) restores as demoscene.
const bgChip=document.getElementById("bgChip");
const BG_LS="vaporwave-bg-mode";
let bgMode=0;   // 0 off · 2 demoscene
try{ const m=parseInt(localStorage.getItem(BG_LS)||"0",10); if(m===1||m===2) bgMode=2; }catch(e){}
const bgSave=()=>{ try{ localStorage.setItem(BG_LS,String(bgMode)); }catch(e){} };
// CART ROTATION: a fresh MicroW8 cart every 8 MEASURES, flipped inside onBar so
// the cut lands ON THE BEAT (a chord-bar boundary). onBar ticks per chord-bar
// (info.cbeats beats, default 8 = two 4/4 measures) so we count BEATS, not ticks.
// Idle = the wall-clock backstop cycles it.
const BG_ALT_BEATS=32;   // 8 measures × 4 beats
const BG_ALT_MS=+(QSFLAGS.get("bgAltMs"))||16000;   // idle wall-clock backstop period (test override)
const bgAlt={beats:0, lastFlip:0, lastBar:0};
function bgWant(){
  // STAR-CRUISE (aliens view) wraps the WASM DEMOSCENE around the planet as its
  // atmosphere (Paul: "project the wasm demoscene to the sky"), so it wants the
  // demo layer running — even though the 2D canvas hides under the 3D view. The
  // authority model (applyBg imposes bgWant on every render) starts it on entry
  // and restores the prior state on exit — no manual save/restore needed.
  if(window.__STARCRUISE && window.__STARCRUISE.isRunning && window.__STARCRUISE.isRunning())
    return { d:true };
  // THE VIZ VIEW SUPPRESSES the background layer entirely (exclusive views,
  // Paul 2026-07-10) — bgMode is REMEMBERED, so leaving the viz returns to
  // whatever background state you were in.
  if(S.vizView) return { d:false };
  return { d:bgMode===2 };
}
// bgWant() IS AUTHORITY: applyBg IMPOSES it on the layer, unconditionally, on
// every render — setEnabled is idempotent in the layer, so this is free when
// nothing changed, and it steamrolls any rogue enable (a direct setEnabled call,
// a stale restore) at the next paint.
function applyBg(){
  const D=window.DemoLayer, w=bgWant();
  if(D) D.setEnabled(!!w.d);
  // view icon: ✦ map · ⓘ viz · 👾 aliens — the CURRENT view; spinner clears
  // when the aliens layer is genuinely up (or instantly for map/viz).
  const aliensOn=!!(window.__STARCRUISE&&window.__STARCRUISE.isRunning&&window.__STARCRUISE.isRunning());
  const viewChip=document.getElementById("viewChip");
  const icon=aliensOn?"👾":(S.vizView?"ⓘ":"✦");
  if(viewChip&&viewChip.textContent!==icon) viewChip.textContent=icon;
  if(viewChip){ viewChip.classList.toggle("live",S.vizView||aliensOn);
    if(!aliensOn) viewChip.classList.remove("spin"); }   // aliens keeps its own spin until up
  // the background chip mirrors the MODE (not the imposed layer state, which the
  // viz view / star-cruise legitimately override): ▢ off · ▦ demoscene.
  if(bgChip){ const glyph=bgMode===2?"▦":"▢";
    if(bgChip.textContent!==glyph) bgChip.textContent=glyph;
    bgChip.classList.toggle("live",bgMode===2); }
  // THE VIEW CLASSES: body.view-viz hides the star map under the full-screen viz.
  // applyBg runs on every render + the 1Hz backstop, so it can never drift.
  document.body.classList.toggle("view-viz", !!S.vizView);
}
// ROTATE the cart (a fresh demo each cycle), announce it.
function bgFlip(){
  if(bgMode!==2) return;
  bgAlt.beats=0; bgAlt.lastFlip=Date.now();
  // STAR-CRUISE owns its sky: carts are PLANET-KEYED there (starcruise
  // ensureSurface picks per dominant genre) — the rotator stands down so it
  // never fights the planet's own cart.
  if(window.__STARCRUISE&&window.__STARCRUISE.isRunning&&window.__STARCRUISE.isRunning()) return;
  if(window.DemoLayer&&DemoLayer.next) DemoLayer.next();
  set({status:"background → fresh demo: "+(window.DemoLayer&&DemoLayer.currentName?DemoLayer.currentName():"microw8")});
}
// MUSICAL driver: rotate every BG_ALT_BEATS beats (8 measures) while LIVE — called
// from onBar at the bar's PLAYBACK instant, so the cut is beat-aligned.
export function bgBarTick(info){
  if(bgMode!==2||!S.live) return;
  bgAlt.lastBar=Date.now();   // the musical clock is flowing — backstop stands down
  bgAlt.beats+=(info&&info.cbeats)||8;
  if(bgAlt.beats>=BG_ALT_BEATS) bgFlip();
}
// RELIABILITY driver: a wall-clock backstop so the demoscene ALWAYS visibly
// cycles — covers idle (not playing) and any route where onBar has stalled.
// While the musical clock is flowing it stands down entirely (it used to race
// the beat at slow tempos: 8 measures at 80bpm is 24s, and the 16s backstop
// cut mid-bar).
let bgAltTimer=0;
function bgAltClock(){
  if(bgMode!==2) return;
  if(S.live && (Date.now()-bgAlt.lastBar)<8000) return;   // live + bars flowing: the beat owns the cut
  if((Date.now()-bgAlt.lastFlip)>=BG_ALT_MS) bgFlip();
}
// the 1s tick doubles as a RECONCILER: applyBg is idempotent (the layer bails on
// no-change), so re-imposing bgWant every second means even a rogue direct
// setEnabled call from outside the program (console, stray future code) is
// steamrolled within ~1s.
function startBgAltClock(){ if(!bgAltTimer) bgAltTimer=setInterval(()=>{ if(bgMode===2) bgAltClock(); applyBg(); },1000); }
// THE CHIP: ▢ off ↔ ▦ demoscene. Double duty while on: another tap turns it off;
// the cart itself rotates on the musical clock / backstop above.
export function bgToggle(){
  bgMode = bgMode===2 ? 0 : 2;
  bgAlt.beats=0; bgAlt.lastFlip=Date.now();
  bgSave(); applyBg(); startBgAltClock();
  set({status:"background: "+(bgMode===2?"demoscene":"off")});
  return bgMode===2;
}
if(bgChip) bgChip.onclick=()=>bgToggle();
window.__BGALT={ state:()=>({mode:bgMode,beats:bgAlt.beats}), tick:bgBarTick, flip:bgFlip, toggle:bgToggle };   // headless gate hook
subs.push(applyBg); applyBg(); startBgAltClock();
