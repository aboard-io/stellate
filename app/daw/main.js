// main.js — the /daw entry: wire the controls, build the rack, paint once.
//
// The boot order mirrors app/main.js's discipline — the engine globals are already
// there (daw.html loads them as ordered classic scripts before this module), so
// this file only has to assemble the UI, run one paint, and wire the transport.
// PLAY re-reads the song every chord bar (transport.js), so an edit made while the
// music runs lands at the next bar instead of restarting anything.
import { SONG, edit, subs, touch, genreIds, genreLabel, encodePatch, decodePatch } from "./song.js";
import { buildRack, paintRack, watchResize, TRACKS } from "./rack.js";
import * as TRANSPORT from "./transport.js";
import { buildFeel } from "./feelpanel.js";

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
  SONG.patch = decodePatch(QS.get("p"));
}
function writeQuery() {
  const u = new URL(location.href);
  u.searchParams.set("g", SONG.genre);
  u.searchParams.set("seed", String(SONG.seed));
  const p = encodePatch();
  if (p) u.searchParams.set("p", p); else u.searchParams.delete("p");
  history.replaceState(null, "", u);
}

function fillGenres() {
  const sel = $("dwGenre");
  const ids = genreIds().slice().sort((a, b) => genreLabel(a).localeCompare(genreLabel(b)));
  for (const g of ids) {
    const o = document.createElement("option");
    o.value = g; o.textContent = genreLabel(g);
    sel.appendChild(o);
  }
  sel.value = SONG.genre;
}

function wire() {
  $("dwGenre").addEventListener("change", (e) => { TRANSPORT.songChanged(); edit({ genre: e.target.value }); });
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
  // ↗ link — act, then say so (the app's ↗ share / ⧉ copy-embed pattern). The URL
  // is already correct at all times; this only puts it on the clipboard.
  $("dwShare").addEventListener("click", async () => {
    const btn = $("dwShare"), was = btn.textContent;
    try { await navigator.clipboard.writeText(location.href); btn.textContent = "copied"; }
    catch (e) { btn.textContent = "copy failed"; }
    setTimeout(() => { btn.textContent = was; }, 1400);
  });
}

// The controls are a VIEW of the document, not its owner. Re-reading them from
// SONG on every change is what lets an edit arrive from anywhere — a probe, a
// future undo, a preset load — and still leave the inputs and the URL correct.
// (The gate caught this: driving edit() directly used to leave the URL stale,
// because only the DOM handlers wrote it.)
function syncControls() {
  const sel = $("dwGenre"), seed = $("dwSeed");
  if (sel.value !== SONG.genre) sel.value = SONG.genre;
  if (+seed.value !== SONG.seed) seed.value = SONG.seed;
  writeQuery();
}

function boot() {
  readQuery();
  fillGenres();
  $("dwSeed").value = SONG.seed;
  wire();
  buildFeel($("dwFeel"));
  buildRack($("dwRack"));
  subs.push(paintRack, syncControls, () => TRANSPORT.mountHeads());
  TRANSPORT.onChange(() => {
    const b = $("dwPlay");
    b.textContent = TRANSPORT.isPlaying() ? "■ stop" : "▶ play";
    b.classList.toggle("on", TRANSPORT.isPlaying());
    document.body.classList.toggle("dw-playing", TRANSPORT.isPlaying());
  });
  watchResize();
  paintRack();
  // headless probe hook (test/browser/daw-rack.test.js) — the same __ pattern the
  // app's gates read, so a gate never has to race a click to inspect state
  window.__DAW = { SONG, edit, touch, paintRack, TRACKS, encodePatch, decodePatch, TRANSPORT,
    rowCount: () => document.querySelectorAll(".dw-row").length };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
