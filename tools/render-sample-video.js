#!/usr/bin/env node
// render-sample-video.js — render a full song-with-video MP4, transitions locked
// to the song's actual structure.
//
//   node render-sample-video.js              -> sample.mp4     (vaporwave)
//   node render-sample-video.js synthwave    -> synthwave.mp4  (moody / Kavinsky)
//
// Audio and video derive from the SAME buildEvents() state: faust/press.js
// renders the score, and each video crossfade is timed to END exactly on a
// section downbeat
// (the fade starts FADE seconds before the boundary). Clips play at half speed
// with frame-blend ghosting and get a VHS + deep-fry pass: crushed color,
// sharpening, analog grain, scanlines, vignette, translucent OSD, gradual
// chroma-smear glitches (one spanning every section fade), and a lossy MJPEG
// intermediate encode so the block artifacts are real codec damage.
// Requires: node (faust press), ffmpeg, found/ + found/video/ (run
// ./fetch-found-sound.sh and ./fetch-found-video.sh first).
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const E = require("../engine/csd-engine.js");

const HERE = __dirname;
const SPEED = 0.5;      // clip playback speed (dreamier, more vaporwave)
const W = 640, H = 480, FPS = 30;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
const found = (f) => path.join(HERE, "..", "found", f);

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
  // moody Kavinsky-esque night drive: slow B-minor synthwave, a straight-8ths
  // root pulse that never lifts, four-on-the-floor, huge reverb-washed drums
  // with Collins-style tom fills, pure synthesis up front (found sound is a
  // distant bed), POV night-driving footage, cold grade, letterbox
  synthwave: {
    out: "synthwave.mp4", fade: 2.0, seed: 0x9E1259, noise: 12, bars: 56,
    presetJson: "night-drive-preset.json",
    grade: "hue=s=1.05,eq=contrast=1.35:saturation=1.25:gamma=0.9:brightness=-0.05," +
           "colorbalance=bs=0.18:bm=0.08:rh=0.05,unsharp=5:5:1.2",
    state() {
      const st = E.defaultState();
      st.bpm = 92; st.keyOffset = 2; st.progression = "synthwave";   // i-VI-III-VII in B minor
      st.reverb = 0.88; st.swing = 0; st.humanize = 0.1; st.seed = 77;
      st.delay = { beats: 0.5, feedback: 0.32, cutoff: 2000 };
      st.instruments = E.defaultInstruments();
      Object.assign(st.instruments.pad,    { wave: "saw", cutoff: 1400, res: 0.18, detune: 0.015, attack: 1.8, level: 0.8, send: 0.6, dsend: 0.2 });
      Object.assign(st.instruments.bass,   { wave: "saw", cutoff: 650, res: 0.18, level: 1.2, send: 0.05, dsend: 0 });
      Object.assign(st.instruments.melody, { wave: "saw", cutoff: 3000, res: 0.08, vibrato: 0.003, vibRate: 4.2, level: 0.5, send: 0.5, dsend: 0.3, voices: 7, spread: 0.014 });   // supersaw
      Object.assign(st.instruments.drums,  { kick: 1.35, snare: 1.45, hat: 0.45, tune: 0.9, send: 0.6 });
      st.foundSources = [{
        id: "highway", label: "Night Highway",
        url: "https://archive.org/download/aporee_44512_50607/soundmap201905198.mp3",
        pitch: 0.7, stretch: 0.5, vol: 0.12, cutoff: 1200,   // way back — synthesis carries it
        fsPath: found("highway_night.wav"),
      }];
      // night-drive song, inlined (generateSong is retired — the FORM GRAMMAR
      // is the composer now; this bespoke preset is not a genre anchor, so it
      // carries its own literal section list — value-identical to the old
      // generateSong({foundIds:["highway"],bass:"drive",drums:"four",melody:"sparse"})
      // output, before the night-drive overrides below).
      const F = () => ({ sourceId: "highway", role: "bed" });
      const sec = (id, name, o) => Object.assign({ id, name, cycles: 1, pads: true, bass: "off", drums: "off", melody: "off", found: { sourceId: null, role: "bed" }, fill: "off" }, o);
      st.sections = [
        sec("s1", "intro",      { found: F() }),
        sec("s2", "verse",      { bass: "drive",   found: F() }),
        sec("s3", "pre-chorus", { bass: "root",    drums: "kick", fill: "riser" }),
        sec("s4", "chorus",     { bass: "drive",   drums: "four", melody: "sparse" }),
        sec("s5", "verse 2",    { bass: "walking", drums: "full", found: F() }),
        sec("s6", "bridge",     { bass: "root",    melody: "sparse", found: F(), fill: "drum fill" }),
        sec("s7", "chorus 2",   { bass: "walking", drums: "four", melody: "sparse" }),
        sec("s8", "outro",      { found: F() }),
      ];
      for (const s of st.sections) if (s.bass && s.bass !== "off") s.bass = "drive";  // the pulse never lifts
      const by = n => st.sections.find(s => s.name === n) || {};
      by("verse").drums = "pulse";
      by("pre-chorus").drums = "four";  by("pre-chorus").fill = "tom fill";
      by("chorus").drums = "pulse";     by("chorus").melody = "hero";
      by("verse 2").drums = "pulse";
      by("bridge").drums = "halftime";  by("bridge").fill = "tom fill";
      by("chorus 2").drums = "pulse";   by("chorus 2").melody = "hero";
      return st;
    },
    vibe: [
      [/intro/i, "drive_bluehour"], [/pre/i, "night_lines"],
      [/verse\s*2/i, "drive_taillights"], [/verse/i, "drive_dusk"],
      [/chorus/i, "drive_bridge"],            // both choruses: the Rainbow Bridge
      [/bridge/i, "deep_face"], [/outro/i, "drive_bluehour"],
    ],
  },
  // planetarium dinosaur soundtrack: the dino-synth ritual over Willis O'Brien's
  // 1925 stop-motion dinosaurs (The Lost World, PD). Cold, high-contrast film grade
  // + letterbox + heavy grain so the 100-year-old footage reads as a planetarium reel.
  dinosynth: {
    out: "dinosynth.mp4", fade: 2.2, seed: 0xD1405A, noise: 22, bars: 56,
    grade: "eq=contrast=1.5:saturation=0.55:gamma=0.9:brightness=-0.03," +
           "colorbalance=bs=0.14:bm=0.07:gh=0.03,unsharp=5:5:1.3",
    state() {
      const K = require("../engine/genre-kernel.js");
      const st = K.track("dinosynth", { seed: 7 });
      st.foundSources.forEach(s => { if (s.synthText) return; s.fsPath = s.samplePath ? path.join(HERE, "..", s.samplePath) : found(s.id + ".mp3"); });
      return st;
    },
    vibe: [
      [/dawn/i, "lw_plateau"], [/theme/i, "lw_herd"],
      [/call/i, "lw_graze"], [/answer/i, "lw_valley"],
      [/shred/i, "lw_london"], [/finale/i, "lw_rampage"],
    ],
  },
  // proud Canadiana pop over a mish-mash of 1997 CTV/CBC/Global/ATV TV ads
  // (Nova Scotia). Warm, saturated VHS grade — peak retro-Canadian-television.
  canawave: {
    out: "canawave.mp4", fade: 1.8, seed: 0xCA2ADA, noise: 18, bars: 0,
    grade: "eq=contrast=1.22:saturation=1.55:gamma=0.97,colorbalance=rh=0.04:gm=0.02,unsharp=5:5:1.1",
    state() {
      const K = require("../engine/genre-kernel.js");
      const st = K.track("canawave", { seed: 3 });
      st.foundSources.forEach(s => { if (s.synthText) return; s.fsPath = s.samplePath ? path.join(HERE, "..", s.samplePath) : found(s.id + ".mp3"); });
      return st;
    },
    // ads cut WITH Canadian imagery (Vancouver, Alberta, the Rockies) — alternating
    vibe: [
      [/intro/i, "dc_vancouver"],          // open proud: Vancouver, city + mountains
      [/verse\s*2/i, "ca_canada"],         // ad: "Now available in Canada"
      [/verse/i, "ca_tide"],               // ad: Ultra Tide
      [/chorus\s*2/i, "dc_rockies"],       // imagery: snowy Rockies
      [/chorus/i, "dc_alberta"],           // imagery: the prairies
      [/bridge/i, "dc_skyline"],           // imagery: downtown skyline (avoids news content in the ad reel)
    ],
  },
  // motorik regional-rail vaporwave over NYC-subway + railfan footage (1959-1970, PD /
  // home-movie). Cold, high-contrast transit grade + grain + letterbox so the old rail
  // film reads as a late-night station monitor. Cuts lock to the journey's sections.
  transitwave: {
    out: "transitwave.mp4", fade: 1.6, seed: 0x7A1271, noise: 18, bars: 40,
    grade: "eq=contrast=1.18:saturation=1.15:gamma=0.98:brightness=0.01," +   // brighter/cheerier than the old grade
           "colorbalance=bs=0.04:rh=0.03,unsharp=5:5:1.1",
    // continuous JOURNEYS that transpire: each block is 8 bars of one journey (a real forward
    // ride), slow-crossfading to the next; the order cycles the journeys and each reappearance
    // advances further into its footage (nl1->nl2->nl3, etc.) so every journey progresses.
    journeys: ["tw_jnl1","tw_jch1","tw_jrk1","tw_jny1","tw_jla1","tw_jnl2","tw_jch2","tw_jrk2",
               "tw_jny2","tw_jla2","tw_jnl3","tw_jch3","tw_jrk3"],
    blockBars: 8, journeyFade: 2.6,
    face: "deep_face",   // superimpose a ghostly woman's face over the journey from time to time
    state() {
      const K = require("../engine/genre-kernel.js");
      const st = K.track("transitwave", { seed: 1 });
      prepVocal(st);   // WORLD-sung chorus regenerated to this render's tempo + key
      st.foundSources.forEach(s => { if (s.synthText) return; s.fsPath = s.samplePath ? path.join(HERE, "..", s.samplePath) : found(s.id + ".mp3"); });
      return st;
    },
  },
};

// ---- journey mode: render ANY kernel state (genre-kernel.js journey) ----
// clip affinity per anchor lives in the kernel (K.GENRE_CLIPS) — shared with
// the live explorer's video layer; a blend's video pool is the union of its
// parents' pools, dominant genre first; cuts stay locked to section downbeats.
const GENRE_CLIPS = require("../engine/genre-kernel.js").GENRE_CLIPS;
const GRADES = {   // one grade family per mood; dominant genre picks
  warm:  "hue=s=1.3,eq=contrast=1.3:saturation=1.75:gamma=0.93,unsharp=5:5:1.8",
  cold:  "hue=s=1.05,eq=contrast=1.35:saturation=1.25:gamma=0.9:brightness=-0.05,colorbalance=bs=0.18:bm=0.08:rh=0.05,unsharp=5:5:1.2",
  film:  "eq=contrast=1.5:saturation=0.55:gamma=0.9:brightness=-0.03,colorbalance=bs=0.14:bm=0.07:gh=0.03,unsharp=5:5:1.3",
  vhs:   "eq=contrast=1.22:saturation=1.55:gamma=0.97,colorbalance=rh=0.04:gm=0.02,unsharp=5:5:1.1",
};
const GRADE_OF = { vaporwave:"warm", dancepop:"warm", house:"warm", edm:"warm",
  synthwave:"cold", techno:"cold", dubstep:"cold", jungle:"cold", transitwave:"cold",
  dinosynth:"film", ambient:"film", neoclassical:"film",
  canawave:"vhs", blues:"vhs", lofi:"vhs", triphop:"vhs", jazz:"vhs", downtempo:"vhs" };
// the WORLD-sung chorus must match this render's tempo + key (sing.py) — shared
// by the transitwave preset and any journey state that carries tw_vocal
function prepVocal(st) {
  const vsrc = st.foundSources.find(s => s.id === "tw_vocal");
  if (!vsrc) return;
  try { execFileSync(path.join(HERE, "..", ".venv-sing", "bin", "python"),
    [path.join(HERE, "..", "sing.py"), "--bpm", String(st.bpm), "--transpose", String((st.keyOffset | 0) - 12),
     "--out", path.join(HERE, "..", vsrc.samplePath)], { stdio: ["ignore", "ignore", "inherit"] }); }
  catch (e) { console.error("  (sung chorus skipped — .venv-sing/sing.py unavailable)");
    st.foundSources = st.foundSources.filter(s => s.id !== "tw_vocal");
    st.sections.forEach(s => { if (s.vocal) delete s.vocal; }); }
}
function journeyPreset(stateFile, outFile) {
  const st = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const doms = ((st.genreMeta || {}).genres || ["vaporwave"]).slice(0, 3);
  const pool = [];
  doms.forEach(g => (GENRE_CLIPS[g] || []).forEach(c => { if (!pool.includes(c)) pool.push(c); }));
  if (!pool.length) pool.push(...GENRE_CLIPS.vaporwave);
  // seeded shuffle -> reproducible, but neighbours differ
  let s2 = ((st.seed || 1) * 2654435761) >>> 0;
  const r2 = () => ((s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  return {
    out: outFile, fade: 1.8, seed: s2 || 1, noise: 16,
    bars: (doms[0] === "dinosynth" || doms[0] === "transitwave" || doms[0] === "synthwave") ? 40 : 0,
    grade: GRADES[GRADE_OF[doms[0]] || "warm"],
    bank: doms[0],
    sectionPool: pool,
    state() {
      prepVocal(st);
      st.foundSources.forEach(s => { if (s.synthText) return; s.fsPath = s.samplePath ? path.join(HERE, "..", s.samplePath) : found(s.id + ".mp3"); });
      return st;
    },
  };
}

const presetName = process.argv[2] || "vaporwave";
let P;
if (presetName === "journey") {
  const sf = process.argv[3];
  if (!sf || !fs.existsSync(sf)) { console.error("usage: render-sample-video.js journey <track.state.json> [out.mp4]"); process.exit(1); }
  P = journeyPreset(sf, process.argv[4] || sf.replace(/\.state\.json$/, "") + ".mp4");
} else {
  P = PRESETS[presetName];
  if (!P) { console.error(`✗ unknown preset "${presetName}" (have: ${Object.keys(PRESETS).join(", ")}, journey <state.json>)`); process.exit(1); }
}
const FADE = P.journeys ? (P.journeyFade || 2.5) : P.montage ? (P.montageFade || 0.6) : P.fade;

function die(msg) { console.error("✗ " + msg); process.exit(1); }
const manifestPath = found(path.join("video", "clips.json"));
if (!fs.existsSync(manifestPath)) die("missing found/video/clips.json — run ./fetch-found-video.sh");
const clips = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const have = new Set(clips.map(c => c.file));

// ---- the song: exact section boundaries in seconds ----
const state = P.state();
for (const s of state.foundSources)
  if (!s.synthText && !fs.existsSync(s.fsPath)) die(`missing ${s.fsPath} — run ./fetch-found-sound.sh`);   // synthText: SPEECH organ, no file
if (P.presetJson) {   // keep the loadable builder preset in sync with this render
  const pj = JSON.parse(JSON.stringify(state));
  pj.foundSources.forEach(s => delete s.fsPath);
  fs.writeFileSync(path.join(HERE, "..", P.presetJson), JSON.stringify(pj, null, 2));
  console.log(`wrote ${P.presetJson}`);
}
const prg = (E.PROGRESSIONS[state.progression] || E.PROGRESSIONS.royal_road);
const cycleBeats = prg.chords.length * (state.chordEvery || 8), spb = 60 / state.bpm;
const bounds = [0];
for (const sec of state.sections) bounds.push(bounds[bounds.length - 1] + (sec.cycles || 1) * cycleBeats);
const totalBeats = bounds[bounds.length - 1] + 8;          // engine's +8 beat tail
const total = totalBeats * spb;
let bSec = bounds.map(b => b * spb);                        // section starts (sec)
bSec[bSec.length - 1] = total;                              // last segment absorbs the tail
console.log(`[${presetName}] ${state.sections.length} sections, ${totalBeats} beats @ ${state.bpm}bpm = ${total.toFixed(1)}s`);

// ---- segment -> clip ----
function clipFor(sec, i) {
  for (const [re, name] of (P.vibe || [])) if (re.test(sec.name || "") && have.has(name + ".mp4")) return name + ".mp4";
  if (P.sectionPool) {   // journey mode: genre-affine pool, one clip per section
    const pool = P.sectionPool.filter(c => have.has(c + ".mp4"));
    if (pool.length) return pool[i % pool.length] + ".mp4";
  }
  return clips[i % clips.length].file;
}
let segClips = state.sections.map((s, i) => clipFor(s, i));
if (P.journeys) {
  // 8-bar blocks, each one continuous journey, slow crossfade between them
  const blk = (P.blockBars || 8) * 4, nBlk = Math.max(1, Math.ceil(totalBeats / blk));
  bSec = []; for (let m = 0; m <= nBlk; m++) bSec.push(Math.min(total, m * blk * spb));
  bSec[bSec.length - 1] = total;
  const jp = (P.journeys || []).filter(c => have.has(c + ".mp4")).map(c => c + ".mp4");
  if (!jp.length) die("journeys: no clips found — run ./fetch-found-video.sh");
  segClips = []; for (let m = 0; m < nBlk; m++) segClips.push(jp[m % jp.length]);
  console.log(`[journeys] ${nBlk} blocks of ${P.blockBars} bars, ${jp.length} journeys, ${FADE}s slow fades`);
} else if (P.montage) {
  // fade in a NEW clip every MEASURE (4 beats): boundaries every 4 beats, clips drawn from a
  // shuffled pool so consecutive measures are different cities/lines and each is used before any repeat
  const MB = 4, nMeas = Math.max(1, Math.floor(totalBeats / MB));
  bSec = []; for (let m = 0; m <= nMeas; m++) bSec.push(Math.min(total, m * MB * spb));
  bSec[bSec.length - 1] = total;
  const pool = (P.pool || []).filter(c => have.has(c + ".mp4")).map(c => c + ".mp4");
  if (!pool.length) die("montage: no pool clips found — run ./fetch-found-video.sh");
  const ps = pool.slice(); let s2 = (P.seed ^ 0x5151) >>> 0;
  const r2 = () => ((s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); const t = ps[i]; ps[i] = ps[j]; ps[j] = t; }
  segClips = []; for (let m = 0; m < nMeas; m++) segClips.push(ps[m % ps.length]);
  console.log(`[montage] ${nMeas} measures, ${pool.length}-clip pool, ${FADE}s fades`);
} else {
  state.sections.forEach((s, i) => console.log(`  ${bSec[i].toFixed(2).padStart(7)}s  ${(s.name || "?").padEnd(12)} ${segClips[i]}`));
}

// ---- audio: faust press of the same state ----
const wav = path.join(os.tmpdir(), `sample-audio-${presetName}.wav`);
const stateJson = path.join(os.tmpdir(), `sample-audio-${presetName}.state.json`);
fs.writeFileSync(stateJson, JSON.stringify(state));
console.log("rendering audio (faust press)…");
execFileSync("node", [path.join(HERE, "..", "engine", "faust", "press.js"), stateJson, wav],
  { stdio: ["ignore", "ignore", "inherit"] });
if (!fs.existsSync(wav) || fs.statSync(wav).size < 100000) die("faust press render failed");

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
for (let i = 1; i < segClips.length; i++) {              // one smear spans each fade,
  if (P.montage && i % 4 !== 0) continue;               // (montage: every 4th measure, not wall-to-wall)
  smear(bSec[i] - FADE, FADE + 0.5, 26 + rnd() * 22, rnd() < 0.5 ? -1 : 1);  // peaking near the downbeat
}
for (let t = 4 + rnd() * 4; t < total - 4; t += 3.5 + rnd() * 5)
  smear(t, 0.7 + rnd() * 0.9, 16 + rnd() * 22, rnd() < 0.5 ? -1 : 1);        // slow tape damage
const cmdPath = path.join(os.tmpdir(), `glitch-${presetName}.cmd`);
fs.writeFileSync(cmdPath, cmd.join("\n") + "\n");
console.log(`glitch schedule: ${nSmears} smears (${cmd.length} ramp steps)`);

// ---- MTV-style song credits: an opening lower-third "now-playing" bug + an
// end card, drawn on every render (the old MTV chyron). A genre-flavored band
// name + song title are rolled FRESH every render (non-seeded), so each render
// "plays" a different made-up group. A preset may pin its own via title/artist. ----
// band/title banks live in namebank.js (shared with the STELLATE chyron)
const { NAMEBANK, GENERIC } = require("../engine/namebank.js");
function rollIdentity() {   // non-seeded: a different group/title every render
  const bank = NAMEBANK[P.bank || presetName] || GENERIC;
  const r = a => a[Math.floor(Math.random() * a.length)];
  return { artist: P.artist || r(bank.bands), title: (P.title || r(bank.titles)).toUpperCase() };
}
const LABEL = "ROYAL ROAD", HOME = "aboardresearch.com";
const YEAR = new Date().getFullYear();
// trapezoidal alpha 0->1->0 over [t0,t1] with ramp f; commas are protected by the
// single quotes drawtext wraps the value in, so they're left literal here.
const trap = (t0, t1, f = 0.6) =>
  `if(lt(t,${t0}),0,if(lt(t,${(t0 + f).toFixed(2)}),(t-${t0})/${f},` +
  `if(lt(t,${(t1 - f).toFixed(2)}),1,if(lt(t,${t1}),(${t1}-t)/${f},0))))`;
const dtxt = (text, o) =>
  `drawtext=fontfile=${FONT}:text='${text}':x=${o.x}:y=${o.y}:fontsize=${o.size}` +
  `:fontcolor=${o.color || "white"}:shadowx=2:shadowy=2:shadowcolor=black@0.6` +
  (o.alpha ? `:alpha='${o.alpha}'` : "");
function buildCredits() {
  if (!fs.existsSync(FONT)) return "";
  const { artist, title } = rollIdentity();
  console.log(`now playing: ${artist} — "${title}"`);
  const bpm = Math.round(state.bpm), prog = (state.progression || "").replace(/_/g, " ");
  // opening bug: lower-left, ~2.6s .. 12.4s, with a white accent bar
  const oa = trap(2.6, 12.4), bx = 46, by = H - 170;
  const open = [
    `drawbox=x=${bx - 16}:y=${by - 4}:w=5:h=130:color=white@0.8:t=fill:enable='between(t,2.6,12.4)'`,
    dtxt(title, { x: bx, y: by, size: 30, alpha: oa }),
    dtxt(artist, { x: bx, y: by + 40, size: 22, alpha: oa }),
    dtxt(`${LABEL}   ${YEAR}`, { x: bx, y: by + 74, size: 16, color: "white@0.9", alpha: oa }),
    dtxt(HOME, { x: bx, y: by + 98, size: 14, color: "white@0.8", alpha: oa }),
  ];
  // end card: centered, last ~10.5s, fading out with the outro
  const e0 = +(total - 11.5).toFixed(2), e1 = +(total - 2.9).toFixed(2);
  const ea = trap(e0, e1, 0.8), cx = "(w-text_w)/2", ey = Math.round(H / 2 - 78);
  const end = [
    dtxt(artist, { x: cx, y: ey, size: 34, alpha: ea }),
    dtxt(`"${title}"`, { x: cx, y: ey + 46, size: 20, color: "white@0.9", alpha: ea }),
    dtxt("a ROYAL ROAD generative production", { x: cx, y: ey + 98, size: 15, color: "white@0.85", alpha: ea }),
    dtxt(`faust    ${bpm} BPM    ${prog}`, { x: cx, y: ey + 122, size: 14, color: "white@0.7", alpha: ea }),
    dtxt(HOME, { x: cx, y: ey + 150, size: 14, color: "white@0.7", alpha: ea }),
  ];
  return "," + open.concat(end).join(",");
}
const credits = buildCredits();

// ---- video: one input per segment, xfade chain on exact boundaries ----
// xfade math: len(seg0)=b1; len(seg_i)=b_{i+1}-b_i+FADE; offset_i=b_i-FADE
// => every fade completes exactly as its segment's downbeat hits (a measure, in montage mode).
const n = segClips.length;
const args = ["-y", "-v", "error"];
for (let i = 0; i < n; i++) args.push("-i", found(path.join("video", segClips[i])));
args.push("-loop", "1", "-i", scan);
// superimposed face layer (a ghostly woman's face that fades in over the journey from time to time)
const faceOn = P.face && have.has(P.face + ".mp4");
if (faceOn) args.push("-stream_loop", "-1", "-i", found(path.join("video", P.face + ".mp4")));
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
// the face: luma-key out its dark background (so only the face glows over the train), then gate
// it in/out at a handful of moments ("from time to time"), capped translucent
let faceTap = "scn";
if (faceOn) {
  // gate the face ON during a handful of windows ("from time to time") via overlay's enable
  // timeline (chained fades don't compose — each fade-in zeroes everything before it)
  const wins = [];
  for (let t = 20; t < total - 14; t += 36) wins.push(`between(t,${t.toFixed(1)},${(t + 8).toFixed(1)})`);
  F.push(`[${n + 1}:v]setpts=PTS/${SPEED},fps=${FPS},scale=${W}:${H},setsar=1,format=gray,eq=contrast=1.5:brightness=0.06,` +
         `format=rgba,lumakey=threshold=0.12:tolerance=0.30,colorchannelmixer=aa=0.72[face]`);
  F.push(`[scn][face]overlay=shortest=0:enable='${wins.join("+")}'[scnf]`);
  faceTap = "scnf";
}
F.push(`[${faceTap}]format=yuv420p${bars}${osd}${credits},fade=t=in:st=0:d=1.2,fade=t=out:st=${(total - 2.8).toFixed(2)}:d=2.8,` +
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
  "-t", total.toFixed(3), path.resolve(HERE, P.out)],   // resolve: journey mode passes absolute out paths
  { stdio: ["ignore", "inherit", "inherit"] });
console.log(`✓ ${P.out} (${total.toFixed(1)}s, fades land on section downbeats, deep fried)`);
