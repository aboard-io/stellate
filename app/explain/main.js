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
const X = window.CsdExplain, K = window.GenreKernel, E = window.CsdEngine;
const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

let genre = new URLSearchParams(location.search).get("g");
if (!genre || !K.GENRES[genre]) genre = "vaporwave";
let st = null, rows = null, builds = null, handle = null, playing = null;

function resolve() {
  const t = K.track(genre, { seed: 7 });
  st = JSON.parse(JSON.stringify(t.state || t));
  rows = X.sheet(st, E);
  builds = X.buildStates(st);
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
window.__SPEC = { genre: () => genre, rows: () => rows, builds: () => builds, sheet: () => X.sheet(st, E),
  set: (g) => { genre = g; render(); }, play, stop, isPlaying: () => !!playing,
  rms: () => { try { return handle && handle.rms ? handle.rms() : null; } catch (e) { return null; } }, ready: true };
