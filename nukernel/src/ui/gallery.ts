// nukernel/src/ui/gallery.ts — THE PAGE THAT IS THE SYSTEM.
//
// docs/DESIGN-SYSTEM.md §3: *"/design — a page in the app that renders every
// component in every state, with its tokens, its attribute surface and a live
// example. It is built FROM the component definitions, not written beside
// them, so it cannot drift. It is the answer to 'when done I should be able to
// see the design system', and it is also the fastest gate we have: a
// screenshot of that page is the whole system."*
//
// SO IT IS BUILT FROM `./api.ts` AND FROM THE STYLESHEET, AND NOTHING HERE IS
// TYPED TWICE:
//   · every element, every attribute and every state comes from `SPEC`;
//   · every colour, size, weight and step is READ OFF `:root` at runtime, so
//     a token added to tokens.css appears on this page without an edit here,
//     and a token deleted disappears;
//   · every contrast number is MEASURED from the resolved values in the
//     browser, not copied from a report — which is the only way the number on
//     the page and the number in the gate can be the same number.
//
// WHY IT IS ITS OWN PAGE AND NOT A TAB. `TABS` in ui/eight.js is the one owner
// of what the box can SHOW, and its list is the hamburger's first block — six
// destinations, eighteen rows, measured at 891px of content in 785 of glass
// (TABLE.md §20). A nineteenth row is a change to the chrome v303 just landed,
// and this round is the tokens and the gallery, not the navigation. A gallery
// is also not a VIEW of the record: it shows no song, writes no document, and
// belongs to whoever is building the box rather than to whoever is using it.
// So it is `nukernel/design.html`, which links the same three stylesheets and
// loads the same two bundles, and it costs the app exactly nothing.

import { SPEC, ALL_STATES, PSEUDO_STATES } from "./api.js";
import type { DemoKid, ElSpec, ElState } from "./api.js";
import { t } from "../copy/global.js";

/* ---- THE MEASURING, DONE IN THE BROWSER ------------------------------- */

const root = () => document.documentElement;
const tok = (n: string) =>
  getComputedStyle(root()).getPropertyValue(n).trim();

/** Resolve any colour token — `var()`, `color-mix()`, a hex — to the rgb the
 *  browser actually paints, by asking the browser. There is no second colour
 *  parser on this page and there may not be one. */
function rgbOf(value: string): [number, number, number] | null {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;left:-9999px;visibility:hidden";
  probe.style.color = value;
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  const m = c.match(/(\d+(?:\.\d+)?)/g);
  if (!m || m.length < 3) return null;
  return [+m[0]!, +m[1]!, +m[2]!];
}
const lin = (c: number) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const lum = (c: [number, number, number]) =>
  0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function ratio(a: string, b: string): number | null {
  const ca = rgbOf(a), cb = rgbOf(b);
  if (!ca || !cb) return null;
  const la = lum(ca), lb = lum(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ---- THE TABLES THE PAGE DRAWS ---------------------------------------
   Declared, because the matrix that matters is the one the app actually
   PAINTS — a product of every token against every other is noise, and a
   contrast report nobody can act on is a contrast report nobody reads. */
const GROUNDS = ["--deck", "--panel", "--well"];
const INKS = ["--legend", "--legend-dim", "--legend-faint", "--value",
              "--lamp", "--armed", "--clip",
              "--v0", "--v1", "--v2", "--v3", "--vb", "--drum"];
const EDGES = ["--rule", "--rule-strong", "--lamp", "--armed", "--clip"];
const MEANINGS = ["--hand", "--clock", "--meter", "--flag"];
const CLUSTERS = ["--lz-h0", "--lz-h1", "--lz-h2", "--lz-h3",
                  "--lz-h4", "--lz-h5", "--lz-h6", "--lz-h7"];
const LEVELS = ["--q1", "--q2", "--q3", "--q4"];
const TYPE = ["--t0", "--t1", "--t2", "--t3", "--t4", "--t5"];
const WEIGHTS = ["--fw-body", "--fw-label", "--fw-block", "--fw-display"];
const RADII = ["--r0", "--r1", "--r2", "--r-pill"];
const SPACE = ["--s1", "--s2", "--s3", "--s4", "--s5"];
const SIZES = ["--tap", "--box", "--cell", "--ctl", "--bw", "--bw-hard",
               "--sl-trough", "--sl-cap", "--sl-grab", "--sl-line",
               "--env-h", "--env-dot", "--bar-h", "--top-h"];

export const TEXT_FLOOR = 4.5;
export const EDGE_FLOOR = 3;

/* ---- SMALL DOM HELPERS ------------------------------------------------ */
function el(tag: string, cls?: string, text?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function section(host: HTMLElement, id: string, title: string,
                 blurb: string): HTMLElement {
  const s = el("section", "dg-sec");
  s.id = id;
  s.appendChild(el("h2", "dg-h", title));
  s.appendChild(el("p", "dg-blurb", blurb));
  host.appendChild(s);
  return s;
}

/* ---- THE PALETTE ------------------------------------------------------ */
function palette(host: HTMLElement): void {
  const s = section(host, "palette", t("ui.gal.palette"), t("ui.gal.palette.help"));

  const swatches = (names: string[], head: string) => {
    s.appendChild(el("h3", "dg-h3", head));
    const grid = el("div", "dg-swatches");
    for (const n of names) {
      const v = tok(n);
      if (!v) continue;
      const cell = el("div", "dg-swatch");
      const chip = el("div", "dg-chip");
      chip.style.background = "var(" + n + ")";
      cell.appendChild(chip);
      cell.appendChild(el("code", "dg-tokname", n));
      /* THE PRINTED VALUE IS A READOUT AND HAS TO FOLLOW THE THEME. It is
         stamped with the token it reads so `remeasure()` can re-resolve it: a
         swatch whose chip repainted and whose number did not would be the
         design system's own page lying about the design system. */
      const val = el("small", "dg-tokval");
      val.setAttribute("data-tok", n);
      cell.appendChild(val);
      grid.appendChild(cell);
    }
    s.appendChild(grid);
  };
  swatches(GROUNDS, t("ui.gal.grounds"));
  swatches(["--legend", "--legend-dim", "--legend-faint", "--on-fill"], t("ui.gal.legends"));
  swatches(["--lamp", "--armed", "--clip", "--value", "--lamp-hot"], t("ui.gal.lamps"));
  swatches(MEANINGS, t("ui.gal.meanings"));
  swatches(["--grey1", "--grey2", "--grey3", "--grey4"], t("ui.gal.greys"));
  swatches(["--v0", "--v1", "--v2", "--v3", "--vb", "--drum"], t("ui.gal.voices"));
  swatches(LEVELS, t("ui.gal.levels"));
  swatches(CLUSTERS, t("ui.gal.clusters"));

  /* THE MATRIX. Measured here, in the browser, on the resolved values — see
     the note at the head of this file. */
  s.appendChild(el("h3", "dg-h3", t("ui.gal.contrast")));
  s.appendChild(el("p", "dg-blurb", t("ui.gal.contrast.help")));
  const table = el("table", "dg-matrix") as HTMLTableElement;
  table.id = "dg-contrast";
  const thead = el("thead");
  const hr = el("tr");
  hr.appendChild(el("th", "", t("ui.gal.foreground")));
  for (const g of GROUNDS) hr.appendChild(el("th", "", g));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tb = el("tbody");
  const row = (fg: string, floor: number) => {
    const tr = el("tr");
    tr.setAttribute("data-fg", fg);
    tr.setAttribute("data-floor", String(floor));
    const th = el("th", "dg-fg");
    const dot = el("i", "dg-dot");
    dot.style.background = "var(" + fg + ")";
    th.appendChild(dot);
    th.appendChild(el("code", "", fg));
    tr.appendChild(th);
    for (const g of GROUNDS) {
      const r = ratio("var(" + fg + ")", "var(" + g + ")");
      const td = el("td", "dg-num");
      td.setAttribute("data-ratio", r == null ? "" : r.toFixed(2));
      td.setAttribute("data-pass", String(r != null && r >= floor));
      td.textContent = r == null ? "—" : r.toFixed(2);
      if (r != null && r < floor) td.classList.add("is-under");
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  };
  const band = (label: string) => {
    const tr = el("tr", "dg-band");
    const td = el("td", "", label);
    td.setAttribute("colspan", String(GROUNDS.length + 1));
    tr.appendChild(td);
    tb.appendChild(tr);
  };
  band(t("ui.gal.asText"));
  for (const f of INKS) row(f, TEXT_FLOOR);
  band(t("ui.gal.asEdge"));
  for (const f of EDGES) row(f, EDGE_FLOOR);
  table.appendChild(tb);
  s.appendChild(table);
}

/* ---- THE SCALES ------------------------------------------------------- */
function scales(host: HTMLElement): void {
  const s = section(host, "scales", t("ui.gal.scales"), t("ui.gal.scales.help"));

  s.appendChild(el("h3", "dg-h3", t("ui.gal.type")));
  const ty = el("div", "dg-stack");
  for (const n of TYPE) {
    const r = el("div", "dg-typerow");
    const w = el("span", "dg-typespec");
    w.style.fontSize = "var(" + n + ")";
    w.textContent = t("ui.gal.specimen");
    r.appendChild(w);
    r.appendChild(el("code", "dg-tokname", n));
    r.appendChild(el("small", "dg-tokval", tok(n)));
    ty.appendChild(r);
  }
  s.appendChild(ty);

  s.appendChild(el("h3", "dg-h3", t("ui.gal.weight")));
  const wt = el("div", "dg-stack");
  for (const n of WEIGHTS) {
    const r = el("div", "dg-typerow");
    const w = el("span", "dg-typespec");
    w.style.fontWeight = "var(" + n + ")";
    w.textContent = t("ui.gal.specimen");
    r.appendChild(w);
    r.appendChild(el("code", "dg-tokname", n));
    r.appendChild(el("small", "dg-tokval", tok(n)));
    wt.appendChild(r);
  }
  s.appendChild(wt);

  s.appendChild(el("h3", "dg-h3", t("ui.gal.space")));
  s.appendChild(el("p", "dg-blurb", t("ui.gal.space.help")));
  const sp = el("div", "dg-stack");
  sp.id = "dg-ramp";
  for (const n of SPACE) {
    const r = el("div", "dg-typerow");
    const bar = el("span", "dg-rampbar");
    bar.style.inlineSize = "var(" + n + ")";
    bar.setAttribute("data-step", n);
    r.appendChild(bar);
    r.appendChild(el("code", "dg-tokname", n));
    r.appendChild(el("small", "dg-tokval", tok(n)));
    sp.appendChild(r);
  }
  s.appendChild(sp);

  s.appendChild(el("h3", "dg-h3", t("ui.gal.radius")));
  const rd = el("div", "dg-swatches");
  for (const n of RADII) {
    const cell = el("div", "dg-swatch");
    const chip = el("div", "dg-chip dg-radchip");
    chip.style.borderRadius = "var(" + n + ")";
    cell.appendChild(chip);
    cell.appendChild(el("code", "dg-tokname", n));
    cell.appendChild(el("small", "dg-tokval", tok(n)));
    rd.appendChild(cell);
  }
  s.appendChild(rd);

  s.appendChild(el("h3", "dg-h3", t("ui.gal.geometry")));
  const geo = el("table", "dg-matrix");
  const gb = el("tbody");
  for (const n of SIZES) {
    const tr = el("tr");
    tr.appendChild(el("th", "dg-fg", n));
    const td = el("td", "dg-num", tok(n));
    td.setAttribute("colspan", "3");
    tr.appendChild(td);
    gb.appendChild(tr);
  }
  geo.appendChild(gb);
  s.appendChild(geo);
}

/* ---- THE ELEMENTS ----------------------------------------------------- */

/** THE CHILDREN A CONTAINER DECLARED, BUILT — and built the same way for
 *  every element that declares any, which is the whole reason the field is on
 *  `ElSpec` and not in an `if` here. `refused` with no `why` is filled from
 *  the catalogue, so a refusal sentence on this page still has one owner. */
function kid(k: DemoKid): HTMLElement {
  const n = document.createElement(k.tag);
  for (const [a, v] of Object.entries(k.attrs || {})) n.setAttribute(a, v);
  if (n.hasAttribute("refused") && !n.hasAttribute("why"))
    n.setAttribute("why", t("ui.gal.demo.why"));
  for (const c of k.kids || []) n.appendChild(kid(c));
  return n;
}

/** Build one live example, in one state. `hover` and `focus` are drawn with
 *  `data-demo`, which nu.css styles beside the real pseudo-class — see
 *  `./api.ts`.
 *
 *  A STATE IS THE ATTRIBUTE OF ITS OWN NAME, and that is the mechanism rather
 *  than a coincidence: `selected` sets `[selected]`, `open` sets `[open]`,
 *  `current` sets `[current]`, and a state added to `ElState` needs no line
 *  here. The two exceptions are named and both are real — the pseudo states,
 *  which no markup can assert, and a control that is ALWAYS standing on a
 *  value, for which "selected" is which word is lit and not an extra flag. */
function example(spec: ElSpec, state: ElState): HTMLElement {
  const n = document.createElement(spec.tag);
  for (const [k, v] of Object.entries(spec.demo)) n.setAttribute(k, v);
  if (state === "selected" && spec.demo["options"]) {
    /* A RAIL AND A SPINNER ARE ALWAYS STANDING ON A VALUE: "selected" for
       them is not an extra attribute, it is WHICH segment is lit. So the
       demo moves the value instead, and the state cell shows the lamp
       travelling rather than a second thing lighting up. */
    const opts = spec.demo["options"]!.split("|");
    const last = opts[opts.length - 1] || "";
    n.setAttribute("value", (last.split(":")[0] || "").replace(/^!/, ""));
  } else if (spec.demoStates && spec.demoStates[state]) {
    /* A DERIVED STATE IS REACHED, NOT ASSERTED. The spec names the INPUT that
       causes it — a year, a query — and the element reflects the state once
       its own filter has run. Forcing `[state]` here as well would draw a
       lamp the element had not lit. */
    for (const [k, v] of Object.entries(spec.demoStates[state]!))
      n.setAttribute(k, v);
  } else if (state !== "rest" && PSEUDO_STATES.indexOf(state) < 0) {
    n.setAttribute(state, "");
  }
  if (state === "refused") n.setAttribute("why", t("ui.gal.demo.why"));
  if (PSEUDO_STATES.indexOf(state) >= 0) n.setAttribute("data-demo", state);
  if (spec.tag === "nu-lamp" && state === "selected") n.setAttribute("on", "");
  for (const k of spec.demoChildren || []) n.appendChild(kid(k));
  n.setAttribute("data-state", state);
  /* A REFUSED CONTROL IS DRAWN REFUSED **AND SAYING WHY**. DESIGN.md
     component 14's whole point is that the reason reaches a thumb, and a
     gallery that drew the dashed edge and stopped would be showing exactly
     the silent grey the law was written against. So the demo PRESSES it,
     once, after it mounts — which is not a fake: it is the control doing the
     one thing a refused control does. The gate presses them too, and reads
     the same sentence off the same node. */
  if (state === "refused")
    requestAnimationFrame(() => {
      const b = n.querySelector<HTMLElement>("button");
      if (b) b.click();
    });
  return n;
}

function elements(host: HTMLElement): void {
  const s = section(host, "elements", t("ui.gal.elements"), t("ui.gal.elements.help"));
  for (const spec of SPEC) {
    const card = el("article", "dg-el");
    card.id = "el-" + spec.tag;
    card.setAttribute("data-tag", spec.tag);
    const head = el("header", "dg-elhead");
    head.appendChild(el("h3", "dg-h3", spec.title));
    head.appendChild(el("code", "dg-tag", "<" + spec.tag + ">"));
    card.appendChild(head);
    card.appendChild(el("p", "dg-what", spec.what));
    card.appendChild(el("p", "dg-from", spec.from));

    /* THE STATES, SIDE BY SIDE. §3's own sentence: every component in every
       state, and the one a component cannot wear is not drawn empty — it is
       not drawn, and the row says how many it has. */
    const states = el("div", "dg-states");
    states.setAttribute("data-count", String(spec.states.length));
    for (const st of ALL_STATES) {
      if (spec.states.indexOf(st) < 0) continue;
      const cell = el("div", "dg-state");
      cell.setAttribute("data-state", st);
      cell.appendChild(el("small", "dg-statename", st));
      const box = el("div", "dg-stagebox");
      box.appendChild(example(spec, st));
      cell.appendChild(box);
      states.appendChild(cell);
    }
    card.appendChild(states);

    /* THE ATTRIBUTE SURFACE. */
    const tbl = el("table", "dg-attrs");
    const tb = el("tbody");
    for (const a of spec.attrs) {
      const tr = el("tr");
      tr.appendChild(el("th", "dg-attr", a.name));
      const ty = el("td", "dg-attrtype",
        a.type === "enum" ? (a.values || []).join(" · ") : a.type);
      tr.appendChild(ty);
      tr.appendChild(el("td", "dg-attrnote", a.note));
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    card.appendChild(tbl);

    const laws = el("dl", "dg-laws");
    const law = (k: string, v: string) => {
      laws.appendChild(el("dt", "", k));
      laws.appendChild(el("dd", "", v));
    };
    law(t("ui.gal.keyboard"), spec.keys);
    law(t("ui.gal.named"), spec.named);
    law(t("ui.gal.refuses"), spec.refuses);
    card.appendChild(laws);
    s.appendChild(card);
  }
}

/* ---- THE THEME SWITCH ------------------------------------------------
   The deck is the committed look; the panel in daylight is a real second
   design and is reached by a hand. This is that hand, and it is the only
   control on this page that is not an example of something. */
function chrome(host: HTMLElement): void {
  const bar = el("div", "dg-bar");
  const h1 = el("h1", "dg-title", t("ui.gal.title"));
  bar.appendChild(h1);
  const btn = document.createElement("nu-button");
  btn.setAttribute("label", t("ui.gal.daylight"));
  btn.setAttribute("mark", "☀");
  btn.id = "dg-theme";
  btn.addEventListener("nu-press", () => {
    const light = root().getAttribute("data-theme") === "light";
    if (light) root().removeAttribute("data-theme");
    else root().setAttribute("data-theme", "light");
    btn.toggleAttribute("selected", !light);
    /* THE NUMBERS FOLLOW THE THEME. A contrast matrix that did not
       re-measure after a theme change would be a table of lies. */
    remeasure();
  });
  bar.appendChild(btn);
  host.appendChild(bar);
}

/** Everything on this page that is a MEASUREMENT rather than a decision, taken
 *  again. Called on the mount and on every theme change. */
function remeasure(): void {
  for (const n of Array.from(
      document.querySelectorAll<HTMLElement>(".dg-tokval[data-tok]"))) {
    const tk = n.getAttribute("data-tok")!;
    const c = rgbOf("var(" + tk + ")");
    n.textContent = c ? "rgb(" + c.join(" ") + ")" : tok(tk);
  }
  const tbl = document.getElementById("dg-contrast");
  if (!tbl) return;
  for (const tr of Array.from(tbl.querySelectorAll<HTMLElement>("tr[data-fg]"))) {
    const fg = tr.getAttribute("data-fg")!;
    const floor = +(tr.getAttribute("data-floor") || "4.5");
    const tds = Array.from(tr.querySelectorAll<HTMLElement>("td"));
    GROUNDS.forEach((g, i) => {
      const td = tds[i];
      if (!td) return;
      const r = ratio("var(" + fg + ")", "var(" + g + ")");
      td.setAttribute("data-ratio", r == null ? "" : r.toFixed(2));
      td.setAttribute("data-pass", String(r != null && r >= floor));
      td.textContent = r == null ? "—" : r.toFixed(2);
      td.classList.toggle("is-under", r != null && r < floor);
    });
  }
}

/** THE WHOLE PAGE, from the definitions. */
export function gallery(host: HTMLElement): void {
  host.classList.add("dg");
  chrome(host);
  palette(host);
  scales(host);
  elements(host);
  remeasure();
  host.setAttribute("data-built", "1");
}
