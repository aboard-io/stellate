// background.js — the background layer program: the MicroW8 demoscene layer,
// ALWAYS ON as ambient wallpaper (Paul 2026-07-25: "get rid of the 2d visualizer
// button but leave it in the background"). The ▢/▦ chip is gone; ?bg=off is the
// escape hatch (and the gates' off-state probe). While on, the cart ROTATES:
// every 8 MEASURES on the musical clock while live (cut on the beat by onBar),
// with a wall-clock backstop that only runs when the music isn't.
// (The laserdisc video layer + chip cycle: removed 2026-07-25, branch
// legacy-download-video; the chip itself retired later the same day.)
import { S, set, subs, QSFLAGS } from "./state.js";

// bgMode is fixed at boot: 2 (demoscene) unless ?bg=off. Mode numbers keep their
// historical values (0 off · 2 demoscene) so the __BGALT gate contract holds.
const bgMode = QSFLAGS.get("bg")==="off" ? 0 : 2;
// CART ROTATION: a fresh MicroW8 cart every 8 MEASURES, flipped inside onBar so
// the cut lands ON THE BEAT (a chord-bar boundary). onBar ticks per chord-bar
// (info.cbeats beats, default 8 = two 4/4 measures) so we count BEATS, not ticks.
// Idle = the wall-clock backstop cycles it.
// ROTATION PERIOD (Paul 2026-07-25: "leave the demoscene running behind the star
// map for much longer. Just change it every 32 bars or slower"): 64 BARS — at
// 60-160bpm that is roughly 1.5-4 minutes per cart. The new cart fades IN over
// the LAST 8 BARS of that window as a true two-runtime crossfade, so the swap
// is a slow morph rather than an event.
const BG_ALT_BARS=64, BG_FADE_BARS=8;
const BG_ALT_BEATS=BG_ALT_BARS*4;        // rotation period, in beats
const BG_FADE_BEATS=BG_FADE_BARS*4;      // how long before the mark the fade starts
const BG_ALT_MS=+(QSFLAGS.get("bgAltMs"))||90000;   // idle wall-clock backstop period (test override) — long, to match the 64-bar musical period
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
  // Paul 2026-07-10) — leaving the viz returns to the ambient wallpaper.
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
  // THE VIEW CLASSES: body.view-viz hides the star map under the full-screen viz.
  // applyBg runs on every render + the 1Hz backstop, so it can never drift.
  document.body.classList.toggle("view-viz", !!S.vizView);
}
// ROTATE the cart (a fresh demo each cycle), announce it.
function bgFlip(fadeMs){
  if(bgMode!==2) return;
  bgAlt.lastFlip=Date.now();
  if(!fadeMs) bgAlt.beats=0;    // idle/backstop flips reset the musical counter
  // STAR-CRUISE owns its sky: carts are PLANET-KEYED there (starcruise
  // ensureSurface picks per dominant genre) — the rotator stands down so it
  // never fights the planet's own cart.
  if(window.__STARCRUISE&&window.__STARCRUISE.isRunning&&window.__STARCRUISE.isRunning()) return;
  if(window.DemoLayer&&DemoLayer.next) DemoLayer.next(fadeMs||0);
  set({status:"background → fresh demo: "+(window.DemoLayer&&DemoLayer.currentName?DemoLayer.currentName():"microw8")});
}
// MUSICAL driver: rotate every BG_ALT_BEATS beats (8 measures) while LIVE — called
// from onBar at the bar's PLAYBACK instant, so the cut is beat-aligned.
export function bgBarTick(info){
  if(bgMode!==2||!S.live) return;
  bgAlt.lastBar=Date.now();   // the musical clock is flowing — backstop stands down
  bgAlt.beats+=(info&&info.cbeats)||8;
  // start the crossfade BG_FADE_BARS before the mark, with a duration measured
  // in real milliseconds from the live tempo, so "eight bars" means eight bars.
  if(!bgAlt.fading && bgAlt.beats>=BG_ALT_BEATS-BG_FADE_BEATS){
    const bpm=(S.playing&&S.playing.bpm)||110;
    const ms=Math.round(BG_FADE_BEATS*(60/bpm)*1000);
    bgAlt.fading=true;
    bgFlip(ms);
  }
  if(bgAlt.beats>=BG_ALT_BEATS){ bgAlt.beats=0; bgAlt.fading=false; }
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
  // idle dissolve: long, but never more than a quarter of the rotation period —
  // otherwise a short ?bgAltMs (the gates use one) would spend its whole period
  // mid-fade and the cart would never appear to change.
  if((Date.now()-bgAlt.lastFlip)>=BG_ALT_MS) bgFlip(Math.min(12000, Math.round(BG_ALT_MS/4)));
}
// the 1s tick doubles as a RECONCILER: applyBg is idempotent (the layer bails on
// no-change), so re-imposing bgWant every second means even a rogue direct
// setEnabled call from outside the program (console, stray future code) is
// steamrolled within ~1s.
function startBgAltClock(){ if(!bgAltTimer) bgAltTimer=setInterval(()=>{ if(bgMode===2) bgAltClock(); applyBg(); },1000); }
window.__BGALT={ state:()=>({mode:bgMode,beats:bgAlt.beats,fading:!!bgAlt.fading}), tick:bgBarTick, flip:bgFlip };   // headless gate hook (toggle retired with the chip)
subs.push(applyBg); applyBg(); startBgAltClock();
