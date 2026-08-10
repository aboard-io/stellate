// editors/pad.js — the pad PART tab: strum/pattern facts + pointer to SOUND.
//
// The pad is mostly a SOUND (the spec's words): its generator has almost no
// per-part surface — chords voice it, sections gate it, strum articulates it.
// So this tab is an honest FACTS read of the resolved state (never a control
// wired to nothing) plus the one action that matters: go to the SOUND tab,
// where the instrument picker and mixer tiles live (editors/sound.js).
//
// Contract: export render(host, ctx) — ctx per app/daw/sheet.js header.
// (Tab switching rides ctx.setTab — no import of sheet.js, no module cycle.)

const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

// the same label rule as editors/sound.js: registry label minus the license tail
const nice = (id) => {
  const K = window.GenreKernel, S = (K && K.SAMPLERS || {})[id];
  return ((S && S.label) || id).replace(/\s*\([^)]*\)\s*$/, "");
};

export function render(host, ctx) {
  host.textContent = "";
  const box = el("div", "dw-ed");
  box.appendChild(el("div", "dw-edhead", "pad — the bed under everything"));
  const s = ctx.song.state();

  // ----- facts, all read off the RESOLVED state (secover already applied) -----
  const I = (s.instruments || {}).pad || {};
  const instName = (I.sampler && I.sampler.id) ? nice(I.sampler.id) : (I.model || "?");
  const yours = !!((ctx.song.SONG.patch.sound || {}).pad);

  const strum = s.strum
    ? (typeof s.strum === "string" ? s.strum
       : (s.strum.pattern || "on") + (s.strum.spread != null ? " · spread " + s.strum.spread : ""))
    : "off";

  const secs = s.sections || [];
  const onSecs = secs.filter((x) => x.pads);
  const voiced = onSecs.length
    ? onSecs.length + " of " + secs.length + " (" + onSecs.map((x) => x.name || "—").join(", ") + ")"
    : "none — this form never voices the pad";

  const dl = el("dl", "dw-facts");
  const fact = (k, v) => { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, v)); };
  fact("instrument", instName + (yours ? " — yours" : " — the genre's own pick"));
  fact("strum", strum);
  fact("voiced in", voiced);
  fact("chord rate", "every " + Math.max(2, Math.round(s.chordEvery || (s.meter ? 6 : 8))) + " beats (the chords track owns it)");
  if (s.padDouble) fact("wall", "doubled an octave down (wall of sound)");
  box.appendChild(dl);

  box.appendChild(el("p", "dw-pnote",
    "the pad plays whatever the chords decide, wherever the sections allow it — "
    + "there is no phrase to author here. its VOICE is the whole instrument: "
    + "pick it, mix it and hear its chain on the sound tab."));

  // the pointer — a real chip that switches this sheet's tab
  const row = el("div", "dw-edrow");
  const chips = el("div", "dw-chips");
  chips.style.setProperty("--hue", ctx.hue);
  const go = el("button", "dw-chip", "open the sound tab →");
  go.type = "button";
  go.addEventListener("click", () => ctx.setTab("sound"));
  chips.appendChild(go);
  row.appendChild(chips);
  box.appendChild(row);

  host.appendChild(box);
}
