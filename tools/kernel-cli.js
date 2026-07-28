#!/usr/bin/env node
// kernel-cli.js — the genre-kernel command line.
//
//   node tools/kernel-cli.js anchors
//   node tools/kernel-cli.js track jungle --seed 7 [--render] [--verify]
//   node tools/kernel-cli.js blend techno vaporwave 0.5 [--seed N] [--render]
//   node tools/kernel-cli.js playlist a b c --tracks 30 --hours 6 --out DIR
//   node tools/kernel-cli.js journey <path.json|genres...> [--hours H --out DIR --render]
//
// This lived inside engine/genre-kernel.js behind `isNode && require.main===module`,
// so every browser downloaded and parsed 243 lines of fs, child_process, ffmpeg
// shelling and WAV muxing it could never run. The kernel is a library; this is the
// program that drives it.
"use strict";
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");     // repo root: found/, .venv-* live here
const ENGINE = path.join(ROOT, "engine");    // what __dirname meant while this lived in engine/
const TOOLS = __dirname;                     // sing.py -> tools/build/, audio-verifier.py -> tools/audit/
const WAV = require(path.join(ENGINE, "faust", "codec", "wav.js"));
const E = require(path.join(ENGINE, "csd-engine.js"));
const K = require(path.join(ENGINE, "genre-kernel.js"));
const { GENRES, track, blend, mix, playlist, journey } = K;

const args=process.argv.slice(2);
const flag=(name,dflt)=>{const ix=args.indexOf("--"+name); return ix>=0?args[ix+1]:dflt;};
const has=(name)=>args.includes("--"+name);
const cmd=args[0];
function resolvePaths(state){
  for(const s of state.foundSources){
    if(s.synthText) continue;   // SPEECH organ: no file — press.js synthesizes it
    s.fsPath=s.samplePath?path.join(ROOT,s.samplePath)
      :([".64.mp3",".mp3",".wav"].map(e=>path.join(ROOT,"found",s.id+e)).find(p=>fs.existsSync(p))
        ||path.join(ROOT,"found",s.id+".64.mp3"));
    if(!fs.existsSync(s.fsPath)){ console.error("✗ missing "+s.fsPath+" — run tools/fetch/fetch-found-sound.sh and tools/fetch/fetch-found-samples.sh"); process.exit(1); }
  }
}
const songBeats=(st)=>st.sections.reduce((n,s)=>n+(s.cycles||1)*E.getProgression(st.progression).chords.length*(st.chordEvery||8),0)+8;
// press a state to a full-length WAV (sing.py chorus + faust press). Kept
// separate from the mp3 encode so the DJ-seam mixer can reuse the raw WAV.
function pressState(state, wavPath){
  // generate the WORLD-sung chorus to match THIS render's tempo + key (sing.py), if used
  const vsrc=state.foundSources.find(s=>s.id==="tw_vocal");
  if(vsrc){
    const vpath=path.join(ROOT,vsrc.samplePath), svpy=path.join(ROOT,".venv-sing","bin","python");
    try{ execFileSync(svpy,[path.join(TOOLS,"build","sing.py"),"--bpm",String(state.bpm),"--transpose",String((state.keyOffset|0)-12),"--out",vpath],{stdio:["ignore","ignore","inherit"]}); }
    catch(e){ console.error("  (sung chorus skipped — .venv-sing/sing.py unavailable)");
      state.foundSources=state.foundSources.filter(s=>s.id!=="tw_vocal");
      state.sections.forEach(s=>{ if(s.vocal) delete s.vocal; }); }
  }
  resolvePaths(state);
  // the press runs on the Faust engine
  const sj=wavPath+".state.json";
  fs.writeFileSync(sj,JSON.stringify(state));
  execFileSync("node",[path.join(ENGINE,"faust","press","press.js"),sj,wavPath],{stdio:["ignore","ignore","inherit"]});
  try{ fs.unlinkSync(sj); }catch(e){}
}
// encode a pressed WAV to a per-track mp3 with a natural fade-out ending
function encodeMp3(wavPath, state, base){
  const beats=songBeats(state), dur=beats*60/state.bpm, fade=Math.min(4,dur*0.1), st=Math.max(0,dur-fade);
  execFileSync("ffmpeg",["-y","-v","error","-i",wavPath,"-af",`afade=t=out:st=${st.toFixed(2)}:d=${fade.toFixed(2)}`,"-codec:a","libmp3lame","-b:a","160k",base+".mp3"]);
  console.log("✓ "+base+".mp3");
}
function renderState(state, base){
  const wav="/tmp/"+path.basename(base)+".wav";
  pressState(state, wav); encodeMp3(wav, state, base);
}

// ---------------------------------------------------------------- DJ-SEAM MIXER
// Songs mix together like a DJ mix rather than stopping and starting.
// At the PCM level the incoming track's first downbeat lands exactly on one
// of the OUTGOING track's bar (4-beat) downbeats. Per-seam policy — all
// decisions derive from the states (bpm, section beats, genre introMode), no
// rng, so the same command is byte-identical:
//   • cold-opener incoming (genre introMode:"off" — gabber/breakcore) OR a
//     tempo jump > GAP_CUT bpm: HARD CUT on the downbeat (what a DJ does into
//     a cold slam / an un-beatmatchable jump).
//   • bpm gap <= GAP_MATCH: equal-power crossfade over 4 bars, the outgoing
//     tail VARISPED (turntable pitch-nudge) to the incoming tempo so the two
//     grids stay bar-locked through the window (true beatmatch).
//   • otherwise: equal-power crossfade over 2 bars, downbeat-aligned at the
//     window start, no varispeed (a big gap would pitch-shift the tail too
//     far) — the outgoing thins as the incoming enters on the one.
// Equal-power: out=cos(x·π/2), in=sin(x·π/2) (cos²+sin²=1). Tempo easing by
// build-time bpm-glide (option a) is NOT feasible: buildEvents maps beats→
// samples with ONE spb, so a per-section tempo ramp would need a kernel time-
// model change; varispeed is the deterministic PCM stand-in (the pitch nudge
// a DJ makes on the fader). See report.
const MIXSR=44100, GAP_MATCH=8, GAP_CUT=40;
function readWavStereo(file){
  const buf=fs.readFileSync(file); let off=12,dataOff=-1,dataLen=0,ch=2,bits=16;
  while(off+8<=buf.length){ const id=buf.toString("ascii",off,off+4), sz=buf.readUInt32LE(off+4);
    if(id==="fmt "){ ch=buf.readUInt16LE(off+10); bits=buf.readUInt16LE(off+22); }
    else if(id==="data"){ dataOff=off+8; dataLen=Math.min(sz,buf.length-off-8); break; }
    off+=8+sz+(sz&1); }
  const by=bits>>3, frames=dataOff<0?0:Math.floor(dataLen/(ch*by));
  const L=new Float32Array(frames), R=new Float32Array(frames);
  for(let i=0;i<frames;i++){ const p=dataOff+i*ch*by; L[i]=buf.readInt16LE(p)/32768; R[i]=ch>1?buf.readInt16LE(p+by)/32768:L[i]; }
  return {L,R,frames};
}
function openWav(file){ const fd=fs.openSync(file,"w");   // header sizes (@4,@40) backpatched in closeWav
  fs.writeSync(fd,WAV.header(MIXSR,2,0),0,44); return {fd,frames:0}; }
function writeFrames(w,L,R,n){ if(n<=0) return; const b=Buffer.alloc(n*4);
  for(let i=0;i<n;i++){ b.writeInt16LE(WAV.toInt16(L[i],"round"),i*4);   // djMix ROUNDS + clamps — see faust/wav.js note
    b.writeInt16LE(WAV.toInt16(R[i],"round"),i*4+2); }
  fs.writeSync(w.fd,b); w.frames+=n; }
function closeWav(w){ const dl=w.frames*4;
  const b1=Buffer.alloc(4); b1.writeUInt32LE(36+dl,0); fs.writeSync(w.fd,b1,0,4,4);
  const b2=Buffer.alloc(4); b2.writeUInt32LE(dl,0); fs.writeSync(w.fd,b2,0,4,40); fs.closeSync(w.fd); }
function djMix(wavs, states, outWav){
  const SRr=MIXSR;
  const info=states.map((st,i)=>{ const beats=songBeats(st);
    // coldOpen: buildSections already recorded whether the leading ground
    // node was ACTUALLY dropped (introMode "off" AND a ground-tagged opener),
    // so read the state's own fact rather than re-deriving from the dominant
    // genre's introMode (which could disagree with what the builder did).
    return { bpm:st.bpm, spb:60/st.bpm, musicEndBeat:beats-8,
      coldOpen:!!st.coldOpen, wav:wavs[i] }; });
  const seams=[];
  for(let i=0;i<info.length-1;i++){ const gap=Math.abs(info[i].bpm-info[i+1].bpm);
    if(info[i+1].coldOpen||gap>GAP_CUT) seams.push({type:"cut",gap});
    else if(gap<=GAP_MATCH) seams.push({type:"blend",Wbeats:16,beatmatch:true,gap});
    else seams.push({type:"blend",Wbeats:8,beatmatch:false,gap}); }
  const w=openWav(outWav); let carryL=null,carryR=null; const report=[];
  for(let i=0;i<info.length;i++){
    const {L,R,frames}=readWavStereo(info[i].wav);
    const spb=info[i].spb, musicEnd=Math.min(frames,Math.round(info[i].musicEndBeat*spb*SRr));
    // (A) INCOMING crossfade: previous outgoing tail (cos-faded) + this head (sin-faded)
    let readPos=0;
    if(carryL){ const HL=Math.min(carryL.length,frames);
      const oL=new Float32Array(HL), oR=new Float32Array(HL);
      for(let j=0;j<HL;j++){ const x=Math.sin((j/HL)*Math.PI/2); oL[j]=carryL[j]+L[j]*x; oR[j]=carryR[j]+R[j]*x; }
      writeFrames(w,oL,oR,HL); readPos=HL; }
    carryL=carryR=null;
    const seam=i<info.length-1?seams[i]:null;
    if(seam&&seam.type==="blend"){
      const cutBeat=Math.floor(info[i].musicEndBeat/4)*4;   // outgoing bar downbeat at music end
      let startBeat=Math.max(0,cutBeat-seam.Wbeats);        // overlap opens W bars earlier, also a downbeat
      let sStart=Math.round(startBeat*spb*SRr), sCut=Math.min(musicEnd,Math.round(cutBeat*spb*SRr));
      if(sStart<readPos) sStart=readPos;
      if(sCut<=sStart){ writeFrames(w,L.subarray(readPos,musicEnd),R.subarray(readPos,musicEnd),Math.max(0,musicEnd-readPos));
        report.push({i,type:"join",gap:seam.gap}); continue; }
      if(sStart>readPos) writeFrames(w,L.subarray(readPos,sStart),R.subarray(readPos,sStart),sStart-readPos);
      const srcLen=sCut-sStart; let tailLen;
      const downbeatSample=w.frames;   // where the incoming (next track's beat 0) will land
      if(seam.beatmatch){ const nspb=info[i+1].spb; tailLen=Math.max(1,Math.round((cutBeat-startBeat)*nspb*SRr));
        carryL=new Float32Array(tailLen); carryR=new Float32Array(tailLen);
        for(let k=0;k<tailLen;k++){ const fp=(k/tailLen)*srcLen, i0=Math.floor(fp), fr=fp-i0, i1=Math.min(srcLen-1,i0+1), g=Math.cos((k/tailLen)*Math.PI/2);
          carryL[k]=(L[sStart+i0]*(1-fr)+L[sStart+i1]*fr)*g; carryR[k]=(R[sStart+i0]*(1-fr)+R[sStart+i1]*fr)*g; } }
      else { tailLen=srcLen; carryL=new Float32Array(tailLen); carryR=new Float32Array(tailLen);
        for(let k=0;k<tailLen;k++){ const g=Math.cos((k/tailLen)*Math.PI/2); carryL[k]=L[sStart+k]*g; carryR[k]=R[sStart+k]*g; } }
      report.push({i,type:seam.beatmatch?"beatmatch":"blend",gap:seam.gap,bars:seam.Wbeats/4,downbeatSample,overlapFrames:tailLen});
    } else if(seam&&seam.type==="cut"){
      const cutBeat=Math.round(info[i].musicEndBeat/4)*4;   // butt-join on the nearest bar downbeat
      let sCut=Math.min(musicEnd,Math.round(cutBeat*spb*SRr)); if(sCut<readPos) sCut=musicEnd;
      writeFrames(w,L.subarray(readPos,sCut),R.subarray(readPos,sCut),sCut-readPos);
      report.push({i,type:"cut",gap:seam.gap,downbeatSample:w.frames});
    } else {   // last track: play out full with a natural fade
      const rest=frames-readPos, fade=Math.min(Math.round(4*SRr),Math.round(frames*0.1));
      const oL=new Float32Array(rest), oR=new Float32Array(rest);
      for(let j=0;j<rest;j++){ const idx=readPos+j, fromEnd=frames-idx, g=fromEnd<=fade?fromEnd/fade:1; oL[j]=L[idx]*g; oR[j]=R[idx]*g; }
      writeFrames(w,oL,oR,rest);
    }
  }
  closeWav(w);
  return { frames:w.frames, seconds:w.frames/SRr, report };
}
// render every track to WAV + per-track mp3, then DJ-mix into one continuous
// journey.mp3 (replaces the old fade-out-then-concat gapless file).
function renderAndMix(dir, pl, bases){
  const wavs=bases.map(b=>b+".wav");
  pl.forEach((tr,i)=>{ console.log(`[render ${i+1}/${pl.length}] ${tr.from}→${tr.to} ${tr.bpm}bpm`);
    pressState(tr.state, wavs[i]); encodeMp3(wavs[i], tr.state, bases[i]); });
  const mixWav=path.join(dir,"journey.mix.wav");
  const m=djMix(wavs, pl.map(t=>t.state), mixWav);
  execFileSync("ffmpeg",["-y","-v","error","-i",mixWav,"-codec:a","libmp3lame","-b:a","160k",path.join(dir,"journey.mp3")]);
  // KEEP_MIXWAV=1 retains the lossless mix WAV + per-track WAVs (seam auditing)
  if(!process.env.KEEP_MIXWAV){ try{ fs.unlinkSync(mixWav); }catch(e){}
    wavs.forEach(wv=>{ try{ fs.unlinkSync(wv); }catch(e){} }); }
  const naive=pl.reduce((s,t)=>s+songBeats(t.state)*60/t.state.bpm,0);
  console.log(`✓ ${path.join(dir,"journey.mp3")} — DJ-mixed ${(m.seconds/60).toFixed(1)}min (naive concat ${(naive/60).toFixed(1)}min; ${(naive-m.seconds).toFixed(1)}s folded into seams)`);
  m.report.forEach(r=>{ if(r.type==="cut") console.log(`  seam ${r.i+1}→${r.i+2}: CUT on the downbeat (gap ${r.gap}bpm) @ ${(r.downbeatSample/MIXSR).toFixed(2)}s`);
    else if(r.type==="join") console.log(`  seam ${r.i+1}→${r.i+2}: butt-join (track too short for a window, gap ${r.gap}bpm)`);
    else console.log(`  seam ${r.i+1}→${r.i+2}: ${r.type} gap ${r.gap}bpm, ${r.bars}-bar window, overlap ${(r.overlapFrames/MIXSR).toFixed(2)}s @ ${(r.downbeatSample/MIXSR).toFixed(2)}s`); });
  return m;
}
if(cmd==="anchors"){
  for(const [k,g] of Object.entries(GENRES)) console.log(k.padEnd(11),g.bpm.join("-")+"bpm",g.form.padEnd(4),"—",g.info);
} else if(cmd==="track"||cmd==="blend"){
  const seed=+flag("seed",1);
  const synth=has("synth");   // --synth: opt OUT of sampled-by-default -> pure Faust synth
  const state=cmd==="track"
    ? track(args[1],{seed,synth})
    : blend(args[1],args[2],parseFloat(args[3]||"0.5"),{seed,synth});
  const base=cmd==="track"?`${args[1]}-s${seed}`:`${args[1]}-${args[2]}-${args[3]||"0.5"}-s${seed}`;
  fs.writeFileSync(base+".state.json",JSON.stringify(state,null,2));
  console.log("✓ "+base+".state.json  ("+JSON.stringify(state.genreMeta)+")");
  if(has("verify")){ const V=require(path.join(ENGINE,"genre-verifier.js")); console.log(V.report(state)); }
  if(has("render")) renderState(state,base);
  if(has("audio-verify")){
    // empirical gate: Discogs-EffNet on the rendered audio (see audio-verifier.py)
    const py=path.join(ROOT,".venv-verify","bin","python");
    try{ execFileSync(py,[path.join(TOOLS,"audit","audio-verifier.py"),base+".mp3","--expect",args[1]],{stdio:"inherit"}); }
    catch(e){ console.error("audio verify: expected genre not in top 3"); }
  }
} else if(cmd==="playlist"){
  const dashIx=args.findIndex(a=>a.startsWith("--"));
  const ways=args.slice(1,dashIx<0?undefined:dashIx);
  const pl=playlist(ways,{tracks:+flag("tracks",12),hours:+flag("hours",2),seed:+flag("seed",42),synth:has("synth")});
  const dir=flag("out","playlist");
  fs.mkdirSync(dir,{recursive:true});
  const manifest=pl.map(({state,...rest})=>rest);
  fs.writeFileSync(path.join(dir,"playlist.json"),JSON.stringify(manifest,null,2));
  pl.forEach(tr=>fs.writeFileSync(path.join(dir,`track-${String(tr.i+1).padStart(2,"0")}.state.json`),JSON.stringify(tr.state,null,2)));
  const total=pl.reduce((s,t)=>s+t.seconds,0);
  console.log(`✓ ${dir}/: ${pl.length} tracks, ${(total/3600).toFixed(2)}h`);
  pl.forEach(t=>console.log(`  ${String(t.i+1).padStart(2)} ${t.from}→${t.to} t=${t.t} ${t.bpm}bpm key=${t.key} ${Math.round(t.seconds/60)}min ${t.meta.kit} ${t.meta.bass} ${t.meta.lead} ${t.meta.progression} ${t.meta.found} hits=${t.meta.hits}`));
  if(has("render")){
    // full render -> DJ-mixed journey.mp3 + mix page (like journey)
    renderAndMix(dir, pl, pl.map(t=>path.join(dir,"track-"+String(t.i+1).padStart(2,"0"))));
    try{ execFileSync("node",[path.join(TOOLS,"build","make-mix-page.js"),dir],{stdio:"inherit"}); }catch(e){}
  } else {
    const rf=+flag("render-first",0);
    for(let i=0;i<rf&&i<pl.length;i++) renderState(pl[i].state, path.join(dir,"track-"+String(i+1).padStart(2,"0")));
  }
} else if(cmd==="journey"){
  // the bridge: a drawn path (explorer "⤓ path" JSON) or genre names ->
  // hours of tracks -> mp3s -> one long journey.mp3 + mix page
  const dashIx=args.findIndex(a=>a.startsWith("--"));
  const posArgs=args.slice(1,dashIx<0?undefined:dashIx);
  let ways, pathSeed=null;
  if(posArgs.length===1 && fs.existsSync(posArgs[0]) && posArgs[0].endsWith(".json")){
    const pj=JSON.parse(fs.readFileSync(posArgs[0],"utf8"));
    if(!Array.isArray(pj.waypoints)||!pj.waypoints.length){ console.error("✗ "+posArgs[0]+" has no waypoints"); process.exit(1); }
    ways=pj.waypoints.map(w=>w.weights?{weights:w.weights}:w);
    if(pj.seed!=null) pathSeed=pj.seed;
  } else {
    ways=posArgs;                                   // genre names, like playlist
    if(ways.length<1){ console.error("usage: kernel-cli.js journey <path.json | genreA genreB ...> [--hours H --tracks N --out DIR --render --seed N]"); process.exit(1); }
  }
  const hours=+flag("hours",2);
  const seed=flag("seed",null)!=null?+flag("seed",1):(pathSeed!=null?pathSeed:42);
  const pl=journey(ways,{tracks:flag("tracks",null)!=null?+flag("tracks",12):undefined,hours,seed,synth:has("synth")});
  const dir=flag("out","journey");
  fs.mkdirSync(dir,{recursive:true});
  const manifest=pl.map(({state,...rest})=>rest);
  fs.writeFileSync(path.join(dir,"playlist.json"),JSON.stringify(manifest,null,2));
  pl.forEach(tr=>fs.writeFileSync(path.join(dir,`track-${String(tr.i+1).padStart(2,"0")}.state.json`),JSON.stringify(tr.state,null,2)));
  const total=pl.reduce((s,t)=>s+t.seconds,0);
  console.log(`✓ ${dir}/: ${pl.length} tracks, ${(total/3600).toFixed(2)}h  (${pl[0].from} → ${pl[pl.length-1].to})`);
  pl.forEach(t=>console.log(`  ${String(t.i+1).padStart(2)} ${t.from}→${t.to} t=${t.t} ${t.bpm}bpm key=${t.key} ${Math.round(t.seconds/60)}min ${t.meta.kit} ${t.meta.lead} ${t.meta.progression} ${t.meta.found}`));
  const bases=pl.map(tr=>path.join(dir,"track-"+String(tr.i+1).padStart(2,"0")));
  if(has("render")){
    // per-track mp3s + one continuous DJ-mixed journey.mp3 (beat-aligned seams)
    renderAndMix(dir, pl, bases);
    // mix page LAST so it links whatever exists (journey.mp3, tracks)
    try{ execFileSync("node",[path.join(TOOLS,"build","make-mix-page.js"),dir],{stdio:"inherit"}); }catch(e){}
  }
} else {
  console.log("usage: kernel-cli.js anchors | track <genre> | blend <a> <b> <t> | playlist <a> <b> ... | journey <path.json|genres...> [--hours H --tracks N --out DIR --render]");
}
