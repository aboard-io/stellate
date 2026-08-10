// editors/sound.js — the SHARED SOUND tab for melody / bass / pad / drums.
//
// Three blocks, per the DAW-GRID spec "sound tab":
//   INSTRUMENT (melody/bass/pad only): a search-less TWO-LEVEL pick over the
//     sampled library — family chips → instrument chips over Object.keys
//     (K.SAMPLERS), grouped by the kernel's OWN instrFamily table (never a list
//     this file maintains by hand). First chip = "genre's own": the ABSENCE of
//     an override, ctx.song.editSound(voice, null). Picking an instrument
//     writes SONG.patch.sound; song.js applySound performs the kernel-mirrored
//     pitched→sampler rewrite (K.SAMPLERS-validated), so the change repaints
//     that row only and is audible next bar.
//   MIX: tiles from layers.js TILE_SETS.voice (level/tone/bite/attack/width/
//     space/echo) — TILE_SETS.drums for the drums voice — reading readLayer/
//     fmtLayer, writing ctx.song.editLayer(voice, axis, v01). One number per
//     axis, URL-compatible; double-tap = drop the entry, back to stock.
//   FX: READ-ONLY facts of the voice's real effect chain — unit.fxLabels off
//     FaustStateEngine.voiceUnits, the same metadata the roster prints. No
//     insert editor (the vocabulary survey is out of scope; facts only).
//
// Contract: export render(host, ctx) — ctx per app/daw/sheet.js header.
// mixTiles is EXPORTED so a sibling editor (drums.js hosts the same mixer
// surface) can reuse it instead of re-deriving the tile wiring.
import { readLayer, fmtLayer, TILE_SETS } from "../layers.js";

const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };
const K = () => window.GenreKernel;

// ---------- the family table (derived from the kernel, ordered for humans) ----------
const FAM_ORDER = ["key", "pluck", "bass", "organ", "string", "brass", "reed", "flute", "mallet", "voice", "lead"];
const FAM_LABEL = { key: "keys", pluck: "guitar + pluck", bass: "bass", organ: "organ",
  string: "strings", brass: "brass", reed: "reed", flute: "flute", mallet: "mallet",
  voice: "voice", lead: "synth + pad" };
let FAMS = null;   // [{id, label, instruments:[samplerId]}] — built once per load
function families() {
  if (FAMS) return FAMS;
  const k = K(), by = {};
  for (const id of Object.keys(k.SAMPLERS || {})) {
    const f = (k.instrFamily && k.instrFamily(id)) || "lead";
    (by[f] = by[f] || []).push(id);
  }
  const order = FAM_ORDER.concat(Object.keys(by).filter((f) => FAM_ORDER.indexOf(f) < 0).sort());
  FAMS = order.filter((f) => by[f]).map((f) => ({ id: f, label: FAM_LABEL[f] || f, instruments: by[f] }));
  return FAMS;
}
const famOf = (id) => { const k = K(); return (k.instrFamily && k.instrFamily(id)) || "lead"; };
// chip label: the registry label minus the license parenthetical ("Alto Sax")
const nice = (id) => {
  const S = (K().SAMPLERS || {})[id];
  return ((S && S.label) || id).replace(/\s*\([^)]*\)\s*$/, "");
};

// ---------- MIX tiles (EXPORTED — drums.js reuses this exact surface) ----------
// mixTiles(host, ctx, layer, set?) — one tile per axis in `set` (default: the
// layer's own TILE_SETS row), reading the RESOLVED state through layers.js and
// writing patch.layers via song.js editLayer. Stock = no patch entry (the
// tile-dot law); the header echoes "level · 47%" while dragging.
export function mixTiles(host, ctx, layer, set) {
  const axes = set || (layer === "drums" ? TILE_SETS.drums : TILE_SETS.voice);
  const wrap = el("div", "dw-tiles");
  host.appendChild(wrap);
  const stockOf = (axis) => ((ctx.song.SONG.patch.layers || {})[layer] || {})[axis] == null;
  for (const t of axes) {
    ctx.controls.makeTile(wrap, {
      label: t.label, unit: "", hue: ctx.hue,
      read: () => {
        const v = readLayer(ctx.song.state(), layer, t.id);
        return { v, txt: fmtLayer(layer, t.id, v), stock: stockOf(t.id) };
      },
      write: (v01) => ctx.song.editLayer(layer, t.id, v01),
      revert: () => { ctx.song.editLayer(layer, t.id, null); ctx.setEcho(""); },
      onDrag: (v01, txt) => ctx.setEcho(t.label + " · " + (txt || Math.round(v01 * 100) + "%")),
    });
  }
  // the echo is a drag readout — clear it when the finger lifts (after the
  // tile's own rAF-throttled preview has had its last word)
  const clear = () => requestAnimationFrame(() => requestAnimationFrame(() => ctx.setEcho("")));
  wrap.addEventListener("pointerup", clear, true);
  wrap.addEventListener("pointercancel", clear, true);
  return wrap;
}

// ---------- FX facts (read-only) ----------
// The voice's REAL chain, as the engine will play it: unit.fxLabels from
// state-engine's voiceUnits — sampler channel strip + declared inserts + sends,
// the same metadata-only summary the genre roster prints. Falls back to the
// recipe's declared insert types if the unit table is unavailable.
function fxLines(voice, st) {
  try {
    const SE = window.FaustStateEngine, E = window.CsdEngine;
    if (SE && SE.voiceUnits) {
      const units = SE.voiceUnits(E, st);
      if (voice === "drums") {
        const out = [];
        for (const k of ["kick", "snare", "hat", "tom"]) {
          const u = units[k];
          if (u && u.fxLabels && u.fxLabels.length) out.push([k, u.fxLabels.join(" · ")]);
        }
        return out;
      }
      const u = units[voice];
      if (u && u.fxLabels) return [["chain", u.fxLabels.length ? u.fxLabels.join(" · ") : "dry"]];
    }
  } catch (e) { /* facts, not a gate — fall through to the recipe read */ }
  const I = (st.instruments || {})[voice] || {};
  const ins = (I.inserts || []).map((i) => i && i.type).filter(Boolean);
  return [["chain", ins.length ? ins.join(" · ") : "dry"]];
}

// ---------- the tab ----------
export function render(host, ctx) {
  host.textContent = "";
  const voice = (ctx.track && ctx.track.id) || "melody";
  const isDrums = voice === "drums";
  const box = el("div", "dw-ed");
  host.appendChild(box);

  // ----- INSTRUMENT (the two-level pick; not for drums — the kit is the PART tab's) -----
  let headVal = null, badge = null, factsDl = null;
  const sync = () => {   // update-in-place after a pick (the body is never re-rendered per edit)
    const st = ctx.song.state();
    if (headVal) {
      const I = (st.instruments || {})[voice] || {};
      headVal.textContent = "playing: " + ((I.sampler && I.sampler.id) ? nice(I.sampler.id) : (I.model || "?"));
    }
    if (badge) {
      const ov = (ctx.song.SONG.patch.sound || {})[voice];
      badge.textContent = ov ? "yours" : "genre's own";
    }
    if (factsDl) paintFacts(factsDl, st);
  };

  if (!isDrums) {
    box.appendChild(el("div", "dw-edhead", voice + " — instrument"));
    const head = el("div", "dw-edrow");
    headVal = el("span", "dw-edval", "");
    badge = el("span", "dw-badge", "");
    head.append(headVal, badge);
    box.appendChild(head);

    const ov = (ctx.song.SONG.patch.sound || {})[voice];
    const famRow = el("div", "dw-edrow");
    famRow.appendChild(el("span", "dw-edlab", "family"));
    box.appendChild(famRow);
    const instRow = el("div", "dw-edrow");
    box.appendChild(instRow);

    // second level: the family's instrument chips. Rebuilt on family pick;
    // value = the current override when it lives in this family.
    const paintInst = (famId) => {
      instRow.textContent = "";
      if (!famId || famId === "__own") return;
      const fam = families().find((f) => f.id === famId);
      if (!fam) return;
      instRow.appendChild(el("span", "dw-edlab", fam.label));
      const cur = (ctx.song.SONG.patch.sound || {})[voice];
      ctx.controls.makeChips(instRow, {
        hue: ctx.hue,
        options: fam.instruments.map((id) => ({ id, label: nice(id), title: (K().SAMPLERS[id] || {}).label })),
        value: cur && fam.instruments.indexOf(cur.instrument) >= 0 ? cur.instrument : null,
        onPick: (id) => { ctx.song.editSound(voice, id); sync(); },
      });
    };

    const famChips = ctx.controls.makeChips(famRow, {
      hue: ctx.hue,
      options: [{ id: "__own", label: "genre's own", title: "drop the override — back to what the genre picked" }]
        .concat(families().map((f) => ({ id: f.id, label: f.label }))),
      value: ov ? famOf(ov.instrument) : "__own",
      onPick: (famId) => {
        if (famId === "__own") { ctx.song.editSound(voice, null); paintInst(null); sync(); return; }
        paintInst(famId);   // browsing a family writes nothing — the instrument chip does
      },
    });
    if (ov) paintInst(famOf(ov.instrument));
    box.appendChild(el("p", "dw-pnote",
      "picking a family just opens its shelf — the instrument chip is the edit. “genre's own” drops your pick and the kernel chooses again."));
    void famChips;
  } else {
    box.appendChild(el("div", "dw-edhead", "drums — sound"));
  }

  // ----- MIX -----
  box.appendChild(el("div", "dw-edhead", "mix"));
  mixTiles(box, ctx, voice);
  box.appendChild(el("p", "dw-pnote",
    "drag anywhere on a tile — relative, slow is fine trim. double-tap reverts to stock (the dot marks yours)."));

  // ----- FX (facts, not an editor) -----
  box.appendChild(el("div", "dw-edhead", "fx"));
  factsDl = el("dl", "dw-facts");
  box.appendChild(factsDl);
  box.appendChild(el("p", "dw-pnote",
    "the chain as the engine plays it — the genre's own inserts and channel strip. space and echo above are your sends into it."));

  function paintFacts(dl, st) {
    dl.textContent = "";
    for (const [k, v] of fxLines(voice, st)) {
      dl.appendChild(el("dt", null, k));
      dl.appendChild(el("dd", null, v));
    }
  }
  sync();
}
