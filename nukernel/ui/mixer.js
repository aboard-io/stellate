// ui/mixer.js — THE MIX, as a drilldown list.
//
// One row per CHANNEL (every part the song seats, plus drums, plus master).
// Tap a row to open the channel's MODULES under it — level, pan, the two
// sends, three EQ bands, mute. Drag a row LEFT or RIGHT to move its value;
// drag up or down and the page simply scrolls (touch-action: pan-y — nothing
// here eats the vertical axis). No popups, no per-section state on this page.
//
// WHAT A DRAG WRITES IS AN OFFSET (ui/state.js MIXER, song key `mix`): the
// composed per-section mix stays the "real" mix, and your hand rides on top of
// it for the whole record — so it does not revert when the transport walks
// into the next section. The base draws as a tick, the effective value as the
// fill, the offset as the printed number. Double-tap a row to zero it; the
// last row zeroes the whole board. audio/desk.js applies the same offsets at
// the same keys, so what is drawn and what is heard cannot drift.
import { GENRES, DRUMKITS, BASS_INSTR, BASSSYNTH, partChairLabel } from "./deps.js";
import { curSection, on, SONG, POOL, MIXER, setMixOffset,
         clearMixOffsets } from "./state.js";
import { playing as transportOn, playingSec, getPosition, passAt } from "../audio/live.js";
import { voiceRoster, partKeysOf, deskChannelBase, deskLevelAt } from "../audio/desk.js";
import { voiceOwners, kitOf } from "./derive.js";
import { isSynthFont, fontDef } from "../audio/fonts.js";
import { buzz } from "./touch.js";

const el = document.getElementById("mixtbl");
el.setAttribute("role", "list");
el.setAttribute("aria-label", "the mix — channels, tap to open, drag sideways to trim");

/* ---------- channel naming (the instrument coming through) ---------- */
const humanize = id => String(id || "").replace(/_/g, " ");
function soundOf(g, r) {
  const syn = isSynthFont() ? fontDef().synth : (r.over ? null : (g && g.synth));
  const useSyn = syn && !(syn.lineOnly && r.pad && !isSynthFont());
  return useSyn ? (syn.root || syn.dsp) : humanize(r.id);
}
// the union of every section's channels, in first-appearance order
function channels() {
  const seen = new Map();
  for (const sec of SONG) {
    let roster, owners, keys;
    try {
      roster = voiceRoster(sec); owners = voiceOwners(sec);
      keys = partKeysOf(sec, roster);
    } catch (e) { continue; }
    roster.forEach((r, i) => {
      if (!seen.has(r.key))
        seen.set(r.key, { key: r.key, label: partChairLabel(r.key),
                          sound: soundOf(GENRES[owners[i]], r) });
    });
    if (keys.includes("bass") && !seen.has("bass")) {
      const bs = BASSSYNTH[sec.bassop];
      seen.set("bass", { key: "bass", label: partChairLabel("bass"),
        sound: bs ? (bs.root || bs.dsp) : humanize((POOL && POOL.bass) || BASS_INSTR) });
    }
    if (keys.includes("drums") && !seen.has("drums")) {
      const k = kitOf(sec);
      seen.set("drums", { key: "drums", label: partChairLabel("drums"),
                          sound: DRUMKITS[k] || k || "drums" });
    }
  }
  return [...seen.values()];
}

/* ---------- the module registry: one table, the whole surface ---------- */
// key -> { label, lo, hi, px (units per pixel of drag), fmt, base(sec,chan) }
const db = g => (g > 0 ? 20 * Math.log10(g) : -60);
const MODS = {
  fader: { label: "level", lo: -24, hi: 12, px: 0.15,
           fmt: v => (v > 0 ? "+" : "") + v.toFixed(1) + " dB" },
  pan:   { label: "pan", lo: -1, hi: 1, px: 0.008,
           fmt: v => (v === 0 ? "C" : (v < 0 ? "L" : "R") + Math.round(Math.abs(v) * 50)) },
  rev:   { label: "reverb", lo: -1, hi: 1, px: 0.006,
           fmt: v => (v > 0 ? "+" : "") + v.toFixed(2) },
  del:   { label: "echo", lo: -1, hi: 1, px: 0.006,
           fmt: v => (v > 0 ? "+" : "") + v.toFixed(2) },
  "eq.lo":  { label: "eq low", lo: -12, hi: 12, px: 0.1,
              fmt: v => (v > 0 ? "+" : "") + v.toFixed(1) + " dB" },
  "eq.mid": { label: "eq mid", lo: -12, hi: 12, px: 0.1,
              fmt: v => (v > 0 ? "+" : "") + v.toFixed(1) + " dB" },
  "eq.hi":  { label: "eq high", lo: -12, hi: 12, px: 0.1,
              fmt: v => (v > 0 ? "+" : "") + v.toFixed(1) + " dB" },
  mute:  { label: "mute", toggle: true },
  // master-only characters: deltas over the resolved master stage
  drive: { label: "drive", lo: -1, hi: 1, px: 0.005, fmt: v => (v > 0 ? "+" : "") + v.toFixed(2) },
  glue:  { label: "glue", lo: -1, hi: 1, px: 0.005, fmt: v => (v > 0 ? "+" : "") + v.toFixed(2) },
  tape:  { label: "tape", lo: -1, hi: 1, px: 0.005, fmt: v => (v > 0 ? "+" : "") + v.toFixed(2) },
  space: { label: "space", lo: -1, hi: 1, px: 0.005, fmt: v => (v > 0 ? "+" : "") + v.toFixed(2) },
};
const CHAN_MODS = ["fader", "pan", "rev", "del", "eq.lo", "eq.mid", "eq.hi", "mute"];
const MASTER_MODS = ["fader", "drive", "glue", "tape", "space"];

const offOf = (chan, k) => {
  const o = (MIXER && MIXER[chan]) || null;
  if (!o) return 0;
  if (k === "mute") return !!o.mute;
  if (k.startsWith("eq.")) return (o.eq && o.eq[k.slice(3)]) || 0;
  return o[k] || 0;
};
function writeOff(chan, k, v) {
  if (k.startsWith("eq.")) {
    const band = k.slice(3);
    const eq = { ...((MIXER && MIXER[chan] && MIXER[chan].eq) || {}) };
    if (v) eq[band] = v; else delete eq[band];
    setMixOffset(chan, "eq", Object.keys(eq).length ? eq : null);
  } else setMixOffset(chan, k, v);
}

/* ---------- which section the base numbers read ---------- */
const baseSec = () => (transportOn && playingSec >= 0 && SONG[playingSec])
  ? SONG[playingSec] : curSection();

// composed base per (chan, mod), for the tick and the effective fill
function baseVal(chan, k) {
  if (chan === "master") return 0;                    // deltas over the engine's own stage
  const b = deskChannelBase(baseSec(), chan);
  if (k === "fader") return db(b.gain);               // shown in dB
  if (k === "pan") return b.pan;
  if (k === "rev") return b.rev;
  if (k === "del") return b.del;
  if (k.startsWith("eq.")) return (b.eq && b.eq[k.slice(3)]) || 0;
  return 0;
}
// map a mod's effective value to a 0..1 fill
function fillPct(k, eff) {
  if (k === "fader") return Math.max(0, Math.min(1, (eff + 36) / 48));
  const m = MODS[k];
  return Math.max(0, Math.min(1, (eff - m.lo) / (m.hi - m.lo)));
}

/* ---------- draw ---------- */
let open = null;                            // the one drilled-open channel key
let rows = [];                              // painted refs
export function drawMix() {
  el.textContent = "";
  rows = [];
  const list = [...channels(), { key: "master", label: "sum", sound: "master" }];
  for (const c of list) {
    const chan = document.createElement("div");
    chan.className = "mxc" + (open === c.key ? " open" : "");
    chan.dataset.chan = c.key;
    const head = row(c.key, "fader", c.sound, c.label, true);
    chan.appendChild(head.el);
    rows.push(head);
    if (open === c.key) {
      const mods = document.createElement("div");
      mods.className = "mxmods";
      for (const k of (c.key === "master" ? MASTER_MODS : CHAN_MODS)) {
        const r = row(c.key, k, MODS[k].label, "", false);
        mods.appendChild(r.el); rows.push(r);
      }
      chan.appendChild(mods);
    }
    el.appendChild(chan);
  }
  const z = document.createElement("div");
  z.className = "mxzero";
  z.textContent = MIXER ? "zero the board" : "the board is at zero";
  z.setAttribute("role", "button");
  if (MIXER) z.addEventListener("click", () => { clearMixOffsets(); buzz(4); });
  el.appendChild(z);
}

// one row: head rows carry the channel name and drag LEVEL; module rows carry
// their own module. Everything is the same object at two scales.
function row(chan, k, name, tag, isHead) {
  const m = MODS[k];
  const r = document.createElement("div");
  r.className = isHead ? "mxr mxhead" : "mxr";
  r.dataset.fam = k.startsWith("eq.") ? "eq" : k;
  const fill = document.createElement("i"); fill.className = "fill";
  const tick = document.createElement("b"); tick.className = "tick";
  const nm = document.createElement("span"); nm.className = "nm";
  nm.textContent = name;
  if (tag) { const t = document.createElement("small"); t.textContent = " " + tag; nm.appendChild(t); }
  const val = document.createElement("span"); val.className = "val";
  r.append(fill, tick, nm, val);
  const ref = { el: r, chan, k, isHead, fill, tick, val, paint: null };
  ref.paint = () => paintRow(ref);
  paintRow(ref);
  bindRow(ref);
  return ref;
}

function paintRow(ref) {
  const { chan, k, fill, tick, val, el: r } = ref;
  const m = MODS[k];
  if (m.toggle) {
    const on = offOf(chan, k) === true;
    r.classList.toggle("cut", on);
    fill.style.width = "0"; tick.style.left = "-9px";
    val.textContent = on ? "CUT" : "on";
    r.setAttribute("aria-pressed", String(on));
    return;
  }
  const off = offOf(chan, k);
  const base = baseVal(chan, k);
  const eff = base + off;
  fill.style.width = (fillPct(k, eff) * 100).toFixed(1) + "%";
  tick.style.left = (fillPct(k, base) * 100).toFixed(1) + "%";
  r.classList.toggle("set", !!off);
  val.textContent = off ? m.fmt(off) : "·";
  r.setAttribute("role", "slider");
  r.setAttribute("aria-label", (chan === "master" ? "master " : chan + " ") + m.label);
  r.setAttribute("aria-valuemin", String(m.lo));
  r.setAttribute("aria-valuemax", String(m.hi));
  r.setAttribute("aria-valuenow", String(off));
  r.tabIndex = 0;
}

/* ---------- the one gesture: horizontal drag = trim; tap = drill ---------- */
const clampTo = (m, v) => Math.max(m.lo, Math.min(m.hi, v));
function bindRow(ref) {
  const { el: r, chan, k, isHead } = ref;
  const m = MODS[k];
  if (m.toggle) {
    r.addEventListener("click", () => { writeOff(chan, k, !offOf(chan, k)); buzz(3); });
    return;
  }
  let x0 = 0, y0 = 0, v0 = 0, engaged = false, lastTap = 0, moved = false;
  let throttle = 0;
  r.addEventListener("pointerdown", ev => {
    x0 = ev.clientX; y0 = ev.clientY; v0 = offOf(chan, k) || 0;
    engaged = false; moved = false;
  });
  r.addEventListener("pointermove", ev => {
    if (ev.buttons !== 1 && ev.pointerType === "mouse") return;
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!engaged) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      engaged = true; moved = true;
      try { r.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
    }
    const step = k === "fader" ? 0.1 : 0.01;
    const v = Math.round(clampTo(m, v0 + dx * m.px) / step) * step;
    const now = performance.now();
    if (now - throttle > 120) { throttle = now; writeOff(chan, k, +v.toFixed(2)); }
    else { ref._pending = +v.toFixed(2); }
    paintRow(ref);
  });
  r.addEventListener("pointerup", ev => {
    if (engaged) {
      const v = ref._pending != null ? ref._pending
        : +clampTo(m, v0 + (ev.clientX - x0) * m.px).toFixed(2);
      ref._pending = null;
      writeOff(chan, k, Math.abs(v) < 1e-3 ? null : v);
      engaged = false;
      return;
    }
    if (moved) return;
    // a plain tap: double-tap zeroes; on a head row a single tap drills
    const now = performance.now();
    if (now - lastTap < 350) { writeOff(chan, k, null); buzz(4); lastTap = 0; return; }
    lastTap = now;
    if (isHead) {
      open = open === chan ? null : chan;
      drawMix();
    }
  });
  r.addEventListener("keydown", ev => {
    const bump = k === "fader" ? 0.5 : 0.05;
    let v = offOf(chan, k) || 0;
    if (ev.key === "ArrowRight" || ev.key === "ArrowUp") v += bump;
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") v -= bump;
    else if (ev.key === "Backspace" || ev.key === "Delete" || ev.key === "0") v = 0;
    else if ((ev.key === "Enter" || ev.key === " ") && isHead) {
      ev.preventDefault(); open = open === chan ? null : chan; drawMix(); return;
    } else return;
    ev.preventDefault();
    writeOff(chan, k, Math.abs(clampTo(m, v)) < 1e-3 ? null : +clampTo(m, v).toFixed(2));
  });
}

/* ---------- the live fill (main.js's one rAF loop calls this) ---------- */
export function paintBoard() {
  if (!transportOn) return;
  const sec = baseSec();
  const pos = getPosition();
  const f = pos && passAt ? passAt(pos.now).f : 0;
  const live = deskLevelAt(sec, f);
  for (const ref of rows)
    if (ref.isHead && ref.chan !== "master")
      ref.el.style.setProperty("--live", live.toFixed(3));
}

/* ---------- subscriptions ---------- */
on("song", () => { open = null; drawMix(); });
on("box", drawMix);
on("pool", drawMix);
on("selection", drawMix);
on("refresh", drawMix);
on("mix", () => { for (const r of rows) r.paint(); });
on("transport:section", () => { for (const r of rows) r.paint(); });
on("transport:state", drawMix);
