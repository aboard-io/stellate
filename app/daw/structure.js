// structure.js — the SONG bar + the section sheet.
//
// The bar is the form made tappable: one chip per section, WIDTH PROPORTIONAL
// to its true beat share (the grid's columns are equal-width for legibility;
// the bar tells the truth about time — the spec's split). The cycles count is
// printed on the chip. Tap a chip → the SECTION SHEET, the surface that writes
// patch.secover: cycles chips, per-voice on/off chips, per-voice pattern chips
// from the ENGINE's own vocabulary — deterministic rules, never diffs. That is
// what makes the grid's cells editable per column.
import { subs, state, sectionSpans, SONG, editSecover, events } from "./song.js";
import { makeChips } from "./controls.js";
import { open as openSheet } from "./sheet.js";

const E = window.CsdEngine;
const $el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let root = null, headEl = null;

export function build(host) {
  root = host;
  paint();
  subs.push(paint);
  return root;
}

export function paint() {
  if (!root) return;
  root.textContent = "";
  const spans = sectionSpans();
  const total = spans.reduce((n, s) => n + s.beats, 0) || 1;
  const so = SONG.patch.secover || {};
  for (const sp of spans) {
    const b = $el("button", "dw-secchip" + (so[sp.id] ? " edited" : ""));
    b.type = "button";
    b.style.flexGrow = String(sp.beats / total);
    b.title = `${sp.name || "section"} · ${sp.sec.cycles || 1} cycle${(sp.sec.cycles || 1) > 1 ? "s" : ""} · ${sp.beats} beats`;
    b.appendChild($el("span", "dw-secname", sp.name || "—"));
    b.appendChild($el("span", "dw-seccyc", String(sp.sec.cycles || 1)));
    b.addEventListener("click", () => openSheet("section:" + sp.id));
    root.appendChild(b);
  }
  headEl = $el("i", "dw-shead");
  root.appendChild(headEl);
}

// the song bar's playhead line — proportional beats, unlike the grid's columns
export function placeHead(beat) {
  if (!headEl) return;
  if (beat == null) { headEl.style.opacity = "0"; return; }
  const total = events().totalBeats || 1;
  headEl.style.opacity = "";
  headEl.style.left = Math.max(0, Math.min(1, beat / total)) * 100 + "%";
}

// ---------- the SECTION SHEET (writes patch.secover) ----------
// Everything here is a RULE over the resolved form: cycles, per-voice on/off,
// and the per-voice pattern from the engine's own tables. "genre's own" =
// dropping the override (editSecover(id, field, null)) — never a copied value.
export function renderSectionSheet(host, ctx) {
  host.textContent = "";
  const section = ctx.section;
  if (!section) { host.appendChild($el("p", "dw-pnote", "this section is no longer in the form — reopen from the song bar.")); return; }
  const sec = section.sec, id = section.id;
  const ov = (SONG.patch.secover || {})[id] || {};
  const box = $el("div", "dw-ed");
  box.appendChild($el("div", "dw-edhead", (section.name || "section") + " — the column's rules"));

  const row = (label) => { const r = $el("div", "dw-edrow"); r.appendChild($el("span", "dw-edlab", label)); box.appendChild(r); return r; };

  // CYCLES — discrete, so chips (2/4/6/8; "own" restores the genre's count)
  const cyc = row("cycles");
  makeChips(cyc, {
    hue: ctx.hue,
    options: [{ id: "own", label: "genre's own" }].concat([2, 4, 6, 8].map((n) => ({ id: String(n), label: String(n) }))),
    value: ov.cycles != null ? String(ov.cycles) : "own",
    onPick: (v) => editSecover(id, "cycles", v === "own" ? null : +v),
  });

  // PER-VOICE on/off + pattern, from the ENGINE vocabulary. The valid sets here
  // mirror song.js sanitizeSecover exactly — anything else would drop silently.
  const voices = [
    { f: "melody", names: (E.MELODY_PATTERNS || []).filter((n) => n !== "off")
        .concat(Object.keys(SONG.patch.melodyCells || {}).filter((n) => n !== "__fit")) },
    { f: "bass", names: (E.BASS_PATTERNS || []).filter((n) => n !== "off") },
    { f: "drums", names: Object.keys(E.KITS || {}).concat(Object.keys(SONG.patch.kits || {})) },
  ];
  for (const v of voices) {
    const r = row(v.f);
    const curName = sec[v.f] && sec[v.f] !== "off" ? sec[v.f] : "off";
    makeChips(r, {
      hue: ctx.hue,
      options: [{ id: "__own", label: "genre's own" }, { id: "off", label: "off" }]
        .concat([...new Set(v.names)].map((n) => ({ id: n, label: n }))),
      value: ov[v.f] != null ? ov[v.f] : "__own",
      onPick: (pick) => editSecover(id, v.f, pick === "__own" ? null : pick),
    });
    r.appendChild($el("span", "dw-edval", "now: " + curName));
  }

  // PADS — a boolean, so two chips
  const pr = row("pads");
  makeChips(pr, {
    hue: ctx.hue,
    options: [{ id: "__own", label: "genre's own" }, { id: "on", label: "on" }, { id: "off", label: "off" }],
    value: ov.pads != null ? (ov.pads ? "on" : "off") : "__own",
    onPick: (pick) => editSecover(id, "pads", pick === "__own" ? null : pick === "on"),
  });

  box.appendChild($el("p", "dw-pnote",
    "these are RULES on the form, not edits to bars — they survive a change of seed or tempo, and \"genre's own\" always drops the override."));
  host.appendChild(box);
}
