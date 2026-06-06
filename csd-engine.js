// csd-engine.js — pure Csound-score generator for the vaporwave song builder.
// Shared by builder.html, play.html, and engine.test.js (Node). No DOM, no audio.
// buildCsd(state) -> a complete <CsoundSynthesizer> document as a string.
//
// The orchestra is the same engine as royal-road.csd; the SCORE is generated
// from `state` so the UI can rearrange everything. instr 3 (found sound) takes
// its function-table NUMBER as a p-field (p6) so each audio URL gets its own
// table — table numbers must be explicit integers (a named ftgen var passed in
// the score renders silence; learned that the hard way).

(function (root) {
  "use strict";

  // ---- pitch helpers (Csound pch: octave.semitone, semitone 00-11) ----
  function parsePch(s) {
    const [o, ss] = String(s).split(".");
    return parseInt(o, 10) * 12 + parseInt(ss, 10);
  }
  function toPch(abs) {
    const o = Math.floor(abs / 12);
    const ss = abs % 12;
    return o + "." + String(ss).padStart(2, "0");
  }
  function pchAdd(s, semis) {
    return toPch(parsePch(s) + (semis | 0));
  }

  // ---- chord progressions, voiced in C; transposed by state.keyOffset ----
  // each chord: pads[4], bass{r5,r6,f6}, lead[4] (ascending lead tones for arps)
  const PROGRESSIONS = {
    royal_road: {
      label: "Royal Road (IVΔ7-V7-iii7-vi7) — city pop / vaporwave",
      chords: [
        { name: "Fmaj7", pads: ["7.05","7.09","8.00","8.04"], bass: {r5:"5.05",r6:"6.05",f6:"6.00"}, lead: ["8.05","8.09","9.00","9.04"] },
        { name: "G7",    pads: ["7.07","7.11","8.02","8.05"], bass: {r5:"5.07",r6:"6.07",f6:"6.02"}, lead: ["8.07","8.11","9.02","9.05"] },
        { name: "Em7",   pads: ["7.04","7.07","7.11","8.02"], bass: {r5:"5.04",r6:"6.04",f6:"5.11"}, lead: ["8.04","8.07","8.11","9.02"] },
        { name: "Am7",   pads: ["7.09","8.00","8.04","8.07"], bass: {r5:"5.09",r6:"6.09",f6:"6.04"}, lead: ["8.09","9.00","9.04","9.07"] }
      ],
      // hand-composed leads (one 32-beat cycle): [beat, dur, pch]
      composed: [
        [0,1.5,"8.09"],[1.5,0.5,"8.07"],[2,1,"8.09"],[3,2,"9.00"],[5,1.5,"9.04"],[6.5,1.5,"9.02"],
        [8,1,"9.02"],[9,1,"8.11"],[10,2,"8.07"],[12,1,"8.09"],[13,1,"8.11"],[14,2,"9.02"],
        [16,1.5,"9.04"],[17.5,0.5,"9.02"],[18,2,"8.11"],[20,1.5,"8.07"],[21.5,0.5,"8.09"],[22,2,"8.11"],
        [24,1,"9.00"],[25,1,"8.11"],[26,2,"8.09"],[28,1.5,"9.04"],[29.5,0.5,"9.00"],[30,2,"8.09"]
      ],
      composed2: [
        [0,1,"9.00"],[1,1,"9.04"],[2,1,"9.05"],[3,1,"9.04"],[4,2,"9.02"],[6,1,"9.00"],[7,1,"8.11"],
        [8,1.5,"9.02"],[9.5,0.5,"9.04"],[10,1,"9.05"],[11,1,"9.04"],[12,2,"9.02"],[14,2,"8.11"],
        [16,1,"9.04"],[17,1,"9.07"],[18,1,"9.04"],[19,1,"9.02"],[20,2,"8.11"],[22,2,"9.02"],
        [24,1,"9.00"],[25,1,"9.04"],[26,1.5,"9.07"],[27.5,0.5,"9.04"],[28,1,"9.00"],[29,1,"8.09"],[30,2,"8.09"]
      ]
    },
    four_chords: {
      label: "Four chords (I-V-vi-IV) — stadium pop",
      chords: [
        { name: "C",  pads: ["7.00","7.04","7.07","8.00"], bass: {r5:"5.00",r6:"6.00",f6:"6.07"}, lead: ["8.00","8.04","8.07","9.00"] },
        { name: "G",  pads: ["7.07","7.11","8.02","8.07"], bass: {r5:"5.07",r6:"6.07",f6:"6.02"}, lead: ["8.07","8.11","9.02","9.07"] },
        { name: "Am", pads: ["7.09","8.00","8.04","8.09"], bass: {r5:"5.09",r6:"6.09",f6:"6.04"}, lead: ["8.09","9.00","9.04","9.09"] },
        { name: "F",  pads: ["7.05","7.09","8.00","8.05"], bass: {r5:"5.05",r6:"6.05",f6:"6.00"}, lead: ["8.05","8.09","9.00","9.05"] }
      ]
    },
    sad_pop: {
      label: "Sad pop (vi-IV-I-V)",
      chords: [
        { name: "Am", pads: ["7.09","8.00","8.04","8.09"], bass: {r5:"5.09",r6:"6.09",f6:"6.04"}, lead: ["8.09","9.00","9.04","9.09"] },
        { name: "F",  pads: ["7.05","7.09","8.00","8.05"], bass: {r5:"5.05",r6:"6.05",f6:"6.00"}, lead: ["8.05","8.09","9.00","9.05"] },
        { name: "C",  pads: ["7.00","7.04","7.07","8.00"], bass: {r5:"5.00",r6:"6.00",f6:"6.07"}, lead: ["8.00","8.04","8.07","9.00"] },
        { name: "G",  pads: ["7.07","7.11","8.02","8.07"], bass: {r5:"5.07",r6:"6.07",f6:"6.02"}, lead: ["8.07","8.11","9.02","9.07"] }
      ]
    },
    doo_wop: {
      label: "'50s doo-wop (I-vi-IV-V)",
      chords: [
        { name: "C",  pads: ["7.00","7.04","7.07","8.00"], bass: {r5:"5.00",r6:"6.00",f6:"6.07"}, lead: ["8.00","8.04","8.07","9.00"] },
        { name: "Am", pads: ["7.09","8.00","8.04","8.09"], bass: {r5:"5.09",r6:"6.09",f6:"6.04"}, lead: ["8.09","9.00","9.04","9.09"] },
        { name: "F",  pads: ["7.05","7.09","8.00","8.05"], bass: {r5:"5.05",r6:"6.05",f6:"6.00"}, lead: ["8.05","8.09","9.00","9.05"] },
        { name: "G",  pads: ["7.07","7.11","8.02","8.07"], bass: {r5:"5.07",r6:"6.07",f6:"6.02"}, lead: ["8.07","8.11","9.02","9.07"] }
      ]
    },
    ii_v_i: {
      label: "Jazz ii-V-I turnaround",
      chords: [
        { name: "Dm7",   pads: ["7.02","7.05","7.09","8.00"], bass: {r5:"5.02",r6:"6.02",f6:"6.09"}, lead: ["8.02","8.05","8.09","9.00"] },
        { name: "G7",    pads: ["7.07","7.11","8.02","8.05"], bass: {r5:"5.07",r6:"6.07",f6:"6.02"}, lead: ["8.07","8.11","9.02","9.05"] },
        { name: "Cmaj7", pads: ["7.00","7.04","7.07","7.11"], bass: {r5:"5.00",r6:"6.00",f6:"6.07"}, lead: ["8.00","8.04","8.07","8.11"] }
      ]
    }
  };

  const CHORD_BEATS = 8;     // beats per chord
  const SOLO_BEATS  = 16;    // beats per "cycle" of a found-sound solo section

  // ---------- default state: the committed song ----------
  function defaultState() {
    return {
      bpm: 88,
      keyOffset: 0,
      progression: "royal_road",
      reverb: 0.85,
      padDetune: 0.006,     // saw spread
      padCutoff: 1400,      // pad lowpass Hz
      foundSources: [
        { id: "tokyo", label: "Tokyo Station (aporee)", url: "https://archive.org/download/aporee_20938_24294/nov19tokyostation1934.ogg", pitch: 0.78, stretch: 0.45 }
      ],
      sections: [
        { id: "s1", name: "intro",     type: "solo",   cycles: 1, found: { sourceId: "tokyo", role: "solo" }, fillInto: false },
        { id: "s2", name: "A pads",    type: "chords", cycles: 1, pads: true,  bass: "off",     drums: "off",  melody: "off",       found: { sourceId: "tokyo", role: "bed" }, fillInto: false },
        { id: "s3", name: "B +bass",   type: "chords", cycles: 1, pads: true,  bass: "simple",  drums: "off",  melody: "off",       found: { sourceId: "tokyo", role: "bed" }, fillInto: false },
        { id: "s4", name: "C +kick",   type: "chords", cycles: 1, pads: true,  bass: "simple",  drums: "kick", melody: "off",       found: { sourceId: "tokyo", role: "bed" }, fillInto: true },
        { id: "s5", name: "D full",    type: "chords", cycles: 1, pads: true,  bass: "simple",  drums: "full", melody: "composed",  found: { sourceId: "tokyo", role: "bed" }, fillInto: false },
        { id: "s6", name: "interlude", type: "solo",   cycles: 1, found: { sourceId: "tokyo", role: "solo" }, fillInto: true },
        { id: "s7", name: "E reprise", type: "chords", cycles: 1, pads: true,  bass: "walking", drums: "open", melody: "composed2", found: { sourceId: "tokyo", role: "bed" }, fillInto: false },
        { id: "s8", name: "outro",     type: "solo",   cycles: 1, found: { sourceId: "tokyo", role: "solo" }, fillInto: false }
      ]
    };
  }

  // ---------- orchestra (parameterized by a few knobs) ----------
  function orchestra(state, sources) {
    // sources: [{tableNum, fsPath}] -> one ftgen per audio source
    const ftgens = sources.map(s =>
      `gi_src${s.tableNum} ftgen ${s.tableNum}, 0, 0, 1, "${s.fsPath}", 0, 0, 1`
    ).join("\n");
    const detuneLo = (1 - state.padDetune).toFixed(4);
    const detuneHi = (1 + state.padDetune).toFixed(4);
    return `<CsoundSynthesizer>
<CsInstruments>
sr     = 44100
ksmps  = 32
nchnls = 2
0dbfs  = 1

gaRevL init 0
gaRevR init 0
gaMixL init 0
gaMixR init 0

giwin ftgen 1, 0, 16384, 20, 2, 1          ; Hanning grain window (table 1)
${ftgens}

instr 1   ; pad
  ipch = cpspch(p4)
  iamp = p5
  kwow lfo ipch*0.004, 0.3, 0
  kf   = ipch + kwow
  aenv linsegr 0, 1.5, iamp, p3-1.5, iamp*0.8, 2.5, 0
  a1 vco2 1, kf*${detuneLo}, 0
  a2 vco2 1, kf, 0
  a3 vco2 1, kf*${detuneHi}, 0
  asig = (a1+a2+a3)*0.33
  asig moogladder asig, ${state.padCutoff}, 0.15
  asig = asig*aenv
  gaMixL = gaMixL + asig*0.7
  gaMixR = gaMixR + asig*0.7
  gaRevL = gaRevL + asig*0.55
  gaRevR = gaRevR + asig*0.55
endin

instr 2   ; bass
  ipch = cpspch(p4)
  iamp = p5
  aenv linsegr 0, 0.012, iamp, p3-0.05, iamp*0.5, 0.10, 0
  a1 vco2 1, ipch, 0
  a1 moogladder a1, 700, 0.15
  asig = a1*aenv
  gaMixL = gaMixL + asig
  gaMixR = gaMixR + asig
  gaRevL = gaRevL + asig*0.08
  gaRevR = gaRevR + asig*0.08
endin

instr 3   ; found sound, granular  (p5 amp, p6 ftable, p7 pitch, p8 prate)
  iamp = p5
  aenv linsegr 0, 1.5, iamp, p3-3.0, iamp, 1.5, 0
  asig syncgrain iamp, 28, p7, 0.12, p8, p6, giwin, 100
  asig moogladder asig, 2600, 0.1
  asig = asig*aenv
  gaMixL = gaMixL + asig*0.55
  gaMixR = gaMixR + asig*0.55
  gaRevL = gaRevL + asig*0.6
  gaRevR = gaRevR + asig*0.6
endin

instr 4   ; lead melody
  ipch = cpspch(p4)
  iamp = p5
  kvib lfo ipch*0.006, 5.2, 0
  kf = ipch + kvib
  aenv linsegr 0, 0.05, iamp, p3-0.12, iamp*0.85, 0.30, 0
  a1 oscili 1, kf
  a2 oscili 1, kf*1.004
  a3 oscili 0.16, kf*2
  asig = (a1+a2)*0.5 + a3
  asig moogladder asig, 3400, 0.05
  asig = asig*aenv
  gaMixL = gaMixL + asig*0.6
  gaMixR = gaMixR + asig*0.6
  gaRevL = gaRevL + asig*0.45
  gaRevR = gaRevR + asig*0.45
endin

instr 10  ; kick
  iamp = p5
  kp expseg 110, 0.06, 46, p3-0.06, 40
  aenv transeg 1, p3, -4, 0
  a1 oscili iamp*aenv, kp
  a1 = tanh(a1*1.4)*0.8
  gaMixL = gaMixL + a1
  gaMixR = gaMixR + a1
endin

instr 11  ; snare / rim
  iamp = p5
  aenv transeg 1, p3, -6, 0
  anz noise iamp, 0
  anz butbp anz, 1800, 1600
  at1 oscili iamp*0.5, 300
  at2 oscili iamp*0.3, 185
  asig = (anz+at1+at2)*aenv
  gaMixL = gaMixL + asig
  gaMixR = gaMixR + asig
  gaRevL = gaRevL + asig*0.18
  gaRevR = gaRevR + asig*0.18
endin

instr 12  ; hat
  iamp = p5
  aenv transeg 1, p3, -8, 0
  anz noise iamp, 0
  anz buthp anz, 7000
  asig = anz*aenv
  gaMixL = gaMixL + asig*0.7
  gaMixR = gaMixR + asig*0.7
endin

instr 99  ; reverb -> master
  aL, aR reverbsc gaRevL, gaRevR, ${state.reverb}, 12000
  gaMixL = gaMixL + aL
  gaMixR = gaMixR + aR
  clear gaRevL, gaRevR
endin

instr 100 ; master soft-limit
  aL clip gaMixL, 0, 0.95
  aR clip gaMixR, 0, 0.95
  outs aL, aR
  clear gaMixL, gaMixR
endin

</CsInstruments>`;
  }

  // ---------- score generation ----------
  function bassPattern(kind, S, b, k) {
    const r5 = pchAdd(b.r5,k), r6 = pchAdd(b.r6,k), f6 = pchAdd(b.f6,k);
    const L = [];
    if (kind === "walking") {
      L.push([0,1.0,r5],[1,0.5,r6],[1.5,0.5,f6],[2.5,0.5,r5],[3,1.0,r6],
             [4,0.5,r5],[4.5,0.5,f6],[5.5,0.5,r6],[6,1.0,r5],[7,0.5,r6],[7.5,0.5,f6]);
    } else { // simple
      L.push([0,1.5,r5],[2,0.5,r6],[3,1.0,f6],[4.5,0.5,r5],[5,1.0,r6],[6.5,1.5,r5]);
    }
    const amp = 0.22;
    return L.map(([o,d,p]) => `i 2 ${(S+o).toFixed(3)} ${d} ${p} ${amp}`).join("\n");
  }

  function drumPattern(kind, S) {
    const out = [];
    const k = (o,a) => out.push(`i 10 ${(S+o).toFixed(3)} 0.35 ${a}`);
    const s = (o,a) => out.push(`i 11 ${(S+o).toFixed(3)} 0.30 ${a}`);
    const h = (o,a,dur) => out.push(`i 12 ${(S+o).toFixed(3)} ${dur||0.10} ${a}`);
    if (kind === "kick") {
      k(0,0.65); k(4,0.65); h(3.5,0.10); h(7.5,0.10);
    } else if (kind === "full" || kind === "open") {
      k(0,0.65); k(2.5,0.38); k(4,0.65); k(6.5,0.38);
      s(2,0.42); s(6,0.42);
      const openHat = kind === "open";
      if (openHat) { s(3.5,0.16); s(7.5,0.16); }
      for (let i=0;i<8;i++){
        const o = 0.5 + i; // offbeats 0.5..7.5
        if (openHat && (o===3.5||o===7.5)) h(o,0.16,0.30);
        else h(o,0.13);
      }
    }
    return out.join("\n");
  }

  function fill(S) {
    return [
      `i 11 ${(S+0).toFixed(3)} 0.25 0.34`,
      `i 11 ${(S+0.5).toFixed(3)} 0.25 0.36`,
      `i 11 ${(S+1).toFixed(3)} 0.22 0.40`,
      `i 11 ${(S+1.25).toFixed(3)} 0.20 0.42`,
      `i 11 ${(S+1.5).toFixed(3)} 0.20 0.45`,
      `i 11 ${(S+1.75).toFixed(3)} 0.20 0.48`,
      `i 10 ${(S+0).toFixed(3)} 0.30 0.55`
    ].join("\n");
  }

  function melodyForChord(style, S, chord, k) {
    // generative arp/wander over the chord's lead tones (8 beats)
    const lead = chord.lead.map(p => pchAdd(p,k));
    const seq = [];
    let order;
    if (style === "arpup") order = [0,1,2,3,2,1,2,3];
    else if (style === "arpdown") order = [3,2,1,0,1,2,1,0];
    else { // wander — deterministic pseudo-walk
      order = [];
      let x = 0;
      for (let i=0;i<8;i++){ order.push(((x%4)+4)%4); x += (i*7+3)%5 - 2; }
    }
    for (let i=0;i<8;i++) seq.push([i,0.9,lead[order[i]]]);
    return seq.map(([o,d,p]) => `i 4 ${(S+o).toFixed(3)} ${d} ${p} 0.14`).join("\n");
  }

  function composedMelody(arr, base, k) {
    return arr.map(([o,d,p]) => `i 4 ${(base+o).toFixed(3)} ${d} ${pchAdd(p,k)} 0.14`).join("\n");
  }

  function buildCsd(state) {
    const prog = PROGRESSIONS[state.progression] || PROGRESSIONS.royal_road;
    const chords = prog.chords;
    const k = state.keyOffset | 0;
    const cycleBeats = chords.length * CHORD_BEATS;

    // assign table numbers (window=1, sources from 2) and resolve fs paths
    const srcByTable = [];
    const srcById = {};
    state.foundSources.forEach((s, i) => {
      const tableNum = i + 2;
      const fsPath = s.fsPath || ("found/" + s.id + ".wav");
      const rec = { tableNum, fsPath, pitch: s.pitch ?? 0.78, stretch: s.stretch ?? 0.45 };
      srcByTable.push(rec);
      srcById[s.id] = rec;
    });

    const lines = [];
    let cur = 0;

    for (const sec of state.sections) {
      const found = sec.found && sec.found.sourceId ? srcById[sec.found.sourceId] : null;

      if (sec.type === "solo") {
        const len = (sec.cycles || 1) * SOLO_BEATS;
        if (found) lines.push(`i 3 ${cur.toFixed(3)} ${len} 0 0.42 ${found.tableNum} ${found.pitch} ${found.stretch}`);
        if (sec.fillInto) lines.push(fill(cur + len - 2));
        cur += len;
        continue;
      }

      const cycles = sec.cycles || 1;
      const secBeats = cycles * cycleBeats;
      if (found && sec.found.role === "bed")
        lines.push(`i 3 ${cur.toFixed(3)} ${secBeats} 0 0.05 ${found.tableNum} ${found.pitch} ${found.stretch}`);

      for (let c = 0; c < cycles; c++) {
        const cycleBase = cur + c * cycleBeats;
        chords.forEach((chord, ci) => {
          const S = cycleBase + ci * CHORD_BEATS;
          if (sec.pads)
            chord.pads.forEach(p => lines.push(`i 1 ${S.toFixed(3)} ${CHORD_BEATS} ${pchAdd(p,k)} 0.085`));
          if (sec.bass && sec.bass !== "off")
            lines.push(bassPattern(sec.bass, S, chord.bass, k));
          if (sec.drums && sec.drums !== "off")
            lines.push(drumPattern(sec.drums, S));
        });
        // melody: composed (royal-road only) or generative per chord
        if (sec.melody && sec.melody !== "off") {
          const composed = (sec.melody === "composed") ? prog.composed
                          : (sec.melody === "composed2") ? prog.composed2 : null;
          if (composed && cycleBeats === 32) {
            lines.push(composedMelody(composed, cycleBase, k));
          } else {
            const genStyle = (sec.melody === "composed" || sec.melody === "composed2") ? "arpup" : sec.melody;
            chords.forEach((chord, ci) => melodyForChord(genStyle, cycleBase + ci*CHORD_BEATS, chord, k) &&
              lines.push(melodyForChord(genStyle, cycleBase + ci*CHORD_BEATS, chord, k)));
          }
        }
      }
      if (sec.fillInto) lines.push(fill(cur + secBeats - 2));
      cur += secBeats;
    }

    const total = cur + 8; // tail
    const head =
      `t 0 ${state.bpm}\n` +
      `i 100 0 ${total}\n` +
      `i 99 0 ${total}\n`;

    return orchestra(state, srcByTable) +
      "\n<CsScore>\n" + head + lines.join("\n") + "\ne\n</CsScore>\n</CsoundSynthesizer>\n";
  }

  const api = { buildCsd, defaultState, PROGRESSIONS, pchAdd };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CsdEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
