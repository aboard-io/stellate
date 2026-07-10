// readouts.js — the self-scheduling status readout: the playhead/chyron
// lower-third (an MTV-style band card via namebank.js), ticking on its own
// timer, independent of the store's render subs. (The ⚡ CPU meter box lived
// here until 2026-07-09 — Paul: "get rid of the CPU monitor box"; the engine's
// load/eco machinery is untouched and still surfaces in the chyron tech line.)
import { S, esc, K } from "./state.js";
import { KEYS, PROG_MODE } from "./world.js";
import { faustHandle } from "./live.js";

// ---------- playhead ----------
function keyModeOf(st){
  const [off,mode]=PROG_MODE[st.progression]||[0,"major"];
  return KEYS[(off+(st.keyOffset||0))%12]+" "+mode;
}
// ---------- the chyron: an MTV lower-third instead of a debug dump ----------
// Each journey leg / 32-bar window is a "song": namebank.js invents a title,
// artist, album, year and label deterministically from seed+genre; the roster
// names the live instruments and their (fake) players. A player's name hashes
// the instrument MODEL, so a glide flip = a lineup change = "now joining: …".
let chyKey="", chyId=null, chyRoster=[], joinLine="", joinAt=0;
function chyron(){
  const g=(S.weights[0]||{g:"vaporwave"}).g;
  const win=S.live?Math.floor(S.barCount/32):0;      // new song every ~32 bars while live
  const key=[S.seed,g,S.travel.seg,win].join("|");
  if(key!==chyKey){ chyKey=key; chyId=NameBank.identity(g, NameBank.hash(S.seed,g,S.travel.seg,win)); }
  const roster=NameBank.instrumentNames(S.playing).map(i=>({...i, who:NameBank.musician(i.role,i.model,S.seed)}));
  for(const r of roster){ const old=chyRoster.find(o=>o.role===r.role);
    if(old&&old.who!==r.who&&S.live){ joinLine="now joining: "+r.who+" on "+r.name; joinAt=Date.now(); } }
  chyRoster=roster;
  return { id:chyId, roster, join:(Date.now()-joinAt<7000)?joinLine:"" };
}
export async function playheadTick(){
  if(!document.getElementById("playhead")) return;   // now-playing modal removed — feature retired
  if(S.playing&&window.NameBank){
    let line1="▶ press LIVE — the band is warming up";
    if(S.live&&S.barInfo){
      let t=0; try{ t=faustHandle?faustHandle.ctx.currentTime:0; }catch(e){}
      const b=S.barInfo, cb=b.cbeats||8, beat=Math.max(0,Math.min(cb-0.01,(t-b.when)/b.spb+cb));
      line1=`▶ bar ${b.serial+1} · beat ${1+Math.floor(beat%cb)} · ${b.chord||"—"} (${b.ci+1}/${b.nch}) · ${b.section}`+
        (S.waypoints.length>=2?` · leg ${S.travel.seg+1}→${(S.travel.seg+1)%S.waypoints.length+1}`:"")+
        ` · engine ${S.load.toFixed(2)}x${S.load<0.97?" ⚠":""}`;
    }
    const c=chyron();
    const line2=`key ${keyModeOf(S.playing)} · ${S.playing.bpm}bpm · `+
      S.weights.map(w=>`${(K.GENRES[w.g]&&K.GENRES[w.g].label)||w.g} ${Math.round(w.w*100)}%`).join(" · ")+
      (S.live&&S.queue.length?` · ${S.queue.length} changes queued`:"")+
      ` · verifier hears: ${S.best}`;
    document.getElementById("playhead").innerHTML=
      `<div class="chy">`+
      `<div class="chy-title">${esc(c.id.title)}</div>`+
      `<div class="chy-artist">${esc(c.id.artist)}</div>`+
      `<div class="chy-album">from “${esc(c.id.album)}” · ${esc(c.id.label)} · ${c.id.year}</div>`+
      `<div class="chy-roster">${c.roster.map(r=>`<div><span class="chy-inst">${esc(r.name)}</span> — ${esc(r.who)}</div>`).join("")}</div>`+
      (c.join?`<div class="chy-join">★ ${esc(c.join)}</div>`:"")+
      `<div class="chy-tech">${esc(line1)}<br>${esc(line2)}</div>`+
      (S.status?`<div class="chy-status">${esc(S.status)}</div>`:"")+   // the ONE status line (was a separate panel div)
      `</div>`;
  }
  setTimeout(playheadTick,250);
}
