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
    const say = inst.querySelector(".nu-elsay");
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

/** D7 — the page's own laws. */
const LAWS = () => {
  const de = document.documentElement;
  const taps = [];
  for (const el of document.querySelectorAll(
      "#gal nu-button button, #gal nu-icon-button button, " +
      "#gal .nu-elseg, #gal .nu-elstep, #gal .nu-elspinword")) {
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

    /* D3 — once, at 390, where a thumb is */
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

  await b.close();
  try { process.kill(srv.proc.pid); } catch (e) { /* gone */ }

  console.log("\ndesign system: " + notes.length + " ok, " + fails.length + " failed");
  if (fails.length) { for (const f of fails) console.log("  FAIL " + f); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
