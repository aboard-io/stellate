// editors/samples.js — the samples sheet (one tab): THE CRATE.
//
// Per ACTIVE found source a row — role label ONLY ("bed 1", "break", "voice 2";
// THE PROVENANCE LAW: never name a source — panels/inside/describe.js says why),
// a volume tile, and wet/glitch/far flag chips. Below the crate, the found-LAYER
// tiles pitch/stretch/tone and the crackle tile.
//
// Every write rides layers.js WRITERS.samples through ctx.song.editLayer — the
// same axes the old radar wrote, so the patch stays {samples:{axis:v01}} and any
// old shared URL still decodes to the same resolved fields:
//   per-source  "src:<idx>:<vol|wet|glitch|distant>"  (idx = position in the
//               resolved foundSources array — the crate order is deterministic)
//   whole-layer "pitch" / "stretch" / "cutoff" / "crackle"
//
// Contract: export render(host, ctx) — ctx per app/daw/sheet.js header.
import { readLayer, fmtLayer } from "../layers.js";

const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

// role word by source KIND — never the label, never the url. A source without a
// kind is a granular bed; the engine's other kinds map to the crate's own words.
const ROLE = { break: "break", chop: "chops", hit: "hit", speech: "voice", vox: "vox" };

// the crate rows: active sources only, each keeping its ORIGINAL index (the
// per-source axis addresses st.foundSources[idx], not the filtered list), with
// per-role numbering only when a role repeats ("bed 1", "bed 2" — but "break").
function crateRows(st) {
  const rows = [], count = {};
  (st.foundSources || []).forEach((s, i) => {
    if ((s.vol || 0) <= 0.001) return;
    const word = ROLE[s.kind] || "bed";
    count[word] = (count[word] || 0) + 1;
    rows.push({ i, word, n: count[word] });
  });
  for (const r of rows) r.label = count[r.word] > 1 ? r.word + " " + r.n : r.word;
  return rows;
}

export function render(host, ctx) {
  host.textContent = "";
  const song = ctx.song;

  // read one samples axis the way the tile wants it: the patch's own number if
  // set (stock dot off), else the RESOLVED state's value read back — so the
  // tile's fill is honest before you ever touch it. layers.js readLayer covers
  // the per-source axes + crackle; the three whole-layer sweeps have no reader
  // there (the old radar never read them back), so average the active sources
  // with the writer's own ranges (WRITERS.samples: pitch×1.6, stretch 0..1,
  // cutoff log 400..10k).
  const L2 = Math.log2, c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const cutN = (hz) => c01((L2(Math.max(200, hz || 400)) - L2(400)) / (L2(10000) - L2(400)));
  const layerRead = (st, id) => {
    const on = (st.foundSources || []).filter((s) => (s.vol || 0) > 0.001);
    if (!on.length) return 0;
    const avg = (f, d) => on.reduce((a, s) => a + (s[f] != null ? +s[f] : d), 0) / on.length;
    if (id === "pitch") return c01(avg("pitch", 1) / 1.6);
    if (id === "stretch") return c01(avg("stretch", 0.5));
    if (id === "cutoff") return cutN(avg("cutoff", 2600));
    return readLayer(st, "samples", id);
  };
  const readOf = (axis) => {
    const set = (song.SONG.patch.layers || {}).samples || {};
    const v = set[axis] != null ? +set[axis] : layerRead(song.state(), axis);
    return { v, txt: fmtLayer("samples", axis, v), stock: set[axis] == null };
  };
  const tile = (hostEl, axis, label, echoName) => ctx.controls.makeTile(hostEl, {
    label, hue: ctx.hue,
    read: () => readOf(axis),
    write: (v) => song.editLayer("samples", axis, v),
    revert: () => song.editLayer("samples", axis, null),
    onDrag: (v, txt) => ctx.setEcho(echoName + " · " + txt),
  });

  // ---------- the crate: one row per active source ----------
  const box = el("div", "dw-ed");
  box.appendChild(el("div", "dw-edhead", "samples — the crate"));
  const rows = crateRows(song.state());
  if (!rows.length) {
    box.appendChild(el("p", "dw-pnote", "no found layer in this song — this genre plays without the crate."));
  }
  const FLAGS = [["wet", "wet"], ["glitch", "glitch"], ["distant", "far"]];
  for (const r of rows) {
    const row = el("div", "dw-edrow");
    row.appendChild(el("span", "dw-edlab", r.label));
    // the volume tile, sized by the row (.dw-tilehold flexes), not the tile grid
    const wrap = el("div", "dw-tilehold");
    tile(wrap, "src:" + r.i + ":vol", "level", r.label + " · level");
    row.appendChild(wrap);
    // flag chips: independent toggles, so hand-rolled .dw-chip buttons with
    // aria-pressed (makeChips is single-select — a flag row is not a choice)
    const chips = el("div", "dw-chips");
    chips.style.setProperty("--hue", ctx.hue);
    for (const [field, lab] of FLAGS) {
      const b = el("button", "dw-chip", lab);
      b.type = "button";
      const cur = () => { const s = (song.state().foundSources || [])[r.i]; return !!(s && s[field]); };
      const paint = () => { const on = cur(); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); };
      b.setAttribute("aria-label", r.label + " " + lab);
      paint();
      b.addEventListener("click", () => {
        // the flag axis is a threshold write (>=0.5 = true) — layers.js law
        song.editLayer("samples", "src:" + r.i + ":" + field, cur() ? 0 : 1);
        paint();
      });
      chips.appendChild(b);
    }
    row.appendChild(chips);
    box.appendChild(row);
  }
  if (rows.length) box.appendChild(el("p", "dw-pnote",
    "roles only — the crate never names a recording (the provenance law)."));
  host.appendChild(box);

  // ---------- the found layer: whole-crate character ----------
  const lay = el("div", "dw-ed");
  lay.appendChild(el("div", "dw-edhead", "the found layer"));
  const grid = el("div", "dw-tiles");
  if (rows.length) {
    tile(grid, "pitch", "pitch", "pitch");
    tile(grid, "stretch", "stretch", "stretch");
    tile(grid, "cutoff", "tone", "tone");
  }
  tile(grid, "crackle", "crackle", "crackle");   // vinyl noise lives on the state, crate or not
  lay.appendChild(grid);
  if (rows.length) lay.appendChild(el("p", "dw-pnote",
    "pitch / stretch / tone sweep every active source at once; the per-row tiles above trim one source. double-tap any tile to fall back to the genre's own value."));
  host.appendChild(lay);
}
