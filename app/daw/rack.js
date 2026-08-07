// rack.js — the RACK: one row per track, machine strip LEFT, that machine's own
// piano roll RIGHT (docs/DAW.md "The track strip").
//
// Rows are built ONCE and then repainted, because the roll is a canvas: a knob turn
// redraws pixels and rewrites a few strings, it never rebuilds the DOM. That is
// what makes per-track live preview affordable at a keystroke.
//
// The strip is READ-ONLY in this stage — it shows which machine a track is running
// and what the roll is made of. The editable machine panels (kit op grammar,
// melody cells/weave, bass cells) are the next stage; this proves the plumbing
// first, so a broken panel can never be confused with a broken read.
import { trackEvents, trackMachines, sectionSpans, events, state } from "./song.js";
import { drawRoll } from "./roll.js";

// The tracks, in score order (pad under, melody over) — the order a rack reads.
// `hue` is the row's identity colour, carried into the roll so a glance tells you
// whose notes those are without reading the label.
export const TRACKS = [
  { id: "melody",  label: "Melody",  kind: "pitched", hue: 190 },
  { id: "counter", label: "Counter", kind: "pitched", hue: 210, optional: true },
  { id: "pad",     label: "Pad",     kind: "pitched", hue: 280 },
  { id: "bass",    label: "Bass",    kind: "pitched", hue: 330 },
  { id: "drums",   label: "Drums",   kind: "drums",   hue: 45 },
];

const rows = new Map();   // track id -> {el, canvas, machineEl, countEl}

export function buildRack(root) {
  root.textContent = "";
  rows.clear();

  const ruler = document.createElement("div");
  ruler.className = "dw-ruler";
  ruler.innerHTML = '<div class="dw-strip dw-strip-head">form</div><div class="dw-spans" id="dwSpans"></div>';
  root.appendChild(ruler);

  for (const t of TRACKS) {
    const row = document.createElement("section");
    row.className = "dw-row";
    row.dataset.track = t.id;
    row.style.setProperty("--hue", t.hue);

    const strip = document.createElement("div");
    strip.className = "dw-strip";
    strip.innerHTML =
      '<div class="dw-name">' + t.label + "</div>" +
      '<div class="dw-machine"></div>' +
      '<div class="dw-count"></div>';

    const wrap = document.createElement("div");
    wrap.className = "dw-rollwrap";
    const cv = document.createElement("canvas");
    cv.className = "dw-roll";
    cv.setAttribute("role", "img");
    wrap.appendChild(cv);

    row.appendChild(strip); row.appendChild(wrap);
    root.appendChild(row);
    rows.set(t.id, { el: row, cv, machineEl: strip.querySelector(".dw-machine"), countEl: strip.querySelector(".dw-count") });
  }
  return root;
}

export function paintRack() {
  const ev = events(), spans = sectionSpans(), total = ev.totalBeats || 1;

  // the form ruler — section names across the top, at their real beat positions
  const sp = document.getElementById("dwSpans");
  if (sp) {
    sp.textContent = "";
    for (const s of spans) {
      const d = document.createElement("span");
      d.className = "dw-span";
      d.style.left = (s.start / total * 100) + "%";
      d.style.width = (s.beats / total * 100) + "%";
      d.textContent = s.name;
      d.title = `${s.name} — ${s.beats} beats`;
      sp.appendChild(d);
    }
  }

  for (const t of TRACKS) {
    const r = rows.get(t.id);
    if (!r) continue;
    const evs = trackEvents(t);
    const machines = trackMachines(t);
    // a track the form never turns on is DIMMED, not hidden: an empty row is
    // information (this song has no countermelody), a missing row is a mystery
    r.el.classList.toggle("dw-off", !evs.length);
    r.machineEl.textContent = machines.length ? machines.join(" → ") : "off";
    r.machineEl.title = machines.length > 1 ? "this voice changes machine across the form" : "";
    r.countEl.textContent = evs.length ? evs.length + " notes" : "";
    r.cv.setAttribute("aria-label", `${t.label}: ${evs.length} notes, ${machines.join(", ") || "off"}`);
    drawRoll(r.cv, evs, { totalBeats: total, spans, kind: t.kind, hue: t.hue });
  }

  const s = state();
  const read = document.getElementById("dwRead");
  if (read) read.textContent = `${Math.round(s.bpm)} bpm · ${spans.length} sections · ${Math.round(total)} beats · ${ev.pitched.length + ev.drums.length} events`;
}

// repaint on resize: the roll is width-scaled, so a window drag must redraw or
// every note lands at the wrong beat
let rz = 0;
export function watchResize() {
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(paintRack, 120); });
}
