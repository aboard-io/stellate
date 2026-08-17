// ui/chrome.js — the top bar: transport button, tempo and volume (views over
// state, never the other way round), the font select, the composer, the
// preset list, save/load/reset. The wiring that used to sit loose at the
// bottom of kernel-daw.js, each entry point now one adoptSong() call instead
// of a hand-copied eleven-statement epilogue.
//
// Layer graph: ui view — imports state/audio; the play button is the page's
// user gesture, which is why initAudio rides transport.startAt.
import { GENRES, FONTS, compose, PRESETS, GROOVELABEL,
         SWINGLABEL } from "./deps.js";
import { bpm, vol, loopOnly, setBpm, setVol, setLoopOnly, adoptSong, defaultSong,
         clearStore, loadErrorText, saveFile, loadFile, commit, on,
         GROOVE, setGroove, SWING, setSwing, DEFAULT_BPM } from "./state.js";
import { buzz, pointers } from "./touch.js";
// the WRITE picker lists genres in the same order the GENRE menu does — by
// YEAR, oldest first ("organize the genres chronologically in the menu",
// Paul, 2026-08-16). One ordering, defined once, in the module that owns the
// menu banks; two surfaces sorting the same list two different ways is how a
// person learns a place in a list that is not there on the other screen.
import { chronoGenres } from "./palette.js";
import { playing, startAt, stop, ensureAssets } from "../audio/transport.js";
import { initAudio } from "../audio/graph.js";
import { setFont, fontDef, FONT } from "../audio/assets.js";
import { status } from "./readout.js";

const $ = id => document.getElementById(id);

/* ---------- transport ---------- */
$("play").addEventListener("click",
  () => playing ? stop() : (setLoopOnly(null), startAt(0)));
on("transport:state", d => {
  // ICON ONLY (2026-08-17): the button used to swap its own textContent
  // ("▶ Play"/"■ Stop"), which is exactly what would have eaten the icon
  // <span> a plain assignment can't tell from a word. The triangle-to-square
  // swap is CSS now (#play.on .k, kernel-daw.css) keyed off this same class;
  // the word survives as the tooltip and the accessible name instead.
  $("play").classList.toggle("on", !!d.playing);
  const word = d.playing ? "stop" : "play";
  $("play").title = word; $("play").setAttribute("aria-label", word);
});

/* ---------- the song-loop toggle ---------- */
// ON, THE DEFAULT, IS THE SILENCE OF DOING NOTHING: the bar list has always
// wrapped forever (audio/transport.js tick(): nextBar cycles mod TL.length),
// so the toggle's "on" state needs no code at all. OFF asks the scheduler to
// do the one thing it was never built to — stop at the end of a single pass
// — and transport.js's own nextBar/TL are module-private, not this lane's to
// reach into (this lane owns chrome.js, not the scheduler). The honest way to
// get "played through once" from outside is to watch the PUBLIC event the
// scheduler already emits: "transport:section" names the box every time one
// starts sounding, so remembering which box a pass STARTED on and stopping
// the next time that same box comes back around IS one full pass. loopOnly
// (a single box pinned solo, songrow.js) is an older, separate feature and
// stays untouched — pinning already loops one box on purpose, regardless of
// what the record's own switch says.
//
// THE KNOWN EDGE: a manual mid-pass jump (songrow.js's queued pendingStart,
// clicking a different row while playing) does not reset the count the way a
// fresh startAt() does, so a jump back to the pass's own starting box reads
// as "the pass came around" a beat early. The real fix is a flag inside
// tick() itself, which is out of this file's reach; noted rather than hidden.
let songLoop = true, passStartSi = null;
function paintLoop() {
  $("loop").setAttribute("aria-pressed", String(songLoop));
  const word = songLoop ? "song loops — tap to play once and stop"
                         : "plays once and stops — tap to loop the song";
  $("loop").title = word; $("loop").setAttribute("aria-label", word);
}
paintLoop();
$("loop").addEventListener("click", () => { songLoop = !songLoop; paintLoop(); });
on("transport:state", d => { if (d.playing) passStartSi = null; });
on("transport:section", d => {
  if (passStartSi == null) { passStartSi = d.si; return; }
  if (d.si === passStartSi && loopOnly == null && !songLoop) stop();
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
// "song" re-syncs the TEMPO only: a song owns its bpm, but volume is the
// device's (state.js VOLSTORE) and no incoming song may move the fader. The
// vol readout is set once here from the restored store value — the HTML's
// value="80" is only the pre-boot placeholder.
function syncKnobs() {
  $("bpm").value = bpm; $("bpmv").textContent = String(bpm);
}
on("song", syncKnobs);
$("vol").value = vol; $("volv").textContent = String(vol);
// TWO VIEWS, ONE VALUE: the board's MASTER strip drives the same sticky vol
// store this fader does, so the readout follows every "transport" commit. No
// loop — assigning .value fires no input event, and an in-place assignment of
// the value the input already holds is a no-op paint.
on("transport", () => {
  if (+$("vol").value !== vol) {
    $("vol").value = vol; $("volv").textContent = String(vol);
  }
});

// THE FULL GESTURE SET for the two faders — the only continuous controls on
// the machine (everything else is a list of named steps), so they
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

/* ---------- the song's groove ---------- */
// A SONG FACT, LIKE THE TEMPO — one drummer for the record, not one per
// section — so its one control sits in the session bank with the other things
// that outlive a box (the transport bar has no room for a fourth control at
// phone width). A select rather than chips because it is the bank's idiom
// (soundfont, songs), reading its current value the way the tempo fader does:
// set from state on every "song", written back through the one setter, and the
// change leaves through commit("groove") — the transport recompiles and the
// carrier re-renders on that event, never on a direct call from here.
{
  const sel = $("groove");
  sel.append(Object.assign(document.createElement("option"),
    { value: "", textContent: "flat" }));          // the grid, the null spelling
  for (const k of Object.keys(GROOVELABEL))
    sel.append(Object.assign(document.createElement("option"),
      { value: k, textContent: GROOVELABEL[k] }));
  const syncGroove = () => { sel.value = GROOVE || ""; };
  syncGroove();
  on("song", syncGroove);
  on("groove", syncGroove);          // any other writer keeps this picker honest
  sel.addEventListener("change", e => {
    setGroove(e.target.value || null);
    syncGroove();                    // the normalizer may have said null
    commit("groove");
  });
}

/* ---------- ...and its swing ---------- */
// THE SAME MOVE MADE TWICE ("nothing in a section tells time"): the swing sits
// beside the groove in the session bank, one control for the record, wired the
// same way — filled from the registry table, read from state on every "song",
// written through the one setter, leaving through commit("swing"). The empty
// option is "default", not "flat": null means the GENRE's own lean stands
// (swing is identity there), and the explicit zero already has a name in the
// vocabulary — "straight".
{
  const sel = $("swing");
  sel.append(Object.assign(document.createElement("option"),
    { value: "", textContent: "default" }));       // the genre's own lean
  for (const k of Object.keys(SWINGLABEL))
    sel.append(Object.assign(document.createElement("option"),
      { value: k, textContent: SWINGLABEL[k] }));
  const syncSwing = () => { sel.value = SWING || ""; };
  syncSwing();
  on("song", syncSwing);
  on("swing", syncSwing);            // any other writer keeps this picker honest
  sel.addEventListener("change", e => {
    setSwing(e.target.value || null);
    syncSwing();                     // the normalizer may have said null
    commit("swing");
  });
}

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
// THE SEED IS STILL REAL, JUST NOT PRINTED (2026-08-17, "almost no words" —
// the phrase editor drops its own seed readout in the same pass, and a
// number nobody asked to see has no more business in the transport than
// there). It still drives compose(): the same seed is still the same song,
// which is what keeps the composer testable; ⟳ still rolls a fresh one IN
// THE SAME GENRE, the loop a person actually plays — write, listen, reroll,
// reroll, keep.
{
  const sel = $("composeg");
  sel.append(Object.assign(document.createElement("option"),
    { value: "", textContent: "surprise me" }));
  // oldest first, the yearless FUNCTION genres behind them — the GENRE menu's
  // own order. A <select> may not be grouped by era either: the labels print
  // the years, which is the whole organisation.
  const chrono = chronoGenres();
  for (const k of [...chrono.dated, ...chrono.undated])
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

/* (There is no master-bus row group here any more: the master controls are the
   MIX page's rack MASTER row — ui/mixtbl.js builds them from the same fields.js
   MASTER registry, ids #m-<key> kept — because the master is the last strip of
   the one desk, and the desk lives on the board.) */

/* ---------- desktop + reset ---------- */
$("savefile").addEventListener("click", saveFile);
$("loadfile").addEventListener("click", () => $("loadinput").click());
$("loadinput").addEventListener("change", e => {
  if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
  e.target.value = "";                       // so the same file can be picked twice
});
$("reset").addEventListener("click", () => {
  clearStore();                        // the SONG key only — the device volume survives a reset
  adoptSong(defaultSong(), "reset");   // stop + dropChannels ride the "song" event
  commit("transport");                 // tempo went back to its default; vol stays put
});
