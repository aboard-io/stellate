// editors/master.js — the master sheet (one tab): pipes chain + time feel.
//
// TIME FEEL: three tiles (bpm 60–190 / swing / humanize) through layers.js's
// master writer — the kernel card's bpm tile shares the same axis.
//
// NOTE FX: state.pipes as ORDERED CARDS over machines/pipes.js (the data layer —
// registry/active/toggle/move/setParam/knobsOf). Each card: order number, name,
// ↑↓ order buttons and ✕ remove, the registry's own doc as caption, a CHANCE
// pad (prob), and one tile per numeric param the pipe's spec already carries.
// ORDER IS AUDIBLE — each pipe draws from a stream keyed on its INDEX and feeds
// the next, so ↑↓ is a real edit, not a cosmetic sort (machines/pipes.js law).
// Registry entries not in the chain are add-chips at the bottom.
//
// Contract: export render(host, ctx) — ctx per app/daw/sheet.js header.
import { TILE_SETS, readLayer, fmtLayer } from "../layers.js";
import * as PIPES from "../machines/pipes.js";

const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

// a numeric param shown in the pipe's own range (knobsOf carries raw), unitless
const fmtRaw = (raw) => String(+(+raw).toFixed(2));

// double-tap revert on a param tile: drop the KEY from the pipe's entry so the
// engine's own default speaks again. machines/pipes.js has no removeParam, so
// this commits the same shape its own commit() writes (patch.pipes, whole list).
function dropParam(song, id, key) {
  const list = (song.state().pipes || []).map((p) => Object.assign({}, p));
  const p = list.find((x) => x.id === id);
  if (!p || !(key in p)) return;
  delete p[key];
  song.edit({ patch: Object.assign({}, song.SONG.patch, { pipes: list }) });
}

export function render(host, ctx) {
  host.textContent = "";
  const song = ctx.song;

  // ---------- time feel ----------
  const feel = el("div", "dw-ed");
  feel.appendChild(el("div", "dw-edhead", "master — time feel"));
  const row = el("div", "dw-tiles");
  for (const t of TILE_SETS.master) {
    ctx.controls.makeTile(row, {
      label: t.label, hue: ctx.hue,
      read: () => {
        const st = song.state();
        const set = (song.SONG.patch.layers || {}).master || {};
        const v = set[t.id] != null ? +set[t.id] : readLayer(st, "master", t.id);
        return { v, txt: fmtLayer("master", t.id, v), stock: set[t.id] == null };
      },
      write: (v) => song.editLayer("master", t.id, v),
      revert: () => song.editLayer("master", t.id, null),
      onDrag: (v, txt) => ctx.setEcho(t.label + " · " + txt),
    });
  }
  feel.appendChild(row);
  host.appendChild(feel);

  // ---------- note fx: the pipe chain ----------
  const fx = el("div", "dw-ed");
  const head = el("div", "dw-edhead", "note fx — the pipe chain");
  fx.appendChild(head);
  if (PIPES.isEdited()) {
    const bar = el("div", "dw-edrow");
    bar.appendChild(el("span", "dw-badge", "edited"));
    const rv = el("button", "dw-chip", "genre's own chain");
    rv.type = "button";
    rv.setAttribute("aria-label", "revert the pipe chain to the genre's own");
    rv.addEventListener("click", () => { PIPES.revert(); ctx.rerender(); });
    bar.appendChild(rv);
    fx.appendChild(bar);
  }

  const docOf = {};
  for (const r of PIPES.registry()) docOf[r.id] = r.doc;
  const list = PIPES.active();

  if (!list.length) fx.appendChild(el("p", "dw-pnote", "no note fx in this genre's chain — add one below."));
  const chain = el("div", "dw-pchain");
  chain.style.setProperty("--hue", ctx.hue);
  list.forEach((p, i) => {
    const card = el("div", "dw-pcard");
    const ch = el("div", "dw-pcardhead");
    ch.appendChild(el("i", "dw-pord", String(i + 1)));
    ch.appendChild(el("span", "dw-pname", p.id));
    const btn = (txt, aria, fn, dis) => {
      const b = el("button", "dw-chip", txt);
      b.type = "button";
      b.style.minWidth = "44px";       // a single glyph + chip padding lands ~36px — hold the touch floor
      b.setAttribute("aria-label", aria);
      if (dis) b.disabled = true;
      else b.addEventListener("click", () => { fn(); ctx.rerender(); });
      ch.appendChild(b);
    };
    btn("↑", "move " + p.id + " earlier", () => PIPES.move(p.id, -1), i === 0);
    btn("↓", "move " + p.id + " later", () => PIPES.move(p.id, 1), i === list.length - 1);
    btn("✕", "remove " + p.id, () => PIPES.toggle(p.id));
    card.appendChild(ch);
    if (docOf[p.id]) card.appendChild(el("p", "dw-pcap", docOf[p.id]));

    const grid = el("div", "dw-tiles");
    // the CHANCE pad — prob absent means the pipe always fires; committing off
    // writes prob 0 (still racked, silent) so its params and position survive
    ctx.controls.makePad(grid, {
      label: "chance", hue: ctx.hue,
      value: p.prob != null ? p.prob : 1,
      on: p.prob != null ? p.prob > 0.001 : true,
      read: () => {
        const q = PIPES.active().find((x) => x.id === p.id);
        if (!q) return { value: 0, on: false };
        return { value: q.prob != null ? q.prob : 1, on: q.prob != null ? q.prob > 0.001 : true };
      },
      onCommit: (v) => PIPES.setParam(p.id, "prob", v == null ? 0 : v),
      onDrag: (v) => ctx.setEcho(p.id + " · " + Math.round(v * 100) + "%"),
    });
    // one tile per numeric param the spec already carries (knobsOf's set), in
    // the engine's own range — prob is the pad above, not a tile
    for (const k of PIPES.knobsOf(p).filter((x) => x.id !== "prob")) {
      ctx.controls.makeTile(grid, {
        label: k.label, hue: ctx.hue,
        read: () => {
          const q = PIPES.active().find((x) => x.id === p.id);
          const kk = q && PIPES.knobsOf(q).find((x) => x.id === k.id);
          return kk ? { v: kk.v, txt: fmtRaw(kk.raw), stock: !PIPES.isEdited() }
                    : { v: k.v, txt: fmtRaw(k.raw), stock: true };
        },
        write: (v) => PIPES.setParam(p.id, k.id, v),
        revert: () => dropParam(song, p.id, k.id),
        onDrag: (v, txt) => ctx.setEcho(p.id + " · " + k.label + " " + txt),
      });
    }
    card.appendChild(grid);
    chain.appendChild(card);
  });
  fx.appendChild(chain);

  // add-chips: every registry pipe not in the chain, its doc as the tooltip.
  // Momentary buttons (an add is an action, not a selection), joining at the END
  // of the chain — where a new pipe hears everything before it.
  const absent = PIPES.registry().filter((r) => !list.some((p) => p.id === r.id));
  if (absent.length) {
    const ar = el("div", "dw-edrow");
    ar.appendChild(el("span", "dw-edlab", "add"));
    const chips = el("div", "dw-chips");
    chips.style.setProperty("--hue", ctx.hue);
    for (const r of absent) {
      const b = el("button", "dw-chip", "+ " + r.id);
      b.type = "button";
      if (r.doc) b.title = r.doc;
      b.setAttribute("aria-label", "add " + r.id + " to the chain");
      b.addEventListener("click", () => { PIPES.toggle(r.id); ctx.rerender(); });
      chips.appendChild(b);
    }
    ar.appendChild(chips);
    fx.appendChild(ar);
  }
  fx.appendChild(el("p", "dw-pnote",
    "order is audible — each pipe draws from a stream keyed on its position and feeds the next, so ↑↓ is a real edit. a new pipe joins at the end at 50% chance."));
  host.appendChild(fx);
}
