// structure.js — the SONG bar + the section sheet.
//
// The bar is the form made tappable: one chip per section, WIDTH PROPORTIONAL
// to its true beat share (the grid's columns are equal-width for legibility;
// the bar tells the truth about time — the spec's split). The cycles count is
// printed on the chip. Tap a chip → the SECTION SHEET, the surface that writes
// patch.secover: deterministic rules over the resolved form, never diffs. That
// is what makes the grid's cells editable per column.
//
// THE SECTION SHEET IS A RULES TABLE. It used to be three walls of lozenges —
// ~20 melody patterns + ~20 bass patterns + 22 kits, wrapped ragged and centred,
// repeated for every one of eight sections. Nothing to scan along, and the
// value in force was a highlighted pill you had to hunt for. Now it is FIVE
// ROWS — cycles, melody, bass, drums, pads — with columns [rule, now, yours], so
// what the section plays and what YOU said are two aligned columns you read
// down. Each row drills into its own picker view (sheet.js pickerView): a place
// you go, which is what kills the wall. Every picker's first row is "genre's
// own" — dropping the override (editSecover(id, field, null)) — never a copied
// value, and the vocabulary is always the ENGINE's own (E.MELODY_PATTERNS /
// E.BASS_PATTERNS / E.KITS) plus whatever cells and kits THIS patch carries,
// mirroring song.js sanitizeSecover exactly so nothing offered can drop silently.
import { subs, sectionSpans, SONG, editSecover, events } from "./song.js";
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
// and the per-voice pattern from the engine's own tables.

// how many hits a kit lays down per cycle — counted off the ENGINE's own table
// (explicit hits plus a grid op's step count), never a list this file keeps.
// Nearly every kit is kick·snare·hat, so naming the voices tells kits apart not
// at all; the DENSITY does, and it spans 4 (kick) to 31 (techno).
function kitDensity(name) {
  const k = (E.KITS || {})[name];
  const ops = (k && k.ops) || (Array.isArray(k) ? k : []);
  let n = 0;
  for (const op of ops) n += ((op && op.hits && op.hits.length) || 0) + ((op && op.grid && op.grid.n) || 0);
  return n ? n + " hits" : "";
}

// the engine vocabulary each voice may be set to, tagged by where it came from
// (patterns THIS patch drew are as playable as the engine's own — sanitizeSecover
// validates against the patch the name travels with, so the table offers both).
function vocabOf(field) {
  const own = [];
  let names = [];
  if (field === "melody") {
    names = (E.MELODY_PATTERNS || []).filter((n) => n !== "off");
    for (const n of Object.keys(SONG.patch.melodyCells || {})) if (n !== "__fit") own.push(n);
  } else if (field === "bass") {
    names = (E.BASS_PATTERNS || []).filter((n) => n !== "off");
  } else {
    names = Object.keys(E.KITS || {});
    for (const n of Object.keys(SONG.patch.kits || {})) own.push(n);
  }
  const meta = field === "drums" ? kitDensity : () => "";
  const seen = new Set();
  const rows = [];
  for (const n of names) { if (seen.has(n)) continue; seen.add(n); rows.push({ id: n, cells: [n, meta(n)] }); }
  for (const n of own) { if (seen.has(n)) continue; seen.add(n); rows.push({ id: n, cells: [n, "yours"] }); }
  return rows;
}

const nowName = (sec, f) => (sec[f] && sec[f] !== "off" ? sec[f] : "off");

// one drill-in per rule. Each picker commits through editSecover and pops back
// to the rules table, where the "now" and "yours" columns have already moved.
function pickPattern(ctx, id, sec, field) {
  const what = field === "drums" ? "kit" : "pattern";
  const rows = vocabOf(field);
  ctx.picker({
    title: field, hue: ctx.hue, label: field + " " + what,
    note: "the " + what + " this section plays — \"genre's own\" hands it back to the genre.",
    columns: [{ id: "name", label: what },
              { id: "meta", label: field === "drums" ? "hits" : "", align: "right", w: "12ch" }],
    rows: [{ id: "__own", cells: ["genre's own", nowName(sec, field)], title: "drop the override — the genre decides" },
           { id: "off", cells: ["off", "silence"], title: "this voice sits out the section" }].concat(rows),
    filter: rows.length > 14,
    value: () => { const o = (SONG.patch.secover || {})[id] || {}; return o[field] != null ? o[field] : "__own"; },
    onPick: (pick) => editSecover(id, field, pick === "__own" ? null : pick),
  });
}

function pickCycles(ctx, id, section) {
  const sec = section.sec;
  const per = Math.max(1, Math.round(section.beats / Math.max(1, sec.cycles || 1)));
  ctx.picker({
    title: "cycles", hue: ctx.hue, label: "cycles",
    note: "how many times the chord cycle turns before the next section — the column's width in time.",
    columns: [{ id: "n", label: "cycles" }, { id: "beats", label: "beats", align: "right", w: "8ch" }],
    rows: [{ id: "own", cells: ["genre's own", String(section.beats)], title: "drop the override — the genre decides" }]
      .concat([1, 2, 3, 4, 6, 8].map((n) => ({ id: String(n), cells: [String(n), String(n * per)] }))),
    filter: false,
    value: () => { const o = (SONG.patch.secover || {})[id] || {}; return o.cycles != null ? String(o.cycles) : "own"; },
    onPick: (v) => editSecover(id, "cycles", v === "own" ? null : +v),
  });
}

function pickPads(ctx, id, sec) {
  ctx.picker({
    title: "pads", hue: ctx.hue, label: "pads",
    note: "the chord bed under this section.",
    columns: [{ id: "n", label: "pads" }, { id: "what", label: "", align: "right", w: "9ch" }],
    rows: [{ id: "__own", cells: ["genre's own", sec.pads === false ? "off" : "on"], title: "drop the override — the genre decides" },
           { id: "on", cells: ["on", "chords play"] },
           { id: "off", cells: ["off", "no bed"] }],
    filter: false,
    value: () => { const o = (SONG.patch.secover || {})[id] || {}; return o.pads != null ? (o.pads ? "on" : "off") : "__own"; },
    onPick: (pick) => editSecover(id, "pads", pick === "__own" ? null : pick === "on"),
  });
}

export function renderSectionSheet(host, ctx) {
  host.textContent = "";
  const section = ctx.section;
  if (!section) { host.appendChild($el("p", "dw-pnote", "this section is no longer in the form — reopen from the song bar.")); return; }
  const sec = section.sec, id = section.id;
  const ov = (SONG.patch.secover || {})[id] || {};
  const box = $el("div", "dw-ed");
  box.appendChild($el("div", "dw-edhead", (section.name || "section") + " — the column's rules"));

  // the five rules, as rows. "now" is what the section RESOLVES to (genre plus
  // whatever you said); "yours" is the override alone, an em dash when there is
  // none — so the two columns read as "playing" against "asked for".
  const RULES = [
    { id: "cycles", now: String(sec.cycles || 1), yours: ov.cycles != null ? String(ov.cycles) : "—",
      open: () => pickCycles(ctx, id, section) },
    { id: "melody", now: nowName(sec, "melody"), yours: ov.melody != null ? ov.melody : "—",
      open: () => pickPattern(ctx, id, sec, "melody") },
    { id: "bass", now: nowName(sec, "bass"), yours: ov.bass != null ? ov.bass : "—",
      open: () => pickPattern(ctx, id, sec, "bass") },
    { id: "drums", now: nowName(sec, "drums"), yours: ov.drums != null ? ov.drums : "—",
      open: () => pickPattern(ctx, id, sec, "drums") },
    { id: "pads", now: sec.pads === false ? "off" : "on",
      yours: ov.pads != null ? (ov.pads ? "on" : "off") : "—", open: () => pickPads(ctx, id, sec) },
  ];
  ctx.controls.makeTable(box, {
    hue: ctx.hue, label: "section rules", filter: false, max: 0, value: null,
    columns: [{ id: "rule", label: "rule" }, { id: "now", label: "now" },
              { id: "yours", label: "yours", align: "right" }, { id: "go", label: "", align: "right", w: 16 }],
    rows: RULES.map((r) => ({ id: r.id, cells: [r.id, r.now, r.yours, "›"],
      title: "choose the " + r.id + " rule for this section" })),
    onPick: (rid) => { const r = RULES.find((x) => x.id === rid); if (r) r.open(); },
  });

  box.appendChild($el("p", "dw-pnote",
    "these are RULES on the form, not edits to bars — they survive a change of seed or tempo, and \"genre's own\" always drops the override."));
  host.appendChild(box);
}
