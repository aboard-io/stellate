// embed.js — THE EMBED ENTRY (loaded ONLY by embed.html; index.html never sees it).
//
// Everything embed-specific lives here so nothing in the main app has to know it
// is being framed. Three jobs, and deliberately nothing else:
//
//   1. THE PLAY AFFORDANCE. An embed must never autoplay: browsers block audio
//      without a user gesture, and even where they don't it is rude to make a
//      stranger's page start singing. #embedPlay covers the box with one big,
//      obvious, keyboard-reachable button; its click IS the gesture that unlocks
//      WebAudio, and it comes back when playback stops.
//   2. ?genre=<key>. The other entry points already ride the shared URL grammar
//      (share.js applyUrlState handles ?seed / ?path / ?m / ?xdur / ?sf at boot),
//      but "just point at ONE genre" had no spelling — an embed usually wants a
//      place, not a journey. ?genre= drops the default loop, parks the traveler
//      on that star and zooms the little box in far enough that its neighbours
//      are legible instead of showing all 274 labels at 400px wide.
//   3. STATUS PLUMBING for the framed case: window.__EMBED for the headless gate,
//      and postMessage-out of play/stop so a host page can react if it wants to.
//
// NOTE ON AUDIO: an embedded page is not cross-origin isolated, so the ring/
// worklet engine's SharedArrayBuffer does not exist. That is handled ONE level
// down, in app/live.js's NO-ISOLATION FALLBACK — the WAV-FIRST route is chosen
// automatically. Nothing in this file touches the engine choice; it just plays.
import { S, set, subs, K, QSFLAGS } from "./state.js";
import { POS, WORLD_W, WORLD_H, MAP_CENTER } from "./world.js";
import { retarget } from "./targeting.js";
import { clampZoom, drawMap } from "./starmap.js";
import { goLive, stopLive } from "./live.js";

const overlay = document.getElementById("embedPlay");

// ---------- ?genre= : park on one star -------------------------------------
// Accepts the kernel key ("vaporwave"), case/space/punctuation-insensitively,
// and falls back to matching a genre's human LABEL (the display names get
// rewritten periodically — a link written against a label should still land).
function resolveGenre(raw){
  if(!raw) return null;
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g,"");
  const want = norm(raw);
  if(POS[raw]) return raw;
  const keys = Object.keys(K.GENRES||{}).filter(g=>POS[g]);
  for(const g of keys) if(norm(g)===want) return g;
  for(const g of keys){ const L=K.GENRES[g]&&K.GENRES[g].label; if(L&&norm(L)===want) return g; }
  return null;
}
// centre the map on a world point at zoom k. drawMap's mapping is
// screen = (world/WORLD)*rb*k + off, so the offset that puts `pt` in the middle
// of the box is (rb/2 - worldScreen*k). clampZoom then holds it inside the pan
// range (PAN_PAD is 0.55 of the viewport, so even an edge star can reach centre).
function centerOn(pt, k){
  const Z = window.__ZOOM, svg = document.getElementById("map");
  if(!Z || !svg) return;
  const rb = svg.getBoundingClientRect();
  if(!rb.width) return;
  Z.k = k;
  Z.ox = rb.width/2  - (pt.x*rb.width/WORLD_W)*k;
  Z.oy = rb.height/2 - (pt.y*rb.height/WORLD_H)*k;
  clampZoom();
}
// ZOOM FOR THE BOX. Counter-intuitive, and worth writing down: the star LABELS
// are drawn at an absolute px size derived from ZOOM.k (starmap drawMap's `fs`),
// so a small viewport needs a SMALLER k, not a bigger one — at the app's default
// k=2.8 a 400px embed is a solid smear of overlapping genre names. These land
// roughly the same number of readable labels per box at every size. Stays above
// 1 in every branch on purpose: at k<=1 clampZoom re-centres the whole world and
// would throw away centerOn()'s framing of the requested genre.
function embedZoom(){
  const w = window.innerWidth || 400;
  return w < 380 ? 1.25 : w < 700 ? 1.6 : w < 1000 ? 2.0 : 2.4;
}
let genreApplied = "";
function applyGenre(){
  const g = resolveGenre(QSFLAGS.get("genre"));
  if(!g) return false;
  // no ?path was honoured for this URL (a path always wins — it is the richer
  // instruction), so drop the seeded default loop and stand still on the star.
  if(QSFLAGS.get("path")) return false;
  const pt = { x:POS[g][0], y:POS[g][1] };
  S.waypoints = []; S.startBar = 0;
  set({ travel:{seg:0,t:0}, queue:[], barCount:0, barInfo:null });
  retarget(pt, true);            // snap: on the star means the genre, pure
  genreApplied = g;
  return true;
}
// FIT THE BOX. Runs for every embed, ?genre or not — the map's own default zoom
// (2.8, chosen for a full browser window) turns a 400px frame into overlapping
// labels and continent-sized region names. Re-fits on resize, because a host
// page is responsive and the frame changes shape under us — but NEVER after the
// reader has touched the map, or we would keep yanking their view back.
let userMoved = false;
function fitBox(){
  if(userMoved) return;
  const pt = genreApplied ? { x:POS[genreApplied][0], y:POS[genreApplied][1] } : MAP_CENTER;
  centerOn(pt, embedZoom());
  set({});
  try{ drawMap(); }catch(e){}
}
(function watchUserGesture(){
  const map = document.getElementById("map");
  if(!map) return;
  const mark = ()=>{ userMoved = true; };
  map.addEventListener("pointerdown", mark, { passive:true });
  map.addEventListener("wheel", mark, { passive:true });
})();
let fitT = 0;
addEventListener("resize", ()=>{ clearTimeout(fitT); fitT = setTimeout(fitBox, 180); });

// ---------- the play affordance --------------------------------------------
// The overlay is the ONLY thing between a fresh embed and sound. Hidden while
// live; restored on stop so the box always shows what it wants from you.
function syncOverlay(){
  if(!overlay) return;
  overlay.classList.toggle("gone", !!S.live);
}
if(overlay){
  overlay.addEventListener("click", ()=>{
    overlay.classList.add("gone");
    if(!S.live) goLive();
    post("play");
  });
}
subs.push(syncOverlay);

// ---------- host-page plumbing ---------------------------------------------
// A host that wants to know (analytics, "pause my video when the embed starts")
// can listen; nothing depends on anyone listening. targetOrigin "*" is safe here
// because the payload is two words of public state and carries no secrets.
function post(kind){
  try{ if(window.parent && window.parent!==window)
    window.parent.postMessage({ source:"stellate", type:kind, genre:genreApplied||null, url:location.href }, "*"); }catch(e){}
}
let wasLive=false;
subs.push(()=>{ if(S.live!==wasLive){ wasLive=S.live; post(wasLive?"play":"stop"); } });

// ---------- boot ------------------------------------------------------------
// app/main.js may defer its own boot() until app.css's stylesheet load event, so
// the store is not necessarily populated when this module first evaluates. Wait
// for the first real target, then apply the embed's own entry point once.
let tries=0;
(function ready(){
  if(S.playing && window.__X){ applyGenre(); fitBox(); syncOverlay(); return; }
  if(tries++ > 600) return;                      // ~10s at 60fps, then give up quietly
  requestAnimationFrame(ready);
})();

// headless gate + host debugging hook
window.__EMBED={ genre:()=>genreApplied, overlay:()=>!!(overlay&&!overlay.classList.contains("gone")),
  play:()=>{ if(overlay) overlay.classList.add("gone"); if(!S.live) goLive(); },
  stop:()=>stopLive() };
