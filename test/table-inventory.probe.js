#!/usr/bin/env node
/* test/table-inventory.probe.js — HOW test/table-inventory.json WAS MEASURED
 * (2026-09-04, TABLE.md wave 2b, T7's evidence.)
 *
 * TABLE.md §6 ¶A: *"get rid of everything it replaces … Don't lose unreplaced
 * options."* §7 T7: *"the inventory of every Band and Structure control at
 * HEAD before wave 2, each mapped to its home in the table."*
 *
 * "AT HEAD" IS THE WHOLE POINT, so this is kept rather than deleted with the
 * panes it walks. It was RUN against v265 (3ce6125), where the Band pane and
 * the Structure pane still drew every control the inventory lists, and it walks
 * the RENDERED DOM rather than reading the source — a control that a source
 * scan would find and a thumb could not reach is not a control, and a control
 * a `data-k` grep would miss (a `<select>` at `data-sel`, a range input with
 * only an aria-label) is exactly the kind this had to catch.
 *
 * WHAT IT DOES: opens Kingston 1969 at reading 1 at 390x844, walks every state
 * the two panes have — the roster, the crate, each voice and each of its four
 * facets, the section list, each section's own questions, performance — by
 * pressing the stripe's own rows (`__eightExpand`, which ui/eight.js says is
 * "the row PRESSED … a gate is a hand"), and in each state collects every
 * button / select / input / [data-k] / [data-sel] with its address, its class,
 * its accessible name and its measured box. It writes the raw states, and a
 * roll-up by ADDRESS FAMILY (the part of a `data-k` before the first `|`),
 * which is what the inventory's rows are.
 *
 * IT MEASURED 36 STATES AND 72 FAMILIES. Run it against a tree where the two
 * panes still exist; against this one it will find the table instead and say so.
 *
 * RUN: NODE_PATH=/home/ford/ftrain-2025/node_modules \
 *        node test/table-inventory.probe.js --root <a worktree of v265> \
 *                                           --out  <a directory>
 */
const path = require("path"), fs = require("fs"), { spawn } = require("child_process");
const { chromium } = require("playwright");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i < 0 ? d : argv[i + 1]; };
const ROOT = arg("--root", path.join(__dirname, ".."));
const EXE = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1234/chrome-linux64/chrome");
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
async function open(opts) {
  const proc = spawn("python3", ["-c", SERVER_PY, ROOT], { stdio: ["ignore", "pipe", "pipe"] });
  const port = await new Promise((res) => { let b = ""; proc.stdout.on("data", (d) => {
    b += d; const m = b.match(/(\d+)/); if (m) res(+m[1]); }); });
  const br = await chromium.launch({ executablePath: EXE });
  const p = await (await br.newContext({ viewport: opts.viewport })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await p.route("**/favicon.ico", (r) => r.fulfill({ status: 200, body: "" }));
  await p.goto("http://127.0.0.1:" + port + "/nukernel/index.html#at=Kingston&y=1969&s=1",
    { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  return { p, errs, close: async () => { await br.close(); proc.kill(); } };
}
const OUT = arg("--out", "/tmp/") + "/";
(async () => {
  const H = await open({ viewport: { width: 390, height: 844 } });
  const { p } = H;
  const tree = () => p.evaluate(() => window.__eightTree());
  const expand = async (k) => { await p.evaluate((x) => window.__eightExpand(x), k); await p.waitForTimeout(450); };
  const top = async (t) => { await p.evaluate((n) => window.__eightTab(n), t); await p.waitForTimeout(700); };
  const scan = (hostId) => p.evaluate((id) => {
    const host = document.getElementById(id); if (!host) return [];
    const out = []; const seen = new Set();
    const sel = "button,select,input,textarea,[data-k],[data-sel],[role=combobox],[role=button],[role=slider]";
    for (const el of host.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const key = (el.dataset.k || "") + " " + (el.dataset.sel || "") + " " + el.tagName + " " + (el.type || "") + " " + (el.getAttribute("aria-label") || "").slice(0, 30);
      if (seen.has(key)) continue; seen.add(key);
      out.push({ tag: el.tagName.toLowerCase(), k: el.dataset.k || null, sel: el.dataset.sel || null,
        type: el.type || null, cls: (el.className || "").toString().slice(0, 60),
        aria: el.getAttribute("aria-label") || null, txt: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
        w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 });
    }
    return out;
  }, hostId);

  const states = {};
  const record = async (name, hostId) => { states[name] = await scan(hostId); };

  await top("Band");
  let t = await tree();
  fs.writeFileSync(OUT + "tree-band.json", JSON.stringify(t, null, 1));
  await record("Band:roster", "pan-band");
  const kids = t.rows.filter((r) => r.depth >= 1).map((r) => r.key);
  for (const k of kids) {
    await expand(k);
    const t2 = await tree();
    await record("Band:" + k, "pan-band");
    const sub = t2.rows.filter((r) => r.depth >= 2).map((r) => r.key);
    for (const s of sub) {
      if (states["Band:" + s]) continue;
      await expand(s);
      await record("Band:" + s, "pan-band");
    }
  }

  await top("Structure");
  let ts = await tree();
  fs.writeFileSync(OUT + "tree-struct.json", JSON.stringify(ts, null, 1));
  await record("Structure:list", "pan-structure");
  const skids = ts.rows.filter((r) => r.depth >= 1).map((r) => r.key);
  for (const k of skids) {
    await expand(k);
    const t2 = await tree();
    await record("Structure:" + k, "pan-structure");
    const sub = t2.rows.filter((r) => r.depth >= 2).map((r) => r.key);
    for (const s of sub) {
      if (states["Structure:" + s]) continue;
      await expand(s);
      await record("Structure:" + s, "pan-structure");
    }
  }
  fs.writeFileSync(OUT + "inv-raw.json", JSON.stringify(states, null, 1));
  const fams = {};
  for (const [st, cs] of Object.entries(states)) for (const c of cs) {
    const fam = c.k ? c.k.split("|")[0] : (c.sel ? "sel:" + c.sel.split("|")[0] : c.tag + ":" + (c.cls.split(" ")[0] || ""));
    if (!fams[fam]) fams[fam] = { fam, n: 0, states: new Set(), sample: c, arias: new Set() };
    fams[fam].n++; fams[fam].states.add(st);
    if (c.aria) fams[fam].arias.add(c.aria.slice(0, 60));
  }
  const list = Object.values(fams).map((f) => ({ fam: f.fam, n: f.n, states: [...f.states].slice(0, 4), arias: [...f.arias].slice(0, 3), sample: f.sample }));
  list.sort((a, b) => (a.fam < b.fam ? -1 : 1));
  fs.writeFileSync(OUT + "inv-fams.json", JSON.stringify(list, null, 1));
  console.log("states:", Object.keys(states).length, "families:", list.length);
  console.log(list.map((f) => f.fam + " (" + f.n + ")").join("\n"));
  console.log("ERRS", H.errs.slice(0, 5));
  await H.close();
})();
