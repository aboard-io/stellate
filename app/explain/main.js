// main.js — /spec: an automated spec sheet for any anchor.
//
// The page writes itself. `engine/explain.js` reads the resolved state and
// returns an ordered list of rows; this renders them and attaches a ▶ to the
// five that are LAYERS, each playing the song built up to that point. Scrolling
// down is watching the song assemble — drums, then bass, then pads, then melody,
// then the found layer — and every word on the way is derived from the state.
//
// NO PROSE IS WRITTEN PER GENRE anywhere in this file or in explain.js. That is
// the same law tools/genre/gen-genre-info.js holds for the 274 card blurbs: a
// hand-written sentence beside live data is the thing that rots first. The
// register is flat on purpose — a readout, not an essay.
const X = window.CsdExplain, K = window.GenreKernel, E = window.CsdEngine, KN = window.CsdKnobs;
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let genre = new URLSearchParams(location.search).get("g");
if (!genre || !K.GENRES[genre]) genre = "vaporwave";
let st = null, rows = null, builds = null, handle = null, playing = null;
// THE EDITS. `turn` is the knobs you have moved; `submerge` is the gesture. Both
// are applied to a FRESH resolve, never accumulated onto the last one — the
// difference is the whole reason a double-tap can give the genre's value back
// (the copy-on-write law the rest of this repo runs on).
const turn = {};
const swap = {};          // slot -> instrument id you dialled to
let submerge = 0;
const AXIS = KN.instrumentAxis(K);

function resolve() {
  const t = K.track(genre, { seed: 7 });
  st = JSON.parse(JSON.stringify(t.state || t));
  // gesture first, then the individual knobs — so turning `reverb` after
  // submerging says what you meant rather than being overwritten by it
  KN.SUBMERGE.apply(st, submerge);
  for (const slot in swap) KN.setInstrument(st, slot, swap[slot], K);
  for (const id in turn) if (KN.byId[id]) KN.byId[id].write(st, turn[id]);
  rows = X.sheet(st, E);
  builds = X.buildStates(st);
}

// ---------------------------------------------------------------- the knob
// A fill tile, not a range input: drag anywhere, RELATIVE, double-tap to give
// the value back to the genre. Same gesture as /ca's tempo tile, and the same
// reason — a range thumb is an 8px target that jumps to wherever you touch.
// The dot marks a knob you have moved; without one you cannot tell your 0.4
// from the genre's 0.4.
function knob(k) {
  const el = document.createElement("div");
  el.className = "sp-knob";
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", k.label);
  el.setAttribute("aria-valuemin", String(k.min));
  el.setAttribute("aria-valuemax", String(k.max));
  const fill = document.createElement("i"), lab = document.createElement("b"), val = document.createElement("span");
  el.append(fill, lab, val);
  const fmt = (v) => (k.fmtText ? k.fmtText() : (k.max > 100 ? Math.round(v) : v.toFixed(2)) + k.unit);
  const paint = () => {
    const v = k.read(st), mine = turn[k.id] != null;
    fill.style.width = (100 * (v - k.min) / (k.max - k.min)).toFixed(1) + "%";
    lab.textContent = k.label + (mine ? " ·" : "");
    val.textContent = fmt(v);
    el.classList.toggle("mine", mine);
    el.setAttribute("aria-valuenow", String(Math.round(v * 100) / 100));
    el.setAttribute("aria-valuetext", fmt(v) + (mine ? "" : " (the genre's)"));
  };
  let from = 0, at = 0, drag = false, last = 0;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - last < 320) {
      if (k.id === "submerge") submerge = 0;
      else if (/^(fam|pos):/.test(k.id)) delete swap[k.id.split(":")[1]];
      else delete turn[k.id];
      last = 0; render(); return;
    }
    last = now; from = k.read(st); at = e.clientX; drag = true;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const w = el.getBoundingClientRect().width || 1;
    const nv = KN.clamp(from + (e.clientX - at) / w * (k.max - k.min), k.min, k.max);
    if (k.id === "submerge") submerge = nv;
    else if (k.write.length >= 2 && /^(fam|pos):/.test(k.id)) k.write(st, nv);
    else turn[k.id] = nv;
    resolve(); paint();
  });
  const end = () => { if (drag) { drag = false; render(); } };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", (e) => {
    const step = (k.max - k.min) / (e.shiftKey ? 10 : 50);
    const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
    if (d == null) {
      if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); delete turn[k.id]; render(); }
      return;
    }
    e.preventDefault();
    const nv2 = KN.clamp(k.read(st) + d, k.min, k.max);
    if (k.id === "submerge") submerge = nv2;
    else if (/^(fam|pos):/.test(k.id)) k.write(st, nv2);
    else turn[k.id] = nv2;
    render();
  });
  paint();
  return el;
}

// ------------------------------------------------------------------- render
function render() {
  resolve();
  $("spTitle").textContent = genre;
  $("spKicker").textContent = "anchor · seed 7";
  const clock = rows.find((r) => r.id === "clock");
  $("spSub").textContent = "Every line below is read off the resolved state. "
    + rows.length + " sections, " + clock.value + ", " + (st.sections || []).length + " song sections. "
    + "Each layer plays the song built up to that point.";

  const host = $("spRows");
  host.textContent = "";
  rows.forEach((r, i) => {
    const sec = el("section", "fg-step");
    sec.id = "sp-" + r.id;
    sec.appendChild(el("p", "fg-n", String(i + 1).padStart(2, "0") + " · " + r.title));
    sec.appendChild(el("h2", null, r.value));
    const ul = el("ul", "sp-lines");
    for (const line of r.lines) ul.appendChild(el("li", null, line));
    sec.appendChild(ul);

    const fx = el("div", "fg-effect");
    let anything = false;

    // THE KNOBS THAT DRIVE THIS ROW, under the line that describes them. The row
    // says "88% reverb"; the knob under it is the reverb. That adjacency is the
    // whole reason the sheet stopped being read-only.
    // THE INSTRUMENT DIALS. S was the only part of the genre that did not
      // interpolate; the axis derived from the catalogue's own cutoff assignments
      // turns it into two dials — family, then position, dark to bright. Two
      // knobs where there used to be a coin flip.
      const SLOT = { bass: "bass", melody: "melody", pads: "pad" }[r.id];
      if (SLOT) {
        const cur = KN.instrumentOf(st, SLOT);
        const at = KN.positionOf(AXIS, cur);
        const fams = Object.keys(AXIS).sort();
        if (at) {
          anything = true;
          const box = el("div", "sp-knobs");
          box.appendChild(knob({ id: "fam:" + SLOT, label: SLOT + " family", min: 0, max: fams.length - 1, unit: "",
            fmtText: () => at.family,
            read: () => Math.max(0, fams.indexOf(at.family)),
            write: (_, v) => { const f = fams[KN.clamp(Math.round(v), 0, fams.length - 1)];
              swap[SLOT] = AXIS[f][Math.min(at.index, AXIS[f].length - 1)].id; } }));
          box.appendChild(knob({ id: "pos:" + SLOT, label: SLOT + " · dark → bright", min: 0, max: Math.max(1, at.of - 1), unit: "",
            fmtText: () => cur,
            read: () => at.index,
            write: (_, v) => { const list = AXIS[at.family];
              swap[SLOT] = list[KN.clamp(Math.round(v), 0, list.length - 1)].id; } }));
          fx.appendChild(box);
        }
      }

      const grp = X.ROW_KNOBS[r.id];
    if (grp) {
      const mine = KN.HEADLINE.filter((k) => k.group === grp);
      if (mine.length) {
        anything = true;
        const box = el("div", "sp-knobs");
        for (const k of mine) box.appendChild(knob(k));
        fx.appendChild(box);
      }
    }

    // the form gets its section map — which voices are on, section by section
    if (r.id === "form" && r.data) {
      anything = true;
      const grid = el("div", "sp-form");
      for (const s of r.data.sections) {
        const cell = el("div", "sp-sec");
        cell.appendChild(el("b", null, s.name));
        const dots = el("span", "sp-dots");
        for (const v of ["drums", "bass", "pads", "melody"]) {
          const d = el("i", "sp-dot d-" + v + (s.on.indexOf(v) >= 0 ? " on" : ""));
          d.title = v + (s.on.indexOf(v) >= 0 ? " on" : " off");
          dots.appendChild(d);
        }
        cell.appendChild(dots);
        cell.appendChild(el("em", null, "×" + s.cycles));
        grid.appendChild(cell);
      }
      fx.appendChild(grid);
    }
    if (r.id === "harmony" && r.data) {
      anything = true;
      const c = el("div", "sp-chords");
      for (const name of r.data.chords) c.appendChild(el("b", "sp-chord", name));
      fx.appendChild(c);
    }
    // THE BUILD: the five layer rows each play the song up to themselves
    const k = X.LAYERS.indexOf(r.id);
    if (k >= 0) {
      anything = true;
      const row = el("div", "fg-row");
      // THE BED IS ALWAYS SOUNDING, so the label has to say so. It is not one of the
      // layers (it cannot be muted without silencing the sampled kit), which means
      // the very first ▶ is already bed + drums — calling it "drums" would be the
      // page lying about what you are hearing.
      const bed = (rows.find((x) => x.id === "found").data || {}).placed || [];
      const b = el("button", "fg-play", "▶ " + (bed.length ? "bed + " : "") + builds[k].on.join(" + "));
      b.dataset.layer = String(k);
      row.appendChild(b);
      row.appendChild(el("span", "fg-hint", "the song with the voices after this muted — the found layer stays, it is not separable"));
      fx.appendChild(row);
    }
    if (anything) sec.appendChild(fx);
    host.appendChild(sec);
  });

  for (const b of document.querySelectorAll(".fg-play")) {
    b.dataset.label = b.textContent;
    b.addEventListener("click", () => (playing === b.dataset.layer ? stop() : play(b.dataset.layer)));
  }
  // the gesture, at the top, above everything it moves
  const sub = $("spSubmerge");
  sub.textContent = "";
  sub.appendChild(knob({ id: "submerge", label: "submerge", min: -1, max: 1, unit: "",
    read: () => submerge,
    write: (_, v) => { submerge = KN.clamp(v, -1, 1); } }));
  paintList();
  paintPlay();
}

// -------------------------------------------------------------------- play
async function play(which) {
  stop();
  playing = which;
  paintPlay();
  const s = which === "all" ? st : builds[+which].state;
  $("spRead").textContent = "starting…";
  try {
    handle = await window.FaustLive.exploreLive(() => s, (m) => { $("spRead").textContent = m || ""; },
      { masterVol: 1, onBar: () => { $("spRead").textContent = genre + " · " + (which === "all" ? "everything" : builds[+which].on.join("+")); }, onLoad: () => {} });
  } catch (e) { playing = null; paintPlay(); $("spRead").textContent = "live failed"; }
}
function stop() {
  try { if (handle && handle.stop) handle.stop(); } catch (e) {}
  handle = null; playing = null; $("spRead").textContent = ""; paintPlay();
}
function paintPlay() {
  for (const b of document.querySelectorAll(".fg-play")) {
    const on = playing === b.dataset.layer;
    b.classList.toggle("on", on);
    b.textContent = on ? "■ stop" : b.dataset.label;
  }
}

// ------------------------------------------------------------------ picker
const ALL = Object.keys(K.GENRES).sort();
function paintList() {
  const q = $("spFind").value.trim().toLowerCase();
  const hits = (q ? ALL.filter((g) => g.indexOf(q) >= 0) : ALL).slice(0, 40);
  const host = $("spList");
  host.textContent = "";
  for (const g of hits) {
    const b = el("button", "sp-row" + (g === genre ? " on" : ""), g);
    b.type = "button";
    b.setAttribute("role", "option");
    b.appendChild(el("em", null, Math.round(K.GENRES[g].bpm || 0) + " bpm"));
    b.addEventListener("click", () => {
      stop(); genre = g;
      try { history.replaceState(null, "", "?g=" + g); } catch (e) {}
      render(); window.scrollTo({ top: 0 });
    });
    host.appendChild(b);
  }
}
$("spFind").addEventListener("input", paintList);
$("spStop").addEventListener("click", stop);
$("spLink").addEventListener("click", async (e) => {
  const btn = e.currentTarget, was = btn.textContent;
  try { await navigator.clipboard.writeText(location.href); btn.textContent = "✓"; } catch (err) { btn.textContent = "⌘C"; }
  setTimeout(() => { btn.textContent = was; }, 1200);
});

render();
window.__SPEC = { genre: () => genre, turn, swap, axis: AXIS, submerge: () => submerge, knobs: KN, rows: () => rows, builds: () => builds, sheet: () => X.sheet(st, E),
  set: (g) => { genre = g; render(); }, play, stop, isPlaying: () => !!playing,
  rms: () => { try { return handle && handle.rms ? handle.rms() : null; } catch (e) { return null; } }, ready: true };
