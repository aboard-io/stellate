// graph.js — THE EFFECTS SURFACE of the ⓘ readout: what processing each voice
// and the master bus actually carry (voiceFx/masterFx, read off the built voice
// units and the resolved state), and the MIXING NODE GRAPH that draws the whole
// signal flow (graphData → graphSVG). Effects are not a caption under the rolls;
// they are nodes here.
import { esc } from "../../core/state.js";
import { clamp01, voiceName, kitChar } from "./describe.js";

// per-voice EFFECTS for a roster line, read off the built voice unit: prefer the
// audio layer's descriptor (unit.fxLabels — short strings like "HPF 250"/"plate
// 20%"), fall back to the insert-chain types (distort/phaser/chorus/…), else none.
export function voiceFx(unit){
  if(!unit) return [];
  if(Array.isArray(unit.fxLabels)&&unit.fxLabels.length) return unit.fxLabels.slice(0,6).map(String);
  if(Array.isArray(unit.inserts)&&unit.inserts.length) return unit.inserts.map(i=>i.type);
  return [];
}
// GLOBAL / master-bus effects. Prefer SE.fxLabels(state) or SE.fxParams(state)
// .fxLabels when the audio layer exposes them; else summarise the bus fx off the
// resolved state (reverb type+amount, saturation grit, master comp, pump, crackle).
export function masterFx(st){
  try{ const SE=window.FaustStateEngine;
    if(SE){
      if(typeof SE.fxLabels==="function"){ const l=SE.fxLabels(st); if(Array.isArray(l)&&l.length) return l.map(String); }
      const fp=SE.fxParams&&SE.fxParams(st); if(fp&&Array.isArray(fp.fxLabels)&&fp.fxLabels.length) return fp.fxLabels.map(String);
    } }catch(e){}
  const out=[], pc=v=>Math.round(v*100);
  out.push((st.reverbColor?st.reverbColor+" ":"")+"reverb "+pc(st.reverb!=null?st.reverb:0)+"%");
  if((st.comp||0)>0.02) out.push("comp "+pc(st.comp));
  if((st.grit||0)>0.02) out.push("saturation "+pc(st.grit));
  if((st.pump||0)>0.02) out.push("pump "+pc(st.pump));
  if((st.crackle||0)>0.02) out.push("crackle "+pc(st.crackle));
  const d=st.delay; if(d&&(d.beats||d.feedback)) out.push("delay");
  return out;
}
// ---------- MIXING NODE GRAPH: the signal-flow topology under the rolls --------
// Effects as text do not read. This renders the full mixing node graph instead,
// showing how effects are invoked and at what levels — a
// visual replacement for the master effects TEXT line: each voice unit → its
// per-voice INSERT chain (in order, type + mix) → its DRY/REV/DEL sends (send
// LEVEL = line width + opacity) → the shared REVERB (color) + DELAY + MASTER bus
// → OUT. Pure/read-only off the SAME voiceUnits + resolved state the engine
// voices (zero rng, numeric layout — byte-stable in the headless gate).
// friendly insert names (mirror state-engine INSERT_LABELS — can't import engine/).
const INSERT_LABEL={ distort:"drive", higain:"amp", fenv:"filter env", phaser:"phaser",
  chorus:"chorus", filtersweep:"filter", wah:"auto-wah", tremolo:"tremolo", leslie:"leslie",
  flanger:"flanger", delay:"echo", ringmod:"ring", granular:"grains" };
const REV_LABEL={ dattorro:"plate", greyhole:"hall", fdn:"room", spring:"spring", shimmer:"shimmer" };
const gtrunc=(s,n)=>{ s=String(s||""); return s.length>n?s.slice(0,n-1)+"…":s; };
// reduce the live voiceUnits (U) + resolved state + this bar's events to the graph
// nodes actually present: pitched voices always, a counter/stab lane only when it
// fires this bar, the drum kit as ONE node (max send across its firing pieces).
export function graphData(st, U, bar){
  if(!st||!U) return null;
  const notes=(bar&&bar.notes)||[];
  // a voice's chips = its FULL processing chain (channel strip + inserts — the
  // same roster the old per-lane line showed, voiceFx→fxLabels), MINUS the
  // reverb/delay SENDS (those are the shared bus nodes + the send curves, so they
  // must not double-draw as per-voice chips). Drawing only u.inserts (<=2) leaves
  // effects listed everywhere and none of them in the nodes, because it drops
  // the real strip DSP (HPF/LPF/EQ/comp/saturate/chorus…).
  const dropSend=l=> l==="delay" || /^(plate|hall|room|spring|shimmer|reverb)\s+\d+%$/.test(l);
  const mkVoice=(name,col,key)=>{
    const u=U[key]; if(!u||u.__meta) return null;
    const chain=voiceFx(u).filter(l=>!dropSend(l)).slice(0,8);
    return { name:gtrunc(name,16), col, chain,
      dry:u.dry!=null?u.dry:1, rev:u.rev||0, del:u.del||0 };
  };
  const voices=[], push=v=>{ if(v) voices.push(v); };
  const I=st.instruments||{};
  if(I.pad)    push(mkVoice(voiceName("pad",I.pad,st),"--purple","pad"));
  if(I.bass)   push(mkVoice(voiceName("bass",I.bass,st),"--cyan","bass"));
  if(I.melody) push(mkVoice(voiceName("melody",I.melody,st),"--pink","melody"));
  // counter/solo lane — shares the melody recipe; only graph it when it sounds
  const soloKey=Object.keys(U).find(k=>k.indexOf("solo:")===0);
  if(soloKey&&notes.some(n=>n.role==="solo")) push(mkVoice("counter lead","--amber",soloKey));
  // drum kit → one node aggregating the pieces firing this bar (max rev/del send)
  const kitOn=!!(st.genreMeta&&st.genreMeta.kit&&st.genreMeta.kit!=="off");
  if(kitOn){
    const pieces=new Set();
    for(const n of notes) if(n.role==="drums"&&U[n.unit]) pieces.add(n.unit);
    if(pieces.size){
      let rev=0,del=0; const chain=[], seen=new Set();
      for(const k of pieces){ const u=U[k]; rev=Math.max(rev,u.rev||0); del=Math.max(del,u.del||0);
        for(const l of voiceFx(u)){ if(dropSend(l)||seen.has(l)) continue; seen.add(l); chain.push(l); } }
      voices.push({ name:gtrunc(kitChar(st.genreMeta.kit),16), col:"--mint", chain:chain.slice(0,8), dry:1, rev, del });
    }
  }
  // synth stab / fx sweep lanes when they actually fire this bar
  for(const k of ["stab","sfx"]) if(U[k]&&notes.some(n=>n.unit===k))
    push(mkVoice(k==="stab"?"synth stabs":"fx sweep","--amber",k));
  if(!voices.length) return null;
  const dl=st.delay;
  return {
    voices,
    reverb:{ label:REV_LABEL[st.reverbColor]||"reverb", amt:clamp01(st.reverb!=null?st.reverb:0.3) },
    delay:{ on:!!(dl&&(dl.beats||dl.feedback)), fb:clamp01(dl&&dl.feedback!=null?dl.feedback:0.3) },
    master:{ comp:clamp01(st.comp||0), grit:clamp01(st.grit||0), pump:clamp01(st.pump||0), mb:!!(st.masterComp>0) },
  };
}
// render the graph as one inline SVG, flowing TOP → BOTTOM so it stays legible on
// a phone (a portrait column, not a wide horizontal fan that shrinks to nothing):
// voice rows with their insert chain at the top → send curves fanning DOWN to the
// shared reverb/delay bus → both into master → out at the bottom. Send LEVEL drives
// each curve's stroke width + opacity; insert mix + reverb amount + delay fb +
// master comp/drive/pump show as numbers. Numeric layout only (no font measurement)
// so it's identical across loads / in the headless gate. W is phone-narrow; CSS
// caps max-width so the same portrait shape reads on desktop.
export function graphSVG(g){
  if(!g||!g.voices.length) return "";
  const W=340, mgX=8, cx=W/2, innerW=W-2*mgX;
  const nameH=26, chipH=21, chipRowH=26, cgap=7, vGap=14;
  // pack a voice's fx chips into rows within innerW — variable width per label
  // (~6.4px/monospace char at 11px + padding), wrapping when a row is full. This
  // is what makes the FULL chain (strip + inserts) fit on a phone.
  const packChips=(labels)=>{ const out=[]; let x=0,row=0;
    for(const raw of (labels||[])){ const l=String(raw); const w=Math.min(innerW, Math.round(l.length*7.1)+18);
      if(x>0 && x+w>innerW){ row++; x=0; }
      out.push({label:l, w, x, row}); x+=w+cgap; }
    return { chips:out, rows: (labels&&labels.length)?row+1:0 }; };
  const V=g.voices.map(v=>{ const p=packChips(v.chain); return { v, chips:p.chips, h:nameH+(p.rows?p.rows*chipRowH+3:0) }; });
  let y=28; const vy=[]; for(const it of V){ vy.push(y); y+=it.h+vGap; }
  const voicesBottom=y-vGap+4;
  // ── bus STACK: delay feeds reverb — delay comes before reverb, which is also
  // the engine truth — rev_bleed(del,pp) bleeds into the reverb
  // color, then reverb → master. Stacked vertically (delay above reverb).
  const on=g.delay.on, busW=204, busX=(W-busW)/2, busH=28;
  const delTop=on?voicesBottom+30:0, delCy=delTop+busH/2;
  const revTop=on?delTop+busH+24:voicesBottom+30, revCy=revTop+busH/2;
  const M=g.master, mb=[];
  if(M.comp>0.02) mb.push("comp "+Math.round(M.comp*100));
  if(M.grit>0.02) mb.push("drive "+Math.round(M.grit*100));
  if(M.pump>0.02) mb.push("pump "+Math.round(M.pump*100));
  if(M.mb) mb.push("MB comp");
  const mW=232, mX=(W-mW)/2, mTop=revTop+busH+40, mH=30+mb.length*13, mBottom=mTop+mH;
  const oW=64, oX=(W-oW)/2, oTop=mBottom+32, oH=28, oCy=oTop+oH/2, H=oTop+oH+12;
  const dcurve=(x1,y1,x2,y2)=>{ const dy=Math.max(14,(y2-y1)*0.45);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} C${x1.toFixed(1)} ${(y1+dy).toFixed(1)} ${x2.toFixed(1)} ${(y2-dy).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  const sendPath=(x1,y1,x2,y2,val,col)=>{ const q=clamp01(Math.min(1,val)); if(q<=0.02) return "";
    return `<path d="${dcurve(x1,y1,x2,y2)}" fill="none" stroke="var(${col})" stroke-width="${(0.7+3.3*q).toFixed(2)}" opacity="${(0.22+0.6*q).toFixed(2)}"/>`; };
  // ---- connection layer (drawn first, so the opaque node rects cover the joins) --
  let cn="";
  V.forEach((it,i)=>{ const v=it.v, oy=vy[i]+it.h;
    cn+=`<path d="${dcurve(cx,oy,cx,mTop)}" fill="none" stroke="var(--line2)" stroke-width="${(0.6+1.1*clamp01(v.dry)).toFixed(2)}" opacity="${(0.14+0.2*clamp01(v.dry)).toFixed(2)}"/>`;
    if(on) cn+=sendPath(cx,oy,cx,delTop,v.del,"--amber");   // del send → delay (upstream)
    cn+=sendPath(cx,oy,cx,revTop,v.rev,"--cyan");            // rev send → reverb
  });
  if(on) cn+=`<path d="${dcurve(cx,delTop+busH,cx,revTop)}" fill="none" stroke="var(--amber)" stroke-width="${(1+2.2*g.delay.fb).toFixed(2)}" opacity="${(0.34+0.5*g.delay.fb).toFixed(2)}" marker-end="url(#garr)"/>`;   // delay → reverb
  cn+=`<path d="${dcurve(cx,revTop+busH,cx,mTop)}" fill="none" stroke="var(--cyan)" stroke-width="${(1+2.6*g.reverb.amt).toFixed(2)}" opacity="${(0.3+0.5*g.reverb.amt).toFixed(2)}" marker-end="url(#garr)"/>`;   // reverb → master
  cn+=`<path d="${dcurve(cx,mBottom,cx,oTop)}" fill="none" stroke="var(--mint)" stroke-width="3" opacity="0.8" marker-end="url(#garr)"/>`;
  // ---- node layer: each voice = a full-width name box + its fx chain drawn as
  // CONNECTED, directed nodes (voice → fx1 → fx2 → … → sends), so the signal flow
  // through the series is legible. A floating chip list shows no connections at
  // all; here arrowheads (url(#garr)) show direction.
  const arr=(x1,y1,x2,y2)=>`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="var(--dim)" stroke-width="1.1" opacity="0.62" marker-end="url(#garr)"/>`;
  let nd="";
  V.forEach((it,i)=>{ const v=it.v, y0=vy[i];
    nd+=`<rect x="${mgX}" y="${y0}" width="${innerW}" height="${nameH}" rx="6" class="gnode" style="stroke:var(${v.col})"/>`;
    nd+=`<text x="${mgX+8}" y="${(y0+16).toFixed(1)}" class="gtx">${esc(v.name)}</text>`;
    if(!it.chips.length){ nd+=`<text x="${W-mgX-8}" y="${(y0+16).toFixed(1)}" text-anchor="end" class="gsub">dry →</text>`; }
    else {
      // connectors FIRST (chips drawn on top so the arrows read into each node)
      let px=null, py=null;
      it.chips.forEach((c,ci)=>{ const cyp=y0+nameH+3+c.row*chipRowH, lx=mgX+c.x, my=cyp+chipH/2;
        if(ci===0) nd+=arr(lx+5, y0+nameH-1, lx+5, cyp-1);   // voice box → first fx
        else nd+=arr(px, py, lx, my);                         // prev fx → this fx (elbow across a wrap)
        px=mgX+c.x+c.w; py=my;
      });
      if(px!=null) nd+=arr(px, py, cx, vy[i]+it.h-1);         // last fx → the sends (down to the bus)
      for(const c of it.chips){ const cyp=y0+nameH+3+c.row*chipRowH;
        nd+=`<rect x="${(mgX+c.x).toFixed(1)}" y="${cyp}" width="${c.w}" height="${chipH}" rx="4" class="gins"/>`;
        nd+=`<text x="${(mgX+c.x+c.w/2).toFixed(1)}" y="${(cyp+14).toFixed(1)}" text-anchor="middle" class="gchip">${esc(c.label)}</text>`;
      }
    }
  });
  if(on){
    nd+=`<rect x="${busX}" y="${delTop}" width="${busW}" height="${busH}" rx="6" class="gdel"/>`;
    nd+=`<text x="${busX+8}" y="${(delCy+4).toFixed(1)}" class="gtx">delay</text>`;
    nd+=`<text x="${busX+busW-8}" y="${(delCy+4).toFixed(1)}" text-anchor="end" class="gdsub">fb ${Math.round(g.delay.fb*100)}%</text>`;
  }
  nd+=`<rect x="${busX}" y="${revTop}" width="${busW}" height="${busH}" rx="6" class="grev"/>`;
  nd+=`<text x="${busX+8}" y="${(revCy+4).toFixed(1)}" class="gtx">${esc(g.reverb.label)}</text>`;
  nd+=`<text x="${busX+busW-8}" y="${(revCy+4).toFixed(1)}" text-anchor="end" class="gmix">${Math.round(g.reverb.amt*100)}%</text>`;
  nd+=`<rect x="${mX}" y="${mTop}" width="${mW}" height="${mH.toFixed(1)}" rx="6" class="gmaster"/>`;
  nd+=`<text x="${cx}" y="${(mTop+18).toFixed(1)}" text-anchor="middle" class="gtx">master</text>`;
  mb.forEach((t,k)=>{ nd+=`<text x="${cx}" y="${(mTop+31+k*13).toFixed(1)}" text-anchor="middle" class="gsub">${esc(t)}</text>`; });
  nd+=`<rect x="${oX}" y="${oTop}" width="${oW}" height="${oH}" rx="6" class="gout"/>`;
  nd+=`<text x="${cx}" y="${(oCy+4).toFixed(1)}" text-anchor="middle" class="goutx">out</text>`;
  // ---- band captions (left-aligned in the gaps between stages) ----
  const hd=`<text x="${mgX}" y="16" class="ghead">voices · effects</text>`+
    `<text x="${mgX}" y="${((on?delTop:revTop)-7).toFixed(1)}" class="ghead">sends → bus</text>`+
    `<text x="${mgX}" y="${(mTop-7).toFixed(1)}" class="ghead">master</text>`;
  const defs=`<defs><marker id="garr" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L6 3 L0 6 z" fill="var(--dim)"/></marker></defs>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="vz-graph" preserveAspectRatio="xMidYMid meet">${defs}${cn}${nd}${hd}</svg>`;
}
