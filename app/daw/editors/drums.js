// editors/drums.js — the drums PART tab: kit pad-matrix + period chips + kit chips.
//
// The surface, per DAW-GRID spec "drums PART": for each active kit
// (machines/drums.js activeKits) a pad MATRIX — one row per op (lane label; grid
// ops render ONE wide pad showing the grid shape as ghost ticks with fill = sp;
// hit ops one pad with fill = p — sp/p are PER-OP, never per-step: the pad-per-op
// with fill IS the design), period chips per op (every bar / A·B / cycle-4 /
// last via periodOf/setPeriod — plain hit ops only, grid/ride carry their own
// shape), "edited" badge + revert per kit, kit-swap chips over Object.keys
// (E.KITS) applied PER-SECTION via secover, and the honest note when a form
// never turns drums on. Data layer: machines/drums.js — UI only here.
//
// Contract: export render(host, ctx) — ctx per app/daw/sheet.js header.
import { kitOf, activeKits, isEdited, revert, periodOf, setPeriod, probOf,
         setProb, describeOp } from "../machines/drums.js";

const el = (t, c, x) => { const d = document.createElement(t); if (c) d.className = c; if (x != null) d.textContent = x; return d; };

// The period vocabulary mirrors machines/drums.js PERIODS (not exported there);
// the ids are the ones setPeriod dispatches on, the docs ride as chip titles.
const PERIODS = [
  { id: "hits", label: "every bar", title: "the same hits every chord bar" },
  { id: "alt",  label: "A / B",     title: "alternates two hit lists per chord bar" },
  { id: "cyc",  label: "cycle of 4", title: "steps through four hit lists" },
  { id: "last", label: "last bar",  title: "one list for the cycle's last chord, another for the rest" },
];

// Kit vocabulary GROUPED by family for the swap chips — an ORDER over the
// engine's own table, never a list of names this file invents: anything the
// engine ships that the order doesn't know still appears (at the end), and the
// song's own patch kits (copy-on-write copies) ride along by name.
const KIT_ORDER = [
  "four", "house", "techno", "electro", "pulse",                    // four-floor
  "breaks", "jungle", "boombap", "halftime", "trap", "newjack",     // breaks
  "full", "open", "kick", "shuffle", "tribal", "bossa", "onedrop",  // groove
  "waltz", "waltzswing", "sixeight",                                // odd meter
];
function kitVocab(song) {
  const E = window.CsdEngine;
  const known = Object.keys((E && E.KITS) || {});
  const seen = new Set(), out = [];
  for (const k of KIT_ORDER) if (known.indexOf(k) >= 0 && !seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of known) if (!seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of Object.keys(song.SONG.patch.kits || {})) if (!seen.has(k)) { seen.add(k); out.push(k); }
  return out;
}

// one chord-bar in beats — the same math sectionSpans walks, so the ghost ticks
// sit where the grid's steps actually land
const barBeats = (s) => Math.max(2, Math.round(s.chordEvery || (s.meter ? 6 : 8)));

const row = (box, label) => { const r = el("div", "dw-edrow"); r.appendChild(el("span", "dw-edlab", label)); box.appendChild(r); return r; };

// ---------- kit swap: per-section, via secover ----------
// The swap is a RULE on the form (editSecover(id, "drums", kit|"off"|null)) —
// never a mutation of state.sections. Section-scoped sheet: one row. Whole-song
// sheet: one row per section, so every column's kit is swappable from here.
function kitSwapBlock(box, ctx) {
  const song = ctx.song;
  const spans = song.sectionSpans();
  const so = song.SONG.patch.secover || {};
  const targets = ctx.section ? spans.filter((sp) => sp.id === ctx.section.id) : spans;
  if (!targets.length) return;
  box.appendChild(el("div", "dw-edhead", ctx.section ? "the kit — this section" : "the kit — per section"));
  const vocab = kitVocab(song);
  for (const sp of targets) {
    const r = row(box, ctx.section ? "kit" : (sp.name || "sec " + sp.index));
    const ov = (so[sp.id] || {}).drums;
    ctx.controls.makeChips(r, {
      hue: ctx.hue,
      options: [{ id: "__own", label: "genre's own" }, { id: "off", label: "off" }]
        .concat(vocab.map((k) => ({ id: k, label: k }))),
      value: ov != null ? ov : "__own",
      // the pick changes which kit the matrix below shows, so re-render the body
      onPick: (pick) => { song.editSecover(sp.id, "drums", pick === "__own" ? null : pick); ctx.rerender(); },
    });
    const now = sp.sec.drums && sp.sec.drums !== "off" ? sp.sec.drums : "off";
    r.appendChild(el("span", "dw-edval", "now: " + now));
  }
}

// ---------- the pad matrix: one kit, one row per op ----------
function kitBlock(box, ctx, name) {
  const kit = kitOf(name);
  if (!kit || !kit.ops) return;
  const song = ctx.song;
  const head = el("div", "dw-edhead", "kit — " + name);
  // badge + revert are ALWAYS built and toggled in place: the sheet body is not
  // re-rendered per edit (that would kill a drag / drop keyboard focus), so a
  // pad commit or a period pick calls syncBadge() instead of ctx.rerender().
  const badge = el("span", "dw-badge", "edited");
  const rv = el("button", "dw-mini", "revert");
  rv.type = "button";
  rv.title = "drop every edit on this kit — back to the stock table";
  rv.addEventListener("click", () => { revert(name); ctx.rerender(); });
  head.append(badge, rv);
  const syncBadge = () => { const e = isEdited(name); badge.style.display = e ? "" : "none"; rv.style.display = e ? "" : "none"; };
  syncBadge();
  box.appendChild(head);
  const cb = barBeats(song.state());

  kit.ops.forEach((op, i) => {
    const d = describeOp(op);
    const lane = String(d.lane).toLowerCase();
    const r = row(box, lane);
    if (!d.editable) {                                  // ride pair-loop: its own shape, plays as written
      r.appendChild(el("span", "dw-edval", d.shape + " — plays as written"));
      return;
    }
    // the pad: fill = the op's whole gate (p, or grid.sp for a stepped lane).
    // "always" is the ABSENCE of p — setProb owns that law; off commits 0.
    const holder = el("div", "dw-padhold" + (op.grid ? " wide" : ""));
    r.appendChild(holder);
    const p0 = probOf(op);
    const pad = ctx.controls.makePad(holder, {
      value: p0 > 0 ? p0 : 1, on: p0 > 0.001, hue: ctx.hue, label: d.shape,
      onCommit: (v) => { setProb(name, i, v == null ? 0 : v); ctx.setEcho(""); syncBadge(); },
      onDrag: (v) => ctx.setEcho(lane + " · " + Math.round(v * 100) + "%"),
      read: () => {
        const k2 = kitOf(name), o2 = k2 && k2.ops && k2.ops[i];
        if (!o2) return null;
        const p = probOf(o2);
        return { value: p > 0 ? p : 0, on: p > 0.001 };
      },
    });
    pad.el.title = lane + " — " + d.shape + " · drag = chance it fires, tap = on/off";

    if (op.grid) {
      // ONE wide pad for the whole stepped lane, the grid shape as GHOST TICKS:
      // a tick per step at its true beat position, height following the amp
      // cycle. Ticks are cosmetic geometry (.dw-padtick — only left/height are
      // per-tick, JS-set like the song bar's flexGrow), pointer-events none —
      // the pad underneath stays the control.
      pad.el.classList.add("wide");
      const g = op.grid, n = g.n || 1, step = g.step != null ? g.step : 0.5, from = g.from || 0;
      const amps = (g.amps && g.amps.length) ? g.amps : [1];
      const mx = Math.max.apply(null, amps.map(Math.abs).concat([0.001]));
      const lab = pad.el.querySelector(".dw-padlab");
      for (let t = 0; t < n; t++) {
        const x = (from + t * step) / cb;
        if (x >= 0.999) continue;                        // past the chord bar — the engine won't play it
        const a = Math.abs(amps[t % amps.length]) / mx;
        const tick = el("i", "dw-padtick");
        tick.style.left = (x * 100).toFixed(2) + "%";
        tick.style.height = Math.round(16 + a * 42) + "%";
        pad.el.insertBefore(tick, lab);
      }
    } else {
      // PERIOD — which cycle-position rule the op follows. Plain hit ops only:
      // setPeriod refuses grid/ride (their shape is their own).
      ctx.controls.makeChips(r, {
        hue: ctx.hue,
        options: PERIODS,
        value: periodOf(op),
        onPick: (p) => { setPeriod(name, i, p); syncBadge(); },
      });
    }
  });
}

export function render(host, ctx) {
  host.textContent = "";
  const box = el("div", "dw-ed");
  box.appendChild(el("div", "dw-edhead", "drums — the kit machine"));

  // which kits this surface edits: the section's own kit when section-scoped,
  // else every kit the form plays (activeKits — you edit what you can hear)
  const kits = ctx.section
    ? (ctx.section.sec.drums && ctx.section.sec.drums !== "off" ? [ctx.section.sec.drums] : [])
    : activeKits();

  if (!kits.length)
    box.appendChild(el("p", "dw-pnote", ctx.section
      ? "this section keeps the drums off — pick a kit below to turn them on."
      : "this song's form never turns the drums on — pick a kit for a section below to hear one."));

  for (const name of kits) kitBlock(box, ctx, name);

  if (kits.length)
    box.appendChild(el("p", "dw-pnote",
      "each pad is ONE op: fill = the chance it fires that bar (a stepped lane gates every step by the same chance — the ticks are its shape). full = always, and \"always\" is stored as no probability at all."));

  kitSwapBlock(box, ctx);

  // the drum MIXER (TILE_SETS.drums) lives on the SOUND tab — editors/sound.js
  // covers the drums voice, so this tab carries no fallback copy of it.

  host.appendChild(box);
}
