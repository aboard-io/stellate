// midi-export.js — Standard MIDI File (type 1) from the same buildEvents() the
// Csound path uses, so the MIDI matches what you hear (minus the found sound,
// which is audio, not notes). Tracks: Pads (ch1), Bass (ch2), Melody (ch3),
// Drums (ch10, GM percussion). buildMidi(state) -> Uint8Array.

(function (root) {
  "use strict";
  const Eng = (typeof CsdEngine !== "undefined") ? CsdEngine
            : (typeof require !== "undefined") ? require("./csd-engine.js") : null;

  const PPQ = 480;
  const vlq = (n) => { const b=[n&0x7f]; n>>>=7; while(n>0){ b.unshift((n&0x7f)|0x80); n>>>=7; } return b; };
  const str = (s) => [...s].map(c=>c.charCodeAt(0));

  function track(evs, name, ch, program){
    evs.sort((a,b)=> (a.t-b.t) || ((a.b[0]&0xF0)===0x80?0:1)-((b.b[0]&0xF0)===0x80?0:1));
    let d=[];
    const nm=str(name); d.push(0x00,0xFF,0x03,...vlq(nm.length),...nm);
    if(program!=null) d.push(0x00,0xC0|ch,program&0x7f);
    let last=0;
    for(const e of evs){ d.push(...vlq(e.t-last),...e.b); last=e.t; }
    d.push(0x00,0xFF,0x2F,0x00);
    return d;
  }

  function pitchTrack(notes, ch, program, name){
    const evs=[];
    for(const n of notes){
      const on=Math.round(n.beat*PPQ), off=on+Math.max(1,Math.round(n.dur*PPQ));
      const m=Eng.pchToMidi(n.pch); if(m<0||m>127) continue;
      const vel=Math.max(1,Math.min(127,Math.round(40+n.amp*280)));
      evs.push({t:on,b:[0x90|ch,m,vel]});
      evs.push({t:off,b:[0x80|ch,m,0]});
    }
    return track(evs,name,ch,program);
  }

  function drumTrack(drums){
    const map={kick:36,snare:38,hat:42};
    const evs=[];
    for(const d of drums){
      const note = d.drum==="hat" ? (d.open?46:42) : map[d.drum];
      const on=Math.round(d.beat*PPQ), off=on+Math.max(1,Math.round((d.dur||0.1)*PPQ));
      const vel=Math.max(1,Math.min(127,Math.round(40+d.amp*220)));
      evs.push({t:on,b:[0x99,note,vel]});      // channel 10 (index 9)
      evs.push({t:off,b:[0x89,note,0]});
    }
    return track(evs,"Drums",9,null);
  }

  function buildMidi(state){
    const ev = Eng.buildEvents(state);
    const us = Math.round(60000000/(ev.bpm||88));
    const meta=[ 0x00,0xFF,0x58,0x04,0x04,0x02,0x18,0x08,
                 0x00,0xFF,0x51,0x03,(us>>16)&255,(us>>8)&255,us&255,
                 0x00,0xFF,0x2F,0x00 ];
    const tracks=[meta];
    const pads=ev.pitched.filter(p=>p.voice==="pad");
    const bass=ev.pitched.filter(p=>p.voice==="bass");
    const mel =ev.pitched.filter(p=>p.voice==="melody");
    if(pads.length) tracks.push(pitchTrack(pads,0,89,"Pads"));
    if(bass.length) tracks.push(pitchTrack(bass,1,38,"Bass"));
    if(mel.length)  tracks.push(pitchTrack(mel,2,81,"Melody"));
    if(ev.drums.length) tracks.push(drumTrack(ev.drums));

    const hdr=[...str("MThd"),0,0,0,6,0,1,(tracks.length>>8)&255,tracks.length&255,(PPQ>>8)&255,PPQ&255];
    const out=[...hdr];
    for(const t of tracks){
      const L=t.length;
      out.push(...str("MTrk"),(L>>>24)&255,(L>>>16)&255,(L>>>8)&255,L&255,...t);
    }
    return new Uint8Array(out);
  }

  const api={ buildMidi };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.MidiExport=api;
})(typeof window!=="undefined" ? window : globalThis);
