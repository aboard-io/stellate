#!/usr/bin/env node
// render-sample-video.js — render sample.mp4: the engine's default song with the
// found-video layer baked in, transitions locked to the song's actual structure.
//
//   node render-sample-video.js            -> sample.mp4
//
// Audio and video derive from the SAME buildEvents() state: csound renders the
// score, and each video crossfade is timed to END exactly on a section downbeat
// (the fade starts FADE seconds before the boundary). Clips play at half speed
// with frame-blend ghosting and get a VHS + deep-fry pass: crushed oversaturated
// color, crunchy sharpening, analog grain, scanlines, vignette, OSD, scheduled
// glitch bursts (chroma tears, clustered on section transitions), and a lossy
// MJPEG intermediate encode so the block artifacts are real codec damage.
// Requires: csound, ffmpeg, found/tokyo_station.wav, found/video/ (run
// ./fetch-found-sound.sh and ./fetch-found-video.sh first).
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const E = require("./csd-engine.js");

const HERE = __dirname;
const FADE = 1.6;       // crossfade seconds; ends on the downbeat
const SPEED = 0.5;      // clip playback speed (dreamier, more vaporwave)
const W = 640, H = 480, FPS = 30;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";

// section name -> clip; order matters ("pre-chorus" must hit before "chorus")
const VIBE = [
  [/intro/i, "disc_sunset"], [/pre/i, "sun_riders"],
  [/verse\s*2/i, "sharpest_city"], [/verse/i, "bamboo"],
  [/chorus\s*2/i, "rainbow_rings"], [/chorus/i, "kaleido"],
  [/bridge/i, "earth_orbit"], [/outro/i, "spacewalk"],
];

function die(msg) { console.error("✗ " + msg); process.exit(1); }
const tokyo = path.join(HERE, "found", "tokyo_station.wav");
if (!fs.existsSync(tokyo)) die("missing found/tokyo_station.wav — run ./fetch-found-sound.sh");
const manifestPath = path.join(HERE, "found", "video", "clips.json");
if (!fs.existsSync(manifestPath)) die("missing found/video/clips.json — run ./fetch-found-video.sh");
const clips = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const have = new Set(clips.map(c => c.file));

// ---- the song: exact section boundaries in seconds ----
const state = E.defaultState();
state.foundSources.forEach(s => { s.fsPath = tokyo; });
const prg = (E.PROGRESSIONS[state.progression] || E.PROGRESSIONS.royal_road);
const cycleBeats = prg.chords.length * 8, spb = 60 / state.bpm;
const bounds = [0];
for (const sec of state.sections) bounds.push(bounds[bounds.length - 1] + (sec.cycles || 1) * cycleBeats);
const totalBeats = bounds[bounds.length - 1] + 8;          // engine's +8 beat tail
const total = totalBeats * spb;
const bSec = bounds.map(b => b * spb);                      // section starts (sec)
bSec[bSec.length - 1] = total;                              // last segment absorbs the tail
console.log(`song: ${state.sections.length} sections, ${totalBeats} beats @ ${state.bpm}bpm = ${total.toFixed(1)}s`);

// ---- section -> clip ----
function clipFor(sec, i) {
  for (const [re, name] of VIBE) if (re.test(sec.name || "") && have.has(name + ".mp4")) return name + ".mp4";
  return clips[i % clips.length].file;
}
const segClips = state.sections.map((s, i) => clipFor(s, i));
state.sections.forEach((s, i) => console.log(`  ${bSec[i].toFixed(2).padStart(7)}s  ${(s.name || "?").padEnd(12)} ${segClips[i]}`));

// ---- audio: csound render of the same state ----
const wav = path.join(os.tmpdir(), "sample-audio.wav");
const csd = E.buildCsd(state).replace("<CsoundSynthesizer>",
  `<CsoundSynthesizer>\n<CsOptions>\n--nosound -o ${wav} -W\n</CsOptions>`);
const csdPath = path.join(os.tmpdir(), "sample-audio.csd");
fs.writeFileSync(csdPath, csd);
console.log("rendering audio (csound)…");
execFileSync("csound", [csdPath], { stdio: ["ignore", "ignore", "ignore"] });
if (!fs.existsSync(wav) || fs.statSync(wav).size < 100000) die("csound render failed");

// ---- scanline overlay (generated once, tiled by -loop) ----
const scan = path.join(os.tmpdir(), "scanlines.png");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi",
  "-i", `color=black:s=${W}x${H},format=rgba`, "-frames:v", "1",
  "-vf", "geq=r=0:g=0:b=0:a='if(mod(Y\\,3),0,64)'", scan]);

// ---- glitch schedule: chroma-tear bursts via sendcmd ----
// deterministic PRNG so re-renders are identical
let _s = 0xC0FFEE;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296);
const bursts = [];
for (let i = 1; i < state.sections.length; i++) {       // every transition glitches:
  bursts.push({ t: bSec[i] - FADE, d: 0.30 });           // once as the fade starts
  bursts.push({ t: bSec[i], d: 0.18 });                  // once on the downbeat
}
for (let t = 4 + rnd() * 4; t < total - 4; t += 3.5 + rnd() * 5)
  bursts.push({ t, d: 0.12 + rnd() * 0.3 });             // plus random tape damage
const cmd = [];
for (const b of bursts.sort((a, c) => a.t - c.t)) {
  const m = 18 + Math.floor(rnd() * 30), sg = rnd() < 0.5 ? -1 : 1;
  cmd.push(`${b.t.toFixed(2)} chromashift@g cbh ${sg * m};`);
  cmd.push(`${b.t.toFixed(2)} chromashift@g crh ${-sg * (m - 6)};`);
  cmd.push(`${(b.t + b.d).toFixed(2)} chromashift@g cbh -5;`);
  cmd.push(`${(b.t + b.d).toFixed(2)} chromashift@g crh 5;`);
}
const cmdPath = path.join(os.tmpdir(), "glitch.cmd");
fs.writeFileSync(cmdPath, cmd.join("\n") + "\n");
console.log(`glitch schedule: ${bursts.length} bursts`);

// ---- video: one input per section, xfade chain on exact boundaries ----
// xfade math: len(seg0)=b1; len(seg_i)=b_{i+1}-b_i+FADE; offset_i=b_i-FADE
// => every fade completes exactly as its section's downbeat hits.
const n = state.sections.length;
const args = ["-y", "-v", "error"];
for (let i = 0; i < n; i++) args.push("-i", path.join(HERE, "found", "video", segClips[i]));
args.push("-loop", "1", "-i", scan, "-i", wav);
const F = [];
for (let i = 0; i < n; i++) {
  const L = (i === 0 ? bSec[1] : bSec[i + 1] - bSec[i] + FADE);
  // tblend after the slowdown: duplicated frames average with their neighbours
  // -> motion ghosting, half lazy-frame-rate dreaminess, half worn-tape look
  F.push(`[${i}:v]setpts=PTS/${SPEED},fps=${FPS},tblend=all_mode=average,` +
         `trim=duration=${L.toFixed(3)},setpts=PTS-STARTPTS,scale=${W}:${H},setsar=1[v${i}]`);
}
let acc = "v0";
for (let i = 1; i < n; i++) {
  const off = (bSec[i] - FADE).toFixed(3);
  F.push(`[${acc}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${off}[x${i}]`);
  acc = "x" + i;
}
const osd = fs.existsSync(FONT)
  ? `,drawtext=fontfile=${FONT}:text='▶ PLAY':x=28:y=24:fontsize=24:fontcolor=white@0.85:shadowx=2:shadowy=2:shadowcolor=black@0.6` +
    `,drawtext=fontfile=${FONT}:text='SP %{pts\\:hms}':x=w-tw-28:y=24:fontsize=20:fontcolor=white@0.75:shadowx=2:shadowy=2:shadowcolor=black@0.6`
  : "";
// deep fry: crush + oversaturate + oversharpen + heavy grain; sendcmd drives
// the chromashift@g bursts from the glitch schedule above
F.push(`[${acc}]sendcmd=f='${cmdPath.replace(/\\/g, "/")}',hue=s=1.3,` +
       `eq=contrast=1.3:saturation=1.75:gamma=0.93,unsharp=5:5:1.8,` +
       `chromashift@g=cbh=-5:crh=5,noise=alls=16:allf=t+u,vignette=PI/4.6[vhs]`);
F.push(`[vhs][${n}:v]overlay=shortest=0:eof_action=repeat[scn]`);
F.push(`[scn]format=yuv420p${osd},fade=t=in:st=0:d=1.2,fade=t=out:st=${(total - 2.8).toFixed(2)}:d=2.8,` +
       `scale=512:384[vout]`);   // fry at lower res; pass 2 scales back up
args.push("-filter_complex", F.join(";\n"),
  "-map", "[vout]", "-c:v", "mjpeg", "-q:v", "15", "-an",
  "-t", total.toFixed(3), path.join(os.tmpdir(), "fried.avi"));
console.log("rendering video pass 1 (fry)…");
execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });

// pass 2: the lossy intermediate IS the fry — re-encode it (blocks and all)
console.log("rendering video pass 2 (mux)…");
execFileSync("ffmpeg", ["-y", "-v", "error",
  "-i", path.join(os.tmpdir(), "fried.avi"), "-i", wav,
  "-filter_complex",
  `[0:v]scale=${W}:${H}:flags=bilinear,setsar=1[v];` +
  `[1:a]afade=t=out:st=${(total - 2.8).toFixed(2)}:d=2.8[a]`,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-crf", "23", "-preset", "medium",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
  "-t", total.toFixed(3), path.join(HERE, "sample.mp4")],
  { stdio: ["ignore", "inherit", "inherit"] });
console.log(`✓ sample.mp4 (${total.toFixed(1)}s, fades land on section downbeats, deep fried)`);
