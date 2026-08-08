// machines/drums.js — THE KIT MACHINE: a panel over the engine's own op grammar.
//
// This is not a new variation system. csd-engine.js turned the kits into DATA
// (the KITS table) with a vocabulary that is already exactly what a rack panel
// wants — variation authored as a RULE over cycle position and probability:
//
//   hits:[[off,amp,dur?]]  static hits
//   alt:[A,B]              ci odd ? A : B                 — cycle alternation
//   cyc:[...]              picked by ci % length           — longer periods
//   last:[A,B]             last chord of the cycle ? A : B — form-aware
//   pick:[A,B]             ONE rng draw chooses A or B
//   p:X                    whole-op gate: one draw, emit only if r<X
//   grid:{n,step,from,amps,opens,open,sp}                  — lane grid; sp gates each step
//   ride:{n,amps,skipAmp}  the shuffle pair-loop
//   skip:true              every offset adds the triplet skip
//
// So the panel edits the SAME data the 22 shipped kits are written in, and the
// edit lands in state.kits, which drumEvents consults before the built-in table.
// A user kit is ordinary vocabulary, not a special case — that is the whole
// payoff of the kits having become data.
//
// WHAT IS EDITABLE HERE (stage 4): the two dials that make a kit breathe without
// asking anyone to type an op — per-op PROBABILITY (`p`, and `grid.sp` for a
// stepped lane) and the cycle PERIOD (static / alt / cyc / last). Authoring raw
// hit lists is a later stage; these two are what turn a fixed loop into a
// generator, and they are the ones that need the rack law to be safe to touch
// (every slider changes a draw count).
import { SONG, edit, state } from "../song.js";

const E = window.CsdEngine;
const LANES = { kick: "Kick", snare: "Snare", hat: "Hat" };

// The kit a track is running right now, resolved the way drumEvents resolves it:
// the song's own kits first, then the stock table.
export function kitOf(name) {
  const k = (SONG.patch.kits && SONG.patch.kits[name]) || (E.KITS && E.KITS[name]);
  return k || null;
}
// A kit counts as EDITED either way it can be touched: a whole-kit override in
// patch.kits (the period selector writes one) or a per-op probability on the drums
// RING, which lands in patch.layers.drums as "op:<i>". Checking only the first
// left the badge and the revert missing after a ring edit — the gate caught it.
const layerOps = () => (SONG.patch.layers && SONG.patch.layers.drums) || {};
export const hasRingOps = () => Object.keys(layerOps()).some((k) => k.indexOf("op:") === 0);
export const isEdited = (name) => !!(SONG.patch.kits && SONG.patch.kits[name]) || hasRingOps();

// Deep-copy the stock kit into state.kits on FIRST edit, then mutate the copy.
// Copy-on-write, so a song carries an override only for kits actually touched and
// an untouched song stays byte-identical to the stock render.
function mutable(name) {
  const kits = Object.assign({}, SONG.patch.kits || {});
  if (!kits[name]) kits[name] = JSON.parse(JSON.stringify(E.KITS[name] || { ops: [] }));
  return kits;
}
function commit(kits) { edit({ patch: Object.assign({}, SONG.patch, { kits }) }); }

export function revert(name) {
  const kits = Object.assign({}, SONG.patch.kits || {});
  delete kits[name];
  // and drop the ring's per-op probabilities for this song, or "revert" would
  // leave half the edit in place
  const layers = Object.assign({}, SONG.patch.layers || {});
  if (layers.drums) {
    const d = Object.assign({}, layers.drums);
    for (const k of Object.keys(d)) if (k.indexOf("op:") === 0) delete d[k];
    if (Object.keys(d).length) layers.drums = d; else delete layers.drums;
  }
  const patch = Object.assign({}, SONG.patch, { layers });
  if (Object.keys(kits).length) patch.kits = kits; else delete patch.kits;
  if (!Object.keys(layers).length) delete patch.layers;
  edit({ patch });
}

// ---------- the two dials ----------
// PERIOD: which cycle-position rule this op follows. Converting between them has
// to preserve the hits, so each conversion reads the op's CURRENT hit list (via
// the same precedence drumEvents uses) and re-shapes it — never invents notes.
const PERIODS = [
  { id: "hits", label: "every bar", doc: "the same hits every chord bar" },
  { id: "alt",  label: "A / B",     doc: "alternates two hit lists per chord bar (ci % 2)" },
  { id: "cyc",  label: "cycle of 4", doc: "steps through four hit lists (ci % 4)" },
  { id: "last", label: "last bar",  doc: "one list for the cycle's last chord, another for the rest" },
];
export function periodOf(op) {
  return op.alt ? "alt" : op.cyc ? "cyc" : op.last ? "last" : "hits";
}
const hitsOf = (op) => op.hits || (op.alt && op.alt[0]) || (op.cyc && op.cyc[0]) || (op.last && op.last[1]) || [];

export function setPeriod(kitName, opIdx, period) {
  const kits = mutable(kitName), op = kits[kitName].ops[opIdx];
  if (!op || op.grid || op.ride) return;                 // grid/ride lanes have their own shape
  const base = JSON.parse(JSON.stringify(hitsOf(op)));
  delete op.hits; delete op.alt; delete op.cyc; delete op.last;
  if (period === "alt") op.alt = [base, JSON.parse(JSON.stringify(base))];
  else if (period === "cyc") op.cyc = [0, 1, 2, 3].map(() => JSON.parse(JSON.stringify(base)));
  else if (period === "last") op.last = [JSON.parse(JSON.stringify(base)), base];
  else op.hits = base;
  commit(kits);
}

// PROBABILITY: `p` on a hit op (whole-op gate, one draw) or `grid.sp` on a
// stepped lane (one draw per step). 1 means "always" and is stored as ABSENCE,
// not as p:1 — an op carrying p:1 would draw a number to decide something that
// was never in doubt, and draw counts are the currency the rack law spends.
export function probOf(op) {
  if (op.grid) return op.grid.sp != null ? op.grid.sp : 1;
  return op.p != null ? op.p : 1;
}
export function setProb(kitName, opIdx, v) {
  const kits = mutable(kitName), op = kits[kitName].ops[opIdx];
  if (!op) return;
  const p = Math.max(0, Math.min(1, v));
  if (op.grid) { if (p >= 0.999) delete op.grid.sp; else op.grid.sp = +p.toFixed(2); }
  else { if (p >= 0.999) delete op.p; else op.p = +p.toFixed(2); }
  commit(kits);
}

// ---------- what the panel renders ----------
export function describeOp(op) {
  const lane = LANES[op.d] || op.d || "?";
  if (op.ride) return { lane, shape: `ride pair-loop x${op.ride.n}`, editable: false };
  if (op.grid) return { lane, shape: `grid x${op.grid.n} @ ${op.grid.step != null ? op.grid.step : 0.5}`, editable: true };
  const hs = hitsOf(op);
  return { lane, shape: `${hs.length} hit${hs.length === 1 ? "" : "s"}`, editable: true };
}

// The kits this song's form actually plays, in section order — the panel edits
// what you can hear, never the whole 22-kit table.
export function activeKits() {
  const s = state(), out = [];
  for (const sec of s.sections || []) {
    const d = sec.drums;
    if (d && d !== "off" && out.indexOf(d) < 0) out.push(d);
  }
  return out;
}
