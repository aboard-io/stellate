// panel.js — the MACHINE PANEL: open a track, see the machine that writes it.
//
// One panel shell, dispatching per track kind. The drums panel is the first real
// one because the engine's kit op grammar is already a variation language, so the
// panel is a UI over shipped data rather than a new system (machines/drums.js).
// The pitched tracks show a read-only machine summary until their own machines
// land (melodyGen -> melodyCells -> melodyWeave, then the bass op table).
//
// Every control writes through song.js edit(), which invalidates the build and
// repaints. Because state.voiceStreams is on, moving a probability slider here
// changes THIS lane and leaves the neighbouring rolls pixel-identical — which is
// the visible proof the rack law works, and the reason these sliders are safe to
// expose at all (every one of them changes a draw count).
import { SONG, state, trackMachines } from "./song.js";
import * as DRUMS from "./machines/drums.js";

const open = new Set();          // track ids whose panel is open
export const isOpen = (id) => open.has(id);
export function toggle(id) { open.has(id) ? open.delete(id) : open.add(id); }

const el = (tag, cls, txt) => { const d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; };

export function renderPanel(host, track) {
  host.textContent = "";
  if (!open.has(track.id)) { host.hidden = true; return; }
  host.hidden = false;
  if (track.kind === "drums") return drumsPanel(host);
  return readOnlyPanel(host, track);
}

// ---------- the kit machine ----------
function drumsPanel(host) {
  const kits = DRUMS.activeKits();
  if (!kits.length) { host.appendChild(el("p", "dw-pnote", "This song's form never turns the drums on.")); return; }

  for (const name of kits) {
    const kit = DRUMS.kitOf(name);
    const box = el("div", "dw-kit");
    const head = el("div", "dw-kithead");
    head.appendChild(el("span", "dw-kitname", name));
    if (DRUMS.isEdited(name)) {
      head.appendChild(el("span", "dw-badge", "edited"));
      const rev = el("button", "dw-mini", "revert");
      rev.title = "drop this song's override and play the stock kit again";
      rev.addEventListener("click", () => DRUMS.revert(name));
      head.appendChild(rev);
    }
    box.appendChild(head);

    if (!kit || !kit.ops || !kit.ops.length) {
      box.appendChild(el("p", "dw-pnote", "No ops — this kit is silence."));
      host.appendChild(box); continue;
    }

    for (let i = 0; i < kit.ops.length; i++) {
      const op = kit.ops[i], d = DRUMS.describeOp(op);
      const row = el("div", "dw-op");
      row.appendChild(el("span", "dw-oplane", d.lane));
      row.appendChild(el("span", "dw-opshape", d.shape));

      // PERIOD — the cycle-position rule (hits / alt / cyc / last)
      const per = document.createElement("select");
      per.className = "dw-opsel";
      per.disabled = !d.editable || !!op.grid;
      for (const p of [["hits", "every bar"], ["alt", "A / B"], ["cyc", "cycle of 4"], ["last", "last bar"]]) {
        const o = document.createElement("option"); o.value = p[0]; o.textContent = p[1];
        per.appendChild(o);
      }
      per.value = DRUMS.periodOf(op);
      per.title = "how this lane varies across the chord bars of a cycle";
      per.addEventListener("change", (e) => DRUMS.setPeriod(name, i, e.target.value));
      row.appendChild(per);

      // PROBABILITY — `p` (one draw per op) or `grid.sp` (one draw per step)
      const prob = DRUMS.probOf(op);
      const sl = document.createElement("input");
      sl.type = "range"; sl.min = "0"; sl.max = "1"; sl.step = "0.05";
      sl.value = String(prob); sl.className = "dw-opslider";
      sl.disabled = !d.editable;
      sl.title = op.grid ? "per-step chance this grid lane fires (grid.sp)" : "chance this whole op fires each bar (p)";
      sl.setAttribute("aria-label", `${d.lane} probability`);
      const val = el("span", "dw-opval", prob >= 0.999 ? "always" : Math.round(prob * 100) + "%");
      sl.addEventListener("input", (e) => { const v = +e.target.value; val.textContent = v >= 0.999 ? "always" : Math.round(v * 100) + "%"; });
      sl.addEventListener("change", (e) => DRUMS.setProb(name, i, +e.target.value));
      row.appendChild(sl); row.appendChild(val);

      box.appendChild(row);
    }
    host.appendChild(box);
  }
  host.appendChild(el("p", "dw-pnote",
    "Probability and period are RULES, not edits to a bar — they survive a change of seed, tempo or form. " +
    "Moving one lane leaves the other rolls untouched (state.voiceStreams)."));
}

// ---------- read-only, until each machine lands ----------
function readOnlyPanel(host, track) {
  const s = state(), machines = trackMachines(track);
  const box = el("div", "dw-kit");
  box.appendChild(el("div", "dw-kithead", machines.length ? machines.join(" → ") : "off"));
  const dl = el("dl", "dw-facts");
  const fact = (k, v) => { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, String(v))); };
  fact("voice", track.id);
  if (track.id === "melody") {
    fact("chord bar", (s.chordEvery || (s.meter ? 6 : 8)) + " beats");
    fact("reharm", s.theory && s.theory.reharm ? "on (adventure " + (s.theory.adventure ?? "—") + ")" : "off");
    fact("tables", (s.theory && s.theory.tables) || "hand");
  }
  if (track.id === "bass") fact("rhythm complexity", s.rhythm ? (s.rhythm.complexity ?? 0) : "—");
  if (track.id === "pad") fact("strum", s.strum ? (typeof s.strum === "string" ? s.strum : s.strum.pattern) : "off");
  fact("time feel", `swing ${s.swing ?? 0} · humanize ${s.humanize ?? 0}`);
  fact("pipes", (s.pipes || []).map((p) => p.id).join(", ") || "none");
  box.appendChild(dl);
  host.appendChild(box);
  host.appendChild(el("p", "dw-pnote",
    "Read-only for now. This track's machines are next in docs/DAW.md — " +
    (track.id === "bass"
      ? "the bass cells are still a switch over 23 procedural cases; they get the same op-table treatment the kits already had."
      : "melodyGen (the walk's knobs), then melodyCells (draw phrases), then melodyWeave (paint the Markov table).")));
}
