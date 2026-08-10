// main.js — the /daw entry: KERNEL → SONG → GRID → SHEET, wired and painted once.
//
// The boot order mirrors app/main.js's discipline — the engine globals are
// already there (daw.html loads them as ordered classic scripts before this
// module), so this file only assembles the UI, runs one paint, and wires the
// transport. PLAY re-reads the song every chord bar (transport.js), so an edit
// made while the music runs lands at the next bar instead of restarting.
import { SONG, edit, subs, touch, encodePatch, decodePatch, state, events, TRACKS } from "./song.js";
import * as KERNELCARD from "./kernelcard.js";
import * as STRUCTURE from "./structure.js";
import * as GRID from "./grid.js";
import * as SHEET from "./sheet.js";
import { registry } from "./controls.js";
import * as TRANSPORT from "./transport.js";
import * as EXPORT from "./export.js";

const $ = (id) => document.getElementById(id);

// ---------- the ?query contract: a DAW link restores its SONG ----------
// Same idea as the app's ↗ share URL — the link names the music, not a session —
// but here it has to carry the EDITS too, or the page is a place where you make
// something good and then lose it. ?g + ?seed name the base the kernel resolves;
// ?p is the patch (base64url JSON, whitelisted on the way in — see song.js).
const QS = new URLSearchParams(location.search);
function readQuery() {
  const g = QS.get("g"), s = parseInt(QS.get("seed"), 10);
  if (g && window.GenreKernel.GENRES[g]) SONG.genre = g;
  if (s >= 1 && s <= 99999) SONG.seed = s;
  const p = decodePatch(QS.get("p"));
  // the sculpted blend travels inside the patch payload (song.js encodePatch)
  if (p.__w) { SONG.weights = p.__w; delete p.__w; }
  SONG.patch = p;
  // THE TRIAL BUILD. The whitelist gates which KEYS survive a hostile URL, but a
  // key with a mangled SHAPE (kits with junk ops, cells that aren't arrays) only
  // detonates inside the engine — and an exception here escapes boot(), so the
  // grid never paints and the DAW is dead on a shareable link. So the patch has
  // to prove it builds before it is allowed to be the document: one full
  // buildEvents at the door, and a patch that throws drops whole — silently,
  // because a hostile URL deserves no diagnostics (the sanitizeSecover law).
  try { events(); }
  catch (e) {
    console.warn("daw: patch in the URL does not build — dropped");
    SONG.patch = {};
    try { events(); }
    catch (e2) { SONG.weights = null; }  // the blend was the poison — base genre then
  }
}
function writeQuery() {
  const u = new URL(location.href);
  u.searchParams.set("g", SONG.genre);
  u.searchParams.set("seed", String(SONG.seed));
  const p = encodePatch();
  if (p) u.searchParams.set("p", p); else u.searchParams.delete("p");
  history.replaceState(null, "", u);
}

function wire() {
  $("dwSeed").addEventListener("change", (e) => {
    const v = Math.max(1, Math.min(99999, parseInt(e.target.value, 10) || 1));
    e.target.value = v; TRANSPORT.songChanged(); edit({ seed: v });
  });
  $("dwReseed").addEventListener("click", () => { TRANSPORT.songChanged(); edit({ seed: Math.floor(Math.random() * 99999) + 1 }); });
  // ▶ / ■ — one button. Starting needs the user gesture (the AudioContext unlock
  // rides this click), so it must be a real listener, never a programmatic call.
  $("dwPlay").addEventListener("click", () => {
    TRANSPORT.toggle((m) => { const r = $("dwRead"); if (r && !TRANSPORT.isPlaying()) r.textContent = m; });
  });
  // ⤓ EXPORTS. wav/mp3 render offline in a dedicated worker (no ring, so it can
  // run flat out without touching playback); midi and xml are synchronous walks of
  // the same buildEvents the grid draws.
  const exporter = (id, fn, label) => $(id).addEventListener("click", async () => {
    const b = $(id), was = b.textContent;
    b.disabled = true;
    try {
      await fn((p) => { b.textContent = label + " " + Math.round(p * 100) + "%"; });
      b.textContent = "saved";
    } catch (e) {
      console.error(e); b.textContent = "failed";
    }
    setTimeout(() => { b.textContent = was; b.disabled = false; }, 1800);
  });
  const closeDl = () => { const d = $("dwDl"); if (d) d.open = false; };
  exporter("dwWav", (p) => { closeDl(); return EXPORT.downloadWav(90, p); }, "wav");
  exporter("dwMp3", (p) => { closeDl(); return EXPORT.downloadMp3(90, p); }, "mp3");
  exporter("dwMid", () => { closeDl(); return Promise.resolve(EXPORT.downloadMidi()); }, "midi");
  exporter("dwXml", () => { closeDl(); return EXPORT.downloadMusicXml(); }, "xml");

  $("dwShare").addEventListener("click", async () => {
    const btn = $("dwShare"), was = btn.textContent;
    try { await navigator.clipboard.writeText(location.href); btn.textContent = "copied"; }
    catch (e) { btn.textContent = "copy failed"; }
    setTimeout(() => { btn.textContent = was; }, 1400);
  });
}

// The controls are a VIEW of the document, not its owner — re-reading them from
// SONG on every change keeps an edit from anywhere (probe, preset, future undo)
// consistent with the inputs and the URL.
function syncControls() {
  const seed = $("dwSeed");
  if (+seed.value !== SONG.seed) seed.value = SONG.seed;
  writeQuery();
}

function boot() {
  readQuery();
  $("dwSeed").value = SONG.seed;
  wire();

  SHEET.mount($("dwSheet"));          // before the grid — cell taps open it
  KERNELCARD.build($("dwKernel"));
  STRUCTURE.build($("dwSong"));
  GRID.build($("dwGrid"));

  subs.push(syncControls, TRANSPORT.paintReadout);
  TRANSPORT.onHead(GRID.placeHead);
  TRANSPORT.onHead(STRUCTURE.placeHead);
  TRANSPORT.onChange(() => {
    const b = $("dwPlay");
    b.textContent = TRANSPORT.isPlaying() ? "■ stop" : "▶ play";
    b.classList.toggle("on", TRANSPORT.isPlaying());
    document.body.classList.toggle("dw-playing", TRANSPORT.isPlaying());
  });
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { GRID.paint(); }, 120); });

  TRANSPORT.paintReadout();           // the bottom-right readout exists before the first play

  // ---------- probe hooks (the gates' contract — DAW-GRID spec §Probe hooks) ----------
  window.__DAWSTATE = state;
  window.__DAW = {
    SONG, edit, touch, encodePatch, decodePatch, TRANSPORT, TRACKS,
    grid: { rows: GRID.rows, cols: GRID.cols, rowHash: GRID.rowHash,
            openCell: GRID.openCell, cellCount: GRID.cellCount },
    sheet: { open: SHEET.open, close: SHEET.close, el: SHEET.el, tab: SHEET.tab },
    controls: { pads: () => registry.pads(), tiles: () => registry.tiles() },
  };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
