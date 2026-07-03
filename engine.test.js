// engine.test.js — render-verify the CSD generator against the real csound binary.
//   node engine.test.js
// Requires: csound on PATH, and found/tokyo_station.wav (./fetch-found-sound.sh).
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildCsd, defaultState, PROGRESSIONS, STYLES, generateSong } = require("./csd-engine.js");

const HERE = __dirname;
const TOKYO = path.join(HERE, "found", "tokyo_station.wav");
if (!fs.existsSync(TOKYO)) {
  console.error("missing found/tokyo_station.wav — run ./fetch-found-sound.sh first");
  process.exit(2);
}

// inject CsOptions for offline render (browser sets these via setOption instead)
function withOptions(csd, outWav) {
  return csd.replace(
    "<CsoundSynthesizer>",
    `<CsoundSynthesizer>\n<CsOptions>\n--nosound -o ${outWav} -W\n</CsOptions>`
  );
}

function render(name, state) {
  // point every found source at the real local wav
  state.foundSources.forEach(s => { s.fsPath = TOKYO; });
  const csd = buildCsd(state);
  const csdPath = path.join(os.tmpdir(), `eng_${name}.csd`);
  const outWav = path.join(os.tmpdir(), `eng_${name}.wav`);
  fs.writeFileSync(csdPath, withOptions(csd, outWav));
  const r = spawnSync("csound", [csdPath], { encoding: "utf8" });
  let out = (r.stdout || "") + (r.stderr || "");     // csound logs to stderr
  out = out.replace(/\x1b\[[0-9;]*m/g, "");          // strip ANSI color codes
  const errs = (out.match(/error:/gi) || []).length;
  const amps = /overall amps:[^\d]*([\d.]+)/.exec(out);
  const peak = amps ? parseFloat(amps[1]) : 0;
  const ok = /end of score/.test(out) && errs === 0;
  const sz = fs.existsSync(outWav) ? fs.statSync(outWav).size : 0;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} errors=${errs} peak=${peak.toFixed(3)} wav=${(sz/1024|0)}KB`);
  return ok && sz > 1000 ? peak : 0;
}

let allOk = true;

// 1) the default committed song
allOk &= 0<render("default_song", defaultState());

// 2) every progression preset (default sections, swapped progression)
for (const prog of Object.keys(PROGRESSIONS)) {
  const s = defaultState();
  s.progression = prog;
  allOk &= 0<render("prog_" + prog, s);
}

// 3) key transposition
{
  const s = defaultState(); s.keyOffset = 3; allOk &= 0<render("key_+3", s);
  const t = defaultState(); t.keyOffset = -5; allOk &= 0<render("key_-5", t);
}

// 4) generative melodies + custom layering
for (const mel of ["arpup","arpdown","wander"]) {
  const s = defaultState();
  s.sections = [
    { id:"x", name:"test", type:"chords", cycles:2, pads:true, bass:"walking", drums:"open", melody:mel, found:{sourceId:"tokyo",role:"bed"}, fillInto:true }
  ];
  allOk &= 0<render("mel_" + mel, s);
}

// 5) two found sources, multiple tables
{
  const s = defaultState();
  s.foundSources.push({ id:"tokyo2", label:"dup", url:"x", pitch:0.6, stretch:0.6 });
  s.sections[5].found = { sourceId:"tokyo2", role:"solo" };
  allOk &= 0<render("two_sources", s);
}

// 6) DRUMS MUST BE AUDIBLE (the p4/p5 bug). drums-only section, expect real peak.
{
  const s = defaultState();
  s.foundSources = [];
  s.sections = [{ id:"d", name:"drums", cycles:2, pads:false, bass:"off", drums:"open", melody:"off", found:{sourceId:null}, fillInto:true }];
  const peak = render("drums_only", s);
  const audible = peak > 0.1;
  console.log("       drums audible:", audible, "(peak "+peak.toFixed(3)+")");
  allOk &= audible ? 1 : 0;
}

// 7) new bass + melody patterns
for (const bass of ["root","octaves","sixteenths","dub","drive"]) {
  const s = defaultState();
  s.sections = [{ id:"b", name:"b", cycles:1, pads:true, bass, drums:"full", melody:"off", found:{sourceId:null}, fillInto:false }];
  allOk &= 0<render("bass_"+bass, s);
}
for (const mel of ["updown","pentaup","sparse","double","hero","motorik"]) {
  const s = defaultState();
  s.sections = [{ id:"m", name:"m", cycles:1, pads:true, bass:"simple", drums:"off", melody:mel, found:{sourceId:null}, fillInto:false }];
  allOk &= 0<render("mel_"+mel, s);
}

// 7b) the big tom fill + drum reverb send + supersaw hero lead + pulse kit
{
  const s = defaultState();
  s.instruments.drums.send = 0.55;
  s.instruments.melody = Object.assign(s.instruments.melody, { wave:"saw", voices:7, spread:0.015 });
  s.sections = [{ id:"tf", name:"tf", cycles:1, pads:true, bass:"drive", drums:"pulse", melody:"hero", found:{sourceId:null}, fill:"tom fill" }];
  allOk &= 0<render("supersaw_pulse_fill", s);
}

// 7c) genre-kernel engine vocabulary: new kits, bass, chops, pump, crackle, tone
for (const d of ["techno","house","breaks","jungle"]) {
  const s = defaultState();
  s.sections = [{ id:"k", name:"k", cycles:2, pads:false, bass:"rolling", drums:d, melody:"off", found:{sourceId:null}, fill:"break fill" }];
  allOk &= 0<render("kit_"+d, s);
}
for (const b of ["sub","stab"]) {
  const s = defaultState();
  s.sections = [{ id:"b2", name:"b2", cycles:1, pads:true, bass:b, drums:"off", melody:"off", found:{sourceId:null}, fill:"off" }];
  allOk &= 0<render("bass_"+b, s);
}
{
  const s = defaultState();
  s.progression = "drone_min"; s.pump = 0.5; s.crackle = 0.5; s.tone = { lowcut:40, highcut:9000 };
  s.sections = [{ id:"pc", name:"pc", cycles:4, pads:true, bass:"rolling", drums:"techno", melody:"off", found:{sourceId:"tokyo",role:"chops"}, fill:"off" }];
  allOk &= 0<render("pump_crackle_chops", s);
}

// 7d) filter sweeps + synthesis models + stabs
{
  const s = defaultState();
  s.comp = 0.5;
  s.instruments.pad.model = "organ"; s.instruments.bass.model = "acid"; s.instruments.melody.model = "pluck";
  s.instruments.drums = Object.assign(s.instruments.drums, { kickModel:"909", snareModel:"clap", hatModel:"metal", dsend:0.3 });
  s.sections = [
    { id:"s1", name:"s1", cycles:1, pads:true, bass:"rolling", drums:"techno", melody:"double", found:{sourceId:null}, sweep:"open", stab:"offbeat" },
    { id:"s2", name:"s2", cycles:1, pads:true, bass:"rolling", drums:"techno", melody:"off", found:{sourceId:null}, sweep:"close" },
  ];
  allOk &= 0<render("sweeps_models_stabs", s);
}

// 8) per-instrument params + swing + humanize
{
  const s = defaultState();
  s.swing = 0.5; s.humanize = 0.6;
  s.instruments = {
    pad:    { wave:"square", cutoff:2200, res:0.3, detune:0.012, attack:0.4, level:0.6, send:0.4 },
    bass:   { wave:"pulse", cutoff:900, res:0.25, level:0.9, send:0.1 },
    melody: { wave:"saw", cutoff:2600, res:0.1, vibrato:0.01, vibRate:6, level:0.5, send:0.5 },
    drums:  { kick:1.4, snare:0.8, hat:1.2, tune:0.85 }
  };
  allOk &= 0<render("instr_groove", s);
}

// 9) new drum kits
for (const d of ["four","boombap","halftime","trap"]) {
  const s = defaultState();
  s.sections = [{ id:"d", name:"d", cycles:2, pads:true, bass:"simple", drums:d, melody:"off", found:{sourceId:null}, fillInto:false }];
  allOk &= 0<render("drum_"+d, s);
}

// 10) styles (delay bus + per-instrument synth params)
for (const key of Object.keys(STYLES)) {
  const st = STYLES[key], s = defaultState();
  s.bpm=st.bpm; s.reverb=st.reverb; s.delay=st.delay; s.progression=st.progression;
  for (const ik of Object.keys(st.instruments)) Object.assign(s.instruments[ik], st.instruments[ik]);
  s.sections = generateSong(Object.assign({ foundIds:["tokyo"] }, st.song));
  allOk &= 0<render("style_"+key, s);
}

console.log(allOk ? "\nALL PASS" : "\nFAILURES");
process.exit(allOk ? 0 : 1);
