#!/usr/bin/env node
// render-sample-video.js — render a full song-with-video MP4, transitions locked
// to the song's actual structure.
//
//   node render-sample-video.js              -> sample.mp4     (vaporwave)
//   node render-sample-video.js synthwave    -> synthwave.mp4  (moody / Kavinsky)
//
// Audio and video derive from the SAME buildEvents() state: csound renders the
// score, and each video crossfade is timed to END exactly on a section downbeat
// (the fade starts FADE seconds before the boundary). Clips play at half speed
// with frame-blend ghosting and get a VHS + deep-fry pass: crushed color,
// sharpening, analog grain, scanlines, vignette, translucent OSD, gradual
// chroma-smear glitches (one spanning every section fade), and a lossy MJPEG
// intermediate encode so the block artifacts are real codec damage.
// Requires: csound, ffmpeg, found/ + found/video/ (run ./fetch-found-sound.sh
// and ./fetch-found-video.sh first).
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const E = require("./csd-engine.js");

const HERE = __dirname;
const SPEED = 0.5;      // clip playback speed (dreamier, more vaporwave)
const W = 640, H = 480, FPS = 30;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
const found = (f) => path.join(HERE, "found", f);

const PRESETS = {
  // the committed default song — sunny degraded-mall vaporwave
  vaporwave: {
    out: "sample.mp4", fade: 1.6, seed: 0xC0FFEE, noise: 16, bars: 0,
    grade: "hue=s=1.3,eq=contrast=1.3:saturation=1.75:gamma=0.93,unsharp=5:5:1.8",
    state() {
      const st = E.defaultState();
      st.foundSources.forEach(s => { s.fsPath = found("tokyo_station.wav"); });
      return st;
    },
    // section name -> clip; order matters ("pre-chorus" must hit before "chorus")
    vibe: [
      [/intro/i, "disc_sunset"], [/pre/i, "sun_riders"],
      [/verse\s*2/i, "sharpest_city"], [/verse/i, "bamboo"],
      [/chorus\s*2/i, "rainbow_rings"], [/chorus/i, "kaleido"],
      [/bridge/i, "earth_orbit"], [/outro/i, "spacewalk"],
    ],
  },
  // moody Kavinsky-esque night drive: slow B-minor synthwave, octave-pulse
  // bass, night-highway field recording, dark footage, cold grade, letterbox
  synthwave: {
    out: "synthwave.mp4", fade: 2.0, seed: 0x9E1259, noise: 12, bars: 56,
    grade: "hue=s=1.05,eq=contrast=1.35:saturation=1.25:gamma=0.9:brightness=-0.05," +
           "colorbalance=bs=0.18:bm=0.08:rh=0.05,unsharp=5:5:1.2",
    state() {
      const st = E.defaultState();
      st.bpm = 92; st.keyOffset = 2; st.progression = "synthwave";   // i-VI-III-VII in B minor
      st.reverb = 0.8; st.swing = 0; st.humanize = 0.15; st.seed = 77;
      st.delay = { beats: 0.5, feedback: 0.38, cutoff: 1800 };
      st.instruments = E.defaultInstruments();
      Object.assign(st.instruments.pad,    { wave: "saw", cutoff: 1000, res: 0.18, detune: 0.012, attack: 2.2, level: 0.75, send: 0.6, dsend: 0.2 });
      Object.assign(st.instruments.bass,   { wave: "saw", cutoff: 520, res: 0.22, level: 1.15, send: 0.05, dsend: 0 });
      Object.assign(st.instruments.melody, { wave: "square", cutoff: 2000, res: 0.12, vibrato: 0.004, vibRate: 4.5, level: 0.5, send: 0.55, dsend: 0.35 });
      Object.assign(st.instruments.drums,  { kick: 1.25, snare: 1.15, hat: 0.7, tune: 0.85 });
      st.foundSources = [{
        id: "highway", label: "Night Highway",
        url: "https://archive.org/download/aporee_44512_50607/soundmap201905198.mp3",
        pitch: 0.7, stretch: 0.5, vol: 0.26, cutoff: 1800,
        fsPath: found("highway_night.wav"),
      }];
      st.sections = E.generateSong({ foundIds: ["highway"], bass: "octaves", drums: "halftime", melody: "sparse" });
      for (const s of st.sections) if (s.bass && s.bass !== "off") s.bass = "octaves";  // the pulse never changes gear
      const by = n => st.sections.find(s => s.name === n) || {};
      by("pre-chorus").drums = "kick";
      by("chorus").drums = "four";    by("chorus").melody = "updown";
      by("verse 2").drums = "halftime";
      by("chorus 2").drums = "four";  by("chorus 2").melody = "updown";
      return st;
    },
    vibe: [
      [/intro/i, "night_lines"], [/pre/i, "dark_face"],
      [/verse\s*2/i, "blue_dinner"], [/verse/i, "tv_room"],
      [/chorus/i, "night_lights"],            // both choruses share the visual hook
      [/bridge/i, "deep_face"], [/outro/i, "green_nebula"],
    ],
  },
};

const presetName = process.argv[2] || "vaporwave";
const P = PRESETS[presetName];
if (!P) { console.error(`✗ unknown preset "${presetName}" (have: ${Object.keys(PRESETS).join(", ")})`); process.exit(1); }
const FADE = P.fade;

function die(msg) { console.error("✗ " + msg); process.exit(1); }
const manifestPath = found(path.join("video", "clips.json"));
if (!fs.existsSync(manifestPath)) die("missing found/video/clips.json — run ./fetch-found-video.sh");
const clips = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const have = new Set(clips.map(c => c.file));

// ---- the song: exact section boundaries in seconds ----
const state = P.state();
for (const s of state.foundSources)
  if (!fs.existsSync(s.fsPath)) die(`missing ${s.fsPath} — run ./fetch-found-sound.sh`);
const prg = (E.PROGRESSIONS[state.progression] || E.PROGRESSIONS.royal_road);
const cycleBeats = prg.chords.length * 8, spb = 60 / state.bpm;
const bounds = [0];
for (const sec of state.sections) bounds.push(bounds[bounds.length - 1] + (sec.cycles || 1) * cycleBeats);
const totalBeats = bounds[bounds.length - 1] + 8;          // engine's +8 beat tail
const total = totalBeats * spb;
const bSec = bounds.map(b => b * spb);                      // section starts (sec)
bSec[bSec.length - 1] = total;                              // last segment absorbs the tail
console.log(`[${presetName}] ${state.sections.length} sections, ${totalBeats} beats @ ${state.bpm}bpm = ${total.toFixed(1)}s`);

// ---- section -> clip ----
function clipFor(sec, i) {
  for (const [re, name] of P.vibe) if (re.test(sec.name || "") && have.has(name + ".mp4")) return name + ".mp4";
  return clips[i % clips.length].file;
}
const segClips = state.sections.map((s, i) => clipFor(s, i));
state.sections.forEach((s, i) => console.log(`  ${bSec[i].toFixed(2).padStart(7)}s  ${(s.name || "?").padEnd(12)} ${segClips[i]}`));

// ---- audio: csound render of the same state ----
const wav = path.join(os.tmpdir(), `sample-audio-${presetName}.wav`);
const csd = E.buildCsd(state).replace("<CsoundSynthesizer>",
  `<CsoundSynthesizer>\n<CsOptions>\n--nosound -o ${wav} -W\n</CsOptions>`);
const csdPath = path.join(os.tmpdir(), `sample-audio-${presetName}.csd`);
fs.writeFileSync(csdPath, csd);
console.log("rendering audio (csound)…");
execFileSync("csound", [csdPath], { stdio: ["ignore", "ignore", "ignore"] });
if (!fs.existsSync(wav) || fs.statSync(wav).size < 100000) die("csound render failed");

// ---- scanline overlay (generated once, tiled by -loop) ----
const scan = path.join(os.tmpdir(), "scanlines.png");
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi",
  "-i", `color=black:s=${W}x${H},format=rgba`, "-frames:v", "1",
  "-vf", "geq=r=0:g=0:b=0:a='if(mod(Y\\,3),0,64)'", scan]);

// ---- glitch schedule: gradual chroma smears via stepped sendcmd ramps ----
// deterministic PRNG so re-renders are identical
let _s = P.seed;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) >>> 0) / 4294967296);
const cmd = [];
let nSmears = 0;
// each smear glides the chroma planes apart and back on a sine envelope,
// stepped every 80ms — a slow tear, not a snap
function smear(t0, d, m, sg) {
  const steps = Math.max(4, Math.round(d / 0.08));
  for (let k = 0; k <= steps; k++) {
    const env = Math.sin(Math.PI * k / steps);
    const tt = Math.max(0.1, t0 + d * k / steps).toFixed(2);
    cmd.push(`${tt} chromashift@g cbh ${Math.round(-5 + sg * m * env)};`);
    cmd.push(`${tt} chromashift@g crh ${Math.round(5 - sg * (m - 6) * env)};`);
  }
  nSmears++;
}
for (let i = 1; i < state.sections.length; i++)          // one smear spans each fade,
  smear(bSec[i] - FADE, FADE + 0.5, 26 + rnd() * 22, rnd() < 0.5 ? -1 : 1);  // peaking near the downbeat
for (let t = 4 + rnd() * 4; t < total - 4; t += 3.5 + rnd() * 5)
  smear(t, 0.7 + rnd() * 0.9, 16 + rnd() * 22, rnd() < 0.5 ? -1 : 1);        // slow tape damage
const cmdPath = path.join(os.tmpdir(), `glitch-${presetName}.cmd`);
fs.writeFileSync(cmdPath, cmd.join("\n") + "\n");
console.log(`glitch schedule: ${nSmears} smears (${cmd.length} ramp steps)`);

// ---- video: one input per section, xfade chain on exact boundaries ----
// xfade math: len(seg0)=b1; len(seg_i)=b_{i+1}-b_i+FADE; offset_i=b_i-FADE
// => every fade completes exactly as its section's downbeat hits.
const n = state.sections.length;
const args = ["-y", "-v", "error"];
for (let i = 0; i < n; i++) args.push("-i", found(path.join("video", segClips[i])));
args.push("-loop", "1", "-i", scan);
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
  ? `,drawtext=fontfile=${FONT}:text='▶ PLAY':x=28:y=24:fontsize=24:fontcolor=white@0.45:shadowx=2:shadowy=2:shadowcolor=black@0.3` +
    `,drawtext=fontfile=${FONT}:text='SP %{pts\\:hms}':x=w-tw-28:y=24:fontsize=20:fontcolor=white@0.4:shadowx=2:shadowy=2:shadowcolor=black@0.3`
  : "";
const bars = P.bars
  ? `,drawbox=y=0:h=${P.bars}:c=black:t=fill,drawbox=y=ih-${P.bars}:h=${P.bars}:c=black:t=fill`
  : "";
// deep fry: crush + saturate + sharpen per preset grade; sendcmd drives the
// chromashift@g smears from the schedule above
F.push(`[${acc}]sendcmd=f='${cmdPath.replace(/\\/g, "/")}',${P.grade},` +
       `chromashift@g=cbh=-5:crh=5,noise=alls=${P.noise}:allf=t+u,vignette=PI/4.6[vhs]`);
F.push(`[vhs][${n}:v]overlay=shortest=0:eof_action=repeat[scn]`);
F.push(`[scn]format=yuv420p${bars}${osd},fade=t=in:st=0:d=1.2,fade=t=out:st=${(total - 2.8).toFixed(2)}:d=2.8,` +
       `scale=512:384[vout]`);   // fry at lower res; pass 2 scales back up
const fried = path.join(os.tmpdir(), `fried-${presetName}.avi`);
args.push("-filter_complex", F.join(";\n"),
  "-map", "[vout]", "-c:v", "mjpeg", "-q:v", "15", "-an",
  "-t", total.toFixed(3), fried);
console.log("rendering video pass 1 (fry)…");
execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });

// pass 2: the lossy intermediate IS the fry — re-encode it (blocks and all)
console.log("rendering video pass 2 (mux)…");
execFileSync("ffmpeg", ["-y", "-v", "error",
  "-i", fried, "-i", wav,
  "-filter_complex",
  `[0:v]scale=${W}:${H}:flags=bilinear,setsar=1[v];` +
  `[1:a]afade=t=out:st=${(total - 2.8).toFixed(2)}:d=2.8[a]`,
  "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-crf", "23", "-preset", "medium",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
  "-t", total.toFixed(3), path.join(HERE, P.out)],
  { stdio: ["ignore", "inherit", "inherit"] });
console.log(`✓ ${P.out} (${total.toFixed(1)}s, fades land on section downbeats, deep fried)`);
