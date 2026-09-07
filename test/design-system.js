#!/usr/bin/env node
// test/design-system.js — THE DESIGN SYSTEM, MEASURED ON THE PAGE THAT IS IT.
//
// docs/DESIGN-SYSTEM.md is the contract; `nukernel/design.html` is the
// artifact. This gate drives that page under iPhone emulation and asserts the
// five things the round promised, plus the two laws the token move leaves
// behind. Nothing here reads a design decision out of a comment: every number
// below is measured on the rendered page ([[test-the-artifact]] — three
// features shipped broken while every check passed, because the checks read
// source).
//
//   D1  THE GALLERY DRAWS, with zero console errors and zero page errors, and
//       every one of the seven elements the SPEC declares is a defined custom
//       element that put something on the glass.
//   D2  EVERY DECLARED STATE IS ON THE GLASS. For every element and every
//       state in its own row of the SPEC there is a cell, it holds an
//       instance, and that instance has a box. A state declared and not drawn
//       is a gallery that lies about the system.
//   D3  EVERY REFUSED CONTROL SAYS WHY, TO A THUMB. For each refused example:
//       it is `aria-disabled` and NOT `disabled` (a `disabled` button takes no
//       click, so its reason reaches nobody), a tap on it prints a sentence in
//       that widget's own say line, and the sentence is <= 12 words
//       (DESIGN.md §4).
//   D4  NO COMPONENT NAMES A COLOUR. The seven elements' source and the built
//       bundle carry no hex, no rgb()/hsl(), no CSS colour keyword; and
//       nu.css — 9,500 lines of rules — declares no `:root` custom property
//       and types no literal colour outside a comment. tokens.css is the one
//       owner.
//   D5  EVERY SPACING VALUE IS ON THE RAMP. Walked over every box on the
//       gallery: each padding, margin and gap is 0 or one of `--s1..--s5`
//       RESOLVED IN THAT BOX'S OWN FONT SIZE — which is the honest test for an
//       `em` ramp, and the one a pixel comparison gets wrong.
//   D6  THE CONTRAST FLOORS HOLD, in both themes: 4.5:1 for every ink on
//       every ground it is drawn on, 3:1 for every edge. Recomputed here from
//       `getComputedStyle`, and cross-checked against the number the page
//       itself printed — if the two disagree the page is lying to a reader.
//   D7  THE PAGE OBEYS ITS OWN LAWS: nothing scrolls sideways at 320 or 390,
//       every control clears the 44px tap floor, and the three stylesheets are
//       linked in the order the cascade needs.
//   D8  THE TABLE OF CELLS MEANS WHAT IT SAYS. The <nu-table> track is a named
//       group a keyboard can reach; the TRACK scrolls sideways and the PAGE
//       does not; no <nu-cell> is a pill (`--r-pill` is the lozenge's noun and
//       nothing else wears it); an `order` prints only where a chain has more
//       than one member; a refused cell answers in the TABLE's one say line and
//       not in its own; a QUIET cell is inert and is NOT drawn refused; a
//       CONTINUED column head is aria-hidden and takes no press; and the
//       spinner is ONE button that still prints its position, with no
//       `.nu-elstep` left anywhere on the page.
//   D9  THE PLATE, THE MENU ROW, THE INDEX AND THE GLOBE. Every menu row's
//       word starts on ONE vertical line, out of marks whose natural advances
//       differ (measured, so the check cannot pass vacuously); the plate is
//       never a full-width band of glass and is capped short of the bottom
//       band with its own scroll; the globe is SVG with a name, writes NOT ONE
//       paint attribute, and its three verbs — sweeping, marked, empty — are
//       reached rather than asserted; the index rests with every row shown, an
//       empty answer of zero height, exactly one `aria-current` row and no
//       `aria-selected`; a query HIDES rows rather than detaching them and
//       names itself when it matches nothing; and the globe idles at ZERO.
//   D10 A SKIN IS A STYLESHEET, AND THIS IS THE PROOF §1a NAMED FOR ITSELF.
//       docs/DESIGN-SYSTEM.md §1a was, until 2026-09-07, the one law in that
//       document with no check behind it, and it said so in its own words:
//       *"no such file and no such check exists today… Until it is written the
//       SKIN law is unproven as a whole."* D2/D4a/D4b/D4c/D12 measure the five
//       things a skinnable element must NOT do; this measures the one thing
//       that shows a skin actually works, which is a different claim.
//       `nukernel/design-paper.html` is the gallery plus ONE `<link>` — proven
//       by DIFFING the two documents, not by a comment claiming it — and
//       `nukernel/skins/paper.css` is the whole of the second look: no `.ts`
//       edited, no attribute passed, no build run, and no element source
//       anywhere that knows the file exists. Under it, every element still
//       draws in every declared state; every one of the tokens the skin
//       re-answers resolves to something OTHER than the deck's answer, so NOT
//       ONE rule of the default palette wins; all 54 contrast pairings still
//       clear their floors; and the density it loosens does not cost the 44px
//       tap floor or the page's inline axis at 390 or at 320.
//
// Run:  NODE_PATH=/home/ford/aboard-daily/node_modules node test/design-system.js

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { chromium, devices } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const EXE = (() => {
  const home = process.env.HOME || "";
  for (const c of ["chromium-1234/chrome-linux64/chrome",
                   "chromium-1217/chrome-linux64/chrome"]) {
    const p = path.join(home, ".cache/ms-playwright", c);
    if (fs.existsSync(p)) return p;
  }
  return path.join(home, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
})();

const fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push(what);
  console.log((ok ? "  ok   " : "  FAIL ") + what); };

const SERVER_PY = `
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(H, directory=sys.argv[1]))
print(srv.server_address[1], flush=True)
srv.serve_forever()
`;
function standUpServer() {
  const proc = spawn("python3", ["-c", SERVER_PY, ROOT],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("the static server did not report a port")), 10000);
    proc.stdout.on("data", (d) => { buf += d; const m = buf.match(/(\d+)/);
      if (m) { clearTimeout(to); res({ proc, port: +m[1] }); } });
    proc.on("error", (e) => { clearTimeout(to); rej(e); });
  });
}

/* ===== D4 — THE SOURCE HALF, WHICH NEEDS NO BROWSER ====================
   A COLOUR IS A HEX, A FUNCTION OR A KEYWORD, and the keyword list is the one
   that matters here: a component that says `color: white` has named a colour
   just as surely as one that says `#fff`, and a grep for `#` would miss it.
   The list below is every colour keyword this repo could plausibly reach for;
   it does not have to be all 148 to be a gate, and a component reaching for
   `papayawhip` has bigger problems. */
const KEYWORDS = ["white", "black", "red", "green", "blue", "yellow", "orange",
  "purple", "grey", "gray", "silver", "teal", "navy", "maroon", "olive",
  "lime", "aqua", "fuchsia", "cyan", "magenta", "gold", "pink", "brown",
  "beige", "ivory", "khaki", "salmon", "coral", "crimson", "indigo",
  "lavender", "plum", "tan", "violet", "wheat"];
function namesAColour(text) {
  /* comments are prose and may say "green phosphor" all day */
  const bare = text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const hits = [];
  for (const m of bare.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) hits.push(m[0]);
  /* A COLOUR FUNCTION IS ONE WITH A NUMBER IN IT. `"rgb(" + c.join(" ") + ")"`
     — the gallery PRINTING a measured value back to a reader — is a readout,
     not a decision, and a gate that could not tell the two apart would be
     telling this round to stop measuring. */
  for (const m of bare.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(\s*[\d.]/g))
    hits.push(m[0]);
  for (const k of KEYWORDS) {
    const re = new RegExp("(?:color|background|border|fill|stroke|outline|shadow)" +
                          "[^;:{}]*:\\s*[^;{}]*\\b" + k + "\\b", "i");
    if (re.test(bare)) hits.push(k);
  }
  return hits;
}

function sourceChecks() {
  console.log("\nD4 · no component names a colour");
  const dir = path.join(ROOT, "nukernel", "src", "ui");
  const src = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
  let bad = [];
  for (const f of src) {
    const hits = namesAColour(fs.readFileSync(path.join(dir, f), "utf8"));
    if (hits.length) bad.push(f + ": " + hits.slice(0, 4).join(", "));
  }
  check(src.length >= 6 && !bad.length,
    "D4a the " + src.length + " element sources name no colour" +
    (bad.length ? " — " + bad.join(" · ") : ""));

  const built = path.join(ROOT, "nukernel", "ui", "ui.js");
  const okBuilt = fs.existsSync(built);
  const bhits = okBuilt ? namesAColour(fs.readFileSync(built, "utf8")) : ["missing"];
  check(okBuilt && !bhits.length,
    "D4b the built bundle nukernel/ui/ui.js names no colour" +
    (bhits.length ? " — " + bhits.slice(0, 4).join(", ") : ""));

  /* THE LAW THE TOKEN MOVE LEAVES BEHIND: nu.css declares no token and types
     no literal colour; tokens.css is the one owner of both. */
  const css = fs.readFileSync(path.join(ROOT, "nukernel", "nu.css"), "utf8");
  const bareCss = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const roots = (bareCss.match(/:root\s*\{/g) || []).length;
  check(roots === 0,
    "D4c nu.css declares nothing at :root (" + roots + " blocks) — tokens.css is the owner");
  /* A RULE MAY STILL SET A VARIABLE — `.nu-pan{ --sec: 0 }`, `[data-vi="0"]{
     --vpaint: var(--v0) }`, the word grid's column arithmetic. That is a
     component using the system, not declaring it. WHAT IT MAY NOT DO is
     re-declare a token tokens.css owns, which would be a second opinion about
     a value with one owner. */
  const owned = new Set();
  {
    const tokText = fs.readFileSync(path.join(ROOT, "nukernel", "tokens.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ");
    for (const m of tokText.matchAll(/(--[\w-]+)\s*:/g)) owned.add(m[1]);
  }
  /* ONE EXEMPTION, AND IT IS THE MECHANISM RATHER THAN A LEAK. `--paper` is
     THE GROUND YOU ARE STANDING ON, and the section wash's whole design is
     that a view re-declares it on itself (`.nu-ax, #atlas{ --paper:
     color-mix(...) }`), so every rule that paints with it follows for free.
     tokens.css says so on the token's own line. Re-declaring any OTHER token
     would be a second opinion about a value with one owner. */
  const WASH_OK = new Set(["--paper"]);
  const redeclared = [];
  for (const m of bareCss.matchAll(/(--[\w-]+)\s*:/g))
    if (owned.has(m[1]) && !WASH_OK.has(m[1]) && redeclared.indexOf(m[1]) < 0)
      redeclared.push(m[1]);
  check(!redeclared.length,
    "D4d …and re-declares none of tokens.css's " + owned.size + " tokens (" +
    redeclared.length + (redeclared.length ? ": " + redeclared.slice(0, 6).join(", ") : "") + ")");
  const lit = namesAColour(css).filter((h) => h !== "hsl(");   /* the wash's generator, tokenised */
  check(!lit.length,
    "D4e …and types no literal colour in a rule" +
    (lit.length ? " — " + lit.slice(0, 6).join(", ") : ""));

  const tok = fs.readFileSync(path.join(ROOT, "nukernel", "tokens.css"), "utf8");
  const tdecls = (tok.replace(/\/\*[\s\S]*?\*\//g, " ").match(/--[\w-]+\s*:/g) || []).length;
  check(tdecls >= 90,
    "D4f tokens.css declares " + tdecls + " tokens and holds nothing else");
  /* EVERY TOKEN IS ARGUED. Each declaration line either carries its own
     trailing comment or stands under a block comment; a token with neither is
     a value nobody chose. Measured as: no declaration line is naked in a run
     of naked lines longer than the block it belongs to — simplified to the
     honest form, every declaration is within three lines of a comment. */
  const lines = tok.split("\n");
  const naked = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!/^\s*--[\w-]+\s*:/.test(L)) continue;
    if (/\/\*/.test(L)) continue;                       /* argued on its own line */
    let headed = false;
    for (let j = Math.max(0, i - 10); j < i && !headed; j++)
      if (/\/\*|\*\//.test(lines[j])) headed = true;   /* argued by its block */
    if (!headed) naked.push(L.trim().split(":")[0]);
  }
  check(!naked.length,
    "D4g …and every token is argued in the file" +
    (naked.length ? " — " + naked.length + " naked: " + naked.slice(0, 5).join(", ") : ""));
}

/* ===== THE PAGE WALKS ================================================== */

/** D2 — every declared state, drawn. */
const STATES = () => {
  const spec = (globalThis.NuUI || {}).SPEC || [];
  const out = [];
  for (const s of spec) {
    const card = document.querySelector('[data-tag="' + s.tag + '"]');
    for (const st of s.states) {
      const cell = card && card.querySelector('.dg-state[data-state="' + st + '"]');
      const inst = cell && cell.querySelector(s.tag);
      const r = inst ? inst.getBoundingClientRect() : null;
      out.push({ tag: s.tag, state: st,
                 cell: !!cell, inst: !!inst,
                 w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0 });
    }
  }
  return out;
};

/** D3 — every refused example, pressed. */
const REFUSALS = () => {
  const spec = (globalThis.NuUI || {}).SPEC || [];
  const out = [];
  for (const s of spec) {
    if (s.states.indexOf("refused") < 0) continue;
    const card = document.querySelector('[data-tag="' + s.tag + '"]');
    const inst = card && card.querySelector('.dg-state[data-state="refused"] ' + s.tag);
    if (!inst) { out.push({ tag: s.tag, found: false }); continue; }
    const btns = Array.from(inst.querySelectorAll("button"));
    const hardDisabled = btns.filter((b) => b.disabled).length;
    const ariaDisabled = btns.filter((b) => b.getAttribute("aria-disabled") === "true").length;
    /* `:scope >` AND NOT A DESCENDANT SEARCH. Every element's own say line is
       a DIRECT child of it; a container (a refused <nu-table>) holds cells
       that have say lines of their own, and a descendant query would clear
       and then read the wrong one — a check that passes on the wrong node is
       worse than one that fails. */
    const say = inst.querySelector(":scope > .nu-elsay");
    if (say) say.textContent = "";
    if (btns[0]) btns[0].click();
    const said = say ? (say.textContent || "").trim() : "";
    const rect = say ? say.getBoundingClientRect() : null;
    out.push({ tag: s.tag, found: true, btns: btns.length,
               hardDisabled, ariaDisabled, said,
               words: said ? said.split(/\s+/).length : 0,
               visible: !!rect && rect.height > 0 && rect.width > 0 });
  }
  return out;
};

/** D3f — every BUSY example, pressed. The same walk as REFUSALS and for the
 *  same reason (DESIGN.md component 14a, 2026-09-07): a control that is
 *  working is `aria-disabled` and never `disabled`, so it takes the press —
 *  and a press it takes and does not answer is the silent grey wearing a
 *  different attribute. Ignoring a press and refusing one look identical to a
 *  thumb; only one of them says so. */
const BUSIES = () => {
  const spec = (globalThis.NuUI || {}).SPEC || [];
  const out = [];
  for (const s of spec) {
    if (s.states.indexOf("busy") < 0) continue;
    const card = document.querySelector('[data-tag="' + s.tag + '"]');
    const inst = card && card.querySelector('.dg-state[data-state="busy"] ' + s.tag);
    if (!inst) { out.push({ tag: s.tag, found: false }); continue; }
    const btns = Array.from(inst.querySelectorAll("button"));
    const say = inst.querySelector(":scope > .nu-elsay");
    if (say) say.textContent = "";
    if (btns[0]) btns[0].click();
    const said = say ? (say.textContent || "").trim() : "";
    out.push({ tag: s.tag, found: true,
               hardDisabled: btns.filter((b) => b.disabled).length,
               said, words: said ? said.split(/\s+/).length : 0 });
  }
  return out;
};

/** D5 — every rendered spacing value, against the ramp resolved IN ITS BOX. */
const RAMP = () => {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;left:-9999px;visibility:hidden";
  document.body.appendChild(probe);
  const em = {};
  for (const s of ["--s1", "--s2", "--s3", "--s4", "--s5"]) {
    probe.style.fontSize = "100px";
    probe.style.paddingTop = "var(" + s + ")";
    em[s] = parseFloat(getComputedStyle(probe).paddingTop) / 100;   /* the step in em */
  }
  probe.remove();
  const PROPS = ["padding-block-start", "padding-block-end",
                 "padding-inline-start", "padding-inline-end",
                 "margin-block-start", "margin-block-end",
                 "margin-inline-start", "margin-inline-end"];
  const off = [], seen = {};
  let n = 0;
  const name = (el) => el.tagName.toLowerCase() +
    (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/)[0] : "");
  for (const el of document.querySelectorAll("#gal *")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 16;
    const allowed = Object.values(em).map((e) => Math.round(e * fs * 100) / 100);
    const ok = (v) => allowed.some((a) => Math.abs(a - v) < 0.35);  /* sub-pixel rounding */
    /* 0, `auto` AND EVERY NEGATIVE ARE NOT RHYTHM, by nu.css's own list: a
       negative margin is a full-bleed trick paying back a gutter, or the
       visually-hidden utility's -1px hairline clip. Arithmetic, not air. */
    const test = (prop, raw) => {
      const v = parseFloat(raw);
      if (!isFinite(v) || v <= 0) return;
      n++;
      if (ok(v)) return;
      const k = name(el) + " " + prop + " " + v.toFixed(1);
      if (!seen[k]) { seen[k] = 1; off.push(k); }
    };
    for (const p of PROPS) test(p, cs.getPropertyValue(p));
    if (cs.display.includes("flex") || cs.display.includes("grid")) {
      test("row-gap", cs.rowGap); test("column-gap", cs.columnGap);
    }
  }
  return { em, counted: n, off };
};

/** D6 — the contrast floors, recomputed, and cross-checked against the page. */
const CONTRAST = () => {
  const ui = globalThis.NuUI;
  const tbl = document.getElementById("dg-contrast");
  if (!ui || !tbl) return { rows: 0, under: ["no matrix"], disagree: ["no matrix"] };
  const under = [], disagree = [];
  const heads = Array.from(tbl.querySelectorAll("thead th"))
    .slice(1).map((th) => (th.textContent || "").trim());
  let rows = 0;
  for (const tr of Array.from(tbl.querySelectorAll("tr[data-fg]"))) {
    const fg = tr.getAttribute("data-fg");
    const floor = +(tr.getAttribute("data-floor") || "4.5");
    const tds = Array.from(tr.querySelectorAll("td"));
    heads.forEach((g, i) => {
      const td = tds[i];
      if (!td) return;
      rows++;
      const mine = ui.ratio("var(" + fg + ")", "var(" + g + ")");
      const said = parseFloat(td.getAttribute("data-ratio") || "NaN");
      if (mine == null || !(mine >= floor))
        under.push(fg + " on " + g + " = " + (mine == null ? "?" : mine.toFixed(2)) +
                   " (floor " + floor + ")");
      if (!isFinite(said) || Math.abs(said - (mine || 0)) > 0.02)
        disagree.push(fg + " on " + g + ": page says " + said + ", measured " +
                      (mine == null ? "?" : mine.toFixed(2)));
    });
  }
  return { rows, under, disagree };
};

/* ===== D8 — THE TABLE OF CELLS, AND THE SPINNER THAT IS ONE BUTTON =====
   Everything below is about what the GENERIC sweeps cannot see. D1/D2/D3/D5/D7
   already walk every element in the SPEC — they draw it, count its states,
   press its refusal, price its spacing and measure its tap. What they cannot
   know is what these four tags MEAN: that the track and not the page is what
   scrolls, that a cell is square and a lozenge is not, that a refusal made in
   a cell is answered at the foot of the TABLE, that inert and refused are two
   registers, that a number nobody can act on is not printed, and that the
   spinner is now one control rather than three. */
const TABLE = () => {
  const px = (v) => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:-9999px;visibility:hidden;border-radius:" + v;
    document.body.appendChild(probe);
    const r = parseFloat(getComputedStyle(probe).borderRadius) || 0;
    probe.remove();
    return r;
  };
  const card = document.querySelector('[data-tag="nu-table"]');
  const tbl = card && card.querySelector('.dg-state[data-state="rest"] nu-table');
  const track = tbl && tbl.querySelector(":scope > .nu-eltrack");
  const de = document.documentElement;

  /* the cell is square: never --r-pill, and never past --r2 */
  const pill = px("var(--r-pill)"), r2 = px("var(--r2)");
  const round = [];
  for (const c of document.querySelectorAll("#gal .nu-elcell")) {
    const v = parseFloat(getComputedStyle(c).borderRadius) || 0;
    if (v >= pill || v > r2 + 0.5) round.push(v);
  }

  /* a refusal made in a cell is answered at the foot of the TABLE */
  const cellSay = { ran: false };
  const rcell = tbl && tbl.querySelector("nu-cell[refused]");
  const tsay = tbl && tbl.querySelector(":scope > .nu-elsay");
  if (rcell && tsay) {
    const own = rcell.querySelector(":scope > .nu-elsay");
    tsay.textContent = ""; if (own) own.textContent = "";
    const b = rcell.querySelector("button");
    if (b) b.click();
    const r = tsay.getBoundingClientRect();
    cellSay.ran = true;
    cellSay.said = (tsay.textContent || "").trim();
    cellSay.words = cellSay.said ? cellSay.said.split(/\s+/).length : 0;
    cellSay.visible = r.height > 0 && r.width > 0;
    cellSay.ownStayedEmpty = !own || !(own.textContent || "").trim();
    cellSay.hardDisabled = !!(b && b.disabled);
    cellSay.aria = b ? b.getAttribute("aria-disabled") : null;
  }

  /* inert is not refused */
  const q = tbl && tbl.querySelector("nu-cell[quiet]");
  const quiet = q ? {
    found: true,
    buttons: q.querySelectorAll("button").length,
    aria: q.querySelector("[aria-disabled]") ? 1 : 0,
    dashed: q.querySelector(".nu-elcell")
      ? getComputedStyle(q.querySelector(".nu-elcell")).borderTopStyle : "?",
    box: q.getBoundingClientRect().height,
  } : { found: false };

  /* a position nobody can act on is a number for nothing */
  let wantOrder = 0;
  for (const g of document.querySelectorAll("#gal nu-colhead, #gal nu-rowhead")) {
    const n = g.querySelectorAll(":scope > nu-cell[order]").length;
    if (n > 1) wantOrder += n;
  }
  const gotOrder = document.querySelectorAll("#gal .nu-elorder").length;
  const strayOrder = Array.from(document.querySelectorAll("#gal nu-cell[order]"))
    .filter((c) => c.querySelector(".nu-elorder") &&
      c.parentElement.querySelectorAll(":scope > nu-cell[order]").length < 2).length;

  /* a continuation is a readout, not a second door to one room */
  const cont = tbl && tbl.querySelector("nu-colhead[continued]");
  const contHead = cont && cont.querySelector(".nu-elcolhead");

  /* the spinner is ONE button */
  const scard = document.querySelector('[data-tag="nu-spinner"]');
  const spin = scard && scard.querySelector('.dg-state[data-state="rest"] nu-spinner');

  return {
    track: !!track,
    role: track ? track.getAttribute("role") : null,
    named: !!(track && track.getAttribute("aria-label")),
    tabbable: track ? track.tabIndex : -1,
    trackScroll: track ? Math.round(track.scrollWidth - track.clientWidth) : -1,
    pageScroll: Math.round(de.scrollWidth - de.clientWidth),
    round, pill: Math.round(pill), r2: Math.round(r2),
    cellSay, quiet, wantOrder, gotOrder, strayOrder,
    cont: !!cont,
    contHidden: contHead ? contHead.getAttribute("aria-hidden") : null,
    /* `:scope >` — a continuation's CELLS are buttons and are meant to be;
       what may not be one is the HEAD, which is the direct child. */
    contButtons: cont ? cont.querySelectorAll(":scope > button").length : -1,
    spinButtons: spin ? spin.querySelectorAll("button").length : -1,
    spinPos: !!(spin && spin.querySelector(".nu-elpos")),
    steps: document.querySelectorAll("#gal .nu-elstep").length,
  };
};

/* ===== D9 — THE PLATE, THE MENU ROW, THE INDEX AND THE GLOBE ==========
   Four things the generic sweeps draw but cannot judge. A plate that filled
   the screen would still pass D2 and D5 and D7; a menu row with ragged marks
   would pass every one of them; an index whose filter detached its rows would
   look identical to one that hid them; and a globe that spun would pass the
   lot while burning a battery and disobeying the one law its own file
   claims. */
const PANELS = () => {
  const de = document.documentElement;
  const plate = document.querySelector(
    '[data-tag="nu-plate"] .dg-state[data-state="open"] nu-plate');
  const pr = plate ? plate.getBoundingClientRect() : null;
  const pcs = plate ? getComputedStyle(plate) : null;

  /* THE FIXED ADVANCE: every word starts on one vertical line. */
  const starts = [], marks = [];
  if (plate) {
    for (const row of plate.querySelectorAll(".nu-elmenurow")) {
      const rr = row.getBoundingClientRect();
      const w = row.querySelector(".nu-elword");
      const m = row.querySelector(".nu-elmark");
      if (w) starts.push(Math.round((w.getBoundingClientRect().left - rr.left) * 10) / 10);
      if (m) marks.push((m.textContent || "").trim());
    }
  }
  /* AND THE CHECK IS NOT VACUOUS: the marks themselves have DIFFERENT natural
     advances in --sym, which is the whole reason the column exists. Measured
     here, in the same face and size the rows use. */
  const natural = [];
  if (plate && marks.length) {
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;left:-9999px;visibility:hidden;white-space:pre";
    const m0 = plate.querySelector(".nu-elmark");
    if (m0) {
      const cs = getComputedStyle(m0);
      probe.style.font = cs.font ||
        (cs.fontSize + " " + cs.fontFamily);
      document.body.appendChild(probe);
      for (const ch of marks) {
        probe.textContent = ch || " ";
        natural.push(Math.round(probe.getBoundingClientRect().width * 10) / 10);
      }
      probe.remove();
    }
  }
  return {
    found: !!plate,
    width: pr ? Math.round(pr.width) : -1,
    height: pr ? Math.round(pr.height) : -1,
    glass: Math.round(de.clientWidth),
    room: Math.round(de.clientHeight),
    overflowY: pcs ? pcs.overflowY : "?",
    cap: pcs ? Math.round(parseFloat(pcs.maxBlockSize) || 0) : -1,
    named: !!(plate && plate.getAttribute("aria-label")),
    rows: starts.length,
    startsDistinct: Array.from(new Set(starts)),
    naturalDistinct: Array.from(new Set(natural)).length,
  };
};

const ATLAS = () => {
  const pick = (st) => document.querySelector(
    '[data-tag="nu-index"] .dg-state[data-state="' + st + '"] nu-index');
  const rest = pick("rest"), cur = pick("current"), mt = pick("empty");
  const li = (el) => Array.from(el ? el.querySelectorAll(".nu-elixli") : []);
  const shown = (el) => li(el).filter((n) => !n.hasAttribute("hidden")).length;
  const none = (el) => el && el.querySelector(".nu-elixnone");
  const nr = rest ? none(rest).getBoundingClientRect() : null;
  const gl = (st) => document.querySelector(
    '[data-tag="nu-globe"] .dg-state[data-state="' + st + '"] nu-globe');
  const grest = gl("rest"), gsw = gl("sweeping"), gmk = gl("marked"),
        gmt = gl("empty");
  const places = (el) => Array.from(el ? el.querySelectorAll(".nu-elplace") : []);
  const on = (el) => places(el).filter((g) =>
    getComputedStyle(g).display !== "none");
  /* NOT ONE PAINT IS WRITTEN ON THE SVG. Every fill, stroke and opacity comes
     from a rule; a presentation attribute or a style= on any node under the
     globe is the §1a failure this element was written to avoid. */
  const painted = [];
  for (const el of (grest ? grest.querySelectorAll("*") : []))
    for (const a of ["fill", "stroke", "opacity", "fill-opacity",
                     "stroke-opacity", "style", "color", "stroke-width"])
      if (el.hasAttribute(a)) painted.push(el.tagName + "@" + a);
  const svg = grest && grest.querySelector("svg");
  return {
    restRows: li(rest).length, restShown: shown(rest),
    noneEmptyText: rest ? (none(rest).textContent || "").trim() : "?",
    noneEmptyBox: nr ? Math.round(nr.height) : -1,
    curMarked: cur ? cur.querySelectorAll('.nu-elixrow[aria-current="true"]').length : -1,
    ariaSelected: document.querySelectorAll("#gal nu-index [aria-selected]").length,
    emptyFlag: mt ? mt.hasAttribute("empty") : false,
    emptyRows: shown(mt), emptyKept: li(mt).length,
    emptySays: mt ? (none(mt).textContent || "").trim() : "",
    isSvg: !!svg, isCanvas: !!(grest && grest.querySelector("canvas")),
    role: svg ? svg.getAttribute("role") : null,
    globeNamed: !!(svg && svg.getAttribute("aria-label")),
    marksAll: places(grest).length, marksOn: on(grest).length,
    sweptAll: places(gsw).length, sweptOn: on(gsw).length,
    sweptTab: places(gsw).filter((g) =>
      getComputedStyle(g).display === "none" &&
      g.getAttribute("tabindex") === "-1").length,
    sweptOff: places(gsw).filter((g) =>
      getComputedStyle(g).display === "none").length,
    year: !!(gsw && gsw.querySelector(".nu-elyear")),
    markedRing: gmk ? gmk.querySelectorAll('.nu-elplace[aria-current="true"]').length : -1,
    emptyGlobe: gmt ? gmt.hasAttribute("empty") : false,
    emptyGlobeOn: on(gmt).length,
    sweeping: gsw ? gsw.hasAttribute("sweeping") : false,
    marked: gmk ? gmk.hasAttribute("marked") : false,
    named: places(grest).every((g) => !!g.getAttribute("aria-label")),
    painted,
  };
};

/** D7 — the page's own laws. */
const LAWS = () => {
  const de = document.documentElement;
  const taps = [];
  for (const el of document.querySelectorAll(
      "#gal nu-button button, #gal nu-icon-button button, " +
      "#gal .nu-elseg, #gal .nu-elspin, #gal .nu-elcell, " +
      "#gal .nu-elcolhead, #gal .nu-elrowhead, #gal .nu-elmenurow")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.height < 43.5) taps.push(el.className + " " + r.height.toFixed(1));
  }
  const sheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => l.getAttribute("href"));
  return {
    sideways: Math.round(de.scrollWidth - de.clientWidth),
    taps, sheets,
    defined: (globalThis.NuUI ? globalThis.NuUI.SPEC : []).map((s) => s.tag)
      .filter((t) => !!customElements.get(t)).length,
    declared: (globalThis.NuUI ? globalThis.NuUI.SPEC : []).length,
  };
};

(async () => {
  console.log("\nthe design system — driven on nukernel/design.html");
  sourceChecks();

  const srv = await standUpServer();
  const PAGE = "http://127.0.0.1:" + srv.port + "/nukernel/design.html";
  const b = await chromium.launch({ executablePath: EXE });

  for (const W of [320, 390, 1280]) {
    const dev = W === 1280 ? {} : { ...devices["iPhone 14"] };
    dev.viewport = { width: W, height: W === 1280 ? 900 : 844 };
    const ctx = await b.newContext(dev);
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
    await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
    await p.goto(PAGE, { waitUntil: "networkidle" });
    await p.waitForFunction(() => !!document.querySelector("#gal[data-built]"),
      null, { timeout: 15000 });
    await p.waitForTimeout(400);

    console.log("\n=== " + W + " ===");

    /* D1 */
    const laws = await p.evaluate(LAWS);
    check(!errs.length, "D1 at " + W + " the gallery draws with no console error (" +
      errs.length + (errs.length ? ": " + errs.slice(0, 3).join(" · ") : "") + ")");
    check(laws.declared >= 7 && laws.defined === laws.declared,
      "D1b …and all " + laws.declared + " declared elements are defined (" +
      laws.defined + ")");

    /* D2 */
    const states = await p.evaluate(STATES);
    const missing = states.filter((s) => !s.cell || !s.inst || s.h <= 0);
    check(states.length >= 30 && !missing.length,
      "D2 at " + W + " every declared state is on the glass (" + states.length +
      " cells, " + missing.length + " missing" +
      (missing.length ? ": " + missing.slice(0, 4).map((m) => m.tag + "/" + m.state).join(", ") : "") + ")");

    /* D8 — the four new tags, and the spinner's new shape */
    const T = await p.evaluate(TABLE);
    check(T.track && T.role === "group" && T.named && T.tabbable === 0,
      "D8a at " + W + " the <nu-table> track is a named, tab-reachable group (role=" +
      T.role + ", named " + T.named + ", tabindex " + T.tabbable + ")");
    check(!T.round.length,
      "D8b at " + W + " no <nu-cell> is a pill — every one is <= --r2 (" + T.r2 +
      "px, pill is " + T.pill + "px; " + T.round.length + " over" +
      (T.round.length ? ": " + T.round.slice(0, 4).join(", ") : "") + ")");
    check(T.wantOrder === T.gotOrder && !T.strayOrder,
      "D8c at " + W + " an order prints only in a chain of two or more (" +
      T.gotOrder + " printed, " + T.wantOrder + " earned, " + T.strayOrder +
      " stray)");
    check(T.spinButtons === 1 && T.spinPos && T.steps === 0,
      "D8d at " + W + " the spinner is ONE button and still prints its position (" +
      T.spinButtons + " button" + (T.spinPos ? ", position on" : ", NO POSITION") +
      ", " + T.steps + " leftover .nu-elstep)");

    /* D9 — the plate and its rows, at every width */
    const P = await p.evaluate(PANELS);
    check(P.found && P.rows >= 5 && P.startsDistinct.length === 1 &&
          P.naturalDistinct > 1,
      "D9a at " + W + " every menu row's word starts on one line (" + P.rows +
      " rows, " + P.startsDistinct.length + " start offset" +
      (P.startsDistinct.length === 1 ? " of " + P.startsDistinct[0] + "px" :
        "s: " + P.startsDistinct.join(", ")) +
      ", from " + P.naturalDistinct + " different natural mark widths)");
    check(P.found && P.width > 0 && P.width <= P.glass - 44,
      "D9b at " + W + " the plate is never a full-width band of glass (" +
      P.width + "px in " + P.glass + "; a tap needs " + (P.glass - P.width) +
      " >= 44 outside it)");
    check(P.overflowY === "auto" && P.cap > 0 && P.cap < P.room &&
          P.height <= P.cap && P.named,
      "D9c at " + W + " the plate scrolls inside itself and stops short (" +
      "overflow-y " + P.overflowY + ", capped at " + P.cap + " of " + P.room +
      "px of glass, drawn " + P.height + ", named " + P.named + ")");

    /* D8, the half that is about a phone — once at 320 and once at 390 */
    if (W !== 1280) {
      check(T.trackScroll > 0 && T.pageScroll <= 0,
        "D8e at " + W + " the TRACK scrolls sideways and the PAGE does not (" +
        T.trackScroll + "px in the track, " + T.pageScroll + "px in the page)");
    }

    /* D9, the half that needs one width and a hand — 390 */
    if (W === 390) {
      const A0 = await p.evaluate(ATLAS);
      check(A0.isSvg && !A0.isCanvas && A0.role === "application" &&
            A0.globeNamed && A0.named,
        "D9d the globe is SVG with a name, and every mark says its own (" +
        "svg " + A0.isSvg + ", canvas " + A0.isCanvas + ", role " + A0.role +
        ", named " + A0.globeNamed + "/" + A0.named + ")");
      check(!A0.painted.length,
        "D9e …and not one paint is written on it — every fill and stroke is a " +
        "rule (" + A0.painted.length +
        (A0.painted.length ? ": " + A0.painted.slice(0, 4).join(", ") : "") + ")");
      check(A0.sweeping && A0.year && A0.sweptOff > 0 &&
            A0.sweptOff === A0.sweptTab && A0.marked && A0.markedRing === 1 &&
            A0.emptyGlobe && A0.emptyGlobeOn <= 1,
        "D9f …and its three verbs are real: sweeping drops " + A0.sweptOff +
        " marks and stamps the year, marked rings " + A0.markedRing +
        ", empty holds " + A0.emptyGlobeOn);
      check(A0.restShown === A0.restRows && A0.restRows >= 10 &&
            !A0.noneEmptyText && A0.noneEmptyBox === 0 && A0.curMarked === 1 &&
            A0.ariaSelected === 0,
        "D9g the index rests with all " + A0.restRows +
        " rows, an empty answer of zero height, one aria-current row (" +
        A0.curMarked + ") and no aria-selected (" + A0.ariaSelected + ")");
      check(A0.emptyFlag && A0.emptyRows === 0 && A0.emptyKept === A0.restRows &&
            /zzzz/.test(A0.emptySays),
        "D9h …and a query that matches nothing HIDES its rows rather than " +
        "dropping them, and names the query (" + A0.emptyKept + " kept, " +
        A0.emptyRows + " shown, \"" + A0.emptySays + "\")");

      /* THE FILTER, RUN BY A HAND, on the resting list. */
      const SEL = '[data-tag="nu-index"] .dg-state[data-state="rest"] nu-index';
      await p.fill(SEL + " .nu-elixq", "kingston");
      await p.waitForTimeout(150);
      const F = await p.evaluate((sel) => {
        const ix = document.querySelector(sel);
        const li = Array.from(ix.querySelectorAll(".nu-elixli"));
        return { kept: li.length,
                 shown: li.filter((n) => !n.hasAttribute("hidden")).length,
                 words: li.filter((n) => !n.hasAttribute("hidden"))
                   .map((n) => (n.querySelector(".nu-elixw").textContent || "").trim()) };
      }, SEL);
      check(F.kept >= 10 && F.shown === 2 &&
            F.words.join(",") === "Reggae,Dub",
        "D9i a query filters by PLACE and hides rather than detaches (" +
        F.shown + " of " + F.kept + " shown: " + F.words.join(", ") + ")");
      await p.fill(SEL + " .nu-elixq", "");
      await p.waitForTimeout(120);

      /* IT IDLES AT ZERO. The globe's own law, measured the way the app's is:
         nothing changes in its subtree while nobody is touching it. */
      await p.evaluate(() => {
        const g = document.querySelector(
          '[data-tag="nu-globe"] .dg-state[data-state="rest"] nu-globe');
        const w = globalThis;
        w.__globeMut = 0;
        w.__globeObs = new MutationObserver((rs) => { w.__globeMut += rs.length; });
        w.__globeObs.observe(g, { childList: true, subtree: true,
                                  attributes: true, characterData: true });
      });
      await p.waitForTimeout(1500);
      const idle = await p.evaluate(() => {
        const w = globalThis;
        w.__globeObs.disconnect();
        return w.__globeMut;
      });
      check(idle === 0,
        "D9j the globe idles at ZERO — " + idle +
        " changes in its subtree over 1.5s with no hand on it");
    }

    /* D3 — once, at 390, where a thumb is */
    if (W === 390) {
      check(T.cellSay.ran && !!T.cellSay.said && T.cellSay.visible &&
            T.cellSay.ownStayedEmpty && !T.cellSay.hardDisabled &&
            T.cellSay.aria === "true" && T.cellSay.words <= 12,
        "D8f a refused <nu-cell> prints its reason in the TABLE's say line (\"" +
        (T.cellSay.said || "SILENT") + "\", " + T.cellSay.words +
        " words, own line empty " + T.cellSay.ownStayedEmpty +
        ", aria-disabled " + T.cellSay.aria + ")");
      check(T.quiet.found && T.quiet.buttons === 0 && T.quiet.aria === 0 &&
            T.quiet.dashed !== "dashed" && T.quiet.box > 0,
        "D8g a quiet <nu-cell> is INERT and not refused — no button, no " +
        "aria-disabled, no dash (" + JSON.stringify(T.quiet) + ")");
      check(T.cont && T.contHidden === "true" && T.contButtons === 0,
        "D8h a continued <nu-colhead> is a readout: aria-hidden, and it takes " +
        "no press (hidden " + T.contHidden + ", " + T.contButtons + " buttons)");
    }
    if (W === 390) {
      const ref = await p.evaluate(REFUSALS);
      const noFind = ref.filter((r) => !r.found);
      const hard = ref.filter((r) => r.hardDisabled > 0);
      const silent = ref.filter((r) => !r.said);
      const shouty = ref.filter((r) => r.words > 12);
      const unseen = ref.filter((r) => r.said && !r.visible);
      check(ref.length >= 4 && !noFind.length,
        "D3 " + ref.length + " elements draw a refused example (" + noFind.length + " missing)");
      check(!hard.length,
        "D3b …and not one of them is `disabled` — every refusal is aria-disabled (" +
        hard.map((r) => r.tag).join(", ") + ")");
      check(!silent.length,
        "D3c …and a tap on each prints its reason (" +
        (silent.length ? "silent: " + silent.map((r) => r.tag).join(", ")
                       : ref.map((r) => r.tag + " ✓").join(" ")) + ")");
      check(!unseen.length,
        "D3d …in a say line a thumb can see (" + unseen.map((r) => r.tag).join(", ") + ")");
      check(!shouty.length,
        "D3e …and the sentence is <= 12 words (" +
        Math.max(0, ...ref.map((r) => r.words)) + " longest)");

      /* D3f — AND A BUSY CONTROL ANSWERS TOO. */
      const bz = await p.evaluate(BUSIES);
      const bzNone = bz.filter((r) => !r.found);
      const bzHard = bz.filter((r) => r.hardDisabled > 0);
      const bzMute = bz.filter((r) => r.found && !r.said);
      const bzLong = bz.filter((r) => r.words > 12);
      check(bz.length >= 4 && !bzNone.length && !bzHard.length &&
            !bzMute.length && !bzLong.length,
        "D3f a press on a BUSY control is answered, not swallowed — " +
        bz.length + " drawn, " + bzHard.length + " `disabled`, " +
        bzMute.length + " silent, longest " +
        Math.max(0, ...bz.map((r) => r.words)) + " words" +
        (bzMute.length ? " (silent: " + bzMute.map((r) => r.tag).join(", ") + ")" : ""));
    }

    /* D5 */
    const ramp = await p.evaluate(RAMP);
    check(ramp.counted > 100 && !ramp.off.length,
      "D5 at " + W + " every one of " + ramp.counted +
      " rendered spacing values is on the five-step ramp (" + ramp.off.length +
      " off" + (ramp.off.length ? ": " + ramp.off.slice(0, 6).join(" · ") : "") + ")");

    /* D6 — both themes */
    /* THE THEME IS CHANGED THE WAY A HAND CHANGES IT — by pressing the one
       control on this page that is not an example of something — so this also
       proves the toggle works and that the matrix re-measures after it. */
    for (const theme of ["deck", "light"]) {
      if (theme === "light") {
        await p.click("#dg-theme button");
        await p.waitForTimeout(200);
        const on = await p.evaluate(() =>
          document.documentElement.getAttribute("data-theme"));
        check(on === "light",
          "D6c at " + W + " the daylight toggle sets the theme (" + on + ")");
      }
      await p.waitForTimeout(150);
      const c = await p.evaluate(CONTRAST);
      check(c.rows >= 40 && !c.under.length,
        "D6 at " + W + " · " + theme + " every one of " + c.rows +
        " pairings clears its floor (" + c.under.length + " under" +
        (c.under.length ? ": " + c.under.slice(0, 4).join(" · ") : "") + ")");
      check(!c.disagree.length,
        "D6b …and the number the page prints is the number measured (" +
        c.disagree.length + " disagree" +
        (c.disagree.length ? ": " + c.disagree.slice(0, 3).join(" · ") : "") + ")");
    }
    await p.click("#dg-theme button");   /* and back to the deck */
    await p.waitForTimeout(150);

    /* D7 */
    check(laws.sideways <= 0,
      "D7 at " + W + " nothing scrolls sideways at the page level (" +
      laws.sideways + "px over)");
    check(!laws.taps.length,
      "D7b …and every control clears the 44px floor (" + laws.taps.length +
      " short" + (laws.taps.length ? ": " + laws.taps.slice(0, 3).join(", ") : "") + ")");
    check(laws.sheets.join(",") === "fonts.css,tokens.css,nu.css",
      "D7c …and the three sheets are linked in cascade order (" +
      laws.sheets.join(" -> ") + ")");

    await ctx.close();
  }

  /* ===== D10 — A SKIN IS A STYLESHEET, AND HERE IS THE SECOND ONE =======
     docs/DESIGN-SYSTEM.md §1a is the acceptance test of that whole document,
     and until 2026-09-07 it was the one law in it with NO CHECK BEHIND IT —
     the document said so itself, in its own words: *"no such file and no such
     check exists today… Until it is written the SKIN law is unproven as a
     whole, and it is the outstanding acceptance test of this document."*

     THE FIVE SUB-RULES ALREADY MEASURED (D2, D4a, D4b, D4c, D12) ARE THE
     THINGS A SKINNABLE ELEMENT MUST NOT DO. This is the one that shows a skin
     actually works, which is a different claim and needs a different test: not
     "no element names a colour" but "here is a second look, reached by adding
     one stylesheet, and nothing of the first one survives it."

     THE ARTIFACT IS `nukernel/design-paper.html` — `design.html` plus one
     `<link>` — and `nukernel/skins/paper.css`. Everything below is measured on
     the rendered page, never read out of either file's intentions. */
  {
    const PAPER = "http://127.0.0.1:" + srv.port + "/nukernel/design-paper.html";
    console.log("\n=== the second skin ===");

    /* D10a — THE ONE LINE, PROVEN BY DIFF AND NOT BY ASSERTION. A skin that
       needed a second change to the page would not be a skin; a comment
       claiming it did not would be the tree's characteristic bug. So the two
       documents are compared with their comments and their <title> removed,
       and what is left must differ by exactly the one stylesheet link. */
    const strip = (f) => fs.readFileSync(path.join(ROOT, "nukernel", f), "utf8")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<title>[\s\S]*?<\/title>/g, "")
      .split("\n").map((l) => l.trim()).filter(Boolean);
    const base = strip("design.html"), skinned = strip("design-paper.html");
    const extra = skinned.filter((l) => base.indexOf(l) < 0);
    const missing = base.filter((l) => skinned.indexOf(l) < 0);
    check(extra.length === 1 &&
          /^<link rel="stylesheet" href="skins\/paper\.css">$/.test(extra[0]) &&
          !missing.length,
      "D10a the skinned page is the gallery plus ONE stylesheet link and " +
      "nothing else (" + extra.length + " added, " + missing.length +
      " removed" + (extra.length ? ": " + JSON.stringify(extra.slice(0, 3)) : "") + ")");

    /* D10b — AND THE SKIN IS A STYLESHEET AND NOTHING ELSE. No `.ts` knows it
       exists; `nukernel/skins/` holds no code. If either of those stopped
       being true the law would have been kept in name and broken in fact. */
    const skinDir = path.join(ROOT, "nukernel", "skins");
    const skinFiles = fs.existsSync(skinDir) ? fs.readdirSync(skinDir) : [];
    const notCss = skinFiles.filter((f) => !/\.css$/.test(f));
    const uiDir = path.join(ROOT, "nukernel", "src", "ui");
    const tsKnows = fs.readdirSync(uiDir).filter((f) => f.endsWith(".ts"))
      .filter((f) => /paper\.css|skins\//.test(
        fs.readFileSync(path.join(uiDir, f), "utf8")));
    check(skinFiles.length >= 1 && !notCss.length && !tsKnows.length,
      "D10b the skin is " + skinFiles.length + " stylesheet(s) and no code, " +
      "and no element source knows it exists (" + notCss.join(",") +
      tsKnows.join(",") + ")");

    /* D10c..g — DRIVEN. One width is enough for the palette claims; the tap
       floor and the inline axis are asked at the phone's, because a LOOSER
       density is exactly the change that could break them. */
    for (const W of [390, 320]) {
      const dev = { ...devices["iPhone 14"] };
      dev.viewport = { width: W, height: 844 };
      const ctx = await b.newContext(dev);
      const p = await ctx.newPage();
      const errs = [];
      p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
      p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
      await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
      await p.goto(PAPER, { waitUntil: "networkidle" });
      await p.waitForFunction(() => !!document.querySelector("#gal[data-built]"),
        null, { timeout: 15000 });
      await p.waitForTimeout(400);

      const laws = await p.evaluate(LAWS);
      if (W === 390) {
        check(!errs.length && laws.defined === laws.declared,
          "D10c the skinned gallery draws every element with no console error (" +
          errs.length + " errors, " + laws.defined + "/" + laws.declared + " defined)");
        const states = await p.evaluate(STATES);
        const missingS = states.filter((s) => !s.cell || !s.inst || s.h <= 0);
        check(states.length >= 30 && !missingS.length,
          "D10d …and every declared state is still on the glass under it (" +
          states.length + " cells, " + missingS.length + " missing)");

        /* THE CLAIM THE LAW ACTUALLY MAKES: zero rules from the default
           palette winning. Measured as: every token `skins/paper.css`
           re-declares resolves, on the rendered page, to something OTHER than
           the value `tokens.css` gives it. A skin that redeclared a name and
           lost the cascade would show up here as a token still wearing the
           deck's answer — which is precisely "a default rule winning". */
        const skinText = fs.readFileSync(path.join(skinDir, "paper.css"), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, " ");
        const claimed = [...new Set([...skinText.matchAll(/(--[\w-]+)\s*:/g)]
          .map((m) => m[1]))];
        const deckVals = await (async () => {
          const c2 = await b.newContext(dev);
          const p2 = await c2.newPage();
          await p2.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
          await p2.goto(PAGE, { waitUntil: "networkidle" });
          await p2.waitForTimeout(300);
          const v = await p2.evaluate((names) => {
            const cs = getComputedStyle(document.documentElement);
            const out = {};
            for (const n of names) out[n] = cs.getPropertyValue(n).trim();
            return out; }, claimed);
          await c2.close();
          return v;
        })();
        const paperVals = await p.evaluate((names) => {
          const cs = getComputedStyle(document.documentElement);
          const out = {};
          for (const n of names) out[n] = cs.getPropertyValue(n).trim();
          return out; }, claimed);
        const survived = claimed.filter((n) =>
          deckVals[n] !== "" && deckVals[n] === paperVals[n]);
        check(claimed.length >= 40 && !survived.length,
          "D10e the skin re-answers " + claimed.length + " tokens and NOT ONE " +
          "of the deck's answers survives it (" + survived.length + " survived" +
          (survived.length ? ": " + survived.slice(0, 6).join(", ") : "") + ")");

        /* AND IT IS STILL READABLE. A skin may look like anything; it may not
           be unreadable. §1's rule — *"the value wins and the theme bends"* —
           is this file's for a skin exactly as it is for the deck. */
        const c = await p.evaluate(CONTRAST);
        check(c.rows >= 40 && !c.under.length,
          "D10f …and all " + c.rows + " pairings still clear their floor under " +
          "it (" + c.under.length + " under" +
          (c.under.length ? ": " + c.under.slice(0, 4).join(" · ") : "") + ")");
        check(!c.disagree.length,
          "D10g …with the page's own printed numbers re-measured (" +
          c.disagree.length + " disagree)");
      }

      /* THE DENSITY IS THE THING THAT CAN BREAK A LAW. `paper.css` opens every
         step of the ramp; the 44px tap floor is NOT on that ramp and does not
         move with it, and the page's inline axis is not for sale. Asked at
         both widths, because a looser skin fails narrow first. */
      check(laws.sideways <= 0,
        "D10h at " + W + " the skinned page does not scroll sideways (" +
        laws.sideways + "px over)");
      check(!laws.taps.length,
        "D10i at " + W + " …and the 44px floor survives the looser density (" +
        laws.taps.length + " short" +
        (laws.taps.length ? ": " + laws.taps.slice(0, 3).join(", ") : "") + ")");
      const ramp2 = await p.evaluate(RAMP);
      check(ramp2.counted > 100 && !ramp2.off.length,
        "D10j at " + W + " …and all " + ramp2.counted + " spacing values are on " +
        "the SKIN's own ramp (" + ramp2.off.length + " off" +
        (ramp2.off.length ? ": " + ramp2.off.slice(0, 4).join(" · ") : "") + ")");
      await ctx.close();
    }
  }

  await b.close();
  try { process.kill(srv.proc.pid); } catch (e) { /* gone */ }

  console.log("\ndesign system: " + notes.length + " ok, " + fails.length + " failed");
  if (fails.length) { for (const f of fails) console.log("  FAIL " + f); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
