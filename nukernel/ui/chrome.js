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
         clearStore, loadErrorText, saveFile, loadFile, commit, on,
         DEFAULT_BPM } from "./state.js";
import { buzz, pointers } from "./touch.js";
import { playing, startAt, stop, ensureAssets } from "../audio/transport.js";
import { initAudio } from "../audio/graph.js";
import { setFont, fontDef, FONT } from "../audio/assets.js";
import { status } from "./readout.js";
import { resetScroll } from "./arrange.js";
import { hintKey } from "./editor.js";

const $ = id => document.getElementById(id);

/* ---------- transport ---------- */
$("play").addEventListener("click",
  () => playing ? stop() : (setLoopOnly(null), startAt(0)));
on("transport:state", d => {
  $("play").textContent = d.playing ? "■ Stop" : "▶ Play";
  // the LED is a pseudo-element (textContent swaps would eat a child node);
  // the class is all the CSS needs. Green while running — a state colour,
  // the same in both faces.
  $("play").classList.toggle("on", !!d.playing);
});

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

// HARDWARE FEEL for the two faders — the only continuous controls on the
// machine (everything else is a detented list, the hw.css doctrine), so they
// carry the full verb set themselves:
//   drag horizontal   the fader: full range across one track-width of travel
//   drag vertical     the fine trim, ~×5 finer, up is more (verb #2)
//   shift / a second finger anywhere: the horizontal axis goes fine too
//   double-tap        back to the default (verb #5)
//   wheel             ±1, shift ±5
// The input STAYS a real <input type=range>: keyboard arrows, Home/End and
// the accessible name are native and untouched. Only the POINTER path is
// replaced — a native horizontal drag and a synthetic vertical scrub writing
// the same value from two axes in the same event is a fight, not a control,
// so pointerdown takes the whole gesture and hands back a single value.
function fader(input, dflt) {
  const min = +input.min, max = +input.max, span = max - min;
  const fire = () => input.dispatchEvent(new Event("input", { bubbles: true }));
  const set = v => {
    v = Math.round(Math.max(min, Math.min(max, v)));
    if (v !== +input.value) { input.value = String(v); fire(); }
  };
  let drag = null, lastTap = 0;
  input.addEventListener("pointerdown", e => {
    if (e.button) return;
    e.preventDefault();                          // the native drag never starts
    input.focus({ preventScroll: true });        // preventDefault ate the focus
    try { input.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    drag = { x0: e.clientX, y0: e.clientY, v0: +input.value, moved: false,
             fine: e.shiftKey || pointers() > 1 };
  });
  input.addEventListener("pointermove", e => {
    if (!drag) return;
    let dx = e.clientX - drag.x0, dy = drag.y0 - e.clientY;     // up is more
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;          // a tap, so far
    drag.moved = true;
    // FINE MODE REBASES (editor.js's from/base reset, same verb): the ×0.2
    // rescales only travel AFTER the crossing. Scaling the whole accumulated
    // dx teleported the value the instant a second finger landed — a ~40 BPM
    // snap on the tempo fader, the opposite of asking for fine control.
    const fine = e.shiftKey || pointers() > 1;
    if (fine !== drag.fine) {
      drag.fine = fine;
      drag.x0 = e.clientX; drag.y0 = e.clientY; drag.v0 = +input.value;
      dx = 0; dy = 0;
    }
    const w = Math.max(60, input.getBoundingClientRect().width - 22);
    set(drag.v0 + (dx / w) * span * (fine ? 0.2 : 1) + (dy / (w * 5)) * span);
  });
  input.addEventListener("pointerup", () => {
    if (!drag) return;
    if (!drag.moved) {                           // taps: two inside 300ms = default
      const now = performance.now();
      if (now - lastTap < 300) { set(dflt); buzz(4); lastTap = 0; }
      else lastTap = now;
    }
    drag = null;
  });
  input.addEventListener("pointercancel", () => { drag = null; });
  input.addEventListener("dblclick", () => { set(dflt); });
  input.addEventListener("wheel", e => {
    e.preventDefault();
    set(+input.value + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 5 : 1));
  }, { passive: false });
}
fader($("bpm"), DEFAULT_BPM);
fader($("vol"), 80);

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

/* ---------- the composer: the ✎ WRITE key ---------- */
// ONE KEY, on the transport, because it is the fastest path to a song there
// is. It writes eight phrases and an arrangement of them — nine boxes with
// roles, its own tempo, its own groove, its own mix — and hands the result
// to adoptSong, the SAME validate-and-apply path a file off the desktop takes.
// If the composer ever emitted a song the loader would refuse, the loader
// refuses it and says so, rather than there being a second, more trusted way in.
//
// THE SEED IS VISIBLE NOW. It was always real — the same number is the same
// song, which is what makes the composer testable — and hiding it made the
// key a slot machine. Eight hex digits on the little LCD beside the key, and
// ⟳ rolls a fresh one IN THE SAME GENRE, which is the loop a person actually
// plays: write, listen, reroll, reroll, keep.
{
  const sel = $("composeg"), seedEl = $("seedlcd");
  sel.append(Object.assign(document.createElement("option"),
    { value: "", textContent: "surprise me" }));
  for (const k of Object.keys(GENRES))
    sel.append(Object.assign(document.createElement("option"),
      { value: k, textContent: GENRES[k].label }));
  let lastG = null;                    // what ⟳ rerolls: the last genre WRITTEN
  const composeNow = gk => {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const song = compose(gk, seed);
    if (!adoptSong(song, "composer")) {
      status("the composer produced a song the loader rejected — that is a bug, not a taste", true);
      return;
    }
    lastG = gk;
    seedEl.textContent = seed.toString(16).padStart(8, "0");
    seedEl.dataset.on = "";
    seedEl.title = "seed " + seed + " — the same number is the same song";
    buzz(4);
    status(GENRES[gk].label + " · seed " + seed + " · " +
      song.song.map(b => b.role).join(" → ") + "  —  press play", true);
  };
  const pick = () => {
    const keys = Object.keys(GENRES);
    return sel.value || keys[Math.floor(Math.random() * keys.length)];
  };
  $("compose").addEventListener("click", () => composeNow(pick()));
  $("reroll").addEventListener("click", () => composeNow(lastG || pick()));
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
// the SONG page's (?) — the same .btn.hint/.edhint pattern the editor head
// established (editor.js exports the three-line wiring); the copy it toggles
// used to be a four-line lecture printed above the rack on every visit
hintKey("songhelp", "songhint");
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
