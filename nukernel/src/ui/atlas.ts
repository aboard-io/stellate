// nukernel/src/ui/atlas.ts — <nu-index> and <nu-globe>.
//
// Paul, 2026-09-07: *"It's missing the genre list object with picker and the
// globe."*
//
// THE TWO BIGGEST THINGS ON THE ATLAS, AND THE TWO THE SYSTEM DID NOT NAME.
// `#atlasIndex` is 502 rows of a four-column grid with a search over it;
// `#atlasMap` is a sphere with a mark on every place a record was made. They
// are one file because they are one surface: a list and a map of the same 502
// records, and every state either of them has is a state of that pair.
//
// ===== THEY COST THE APP NOTHING, WHICH IS WHY THEY DRAW THEMSELVES =====
//
// `nukernel/design.html` loads `ui/copy.js` and `ui/ui.js` and no more, and it
// must go on doing so — the app's classic-script tier is 5 MB and a gallery is
// not a reason to grow it. `ui/atlas.js` and `ui/globe.js` are also not
// importable from here for a harder reason than weight: `ui/deps.js`
// destructures twenty-six globals at module top level and throws on any page
// that is not the app. So neither of these elements imports anything from the
// app. `<nu-index>` takes its rows from an ATTRIBUTE and runs the real
// filter over them; `<nu-globe>` takes its marks from an attribute and
// computes the sphere.
//
// AND THAT IS THE POINT RATHER THAN A COMPROMISE: the gallery's twelve rows
// and the app's 502 are then drawn by the SAME rules, in the same element,
// under the same stylesheet — which is what "port the app onto the design
// system" has to mean if it is to mean anything.
//
// THE WORDS ARE THE ATLAS'S OWN, AND NOT A SECOND SET. These two elements
// print five strings and `atlas.*` already owns every one of them —
// `atlas.find.aria`, `atlas.find.clear`, `atlas.find.none`, `atlas.row.aria`,
// `atlas.mark.aria`. Five `ui.ix.*` keys were written first and
// `test/copy.test.js` C4 named the duplicate on the first run, which is C4
// doing exactly its job: one meaning, one key, whichever surface asks. An
// element that is the atlas's list given a tag says the atlas's sentences.
//
// ===== THE SEARCH IS THE REAL ONE (v294), NOT A SKETCH =================
//
// Fold NFD, strip the combining marks, lower-case; split the query on
// whitespace; a row matches when EVERY token is somewhere in its name, its
// key, its place or its year. AND-semantics, because a search that ORs gets
// wider as you type, which is the wrong direction. Rows that do not match are
// HIDDEN AND NOT DETACHED — the list keeps its length, its scroll position and
// its accessibility tree, and a row coming back is a `hidden` toggling rather
// than a node being built.
//
// AND THE EMPTY ANSWER IS A LIVE REGION THAT IS NEVER REMOVED. `#atlasNone`'s
// own law, restated as `.nu-elixnone`: a `role="status"` taken out of the
// accessibility tree and put back does not announce, so it is EMPTY at rest,
// an empty one has no box, and it is never `hidden` and never `display: none`.
//
// ===== THE GLOBE: ARITHMETIC IN JAVASCRIPT, PAINT IN CSS ===============
//
// THE PROJECTION IS ARITHMETIC AND IS THEREFORE ALLOWED HERE. Orthographic,
// equatorial (φ₀ = 0), centred on the Atlantic at λ₀ = −40° because the places
// this catalogue knows most about stand on both of its sides. With φ₀ = 0 the
// mathematics is short enough to read: x = R·cos φ·sin Δλ, y = R·sin φ, so a
// PARALLEL is a horizontal segment, a MERIDIAN is a half-ellipse of semi-axes
// (R·|sin Δλ|, R), the LIMB is the circle itself, and a place is on the near
// face when cos φ·cos Δλ > 0. `ui/globe.js` says `LAND` may legally be `[]` —
// *"a map with no coastline is a worse map"*, not a broken one — so this one
// draws the sea, the graticule, the limb, the year and the marks, and no
// coastline, and it is a globe.
//
// THE PAINT IS NOT ALLOWED HERE, AND THAT IS THE §1a LINE. Not one fill,
// stroke, opacity or colour is written by this file: every visual property of
// every part comes from a rule in nu.css targeting `.nu-elsea`, `.nu-elgrat`,
// `.nu-ellimb`, `.nu-elpin`, `.nu-elring`, `.nu-elyear`. What this file writes
// on an SVG node is GEOMETRY — `cx`, `cy`, `r`, `d`, `x1` — which is the
// projection's output and not a decision about how anything looks. So the
// globe is skinnable by a stylesheet like everything else in this directory,
// and it needs no exception from §1a. (The app's own globe passes the same
// law a different way: it writes the CSS system colours `Canvas` and
// `CanvasText` as presentation attributes, which a rule can still override.)
//
// IT IDLES AT ZERO. Painted once per property change and never on a clock:
// no `requestAnimationFrame`, no interval, no transition that writes an
// attribute. That is the app globe's measured law — 0 frames and 0 attribute
// writes over three seconds at rest — and a gallery that spun would be
// teaching the wrong thing about the element as well as burning a battery.

import { html, nothing, svg } from "lit";
import type { TemplateResult } from "lit";
import type { SVGTemplateResult } from "lit";
import { NuEl, nameOf } from "./base.js";
import { t } from "../copy/global.js";

/** NFD, strip combining marks, lower-case. The one fold, used by the query
 *  and by every field it is matched against, because two folds are two
 *  answers. */
export function fold(s: string): string {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface Row { year: string; name: string; place: string; k: string }

/** `year|name|place|key; year|name|place|key` — semicolons between rows,
 *  pipes between fields, because a genre name may hold a comma and never a
 *  pipe. */
export function parseRows(s: string | null): Row[] {
  if (!s) return [];
  return s.split(";").map((raw) => {
    const f = raw.split("|").map((x) => x.trim());
    return { year: f[0] || "", name: f[1] || "", place: f[2] || "",
             k: f[3] || (f[1] || "").toLowerCase() };
  }).filter((r) => r.name !== "");
}

/* ---- <nu-index> — THE LIST, AND THE FIELD OVER IT --------------------
   ITS STATES ARE THE ONES IT HONESTLY HAS, and one of them is not `selected`.
   The list marks exactly one row `aria-current="true"` and carries no
   `aria-selected` anywhere, because it is not a listbox: the rows are links
   to records, and the marked one is where you ARE. `empty` is the other state
   nothing else in the system has — a query that matched nothing, answered by a
   sentence naming the query rather than by a list that has silently gone. */
export class NuIndex extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String },
    rows: { type: String },
    query: { type: String, reflect: true },
    current: { type: String, reflect: true },
  };
  declare key: string | null;
  declare label: string | null;
  declare rows: string | null;
  declare query: string | null;
  declare current: string | null;
  constructor() {
    super();
    this.key = null; this.label = null; this.rows = null;
    this.query = ""; this.current = null;
  }

  /** The AND-fold, over name, key, place and year. */
  private hit(r: Row): boolean {
    const q = fold(this.query || "").split(/\s+/).filter(Boolean);
    if (!q.length) return true;
    const hay = fold(r.name + " " + r.k + " " + r.place + " " + r.year);
    return q.every((tok) => hay.indexOf(tok) >= 0);
  }

  private type(e: Event): void {
    this.query = (e.target as HTMLInputElement).value;
  }

  override render(): TemplateResult {
    const all = parseRows(this.rows);
    const shown = all.filter((r) => this.hit(r));
    const q = this.query || "";
    return html`<div class="nu-elixfind">
        <input class="nu-elixq" type="search" .value=${q}
          aria-label=${t("atlas.find.aria")}
          @input=${(e: Event) => this.type(e)}>
        <button type="button" class="nu-elixclear"
          aria-label=${t("atlas.find.clear")}
          @click=${() => { this.query = ""; }}>\u2715</button>
      </div>
      <ul class="nu-elixlist" aria-label=${nameOf(this, "") || nothing}
        >${all.map((r) => html`<li class="nu-elixli" data-k=${r.k}
          ?hidden=${!this.hit(r)}><button type="button" class="nu-elixrow"
          aria-current=${this.current && this.current === r.k ? "true" : "false"}
          aria-label=${t("atlas.row.aria",
            { name: r.name, place: r.place, year: r.year })}
          @click=${() => {
            this.current = r.k;
            this.dispatchEvent(new CustomEvent("nu-pick",
              { bubbles: true, composed: true, detail: { value: r.k } }));
          }}><span class="nu-elixy">${r.year}</span
          ><span class="nu-elixw">${r.name}</span
          ><span class="nu-elixp">${r.place}</span></button></li>`)}</ul>
      <p class="nu-elixnone" role="status"
        >${shown.length ? "" : t("atlas.find.none", { q })}</p>`;
  }

  /** `empty` IS DERIVED AND IS REFLECTED, not passed. A caller cannot know
   *  whether a query matched until the filter has run, so the element that
   *  runs it is the one that says so — and it says so as an ATTRIBUTE, which
   *  is how every other state in this system is spelled and how the stylesheet
   *  reaches it. It is deliberately not a reactive property: nothing observes
   *  it, so writing it here cannot start a loop. */
  protected override updated(ch: Map<PropertyKey, unknown>): void {
    super.updated(ch);
    const all = parseRows(this.rows);
    this.toggleAttribute("empty", all.length > 0 && !all.some((r) => this.hit(r)));
  }
}

/* ---- <nu-globe> — A SPHERE, AND NOTHING SCHEDULED -------------------- */

interface Mark { name: string; year: string; lat: number; lon: number; k: string }

/** `name|year|lat|lon|key; …` */
export function parseMarks(s: string | null): Mark[] {
  if (!s) return [];
  return s.split(";").map((raw) => {
    const f = raw.split("|").map((x) => x.trim());
    return { name: f[0] || "", year: f[1] || "",
             lat: parseFloat(f[2] || "0") || 0, lon: parseFloat(f[3] || "0") || 0,
             k: f[4] || (f[0] || "").toLowerCase() };
  }).filter((m) => m.name !== "");
}

const R = 60;        /* the sphere's radius, in the viewBox's own units */
const C = 72;        /* its centre — a 144 x 144 box with a step of air */
const LON0 = -40;    /* the Atlantic: the marks stand on both of its sides */
const RAD = Math.PI / 180;

export class NuGlobe extends NuEl {
  static override properties = {
    key: { type: String }, label: { type: String },
    marks: { type: String },
    year: { type: String, reflect: true },
    at: { type: String, reflect: true },
  };
  declare key: string | null;
  declare label: string | null;
  declare marks: string | null;
  declare year: string | null;
  declare at: string | null;
  constructor() {
    super();
    this.key = null; this.label = null; this.marks = null;
    this.year = null; this.at = null;
  }

  /** x, y and the near-face test, all of it the orthographic projection with
   *  φ₀ = 0. Arithmetic; see the head of this file. */
  private project(lat: number, lon: number):
      { x: number; y: number; near: boolean } {
    const phi = lat * RAD, dl = (lon - LON0) * RAD;
    return {
      x: C + R * Math.cos(phi) * Math.sin(dl),
      y: C - R * Math.sin(phi),
      near: Math.cos(phi) * Math.cos(dl) > 0,
    };
  }

  /** Which marks the swept year holds. No year set is no sweep, and every
   *  mark stands. */
  private held(m: Mark): boolean {
    return !this.year || m.year === this.year;
  }

  private graticule(): SVGTemplateResult[] {
    const out: SVGTemplateResult[] = [];
    for (const lat of [-60, -30, 0, 30, 60]) {
      const half = R * Math.cos(lat * RAD);
      const y = C - R * Math.sin(lat * RAD);
      out.push(svg`<line class="nu-elgratline" x1=${C - half} y1=${y}
        x2=${C + half} y2=${y}></line>`);
    }
    for (const d of [-60, -30, 0, 30, 60]) {
      /* a meridian is the half-ellipse from pole to pole; its semi-minor axis
         is R·|sin Δλ| and the sweep flag says which way it bulges */
      const k = Math.sin(d * RAD);
      const rx = Math.abs(k * R);
      const sweep = k >= 0 ? 1 : 0;
      out.push(svg`<path class="nu-elgratline" d=${
        "M " + C + "," + (C - R) + " A " + rx.toFixed(2) + "," + R +
        " 0 0 " + sweep + " " + C + "," + (C + R)}></path>`);
    }
    return out;
  }

  override render(): TemplateResult {
    const name = nameOf(this, "");
    const ms = parseMarks(this.marks);
    return html`<svg class="nu-elglobe" viewBox="0 0 144 144"
      role="application" tabindex="0" aria-label=${name || nothing}
      ><circle class="nu-elsea" cx=${C} cy=${C} r=${R}></circle
      ><g class="nu-elgrat" aria-hidden="true">${this.graticule()}</g
      ><circle class="nu-ellimb" cx=${C} cy=${C} r=${R}></circle
      >${this.year
        ? svg`<text class="nu-elyear" x=${C} y=${C + R + 12}
            aria-hidden="true">${this.year}</text>` : nothing
      }${ms.map((m) => {
        const p = this.project(m.lat, m.lon);
        const on = p.near && this.held(m);
        return svg`<g class="nu-elplace" data-when=${on ? "1" : "0"}
          role="button" tabindex=${on ? 0 : -1}
          aria-current=${this.at === m.k ? "true" : nothing}
          aria-label=${t("atlas.mark.aria",
            { place: m.name, year: m.year, name: m.k })}
          @click=${() => {
            this.at = m.k;
            this.dispatchEvent(new CustomEvent("nu-pick",
              { bubbles: true, composed: true, detail: { value: m.k } }));
          }}><circle class="nu-elring" cx=${p.x.toFixed(2)} cy=${p.y.toFixed(2)}
            r="8"></circle><circle class="nu-elpin" cx=${p.x.toFixed(2)}
            cy=${p.y.toFixed(2)} r="3.5"></circle></g>`;
      })}</svg>`;
  }

  /** THE THREE DERIVED STATES, REFLECTED. `sweeping` is a year being held,
   *  `marked` is one of the marks being the record that is playing, and
   *  `empty` is a year that holds one mark or none — which is real and
   *  reachable, and on which the year stamp is the whole picture. None of the
   *  three is a reactive property, so writing them here observes nothing and
   *  schedules nothing: the element still paints once per change. */
  protected override updated(ch: Map<PropertyKey, unknown>): void {
    super.updated(ch);
    const ms = parseMarks(this.marks);
    const on = ms.filter((m) => {
      const p = this.project(m.lat, m.lon);
      return p.near && this.held(m);
    });
    this.toggleAttribute("sweeping", !!this.year);
    this.toggleAttribute("marked", !!this.at && on.some((m) => m.k === this.at));
    this.toggleAttribute("empty", !!this.year && on.length <= 1);
  }
}
