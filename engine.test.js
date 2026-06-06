// engine.test.js — render-verify the CSD generator against the real csound binary.
//   node engine.test.js
// Requires: csound on PATH, and found/tokyo_station.wav (./fetch-found-sound.sh).
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildCsd, defaultState, PROGRESSIONS } = require("./csd-engine.js");

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
  const out = (r.stdout || "") + (r.stderr || "");   // csound logs to stderr
  const errs = (out.match(/error:/gi) || []).length;
  const oor = /samples out of range:\s+(\d+)/.exec(out);
  const ok = /end of score/.test(out) && errs === 0;
  const sz = fs.existsSync(outWav) ? fs.statSync(outWav).size : 0;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} errors=${errs} clipped=${oor?oor[1]:"?"} wav=${(sz/1024|0)}KB`);
  return ok && sz > 1000;
}

let allOk = true;

// 1) the default committed song
allOk &= render("default_song", defaultState());

// 2) every progression preset (default sections, swapped progression)
for (const prog of Object.keys(PROGRESSIONS)) {
  const s = defaultState();
  s.progression = prog;
  allOk &= render("prog_" + prog, s);
}

// 3) key transposition
{
  const s = defaultState(); s.keyOffset = 3; allOk &= render("key_+3", s);
  const t = defaultState(); t.keyOffset = -5; allOk &= render("key_-5", t);
}

// 4) generative melodies + custom layering
for (const mel of ["arpup","arpdown","wander"]) {
  const s = defaultState();
  s.sections = [
    { id:"x", name:"test", type:"chords", cycles:2, pads:true, bass:"walking", drums:"open", melody:mel, found:{sourceId:"tokyo",role:"bed"}, fillInto:true }
  ];
  allOk &= render("mel_" + mel, s);
}

// 5) two found sources, multiple tables
{
  const s = defaultState();
  s.foundSources.push({ id:"tokyo2", label:"dup", url:"x", pitch:0.6, stretch:0.6 });
  s.sections[5].found = { sourceId:"tokyo2", role:"solo" };
  allOk &= render("two_sources", s);
}

console.log(allOk ? "\nALL PASS" : "\nFAILURES");
process.exit(allOk ? 0 : 1);
