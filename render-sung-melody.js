#!/usr/bin/env node
// render-sung-melody.js — make the speech synthesizer SING (the Kraftwerk "Pocket
// Calculator" / "Radioactivity" trick: a VOCODER). A bright synth CARRIER plays the
// melody at exact pitches; the espeak words are the MODULATOR; a filterbank imposes the
// words' formants onto the carrier so the synth sings the lyric in tune.
//
//   node render-sung-melody.js            -> sung-melody.wav + sung-melody.mp3
//
// (Standalone for now — validates the singing before it becomes the chorus.)
// Requires: espeak-ng, ffmpeg (with rubberband), csound.
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");

const BPM = 112, SPB = 60 / BPM;
const TRANSPOSE = -12;   // an octave down: lower pitch + DENSER carrier harmonics in the formant range = more intelligible
// the 8-bar chorus. [word, midiNote, beat, durBeats]. The rhymes (fare/care/stare/share)
// all land on E5 (64) — the hook. Mostly stepwise, minor, Kraftwerk-simple.
const MELODY = [
  // "When I pay / my train fare"
  ["when",69,0,1],["i",67,1,1],["pay",65,2,2],   ["my",64,4,1],["train",62,5,1],["fare",64,6,2],
  // "I don't have / to think or care"
  ["i",69,8,1],["dont",67,9,1],["have",65,10,2],  ["to",64,12,1],["think",62,13,1],["or",60,14,1],["care",64,15,1],
  // "When you see me / you can stare"
  ["when",67,16,1],["you",67,17,1],["see",69,18,1],["me",69,19,1], ["you",67,20,1],["can",65,21,1],["stare",64,22,2],
  // "We can take / the train and share"
  ["we",60,24,1],["can",64,25,1],["take",69,26,2], ["the",67,28,1],["train",65,29,1],["and",62,30,1],["share",64,31,1],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sung-"));
const espeak = (w, out) => execFileSync("espeak-ng", ["-v","en-us","-p","45","-s","130","-w",out,w]);   // slower = clearer
const dur = f => +execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0",f]).toString().trim();

// 1) generate each word once, then time-stretch a copy to fill its note's slot (legato singing)
console.log("synthesizing + stretching words…");
const rawByWord = {};
const notes = MELODY.map(([word,midi,beat,d], i) => {
  if (!rawByWord[word]) { const r = path.join(tmp, `w_${word}.wav`); espeak(word, r); rawByWord[word] = r; }
  const nat = dur(rawByWord[word]), target = d * SPB;
  const tempo = Math.max(0.45, Math.min(1.9, nat / target));   // <1 = slower/longer (sustains held vowels); clamped so words don't smear
  const out = path.join(tmp, `s_${i}.wav`);
  execFileSync("ffmpeg", ["-y","-v","error","-i",rawByWord[word],
    "-af",`rubberband=tempo=${tempo.toFixed(4)}:transients=crisp:pitchq=quality,highpass=f=110,loudnorm=I=-14:TP=-1.5`,"-ar","44100","-ac","1",out]);
  return { word, midi, beat, slot: dur(out), file: out, tableNum: 2 + i };
});
console.log(`words: ${notes.length}, last beat: ${Math.max(...notes.map(n=>n.beat))}, span: ${((Math.max(...notes.map(n=>n.beat))+2)*SPB).toFixed(1)}s, mean slot: ${(notes.reduce((s,n)=>s+n.slot,0)/notes.length).toFixed(2)}s`);

// 2) build the csd — carrier (synth) + modulator (word) + a channel vocoder
const ft = notes.map(n => `gi_w${n.tableNum} ftgen ${n.tableNum}, 0, 0, 1, "${n.file}", 0, 0, 1`).join("\n");
const NB = 28, F0 = 180, F1 = 6400;                            // vocoder filterbank (more, tighter bands)
// each band: bandpass the modulator + carrier, follow the modulator's envelope (snappy, to keep
// consonant transients), apply that envelope to the carrier band
let bands = "";
for (let i = 0; i < NB; i++) {
  const fc = Math.round(F0 * Math.pow(F1 / F0, i / (NB - 1))), bw = Math.round(fc * 0.4);
  const g = (fc >= 600 && fc <= 3500) ? 1.5 : 1.0;             // emphasize the speech-formant region (where intelligibility lives)
  bands +=
`  amb${i} butterbp gaMod, ${fc}, ${bw}
  acb${i} butterbp gaCar, ${fc}, ${bw}
  aev${i} follow2 amb${i}, 0.003, 0.02
  asum = asum + acb${i}*aev${i}*${g}
`;
}
const totalBeats = Math.max(...notes.map(n => n.beat)) + 4;
// score times are in BEATS (the `t 0 BPM` tempo converts to seconds); p3 = slot in beats
const score = notes.map(n =>
  `i 10 ${n.beat.toFixed(3)} ${(n.slot/SPB).toFixed(3)} ${n.midi + TRANSPOSE}\n` +
  `i 11 ${n.beat.toFixed(3)} ${(n.slot/SPB).toFixed(3)} ${n.tableNum}`).join("\n");

const csd =
`<CsoundSynthesizer>
<CsOptions>
--nosound -o ${path.join(tmp,"sung.wav")} -W
</CsOptions>
<CsInstruments>
sr=44100
ksmps=16
nchnls=2
0dbfs=1
gaCar init 0
gaMod init 0
${ft}

instr 10  ; CARRIER — a bright buzzy synth (pitch) + broadband NOISE (so unvoiced consonants
          ; s/t/k/f have spectral energy for the vocoder bands to shape — the intelligibility key)
  ipch = cpsmidinn(p4)
  aenv linsegr 0, 0.02, 1, p3-0.06, 1, 0.05, 0
  a1 vco2 0.6, ipch, 0
  a2 vco2 0.6, ipch*1.005, 0
  asub vco2 0.6, ipch*0.5, 0       ; sub-octave for body/lowness (no octave-UP partial — that was making the ear hear it an octave too high)
  atone = (a1+a2+asub)*0.7
  anz noise 0.4, 0
  gaCar = gaCar + (atone + anz)*aenv
endin

instr 11  ; MODULATOR — play one word sample (p4 = its table)
  itab = p4
  idur = ftlen(itab)/sr
  aph phasor 1/idur
  amod tablei aph*ftlen(itab), itab, 0, 0, 0
  aenv linseg 1, p3-0.015, 1, 0.015, 0
  gaMod = gaMod + amod*aenv
endin

instr 99  ; the vocoder: impose the words' band-envelopes onto the carrier
  asum init 0
  asum = 0
${bands}  ahf buthp gaMod, 3300
  asum = asum + ahf*1.1              ; pass the words' raw consonants/sibilance straight through
  asum = asum*3.6
  asum = tanh(asum*1.2)*0.82         ; soft saturate — analog vocoder grit
  aL, aR reverbsc asum, asum, 0.6, 11000
  outs asum + aL*0.18, asum + aR*0.18
  clear gaCar, gaMod
endin
</CsInstruments>
<CsScore>
t 0 ${BPM}
i 99 0 ${(totalBeats+2).toFixed(3)}
${score}
e
</CsScore>
</CsoundSynthesizer>
`;
const csdPath = path.join(tmp, "sung.csd");
fs.writeFileSync(csdPath, csd);
console.log(`rendering vocoder (${notes.length} words, ${NB} bands)…`);
execFileSync("csound", [csdPath], { stdio: ["ignore","ignore","inherit"] });
// normalize + mp3
execFileSync("ffmpeg", ["-y","-v","error","-i",path.join(tmp,"sung.wav"),
  "-af","acompressor=threshold=-22dB:ratio=4:attack=4:release=120,loudnorm=I=-14:TP=-1","-ar","44100", path.join(__dirname,"sung-melody.wav")]);
execFileSync("ffmpeg", ["-y","-v","error","-i",path.join(__dirname,"sung-melody.wav"),
  "-codec:a","libmp3lame","-b:a","192k", path.join(__dirname,"sung-melody.mp3")]);
console.log("✓ sung-melody.wav + sung-melody.mp3");
