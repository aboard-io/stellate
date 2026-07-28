// layout.js — WHERE THE STARS AND THE PATHS GO. Everything in this module is
// geometry decided once, from the kernel's own data, with no pointer input and
// no drawing: the per-genre ENERGY score, the k-means REGIONS the map is washed
// into, the deterministic genre LAYOUT (computeGenreLayout — the relaxation that
// keeps 274 name labels from overlapping), the boot GRAND TOUR (autoPath) and the
// default closed loop (seedDefaultLoop). Split out of starmap.js; the code below
// is unchanged.
import { S, set, K } from "../core/state.js";
import { POS, WORLD_W, WORLD_H, MAP_CENTER, WORLD_MARGIN, recomputeWorld } from "../core/world.js";
import { retarget } from "../audio/targeting.js";
import { svg, DEFAULT_ZOOM } from "./viewport.js";

// ---------- boot: the auto grand tour + default loop + dynamic layout ----------
// (found buffers decode on demand in found-player.js — no csound prewarm pool)
// The page opens with a GRAND TOUR already drawn: 8 waypoints placed in the
// GAPS BETWEEN 9 near-neighbour genre anchors (each waypoint = the midpoint of
// two anchors), so every leg runs through inter-genre BLEND space and the
// journey starts between multiple genres — never sitting on top of one star.
// Every leg is a SHORT hop (<= TOUR_MAXLEG px). The music lives inside a genre→genre
// transition, so a walk of many short edges keeps the mix in one aesthetic
// neighbourhood at a time and drifts slowly across 2-3 of them — the opposite
// of the old 3-star cross-chart jump. It IS a normal path in S.waypoints:
// drag/delete/add a waypoint and clear it (✕ path) exactly as a hand-drawn one.
// Presentational only (Math.random), so every load draws a fresh tour; nothing
// persists, so a cleared/redrawn path is never re-imposed. window.__TOUR reports
// the max leg length + genre names for the headless gate.
// 8 waypoints, each hop reaching a short distance: a tight, local grand tour.
const TOUR_MINLEG=12;   // still >= the closest star pair, so no degenerate near-duplicate hop
const TOUR_MAXLEG=45;   // how far one step may reach across the chart
// ENERGY: a 0..1 "how danceable" score per genre, derived straight from the
// kernel's own vocabulary rather than a hand-curated genre list. Measured: an
// unweighted tour lands ~1/3 of its stops on wash/low-energy anchors, since the
// fictional-genre expansion piled 29 new stars into the low-energy half of the
// map. Two signals, both already on
// every K.GENRES anchor:
//   - bpm: the anchor's [lo,hi] tempo range, midpoint normalized 50-190bpm
//   - kits: fraction of the anchor's kit pool that ISN'T "off" (no drums) —
//     the sharpest single tell for a wash anchor: mallsoft/sourdough/
//     atlantidrone/crtwave/termswave/holdmusic/airtrafficdrone all carry
//     kits:["off",...], which catches e.g. thermostatwave (90bpm, danceable
//     on tempo alone) as still barely a beat.
// Weighted 60/40 toward bpm. Verified against the task's curated dancey list
// (acidhouse/house/deephouse/techno/italo/disco/trance/edm/dancepop/garage/
// gabber/breakcore/jungle/synthwave/darksynth/ebm/chiptune/hogcore/miamibass/
// phonk/newjack/bigbeat/electro/dubstep) — every one of those scores >=0.62,
// and the 0.6 cutoff below splits the 92-star catalog 59/33, matching the
// census's reported "~1/3 land on wash" almost exactly.
const ENERGY={};
for(const g of Object.keys(POS)){
  const a=K.GENRES[g];
  if(!a){ ENERGY[g]=0.3; continue; }   // shouldn't happen; neutral fallback
  const [lo,hi]=a.bpm, bpmScore=Math.max(0,Math.min(1,((lo+hi)/2-50)/140));   // 50bpm->0, 190bpm->1
  const kits=a.kits||[], kitScore=kits.length?kits.filter(k=>k!=="off").length/kits.length:1;
  ENERGY[g]=0.6*bpmScore+0.4*kitScore;
}
const GROOVE_ANCHOR=0.6;   // ENERGY at/above this = "groove anchor" (dance-floor tier)
const GROOVE_EVERY=3;      // force a reachable groove anchor at least this often, for contrast without monotony

// ---------- REGIONS: the map divided into colored, goofily-named territories ----------
// The star map is large enough that it wants dividing into regions by color,
// with big textual labels. The layout already clusters
// similar genres (computeGenreLayout's similarity springs), so a deterministic
// k-means over the FINAL POS carves the field into spatially- AND musically-
// coherent territories. Each region is named + colored by its ENERGY rank
// (wash → dance), so the colors read as a cool→warm gradient and the goofy names
// land on a fitting vibe. Deterministic (farthest-point seeding, NO Math.random)
// so the regions are byte-stable every load, exactly like the star positions.
const REGION_K=10;
// energy-ordered (mellow wash .. hardest banger); rank r gets NAMES[r]. Goofy in
// the house style ("Food Court Eternity", "Kerosene Twelve") — evocative, invented.
// The brief — the same one the 274 genre names and the 34 clusters answer to —
// is cosmic weirdness: a mix of eldritch, ridiculous and scientific, never
// pedestrian. Still energy-ordered
// (rank 0 = mellow wash … rank 9 = hardest banger), so the name has to land on
// the vibe as well as the register.
const REGION_NAMES=["The Sleeping Instrument","Cathedral of Slow Decay","Hypnagogic Shelf","Wool Gravity Well",
  "The Sediment Wards","Escalator Eschaton","Glitter Predation","Ecstatic Machine Country",
  "Piston Liturgy","The Anvil Singularity"];
const REGION_COLORS=["#6a5cff","#22c1dc","#34d17a","#9bd93a","#ffd23f",
  "#ff9e3d","#ff7233","#ff5c8a","#b06bff","#ff3d5a"];
export let REGIONS=[];          // energy-sorted: [{label,color,cx,cy,members:[g],spread}]
export const REGION_OF={};      // genre -> index into REGIONS
export function computeRegions(){
  const gs=Object.keys(POS); if(!gs.length) return;
  const K2=Math.min(REGION_K, gs.length);
  const P=gs.map(g=>POS[g]);
  // deterministic farthest-point seeding: start at the min-(x+y) star, then each
  // next centroid is the star farthest from all chosen so far.
  const d2=(a,b)=>{const dx=a[0]-b[0],dy=a[1]-b[1];return dx*dx+dy*dy;};
  let s0=0; for(let i=1;i<P.length;i++) if(P[i][0]+P[i][1]<P[s0][0]+P[s0][1]) s0=i;
  const cen=[[...P[s0]]];
  while(cen.length<K2){
    let bi=0,bd=-1;
    for(let i=0;i<P.length;i++){ let mn=Infinity; for(const c of cen){const d=d2(P[i],c); if(d<mn)mn=d;} if(mn>bd){bd=mn;bi=i;} }
    cen.push([...P[bi]]);
  }
  // Lloyd iterations
  let asg=new Array(gs.length).fill(0);
  for(let it=0; it<40; it++){
    let moved=false;
    for(let i=0;i<P.length;i++){ let bj=0,bd=Infinity; for(let j=0;j<cen.length;j++){const d=d2(P[i],cen[j]); if(d<bd){bd=d;bj=j;}} if(asg[i]!==bj){asg[i]=bj;moved=true;} }
    const sx=new Array(K2).fill(0),sy=new Array(K2).fill(0),n=new Array(K2).fill(0);
    for(let i=0;i<P.length;i++){ sx[asg[i]]+=P[i][0]; sy[asg[i]]+=P[i][1]; n[asg[i]]++; }
    for(let j=0;j<K2;j++) if(n[j]){ cen[j]=[sx[j]/n[j], sy[j]/n[j]]; }
    if(!moved && it>2) break;
  }
  // gather clusters, compute mean ENERGY + centroid + spread
  const raw=[]; for(let j=0;j<K2;j++) raw.push({members:[],ex:0,cx:0,cy:0});
  gs.forEach((g,i)=>{ const c=raw[asg[i]]; c.members.push(g); c.ex+=(ENERGY[g]||0.3); c.cx+=P[i][0]; c.cy+=P[i][1]; });
  for(const c of raw){ const m=Math.max(1,c.members.length); c.energy=c.ex/m; c.cx/=m; c.cy/=m;
    c.spread=Math.sqrt(c.members.reduce((s,g)=>s+d2(POS[g],[c.cx,c.cy]),0)/m); }
  // name + color by ENERGY rank (mellow -> banger)
  const ranked=raw.filter(c=>c.members.length).sort((a,b)=>a.energy-b.energy);
  REGIONS=ranked.map((c,r)=>({ label:REGION_NAMES[r%REGION_NAMES.length], color:REGION_COLORS[r%REGION_COLORS.length],
    cx:c.cx, cy:c.cy, spread:c.spread, energy:+c.energy.toFixed(3), members:c.members }));
  for(const k in REGION_OF) delete REGION_OF[k];
  REGIONS.forEach((rg,idx)=>rg.members.forEach(g=>{REGION_OF[g]=idx;}));
  window.__REGIONS={count:REGIONS.length, regions:REGIONS.map(r=>({label:r.label,color:r.color,n:r.members.length,energy:r.energy,
    sample:r.members.map(g=>(K.GENRES[g]&&K.GENRES[g].label)||g).slice(0,6)}))};
}
export function autoPath(){
  const gs=Object.keys(POS);
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  // Greedy nearest-unvisited walk with a max leg length, ENERGY-weighted among
  // the nearest few for VARIETY between visits AND a bias toward dancier
  // stars (the fix for "we seem to be exclusively super downtempo"). A
  // groove-anchor floor guarantees the tour doesn't drift into an all-wash
  // stretch even on an unlucky weighted draw; wash stars keep nonzero weight
  // so the tour still moves between energy levels rather than turning into
  // wall-to-wall bangers. Retry from fresh random starts and keep the longest
  // walk that reaches 8 (the tighter MAXLEG means a corner start dead-ends
  // more readily, so the 60-try keep-longest fallback matters more now).
  function walkFrom(){
    const target=9;   // 9 GENRES -> 8 midpoint waypoints (the path runs BETWEEN genres, so 8 steps needs 9 anchors)
    const start=gs[Math.floor(Math.random()*gs.length)];
    const vis=new Set([start]), walk=[start];
    let sinceGroove=ENERGY[start]>=GROOVE_ANCHOR?0:1;
    while(walk.length<target){
      const cur=POS[walk[walk.length-1]];
      const cands=gs.filter(g=>!vis.has(g)&&dist(POS[g],cur)>=TOUR_MINLEG&&dist(POS[g],cur)<=TOUR_MAXLEG);
      if(!cands.length) break;                       // dead-ended in a sparse corner
      cands.sort((a,b)=>dist(POS[a],cur)-dist(POS[b],cur));
      let pool=cands.slice(0,Math.min(cands.length,5));   // nearby few (widened from 3 to give ENERGY room to work)
      if(sinceGroove>=GROOVE_EVERY){                        // groove floor: force one in if any nearby star qualifies
        const groovy=pool.filter(g=>ENERGY[g]>=GROOVE_ANCHOR);
        if(groovy.length) pool=groovy;
      }
      const weights=pool.map(g=>0.15+Math.pow(ENERGY[g],1.5));   // dancey stars pull harder; wash never hits zero
      let r=Math.random()*weights.reduce((a,b)=>a+b,0), pick=pool[pool.length-1];
      for(let i=0;i<pool.length;i++){ r-=weights[i]; if(r<=0){ pick=pool[i]; break; } }
      vis.add(pick); walk.push(pick);
      sinceGroove=ENERGY[pick]>=GROOVE_ANCHOR?0:sinceGroove+1;
    }
    return {walk, target};
  }
  let best=[];
  for(let att=0;att<60;att++){
    const {walk,target}=walkFrom();
    if(walk.length>best.length) best=walk;
    if(best.length>=9&&walk.length>=target) break;
  }
  // the GENRE anchors the path threads between (energy-weighted short-hop walk)
  const names=best.slice(0,9);
  const gp=names.map(g=>POS[g]);
  // WAYPOINTS = midpoints between consecutive anchors, so every waypoint (and
  // the numbered dot on it) sits in the GAP between two genres, and every leg
  // runs through inter-genre BLEND space — never on top of a star. The LINES
  // pass BETWEEN genres, and the tour starts in between several of them.
  // weightsAt() at a midpoint blends the 2-3 nearest anchors, so the
  // traveler is always mixing several genres, starting between the first pair.
  // (Triangle inequality: each midpoint→midpoint leg is <= the anchor hop cap,
  // so legs stay short — see TOUR_MAXLEG.)
  const pts=[];
  for(let i=0;i<gp.length-1;i++) pts.push({x:(gp[i][0]+gp[i+1][0])/2, y:(gp[i][1]+gp[i+1][1])/2});
  window.__TOUR={names, between:true, maxleg:TOUR_MAXLEG,
    legs:pts.slice(1).map((p,i)=>Math.hypot(p.x-pts[i].x,p.y-pts[i].y)),
    energy:names.map(g=>+ENERGY[g].toFixed(3)),
    groovy:names.filter(g=>ENERGY[g]>=GROOVE_ANCHOR).length};
  set({waypoints:pts, travel:{seg:0,t:0},
    status:"tonight's grand tour: "+pts.length+" steps between "+names.slice(0,3).join(" → ")+
      "… — ▶ LIVE to travel (✕ path to roam free)"});
  retarget(pts[0]);
}
// DEFAULT CLOSED LOOP: step 1 is always centred, and there is always a loop —
// THREE waypoints, so the default is a triangle. Seeds
// exactly 3 waypoints: waypoint[0] pinned to the MAP CENTRE (which sits in
// disco's neighborhood — the blend snap makes the centre read ~pure disco),
// plus 2 real genre stars, so the constellation line is an immediate closed
// triangle through inter-genre blend space. Deterministic (no Math.random) so
// "default" is stable: the outer stars are the nearest genre to each of two
// compass directions (up, lower-right) at ~0.34·(min half-span) — currently
// lasertemple (108-116bpm ritual pulse) then doomdrone (48-62bpm doom wash,
// drums mostly off). The third node is doomdrone ON PURPOSE: against the
// centre's disco four-on-the-floor and lasertemple's temple pulse it is the
// maximal musical contrast in reach (form pop→ritual→wave, tempo ~116→~112→
// ~55), so the default triangle rides a real energy arc instead of three
// flavors of the same beat. This IS a normal S.waypoints loop — drag/add/erase
// it like any hand-drawn path; the loop closes itself (travelStep wraps seg
// mod n, drawMap repeats waypoint[0]) no matter how you edit it. window.__LOOP
// reports the seed shape for the headless gate.
// ---------- DYNAMIC genre layout (deterministic, run at load) ----------
// Replaces the old hand-tuned POS with a computed layout so genre NAME LABELS
// never overlap and read cleanly at the default zoom. Seeds from POS where a
// genre has a coordinate; derives one for any K.GENRES genre missing from the
// seed (fugue, afrobeat) near its most-SIMILAR seeded neighbour; then relaxes.
// Deterministic: the only entropy is a per-name hash (NO Math.random), so the
// star chart is byte-identical every load. Mutates POS in place + recomputes the
// world. See the big note by the POS/WORLD block up top.
function _genreSim(){
  const G=K.GENRES, NAMES=Object.keys(G);
  const jac=(a,b)=>{ if(!a.size&&!b.size) return 0; let i=0; for(const x of a) if(b.has(x)) i++;
    return i/(a.size+b.size-i); };
  const poolsOf=g=>{ const o=G[g], s=new Set();
    for(const part of ["lead","bass","pads"]){ const p=o[part]; if(!p) continue;
      (p.samplerPool||[]).forEach(x=>s.add("s:"+x));
      const rec=p.recipe||{}; (Array.isArray(rec.model)?rec.model:[rec.model]).forEach(x=>x&&s.add("m:"+x)); }
    return s; };
  const F={};
  for(const g of NAMES) F[g]={ prog:new Set(G[g].progressions||[]), pool:poolsOf(g),
    kits:new Set(G[g].kits||[]), form:G[g].form||"", bpm:G[g].bpm?(G[g].bpm[0]+G[g].bpm[1])/2:110 };
  return (a,b)=>{ const fa=F[a], fb=F[b];
    return 2.2*jac(fa.prog,fb.prog)+2.0*jac(fa.pool,fb.pool)+0.8*jac(fa.kits,fb.kits)
      +0.6*(fa.form===fb.form?1:0)+0.8*(1-Math.min(1,Math.abs(fa.bpm-fb.bpm)/80)); };
}
const _hash=s=>{ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; };
export function computeGenreLayout(){
  const NAMES=Object.keys(K.GENRES);
  const sim=_genreSim();
  const seeded=NAMES.filter(g=>POS[g]);   // genres that carry a seed coordinate
  // BAKED fast path (the common boot): POS already carries the exact relaxed
  // layout for every genre — it's a deterministic cache of the relaxation below
  // (see world.js). Nothing to solve, and re-running the relaxation would even
  // MIS-scale it (the normalize keys off the seed's median spacing, which is
  // denser once every genre is seeded). So just rebuild bounds + park the cursor.
  // The O(N²)·N*40 relaxation runs ONLY when a genre is missing (dev added one).
  if(seeded.length===NAMES.length){ recomputeWorld(); S.cursor={x:MAP_CENTER.x, y:MAP_CENTER.y}; return; }
  // 1. positions: seed where present; derive missing near most-similar seeded genre.
  const P={};
  for(const g of NAMES) if(POS[g]) P[g]=[POS[g][0],POS[g][1]];
  for(const g of NAMES){ if(P[g]) continue;
    let best=null,bs=-1; for(const h of seeded){ const s=sim(g,h); if(s>bs){bs=s;best=h;} }
    const hh=_hash(g), ang=(hh%360)*Math.PI/180, off=40+(hh>>>9)%30;
    P[g]=[POS[best][0]+off*Math.cos(ang), POS[best][1]+off*Math.sin(ang)]; }
  // 2. label box widths in real px at the default-zoom font (measure once). Labels
  // render to the RIGHT of the dot at font (12·fs)px in VT323 (monospace fallback).
  const fsD=Math.min(3,Math.max(1,Math.pow(DEFAULT_ZOOM,0.85)));
  const fontPx=12*fsD, ctx=document.createElement("canvas").getContext("2d");
  // MEASURE MONOSPACE, not VT323: the layout must be byte-identical every load
  // (see the determinism note by the POS/WORLD block). VT323 is a webfont, so
  // whether measureText sees it depends on a network race with boot — and the
  // relaxation is metric-sensitive enough that VT323's metrics send it unstable.
  // The label CSS lists `VT323, monospace`; before the split, boot beat the font
  // load and this measured the monospace fallback deterministically. Pin it here
  // so the split's extra module-fetch latency can't let the font win the race.
  ctx.font=fontPx+"px monospace";
  const labW={}; for(const g of NAMES) labW[g]=ctx.measureText(g).width;
  // SEP = a breathing moat (screen px per side) padded around every label box so
  // the relaxation spreads nodes well apart, not just barely non-overlapping. The
  // whole field then overflows the default zoom more — but there's room and it
  // pans, so an uncrowded map beats a tight fit. Scales a touch with type size.
  const SEP=5+2*fsD;
  const box=(g,px,py)=>({ l:px-4*fsD-SEP, r:px+9*fsD+labW[g]+3*fsD+SEP, t:py-fontPx/2-3*fsD-SEP, b:py+fontPx/2+3*fsD+SEP });
  // top-3 similar per genre for a WEAK grouping spring (decays to 0 mid-run).
  const topSim={}; for(const g of NAMES) topSim[g]=NAMES.filter(h=>h!==g)
    .map(h=>({h,s:sim(g,h)})).sort((a,b)=>b.s-a.s).slice(0,3);
  const bounds=()=>{ let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
    for(const g of NAMES){ const p=P[g]; if(p[0]<mnx)mnx=p[0]; if(p[0]>mxx)mxx=p[0]; if(p[1]<mny)mny=p[1]; if(p[1]>mxy)mxy=p[1]; }
    return {mnx,mny,mxx,mxy}; };
  const rb=svg.getBoundingClientRect();
  const viewW=rb.width||1200, viewH=rb.height||850;
  const MIN_DOT=72;                 // hard min dot separation, px at default zoom
  // full relaxation budget — reached only when a genre is missing from the baked
  // POS (the fast path above handles the common complete-POS boot). Scales with
  // node count: the self-normalizing bounds converge asymptotically.
  const ITERS=Math.max(2200, NAMES.length*40);
  for(let it=0;it<ITERS;it++){
    const bb=bounds();
    const W=(bb.mxx-bb.mnx)+2*WORLD_MARGIN||1, H=(bb.mxy-bb.mny)+2*WORLD_MARGIN||1;
    const sx=viewW/W*DEFAULT_ZOOM, sy=viewH/H*DEFAULT_ZOOM;   // px per logical unit at default zoom
    const springK=0.014*Math.max(0,1-it/(ITERS*0.85));
    const fx={},fy={}; for(const g of NAMES){ fx[g]=0; fy[g]=0; }
    for(let i=0;i<NAMES.length;i++) for(let j=i+1;j<NAMES.length;j++){
      const a=NAMES[i],b=NAMES[j];
      const pax=(P[a][0]-bb.mnx)*sx, pay=(P[a][1]-bb.mny)*sy;
      const pbx=(P[b][0]-bb.mnx)*sx, pby=(P[b][1]-bb.mny)*sy;
      const A=box(a,pax,pay), B=box(b,pbx,pby);
      const ox=Math.min(A.r,B.r)-Math.max(A.l,B.l), oy=Math.min(A.b,B.b)-Math.max(A.t,B.t);
      if(ox>0&&oy>0){   // labels overlap: separate on the least-penetration axis (vertical-biased: labels are wide+short)
        const acx=(A.l+A.r)/2,bcx=(B.l+B.r)/2,acy=(A.t+A.b)/2,bcy=(B.t+B.b)/2;
        if(ox*1.7<oy){ const dir=acx<=bcx?-1:1, push=(ox+3)*0.5*dir; fx[a]+=push/sx; fx[b]-=push/sx; }
        else{ const dir=acy<=bcy?-1:1, push=(oy+3)*0.5*dir; fy[a]+=push/sy; fy[b]-=push/sy; }
      }
      const ddx=pbx-pax, ddy=pby-pay, dd=Math.hypot(ddx,ddy)||0.01;   // dot floor
      if(dd<MIN_DOT){ const push=(MIN_DOT-dd)*0.5, ux=ddx/dd, uy=ddy/dd;
        fx[a]-=push*ux/sx; fy[a]-=push*uy/sy; fx[b]+=push*ux/sx; fy[b]+=push*uy/sy; }
    }
    if(springK>0) for(const g of NAMES){ let tx=0,ty=0,tw=0;
      for(const {h,s} of topSim[g]){ tx+=P[h][0]*s; ty+=P[h][1]*s; tw+=s; }
      if(tw>0){ fx[g]+=(tx/tw-P[g][0])*springK; fy[g]+=(ty/tw-P[g][1])*springK; } }
    for(const g of NAMES){ P[g][0]+=fx[g]; P[g][1]+=fy[g]; }
  }
  // 3. normalize scale so the median nearest-neighbour distance matches the SEED —
  // keeps SNAP/CUTOFF blend semantics (they key off local spacing), then shift so
  // the min corner sits at WORLD_MARGIN. Screen gaps are scale-invariant, so this
  // preserves the overlap-free layout exactly.
  const medNN=pts=>{ const ds=[]; for(let i=0;i<pts.length;i++){ let mn=1e9;
      for(let j=0;j<pts.length;j++){ if(i===j) continue; const d=Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]); if(d<mn)mn=d; }
      ds.push(mn); } ds.sort((a,b)=>a-b); return ds[ds.length>>1]; };
  const seedMed=medNN(seeded.map(g=>POS[g])), newMed=medNN(NAMES.map(g=>P[g]))||1;
  const scale=seedMed/newMed, bb=bounds();
  // 4. write back into POS (in place — same object reference the app closes over).
  for(const k of Object.keys(POS)) if(!K.GENRES[k]) delete POS[k];   // drop any stale genre
  for(const g of NAMES) POS[g]=[(P[g][0]-bb.mnx)*scale+WORLD_MARGIN, (P[g][1]-bb.mny)*scale+WORLD_MARGIN];
  recomputeWorld();
  S.cursor={x:MAP_CENTER.x, y:MAP_CENTER.y};
}
export function seedDefaultLoop(){
  S.startBar=0;   // a fresh loop starts fresh — no inherited resume measure
  const c={x:MAP_CENTER.x,y:MAP_CENTER.y};
  const rad=0.34*Math.min(WORLD_W,WORLD_H)/2;
  const gs=Object.keys(POS);
  const used=new Set(), outer=[];
  for(const ang of [-Math.PI/2, -Math.PI/2+2*Math.PI/3]){   // top, lower-right (centre itself is node 1 — a 3-point triangle)
    const tx=c.x+rad*Math.cos(ang), ty=c.y+rad*Math.sin(ang);
    let best=null, bd=Infinity;
    for(const g of gs){ if(used.has(g))continue;
      const d=Math.hypot(POS[g][0]-tx,POS[g][1]-ty); if(d<bd){bd=d;best=g;} }
    if(best){ used.add(best); outer.push({g:best,x:POS[best][0],y:POS[best][1]}); }
  }
  const wps=[{x:c.x,y:c.y}, ...outer.map(o=>({x:o.x,y:o.y}))];
  window.__LOOP={center:{...c}, genres:outer.map(o=>o.g), count:wps.length, closed:true};
  set({waypoints:wps, travel:{seg:0,t:0}, queue:[],
    status:"default loop: centre → "+outer.map(o=>o.g).join(" → ")+" → centre — ▶ LIVE to travel the loop"});
  retarget(wps[0]);
}
