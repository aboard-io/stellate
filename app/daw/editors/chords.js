// editors/chords.js — the chords PART tab: progression blocks + harmony tiles.
//
// Per DAW-GRID spec "chords PART": the progression as chord blocks (ONE cycle),
// TILES reach (theory.adventure) and color — both write through
// ctx.song.editLayer("chords", …), which ARMS the reharmoniser exactly as
// layers.js WRITERS.chords always did — RATE as chips 8/6/4/2 (discrete, not a
// tile), key as 12 chips (C..B), and the facts line (tables corpus/hand, reharm
// state). Swing + humanize live in MASTER now, not here.
//
// REPAINT POLICY: the chord blocks and facts are not pads/tiles, so every
// commit made on this sheet repaints them locally (paintAll) — the sheet body
// is never re-rendered per edit, and the pinned roll is hidden for chords, so
// the blocks ARE the cause-next-to-effect surface.
//
// Contract: export render(host, ctx) — ctx per app/daw/sheet.js header.
import { readLayer, fmtLayer, TILE_SETS } from "../layers.js";

const E = window.CsdEngine;
const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ROOT = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
// chord names are authored around C in the engine tables; state.keyOffset
// transposes at render, so the blocks transpose the NAME the same way
function transposeName(name, off) {
  const m = /^([A-G][#b]?)(.*)$/.exec(String(name || ""));
  if (!m || !off) return name || "?";
  return NOTES[(ROOT[m[1]] + off) % 12] + m[2];
}

export function render(host, ctx) {
  host.textContent = "";
  const song = ctx.song;
  const box = el("div", "dw-ed");
  box.appendChild(el("div", "dw-edhead", "chords — the harmony brain"));

  // ---------- the progression, as chord blocks (one cycle) ----------
  const blocks = el("div", "dw-blocks");
  blocks.style.setProperty("--hue", ctx.hue);
  box.appendChild(blocks);
  const progNote = el("p", "dw-pnote", "");
  box.appendChild(progNote);

  // ---------- reach + color tiles (arming reharm, the layers.js law) ----------
  const tiles = el("div", "dw-tiles");
  for (const T of TILE_SETS.chords) {                      // adventure ("reach") + color
    ctx.controls.makeTile(tiles, {
      label: T.label, unit: "", hue: ctx.hue,
      read: () => {
        const st = song.state();
        const v = readLayer(st, "chords", T.id);
        const set = (song.SONG.patch.layers || {}).chords || {};
        return { v, txt: fmtLayer("chords", T.id, v), stock: set[T.id] == null };
      },
      write: (v) => { song.editLayer("chords", T.id, v); paintAll(); },
      revert: () => { song.editLayer("chords", T.id, null); paintAll(); },
      onDrag: (v, txt) => ctx.setEcho(T.label + " · " + txt),
    });
  }
  box.appendChild(tiles);
  box.appendChild(el("p", "dw-pnote",
    "moving either tile ARMS the reharmoniser — reach is how far from the skeleton the walk may go, " +
    "color is how rich the voicings get. The blocks above re-name themselves as the harmony moves."));

  // ---------- RATE — chordEvery as chips (a choice, not an amount) ----------
  const rateRow = el("div", "dw-edrow");
  rateRow.appendChild(el("span", "dw-edlab", "rate"));
  const layerSet = () => (song.SONG.patch.layers || {}).chords || {};
  ctx.controls.makeChips(rateRow, {
    hue: ctx.hue,
    options: [{ id: "own", label: "genre's own" }].concat(
      [8, 6, 4, 2].map((n) => ({ id: String(n), label: String(n), title: n + " beats a chord" }))),
    value: layerSet().rate != null ? String(Math.max(2, Math.round(8 - layerSet().rate * 6))) : "own",
    onPick: (id) => { song.editLayer("chords", "rate", id === "own" ? null : (8 - +id) / 6); paintAll(); },
  });
  const rateVal = el("span", "dw-edval", "");
  rateRow.appendChild(rateVal);
  box.appendChild(rateRow);

  // ---------- KEY — 12 chips, C..B ----------
  const keyRow = el("div", "dw-edrow");
  keyRow.appendChild(el("span", "dw-edlab", "key"));
  ctx.controls.makeChips(keyRow, {
    hue: ctx.hue,
    options: [{ id: "own", label: "genre's own" }].concat(NOTES.map((n, i) => ({ id: String(i), label: n }))),
    value: layerSet().key != null ? String(Math.round(layerSet().key * 11)) : "own",
    onPick: (id) => { song.editLayer("chords", "key", id === "own" ? null : +id / 11); paintAll(); },
  });
  box.appendChild(keyRow);

  // ---------- FACTS — tables / reharm state ----------
  const dl = el("dl", "dw-facts");
  box.appendChild(dl);

  function paintAll() {
    const s = song.state();
    const prg = (E.resolveProgression ? E.resolveProgression(s) : null) || E.PROGRESSIONS[s.progression] || { chords: [] };
    const off = ((s.keyOffset | 0) % 12 + 12) % 12;
    blocks.textContent = "";
    for (const ch of prg.chords || [])
      blocks.appendChild(el("span", "dw-block", transposeName(ch && ch.name, off)));
    const cb = Math.max(2, Math.round(s.chordEvery || (s.meter ? 6 : 8)));
    progNote.textContent = (prg.label || s.progression || "?") +
      " — one cycle, " + (prg.chords || []).length + " chords · " + cb + " beats each";
    rateVal.textContent = "now: " + cb + " beats a chord";
    const th = s.theory || {};
    dl.textContent = "";
    const fact = (k, v) => { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, String(v))); };
    fact("reharm", th.reharm ? "on · reach " + (th.adventure != null ? th.adventure : "—") +
      " · color " + (th.color != null ? th.color : "—") : "off — the skeleton plays as written");
    fact("tables", (th.tables || "hand") + (th.tables === "corpus" ? " (the mined MIDI trove)" : ""));
    fact("key", NOTES[off] + (off ? " (shifted +" + off + ")" : ""));
  }
  paintAll();

  box.appendChild(el("p", "dw-pnote",
    "the blocks are the SKELETON the form cycles through; with reharm armed the walk re-voices it per " +
    "cycle, seeded — same rules, different pass every seed. Time feel (swing · humanize) lives on the master sheet."));
  host.appendChild(box);
}
