/* ============ THE KERNEL ============ */
const at=(v,i)=>v[((i%v.length)+v.length)%v.length];
const map5=(p,f)=>({deg:f(p.deg),oct:f(p.oct),gate:f(p.gate),acc:f(p.acc),sld:f(p.sld)});

const rotate=k=>p=>map5(p,v=>v.map((_,i)=>at(v,i+k)));
const reverse=()=>p=>{const r=map5(p,v=>[...v].reverse());
  r.sld=r.sld.map((_,i)=>at(r.sld,i+1)); return r;};              // slide is EDGE-valued
const transpose=k=>p=>({...p,deg:p.deg.map(d=>d+k)});
const invert=c=>p=>({...p,deg:p.deg.map(d=>c-d)});
const complement=k=>p=>({...p,[k]:p[k].map(b=>b?0:1)});
const excerpt=(a,n)=>p=>map5(p,v=>v.map((_,i)=>at(v,a+(i%n))));   // LOSSY
const only=(k,op)=>p=>({...p,[k]:op(p)[k]});                      // one vector at a time
const word=(p,ws)=>ws.reduce((q,op)=>op(q),p);

const PENT=[0,3,5,7,10], pitch=d=>PENT[((d%5)+5)%5]+12*Math.floor(d/5);
const fold=(n,c)=>{while(n<c-6)n+=12;while(n>c+6)n-=12;return n;};
const MODE=[0,2,3,5,7,8,10], mp=d=>MODE[((d%7)+7)%7]+12*Math.floor(d/7);
const near=pc=>{let b=0,x=99;MODE.forEach((m,i)=>{
  const t=Math.min((m-pc+120)%12,(pc-m+120)%12); if(t<x){x=t;b=i;}}); return b;};

function harm(subj,g,bar){
  if(g.harmony==='cycle') return at(g.roots,bar);
  if(g.harmony==='emergent'){
    const v=Math.min(bar,g.voices-1), q=word(subj,g.word(v,0));
    return near((((pitch(q.deg[0])-pitch(subj.deg[0]))%12)+12)%12);
  }
  return 0;
}
function render(subj,g,bars){
  const N=subj.deg.length, ev=[];
  for(let v=0;v<g.voices;v++){
    const ctr=60+12*g.reg(v);
    for(let b=g.entry(v);b<bars;b++){
      const p=word(subj,g.word(v,b-g.entry(v))), r=harm(subj,g,b);
      for(let i=0;i<N;i++){
        if(!p.gate[i]) continue;
        const ns=g.realize(v)==='pad' ? [r,r+2,r+4].map(mp)
                                      : [pitch(p.deg[i])+12*p.oct[i]];
        for(const n of ns) ev.push({t:(b*N+i)/g.rate,dur:1/g.rate,v,
          n:fold(n,ctr),acc:p.acc[i],sld:p.sld[i]});
      }
    }
  }
  return ev.sort((a,b)=>a.t-b.t);
}
function drums(subj,g,bars){
  const ev=[],N=subj.deg.length;
  for(const [d,vec] of Object.entries(g.kit||{}))
    for(let b=0;b<bars;b++) for(let i=0;i<N;i++)
      if(at(vec,i)) ev.push({t:(b*N+i)/g.rate,d,acc:!!subj.acc[i]});
  if(g.ghost){ const q=word(subj,g.ghost);
    for(let b=0;b<bars;b++) for(let i=0;i<N;i++)
      if(q.acc[i]&&!q.gate[i]) ev.push({t:(b*N+i)/g.rate,d:'p',acc:0}); }
  return ev.sort((a,b)=>a.t-b.t);
}
function bass(subj,g,bars){
  const ev=[],N=subj.deg.length;
  for(let b=0;b<bars;b++){ const r=harm(subj,g,b);
    for(let i=0;i<N;i++) if(subj.acc[i])
      ev.push({t:(b*N+i)/g.rate,dur:2/g.rate,n:mp(r)+36,r}); }
  return ev;
}
/* ============ END KERNEL ============ */

const DEFAULT={
  deg:[0,3,2,0,4,3,0,2,5,3,0,4,2,0,3,1],
  oct:[0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],
  gate:[1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,0],
  acc:[1,0,0,1,0,0,1,0,1,0,0,0,1,0,0,0],
  sld:[0,0,1,0,0,0,0,1,0,1,0,0,0,0,1,0]};
let SUBJ=structuredClone(DEFAULT);

const ROMAN=['i','ii°','III','iv','v','VI','VII'];
const GENRES={
  fugue:{ label:'Fugue', rate:1, voices:4, entry:v=>v, reg:v=>1-v,
    realize:()=>'line', kit:{}, harmony:'emergent',
    tone:{wave:'triangle',cut:2600,q:1.1,atk:.012,rel:.9,gain:.28,verb:.18},
    words:['subject','answer @ 5th','retrograde','down a 5th'],
    word:(v,s)=>[
      [[],[rotate(0)],[invert(4)]][s%3],
      [[transpose(3)],[transpose(3),reverse()],[invert(4)]][s%3],
      [[reverse()],[invert(2)],[transpose(3),rotate(2)]][s%3],
      [[transpose(-3)],[reverse(),transpose(3)],[invert(4)]][s%3]][v] },

  acid:{ label:'Acid house', rate:1, voices:2, entry:v=>v, reg:v=>-1+v,
    realize:()=>'line', harmony:'modal',
    kit:{k:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
         c:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
         o:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
         h:[0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1]},
    ghost:[only('acc',rotate(3))],
    tone:{wave:'sawtooth',cut:520,q:11,atk:.004,rel:.75,gain:.30,verb:.06},
    words:['subject, unchanged','rotate(4·section)'],
    word:(v,s)=>v===0?[]:[rotate(4*s),...(s%2?[complement('acc')]:[])] },

  vaporwave:{ label:'Vaporwave', rate:.5, voices:2, entry:()=>0,
    reg:v=>v===0?-1:1, realize:v=>v===0?'pad':'line',
    harmony:'cycle', roots:[3,4,2,5],
    kit:{k:[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],
         s:[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
         h:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0]},
    tone:{wave:'sawtooth',cut:1500,q:2.2,atk:.05,rel:1.6,gain:.20,verb:.55},
    words:['excerpt(2,8) → pad','excerpt(2,8) → line'],
    word:()=>[excerpt(2,8)] }
};
const DRUMNAME={k:'Kick',s:'Snare',c:'Clap',o:'Open hat',h:'Hat',p:'Ghost perc'};
const BARS=8;
let cur='acid';

/* ---------- build the arrangement model ---------- */
function build(){
  const g=GENRES[cur];
  const pitched=render(SUBJ,g,BARS), dr=drums(SUBJ,g,BARS), bs=bass(SUBJ,g,BARS);
  const lanes=[];
  for(let v=0;v<g.voices;v++){
    const ev=pitched.filter(e=>e.v===v);
    lanes.push({id:'v'+v, name:(g.realize(v)==='pad'?'Pad ':'Voice ')+v,
      op:g.words[v]||'', kind:'pitch', color:'var(--v'+v+')', ev});
  }
  lanes.push({id:'bass', name:'Bass', op:'harmony · '+g.harmony, kind:'pitch',
    color:'var(--vb)', ev:bs.map(e=>({...e,acc:0}))});
  const dl=[...new Set(dr.map(e=>e.d))];
  for(const d of dl) lanes.push({id:'d'+d, name:DRUMNAME[d]||d,
    op:d==='p'?'only(acc, rotate 3)':'grid', kind:'drum',
    color:'var(--drum)', ev:dr.filter(e=>e.d===d)});
  return {g,lanes,steps:BARS*16/g.rate};
}

/* ---------- draw ---------- */
const gridEl=document.getElementById('grid');
let stepW=7, model=null, phEls=[];

function draw(){
  model=build();
  const {g,lanes,steps}=model;
  const avail=Math.max(560,document.getElementById('dawscroll').clientWidth-118);
  stepW=Math.max(4,Math.min(13,avail/steps));
  const W=steps*stepW;
  gridEl.innerHTML='';
  gridEl.style.gridTemplateColumns='118px '+W+'px';

  const pad=document.createElement('div'); pad.className='rulerpad'; gridEl.append(pad);
  const ruler=document.createElement('div'); ruler.className='ruler';
  for(let b=0;b<steps/16;b++){
    const t=document.createElement('div'); t.className='tick b';
    t.style.left=(b*16*stepW)+'px'; t.textContent=(b+1);
    ruler.append(t);
  }
  gridEl.append(ruler);

  phEls=[];
  lanes.forEach((L,li)=>{
    const h=document.createElement('div'); h.className='head';
    h.innerHTML='<div class="nm"><span class="swatch" style="background:'+L.color+
      '"></span>'+L.name+'</div><div class="op">'+L.op+'</div>';
    gridEl.append(h);

    const lane=document.createElement('div');
    lane.className='lane'+(li%2?' alt':'');
    lane.style.height=(L.kind==='pitch'?54:22)+'px';
    for(let b=1;b<steps/16;b++){
      const bl=document.createElement('div'); bl.className='barline';
      bl.style.left=(b*16*stepW)+'px'; lane.append(bl);
    }
    if(L.ev.length){
      const ns=L.ev.map(e=>e.n).filter(n=>n!=null);
      const lo=ns.length?Math.min(...ns):0, hi=ns.length?Math.max(...ns):1;
      const span=Math.max(1,hi-lo);
      for(const e of L.ev){
        const d=document.createElement('div');
        d.className='note'+(e.acc?' acc':'');
        d.style.left=(e.t*stepW)+'px';
        d.style.background=L.color;
        if(L.kind==='pitch'){
          const hh=Math.max(3,Math.min(7,54/(span+2)));
          d.style.width=Math.max(2,(e.dur||1)*stepW-1)+'px';
          d.style.height=hh+'px';
          d.style.top=(4+(1-(e.n-lo)/span)*(54-8-hh))+'px';
          if(e.sld) d.style.background='linear-gradient(90deg,transparent,'+L.color+')';
        }else{
          d.style.width=Math.max(2,stepW-1)+'px';
          d.style.height=e.acc?'14px':'9px';
          d.style.top=e.acc?'4px':'6px';
        }
        lane.append(d);
      }
    }
    const ph=document.createElement('div'); ph.className='playhead';
    ph.style.transform='translateX(-3px)'; lane.append(ph); phEls.push(ph);
    gridEl.append(lane);
  });

  const rm=[];
  if(GENRES[cur].harmony==='cycle')
    rm.push('roots '+GENRES[cur].roots.map(r=>ROMAN[r]).join(' → '));
  else if(GENRES[cur].harmony==='emergent')
    rm.push('roots '+Array.from({length:4},(_,b)=>ROMAN[harm(SUBJ,GENRES[cur],b)]).join(' → ')+' (computed, not written)');
  else rm.push('one mode, no motion');
  document.getElementById('readout').textContent=
    'rate '+g.rate+' · '+g.voices+' voices · harmony '+g.harmony+' · '+rm[0];
}

/* ---------- audio ---------- */
let ctx=null,bus=null,verb=null,verbGain=null,noise=null,playing=false,t0=0,timer=null;
function initAudio(){
  if(ctx) return;
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  const comp=ctx.createDynamicsCompressor();
  comp.threshold.value=-14; comp.ratio.value=3.2; comp.knee.value=8;
  bus=ctx.createGain(); bus.gain.value=.9;
  verb=ctx.createConvolver(); verbGain=ctx.createGain(); verbGain.gain.value=.2;
  const len=ctx.sampleRate*2.6, ib=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let c=0;c<2;c++){ const d=ib.getChannelData(c);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6); }
  verb.buffer=ib;
  bus.connect(comp); bus.connect(verbGain); verbGain.connect(verb); verb.connect(comp);
  comp.connect(ctx.destination);
  const nl=ctx.sampleRate*.5; noise=ctx.createBuffer(1,nl,ctx.sampleRate);
  const nd=noise.getChannelData(0);
  for(let i=0;i<nl;i++) nd[i]=Math.random()*2-1;
}
const hz=m=>440*Math.pow(2,(m-69)/12);
function nz(t,dur,hp,gain){
  const s=ctx.createBufferSource(); s.buffer=noise;
  const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp;
  const g=ctx.createGain();
  g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.0008,t+dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t+dur+.02);
}
function line(t,n,dur,acc,sld,prev,tone,padish){
  const o=ctx.createOscillator(), o2=ctx.createOscillator();
  const f=ctx.createBiquadFilter(), g=ctx.createGain();
  o.type=o2.type=tone.wave; o2.detune.value=padish?9:4;
  if(sld&&prev!=null){
    o.frequency.setValueAtTime(hz(prev),t); o2.frequency.setValueAtTime(hz(prev),t);
    const e=t+Math.min(.11,dur*.55);
    o.frequency.exponentialRampToValueAtTime(hz(n),e);
    o2.frequency.exponentialRampToValueAtTime(hz(n),e);
  }else{ o.frequency.setValueAtTime(hz(n),t); o2.frequency.setValueAtTime(hz(n),t); }
  f.type='lowpass'; f.Q.value=tone.q;
  const co=tone.cut*(acc?2.4:1);
  f.frequency.setValueAtTime(Math.min(11000,co*3.4),t);
  f.frequency.exponentialRampToValueAtTime(Math.max(160,co),t+Math.max(.06,dur*.85));
  const pk=(acc?1:.62)*tone.gain;
  g.gain.setValueAtTime(.0001,t);
  g.gain.linearRampToValueAtTime(pk,t+tone.atk);
  g.gain.exponentialRampToValueAtTime(.0008,t+dur*tone.rel+.02);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(bus);
  o.start(t); o2.start(t); o.stop(t+dur*tone.rel+.08); o2.stop(t+dur*tone.rel+.08);
}
function hit(t,d,acc){
  const a=acc?1.15:.85;
  if(d==='k'){ const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.setValueAtTime(126,t); o.frequency.exponentialRampToValueAtTime(43,t+.09);
    g.gain.setValueAtTime(.95*a,t); g.gain.exponentialRampToValueAtTime(.001,t+.34);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t+.36); }
  else if(d==='s'){ nz(t,.19,900,.42*a);
    const o=ctx.createOscillator(),g=ctx.createGain(); o.type='triangle';
    o.frequency.setValueAtTime(196,t);
    g.gain.setValueAtTime(.3*a,t); g.gain.exponentialRampToValueAtTime(.001,t+.13);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t+.15); }
  else if(d==='c'){ [0,.011,.023].forEach(o2=>nz(t+o2,.1,1400,.3*a)); }
  else if(d==='o'){ nz(t,.26,6600,.14*a); }
  else if(d==='h'){ nz(t,.035,7800,.13*a); }
  else if(d==='p'){ nz(t,.05,2600,.16); }
}

let sched=[];
function compile(){
  const {g}=model||build();
  const ev=[];
  const pitched=render(SUBJ,g,BARS);
  for(let v=0;v<g.voices;v++){
    const vev=pitched.filter(e=>e.v===v); let prev=null;
    for(const e of vev){ ev.push({...e,kind:'line',prev,pad:g.realize(v)==='pad'});
      prev=e.n; }
  }
  for(const e of drums(SUBJ,g,BARS)) ev.push({...e,kind:'hit'});
  for(const e of bass(SUBJ,g,BARS)) ev.push({...e,kind:'bass'});
  sched=ev.sort((a,b)=>a.t-b.t);
}
function stepDur(){ return 60/(+document.getElementById('bpm').value)/4; }

let ptr=0, loopLen=0;
function tick(){
  if(!playing) return;
  const sd=stepDur(), look=ctx.currentTime+.12;
  while(true){
    if(ptr>=sched.length){
      const passed=t0+loopLen*sd;
      if(passed<look){ t0=passed; ptr=0; } else break;
    }
    const e=sched[ptr], when=t0+e.t*sd;
    if(when>look) break;
    const tone=GENRES[cur].tone;
    if(e.kind==='line') line(when,e.n,e.dur*sd,e.acc,e.sld,e.prev,tone,e.pad);
    else if(e.kind==='hit') hit(when,e.d,e.acc);
    else if(e.kind==='bass') line(when,e.n,e.dur*sd*.9,1,0,null,
      {wave:'square',cut:340,q:5,atk:.006,rel:.8,gain:.26},false);
    ptr++;
  }
}
function frame(){
  if(!playing) return;
  const sd=stepDur(), el=(ctx.currentTime-t0)/sd;
  const x=(el%loopLen)*stepW;
  for(const p of phEls) p.style.transform='translateX('+x+'px)';
  requestAnimationFrame(frame);
}
function start(){
  initAudio(); if(ctx.state==='suspended') ctx.resume();
  compile(); loopLen=BARS*16/GENRES[cur].rate;
  playing=true; ptr=0; t0=ctx.currentTime+.08;
  document.getElementById('play').textContent='■ Stop';
  timer=setInterval(tick,25); requestAnimationFrame(frame);
}
function stop(){
  playing=false; clearInterval(timer);
  document.getElementById('play').textContent='▶ Play';
  for(const p of phEls) p.style.transform='translateX(-3px)';
}

/* ---------- phrase editor ---------- */
const ROWS=[['deg','deg'],['oct','oct'],['gate','gate'],['acc','acc'],['sld','sld']];
function drawEditor(){
  const el=document.getElementById('stepgrid'); el.innerHTML='';
  el.append(Object.assign(document.createElement('div'),{className:'rowlab'}));
  for(let i=0;i<16;i++){
    const n=document.createElement('div');
    n.className='num'+(i%4===0?' q':''); n.textContent=i+1; el.append(n);
  }
  for(const [key,label] of ROWS){
    const lb=document.createElement('div'); lb.className='rowlab'; lb.textContent=label;
    el.append(lb);
    for(let i=0;i<16;i++){
      const b=document.createElement('button');
      b.type='button';
      if(key==='deg'){
        b.className='cell deg'+(SUBJ.gate[i]?'':' rest');
        b.textContent=SUBJ.deg[i];
        b.setAttribute('aria-label','step '+(i+1)+' degree '+SUBJ.deg[i]);
      }else{
        b.className='cell'+(SUBJ[key][i]?' on':'');
        b.textContent=SUBJ[key][i]?'●':'';
        b.setAttribute('aria-label','step '+(i+1)+' '+label+(SUBJ[key][i]?' on':' off'));
      }
      b.addEventListener('click',ev=>{
        if(key==='deg') SUBJ.deg[i]=(SUBJ.deg[i]+(ev.shiftKey?5:1))%6;
        else SUBJ[key][i]=SUBJ[key][i]?0:1;
        drawEditor(); draw(); if(playing) compile();
      });
      el.append(b);
    }
  }
}

/* ---------- wiring ---------- */
const tabs=document.getElementById('tabs');
for(const k of Object.keys(GENRES)){
  const b=document.createElement('button');
  b.type='button'; b.className='tab'; b.textContent=GENRES[k].label;
  b.setAttribute('aria-pressed',String(k===cur));
  b.addEventListener('click',()=>{
    cur=k;
    [...tabs.children].forEach(c=>c.setAttribute('aria-pressed',String(c===b)));
    draw(); if(playing){ compile(); loopLen=BARS*16/GENRES[cur].rate;
      ptr=0; t0=ctx.currentTime+.05; }
    writeSrc();
  });
  tabs.append(b);
}
document.getElementById('play').addEventListener('click',()=>playing?stop():start());
document.getElementById('bpm').addEventListener('input',e=>{
  document.getElementById('bpmv').textContent=e.target.value;
  if(playing){ ptr=0; t0=ctx.currentTime+.05; }
});
document.getElementById('rnd').addEventListener('click',()=>{
  const r=n=>Math.floor(Math.random()*n);
  for(let i=0;i<16;i++){
    SUBJ.deg[i]=r(6); SUBJ.oct[i]=r(6)===0?1:0;
    SUBJ.gate[i]=r(10)<7?1:0;
    SUBJ.acc[i]=SUBJ.gate[i]&&r(10)<3?1:0;
    SUBJ.sld[i]=SUBJ.gate[i]&&r(10)<2?1:0;
  }
  drawEditor(); draw(); if(playing) compile();
});
document.getElementById('reset').addEventListener('click',()=>{
  if(playing) stop();                       // transport
  SUBJ=structuredClone(DEFAULT);            // phrase
  cur='acid';                               // genre
  [...tabs.children].forEach(c=>c.setAttribute('aria-pressed',
    String(c.textContent===GENRES.acid.label)));
  const bpm=document.getElementById('bpm');
  bpm.value=126; document.getElementById('bpmv').textContent='126';
  drawEditor(); draw(); writeSrc();
});
function writeSrc(){
  const g=GENRES[cur];
  const kit=Object.keys(g.kit||{}).length
    ? Object.entries(g.kit).map(([d,v])=>'  '+d+': ['+v.join(',')+']').join('\n')
    : '  {}   <span class="c">// a fugue has no drums. The empty kit is the fact.</span>';
  document.getElementById('src').innerHTML=
    g.label.toUpperCase()+'\n\n'+
    'rate      '+g.rate+'\n'+
    'voices    '+g.voices+'   <span class="c">entry '+
      Array.from({length:g.voices},(_,v)=>'bar '+g.entry(v)).join(', ')+'</span>\n'+
    'harmony   '+g.harmony+(g.roots?'  ['+g.roots.map(r=>ROMAN[r]).join(' ')+']':'')+'\n'+
    'words     '+g.words.map((w,i)=>'v'+i+' = '+w).join('\n          ')+'\n\n'+
    'kit\n'+kit;
}
addEventListener('resize',()=>draw());
drawEditor(); draw(); writeSrc();
