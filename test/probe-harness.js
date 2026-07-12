#!/usr/bin/env node
// faust/probe-harness.js — shared headless-probe plumbing for the live/press
// verification probes (live-test-run.js + probe-*.js). One static file server +
// one chromium-borrow + one page-error tap, so the probes don't each re-carry
// the same ~30 lines. Playwright + chromium are borrowed the same way as always
// (NODE_PATH=/home/ford/ftrain-2025/node_modules, the pinned ms-playwright
// chromium-1217 build).
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".wasm": "application/wasm", ".wav": "audio/wav", ".ogg": "audio/ogg", ".mp3": "audio/mpeg" };
  // ".css" added for the app/ CSS split (2026-07-08): index.html now loads app/app.css
  // via <link rel=stylesheet>. Chromium (standards mode) refuses a stylesheet served
  // as application/octet-stream, which would leave #map unsized and break the layout
  // gate. Real nginx serves .css as text/css already; this mirrors it for the probes.

// static file server rooted at `root`, listening on `port`; resolves the server.
function serve(root, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      if (req.url === "/favicon.ico") { rsp.writeHead(204); return rsp.end(); }
      const p = path.normalize(path.join(root, decodeURIComponent(req.url.split("?")[0])));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { console.error("probe-harness 404:", req.url); rsp.writeHead(404); return rsp.end(); }
      // COOP/COEP: cross-origin isolation, required for the ring engine's
      // SharedArrayBuffer (mirrors serve.sh — the deployed nginx sends these too)
      rsp.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream", "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(port, () => res(srv));
  });
}

// launch the pinned headless chromium (autoplay allowed, no sandbox).
// opts.requireChromium: when TRUE (live-test-run's strict gate), THROW if the
// pinned build is missing; when false/omitted (the probes), fall back to
// playwright's bundled browser instead.
async function launchChromium(opts) {
  opts = opts || {};
  const { chromium } = require("playwright");
  const exe = path.join(process.env.HOME, ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome");
  const launchOpts = { headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"] };
  if (fs.existsSync(exe)) launchOpts.executablePath = exe;
  else if (opts.requireChromium) throw new Error("chromium-1217 not found at " + exe);
  return chromium.launch(launchOpts);
}

// wire pageerror + console-error capture; returns the growing errors array.
function capturePageErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  return errors;
}

// OFFLINE ROUTE — make a page boot with NO reachable network. index.html pulls a
// cosmetic Google-Fonts stylesheet (fonts.googleapis.com / fonts.gstatic.com) and
// app/state.js imports preact+htm from https://esm.sh as ES modules. In this
// sealed sandbox those hosts black-hole, which (a) hangs the 'load' event and
// times out page.goto, and (b) leaves the esm.sh module imports unresolved.
// We fulfil every non-local request locally:
//   - esm.sh / esm.run / unpkg / skypack (or any *.mjs/.js module URL): a VALID
//     JS module exporting the preact/htm names state.js links against (h, render,
//     Fragment + a default). An empty/CSS body would fail strict module-MIME
//     checking and abort app/main.js's whole module graph (state.js never sets
//     window.__S), which trips the probes' zero-error + live-store checks.
//   - everything else (Google-Fonts CSS/woff): a harmless empty 200.
// Only localhost (the harness) + data:/blob: URIs pass through untouched.
const OFFLINE_MODULE_STUB =
  "export const h=()=>null;export const render=()=>null;export const Fragment=()=>null;export default function(){return null;};";
async function installOfflineRoute(page, port, opts) {
  opts = opts || {};
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://localhost:${port}`)) {
      // NEUTRALISE THE FULL APP (opt-in). app/main.js's boot() runs
      // app/starmap.js computeGenreLayout() synchronously at module-eval; under
      // headless SwiftShader with a zero-size <svg> viewport that relaxation is
      // pathologically slow AND collapses the layout, then the GL renderer
      // crashes (~70s). The star-cruise mode + its submodules are self-contained
      // (they don't need the app store), so the probes that only exercise
      // star-cruise serve app/main.js as an inert module: no full-app boot, no
      // esm.sh fetch (so no module-MIME console error), no crash. Probes that DO
      // need the live store (window.__S) leave this off and pay the real boot.
      if (opts.neutralizeMain && /\/app\/main\.js(?:\?|$)/.test(u))
        return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
      return route.continue();
    }
    if (u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    if (/(?:esm\.sh|esm\.run|unpkg\.com|cdn\.skypack\.dev)/.test(u) || /\.m?js(?:\?|$)/.test(u))
      return route.fulfill({ status: 200, contentType: "text/javascript", body: OFFLINE_MODULE_STUB });
    return route.fulfill({ status: 200, contentType: "text/css", body: "" });
  });
}

module.exports = { MIME, serve, launchChromium, capturePageErrors, installOfflineRoute };
