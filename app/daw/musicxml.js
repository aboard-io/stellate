// musicxml.js — score-partwise MusicXML from the SAME buildEvents walk the audio
// and the MIDI export use.
//
// WHY NO LIBRARY (searched 2026-08-07, recorded in docs/DAW.md). The JS ecosystem
// for MusicXML is renderers and parsers, not writers: OpenSheetMusicDisplay
// renders, vexflow-musicxml parses, @stringsync/musicxml can serialise but is a
// heavy TypeScript schema wrapper needing a build step and a vendor drop. Adapting
// any of them to this event shape is MORE code than this file, which is a sibling
// to engine/midi-export.js and shares its quantiser.
//
// WHAT NOTATION COSTS THAT MIDI DOES NOT. MIDI stores what happened; notation has
// to decide what it MEANT. Two honest approximations, stated here rather than
// hidden:
//   * QUANTISATION. The tape (applyGroove humanize) jitters every onset off the
//     grid on purpose, and swing displaces 8ths. Both are performance, not
//     spelling, so onsets snap to the nearest 16th and the swing is not notated.
//     A swung part therefore READS straight — which is how swing is normally
//     written, but it does mean the file is not a literal transcription.
//   * ENHARMONIC SPELLING. The engine works in pitch classes, so there is no
//     stored answer to "is that an A# or a B♭". Sharps are used throughout except
//     in flat keys, where flats are. A theorist will find wrong spellings in
//     chromatic passages; nothing else will notice.
// Found sound and drums are omitted: one is audio, the other is unpitched and
// would need a percussion map to say anything true.

const STEP_SHARP = [["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0],
                    ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0]];
const STEP_FLAT = [["C", 0], ["D", -1], ["D", 0], ["E", -1], ["E", 0], ["F", 0],
                   ["G", -1], ["G", 0], ["A", -1], ["A", 0], ["B", -1], ["B", 0]];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const DIV = 4;                        // divisions per quarter note = a 16th grid
const q = (beats) => Math.max(1, Math.round(beats * DIV));

// duration in divisions -> the closest note type MusicXML names, plus dots
function typeOf(d) {
  const table = [[16, "whole"], [12, "half"], [8, "half"], [6, "quarter"], [4, "quarter"],
                 [3, "eighth"], [2, "eighth"], [1, "16th"]];
  for (const [n, t] of table) if (d >= n) return { type: t, dot: d === 12 || d === 6 || d === 3 };
  return { type: "16th", dot: false };
}

function pitchXml(midi, flat) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const [step, alter] = (flat ? STEP_FLAT : STEP_SHARP)[pc];
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${oct}</octave></pitch>`;
}

export function buildMusicXml(state, ev, title) {
  const E = window.CsdEngine;
  const beatsPerMeasure = state.meter ? (state.meter.beats | 0) : 4;
  const beatType = state.meter ? (state.meter.unit | 0) || 4 : 4;
  const flat = (state.keyOffset | 0) < 0 || /minor|dorian|phryg/i.test(String(state.progression || ""));

  const VOICES = [["melody", "Melody"], ["pad", "Pad"], ["bass", "Bass"]];
  const parts = [];
  const partList = [];

  VOICES.forEach(([voice, name], pi) => {
    const notes = (ev.pitched || []).filter((e) => e.voice === voice && !e.solo);
    if (!notes.length) return;
    const id = "P" + (pi + 1);
    partList.push(`<score-part id="${id}"><part-name>${esc(name)}</part-name></score-part>`);

    // bucket by measure on the QUANTISED grid, then walk each measure filling
    // gaps with rests — a measure that does not add up is the classic way a
    // MusicXML file opens as garbage
    const perMeasure = new Map();
    for (const n of notes) {
      const on = q(n.beat), dur = Math.max(1, q(n.dur || 0.25));
      const m = Math.floor(on / (beatsPerMeasure * DIV));
      if (!perMeasure.has(m)) perMeasure.set(m, []);
      perMeasure.get(m).push({ on: on - m * beatsPerMeasure * DIV, dur, midi: E.pchToMidi(n.pch) });
    }
    const last = Math.max(0, ...perMeasure.keys());
    const measures = [];
    for (let m = 0; m <= last; m++) {
      const cap = beatsPerMeasure * DIV;
      const list = (perMeasure.get(m) || []).sort((a, b) => a.on - b.on);
      let cur = 0; const body = [];
      for (const n of list) {
        if (n.on < cur) continue;                        // overlap: notation is monophonic per part here
        if (n.on > cur) { const r = n.on - cur; const t = typeOf(r);
          body.push(`<note><rest/><duration>${r}</duration><type>${t.type}</type></note>`); cur = n.on; }
        const d = Math.min(n.dur, cap - cur);
        if (d <= 0) continue;
        const t = typeOf(d);
        body.push(`<note>${pitchXml(n.midi, flat)}<duration>${d}</duration><type>${t.type}</type>${t.dot ? "<dot/>" : ""}</note>`);
        cur += d;
      }
      if (cur < cap) { const r = cap - cur; const t = typeOf(r);
        body.push(`<note><rest/><duration>${r}</duration><type>${t.type}</type></note>`); }
      const attrs = m === 0
        ? `<attributes><divisions>${DIV}</divisions><key><fifths>0</fifths></key>` +
          `<time><beats>${beatsPerMeasure}</beats><beat-type>${beatType}</beat-type></time>` +
          `<clef><sign>${voice === "bass" ? "F" : "G"}</sign><line>${voice === "bass" ? 4 : 2}</line></clef></attributes>` +
          `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>` +
          `<per-minute>${Math.round(state.bpm || 110)}</per-minute></metronome></direction-type></direction>`
        : "";
      measures.push(`<measure number="${m + 1}">${attrs}${body.join("")}</measure>`);
    }
    parts.push(`<part id="${id}">${measures.join("")}</part>`);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>${esc(title || "stellate")}</work-title></work>
  <identification><encoding><software>stellate /daw</software></encoding></identification>
  <part-list>${partList.join("")}</part-list>
  ${parts.join("")}
</score-partwise>`;
}
