// pipes.js — CsdPipes: the scheduler as pipes (MUSIC-MIND organ #2).
// apply(ev, state) runs state.pipes = [{id, ...params}] over the buildEvents
// bundle {bpm, totalBeats, pitched, drums, found, sfx} at the one true choke
// point — inside buildEvents, just BEFORE the snare-law pass — so every
// consumer (press, live, MIDI export, the verifier) hears the same music.
// Standing laws honored here:
//   * determinism — pipe i draws only from mulberry32(seed + 71000 + i*97),
//     its own stream, so adding/removing a pipe never re-times another's rng;
//     an unknown id is skipped WITHOUT touching any stream.
//   * byte identity — state.pipes absent/empty returns ev UNTOUCHED (the
//     absent-knob law: not a clone, the same object, zero writes).
//   * live window — live builds one chord bar per call, so no pipe ever emits
//     outside [0, totalBeats) and echo/canon delays cap at state.chordEvery.
//   * taste — harmonize/echo add at most ONE voice per melody note; density
//     arcs thin pitched + hat lanes only and NEVER drop a kick or snare.
// Annotation-fields contract (expression pipes): they write cutoffMul
// (0.25–4 multiplier), vib:{depth,rate}, rsendMul, dsendMul, pw on PITCHED
// events only — fields are added, notes are never moved/added/removed, so
// expression is matrix-neutral by construction. state-engine.mapEvents
// translates them to per-note sets only where the voice's model exposes the
// param; the verifier reads none of them.
// No require() of csd-engine — the pch/rng helpers are tiny and duplicated
// by design so this organ stays dependency-free (UMD like every engine file).

(function (root) {
  "use strict";

  // ---------- tiny local helpers (mirrors of csd-engine's, on purpose) ----------
  function parsePch(s){ const [o,ss]=String(s).split("."); return parseInt(o,10)*12+parseInt(ss,10); }
  function toPch(abs){ const o=Math.floor(abs/12), ss=abs%12; return o+"."+String(ss).padStart(2,"0"); }
  function pchAdd(s,semis){ return toPch(parsePch(s)+(semis|0)); }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const cl=(x,a,b)=>x<a?a:x>b?b:x;
  const A=(x)=>cl(x,0.005,1);            // amps live in (0,1] — clamp every write
  const CUT=(x)=>cl(x,0.25,4);           // cutoffMul contract range
  const SEND=(x)=>cl(x,0,6);             // send multipliers: sane wet ceiling
  const EPS=1e-6;

  // ---------- shared analysis ----------
  // Phrase detection (ONE implementation, shared by callResponse / sweepArc /
  // throwFx / echoCanon): melody events sorted by onset; a gap >= 1 beat
  // between the running phrase end (max note-end so far) and the next onset
  // splits phrases. Returns arrays of REFERENCES into ev.pitched so callers
  // can annotate in place. Fractional beats fine — all math stays on the
  // grid the events use.
  function phrases(pitched){
    const mel=pitched.filter(e=>e.voice==="melody").slice()
      .sort((a,b)=>(a.beat-b.beat)||(parsePch(a.pch)-parsePch(b.pch)));
    const out=[]; let cur=null, end=-Infinity;
    for(const e of mel){
      if(!cur || e.beat-end>=1-EPS){ cur=[]; out.push(cur); }
      cur.push(e); end=Math.max(end,e.beat+e.dur);
    }
    return out;
  }
  // Pitch-class set of pad/bass events sounding at beat b — the clash-proof
  // harmonization target: no Key/Scale knowledge needed, because if the pad
  // or bass is already playing that pc, adding it cannot clash.
  function soundingPcs(pitched,b){
    const pcs=new Set();
    for(const e of pitched)
      if((e.voice==="pad"||e.voice==="bass") && e.beat-EPS<=b && b<e.beat+e.dur-EPS)
        pcs.add(((parsePch(e.pch)%12)+12)%12);
    return pcs;
  }
  const weakBeat=(b)=>{ const m=((b%2)+2)%2; return m>EPS && m<2-EPS; };  // strong = beats 0,2,4,6 of the 8-cell

  // ---------- the launch library ----------
  // Every pipe: fn(ev, state, rng, p) -> mutates ev in place. Registry-
  // extensible: consumers may add {id:{fn,doc}} entries before apply().
  const REGISTRY={

    harmonize:{ doc:"adds one scale-locked parallel 3rd/6th per melody note (prob), snapped to the pad/bass pitch-class set sounding at that beat — instant polyphony that can't clash",
      fn(ev,_state,rng,p){
        const prob=p.prob!=null?p.prob:0.6, gain=p.amp!=null?p.amp:0.6;
        const adds=[];
        for(const m of ev.pitched){                       // iterate the ORIGINAL array (adds appended after)
          if(m.voice!=="melody"||m.harm) continue;        // never harmonize a harmony — one added voice max
          const roll=rng();                               // draw per note BEFORE candidate math (stable stream)
          if(roll>=prob) continue;
          const pcs=soundingPcs(ev.pitched,m.beat);
          if(!pcs.size) continue;                         // nothing sounding = nothing safe to add
          const base=parsePch(m.pch);
          // parallel thirds & sixths, above then below — keep only pcs the harmony already owns
          const cands=[4,3,9,8,-3,-4,-8,-9].filter(s=>pcs.has((((base+s)%12)+12)%12));
          if(!cands.length) continue;
          const s=cands[Math.floor(rng()*cands.length)];
          adds.push(Object.assign({},m,{pch:pchAdd(m.pch,s),amp:A(m.amp*gain),harm:1}));
        }
        for(const a of adds) ev.pitched.push(a);
      }},

    echoCanon:{ doc:"delayed, transposed, quieter copy of melody phrases (prob per phrase); delay caps at the chord bar and copies stay inside [0,totalBeats) — imitation, depth",
      fn(ev,state,rng,p){
        const bar=state.chordEvery||8;                    // live builds one chord bar per call — never emit past it
        const delay=Math.min(p.delay!=null?p.delay:2,bar);
        const semis=p.semis!=null?p.semis:12, gain=p.amp!=null?p.amp:0.5;
        const prob=p.prob!=null?p.prob:0.6, adds=[];
        for(const ph of phrases(ev.pitched)){
          if(rng()>=prob) continue;                       // one draw per phrase, taken or not
          for(const m of ph){
            const nb=m.beat+delay;
            if(nb>=ev.totalBeats-EPS) continue;           // window law: onset must land in [0,totalBeats)
            adds.push(Object.assign({},m,{beat:nb,pch:pchAdd(m.pch,semis),amp:A(m.amp*gain),echo:1}));
          }
        }
        for(const a of adds) ev.pitched.push(a);
      }},

    strum:{ doc:"rolls each pad chord by a few ms per voice (offsets < 0.1 beat), direction alternating low-first/high-first per chord — humanity on pads; deterministic, no rng",
      fn(ev,_state,_rng,p){
        const step=p.step!=null?p.step:0.02;              // beats between voices; total spread capped under 0.1
        const groups=new Map();                           // pads sharing an onset = one chord
        for(const e of ev.pitched){ if(e.voice!=="pad") continue;
          const k=e.beat.toFixed(6); (groups.get(k)||groups.set(k,[]).get(k)).push(e); }
        [...groups.keys()].sort((a,b)=>+a-+b).forEach((k,gi)=>{
          const g=groups.get(k); if(g.length<2) return;
          g.sort((a,b)=>parsePch(a.pch)-parsePch(b.pch));
          const eff=Math.min(step,0.09/(g.length-1));     // guarantee max offset < 0.1 beat
          g.forEach((e,idx)=>{
            const off=(gi%2?g.length-1-idx:idx)*eff;      // even chords roll up, odd roll down
            e.beat+=off; e.dur=Math.max(0.05,e.dur-off);  // keep the chord's release edge aligned
          });
        });
      }},

    ghost:{ doc:"injects a quiet chromatic approach note (−1/−2 semis, ~35% amp) a 16th before bass hits (prob) — groove pocket",
      fn(ev,_state,rng,p){
        const prob=p.prob!=null?p.prob:0.5, off=p.off!=null?p.off:0.25, adds=[];
        for(const e of ev.pitched){
          if(e.voice!=="bass"||e.ghost||e.pump) continue;  // never ghost a ghost/pump copy
          if(rng()>=prob) continue;
          const nb=e.beat-off; if(nb<-EPS) continue;       // stay inside the window
          const semi=rng()<0.5?-2:-1;                      // chromatic vs diatonic-ish approach from below
          adds.push(Object.assign({},e,{beat:Math.max(0,nb),dur:Math.min(0.18,off*0.8),
            pch:pchAdd(e.pch,semi),amp:A(e.amp*0.35),ghost:1}));
        }
        for(const a of adds) ev.pitched.push(a);
      }},

    callResponse:{ doc:"alternate (odd) melody phrases get register/pan/level flips — the response voice; deterministic, no rng",
      fn(ev,_state,_rng,p){
        const oct=p.oct!=null?p.oct:-1, lvl=p.level!=null?p.level:0.85;
        phrases(ev.pitched).forEach((ph,pi)=>{
          if(pi%2===0) return;                             // calls stay put; responses flip
          for(const e of ph){
            e.pch=pchAdd(e.pch,12*oct);                    // register flip
            e.pan=e.pan==null?(p.pan!=null?p.pan:0.72):+((1-e.pan).toFixed(4)); // pan mirror
            e.amp=A(e.amp*lvl);                            // level flip (softer answer)
          }
        });
      }},

    densityArc:{ doc:"long-range shape: keep-probability rises from `floor` at beat 0 to 1 at `peak`·totalBeats; thins by amp scaling + DROPPING pitched/hat events only — kick and snare are NEVER dropped or touched",
      fn(ev,_state,rng,p){
        const floor=cl(p.floor!=null?p.floor:0.5,0,1), peak=cl(p.peak!=null?p.peak:0.7,0.05,1);
        const T=Math.max(EPS,ev.totalBeats);
        const dens=(b)=>floor+(1-floor)*Math.min(1,(b/T)/peak);   // intro sparse -> peak dense
        const keepP=[]; for(const e of ev.pitched){                // one draw per pitched event, in array order
          const d=dens(e.beat), keep=rng()<d;
          if(keep) e.amp=A(e.amp*(0.7+0.3*d));                     // survivors also swell toward the peak
          keepP.push(keep);
        }
        ev.pitched=ev.pitched.filter((_,i)=>keepP[i]);
        const keepD=[]; for(const e of ev.drums){                  // hats only — the taste constraint
          if(e.drum!=="hat"){ keepD.push(true); continue; }        // kick/snare/perc: untouched, no draw
          const d=dens(e.beat), keep=rng()<d;
          if(keep) e.amp=A(e.amp*(0.7+0.3*d));
          keepD.push(keep);
        }
        ev.drums=ev.drums.filter((_,i)=>keepD[i]);
      }},

    sweepArc:{ doc:"expression: writes per-note cutoffMul (0.25–4) on melody notes following a phrase-length arch (lo→hi→lo) — filter as gesture; annotation only, notes untouched",
      fn(ev,_state,_rng,p){
        const lo=CUT(p.lo!=null?p.lo:0.6), hi=CUT(p.hi!=null?p.hi:2.2);
        for(const ph of phrases(ev.pitched)){
          const b0=ph[0].beat, len=Math.max(EPS,ph[ph.length-1].beat-b0);
          for(const e of ph){
            const pos=cl((e.beat-b0)/len,0,1);                    // 0..1 along the phrase
            const v=lo+(hi-lo)*Math.sin(Math.PI*pos);             // arch: open into the phrase, close out
            e.cutoffMul=CUT((e.cutoffMul||1)*v);                  // compose with earlier sweeps
          }
        }
      }},

    vibratoSwell:{ doc:"expression: pitched notes with dur >= minDur (1.5) get vib:{depth,rate} — the renderer ramps depth in, so sustains sing; annotation only",
      fn(ev,_state,_rng,p){
        const minDur=p.minDur!=null?p.minDur:1.5;
        const depth=cl(p.depth!=null?p.depth:0.3,0,1), rate=cl(p.rate!=null?p.rate:5.5,0.1,12);
        for(const e of ev.pitched)
          if(e.dur>=minDur-EPS) e.vib={depth,rate};
      }},

    throwFx:{ doc:"expression: the LAST note of each melody phrase (prob) gets an rsendMul/dsendMul throw — dub punctuation; annotation only",
      fn(ev,_state,rng,p){
        const prob=p.prob!=null?p.prob:1, rs=p.rsend!=null?p.rsend:2.5, ds=p.dsend!=null?p.dsend:2.5;
        for(const ph of phrases(ev.pitched)){
          const take=rng()<prob;                                   // draw per phrase, always (stable stream)
          if(!take) continue;
          const last=ph.reduce((m,e)=>e.beat>m.beat?e:m,ph[0]);    // latest onset = the phrase's final gesture
          last.rsendMul=SEND((last.rsendMul||1)*rs);
          last.dsendMul=SEND((last.dsendMul||1)*ds);
        }
      }},

    octavePump:{ doc:"duplicates bass notes an octave up on WEAK beats (prob) at reduced amp — drive without new harmonic material",
      fn(ev,_state,rng,p){
        const prob=p.prob!=null?p.prob:0.5, gain=p.amp!=null?p.amp:0.7, adds=[];
        for(const e of ev.pitched){
          if(e.voice!=="bass"||e.ghost||e.pump) continue;          // originals only
          if(!weakBeat(e.beat)) continue;                          // strong beats keep the root anchored
          if(rng()>=prob) continue;
          adds.push(Object.assign({},e,{pch:pchAdd(e.pch,12),amp:A(e.amp*gain),pump:1}));
        }
        for(const a of adds) ev.pitched.push(a);
      }},
  };

  // ---------- the choke point ----------
  // ev is buildEvents' bundle; state.pipes = [{id, ...params}]. Pipe i gets
  // its own rng stream mulberry32(seed + 71000 + i*97) — independent streams
  // mean an unknown id (skipped, no draw) can never re-time a known one.
  // Absent/empty pipes returns ev UNTOUCHED: the byte-identity law.
  function apply(ev,state){
    const list=state&&state.pipes;
    if(!list||!list.length) return ev;
    const seed=((state.seed!=null?state.seed:1)>>>0);
    for(let i=0;i<list.length;i++){
      const spec=list[i], entry=spec&&REGISTRY[spec.id];
      if(!entry) continue;                                        // unknown id: skipped, no rng drawn
      entry.fn(ev,state,mulberry32((seed+71000+i*97)>>>0),spec);
    }
    return ev;
  }

  const api={ apply, REGISTRY, phrases, soundingPcs, pchAdd };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.CsdPipes=api;
})(typeof window!=="undefined" ? window : globalThis);
