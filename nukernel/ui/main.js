// ui/main.js — the single module entry (kernel-daw.html loads exactly one
// <script type="module">, this one). Imports the tiers in layer order — each
// module wires its own listeners and subscriptions as it evaluates — then
// runs the one-shot boot: adopt the saved song (or the default), which fires
// the "song" event every view builds from. Also owns the playhead rAF loop,
// which is the ONE consumer of transport.getPosition(): the UI reads the
// audio clock through that accessor and audio never calls a draw function —
// that one-way rule is what the whole split is for.
import { GENRES, RATES } from "./deps.js";
import { SONG, viewSec, readStore, adoptSong, defaultSong, on } from "./state.js";
import { gid } from "./derive.js";
import * as transport from "../audio/transport.js";
// the survival tier (context recovery + MediaSession + the bounce carrier):
// importing it IS the wiring — it registers its listeners, its gesture hook
// and its subscriptions at module evaluation, exactly like the views below
import "../audio/survival.js";
// the views: importing them IS the wiring — each subscribes to the events it
// cares about and binds its own DOM listeners at module evaluation
import "./readout.js";
import * as arrange from "./arrange.js";
import * as songrow from "./songrow.js";
import "./palette.js";
import "./editor.js";
import "./chrome.js";
// the chassis: page rail wiring + transport haptics (phone only in effect —
// the rail is display:none on a desk and the buzz is coarse-pointer-gated)
import "./pages.js";

/* ---------- the playhead loop ---------- */
// One rAF loop for both progress paints: the fill bar on the sounding box and
// the playhead over the grid. It runs only while the transport says it is
// playing, reads getPosition() once per frame (the old frame() computed
// stepDur twice and ran two querySelectorAll('.box') per frame), and paints
// through the views' own refs.
let looping = false;
// the position LCD on the transport: box·bar/len while running, -- parked.
// One compare per frame, one textContent write per BAR — the LCD is glass,
// not a spinner.
const lcdEl = document.getElementById("lcdpos");
let lcdTxt = "--";
function lcd(t) { if (t !== lcdTxt) { lcdTxt = t; lcdEl.textContent = t; } }
function frame() {
  if (!transport.playing) {
    looping = false;                           // the loop parks until restarted
    songrow.paintProgress(-1, 0);
    arrange.resetPlayhead();
    lcd("--");
    return;
  }
  const pos = transport.getPosition();
  if (pos.si >= 0 && SONG[pos.si]) {
    const sec = SONG[pos.si], g = GENRES[gid(sec)];
    // the DERIVED rate — the audio tier schedules with genreOf's g.rate ×
    // RATES[sec.rate], so a "half time" box really lasts twice as long and
    // the raw genre rate had the fill bar full at the halfway mark
    const rate = g.rate * (sec.rate ? RATES[sec.rate] : 1);
    const total = sec.len * 16 / rate * pos.stepDur;
    const f = Math.max(0, Math.min(1, (pos.now - pos.passStart) / total));
    const bar = Math.min(sec.len, Math.floor(f * sec.len) + 1);
    lcd((pos.si + 1) + "·" + bar + "/" + sec.len);
    songrow.paintProgress(pos.si, f);
    if (viewSec === pos.si) {                  // looking at the box that sounds
      const cap = arrange.getViewSteps() * arrange.getStepW();
      const x = Math.max(0, Math.min(cap, ((pos.now - pos.passStart) / pos.stepDur) * arrange.getStepW()));
      arrange.paintPlayhead(x);
    } else arrange.resetPlayhead();
  }
  requestAnimationFrame(frame);
}
// guarded: startAt() fires transport:state on every call (the loop button
// restarts playback mid-play), and two loops painting the same playhead is
// the kind of leak the old code actually had
on("transport:state", d => {
  if (d.playing && !looping) { looping = true; requestAnimationFrame(frame); }
});

/* ---------- boot ---------- */
// One path: the saved song, or the default, both through adoptSong — the boot
// draw is just the "song" event doing what it always does. Guarded against the
// stylesheet race: a module entry can outrun a slow stylesheet, and the first
// arrange render measures #dawscroll (it floors at 560px regardless, so the
// guard is belt and the floor is braces).
function boot() {
  const raw = readStore();
  if (!raw || !adoptSong(raw, "boot")) adoptSong(defaultSong(), "boot");
}
const sc = document.getElementById("dawscroll");
if (!sc.clientWidth && document.readyState !== "complete")
  addEventListener("load", boot, { once: true });
else boot();
