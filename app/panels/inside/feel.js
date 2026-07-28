// feel.js — THE FEEL RADAR: one of the ⓘ readout's three reads. Turns the
// resolved state's numeric params into perceptual axes normalised 0..1
// (feelAxes) and draws them as the morphing neon rose (radarSVG). Pure and
// read-only — no Math.random, no DOM reads — so the rose is identical in the
// headless gate and to the audio. This is also the panel's ONLY vector display:
// every 0..1 quantity the state carries states itself here, as a spoke, never as
// a printed number (genre-viz.test.js J4b).
import { clamp01, num1 } from "./describe.js";

// six perceptual FEEL axes, each normalised 0..1 from S.playing. Ranges track the
// panel's own DIMS sliders where one exists; brightness/density are documented
// proxies (no single kernel param carries them):
export function feelAxes(st){
  const I=st.instruments||{}, mel=I.melody||{}, pad=I.pad||{}, D=I.drums||{}, L=Math.log2;
  const tempo=clamp01(((st.bpm||110)-50)/130);                 // DIMS bpm 50..180
  const swing=clamp01((st.swing||0)/0.45);                     // DIMS swing 0..0.45
  // BRIGHTNESS proxy: no "brightness" param, so log-blend the resolved lead+pad
  // lowpass cutoffs (the timbral tilt the ear reads as bright) with the master
  // high-shelf; each mapped log2 400Hz(dark)→10kHz(bright), weighted to the lead.
  const cutN=hz=>clamp01((L(Math.max(200,hz||400))-L(400))/(L(10000)-L(400)));
  const hc=(st.tone&&st.tone.highcut); const hcHz=hc?hc:12000;   // highcut 0 = no roll-off = full bright
  const bright=clamp01(0.55*cutN(mel.cutoff)+0.25*cutN(pad.cutoff)+0.20*cutN(hcHz));
  const space=clamp01(0.75*(((st.reverb||0.3)-0.3)/0.65)+0.25*clamp01((mel.send||0)/0.5));  // DIMS reverb .3..0.95 + lead send
  // DRIVE: how squashed/dirty — sidechain pump + buss glue comp + saturation grit.
  const drive=clamp01((clamp01((st.pump||0)/0.8)+clamp01((st.comp||0)/0.9)+clamp01((st.grit||0)/0.8))/3);
  // DENSITY proxy: drum activity (kick+snare+hat level, 0 if the kit is off) +
  // melodic polyphony (voices) + how many engine layers are actually voiced.
  const kitOn=!!(st.genreMeta&&st.genreMeta.kit&&st.genreMeta.kit!=="off");
  const drumAmt=kitOn?clamp01(((D.kick||0)+(D.snare||0)+(D.hat||0))/3.5):0;
  const voiceAmt=clamp01((mel.voices||1)/8);
  let layers=0; if((pad.level||0)>0.05)layers++; if(I.bass)layers++; if(I.melody)layers++;
  if(kitOn)layers++; if((st.foundSources||[]).some(s=>(s.vol||0)>0.02))layers++;
  const density=clamp01(0.45*drumAmt+0.25*voiceAmt+0.30*(layers/5));
  // DUST: the record-wear axis (crackle + the master lowcut of the tape floor)
  const dust=clamp01((st.crackle||0)/0.8);
  // FEEL: how human the timing is (humanize; swing is its own axis)
  const feelAx=clamp01((st.humanize||0)/0.6);
  // RUBATO: the breathing — state.rubato beat-warp depth (0.045 = the deepest
  // neoclassical setting), weighted by prob where the blend still carries one.
  // The most FELT of the axes, and the easiest one to leave invisible.
  const rb=st.rubato||null;
  const rbDepth=rb?(Array.isArray(rb.depth)?(((+rb.depth[0]||0)+(+rb.depth[1]||0))/2):(+rb.depth||0)):0;
  const rubato=clamp01((rbDepth/0.045)*(rb&&rb.prob!=null?clamp01(+rb.prob||0):1));
  const axes=[["tempo",tempo],["swing",swing],["feel",feelAx],["rubato",rubato],["bright",bright],
    ["space",space],["dust",dust],["drive",drive],["density",density]];
  // the MUSIC-MIND axes join the SAME radar: adventure/color/motion are not
  // different in kind from the other vectors, so they don't get their own display.
  // num1 handles the range-shaped fields exactly as mindData does.
  const th=st.theory||{};
  axes.push(["adventure",th.adventure!=null?num1(th.adventure):0]);
  axes.push(["color",th.color!=null?num1(th.color):0]);
  axes.push(["motion",st.rhythm?num1(st.rhythm.complexity):0]);
  return axes;
}
// the FEEL radar as an SVG string — grid rings, spokes, axis labels, morphing
// neon value polygon. Small element count; rebuilt only while the modal is open.
export function radarSVG(feel){
  if(!feel.length) return "";
  const cx=110, cy=106, R=72, n=feel.length;
  const ang=i=>-Math.PI/2+i*2*Math.PI/n, pt=(i,r)=>[cx+Math.cos(ang(i))*R*r, cy+Math.sin(ang(i))*R*r];
  const ring=r=>feel.map((_,i)=>pt(i,r).map(v=>v.toFixed(1)).join(",")).join(" ");
  let grid="";
  for(const r of [0.33,0.66,1]) grid+=`<polygon points="${ring(r)}" fill="none" stroke="var(--line2)" stroke-width="1" opacity="${r===1?0.55:0.26}"/>`;
  feel.forEach(([name],i)=>{ const [ex,ey]=pt(i,1), [lx,ly]=pt(i,1.26);
    grid+=`<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="var(--line2)" stroke-width="1" opacity="0.3"/>`;
    grid+=`<text x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" text-anchor="middle" class="rax">${name}</text>`; });
  const vpts=feel.map(([,v],i)=>pt(i,Math.max(0.02,v)).map(x=>x.toFixed(1)).join(",")).join(" ");
  const dots=feel.map(([,v],i)=>{ const [vx,vy]=pt(i,Math.max(0.02,v)); return `<circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="2.2" fill="var(--cyan)"/>`; }).join("");
  const poly=`<polygon points="${vpts}" fill="rgba(255,110,199,.18)" stroke="var(--pink)" stroke-width="1.7"/>`;
  // The box is WIDER than the rose (which lives in 0..220) because the axis
  // labels sit at r=1.26 and are centred on the spoke: the two horizontal
  // extremes stick out furthest, and the longest name — "adventure", at exactly
  // 180 degrees — ran 7px past x=0 and lost its first letter. 20px of bleed each
  // side clears it and leaves room for a longer axis name later. Keep .radar's
  // max-width in step with this width or the rose shrinks on screen.
  return `<svg viewBox="-20 0 260 220" class="radar" preserveAspectRatio="xMidYMid meet">${grid}${poly}${dots}</svg>`;
}
