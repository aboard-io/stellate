// ui/main.js — the single module entry (kernel-daw.html loads exactly one
// <script type="module">, this one). Imports the tiers in layer order — each
// module wires its own listeners and subscriptions as it evaluates — then
// runs the one-shot boot: adopt the saved song (or the default), which fires
// the "song" event every view builds from. Also owns the playhead rAF loop,
// which is the ONE consumer of transport.getPosition(): the UI reads the
// audio clock through that accessor and audio never calls a draw function —
// that one-way rule is what the whole split is for.
import { ROLES } from "./deps.js";
import { SONG, readStore, adoptSong, defaultSong, on, emit } from "./state.js";
import { stackLabel } from "./derive.js";
import * as transport from "../audio/transport.js";
// the survival tier (context recovery + MediaSession + the bounce carrier):
// importing it IS the wiring — it registers its listeners, its gesture hook
// and its subscriptions at module evaluation, exactly like the views below
import "../audio/survival.js";
// the views: importing them IS the wiring — each subscribes to the events it
// cares about and binds its own DOM listeners at module evaluation.
// (There is no ui/arrange.js — the MOVE tracker went with "the row and the
// board", its playhead question answered by the song row's fill bar and the
// position LCD — and no ui/ctxstrip.js: popups open ON the row they edit, so
// nothing edits a box from a page the box is not on.)
import "./readout.js";
import * as songrow from "./songrow.js";
import "./palette.js";
import "./editor.js";
// the board: after editor, because it borrows the panel-head (?) wiring
// from it, and it reads the roster out of audio/mixer (a view importing audio
// is the allowed direction; audio never imports back). paintBoard rides the
// one rAF loop below — the board's fader caps follow the built gains live.
import * as board from "./mixtbl.js";
import "./chrome.js";
// the INSTRUMENT POOL bank on the SONG page — the band, hired for the record
// (one instrument per chair, per song; ui/poolbank.js owns the rows and the
// twelve-family picker they unfold)
import "./poolbank.js";
// THE LAB PAGE — the bench where genres are crossed. Importing it wires the
// tab the same way every view above is wired; what it does NOT do is load the
// bench, which is ~123 KB of analysis tier behind ui/deps.js loadLab() and
// arrives on the first visit to the tab, not at boot.
import "./lab.js";
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
    lcd("--");
    return;
  }
  const pos = transport.getPosition();
  if (pos.si >= 0 && SONG[pos.si]) {
    // THE BOX THAT IS PLAYING, not the box the grid describes. This used to be
    // `sec.len × 16 / rate × stepDur` — the nominal box — and since the tempo
    // map every bar of a box is a different length, so the fill bar and the LCD
    // wrapped up to a beat before or after the music did ("it's repeating
    // itself off by a beat or two"). transport.passAt sums the bar list's own
    // durations, which is the only place the answer exists.
    const p = transport.passAt(pos.now);
    lcd((pos.si + 1) + "·" + p.bar + "/" + p.bars);
    songrow.paintProgress(pos.si, p.f);
  }
  // the board's automated fader caps + master meter, on the same frame — the
  // one-loop rule (two loops painting one page is the leak the loop replaced)
  board.paintBoard();
  requestAnimationFrame(frame);
}
// guarded: startAt() fires transport:state on every call (the loop button
// restarts playback mid-play), and two loops painting the same playhead is
// the kind of leak the old code actually had
on("transport:state", d => {
  if (d.playing && !looping) { looping = true; requestAnimationFrame(frame); }
});
// THE READOUT FOLLOWS THE PLAYING BOX (the song row's .live ring and the
// position LCD say the number; this line says the name). Published as a
// status EVENT, so main never draws into another view's element — readout.js
// stays the sole owner of #readout and the layer graph stays one-way.
on("transport:section", d => {
  const sec = SONG[d.si];
  if (!sec) return;                            // startAt announces si -1 once
  emit("status", { text: "▶ box " + (d.si + 1) +
    (sec.role ? " · " + ROLES[sec.role] : "") + " · " + stackLabel(sec) });
});

/* ---------- boot ---------- */
// One path: the saved song, or the default, both through adoptSong — the boot
// draw is just the "song" event doing what it always does. No stylesheet-race
// guard any more: the view that measured itself at boot (the MOVE tracker)
// is gone, and every surface that measures now does it inside a popup, on a
// user gesture, long after load.
const raw = readStore();
if (!raw || !adoptSong(raw, "boot")) adoptSong(defaultSong(), "boot");
