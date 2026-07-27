// midi-export.js — Standard MIDI File (type 1) from the same buildEvents() the
// audio path uses, so the MIDI matches what you hear (minus the found sound,
// which is audio, not notes). Tracks: Pads (ch1), Bass (ch2), Melody (ch3),
// Drums (ch10, GM percussion). buildMidi(state) -> Uint8Array.
//
// TWO CALLERS. (1) The browser: index.html loads it as a classic global
// (window.MidiExport) for the ⚙ panel's ⤓ midi download (app/export.js; gate
// test/midi-export-run.js). It reads window.CsdEngine at load, so it must
// come AFTER engine/csd-engine.js in the page (boot-smoke enforces the order).
// (2) Node: the MIDI-corpus gates use it as the reference SMF WRITER —
// test/midi-mine.test.js round-trips the mine-midi parser against it, and
// test/corpus-db.test.js builds fixture SMFs with it.

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
    // full kit -> GM percussion; lanes without a GM home are skipped (an
    // unmapped lane used to fall through as note `undefined` -> byte 0)
    const map={kick:36,snare:38,hat:42,tom:45,crash:49,ride:51,clap:39,rim:37,perc:63};
    const evs=[];
    for(const d of drums){
      const note = d.drum==="hat" ? (d.open?46:42) : map[d.drum];
      if(note==null) continue;
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
    // real time signature (state.meter, absent = 4/4 — was hardcoded 4/4)
    const nn=(state.meter&&state.meter.beats)||4;
    const dd=Math.round(Math.log2((state.meter&&state.meter.unit)||4));
    const meta=[ 0x00,0xFF,0x58,0x04,nn,dd,0x18,0x08,
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

  // WHOLE-PATH MIDI (the Faithful export): concatenate the per-bar note events
  // the offline loop-walk produced (app/journey.js), each already carrying its
  // absolute startBeat + bpm, into ONE Standard MIDI File with a tempo map.
  // bars: [{ ev:{pitched,drums}, startBeat, bpm }].
  function buildMidiJourney(bars){
    const pads=[], bass=[], mel=[], drums=[], tempos=[];
    let lastBpm=null;
    for(const b of bars){
      if(b.bpm!==lastBpm){ tempos.push({beat:b.startBeat, bpm:b.bpm}); lastBpm=b.bpm; }
      const ev=b.ev||{};
      for(const p of (ev.pitched||[])){ const n={beat:b.startBeat+p.beat, dur:p.dur, pch:p.pch, amp:p.amp};
        (p.voice==="pad"?pads:p.voice==="bass"?bass:mel).push(n); }
      for(const d of (ev.drums||[])) drums.push({beat:b.startBeat+d.beat, dur:d.dur, drum:d.drum, open:d.open, amp:d.amp});
    }
    // conductor/tempo track: 4/4 sig + a tempo meta at each bpm change
    const tevs=[{t:0,b:[0xFF,0x58,0x04,0x04,0x02,0x18,0x08]}];
    for(const tp of tempos){ const us=Math.round(60000000/(tp.bpm||88));
      tevs.push({t:Math.round(tp.beat*PPQ),b:[0xFF,0x51,0x03,(us>>16)&255,(us>>8)&255,us&255]}); }
    const tracks=[track(tevs,"Tempo",0,null)];
    if(pads.length) tracks.push(pitchTrack(pads,0,89,"Pads"));
    if(bass.length) tracks.push(pitchTrack(bass,1,38,"Bass"));
    if(mel.length)  tracks.push(pitchTrack(mel,2,81,"Melody"));
    if(drums.length) tracks.push(drumTrack(drums));
    const hdr=[...str("MThd"),0,0,0,6,0,1,(tracks.length>>8)&255,tracks.length&255,(PPQ>>8)&255,PPQ&255];
    const out=[...hdr];
    for(const t of tracks){ const L=t.length; out.push(...str("MTrk"),(L>>>24)&255,(L>>>16)&255,(L>>>8)&255,L&255,...t); }
    return new Uint8Array(out);
  }

  const api={ buildMidi, buildMidiJourney };
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else root.MidiExport=api;
})(typeof window!=="undefined" ? window : globalThis);
