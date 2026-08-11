// editors/drums.js — the drums PART tab: kit pad-matrix + period chips + the
// per-section kit TABLE.
//
// The surface, per DAW-GRID spec "drums PART": for each active kit
// (machines/drums.js activeKits) a pad MATRIX — one row per op (lane label; grid
// ops render ONE wide pad showing the grid shape as ghost ticks with fill = sp;
// hit ops one pad with fill = p — sp/p are PER-OP, never per-step: the pad-per-op
// with fill IS the design), period chips per op (every bar / A·B / cycle-4 /
// last via periodOf/setPeriod — plain hit ops only, grid/ride carry their own
// shape), "edited" badge + revert per kit, the kit swap applied PER-SECTION via
// secover, and the honest note when a form never turns drums on. Data layer:
// machines/drums.js — UI only here.
//
// THE KIT WALL IS GONE (2026-08-11). The swap used to be a chip row of the whole
// kit vocabulary REPEATED PER SECTION — 22 lozenges × 8 sections ≈ 176 pills in
// one scroll, ragged and unscannable. It is now a SECTION TABLE (rows =
// sections, columns = section · kit now · yours) whose every row drills into ONE
// kit picker view: a picker is a place you go, not a field you scroll past. The
// pads and the period chips are untouched — ≤6 short options stay chips.
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

// Kit vocabulary GROUPED by family — an ORDER over the engine's own table, never
// a list of names this file invents: anything the engine ships that the order
// doesn't know still appears (under "more"), and the song's own patch kits
// (copy-on-write copies) ride along by name. The group labels are what the
// picker's sticky headers say.
const KIT_FAMILIES = [
  { label: "four on the floor", kits: ["four", "house", "techno", "electro", "pulse"] },
  { label: "breaks",            kits: ["breaks", "jungle", "boombap", "halftime", "trap", "newjack"] },
  { label: "groove",            kits: ["full", "open", "kick", "shuffle", "tribal", "bossa", "onedrop"] },
  { label: "odd meter",         kits: ["waltz", "waltzswing", "sixeight"] },
];
// [{label, kits:[name]}] over everything this song can actually draw: the known
// families first, then whatever else the engine ships, then the song's own kits.
function kitGroups(song) {
  const E = window.CsdEngine;
  const known = Object.keys((E && E.KITS) || {});
  const seen = new Set(), out = [];
  for (const fam of KIT_FAMILIES) {
    const kits = fam.kits.filter((k) => known.indexOf(k) >= 0 && !seen.has(k));
    kits.forEach((k) => seen.add(k));
    if (kits.length) out.push({ label: fam.label, kits });
  }
  const rest = known.filter((k) => !seen.has(k));
  rest.forEach((k) => seen.add(k));
  if (rest.length) out.push({ label: "more", kits: rest });
  const mine = Object.keys(song.SONG.patch.kits || {}).filter((k) => !seen.has(k));
  if (mine.length) out.push({ label: "this song's kits", kits: mine });
  return out;
}

// what a kit IS, in the engine's own terms — READ OFF THE OPS every time, never a
// per-kit sentence this file keeps (the law the genre blurbs live under). Every
// shipped kit plays kick+snare+hat, so the lanes say nothing; what actually
// separates them is how many ops they carry and what the stepped lane does.
const kitOps = (name) => { const k = kitOf(name); return k && Array.isArray(k.ops) ? k.ops.length : 0; };
function kitFeel(name) {
  const k = kitOf(name);
  const ops = (k && Array.isArray(k.ops)) ? k.ops : [];
  if (!ops.length) return "";
  if (ops.some((o) => o && o.ride)) return "shuffle";
  if (ops.some((o) => o && o.skip)) return "swing";
  const g = ops.find((o) => o && o.grid);
  if (!g) return "hits only";
  const step = g.grid.step != null ? +g.grid.step : 0.5;   // the engine's own default
  if (step >= 0.95) return "4ths";
  if (step >= 0.45) return "8ths";
  if (step >= 0.3) return "triplets";
  if (step >= 0.2) return "16ths";
  return "32nds";
}
const kitMeta = (name) => {
  const n = kitOps(name), f = kitFeel(name);
  return n ? n + " ops" + (f ? " · " + f : "") : "";
};

// one chord-bar in beats — the same math sectionSpans walks, so the ghost ticks
// sit where the grid's steps actually land
const barBeats = (s) => Math.max(2, Math.round(s.chordEvery || (s.meter ? 6 : 8)));

const row = (box, label) => { const r = el("div", "dw-edrow"); r.appendChild(el("span", "dw-edlab", label)); box.appendChild(r); return r; };

// ---------- kit swap: per-section, via secover ----------
// The swap is a RULE on the form (editSecover(id, "drums", kit|"off"|null)) —
// never a mutation of state.sections. ONE kit picker view serves every section:
// push it with the section it is choosing for, it commits and pops back here.
function kitPicker(ctx, sp) {
  const song = ctx.song;
  const ov = ((song.SONG.patch.secover || {})[sp.id] || {}).drums;
  const now = sp.sec.drums && sp.sec.drums !== "off" ? sp.sec.drums : "off";
  const groups = [{
    label: "the form's own",
    rows: [
      // sp.sec.drums is the RESOLVED kit — it already carries this section's own
      // rule — so it may only be quoted as "what the genre gave you" when there
      // is no rule to quote it over.
      { id: "__own", cells: ["genre's own", ov == null ? (now === "off" ? "off here" : now) : "drop the rule"],
        title: ov == null
          ? "no rule — this section plays whatever the genre and form gave it (" + now + ")"
          : "drop the rule and hand this section back to the genre and form" },
      { id: "off", cells: ["off", "silent"], title: "this section plays no drums at all" },
    ],
  }].concat(kitGroups(song).map((g) => ({
    label: g.label,
    rows: g.kits.map((k) => ({
      id: k, cells: [k, kitMeta(k)],
      title: k + " — " + (kitMeta(k) || "an empty kit"),
    })),
  })));
  ctx.picker({
    title: "kit", hue: ctx.hue, label: "kit",
    id: "picker:kit:" + sp.id,
    note: "the kit for " + (sp.name || "section " + (sp.index + 1)) +
          " — a rule on the form, so it survives a change of seed.",
    columns: [{ id: "kit", label: "kit" }, { id: "shape", label: "shape", align: "right", w: 120 }],
    groups,
    value: () => (ov != null ? ov : "__own"),
    filter: true,
    onPick: (pick) => song.editSecover(sp.id, "drums", pick === "__own" ? null : pick),
  });
}

// The section-scoped sheet edits ONE section, so it gets the standard pick row
// (a table of one row is not a table). The whole-song sheet gets the SECTION
// TABLE: one row per section, columns section · kit now · yours, every row a
// door into the picker above.
function kitSwapBlock(box, ctx) {
  const song = ctx.song;
  const spans = song.sectionSpans();
  const so = song.SONG.patch.secover || {};
  const targets = ctx.section ? spans.filter((sp) => sp.id === ctx.section.id) : spans;
  if (!targets.length) return;
  const nowOf = (sp) => (sp.sec.drums && sp.sec.drums !== "off" ? sp.sec.drums : "off");
  const yoursOf = (sp) => { const ov = (so[sp.id] || {}).drums; return ov == null ? "—" : ov; };

  if (ctx.section) {
    const sp = targets[0];
    box.appendChild(el("div", "dw-edhead", "the kit — this section"));
    const r = row(box, "kit");
    const b = el("button", "dw-pick");
    b.type = "button";
    b.title = "choose the kit this section plays";
    b.append(el("span", "dw-pickval", yoursOf(sp) === "—" ? "genre's own" : yoursOf(sp)),
             el("span", "dw-pickid", "now: " + nowOf(sp)),
             el("span", "dw-pickmore", "›"));
    b.addEventListener("click", () => kitPicker(ctx, sp));
    r.appendChild(b);
    return;
  }

  box.appendChild(el("div", "dw-edhead", "the kit — per section"));
  ctx.controls.makeTable(box, {
    hue: ctx.hue, label: "section",
    columns: [
      { id: "sec", label: "section" },
      { id: "now", label: "kit now", align: "right", w: 96 },
      { id: "yours", label: "yours", align: "right", w: 84 },
    ],
    rows: targets.map((sp) => ({
      id: sp.id,
      cells: [sp.name || "sec " + (sp.index + 1), nowOf(sp), yoursOf(sp)],
      title: "choose the kit for " + (sp.name || "section " + (sp.index + 1)) +
             " — plays " + nowOf(sp),
      dim: nowOf(sp) === "off",
    })),
    value: null,
    max: 0,
    onPick: (id) => { const sp = targets.find((s) => s.id === id); if (sp) kitPicker(ctx, sp); },
  });
  box.appendChild(el("p", "dw-pnote",
    "tap a section to choose its kit. \"kit now\" is what it plays today, \"yours\" the rule you set — " +
    "a dash means the genre's own."));
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
