// main.js — the /daw entry: wire the controls, build the rack, paint once.
//
// The boot order mirrors app/main.js's discipline — the engine globals are already
// there (daw.html loads them as ordered classic scripts before this module), so
// this file only has to assemble the UI and run one paint. No audio yet: the
// transport is the next stage, and a rack that draws the truth is the thing that
// has to be right first.
import { SONG, edit, subs, touch, genreIds, genreLabel } from "./song.js";
import { buildRack, paintRack, watchResize, TRACKS } from "./rack.js";

const $ = (id) => document.getElementById(id);

// ---------- the ?query contract: a DAW link restores its song ----------
// Same idea as the app's ↗ share URL — the link names the music, not a session.
const QS = new URLSearchParams(location.search);
function readQuery() {
  const g = QS.get("g"), s = parseInt(QS.get("seed"), 10);
  if (g && window.GenreKernel.GENRES[g]) SONG.genre = g;
  if (s >= 1 && s <= 99999) SONG.seed = s;
}
function writeQuery() {
  const u = new URL(location.href);
  u.searchParams.set("g", SONG.genre);
  u.searchParams.set("seed", String(SONG.seed));
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
  $("dwGenre").addEventListener("change", (e) => edit({ genre: e.target.value }));
  $("dwSeed").addEventListener("change", (e) => {
    const v = Math.max(1, Math.min(99999, parseInt(e.target.value, 10) || 1));
    e.target.value = v; edit({ seed: v });
  });
  $("dwReseed").addEventListener("click", () => edit({ seed: Math.floor(Math.random() * 99999) + 1 }));
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
  buildRack($("dwRack"));
  subs.push(paintRack, syncControls);
  watchResize();
  paintRack();
  // headless probe hook (test/browser/daw-rack.test.js) — the same __ pattern the
  // app's gates read, so a gate never has to race a click to inspect state
  window.__DAW = { SONG, edit, touch, paintRack, TRACKS,
    rowCount: () => document.querySelectorAll(".dw-row").length };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
