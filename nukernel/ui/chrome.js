// ui/chrome.js — the top bar: transport button, tempo and volume (views over
// state, never the other way round), the font select, the composer, the
// preset list, save/load/reset. The wiring that used to sit loose at the
// bottom of kernel-daw.js, each entry point now one adoptSong() call instead
// of a hand-copied eleven-statement epilogue.
//
// Layer graph: ui view — imports state/audio; the play button is the page's
// user gesture, which is why initAudio rides transport.startAt.
import { GENRES, FONTS, compose, PRESETS } from "./deps.js";
import { bpm, vol, setBpm, setVol, setLoopOnly, adoptSong, defaultSong,
         clearStore, loadErrorText, saveFile, loadFile, commit, on } from "./state.js";
import { playing, startAt, stop, ensureAssets } from "../audio/transport.js";
import { initAudio } from "../audio/graph.js";
import { setFont, fontDef, FONT } from "../audio/assets.js";
import { status } from "./readout.js";
import { resetScroll } from "./arrange.js";

const $ = id => document.getElementById(id);

/* ---------- transport ---------- */
$("play").addEventListener("click",
  () => playing ? stop() : (setLoopOnly(null), startAt(0)));
on("transport:state", d => { $("play").textContent = d.playing ? "■ Stop" : "▶ Play"; });

/* ---------- tempo and volume ---------- */
// the range inputs are VIEWS: they set state and repaint their readouts; the
// audio tier reads state (graph follows "transport" for the volume)
$("bpm").addEventListener("input", e => {
  setBpm(e.target.value);
  $("bpmv").textContent = e.target.value;
  commit("transport");
});
$("vol").addEventListener("input", e => {
  setVol(e.target.value);
  $("volv").textContent = e.target.value;
  commit("transport");
});
function syncKnobs() {
  $("bpm").value = bpm; $("bpmv").textContent = String(bpm);
  $("vol").value = vol; $("volv").textContent = String(vol);
}
on("song", syncKnobs);

/* ---------- fonts ---------- */
{
  const sel = $("font");
  for (const f of FONTS) {
    const o = document.createElement("option");
    o.value = f.key; o.textContent = f.label + (f.kind === "synth" ? "  (synth)" : "");
    sel.append(o);
  }
  sel.value = FONT;
  sel.addEventListener("change", async e => {
    setFont(e.target.value);
    initAudio();                       // a select change is a user gesture
    status("loading " + fontDef().label + "…");
    await ensureAssets(false);
    commit("box");                     // the sound changed: re-render, recompile
  });
}

/* ---------- the composer ---------- */
// ONE BUTTON. It writes eight phrases and an arrangement of them — nine boxes
// with roles, its own tempo, its own groove, its own mix — and hands the result
// to adoptSong, the SAME validate-and-apply path a file off the desktop takes.
// If the composer ever emitted a song the loader would refuse, the loader
// refuses it and says so, rather than there being a second, more trusted way in.
{
  const sel = $("composeg");
  sel.append(Object.assign(document.createElement("option"),
    { value: "", textContent: "surprise me" }));
  for (const k of Object.keys(GENRES))
    sel.append(Object.assign(document.createElement("option"),
      { value: k, textContent: GENRES[k].label }));
  $("compose").addEventListener("click", () => {
    const keys = Object.keys(GENRES);
    const gk = sel.value || keys[Math.floor(Math.random() * keys.length)];
    // the seed is not exposed as a control, but it IS a real seed: the same
    // number is the same song, which is what makes the composer testable
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const song = compose(gk, seed);
    if (!adoptSong(song, "composer")) {
      status("the composer produced a song the loader rejected — that is a bug, not a taste", true);
      return;
    }
    status(GENRES[gk].label + " · seed " + seed + " · " +
      song.song.map(b => b.role).join(" → ") + "  —  press play", true);
  });
}

/* ---------- preset songs ---------- */
{
  const sel = $("preset");
  for (const p2 of PRESETS) {
    const o = document.createElement("option");
    o.value = p2.name; o.textContent = p2.name; sel.append(o);
  }
  sel.addEventListener("change", e => {
    const p2 = PRESETS.find(x => x.name === e.target.value);
    e.target.selectedIndex = 0;
    if (!p2) return;
    if (!adoptSong(JSON.parse(JSON.stringify(p2.data)), "preset"))
      status("that preset failed to load" + loadErrorText(), true);
  });
}

/* ---------- desktop + reset ---------- */
$("savefile").addEventListener("click", saveFile);
$("loadfile").addEventListener("click", () => $("loadinput").click());
$("loadinput").addEventListener("change", e => {
  if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
  e.target.value = "";                       // so the same file can be picked twice
});
$("reset").addEventListener("click", () => {
  clearStore();
  adoptSong(defaultSong(), "reset");   // stop + dropChannels ride the "song" event
  commit("transport");                 // the knobs went back to their defaults
  resetScroll();
});
